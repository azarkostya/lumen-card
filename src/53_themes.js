  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): тематические атмосферы — правила тем, сезонность,    */
  /* адвент-календарь.                                                     */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   matchTheme(rules, movie) → правило темы или null                     */
  /*   allowed(theme, mode, month) → показывать ли эту тему сейчас          */
  /*   seasonalIds(collections, month) → id подборок сезона                 */
  /*   adventDays(src, today, words, opened) → 31 окошко адвента (holB)     */
  /*   adventRecord(cards, today, old) → запись lumen_advent_open           */
  /*   adventMissing(src, today, opened) → id запомненных окошек вне пулов  */
  /*   monthOf(date) / month() → месяц 1..12 (month() — через хук _now)      */
  /*   current() → правила тем из манифеста                                 */
  /*   mode() → значение настройки lumen_fx: 'all' | 'seasonal' | 'off'     */
  /*   forMovie(movie) → тема, которую МОЖНО показать этому фильму сейчас   */
  /*   HOLIDAYS — Новый год и Хэллоуин по дате (раунд holB)                 */
  /*   holidayAt(date) → запись календаря или null; holiday() — на сегодня  */
  /*                                                                       */
  /* Здесь нет ни DOM, ни canvas, ни таймеров: движок частиц живёт в        */
  /* src/52_fx.js, а этот модуль только решает, какая тема кому положена.   */
  /* Единственная связь с окружением — current()/mode() (манифест и         */
  /* Storage) и хук _now: живая проверка адвента подменяет им дату, не      */
  /* трогая системные часы (план Task 21 Step 7).                          */
  /*                                                                       */
  /* Ключевые слова приходят из TMDB тремя формами: movie отдаёт            */
  /* keywords.results, tv — keywords.keywords, а кэш героя (src/48_hero.js) */
  /* может положить уже развёрнутый массив. Разбираем все три — иначе тема  */
  /* находилась бы только у фильмов.                                       */
  /* -------------------------------------------------------------------- */

  /* Раунд holB: автоматические темы частиц по ключевым словам фильма —
     космос, море, война, нуар, пустыня, сакура, зомби, Валентин —
     ВЫКЛЮЧЕНЫ. Пользователь, со скрином «Одиссеи» с лучами прожекторов и
     пузырями: «что это за дискотека? Такая тема только на тематических, а
     какая тут тематика? Давай оставим только Рождество и Хэллоуин, а
     оформление потом будем руками докидывать». Остаются праздничные:
     правила christmas и halloween каталога (HOLIDAY_RULES) и праздники по
     дате (HOLIDAYS). Вернуть прочие — LC.fxAutoThemes = true: правила в
     каталоге и движки частиц целы, тесты гоняют их при включённом флаге.
     Читается на каждом вызове forMovie. */
  LC.fxAutoThemes = false;

  LC.themes = (function () {

    /* Раунд holB: адвент под СНГ — весь декабрь, 31 окошко. Прежде он шёл до
       католического сочельника (24 плитки); у нас праздник — Новый год, и
       31-го смотрят «Иронию судьбы» (пользователь). */
    var ADVENT_DAYS = 31;
    /* «Ирония судьбы, или С лёгким паром!» (1976) — TMDB id 43430, найден
       живым запросом search/movie через Lampa на стенде 2026-09-26. Фильм
       есть в подборке «Новогоднее» (src/42_manifest.js, orig_lang ru), но
       окошку 31-го он положен при любом составе пулов: rows дозапросит его
       сам, если в подборке его не окажется. */
    var ADVENT_FINAL_ID = 43430;
    /* Каждое ADVENT_OURS-е окошко — наше новогоднее кино (подборка
       «Новогоднее»), остальные — мировое рождественское: в «Новогоднем» ~10
       фильмов, и на 30 дней их ровно хватает раз в три дня. */
    var ADVENT_OURS = 3;

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Названия ключевых слов фильма одним массивом строк в нижнем регистре.
       Принимает {results:[…]} (movie), {keywords:[…]} (tv) и голый массив. */
    function keywordNames(source) {
      var list = null;
      if (Array.isArray(source)) list = source;
      else if (source && Array.isArray(source.results)) list = source.results;
      else if (source && Array.isArray(source.keywords)) list = source.keywords;
      if (!list) return [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var name = item && typeof item === 'string' ? item : (item && item.name);
        if (name) out.push(('' + name).toLowerCase());
      }
      return out;
    }

    /* Идентификаторы жанров фильма. TMDB отдаёт их объектами в деталях
       (genres:[{id,name}]) и числами в списках (genre_ids:[28,12]). */
    function genreIds(movie) {
      var list = (movie && movie.genres) || (movie && movie.genre_ids) || [];
      if (!Array.isArray(list)) return [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var id = (g && typeof g === 'object') ? g.id : g;
        if (id != null) out.push(Number(id));
      }
      return out;
    }

    function hasGenre(ids, want) {
      if (!want || !want.length) return true;
      for (var i = 0; i < want.length; i++) {
        for (var j = 0; j < ids.length; j++) {
          if (Number(want[i]) === ids[j]) return true;
        }
      }
      return false;
    }

    /* Буква или цифра — продолжение слова; всё остальное (пробел, дефис,
       апостроф, край строки) — его граница. */
    var WORD_CHAR = /[a-z0-9À-ɏЀ-ӿ]/;

    /* Слово (или фраза) want стоит в name целым: вокруг вхождения — границы
       слова. Все вхождения, а не первое: в «sandwich sand» первое «sand» —
       часть слова, второе — целое.
       Волна «хвосты героя», п.E (ревью perf): и во множественном числе —
       ключевые слова TMDB нередко «zombies», «explosions», «witches».
       Окончание — по правилу английского: -es после s/x/z/ch/sh, иначе -s;
       за окончанием — граница слова. «wares» поэтому не «war», а «award»
       отсекает левая граница, как и прежде. */
    function pluralOf(want) {
      return /(s|x|z|ch|sh)$/.test(want) ? 'es' : 's';
    }

    function hasWord(name, want) {
      var tail = pluralOf(want);
      var at = name.indexOf(want);
      while (at >= 0) {
        var before = at > 0 ? name.charAt(at - 1) : '';
        var end = at + want.length;
        var after = name.charAt(end);
        if (after && name.substr(end, tail.length) === tail) {
          var past = name.charAt(end + tail.length);
          if (!(past && WORD_CHAR.test(past))) after = '';
        }
        if (!(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after))) return true;
        at = name.indexOf(want, at + 1);
      }
      return false;
    }

    /* Совпало хотя бы одно ключевое слово правила — целым словом или целой
       фразой, без учёта регистра: «Christmas Eve» ловится словом
       «christmas», «journey into outer space» — фразой «outer space».
       Волна производительности (2026-09-24): прежде хватало вхождения
       подстроки, и частицы — самая дорогая часть «Полного» режима —
       доставались фильмам не по теме: «war» ловился в «award» и «edward»,
       «sea» — в «seattle» и «research», «sand» — в «sandwich», «space» — в
       «workspace». */
    function hasKeyword(names, keywords) {
      if (!keywords || !keywords.length) return false;
      for (var i = 0; i < keywords.length; i++) {
        var want = ('' + keywords[i]).toLowerCase();
        if (!want) continue;
        for (var j = 0; j < names.length; j++) {
          if (hasWord(names[j], want)) return true;
        }
      }
      return false;
    }

    /* Первое подходящее правило по порядку массива либо null. requireGenre
       требует И слово, И жанр: слово «halloween» у комедии — это шутка про
       праздник, а не хоррор, и летучих мышей ей рисовать незачем. */
    function matchTheme(rules, movie) {
      if (!Array.isArray(rules) || !movie) return null;
      var names = keywordNames(movie.keywords);
      if (!names.length) return null;
      var ids = genreIds(movie);
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule || !rule.preset) continue;
        if (!hasKeyword(names, rule.keywords)) continue;
        if (rule.requireGenre && !hasGenre(ids, rule.genres)) continue;
        return rule;
      }
      return null;
    }

    /* Показывать ли тему при режиме настройки mode в месяце month.
       'off' — никогда; 'all' — всякую найденную; 'seasonal' — только тему со
       списком months и только в один из этих месяцев (декабрьский снег есть,
       августовского нет). */
    function allowed(theme, mode, month) {
      if (!theme || mode === 'off') return false;
      if (mode !== 'seasonal') return true;
      var months = theme.months;
      if (!Array.isArray(months) || !months.length) return false;
      for (var i = 0; i < months.length; i++) {
        if (Number(months[i]) === Number(month)) return true;
      }
      return false;
    }

    /* Идентификаторы подборок, у которых season включает month. Месяц 0,
       null или undefined — пустой список (сезонный порядок выключен). */
    function seasonalIds(collections, month) {
      var out = [];
      if (!Array.isArray(collections) || !month) return out;
      for (var i = 0; i < collections.length; i++) {
        var c = collections[i];
        if (!c || !Array.isArray(c.season)) continue;
        for (var j = 0; j < c.season.length; j++) {
          if (Number(c.season[j]) === Number(month)) { out.push(c.id); break; }
        }
      }
      return out;
    }

    /* Месяц даты как 1..12 (getMonth даёт 0..11). */
    function monthOf(date) {
      if (!date || typeof date.getMonth !== 'function') return 0;
      return date.getMonth() + 1;
    }

    /* ------------------------------------------------------------------ */
    /* Раунд holB: праздничные сцены — Новый год и Хэллоуин.               */
    /*                                                                     */
    /* Пользователь: праздничные частицы видны и в «Лёгких» (30 fps, пауза */
    /* при листании); после скрина «Одиссеи» с лучами и пузырями —         */
    /* «оставим только Рождество и Хэллоуин, а оформление потом будем      */
    /* руками докидывать». Сцена показывается:                             */
    /*  - на главной (кадр героя) в окно праздника — у ЛЮБОГО фильма под   */
    /*    фокусом: это оформление дня, а не фильма, и при листании она не  */
    /*    мигает (слой переживает смену фильма — keep в src/52_fx.js);      */
    /*  - у новогодних и рождественских фильмов и у хэллоуинских хорроров  */
    /*    — по ключевым словам (правила christmas и halloween каталога),   */
    /*    на главной и в карточке, как прежде.                             */
    /* Прочие темы по ключевым словам — за флагом LC.fxAutoThemes (в начале */
    /* модуля).                                                            */
    /*                                                                     */
    /* Окна — даты включительно, [месяц, день]. Новый год — сезон под СНГ, */
    /* с 1 декабря по 7 января (решение пользователя 2026-09-26), через    */
    /* границу года;                                                      */
    /* Хэллоуин — неделя до 31 октября и 1 ноября.                        */
    /* id праздника — и класс lumen-theme--<id> на кадре героя. У          */
    /* Хэллоуина он совпадает с темой фильма нарочно: дымка по низу и      */
    /* тыквенное зарево (src/30_css.js) — часть той же сцены.              */
    /* ------------------------------------------------------------------ */

    var HOLIDAYS = [
      { id: 'newyear', from: [12, 1], to: [1, 7], preset: 'winter', accent: '#E8C170' },
      { id: 'halloween', from: [10, 25], to: [11, 1], preset: 'halloween', accent: '#E07B2C' }
    ];

    /* Правила каталога, которые работают и при выключенных автотемах: это
       те же два праздника, но «по фильму». Значение — id праздника в
       HOLIDAYS: при «Только сезонные» сцена фильма живёт в его окне
       (forMovie), а не в месяцах months правила. */
    var HOLIDAY_RULES = { christmas: 'newyear', halloween: 'halloween' };

    /* Ключ даты «месяц·100 + день»: окна сравниваются числами. */
    function dayKey(date) {
      if (!date || typeof date.getMonth !== 'function' || typeof date.getDate !== 'function') return 0;
      return (date.getMonth() + 1) * 100 + date.getDate();
    }

    function inWindow(key, from, to) {
      var a = from[0] * 100 + from[1];
      var b = to[0] * 100 + to[1];
      /* Окно через границу года (1.12–7.01): «после начала ИЛИ до конца». */
      return a <= b ? (key >= a && key <= b) : (key >= a || key <= b);
    }

    function holidayAt(date) {
      var key = dayKey(date);
      if (!key) return null;
      for (var i = 0; i < HOLIDAYS.length; i++) {
        if (inWindow(key, HOLIDAYS[i].from, HOLIDAYS[i].to)) return HOLIDAYS[i];
      }
      return null;
    }

    /* Тема из записи календаря — в том же виде, что правило каталога:
       герой ставит класс lumen-theme--<id> и берёт цвет particleColor. */
    function themeOf(entry) {
      return { id: entry.id, preset: entry.preset, accent: entry.accent, holiday: true };
    }

    /* Правила тем, которые сейчас в игре: все — при LC.fxAutoThemes, иначе
       только праздничные (HOLIDAY_RULES). */
    function rulesNow() {
      var rules = current();
      if (LC.fxAutoThemes === true) return rules;
      var out = [];
      for (var i = 0; i < rules.length; i++) {
        if (rules[i] && HOLIDAY_RULES[rules[i].id]) out.push(rules[i]);
      }
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Раунд holB: адвент под СНГ.                                         */
    /*                                                                     */
    /* 31 окошко — все видны. Прошедшие и сегодняшнее открыты (фильм дня), */
    /* будущие закрыты: на месте постера дверца с датой и замком, фильма   */
    /* в карточке нет вовсе (ни id, ни постера) — кадр героя его не        */
    /* покажет, дедупликация главной не тронет, OK не откроет              */
    /* (src/44_rows.js). 31-е — «Ирония судьбы», особая плитка и закрытой. */
    /*                                                                     */
    /* Раскладка — «наибольший вес» (rendezvous hashing): каждому дню —    */
    /* свободный фильм с наибольшим score(день, id). Прежняя              */
    /* (день · шаг) mod длина пула перетасовывала ВСЕ дни, стоило TMDB     */
    /* добавить в подборку один фильм; теперь новый фильм меняет только   */
    /* те дни, где он побеждает. А открытые окошки ещё и запоминаются      */
    /* (opened — запись lumen_advent_open, adventRecord): фильм прошедшего */
    /* дня остаётся тем же — и сегодня, и 31-го.                           */
    /*                                                                     */
    /* Финальная проверка, L1: запомненный фильм, которого нет в пулах     */
    /* (упал один из пяти запросов, TMDB убрал фильм из подборки), день    */
    /* не теряет: rows дозапрашивает его карточку по id (adventMissing →   */
    /* src.kept), а не получилось — окошко пустое, но НЕ переназначается.  */
    /* Прежде такой день получал другой фильм, и запись закрепляла замену  */
    /* навсегда.                                                           */
    /* ------------------------------------------------------------------ */

    /* Вес пары «день · фильм» — генератор Лемера (48271 mod 2^31−1):
       произведения меньше 2^53, в double точны, Math.imul (ES2015) не
       нужен. */
    function adventScore(day, id) {
      var s = (Math.abs(Math.floor(Number(id) || 0)) % 2147483646) + 1;
      s = (s * 48271) % 2147483647;
      s = (s + day * 16807) % 2147483647;
      s = (s * 48271) % 2147483647;
      return (s * 48271) % 2147483647;
    }

    /* Свободный фильм списка с наибольшим весом дня, либо null. */
    function adventPick(list, day, used) {
      var best = null;
      var top = -1;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (used[c.id]) continue;
        var w = adventScore(day, c.id);
        if (w > top) { top = w; best = c; }
      }
      return best;
    }

    /* Карточки списка без дублей и без пустых id; skip — id, которых здесь
       быть не должно (финальная плитка, уже взятые другим пулом). */
    function adventList(list, skip) {
      var out = [];
      if (!Array.isArray(list)) return out;
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c || c.id == null || c.id === '' || skip[c.id]) continue;
        skip[c.id] = 1;
        out.push(c);
      }
      return out;
    }

    /* Запись lumen_advent_open этого года: {день: id} или пустая. */
    function adventMap(opened, year) {
      if (!opened || typeof opened !== 'object' || Number(opened.y) !== year) return {};
      var d = opened.d;
      return d && typeof d === 'object' ? d : {};
    }

    /* id фильма из записи — целое TMDB-число, иначе null. Запись живёт в
       localStorage, и по ней rows строит путь запроса movie/{id}: мусор
       не должен ни держать окошко, ни уходить в адрес. */
    function adventId(id) {
      var s = String(id);
      return /^[1-9]\d{0,9}$/.test(s) ? Number(s) : null;
    }

    /* id запомненных окошек (прошедшие дни и сегодня), которых нет в
       пулах: rows запросит их карточки по id и отдаст в adventDays полем
       src.kept. Без повторов, по порядку дней. */
    function adventMissing(src, today, opened) {
      var out = [];
      if (!today || typeof today.getMonth !== 'function' || today.getMonth() !== 11) return out;
      if (Array.isArray(src)) src = { world: src };
      src = src || {};
      var have = {};
      var all = (src.ours || []).concat(src.world || []);
      for (var i = 0; i < all.length; i++) if (all[i] && all[i].id != null) have[all[i].id] = 1;
      var map = adventMap(opened, today.getFullYear());
      var open = Math.min(today.getDate(), ADVENT_DAYS);
      for (var day = 1; day <= open; day++) {
        var id = adventId(map[day]);
        if (id === null || have[id]) continue;
        have[id] = 1;
        out.push(id);
      }
      return out;
    }

    /* Копия карточки фильма с полями окошка. Исходный объект не трогаем: он
       лежит в кэше LC.sources и переиспользуется другими рядами. */
    function adventCard(card, day, state, words, extra) {
      var copy = {};
      for (var k in card) {
        if (Object.prototype.hasOwnProperty.call(card, k)) copy[k] = card[k];
      }
      var dayWord = (words && words.day) || 'День';
      var todayWord = (words && words.today) || 'Сегодня';
      copy.day = day;
      /* Метка сегодняшнего — одно «Сегодня»: «Сегодня · день 15» на
         постере ряда не помещалась в строку и рвалась надвое (стенд
         960×540@2); число дня видно и так — соседи «День 14» и дверцы
         «16 декабря». */
      copy.lumen_badge = state === 'today' ? todayWord : dayWord + ' ' + day;
      copy.lumen_advent = { day: day, state: state };
      if (extra && extra.fresh) copy.lumen_advent.fresh = true;
      if (day === ADVENT_DAYS) copy.lumen_advent.final = true;
      return copy;
    }

    /* Окошко без фильма: закрытое (будущий день) или пустое (прошедший, на
       который в пулах не хватило фильма). Подпись — дата. */
    function adventDoor(day, state, words) {
      var date = (words && words.date) || '{d}';
      var door = { day: day, title: date.replace('{d}', day), lumen_advent: { day: day, state: state } };
      if (day === ADVENT_DAYS) door.lumen_advent.final = true;
      return door;
    }

    /* Карточки адвент-календаря: 31 окошко в декабре, иначе пустой список.
       src — {ours, world, final}: наше новогоднее кино, мировое
       рождественское и отдельно запрошенная «Ирония судьбы»; голый массив
       — всё «мировое» (прежняя форма пула). src.kept — карточки
       запомненных окошек, запрошенные по id (adventMissing): только для
       своих дней, в раскладку прочих не идут. opened — прошлая запись
       lumen_advent_open. Сегодняшнее окошко, которого в записи ещё нет,
       помечено fresh — rows один раз играет его открытие. */
    function adventDays(src, today, words, opened) {
      var out = [];
      if (!today || typeof today.getMonth !== 'function') return out;
      if (today.getMonth() !== 11) return out;
      if (Array.isArray(src)) src = { world: src };
      src = src || {};
      var now = today.getDate();
      var skip = {};
      skip[ADVENT_FINAL_ID] = 1;
      var ours = adventList(src.ours, skip);
      var world = adventList(src.world, skip);
      var kept = adventList(src.kept, skip);
      /* «Ирония судьбы»: отдельная карточка или та, что пришла в пулах
         (или среди запрошенных по id). */
      var final = src.final && Number(src.final.id) === ADVENT_FINAL_ID ? src.final : null;
      var all = (src.ours || []).concat(src.world || [], src.kept || []);
      for (var f = 0; !final && f < all.length; f++) {
        if (all[f] && Number(all[f].id) === ADVENT_FINAL_ID) final = all[f];
      }
      var byId = {};
      var i;
      for (i = 0; i < ours.length; i++) byId[ours[i].id] = ours[i];
      for (i = 0; i < world.length; i++) byId[world[i].id] = world[i];
      for (i = 0; i < kept.length; i++) byId[kept[i].id] = kept[i];
      var map = adventMap(opened, today.getFullYear());
      var used = {};
      var pick = {};
      var held = {};
      var day;
      var open = now < ADVENT_DAYS ? now : ADVENT_DAYS;
      /* Сначала — запомненные окошки: их фильм не меняется. Фильма нет ни
         в пулах, ни среди запрошенных по id — окошко держится пустым
         (held): другой фильм на его место не встаёт. */
      for (day = 1; day <= open; day++) {
        if (day === ADVENT_DAYS && final) break;
        var id = adventId(map[day]);
        if (id === null) continue;
        if (!byId[id]) held[day] = 1;
        else if (!used[id]) {
          pick[day] = byId[id];
          used[id] = 1;
        }
      }
      for (day = 1; day <= open; day++) {
        if (pick[day] || held[day] || (day === ADVENT_DAYS && final)) continue;
        var mine = ours.length && day % ADVENT_OURS === 0;
        var c = adventPick(mine ? ours : world, day, used) || adventPick(mine ? world : ours, day, used);
        if (!c) continue;
        pick[day] = c;
        used[c.id] = 1;
      }
      for (day = 1; day <= ADVENT_DAYS; day++) {
        if (day > now) {
          out.push(adventDoor(day, 'locked', words));
          continue;
        }
        var film = day === ADVENT_DAYS && final ? final : pick[day];
        if (!film) {
          out.push(adventDoor(day, 'empty', words));
          continue;
        }
        var state = day === now ? 'today' : 'open';
        out.push(adventCard(film, day, state, words, { fresh: state === 'today' && map[day] == null }));
      }
      return out;
    }

    /* Запись lumen_advent_open после показа: {y: год, d: {день: id}} —
       открытые окошки с фильмом. Малый набор дней текущего года: запись
       прошлого года adventMap не читает.
       old — прежняя запись: её дни этого года сохраняются, новые
       дописываются поверх (L1). Окошко, показанное сегодня пустым, свой
       фильм из записи не теряет, и часы ТВ, ушедшие назад, не стирают
       дни «из будущего». */
    function adventRecord(cards, today, old) {
      var rec = { y: today && typeof today.getFullYear === 'function' ? today.getFullYear() : 0, d: {} };
      var prev = adventMap(old, rec.y);
      for (var k in prev) {
        if (!Object.prototype.hasOwnProperty.call(prev, k)) continue;
        var day = Number(k);
        var id = adventId(prev[k]);
        if (id !== null && day >= 1 && day <= ADVENT_DAYS && Math.floor(day) === day) rec.d[day] = id;
      }
      for (var i = 0; i < (cards || []).length; i++) {
        var c = cards[i];
        var info = c && c.lumen_advent;
        if (!info || c.id == null) continue;
        if (info.state === 'open' || info.state === 'today') rec.d[info.day] = c.id;
      }
      return rec;
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    /* Правила тем из манифеста (обновляются с хостинга без переустановки
       плагина — см. src/42_manifest.js).

       Найдено живой проверкой (2026-09-17): каталог с хостинга, собранный
       ДО этой задачи, поля themes не содержит вовсе, а кэшируется он на 12
       часов — и правил не было бы ни у кого, кто уже открывал плагин.
       Поэтому пустое (или отсутствующее) поле означает «каталог про темы
       не знает», и мы берём встроенный набор: правила тем — часть кода
       фичи, а не только данные. Каталог со СВОИМИ темами встроенные
       заменяет целиком, как и задумано. */
    function current() {
      try {
        var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
        if (m && Array.isArray(m.themes) && m.themes.length) return m.themes;
        var built = LC.manifest && LC.manifest.DEFAULT && LC.manifest.DEFAULT.themes;
        if (Array.isArray(built)) return built;
      } catch (e) {
        warn('themes: manifest failed', e);
      }
      return [];
    }

    /* Значение настройки «Атмосферы». Значения по умолчанию — 'seasonal':
       вид карточки без спроса менять нельзя, а праздничная тема раз в год
       воспринимается как оформление, а не как сюрприз. */
    function mode() {
      var value = 'seasonal';
      try {
        if (LC.pref) value = LC.pref('lumen_fx', 'seasonal');
      } catch (e) { }
      if (value !== 'all' && value !== 'seasonal' && value !== 'off') return 'seasonal';
      return value;
    }

    /* Раунд holB: главная ли на экране. Одна функция forMovie обслуживает и
       кадр героя (src/48_hero.js, applyFx), и карточку фильма
       (src/90_runtime.js, LC.applyFxFor), а праздник и сезон положены только
       главной. Признак — состояние героя: открытие карточки — это старт
       чужой активности, и герой паркуется ДО её complite (park по
       'activity':start); возврат снимает парковку ДО того, как герой
       ставит атмосферу заново (resume -> applyFx). Героя нет (главная без
       кадра, тесты модуля в одиночку) — значит и главной с кадром нет. */
    function onHome() {
      try {
        var hero = LC.hero;
        if (!hero || typeof hero.active !== 'function' || !hero.active()) return false;
        return !(typeof hero.parked === 'function' && hero.parked());
      } catch (e) {
        return false;
      }
    }

    /* Тема, которую можно показать фильму прямо сейчас, либо null. Одна
       точка на карточку и герой: оба зовут её и оба получают одинаковый
       ответ при одинаковых данных.
       Раунд holB: на главной первым — праздник дня (он общий для всей
       главной, и при листании сцена не сменяется на каждом фильме), потом
       тема фильма — из rulesNow(): при выключенных автотемах только
       новогодняя и хэллоуинская. Гейт по режиму анимаций здесь не решается:
       праздничные сцены LC.fx.mount запустит и в «Лёгких», прочие — только
       в «Полных» с «Тяжёлыми эффектами» (src/52_fx.js, allowedNow). */
    function forMovie(movie) {
      var current_mode = mode();
      if (current_mode === 'off') return null;
      var today = api._now();
      if (onHome()) {
        var holiday = holidayAt(today);
        if (holiday) return themeOf(holiday);
      }
      var theme = matchTheme(rulesNow(), movie);
      /* Финальная проверка, B8 (logic-rows S1): при «Только сезонные»
         новогодняя и хэллоуинская сцена фильма — в окно своего праздника
         (Новый год 1.12–7.01, Хэллоуин 25.10–1.11, решение пользователя
         2026-09-26), а не весь январь и весь октябрь по months каталога.
         «Все» — как прежде, круглый год. */
      if (theme && current_mode === 'seasonal' && typeof HOLIDAY_RULES[theme.id] === 'string') {
        var span = holidayAt(today);
        return span && span.id === HOLIDAY_RULES[theme.id] ? theme : null;
      }
      if (!allowed(theme, current_mode, monthOf(today))) return null;
      return theme;
    }

    /* Пресеты, которым идёт светлый цвет вместо акцента темы: снег, звёзды,
       дождь и пузыри — это вода и свет, а не предмет, и золотой снег
       выглядел бы ошибкой. Остальные красятся акцентом своей темы.
       Зимняя сцена (winter) — тоже: белый у неё — цвет снега, а огни
       гирлянды и боке берут свою палитру (LIGHTS в src/52_fx.js). */
    var PALE = { snow: 1, stars: 1, rain: 1, bubbles: 1, winter: 1 };

    /* Цвет частиц темы. Одна точка на карточку и герой — иначе снег в кадре
       главной и снег в карточке могли бы разойтись по цвету. */
    function particleColor(theme) {
      if (!theme) return '#FFFFFF';
      if (PALE[theme.preset]) return '#FFFFFF';
      return theme.accent || '#FFFFFF';
    }

    /* Классы всех известных тем одной строкой — для removeClass перед тем,
       как поставить класс новой темы: список тем живёт в манифесте и может
       прийти с хостинга, поэтому зашивать его в рантайм нельзя. */
    function classNames() {
      /* Раунд holB: и классы праздников — иначе класс lumen-theme--newyear
         с кадра героя не снимался бы никогда. */
      var rules = current().concat(HOLIDAYS);
      var out = [];
      var seen = {};
      for (var i = 0; i < rules.length; i++) {
        var id = rules[i] && rules[i].id;
        if (!id || seen[id]) continue;
        seen[id] = 1;
        out.push('lumen-theme--' + id);
      }
      return out.join(' ');
    }

    /* Хук даты. Живая проверка адвента подменяет его
       (window.lumen_card.themes._now = function () { … }), поэтому month() и
       адвент читают время ЧЕРЕЗ api, а не через локальную ссылку: иначе
       подмена снаружи ничего бы не меняла. */
    function now() {
      return new Date();
    }

    var api = {
      matchTheme: matchTheme,
      allowed: allowed,
      seasonalIds: seasonalIds,
      adventDays: adventDays,
      adventRecord: adventRecord,
      adventMissing: adventMissing,
      ADVENT_DAYS: ADVENT_DAYS,
      ADVENT_FINAL_ID: ADVENT_FINAL_ID,
      monthOf: monthOf,
      month: function () { return monthOf(api._now()); },
      today: function () { return api._now(); },
      HOLIDAYS: HOLIDAYS,
      holidayAt: holidayAt,
      holiday: function () { return holidayAt(api._now()); },
      current: current,
      classNames: classNames,
      particleColor: particleColor,
      mode: mode,
      forMovie: forMovie,
      _now: now
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.themes;

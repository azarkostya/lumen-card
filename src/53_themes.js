  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): тематические атмосферы — правила тем, сезонность,    */
  /* адвент-календарь.                                                     */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   matchTheme(rules, movie) → правило темы или null                     */
  /*   allowed(theme, mode, month) → показывать ли эту тему сейчас          */
  /*   seasonalIds(collections, month) → id подборок сезона                 */
  /*   adventDays(pool, today, words) → карточки адвента с метками          */
  /*   monthOf(date) / month() → месяц 1..12 (month() — через хук _now)      */
  /*   current() → правила тем из манифеста                                 */
  /*   mode() → значение настройки lumen_fx: 'all' | 'seasonal' | 'off'     */
  /*   forMovie(movie) → тема, которую МОЖНО показать этому фильму сейчас   */
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

  LC.themes = (function () {

    /* Адвент идёт до сочельника включительно: 24 плитки, не 31. */
    var ADVENT_LAST = 24;
    /* Шаг раскладки фильмов по дням. Простое число, взаимно простое с любой
       разумной длиной пула, — соседние дни получают далёкие друг от друга
       позиции списка, и подряд не выпадают три части одной франшизы.
       Детерминизм важнее случайности: 5 декабря обязано показывать тот же
       фильм и завтра, и после перезагрузки Lampa. */
    var ADVENT_STEP = 7919;

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
       часть слова, второе — целое. */
    function hasWord(name, want) {
      var at = name.indexOf(want);
      while (at >= 0) {
        var before = at > 0 ? name.charAt(at - 1) : '';
        var after = name.charAt(at + want.length);
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

    /* Копия карточки с полями адвента. Исходный объект не трогаем: он лежит
       в кэше LC.sources и переиспользуется другими рядами. */
    function adventCard(card, day, isToday, words) {
      var copy = {};
      for (var k in card) {
        if (Object.prototype.hasOwnProperty.call(card, k)) copy[k] = card[k];
      }
      var dayWord = (words && words.day) || 'День';
      var todayWord = (words && words.today) || 'Сегодня';
      copy.day = day;
      copy.lumen_badge = isToday
        ? todayWord + ' · ' + dayWord.toLowerCase() + ' ' + day
        : dayWord + ' ' + day;
      /* Сочельник — особая плитка (поправки контроллера к Task 21): рамка
         акцентом рисуется по этому признаку, а не по числу 24 в разметке. */
      if (day === ADVENT_LAST) copy.lumen_final = true;
      return copy;
    }

    /* Карточки адвент-календаря: дни с 1-го по сегодняшний (максимум 24-й),
       по одному фильму на день. Не декабрь — пустой список.

       Раскладка: индекс дня = (day * ADVENT_STEP) % длина пула, а занятые
       позиции обходятся линейно вперёд — так один и тот же фильм не выпадет
       дважды, и при этом каждый день сохраняет своё кино между запусками.
       Пул короче числа дней — лишние дни просто не появляются: показывать
       повтор хуже, чем не показывать день. */
    function adventDays(pool, today, words) {
      var out = [];
      if (!Array.isArray(pool) || !pool.length) return out;
      if (!today || typeof today.getMonth !== 'function') return out;
      if (today.getMonth() !== 11) return out;
      var last = today.getDate();
      if (last > ADVENT_LAST) last = ADVENT_LAST;
      var used = {};
      for (var day = 1; day <= last; day++) {
        if (out.length >= pool.length) break;
        var index = (day * ADVENT_STEP) % pool.length;
        var guard = 0;
        while (used[index] && guard < pool.length) {
          index = (index + 1) % pool.length;
          guard++;
        }
        if (used[index]) break;
        used[index] = 1;
        out.push(adventCard(pool[index], day, day === today.getDate(), words));
      }
      return out;
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

    /* Тема, которую можно показать фильму прямо сейчас, либо null. Одна
       точка на карточку и герой: оба зовут её и оба получают одинаковый
       ответ при одинаковых данных. */
    function forMovie(movie) {
      var current_mode = mode();
      if (current_mode === 'off') return null;
      var theme = matchTheme(current(), movie);
      if (!allowed(theme, current_mode, api.month())) return null;
      return theme;
    }

    /* Пресеты, которым идёт светлый цвет вместо акцента темы: снег, звёзды,
       дождь и пузыри — это вода и свет, а не предмет, и золотой снег
       выглядел бы ошибкой. Остальные красятся акцентом своей темы. */
    var PALE = { snow: 1, stars: 1, rain: 1, bubbles: 1 };

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
      var rules = current();
      var out = [];
      for (var i = 0; i < rules.length; i++) {
        if (rules[i] && rules[i].id) out.push('lumen-theme--' + rules[i].id);
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
      monthOf: monthOf,
      month: function () { return monthOf(api._now()); },
      today: function () { return api._now(); },
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

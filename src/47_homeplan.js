  /* -------------------------------------------------------------------- */
  /* LC.homeplan — план главной: какие ряды и на каких местах               */
  /*                                                                       */
  /* Волна 4 (ТВ 2026-09-24). Пользователь: «нет ротации списков в начале, */
  /* постоянно только что вы смотрели раньше — это бесит». Первыми рядами  */
  /* всегда стояли «Досмотреть» и «Потому что вы смотрели», ниже — одни и  */
  /* те же 7 подборок manifest.home.                                       */
  /*                                                                       */
  /* Эпоха — номер «раскладки» главной: {n, at} в Lampa.Storage            */
  /* (lumen_home_epoch). Шаг — при первом построении главной после         */
  /* активации (то есть при запуске Lampa), если с прошлого шага прошло    */
  /* не меньше 10 минут, и раз в 3 часа; пересборка главной из-за          */
  /* настройки шаг не делает. Всё случайное в плане — от зерна эпохи:      */
  /* одна эпоха даёт одну и ту же главную, и «Назад» из карточки порядок   */
  /* не меняет (главную Lampa тогда вообще не строит заново).              */
  /*                                                                       */
  /* Публичное API (чистые функции):                                        */
  /*   rng(seed) → () → [0, 1) — ГПСЧ Парк–Миллер                           */
  /*   seedOf(n, salt) → зерно эпохи n для своей соли                       */
  /*   nextEpoch(rec, now, firstBuild) → rec (тот же объект — шага нет)     */
  /*   pickAnchor(history, n, seed) → исходный фильм «Потому что»           */
  /*   planHome(opts) → {slots: [{place, kind, id, item}], lead}             */
  /*   recentLeads(leads, n) / rememberLead(leads, n, id) — лидеры эпох      */
  /*                                                                       */
  /* Публичное API (runtime, требуют Lampa):                                */
  /*   apply(opts) — план и регистрация рядов главной в ContentRows          */
  /*   unregister() — снять все наши ряды                                   */
  /*   hold(on) — идёт пересборка главной из-за настройки: эпоху не двигать */
  /*                                                                       */
  /* Почему регистрирует ОДИН модуль и строго по возрастанию места.        */
  /* ContentRows.call('main', …) обходит ряды в порядке регистрации и      */
  /* вставляет функцию каждого по его index: splice(index, 0, fn)           */
  /* (vendor/lampa/app.min.js:18083-18108, Arrays.insert — :2362). Итог     */
  /* зависел от порядка регистрации: при каталоге из кэша подборки           */
  /* регистрировались раньше личных рядов и вставали после четырёх рядов    */
  /* Lampa, при каталоге из сети — сразу за личными. Ряды, вставленные по   */
  /* возрастанию мест, занимают ровно свои места, а незанятые места         */
  /* достаются рядам Lampa по порядку — и ряды Lampa с index 1, заведённые  */
  /* при её старте раньше плагина (continue_watch — :22241, timetable_* —   */
  /* :21454, :21486), наших не сдвигают.                                   */
  /* -------------------------------------------------------------------- */

  LC.homeplan = (function () {

    /* Модуль Парка–Миллера: 2^31 − 1. */
    var MOD = 2147483647;

    /* Шаг эпохи: первое построение после активации — не чаще раза в 10
       минут (перезапуск Lampa подряд не перетасовывает главную), и раз в
       3 часа без перезапуска. */
    var FIRST_GAP = 10 * 60000;
    var EPOCH_MS = 3 * 3600000;

    /* Из скольких последних фильмов истории выбирается исходный фильм
       «Потому что вы смотрели». */
    var ANCHOR_RECENT = 5;

    /* Соли зёрен: у раскладки подборок, у «Потому что» и у места сезонной
       потоки свои. */
    var SALT_ROWS = 1;
    var SALT_ANCHOR = 2;
    var SALT_SEASON = 3;

    /* Места личных рядов при ротации. Место 2 не занимаем: туда встаёт
       первый ряд Lampa («Сейчас смотрят»). Личные ряды не на месте 0 и не
       подряд; «Досмотреть» — всегда вторым. */
    var PLACES = { 'continue': 1, new_episodes: 3, because: 5, soon: 8 };
    var LAMPA_PLACE = 2;

    /* Режим «Сначала «Досмотреть»» — как до волны 4: личные ряды сверху,
       подборки с места 4. */
    var HISTORY_PLACES = { 'continue': 0, because: 1, new_episodes: 2, soon: 3 };
    var HISTORY_ROWS_FROM = 4;
    var PERSONAL_ORDER = ['continue', 'because', 'new_episodes', 'soon'];

    /* Сезонная подборка в свой месяц — одна, на местах 0…SEASON_TOP; не
       лидер — на свободном месте SEASON_FROM…SEASON_TOP по зерну эпохи.
       Ревью волны 4: с первым свободным местом сверху «Хэллоуин» стоял
       третьим во всех эпохах до ноября, и начало главной не менялось. */
    var SEASON_FROM = 3;
    var SEASON_TOP = 7;

    /* Доля состава из одной группы — не больше 1/GROUP_SHARE. */
    var GROUP_SHARE = 4;

    /* Сколько лидеров прошлых эпох не повторять и сколько хранить. */
    var LEADS_AVOID = 2;
    var LEADS_KEEP = 4;

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* ГПСЧ Парк–Миллер: s = s · 16807 mod (2^31 − 1). Произведение не
       больше 2^46 — точное в double, Math.imul не нужен. Ноль — неподвижная
       точка, поэтому зерно 0 заменяется единицей. */
    function rng(seed) {
      var s = Math.floor(Math.abs(Number(seed) || 0)) % MOD;
      if (s <= 0) s = 1;
      return function () {
        s = s * 16807 % MOD;
        return (s - 1) / (MOD - 1);
      };
    }

    /* xorshift32: перемешивание 32-битного числа сдвигами и XOR (ES5, без
       умножения). */
    function mix(x) {
      x = x | 0;
      x ^= x << 13;
      x ^= x >>> 17;
      x ^= x << 5;
      return x >>> 0;
    }

    /* Зерно эпохи n. Номер сперва перемешивается: у Парка–Миллера потоки
       соседних зёрен связаны линейно — поток зерна n+1 это поток зерна n,
       сдвинутый на постоянную, — и перестановки соседних эпох похожи
       (замер на каталоге: при зерне n первыми в перестановке 9 эпох из 16
       стояли «Корейские дорамы»). */
    function seedOf(n, salt) {
      var x = mix(mix((Math.floor(Number(n) || 0) + 1) | 0) ^ (salt | 0));
      return (x % (MOD - 1)) + 1;
    }

    /* Следующая эпоха или та же (тот же объект rec — писать нечего).
       firstBuild — первое построение главной после активации плагина. Часы
       ушли назад (телевизор синхронизировал время) — шаг сразу: иначе
       эпоха застыла бы до прежнего времени. */
    function nextEpoch(rec, now, firstBuild) {
      var ok = rec && typeof rec.n === 'number' && isFinite(rec.n) && rec.n >= 0 &&
        typeof rec.at === 'number' && isFinite(rec.at);
      if (!ok) return { n: 1, at: now };
      var gap = now - rec.at;
      if (gap < 0 || gap >= EPOCH_MS || (firstBuild && gap >= FIRST_GAP)) {
        return { n: Math.floor(rec.n) + 1, at: now };
      }
      return rec;
    }

    /* Исходный фильм «Потому что вы смотрели»: один из n последних
       уникальных фильмов истории (LC.personal.pickBecause — история Lampa
       идёт от новых к старым), по зерну эпохи. */
    function pickAnchor(history, n, seed) {
      var recent = (LC.personal && typeof LC.personal.pickBecause === 'function') ? LC.personal.pickBecause(history, n) : [];
      if (!recent.length) return null;
      return recent[Math.floor(rng(seed)() * recent.length)];
    }

    function inSeason(item, month) {
      if (!month || !item || !item.season) return false;
      for (var i = 0; i < item.season.length; i++) if (item.season[i] === month) return true;
      return false;
    }

    function offSeason(item, month) {
      return !!(month && item && item.season && item.season.length && !inSeason(item, month));
    }

    /* Подборка Кинопоиска: без ключа её ряд пуст (LC.sources.fetchKp). */
    function kpOnly(item) {
      if (!item) return false;
      if (item.group === 'kp') return true;
      var s = item.sources || {};
      var any = false;
      if (s.movie) { if (s.movie.type !== 'kp') return false; any = true; }
      if (s.tv) { if (s.tv.type !== 'kp') return false; any = true; }
      return any;
    }

    /* Взвешенная случайная перестановка (Efraimidis–Spirakis): ключ
       u^(1/w), по убыванию. Равные ключи — по исходному порядку, чтобы
       результат не зависел от устойчивости sort у движка. */
    function weightedOrder(pool, weight, rand) {
      var keyed = [];
      for (var i = 0; i < pool.length; i++) {
        keyed.push({ item: pool[i], i: i, key: Math.pow(rand(), 1 / weight[i]) });
      }
      keyed.sort(function (a, b) { return (b.key - a.key) || (a.i - b.i); });
      var out = [];
      for (var k = 0; k < keyed.length; k++) out.push(keyed[k].item);
      return out;
    }

    /* Состав подборок ротации: лидер первым, потом (не в декабре с
       адвентом) сезонная в свой месяц, если лидер не она, потом остальные
       по перестановке — всего limit.
       Пул — весь каталог, кроме подборок Кинопоиска без ключа и сезонных не
       в свой месяц; набор manifest.home — с двойным весом. Выбранный вручную
       состав (picked) — ровно он, крутится только его порядок. */
    function choose(o, month, limit) {
      var manifest = o.manifest;
      if (!manifest || !Array.isArray(manifest.collections) || limit <= 0) return [];
      var off = typeof o.off === 'function' ? o.off : function () { return false; };
      var i, c;
      var pool = [];
      var weight = [];
      var picked = o.picked && o.picked.length ? o.picked : null;
      if (picked) {
        var byId = {};
        for (i = 0; i < manifest.collections.length; i++) byId[manifest.collections[i].id] = manifest.collections[i];
        var seen = {};
        for (i = 0; i < picked.length; i++) {
          c = byId[picked[i]];
          if (!c || seen[c.id] || off(c.id)) continue;
          seen[c.id] = 1;
          pool.push(c);
          weight.push(1);
        }
      } else {
        var home = {};
        var ids = manifest.home || [];
        for (i = 0; i < ids.length; i++) home[ids[i]] = 1;
        for (i = 0; i < manifest.collections.length; i++) {
          c = manifest.collections[i];
          if (!c || !c.id || off(c.id)) continue;
          if (!o.kpKey && kpOnly(c)) continue;
          if (offSeason(c, month)) continue;
          pool.push(c);
          weight.push(home[c.id] ? 2 : 1);
        }
      }
      if (!pool.length) return [];

      var order = weightedOrder(pool, weight, rng(seedOf(o.epoch, SALT_ROWS)));
      var recent = o.recentLeads || [];
      /* Сезонная была лидером в одной из двух прошлых эпох — в этой
         лидером сезонной не быть (не чаще раза в 3 эпохи): в январе в
         сезоне три подборки, и место 0 переходило бы от одной к другой. */
      var seasonLed = false;
      for (i = 0; i < manifest.collections.length; i++) {
        c = manifest.collections[i];
        if (c && recent.indexOf(c.id) !== -1 && inSeason(c, month)) seasonLed = true;
      }
      /* Лидер — первый по перестановке, кого не было лидером в двух прошлых
         эпохах. Подборка Кинопоиска без ключа (бывает только в выбранном
         вручную составе) лидером не встаёт: её ряд пуст, и место 0 занял
         бы личный ряд. В декабре с адвентом лидер — не сезонная: адвент сам
         сезонный ряд наверху и собран из рождественских подборок. */
      var lead = null;
      for (i = 0; i < order.length && !lead; i++) {
        if (recent.indexOf(order[i].id) !== -1) continue;
        if (!o.kpKey && kpOnly(order[i])) continue;
        if ((o.advent || seasonLed) && inSeason(order[i], month)) continue;
        lead = order[i];
      }
      if (!lead) lead = order[0];
      var chosen = [lead];
      if (!o.advent && !inSeason(lead, month)) {
        for (i = 0; i < order.length; i++) {
          if (inSeason(order[i], month)) { chosen.push(order[i]); break; }
        }
      }
      /* Из одной группы — не больше четверти состава: подборки группы
         стоят в каталоге подряд и берут соседние числа ГПСЧ, и без потолка
         бывала главная из девяти «Режиссёров» из пятнадцати (эпоха 6 на
         каталоге). Выбранный вручную состав не ограничиваем — он весь
         пользователя; не хватило групп — добираем без потолка. */
      var cap = picked ? limit : Math.ceil(limit / GROUP_SHARE);
      var count = {};
      for (i = 0; i < chosen.length; i++) count[chosen[i].group] = (count[chosen[i].group] || 0) + 1;
      for (var pass = 0; pass < 2 && chosen.length < limit; pass++) {
        for (i = 0; i < order.length && chosen.length < limit; i++) {
          c = order[i];
          if (chosen.indexOf(c) !== -1) continue;
          if (!pass && (count[c.group] || 0) >= cap) continue;
          chosen.push(c);
          count[c.group] = (count[c.group] || 0) + 1;
        }
      }
      return chosen.slice(0, limit);
    }

    /* Группа, которой в остатке больше, чем всех прочих вместе: её надо
       ставить при первой возможности, иначе в конце она останется хвостом
       подряд. */
    function crowded(remaining) {
      var count = {};
      var i;
      for (i = 0; i < remaining.length; i++) {
        var g = remaining[i].group || '';
        count[g] = (count[g] || 0) + 1;
      }
      for (var key in count) {
        if (Object.prototype.hasOwnProperty.call(count, key) && key && count[key] > remaining.length - count[key]) return key;
      }
      return null;
    }

    /* Место сезонной подборки эпохи, если она не лидер: одно из свободных
       мест SEASON_FROM…SEASON_TOP по зерну эпохи (равновероятно — сдвиг
       занятого места на следующее свободное сделал бы соседнее вдвое
       вероятнее). Свободных нет — первое свободное ниже. */
    function seasonPlace(taken, epoch) {
      var free = [];
      var p;
      for (p = SEASON_FROM; p <= SEASON_TOP; p++) if (!taken[p]) free.push(p);
      if (free.length) return free[Math.floor(rng(seedOf(epoch, SALT_SEASON))() * free.length)];
      for (p = SEASON_TOP + 1; taken[p]; p++) {}
      return p;
    }

    /* Раскладка состава по свободным местам сверху вниз: лидер — на первое,
       сезонная в свой месяц (если лидер не она) — заранее на seasonAt,
       дальше на каждое место — первая подходящая по порядку состава: не из
       группы подборки, стоящей на месте прямо над ним или прямо под ним
       (под ним стоит только сезонная); на местах 0…SEASON_TOP — ровно одна
       сезонная, остальные пропускаем; группа, которой в остатке больше,
       чем всех прочих, — вперёд. Нет подходящей — ослабляем правила по
       одному: сперва сезонное, потом группу. */
    function layout(chosen, taken, month, seasonDone, seasonAt) {
      var remaining = chosen.slice();
      var at = {};
      var out = [];
      var fixed = null;
      var i;
      if (!seasonDone && remaining.length && !inSeason(remaining[0], month)) {
        for (i = 1; i < remaining.length && !fixed; i++) {
          if (inSeason(remaining[i], month)) fixed = remaining.splice(i, 1)[0];
        }
      }
      if (fixed) at[seasonAt] = fixed;
      function groupOk(prev, c) { return !prev || !prev.group || prev.group !== c.group; }
      function pickFor(place) {
        var prev = at[place - 1] || null;
        var next = at[place + 1] || null;
        var top = place <= SEASON_TOP;
        var k;
        function fits(c) { return groupOk(prev, c) && groupOk(next, c); }
        var busy = crowded(remaining);
        if (busy && (!prev || prev.group !== busy) && (!next || next.group !== busy)) {
          for (k = 0; k < remaining.length; k++) {
            if (remaining[k].group !== busy) continue;
            if (top && inSeason(remaining[k], month)) continue;
            return k;
          }
        }
        for (k = 0; k < remaining.length; k++) {
          if (!fits(remaining[k])) continue;
          if (top && inSeason(remaining[k], month)) continue;
          return k;
        }
        for (k = 0; k < remaining.length; k++) if (fits(remaining[k])) return k;
        return 0;
      }
      for (var place = 0; remaining.length || fixed; place++) {
        if (taken[place]) continue;
        var item;
        if (fixed && place === seasonAt) {
          item = fixed;
          fixed = null;
        } else if (remaining.length) {
          item = remaining.splice(out.length ? pickFor(place) : 0, 1)[0];
        } else {
          continue;
        }
        at[place] = item;
        out.push({ place: place, kind: 'collection', id: item.id, item: item });
      }
      return out;
    }

    function byPlace(a, b) { return a.place - b.place; }

    /* План главной.
       opts: manifest — каталог (null — ещё не загружен: только личные
               ряды); picked — состав, выбранный вручную (lumen_home_rows),
               или null; month — 1…12; epoch — номер эпохи; have —
               {continue, because, new_episodes, soon}: какие личные ряды
               есть; recentLeads — лидеры двух прошлых эпох; kpKey — задан
               ли ключ Кинопоиска; limit — число подборок; mode — 'rotate'
               или 'history'; advent — есть ли ряд адвента (декабрь);
               off(id) — подборка выключена пользователем в «Каналах» Lampa.
       Возвращает {slots, lead}: слоты по возрастанию места — kind
       'collection' (id, item), 'personal' (id) или 'advent'; lead — id
       подборки-лидера (в режиме истории — null). Незанятые места между
       слотами займут ряды самой Lampa. */
    function planHome(o) {
      o = o || {};
      var have = o.have || {};
      var limit = typeof o.limit === 'number' ? o.limit : 15;
      var month = o.month || null;
      var slots = [];
      var taken = {};
      var i;
      function put(place, kind, id) {
        slots.push({ place: place, kind: kind, id: id, item: null });
        taken[place] = true;
      }

      if (o.mode === 'history') {
        for (i = 0; i < PERSONAL_ORDER.length; i++) {
          if (have[PERSONAL_ORDER[i]]) put(HISTORY_PLACES[PERSONAL_ORDER[i]], 'personal', PERSONAL_ORDER[i]);
        }
        var next = HISTORY_ROWS_FROM;
        if (o.advent) put(next++, 'advent', 'advent');
        var list = (o.manifest && LC.rows && typeof LC.rows.homeRows === 'function')
          ? LC.rows.homeRows(o.manifest, o.picked, month, limit) : [];
        for (i = 0; i < list.length; i++) {
          slots.push({ place: next++, kind: 'collection', id: list[i].id, item: list[i] });
        }
        slots.sort(byPlace);
        return { slots: slots, lead: null };
      }

      if (o.advent) put(0, 'advent', 'advent');
      for (i = 0; i < PERSONAL_ORDER.length; i++) {
        if (have[PERSONAL_ORDER[i]]) put(PLACES[PERSONAL_ORDER[i]], 'personal', PERSONAL_ORDER[i]);
      }
      taken[LAMPA_PLACE] = true;
      var chosen = choose(o, month, limit);
      /* Адвент сам сезонный ряд декабря: ещё одну сезонную наверх не ставим. */
      var cols = layout(chosen, taken, month, !!o.advent, seasonPlace(taken, o.epoch));
      slots = slots.concat(cols);
      slots.sort(byPlace);
      return { slots: slots, lead: chosen.length ? chosen[0].id : null };
    }

    /* Лидеры прошлых эпох: leads — [{n, id}] в порядке записи. Для эпохи n
       — до LEADS_AVOID последних записей с номером меньше n. */
    function recentLeads(leads, n) {
      var out = [];
      if (!Array.isArray(leads)) return out;
      for (var i = leads.length - 1; i >= 0 && out.length < LEADS_AVOID; i--) {
        var r = leads[i];
        if (r && typeof r.n === 'number' && r.n < n && r.id) out.push(r.id);
      }
      return out;
    }

    /* Новый массив лидеров: запись эпохи n заменяется, не больше
       LEADS_KEEP последних. */
    function rememberLead(leads, n, id) {
      var out = [];
      if (Array.isArray(leads)) {
        for (var i = 0; i < leads.length; i++) if (leads[i] && leads[i].n !== n) out.push(leads[i]);
      }
      out.push({ n: n, id: id });
      return out.length > LEADS_KEEP ? out.slice(out.length - LEADS_KEEP) : out;
    }

    /* ------------------------------------------------------------------ */
    /* Runtime                                                             */
    /* ------------------------------------------------------------------ */

    var EPOCH_KEY = 'lumen_home_epoch';
    var LEADS_KEY = 'lumen_home_leads';

    /* Описания, отданные в ContentRows.add последним apply(). */
    var _added = [];
    /* Последний загруженный каталог: до первого LC.manifest.load подборок
       нет — как и до волны 4 (свой каталог по адресу пользователя не
       подменяется встроенным). */
    var _manifest = null;
    /* После активации первое построение главной ещё впереди. */
    var _first = false;
    /* Идёт пересборка главной из-за настройки (LC.refreshComponent). */
    var _hold = false;

    function storage() {
      return (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') ? Lampa.Storage : null;
    }

    function read(key, def) {
      try {
        var st = storage();
        return st ? st.get(key, def) : def;
      } catch (e) {
        return def;
      }
    }

    /* Свои служебные ключи — через Lampa.Storage.set, без рассылки события
       'change': слушать их некому. */
    function write(key, value) {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') Lampa.Storage.set(key, value, true);
      } catch (e) {}
    }

    /* Выключатель ряда в «Каналах» Lampa (content_rows_<name>, её же
       фильтр в call$1, app.min.js:18088-18090) — только читаем. Выключенный
       ряд Lampa не строит, и место под него было бы пустым. */
    function rowOn(name) {
      return !!read('content_rows_' + name, 'true');
    }

    function monthNow() {
      try {
        if (LC.themes && typeof LC.themes.month === 'function') return LC.themes.month();
      } catch (e) {}
      return new Date().getMonth() + 1;
    }

    function unregister() {
      for (var i = 0; i < _added.length; i++) {
        try {
          if (window.Lampa && Lampa.ContentRows && typeof Lampa.ContentRows.remove === 'function') Lampa.ContentRows.remove(_added[i]);
        } catch (e) {}
      }
      _added = [];
    }

    function hold(on) {
      _hold = !!on;
    }

    /* План главной и регистрация её рядов.
       opts.start — активация плагина: первое построение главной впереди;
       opts.manifest — загружен каталог; opts.fresh — главная строится
       прямо сейчас (обёртка Api.main, src/44_rows.js): только здесь эпоха
       может шагнуть — при первом построении после активации и раз в
       3 часа; под hold() (пересборка из-за настройки) — лишь если это
       первое построение: главная, построенная без плагина (гонка первого
       экрана) и пересобранная с нашими рядами, — это запуск Lampa. */
    function apply(opts) {
      opts = opts || {};
      if (opts.manifest) _manifest = opts.manifest;
      if (opts.start) _first = true;
      var now = api._now();
      var stored = read(EPOCH_KEY, '');
      var epoch = stored && typeof stored === 'object' ? stored : null;
      var next;
      if (opts.fresh) {
        var first = _first;
        _first = false;
        next = (first || !_hold) ? nextEpoch(epoch, now, first) : epoch;
      } else {
        next = epoch;
      }
      if (!next) next = nextEpoch(null, now, false);
      if (next !== stored) write(EPOCH_KEY, next);
      epoch = next;

      var mode = LC.pref('lumen_home_start', 'rotate') === 'history' ? 'history' : 'rotate';
      var picked = (LC.rows && typeof LC.rows.storedIds === 'function') ? LC.rows.storedIds() : null;
      var limit = parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15;
      var anchorSeed = seedOf(epoch.n, SALT_ANCHOR);
      var own = {};
      var have = {};
      /* Выключенные в «Каналах» ряды: в план не входят, но регистрируются
         после всех его рядов (см. ниже). */
      var offRows = [];
      var i;
      try {
        var personal = (LC.personal && typeof LC.personal.describe === 'function')
          ? LC.personal.describe({ anchor: function (history) { return pickAnchor(history, ANCHOR_RECENT, anchorSeed); } })
          : [];
        for (i = 0; i < personal.length; i++) {
          if (!rowOn(personal[i].name)) { offRows.push(personal[i]); continue; }
          own[personal[i].id] = personal[i];
          have[personal[i].id] = true;
        }
      } catch (ePersonal) {}
      var advent = null;
      try {
        if (_manifest && LC.rows && typeof LC.rows.adventRow === 'function') advent = LC.rows.adventRow(_manifest);
      } catch (eAdvent) {}
      if (advent && !rowOn(advent.name)) { offRows.push(advent); advent = null; }
      var leads = read(LEADS_KEY, '[]');
      if (!Array.isArray(leads)) leads = [];

      var plan = planHome({
        manifest: _manifest,
        picked: picked,
        month: monthNow(),
        epoch: epoch.n,
        have: have,
        recentLeads: recentLeads(leads, epoch.n),
        kpKey: !!LC.pref('lumen_kp_key', ''),
        limit: limit,
        mode: mode,
        advent: !!advent,
        off: function (id) { return !rowOn('lumen_' + id); }
      });

      unregister();
      var pinned = !!(picked && picked.length);
      var named = {};
      var place = 0;
      function register(row) {
        try {
          if (window.Lampa && Lampa.ContentRows && typeof Lampa.ContentRows.add === 'function') {
            Lampa.ContentRows.add(row);
            _added.push(row);
            named[row.name] = true;
          }
        } catch (eAdd) {}
      }
      for (i = 0; i < plan.slots.length; i++) {
        var slot = plan.slots[i];
        var row = null;
        try {
          if (slot.kind === 'personal') row = own[slot.id];
          else if (slot.kind === 'advent') row = advent;
          else if (LC.rows && typeof LC.rows.describe === 'function') row = LC.rows.describe(slot.item, pinned);
        } catch (eRow) {}
        if (!row) continue;
        row.index = slot.place;
        place = slot.place + 1;
        register(row);
      }

      /* Ревью волны 4: список «Каналов» Lampa собирается только из
         зарегистрированных рядов (settings(), app.min.js:18040-18057) —
         незарегистрированный выключенный ряд оттуда пропадал, и включить
         его обратно было негде. Регистрируем его ПОСЛЕ всех рядов плана:
         call$1 отсеивает выключенный до вставки (:18088-18090), и порядок
         главной тот же. Подборки — весь каталог с выключателем в false; в
         режиме истории выключенная подборка набора уже в плане — второй
         раз не регистрируем, в «Каналах» она задвоилась бы. Включили —
         следующее построение главной (обёртка Api.main) ставит ряд на его
         место. */
      try {
        var catalog = (_manifest && Array.isArray(_manifest.collections)) ? _manifest.collections : [];
        for (i = 0; i < catalog.length; i++) {
          if (catalog[i] && catalog[i].id && !rowOn('lumen_' + catalog[i].id) && LC.rows && typeof LC.rows.describe === 'function') {
            offRows.push(LC.rows.describe(catalog[i], pinned));
          }
        }
      } catch (eOff) {}
      for (i = 0; i < offRows.length; i++) {
        if (!offRows[i] || named[offRows[i].name]) continue;
        offRows[i].index = place++;
        register(offRows[i]);
      }

      if (plan.lead) {
        var last = leads.length ? leads[leads.length - 1] : null;
        if (!last || last.n !== epoch.n || last.id !== plan.lead) write(LEADS_KEY, rememberLead(leads, epoch.n, plan.lead));
      }
      return plan;
    }

    var api = {
      rng: rng,
      seedOf: seedOf,
      nextEpoch: nextEpoch,
      pickAnchor: pickAnchor,
      planHome: planHome,
      recentLeads: recentLeads,
      rememberLead: rememberLead,
      apply: apply,
      unregister: unregister,
      hold: hold,
      /* Часы плана — подменяются в тестах и на стенде. */
      _now: function () { return Date.now(); }
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.homeplan;

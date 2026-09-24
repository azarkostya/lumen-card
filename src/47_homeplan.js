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

    /* Соли зёрен: у раскладки подборок и у «Потому что» потоки свои. */
    var SALT_ROWS = 1;
    var SALT_ANCHOR = 2;

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

    /* Сезонная подборка в свой месяц — одна, на местах 0…SEASON_TOP. */
    var SEASON_TOP = 4;

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
       сдвинутый на постоянную, — и лидер шёл бы по каталогу с постоянным
       шагом (замер на каталоге: при зерне n лидер 11 эпох из 16 — одна и
       та же «Корейские дорамы»). */
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
      /* Лидер — первый по перестановке, кого не было лидером в двух прошлых
         эпохах. Подборка Кинопоиска без ключа (бывает только в выбранном
         вручную составе) лидером не встаёт: её ряд пуст, и место 0 занял
         бы личный ряд. В декабре с адвентом лидер — не сезонная: адвент сам
         сезонный ряд наверху и собран из рождественских подборок. */
      var lead = null;
      for (i = 0; i < order.length && !lead; i++) {
        if (recent.indexOf(order[i].id) !== -1) continue;
        if (!o.kpKey && kpOnly(order[i])) continue;
        if (o.advent && inSeason(order[i], month)) continue;
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

    /* Раскладка состава по свободным местам сверху вниз: лидер — на первое,
       дальше на каждое место — первая подходящая по порядку состава:
       не из группы подборки, стоящей на месте прямо над ним; на местах
       0…SEASON_TOP — ровно одна сезонная в свой месяц (сначала ставим её,
       потом пропускаем остальные сезонные); группа, которой в остатке
       больше, чем всех прочих, — вперёд. Нет подходящей — ослабляем
       правила по одному: сперва сезонное, потом группу. */
    function layout(chosen, taken, month, seasonDone) {
      var remaining = chosen.slice();
      var at = {};
      var out = [];
      var seasonal = !!seasonDone;
      function groupOk(prev, c) { return !prev || !prev.group || prev.group !== c.group; }
      function pickFor(place) {
        var prev = at[place - 1] || null;
        var top = place <= SEASON_TOP;
        var i;
        if (top && !seasonal) {
          for (i = 0; i < remaining.length; i++) if (inSeason(remaining[i], month) && groupOk(prev, remaining[i])) return i;
        }
        var busy = crowded(remaining);
        if (busy && (!prev || prev.group !== busy)) {
          for (i = 0; i < remaining.length; i++) {
            if (remaining[i].group !== busy) continue;
            if (top && seasonal && inSeason(remaining[i], month)) continue;
            return i;
          }
        }
        for (i = 0; i < remaining.length; i++) {
          if (!groupOk(prev, remaining[i])) continue;
          if (top && seasonal && inSeason(remaining[i], month)) continue;
          return i;
        }
        for (i = 0; i < remaining.length; i++) if (groupOk(prev, remaining[i])) return i;
        return 0;
      }
      for (var place = 0; remaining.length; place++) {
        if (taken[place]) continue;
        var idx = out.length ? pickFor(place) : 0;
        var item = remaining.splice(idx, 1)[0];
        at[place] = item;
        if (place <= SEASON_TOP && inSeason(item, month)) seasonal = true;
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
      var cols = layout(chosen, taken, month, !!o.advent);
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

    return {
      rng: rng,
      seedOf: seedOf,
      nextEpoch: nextEpoch,
      pickAnchor: pickAnchor,
      planHome: planHome,
      recentLeads: recentLeads,
      rememberLead: rememberLead,
      ANCHOR_RECENT: ANCHOR_RECENT,
      SALT_ANCHOR: SALT_ANCHOR
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.homeplan;

  /* -------------------------------------------------------------------- */
  /* 1.2: LC.kids — детский режим (пункт «Детский режим», lumen_kids).     */
  /*                                                                       */
  /* Решения пользователя (план 1.2, 29.09): мультфильмы и семейное до PG  */
  /* плюс семейные блокбастеры — «Гарри Поттер», «Звёздные войны», Marvel   */
  /* («Мстители», «Человек-паук»); DC не входит. Это НЕ родительский        */
  /* контроль: без PIN, штатные поиск, меню и карточка Lampa показывают     */
  /* всё — так и сказано в описании пункта.                                */
  /*                                                                       */
  /* Две точки фильтрации, обе без запросов:                               */
  /*   каталог — LC.manifest.get()/load() в детском режиме отдают           */
  /*     catalog(m): только подборки и настроения с тегом kids: true;       */
  /*     из него разом берут план главной, хаб, рулетка и поиск подборок;   */
  /*   карточки — ответы TMDB фильтруются по жанрам (разбор у safe и        */
  /*     strict ниже): ряды главной (rows), сетка хаба и пул рулетки        */
  /*     (response).                                                        */
  /*                                                                       */
  /* Публичное API (чистые функции, кроме enabled):                         */
  /*   genresOf(card) → [id] — genre_ids или genres[].id (детали tv/{id})   */
  /*   safe(card) / strict(card) → bool — проходит ли карточка              */
  /*   trusted(item) → bool — подборка с тегом kids (ей хватает safe)       */
  /*   cards(list, trusted) → новый массив                                 */
  /*   response(json, item) → копия ответа с отфильтрованными results       */
  /*   rows(rows) → ряды главной без чужих карточек (до дедупликации)      */
  /*   stubs(rows, min, keep) → без огрызков чужих рядов (после неё)       */
  /*   catalog(m) → детская копия каталога (мемоизация по объекту)          */
  /*   enabled() → включён ли режим; reset() — сброс мемоизации            */
  /* -------------------------------------------------------------------- */

  LC.kids = (function () {

    /* Жанры TMDB, которых в детском режиме нет ни у одной карточки:
       ужасы (27), триллер (53), война у фильмов (10752) и у сериалов
       (10768, «Война и политика»). */
    var STOP = { 27: 1, 53: 1, 10752: 1, 10768: 1 };
    /* Криминал (80) — стоп, если у карточки нет семейного жанра. Живая
       проверка 2026-09-30 (scratchpad r5/kids/probe.mjs): TMDB ставит 80
       «Гадкому я», «Миньонам: Грювитации» и «Плохим парням» (все PG,
       все с 10751) — сплошной стоп выбил бы их из «Гадкого я»,
       Illumination и DreamWorks. «Люпен III» у Миядзаки (16, 35, 80 без
       10751) и «Сорвиголова» уходят. */
    var CRIME = 80;
    /* Семейный (10751) и детский ТВ (10762). Анимация (16) сама по себе
       не детская: 16 и 35 — это и «Южный парк», и «Гриффины», и
       «Сосисочная вечеринка», 16 с 10759 — взрослое аниме. */
    var FAMILY = { 10751: 1, 10762: 1 };

    function genresOf(card) {
      var out = [];
      if (!card) return out;
      var i;
      if (Array.isArray(card.genre_ids)) {
        for (i = 0; i < card.genre_ids.length; i++) out.push(Number(card.genre_ids[i]));
        return out;
      }
      if (Array.isArray(card.genres)) {
        for (i = 0; i < card.genres.length; i++) {
          var g = card.genres[i];
          if (g && g.id !== undefined) out.push(Number(g.id));
        }
      }
      return out;
    }

    function hasFamily(genres) {
      for (var i = 0; i < genres.length; i++) if (FAMILY[genres[i]]) return true;
      return false;
    }

    /* Карточка без стоп-жанров. Хватает её подборкам с тегом kids: их
       состав проверен вручную и живым запросом (у «Гарри Поттера»,
       «Звёздных войн» и Marvel жанры 12/14/28/878 — ни семейного, ни
       анимации), фильтр лишь страхует от новинок. */
    function safe(card) {
      if (!card || typeof card !== 'object' || card.adult) return false;
      var genres = genresOf(card);
      var family = hasFamily(genres);
      for (var i = 0; i < genres.length; i++) {
        if (STOP[genres[i]]) return false;
        if (genres[i] === CRIME && !family) return false;
      }
      return true;
    }

    /* Карточка из чужого ряда — штатные ряды Lampa, личные ряды, франшиза
       из карточки, «похожее» в рулетке: без стоп-жанров И с семейным или
       детским жанром. Карточка без жанров не проходит. */
    function strict(card) {
      return safe(card) && hasFamily(genresOf(card));
    }

    function trusted(item) {
      return !!(item && item.kids === true);
    }

    function cards(list, trust) {
      var out = [];
      if (!Array.isArray(list)) return out;
      var test = trust ? safe : strict;
      for (var i = 0; i < list.length; i++) if (test(list[i])) out.push(list[i]);
      return out;
    }

    function copy(obj) {
      var out = {};
      for (var k in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
      }
      return out;
    }

    /* Ответ подборки (сетка хаба, пул рулетки): копия, а не правка на
       месте — один ответ LC.sources.fetch раздаётся всем подписчикам
       одинакового запроса. */
    function response(json, item) {
      if (!json || !Array.isArray(json.results)) return json;
      var out = copy(json);
      out.results = cards(json.results, trusted(item));
      return out;
    }

    /* Ряды главной одной пачки (обёртка Api.main, src/44_rows.js) — до
       дедупликации. Ряд подборки каталога приходит уже отфильтрованным
       (lumen_kids, makeCall) и не трогается. Остальные — strict; ряд без
       карточек уходит. Входные ряды не меняются. */
    function rows(list) {
      var out = [];
      if (!Array.isArray(list)) return out;
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        if (!row || !Array.isArray(row.results) || row.lumen_kids) { out.push(row); continue; }
        var kept = cards(row.results, false);
        if (!kept.length) continue;
        var next = copy(row);
        next.results = kept;
        out.push(next);
      }
      return out;
    }

    /* Огрызки — ПОСЛЕ дедупликации: чужой ряд (штатный Lampa: не подборка
       каталога, не личный, не выбранный вручную) короче min уходит, как бы
       он таким ни стал. Стенд 2026-09-30: жанровые ряды Lampa в глубине
       главной («Мультфильм», «Семейный», «Космос») после фильтра и окна
       дедупликации оставались с одной карточкой, а порог dedupeAcross их
       возвращал — вся пачка из огрызков отдаётся им как есть (пустая
       главная хуже). Здесь пустая пачка допустима: Lampa просто не
       дописывает ленту. Кроме первой (keep): по пустой первой пачке Lampa
       строит пустой экран и больше ничего не спрашивает, — тогда пачка
       возвращается как пришла. */
    function stubs(list, min, keep) {
      if (!Array.isArray(list)) return [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var row = list[i];
        if (!row || !Array.isArray(row.results)) continue;
        if (!row.lumen_kids && !row.lumen_personal && !row.lumen_keep && row.results.length < (min || 0)) continue;
        out.push(row);
      }
      return (!out.length && keep) ? list : out;
    }

    /* Детская копия каталога: подборки и настроения с тегом kids, home —
       пересечение, ambient пуст. Группы, чипы хаба и темы — как есть
       (пустой чип хаб не показывает сам). Исходный объект не меняется.
       Мемоизация на два каталога (загруженный и встроенный — запасной,
       см. LC.manifest): get() зовут на каждом открытии хаба и поиске. */
    var memo = [];

    function build(m) {
      var out = copy(m);
      var ids = {};
      var list = Array.isArray(m.collections) ? m.collections : [];
      var i;
      out.collections = [];
      for (i = 0; i < list.length; i++) {
        if (trusted(list[i])) { out.collections.push(list[i]); ids[list[i].id] = 1; }
      }
      if (Array.isArray(m.moods)) {
        out.moods = [];
        for (i = 0; i < m.moods.length; i++) if (trusted(m.moods[i])) out.moods.push(m.moods[i]);
      }
      out.home = [];
      var home = Array.isArray(m.home) ? m.home : [];
      for (i = 0; i < home.length; i++) if (ids[home[i]]) out.home.push(home[i]);
      out.ambient = [];
      return out;
    }

    function catalog(m) {
      if (!m || typeof m !== 'object') return m;
      for (var i = 0; i < memo.length; i++) if (memo[i].src === m) return memo[i].out;
      var out = build(m);
      memo.unshift({ src: m, out: out });
      if (memo.length > 2) memo.length = 2;
      return out;
    }

    function reset() {
      memo = [];
    }

    function enabled() {
      try { return typeof LC.pref === 'function' && LC.pref('lumen_kids', false) === true; } catch (e) { return false; }
    }

    return {
      genresOf: genresOf,
      safe: safe,
      strict: strict,
      trusted: trusted,
      cards: cards,
      response: response,
      rows: rows,
      stubs: stubs,
      catalog: catalog,
      enabled: enabled,
      reset: reset
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.kids;

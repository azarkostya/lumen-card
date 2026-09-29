  /* -------------------------------------------------------------------- */
  /* LC.sources — преобразование описания подборки в запросы TMDB          */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   buildRequest(spec, media, page) → {url, params, life}               */
  /*   normalize(type, json) → {results, title, page, total_results, ...}  */
  /*   discoverUrl(spec, media) → строка для category_full                  */
  /*   mergeMedia(movies, tv) → [card, ...]                                 */
  /*   isSet / setRequests / partOf / setParts — коллекция с also/movies    */
  /*   personIds / personRequests / mergeCredits — person с also (люди)     */
  /*   fetchOne(spec, media, page, ok, err, alive) — runtime, требует Lampa */
  /*   fetch(item, page, ok, err, alive) → {clear} — runtime, требует Lampa */
  /*                                                                        */
  /* Сетевые запросы — только через Lampa.Api.sources.tmdb.get; кэш —      */
  /* штатный кэш запросов Lampa ({life}). Подборки Кинопоиска (тип kp)     */
  /* сняты после 1.0.2 (LC.manifest.validate, RETIRED): источник, которого */
  /* здесь не знают, отвечает ошибкой, а не запросом (fetchOne).            */
  /* -------------------------------------------------------------------- */

  LC.sources = (function () {

    /* Параметры discover → query-ключи TMDB. Проверено: genres=with_genres,
       keywords=with_keywords, networks=with_networks, companies=with_companies,
       watch_providers=with_watch_providers в Lampa 3.3.4 (API_NOTES_4.md).
       orig_lang=with_original_language — Lampa прокидывает как есть.
       Ключи filter{} передаются напрямую (vote_count.gte, with_people и т.п.). */
    var MAP = {
      genres: 'with_genres',
      keywords: 'with_keywords',
      companies: 'with_companies',
      networks: 'with_networks',
      watch_providers: 'with_watch_providers',
      watch_region: 'watch_region',
      sort_by: 'sort_by',
      orig_lang: 'with_original_language'
    };

    /* Время жизни кэша:
       discover — 12 ч (популярность меняется; 720 мин)
       collection/list — 1 неделя (статичные данные; 10080 мин) */
    var LIFE_DISCOVER = 720;
    var LIFE_STATIC = 10080;

    /* Глобальный дедлайн fetchAll: 15 сек, после — частичный результат. */
    var FETCH_TIMEOUT = 15000;

    /* ------------------------------------------------------------------ */
    /* Не-фильмы в подборках (находка 2026-09-23).                          */
    /*                                                                     */
    /* На скриншоте пользователя в ряду «Звёздные войны» стоял «The Escape  */
    /* Pod Podcast» — подкаст, заведённый на TMDB как сериал. Попал он из   */
    /* сериальной половины подборки: discover/tv по ключевому слову «star   */
    /* wars» (379196) отдаёт ровно два сериала, и второй из них — он.       */
    /*                                                                     */
    /* Признак — жанр 10767 «Talk» (ток-шоу): у подкаста жанры 35,10767.    */
    /* У фильмов этого жанра не бывает вовсе — он есть только в списке      */
    /* жанров TV. Соседние признаки отделяют хуже и не взяты: «News»        */
    /* (10763) стоит и у документального сериала (Vetenskapens värld,       */
    /* 99,10763), video:true у фильмов в выборке не встретился ни разу, а   */
    /* пустой vote_count бывает и у ещё не вышедших сериалов.               */
    /*                                                                     */
    /* Ф3 п.5 (ревью фикс-раундов): 10767 стоит и у реалити, которые        */
    /* смотрят как сериалы, — вместе с «Reality» (10764): Top Gear          */
    /* (10764,10767), The Grand Tour (10764,35,10767), Single's Inferno     */
    /* (10764,35,10767). Прежний запрет without_genres=10767 на стороне     */
    /* TMDB выкидывал и их, а выразить «10767, но не вместе с 10764» TMDB   */
    /* не умеет. Поэтому отсекаем в ответе: talkOnly — 10767 без 10764.     */
    /* Проверено живыми запросами 2026-09-23 (прокси Lampa, ru-RU): первые  */
    /* страницы всех 118 discover-источников манифеста без запрета — 2285   */
    /* карточек, жанр 10767 у 27 (у фильмов — ни у одной). 25 из них —      */
    /* ток-шоу, вечерние шоу, церемонии («Шоу Грэма Нортона», Skavlan,      */
    /* «Церемония вручения премии «Тони»»…), и все 25 — без 10764: правило  */
    /* их отсекает, как прежнее. Остаются две карточки 10767+10764:         */
    /* Melodifestivalen (песенный конкурс, как Idol) и Spårtsklubben        */
    /* (комедийное реалити). Подкаст The Escape Pod Podcast (tv/328941) —   */
    /* 35,10767, отсекается.                                                */
    /*                                                                     */
    /* Цена переноса в ответ — страница, у которой отсечено, короче на      */
    /* столько карточек (в выборке — 27 из 2285, 1.2 %). Полный список      */
    /* подборки в штатной сетке Lampa (discoverUrl → category_full)         */
    /* фильтровать нечем — там запрет остаётся на стороне TMDB, прежний:    */
    /* из 14 подборок, которые туда открываются (только discover/tv), на    */
    /* первых страницах 15 ток-шоу против двух реалити 10767+10764.         */
    /* ------------------------------------------------------------------ */

    var TV_WITHOUT = '10767';
    var GENRE_TALK = 10767;
    var GENRE_REALITY = 10764;

    /* filter{} источника с добавленным запретом для TV — только для
       category_full (discoverUrl); входной объект не меняется (он из
       манифеста). Свой without_genres у источника сохраняется — список
       через запятую TMDB читает как «ни одного из». */
    function tvFilter(filter) {
      var out = {};
      var k;
      for (k in filter) {
        if (filter.hasOwnProperty(k)) out[k] = filter[k];
      }
      var own = out.without_genres ? String(out.without_genres) : '';
      if ((',' + own + ',').indexOf(',' + TV_WITHOUT + ',') === -1) out.without_genres = own ? own + ',' + TV_WITHOUT : TV_WITHOUT;
      return out;
    }

    /* Ток-шоу или подкаст: жанр 10767 без 10764 (разбор выше). */
    function talkOnly(card) {
      var g = (card && card.genre_ids) || [];
      var talk = false;
      for (var i = 0; i < g.length; i++) {
        if (Number(g[i]) === GENRE_REALITY) return false;
        if (Number(g[i]) === GENRE_TALK) talk = true;
      }
      return talk;
    }

    /* Нормализованный ответ discover/tv без ток-шоу и подкастов. Ответ
       меняется на месте: normalize уже отдал свою копию массива. */
    function dropTalk(data) {
      var kept = [];
      for (var i = 0; i < data.results.length; i++) {
        if (!talkOnly(data.results[i])) kept.push(data.results[i]);
      }
      data.results = kept;
      return data;
    }

    /* Полное ревью, S3: параметры подборки уходят в адрес запроса, а
       каталог может быть внешним. Lampa (url$1, app.min.js) склеивает
       значения известных ключей и весь filter сырыми, discoverUrl отправлял
       и неизвестные ключи. Поэтому в запрос идут только ключи MAP, ключи
       filter вида with_runtime.lte и значения — числа или строки из
       [\w.,|:-] (формат каталога, тот же, что проверяет LC.manifest.
       validate). */
    var FILTER_KEY = /^[a-z_]{1,48}(\.(gte|lte))?$/;
    var SAFE_VALUE = /^[\w.,|:-]{1,256}$/;

    function safeValue(v) {
      if (typeof v === 'number') return isFinite(v);
      if (typeof v === 'boolean') return true;
      return typeof v === 'string' && SAFE_VALUE.test(v);
    }

    /* filter{} только из допустимых ключей и значений (копия). */
    function cleanFilter(f) {
      var out = {};
      if (!f || typeof f !== 'object') return out;
      for (var k in f) {
        if (f.hasOwnProperty(k) && FILTER_KEY.test(k) && safeValue(f[k])) out[k] = f[k];
      }
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Фильмография человека (тип person, раунд r4 2026-09-29).            */
    /*                                                                     */
    /* Режиссёры в каталоге были discover с with_crew — это ЛЮБАЯ роль в   */
    /* съёмочной группе: продюсер, сценарист, даже «Thanks» в титрах. У    */
    /* Уэса Андерсона четвёртым шёл «Трудности перевода» Копполы, у        */
    /* Спилберга — «Назад в будущее» и «Шрек» (живые запросы, разбор у     */
    /* группы people в src/42_manifest.js). Отсечь «не режиссёр» discover  */
    /* не умеет, поэтому источник person — один запрос                     */
    /* person/{id}/movie_credits (tv_credits у сериального источника), из  */
    /* crew — только записи с нужной должностью (job, по умолчанию         */
    /* Director). Одна «страница» — вся фильмография, как у коллекции:     */
    /* порядок в сетке задаёт сортировка на месте (LC.hub.needsLocalSort), */
    /* а ряд, плитка и рулетка получают список по популярности.            */
    /* Без записей adult и без постера: у фильмографии это короткий метр, */
    /* ролики и анонсы без картинки — в ряду они встали бы пустыми         */
    /* плитками. Язык — как у всех запросов: его дописывает Lampa.          */
    /* ------------------------------------------------------------------ */
    var PERSON_JOB = 'Director';

    function personJob(job) {
      return typeof job === 'string' && job ? job : PERSON_JOB;
    }

    /* Карточка из записи crew: те же поля, что у карточки discover, без
       полей роли (credit_id, department, job) — они в DOM и в кэш рядов не
       нужны. */
    function creditCard(c) {
      var out = {};
      for (var k in c) {
        if (c.hasOwnProperty(k) && k !== 'credit_id' && k !== 'department' && k !== 'job') out[k] = c[k];
      }
      return out;
    }

    /* Работы человека в должности job: без повторов (id), без adult и без
       постера, по популярности (при равной — порядок ответа). */
    function credits(json, job) {
      var want = personJob(job);
      var list = (json && json.crew) || [];
      var out = [];
      var seen = {};
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c || !c.id || c.job !== want || c.adult || !c.poster_path || seen[c.id]) continue;
        seen[c.id] = 1;
        out.push({ card: creditCard(c), at: out.length });
      }
      out.sort(function (a, b) {
        var d = (Number(b.card.popularity) || 0) - (Number(a.card.popularity) || 0);
        return d || a.at - b.at;
      });
      for (var j = 0; j < out.length; j++) out[j] = out[j].card;
      return out;
    }

    /* Строит параметры запроса к Lampa.Api.sources.tmdb.get.
       Для collection/list/person — фиксированный URL без page (TMDB отдаёт всё сразу).
       Для discover — page обязателен. */
    function buildRequest(spec, media, page) {
      if (spec.type === 'collection') {
        return { url: 'collection/' + encodeURIComponent(spec.id), params: {}, life: LIFE_STATIC };
      }
      if (spec.type === 'person') {
        return { url: 'person/' + encodeURIComponent(spec.id) + '/' + (media === 'tv' ? 'tv' : 'movie') + '_credits', params: {}, life: LIFE_STATIC };
      }
      if (spec.type === 'list') {
        return { url: 'list/' + encodeURIComponent(spec.id), params: {}, life: LIFE_STATIC };
      }
      var params = {};
      var src = spec.params || {};
      var k;
      for (k in src) {
        if (!src.hasOwnProperty(k)) continue;
        if (k === 'filter') params.filter = cleanFilter(src.filter);
        else if (MAP.hasOwnProperty(k) && safeValue(src[k])) params[k] = src[k];
      }
      params.page = page || 1;
      return { url: 'discover/' + media, params: params, life: LIFE_DISCOVER };
    }

    /* Нормализует ответ TMDB к единому виду {results, title, page, total_*}.
       collection → parts[], сортировка по release_date ASC (хронологический порядок).
       list → items[].
       person → crew[] в должности job (credits выше), по популярности.
       discover → results[] (уже в нужном виде).
       Мутирует копию массива, а не оригинал (slice()). */
    function normalize(type, json, job) {
      json = json || {};
      var results;
      if (type === 'collection') {
        results = (json.parts || []).slice();
        results.sort(function (a, b) {
          var da = String(a.release_date || '9999');
          var db = String(b.release_date || '9999');
          if (da < db) return -1;
          if (da > db) return 1;
          return 0;
        });
      } else if (type === 'list') {
        results = (json.items || []).slice();
      } else if (type === 'person') {
        results = credits(json, job);
      } else {
        results = (json.results || []).slice();
      }
      var out = {
        results: results,
        title: json.title || json.name || '',
        page: json.page || 1
      };
      out.total_results = json.total_results || results.length;
      out.total_pages = json.total_pages || 1;
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Франшиза из нескольких коллекций TMDB и отдельных фильмов.          */
    /*                                                                     */
    /* Жалоба 2026-09-27: «в ЧП добавь старые фильмы про него, как и в      */
    /* Бэтмена и прочее, например старый Марвел до КВМ». Одна коллекция     */
    /* TMDB — это одна эпоха: «Человек-паук» Рэйми (556), Уэбба (125574),   */
    /* КВМ (531241) и «Через вселенные» (573436) — четыре разные коллекции, */
    /* а ключевых слов персонажа («spider-man», «batman») у фильмов TMDB    */
    /* больше нет (у 557, 1930, 315635, 268, 414906 их нет — проверено      */
    /* живыми запросами), то есть discover по слову их не соберёт. Часть    */
    /* фильмов не входит ни в одну коллекцию вовсе: «Дюна» Линча (841),     */
    /* «Матрица: Воскрешение» (624860), «Бамблби» (424783), «Бэтмен» 1966   */
    /* (2661).                                                              */
    /*                                                                     */
    /* Поэтому у источника collection два необязательных поля: also —       */
    /* ещё коллекции, movies — отдельные фильмы (id TMDB). Базовая id       */
    /* остаётся прежней: плагин без этой правки их не знает, проверку       */
    /* каталога проходит и показывает, как раньше, одну базовую коллекцию.  */
    /* Запросы — по одному на коллекцию и на фильм, параллельно, с кэшем    */
    /* коллекции (неделя); части склеиваются без повторов и сортируются по  */
    /* дате выхода, как одна коллекция (normalize).                         */
    /* ------------------------------------------------------------------ */

    var NUM_ID = /^\d{1,12}$/;
    /* Предел на каждое поле — столько же, сколько пропускает проверка
       каталога (LC.manifest.validate): лишнее не запрашивается, даже если
       каталог пришёл без проверки. */
    var SET_MAX = 24;
    /* SEC4-2: запросов на источник-набор всего (базовая коллекция + also +
       movies, без повторов) — тот же SET_TOTAL, что в проверке каталога.
       Без него удалённый каталог с also и movies по 24 у movie и у tv
       давал 98 запросов на одну плитку и ещё 98 на «Английские постеры». */
    var SET_TOTAL = 20;
    /* И не больше SET_PARALLEL запросов набора одновременно. */
    var SET_PARALLEL = 4;
    /* Свой дедлайн — короче общего (FETCH_TIMEOUT): то, что пришло,
       успевает уйти подборке раньше, чем её сборщик закроется пустым. */
    var SET_TIMEOUT = 12000;

    /* Повторы — один раз и в предел поля не идут. */
    function idList(v) {
      var out = [];
      var seen = {};
      if (!Array.isArray(v)) return out;
      for (var i = 0; i < v.length && out.length < SET_MAX; i++) {
        var id = String(v[i]);
        if (NUM_ID.test(id) && !seen[id]) { seen[id] = 1; out.push(id); }
      }
      return out;
    }

    /* Источник-коллекция с добавками (also/movies)? */
    function isSet(spec) {
      return !!(spec && spec.type === 'collection' && (idList(spec.also).length || idList(spec.movies).length));
    }

    /* Все запросы источника-набора: базовая коллекция, добавочные, фильмы;
       повторы — один раз, всего не больше SET_TOTAL. */
    function setRequests(spec) {
      var out = [];
      var seen = {};
      function add(url, kind) {
        if (seen[url] || out.length >= SET_TOTAL) return;
        seen[url] = 1;
        out.push({ url: url, params: {}, life: LIFE_STATIC, kind: kind });
      }
      add('collection/' + encodeURIComponent(spec.id), 'collection');
      var also = idList(spec.also);
      var movies = idList(spec.movies);
      var i;
      for (i = 0; i < also.length; i++) add('collection/' + also[i], 'collection');
      for (i = 0; i < movies.length; i++) add('movie/' + movies[i], 'movie');
      return out;
    }

    /* Ответ movie/{id} → запись того же вида, что part коллекции TMDB
       (genres → genre_ids). Лишние поля деталей (бюджет, студии, …) в
       карточку не идут: она живёт в DOM и в кэше рядов. */
    function partOf(m) {
      if (!m || !m.id) return null;
      var g = [];
      var list = m.genres || [];
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id) g.push(list[i].id);
      }
      return {
        adult: !!m.adult,
        backdrop_path: m.backdrop_path || null,
        id: m.id,
        title: m.title || '',
        original_title: m.original_title || '',
        original_language: m.original_language || '',
        overview: m.overview || '',
        poster_path: m.poster_path || null,
        media_type: 'movie',
        genre_ids: g,
        popularity: m.popularity || 0,
        release_date: m.release_date || '',
        video: !!m.video,
        vote_average: m.vote_average || 0,
        vote_count: m.vote_count || 0
      };
    }

    /* Карточки ответов набора (по порядку запросов, пропуски — мимо). */
    function setParts(reqs, answers) {
      var parts = [];
      var seen = {};
      for (var i = 0; i < reqs.length; i++) {
        var json = answers[i];
        if (!json) continue;
        var list = reqs[i].kind === 'movie' ? [partOf(json)] : (json.parts || []);
        for (var k = 0; k < list.length; k++) {
          var p = list[k];
          if (!p || !p.id || seen[p.id]) continue;
          seen[p.id] = 1;
          parts.push(p);
        }
      }
      return parts;
    }

    /* ------------------------------------------------------------------ */
    /* Подборка из нескольких людей (person + also, план 1.2, фича 4).     */
    /*                                                                     */
    /* «Братья Коэн» — фильмография Джоэла (1223): у TMDB он режиссёр всех */
    /* общих фильмов, но сольные работы Итана (1224) — «Красотки в бегах»  */
    /* (957304), «Хани, не надо!» (1149504) — есть только у Итана. Поэтому */
    /* у person, как у collection, необязательное also — ещё люди: по      */
    /* запросу фильмографии на человека, параллельно, кэш неделя; работы   */
    /* в должности job склеиваются без повторов (первым — базовый          */
    /* человек) и идут по популярности, как у одного человека (credits).   */
    /* Базовая id прежняя: 1.1.0 поле also не смотрит (personOk в          */
    /* src/42_manifest.js), каталог принимает и показывает базового        */
    /* человека. Людей в also — не больше PERSON_ALSO_MAX (столько же      */
    /* пропускает проверка каталога): каталог без проверки не устроит      */
    /* десятки запросов на плитку.                                         */
    /* ------------------------------------------------------------------ */
    var PERSON_ALSO_MAX = 3;
    var PERSON_ID = /^[1-9]\d{0,11}$/;

    /* Базовый человек и also: без повторов и мусора, also — не больше
       PERSON_ALSO_MAX. Базовый id не проверяется: его берёт buildRequest
       и для одиночного источника. */
    function personIds(spec) {
      var out = [String(spec && spec.id)];
      var seen = {};
      seen[out[0]] = 1;
      var v = spec && spec.also;
      if (!Array.isArray(v)) return out;
      for (var i = 0; i < v.length && out.length <= PERSON_ALSO_MAX; i++) {
        var id = String(v[i]);
        if (PERSON_ID.test(id) && !seen[id]) { seen[id] = 1; out.push(id); }
      }
      return out;
    }

    /* Источник-человек с добавками (also)? */
    function isPersonSet(spec) {
      return !!(spec && spec.type === 'person' && personIds(spec).length > 1);
    }

    /* Запросы набора людей: по фильмографии на человека. */
    function personRequests(spec, media) {
      var ids = personIds(spec);
      var out = [];
      for (var i = 0; i < ids.length; i++) {
        out.push({
          url: 'person/' + encodeURIComponent(ids[i]) + '/' + (media === 'tv' ? 'tv' : 'movie') + '_credits',
          params: {},
          life: LIFE_STATIC,
          kind: 'person',
          job: spec.job
        });
      }
      return out;
    }

    /* Ответы набора людей (по порядку запросов, пропуски — мимо) → ответ
       вида normalize('person'): одна фильмография из всех crew. */
    function mergeCredits(answers, job) {
      var crew = [];
      for (var i = 0; i < (answers || []).length; i++) {
        var list = answers[i] && answers[i].crew;
        if (Array.isArray(list)) crew = crew.concat(list);
      }
      return normalize('person', { crew: crew }, job);
    }

    /* Набор целиком: ok(build(answers)) — если пришёл хоть один ответ;
       err — если не пришло ничего. Запросы — не больше SET_PARALLEL
       одновременно: следующий уходит, когда ответил (или упал) один из
       летящих; подборку закрыли — новые не уходят. Общий для коллекций с
       also/movies и для людей с also. */
    function fetchSet(reqs, build, ok, err, alive) {
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }
      var answers = [];
      var got = 0;
      var next = 0;
      var flying = 0;
      var gate = LC.util.gate(reqs.length, SET_TIMEOUT, function () {
        if (dead()) return;
        if (!got) { err({ set_failed: true }); return; }
        ok(build(answers));
      });
      function send(i) {
        var r = reqs[i];
        var over = false;
        function end() {
          if (over) return;
          over = true;
          flying--;
          gate.tick();
          pump();
        }
        flying++;
        Lampa.Api.sources.tmdb.get(
          r.url,
          r.params,
          function (json) {
            if (json && !dead()) { answers[i] = json; got++; }
            end();
          },
          end,
          { life: r.life }
        );
      }
      function pump() {
        if (dead()) { gate.cancel(); return; }
        while (flying < SET_PARALLEL && next < reqs.length) send(next++);
      }
      pump();
    }

    /* Строит URL для Lampa.Activity.push({component:'category_full', url:…}).
       Раскрывает filter{} как плоские параметры query.
       encodeURIComponent: числа и типичные строки (popularity.desc, KR) не меняются. */
    function discoverUrl(spec, media) {
      var q = [];
      var p = spec.params || {};
      var k;
      for (k in p) {
        /* Только известные ключи (S3): прочие ушли бы в адрес как есть. */
        if (p.hasOwnProperty(k) && k !== 'filter' && MAP.hasOwnProperty(k)) {
          q.push(MAP[k] + '=' + encodeURIComponent(p[k]));
        }
      }
      var own = cleanFilter(p.filter);
      var f = media === 'tv' ? tvFilter(own) : own;
      for (k in f) {
        if (f.hasOwnProperty(k)) {
          q.push(k + '=' + encodeURIComponent(f[k]));
        }
      }
      return 'discover/' + media + (q.length ? '?' + q.join('&') : '');
    }

    /* Чередует карточки из двух медиа-списков.
       Ключ дедупликации — media + ':' + id (не bare id):
       фильм и сериал с одинаковым TMDB id — разные объекты, оба попадают.
       Дубли внутри одного массива (movie:X повторяется дважды) убираются. */
    function mergeMedia(movies, tv) {
      var out = [];
      var seen = {};
      var a = movies || [];
      var b = tv || [];
      var len = Math.max(a.length, b.length);
      var i, km, kt;
      for (i = 0; i < len; i++) {
        if (a[i]) {
          km = 'movie:' + a[i].id;
          if (!seen[km]) { seen[km] = 1; out.push(a[i]); }
        }
        if (b[i]) {
          kt = 'tv:' + b[i].id;
          if (!seen[kt]) { seen[kt] = 1; out.push(b[i]); }
        }
      }
      return out;
    }

    /* Типы источников, которые здесь умеют запрашивать. */
    var KNOWN = { discover: 1, collection: 1, list: 1, person: 1 };

    function known(spec) {
      return !!(spec && KNOWN.hasOwnProperty(spec.type));
    }

    /* Один источник одного медиа. Возвращать нечего: Lampa.Api.sources.
       tmdb.get ничего не возвращает (get$c, vendor/lampa/app.min.js:
       19693-19737), и запрос не отменяется — поздний ответ отсекает сторож
       dead() по alive (fetchAll отдаёт сюда requestAlive, который гаснет с
       последним подписчиком).
       Тип, которого здесь не знают, — ошибка без запроса. Прежде всё, что не
       collection и не list, уходило в discover/{media} без параметров: Lampa
       восстанавливает сетку открытой подборки после перезапуска, и сетка
       снятой подборки Кинопоиска (тип kp, после 1.0.2) показала бы
       случайное «популярное» под её названием. */
    function fetchOne(spec, media, page, ok, err, alive) {
      if (!known(spec)) { err({ unknown_type: true }); return null; }
      if (isSet(spec)) {
        var reqs = setRequests(spec);
        fetchSet(reqs, function (answers) {
          return normalize('collection', { parts: setParts(reqs, answers) });
        }, ok, err, alive);
        return null;
      }
      if (isPersonSet(spec)) {
        fetchSet(personRequests(spec, media), function (answers) {
          return mergeCredits(answers, spec.job);
        }, ok, err, alive);
        return null;
      }
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }
      var r = buildRequest(spec, media, page);
      Lampa.Api.sources.tmdb.get(
        r.url,
        r.params,
        function (json) {
          if (dead()) return;
          var data = normalize(spec.type, json, spec.job);
          /* Ток-шоу и подкасты — только в discover/tv: коллекции и списки
             TMDB — ручной отбор, у фильмов жанра Talk нет (разбор у
             talkOnly выше). */
          ok(spec.type === 'discover' && media === 'tv' ? dropTalk(data) : data);
        },
        function (e) { if (!dead()) err(e); },
        { life: r.life }
      );
      return null;
    }

    /* Подпись сортировки подборки — часть ключа дедупликации (ревью Task 17,
       I5). LC.hub.applySort копирует подборку вместе с id, меняя только
       sort_by, поэтому без подписи запрос «та же подборка, другая сортировка»
       подписывался бы на уже летящий с прежним порядком и получал бы чужой
       ответ: сетка показывала порядок манифеста, а подпись — выбранный
       пользователем. Считается только по discover-источникам: у collection,
       list и person порядок задаёт не запрос, а сортировка на месте. */
    function sortSignature(item) {
      var src = (item && item.sources) || {};
      var parts = [];
      var k;
      for (k in src) {
        if (!src.hasOwnProperty(k) || !src[k]) continue;
        if (src[k].type !== 'discover') continue;
        parts.push(k + '=' + ((src[k].params && src[k].params.sort_by) || ''));
      }
      parts.sort();
      return parts.join(',');
    }

    /* Карта in-flight запросов для дедупликации (I4).
       Один и тот же ключ (id:page) не грузится параллельно дважды.
       Структура: { subs: {id: {ok,err,alive,gen}}, _cancel: fn|null }
       Второй и последующие вызовы регистрируются как подписчики первого запроса;
       каждый получает рабочий clear() (снимает только свою подписку, не гасит запрос);
       когда отменились все подписчики — запрос гасится. */
    var inflight = {};

    /* Сквозной счётчик id подписчиков — на модуль, а не на запись (fix-раунд
       итогового ревью фазы 2, Important 3). Раньше владелец запроса всегда
       получал id 1, и поздний clear() уже отработавшего дескриптора попадал
       в НОВУЮ запись с тем же ключом: удалял её живого подписчика и звал
       старый cancelRequest с delete inflight[key] — новый запрос завершался
       в пустоту (плитка навсегда без картинки, сетка с вечным лоадером).
       Дополнительно каждый дескриптор держит ссылку на свою запись и
       сверяет её с текущей: id уникален, но запись могла смениться. */
    var _subSeq = 0;

    /* Подборка целиком: movie и tv (если оба есть) → один список через mergeMedia.
       alive-guard каждого подписчика: notifySubs проверяет alive перед вызовом ok/err.
       done-latch: ok вызывается ровно один раз (I3) — защёлка внутри LC.util.gate.
       Глобальный дедлайн FETCH_TIMEOUT: при истечении — частичный результат.
       Возвращает {clear()} для принудительной отмены одной подписки. */
    function fetchAll(item, page, ok, err, alive) {
      var gen = alive ? alive() : 0;

      var inflightKey = (item.id || '') + ':' + (page || 1) + ':' + sortSignature(item);
      var entry = inflight[inflightKey];
      if (entry) {
        /* Подписываемся на уже идущий запрос. */
        var subId = ++_subSeq;
        var subEntry = entry;
        subEntry.subs[subId] = { ok: ok, err: err, alive: alive, gen: gen };
        return {
          clear: function () {
            /* Только своя запись: к этому моменту под тем же ключом могла
               появиться новая — её подписчиков трогать нельзя. */
            if (inflight[inflightKey] !== subEntry) return;
            if (!subEntry.subs[subId]) return;
            delete subEntry.subs[subId];
            /* Последний подписчик отменился — гасим весь запрос. */
            if (!Object.keys(subEntry.subs).length && subEntry._cancel) { subEntry._cancel(); }
          }
        };
      }

      /* Первый запрос: создаём entry и добавляем себя как подписчика. */
      entry = { subs: {}, _cancel: null };
      var mySubId = ++_subSeq;
      entry.subs[mySubId] = { ok: ok, err: err, alive: alive, gen: gen };
      inflight[inflightKey] = entry;
      var myEntry = entry;

      /* Уведомляем всех живых подписчиков СВОЕЙ записи и убираем её из
         inflight (только если там всё ещё она). */
      function notifySubs(method, arg) {
        if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
        var ids = Object.keys(myEntry.subs);
        for (var j = 0; j < ids.length; j++) {
          var sub = myEntry.subs[ids[j]];
          var subGen = sub.alive ? sub.alive() : 0;
          if (sub.alive && subGen !== sub.gen) continue;
          sub[method](arg);
        }
      }

      /* Отдельный alive для самого запроса: умирает, когда отменились все
         подписчики, — поздние ответы TMDB (их не отменить) глушит он. */
      var _reqAliveGen = 0;
      function requestAlive() { return _reqAliveGen; }

      var src = item.sources || {};
      var want = [];
      var got = {};

      if (src.movie) want.push('movie');
      if (src.tv) want.push('tv');
      if (!want.length) {
        if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
        if (alive && alive() !== gen) { /* внешний вызывающий мёртв — молчим */ }
        else { err({ no_sources: true }); }
        return { clear: function () {} };
      }

      function buildResult() {
        var m = got.movie || { results: [], total_pages: 1, total_results: 0 };
        var t = got.tv || { results: [], total_pages: 1, total_results: 0 };
        return {
          results: mergeMedia(m.results, t.results),
          title: item.title,
          page: page || 1,
          total_pages: Math.max(m.total_pages || 1, t.total_pages || 1),
          total_results: (m.total_results || 0) + (t.total_results || 0)
        };
      }

      /* Один сборщик на всю подборку (LC.util.gate): закрывает запрос либо
         когда ответили ВСЕ источники, либо по FETCH_TIMEOUT — тем, что успело
         прийти. Дедлайн — страховка от источника, который не ответит ни ok,
         ни err: подписчик (ряд главной или сетка) обязан получить ответ. */
      var gate = LC.util.gate(want.length, FETCH_TIMEOUT, function (partial) {
        var gotLen = Object.keys(got).length;
        /* Ответили все и все провалились — это ошибка подборки. По дедлайну
           отдаём что есть, даже пустой список: подписчик ждёт ответа. */
        if (!partial && !gotLen) { notifySubs('err', { all_failed: true }); return; }
        var r = buildResult();
        if (partial) r.partial = true;
        notifySubs('ok', r);
      });

      LC.util.each(want, function (media) {
        fetchOne(
          src[media], media, page,
          function (json) { got[media] = json; gate.tick(); },
          function () { gate.tick(); },
          requestAlive
        );
      });

      function cancelRequest() {
        _reqAliveGen++;
        /* Сборщик закрывается навсегда: ни поздний ответ, ни дедлайн уже
           никому не сообщат (подписчиков не осталось). */
        gate.cancel();
        /* Только своя запись — чужую под тем же ключом не удаляем. */
        if (inflight[inflightKey] === myEntry) delete inflight[inflightKey];
      }
      entry._cancel = cancelRequest;

      return {
        clear: function () {
          if (inflight[inflightKey] !== myEntry) return;
          if (!myEntry.subs[mySubId]) return;
          delete myEntry.subs[mySubId];
          if (!Object.keys(myEntry.subs).length) { cancelRequest(); }
        }
      };
    }

    /* Task 41: одна картинка для баннера плитки хаба (плитка 16:9 показывает
       кадр, а не коллаж постеров — см. src/46_hub.js).
       Это обычная первая страница (её ответ всё равно нужен и кэшируется на
       общих основаниях): backdrop_path первой карточки, у которой он есть, а
       если кадра нет ни у одной — первый poster_path страницы.
       В ok приходит путь TMDB, который вызывающий превращает в URL через
       прокси (LC.cardinfo.imageUrl). Ничего не нашлось — пустая строка.
       Возвращает {clear} — как fetchAll.
       Правка 2026-09-25: подборка с полем cover (путь кадра TMDB из
       каталога) отдаёт его сразу, без запроса, — так снимаются одинаковые
       кадры у подборок с общим лидером выдачи (разбор у поля cover в
       src/42_manifest.js).
       Ревью каталога (65): cover — только путь TMDB (COVER_PATH). Каталог
       может прийти и внешним (LC.MANIFEST_URL), а тест формата стоит лишь
       на встроенном; всё прочее (чужой адрес, «..», пробелы) не берётся, и
       плитка идёт обычным путём — первой страницей подборки. */
    var COVER_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|png)$/;

    function bannerPath(item, ok, err, alive) {
      var src = (item && item.sources) || {};
      var media = src.movie ? 'movie' : (src.tv ? 'tv' : '');
      var spec = media ? src[media] : null;
      if (!spec) { err({ no_sources: true }); return { clear: function () {} }; }

      if (typeof item.cover === 'string' && COVER_PATH.test(item.cover)) {
        ok(item.cover);
        return { clear: function () {} };
      }

      return fetchAll(item, 1, function (json) {
        var cards = (json && json.results) || [];
        var poster = '';
        for (var i = 0; i < cards.length; i++) {
          if (!cards[i]) continue;
          if (cards[i].backdrop_path) { ok(cards[i].backdrop_path); return; }
          if (!poster && cards[i].poster_path) poster = cards[i].poster_path;
        }
        ok(poster);
      }, err, alive);
    }

    /* ------------------------------------------------------------------ */
    /* Постеры: источник постера карточки (настройка lumen_posters).       */
    /*                                                                     */
    /* Постер ряда и сетки рисует САМА Lampa: адрес она ставит в своей     */
    /* ленивой загрузке по событию 'visible' — Api.img(data.poster_path)   */
    /* (vendor/lampa/app.min.js:52353). Значит подменять надо не src у     */
    /* готового узла (это второй запрос на карточку и гонка с той же       */
    /* ленивой загрузкой — разбор в шапке src/44_rows.js), а poster_path   */
    /* в самих карточках, ДО того как они уйдут в Lampa.                   */
    /*                                                                     */
    /* Карточку можно править на месте: объект у каждого ответа свой.      */
    /* Свежий ответ — это разбор JSON; ответ из кэша Lampa приходит из     */
    /* IndexedDB (Cache.getData, app.min.js:16525-16556), а он на каждое   */
    /* чтение отдаёт структурный клон. Кэш при этом не портится: запись    */
    /* cacheSet стоит РАНЬШЕ complite (app.min.js:33613-33622), а          */
    /* objectStore.put внутри rewriteData вызывается синхронно             */
    /* (app.min.js:16651-16658), то есть клон для кэша снимается до        */
    /* нашей правки. Выключил человек настройку — следующая сборка         */
    /* главной получит из кэша исходные poster_path.                       */
    /* ------------------------------------------------------------------ */

    /* Кэш ответов movie/{id}/images — 30 дней. Состав постеров фильма
       меняется раз в месяцы, а режим «без надписей» стоит 20 запросов на
       ряд: без кэша эти 20 повторялись бы на каждом открытии главной.
       Механика — штатный кэш запросов Lampa (тот же {life}, что у
       LC.franchise для collection/{id}); держится он на настройке самой
       Lampa «Кэширование запросов» (request_caching, app.min.js:33533):
       выключена она — кэша нет ни у нас, ни у неё. */
    var LIFE_IMAGES = 43200;

    /* Дедлайн подмены постеров на ряд. Ряд не имеет права молчать: Lampa
       грузит ряды пачками и ждёт call каждого (шапка src/44_rows.js).
       Что не успело — остаётся с постером Lampa. Шесть секунд — в 2.5 раза
       меньше общего дедлайна подборки (FETCH_TIMEOUT, 15 с), и это ПОВЕРХ него:
       подмена начинается, когда список карточек уже собран. */
    var POSTERS_TIMEOUT = 6000;

    /* Допуск по пропорции. Ячейка карточки ровно 2:3
       (.card__view{padding-bottom:150%}, vendor/lampa/css/app.css:3135-3139),
       кадрирование — object-fit:cover (там же:239-243), то есть всё, что
       не 2:3, чем-то режется.

       Границы поставлены замером на живых данных TMDB 2026-09-23: 160
       фильмов из восьми разнородных рядов, 2133 постера, из них 1318 без
       языка.
         Ниже 2:3 у постеров без языка есть ровно две области: «шум
         округления» (0.651…0.666, 13 штук) и один выброс — 21 постер
         0.486 (1440×2960, «Крёстный отец» I и II: это обои телефона, а не
         постер). Между 0.487 и 0.650 нет НИ ОДНОГО постера, поэтому нижняя
         граница ставится в эту пустую полосу. Взят её тугой край: 0.64 —
         это срез 4 % высоты, 7 px на карточке высотой 179 px, и все 7 при
         object-position:center top уходят вниз, в ноги.
         Выше 2:3 пустых полос нет (плотные группы 0.70, 0.707, 0.714,
         0.719, 0.75, максимум 0.756), поэтому верхняя граница считается по
         видимому срезу: 0.75 — это 11.1 % ширины, по 5.6 % с боку, и
         сверху/снизу не срезается ничего.
         Асимметрию допуска задают данные, а не кадрирование (Ф3 п.8 ревью
         фикс-раундов): постер прижат к верху (POSTER_ANCHOR = center top,
         src/30_css.js), и узкий постер теряет низ, а не голову. Снизу
         граница стоит в пустой полосе 0.487…0.650 — её держат «обои»
         0.486, сверху пустых полос нет, и граница — по срезу с боков.

       Охват от фильтра не страдает: с окном [0.64, 0.75] подходящий
       постер без языка нашёлся у всех 140 фильмов из 160, у которых он
       вообще есть (столько же, сколько без всякого фильтра). Ни у одного
       фильм не остался без постера ИЗ-ЗА допуска. */
    var AR_MIN = 0.64;
    var AR_MAX = 0.75;

    function posterFits(ratio) {
      var v = Number(ratio);
      if (!v) return false;
      return v >= AR_MIN && v <= AR_MAX;
    }

    /* Первый постер без надписей подходящей пропорции из ответа
       {media}/{id}/images. Без языка — это iso_639_1 === null; строка 'xx'
       («No Language») у TMDB означает другое и сюда не годится, поэтому
       сравнение строгое. Порядок списка TMDB (по рейтингу голосов) не
       трогаем: «первый подходящий» — это и есть «лучший подходящий».
       Не нашлось ничего — пустая строка, карточка остаётся с постером
       Lampa: кривой постер хуже обычного. */
    function cleanPoster(json) {
      var list = (json && json.posters) || [];
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (!p || !p.file_path) continue;
        if (p.iso_639_1 !== null) continue;
        if (!posterFits(p.aspect_ratio)) continue;
        return p.file_path;
      }
      return '';
    }

    /* Медиа-тип карточки. У фильма TMDB есть title, у сериала — name;
       поля взаимоисключающие во всех ответах, которыми мы пользуемся
       (discover/movie, discover/tv, collection/{id}, list/{id},
       movie/{id}). Нужен он дважды: в адресе movie|tv/{id}/images и в
       ключе сопоставления «оригинала» — там id фильма и id сериала могут
       совпасть, это разные объекты. */
    function cardMedia(card) {
      return card && card.title ? 'movie' : 'tv';
    }

    function cardKey(card) {
      return cardMedia(card) + ':' + (card && card.id);
    }

    /* Раскладывает poster_path списка карточек в карту по cardKey.
       Пустые и отсутствующие постеры в карту не попадают: подменять
       рабочий постер на «его нет» нельзя. */
    function posterIndex(cards, into) {
      var map = into || {};
      for (var i = 0; i < (cards || []).length; i++) {
        var c = cards[i];
        if (!c || !c.id || !c.poster_path) continue;
        map[cardKey(c)] = c.poster_path;
      }
      return map;
    }

    /* Ставит карточкам постеры из карты. Возвращает, скольким поставили —
       по этому числу считается покрытие в замерах. */
    function applyPosters(cards, map) {
      var n = 0;
      for (var i = 0; i < (cards || []).length; i++) {
        var c = cards[i];
        if (!c || !c.id) continue;
        var path = map[cardKey(c)];
        if (!path || path === c.poster_path) continue;
        c.poster_path = path;
        n++;
      }
      return n;
    }

    function postersMode() {
      try {
        if (typeof LC.postersMode === 'function') return LC.postersMode();
      } catch (e) { }
      return 'lampa';
    }

    /* Режим «Английские» (значение 'original'): ТОТ ЖЕ список, запрошенный с language=en.
       Lampa подставляет язык сама из Storage.field('tmdb_lang'), а
       переопределяет его ключ params.langs (app.min.js:19656-19663) — свой
       'language=' в адрес дописывать нельзя, он оказался бы вторым.
       Источник незнакомого типа пропускается (known выше): списка у него
       нет и переспрашивать нечего.
       page — страница, с которой пришли карточки (Ф3 п.1 ревью фикс-раундов):
       сетка подборки зовёт подмену на каждой догруженной странице, и
       английский список обязан быть той же страницей — иначе со второй
       страницы сопоставлять не с чем. У коллекции и списка страница одна,
       buildRequest её не передаёт. */
    function originalPosters(item, cards, done, alive, page) {
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }

      var src = (item && item.sources) || {};
      var want = [];
      if (known(src.movie)) want.push('movie');
      if (known(src.tv)) want.push('tv');
      if (!want.length) { done(0); return; }

      /* Набор (коллекция с also/movies) — это несколько запросов, и
         английский список нужен у каждого: иначе постеры сменились бы только
         у базовой коллекции. */
      var jobs = [];
      LC.util.each(want, function (media) {
        var spec = src[media];
        if (isSet(spec)) {
          LC.util.each(setRequests(spec), function (r) { jobs.push(r); });
          return;
        }
        /* Люди с also — так же: английская фильмография каждого. */
        if (isPersonSet(spec)) {
          LC.util.each(personRequests(spec, media), function (r) { jobs.push(r); });
          return;
        }
        var one = buildRequest(spec, media, page || 1);
        one.kind = spec.type;
        one.job = spec.job;
        jobs.push(one);
      });

      var map = {};
      var gate = LC.util.gate(jobs.length, POSTERS_TIMEOUT, function () {
        done(applyPosters(cards, map));
      });

      LC.util.each(jobs, function (r) {
        var params = {};
        var k;
        for (k in r.params) {
          if (r.params.hasOwnProperty(k)) params[k] = r.params[k];
        }
        params.langs = 'en';
        Lampa.Api.sources.tmdb.get(
          r.url,
          params,
          function (json) {
            if (!dead()) posterIndex(r.kind === 'movie' ? [json] : normalize(r.kind, json, r.job).results, map);
            gate.tick();
          },
          function () { gate.tick(); },
          { life: r.life }
        );
      });
    }

    /* Режим «без надписей»: по запросу на карточку.
       include_image_language=null отдаёт ТОЛЬКО постеры без языка и
       отменяет фильтр по language, который Lampa дописывает сама (замер
       2026-09-23 на десяти фильмах: 147 постеров и 17.5 КБ на фильм
       против 259 постеров и 20.2 КБ у 'ru,null' — то есть ru-постеры
       приходили бы зря).
       Запросы уходят все сразу, а не по очереди: замер того же дня на ряде
       из 20 карточек — 470 мс против 3942 мс последовательно. Сколько их
       реально полетит одновременно, решает браузер (лимит соединений на
       хост), и это правильный ограничитель: свой был бы медленнее на
       быстрой сети и ничего не дал бы на медленной. */
    function cleanPosters(cards, done, alive) {
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }

      var list = [];
      for (var i = 0; i < (cards || []).length; i++) {
        if (cards[i] && cards[i].id) list.push(cards[i]);
      }
      if (!list.length) { done(0); return; }

      var found = 0;
      var gate = LC.util.gate(list.length, POSTERS_TIMEOUT, function () { done(found); });

      LC.util.each(list, function (card) {
        Lampa.Api.sources.tmdb.get(
          cardMedia(card) + '/' + card.id + '/images',
          { filter: { include_image_language: 'null' } },
          function (json) {
            if (!dead()) {
              var path = cleanPoster(json);
              if (path && path !== card.poster_path) { card.poster_path = path; found++; }
            }
            gate.tick();
          },
          function () { gate.tick(); },
          { life: LIFE_IMAGES }
        );
      });
    }

    /* Точка входа: подменить постеры карточек согласно настройке и позвать
       done(сколько подменили). В режиме 'lampa' (по умолчанию) не делает
       НИЧЕГО и зовёт done синхронно — ни запроса, ни задержки у того, кто
       настройку не трогал.
       done зовётся ровно один раз при любом исходе, включая дедлайн: его
       вызывающий (ряд главной, сетка подборки) обязан ответить Lampa.
       page — номер страницы подборки, с которой пришли карточки; ряд
       главной его не передаёт (у ряда страница всегда первая). */
    function posters(item, cards, done, alive, page) {
      var mode = postersMode();
      if (mode !== 'original' && mode !== 'clean') { done(0); return; }
      if (!cards || !cards.length) { done(0); return; }
      if (mode === 'original') { originalPosters(item, cards, done, alive, page); return; }
      cleanPosters(cards, done, alive);
    }

    /* 'fetch' — зарезервированный BARE_NAME в es5check (глобальный Web API).
       Публичный ключ задаётся строкой, чтобы es5check не считал его нарушением. */
    var api = {
      buildRequest: buildRequest,
      normalize: normalize,
      discoverUrl: discoverUrl,
      mergeMedia: mergeMedia,
      sortSignature: sortSignature,
      fetchOne: fetchOne,
      /* Набор коллекций и фильмов: чистые части наружу ради тестов. */
      isSet: isSet,
      setRequests: setRequests,
      partOf: partOf,
      setParts: setParts,
      /* Люди с also — тоже ради тестов. */
      personIds: personIds,
      isPersonSet: isPersonSet,
      personRequests: personRequests,
      mergeCredits: mergeCredits,
      bannerPath: bannerPath,
      /* Постеры: чистые части наружу ради тестов, posters — ради рядов
         главной (src/44_rows.js) и сетки подборки (src/46_hub.js). */
      posterFits: posterFits,
      cleanPoster: cleanPoster,
      posterIndex: posterIndex,
      applyPosters: applyPosters,
      posters: posters
    };
    api['fetch'] = fetchAll;
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.sources;

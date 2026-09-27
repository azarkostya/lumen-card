  /* -------------------------------------------------------------------- */
  /* LC.lampaSearch — подборки в штатном поиске Lampa                       */
  /*                                                                       */
  /* Решение пользователя 2026-09-26: запрос «марвел» в поиске Lampa        */
  /* находит «Киновселенную Marvel» и другие подборки каталога, выбор       */
  /* открывает сетку подборки.                                              */
  /*                                                                       */
  /* Публичное API (чистые функции):                                        */
  /*   skeleton(text) → строка для сравнения: регистр, «ё», знаки и         */
  /*     кириллица в латиницу (русская запись латинского названия и само    */
  /*     название сходятся: «марвел» = «Marvel», «пиксар» = «Pixar»)        */
  /*   find(manifest, query, lang) → подборки каталога по качеству          */
  /*     совпадения, не больше LIMIT                                        */
  /*                                                                       */
  /* Публичное API (рантайм):                                               */
  /*   source() → источник поиска для Lampa.Search.addSource               */
  /*   install() / uninstall() — добавить / снять источник (идемпотентно)  */
  /*                                                                       */
  /* Как устроен поиск Lampa (vendor/lampa/app.min.js). Search.addSource   */
  /* кладёт источник в список additional (:41626-41628), и открытый поиск  */
  /* строит по нему вкладку (Sources.build, :41263-41300; заголовок        */
  /* вкладки вставляется в разметку сырым — экранируем). На ввод от трёх   */
  /* знаков Results.search зовёт source.search({query}, oncomplite)        */
  /* (:41049-41083; query — encodeURIComponent строки), а ответ — массив    */
  /* строк {title, results}, каждая рисуется рядом карточек (Results.build, */
  /* :41073-41126): OK по карточке — source.onSelect({element, …}, close). */
  /* Карточка — штатная Card с params.style.name 'wide' (кадр 16:9 и       */
  /* название поверх, Style, :22009-22046) и набором модулей только Card,   */
  /* Style и Callback (Lampa.Maker.module('Card'), :55119): у подборки нет  */
  /* ни закладок, ни отметок просмотра, и меню по удержанию OK ей не нужно. */
  /* Кадр — cover из каталога (путь TMDB, его Card берёт через прокси       */
  /* картинок Lampa); без него — кадр самой подборки, как у плитки хаба    */
  /* (fillCovers), а не успел он — своя заглушка, а не битая картинка.      */
  /*                                                                       */
  /* Сам поиск сети не стоит: каталог уже в памяти (LC.manifest.get),      */
  /* сравнение — строки; в сеть ходят только кадры подборок без cover.      */
  /* Ответ Lampa кэширует сама (Cache 'other') — поэтому выбор ищет         */
  /* подборку заново по id в текущем каталоге.                              */
  /* -------------------------------------------------------------------- */

  LC.lampaSearch = (function () {

    /* Карточек в строке результатов — как у выдачи TMDB (страница — 20). */
    var LIMIT = 20;

    /* Кириллица → латиница: русская и украинская буквы в ту запись, в
       которой их пишут латиницей, — на ней и сравнивается «марвел» с
       «Marvel». Мягкий и твёрдый знаки пропадают. */
    var TRANSLIT = {
      'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'e', 'ж': 'zh', 'з': 'z',
      'и': 'i', 'і': 'i', 'ї': 'i', 'й': 'i', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
      'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'sch',
      'ъ': '', 'ы': 'i', 'ь': '', 'э': 'e', 'ю': 'iu', 'я': 'ia'
    };

    /* Приведение к виду для сравнения: регистр, «ё», апостроф и знаки
       («Топ-250», «Marvel: …») — пробелом, повторы пробелов схлопнуты. */
    function norm(text) {
      return ('' + (text == null ? '' : text))
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/['’`ʼ]/g, '')
        .replace(/[^0-9a-zа-яіїєґ]+/g, ' ')
        .replace(/^\s+|\s+$/g, '');
    }

    /* Скелет: кириллица латиницей и латиница — к тому же звучанию (x → ks,
       w → v, y → i, q → k, ph → f, ck → k, c → s перед e/i, иначе k),
       удвоенные буквы — одной: «нетфликс» = «Netflix», «дисней» = «Disney»,
       «пиксар» = «Pixar». */
    function skeleton(text) {
      var s = norm(text);
      var out = '';
      for (var i = 0; i < s.length; i++) {
        var ch = s.charAt(i);
        out += Object.prototype.hasOwnProperty.call(TRANSLIT, ch) ? TRANSLIT[ch] : ch;
      }
      out = out
        .replace(/ph/g, 'f')
        .replace(/ck/g, 'k')
        .replace(/c(?=[eiy])/g, 's')
        .replace(/c/g, 'k')
        .replace(/x/g, 'ks')
        .replace(/w/g, 'v')
        .replace(/y/g, 'i')
        .replace(/q/g, 'k')
        .replace(/([a-z])\1+/g, '$1');
      return out;
    }

    /* Насколько ключ отвечает запросу: 0 — начинается с запроса, 1 — с
       запроса начинается слово внутри, 2 — запрос в середине слова; -1 —
       мимо. То же правило, что у поиска хаба (LC.nav.searchCollections). */
    function rankOf(key, query) {
      if (!key || !query) return -1;
      var at = key.indexOf(query);
      if (at === 0) return 0;
      if (at > 0) return key.charAt(at - 1) === ' ' ? 1 : 2;
      return -1;
    }

    /* Названия подборки для поиска: русское, переводы i18n, синонимы из
       каталога (необязательное поле aliases — строки) и id. */
    function keysOf(item) {
      var keys = [item.title, item.id];
      var i18n = item.i18n || {};
      for (var code in i18n) {
        if (Object.prototype.hasOwnProperty.call(i18n, code)) keys.push(i18n[code]);
      }
      var aliases = Array.isArray(item.aliases) ? item.aliases : [];
      for (var i = 0; i < aliases.length; i++) {
        if (typeof aliases[i] === 'string') keys.push(aliases[i]);
      }
      return keys;
    }

    /* Раунд C, C2 (e2e, E5): «зима» не находила «Зимнее кино», «лето» —
       «Летнее кино»: подстрока не знает, что это одно слово в разных формах.
       Второй проход — по основам: основа слова запроса — его первые STEM_LONG
       букв (слово от STEM_LONG_FROM букв) или STEM_SHORT (короче), и каждая
       основа запроса обязана начинать какое-то слово ключа, которое длиннее
       слова запроса не больше чем на STEM_TAIL букв (ревью rv4, RV4-2:
       «дети» находили «Детективы»; «зима» → «зимнее», «драма» → «драмы»,
       «звезды» → «звездные» проходят). Слова короче
       STEM_MIN (предлоги, «и», «на») в этом проходе не участвуют. Ранг такого
       совпадения — STEM_RANK, после любого совпадения подстрокой. «Новый
       год» ↔ «Новогоднее» основами не сходится (одно слово против двух) —
       это закрывают синонимы каталога (aliases, src/42_manifest.js). */
    var STEM_MIN = 3;
    var STEM_SHORT = 3;
    var STEM_LONG = 4;
    var STEM_LONG_FROM = 6;
    var STEM_RANK = 3;
    var STEM_TAIL = 3;

    /* Основы слов запроса: {stem, len} — основа и длина самого слова. */
    function stemsOf(q) {
      var words = q.split(' ');
      var out = [];
      for (var i = 0; i < words.length; i++) {
        var w = words[i];
        if (w.length < STEM_MIN) continue;
        out.push({ stem: w.slice(0, w.length >= STEM_LONG_FROM ? STEM_LONG : STEM_SHORT), len: w.length });
      }
      return out;
    }

    /* Каждая основа запроса начинает хотя бы одно слово ключа не длиннее
       своего слова запроса + STEM_TAIL (key уже приведён norm). */
    function stemMatch(key, stems) {
      if (!key || !stems.length) return false;
      var words = key.split(' ');
      for (var i = 0; i < stems.length; i++) {
        var hit = false;
        for (var k = 0; k < words.length && !hit; k++) {
          hit = words[k].indexOf(stems[i].stem) === 0 && words[k].length - stems[i].len <= STEM_TAIL;
        }
        if (!hit) return false;
      }
      return true;
    }

    /* Прогон 2026-09-27 (Н4): «Рокки» находил ещё «Школьные годы» по
       украинскому названию «Шкільні роки». Совпадение — не подстрокой: скелет
       схлопывает удвоенные буквы, и «рокки» с «роки» в нём одно и то же
       («roki»), — а основа «рок» начинала бы «роки» и без этого. Скелет и
       основы нужны, чтобы свести разные ЗАПИСИ одного слова («марвел» —
       «Marvel», «хеллоуин» — «Хэллоуин», «зима» — «зимнее»); между двумя
       кириллическими языками они сводят разные слова. Поэтому с ключом на
       другом кириллическом языке, чем запрос, сравнивается только сам текст
       (подстрокой, как было). Язык узнаётся по буквам, которые есть только в
       нём: і ї є ґ — украинский, ы э ъ — русский (текст уже приведён norm,
       «ё» в нём — «е»); у ключа — по всей фразе («роки» само по себе ничьё,
       «Шкільні роки» — украинское). Кириллический запрос без таких букв — на
       языке интерфейса (украинский или русский). Ключ без меток («Зимнее
       кино», «Летнее кино») и латиница подходят любому запросу. */
    function cyrLang(text) {
      if (/[іїєґ]/.test(text)) return 'uk';
      if (/[ыэъ]/.test(text)) return 'ru';
      return null;
    }

    function sameLang(key, qLang) {
      var kLang = qLang ? cyrLang(key) : null;
      return !kLang || kLang === qLang;
    }

    function find(manifest, query, lang) {
      var q = norm(query);
      var qs = skeleton(query);
      var stems = stemsOf(q);
      var qLang = cyrLang(q) || (/[а-я]/.test(q) ? (lang === 'uk' ? 'uk' : 'ru') : null);
      var list = manifest && Array.isArray(manifest.collections) ? manifest.collections : [];
      if (!q) return [];
      var found = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item || !item.id) continue;
        var keys = keysOf(item);
        var best = -1;
        for (var k = 0; k < keys.length; k++) {
          var key = norm(keys[k]);
          var own = sameLang(key, qLang);
          var r1 = rankOf(key, q);
          var r2 = own ? rankOf(skeleton(keys[k]), qs) : -1;
          var r = r1 < 0 ? r2 : (r2 < 0 ? r1 : Math.min(r1, r2));
          if (r < 0 && own && stemMatch(key, stems)) r = STEM_RANK;
          if (r >= 0 && (best < 0 || r < best)) best = r;
        }
        if (best >= 0) found.push({ item: item, rank: best, order: i });
      }
      found.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.order - b.order;
      });
      var out = [];
      for (var j = 0; j < found.length && out.length < LIMIT; j++) out.push(found[j].item);
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Рантайм                                                             */
    /* ------------------------------------------------------------------ */

    /* Заглушка кадра подборки без cover: ровная тёмная панель 16:9 —
       название Card пишет поверх (card__promo). */
    var NO_COVER = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="9" viewBox="0 0 16 9">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#2A221D"/><stop offset="1" stop-color="#14100D"/></linearGradient></defs>' +
      '<rect width="16" height="9" fill="url(#g)"/></svg>');

    function langCode() {
      try { if (typeof LC.langCode === 'function') return LC.langCode(); } catch (e) { }
      return 'ru';
    }

    function titleOf(obj, code) {
      if (!obj) return '';
      if (code && code !== 'ru' && obj.i18n && obj.i18n[code]) return obj.i18n[code];
      return obj.title || '';
    }

    function catalog() {
      try { return LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null; } catch (e) { return null; }
    }

    /* Набор модулей карточки: только Card, Style и Callback. Нет
       Lampa.Maker — штатный набор (карточка всё равно рисуется). */
    function cardModule() {
      try {
        if (window.Lampa && Lampa.Maker && typeof Lampa.Maker.module === 'function') {
          return Lampa.Maker.module('Card').only('Card', 'Style', 'Callback');
        }
      } catch (e) { }
      return undefined;
    }

    function cardOf(item, code, groups) {
      var params = { style: { name: 'wide' } };
      var mod = cardModule();
      if (typeof mod !== 'undefined') params.module = mod;
      var card = {
        id: 'lumen_' + item.id,
        lumen_id: item.id,
        title: titleOf(item, code),
        overview: titleOf(groups[item.group], code),
        params: params
      };
      /* Кадр — только путь TMDB (как у плиток хаба: каталог может быть
         внешним, и адресом со стороны он сюда не попадёт). */
      if (typeof item.cover === 'string' && TMDB_PATH.test(item.cover)) card.backdrop_path = item.cover;
      else card.img = NO_COVER;
      return card;
    }

    var TMDB_PATH = /^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/;

    /* Прогон 2026-09-27 (Н5): «Киновселенная Marvel» в поиске — тёмная
       панель. cover в каталоге есть не у всех (у 100 подборок из 174 его
       нет, у mcu тоже), и плитка хаба без него берёт кадр из самой подборки
       (LC.sources.bannerPath: backdrop_path первой карточки её первой
       страницы, у Кинопоиска — постер), а поиск — нет: брал только cover.
       Теперь и поиск берёт кадр тем же путём и ту же картинку, что плитка
       хаба. Ответ Lampa ждёт (Results.search рисует строку по oncomplite),
       поэтому кадров просим не больше COVER_AHEAD (первые карточки строки —
       те, что на экране, столько же хаб грузит вокруг фокуса) и ждём не
       дольше COVER_WAIT: не успел кадр — заглушка, как прежде. Первая
       страница подборки кэшируется Lampa (Api tmdb, life), и повторный
       поиск или открытая плитка хаба её уже не просят.
       Новый поиск или отмена (onCancel) — прежний ответ не отдаётся: Lampa
       сама не проверяет, к какому запросу пришёл ответ (штатные источники
       на onCancel так же гасят свой запрос, app.min.js:20283). */
    var COVER_AHEAD = 8;
    var COVER_WAIT = 1500;
    var seq = 0;
    var flush = null;

    function fillCovers(found, cards, done) {
      var want = [];
      for (var i = 0; i < cards.length && want.length < COVER_AHEAD; i++) {
        if (cards[i].img === NO_COVER) want.push(i);
      }
      if (!want.length || !LC.sources || typeof LC.sources.bannerPath !== 'function') { done(); return; }
      var left = want.length;
      var over = false;
      var timer = setTimeout(finish, COVER_WAIT);
      function finish() {
        if (over) return;
        over = true;
        clearTimeout(timer);
        done();
      }
      function alive() { return over ? 1 : 0; }
      function one(k) {
        var card = cards[k];
        function next() { if (--left <= 0) finish(); }
        try {
          LC.sources.bannerPath(found[k], function (path) {
            if (over) return;
            if (typeof path === 'string' && /^https?:\/\//.test(path)) card.img = path;
            else if (typeof path === 'string' && TMDB_PATH.test(path)) { card.backdrop_path = path; delete card.img; }
            next();
          }, function () {
            if (!over) next();
          }, alive);
        } catch (e) {
          warn('search: cover failed', e);
          next();
        }
      }
      for (var j = 0; j < want.length; j++) one(want[j]);
    }

    function decode(query) {
      try { return decodeURIComponent('' + (query == null ? '' : query)); } catch (e) { return ''; }
    }

    function label() {
      return LC.util.esc('' + LC.lang('lumen_search_source'));
    }

    var built = null;

    function source() {
      if (built) return built;
      built = {
        title: label(),
        params: {},
        search: function (params, oncomplite) {
          var my = ++seq;
          var rows = [];
          var found = [];
          var cards = [];
          try {
            var manifest = catalog();
            var code = langCode();
            found = find(manifest, decode(params && params.query), code);
            if (found.length) {
              var groups = {};
              var list = (manifest && manifest.groups) || [];
              for (var g = 0; g < list.length; g++) if (list[g] && list[g].id) groups[list[g].id] = list[g];
              for (var i = 0; i < found.length; i++) cards.push(cardOf(found[i], code, groups));
              rows.push({ title: built.title, results: cards, total: cards.length });
            }
          } catch (e) {
            warn('search: collections failed', e);
            rows = [];
            cards = [];
          }
          var sent = false;
          function reply() {
            if (sent) return;
            sent = true;
            if (flush === reply) flush = null;
            try { oncomplite(rows); } catch (e) { warn('search: reply failed', e); }
          }
          flush = reply;
          fillCovers(found, cards, function () {
            if (my === seq) reply();
          });
        },
        /* Финальная проверка, L4: карточка подборки, которой в каталоге
           уже нет (Lampa показывает вчерашние результаты из своего кэша
           search_<вкладка>_last сутки), — уведомление, и поиск остаётся
           открытым. Прежде он закрывался, и не открывалось ничего. */
        onSelect: function (params, close) {
          var id = params && params.element && params.element.lumen_id;
          var manifest = catalog();
          var list = (manifest && manifest.collections) || [];
          var item = null;
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) { item = list[i]; break; }
          }
          if (!item) {
            try {
              if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang('lumen_search_gone'));
            } catch (e) { }
            return;
          }
          try { if (typeof close === 'function') close(); } catch (e1) { }
          try { if (LC.hub && typeof LC.hub.open === 'function') LC.hub.open(item); } catch (e2) { warn('search: open failed', e2); }
        },
        /* Финальный прогон 1.0.0: Lampa зовёт onCancel на любой фокус
           клавиши экранной клавиатуры, а тот же запрос повторно не
           отправляет (Results.search: if (query == value) return,
           app.min.js ~41016) — выброшенный ответ оставлял вкладку в «Идет
           поиск…» навсегда, пока ждали обложку. Отмена теперь отдаёт ответ
           сразу, с теми обложками, что успели; новый запрос всё равно
           перерисует вкладку своим ответом. */
        onCancel: function () {
          var f = flush;
          flush = null;
          seq++;
          if (f) f();
        }
      };
      return built;
    }

    var installed = null;

    function install() {
      if (installed) return;
      try {
        if (!window.Lampa || !Lampa.Search || typeof Lampa.Search.addSource !== 'function') return;
        var src = source();
        /* Язык интерфейса могли сменить — подпись вкладки берётся заново. */
        src.title = label();
        Lampa.Search.addSource(src);
        installed = src;
      } catch (e) {
        warn('search: install failed', e);
      }
    }

    function uninstall() {
      if (!installed) return;
      var src = installed;
      installed = null;
      try {
        if (window.Lampa && Lampa.Search && typeof Lampa.Search.removeSource === 'function') Lampa.Search.removeSource(src);
      } catch (e) {
        warn('search: uninstall failed', e);
      }
    }

    return {
      skeleton: skeleton,
      find: find,
      source: source,
      install: install,
      uninstall: uninstall
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.lampaSearch;

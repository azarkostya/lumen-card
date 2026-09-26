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
  /* картинок Lampa); без него — своя заглушка, а не битая картинка.        */
  /*                                                                       */
  /* Сети поиск не стоит ничего: каталог уже в памяти (LC.manifest.get),   */
  /* сравнение — строки. Ответ Lampa кэширует сама (Cache 'other') —        */
  /* поэтому выбор ищет подборку заново по id в текущем каталоге.           */
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

    function find(manifest, query, lang) {
      var q = norm(query);
      var qs = skeleton(query);
      var list = manifest && Array.isArray(manifest.collections) ? manifest.collections : [];
      if (!q) return [];
      var found = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item || !item.id) continue;
        var keys = keysOf(item);
        var best = -1;
        for (var k = 0; k < keys.length; k++) {
          var r1 = rankOf(norm(keys[k]), q);
          var r2 = rankOf(skeleton(keys[k]), qs);
          var r = r1 < 0 ? r2 : (r2 < 0 ? r1 : Math.min(r1, r2));
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
      if (typeof item.cover === 'string' && /^\/[A-Za-z0-9_-]+\.(jpg|png|webp)$/.test(item.cover)) card.backdrop_path = item.cover;
      else card.img = NO_COVER;
      return card;
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
          var rows = [];
          try {
            var manifest = catalog();
            var code = langCode();
            var found = find(manifest, decode(params && params.query), code);
            if (found.length) {
              var groups = {};
              var list = (manifest && manifest.groups) || [];
              for (var g = 0; g < list.length; g++) if (list[g] && list[g].id) groups[list[g].id] = list[g];
              var cards = [];
              for (var i = 0; i < found.length; i++) cards.push(cardOf(found[i], code, groups));
              rows.push({ title: built.title, results: cards, total: cards.length });
            }
          } catch (e) {
            warn('search: collections failed', e);
            rows = [];
          }
          oncomplite(rows);
        },
        onSelect: function (params, close) {
          try { if (typeof close === 'function') close(); } catch (e) { }
          var id = params && params.element && params.element.lumen_id;
          var manifest = catalog();
          var list = (manifest && manifest.collections) || [];
          for (var i = 0; i < list.length; i++) {
            if (list[i] && list[i].id === id) {
              try { if (LC.hub && typeof LC.hub.open === 'function') LC.hub.open(list[i]); } catch (e2) { warn('search: open failed', e2); }
              return;
            }
          }
        },
        onCancel: function () { }
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

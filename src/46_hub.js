  /* -------------------------------------------------------------------- */
  /* LC.hub — хаб подборок, сетка подборки, кнопка «Франшиза» в карточке   */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   titleOf(obj, lang) → заголовок с учётом i18n манифеста               */
  /*   groupsWithCounts(manifest, lang) → [{id, title, count, groups}]      */
  /*   tilesFor(manifest, hubGroupId) → [подборка, …]                       */
  /*   openTarget(item) → объект для Lampa.Activity.push                    */
  /*   franchiseItem(belongs_to_collection) → подборка для lumen_grid       */
  /*   sortModes() / applySort(item, mode) / sortLocal(results, mode)       */
  /*   needsLocalSort(item) / collage(results, n) / cardMedia(card)         */
  /*   hasMore(json)                                                        */
  /*   install() — регистрация компонентов и пункта меню (идемпотентно)     */
  /*   uninstall() — снятие пункта меню                                     */
  /*   franchise(root, movie) — кнопка «Франшиза» в карточке                */
  /*   menuNode() — узел пункта меню или null (для тестов и проверок)       */
  /*                                                                       */
  /* Проверено на vendor/lampa/app.min.js (Lampa 3.3.4):                    */
  /*                                                                        */
  /* 1. Жизненный цикл компонента (ActivitySlide, app.min.js 45390-45560):  */
  /*    create(body) → body.append(component.render(true)) → start() →      */
  /*    pause()/stop() → destroy(). render(true) обязан вернуть DOM-узел.   */
  /*    ActivitySlide.start() САМ регистрирует дефолтный контроллер         */
  /*    'content' и зовёт Controller.toggle('content') ДО component.start(),*/
  /*    поэтому свой контроллер компонент ставит в start() поверх него —    */
  /*    тем же именем 'content' — и повторяет toggle('content').            */
  /*    destroy() вызывается без проверки на существование, и сразу после   */
  /*    него Lampa затирает ВСЕ методы компонента пустыми функциями         */
  /*    (app.min.js 45560): отложенные колбэки после destroy в компонент не */
  /*    возвращаются, но наши собственные замыкания живут — их гасит        */
  /*    поколение gen (см. ниже).                                           */
  /*                                                                        */
  /* 2. Навигация — штатная. Lampa.Controller.move(dir) вызывает только     */
  /*    одноимённый метод активного контроллера (app.min.js run/move         */
  /*    46238-46255), а перемещение фокуса внутри экрана делает Navigator —  */
  /*    глобал из отдельного скрипта vendor/lampa/vender/navigator/          */
  /*    navigator.js (index.html:52, `var Navigator = new SpatialNavigator`).*/
  /*    В объекте window.Lampa его нет, но он доступен как window.Navigator  */
  /*    и его же зовут все компоненты Lampa. См. navMove ниже.               */
  /*                                                                        */
  /* 3. Карточки сетки — штатный шаблон 'card' (Lampa.Template.js): те же    */
  /*    классы, что у штатной сетки, а значит метки закладок и истории,      */
  /*    рейтинг, качество и тип рисуются как у Lampa. Сам Lampa.Card не      */
  /*    годится: помечен deprecated и печатает console.warn на КАЖДОЙ        */
  /*    карточке (app.min.js 51893) — 20 строк в консоли на страницу, а      */
  /*    новый внутренний класс карточки (app.min.js 19114) плагинам не       */
  /*    отдан. Оформление задаёт наш CSS под корнем .lumen-grid              */
  /*    (design-spec-main §0.4); данные карточки лежат в нативном свойстве   */
  /*    node.card_data, как и у штатной (app.min.js 51914).                  */
  /*                                                                        */
  /* 4. Пункт меню: Lampa.Menu.addButton(svg, title, onEnter) возвращает    */
  /*    jQuery-узел <li class="menu__item selector"> (app.min.js 10077).    */
  /*    Узел запоминается и снимается в uninstall() — иначе выключенный     */
  /*    плагин оставил бы в меню живой пункт.                               */
  /*                                                                        */
  /* Отмена запросов: у компонента своё поколение gen. destroy() поднимает  */
  /* его, все alive()-замыкания становятся ложными, а сами дескрипторы      */
  /* LC.sources.fetch гасятся через clear() — Lampa свои запросы не         */
  /* отменяет, отменяет только их доставку (см. шапку 44_rows.js).          */
  /* -------------------------------------------------------------------- */

  LC.hub = (function () {

    /* Колонок в сетке — 6 (поправка контроллера к Task 17). Число задано и
       в CSS: раскладку делает CSS, а здесь по нему определяется последняя
       строка карточек, на которой пора грузить следующую страницу. */
    var GRID_COLS = 6;

    /* Сколько карточек вперёд от фокуса получают постеры. Окно чуть больше
       двух рядов: следующий ряд уже с картинками к моменту, когда фокус до
       него дойдёт. */
    var POSTER_AHEAD = 14;

    /* Сколько плиток группы получают коллаж постеров сразу при открытии.
       Ровно два первых ряда по четыре — столько видно без прокрутки;
       остальным коллаж грузится при получении фокуса. Цена одной плитки —
       один запрос: для discover это первая страница подборки (кэш 12 ч), для
       Кинопоиска — LC.sources.collagePaths берёт постеры прямо из ответа КП,
       не сопоставляя фильмы с TMDB (кэш 30 дней). */
    var COLLAGE_EAGER = 8;

    /* Сколько постеров в коллаже плитки (design-spec-main §0.8: три со сдвигом). */
    var COLLAGE_SIZE = 3;

    /* ------------------------------------------------------------------ */
    /* Чистые функции (без Lampa, DOM и Storage).                          */
    /* ------------------------------------------------------------------ */

    /* Заголовок объекта манифеста (группа, чип хаба, подборка) на языке lang.
       Русский лежит в title, остальные — в i18n[код]; нет перевода — title. */
    function titleOf(obj, lang) {
      if (!obj) return '';
      if (lang && lang !== 'ru' && obj.i18n && obj.i18n[lang]) return obj.i18n[lang];
      return obj.title || '';
    }

    /* Подборки манифеста, чья group входит в список groupIds. Порядок —
       как в манифесте (он же порядок плиток в хабе). */
    function collectionsIn(manifest, groupIds) {
      var out = [];
      if (!manifest || !Array.isArray(manifest.collections)) return out;
      var want = {};
      var i;
      for (i = 0; i < (groupIds || []).length; i++) want[groupIds[i]] = 1;
      for (i = 0; i < manifest.collections.length; i++) {
        var c = manifest.collections[i];
        if (c && want[c.group]) out.push(c);
      }
      return out;
    }

    /* Чипы групп хаба со счётчиком подборок. Считается по ОБЪЕДИНЕНИЮ id из
       hubGroups (поправка контроллера к Task 17): чип «Студии и сервисы»
       держит две группы манифеста сразу. Пустые чипы не показываются —
       кликнуть по ним было бы не на что. */
    function groupsWithCounts(manifest, lang) {
      var out = [];
      if (!manifest || !Array.isArray(manifest.hubGroups)) return out;
      for (var i = 0; i < manifest.hubGroups.length; i++) {
        var g = manifest.hubGroups[i];
        if (!g) continue;
        var list = collectionsIn(manifest, g.groups);
        if (!list.length) continue;
        out.push({ id: g.id, title: titleOf(g, lang), count: list.length, groups: g.groups });
      }
      return out;
    }

    /* Подборки одного чипа хаба. month (1..12, необязателен) поднимает
       сезонные подборки в начало списка — Task 21: в октябре «Хэллоуин»
       и в декабре «Рождественские комедии» должны попадаться первыми, а не
       на третьем экране прокрутки. Без month порядок остаётся манифестным. */
    function tilesFor(manifest, hubGroupId, month) {
      if (!manifest || !Array.isArray(manifest.hubGroups)) return [];
      for (var i = 0; i < manifest.hubGroups.length; i++) {
        var g = manifest.hubGroups[i];
        if (g && g.id === hubGroupId) {
          var list = collectionsIn(manifest, g.groups);
          if (month && LC.manifest && typeof LC.manifest.orderForMonth === 'function') {
            return LC.manifest.orderForMonth(list, month);
          }
          return list;
        }
      }
      return [];
    }

    /* Подборка сезонная прямо сейчас? Плитка получает по этому признаку
       метку «Сезон» — иначе поднятая наверх подборка выглядела бы просто
       переставленной без причины. */
    function inSeason(item, month) {
      if (!item || !Array.isArray(item.season) || !month) return false;
      for (var i = 0; i < item.season.length; i++) {
        if (Number(item.season[i]) === Number(month)) return true;
      }
      return false;
    }

    /* Медиа единственного источника подборки, если он один И это discover.
       Иначе null: два медиа-типа одной строкой url не выразить, а коллекции,
       списки и Кинопоиск штатная сетка не открывает вовсе (план, раздел 0:
       category_full с url 'collection/10' падает TypeError). */
    function singleDiscover(item) {
      var src = (item && item.sources) || {};
      var media = '';
      if (src.movie && !src.tv) media = 'movie';
      else if (src.tv && !src.movie) media = 'tv';
      if (!media) return null;
      if (src[media].type !== 'discover') return null;
      return media;
    }

    /* Куда открывать подборку: штатная сетка Lampa, если она это умеет,
       иначе свой компонент. Возвращает объект для Lampa.Activity.push. */
    function openTarget(item) {
      var media = singleDiscover(item);
      if (media) {
        return {
          url: LC.sources.discoverUrl(item.sources[media], media),
          title: item.title,
          component: 'category_full',
          source: 'tmdb',
          page: 1
        };
      }
      return { url: '', title: (item && item.title) || '', component: 'lumen_grid', lumen: item, page: 1 };
    }

    /* movie.belongs_to_collection → подборка-однодневка для lumen_grid.
       Своего id в манифесте у неё нет, поэтому ключ кэша дедупликации
       (LC.sources.fetch) собирается из id коллекции TMDB. */
    function franchiseItem(collection) {
      if (!collection || !collection.id) return null;
      return {
        id: 'col-' + collection.id,
        title: collection.name || '',
        sources: { movie: { type: 'collection', id: collection.id } }
      };
    }

    /* Три режима сортировки сетки (design-spec-main §1, экран 20).
       key — ключ строки в LC.STRINGS. */
    var SORT_BY = {
      popular: { movie: 'popularity.desc', tv: 'popularity.desc' },
      rating: { movie: 'vote_average.desc', tv: 'vote_average.desc' },
      'new': { movie: 'primary_release_date.desc', tv: 'first_air_date.desc' }
    };

    function sortModes() {
      return [
        { id: 'popular', key: 'lumen_sort_popular' },
        { id: 'rating', key: 'lumen_sort_rating' },
        { id: 'new', key: 'lumen_sort_new' }
      ];
    }

    /* Подборка с подменённым sort_by у discover-источников. Оригинал не
       мутируется: манифест общий на весь плагин, а сортировка живёт только
       в одной открытой сетке. Не-discover источники возвращаются как есть —
       TMDB их не сортирует, сортировку делает sortLocal. */
    function applySort(item, mode) {
      var table = SORT_BY[mode];
      if (!item || !table) return item;
      var out = {};
      var k;
      for (k in item) {
        if (item.hasOwnProperty(k)) out[k] = item[k];
      }
      out.sources = {};
      for (k in (item.sources || {})) {
        if (!item.sources.hasOwnProperty(k)) continue;
        var spec = item.sources[k];
        if (!spec || spec.type !== 'discover') { out.sources[k] = spec; continue; }
        var copy = { type: 'discover', params: {} };
        var p;
        for (p in (spec.params || {})) {
          if (spec.params.hasOwnProperty(p)) copy.params[p] = spec.params[p];
        }
        copy.params.sort_by = table[k] || table.movie;
        if (spec.id != null) copy.id = spec.id;
        out.sources[k] = copy;
      }
      return out;
    }

    /* Нужна ли сортировка на месте: хотя бы один источник не discover
       (коллекция, список TMDB, Кинопоиск — их TMDB отдаёт одним куском в
       своём порядке). */
    function needsLocalSort(item) {
      var src = (item && item.sources) || {};
      var k;
      for (k in src) {
        if (src.hasOwnProperty(k) && src[k] && src[k].type !== 'discover') return true;
      }
      return false;
    }

    /* Дата выхода карточки строкой 'ГГГГ-ММ-ДД' (сравнимой лексикографически). */
    function cardDate(card) {
      return '' + ((card && (card.release_date || card.first_air_date)) || '');
    }

    /* Копия списка, отсортированная по режиму. Неизвестный режим — порядок
       источника (для коллекции это хронология, её ставит LC.sources.normalize). */
    function sortLocal(results, mode) {
      if (!results || !results.length) return [];
      var list = results.slice();
      if (mode === 'rating') {
        list.sort(function (a, b) { return (Number(b.vote_average) || 0) - (Number(a.vote_average) || 0); });
      } else if (mode === 'popular') {
        list.sort(function (a, b) { return (Number(b.popularity) || 0) - (Number(a.popularity) || 0); });
      } else if (mode === 'new') {
        list.sort(function (a, b) {
          var da = cardDate(a);
          var db = cardDate(b);
          if (da > db) return -1;
          if (da < db) return 1;
          return 0;
        });
      }
      return list;
    }

    /* Пути первых n постеров (позиции без постера пропускаются). */
    function collage(results, n) {
      var out = [];
      if (!results || !results.length) return out;
      for (var i = 0; i < results.length && out.length < n; i++) {
        if (results[i] && results[i].poster_path) out.push(results[i].poster_path);
      }
      return out;
    }

    /* Тип карточки для Activity.push({component:'full', method: …}).
       media_type приходит из discover с двумя медиа; без него признак — name
       (у сериалов TMDB заголовок в name, у фильмов — в title). */
    function cardMedia(card) {
      if (card && card.media_type) return card.media_type;
      return (card && card.name) ? 'tv' : 'movie';
    }

    /* Есть ли следующая страница. */
    function hasMore(json) {
      if (!json) return false;
      return (json.page || 1) < (json.total_pages || 1);
    }

    /* ------------------------------------------------------------------ */
    /* Runtime: DOM, Lampa, сеть.                                           */
    /* ------------------------------------------------------------------ */

    function lang() {
      try {
        if (typeof LC.langCode === 'function') return LC.langCode();
      } catch (e) {}
      return 'ru';
    }

    function tmdbImageFn() {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
        return function (url) { return Lampa.TMDB.image(url); };
      }
      return null;
    }

    function apiImgFn() {
      if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
        return function (path, size) { return Lampa.Api.img(path, size); };
      }
      return null;
    }

    /* URL картинки — только через прокси TMDB Lampa (план 0.2), тем же
       путём, что фон карточки: LC.cardinfo.imageUrl нормализует слэш и
       умеет фолбэк на Lampa.Api.img. */
    function imageUrl(path, size) {
      try {
        return LC.cardinfo.imageUrl(path, size, tmdbImageFn(), apiImgFn());
      } catch (e) {
        return '';
      }
    }

    /* Текст без разметки. */
    function esc(text) {
      return LC.util.esc('' + (text == null ? '' : text));
    }

    /* Task 20: показывать ли подсказку «нужен ключ Кинопоиска» (настройка
       lumen_kp_hint, по умолчанию да; её же читает ряд отзывов карточки). */
    function kpHintEnabled() {
      try { return LC.pref ? !!LC.pref('lumen_kp_hint', true) : true; } catch (e) { return true; }
    }

    /* Класс режима анимаций на корень нашего экрана. На карточке его ставит
       applyMotionMode (90_runtime.js) по её корню; хаб и сетка — отдельные
       активности, и без этого класса CSS-правила lite/off (они привязаны к
       корню экрана) на них бы не действовали, то есть пружина фокуса играла
       бы и на слабых ТВ. */
    function motionClass(node) {
      try {
        node.addClass('lumen-motion-' + LC.motionMode());
      } catch (e) {}
    }

    /* Год из даты выхода. */
    function cardYear(card) {
      var d = cardDate(card);
      return d ? d.slice(0, 4) : '';
    }

    /* Мета-строка карточки сетки: «2021 · 8.2» (design-spec-main §0.4). */
    function cardMeta(card) {
      var parts = [];
      var year = cardYear(card);
      if (year) parts.push(year);
      var vote = Number(card && card.vote_average) || 0;
      if (vote > 0) parts.push(vote.toFixed(1));
      return parts.join(' · ');
    }

    /* Открыть карточку фильма/сериала — тот же push, что делает штатная
       сетка (router 'full'): без url, с method и самой карточкой. */
    function openCard(card) {
      try {
        Lampa.Activity.push({
          url: '',
          component: 'full',
          id: card.id,
          method: cardMedia(card),
          card: card,
          source: 'tmdb'
        });
      } catch (e) {
        warn('hub: open card failed', e);
      }
    }

    /* Открыть подборку (из плитки хаба или кнопки «Франшиза»). */
    function openCollection(item) {
      try {
        Lampa.Activity.push(openTarget(item));
      } catch (e) {
        warn('hub: open collection failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Навигация и общий контроллер экрана.                                */
    /*                                                                     */
    /* Навигация штатная: Navigator — глобал из отдельного скрипта         */
    /* vendor/lampa/vender/navigator/navigator.js (index.html:52,          */
    /* `var Navigator = new SpatialNavigator()`), его же зовут все          */
    /* компоненты Lampa; в объекте window.Lampa он не экспортирован.        */
    /* canmove(dir) вернул false — двигаться внутри экрана некуда, и        */
    /* контроллер решает сам: влево — меню, вверх — шапка.                  */
    /* Navigator.move синхронно шлёт элементу 'hover:focus' (Navigator      */
    /* 'focus' -> Controller.focus -> Utils.trigger, app.min.js 46437),     */
    /* поэтому сразу после move наши обработчики фокуса уже отработали.     */
    /* ------------------------------------------------------------------ */

    function navMove(dir) {
      try {
        if (window.Navigator && typeof Navigator.canmove === 'function' && Navigator.canmove(dir)) {
          Navigator.move(dir);
          return true;
        }
      } catch (e) {
        warn('hub: navigator failed', e);
      }
      return false;
    }

    /* Контроллер экрана плагина. focusTarget() отдаёт узел, на который надо
       вернуть фокус при входе (возврат назад, перестройка списка); afterMove
       вызывается после каждого успешного шага вправо/вниз — сетка по нему
       догружает постеры и следующую страницу. */
    /* onUp — запасной шаг вверх, когда Navigator дальше идти не может.
       Нужен хабу: кнопка поиска стоит в правой части шапки (design-spec-main
       §0.8), а чипы групп — слева, и SpatialNavigator её «вверх» не находит
       (проверено живьём 2026-09-17: canmove('up') с чипа === false, фокус
       уходил прямо в шапку Lampa). Вернул true — шаг сделан, в шапку Lampa
       не уходим. */
    function screenController(root, focusTarget, afterMove, onUp) {
      return {
        toggle: function () {
          Lampa.Controller.collectionSet(root[0]);
          Lampa.Controller.collectionFocus(focusTarget() || false, root[0]);
        },
        left: function () {
          if (!navMove('left')) Lampa.Controller.toggle('menu');
        },
        right: function () {
          if (navMove('right') && afterMove) afterMove();
        },
        up: function () {
          if (navMove('up')) return;
          if (onUp && onUp()) return;
          Lampa.Controller.toggle('head');
        },
        down: function () {
          if (navMove('down') && afterMove) afterMove();
        },
        back: function () {
          Lampa.Activity.backward();
        }
      };
    }

    /* ------------------------------------------------------------------ */
    /* Компонент lumen_hub — группы и плитки подборок.                     */
    /* ------------------------------------------------------------------ */

    function HubComponent(object) {
      var self = this;
      var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
      var root = $('<div class="lumen-hub"></div>');
      var head = $('<div class="lumen-hub__head"></div>');
      var chipsRow = $('<div class="lumen-hub__chips"></div>');
      var tilesRow = $('<div class="lumen-hub__tiles"></div>');

      /* Поколение запросов. Поднимается при смене группы, stop() и destroy():
         дескрипторы гасятся, а доехавшие колбэки сверяют захваченное
         значение и в снятый с экрана DOM уже не пишут. */
      var gen = 0;
      var handles = [];
      var manifest = null;
      var groups = [];
      var activeGroup = '';
      var chipNodes = [];
      var tileNodes = [];
      var lastFocus = null;
      var started = false;

      function alive(captured) {
        return function () { return gen === captured; };
      }

      function clearHandles() {
        for (var i = 0; i < handles.length; i++) {
          try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
        }
        handles = [];
      }

      /* Всё, что было запрошено для прежнего состояния экрана, становится
         неактуальным разом. */
      function bump() {
        gen++;
        clearHandles();
      }

      /* Узел, на который вернуть фокус при входе в экран: тот же, если он ещё
         в нашем дереве; иначе первый чип группы.
         Первый .selector экрана с Task 27 — кнопка поиска в шапке, и отдай
         мы выбор Lampa, вход в хаб начинался бы с неё. Экран же про выбор
         подборки глазами: поиск — запасной путь, он на шаг «вверх». */
      function focusTarget() {
        if (lastFocus && root[0] && root[0].contains && root[0].contains(lastFocus)) return lastFocus;
        if (chipNodes.length) return chipNodes[0];
        return null;
      }

      function recollect(prefer) {
        try {
          Lampa.Controller.collectionSet(root[0]);
          var node = prefer || focusTarget();
          Lampa.Controller.collectionFocus(node || false, root[0]);
        } catch (e) {
          warn('hub: collection failed', e);
        }
      }

      /* Коллаж плитки. Путь дешёвый: LC.sources.collagePaths просит ровно три
         картинки и для подборки Кинопоиска берёт их прямо из ответа КП —
         один запрос вместо «1 к КП + до 20 к TMDB», которых стоила бы целая
         страница подборки (ревью Task 17, C1). */
      function paintCollage(node, paths) {
        var box = $(node).find('.lumen-tile__collage');
        box.empty();
        var painted = 0;
        for (var i = 0; i < paths.length; i++) {
          var path = '' + paths[i];
          var url = path.indexOf('http') === 0 ? path : imageUrl(path, 'w342');
          if (!url) continue;
          var poster = $('<div class="lumen-tile__poster lumen-tile__poster--' + (painted + 1) + '"></div>');
          poster.css('background-image', 'url("' + url + '")');
          box.append(poster);
          painted++;
        }
        if (painted) $(node).addClass('lumen-tile--filled');
      }

      function loadCollage(item, node) {
        if (node.lumen_collage) return;
        node.lumen_collage = true;
        var captured = gen;
        /* Task 25: скелетон плитки. Класс .lumen-skeleton живёт ровно
           столько, сколько идёт запрос коллажа, и снимается в ОБЕИХ ветках
           ответа — иначе плитка пульсировала бы вечно после ошибки. Пульсируют
           только запрошенные плитки (первые COLLAGE_EAGER и те, что получили
           фокус); остальные стоят спокойными — на ТВ десятки анимаций разом
           стоят дороже, чем помогают. */
        function skeleton(on) {
          try {
            var box = $(node).find('.lumen-tile__collage');
            if (!box || !box.length) return;
            if (on) box.addClass('lumen-skeleton');
            else box.removeClass('lumen-skeleton');
          } catch (eSk) { }
        }
        skeleton(true);
        var handle = LC.sources.collagePaths(item, COLLAGE_SIZE, function (paths) {
          skeleton(false);
          if (gen !== captured) return;
          paintCollage(node, paths);
        }, function (err) {
          skeleton(false);
          if (gen !== captured) return;
          /* Неудача не должна оставлять плитку пустой навсегда: снимаем
             отметку, и коллаж перезапросится, когда плитка снова получит
             фокус. Единственная ошибка, о которой стоит сказать сразу, —
             подборка Кинопоиска без ключа API. */
          node.lumen_collage = false;
          if (err && err.nokey) $(node).addClass('lumen-tile--nokey');
        }, alive(captured));
        if (handle) handles.push(handle);
      }

      /* Коллажи видимых плиток: первые COLLAGE_EAGER (два ряда по четыре —
         столько видно без прокрутки), остальные по фокусу. */
      /* Текущий месяц для сезонного порядка и метки «Сезон» (Task 21).
         Читается через LC.themes — там же живёт хук даты, которым живая
         проверка подменяет декабрь, не трогая системные часы. */
      function month() {
        try {
          if (LC.themes && typeof LC.themes.month === 'function') return LC.themes.month();
        } catch (e) { }
        return 0;
      }

      function loadVisibleCollages() {
        var list = tilesFor(manifest, activeGroup, month());
        for (var i = 0; i < tileNodes.length && i < COLLAGE_EAGER; i++) {
          loadCollage(list[i], tileNodes[i]);
        }
      }

      function tileNode(item) {
        var group = null;
        var i;
        for (i = 0; manifest && manifest.groups && i < manifest.groups.length; i++) {
          if (manifest.groups[i].id === item.group) { group = manifest.groups[i]; break; }
        }
        var sub = item.badge || titleOf(group, lang());
        /* Task 21: подборка своего сезона поднята наверх — метка объясняет,
           почему она здесь. Рисуется тем же узлом, что и подсказка про ключ
           API, поэтому разметка плитки не усложняется. */
        var season = inSeason(item, month())
          ? '<div class="lumen-tile__season">' + esc(LC.lang('lumen_season_badge')) + '</div>'
          : '';
        var node = $(
          '<div class="lumen-tile selector">' +
            '<div class="lumen-tile__collage"></div>' +
            '<div class="lumen-tile__scrim"></div>' +
            season +
            '<div class="lumen-tile__text">' +
              '<div class="lumen-tile__title">' + esc(item.title) + '</div>' +
              '<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
            '</div>' +
            '<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
          '</div>'
        );
        node.on('hover:focus', function () {
          lastFocus = node[0];
          loadCollage(item, node[0]);
        });
        node.on('hover:enter', function () {
          openCollection(item);
        });
        return node[0];
      }

      function buildTiles(groupId) {
        /* Запросы снятой группы больше не нужны: их колбэки рисовали бы в
           узлы, выброшенные из DOM (ревью Task 17, I1). */
        bump();
        activeGroup = groupId;
        var list = tilesFor(manifest, groupId, month());
        tilesRow.empty();
        tileNodes = [];
        for (var i = 0; i < list.length; i++) {
          var node = tileNode(list[i]);
          tilesRow.append(node);
          tileNodes.push(node);
        }
        loadVisibleCollages();
        for (var c = 0; c < chipNodes.length; c++) {
          $(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
        }
      }

      function chipNode(group) {
        var node = $('<div class="lumen-chip selector">' + esc(group.title) + '<span class="lumen-chip__count">' + group.count + '</span></div>');
        node[0].lumen_group = group.id;
        node.on('hover:focus', function () { lastFocus = node[0]; });
        node.on('hover:enter', function () {
          if (activeGroup === group.id) return;
          buildTiles(group.id);
          recollect(node[0]);
        });
        return node[0];
      }

      /* Task 27: все подборки каталога с названиями на языке интерфейса —
         вход для поиска. Ищет LC.nav.searchCollections (src/64_nav.js),
         поэтому здесь только перевод названий; сама подборка едет в поле
         source, чтобы выбранную можно было открыть тем же openCollection,
         что и плитку. */
      function searchItems() {
        var list = (manifest && manifest.collections) || [];
        var code = lang();
        var out = [];
        for (var i = 0; i < list.length; i++) {
          out.push({ id: list[i].id, title: titleOf(list[i], code), source: list[i] });
        }
        return out;
      }

      /* Поиск по подборкам (Task 27 Step 4). Ввод и список найденного —
         штатные Lampa.Input и Lampa.Select (см. LC.nav.openSearch); здесь
         только данные экрана и возврат фокуса: закрывая клавиатуру, Lampa
         переводит контроллер на 'settings_component', и вернуть его нашему
         экрану должен тот, кто ввод открыл. */
      function openSearch() {
        if (!LC.nav || typeof LC.nav.openSearch !== 'function') return;
        LC.nav.openSearch({
          items: searchItems(),
          words: {
            title: LC.lang('lumen_hub_search_title'),
            results: LC.lang('lumen_hub_search_results'),
            empty: LC.lang('lumen_hub_search_empty')
          },
          onSelect: function (found) {
            if (found && found.source) openCollection(found.source);
          },
          onDone: function () {
            try { Lampa.Controller.toggle('content'); } catch (e) {
              warn('hub: search return failed', e);
            }
          }
        });
      }

      /* Шаг «вверх» с чипов — на кнопку поиска. Отдельным шагом, а не
         Navigator: кнопка стоит в правой части шапки, чипы — слева, и
         пространственная навигация между ними связи не видит. С самой кнопки
         «вверх» уже уходит в шапку Lampa (false). */
      function focusSearch() {
        var node = head.find('.lumen-hub__search')[0];
        if (!node) return false;
        /* Уже на ней — дальше вверх только шапка Lampa. Сверяемся с
           lastFocus, а не с классом .focus: его ставит Lampa, а обновляется
           lastFocus тем же событием hover:focus, которым Lampa этот класс и
           сопровождает. */
        if (lastFocus === node) return false;
        recollect(node);
        return true;
      }

      function buildHead() {
        var total = 0;
        for (var i = 0; i < groups.length; i++) total += groups[i].count;
        head.empty();
        head.append($('<div class="lumen-hub__title">' + esc(LC.lang('lumen_hub_title')) + '</div>'));
        head.append($('<div class="lumen-hub__count">' + total + ' ' + esc(LC.collectionsWord(total)) + '</div>'));
        /* Поиск по подборкам (design-spec-main §0.8): место в шапке держалось
           с Task 17 скрытым узлом, теперь это рабочая кнопка. */
        var search = $('<div class="lumen-hub__search selector">' + LC.icons.get('search') + '<span>' + esc(LC.lang('lumen_hub_search')) + '</span></div>');
        search.on('hover:focus', function () { lastFocus = search[0]; });
        search.on('hover:enter', function () { openSearch(); });
        head.append(search);
      }

      function build(m) {
        manifest = m;
        groups = groupsWithCounts(manifest, lang());
        buildHead();
        chipsRow.empty();
        chipNodes = [];
        for (var i = 0; i < groups.length; i++) {
          var node = chipNode(groups[i]);
          chipsRow.append(node);
          chipNodes.push(node);
        }
        if (groups.length) buildTiles(groups[0].id);
        else tilesRow.append($('<div class="lumen-hub__empty">' + esc(LC.lang('lumen_hub_empty')) + '</div>'));
        try { self.activity.loader(false); } catch (e) {}
        /* Активность могла уже стартовать (манифест грузится асинхронно,
           только если задан внешний URL) — тогда коллекцию надо пересобрать
           здесь: в start() плиток ещё не было. */
        if (started) recollect(null);
      }

      this.create = function () {
        motionClass(root);
        root.append(head);
        root.append(chipsRow);
        root.append(tilesRow);
        scroll.append(root);
        try { self.activity.loader(true); } catch (e) {}
        var captured = gen;
        LC.manifest.load(function (m) {
          if (gen !== captured) return;
          build(m);
        });
      };

      this.render = function (js) {
        return js ? scroll.render(true) : scroll.render();
      };

      this.start = function () {
        /* Тот же гард, что у штатных компонентов: 'start' приходит и той
           активности, что уже не на экране. */
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) {}
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        motionClass(root);
        Lampa.Controller.add('content', screenController(root, focusTarget, null, focusSearch));
        Lampa.Controller.toggle('content');
        /* Возврат после stop(): коллажи, которые тогда погасили (или которые
           не успели прийти), запрашиваются снова — в этот момент они уже в
           кэше TMDB/КП, поэтому возврат сетью не платит. */
        if (manifest) loadVisibleCollages();
      };

      this.pause = function () {};

      /* Lampa зовёт stop() при уходе вглубь и тут же снимает слайд из DOM
         (ActivitySlide.stop: component.stop() + slide.remove()), а destroy()
         наступает только при возврате или вытеснении по лимиту истории.
         Поэтому запросы гасятся здесь, а не только в destroy: иначе коллажи
         продолжали бы лететь и дорисовываться в снятый с экрана DOM ровно
         тогда, когда сеть нужна открытой карточке (ревью Task 17, I2).
         Экран при этом остаётся целым: start() вернёт слайд и коллажи. */
      this.stop = function () {
        started = false;
        bump();
        /* Погашенные коллажи помечаем как незагруженные — чтобы start()
           запросил их снова. Плитки, которые успели нарисоваться, остаются
           как есть: у них уже есть постеры. */
        for (var i = 0; i < tileNodes.length; i++) {
          if (!$(tileNodes[i]).hasClass('lumen-tile--filled')) tileNodes[i].lumen_collage = false;
        }
      };

      this.destroy = function () {
        bump();
        chipNodes = [];
        tileNodes = [];
        lastFocus = null;
        try { scroll.destroy(); } catch (e2) {}
        try { root.remove(); } catch (e3) {}
      };
    }

    /* ------------------------------------------------------------------ */
    /* Компонент lumen_grid — сетка одной подборки.                        */
    /* ------------------------------------------------------------------ */

    function GridComponent(object) {
      var self = this;
      var item = (object && object.lumen) || { id: 'unknown', title: (object && object.title) || '', sources: {} };
      var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
      var root = $('<div class="lumen-grid"></div>');
      var head = $('<div class="lumen-grid__head"></div>');
      var sortsRow = $('<div class="lumen-grid__sorts"></div>');
      var itemsRow = $('<div class="lumen-grid__items"></div>');
      var subtitle = $('<div class="lumen-grid__sub"></div>');

      var gen = 0;
      var handles = [];
      var sortMode = 'popular';
      var page = 1;
      var totalPages = 1;
      var totalResults = 0;
      var loading = false;
      /* Что грузится прямо сейчас — чтобы stop() мог прервать запрос, а
         start() возобновить его с того же места. */
      var pending = null;
      var resumeAfterStop = null;
      /* Сырые карточки всех загруженных страниц — из них пересобирается
         список при локальной сортировке, без повторного запроса. */
      var raw = [];
      var cardNodes = [];
      var sortNodes = [];
      var lastFocus = null;
      /* id карточки под фокусом: список могут пересобрать (сортировка на
         месте при догрузке страницы), и тогда прежний узел исчезает —
         фокус возвращается на ту же карточку, а не на первый чип. */
      var lastCardId = null;
      var started = false;

      function alive(captured) {
        return function () { return gen === captured; };
      }

      function clearHandles() {
        for (var i = 0; i < handles.length; i++) {
          try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
        }
        handles = [];
      }

      function bump() {
        gen++;
        clearHandles();
      }

      /* Узел для фокуса при входе в экран и после перестройки списка. */
      function focusTarget() {
        if (lastFocus && root[0] && root[0].contains && root[0].contains(lastFocus)) return lastFocus;
        if (lastCardId != null) {
          for (var i = 0; i < cardNodes.length; i++) {
            if (cardNodes[i].card_data && cardNodes[i].card_data.id === lastCardId) return cardNodes[i];
          }
        }
        return null;
      }

      function recollect(prefer) {
        try {
          Lampa.Controller.collectionSet(root[0]);
          var node = prefer || focusTarget();
          Lampa.Controller.collectionFocus(node || false, root[0]);
        } catch (e) {
          warn('grid: collection failed', e);
        }
      }

      /* Индекс карточки под фокусом или -1 (фокус на чипе сортировки). */
      function focusedIndex() {
        for (var i = 0; i < cardNodes.length; i++) {
          if (cardNodes[i] === lastFocus) return i;
        }
        return -1;
      }

      /* Постеры грузятся окном вокруг фокуса, а не все разом: страница — это
         20-40 карточек, и одновременная загрузка стольких картинок на ТВ
         заметна (ревью Task 17, I6). */
      function loadPosters(upTo) {
        for (var i = 0; i < cardNodes.length && i <= upTo; i++) {
          var node = cardNodes[i];
          if (!node.lumen_poster || node.lumen_posted) continue;
          node.lumen_posted = true;
          var img = node.querySelector ? node.querySelector('.card__img') : null;
          if (!img) continue;
          bindPoster(node, img, node.lumen_poster);
        }
      }

      function bindPoster(node, img, url) {
        img.onload = function () { $(node).addClass('card--loaded'); };
        img.onerror = function () { $(node).addClass('card--broken'); };
        img.src = url;
      }

      /* Догрузка следующей страницы и постеров — только от пульта: фокус
         ставится и программно (после каждой пришедшей страницы), и цепочка
         «страница пришла -> фокус -> догрузка» крутилась бы сама (живая
         проверка: сетка набирала 320 карточек за заход). */
      function afterMove() {
        var i = focusedIndex();
        if (i < 0) return;
        loadPosters(i + POSTER_AHEAD);
        if (i >= cardNodes.length - GRID_COLS) loadNext();
      }

      /* Карточка сетки — штатный шаблон Lampa ('card'), а не свой DOM: так
         сетка плагина показывает то же, что штатная (метки закладок и
         истории, рейтинг, качество, тип), и чинится вместе с Lampa. Сам
         Lampa.Card для этого не годится — он помечен deprecated и печатает
         console.warn на каждую карточку (app.min.js 51893), а новый
         внутренний класс карточки плагинам не отдан. Оформление задаёт наш
         CSS под корнем .lumen-grid (design-spec-main §0.4). */
      function cardNode(card) {
        var year = cardYear(card);
        var node = $(Lampa.Template.js('card', {
          title: card.title || card.name || '',
          release_year: year
        }));
        node.addClass('lumen-gcard');
        var el = node[0];
        el.card_data = card;
        if (!year) node.find('.card__age').remove();

        var view = node.find('.card__view');
        if (card.name) {
          node.addClass('card--tv');
          view.append($('<div class="card__type"></div>').text('TV'));
        }
        var vote = Number(card.vote_average) || 0;
        if (vote > 0) view.append($('<div class="card__vote"></div>').text(vote >= 10 ? 10 : vote.toFixed(1)));
        var quality = card.quality || card.release_quality;
        if (quality && !card.name) view.append($('<div class="card__quality"></div>').text(quality));

        markCard(node, card);
        el.lumen_poster = imageUrl(card.poster_path, 'w342');

        node.on('hover:focus', function () {
          lastFocus = el;
          lastCardId = card.id;
        });
        node.on('hover:enter', function () { openCard(card); });
        return el;
      }

      /* Метки закладок/истории и полоса продолжения — то же, что рисует
         Lampa на своих карточках (Favorite.check + Timeline). */
      function markCard(node, card) {
        var marks = ['look', 'viewed', 'scheduled', 'continued', 'thrown'];
        try {
          if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.check !== 'function') return;
          var status = Lampa.Favorite.check(card) || {};
          var icons = node.find('.card__icons-inner');
          var names = ['book', 'like', 'wath'];
          for (var i = 0; i < names.length; i++) {
            if (status[names[i]]) icons.append($('<div class="card__icon icon--' + names[i] + '"></div>'));
          }
          if (status.history) icons.append($('<div class="card__icon icon--history"></div>'));
          for (var m = 0; m < marks.length; m++) {
            if (!status[marks[m]]) continue;
            var text = marks[m];
            try { text = Lampa.Lang.translate('title_' + marks[m]); } catch (eLang) {}
            node.find('.card__view').append($('<div class="card__marker card__marker--' + marks[m] + '"><span></span></div>').find('span').text(text).end());
            break;
          }
        } catch (e) {
          warn('grid: card marks failed', e);
        }
        progressBar(node, card);
        /* Task 25: метка «Скоро»/«Новинка»/«Продолжить» — тем же модулем,
           что на главной. bar:false — полосу прогресса здесь уже нарисовал
           progressBar выше, вторая такая же на том же постере была бы дублем. */
        try {
          if (LC.badges && LC.badges.decorate) LC.badges.decorate(node, card, { bar: false });
        } catch (eBadge) {
          warn('grid: badge failed', eBadge);
        }
      }

      function progressBar(node, card) {
        try {
          if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return;
          if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return;
          var key = card.original_title || card.original_name || card.title || card.name || '';
          if (!key) return;
          var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
          var percent = view ? (Number(view.percent) || 0) : 0;
          if (percent <= 0 || percent >= 100) return;
          var bar = $('<div class="lumen-gcard__bar"><div></div></div>');
          bar.find('div').css('width', percent + '%');
          node.find('.card__view').append(bar);
        } catch (e) {
          warn('grid: progress failed', e);
        }
      }

      function appendCards(list) {
        for (var i = 0; i < list.length; i++) {
          var node = cardNode(list[i]);
          itemsRow.append(node);
          cardNodes.push(node);
        }
      }

      function renderSub() {
        var mode = null;
        var modes = sortModes();
        for (var i = 0; i < modes.length; i++) if (modes[i].id === sortMode) mode = modes[i];
        var parts = [];
        if (totalResults) parts.push(LC.lang('lumen_grid_total') + ' ' + totalResults);
        if (mode) parts.push(LC.lang(mode.key));
        subtitle.html(esc(parts.join(' · ')));
      }

      function showEmpty(reason) {
        itemsRow.empty();
        cardNodes = [];
        /* Task 20: подсказку про ключ Кинопоиска можно выключить — тогда
           сетка говорит просто «Здесь пока пусто», как любая другая пустая. */
        var nokey = reason === 'nokey' && kpHintEnabled();
        var text = nokey ? LC.lang('lumen_hub_nokey_text') : LC.lang('lumen_hub_empty');
        var box = $('<div class="lumen-grid__empty"><div class="lumen-grid__empty-text">' + esc(text) + '</div></div>');
        if (nokey) {
          /* Строка 'false': Storage.set с JS-false не сохраняется (план 0.2).
             Запись поднимает listener 'change' → LC.applyKpHintPref
             пересобирает эту сетку уже без подсказки. */
          var hide = $('<div class="lumen-grid__back lumen-grid__hide selector">' + esc(LC.lang('lumen_kp_hint_hide')) + '</div>');
          hide.on('hover:focus', function () { lastFocus = hide[0]; });
          hide.on('hover:enter', function () {
            try { Lampa.Storage.set('lumen_kp_hint', 'false'); } catch (e) {}
          });
          box.append(hide);
        }
        var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
        back.on('hover:focus', function () { lastFocus = back[0]; });
        back.on('hover:enter', function () { Lampa.Activity.backward(); });
        box.append(back);
        itemsRow.append(box);
      }

      /* Пересобрать список из накопленных страниц в текущем порядке. */
      function rebuild() {
        itemsRow.empty();
        cardNodes = [];
        appendCards(sortLocal(raw, sortMode));
        loadPosters(POSTER_AHEAD);
        renderSub();
        if (started) recollect(null);
      }

      /* Одна страница подборки. reset — начать список заново (первая
         загрузка и смена сортировки у discover-подборок). */
      function loadPage(nextPage, reset) {
        if (loading) return;
        loading = true;
        pending = { page: nextPage, reset: reset };
        try { self.activity.loader(true); } catch (e) {}
        var captured = gen;
        var request = needsLocalSort(item) ? item : applySort(item, sortMode);
        var handle = LC.sources['fetch'](request, nextPage, function (json) {
          if (gen !== captured) return;
          loading = false;
          pending = null;
          try { self.activity.loader(false); } catch (e2) {}
          page = json.page || nextPage;
          totalPages = json.total_pages || 1;
          totalResults = json.total_results || (json.results || []).length;
          if (reset) raw = [];
          raw = raw.concat(json.results || []);
          /* Коллекция, список TMDB и Кинопоиск приходят в своём порядке —
             его задаёт сортировка на месте, и при догрузке страницы список
             приходится пересобирать целиком. Кинопоиск, в отличие от
             коллекции, многостраничный (total_pages из ответа КП), так что
             ветка рабочая, а не теоретическая. */
          var localSort = needsLocalSort(item);
          var list = localSort ? sortLocal(raw, sortMode) : (json.results || []);
          if (reset || localSort) {
            itemsRow.empty();
            cardNodes = [];
          }
          if (!list.length && !cardNodes.length) showEmpty('');
          else appendCards(list);
          var from = focusedIndex();
          loadPosters((from < 0 ? 0 : from) + POSTER_AHEAD);
          renderSub();
          if (started) recollect(null);
        }, function (err) {
          if (gen !== captured) return;
          loading = false;
          pending = null;
          try { self.activity.loader(false); } catch (e3) {}
          if (!cardNodes.length) showEmpty(err && err.nokey ? 'nokey' : '');
          renderSub();
          if (started) recollect(null);
        }, alive(captured));
        if (handle) handles.push(handle);
      }

      function loadNext() {
        if (loading) return;
        if (!hasMore({ page: page, total_pages: totalPages })) return;
        loadPage(page + 1, false);
      }

      function highlightSort() {
        for (var i = 0; i < sortNodes.length; i++) {
          $(sortNodes[i]).toggleClass('lumen-chip--on', sortNodes[i].lumen_sort === sortMode);
        }
      }

      function sortNode(mode) {
        var node = $('<div class="lumen-chip selector">' + esc(LC.lang(mode.key)) + '</div>');
        node[0].lumen_sort = mode.id;
        node.on('hover:focus', function () { lastFocus = node[0]; });
        node.on('hover:enter', function () {
          if (sortMode === mode.id) return;
          /* Первая загрузка ещё идёт, а фокус по умолчанию стоит именно на
             чипах — без отмены подсветка и подпись говорили бы «По рейтингу»,
             а карточки пришли бы в прежнем порядке, и повторное нажатие
             блокировал бы гард выше (ревью Task 17, C2). */
          if (loading) {
            bump();
            loading = false;
            pending = null;
            try { self.activity.loader(false); } catch (eL) {}
          }
          sortMode = mode.id;
          highlightSort();
          /* Коллекция, список TMDB и Кинопоиск уже загружены целиком —
             их достаточно переставить на месте, в сеть за тем же ответом не
             ходим. Для discover порядок задаёт TMDB, там нужен новый запрос
             с первой страницы. */
          if (needsLocalSort(item) && raw.length) {
            rebuild();
            recollect(node[0]);
            return;
          }
          page = 1;
          loadPage(1, true);
          recollect(node[0]);
        });
        return node[0];
      }

      this.create = function () {
        motionClass(root);
        head.append($('<div class="lumen-grid__title">' + esc(item.title || '') + '</div>'));
        head.append(subtitle);
        root.append(head);
        var modes = sortModes();
        for (var i = 0; i < modes.length; i++) {
          var node = sortNode(modes[i]);
          sortsRow.append(node);
          sortNodes.push(node);
        }
        highlightSort();
        root.append(sortsRow);
        root.append(itemsRow);
        scroll.append(root);
        loadPage(1, true);
      };

      this.render = function (js) {
        return js ? scroll.render(true) : scroll.render();
      };

      this.start = function () {
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) {}
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        motionClass(root);
        Lampa.Controller.add('content', screenController(root, focusTarget, afterMove));
        Lampa.Controller.toggle('content');
        /* Запрос, прерванный на stop(), возобновляется с той же страницы. */
        if (resumeAfterStop) {
          var again = resumeAfterStop;
          resumeAfterStop = null;
          loadPage(again.page, again.reset);
        }
      };

      this.pause = function () {};

      /* Уход вглубь: Lampa снимает слайд из DOM (ActivitySlide.stop), но
         компонент жив и вернётся по start(). Незавершённую страницу гасим —
         она дорисовывалась бы в снятый экран и занимала сеть, нужную
         карточке (ревью Task 17, I2), — и запоминаем, чтобы догрузить при
         возврате. */
      this.stop = function () {
        started = false;
        resumeAfterStop = loading ? pending : null;
        bump();
        loading = false;
        pending = null;
      };

      this.destroy = function () {
        bump();
        cardNodes = [];
        sortNodes = [];
        lastFocus = null;
        resumeAfterStop = null;
        try { scroll.destroy(); } catch (e2) {}
        try { root.remove(); } catch (e3) {}
      };
    }

    /* ------------------------------------------------------------------ */
    /* Пункт меню и регистрация компонентов.                               */
    /* ------------------------------------------------------------------ */

    var components_added = false;
    var menu_node = null;

    function addComponents() {
      if (components_added) return;
      if (!window.Lampa || !Lampa.Component || typeof Lampa.Component.add !== 'function') return;
      Lampa.Component.add('lumen_hub', HubComponent);
      Lampa.Component.add('lumen_grid', GridComponent);
      components_added = true;
    }

    /* Пункт меню один: перед добавлением проверяется и своя ссылка, и DOM
       (другой экземпляр плагина мог добавить свой пункт до нас). */
    function addMenu() {
      try {
        if (menu_node && menu_node.length && menu_node.closest('body').length) return;
        if ($('.lumen-menu-hub').length) return;
        if (!Lampa.Menu || typeof Lampa.Menu.addButton !== 'function') return;
        var node = Lampa.Menu.addButton(LC.icons.get('list'), LC.lang('lumen_hub_title'), function () {
          Lampa.Activity.push({
            url: '',
            title: LC.lang('lumen_hub_title'),
            component: 'lumen_hub',
            page: 1
          });
        });
        if (node && node.addClass) node.addClass('lumen-menu-hub');
        menu_node = node;
      } catch (e) {
        warn('hub: menu button failed', e);
      }
    }

    function install() {
      try {
        addComponents();
        addMenu();
      } catch (e) {
        warn('hub: install failed', e);
      }
    }

    /* Плагин выключили: пункт меню снимаем. Зарегистрированные компоненты
       остаются в реестре Lampa (Component.add обратной операции не имеет),
       но попасть в них больше неоткуда — пункта меню нет, а плитки и кнопка
       «Франшиза» живут только внутри наших же экранов и карточки. */
    function uninstall() {
      try {
        if (menu_node && menu_node.remove) menu_node.remove();
      } catch (e) {
        warn('hub: menu remove failed', e);
      }
      menu_node = null;
      try { $('.lumen-menu-hub').remove(); } catch (e2) {}
    }

    function menuNode() {
      return menu_node;
    }

    /* ------------------------------------------------------------------ */
    /* Кнопка «Франшиза» в карточке.                                        */
    /*                                                                      */
    /* Разметка кнопок Lampa НЕ трогается: Lampa хэширует outerHTML каждой  */
    /* кнопки в .buttons--container, сверяя с Storage 'full_btn_priority'    */
    /* (план фазы 1, 0.2 «Кнопки и хэш приоритета»). Наш узел — сосед ряда   */
    /* кнопок внутри .lumen-actions, ровно как кнопка «Стоп» режима          */
    /* трейлера (src/55_trailer.js addStop).                                 */
    /* ------------------------------------------------------------------ */

    function franchise(root, movie) {
      try {
        if (!root || !root.length) return;
        var old = root.find('.lumen-franchise');
        if (old.length) old.remove();
        root.removeClass('lumen-card--franchise');
        var collection = movie && movie.belongs_to_collection;
        var item = franchiseItem(collection);
        if (!item) return;
        var row = root.find('.full-start-new__buttons');
        if (!row.length) return;
        var btn = $('<div class="lumen-franchise selector">' +
          '<div class="lumen-franchise__ico"></div>' +
          '<span>' + esc(LC.lang('lumen_card_franchise')) + '</span>' +
          '</div>');
        btn.on('hover:enter', function () {
          openCollection(item);
        });
        row.parent().append(btn);
        /* Класс на корне включает раскладку .lumen-actions в строку — без
           него кнопка встала бы под рядом кнопок (обычный блочный поток). */
        root.addClass('lumen-card--franchise');
      } catch (e) {
        warn('hub: franchise button failed', e);
      }
    }

    return {
      titleOf: titleOf,
      groupsWithCounts: groupsWithCounts,
      tilesFor: tilesFor,
      inSeason: inSeason,
      openTarget: openTarget,
      franchiseItem: franchiseItem,
      sortModes: sortModes,
      applySort: applySort,
      sortLocal: sortLocal,
      needsLocalSort: needsLocalSort,
      collage: collage,
      cardMedia: cardMedia,
      hasMore: hasMore,
      install: install,
      uninstall: uninstall,
      menuNode: menuNode,
      franchise: franchise
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hub;

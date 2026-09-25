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
  /*   needsLocalSort(item) / cardMedia(card)                              */
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

    /* Task 41: сколько плиток ВПЕРЁД от фокуса получают кадр. Считается так
       же, как окно постеров сетки (POSTER_AHEAD выше), но короче: плитки
       идут по четыре в ряд, и восемь вперёд — это два ряда, тогда как у
       сетки шесть в ряд и 14 закрывают чуть больше двух.
       Цена одной плитки — одна картинка и один запрос: для discover это
       первая страница подборки (кэш 12 ч), для Кинопоиска —
       LC.sources.bannerPath берёт картинку прямо из ответа КП, не
       сопоставляя фильмы с TMDB (кэш 30 дней). */
    var BANNER_AHEAD = 8;

    /* Task 68: ширины, по которым выбирается размер картинки, считаются той
       же цепочкой, которой их считает раскладка, а не двумя прибитыми
       числами (было TILE_EM = 18.98 и GCARD_EM = 12.36).

       Прежние константы выводились из литерала 84.17 — «экран шириной
       84.17 базовых em», — и из поля 2.81em по краям. К Task 68 неверны
       были оба слагаемых: поле давно EDGE = 3.51em (src/30_css.js, Task 63),
       а 84.17 em в экране набирается только при «обычном» размере
       интерфейса Lampa и только при масштабе плагина 1 (сам масштаб делает
       em дороже, и ширин в em становится МЕНЬШЕ, а не больше — прежняя
       формула ошибалась ещё и знаком). Замер 2026-09-22 на живом стенде,
       24 клетки (960 CSS px при DPR 2 и 1920 при DPR 1 × 3 размера
       интерфейса × 4 масштаба): расхождение с DOM от −19.4 % (интерфейс
       «мельче» + масштаб «мельче») до +32.9 % («крупнее» + «огромный»), из
       них 7.8 % на «крупнее» при штатном масштабе. В минус это давало
       видимое мыло: при 1920 CSS px и DPR 1 на «мельче»+«мельче» плитка
       шириной 435 физических пикселей получала с TMDB w780 только по новой
       формуле, а по старой — w300, то есть растяжение в 1.45 раза.

       Обе формулы — это буквально calc из правил .lumen-tile и .lumen-gcard
       (src/30_css.js), переписанный в em корня экрана: ширина контейнера
       минус поля по краям, минус зазоры, делённое на число колонок.
       Метрику отдаёт сам src/30_css.js (LC.hubEm) — второй копии чисел нет.

       Разница у сетки: .lumen-gcard — это ШТАТНАЯ карточка Lampa (шаблон
       'card', см. cardNode ниже), а на «крупнее» у Lampa действует
       @media screen and (min-width:767px){body.size--bigger .card{font-size:
       1.14em}} (vendor/lampa/css/app.css:3525-3528). Проценты ширины от
       этого не зависят, а вот вычитаемые зазоры в em — зависят: они
       отсчитываются от кегля САМОЙ карточки. Поэтому у gcardEm зазор
       домножен на lampaCardK, а у плитки (она не .card) — нет. Живая
       сверка: при 1920 CSS px, «крупнее», масштаб «обычный» DOM даёт
       11.3543em, формула с множителем — 11.3543em, без множителя — 11.457em
       (ошибка 0.9 %). */
    function tileEm() {
      var m = LC.hubEm;
      return (LC.util.emScreen() - 2 * m.edge - m.gap * (m.tileCols - 1)) / m.tileCols;
    }

    function gcardEm() {
      var m = LC.hubEm;
      var gap = m.gap * (m.gcardCols - 1) * LC.util.lampaCardK();
      return (LC.util.emScreen() - 2 * m.edge - gap) / m.gcardCols;
    }

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

    /* Правка 2026-09-23 (долг Task 23): каким медиа рулетка откроет эту
       подборку уже отмеченной, или null — тогда кнопки «Крутить по этой
       подборке» в сетке нет.
       Условие — подборка есть среди чипов рулетки для этого медиа
       (LC.roulette.collectionsFor по текущему каталогу). Иначе рулетка
       получила бы preselect, которого нет в её списке, и молча крутила бы
       набор главной (sourcesFor: «выбраны неизвестные id — набор
       главной»), а кнопка обещает ровно эту подборку. Так отсекаются
       «Франшиза» из карточки (franchiseItem — подборка-однодневка с id
       col-NNN, в каталоге её нет) и подборки, которых нет в загруженном
       каталоге. Фильмы — первыми, как и пункт меню; сериалы — если
       фильмового источника у подборки нет. */
    function rouletteMedia(item, manifest) {
      if (!item || !item.id) return null;
      if (!LC.roulette || typeof LC.roulette.collectionsFor !== 'function' || typeof LC.roulette.open !== 'function') return null;
      if (manifest === undefined) {
        try { manifest = LC.manifest && LC.manifest.get ? LC.manifest.get() : null; } catch (e) { manifest = null; }
      }
      var order = ['movie', 'tv'];
      for (var m = 0; m < order.length; m++) {
        var list = LC.roulette.collectionsFor(manifest, order[m]);
        for (var i = 0; i < list.length; i++) {
          if (list[i] && list[i].id === item.id) return order[m];
        }
      }
      return null;
    }

    /* Куда открывать подборку: штатная сетка Lampa, если она это умеет,
       иначе свой компонент. Возвращает объект для Lampa.Activity.push.
       Полное ревью, C4: title — на языке интерфейса (titleOf), как у чипов
       и поиска. */
    function openTarget(item) {
      var media = singleDiscover(item);
      if (media) {
        return {
          url: LC.sources.discoverUrl(item.sources[media], media),
          title: titleOf(item, lang()),
          component: 'category_full',
          source: 'tmdb',
          page: 1
        };
      }
      return { url: '', title: titleOf(item, lang()), component: 'lumen_grid', lumen: item, page: 1 };
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

    /* Полное ревью, D1: свой фон экрана — класс на активности (её узел —
       activity.render(), app.min.js:45547), правило в наборе подкраски
       (src/30_css.js, .lumen-screen), как у главной. Без него под хабом и
       сеткой был серый размытый фон Lampa, и приглушённый текст читался на
       1.45–3.5:1. */
    function screenBg(activity) {
      try {
        var node = activity && typeof activity.render === 'function' ? activity.render() : null;
        if (node && typeof node.addClass === 'function') node.addClass('lumen-screen');
      } catch (e) { }
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
    /* canmove(dir) вернул пусто — двигаться внутри экрана некуда, и        */
    /* контроллер решает сам: влево — меню, вверх — шапка.                  */
    /* Фокус синхронно шлёт элементу 'hover:focus' (Navigator шлёт своё     */
    /* 'focus' -> Controller.focus -> Utils.trigger, app.min.js:46437),     */
    /* поэтому сразу после шага наши обработчики фокуса уже отработали.     */
    /* ------------------------------------------------------------------ */

    /* Task 33: один проход навигации на нажатие вместо двух. canmove
       (navigator.js:762-770) не boolean — он возвращает сам найденный узел,
       и отдать его Navigator.focus дешевле, чем звать move: move
       (navigator.js:732-760) ищет соседа заново тем же navigate
       (navigator.js:786), а тот берёт getBoundingClientRect у КАЖДОГО узла
       коллекции (_getAllRects navigator.js:268 -> _getRect :217).
       Navigator.focus (navigator.js:657-686) публичный и делает ровно то,
       чем заканчивается move: пишет _focus и шлёт своё событие 'focus', на
       которое подписан Lampa (app.min.js:56069) — Controller.focus шлёт узлу
       'hover:focus', а на ТВ ещё и переносит на него класс focus
       (app.min.js:46437-46446).
       Ветка с move — страховка для сборок Lampa без Navigator.focus. */
    function navMove(dir) {
      try {
        if (!window.Navigator || typeof Navigator.canmove !== 'function') return false;
        var next = Navigator.canmove(dir);
        if (!next) return false;
        if (typeof Navigator.focus === 'function') Navigator.focus(next);
        else Navigator.move(dir);
        return true;
      } catch (e) {
        warn('hub: navigator failed', e);
      }
      return false;
    }

    /* Task 33: окно коллекции Navigator — то же, что делает штатная сетка
       category_full (app.min.js:53146-53162, метод limit): limit_view = 12
       узлов вокруг фокуса рисуются, lilit_collection = 36 участвуют в
       навигации.
       Окно навигации — ради него всё: каждый лишний узел коллекции стоит
       одного getBoundingClientRect на КАЖДОЕ нажатие (navigate
       navigator.js:786 -> _getAllRects :268 -> _getRect :217), а в сетке
       после нескольких догруженных страниц узлов набираются сотни.
       Класс layer--render ставится ради того же контракта, что у штатной
       сетки, но экономии сам по себе не даёт: во всей сборке Lampa 3.3.4
       его упоминают только шаблоны (app.min.js:2508-2722) и та же limit
       (app.min.js:53152-53154), а в vendor/lampa/css/app.css правил под
       него нет — то есть это совместимость с темами, читающими класс. На
       карточках сетки класс штатный, он приходит из шаблона 'card'
       (app.min.js:2510), а на плитках хаба .lumen-tile появляется впервые:
       разметка наша, и раньше его там не было. Вида это не меняет — правил
       под него нет ни в нашем CSS, ни в CSS Lampa.
       fixed — узлы, которые в коллекции всегда (чипы, кнопки шапки): они
       лежат вне окна карточек, но обязаны оставаться достижимыми.

       Работа делается только тогда, когда окно реально сдвинулось. Штатная
       Lampa зовёт limit() не на нажатие, а на прокрутку (app.min.js:53172,
       scroll.onScroll = this.limit.bind(this)), у нас же вызов на каждый
       шаг фокуса — и без этого хаб платил бы за пустую пересборку: при 34
       плитках окно ±36 не режет ничего, а setCollection -> multiAdd -> add
       (navigator.js:584-603) стоит indexOf по растущей коллекции на каждый
       узел, то есть O(n²). Замер координатора: медиана нажатия в хабе
       выросла с 1.2 до 1.6 мс.
       Кэш держится на самих списках: везде, где список пересобирают
       (rebuild, showEmpty, buildTiles, loadPage), заводится НОВЫЙ массив, а
       догрузка страницы пишет в прежний, меняя длину, — поэтому сверки
       «та же ссылка и та же длина» хватает, и отдельный сброс в каждом из
       этих мест не нужен (тест «перестройка списка кэш не обманывает»). */
    var VIEW_WINDOW = 12;
    var NAV_WINDOW = 36;

    /* Последнее выставленное окно: список, его длина и границы обоих окон. */
    var lastNodes = null;
    var lastLen = -1;
    var lastViewFrom = -1;
    var lastViewTo = -1;
    var lastNavFrom = -1;
    var lastNavTo = -1;

    function limitCollection(fixed, nodes, active) {
      try {
        var from = active > 0 ? active : 0;
        var len = nodes.length;
        var viewFrom = Math.max(0, from - VIEW_WINDOW);
        var viewTo = Math.min(len, from + VIEW_WINDOW);
        var navFrom = Math.max(0, from - NAV_WINDOW);
        var navTo = Math.min(len, from + NAV_WINDOW);
        var known = nodes === lastNodes && len === lastLen;
        var i;

        /* layer--render: трогаем только тех, кто вышел из окна просмотра, и
           тех, кто в него вошёл. Проход по всему списку стоил бы на сетке
           три сотни обращений к classList на нажатие — ради класса, который
           сам по себе ничего не решает (см. выше).
           classList.toggle со вторым аргументом старые WebView не знают,
           поэтому явные add/remove. */
        if (!known) {
          for (i = 0; i < len; i++) {
            if (i >= viewFrom && i < viewTo) nodes[i].classList.add('layer--render');
            else nodes[i].classList.remove('layer--render');
          }
        } else if (viewFrom !== lastViewFrom || viewTo !== lastViewTo) {
          for (i = lastViewFrom; i < lastViewTo; i++) {
            if (i < viewFrom || i >= viewTo) nodes[i].classList.remove('layer--render');
          }
          for (i = viewFrom; i < viewTo; i++) {
            if (i < lastViewFrom || i >= lastViewTo) nodes[i].classList.add('layer--render');
          }
        }
        lastNodes = nodes;
        lastLen = len;
        lastViewFrom = viewFrom;
        lastViewTo = viewTo;

        if (!window.Navigator || typeof Navigator.setCollection !== 'function') return;
        /* Окно навигации не сдвинулось — у Navigator уже ровно та коллекция,
           которая нужна, и пересобирать нечего. Так живёт хаб: границы там
           упираются в концы короткого списка и не меняются никогда. */
        if (known && navFrom === lastNavFrom && navTo === lastNavTo) return;
        lastNavFrom = navFrom;
        lastNavTo = navTo;

        var keep = typeof Navigator.getFocusedElement === 'function' ? Navigator.getFocusedElement() : null;
        var collection = fixed.concat(nodes.slice(navFrom, navTo));
        /* Узел под фокусом возвращаем в коллекцию всегда, даже если окно до
           него не достаёт. Иначе _focus остался бы пустым, а класс .focus на
           узле — на месте (снимает его только clearSelects, которого мы
           больше не зовём): экран выглядел бы живым, а пульт бы умер —
           canmove без _focus отдаёт false (navigator.js:762-763). Второй
           вариант, «перевести фокус на первый узел коллекции», хуже: он
           телепортирует пользователя и шлёт узлу hover:focus, а на том висят
           подкрутка экрана и догрузка. */
        if (keep && collection.indexOf(keep) < 0) collection.push(keep);
        Navigator.setCollection(collection);
        /* setCollection снимает фокус (navigator.js:568-574 -> unfocus), а
           узел под фокусом здесь не менялся и события фокуса не нужны:
           возвращаем _focus тем же способом, что и штатная limit, —
           Navigator.focused (navigator.js:640-642) пишет его напрямую. */
        if (keep && typeof Navigator.focused === 'function') Navigator.focused(keep);
      } catch (e) {
        warn('hub: collection window failed', e);
      }
    }

    /* Контроллер экрана плагина. recollect(prefer) пересобирает коллекцию
       Navigator и ставит фокус — им же экран входит в контроллер; afterMove
       вызывается после каждого успешного шага.
       Task 33: после КАЖДОГО, а не только вправо/вниз, — по нему компонент
       сдвигает окно коллекции (limitCollection), и шаг влево или вверх
       обязан двигать окно так же, как вправо и вниз: иначе, уйдя вниз на
       сотню карточек, обратно вверх можно было бы подняться только до
       нижней кромки окна. Сетка на том же вызове догружает постеры и
       следующую страницу — от лишних направлений это не страдает, оба
       действия смотрят на позицию фокуса, а не на сторону шага. */
    /* onUp — запасной шаг вверх, когда Navigator дальше идти не может.
       Нужен хабу: кнопка поиска стоит в правой части шапки (design-spec-main
       §0.8), а чипы групп — слева, и SpatialNavigator её «вверх» не находит
       (проверено живьём 2026-09-17: canmove('up') с чипа === false, фокус
       уходил прямо в шапку Lampa). Вернул true — шаг сделан, в шапку Lampa
       не уходим. */
    /* Правка 2026-09-23 (найдено живой проверкой входа в рулетку из
       сетки): кэш окна выше помнит, ЧТО мы отдали Navigator, но не знает,
       что коллекцию с тех пор мог сменить кто-то другой. А это происходит
       при каждом возврате на экран: карточка фильма, рулетка, штатная
       сетка, шапка Lampa ставят Navigator свою коллекцию, и на обратном
       пути Controller.toggle('content') зовёт наш toggle с тем же списком
       узлов — кэш видит «ничего не сдвинулось», setCollection пропускается,
       а collectionFocus на узел не из коллекции молча ничего не делает
       (navigator.js:674). Замер на стенде 960×540@2: после «Назад» из
       рулетки в сетку «Матрицы» Navigator._collection пустая, узла под
       фокусом нет, пульт мёртв; то же — хаб после «Назад» из сетки и после
       «вниз» из шапки Lampa. Лечится там, где коллекция и переходит к нам:
       toggle — ровно момент, когда Lampa отдаёт экрану управление, — и
       кэш на нём забывается. Шагов фокуса внутри экрана это не касается:
       они идут через afterMove, и кэш там по-прежнему экономит пересборку. */
    function forgetWindow() {
      lastNodes = null;
      lastLen = -1;
      lastViewFrom = -1;
      lastViewTo = -1;
      lastNavFrom = -1;
      lastNavTo = -1;
    }

    /* Полное ревью, C7: экран ушёл (stop/destroy) — окно забывается, если
       оно его: иначе модульный кэш держал бы узлы сетки (с постерами) до
       следующего экрана плагина. Чужое окно — экрана, на который уже
       вернулись (destroy приходит через 200 мс после «Назад»), — не
       трогаем: его экономия пересборки живёт дальше. */
    function forgetWindowOf(nodes) {
      if (lastNodes && lastNodes === nodes) forgetWindow();
    }

    /* Полное ревью, C1: пульт сейчас у экрана activity — он вершина
       истории, и контроллер — 'content'. Сверка для всех ОТЛОЖЕННЫХ
       recollect (каталог хаба, страница сетки): открыли карточку (сетке
       зовётся pause(), stop() — только под следующим экраном), ушли в меню
       или шапку (смена контроллера, pause() не зовётся), нажали «Назад»
       (destroy — через 200 мс) — и пришедший ответ ставил Navigator
       коллекцию скрытого экрана: на стенде коллекция из 75 узлов сетки при
       контроллере full_start, OK открывал другой фильм. Не наш пульт —
       коллекцию не трогаем: её поставит toggle('content') на возврате. */
    function ownsRemote(activity) {
      try {
        var act = Lampa.Activity.active();
        if (act && act.activity && act.activity !== activity) return false;
      } catch (eAct) { }
      try {
        var ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (ctl && ctl.name !== 'content') return false;
      } catch (eCtl) { }
      return true;
    }

    /* Последний узел списка, верх которого выше нижней кромки экрана, или
       -1. Карточки сетки идут рядами сверху вниз в порядке списка, поэтому
       хватает бинарного поиска — getBoundingClientRect у ~7 узлов из сотни,
       а не у всех. Узел без высоты — экран не в документе: видимых нет. */
    function lastInView(nodes) {
      var bottom = window.innerHeight || 0;
      var lo = 0;
      var hi = nodes.length - 1;
      var found = -1;
      if (hi < 0 || typeof nodes[0].getBoundingClientRect !== 'function') return -1;
      if (!nodes[0].getBoundingClientRect().height) return -1;
      while (lo <= hi) {
        var mid = (lo + hi) >> 1;
        if (nodes[mid].getBoundingClientRect().top < bottom) { found = mid; lo = mid + 1; }
        else hi = mid - 1;
      }
      return found;
    }

    /* Полное ревью, C2: экран ТВ по мерке Lampa (Platform.screen,
       app.min.js:32740). На телефоне и планшете портретом штатные экраны
       фокус на возврате не ставят вовсе (category_full: restorePosition, и
       items[active].toggle() только на ТВ, app.min.js:35096). Без Platform
       (тесты, старые сборки) — ТВ. */
    function tvScreen() {
      try {
        if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') return Lampa.Platform.screen('tv') !== false;
      } catch (e) { }
      return true;
    }

    /* enter — вход экрана в пульт (toggle): Lampa отдала управление — при
       старте, с карточки, из меню карточки, из поиска, из меню и шапки. */
    function screenController(enter, afterMove, onUp) {
      return {
        toggle: function () {
          forgetWindow();
          enter();
        },
        left: function () {
          if (!navMove('left')) Lampa.Controller.toggle('menu');
          else if (afterMove) afterMove();
        },
        right: function () {
          if (navMove('right') && afterMove) afterMove();
        },
        up: function () {
          if (navMove('up')) {
            if (afterMove) afterMove();
            return;
          }
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
      var searchNode = null;
      /* Кнопка входа в рулетку в шапке хаба (правка 2026-09-23, долг
         Task 23 — docs/plans/2026-09-15-lumen-phase3-features.md:148). */
      var rouletteNode = null;
      var lastFocus = null;
      var started = false;
      /* Полное ревью, C2 — то же, что у сетки: последний ввод не пульт
         (наведение мышью, прокрутка колесом или пальцем); сбрасывает шаг
         пульта (afterMove). Пока он стоит, возврат на экран ставит фокус
         тихо (quiet) — экран остаётся там, где его оставили. */
      var byMouse = false;
      var quiet = false;
      var remoteScroll = false;

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

      /* Task 33: окно коллекции вокруг узла target. Кнопка поиска и чипы
         групп идут в коллекцию всегда: они вне окна плиток, а «вверх» с
         любой плитки обязано на них попадать.
         В самой большой группе каталога 47 плиток (manifest.json,
         themes), так что окно навигации хабу сегодня почти ничего не
         режет — отдельной ветки «хабу полную коллекцию» здесь нет потому,
         что каталог растёт, а хаб и сетка ходят одним контроллером. */
      function limitHub(target) {
        var active = -1;
        for (var i = 0; i < tileNodes.length; i++) {
          if (tileNodes[i] === target) { active = i; break; }
        }
        var fixed = [];
        if (searchNode) fixed.push(searchNode);
        if (rouletteNode) fixed.push(rouletteNode);
        limitCollection(fixed.concat(chipNodes), tileNodes, active);
      }

      /* Коллекцию выставляем сами, а не Controller.collectionSet: тот отдал
         бы Navigator все .selector узла разом (app.min.js:46448-46456).
         Controller.collectionFocus поверх окна работает штатно — узлу он
         зовёт Navigator.focus (app.min.js:46474-46491), а тот требует, чтобы
         элемент лежал в коллекции (navigator.js:674); окно потому и
         строится ВОКРУГ того узла, на который сейчас встанет фокус. */
      function recollect(prefer, still) {
        try {
          var node = prefer || focusTarget();
          limitHub(node);
          quiet = !!still;
          Lampa.Controller.collectionFocus(node || false, root[0]);
        } catch (e) {
          warn('hub: collection failed', e);
        }
        quiet = false;
      }

      /* C2: вход в пульт. Прокрутка восстанавливается, как у штатных
         экранов (на ТВ restorePosition ничего не делает); на не-ТВ экране
         фокус не ставится вовсе, на ТВ — тихо, если последний ввод был не
         пультом: иначе программный 'hover:focus' подкручивал экран к
         lastFocus — на таче это первый чип, и хаб прыгал в начало. */
      function enter() {
        try { scroll.restorePosition(); } catch (e) { }
        if (!tvScreen()) return;
        recollect(null, byMouse);
      }

      /* Шаг фокуса внутри экрана: окно едет за ним. */
      function afterMove() {
        byMouse = false;
        limitHub(lastFocus);
      }

      /* Task 32: подкрутка экрана к тому, что под фокусом, — вторая половина
         штатного контракта Lampa (эталон: app.min.js:53107, card.onFocus ->
         scroll.update). Без неё фокус уходит вниз, а экран стоит: на стенде
         плитка четвёртого ряда оказывалась за нижней кромкой (top 1191 при
         высоте экрана 1080).
         tocenter = true: getElementPosition (app.min.js:32046) и с
         центрированием берёт Math.min(0, ...), то есть верх списка никуда не
         уезжает — центрируется только то, до чего реально докрутили. Для
         чипов и кнопки поиска вызов тоже нужен: «вверх» с плитки возвращает
         фокус в шапку, а прокрученный экран сам назад не поедет и шапка
         осталась бы за верхней кромкой. Дёргать их центрированием нечем:
         чипы одного ряда стоят на одной высоте, и пока шапка умещается в
         верхнюю половину экрана, Math.min(0, ...) отдаёт им одну и ту же
         позицию — начало списка.
         Узел передаём как есть: scroll.update принимает и jQuery, и DOM
         (app.min.js:32049), как штатный card.render(true).
         Мышь в подборках (2026-09-25): только за фокусом ПУЛЬТА (ev —
         событие фокуса, LC.focus.remote). Наведённый мышью узел и так на
         экране, а подкрутка с центрированием подвозила под курсор соседний
         ряд, тот получал 'hover:hover' — и на ТВ сетка сама уезжала к концу
         (фокус 12 -> 30). Штатная карточка на наведение зовёт onHover
         (app.min.js:52333), а category_full его не задаёт: наведение
         страницу не двигает. Мышью листают колесом (onScroll ниже). */
      function keepVisible(el, ev) {
        if (!LC.focus.remote(ev)) { byMouse = true; return; }
        if (quiet) return;
        try {
          var from = scroll.position();
          remoteScroll = true;
          scroll.update(el, true);
          /* Экран уже там — onScroll не придёт (см. keepVisible сетки). */
          if (scroll.position() === from) remoteScroll = false;
        } catch (e) { warn('hub: scroll.update failed', e); }
      }

      /* Task 41: размер кадра плитки по её фактической ширине. Ступени
         кадров TMDB не совпадают с постерными (w185/w342/w500/w780 у
         LC.util.posterSize): у кадров под w780 идёт w300 — из этой же пары
         выбирает кадр серии src/85_header.js (stillSize).
         Task 68: ширину даёт tileEm() (разбор — там же). На обоих целевых
         экранах — 960 CSS px при DPR 2 и 1920 при DPR 1 — плитка выходит
         411-435 физических пикселей во всех 24 клетках (3 размера
         интерфейса × 4 масштаба), то есть w780 берётся всегда и растяжения
         нет ни в одной: 435 / 780 = 0.56. Выше w780 не поднимаемся ни при
         каком DPR: следующая ступень кадра — w1280, а плиток с кадрами на
         экране до девяти разом (BANNER_AHEAD). w300 остаётся окну, где
         0.85 ширины плитки в него укладываются; до Task 68 он по ошибке
         доставался и целевому экрану 1920×1080. */
      function bannerSize() {
        return LC.util.emPx(tileEm()) * 0.85 > 300 ? 'w780' : 'w300';
      }

      /* Task 41: баннер плитки — ОДИН кадр на всю плитку (16:9) вместо
         коллажа из трёх повёрнутых постеров: на плитку приходится одна
         картинка вместо трёх, и текст лежит на затемнении кадра, а не
         поверх постеров.
         Путь по-прежнему дешёвый: LC.sources.bannerPath для подборки
         Кинопоиска берёт картинку прямо из ответа КП — один запрос вместо
         «1 к КП + до 20 к TMDB», которых стоила бы целая страница подборки
         (ревью Task 17, C1). */
      function paintBanner(node, path, onFail) {
        var box = $(node).find('.lumen-tile__media');
        if (!box || !box.length) return;
        box.empty();
        path = '' + (path || '');
        if (!path) return;
        /* Готовый http-адрес (подборка Кинопоиска отдаёт свои картинки
           сама) размер не выбирает — он берётся как есть. */
        var url = path.indexOf('http') === 0 ? path : imageUrl(path, bannerSize());
        if (!url) return;
        /* decoding="async" — та же подсказка, что у постеров сетки
           (bindPoster ниже): картинка уже в документе, и без неё каждый кадр
           декодируется на главном потоке в момент показа.
           Класс плитки ставится по событию загрузки: до него плитка стоит
           ровным фоном панели, а кадр проявляется переходом
           (.lumen-tile__img в src/30_css.js).
         onFail — откат, если картинка не загрузилась (только у кадра
         каталога, см. loadBanner). */
        var img = $('<img class="lumen-tile__img" decoding="async">');
        img[0].onload = function () { $(node).addClass('lumen-tile--filled'); };
        if (onFail) img[0].onerror = onFail;
        img[0].src = url;
        box.append(img);
      }

      /* Подборка без поля cover — копия: манифест общий на весь плагин. */
      function liveItem(item) {
        var out = {};
        for (var k in item) {
          if (item.hasOwnProperty(k) && k !== 'cover') out[k] = item[k];
        }
        return out;
      }

      function loadBanner(item, node) {
        if (node.lumen_banner) return;
        node.lumen_banner = true;
        var captured = gen;
        /* Ревью каталога (60): кадр каталога (cover) — картинка TMDB, которую
           могут снять, и без отката плитка так и стояла бы ровной панелью.
           Упал он — плитка помечается lumen_live и просит живой кадр (первая
           страница подборки, путь bannerPath без cover); к cover она больше
           не возвращается — ни на следующем фокусе, ни после stop/start. */
        var src = node.lumen_live ? liveItem(item) : item;
        function toLive() {
          if (gen !== captured || node.lumen_live) return;
          node.lumen_live = true;
          node.lumen_banner = false;
          loadBanner(item, node);
        }
        /* Task 25: скелетон плитки. Класс .lumen-skeleton живёт ровно
           столько, сколько идёт запрос кадра, и снимается в ОБЕИХ ветках
           ответа — иначе плитка пульсировала бы вечно после ошибки. Пульсируют
           только запрошенные плитки (окно BANNER_AHEAD вокруг фокуса);
           остальные стоят спокойными — на ТВ десятки анимаций разом
           стоят дороже, чем помогают. */
        function skeleton(on) {
          try {
            var box = $(node).find('.lumen-tile__media');
            if (!box || !box.length) return;
            if (on) box.addClass('lumen-skeleton');
            else box.removeClass('lumen-skeleton');
          } catch (eSk) { }
        }
        skeleton(true);
        var handle = LC.sources.bannerPath(src, function (path) {
          skeleton(false);
          if (gen !== captured) return;
          paintBanner(node, path, src.cover && path === src.cover ? toLive : null);
        }, function (err) {
          skeleton(false);
          if (gen !== captured) return;
          /* Неудача не должна оставлять плитку пустой навсегда: снимаем
             отметку, и кадр перезапросится, когда плитка снова получит
             фокус. Единственная ошибка, о которой стоит сказать сразу, —
             подборка Кинопоиска без ключа API. */
          node.lumen_banner = false;
          if (err && err.nokey) $(node).addClass('lumen-tile--nokey');
        }, alive(captured));
        if (handle) handles.push(handle);
      }

      /* Текущий месяц для сезонного порядка и метки «Сезон» (Task 21).
         Читается через LC.themes — там же живёт хук даты, которым живая
         проверка подменяет декабрь, не трогая системные часы. */
      function month() {
        try {
          if (LC.themes && typeof LC.themes.month === 'function') return LC.themes.month();
        } catch (e) { }
        return 0;
      }

      /* Позиция плитки в текущей группе или -1 (фокус на чипе или кнопке
         поиска) — как focusedIndex у сетки. */
      function tileIndex(node) {
        for (var i = 0; i < tileNodes.length; i++) {
          if (tileNodes[i] === node) return i;
        }
        return -1;
      }

      /* Task 41: кадры грузятся окном вперёд от фокуса — тем же приёмом,
         что постеры сетки (loadPosters ниже). В самой большой группе
         каталога 47 плиток (manifest.json, themes), и загружать столько
         картинок разом на ТВ незачем: без прокрутки видно два ряда. */
      function loadBanners(upTo) {
        var list = tilesFor(manifest, activeGroup, month());
        for (var i = 0; i < tileNodes.length && i <= upTo; i++) {
          loadBanner(list[i], tileNodes[i]);
        }
      }

      /* Окно от того места, где стоит фокус: при входе в группу это её
         начало (фокус на чипе, tileIndex = -1), при возврате из подборки —
         плитка, с которой ушли. */
      function loadVisibleBanners() {
        var from = tileIndex(lastFocus);
        loadBanners((from < 0 ? 0 : from) + BANNER_AHEAD);
      }

      /* Окно по видимости, а не по фокусу: колесо мыши листает хаб, не
         двигая фокус, а при входе на экране 2560×1440 и 960×540 видно 2.75
         ряда — третий ряд за окном BANNER_AHEAD оставался без кадров. */
      function loadInView() {
        loadBanners(lastInView(tileNodes) + LC.hubEm.tileCols);
      }

      /* C2: прокрутка, которую начал не keepVisible (колесо, палец,
         полоса), — ввод не пультовый. */
      function onScroll() {
        if (remoteScroll) remoteScroll = false;
        else byMouse = true;
        loadInView();
        try { Lampa.Layer.visible(scroll.render(true)); } catch (e) {}
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
            '<div class="lumen-tile__media"></div>' +
            '<div class="lumen-tile__scrim"></div>' +
            season +
            '<div class="lumen-tile__text">' +
              '<div class="lumen-tile__title">' + esc(titleOf(item, lang())) + '</div>' +
              '<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
            '</div>' +
            '<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
          '</div>'
        );
        /* Task 68: LC.focus.on — подписка на фокус и пультом, и мышью
           (src/11_focus.js). Мышиное наведение шлёт 'hover:hover', не
           'hover:focus' (vendor/lampa/app.min.js:46360-46364), а догрузка
           кадров нужна одинаково в обоих режимах. Подкрутка экрана — только
           пультом (keepVisible). */
        LC.focus.on(node, function (e) {
          keepVisible(node[0], e);
          lastFocus = node[0];
          loadVisibleBanners();
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
        loadVisibleBanners();
        loadInView();
        for (var c = 0; c < chipNodes.length; c++) {
          $(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
        }
      }

      function chipNode(group) {
        /* Task 41: сегмент-контрол — только название группы. Счётчик
           подборок с чипа убран (число всех подборок каталога стоит в
           заголовке экрана, buildHead ниже). */
        var node = $('<div class="lumen-chip selector">' + esc(group.title) + '</div>');
        node[0].lumen_group = group.id;
        LC.focus.on(node, function (e) { keepVisible(node[0], e); lastFocus = node[0]; });
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
           lastFocus, а не с классом .focus: его ставит Lampa, а lastFocus
           обновляется тем самым событием, которым Lampa этот класс и
           сопровождает — на обоих путях сразу, потому что подписка идёт
           через LC.focus (пульт и мышь, src/11_focus.js). */
        if (lastFocus === node) return false;
        /* С кнопки рулетки — тоже в шапку Lampa: она стоит в той же строке,
           что и поиск, и «вверх» с неё не должно уводить вбок на соседа. */
        if (rouletteNode && lastFocus === rouletteNode) return false;
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
        LC.focus.on(search, function (e) { keepVisible(search[0], e); lastFocus = search[0]; });
        search.on('hover:enter', function () { openSearch(); });
        head.append(search);
        /* Task 33: кнопка в коллекции Navigator всегда, вне окна плиток. */
        searchNode = search[0];
        /* Правка 2026-09-23, долг Task 23 (план фазы 3, строка 148): вход в
           рулетку из хаба. Кнопка одна, а не две («Рулетка · Фильмы» и
           «Рулетка · Сериалы», как предлагал Step 3 плана): у самой рулетки
           в шапке переключатель «Фильмы / Сериалы» без перезагрузки экрана,
           и вторая кнопка здесь была бы лишней остановкой пульта ради того
           же экрана. Открывает фильмы — как и пункт левого меню.
           Стоит СПРАВА от поиска, в той же строке: пилюля того же вида,
           что у поиска, и тем же шагом «вправо» с него. Путь пультом:
           чипы → вверх → поиск → вправо → рулетка; вверх с неё — в шапку
           Lampa (focusSearch), вниз — к плиткам, как с поиска. */
        rouletteNode = null;
        if (LC.roulette && typeof LC.roulette.open === 'function') {
          var roulette = $('<div class="lumen-hub__roulette selector">' + LC.icons.get('star') + '<span>' + esc(LC.lang('lumen_hub_roulette')) + '</span></div>');
          LC.focus.on(roulette, function (e) { keepVisible(roulette[0], e); lastFocus = roulette[0]; });
          roulette.on('hover:enter', function () { LC.roulette.open('movie'); });
          head.append(roulette);
          rouletteNode = roulette[0];
        }
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
           здесь: в start() плиток ещё не было. C1: только если пульт у нас. */
        if (started && ownsRemote(self.activity)) recollect(null);
        /* Task 40: замер первого кадра ХАБА — самого тяжёлого экрана
           плагина: чипы групп плюс плитки с кадрами подборок. Точка
           последняя в build() намеренно: замер обязан включать всю нашу
           работу по экрану. Мерить или нет, решает сам модуль
           (src/68_perf.js); в тестах хаба LC.perf нет. */
        try { if (LC.perf && LC.perf.track) LC.perf.track('hub'); } catch (ePerf) {}
      }

      this.create = function () {
        motionClass(root);
        screenBg(self.activity);
        root.append(head);
        root.append(chipsRow);
        root.append(tilesRow);
        scroll.append(root);
        /* Task 32: высота области прокрутки = экран − шапка Lampa. minus()
           ставит контейнеру класс layer--wheight (app.min.js:32232), а саму
           высоту (innerHeight − head − navi) считает Layer.update ->
           frameUpdate (app.min.js:31684-31695); пересчёт приходит сам:
           Controller.toggle('content') из start() зовёт Layer.update, раз у
           нашего контроллера своего update нет (app.min.js:46309). Без
           minus() контейнер растягивается по содержимому (замер на стенде:
           2824 px при экране 1080), диапазон прокрутки равен нулю и «вниз»
           не листается вовсе. Эталон — app.min.js:53170 (category_full).
           Без аргумента: аргументом вычлась бы ещё и высота переданного
           узла, а наша шапка едет внутри прокрутки. */
        scroll.minus();
        scroll.onScroll = onScroll;
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
        Lampa.Controller.add('content', screenController(enter, afterMove, focusSearch));
        Lampa.Controller.toggle('content');
        /* Возврат после stop(): кадры, которые тогда погасили (или которые
           не успели прийти), запрашиваются снова — в этот момент они уже в
           кэше TMDB/КП, поэтому возврат сетью не платит. */
        if (manifest) {
          loadVisibleBanners();
          loadInView();
        }
      };

      /* C1: уход на один уровень (карточка, рулетка поверх) — pause(), а
         stop() придёт, только когда сверху ляжет ещё экран. Экран с этого
         момента не наш: отложенные ответы коллекцию не ставят, её вернёт
         start(). */
      this.pause = function () {
        started = false;
      };

      /* Lampa зовёт stop() при уходе вглубь и тут же снимает слайд из DOM
         (ActivitySlide.stop: component.stop() + slide.remove()), а destroy()
         наступает только при возврате или вытеснении по лимиту истории.
         Поэтому запросы гасятся здесь, а не только в destroy: иначе кадры
         продолжали бы лететь и дорисовываться в снятый с экрана DOM ровно
         тогда, когда сеть нужна открытой карточке (ревью Task 17, I2).
         Экран при этом остаётся целым: start() вернёт слайд и кадры. */
      this.stop = function () {
        started = false;
        bump();
        forgetWindowOf(tileNodes);
        /* Погашенные кадры помечаем как незапрошенные — чтобы start()
           запросил их снова. Плитки, которые успели нарисоваться, остаются
           как есть: у них уже есть картинка. */
        for (var i = 0; i < tileNodes.length; i++) {
          if (!$(tileNodes[i]).hasClass('lumen-tile--filled')) tileNodes[i].lumen_banner = false;
        }
      };

      this.destroy = function () {
        bump();
        forgetWindowOf(tileNodes);
        chipNodes = [];
        tileNodes = [];
        searchNode = null;
        rouletteNode = null;
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
      /* Кнопки пустой сетки («Назад», «Скрыть подсказку»). Карточками они не
         являются, а в коллекции Navigator быть обязаны: окно строится по
         cardNodes, и без этого списка недостижимой стала бы кнопка «Назад».
         Чипы сортировки на пустой сетке остаются в любом случае — create()
         заводит их до первого ответа, и в fixed они всегда. Task 33. */
      var emptyNodes = [];
      /* Кнопка «Крутить по этой подборке» (правка 2026-09-23, долг
         Task 23): стоит в строке чипов сортировки, в коллекции — всегда,
         как и они. null, если рулетка эту подборку крутить не умеет
         (rouletteMedia). */
      var rouletteNode = null;
      var lastFocus = null;
      /* id карточки под фокусом: список могут пересобрать (сортировка на
         месте при догрузке страницы), и тогда прежний узел исчезает —
         фокус возвращается на ту же карточку, а не на первый чип. */
      var lastCardId = null;
      var started = false;
      /* Мышь в подборках (2026-09-25): последний ввод — мышь (колесо или
         наведение; с п.1 следующего раунда — и прокрутка пальцем или
         полосой, см. onScroll), а не шаг пульта. Сбрасывает его только шаг пульта
         (afterMove). Пока он стоит, пришедшая страница экран не двигает:
         см. recollect. */
      var byMouse = false;
      /* Фокус ставится заново, а экран остаётся где был — keepVisible на
         это время молчит. Живёт ровно один вызов collectionFocus. */
      var quiet = false;
      /* Следующий раунд, п.1 (тач): прокрутку начал keepVisible, то есть
         пульт. Lampa завершает onScroll любую прокрутку — пальцем, полосой,
         подкруткой за фокусом, — и флаг отличает последнюю; снимает его
         первый же onScroll. */
      var remoteScroll = false;

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

      /* Task 33: окно коллекции вокруг узла target. Чипы сортировки и кнопки
         пустой сетки идут в коллекцию всегда и первыми — так они остаются
         достижимыми «вверх» с любой строки карточек, на каком бы месте
         списка ни стояло окно. Их единицы, на цену прохода Navigator это не
         влияет; карточек же после нескольких страниц сотни — вот их и режем
         окном. */
      function limitGrid(target) {
        var active = -1;
        for (var i = 0; i < cardNodes.length; i++) {
          if (cardNodes[i] === target) { active = i; break; }
        }
        var fixed = sortNodes.concat(emptyNodes);
        if (rouletteNode) fixed.push(rouletteNode);
        limitCollection(fixed, cardNodes, active);
      }

      /* Коллекцию выставляем сами, а не Controller.collectionSet: тот отдал
         бы Navigator все .selector узла разом (app.min.js:46448-46456), а их
         здесь столько же, сколько карточек. Controller.collectionFocus
         поверх окна работает штатно — узлу он зовёт Navigator.focus
         (app.min.js:46474-46491), а тот требует, чтобы элемент лежал в
         коллекции (navigator.js:674); окно потому и строится ВОКРУГ того
         узла, на который сейчас встанет фокус.
         still — экран не двигать (мышь в подборках, 2026-09-25): фокус
         встаёт через Navigator.focus -> 'hover:focus' -> keepVisible, и
         страница, догруженная колесом, уводила экран назад, к карточке под
         фокусом, — к началу списка. Штатная limit (app.min.js:53146-53162)
         возвращает фокус без события (Navigator.focused) и экран не трогает. */
      function recollect(prefer, still) {
        try {
          var node = prefer || focusTarget();
          limitGrid(node);
          quiet = !!still;
          Lampa.Controller.collectionFocus(node || false, root[0]);
        } catch (e) {
          warn('grid: collection failed', e);
        }
        quiet = false;
      }

      /* C2: вход в пульт — как у хаба (enter там). */
      function enter() {
        try { scroll.restorePosition(); } catch (e) { }
        if (!tvScreen()) return;
        recollect(null, byMouse);
      }

      /* Task 32: то же, что keepVisible хаба (см. комментарий там) — экран
         едет за фокусом. Для сетки центрирование особенно к месту: ряд
         карточек встаёт посередине, и следующий ряд виден заранее. Чипы
         сортировки и кнопки пустой сетки зовут его по той же причине, что и
         шапка хаба: вернувшись «вверх» на прокрученном экране, они иначе
         остались бы за кромкой.
         Мышь в подборках: только за фокусом пульта (ev), наведение экран не
         двигает — разбор у keepVisible хаба. */
      function keepVisible(el, ev) {
        if (quiet || !LC.focus.remote(ev)) return;
        try {
          var from = scroll.position();
          remoteScroll = true;
          scroll.update(el, true);
          /* Экран уже там: startScroll выходит, не дойдя до scrollEnded
             (app.min.js:32013-32016), onScroll не придёт — и флаг съел бы
             первый жест пальцем (фокус при входе стоит на чипе сверху). */
          if (scroll.position() === from) remoteScroll = false;
        } catch (e) { warn('grid: scroll.update failed', e); }
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
        /* Task 39: декодирование вне главного потока (см. src/48_hero.js,
           loadFrame). Здесь <img> уже в документе, поэтому подсказка важнее
           всего: без неё каждый постер декодируется на главном потоке в
           момент показа, а сетка листается по шесть карточек за шаг. */
        img.decoding = 'async';
        img.onload = function () { $(node).addClass('card--loaded'); };
        img.onerror = function () { $(node).addClass('card--broken'); };
        img.src = url;
      }

      /* Прокрутка не пультом — колесо мыши (Scroll.wheel, app.min.js:32117),
         подкрутка под мышиный фокус, тач — фокус не двигает, и afterMove не
         зовётся. Lampa завершает любую прокрутку вызовом onScroll
         (scrollEnded, app.min.js:31979-31980): по нему постеры получают
         видимые карточки и ряд запаса. onScroll заменяет штатный
         Layer.visible — зовём его сами, как штатная limit (app.min.js:53162).
         Мышь в подборках (2026-09-25): по ней же — следующая страница, когда
         на экране предпоследний или последний ряд, как штатная category_full
         по scroll.onEnd (app.min.js:53168). Без этого колесом список
         обрывался на первой странице: догрузку звал только afterMove.
         Сама себя догрузка не крутит: условие — видимость, а пришедшая
         страница дописывает ряды НИЖЕ экрана.
         Следующий раунд, п.1: прокрутка, которую начал не keepVisible, —
         пальцем или полосой — ввод не пультовый (byMouse), как колесо: на
         таче мышиных событий нет, и пришедшая страница подкручивала экран к
         фокусу — к чипу сверху. */
      function onScroll() {
        if (remoteScroll) remoteScroll = false;
        else byMouse = true;
        var last = loadInView();
        if (last >= 0 && Math.floor(last / GRID_COLS) >= Math.floor((cardNodes.length - 1) / GRID_COLS) - 1) loadNext();
        try { Lampa.Layer.visible(scroll.render(true)); } catch (e) {}
      }

      /* Постеры видимых рядов и ряда запаса; отдаёт последнюю видимую
         карточку (или -1). Зовётся и вне прокрутки — на пришедшей странице и
         на start (экран 5:4, 1280×1024: при входе видно три ряда, а окно от
         фокуса — 15 карточек, и 15..17 стояли заглушками). Экрана ещё нет в
         документе — узлы без высоты, видимых нет (lastInView), и видимое
         доберёт start. */
      function loadInView() {
        var last = lastInView(cardNodes);
        if (last >= 0) loadPosters(last + GRID_COLS);
        return last;
      }

      /* Колесо — штатная прокрутка тем же шагом (scroll.wheel), плюс отметка,
         что ввод теперь мышиный: пришедшая страница экран не тронет. Без
         onWheel Lampa зовёт тот же wheel сама (app.min.js:31870-31874). */
      function onWheel(step) {
        byMouse = true;
        scroll.wheel(step);
      }

      /* Догрузка по ФОКУСУ — только от пульта: фокус ставится и программно
         (после каждой пришедшей страницы), и цепочка «страница пришла ->
         фокус -> догрузка» крутилась бы сама (живая проверка: сетка
         набирала 320 карточек за заход). По прокрутке догружает onScroll. */
      function afterMove() {
        byMouse = false;
        /* Task 33: окно едет за фокусом — на каждом шаге, включая шаг на
           чип сортировки (там окно встаёт на начало списка). */
        limitGrid(lastFocus);
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
        /* Пустая подпись занимала бы под постером свою строку, поэтому её
           узел снимается. Task 43 (фикс-раунд): проверка переехала СЮДА, за
           markCard: рейтинг сетки теперь дописывает в ту же подпись
           LC.badges.decorate, и у фильма без года снятый заранее узел унёс
           бы вместе с собой и оценку — штатную плашку .card__vote при
           включённых метках прячет CSS. */
        var age = node.find('.card__age');
        if (age.length && !('' + age.text())) age.remove();
        /* Task 39: постер карточки сетки — по её фактической ширине.
           Task 68: ширину даёт gcardEm() (разбор — там же). На обоих целевых
           экранах карточка выходит 262-285 физических пикселей во всех 24
           клетках, то есть w342 без растяжения (285 / 342 = 0.83). */
        el.lumen_poster = imageUrl(card.poster_path, LC.util.posterSize(LC.util.emPx(gcardEm())));

        LC.focus.on(node, function (e) {
          if (!LC.focus.remote(e)) byMouse = true;
          keepVisible(el, e);
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
           progressBar выше, вторая такая же на том же постере была бы дублем.
           Task 43 (фикс-раунд): rating:false снят — рейтинг сетки переехал
           в подпись под постером, ровно как на главной, а штатную плашку
           .card__vote прячет CSS при включённых метках (src/30_css.js, блок
           сетки). Вторым числом он не станет: прячется ровно то, что
           дописывается, и по одному и тому же условию.
           Ревью волны A (важное 2): wide:true. Правило «рейтинг в подписи
           только без метки» заведено под карточку ГЛАВНОЙ (9.52em); здесь
           карточка 12.36em, и метка с рейтингом помещаются вместе — замеры
           у правила A2 в src/62_badges.js. Без флага карточка сетки с
           меткой оставалась без оценки вовсе: плашку прячет CSS, а в
           подпись рейтинг не дописывался. */
        try {
          if (LC.badges && LC.badges.decorate) LC.badges.decorate(node, card, { bar: false, wide: true });
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
        emptyNodes = [];
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
          LC.focus.on(hide, function (e) { keepVisible(hide[0], e); lastFocus = hide[0]; });
          hide.on('hover:enter', function () {
            try { Lampa.Storage.set('lumen_kp_hint', 'false'); } catch (e) {}
          });
          box.append(hide);
          emptyNodes.push(hide[0]);
        }
        var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
        LC.focus.on(back, function (e) { keepVisible(back[0], e); lastFocus = back[0]; });
        back.on('hover:enter', function () { Lampa.Activity.backward(); });
        box.append(back);
        emptyNodes.push(back[0]);
        itemsRow.append(box);
      }

      /* Пересобрать список из накопленных страниц в текущем порядке. */
      function rebuild() {
        itemsRow.empty();
        cardNodes = [];
        emptyNodes = [];
        appendCards(sortLocal(raw, sortMode));
        loadPosters(POSTER_AHEAD);
        renderSub();
        if (started && ownsRemote(self.activity)) recollect(null);
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

        /* Постеры: сборка страницы вынесена в функцию — между ответом
           подборки и ней встала подмена постеров (см. ниже). Тело не
           менялось. */
        function fill(json) {
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
            emptyNodes = [];
          }
          if (!list.length && !cardNodes.length) showEmpty('');
          else appendCards(list);
          var from = focusedIndex();
          loadPosters((from < 0 ? 0 : from) + POSTER_AHEAD);
          loadInView();
          renderSub();
          /* Мышь в подборках: страница, догруженная колесом или под
             наведённой карточкой, экран не двигает (recollect, still).
             C1: пульт не у нас (карточка, меню, «Назад») — коллекцию не
             трогаем; lastCardId уже помнит карточку для toggle. */
          if (started && ownsRemote(self.activity)) recollect(null, byMouse);
        }

        var handle = LC.sources['fetch'](request, nextPage, function (json) {
          if (gen !== captured) return;
          /* Постеры: постер сетки собирает не Lampa, а сама сетка (cardNode
             выше: el.lumen_poster из card.poster_path), и собирает его ОДИН
             раз при создании узла. Значит подмена обязана пройти до
             appendCards — иначе первая страница осталась бы с постерами
             Lampa, а следующие пришли бы с подменёнными, и одна сетка
             показывала бы два разных набора обложек.
             Лоадер активности на это время остаётся поднятым: он снимается
             внутри fill.
             Номер страницы — для «Английских»: они переспрашивают ту же
             страницу подборки на другом языке (Ф3 п.1 ревью фикс-раундов). */
          LC.sources.posters(request, json.results || [], function () {
            if (gen !== captured) return;
            fill(json);
          }, alive(captured), nextPage);
        }, function (err) {
          if (gen !== captured) return;
          loading = false;
          pending = null;
          try { self.activity.loader(false); } catch (e3) {}
          if (!cardNodes.length) showEmpty(err && err.nokey ? 'nokey' : '');
          renderSub();
          if (started && ownsRemote(self.activity)) recollect(null, byMouse);
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
        LC.focus.on(node, function (e) { keepVisible(node[0], e); lastFocus = node[0]; });
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
        screenBg(self.activity);
        /* C4: заголовок — на языке интерфейса. */
        head.append($('<div class="lumen-grid__title">' + esc(titleOf(item, lang())) + '</div>'));
        head.append(subtitle);
        root.append(head);
        var modes = sortModes();
        for (var i = 0; i < modes.length; i++) {
          var node = sortNode(modes[i]);
          sortsRow.append(node);
          sortNodes.push(node);
        }
        highlightSort();
        /* Правка 2026-09-23, долг Task 23 (план фазы 3, строка 148): вход в
           рулетку из сетки подборки — с этой подборкой уже отмеченной
           (object.preselect рулетки). Кнопка — последним узлом строки
           сортировки, а не в шапке рядом с заголовком: так «вправо» с
           последнего чипа сортировки доводит до неё одним шагом, а «вниз»
           с неё уходит в сетку, как с чипов. Отдельной строки ей не дано —
           строка стоила бы высоты первого ряда карточек. */
        var rmedia = rouletteMedia(item);
        if (rmedia) {
          var roulette = $('<div class="lumen-chip lumen-grid__roulette selector">' + LC.icons.get('star') + '<span>' + esc(LC.lang('lumen_grid_roulette')) + '</span></div>');
          LC.focus.on(roulette, function (e) { keepVisible(roulette[0], e); lastFocus = roulette[0]; });
          roulette.on('hover:enter', function () { LC.roulette.open(rmedia, item.id); });
          sortsRow.append(roulette);
          rouletteNode = roulette[0];
        }
        root.append(sortsRow);
        root.append(itemsRow);
        scroll.append(root);
        /* Task 32: то же, что в HubComponent.create (см. комментарий там):
           без minus() контейнер прокрутки растянут по содержимому и сетка
           вообще не листается вниз. */
        scroll.minus();
        scroll.onScroll = onScroll;
        scroll.onWheel = onWheel;
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
        Lampa.Controller.add('content', screenController(enter, afterMove));
        Lampa.Controller.toggle('content');
        /* Страница могла прийти раньше, чем экран встал в документ, — тогда
           видимое добирается здесь (loadInView). */
        loadInView();
        /* Запрос, прерванный на stop(), возобновляется с той же страницы. */
        if (resumeAfterStop) {
          var again = resumeAfterStop;
          resumeAfterStop = null;
          loadPage(again.page, again.reset);
        }
      };

      /* C1: открыли карточку — pause(), а stop() только под следующим
         экраном (limit(), app.min.js:45771-45775). Незавершённая страница
         дорисуется, но коллекцию Navigator не тронет. */
      this.pause = function () {
        started = false;
      };

      /* Уход вглубь: Lampa снимает слайд из DOM (ActivitySlide.stop), но
         компонент жив и вернётся по start(). Незавершённую страницу гасим —
         она дорисовывалась бы в снятый экран и занимала сеть, нужную
         карточке (ревью Task 17, I2), — и запоминаем, чтобы догрузить при
         возврате. */
      this.stop = function () {
        started = false;
        resumeAfterStop = loading ? pending : null;
        bump();
        forgetWindowOf(cardNodes);
        loading = false;
        pending = null;
      };

      this.destroy = function () {
        bump();
        forgetWindowOf(cardNodes);
        cardNodes = [];
        sortNodes = [];
        emptyNodes = [];
        rouletteNode = null;
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
      tileEm: tileEm,
      gcardEm: gcardEm,
      groupsWithCounts: groupsWithCounts,
      tilesFor: tilesFor,
      inSeason: inSeason,
      openTarget: openTarget,
      rouletteMedia: rouletteMedia,
      franchiseItem: franchiseItem,
      sortModes: sortModes,
      applySort: applySort,
      sortLocal: sortLocal,
      needsLocalSort: needsLocalSort,
      cardMedia: cardMedia,
      hasMore: hasMore,
      install: install,
      uninstall: uninstall,
      menuNode: menuNode,
      franchise: franchise,
      /* C7: для тестов — список, который держит кэш окна коллекции. */
      _windowNodes: function () { return lastNodes; }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hub;

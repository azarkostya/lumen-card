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
  /* 2. Навигация. Lampa.Controller.move(dir) вызывает ТОЛЬКО одноимённый   */
  /*    метод активного контроллера (app.min.js run/move 46238-46255):      */
  /*    не определил right — фокус не двинется. Штатные компоненты зовут    */
  /*    Navigator.canmove/move, но Navigator в window.Lampa НЕ экспортирован*/
  /*    (проверено по списку экспорта, app.min.js 55947-56041). Поэтому наша*/
  /*    навигация геометрическая (Nav ниже): свой массив узлов по рядам,    */
  /*    индекс фокуса, шаг вправо/влево ±1, вверх/вниз ±(число колонок), а   */
  /*    на краю ряда — переход в соседний ряд на запомненную в нём позицию.  */
  /*    Фокус ставится экспортированным Lampa.Controller.collectionFocus     */
  /*    (node, root) — он же шлёт элементу 'hover:focus'.                    */
  /*                                                                        */
  /* 3. Карточки. Экспортированный Lampa.Card помечен deprecated и на       */
  /*    КАЖДОМ создании печатает console.warn (app.min.js 51893) — 20 строк */
  /*    в консоли на страницу сетки. Новый внутренний класс карточки        */
  /*    (app.min.js 19114) плагинам не отдан. Поэтому карточка сетки — свой */
  /*    DOM с оформлением из design-spec-main §0.4, а данные карточки лежат */
  /*    в нативном свойстве node.card_data, как и у штатной (app.min.js     */
  /*    51914) — так их видят и сторонние плагины, и Task 18 (герой).       */
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

    /* Число колонок. Хаб — 4 плитки в ряд (design-spec-main §0.8: плитка
       430px + gap 20 при safe area 64 с обеих сторон), сетка — 6 карточек
       (поправка контроллера к Task 17). Оба числа заданы и в CSS, и здесь:
       CSS раскладывает, а навигация по ним считает соседа по вертикали. */
    var HUB_COLS = 4;
    var GRID_COLS = 6;

    /* Сколько плиток группы получают коллаж постеров сразу при открытии.
       Ровно два первых ряда — столько видно на экране без прокрутки;
       остальным коллаж грузится при получении фокуса. Каждая плитка стоит
       1-2 запроса TMDB (кэш 12 ч у discover, неделя у коллекций). */
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

    /* Подборки одного чипа хаба. */
    function tilesFor(manifest, hubGroupId) {
      if (!manifest || !Array.isArray(manifest.hubGroups)) return [];
      for (var i = 0; i < manifest.hubGroups.length; i++) {
        var g = manifest.hubGroups[i];
        if (g && g.id === hubGroupId) return collectionsIn(manifest, g.groups);
      }
      return [];
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
    /* Общая навигация по коллекции узлов (см. п.2 шапки).                 */
    /*                                                                     */
    /* rows — описание рядов экрана: [{nodes:[…], cols:N}, …]. Ряд чипов —  */
    /* один ряд из своих узлов (cols = длине), сетка — один «ряд» со всеми  */
    /* карточками и cols = числу колонок: вверх/вниз внутри него шагают     */
    /* через cols, а на краю переходят в соседний ряд описания.             */
    /* ------------------------------------------------------------------ */

    function Nav(onFocus) {
      var rows = [];
      var row = 0;
      var idx = 0;
      /* Последняя позиция в каждом ряду. Переход между рядами возвращает
         фокус туда, откуда пользователь ушёл, а не в тот же столбец: ряды
         тут разной природы (чипы и сетка), и «тот же столбец» уводил бы с
         выбранной группы на соседнюю. */
      var lastIdx = [];

      this.set = function (list) { rows = list || []; };

      /* Запомнить узел как текущий, НЕ трогая сам фокус. Нужно для мыши:
         в браузере Lampa шлёт 'hover:focus' по наведению, минуя наши
         стрелки, и без синхронизации следующий шаг пультом пошёл бы от
         старой позиции. Через onFocus этого делать нельзя — collectionFocus
         внутри снова пошлёт 'hover:focus' и получится рекурсия. */
      this.sync = function (node) {
        for (var r = 0; r < rows.length; r++) {
          for (var i = 0; i < rows[r].nodes.length; i++) {
            if (rows[r].nodes[i] === node) { row = r; idx = i; lastIdx[r] = i; return true; }
          }
        }
        return false;
      };

      function clampRow() {
        if (row < 0) row = 0;
        if (row > rows.length - 1) row = rows.length - 1;
      }

      /* Поставить фокус на узел (если он есть в коллекции) или на первый. */
      this.focus = function (node) {
        var r, i;
        for (r = 0; r < rows.length; r++) {
          for (i = 0; i < rows[r].nodes.length; i++) {
            if (rows[r].nodes[i] === node) {
              row = r; idx = i; lastIdx[r] = i;
              onFocus(node);
              return node;
            }
          }
        }
        for (r = 0; r < rows.length; r++) {
          if (rows[r].nodes.length) {
            row = r; idx = 0; lastIdx[r] = 0;
            onFocus(rows[r].nodes[0]);
            return rows[r].nodes[0];
          }
        }
        return null;
      };

      /* Шаг по горизонтали. Возвращает false, если двигаться некуда
         (тогда вызывающий уводит фокус в меню). */
      this.move = function (dir) {
        clampRow();
        var r = rows[row];
        if (!r || !r.nodes.length) return false;
        var cols = r.cols || r.nodes.length;
        var next = idx;
        if (dir === 'right') next = idx + 1;
        else if (dir === 'left') next = idx - 1;
        else if (dir === 'down') next = idx + cols;
        else if (dir === 'up') next = idx - cols;

        /* Внутри ряда. Для сетки «вправо» на последней карточке ряда
           переносит на следующую строку — так же ведёт себя штатный
           Navigator, и пользователю не приходится идти вниз-влево. */
        if (next >= 0 && next <= r.nodes.length - 1) {
          idx = next;
          lastIdx[row] = idx;
          onFocus(r.nodes[idx]);
          return true;
        }

        /* Край ряда: вниз/вверх — в соседний ряд описания, на запомненную
           в нём позицию (первый вход — начало ряда). */
        var step = dir === 'down' ? 1 : (dir === 'up' ? -1 : 0);
        if (!step) return false;
        var target = row + step;
        if (target < 0 || target > rows.length - 1) return false;
        var rt = rows[target];
        if (!rt.nodes.length) return false;
        row = target;
        idx = lastIdx[row] || 0;
        if (idx > rt.nodes.length - 1) idx = rt.nodes.length - 1;
        lastIdx[row] = idx;
        onFocus(rt.nodes[idx]);
        return true;
      };

      /* Индекс узла в его ряду и номер ряда — нужен сетке, чтобы понять,
         что фокус дошёл до последней строки карточек. */
      this.position = function () {
        clampRow();
        return { row: row, index: idx, length: rows[row] ? rows[row].nodes.length : 0, cols: (rows[row] && rows[row].cols) || 0 };
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

      /* Поколение: destroy() поднимает, все отложенные колбэки замолкают. */
      var gen = 0;
      /* Дескрипторы {clear} незавершённых запросов коллажей. */
      var handles = [];
      var groups = [];
      var manifest = null;
      var activeGroup = '';
      var chipNodes = [];
      var tileNodes = [];
      var lastFocus = null;
      var started = false;
      var nav = new Nav(function (node) { focusNode(node); });

      function alive(captured) {
        return function () { return gen === captured; };
      }

      function focusNode(node) {
        lastFocus = node;
        try {
          Lampa.Controller.collectionFocus(node, root[0]);
          scroll.update($(node), false);
        } catch (e) {
          warn('hub: focus failed', e);
        }
      }

      function refreshNav() {
        nav.set([
          { nodes: chipNodes, cols: chipNodes.length || 1 },
          { nodes: tileNodes, cols: HUB_COLS }
        ]);
      }

      /* Коллекция .selector пересобирается после каждой перестройки плиток —
         иначе Navigator держал бы узлы снятой группы. */
      function recollect(focusOn) {
        try {
          Lampa.Controller.collectionSet(root[0]);
          refreshNav();
          nav.focus(focusOn || null);
        } catch (e) {
          warn('hub: collection failed', e);
        }
      }

      /* Коллаж постеров одной плитки. Запрос идёт через тот же
         LC.sources.fetch, что и ряды главной: кэш TMDB общий, повторное
         открытие хаба в сеть не ходит. */
      function loadCollage(item, node) {
        if (node.lumen_collage) return;
        node.lumen_collage = true;
        var captured = gen;
        var handle = LC.sources['fetch'](item, 1, function (json) {
          if (gen !== captured) return;
          var paths = collage(json && json.results, COLLAGE_SIZE);
          var box = $(node).find('.lumen-tile__collage');
          box.empty();
          for (var i = 0; i < paths.length; i++) {
            var url = imageUrl(paths[i], 'w342');
            if (!url) continue;
            var poster = $('<div class="lumen-tile__poster lumen-tile__poster--' + (i + 1) + '"></div>');
            poster.css('background-image', 'url("' + url + '")');
            box.append(poster);
          }
          if (paths.length) $(node).addClass('lumen-tile--filled');
        }, function (err) {
          if (gen !== captured) return;
          /* Кинопоиск без ключа — единственная ошибка, о которой стоит
             сказать пользователю: подборка откроется, но будет пустой. */
          if (err && err.nokey) $(node).addClass('lumen-tile--nokey');
        }, alive(captured));
        if (handle) handles.push(handle);
      }

      function tileNode(item) {
        var group = null;
        var i;
        for (i = 0; manifest && manifest.groups && i < manifest.groups.length; i++) {
          if (manifest.groups[i].id === item.group) { group = manifest.groups[i]; break; }
        }
        var sub = item.badge || titleOf(group, lang());
        var node = $(
          '<div class="lumen-tile selector">' +
            '<div class="lumen-tile__collage"></div>' +
            '<div class="lumen-tile__scrim"></div>' +
            '<div class="lumen-tile__text">' +
              '<div class="lumen-tile__title">' + esc(item.title) + '</div>' +
              '<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
            '</div>' +
            '<div class="lumen-tile__nokey">' + esc(LC.lang('lumen_hub_nokey')) + '</div>' +
          '</div>'
        );
        node.on('hover:focus', function () {
          lastFocus = node[0];
          nav.sync(node[0]);
          loadCollage(item, node[0]);
        });
        node.on('hover:enter', function () {
          openCollection(item);
        });
        return node[0];
      }

      function buildTiles(groupId) {
        activeGroup = groupId;
        var list = tilesFor(manifest, groupId);
        tilesRow.empty();
        tileNodes = [];
        for (var i = 0; i < list.length; i++) {
          var node = tileNode(list[i]);
          tilesRow.append(node);
          tileNodes.push(node);
        }
        for (var j = 0; j < tileNodes.length && j < COLLAGE_EAGER; j++) {
          loadCollage(list[j], tileNodes[j]);
        }
        for (var c = 0; c < chipNodes.length; c++) {
          $(chipNodes[c]).toggleClass('lumen-chip--on', chipNodes[c].lumen_group === groupId);
        }
      }

      function chipNode(group) {
        var node = $('<div class="lumen-chip selector">' + esc(group.title) + '<span class="lumen-chip__count">' + group.count + '</span></div>');
        node[0].lumen_group = group.id;
        node.on('hover:focus', function () { lastFocus = node[0]; nav.sync(node[0]); });
        node.on('hover:enter', function () {
          if (activeGroup === group.id) return;
          buildTiles(group.id);
          recollect(node[0]);
        });
        return node[0];
      }

      function buildHead() {
        var total = 0;
        for (var i = 0; i < groups.length; i++) total += groups[i].count;
        head.empty();
        head.append($('<div class="lumen-hub__title">' + esc(LC.lang('lumen_hub_title')) + '</div>'));
        head.append($('<div class="lumen-hub__count">' + total + ' ' + esc(LC.collectionsWord(total)) + '</div>'));
        /* Место под поиск по подборкам (design-spec-main §0.8). Узел скрыт
           классом .hide до Task 27 — он же держит для поиска его место в
           шапке, чтобы раскладка не переехала при включении. */
        head.append($('<div class="lumen-hub__search hide">' + esc(LC.lang('lumen_hub_search')) + '</div>'));
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
           активности, что уже не на экране (Lampa зовёт start у слайда при
           возврате), — перехватывать контроллер ей нельзя. */
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) {}
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        Lampa.Controller.add('content', {
          toggle: function () {
            Lampa.Controller.collectionSet(root[0]);
            refreshNav();
            nav.focus(lastFocus);
          },
          left: function () {
            if (!nav.move('left')) Lampa.Controller.toggle('menu');
          },
          right: function () {
            nav.move('right');
          },
          up: function () {
            if (!nav.move('up')) Lampa.Controller.toggle('head');
          },
          down: function () {
            nav.move('down');
          },
          back: function () {
            Lampa.Activity.backward();
          }
        });
        Lampa.Controller.toggle('content');
      };

      this.pause = function () {};
      this.stop = function () {};

      this.destroy = function () {
        gen++;
        for (var i = 0; i < handles.length; i++) {
          try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
        }
        handles = [];
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
      /* Сырые карточки всех загруженных страниц — из них пересобирается
         список при локальной сортировке, без повторного запроса. */
      var raw = [];
      var cardNodes = [];
      var sortNodes = [];
      var lastFocus = null;
      var started = false;
      var nav = new Nav(function (node) { focusNode(node); });

      function alive(captured) {
        return function () { return gen === captured; };
      }

      function focusNode(node) {
        lastFocus = node;
        try {
          Lampa.Controller.collectionFocus(node, root[0]);
          scroll.update($(node), false);
        } catch (e) {
          warn('grid: focus failed', e);
        }
      }

      function refreshNav() {
        nav.set([
          { nodes: sortNodes, cols: sortNodes.length || 1 },
          { nodes: cardNodes, cols: GRID_COLS }
        ]);
      }

      function recollect(focusOn) {
        try {
          Lampa.Controller.collectionSet(root[0]);
          refreshNav();
          nav.focus(focusOn || null);
        } catch (e) {
          warn('grid: collection failed', e);
        }
      }

      /* Догрузка следующей страницы, когда фокус дошёл до последней строки
         карточек. Так страница листается ровно по мере надобности — на ТВ
         сразу весь список не грузится (требование Task 17).
         Зовётся ТОЛЬКО из обработчиков пульта, а не из focusNode: фокус
         ставится и программно (recollect после каждой пришедшей страницы), и
         тогда цепочка «страница пришла -> фокус -> догрузка» крутилась бы
         сама. Живая проверка на «Супергероях» показала ровно это: сетка
         набирала 320 карточек за один заход. По той же причине не
         используется Lampa.Scroll.onEnd — он срабатывает на КАЖДОМ
         обновлении позиции скролла, в том числе на нашем же scroll.update. */
      function maybeNextPage() {
        var pos = nav.position();
        if (pos.row !== 1) return;
        var lastRowStart = Math.max(0, cardNodes.length - GRID_COLS);
        if (pos.index >= lastRowStart) loadNext();
      }

      function cardNode(card) {
        var poster = imageUrl(card.poster_path, 'w342');
        var node = $(
          '<div class="lumen-gcard selector">' +
            '<div class="lumen-gcard__view"></div>' +
            '<div class="lumen-gcard__title">' + esc(card.title || card.name || '') + '</div>' +
            '<div class="lumen-gcard__meta">' + esc(cardMeta(card)) + '</div>' +
          '</div>'
        );
        if (poster) node.find('.lumen-gcard__view').css('background-image', 'url("' + poster + '")');
        else node.find('.lumen-gcard__view').addClass('lumen-gcard__view--empty');
        /* Данные карточки — в нативном свойстве узла, как у штатной карточки
           Lampa (app.min.js 51914): по нему их находит и Task 18 (герой). */
        node[0].card_data = card;
        node.on('hover:focus', function () { lastFocus = node[0]; nav.sync(node[0]); });
        node.on('hover:enter', function () { openCard(card); });
        return node[0];
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
        var text = reason === 'nokey' ? LC.lang('lumen_hub_nokey_text') : LC.lang('lumen_hub_empty');
        var box = $('<div class="lumen-grid__empty"><div class="lumen-grid__empty-text">' + esc(text) + '</div></div>');
        var back = $('<div class="lumen-grid__back selector">' + esc(LC.lang('lumen_grid_back')) + '</div>');
        back.on('hover:enter', function () { Lampa.Activity.backward(); });
        box.append(back);
        itemsRow.append(box);
        cardNodes.push(back[0]);
      }

      /* Одна страница подборки. mode='reset' — первая страница после смены
         сортировки (список карточек собирается заново). */
      function loadPage(nextPage, reset) {
        if (loading) return;
        loading = true;
        try { self.activity.loader(true); } catch (e) {}
        var captured = gen;
        var request = needsLocalSort(item) ? item : applySort(item, sortMode);
        var handle = LC.sources['fetch'](request, nextPage, function (json) {
          if (gen !== captured) return;
          loading = false;
          try { self.activity.loader(false); } catch (e2) {}
          page = json.page || nextPage;
          totalPages = json.total_pages || 1;
          totalResults = json.total_results || (json.results || []).length;
          if (reset) raw = [];
          raw = raw.concat(json.results || []);
          var list = json.results || [];
          if (needsLocalSort(item)) list = sortLocal(raw, sortMode);
          if (reset || needsLocalSort(item)) {
            itemsRow.empty();
            cardNodes = [];
          }
          if (!list.length && !cardNodes.length) showEmpty('');
          else appendCards(list);
          renderSub();
          if (started) recollect(reset ? null : lastFocus);
        }, function (err) {
          if (gen !== captured) return;
          loading = false;
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
        /* Коллекции, списки TMDB и Кинопоиск отдают всё одной страницей —
           у них total_pages = 1, и сюда мы не доходим. */
        loadPage(page + 1, false);
      }

      function sortNode(mode) {
        var node = $('<div class="lumen-chip selector">' + esc(LC.lang(mode.key)) + '</div>');
        node[0].lumen_sort = mode.id;
        node.on('hover:focus', function () { lastFocus = node[0]; nav.sync(node[0]); });
        node.on('hover:enter', function () {
          if (sortMode === mode.id) return;
          sortMode = mode.id;
          for (var i = 0; i < sortNodes.length; i++) {
            $(sortNodes[i]).toggleClass('lumen-chip--on', sortNodes[i].lumen_sort === sortMode);
          }
          /* Коллекция, список TMDB и Кинопоиск приходят целиком одной
             страницей — их достаточно переставить на месте, в сеть за тем же
             ответом не ходим. Для discover порядок задаёт сам TMDB, поэтому
             там нужен новый запрос с первой страницы. */
          if (needsLocalSort(item) && raw.length) {
            itemsRow.empty();
            cardNodes = [];
            appendCards(sortLocal(raw, sortMode));
            renderSub();
            recollect(node[0]);
            return;
          }
          page = 1;
          loadPage(1, true);
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
        $(sortNodes[0]).addClass('lumen-chip--on');
        root.append(sortsRow);
        root.append(itemsRow);
        scroll.append(root);
        loadPage(1, true);
      };

      this.render = function (js) {
        return js ? scroll.render(true) : scroll.render();
      };

      this.start = function () {
        /* Тот же гард, что у штатных компонентов: 'start' приходит и той
           активности, что уже не на экране (Lampa зовёт start у слайда при
           возврате), — перехватывать контроллер ей нельзя. */
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) {}
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        Lampa.Controller.add('content', {
          toggle: function () {
            Lampa.Controller.collectionSet(root[0]);
            refreshNav();
            nav.focus(lastFocus);
          },
          left: function () {
            if (!nav.move('left')) Lampa.Controller.toggle('menu');
          },
          right: function () {
            if (nav.move('right')) maybeNextPage();
          },
          up: function () {
            if (!nav.move('up')) Lampa.Controller.toggle('head');
          },
          down: function () {
            if (nav.move('down')) maybeNextPage();
          },
          back: function () {
            Lampa.Activity.backward();
          }
        });
        Lampa.Controller.toggle('content');
      };

      this.pause = function () {};
      this.stop = function () {};

      this.destroy = function () {
        gen++;
        for (var i = 0; i < handles.length; i++) {
          try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) {}
        }
        handles = [];
        cardNodes = [];
        sortNodes = [];
        lastFocus = null;
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

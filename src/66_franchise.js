  /* -------------------------------------------------------------------- */
  /* Task 28 (фаза 3): хронология франшизы — ряд «Смотреть по порядку» в    */
  /* блоке описания карточки.                                              */
  /*                                                                       */
  /* Место то же, что у отзывов (Task 9): своего типа ряда в Lampa создать  */
  /* нельзя (план 0.2), а контроллер full_descr собирает .selector внутри    */
  /* всего ряда описания — поэтому блок встраивается в .full-descr соседом   */
  /* таблицы «ПОДРОБНО» и ряда отзывов. Отсюда же и весь жизненный цикл,     */
  /* один в один с src/60_reviews.js: подпись + поколение на узле ряда,      */
  /* снятие незавершённого запроса при смене карточки (clearRow) и при её    */
  /* закрытии (cancel из LC.destroyActive), проверка «карточка всё ещё на    */
  /* экране» перед отдачей .selector в навигацию.                            */
  /*                                                                        */
  /* Данные — штатный запрос TMDB collection/{id} через Lampa.Api.sources.    */
  /* tmdb.get с кэшем на неделю: состав коллекции меняется от силы раз в     */
  /* несколько лет. Кнопка «Франшиза» (Task 17, src/46_hub.js) остаётся на    */
  /* месте и открывает ту же коллекцию целой сеткой — здесь же порядок       */
  /* просмотра с отметками, то есть другой вопрос к тем же данным.           */
  /*                                                                        */
  /* Порядков три, но выбор пользователю дан из двух (чипы «По годам» и      */
  /* «По рейтингу»): 'chronology' — базовая сортировка по дате премьеры,     */
  /* 'release' — она же с переносом невышедших частей в конец и пометкой     */
  /* «Скоро», 'rating' — по оценке. Отдельного чипа у 'chronology' нет       */
  /* намеренно: на экране он отличался бы от 'release' только местом         */
  /* анонсов, а зовётся он из самого release (см. orderParts).               */
  /* -------------------------------------------------------------------- */

  LC.franchise = (function () {

    /* Состав коллекции TMDB — статичные данные (те же LIFE_STATIC, что у
       LC.sources для collection/list): кэш Lampa на неделю. */
    var LIFE = 10080;
    /* Граница «просмотрено» — та же, что у LC.hub, LC.cardmenu и плана. */
    var WATCHED = 95;
    /* Постер части: ряд рисует их высотой ~9em, w300 — тот же размер, каким
       Lampa рисует постеры своих рядов. */
    var POSTER = 'w300';
    var ORDER_KEY = 'lumen_franchise_order';

    var esc = LC.util.esc;

    /* ------------------------------------------------------------------ */
    /* Чистая часть.                                                       */
    /* ------------------------------------------------------------------ */

    function dateOf(part) {
      return '' + ((part && (part.release_date || part.first_air_date)) || '');
    }

    /* Сохранённый режим порядка. Незнакомое значение (пустой Storage, ручная
       правка) — 'release': именно его показывают чипы первым. */
    function orderFor(stored) {
      if (stored === 'rating' || stored === 'chronology') return stored;
      return 'release';
    }

    /* Наш элемент ряда. Исходный объект части TMDB не мутируется и не
       копируется: он лежит в кэше Lampa и тем же объектом уходит в
       Activity.push как card. */
    function itemOf(part, index) {
      var date = dateOf(part);
      return {
        card: part,
        index: index,
        id: part && part.id,
        title: (part && (part.title || part.name)) || '',
        original: (part && (part.original_title || part.original_name)) || '',
        date: date,
        year: date ? date.slice(0, 4) : '',
        poster: (part && part.poster_path) || '',
        rating: Number(part && part.vote_average) || 0,
        upcoming: false,
        watched: false,
        current: false,
        next: false,
        num: index + 1
      };
    }

    /* Сортировка стабильная во всех движках: Array.prototype.sort
       стабильность не обещает (ES5), поэтому при равных ключах решает
       исходный индекс. */
    function sortBy(list, key) {
      list.sort(function (a, b) {
        var d = key(a, b);
        if (d) return d;
        return a.index - b.index;
      });
      return list;
    }

    function cmpDate(a, b) {
      /* Часть без даты (анонс без числа) уходит в конец: '9999' больше любой
         реальной даты в формате YYYY-MM-DD. */
      var da = a.date || '9999';
      var db = b.date || '9999';
      if (da < db) return -1;
      if (da > db) return 1;
      return 0;
    }

    /* today — объект Date; в 'release' по нему отделяются невышедшие части. */
    function orderParts(parts, mode, today) {
      var list = [];
      if (!parts || typeof parts.length !== 'number') return list;
      for (var i = 0; i < parts.length; i++) {
        if (!parts[i]) continue;
        list.push(itemOf(parts[i], list.length));
      }
      /* Пометка «ещё не вышла» ставится во ВСЕХ порядках: невышедшая часть не
         может стать ни «Дальше», ни просмотренной, в каком бы порядке ряд ни
         был отсортирован (живая проверка 2026-09-17: в порядке «по рейтингу»
         анонс «Дюна: Часть третья» получал пометку «Дальше», хотя смотреть
         его негде). В конец списка такие части переносит только 'release'. */
      var stamp = stampOf(today);
      for (var u = 0; u < list.length; u++) {
        if (list[u].date && list[u].date > stamp) list[u].upcoming = true;
      }
      if (mode === 'rating') {
        sortBy(list, function (a, b) { return b.rating - a.rating; });
      } else {
        sortBy(list, cmpDate);
        if (mode !== 'chronology') {
          var out = [];
          var later = [];
          for (var k = 0; k < list.length; k++) {
            if (list[k].upcoming) later.push(list[k]);
            else out.push(list[k]);
          }
          list = out.concat(later);
        }
      }
      for (var n = 0; n < list.length; n++) list[n].num = n + 1;
      return list;
    }

    /* Сегодняшняя дата в формате TMDB (YYYY-MM-DD) — сравнение строк, как в
       LC.badges: часовых поясов у даты премьеры всё равно нет. */
    function stampOf(today) {
      var d = (today && today.getFullYear) ? today : new Date();
      return d.getFullYear() + '-' + LC.util.pad2(d.getMonth() + 1) + '-' + LC.util.pad2(d.getDate());
    }

    /* ctx: { percent(item) → процент просмотра, currentId → id открытого
       фильма }. Оба необязательны: без контекста ряд просто рисуется без
       отметок. */
    function markWatched(list, ctx) {
      if (!list || typeof list.length !== 'number') return [];
      ctx = ctx || {};
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var percent = 0;
        if (typeof ctx.percent === 'function') {
          try { percent = Number(ctx.percent(item)) || 0; } catch (e) { percent = 0; }
        }
        item.watched = percent >= WATCHED;
        item.current = ctx.currentId != null && String(item.id) === String(ctx.currentId);
      }
      return list;
    }

    /* Первая непросмотренная часть ПОСЛЕ текущей; текущей в списке нет —
       первая непросмотренная вообще. Невышедшие частями «Дальше» не
       становятся: смотреть их пока негде. Пометка ставится на самом
       элементе — разметке нужен только флаг. */
    function nextToWatch(list) {
      if (!list || typeof list.length !== 'number') return null;
      var from = 0;
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].current) { from = i + 1; break; }
      }
      for (var k = from; k < list.length; k++) {
        var item = list[k];
        if (!item || item.watched || item.upcoming || item.current) continue;
        item.next = true;
        return item;
      }
      return null;
    }

    /* ------------------------------------------------------------------ */
    /* Строки интерфейса.                                                  */
    /* ------------------------------------------------------------------ */

    function lang(key) {
      try {
        if (typeof LC.lang === 'function') return LC.lang(key);
      } catch (e) { }
      return key;
    }

    /* ------------------------------------------------------------------ */
    /* Разметка.                                                           */
    /* ------------------------------------------------------------------ */

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

    function posterUrl(path) {
      try {
        return LC.cardinfo.imageUrl(path, POSTER, tmdbImageFn(), apiImgFn());
      } catch (e) {
        return '';
      }
    }

    function flagOf(item) {
      if (item.current) return { cls: 'current', text: lang('lumen_fr_here') };
      if (item.next) return { cls: 'next', text: lang('lumen_fr_next') };
      if (item.upcoming) return { cls: 'soon', text: lang('lumen_badge_soon') };
      if (item.watched) return { cls: 'watched', text: lang('lumen_fr_watched') };
      return null;
    }

    function cardHtml(item, total) {
      var url = posterUrl(item.poster);
      var flag = flagOf(item);
      var mods = '';
      if (item.current) mods += ' lumen-fr-card--current';
      if (item.watched) mods += ' lumen-fr-card--watched';
      if (item.next) mods += ' lumen-fr-card--next';
      if (item.upcoming) mods += ' lumen-fr-card--soon';
      /* Пустой background-image оставил бы style="" на узле (ловушка плана
         0.2), поэтому без постера ставится 'none'. */
      return '<div class="lumen-fr-card selector' + mods + '" data-lumen-fr="' + item.index + '">' +
        '<div class="lumen-fr-card__poster" style="background-image:' + (url ? 'url(&quot;' + esc(encodeURI(url)) + '&quot;)' : 'none') + '">' +
        '<div class="lumen-fr-card__mark"></div>' +
        '</div>' +
        '<div class="lumen-fr-card__num">' + esc('№ ' + item.num + ' ' + lang('lumen_fr_of') + ' ' + total) + '</div>' +
        '<div class="lumen-fr-card__name">' + esc(item.title) + '</div>' +
        '<div class="lumen-fr-card__year">' + esc(item.year) + '</div>' +
        (flag ? '<div class="lumen-fr-card__flag lumen-fr-card__flag--' + flag.cls + '">' + esc(flag.text) + '</div>' : '') +
        '</div>';
    }

    function modeHtml(id, label, active) {
      return '<div class="lumen-fr__mode selector' + (active ? ' lumen-fr__mode--on' : '') +
        '" data-lumen-fr-order="' + id + '">' + esc(label) + '</div>';
    }

    function headHtml(name, order) {
      return '<div class="lumen-fr__head">' +
        '<span class="lumen-fr__ico"></span>' +
        '<span class="lumen-fr__title">' + esc(lang('lumen_fr_title')) + '</span>' +
        (name ? '<span class="lumen-fr__name">' + esc(name) + '</span>' : '') +
        '<div class="lumen-fr__modes">' +
        modeHtml('release', lang('lumen_fr_order_release'), order !== 'rating') +
        modeHtml('rating', lang('lumen_sort_rating'), order === 'rating') +
        '</div>' +
        '</div>';
    }

    function bodyHtml(list, name, order) {
      var cards = [];
      for (var i = 0; i < list.length; i++) cards.push(cardHtml(list[i], list.length));
      return headHtml(name, order) + '<div class="lumen-fr__row">' + cards.join('') + '</div>';
    }

    /* ------------------------------------------------------------------ */
    /* Состояние ряда.                                                     */
    /* ------------------------------------------------------------------ */

    function holderOf(row) {
      if (!row || !row.length || typeof row.find !== 'function') return null;
      var holder = row.find('.full-descr');
      return holder && holder.length ? holder : null;
    }

    function stateOf(holder) {
      var node = holder[0];
      if (!node.lumenFranchise) {
        node.lumenFranchise = { sign: '', gen: 0, painted: false, net: null, parts: null, movie: null, row: null, list: null };
      }
      return node.lumenFranchise;
    }

    function dropNet(state) {
      if (!state) return;
      if (state.net && typeof state.net.clear === 'function') {
        try { state.net.clear(); } catch (e) { }
      }
      state.net = null;
    }

    function clearBlock(holder) {
      try {
        var old = holder.find('.lumen-fr');
        if (old && old.length) old.remove();
      } catch (e) { }
    }

    /* Узел ещё в документе и его активность сейчас на экране — та же
       проверка, что у отзывов и кнопки «Стоп» трейлера: карточка, оставленная
       в истории Lampa, остаётся живым DOM, и её .selector отдавать в
       навигацию нельзя. */
    function isForeground(node) {
      try {
        if (LC.slideshow && typeof LC.slideshow.isMounted === 'function' && !LC.slideshow.isMounted(node[0])) return false;
        if (LC.slideshow && typeof LC.slideshow.isLayerForeground === 'function') return !!LC.slideshow.isLayerForeground(node);
      } catch (e) { }
      return true;
    }

    /* ------------------------------------------------------------------ */
    /* Отметки просмотра.                                                  */
    /* ------------------------------------------------------------------ */

    function hashOf(key) {
      try {
        if (!key || !window.Lampa || !Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return 0;
        return Lampa.Utils.hash(key);
      } catch (e) {
        return 0;
      }
    }

    /* Ключ прогресса — тот же, что считает LC.cardmenu.watchKey (у Lampa для
       фильма это Utils.hash(original_title)); своей копии формулы здесь нет
       намеренно, чтобы отметка в ряду и отметка в меню карточки не разошлись. */
    function watchKey(part) {
      try {
        if (LC.cardmenu && typeof LC.cardmenu.watchKey === 'function') return LC.cardmenu.watchKey(part);
      } catch (e) { }
      return (part && (part.original_title || part.original_name || part.title || part.name)) || '';
    }

    function percentOf(item) {
      try {
        var hash = hashOf(watchKey(item.card));
        if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return 0;
        var view = Lampa.Timeline.view(hash);
        return Number(view && view.percent) || 0;
      } catch (e) {
        return 0;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Рендер.                                                             */
    /* ------------------------------------------------------------------ */

    function storedOrder() {
      try {
        return orderFor(LC.pref ? LC.pref(ORDER_KEY, 'release') : 'release');
      } catch (e) {
        return 'release';
      }
    }

    function paint(holder, state) {
      var order = storedOrder();
      var list = markWatched(orderParts(state.parts, order, new Date()), {
        percent: percentOf,
        currentId: state.movie && state.movie.id
      });
      nextToWatch(list);
      state.list = list;

      var block = holder.find('.lumen-fr');
      if (!block || !block.length || block.hasClass('lumen-fr--sk')) {
        clearBlock(holder);
        block = $('<div class="lumen-fr"></div>');
        holder.append(block);
        bind(block, holder);
      }
      block.html(bodyHtml(list, state.name, order));
      appendSelectors(block);
      return block;
    }

    /* Плашки на месте карточек, пока идёт запрос коллекции. Узел носит тот же
       класс .lumen-fr, поэтому его снимает общий clearBlock: отдельной уборки
       скелетону не нужно — колбэк приходит при любом исходе, пока жив сторож
       поколения, а если сторож мёртв, ряд уже перерисован или уничтожен
       вместе с DOM. */
    function paintSkeleton(holder) {
      var block = $('<div class="lumen-fr lumen-fr--sk"></div>');
      block.html('<div class="lumen-fr__row">' +
        '<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
        '<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
        '<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
        '<div class="lumen-fr-card lumen-fr-card--sk lumen-skeleton"></div>' +
        '</div>');
      holder.append(block);
    }

    /* Новые .selector внутри уже активного ряда описания — контроллер
       full_descr собрал коллекцию при входе и о них ещё не знает. Проверки те
       же, что у отзывов: имя контроллера И принадлежность экрану. */
    function appendSelectors(block) {
      try {
        if (!window.Lampa || !Lampa.Controller || typeof Lampa.Controller.collectionAppend !== 'function') return;
        var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (!enabled || enabled.name !== 'full_descr') return;
        if (!isForeground(block)) return;
        var nodes = block.find('.lumen-fr-card');
        if (nodes && nodes.length) Lampa.Controller.collectionAppend(nodes);
      } catch (e) {
        warn('franchise collection failed', e);
      }
    }

    function openPart(item) {
      try {
        if (!item || !item.card || !window.Lampa || !Lampa.Activity || typeof Lampa.Activity.push !== 'function') return;
        Lampa.Activity.push({
          url: '',
          title: item.title,
          component: 'full',
          id: item.id,
          method: 'movie',
          card: item.card,
          source: 'tmdb'
        });
      } catch (e) {
        warn('franchise open failed', e);
      }
    }

    /* Смена порядка. nolisten = true: событие Storage 'change' здесь не нужно
       — ряд перерисовывается прямо в обработчике, из уже загруженных данных,
       и второго запроса в сеть не уходит. */
    function setOrder(holder, value) {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.set === 'function') {
          Lampa.Storage.set(ORDER_KEY, orderFor(value), true);
        }
        var state = stateOf(holder);
        if (state.parts) paint(holder, state);
      } catch (e) {
        warn('franchise order failed', e);
      }
    }

    /* События Lampa (hover:enter) не всплывают — слушаем в фазе перехвата на
       корне блока, как ряд отзывов (src/60_reviews.js) и шапка карточки. Один
       слушатель на блок: сам блок переживает смену порядка (меняется только
       его содержимое). */
    function bind(block, holder) {
      try {
        var el = block[0];
        if (!el || typeof el.addEventListener !== 'function' || el.lumenFranchiseBound) return;
        el.lumenFranchiseBound = true;
        el.addEventListener('hover:enter', function (event) {
          try {
            var target = $(event.target);
            var mode = target.closest('.lumen-fr__mode');
            if (mode && mode.length) { setOrder(holder, mode.attr('data-lumen-fr-order')); return; }
            var card = target.closest('.lumen-fr-card');
            if (!card || !card.length) return;
            var index = parseInt(card.attr('data-lumen-fr'), 10);
            if (isNaN(index)) return;
            var state = stateOf(holder);
            var list = state.list || [];
            for (var i = 0; i < list.length; i++) {
              if (list[i].index === index) { openPart(list[i]); return; }
            }
          } catch (e) {
            warn('franchise enter failed', e);
          }
        }, true);
      } catch (err) {
        warn('franchise bind failed', err);
      }
    }

    function requestCollection(id, ok, err) {
      try {
        if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb ||
            typeof Lampa.Api.sources.tmdb.get !== 'function') return null;
        return Lampa.Api.sources.tmdb.get('collection/' + id, {}, ok, err, { life: LIFE });
      } catch (e) {
        warn('franchise request failed', e);
        return null;
      }
    }

    /* row — узел ряда описания (items_line), тот же, что получают
       LC.header.descr и LC.reviews.render. Идемпотентно: 'build'
       'description' и страховочный complite приходят с одними данными —
       второй раз рендер пропускается по подписи, повторного запроса не
       будет. */
    function render(row, data) {
      try {
        var holder = holderOf(row);
        if (!holder) return;
        row.addClass('lumen-descr-row');

        var movie = (data && data.movie) || {};
        var collection = movie.belongs_to_collection;
        var sign = [collection && collection.id, movie.id, lang('lumen_fr_title')].join('|');

        var state = stateOf(holder);
        if (state.sign === sign && (!state.painted || holder.find('.lumen-fr').length)) return;

        state.sign = sign;
        state.gen++;
        state.painted = false;
        var gen = state.gen;
        dropNet(state);
        clearBlock(holder);
        row.removeClass('lumen-descr-row--franchise');
        state.parts = null;
        state.list = null;

        if (!collection || !collection.id) return;
        state.movie = movie;
        state.name = collection.name || '';
        state.row = row;

        paintSkeleton(holder);

        state.net = requestCollection(collection.id, function (json) {
          try {
            var current = stateOf(holder);
            if (current.gen !== gen) return;
            current.net = null;
            clearBlock(holder);
            var parts = (json && json.parts) || [];
            /* Одна часть — это не франшиза: смотреть по порядку нечего, а
               кнопка «Франшиза» и так ведёт в сетку коллекции. */
            if (parts.length < 2) return;
            current.parts = parts;
            paint(holder, current);
            row.addClass('lumen-descr-row--franchise');
            current.painted = true;
          } catch (e) {
            warn('franchise paint failed', e);
          }
        }, function () {
          try {
            var current = stateOf(holder);
            if (current.gen !== gen) return;
            current.net = null;
            clearBlock(holder);
          } catch (e) {
            warn('franchise error path failed', e);
          }
        });

        /* Запроса не случилось вовсе (сборка Lampa без tmdb-источника,
           исключение внутри requestCollection) — колбэков не будет, и
           скелетон остался бы на карточке навсегда. Найдено живьём
           2026-09-17, когда инструментирование проверки сломало
           Lampa.Api.sources.tmdb.get: плашки висели до ухода с карточки. */
        if (!state.net) clearBlock(holder);
      } catch (err) {
        warn('franchise render failed', err);
      }
    }

    /* Снять блок с ряда (смена карточки, выключение плагина). */
    function clearRow(row) {
      try {
        var holder = holderOf(row);
        if (!holder) return;
        clearBlock(holder);
        row.removeClass('lumen-descr-row--franchise');
        var state = stateOf(holder);
        state.sign = '';
        state.painted = false;
        state.parts = null;
        state.list = null;
        state.gen++;
        dropNet(state);
      } catch (e) {
        warn('franchise clear failed', e);
      }
    }

    /* Карточку закрыли: LC.destroyActive зовёт это вместе с LC.reviews.cancel.
       Состояние НЕ создаём, если рендера на этом узле ещё не было. */
    function cancel(body) {
      try {
        if (!body || typeof body.find !== 'function') return;
        var holder = body.find('.full-descr');
        if (!holder || !holder.length) return;
        var node = holder[0];
        if (node && node.lumenFranchise) dropNet(node.lumenFranchise);
      } catch (e) {
        warn('franchise cancel failed', e);
      }
    }

    return {
      orderFor: orderFor,
      orderParts: orderParts,
      markWatched: markWatched,
      nextToWatch: nextToWatch,
      render: render,
      clearRow: clearRow,
      cancel: cancel
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.franchise;

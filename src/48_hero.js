  /* -------------------------------------------------------------------- */
  /* LC.hero — герой над рядами главной (Task 18).                        */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   pickLogo(logos, lang) → file_path логотипа или null                  */
  /*   mediaOf(card) → 'movie' | 'tv'                                       */
  /*   heroModel(card, details, words) → модель героя или null              */
  /*   shouldUpdate(prevId, nextId, elapsedMs, delay) → boolean             */
  /*   sizeFor(width) / logoSizeFor(width) → размер картинки TMDB           */
  /*   detailsRequest(media, id, lang) → {url, params, life}                */
  /*   mount(root, opts) — вставить героя в корень экрана                   */
  /*   mountCurrent() — смонтировать, если сейчас открыта главная           */
  /*   detach(render) — снять, если герой не принадлежит этой активности    */
  /*   owns(render) → принадлежит ли герой этой активности                  */
  /*   unmount() — снять целиком (узел, класс, наблюдатель, запросы)        */
  /*   applyMotion() — перечитать режим анимаций на открытом герое          */
  /*   active() → смонтирован ли герой                                      */
  /*                                                                       */
  /* Как работает смена героя (сториборд 23г, ограничение брифа 1):         */
  /*   - фокус карточки ловит ОДИН MutationObserver на корне активности     */
  /*     (attributeFilter ['class'], subtree) — делегирование 'hover:focus'  */
  /*     через $(document).on в Lampa 3.3.4 не работает, данные карточки    */
  /*     лежат в нативном свойстве узла el.card_data (раздел 0 плана);      */
  /*   - показ откладывается на DELAY (350 мс) и отменяется, если фокус     */
  /*     ушёл раньше: при быстром листании грузится ровно один кадр;        */
  /*   - тот же id под фокусом не грузит ни кадра, ни деталей.              */
  /*                                                                       */
  /* Сторож поколения: модульный счётчик gen поднимается на каждом mount,   */
  /* unmount и show. Любой отложенный колбэк (таймер показа, onload кадра,  */
  /* ответ деталей) сверяет захваченное значение и в снятый или уже         */
  /* сменившийся DOM не пишет. unmount() гасит наблюдатель (disconnect),    */
  /* все таймеры, предзагрузку кадра и незавершённый запрос деталей —       */
  /* герой на слабом ТВ не оставляет после себя ни одной живой подписки.    */
  /* -------------------------------------------------------------------- */

  LC.hero = (function () {

    /* Задержка перед сменой героя — раскадровка 23г брифа главной. */
    var DELAY = 350;
    /* Уход старого текста перед подменой (раскадровка 23а: 180 мс). */
    var SWAP_MS = 180;
    /* Предзагрузка кадра не может висеть вечно: тот же таймаут, что у фона
       карточки (src/50_backdrops.js). */
    var LOAD_TIMEOUT = 8000;
    /* Детали (описание, жанры, длительность, логотипы) кэшируются сутки —
       по этим полям фильм за день не меняется, а запрос идёт через прокси
       пользователя. */
    var DETAILS_LIFE = 1440;
    /* Выше этой ширины экрана кадр берём в 'original' (тот же принцип, что
       у ambient-режима фазы 3): на FHD-панелях w1280 и так по пикселю. */
    var WIDE_PX = 1366;

    var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';

    /* ------------------------------------------------------------------ */
    /* Чистые функции (без DOM, Lampa и window).                           */
    /* ------------------------------------------------------------------ */

    /* Логотип фильма из images.logos: язык интерфейса, затем английский,
       затем первый безъязыкий (такие логотипы обычно и есть «оригинальные»).
       Нет ни одного — null, и тогда рисуется текстовый заголовок
       (ограничение брифа 2, поправка контроллера: без панели-фолбэка). */
    function pickLogo(logos, lang) {
      lang = lang || 'ru';
      var own = null;
      var en = null;
      var neutral = null;
      for (var i = 0; logos && i < logos.length; i++) {
        var item = logos[i];
        if (!item || !item.file_path) continue;
        var code = item.iso_639_1 || '';
        if (code === lang) { if (!own) own = item.file_path; }
        else if (code === 'en') { if (!en) en = item.file_path; }
        else if (!code) { if (!neutral) neutral = item.file_path; }
      }
      return own || en || neutral || null;
    }

    /* Тип карточки для запроса деталей. media_type приходит из discover с
       двумя медиа; без него признак — name (у сериалов TMDB заголовок в
       name, у фильмов — в title). Та же формула, что в LC.hub.cardMedia. */
    function mediaOf(card) {
      if (card && card.media_type) return card.media_type;
      return (card && card.name) ? 'tv' : 'movie';
    }

    function yearOf(card) {
      var date = '' + ((card && (card.release_date || card.first_air_date)) || '');
      return date ? date.slice(0, 4) : '';
    }

    /* Модель героя: card — это el.card_data ряда (есть сразу), details —
       ответ movie/{id}|tv/{id} с images (приходит позже, может не прийти
       вовсе). words — строки интерфейса (собирает runtime из LC.STRINGS),
       модуль остаётся чистым и языка не знает.

       pending=true означает «деталей ещё нет» — рантайм по нему показывает
       скелетон описания (ограничение брифа 3). */
    function heroModel(card, details, words) {
      if (!card) return null;
      words = words || {};
      details = details || null;

      var media = mediaOf(card);
      var meta = [];
      var year = yearOf(card);
      if (year) meta.push(year);

      if (details) {
        if (media === 'tv') {
          var seasons = Number(details.number_of_seasons) || 0;
          if (seasons > 0) {
            meta.push(seasons + ' ' + (words.seasonsWord ? words.seasonsWord(seasons) : ''));
          }
        } else {
          var runtime = LC.util.fmtRuntime(Number(details.runtime) || 0, words.min || '');
          if (runtime) meta.push(runtime);
        }
        var genres = LC.cardinfo.genres(details.genres, words.cap);
        if (genres.length) meta.push(genres.join(', '));
      }

      /* Статус сериала — текстом «Выходит · 17 дек» (поправка контроллера к
         Task 18: чип обратного отсчёта остаётся в карточке, фаза 1 Task 5c). */
      var status = '';
      var next = details && details.next_episode_to_air;
      if (next && next.air_date) {
        var when = LC.cardinfo.shortDate(next.air_date, words.months);
        if (when) status = (words.airing || '') + ' · ' + when;
      }

      var vote = Number(card.vote_average) || 0;

      return {
        id: card.id,
        media: media,
        title: card.title || card.name || '',
        backdrop: (details && details.backdrop_path) || card.backdrop_path || '',
        poster: card.poster_path || (details && details.poster_path) || '',
        logo: details ? pickLogo(details.images && details.images.logos, words.lang) : null,
        meta: meta,
        overview: (details && details.overview) || card.overview || '',
        rating: vote > 0 ? vote.toFixed(1) : '',
        status: status,
        pending: !details
      };
    }

    /* Пора ли менять героя: тот же фильм под фокусом или пауза фокуса
       короче задержки — нет (бриф, ограничение 1: фон при быстром листании
       не мигает). */
    function shouldUpdate(prevId, nextId, elapsedMs, delay) {
      if (nextId == null) return false;
      if (prevId === nextId) return false;
      return (elapsedMs || 0) >= (delay || 0);
    }

    /* Размер кадра под экран: на FHD и ниже w1280 покрывает ширину целиком,
       выше (2K/4K-панели) — original. Ширина неизвестна — берём дешёвый. */
    function sizeFor(width) {
      return (Number(width) || 0) > WIDE_PX ? 'original' : 'w1280';
    }

    /* Логотип рисуется шириной до 30.69em (700 px FHD / 1400 px 4K), поэтому
       w500/w780 — тот же порог, что у кадра. */
    function logoSizeFor(width) {
      return (Number(width) || 0) > WIDE_PX ? 'w780' : 'w500';
    }

    /* Языки логотипов: язык интерфейса + английский + безъязыкие. */
    function imageLanguages(lang) {
      lang = lang || 'ru';
      return lang === 'en' ? 'en,null' : lang + ',en,null';
    }

    /* Запрос деталей. Язык ответа НЕ задаём (в отличие от буквы плана с
       langs:'ru-RU'): Lampa подставляет язык интерфейса пользователя сама —
       проверено живьём, ответ tv/76479 без langs пришёл по-русски при
       русском интерфейсе. Навязывать ru пользователю с английской Lampa
       герой не должен. */
    function detailsRequest(media, id, lang) {
      return {
        url: media + '/' + id,
        params: { filter: { append_to_response: 'images', include_image_language: imageLanguages(lang) } },
        life: DETAILS_LIFE
      };
    }

    /* ------------------------------------------------------------------ */
    /* Runtime: DOM, Lampa, сеть.                                          */
    /* ------------------------------------------------------------------ */

    /* Единственный смонтированный герой за всё время жизни плагина: mount()
       любого нового корня сначала снимает предыдущего. Отсюда и «ровно один
       наблюдатель» — второго просто некуда положить. */
    var state = null;

    /* Сторож поколения: поднимается на mount, unmount и каждом show. */
    var gen = 0;

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
       путём, что фон карточки и плитки хаба. */
    function imageUrl(path, size) {
      try {
        return LC.cardinfo.imageUrl(path, size, tmdbImageFn(), apiImgFn());
      } catch (e) {
        return '';
      }
    }

    function screenWidth() {
      try {
        return window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
      } catch (e) {
        return 0;
      }
    }

    function langCode() {
      try {
        if (typeof LC.langCode === 'function') return LC.langCode();
      } catch (e) {}
      return 'ru';
    }

    /* Строки героя из LC.STRINGS + склонение сезонов; capitalize — штатная
       функция Lampa (имена жанров TMDB приходят строчными). */
    function words() {
      var months = [];
      try { months = ('' + LC.lang('lumen_card_months_short')).split(','); } catch (e) {}
      var cap = null;
      try {
        if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
          cap = function (s) { return Lampa.Utils.capitalizeFirstLetter(s); };
        }
      } catch (eCap) {}
      return {
        min: LC.lang('lumen_card_min'),
        airing: LC.lang('lumen_hero_airing'),
        months: months,
        seasonsWord: LC.seasonsWord,
        cap: cap,
        lang: langCode()
      };
    }

    /* Разметка героя. Все узлы — div: логотип рисуется фоном (background-
       image, contain), поэтому отдельного <img> нет, а значит нет и второго
       пути загрузки картинок мимо прокси TMDB.
       Два слоя кадра с разными модификаторами (--a/--b) вместо двух
       одинаковых классов: кроссфейд обращается к конкретному слою, а не к
       набору из двух узлов. */
    function buildNode() {
      var node = $('<div class="lumen-hero">' +
        '<div class="lumen-hero__bg lumen-hero__bg--a"></div>' +
        '<div class="lumen-hero__bg lumen-hero__bg--b"></div>' +
        '<div class="lumen-hero__veil lumen-hero__veil--l"></div>' +
        '<div class="lumen-hero__veil lumen-hero__veil--b"></div>' +
        '</div>');
      var text = $('<div class="lumen-hero__text">' +
        '<div class="lumen-hero__meta"></div>' +
        /* Task 25: общий класс .lumen-skeleton — от него плашки получают
           пульсацию в режиме полных анимаций и остаются статичными в
           lite/off (одно правило на все скелетоны плагина, src/30_css.js). */
        '<div class="lumen-hero__sk lumen-hero__sk--meta lumen-skeleton"></div>' +
        '<div class="lumen-hero__logo"></div>' +
        '<div class="lumen-hero__title"></div>' +
        '<div class="lumen-hero__descr"></div>' +
        '<div class="lumen-hero__sk lumen-hero__sk--descr lumen-skeleton"></div>' +
        '<div class="lumen-hero__sk lumen-hero__sk--short lumen-skeleton"></div>' +
        '<div class="lumen-hero__chips">' +
        '<div class="lumen-hero__rate"></div>' +
        '<div class="lumen-hero__status"></div>' +
        '</div>' +
        '</div>');
      node.append(text);
      return node;
    }

    /* Герой ещё в документе и его корень не выброшен Lampa. */
    function isMounted() {
      try {
        var el = state && state.node && state.node[0];
        return !!(el && document.body && document.body.contains && document.body.contains(el));
      } catch (e) {
        /* В тестовом окружении document.body нет — считаем смонтированным,
           пока state жив: живой сторож здесь — gen, а не DOM. */
        return !!state;
      }
    }

    function applyMotion() {
      try {
        if (!state) return;
        state.node.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
      } catch (e) {
        warn('hero: motion failed', e);
      }
    }

    function motionMode() {
      try { return LC.motionMode(); } catch (e) { return 'full'; }
    }

    /* ------------------------------------------------------------------ */
    /* Отмена всего, что может доехать позже.                              */
    /* ------------------------------------------------------------------ */

    function stopTimer(name) {
      if (!state || !state[name]) return;
      try { clearTimeout(state[name]); } catch (e) {}
      state[name] = null;
    }

    /* Гасит предзагрузку кадра и запрос деталей текущего показа. Обработчики
       снимаются (onload/onerror = null) — сеть их больше не вызовет; gen
       остаётся запасной сетью на случай, если колбэк уже в очереди. */
    function cancelPending() {
      if (!state) return;
      stopTimer('loadTimer');
      stopTimer('swapTimer');
      if (state.loader) {
        state.loader.onload = null;
        state.loader.onerror = null;
        state.loader = null;
      }
      if (state.net) {
        try { if (state.net.clear) state.net.clear(); } catch (e) {}
        state.net = null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Отрисовка.                                                          */
    /* ------------------------------------------------------------------ */

    /* Записывает модель в узлы. swap=true — смена карточки (текст уходит и
       возвращается), иначе это дорисовка деталей той же карточки: она
       обязана быть без анимации, иначе герой дёргался бы дважды на каждую
       карточку. В режимах lite/off подмена мгновенная в обоих случаях.

       Найдено живьём (первый круг Task 18): write() обязана брать модель из
       state.model, а не из замыкания. Ответ деталей из кэша Lampa приходит
       СИНХРОННО, ещё до того как сработает отложенная на 180 мс подмена
       текста, — и та возвращала на экран модель без деталей: мета съезжала
       обратно на голый год, а скелетон загорался навсегда. */
    function render(model, swap) {
      if (!state || !model) return;
      var node = state.node;
      state.model = model;

      function write() {
        if (!state || !state.model) return;
        var current = state.model;
        var text = node.find('.lumen-hero__text');
        node.find('.lumen-hero__meta').text(current.meta.join(' · '));
        node.find('.lumen-hero__title').text(current.title);
        node.find('.lumen-hero__descr').text(current.overview);
        node.find('.lumen-hero__rate').text(current.rating);
        node.find('.lumen-hero__status').text(current.status);
        node.toggleClass('lumen-hero--rated', !!current.rating);
        node.toggleClass('lumen-hero--status', !!current.status);
        node.toggleClass('lumen-hero--pending', !!current.pending);
        /* Скелетон описания нужен, только если описания нет вовсе: в данных
           ряда overview обычно уже есть, и плашки поверх готового текста
           были бы ложным «грузится» (ограничение брифа 3). */
        node.toggleClass('lumen-hero--nodescr', !current.overview);

        var logoUrl = current.logo ? imageUrl(current.logo, logoSizeFor(screenWidth())) : '';
        var logo = node.find('.lumen-hero__logo');
        /* Пустая строка в background-image оставила бы style="" на узле —
           ловушка из плана 0.2 (пустой атрибут меняет outerHTML). Значение
           'none' валидно и атрибут пустым не делает. */
        logo.css('background-image', logoUrl ? 'url("' + encodeURI(logoUrl) + '")' : 'none');
        node.toggleClass('lumen-hero--logo', !!logoUrl);

        text.removeClass('is-swapping');
        if (motionMode() === 'full') text.addClass('is-in');
      }

      if (!swap || motionMode() !== 'full') {
        write();
        return;
      }

      var text = node.find('.lumen-hero__text');
      text.removeClass('is-in').addClass('is-swapping');
      var captured = gen;
      stopTimer('swapTimer');
      state.swapTimer = setTimeout(function () {
        if (gen !== captured || !state) return;
        state.swapTimer = null;
        write();
      }, SWAP_MS);
    }

    /* Кроссфейд кадра: новый URL грузится в скрытый слой, и только после
       onload слои меняются местами. Пока кадр не пришёл, на экране остаётся
       предыдущий — «фон не мигает» (ограничение брифа 1). */
    function swapFrame(url, blur) {
      if (!state) return;
      var node = state.node;
      var a = node.find('.lumen-hero__bg--a');
      var b = node.find('.lumen-hero__bg--b');
      var activeIsA = a.hasClass('is-active');
      var next = activeIsA ? b : a;
      var prev = activeIsA ? a : b;
      next.css('background-image', 'url("' + encodeURI(url) + '")');
      next.addClass('is-active');
      prev.removeClass('is-active');
      node.toggleClass('lumen-hero--blur', !!blur);
      state.frameUrl = url;
    }

    /* Предзагрузка кадра фокусной карточки. Кадра нет — берём постер и
       помечаем слой для размытия (экран 22 брифа: композиция не меняется).
       Тот же URL повторно не грузится.

       Режим анимаций 'off' кадр НЕ обновляет вовсе (таблица рисков плана:
       «в режиме motion off герой не обновляет кадр, только текст»). Гейт
       стоит до new Image(): в 'off' дорога не плавность смены слоёв (её и
       так гасит CSS), а сама загрузка и декодирование большого кадра —
       w1280/original на каждую остановку фокуса, поверх кадра, который
       параллельно тянет сама Lampa через Background.change. Пользователь
       слабого ТВ выбирает 'off' именно ради этого. */
    function loadFrame(model, captured) {
      if (!state) return;
      if (motionMode() === 'off') return;
      var blur = false;
      var path = model.backdrop;
      if (!path) { path = model.poster; blur = true; }
      if (!path) return;

      var url = imageUrl(path, blur ? 'w500' : sizeFor(screenWidth()));
      if (!url || url === state.frameUrl) return;

      var loader = new Image();
      var done = false;

      function finish(ok) {
        if (done) return;
        done = true;
        stopTimer('loadTimer');
        loader.onload = null;
        loader.onerror = null;
        if (gen !== captured || !state || !isMounted()) return;
        state.loader = null;
        /* Кадр не пришёл — на экране остаётся предыдущий: пустой герой
           хуже устаревшего кадра, а следующий фокус всё равно его сменит. */
        if (!ok) return;
        try {
          swapFrame(url, blur);
        } catch (e) {
          warn('hero: frame failed', e);
        }
      }

      loader.onload = function () { finish(true); };
      loader.onerror = function () { finish(false); };
      state.loader = loader;
      state.loadTimer = setTimeout(function () { finish(false); }, LOAD_TIMEOUT);
      loader.src = url;
    }

    /* Детали карточки: описание целиком, длительность/сезоны, жанры,
       логотипы, анонс серии. Один запрос на карточку, кэш сутки. */
    function loadDetails(card, captured) {
      try {
        if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
        var req = detailsRequest(mediaOf(card), card.id, langCode());
        state.net = Lampa.Api.sources.tmdb.get(
          req.url,
          req.params,
          function (json) {
            if (gen !== captured || !state || !isMounted()) return;
            state.net = null;
            state.details = json || null;
            var model = heroModel(card, state.details, words());
            /* Пустой ответ — тот же исход, что и ошибка: ждать больше нечего,
               скелетон гасим (иначе он горел бы до следующей карточки). */
            if (!state.details) model.pending = false;
            render(model, false);
            /* Кадра не было в данных ряда, но он есть в деталях — только
               тогда грузим второй раз: лишний большой кадр на ТВ дорог. */
            if (!state.frameUrl && model.backdrop) loadFrame(model, captured);
          },
          function () {
            if (gen !== captured || !state || !isMounted()) return;
            state.net = null;
            /* Деталей не будет — снимаем скелетон, оставляя то, что дала
               карточка ряда (заголовок, год, краткое описание). Флаг гасим в
               самой модели, а не классом на узле: отложенная подмена текста
               (swapTimer) перерисовала бы её и вернула скелетон. */
            var fallback = heroModel(card, null, words());
            fallback.pending = false;
            render(fallback, false);
          },
          { life: req.life }
        );
      } catch (e) {
        warn('hero: details failed', e);
      }
    }

    /* Показать героя для карточки. Вызывается только из отложенного тика
       наблюдателя (или из mount для уже сфокусированной карточки). */
    function show(card) {
      if (!state || !card) return;
      try {
        var captured = ++gen;
        cancelPending();
        state.shownId = card.id;
        state.details = null;
        state.model = null;
        var model = heroModel(card, null, words());
        render(model, true);
        loadFrame(model, captured);
        loadDetails(card, captured);
      } catch (e) {
        warn('hero: show failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Наблюдатель фокуса.                                                 */
    /* ------------------------------------------------------------------ */

    /* Позиция ряда карточки среди рядов главной. Считается по самой
       карточке, а не подпиской Lampa.Listener('line'): вторая подписка жила
       бы параллельно наблюдателю и давала бы второй источник правды о том,
       какой ряд сейчас в фокусе. -1 — ряд не найден (мини-герой сетки). */
    function rowIndex(el) {
      try {
        var line = $(el).closest('.items-line');
        if (!line || !line.length) return -1;
        return line.index();
      } catch (e) {
        return -1;
      }
    }

    /* Фокус ниже первого ряда — герой сжимается до 42 % (design-spec-main
       §0.2, раскадровка 23б). Мини-герой сетки сжат всегда. */
    function updateCompact(el) {
      if (!state || state.fixedCompact) return;
      var index = rowIndex(el);
      if (index < 0) return;
      state.node.toggleClass('lumen-hero--compact', index > 0);
    }

    function onFocus(el) {
      if (!state) return;
      var card = el.card_data;
      if (!card || card.id == null) return;

      updateCompact(el);

      state.focusAt = Date.now();
      state.pending = card;
      stopTimer('timer');
      /* Тот же фильм под фокусом (возврат на ту же карточку, перерисовка
         ряда) — ни кадра, ни запроса. */
      if (state.shownId === card.id) return;

      var captured = gen;
      state.timer = setTimeout(function () {
        if (gen !== captured || !state) return;
        state.timer = null;
        if (!isMounted()) return;
        if (state.pending !== card) return;
        if (!shouldUpdate(state.shownId, card.id, Date.now() - state.focusAt, DELAY)) return;
        show(card);
      }, DELAY);
    }

    function onMutations(records) {
      if (!state) return;
      try {
        for (var i = 0; i < records.length; i++) {
          var target = records[i] && records[i].target;
          if (!target || !target.classList) continue;
          if (target.classList.contains('card') && target.classList.contains('focus')) {
            onFocus(target);
            return;
          }
        }
      } catch (e) {
        warn('hero: observer failed', e);
      }
    }

    function observe(root) {
      try {
        if (!window.MutationObserver) return;
        var obs = new MutationObserver(onMutations);
        obs.observe(root[0], { attributes: true, attributeFilter: ['class'], subtree: true });
        state.observer = obs;
      } catch (e) {
        warn('hero: observe failed', e);
      }
    }

    /* Карточка, которая уже в фокусе на момент монтирования (возврат из
       карточки на главную — Lampa восстанавливает фокус сама, мутации
       класса при этом может и не быть). */
    function showFocused(root) {
      try {
        var el = root.find('.card.focus');
        if (el && el.length && el[0] && el[0].card_data) {
          updateCompact(el[0]);
          show(el[0].card_data);
        }
      } catch (e) {}
    }

    /* ------------------------------------------------------------------ */
    /* Монтирование и снятие.                                              */
    /* ------------------------------------------------------------------ */

    /* root — корень экрана. Сейчас это активность главной
       (e.object.activity.render()); opts оставляют модуль пригодным и для
       другого экрана (экран франшизы, Task 25):
         hostClass — класс корня, которым CSS сдвигает содержимое под героя
                     (по умолчанию 'lumen-main');
         compact   — герой сжат всегда и индекс ряда не смотрит. */
    /* Правка пользователя 2026-09-17 (п.2): «Герой: выключен». Герой не
       монтируется вовсе — ни узла, ни наблюдателя, ни запросов деталей, а
       без класса .lumen-main на активности к рядам не применяются и наши
       правила размера: главная выглядит штатной Lampa, ряды занимают экран
       целиком. Последствие, о котором надо помнить: чипы профилей настроения
       живут ВНУТРИ текстового блока героя (src/49_moods.js), поэтому с
       выключенным героем их на экране нет — их собственная настройка при
       этом ничего не меняет. */
    function sizeOff() {
      try { return LC.pref ? LC.pref('lumen_hero_size', 'medium') === 'off' : false; } catch (e) { return false; }
    }

    function mount(root, opts) {
      try {
        if (!root || !root.length) return;
        if (sizeOff()) { unmount(); return; }
        /* Тот же корень — героя не пересобираем. На пути «карточка → назад»
           этот гард НЕ срабатывает: уход вглубь виден рантайму как 'start'
           чужой активности, и detach() уже снял героя — на возврате он
           строится заново (кадр при этом моргает; вынесено долгом фазы 3).
           Гард закрывает другое: повторный mount() того же корня без
           промежуточного detach — activate() -> mountCurrent() и следом
           событие 'start' той же главной, либо два 'start' подряд. Без него
           на один экран вешался бы второй наблюдатель. */
        if (state && state.root && state.root[0] === root[0]) return;
        unmount();
        opts = opts || {};

        var node = buildNode();
        root.prepend(node);
        var hostClass = opts.hostClass || 'lumen-main';
        root.addClass(hostClass);

        gen++;
        state = {
          root: root,
          node: node,
          hostClass: hostClass,
          observer: null,
          timer: null,
          swapTimer: null,
          loadTimer: null,
          loader: null,
          net: null,
          shownId: null,
          details: null,
          model: null,
          pending: null,
          focusAt: 0,
          frameUrl: '',
          fixedCompact: !!opts.compact
        };
        if (opts.compact) node.addClass('lumen-hero--compact');
        applyMotion();
        observe(root);
        showFocused(root);
      } catch (e) {
        warn('hero: mount failed', e);
      }
    }

    /* Смонтировать героя, если сейчас открыта главная. Нужен включению
       плагина из настроек: возврата из настроек в главную Lampa событием
       'activity' не сопровождает, и без этой точки герой появился бы
       только после перехода куда-нибудь и обратно. */
    function mountCurrent() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main') return;
        if (!act.activity || typeof act.activity.render !== 'function') return;
        mount(act.activity.render());
      } catch (e) {
        warn('hero: mountCurrent failed', e);
      }
    }

    /* Снять героя целиком: узел, класс корня, наблюдатель, все таймеры,
       предзагрузка кадра и незавершённый запрос деталей. Идемпотентна. */
    function unmount() {
      if (!state) return;
      var s = state;
      state = null;
      gen++;
      try {
        if (s.observer) s.observer.disconnect();
      } catch (e) {
        warn('hero: disconnect failed', e);
      }
      var timers = ['timer', 'swapTimer', 'loadTimer'];
      for (var i = 0; i < timers.length; i++) {
        try { if (s[timers[i]]) clearTimeout(s[timers[i]]); } catch (eT) {}
      }
      if (s.loader) {
        s.loader.onload = null;
        s.loader.onerror = null;
      }
      try { if (s.net && s.net.clear) s.net.clear(); } catch (eN) {}
      try { s.node.remove(); } catch (eR) {}
      try { s.root.removeClass(s.hostClass); } catch (eC) {}
    }

    /* Герой принадлежит этой активности? Для главной его корень — сама
       активность; корень внутри неё (если героя смонтируют в чужой узел
       экрана) тоже считается своим — отсюда проверка closest('.activity'). */
    function ownedBy(render) {
      if (!state || !state.root || !state.root.length) return false;
      if (!render || !render.length) return false;
      if (state.root[0] === render[0]) return true;
      try {
        var act = state.root.closest('.activity');
        return !!(act && act.length && act[0] === render[0]);
      } catch (e) {
        return false;
      }
    }

    /* Вызывается на 'activity':start ЛЮБОЙ активности. Ушли с экрана, где
       живёт герой (вглубь в карточку, в меню, в другой компонент) — снимаем
       его вместе с наблюдателем: Lampa для покидаемой активности событий не
       шлёт вовсе (раздел 0 плана), и это единственный момент, когда об уходе
       можно узнать. */
    function detach(render) {
      if (!state) return;
      if (ownedBy(render)) return;
      unmount();
    }

    function active() {
      return !!state;
    }

    /* Публичная проверка принадлежности: рантайму она нужна на 'destroy',
       где снимать героя можно ТОЛЬКО если он всё ещё принадлежит умирающей
       активности, а не экрану, открытому поверх неё. */
    function owns(render) {
      return ownedBy(render);
    }

    return {
      pickLogo: pickLogo,
      mediaOf: mediaOf,
      heroModel: heroModel,
      shouldUpdate: shouldUpdate,
      sizeFor: sizeFor,
      logoSizeFor: logoSizeFor,
      detailsRequest: detailsRequest,
      mount: mount,
      mountCurrent: mountCurrent,
      detach: detach,
      owns: owns,
      unmount: unmount,
      applyMotion: applyMotion,
      active: active
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hero;

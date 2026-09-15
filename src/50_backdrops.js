  /* -------------------------------------------------------------------- */
  /* Фон карточки (Task 5b: перенесено из 90_runtime.js без изменения      */
  /* поведения для режима 'backdrop'; добавлены режимы 'poster' и          */
  /* 'procedural' по LC.cardinfo.bgMode). Публично — LC.backdrops.apply     */
  /* (root, body, movie), её вызывает Listener 'full' в 90_runtime.js на    */
  /* complite (там же, где раньше был applyBackdrop). Task 6 добавит сюда   */
  /* же pickBackdrops и слайдшоу кадров. URL любых картинок — только через  */
  /* LC.cardinfo.imageUrl (план 0.2 «Картинки», прокси TMDB, без двойного   */
  /* слэша). */
  /* -------------------------------------------------------------------- */

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

  function backdropUrl(movie) {
    var url = '';
    try {
      if (movie.backdrop_path) url = LC.cardinfo.imageUrl(movie.backdrop_path, 'w1280', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('image url failed', e);
    }
    if (!url && movie.background_image) url = movie.background_image;
    return url;
  }

  /* Task 5b Step 3: постер для размытого фона — 'w500', то же качество,
     которое родная Poster.onCreate (app.min.js) грузит в .full--poster
     (card.img = Api.img(poster_path, ...).replace(/\/w\d+/, '/w500')) —
     сам постер-<img> плагин не трогает, эта функция только про фон. */
  function posterUrl(movie) {
    try {
      if (movie.poster_path) return LC.cardinfo.imageUrl(movie.poster_path, 'w500', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('poster url failed', e);
    }
    return '';
  }

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  /* .lumen-backdrop лежит в e.body — сосед карточки (.lumen-card вложена
     глубже, внутри .scroll__body), обычный потомковый селектор вида
     .lumen-card.lumen-motion-lite … .lumen-backdrop тут не сработает
     (план 1.1: ALLOWED_ROOTS в css.test.mjs держит .lumen-backdrop как
     самостоятельный корень отдельно от .lumen-card). Поэтому режим
     анимаций зеркалится прямо на сам слой фона — CSS для .lumen-bg--blur
     читает класс lumen-motion-* на .lumen-backdrop (design-spec §12/доп.
     к Task 5b: в lite/off — без filter:blur, только затемнение). */
  function syncMotionClass(layer) {
    try {
      layer.removeClass('lumen-motion-full lumen-motion-lite lumen-motion-off').addClass('lumen-motion-' + LC.motionMode());
    } catch (e) { }
  }

  /* Task 5b Step 5 (утечки): перед любой мутацией DOM после асинхронного
     ответа (Image().onload/onerror/таймер) — проверяем, что узел ещё в
     документе. Карточку могли закрыть до ответа: Lampa убирает весь
     .activity__body (а с ним и .lumen-backdrop) при destroy активности. */
  function isMounted(node) {
    try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
  }

  function ensureLayer(body) {
    var layer = body.children('.lumen-backdrop');
    if (!layer.length) {
      layer = $('<div class="lumen-backdrop">' +
        '<div class="lumen-backdrop__img"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
        '</div>');
      body.prepend(layer);
    }
    return layer;
  }

  function clearLayer(layer) {
    layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2 lumen-bg--blur');
  }

  /* Task 5b Step 3/4: нет кадра — ни в режиме 'poster'/'procedural', ни
     когда кадр из режима 'backdrop' не загрузился/завис (design-spec §12,
     дополнение к Task 5b: размытый постер, blur(40px)=1.75em, opacity:.8
     поверх диагонального градиента — сам градиент в CSS у .lumen-bg--blur).
     Постера тоже нет — старые процедурные градиенты v1, без изменений. */
  function showNoFrame(layer, movie) {
    var img = layer.find('.lumen-backdrop__img');
    var url = posterUrl(movie);
    if (url) {
      img.css('background-image', 'url("' + encodeURI(url) + '")');
      syncMotionClass(layer);
      layer.addClass('lumen-bg--blur').addClass('loaded');
    } else {
      img.css('background-image', '');
      layer.addClass(procClass(movie)).addClass('loaded');
    }
  }

  /* Task 5b Step 3: предзагрузка кадра как в v1 (Image().onload/onerror),
     плюс таймаут 8с (экран 13 design-spec §12 не даёт точного числа
     зависания — восьмисекундный таймаут свой). Любая ветка завершения
     (onload/onerror/таймер) проходит через finish(), которая гасит все
     остальные пути и таймер — второй мутации после первой не будет. */
  function loadBackdrop(layer, movie) {
    var url = backdropUrl(movie);
    var img = layer.find('.lumen-backdrop__img');

    if (!url) { showNoFrame(layer, movie); return; }

    img.css('background-image', '');
    var node = layer[0];
    var done = false;
    var timer = null;
    var loader = new Image();

    function finish(ok) {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      loader.onload = null;
      loader.onerror = null;
      if (!isMounted(node)) return;
      if (ok) {
        try {
          /* encodeURI страхует от "/\/) в URL, которые сломали бы строку url("...") */
          img.css('background-image', 'url("' + encodeURI(url) + '")');
          layer.addClass('loaded');
        } catch (e) { }
      } else {
        showNoFrame(layer, movie);
      }
    }

    loader.onload = function () { finish(true); };
    loader.onerror = function () { finish(false); };
    timer = setTimeout(function () { finish(false); }, 8000);
    loader.src = url;
  }

  /* Task 5b Step 2: сам <img class="full--poster"> заполняет родная
     Lampa (Poster.onCreate в app.min.js: card.img из poster_path, w500,
     добавляет .loaded на .full-start-new__poster сама) — плагин его не
     трогает вовсе, только раскрывает узел через CSS (.lumen-card--poster,
     v1-правило .full-start-new__left{display:none} переопределяется там
     большей специфичностью + !important) и добавляет подпись-атрибуцию
     источника (design-spec §11: текст «TMDB» снизу-слева плейсхолдера). */
  function ensurePosterLabel(root) {
    var poster = root.find('.full-start-new__poster');
    if (!poster.length) return;
    if (!poster.children('.lumen-poster-tmdb').length) {
      poster.append('<div class="lumen-poster-tmdb">TMDB</div>');
    }
  }

  function apply(root, body, movie) {
    try {
      if (!body || !body.length) return;
      movie = movie || {};

      var mode = LC.cardinfo.bgMode(movie);

      if (root && root.length) {
        root.toggleClass('lumen-card--poster', mode === 'poster');
        if (mode === 'poster') ensurePosterLabel(root);
      }

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

      var layer = ensureLayer(body);
      clearLayer(layer);

      if (mode === 'backdrop') loadBackdrop(layer, movie);
      else showNoFrame(layer, movie);
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  LC.backdrops = { apply: apply };

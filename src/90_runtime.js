  /* -------------------------------------------------------------------- */
  /* Бэкдроп (v1, вне .lumen-card — в корне компонента).                    */
  /* -------------------------------------------------------------------- */

  /* Ревью Task 5a (Task 5 Step 3b.3, дефект приёмки v1 №3): URL только через
     прокси TMDB Lampa — Lampa.TMDB.image (учитывает Storage 'proxy_tmdb',
     тот же метод использует сама Lampa для фонов/постеров), фолбэк
     Lampa.Api.img. Оба обёрнуты в собственные функции (без .bind/apply —
     строгий ES5), чтобы не тащить this наружу. Сборка URL — LC.cardinfo.imageUrl
     (чистая функция, без двойного слэша независимо от ведущего '/' в path). */
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

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  function applyBackdrop(body, movie) {
    try {
      if (!body || !body.length) return;

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

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

      layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2');

      var url = backdropUrl(movie);
      var img = layer.find('.lumen-backdrop__img');

      if (url) {
        img.css('background-image', '');
        var loader = new Image();
        loader.onload = function () {
          try {
            /* encodeURI страхует от "/\/) в URL, которые сломали бы строку url("...") */
            img.css('background-image', 'url("' + encodeURI(url) + '")');
            layer.addClass('loaded');
          } catch (e) { }
        };
        loader.onerror = function () {
          try {
            img.css('background-image', '');
            layer.addClass(procClass(movie)).addClass('loaded');
          } catch (e) { }
        };
        loader.src = url;
      } else {
        img.css('background-image', '');
        layer.addClass(procClass(movie)).addClass('loaded');
      }
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Поиск корня карточки в событии 'full' (build/complite).                */
  /* -------------------------------------------------------------------- */

  function findRoot(e) {
    var root = null;
    try {
      if (e.item && typeof e.item.render === 'function') {
        var html = e.item.render();
        if (html && html.hasClass && html.hasClass('full-start-new')) root = html;
      }
    } catch (err) { }
    if ((!root || !root.length) && e.body && e.body.find) {
      try { root = e.body.find('.full-start-new.lumen-card').eq(0); } catch (err2) { }
    }
    return root;
  }

  /* -------------------------------------------------------------------- */
  /* Раскладка.                                                            */
  /* -------------------------------------------------------------------- */

  function isWideLayout() {
    var width = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    if (width && width <= 480) return false;
    var tv = false;
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') tv = !!Lampa.Platform.screen('tv');
    } catch (e) { }
    return tv || width > 480;
  }

  /* -------------------------------------------------------------------- */
  /* Task 4: режим анимаций и компактная шапка.                            */
  /* -------------------------------------------------------------------- */

  var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';

  function activeCardRoot() {
    try { return $('.activity--active .lumen-card'); } catch (e) { return null; }
  }

  function applyMotionMode(root) {
    if (!root || !root.length) return;
    try {
      root.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
    } catch (e) {
      warn('motion mode failed', e);
    }
  }

  /* Вызывается извне (LC.followStorage / onChange параметра lumen_motion), когда режим
     меняется на уже открытой карточке — находит активный корень сама. */
  LC.applyMotionMode = function () {
    applyMotionMode(activeCardRoot());
  };

  var toggle_followed = false;

  /* Одна подписка на переключение контроллера за всё время жизни плагина (не на карточку):
     спуск с кнопок на ряд описания/серий сжимает шапку, подъём обратно на кнопки — возвращает.
     Task 7 добавит сюда же остановку трейлера. */
  function followToggle() {
    if (toggle_followed) return;
    toggle_followed = true;
    try {
      if (!window.Lampa || !Lampa.Controller || !Lampa.Controller.listener) return;
      Lampa.Controller.listener.follow('toggle', function (e) {
        try {
          if (!e || !e.name) return;
          var root = activeCardRoot();
          if (!root || !root.length) return;
          if (e.name === 'full_descr' || e.name === 'items_line') root.addClass('lumen-compact');
          else if (e.name === 'full_start') root.removeClass('lumen-compact');
        } catch (err) {
          warn('controller toggle failed', err);
        }
      });
    } catch (e2) {
      warn('controller listener failed', e2);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Инициализация.                                                        */
  /* -------------------------------------------------------------------- */

  var original_template = '';

  function saveOriginalTemplate() {
    try {
      if (Lampa.Template && typeof Lampa.Template.all === 'function') {
        var all = Lampa.Template.all();
        if (all && all.full_start_new) {
          original_template = all.full_start_new;
          return;
        }
      }
    } catch (e) { }
    try {
      /* Сигнатура: Template.get(name, vars, like_static) -> строка */
      original_template = Lampa.Template.get('full_start_new', {}, true) || '';
    } catch (e2) {
      warn('cannot save original template', e2);
    }
  }

  function restoreOriginalTemplate() {
    try {
      if (original_template) Lampa.Template.add('full_start_new', original_template);
    } catch (e) {
      warn('cannot restore original template', e);
    }
  }

  LC.init = function () {
    try {
      if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;

      try { if (Lampa.Lang && typeof Lampa.Lang.add === 'function') Lampa.Lang.add(LC.STRINGS); } catch (e) { }

      LC.addSettings();
      LC.followStorage();

      if (!isWideLayout()) return;

      saveOriginalTemplate();

      /* Task 5/5a Step 1: build() вернул null ИЛИ ours не проходит assert
         (не хватает обязательных классов/языковых ключей из REQUIRED) ->
         версия Lampa не поддерживается, штатный шаблон не подменяем. */
      var tpl = LC.template.build(original_template);
      var check = tpl ? LC.template.assert(original_template, tpl) : null;
      if (!tpl || !check.ok) {
        warn('template not supported' + (check ? ': missing ' + check.missingInOurs.join(', ') : ' (build failed)'));
        try {
          if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show('Lumen Card: версия Lampa не поддерживается');
        } catch (e3) { }
        return;
      }
      Lampa.Template.add('full_start_new', tpl);

      LC.injectFonts();
      LC.injectCss();

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            LC.header.decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            var root = findRoot(e);
            LC.header.decorate(root, e.data);
            applyBackdrop(e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });

      followToggle();
    } catch (e) {
      warn('init failed', e);
      restoreOriginalTemplate();
    }
  };

  /* Безопасный старт. Если Lampa ещё не загрузилась — подождём. */
  LC.boot = function (attempt) {
    attempt = attempt || 0;
    if (typeof window.Lampa === 'undefined') {
      if (attempt > 40) return;
      setTimeout(function () { LC.boot(attempt + 1); }, 250);
      return;
    }
    if (window.appready) LC.init();
    else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') LC.init();
      });
    }
  };

  /* -------------------------------------------------------------------- */
  /* Task 22 (фаза 3): ambient-режим — кадры вместо статичного экрана.     */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   sizeFor(widthPx) → 'w1280' | 'original'                             */
  /*   nextIndex(index, len) → следующий кадр ленты по кругу               */
  /*   normalizeFrames(list) → [{title, path, url}]                        */
  /*   playlist(frames, size, rnd) → лента сеанса без повторов             */
  /*   canStart(state) → можно ли включаться прямо сейчас                  */
  /*   clockText(date) → 'HH:MM'                                            */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   install() / uninstall() — подписки на активность и таймер покоя     */
  /*   apply() — перечитать настройки на лету                              */
  /*   stop() — снять слой и все ресурсы немедленно                        */
  /*   active() → показан ли слой прямо сейчас                             */
  /*   frames() → кадры, из которых будет собрана лента                    */
  /*   _delayMs — хук живой проверки (задержка в мс вместо настройки)      */
  /*   _timers — хук тестов (подменяемые setTimeout/clearTimeout)          */
  /*                                                                       */
  /* Ресурсы. Их ровно четыре вида, и каждый — в ОДНОМ экземпляре:         */
  /*   1) три слушателя document (keydown/mousemove/touchstart, capture);  */
  /*   2) таймер покоя (один, перезаводится на каждую активность);         */
  /*   3) таймер смены кадра (один, живёт только пока слой на экране);     */
  /*   4) таймер уборки слоя (один, 400 мс) и одна предзагружаемая         */
  /*      картинка (ссылка на неё гасится вместе со слоем).                */
  /* Кадрового цикла (requestAnimationFrame) модуль не заводит вовсе:      */
  /* наезд и кроссфейд рисует CSS, и в режимах «Лёгкие»/«Выкл» их там же   */
  /* и снимают — отдельной ветки в коде это не требует.                    */
  /*                                                                       */
  /* Почему слушатели на document, а не на Lampa.Keypad.listener (как в    */
  /* src/64_nav.js): выход из ambient обязан ПРОГЛОТИТЬ первое нажатие —   */
  /* иначе клавиша, которой пользователь «разбудил» экран, заодно сдвинет  */
  /* фокус под слоем. Проглотить его можно только раньше Lampa, а Keypad   */
  /* вешает свои слушатели на window (app.min.js ~3684) — поэтому наши     */
  /* стоят на document в capture-фазе, где идут первыми, и только на время */
  /* показа слоя вызывают preventDefault/stopPropagation. Всё остальное    */
  /* время обработчик лишь перезаводит таймер покоя и ничего не отменяет.  */
  /*                                                                       */
  /* Мышь и тач тоже считаются активностью (браузерная Lampa), но нажатие  */
  /* от них не глотается: отменять там нечего.                             */
  /* -------------------------------------------------------------------- */

  LC.ambient = (function () {

    /* Смена кадра и длительность наезда — одно и то же число: кадр
       «доезжает» ровно к моменту, когда его сменяет следующий (поправка
       контроллера к Task 22: наезд 1.00 → 1.08 за 20 с). */
    var SLIDE_MS = 20000;
    /* Уход слоя. Столько же стоит в CSS у анимации .is-out. */
    var FADE_MS = 400;
    /* Кадров в ленте одного сеанса. Ограничение не про память, а про
       точки-индикаторы: по шестидесяти точкам позицию не прочитать, а по
       восьми — видно, что кадры идут по кругу и сколько их осталось. */
    var REEL = 8;
    /* Задержка по умолчанию, минут (решение пользователя — 3 минуты). */
    var DEFAULT_MIN = 3;
    /* Мелочь ревью фазы 3 (docs/plans/2026-09-15-lumen-phase3-features.md:
       251): mousemove пересоздавал таймер покоя на КАЖДОЕ событие. Пока
       заставки нет, будильник переставляется не чаще раза в секунду:
       задержка измеряется минутами, и заставка, пришедшая на секунду
       раньше, не отличима от вовремя. */
    var POKE_MS = 1000;

    /* Контроллеры, при которых экран считается «спокойным». Всё остальное
       (select, modal, player, ввод текста) означает, что пользователь ждёт
       ответа от Lampa, и накрывать это кадрами нельзя. */
    var CONTROLLERS = { content: 1, full_start: 1, full_descr: 1, items_line: 1 };

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Размер кадра TMDB под ширину экрана в физических пикселях.
       Task 39: свой порог (1366) заменён общим LC.util.frameSize — кадр
       заставки занимает экран целиком ровно так же, как кадр карточки и
       кадр героя, и разъезжаться этим трём размерам незачем. Task 47: порог
       там теперь 1920 физических пикселей, то есть Full HD достаётся w1280.
       На нём кадр растягивается в полтора раза — на фотографии за текстом
       этого не видно, тогда как original у кадров TMDB обычно 3840×2160:
       8.3 Мпикс против 0.92, 31.6 МБ RGBA против 3.7 (замер координатора
       2026-09-21). */
    function sizeFor(width) {
      return LC.util.frameSize(width);
    }

    /* Следующий кадр ленты. Лента уже перемешана (playlist), поэтому
       порядок здесь строго по кругу: точки-индикаторы иначе прыгали бы. */
    function nextIndex(index, len) {
      var n = Number(len) || 0;
      if (n <= 0) return -1;
      var i = Number(index);
      if (!(i >= 0)) return 0;
      return (i + 1) % n;
    }

    /* Кадры к единому виду: {title, path, url}. Элемент без пути и без
       готового адреса выбрасывается — показывать нечего; отсутствующее
       название не мешает (подпись просто пустая). */
    function normalizeFrames(list) {
      var out = [];
      if (!list || !list.length) return out;
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item) continue;
        var path = item.path ? ('' + item.path) : '';
        var url = item.url ? ('' + item.url) : '';
        if (!path && !url) continue;
        out.push({ title: item.title ? ('' + item.title) : '', path: path, url: url });
      }
      return out;
    }

    /* Лента одного сеанса: до size кадров без повторов, в случайном
       порядке. Перемешивание — Фишер–Йетс по копии: исходный список живёт
       в манифесте и принадлежит не нам. */
    function playlist(frames, size, rnd) {
      var pool = [];
      var i;
      if (!frames || !frames.length) return pool;
      for (i = 0; i < frames.length; i++) pool.push(frames[i]);
      var random = typeof rnd === 'function' ? rnd : Math.random;
      for (i = pool.length - 1; i > 0; i--) {
        var j = Math.floor(random() * (i + 1));
        if (j < 0) j = 0;
        if (j > i) j = i;
        var tmp = pool[i];
        pool[i] = pool[j];
        pool[j] = tmp;
      }
      var limit = Number(size) || 0;
      if (limit > 0 && pool.length > limit) pool = pool.slice(0, limit);
      return pool;
    }

    /* Можно ли включаться прямо сейчас. Все причины отказа — внешние
       состояния экрана, поэтому функция чистая: рантайм собирает их в
       state (gather) и спрашивает один раз. */
    function canStart(state) {
      if (!state) return false;
      if (!state.enabled) return false;
      /* Task 56 (фаза 5): заставка на экране одна, и первична штатная.
         state.native — включённый тумблер Lampa «Показывать заставку при
         бездействии»; ровно по нему Lampa заводит свой таймер (app.min.js
         17144: `if (!Storage.field('screensaver') || !this.enabled ||
         this.worked) return;`). Пока он стоит, кадры не показываем: иначе
         через нашу задержку человек получает наш слой, а через штатную —
         ещё и чужой поверх него (жалоба пользователя 2026-09-21: видео
         Lampa пропало, хотя он ничего не выключал — наши 3 минуты просто
         опережали штатные 5).

         Второй путь — гасить штатную на время показа — отвергнут: вернуть
         её мы смогли бы только своим же hide(), а не доживи модуль до него
         (выгрузка плагина, исключение, уход страницы), заставка Lampa
         исчезла бы у человека до перезапуска приложения. Здесь мы её
         состояние только читаем и ничего чужого не переключаем. */
      if (state.native) return false;
      /* Выключенные анимации — это «ничего не должно двигаться само»:
         кадры с наездом под это описание не подходят. Лёгкие анимации
         кадрам не мешают — там CSS снимает наезд, а не сам показ. */
      if (state.motion === 'off') return false;
      if (state.hidden) return false;
      if (state.modal || state.player || state.trailer) return false;
      if (!state.frames) return false;
      return !!CONTROLLERS[state.controller];
    }

    /* Часы слоя. Секунд нет намеренно: они требовали бы своего таймера. */
    function clockText(date) {
      if (!date || typeof date.getHours !== 'function') return '';
      return LC.util.pad2(date.getHours()) + ':' + LC.util.pad2(date.getMinutes());
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function doc() {
      try { return typeof document !== 'undefined' ? document : null; } catch (e) { return null; }
    }

    function jq() {
      try { if (typeof $ === 'function') return $; } catch (e) { }
      return null;
    }

    function hidden() {
      var d = doc();
      return !!(d && d.hidden);
    }

    /* Таймеры через хук: тесты подменяют пару set/clear целиком
       (LC.ambient._timers), рантайм работает на штатных. */
    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      clearTimeout(id);
    }

    function tmdbImageFn() {
      try {
        if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
          return function (url) { return Lampa.TMDB.image(url); };
        }
      } catch (e) { }
      return null;
    }

    function apiImgFn() {
      try {
        if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
          return function (path, size) { return Lampa.Api.img(path, size); };
        }
      } catch (e) { }
      return null;
    }

    /* Ширина экрана в физических пикселях — от неё зависит размер кадра.
       Task 39: собственный расчёт заменён общим LC.util.screenPx. Отличия
       два, оба намеренные: ширина берётся у окна (innerWidth), а не у
       устройства (screen.width) — в окне браузера на большом мониторе
       screen.width завышает размер вдвое; и devicePixelRatio ограничен
       двойкой — выше TMDB всё равно нечего предложить сверх original. */
    function screenWidth() {
      return LC.util.screenPx();
    }

    /* Адрес кадра. Готовый url (кадры открытой карточки уже посчитаны
       слайдшоу) отдаётся как есть, путь TMDB — через общий imageUrl, тот
       же, которым плагин грузит все картинки (он знает про прокси). */
    function urlOf(frame, size) {
      if (!frame) return '';
      if (frame.url) return frame.url;
      if (!frame.path) return '';
      try {
        if (LC.cardinfo && typeof LC.cardinfo.imageUrl === 'function') {
          return LC.cardinfo.imageUrl(frame.path, size, tmdbImageFn(), apiImgFn());
        }
      } catch (e) { }
      try {
        var tmdb = tmdbImageFn();
        var clean = frame.path.charAt(0) === '/' ? frame.path.slice(1) : frame.path;
        if (tmdb) return tmdb('t/p/' + size + '/' + clean);
      } catch (e2) { }
      return '';
    }

    /* Кадры каталога (манифест обновляется с хостинга без переустановки
       плагина; встроенный список — запасной). */
    function curatedFrames() {
      var list = null;
      try {
        var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
        if (m && m.ambient && m.ambient.length) list = m.ambient;
        if (!list && LC.manifest && LC.manifest.DEFAULT) list = LC.manifest.DEFAULT.ambient;
      } catch (e) {
        warn('ambient: manifest failed', e);
      }
      return normalizeFrames(list);
    }

    /* Кадры открытой карточки. Слайдшоу уже посчитало для них адреса и
       положило на слой (layer.data('lumenUrls'), src/50_backdrops.js) —
       второй раз их считать и тем более догружать незачем. */
    function currentFrames() {
      var out = [];
      try {
        var active = LC.active;
        if (!active || !active.body || typeof active.body.children !== 'function') return out;
        var layer = active.body.children('.lumen-backdrop');
        if (!layer || !layer.length) return out;
        var urls = layer.data('lumenUrls');
        if (!urls || !urls.length) return out;
        var movie = (active.data && active.data.movie) || {};
        var title = movie.title || movie.name || '';
        for (var i = 0; i < urls.length; i++) {
          if (urls[i]) out.push({ title: title, url: '' + urls[i], path: '' });
        }
      } catch (e) {
        warn('ambient: current frames failed', e);
      }
      return normalizeFrames(out);
    }

    /* Кадры по настройке источника. «Кадры текущего фильма» без открытой
       карточки — не пустой экран, а курируемый список: настройка про то,
       ЧТО показать, когда есть выбор, а не про то, показывать ли вообще. */
    function frames() {
      var source = 'curated';
      try { source = LC.pref('lumen_ambient_source', 'curated'); } catch (e) { }
      if (source === 'current') {
        var own = currentFrames();
        if (own.length) return own;
      }
      return curatedFrames();
    }

    /* Задержка покоя в миллисекундах. Хук _delayMs — для живой проверки:
       ждать три минуты у экрана ради одного кадра незачем. */
    function delayMs() {
      var hook = Number(api._delayMs) || 0;
      if (hook > 0) return hook;
      var minutes = DEFAULT_MIN;
      try { minutes = Number(LC.pref('lumen_ambient_delay', '' + DEFAULT_MIN)) || DEFAULT_MIN; } catch (e) { }
      if (minutes <= 0) minutes = DEFAULT_MIN;
      return minutes * 60000;
    }

    function enabledNow() {
      try {
        if (typeof LC.enabled === 'function' && !LC.enabled()) return false;
        /* Task 56: default здесь тот же, что в таблице пунктов
           (src/81_prefs.js) — выключено. */
        return !!LC.pref('lumen_ambient', false);
      } catch (e) {
        return false;
      }
    }

    /* Играющий трейлер: класс на слое фона карточки (src/55_trailer.js) и
       класс кадра главной (src/48_hero.js). Ambient поверх ролика — это
       прерванный просмотр, а не покой. */
    function trailerLive() {
      var q = jq();
      if (!q) return false;
      try { return !!q('.lumen-trailer-live,.lumen-hero--trailer').length; } catch (e) { return false; }
    }

    function controllerName() {
      try {
        if (window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function') {
          var c = Lampa.Controller.enabled();
          return (c && c.name) || '';
        }
      } catch (e) { }
      return '';
    }

    function modalOpen() {
      try {
        if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.opened === 'function') return !!Lampa.Modal.opened();
      } catch (e) { }
      return false;
    }

    function playerOpen() {
      try {
        if (window.Lampa && Lampa.Player && typeof Lampa.Player.opened === 'function') return !!Lampa.Player.opened();
      } catch (e) { }
      return false;
    }

    /* Task 56: включена ли ШТАТНАЯ заставка Lampa. Storage.field отдаёт
       boolean: Params.field подставляет свой default (app.min.js:47697), а
       Storage.get приводит строки 'true'/'false' тумблера к булевым
       (app.min.js:48431). У параметра screensaver default = true
       (app.min.js:47911), так что на нетронутом профиле здесь истина.

       Поле прочитать не удалось (чужая сборка без Storage.field, битое
       значение) — считаем, что штатной нет: наша заставка выключена по
       умолчанию, и человек, который её включил руками, не должен остаться
       вообще без заставки из-за неудачного чтения чужого параметра. */
    /* Storage.field, а не LC.pref: screensaver — тумблер самой Lampa с её
       дефолтом (разбор выше); в LC.prefs.LIST его нет. */
    function nativeSaver() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
          return Lampa.Storage.field('screensaver') === true;
        }
      } catch (e) { }
      return false;
    }

    function motion() {
      try {
        if (typeof LC.motionMode === 'function') return LC.motionMode();
      } catch (e) { }
      return 'full';
    }

    /* Общий признак «экран накрыт» (src/00_head.js). Заставка непрозрачна,
       поэтому всё, что рисует под ней, обязано стоять: частицы карточки и
       ротация её кадров читают тот же признак (план Task 22 Step 3). Пара
       live = true/false и markCovered ходят только вместе. В тестах, где
       54_ambient.js грузится без соседей, LC.setCovered может не быть. */
    function markCovered(value) {
      try {
        if (typeof LC.setCovered === 'function') LC.setCovered(value);
      } catch (e) { }
    }

    /* ------------------------------------------------------------------ */
    /* Слой                                                                */
    /* ------------------------------------------------------------------ */

    var installed = false;
    var bound = null;
    var idle_timer = 0;
    var slide_timer = 0;
    var out_timer = 0;
    var node = null;
    var imgs = [];
    var dots = [];
    var reel = [];
    var index = -1;
    var slot = 0;
    var live = false;
    var preload = null;
    /* Кадр на экране: картинка-сторож, по onerror которой битый кадр
       сменяется сразу, и адреса, уже оказавшиеся битыми в этом сеансе. */
    var watch = null;
    var bad = {};
    var last_poke = 0;

    function killWatch() {
      if (!watch) return;
      try {
        watch.onload = null;
        watch.onerror = null;
        watch.src = '';
      } catch (e) { }
      watch = null;
    }

    function killPreload() {
      if (!preload) return;
      try {
        preload.onload = null;
        preload.onerror = null;
        preload.src = '';
      } catch (e) { }
      preload = null;
    }

    /* Предзагрузка следующего кадра. Ссылка держится ровно одна: новая
       предзагрузка гасит прежнюю, а снятие слоя — обе. */
    function preloadNext(url) {
      killPreload();
      if (!url) return;
      var Ctor = null;
      try { Ctor = (window && typeof window.Image === 'function') ? window.Image : null; } catch (e) { }
      if (!Ctor) return;
      try {
        var img = new Ctor();
        preload = img;
        var done = function () {
          if (preload !== img) return;
          try { img.onload = null; img.onerror = null; } catch (e2) { }
          preload = null;
        };
        img.onload = done;
        img.onerror = done;
        img.src = url;
      } catch (e3) {
        warn('ambient: preload failed', e3);
        preload = null;
      }
    }

    /* Мелочь ревью фазы 3 (там же): битый кадр висел на экране до
       следующего тика, то есть до 20 с чёрного экрана, — фон задаётся через
       background-image, и о провале загрузки CSS не сообщает. Сторож —
       картинка с тем же адресом (после предзагрузки она из кэша): не
       загрузилась — адрес помечается битым, и лента сразу идёт дальше. */
    function watchFrame(url, i) {
      killWatch();
      var Ctor = null;
      try { Ctor = (window && typeof window.Image === 'function') ? window.Image : null; } catch (e) { }
      if (!Ctor) return;
      try {
        var img = new Ctor();
        watch = img;
        img.onload = function () {
          if (watch === img) killWatch();
        };
        img.onerror = function () {
          if (watch !== img) return;
          killWatch();
          bad[url] = true;
          if (!live || index !== i) return;
          clearT(slide_timer);
          slide_timer = 0;
          tick();
        };
        img.src = url;
      } catch (e2) {
        warn('ambient: watch failed', e2);
        watch = null;
      }
    }

    /* Следующий кадр ленты, минуя битые. -1 — битые все. */
    function nextGood(from, size) {
      var i = from;
      for (var n = 0; n < reel.length; n++) {
        i = nextIndex(i, reel.length);
        if (i < 0) return -1;
        if (!bad[urlOf(reel[i], size)]) return i;
      }
      return -1;
    }

    function paintClock() {
      if (!node) return;
      try { node.find('.lumen-ambient__clock').text(clockText(new Date())); } catch (e) { }
    }

    /* Показать кадр ленты в свободном слоте. Кроссфейд делает CSS: класс
       is-active переезжает с одного узла на другой. */
    function show(i) {
      if (!node || !reel.length) return;
      var size = sizeFor(screenWidth());
      var frame = reel[i];
      var url = urlOf(frame, size);
      if (!url) return;
      var target = imgs[slot];
      var other = imgs[slot ? 0 : 1];
      try {
        target.css('background-image', 'url("' + url + '")');
        target.addClass('is-active');
        other.removeClass('is-active');
      } catch (e) {
        warn('ambient: paint failed', e);
        return;
      }
      slot = slot ? 0 : 1;
      index = i;
      try { node.find('.lumen-ambient__title').text(frame.title || ''); } catch (e2) { }
      for (var d = 0; d < dots.length; d++) {
        try { dots[d].toggleClass('is-on', d === i); } catch (e3) { }
      }
      paintClock();
      watchFrame(url, i);
      var next = nextGood(i, size);
      preloadNext(next >= 0 && next !== i ? urlOf(reel[next], size) : '');
    }

    function tick() {
      slide_timer = 0;
      if (!live) return;
      /* В скрытой вкладке кадр не меняем и картинок не грузим: браузер их
         всё равно не покажет, а трафик и память потратит. Таймер при этом
         живёт — вкладка вернётся, и ротация продолжится со следующего. */
      if (!hidden()) {
        try {
          var next = nextGood(index, sizeFor(screenWidth()));
          if (next >= 0) show(next);
        } catch (e) { warn('ambient: slide failed', e); }
      }
      slide_timer = setT(tick, SLIDE_MS);
    }

    function build() {
      var q = jq();
      if (!q) return false;
      var root = q(
        '<div class="lumen-ambient">' +
          '<div class="lumen-ambient__img"></div>' +
          '<div class="lumen-ambient__img"></div>' +
          '<div class="lumen-ambient__scrim"></div>' +
          '<div class="lumen-ambient__info">' +
            '<div class="lumen-ambient__title"></div>' +
            '<div class="lumen-ambient__dots"></div>' +
          '</div>' +
          '<div class="lumen-ambient__clock"></div>' +
        '</div>'
      );
      var found = root.find('.lumen-ambient__img');
      imgs = [found.eq(0), found.eq(1)];
      dots = [];
      var box = root.find('.lumen-ambient__dots');
      for (var i = 0; i < reel.length; i++) {
        var dot = q('<div class="lumen-ambient__dot"></div>');
        box.append(dot);
        dots.push(dot);
      }
      q('body').append(root);
      node = root;
      return true;
    }

    /* Собрать состояние экрана для canStart. */
    function gather(count) {
      return {
        enabled: enabledNow(),
        motion: motion(),
        hidden: hidden(),
        modal: modalOpen(),
        player: playerOpen(),
        trailer: trailerLive(),
        native: nativeSaver(),
        controller: controllerName(),
        frames: count
      };
    }

    function start() {
      idle_timer = 0;
      var list = [];
      try { list = frames(); } catch (e) { warn('ambient: frames failed', e); }
      if (!canStart(gather(list.length))) { schedule(); return; }
      reel = playlist(list, REEL, Math.random);
      if (!reel.length) { schedule(); return; }
      bad = {};
      index = -1;
      slot = 0;
      if (!build()) { schedule(); return; }
      live = true;
      markCovered(true);
      try { show(0); } catch (e2) { warn('ambient: start failed', e2); }
      slide_timer = setT(tick, SLIDE_MS);
    }

    /* Ждать покоя. Пока слой на экране, ждать нечего: таймер вернётся при
       выходе из режима. */
    function schedule() {
      clearT(idle_timer);
      idle_timer = 0;
      if (!installed || live) return;
      idle_timer = setT(start, delayMs());
    }

    /* Снять слой немедленно: без анимации ухода и без планирования. Точка
       уборки для uninstall(), выключения плагина и смены настройки. */
    function drop() {
      clearT(slide_timer);
      slide_timer = 0;
      clearT(out_timer);
      out_timer = 0;
      killPreload();
      killWatch();
      live = false;
      markCovered(false);
      if (node) {
        try { node.remove(); } catch (e) { warn('ambient: remove failed', e); }
      }
      node = null;
      imgs = [];
      dots = [];
      reel = [];
      index = -1;
      slot = 0;
    }

    /* Плавный выход: кадры останавливаются сразу (и режим сразу считается
       неактивным — второе нажатие пульта уже уходит к Lampa), сам слой
       уезжает за FADE_MS. */
    function hide() {
      if (!node) { schedule(); return; }
      clearT(slide_timer);
      slide_timer = 0;
      killPreload();
      killWatch();
      live = false;
      /* Признак снимается вместе с кадрами, а не по концу анимации ухода:
         уезжающий слой уже прозрачен, и держать под ним всё на паузе лишние
         FADE_MS незачем. */
      markCovered(false);
      var leaving = node;
      try { leaving.addClass('is-out'); } catch (e) { }
      clearT(out_timer);
      out_timer = setT(function () {
        out_timer = 0;
        try { leaving.remove(); } catch (e2) { warn('ambient: remove failed', e2); }
        if (node === leaving) {
          node = null;
          imgs = [];
          dots = [];
          reel = [];
          index = -1;
          slot = 0;
        }
      }, FADE_MS);
      schedule();
    }

    /* Любая активность пользователя. swallow — «это пульт»: нажатие,
       которым разбудили экран, до Lampa не доходит (иначе оно заодно
       сдвинуло бы фокус под слоем). */
    function wake(event, swallow) {
      if (!live) {
        var t = Date.now();
        if (t - last_poke < POKE_MS && idle_timer) return;
        last_poke = t;
        schedule();
        return;
      }
      if (swallow && event) {
        try { if (typeof event.preventDefault === 'function') event.preventDefault(); } catch (e) { }
        try { if (typeof event.stopPropagation === 'function') event.stopPropagation(); } catch (e2) { }
      }
      hide();
    }

    /* ------------------------------------------------------------------ */
    /* Подписки                                                            */
    /* ------------------------------------------------------------------ */

    function install() {
      if (installed) { schedule(); return; }
      var d = doc();
      if (!d || typeof d.addEventListener !== 'function') return;
      bound = {
        keydown: function (event) { wake(event, true); },
        mousemove: function (event) { wake(event, false); },
        touchstart: function (event) { wake(event, false); }
      };
      try {
        d.addEventListener('keydown', bound.keydown, true);
        d.addEventListener('mousemove', bound.mousemove, true);
        d.addEventListener('touchstart', bound.touchstart, true);
      } catch (e) {
        warn('ambient: listeners failed', e);
        bound = null;
        return;
      }
      installed = true;
      schedule();
    }

    function uninstall() {
      var d = doc();
      if (bound && d && typeof d.removeEventListener === 'function') {
        try {
          d.removeEventListener('keydown', bound.keydown, true);
          d.removeEventListener('mousemove', bound.mousemove, true);
          d.removeEventListener('touchstart', bound.touchstart, true);
        } catch (e) {
          warn('ambient: unlisten failed', e);
        }
      }
      bound = null;
      installed = false;
      clearT(idle_timer);
      idle_timer = 0;
      drop();
    }

    /* Настройку переключили на лету (или плагин включили/выключили). */
    function apply() {
      try {
        if (!enabledNow()) { uninstall(); return; }
        if (!installed) { install(); return; }
        /* Уже подписаны — могла измениться только задержка. */
        schedule();
      } catch (e) {
        warn('ambient: apply failed', e);
      }
    }

    var api = {
      sizeFor: sizeFor,
      nextIndex: nextIndex,
      normalizeFrames: normalizeFrames,
      playlist: playlist,
      canStart: canStart,
      clockText: clockText,
      frames: frames,
      delayMs: delayMs,
      install: install,
      uninstall: uninstall,
      apply: apply,
      stop: drop,
      active: function () { return live; },
      _delayMs: 0,
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.ambient;

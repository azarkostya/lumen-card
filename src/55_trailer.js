  /* -------------------------------------------------------------------- */
  /* Task 7: фоновый трейлер YouTube (экран 02 дизайна).                   */
  /*                                                                       */
  /* Публично — LC.trailer.{pickTrailer, modeFor, mode, player, schedule,  */
  /* stopActive, bind}. Чистая часть (pickTrailer/modeFor) без DOM и без   */
  /* Lampa — тестируется напрямую; рантайм читает window/document/таймеры  */
  /* только ПО ВЫЗОВУ, поэтому модуль грузится обычным test/_load.mjs.     */
  /*                                                                       */
  /* Жизненный цикл (поправки координатора):                               */
  /*  - контроллер лежит и в LC.active.trailer (90_runtime.js), и на слое  */
  /*    layer.data('lumenTrailer') — второе делает остановку трейлера      */
  /*    частью LC.backdrops.cancel(body)/stopSlideshow(layer) БЕЗ обратной  */
  /*    зависимости 50_backdrops.js от этого модуля: cancel уже вызывается  */
  /*    и для своей карточки на 'activity':destroy, и для осиротевших       */
  /*    карточек из истории Lampa.                                          */
  /*  - слайдшоу ставится на паузу на время трейлера и возобновляется       */
  /*    после; LC.active.slideshow читается В МОМЕНТ вызова — за время      */
  /*    ролика контроллер мог быть пересоздан LC.backdrops.revive().        */
  /*                                                                        */
  /* Кнопка «Стоп» (экран 02) создаётся только на время проигрывания и      */
  /* удаляется вместе с ним. Так сделано намеренно: Lampa собирает          */
  /* .selector'ы СНИМКОМ (Controller.collectionSet -> Navigator.           */
  /* setCollection), а Navigator у Lampa создан без ignoreHiddenElement —   */
  /* _isNavigable() скрытые узлы НЕ отсеивает, и _getAllRects() оставляет   */
  /* вырожденный прямоугольник 0×0 в точке (0,0) полноценным кандидатом     */
  /* (vendor/lampa/vender/navigator/navigator.js: 86, 268-281, 293-306).    */
  /* Постоянно висящий в разметке скрытый .selector поэтому мог бы          */
  /* перехватить движение «вверх»/«влево» с ряда кнопок. По той же причине  */
  /* кнопка живёт ВНЕ .full-start-new__buttons и .buttons--container —      */
  /* разметка кнопок Lampa не меняется вовсе, хэши приоритета целы          */
  /* (план 0.2 «Кнопки и хэш приоритета»).                                  */
  /* -------------------------------------------------------------------- */

  LC.trailer = (function () {

    var API_ID = 'lumen-yt-api';
    var API_SRC = 'https://www.youtube.com/iframe_api';
    /* План Task 7: старт через 3 с после открытия карточки; если за 6 с
       ролик так и не заиграл (нет сети, YouTube недоступен, autoplay
       запрещён) — тихо убираем и возвращаем слайдшоу. */
    var START_DELAY_MS = 3000;
    var WAIT_MS = 6000;

    /* ------------------------------------------------------------------ */
    /* Чистая часть: выбор ролика и режим настройки.                       */
    /* ------------------------------------------------------------------ */

    /* У элементов e.data.videos.results[] НЕТ полей type/site (план 0.2 и
       docs/research/API_NOTES_2.md) — тип угадываем по name на двух языках. */
    function typeScore(name) {
      var s = ('' + (name || '')).toLowerCase();
      if (s.indexOf('трейлер') !== -1 || s.indexOf('trailer') !== -1) return 40;
      if (s.indexOf('тизер') !== -1 || s.indexOf('teaser') !== -1) return 20;
      return 5;
    }

    function langScore(code) {
      var c = ('' + (code || '')).toLowerCase();
      if (c === 'ru') return 30;
      if (c === 'en') return 10;
      return 0;
    }

    function score(video) {
      return typeScore(video.name) + langScore(video.iso_639_1) + (video.official ? 5 : 0);
    }

    /* Лучший по score; без key элемент пропускается (играть нечего). При
       равенстве остаётся первый по порядку — строгое «>» ниже. */
    function pickTrailer(list) {
      if (!list || typeof list.length !== 'number') return null;
      var best = null;
      var bestScore = -1;
      for (var i = 0; i < list.length; i++) {
        var video = list[i];
        if (!video || !video.key) continue;
        var current = score(video);
        if (current > bestScore) {
          bestScore = current;
          best = video;
        }
      }
      return best;
    }

    /* stored — сырое значение lumen_trailer ('auto'|'on'|'off'), platform —
       {tizen, webos}. 'auto' на Tizen/webOS -> 'off' (экономия ТВ: iframe
       YouTube поверх карточки там дороже выигрыша), иначе 'on'. Незнакомое
       значение считается как 'auto' — так же, как LC.motionModeFor. */
    function modeFor(stored, platform) {
      if (stored !== 'on' && stored !== 'off') stored = 'auto';
      if (stored !== 'auto') return stored;
      platform = platform || {};
      if (platform.tizen || platform.webos) return 'off';
      return 'on';
    }

    function mode() {
      var stored = 'auto';
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_trailer');
      } catch (e) { }
      var platform = { tizen: false, webos: false };
      try {
        if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
          platform.tizen = !!Lampa.Platform.is('tizen');
          platform.webos = !!Lampa.Platform.is('webos');
        }
      } catch (e2) { }
      return modeFor(stored, platform);
    }

    /* ------------------------------------------------------------------ */
    /* Контроллер плеера YouTube IFrame API.                               */
    /* ------------------------------------------------------------------ */

    /* $host — узел .lumen-bg__trailer внутри слоя фона. Возвращает
       {destroy}; destroy идемпотентен и всегда проходит через kill(), то
       есть onEnd вызывается ровно один раз, каким бы путём ни завершилось
       воспроизведение (старт не случился за WAIT_MS, ошибка плеера, конец
       ролика, закрытие карточки). */
    function player($host, key, onStart, onEnd) {
      var id = 'lumen-yt-' + Date.now();
      var yt = null;
      var dead = false;
      var timeout = null;

      $host.html('<div id="' + id + '"></div>');

      function kill() {
        if (dead) return;
        dead = true;
        if (timeout) { clearTimeout(timeout); timeout = null; }
        try { if (yt && yt.destroy) yt.destroy(); } catch (e) { }
        yt = null;
        try { $host.empty().removeClass('is-live'); } catch (e2) { }
        onEnd();
      }

      function create() {
        if (dead) return;
        try {
          yt = new window.YT.Player(id, {
            videoId: key,
            width: '100%',
            height: '100%',
            /* mute:1 обязателен — без звука это ещё и единственный способ
               получить autoplay в браузерах. start:4 пропускает заставку
               студии, controls/disablekb/fs убирают всю обвязку плеера. */
            playerVars: {
              autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1,
              playsinline: 1, start: 4, iv_load_policy: 3, disablekb: 1, fs: 0
            },
            events: {
              onReady: function (ev) {
                try { ev.target.mute(); ev.target.playVideo(); } catch (e) { }
              },
              onStateChange: function (ev) {
                if (!ev) return;
                if (ev.data === 1) {
                  if (timeout) { clearTimeout(timeout); timeout = null; }
                  try { $host.addClass('is-live'); } catch (e) { }
                  onStart();
                }
                if (ev.data === 0) kill();
              },
              onError: function () { kill(); }
            }
          });
        } catch (e) {
          kill();
        }
      }

      timeout = setTimeout(kill, WAIT_MS);

      if (window.YT && window.YT.Player) create();
      else {
        /* Чужой обработчик (сама Lampa, другой плагин) обязан пережить нашу
           подписку — иначе их плеер молча перестанет инициализироваться. */
        var prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
          if (prev) { try { prev(); } catch (e) { } }
          create();
        };
        if (!document.getElementById(API_ID)) {
          var script = document.createElement('script');
          script.id = API_ID;
          script.src = API_SRC;
          (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(script);
        }
      }

      return { destroy: kill };
    }

    /* ------------------------------------------------------------------ */
    /* Связка с карточкой.                                                 */
    /* ------------------------------------------------------------------ */

    /* Узел трейлера создаёт ensureLayer() в 50_backdrops.js — он стоит
       между .lumen-bg__slides и вуалями, поэтому вуали всегда поверх
       ролика. Здесь — только страховка для слоя, построенного прошлой
       версией плагина (карточка из истории Lampa). */
    function ensureHost(layer) {
      var host = layer.children('.lumen-bg__trailer');
      if (!host.length) {
        host = $('<div class="lumen-bg__trailer"></div>');
        layer.append(host);
      }
      return host;
    }

    /* Слайдшоу берётся из LC.active В МОМЕНТ вызова: за время ролика
       контроллер мог быть пересоздан LC.backdrops.revive() (карточка
       уходила на 2+ уровня в историю и вернулась). */
    function pauseSlideshow() {
      try { if (LC.active && LC.active.slideshow) LC.active.slideshow.pause(); } catch (e) { }
    }

    function resumeSlideshow() {
      try { if (LC.active && LC.active.slideshow) LC.active.slideshow.resume(); } catch (e) { }
    }

    /* Пересборка .selector'ов карточки после появления/удаления кнопки
       «Стоп». Снимок Navigator'а иначе не узнает о новом узле (и будет
       держать удалённый). Текущий фокус сохраняется: collectionFocus сам
       отбрасывает target, у которого offsetParent === null. Трогаем только
       пока активен контроллер карточки — на чужом экране перекладывать
       коллекцию нельзя. */
    function recollect(root) {
      try {
        if (!window.Lampa || !Lampa.Controller) return;
        if (typeof Lampa.Controller.collectionSet !== 'function') return;
        var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (!enabled || enabled.name !== 'full_start') return;
        var focused = root.find('.focus');
        Lampa.Controller.collectionSet(root);
        if (typeof Lampa.Controller.collectionFocus === 'function') {
          Lampa.Controller.collectionFocus(focused && focused.length ? focused : false, root);
        }
      } catch (e) {
        warn('trailer collection failed', e);
      }
    }

    function addStop(root) {
      try {
        if (root.find('.lumen-stop').length) return;
        var row = root.find('.full-start-new__buttons');
        if (!row.length) return;
        var btn = $('<div class="lumen-stop selector">' +
          '<div class="lumen-stop__ico"></div>' +
          '<span>' + LC.util.esc(LC.lang('lumen_card_stop')) + '</span>' +
          '</div>');
        /* Сосед ряда кнопок внутри того же .lumen-in — разметка самих
           кнопок Lampa не трогается (хэш приоритета). */
        row.parent().append(btn);
        recollect(root);
      } catch (e) {
        warn('trailer stop button failed', e);
      }
    }

    /* Метка «ТРЕЙЛЕР · БЕЗ ЗВУКА» (экран 02, правый верхний угол). Не
       .selector — пультом не достаётся, коллекцию не трогает. */
    function addBadge(root) {
      try {
        if (root.find('.lumen-trailer-badge').length) return;
        root.append($('<div class="lumen-trailer-badge">' + LC.util.esc(LC.lang('lumen_card_trailer_badge')) + '</div>'));
      } catch (e) {
        warn('trailer badge failed', e);
      }
    }

    function removeBadge(root) {
      try {
        var badge = root.find('.lumen-trailer-badge');
        if (badge.length) badge.remove();
      } catch (e) {
        warn('trailer badge cleanup failed', e);
      }
    }

    function removeStop(root) {
      try {
        var btn = root.find('.lumen-stop');
        if (!btn.length) return;
        var focused = btn.hasClass('focus');
        btn.remove();
        recollect(root);
        /* Фокус стоял на снятой кнопке — возвращаем его на ряд кнопок
           (иначе контроллер останется без цели). */
        if (focused) {
          var play = root.find('.full-start-new__buttons').find('.full-start__button').not('.hide').eq(0);
          if (play.length && window.Lampa && Lampa.Controller && typeof Lampa.Controller.collectionFocus === 'function') {
            Lampa.Controller.collectionFocus(play, root);
          }
        }
      } catch (e) {
        warn('trailer stop button cleanup failed', e);
      }
    }

    /* Запланировать трейлер для только что построенной карточки. Возвращает
       контроллер {destroy, isAlive} или null, если трейлер не нужен вовсе
       (выключен настройкой, нет подходящего ролика, нет слоя фона). */
    function schedule(root, body, data) {
      try {
        if (!root || !root.length || !body || !body.length) return null;
        if (mode() === 'off') return null;
        /* Экономия ТВ: в режиме «анимации выключены» фонового видео тоже нет.
           Экран 02 этому не противоречит — он показывает обычный режим. */
        try { if (LC.motionMode() === 'off') return null; } catch (e) { }

        var videos = data && data.videos && data.videos.results;
        var video = pickTrailer(videos);
        if (!video) return null;

        var layer = body.children('.lumen-backdrop');
        if (!layer || !layer.length) return null;

        var alive = true;
        var control = null;
        var timer = null;

        function cleanup() {
          try { root.removeClass('lumen-trailer-on'); } catch (e) { }
          try { layer.removeClass('lumen-trailer-live'); } catch (e2) { }
          removeBadge(root);
          removeStop(root);
          resumeSlideshow();
        }

        function begin() {
          timer = null;
          if (!alive) return;
          /* Слой уже не в документе (карточку закрыли) или карточка ушла в
             фон под другую активность — трейлер не начинаем. */
          if (!LC.slideshow.isMounted(layer[0])) { alive = false; return; }
          if (!LC.slideshow.isLayerForeground(layer)) { alive = false; return; }

          pauseSlideshow();
          control = player(ensureHost(layer), video.key, function () {
            if (!alive) return;
            try { root.addClass('lumen-trailer-on'); } catch (e) { }
            try { layer.addClass('lumen-trailer-live'); } catch (e2) { }
            addBadge(root);
            addStop(root);
          }, function () {
            control = null;
            if (!alive) return;
            alive = false;
            cleanup();
          });
        }

        function destroy() {
          if (timer) { clearTimeout(timer); timer = null; }
          if (!alive) return;
          if (control) {
            /* kill() -> onEnd -> cleanup(): порядок и однократность
               обеспечивает сам player(). */
            var current = control;
            control = null;
            current.destroy();
            alive = false;
            return;
          }
          alive = false;
          cleanup();
        }

        timer = setTimeout(begin, START_DELAY_MS);

        var api = { destroy: destroy, isAlive: function () { return alive; } };
        /* Дубль ссылки на слое: LC.backdrops.stopSlideshow(layer) гасит
           трейлер вместе со слайдшоу — и для своей карточки, и для
           осиротевших карточек из истории Lampa. */
        layer.data('lumenTrailer', api);
        return api;
      } catch (e) {
        warn('trailer schedule failed', e);
        return null;
      }
    }

    /* Остановить трейлер текущей карточки (уход фокуса с full_start, OK на
       любой кнопке карточки, выключение настройки). */
    function stopActive() {
      try {
        if (LC.active && LC.active.trailer) {
          LC.active.trailer.destroy();
          LC.active.trailer = null;
        }
      } catch (e) {
        warn('trailer stop failed', e);
      }
    }

    /* Одна подписка на корень карточки: события Lampa (hover:enter) не
       всплывают — слушаем в фазе перехвата, как bindEpisodes в
       85_header.js. Любое нажатие OK по карточке снимает трейлер; сама
       кнопка «Стоп» ничего больше не делает — её работа и есть остановка. */
    function bind(root) {
      try {
        var el = root && root[0];
        if (!el || typeof el.addEventListener !== 'function' || el.lumenTrailerBound) return;
        el.lumenTrailerBound = true;
        el.addEventListener('hover:enter', function () {
          try { stopActive(); } catch (err) { warn('trailer enter failed', err); }
        }, true);
      } catch (e) {
        warn('trailer bind failed', e);
      }
    }

    return {
      pickTrailer: pickTrailer,
      modeFor: modeFor,
      mode: mode,
      player: player,
      schedule: schedule,
      stopActive: stopActive,
      bind: bind
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.trailer;

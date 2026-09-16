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
    /* Период сторожа «карточка ещё на экране» (см. startWatchdog ниже).
       Тикает только пока ролик реально играет. */
    var WATCH_MS = 1000;

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

    /* Ревью (утечка): ждущие готовности API плееры держатся СПИСКОМ, а
       window.onYouTubeIframeAPIReady оборачивается РОВНО ОДИН раз за жизнь
       плагина. Раньше каждая карточка навешивала свою обёртку поверх
       предыдущей, замыкая create -> $host -> (через parentNode) всё дерево
       карточки; если YouTube недоступен (нет сети, блокировка), kill() по
       таймауту обнулял только yt, а ссылка из цепочки оставалась — 20-30
       карточек за сессию давали столько же удержанных деревьев в памяти ТВ.
       Теперь kill() вычёркивает свой create из pending, и последняя ссылка
       на карточку исчезает вместе с ним. */
    var pending = [];
    var hooked = false;

    function hook() {
      if (hooked) return;
      hooked = true;
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (prev) { try { prev(); } catch (e) { } }
        var list = pending;
        pending = [];
        for (var i = 0; i < list.length; i++) {
          try { list[i](); } catch (e2) { }
        }
      };
    }

    /* Порядковый номер вместо Date.now(): два плеера в одну миллисекунду
       (быстрый backward между карточками) получили бы одинаковый id узла. */
    var seq = 0;

    /* $host — узел .lumen-bg__trailer внутри слоя фона. Возвращает
       {destroy}; destroy идемпотентен и всегда проходит через kill(), то
       есть onEnd вызывается ровно один раз, каким бы путём ни завершилось
       воспроизведение (старт не случился за WAIT_MS, ошибка плеера, конец
       ролика, закрытие карточки). */
    function player($host, key, onStart, onEnd) {
      var id = 'lumen-yt-' + (++seq);
      var yt = null;
      var dead = false;
      var timeout = null;

      $host.html('<div id="' + id + '"></div>');

      function kill() {
        if (dead) return;
        dead = true;
        /* Вычёркиваем свой create из очереди ожидания API — иначе глобальный
           хук держал бы его (а через него и всё дерево карточки) до конца
           сессии. */
        for (var p = 0; p < pending.length; p++) {
          if (pending[p] === create) { pending.splice(p, 1); break; }
        }
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
            /* Приватность: домен без рекламных кук (ролик фоновый, счётчики
               просмотров нам не нужны). */
            host: 'https://www.youtube-nocookie.com',
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
           подписку — его сохраняет hook() при первой обёртке. */
        pending.push(create);
        hook();
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

    /* Слайдшоу берётся СО СВОЕГО СЛОЯ, а не из глобального LC.active:
       сторож карточки A может сработать уже после 'full':complite карточки
       B, и тогда снятие паузы через LC.active достало бы слайдшоу B — паузу
       ставили одному контроллеру, снимали бы с другого. Прежняя причина
       читать из LC.active («контроллер мог быть пересоздан revive») теперь
       закрыта самим слоем: LC.backdrops.revive() кладёт новый контроллер в
       layer.data('lumenSlideshow'), поэтому актуальное значение всегда там. */
    function slideshowOf(layer) {
      try { return layer.data('lumenSlideshow'); } catch (e) { return null; }
    }

    function pauseSlideshow(layer) {
      try { var s = slideshowOf(layer); if (s) s.pause(); } catch (e) { }
    }

    function resumeSlideshow(layer) {
      try { var s = slideshowOf(layer); if (s) s.resume(); } catch (e) { }
    }

    /* Пересборка .selector'ов карточки после появления/удаления кнопки
       «Стоп»: снимок Navigator'а иначе не узнает о новом узле (и будет
       держать удалённый).

       Ревью: имени контроллера НЕДОСТАТОЧНО. Сторож карточки A срабатывает
       и тогда, когда пользователь уже ушёл вглубь или открыл карточку B
       (hover:enter до корня A не долетает: bind висит на .full-start-new, а
       ряды «похожие»/актёры лежат в .activity__body вне корня). Если на B
       фокус стоит на кнопках, enabled().name === 'full_start' — прежний
       guard пропускал вызов, и collectionSet(root_A) перекладывал навигацию
       на НЕВИДИМУЮ карточку A: пульт ходил по её дереву до следующего
       toggle. Страховки в Lampa нет — неактивная активность скрыта
       прозрачностью (.activity{opacity:0}), а не display, поэтому
       offsetParent у её узлов НЕ null и collectionFocus честно их фокусирует.
       Поэтому проверяем принадлежность экрану тем же механизмом, что и
       сторож: корень должен лежать в .activity--active. */
    function recollect(root, target) {
      try {
        if (!LC.slideshow.isLayerForeground(root)) return;
        if (!window.Lampa || !Lampa.Controller) return;
        if (typeof Lampa.Controller.collectionSet !== 'function') return;
        var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (!enabled || enabled.name !== 'full_start') return;
        /* target — куда вернуть фокус явно (снятая кнопка «Стоп» уводит его
           на ряд кнопок). Без него — тот, кто в фокусе сейчас. */
        var focused = (target && target.length) ? target : root.find('.focus');
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
        /* Фокус стоял на снятой кнопке — возвращаем его на ряд кнопок одним
           проходом recollect (иначе фокус переставлялся бы дважды: сперва на
           первый .selector, потом на «Смотреть»). */
        var play = focused ? root.find('.full-start-new__buttons').find('.full-start__button').not('.hide').eq(0) : null;
        recollect(root, play);
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
        /* Слайдшоу ставится на паузу только с фактическим стартом ролика,
           поэтому и возобновлять его нужно только если пауза была: иначе
           destroy() до старта дёргал бы resume() вхолостую. */
        var paused = false;
        var watchdog = null;

        function stopWatchdog() {
          if (watchdog) { clearInterval(watchdog); watchdog = null; }
        }

        /* Уход вглубь (другая карточка, актёр, каталог, настройки, плеер)
           Lampa НЕ сообщает событием для покидаемой активности — ровно та же
           история, что со слайдшоу (см. tryFrom в 51_slideshow.js и большой
           комментарий про Activity.push в 90_runtime.js). Поэтому пока ролик
           играет, раз в секунду проверяем, на экране ли ещё наш слой, и
           гасим трейлер, если нет: иначе звук-без-звука продолжал бы крутить
           iframe за чужим экраном, а карточка возвращалась бы из истории в
           режиме трейлера (описание и боковая колонка скрыты, ролика нет).
           Тик заводится только на время проигрывания и снимается в cleanup. */
        function startWatchdog() {
          if (watchdog) return;
          watchdog = setInterval(function () {
            try {
              if (!LC.slideshow.isMounted(layer[0]) || !LC.slideshow.isLayerForeground(layer)) destroy();
            } catch (e) { }
          }, WATCH_MS);
        }

        function cleanup() {
          stopWatchdog();
          try { root.removeClass('lumen-trailer-on'); } catch (e) { }
          try { layer.removeClass('lumen-trailer-live'); } catch (e2) { }
          removeBadge(root);
          removeStop(root);
          if (paused) {
            paused = false;
            resumeSlideshow(layer);
          }
        }

        function begin() {
          timer = null;
          if (!alive) return;
          /* Слой уже не в документе (карточку закрыли) или карточка ушла в
             фон под другую активность — трейлер не начинаем. */
          if (!LC.slideshow.isMounted(layer[0])) { alive = false; return; }
          if (!LC.slideshow.isLayerForeground(layer)) { alive = false; return; }

          control = player(ensureHost(layer), video.key, function () {
            if (!alive) return;
            /* Пауза — только когда ролик РЕАЛЬНО пошёл: при недоступном
               YouTube кадры иначе замирали бы на все 6 с ожидания впустую. */
            paused = true;
            pauseSlideshow(layer);
            startWatchdog();
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
          /* Симметрично schedule(): мёртвый контроллер не должен оставаться
             на слое до следующего stopSlideshow(). */
          try { if (layer.data('lumenTrailer') === api) layer.removeData('lumenTrailer'); } catch (e) { }
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

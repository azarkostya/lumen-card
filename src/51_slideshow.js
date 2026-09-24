  /* -------------------------------------------------------------------- */
  /* Слайдшоу кадров (Task 6, refactor — решение координатора): контроллер */
  /* вынесен из 50_backdrops.js в отдельный модуль, потому что Task 7      */
  /* (фоновый трейлер) будет ставить его на паузу/возобновлять извне так   */
  /* же, как 90_runtime.js уже делает это для archive/start (LC.active.    */
  /* slideshow.pause()/.resume()). Публично — LC.slideshow.create(layer,   */
  /* urls, opts) -> {activate, isAlive, pause, resume, destroy}. urls —    */
  /* уже готовый список URL кадров (LC.backdrops.pickBackdrops + LC.       */
  /* cardinfo.imageUrl, посчитан заранее в 50_backdrops.js — этот модуль   */
  /* про TMDB/cardinfo не знает вовсе). activate() — отдельный от create() */
  /* шаг: 50_backdrops.js вызывает его из finish(true) loadBackdrop(),     */
  /* т.е. когда первый кадр, .lumen-backdrop__img, уже реально загружен и  */
  /* показан (план: «не грузить его дважды») — сам create() ничего не      */
  /* грузит и не трогает DOM. pause/resume/destroy — контракт              */
  /* LC.active.slideshow из 90_runtime.js. opts = {enabled: fn, intervalMs:*/
  /* fn} — 50_backdrops.js передаёт сюда чтения настроек                   */
  /* lumen_slideshow/lumen_slide_interval, сам модуль про имена настроек   */
  /* не знает (вызывает их заново на каждый pause/resume/activate — так    */
  /* подхватываются изменения на уже открытой карточке).                   */
  /*                                                                        */
  /* Обзор координатора (fix, Important): весь модуль обёрнут в один       */
  /* LC.slideshow = (function(){ … })() — без этого create/isNodeMounted/  */
  /* CROSSFADE_MS и остальные помощники были верхнеуровневыми именами всей */
  /* сборки (scripts/build.mjs роняет build на повторе имени между         */
  /* файлами), и будущая Task 7 с её собственной function create() уронила */
  /* бы build. 50_backdrops.js/90_runtime.js/тесты внутрь не заглядывают — */
  /* только через LC.slideshow.*, поэтому перенос прозрачен. */
  /* -------------------------------------------------------------------- */

  LC.slideshow = (function () {

    /* Task 6 (fix, решение координатора по live-check п.4): "пауза"
       слайдшоу при уходе вглубь карточки (Lampa.Activity.push поверх
       открытой) не детектируется через Lampa.Listener.follow('activity')
       — проверено исходником и живым логом (см. большой комментарий в
       90_runtime.js над followActivityLifecycle): push ничего не шлёт для
       оставленной активности. Вместо подписки — проверка в каждом тике
       таймера, ДО предзагрузки следующего кадра (tryFrom ниже): если слой
       сейчас не на экране (лежит внутри архивной .activity без класса
       .activity--active), тик просто пропускается — ни Image(), ни смены
       is-active, — а сам таймер не трогаем: следующий тик проверит снова,
       и как только карточка опять на экране, смена кадров возобновится
       сама. isActivityForeground — чистая часть (только .length/
       .hasClass, без .closest()) — тестируется заглушками отдельно от
       DOM-обхода. */
    /* Долг фазы 1, п.4 (правка 2026-09-23): правило «на экране» живёт в
       одном месте — LC.util.onScreen (src/10_util.js, разбор там же).
       Прежние имена оставлены ссылками на него: их спрашивают
       test/onscreen.test.mjs и test/slideshow.test.mjs, написанные до
       переноса. */
    var isActivityForeground = LC.util.activityOnScreen;
    var isLayerForeground = LC.util.onScreen;

    /* Максимум кадров по режиму анимаций (план: full 8, lite 4, off 1 без
       смены) — off даёт вызывающей стороне max=1, т.е. только главный
       кадр, и сама возможность завести таймер ротации отпадает в create()
       ниже без отдельной проверки режима (urls.length <= 1). */
    function maxFramesFor(mode) {
      if (mode === 'off') return 1;
      if (mode === 'lite') return 4;
      return 8;
    }

    /* Task 6 (fix, обзор координатора п.5): единая проверка «узел всё ещё
       в документе» — раньше была своя копия и здесь, и в 50_backdrops.js
       (isMounted). Экспортирована как LC.slideshow.isMounted: вызовы идут
       в рантайме (после того как вся сборка уже определена), поэтому то,
       что 50_backdrops.js стоит в файле раньше 51_slideshow.js, ничему не
       мешает — к моменту первого реального вызова LC.slideshow уже
       присвоен. */
    function isMounted(node) {
      try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
    }

    /* Общий признак «экран накрыт» (src/00_head.js). В тестах, где
       51_slideshow.js грузится без соседей, LC.covered может не быть вовсе —
       тогда экран считается открытым. */
    function covered() {
      try {
        return typeof LC.covered === 'function' && LC.covered() === true;
      } catch (e) {
        return false;
      }
    }

    /* Длительность кроссфейда — должна совпадать с opacity-transition
       .lumen-bg__img в src/30_css.js (transition:opacity 1.2s ease-in-out;
       с 2026-09-24 он есть только в full при тяжёлых эффектах, в lite смена
       резкая — лишние 1,2 с тёплого уходящего кадра там ничего не стоят).
       Используется дважды (fix, Important/Minor): чтобы не гасить
       background-image уходящего кадра раньше, чем он реально долетит до
       opacity:0 (память, п.3), и чтобы держать инлайн-transform (Ken
       Burns, п.4) ровно на время затухания. */
    var CROSSFADE_MS = 1200;

    /* Контроллер слайдшоу для ОДНОГО layer/apply(). Создаётся синхронно
       (до ответа сети) в неактивном состоянии — pause/resume/destroy
       безопасны сразу, но ничего не делают, пока activate() не вызван.
       activate() помечает первый кадр (.lumen-backdrop__img) классами
       lumen-bg__img/is-active (Ken Burns, Task 4/30_css.js) и, если
       opts.enabled() и есть больше одного кадра, заводит ротацию.
       Дальнейшие кадры — элементы .lumen-bg__img внутри .lumen-bg__slides,
       предзагружаются Image() и показываются только по onload; битый
       кадр (onerror) помечается false и пропускается — advance() пробует
       следующий по очереди, но не больше urls.length попыток за один тик
       (чтобы не зациклиться, если битые все).

       Task 6 (fix, п.3, Minor — память ТВ): в DOM с background-image
       держим только текущий кадр и уходящий (на время кроссфейда) —
       warm[i] отмечает, у какого frames[i] сейчас реально стоит
       background-image. Когда кадр перестаёт быть текущим/уходящим (через
       CROSSFADE_MS после смены), его background-image снимается и warm[i]
       сбрасывается; если очередь дойдёт до него снова, ensureFrame()
       увидит "холодный" элемент и переставит ту же строку url() заново —
       HTTP-кэш браузера делает это бесплатным (сеть уже не ходит, Image()
       второй раз не создаётся). Обзор координатора (п.3): если смена
       кадра случается БЫСТРЕЕ, чем предыдущий уходящий успел остыть
       (в реальности невозможно при интервале 8с+ >> 1.2с, но защищаемся),
       scheduleCoolDown охлаждает предыдущий ожидающий НЕМЕДЛЕННО (а не
       теряет его — раньше stopCleanupTimer() просто отменял таймер, и тот
       кадр оставался тёплым навсегда, пока очередь не дойдёт до него по
       кругу).

       Task 6 (fix, п.4, Minor — плавный Ken Burns): снятие is-active
       мгновенно останавливает CSS-анимацию lumen-kb, и transform
       уходящего кадра тут же прыгает обратно к scale(1) — заметный скачок
       посреди кроссфейда. Перед тем как снять is-active, читаем
       getComputedStyle(...).transform ПОКА анимация ещё идёт и фиксируем
       его инлайн-стилем на уходящем кадре — инлайн-стиль слабее активной
       CSS-анимации (просто не виден, пока она играет), поэтому это
       безопасно сделать заранее; как только is-active снят и анимация
       останавливается, инлайн-transform "подхватывает" её последнее
       значение вместо прыжка на scale(1). Через CROSSFADE_MS
       инлайн-transform снимается вместе с background-image. Только когда
       у САМОГО СЛОЯ (layer, не карточки) есть класс lumen-motion-full —
       там же, где вообще играет Ken Burns (30_css.js:
       .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active); класс
       читаем с layer, а не через LC.motionMode() — обзор координатора
       (п.2): этот модуль намеренно не читает настройки/LC.motionMode
       напрямую (opts уже несёт всё, что нужно про enabled/interval), а
       синхронизация lumen-motion-* классов на слое — забота
       syncMotionClass()/LC.applyMotionMode() в других модулях. */
    /* Правка 2026-09-23 (настройка «Что показывает кадр главной»): третий
       необязательный ключ opts.show(url, done) — ротация БЕЗ собственного
       DOM. Кадр героя главной показывает сам герой (src/48_hero.js,
       loadFrame/swapFrame: два <img>, decode(), подложка LQIP, сторож
       поколения), и заводить ему вторые слои с background-image значило бы
       держать в памяти кадры дважды. С opts.show контроллер отвечает ровно
       за ритм — таймер, паузу, «не на экране», «экран накрыт», пропуск
       битых кадров и очередь по кругу, — а показ отдаёт вызывающей стороне:
       show(url, done) обязан позвать done(true), когда кадр на экране, и
       done(false), если он не пришёл (кадр помечается битым и больше не
       предлагается). Не позвал вовсе — очередь стоит на месте, и следующий
       тик предложит тот же кадр снова. activate() в этом режиме DOM не
       трогает: первый кадр уже показан вызывающей стороной. */
    function create(layer, urls, opts) {
      opts = opts || {};
      var enabledFn = typeof opts.enabled === 'function' ? opts.enabled : function () { return true; };
      var intervalFn = typeof opts.intervalMs === 'function' ? opts.intervalMs : function () { return 14000; };
      var show = typeof opts.show === 'function' ? opts.show : null;

      var alive = true;
      var paused = false;
      var timer = null;
      var pendingLoader = null;
      var frames = null;   // null, пока activate() не вызван
      var warm = null;     // warm[i] === true, если у frames[i] сейчас стоит background-image
      var activeIdx = -1;
      var idx = 0;
      var cleanupTimer = null;
      var cleanupPending = null; // {i, el} — кадр, ожидающий охлаждения через cleanupTimer

      function isLayerMounted() {
        return isMounted(layer[0]);
      }

      function stopTimer() {
        if (timer) { clearInterval(timer); timer = null; }
      }

      function stopCleanupTimer() {
        if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
      }

      /* Снимает background-image и (если был) инлайн-transform с кадра,
         который уже CROSSFADE_MS как не активен и не уходящий. */
      function coolDown(i, el) {
        try {
          el.css('transform', '');
          el.css('background-image', '');
        } catch (e) { }
        warm[i] = false;
      }

      /* Обзор координатора (fix, п.3): если на момент новой смены кадра
         предыдущий уходящий ЕЩЁ ждёт своего остывания (переход случился
         быстрее CROSSFADE_MS) — охлаждаем его немедленно, а не теряем
         вместе с отменённым таймером. */
      function scheduleCoolDown(i, el) {
        if (cleanupPending) {
          stopCleanupTimer();
          coolDown(cleanupPending.i, cleanupPending.el);
        }
        cleanupPending = { i: i, el: el };
        cleanupTimer = setTimeout(function () {
          cleanupTimer = null;
          cleanupPending = null;
          coolDown(i, el);
        }, CROSSFADE_MS);
      }

      function setActive(i) {
        /* Ревью (fix, Important 2 — регрессия предыдущего фикса п.3): кадр
           i как раз ждёт своего остывания (очередь всего из 2 кадров идёт
           по кругу быстрее CROSSFADE_MS, либо часть кандидатов битая и
           круг короткий) — мы возвращаемся к нему РАНЬШЕ, чем истекло его
           отложенное охлаждение. Отменяем это охлаждение БЕЗ выполнения
           (не coolDown!) — кадр снова активен, снимать с него
           background-image нельзя. Проверка обязана идти ДО toggle
           классов ниже: иначе scheduleCoolDown() для НОВОГО уходящего
           кадра увидел бы это же ожидающее охлаждение как "чужое" и
           немедленно выполнил coolDown(i) уже ПОСЛЕ того, как i получил
           is-active — снимая фон с только что показанного кадра. */
        if (cleanupPending && cleanupPending.i === i) {
          stopCleanupTimer();
          cleanupPending = null;
        }

        var prevIdx = activeIdx;
        var prevEl = (prevIdx !== -1 && frames[prevIdx]) ? frames[prevIdx] : null;

        /* Заморозка Ken Burns — ДО снятия is-active, пока анимация ещё
           реально играет (иначе getComputedStyle уже вернёт то, что после
           остановки анимации, то есть scale(1)). */
        if (prevEl && prevIdx !== i) {
          try {
            if (layer.hasClass('lumen-motion-full') && window.getComputedStyle) {
              var cs = window.getComputedStyle(prevEl[0]);
              var t = cs && (cs.transform || cs.webkitTransform);
              if (t && t !== 'none') prevEl.css('transform', t);
            }
          } catch (e) { }
        }

        for (var k = 0; k < frames.length; k++) {
          if (frames[k]) frames[k].toggleClass('is-active', k === i);
        }

        if (prevEl && prevIdx !== i) scheduleCoolDown(prevIdx, prevEl);
        activeIdx = i;
      }

      function ensureFrame(i, cb) {
        if (frames[i] === false) { cb(null); return; }
        if (frames[i]) {
          /* Кадр уже создавался раньше, но остыл (память, п.3) — url() тот
             же, повторная установка ничего не грузит из сети (HTTP-кэш). */
          if (!warm[i]) {
            try { frames[i].css('background-image', 'url("' + encodeURI(urls[i]) + '")'); warm[i] = true; } catch (e) { }
          }
          cb(frames[i]);
          return;
        }
        var url = urls[i];
        if (!url) { frames[i] = false; cb(null); return; }
        var loader = new Image();
        /* Task 39: декодирование вне главного потока (см. src/48_hero.js,
           loadFrame). */
        loader.decoding = 'async';
        pendingLoader = loader;
        loader.onload = function () {
          if (pendingLoader !== loader) return;
          pendingLoader = null;
          if (!alive || !isLayerMounted()) return;
          try {
            var el = $('<div class="lumen-bg__img"></div>');
            el.css('background-image', 'url("' + encodeURI(url) + '")');
            layer.find('.lumen-bg__slides').append(el);
            frames[i] = el;
            warm[i] = true;
            cb(el);
          } catch (e) {
            warn('slideshow frame failed', e);
            frames[i] = false;
            cb(null);
          }
        };
        loader.onerror = function () {
          if (pendingLoader !== loader) return;
          pendingLoader = null;
          frames[i] = false;
          cb(null);
        };
        loader.src = url;
      }

      /* offset растёт при каждом битом кадре в рамках одного тика (план:
         «битый — пропускается»); offset > urls.length — все кандидаты уже
         перепробованы в этот тик, остаёмся на текущем кадре до
         следующего. */
      function tryFrom(offset) {
        if (!alive || paused || !frames) return;
        if (!isLayerMounted()) { destroy(); return; }
        /* Карточка сейчас не на экране (открыта другая активность поверх)
           — пропускаем тик целиком: ни Image() для следующего кадра, ни
           смены is-active. Таймер не трогаем — следующий тик проверит
           заново. */
        if (!LC.util.onScreen(layer)) return;
        /* Экран накрыт заставкой (src/54_ambient.js): под непрозрачным слоем
           менять кадр — это декодировать картинку, которой никто не увидит,
           а «человек ушёл» обязан быть самым дешёвым режимом, а не самым
           дорогим (план Task 22 Step 3). Признак общий и живёт в
           src/00_head.js: этот модуль по-прежнему не читает ни настроек, ни
           LC.motionMode — состояние экрана он и так спрашивает у DOM
           строкой выше. Таймер не трогаем: заставка уйдёт, и следующий тик
           сменит кадр сам. */
        if (covered()) return;
        /* Ревью «Волны 1», п.1: под открытым плеером Lampa (фильм из
           карточки) кадр тоже никто не увидит — onScreen его не замечает,
           плеер не активность (разбор в LC.util.playerOpen). Таймер не
           трогаем: плеер закроют, и следующий тик сменит кадр сам. */
        if (LC.util.playerOpen()) return;
        if (offset > urls.length) return;
        var next = (idx + offset) % urls.length;
        if (show) {
          if (frames[next] === false) { tryFrom(offset + 1); return; }
          show(urls[next], function (ok) {
            if (!alive || !frames) return;
            if (!ok) {
              frames[next] = false;
              if (!paused) tryFrom(offset + 1);
              return;
            }
            idx = next;
          });
          return;
        }
        ensureFrame(next, function (el) {
          if (!alive || paused || !frames) return;
          if (!isLayerMounted()) { destroy(); return; }
          if (!el) { tryFrom(offset + 1); return; }
          idx = next;
          setActive(idx);
        });
      }

      function advance() { tryFrom(1); }

      function startTimer() {
        if (timer || !frames || urls.length <= 1) return;
        timer = setInterval(advance, intervalFn());
      }

      function activate() {
        if (!alive || frames) return; // уже активирован
        if (show) {
          frames = [];
          idx = 0;
          activeIdx = 0;
          if (enabledFn() && !paused) startTimer();
          return;
        }
        try {
          frames = [];
          warm = [];
          var firstNode = layer.find('.lumen-backdrop__img');
          firstNode.addClass('lumen-bg__img is-active');
          frames[0] = firstNode;
          warm[0] = true; // background-image первого кадра уже стоит — его поставил 50_backdrops.js до activate()
          idx = 0;
          activeIdx = 0;
          if (enabledFn() && !paused) startTimer();
        } catch (e) {
          warn('slideshow activate failed', e);
        }
      }

      function destroy() {
        alive = false;
        stopTimer();
        stopCleanupTimer();
        cleanupPending = null;
        if (pendingLoader) { pendingLoader.onload = null; pendingLoader.onerror = null; pendingLoader = null; }
      }

      return {
        activate: activate,
        /* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора):
           публичный признак жизни — без него снаружи (90_runtime.js)
           пришлось бы читать внутреннее поле контроллера напрямую, чтобы
           понять, можно ли ещё resume() или пора пересоздавать
           (LC.backdrops.revive). */
        isAlive: function () { return alive; },
        /* archive своей активности (или resume-по-факту, см.
           90_runtime.js) — ставит на паузу текущий кадр, не сбрасывая
           его. */
        pause: function () { paused = true; stopTimer(); },
        /* start своей активности, а также включение lumen_slideshow /
           смена lumen_slide_interval на открытой карточке (90_runtime.js
           LC.applySlideshowPref вызывает pause()+resume() на каждое
           изменение — resume() всегда читает opts.intervalMs()/opts.
           enabled() заново, поэтому подхватывает и новый интервал). */
        resume: function () {
          paused = false;
          if (alive && frames && enabledFn()) startTimer();
        },
        destroy: destroy
      };
    }

    return {
      create: create,
      isActivityForeground: isActivityForeground,
      isLayerForeground: isLayerForeground,
      maxFramesFor: maxFramesFor,
      isMounted: isMounted,
      /* Ревью (fix, Minor 2): LC.backdrops.revive() (50_backdrops.js) тоже
         откладывает уборку старого кадра на длительность кроссфейда —
         числа не должны разъезжаться по двум файлам. */
      CROSSFADE_MS: CROSSFADE_MS
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.slideshow;

  /* -------------------------------------------------------------------- */
  /* Task 31 (фаза 4): HUD отладки на экране ТВ.                           */
  /*                                                                       */
  /* Без adb на телевизоре нет консоли, и LC.perf (src/68_perf.js) хоть и   */
  /* меряет первый кадр карточки, но отдаёт вердикт только в Storage — на   */
  /* экране его не видно. HUD рисует то же самое живьём, в углу экрана:    */
  /* FPS, число долгих задач (PerformanceObserver 'longtask'), разрешение   */
  /* и devicePixelRatio, режим анимаций (LC.motionMode) и число             */
  /* полноэкранных слоёв плагина (герой, фон, атмосферы, заставка, переход, */
  /* фон рулетки — ровно те классы, что ставят их модули). Назначение —    */
  /* калибровка порогов автодетекта (SLOW_MS/FAST_MS в LC.perf) на реальном */
  /* железе пользователя, а не постоянная индикация: пункт «Отладка:        */
  /* показать FPS» стоит последним в группе «Движение» и выключен по        */
  /* умолчанию.                                                             */
  /*                                                                       */
  /* Выключенная настройка не создаёт НИЧЕГО: ни узла в DOM, ни кадрового    */
  /* цикла requestAnimationFrame, ни PerformanceObserver — start() зовётся   */
  /* только из sync(), когда LC.pref('lumen_debug_hud', false) истинно.      */
  /* -------------------------------------------------------------------- */

  LC.hud = (function () {

    /* Состояние запущенного HUD. null — выключен (start() ничего не сделал
       или stop() уже прибрал). Одно на модуль: два узла разом не нужны. */
    var state = null; /* { node, frames, last, long, raf, obs } */

    function format(d) {
      return d.fps + ' fps · ' + d.w + '×' + d.h + '@' + d.dpr + ' · ' + d.mode + ' · long ' + d.long + ' · layers ' + d.layers;
    }

    /* Полноэкранные слои плагина — по классам, которые реально ставят
       модули: .lumen-hero__bg/.lumen-hero__veil--l/--b (src/48_hero.js),
       .lumen-fx (слой атмосферы — и в кадре героя src/48_hero.js, и на
       фоне карточки src/50_backdrops.js), .lumen-backdrop
       (src/50_backdrops.js), .lumen-ambient (src/54_ambient.js),
       .lumen-overlay (src/67_transition.js), .lumen-roulette__bg
       (src/56_roulette.js). */
    var FULL = '.lumen-hero__bg,.lumen-hero__veil--l,.lumen-hero__veil--b,.lumen-fx,.lumen-backdrop,.lumen-ambient,.lumen-overlay,.lumen-roulette__bg';
    function layers() {
      try { return document.querySelectorAll(FULL).length; } catch (e) { return 0; }
    }

    /* window.requestAnimationFrame/cancelAnimationFrame/performance.now —
       через window., как в LC.perf (src/68_perf.js, raf/unraf/now): и в
       браузере ТВ, и в тестовом окружении window подменяется целиком, а
       глобальные requestAnimationFrame/performance там не заведены. */
    function raf(fn) {
      try {
        if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
      } catch (e) { }
      return 0;
    }

    function unraf(id) {
      try {
        if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
      } catch (e) { }
    }

    function now() {
      try {
        if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
      } catch (e) { }
      return Date.now();
    }

    /* Раз в секунду переписывает строку узла и планирует следующий кадр.
       Счётчик frames — число кадров за истекшую секунду, то есть и есть
       FPS; between-кадры сам узел не трогают, чтобы не грузить layout
       чаще, чем раз в секунду. */
    function paint(t) {
      if (!state) return;
      state.frames++;
      if (t - state.last >= 1000) {
        var mode = 'n/a';
        try { mode = LC.motionMode(); } catch (e) { }
        state.node.textContent = format({
          fps: state.frames, w: window.innerWidth, h: window.innerHeight,
          dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
          mode: mode, long: state.long, layers: layers()
        });
        state.frames = 0; state.last = t;
      }
      state.raf = raf(paint);
    }

    function start() {
      if (state) return;
      var node = document.createElement('div');
      node.className = 'lumen-hud';
      document.body.appendChild(node);
      state = { node: node, frames: 0, last: now(), long: 0, raf: 0, obs: null };
      /* 'longtask' — не во всех WebView Android TV: supportedEntryTypes
         решает, подписываться вообще или нет (реф. src/68_perf.js — там та
         же проверка перед PerformanceObserver('longtask')). */
      try {
        if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes &&
            PerformanceObserver.supportedEntryTypes.indexOf('longtask') > -1) {
          state.obs = new PerformanceObserver(function (list) {
            if (state) state.long += list.getEntries().length;
          });
          state.obs.observe({ entryTypes: ['longtask'] });
        }
      } catch (e) { }
      state.raf = raf(paint);
    }

    function stop() {
      if (!state) return;
      unraf(state.raf);
      try { if (state.obs) state.obs.disconnect(); } catch (e2) { }
      try { state.node.parentNode.removeChild(state.node); } catch (e3) { }
      state = null;
    }

    /* Единственная точка входа наружу (src/90_runtime.js, src/80_settings.js
       applyPrefChange): читает настройку и приводит состояние в соответствие
       с ней. Идемпотентна в обе стороны — start()/stop() сами ничего не
       делают, если состояние уже нужное. */
    function sync() {
      var on = false;
      try { on = LC.pref('lumen_debug_hud', false); } catch (e) { }
      if (on) start(); else stop();
    }

    return { sync: sync, stop: stop, format: format, running: function () { return !!state; }, layers: layers };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hud;

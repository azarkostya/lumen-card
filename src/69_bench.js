  /* -------------------------------------------------------------------- */
  /* Волна производительности (жалоба с ТВ «всё ещё лагает всё»,           */
  /* 2026-09-24): самодиагностика «Отладка: тест производительности».      */
  /*                                                                       */
  /* Консоли на телевизоре нет, и серии фото HUD (src/69_hud.js) читались  */
  /* гаданием: какой режим стоял и что в этот момент делал экран. Тест сам */
  /* гоняет главную по восьми стадиям — покой и листание в «Лёгком» и в    */
  /* «Полном», по одному тяжёлому эффекту за раз — и в конце рисует ОДНУ   */
  /* таблицу во весь экран: её фото отвечает на вопрос «что именно стоит    */
  /* кадров на этом телевизоре».                                           */
  /*                                                                       */
  /* Стадия — 1 с прогрева и 5 с замера. Кадры считает свой rAF-цикл        */
  /* (только в окне замера): fps, p50/p95 дельты, пропуски «−1» (дельта     */
  /* > 1,5·P) и «−2+» (> 2,5·P), где P — обычный интервал кадра, медиана   */
  /* первой стадии; lat95 — p95 задержки колбэка rAF; долгие кадры          */
  /* (PerformanceObserver 'long-animation-frame') — число и сумма           */
  /* blockingDuration, у худшего — хост скрипта; число анимаций документа   */
  /* (getAnimations) и средняя цена кадра частиц (LC.fx.stats). Раунд       */
  /* «Листание»: вторая таблица — самый длинный кадр каждой стадии по       */
  /* фазам LoAF (partsOf: js, r+ev, st+l, frc, other, главный скрипт).      */
  /* Сам цикл замера (rAF на каждом кадре) — не бесплатный: по трейсу при   */
  /* CPU ×10 он добавляет 40–70 мс на шаг листания, и сравнивать цифры      */
  /* стадий можно между собой и между прогонами, а не с «голой» главной.    */
  /*                                                                       */
  /* Настройки подменяются ТОЛЬКО в памяти (LC.prefs.override, первая      */
  /* строка LC.pref), в Storage не пишется ничего. На время теста молчит    */
  /* автодетект (LC.perf.hold), трейлер выключен подменой, смена кадров     */
  /* героя стоит (кадры меняет сам тест). Прерывание — любая клавиша, уход  */
  /* страницы в фон, смена активности или контроллера, ошибка — и конец     */
  /* теста проходят ОДНУ уборку (finish): подмены сняты, режим применён     */
  /* заново, частицы и цвет подкраски — прежние, фокус — на исходной        */
  /* карточке, набранные строки показаны.                                  */
  /* -------------------------------------------------------------------- */

  LC.bench = (function () {

    /* Сколько ждать закрытия настроек, прежде чем проверять условия. */
    var LEAVE_MS = 600;
    var WARM_MS = 1000;
    var MEASURE_MS = 5000;
    /* Кроссфейд кадра героя — раз в 1,5 с (переход .4 с, src/30_css.js). */
    var FLIP_MS = 1500;
    /* Переход подкраски — раз в 2 с (путь 1,6 с, src/57_color.js). */
    var TINT_MS = 2000;
    /* Листание: 6 шагов вправо и столько же обратно, шаг 400 мс. */
    var MOVE_MS = 400;
    var MOVES = 6;
    /* Как часто спрашивать getAnimations() в окне замера. */
    var ANIM_MS = 500;
    /* Сколько раз поднимать фокус к первому ряду до старта. */
    var UP_TRIES = 6;

    /* Экран таблицы: моноширинный кегль FONT_PX, символ — CHAR_EM кегля,
       строка — LINE_EM кегля, поля PAD_PX. MAX_COLS — сколько символов
       строки влезает в 960 CSS px (ширина окна телевизора при DPR 2),
       MAX_LINES — сколько строк в 540 (раунд «Листание»: вторая таблица
       обязана поместиться на тот же экран, фото одно). */
    var FONT_PX = 15;
    var CHAR_EM = 0.6;
    var LINE_EM = 1.45;
    var PAD_PX = 24;
    var SCREEN_W = 960;
    var SCREEN_H = 540;
    var MAX_COLS = Math.floor((SCREEN_W - 2 * PAD_PX) / (FONT_PX * CHAR_EM));
    var MAX_LINES = Math.floor((SCREEN_H - 2 * PAD_PX) / (FONT_PX * LINE_EM));

    /* Два цвета стадии «+tint»: тёплый и холодный — путь через
       приглушённый тон, как между соседними постерами. */
    var TINTS = [{ r: 168, g: 72, b: 56 }, { r: 56, g: 96, b: 168 }];

    var STAGES = [
      { id: 'lite idle', motion: 'lite' },
      { id: 'full idle', motion: 'full' },
      { id: '+fx', motion: 'full', heavy: true, fx: true },
      { id: '+frames', motion: 'full', heavy: true, fx: true, flip: true },
      { id: '+tint', motion: 'full', heavy: true, fx: true, flip: true, tint: true },
      { id: 'lite scroll', motion: 'lite', scroll: true },
      { id: 'full scroll', motion: 'full', heavy: true, scroll: true },
      { id: 'all', motion: 'full', heavy: true, fx: true, flip: true, tint: true, scroll: true }
    ];

    /* ------------------------------------------------------------------ */
    /* Чистая часть                                                        */
    /* ------------------------------------------------------------------ */

    /* Подмены настроек стадии. Трейлер выключен везде (ролик — отдельная
       цена, и у каждого фильма своя); атмосферы по теме фильма — тоже:
       частицы стадий «+fx» и «all» ставятся пресетом принудительно, а в
       остальных их быть не должно, какой бы фильм ни стоял под фокусом. */
    function overridesFor(stage) {
      return {
        lumen_motion: stage.motion,
        lumen_fx_heavy: !!stage.heavy,
        lumen_fx: 'off',
        lumen_trailer: 'off',
        lumen_hero_media: 'frames',
        lumen_hero_trailer: false
      };
    }

    function num(a, b) { return a - b; }

    function r1(x) { return Math.round(x * 10) / 10; }

    /* Квантиль q по отсортированному списку (ближайший ранг). */
    function pct(sorted, q) {
      if (!sorted.length) return 0;
      var i = Math.ceil(q * sorted.length) - 1;
      return sorted[i < 0 ? 0 : (i >= sorted.length ? sorted.length - 1 : i)];
    }

    /* Обычный интервал кадра — медиана дельт. */
    function period(deltas) {
      if (!deltas.length) return 0;
      var d = deltas.slice().sort(num);
      return d[Math.floor(d.length / 2)];
    }

    function summarize(deltas, lats, P) {
      var d = deltas.slice().sort(num);
      var l = lats.slice().sort(num);
      var sum = 0;
      var miss1 = 0;
      var miss2 = 0;
      for (var i = 0; i < d.length; i++) {
        sum += d[i];
        if (P > 0 && d[i] > 2.5 * P) miss2++;
        else if (P > 0 && d[i] > 1.5 * P) miss1++;
      }
      return {
        frames: d.length, fps: sum > 0 ? r1(d.length * 1000 / sum) : 0,
        p50: r1(pct(d, 0.5)), p95: r1(pct(d, 0.95)), miss1: miss1, miss2: miss2,
        lat95: l.length ? r1(pct(l, 0.95)) : null
      };
    }

    function cut(text, max) {
      text = '' + text;
      return text.length > max ? text.slice(0, max - 1) + '…' : text;
    }

    function pad(text, width, left) {
      text = cut(text, width);
      while (text.length < width) text = left ? text + ' ' : ' ' + text;
      return text;
    }

    function hostOf(url) {
      var m = /^[a-z][a-z0-9+.-]*:\/\/([^\/?#]+)/i.exec(url || '');
      return m ? m[1] : '';
    }

    function na(v, fmt) {
      return v === null || typeof v === 'undefined' || v < 0 ? 'n/a' : (fmt ? fmt(v) : '' + v);
    }

    function fixed(v) { return (Math.round(v * 10) / 10).toFixed(1); }

    function fixed2(v) { return (Math.round(v * 100) / 100).toFixed(2); }

    /* Колонки таблицы: подпись, ширина, выравнивание влево. */
    var COLS = [['#', 2], ['stage', 13, true], ['fps', 6], ['p50', 7], ['p95', 8], ['-1', 6], ['-2+', 5],
      ['loaf n/ms', 12], ['lat95', 7], ['anim', 6], ['fx ms', 7]];

    function line(cells) {
      var out = '';
      for (var i = 0; i < COLS.length; i++) out += pad(cells[i], COLS[i][1], COLS[i][2]) + (i < COLS.length - 1 ? ' ' : '');
      return out.replace(/\s+$/, '');
    }

    /* Раунд «Листание»: вторая таблица — самый длинный кадр каждой стадии
       по фазам (partsOf ниже), мс. Скрипт — всё, что остаётся от строки. */
    var COLS2 = [['#', 2], ['max', 5], ['blk', 5], ['js', 5], ['r+ev', 5], ['st+l', 5], ['frc', 5], ['other', 6]];
    /* Колонке скрипта — всё, что осталось от MAX_COLS после чисел и пробелов
       между колонками (55 символов на экране 960). */
    var SCRIPT_W = MAX_COLS;
    for (var c2 = 0; c2 < COLS2.length; c2++) SCRIPT_W -= COLS2[c2][1] + 1;
    /* В JSON результата скрипт — длиннее, чем влезает в колонку. */
    var SCRIPT_MAX = 120;

    function line2(cells) {
      var out = '';
      for (var i = 0; i < cells.length; i++) {
        var last = i === cells.length - 1;
        out += (i < COLS2.length ? pad(cells[i], COLS2[i][1]) : pad(cells[i], SCRIPT_W, true)) + (last ? '' : ' ');
      }
      return out.replace(/\s+$/, '');
    }

    function topLine(row) {
      var tp = row.top;
      if (!tp) return line2(['' + row.n, '-']);
      return line2(['' + row.n, Math.round(tp.ms), Math.round(tp.block), Math.round(tp.js), Math.round(tp.rev),
        Math.round(tp.sl), Math.round(tp.forced), Math.round(tp.other), tp.script || '-']);
    }

    function rowLine(row) {
      return line([
        '' + row.n, row.id + (row.partial ? '*' : ''),
        row.frames ? fixed(row.fps) : '-', row.frames ? fixed(row.p50) : '-', row.frames ? fixed(row.p95) : '-',
        '' + row.miss1, '' + row.miss2,
        row.loafN === null || typeof row.loafN === 'undefined' ? 'n/a' : row.loafN + '/' + Math.round(row.loafMs),
        na(row.lat95, fixed), na(row.anim), na(row.fxMs, fixed2)
      ]);
    }

    function lang(key, fallback) {
      try {
        if (typeof LC.lang === 'function') {
          var s = LC.lang(key);
          if (s && s !== key) return s;
        }
      } catch (e) { }
      return fallback;
    }

    /* Строки экрана таблицы. Шапка — чем снято: мажор Chromium, железо,
       окно, P, время, версия плагина. Дальше — по строке на стадию
       (недомеренная — со звёздочкой); раунд «Листание»: вторая таблица —
       самый длинный кадр каждой стадии по фазам (partsOf), если браузер
       умеет LoAF; худший по блокировке кадр со скриптом, причина прерывания
       и подсказка «Назад» — одной строкой. Каждая — не длиннее MAX_COLS,
       всех — не больше MAX_LINES (22 на экране 960×540): пустой строки под
       шапкой ради второй таблицы больше нет. */
    function table(result) {
      var out = [];
      out.push(cut('cr ' + result.cr + ' · hw ' + result.hw + ' · ' + result.w + '×' + result.h + '@' + result.dpr +
        ' · P ' + fixed(result.P || 0) + ' · ' + result.time + ' · v' + result.version, MAX_COLS));
      out.push(line(COLS.map(function (c) { return c[0]; })));
      var worst = null;
      var loaf = false;
      for (var i = 0; i < result.rows.length; i++) {
        var row = result.rows[i];
        out.push(rowLine(row));
        if (row.worst && (!worst || row.worst.ms > worst.ms)) worst = { ms: row.worst.ms, host: row.worst.host, n: row.n, id: row.id };
        if (row.loafN !== null && typeof row.loafN !== 'undefined') loaf = true;
      }
      out.push('');
      if (loaf) {
        out.push(line2(['#', 'max', 'blk', 'js', 'r+ev', 'st+l', 'frc', 'other', 'script']));
        for (var j = 0; j < result.rows.length; j++) out.push(topLine(result.rows[j]));
      }
      if (worst) {
        out.push(cut('loaf max: #' + worst.n + ' ' + worst.id + ' · ' + Math.round(worst.ms) + ' ms · ' + (worst.host || 'n/a'), MAX_COLS));
      }
      var back = lang('lumen_bench_back', 'Back — close');
      if (result.reason && result.reason !== 'done') {
        back = lang('lumen_bench_stopped', 'stopped') + ': ' + result.reason + ' · ' + result.stoppedAt + '/' + STAGES.length + ' · ' + back;
      }
      out.push(cut(back, MAX_COLS));
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      try { return setTimeout(fn, ms); } catch (e) { return 0; }
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      try { clearTimeout(id); } catch (e) { }
    }

    function raf(fn) {
      try { if (window.requestAnimationFrame) return window.requestAnimationFrame(fn); } catch (e) { }
      return 0;
    }

    function unraf(id) {
      try { if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id); } catch (e) { }
    }

    function perfNow() {
      try {
        if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
      } catch (e) { }
      return -1;
    }

    function lampa() {
      try { return window.Lampa || null; } catch (e) { return null; }
    }

    function log(text) {
      if (typeof api._log === 'function') { api._log(text); return; }
      try { if (typeof console !== 'undefined' && console.log) console.log(text); } catch (e) { }
    }

    function safe(fn) {
      try { fn(); } catch (e) { warn('bench: cleanup step failed', e); }
    }

    function hero() { return LC.hero || null; }

    /* Ряды главной ведёт СВОЙ контроллер Lampa 'items_line' (каждый ряд
       переключает его заново), сетки и наши экраны — 'content'; так же
       считает src/64_nav.js (onCards). Живая проверка 2026-09-24: после
       закрытия настроек Controller.enabled().name на главной —
       'items_line'. */
    function onRows(name) {
      return name === 'content' || name === 'items_line';
    }

    function heroCompact() {
      try { return !!(hero() && hero().compact()); } catch (e) { return false; }
    }

    function heroFocused() {
      try { return hero() ? hero().focused() : null; } catch (e) { return null; }
    }

    /* Почему тест сейчас не может идти: '' — может. Герой главной на
       экране (не запаркован под карточкой), страница видима, поверх
       главной ничего — ни настроек, ни списка выбора, ни плеера, ни поиска
       (тот же набор, что закрывает Controller.toContent у Lampa). */
    function blocked() {
      try {
        var h = hero();
        if (!h || !h.active() || h.parked()) return 'home';
        if (document.hidden) return 'hidden';
        var cls = document.body.classList;
        if (cls && (cls.contains('settings--open') || cls.contains('selectbox--open') || cls.contains('menu--open'))) return 'overlay';
        if (document.querySelector('.modal,.youtube-player,.player,.search-box,.search')) return 'overlay';
      } catch (e) {
        return 'error';
      }
      return '';
    }

    function animCount() {
      try {
        if (typeof document.getAnimations === 'function') return document.getAnimations().length;
      } catch (e) { }
      return -1;
    }

    function fxStats() {
      try { if (LC.fx && typeof LC.fx.stats === 'function') return LC.fx.stats(); } catch (e) { }
      return null;
    }

    /* Средняя цена кадра частиц за окно — из двух снимков накопленной
       статистики LC.fx (там только среднее и число кадров с запуска). */
    function fxAvg(from, to) {
      if (!from || !to) return null;
      var frames = to.frames - from.frames;
      if (!(frames > 0)) return null;
      return (to.avgMs * to.frames - from.avgMs * from.frames) / frames;
    }

    /* Самый долгий скрипт долгого кадра: хост адреса (или «inline» у
       скрипта без адреса — так выглядит сам плагин, вставленный в
       страницу) и вызвавший его (invoker). */
    function scriptOf(entry) {
      var list = entry && entry.scripts;
      var best = null;
      for (var i = 0; list && i < list.length; i++) {
        if (!best || Number(list[i].duration) > Number(best.duration)) best = list[i];
      }
      if (!best) return '';
      return cut((hostOf(best.sourceURL) || 'inline') + (best.invoker ? ' ' + best.invoker : ''), 48);
    }

    /* Раунд «Листание» (трейс 2026-09-25, п.5 исследования): «n/a» в
       подвале — у худшего кадра нет скрипта дольше 5 мс — не говорил, ЧЕМ
       занят кадр. Фазы записи LoAF (мс):
         js    — скрипты задачи, начавшиеся до renderStart;
         rev   — renderStart → styleAndLayoutStart: колбэки rAF и события
                 анимаций (сюда попадает transitionend Lampa — конец
                 прокрутки ряда, Layer.visible/frameVisible);
         sl    — styleAndLayoutStart → конец кадра: стиль, раскладка,
                 отрисовка;
         forced — принудительные стиль и раскладка (сумма
                 forcedStyleAndLayoutDuration скриптов, внутри js/rev);
         other — остаток задачи без скриптов: сборка мусора,
                 декодирование, нативная работа, скрипты короче 5 мс;
         script — самый долгий скрипт: хост, функция@символ, вызвавший.
       Без renderStart (кадр без отрисовки) весь кадр — задача. */
    function partsOf(e) {
      var start = Number(e.startTime) || 0;
      var dur = Number(e.duration) || 0;
      var rs = Number(e.renderStart) || 0;
      var sls = Number(e.styleAndLayoutStart) || 0;
      var list = e.scripts || [];
      var js = 0;
      var forced = 0;
      var top = null;
      for (var i = 0; i < list.length; i++) {
        var d = Number(list[i].duration) || 0;
        forced += Number(list[i].forcedStyleAndLayoutDuration) || 0;
        if (!rs || Number(list[i].startTime) < rs) js += d;
        if (!top || d > Number(top.duration)) top = list[i];
      }
      var task = rs > 0 ? rs - start : dur;
      var other = task - js;
      var pos = top && Number(top.sourceCharPosition) >= 0 ? '' + top.sourceCharPosition : '';
      return {
        ms: dur, block: Number(e.blockingDuration) || 0, js: js, forced: forced,
        rev: rs > 0 && sls > 0 ? sls - rs : 0,
        sl: sls > 0 ? start + dur - sls : 0,
        other: other > 0 ? other : 0,
        script: top ? cut((hostOf(top.sourceURL) || 'inline') + ' ' + (top.sourceFunctionName || '') + '@' + pos +
          (top.invoker ? ' ' + top.invoker : ''), SCRIPT_MAX) : ''
      };
    }

    /* ------------------------------------------------------------------ */
    /* Прогон                                                              */
    /* ------------------------------------------------------------------ */

    var run = null;
    var pending = 0;
    var last = null;
    var screen = null;

    function later(r, ms, fn) {
      r.timers.push(setT(function () {
        if (run !== r) return;
        try { fn(); } catch (e) { warn('bench: stage failed', e); finish('error'); }
      }, ms));
    }

    function every(r, ms, fn) {
      later(r, ms, function tick() {
        fn();
        later(r, ms, tick);
      });
    }

    function clearStage(r) {
      for (var i = 0; i < r.timers.length; i++) clearT(r.timers[i]);
      r.timers = [];
    }

    function frame(t) {
      var r = run;
      if (!r) return;
      var n = perfNow();
      if (r.phase === 'measure') {
        if (r.prevT) r.deltas.push(t - r.prevT);
        if (n >= 0) r.lats.push(n - t > 0 ? n - t : 0);
      }
      r.prevT = t;
      r.raf = raf(frame);
    }

    function onLoaf(list) {
      var r = run;
      if (!r || r.phase !== 'measure') return;
      var entries = list.getEntries();
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (r.measureFrom >= 0 && e.startTime < r.measureFrom) continue;
        var ms = Number(e.blockingDuration) || 0;
        r.loaf.n++;
        r.loaf.ms += ms;
        /* Кадр без блокировки (0 мс — долгий из-за отрисовки) худшим не
           считается: его скрипта в подвале искать нечего. */
        if (ms > 0 && (!r.loaf.worst || ms > r.loaf.worst.ms)) r.loaf.worst = { ms: ms, host: scriptOf(e) };
        /* Раунд «Листание»: для фаз — самый длинный кадр (duration: сколько
           он держал экран), а не самый блокирующий. */
        if (!r.loaf.top || (Number(e.duration) || 0) > r.loaf.top.ms) r.loaf.top = partsOf(e);
      }
    }

    function observeLoaf() {
      try {
        var PO = window.PerformanceObserver;
        if (!PO || !PO.supportedEntryTypes || PO.supportedEntryTypes.indexOf('long-animation-frame') === -1) return null;
        var obs = new PO(onLoaf);
        obs.observe({ type: 'long-animation-frame' });
        return obs;
      } catch (e) { }
      return null;
    }

    function listen(r) {
      var L = lampa();
      r.onKey = function (e) {
        try {
          if (e && e.stopPropagation) e.stopPropagation();
          if (e && e.preventDefault) e.preventDefault();
        } catch (x) { }
        finish('key');
      };
      r.onVis = function () { if (document.hidden) finish('hidden'); };
      r.onAct = function (e) { if (e && e.type === 'start') finish('activity'); };
      r.onToggle = function (e) { if (e && !onRows(e.name)) finish('toggle'); };
      try { window.addEventListener('keydown', r.onKey, true); } catch (e1) { }
      try { document.addEventListener('visibilitychange', r.onVis); } catch (e2) { }
      try { if (L && L.Listener) L.Listener.follow('activity', r.onAct); } catch (e3) { }
      try { if (L && L.Controller && L.Controller.listener) L.Controller.listener.follow('toggle', r.onToggle); } catch (e4) { }
    }

    function unlisten(r) {
      var L = lampa();
      try { window.removeEventListener('keydown', r.onKey, true); } catch (e1) { }
      try { document.removeEventListener('visibilitychange', r.onVis); } catch (e2) { }
      try { if (L && L.Listener) L.Listener.remove('activity', r.onAct); } catch (e3) { }
      try { if (L && L.Controller && L.Controller.listener) L.Controller.listener.remove('toggle', r.onToggle); } catch (e4) { }
    }

    /* Метка прогона в углу: какая стадия и что любая кнопка его прервёт.
       Текст меняется раз в стадию. */
    function tag(r) {
      try {
        var n = document.createElement('div');
        n.className = 'lumen-bench-tag';
        n.style.cssText = 'position:fixed;top:8px;right:12px;z-index:10000;padding:4px 8px;background:rgba(0,0,0,.7);' +
          'color:#EDE6DA;font:13px/1.3 monospace;pointer-events:none';
        document.body.appendChild(n);
        r.tag = n;
      } catch (e) { }
    }

    function tagText(r) {
      try {
        if (r.tag) r.tag.textContent = (r.step + 1) + '/' + STAGES.length + ' ' + STAGES[r.step].id + ' · ' + lang('lumen_bench_running', 'test · any key stops');
      } catch (e) { }
    }

    /* Режим и эффекты по свежим подменам — те же вызовы, что у ветки
       lumen_motion в applyPrefChange (src/80_settings.js). */
    function apply() {
      if (typeof LC.applyMotionMode === 'function') LC.applyMotionMode();
      if (hero()) hero().applyMotion();
      if (LC.accent && LC.accent.repaint) LC.accent.repaint();
    }

    function next(r) {
      clearStage(r);
      r.step++;
      if (r.step >= STAGES.length) { finish('done'); return; }
      if (blocked()) { finish('activity'); return; }
      var st = STAGES[r.step];
      r.phase = 'warm';
      r.deltas = [];
      r.lats = [];
      r.loaf = { n: 0, ms: 0, worst: null, top: null };
      r.anim = -1;
      r.fx0 = null;
      r.measureFrom = -1;
      LC.prefs.override(overridesFor(st));
      apply();
      /* Ревью ba6a3ac..6a1c364 (~60): праздничные темы рисуют сцены
         (winter/halloween — спрайты свечения, src/52_fx.js), и мерить надо
         их, а не прежний движок snow. */
      hero().benchFx(st.fx ? 'winter' : null);
      tagText(r);
      if (st.flip) every(r, FLIP_MS, function () { hero().benchFlip(); });
      if (st.tint) {
        var k = 0;
        every(r, TINT_MS, function () { LC.accent.drive(TINTS[k++ % TINTS.length]); });
      }
      later(r, WARM_MS, function () { measure(r, st); });
      later(r, WARM_MS + MEASURE_MS, function () {
        r.rows.push(rowOf(r, false));
        next(r);
      });
    }

    function measure(r, st) {
      r.phase = 'measure';
      r.prevT = 0;
      r.measureFrom = perfNow();
      r.fx0 = fxStats();
      r.anim = animCount();
      every(r, ANIM_MS, function () {
        var n = animCount();
        if (n > r.anim) r.anim = n;
      });
      if (st.scroll) scroll(r);
    }

    /* Шесть шагов вправо и ровно столько же обратно, сколько вправо
       получилось: в коротком ряду лишний шаг влево из первой карточки
       открыл бы меню Lampa. */
    function scroll(r) {
      var L = lampa();
      var rights = 0;
      var k = 0;
      function step() {
        if (k < MOVES) {
          var before = heroFocused();
          L.Controller.move('right');
          if (heroFocused() !== before) rights++;
        } else if (rights > 0) {
          L.Controller.move('left');
          rights--;
        } else {
          return;
        }
        k++;
        later(r, MOVE_MS, step);
      }
      step();
    }

    function rowOf(r, partial) {
      var st = STAGES[r.step];
      /* P — обычный интервал кадра устройства: медиана первой стадии с
         достаточным числом кадров («Лёгкий» в покое — ровнее некуда). */
      if (!r.P && r.deltas.length >= 10) r.P = period(r.deltas);
      var s = summarize(r.deltas, r.lats, r.P || period(r.deltas));
      return {
        n: r.step + 1, id: st.id, partial: !!partial, frames: s.frames, fps: s.fps, p50: s.p50, p95: s.p95,
        miss1: s.miss1, miss2: s.miss2, lat95: s.lat95,
        loafN: r.obs ? r.loaf.n : null, loafMs: r.obs ? r.loaf.ms : 0, worst: r.loaf.worst, top: r.loaf.top,
        anim: r.anim, fxMs: fxAvg(r.fx0, fxStats())
      };
    }

    function pad2(n) { return n < 10 ? '0' + n : '' + n; }

    function resultOf(r, reason) {
      var hud = LC.hud || {};
      var d = new Date();
      var dpr = 1;
      try { dpr = Math.round((window.devicePixelRatio || 1) * 100) / 100; } catch (e) { }
      return {
        version: LC.VERSION || '', cr: typeof hud.chrome === 'function' ? hud.chrome() : 'n/a',
        hw: typeof hud.hardware === 'function' ? hud.hardware() : 'n/a',
        w: window.innerWidth, h: window.innerHeight, dpr: dpr, P: r1(r.P || 0),
        time: pad2(d.getHours()) + ':' + pad2(d.getMinutes()),
        reason: reason, stoppedAt: Math.min(r.step + 1, STAGES.length), rows: r.rows
      };
    }

    /* Вернуть фокус на карточку, с которой начинали (листание вернуло бы
       его само, но прерывание может застать ряд посреди шага). Только если
       Lampa всё ещё в рядах: прерывание сменой контроллера уже увело фокус
       туда, куда просил пользователь. */
    function refocus(r) {
      var el = r.startEl;
      if (!el || heroFocused() === el) return;
      var L = lampa();
      if (!L || !L.Controller) return;
      var on = L.Controller.enabled ? L.Controller.enabled() : null;
      if (on && on.name && !onRows(on.name)) return;
      L.Controller.collectionFocus(el, el.parentNode || document.body);
    }

    /* ЕДИНСТВЕННЫЙ выход из прогона — и для конца, и для любого
       прерывания. Каждый шаг уборки — в своём try: упавший шаг не имеет
       права оставить за собой подмены или частицы. */
    function finish(reason) {
      var r = run;
      if (!r) return;
      if (reason !== 'done' && r.phase === 'measure') {
        try { r.rows.push(rowOf(r, true)); } catch (e) { }
      }
      run = null;
      clearStage(r);
      unraf(r.raf);
      try { if (r.obs) r.obs.disconnect(); } catch (e1) { }
      unlisten(r);
      try { if (r.tag && r.tag.parentNode) r.tag.parentNode.removeChild(r.tag); } catch (e2) { }
      safe(function () { LC.prefs.clearOverride(); });
      safe(function () { hero().benchFx(null); });
      safe(function () { hero().benchHold(false); });
      safe(function () { hero().benchRestore(); });
      safe(function () { LC.applyMotionMode(); });
      safe(function () { hero().applyMotion(); });
      safe(function () { hero().applyFx(); });
      safe(function () { LC.accent.drive(r.tintSaved, true); });
      safe(function () { LC.accent.repaint(); });
      safe(function () { LC.perf.hold(false); });
      safe(function () { refocus(r); });
      var result = resultOf(r, reason);
      last = result;
      safe(function () { log('[lumen-card] bench ' + JSON.stringify(result)); });
      safe(function () { show(result); });
    }

    /* Экран таблицы — поверх всего, до «Назад» (свой контроллер Lampa:
       кнопку «Назад» каждая платформа отдаёт Lampa по-своему, а
       контроллер получает её одинаково). Стиль инлайном: экран живёт
       минуту, и правилам в общей таблице плагина делать нечего. */
    function show(result) {
      close();
      var node = document.createElement('div');
      node.className = 'lumen-bench';
      node.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:10001;margin:0;padding:' + PAD_PX + 'px;' +
        'box-sizing:border-box;background:#0B0908;color:#EDE6DA;font:' + FONT_PX + 'px/' + LINE_EM + ' monospace;' +
        'white-space:pre;overflow:hidden';
      node.textContent = table(result).join('\n');
      node.onclick = close;
      document.body.appendChild(node);
      screen = node;
      var L = lampa();
      if (L && L.Controller) {
        var noop = function () { };
        L.Controller.add('lumen_bench', {
          toggle: function () { try { L.Controller.collectionSet(node); } catch (e) { } },
          back: close, up: noop, down: noop, left: noop, right: noop, enter: noop
        });
        L.Controller.toggle('lumen_bench');
      }
    }

    function close() {
      if (!screen) return;
      var node = screen;
      screen = null;
      try { if (node.parentNode) node.parentNode.removeChild(node); } catch (e) { }
      try { lampa().Controller.toggle('content'); } catch (e2) { }
    }

    function noty(text) {
      try {
        var L = lampa();
        if (L && L.Noty && typeof L.Noty.show === 'function') L.Noty.show(text);
      } catch (e) { }
    }

    function launch() {
      var L = lampa();
      /* Фокус в первом ряду: ниже кадр героя закрыт рядами, и «покой» мерил
         бы не главную, а её половину. */
      for (var i = 0; i < UP_TRIES && heroCompact() && !blocked(); i++) {
        try { L.Controller.move('up'); } catch (e) { break; }
      }
      if (blocked() || heroCompact()) {
        noty(lang('lumen_bench_need_home', 'Lumen Card: open the home screen and start the test again'));
        return;
      }
      var r = {
        step: -1, rows: [], P: 0, timers: [], raf: 0, phase: 'idle', prevT: 0, deltas: [], lats: [],
        loaf: { n: 0, ms: 0, worst: null, top: null }, anim: -1, fx0: null, measureFrom: -1, obs: null,
        startEl: heroFocused(), tintSaved: null, tag: null
      };
      run = r;
      try {
        LC.perf.hold(true);
        hero().benchHold(true);
        r.tintSaved = LC.accent && LC.accent.target ? LC.accent.target() : null;
        r.obs = observeLoaf();
        listen(r);
        tag(r);
        r.raf = raf(frame);
        next(r);
      } catch (e) {
        warn('bench: start failed', e);
        finish('error');
      }
    }

    /* Точка входа — кнопка в настройках (src/80_settings.js, onButtonFor).
       Нажатие приходит из раздела настроек, открытого поверх главной:
       сперва он закрывается (Controller.toContent — так Lampa сама
       закрывает всё, что поверх контента), и только потом, когда экран
       успокоился, проверяются условия и идёт первая стадия. */
    function start() {
      if (run || pending) return;
      pending = setT(function () {
        pending = 0;
        var L = lampa();
        try { if (L && L.Controller && L.Controller.toContent) L.Controller.toContent(); } catch (e) { }
        try { if (L && L.Controller) L.Controller.toggle('content'); } catch (e2) { }
        pending = setT(function () {
          pending = 0;
          launch();
        }, LEAVE_MS);
      }, 0);
    }

    var api = {
      STAGES: STAGES, MAX_COLS: MAX_COLS, MAX_LINES: MAX_LINES, FONT_PX: FONT_PX, CHAR_EM: CHAR_EM, LINE_EM: LINE_EM, PAD_PX: PAD_PX,
      overridesFor: overridesFor, summarize: summarize, period: period, table: table, partsOf: partsOf,
      start: start,
      /* Прервать из консоли — тот же путь, что у клавиши. */
      stop: function () { finish('stop'); },
      running: function () { return !!run; },
      /* Последний результат — тот же объект, что ушёл JSON в консоль. */
      last: function () { return last; },
      /* Хуки тестов: подменяемая пара таймеров и вывод в консоль. */
      _timers: null,
      _log: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.bench;

  /* -------------------------------------------------------------------- */
  /* Task 31 (фаза 4): HUD отладки на экране ТВ.                           */
  /*                                                                       */
  /* Без adb на телевизоре нет консоли, а LC.perf (src/68_perf.js) видно     */
  /* только один раз — уведомлением при понижении режима (notyOnce() там же); */
  /* текущий режим и частоту кадров посмотреть негде.                       */
  /* HUD рисует это живьём, в углу экрана: FPS, число долгих задач           */
  /* (PerformanceObserver 'longtask'), разрешение и devicePixelRatio, режим  */
  /* анимаций (LC.motionMode) и число полноэкранных слоёв плагина (герой,   */
  /* фон, атмосферы, заставка, переход, фон рулетки — ровно те классы, что   */
  /* ставят их модули) — раздельно на видимом экране и в скрытых под ним    */
  /* активностях истории. Назначение — калибровка порогов автодетекта       */
  /* (SLOW_MS/FAST_MS в LC.perf) на реальном железе пользователя, а не       */
  /* постоянная индикация: пункт «Отладка: показать FPS» стоит сразу под     */
  /* режимом анимаций (81_prefs.js) и выключен по умолчанию.                 */
  /*                                                                       */
  /* Выключенная настройка не создаёт НИЧЕГО: ни узла в DOM, ни кадрового    */
  /* цикла requestAnimationFrame, ни PerformanceObserver — start() зовётся   */
  /* только из sync(), когда LC.pref('lumen_debug_hud', false) истинно.      */
  /* -------------------------------------------------------------------- */

  LC.hud = (function () {

    /* Состояние запущенного HUD. null — выключен (start() ничего не сделал
       или stop() уже прибрал). Одно на модуль: два узла разом не нужны. */
    var state = null; /* { node, frames, last, prev, longTotal, longSup, slots, at, raf, obs } */

    /* -------------------------------------------------------------------- */
    /* Task 68 (фаза 6): величины, которые читаются с ОДНОГО снимка.         */
    /*                                                                      */
    /* Десять фото HUD с телевизора (2026-09-21) пришлось читать серией,     */
    /* вычитая нарастающий long между снимками: по одному кадру нельзя было  */
    /* сказать, сколько длинных задач пришлось на текущий экран. Теперь      */
    /* строка несёт и «за последнее окно», и «всего», а рядом — гистограмма  */
    /* rAF-дельт за то же окно.                                             */
    /*                                                                      */
    /* Окно — кольцо из SLOTS интервалов обновления строки. Интервал         */
    /* закрывается в paint() по порогу elapsed >= 1000 (ниже), то есть окно  */
    /* накрывает пять последних интервалов, каждый не короче секунды, —      */
    /* «около пяти секунд», а не ровно 5000 мс: точную временную отсечку     */
    /* пришлось бы считать по startTime каждой записи, то есть хранить       */
    /* список записей вместо пяти чисел.                                    */
    /*                                                                      */
    /* Цена кольца — фиксированная: SLOTS объектов по пять чисел, заводятся  */
    /* один раз в start(), на закрытии интервала один из них переписывается  */
    /* новым. Ни одного массива переменной длины: HUD включают ровно там,    */
    /* где ловят просадки, и он не имеет права стоить кадров сам.            */
    /* -------------------------------------------------------------------- */
    var SLOTS = 5;

    function newSlot() { return { long: 0, b: [0, 0, 0, 0] }; }

    /* Корзины гистограммы: ≤16 / ≤33 / ≤50 / >50 мс — кадр в 60 fps, кадр в
       30 fps, кадр в 20 fps и всё, что хуже. Верхняя граница совпадает с
       порогом longtask (50 мс), поэтому четвёртая корзина и счётчик long
       описывают одно и то же событие с разных сторон: сколько раз это было
       видно на кадрах и сколько задач за этим стояло. */
    function bucket(ms) {
      if (ms <= 16) return 0;
      if (ms <= 33) return 1;
      if (ms <= 50) return 2;
      return 3;
    }

    /* Суммы по кольцу — считаются раз в интервал, на отрисовке строки. */
    function totals() {
      var out = { long: 0, b: [0, 0, 0, 0] };
      for (var i = 0; i < state.slots.length; i++) {
        var slot = state.slots[i];
        out.long += slot.long;
        for (var j = 0; j < 4; j++) out.b[j] += slot.b[j];
      }
      return out;
    }

    /* «3/212» — за окно и всего. null — мерить нечем: в браузере нет
       PerformanceObserver или в supportedEntryTypes нет 'longtask'. Раньше
       в этом случае счётчик молча стоял на нуле и был неотличим от «длинных
       задач нет» — на телевизоре, где консоли нет, это тихая ложь.
       Тип 'long-animation-frame' не используется намеренно: он появился в
       Chromium 123 (ТЗ Task 68), а устройство пользователя — Chrome/77,
       и поле cr строки показывает этот мажор рядом. */
    function longText(l) {
      if (!l) return 'n/a';
      return l.win + '/' + l.total;
    }

    /* Task 60: состояние подкраски от постера — «tint <состояние> [цвет]
       [адрес]». Пользователь пришёл с «подкраска вообще не работает», и на
       телевизоре отличить причину было нечем: консоли там нет. Состояния
       считает LC.accent (src/57_color.js) по факту, а не по догадке — off
       (выключено настройкой, выключателем плагина или режимом движения),
       ok (с самим цветом), dim, cors, error, load, timer, idle. Адрес —
       тот, с которого читались пиксели, без протокола и без хвоста
       запроса: по нему на экране видно, ходил запрос через прокси
       пользователя или прямо в TMDB. */
    function tint(d) {
      var t = d.tint;
      if (!t || !t.state) return 'n/a';
      return t.state + (t.color ? ' ' + t.color : '') + (t.url ? ' ' + t.url : '');
    }

    /* Порядок полей: сначала то, что меняется каждый интервал (fps, длинные
       задачи, гистограмма, размер ряда серий), потом неизменное за сессию
       (разрешение, мажор браузера, режим, железо) и подкраска — её адрес
       длинный и уезжает в перенос строки последним.
       Ф2 п.3: «layers 5+9» — пять слоёв на видимом экране и девять в
       скрытых под ним активностях истории (layerCounts ниже). Форма одна
       и та же всегда, и «+0» тоже пишется: по одному снимку видно, что
       второе число есть и оно ноль, а не что поле пропало. */
    function format(d) {
      return d.fps + ' fps · long ' + longText(d.long) + ' · raf ' + d.raf.join('/') +
        ' · eps ' + d.eps + ' · layers ' + d.layers + '+' + (d.hid || 0) +
        ' · ' + d.w + '×' + d.h + '@' + d.dpr + ' · cr ' + d.cr + ' · ' + d.mode +
        ' · hw ' + d.hw + ' · tint ' + tint(d);
    }

    /* Модуля подкраски может не быть (в тестах 69_hud.js грузится один), и
       его status() ходит в настройки — исключение оттуда не имеет права
       гасить весь HUD. */
    function accentStatus() {
      try {
        if (LC.accent && typeof LC.accent.status === 'function') return LC.accent.status();
      } catch (e) { }
      return null;
    }

    /* Ревью Task 40 (п.6): железо строкой «ядра/память». По этим числам
       LC.perf.weakHardware понижает режим до lite ещё до замеров, и решение
       это необратимо для сессии — значит их надо видеть на самом
       телевизоре, а не полагаться на спецификацию (в Android WebView
       hardwareConcurrency на части прошивок отражает не физические ядра).
       navigator.deviceMemory есть только в Chromium — где его нет (а на
       телевизоре пользователя его нет: все десять снимков 2026-09-21 дали
       «4c/?»), пишем «n/a», тем же словом, что у long: браузер величину не
       сообщил. Task 68: прежний «?» читался как «поле сломалось».
       Пример строки: «hw 4c/2gb», «hw 4c/n/a». */
    function hardware() {
      var cores = 'n/a';
      var mem = 'n/a';
      try {
        var nav = window.navigator;
        if (nav) {
          if (Number(nav.hardwareConcurrency) > 0) cores = Math.round(Number(nav.hardwareConcurrency)) + 'c';
          if (typeof nav.deviceMemory !== 'undefined' && nav.deviceMemory !== null && Number(nav.deviceMemory) > 0) {
            mem = Number(nav.deviceMemory) + 'gb';
          }
        }
      } catch (e) { }
      return cores + '/' + mem;
    }

    /* Task 68: мажор Chromium одним числом — «cr 77». Целиком userAgent в
       строку не влезает, а мажор отвечает на главный вопрос при чтении
       снимка: какие API на устройстве вообще есть. WebView Android TV
       представляется и как Chrome, и как Chromium — берём оба бренда. */
    function chrome() {
      try {
        var nav = window.navigator;
        var m = nav && nav.userAgent ? ('' + nav.userAgent).match(/Chrom(?:e|ium)\/(\d+)/) : null;
        if (m) return m[1];
      } catch (e) { }
      return 'n/a';
    }

    /* Полноэкранные РИСУЮЩИЕ слои плагина — контейнеры-обёртки, которые сами
       ничего не рисуют (.lumen-backdrop, .lumen-overlay), в список не идут.
       Проверено grep'ом по src/: .lumen-hero__bg, .lumen-hero__lqip
       (подложка LQIP, Task 64), .lumen-hero__veil (в DOM
       "lumen-hero__veil lumen-hero__veil--l"; нижней вуали с Task 64 нет —
       её заменила маска самих слоёв кадра, отдельного узла у неё не
       осталось) и .lumen-hero__trailer — src/48_hero.js; .lumen-fx — и в
       кадре героя (48_hero.js), и на фоне карточки (src/50_backdrops.js);
       .lumen-backdrop__img, .lumen-backdrop__veil (базовый класс трёх вуалей
       --l/--b/--t) и кадры слайдшоу .lumen-bg__img — src/50_backdrops.js/
       src/51_slideshow.js; .lumen-ambient (сам красит фон и анимируется) и
       .lumen-ambient__img — src/54_ambient.js; .lumen-overlay__img —
       src/67_transition.js; .lumen-roulette__bg — src/56_roulette.js.
       Долг фазы 4 (docs/plans/2026-09-18-lumen-phase4-tv.md:919): два
       ПОСТОЯННЫХ принудительных слоя Task 46 — корень героя .lumen-hero и
       область рядов главной (.lumen-main .scroll.layer--wheight), оба с
       translateZ(0) (src/30_css.js, разбор цены там же: ≈ 8 МБ каждый) —
       в счёт не шли, потому что это контейнеры, а не рисующие узлы. Но
       свой буфер у них есть: всё, что внутри без собственного слоя
       (текст героя, карточки рядов), рисуется в него. Без них цифра в HUD
       была занижена на 2. */
    var FULL = '.lumen-hero__bg,.lumen-hero__lqip,.lumen-hero__veil,.lumen-hero__trailer,.lumen-fx,' +
      '.lumen-backdrop__img,.lumen-backdrop__veil,.lumen-backdrop .lumen-bg__img,' +
      '.lumen-ambient,.lumen-ambient__img,.lumen-overlay__img,.lumen-roulette__bg,' +
      '.lumen-hero,.lumen-main .scroll.layer--wheight';

    /* Ревью фикс-раунда, Ф2 п.3: счёт по всему документу завышал цифру на
       экране карточки примерно на 9. Lampa держит в DOM активности истории
       (скрытые прозрачностью, .activity{opacity:0}), а с правки 2026-09-23
       герой уходящей главной паркуется, а не снимается (park в
       src/48_hero.js): под карточкой остаются его узлы и область рядов.
       Слои делятся по тому же правилу «на экране», что у всего плагина
       (LC.util.onScreen, src/10_util.js): on — показанная активность и узлы
       вне всякой активности (слой перехода, заставка); off — активности
       истории. Скрытые слои не рисуются, но их буферы и растры живут в
       памяти, поэтому второе число не выбрасывается, а показывается рядом.
       Один проход querySelectorAll на оба числа — раз в интервал строки. */
    function layerCounts() {
      var out = { on: 0, off: 0 };
      try {
        var list = document.querySelectorAll(FULL);
        for (var i = 0; i < list.length; i++) {
          if (LC.util.onScreen(list[i])) out.on++;
          else out.off++;
        }
      } catch (e) { }
      return out;
    }

    function layers() {
      return layerCounts().on;
    }

    /* Task 68: сколько плиток серий сейчас в ряду АКТИВНОЙ карточки. Узел
       плитки создаётся одной строкой — $('<div class="lumen-episode
       selector"></div>') (src/85_header.js:683), поэтому счёт идёт по
       классу; на главной карточки нет — поле ноль.
       Скоуп .activity--active обязателен: Lampa держит предыдущие
       активности смонтированными и переносит класс на текущую
       (vendor/lampa/app.min.js:46024-46026 — снимает его с прошлого слайда
       и вешает на render() новой активности). Без скоупа счёт складывал бы
       ряды двух карточек: замер на стенде 960×540@2 — переход с карточки
       «Дюна» на «Дораэмон» дал 50 плиток вместо 25.
       После Task 67 ряд строится окном вокруг фокуса, и это ключевая
       величина: раньше число плиток на устройстве было неизвестно вовсе
       (на стенде «Дораэмон» давал 132 плитки до Task 67). */
    function eps() {
      try { return document.querySelectorAll(LC.util.ON_SCREEN_SEL + ' .lumen-episode').length; } catch (e) { return 0; }
    }

    /* window.requestAnimationFrame/cancelAnimationFrame — через window., как
       в LC.perf (src/68_perf.js, raf/unraf): и в браузере ТВ, и в тестовом
       окружении window подменяется целиком, а глобальный
       requestAnimationFrame там не заведён. */
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

    /* state.last обязан жить в ТОЙ ЖЕ шкале, что и t (DOMHighResTimeStamp
       rAF, отсчитываемый от старта документа, обычно единицы-десятки тысяч
       мс) — раньше его заводили через performance.now()/Date.now() отдельно
       от paint(), и на устройстве без window.performance (fallback на
       Date.now(), ≈1.7e12) шкалы расходились на порядки: t - state.last
       навсегда оставалось глубоко отрицательным, порог 1000 не наступал
       никогда, и HUD молча не обновлялся вовсе. Первый кадр цикла поэтому
       сам становится опорной точкой (state.last ещё 0 — падший, а не
       настоящий момент времени) и в счётчик кадров не идёт. */
    function paint(t) {
      if (!state) return;
      if (!state.last) {
        state.last = t;
        /* state.prev — время предыдущего кадра, опора гистограммы дельт.
           Заводится здесь же, из той же шкалы, что state.last. */
        state.prev = t;
        state.raf = raf(paint);
        return;
      }
      state.frames++;
      /* Дельта кадра идёт в интервал, который сейчас набирается: кадр,
         закрывающий интервал, попадает в него же, а не в следующий.
         На стенде (локальная Lampa в фоновой вкладке) rAF не тикает вовсе,
         поэтому paint() там не вызывается и строка не обновляется — это
         ограничение стенда, а не кода: на устройстве rAF тикает, иначе
         серии фото с меняющимся fps не получилось бы. */
      state.slots[state.at].b[bucket(t - state.prev)]++;
      state.prev = t;
      var elapsed = t - state.last;
      if (elapsed >= 1000) {
        var mode = 'n/a';
        try { mode = LC.motionMode(); } catch (e) { }
        /* fps — кадры В СЕКУНДУ, а не «кадры за истёкшее окно»: окно редко
           ровно 1000мс (следующий rAF приходит уже ПОСЛЕ порога), и при
           долгой задаче может растянуться до 1300+ мс — то самое искажение,
           ради обнаружения которого HUD и нужен, иначе занизилось бы вдвое
           реже, чем должно, и осталось незамеченным. */
        var sums = totals();
        var lay = layerCounts();
        state.node.textContent = format({
          fps: Math.round(state.frames * 1000 / elapsed), w: window.innerWidth, h: window.innerHeight,
          dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
          cr: chrome(), mode: mode,
          long: state.longSup ? { win: sums.long, total: state.longTotal } : null,
          raf: sums.b, eps: eps(), layers: lay.on, hid: lay.off, hw: hardware(), tint: accentStatus()
        });
        state.frames = 0; state.last = t;
        /* Интервал закрыт — кольцо проворачивается, и следующий пишется в
           самый старый слот. Окно из SLOTS интервалов уезжает вместе с ним,
           а state.longTotal продолжает расти с момента включения HUD. */
        state.at = (state.at + 1) % SLOTS;
        state.slots[state.at] = newSlot();
      }
      state.raf = raf(paint);
    }

    function start() {
      if (state) return;
      var node = document.createElement('div');
      node.className = 'lumen-hud';
      document.body.appendChild(node);
      var slots = [];
      for (var i = 0; i < SLOTS; i++) slots.push(newSlot());
      state = { node: node, frames: 0, last: 0, prev: 0, longTotal: 0, longSup: false,
        slots: slots, at: 0, raf: 0, obs: null };
      /* window.PerformanceObserver — не голый PerformanceObserver: тот же
         повод, что у raf/unraf выше (окружение подменяет window целиком, а
         глобал — нет; в Node, например, PerformanceObserver — свой глобал
         из perf_hooks, никак не связанный с window). 'longtask' — не во
         всех WebView Android TV: подписываемся, только если тип реально в
         supportedEntryTypes, иначе observe() бросил бы исключение. */
      try {
        if (window.PerformanceObserver && window.PerformanceObserver.supportedEntryTypes &&
            window.PerformanceObserver.supportedEntryTypes.indexOf('longtask') > -1) {
          state.obs = new window.PerformanceObserver(function (list) {
            if (!state) return;
            var n = list.getEntries().length;
            state.longTotal += n;
            state.slots[state.at].long += n;
          });
          state.obs.observe({ entryTypes: ['longtask'] });
          /* Подписка состоялась — только теперь счётчику можно верить.
             Без этого флага ноль в строке означал бы сразу две разные вещи:
             «длинных задач не было» и «мерить нечем». */
          state.longSup = true;
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

    /* Точка входа для applyPrefChange (src/80_settings.js) и для активации
       плагина (src/90_runtime.js): читает настройку и приводит состояние в
       соответствие с ней. stop() наружу экспортирован отдельно — им
       пользуется деактивация плагина (90_runtime.js), которой применять
       настройку нечего, нужно только гарантированно снять HUD. Идемпотентна
       в обе стороны — start()/stop() сами ничего не делают, если состояние
       уже нужное. */
    function sync() {
      var on = false;
      try {
        /* Выключенный плагин снимает свой CSS целиком (LC.removeCss,
           90_runtime.js) — без него узел HUD оказался бы на экране
           нестилизованным div. LC.enabled() решает, разрешено ли вообще
           поднимать HUD; сама настройка lumen_debug_hud читается отдельно. */
        on = LC.pref('lumen_debug_hud', false) && LC.enabled();
      } catch (e) { on = false; }
      if (on) start(); else stop();
    }

    return {
      sync: sync, stop: stop, format: format, running: function () { return !!state; }, layers: layers,
      /* Ф2 п.3: оба числа — на экране и под ним — для теста и консоли. */
      layerCounts: layerCounts,
      /* Task 68: наружу — ради тестов и ради живой проверки со стенда
         (window.lumen_card.hud.eps() в консоли: число плиток ряда серий). */
      eps: eps, chrome: chrome,
      /* Ревью Task 40 (п.6): наружу ради теста и ради живой проверки с
         телевизора (window.lumen_card.hud.hardware() в консоли, если она
         есть) — по этим числам срабатывает LC.perf.weakHardware. */
      hardware: hardware
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hud;

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
    var state = null; /* { node, frames, last, prev, longTotal, longSup, loafSup, slots, at, raf, obs, loafObs, probe } */

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
    /* Цена кольца. Волна производительности (2026-09-24): корзины теперь   */
    /* считаются от медианы окна, а медиану по пяти счётчикам не собрать —   */
    /* слот хранит сами дельты кадров и задержки колбэка. Массивы слота       */
    /* заводятся один раз в start() и на закрытии интервала обнуляются по    */
    /* длине, а не создаются заново; сортировка — раз в интервал строки, по  */
    /* ~300 числам на 60 Гц. HUD включают ровно там, где ловят просадки, и   */
    /* он не имеет права стоить кадров сам.                                  */
    /* -------------------------------------------------------------------- */
    var SLOTS = 5;

    function newSlot() { return { long: 0, loaf: 0, loafMs: 0, d: [], lat: [] }; }

    function resetSlot(slot) {
      slot.long = 0; slot.loaf = 0; slot.loafMs = 0;
      slot.d.length = 0; slot.lat.length = 0;
    }

    function num(a, b) { return a - b; }

    function r1(x) { return Math.round(x * 10) / 10; }

    /* Значение квантиля q по отсортированному списку (ближайший ранг). */
    function pct(sorted, q) {
      if (!sorted.length) return 0;
      var i = Math.ceil(q * sorted.length) - 1;
      return sorted[i < 0 ? 0 : (i >= sorted.length ? sorted.length - 1 : i)];
    }

    /* Волна производительности: корзины — от медианы дельт окна P, а не от
       жёстких 16/33/50 мс. Жалоба с ТВ «всё ещё лагает всё» пришла с фото,
       на которых ровные кадры 60 Гц (дельта rAF гуляет 16,4–17,1 мс) почти
       поровну делились между первой и второй корзиной, — гистограмма
       рисовала просадку там, где её не было. ≤1,5·P — кадр вовремя, ≤2,5·P
       — пропущен один, ≤3,5·P — два, дальше — больше. P пишется в строку
       рядом: 16.7 — панель 60 Гц, 33.3 — устройство держит 30. */
    function bucket(ms, P) {
      if (!(P > 0) || ms <= 1.5 * P) return 0;
      if (ms <= 2.5 * P) return 1;
      if (ms <= 3.5 * P) return 2;
      return 3;
    }

    /* Чистая часть окна: дельты кадров и задержки колбэка rAF за окно →
       корзины, P, среднее fps (кадры на сумму дельт), p95 дельты и p95
       задержки. Наружу — ради теста. */
    function windowStats(deltas, lats) {
      var d = deltas.slice().sort(num);
      var l = lats.slice().sort(num);
      var P = d.length ? d[Math.floor(d.length / 2)] : 0;
      var raf = [0, 0, 0, 0];
      var sum = 0;
      for (var i = 0; i < d.length; i++) {
        sum += d[i];
        raf[bucket(d[i], P)]++;
      }
      return {
        raf: raf, P: r1(P), avg: sum > 0 ? Math.round(d.length * 1000 / sum) : 0,
        p95: r1(pct(d, 0.95)), lat95: l.length ? r1(pct(l, 0.95)) : null
      };
    }

    /* Суммы по кольцу — считаются раз в интервал, на отрисовке строки. */
    function totals() {
      var d = [];
      var lat = [];
      var out = { long: 0, loaf: 0, loafMs: 0 };
      for (var i = 0; i < state.slots.length; i++) {
        var slot = state.slots[i];
        out.long += slot.long;
        out.loaf += slot.loaf;
        out.loafMs += slot.loafMs;
        d.push.apply(d, slot.d);
        lat.push.apply(lat, slot.lat);
      }
      out.stats = windowStats(d, lat);
      return out;
    }

    /* «3/212» — за окно и всего. null — мерить нечем: в браузере нет
       PerformanceObserver или в supportedEntryTypes нет 'longtask'. Раньше
       в этом случае счётчик молча стоял на нуле и был неотличим от «длинных
       задач нет» — на телевизоре, где консоли нет, это тихая ложь. */
    function longText(l) {
      if (!l) return 'n/a';
      return l.win + '/' + l.total;
    }

    /* Волна производительности: «loaf 2/140» — долгие кадры анимации
       (PerformanceObserver 'long-animation-frame') за окно и сумма их
       blockingDuration в мс. Прежний комментарий здесь отказывался от этого
       типа, потому что считал телевизор Chrome/77, — фото HUD 2026-09-24
       показали «cr 153», а тип есть с Chromium 123. Он честнее longtask:
       меряет не отдельную задачу, а весь кадр, который опоздал, вместе с
       рендерингом. n/a — тип не поддержан. */
    function loafText(l) {
      if (!l) return 'n/a';
      return l.n + '/' + Math.round(l.ms);
    }

    function orNa(v) {
      return v === null || typeof v === 'undefined' ? 'n/a' : v;
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
       второе число есть и оно ноль, а не что поле пропало.
       Проверка на ТВ 2026-09-24: «tr <состояние>» — последний плеер
       трейлера (LC.trailer.status, src/55_trailer.js: plan, none, api,
       ready, play, end, stop, timeout api, timeout ready, err N). Стоит
       перед подкраской: у той длинный адрес, и она уезжает в перенос
       последней.
       Волна производительности: сразу за fps — среднее fps за окно (avg) и
       p95 дельты кадра в мс; у гистограммы — P, от которой считаны корзины;
       lat95 — p95 задержки колбэка rAF (performance.now() в колбэке минус
       метка кадра: сколько главный поток был занят, когда кадр начался);
       loaf — после long.
       Волна «Логотипы сразу»: «pf 2/5/17» — предзагрузка соседей героя
       (LC.prefetch.stats, src/58_prefetch.js): запросов в пути, задач в
       очереди, деталей героя из памяти. Стоит перед tr: тот короткий, а
       подкраска уезжает в перенос последней. */
    function format(d) {
      return d.fps + ' fps · avg ' + orNa(d.avg) + ' · p95 ' + orNa(d.p95) +
        ' · raf ' + d.raf.join('/') + ' P' + orNa(d.P) + ' · lat95 ' + orNa(d.lat95) +
        ' · long ' + longText(d.long) + ' · loaf ' + loafText(d.loaf) +
        ' · eps ' + d.eps + ' · layers ' + d.layers + '+' + (d.hid || 0) +
        ' · ' + d.w + '×' + d.h + '@' + d.dpr + ' · cr ' + d.cr + ' · ' + d.mode +
        ' · hw ' + d.hw + ' · pf ' + pfText(d.pf) + ' · tr ' + (d.tr || 'n/a') + ' · tint ' + tint(d);
    }

    function pfText(p) {
      if (!p) return 'n/a';
      return p.fly + '/' + p.queue + '/' + p.hits;
    }

    /* Модуля предзагрузки может не быть (в тестах 69_hud.js грузится один). */
    function prefetchStats() {
      try {
        if (LC.prefetch && typeof LC.prefetch.stats === 'function') return LC.prefetch.stats();
      } catch (e) { }
      return null;
    }

    /* Модуля трейлера может не быть (в тестах 69_hud.js грузится один). */
    function trailerStatus() {
      try {
        if (LC.trailer && typeof LC.trailer.status === 'function') return LC.trailer.status();
      } catch (e) { }
      return null;
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

    /* Task 68: мажор Chromium одним числом — «cr 153». Целиком userAgent в
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
       ничего не рисуют (.lumen-backdrop, .lumen-overlay, с волны 3 — слой
       кадра героя .lumen-hero-stage), в список не идут.
       Проверено grep'ом по src/: .lumen-hero__bg, .lumen-hero__lqip
       (подложка LQIP, Task 64), .lumen-hero__trailer и, с волны 3,
       затемнение кадра — .lumen-hero__scrim (в DOM два узла: сам scrim и
       "lumen-hero__scrim lumen-hero__scrim--l") и пол сжатого состояния
       .lumen-hero__floor (src/48_hero.js, buildStage; вуалей
       .lumen-hero__veil больше нет); .lumen-fx — и в
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
    var FULL = '.lumen-hero__bg,.lumen-hero__lqip,.lumen-hero__scrim,.lumen-hero__floor,.lumen-hero__trailer,.lumen-fx,' +
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

    /* Волна производительности: задержка колбэка rAF — performance.now() в
       момент вызова минус метка кадра t (обе — в шкале performance). -1 —
       мерить нечем (нет window.performance): Date.now() живёт в другой
       шкале, и разность с t была бы бессмыслицей. */
    function lateness(t) {
      try {
        if (window.performance && typeof window.performance.now === 'function') {
          var late = window.performance.now() - t;
          return late > 0 ? late : 0;
        }
      } catch (e) { }
      return -1;
    }

    /* Подписка PerformanceObserver на тип, если браузер его знает; иначе
       null — observe() на незнакомом типе бросил бы исключение. */
    function observe(type, onEntries) {
      try {
        var PO = window.PerformanceObserver;
        if (!PO || !PO.supportedEntryTypes || PO.supportedEntryTypes.indexOf(type) === -1) return null;
        var obs = new PO(function (list) {
          if (state) onEntries(list.getEntries());
        });
        if (type === 'longtask') obs.observe({ entryTypes: ['longtask'] });
        else obs.observe({ type: type });
        return obs;
      } catch (e) { }
      return null;
    }

    /* -------------------------------------------------------------------- */
    /* Телеметрия героя (исследование 2026-09-27 «без лагов и без ожидания», */
    /* план полосы preload, п.5.8). Жалоба с ТВ — «пока грузится логотип, на */
    /* месте названия пусто» и «серый фон вместо кадра при листании» — до    */
    /* сих пор читалась только с фото, без чисел. Зонд меряет это СНАРУЖИ    */
    /* героя (src/48_hero.js не знает о нём ничего):                         */
    /*   - hover:focus карточки — слушатель в захвате на корне экрана героя  */
    /*     (LC.focus.capture, те же события, что у самого героя);            */
    /*   - название — MutationObserver на .lumen-hero__title (текст) и на    */
    /*     .lumen-hero/.lumen-hero__logo (класс lumen-hero--logo и картинка  */
    /*     логотипа);                                                        */
    /*   - кадр — MutationObserver на слоях .lumen-hero__bg (класс is-active */
    /*     и src) и подложке .lumen-hero__lqip;                              */
    /*   - сеть — PerformanceObserver 'resource' (startTime записи) против   */
    /*     времён нажатий серии.                                             */
    /* Один и тот же зонд служит второй строке HUD и стадии 9 самотеста     */
    /* (src/69_bench.js). Создаётся только ими: выключенный HUD — ни одного  */
    /* слушателя и наблюдателя.                                             */
    /*                                                                      */
    /* Показ — фокус, дождавшийся СВОЕГО названия: карточка, с которой       */
    /* фокус ушёл раньше, в окно не идёт (её героя пользователь не ждал).    */
    /* Отсчёт — от последнего hover:focus на этой карточке. Окно — последние */
    /* HERO_WIN показов.                                                    */
    /*   T_title — до появления в герое её названия: текст, равный названию  */
    /*             карточки, или её логотип (путь из деталей этого фильма в  */
    /*             картинке .lumen-hero__logo при классе lumen-hero--logo);  */
    /*   T_frame — до слоя кадра is-active с картинкой ЭТОГО фильма (любой   */
    /*             его backdrop или постер — размытый вариант); подложка     */
    /*             LQIP кадром не считается. Показ, с которого фокус ушёл    */
    /*             раньше кадра, в T_frame не идёт — число в скобках          */
    /*             говорит, у скольких показов окна кадр дождались;          */
    /*   gray    — показ, у которого между выводом названия и кадром был     */
    /*             миг без единого активного слоя (оба кадра и подложка       */
    /*             погашены — нейтральный фон, holdFrame/neutralFrame);      */
    /*   pf h/m  — детали героя взяты из памяти предзагрузки или нет: между  */
    /*             фокусом и названием вырос счётчик LC.prefetch.stats().hits */
    /*             (своего промаха у stats() нет — промах = не вырос). Нет   */
    /*             модуля или счётчика — поле не пишется;                    */
    /*   net-in-burst — запросов картинок и API (записи resource), чей        */
    /*             startTime попал в [нажатие, +KEY_WIN] для нажатия СЕРИИ    */
    /*             (прошлое нажатие — меньше KEY_GAP назад, то же правило,   */
    /*             что у героя), за время окна показов; n/a — браузер не     */
    /*             отдаёт resource.                                         */
    /* -------------------------------------------------------------------- */
    var HERO_WIN = 20;
    /* Копия BURST_GAP из src/48_hero.js литералом: одно число, ради которого
       не стоит заводить зависимость между модулями. */
    var KEY_GAP = 700;
    var KEY_WIN = 120;
    /* Запись resource приходит, когда загрузка КОНЧИЛАСЬ, — картинка,
       начатая под нажатием, может доехать через секунды. Столько помним
       нажатия серии. */
    var KEY_KEEP = 60000;
    var KEY_MAX = 2000;
    /* Картинки (img, фон через css) и запросы API; скрипты, стили и прочее
       — не то, что конкурирует с листанием. */
    var NET_TYPES = { img: 1, image: 1, css: 1, xmlhttprequest: 1, 'fetch': 1, other: 1 };
    /* Стрелки пульта: OK и «Назад» в серию не входят (открытие карточки —
       законная сеть). */
    var ARROWS = { 37: 1, 38: 1, 39: 1, 40: 1 };

    function clock() {
      try {
        if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
      } catch (e) { }
      return Date.now();
    }

    function hasClass(el, name) {
      try { return !!(el && el.classList && el.classList.contains(name)); } catch (e) { return false; }
    }

    /* Путь картинки TMDB («/abc.jpg») встречается в адресе — прокси, размер
       и обёртка url("…") ему не мешают. */
    function hasPath(url, paths) {
      if (!url) return false;
      for (var i = 0; i < paths.length; i++) {
        if (paths[i] && typeof paths[i] === 'string' && url.indexOf(paths[i]) !== -1) return true;
      }
      return false;
    }

    function filePaths(list) {
      var out = [];
      for (var i = 0; list && i < list.length; i++) if (list[i]) out.push(list[i].file_path);
      return out;
    }

    function heroDetails(id) {
      try {
        if (LC.hero && typeof LC.hero.details === 'function') return LC.hero.details(id);
      } catch (e) { }
      return null;
    }

    function prefetchHits() {
      var s = prefetchStats();
      return s && typeof s.hits === 'number' ? s.hits : null;
    }

    /* Чистая часть окна показов — наружу ради теста. shows — записи
       {title, frame (-1 — не дождались), gray, hit (true/false/null)},
       net — число или null (n/a). */
    function heroStats(shows, net) {
      var title = [];
      var frame = [];
      var out = { n: shows.length, title: null, frame: null, frameN: 0, gray: 0, pf: false, hit: 0, miss: 0, net: net };
      for (var i = 0; i < shows.length; i++) {
        var s = shows[i];
        if (s.title >= 0) title.push(s.title);
        if (s.frame >= 0) frame.push(s.frame);
        if (s.gray) out.gray++;
        if (s.hit === true) { out.hit++; out.pf = true; } else if (s.hit === false) { out.miss++; out.pf = true; }
      }
      title.sort(num);
      frame.sort(num);
      if (title.length) out.title = [Math.round(pct(title, 0.5)), Math.round(pct(title, 0.95))];
      if (frame.length) out.frame = [Math.round(pct(frame, 0.5)), Math.round(pct(frame, 0.95))];
      out.frameN = frame.length;
      return out;
    }

    function pairText(p) {
      return p ? p[0] + '/' + p[1] : '-/-';
    }

    /* «hero 20: T_title 530/1130 · T_frame 820/2400 (14) · gray 3 ·
       pf h/m 12/8 · net-in-burst 0» — числа в мс, p50/p95. */
    function heroText(s) {
      return 'hero ' + s.n + ': T_title ' + pairText(s.title) + ' · T_frame ' + pairText(s.frame) + ' (' + s.frameN + ')' +
        ' · gray ' + s.gray + (s.pf ? ' · pf h/m ' + s.hit + '/' + s.miss : '') +
        ' · net-in-burst ' + (s.net === null || typeof s.net === 'undefined' ? 'n/a' : s.net);
    }

    /* Зонд. opts.keys — слушать стрелки пульта самому (HUD); самотест
       листает Controller.move, клавиш у него нет, и нажатия он отдаёт сам
       (key(t)). Наружу: sync() — найти героя и подписаться (HUD зовёт раз в
       интервал строки: главная могла смонтироваться заново), key(t),
       summary(), shows() — записи окна, stop(). */
    function probe(opts) {
      opts = opts || {};
      var shows = [];
      var cur = null;
      var keys = [];
      var nets = [];
      var lastKey = -Infinity;
      /* Начало окна для сети: миг, когда показ, вытесненный последним,
         вывел название, — серия, которая привела к самому старому показу
         окна, считается вместе с ним. До первого вытеснения — старт зонда. */
      var from = clock();
      var att = null;
      var resObs = null;
      var onKey = null;
      var dead = false;

      function titleShown(card) {
        if (!att || !att.title) return false;
        if (hasClass(att.hero, 'lumen-hero--logo')) {
          var bg = '';
          try { bg = att.logo && att.logo.style ? att.logo.style.backgroundImage || '' : ''; } catch (e) { bg = ''; }
          if (!bg || bg === 'none') return false;
          var d = heroDetails(card.id);
          return hasPath(bg, filePaths(d && d.images && d.images.logos));
        }
        var name = heroName(card);
        return !!name && att.title.textContent === name;
      }

      /* Ревью этапа 1: название чужим письмом герой пишет читаемым
         вариантом (LC.hero.heroTitle, src/48_hero.js: оригинальное
         латиницей или альтернативное из деталей) — сравнивать с тем, что он
         пишет, а не с card.title, иначе такие показы в T_title не попадали.
         Детали — те, что у героя сейчас (для чужой карточки их нет, как и у
         героя до ответа). Без героя — прежнее название карточки. */
      function heroName(card) {
        try {
          if (LC.hero && typeof LC.hero.heroTitle === 'function') return LC.hero.heroTitle(card, heroDetails(card.id)) || '';
        } catch (e) { }
        return card.title || card.name || '';
      }

      function frameShown(card) {
        var paths = [card.backdrop_path, card.poster_path];
        var d = heroDetails(card.id);
        if (d) paths = paths.concat([d.backdrop_path, d.poster_path], filePaths(d.images && d.images.backdrops));
        for (var i = 0; i < att.frames.length; i++) {
          var n = att.frames[i];
          if (hasClass(n, 'is-active') && hasPath(n.getAttribute('src') || '', paths)) return true;
        }
        return false;
      }

      function gray() {
        if (!att.frames.length) return false;
        for (var i = 0; i < att.frames.length; i++) if (hasClass(att.frames[i], 'is-active')) return false;
        return !hasClass(att.lqip, 'is-active');
      }

      function evaluate(t) {
        var c = cur;
        if (!c || !att) return;
        if (c.frame < 0 && frameShown(c.card)) {
          c.frame = Math.round(t - c.at);
          if (c.rec) c.rec.frame = c.frame;
        }
        if (!c.rec && titleShown(c.card)) {
          var h = prefetchHits();
          c.rec = { id: c.id, at: c.at, title: Math.round(t - c.at), frame: c.frame, gray: false,
            hit: h === null || c.hits0 === null ? null : h > c.hits0 };
          shows.push(c.rec);
          if (shows.length > HERO_WIN) {
            var gone = shows.shift();
            from = gone.at + gone.title;
          }
          prune(t);
        }
        if (c.rec && c.rec.frame < 0 && !c.rec.gray && gray()) c.rec.gray = true;
      }

      function onFocus(e) {
        if (dead) return;
        var el = e && e.target;
        if (!hasClass(el, 'card')) return;
        var card = el.card_data;
        if (!card || card.id == null) return;
        /* Повторное событие на той же карточке (Lampa возвращает фокус на
           место) — отсчёт не перезапускается, как и у героя. */
        if (cur && String(cur.id) === String(card.id)) return;
        var t = clock();
        cur = null;
        /* Герой уже показывает эту карточку (вернулись раньше, чем он
           сменился) — ждать нечего, это не показ. */
        if (titleShown(card)) return;
        cur = { id: card.id, card: card, at: t, frame: -1, rec: null, hits0: prefetchHits() };
      }

      function detach() {
        var a = att;
        att = null;
        cur = null;
        if (!a) return;
        try { if (a.mo) a.mo.disconnect(); } catch (e) { }
        try { if (a.onFocus && LC.focus) LC.focus.release(a.root, a.onFocus); } catch (e2) { }
      }

      function attach(hero) {
        var root = hero.parentNode;
        if (!root) return;
        var stage = root.querySelector('.lumen-hero-stage');
        var frames = [];
        var list = stage ? stage.querySelectorAll('.lumen-hero__bg') : [];
        for (var i = 0; i < list.length; i++) frames.push(list[i]);
        var a = {
          hero: hero, root: root, frames: frames,
          title: hero.querySelector('.lumen-hero__title'), logo: hero.querySelector('.lumen-hero__logo'),
          lqip: stage ? stage.querySelector('.lumen-hero__lqip') : null, mo: null, onFocus: null
        };
        att = a;
        if (LC.focus && typeof LC.focus.capture === 'function') {
          a.onFocus = onFocus;
          if (!LC.focus.capture(root, a.onFocus)) a.onFocus = null;
        }
        var MO = window.MutationObserver;
        if (!MO) return;
        a.mo = new MO(function () { if (att === a) evaluate(clock()); });
        a.mo.observe(hero, { attributes: true, attributeFilter: ['class'] });
        if (a.title) a.mo.observe(a.title, { childList: true, characterData: true, subtree: true });
        if (a.logo) a.mo.observe(a.logo, { attributes: true, attributeFilter: ['style'] });
        var layers = a.lqip ? frames.concat([a.lqip]) : frames;
        for (var j = 0; j < layers.length; j++) a.mo.observe(layers[j], { attributes: true, attributeFilter: ['class', 'src'] });
      }

      function sync() {
        if (dead) return;
        var hero = null;
        try { hero = document.querySelector('.lumen-hero'); } catch (e) { hero = null; }
        if (att && hero === att.hero && hero.parentNode === att.root) return;
        detach();
        if (!hero) return;
        try { attach(hero); } catch (e2) { detach(); }
      }

      function prune(t) {
        var i = 0;
        while (i < keys.length && (keys[i] < t - KEY_KEEP || keys.length - i > KEY_MAX)) i++;
        if (i) keys.splice(0, i);
        var j = 0;
        while (j < nets.length && nets[j] < from) j++;
        if (j) nets.splice(0, j);
      }

      function key(t) {
        if (dead) return;
        if (typeof t !== 'number' || !(t >= 0)) t = clock();
        if (t - lastKey < KEY_GAP) keys.push(t);
        if (t > lastKey) lastKey = t;
        prune(t);
      }

      /* Старт записи — внутри окна нажатия серии? Нажатия идут по
         возрастанию: с конца пропускаем более поздние, первое не позднее
         старта решает (старше — ещё дальше). */
      function inBurst(s) {
        for (var i = keys.length - 1; i >= 0; i--) {
          if (keys[i] > s) continue;
          return s - keys[i] <= KEY_WIN;
        }
        return false;
      }

      function onEntries(list) {
        if (dead) return;
        var entries = list.getEntries();
        for (var i = 0; i < entries.length; i++) {
          var s = Number(entries[i].startTime);
          if (NET_TYPES[entries[i].initiatorType] && inBurst(s)) nets.push(s);
        }
      }

      function summary() {
        var n = 0;
        for (var i = 0; i < nets.length; i++) if (nets[i] >= from) n++;
        return heroStats(shows, resObs ? n : null);
      }

      function stop() {
        dead = true;
        detach();
        try { if (resObs) resObs.disconnect(); } catch (e) { }
        try { if (onKey) window.removeEventListener('keydown', onKey, true); } catch (e2) { }
        onKey = null;
      }

      try {
        var PO = window.PerformanceObserver;
        if (PO && PO.supportedEntryTypes && PO.supportedEntryTypes.indexOf('resource') !== -1) {
          resObs = new PO(onEntries);
          resObs.observe({ type: 'resource' });
        }
      } catch (e) { resObs = null; }
      if (opts.keys) {
        onKey = function (e) {
          if (!e || !ARROWS[e.keyCode]) return;
          var now = clock();
          /* Метка события — момент нажатия (в той же шкале, что startTime
             записей), а не момент, когда занятый поток дошёл до слушателя;
             старые движки кладут туда эпоху — тогда «сейчас». */
          var ts = Number(e.timeStamp);
          key(ts > 0 && ts <= now ? ts : now);
        };
        try { window.addEventListener('keydown', onKey, true); } catch (e3) { onKey = null; }
      }
      sync();

      return {
        sync: sync, key: key, summary: summary, stop: stop,
        shows: function () { return shows.slice(); }
      };
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
      /* Первой строкой: всё, что ниже, само двигает performance.now(). */
      var late = lateness(t);
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
      var slot = state.slots[state.at];
      slot.d.push(t - state.prev);
      if (late >= 0) slot.lat.push(late);
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
        var st = sums.stats;
        var lay = layerCounts();
        /* Полоса телеметрии: вторая строка — ожидание героя (зонд выше). */
        state.probe.sync();
        state.node.textContent = format({
          fps: Math.round(state.frames * 1000 / elapsed), avg: st.avg, p95: st.p95, P: st.P, lat95: st.lat95,
          w: window.innerWidth, h: window.innerHeight,
          dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
          cr: chrome(), mode: mode,
          long: state.longSup ? { win: sums.long, total: state.longTotal } : null,
          loaf: state.loafSup ? { n: sums.loaf, ms: sums.loafMs } : null,
          raf: st.raf, eps: eps(), layers: lay.on, hid: lay.off, hw: hardware(), pf: prefetchStats(), tr: trailerStatus(), tint: accentStatus()
        }) + '\n' + heroText(state.probe.summary());
        state.frames = 0; state.last = t;
        /* Интервал закрыт — кольцо проворачивается, и следующий пишется в
           самый старый слот. Окно из SLOTS интервалов уезжает вместе с ним,
           а state.longTotal продолжает расти с момента включения HUD. */
        state.at = (state.at + 1) % SLOTS;
        resetSlot(state.slots[state.at]);
      }
      state.raf = raf(paint);
    }

    function start() {
      if (state) return;
      var node = document.createElement('div');
      node.className = 'lumen-hud';
      /* Полоса телеметрии: строка героя — с новой строки. Правило .lumen-hud
         (src/30_css.js) держит white-space:normal, и перевод строки в тексте
         слился бы в пробел; pre-line его сохраняет, переносы по ширине — как
         были. */
      try { node.style.whiteSpace = 'pre-line'; } catch (e) { }
      document.body.appendChild(node);
      var slots = [];
      for (var i = 0; i < SLOTS; i++) slots.push(newSlot());
      state = { node: node, frames: 0, last: 0, prev: 0, longTotal: 0, longSup: false, loafSup: false,
        slots: slots, at: 0, raf: 0, obs: null, loafObs: null, probe: null };
      /* Полоса телеметрии: зонд героя живёт ровно столько, сколько HUD —
         выключенный HUD не держит ни одного слушателя. */
      state.probe = probe({ keys: true });
      /* window.PerformanceObserver — не голый PerformanceObserver: тот же
         повод, что у raf/unraf выше (окружение подменяет window целиком, а
         глобал — нет; в Node, например, PerformanceObserver — свой глобал
         из perf_hooks, никак не связанный с window). 'longtask' — не во
         всех WebView Android TV: подписываемся, только если тип реально в
         supportedEntryTypes (observe() выше), иначе observe() бросил бы
         исключение. */
      state.obs = observe('longtask', function (entries) {
        state.longTotal += entries.length;
        state.slots[state.at].long += entries.length;
      });
      /* Подписка состоялась — только теперь счётчику можно верить.
         Без этого флага ноль в строке означал бы сразу две разные вещи:
         «длинных задач не было» и «мерить нечем». */
      state.longSup = !!state.obs;
      /* Волна производительности: долгие кадры анимации — число и сумма
         blockingDuration (время, на которое кадр задержал ввод и отрисовку
         сверх 50 мс). */
      state.loafObs = observe('long-animation-frame', function (entries) {
        var slot = state.slots[state.at];
        for (var i = 0; i < entries.length; i++) {
          slot.loaf++;
          slot.loafMs += Number(entries[i].blockingDuration) || 0;
        }
      });
      state.loafSup = !!state.loafObs;
      state.raf = raf(paint);
    }

    function stop() {
      if (!state) return;
      unraf(state.raf);
      try { state.probe.stop(); } catch (e5) { }
      try { if (state.obs) state.obs.disconnect(); } catch (e2) { }
      try { if (state.loafObs) state.loafObs.disconnect(); } catch (e4) { }
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
      /* Волна производительности: чистая статистика окна — наружу ради
         теста. */
      windowStats: windowStats,
      /* Ф2 п.3: оба числа — на экране и под ним — для теста и консоли. */
      layerCounts: layerCounts,
      /* Task 68: наружу — ради тестов и ради живой проверки со стенда
         (window.lumen_card.hud.eps() в консоли: число плиток ряда серий). */
      eps: eps, chrome: chrome,
      /* Ревью Task 40 (п.6): наружу ради теста и ради живой проверки с
         телевизора (window.lumen_card.hud.hardware() в консоли, если она
         есть) — по этим числам срабатывает LC.perf.weakHardware. */
      hardware: hardware,
      /* Полоса телеметрии: зонд героя — и для самотеста (стадия 9,
         src/69_bench.js); чистые окно и строка — ради теста. */
      probe: probe, heroStats: heroStats, heroText: heroText
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hud;

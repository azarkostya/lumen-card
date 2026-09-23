import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 31 (фаза 4): HUD отладки на экране ТВ.

   Модуль работает с НАТИВНЫМ DOM (document.createElement, body.appendChild/
   removeChild, querySelectorAll) и requestAnimationFrame — не с jQuery-like
   объектами, которые отдаёт test/_fakedom.mjs (тот собран под $() и сюда не
   подходит). Поэтому окружение здесь — свои минимальные заглушки, по образцу
   test/perf.test.mjs: requestAnimationFrame — ручная очередь без авто-вызова
   (кадр выполняется только по явному tick()), поэтому после последнего теста
   файла node --test завершается сам — в очереди не остаётся ни одного
   реального таймера. */

const SRC = readFileSync(new URL('../src/69_hud.js', import.meta.url), 'utf8');
/* LC.util — селектор общего правила «карточка на экране» (долг фазы 1,
   п.4), по нему eps() считает плитки активной карточки. */
const UTIL_SRC = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  new Function('LC', 'module', UTIL_SRC)(LC, { exports: null, lumen: true });
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

/* ====================================================================== */
/* format: чистая функция, DOM не нужен.                                  */
/* ====================================================================== */

/* Task 68 (фаза 6): базовый набор полей строки. Все величины подаются
   готовыми — format() ничего не измеряет сам. */
const BASE = { fps: 58, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: { win: 3, total: 212 }, raf: [48, 3, 1, 0], eps: 25, layers: 5, hw: '4c/2gb' };

test('hud: format — строка содержит fps, «1920×1080@2», режим, «long 3/212», «layers 5», «hw»', () => {
  const { api } = fresh();
  const line = api.format(BASE);
  assert.ok(line.indexOf('58') !== -1, 'fps в строке: ' + line);
  assert.ok(line.indexOf('1920×1080@2') !== -1, 'разрешение и dpr: ' + line);
  assert.ok(line.indexOf('full') !== -1, 'режим анимаций: ' + line);
  assert.ok(line.indexOf('long 3/212') !== -1, 'длинные задачи за окно и всего: ' + line);
  assert.ok(line.indexOf('layers 5') !== -1, 'число полноэкранных слоёв: ' + line);
  assert.ok(line.indexOf('hw 4c/2gb') !== -1, 'ядра и память: ' + line);
});

/* Task 68: десять фото HUD с телевизора (2026-09-21) пришлось читать
   серией, вычитая нарастающий long между снимками. Величины обязаны
   читаться с ОДНОГО кадра: длинные задачи за последнее скользящее окно и
   всего, гистограмма rAF-дельт, размер ряда серий, мажор Chromium. */
test('hud: format — long за окно и всего, гистограмма rAF, eps, cr', () => {
  const { api } = fresh();
  const line = api.format(BASE);
  assert.ok(line.indexOf('raf 48/3/1/0') !== -1, 'гистограмма по четырём корзинам: ' + line);
  assert.ok(line.indexOf('eps 25') !== -1, 'число плиток серий: ' + line);
  assert.ok(line.indexOf('cr 77') !== -1, 'мажор Chromium: ' + line);
});

/* Отсутствие longtask обязано читаться как «нечем мерить», а не как
   «длинных задач нет»: в строке с нулём эти два случая неразличимы, и
   именно на этом сгорела серия снимков — счётчик стоял бы на нуле молча. */
test('hud: format — без поддержки longtask пишется «long n/a», а не ноль', () => {
  const { api } = fresh();
  const line = api.format(Object.assign({}, BASE, { long: null }));
  assert.ok(line.indexOf('long n/a') !== -1, 'нечем мерить: ' + line);
  assert.ok(line.indexOf('long 0') === -1, 'ноль не имеет права появиться: ' + line);
});

/* Ревью Task 40 (п.6): эти два числа нужны, чтобы подтвердить порог
   weakHardware на живом телевизоре — правило «два ядра» необратимо для
   сессии, а hardwareConcurrency в Android WebView не всегда равен числу
   физических ядер. */
test('hud: hardware — ядра и память, несообщённое пишется «n/a»', () => {
  assert.equal(env({ hardware: { hardwareConcurrency: 4, deviceMemory: 2 } }).api.hardware(), '4c/2gb');
  assert.equal(env({ hardware: { hardwareConcurrency: 2, deviceMemory: 1 } }).api.hardware(), '2c/1gb');
  /* Task 68: на телевизоре пользователя deviceMemory не отдан — в строке
     стояло «hw 4c/?», и «?» ничем не отличался от «поле сломалось». Теперь
     это то же «n/a», что у long: браузер не сообщил величину. */
  assert.equal(env({ hardware: { hardwareConcurrency: 8, deviceMemory: undefined } }).api.hardware(), '8c/n/a');
  assert.equal(env({ hardware: { hardwareConcurrency: 0, deviceMemory: 0 } }).api.hardware(), 'n/a/n/a',
    'ноль — это «не сообщили», а не «ноль ядер»');
});

/* Task 68: мажор Chromium — одно число вместо строки userAgent в полэкрана.
   По нему видно, какие API на устройстве вообще существуют (на 77-м нет ни
   long-animation-frame, ни content-visibility). */
test('hud: chrome — мажор из userAgent, без него «n/a»', () => {
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (Linux; Android 9; PHILIPS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36' } }).api.chrome(), '77');
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (X11; CrOS) AppleWebKit/537.36 Chromium/112.0.0.0 Safari/537.36' } }).api.chrome(), '112',
    'Chromium без бренда Chrome тоже считается');
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/16.0 Safari/605.1.15' } }).api.chrome(), 'n/a');
});

/* ====================================================================== */
/* Жизненный цикл: нативный DOM + requestAnimationFrame под ручным         */
/* управлением.                                                            */
/* ====================================================================== */

/* Task 60: состояние подкраски, которое отдаёт LC.accent по умолчанию в
   этом окружении. Ожидания тестов, собирающие строку через format(), берут
   его же — иначе они сравнивали бы строку с подкраской и строку без неё. */
const ENV_TINT = { state: 'ok', color: '#8A4C50', url: 'image.tmdb.org/t/p/w185/a.jpg' };

function env(opts) {
  opts = opts || {};
  const bodyChildren = [];
  /* Селекторы, с которыми модуль ходил в querySelectorAll: разбор по
     последнему классу части (ниже) скоуп не различает, а Task 68 требует
     именно его — плитки считаются в АКТИВНОЙ активности. */
  const asked = [];
  const frames = [];
  let nextRaf = 1;
  const cancelled = [];
  let nowMs = 0;

  function makeNode(tag) {
    return { tagName: ('' + tag).toUpperCase(), className: '', textContent: '', parentNode: null };
  }

  const doc = {
    createElement: (tag) => makeNode(tag),
    body: {
      appendChild: (node) => { node.parentNode = doc.body; bodyChildren.push(node); },
      removeChild: (node) => {
        const i = bodyChildren.indexOf(node);
        if (i !== -1) bodyChildren.splice(i, 1);
        node.parentNode = null;
      }
    },
    /* Единственный querySelectorAll в модуле — внутри layers(), с составным
       селектором FULL (11 частей через запятую, одна из них с пробелом-
       потомком). Полноценного движка селекторов здесь нет: разбор по запятой
       плюс сравнение по ПОСЛЕДНЕМУ классу каждой части (для «.a .b» — по
       .b) — этого достаточно, чтобы честно посчитать плоский список узлов
       bodyChildren по любому из классов FULL, и заодно совпадает с
       '.lumen-hud' (одна часть без запятой и без пробела). */
    querySelectorAll: (sel) => {
      asked.push('' + sel);
      const parts = ('' + sel).split(',').map((p) => p.trim());
      return bodyChildren.filter((n) => {
        const classes = ('' + n.className).split(/\s+/).filter(Boolean);
        return parts.some((p) => {
          const last = p.split(/\s+/).pop();
          return last.charAt(0) === '.' && classes.indexOf(last.slice(1)) !== -1;
        });
      });
    }
  };

  const store = Object.assign({}, opts.store || {});
  /* Изменяемая ссылка (не снимок opts.enabled на момент env()): тест
     «выключенный плагин» переключает её между sync(), а замыкание enabled()
     обязано видеть текущее значение, а не то, что было при создании env(). */
  const enabledRef = { value: opts.enabled !== false };
  const win = {
    innerWidth: opts.width || 1920,
    innerHeight: opts.height || 1080,
    devicePixelRatio: opts.dpr || 2,
    /* Ручная очередь: кадр не выполняется сам, только через tick() —
       поэтому висящих реальных таймеров не остаётся и после последнего
       теста node --test завершает процесс сам. */
    requestAnimationFrame: (fn) => { const id = nextRaf++; frames.push({ id, fn }); return id; },
    cancelAnimationFrame: (id) => {
      cancelled.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    },
    /* Ревью Task 40 (п.6): HUD показывает ядра и память — по ним срабатывает
       LC.perf.weakHardware. opts.hardware кладётся как есть: отсутствующее
       свойство обязано остаться отсутствующим (deviceMemory есть не везде). */
    /* Task 68: userAgent по образцу телевизора пользователя (Philips
       50PUS8057, WebView Chrome/77) — из него HUD берёт поле «cr 77». */
    navigator: Object.assign({
      hardwareConcurrency: 4, deviceMemory: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
    }, opts.hardware || {})
  };

  /* opts.longtask поднимает фейковый PerformanceObserver с нужным
     supportedEntryTypes; без него window.PerformanceObserver не задан
     вовсе — окружение воспроизводит браузер без longtask (см. src/69_hud.js:
     проверка supportedEntryTypes перед подпиской). observers — журнал
     observe()/disconnect() по инстансам, obsCallbacks — их колбэки, чтобы
     дёргать longtask-записи руками. */
  const observers = [];
  const obsCallbacks = [];
  if (opts.longtask) {
    win.PerformanceObserver = function (cb) {
      obsCallbacks.push(cb);
      this.observe = (init) => { observers.push({ op: 'observe', init }); };
      this.disconnect = () => { observers.push({ op: 'disconnect' }); };
    };
    win.PerformanceObserver.supportedEntryTypes = opts.longtaskSupported !== false ? ['longtask'] : [];
  }

  globalThis.document = doc;
  globalThis.window = win;

  function pref(name, def) {
    return Object.prototype.hasOwnProperty.call(store, name) ? !!store[name] : def;
  }

  /* Task 60: HUD спрашивает состояние подкраски у LC.accent (src/57_color.js).
     opts.accent === null воспроизводит окружение, где модуля подкраски нет
     вовсе, — в тестах 69_hud.js грузится один. */
  const accentStatus = opts.accent === undefined
    ? ENV_TINT
    : opts.accent;
  const { api } = fresh({
    accent: accentStatus ? { status: () => accentStatus } : undefined,
    pref, motionMode: () => opts.mode || 'full',
    /* LC.enabled() — гейт «выключенный плагин снял свой CSS, HUD поднимать
       нельзя» (sync(), src/69_hud.js). По умолчанию true, как у соседних
       тестов (test/fx.test.mjs и т.п.). */
    enabled: () => enabledRef.value
  });

  return {
    api, store, bodyChildren, cancelled, observers, asked,
    tick: (ms) => {
      const frame = frames.shift();
      if (!frame) return false;
      nowMs += ms || 0;
      frame.fn(nowMs);
      return true;
    },
    framesLeft: () => frames.length,
    setEnabled: (v) => { enabledRef.value = v; },
    /* Кладёт узел прямо в bodyChildren, минуя api — для layers()/FULL. */
    addLayer: (className) => { const n = makeNode('div'); n.className = className; doc.body.appendChild(n); return n; },
    /* Имитирует одну longtask-запись PerformanceObserver — на ВСЕ подписки
       разом, как это делает реальный браузер. */
    fireLongtask: (entries) => { obsCallbacks.forEach((cb) => cb({ getEntries: () => entries })); }
  };
}

test('hud: выключен — узла нет, running() === false, ни один кадр не запрошен', () => {
  const e = env({ store: { lumen_debug_hud: false } });
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел не создан');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0, 'requestAnimationFrame ни разу не вызван');
});

test('hud: включён — ровно один узел .lumen-hud, повторный sync() не плодит второй, running() === true; после выключения настройки и sync() узел снят, running() === false и кадр отменён', () => {
  const e = env({ store: { lumen_debug_hud: true } });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'ровно один узел создан');
  assert.equal(e.bodyChildren[0].className, 'lumen-hud');
  assert.equal(e.api.running(), true);
  assert.equal(e.framesLeft(), 1, 'первый кадр запрошен');

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'повторный sync() не плодит второй узел');
  assert.equal(e.api.running(), true);

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел снят при выключении настройки');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'висящий кадр отменён через cancelAnimationFrame');
});

test('hud: layers() — составной селектор FULL считает узлы по любому из классов (примитивный разбор запятых в тестовой заглушке)', () => {
  const e = env();
  assert.equal(e.api.layers(), 0, 'без слоёв — ноль');
  e.addLayer('lumen-fx');
  e.addLayer('lumen-ambient');
  assert.equal(e.api.layers(), 2, 'оба узла посчитаны через FULL');
});

/* Долг фазы 4: постоянные слои Task 46 (корень героя и область рядов
   главной, translateZ(0) в src/30_css.js) — тоже полноэкранные буферы, и
   счёт без них занижал цифру HUD на 2. */
test('hud: layers() считает и два постоянных слоя Task 46 — корень героя и область рядов', () => {
  const e = env();
  e.addLayer('lumen-hero lumen-hero--compact');
  assert.equal(e.api.layers(), 1, 'корень героя посчитан');
  const full = e.asked[e.asked.length - 1].split(',').map((p) => p.trim());
  assert.ok(full.indexOf('.lumen-hero') !== -1, 'корня героя нет в FULL: ' + full.join(','));
  assert.ok(full.indexOf('.lumen-main .scroll.layer--wheight') !== -1, 'области рядов нет в FULL: ' + full.join(','));
  /* Оба селектора — ровно те узлы, которым таблица стилей ставит translateZ(0). */
  const cssSrc = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  const ruleOf = (sel) => {
    const at = cssSrc.indexOf("css.push('" + sel + '{');
    return at === -1 ? '' : cssSrc.slice(at, cssSrc.indexOf('\n    css.push(', at + 1));
  };
  assert.ok(/translateZ\(0\)/.test(ruleOf('.lumen-hero')), 'у .lumen-hero больше нет translateZ(0) — пересмотреть FULL');
  assert.ok(/translateZ\(0\)/.test(ruleOf('.lumen-main .scroll.layer--wheight')),
    'у области рядов больше нет translateZ(0) — пересмотреть FULL');
});

/* ====================================================================== */
/* paint(): rAF-цикл. Первый кадр цикла — опорная точка (state.last ещё 0), */
/* в счётчик не идёт. Дальше окно в 1000мс набирается несколькими кадрами:  */
/* meньше 1000мс — текст не трогаем; наступил порог — fps = кадры * 1000 / */
/* фактический элапсед (не «сырое число кадров» — окно почти никогда не    */
/* ровно 1000мс). Второе окно проверяет, что счётчик кадров и опорное      */
/* время РЕАЛЬНО сбрасываются: без сброса fps во втором окне удвоился бы    */
/* (или собрался бы по чужой опоре) вместо повторения того же значения.    */
/* ====================================================================== */

test('hud: два окна подряд — fps считается по фактическому элапседу и не удваивается во втором окне', () => {
  const e = env({ store: { lumen_debug_hud: true }, width: 1920, height: 1080, dpr: 2, mode: 'full' });
  e.api.sync();

  assert.ok(e.tick(600), 'первый кадр — опорная точка, ничего не считает и не пишет');
  assert.equal(e.bodyChildren[0].textContent, '', 'текст ещё не написан');

  assert.ok(e.tick(600), 'второй кадр окна 1 — элапсед 600мс < 1000, текст не трогаем');
  assert.equal(e.bodyChildren[0].textContent, '');

  assert.ok(e.tick(600), 'третий кадр окна 1 — элапсед от опоры 1200мс >= 1000, отрисовка');
  /* Литерал, а не e.api.layers(): ожидание не должно вычисляться тем же
     кодом, который проверяется (без слоёв в этом env — 0). fps = round(2
     кадра * 1000 / 1200мс) = round(1.667) = 2. long — null: в этом env
     PerformanceObserver не заведён вовсе, мерить длинные задачи нечем.
     Гистограмма: обе дельты по 600мс, то есть обе в корзине «>50». */
  const win1 = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: null, raf: [0, 0, 0, 2], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, win1, 'окно 1: 2 кадра за 1200мс');

  assert.ok(e.tick(600), 'первый кадр окна 2 — элапсед от новой опоры 600мс < 1000');
  assert.equal(e.bodyChildren[0].textContent, win1, 'текст ещё не тронут окном 2');

  assert.ok(e.tick(600), 'второй кадр окна 2 — снова 1200мс от опоры');
  /* Те же 2 кадра в fps, но гистограмма — за ПЯТЬ последних интервалов
     обновления, поэтому в ней уже 4 дельты: две из окна 1 плюс две свои. */
  const win2 = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: null, raf: [0, 0, 0, 4], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, win2,
    'то же значение fps, что и в окне 1 — счётчик кадров и опорное время реально сброшены, а не растут дальше');
});

/* ====================================================================== */
/* Task 68: гистограмма rAF-дельт по корзинам ≤16 / ≤33 / ≤50 / >50 мс.    */
/* На устройстве rAF тикает (иначе HUD не обновлялся бы вовсе и серии фото */
/* с меняющимся fps не получилось бы), и именно по этим четырём числам с   */
/* одного снимка видно, редкие ли это провалы или ровная просадка.         */
/* ====================================================================== */

test('hud: гистограмма rAF — каждая дельта попадает в свою корзину, границы 16/33/50 включительно', () => {
  const e = env({ store: { lumen_debug_hud: true }, width: 1920, height: 1080, dpr: 2, mode: 'lite' });
  e.api.sync();

  e.tick(100);              /* опорный кадр: дельты ещё нет */
  [16, 10, 33, 50, 51, 200].forEach((ms) => e.tick(ms));
  /* Сумма дельт после опорного — 360мс, порога 1000 ещё нет. */
  assert.equal(e.bodyChildren[0].textContent, '', 'окно ещё не закрыто');
  e.tick(1000);             /* седьмая дельта, корзина «>50», и закрытие окна */

  const expected = e.api.format({
    fps: Math.round(7 * 1000 / 1360), w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'lite',
    long: null, raf: [2, 1, 1, 3], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT
  });
  assert.equal(e.bodyChildren[0].textContent, expected,
    '16 и 10 — в «≤16», 33 — в «≤33», 50 — в «≤50», 51/200/1000 — в «>50»');
});

/* ====================================================================== */
/* Task 68: число плиток ряда серий. После Task 67 ряд строится окном, и   */
/* это ключевая величина: на телевизоре число плиток неизвестно, HUD его   */
/* не показывал. На главной карточки нет — поле обязано быть нулём.        */
/* ====================================================================== */

test('hud: eps() — считает узлы .lumen-episode активной карточки, на главной ноль', () => {
  const e = env();
  assert.equal(e.api.eps(), 0, 'карточки нет — ноль');
  e.addLayer('lumen-episode selector');
  e.addLayer('lumen-episode selector');
  e.addLayer('lumen-fx');
  assert.equal(e.api.eps(), 2, 'посчитаны только плитки серий');
  assert.equal(e.api.layers(), 1, 'плитки серий не попали в полноэкранные слои');
  /* Lampa держит предыдущие активности смонтированными и переносит класс
     .activity--active на текущую (vendor/lampa/app.min.js:46024-46026).
     Без скоупа счёт складывал бы ряды двух карточек: замер на стенде
     960×540@2 — переход «Дюна» → «Дораэмон» дал 50 плиток вместо 25. */
  assert.ok(e.asked.some((sel) => sel === '.activity--active .lumen-episode'),
    'запрос без скоупа активной активности: ' + e.asked.join(' | '));
});

/* ====================================================================== */
/* Task 68: строка перерисовывается не чаще раза в секунду — HUD не имеет  */
/* права сам стоить кадров на устройстве, где мы ловим просадки.           */
/* ====================================================================== */

test('hud: за окно в 1000мс textContent пишется ровно один раз, сколько бы кадров ни пришло', () => {
  const e = env({ store: { lumen_debug_hud: true } });
  e.api.sync();

  const node = e.bodyChildren[0];
  let writes = 0;
  let text = '';
  Object.defineProperty(node, 'textContent', {
    get: () => text,
    set: (v) => { writes++; text = v; }
  });

  /* Первый кадр — опорный (t = 100мс), дальше кадры каждые 100мс: окна
     закрываются на 1100мс и 2100мс. */
  for (let i = 0; i < 21; i++) e.tick(100);
  assert.equal(writes, 2, 'два закрытых окна — ровно две записи, а не двадцать одна');
});

/* ====================================================================== */
/* PerformanceObserver('longtask'): подписка только при поддержке,         */
/* накопление long по колбэку, снятие в stop().                            */
/* ====================================================================== */

test('hud: PerformanceObserver — подписывается только при supportedEntryTypes с longtask', () => {
  const supported = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: true });
  supported.api.sync();
  assert.ok(supported.observers.some((x) => x.op === 'observe'), 'longtask поддержан — observe() вызван');

  const unsupported = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: false });
  unsupported.api.sync();
  assert.equal(unsupported.observers.length, 0, 'longtask не в supportedEntryTypes — observe() не вызван вовсе');
});

test('hud: PerformanceObserver — накопленные longtask-записи доезжают до строки, disconnect() зовётся в stop()', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, width: 1920, height: 1080, dpr: 2, mode: 'full' });
  e.api.sync();

  e.fireLongtask([{}, {}]);
  e.fireLongtask([{}]);

  assert.ok(e.tick(600), 'опорный кадр');
  assert.ok(e.tick(600), 'элапсед 600мс — рано');
  assert.ok(e.tick(600), 'элапсед 1200мс — отрисовка');

  const expected = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: { win: 3, total: 3 }, raf: [0, 0, 0, 2], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, expected, 'три накопленные longtask-записи видны в строке');

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.ok(e.observers.some((x) => x.op === 'disconnect'), 'disconnect() вызван при stop()');
});

/* Task 68: десять фото с телевизора читались вычитанием нарастающего long
   между снимками — по одному снимку нельзя было сказать, сколько длинных
   задач было ПРЯМО СЕЙЧАС. Окно — пять последних закрытых интервалов
   строки, каждый не короче 1000мс; «всего» продолжает расти с момента
   включения HUD, как раньше. */
test('hud: long — окно из пяти интервалов уезжает, «всего» продолжает расти', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, width: 1920, height: 1080, dpr: 2, mode: 'lite' });
  e.api.sync();
  e.tick(100);                       /* опорный кадр */

  e.fireLongtask([{}, {}]);          /* две задачи в интервале 1 */
  e.tick(1000);                      /* интервал 1 закрыт */
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 2/2') !== -1, e.bodyChildren[0].textContent);

  e.fireLongtask([{}]);              /* одна задача в интервале 2 */
  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 3/3') !== -1,
    'окно ещё держит обе старые: ' + e.bodyChildren[0].textContent);

  /* Три пустых интервала: окно длиной пять держит интервалы 1–5, обе
     старые задачи ещё в нём. */
  e.tick(1000); e.tick(1000); e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 3/3') !== -1,
    'пять интервалов окна ещё накрывают первый: ' + e.bodyChildren[0].textContent);

  /* Шестой интервал вытесняет первый — вместе с его двумя задачами. */
  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 1/3') !== -1,
    'из окна ушёл интервал 1: ' + e.bodyChildren[0].textContent);

  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 0/3') !== -1,
    'окно пустое, «всего» не обнулилось: ' + e.bodyChildren[0].textContent);
});

/* Без PerformanceObserver (или без 'longtask' в supportedEntryTypes)
   счётчик стоял бы на нуле и был неотличим от «всё хорошо» — на
   устройстве, где консоли нет, это тихая ложь. */
test('hud: без поддержки longtask в строке «long n/a», а не «long 0»', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: false });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  const line = e.bodyChildren[0].textContent;
  assert.ok(line.indexOf('long n/a') !== -1, line);
  assert.ok(line.indexOf('long 0') === -1, 'ноль не имеет права появиться: ' + line);
});

/* ====================================================================== */
/* Гейт LC.enabled(): выключенный плагин снимает свой CSS целиком           */
/* (LC.removeCss, src/90_runtime.js) — HUD не имеет права поднимать         */
/* нестилизованный узел поверх штатной карточки Lampa.                     */
/* ====================================================================== */

test('hud: выключенный плагин — sync() не поднимает HUD, даже если настройка включена; включение плагина поднимает его, а выключение сразу снимает', () => {
  const e = env({ store: { lumen_debug_hud: true }, enabled: false });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключен — узла нет, хотя настройка включена');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0);

  e.setEnabled(true);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'плагин включили — HUD поднимается');
  assert.equal(e.api.running(), true);

  e.setEnabled(false);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключили — HUD снят, хотя настройка осталась включённой');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'rAF-цикл снят');
});

/* ====================================================================== */
/* Task 60: состояние подкраски в HUD.                                     */
/* ====================================================================== */

/* Пользователь пришёл с «подкраска вообще не работает», и на телевизоре
   отличить причину было нечем: консоли нет. HUD показывает состояние по
   факту и адрес, с которого читались пиксели, — по ним видно, чинить ли
   наш код или прокси без CORS-заголовка. */
test('hud: format — состояние подкраски с цветом и адресом', () => {
  const { api } = fresh();
  const base = BASE;
  const ok = api.format(Object.assign({}, base, {
    tint: { state: 'ok', color: '#8A4C50', url: 'image.tmdb.org/t/p/w185/a.jpg' }
  }));
  assert.ok(ok.indexOf('tint ok') !== -1, 'состояние: ' + ok);
  assert.ok(ok.indexOf('#8A4C50') !== -1, 'сам цвет: ' + ok);
  assert.ok(ok.indexOf('image.tmdb.org/t/p/w185/a.jpg') !== -1, 'адрес: ' + ok);

  const cors = api.format(Object.assign({}, base, {
    tint: { state: 'cors', color: '', url: 'proxy.example/t/p/w185/a.jpg' }
  }));
  assert.ok(cors.indexOf('tint cors') !== -1, cors);
  assert.ok(cors.indexOf('proxy.example/t/p/w185/a.jpg') !== -1, cors);

  const off = api.format(Object.assign({}, base, { tint: { state: 'off', color: '', url: '' } }));
  assert.ok(off.indexOf('tint off') !== -1, off);
  assert.ok(off.indexOf('undefined') === -1, 'пустых полей в строке нет: ' + off);
});

test('hud: состояние подкраски берётся у LC.accent и доезжает до узла', () => {
  const e = env({
    store: { lumen_debug_hud: true },
    accent: { state: 'timer', color: '', url: 'image.tmdb.org/t/p/w185/b.jpg' }
  });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf('tint timer') !== -1, e.bodyChildren[0].textContent);
  assert.ok(e.bodyChildren[0].textContent.indexOf('image.tmdb.org/t/p/w185/b.jpg') !== -1,
    e.bodyChildren[0].textContent);
});

/* Модуля подкраски может не быть (69_hud.js грузится в тестах один) —
   HUD от этого не обязан падать или молчать. */
test('hud: без LC.accent строка всё равно собирается', () => {
  const e = env({ store: { lumen_debug_hud: true }, accent: null });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf('tint n/a') !== -1, e.bodyChildren[0].textContent);
});

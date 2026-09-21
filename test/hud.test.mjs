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

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

/* ====================================================================== */
/* format: чистая функция, DOM не нужен.                                  */
/* ====================================================================== */

test('hud: format — строка содержит fps, «1920×1080@2», режим, «long 3», «layers 5», «hw»', () => {
  const { api } = fresh();
  const line = api.format({ fps: 58, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 3, layers: 5, hw: '4c/2gb' });
  assert.ok(line.indexOf('58') !== -1, 'fps в строке: ' + line);
  assert.ok(line.indexOf('1920×1080@2') !== -1, 'разрешение и dpr: ' + line);
  assert.ok(line.indexOf('full') !== -1, 'режим анимаций: ' + line);
  assert.ok(line.indexOf('long 3') !== -1, 'счётчик длинных задач: ' + line);
  assert.ok(line.indexOf('layers 5') !== -1, 'число полноэкранных слоёв: ' + line);
  assert.ok(line.indexOf('hw 4c/2gb') !== -1, 'ядра и память: ' + line);
});

/* Ревью Task 40 (п.6): эти два числа нужны, чтобы подтвердить порог
   weakHardware на живом телевизоре — правило «два ядра» необратимо для
   сессии, а hardwareConcurrency в Android WebView не всегда равен числу
   физических ядер. */
test('hud: hardware — ядра и память, неизвестное пишется «?»', () => {
  assert.equal(env({ hardware: { hardwareConcurrency: 4, deviceMemory: 2 } }).api.hardware(), '4c/2gb');
  assert.equal(env({ hardware: { hardwareConcurrency: 2, deviceMemory: 1 } }).api.hardware(), '2c/1gb');
  /* deviceMemory есть только в Chromium — и это ровно тот случай, когда
     weakHardware память не учитывает. */
  assert.equal(env({ hardware: { hardwareConcurrency: 8, deviceMemory: undefined } }).api.hardware(), '8c/?');
  assert.equal(env({ hardware: { hardwareConcurrency: 0, deviceMemory: 0 } }).api.hardware(), '?c/?',
    'ноль — это «не сообщили», а не «ноль ядер»');
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
    navigator: Object.assign({ hardwareConcurrency: 4, deviceMemory: 2 }, opts.hardware || {})
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
    api, store, bodyChildren, cancelled, observers,
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
     кадра * 1000 / 1200мс) = round(1.667) = 2. */
  const win1 = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, win1, 'окно 1: 2 кадра за 1200мс');

  assert.ok(e.tick(600), 'первый кадр окна 2 — элапсед от новой опоры 600мс < 1000');
  assert.equal(e.bodyChildren[0].textContent, win1, 'текст ещё не тронут окном 2');

  assert.ok(e.tick(600), 'второй кадр окна 2 — снова 1200мс от опоры');
  const win2 = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, win2,
    'то же значение fps, что и в окне 1 — счётчик кадров и опорное время реально сброшены, а не растут дальше');
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

  const expected = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 3, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(e.bodyChildren[0].textContent, expected, 'три накопленные longtask-записи видны в строке');

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.ok(e.observers.some((x) => x.op === 'disconnect'), 'disconnect() вызван при stop()');
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
  const base = { fps: 58, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 0, layers: 5, hw: '4c/2gb' };
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

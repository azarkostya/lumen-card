import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

/* Детерминированный «случайный»: движок обязан работать на любом rnd,
   а тест — давать один и тот же результат на каждом запуске. */
function seeded(seed) {
  var s = seed || 1;
  return function () {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
}

const { api: FX } = loadCtx('52_fx.js', { motionMode: () => 'full', enabled: () => true });

const NAMES = ['bats', 'snow', 'stars', 'rain', 'sand', 'bubbles', 'petals', 'embers', 'glitch', 'halloween', 'winter', 'hearts'];
/* Волна «праздники крупнее»: праздничные сцены. */
const SCENES = ['halloween', 'winter', 'hearts'];

test('presets: двенадцать пресетов (девять движков и три сцены), у каждого count, spawn, step, draw', () => {
  assert.deepEqual(Object.keys(FX.presets).sort(), NAMES.slice().sort());
  for (const name of NAMES) {
    const p = FX.presets[name];
    assert.equal(typeof p.count, 'number', name + '.count');
    assert.ok(p.count > 0 && p.count <= FX.MAX, name + '.count в бюджете');
    assert.equal(typeof p.spawn, 'function', name + '.spawn');
    assert.equal(typeof p.step, 'function', name + '.step');
    assert.equal(typeof p.draw, 'function', name + '.draw');
  }
});

test('MAX: бюджет слабого ТВ — 60 частиц, и ни один пресет его не превышает', () => {
  assert.equal(FX.MAX, 60);
  for (const name of NAMES) assert.ok(FX.presets[name].count <= 60, name);
});

test('spawn: n частиц с полями {x,y,vx,vy,size,life,rot} в границах слоя', () => {
  for (const name of NAMES) {
    const list = FX.spawn(name, 1000, 500, FX.presets[name].count, seeded(7));
    assert.equal(list.length, FX.presets[name].count, name);
    for (const p of list) {
      for (const key of ['x', 'y', 'vx', 'vy', 'size', 'life', 'rot']) {
        assert.equal(typeof p[key], 'number', name + '.' + key + ' — число');
        assert.ok(!isNaN(p[key]), name + '.' + key + ' — не NaN');
      }
      assert.ok(p.x >= 0 && p.x <= 1000, name + ': x в [0,w]');
      assert.ok(p.y >= -500 * 0.2 && p.y <= 500, name + ': y в [-h*0.2, h]');
      assert.ok(p.size > 0, name + ': размер положительный');
    }
  }
});

test('spawn: n больше MAX обрезается, неизвестный пресет — пустой массив', () => {
  assert.equal(FX.spawn('snow', 800, 400, 500, seeded(1)).length, 60);
  assert.deepEqual(FX.spawn('nothing', 800, 400, 10, seeded(1)), []);
  assert.deepEqual(FX.spawn('snow', 0, 0, 10, seeded(1)), []);
});

test('step: после 1000 шагов ни одна частица не ушла дальше своего размера за край', () => {
  for (const name of NAMES) {
    const w = 900, h = 400;
    const list = FX.spawn(name, w, h, FX.presets[name].count, seeded(3));
    for (let i = 0; i < 1000; i++) FX.step(list, 16, w, h);
    for (const p of list) {
      const m = p.size + 2;
      assert.ok(p.x >= -m - w * 0.3 && p.x <= w + m + w * 0.3, name + ': x в пределах после 1000 шагов (' + p.x + ')');
      assert.ok(p.y >= -m - h * 0.3 && p.y <= h + m + h * 0.3, name + ': y в пределах после 1000 шагов (' + p.y + ')');
      assert.ok(!isNaN(p.x + p.y), name + ': координаты не NaN');
    }
  }
});

test('step: снег падает — vy > 0 у всех снежинок', () => {
  const list = FX.spawn('snow', 800, 400, FX.presets.snow.count, seeded(5));
  for (const p of list) assert.ok(p.vy > 0, 'снежинка падает');
  FX.step(list, 16, 800, 400);
  for (const p of list) assert.ok(p.vy > 0, 'снежинка падает и после шага');
});

test('step: мыши летят по дуге — vx знакопеременный', () => {
  const list = FX.spawn('bats', 800, 400, FX.presets.bats.count, seeded(9));
  const first = list[0];
  let sawPlus = false, sawMinus = false;
  for (let i = 0; i < 400; i++) {
    FX.step(list, 16, 800, 400);
    if (first.vx > 0) sawPlus = true;
    if (first.vx < 0) sawMinus = true;
  }
  assert.ok(sawPlus && sawMinus, 'горизонтальная скорость меняет знак');
});

test('step: звёзды почти неподвижны — дрейф не больше 4 px/с', () => {
  const list = FX.spawn('stars', 800, 400, FX.presets.stars.count, seeded(11));
  for (const p of list) {
    assert.ok(Math.abs(p.vx) * 1000 <= 4, 'дрейф по x');
    assert.ok(Math.abs(p.vy) * 1000 <= 4, 'дрейф по y');
  }
});

test('step: dt не двигает частицы при нулевом и отрицательном шаге; пустой список терпит', () => {
  const list = FX.spawn('snow', 800, 400, 5, seeded(2));
  const before = list.map(p => p.x + ',' + p.y);
  FX.step(list, 0, 800, 400);
  FX.step(list, -100, 800, 400);
  assert.deepEqual(list.map(p => p.x + ',' + p.y), before);
  assert.doesNotThrow(() => FX.step(null, 16, 800, 400));
  assert.doesNotThrow(() => FX.step([], 16, 800, 400));
});

/* ---------------------------------------------------------------------- */
/* Рантайм: монтирование, пауза, полная остановка цикла.                   */
/* ---------------------------------------------------------------------- */

function fakeCtx() {
  const calls = [];
  const rec = (name) => (...args) => { calls.push(name); return undefined; };
  return {
    calls,
    canvas: null,
    globalAlpha: 1, fillStyle: '', strokeStyle: '', lineWidth: 1, lineCap: '',
    setTransform: rec('setTransform'), clearRect: rec('clearRect'), save: rec('save'),
    restore: rec('restore'), beginPath: rec('beginPath'), closePath: rec('closePath'),
    moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'),
    ellipse: rec('ellipse'), quadraticCurveTo: rec('quadraticCurveTo'),
    bezierCurveTo: rec('bezierCurveTo'), fill: rec('fill'), stroke: rec('stroke'),
    fillRect: rec('fillRect'), translate: rec('translate'), rotate: rec('rotate'),
    scale: rec('scale'), createLinearGradient: () => ({ addColorStop() {} })
  };
}

function fakeNode(w, h) {
  const node = {
    offsetWidth: w, offsetHeight: h,
    children: [],
    appendChild(c) { this.children.push(c); c.parentNode = this; },
    removeChild(c) {
      const i = this.children.indexOf(c);
      if (i !== -1) this.children.splice(i, 1);
      c.parentNode = null;
    }
  };
  node.length = 1;
  node[0] = node;
  return node;
}

/* Узел слоя ВНУТРИ активности: closest('.activity') — единственное, чем fx
   отличает карточку на экране от оставшейся в глубине истории (Lampa не шлёт
   покидаемой активности никаких событий). */
function fakeCardNode(w, h, active) {
  const node = fakeNode(w, h);
  const activity = {
    active: active !== false,
    classList: { contains: (cls) => cls === 'activity--active' && activity.active }
  };
  node.closest = (sel) => (sel === '.activity' ? activity : null);
  node.activity = activity;
  return node;
}

/* Окружение одного рантайм-теста: document.createElement('canvas'),
   requestAnimationFrame под ручным управлением, performance.now по шагам. */
function env(run) {
  const frames = [];
  let time = 0;
  const contexts = [];
  const doc = {
    hidden: false,
    body: { contains: (el) => !!el.parentNode },
    createElement(tag) {
      const ctx = fakeCtx();
      contexts.push(ctx);
      const el = {
        tagName: ('' + tag).toUpperCase(),
        className: '',
        width: 0, height: 0,
        parentNode: null,
        style: { setProperty() {}, removeProperty() {} },
        getContext: () => ctx,
        setAttribute(name, value) { this[name] = value; }
      };
      ctx.canvas = el;
      return el;
    }
  };
  const win = {
    document: doc,
    devicePixelRatio: 3,
    requestAnimationFrame(fn) { frames.push(fn); return frames.length; },
    cancelAnimationFrame(id) { frames[id - 1] = null; },
    performance: { now: () => time }
  };
  const saved = { window: globalThis.window, document: globalThis.document, Lampa: globalThis.Lampa };
  globalThis.window = win;
  globalThis.document = doc;
  const tick = (ms) => {
    time += (ms || 16);
    const pending = frames.splice(0, frames.length);
    for (const fn of pending) if (fn) fn(time);
  };
  try {
    return run({ doc, win, tick, contexts, pending: () => frames.filter(Boolean).length });
  } finally {
    globalThis.window = saved.window;
    globalThis.document = saved.document;
    globalThis.Lampa = saved.Lampa;
  }
}

function freshFx(init) {
  return loadCtx('52_fx.js', Object.assign({ motionMode: () => 'full', enabled: () => true }, init || {})).api;
}

test('mount: в режиме full создаёт canvas в слое и крутит кадры; unmount останавливает всё', () => {
  env(({ tick, pending }) => {
    const fx = freshFx();
    const layer = fakeNode(1280, 720);
    const inst = fx.mount(layer, 'snow');
    assert.ok(inst, 'инстанс создан');
    assert.equal(fx.active(), 1);
    assert.equal(layer.children.length, 1);
    assert.equal(layer.children[0].className, 'lumen-fx__canvas');
    tick(16); tick(16); tick(16);
    assert.ok(fx.stats().frames >= 2, 'кадры идут');
    fx.unmount(layer);
    assert.equal(fx.active(), 0);
    assert.equal(layer.children.length, 0, 'canvas снят');
    tick(16);
    assert.equal(pending(), 0, 'после unmount ни одного запланированного кадра');
  });
});

test('mount: DPR ограничен 1.5 — на 3x экране canvas не раздувается', () => {
  env(() => {
    const fx = freshFx();
    const layer = fakeNode(1000, 400);
    fx.mount(layer, 'stars');
    const canvas = layer.children[0];
    assert.equal(canvas.width, 1500);
    assert.equal(canvas.height, 600);
    fx.unmountAll();
  });
});

/* Волна производительности (C3c): на Android плотность канваса — 1.
   Телевизор отдаёт 960×540 CSS px при DPR 2, и канвас 1.5 рисовал 1440×810
   пикселей снежинок на каждом кадре — вдвое с лишним больше, чем 960×540, а
   на трёх метрах разницы в резкости частиц не видно. */
test('волна perf: на Android DPR канваса — 1, в остальных — прежний потолок 1.5', () => {
  env(() => {
    const android = freshFx({ platformInfo: () => ({ android: true, tizen: false, webos: false, weak: false }) });
    const layer = fakeNode(960, 540);
    android.mount(layer, 'snow');
    assert.equal(layer.children[0].width, 960);
    assert.equal(layer.children[0].height, 540);
    android.unmountAll();

    const desk = freshFx({ platformInfo: () => ({ android: false, tizen: false, webos: false, weak: false }) });
    const other = fakeNode(960, 540);
    desk.mount(other, 'snow');
    assert.equal(other.children[0].width, 1440);
    desk.unmountAll();
  });
});

/* Волна производительности (C3b): частицы рисуются в 30 fps. На
   пропущенном кадре цикл только заказывает следующий — ни clearRect, ни
   draw: полноэкранный канвас перерисовывается вдвое реже, а на глаз
   снежинки на 30 fps не отличить от 60. */
test('волна perf: частицы — 30 fps, на пропущенном кадре ни clearRect, ни draw', () => {
  env(({ tick, contexts, pending }) => {
    const fx = freshFx();
    fx.mount(fakeNode(960, 540), 'snow');
    const ctx = contexts[contexts.length - 1];
    const clears = () => ctx.calls.filter((c) => c === 'clearRect').length;
    const drawn = () => ctx.calls.length;
    tick(16.7);
    assert.equal(clears(), 1, 'первый кадр рисуется сразу');
    const after1 = drawn();
    tick(16.7);
    assert.equal(clears(), 1, 'второй кадр 60 Гц пропущен — канвас не чистится');
    assert.equal(drawn(), after1, 'и не рисуется');
    assert.equal(pending(), 1, 'но следующий кадр заказан');
    tick(16.7);
    assert.equal(clears(), 2, 'третий — рисуется');
    for (let i = 0; i < 60; i++) tick(16.7);
    assert.equal(clears(), 2 + 30, 'за секунду 60 Гц — тридцать отрисовок');
    assert.equal(fx.stats().frames, 32, 'stats считает только нарисованные кадры');
    fx.unmountAll();
  });
});

test('mount: в lite и off не стартует вовсе — ни canvas, ни кадра', () => {
  env(({ pending }) => {
    for (const mode of ['lite', 'off']) {
      const fx = freshFx({ motionMode: () => mode });
      const layer = fakeNode(1000, 400);
      assert.equal(fx.mount(layer, 'snow'), null, mode);
      assert.equal(fx.active(), 0, mode);
      assert.equal(layer.children.length, 0, mode);
      assert.equal(pending(), 0, mode + ': кадр не заказан');
    }
  });
});

/* Task 40: частицы — самое дорогое «украшение» плагина (полноэкранный canvas
   со своим кадровым циклом), поэтому они подчинены и тумблеру тяжёлых
   эффектов, не только режиму анимаций. */
test('mount: при выключенных тяжёлых эффектах не стартует — ни canvas, ни кадра', () => {
  env(({ pending }) => {
    const fx = freshFx({ fxHeavy: () => false });
    const layer = fakeNode(1000, 400);
    assert.equal(fx.mount(layer, 'snow'), null);
    assert.equal(fx.active(), 0);
    assert.equal(layer.children.length, 0);
    assert.equal(pending(), 0, 'кадр не заказан');

    /* Включённый тумблер ничего не меняет по сравнению с прежним поведением. */
    const on = freshFx({ fxHeavy: () => true });
    assert.ok(on.mount(fakeNode(1000, 400), 'snow'));
    on.unmountAll();
  });
});

test('mount: выключенный плагин и неизвестный пресет — null', () => {
  env(() => {
    const off = freshFx({ enabled: () => false });
    assert.equal(off.mount(fakeNode(800, 400), 'snow'), null);
    const fx = freshFx();
    assert.equal(fx.mount(fakeNode(800, 400), 'unknown'), null);
    assert.equal(fx.mount(null, 'snow'), null);
    assert.equal(fx.active(), 0);
  });
});

/* Подменяемая пара таймеров простоя: возвращает хук для fx._timers и список
   заведённых таймеров (null на месте отменённого). */
function fakeTimers() {
  const list = [];
  return {
    list,
    hook: {
      set: (fn, ms) => { list.push({ fn: fn, ms: ms }); return list.length; },
      clear: (id) => { list[id - 1] = null; }
    },
    live: () => list.filter(Boolean),
    fire: () => {
      const t = list.filter(Boolean).pop();
      assert.ok(t, 'есть таймер перепроверки');
      list[list.indexOf(t)] = null;
      t.fn();
    }
  };
}

test('пауза: скрытая вкладка и играющий трейлер не двигают частицы; слой остаётся смонтированным', () => {
  env(({ doc, tick }) => {
    const fx = freshFx();
    const timers = fakeTimers();
    fx._timers = timers.hook;
    const layer = fakeNode(800, 400);
    let trailer = false;
    fx.mount(layer, 'snow', { paused: () => trailer });
    tick(16); tick(16);
    const moved = fx.stats().steps;
    assert.ok(moved > 0);

    doc.hidden = true;
    tick(16);
    assert.equal(fx.stats().steps, moved, 'при скрытой вкладке шагов нет');
    doc.hidden = false;
    timers.fire();
    tick(16);
    assert.ok(fx.stats().steps > moved, 'вкладка вернулась — движение тоже');

    const afterHidden = fx.stats().steps;
    trailer = true;
    /* Волна perf: частицы идут в 30 fps, и паузу цикл замечает на кадре,
       который рисовал бы, — через 33 мс, а не через 16. */
    tick(34);
    assert.equal(fx.stats().steps, afterHidden, 'под трейлером шагов нет');
    trailer = false;
    timers.fire();
    tick(16);
    assert.ok(fx.stats().steps > afterHidden, 'после паузы движение вернулось');
    assert.equal(fx.active(), 1, 'слой всё ещё смонтирован');
    fx.unmountAll();
  });
});

/* Ревью фазы 3 (Critical 1): 60 проходов в секунду по слоям, из которых ни
   один не рисует, — это чистая трата процессорного времени ТВ: каждый кадр
   перебирал инстансы и дёргал closest() по карточкам в глубине истории. */
test('цикл: пока стоят ВСЕ слои, кадры не заказываются — вместо них редкая перепроверка', () => {
  env(({ doc, tick, pending }) => {
    const fx = freshFx();
    const timers = fakeTimers();
    fx._timers = timers.hook;
    fx.mount(fakeNode(800, 400), 'snow');
    tick(16);
    assert.equal(pending(), 1, 'пока слой рисует — обычный кадровый цикл');
    assert.equal(timers.live().length, 0, 'и ни одного таймера');

    doc.hidden = true;
    tick(16);
    assert.equal(pending(), 0, 'все слои стоят — следующий кадр не заказан');
    assert.equal(timers.live().length, 1, 'вместо кадра — один таймер перепроверки');
    assert.equal(timers.live()[0].ms, 500);

    /* Перепроверка, пока всё ещё стоит: снова таймер, а не кадровый цикл. */
    timers.fire();
    tick(16);
    assert.equal(pending(), 0);
    assert.equal(timers.live().length, 1, 'таймер ровно один, они не накапливаются');

    doc.hidden = false;
    timers.fire();
    tick(16);
    assert.equal(pending(), 1, 'живой слой вернул кадровый цикл');
    fx.unmountAll();
    assert.equal(timers.live().length, 0, 'снятие последнего слоя гасит и таймер');
  });
});

/* Ревью фазы 3 (Important 1), план Task 22 Step 3: «пока слой активен,
   слайдшоу карточки и частицы на паузе». Заставка непрозрачна — всё, что
   рисует под ней, тратится впустую. */
test('пауза: под заставкой частицы стоят и кадровый цикл уступает таймеру', () => {
  env(({ tick, pending }) => {
    let covered = false;
    const fx = freshFx({ covered: () => covered });
    const timers = fakeTimers();
    fx._timers = timers.hook;
    fx.mount(fakeNode(800, 400), 'snow');
    tick(16);
    const moved = fx.stats().steps;
    assert.ok(moved > 0);

    covered = true;
    /* 30 fps: паузу замечает кадр, который рисовал бы (через 33 мс). */
    tick(34);
    assert.equal(fx.stats().steps, moved, 'под заставкой шагов нет');
    assert.equal(pending(), 0, 'и кадров тоже');
    assert.equal(timers.live().length, 1);

    covered = false;
    timers.fire();
    tick(16);
    assert.ok(fx.stats().steps > moved, 'заставка ушла — частицы пошли');
    fx.unmountAll();
  });
});

/* Ревью фазы 3 (Critical 1). Уход вглубь (карточка -> актёр -> другой фильм)
   не даёт покидаемой активности ни одного события, а её DOM живёт дальше:
   без уборки канвас каждой карточки истории оставался бы в памяти. */
test('sweep: уход вглубь снимает слой предыдущей карточки и освобождает его буфер', () => {
  env(({ tick, pending }) => {
    const fx = freshFx();
    const a = fakeCardNode(1920, 1080, true);
    fx.mount(a, 'snow');
    const canvasA = a.children[0];
    assert.equal(canvasA.width, 2880, 'слой во весь экран — те самые мегабайты');
    tick(16);

    /* Lampa снимает .activity--active с покидаемой активности и ставит его
       новой ДО того, как пошлёт 'activity':start (app.min.js, start$4). */
    a.activity.active = false;
    const b = fakeCardNode(1920, 1080, true);
    fx.mount(b, 'stars');
    assert.equal(fx.active(), 2, 'без уборки в памяти висят оба слоя');

    assert.equal(fx.sweep(), 1, 'остался слой только той карточки, что на экране');
    assert.equal(a.children.length, 0, 'канвас ушедшей карточки снят');
    assert.equal(canvasA.width, 0, 'и буфер пикселей освобождён, а не ждёт сборщика');
    assert.equal(canvasA.height, 0);
    assert.equal(b.children.length, 1, 'слой активной карточки не тронут');

    fx.unmountAll();
    tick(16);
    assert.equal(pending(), 0);
  });
});

test('sweep: слой вне активности (кадр главной) не трогает', () => {
  env(() => {
    const fx = freshFx();
    fx.mount(fakeNode(1280, 720), 'stars');
    assert.equal(fx.sweep(), 1, 'closest не нашёл .activity — слой считается своим');
    fx.unmountAll();
  });
});

/* Ревью фазы 3 (Minor): drop() внутри прямого цикла сдвигает массив, и без
   шага назад следующий слой пропускал бы кадр. */
test('кадр: падение одного слоя не крадёт кадр у следующего', () => {
  env(({ tick, contexts }) => {
    const fx = freshFx();
    const a = fakeNode(800, 400);
    const b = fakeNode(800, 400);
    fx.mount(a, 'snow');
    fx.mount(b, 'stars');
    contexts[0].clearRect = () => { throw new Error('ctx lost'); };
    tick(16);
    assert.equal(fx.active(), 1, 'упавший слой снят');
    assert.equal(fx.stats().steps, 1, 'второй слой отрисован в ТОМ ЖЕ кадре');
    fx.unmountAll();
  });
});

test('остановка: слой выпал из DOM — инстанс снимается сам и цикл глохнет', () => {
  env(({ tick, pending }) => {
    const fx = freshFx();
    const layer = fakeNode(800, 400);
    fx.mount(layer, 'embers');
    tick(16);
    const canvas = layer.children[0];
    layer.removeChild(canvas);
    tick(16);
    assert.equal(fx.active(), 0, 'инстанс снят');
    tick(16);
    assert.equal(pending(), 0, 'кадров больше не заказывают');
  });
});

test('unmountAll: снимает все слои разом (выключение плагина, уход с экрана)', () => {
  env(({ tick, pending }) => {
    const fx = freshFx();
    const a = fakeNode(800, 400);
    const b = fakeNode(600, 300);
    fx.mount(a, 'snow');
    fx.mount(b, 'stars');
    assert.equal(fx.active(), 2);
    tick(16);
    fx.unmountAll();
    assert.equal(fx.active(), 0);
    assert.equal(a.children.length, 0);
    assert.equal(b.children.length, 0);
    tick(16);
    assert.equal(pending(), 0);
  });
});

test('mount: повторный вызов на том же слое не плодит ни canvas, ни инстансов', () => {
  env(({ tick }) => {
    const fx = freshFx();
    const layer = fakeNode(800, 400);
    fx.mount(layer, 'snow');
    fx.mount(layer, 'bats');
    assert.equal(fx.active(), 1);
    assert.equal(layer.children.length, 1);
    tick(16);
    fx.unmountAll();
  });
});

/* Ревью фазы 3 (Minor): раньше повторный mount() отдавал сырой инстанс, а
   первый — обёртку с destroy; вызывающий не мог полагаться на вид объекта. */
test('mount: повторный вызов отдаёт обёртку того же вида — с destroy', () => {
  env(() => {
    const fx = freshFx();
    const layer = fakeNode(800, 400);
    const first = fx.mount(layer, 'snow');
    const again = fx.mount(layer, 'bats');
    assert.equal(typeof again.destroy, 'function', 'вид объекта тот же, что у первого монтажа');
    assert.equal(again.name, first.name, 'это тот же слой, а не второй пресет');
    assert.equal(again.node, layer);
    assert.equal(again.particles().length, first.particles().length);
    again.destroy();
    assert.equal(fx.active(), 0, 'destroy повторной обёртки снимает тот же слой');
    assert.equal(layer.children.length, 0);
  });
});

test('dt: длинная пауза между кадрами капится 50 мс — частицы не телепортируются', () => {
  env(({ tick }) => {
    const fx = freshFx();
    const layer = fakeNode(800, 400);
    const inst = fx.mount(layer, 'snow');
    tick(16);
    /* Частица из середины слоя: та, что стоит у нижней кромки, за длинный
       шаг законно заворачивается наверх, и её сдвиг измерял бы wrap, а не
       кап. */
    const list = inst.particles();
    const p = list.filter((x) => x.y > 40 && x.y < 300)[0];
    assert.ok(p, 'есть частица в середине слоя');
    const y0 = p.y;
    tick(5000);
    assert.ok(Math.abs(p.y - y0) <= p.vy * 50 + 1, 'сдвиг не больше, чем за 50 мс');
    fx.unmountAll();
  });
});

test('stats: средняя длительность кадра считается — цифра для отчёта о нагрузке', () => {
  env(({ tick }) => {
    const fx = freshFx();
    fx.mount(fakeNode(1280, 720), 'snow');
    tick(16); tick(16); tick(16);
    const s = fx.stats();
    assert.ok(s.frames >= 2);
    assert.equal(typeof s.avgMs, 'number');
    assert.ok(s.avgMs >= 0);
    assert.equal(s.particles, FX.presets.snow.count);
    fx.unmountAll();
    assert.equal(fx.stats().particles, 0);
  });
});

/* ====================================================================== */
/* Волна «праздники крупнее»: единица слоя, зона текста, сцены, спрайты.   */
/* ====================================================================== */

test('сцены: помечены scene и умеют рисовать спрайты; старые движки — нет', () => {
  for (const name of SCENES) {
    assert.equal(FX.presets[name].scene, true, name + '.scene');
    assert.equal(typeof FX.presets[name].sprites, 'function', name + '.sprites');
  }
  for (const name of NAMES) {
    if (SCENES.indexOf(name) !== -1) continue;
    assert.ok(!FX.presets[name].scene, name + ' — не сцена');
  }
});

test('unitOf: опора — слой 960 CSS px; 2K — 2.67, крайности зажаты', () => {
  assert.equal(FX.REF_W, 960);
  assert.equal(FX.unitOf(960), 1);
  assert.ok(Math.abs(FX.unitOf(2560) - 2560 / 960) < 1e-9);
  assert.equal(FX.unitOf(1920), 2);
  assert.equal(FX.unitOf(100), 0.5, 'крошечный слой не сжимает частицы до пылинок');
  assert.equal(FX.unitOf(20000), 4);
  assert.equal(FX.unitOf(0), 1);
  assert.equal(FX.unitOf(NaN), 1);
});

/* Канвас с записью аргументов и присваиваний: setTransform (масштаб
   рисования), globalAlpha (зона текста), shadowBlur/filter (запрет на
   кадре), плюс градиенты и drawImage — путь спрайтов. */
function richEnv(run) {
  return env((e) => {
    const all = [];
    e.doc.createElement = function (tag) {
      const calls = [];
      const log = [];
      const alphas = [];
      const banned = [];
      const rec = (name) => (...args) => { calls.push(name); log.push([name].concat(args)); };
      const ctx = {
        calls, log, alphas, banned,
        canvas: null, fillStyle: '', strokeStyle: '', lineWidth: 1,
        setTransform: rec('setTransform'), clearRect: rec('clearRect'), save: rec('save'),
        restore: rec('restore'), beginPath: rec('beginPath'), closePath: rec('closePath'),
        moveTo: rec('moveTo'), lineTo: rec('lineTo'), arc: rec('arc'),
        quadraticCurveTo: rec('quadraticCurveTo'), bezierCurveTo: rec('bezierCurveTo'),
        fill: rec('fill'), stroke: rec('stroke'), fillRect: rec('fillRect'),
        translate: rec('translate'), rotate: rec('rotate'), scale: rec('scale'),
        drawImage: rec('drawImage'),
        createRadialGradient: () => { calls.push('createRadialGradient'); return { addColorStop() {} }; },
        createLinearGradient: () => ({ addColorStop() {} })
      };
      let ga = 1;
      Object.defineProperty(ctx, 'globalAlpha', { get: () => ga, set: (v) => { ga = v; alphas.push(v); } });
      for (const key of ['shadowBlur', 'filter']) {
        let v = key === 'filter' ? 'none' : 0;
        Object.defineProperty(ctx, key, { get: () => v, set: (x) => { v = x; banned.push(key); } });
      }
      const el = {
        tagName: ('' + tag).toUpperCase(), className: '', width: 0, height: 0, parentNode: null,
        style: { setProperty() {}, removeProperty() {} },
        getContext: () => ctx
      };
      ctx.canvas = el;
      all.push(ctx);
      return el;
    };
    return run(Object.assign({ all }, e));
  });
}

/* Главный канвас слоя — тот, что лёг в узел (спрайты в узел не кладутся). */
function mainCtx(all, layer) {
  return all.filter((c) => c.canvas === layer.children[0])[0];
}

test('mount: на 2K частицы рисуются в логическом слое 960 px — масштаб в setTransform, пиксели канваса прежние', () => {
  richEnv(({ all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: false }) });
    const layer = fakeNode(2560, 1440);
    const inst = fx.mount(layer, 'snow');
    const canvas = layer.children[0];
    assert.equal(canvas.width, 2560 * 1.5, 'число пикселей канваса — по-прежнему ширина × DPR');
    const ctx = mainCtx(all, layer);
    const st = ctx.log.filter((c) => c[0] === 'setTransform')[0];
    assert.ok(Math.abs(st[1] - 1.5 * 2560 / 960) < 1e-9, 'масштаб = DPR × единица слоя');
    for (const p of inst.particles()) {
      assert.ok(p.x >= 0 && p.x <= 960 + 1, 'x в логической ширине 960');
      assert.ok(p.y <= 540 + 1, 'y в логической высоте 540');
    }
    fx.unmountAll();
  });
});

test('mount: на ТВ (960 CSS px, Android) единица 1 — рисунок как прежде', () => {
  richEnv(({ all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    const layer = fakeNode(960, 540);
    fx.mount(layer, 'snow');
    const st = mainCtx(all, layer).log.filter((c) => c[0] === 'setTransform')[0];
    assert.deepEqual(st.slice(1), [1, 0, 0, 1, 0, 0]);
    fx.unmountAll();
  });
});

test('зона текста: частица внутри зоны рисуется с альфой floor, без зоны — полной', () => {
  richEnv(({ tick, all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    const a = fakeNode(960, 540);
    fx.mount(a, 'stars', { safe: { left: -1, top: -1, right: 2, bottom: 2, floor: 0 } });
    tick(40);
    const inZone = mainCtx(all, a).alphas.slice(0, -1);
    assert.ok(inZone.length > 10, 'кадр нарисован');
    assert.ok(inZone.every((v) => v === 0), 'зона шире слоя с floor 0 гасит всё');
    fx.unmountAll();

    const b = fakeNode(960, 540);
    fx.mount(b, 'stars');
    tick(40);
    const free = mainCtx(all, b).alphas.slice(0, -1);
    assert.ok(free.some((v) => v > 0.2), 'без зоны звёзды видны');
    fx.unmountAll();
  });
});

test('зона текста: плавный край — за полосой feather альфа полная, у края зоны — между', () => {
  richEnv(({ tick, all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    const layer = fakeNode(960, 540);
    const inst = fx.mount(layer, 'stars', { safe: { left: 0, top: 0, right: 0.5, bottom: 1, floor: 0, feather: 0.1 } });
    /* Три звезды: в зоне, в середине полосы края, далеко справа. Альфа
       звезды в draw — 0.22 + 0.33·мерцание; мерцание замерло на пике, и
       отношение к звезде без зоны — это множитель зоны. */
    const list = inst.particles();
    list.length = 3;
    list[0].x = 100; list[1].x = 480 + 48; list[2].x = 900;
    for (const p of list) { p.y = 200; p.vx = 0; p.vy = 0; p.life = Math.PI / 2; p.freq = 0; }
    tick(40);
    const al = mainCtx(all, layer).alphas.slice(-4, -1);
    assert.equal(al[0], 0, 'в зоне — floor');
    assert.ok(al[1] > 0 && al[1] < al[2], 'в полосе края — между floor и полной');
    assert.ok(Math.abs(al[1] / al[2] - 0.5) < 0.02, 'середина полосы — половина');
    fx.unmountAll();
  });
});

test('сцена: класс lumen-fx--scene на слое, пока смонтирована; канвас — без приглушения', () => {
  richEnv(() => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    const layer = fakeNode(960, 540);
    layer.className = 'lumen-fx';
    fx.mount(layer, 'winter');
    assert.ok(/(^| )lumen-fx--scene( |$)/.test(layer.className), 'класс сцены на слое');
    assert.ok(/(^| )lumen-fx__canvas--scene( |$)/.test(layer.children[0].className), 'класс сцены на канвасе');
    fx.unmount(layer);
    assert.equal(layer.className, 'lumen-fx', 'снят вместе со сценой, чужие классы целы');

    const plain = fakeNode(960, 540);
    plain.className = 'lumen-fx';
    fx.mount(plain, 'snow');
    assert.equal(plain.className, 'lumen-fx', 'у прежних движков класса нет');
    assert.equal(plain.children[0].className, 'lumen-fx__canvas');
    fx.unmountAll();
  });
});

test('сцены: на кадре — ни shadowBlur, ни filter, ни createRadialGradient; свечение — fillRect, силуэты — drawImage', () => {
  richEnv(({ tick, all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    const grads = () => all.reduce((n, c) => n + c.calls.filter((x) => x === 'createRadialGradient').length, 0);
    for (const name of SCENES) {
      const layer = fakeNode(960, 540);
      fx.mount(layer, name, { color: '#E07B2C' });
      const main = mainCtx(all, layer);
      const before = grads();
      assert.ok(before > 0, name + ': градиенты созданы при монтаже');
      tick(40); tick(40); tick(40);
      assert.equal(grads(), before, name + ': на кадре градиенты не создаются');
      assert.deepEqual(main.banned, [], name + ': на кадре нет shadowBlur и filter');
      assert.ok(main.calls.indexOf('fillRect') !== -1, name + ': свечение нарисовано');
      if (name !== 'winter') assert.ok(main.calls.indexOf('drawImage') !== -1, name + ': силуэты — drawImage');
      /* Кадр кончается в базовом преобразовании: следующий clearRect —
         в логических координатах. */
      const last = main.log.filter((c) => c[0] === 'setTransform').pop();
      assert.deepEqual(last.slice(1), [1, 0, 0, 1, 0, 0], name + ': базовое преобразование восстановлено');
      fx.unmount(layer);
    }
  });
});

test('сцены: спрайты рисуются один раз на пресет, цвет и масштаб — повторный монтаж их не перерисовывает', () => {
  richEnv(({ all }) => {
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    fx.mount(fakeNode(960, 540), 'halloween', { color: '#E07B2C' });
    const made = all.length;
    fx.unmountAll();
    fx.mount(fakeNode(960, 540), 'halloween', { color: '#E07B2C' });
    assert.equal(all.length, made + 1, 'новый — только канвас слоя');
    fx.unmountAll();
    fx.mount(fakeNode(960, 540), 'halloween', { color: '#9FCF8A' });
    assert.ok(all.length > made + 2, 'другой цвет — свой набор');
    fx.unmountAll();
  });
});

test('сцены: без градиентов и drawImage (старая среда) — запасные фигуры, кадр не падает', () => {
  env(({ tick, contexts }) => {
    warnLog.length = 0;
    const fx = freshFx({ platformInfo: () => ({ android: true }) });
    for (const name of SCENES) {
      const layer = fakeNode(960, 540);
      fx.mount(layer, name, { color: '#E8607D' });
      tick(40); tick(40);
      const ctx = contexts.filter((c) => c.canvas === layer.children[0])[0];
      assert.ok(ctx.calls.indexOf('arc') !== -1 || ctx.calls.indexOf('quadraticCurveTo') !== -1, name + ': нарисованы запасные фигуры');
      fx.unmount(layer);
    }
    assert.equal(warnLog.filter((w) => /render failed/.test(w.msg)).length, 0, 'ни один кадр не упал');
    assert.ok(fx.stats().frames >= 6);
  });
});

test('сцены: мыши Хэллоуина держатся верхней трети, угли поднимаются и рождаются снизу', () => {
  const w = 960, h = 540;
  const list = FX.spawn('halloween', w, h, FX.presets.halloween.count, seeded(4));
  const bats = list.filter((p) => p.kind === 1);
  const embers = list.filter((p) => p.kind === 0);
  assert.equal(bats.length, 7);
  assert.equal(embers.length, 32);
  for (const b of bats) assert.ok(b.y >= h * 0.08 && b.y <= h * 0.32, 'мышь над зоной текста');
  for (const e of embers) assert.ok(e.vy < 0, 'уголь летит вверх');
  for (let i = 0; i < 2000; i++) FX.step(list, 33, w, h);
  for (const b of list.filter((p) => p.kind === 1)) assert.ok(b.y > -h * 0.05 && b.y < h * 0.45, 'мышь не спускается к тексту (' + b.y + ')');
});

test('сцены: у зимы три плана снега — ближние крупнее и быстрее дальних; гирлянда неподвижна', () => {
  const list = FX.spawn('winter', 960, 540, FX.presets.winter.count, seeded(6));
  const plane = (k) => list.filter((p) => p.kind === k);
  assert.equal(plane(3).length, 6, 'огни боке');
  assert.equal(plane(4).length, 10, 'лампочки гирлянды');
  const far = plane(0), mid = plane(1), near = plane(2);
  assert.equal(far.length + mid.length + near.length, 42);
  assert.equal(near.length, 6, 'ближний план — шесть крупных хлопьев');
  const maxOf = (a, k) => Math.max.apply(null, a.map((p) => p[k]));
  const minOf = (a, k) => Math.min.apply(null, a.map((p) => p[k]));
  /* Отзыв пользователя «снег более яркий»: средний и ближний планы
     плотнее прежних (.75 и .3 — нижние границы до правки). */
  assert.ok(minOf(mid, 'life') >= 0.85, 'средние хлопья почти непрозрачны');
  assert.ok(minOf(near, 'life') >= 0.45, 'ближние хлопья плотнее прежних');
  assert.ok(maxOf(far, 'size') < minOf(mid, 'size') && maxOf(mid, 'size') < minOf(near, 'size'), 'размер растёт к зрителю');
  assert.ok(maxOf(far, 'vy') < minOf(near, 'vy'), 'ближние падают быстрее дальних');
  const bulbs = plane(4).map((p) => [p.x, p.y]);
  FX.step(list, 33, 960, 540);
  assert.deepEqual(plane(4).map((p) => [p.x, p.y]), bulbs, 'лампочки стоят на месте, мерцают фазой');
});

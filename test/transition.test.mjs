import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery, toEl } from './_fakedom.mjs';

/* Task 29 (фаза 3): переход «постер ряда → кадр карточки».

   Геометрия (geom) и раскладка прозрачности по времени (fade) — чистые
   функции, проверяются без окружения. Жизненный цикл (гейты режима и
   настройки, один узел на переход, снятие по таймеру, отмена при быстром
   повторном открытии) — на фейковых $, requestAnimationFrame и таймерах. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg) { warnLog.push(msg); };

const SRC = readFileSync(new URL('../src/67_transition.js', import.meta.url), 'utf8');

function build(extra) {
  const LC = Object.assign({
    motionMode: () => 'full',
    pref: (name, def) => def
  }, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const T = build().api;

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

const SCREEN = { width: 1920, height: 1080 };

test('geom: масштаб по высоте, сдвиг — в центр экрана', () => {
  const g = T.geom({ left: 100, top: 200, width: 180, height: 270 }, SCREEN);
  assert.equal(g.scale, 4, '1080 / 270');
  assert.equal(g.tx, 960 - 190, 'центр экрана минус центр постера по X');
  assert.equal(g.ty, 540 - 335, 'то же по Y');
});

test('geom: постер уже по центру — сдвига нет', () => {
  const g = T.geom({ left: 960 - 90, top: 540 - 135, width: 180, height: 270 }, SCREEN);
  assert.equal(g.tx, 0);
  assert.equal(g.ty, 0);
});

test('geom: пустой прямоугольник или экран -> null (анимировать нечего)', () => {
  assert.equal(T.geom(null, SCREEN), null);
  assert.equal(T.geom({ left: 0, top: 0, width: 0, height: 0 }, SCREEN), null);
  assert.equal(T.geom({ left: 0, top: 0, width: 180, height: 270 }, { width: 0, height: 0 }), null);
  assert.equal(T.geom({ left: 0, top: 0, width: 180, height: 270 }, null), null);
});

test('fade: прозрачность гаснет на последней доле перехода', () => {
  const f = T.fade(480, 0.4);
  assert.equal(f.ms, 192, '40 % от 480 мс');
  assert.equal(f.delay, 288, 'первые 60 % постер полностью непрозрачен');
  assert.equal(f.delay + f.ms, 480);
});

/* ====================================================================== */
/* Жизненный цикл                                                         */
/* ====================================================================== */

function env(opts) {
  opts = opts || {};
  const body = new FakeEl(['body-mock']);
  const frames = [];
  const timers = [];
  let nextRaf = 1;
  const cancelledFrames = [];
  const cancelledTimers = [];

  globalThis.$ = function (x) {
    if (typeof x !== 'string') return toEl(x);
    if (x === 'body') return body;
    return fakeQuery(x);
  };
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    requestAnimationFrame: (fn) => { frames.push({ id: nextRaf, fn }); return nextRaf++; },
    cancelAnimationFrame: (id) => {
      cancelledFrames.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    }
  };
  globalThis.setTimeout = (fn, ms) => { timers.push({ id: timers.length + 1, fn, ms, done: false }); return timers.length; };
  globalThis.clearTimeout = (id) => {
    cancelledTimers.push(id);
    const t = timers[id - 1];
    if (t) t.done = true;
  };

  const { api } = build({
    motionMode: () => opts.motion || 'full',
    pref: (name, def) => (Object.prototype.hasOwnProperty.call(opts.prefs || {}, name) ? opts.prefs[name] : def),
    hero: { lastFocus: () => (opts.last === undefined ? SOURCE : opts.last) }
  });

  function frame() {
    const f = frames.shift();
    if (f) f.fn();
    return !!f;
  }
  function fire() {
    let ran = 0;
    for (const t of timers) if (!t.done) { t.done = true; t.fn(); ran++; }
    return ran;
  }
  function overlay() { return body._children.filter((c) => c.hasClass('lumen-overlay')); }

  return { api, body, frames, timers, cancelledFrames, cancelledTimers, frame, fire, overlay };
}

const SOURCE = { id: 42, poster: 'https://img/poster.jpg', rect: { left: 100, top: 200, width: 180, height: 270 } };

test('open: рисует один слой поверх экрана с постером фокусной карточки', () => {
  const e = env();
  assert.equal(e.api.open({ id: 42 }), true);
  const layers = e.overlay();
  assert.equal(layers.length, 1);
  assert.equal(e.api.active(), true);
  const img = layers[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('poster.jpg') !== -1);
  assert.equal(img.css('width'), '180px');
  assert.equal(img.css('height'), '270px');
  assert.equal(img.css('left'), '100px');
  assert.equal(img.css('top'), '200px');
});

test('open: конечная геометрия ставится через два кадра — иначе браузер анимировать нечего', () => {
  const e = env();
  e.api.open({ id: 42 });
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.equal(img.hasClass('is-run'), false, 'до кадров слой стоит на месте постера');
  e.frame();
  assert.equal(img.hasClass('is-run'), false, 'первый кадр идёт ДО отрисовки начального состояния');
  e.frame();
  assert.equal(img.hasClass('is-run'), true);
  const transform = String(img.css('transform'));
  assert.ok(transform.indexOf('scale(4)') !== -1, transform);
  assert.ok(transform.indexOf('translate(770px, 205px)') !== -1, transform);
});

test('open: слой снимается по таймеру и ничего после себя не оставляет', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.frame();
  e.frame();
  assert.equal(e.overlay().length, 1);
  e.fire();
  assert.equal(e.overlay().length, 0);
  assert.equal(e.api.active(), false);
});

test('open: id открытой карточки не совпал с фокусной — перехода нет', () => {
  const e = env();
  assert.equal(e.api.open({ id: 7 }), false);
  assert.equal(e.overlay().length, 0);
  assert.equal(e.frames.length, 0, 'кадр не запрашивался');
});

test('open: карточка открыта не из ряда (фокуса не было) — перехода нет', () => {
  const e = env({ last: null });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: id берётся и из object.card — у активности Lampa он лежит там', () => {
  const e = env();
  assert.equal(e.api.open({ card: { id: 42 } }), true);
  assert.equal(e.overlay().length, 1);
});

test('open: в lite и off — мгновенно, без промежуточных кадров', () => {
  for (const motion of ['lite', 'off']) {
    const e = env({ motion });
    assert.equal(e.api.open({ id: 42 }), false, motion);
    assert.equal(e.overlay().length, 0, motion);
    assert.equal(e.frames.length, 0, motion);
    assert.equal(e.timers.length, 0, motion);
  }
});

test('open: выключенная настройка lumen_transition — перехода нет', () => {
  const e = env({ prefs: { lumen_transition: false } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: нет постера — перехода нет (растворять нечего)', () => {
  const e = env({ last: { id: 42, poster: '', rect: SOURCE.rect } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: нулевой прямоугольник — перехода нет', () => {
  const e = env({ last: { id: 42, poster: 'p.jpg', rect: { left: 0, top: 0, width: 0, height: 0 } } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('stop: быстрое открытие-закрытие не оставляет ни узла, ни кадра, ни таймера', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.stop();
  assert.equal(e.overlay().length, 0);
  assert.equal(e.frames.length, 0);
  assert.equal(e.cancelledFrames.length, 1, 'отложенный кадр отменён');
  assert.equal(e.cancelledTimers.length, 1, 'таймер снятия отменён');
  assert.equal(e.api.active(), false);
  assert.equal(e.fire(), 0, 'живых таймеров не осталось');
});

test('stop: идемпотентна', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.stop();
  e.api.stop();
  assert.equal(e.overlay().length, 0);
});

test('open: второй переход подряд снимает первый — на экране всегда один слой', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.open({ id: 42 });
  assert.equal(e.overlay().length, 1);
  e.api.stop();
  assert.equal(e.overlay().length, 0);
});

test('open: отложенный кадр, доехавший после снятия, в мёртвый узел не пишет', () => {
  const e = env();
  e.api.open({ id: 42 });
  const img = e.overlay()[0].find('.lumen-overlay__img');
  const first = e.frames[0];
  e.api.stop();
  first.fn();
  assert.equal(e.frames.length, 0, 'второй кадр после снятия не заказывается');
  assert.equal(img.hasClass('is-run'), false);
});

test('open: снятие между первым и вторым кадром конечных значений не ставит', () => {
  const e = env();
  e.api.open({ id: 42 });
  const img = e.overlay()[0].find('.lumen-overlay__img');
  e.frame();
  const second = e.frames[0];
  e.api.stop();
  second.fn();
  assert.equal(img.hasClass('is-run'), false);
});

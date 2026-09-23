import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 29 (фаза 3): автоопределение слабого телевизора.

   Чистая часть (median/decide/merge/normalize) проверяется без окружения.
   Жизненный цикл (гейты, три замера, запись вердикта, уведомление, отмена
   висящего кадра) — на фейковых Lampa.Storage, requestAnimationFrame и
   часах: ровно тех глобалах, что модуль читает в момент вызова, а не
   загрузки. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg) { warnLog.push(msg); };

const SRC = readFileSync(new URL('../src/68_perf.js', import.meta.url), 'utf8');

/* Правка 2026-09-23 (долг фазы 1, п.5): сырое значение «Анимаций» модуль
   читает общим LC.pref — даём ему настоящий из src/81_prefs.js. */
function realPref() {
  const P = {};
  new Function('LC', 'module', readFileSync(new URL('../src/81_prefs.js', import.meta.url), 'utf8'))(P, { exports: null, lumen: true });
  return P.pref;
}

function fresh(extra) {
  const LC = Object.assign({ enabled: () => true, pref: realPref() }, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const P = fresh().api;

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

test('decide: медиана ≥ 400 мс -> lite', () => {
  assert.equal(P.decide([500, 620, 450]), 'lite');
  assert.equal(P.decide([400, 400, 400]), 'lite', 'ровно порог — уже слабый');
});

test('decide: медиана < 250 мс -> full', () => {
  assert.equal(P.decide([90, 120, 200]), 'full');
  assert.equal(P.decide([249, 10, 249]), 'full');
});

test('decide: середина (250..400) -> null, режим не меняем', () => {
  assert.equal(P.decide([300, 320, 310]), null);
  assert.equal(P.decide([250, 250, 250]), null, 'ровно нижний порог — не «быстрый»');
});

test('decide: меньше трёх замеров -> null', () => {
  assert.equal(P.decide([]), null);
  assert.equal(P.decide([900, 900]), null);
  assert.equal(P.decide(null), null);
});

test('decide: считает медиану, а не среднее — одиночный выброс вердикт не меняет', () => {
  assert.equal(P.decide([100, 2000, 120]), 'full', 'один тяжёлый кадр (GC, реклама) не понижает');
  assert.equal(P.decide([900, 10, 900]), 'lite', 'один лёгкий кадр не спасает слабый ТВ');
});

test('normalize: строка, объект, JSON и мусор -> {mode, good}', () => {
  assert.deepEqual(P.normalize('lite'), { mode: 'lite', good: 0 });
  assert.deepEqual(P.normalize({ mode: 'lite', good: 3 }), { mode: 'lite', good: 3 });
  assert.deepEqual(P.normalize('{"mode":"full","good":2}'), { mode: 'full', good: 2 });
  for (const junk of [null, undefined, '', 'garbage', 0, { mode: 'turbo' }]) {
    assert.deepEqual(P.normalize(junk), { mode: null, good: 0 }, String(junk));
  }
  assert.deepEqual(P.normalize({ mode: 'lite', good: -4 }), { mode: 'lite', good: 0 }, 'отрицательный счётчик — ноль');
});

test('merge: понижение записывается сразу, счётчик хороших обнуляется', () => {
  assert.deepEqual(P.merge(null, 'lite'), { mode: 'lite', good: 0 });
  assert.deepEqual(P.merge({ mode: 'full', good: 0 }, 'lite'), { mode: 'lite', good: 0 });
  assert.deepEqual(P.merge({ mode: 'lite', good: 4 }, 'lite'), { mode: 'lite', good: 0 });
});

test('merge: повышение — только после пяти хороших замеров подряд', () => {
  let cur = { mode: 'lite', good: 0 };
  for (let i = 1; i < 5; i++) {
    cur = P.merge(cur, 'full');
    assert.deepEqual(cur, { mode: 'lite', good: i }, 'шаг ' + i + ' — всё ещё lite');
  }
  assert.deepEqual(P.merge(cur, 'full'), { mode: 'full', good: 0 }, 'пятый хороший — возврат в full');
});

test('merge: вердикта нет (null) -> сохранённое значение не меняется', () => {
  assert.deepEqual(P.merge({ mode: 'lite', good: 3 }, null), { mode: 'lite', good: 3 });
  assert.deepEqual(P.merge(null, null), { mode: null, good: 0 });
});

test('merge: хороший замер без записанного понижения ничего не накапливает', () => {
  assert.deepEqual(P.merge(null, 'full'), { mode: 'full', good: 0 });
  assert.deepEqual(P.merge({ mode: 'full', good: 0 }, 'full'), { mode: 'full', good: 0 });
});

/* ====================================================================== */
/* Жизненный цикл                                                         */
/* ====================================================================== */

function env(opts) {
  opts = opts || {};
  const store = Object.assign({ lumen_motion: 'auto' }, opts.store || {});
  const noty = [];
  const frames = [];
  let nowMs = 0;
  let nextRaf = 1;
  const cancelled = [];

  const Lampa = {
    Storage: {
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : def),
      set: (name, value) => { store[name] = value; }
    },
    Noty: { show: (text) => noty.push(text) },
    Platform: { is: (name) => !!(opts.platform && opts.platform[name]) }
  };

  globalThis.Lampa = Lampa;
  globalThis.document = { hidden: !!opts.hidden };
  globalThis.window = {
    Lampa: Lampa,
    requestAnimationFrame: (fn) => { frames.push({ id: nextRaf, fn: fn }); return nextRaf++; },
    cancelAnimationFrame: (id) => {
      cancelled.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    },
    performance: { now: () => nowMs },
    /* Task 40: weakHardware читает window.navigator. Кладём ровно то, что
       описывает opts.hardware, и ничего сверх: отсутствующее свойство
       обязано остаться отсутствующим (deviceMemory есть не у всех движков). */
    navigator: opts.hardware ? Object.assign({}, opts.hardware) : undefined
  };

  const applied = [];
  const { api } = fresh({ enabled: () => opts.enabled !== false, applyMotionMode: () => applied.push(1) });

  /* Прокрутить оба отложенных кадра одного замера, добавив ms на каждом. */
  function run(ms) {
    for (let step = 0; step < 2; step++) {
      const frame = frames.shift();
      if (!frame) return false;
      nowMs += step === 0 ? 0 : ms;
      frame.fn();
    }
    return true;
  }

  return { api, store, noty, frames, applied, cancelled, run, advance: (ms) => { nowMs += ms; } };
}

test('track: пользовательский выбор приоритетнее — при lumen_motion full/lite/off кадры не запрашиваются', () => {
  for (const mode of ['full', 'lite', 'off']) {
    const e = env({ store: { lumen_motion: mode } });
    e.api.track();
    assert.equal(e.frames.length, 0, mode);
    assert.equal(e.api.samples().length, 0, mode);
  }
});

test('track: на tizen/webos не меряем — «Авто» там и так даёт lite', () => {
  for (const platform of [{ tizen: true }, { webos: true }]) {
    const e = env({ platform });
    e.api.track();
    assert.equal(e.frames.length, 0);
  }
});

test('track: отказ гейта не запоминается — режим анимаций переключают во время сеанса', () => {
  const e = env({ store: { lumen_motion: 'full' } });
  e.api.track();
  assert.equal(e.frames.length, 0);
  e.store.lumen_motion = 'auto';
  e.api.track();
  assert.equal(e.frames.length, 1, 'после возврата на «Авто» замер идёт');
});

test('track: выключенный плагин не меряет', () => {
  const e = env({ enabled: false });
  e.api.track();
  assert.equal(e.frames.length, 0);
});

/* Ревью фазы 3 (Important 3): вердикт 'full' больше НЕ терминален. Он
   выносится по трём первым карточкам запуска — самым холодным, — и раньше
   один такой вердикт отменял измерение этого устройства навсегда. */
test('track: записанный вердикт full меряем дальше — ни один вердикт не терминален', () => {
  const e = env({ store: { lumen_motion_auto: { mode: 'full', good: 0 } } });
  e.api.track();
  assert.equal(e.frames.length, 1, 'первый кадр запрошен');
  e.run(600);
  e.api.track(); e.run(600);
  e.api.track(); e.run(600);
  assert.equal(e.api.samples().length, 3);
  assert.equal(e.store.lumen_motion_auto.mode, 'lite', 'просевшее устройство понижается, а не остаётся full навсегда');
});

test('track: записанный вердикт lite меряем дальше — иначе из lite не выбраться', () => {
  const e = env({ store: { lumen_motion_auto: { mode: 'lite', good: 2 } } });
  e.api.track();
  assert.equal(e.frames.length, 1, 'первый кадр запрошен');
});

test('track: ровно три замера на сессию, четвёртая карточка кадров не просит', () => {
  const e = env();
  for (let i = 0; i < 4; i++) { e.api.track(); e.run(120); }
  assert.equal(e.api.samples().length, 3);
  assert.equal(e.frames.length, 0, 'висящих кадров не осталось');
});

test('track: повторный вызов во время незавершённого замера второй пары кадров не заводит', () => {
  const e = env();
  e.api.track();
  e.api.track();
  assert.equal(e.frames.length, 1);
});

test('track: замер — время от вызова до ВТОРОГО кадра', () => {
  const e = env();
  e.api.track();
  e.run(310);
  assert.deepEqual(e.api.samples(), [310]);
});

test('track: медленное устройство -> вердикт lite, уведомление и пересборка режима', () => {
  const e = env();
  for (let i = 0; i < 3; i++) { e.api.track(); e.run(600); }
  assert.deepEqual(e.store.lumen_motion_auto, { mode: 'lite', good: 0 });
  assert.equal(e.noty.length, 1, 'уведомление показано один раз');
  assert.equal(e.applied.length, 1, 'режим анимаций перечитан на открытом экране');
  assert.equal(e.store.lumen_motion_noty, 'true');
});

test('track: уведомление о понижении показывается один раз за все запуски', () => {
  const e = env({ store: { lumen_motion_noty: 'true' } });
  for (let i = 0; i < 3; i++) { e.api.track(); e.run(600); }
  assert.deepEqual(e.store.lumen_motion_auto, { mode: 'lite', good: 0 });
  assert.equal(e.noty.length, 0);
});

test('track: быстрое устройство -> вердикт full, ни уведомления, ни пересборки', () => {
  const e = env();
  for (let i = 0; i < 3; i++) { e.api.track(); e.run(80); }
  assert.deepEqual(e.store.lumen_motion_auto, { mode: 'full', good: 0 });
  assert.equal(e.noty.length, 0);
  assert.equal(e.applied.length, 0);
});

test('track: середина — в Storage ничего не пишем', () => {
  const e = env();
  for (let i = 0; i < 3; i++) { e.api.track(); e.run(300); }
  assert.equal(Object.prototype.hasOwnProperty.call(e.store, 'lumen_motion_auto'), false);
});

test('track: пятый хороший запуск снимает записанный lite', () => {
  const e = env({ store: { lumen_motion_auto: { mode: 'lite', good: 4 } } });
  for (let i = 0; i < 3; i++) { e.api.track(); e.run(80); }
  assert.deepEqual(e.store.lumen_motion_auto, { mode: 'full', good: 0 });
  assert.equal(e.applied.length, 1, 'повышение тоже перечитывает режим');
});

test('stop: висящий кадр отменяется и замер не дописывается', () => {
  const e = env();
  e.api.track();
  e.api.stop();
  assert.equal(e.cancelled.length, 1);
  assert.equal(e.frames.length, 0);
  assert.equal(e.api.samples().length, 0);
});

test('mode: вердикт из Storage — его читает LC.motionMode', () => {
  const e = env({ store: { lumen_motion_auto: { mode: 'lite', good: 1 } } });
  assert.equal(e.api.mode(), 'lite');
  const clean = env();
  assert.equal(clean.api.mode(), null);
});

/* Найдено живой проверкой (2026-09-17): в скрытой вкладке кадры не приходят
   вовсе, а доехав после возвращения страницы, дают «замер» в десятки секунд. */
test('track: скрытая страница не меряется — кадров там не рисуют', () => {
  const e = env({ hidden: true });
  e.api.track();
  assert.equal(e.frames.length, 0);
  assert.equal(e.api.samples().length, 0);
});

test('track: кадры, доехавшие после возвращения из фона, отбрасываются', () => {
  const e = env();
  e.api.track();
  e.run(42000);
  assert.deepEqual(e.api.samples(), [], 'время в фоне — не замер устройства');
  assert.equal(e.frames.length, 0, 'место под замер освобождено');
  /* Следующая карточка пробует снова, и обычный замер засчитывается. */
  e.api.track();
  e.run(120);
  assert.deepEqual(e.api.samples(), [120]);
});

/* ====================================================================== */
/* Task 40: слабое железо без замеров                                     */
/* ====================================================================== */

test('weakHardware: на android два ядра или гигабайт памяти — слабое железо', () => {
  const weak = (hardware) => env({ platform: { android: true }, hardware }).api.weakHardware();
  assert.equal(weak({ hardwareConcurrency: 2 }), true);
  assert.equal(weak({ hardwareConcurrency: 1 }), true);
  assert.equal(weak({ hardwareConcurrency: 4, deviceMemory: 1 }), true);
  assert.equal(weak({ hardwareConcurrency: 4, deviceMemory: 0.5 }), true);
});

/* Четырёхъядерный ТВ пользователя (Philips 50PUS8057) под правило не
   попадает — там решает замер. */
test('weakHardware: четыре ядра — не слабое, вердикт остаётся за замером', () => {
  const e = env({ platform: { android: true }, hardware: { hardwareConcurrency: 4 } });
  assert.equal(e.api.weakHardware(), false);
  e.api.track();
  assert.equal(e.frames.length, 1, 'замер на таком железе по-прежнему делается');
});

test('weakHardware: неизвестные значения не считаются нулём', () => {
  const weak = (hardware) => env({ platform: { android: true }, hardware }).api.weakHardware();
  assert.equal(weak({}), false, 'ни ядер, ни памяти — не знаем, значит не слабое');
  assert.equal(weak({ hardwareConcurrency: 0 }), false, 'ноль ядер — это «не сообщили»');
  assert.equal(weak({ hardwareConcurrency: 8, deviceMemory: undefined }), false);
  assert.equal(weak({ hardwareConcurrency: 8, deviceMemory: 0 }), false, 'ноль гигабайт — тоже «не сообщили»');
});

test('weakHardware: правило работает только на android', () => {
  const hardware = { hardwareConcurrency: 1 };
  assert.equal(env({ platform: {}, hardware }).api.weakHardware(), false, 'браузер на компьютере');
  assert.equal(env({ platform: { tizen: true }, hardware }).api.weakHardware(), false, 'Tizen и так получает lite от платформы');
});

/* Task 40: точек замера три — главная, хаб и карточка. */
test('track: замеры с разных экранов копятся в один вердикт', () => {
  const e = env();
  e.api.track('main');
  e.run(500);
  e.api.track('hub');
  e.run(520);
  e.api.track('card');
  e.run(480);
  assert.deepEqual(e.api.samples(), [500, 520, 480]);
  assert.equal(e.store.lumen_motion_auto.mode, 'lite', 'медиана 500 мс — слабое устройство');
});

/* Ревью Task 40 (п.5): монтирование героя случается на каждом возврате из
   карточки, поэтому с главной берётся ровно один замер за запуск — иначе
   обычный обход «главная → карточка → назад → карточка → назад» дал бы два
   замера главной из трёх, и медиана легла бы на самый лёгкий экран. */
test('track: с главной берётся только один замер за запуск', () => {
  const e = env();
  e.api.track('main');
  e.run(100);
  assert.deepEqual(e.api.samples(), [100]);

  e.api.track('main');
  assert.equal(e.frames.length, 0, 'второй замер главной кадров не заказывает');
  assert.deepEqual(e.api.samples(), [100], 'выборка не разбавлена');

  /* Возврат на карточку и хаб по-прежнему меряется. */
  e.api.track('card');
  e.run(600);
  e.api.track('hub');
  e.run(700);
  assert.deepEqual(e.api.samples(), [100, 600, 700]);
  assert.equal(e.store.lumen_motion_auto.mode, 'lite', 'медиана 600 мс — слабое устройство');
});

/* Замер главной, который не засчитался (страница была в фоне — см.
   MAX_SAMPLE), место не занимает: следующий вход на главную пробует снова. */
test('track: отброшенный замер главной не расходует её единственную попытку', () => {
  const e = env();
  e.api.track('main');
  e.run(42000);
  assert.deepEqual(e.api.samples(), []);
  e.api.track('main');
  e.run(120);
  assert.deepEqual(e.api.samples(), [120]);
});

/* Вызов без источника — это карточка: единственная точка, существовавшая до
   Task 40 (src/90_runtime.js зовёт track('card') явно, но контракт функции
   обязан пережить и вызов без аргумента). */
test('track: вызов без источника считается замером карточки', () => {
  const e = env();
  e.api.track();
  e.run(100);
  e.api.track();
  e.run(110);
  e.api.track('main');
  e.run(120);
  assert.deepEqual(e.api.samples(), [100, 110, 120], 'ни один вызов без источника не съел лимит главной');
});

test('track: пока замер не доехал, второй вызов кадров не заказывает', () => {
  const e = env();
  e.api.track('main');
  assert.equal(e.frames.length, 1);
  e.api.track('card');
  assert.equal(e.frames.length, 1, 'экран сменился на середине замера — второго замера не начинаем');
});

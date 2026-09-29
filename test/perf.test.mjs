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
    Platform: { is: (name) => !!(opts.platform && opts.platform[name]), tv: () => !!opts.tv }
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
  const { api, LC } = fresh({ enabled: () => opts.enabled !== false, applyMotionMode: () => applied.push(1) });

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

  return { api, LC, store, noty, frames, applied, cancelled, run, advance: (ms) => { nowMs += ms; } };
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

/* Волна производительности: самотест (src/69_bench.js) гоняет главную по
   стадиям с подменёнными режимами, и первый кадр тяжёлого экрана в это
   время — замер не устройства, а теста. На время прогона автодетект молчит:
   track() не заказывает кадров, висящий замер снимается. */
test('hold: на время самотеста track молчит, висящий замер снят; после — мерит снова', () => {
  const e = env();
  e.api.track();
  assert.equal(e.frames.length, 1, 'предусловие: замер начался');
  e.api.hold(true);
  assert.equal(e.frames.length, 0, 'висящий замер снят');
  e.api.track('card');
  e.api.track('main');
  assert.equal(e.frames.length, 0, 'под самотестом кадров не заказано');
  assert.equal(e.api.samples().length, 0);
  e.api.hold(false);
  e.api.track('card');
  assert.equal(e.frames.length, 1, 'после самотеста замер снова идёт');
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

/* 1.1: четырёхъядерный ТВ пользователя (Philips 50PUS8057, deviceMemory не
   отдан) — теперь слабая приставка; замер на нём по-прежнему делается — он
   нужен лестнице повышения. */
test('weakHardware: четыре ядра без deviceMemory на android — слабое, замер идёт', () => {
  const e = env({ platform: { android: true }, hardware: { hardwareConcurrency: 4 } });
  assert.equal(e.api.weakHardware(), true);
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

/* ====================================================================== */
/* 1.1: слабая приставка — «Авто» стартует в «Лёгких»                     */
/* ====================================================================== */

const UA_TV = 'Mozilla/5.0 (Linux; Android 11; 50PUS8057/12; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/153.0.0.0 Mobile Safari/537.36';
const UA_PC = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';
/* ТВ пользователя: Lampa для Android, 4 ядра, 2 ГБ. */
const WEAK = { platform: { android: true }, hardware: { hardwareConcurrency: 4, deviceMemory: 2, userAgent: UA_TV } };
/* Прокрутить сессию: каждый элемент — [источник, мс]. */
function session(e, list) {
  for (const [src, ms] of list) { e.api.track(src); e.run(ms); }
}
/* Следующий запуск — новый модуль на том же Storage. */
function relaunch(e, extra) {
  return env(Object.assign({}, WEAK, { store: e.store }, extra || {}));
}

test('1.1 weakRule: платформа И слабое железо; память решает первой, без неё — ядра', () => {
  const r = P.weakRule;
  assert.deepEqual(r('android', 4, 2), { kind: 'android', cores: 4, gb: 2 }, 'ТВ пользователя: 4 ядра, 2 ГБ');
  assert.deepEqual(r('android', 4, 0), { kind: 'android', cores: 4, gb: 0 }, 'deviceMemory нет — 4 ядра считаем слабыми');
  assert.ok(r('tvbox', 8, 2), '2 ГБ при восьми ядрах — всё равно слабая');
  assert.ok(r('android', 8, 1));
  assert.ok(r('android', 2, 4), 'правило Task 40 (два ядра) осталось');
  assert.ok(r('philips', 4, 0));
  assert.equal(r('android', 8, 4), null, 'сильная приставка — как раньше');
  assert.equal(r('android', 4, 4), null, '4 ГБ известны — решает замер, как раньше');
  assert.equal(r('android', 6, 0), null, 'шесть ядер без памяти — не слабая');
  assert.equal(r('android', 0, 0), null, 'ничего не известно — как раньше');
  assert.equal(r('', 4, 2), null, 'компьютер: 4 ядра и 2 ГБ сами по себе ничего не значат');
  assert.equal(r('', 2, 1), null);
});

test('1.1 weakInfo: Lampa для Android, Android-приставка в браузере, Philips — да; ПК и телефон — нет', () => {
  assert.deepEqual(env(WEAK).api.weakInfo(), { kind: 'android', cores: 4, gb: 2 });
  assert.deepEqual(env({ platform: { browser: true }, tv: true, hardware: { hardwareConcurrency: 4, userAgent: UA_TV } }).api.weakInfo(),
    { kind: 'tvbox', cores: 4, gb: 0 }, 'приставка в браузере: Platform.tv() и Android в userAgent');
  assert.equal(env({ platform: { browser: true }, tv: false, hardware: { hardwareConcurrency: 4, deviceMemory: 2, userAgent: UA_TV } }).api.weakInfo(), null,
    'Android с сенсорным экраном (Platform.tv() ложно) — телефон, не приставка');
  assert.deepEqual(env({ platform: { philips: true }, hardware: { hardwareConcurrency: 4 } }).api.weakInfo(), { kind: 'philips', cores: 4, gb: 0 });
  assert.equal(env({ platform: { browser: true }, tv: false, hardware: { hardwareConcurrency: 4, deviceMemory: 8, userAgent: UA_PC } }).api.weakInfo(), null, 'ПК 4 ядра');
  assert.equal(env({ platform: { browser: true }, tv: false, hardware: { hardwareConcurrency: 4, userAgent: UA_PC } }).api.weakInfo(), null, 'ПК 4 ядра без deviceMemory');
  assert.equal(env({ platform: { browser: true }, tv: true, hardware: { hardwareConcurrency: 4, userAgent: UA_PC } }).api.weakInfo(), null,
    'Platform.tv() без Android в userAgent (Tizen/webOS, Apple TV) — не наше правило');
  assert.equal(env({ platform: { android: true }, hardware: { hardwareConcurrency: 8, deviceMemory: 4, userAgent: UA_TV } }).api.weakInfo(), null, 'сильная приставка');
});

test('1.1 mode: слабая приставка без замеров — lite, даже при старом вердикте full общей лестницы', () => {
  assert.equal(env(WEAK).api.mode(), 'lite', 'чистый профиль');
  assert.equal(env(Object.assign({}, WEAK, { store: { lumen_motion_auto: { mode: 'full', good: 0 } } })).api.mode(), 'lite',
    'старый full (медиана трёх первых экранов < 250 мс) полных на слабой приставке не оправдывает');
  assert.equal(env(Object.assign({}, WEAK, { store: { lumen_motion_weak: { cards: [], full: true } } })).api.mode(), 'full', 'заслуженные полные');
  assert.equal(env(Object.assign({}, WEAK, { store: { lumen_motion_weak: '{"cards":[],"full":true}' } })).api.mode(), 'full', 'JSON-строкой — тоже');
  assert.equal(env(Object.assign({}, WEAK, { store: { lumen_motion_weak: { full: true }, lumen_motion_auto: { mode: 'lite', good: 0 } } })).api.mode(), 'lite',
    'общая лестница понизила — лёгкие');
});

test('1.1 mode: сильная приставка и ПК — вердикт общей лестницы, как раньше', () => {
  const strong = { platform: { android: true }, hardware: { hardwareConcurrency: 8, deviceMemory: 4, userAgent: UA_TV } };
  const pc = { platform: { browser: true }, hardware: { hardwareConcurrency: 4, userAgent: UA_PC } };
  for (const base of [strong, pc]) {
    assert.equal(env(base).api.mode(), null);
    assert.equal(env(Object.assign({}, base, { store: { lumen_motion_auto: { mode: 'full', good: 0 } } })).api.mode(), 'full');
    assert.equal(env(Object.assign({}, base, { store: { lumen_motion_auto: { mode: 'lite', good: 0 } } })).api.mode(), 'lite');
  }
});

test('1.1 track: на сильной приставке и ПК лестница слабой приставки не ведётся', () => {
  const e = env({ platform: { android: true }, hardware: { hardwareConcurrency: 8, deviceMemory: 4, userAgent: UA_TV } });
  session(e, [['card', 80], ['card', 80], ['card', 80]]);
  assert.equal(Object.prototype.hasOwnProperty.call(e.store, 'lumen_motion_weak'), false);
  assert.deepEqual(e.store.lumen_motion_auto, { mode: 'full', good: 0 }, 'общая лестница — как раньше');
});

test('1.1 weakStep: p75 пяти карточек ниже 150 мс — повышение; иначе копим', () => {
  let cur = null;
  for (let i = 0; i < 4; i++) {
    cur = P.weakStep(cur, 100, 'lite');
    assert.equal(cur.full, false, 'карточка ' + (i + 1) + ' — ещё лёгкие');
  }
  assert.deepEqual(P.weakStep(cur, 100, 'lite'), { cards: [], full: true, stuck: false }, 'пятая — полные');
  /* p75 из пяти — четвёртая по росту: две медленные из пяти держат lite. */
  const slow = { cards: [100, 100, 100, 200], full: false, stuck: false };
  assert.equal(P.weakStep(slow, 200, 'lite').full, false, 'p75 = 200 мс — не повышаем');
  assert.equal(P.weakStep({ cards: [100, 100, 100, 149], full: false }, 149, 'lite').full, true, 'p75 149 — ниже порога');
  assert.equal(P.weakStep({ cards: [100, 100, 100, 150], full: false }, 150, 'lite').full, false, 'ровно 150 — не «заметно ниже»');
  /* Окно — последние десять: старые медленные карточки вытесняются. */
  let win = { cards: [400, 400, 400, 400, 400, 400, 400, 400, 400, 400], full: false };
  for (let i = 0; i < 7; i++) win = P.weakStep(win, 90, 'lite');
  assert.equal(win.full, false, 'в окне 7 быстрых и 3 медленных — p75 медленный');
  win = P.weakStep(win, 90, 'lite');
  assert.equal(win.full, true, '8 быстрых из 10 — p75 быстрый');
});

test('1.1 weakStep: замер не в том режиме не считается, stuck — навсегда', () => {
  assert.deepEqual(P.weakStep(null, 100, 'full'), { cards: [], full: false, stuck: false }, 'до повышения мерим только «Лёгкие»');
  assert.deepEqual(P.weakStep({ full: true }, 900, 'lite'), { cards: [], full: true, stuck: false }, 'после — только «Полные»');
  assert.deepEqual(P.weakStep({ stuck: true }, 50, 'lite'), { cards: [], full: false, stuck: true });
  assert.deepEqual(P.weakStep({ cards: [100] }, 42000, 'lite'), { cards: [100], full: false, stuck: false }, 'время в фоне — не замер');
});

test('1.1 weakStep: в «Полных» три карточки с p75 от 250 мс — назад в «Лёгкие» насовсем', () => {
  let cur = { cards: [], full: true, stuck: false };
  cur = P.weakStep(cur, 300, 'full');
  cur = P.weakStep(cur, 300, 'full');
  assert.equal(cur.full, true, 'двух мало');
  assert.deepEqual(P.weakStep(cur, 300, 'full'), { cards: [], full: false, stuck: true });
  assert.equal(P.weakStep({ cards: [200, 240], full: true }, 240, 'full').full, true, 'p75 240 — остаёмся в полных');
});

test('1.1 track: слабая приставка копит только замеры карточки, повышение — на пятой, через запуски', () => {
  let e = env(WEAK);
  session(e, [['main', 60], ['card', 100], ['card', 110]]);
  assert.deepEqual(e.store.lumen_motion_weak, { cards: [100, 110], full: false, stuck: false }, 'главная в лестницу не идёт');
  assert.equal(e.api.mode(), 'lite');
  assert.equal(e.applied.length, 0);

  e = relaunch(e);
  session(e, [['card', 120], ['hub', 90], ['card', 100]]);
  assert.deepEqual(e.store.lumen_motion_weak.cards, [100, 110, 120, 100], 'хаб тоже не идёт');
  assert.equal(e.api.mode(), 'lite', 'четыре карточки — ещё лёгкие');

  e = relaunch(e);
  session(e, [['card', 90]]);
  assert.deepEqual(e.store.lumen_motion_weak, { cards: [], full: true, stuck: false });
  assert.equal(e.api.mode(), 'full', 'пятая быстрая карточка — полные');
  assert.equal(e.applied.length, 1, 'режим перечитан на открытом экране');
  assert.equal(e.noty.length, 0, 'повышение молчит');
  assert.equal(e.api.why(), 'weak 4c/2gb android, earned');
});

test('1.1 track: слабая приставка на медленных карточках остаётся в «Лёгких»', () => {
  let e = env(WEAK);
  for (let run = 0; run < 4; run++) {
    session(e, [['card', 180], ['card', 200], ['card', 190]]);
    e = relaunch(e);
  }
  assert.equal(e.api.mode(), 'lite');
  assert.equal(e.store.lumen_motion_weak.full, false);
  assert.equal(e.store.lumen_motion_weak.cards.length, 10, 'окно — последние десять');
  assert.equal(e.api.why(), 'weak 4c/2gb android, cards 10/5');
});

test('1.1 track: заслуженные полные не тянет — назад в «Лёгкие» с уведомлением, и больше не повышается', () => {
  let e = env(Object.assign({}, WEAK, { store: { lumen_motion_weak: { cards: [], full: true, stuck: false } } }));
  assert.equal(e.api.mode(), 'full');
  session(e, [['card', 320], ['card', 300], ['card', 280]]);
  assert.deepEqual(e.store.lumen_motion_weak, { cards: [], full: false, stuck: true });
  assert.equal(e.api.mode(), 'lite');
  assert.equal(e.noty.length, 1);
  assert.ok(e.applied.length >= 1);
  e = relaunch(e);
  session(e, [['card', 50], ['card', 50], ['card', 50]]);
  e = relaunch(e);
  session(e, [['card', 50], ['card', 50], ['card', 50]]);
  assert.equal(e.api.mode(), 'lite', 'быстрые замеры в «Лёгких» после неудачи не повышают');
  assert.equal(e.api.why(), 'weak 4c/2gb android, held');
});

test('1.1 track: явный выбор на слабой приставке — замеров нет, лестница не двигается', () => {
  for (const mode of ['full', 'lite', 'off']) {
    const e = env(Object.assign({}, WEAK, { store: { lumen_motion: mode } }));
    session(e, [['card', 50], ['card', 50], ['card', 50]]);
    assert.equal(e.api.samples().length, 0, mode);
    assert.equal(Object.prototype.hasOwnProperty.call(e.store, 'lumen_motion_weak'), false, mode);
  }
});

/* Сквозная проверка с настоящим src/81_prefs.js: LC.motionMode и причина
   для HUD (LC.motionWhy) на слабой приставке, сильной, ПК и при явном
   выборе. */
function withPrefsLC(e) {
  new Function('LC', 'module', readFileSync(new URL('../src/81_prefs.js', import.meta.url), 'utf8'))(e.LC, { exports: null, lumen: false });
  e.LC.perf = e.api;
  return e.LC;
}

test('1.1 LC.motionMode/motionWhy: слабая приставка — auto:lite с причиной; явный выбор не перебивается', () => {
  let LC = withPrefsLC(env(WEAK));
  assert.equal(LC.motionMode(), 'lite');
  assert.equal(LC.motionWhy(), 'auto:lite (weak 4c/2gb android, cards 0/5)');

  LC = withPrefsLC(env({ platform: { browser: true }, tv: true, hardware: { hardwareConcurrency: 4, userAgent: UA_TV } }));
  assert.equal(LC.motionWhy(), 'auto:lite (weak 4c/n/a tvbox, cards 0/5)', 'без deviceMemory');

  for (const mode of ['full', 'lite', 'off']) {
    LC = withPrefsLC(env(Object.assign({}, WEAK, { store: { lumen_motion: mode } })));
    assert.equal(LC.motionMode(), mode, 'явный выбор на слабой приставке: ' + mode);
    assert.equal(LC.motionWhy(), 'set:' + mode);
  }

  LC = withPrefsLC(env(Object.assign({}, WEAK, { store: { lumen_motion_weak: { full: true } } })));
  assert.equal(LC.motionMode(), 'full');
  assert.equal(LC.motionWhy(), 'auto:full (weak 4c/2gb android, earned)');
});

test('1.1 LC.motionMode/motionWhy: сильная приставка и ПК — как раньше', () => {
  let LC = withPrefsLC(env({ platform: { android: true }, hardware: { hardwareConcurrency: 8, deviceMemory: 4, userAgent: UA_TV } }));
  assert.equal(LC.motionMode(), 'full');
  assert.equal(LC.motionWhy(), 'auto:full (no verdict)');

  LC = withPrefsLC(env({ platform: { browser: true }, hardware: { hardwareConcurrency: 4, userAgent: UA_PC } }));
  assert.equal(LC.motionMode(), 'full', 'ПК 4 ядра — полные, как раньше');

  LC = withPrefsLC(env({ platform: { browser: true }, hardware: { hardwareConcurrency: 4, userAgent: UA_PC }, store: { lumen_motion_auto: { mode: 'lite', good: 2 } } }));
  assert.equal(LC.motionMode(), 'lite', 'ПК, понижённый замерами, — как раньше');
  assert.equal(LC.motionWhy(), 'auto:lite (slow 2/5)');

  LC = withPrefsLC(env({ platform: { webos: true }, hardware: { hardwareConcurrency: 4 } }));
  assert.equal(LC.motionWhy(), 'auto:lite (webos)');
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const u = load('10_util.js');
test('fmtTime: часы → HH:MM, иначе MM:SS', () => {
  assert.equal(u.fmtTime(4320), '01:12');
  assert.equal(u.fmtTime(1120), '18:40');
  assert.equal(u.fmtTime(0), '00:00');
  assert.equal(u.fmtTime(-5), '00:00');
});
test('fmtRuntime', () => { assert.equal(u.fmtRuntime(166, 'мин'), '2:46'); assert.equal(u.fmtRuntime(48, 'мин'), '48 мин'); assert.equal(u.fmtRuntime(0, 'мин'), ''); });
test('plural ru', () => { assert.equal(u.plural(1, ['сезон','сезона','сезонов']), 'сезон'); assert.equal(u.plural(3, ['сезон','сезона','сезонов']), 'сезона'); assert.equal(u.plural(11, ['сезон','сезона','сезонов']), 'сезонов'); assert.equal(u.plural(22, ['серия','серии','серий']), 'серии'); });
test('initials', () => { assert.equal(u.initials('Тимоти Шаламе'), 'ТШ'); assert.equal(u.initials('Zendaya'), 'Z'); assert.equal(u.initials(''), '?'); });
test('esc', () => assert.equal(u.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;'));
test('esc: апостроф -> &#39;', () => assert.equal(u.esc("it's a 'test'"), 'it&#39;s a &#39;test&#39;'));
test('each/map/filter/find', () => {
  assert.deepEqual(u.map([1,2,3], x => x * 2), [2,4,6]);
  assert.deepEqual(u.filter([1,2,3], x => x > 1), [2,3]);
  assert.equal(u.find([1,2,3], x => x === 2), 2);
  assert.equal(u.find([1,2,3], x => x === 9), null);
  let n = 0; u.each(null, () => n++); assert.equal(n, 0);
});

/* Task 5c: календарная разница дней до даты 'YYYY-MM-DD' — без сдвига часового
   пояса (строка не разбирается через new Date(str), который считает её UTC). */
test('daysUntil: календарные дни от локальной даты now, час не важен', () => {
  assert.equal(u.daysUntil('2026-12-17', new Date(2026, 10, 16, 23, 50)), 31);
  assert.equal(u.daysUntil('2026-12-17', new Date(2026, 10, 16, 0, 5)), 31);
  assert.equal(u.daysUntil('2026-11-16', new Date(2026, 10, 16, 0, 1)), 0);
  assert.equal(u.daysUntil('2026-11-15', new Date(2026, 10, 16, 12, 0)), -1);
});

test('daysUntil: now числом (мс), переход года и переход на летнее время', () => {
  assert.equal(u.daysUntil('2026-11-17', new Date(2026, 10, 16, 12).getTime()), 1);
  assert.equal(u.daysUntil('2027-01-01', new Date(2026, 11, 31, 23, 59)), 1);
  assert.equal(u.daysUntil('2026-03-30', new Date(2026, 2, 28, 12)), 2);
});

test('daysUntil: пусто/мусор/несуществующий месяц -> null', () => {
  const now = new Date(2026, 10, 16);
  assert.equal(u.daysUntil('', now), null);
  assert.equal(u.daysUntil(null, now), null);
  assert.equal(u.daysUntil(undefined, now), null);
  assert.equal(u.daysUntil('abc', now), null);
  assert.equal(u.daysUntil('2026-13-01', now), null);
  assert.equal(u.daysUntil('2026-12-00', now), null);
});

/* --- gate: общий сборщик N параллельных ответов с дедлайном --- */

/* Ручной планировщик: тест сам решает, когда сработает таймер дедлайна.
   Подменяется globalThis.setTimeout, потому что util.js читает его по
   вызову (модуль загружается через new Function, без замыкания на таймеры). */
function withFakeTimers(fn) {
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  const timers = [];
  globalThis.setTimeout = (cb, ms) => { timers.push({ cb, ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; };
  try {
    return fn({
      timers,
      fire: (i) => { const t = timers[i || 0]; if (t && !t.cleared) t.cb(); }
    });
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
}

test('gate: finish(false) после total тиков, ровно один раз', () => {
  withFakeTimers(() => {
    const calls = [];
    const g = u.gate(2, 1000, (partial) => calls.push(partial));
    g.tick();
    assert.deepEqual(calls, [], 'один ответ из двух — ещё рано');
    g.tick();
    assert.deepEqual(calls, [false], 'все ответы пришли — полный результат');
    g.tick();
    assert.deepEqual(calls, [false], 'лишний тик второго finish не даёт');
  });
});

test('gate: дедлайн отдаёт частичный результат и гасит поздние тики', () => {
  withFakeTimers((ctl) => {
    const calls = [];
    const g = u.gate(3, 1500, (partial) => calls.push(partial));
    g.tick();
    assert.equal(ctl.timers[0].ms, 1500, 'таймер поставлен на переданный дедлайн');
    ctl.fire(0);
    assert.deepEqual(calls, [true], 'дедлайн — частичный результат');
    g.tick(); g.tick();
    assert.deepEqual(calls, [true], 'поздние ответы второго finish не дают');
  });
});

test('gate: полный результат снимает таймер дедлайна', () => {
  withFakeTimers((ctl) => {
    const calls = [];
    const g = u.gate(1, 1000, (partial) => calls.push(partial));
    g.tick();
    assert.deepEqual(calls, [false]);
    assert.equal(ctl.timers[0].cleared, true, 'таймер снят — он уже не нужен');
    ctl.fire(0);
    assert.deepEqual(calls, [false], 'снятый таймер finish не зовёт');
  });
});

test('gate: cancel запрещает finish и снимает таймер', () => {
  withFakeTimers((ctl) => {
    const calls = [];
    const g = u.gate(2, 1000, (partial) => calls.push(partial));
    g.cancel();
    assert.equal(ctl.timers[0].cleared, true);
    g.tick(); g.tick();
    ctl.fire(0);
    assert.deepEqual(calls, [], 'после cancel finish не зовётся никогда');
  });
});

test('gate: cancel сообщает, успел ли он закрыть сборщик', () => {
  withFakeTimers(() => {
    const g = u.gate(2, 1000, () => {});
    assert.equal(g.cancel(), true, 'первый cancel закрыл открытый сборщик');
    assert.equal(g.cancel(), false, 'повторный cancel закрывать уже нечего');
    const g2 = u.gate(1, 1000, () => {});
    g2.tick();
    assert.equal(g2.cancel(), false, 'после finish cancel возвращает false');
  });
});

test('gate: total <= 0 — finish(false) сразу, таймер не ставится', () => {
  withFakeTimers((ctl) => {
    const calls = [];
    u.gate(0, 1000, (partial) => calls.push(partial));
    assert.deepEqual(calls, [false]);
    assert.equal(ctl.timers.length, 0);
  });
});

test('gate: timeout <= 0 — без дедлайна, только по тикам', () => {
  withFakeTimers((ctl) => {
    const calls = [];
    const g = u.gate(2, 0, (partial) => calls.push(partial));
    assert.equal(ctl.timers.length, 0, 'таймер не ставится');
    g.tick(); g.tick();
    assert.deepEqual(calls, [false]);
  });
});

/* ====================================================================== */
/* Task 39: размеры картинок TMDB по физическим пикселям.                 */
/* ====================================================================== */

/* window в этом файле не нужен ни одному другому тесту, поэтому он
   ставится только на время вызова и снимается сразу. */
function withScreen(props, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  const prevLampa = globalThis.Lampa;
  globalThis.window = props;
  /* Модуль пишет window.Lampa && Lampa.Storage — второе обращение идёт к
     глобали, как и во всём плагине (в браузере это один объект). */
  if (props.Lampa) globalThis.Lampa = props.Lampa;
  try { return fn(); } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
    if (prevLampa === undefined) delete globalThis.Lampa; else globalThis.Lampa = prevLampa;
  }
}

test('screenPx: ширина окна × DPR, потолок DPR — 2', () => {
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 1 }, () => u.screenPx()), 1920);
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 2 }, () => u.screenPx()), 3840);
  assert.equal(withScreen({ innerWidth: 960, devicePixelRatio: 2 }, () => u.screenPx()), 1920,
    'Android TV с половинной CSS-шириной даёт те же физические 1920');
  assert.equal(withScreen({ innerWidth: 1280, devicePixelRatio: 3 }, () => u.screenPx()), 2560,
    'DPR 3 считается как 2: выше original у TMDB ничего нет');
});

test('screenPx: нет devicePixelRatio или ширины — без падения', () => {
  assert.equal(withScreen({ innerWidth: 1920 }, () => u.screenPx()), 1920, 'нет DPR — как DPR 1');
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 0 }, () => u.screenPx()), 1920);
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 'x' }, () => u.screenPx()), 1920);
  assert.equal(withScreen({}, () => u.screenPx()), 0, 'ширины нет — 0');
});

test('screenPx: window вовсе нет (тестовая среда) — 0, а не исключение', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  if (had) delete globalThis.window;
  try { assert.equal(u.screenPx(), 0); } finally { if (had) globalThis.window = prev; }
});

test('emPx: доля экрана по базе em Lampa (innerWidth / 84.17)', () => {
  /* Карточка ряда — 11.4em, то есть 260 px на экране 1920 (src/30_css.js). */
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 1 }, () => u.emPx(11.4)), 260);
  assert.equal(withScreen({ innerWidth: 960, devicePixelRatio: 2 }, () => u.emPx(11.4)), 260,
    'половинная CSS-ширина при DPR 2 даёт ту же физическую ширину элемента');
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 2 }, () => u.emPx(11.4)), 520);
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 1 }, () => u.emPx(0)), 0);
});

/* Ревью Task 39 (п.3): базу em умножают ДВЕ настройки — «Размер интерфейса»
   самой Lampa (она входит в кегль body) и масштаб интерфейса плагина
   (lumen_scale, его таблица стилей вешает на свои корни). */
test('baseEm/emPx: «Размер интерфейса» Lampa входит в базу em', () => {
  const withSize = (size) => withScreen({
    innerWidth: 1920,
    devicePixelRatio: 1,
    Lampa: { Storage: { field: () => size } }
  }, () => u.baseEm());
  assert.equal(Math.round(withSize('normal') * 100) / 100, 22.81);
  assert.equal(Math.round(withSize('bigger') * 100) / 100, 23.95, 'крупнее: ×1.05');
  assert.equal(Math.round(withSize('small') * 100) / 100, 20.53, 'мельче: ×0.9');
  assert.equal(Math.round(withSize(undefined) * 100) / 100, 22.81, 'настройки нет — как normal');
  /* Пол 10.6 px — из той же формулы Lampa. */
  assert.equal(withScreen({ innerWidth: 200, devicePixelRatio: 1 }, () => u.baseEm()), 10.6);
});

test('emPx: масштаб интерфейса плагина умножает ширину элемента', () => {
  const screen = { innerWidth: 1920, devicePixelRatio: 1 };
  /* Барабан рулетки — 9.2em: 210 px при обычном масштабе и 265 при «ещё
     крупнее» вместе с «Размер интерфейса: крупнее». */
  assert.equal(withScreen(screen, () => u.emPx(9.2, 1)), 210);
  assert.equal(withScreen(screen, () => u.emPx(9.2, 1.2)), 252);
  assert.equal(withScreen({
    innerWidth: 1920, devicePixelRatio: 1,
    Lampa: { Storage: { field: () => 'bigger' } }
  }, () => u.emPx(9.2, 1.2)), 264);
  /* Явная единица перебивает LC.uiScale — это нужно логотипу героя. */
  assert.equal(withScreen(screen, () => u.emPx(9.2, 0)), 210, 'мусор вместо масштаба — единица');
});

test('emPx: без LC.uiScale (модуль стилей не загружен) масштаб — единица', () => {
  assert.equal(withScreen({ innerWidth: 1920, devicePixelRatio: 1 }, () => u.emPx(9.2)), 210);
});

test('posterSize: наименьший размер TMDB с допуском 15%', () => {
  assert.equal(u.posterSize(0), 'w185', 'ширина неизвестна — самый дешёвый');
  assert.equal(u.posterSize(130), 'w185', 'постер коллажа хаба на экране 1920');
  assert.equal(u.posterSize(180), 'w185', 'постер франшизы на экране 1920');
  assert.equal(u.posterSize(210), 'w185', 'барабан рулетки: апскейл 1.14 — в допуске');
  assert.equal(u.posterSize(260), 'w342', 'карточка ряда при DPR 2');
  assert.equal(u.posterSize(282), 'w342', 'карточка сетки хаба на экране 1920');
  assert.equal(u.posterSize(420), 'w500', 'барабан при DPR 2');
  assert.equal(u.posterSize(564), 'w500', 'карточка сетки хаба при DPR 2');
  assert.equal(u.posterSize(700), 'w780');
  assert.equal(u.posterSize(5000), 'w780', 'потолок: original постера плагину не нужен');
});

/* Ревью Task 39 (п.1): у кадров тот же допуск 15%, что у постеров, — на
   1920 физических пикселях w1280 растягивается в полтора раза, и это
   заметно. */
test('frameSize: кадр, который смотрят, — original уже на Full HD', () => {
  assert.equal(u.frameSize(0), 'w1280', 'ширина неизвестна — дешёвый кадр');
  assert.equal(u.frameSize(1280), 'w1280');
  assert.equal(u.frameSize(1366), 'w1280', 'узкое окно ТВ-браузера — w1280 по пикселю');
  assert.equal(u.frameSize(1505), 'w1280', 'граница допуска: 1505 × 0.85 = 1279');
  assert.equal(u.frameSize(1506), 'original');
  assert.equal(u.frameSize(1920), 'original', 'Full HD: полуторный апскейл виден');
  assert.equal(u.frameSize(3840), 'original');
});

/* Ревью Task 39 (п.1): кадр-подложка (фон результата рулетки, opacity .22)
   в original не уходит никогда — его не рассматривают. */
test('scrimSize: кадр-подложка с потолком w1280', () => {
  assert.equal(u.scrimSize(0), 'w780', 'ширина неизвестна — дешёвый');
  assert.equal(u.scrimSize(780), 'w780');
  assert.equal(u.scrimSize(1920), 'w1280');
  assert.equal(u.scrimSize(3840), 'w1280', 'потолок: original под четвертью прозрачности не нужен');
});

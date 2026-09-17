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

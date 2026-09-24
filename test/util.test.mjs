import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';
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
  /* 9.2em: 210 px при обычном масштабе и 264 при «огромном» вместе с
     «Размер интерфейса: крупнее». */
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

/* Task 44: барабан рулетки задан долей ВЫСОТЫ окна (.lumen-roulette__reel,
   src/30_css.js) — так он помещается на экране при любом «Размере
   интерфейса» и любом масштабе плагина, которые оба умножают em. */
test('vhPx: доля высоты окна × DPR, ни «Размер интерфейса», ни масштаб в неё не входят', () => {
  assert.equal(withScreen({ innerHeight: 1080, devicePixelRatio: 1 }, () => u.vhPx(28.67)), 310);
  assert.equal(withScreen({ innerHeight: 540, devicePixelRatio: 2 }, () => u.vhPx(28.67)), 310,
    'половинная CSS-высота при DPR 2 даёт ту же физическую ширину барабана');
  assert.equal(withScreen({ innerHeight: 1080, devicePixelRatio: 3 }, () => u.vhPx(28.67)), 619,
    'потолок DPR тот же, что у screenPx/emPx');
  assert.equal(withScreen({
    innerHeight: 1080, devicePixelRatio: 1,
    Lampa: { Storage: { field: () => 'bigger' } }
  }, () => u.vhPx(28.67)), 310, '«Размер интерфейса» Lampa долю экрана не двигает');
  assert.equal(withScreen({ innerHeight: 1080, devicePixelRatio: 1 }, () => u.vhPx(0)), 0);
  assert.equal(withScreen({ devicePixelRatio: 1 }, () => u.vhPx(28.67)), 0, 'высоты нет — 0');
});

/* Task 68: emScreen — ширина экрана в em корня плагина, то есть в тех же
   единицах, которыми написаны ширины хаба и сетки подборки. Прежде на их
   месте стоял литерал 84.17, верный ровно при «обычном» размере интерфейса
   Lampa и масштабе плагина 1; из-за него плитка хаба считалась неверно от
   −19.4 % до +32.9 % (замер 2026-09-22, см. tileEm в src/46_hub.js). */
test('Task 68: emScreen учитывает размер интерфейса Lampa, пол кегля и масштаб плагина', () => {
  const em = (props, scale) => {
    const mod = loadCtx('10_util.js', { uiScale: () => scale }).api;
    return +withScreen(props, () => mod.emScreen()).toFixed(2);
  };
  const size = (v) => ({ Lampa: { Storage: { field: (n) => (n === 'interface_size' ? v : '') } } });
  const at = (w, v) => Object.assign({ innerWidth: w, devicePixelRatio: 1 }, size(v));

  assert.equal(em(at(1920, 'normal'), 1), 84.17, 'литерал Lampa верен ровно здесь');
  assert.equal(em(at(960, 'normal'), 1), 84.17, 'ширина окна сокращается — экран всегда 84.17 базовых em');
  assert.equal(em(at(1920, 'bigger'), 1), 80.16, '84.17 / 1.05');
  assert.equal(em(at(1920, 'small'), 1), 93.52, '84.17 / 0.9');
  assert.equal(em(at(960, 'small'), 1), 90.57,
    'пол кегля Lampa 10.6 px: 960 / 84.17 × 0.9 = 10.26 поднимается до 10.6, и в экран входит 90.57 em, а не 93.52');

  assert.equal(em(at(1920, 'normal'), 1.2), 70.14,
    'масштаб плагина делает em дороже — их в экране становится МЕНЬШЕ (прежняя формула ошибалась знаком)');
  assert.equal(em(at(1920, 'normal'), 0.9), 93.52);
  assert.equal(em(at(1920, 'bigger'), 1.2), 66.8, 'оба множителя разом');
});

/* Долг раздела D плана lumen-final: пороги раскладки в src/30_css.js
   (screenEm) считали экран как 84.17 / k без пола кегля. Теперь они берут
   число здесь — у того же baseEm, что и emScreen, но без масштаба плагина:
   медиазапросы считают em от кегля body, а не от нашего корня. */
test('screenBaseEm: базовые em экрана с полом кегля, без масштаба плагина', () => {
  const em = (props, scale) => {
    const mod = loadCtx('10_util.js', { uiScale: () => scale }).api;
    return +withScreen(props, () => mod.screenBaseEm()).toFixed(2);
  };
  const size = (v) => ({ Lampa: { Storage: { field: (n) => (n === 'interface_size' ? v : '') } } });
  const at = (w, v) => Object.assign({ innerWidth: w, devicePixelRatio: 1 }, size(v));

  assert.equal(em(at(960, 'normal'), 1), 84.17, '«обычный» при 960 px — пол не действует, у пользователя ничего не сдвигается');
  assert.equal(em(at(960, 'bigger'), 1), 80.16);
  assert.equal(em(at(1920, 'small'), 1), 93.52, 'широкое окно — пола нет');
  assert.equal(em(at(960, 'small'), 1), 90.57, '«мельче» при 960 px — пол 10.6 px, в экране 960 / 10.6 em');
  assert.equal(em(at(960, 'small'), 1.2), 90.57, 'масштаб плагина сюда не входит');
  assert.equal(em(size('small'), 1), 93.52, 'окна нет — пол недостижим, 84.17 / k');
});

test('emScreen: ширины окна нет — 0, а не исключение', () => {
  assert.equal(withScreen({ devicePixelRatio: 1 }, () => u.emScreen()), 0);
});

test('vhPx: window вовсе нет (тестовая среда) — 0, а не исключение', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  if (had) delete globalThis.window;
  try { assert.equal(u.vhPx(28.67), 0); } finally { if (had) globalThis.window = prev; }
});

/* Task 68: у постера свой допуск (FIT_POSTER = 0.9, разбор — у самой
   константы в src/10_util.js), и растяжение больше чем в 1.111 раза ему
   теперь запрещено. Прежние 0.85 разрешали 1.176 и давали на живом стенде
   растяжение в 1.17 на постере ряда франшизы (216 физических пикселей из
   w185 при масштабе плагина «огромный»). */
test('posterSize: наименьший размер TMDB с допуском 11%', () => {
  assert.equal(u.posterSize(0), 'w185', 'ширина неизвестна — самый дешёвый');
  assert.equal(u.posterSize(130), 'w185', 'кадр серии на экране 1920');
  assert.equal(u.posterSize(180), 'w185', 'постер франшизы на экране 1920');
  assert.equal(u.posterSize(260), 'w342', 'карточка ряда при DPR 2');
  assert.equal(u.posterSize(282), 'w342', 'карточка сетки хаба на экране 1920');
  assert.equal(u.posterSize(420), 'w500', 'барабан при DPR 2');
  assert.equal(u.posterSize(564), 'w780',
    'Task 68: при допуске 0.85 здесь брался w500 с растяжением 1.13. Живого элемента такой ширины у плагина нет — карточка сетки хаба по замеру 2026-09-22 выходит 262-285 px, а не 564, как считала прежняя формула GCARD_EM');
  assert.equal(u.posterSize(700), 'w780');
  assert.equal(u.posterSize(5000), 'w780', 'потолок: original постера плагину не нужен');
});

/* Сторож допуска: вернуть 0.85 — значит снова показывать постер ряда
   франшизы, растянутый в 1.17 раза (замер 2026-09-22, масштаб плагина
   «огромный»). Границы взяты точным счётом, а не на глаз: 185 / 0.9 =
   205.6, значит 205 — последняя ширина, которой хватает w185, а 206 обязана
   уйти на w342. */
test('Task 68: постер не растягиваем больше чем в 1.111 раза', () => {
  assert.equal(u.posterSize(205), 'w185', 'граница допуска: 205 / 185 = 1.108');
  assert.equal(
    u.posterSize(208), 'w342',
    'постер франшизы при «крупнее» + «крупнее»: при допуске 0.85 здесь был бы w185 с растяжением 1.12'
  );
  assert.equal(
    u.posterSize(216), 'w342',
    'постер франшизы при масштабе «огромный»: самая растянутая клетка замера, 1.17 при допуске 0.85'
  );
  /* Другой край: туже брать нельзя по цене. Обе ширины — экран 1920 CSS px
     при DPR 2 (не целевой, но живой). Допуск 0.95 увёл бы карточку сетки на
     w780, то есть 3.48 МБ растра вместо 1.43 при 15 карточках на экране. */
  assert.equal(u.posterSize(360), 'w342', 'постер франшизы на плотном экране: растяжение 1.05 дешевле ступени');
  assert.equal(u.posterSize(553), 'w500', 'карточка сетки подборки на плотном экране: растяжение 1.11 — ровно в допуске');
});

/* Task 47: порог кадра поднят с 1280 на 1920 физических пикселей. На 1080p
   w1280 растягивается в полтора раза — осознанная плата за память: original
   у TMDB обычно 3840×2160, это 31.6 МБ RGBA против 3.7 у w1280 (замер
   координатора 2026-09-21 на Philips 50PUS8057, 960×540@2). Допуск FIT
   прежний, 0.85. */
test('frameSize: original — только выше 1080p', () => {
  assert.equal(u.frameSize(0), 'w1280', 'ширина неизвестна — дешёвый кадр');
  assert.equal(u.frameSize(1280), 'w1280');
  assert.equal(u.frameSize(1366), 'w1280', 'узкое окно ТВ-браузера');
  assert.equal(u.frameSize(1920), 'w1280', 'Full HD: платим апскейлом за память');
  assert.equal(u.frameSize(2258), 'w1280', 'граница допуска: 2258 × 0.85 = 1919.3');
  assert.equal(u.frameSize(2259), 'original', '2259 × 0.85 = 1920.15 — выше 1080p');
  assert.equal(u.frameSize(3840), 'original', 'честное 4K-окно');
});

/* Ревью Task 39 (п.1): кадр-подложка (фон результата рулетки, opacity .22)
   в original не уходит никогда — его не рассматривают. */
test('scrimSize: кадр с потолком w1280 вместо original', () => {
  assert.equal(u.scrimSize(0), 'w780', 'ширина неизвестна — дешёвый');
  assert.equal(u.scrimSize(780), 'w780');
  assert.equal(u.scrimSize(1920), 'w1280');
  assert.equal(u.scrimSize(3840), 'w1280', 'потолок: original TMDB — 31.6 МБ растра на слой, на 2 ГБ памяти это не окупается');
});

/* Ревью волны 1b, п.2: «поверх экрана открыто то, под чем ролик никто не
   увидит». Набор — как у самой Lampa в Controller.toContent (app.min.js:
   46510-46536): классы body settings--open, selectbox--open и search--open
   (поиск из шапки, open$3 — :41513-41514, поверх главной) и узлы .modal /
   .youtube-player в body (модал — :32415, YouTube Lampa — :53323-53324;
   оба удаляются на закрытии). .player — плеер, его отвечает playerOpen. */
function withDocument(classes, found, fn) {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const prev = globalThis.document;
  const asked = [];
  globalThis.document = {
    body: { classList: { contains: (c) => classes.indexOf(c) !== -1 } },
    /* Как у DOM: первый узел, подходящий под любой селектор списка. */
    querySelector: (sel) => {
      asked.push(sel);
      const parts = sel.split(',').map((s) => s.trim());
      return parts.some((p) => found.indexOf(p) !== -1) ? {} : null;
    }
  };
  try { return fn(asked); } finally { if (had) globalThis.document = prev; else delete globalThis.document; }
}

test('overlayOpen: настройки, список выбора и поиск Lampa — классы body', () => {
  for (const cls of ['settings--open', 'selectbox--open', 'search--open']) {
    withDocument([cls], [], () => assert.equal(u.overlayOpen(), true, cls));
  }
  withDocument(['ambience--enable', 'menu--open', 'light--version'], [], () => {
    assert.equal(u.overlayOpen(), false, 'прочие классы body оверлеем не считаются');
  });
});

test('overlayOpen: модальное окно и YouTube-плеер Lampa — узлы в документе', () => {
  withDocument([], ['.modal'], () => assert.equal(u.overlayOpen(), true, '.modal'));
  withDocument([], ['.youtube-player'], () => assert.equal(u.overlayOpen(), true, '.youtube-player'));
  withDocument([], [], (asked) => {
    assert.equal(u.overlayOpen(), false, 'ни класса, ни узла');
    assert.ok(asked.length > 0, 'узлы спрашиваются у документа');
  });
});

test('overlayOpen: нет document, body или querySelector — «не открыт», без исключения', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'document');
  const prev = globalThis.document;
  try {
    delete globalThis.document;
    assert.equal(u.overlayOpen(), false);
    globalThis.document = {};
    assert.equal(u.overlayOpen(), false);
    globalThis.document = { body: { classList: { contains: () => false } } };
    assert.equal(u.overlayOpen(), false, 'без querySelector (тестовые окружения модулей)');
    globalThis.document = { body: { classList: { contains: () => false } }, querySelector: () => { throw new Error('boom'); } };
    assert.equal(u.overlayOpen(), false);
  } finally { if (had) globalThis.document = prev; else delete globalThis.document; }
});

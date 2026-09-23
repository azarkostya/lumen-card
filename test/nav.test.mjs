import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY, fakeQuery, toEl } from './_fakedom.mjs';
import { load } from './_load.mjs';

const M = load('64_nav.js');

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/64_nav.js', import.meta.url), 'utf8');
const UTIL = load('10_util.js');

/* ---------------------------------------------------------------------- */
/* holdTracker — автомат удержания клавиши.                                */
/*                                                                        */
/* Вход — события Lampa.Keypad ({code} → key) в виде {key, type, t}.       */
/* Выход — состояние {key, holding, repeats, since, fast}.                 */
/* ---------------------------------------------------------------------- */

/* Удобная подача серии повторов одной клавиши. */
function hold(tracker, key, times, step, start) {
  let t = start;
  let state = null;
  for (let i = 0; i < times; i++) {
    state = tracker.feed({ key: key, type: 'down', t: t });
    t += step;
  }
  return state;
}

test('holdTracker: первое нажатие — удержание началось, повторов один', () => {
  const tr = M.holdTracker();
  const s = tr.feed({ key: 40, type: 'down', t: 1000 });
  assert.equal(s.key, 40);
  assert.equal(s.holding, true);
  assert.equal(s.repeats, 1);
  assert.equal(s.since, 1000);
  assert.equal(s.fast, false);
});

test('holdTracker: шесть повторов в пределах окна — ускорение включилось', () => {
  const tr = M.holdTracker();
  /* Автоповтор Lampa шлёт keydown не чаще раза в 100 мс (Keypad.keydownTrigger). */
  assert.equal(hold(tr, 39, 5, 100, 0).fast, false);
  const six = tr.feed({ key: 39, type: 'down', t: 500 });
  assert.equal(six.repeats, 6);
  assert.equal(six.fast, true);
});

test('holdTracker: ускорение держится, пока клавишу не отпустили', () => {
  const tr = M.holdTracker();
  hold(tr, 39, 6, 100, 0);
  assert.equal(tr.feed({ key: 39, type: 'down', t: 600 }).fast, true);
  const up = tr.feed({ key: 39, type: 'up', t: 700 });
  assert.equal(up.fast, false);
  assert.equal(up.holding, false);
  assert.equal(up.repeats, 0);
  assert.equal(up.key, 0);
});

test('holdTracker: редкие нажатия ускорением не считаются — окно перезапускается', () => {
  const tr = M.holdTracker();
  /* Человек жмёт «вниз» раз в 400 мс: шесть нажатий, но это не удержание. */
  const s = hold(tr, 40, 6, 400, 0);
  assert.equal(s.fast, false);
  assert.equal(s.repeats, 1);
});

test('holdTracker: другая клавиша начинает счёт заново', () => {
  const tr = M.holdTracker();
  hold(tr, 39, 6, 100, 0);
  const other = tr.feed({ key: 37, type: 'down', t: 620 });
  assert.equal(other.key, 37);
  assert.equal(other.repeats, 1);
  assert.equal(other.fast, false);
});

test('holdTracker: отпускание чужой клавиши состояние не рушит', () => {
  const tr = M.holdTracker();
  hold(tr, 40, 3, 100, 0);
  const s = tr.feed({ key: 39, type: 'up', t: 250 });
  assert.equal(s.key, 40);
  assert.equal(s.holding, true);
  assert.equal(s.repeats, 3);
});

test('holdTracker: сколько удерживают и сброс', () => {
  const tr = M.holdTracker();
  tr.feed({ key: 40, type: 'down', t: 1000 });
  assert.equal(tr.heldFor(1500), 500);
  tr.reset();
  assert.equal(tr.state().holding, false);
  assert.equal(tr.heldFor(1500), 0);
});

test('holdTracker: мусорное событие ничего не меняет', () => {
  const tr = M.holdTracker();
  tr.feed({ key: 40, type: 'down', t: 1000 });
  const s = tr.feed(null);
  assert.equal(s.key, 40);
  assert.equal(s.repeats, 1);
});

/* ---------------------------------------------------------------------- */
/* minimapModel — окно рядов вокруг активного.                             */
/* ---------------------------------------------------------------------- */

const titles = (n) => Array.from({ length: n }, (_, i) => 'Ряд ' + (i + 1));

test('minimapModel: коротких списков окно не касается', () => {
  const m = M.minimapModel(titles(5), 2);
  assert.equal(m.total, 5);
  assert.equal(m.active, 2);
  assert.equal(m.from, 0);
  assert.equal(m.to, 4);
  assert.equal(m.items.length, 5);
  assert.deepEqual(m.items.map((i) => i.active), [false, false, true, false, false]);
  assert.deepEqual(m.items.map((i) => i.index), [0, 1, 2, 3, 4]);
});

test('minimapModel: девять рядов показываются целиком (design-spec-main §0.16)', () => {
  const m = M.minimapModel(titles(9), 8);
  assert.equal(m.items.length, 9);
  assert.equal(m.from, 0);
});

test('minimapModel: больше девяти — окно из семи вокруг активного', () => {
  const m = M.minimapModel(titles(12), 6);
  assert.equal(m.items.length, 7);
  assert.equal(m.from, 3);
  assert.equal(m.to, 9);
  assert.equal(m.items[3].active, true);
  assert.equal(m.items[3].title, 'Ряд 7');
});

test('minimapModel: у краёв окно прижимается, а не выходит за список', () => {
  const head = M.minimapModel(titles(12), 0);
  assert.equal(head.from, 0);
  assert.equal(head.to, 6);
  const tail = M.minimapModel(titles(12), 11);
  assert.equal(tail.from, 5);
  assert.equal(tail.to, 11);
  assert.equal(tail.items[6].active, true);
});

test('minimapModel: активного ряда нет — окно с начала, подсветки нет', () => {
  const m = M.minimapModel(titles(12), -1);
  assert.equal(m.active, -1);
  assert.equal(m.from, 0);
  assert.equal(m.items.length, 7);
  assert.equal(m.items.some((i) => i.active), false);
});

test('minimapModel: индекс за пределами списка — как будто его нет', () => {
  const m = M.minimapModel(titles(4), 9);
  assert.equal(m.active, -1);
  assert.equal(m.items.length, 4);
});

test('minimapModel: безымянный ряд получает номер, пустой список — null', () => {
  const m = M.minimapModel(['Новинки', '   ', ''], 0);
  assert.equal(m.items[1].title, 'Ряд 2');
  assert.equal(m.items[2].title, 'Ряд 3');
  assert.equal(M.minimapModel([], 0), null);
  assert.equal(M.minimapModel(null, 0), null);
});

/* ---------------------------------------------------------------------- */
/* searchCollections — поиск подборок по названию и id.                    */
/* ---------------------------------------------------------------------- */

const COLLECTIONS = [
  { id: 'star-wars', title: 'Звёздные войны' },
  { id: 'harry-potter', title: 'Гарри Поттер' },
  { id: 'lotr', title: 'Властелин колец' },
  { id: 'marvel', title: 'Марвел: весь кинематографический' },
  { id: 'star-trek', title: 'Звёздный путь' },
  { id: 'night-stars', title: 'Кино под звёздами' },
  { id: 'nolan', title: 'Кристофер Нолан' },
  { id: 'retro', title: 'Ретрокино' },
  { id: 'a24', title: 'A24' }
];

const ids = (list) => list.map((i) => i.id);

test('searchCollections: совпадение с начала названия — первым', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'звёзд')), ['star-wars', 'star-trek', 'night-stars']);
});

test('searchCollections: регистр и «ё» не мешают', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'ЗВЕЗД')), ['star-wars', 'star-trek', 'night-stars']);
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'нолан')), ['nolan']);
});

test('searchCollections: начало слова внутри названия важнее середины', () => {
  const found = M.searchCollections(COLLECTIONS, 'кол');
  assert.deepEqual(ids(found), ['lotr']);
  /* «Кино под звёздами» начинается с запроса, у «Ретрокино» он в середине
     слова — этот всегда ниже. */
  const kino = M.searchCollections(COLLECTIONS, 'кино');
  assert.deepEqual(ids(kino), ['night-stars', 'retro']);
});

test('searchCollections: ищет и по id — им пользуются только с клавиатуры', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'lotr')), ['lotr']);
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'a24')), ['a24']);
});

test('searchCollections: пустой запрос и мусор — пусто', () => {
  assert.deepEqual(M.searchCollections(COLLECTIONS, ''), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, '   '), []);
  assert.deepEqual(M.searchCollections(null, 'звёзд'), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, null), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, 'чебурашка'), []);
});

test('searchCollections: не больше восьми результатов', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, title: 'Кино ' + i }));
  assert.equal(M.searchCollections(many, 'кино').length, 8);
});

test('searchCollections: подборка без названия не роняет поиск', () => {
  const list = [{ id: 'x' }, { id: 'y', title: 'Ужасы' }];
  assert.deepEqual(ids(M.searchCollections(list, 'ужас')), ['y']);
});

/* ---------------------------------------------------------------------- */
/* jumpLabel — подпись индикатора «где я в ряду».                          */
/* ---------------------------------------------------------------------- */

test('jumpLabel: позиция считается от единицы', () => {
  assert.equal(M.jumpLabel(0, 60), '1 / 60');
  assert.equal(M.jumpLabel(13, 60), '14 / 60');
  assert.equal(M.jumpLabel(59, 60), '60 / 60');
});

test('jumpLabel: без позиции или в ряду из одной карточки показывать нечего', () => {
  assert.equal(M.jumpLabel(-1, 60), '');
  assert.equal(M.jumpLabel(0, 1), '');
  assert.equal(M.jumpLabel(0, 0), '');
  assert.equal(M.jumpLabel(70, 60), '');
  assert.equal(M.jumpLabel(null, null), '');
});

/* ---------------------------------------------------------------------- */
/* Рантайм: жизнь панели мини-карты.                                       */
/*                                                                        */
/* Дефект, найденный в фазе 3 (отчёт Task 22/23): панель осталась видимой  */
/* поверх открытой карточки. Причина — она снималась только по отпусканию  */
/* клавиши (HIDE_MS = 800 мс после keyup), и если за эти 800 мс человек    */
/* успевал нажать OK, карточка открывалась под уже показанной панелью, а   */
/* сама панель про смену экрана не знала вовсе.                            */
/*                                                                        */
/* Окружение — фейковые $, Lampa.Keypad, таймеры и часы: ровно то, что     */
/* модуль читает из глобалов в момент вызова, а не загрузки.               */
/* ---------------------------------------------------------------------- */

/* Набор узлов по селектору вида '.card.focus' — как jQuery: length,
   числовые индексы, eq(i). */
function collect(root, sel) {
  const classes = sel.split('.').filter(Boolean);
  const out = [];
  (function walk(node) {
    (node._children || []).forEach((child) => {
      if (classes.every((c) => child.hasClass(c))) out.push(child);
      walk(child);
    });
  })(root);
  const set = { length: out.length, eq: (i) => out[i] || EMPTY };
  out.forEach((el, i) => { set[i] = el; });
  return set;
}

/* Главная с тремя рядами: названия рядов панель берёт из .items-line__title. */
function makeMain(titles) {
  const lines = titles.map((title) => {
    const head = new FakeEl(['items-line__title']);
    head.text(title);
    return new FakeEl(['items-line'], [head]);
  });
  return new FakeEl(['activity__body'], lines);
}

function makeEnv(opts) {
  const o = opts || {};
  const timers = [];
  const body = new FakeEl(['body-mock']);
  const env = {
    now: 10000,
    timers: timers,
    body: body,
    moves: [],
    controller: 'items_line',
    main: makeMain(o.titles || ['Новинки', 'Боевики', 'Комедии']),
    keydown: [],
    keyup: [],
    advance(ms) {
      env.now += ms;
      for (let round = 0; round < 10; round++) {
        const due = timers.filter((t) => !t.done && t.at <= env.now);
        if (!due.length) return;
        due.forEach((t) => { t.done = true; t.fn(); });
      }
    },
    /* Событие клавиши в том виде, в каком его шлёт Lampa.Keypad.listener. */
    down(code) { env.keydown.forEach((fn) => fn({ code: code, enabled: true })); },
    up(code) { env.keyup.forEach((fn) => fn({ code: code, enabled: true })); }
  };

  globalThis.setTimeout = (fn, ms) => {
    timers.push({ fn: fn, at: env.now + (ms || 0), done: false });
    return timers.length;
  };
  globalThis.clearTimeout = (id) => { const t = timers[id - 1]; if (t) t.done = true; };
  globalThis.Date.now = () => env.now;

  const Lampa = {
    Keypad: {
      listener: {
        follow(name, fn) { env[name].push(fn); },
        remove(name, fn) {
          const list = env[name];
          const at = list.indexOf(fn);
          if (at !== -1) list.splice(at, 1);
        }
      }
    },
    Activity: {
      active: () => env.activity
    },
    Controller: {
      enabled: () => ({ name: env.controller }),
      move: (dir) => env.moves.push(dir)
    }
  };
  env.activity = { component: 'main', activity: { render: () => env.main } };

  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  globalThis.$ = function (sel, ctx) {
    if (typeof sel !== 'string') return toEl(sel);
    if (sel.charAt(0) === '<') return fakeQuery(sel);
    if (sel === 'body') return body;
    return collect(ctx ? toEl(ctx) : body, sel);
  };

  const LC = {
    util: UTIL,
    pref: (name, def) => (o.prefs && name in o.prefs ? o.prefs[name] : def),
    lang: (key) => key,
    /* Task 33: режим анимаций — ускорение листания его спрашивает. */
    motionMode: () => o.motion || 'full'
  };
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  env.nav = module.exports;
  env.LC = LC;
  return env;
}

/* Панель в body: она лежит там одна, других узлов тест не создаёт. */
function panelsIn(env) {
  return env.body._children.filter((el) => el.hasClass('lumen-minimap')).length;
}

test('мини-карта: удержание «вниз» на главной показывает панель через полсекунды', () => {
  const env = makeEnv();
  env.nav.install();
  env.down(40);
  assert.equal(env.nav.active(), false, 'сразу по нажатию панели нет — это обычный шаг по рядам');
  env.advance(500);
  assert.equal(env.nav.active(), true);
  assert.equal(panelsIn(env), 1);
  env.nav.uninstall();
});

test('мини-карта: detach снимает панель немедленно, не дожидаясь отпускания клавиши', () => {
  const env = makeEnv();
  env.nav.install();
  env.down(40);
  env.advance(500);
  assert.equal(env.nav.active(), true);

  env.nav.detach();

  assert.equal(env.nav.active(), false, 'панель обязана уйти в тот же момент');
  assert.equal(panelsIn(env), 0, 'узел панели снят из body, а не просто забыт');
  /* Отложенные показ и скрытие сняты вместе с ней: сработав позже, они
     воскресили бы панель уже на чужом экране. */
  env.advance(5000);
  assert.equal(panelsIn(env), 0);
  env.nav.uninstall();
});

test('мини-карта: detach снимает панель, для которой скрытие уже отложено на 800 мс', () => {
  /* Дословный сценарий дефекта: клавишу отпустили, панель живёт свои 800 мс,
     и в этот промежуток человек нажал OK — карточка открылась бы под ней. */
  const env = makeEnv();
  env.nav.install();
  env.down(40);
  env.advance(500);
  env.up(40);
  env.advance(200);
  assert.equal(env.nav.active(), true, 'до срока скрытия панель ещё на экране');

  /* Активность сменилась: открылась карточка. */
  env.activity = { component: 'full', activity: { render: () => new FakeEl(['activity__body']) } };
  env.nav.detach();

  assert.equal(panelsIn(env), 0);
  env.advance(1000);
  assert.equal(panelsIn(env), 0);
  env.nav.uninstall();
});

/* Мелочь ревью фазы 3 (docs/plans/2026-09-15-lumen-phase3-features.md:251):
   у панели не было предельного времени жизни — потерянный keyup оставлял
   её на экране до смены активности. */
test('мини-карта: без keyup панель уходит сама после двух секунд без нажатий, автоповтор её продлевает', () => {
  const env = makeEnv();
  env.nav.install();
  env.down(40);
  env.advance(500);
  assert.equal(env.nav.active(), true, 'удержание показало панель');
  /* Клавишу держат: автоповтор keydown каждые 300 мс в течение трёх секунд. */
  for (let i = 0; i < 10; i++) { env.down(40); env.advance(300); }
  assert.equal(env.nav.active(), true, 'пока идут нажатия, панель живёт дольше STALE_MS');
  /* keyup потерялся — нажатий больше нет. С последнего прошло 300 мс. */
  env.advance(1600);
  assert.equal(env.nav.active(), true, 'до срока панель на месте');
  env.advance(200);
  assert.equal(env.nav.active(), false, 'через две секунды тишины панель снята');
  assert.equal(panelsIn(env), 0, 'и узел ушёл из body');
  env.nav.uninstall();
});

test('мини-карта: detach подписки на клавиатуру не трогает — экран сменился, а плагин работает', () => {
  const env = makeEnv();
  env.nav.install();
  env.down(40);
  env.advance(500);
  env.nav.detach();
  assert.equal(env.keydown.length, 1, 'подписка на keydown осталась');
  assert.equal(env.keyup.length, 1, 'и на keyup тоже');

  /* Вернулись на главную — удержание снова показывает панель. */
  env.down(40);
  env.advance(500);
  assert.equal(env.nav.active(), true);
  env.nav.uninstall();
  assert.equal(env.keydown.length, 0, 'а uninstall снимает уже обе подписки');
  assert.equal(panelsIn(env), 0);
});

/* ---------------------------------------------------------------------- */
/* Task 33: ускорение листания — один добавочный шаг, а не два.            */
/* ---------------------------------------------------------------------- */

/* Шесть плотных нажатий подряд — ровно то, что holdTracker считает
   удержанием (FAST_REPEATS в FAST_WINDOW, паузы меньше FAST_GAP). */
function holdRight(env, times) {
  for (let i = 0; i < times; i++) {
    env.down(39);
    env.now += 100;
  }
}

test('ускорение: удержание «вправо» добавляет ровно один шаг на событие', () => {
  const env = makeEnv();
  env.nav.install();
  holdRight(env, 5);
  assert.deepEqual(env.moves, [], 'пять событий — серия ещё не признана удержанием');
  env.down(39);
  assert.deepEqual(env.moves, ['right'], 'шестое включает ускорение: один добавочный шаг, а не два');
  env.now += 100;
  env.down(39);
  assert.deepEqual(env.moves, ['right', 'right'], 'и дальше по одному на событие');
  env.nav.uninstall();
});

test('ускорение: режим «без анимаций» добавочных шагов не делает', () => {
  const env = makeEnv({ motion: 'off' });
  env.nav.install();
  holdRight(env, 10);
  assert.deepEqual(env.moves, [], 'человек попросил минимум движения — лишних шагов нет');
  env.nav.uninstall();
});

test('ускорение: в режиме lite работает как обычно', () => {
  const env = makeEnv({ motion: 'lite' });
  env.nav.install();
  holdRight(env, 6);
  assert.deepEqual(env.moves, ['right'], 'lite — это про анимации, а не про листание');
  env.nav.uninstall();
});

test('мини-карта: на чужом экране панель не показывается вовсе', () => {
  const env = makeEnv();
  env.nav.install();
  env.activity = { component: 'full', activity: { render: () => new FakeEl(['activity__body']) } };
  env.down(40);
  env.advance(500);
  assert.equal(env.nav.active(), false);
  assert.equal(panelsIn(env), 0);
  env.nav.uninstall();
});

test('мини-карта: выключенная настройка не показывает панель, а detach безопасен и без неё', () => {
  const env = makeEnv({ prefs: { lumen_minimap: false } });
  env.nav.install();
  env.down(40);
  env.advance(500);
  assert.equal(env.nav.active(), false);
  env.nav.detach();
  assert.equal(panelsIn(env), 0);
  assert.deepEqual(warnLog, []);
  env.nav.uninstall();
});

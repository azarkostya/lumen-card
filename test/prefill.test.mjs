import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCtx } from './_load.mjs';

/* Исследование «без лагов» 2026-09-27, полоса scroll: LC.prefill
   (src/58_prefill.js) достраивает ряды главной в простое — теми же вызовами
   Lampa, что делает конец прокрутки (Items.onScroll, onPushLoaded), но по
   одной единице за задачу и только после IDLE_MS покоя фокуса. Окружение —
   фейковые ряд/компонент Lampa с той же формой, что в app.min.js. */

var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };
globalThis.window = globalThis;
globalThis.document = { hidden: false };

function node() {
  const n = { listeners: [], children: [] };
  n.addEventListener = (name, fn, cap) => n.listeners.push([name, fn, cap]);
  n.removeEventListener = (name, fn, cap) => { n.listeners = n.listeners.filter((l) => !(l[0] === name && l[1] === fn && l[2] === cap)); };
  n.contains = (x) => x === n || n.children.indexOf(x) >= 0;
  return n;
}

function results(n, tag) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: tag + ':' + i });
  return out;
}

/* Ряд Lampa: Items.onInit (tv, items, active, view) + Create.onCreateAndAppend. */
function line(n, opts) {
  opts = opts || {};
  const res = results(n, opts.tag || 'r');
  const html = node();
  const l = {
    tv: opts.tv !== false, view: opts.view || 8, active: opts.active || 0, items: [], more: null,
    data: { results: res }, created: [],
    scroll: { render: () => html },
    emit(name, el) {
      if (name !== 'createAndAppend') return;
      if (opts.throws) throw new Error('boom');
      l.created.push(el);
      /* Create.onCreateAndAppend (app.min.js:19135-19146) ловит исключение карточки
         сам: наружу ничего не летит, items просто не растёт. */
      if (opts.broken != null && el === res[opts.broken]) return;
      l.items.push({ el: el });
    }
  };
  if (opts.moreFirst) { l.more = { more: true }; l.items.push(l.more); }
  const first = Math.min(n, opts.built == null ? l.view : opts.built);
  for (let i = 0; i < first; i++) l.items.push({ el: res[i] });
  return l;
}

function makeEnv(opts) {
  opts = opts || {};
  const timers = [];
  const visible = [];
  const root = node();
  const comp = {
    items: opts.lines || [line(20, { tag: 'a' }), line(20, { tag: 'b' }), line(20, { tag: 'c' }), line(20, { tag: 'd' })],
    active: opts.active || 0,
    loaded: opts.loaded || [],
    pushed: 0,
    emit(name) {
      if (name !== 'pushLoaded') return;
      const add = comp.loaded.shift();
      if (add) { comp.items.push(line(20, { tag: 'p' + comp.pushed })); comp.pushed++; }
    }
  };
  const env = {
    now: 1000, timers, visible, root, comp, ctrl: 'items_line', component: 'main', pref: true, enabled: true,
    advance(ms) {
      const end = env.now + ms;
      for (let guard = 0; guard < 5000; guard++) {
        const due = timers.filter((t) => !t.done && t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        if (due.at > env.now) env.now = due.at;
        due.done = true; due.fn();
      }
      env.now = end;
    },
    /* Одна ближайшая задача — «одна единица работы за задачу». */
    step() {
      const due = timers.filter((t) => !t.done).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) return false;
      if (due.at > env.now) env.now = due.at;
      due.done = true; due.fn();
      return true;
    }
  };
  env.keys = [];
  globalThis.Lampa = {
    Keypad: { listener: {
      follow: (name, fn) => { if (name === 'keydown') env.keys.push(fn); },
      remove: (name, fn) => { env.keys = env.keys.filter((x) => x !== fn); }
    } },
    Activity: { active: () => ({ component: env.component, activity: { component: comp, render: () => [root] } }) },
    Controller: { enabled: () => ({ name: env.ctrl }) },
    Layer: { visible: (el) => visible.push(el) }
  };
  const { api, LC } = loadCtx('58_prefill.js', {
    pref: (name, def) => (name === 'lumen_prefill' ? env.pref : def),
    enabled: () => env.enabled
  });
  let seq = 0;
  api._now = () => env.now;
  api._timers = {
    set: (fn, ms) => { const t = { id: ++seq, at: env.now + ms, ms, fn, done: false }; timers.push(t); return t.id; },
    clear: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; }
  };
  env.api = api; env.LC = LC;
  return env;
}

test('prefill: до IDLE_MS покоя — ни одной карточки, после — по одной за задачу', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  const row = env.comp.items[0];
  env.advance(P.IDLE_MS - 1);
  assert.equal(row.created.length, 0);
  env.step();
  assert.equal(env.now, 1000 + P.IDLE_MS);
  assert.equal(row.created.length, 1, 'первая единица — одна карточка');
  env.step();
  assert.equal(row.created.length, 2, 'следующая — отдельной задачей');
  assert.equal(row.created[0].id, 'a:8', 'следующий элемент results — тот, что дописал бы onScroll');
});

test('prefill: ряд под фокусом — до конца results, потом один Layer.visible; соседи не трогаются (NEXT_ROWS = 0)', () => {
  const env = makeEnv();
  const P = env.api;
  assert.equal(P.NEXT_ROWS, 0);
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const [a, b, c, d] = env.comp.items;
  assert.equal(a.items.length, 20, 'ряд под фокусом — все 20');
  assert.deepEqual(a.created.map((x) => x.id), results(20, 'a').slice(8).map((x) => x.id), 'по порядку, без повторов');
  assert.equal(b.items.length, 8);
  assert.equal(c.items.length, 8);
  assert.equal(d.items.length, 8);
  assert.deepEqual(env.visible, [a.scroll.render()], 'Layer.visible — один раз на достроенный ряд');
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(b.items.length, 20, 'фокус ушёл ниже — достраивается уже этот ряд');
  assert.deepEqual(env.visible, [a.scroll.render(), b.scroll.render()]);
});

test('prefill: перевод фокуса откладывает работу на IDLE_MS (зажатая стрелка — ни одной карточки)', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  const row = env.comp.items[0];
  for (let i = 0; i < 30; i++) { env.advance(100); P.poke(); }
  assert.equal(row.created.length, 0);
  env.advance(P.IDLE_MS - 1);
  assert.equal(row.created.length, 0);
  env.step();
  assert.equal(row.created.length, 1);
});

test('prefill: слушатель фокуса — общий LC.focus.capture на корне; unmount его снимает и гасит таймер', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  assert.ok(env.root.listeners.length >= 2, 'оба события фокуса — пульт и мышь');
  assert.ok(env.root.listeners.every((l) => l[2] === true), 'в фазе захвата');
  env.root.listeners[0][1]({});
  P.unmount();
  assert.equal(env.root.listeners.length, 0);
  env.advance(60000);
  assert.equal(env.comp.items[0].created.length, 0);
  assert.equal(P.active(), false);
});

test('prefill: кнопка «Ещё» первой (MoreFirst) не считается карточкой', () => {
  const env = makeEnv({ lines: [line(12, { tag: 'm', moreFirst: true })] });
  const P = env.api;
  assert.equal(P.built(env.comp.items[0]), 8);
  P.mount([env.root]);
  env.advance(P.IDLE_MS - 1); env.step();
  assert.equal(env.comp.items[0].created[0].id, 'm:8');
  env.advance(60000);
  assert.equal(P.built(env.comp.items[0]), 12);
});

test('prefill: соседний ряд — на пачку вперёд от ЕГО позиции', () => {
  const P = makeEnv().api;
  assert.equal(P.wanted({ view: 8, active: 0, data: { results: results(20, 'x') } }, false), 17);
  assert.equal(P.wanted({ view: 8, active: 5, data: { results: results(40, 'x') } }, false), 25);
  assert.equal(P.wanted({ view: 7, active: 0, data: { results: results(10, 'x') } }, false), 10, 'не больше results');
  assert.equal(P.wanted({ view: 8, active: 0, data: { results: results(20, 'x') } }, true), 20);
});

test('prefill: ряды главной — pushLoaded, пока ниже фокуса меньше ROWS_AHEAD и очередь не пуста', () => {
  const env = makeEnv({ lines: [line(8, { tag: 'a' }), line(8, { tag: 'b' })], loaded: [[1], [2], [3]] });
  const P = env.api;
  P.mount([env.root]);
  env.advance(60000);
  assert.equal(env.comp.pushed, 1, 'ниже фокуса стало 2 ряда — хватит');
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(env.comp.pushed, 2);
  assert.equal(env.comp.loaded.length, 1);
});

test('prefill: не главная, меню/настройки поверх, скрытая вкладка, настройка выкл, плагин выкл — стоим', () => {
  for (const what of ['component', 'ctrl', 'hidden', 'pref', 'enabled']) {
    const env = makeEnv();
    const P = env.api;
    if (what === 'component') env.component = 'full';
    if (what === 'ctrl') env.ctrl = 'menu';
    if (what === 'hidden') globalThis.document.hidden = true;
    if (what === 'pref') env.pref = false;
    if (what === 'enabled') env.enabled = false;
    P.mount([env.root]);
    env.advance(60000);
    globalThis.document.hidden = false;
    assert.equal(env.comp.items[0].created.length, 0, what);
    assert.equal(env.comp.pushed, 0, what);
  }
});

test('prefill: незнакомая форма ряда (не ТВ-ряд Lampa) — пропускается без ошибок', () => {
  warnLog.length = 0;
  const env = makeEnv({ lines: [line(20, { tag: 'a', tv: false }), line(20, { tag: 'b' })] });
  const P = env.api;
  P.mount([env.root]);
  env.advance(60000);
  assert.equal(env.comp.items[0].created.length, 0);
  assert.deepEqual(warnLog.filter((w) => /prefill/.test(w.msg)), []);
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(env.comp.items[1].items.length, 20, 'знакомый ряд рядом достраивается как обычно');
});

test('prefill: два отказа подряд — модуль замолкает до перемонтирования', () => {
  warnLog.length = 0;
  const env = makeEnv({ lines: [line(20, { tag: 'a', throws: true })] });
  const P = env.api;
  P.mount([env.root]);
  env.advance(60000);
  assert.equal(warnLog.filter((w) => /prefill: work failed/.test(w.msg)).length, 2);
  assert.equal(env.timers.filter((t) => !t.done).length, 0, 'таймер не взведён');
});

/* Ревью этапа 1 (MAJOR): карточка, которую Lampa создать не может, —
   Create.onCreateAndAppend глотает исключение, items не растёт, и модуль
   строил тот же results[have] снова и снова (стенд: 545 попыток за 3 с). */
test('prefill: битая карточка (emit не растит items) — одна попытка, ряд помечен, повторного arm(0) нет; остальная работа идёт', () => {
  warnLog.length = 0;
  const env = makeEnv({ lines: [line(20, { tag: 'a', broken: 10 }), line(20, { tag: 'b' })], loaded: [[1], [2]] });
  const P = env.api;
  const zeros = () => env.timers.filter((t) => t.ms === 0).length;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const [a, b] = env.comp.items;
  assert.deepEqual(a.created.map((x) => x.id), ['a:8', 'a:9', 'a:10'], 'битая — ровно одна попытка, дальше ряд не достраивается');
  assert.equal(a.items.length, 10);
  assert.equal(a.lumen_prefill_stuck, true);
  assert.deepEqual(env.visible, [a.scroll.render()], 'Layer.visible дописанного — остаётся');
  assert.equal(env.comp.pushed, 1, 'pushLoaded при фокусе на битом ряду — как обычно');
  assert.deepEqual(P.stats(), { cards: 2, visible: 1, rows: 1, stuck: 1 });
  const z = zeros();
  env.advance(60000);
  assert.equal(zeros(), z, 'в покое — только паузы REST_MS, ни одной немедленной задачи');
  assert.equal(a.created.length, 3);
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(b.items.length, 20, 'соседний ряд достраивается как обычно');
  assert.deepEqual(warnLog.filter((w) => /prefill/.test(w.msg)), []);
});

test('prefill: detach — корень внутри стартующей активности остаётся, чужой — снимается', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  const outer = { contains: (x) => x === env.root };
  P.detach([outer]);
  assert.equal(P.active(), true);
  P.detach([{ contains: () => false }]);
  assert.equal(P.active(), false);
});

/* Урок B1: переходы ленты Lampa и её дописывание по webkitTransitionEnd модуль
   не трогает — ни CSS, ни подписок на события прокрутки. */
test('prefill: без CSS, без transition и без подписок на события прокрутки', () => {
  const src = readFileSync(new URL('../src/58_prefill.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/transition/i.test(code), false);
  assert.equal(/addEventListener/.test(code), false);
  assert.equal(/css\(|\.style\b/.test(code), false);
});

test('prefill: нажатие без перевода фокуса (упёрлись в край) — тоже не покой; unmount снимает подписку Keypad', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  assert.equal(env.keys.length, 1);
  for (let i = 0; i < 20; i++) { env.advance(100); env.keys.forEach((fn) => fn({ code: 40 })); }
  assert.equal(env.comp.items[0].created.length, 0, 'пока клавишу держат — ни одной единицы');
  env.advance(P.IDLE_MS - 1); env.step();
  assert.equal(env.comp.items[0].created.length, 1);
  P.unmount();
  assert.equal(env.keys.length, 0);
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCtx } from './_load.mjs';

/* Исследование «без лагов» 2026-09-27, полоса scroll: LC.prefill
   (src/58_prefill.js) достраивает ряды главной в простое — теми же вызовами
   Lampa, что делает конец прокрутки (Items.onScroll, onPushLoaded), но по
   одной единице за задачу простоя браузера и только после IDLE_MS покоя
   фокуса и клавиш. Полоса «длинные кадры на ТВ»: ряд под фокусом — на
   AHEAD_VIEWS экранов вперёд, единица — только если простоя хватает
   (MIN_LEFT_MS), видимыми новые карточки становятся по одной и только после
   шага вправо по ряду (в коллекцию навигации — сразу), любое нажатие
   (keydown в захвате на window) снимает запланированную единицу, поверх
   главной (плеер, поиск…) — стоим. Окружение — фейковые ряд/компонент Lampa
   с той же формой, что в app.min.js. */

var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };
globalThis.window = globalThis;

function node() {
  const n = { listeners: [], children: [], isConnected: true, nodeType: 1 };
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

/* Карточка Lampa: render(true) — узел, render() — обёртка jQuery. */
function card(el) {
  const html = node();
  html.card = el;
  return { el: el, html: html, render: (js) => (js ? html : [html]) };
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
      l.items.push(card(el));
    }
  };
  if (opts.moreFirst) { l.more = { more: true }; l.items.push(l.more); }
  const first = Math.min(n, opts.built == null ? l.view : opts.built);
  for (let i = 0; i < first; i++) l.items.push(card(res[i]));
  return l;
}

/* Окно: слушатели keydown (фаза захвата) — в env.winKeys. */
function installWindow(env) {
  env.winKeys = [];
  globalThis.addEventListener = (name, fn, cap) => env.winKeys.push([name, fn, cap]);
  globalThis.removeEventListener = (name, fn, cap) => { env.winKeys = env.winKeys.filter((l) => !(l[0] === name && l[1] === fn && l[2] === cap)); };
  env.press = () => env.winKeys.filter((l) => l[0] === 'keydown' && l[2] === true).forEach((l) => l[1]({ keyCode: 39 }));
}

function makeEnv(opts) {
  opts = opts || {};
  const timers = [];
  const visible = [];
  const appended = [];
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
    now: 1000, timers, visible, appended, root, comp, ctrl: 'items_line', component: 'main', pref: true, enabled: true,
    /* Простой браузера: сколько остаётся до кадра и истёк ли потолок. */
    left: 50, timedOut: false, idleAsks: 0, jq: 0,
    bodyClasses: [], overlay: false, owner: undefined,
    advance(ms) {
      const end = env.now + ms;
      for (let guard = 0; guard < 20000; guard++) {
        const due = timers.filter((t) => !t.done && t.at <= end).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) break;
        if (due.at > env.now) env.now = due.at;
        due.done = true; due.fn();
      }
      env.now = end;
    },
    /* Одна ближайшая задача — таймер или колбэк простоя. */
    step() {
      const due = timers.filter((t) => !t.done).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) return false;
      if (due.at > env.now) env.now = due.at;
      due.done = true; due.fn();
      return true;
    },
    pending: () => timers.filter((t) => !t.done),
    /* До первого колбэка простоя включительно (повторная заявка идёт таймером). */
    stepIdle() {
      for (let guard = 0; guard < 100; guard++) {
        const due = timers.filter((t) => !t.done).sort((a, b) => a.at - b.at || a.id - b.id)[0];
        if (!due) return false;
        env.step();
        if (due.kind === 'idle') return true;
      }
      return false;
    }
  };
  installWindow(env);
  globalThis.document = {
    hidden: false,
    body: { classList: { contains: (c) => env.bodyClasses.indexOf(c) >= 0 } },
    querySelector: (sel) => (env.overlay && sel.indexOf('.player') >= 0 ? {} : null)
  };
  env.keys = [];
  globalThis.Lampa = {
    Keypad: { listener: {
      follow: (name, fn) => { if (name === 'keydown') env.keys.push(fn); },
      remove: (name, fn) => { env.keys = env.keys.filter((x) => x !== fn); }
    } },
    Activity: { active: () => ({ component: env.component, activity: { component: comp, render: (js) => { if (!js) env.jq++; return js ? root : [root]; } } }) },
    Controller: {
      enabled: () => ({ name: env.ctrl }),
      /* Ряд под фокусом владеет контроллером 'items_line' (Controller.own). */
      own: (l) => (env.owner === undefined ? l === comp.items[comp.active] : l === env.owner),
      collectionAppend: (el) => appended.push(el)
    },
    Layer: { visible: (el) => visible.push(el) }
  };
  const { api, LC } = loadCtx('58_prefill.js', {
    pref: (name, def) => (name === 'lumen_prefill' ? env.pref : def),
    enabled: () => env.enabled
  });
  let seq = 0;
  api._now = () => env.now;
  api._timers = {
    set: (fn, ms) => { const t = { id: ++seq, at: env.now + ms, ms, fn, done: false, kind: 'timer' }; timers.push(t); return t.id; },
    clear: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; }
  };
  api._idle = {
    request: (fn, timeout) => {
      env.idleAsks++;
      env.lastTimeout = timeout;
      const t = { id: ++seq, at: env.now, ms: 0, timeout, kind: 'idle', done: false,
        fn: () => fn({ timeRemaining: () => env.left, didTimeout: env.timedOut }) };
      timers.push(t);
      return t.id;
    },
    cancel: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; }
  };
  env.api = api; env.LC = LC;
  return env;
}

const newCards = (l) => l.items.filter((it) => it.el && l.created.indexOf(it.el) >= 0).map((it) => it.html);

test('prefill: до IDLE_MS покоя — ни одной карточки, после — по одной за колбэк простоя', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  const row = env.comp.items[0];
  env.advance(P.IDLE_MS - 1);
  assert.equal(row.created.length, 0);
  env.step();
  assert.equal(env.now, 1000 + P.IDLE_MS);
  assert.equal(row.created.length, 0, 'таймер покоя только подаёт заявку на простой');
  assert.equal(env.pending().filter((t) => t.kind === 'idle').length, 1);
  env.step();
  assert.equal(row.created.length, 1, 'первый колбэк простоя — одна карточка');
  env.step();
  assert.equal(row.created.length, 2, 'следующая — отдельным колбэком');
  assert.equal(row.created[0].id, 'a:8', 'следующий элемент results — тот, что дописал бы onScroll');
  assert.equal(env.pending().filter((t) => t.kind === 'timer').length, 0, 'между единицами — только заявки на простой, не setTimeout(0)');
});

test('prefill: ряд под фокусом — на AHEAD_VIEWS экранов вперёд от фокуса, не до конца results', () => {
  const env = makeEnv({ lines: [line(40, { tag: 'a' }), line(20, { tag: 'b' })] });
  const P = env.api;
  assert.equal(P.AHEAD_VIEWS, 2);
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const [a, b] = env.comp.items;
  assert.equal(a.items.length, 25, 'фокус на 0, view 8: (0 + 1 + 2)·8 + 1 = 25 из 40');
  assert.deepEqual(a.created.map((x) => x.id), results(40, 'a').slice(8, 25).map((x) => x.id), 'по порядку, без повторов');
  assert.equal(b.items.length, 8, 'соседи не трогаются (NEXT_ROWS = 0)');
  a.active = 5; P.poke();
  env.advance(60000);
  assert.equal(a.items.length, 33, 'фокус ушёл на 5: (round(5/8) + 3)·8 + 1 = 33');
  a.active = 12; P.poke();
  env.advance(60000);
  assert.equal(a.items.length, 40, 'дальше — не больше results');
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(b.items.length, 20, 'фокус ушёл ниже — достраивается уже этот ряд (20 < 25)');
});

test('prefill: wanted — ряду под фокусом на AHEAD_VIEWS экранов, соседу на пачку вперёд', () => {
  const P = makeEnv().api;
  assert.equal(P.wanted({ view: 8, active: 0, data: { results: results(20, 'x') } }, false), 17);
  assert.equal(P.wanted({ view: 8, active: 5, data: { results: results(40, 'x') } }, false), 25);
  assert.equal(P.wanted({ view: 7, active: 0, data: { results: results(10, 'x') } }, false), 10, 'не больше results');
  assert.equal(P.wanted({ view: 8, active: 0, data: { results: results(40, 'x') } }, true), 25);
  assert.equal(P.wanted({ view: 8, active: 12, data: { results: results(60, 'x') } }, true), 41);
});

test('prefill: новые карточки — сразу в коллекцию навигации, видимыми (постер) — только после шага вправо и по одной', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const a = env.comp.items[0];
  assert.equal(a.items.length, 20);
  assert.deepEqual(env.visible, [], 'по ряду не шагали вправо — постеры хвоста не грузим');
  assert.deepEqual(env.appended, newCards(a), 'зато каждая новая — в коллекции (зажатая стрелка не упрётся в восьмую)');
  a.active = 1; P.poke();
  env.advance(60000);
  assert.deepEqual(env.visible, newCards(a), 'после шага вправо — Layer.visible каждой новой карточки, по порядку');
  assert.equal(env.visible.indexOf(a.scroll.render()), -1, 'не всего ряда разом');
  assert.equal(P.stats().visible, 12);
});

test('prefill: видимость — одна карточка на колбэк простоя и только когда ряд достроен', () => {
  const env = makeEnv({ lines: [line(20, { tag: 'a', active: 2 })] });
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS - 1);
  const a = env.comp.items[0];
  let guard = 0;
  while (a.items.length < 20 && guard++ < 100) {
    env.step();
    assert.deepEqual(env.visible, [], 'пока ряд не достроен — ни одного Layer.visible');
  }
  env.step();
  assert.equal(env.visible.length, 1);
  env.step();
  assert.equal(env.visible.length, 2);
});

test('prefill: карточку, которую Lampa уже сделала видимой (called_visible), второй раз не трогаем', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const a = env.comp.items[0];
  const fresh = newCards(a);
  /* шаг вправо: конец прокрутки ряда (Layer.visible Lampa) успел первым для половины */
  fresh.slice(0, 6).forEach((el) => { el.called_visible = true; });
  a.active = 1; P.poke();
  env.advance(60000);
  assert.deepEqual(env.visible, fresh.slice(6));
  assert.equal(P.stats().visible, 6);
});

test('prefill: ряд не владеет контроллером — в коллекцию навигации не кладём', () => {
  const env = makeEnv();
  env.owner = null;
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  assert.equal(env.comp.items[0].items.length, 20);
  assert.deepEqual(env.appended, []);
});

test('prefill: сменился ряд под фокусом — невидимые карточки прежнего остаются Lampa', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const [a, b] = env.comp.items;
  env.comp.active = 1; P.poke();
  env.advance(60000);
  a.active = 3;
  b.active = 1; P.poke();
  env.advance(60000);
  assert.deepEqual(env.visible, newCards(b), 'только карточки ряда под фокусом');
});

test('prefill: простоя меньше MIN_LEFT_MS — единица не идёт, заявка повторяется; потолок (didTimeout) — идёт', () => {
  const env = makeEnv();
  const P = env.api;
  env.left = P.MIN_LEFT_MS - 1;
  P.mount([env.root]);
  env.advance(P.IDLE_MS);
  const asks = env.idleAsks;
  env.advance(1000);
  assert.equal(env.comp.items[0].created.length, 0);
  assert.equal(env.idleAsks - asks, 10, 'новая заявка — через RETRY_MS, а не на каждом кадре');
  assert.ok(P.stats().waits >= 10, 'каждый короткий простой — ожидание');
  assert.equal(env.lastTimeout, P.IDLE_WAIT_MS, 'заявка с потолком IDLE_WAIT_MS');
  env.timedOut = true;
  env.stepIdle();
  assert.equal(env.comp.items[0].created.length, 1, 'потолок ожидания — единица идёт');
  env.timedOut = false; env.left = P.MIN_LEFT_MS;
  env.stepIdle();
  assert.equal(env.comp.items[0].created.length, 2);
});

test('prefill: нажатие — keydown в фазе захвата на window — снимает заявку на простой и откладывает работу на IDLE_MS', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  assert.equal(env.winKeys.filter((l) => l[0] === 'keydown' && l[2] === true).length, 1);
  assert.equal(env.keys.length, 0, 'подписка Keypad не нужна');
  env.advance(P.IDLE_MS - 1);
  env.step();
  env.step();
  const row = env.comp.items[0];
  assert.equal(row.created.length, 1);
  assert.equal(env.pending().filter((t) => t.kind === 'idle').length, 1, 'следующая единица в очереди');
  env.press();
  assert.equal(env.pending().filter((t) => t.kind === 'idle').length, 0, 'нажатие её сняло');
  env.advance(P.IDLE_MS - 1);
  assert.equal(row.created.length, 1, 'IDLE_MS после нажатия — ни одной единицы');
  env.press();
  for (let i = 0; i < 20; i++) { env.advance(100); env.press(); }
  assert.equal(row.created.length, 1, 'пока клавишу держат — ни одной');
  env.advance(P.IDLE_MS + 1);
  assert.equal(row.created.length > 1, true);
  P.unmount();
  assert.equal(env.winKeys.length, 0, 'unmount снимает слушатель');
});

test('prefill: без window.addEventListener — нажатия через Keypad Lampa', () => {
  const env = makeEnv();
  const add = globalThis.addEventListener;
  delete globalThis.addEventListener;
  try {
    const P = env.api;
    P.mount([env.root]);
    assert.equal(env.keys.length, 1);
    for (let i = 0; i < 20; i++) { env.advance(100); env.keys.forEach((fn) => fn({ code: 40 })); }
    assert.equal(env.comp.items[0].created.length, 0, 'пока клавишу держат — ни одной единицы');
    P.unmount();
    assert.equal(env.keys.length, 0);
  } finally {
    globalThis.addEventListener = add;
  }
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
  env.step(); env.step();
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
  env.advance(P.IDLE_MS - 1); env.step(); env.step();
  assert.equal(env.comp.items[0].created[0].id, 'm:8');
  env.advance(60000);
  assert.equal(P.built(env.comp.items[0]), 12);
  assert.equal(env.appended.indexOf(env.comp.items[0].more), -1);
});

test('prefill: ряды главной — pushLoaded только в полном простое и после ROW_QUIET_MS покоя', () => {
  const env = makeEnv({ lines: [line(8, { tag: 'a' }), line(8, { tag: 'b' })], loaded: [[1], [2], [3]] });
  const P = env.api;
  env.left = P.ROW_LEFT_MS - 1;
  P.mount([env.root]);
  env.advance(5000);
  assert.equal(env.comp.pushed, 0, 'простой короче ROW_LEFT_MS — ряд Lampa одной задачей не строим');
  env.timedOut = true;
  env.advance(5000);
  assert.equal(env.comp.pushed, 0, 'и по потолку ожидания — тоже');
  env.timedOut = false; env.left = 50;
  P.poke();
  env.advance(P.ROW_QUIET_MS - 10);
  assert.equal(env.comp.pushed, 0, 'меньше ROW_QUIET_MS покоя — рано');
  env.advance(60000);
  assert.equal(env.comp.pushed, 1, 'ниже фокуса стало 2 ряда — хватит');
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(env.comp.pushed, 2);
  assert.equal(env.comp.loaded.length, 1);
});

/* SEC4-3: pushLoaded, который не снимает ряд с очереди loaded (другая
   версия Lampa, чужой плагин подменил компонент главной той же формы), —
   ветка 'row' шла бы в каждом колбэке простоя без конца (PoC: 17e5a3d —
   1000+ emit за 3 с, tvlong — 50+). Одна попытка, компонент помечен, дальше
   ноль; прочая работа идёт. */
test('prefill: pushLoaded не уменьшил loaded — одна попытка, компонент помечен, дальше ни одной (SEC4-3)', () => {
  const env = makeEnv({ lines: [line(20, { tag: 'a' }), line(8, { tag: 'b' })], loaded: [[1], [2]] });
  const P = env.api;
  let emits = 0;
  env.comp.emit = (name) => { if (name === 'pushLoaded') emits++; };
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  assert.equal(emits, 1, 'ровно одна попытка');
  assert.equal(env.comp.lumen_prefill_rows_stuck, true);
  assert.equal(env.comp.loaded.length, 2);
  assert.equal(P.built(env.comp.items[0]), 20, 'ряд под фокусом достраивается как обычно');
  const st = P.stats();
  assert.equal(st.rows, 0, 'ряд не вставлен — не считается');
  assert.equal(st.stuck, 1);
  const asks = env.idleAsks;
  env.comp.active = 1; P.poke();
  env.advance(60000);
  assert.equal(emits, 1, 'и после перевода фокуса — ноль');
  env.advance(600000);
  assert.equal(emits, 1);
  assert.ok(env.idleAsks - asks < 5, 'в покое — паузы REST_MS, не заявки на простой: ' + (env.idleAsks - asks));
  /* Очередь, которая уменьшилась, — рабочая: у нового компонента ветка
     открыта. */
  const ok = makeEnv({ lines: [line(8, { tag: 'a' }), line(8, { tag: 'b' })], loaded: [[1], [2]] });
  ok.api.mount([ok.root]);
  ok.advance(ok.api.IDLE_MS + 60000);
  assert.equal(ok.comp.pushed, 1);
  assert.equal(ok.comp.lumen_prefill_rows_stuck, undefined);
  assert.equal(ok.api.stats().rows, 1);
  assert.equal(ok.api.stats().stuck, 0);
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

test('prefill: поверх главной плеер, поиск, клавиатура — стоим (классы body и узлы, как у Lampa)', () => {
  for (const what of ['search--open', 'settings--open', 'selectbox--open', 'menu--open', 'keyboard-input--visible', 'player']) {
    const env = makeEnv();
    const P = env.api;
    if (what === 'player') env.overlay = true;
    else env.bodyClasses.push(what);
    P.mount([env.root]);
    env.advance(60000);
    assert.equal(env.comp.items[0].created.length, 0, what);
    env.overlay = false; env.bodyClasses.length = 0;
    P.poke();
    env.advance(60000);
    assert.ok(env.comp.items[0].created.length > 0, what + ' закрыли — работа пошла');
  }
});

test('prefill: поиск открыли посреди работы — следующая единица не идёт', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS - 1); env.step(); env.step();
  assert.equal(env.comp.items[0].created.length, 1);
  env.bodyClasses.push('search--open');
  env.advance(60000);
  assert.equal(env.comp.items[0].created.length, 1);
});

test('prefill: корень активности — render(true), без обёртки jQuery на каждую единицу', () => {
  const env = makeEnv();
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  assert.equal(env.comp.items[0].items.length, 20);
  assert.equal(env.jq, 0);
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
  assert.equal(env.pending().length, 0, 'ни таймера, ни заявки на простой');
});

/* Ревью этапа 1 (MAJOR): карточка, которую Lampa создать не может, —
   Create.onCreateAndAppend глотает исключение, items не растёт, и модуль
   строил тот же results[have] снова и снова (стенд: 545 попыток за 3 с). */
test('prefill: битая карточка (emit не растит items) — одна попытка, ряд помечен, немедленных повторов нет; остальная работа идёт', () => {
  warnLog.length = 0;
  const env = makeEnv({ lines: [line(20, { tag: 'a', broken: 10, active: 1 }), line(20, { tag: 'b' })], loaded: [[1], [2]] });
  const P = env.api;
  P.mount([env.root]);
  env.advance(P.IDLE_MS + 60000);
  const [a, b] = env.comp.items;
  assert.deepEqual(a.created.map((x) => x.id), ['a:8', 'a:9', 'a:10'], 'битая — ровно одна попытка, дальше ряд не достраивается');
  assert.equal(a.items.length, 10);
  assert.equal(a.lumen_prefill_stuck, true);
  assert.deepEqual(env.visible, newCards(a), 'дописанные — видимыми, как у целого ряда');
  assert.equal(env.comp.pushed, 1, 'pushLoaded при фокусе на битом ряду — как обычно');
  const st = P.stats();
  assert.deepEqual(Object.keys(st.max), ['card', 'visible', 'next', 'row'], 'самая долгая единица — по видам');
  assert.deepEqual(Object.assign({}, st, { waits: 0, long: 0, maxMs: 0, max: null }), { cards: 2, visible: 2, rows: 1, stuck: 1, waits: 0, long: 0, maxMs: 0, max: null });
  const asks = env.idleAsks;
  env.advance(60000);
  assert.equal(env.idleAsks, asks, 'в покое — только паузы REST_MS, ни одной заявки на простой');
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
   не трогает — ни CSS, ни подписок на события прокрутки. Единственная
   подписка на window — keydown (стоп-кран на любое нажатие). */
test('prefill: без CSS, без transition и без подписок на события прокрутки', () => {
  const src = readFileSync(new URL('../src/58_prefill.js', import.meta.url), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/transition/i.test(code), false);
  assert.equal(/css\(|\.style\b/.test(code), false);
  const subs = code.match(/addEventListener\(\s*'[^']+'/g) || [];
  assert.deepEqual(subs, ["addEventListener('keydown'"]);
  assert.equal(/scroll|wheel/i.test((code.match(/(?:add|remove)EventListener\([^)]*\)/g) || []).join(' ')), false);
});

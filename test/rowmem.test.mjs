import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* Полоса «память за долгий сеанс» (2026-09-27): LC.rowmem
   (src/58_rowmem.js) усыпляет ряды главной далеко от фокуса — лента ряда
   display:none при закреплённой высоте тела, у карточек класс
   layer--visible меняется на метку; ещё дальше — src загруженных постеров
   снимается. Ближние ряды будятся синхронно на переводе фокуса. Окружение —
   фейковые ряды/компонент Lampa той же формы, что в app.min.js. */

var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };
globalThis.window = globalThis;

function classList(init) {
  const set = new Set(init || []);
  return { add: (c) => set.add(c), remove: (c) => set.delete(c), contains: (c) => set.has(c), _set: set };
}

function el(cls) {
  const n = { classList: classList(cls), style: {}, attrs: {} };
  n.getAttribute = (k) => (k in n.attrs ? n.attrs[k] : null);
  n.setAttribute = (k, v) => { n.attrs[k] = String(v); n.events = (n.events || 0) + 1; };
  n.removeAttribute = (k) => { delete n.attrs[k]; };
  return n;
}

/* Карточка: .card (layer--visible) и её img.card__img. */
function cardNode(src, loaded) {
  const c = el(['card', 'layer--visible']);
  const img = el(['card__img']);
  if (src) img.attrs.src = src;
  img.complete = loaded !== false;
  img.naturalWidth = loaded === false ? 0 : 300;
  c.img = img;
  return c;
}

/* Ряд Lampa: scroll.render(true) — .scroll, его родитель — .items-line__body. */
function line(n, opts) {
  opts = opts || {};
  const body = { style: {}, offsetHeight: opts.height == null ? 180 : opts.height };
  const cards = [];
  for (let i = 0; i < n; i++) cards.push(cardNode(opts.src === null ? '' : 'https://img/t/p/w300/' + (opts.tag || 'r') + i + '.jpg', opts.loaded));
  const sc = el(['scroll']);
  sc.parentNode = body;
  sc.querySelectorAll = (sel) => {
    if (sel === 'img.card__img') return cards.map((c) => c.img);
    const cls = sel.replace(/^\./, '');
    return cards.filter((c) => c.classList.contains(cls));
  };
  return { cards, body, sc, items: cards.slice(), scroll: { render: () => sc } };
}

function makeEnv(opts) {
  opts = opts || {};
  const timers = [];
  const root = { listeners: [], addEventListener(name, fn, cap) { root.listeners.push([name, fn, cap]); }, removeEventListener(name, fn, cap) { root.listeners = root.listeners.filter((l) => !(l[0] === name && l[1] === fn && l[2] === cap)); } };
  root.contains = (x) => x === root;
  const lines = [];
  for (let i = 0; i < (opts.rows || 16); i++) lines.push(line(opts.cards || 6, { tag: 'r' + i + '_' }));
  const comp = { items: lines, active: opts.active || 0 };
  const env = {
    now: 0, timers, root, comp, lines, ctrl: 'items_line', component: 'main', pref: true, bytes: true, enabled: true, winListeners: [],
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
    pending: () => timers.filter((t) => !t.done),
    /* Одна ближайшая задача — таймер или колбэк простоя. */
    step() {
      const due = timers.filter((t) => !t.done).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) return null;
      if (due.at > env.now) env.now = due.at;
      due.done = true; due.fn();
      return due;
    },
    focus(at) { comp.active = at; root.listeners.filter((l) => l[0] === 'hover:focus' && l[2] === true).forEach((l) => l[1]({})); }
  };
  globalThis.addEventListener = (name, fn) => env.winListeners.push([name, fn]);
  globalThis.removeEventListener = (name, fn) => { env.winListeners = env.winListeners.filter((l) => !(l[0] === name && l[1] === fn)); };
  globalThis.document = { hidden: false };
  globalThis.Lampa = {
    Activity: { active: () => ({ component: env.component, activity: { component: comp, render: (js) => (js ? root : [root]) } }) },
    Controller: { enabled: () => ({ name: env.ctrl }) }
  };
  const { api } = loadCtx('58_rowmem.js', {
    pref: (name, def) => (name === 'lumen_rowmem' ? env.pref : name === 'lumen_rowmem_bytes' ? env.bytes : def),
    enabled: () => env.enabled
  });
  let seq = 0;
  api._timers = {
    set: (fn, ms) => { const t = { id: ++seq, at: env.now + ms, fn, done: false }; timers.push(t); return t.id; },
    clear: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; }
  };
  api._idle = {
    request: (fn) => { const t = { id: ++seq, at: env.now, fn: () => fn({ timeRemaining: () => 50 }), done: false, idle: true }; timers.push(t); return t.id; },
    cancel: (id) => { const t = timers.find((x) => x.id === id); if (t) t.done = true; }
  };
  env.api = api;
  return env;
}

const asleep = (l) => l.sc.style.display === 'none';
const lv = (l) => l.cards.filter((c) => c.classList.contains('layer--visible')).length;

test('rowmem: decide — гистерезис NEAR/FAR и байты BYTES_NEAR/BYTES_FAR', () => {
  const env = makeEnv();
  const R = env.api;
  assert.deepEqual([R.NEAR, R.FAR, R.BYTES_NEAR, R.BYTES_FAR], [3, 5, 7, 9]);
  assert.equal(R.decide(3, true, false, true).wake, true, 'спящий в пределах NEAR — будить');
  assert.equal(R.decide(4, true, false, true).wake, false, 'между NEAR и FAR — как был');
  assert.equal(R.decide(4, false, false, true).sleep, false);
  assert.equal(R.decide(5, false, false, true).sleep, true, 'с FAR — усыпить');
  assert.equal(R.decide(8, true, false, true).drop, false, 'байты — только с BYTES_FAR');
  assert.equal(R.decide(9, true, false, true).drop, true);
  assert.equal(R.decide(9, false, false, true).drop, true, 'ряд, который засыпает сейчас, тоже отпускает байты');
  assert.equal(R.decide(9, true, false, false).drop, false, 'байты выключены настройкой');
  assert.equal(R.decide(7, true, true, true).back, true, 'байты обратно — с BYTES_NEAR');
  assert.equal(R.decide(8, true, true, true).back, false);
  const p = R.plan(10, 16, [], true);
  assert.equal(p.filter((x) => x.sleep).length, 7, 'ряды 0..5 и 15 — на расстоянии ≥ FAR от 10');
  assert.equal(p.filter((x) => x.drop).length, 2, 'ряды 0 и 1 — ≥ BYTES_FAR');
});

test('rowmem: усыпление — только после QUIET_MS покоя, по одному ряду за колбэк простоя, самый дальний первым', () => {
  const env = makeEnv({ rows: 16, active: 12 });
  const R = env.api;
  R.mount([env.root]);
  env.advance(R.QUIET_MS - 1);
  assert.equal(env.lines.filter(asleep).length, 0, 'до покоя — ничего');
  const t1 = env.step();
  assert.ok(!t1.idle && env.now === R.QUIET_MS, 'таймер покоя');
  assert.equal(env.lines.filter(asleep).length, 0, 'таймер покоя только подаёт заявку на простой');
  assert.equal(env.pending().filter((t) => t.idle).length, 1);
  const t2 = env.step();
  assert.ok(t2.idle);
  assert.equal(env.lines.filter(asleep).length, 1, 'один ряд за колбэк простоя');
  assert.ok(asleep(env.lines[0]), 'самый дальний (0) — первым');
  env.advance(1000);
  const slept = env.lines.map((l, i) => (asleep(l) ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(slept, [0, 1, 2, 3, 4, 5, 6, 7], 'ряды на расстоянии ≥ FAR от 12');
  const l0 = env.lines[0];
  assert.equal(l0.body.style.height, '180px', 'высота тела закреплена — лента главной не сдвигается');
  assert.equal(lv(l0), 0, 'layer--visible снят — Layer.visible их не обходит');
  assert.equal(l0.cards.filter((c) => c.classList.contains(R.MARK)).length, 6);
  assert.equal(lv(env.lines[8]), 6, 'ряд на расстоянии 4 не тронут');
  assert.equal(R.stats().slept, 8);
});

test('rowmem: байты — снимаются у загруженных постеров рядов дальше BYTES_FAR, заглушки и недоехавшие не трогаются', () => {
  const env = makeEnv({ rows: 14, active: 13 });
  env.lines[1].cards[0].img.attrs.src = './img/img_load.svg';
  env.lines[1].cards[1].img.complete = false;
  env.lines[1].cards[1].img.naturalWidth = 0;
  const R = env.api;
  R.mount([env.root]);
  env.advance(R.QUIET_MS + 5000);
  const far = env.lines[1];
  assert.equal(far.cards[0].img.getAttribute('src'), './img/img_load.svg', 'заглушку Lampa не трогаем');
  assert.ok(far.cards[1].img.getAttribute('src'), 'недоехавший — src на месте (его вернул бы таймер Lampa)');
  assert.equal(far.cards[2].img.getAttribute('src'), null, 'загруженный — src снят');
  assert.ok(far.cards[2].img.lumen_rowmem_src.indexOf('r1_2.jpg') > 0, 'адрес помнится в узле');
  const mid = env.lines[5];
  assert.ok(asleep(mid), 'ряд на расстоянии 8 спит');
  assert.ok(mid.cards.every((c) => c.img.getAttribute('src')), 'но байты держит (BYTES_FAR = 9)');
  env.bytes = false;
  env.advance(R.QUIET_MS + 5000);
  assert.equal(R.stats().dropped, 5 * 6 - 2, 'ряды 0..4: 5 рядов по 6 постеров, минус заглушка и недоехавший');
});

test('rowmem: перевод фокуса будит ближние ряды СИНХРОННО и возвращает байты заранее', () => {
  const env = makeEnv({ rows: 20, active: 19 });
  const R = env.api;
  R.mount([env.root]);
  env.advance(R.QUIET_MS + 10000);
  assert.ok(asleep(env.lines[10]) && env.lines[10].cards[0].img.getAttribute('src') === null, 'ряд 10 спит без байтов');
  /* Серия вверх: 19 → 17. Ряд 10 на расстоянии 7 — байты обратно, но спит. */
  env.focus(18); env.focus(17);
  assert.ok(env.lines[10].cards[0].img.getAttribute('src').indexOf('r10_0.jpg') > 0, 'src вернулся без таймеров — в том же нажатии');
  assert.ok(asleep(env.lines[10]), 'на расстоянии 7 ряд ещё спит');
  env.focus(14);
  assert.ok(asleep(env.lines[10]), 'на расстоянии 4 — гистерезис, спит');
  env.focus(13);
  assert.ok(!asleep(env.lines[10]), 'на расстоянии 3 — проснулся');
  assert.equal(env.lines[10].body.style.height, '', 'высота отдана CSS');
  assert.equal(lv(env.lines[10]), 6, 'layer--visible вернулся');
  assert.equal(env.lines[10].cards[0].img.events, 1, 'src ставится один раз');
  for (let i = 10; i <= 16; i++) assert.ok(!asleep(env.lines[i]), 'ряды в пределах NEAR от 13 не спят: ' + i);
});

test('rowmem: серия нажатий — работа простоя не начинается, пока фокус не встал', () => {
  const env = makeEnv({ rows: 16, active: 12 });
  const R = env.api;
  R.mount([env.root]);
  for (let k = 0; k < 20; k++) { env.advance(200); env.focus(12); }
  assert.equal(env.lines.filter(asleep).length, 0);
  env.advance(R.QUIET_MS + 1000);
  assert.ok(env.lines.filter(asleep).length > 0);
});

test('rowmem: не главная, чужой контроллер, выключенная настройка — ни одного изменения', () => {
  for (const tweak of [(e) => { e.component = 'full'; }, (e) => { e.ctrl = 'menu'; }, (e) => { e.pref = false; }, (e) => { e.enabled = false; }]) {
    const env = makeEnv({ rows: 16, active: 12 });
    tweak(env);
    env.api.mount([env.root]);
    env.advance(20000);
    assert.equal(env.lines.filter(asleep).length, 0);
  }
});

test('rowmem: выключили посреди сеанса — спящие ряды просыпаются с байтами на ближайшем нажатии и на работе простоя', () => {
  for (const how of ['focus', 'idle']) {
    const env = makeEnv({ rows: 16, active: 15 });
    const R = env.api;
    R.mount([env.root]);
    /* 'focus' — вся работа сделана, таймеров нет, будит нажатие; 'idle' —
       выключили посреди работы простоя, будит её следующий колбэк. */
    if (how === 'focus') env.advance(R.QUIET_MS + 10000);
    else { env.advance(R.QUIET_MS - 1); env.step(); env.step(); }
    assert.ok(env.lines.filter(asleep).length > 0, how + ': до выключения ряды спят');
    env.pref = false;
    if (how === 'focus') env.focus(15);
    else env.advance(10000);
    assert.equal(env.lines.filter(asleep).length, 0, how + ': выключенный модуль не оставляет спящих рядов');
    assert.ok(env.lines.every((l) => l.cards.every((c) => c.img.getAttribute('src'))), how + ': байты постеров вернулись');
    env.advance(20000);
    assert.equal(env.lines.filter(asleep).length, 0, how + ': и больше не засыпают');
  }
});

test('rowmem: ряд не в раскладке (высота 0) — не трогается и больше не пробуется', () => {
  const env = makeEnv({ rows: 12, active: 11 });
  env.lines[0].body.offsetHeight = 0;
  const R = env.api;
  R.mount([env.root]);
  env.advance(R.QUIET_MS + 10000);
  assert.ok(!asleep(env.lines[0]));
  assert.equal(env.lines[0].body.style.height, undefined);
  assert.ok(env.lines[0].lumen_rowmem_skip);
  assert.ok(asleep(env.lines[1]));
});

test('rowmem: смена размера окна и выключение — все ряды просыпаются, слушатели сняты', () => {
  const env = makeEnv({ rows: 16, active: 15 });
  const R = env.api;
  R.mount([env.root]);
  env.advance(R.QUIET_MS + 10000);
  assert.ok(env.lines.filter(asleep).length > 0);
  env.winListeners.filter((l) => l[0] === 'resize').forEach((l) => l[1]());
  assert.equal(env.lines.filter(asleep).length, 0, 'resize — все проснулись (высоты устарели)');
  assert.ok(env.lines.every((l) => l.cards.every((c) => c.img.getAttribute('src'))), 'и байты вернулись');
  env.advance(R.QUIET_MS + 10000);
  assert.ok(env.lines.filter(asleep).length > 0, 'и снова уснули в простое с новыми высотами');
  R.uninstall();
  assert.equal(env.lines.filter(asleep).length, 0);
  assert.equal(env.root.listeners.length, 0);
  assert.equal(env.winListeners.length, 0);
  assert.equal(R.active(), false);
});

test('rowmem: незнакомая форма компонента — молчит без исключений', () => {
  const env = makeEnv({ rows: 4 });
  env.comp.items = null;
  const R = env.api;
  R.mount([env.root]);
  env.advance(20000);
  env.focus(0);
  assert.equal(R.active(), true);
  assert.equal(warnLog.filter((w) => /rowmem/.test(w.msg)).length, 0);
});

test('rowmem: detach — снимается, если корень вне стартующей активности; owns — свой корень', () => {
  const env = makeEnv();
  const R = env.api;
  R.mount([env.root]);
  assert.equal(R.owns([env.root]), true);
  R.detach([{ contains: () => false }]);
  assert.equal(R.active(), false);
});

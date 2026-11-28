import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

/* Аудит Codex 28.11.2026 (bugcheck/repros/data-continue-return.test.mjs):
   в «Досмотреть» две карточки, одну убрали меню («Убрать из «Досмотреть»»,
   LC.cardmenu.removeFromRow), потом нашли поиском и продолжили смотреть.
   Свежая запись Timeline снимает метку в Storage (LC.personal.onTimeline),
   но «Назад» достаёт главную из стека готовой: карточка в нарисованном ряду
   так и стояла с display:none и без .selector, а onMainStart убирал только
   досмотренное. Здесь — тот же сценарий с настоящим LC.cardmenu. */

globalThis.warn = globalThis.warn || function () { };

/* Ряд карточек, как scroll body ряда Lampa: children, appendChild,
   insertBefore и nextSibling — то, что трогает removeFromRow/restoreToRow. */
function fakeRow() {
  const row = {
    children: [],
    appendChild(k) { detach(k); this.children.push(k); k.parentNode = this; return k; },
    insertBefore(k, ref) {
      if (ref == null) return this.appendChild(k);
      detach(k);
      const i = this.children.indexOf(ref);
      if (i < 0) throw new Error('NotFoundError');
      this.children.splice(i, 0, k);
      k.parentNode = this;
      return k;
    },
    contains(n) { return this.children.includes(n); }
  };
  function detach(k) {
    if (!k.parentNode) return;
    const kids = k.parentNode.children;
    const i = kids.indexOf(k);
    if (i >= 0) kids.splice(i, 1);
  }
  return row;
}

function fakeNode(name, card, cls) {
  const set = new Set(cls);
  const node = {
    name, card_data: card, style: {}, parentNode: null,
    classList: { contains: (c) => set.has(c), add: (c) => set.add(c), remove: (...c) => c.forEach((x) => set.delete(x)) }
  };
  Object.defineProperty(node, 'nextSibling', {
    get() {
      const p = this.parentNode;
      if (!p) return null;
      return p.children[p.children.indexOf(this) + 1] || null;
    }
  });
  if (!card) delete node.card_data;
  return node;
}

/* order — порядок карточек в continues('movie'): так Lampa отдаёт историю
   (от свежих к старым). */
function setup(order) {
  const movie = { id: 42, title: 'Фильм', original_title: 'Film' };
  const neighbor = { id: 14, title: 'Другой фильм', original_title: 'Neighbor' };
  const byId = { 42: movie, 14: neighbor };
  const store = {};
  const start = Date.now() - 2000;
  const timeline = {
    Film: { hash: 'Film', card: 'movie_42', percent: 25, updated: start - 1000 },
    Neighbor: { hash: 'Neighbor', percent: 20, updated: start - 1000 }
  };
  const st = { order: order || [42, 14], navEl: null, sets: 0, focused: [], continuesCalls: 0 };
  const row = fakeRow();
  const elsewhere = fakeNode('elsewhere', { id: 7 }, ['card', 'selector']);
  const box = { length: 1, 0: { contains: (n) => row.contains(n) } };
  const slide = {
    querySelectorAll: (sel) => (sel === '.card' ? row.children.filter((c) => c.card_data) : []),
    contains: (n) => row.contains(n)
  };
  const main = { component: 'main', activity: { render: (js) => (js ? slide : null) } };
  const Lampa = {
    Favorite: {
      continues: (type) => { if (type === 'movie') st.continuesCalls++; return type === 'movie' ? st.order.map((id) => byId[id]) : []; },
      get: () => []
    },
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }
    },
    Timeline: { view: (h) => timeline[h] || { hash: h, percent: 0, time: 0, duration: 0, updated: 0 } },
    Utils: { hash: (s) => s },
    Activity: { active: () => main },
    Controller: {
      enabled: () => ({ name: 'items_line' }),
      collectionSet: () => { st.sets++; },
      collectionFocus: (t) => { st.focused.push(t.name); st.navEl = t; }
    }
  };
  globalThis.$ = () => ({ closest: () => box });
  globalThis.window = { Lampa, $: globalThis.$, Navigator: { getFocusedElement: () => st.navEl } };
  globalThis.Lampa = Lampa;
  globalThis.document = { body: { contains: (n) => row.contains(n) || n === elsewhere } };
  const menu = load('63_cardmenu.js');
  const ctx = loadCtx('45_personal.js', { lang: (k) => k, pref: (k, d) => d, cardmenu: menu });
  const personal = ctx.api;

  const describeRow = () => personal.describe().find((d) => d.id === 'continue');
  const fresh = () => { let got = null; describeRow().call({}, 'main')((p) => { got = p.results; }); return got; };
  /* Ряд нарисован из того, что отдал call, плюс «Ещё» Lampa в конце. */
  const drawn = fresh();
  const nodes = drawn.map((c) => fakeNode('c' + c.id, c, ['card', 'selector']));
  for (const n of nodes) row.appendChild(n);
  row.appendChild(fakeNode('more', null, ['selector']));
  const names = () => row.children.map((c) => c.name);
  const node = (id) => row.children.find((c) => c.card_data && c.card_data.id === id);
  return { st, row, store, start, timeline, personal, menu, main, fresh, names, node, elsewhere, LC: ctx.LC };
}

function cleanup() {
  delete globalThis.window; delete globalThis.Lampa; delete globalThis.document; delete globalThis.$;
}

/* Убрать фильм 42 из ряда меню: метка + removeFromRow, фокус на нём. */
function hideFromMenu(s) {
  const el = s.node(42);
  el.classList.add('focus');
  s.st.navEl = el;
  assert.equal(s.personal.hideContinue(el.card_data, s.start), true);
  assert.equal(s.menu.removeFromRow(el), true);
  assert.equal(el.style.display, 'none');
  assert.equal(el.classList.contains('selector'), false);
  return el;
}

/* Продолжили смотреть найденный поиском фильм: свежая запись Timeline. */
function resume(s) {
  const road = Object.assign({}, s.timeline.Film, { percent: 50, updated: s.start + 1000 });
  s.timeline.Film = road;
  s.personal.onTimeline({ hash: road.hash, road });
  s.personal.onFinished({ hash: road.hash, road });
}

test('«Досмотреть»: скрытый и снова начатый фильм возвращается в уже открытый ряд — виден, с .selector, на своём месте', () => {
  const s = setup([42, 14]);
  try {
    assert.deepEqual(s.names(), ['c42', 'c14', 'more']);
    const el = hideFromMenu(s);
    assert.deepEqual(s.names(), ['c14', 'more', 'c42'], 'убранная — в конце ряда');
    assert.equal(s.st.navEl.name, 'c14', 'фокус ушёл на соседа');

    resume(s);
    assert.equal(s.store.lumen_cw_hidden.movie_42, undefined, 'повторный просмотр снял метку');
    assert.deepEqual(s.fresh().map((c) => c.id), [42, 14], 'свежий ряд её уже показывает');

    /* «Назад»: Lampa вставила слайд, включила ряд с фокусом на Line.last. */
    s.st.sets = 0; s.st.focused.length = 0;
    assert.equal(s.personal.onMainStart(s.main), 1);
    assert.notEqual(el.style.display, 'none', 'карточка снова видна');
    assert.equal(el.classList.contains('selector'), true, 'карточкой снова можно управлять пультом');
    assert.deepEqual(s.names(), ['c42', 'c14', 'more'], 'порядок — как у свежего ряда, «Ещё» последним');
    assert.equal(s.st.sets, 1, 'фокус в этом ряду — коллекция пульта пересобрана');
    assert.deepEqual(s.st.focused, ['c14'], 'фокус остался на прежней карточке');

    s.st.sets = 0;
    assert.equal(s.personal.onMainStart(s.main), 0, 'повторный старт — уже на месте');
    assert.equal(s.st.sets, 0);
  } finally { cleanup(); }
});

test('«Досмотреть»: возврат ставит карточку по свежему порядку, а фокус в другом ряду не трогает', () => {
  const s = setup([42, 14]);
  try {
    const el = hideFromMenu(s);
    resume(s);
    /* Свежая история: сосед смотрелся позже — он первым. */
    s.st.order = [14, 42];
    s.st.navEl = s.elsewhere;
    s.st.sets = 0; s.st.focused.length = 0;
    assert.equal(s.personal.onMainStart(s.main), 1);
    assert.deepEqual(s.names(), ['c14', 'c42', 'more'], 'за соседом, перед «Ещё»');
    assert.equal(el.classList.contains('selector'), true);
    assert.equal(s.st.sets, 0, 'фокус в другом ряду — коллекцию «Досмотреть» не подставляем');
    assert.deepEqual(s.st.focused, []);
  } finally { cleanup(); }
});

test('«Досмотреть»: без нового просмотра убранная карточка на возврате остаётся убранной', () => {
  const s = setup([42, 14]);
  try {
    const el = hideFromMenu(s);
    s.st.continuesCalls = 0;
    assert.equal(s.personal.onMainStart(s.main), 0);
    assert.equal(el.style.display, 'none');
    assert.equal(el.classList.contains('selector'), false);
    assert.deepEqual(s.names(), ['c14', 'more', 'c42']);
  } finally { cleanup(); }
});

test('«Досмотреть»: без убранных карточек возврат свежий состав не собирает', () => {
  const s = setup([42, 14]);
  try {
    s.st.continuesCalls = 0;
    assert.equal(s.personal.onMainStart(s.main), 0);
    assert.equal(s.st.continuesCalls, 0, 'continues на каждом возврате не зовём');
    assert.deepEqual(s.names(), ['c42', 'c14', 'more']);
  } finally { cleanup(); }
});

test('«Досмотреть»: досмотренный фильм, начатый заново, возвращается тем же путём', () => {
  const s = setup([42, 14]);
  try {
    s.timeline.Film = Object.assign({}, s.timeline.Film, { percent: 96, updated: s.start + 500 });
    assert.equal(s.personal.onMainStart(s.main), 1, 'досмотренный ушёл');
    const el = s.node(42);
    assert.equal(el.style.display, 'none');
    s.timeline.Film = Object.assign({}, s.timeline.Film, { percent: 10, updated: s.start + 1500 });
    assert.equal(s.personal.onMainStart(s.main), 1, 'начат заново — вернулся');
    assert.notEqual(el.style.display, 'none');
    assert.deepEqual(s.names(), ['c42', 'c14', 'more']);
  } finally { cleanup(); }
});

test('pickReturned: только убранные карточки «Досмотреть» из свежего состава, по его порядку; ключ — с типом', () => {
  const P = load('45_personal.js');
  const mark = (c) => Object.assign({ lumen_continue: true }, c);
  const gone = (id, card) => ({ id, card_data: card, style: { display: 'none' } });
  const film = { id: 42, original_title: 'Film' };
  const show = { id: 42, name: 'Show', original_name: 'Show' };
  const other = { id: 14, original_title: 'Other' };
  const shown = { id: 15, original_title: 'Shown' };
  const nodes = [
    gone('film', mark(film)),
    gone('show', mark(show)),
    gone('foreign', film),
    { id: 'shown', card_data: mark(shown), style: { display: '' } },
    gone('other', mark(other)),
    { id: 'more' }
  ];
  const fresh = [other, shown, film];
  assert.deepEqual(P.pickReturned(nodes, fresh).map((b) => [b.el.id, b.at]), [['other', 0], ['film', 2]], 'сериал с тем же id не путается с фильмом, видимая и чужая — мимо');
  assert.deepEqual(P.pickReturned(nodes, []), []);
  assert.deepEqual(P.pickReturned(null, fresh), []);
});

/* Ревью фиксов 2026-11-28: после первого досмотренного фильма убранный узел
   в ряду есть всегда, и без счётчика каждый возврат собирал свежий состав
   (continues — десятки мс на слабом ТВ). Счётчик записей Timeline
   (LC.timelineGen, src/90_runtime.js): нет новой записи — нечего и
   возвращать. */
test('«Досмотреть»: без новой записи Timeline возврат свежий состав не собирает', () => {
  const s = setup([42, 14]);
  try {
    s.LC.timelineGen = 3;
    const el = hideFromMenu(s);
    s.st.continuesCalls = 0;
    assert.equal(s.personal.onMainStart(s.main), 0);
    assert.equal(s.st.continuesCalls, 1, 'первый возврат с убранной карточкой — сверка');
    assert.equal(s.personal.onMainStart(s.main), 0);
    assert.equal(s.st.continuesCalls, 1, 'записей Timeline не было — continues не зовётся');

    resume(s);
    s.LC.timelineGen += 1;
    assert.equal(s.personal.onMainStart(s.main), 1, 'новая запись — карточка вернулась');
    assert.equal(s.st.continuesCalls, 2);
    assert.notEqual(el.style.display, 'none');
  } finally { cleanup(); }
});

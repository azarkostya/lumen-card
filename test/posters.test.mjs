import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';

/* Исследование 2026-09-27 (полоса images): LC.posters (src/58_posters.js)
   грузит постеры карточек, которых Lampa ещё не создала: хвост ряда под
   фокусом и первые карточки рядов из очереди Lampa. План — чистая функция
   planPaths; рантайм читает компонент активности Lampa и держит не больше
   SLOTS запросов в пути. */

globalThis.warn = function () {};
const P = load('58_posters.js');

function res(prefix, n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: i, poster_path: '/' + prefix + i + '.jpg' });
  return out;
}

test('planPaths: ряд под фокусом — от первой несозданной карточки до двух экранов вперёд от фокуса', () => {
  const lines = [{ results: res('a', 20), made: 9, active: 4, view: 8, style: '' }];
  const got = P.planPaths(lines, 0, [], 2, 2);
  assert.deepEqual(got, res('a', 20).slice(9, 20).map((r) => r.poster_path));
});

test('planPaths: окно ряда ограничено active + view * ahead', () => {
  const lines = [{ results: res('a', 40), made: 9, active: 3, view: 8, style: '' }];
  const got = P.planPaths(lines, 0, [], 1, 2);
  /* active 3, view 8, ahead 1 → до индекса 3 + 8 = 11 включительно, созданы 0..8 */
  assert.deepEqual(got, ['/a9.jpg', '/a10.jpg', '/a11.jpg']);
  /* всё окно уже создано — ни одного пути */
  assert.deepEqual(P.planPaths([{ results: res('a', 40), made: 9, active: 0, view: 8, style: '' }], 0, [], 1, 2), []);
});

test('planPaths: ряд, в котором ещё не шагали вправо (active 0), хвоста не получает', () => {
  const lines = [{ results: res('a', 20), made: 8, active: 0, view: 8, style: '' }];
  assert.deepEqual(P.planPaths(lines, 0, [], 2, 2), []);
});

test('planPaths: ряды из очереди Lampa — первые view + 1, не дальше rows рядов ниже фокуса', () => {
  const lines = [
    { results: res('a', 8), made: 8, active: 0, view: 8, style: '' },
    { results: res('b', 8), made: 8, active: 0, view: 8, style: '' }
  ];
  const pending = [
    { results: res('c', 20), view: 8, style: '' },
    { results: res('d', 20), view: 8, style: '' },
    { results: res('e', 20), view: 8, style: '' }
  ];
  /* фокус на ряду 1: ниже в DOM рядов нет → два ряда из очереди */
  const got = P.planPaths(lines, 1, pending, 2, 2);
  assert.deepEqual(got, res('c', 9).concat(res('d', 9)).map((r) => r.poster_path));
  /* фокус на ряду 0: ниже один ряд в DOM → один ряд из очереди */
  const got0 = P.planPaths(lines, 0, pending, 2, 2);
  assert.deepEqual(got0, res('c', 9).map((r) => r.poster_path));
});

test('planPaths: широкие ряды и «коллекции» пропускаются, повторы — один раз, profile_path — как у Lampa', () => {
  const lines = [{ results: [{ poster_path: '/x.jpg' }, { profile_path: '/p.jpg' }, { poster_path: '/x.jpg' }, {}], made: 0, active: 1, view: 8, style: '' }];
  assert.deepEqual(P.planPaths(lines, 0, [{ results: res('w', 5), view: 8, style: 'wide' }], 2, 2), ['/x.jpg', '/p.jpg']);
  const wide = [{ results: res('a', 20), made: 0, active: 1, view: 8, style: 'collection' }];
  assert.deepEqual(P.planPaths(wide, 0, [], 2, 2), []);
});

function fakeWorld(comp) {
  const images = [];
  function FakeImage() { this.src = ''; this.onload = null; this.onerror = null; images.push(this); }
  globalThis.Image = FakeImage;
  globalThis.Lampa = {
    Activity: { active: () => ({ activity: { component: comp } }) },
    Api: { img: (p) => 'https://imagetmdb.com/t/p/w300' + p + '?email=' }
  };
  return images;
}

const tick = () => new Promise((r) => setTimeout(r, 5));

test('around: не больше четырёх запросов в пути, low-приоритет, адрес — Lampa.Api.img; готовый освобождает место', async () => {
  const comp = {
    active: 0,
    items: [{ data: { results: res('a', 20), params: {} }, items: new Array(9), active: 4, view: 8 }],
    loaded: []
  };
  const images = fakeWorld(comp);
  P.stop();
  P.around();
  P.around();
  assert.equal(images.length, 0, 'план — следующей задачей, не внутри нажатия');
  await tick();
  assert.equal(images.length, 4);
  assert.equal(images[0].src, 'https://imagetmdb.com/t/p/w300/a9.jpg?email=');
  assert.equal(images[0].fetchPriority, 'low');
  images[0].onload();
  assert.equal(images.length, 5);
  assert.equal(images[4].src, 'https://imagetmdb.com/t/p/w300/a13.jpg?email=');
  /* повторный план не грузит уже начатое */
  P.around();
  await tick();
  assert.equal(images.length, 5);
  for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  assert.equal(images.length, 11, 'весь хвост 9..19 — ровно по одному запросу');
  P.stop();
});

test('around: форма компонента не та или Lampa бросает — ни одного запроса', async () => {
  const images = fakeWorld(null);
  P.around();
  await tick();
  globalThis.Lampa.Activity.active = () => { throw new Error('x'); };
  P.around();
  await tick();
  globalThis.Lampa.Activity.active = () => ({ activity: { component: { items: {} } } });
  P.around();
  await tick();
  assert.equal(images.length, 0);
});

test('stop: очередь пуста, запланированный план снят', async () => {
  const comp = {
    active: 0,
    items: [{ data: { results: res('s', 30), params: {} }, items: new Array(0), active: 0, view: 8 }],
    loaded: []
  };
  const images = fakeWorld(comp);
  P.around();
  P.stop();
  await tick();
  assert.equal(images.length, 0);
});

/* Ревью rv6, RV6-5: кнопка «Ещё» первой в ряду (MoreFirst, app.min.js:18949)
   лежит в items, но карточкой results не является — хвост начинается с
   ближайшей несозданной карточки, а не на одну дальше. */
test('snapshot: кнопка «Ещё» в items не считается карточкой — хвост с ближайшей несозданной', async () => {
  const more = { more: true };
  const cards = [];
  for (let i = 0; i < 9; i++) cards.push({});
  const comp = {
    active: 0,
    items: [{ data: { results: res('m', 20), params: {} }, items: [more].concat(cards), more: more, active: 4, view: 8 }],
    loaded: []
  };
  const images = fakeWorld(comp);
  P.stop();
  P.around();
  await tick();
  assert.equal(images[0].src, 'https://imagetmdb.com/t/p/w300/m9.jpg?email=', 'первая несозданная — results[9]');
  for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  P.stop();
});

/* Ревью rv6, RV6-6: после stop() и нового плана при занятых слотах место,
   освобождённое загрузкой прошлого окна, отдаётся новой очереди сразу, а не
   на следующем переводе фокуса. */
test('stop и новый план: освободившийся слот старой загрузки будит очередь нового окна', async () => {
  const line = (p) => ({ data: { results: res(p, 20), params: {} }, items: new Array(9), active: 4, view: 8 });
  const images = fakeWorld({ active: 0, items: [line('o')], loaded: [] });
  P.stop();
  P.around();
  await tick();
  assert.equal(images.length, 4);
  P.stop();
  globalThis.Lampa.Activity.active = () => ({ activity: { component: { active: 0, items: [line('n')], loaded: [] } } });
  P.around();
  await tick();
  assert.equal(images.length, 4, 'все слоты заняты прошлым окном');
  images[0].onload();
  assert.equal(images.length, 5, 'слот старой загрузки отдан новой очереди');
  assert.equal(images[4].src, 'https://imagetmdb.com/t/p/w300/n9.jpg?email=');
  P.stop();
  for (let k = 0; k < 3; k++) for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  assert.equal(P.stats().fly, 0);
});

/* Этап 2б: ряды ниже фокуса — из очереди Lampa (loaded) и из заготовленной
   части (LC.rows.ahead, src/44_rows.js), только после QUIET покоя фокуса:
   при зажатой стрелке (переводы чаще QUIET) — ни одного запроса рядов ниже. */
import { loadCtx } from './_load.mjs';

test('ряды ниже: только после покоя QUIET, из loaded и из заготовки LC.rows.ahead; не дальше ROWS рядов', async () => {
  let aheadRows = [{ results: res('d', 20), params: {} }, { results: res('e', 20), params: {} }];
  const Q = loadCtx('58_posters.js', { rows: { ahead: () => aheadRows } }).api;
  assert.equal(Q.ROWS, 2);
  const comp = {
    active: 0,
    items: [{ data: { results: res('a', 8), params: {} }, items: new Array(8), active: 0, view: 8 }],
    loaded: [[{ results: res('c', 20), params: {} }]]
  };
  const images = fakeWorld(comp);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  /* Серия переводов чаще QUIET: хвоста у ряда нет (active 0), ряды ниже ждут. */
  for (let i = 0; i < 4; i++) {
    Q.around();
    await wait(Q.QUIET / 3);
  }
  assert.equal(images.length, 0, 'при серии нажатий рядов ниже не грузим');
  await wait(Q.QUIET + 60);
  assert.equal(images.length, 4, 'после покоя — сразу SLOTS запросов');
  for (let k = 0; k < 10; k++) for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  const got = images.map((im) => im.src.replace('https://imagetmdb.com/t/p/w300/', '').replace('.jpg?email=', ''));
  /* ряд из loaded (c) — первые view + 1 (view Lampa по умолчанию 7), за ним первый ряд заготовки (d); второй ряд заготовки (e) — уже третий ниже фокуса */
  assert.deepEqual(got, res('c', 8).concat(res('d', 8)).map((r) => r.poster_path.slice(1, -4)));
  Q.stop();
  aheadRows = [];
});

test('ряды ниже: заготовка бросает или отдаёт не массив — ряды из loaded грузятся как прежде', async () => {
  const Q = loadCtx('58_posters.js', { rows: { ahead: () => { throw new Error('x'); } } }).api;
  const comp = {
    active: 0,
    items: [{ data: { results: res('a', 8), params: {} }, items: new Array(8), active: 0, view: 8 }],
    loaded: [[{ results: res('g', 3), params: {} }]]
  };
  const images = fakeWorld(comp);
  Q.around();
  await new Promise((r) => setTimeout(r, Q.QUIET + 60));
  for (let k = 0; k < 3; k++) for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
  assert.equal(images.length, 3);
  Q.stop();
});

test('stop снимает и отложенный план рядов ниже', async () => {
  const Q = loadCtx('58_posters.js', { rows: { ahead: () => [] } }).api;
  const images = fakeWorld({
    active: 0,
    items: [{ data: { results: res('a', 8), params: {} }, items: new Array(8), active: 0, view: 8 }],
    loaded: [[{ results: res('h', 5), params: {} }]]
  });
  Q.around();
  Q.stop();
  await new Promise((r) => setTimeout(r, Q.QUIET + 60));
  assert.equal(images.length, 0);
});

/* Полоса gc3 (2026-09-27): на ТВ LoAF отдаёт имя функции, переданной
   таймеру (sourceFunctionName), а у анонимной — пусто, и
   «TimerHandler:setTimeout» в подвале самотеста не говорил, чей таймер. */
test('полоса gc3: таймеры плана и покоя, конец загрузки постера — именованные функции', async () => {
  const comp = {
    active: 0,
    items: [{ data: { results: res('t', 20), params: {} }, items: new Array(9), active: 4, view: 8 }],
    loaded: []
  };
  const images = fakeWorld(comp);
  const realSet = globalThis.setTimeout;
  const names = [];
  globalThis.setTimeout = (fn, ms) => { names.push(fn.name); return realSet(fn, ms); };
  try {
    P.stop();
    P.around();
  } finally {
    globalThis.setTimeout = realSet;
  }
  assert.deepEqual(names, ['onPostersIdle', 'onPostersPlan']);
  await tick();
  assert.ok(images.length > 0);
  assert.equal(images[0].onload.name, 'onPostersDone');
  assert.equal(images[0].onerror.name, 'onPostersDone');
  P.stop();
  for (let k = 0; k < 4; k++) for (let i = 0; i < images.length; i++) if (images[i].onload) images[i].onload();
});

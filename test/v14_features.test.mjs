import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

/* 1.4: статус сезона, «Убрать из «Досмотреть»». Рейтинг IMDb — в
   reviews.test.mjs рядом с рейтингом КП. */

const progress = load('70_progress.js');
const M = load('63_cardmenu.js');
const P = load('45_personal.js');

/* ------------------------- «просмотрено 5 из 12» ------------------------- */

test('seasonCount: считает досмотренные серии сезона найденной серии', () => {
  const movie = { original_name: 'Show' };
  const hash = (s) => s;
  const eps = [];
  for (let i = 1; i <= 12; i++) eps.push({ season_number: 2, episode_number: i });
  eps.push({ season_number: 1, episode_number: 1 });
  const done = { '21Show': 100, '22Show': 96, '23Show': 95, '24Show': 99, '25Show': 97, '26Show': 30, '11Show': 100 };
  const view = (h) => (done[h] ? { percent: done[h] } : null);
  assert.deepEqual(progress.seasonCount(movie, { season: 2, episode: 6 }, eps, view, hash), { done: 5, total: 12 });
});

test('seasonCount: ни одной досмотренной, нет серий, фильм — null', () => {
  const movie = { original_name: 'Show' };
  const hash = (s) => s;
  const eps = [{ season_number: 1, episode_number: 1 }, { season_number: 1, episode_number: 2 }];
  const view = (h) => (h === '11Show' ? { percent: 40 } : null);
  assert.equal(progress.seasonCount(movie, { season: 1, episode: 1 }, eps, view, hash), null);
  assert.equal(progress.seasonCount(movie, { season: 1, episode: 1 }, null, view, hash), null);
  assert.equal(progress.seasonCount(movie, { season: 0, episode: 0 }, eps, view, hash), null);
  assert.equal(progress.seasonCount(movie, null, eps, view, hash), null);
});

test('seasonCount: сезон больше 10 — хэш с разделителем, как у Lampa', () => {
  const movie = { original_name: 'Long' };
  const hash = (s) => s;
  const eps = [{ season_number: 12, episode_number: 3 }, { season_number: 12, episode_number: 4 }];
  const view = (h) => (h === '12:3Long' ? { percent: 100 } : null);
  assert.deepEqual(progress.seasonCount(movie, { season: 12, episode: 4 }, eps, view, hash), { done: 1, total: 2 });
});

/* ----------------------- «Убрать из «Досмотреть»» ------------------------ */

const W = {
  section: 'Ещё', trailer: 'Трейлер', franchise: 'Вся франшиза', similar: 'Похожие',
  watched: 'Отметить', unwatched: 'Снять', hide: 'Скрыть', unhide: 'Вернуть',
  cwHide: 'Убрать из «Досмотреть»'
};
const kinds = (items) => items.map((i) => i.lumen);
const TV = { id: 82856, name: 'Мандалорец', original_name: 'The Mandalorian', first_air_date: '2019-11-12' };

test('extraItems: «Убрать из «Досмотреть»» — только у карточки ряда «Досмотреть»', () => {
  assert.equal(kinds(M.extraItems(TV, { words: W, cwHide: true })).indexOf('cw_hide'), -1);
  const cont = Object.assign({ lumen_continue: true }, TV);
  assert.notEqual(kinds(M.extraItems(cont, { words: W, cwHide: true })).indexOf('cw_hide'), -1);
  assert.equal(kinds(M.extraItems(cont, { words: W })).indexOf('cw_hide'), -1, 'без LC.personal пункта нет');
});

test('hiddenKey: тот же ключ, что Timeline.link у Lampa', () => {
  assert.equal(P.hiddenKey({ id: 5, title: 'A', original_title: 'A' }), 'movie_5');
  assert.equal(P.hiddenKey({ id: 7, name: 'B', original_name: 'B' }), 'tv_7');
  assert.equal(P.hiddenKey({ id: 9, original_title: 'C', source: 'cub' }), 'movie_9');
  assert.equal(P.hiddenKey({ id: 9, original_title: 'C', source: 'Kino-Pub' }), 'kinopub_movie_9');
  assert.equal(P.hiddenKey({}), '');
  /* Ревью 1.4: тип — только по original_name, ровно как Timeline.link
     (app.min.js:24483); иначе ключ метки разошёлся бы с записью Timeline. */
  assert.equal(P.hiddenKey({ id: 11, name: 'D', number_of_seasons: 3, first_air_date: '2020-01-01' }), 'movie_11');
  assert.equal(P.hiddenKey({ id: 0, original_name: 'E' }), '', 'id 0 Lampa не привязывает');
});

function movie(id, title) { return { id: id, title: title, original_title: title }; }

test('dropHidden: скрытая уходит, начатая после метки — остаётся', () => {
  const items = [movie(1, 'A'), movie(2, 'B'), movie(3, 'C')];
  const hidden = { movie_1: 1000, movie_2: 1000 };
  const upd = (c) => (c.id === 2 ? 2000 : 500);
  assert.deepEqual(P.dropHidden(items, hidden, upd).map((c) => c.id), [2, 3]);
  assert.deepEqual(P.dropHidden(items, null, upd).map((c) => c.id), [1, 2, 3]);
});

function setup(timeline, continues) {
  const store = {};
  const timelineWrites = [];
  const favoriteWrites = [];
  const Lampa = {
    Favorite: {
      continues: continues,
      get: () => [],
      add: () => favoriteWrites.push('add'),
      remove: () => favoriteWrites.push('remove'),
      toggle: () => favoriteWrites.push('toggle')
    },
    Timeline: {
      view: (h) => timeline[h] || { hash: h, percent: 0, time: 0, duration: 0, updated: 0 },
      update: (p) => timelineWrites.push(p)
    },
    Utils: { hash: (s) => 'h:' + s },
    Storage: {
      field: () => undefined,
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v) => { store[k] = JSON.parse(JSON.stringify(v)); }
    }
  };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  const ctx = loadCtx('45_personal.js', { lang: (k) => k, pref: (k, d) => d, daysWord: (n) => n + ' d' });
  function ids() {
    const cont = ctx.api.describe().filter((d) => d.name === 'lumen_continue')[0];
    if (!cont) return [];
    let got = null;
    cont.call({}, 'main')((p) => { got = p; });
    return got.results.map((c) => c.id);
  }
  return { api: ctx.api, store, timelineWrites, favoriteWrites, ids };
}

test('Досмотреть: «Убрать» скрывает карточку, не трогая Timeline и Favorite; новый просмотр возвращает', () => {
  try {
    const s = setup({}, (type) => (type === 'tv' ? [Object.assign({ number_of_seasons: 2 }, TV), { id: 3, name: 'X', original_name: 'X', first_air_date: '2020-01-01' }] : []));
    assert.deepEqual(s.ids(), [82856, 3]);
    assert.equal(s.api.hideContinue(TV, 1000), true);
    assert.deepEqual(s.ids(), [3]);
    assert.deepEqual(s.timelineWrites, []);
    assert.deepEqual(s.favoriteWrites, []);

    /* Запись старше метки (синхронизация) — не возвращает. */
    s.api.onTimeline({ hash: 'x', road: { card: 'tv_82856', season: 1, episode: 2, percent: 50, updated: 900 } });
    assert.deepEqual(s.ids(), [3]);
    /* «Снять отметку» (0 %) — не просмотр. */
    s.api.onTimeline({ hash: 'x', road: { card: 'tv_82856', percent: 0, updated: 5000 } });
    assert.deepEqual(s.ids(), [3]);
    s.api.onTimeline({ hash: 'x', road: { card: 'tv_82856', season: 1, episode: 2, percent: 12, updated: 5000 } });
    assert.deepEqual(s.ids(), [82856, 3]);
    assert.deepEqual(s.store.lumen_cw_hidden, {}, 'метка снята');
  } finally { delete globalThis.window; delete globalThis.Lampa; }
});

test('Досмотреть: фильм возвращается сам, если его таймкод новее метки', () => {
  try {
    const timeline = { 'h:Аватар': { percent: 40, updated: 500 } };
    const s = setup(timeline, (type) => (type === 'movie' ? [movie(1, 'Аватар'), movie(2, 'Дюна')] : []));
    s.api.hideContinue(movie(1, 'Аватар'), 1000);
    assert.deepEqual(s.ids(), [2]);
    timeline['h:Аватар'] = { percent: 45, updated: 2000 };
    assert.deepEqual(s.ids(), [1, 2]);
  } finally { delete globalThis.window; delete globalThis.Lampa; }
});

test('Досмотреть: убраны все — ряда нет; меток не больше 100', () => {
  try {
    const s = setup({}, (type) => (type === 'movie' ? [movie(1, 'A')] : []));
    for (let i = 0; i < 120; i++) s.api.hideContinue(movie(1000 + i, 'Z' + i), 10 + i);
    s.api.hideContinue(movie(1, 'A'), 5000);
    assert.deepEqual(s.ids(), []);
    const keys = Object.keys(s.store.lumen_cw_hidden);
    assert.equal(keys.length, 100);
    assert.equal(s.store.lumen_cw_hidden.movie_1, 5000);
    assert.equal(s.store.lumen_cw_hidden.movie_1000, undefined, 'самая старая вытеснена');
  } finally { delete globalThis.window; delete globalThis.Lampa; }
});

/* ------------- досмотренный фильм уходит из нарисованного ряда ------------- */

/* Узел карточки, как у Lampa: объект карточки в node.card_data. */
function cardNode(id, card, hidden) {
  return { id: id, card_data: card, style: { display: hidden ? 'none' : '' } };
}
const cont = (card) => Object.assign({ lumen_continue: true }, card);

test('pickFinished: только видимые карточки «Досмотреть», досмотренные тем же правилом, что при сборке', () => {
  const pct = { 'Аватар': 95, 'Дюна': 40, 'The Mandalorian': 100 };
  const percentOf = (c) => pct[c.original_title || c.original_name] || 0;
  const nodes = [
    cardNode('row-avatar', cont(movie(1, 'Аватар'))),
    cardNode('other-row-avatar', movie(1, 'Аватар')),
    cardNode('row-dune', cont(movie(2, 'Дюна'))),
    cardNode('row-avatar-gone', cont(movie(1, 'Аватар')), true),
    cardNode('row-show', cont(Object.assign({ number_of_seasons: 2 }, TV))),
    { id: 'more' }
  ];
  assert.deepEqual(P.pickFinished(nodes, percentOf).map((n) => n.id), ['row-avatar'], 'сериал — мимо, как в dropFinished');
  assert.deepEqual(P.pickFinished(null, percentOf), []);
  assert.deepEqual(P.pickFinished(nodes, null), []);
});

/* Слайд активности, как object.activity.render(true) у Lampa; calls —
   сколько раз в нём искали карточки. */
function slideOf(nodes, calls) {
  return { querySelectorAll: (sel) => { if (calls) calls.n++; return sel === '.card' ? nodes : []; } };
}
function mainObject(nodes, calls) {
  const slide = slideOf(nodes, calls);
  return { activity: { render: (js) => (js ? slide : null) } };
}

/* opts.activeNodes — карточки АКТИВНОГО экрана (Lampa.Activity.active()),
   opts.docNodes — весь документ (там же может лежать главная из истории). */
function finishedSetup(opts) {
  opts = opts || {};
  const removed = [];
  const removeOpts = [];
  const timeline = opts.timeline || {};
  const activeCalls = { n: 0 };
  const docCalls = { n: 0 };
  const active = mainObject(opts.activeNodes || [], activeCalls);
  const Lampa = {
    Utils: { hash: (s) => 'h:' + s },
    Timeline: { view: (h) => ({ hash: h, percent: timeline[h] || 0, time: 0, duration: 0, updated: 0 }) },
    Activity: { active: () => active }
  };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  globalThis.document = { querySelectorAll: (sel) => { docCalls.n++; return sel === '.card' ? (opts.docNodes || []) : []; } };
  const init = { lang: (k) => k, pref: (k, d) => d, daysWord: (n) => n + ' d' };
  if (opts.menu !== false) {
    init.cardmenu = {
      removeFromRow: (el, o) => { removed.push(el.id); removeOpts.push(o); el.style.display = 'none'; return true; }
    };
  }
  const ctx = loadCtx('45_personal.js', init);
  return { api: ctx.api, removed, removeOpts, timeline, activeCalls, docCalls };
}

function finishedCleanup(s) {
  if (s) s.api.sweepFinished(slideOf([]));
  delete globalThis.window; delete globalThis.Lampa; delete globalThis.document;
}

/* Фоновая уборка обязана звать removeFromRow с { background: true }:
   без флага collectionSet на 'start' главной убивал её фокус (стенд). */
function assertBackground(s) {
  assert.ok(s.removeOpts.length > 0);
  for (const o of s.removeOpts) assert.equal(o && o.background, true, 'removeFromRow — в фоновом режиме');
}

test('Досмотреть: главной не было в документе во время записи — фильм уходит на возврате', async () => {
  /* Путь Philips: главная → карточка → «Торренты» → плеер. На третьей
     активности Lampa снимает слайд главной (Activity.limit → stop), и
     запись таймкода приходит, когда ряда в документе нет. */
  const s = finishedSetup({ activeNodes: [], docNodes: [] });
  try {
    const rowNodes = [cardNode('avatar', cont(movie(1, 'Аватар'))), cardNode('dune', cont(movie(2, 'Дюна')))];
    s.timeline['h:Аватар'] = 96;
    s.api.onFinished({ hash: 'h:Аватар', road: { percent: 96 } });
    await new Promise((r) => setTimeout(r, 350));
    assert.deepEqual(s.removed, [], 'ряда на экране нет — убирать нечего');
    /* «Назад» до главной: Lampa вставила слайд и шлёт 'start'. */
    assert.equal(s.api.onMainStart(mainObject(rowNodes)), 1);
    assert.deepEqual(s.removed, ['avatar']);
    assertBackground(s);
    assert.equal(s.api.onMainStart(mainObject(rowNodes)), 0, 'повторный старт — уже убрана');
  } finally { finishedCleanup(s); }
});

test('Досмотреть: главная в истории под страницей фильма — таймер её не трогает, уходит на возврате', async () => {
  /* Стек [главная, фильм]: слайд главной в документе, но не активен.
     Убери таймер карточку сейчас — на «Назад» Line.last окажется скрытым,
     и фокус уедет на первую карточку ряда. */
  const mainNodes = [cardNode('avatar', cont(movie(1, 'Аватар'))), cardNode('dune', cont(movie(2, 'Дюна')))];
  const s = finishedSetup({ activeNodes: [], docNodes: mainNodes, timeline: { 'h:Аватар': 97 } });
  try {
    s.api.onFinished({ hash: 'h:Аватар', road: { percent: 97 } });
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(s.activeCalls.n, 1, 'обошли активный экран');
    assert.equal(s.docCalls.n, 0, 'по всему документу не искали');
    assert.deepEqual(s.removed, [], 'главная в истории не тронута');
    assert.equal(s.api.onMainStart(mainObject(mainNodes)), 1);
    assert.deepEqual(s.removed, ['avatar']);
    assertBackground(s);
  } finally { finishedCleanup(s); }
});

test('Досмотреть: запись от порога, главная на экране — уходит по таймеру, пачка CUB — один обход', async () => {
  const nodes = [cardNode('avatar', cont(movie(1, 'Аватар'))), cardNode('dune', cont(movie(2, 'Дюна')))];
  const s = finishedSetup({ activeNodes: nodes });
  try {
    s.timeline['h:Аватар'] = 100;
    s.timeline['h:Дюна'] = 97;
    s.api.onFinished({ hash: 'h:Аватар', road: { percent: 100 } });
    s.api.onFinished({ hash: 'h:Дюна', road: { percent: 97 } });
    s.api.onFinished({ hash: 'h:Дюна', road: { percent: 98 } });
    assert.equal(s.activeCalls.n, 0, 'не сразу');
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(s.activeCalls.n, 1, 'один обход на пачку');
    assert.deepEqual(s.removed.sort(), ['avatar', 'dune']);
    assertBackground(s);
  } finally { finishedCleanup(s); }
});

test('Досмотреть: ниже порога, пустое событие и сериал — ряд не трогается', async () => {
  const show = cont(Object.assign({ number_of_seasons: 2 }, TV));
  const nodes = [cardNode('dune', cont(movie(2, 'Дюна'))), cardNode('show', show)];
  const s = finishedSetup({ activeNodes: nodes, timeline: { 'h:Дюна': 89, 'h:The Mandalorian': 100 } });
  try {
    s.api.onFinished({ hash: 'h:Дюна', road: { percent: 89 } });
    s.api.onFinished(null);
    s.api.onFinished({ hash: 'x' });
    await new Promise((r) => setTimeout(r, 350));
    assert.equal(s.activeCalls.n, 0, 'таймер не заведён');
    assert.equal(s.api.onMainStart(mainObject(nodes)), 0, '89 % и сериал остаются');
    assert.deepEqual(s.removed, []);
  } finally { finishedCleanup(s); }
});

test('Досмотреть: без LC.cardmenu ничего не трогает и не падает', () => {
  const nodes = [cardNode('avatar', cont(movie(1, 'Аватар')))];
  const s = finishedSetup({ activeNodes: nodes, timeline: { 'h:Аватар': 95 }, menu: false });
  try {
    assert.equal(s.api.onMainStart(mainObject(nodes)), 0);
    assert.equal(s.api.sweepFinished(slideOf(nodes)), 0);
    assert.equal(s.api.onMainStart(null), 0, 'без объекта активности');
  } finally { finishedCleanup(s); }
});

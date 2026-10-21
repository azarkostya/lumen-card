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

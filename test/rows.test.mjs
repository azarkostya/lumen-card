import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const R = load('44_rows.js');

/* Минимальный манифест для тестов */
var MANIFEST = {
  version: 1,
  home: ['star-wars', 'kp-top250', 'anime'],
  groups: [{ id: 'franchise' }, { id: 'kp' }, { id: 'country' }, { id: 'theme' }],
  collections: [
    { id: 'star-wars', title: 'Звёздные войны', group: 'franchise', sources: { movie: { type: 'collection', id: 10 } } },
    { id: 'kp-top250', title: 'КП Топ-250 фильмов', group: 'kp', badge: 'KINOPOISK', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } },
    { id: 'anime', title: 'Аниме', group: 'country', sources: { tv: { type: 'discover', params: {} } } },
    { id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', season: [12, 1], sources: { movie: { type: 'discover', params: {} } } },
    { id: 'comedy', title: 'Комедии', group: 'theme', sources: { movie: { type: 'discover', params: {} } } }
  ]
};

// --- rowName ---
test('rowName: возвращает строку с префиксом lumen_', function () {
  assert.equal(R.rowName('star-wars'), 'lumen_star-wars');
  assert.equal(R.rowName('kp-top250'), 'lumen_kp-top250');
  assert.equal(R.rowName('continue'), 'lumen_continue');
});

// --- filterWatched ---
test('filterWatched: hide=false — возвращает исходный массив', function () {
  var items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  var result = R.filterWatched(items, [1, 2], false);
  assert.deepEqual(result, items);
});
test('filterWatched: hide=true — убирает просмотренные', function () {
  var items = [{ id: 1 }, { id: 2 }, { id: 3 }];
  var result = R.filterWatched(items, [2], true);
  assert.deepEqual(result, [{ id: 1 }, { id: 3 }]);
});
test('filterWatched: hide=true, viewedIds пустой — ничего не убирает', function () {
  var items = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(R.filterWatched(items, [], true), items);
});
test('filterWatched: hide=true, все просмотрены — возвращает []', function () {
  var items = [{ id: 1 }, { id: 2 }];
  assert.deepEqual(R.filterWatched(items, [1, 2], true), []);
});
test('filterWatched: null/undefined viewedIds не падает', function () {
  var items = [{ id: 1 }];
  assert.deepEqual(R.filterWatched(items, null, true), items);
  assert.deepEqual(R.filterWatched(items, undefined, true), items);
});
test('filterWatched: null results не падает', function () {
  assert.deepEqual(R.filterWatched(null, [1], true), []);
  assert.deepEqual(R.filterWatched(undefined, [1], true), []);
});

// --- homeRows ---
test('homeRows: возвращает объекты подборок по id из manifest.home', function () {
  var rows = R.homeRows(MANIFEST, null, null, 15);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 'star-wars');
  assert.equal(rows[1].id, 'kp-top250');
  assert.equal(rows[2].id, 'anime');
});
test('homeRows: лимит обрезает список', function () {
  var rows = R.homeRows(MANIFEST, null, null, 2);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'star-wars');
});
test('homeRows: сезонные подборки поднимаются наверх по месяцу', function () {
  /* xmas-comedy season:[12,1] не в home — добавим вручную через storedIds */
  var m2 = {
    version: 1,
    home: ['comedy', 'xmas-comedy', 'anime'],
    groups: MANIFEST.groups,
    collections: MANIFEST.collections
  };
  var rows = R.homeRows(m2, null, 12, 15); /* декабрь */
  assert.equal(rows[0].id, 'xmas-comedy'); /* сезонная наверх */
  assert.equal(rows.length, 3);
});
test('homeRows: не сезонный месяц — сезонные не поднимаются', function () {
  var m2 = {
    version: 1,
    home: ['comedy', 'xmas-comedy'],
    groups: MANIFEST.groups,
    collections: MANIFEST.collections
  };
  var rows = R.homeRows(m2, null, 6, 15); /* июнь */
  assert.equal(rows[0].id, 'comedy');
  assert.equal(rows[1].id, 'xmas-comedy');
});
test('homeRows: неизвестный id в home пропускается', function () {
  var m2 = {
    version: 1,
    home: ['star-wars', 'UNKNOWN_ID', 'anime'],
    groups: MANIFEST.groups,
    collections: MANIFEST.collections
  };
  var rows = R.homeRows(m2, null, null, 15);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'star-wars');
  assert.equal(rows[1].id, 'anime');
});
test('homeRows: storedIds переопределяет список home', function () {
  /* storedIds задан — используем его вместо manifest.home */
  var rows = R.homeRows(MANIFEST, ['anime', 'star-wars'], null, 15);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'anime');
  assert.equal(rows[1].id, 'star-wars');
});
test('homeRows: storedIds пустой массив — используется manifest.home', function () {
  var rows = R.homeRows(MANIFEST, [], null, 15);
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, 'star-wars');
});
test('homeRows: manifest без home — возвращает []', function () {
  var m = { version: 1, home: [], groups: [], collections: [] };
  assert.deepEqual(R.homeRows(m, null, null, 15), []);
});
test('homeRows: limit 0 — возвращает []', function () {
  assert.deepEqual(R.homeRows(MANIFEST, null, null, 0), []);
});
test('homeRows: без limit — не обрезает', function () {
  var rows = R.homeRows(MANIFEST, null, null);
  assert.equal(rows.length, 3);
});

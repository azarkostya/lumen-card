import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const progress = load('70_progress.js');

/* Характеризационные тесты ТЕКУЩЕГО поведения LC.progress — логику не менять,
   эти тесты фиксируют, как movieProgress/serialProgress ведут себя сейчас. */

function neverCalled(name) {
  return function () { throw new Error(name + ' не должен вызываться'); };
}

/* ------------------------------ movieProgress ------------------------------ */

test('movieProgress: находит запись только по точному хэшу original_title', () => {
  var movie = { original_title: 'Dune: Part Two' };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:Dune: Part Two' ? { percent: 43 } : null; };
  var found = progress.movieProgress(movie, view, hash);
  assert.ok(found);
  assert.equal(found.view.percent, 43);
  assert.equal(found.season, 0);
  assert.equal(found.episode, 0);
});

test('movieProgress: percent 0 -> null', () => {
  var movie = { original_title: 'Dune: Part Two' };
  var hash = function (s) { return 'h:' + s; };
  var view = function () { return { percent: 0 }; };
  assert.equal(progress.movieProgress(movie, view, hash), null);
});

test('movieProgress: фильм без title/original_title/name -> null, view/hash не вызываются', () => {
  var movie = {};
  var found = progress.movieProgress(movie, neverCalled('view'), neverCalled('hash'));
  assert.equal(found, null);
});

/* ------------------------------ serialProgress ------------------------------ */

test('serialProgress: S1E5 (updated 9) обгоняет S2E1 (updated 5)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) {
    if (h === 'h:15Fallout') return { percent: 10, updated: 9 }; // S1E5
    if (h === 'h:21Fallout') return { percent: 10, updated: 5 }; // S2E1
    return null;
  };
  var found = progress.serialProgress(movie, view, hash);
  assert.equal(found.season, 1);
  assert.equal(found.episode, 5);
});

test('serialProgress: при равном updated побеждает более поздняя в порядке перебора (>=)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) {
    if (h === 'h:12Fallout') return { percent: 5, updated: 7 }; // S1E2 — раньше по перебору
    if (h === 'h:15Fallout') return { percent: 8, updated: 7 }; // S1E5 — тот же updated, но позже
    return null;
  };
  var found = progress.serialProgress(movie, view, hash);
  assert.equal(found.episode, 5);
  assert.equal(found.view.percent, 8);
});

test('serialProgress: percent 0 игнорируется', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:11Fallout' ? { percent: 0, updated: 5 } : null; };
  assert.equal(progress.serialProgress(movie, view, hash), null);
});

test('serialProgress: number_of_seasons=12 клампится до 10 — запись у S11E1 не находится', () => {
  var movie = { original_name: 'X', number_of_seasons: 12 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:11:1X' ? { percent: 50, updated: 1 } : null; }; // S11E1
  assert.equal(progress.serialProgress(movie, view, hash), null);
});

test('serialProgress: number_of_seasons=undefined -> перебирается только сезон 1 (S2 недостижим)', () => {
  var movie = { original_name: 'X', number_of_seasons: undefined };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:21X' ? { percent: 50, updated: 1 } : null; }; // S2E1
  assert.equal(progress.serialProgress(movie, view, hash), null);
});

test('serialProgress: number_of_seasons=undefined -> сезон 1 находится', () => {
  var movie = { original_name: 'X', number_of_seasons: undefined };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:11X' ? { percent: 50, updated: 1 } : null; }; // S1E1
  var found = progress.serialProgress(movie, view, hash);
  assert.equal(found.season, 1);
  assert.equal(found.episode, 1);
});

test('serialProgress: number_of_seasons="abc" -> тоже только сезон 1 (S2 недостижим)', () => {
  var movie = { original_name: 'X', number_of_seasons: 'abc' };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:21X' ? { percent: 50, updated: 1 } : null; }; // S2E1
  assert.equal(progress.serialProgress(movie, view, hash), null);
});

test('serialProgress: серия 30 находится, серия 31 — нет (перебор ep 1..30)', () => {
  var movie = { original_name: 'X', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };

  var view30 = function (h) { return h === 'h:130X' ? { percent: 20, updated: 1 } : null; };
  var found30 = progress.serialProgress(movie, view30, hash);
  assert.equal(found30.episode, 30);

  var view31 = function (h) { return h === 'h:131X' ? { percent: 20, updated: 1 } : null; };
  assert.equal(progress.serialProgress(movie, view31, hash), null);
});

test('serialProgress: при original_name и original_title вместе ключом служит original_name', () => {
  var movie = { original_name: 'NameKey', original_title: 'TitleKey', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:11NameKey' ? { percent: 10, updated: 1 } : null; };
  var found = progress.serialProgress(movie, view, hash);
  assert.ok(found);
  assert.equal(found.season, 1);
  assert.equal(found.episode, 1);
});

test('serialProgress: сериал без ключей -> null, view/hash не вызываются', () => {
  var movie = {};
  var found = progress.serialProgress(movie, neverCalled('view'), neverCalled('hash'));
  assert.equal(found, null);
});

/* ------------------------------ episodeState (Task 5c) ------------------------------ */

/* now — локальная дата поздним вечером: сравнение по календарным дням не
   должно зависеть от часа и часового пояса (air_date — строка 'YYYY-MM-DD'). */
const NOW = new Date(2026, 10, 16, 23, 50); // 16 ноября 2026, 23:50 местного

test('episodeState: percent >= 95 -> watched (даже если дата в будущем)', () => {
  assert.deepEqual(progress.episodeState({ percent: 95 }, '2026-01-01', NOW), { state: 'watched' });
  assert.deepEqual(progress.episodeState({ percent: 100 }, '2027-01-01', NOW), { state: 'watched' });
});

test('episodeState: 0 < percent < 95 -> watching, percent и leftMin по time/duration (вниз, как на экране 05)', () => {
  // 18:40 из 58:12 -> осталось 39.5 мин -> 39
  assert.deepEqual(progress.episodeState({ percent: 32, time: 1120, duration: 3492 }, '2026-01-01', NOW),
    { state: 'watching', percent: 32, leftMin: 39 });
});

test('episodeState: watching — осталось меньше минуты -> leftMin 1, дробный percent округляется', () => {
  assert.deepEqual(progress.episodeState({ percent: 94.6, time: 590, duration: 600 }, '2026-01-01', NOW),
    { state: 'watching', percent: 95, leftMin: 1 });
});

test('episodeState: watching без duration -> leftMin из runtimeMin, без обоих -> null', () => {
  assert.deepEqual(progress.episodeState({ percent: 50 }, '2026-01-01', NOW, 60), { state: 'watching', percent: 50, leftMin: 30 });
  assert.deepEqual(progress.episodeState({ percent: 50 }, '2026-01-01', NOW), { state: 'watching', percent: 50, leftMin: null });
});

test('episodeState: не начата, дата сегодня или в прошлом -> aired', () => {
  assert.deepEqual(progress.episodeState(null, '2026-11-16', NOW), { state: 'aired' });
  assert.deepEqual(progress.episodeState({ percent: 0 }, '2025-12-16', NOW), { state: 'aired' });
});

test('episodeState: дата в будущем (завтра по календарю) -> soon', () => {
  assert.deepEqual(progress.episodeState(null, '2026-11-17', new Date(2026, 10, 16, 0, 5)), { state: 'soon' });
  assert.deepEqual(progress.episodeState({ percent: 0 }, '2026-12-17', NOW), { state: 'soon' });
});

test('episodeState: нет air_date -> soon (TMDB не даёт дату только не вышедшим сериям)', () => {
  assert.deepEqual(progress.episodeState(null, '', NOW), { state: 'soon' });
  assert.deepEqual(progress.episodeState(null, null, NOW), { state: 'soon' });
});

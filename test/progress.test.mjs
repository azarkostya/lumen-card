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

/* ------------------------------ Task 8: порог «досмотрено» ------------------------------ */

test('movieProgress: percent >= 95 -> null (фильм досмотрен, продолжать нечего)', () => {
  var movie = { original_title: 'Dune: Part Two' };
  var hash = function (s) { return 'h:' + s; };
  assert.equal(progress.movieProgress(movie, function () { return { percent: 95 }; }, hash), null);
  assert.equal(progress.movieProgress(movie, function () { return { percent: 97 }; }, hash), null);
  assert.ok(progress.movieProgress(movie, function () { return { percent: 94.9 }; }, hash));
});

test('serialProgress: досмотренные серии пропускаются при общем переборе', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) {
    if (h === 'h:11Fallout') return { percent: 100, updated: 9 }; // S1E1 досмотрена
    if (h === 'h:12Fallout') return { percent: 20, updated: 5 };  // S1E2 начата
    return null;
  };
  var found = progress.serialProgress(movie, view, hash);
  assert.equal(found.episode, 2, 'досмотренная серия не «продолжается», даже если она свежее по updated');
});

test('serialProgress: без episodes переход к следующей серии не делается (данных о ней нет)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 1 };
  var hash = function (s) { return 'h:' + s; };
  var view = function (h) { return h === 'h:11Fallout' ? { percent: 100, updated: 9 } : null; };
  assert.equal(progress.serialProgress(movie, view, hash), null);
});

/* ------------------------------ Task 8: приоритет последнего сезона ------------------------------ */

/* episodes — e.data.episodes.episodes[]: серии ТОЛЬКО последнего сезона
   (API_NOTES_3), поля season_number/episode_number/name/runtime/air_date.
   Ревью Task 8 (п.1): в списке лежит ВЕСЬ сезон, включая анонсированные серии,
   поэтому даты обязательны — airedUpTo задаёт, сколько серий уже вышло
   (по умолчанию все). */
const PAST = '2025-01-10';

function future(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function season2(n, airedUpTo) {
  if (typeof airedUpTo !== 'number') airedUpTo = n;
  var out = [];
  for (var i = 1; i <= n; i++) {
    out.push({
      season_number: 2, episode_number: i, name: 'Серия ' + i, runtime: 50 + i,
      air_date: i <= airedUpTo ? PAST : future(7 * (i - airedUpTo))
    });
  }
  return out;
}

const HASH = function (s) { return 'h:' + s; };
function viewsOf(map) {
  return function (h) { return Object.prototype.hasOwnProperty.call(map, h) ? map[h] : null; };
}

test('serialProgress: начатая серия последнего сезона важнее более свежей начатой серии первого', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({
    'h:15Fallout': { percent: 40, updated: 99 }, // S1E5 — свежее по updated
    'h:23Fallout': { percent: 32, updated: 10 }  // S2E3 — последний сезон
  });
  var found = progress.serialProgress(movie, view, HASH, season2(8));
  assert.equal(found.season, 2);
  assert.equal(found.episode, 3);
  assert.equal(found.view.percent, 32);
});

test('serialProgress: в последнем сезоне несколько начатых — побеждает последняя по updated', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({
    'h:22Fallout': { percent: 10, updated: 50 },
    'h:25Fallout': { percent: 70, updated: 80 },
    'h:27Fallout': { percent: 5, updated: 20 }
  });
  var found = progress.serialProgress(movie, view, HASH, season2(8));
  assert.equal(found.episode, 5);
  assert.equal(found.view.percent, 70);
});

test('serialProgress: все начатые досмотрены -> следующая серия из episodes (percent 0)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({
    'h:21Fallout': { percent: 100, updated: 10 },
    'h:22Fallout': { percent: 96, updated: 20 }
  });
  var found = progress.serialProgress(movie, view, HASH, season2(4));
  assert.equal(found.season, 2);
  assert.equal(found.episode, 3);
  assert.equal(found.view.percent, 0, 'следующая серия ещё не начата');
});

/* Ревью Task 8 (п.1): частый случай Returning Series — зритель догнал эфир.
   Предлагать «Продолжить S2 E4» на серию, которая выйдет через неделю, нельзя:
   на той же карточке рядом стоит чип «Следующая серия — 17 декабря». */
test('serialProgress: следующая серия ещё не вышла -> null', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({
    'h:21Fallout': { percent: 100, updated: 1 },
    'h:22Fallout': { percent: 100, updated: 2 },
    'h:23Fallout': { percent: 100, updated: 3 }
  });
  assert.equal(progress.serialProgress(movie, view, HASH, season2(6, 3)), null);
});

test('serialProgress: серия без air_date следующей не считается (TMDB не даёт дату необъявленным)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var list = [
    { season_number: 2, episode_number: 1, name: 'A', air_date: PAST },
    { season_number: 2, episode_number: 2, name: 'B' }
  ];
  var view = viewsOf({ 'h:21Fallout': { percent: 100, updated: 1 } });
  assert.equal(progress.serialProgress(movie, view, HASH, list), null);
});

/* Ревью Task 8 (п.1), обратная сторона: пропуск невышедших — это именно
   пропуск, а не остановка. У TMDB встречается сезон с дырой в датах (поле
   заполняют волонтёры), и одна серия без air_date не должна навсегда гасить
   «Продолжить» для всего сезона. В реальном Returning Series даты монотонны,
   поэтому после первой невышедшей вышедших уже не будет — там результат null
   (тест выше). */
test('serialProgress: серия с пропущенной датой не блокирует продолжение — берётся следующая вышедшая', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var list = [
    { season_number: 2, episode_number: 1, name: 'A', air_date: PAST },
    { season_number: 2, episode_number: 2, name: 'B' },
    { season_number: 2, episode_number: 3, name: 'C', air_date: PAST }
  ];
  var view = viewsOf({ 'h:21Fallout': { percent: 100, updated: 1 } });
  var found = progress.serialProgress(movie, view, HASH, list);
  assert.equal(found.episode, 3);
});

test('serialProgress: «вышла» считается по календарным дням от now (пятый аргумент)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var list = [
    { season_number: 2, episode_number: 1, name: 'A', air_date: '2026-01-01' },
    { season_number: 2, episode_number: 2, name: 'B', air_date: '2026-02-01' }
  ];
  var view = viewsOf({ 'h:21Fallout': { percent: 100, updated: 1 } });

  var found = progress.serialProgress(movie, view, HASH, list, new Date(2026, 1, 5, 23, 50));
  assert.equal(found.episode, 2, '5 февраля серия от 1 февраля уже вышла');
  assert.equal(progress.serialProgress(movie, view, HASH, list, new Date(2026, 0, 15)), null, '15 января — ещё нет');
  /* День выхода считается вышедшим — как aired в episodeState. */
  assert.ok(progress.serialProgress(movie, view, HASH, list, new Date(2026, 1, 1, 0, 5)));
});

test('serialProgress: досмотрен весь сезон -> null (следующей серии в данных нет)', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({
    'h:21Fallout': { percent: 100, updated: 10 },
    'h:22Fallout': { percent: 100, updated: 20 }
  });
  assert.equal(progress.serialProgress(movie, view, HASH, season2(2)), null);
});

test('serialProgress: последний сезон не тронут -> общий перебор находит начатую серию прошлого', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var view = viewsOf({ 'h:15Fallout': { percent: 40, updated: 99 } });
  var found = progress.serialProgress(movie, view, HASH, season2(8));
  assert.equal(found.season, 1);
  assert.equal(found.episode, 5);
});

test('serialProgress: сезон из episodes важнее number_of_seasons (сезон 12 -> разделитель «:»)', () => {
  var movie = { original_name: 'X', number_of_seasons: 12 };
  var list = [{ season_number: 12, episode_number: 1, name: 'A' }, { season_number: 12, episode_number: 2, name: 'B' }];
  var view = viewsOf({ 'h:12:2X': { percent: 33, updated: 1 } });
  var found = progress.serialProgress(movie, view, HASH, list);
  assert.equal(found.season, 12);
  assert.equal(found.episode, 2);
});

test('serialProgress: серии без номера в episodes пропускаются', () => {
  var movie = { original_name: 'Fallout', number_of_seasons: 2 };
  var list = [{ season_number: 2, name: 'спецвыпуск' }].concat(season2(3));
  var view = viewsOf({ 'h:22Fallout': { percent: 12, updated: 5 } });
  var found = progress.serialProgress(movie, view, HASH, list);
  assert.equal(found.episode, 2);
});

/* ------------------------------ Task 8: label ------------------------------ */

const WORDS = { min: 'мин' };

test('label: серия с названием -> S2 E3 «Голова»', () => {
  var episodes = [{ season_number: 2, episode_number: 3, name: 'Голова', runtime: 58 }];
  var found = { view: { percent: 32 }, season: 2, episode: 3 };
  assert.equal(progress.label(found, episodes, WORDS), 'S2 E3 «Голова»');
});

test('label: серии нет в episodes или названия нет -> S2 E3', () => {
  var found = { view: { percent: 32 }, season: 2, episode: 3 };
  assert.equal(progress.label(found, [], WORDS), 'S2 E3');
  assert.equal(progress.label(found, null, WORDS), 'S2 E3');
  assert.equal(progress.label(found, [{ season_number: 2, episode_number: 3, name: '' }], WORDS), 'S2 E3');
});

test('label: не начатая серия — с длительностью из episodes («S2 E4 «Гуль» · 61 мин»)', () => {
  var episodes = [{ season_number: 2, episode_number: 4, name: 'Гуль', runtime: 61 }];
  var found = { view: { percent: 0 }, season: 2, episode: 4 };
  assert.equal(progress.label(found, episodes, WORDS), 'S2 E4 «Гуль» · 61 мин');
  /* у начатой длительность не дублируем — она уже есть в таймкоде строки */
  assert.equal(progress.label({ view: { percent: 32 }, season: 2, episode: 4 }, episodes, WORDS), 'S2 E4 «Гуль»');
});

test('label: фильм (season 0) и пустой аргумент -> пустая строка', () => {
  assert.equal(progress.label({ view: { percent: 43 }, season: 0, episode: 0 }, null, WORDS), '');
  assert.equal(progress.label(null, null, WORDS), '');
});

test('label: кавычки и обратный слэш в названии остаются как есть (экранирование — дело рендера)', () => {
  var episodes = [{ season_number: 1, episode_number: 1, name: 'Он сказал "да" \\ нет', runtime: 0 }];
  var found = { view: { percent: 10 }, season: 1, episode: 1 };
  assert.equal(progress.label(found, episodes, WORDS), 'S1 E1 «Он сказал "да" \\ нет»');
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

test('episodeState: начатая серия с percent < 0.5 показывает 1 %, а не «0 %»', () => {
  assert.deepEqual(progress.episodeState({ percent: 0.3, time: 10, duration: 3300 }, '2026-01-01', NOW),
    { state: 'watching', percent: 1, leftMin: 54 });
});

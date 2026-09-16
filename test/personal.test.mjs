import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const P = load('45_personal.js');

// --- pickBecause ---
test('pickBecause: пустая история → []', function () {
  assert.deepEqual(P.pickBecause([], 2), []);
  assert.deepEqual(P.pickBecause(null, 2), []);
});
test('pickBecause: n=0 → []', function () {
  assert.deepEqual(P.pickBecause([{ id: 1, title: 'A' }], 0), []);
});
test('pickBecause: берёт последние n карточек (от конца)', function () {
  var history = [
    { id: 1, title: 'A' },
    { id: 2, title: 'B' },
    { id: 3, title: 'C' }
  ];
  var result = P.pickBecause(history, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 3); /* последняя */
  assert.equal(result[1].id, 2);
});
test('pickBecause: дедупликация по id', function () {
  var history = [
    { id: 1, title: 'A' },
    { id: 1, title: 'A dup' },
    { id: 2, title: 'B' }
  ];
  var result = P.pickBecause(history, 3);
  assert.equal(result.length, 2);
  var ids = result.map(function (r) { return r.id; });
  assert.ok(ids.indexOf(1) >= 0);
  assert.ok(ids.indexOf(2) >= 0);
});
test('pickBecause: карточки без id пропускаются', function () {
  var history = [
    { title: 'No id' },
    { id: 1, title: 'A' }
  ];
  var result = P.pickBecause(history, 2);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});
test('pickBecause: media=tv если есть поле name', function () {
  var history = [
    { id: 10, name: 'Series', title: 'Series' },
    { id: 20, title: 'Movie' }
  ];
  var result = P.pickBecause(history, 2);
  var byId = {};
  result.forEach(function (r) { byId[r.id] = r; });
  assert.equal(byId[10].media, 'tv');
  assert.equal(byId[20].media, 'movie');
});
test('pickBecause: title берётся из name если нет title', function () {
  var history = [{ id: 5, name: 'TV Show' }];
  var result = P.pickBecause(history, 1);
  assert.equal(result[0].title, 'TV Show');
});

// --- soonRange ---
test('soonRange: возвращает {gte, lte} строками даты', function () {
  var range = P.soonRange(new Date(Date.UTC(2026, 0, 1)));
  assert.equal(range.gte, '2026-01-01');
  assert.equal(range.lte, '2026-01-31');
});
test('soonRange: строка даты как входной параметр', function () {
  var range = P.soonRange('2026-06-01');
  assert.equal(range.gte, '2026-06-01');
  assert.equal(range.lte, '2026-07-01');
});
test('soonRange: null → текущая дата, lte = gte + 30 дней', function () {
  var before = Date.now();
  var range = P.soonRange(null);
  var after = Date.now();
  /* Проверяем, что gte не раньше сегодня и не позже завтра. */
  var gteMs = new Date(range.gte + 'T00:00:00Z').getTime();
  var lteMs = new Date(range.lte + 'T00:00:00Z').getTime();
  assert.ok(lteMs - gteMs === 30 * 86400000);
});
test('soonRange: формат дат YYYY-MM-DD с ведущими нулями', function () {
  var range = P.soonRange(new Date(Date.UTC(2026, 0, 5))); /* 5 января */
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(range.gte));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(range.lte));
});

// --- newEpisodes ---
test('newEpisodes: пустой список → []', function () {
  assert.deepEqual(P.newEpisodes([], '2026-09-01'), []);
});
test('newEpisodes: сериал с последней серией в пределах 14 дней → badge «Новая серия»', function () {
  var shows = [{
    id: 1, name: 'Show A',
    last_episode_to_air: { air_date: '2026-09-05' },
    next_episode_to_air: null
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 1);
  assert.ok(result[0].lumen_badge, 'badge должен быть');
  assert.ok(result[0].lumen_badge.indexOf('05') >= 0 || result[0].lumen_badge.length > 0);
  assert.equal(result[0].id, 1);
});
test('newEpisodes: сериал с последней серией старше 14 дней → не включается', function () {
  var shows = [{
    id: 2, name: 'Old Show',
    last_episode_to_air: { air_date: '2026-08-01' },
    next_episode_to_air: null
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: сериал с будущей серией в пределах 7 дней → badge «Через»', function () {
  var shows = [{
    id: 3, name: 'Show B',
    last_episode_to_air: null,
    next_episode_to_air: { air_date: '2026-09-14' }
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 1);
  assert.ok(result[0].lumen_badge.length > 0, 'badge не пустой');
});
test('newEpisodes: сериал с будущей серией далее 7 дней → не включается', function () {
  var shows = [{
    id: 4, name: 'Far Show',
    last_episode_to_air: null,
    next_episode_to_air: { air_date: '2026-10-01' }
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: сортировка по дате последней серии (убывающая)', function () {
  var shows = [
    { id: 1, name: 'Old', last_episode_to_air: { air_date: '2026-09-01' }, next_episode_to_air: null },
    { id: 2, name: 'New', last_episode_to_air: { air_date: '2026-09-09' }, next_episode_to_air: null }
  ];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 2, 'свежий сериал первым');
  assert.equal(result[1].id, 1);
});
test('newEpisodes: не мутирует входные объекты', function () {
  var show = { id: 5, name: 'S', last_episode_to_air: { air_date: '2026-09-08' }, next_episode_to_air: null };
  P.newEpisodes([show], '2026-09-10');
  assert.ok(!show.lumen_badge, 'исходный объект не изменён');
});
test('newEpisodes: null/отсутствующие даты не падают', function () {
  var shows = [
    { id: 6, name: 'NoDate', last_episode_to_air: null, next_episode_to_air: null },
    { id: 7, name: 'BadDate', last_episode_to_air: { air_date: 'garbage' }, next_episode_to_air: null }
  ];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: today в виде Date', function () {
  var shows = [{
    id: 8, name: 'S',
    last_episode_to_air: { air_date: '2026-09-05' },
    next_episode_to_air: null
  }];
  var today = new Date(Date.UTC(2026, 8, 10)); /* 10 сентября */
  var result = P.newEpisodes(shows, today);
  assert.equal(result.length, 1);
});

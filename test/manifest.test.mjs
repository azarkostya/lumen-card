import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const M = load('42_manifest.js');

test('DEFAULT валиден: >=40 подборок, уникальные id, у каждой sources и group из groups', () => {
  const d = M.DEFAULT;
  const ids = new Set();
  const groups = new Set(d.groups.map(function(g) { return g.id; }));
  assert.ok(d.collections.length >= 40, 'нужно >= 40 подборок, есть ' + d.collections.length);
  for (const c of d.collections) {
    assert.ok(!ids.has(c.id), 'дублированный id: ' + c.id);
    ids.add(c.id);
    assert.ok(c.sources.movie || c.sources.tv, 'нет sources у ' + c.id);
    assert.ok(groups.has(c.group), 'неизвестная группа ' + c.group + ' у ' + c.id);
    assert.match(c.id, /^[a-z0-9-]+$/, 'id не латиница: ' + c.id);
    assert.ok(typeof c.title === 'string' && c.title.length > 0, 'нет title у ' + c.id);
  }
  for (const h of d.home) {
    assert.ok(ids.has(h) || ['continue', 'because', 'new-episodes', 'soon'].indexOf(h) >= 0, 'home: неизвестный id ' + h);
  }
});

test('DEFAULT: groups имеет ровно 10 id, hubGroups имеет 7 групп', () => {
  const d = M.DEFAULT;
  assert.equal(d.groups.length, 10);
  const gids = new Set(d.groups.map(function(g) { return g.id; }));
  const expected = ['franchise', 'studio', 'service', 'theme', 'country', 'era', 'people', 'top', 'kp', 'mood'];
  for (const id of expected) {
    assert.ok(gids.has(id), 'нет группы ' + id);
  }
  assert.ok(Array.isArray(d.hubGroups), 'hubGroups должен быть массивом');
  assert.equal(d.hubGroups.length, 7);
  for (const hg of d.hubGroups) {
    assert.ok(hg.id, 'hubGroups запись без id');
    assert.ok(Array.isArray(hg.groups), 'hubGroups запись без groups');
    assert.ok(hg.title, 'hubGroups запись без title');
  }
});

test('DEFAULT: moods имеет ровно 4 чипа', () => {
  const d = M.DEFAULT;
  assert.ok(Array.isArray(d.moods), 'moods должен быть массивом');
  assert.equal(d.moods.length, 4);
  const moodIds = ['friday', 'family', 'scary', 'short'];
  for (var i = 0; i < moodIds.length; i++) {
    assert.ok(d.moods.some(function(m) { return m.id === moodIds[i]; }), 'нет mood ' + moodIds[i]);
  }
});

test('DEFAULT: сезонные подборки имеют season-массив с числами', () => {
  const d = M.DEFAULT;
  for (const c of d.collections) {
    if (c.season) {
      assert.ok(Array.isArray(c.season), 'season должен быть массивом у ' + c.id);
      for (const m of c.season) {
        assert.ok(typeof m === 'number' && m >= 1 && m <= 12, 'месяц вне 1-12 у ' + c.id);
      }
    }
  }
});

test('DEFAULT: КП-подборки имеют тип kp и collection', () => {
  const d = M.DEFAULT;
  const kpItems = d.collections.filter(function(c) { return c.group === 'kp'; });
  assert.ok(kpItems.length >= 6, 'мало kp-подборок');
  for (const c of kpItems) {
    assert.ok(c.sources.movie && c.sources.movie.type === 'kp', 'kp-подборка без type:kp у ' + c.id);
    assert.ok(c.sources.movie.collection, 'kp-подборка без collection у ' + c.id);
  }
});

test('orderForMonth: сезонные наверх в свой месяц, остальные в исходном порядке', () => {
  const list = [{ id: 'a' }, { id: 'x', season: [12, 1] }, { id: 'b' }, { id: 'h', season: [10] }];
  assert.deepEqual(M.orderForMonth(list, 12).map(function(c) { return c.id; }), ['x', 'a', 'b', 'h']);
  assert.deepEqual(M.orderForMonth(list, 10).map(function(c) { return c.id; }), ['h', 'a', 'x', 'b']);
  assert.deepEqual(M.orderForMonth(list, 6).map(function(c) { return c.id; }), ['a', 'x', 'b', 'h']);
});
test('orderForMonth: несколько сезонных в одном месяце — в исходном порядке между собой', () => {
  const list = [{ id: 'b', season: [12] }, { id: 'a', season: [12] }, { id: 'c' }];
  const res = M.orderForMonth(list, 12).map(function(c) { return c.id; });
  assert.deepEqual(res, ['b', 'a', 'c']);
});
test('orderForMonth: месяц null/0 — не поднимает ни одного', () => {
  const list = [{ id: 'a' }, { id: 'x', season: [12] }];
  const res = M.orderForMonth(list, 6).map(function(c) { return c.id; });
  assert.equal(res[0], 'a');
  assert.equal(res[1], 'x');
});

test('validate: чужой манифест без collections или с дублями отвергается', () => {
  assert.equal(M.validate({
    version: 1,
    collections: [{ id: 'a', sources: { movie: { type: 'discover', params: {} } }, group: 'theme', title: 't' }],
    groups: [{ id: 'theme', title: 'T' }],
    home: []
  }).ok, true);
  assert.equal(M.validate({ version: 1 }).ok, false);
  assert.equal(M.validate({ version: 1, collections: [{ id: 'a' }, { id: 'a' }], groups: [], home: [] }).ok, false);
});
test('validate: нет version — отклоняется', () => {
  assert.equal(M.validate({ collections: [], groups: [], home: [] }).ok, false);
});
test('validate: подборка без sources — отклоняется', () => {
  assert.equal(M.validate({
    version: 1,
    collections: [{ id: 'a', title: 't', group: 'theme' }],
    groups: [{ id: 'theme', title: 'T' }],
    home: []
  }).ok, false);
});
test('validate: некорректный JSON (не объект) — отклоняется', () => {
  assert.equal(M.validate(null).ok, false);
  assert.equal(M.validate([]).ok, false);
  assert.equal(M.validate('string').ok, false);
});

test('isFresh 12 часов', () => {
  assert.equal(M.isFresh({ at: Date.now() - 1000 }), true);
  assert.equal(M.isFresh({ at: Date.now() - 13 * 3600e3 }), false);
});
test('isFresh: точно 12 часов — уже протух', () => {
  assert.equal(M.isFresh({ at: Date.now() - 12 * 3600e3 - 1 }), false);
});
test('isFresh: нет at — протух', () => {
  assert.equal(M.isFresh({}), false);
  assert.equal(M.isFresh(null), false);
});

test('get: возвращает DEFAULT до вызова load', () => {
  const d = M.get();
  assert.ok(d && d.collections, 'get() должен вернуть DEFAULT');
  assert.ok(d.collections.length >= 40);
});

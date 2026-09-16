import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';
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
test('homeRows: дубликаты id в storedIds не задваивают ряды', function () {
  var rows = R.homeRows(MANIFEST, ['star-wars', 'anime', 'star-wars'], null, 15);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, 'star-wars');
  assert.equal(rows[1].id, 'anime');
});
test('homeRows: дубликаты id в manifest.home не задваивают ряды', function () {
  var m = Object.assign({}, MANIFEST, { home: ['star-wars', 'anime', 'star-wars'] });
  var rows = R.homeRows(m, null, null, 15);
  assert.equal(rows.length, 2);
});

/* ------------------------------------------------------------------ */
/* Runtime-тесты: register / unregister / bumpGen / makeCall /         */
/* viewedIds — с fake Lampa                                            */
/* ------------------------------------------------------------------ */

function setupRows(opts) {
  opts = opts || {};
  var addedRows = [];
  var removedRows = [];
  var fetchCalls = [];
  var favViewed = opts.favViewed || [];
  var timelineData = opts.timelineData || {};

  var Lampa = {
    ContentRows: {
      add: function (d) { addedRows.push(d); },
      remove: function (d) { removedRows.push(d); }
    },
    Favorite: {
      get: function (q) {
        if (q && q.type === 'viewed') return favViewed;
        return [];
      }
    },
    Timeline: {
      view: function (hash) { return timelineData[hash] || null; }
    },
    Utils: {
      hash: function (s) { return 'h:' + s; }
    }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.Lampa = Lampa;

  var manifest = opts.manifest || {
    version: 1,
    home: ['col-a', 'col-b'],
    collections: [
      { id: 'col-a', title: 'Collection A', sources: { movie: {} } },
      { id: 'col-b', title: 'Collection B', sources: { movie: {} } }
    ]
  };

  var prefs = Object.assign({ lumen_rows_limit: '15', lumen_home_rows: '', lumen_hide_watched: false }, opts.prefs || {});
  var fakeSources = {
    fetch: function (item, page, ok, err, alive) {
      fetchCalls.push({ item: item, page: page, ok: ok, err: err, alive: alive });
      return { clear: function () { fetchCalls[fetchCalls.length - 1].cleared = true; } };
    }
  };

  var ctx = loadCtx('44_rows.js', {
    pref: function (name, def) { return (name in prefs) ? prefs[name] : def; },
    sources: fakeSources,
    manifest: { get: function () { return manifest; }, load: function (cb) { cb(manifest); } }
  });
  var R = ctx.api;

  return { R: R, addedRows: addedRows, removedRows: removedRows, fetchCalls: fetchCalls, Lampa: Lampa, manifest: manifest, prefs: prefs, LC: ctx.LC };
}

// --- bumpGen ---
test('bumpGen: метод существует и живёт на публичном API', function () {
  var s = setupRows();
  assert.equal(typeof s.R.bumpGen, 'function');
});

// --- register + unregister ---
test('register: добавляет дескрипторы в ContentRows.add', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  assert.equal(s.addedRows.length, 2);
  assert.equal(s.addedRows[0].name, 'lumen_col-a');
  assert.equal(s.addedRows[1].name, 'lumen_col-b');
});
test('unregister: вызывает ContentRows.remove для каждого дескриптора', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var refs = s.addedRows.slice();
  s.R.unregister();
  assert.equal(s.removedRows.length, 2);
  assert.equal(s.removedRows[0], refs[0]);
  assert.equal(s.removedRows[1], refs[1]);
});
test('unregister: после вызова новый register не задваивает ряды', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  s.R.unregister();
  s.R.register(s.manifest);
  /* remove должна быть вызвана по одному разу для каждой регистрации */
  assert.equal(s.addedRows.length, 4); /* 2 первый + 2 второй */
  assert.equal(s.removedRows.length, 2); /* 2 — первый набор снят */
  /* В ContentRows живых должно быть ровно 2 последних (убрали первые 2) */
  assert.equal(s.addedRows.length - s.removedRows.length, 2);
});
test('register: повторный вызов без unregister снимает старые ряды (важно для манифеста)', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  s.R.register(s.manifest); /* второй вызов: должен снять первые */
  assert.equal(s.removedRows.length, 2); /* первые 2 сняты */
  assert.equal(s.addedRows.length, 4);  /* 2 + 2 */
});
test('lumen_rows_limit: применяется при register', function () {
  var s = setupRows({ prefs: { lumen_rows_limit: '1', lumen_home_rows: '', lumen_hide_watched: false } });
  s.R.register(s.manifest);
  assert.equal(s.addedRows.length, 1);
});

// --- makeCall + bumpGen (C1) ---
test('makeCall: alive возвращает true до bumpGen', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var callFn = s.addedRows[0].call;
  var innerFn = callFn({}, 'main');
  var callReceived = false;
  innerFn(function () { callReceived = true; });
  var fc = s.fetchCalls[0];
  assert.ok(typeof fc.alive === 'function', 'alive должна быть функцией');
  assert.equal(fc.alive(), true); /* до bump — жив */
});
test('makeCall: alive возвращает false после bumpGen', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var callFn = s.addedRows[0].call;
  var innerFn = callFn({}, 'main');
  innerFn(function () {});
  var fc = s.fetchCalls[0];
  assert.equal(fc.alive(), true);
  s.R.bumpGen();
  assert.equal(fc.alive(), false); /* после bump — мёртв */
});
test('makeCall: каждый вызов call получает независимое поколение', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var innerFn1 = s.addedRows[0].call({}, 'main');
  innerFn1(function () {});
  var alive1 = s.fetchCalls[0].alive;
  s.R.bumpGen();
  var innerFn2 = s.addedRows[0].call({}, 'main');
  innerFn2(function () {});
  var alive2 = s.fetchCalls[1].alive;
  assert.equal(alive1(), false); /* первый мёртв */
  assert.equal(alive2(), true);  /* второй жив */
});

// --- viewedIds (I3) ---
test('viewedIds: возвращает ids из Favorite.viewed', function () {
  var s = setupRows({ favViewed: [{ id: 101 }, { id: 202 }] });
  var ids = s.R.viewedIds();
  assert.ok(ids.includes(101));
  assert.ok(ids.includes(202));
});
test('viewedIds: добавляет id карточек из results с Timeline >= 95', function () {
  var s = setupRows({
    timelineData: { 'h:My Movie': { percent: 97 } }
  });
  var results = [{ id: 999, original_title: 'My Movie', title: 'My Movie' }];
  var ids = s.R.viewedIds(results);
  assert.ok(ids.includes(999), 'должен включать id из Timeline');
});
test('viewedIds: НЕ добавляет карточку с Timeline < 95', function () {
  var s = setupRows({
    timelineData: { 'h:Partial Movie': { percent: 60 } }
  });
  var results = [{ id: 888, original_title: 'Partial Movie', title: 'Partial Movie' }];
  var ids = s.R.viewedIds(results);
  assert.ok(!ids.includes(888));
});
test('viewedIds: без results не падает и возвращает только Favorite', function () {
  var s = setupRows({ favViewed: [{ id: 55 }] });
  var ids = s.R.viewedIds();
  assert.deepEqual(ids, [55]);
});

/* ====================================================================== */
/* Task 20: экран выбора рядов главной.                                    */
/* ====================================================================== */

test('rowChoices: отмеченные первыми, по умолчанию — набор manifest.home', function () {
  var list = R.rowChoices(MANIFEST, null);
  assert.deepEqual(list.map(function (c) { return c.id; }),
    ['star-wars', 'kp-top250', 'anime', 'xmas-comedy', 'comedy']);
  assert.deepEqual(list.map(function (c) { return c.checked; }), [true, true, true, false, false]);
  assert.equal(list[0].title, 'Звёздные войны');
  assert.equal(list[3].group, 'theme');
});

test('rowChoices: сохранённый список отмечен и стоит в своём порядке', function () {
  var list = R.rowChoices(MANIFEST, ['comedy', 'anime']);
  assert.deepEqual(list.map(function (c) { return c.id; }),
    ['comedy', 'anime', 'star-wars', 'kp-top250', 'xmas-comedy']);
  assert.deepEqual(list.map(function (c) { return c.checked; }), [true, true, false, false, false]);
});

test('rowChoices: id, которого больше нет в каталоге, отбрасывается', function () {
  var list = R.rowChoices(MANIFEST, ['comedy', 'исчезнувшая']);
  assert.deepEqual(list.map(function (c) { return c.id; }),
    ['comedy', 'star-wars', 'kp-top250', 'anime', 'xmas-comedy']);
  assert.equal(list.filter(function (c) { return c.checked; }).length, 1);
});

test('rowChoices: пустой/битый каталог — пустой список', function () {
  assert.deepEqual(R.rowChoices(null, null), []);
  assert.deepEqual(R.rowChoices({}, null), []);
});

test('storedIds: строка настройки разбирается в массив, пусто/мусор -> null', function () {
  var s = setupRows({ prefs: { lumen_home_rows: 'col-a, col-b ,,' } });
  assert.deepEqual(s.R.storedIds(), ['col-a', 'col-b']);

  var empty = setupRows({ prefs: { lumen_home_rows: '' } });
  assert.equal(empty.R.storedIds(), null);

  var spaces = setupRows({ prefs: { lumen_home_rows: ' , ' } });
  assert.equal(spaces.R.storedIds(), null);
});

test('register: сохранённый состав рядов важнее manifest.home', function () {
  var s = setupRows({ prefs: { lumen_rows_limit: '15', lumen_home_rows: 'col-b' } });
  s.R.register(s.manifest);
  assert.equal(s.addedRows.length, 1);
  assert.equal(s.addedRows[0].name, 'lumen_col-b');
});

/* ------------------------------------------------------------------ */
/* Контракт call-функции ряда (fix-раунд итогового ревью фазы 2, C1).  */
/*                                                                     */
/* Lampa грузит ряды главной пачками: Api.main() отдаёт parts_data в    */
/* partNext(parts, parts_limit=6, …), тот кладёт первые 6 в Progress,   */
/* а Progress.start() ждёт, пока КАЖДАЯ часть вызовет свой call(…)      */
/* (vendor/lampa/app.min.js, function Progress / function partNext).    */
/* Молчащий ряд — это незавершённая пачка: следующая не начнётся, и     */
/* главная перестаёт достраиваться до перезапуска Lampa. Поэтому ряд   */
/* обязан ответить ровно ОДИН раз при любом исходе: успех, ошибка,      */
/* мёртвое поколение. Два ответа тоже ломают Progress — его счётчик     */
/* loaded сравнивается с works.length на равенство.                     */
/* ------------------------------------------------------------------ */

test('call: мёртвое поколение закрывает ряд пустым результатом, а не молчанием', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var got = [];
  s.addedRows[0].call({}, 'main')(function (data) { got.push(data); });
  assert.equal(got.length, 0, 'пока сеть не ответила — ряд молчит');

  s.R.bumpGen();
  assert.equal(got.length, 1, 'bumpGen обязан закрыть незавершённый ряд');
  assert.deepEqual(got[0].results, [], 'закрывается пустым результатом');
});

test('call: после закрытия по мёртвому поколению поздний ответ сети ничего не добавляет', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var got = [];
  s.addedRows[0].call({}, 'main')(function (data) { got.push(data); });
  s.R.bumpGen();
  s.fetchCalls[0].ok({ results: [{ id: 1 }] });
  s.fetchCalls[0].err({ all_failed: true });
  assert.equal(got.length, 1, 'call строго один раз');
});

test('call: успешный ответ — ровно один call, повторный ok игнорируется', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var got = [];
  s.addedRows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }, { id: 2 }] });
  s.fetchCalls[0].ok({ results: [{ id: 3 }] });
  assert.equal(got.length, 1);
  assert.equal(got[0].results.length, 2);
  assert.equal(got[0].title, 'Collection A');
  /* И bumpGen после завершения второй раз ряд не зовёт. */
  s.R.bumpGen();
  assert.equal(got.length, 1);
});

test('call: ошибка источника — ровно один call с пустым результатом', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var got = [];
  s.addedRows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].err({ all_failed: true });
  s.R.bumpGen();
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].results, []);
});

test('call: bumpGen закрывает ВСЕ незавершённые ряды пачки', function () {
  var s = setupRows();
  s.R.register(s.manifest);
  var got = [];
  s.addedRows[0].call({}, 'main')(function () { got.push('a'); });
  s.addedRows[1].call({}, 'main')(function () { got.push('b'); });
  s.R.bumpGen();
  assert.deepEqual(got, ['a', 'b']);
});

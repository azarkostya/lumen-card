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
/* Волна 4 (ТВ 2026-09-24): набор по умолчанию (manifest.home) показывал
   «Рождественские комедии» и в сентябре — сезонная подборка не в свой месяц
   из него выпадает. Состав, отмеченный пользователем вручную, — его выбор:
   сезонная остаётся, просто не поднимается наверх. */
test('homeRows: не сезонный месяц — сезонной из набора по умолчанию нет, выбранная вручную стоит на своём месте', function () {
  var m2 = {
    version: 1,
    home: ['comedy', 'xmas-comedy'],
    groups: MANIFEST.groups,
    collections: MANIFEST.collections
  };
  var rows = R.homeRows(m2, null, 6, 15); /* июнь */
  assert.deepEqual(rows.map(function (r) { return r.id; }), ['comedy']);
  var picked = R.homeRows(m2, ['comedy', 'xmas-comedy'], 6, 15);
  assert.deepEqual(picked.map(function (r) { return r.id; }), ['comedy', 'xmas-comedy']);
});

test('homeRows: «Рождественские комедии» из набора по умолчанию в сентябре не показываются', function () {
  var m2 = {
    version: 1,
    home: ['star-wars', 'xmas-comedy', 'anime'],
    groups: MANIFEST.groups,
    collections: MANIFEST.collections
  };
  assert.deepEqual(R.homeRows(m2, null, 9, 15).map(function (r) { return r.id; }), ['star-wars', 'anime']);
  /* Без месяца (неизвестна дата) — ничего не отсеивается. */
  assert.equal(R.homeRows(m2, null, null, 15).length, 3);
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
/* Runtime-тесты: describe / adventRow / bumpGen / makeCall /          */
/* viewedIds — с fake Lampa. Регистрацию рядов в ContentRows (места,   */
/* снятие, лимит) с волны 4 делает план главной — test/homeplan.test.mjs */
/* ------------------------------------------------------------------ */

function setupRows(opts) {
  opts = opts || {};
  var fetchCalls = [];
  var favViewed = opts.favViewed || [];
  var timelineData = opts.timelineData || {};

  var Lampa = {
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
  var postersCalls = [];
  var fakeSources = {
    fetch: function (item, page, ok, err, alive) {
      fetchCalls.push({ item: item, page: page, ok: ok, err: err, alive: alive });
      return { clear: function () { fetchCalls[fetchCalls.length - 1].cleared = true; } };
    },
    /* Постеры: подмена постеров — отдельный шаг между ответом подборки и
       ответом Lampa. Заглушка повторяет контракт настоящей: done ровно один
       раз, синхронно (так она и ведёт себя в режиме по умолчанию). */
    posters: function (item, cards, done) { postersCalls.push({ item: item, cards: cards }); done(0); }
  };

  /* Task 21: ряд адвента спрашивает дату и раскладку у LC.themes — модуль
     настоящий, дату подменяем хуком _now (как в живой проверке). */
  var themes = opts.themes === null ? null : loadCtx('53_themes.js', {}).api;
  if (themes && opts.now) themes._now = function () { return opts.now; };
  var ctx = loadCtx('44_rows.js', {
    pref: function (name, def) { return (name in prefs) ? prefs[name] : def; },
    sources: fakeSources,
    lang: function (key) { return ({ lumen_advent_title: 'Адвент-календарь', lumen_advent_day: 'День', lumen_advent_today: 'Сегодня' })[key] || key; },
    themes: themes || undefined,
    manifest: { get: function () { return manifest; }, load: function (cb) { cb(manifest); } }
  });
  var R = ctx.api;

  /* Описания рядов главной в прежнем порядке — адвент (в декабре), затем
     подборки набора; места им назначает план главной. */
  function rows() {
    var picked = R.storedIds();
    var list = R.homeRows(manifest, picked, null, parseInt(prefs.lumen_rows_limit, 10) || 15);
    var out = [];
    var advent = R.adventRow(manifest);
    if (advent) out.push(advent);
    for (var i = 0; i < list.length; i++) out.push(R.describe(list[i], !!(picked && picked.length)));
    return out;
  }

  return { R: R, rows: rows, fetchCalls: fetchCalls, postersCalls: postersCalls, Lampa: Lampa, manifest: manifest, prefs: prefs, LC: ctx.LC };
}

// --- bumpGen ---
test('bumpGen: метод существует и живёт на публичном API', function () {
  var s = setupRows();
  assert.equal(typeof s.R.bumpGen, 'function');
});

// --- describe ---
/* Волна 4: ряды регистрирует план главной (src/47_homeplan.js) — он и
   ставит index. Описание — имя 'lumen_<id>' (выключатели «Каналов» Lampa
   content_rows_lumen_<id> у пользователей уже записаны под ним), заголовок
   с меткой источника и экран главной. */
test('describe: описание ряда подборки — имя, заголовок с меткой, экран главной, без места', function () {
  var s = setupRows();
  var row = s.R.describe({ id: 'kp-top250', title: 'КП Топ-250 фильмов', badge: 'KINOPOISK', sources: { movie: {} } }, false);
  assert.equal(row.name, 'lumen_kp-top250');
  assert.equal(row.title, 'КП Топ-250 фильмов · KINOPOISK');
  assert.equal(row.screen, 'main');
  assert.equal(row.index, undefined, 'место назначает план главной');
  assert.equal(typeof row.call, 'function');
  assert.equal(s.fetchCalls.length, 0, 'описание само ничего не запрашивает');
});

// --- makeCall + bumpGen (C1) ---
test('makeCall: alive возвращает true до bumpGen', function () {
  var s = setupRows();
  var rows = s.rows();
  var callFn = rows[0].call;
  var innerFn = callFn({}, 'main');
  var callReceived = false;
  innerFn(function () { callReceived = true; });
  var fc = s.fetchCalls[0];
  assert.ok(typeof fc.alive === 'function', 'alive должна быть функцией');
  assert.equal(fc.alive(), true); /* до bump — жив */
});
test('makeCall: alive возвращает false после bumpGen', function () {
  var s = setupRows();
  var rows = s.rows();
  var callFn = rows[0].call;
  var innerFn = callFn({}, 'main');
  innerFn(function () {});
  var fc = s.fetchCalls[0];
  assert.equal(fc.alive(), true);
  s.R.bumpGen();
  assert.equal(fc.alive(), false); /* после bump — мёртв */
});
test('makeCall: каждый вызов call получает независимое поколение', function () {
  var s = setupRows();
  var rows = s.rows();
  var innerFn1 = rows[0].call({}, 'main');
  innerFn1(function () {});
  var alive1 = s.fetchCalls[0].alive;
  s.R.bumpGen();
  var innerFn2 = rows[0].call({}, 'main');
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
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  assert.equal(got.length, 0, 'пока сеть не ответила — ряд молчит');

  s.R.bumpGen();
  assert.equal(got.length, 1, 'bumpGen обязан закрыть незавершённый ряд');
  assert.deepEqual(got[0].results, [], 'закрывается пустым результатом');
});

test('call: после закрытия по мёртвому поколению поздний ответ сети ничего не добавляет', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  s.R.bumpGen();
  s.fetchCalls[0].ok({ results: [{ id: 1 }] });
  s.fetchCalls[0].err({ all_failed: true });
  assert.equal(got.length, 1, 'call строго один раз');
});

test('call: успешный ответ — ровно один call, повторный ok игнорируется', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }, { id: 2 }] });
  s.fetchCalls[0].ok({ results: [{ id: 3 }] });
  assert.equal(got.length, 1);
  assert.equal(got[0].results.length, 2);
  assert.equal(got[0].title, 'Collection A');
  /* И bumpGen после завершения второй раз ряд не зовёт. */
  s.R.bumpGen();
  assert.equal(got.length, 1);
});

/* Постеры: подмена постеров стоит МЕЖДУ ответом подборки и ответом Lampa —
   постер карточки ряда ставит сама Lampa по poster_path, и правка обязана
   успеть до этого (разбор — в шапке src/44_rows.js). */
test('Постеры: ряд отдаёт карточки Lampa только после подмены постеров', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }, { id: 2 }] });
  assert.equal(s.postersCalls.length, 1, 'подмена постеров обязана быть позвана ровно один раз');
  assert.equal(s.postersCalls[0].item.id, 'col-a', 'ей передаётся сама подборка — из неё берётся английский список');
  assert.equal(s.postersCalls[0].cards, got[0].results,
    'подменяются РОВНО те карточки, что уйдут в Lampa: фильтр досмотренного уже прошёл');
});

/* Подмена не отвечает — ряд молчит, и пачка Lampa не завершится никогда.
   Контракт «ровно один call при любом исходе» держит резолвер, а закрывает
   молчащий ряд bumpGen (шапка src/44_rows.js). */
test('Постеры: подмена постеров молчит — ряд закрывается уходом с главной, и ровно один раз', function () {
  var s = setupRows();
  var held = [];
  s.LC.sources.posters = function (item, cards, done) { held.push(done); };
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }] });
  assert.equal(got.length, 0, 'пока постеры не подменены — ряд не отвечает');
  s.R.bumpGen();
  assert.equal(got.length, 1, 'уход с главной закрыл ряд пустым результатом');
  held[0](0);
  assert.equal(got.length, 1, 'поздний ответ подмены второго call не даёт');
});

test('call: ошибка источника — ровно один call с пустым результатом', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (data) { got.push(data); });
  s.fetchCalls[0].err({ all_failed: true });
  s.R.bumpGen();
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].results, []);
});

test('call: bumpGen закрывает ВСЕ незавершённые ряды пачки', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function () { got.push('a'); });
  rows[1].call({}, 'main')(function () { got.push('b'); });
  s.R.bumpGen();
  assert.deepEqual(got, ['a', 'b']);
});

/* ------------------------------------------------------------------ */
/* Task 21 (фаза 3): адвент-календарь                                   */
/* ------------------------------------------------------------------ */

const XMAS_MANIFEST = {
  version: 1,
  home: ['col-a'],
  collections: [
    { id: 'col-a', title: 'Collection A', sources: { movie: {} } },
    { id: 'xmas-comedy', title: 'Рождественские комедии', season: [12, 1], sources: { movie: {} } },
    { id: 'christmas', title: 'Рождественское кино', season: [12, 1], sources: { movie: {} } }
  ]
};

/* Место ряда адвента (первым среди подборок в режиме «Сначала
   «Досмотреть»», на месте 0 при ротации) назначает план главной —
   test/homeplan.test.mjs. */
test('адвент: в декабре — описание ряда с днём в заголовке', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 11, 5) });
  var advent = s.R.adventRow(s.manifest);
  assert.equal(advent.name, 'lumen_advent');
  assert.equal(advent.title, 'Адвент-календарь · день 5');
  assert.equal(advent.screen, 'main');
  assert.equal(advent.index, undefined);
});

test('адвент: не в декабре ряда нет вовсе — ни запроса, ни описания', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 10, 30) });
  assert.equal(s.R.adventRow(s.manifest), null);
  assert.equal(s.fetchCalls.length, 0);
});

test('адвент: без LC.themes (каталог без тем, старый профиль) ряда нет', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, themes: null, now: new Date(2026, 11, 5) });
  assert.equal(s.R.adventRow(s.manifest), null);
});

test('адвент: без рождественских подборок в каталоге ряда нет', function () {
  var s = setupRows({ now: new Date(2026, 11, 5) });
  assert.equal(s.R.adventRow(s.manifest), null);
});

test('адвентSpecs: две подборки по две страницы, порядок фиксирован', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 11, 5) });
  var specs = s.R.adventSpecs(XMAS_MANIFEST);
  assert.deepEqual(specs.map(function (x) { return x.item.id + ':' + x.page; }),
    ['xmas-comedy:1', 'xmas-comedy:2', 'christmas:1', 'christmas:2']);
  assert.deepEqual(s.R.adventSpecs({ collections: [] }), []);
  assert.deepEqual(s.R.adventSpecs(null), []);
});

test('adventPool: дубли между подборками снимаются, порядок — по слотам запросов', function () {
  var s = setupRows({ now: new Date(2026, 11, 5) });
  var pool = s.R.adventPool([[{ id: 1 }, { id: 2 }], null, [{ id: 2 }, { id: 3 }]]);
  assert.deepEqual(pool.map(function (c) { return c.id; }), [1, 2, 3]);
  assert.deepEqual(s.R.adventPool([]), []);
});

test('адвент: четыре запроса, один ответ Lampa, карточки с метками дней', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 11, 3) });
  var rows = s.rows();
  var advent = rows[0];
  var got = [];
  advent.call({}, 'main')(function (payload) { got.push(payload); });
  assert.equal(s.fetchCalls.length, 4, 'две подборки по две страницы');
  assert.equal(got.length, 0, 'до последнего ответа ряд молчит');
  for (var i = 0; i < 4; i++) {
    s.fetchCalls[i].ok({ results: [{ id: 100 + i, title: 'f' + i }, { id: 200 + i, title: 'g' + i }] });
  }
  assert.equal(got.length, 1, 'ровно один ответ Lampa');
  assert.equal(got[0].results.length, 3, 'три дня декабря');
  assert.deepEqual(got[0].results.map(function (c) { return c.day; }), [1, 2, 3]);
  assert.equal(got[0].results[2].lumen_badge, 'Сегодня · день 3');
  assert.equal(got[0].results[0].lumen_badge, 'День 1');
});

test('адвент: ошибки всех запросов дают пустой ряд, но ровно один call', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 11, 3) });
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (payload) { got.push(payload); });
  for (var i = 0; i < 4; i++) s.fetchCalls[i].err({});
  assert.equal(got.length, 1);
  assert.deepEqual(got[0].results, []);
});

test('адвент: уход с главной закрывает ряд пустым результатом (контракт Lampa)', function () {
  var s = setupRows({ manifest: XMAS_MANIFEST, now: new Date(2026, 11, 3) });
  var rows = s.rows();
  var got = [];
  var handle = rows[0].call({}, 'main')(function (payload) { got.push(payload); });
  s.R.bumpGen();
  assert.equal(got.length, 1, 'ряд закрыт немедленно');
  assert.deepEqual(got[0].results, []);
  /* cancel() зовёт clear() у всех четырёх ручек — фейковый fetch умеет
     пометить только последнюю, поэтому проверяем сам факт отмены по ней. */
  handle.cancel();
  assert.ok(s.fetchCalls[s.fetchCalls.length - 1].cleared, 'запросы отменены');
  for (var i = 0; i < 4; i++) s.fetchCalls[i].ok({ results: [{ id: i }] });
  assert.equal(got.length, 1, 'второго call не случилось');
});

/* ====================================================================== */
/* Task 57: фильм не повторяется в рядах ниже по главной.                 */
/* ====================================================================== */

/* Ряд в том виде, в каком его отдаёт Lampa компоненту главной:
   {title, results:[карточка, …]} плюс наши флаги. */
function mkRow(title, ids, extra) {
  var r = { title: title, results: [] };
  for (var i = 0; i < ids.length; i++) {
    r.results.push(typeof ids[i] === 'object' ? ids[i] : { id: ids[i], source: 'tmdb' });
  }
  if (extra) for (var k in extra) r[k] = extra[k];
  return r;
}
function idsOf(row) { return row.results.map(function (c) { return c.id; }); }

test('dedupeAcross: во втором ряду дубли первого исчезают, порядок сохранён', function () {
  var rows = [
    mkRow('В тренде', [1, 2, 3, 4, 5]),
    mkRow('Сейчас смотрят', [9, 2, 8, 1, 7, 6])
  ];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.equal(out.length, 2);
  assert.deepEqual(idsOf(out[0]), [1, 2, 3, 4, 5]);
  assert.deepEqual(idsOf(out[1]), [9, 8, 7, 6], 'дубли ушли, оставшиеся в прежнем порядке');
});

test('dedupeAcross: порядок рядов не меняется', function () {
  var rows = [mkRow('A', [1, 2, 3, 4]), mkRow('B', [5, 6, 7, 8]), mkRow('C', [9, 10, 11, 12])];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['A', 'B', 'C']);
});

test('dedupeAcross: ряд короче порога не показывается вовсе', function () {
  var rows = [
    mkRow('A', [1, 2, 3, 4, 5, 6]),
    mkRow('B', [1, 2, 3, 4, 7, 8]),
    mkRow('C', [20, 21, 22, 23])
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['A', 'C'],
    'у B после окна осталось две карточки — огрызок, его не показываем');
});

test('dedupeAcross: карточки выброшенного ряда всё равно попали в окно', function () {
  var rows = [
    mkRow('A', [1, 2, 3, 4]),
    mkRow('B', [1, 2, 3, 50]),
    mkRow('C', [50, 60, 61, 62, 63])
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['A', 'C']);
  assert.deepEqual(idsOf(out[1]), [60, 61, 62, 63], 'карточка 50 уже была в выброшенном ряду');
});

test('dedupeAcross: ряд с lumen_keep не выбрасывается, даже став коротким', function () {
  var rows = [
    mkRow('A', [1, 2, 3, 4, 5]),
    mkRow('Мой выбор', [1, 2, 3, 99], { lumen_keep: true })
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['A', 'Мой выбор']);
  assert.deepEqual(idsOf(out[1]), [99]);
});

test('dedupeAcross: персональный ряд состава не теряет, но в окно попадает', function () {
  var rows = [
    mkRow('Продолжить', [1, 2], { lumen_personal: true }),
    mkRow('Ещё личный', [1, 2, 3], { lumen_personal: true }),
    mkRow('В тренде', [1, 2, 3, 4, 5, 6, 7])
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(idsOf(out[0]), [1, 2], 'персональный ряд не трогаем');
  assert.deepEqual(idsOf(out[1]), [1, 2, 3], 'и второй тоже');
  assert.deepEqual(idsOf(out[2]), [4, 5, 6, 7], 'а подборке личные карточки уже показаны');
});

/* Волна 4: «Досмотреть» стоит вторым — под подборкой-лидером. Начатый
   фильм не должен стоять ещё и в подборке ВЫШЕ: личные ряды кладут свои
   карточки в окно предварительным проходом, до чистки подборок пачки. */
test('dedupeAcross: «Досмотреть» ниже подборки — начатый фильм уходит и из подборки выше', function () {
  var rows = [
    mkRow('Звёздные войны', [1, 2, 3, 4, 5, 6]),
    mkRow('Досмотреть', [3, 9], { lumen_personal: true }),
    mkRow('Сейчас смотрят', [9, 10, 11, 12, 13])
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(idsOf(out[0]), [1, 2, 4, 5, 6], 'в подборке выше нет фильма из «Досмотреть»');
  assert.deepEqual(idsOf(out[1]), [3, 9], 'личный ряд не трогаем');
  assert.deepEqual(idsOf(out[2]), [10, 11, 12, 13]);
});

test('dedupeAcross: cub и tmdb — одно пространство id (CUB проксирует TMDB)', function () {
  var rows = [
    mkRow('A', [{ id: 7, source: 'cub' }, { id: 8, source: 'cub' }]),
    mkRow('B', [{ id: 7, source: 'tmdb' }, { id: 9, source: 'tmdb' }])
  ];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.deepEqual(idsOf(out[1]), [9],
    'та же «Одиссея» под cub:7 и tmdb:7 — один фильм, а не два');
});

test('dedupeAcross: чужой источник живёт в своём пространстве id', function () {
  var rows = [
    mkRow('A', [{ id: 7, source: 'tmdb' }]),
    mkRow('B', [{ id: 7, source: 'filmix' }, { id: 7, source: 'tmdb' }])
  ];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.deepEqual(out[1].results, [{ id: 7, source: 'filmix' }],
    'у источника, который не проксирует TMDB, id свои — склеивать нельзя');
});

test('dedupeAcross: карточка без source считается tmdb (наш путь Кинопоиска)', function () {
  var rows = [
    mkRow('A', [{ id: 7, source: 'tmdb' }]),
    mkRow('B', [{ id: 7 }, { id: 8 }])
  ];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.deepEqual(idsOf(out[1]), [8]);
});

test('dedupeAcross: карточка без id не ломает проход и не съедает соседей', function () {
  var rows = [
    mkRow('A', [1]),
    mkRow('B', [{ id: null }, { id: undefined }, { id: 2 }])
  ];
  var out = R.dedupeAcross(rows, {}, 1);
  assert.equal(out[1].results.length, 3, 'безымянные карточки остаются на месте');
});

test('dedupeAcross: входные ряды не мутируются', function () {
  var rows = [mkRow('A', [1, 2]), mkRow('B', [1, 2, 3])];
  var before = idsOf(rows[1]);
  var out = R.dedupeAcross(rows, {}, 1);
  assert.deepEqual(idsOf(rows[1]), before, 'исходный объект ряда остался прежним');
  assert.notEqual(out[1], rows[1]);
});

test('dedupeAcross: окно общее на несколько пачек', function () {
  var seen = {};
  var first = R.dedupeAcross([mkRow('A', [1, 2, 3, 4])], seen, 1);
  var second = R.dedupeAcross([mkRow('B', [3, 4, 5, 6])], seen, 1);
  assert.deepEqual(idsOf(first[0]), [1, 2, 3, 4]);
  assert.deepEqual(idsOf(second[0]), [5, 6], 'пачка помнит, что показала предыдущая');
});

test('dedupeAcross: порог применяется ТОЛЬКО к рядам, из которых окно что-то убрало', function () {
  /* Первый ряд короткий сам по себе — так приходят наши подборки
     Кинопоиска и ряды при включённом «Скрывать досмотренное». Окно его не
     трогало, значит и порог к нему не относится. Второй ряд стал коротким
     именно от окна — вот он и есть огрызок. */
  var rows = [
    mkRow('Редкое кино', [1, 2]),
    mkRow('В тренде', [10, 11, 12, 13, 14]),
    mkRow('Сейчас смотрят', [10, 11, 12, 13, 20])
  ];
  var out = R.dedupeAcross(rows, {}, 4);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['Редкое кино', 'В тренде'],
    'нетронутый короткий ряд остаётся, продедуплицированный огрызок уходит');
  assert.deepEqual(idsOf(out[0]), [1, 2]);
});

test('dedupeAcross: пустая пачка не может получиться из непустой', function () {
  /* Окно уже показало 1 и 4 в предыдущей пачке — оба ряда становятся
     огрызками, и порог съел бы всю пачку. */
  var rows = [mkRow('A', [1, 2, 3]), mkRow('B', [4, 5, 6])];
  var out = R.dedupeAcross(rows, { 'tmdb:1': 1, 'tmdb:4': 1 }, 4);
  assert.equal(out.length, 2, 'лучше короткий ряд, чем пустая главная');
  assert.deepEqual(idsOf(out[0]), [2, 3]);
  assert.deepEqual(idsOf(out[1]), [5, 6]);
});

test('dedupeAcross: пустые и битые ряды пропускаются', function () {
  var out = R.dedupeAcross([null, { title: 'X' }, mkRow('Y', []), mkRow('Z', [1])], {}, 1);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['Z']);
  assert.deepEqual(R.dedupeAcross(null, {}, 4), []);
  assert.deepEqual(R.dedupeAcross([], {}, 4), []);
});

/* ---------------------------------------------------------------- */
/* Task 57, рантайм: обёртка над Lampa.Api.main.                      */
/* ---------------------------------------------------------------- */

/* Поддельный Lampa.Api.main: отдаёт batches[0] в oncomplite и возвращает
   функцию next, которая отдаёт следующую пачку — ровно тот контракт,
   которым пользуется компонент главной (app.min.js:37070). */
function setupDedupeRuntime(opts) {
  opts = opts || {};
  var batches = opts.batches || [];
  var mainCalls = [];
  var Lampa = {
    ContentRows: { add: function () {}, remove: function () {} },
    Api: {
      main: function (params, oncomplite, onerror) {
        mainCalls.push(params);
        oncomplite(batches[0] || []);
        var i = 1;
        return function (resolve, reject) {
          if (i < batches.length) resolve(batches[i++]); else reject();
        };
      }
    }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.Lampa = Lampa;
  var prefs = Object.assign({ lumen_rows_dedupe: true }, opts.prefs || {});
  var ctx = loadCtx('44_rows.js', {
    pref: function (name, def) { return (name in prefs) ? prefs[name] : def; },
    sources: { fetch: function () { return { clear: function () {} }; }, posters: function (item, cards, done) { done(0); } },
    lang: function (k) { return k; }
  });
  return { R: ctx.api, LC: ctx.LC, Lampa: Lampa, mainCalls: mainCalls };
}

test('installDedupe: обёртка чистит вторую пачку тем, что показала первая', function () {
  var s = setupDedupeRuntime({
    batches: [
      [mkRow('A', [1, 2, 3, 4, 5])],
      [mkRow('B', [1, 2, 6, 7, 8, 9])]
    ]
  });
  s.R.installDedupe();
  var got = [];
  var next = s.Lampa.Api.main({}, function (data) { got.push(data); }, function () {});
  next(function (data) { got.push(data); }, function () {});
  assert.deepEqual(idsOf(got[0][0]), [1, 2, 3, 4, 5]);
  assert.deepEqual(idsOf(got[1][0]), [6, 7, 8, 9], 'окно живёт весь экран, а не одну пачку');
});

/* Волна 4: Api.main — единственная точка ДО ContentRows.call (main$2,
   app.min.js:19877). План главной обязан отработать раньше штатного main:
   тогда строящаяся главная уже видит ряды новой эпохи. */
test('installDedupe: план главной строится до штатного Api.main, на каждый заход', function () {
  var s = setupDedupeRuntime({ batches: [[mkRow('A', [1, 2, 3, 4])]] });
  var log = [];
  s.LC.homeplan = { apply: function (o) { log.push('plan:' + JSON.stringify(o)); } };
  var original = s.Lampa.Api.main;
  s.Lampa.Api.main = function () { log.push('main'); return original.apply(null, arguments); };
  s.R.installDedupe();
  s.Lampa.Api.main({}, function () {}, function () {});
  s.Lampa.Api.main({}, function () {}, function () {});
  assert.deepEqual(log, ['plan:{"fresh":true}', 'main', 'plan:{"fresh":true}', 'main']);
  /* Упавший план главную не ломает. */
  s.LC.homeplan.apply = function () { throw new Error('план упал'); };
  var got = null;
  s.Lampa.Api.main({}, function (d) { got = d; }, function () {});
  assert.equal(got.length, 1);
  /* Выключенный плагин плана не строит. */
  log.length = 0;
  s.LC.homeplan.apply = function () { log.push('plan'); };
  s.R.uninstallDedupe();
  s.Lampa.Api.main({}, function () {}, function () {});
  assert.deepEqual(log, ['main']);
});

test('installDedupe: новый заход на главную начинает окно заново', function () {
  var s = setupDedupeRuntime({ batches: [[mkRow('A', [1, 2, 3, 4])]] });
  s.R.installDedupe();
  var got = [];
  s.Lampa.Api.main({}, function (d) { got.push(d); }, function () {});
  s.Lampa.Api.main({}, function (d) { got.push(d); }, function () {});
  assert.deepEqual(idsOf(got[1][0]), [1, 2, 3, 4], 'второй заход показывает тот же ряд целиком');
});

test('installDedupe: настройка выключена — данные проходят как есть', function () {
  var s = setupDedupeRuntime({
    prefs: { lumen_rows_dedupe: false },
    batches: [[mkRow('A', [1, 2, 3, 4]), mkRow('B', [1, 2, 3, 4])]]
  });
  s.R.installDedupe();
  var got = null;
  s.Lampa.Api.main({}, function (d) { got = d; }, function () {});
  assert.equal(got.length, 2);
  assert.deepEqual(idsOf(got[1]), [1, 2, 3, 4]);
});

test('installDedupe: идемпотентна, uninstallDedupe возвращает штатный Api.main', function () {
  var s = setupDedupeRuntime({ batches: [[mkRow('A', [1])]] });
  var original = s.Lampa.Api.main;
  s.R.installDedupe();
  s.R.installDedupe();
  assert.notEqual(s.Lampa.Api.main, original);
  s.R.uninstallDedupe();
  assert.equal(s.Lampa.Api.main, original, 'выключенный плагин не оставляет своей обёртки');
  s.R.uninstallDedupe();
  assert.equal(s.Lampa.Api.main, original);
});

test('uninstallDedupe: чужую обёртку поверх нашей не срывает', function () {
  var s = setupDedupeRuntime({ batches: [[mkRow('A', [1])]] });
  s.R.installDedupe();
  var foreign = function () {};
  s.Lampa.Api.main = foreign;
  s.R.uninstallDedupe();
  assert.equal(s.Lampa.Api.main, foreign, 'поверх нас встал чужой плагин — не трогаем');
});

test('uninstallDedupe: осиротевшая под чужой обёрткой наша обёртка становится сквозной', function () {
  var s = setupDedupeRuntime({
    batches: [[mkRow('A', [1, 2, 3, 4]), mkRow('B', [1, 2, 3, 4])]]
  });
  s.R.installDedupe();
  var ours = s.Lampa.Api.main;
  /* Чужой плагин обернул нас — снять свою подмену мы уже не можем. */
  s.Lampa.Api.main = function () { return ours.apply(null, arguments); };
  s.R.uninstallDedupe();
  var got = null;
  s.Lampa.Api.main({}, function (d) { got = d; }, function () {});
  assert.equal(got.length, 2, 'выключенный плагин не чистит ряды');
  assert.deepEqual(idsOf(got[1]), [1, 2, 3, 4]);
});

test('installDedupe: повторная активация под чужой обёрткой не заводит второго окна', function () {
  var s = setupDedupeRuntime({
    batches: [[mkRow('A', [1, 2, 3, 4]), mkRow('B', [1, 2, 3, 4, 5, 6, 7, 8])]]
  });
  s.R.installDedupe();
  var ours = s.Lampa.Api.main;
  var foreign = function () { return ours.apply(null, arguments); };
  s.Lampa.Api.main = foreign;
  s.R.uninstallDedupe();
  s.R.installDedupe();
  assert.equal(s.Lampa.Api.main, foreign, 'чужую обёртку не подменяем и второй своей не накрываем');
  var got = null;
  s.Lampa.Api.main({}, function (d) { got = d; }, function () {});
  assert.deepEqual(idsOf(got[1]), [5, 6, 7, 8], 'фильтрует ровно один раз');
});

test('installDedupe: ошибка загрузки главной проходит насквозь', function () {
  var s = setupDedupeRuntime({ batches: [] });
  s.Lampa.Api.main = function (params, oncomplite, onerror) { onerror('boom'); };
  s.R.installDedupe();
  var err = null;
  s.Lampa.Api.main({}, function () {}, function (e) { err = e; });
  assert.equal(err, 'boom');
});

test('describe: ряд явно выбранного пользователем состава помечен несносимым', function () {
  var s = setupRows({ prefs: { lumen_home_rows: 'col-a,col-b' } });
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (payload) { got.push(payload); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }] });
  assert.equal(got[0].lumen_keep, true);
});

test('describe: ряд набора по умолчанию метки не получает', function () {
  var s = setupRows();
  var rows = s.rows();
  var got = [];
  rows[0].call({}, 'main')(function (payload) { got.push(payload); });
  s.fetchCalls[0].ok({ results: [{ id: 1 }] });
  assert.ok(!got[0].lumen_keep);
});

/* ---------------------------------------------------------------- */
/* Ряд заполнен до правой кромки сразу (дефект 2026-09-23).          */
/* ---------------------------------------------------------------- */

function range(a, b) { var out = []; for (var i = a; i <= b; i++) out.push(i); return out; }

test('fitCount: неполная карточка у правой кромки тоже считается', function () {
  /* Стенд 960×540@2: ряд с 40 px, шаг 128.6 — семь целых и восьмая частично. */
  assert.equal(R.fitCount(960, 40, 128.6), 8);
  /* Ровно по кромке — следующей не видно. */
  assert.equal(R.fitCount(1000, 0, 100), 10);
  assert.equal(R.fitCount(960, 40, 0), 0, 'пробник не намерил шаг — ничего не меняем');
  assert.equal(R.fitCount(10, 40, 100), 0);
});

test('withView: первая порция ряда поднимается до числа видимых карточек', function () {
  var rows = [mkRow('A', range(1, 20)), mkRow('B', range(21, 25))];
  var out = R.withView(rows, 9);
  assert.equal(out[0].params.items.view, 9);
  assert.deepEqual(idsOf(out[0]), range(1, 20), 'состав ряда не меняется');
  assert.equal(out[1], rows[1], 'ряд, который и так строится целиком, не копируется');
  assert.equal(rows[0].params, undefined, 'входной ряд не мутируется — он лежит в кэше Lampa');
});

test('withView: своя порция ряда сохраняет остальные параметры и не уменьшается', function () {
  var wide = mkRow('Скоро', range(1, 20));
  wide.params = { items: { view: 3, mapping: 'line' }, style: 'x' };
  var big = mkRow('Big', range(1, 20));
  big.params = { items: { view: 12 } };
  var out = R.withView([wide, big], 8);
  assert.deepEqual(out[0].params.items, { view: 8, mapping: 'line' });
  assert.equal(out[0].params.style, 'x');
  assert.equal(wide.params.items.view, 3, 'объект параметров Lampa не тронут');
  assert.equal(out[1], big, 'порция больше видимой не уменьшается');
  assert.equal(R.withView(null, 8), null);
  var same = [mkRow('A', range(1, 20))];
  assert.equal(R.withView(same, 0), same, 'без замера ряды проходят как есть');
});

test('installDedupe: обёртка отдаёт ряды с порцией по замеру пробника', function () {
  var s = setupDedupeRuntime({ batches: [[mkRow('A', range(1, 20))], [mkRow('B', range(21, 40))]] });
  /* Поддельный DOM: пробник — это .scroll шириной до 960 и две карточки с
     шагом 128.6 от 40 px, ровно как на стенде 960×540@2. */
  var appended = [];
  var rect = { scroll: { right: 960 }, card0: { left: 40 }, card1: { left: 168.6 } };
  var root = {
    style: {},
    set innerHTML(v) { this._html = v; },
    getElementsByClassName: function (cls) {
      if (cls === 'card') return [{ getBoundingClientRect: function () { return rect.card0; } }, { getBoundingClientRect: function () { return rect.card1; } }];
      return [{ getBoundingClientRect: function () { return rect.scroll; } }];
    }
  };
  globalThis.window.document = {
    createElement: function () { return root; },
    body: { appendChild: function (n) { appended.push(n); n.parentNode = this; }, removeChild: function (n) { appended.splice(appended.indexOf(n), 1); n.parentNode = null; } }
  };
  s.R.installDedupe();
  var got = [];
  var next = s.Lampa.Api.main({}, function (d) { got.push(d); }, function () {});
  next(function (d) { got.push(d); }, function () {});
  assert.equal(got[0][0].params.items.view, 8);
  assert.equal(got[1][0].params.items.view, 8, 'следующие пачки — с тем же замером');
  assert.equal(appended.length, 0, 'пробник снят');
  assert.equal(root.className, 'lumen-main', 'пробник обязан пройти правила ряда главной');
});

/* Ревью фикс-раунда, Ф2 п.4. «Кадр над рядами: выключен» — героя нет, класса
   .lumen-main на главной нет (src/48_hero.js, sizeOff), карточки штатной
   ширины Lampa. Пробник с .lumen-main мерил бы нашу, более узкую карточку,
   завышал бы число видимых, и правило «огрызка» выбрасывало бы ряды,
   которые на самом деле заполняют экран. */
test('Ф2 п.4: при выключенном кадре пробник мерит штатный ряд Lampa, без .lumen-main', function () {
  function probeDoc(log) {
    var root = {
      style: {},
      getElementsByClassName: function (cls) {
        /* Шаг карточки зависит от класса пробника: наша 128.6, штатная 240. */
        var pitch = /(^|\s)lumen-main(\s|$)/.test(root.className || '') ? 128.6 : 240;
        if (cls === 'card') return [{ getBoundingClientRect: function () { return { left: 40 }; } }, { getBoundingClientRect: function () { return { left: 40 + pitch }; } }];
        return [{ getBoundingClientRect: function () { return { right: 960 }; } }];
      }
    };
    globalThis.window.document = {
      createElement: function () { log.push(root); return root; },
      body: { appendChild: function (n) { n.parentNode = this; }, removeChild: function (n) { n.parentNode = null; } }
    };
  }
  /* «Неделя»: 4 из 20 после окна. Штатно в ряд входит 4 карточки
     (ceil((960-40)/240)), и такой ряд экран заполняет — выбрасывать его нельзя. */
  var rows = function () { return [mkRow('Сегодня', range(1, 16)), mkRow('Неделя', range(1, 20))]; };

  var off = setupDedupeRuntime({ batches: [rows()], prefs: { lumen_hero_size: 'off' } });
  var probesOff = [];
  probeDoc(probesOff);
  off.R.installDedupe();
  var gotOff = null;
  off.Lampa.Api.main({}, function (d) { gotOff = d; }, function () {});
  assert.equal(probesOff.length, 1);
  assert.equal(/lumen-main/.test(probesOff[0].className || ''), false, 'пробник при выключенном кадре взял правила нашей главной');
  assert.deepEqual(gotOff.map(function (r) { return r.title; }), ['Сегодня', 'Неделя'],
    'ряд, заполняющий штатную ширину, выброшен как огрызок');

  /* Контроль: с кадром тот же набор — «Неделя» огрызок (4 при месте на 8). */
  var on = setupDedupeRuntime({ batches: [rows()], prefs: { lumen_hero_size: 'large' } });
  var probesOn = [];
  probeDoc(probesOn);
  on.R.installDedupe();
  var gotOn = null;
  on.Lampa.Api.main({}, function (d) { gotOn = d; }, function () {});
  assert.equal(probesOn[0].className, 'lumen-main');
  assert.deepEqual(gotOn.map(function (r) { return r.title; }), ['Сегодня']);
  delete globalThis.window.document;
});

test('installDedupe: ряд, обрезанный окном короче видимой ширины, не показывается', function () {
  /* «В тренде за неделю»: 16 из 20 уже выше, оставалось 4 при месте на 8. */
  var s = setupDedupeRuntime({ batches: [[
    mkRow('Сегодня', range(1, 16)),
    mkRow('Неделя', range(1, 20)),
    mkRow('Длинный', range(10, 40)),
    mkRow('Короткий сам по себе', [100, 101, 102]),
    /* Подборка из 11, три в дублях: 8 < 8? нет — ровно на всю ширину. */
    mkRow('Звёздные войны', [1, 2, 3].concat(range(200, 207)))
  ]] });
  var root = {
    style: {},
    getElementsByClassName: function (cls) {
      if (cls === 'card') return [{ getBoundingClientRect: function () { return { left: 40 }; } }, { getBoundingClientRect: function () { return { left: 168.6 }; } }];
      return [{ getBoundingClientRect: function () { return { right: 960 }; } }];
    }
  };
  globalThis.window.document = { createElement: function () { return root; }, body: { appendChild: function (n) { n.parentNode = this; }, removeChild: function (n) { n.parentNode = null; } } };
  s.R.installDedupe();
  var got = null;
  s.Lampa.Api.main({}, function (d) { got = d; }, function () {});
  assert.deepEqual(got.map(function (r) { return r.title; }), ['Сегодня', 'Длинный', 'Короткий сам по себе', 'Звёздные войны'],
    'обрезанный до 4 ряд выброшен, обрезанный до 24 — нет, короткий от природы — тоже нет');
  /* Без замера — прежний пол 4: ряд из 4 остаётся. */
  delete globalThis.window.document;
  var s2 = setupDedupeRuntime({ batches: [[mkRow('Сегодня', range(1, 16)), mkRow('Неделя', range(1, 20))]] });
  s2.R.installDedupe();
  var got2 = null;
  s2.Lampa.Api.main({}, function (d) { got2 = d; }, function () {});
  assert.equal(got2.length, 2);
});

test('dedupeAcross: fit выбрасывает только огрызок — короче экрана И меньше половины состава', function () {
  var seen = {};
  R.dedupeAcross([mkRow('Выше', range(1, 16))], seen, 4, 9);
  var out = R.dedupeAcross([
    mkRow('Неделя', range(1, 20)),                         /* 4 из 20, 4 < 9 и 4·2 < 20 — огрызок */
    mkRow('Звёздные войны', [1, 2, 3].concat(range(30, 37))), /* 8 из 11, 8 < 9, но 16 ≥ 11 — подборка */
    mkRow('Половина', range(40, 47).concat(range(1, 8))),   /* 8 из 16: ровно половина — остаётся */
    mkRow('Свой', [1, 2, 50], { lumen_keep: true })         /* выбран вручную — остаётся всегда */
  ], seen, 4, 9);
  assert.deepEqual(out.map(function (r) { return r.title; }), ['Звёздные войны', 'Половина', 'Свой']);
  /* Без fit — прежнее правило, только пол 4. */
  var old = R.dedupeAcross([mkRow('Выше', range(1, 16)), mkRow('Неделя', range(1, 20))], {}, 4);
  assert.equal(old.length, 2);
});

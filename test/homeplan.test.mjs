import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load, loadCtx } from './_load.mjs';

/* Волна 4 (ТВ 2026-09-24): ротация рядов главной. Пользователь: «нет
   ротации списков в начале, постоянно только что вы смотрели раньше — это
   бесит». План главной — src/47_homeplan.js: чистые функции (эпоха, зерно,
   раскладка по местам) и apply(), который регистрирует ряды в Lampa. */

const ROWS = load('44_rows.js');
const PERSONAL = load('45_personal.js');
const CATALOG = load('42_manifest.js').DEFAULT;

function planModule(extra) {
  return loadCtx('47_homeplan.js', Object.assign({ rows: ROWS, personal: PERSONAL }, extra || {})).api;
}
const H = planModule();

const ALL = { continue: true, because: true, new_episodes: true, soon: true };
const byId = {};
CATALOG.collections.forEach(function (c) { byId[c.id] = c; });

function plan(extra) {
  return H.planHome(Object.assign({
    manifest: CATALOG, picked: null, month: 9, epoch: 1, have: ALL,
    recentLeads: [], kpKey: false, limit: 15, mode: 'rotate', advent: false
  }, extra || {}));
}
function at(p, place) {
  for (var i = 0; i < p.slots.length; i++) if (p.slots[i].place === place) return p.slots[i];
  return null;
}
function collections(p) { return p.slots.filter(function (s) { return s.kind === 'collection'; }); }
function inSeason(item, month) { return !!(item.season && item.season.indexOf(month) !== -1); }

/* ---------------------------------------------------------------- */
/* ГПСЧ и зерно эпохи                                                */
/* ---------------------------------------------------------------- */

test('rng: Парк–Миллер — одно зерно даёт одну и ту же последовательность в [0, 1)', function () {
  var a = H.rng(12345), b = H.rng(12345);
  for (var i = 0; i < 1000; i++) {
    var x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1, 'вне [0, 1): ' + x);
  }
  /* Первый шаг — ровно s·16807 mod (2^31 − 1). */
  var r = H.rng(1);
  assert.equal(r(), (16807 - 1) / 2147483646);
  /* Нулевое и отрицательное зерно не вырождаются в постоянный ноль. */
  var z = H.rng(0);
  assert.notEqual(z(), z());
});

test('seedOf: соседние эпохи дают далёкие зёрна, соль разводит потоки', function () {
  var seen = {};
  for (var n = 1; n <= 200; n++) {
    var s = H.seedOf(n, 1);
    assert.ok(s >= 1 && s < 2147483647, 'зерно вне диапазона Парка–Миллера: ' + s);
    assert.ok(!seen[s], 'повтор зерна у эпохи ' + n);
    seen[s] = 1;
    assert.notEqual(H.seedOf(n, 1), H.seedOf(n, 2));
  }
  assert.equal(H.seedOf(7, 1), H.seedOf(7, 1));
});

/* ---------------------------------------------------------------- */
/* Эпоха                                                             */
/* ---------------------------------------------------------------- */

test('nextEpoch: первое построение после активации двигает эпоху не раньше чем через 10 минут', function () {
  var T = Date.UTC(2026, 8, 24, 11, 0);
  var rec = { n: 5, at: T };
  assert.equal(H.nextEpoch(rec, T + 9 * 60000, true), rec, 'перезапуск через 9 минут — та же эпоха');
  assert.deepEqual(H.nextEpoch(rec, T + 10 * 60000, true), { n: 6, at: T + 10 * 60000 });
});

test('nextEpoch: без перезапуска эпоха сменяется раз в 3 часа', function () {
  var T = Date.UTC(2026, 8, 24, 11, 0);
  var rec = { n: 5, at: T };
  assert.equal(H.nextEpoch(rec, T + 2 * 3600000, false), rec, 'через 2 часа — та же');
  assert.deepEqual(H.nextEpoch(rec, T + 4 * 3600000, false), { n: 6, at: T + 4 * 3600000 }, 'через 4 часа — следующая');
});

test('nextEpoch: нет записи — первая эпоха; часы ушли назад — следующая', function () {
  var T = Date.UTC(2026, 8, 24, 11, 0);
  assert.deepEqual(H.nextEpoch(null, T, false), { n: 1, at: T });
  assert.deepEqual(H.nextEpoch({ n: 'x' }, T, true), { n: 1, at: T }, 'битая запись — как её отсутствие');
  assert.deepEqual(H.nextEpoch({ n: 3, at: T }, T - 3600000, false), { n: 4, at: T - 3600000 },
    'часы телевизора переставили назад — иначе эпоха застыла бы до прежнего времени');
});

/* ---------------------------------------------------------------- */
/* «Потому что вы смотрели»: исходный фильм эпохи                    */
/* ---------------------------------------------------------------- */

test('pickAnchor: один из пяти последних уникальных, одинаковый в одной эпохе', function () {
  var history = [];
  for (var i = 1; i <= 12; i++) history.push({ id: i, title: 'F' + i });
  history.splice(2, 0, { id: 1, title: 'F1 повтор' });
  var got = {};
  for (var n = 1; n <= 60; n++) {
    var a = H.pickAnchor(history, 5, H.seedOf(n, 2));
    assert.deepEqual(a, H.pickAnchor(history, 5, H.seedOf(n, 2)), 'эпоха ' + n + ': выбор обязан повторяться');
    assert.ok(a.id >= 1 && a.id <= 5, 'эпоха ' + n + ': фильм не из пяти последних — ' + a.id);
    got[a.id] = 1;
  }
  assert.ok(Object.keys(got).length >= 4, 'за 60 эпох выбор должен побывать почти на всех пяти: ' + Object.keys(got));
  assert.equal(H.pickAnchor([], 5, 1), null);
  assert.equal(H.pickAnchor([{ id: 9, title: 'Один' }], 5, 77).id, 9);
});

/* ---------------------------------------------------------------- */
/* Раскладка главной                                                 */
/* ---------------------------------------------------------------- */

test('planHome: одна эпоха — один и тот же план, разные эпохи — разные лидеры', function () {
  assert.deepEqual(plan({ epoch: 7 }), plan({ epoch: 7 }));
  var leads = {};
  for (var n = 1; n <= 12; n++) leads[plan({ epoch: n }).lead] = 1;
  assert.ok(Object.keys(leads).length >= 8, 'за 12 эпох лидеров слишком мало: ' + Object.keys(leads).join(', '));
  assert.notEqual(plan({ epoch: 1 }).lead, plan({ epoch: 2 }).lead);
});

test('planHome, rotate: подборка-лидер на месте 0, «Досмотреть» вторым, место 2 — ряду Lampa', function () {
  var p = plan();
  assert.equal(at(p, 0).kind, 'collection');
  assert.equal(at(p, 0).id, p.lead);
  assert.deepEqual([at(p, 1).kind, at(p, 1).id], ['personal', 'continue']);
  assert.equal(at(p, 2), null, 'место 2 не занимаем — туда встаёт первый ряд Lampa');
  assert.deepEqual([at(p, 3).id, at(p, 5).id, at(p, 8).id], ['new_episodes', 'because', 'soon']);
  assert.equal(collections(p).length, 15, 'подборок — сколько задано «Количеством рядов»');
});

test('planHome, rotate: нет личного ряда — его место занимает подборка', function () {
  var p = plan({ have: { because: true, soon: true } });
  assert.equal(at(p, 1).kind, 'collection', 'нет «Досмотреть» — на месте 1 подборка');
  assert.equal(at(p, 3).kind, 'collection');
  assert.equal(at(p, 2), null);
});

test('planHome, history: «Досмотреть», «Потому что», «Новые серии», «Скоро» сверху, подборки с места 4', function () {
  var p = plan({ mode: 'history' });
  assert.deepEqual(p.slots.slice(0, 4).map(function (s) { return s.place + ':' + s.id; }),
    ['0:continue', '1:because', '2:new_episodes', '3:soon']);
  assert.equal(p.lead, null, 'в режиме истории лидера нет');
  var cols = collections(p);
  assert.equal(cols[0].place, 4);
  assert.deepEqual(cols.map(function (s) { return s.id; }), ['star-wars', 'netflix-comedy', 'apple-tv', 'kdrama', 'anime', 'kp-top250'],
    'набор по умолчанию, без «Рождественских комедий» в сентябре');
  /* Нет «Досмотреть» — место 0 свободно, как было: туда встаёт ряд Lampa. */
  assert.equal(at(plan({ mode: 'history', have: { because: true, soon: true } }), 0), null);
});

test('planHome, rotate: личные ряды не на месте 0 и не подряд', function () {
  var haves = [ALL, { continue: true, soon: true }, { because: true, new_episodes: true, soon: true }, { continue: true, because: true }];
  for (var h = 0; h < haves.length; h++) {
    for (var n = 1; n <= 20; n++) {
      var p = plan({ epoch: n, have: haves[h] });
      var own = p.slots.filter(function (s) { return s.kind === 'personal'; }).map(function (s) { return s.place; });
      assert.ok(own.indexOf(0) === -1, 'личный ряд на месте 0');
      for (var i = 1; i < own.length; i++) assert.ok(own[i] - own[i - 1] > 1, 'личные ряды подряд: ' + own.join(','));
    }
  }
});

test('planHome, rotate: две подборки одной группы подряд не стоят', function () {
  for (var n = 1; n <= 60; n++) {
    var p = plan({ epoch: n, have: n % 2 ? ALL : {} });
    var cols = collections(p);
    for (var i = 1; i < cols.length; i++) {
      if (cols[i].place !== cols[i - 1].place + 1) continue;
      assert.notEqual(cols[i].item.group, cols[i - 1].item.group,
        'эпоха ' + n + ': ' + cols[i - 1].id + ' и ' + cols[i].id + ' подряд из группы ' + cols[i].item.group);
    }
  }
});

test('planHome, rotate: лидер не повторяет лидеров двух прошлых эпох', function () {
  var recent = [];
  for (var n = 1; n <= 40; n++) {
    var p = plan({ epoch: n, recentLeads: recent.slice() });
    assert.ok(recent.indexOf(p.lead) === -1, 'эпоха ' + n + ': лидер ' + p.lead + ' был в ' + recent.join(', '));
    recent.unshift(p.lead);
    recent.length = Math.min(recent.length, 2);
  }
  /* Даже когда зерно указало бы на него: лидер эпохи 3 запрещён. */
  var free = plan({ epoch: 3 }).lead;
  assert.notEqual(plan({ epoch: 3, recentLeads: [free] }).lead, free);
});

/* Подборки одной группы стоят в каталоге подряд и берут соседние числа
   ГПСЧ: без потолка бывала главная из девяти «Режиссёров» из пятнадцати. */
test('planHome: из одной группы — не больше четверти состава', function () {
  for (var n = 1; n <= 100; n++) {
    var count = {};
    collections(plan({ epoch: n })).forEach(function (s) { count[s.item.group] = (count[s.item.group] || 0) + 1; });
    for (var g in count) assert.ok(count[g] <= 4, 'эпоха ' + n + ': ' + count[g] + ' из группы ' + g);
  }
  var cols = collections(plan({ limit: 10 }));
  var c10 = {};
  cols.forEach(function (s) { c10[s.item.group] = (c10[s.item.group] || 0) + 1; });
  for (var k in c10) assert.ok(c10[k] <= 3, 'десять рядов: ' + c10[k] + ' из группы ' + k);
});

test('planHome: без ключа Кинопоиска подборок Кинопоиска нет, с ключом — могут быть', function () {
  var withKey = 0;
  for (var n = 1; n <= 40; n++) {
    collections(plan({ epoch: n })).forEach(function (s) {
      assert.notEqual(s.item.group, 'kp', 'эпоха ' + n + ': ' + s.id + ' без ключа');
    });
    withKey += collections(plan({ epoch: n, kpKey: true })).filter(function (s) { return s.item.group === 'kp'; }).length;
  }
  assert.ok(withKey > 0, 'с ключом подборки Кинопоиска в ротации есть');
});

test('planHome: сезонная не в свой месяц не показывается, в свой — ровно одна на местах 0–4', function () {
  for (var n = 1; n <= 60; n++) {
    var p = plan({ epoch: n, have: n % 3 ? ALL : {} });
    var cols = collections(p);
    cols.forEach(function (s) {
      assert.ok(!s.item.season || inSeason(s.item, 9), 'эпоха ' + n + ': ' + s.id + ' не в сентябре');
    });
    var top = cols.filter(function (s) { return s.place <= 4 && inSeason(s.item, 9); });
    assert.equal(top.length, 1, 'эпоха ' + n + ': сезонных на местах 0–4 — ' + top.length);
  }
  /* Январь: три сезонных в сезоне — наверху всё равно одна. */
  for (var e = 1; e <= 30; e++) {
    var jan = collections(plan({ epoch: e, month: 1 }));
    assert.equal(jan.filter(function (s) { return s.place <= 4 && inSeason(s.item, 1); }).length, 1, 'январь, эпоха ' + e);
  }
});

test('planHome: в декабре адвент на месте 0, лидер — первой подборкой после него, сезонных наверху больше нет', function () {
  var p = plan({ month: 12, advent: true });
  assert.deepEqual([at(p, 0).kind, at(p, 0).id], ['advent', 'advent']);
  assert.equal(at(p, 1).id, 'continue');
  assert.equal(collections(p)[0].id, p.lead);
  for (var n = 1; n <= 60; n++) {
    var dec = plan({ epoch: n, month: 12, advent: true, have: n % 2 ? ALL : {} });
    assert.equal(collections(dec).filter(function (s) { return s.place <= 4 && inSeason(s.item, 12); }).length, 0,
      'эпоха ' + n + ': адвент уже сезонный ряд наверху — рождественская подборка там вторая');
  }
  var h = plan({ month: 12, advent: true, mode: 'history' });
  assert.equal(at(h, 4).kind, 'advent', 'в режиме истории — как было: первым среди подборок');
  assert.equal(collections(h)[0].place, 5);
});

test('planHome: состав, выбранный вручную, — крутится его порядок', function () {
  var picked = ['star-wars', 'pixar', 'nolan', 'kdrama', 'best-90s', 'horror-top'];
  var firsts = {};
  for (var n = 1; n <= 12; n++) {
    var cols = collections(plan({ epoch: n, picked: picked }));
    assert.deepEqual(cols.map(function (s) { return s.id; }).sort(), picked.slice().sort(), 'состав — ровно выбранный');
    firsts[cols[0].id] = 1;
  }
  assert.ok(Object.keys(firsts).length >= 3, 'первой должна бывать не одна и та же подборка');
  /* Выбранная вручную сезонная не в сезон остаётся — это выбор пользователя. */
  var own = collections(plan({ picked: ['xmas-comedy', 'star-wars'] })).map(function (s) { return s.id; }).sort();
  assert.deepEqual(own, ['star-wars', 'xmas-comedy']);
});

test('planHome: подборки из набора по умолчанию выпадают вдвое чаще остальных', function () {
  var home = {};
  CATALOG.home.forEach(function (id) { home[id] = 1; });
  var inHome = 0, other = 0, homeN = 0, otherN = 0;
  CATALOG.collections.forEach(function (c) {
    if (c.group === 'kp' || (c.season && c.season.indexOf(9) === -1)) return;
    if (home[c.id]) homeN++; else otherN++;
  });
  for (var n = 1; n <= 400; n++) {
    collections(plan({ epoch: n })).forEach(function (s) { if (home[s.id]) inHome++; else other++; });
  }
  var ratio = (inHome / homeN) / (other / otherN);
  assert.ok(ratio > 1.5 && ratio < 2.6, 'частота подборки из набора по умолчанию к обычной: ' + ratio.toFixed(2));
});

test('planHome: без каталога — только личные ряды, на своих местах', function () {
  var p = plan({ manifest: null });
  assert.deepEqual(p.slots.map(function (s) { return s.place + ':' + s.id; }), ['1:continue', '3:new_episodes', '5:because', '8:soon']);
  assert.equal(p.lead, null);
});

test('recentLeads/rememberLead: лидеры прошлых эпох, не текущей', function () {
  var leads = H.rememberLead([], 4, 'a');
  leads = H.rememberLead(leads, 5, 'b');
  leads = H.rememberLead(leads, 6, 'c');
  assert.deepEqual(H.recentLeads(leads, 6), ['b', 'a'], 'для эпохи 6 — два лидера до неё');
  assert.deepEqual(H.recentLeads(leads, 7), ['c', 'b']);
  /* Повторная сборка той же эпохи переписывает её запись, а не множит. */
  leads = H.rememberLead(leads, 6, 'd');
  assert.deepEqual(leads.map(function (r) { return r.n + r.id; }), ['4a', '5b', '6d']);
  for (var n = 7; n <= 12; n++) leads = H.rememberLead(leads, n, 'x' + n);
  assert.ok(leads.length <= 4, 'история лидеров не растёт без конца');
  assert.deepEqual(H.recentLeads(null, 3), []);
});

/* ====================================================================== */
/* Рантайм: apply() регистрирует ряды главной в Lampa.ContentRows.         */
/* ====================================================================== */

function loadInto(LC, name) {
  const src = readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

/* Модель Lampa.ContentRows — add/remove/call как в vendor/lampa/app.min.js
   (add$b :18061-18072, remove$3 :18074-18080, call$1 :18083-18108): ряды
   хранятся в порядке регистрации, call$1 обходит их по порядку, отсеивает
   выключенные в «Каналах» (Storage content_rows_<name>) и вставляет
   функцию ряда в список частей по его index — Arrays.insert, то есть
   splice(index, 0, fn) (:2362). */
function lampaRows(storage) {
  const rows = [];
  return {
    rows,
    add(row) { if (rows.indexOf(row) === -1) rows.push(row); },
    remove(row) { const i = rows.indexOf(row); if (i > -1) rows.splice(i, 1); },
    call(screen, params, calls) {
      rows.filter((row) => (Array.isArray(row.screen) ? row.screen.indexOf(screen) >= 0 : row.screen === screen))
        .filter((row) => storage.get('content_rows_' + (row.name || 'unknown'), 'true'))
        .forEach((row) => {
          const result = row.call(params, screen);
          if (typeof result === 'function') {
            result.rowName = row.name;
            calls.splice(row.index || 0, 0, result);
          }
        });
    }
  };
}

/* Штатные части главной TMDB до ContentRows.call (main$2, :19798-19876). */
const LAMPA_MAIN = ['now_playing', 'trend_day', 'trend_week', 'upcoming', 'popular', 'tv_week', 'top_movie', 'top_tv'];

function buildMain(env) {
  const calls = LAMPA_MAIN.map((name) => { const f = function () {}; f.rowName = name; return f; });
  env.Lampa.ContentRows.call('main', {}, calls);
  return calls.map((f) => f.rowName);
}

function setupApply(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const writes = [];
  const Storage = {
    get: (k, d) => (k in store ? store[k] : (d === 'true' ? true : d === 'false' ? false : d)),
    set: (k, v, nolisten) => { store[k] = v; writes.push({ k, v, nolisten }); }
  };
  const tmdb = [];
  const history = opts.history || [{ id: 11, title: 'Свежий' }, { id: 12, title: 'Второй' }, { id: 13, title: 'Третий' }];
  const Lampa = {
    Storage,
    ContentRows: lampaRows(Storage),
    Favorite: {
      continues: (m) => (m === 'movie' && opts.cont !== false ? [{ id: 500, title: 'Начатый', original_title: 'Начатый' }] : []),
      get: (q) => (q.type === 'history' ? history : q.type === 'book' ? (opts.shows || [{ id: 900, name: 'Сериал' }]) : [])
    },
    Timeline: { view: () => ({ percent: 10 }) },
    Utils: { hash: (s) => s },
    Api: { sources: { tmdb: { get: (url, p, ok, err) => tmdb.push({ url, ok, err }) } } }
  };
  globalThis.window = { Lampa };
  globalThis.Lampa = Lampa;
  if (opts.lampaRows) opts.lampaRows(Lampa.ContentRows);
  const prefs = Object.assign({ lumen_rows_limit: '15', lumen_home_rows: '', lumen_personal_rows: true, lumen_kp_key: '', lumen_home_start: 'rotate' }, opts.prefs || {});
  const LC = {
    pref: (k, d) => (k in prefs ? prefs[k] : d),
    lang: (k) => k,
    sources: { fetch: () => ({ clear() {} }), posters: (item, cards, done) => done(0) },
    themes: { month: () => opts.month || 9 }
  };
  for (const f of ['10_util.js', '44_rows.js', '45_personal.js', '47_homeplan.js']) loadInto(LC, f);
  let now = opts.now || Date.UTC(2026, 8, 24, 11, 0);
  LC.homeplan._now = () => now;
  return {
    LC, H: LC.homeplan, Lampa, store, writes, tmdb, prefs,
    setNow: (t) => { now = t; },
    ours: () => Lampa.ContentRows.rows.filter((r) => /^lumen_/.test(r.name))
  };
}

test('apply: ряды регистрируются строго по возрастанию мест, index — место в плане', function () {
  const s = setupApply();
  const p = s.H.apply({ start: true, manifest: CATALOG });
  const ours = s.ours();
  assert.deepEqual(ours.map((r) => r.index), p.slots.map((x) => x.place));
  for (let i = 1; i < ours.length; i++) assert.ok(ours[i].index > ours[i - 1].index, 'регистрация не по возрастанию');
  assert.equal(ours[1].name, 'lumen_continue');
  assert.equal(ours[1].index, 1);
  assert.equal(ours[0].name, 'lumen_' + p.lead);
});

test('apply: повторный вызов снимает прошлый набор, unregister — всё', function () {
  const s = setupApply();
  s.H.apply({ start: true, manifest: CATALOG });
  const first = s.ours().length;
  s.H.apply();
  assert.equal(s.ours().length, first, 'ряды не задвоились');
  s.H.unregister();
  assert.equal(s.ours().length, 0);
});

test('модель вставки Lampa: порядок главной одинаков при синхронном и асинхронном каталоге и при continue_watch Lampa на месте 1', function () {
  /* Ряды Lampa с index 1 зарегистрированы при её старте, раньше плагина
     (continue_watch — app.min.js:22241, timetable_* — :21454, :21486). */
  function lampaOwn(rows) {
    rows.add({ name: 'continue_watch', title: 'x', index: 1, screen: ['main', 'category'], call: () => function () {} });
    rows.add({ name: 'timetable_lately', title: 'x', index: 1, screen: ['main', 'category'], call: () => function () {} });
  }
  const sync = setupApply({ lampaRows: lampaOwn });
  sync.H.apply({ start: true, manifest: CATALOG });
  const a = buildMain(sync);

  /* Каталог приехал после личных рядов (кэш каталога устарел, сеть). */
  const late = setupApply({ lampaRows: lampaOwn });
  late.H.apply({ start: true });
  late.H.apply({ manifest: CATALOG });
  const b = buildMain(late);

  const bare = setupApply();
  bare.H.apply({ start: true, manifest: CATALOG });
  const c = buildMain(bare).filter((n) => /^lumen_/.test(n));

  assert.deepEqual(b, a, 'порядок не зависит от того, когда приехал каталог');
  assert.deepEqual(a.slice(1, 4), ['lumen_continue', 'now_playing', 'lumen_new_episodes'],
    '1 — «Досмотреть», 2 — первый ряд Lampa, 3 — «Новые серии»');
  assert.ok(/^lumen_/.test(a[0]) && a[0] !== 'lumen_continue', 'на месте 0 — подборка-лидер');
  assert.deepEqual(a.filter((n) => /^lumen_/.test(n)), c, 'ряды Lampa с index 1 не сдвигают наши');
  const lastOurs = a.map((n) => /^lumen_/.test(n)).lastIndexOf(true);
  assert.ok(a.indexOf('continue_watch') > lastOurs, 'continue_watch Lampa — после наших рядов');
});

test('apply: эпоха двигается при первом построении после активации (≥ 10 мин) и раз в 3 часа, пересборка под hold — нет', function () {
  const T = Date.UTC(2026, 8, 24, 11, 0);
  const s = setupApply({ now: T, storage: { lumen_home_epoch: { n: 4, at: T - 60 * 60000 } } });
  s.H.apply({ start: true, manifest: CATALOG });
  assert.equal(s.store.lumen_home_epoch.n, 4, 'регистрация при активации эпоху не двигает');
  const lead4 = s.ours()[0].name;
  s.H.apply({ fresh: true });
  assert.deepEqual(s.store.lumen_home_epoch, { n: 5, at: T }, 'первое построение после активации, час с прошлого шага');
  const lead5 = s.ours()[0].name;
  assert.notEqual(lead5, lead4, 'новая эпоха — новый лидер');
  s.setNow(T + 3600000);
  s.H.apply({ fresh: true });
  assert.equal(s.store.lumen_home_epoch.n, 5, 'второе построение через час — та же эпоха');
  assert.equal(s.ours()[0].name, lead5, 'и тот же порядок');
  s.setNow(T + 4 * 3600000);
  s.H.hold(true);
  s.H.apply({ fresh: true });
  s.H.hold(false);
  assert.equal(s.store.lumen_home_epoch.n, 5, 'пересборка из-за настройки эпоху не двигает');
  s.H.apply({ fresh: true });
  assert.equal(s.store.lumen_home_epoch.n, 6, 'через 4 часа обычное построение — следующая эпоха');
  assert.ok(s.writes.every((w) => w.k.indexOf('lumen_home_') !== 0 || w.nolisten === true),
    'служебные записи не рассылают событие Storage');
});

test('apply: перезапуск через 5 минут — та же эпоха; пересборка гонки первого экрана — первое построение', function () {
  const T = Date.UTC(2026, 8, 24, 11, 0);
  const s = setupApply({ now: T, storage: { lumen_home_epoch: { n: 4, at: T - 5 * 60000 } } });
  s.H.apply({ start: true, manifest: CATALOG });
  s.H.apply({ fresh: true });
  assert.equal(s.store.lumen_home_epoch.n, 4);
  /* Главная построилась раньше, чем приехал плагин, и repairHomeRows её
     пересобирает: это первое построение с нашими рядами после запуска. */
  const r = setupApply({ now: T, storage: { lumen_home_epoch: { n: 4, at: T - 60 * 60000 } } });
  r.H.apply({ start: true, manifest: CATALOG });
  r.H.hold(true);
  r.H.apply({ fresh: true });
  r.H.hold(false);
  assert.equal(r.store.lumen_home_epoch.n, 5);
});

test('apply: лидер эпохи запоминается и в двух следующих эпохах лидером не встаёт', function () {
  const T = Date.UTC(2026, 8, 24, 11, 0);
  const s = setupApply({ now: T });
  s.H.apply({ start: true, manifest: CATALOG });
  const seen = [];
  for (let k = 1; k <= 8; k++) {
    s.setNow(T + k * 4 * 3600000);
    const p = s.H.apply({ fresh: true });
    assert.ok(seen.slice(-2).indexOf(p.lead) === -1, 'лидер ' + p.lead + ' повторил недавнего: ' + seen.slice(-2));
    seen.push(p.lead);
  }
  assert.ok(s.store.lumen_home_leads.length <= 4);
});

test('apply: ряд, выключенный в «Каналах» Lampa, в план не входит — его место занимает следующий', function () {
  const s = setupApply({ storage: { content_rows_lumen_continue: false } });
  const p = s.H.apply({ start: true, manifest: CATALOG });
  assert.equal(s.ours().filter((r) => r.name === 'lumen_continue').length, 0);
  assert.equal(p.slots[1].kind, 'collection', 'на месте 1 подборка, а не дыра');
  const off = setupApply({ storage: { ['content_rows_lumen_' + p.lead]: false } });
  const q = off.H.apply({ start: true, manifest: CATALOG });
  assert.notEqual(q.lead, p.lead, 'выключенная подборка лидером не встаёт');
});

test('apply: «Потому что вы смотрели» — один из пяти последних фильмов по эпохе, заголовок о нём же', function () {
  const history = [];
  for (let i = 1; i <= 9; i++) history.push({ id: i, title: 'Ф' + i });
  const got = {};
  for (let n = 1; n <= 30; n++) {
    const s = setupApply({ history, storage: { lumen_home_epoch: { n: n, at: Date.UTC(2026, 8, 24, 11, 0) } } });
    s.H.apply({ start: true, manifest: CATALOG });
    const row = s.ours().filter((r) => r.name === 'lumen_because')[0];
    const m = /«Ф(\d)»/.exec(row.title);
    assert.ok(m && +m[1] <= 5, 'эпоха ' + n + ': не из пяти последних — ' + row.title);
    const answers = [];
    row.call({}, 'main')((data) => answers.push(data));
    assert.deepEqual(s.tmdb.map((c) => c.url), ['movie/' + m[1] + '/recommendations'], 'рекомендации — к фильму из заголовка');
    s.tmdb[0].ok({ results: [{ id: 77 }] });
    assert.equal(answers[0].title, row.title);
    got[m[1]] = 1;
  }
  assert.ok(Object.keys(got).length >= 3, 'по эпохам исходный фильм меняется: ' + Object.keys(got));
});

test('apply: «Сначала «Досмотреть»» — личные ряды сверху, как до волны 4', function () {
  const s = setupApply({ prefs: { lumen_home_start: 'history' } });
  s.H.apply({ start: true, manifest: CATALOG });
  assert.deepEqual(s.ours().slice(0, 5).map((r) => r.index + ':' + r.name),
    ['0:lumen_continue', '1:lumen_because', '2:lumen_new_episodes', '3:lumen_soon', '4:lumen_star-wars']);
  assert.equal(s.store.lumen_home_leads, undefined, 'в режиме истории лидеров не пишем');
});

test('apply: «Количество рядов» — число подборок, личные ряды сверх него', function () {
  const s = setupApply({ prefs: { lumen_rows_limit: '10' } });
  s.H.apply({ start: true, manifest: CATALOG });
  const personal = ['lumen_continue', 'lumen_because', 'lumen_new_episodes', 'lumen_soon'];
  assert.equal(s.ours().filter((r) => personal.indexOf(r.name) === -1).length, 10);
  assert.equal(s.ours().length, 14);
});

test('apply: ряды выбранного вручную состава дедупликация по длине не выбрасывает (lumen_keep)', function () {
  const s = setupApply({ prefs: { lumen_home_rows: 'pixar,nolan' } });
  s.H.apply({ start: true, manifest: CATALOG });
  const pixar = s.ours().filter((r) => r.name === 'lumen_pixar')[0];
  assert.ok(pixar && s.ours().filter((r) => r.name === 'lumen_nolan').length === 1);
  assert.equal(s.ours().length, 6, 'две подборки и четыре личных ряда');
  const fetched = [];
  s.LC.sources.fetch = (item, page, ok) => { fetched.push(ok); return { clear() {} }; };
  const got = [];
  pixar.call({}, 'main')((data) => got.push(data));
  fetched[0]({ results: [{ id: 1 }] });
  assert.equal(got[0].lumen_keep, true);
});

/* 1.2: детский режим (src/41_kids.js) и его точки в каталоге
   (src/42_manifest.js get/load, тег kids, validate).
   Решения пользователя 29.09: мультфильмы и семейное до PG плюс семейные
   блокбастеры («Гарри Поттер», «Звёздные войны», Marvel), DC — нет. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const K = load('41_kids.js');
const M = load('42_manifest.js');

function card(id, genres, extra) {
  return Object.assign({ id: id, title: 'c' + id, genre_ids: genres }, extra || {});
}

/* ---- Карточки ---------------------------------------------------------- */

test('kids: strict — нужен семейный (10751) или детский ТВ (10762), без стоп-жанров', () => {
  assert.equal(K.strict(card(1, [16, 10751, 35])), true, 'семейный мультфильм');
  assert.equal(K.strict(card(2, [16, 10762])), true, 'детский мультсериал');
  assert.equal(K.strict(card(3, [16, 35])), false, '«Южный парк»: анимация сама по себе не детская');
  assert.equal(K.strict(card(4, [12, 14])), false, '«Гарри Поттер» без семейного — не в чужом ряду');
  for (const stop of [27, 53, 10752, 10768]) {
    assert.equal(K.strict(card(5, [10751, stop])), false, 'стоп-жанр ' + stop + ' сильнее семейного');
  }
  assert.equal(K.strict(card(6, [])), false, 'карточка без жанров не проходит');
  assert.equal(K.strict({ id: 7 }), false, 'и без поля жанров тоже');
  assert.equal(K.strict(card(8, [10751], { adult: true })), false, 'adult');
  assert.equal(K.strict(null), false);
});

test('kids: криминал (80) — стоп, только если нет семейного жанра («Гадкий я» остаётся)', () => {
  /* Живая проверка 2026-09-30: у «Гадкого я» и «Плохих парней» жанр 80. */
  assert.equal(K.strict(card(1, [16, 35, 80, 878, 10751])), true);
  assert.equal(K.safe(card(2, [16, 12, 35, 80])), false, '«Люпен III»');
  assert.equal(K.safe(card(3, [80, 18, 10759])), false, '«Сорвиголова»');
});

test('kids: safe — подборке с тегом хватает отсутствия стоп-жанров (блокбастеры)', () => {
  assert.equal(K.safe(card(1, [12, 14])), true, '«Гарри Поттер»');
  assert.equal(K.safe(card(2, [12, 28, 878])), true, '«Звёздные войны»');
  assert.equal(K.safe(card(3, [16, 10751, 14, 27])), false, '«Коралина» — ужасы');
  assert.equal(K.safe(card(4, [12], { adult: true })), false);
});

test('kids: genresOf — genre_ids карточки или genres[] деталей tv/{id}', () => {
  assert.deepEqual(K.genresOf(card(1, [16, '10751'])), [16, 10751]);
  assert.deepEqual(K.genresOf({ genres: [{ id: 10762, name: 'Kids' }, { id: 16 }] }), [10762, 16]);
  assert.equal(K.strict({ id: 9, genres: [{ id: 10762 }, { id: 16 }] }), true, '«Новые серии»: детали сериала');
  assert.deepEqual(K.genresOf(null), []);
});

test('kids: cards и response — новый массив и копия ответа, вход не меняется', () => {
  const list = [card(1, [12, 14]), card(2, [10751]), card(3, [27])];
  assert.deepEqual(K.cards(list, false).map((c) => c.id), [2]);
  assert.deepEqual(K.cards(list, true).map((c) => c.id), [1, 2]);
  assert.equal(list.length, 3);
  const json = { results: list, page: 1, total_pages: 4 };
  const out = K.response(json, { id: 'harry-potter', kids: true });
  assert.notEqual(out, json);
  assert.deepEqual(out.results.map((c) => c.id), [1, 2]);
  assert.equal(out.total_pages, 4);
  assert.equal(json.results.length, 3, 'общий ответ fetch не тронут');
  assert.deepEqual(K.response(json, { id: 'col-10' }).results.map((c) => c.id), [2], 'франшиза из карточки — strict');
  assert.deepEqual(K.response(json, { id: 'x', kids: 'yes' }).results.map((c) => c.id), [2], 'тег — только true');
  assert.equal(K.response(null, {}), null);
});

/* ---- Ряды главной ------------------------------------------------------ */

test('kids: rows — чужие карточки уходят, пустой ряд тоже; свои (lumen_kids) не трогаются', () => {
  const twenty = [];
  for (let i = 0; i < 20; i++) twenty.push(card(100 + i, i < 3 ? [16, 10751] : [28, 53]));
  const lampa = { title: 'В тренде', results: twenty };
  const own = { title: 'Гарри Поттер', lumen_kids: true, results: [card(6, [12, 14])] };
  const cont = { title: 'Досмотреть', lumen_personal: true, lumen_own: true, results: [card(7, [10751]), card(8, [80, 18])] };
  const empty = { title: 'Ужасы', results: [card(9, [27])] };
  const odd = { title: 'без results' };
  const out = K.rows([lampa, own, cont, empty, odd, null]);
  assert.deepEqual(out.map((r) => r && r.title), ['В тренде', 'Гарри Поттер', 'Досмотреть', 'без results', null]);
  assert.deepEqual(out[0].results.map((c) => c.id), [100, 101, 102]);
  assert.equal(out[1], own, 'ряд подборки (lumen_kids) уже отфильтрован — не трогается');
  assert.deepEqual(out[2].results.map((c) => c.id), [7]);
  assert.equal(out[2].lumen_own, true, 'флаги ряда едут дальше (dedupeAcross)');
  assert.equal(lampa.results.length, 20, 'входной ряд не меняется');
  assert.deepEqual(K.rows(null), []);
});

test('kids: stubs — чужой ряд короче min уходит; свои, личные и выбранные вручную — нет', () => {
  const stub = { title: 'Мультфильм', results: [card(1, [16, 10751])] };
  const full = { title: 'Семейный', results: [card(2, [10751]), card(3, [10751]), card(4, [10751]), card(5, [10751])] };
  const own = { title: 'Шрек', lumen_kids: true, results: [card(6, [16, 10751])] };
  const soon = { title: 'Скоро', lumen_personal: true, results: [card(7, [10751])] };
  const kept = { title: 'Мой выбор', lumen_keep: true, results: [card(8, [10751])] };
  const out = K.stubs([stub, full, own, soon, kept, null], 4, false);
  assert.deepEqual(out.map((r) => r.title), ['Семейный', 'Шрек', 'Скоро', 'Мой выбор']);
  /* Вся пачка из огрызков: дальше по ленте — пусто, первая — как пришла. */
  assert.deepEqual(K.stubs([stub], 4, false), []);
  const first = [stub];
  assert.equal(K.stubs(first, 4, true), first, 'по пустой первой пачке Lampa строит пустой экран');
  assert.deepEqual(K.stubs(null, 4, true), []);
});

/* ---- Каталог ----------------------------------------------------------- */

function catalog() {
  return {
    version: 1,
    groups: [{ id: 'g', title: 'G' }],
    hubGroups: [{ id: 'h', title: 'H', groups: ['g'] }],
    moods: [{ id: 'friday', title: 'F', sources: {} }, { id: 'family', title: 'S', kids: true, sources: {} }],
    home: ['a', 'b', 'c'],
    ambient: [{ path: '/x.jpg' }],
    themes: [{ id: 't' }],
    collections: [
      { id: 'a', title: 'A', group: 'g', kids: true, sources: {} },
      { id: 'b', title: 'B', group: 'g', sources: {} },
      { id: 'c', title: 'C', group: 'g', kids: 'yes', sources: {} },
      { id: 'd', title: 'D', group: 'g', kids: true, sources: {} }
    ]
  };
}

test('kids: catalog — только kids: true, home — пересечение, ambient пуст, прочее как есть', () => {
  K.reset();
  const m = catalog();
  const k = K.catalog(m);
  assert.deepEqual(k.collections.map((c) => c.id), ['a', 'd']);
  assert.deepEqual(k.moods.map((c) => c.id), ['family']);
  assert.deepEqual(k.home, ['a']);
  assert.deepEqual(k.ambient, []);
  assert.equal(k.themes, m.themes);
  assert.equal(k.hubGroups, m.hubGroups);
  assert.equal(k.version, 1);
  assert.equal(m.collections.length, 4, 'исходный каталог не мутирует');
  assert.equal(m.ambient.length, 1);
  assert.equal(K.catalog(m), k, 'мемоизация по объекту');
  const other = catalog();
  assert.notEqual(K.catalog(other), k);
  assert.equal(K.catalog(m), k, 'два каталога помнятся оба (загруженный и встроенный)');
  K.reset();
  assert.notEqual(K.catalog(m), k, 'reset сбрасывает');
  assert.equal(K.catalog(null), null);
});

test('kids: enabled — только настоящий true из LC.pref, по умолчанию выключен', () => {
  const on = loadCtx('41_kids.js', { pref: (k, d) => (k === 'lumen_kids' ? true : d) }).api;
  assert.equal(on.enabled(), true);
  const off = loadCtx('41_kids.js', { pref: (k, d) => d }).api;
  assert.equal(off.enabled(), false);
  const bad = loadCtx('41_kids.js', { pref: () => { throw new Error('x'); } }).api;
  assert.equal(bad.enabled(), false);
  assert.equal(loadCtx('41_kids.js', {}).api.enabled(), false, 'без LC.pref — выключен');
});

/* ---- Встроенный каталог -------------------------------------------------- */

const KIDS_IDS = [
  /* мультфильмы и семейное */
  'shrek', 'toy-story', 'despicable-me', 'madagascar', 'ice-age', 'pixar', 'ghibli', 'dreamworks', 'illumination',
  'disney-animation', 'laika-aardman', 'soviet-cartoons', 'animation', 'family', 'kids-toons', 'toddlers',
  'family-toons', 'family-live', 'miyazaki',
  /* семейные блокбастеры (решение пользователя 29.09) */
  'harry-potter', 'star-wars', 'avengers', 'spiderman-mcu'
];

test('kids: встроенный каталог — тег ровно у согласованного списка, только true', () => {
  const tagged = M.DEFAULT.collections.filter((c) => c.kids === true).map((c) => c.id);
  assert.deepEqual(tagged.slice().sort(), KIDS_IDS.slice().sort());
  for (const c of M.DEFAULT.collections) {
    assert.ok(typeof c.kids === 'undefined' || c.kids === true, 'тег только true: ' + c.id);
  }
  /* Не детские: взрослая анимация и аниме, DC, R-рейтинг Marvel, ужасы. */
  for (const id of ['adult-animation', 'anime', 'anime-movies', 'dc-universe', 'dc-classic', 'dark-knight', 'mcu',
    'marvel', 'xmen', 'marvel-classic', 'christmas', 'xmas-comedy', 'horror-top', 'lotr']) {
    assert.equal(tagged.indexOf(id), -1, 'не детская: ' + id);
  }
  const moods = M.DEFAULT.moods.filter((m) => m.kids === true).map((m) => m.id);
  assert.deepEqual(moods, ['family']);
});

test('kids: validate — не boolean снимается у подборки и настроения, каталог принят', () => {
  for (const bad of ['yes', 1, null, {}]) {
    const m = catalog();
    m.collections[0].kids = bad;
    m.moods[1].kids = bad;
    delete m.hubGroups;
    m.moods.forEach((x) => { x.sources = { movie: { type: 'discover', params: {} } }; });
    m.collections.forEach((x) => { x.sources = { movie: { type: 'discover', params: {} } }; });
    delete m.themes;
    delete m.ambient;
    const r = M.validate(m);
    assert.equal(r.ok, true, JSON.stringify(bad) + ': ' + r.reason);
    assert.equal('kids' in m.collections[0], false);
    assert.equal('kids' in m.moods[1], false);
    assert.equal(m.collections.length, 4);
  }
});

/* ---- get / load / raw в детском режиме ----------------------------------- */

function withManifest(kidsOn, url, reply) {
  const prevLampa = globalThis.Lampa;
  const prevWin = globalThis.window;
  const store = {};
  globalThis.Lampa = {
    Storage: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } },
    Reguest: function () { return { silent: function (u, ok, err) { if (reply) reply(ok, err); } }; }
  };
  globalThis.window = { Lampa: globalThis.Lampa };
  try {
    const pref = (k, d) => (k === 'lumen_kids' ? kidsOn : k === 'lumen_manifest_url' ? url : d);
    const kids = loadCtx('41_kids.js', { pref }).api;
    const ctx = loadCtx('42_manifest.js', { pref, kids });
    let got = null;
    ctx.api.load((m) => { got = m; });
    return { got, api: ctx.api };
  } finally {
    globalThis.Lampa = prevLampa;
    globalThis.window = prevWin;
  }
}

test('kids: выключен — get/load отдают каталог как есть', () => {
  const r = withManifest(false, '');
  assert.equal(r.got, r.api.DEFAULT);
  assert.equal(r.api.get(), r.api.DEFAULT);
  assert.equal(r.api.raw(), r.api.DEFAULT);
});

test('kids: включён — get и load отдают детскую копию встроенного, raw — полный', () => {
  const r = withManifest(true, '');
  assert.notEqual(r.got, r.api.DEFAULT);
  assert.deepEqual(r.got.collections.map((c) => c.id).sort(), KIDS_IDS.slice().sort());
  assert.equal(r.api.get(), r.got, 'get — та же мемоизированная копия');
  assert.deepEqual(r.got.ambient, []);
  assert.deepEqual(r.got.moods.map((m) => m.id), ['family']);
  for (const id of r.got.home) assert.ok(KIDS_IDS.indexOf(id) !== -1, 'home: ' + id);
  assert.equal(r.api.raw(), r.api.DEFAULT);
  assert.equal(r.api.DEFAULT.collections.length > KIDS_IDS.length, true, 'встроенный не тронут');
});

test('kids: внешний каталог без тегов (до 1.2) — детская часть встроенного, а не пустая главная', () => {
  const ext = catalog();
  ext.collections.forEach((c) => { delete c.kids; c.sources = { movie: { type: 'discover', params: {} } }; });
  ext.moods.forEach((c) => { c.sources = { movie: { type: 'discover', params: {} } }; });
  delete ext.hubGroups;
  const r = withManifest(true, 'https://example.test/m.json', (ok) => ok(ext));
  assert.deepEqual(r.got.collections.map((c) => c.id).sort(), KIDS_IDS.slice().sort());
  assert.equal(r.api.raw(), ext, 'полный — внешний');
  /* С тегами — его собственная детская часть. */
  const tagged = catalog();
  tagged.collections.forEach((c) => { c.sources = { movie: { type: 'discover', params: {} } }; });
  tagged.moods.forEach((c) => { c.sources = { movie: { type: 'discover', params: {} } }; });
  delete tagged.hubGroups;
  const t = withManifest(true, 'https://example.test/m.json', (ok) => ok(tagged));
  assert.deepEqual(t.got.collections.map((c) => c.id), ['a', 'd']);
});

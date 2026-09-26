import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Решение пользователя 2026-09-26: подборки в штатном поиске Lampa.

   Источник поиска плагина (src/46_search.js) добавляется в поиск Lampa
   штатным Lampa.Search.addSource (app.min.js:41626-41628; вкладки источников
   — Sources, :41225-41300; строка результатов — Results.build, :41073-41126):
   запрос «марвел» находит «Киновселенная Marvel» и другие подборки по
   названиям ru/en/uk, id и синонимам из каталога (необязательное поле
   aliases), ищет по каталогу в памяти без единого запроса в сеть, а выбор
   открывает сетку подборки (LC.hub.open). */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

const CATALOG = (() => {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '42_manifest.js');
  return module.exports.DEFAULT;
})();

function fresh(opts) {
  opts = opts || {};
  const LC = {
    lang: opts.lang || ((k) => ({ lumen_search_source: 'Подборки' })[k] || k),
    langCode: () => opts.code || 'ru',
    manifest: { get: () => opts.manifest || CATALOG },
    hub: opts.hub
  };
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  LC.util = module.exports;
  loadInto(LC, module, '46_search.js');
  return { api: module.exports, LC };
}

test('skeleton: русская запись латинского названия и само название сходятся', () => {
  const S = fresh().api;
  for (const [ru, en] of [['марвел', 'Marvel'], ['пиксар', 'Pixar'], ['нетфликс', 'Netflix'], ['дисней', 'Disney'], ['лукасфильм', 'Lucasfilm']]) {
    assert.equal(S.skeleton(ru), S.skeleton(en), ru + ' / ' + en + ': ' + S.skeleton(ru) + ' ≠ ' + S.skeleton(en));
  }
  assert.equal(S.skeleton('Звёздные  войны!'), S.skeleton('звездные войны'), 'регистр, ё и знаки не мешают');
});

test('find: «марвел» — «Киновселенная Marvel» и «Marvel Studios»; по-английски и по-украински — тоже', () => {
  const S = fresh().api;
  const ids = (q, code) => S.find(CATALOG, q, code || 'ru').map((c) => c.id);
  assert.ok(ids('марвел').indexOf('mcu') !== -1, 'мсю нет: ' + ids('марвел'));
  assert.ok(ids('марвел').indexOf('marvel') !== -1);
  assert.ok(ids('Marvel').indexOf('mcu') !== -1);
  assert.ok(ids('cinematic universe').indexOf('mcu') !== -1, 'английское название');
  assert.ok(ids('кіновсесвіт').indexOf('mcu') !== -1, 'украинское название');
  assert.ok(ids('звёздные').indexOf('star-wars') !== -1, 'русское название');
  assert.deepEqual(ids('абырвалг'), []);
  assert.deepEqual(ids(''), []);
  /* Лучшее совпадение — выше: название, которое с запроса начинается,
     раньше того, где с запроса начинается слово внутри. */
  const studios = ids('studios');
  assert.ok(studios.length && studios.indexOf('marvel') !== -1, 'слово внутри названия: ' + studios);
  const S2 = fresh().api;
  const manifest = { collections: [
    { id: 'b', title: 'Лучшие мстители' },
    { id: 'a', title: 'Мстители: всё' }
  ] };
  assert.deepEqual(S2.find(manifest, 'мстители', 'ru').map((c) => c.id), ['a', 'b']);
});

test('find: синонимы из каталога (aliases) — тоже ключи поиска; мусор в них не ломает', () => {
  const S = fresh().api;
  const manifest = {
    version: 1, groups: [{ id: 'franchise', title: 'Франшизы' }], home: [],
    collections: [
      { id: 'mcu', title: 'Киновселенная Marvel', aliases: ['МКУ', 'Мстители', 42, null], group: 'franchise', sources: { movie: { type: 'discover', params: {} } } },
      { id: 'dune', title: 'Дюна', group: 'franchise', sources: { movie: { type: 'collection', id: 1 } } }
    ]
  };
  assert.deepEqual(S.find(manifest, 'мстит', 'ru').map((c) => c.id), ['mcu']);
  assert.deepEqual(S.find(manifest, 'мку', 'ru').map((c) => c.id), ['mcu']);
});

test('source: результаты — строка широких карточек подборок, без сети; заголовок вкладки экранирован', () => {
  const had = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('поиск по каталогу ходит в сеть'); };
  const requests = [];
  const Lampa = {
    Maker: { module: () => ({ only: (...names) => names.join('+') }) },
    Reguest: function () { requests.push('reguest'); },
    Api: { sources: { tmdb: { get: () => requests.push('tmdb') } } }
  };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  try {
    const { api } = fresh({ lang: (k) => (k === 'lumen_search_source' ? 'Подборки <b>' : k) });
    const src = api.source();
    assert.equal(src.title, 'Подборки &lt;b&gt;');
    let got = null;
    src.search({ query: encodeURIComponent('марвел') }, (rows) => { got = rows; });
    assert.ok(Array.isArray(got) && got.length === 1, 'одна строка результатов');
    const line = got[0];
    assert.ok(line.results.length >= 2);
    const mcu = line.results.filter((c) => c.lumen_id === 'mcu')[0];
    assert.ok(mcu, 'карточки «Киновселенная Marvel» нет');
    assert.equal(mcu.title, 'Киновселенная Marvel');
    assert.equal(mcu.params.style.name, 'wide');
    assert.equal(mcu.params.module, 'Card+Style+Callback', 'у карточки подборки нет меню закладок и отметок просмотра');
    assert.ok(mcu.overview, 'подпись карточки — группа каталога');
    const withCover = line.results.filter((c) => c.backdrop_path)[0];
    const noCover = line.results.filter((c) => !c.backdrop_path)[0];
    if (withCover) assert.ok(/^\/[A-Za-z0-9]+\.jpg$/.test(withCover.backdrop_path), 'кадр — путь TMDB из каталога');
    if (noCover) assert.ok(/^data:image\/svg\+xml/.test(noCover.img), 'без кадра — своя заглушка, а не битая картинка');
    assert.deepEqual(requests, [], 'поиск по каталогу ходит в сеть');
    let empty = null;
    src.search({ query: encodeURIComponent('абырвалг') }, (rows) => { empty = rows; });
    assert.deepEqual(empty, []);
    /* Битая строка запроса — пусто, без исключения. */
    let broken = null;
    src.search({ query: '%E0%A4%A' }, (rows) => { broken = rows; });
    assert.deepEqual(broken, []);
  } finally {
    globalThis.fetch = had;
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

test('source: выбор карточки закрывает поиск и открывает подборку каталога через LC.hub.open', () => {
  const opened = [];
  const order = [];
  const { api } = fresh({ hub: { open: (item) => { order.push('open'); opened.push(item); } } });
  const src = api.source();
  let rows = null;
  src.search({ query: encodeURIComponent('звёздные') }, (r) => { rows = r; });
  const card = rows[0].results.filter((c) => c.lumen_id === 'star-wars')[0];
  src.onSelect({ element: card, data: rows[0] }, () => order.push('close'));
  assert.deepEqual(order, ['close', 'open'], 'сначала закрыть поиск, потом открыть сетку');
  assert.equal(opened[0], CATALOG.collections.filter((c) => c.id === 'star-wars')[0], 'открыта подборка из каталога, а не копия из кэша поиска');
  /* Карточка из кэша поиска с id, которого в каталоге больше нет, — только закрыть. */
  src.onSelect({ element: { lumen_id: 'nope' } }, () => order.push('close'));
  assert.equal(opened.length, 1);
});

test('install/uninstall: источник в поиске Lampa один, снимается целиком', () => {
  const added = [];
  const removed = [];
  const Lampa = { Search: { addSource: (s) => added.push(s), removeSource: (s) => removed.push(s) } };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  try {
    const { api } = fresh();
    api.install();
    api.install();
    assert.equal(added.length, 1, 'источник добавлен дважды');
    api.uninstall();
    api.uninstall();
    assert.deepEqual(removed, [added[0]]);
    api.install();
    assert.equal(added.length, 2, 'после снятия ставится снова');
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

test('install: Lampa без поиска — тихо', () => {
  globalThis.window = { Lampa: {} };
  globalThis.Lampa = {};
  try {
    const { api } = fresh();
    assert.doesNotThrow(() => { api.install(); api.uninstall(); });
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

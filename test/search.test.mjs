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

/* Раунд C, C2 (e2e, E5): «зима» не находила «Зимнее кино» — подстрока не
   знает форм слова. Второй проход — по основам: первые 3 буквы слова
   запроса (4 — у слов от 6 букв) начинают слово ключа; каждая основа
   запроса — своё слово. Такое совпадение — после любого подстрокой. Каталог
   здесь свой, без синонимов: находит сам проход по основам. */
test('C2 find: формы слова — по основам: «зима» → «Зимнее кино», «лето» → «Летнее», «школа» → «Школьные годы»', () => {
  const S = fresh().api;
  const manifest = { collections: [
    { id: 'winter', title: 'Зимнее кино' },
    { id: 'summer', title: 'Летнее кино' },
    { id: 'school', title: 'Школьные годы' },
    { id: 'xmas', title: 'Рождественские комедии' },
    { id: 'lake', title: 'Озеро' }
  ] };
  const ids = (q) => S.find(manifest, q, 'ru').map((c) => c.id);
  assert.deepEqual(ids('зима'), ['winter']);
  assert.deepEqual(ids('лето'), ['summer']);
  assert.deepEqual(ids('школа'), ['school']);
  assert.deepEqual(ids('звезды'), [], 'в каталоге теста звёзд нет');
  const stars = { collections: [{ id: 'sw', title: 'Звездные войны' }, { id: 'det', title: 'Детективы' }] };
  assert.deepEqual(S.find(stars, 'звезды', 'ru').map((c) => c.id), ['sw'], 'длинное слово — основа из четырёх букв («звез»)');
  /* Ревью rv4, RV4-2: слово названия длиннее слова запроса больше чем на 3
     буквы — не форма того же слова: «дети» ≠ «Детективы», «рождество» ≠
     «Рождественские» (+5; в живом каталоге «рождество» — синоним). */
  assert.deepEqual(S.find(stars, 'дети', 'ru').map((c) => c.id), [], '«дети» не находит «Детективы»');
  assert.deepEqual(ids('рождество'), [], '+5 букв — не основа');
  assert.deepEqual(ids('и зима'), ['winter'], 'короткие слова в проходе по основам не участвуют');
  assert.deepEqual(ids('зимнее лето'), [], 'каждая основа запроса — своё слово того же ключа');
  assert.deepEqual(ids('зимородок'), [], 'основа длинного слова — четыре буквы: «зимо» не «зимн»');
  /* Совпадение подстрокой — выше совпадения по основе. */
  const both = { collections: [{ id: 'a', title: 'Зимнее кино' }, { id: 'b', title: 'Зима в горах' }] };
  assert.deepEqual(S.find(both, 'зима', 'ru').map((c) => c.id), ['b', 'a']);
});

/* Раунд C, C2: живой каталог — сезонные подборки находятся так, как их
   ищут: формы слова — по основам, «новый год» и «осень» — синонимами
   каталога (aliases, src/42_manifest.js; validate их пропускает). */
test('C2 find: живой каталог — «зима», «новый год», «хэллоуин», «лето», «осень», «космос», «школ…» находят сезонные подборки', () => {
  const S = fresh().api;
  const ids = (q) => S.find(CATALOG, q, 'ru').map((c) => c.id);
  const has = (q, id) => assert.ok(ids(q).indexOf(id) !== -1, q + ' → ' + id + ': ' + ids(q));
  has('зима', 'winter-movies');
  has('новый год', 'new-year');
  has('Новый год', 'new-year');
  has('хэллоуин', 'halloween');
  has('хеллоуин', 'halloween');
  has('лето', 'summer-movies');
  has('осень', 'halloween');
  has('осень', 'school-years');
  has('космос', 'space-race');
  has('школ', 'school-years');
  has('школа', 'school-years');
  has('рождество', 'christmas');
  has('день победы', 'war-may');
  /* Синонимы — только у сезонных подборок и проходят проверку каталога. */
  for (const c of CATALOG.collections) {
    if (!c.aliases) continue;
    assert.ok(c.season !== undefined, 'синонимы у несезонной подборки ' + c.id);
    for (const a of c.aliases) assert.ok(typeof a === 'string' && a.length && !/[<>]/.test(a), c.id + ': ' + a);
  }
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '42_manifest.js');
  assert.equal(module.exports.validate(JSON.parse(JSON.stringify(CATALOG))).ok, true, 'каталог с синонимами проходит validate');
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
});

/* Финальная проверка, L4: Lampa сутки показывает вчерашние результаты из
   кэша search_<вкладка>_last (app.min.js:40975-40990, 41020-41030) —
   карточка может вести на подборку, которой в каталоге уже нет. */
test('L4 source: выбор карточки с неизвестным lumen_id — уведомление, поиск открыт, сетка не открывается', () => {
  const opened = [];
  const Lampa = { Noty: { shown: [], show(t) { this.shown.push(t); } } };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  try {
    const { api } = fresh({
      lang: (k) => ({ lumen_search_gone: 'Подборка больше недоступна' })[k] || k,
      hub: { open: (item) => opened.push(item) }
    });
    let closed = 0;
    api.source().onSelect({ element: { id: 'lumen_venom', lumen_id: 'venom', title: 'Веном' } }, () => { closed++; });
    assert.equal(closed, 0, 'поиск не закрыт');
    assert.deepEqual(opened, []);
    assert.deepEqual(Lampa.Noty.shown, ['Подборка больше недоступна']);
    /* Без Noty (другая сборка Lampa) — тихо, без исключения. */
    delete Lampa.Noty;
    assert.doesNotThrow(() => api.source().onSelect({ element: { lumen_id: 'venom' } }, () => { closed++; }));
    assert.equal(closed, 0);
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
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

/* Ревью rv4, RV4-2: живой каталог — «дети» не находит «Детективы», формы
   слов по-прежнему находятся. */
test('RV4-2 find: живой каталог — «дети» без «Детективов», «зима»/«драма»/«война» — по основам', () => {
  const S = fresh().api;
  const ids = (q) => S.find(CATALOG, q, 'ru').map((c) => c.id);
  assert.equal(ids('дети').indexOf('whodunit'), -1, '«дети» → «Детективы»: ' + ids('дети'));
  assert.ok(ids('зима').indexOf('winter-movies') !== -1);
  assert.ok(ids('лето').indexOf('summer-movies') !== -1);
  assert.ok(ids('школа').indexOf('school-years') !== -1);
});

/* Прогон 2026-09-27 (Н4): «Рокки» находил ещё «Школьные годы» — по
   украинскому названию «Шкільні роки»: скелет схлопывает удвоенные буквы
   («рокки» = «роки»), а основа «рок» начинала «роки» и сама. Скелет и
   основы сравниваются только с ключами того же кириллического языка, что и
   запрос; прямая подстрока — со всеми, как было. Формы слова и синонимы
   сезонных подборок находятся по-прежнему. */
test('Н4 find: «Рокки» — только «Рокки»: скелет и основы — в пределах языка запроса', () => {
  const S = fresh().api;
  const ids = (q, code) => S.find(CATALOG, q, code || 'ru').map((c) => c.id);
  assert.deepEqual(ids('Рокки'), ['rocky'], '«Рокки»: ' + ids('Рокки'));
  assert.deepEqual(ids('рокки'), ['rocky']);
  const has = (q, id, code) => assert.ok(ids(q, code).indexOf(id) !== -1, q + ' → ' + id + ': ' + ids(q, code));
  has('зима', 'winter-movies');
  has('новый год', 'new-year');
  has('осень', 'halloween');
  has('осень', 'school-years');
  has('лето', 'summer-movies');
  has('рождество', 'christmas');
  has('школа', 'school-years');
  has('хеллоуин', 'halloween');
  has('марвел', 'mcu');
  /* Украинский запрос по украинскому названию — и основой, и подстрокой. */
  has('кіновсесвіт', 'mcu');
  has('шкільні', 'school-years');
  has('зимові', 'winter-movies', 'uk');
  /* Прямой текст сравнивается со всеми ключами: «роки» есть в
     украинском названии буквально. */
  has('роки', 'school-years');

  /* Свой каталог: без синонимов, находит сам проход по основам и скелету. */
  const manifest = { collections: [
    { id: 'rocky', title: 'Рокки' },
    { id: 'school', title: 'Школьные годы', i18n: { en: 'School Years', uk: 'Шкільні роки' } },
    { id: 'winter', title: 'Зимнее кино', i18n: { uk: 'Зимове кіно' } },
    { id: 'rocks', title: 'Скалы', i18n: { uk: 'Скелі' } }
  ] };
  const own = (q, code) => S.find(manifest, q, code || 'ru').map((c) => c.id);
  assert.deepEqual(own('рокки'), ['rocky'], 'основа «рок» и скелет «roki» не сводят русский запрос с украинским «роки»');
  assert.deepEqual(own('зима'), ['winter'], 'ключ без языковых меток — основа работает');
  assert.deepEqual(own('зимові', 'uk'), ['winter'], 'украинский запрос — основа по украинскому названию');
  assert.deepEqual(own('скелі'), ['rocks'], 'украинская форма в запросе — украинский ключ, подстрокой');
  assert.deepEqual(own('скеля', 'uk'), ['rocks'], 'украинский интерфейс, запрос без меток — основа по украинскому ключу');
  assert.deepEqual(own('скеля'), [], 'русский интерфейс, запрос без меток — украинский ключ основой не сравнивается');
});

/* Прогон 2026-09-27 (Н5): «Киновселенная Marvel» в поиске была тёмной
   панелью — cover в каталоге у неё нет, а поиск, в отличие от плитки хаба,
   кадра из самой подборки не брал. Теперь берёт тем же LC.sources.bannerPath
   (путь TMDB — backdrop_path карточки, адрес Кинопоиска — img), для первых
   COVER_AHEAD карточек без cover и не дольше COVER_WAIT; новый поиск и
   отмена прежний ответ глушат. */
function withSources(bannerPath, fn) {
  const { api, LC } = fresh();
  LC.sources = { bannerPath: bannerPath };
  return fn(api.source(), LC);
}

test('Н5 source: подборка без cover — кадр подборки, как у плитки хаба; с cover — без запроса', () => {
  const asked = [];
  withSources((item, ok) => { asked.push(item.id); ok(item.id === 'mcu' ? '/mcuFrame1.jpg' : ''); return { clear() {} }; }, (src) => {
    let rows = null;
    src.search({ query: encodeURIComponent('марвел') }, (r) => { rows = r; });
    assert.ok(rows, 'ответ не отдан');
    const byId = {};
    for (const c of rows[0].results) byId[c.lumen_id] = c;
    assert.equal(byId.mcu.backdrop_path, '/mcuFrame1.jpg', '«Киновселенная Marvel» без кадра');
    assert.equal(byId.mcu.img, undefined, 'у карточки с кадром осталась заглушка');
    const covered = CATALOG.collections.filter((c) => c.cover).map((c) => c.id);
    for (const id of asked) assert.equal(covered.indexOf(id), -1, 'кадр запрошен у подборки с cover: ' + id);
    assert.ok(asked.indexOf('mcu') !== -1);
    assert.equal(byId['marvel-classic'].backdrop_path, CATALOG.collections.filter((c) => c.id === 'marvel-classic')[0].cover);
  });
  /* Кинопоиск отдаёт готовый адрес постера; пусто и ошибка — заглушка. */
  const manifest = { collections: [
    { id: 'kp', title: 'Топ КП', sources: { movie: { type: 'kp' } } },
    { id: 'none', title: 'Топ пусто', sources: { movie: { type: 'discover', params: {} } } },
    { id: 'bad', title: 'Топ сбой', sources: { movie: { type: 'discover', params: {} } } },
    { id: 'evil', title: 'Топ чужой', sources: { movie: { type: 'discover', params: {} } } }
  ] };
  const { api, LC } = fresh({ manifest: manifest });
  LC.sources = { bannerPath: (item, ok, err) => {
    if (item.id === 'kp') ok('https://kinopoiskapiunofficial.tech/images/posters/kp_small/1.jpg');
    else if (item.id === 'none') ok('');
    else if (item.id === 'evil') ok('//evil.example/x.jpg');
    else err({ failed: true });
  } };
  let rows = null;
  api.source().search({ query: encodeURIComponent('топ') }, (r) => { rows = r; });
  const by = {};
  for (const c of rows[0].results) by[c.lumen_id] = c;
  assert.equal(by.kp.img, 'https://kinopoiskapiunofficial.tech/images/posters/kp_small/1.jpg');
  assert.equal(by.kp.backdrop_path, undefined);
  for (const id of ['none', 'bad', 'evil']) {
    assert.ok(/^data:image\/svg\+xml/.test(by[id].img), id + ': без кадра — заглушка');
    assert.equal(by[id].backdrop_path, undefined, id);
  }
});

test('Н5 source: кадров не больше COVER_AHEAD, ждём не дольше COVER_WAIT, поздний кадр карточку не меняет', () => {
  const manifest = { collections: [] };
  for (let i = 0; i < 12; i++) manifest.collections.push({ id: 'c' + i, title: 'Кино ' + i, sources: { movie: { type: 'discover', params: {} } } });
  const pending = [];
  const timers = [];
  const hadSet = globalThis.setTimeout;
  const hadClear = globalThis.clearTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; };
  globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].live = false; };
  try {
    const { api, LC } = fresh({ manifest: manifest });
    LC.sources = { bannerPath: (item, ok, err, alive) => { pending.push({ item, ok, alive }); } };
    let rows = null;
    let calls = 0;
    api.source().search({ query: encodeURIComponent('кино') }, (r) => { rows = r; calls++; });
    assert.equal(pending.length, 8, 'кадров запрошено ' + pending.length + ' — больше окна');
    assert.deepEqual(pending.map((p) => p.item.id), ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7'], 'кадры — первым карточкам строки');
    assert.equal(rows, null, 'ответ отдан до кадров');
    pending[0].ok('/early.jpg');
    assert.equal(rows, null);
    const wait = timers.filter((t) => t.live);
    assert.equal(wait.length, 1);
    assert.ok(wait[0].ms > 0 && wait[0].ms <= 1500, 'ожидание кадров ' + wait[0].ms + ' мс');
    wait[0].fn();
    assert.equal(calls, 1, 'по истечении ожидания ответ отдан');
    assert.equal(rows[0].results.length, 12);
    assert.equal(rows[0].results[0].backdrop_path, '/early.jpg');
    assert.ok(/^data:image\/svg\+xml/.test(rows[0].results[1].img), 'не успел — заглушка');
    assert.notEqual(pending[1].alive(), 0, 'после ответа запросы кадров не считаются живыми');
    pending[1].ok('/late.jpg');
    assert.equal(rows[0].results[1].backdrop_path, undefined, 'поздний кадр поменял уже отданную карточку');
    assert.equal(calls, 1);
  } finally {
    globalThis.setTimeout = hadSet;
    globalThis.clearTimeout = hadClear;
  }
});

test('Н5 source: новый поиск и отмена глушат прежний ответ', () => {
  const pending = [];
  const { api, LC } = fresh();
  LC.sources = { bannerPath: (item, ok) => { pending.push({ id: item.id, ok }); } };
  const src = api.source();
  const got = [];
  src.search({ query: encodeURIComponent('марвел') }, (r) => got.push(['марвел', r]));
  const first = pending.length;
  assert.ok(first > 0);
  src.search({ query: encodeURIComponent('мстители') }, (r) => got.push(['мстители', r]));
  for (const p of pending) p.ok('/f.jpg');
  assert.deepEqual(got.map((g) => g[0]), ['мстители'], 'отдан ответ устаревшего запроса');
  pending.length = 0;
  src.search({ query: encodeURIComponent('марвел') }, (r) => got.push(['марвел2', r]));
  src.onCancel();
  for (const p of pending) p.ok('/f.jpg');
  assert.deepEqual(got.map((g) => g[0]), ['мстители'], 'после отмены ответ отдан');
});

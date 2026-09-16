import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';
import { FakeEl, fakeQuery } from './_fakedom.mjs';

/* Task 9: русские отзывы Кинопоиска (экраны 07/08/13).

   Чистая часть модуля src/60_reviews.js (normalize/cacheKey/isFresh) грузится
   обычным test/_load.mjs. Кэш, загрузка и рендер трогают Lampa.Storage,
   Lampa.Reguest, $ и LC.pref/LC.lang — для них поднимается свежий LC
   склейкой 10_util + 80_settings + 60_reviews в ОДНУ область видимости (как в
   test/header.test.mjs): PLUGIN и warn объявлены в 00_head.js и в отдельный
   модуль не попадают, поэтому подменяются глобалами. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push(msg + (err ? ': ' + (err && err.message) : '')); };

const r = load('60_reviews.js');

/* ====================================================================== */
/* Step 1: чистая нормализация ответа.                                    */
/* ====================================================================== */

test('normalize: обрезка, тип, дата, html-эскейп', () => {
  const out = r.normalize({ items: [{ type: 'POSITIVE', date: '2024-03-02T10:00:00', author: 'Иван', title: 'Шедевр <b>', description: 'Очень ' + 'длинный '.repeat(200), positiveRating: 12, negativeRating: 3 }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].tone, 'good'); assert.equal(out[0].date, '02.03.2024'); assert.equal(out[0].title, 'Шедевр &lt;b&gt;');
  assert.ok(out[0].excerpt.length <= 320); assert.equal(out[0].likes, 12);
});

test('normalize: NEGATIVE→bad, NEUTRAL→mid, без title → первые слова', () => {
  const out = r.normalize({ items: [{ type: 'NEGATIVE', description: 'Скучно и долго. Очень.' }, { type: 'NEUTRAL', description: 'x' }] });
  assert.equal(out[0].tone, 'bad'); assert.equal(out[0].title, 'Скучно и долго.'); assert.equal(out[1].tone, 'mid');
});

test('cache key и TTL', () => {
  assert.equal(r.cacheKey('tt1'), 'lumen_rv_tt1');
  assert.equal(r.isFresh({ at: Date.now() - 1000 }), true);
  assert.equal(r.isFresh({ at: Date.now() - 25 * 3600 * 1000 }), false);
});

/* Поправка контроллера: full не длиннее 4000 символов — иначе кэш нескольких
   фильмов переполняет localStorage на ТВ. Режем ИСХОДНЫЙ текст, потом
   экранируем: обратный порядок рвал бы html-сущность пополам (&amp; -> &am). */
test('normalize: full обрезается до 4000 символов, excerpt — до 300 с многоточием', () => {
  const long = 'а'.repeat(9000);
  const out = r.normalize({ items: [{ type: 'POSITIVE', description: long }] });
  assert.equal(out[0].full.length, 4000, 'ожидался предел 4000 символов (3999 + многоточие)');
  assert.equal(out[0].full.charAt(3999), '…');
  assert.equal(out[0].excerpt.length, 300);
  assert.equal(out[0].excerpt.charAt(299), '…');

  const short = r.normalize({ items: [{ description: 'Коротко.' }] })[0];
  assert.equal(short.full, 'Коротко.', 'короткий текст не трогаем');
  assert.equal(short.excerpt, 'Коротко.');
});

test('normalize: экранируется весь пользовательский текст, инициалы и «Аноним»', () => {
  const out = r.normalize({ items: [{ author: 'Иван Петров', title: 'A & B', description: '<script>alert(1)</script> текст' }] });
  assert.equal(out[0].author, 'Иван Петров');
  assert.equal(out[0].initials, 'ИП');
  assert.equal(out[0].title, 'A &amp; B');
  assert.equal(out[0].excerpt.indexOf('<script>'), -1, 'тег из отзыва не должен остаться разметкой');
  assert.ok(out[0].excerpt.indexOf('&lt;script&gt;') !== -1);
  assert.equal(out[0].full.indexOf('<script>'), -1);

  const anon = r.normalize({ items: [{ description: 'текст' }] })[0];
  assert.equal(anon.author, 'Аноним');
  assert.equal(anon.initials, 'А');
  assert.equal(anon.tone, 'mid', 'без type — нейтральный');
});

test('normalize: мусор на входе -> [] без исключений', () => {
  assert.deepEqual(r.normalize(null), []);
  assert.deepEqual(r.normalize({}), []);
  assert.deepEqual(r.normalize({ items: [] }), []);
  assert.deepEqual(r.normalize({ items: [null] }), []);
  assert.deepEqual(r.normalize('nope'), []);
});

test('normalize: отзыв без текста пропускается (показывать нечего)', () => {
  const out = r.normalize({ items: [{ type: 'POSITIVE', author: 'Х', description: '   ' }, { description: 'есть текст' }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].excerpt, 'есть текст');
});

/* ====================================================================== */
/* Рантайм: кэш, загрузка, рендер.                                        */
/* ====================================================================== */

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* Мини-$ как в test/header.test.mjs: HTML-строка -> FakeEl, FakeEl -> он же. */
function $(x) {
  if (x instanceof FakeEl) return x;
  if (typeof x === 'string' && x.charAt(0) === '<') return fakeQuery(x);
  return { length: 0, each() { return this; }, find() { return { length: 0 }; } };
}

/* Фейковый Lampa.Reguest: журнал вызовов silent + заданные таймауты. */
function makeNetwork(journal) {
  function Reguest() { journal.instances++; }
  Reguest.prototype.timeout = function (ms) { journal.timeouts.push(ms); };
  Reguest.prototype.silent = function (url, ok, err, post, params) {
    journal.calls.push({ url: url, ok: ok, err: err, post: post, params: params });
  };
  return Reguest;
}

function freshEnv(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const store = Object.assign({ language: 'ru' }, opts.store || {});
  const journal = { calls: [], timeouts: [], instances: 0 };
  const collected = [];
  const modals = [];
  const toggled = [];
  const refocused = [];
  const Lampa = {
    Storage: {
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) && store[name] !== '' ? store[name] : def),
      set: (name, value) => { store[name] = value; },
      field: (name) => store[name]
    },
    Reguest: makeNetwork(journal),
    Controller: {
      enabled: () => ({ name: opts.controller || 'full_descr' }),
      collectionAppend: (nodes) => { collected.push(nodes); },
      collectionFocus: (node, root) => { refocused.push({ node, root }); },
      toggle: (name) => { toggled.push(name); }
    },
    Modal: {
      open: (params) => { modals.push(params); },
      close: () => { modals.push('close'); }
    },
    Platform: { is: () => false, screen: () => true }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.Lampa = Lampa;
  globalThis.$ = $;

  const LC = {};
  const module = { exports: null, lumen: false };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '60_reviews.js');
  return { LC, store, journal, collected, modals, toggled, refocused, Lampa };
}

/* Ряд описания Lampa: items-line -> .items-line__body -> .full-descr ->
   .full-descr__left. Таблица «ПОДРОБНО» (Task 5d) — уже сосед в .full-descr,
   блок отзывов встаёт рядом с ней, её не трогая. */
function makeDescrRow(withFacts) {
  const text = new FakeEl(['full-descr__text', 'selector']);
  const left = new FakeEl(['full-descr__left'], [text]);
  const kids = [left];
  if (withFacts !== false) kids.push(new FakeEl(['lumen-facts']));
  const descr = new FakeEl(['full-descr'], kids);
  const body = new FakeEl(['items-line__body'], [descr]);
  const row = new FakeEl(['items-line'], [body]);
  return { row, descr, left };
}

function blocksOf(d) { return d.descr._children.filter((n) => n.hasClass('lumen-reviews')); }

const DUNE = { movie: { id: 693134, title: 'Дюна: Часть вторая', imdb_id: 'tt15239678' } };

/* Живой ответ kinopoiskapiunofficial.tech (docs/research/API_NOTES_2.md §4). */
const SEARCH_OK = { total: 1, items: [{ kinopoiskId: 301, imdbId: 'tt15239678', nameRu: 'Дюна: Часть вторая' }] };
const REVIEWS_OK = {
  total: 318,
  totalPositiveReviews: 220, totalNegativeReviews: 60, totalNeutralReviews: 38,
  items: [
    { kinopoiskId: 301, type: 'POSITIVE', date: '2024-03-02T10:30:00', positiveRating: 12, negativeRating: 3, author: 'Иван Петров', title: 'Шедевр', description: 'Фильм делает то, чего не сделал первый.' },
    { kinopoiskId: 302, type: 'NEUTRAL', date: '2024-03-05T09:00:00', positiveRating: 4, negativeRating: 1, author: 'Мария Кузнецова', title: 'Красиво, но холодно', description: 'Визуально это шедевр, но эмоционально держит на расстоянии.' },
    { kinopoiskId: 303, type: 'NEGATIVE', date: '2024-03-09T21:00:00', positiveRating: 7, negativeRating: 9, author: 'Алексей Дёмин', title: 'Три часа ожидания', description: 'Сюжет топчется на месте.' }
  ]
};

/* ---------------------------- кэш ---------------------------- */

test('кэш: запись кладёт фильм и согласованный индекс, чтение отдаёт свежую запись', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 7, 1000);
  assert.deepEqual(env.store.lumen_rv_index, [{ id: 'tt1', at: 1000 }]);
  /* kp — id Кинопоиска, найденный по imdbId: лежит рядом с отзывами, чтобы
     рейтинг КП (Task 10) не искал фильм второй раз. Прямая запись без поиска
     оставляет его нулём. */
  assert.deepEqual(env.store.lumen_rv_tt1, { at: 1000, kp: 0, list: [{ title: 'a' }], total: 7 });

  const rec = env.LC.reviews.cacheRead('tt1', 1000 + 60000);
  assert.equal(rec.total, 7);
  assert.equal(env.LC.reviews.cacheRead('tt1', 1000 + 25 * 3600 * 1000), null, 'протухшая запись не отдаётся');
  assert.equal(env.LC.reviews.cacheRead('tt404', 1000), null);
  assert.deepEqual(warnLog, []);
});

test('кэш: 21-й фильм вытесняет самый старый по at, индекс остаётся согласован', () => {
  const env = freshEnv();
  for (let i = 1; i <= 20; i++) env.LC.reviews.cacheWrite('tt' + i, [{ title: 'i' + i }], i, 1000 + i);
  assert.equal(env.store.lumen_rv_index.length, 20);

  env.LC.reviews.cacheWrite('tt21', [{ title: 'i21' }], 21, 9999);
  const index = env.store.lumen_rv_index;
  assert.equal(index.length, 20, 'больше 20 фильмов в кэше не держим');
  assert.equal(index.filter((it) => it.id === 'tt1').length, 0, 'самый старый по at вытеснен');
  assert.equal(index.filter((it) => it.id === 'tt21').length, 1);
  assert.equal(env.LC.reviews.cacheRead('tt1', 9999), null, 'запись вытесненного фильма стёрта');
  assert.equal(env.LC.reviews.cacheRead('tt2', 9999).total, 2, 'соседи не пострадали');
  assert.deepEqual(warnLog, []);
});

test('кэш: повторная запись того же фильма не плодит строк в индексе', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('tt1', [], 1, 1000);
  env.LC.reviews.cacheWrite('tt1', [], 2, 2000);
  assert.deepEqual(env.store.lumen_rv_index, [{ id: 'tt1', at: 2000 }]);
  assert.equal(env.LC.reviews.cacheRead('tt1', 2000).total, 2);
});

/* ---------------------------- load ---------------------------- */

test('load: без ключа — колбэк «нет ключа», сеть не трогаем', () => {
  const env = freshEnv();
  const got = [];
  env.LC.reviews.load('tt15239678', '', (res) => got.push(res));
  assert.deepEqual(got, [{ nokey: true }]);
  assert.equal(env.journal.calls.length, 0);
  assert.equal(env.journal.instances, 0, 'без ключа экземпляр Reguest не создаём');
});

test('load: без imdb id — null, сеть не трогаем', () => {
  const env = freshEnv();
  const got = [];
  env.LC.reviews.load('', 'KEY', (res) => got.push(res));
  assert.deepEqual(got, [null]);
  assert.equal(env.journal.calls.length, 0);
});

test('load: поиск по imdbId, затем отзывы; заголовок X-API-KEY, таймаут, запись в кэш', () => {
  const env = freshEnv();
  const got = [];
  env.LC.reviews.load('tt15239678', 'KEY', (res) => got.push(res));

  assert.equal(env.journal.calls.length, 1);
  const first = env.journal.calls[0];
  assert.equal(first.url, 'https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=tt15239678');
  assert.equal(first.params.headers['X-API-KEY'], 'KEY');
  assert.equal(first.params.dataType, 'json');
  assert.equal(first.post, false, 'пятый аргумент params, четвёртый — post_data (API_NOTES_2 §3)');
  assert.ok(env.journal.timeouts.length >= 1 && env.journal.timeouts[0] === 8000, 'таймаут ставится перед запросом (сбрасывается Lampa после каждого)');

  first.ok(SEARCH_OK);
  assert.equal(env.journal.calls.length, 2);
  const second = env.journal.calls[1];
  assert.equal(second.url, 'https://kinopoiskapiunofficial.tech/api/v2.2/films/301/reviews?page=1&order=USER_POSITIVE_RATING_DESC');
  assert.equal(second.params.headers['X-API-KEY'], 'KEY');
  assert.equal(env.journal.timeouts.length, 2, 'таймаут ставится и перед вторым запросом');

  second.ok(REVIEWS_OK);
  assert.equal(got.length, 1);
  assert.equal(got[0].total, 318);
  assert.equal(got[0].list.length, 3);
  assert.equal(got[0].list[0].tone, 'good');

  const cached = env.store.lumen_rv_tt15239678;
  assert.equal(cached.total, 318);
  assert.equal(cached.list.length, 3);
  assert.equal(cached.kp, 301, 'id Кинопоиска кладём рядом — пригодится рейтингу КП');
  assert.deepEqual(warnLog, []);
});

test('load: свежий кэш отдаётся без единого запроса', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('tt1', [{ title: 'из кэша' }], 5);
  const got = [];
  env.LC.reviews.load('tt1', 'KEY', (res) => got.push(res));
  assert.equal(env.journal.calls.length, 0);
  assert.equal(got[0].total, 5);
  assert.equal(got[0].list[0].title, 'из кэша');
});

test('load: ошибка сети на любом шаге и пустой поиск -> null, без повторов', () => {
  const failSearch = freshEnv();
  const a = [];
  failSearch.LC.reviews.load('tt1', 'KEY', (res) => a.push(res));
  failSearch.journal.calls[0].err({ status: 502 });
  assert.deepEqual(a, [null]);
  assert.equal(failSearch.journal.calls.length, 1, 'повторов в цикле нет');

  const empty = freshEnv();
  const b = [];
  empty.LC.reviews.load('tt1', 'KEY', (res) => b.push(res));
  empty.journal.calls[0].ok({ total: 0, items: [] });
  assert.deepEqual(b, [null]);
  assert.equal(empty.journal.calls.length, 1, 'нечего искать — второго запроса нет');

  const failReviews = freshEnv();
  const c = [];
  failReviews.LC.reviews.load('tt1', 'KEY', (res) => c.push(res));
  failReviews.journal.calls[0].ok(SEARCH_OK);
  failReviews.journal.calls[1].err({ status: 401 });
  assert.deepEqual(c, [null]);
  assert.equal(failReviews.store.lumen_rv_tt1, undefined, 'неудачу не кэшируем');
  assert.deepEqual(warnLog, []);
});

test('load: с ключом, но без отзывов -> null (блок скрыт, экран 13 панель 1)', () => {
  const env = freshEnv();
  const got = [];
  env.LC.reviews.load('tt1', 'KEY', (res) => got.push(res));
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok({ total: 0, items: [] });
  assert.deepEqual(got, [null]);
});

/* ---------------------------- рендер ---------------------------- */

test('render: блок отзывов — сосед .lumen-facts в теле ряда, заголовок со склонением total', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);

  const blocks = blocksOf(d);
  assert.equal(blocks.length, 1, 'ровно один блок в .full-descr');
  assert.equal(d.descr._children.filter((n) => n.hasClass('lumen-facts')).length, 1, 'таблица «ПОДРОБНО» на месте');
  assert.ok(d.row.hasClass('lumen-descr-row'), 'корень ряда помечен — иначе CSS не применится');

  const html = blocks[0].html();
  assert.ok(html.indexOf('КИНОПОИСК') !== -1, 'источник в заголовке');
  assert.ok(html.indexOf('318 отзывов') !== -1, 'число отзывов из total со склонением');
  assert.ok(html.indexOf('Иван Петров') !== -1 && html.indexOf('Шедевр') !== -1);
  assert.ok(html.indexOf('02.03.2024') !== -1);
  assert.ok(html.indexOf('ПОЗИТИВНЫЙ') !== -1 && html.indexOf('НЕЙТРАЛЬНЫЙ') !== -1 && html.indexOf('НЕГАТИВНЫЙ') !== -1);
  assert.ok(html.indexOf('12 полезно') !== -1);
  assert.ok(html.indexOf('lumen-review--good') !== -1 && html.indexOf('lumen-review--bad') !== -1);
  assert.ok(html.indexOf('lumen-review selector') !== -1, 'карточка отзыва — .selector (навигация пультом)');
  assert.ok(d.row.hasClass('lumen-descr-row--reviews'), 'с рядом отзывов описание поджимается (иначе карточки уходят за нижний край)');
  assert.deepEqual(warnLog, []);
});

test('render: склонение «отзыв/отзыва/отзывов» по total', () => {
  const cases = [[1, '1 отзыв'], [2, '2 отзыва'], [5, '5 отзывов'], [21, '21 отзыв'], [112, '112 отзывов']];
  for (const [total, expected] of cases) {
    const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
    const d = makeDescrRow();
    env.LC.reviews.render(d.row, DUNE);
    env.journal.calls[0].ok(SEARCH_OK);
    env.journal.calls[1].ok({ total: total, items: REVIEWS_OK.items });
    assert.ok(blocksOf(d)[0].html().indexOf(expected) !== -1, 'ожидалось «' + expected + '»');
  }
});

test('render: повторный build/complite не дублирует блок и не шлёт второй запрос', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  const first = blocksOf(d)[0];

  env.LC.reviews.render(d.row, DUNE);
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(blocksOf(d).length, 1);
  assert.equal(blocksOf(d)[0], first, 'узел тот же — повторная сборка пропущена по подписи');
  assert.equal(env.journal.calls.length, 2, 'повторный рендер не ходит в сеть (данные уже в кэше/на экране)');
});

test('render: без ключа — подсказка экрана 13, сети нет', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);

  assert.equal(env.journal.calls.length, 0);
  const html = blocksOf(d)[0].html();
  assert.ok(html.indexOf('lumen-reviews__hint') !== -1, 'ожидался блок-подсказка');
  assert.ok(html.indexOf('Настройки → Lumen Card → Ключ Kinopoisk API') !== -1);
  assert.equal(html.indexOf('lumen-review selector'), -1, 'в подсказке нечего фокусировать');
  assert.equal(d.row.hasClass('lumen-descr-row--reviews'), false, 'подсказка низкая — описание поджимать незачем');
});

test('render: с ключом и без отзывов — блок снят целиком', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok({ total: 0, items: [] });
  assert.equal(blocksOf(d).length, 0);
});

test('render: нет imdb id — блок не появляется, сети нет; external_ids тоже читается', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, { movie: { id: 1, title: 'Без id' } });
  assert.equal(blocksOf(d).length, 0);
  assert.equal(env.journal.calls.length, 0);

  const d2 = makeDescrRow();
  env.LC.reviews.render(d2.row, { movie: { id: 2, external_ids: { imdb_id: 'tt777' } } });
  assert.equal(env.journal.calls.length, 1);
  assert.ok(env.journal.calls[0].url.indexOf('tt777') !== -1);
});

test('render: выключенная настройка lumen_reviews снимает блок и не грузит ничего', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(blocksOf(d).length, 1);

  env.store.lumen_reviews = 'false';
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(blocksOf(d).length, 0, 'блок снят на лету');
  assert.equal(env.journal.calls.length, 2, 'новых запросов нет');
});

/* Generation guard (как lumenGen в src/50_backdrops.js): карточку закрыли или
   открыли другую — ответ, пришедший позже, не должен ничего рисовать. */
test('render: ответ, пришедший после смены карточки, не рендерится', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  const stale = env.journal.calls[0];

  env.LC.reviews.render(d.row, { movie: { id: 2, imdb_id: 'tt777' } });
  const fresh = env.journal.calls[1];

  stale.ok(SEARCH_OK);
  assert.equal(env.journal.calls.length, 2, 'устаревшая цепочка оборвана на первом же ответе');

  fresh.ok({ items: [{ kinopoiskId: 777 }] });
  env.journal.calls[2].ok(REVIEWS_OK);
  assert.equal(blocksOf(d).length, 1, 'нарисован ровно один блок — от актуальной карточки');
  assert.deepEqual(warnLog, []);
});

test('render: новые .selector отдаются контроллеру, только когда активен full_descr', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(env.collected.length, 1, 'full_descr активен — коллекция дополняется');

  const other = freshEnv({ store: { lumen_kp_key: 'KEY' }, controller: 'full_start' });
  const d2 = makeDescrRow();
  other.LC.reviews.render(d2.row, DUNE);
  other.journal.calls[0].ok(SEARCH_OK);
  other.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(other.collected.length, 0, 'фокус на кнопках — контроллер соберёт .selector сам при входе в ряд');
});

test('render: чужая разметка ряда и пустые аргументы — тихо, без warn', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const alien = new FakeEl(['items-line'], [new FakeEl(['items-line__body'])]);
  env.LC.reviews.render(alien, DUNE);
  env.LC.reviews.render(null, DUNE);
  env.LC.reviews.render(makeDescrRow().row, null);
  assert.deepEqual(warnLog, []);
});

/* ---------------------------- модал (экран 08) ---------------------------- */

test('modal: открывается с текстом отзыва, «назад» возвращает контроллер, снятый ПЕРЕД открытием', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' }, controller: 'full_descr' });
  const item = env.LC.reviews.normalize(REVIEWS_OK)[0];
  env.LC.reviews.openModal(item);

  assert.equal(env.modals.length, 1);
  const params = env.modals[0];
  assert.equal(params.size, 'medium');
  const html = params.html.html();
  assert.ok(html.indexOf('lumen-review-modal') !== -1 || params.html.hasClass('lumen-review-modal'), 'свой класс модала (маркер lumen-modal путь TorrServer нам не ставит)');
  assert.ok(html.indexOf('Фильм делает то') !== -1, 'полный текст отзыва');
  assert.ok(html.indexOf('Иван Петров') !== -1 && html.indexOf('02.03.2024') !== -1);

  params.onBack();
  assert.equal(env.modals[1], 'close');
  assert.deepEqual(env.toggled, ['full_descr'], 'возврат на имя, снятое перед открытием, а не на «content»');
  assert.deepEqual(warnLog, []);
});

/* Живая проверка показала: одного Controller.toggle мало — Lampa пересобирает
   коллекцию ряда описания и ставит фокус на свой последний .selector (теги
   жанров), а не на карточку, с которой открыли окно. */
test('modal: «назад» возвращает фокус на ту же карточку, а не на штатный .selector ряда', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const item = env.LC.reviews.normalize(REVIEWS_OK)[0];

  const card = new FakeEl(['lumen-review', 'selector', 'focus']);
  const descr = new FakeEl(['full-descr'], [card]);
  const body = new FakeEl(['items-line__body'], [descr]);
  const line = new FakeEl(['items-line'], [body]);

  env.LC.reviews.openModal(item, card);
  env.modals[0].onBack();

  assert.deepEqual(env.toggled, ['full_descr']);
  assert.equal(env.refocused.length, 1, 'фокус возвращается явно');
  assert.equal(env.refocused[0].node, card, 'на ту самую карточку');
  assert.equal(env.refocused[0].root, line, 'корень коллекции — узел ряда описания');
  assert.deepEqual(warnLog, []);
});

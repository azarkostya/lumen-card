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

/* Фейковый Lampa.Reguest: журнал вызовов silent, таймауты и сами экземпляры —
   по ним видно, сняла ли смена карточки прошлый запрос (ревью, Important 6). */
function makeNetwork(journal) {
  function Reguest() { journal.instances++; this.cleared = 0; journal.nets.push(this); }
  Reguest.prototype.timeout = function (ms) { journal.timeouts.push(ms); };
  Reguest.prototype.silent = function (url, ok, err, post, params) {
    journal.calls.push({ url: url, ok: ok, err: err, post: post, params: params });
  };
  Reguest.prototype.clear = function () { this.cleared++; };
  return Reguest;
}

function freshEnv(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const store = Object.assign({ language: 'ru' }, opts.store || {});
  /* ls — «сырое» хранилище, как localStorage: именно по нему видно, освободила
     ли уборка кэша место. store остаётся зеркалом того, что отдаёт
     Lampa.Storage.get (пустая строка для него — «значения нет»). */
  const ls = {};
  Object.keys(store).forEach((k) => { ls[k] = store[k]; });
  const journal = { calls: [], timeouts: [], instances: 0, nets: [] };
  const collected = [];
  const modals = [];
  const toggled = [];
  const refocused = [];
  const removeCalls = [];
  const setOrder = [];
  const nolistenFlags = [];
  function films() { return Object.keys(ls).filter((k) => k.indexOf('lumen_rv_') === 0 && k !== 'lumen_rv_index'); }
  /* Режим отказа записи. Настоящая Lampa при переполнении квоты кладёт
     значение в память (readed) и в reserve/IndexedDB, но в localStorage его
     НЕ остаётся; callerror при этом зовётся только если имя исключения ровно
     'QuotaExceededError' (app.min.js). Отсюда три режима:
       callerror — как современный Chrome: колбэк ошибки вызван;
       throw     — старый WebKit/Tizen: QUOTA_EXCEEDED_ERR наружу, колбэка нет;
       silent    — исключение проглочено вендором, наружу ничего. */
  function failMode(name) {
    if (opts.quota && name.indexOf('lumen_rv_') === 0 && name !== 'lumen_rv_index'
      && films().length >= opts.quota && !Object.prototype.hasOwnProperty.call(ls, name)) return 'callerror';
    if (opts.failKey && name === opts.failKey) return opts.failMode || 'callerror';
    return null;
  }
  const Lampa = {
    Storage: {
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) && store[name] !== '' ? store[name] : def),
      /* Настоящая сигнатура Lampa: set(name, value, nolisten, callerror) —
         четвёртый аргумент зовётся при исключении записи (квота на ТВ). */
      set: (name, value, nolisten, callerror) => {
        setOrder.push(name);
        nolistenFlags.push({ name, nolisten: !!nolisten });
        const mode = failMode(name);
        if (mode) {
          /* Память Storage (readed) обновляется всегда — именно поэтому
             «записалось ли» приходится проверять по самому localStorage. */
          store[name] = value;
          if (mode === 'callerror') {
            if (callerror) callerror(new Error('QuotaExceededError'));
            return;
          }
          if (mode === 'throw') {
            const err = new Error('QUOTA_EXCEEDED_ERR');
            err.name = 'QUOTA_EXCEEDED_ERR';
            throw err;
          }
          return;
        }
        store[name] = value;
        if (value === '') delete ls[name];
        /* localStorage хранит строки — как настоящий Storage.set, который
           прогоняет объекты и массивы через JSON.stringify. */
        else ls[name] = (value && typeof value === 'object') ? JSON.stringify(value) : String(value);
      },
      field: (name) => store[name],
      /* Lampa 3.3.4: remove(field_name, value) убирает ЭЛЕМЕНТ из массива,
         синхронизируемого с CUB (`if (workers[field_name]) …`), а не ключ.
         Для наших ключей worker'а нет — это тихий no-op, поэтому модуль не
         имеет права на него рассчитывать (ревью, Critical 1). */
      remove: (field, value) => { removeCalls.push([field, value]); }
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
  globalThis.window = {
    Lampa: Lampa,
    innerWidth: 1920,
    localStorage: {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(ls, k) ? ls[k] : null),
      setItem: (k, v) => { ls[k] = v; },
      removeItem: (k) => { delete ls[k]; }
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.$ = $;

  const LC = {};
  const module = { exports: null, lumen: false };
  loadInto(LC, module, '10_util.js');
  /* Task 68: LC.focus — подписка на оба события фокуса (src/11_focus.js). */
  loadInto(LC, module, '11_focus.js');
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '81_prefs.js');
  loadInto(LC, module, '60_reviews.js');
  return { LC, store, ls, films, journal, collected, modals, toggled, refocused, removeCalls, setOrder, nolistenFlags, opts, Lampa };
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

/* Долг фазы 1, п.4 (2026-09-23): «на экране ли карточка» решает настоящая
   проверка (src/51_slideshow.js), а тест задаёт состояние DOM — активность
   вокруг ряда (FakeEl с классом activity и, если на экране,
   activity--active) и «в документе» для всех узлов. */
function onScreenEnv(env) {
  loadInto(env.LC, { exports: null, lumen: true }, '51_slideshow.js');
  globalThis.document = { documentElement: { contains: () => true } };
}

function blocksOf(d) { return d.descr._children.filter((n) => n.hasClass('lumen-reviews')); }

/* ====================================================================== */
/* Ревью фазы 1 (M2): подпись отзыва без автора не должна оставаться       */
/* русской в en/uk.                                                        */
/*                                                                        */
/* Строка lumen_card_anon лежит в LC.STRINGS с тремя языками — здесь       */
/* проверяется, что рабочий путь (load -> normalize) реально её берёт,     */
/* причём БЕЗ Lampa.Lang: в freshEnv его нет вовсе, и LC.lang обязан сам   */
/* прочитать словарь по коду языка из Storage. Литерал ANON в модуле       */
/* остаётся последним рубежом и виден, только если 80_settings.js рядом    */
/* не загружен (чистый unit-режим test/_load.mjs — тест normalize выше).   */
/* ====================================================================== */

['ru', 'en', 'uk'].forEach((code) => {
  test('M2: отзыв без автора подписывается строкой словаря для языка ' + code + ' (Lampa.Lang недоступен)', () => {
    const env = freshEnv({ store: { language: code } });
    const seen = [];
    env.LC.reviews.load('tt1', 'key', (res) => seen.push(res));

    env.journal.calls[0].ok({ items: [{ kinopoiskId: 42 }] });
    env.journal.calls[1].ok({ total: 1, items: [{ type: 'NEUTRAL', description: 'текст отзыва без автора' }] });

    assert.equal(seen.length, 1, 'ответ разобран');
    assert.equal(seen[0].list[0].author, env.LC.STRINGS.lumen_card_anon[code]);
    assert.deepEqual(warnLog, []);
  });
});

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
  /* kp — id Кинопоиска, найденный по imdbId, rate — рейтинг КП оттуда же
     (Task 10): оба лежат рядом с отзывами, чтобы чип рейтинга не искал фильм
     вторым запросом. Прямая запись без поиска оставляет их нулями. */
  assert.deepEqual(env.store.lumen_rv_tt1, { at: 1000, kp: 0, rate: 0, list: [{ title: 'a' }], total: 7 });

  const rec = env.LC.reviews.cacheRead('tt1', 1000 + 60000);
  assert.equal(rec.total, 7);
  assert.equal(env.LC.reviews.cacheRead('tt1', 1000 + 25 * 3600 * 1000), null, 'протухшая запись не отдаётся');
  assert.equal(env.LC.reviews.cacheRead('tt404', 1000), null);
  assert.deepEqual(warnLog, []);
});

/* Ревью (Critical 1): вытеснение обязано РЕАЛЬНО освобождать место. Прежний
   код звал Lampa.Storage.remove(ключ) — в Lampa это удаление элемента из
   CUB-массива, для наших ключей тихий no-op, и вытесненная запись оставалась
   в localStorage целиком (десятки килобайт на фильм при квоте ~5 МБ). */
test('кэш: сверх предела фильм вытесняется, его ключ исчезает из хранилища, Storage.remove не используется', () => {
  const env = freshEnv();
  const LIMIT = 8;
  for (let i = 1; i <= LIMIT; i++) env.LC.reviews.cacheWrite('tt' + i, [{ title: 'i' + i }], i, 1000 + i);
  assert.equal(env.store.lumen_rv_index.length, LIMIT);
  assert.equal(env.films().length, LIMIT);

  env.LC.reviews.cacheWrite('tt9', [{ title: 'i9' }], 9, 9999);
  const index = env.store.lumen_rv_index;
  assert.equal(index.length, LIMIT, 'в индексе не больше предела');
  assert.equal(env.films().length, LIMIT, 'и в самом хранилище ровно столько же ключей — место освобождено');
  assert.equal(env.films().indexOf('lumen_rv_tt1'), -1, 'ключ вытесненного фильма удалён физически');
  assert.equal(index.filter((it) => it.id === 'tt1').length, 0, 'самый старый по at вытеснен из индекса');
  assert.equal(index.filter((it) => it.id === 'tt9').length, 1);
  assert.equal(env.LC.reviews.cacheRead('tt1', 9999), null, 'запись вытесненного фильма не читается');
  assert.equal(env.LC.reviews.cacheRead('tt2', 9999).total, 2, 'соседи не пострадали');
  assert.deepEqual(env.removeCalls, [], 'Storage.remove в Lampa про CUB-массивы — на него нельзя рассчитывать');
  assert.deepEqual(warnLog, []);
});

/* Ревью (Minor 8): если запись фильма упадёт, в индексе окажется id без
   данных — cacheRead вернёт null и фильм перезапросится. Обратный порядок
   оставлял бы запись, которую уже некому вытеснить. */
test('кэш: индекс записывается раньше самой записи фильма', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);
  const order = env.setOrder.filter((n) => n.indexOf('lumen_rv_') === 0);
  assert.deepEqual(order, ['lumen_rv_index', 'lumen_rv_tt1']);
});

/* Ревью (Minor 7): Storage.get на битом JSON возвращает исходную строку — у
   неё тоже есть length, и прежняя проверка принимала её за индекс. */
test('кэш: битый индекс (строка вместо массива) не ломает запись', () => {
  const env = freshEnv({ store: { lumen_rv_index: '{битый json' } });
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);
  assert.deepEqual(env.store.lumen_rv_index, [{ id: 'tt1', at: 1000 }]);
});

/* Ревью (Important 4): на ТВ запись может упасть по квоте — тогда половина
   кэша бесполезна, чистим свои записи целиком и продолжаем работать. */
test('кэш: QuotaExceededError чистит кэш отзывов через callerror', () => {
  const env = freshEnv({ quota: 3 });
  for (let i = 1; i <= 3; i++) env.LC.reviews.cacheWrite('tt' + i, [{ title: 'i' + i }], i, 1000 + i);
  assert.equal(env.films().length, 3);

  env.LC.reviews.cacheWrite('tt4', [{ title: 'i4' }], 4, 2000);
  assert.equal(env.films().length, 0, 'после отказа по квоте свои записи убраны');
  assert.deepEqual(env.store.lumen_rv_index, []);
  assert.ok(warnLog.some((m) => m.indexOf('quota') !== -1), 'сбой квоты не должен быть беззвучным');
  warnLog.length = 0;
});

/* Ревью (Important 5): у «отзывов нет» свой короткий TTL. */
test('кэш: пустой результат живёт 2 часа, непустой — сутки', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('ttEmpty', [], 0, 1000);
  env.LC.reviews.cacheWrite('ttFull', [{ title: 'a' }], 5, 1000);

  assert.ok(env.LC.reviews.cacheRead('ttEmpty', 1000 + 1.5 * 3600 * 1000), 'через 1.5 ч пустая запись ещё свежа');
  assert.equal(env.LC.reviews.cacheRead('ttEmpty', 1000 + 3 * 3600 * 1000), null, 'через 3 ч — уже нет');
  assert.ok(env.LC.reviews.cacheRead('ttFull', 1000 + 12 * 3600 * 1000), 'непустая живёт сутки');
  assert.equal(env.LC.reviews.cacheRead('ttFull', 1000 + 25 * 3600 * 1000), null);
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
  /* Жалоба 2026-09-25: метка источника и тон — обычным регистром. */
  assert.ok(html.indexOf('Кинопоиск') !== -1, 'источник в заголовке');
  assert.ok(html.indexOf('318 отзывов') !== -1, 'число отзывов из total со склонением');
  assert.ok(html.indexOf('Иван Петров') !== -1 && html.indexOf('Шедевр') !== -1);
  assert.ok(html.indexOf('02.03.2024') !== -1);
  assert.ok(html.indexOf('Позитивный') !== -1 && html.indexOf('Нейтральный') !== -1 && html.indexOf('Негативный') !== -1);
  /* «полезно» — в своём узле: в карточке его прячет CSS (там звезда). */
  assert.ok(html.indexOf('<span class="lumen-review__likes">12<span class="lumen-review__useful"> полезно</span></span>') !== -1, html);
  assert.ok(html.indexOf('lumen-review--good') !== -1 && html.indexOf('lumen-review--bad') !== -1);
  assert.ok(html.indexOf('lumen-review selector') !== -1, 'карточка отзыва — .selector (навигация пультом)');
  assert.ok(d.row.hasClass('lumen-descr-row--reviews'), 'с рядом отзывов описание поджимается (иначе карточки уходят за нижний край)');
  assert.deepEqual(warnLog, []);
});

/* Task 68: фокус ловится в фазе перехвата на корне блока, и подписку ставит
   общий LC.focus.capture (src/11_focus.js) — сразу на оба события Lampa.
   Мышью приходит 'hover:hover' (vendor/lampa/app.min.js:46360-46364), и без
   этой ветки лента отзывов за курсором не ехала: карточка уезжала за кромку
   блока. */
function reviewsFocusEnv() {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  const block = blocksOf(d)[0];
  const row = block.find('.lumen-reviews__row');
  /* find отдаёт набор всех карточек отзывов (как jQuery) — берём первую. */
  const card = block.find('.lumen-review').eq(0);
  /* Геометрия ленты: карточка шириной 400 на позиции 900, видимая часть 1000,
     вся лента 2400. Центрирование даёт 900 − (1000 − 400) / 2 = 600. */
  row.clientWidth = 1000;
  row.scrollWidth = 2400;
  row.scrollLeft = 0;
  card.offsetLeft = 900;
  card.offsetWidth = 400;
  return { env, block, row, card };
}

test('Task 68: на корне блока отзывов ОБА события фокуса, и это один обработчик', () => {
  const f = reviewsFocusEnv();
  const caps = (f.block._listeners || []).filter((l) => l.capture);
  assert.deepEqual(
    caps.map((l) => l.type).sort(),
    ['hover:enter', 'hover:focus', 'hover:hover'],
    'подписки: OK, фокус пультом, фокус мышью'
  );
  const focus = caps.filter((l) => l.type === 'hover:focus')[0];
  const hover = caps.filter((l) => l.type === 'hover:hover')[0];
  assert.equal(focus.fn, hover.fn, 'обработчик у обеих веток один');
});

/* Полное ревью, D2: ряд отзывов — только за пультом. Мышью лента ехала за
   наведением (центрирование), подвозила под курсор соседнюю карточку, и
   клик по второму отзыву открывал первый. Мышью лента листается колесом
   (тест ниже), как штатные ряды Lampa. */
test('D2: пультовый hover:focus центрирует ленту отзывов, мышиный hover:hover — нет', () => {
  const remote = reviewsFocusEnv();
  (remote.block._listeners || []).filter((l) => l.type === 'hover:focus')[0]
    .fn({ type: 'hover:focus', target: remote.card });
  assert.equal(remote.row.scrollLeft, 600, 'пультом лента встала по центру карточки');

  const mouse = reviewsFocusEnv();
  (mouse.block._listeners || []).filter((l) => l.type === 'hover:hover')[0]
    .fn({ type: 'hover:hover', target: mouse.card });
  assert.equal(mouse.row.scrollLeft, 0, 'наведение мышью сдвинуло ленту из-под курсора');
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
  assert.equal(html.indexOf('lumen-review selector'), -1, 'карточек отзывов в подсказке нет');
  /* Task 20: единственный фокусируемый узел подсказки — кнопка «Скрыть». */
  assert.ok(html.indexOf('lumen-reviews__hint-hide selector') !== -1, 'ожидалась кнопка «Скрыть»');
  assert.ok(html.indexOf('Скрыть') !== -1);
  assert.equal(d.row.hasClass('lumen-descr-row--reviews'), false, 'подсказка низкая — описание поджимать незачем');
});

/* Task 20: подсказку про ключ можно убрать навсегда — кнопкой на экране или
   переключателем «Подсказка про ключ» в настройках. */
test('Task 20: lumen_kp_hint выключена — подсказки про ключ нет вовсе', () => {
  const env = freshEnv({ store: { lumen_kp_hint: 'false' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);

  assert.equal(env.journal.calls.length, 0, 'без ключа в сеть не ходим');
  assert.equal(blocksOf(d).length, 0, 'блока подсказки быть не должно');
});

test('Task 20: кнопка «Скрыть» пишет lumen_kp_hint = строку false и возвращает фокус', () => {
  const env = freshEnv({ controller: 'full_descr' });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);

  const block = blocksOf(d)[0];
  const enter = (block._listeners || []).filter((l) => l.type === 'hover:enter')[0];
  assert.ok(enter, 'на блоке подсказки обязан висеть слушатель hover:enter');
  enter.fn({ type: 'hover:enter', target: new FakeEl(['lumen-reviews__hint-hide', 'selector']) });

  /* Строка, а не JS-false: Storage.set(name, false) у Lampa не сохраняется. */
  assert.equal(env.store.lumen_kp_hint, 'false');
  assert.deepEqual(env.toggled, ['full_descr'], 'фокус возвращается живой коллекции');
  assert.deepEqual(warnLog, []);
});

test('Task 20: подпись ряда учитывает подсказку — выключение перерисовывает, а не отсекается', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(blocksOf(d).length, 1);

  env.store.lumen_kp_hint = 'false';
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(blocksOf(d).length, 0, 'повторный рендер обязан снять подсказку, а не выйти по подписи');
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

/* ------------------------- правки по ревью ------------------------- */

/* Ревью (Important 2): пользователь ошибся в ключе, получил 401 и исправил
   опечатку. С флагом «ключ есть» подпись не менялась, рендер выходил по
   раннему return, и верный ключ срабатывал только со следующего открытия. */
test('render: исправленный ключ применяется сразу, без переоткрытия карточки', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'WRONG-KEY' } });
  const d = makeDescrRow();

  env.LC.reviews.render(d.row, DUNE);
  assert.equal(env.journal.calls.length, 1);
  assert.equal(env.journal.calls[0].params.headers['X-API-KEY'], 'WRONG-KEY');
  env.journal.calls[0].err({ status: 401 });
  assert.equal(blocksOf(d).length, 0, 'с неверным ключом блока нет');

  env.store.lumen_kp_key = 'RIGHT-KEY';
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(env.journal.calls.length, 2, 'новый ключ — новый запрос');
  assert.equal(env.journal.calls[1].params.headers['X-API-KEY'], 'RIGHT-KEY');

  env.journal.calls[1].ok(SEARCH_OK);
  env.journal.calls[2].ok(REVIEWS_OK);
  assert.equal(blocksOf(d).length, 1);
  assert.deepEqual(warnLog, []);
});

/* Ревью (Important 3): карточка, оставленная в истории Lampa, остаётся живым
   DOM. Ответ, догнавший её, дорисовать ряд может (он её собственный), но
   отдавать .selector в навигацию нельзя: пользователь в это время стоит в
   ряду описания ДРУГОЙ карточки, и имя контроллера у обеих одинаковое. */
test('render: ответ карточки из истории не попадает в навигацию текущей карточки', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  onScreenEnv(env);
  new FakeEl(['activity'], [d.row]);

  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);

  assert.equal(blocksOf(d).length, 1, 'свой ряд карточка дорисовывает');
  assert.equal(env.collected.length, 0, 'но коллекцию активного контроллера не трогает');

  const visible = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  onScreenEnv(visible);
  const d2 = makeDescrRow();
  new FakeEl(['activity', 'activity--active'], [d2.row]);
  visible.LC.reviews.render(d2.row, DUNE);
  visible.journal.calls[0].ok(SEARCH_OK);
  visible.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(visible.collected.length, 1, 'карточка на экране коллекцию дополняет');
  assert.deepEqual(warnLog, []);
});

/* Ревью (Important 6): при быстром переборе карточек прошлый запрос обязан
   сниматься — иначе на каждой висят два XHR до восьми секунд и тратится
   бесплатная квота (500 запросов в день). */
test('render: смена карточки снимает незавершённый запрос предыдущей', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();

  env.LC.reviews.render(d.row, DUNE);
  assert.equal(env.journal.nets.length, 1);
  const first = env.journal.nets[0];
  assert.equal(first.cleared, 0);

  env.LC.reviews.render(d.row, { movie: { id: 2, imdb_id: 'tt777' } });
  assert.equal(first.cleared, 1, 'колбэки и XHR прошлой карточки сняты');
  assert.equal(env.journal.nets.length, 2, 'для новой карточки — свой экземпляр');
});

/* Ревью (Minor 9): total попадает в разметку заголовка, а в кэше он мог
   оказаться чем угодно. */
test('render: total из кэша не становится разметкой', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const list = env.LC.reviews.normalize(REVIEWS_OK);
  env.LC.reviews.cacheWrite('tt15239678', list, '<b>318</b>');

  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  const html = blocksOf(d)[0].html();
  assert.equal(html.indexOf('<b>318'), -1, 'разметка из кэша не должна попасть в DOM');
  assert.equal(env.journal.calls.length, 0, 'данные взяты из кэша');
});

/* ------------------------- ревью 2 ------------------------- */

/* Ревью 2 (п.1): отказ квоты на ЗАПИСИ ИНДЕКСА раньше оставлял сироту —
   purge() чистил всё и ставил индекс пустым, место освобождалось, и следующая
   запись фильма проходила успешно: ключ есть, в индексе его нет, вытеснить
   некому. */
test('кэш: отказ записи индекса не оставляет запись-сироту', () => {
  const env = freshEnv({ failKey: 'lumen_rv_index', failMode: 'callerror' });
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);

  assert.deepEqual(env.films(), [], 'без индекса запись фильма не делается');
  assert.equal(env.LC.reviews.cacheRead('tt1', 1000), null, 'и не читается');
  assert.ok(warnLog.some((m) => m.indexOf('quota') !== -1), 'отказ не должен быть беззвучным');
  warnLog.length = 0;
});

/* Ревью 2 (п.2): на старых WebKit/Tizen имя исключения не
   'QuotaExceededError', поэтому Lampa не зовёт callerror вовсе — сбой обязан
   ловиться по факту отсутствия значения в localStorage. */
test('кэш: отказ без callerror (QUOTA_EXCEEDED_ERR) тоже чистит кэш', () => {
  const env = freshEnv({ failKey: 'lumen_rv_tt2', failMode: 'throw' });
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);
  assert.equal(env.films().length, 1);

  env.LC.reviews.cacheWrite('tt2', [{ title: 'b' }], 2, 2000);
  assert.deepEqual(env.films(), [], 'кэш вычищен, а не оставлен наполовину');
  assert.deepEqual(env.store.lumen_rv_index, []);
  assert.ok(warnLog.some((m) => m.indexOf('quota') !== -1));
  warnLog.length = 0;
});

test('кэш: молчаливый отказ (значение осело в памяти, но не в localStorage) ловится проверкой записи', () => {
  const env = freshEnv({ failKey: 'lumen_rv_tt2', failMode: 'silent' });
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);
  assert.equal(env.films().length, 1);

  env.LC.reviews.cacheWrite('tt2', [{ title: 'b' }], 2, 2000);
  assert.deepEqual(env.films(), [], 'несохранённая запись обнаружена без исключения и без callerror');
  assert.ok(warnLog.some((m) => m.indexOf('not stored') !== -1), 'в лог уходит причина');
  warnLog.length = 0;
});

/* Ревью 2 (п.6): событие 'change' на каждую запись кэша подписчикам не нужно. */
test('кэш: записи идут с nolisten = true', () => {
  const env = freshEnv();
  env.LC.reviews.cacheWrite('tt1', [{ title: 'a' }], 1, 1000);
  const cacheWrites = env.nolistenFlags.filter((w) => w.name.indexOf('lumen_rv_') === 0);
  assert.ok(cacheWrites.length >= 2);
  assert.ok(cacheWrites.every((w) => w.nolisten === true), 'лишних событий change кэш не шлёт');
});

/* Ревью 2 (п.4): поднять поколение мало — сам запрос продолжал бы висеть до
   таймаута и после выключения настройки, и после закрытия карточки. */
test('запрос снимается при выключении настройки (clearRow) и при закрытии карточки (cancel)', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });

  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  const net1 = env.journal.nets[0];
  assert.equal(net1.cleared, 0);
  env.LC.reviews.clearRow(d.row);
  assert.equal(net1.cleared, 1, 'clearRow снимает висящий запрос');

  const d2 = makeDescrRow();
  env.LC.reviews.render(d2.row, DUNE);
  const net2 = env.journal.nets[env.journal.nets.length - 1];
  assert.equal(net2.cleared, 0);

  const body = new FakeEl(['activity__body'], [d2.row]);
  env.LC.reviews.cancel(body);
  assert.equal(net2.cleared, 1, 'закрытие карточки снимает запрос её ряда');

  /* На узле без рендера состояние не создаётся и исключений нет. */
  const fresh = makeDescrRow();
  env.LC.reviews.cancel(new FakeEl(['activity__body'], [fresh.row]));
  assert.equal(fresh.descr[0].lumenReviews, undefined);
  env.LC.reviews.cancel(null);
  env.LC.reviews.cancel(new FakeEl(['activity__body']));
  assert.deepEqual(warnLog, []);
});

test('clearRow: снимает блок, класс поджатия описания и подпись', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(blocksOf(d).length, 1);
  assert.ok(d.row.hasClass('lumen-descr-row--reviews'));

  env.LC.reviews.clearRow(d.row);
  assert.equal(blocksOf(d).length, 0, 'блок снят');
  assert.equal(d.row.hasClass('lumen-descr-row--reviews'), false, 'описанию вернули полный предел');

  env.LC.reviews.render(d.row, DUNE);
  assert.equal(env.journal.calls.length, 2, 'данные уже в кэше — новых запросов нет');
  assert.equal(blocksOf(d).length, 1, 'после clearRow ряд собирается заново');
  assert.deepEqual(warnLog, []);
});

/* ------------------------- рейтинг Кинопоиска (Task 10) ------------------------- */

/* Экран 09: «Ключ Kinopoisk API — нужен для отзывов и рейтинга КП». Рейтинг
   приходит ТЕМ ЖЕ ответом films?imdbId, которым модуль ищет kinopoiskId для
   отзывов, поэтому лишних запросов ради него не появляется. Само заполнение
   чипа .rate--kp — в 90_runtime.js (LC.applyKpRate), здесь только данные. */

test('kpRateOf: число или строка -> число, пусто/ноль/мусор -> 0, потолок 10', () => {
  assert.equal(r.kpRateOf({ ratingKinopoisk: 7.8 }), 7.8);
  assert.equal(r.kpRateOf({ ratingKinopoisk: '8.3' }), 8.3);
  assert.equal(r.kpRateOf({ ratingKinopoisk: 11 }), 10, 'чип рейтинга шире 10 не бывает');
  assert.equal(r.kpRateOf({ ratingKinopoisk: null }), 0, 'у фильма без оценок поле null');
  assert.equal(r.kpRateOf({ ratingKinopoisk: 0 }), 0);
  assert.equal(r.kpRateOf({ ratingKinopoisk: 'нет' }), 0);
  assert.equal(r.kpRateOf({}), 0);
  assert.equal(r.kpRateOf(null), 0);
});

test('load: рейтинг КП берётся из ответа films?imdbId, второго запроса ради него нет', () => {
  const env = freshEnv();
  const rates = [];
  env.LC.applyKpRate = (v) => rates.push(v);

  env.LC.reviews.load('tt15239678', 'KEY', () => { });
  env.journal.calls[0].ok({ total: 1, items: [{ kinopoiskId: 301, imdbId: 'tt15239678', ratingKinopoisk: 7.8 }] });

  assert.deepEqual(rates, [7.8], 'рейтинг уходит на чип сразу, не дожидаясь отзывов');
  assert.equal(env.journal.calls.length, 2, 'запросов по-прежнему два: поиск и отзывы');

  env.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(env.store.lumen_rv_tt15239678.rate, 7.8, 'рейтинг лёг в кэш рядом с отзывами');
  assert.deepEqual(warnLog, []);
});

test('load: рейтинг КП отдаётся из кэша без единого запроса', () => {
  const env = freshEnv();
  const rates = [];
  env.LC.applyKpRate = (v) => rates.push(v);
  env.LC.reviews.cacheWrite('tt1', [{ title: 'из кэша' }], 5, 1000, 301, 8.4);

  env.LC.reviews.load('tt1', 'KEY', () => { }, null, 1000);

  assert.equal(env.journal.calls.length, 0, 'кэш свежий — в сеть не идём');
  assert.deepEqual(rates, [8.4]);
});

test('load: у фильма нет отзывов — рейтинг всё равно показан и закэширован', () => {
  const env = freshEnv();
  const rates = [];
  env.LC.applyKpRate = (v) => rates.push(v);

  env.LC.reviews.load('tt15239678', 'KEY', () => { });
  env.journal.calls[0].ok({ total: 1, items: [{ kinopoiskId: 301, ratingKinopoisk: 6.1 }] });
  env.journal.calls[1].ok({ total: 0, items: [] });

  assert.deepEqual(rates, [6.1], 'чип рейтинга от наличия отзывов не зависит');
  assert.equal(env.store.lumen_rv_tt15239678.rate, 6.1, 'отрицательный кэш тоже держит рейтинг');
  assert.deepEqual(warnLog, []);
});

test('load: фильма в Кинопоиске нет — рейтинг не показываем', () => {
  const env = freshEnv();
  const rates = [];
  env.LC.applyKpRate = (v) => rates.push(v);

  env.LC.reviews.load('tt15239678', 'KEY', () => { });
  env.journal.calls[0].ok({ total: 0, items: [] });

  assert.deepEqual(rates, []);
});

test('load: рантайм ещё не подключил LC.applyKpRate — модуль это переживает', () => {
  const env = freshEnv();
  env.LC.reviews.load('tt15239678', 'KEY', () => { });
  env.journal.calls[0].ok({ total: 1, items: [{ kinopoiskId: 301, ratingKinopoisk: 7.8 }] });
  assert.deepEqual(warnLog, []);
});

/* Ревью Task 10 (п.2): сторож alive() привязан к ПОКОЛЕНИЮ ряда той карточки,
   которая запрос и отправила. При Activity.push A -> B Lampa для A не шлёт ни
   destroy, ни archive (план 0.2): LC.reviews.cancel для неё не зовётся,
   поколение ряда A не растёт — и сетевой ответ A спокойно доезжает. Раньше он
   писал рейтинг фильма A в чип уже открытой карточки B по глобальному
   селектору .activity--active (типовой случай, когда своего kp_rating Lampa не
   дала). Ветка кэша синхронная и этой дырой не страдала. */
test('ревью п.2: рейтинг КП не уезжает на чужую карточку — ответ A приходит, когда открыта B', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const rates = [];
  env.LC.applyKpRate = (rate, row) => rates.push({ rate, row });

  const a = makeDescrRow();
  const b = makeDescrRow();
  /* На экране сейчас B — та же проверка, которой пользуется сам ряд отзывов. */
  onScreenEnv(env);
  new FakeEl(['activity'], [a.row]);
  new FakeEl(['activity', 'activity--active'], [b.row]);

  env.LC.reviews.render(a.row, { movie: { id: 1, imdb_id: 'ttAAA' } });
  env.LC.reviews.render(b.row, { movie: { id: 2, imdb_id: 'ttBBB' } });
  assert.equal(env.journal.calls.length, 2, 'обе карточки отправили поиск по imdbId');

  env.journal.calls[0].ok({ total: 1, items: [{ kinopoiskId: 11, ratingKinopoisk: 7.8 }] });
  assert.deepEqual(rates, [], 'рейтинг фильма A в чип карточки B не попал');

  env.journal.calls[1].ok({ total: 1, items: [{ kinopoiskId: 22, ratingKinopoisk: 6.5 }] });
  assert.equal(rates.length, 1, 'рейтинг активной карточки поставлен');
  assert.equal(rates[0].rate, 6.5);
  assert.equal(rates[0].row, b.row, 'чип ищется в активности запросившей карточки');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Task 28 (фаза 3): отзывы без спойлеров и режим заголовков.             */
/*                                                                        */
/* Разметки «спойлер» в ответе kinopoiskapiunofficial.tech нет: элемент    */
/* items[] отдаёт description обычной строкой (docs/research/                */
/* API_NOTES_2.md §4, «полная схема»), и живьём это не проверить — ключа   */
/* у пользователя нет. Поэтому спойлеры распознаются тремя правилами, и    */
/* все три проверены здесь на текстах, собранных по образцу отзывов        */
/* Кинопоиска.                                                             */
/* ====================================================================== */

test('splitSpoilers: явная обёртка — скрыт только её текст, сами метки уходят', () => {
  const segs = r.splitSpoilers('Начало обычное. [spoiler]Герой оказывается отцом злодея.[/spoiler] Снято хорошо.');
  assert.deepEqual(segs.map((s) => s.s), [false, true, false]);
  assert.equal(segs[1].t, 'Герой оказывается отцом злодея.');
  assert.equal(segs[0].t.indexOf('[spoiler]'), -1, 'метки в текст не попадают');
});

test('splitSpoilers: <spoiler> и <span class="spoiler"> — те же обёртки', () => {
  assert.deepEqual(r.splitSpoilers('А <spoiler>Б</spoiler> В').map((s) => [s.t.trim(), s.s]), [['А', false], ['Б', true], ['В', false]]);
  assert.deepEqual(r.splitSpoilers('А <span class="spoiler">Б</span> В').map((s) => [s.t.trim(), s.s]), [['А', false], ['Б', true], ['В', false]]);
});

test('splitSpoilers: предупреждение прячет весь остаток текста', () => {
  const segs = r.splitSpoilers('Смотреть стоит. Осторожно, спойлеры! Героиня умирает в первой трети. И дальше всё рушится.');
  assert.equal(segs.length, 2);
  assert.equal(segs[0].s, false);
  assert.equal(segs[0].t.trim(), 'Смотреть стоит.');
  assert.equal(segs[1].s, true);
  assert.ok(segs[1].t.indexOf('И дальше всё рушится.') >= 0, 'от предупреждения и до конца — под замком');
});

test('splitSpoilers: отдельное предложение с маркером, соседние остаются открытыми', () => {
  const segs = r.splitSpoilers('Картинка отличная. В финале героя убивают. Музыка тоже хороша.');
  assert.deepEqual(segs.map((s) => s.s), [false, true, false]);
  assert.equal(segs[1].t.trim(), 'В финале героя убивают.');
});

test('splitSpoilers: текст без маркеров — один открытый сегмент; пустой вход — пусто', () => {
  assert.deepEqual(r.splitSpoilers('Хорошее кино про песок и политику.').map((s) => s.s), [false]);
  assert.deepEqual(r.splitSpoilers(''), []);
  assert.deepEqual(r.splitSpoilers(null), []);
});

test('normalize: спойлер вырезан из выдержки, но целиком есть в частях модала', () => {
  const item = r.normalize({
    items: [{
      type: 'POSITIVE', author: 'Аня', title: 'Отлично',
      description: 'Картинка отличная. В финале героя убивают. Музыка тоже хороша.'
    }]
  })[0];
  assert.equal(item.spoiler, true);
  assert.equal(item.excerpt.indexOf('убивают'), -1, 'в ряду спойлера нет');
  assert.ok(item.excerpt.indexOf('Картинка отличная') >= 0);
  assert.deepEqual(item.parts.map((p) => p.s), [false, true, false]);
  assert.ok(item.parts[1].t.indexOf('убивают') >= 0);
  assert.equal(item.full, '', 'со спойлерами текст хранится частями, вторым полем кэш не дублируется');
});

/* Отзыв без спойлеров частями не хранится: его текст целиком лежит в full,
   как и до Task 28, — иначе кэш отзывов (8 фильмов × 12 отзывов × 4000
   символов) вырос бы вдвое на ровном месте. Части появляются только там, где
   есть что скрывать, и тогда full не пишется вовсе. */
test('normalize: без спойлеров частей нет, текст остаётся в full и экранируется', () => {
  const item = r.normalize({ items: [{ description: 'Текст <b>жирный</b> и «кавычки».' }] })[0];
  assert.equal(item.spoiler, false);
  assert.deepEqual(item.parts, []);
  assert.ok(item.full.indexOf('&lt;b&gt;') >= 0, 'разметка автора экранируется');
});

test('normalize: заголовок со спойлером заменяется первым чистым предложением', () => {
  const item = r.normalize({
    items: [{ title: 'В финале героя убивают', description: 'Отличная работа оператора. А потом всё портит концовка.' }]
  })[0];
  assert.equal(item.title.indexOf('убивают'), -1, 'спойлерный заголовок на экран не выносим');
  assert.ok(item.title.indexOf('Отличная работа оператора') >= 0);
});

test('normalize: весь текст под спойлером — выдержки нет, карточка остаётся с заголовком', () => {
  const item = r.normalize({ items: [{ title: 'Мысли', description: '[spoiler]Он был мёртв всё это время.[/spoiler]' }] })[0];
  assert.equal(item.spoiler, true);
  assert.equal(item.excerpt, '');
  assert.equal(item.title, 'Мысли');
});

test('render: режим заголовков (по умолчанию) — текста отзыва в ряду нет, метка спойлера есть', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok({
    total: 1,
    items: [{ type: 'POSITIVE', author: 'Аня', title: 'Отлично', description: 'Картинка отличная. В финале героя убивают.' }]
  });
  const html = blocksOf(d)[0].html();
  assert.equal(blocksOf(d)[0].hasClass('lumen-reviews--headlines'), true, 'режим — класс на блоке');
  assert.equal(html.indexOf('Картинка отличная'), -1, 'текста в ряду нет вовсе');
  assert.ok(html.indexOf('Отлично') >= 0, 'заголовок, автор и мета остаются');
  assert.ok(html.indexOf('lumen-review__spoiler') >= 0, 'метка «есть спойлер»');
  /* Жалоба 2026-09-25: метка — обычным регистром, а карточка помечена
     классом: выдержке в режиме с текстом остаётся на строку меньше. */
  assert.ok(html.indexOf('>Есть спойлер<') >= 0, html);
  assert.ok(html.indexOf('lumen-review--spoiler') >= 0, 'карточка со спойлером не помечена классом');
  assert.deepEqual(warnLog, []);
});

/* Жалоба 2026-09-25: мета — «дата · тон · ★ N» одной строкой. Разделители
   — узлами (у __likes псевдоэлемент занят звездой), и у отзыва без даты
   строка не начинается с висящей точки. Аватара в карточке ряда больше
   нет: рядом с ним мета в одну строку не помещалась. */
test('render: мета отзыва — части через разделители, без висящего разделителя; аватара в карточке нет', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok({
    total: 2,
    items: [
      { type: 'NEGATIVE', date: '2011-03-27T21:00:00', positiveRating: 669, author: 'Алексей Дёмин', title: 'Долго', description: 'Сюжет топчется на месте.' },
      { type: 'NEUTRAL', author: 'Мария', title: 'Холодно', description: 'Держит на расстоянии.' }
    ]
  });
  const html = blocksOf(d)[0].html();
  const metas = html.match(/<div class="lumen-review__meta">.*?<\/div>/g);
  assert.equal(metas.length, 2, html);
  assert.equal(metas[0], '<div class="lumen-review__meta">' +
    '<span class="lumen-review__date">27.03.2011</span><span class="lumen-review__sep">·</span>' +
    '<span class="lumen-review__tag">Негативный</span><span class="lumen-review__sep">·</span>' +
    '<span class="lumen-review__likes">669<span class="lumen-review__useful"> полезно</span></span></div>');
  assert.equal(metas[1], '<div class="lumen-review__meta"><span class="lumen-review__tag">Нейтральный</span></div>',
    'без даты и без «полезно» — ни одного висящего разделителя');
  assert.equal(html.indexOf('lumen-review__ava'), -1, 'аватар в карточке ряда вернулся — мета снова не влезет в строку');
  assert.deepEqual(warnLog, []);
});

test('modal: мета окна — та же строка, со словом «полезно»; аватар на месте; likes из кэша экранируются', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  env.LC.reviews.openModal({ tone: 'bad', author: 'А', initials: 'АБ', title: 'Т', excerpt: 'э', full: 'текст', date: '01.01.2024', likes: 5 });
  const html = env.modals[0].html.html();
  assert.ok(html.indexOf('lumen-review-modal__ava">АБ<') >= 0, 'аватар окна отзыва пропал: ' + html);
  assert.ok(html.indexOf('<span class="lumen-review-modal__date">01.01.2024</span><span class="lumen-review-modal__sep">·</span><span class="lumen-review-modal__tag">Негативный</span>') >= 0, html);
  assert.ok(html.indexOf('5<span class="lumen-review-modal__useful"> полезно</span>') >= 0, html);
  assert.ok(html.indexOf('>Кинопоиск<') >= 0, 'метка источника окна — обычным регистром: ' + html);
  /* Запись кэша могла прийти из Storage чем угодно — в разметку только через esc. */
  env.LC.reviews.openModal({ tone: 'good', author: 'А', initials: 'А', title: 'Т', excerpt: 'э', full: 'текст', date: '', likes: '<b>9</b>' });
  const tainted = env.modals[1].html.html();
  assert.equal(tainted.indexOf('<b>'), -1, 'likes попал в разметку без экранирования: ' + tainted);
});

test('render: режим «с текстом» показывает выдержку без спойлерных кусков', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY', lumen_reviews_mode: 'full' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok({
    total: 1,
    items: [{ type: 'POSITIVE', author: 'Аня', title: 'Отлично', description: 'Картинка отличная. В финале героя убивают.' }]
  });
  const html = blocksOf(d)[0].html();
  assert.equal(blocksOf(d)[0].hasClass('lumen-reviews--headlines'), false);
  assert.ok(html.indexOf('Картинка отличная') >= 0);
  assert.equal(html.indexOf('убивают'), -1, 'спойлер не попадает в ряд и в этом режиме');
});

test('render: переключатель режима в шапке пишет настройку и возвращает фокус', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);

  const block = blocksOf(d)[0];
  const listener = (block._listeners || []).filter((l) => l.type === 'hover:enter')[0];
  const toggle = new FakeEl(['lumen-reviews__mode', 'selector']);
  toggle._parentEl = block;
  listener.fn({ target: toggle });

  assert.equal(env.store.lumen_reviews_mode, 'full', 'режим сохранён');
  assert.deepEqual(env.toggled, ['full_descr'], 'фокус возвращён живой коллекции');
});

test('render: подпись ряда учитывает режим — смена режима перерисовывает, а не отсекается', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const d = makeDescrRow();
  env.LC.reviews.render(d.row, DUNE);
  env.journal.calls[0].ok(SEARCH_OK);
  env.journal.calls[1].ok(REVIEWS_OK);
  assert.equal(blocksOf(d)[0].hasClass('lumen-reviews--headlines'), true);

  env.store.lumen_reviews_mode = 'full';
  env.LC.reviews.render(d.row, DUNE);
  assert.equal(blocksOf(d)[0].hasClass('lumen-reviews--headlines'), false, 'ряд перерисован из кэша, без похода в сеть');
  assert.equal(env.journal.calls.length, 2, 'свежая запись кэша отдаёт отзывы без запросов');
});

test('modal: спойлер замазан, кнопка раскрытия открывает и закрывает его', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const item = env.LC.reviews.normalize({
    items: [{ type: 'POSITIVE', author: 'Аня', title: 'Отлично', description: 'Картинка отличная. В финале героя убивают.' }]
  })[0];
  env.LC.reviews.openModal(item);

  const root = env.modals[0].html;
  const html = root.html();
  assert.ok(html.indexOf('lumen-spoiler') >= 0, 'спойлерный кусок — в своём узле');
  assert.ok(html.indexOf('lumen-review-modal__reveal') >= 0, 'кнопка раскрытия');

  const listener = (root._listeners || []).filter((l) => l.type === 'hover:enter')[0];
  const btn = new FakeEl(['lumen-review-modal__reveal', 'selector']);
  btn._parentEl = root;
  listener.fn({ target: btn });
  assert.equal(root.hasClass('lumen-review-modal--open'), true, 'спойлеры раскрыты');
  listener.fn({ target: btn });
  assert.equal(root.hasClass('lumen-review-modal--open'), false, 'и закрываются обратно');
  assert.deepEqual(warnLog, []);
});

test('modal: отзыву без спойлеров кнопка раскрытия не нужна', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  const item = env.LC.reviews.normalize({ items: [{ description: 'Просто хорошее кино про песок.' }] })[0];
  env.LC.reviews.openModal(item);
  assert.equal(env.modals[0].html.html().indexOf('lumen-review-modal__reveal'), -1);
});

test('modal: запись старого формата (только full, без частей) читается как раньше', () => {
  const env = freshEnv({ store: { lumen_kp_key: 'KEY' } });
  env.LC.reviews.openModal({ tone: 'good', author: 'А', initials: 'А', title: 'Т', excerpt: 'э', full: 'полный текст', date: '01.01.2024', likes: 0 });
  const html = env.modals[0].html.html();
  assert.ok(html.indexOf('полный текст') >= 0);
  assert.equal(html.indexOf('lumen-review-modal__reveal'), -1);
});

/* Полное ревью, D2: мышью лента отзывов листается колесом над её правой
   половиной — как штатные горизонтальные ряды Lampa (Scroll.wheel +
   onTheRightSide, app.min.js:31863-31969); над левой половиной колесо
   остаётся карточке (прокрутка вниз). Шаг — к следующей карточке за кромкой. */
function wheelOn(block, target, clientX, deltaY) {
  const ev = { type: 'wheel', target: target, clientX: clientX, deltaY: deltaY, stopped: false, prevented: false, cancelable: true };
  ev.stopPropagation = () => { ev.stopped = true; };
  ev.preventDefault = () => { ev.prevented = true; };
  (block._listeners || []).filter((l) => l.type === 'wheel').forEach((l) => l.fn(ev));
  return ev;
}

test('D2: колесо над правой половиной ленты отзывов листает её к следующей карточке', () => {
  const f = reviewsFocusEnv();
  const cards = f.block.find('.lumen-review');
  for (let i = 0; i < cards.length; i++) { cards[i].offsetLeft = i * 420; cards[i].offsetWidth = 400; }
  f.row.clientWidth = 1000;
  f.row.scrollWidth = 1400;
  f.row.getBoundingClientRect = () => ({ left: 600, right: 1600 });
  const left = wheelOn(f.block, cards[0], 700, 100);
  assert.equal(left.stopped, false, 'левая половина — колесо остаётся карточке');
  assert.equal(f.row.scrollLeft, 0);
  const fwd = wheelOn(f.block, cards[1], 1500, 100);
  assert.equal(fwd.stopped, true, 'колесо над лентой ушло ещё и карточке');
  /* Третья карточка (840…1240) за кромкой 1000: центр её — 840 − (1000 − 400) / 2
     = 540, упор ленты — 1400 − 1000 = 400. */
  assert.equal(f.row.scrollLeft, 400, 'лента не пролисталась к следующей карточке');
});

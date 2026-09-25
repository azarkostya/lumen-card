import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery, toEl } from './_fakedom.mjs';
import { load } from './_load.mjs';

/* Волна «Логотипы сразу» (жалоба пользователя 2026-09-24: «логотипы
   подгружаются только при выборе, и появляется сначала текст, а потом
   лого»). LC.prefetch (src/58_prefetch.js) заранее тянет детали и логотипы
   соседей карточки под фокусом, а герой (src/48_hero.js) берёт их из памяти.
   Модули грузятся ВМЕСТЕ, в один LC — как в сборке: предзагрузка ходит в
   героя за запросом деталей, выбором логотипа, его адресом и общим
   хранилищем логотипов, а герой — в предзагрузку за деталями. Окружение —
   те же фейковые $, Image, таймеры и Lampa.Api, что в test/hero.test.mjs. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const HERO_SRC = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
const PF_SRC = readFileSync(new URL('../src/58_prefetch.js', import.meta.url), 'utf8');
const UTIL = load('10_util.js');
const CARDINFO = load('35_cardinfo.js');
const FOCUS = load('11_focus.js');

/* FakeEl не знает index() и classList — герой читает их на фокусе. */
FakeEl.prototype.index = function () {
  const p = this._parentEl;
  return p ? p._children.indexOf(this) : -1;
};
Object.defineProperty(FakeEl.prototype, 'classList', {
  configurable: true,
  get() { const self = this; return { contains: (c) => self.hasClass(c) }; }
});

function makeEnv(opts) {
  opts = opts || {};
  const timers = [];
  const images = [];
  const requests = [];

  function FakeImage() {
    this.onload = null; this.onerror = null; this.src = '';
    this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; this.removed = false;
    images.push(this);
  }
  /* Отмена загрузки в браузере — снятие атрибута src. */
  FakeImage.prototype.removeAttribute = function (name) {
    if (name === 'src') { this.src = ''; this.removed = true; }
  };

  const env = {
    timers: timers, images: images, requests: requests, now: 100000, mode: opts.mode || 'lite',
    advance(ms) {
      env.now += ms;
      for (let round = 0; round < 10; round++) {
        const due = timers.filter((t) => !t.done && t.at <= env.now);
        if (!due.length) return;
        due.forEach((t) => { t.done = true; t.fn(); });
      }
    }
  };

  function ForbiddenObserver() { throw new Error('MutationObserver must not be used'); }
  globalThis.MutationObserver = ForbiddenObserver;
  globalThis.Image = FakeImage;
  globalThis.Date.now = () => env.now;
  globalThis.setTimeout = (fn, ms) => {
    const id = timers.length + 1;
    timers.push({ id: id, fn: fn, ms: ms, at: env.now + ms, done: false });
    return id;
  };
  globalThis.clearTimeout = (id) => { const t = timers[id - 1]; if (t) t.done = true; };

  const Lampa = {
    TMDB: { image: (u) => 'https://img/' + u },
    Api: {
      img: (p, s) => 'https://img/t/p/' + s + p,
      sources: {
        tmdb: {
          get(url, params, ok, err, o) {
            requests.push({ url: url, params: params, ok: ok, err: err, opts: o, done: false });
          }
        }
      }
    },
    Storage: { get: () => 'ru' },
    Activity: { active: () => null },
    Background: { change: () => {} }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920, MutationObserver: ForbiddenObserver };
  globalThis.Lampa = Lampa;
  globalThis.document = {
    documentElement: { clientWidth: 1920 },
    body: { contains: () => true, classList: { add() {}, remove() {}, contains: () => false } }
  };
  globalThis.$ = function (x) { return typeof x === 'string' ? fakeQuery(x) : toEl(x); };

  const prefs = opts.prefs || {};
  const LC = {
    util: UTIL, focus: FOCUS, cardinfo: CARDINFO,
    motionMode: () => env.mode,
    lang: (k) => k,
    langCode: () => 'ru',
    seasonsWord: () => 'season',
    pref: (name, def) => (Object.prototype.hasOwnProperty.call(prefs, name) ? prefs[name] : def)
  };
  new Function('LC', 'module', HERO_SRC)(LC, { exports: null, lumen: true });
  new Function('LC', 'module', PF_SRC)(LC, { exports: null, lumen: true });
  env.LC = LC;
  env.hero = LC.hero;
  env.pf = LC.prefetch;
  warnLog.length = 0;
  return env;
}

/* Карточка ряда: id ряда r и позиции i — (r + 1) * 100 + i + 1 (101, 102…
   в первом ряду, 201… во втором). */
function makeCard(id) {
  const img = new FakeEl(['card__img']);
  img.attr('src', 'https://img/t/p/w300/p' + id + '.jpg');
  const card = new FakeEl(['card', 'selector'], [new FakeEl(['card__view'], [img])]);
  card.card_data = { id: id, title: 'Фильм ' + id, backdrop_path: '/b' + id + '.jpg', poster_path: '/p' + id + '.jpg', overview: 'о ' + id, release_date: '2024-01-01', vote_average: 7 };
  card.getBoundingClientRect = () => { throw new Error('layout read in hot path'); };
  return card;
}

function makeMain(sizes) {
  sizes = sizes || [10, 6, 4];
  const rows = sizes.map((n, r) => {
    const cards = [];
    for (let i = 0; i < n; i++) cards.push(makeCard((r + 1) * 100 + i + 1));
    return cards;
  });
  const lines = rows.map((cards) => new FakeEl(['items-line'], cards));
  const scrollBody = new FakeEl(['scroll__body'], lines);
  const activity = new FakeEl(['activity', 'activity--active'], [new FakeEl(['activity__body'], [scrollBody])]);
  return { activity: activity, rows: rows, lines: lines };
}

function heroOf(root) {
  return root._children.find((c) => c.hasClass('lumen-hero'));
}

function listener(root, type) {
  const list = (root._listeners || []).filter((l) => l.type === type && l.capture);
  assert.equal(list.length, 1, 'на корне обязан жить ровно один capture-слушатель ' + type);
  return list[0].fn;
}

/* Раунд «Листание», F1 (src/48_hero.js): одиночное нажатие показывает
   героя через DELAY, серия (прошлое нажатие ближе 700 мс) — через
   BURST_DELAY после последнего. Предзагрузка соседей серию не ждёт. */
const DELAY = 350;
const BURST_DELAY = 700;

let focused = null;
function focus(main, card, type) {
  if (focused) focused.removeClass('focus');
  card.addClass('focus');
  focused = card;
  listener(main.activity, type || 'hover:focus')({ target: card });
}

function mounted(opts) {
  const env = makeEnv(opts);
  const main = makeMain(opts && opts.sizes);
  focused = null;
  env.hero.mount(main.activity);
  return { env: env, main: main, node: heroOf(main.activity) };
}

const idOf = (url) => Number(String(url).split('/')[1]);
const pending = (env) => env.requests.filter((r) => !r.done);
const answer = (req, json) => { req.done = true; req.ok(json || {}); };
const fail = (req) => { req.done = true; req.err(); };
const withLogo = (id, extra) => Object.assign({ images: { logos: [{ file_path: '/l' + id + '.png', iso_639_1: 'ru' }] } }, extra || {});
const logoUrl = (id) => 'https://img/t/p/w780/l' + id + '.png';
const logoImgs = (env, id) => env.images.filter((i) => i.src === logoUrl(id));
function land(img, w, h) {
  img.complete = true; img.naturalWidth = w || 400; img.naturalHeight = h || 100;
  img.onload();
}

/* Отвечает на запросы предзагрузки по одному, в порядке очереди, пустыми
   деталями, пока они идут; собственный запрос героя (skip) не трогает.
   Возвращает id карточек в порядке, в котором их запросили. */
function drain(env, skip) {
  const order = [];
  for (let guard = 0; guard < 50; guard++) {
    const next = pending(env).find((r) => idOf(r.url) !== skip);
    if (!next) break;
    order.push(idOf(next.url));
    answer(next, {});
  }
  return order;
}

/* ====================================================================== */
/* Листание: при зажатой стрелке — ни одного запроса                      */
/* ====================================================================== */

test('prefetch: фокусы чаще 250 мс — ноль запросов; покой 250 мс — запросы окна', () => {
  const { env, main } = mounted();
  assert.equal(env.requests.length, 0, 'подготовка: без фокуса запросов нет');
  for (let i = 0; i < 8; i++) {
    focus(main, main.rows[0][i]);
    env.advance(100);
  }
  assert.equal(env.requests.length, 0, 'при зажатой стрелке ушли запросы');
  assert.equal(env.images.length, 0, 'при зажатой стрелке ушли картинки');
  env.advance(149);
  assert.equal(env.requests.length, 0, 'план окна раньше 250 мс покоя');
  env.advance(1);
  assert.deepEqual(env.requests.map((r) => idOf(r.url)), [109, 110], 'покой фокуса — первые запросы окна');
  assert.deepEqual(warnLog, []);
});

test('prefetch: мышь заводит окно так же, как пульт', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2], 'hover:hover');
  env.advance(100);
  focus(main, main.rows[0][3], 'hover:hover');
  env.advance(250);
  assert.deepEqual(env.requests.map((r) => idOf(r.url)), [105, 106]);
});

/* Раунд «Листание», F1: серия нажатий шагом 400 мс (шаг самотеста). Герой
   за серию не меняется, а соседи предзагружаются на КАЖДОМ шаге — после
   250 мс покоя, как прежде. Показ после серии — через BURST_DELAY, и
   детали последней карточки у него уже в памяти (её предзагрузили как
   соседа предпоследней). Пультом и мышью — одинаково. */
for (const type of ['hover:focus', 'hover:hover']) {
  test('раунд «Листание» (' + (type === 'hover:hover' ? 'мышь' : 'пульт') + '): серия шагом 400 мс — соседи предзагружаются на каждом шаге, герой встаёт один раз, после серии, с деталями из памяти', () => {
    const { env, main, node } = mounted();
    const descr = () => node.find('.lumen-hero__descr').text();
    focus(main, main.rows[0][0], type);
    env.advance(400);
    drain(env);
    assert.equal(descr(), 'о 101', 'подготовка: одиночное нажатие — 101 показан');

    for (let i = 1; i <= 4; i++) {
      const before = env.requests.length;
      focus(main, main.rows[0][i], type);
      env.advance(249);
      assert.equal(env.requests.length, before, 'шаг ' + i + ': запросы раньше 250 мс покоя');
      env.advance(1);
      assert.ok(env.requests.length > before, 'шаг ' + i + ': предзагрузка соседей в серии не пошла');
      drain(env);
      env.advance(150);
      assert.equal(descr(), 'о 101', 'шаг ' + i + ': герой сменился посреди серии');
    }
    assert.equal(env.requests.filter((r) => idOf(r.url) === 105).length, 1, 'подготовка: 105 предзагружен как сосед 104');

    /* Последнее нажатие было 400 мс назад. */
    env.advance(BURST_DELAY - 400 - 1);
    assert.equal(descr(), 'о 101', 'раньше BURST_DELAY после последнего нажатия');
    env.advance(1);
    env.advance(200);
    assert.equal(descr(), 'о 105', 'после серии герой не встал на последней карточке');
    assert.equal(env.requests.filter((r) => idOf(r.url) === 105).length, 1, 'детали 105 запрошены второй раз — не из памяти');
    assert.ok(env.pf.stats().hits >= 1, 'попадание в память предзагрузки не посчитано');
    assert.deepEqual(warnLog, []);
  });
}

/* ====================================================================== */
/* Окно: по направлению движения, затем назад, затем следующий ряд         */
/* ====================================================================== */

test('prefetch: порядок окна в «Лёгких» — +1, +2, −1 и три первых карточки следующего ряда', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  assert.deepEqual(drain(env, 104), [105, 106, 103, 201, 202, 203]);
});

test('prefetch: порядок окна в «Полном» — +1…+3, −1…−2 и следующий ряд', () => {
  const { env, main } = mounted({ mode: 'full' });
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  assert.deepEqual(drain(env, 104), [105, 106, 107, 103, 102, 201, 202, 203]);
});

test('prefetch: листание влево — окно разворачивается', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][5]);
  env.advance(100);
  focus(main, main.rows[0][4]);
  env.advance(250);
  assert.deepEqual(drain(env, 105), [104, 103, 106, 201, 202, 203]);
});

test('prefetch: край ряда и последний ряд — только то, что есть', () => {
  const { env, main } = mounted({ sizes: [3, 2] });
  focus(main, main.rows[1][0]);
  env.advance(100);
  focus(main, main.rows[1][1]);
  env.advance(250);
  assert.deepEqual(drain(env, 202), [201], 'вперёд некуда, следующего ряда нет');
});

/* ====================================================================== */
/* Очередь: не больше двух, герой — вне очереди, склейка                   */
/* ====================================================================== */

test('prefetch: одновременно в пути не больше двух запросов', () => {
  const { env, main } = mounted({ mode: 'full' });
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  assert.equal(pending(env).length, 2);
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 6, hits: 0 });
  answer(pending(env)[0], {});
  assert.equal(pending(env).length, 2, 'освободилось место — ушёл ровно один следующий');
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 5, hits: 0 });
});

test('prefetch: собственный запрос героя идёт сверх лимита, в обход очереди', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  assert.equal(pending(env).length, 2, 'подготовка: оба места заняты предзагрузкой');
  /* Раунд «Листание», F1: нажатие через 100 мс после прошлого — серия,
     показ героя через BURST_DELAY, а предзагрузка соседей — как прежде,
     после 250 мс покоя. */
  env.advance(DELAY - 250);
  assert.equal(pending(env).length, 2, 'серия нажатий: через DELAY показа героя ещё нет');
  env.advance(BURST_DELAY - DELAY);
  assert.equal(pending(env).length, 3, 'показ героя ждал очереди предзагрузки');
  assert.equal(idOf(pending(env)[2].url), 104);
});

test('prefetch: склейка — герой встаёт на уже идущий запрос соседа, второго нет', () => {
  const { env, main, node } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  env.advance(50);
  /* Запрос 105 уехал предзагрузкой; фокус переходит на 105 раньше показа 104.
     Раунд «Листание», F1: это серия — показ 105 через BURST_DELAY. */
  focus(main, main.rows[0][4]);
  env.advance(BURST_DELAY);
  const for105 = env.requests.filter((r) => idOf(r.url) === 105);
  assert.equal(for105.length, 1, 'запрос деталей 105 ушёл второй раз');
  answer(for105[0], { overview: 'полное о 105' });
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное о 105', 'ответ склеенного запроса не дошёл до героя');
  assert.deepEqual(warnLog, []);
});

test('prefetch: детали в памяти — герой получает их синхронно, без запроса', () => {
  const { env, main, node } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), { overview: 'полное о 105', runtime: 100 });
  const before = env.requests.length;
  /* Раунд «Листание», F1: серия — показ 105 через BURST_DELAY. */
  focus(main, main.rows[0][4]);
  env.advance(BURST_DELAY);
  assert.equal(env.requests.filter((r) => idOf(r.url) === 105).length, 1, 'детали из памяти запрошены снова');
  assert.ok(env.requests.length >= before);
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное о 105');
  assert.equal(env.pf.stats().hits, 1, 'попадание не посчитано');
});

/* ====================================================================== */
/* Логотипы соседей и правило показа                                      */
/* ====================================================================== */

test('prefetch: логотип соседа грузится следом за его деталями — раньше деталей следующего', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  assert.equal(logoImgs(env, 105).length, 1, 'логотип соседа не запрошен');
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [106], 'детали следующего соседа обогнали логотип');
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 4, hits: 0 });
  assert.equal(env.hero.logoState('/l105.png'), 'load');
  land(logoImgs(env, 105)[0]);
  assert.equal(env.hero.logoState('/l105.png'), 'ok');
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [106, 103], 'место логотипа занял следующий');
});

test('prefetch: логотип из памяти — в ПЕРВОМ выводе названия, без текста и без ожидания', () => {
  const { env, main, node } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105, { runtime: 100 }));
  land(logoImgs(env, 105)[0]);

  /* Раунд «Листание», F1: серия — показ 105 через BURST_DELAY. */
  focus(main, main.rows[0][4]);
  env.advance(BURST_DELAY - 1);
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'подготовка: 105 ещё не показан');
  env.advance(1);
  /* show(105): детали — синхронно из памяти, логотип известен — вывод
     названия один и сразу логотипом. */
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип не встал в первом выводе');
  assert.equal(node.find('.lumen-hero__title').text(), '', 'текст названия под логотипом');
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("' + logoUrl(105) + '")');
  assert.equal(logoImgs(env, 105).length, 1, 'известный логотип загружается второй раз');
  assert.deepEqual(env.timers.filter((t) => !t.done && t.ms === 600).map((t) => t.ms), [], 'известному логотипу потолок ожидания не нужен');
  assert.deepEqual(warnLog, []);
});

/* Стенд (шаг 1200 мс): логотип соседа, загруженный давно, лежал в памяти
   самым старым — окно его «знало» и не грузило, а первый же новый
   логотип этого же окна его вытеснял. Герой приходил к карточке и ждал
   логотип заново. Известный логотип окна освежается при плане окна. */
test('prefetch: известный логотип соседа освежается в памяти — окно не вытесняет само себя', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  land(logoImgs(env, 105)[0]);
  for (let i = 1; i <= 23; i++) {
    env.hero.waitLogo('/k' + i + '.png', 'https://img/k' + i + '.png', () => {});
    land(env.images[env.images.length - 1], 100, 50);
  }
  assert.equal(env.hero.logoState('/l105.png'), 'ok', 'подготовка: логотип 105 — самый старый в памяти');

  focus(main, main.rows[0][5]);
  pending(env).forEach((r) => answer(r, {}));
  env.advance(250);
  /* Окно 106: 107, 108, 105 (назад) и следующий ряд. */
  answer(pending(env).find((r) => idOf(r.url) === 107), withLogo(107));
  land(logoImgs(env, 107)[0]);
  assert.equal(env.hero.logoState('/l105.png'), 'ok', 'логотип соседа из окна вытеснен логотипом того же окна');
  assert.equal(env.hero.logoState('/k1.png'), '', 'вытеснен не самый старый вне окна');
});

test('prefetch: логотип, не доехавший один раз, соседу повторяют заранее', () => {
  const { env, main } = mounted();
  env.hero.waitLogo('/l105.png', logoUrl(105), () => {});
  logoImgs(env, 105)[0].onerror();
  assert.equal(env.hero.logoState('/l105.png'), 'retry');
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  assert.equal(logoImgs(env, 105).length, 2, 'повтор логотипа отложен до показа');
});

test('prefetch: выключенный логотип названия — соседям только детали', () => {
  const { env, main } = mounted({ prefs: { lumen_hero_logo: false } });
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  assert.equal(logoImgs(env, 105).length, 0, 'за выключенным логотипом ушёл запрос');
});

test('prefetch: смена фокуса выкидывает очередь, а ответ прошлого окна логотип не заводит', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  assert.ok(env.pf.stats().queue > 0, 'подготовка: очередь есть');
  focus(main, main.rows[0][4]);
  assert.equal(env.pf.stats().queue, 0, 'очередь прошлого окна пережила смену фокуса');
  const before = env.requests.length;
  answer(pending(env).find((r) => idOf(r.url) === 106), withLogo(106));
  assert.equal(logoImgs(env, 106).length, 0, 'ответ прошлого окна завёл загрузку логотипа посреди листания');
  assert.equal(env.requests.length, before, 'освободившееся место заняла выкинутая очередь');
});

/* ====================================================================== */
/* Общее хранилище логотипов: склейка и LRU                               */
/* ====================================================================== */

test('хранилище: два ожидания одного логотипа — одна загрузка; отмена одного не снимает другое', () => {
  const env = makeEnv();
  const a = [];
  const b = [];
  const ha = env.hero.waitLogo('/x.png', 'https://img/x.png', (s) => a.push(s));
  env.hero.waitLogo('/x.png', 'https://img/x.png', (s) => b.push(s));
  const imgs = env.images.filter((i) => i.src === 'https://img/x.png');
  assert.equal(imgs.length, 1, 'одинаковый логотип в пути загружается дважды');
  ha.cancel();
  assert.equal(imgs[0].removed, false, 'отмена одного ожидания сняла загрузку другого');
  land(imgs[0]);
  assert.deepEqual(a, [], 'отменённое ожидание получило решение');
  assert.deepEqual(b, [true]);
});

test('хранилище: последний отказавшийся снимает загрузку и в сети', () => {
  const env = makeEnv();
  const h = env.hero.waitLogo('/y.png', 'https://img/y.png', () => {});
  const img = env.images[env.images.length - 1];
  h.cancel();
  assert.equal(img.removed, true, 'незагруженная картинка осталась тянуть байты');
  assert.equal(img.onload, null);
  assert.equal(env.hero.logoState('/y.png'), '', 'отменённая загрузка записала исход');
});

test('хранилище: LRU 24 логотипа — вытесненный теряет «ok» и в следующий раз ждёт заново', () => {
  const env = makeEnv();
  for (let i = 1; i <= 24; i++) {
    env.hero.waitLogo('/k' + i + '.png', 'https://img/k' + i + '.png', () => {});
    land(env.images[env.images.length - 1], 100, 50);
  }
  assert.equal(env.hero.logoState('/k1.png'), 'ok');
  /* Логотип 1 снова понадобился — он свежий, вытесняется второй. */
  const hit = [];
  env.hero.waitLogo('/k1.png', 'https://img/k1.png', (s) => hit.push(s));
  assert.deepEqual(hit, [true]);
  env.hero.waitLogo('/k25.png', 'https://img/k25.png', () => {});
  land(env.images[env.images.length - 1], 100, 50);
  assert.equal(env.hero.logoState('/k1.png'), 'ok', 'вытеснен недавно использованный');
  assert.equal(env.hero.logoState('/k2.png'), '', 'самый старый не вытеснен');
  const again = [];
  const before = env.images.length;
  env.hero.waitLogo('/k2.png', 'https://img/k2.png', (s) => again.push(s));
  assert.deepEqual(again, [], 'вытесненный логотип решён синхронно, будто он в кэше');
  assert.equal(env.images.length, before + 1, 'вытесненный логотип не грузится заново');
});

test('хранилище: сумма растров больше 16 МБ — вытесняется старый', () => {
  const env = makeEnv();
  env.hero.waitLogo('/big1.png', 'https://img/big1.png', () => {});
  land(env.images[env.images.length - 1], 2000, 1100);
  env.hero.waitLogo('/big2.png', 'https://img/big2.png', () => {});
  land(env.images[env.images.length - 1], 2000, 1100);
  assert.equal(env.hero.logoState('/big1.png'), '', '2 × 8.8 МБ растра держатся в памяти оба');
  assert.equal(env.hero.logoState('/big2.png'), 'ok', 'последний не держится вовсе');
});

/* ====================================================================== */
/* stop(): парковка и снятие героя                                        */
/* ====================================================================== */

test('prefetch: stop — очередь пуста, логотипы в пути сняты, поздний ответ ничего не заводит', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  const img = logoImgs(env, 105)[0];
  env.pf.stop();
  assert.equal(env.pf.stats().queue, 0);
  assert.equal(img.removed, true, 'логотип предзагрузки тянет байты после stop');
  assert.equal(env.hero.logoState('/l105.png'), '');
  const before = env.requests.length;
  const imgs = env.images.length;
  answer(pending(env).find((r) => idOf(r.url) === 106), withLogo(106));
  assert.equal(env.images.length, imgs, 'ответ после stop завёл загрузку логотипа');
  assert.equal(env.requests.length, before, 'ответ после stop завёл следующий запрос');
  assert.deepEqual(env.pf.stats(), { fly: 0, queue: 0, hits: 0 });
});

test('prefetch: парковка героя зовёт stop, покой фокуса на парковке окна не заводит', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  const img = logoImgs(env, 105)[0];
  env.hero.detach(new FakeEl(['activity']));
  assert.equal(env.hero.parked(), true, 'подготовка: герой запаркован');
  assert.equal(img.removed, true, 'park не снял логотип предзагрузки');
  assert.equal(env.pf.stats().queue, 0);
  /* Отложенный план окна, заведённый до парковки, тоже снят. */
  focus(main, main.rows[0][4]);
  const before = env.requests.length;
  env.advance(1000);
  assert.equal(env.requests.length, before, 'на парковке ушли запросы');
});

test('prefetch: снятие героя зовёт stop', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  const img = logoImgs(env, 105)[0];
  env.hero.unmount();
  assert.equal(img.removed, true);
  assert.equal(env.pf.stats().queue, 0);
});

/* ====================================================================== */
/* warm: соседи первого экрана после первого показа                       */
/* ====================================================================== */

function frameOf(env, id) {
  return env.images.find((i) => i.src.indexOf('/b' + id + '.jpg') !== -1);
}

test('prefetch: warm — после первого показа героя, один раз: 7 карточек первого ряда и 3 второго', () => {
  const env = makeEnv();
  const main = makeMain([10, 6]);
  main.rows[0][0].addClass('focus');
  env.hero.mount(main.activity);
  assert.deepEqual(env.requests.map((r) => idOf(r.url)), [101], 'подготовка: показ первой карточки');
  answer(env.requests[0], {});
  assert.equal(pending(env).length, 0, 'warm раньше кадра первого показа');
  land(frameOf(env, 101));
  const order = drain(env, 101);
  assert.deepEqual(order, [102, 103, 104, 105, 106, 107, 201, 202, 203], 'состав или порядок warm');
  /* Второй показ — warm больше не повторяется. */
  const second = main.rows[0][1];
  main.rows[0][0].removeClass('focus');
  second.addClass('focus');
  listener(main.activity, 'hover:focus')({ target: second });
  env.advance(350);
  const frame = frameOf(env, 102);
  if (frame) land(frame);
  const extra = pending(env).map((r) => idOf(r.url)).filter((id) => [101, 102, 103, 104, 105, 106, 107, 201, 202, 203].indexOf(id) !== -1);
  assert.deepEqual(extra, [], 'warm повторился');
  assert.deepEqual(warnLog, []);
});

/* Волна «хвосты героя», п.F (ревью логотипов). OK на карточке героя —
   Lampa открывает карточку фильма, герой паркуется, и park снимал загрузку
   логотипа показанной карточки (cancelPending → logoLoader.cancel, затем
   prefetch('stop')), а карточка подписывается на тот же логотип позже —
   после ответа Api.full. Итог — чаще текст вместо логотипа в карточке.
   Теперь логотип показанной карточки на парковке ещё LOGO_LINGER (1,5 с)
   едет без ждущих: карточка подхватывает ту же загрузку. */
test('п.F: park не обрывает логотип показанной карточки — карточка фильма подхватывает загрузку', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  env.advance(350);
  answer(pending(env).find((r) => idOf(r.url) === 101), withLogo(101));
  const img = logoImgs(env, 101)[0];
  assert.ok(img, 'подготовка: логотип показа в пути');
  env.hero.detach(new FakeEl(['activity']));
  assert.equal(env.hero.parked(), true, 'подготовка: герой запаркован');
  assert.equal(img.removed, false, 'park оборвал логотип показанной карточки');
  env.advance(900);
  const got = [];
  env.hero.waitLogo('/l101.png', logoUrl(101), (s) => got.push(s));
  assert.equal(logoImgs(env, 101).length, 1, 'карточка фильма начала ту же загрузку заново');
  land(img);
  assert.deepEqual(got, [true]);
  assert.equal(env.hero.logoState('/l101.png'), 'ok');
});

test('п.F: логотип показанной карточки никто не подхватил за 1,5 с — загрузка снимается и в сети', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  env.advance(350);
  answer(pending(env).find((r) => idOf(r.url) === 101), withLogo(101));
  const img = logoImgs(env, 101)[0];
  env.hero.detach(new FakeEl(['activity']));
  env.advance(1400);
  assert.equal(img.removed, false, 'снята раньше срока');
  env.advance(100);
  assert.equal(img.removed, true, 'никому не нужная картинка тянет байты');
  assert.equal(img.onload, null);
  assert.equal(env.hero.logoState('/l101.png'), '', 'отменённая загрузка записала исход');
});

/* Ниже порога ревью логотипов: warmed держал корень после stop() (узел
   снятой главной жил в памяти), а warm из колбэка кадра шёл и тогда, когда
   фокус уже уехал дальше, — план первого экрана посреди листания. */
test('п.F: stop забывает корень warm — на том же корне warm снова планирует', () => {
  const env = makeEnv();
  const main = makeMain([10, 6]);
  main.rows[0][0].addClass('focus');
  env.hero.mount(main.activity);
  answer(env.requests[0], {});
  land(frameOf(env, 101));
  assert.ok(env.pf.stats().queue > 0, 'подготовка: warm спланирован');
  env.pf.stop();
  env.pf.warm(main.activity);
  assert.ok(env.pf.stats().queue > 0, 'после stop корень остался помеченным — warm не повторился');
});

test('п.F: кадр показа доехал, когда фокус уже на другой карточке, — warm не планирует', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  env.advance(350);
  answer(pending(env).find((r) => idOf(r.url) === 101), {});
  focus(main, main.rows[0][1]);
  const before = env.requests.length;
  land(frameOf(env, 101));
  assert.equal(env.requests.length, before, 'warm первого экрана посреди листания');
  assert.equal(env.pf.stats().queue, 0);
});

test('prefetch: warm не работает на парковке и без героя', () => {
  const env = makeEnv();
  const main = makeMain([10, 6]);
  env.pf.warm(main.activity);
  assert.equal(env.requests.length, 0, 'warm без смонтированного героя');
  env.hero.mount(main.activity);
  env.hero.detach(new FakeEl(['activity']));
  env.pf.warm(main.activity);
  assert.equal(env.requests.length, 0, 'warm на парковке');
});

/* ====================================================================== */
/* LRU деталей                                                            */
/* ====================================================================== */

test('prefetch: LRU деталей — 40 записей, 41-я вытесняет самую старую', () => {
  const env = makeEnv();
  const card = (id) => ({ id: id, title: 'f' + id });
  for (let id = 1; id <= 41; id++) {
    env.pf.details(card(id), () => {}, () => {});
    answer(env.requests[env.requests.length - 1], { id: id });
  }
  const got = [];
  env.pf.details(card(41), (j) => got.push(j.id), () => {});
  env.pf.details(card(2), (j) => got.push(j.id), () => {});
  assert.deepEqual(got, [41, 2], 'свежие детали не из памяти');
  const before = env.requests.length;
  env.pf.details(card(1), (j) => got.push(j.id), () => {});
  assert.equal(env.requests.length, before + 1, 'вытесненная запись отдана из памяти');
});

test('prefetch: ошибка деталей в память не пишется и доходит до всех, кто ждал', () => {
  const env = makeEnv();
  const card = { id: 7, title: 'x' };
  const errs = [];
  env.pf.details(card, () => {}, () => errs.push('a'));
  env.pf.details(card, () => {}, () => errs.push('b'));
  assert.equal(env.requests.length, 1, 'одинаковые запросы в пути не склеены');
  fail(env.requests[0]);
  assert.deepEqual(errs, ['a', 'b']);
  env.pf.details(card, () => {}, () => {});
  assert.equal(env.requests.length, 2, 'ошибка закэширована');
});

/* ====================================================================== */
/* Ревью H1: запрос, который Lampa отменила молча                          */
/* ====================================================================== */

/* network.clear() Lampa очищает список вызовов, и колбэки отменённого
   запроса не приходят НИКОГДА (vendor/lampa/app.min.js:20283; поиск зовёт
   clear на каждом запросе и при закрытии, :41336-41339, :41369-41375;
   Api.clear() — :23277, :44784). Без своего срока запись в flight и место
   в лимите висели до конца сеанса: два таких запроса — предзагрузка
   мертва, а герой этого фильма навсегда со скелетоном меты. Репро
   ревьюера — scratchpad/fullrev/hero/test/zz_orphan.test.mjs. */
const SEND_LIMIT = 12000;

/* Запрос окна, который Lampa отменила: колбэков у него не будет. */
function orphanWindow(env, main) {
  focus(main, main.rows[0][0]);
  env.advance(400);
  drain(env);
  env.advance(1000);
  focus(main, main.rows[0][1]);
  env.advance(250);
  const lost = pending(env).map((r) => idOf(r.url));
  assert.ok(lost.length > 0, 'подготовка: в пути есть запросы окна');
  pending(env).forEach((r) => { r.done = true; });
  return lost;
}

test('ревью H1: молча отменённый запрос через 12 с отдаёт место в лимите и ключ — окно снова грузит', () => {
  const { env, main } = mounted();
  const lost = orphanWindow(env, main);
  assert.equal(env.pf.stats().fly, lost.length, 'подготовка: осиротевшие запросы держат места');
  env.advance(SEND_LIMIT - 1);
  assert.equal(env.pf.stats().fly, lost.length, 'срок сработал раньше 12 с');
  env.advance(1);
  assert.equal(env.pf.stats().fly, 0, 'место осиротевшего запроса не освободилось');

  /* Ключ свободен: окно, в которое попал тот же фильм, просит его снова. */
  const before = env.requests.filter((r) => idOf(r.url) === lost[0]).length;
  env.advance(1000);
  focus(main, main.rows[0][lost[0] - 101]);
  env.advance(250);
  env.advance(DELAY);
  assert.equal(env.requests.filter((r) => idOf(r.url) === lost[0]).length, before + 1, 'детали фильма больше не запрашиваются');
  assert.deepEqual(warnLog, []);
});

test('ревью H1: ответ, доехавший после срока, чужой — в память не пишется и ждущих второй раз не зовёт', () => {
  const env = makeEnv();
  const card = { id: 7, title: 'x' };
  const got = [];
  env.pf.details(card, (j) => got.push('ok'), () => got.push('err'));
  const req = env.requests[0];
  env.advance(SEND_LIMIT);
  assert.deepEqual(got, ['err'], 'по сроку ждущий получает отказ');
  req.ok({ id: 7 });
  assert.deepEqual(got, ['err'], 'поздний ответ позвал ждущего второй раз');
  env.pf.details(card, () => {}, () => {});
  assert.equal(env.requests.length, 2, 'поздний ответ лёг в память');
});

test('ревью H1: ответ в срок снимает таймер срока — лишнего отказа нет', () => {
  const env = makeEnv();
  const got = [];
  env.pf.details({ id: 8, title: 'y' }, () => got.push('ok'), () => got.push('err'));
  answer(env.requests[0], { id: 8 });
  env.advance(SEND_LIMIT * 2);
  assert.deepEqual(got, ['ok']);
  assert.equal(env.timers.filter((t) => !t.done && t.ms === SEND_LIMIT).length, 0, 'таймер срока остался жить');
});

test('ревью H1: герой, вставший на осиротевший запрос соседа, по сроку снимает скелетон, а следующий показ просит детали заново', () => {
  const { env, main, node } = mounted();
  const lost = orphanWindow(env, main);
  const target = lost[0];
  const el = main.rows[0].find((c) => c.card_data.id === target);
  env.advance(1000);
  focus(main, el);
  /* Показ через DELAY, вывод текста — через SWAP_MS (180 мс) после него. */
  env.advance(DELAY);
  env.advance(200);
  assert.equal(pending(env).filter((r) => idOf(r.url) === target).length, 0, 'подготовка: герой склеился с запросом в пути');
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'подготовка: герой ждёт детали');
  env.advance(SEND_LIMIT - 1000 - DELAY - 200 - 1);
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'срок сработал раньше 12 с от запроса');
  env.advance(1);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'скелетон меты висит после срока');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · ★ 7.0', 'то, что дала карточка ряда');

  /* Уход и возврат: запрос деталей того же фильма уходит заново. */
  env.advance(1000);
  focus(main, main.rows[0][5]);
  env.advance(1000);
  drain(env, target);
  env.advance(1000);
  focus(main, el);
  env.advance(DELAY);
  assert.ok(pending(env).some((r) => idOf(r.url) === target), 'детали фильма не запрошены заново');
});

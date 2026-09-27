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

/* Этап 2в: пустая GIF, которой герой отменяет загрузки (BLANK в src/48_hero.js). */
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
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
/* Этап 2а, п.3: ряд выше — соседний узел перед рядом (jQuery prev). */
if (!FakeEl.prototype.prev) {
  FakeEl.prototype.prev = function () {
    const p = this._parentEl;
    if (!p) return { length: 0 };
    return p._children[p._children.indexOf(this) - 1] || { length: 0 };
  };
}
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
  /* Отмена загрузки в браузере — замена src на пустую GIF в data: (этап 2в:
     removeAttribute('src') оставлял отсоединённый <img> в памяти Chromium);
     снятие атрибута — ошибка теста. */
  Object.defineProperty(FakeImage.prototype, 'src', {
    configurable: true,
    get() { return this._src; },
    set(v) { this._src = v; if (v === BLANK) this.removed = true; }
  });
  FakeImage.prototype.removeAttribute = function (name) {
    throw new Error('removeAttribute(' + name + '): отмена загрузки — только src = BLANK');
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
    /* Раунд «Цвет сразу»: цвет фильма (src/57_color.js) — заглушка теста;
       без неё дорожки цвета нет вовсе. */
    accent: opts.accent,
    /* Раунд C, E3: сравнение «кадр ≈ постер» (src/57_thumbs.js) — заглушка
       теста; без неё дорожки вердиктов нет вовсе. */
    thumbs: opts.thumbs,
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
  /* Раунд «без ожидания», п.1: первой — сама карточка под фокусом (108),
     потом соседи. Оркестровка простоя, O1: она — мимо лимита SLOTS, оба
     места — соседям. */
  assert.deepEqual(env.requests.map((r) => idOf(r.url)), [108, 109, 110], 'покой фокуса — первые запросы окна');
  assert.deepEqual(warnLog, []);
});

test('prefetch: мышь заводит окно так же, как пульт', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2], 'hover:hover');
  env.advance(100);
  focus(main, main.rows[0][3], 'hover:hover');
  env.advance(250);
  assert.deepEqual(env.requests.map((r) => idOf(r.url)), [104, 105, 106]);
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

test('prefetch: порядок окна в «Лёгких» — +1…+3, −1 и три карточки ряда ниже от той, куда встанет фокус (фокуса там не было — первые)', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  /* Этап 2в: вперёд в «Лёгких» — +3 (было +2). */
  assert.deepEqual(drain(env, 104), [105, 106, 107, 103, 201, 202, 203]);
});

test('prefetch: порядок окна в «Полном» — +1…+3, −1…−2 и ряд ниже от цели', () => {
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
  assert.deepEqual(drain(env, 105), [104, 103, 102, 106, 201, 202, 203]);
});

test('prefetch: край ряда и последний ряд — только то, что есть', () => {
  const { env, main } = mounted({ sizes: [3, 2] });
  focus(main, main.rows[1][0]);
  env.advance(100);
  focus(main, main.rows[1][1]);
  env.advance(250);
  assert.deepEqual(drain(env, 202), [201, 101], 'вперёд некуда, следующего ряда нет; выше — первая карточка (фокуса там не было)');
});

/* ====================================================================== */
/* Очередь: не больше двух, герой — вне очереди, склейка                   */
/* ====================================================================== */

test('prefetch: одновременно в пути не больше двух запросов соседей; детали карточки под фокусом — сверх лимита', () => {
  const { env, main } = mounted({ mode: 'full' });
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  /* Оркестровка простоя, O1: сама карточка (104) — мимо SLOTS, два места —
     соседям, в очереди — остальные 6 из 8. */
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [104, 105, 106]);
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 6, hits: 0 });
  answer(pending(env)[0], {});
  assert.equal(pending(env).length, 2, 'ответ карточки под фокусом место соседа не освобождает');
  answer(pending(env)[0], {});
  assert.equal(pending(env).length, 2, 'освободилось место соседа — ушёл ровно один следующий');
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 5, hits: 0 });
});

test('prefetch: собственный запрос героя идёт сверх лимита, в обход очереди', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(250);
  /* Оркестровка простоя, O1: сама карточка — сверх лимита, оба места — соседям. */
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [104, 105, 106], 'подготовка: оба места заняты предзагрузкой, первой — сама карточка');
  /* Запрос карточки под фокусом не доехал — показу нужен свой, и оба места
     предзагрузки заняты соседями. */
  fail(pending(env)[0]);
  assert.equal(pending(env).length, 2, 'подготовка: место занял следующий сосед');
  /* Раунд «Листание», F1: нажатие через 100 мс после прошлого — серия,
     показ героя через BURST_DELAY, а предзагрузка соседей — как прежде,
     после 250 мс покоя. */
  env.advance(DELAY - 250);
  assert.equal(pending(env).length, 2, 'серия нажатий: через DELAY показа героя ещё нет');
  env.advance(BURST_DELAY - DELAY);
  assert.equal(pending(env).length, 3, 'показ героя ждал очереди предзагрузки');
  assert.equal(idOf(pending(env)[2].url), 104);
});

/* Раунд «без ожидания», п.1: карточка под фокусом — первой в очереди
   предзагрузки, а показ склеивается с её запросом и логотипом: второго
   запроса нет, и логотип, доехавший к выводу, встаёт в первом же выводе. */
test('без ожидания: карточка под фокусом — первой в очереди; показ берёт её детали и логотип без второго запроса', () => {
  const { env, main, node } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(400);
  drain(env);
  env.advance(1000);
  /* Серия из четырёх нажатий шагом 150 мс: 104…107 — в окно 103 (+3,
     этап 2в; было +2 и три нажатия) 107 не входит. */
  focus(main, main.rows[0][3]);
  env.advance(150);
  focus(main, main.rows[0][4]);
  env.advance(150);
  focus(main, main.rows[0][5]);
  env.advance(150);
  focus(main, main.rows[0][6]);
  env.advance(249);
  const before = env.requests.filter((r) => idOf(r.url) === 107).length;
  env.advance(1);
  const mine = pending(env).filter((r) => idOf(r.url) === 107);
  assert.equal(before, 0, 'подготовка: 107 раньше не запрашивалась');
  assert.equal(mine.length, 1, 'детали карточки под фокусом не запрошены через IDLE');
  assert.equal(idOf(pending(env)[0].url), 107, 'карточка под фокусом не первая');
  answer(mine[0], withLogo(107, { runtime: 100 }));
  assert.equal(logoImgs(env, 107).length, 1, 'логотип карточки под фокусом не пошёл следом за деталями');
  land(logoImgs(env, 107)[0]);
  env.advance(BURST_DELAY - 250);
  assert.equal(env.requests.filter((r) => idOf(r.url) === 107).length, 1, 'показ запросил детали второй раз');
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип не встал в первом выводе показа');
  assert.equal(node.find('.lumen-hero__title').text(), '');
  assert.deepEqual(warnLog, []);
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
  /* Раунд «без ожидания», п.1: карточка под фокусом (104) — своим запросом,
     сверх лимита (оркестровка простоя, O1); места — логотип 105 и 106. */
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [104, 106], 'детали следующего соседа обогнали логотип');
  assert.deepEqual(env.pf.stats(), { fly: 2, queue: 5, hits: 0 }, 'в очереди — остаток окна «Лёгких» (+3 вперёд — этап 2в)');
  assert.equal(env.hero.logoState('/l105.png'), 'load');
  land(logoImgs(env, 105)[0]);
  assert.equal(env.hero.logoState('/l105.png'), 'ok');
  assert.deepEqual(pending(env).map((r) => idOf(r.url)), [104, 106, 107], 'место логотипа занял следующий');
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
  /* Окно 106: 107 (детали уже в памяти — ответ прошлого окна), 108, 109,
     105 (назад) и следующий ряд. */
  answer(pending(env).find((r) => idOf(r.url) === 108), withLogo(108));
  land(logoImgs(env, 108)[0]);
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
  /* В пути — 104 (карточка прошлого окна) и 105 (её сосед). */
  answer(pending(env).find((r) => idOf(r.url) === 105), withLogo(105));
  assert.equal(logoImgs(env, 105).length, 0, 'ответ прошлого окна завёл загрузку логотипа посреди листания');
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
  answer(pending(env).find((r) => idOf(r.url) === 104), withLogo(104));
  /* Оркестровка простоя, O1: 104 — запрос карточки под фокусом мимо
     лимита, место соседа (106) доживает до своего ответа. */
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
   ревьюера — scratchpad/fullrev/hero/test/zz_orphan.test.mjs.
   Следующий раунд, п.6: срок 25 с, а не 12 — при прокси TMDB через
   зеркала CUB Lampa по таймауту одного зеркала пробует следующее
   (app.min.js:33500-33520), и живой ответ приходит позже 12 с. */
const SEND_LIMIT = 25000;

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

test('ревью H1: молча отменённый запрос через 25 с отдаёт место в лимите и ключ — окно снова грузит', () => {
  const { env, main } = mounted();
  const lost = orphanWindow(env, main);
  assert.equal(env.pf.stats().fly, lost.length, 'подготовка: осиротевшие запросы держат места');
  env.advance(SEND_LIMIT - 1);
  assert.equal(env.pf.stats().fly, lost.length, 'срок сработал раньше 25 с');
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
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'срок сработал раньше 25 с от запроса');
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

/* ====================================================================== */
/* Раунд «Цвет сразу» (2026-09-26): цвет соседей — заранее, в простое.     */
/* ====================================================================== */

/* Жалоба: «фон адаптируется не сразу». Герой ставит цвет вместе с кадром
   фильма (src/48_hero.js), а посчитан он к этому мигу потому, что
   предзагрузка ведёт свою дорожку: карточка под фокусом и её окно, по
   одному, в простое браузера (в тестах requestIdleCallback нет — шаг
   COLOR_GAP через setTimeout). Раунд C, C3: цвет фильма — низ его КАДРА,
   поэтому карточка считается, только когда её кадр решён (детали в памяти;
   LC.thumbs в этих тестах нет — кадр решает heroBackdrop), и считается
   prepareFrame(кадр); кадра нет — prepare (постер). Заглушка LC.accent:
   расчёт ставит задачу, тест сам говорит «посчитано»; calls — расчёты
   дорожки, hero — заказы самого героя (без done). */
const COLOR_GAP = 50;

function fakeAccent() {
  const acc = { calls: [], frames: [], hero: [], jobs: [], ready: {}, applied: [] };
  const job = (card, path, done) => {
    if (typeof done !== 'function') { acc.hero.push(path); return null; }
    acc.calls.push(card.id);
    acc.frames.push(path);
    const j = { id: card.id, cancelled: false, finish: () => { acc.ready[card.id] = true; done(); } };
    acc.jobs.push(j);
    return { cancel: () => { j.cancelled = true; } };
  };
  acc.prepare = (card, done) => job(card, '', done);
  acc.prepareFrame = (path, done, card) => job(card, path, done);
  acc.known = (card) => !!acc.ready[card.id];
  acc.knownFrame = () => false;
  acc.applyFor = (card) => { acc.applied.push(card && card.id); };
  /* Ключ цвета фильма — то же правило, что filmKey (src/57_color.js). */
  acc.key = (card) => ((!card.source || card.source === 'cub') ? 'tmdb' : card.source) + ':' + (card.media_type || (card.name ? 'tv' : 'movie')) + '/' + card.id;
  return acc;
}

/* Досчитывает дорожку до конца: задача за задачей, каждая следующая — после
   своего окна простоя. */
function drainColors(env, acc) {
  for (let guard = 0; guard < 20; guard++) {
    const job = acc.jobs.find((j) => !j.cancelled && !acc.ready[j.id]);
    if (!job) break;
    job.finish();
    env.advance(COLOR_GAP);
  }
}

/* Детали карточек окна фокуса в памяти предзагрузки: фокус на card, покой,
   ответы на запросы окна. */
function warmDetails(env, main, card, acc) {
  const own = env.LC.accent;
  env.LC.accent = undefined;
  focus(main, card);
  env.advance(250);
  drain(env);
  env.advance(1000);
  drain(env);
  env.LC.accent = acc || own;
}

test('C3: дорожка цвета — низ решённого кадра; карточка под фокусом первой, потом окно; по одному и в простое', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  warmDetails(env, main, main.rows[0][1]);
  focus(main, main.rows[0][2]);
  env.advance(249);
  assert.deepEqual(acc.calls, [], 'раньше 250 мс покоя');
  env.advance(1);
  drain(env);
  assert.deepEqual(acc.calls, [], 'план есть, но расчёт ждёт простоя');
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [103], 'первой — карточка под фокусом');
  assert.deepEqual(acc.frames, ['/b103.jpg'], 'цвет — низ её кадра (prepareFrame), не постер');
  env.advance(1000);
  assert.deepEqual(acc.calls, [103], 'пока идёт расчёт, следующий не стартует');
  drainColors(env, acc);
  /* Окно в «Лёгких»: +3 вперёд (этап 2в), −1 назад, три карточки ряда ниже от цели. */
  assert.deepEqual(acc.calls, [103, 104, 105, 106, 102, 201, 202, 203]);
  assert.deepEqual(acc.frames, ['/b103.jpg', '/b104.jpg', '/b105.jpg', '/b106.jpg', '/b102.jpg', '/b201.jpg', '/b202.jpg', '/b203.jpg']);
  assert.deepEqual(warnLog, []);
});

test('C3: кадр ещё не решён (деталей нет) — цвет заранее не считается; детали пришли — считается', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  focus(main, main.rows[0][2]);
  env.advance(250);
  env.advance(COLOR_GAP * 4);
  assert.deepEqual(acc.calls, [], 'без деталей — ни постера, ни кадра заранее');
  const first = pending(env).find((r) => idOf(r.url) === 104);
  answer(first, {});
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [104], 'детали соседа пришли — его кадр решён, цвет считается');
  assert.deepEqual(acc.frames, ['/b104.jpg']);
});

test('C3: кадра у фильма нет — цвет постера (prepare), как прежде', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  for (const c of main.rows[0]) c.card_data.backdrop_path = '';
  warmDetails(env, main, main.rows[0][1]);
  focus(main, main.rows[0][2]);
  env.advance(250);
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [103]);
  assert.deepEqual(acc.frames, [''], 'кадра нет — постер');
});

test('цвет сразу: зажатая стрелка — ни одного расчёта цвета', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  warmDetails(env, main, main.rows[0][6]);
  for (let i = 0; i < 8; i++) {
    focus(main, main.rows[0][i]);
    env.advance(100);
  }
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [], 'при зажатой стрелке ушёл расчёт цвета');
  env.advance(150);
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [108], 'покой — карточка, где стрелку отпустили');
});

test('цвет сразу / C3: известный цвет и нерешённый кадр пропускаются, новое окно сбрасывает очередь, уход с главной снимает расчёт', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  warmDetails(env, main, main.rows[0][1]);
  acc.ready[104] = true;
  focus(main, main.rows[0][2]);
  env.advance(250);
  env.advance(COLOR_GAP);
  acc.jobs[0].finish();
  env.advance(COLOR_GAP);
  /* warmDetails — детали 101…105 (окно 102); 106 (+3 от 103, этап 2в) — нет. */
  assert.deepEqual(acc.calls, [103, 105], 'цвет 104 известен — пропущен; у 106 деталей нет — кадр не решён, ждёт');

  /* Фокус ушёл дальше: очередь старого окна (102, 201…) выброшена, и
     расчёт 105 в пути снят (оркестровка простоя, O2: прежде он доживал и
     держал дорожку — цвет карточки под фокусом ждал соседа прошлого окна). */
  focus(main, main.rows[0][6]);
  assert.equal(acc.jobs[1].cancelled, true, 'перевод фокуса не снял расчёт цвета прошлого окна');
  env.advance(250);
  drain(env);
  env.advance(COLOR_GAP);
  /* Раунд «без ожидания», п.1: детали самой карточки под фокусом (107)
     предзагрузка заказала первыми — её кадр решён, и её цвет — первый. */
  assert.deepEqual(acc.calls, [103, 105, 107], 'очередь нового окна: первой — карточка под фокусом');

  env.hero.unmount();
  assert.equal(acc.jobs[2].cancelled, true, 'уход с главной снял расчёт в пути');
  env.advance(5000);
  assert.deepEqual(acc.calls, [103, 105, 107], 'после ухода — ни одного расчёта');
});

/* Раунд правок финальной проверки, A9: повтор в очереди цвета — по ключу
   цвета фильма «источник:тип/id» (LC.accent.key), как у кэша цвета. Две
   карточки с одним id и типом из разных источников — разные фильмы. */
test('финал A9: очередь цвета различает источник — один id и тип из разных источников считаются оба', () => {
  const acc = fakeAccent();
  acc.known = (card) => !!acc.ready[acc.key(card)];
  const lane = (card, done) => {
    const key = acc.key(card);
    acc.calls.push(key);
    const job = { id: key, cancelled: false, finish: () => { acc.ready[key] = true; done(); } };
    acc.jobs.push(job);
    return { cancel: () => { job.cancelled = true; } };
  };
  acc.prepare = (card, done) => (typeof done === 'function' ? lane(card, done) : null);
  acc.prepareFrame = (path, done, card) => (typeof done === 'function' ? lane(card, done) : null);
  const { env, main } = mounted({ accent: acc });
  warmDetails(env, main, main.rows[0][1]);
  const twin = main.rows[0][3];
  twin.card_data = Object.assign({}, twin.card_data, { id: 103, source: 'ivi' });
  focus(main, main.rows[0][2]);
  env.advance(250);
  drain(env);
  env.advance(COLOR_GAP);
  drainColors(env, acc);
  assert.deepEqual(acc.calls.slice(0, 3), ['tmdb:movie/103', 'ivi:movie/103', 'tmdb:movie/105'], 'фильм другого источника с тем же id выпал из предрасчёта');
  assert.deepEqual(warnLog, []);
});

test('цвет сразу: запаркованная главная (открыта карточка) цвет соседей не считает', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  focus(main, main.rows[0][2]);
  env.advance(250);
  env.hero.detach(new FakeEl(['activity']));
  assert.equal(env.hero.parked(), true, 'подготовка: герой запаркован');
  env.advance(5000);
  assert.deepEqual(acc.calls, [], 'под открытой карточкой — ни одного расчёта');
});

/* ====================================================================== */
/* Раунд C, E3: дорожка вердиктов «кадр ≈ постер» соседей                  */
/* ====================================================================== */

/* Новый признак сравнения дороже прежнего (пара 24 мс против 6, CPU ×10),
   и сравнение карточки под фокусом на ТВ чаще не успевало бы к потолку
   героя (300 мс). Предзагрузка считает вердикты соседей заранее: по одной
   паре, в простое, после того как герой выбрал кадр своей карточки. */
const LOOK_RETRY = 120;
/* Часы тестов ставят новый таймер от КОНЦА шага advance: цепочку «повтор
   через LOOK_RETRY, затем простой» проходим мелкими шагами. */
function wait(env, ms) {
  for (let t = 0; t < ms; t += 10) env.advance(10);
}
const LOOK_VOTES = { vote_average: 5.3, vote_count: 4 };
const lookBd = (path) => Object.assign({ file_path: path, iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, LOOK_VOTES);
/* Детали с кадрами: ключевой арт /kN (в кандидаты не идёт) и два годных
   кадра /aN, /bN. */
const lookDetails = (id) => ({ id: id, backdrop_path: '/k' + id + '.jpg', images: { logos: [], backdrops: [lookBd('/k' + id + '.jpg'), lookBd('/a' + id + '.jpg'), lookBd('/b' + id + '.jpg')] } });

/* Этап 2а: как настоящий LC.thumbs (src/57_thumbs.js), та же пара в пути —
   одно сравнение: второй вопрос встаёт в ждущие (subs), отмена снимает
   своего ждущего, последний — само сравнение (cancelled). calls — только
   заведённые сравнения; urgent — срочное ли. */
function fakeLook() {
  const t = { calls: [], verdicts: {} };
  t.verdict = (p, f) => (Object.prototype.hasOwnProperty.call(t.verdicts, p + '|' + f) ? t.verdicts[p + '|' + f] : undefined);
  t.compare = (p, f, cb, urgent) => {
    let c = t.calls.find((x) => x.p === p && x.f === f && !x.done && !x.cancelled && (x.urgent || !urgent));
    if (!c) {
      c = { p: p, f: f, subs: [], cancelled: false, done: false, urgent: !!urgent };
      t.calls.push(c);
    }
    const sub = { cb: cb, live: true };
    c.subs.push(sub);
    return {
      cancel() {
        sub.live = false;
        if (!c.done && !c.subs.some((s) => s.live)) c.cancelled = true;
      }
    };
  };
  t.answer = (c, v) => {
    t.verdicts[c.p + '|' + c.f] = v;
    c.done = true;
    c.subs.forEach((s) => { if (s.live) { s.live = false; s.cb(v); } });
  };
  /* Этап 2а: миниатюры заранее (prime) — только запись. */
  t.primes = [];
  t.prime = (kind, path, urgent) => {
    const p = { kind: kind, path: path, urgent: !!urgent, cancelled: false };
    t.primes.push(p);
    return { cancel() { p.cancelled = true; } };
  };
  t.tone = () => ({ cancel() {} });
  t.toneOf = () => undefined;
  t.pairs = () => t.calls.map((c) => c.p.replace(/^\/p|\.jpg$/g, '') + ':' + c.f.replace(/^\/|\.jpg$/g, ''));
  return t;
}

/* Отвечает на все запросы деталей (соседей и героя) деталями с кадрами. */
function answerLooks(env) {
  for (let guard = 0; guard < 50; guard++) {
    const next = pending(env)[0];
    if (!next) break;
    answer(next, lookDetails(idOf(next.url)));
  }
}

test('E3: дорожка вердиктов — соседи окна по одной паре, после выбора кадра героем; карточку под фокусом не трогает', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answerLooks(env);
  env.advance(DELAY - 250);
  answerLooks(env);
  assert.deepEqual(th.pairs(), ['103:a103'], 'первой — пара карточки под фокусом (дорожка кадра, показ встаёт на неё — этап 2а)');
  wait(env, COLOR_GAP + LOOK_RETRY * 3);
  assert.deepEqual(th.pairs(), ['103:a103'], 'пока герой выбирает кадр, дорожка своих пар не заводит');
  th.answer(th.calls[0], false);
  wait(env, COLOR_GAP + LOOK_RETRY);
  assert.deepEqual(th.pairs(), ['103:a103', '104:a104'], 'после выбора — первый сосед по ходу');
  wait(env, 1000);
  assert.equal(th.calls.length, 2, 'следующая пара — только после ответа');
  th.answer(th.calls[1], true);
  wait(env, COLOR_GAP);
  assert.deepEqual(th.pairs().slice(2), ['104:b104'], 'похож — следующий кандидат того же соседа, как спросил бы герой');
  th.answer(th.calls[2], false);
  for (let guard = 0; guard < 10; guard++) {
    wait(env, COLOR_GAP);
    const open = th.calls.find((c) => th.verdict(c.p, c.f) === undefined && !c.cancelled);
    if (open) th.answer(open, false);
  }
  /* Окно «Лёгких»: +3 вперёд (этап 2в), −1 назад, три карточки ряда ниже от цели. */
  assert.deepEqual(th.pairs().slice(3), ['105:a105', '106:a106', '102:a102', '201:a201', '202:a202', '203:a203']);
  assert.deepEqual(warnLog, []);
});

test('E3: дорожка вердиктов — смена фокуса снимает пару в пути; при зажатой стрелке пар нет', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answerLooks(env);
  env.advance(DELAY - 250);
  answerLooks(env);
  th.answer(th.calls[0], false);
  wait(env, COLOR_GAP + LOOK_RETRY);
  const lane = th.calls[1];
  assert.equal(lane.p + '|' + lane.f, '/p104.jpg|/a104.jpg', 'предусловие: пара соседа в пути');
  const before = th.calls.length;
  for (let i = 3; i < 9; i++) {
    focus(main, main.rows[0][i]);
    env.advance(100);
  }
  assert.equal(lane.cancelled, true, 'уход фокуса снял сравнение соседа — canvas во время листания не работает');
  assert.equal(th.calls.length, before, 'при зажатой стрелке ни одной новой пары');
});

test('E3: вердикт соседа посчитан заранее — его показ выбирает кадр из памяти, без сравнения и потолка', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answerLooks(env);
  env.advance(DELAY - 250);
  answerLooks(env);
  th.answer(th.calls[0], false);
  wait(env, COLOR_GAP + LOOK_RETRY);
  th.answer(th.calls[1], true);
  wait(env, COLOR_GAP);
  th.answer(th.calls[2], false);
  const known = th.calls.length;
  /* Прошлое нажатие ближе BURST_GAP — показ через BURST_DELAY (серия). */
  focus(main, main.rows[0][3]);
  wait(env, BURST_DELAY);
  answerLooks(env);
  assert.equal(th.calls.filter((c) => c.p === '/p104.jpg').length, 2, 'герой не спрашивал пары соседа второй раз');
  assert.ok(th.calls.length >= known, 'дорожка дальше — своим ходом');
  assert.ok(env.images.some((i) => /\/w1280\/b104\.jpg$/.test(i.src)), 'кадр — второй кандидат, первый похож: ' + env.images.map((i) => i.src).join(' '));
  assert.ok(!env.images.some((i) => /\/w1280\/a104\.jpg$/.test(i.src)), 'похожий кадр не грузился');
});

/* Ревью rv4, RV4-1: дорожка вердиктов не просыпалась на детали соседа,
   заказанные прошлым окном (ответ несёт старое поколение) или самим героем
   (details). Репро ревьюера (scratchpad/final/rv4, zz_rv4_prefetch). */
test('RV4-1: детали соседа, заказанные прошлым окном, доехали — дорожка вердиктов его не пропускает', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  /* Окно карточки 103: детали самой 103 и соседа 104 уходят (SLOTS = 2;
     раунд «без ожидания», п.1 — карточка под фокусом первой). */
  focus(main, main.rows[0][2]);
  env.advance(260);
  const old105 = pending(env).find((r) => idOf(r.url) === 104);
  assert.ok(old105, 'предусловие: детали 104 заказаны окном 103');
  /* Шаг вправо через одну до показа 103: новое окно (105) — его сосед
     сзади, 104, в пути. */
  focus(main, main.rows[0][4]);
  env.advance(260);
  for (let round = 0; round < 2; round++) {
    for (let guard = 0; guard < 50; guard++) {
      const next = pending(env).find((r) => r !== old105);
      if (!next) break;
      answer(next, lookDetails(idOf(next.url)));
    }
    if (!round) wait(env, BURST_DELAY);
  }
  for (let guard = 0; guard < 40; guard++) {
    wait(env, COLOR_GAP + LOOK_RETRY);
    const open = th.calls.find((c) => th.verdict(c.p, c.f) === undefined && !c.cancelled);
    if (open) th.answer(open, false);
  }
  assert.ok(!th.pairs().some((p) => p.indexOf('104:') === 0), 'предусловие: 104 без деталей — пары нет: ' + th.pairs());
  answer(old105, lookDetails(104));
  wait(env, COLOR_GAP + LOOK_RETRY * 3);
  assert.ok(th.pairs().some((p) => p.indexOf('104:') === 0), 'сосед 104 (в окне 105) так и не получил вердикт: ' + th.pairs());
});

test('RV4-1: детали соседа пришли на запрос самого героя — дорожка вердиктов его не пропускает', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  /* Показ 103: герой сам заказал детали 103. */
  focus(main, main.rows[0][2]);
  env.advance(DELAY);
  const hero103 = pending(env).find((r) => idOf(r.url) === 103);
  assert.ok(hero103, 'предусловие: детали 103 заказал герой');
  /* Шаг влево: 103 — сосед окна 102, его детали в пути (запрос героя). */
  focus(main, main.rows[0][1]);
  env.advance(260);
  for (let round = 0; round < 2; round++) {
    for (let guard = 0; guard < 50; guard++) {
      const next = pending(env).find((r) => r !== hero103);
      if (!next) break;
      answer(next, lookDetails(idOf(next.url)));
    }
    if (!round) wait(env, BURST_DELAY);
  }
  for (let guard = 0; guard < 40; guard++) {
    wait(env, COLOR_GAP + LOOK_RETRY);
    const open = th.calls.find((c) => th.verdict(c.p, c.f) === undefined && !c.cancelled);
    if (open) th.answer(open, false);
  }
  assert.ok(!th.pairs().some((p) => p.indexOf('103:') === 0), 'предусловие: у 103 деталей нет — пары нет: ' + th.pairs());
  answer(hero103, lookDetails(103));
  wait(env, COLOR_GAP + LOOK_RETRY * 3);
  assert.ok(th.pairs().some((p) => p.indexOf('103:') === 0), 'сосед 103 так и не получил вердикт: ' + th.pairs());
});

test('C3: сосед с кадром, похожим на постер, — цвет ждёт ответа сравнения и считается от выбранного кадра', () => {
  const acc = fakeAccent();
  const th = fakeLook();
  const { env, main } = mounted({ accent: acc, thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answerLooks(env);
  wait(env, DELAY - 250);
  answerLooks(env);
  th.answer(th.calls[0], false);
  wait(env, COLOR_GAP + LOOK_RETRY);
  const laneColor = acc.calls.filter((id) => id === 104);
  assert.deepEqual(laneColor, [], 'кадр 104 не решён (сравнение в пути) — цвет не считается');
  th.answer(th.calls[1], true);
  wait(env, COLOR_GAP);
  th.answer(th.calls[2], false);
  wait(env, COLOR_GAP * 3);
  drainColors(env, acc);
  const at = acc.calls.indexOf(104);
  assert.ok(at !== -1, 'кадр решён — цвет посчитан: ' + acc.calls);
  assert.equal(acc.frames[at], '/b104.jpg', 'цвет — низ ВЫБРАННОГО кадра (второй кандидат), а не первого');
});

/* ====================================================================== */
/* Дорожка кадра (одна на полосы hero и images, 2026-09-27): байты кадра  */
/* — карточке под фокусом сразу, следующей по ходу — потом                 */
/* ====================================================================== */

const w1280 = (env, id) => env.images.filter((i) => i.src === 'https://img/t/p/w1280/b' + id + '.jpg');
/* Загрузки дорожки — не кадр самого показа: у показа fetchPriority 'high'
   (loadFrame), у дорожки — 'auto' под фокусом и 'low' у соседа. */
const lane1280 = (env, id) => w1280(env, id).filter((i) => i.fetchPriority !== 'high');
const w300 = (env, id) => env.images.filter((i) => i.src === 'https://img/t/p/w300/b' + id + '.jpg');
const FRAME_AFTER = 900;

test('дорожка кадра: карточка под фокусом — сразу после деталей, с подложкой; следующая по ходу — после FRAME_AFTER и байтов кадра под фокусом, низкий приоритет, без подложки; дальние — нет', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(100);
  focus(main, main.rows[0][3]);
  env.advance(249);
  assert.equal(env.images.length, 0, 'до покоя фокуса кадры не грузятся');
  env.advance(1);
  assert.equal(lane1280(env, 104).length, 0, 'кадр до деталей: он ещё не решён');
  drain(env);
  const lead = lane1280(env, 104);
  assert.equal(lead.length, 1, 'кадр карточки под фокусом не загружен заранее');
  assert.equal(lead[0].fetchPriority, 'auto');
  assert.equal(lead[0].decoding, 'async');
  assert.equal(w300(env, 104).length, 1, 'подложка карточки под фокусом не загружена');
  assert.equal(w1280(env, 105).length, 0, 'кадр соседа — параллельно с кадром под фокусом');
  env.advance(FRAME_AFTER);
  assert.equal(w1280(env, 105).length, 0, 'кадр соседа до байтов кадра под фокусом');
  land(lead[0], 1280, 720);
  env.advance(1);
  const next = w1280(env, 105);
  assert.equal(next.length, 1, 'кадр следующей по ходу не загружен');
  assert.equal(next[0].fetchPriority, 'low');
  assert.equal(w300(env, 105).length, 0, 'подложка — только карточке под фокусом');
  assert.equal(w1280(env, 106).length + w1280(env, 103).length + w1280(env, 201).length, 0, 'кадры дальних соседей грузятся заранее');
  assert.deepEqual(warnLog, []);
});

test('дорожка кадра: байты кадра под фокусом доехали раньше — сосед всё равно не раньше FRAME_AFTER от перевода фокуса', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  /* Правки ревью rv7, Р3: второе нажатие — одиночное (покой не короче
     BURST_GAP): шаг 400 мс — медленная серия, в ней дорожка кадра ждёт
     LEAD_CALM, а предмет теста — одиночный шаг. */
  env.advance(700);
  drain(env);
  focus(main, main.rows[0][1]);
  env.advance(250);
  drain(env);
  land(lane1280(env, 102)[0], 1280, 720);
  env.advance(1);
  env.advance(FRAME_AFTER - 250 - 2);
  assert.equal(w1280(env, 103).length, 0, 'кадр соседа раньше FRAME_AFTER');
  env.advance(2);
  assert.equal(w1280(env, 103).length, 1, 'кадр соседа не пошёл в FRAME_AFTER');
  /* соседи назад (101) и дальше (104) кадр заранее не получают */
  assert.equal(w1280(env, 104).length, 0);
  assert.deepEqual(warnLog, []);
});

test('дорожка кадра: шаг вниз (в другой ряд) кадр соседа не грузит — только шаг по ряду; кадр карточки под фокусом — да', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  /* Правки ревью rv7, Р3: второе нажатие — одиночное (покой не короче
     BURST_GAP): шаг 400 мс — медленная серия, в ней дорожка кадра ждёт
     LEAD_CALM, а предмет теста — одиночный шаг. */
  env.advance(700);
  drain(env);
  focus(main, main.rows[1][0]);
  env.advance(250);
  drain(env);
  assert.equal(lane1280(env, 201).length, 1, 'кадр карточки под фокусом после шага вниз не загружен');
  land(lane1280(env, 201)[0], 1280, 720);
  env.advance(FRAME_AFTER);
  drain(env);
  assert.equal(w1280(env, 202).length, 0, 'шаг вниз завёл кадр соседа справа');
  /* дальше шаг вправо в этом ряду — кадр следующего соседа пошёл */
  focus(main, main.rows[1][1]);
  env.advance(250);
  drain(env);
  const lead = lane1280(env, 202);
  if (lead.length) land(lead[0], 1280, 720);
  env.advance(FRAME_AFTER);
  assert.equal(w1280(env, 203).length, 1, 'после шага по ряду кадр соседа не пошёл');
  assert.deepEqual(warnLog, []);
});

test('дорожка кадра: перевод фокуса до FRAME_AFTER снимает ожидание соседа; байты, сброшенные вытеснением, очередь не держат', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][0]);
  /* Правки ревью rv7, Р3: второе нажатие — одиночное (покой не короче
     BURST_GAP): шаг 400 мс — медленная серия, в ней дорожка кадра ждёт
     LEAD_CALM, а предмет теста — одиночный шаг. */
  env.advance(700);
  drain(env);
  focus(main, main.rows[0][1]);
  env.advance(250);
  drain(env);
  land(lane1280(env, 102)[0], 1280, 720);
  env.advance(300);
  /* ушли вниз раньше FRAME_AFTER — кадр 103 не грузится */
  focus(main, main.rows[1][0]);
  env.advance(FRAME_AFTER * 2);
  assert.equal(w1280(env, 103).length, 0, 'ожидание соседа пережило перевод фокуса');
  /* Кадр под фокусом не доехал и вытеснен — сосед идёт, дорожка не
     зависает на загрузке, которой больше нет. */
  const b = mounted();
  focus(b.main, b.main.rows[0][0]);
  b.env.advance(700);
  drain(b.env);
  focus(b.main, b.main.rows[0][1]);
  b.env.advance(250);
  drain(b.env);
  const lead = lane1280(b.env, 102)[0];
  assert.ok(lead, 'кадр под фокусом не заказан');
  b.env.hero.preloadFrame('/x1.jpg', true);
  b.env.hero.preloadFrame('/x2.jpg', true);
  assert.equal(lead.removed, true, 'вытесненный кадр под фокусом не снят');
  b.env.advance(FRAME_AFTER);
  assert.equal(w1280(b.env, 103).length, 1, 'дорожка ждёт снятую загрузку');
  assert.deepEqual(warnLog, []);
});

test('без ожидания, п.2: при зажатой стрелке и в «Выкл» кадры заранее не грузятся', () => {
  const { env, main } = mounted();
  for (let i = 0; i < 6; i++) {
    focus(main, main.rows[0][i]);
    env.advance(100);
  }
  assert.equal(env.images.filter((i) => /\/w1280\//.test(i.src)).length, 0, 'кадры при зажатой стрелке');
  const off = mounted({ mode: 'off' });
  focus(off.main, off.main.rows[0][2]);
  off.env.advance(100);
  focus(off.main, off.main.rows[0][3]);
  off.env.advance(250);
  drain(off.env);
  assert.equal(off.env.images.filter((i) => /\/w(1280|300)\/b/.test(i.src)).length, 0, 'в «Выкл» ушли кадры');
});

/* ====================================================================== */
/* Раунд «без лагов», этап 2а, п.1: кадр карточки под фокусом решается до  */
/* показа — сравнения с постером заводит дорожка кадра                     */
/* ====================================================================== */

const anyW1280 = (env) => env.images.filter((i) => /\/w1280\//.test(i.src));
const img1280 = (env, name) => env.images.filter((i) => i.src === 'https://img/t/p/w1280/' + name + '.jpg');

test('этап 2а, п.1: через IDLE покоя — детали, срочные пары по одной, байты w1280 выбранного кадра до показа; показ берёт готовое без второго сравнения', () => {
  const th = fakeLook();
  const acc = fakeAccent();
  const { env, main } = mounted({ thumbs: th, accent: acc });
  focus(main, main.rows[0][2]);
  env.advance(249);
  assert.equal(th.calls.length, 0, 'раньше 250 мс покоя');
  env.advance(1);
  const lead = pending(env).find((r) => idOf(r.url) === 103);
  assert.ok(lead, 'предусловие: детали карточки под фокусом заказаны');
  answer(lead, lookDetails(103));
  assert.deepEqual(th.pairs(), ['103:a103'], 'пару карточки под фокусом не завела дорожка');
  assert.equal(th.calls[0].urgent, true, 'пара карточки под фокусом — срочная (впереди задач простоя)');
  /* Этап 2в, п.2: до решения грузится только ставка — кадр кандидата,
     чей ответ ждёт выбор (обычно он и выбран). */
  assert.deepEqual(anyW1280(env).map((i) => i.src), ['https://img/t/p/w1280/a103.jpg'], 'до решения — только ставка на первый кандидат');
  const bet = img1280(env, 'a103')[0];
  th.answer(th.calls[0], true);
  assert.deepEqual(th.pairs(), ['103:a103', '103:b103'], 'похож — следующий кандидат той же карточки');
  assert.equal(anyW1280(env).length, 1, 'ставка на перевод фокуса — одна: второй кандидат наудачу не грузится');
  th.answer(th.calls[1], false);
  const early = img1280(env, 'b103');
  assert.equal(early.length, 1, 'байты выбранного кадра не заказаны');
  assert.equal(early[0].fetchPriority, 'auto');
  assert.equal(w300(env, 103).length, 1, 'подложка выбранного кадра не заказана');
  /* Этап 2в, п.2: ставка мимо — её недоехавшие байты сняты и в сети. */
  assert.equal(bet.removed, true, 'похожий кадр (ставка мимо) грузится дальше');
  assert.equal(img1280(env, 'a103').length, 0, 'похожий кадр грузится');
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls.slice(0, 1), [103], 'кадр решён — цвет его низа ждёт показа');
  assert.equal(acc.frames[0], '/b103.jpg');
  env.advance(DELAY - 250 - COLOR_GAP);
  assert.equal(th.calls.length, 2, 'показ спросил пары второй раз');
  const shown = img1280(env, 'b103').filter((i) => i.fetchPriority === 'high');
  assert.equal(shown.length, 1, 'показ грузит не тот кадр, что решила дорожка');
  assert.deepEqual(warnLog, []);
});

test('этап 2а, п.1: пара ещё в пути — показ встаёт на неё, ответ решает и дорожку, и показ одним кадром; перевод фокуса снимает сравнение', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  env.advance(DELAY - 250);
  assert.equal(th.calls.length, 1, 'показ завёл второе сравнение той же пары');
  assert.equal(th.calls[0].subs.filter((s) => s.live).length, 2, 'показ не встал на пару в пути');
  th.answer(th.calls[0], false);
  assert.equal(img1280(env, 'a103').filter((i) => i.fetchPriority !== 'high').length, 1, 'дорожка не взяла кадр');
  assert.equal(img1280(env, 'a103').filter((i) => i.fetchPriority === 'high').length, 1, 'показ не взял тот же кадр');
  assert.equal(img1280(env, 'b103').length, 0);

  const th2 = fakeLook();
  const b = mounted({ thumbs: th2 });
  focus(b.main, b.main.rows[0][2]);
  b.env.advance(250);
  answer(pending(b.env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.equal(th2.calls.length, 1, 'предусловие: пара в пути');
  focus(b.main, b.main.rows[0][3]);
  assert.equal(th2.calls[0].cancelled, true, 'перевод фокуса не снял сравнение карточки, с которой ушли');
  assert.deepEqual(warnLog, []);
});

test('этап 2а, п.1: в серии нажатий — ни одного сравнения и ни одной загрузки; в пути не больше одного решения', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  for (let i = 0; i < 6; i++) {
    focus(main, main.rows[0][i]);
    env.advance(150);
    answerLooks(env);
  }
  assert.equal(th.calls.length, 0, 'сравнение в серии нажатий');
  assert.equal(anyW1280(env).length, 0, 'кадр в серии нажатий');
  env.advance(100);
  answerLooks(env);
  wait(env, 400);
  answerLooks(env);
  assert.deepEqual(th.pairs(), ['106:a106'], 'после покоя — одна пара карточки под фокусом, и только она');
  assert.equal(th.calls[0].subs.length, 1, 'ответы деталей соседей завели второе ожидание той же пары');
  focus(main, main.rows[0][6]);
  assert.equal(th.calls[0].cancelled, true, 'перевод фокуса снял не всё');
  assert.deepEqual(warnLog, []);
});

test('этап 2а, п.1: ответ не лёг в память (миниатюра не доехала) — дорожка ту же карточку не спрашивает, кадр выбирает показ', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  const c = th.calls[0];
  c.done = true;
  c.subs.forEach((s) => { if (s.live) { s.live = false; s.cb(null); } });
  env.advance(50);
  assert.equal(th.calls.length, 1, 'дорожка повторила пару без знания — ещё одна загрузка');
  /* Этап 2в, п.2: решённого дорожкой кадра нет — есть только ставка на
     первый кандидат, и она не снимается: выбирать будет показ. */
  assert.deepEqual(anyW1280(env).map((i) => i.src + ':' + i.removed), ['https://img/t/p/w1280/a103.jpg:false'], 'кадр выбран без ответа');
  env.advance(DELAY - 300);
  assert.equal(th.calls.length, 2, 'показ не спросил сам');
  th.answer(th.calls[1], false);
  assert.equal(img1280(env, 'a103').filter((i) => i.fetchPriority === 'high').length, 1, 'кадр показа не выбран');
  assert.deepEqual(warnLog, []);
});

test('этап 2а, п.1: миниатюры заранее — постер вместе с запросом деталей, все кандидаты по ответу деталей, срочно; известная пара не трогается; перевод фокуса снимает', () => {
  const th = fakeLook();
  th.verdicts['/p103.jpg|/b103.jpg'] = false;
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(249);
  assert.deepEqual(th.primes, [], 'миниатюры до покоя фокуса');
  env.advance(1);
  assert.deepEqual(th.primes.map((p) => p.kind + ':' + p.path + ':' + p.urgent), ['poster:/p103.jpg:true'], 'постер — вместе с запросом деталей, срочно');
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.deepEqual(th.primes.slice(1).map((p) => p.kind + ':' + p.path + ':' + p.urgent), ['frame:/a103.jpg:true'],
    'кандидаты — по ответу деталей, срочно; пара с известным ответом (b103) не грузится');
  assert.deepEqual(th.pairs(), ['103:a103'], 'сравнение первой пары — сразу');
  focus(main, main.rows[0][3]);
  assert.ok(th.primes.every((p) => p.cancelled), 'перевод фокуса не снял миниатюры');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Раунд «без лагов», этап 2в, п.2: байты w1280 первого кандидата — наудачу, */
/* пока идут сравнения с постером                                          */
/* ====================================================================== */

const img300 = (env, name) => env.images.filter((i) => i.src === 'https://img/t/p/w300/' + name + '.jpg');

test('этап 2в, п.2: сравнение в пути — кадр и подложка его кандидата наудачу, обычный приоритет, без decode; угадали — решение и показ встают на ту же загрузку', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  assert.equal(anyW1280(env).length, 0, 'ставка до деталей: кандидатов ещё нет');
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.deepEqual(th.pairs(), ['103:a103'], 'предусловие: пара в пути');
  const bet = img1280(env, 'a103');
  assert.equal(bet.length, 1, 'байты кандидата, чей ответ ждёт выбор, не заказаны наудачу');
  assert.equal(bet[0].fetchPriority, 'auto', 'ставка — обычный приоритет (показ грузит свой кадр с high)');
  assert.equal(bet[0].decoding, 'async');
  assert.equal(typeof bet[0].decodeCalled, 'undefined', 'decode() у ставки');
  assert.equal(img300(env, 'a103').length, 1, 'подложка ставки не заказана');
  th.answer(th.calls[0], false);
  assert.equal(img1280(env, 'a103').filter((i) => i.fetchPriority !== 'high').length, 1, 'решение дорожки завело вторую загрузку того же кадра');
  assert.equal(bet[0].removed, false, 'угаданная ставка снята');
  env.advance(DELAY - 250);
  assert.equal(img1280(env, 'a103').filter((i) => i.fetchPriority === 'high').length, 1, 'показ грузит не угаданный кадр');
  assert.equal(anyW1280(env).filter((i) => !/a103/.test(i.src)).length, 0, 'лишние кадры');
  assert.deepEqual(warnLog, []);
});

test('этап 2в, п.2: фокус ушёл до решения — недоехавшие кадр и подложка ставки сняты и в сети; доехавшие остаются в памяти', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  const bet = img1280(env, 'a103')[0];
  const low = img300(env, 'a103')[0];
  assert.ok(bet && low, 'предусловие: ставка в пути');
  focus(main, main.rows[0][3]);
  assert.equal(bet.removed, true, 'перевод фокуса не снял кадр ставки');
  assert.equal(low.removed, true, 'перевод фокуса не снял подложку ставки');

  const th2 = fakeLook();
  const b = mounted({ thumbs: th2 });
  focus(b.main, b.main.rows[0][2]);
  b.env.advance(250);
  answer(pending(b.env).find((r) => idOf(r.url) === 103), lookDetails(103));
  const bet2 = img1280(b.env, 'a103')[0];
  land(bet2, 1280, 720);
  focus(b.main, b.main.rows[0][3]);
  assert.equal(bet2.removed, false, 'доехавшая ставка снята — байты выброшены');
  /* Вернулись раньше показа: те же байты из памяти, без второй загрузки. */
  focus(b.main, b.main.rows[0][2]);
  b.env.advance(250);
  assert.equal(img1280(b.env, 'a103').filter((i) => i.fetchPriority !== 'high').length, 1, 'вторая загрузка того же кадра');
  assert.deepEqual(warnLog, []);
});

test('этап 2в, п.2: выбор решён из памяти (ответы сравнения известны) — ставки нет, грузится решённый кадр', () => {
  const th = fakeLook();
  th.verdicts['/p103.jpg|/a103.jpg'] = true;
  th.verdicts['/p103.jpg|/b103.jpg'] = false;
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.equal(th.calls.length, 0, 'сравнение при известных ответах');
  assert.deepEqual(anyW1280(env).map((i) => i.src), ['https://img/t/p/w1280/b103.jpg'], 'ставка при решённом выборе');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Раунд «без лагов», этап 2а, п.3: цель вверх/вниз — карточка, куда       */
/* Lampa поставит фокус (последняя посещённая в ряду, иначе первая)        */
/* ====================================================================== */

test('этап 2а, п.3: окно берёт в рядах выше и ниже последнюю посещённую карточку — туда Lampa вернёт фокус, — а не первые карточки ряда', () => {
  const { env, main } = mounted();
  /* Серия без покоя: деталей никто не просил, но посещения помнятся. */
  for (let i = 0; i < 5; i++) {
    focus(main, main.rows[0][i]);
    env.advance(100);
  }
  focus(main, main.rows[1][4]);
  env.advance(100);
  focus(main, main.rows[2][2]);
  env.advance(100);
  focus(main, main.rows[1][2]);
  env.advance(250);
  /* 203: вперёд 204, 205, 206 (этап 2в: +3), назад 202, ниже — от 303
     (был фокус): 303, 304 (дальше ряда нет), выше — 105. */
  const order = drain(env, 203);
  assert.deepEqual(order, [204, 205, 206, 202, 303, 304, 105], 'окно: ' + order);
  assert.deepEqual([101, 102, 103, 301, 302].filter((id) => order.indexOf(id) !== -1), [], 'первые карточки рядов, куда фокус не встанет');
  assert.deepEqual(warnLog, []);
});

test('этап 2а, п.3: в ряду без посещений — первая карточка (туда Lampa ставит фокус); stop забывает посещения', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][3]);
  env.advance(100);
  focus(main, main.rows[1][1]);
  env.advance(250);
  assert.deepEqual(drain(env, 202), [203, 204, 205, 201, 301, 302, 303, 104], 'ряд ниже без посещений — от первой карточки, выше — посещённая');
  env.pf.stop();
  focus(main, main.rows[1][3]);
  env.advance(250);
  const order = drain(env, 204);
  assert.ok(order.indexOf(101) !== -1 && order.indexOf(104) === -1, 'после stop посещения прошлой главной остались: ' + order);
});

/* ====================================================================== */
/* Раунд «без лагов», этап 2в, п.1: показ после серии — раньше BURST_DELAY, */
/* если серия кончилась и для карточки всё уже в памяти                   */
/* ====================================================================== */

/* Карточка готова к показу: детали в памяти предзагрузки (логотипов у
   фильма нет — название текстом, ждать нечего), ответ сравнения первого
   кандидата с постером известен (кадр решён — /aN), байты w1280 и
   подложки этого кадра доехали. bytes: false — без байтов кадра, 'late' —
   байты заказаны, но ещё едут (вернёт их картинки). logo — у фильма есть
   логотип, его в памяти нет. */
function readyCard(env, th, main, r, i, opts) {
  opts = opts || {};
  const card = main.rows[r][i].card_data;
  const d = lookDetails(card.id);
  if (opts.logo) d.images.logos = [{ file_path: '/l' + card.id + '.png', iso_639_1: 'ru' }];
  env.pf.details(card, () => {}, () => {});
  const req = pending(env).find((q) => idOf(q.url) === card.id);
  if (req) answer(req, d);
  th.verdicts['/p' + card.id + '.jpg|/a' + card.id + '.jpg'] = false;
  if (opts.bytes === false) return null;
  env.hero.preloadFrame('/a' + card.id + '.jpg', false);
  const imgs = env.images.filter((x) => x.src === 'https://img/t/p/w1280/a' + card.id + '.jpg' || x.src === 'https://img/t/p/w300/a' + card.id + '.jpg');
  if (opts.bytes === 'late') return imgs;
  imgs.forEach((x) => land(x, 1280, 720));
  return null;
}

/* Чей фильм на герое — по описанию (данные ряда: «о N»). */
const shownOf = (node) => node.find('.lumen-hero__descr').text();

test('этап 2в, п.1: серия 3 × 150 мс кончилась на готовой карточке — показ через 300 мс покоя (вдвое дольше шага), а не через BURST_DELAY', () => {
  const th = fakeLook();
  const { env, main, node } = mounted({ thumbs: th });
  focus(main, main.rows[0][0]);
  wait(env, 1500);
  readyCard(env, th, main, 0, 4);
  focus(main, main.rows[0][2]);
  env.advance(150);
  focus(main, main.rows[0][3]);
  env.advance(150);
  focus(main, main.rows[0][4]);
  env.advance(299);
  assert.equal(shownOf(node), 'о 101', 'раньше, чем серия кончилась (300 мс покоя при шаге 150)');
  env.advance(1);
  assert.equal(shownOf(node), 'о 105', 'готовая карточка ждёт BURST_DELAY');
  assert.equal(env.requests.filter((q) => idOf(q.url) === 105).length, 1, 'показ пошёл за деталями второй раз');
  assert.deepEqual(warnLog, []);
});

test('этап 2в, п.1: не готова — показ, как прежде, через BURST_DELAY: нет байтов кадра, логотип не в памяти, деталей нет', () => {
  for (const opts of [{ bytes: false }, { logo: true }, null]) {
    const th = fakeLook();
    const { env, main, node } = mounted({ thumbs: th });
    const tag = JSON.stringify(opts);
    focus(main, main.rows[0][0]);
    wait(env, 1500);
    if (opts) readyCard(env, th, main, 0, 4, opts);
    focus(main, main.rows[0][2]);
    env.advance(150);
    focus(main, main.rows[0][3]);
    env.advance(150);
    focus(main, main.rows[0][4]);
    env.advance(BURST_DELAY - 1);
    assert.equal(shownOf(node), 'о 101', tag + ': не готова, а показана раньше BURST_DELAY');
    /* Деталей в памяти нет — текст показа выходит через SWAP_MS. */
    wait(env, opts ? 10 : 190);
    assert.equal(shownOf(node), 'о 105', tag + ': к BURST_DELAY не показана');
  }
  assert.deepEqual(warnLog, []);
});

test('этап 2в, п.1: байты кадра доехали посреди ожидания — показ на ближайшей проверке (шаг 100 мс), не дожидаясь BURST_DELAY', () => {
  const th = fakeLook();
  const { env, main, node } = mounted({ thumbs: th });
  focus(main, main.rows[0][0]);
  wait(env, 1500);
  const imgs = readyCard(env, th, main, 0, 4, { bytes: 'late' });
  focus(main, main.rows[0][2]);
  env.advance(150);
  focus(main, main.rows[0][3]);
  env.advance(150);
  focus(main, main.rows[0][4]);
  wait(env, 450);
  assert.equal(shownOf(node), 'о 101', 'байты едут — показа нет');
  land(imgs[0], 300, 169);
  wait(env, 40);
  assert.equal(shownOf(node), 'о 101', 'проверка раньше своего шага');
  wait(env, 10);
  assert.equal(shownOf(node), 'о 105', 'подложка доехала — показ на проверке через 500 мс покоя');
  assert.deepEqual(warnLog, []);
});

test('этап 2в, п.1: серия шагом 400 мс по готовым карточкам — ни одной пройденной (вдвое дольше шага — уже BURST_DELAY); показ последней — через BURST_DELAY', () => {
  const th = fakeLook();
  const { env, main, node } = mounted({ thumbs: th });
  focus(main, main.rows[0][0]);
  wait(env, 1500);
  const shown = [];
  for (let i = 1; i <= 5; i++) {
    /* Готова каждая — и та, на которой стоят сейчас (в памяти два кадра). */
    readyCard(env, th, main, 0, i);
    focus(main, main.rows[0][i]);
    for (let t = 0; t < 400; t += 10) {
      env.advance(10);
      if (shown[shown.length - 1] !== shownOf(node)) shown.push(shownOf(node));
    }
  }
  /* Первое нажатие после покоя — одиночное (показ через DELAY). */
  assert.deepEqual(shown, ['о 101', 'о 102'], 'серия 400 мс: показаны пройденные карточки ' + shown);
  env.advance(BURST_DELAY - 400 - 1);
  assert.equal(shownOf(node), 'о 102');
  env.advance(1);
  assert.equal(shownOf(node), 'о 106', 'последняя карточка серии не показана к BURST_DELAY');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Правки ревью rv7, Р3: в медленной серии (шаг 250–700 мс) дорожка кадра  */
/* карточки под фокусом ждёт, пока серия кончится                          */
/* ====================================================================== */

test('rv7 Р3: серия шагом 400 мс — ни срочных миниатюр, ни сравнений, ни байтов кадра карточки под фокусом; план окна (детали) — как прежде; кончилась — через LEAD_CALM (450 мс)', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][0]);
  wait(env, 1500);
  /* Первое нажатие после покоя — одиночное: его дорожка через IDLE. */
  focus(main, main.rows[0][1]);
  wait(env, 300);
  answerLooks(env);
  wait(env, 100);
  const primes0 = th.primes.length;
  const calls0 = th.calls.length;
  const w0 = anyW1280(env).length;
  for (let i = 2; i <= 4; i++) {
    focus(main, main.rows[0][i]);
    wait(env, 300);
    answerLooks(env);
    wait(env, 100);
  }
  assert.ok(env.requests.some((q) => idOf(q.url) === 104), 'план окна в серии не просил детали: он идёт через IDLE, как прежде');
  assert.equal(th.primes.length - primes0, 0, 'срочные миниатюры в серии 400 мс');
  assert.equal(th.calls.length - calls0, 0, 'сравнения в серии 400 мс');
  assert.equal(anyW1280(env).length - w0, 0, 'кадры в серии 400 мс');
  /* Последнее нажатие было 400 мс назад (4-я итерация). Кончилась: 450. */
  focus(main, main.rows[0][5]);
  wait(env, 300);
  answerLooks(env);
  wait(env, 140);
  assert.equal(th.primes.length - primes0, 0, 'раньше LEAD_CALM после последнего нажатия');
  wait(env, 20);
  assert.ok(th.primes.slice(primes0).some((p) => p.kind === 'poster' && p.urgent), 'серия кончилась — миниатюры карточки под фокусом не пошли');
  assert.deepEqual(th.pairs().slice(calls0), ['106:a106'], 'серия кончилась — пара карточки под фокусом не пошла');
  assert.deepEqual(warnLog, []);
});

test('rv7 Р3: серия шагом 150 мс — дорожка кадра через 300 мс покоя (вдвое дольше шага); одиночное нажатие — через IDLE, как прежде', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][0]);
  wait(env, 240);
  assert.equal(th.primes.length, 0, 'одиночное: раньше IDLE');
  wait(env, 20);
  assert.equal(th.primes.length, 1, 'одиночное: миниатюра постера через IDLE');
  wait(env, 1500);
  const p0 = th.primes.length;
  focus(main, main.rows[0][1]);
  env.advance(150);
  focus(main, main.rows[0][2]);
  wait(env, 290);
  assert.equal(th.primes.length, p0, 'серия 150 мс: раньше 300 мс покоя');
  wait(env, 20);
  assert.equal(th.primes.length, p0 + 1, 'серия 150 мс: к 300 мс покоя миниатюры не пошли');
  assert.equal(th.primes[p0].path, '/p103.jpg');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Этап 2в (находка стенда: утечка памяти Chromium): отмена загрузки —      */
/* src = пустая GIF в data:, обработчики сняты ДО замены                    */
/* ====================================================================== */

test('этап 2в: отменённая загрузка — src = BLANK (не removeAttribute), обработчики сняты до замены: load пустой GIF ничего не зовёт', () => {
  const { env } = mounted();
  let done = 0;
  env.hero.preloadFrame('/x1.jpg', true, () => { done++; });
  const x1 = env.images.find((i) => i.src === 'https://img/t/p/w1280/x1.jpg');
  /* Как браузер: у пустой GIF в data: тоже бывает load — сразу по замене. */
  Object.defineProperty(x1, 'src', { configurable: true, get() { return this._src; }, set(v) { this._src = v; if (v === BLANK) { this.removed = true; if (this.onload) this.onload(); } } });
  env.hero.preloadFrame('/x2.jpg', true);
  env.hero.preloadFrame('/x3.jpg', true);
  assert.equal(x1.src, BLANK, 'вытесненная недоехавшая загрузка не снята пустой GIF');
  assert.equal(x1.onload, null);
  assert.equal(x1.onerror, null);
  assert.equal(done, 1, 'исход вытесненной загрузки — один раз (load пустой GIF не в счёт)');
  /* Ставка дорожки кадра (dropFrame): кадр и подложка — тем же путём. */
  env.hero.preloadFrame('/g1.jpg', false);
  const g = env.images.filter((i) => /\/g1\.jpg$/.test(i.src));
  assert.equal(g.length, 2, 'предусловие: кадр и подложка');
  env.hero.dropFrame('/g1.jpg');
  assert.deepEqual(g.map((i) => i.src), [BLANK, BLANK], 'dropFrame снимает не пустой GIF');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Оркестровка простоя (проверка координатора, orch.test.mjs O1, O1b, O2,  */
/* O8 — там дефект воспроизводился; здесь — наоборот)                      */
/* ====================================================================== */

test('оркестровка O1: логотипы прошлого окна не держат места — перевод фокуса их снимает (логотип показанной карточки держит герой); детали карточки под фокусом — через IDLE, мимо лимита', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(250);
  /* Сосед (место освободилось — его логотип первым в очередь), затем
     сама карточка (её логотип — сразу, сверх лимита). */
  answer(pending(env).find((r) => idOf(r.url) === 104), withLogo(104));
  answer(pending(env).find((r) => idOf(r.url) === 103), withLogo(103));
  const l103 = logoImgs(env, 103)[0];
  const l104 = logoImgs(env, 104)[0];
  assert.ok(l103 && l104, 'предусловие: логотипы 103 и 104 в пути');
  env.advance(1000);
  /* Одиночный шаг на 107 (дальше окна 103): новое окно. */
  focus(main, main.rows[0][6]);
  assert.equal(l104.removed, true, 'перевод фокуса не снял логотип соседа прошлого окна');
  assert.equal(l103.removed, false, 'снят логотип показанной карточки — его ждёт герой');
  env.advance(249);
  assert.equal(pending(env).filter((r) => idOf(r.url) === 107).length, 0, 'детали раньше IDLE');
  env.advance(1);
  assert.equal(pending(env).filter((r) => idOf(r.url) === 107).length, 1, 'детали карточки под фокусом не ушли через IDLE');
  assert.equal(env.pf.stats().fly, 2, 'места — соседям нового окна');
  answer(pending(env).find((r) => idOf(r.url) === 107), withLogo(107));
  assert.equal(logoImgs(env, 107).length, 1, 'логотип карточки под фокусом ждёт места в очереди');
  assert.deepEqual(warnLog, []);
});

test('оркестровка O1b: в серии нажатий детали карточки, где серия кончилась, — через IDLE, а не показом через BURST_DELAY', () => {
  const { env, main } = mounted();
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), withLogo(103));
  answer(pending(env).find((r) => idOf(r.url) === 104), withLogo(104));
  env.advance(1000);
  /* Серия: 108 → 109 → 110 шагом 150 мс (дальше окна 103). */
  focus(main, main.rows[0][7]); env.advance(150);
  focus(main, main.rows[0][8]); env.advance(150);
  focus(main, main.rows[0][9]); env.advance(249);
  assert.equal(env.requests.filter((r) => idOf(r.url) === 110).length, 0);
  env.advance(1);
  assert.equal(env.requests.filter((r) => idOf(r.url) === 110).length, 1, 'детали 110 не ушли через IDLE после серии');
  assert.deepEqual(warnLog, []);
});

test('оркестровка O2: расчёт цвета соседа прошлого окна снимается переводом фокуса — цвет карточки под фокусом не ждёт его', () => {
  const acc = fakeAccent();
  const { env, main } = mounted({ accent: acc });
  warmDetails(env, main, main.rows[0][1]);
  focus(main, main.rows[0][2]);
  env.advance(250);
  drain(env);
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [103], 'предусловие: расчёт 103 в пути');
  focus(main, main.rows[0][3]);
  assert.equal(acc.jobs[0].cancelled, true, 'перевод фокуса не снял расчёт прошлого окна');
  env.advance(250);
  env.advance(COLOR_GAP);
  assert.deepEqual(acc.calls, [103, 104], 'цвет карточки под фокусом ждёт расчёт прошлого окна');
  assert.deepEqual(warnLog, []);
});

test('оркестровка O8: миниатюры кандидатов заранее — срочно (high) только тот, чей ответ выбор ждёт первым, остальные — обычным порядком', () => {
  const th = fakeLook();
  const { env, main } = mounted({ thumbs: th });
  focus(main, main.rows[0][2]);
  env.advance(250);
  answer(pending(env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.deepEqual(th.primes.map((p) => p.kind + ':' + p.path + ':' + p.urgent),
    ['poster:/p103.jpg:true', 'frame:/a103.jpg:true', 'frame:/b103.jpg:false']);
  /* Ответ первого известен (похож) — срочный второй. */
  const th2 = fakeLook();
  th2.verdicts['/p103.jpg|/a103.jpg'] = true;
  const b = mounted({ thumbs: th2 });
  focus(b.main, b.main.rows[0][2]);
  b.env.advance(250);
  answer(pending(b.env).find((r) => idOf(r.url) === 103), lookDetails(103));
  assert.deepEqual(th2.primes.map((p) => p.kind + ':' + p.path + ':' + p.urgent), ['poster:/p103.jpg:true', 'frame:/b103.jpg:true']);
  assert.deepEqual(warnLog, []);
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

/* Волна «хвосты героя», п.C2 и п.D: LC.thumbs — анализ миниатюр TMDB на
   canvas. Чистые функции проверяются на массивах пикселей RGBA; рантайм —
   на фейковых Image, canvas и requestIdleCallback: миниатюра «рисует»
   свои пиксели в любом размере растра, который у неё просит getImageData. */

globalThis.warn = function () {};
const SRC = readFileSync(new URL('../src/57_thumbs.js', import.meta.url), 'utf8');
const UTIL = load('10_util.js');
const CARDINFO = load('35_cardinfo.js');

function fresh() {
  const LC = { util: UTIL, cardinfo: CARDINFO };
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return module.exports;
}

const T = fresh();

/* Растр w × h из функции цвета пикселя (x, y) → [r, g, b, a]. */
function raster(w, h, fn) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const p = fn(x, y, w, h);
      const i = (y * w + x) * 4;
      data[i] = p[0]; data[i + 1] = p[1]; data[i + 2] = p[2]; data[i + 3] = p.length > 3 ? p[3] : 255;
    }
  }
  return data;
}

/* Узор — «сцена» с крупными деталями: одинаковый узор на любом растре
   (координаты в долях). */
const scene = (seed) => (x, y, w, h) => {
  const u = x / w;
  const v = y / h;
  const k = Math.sin((u * 7 + seed) * 3.1) * Math.cos((v * 5 - seed) * 2.3) + Math.sin(u * v * 9 + seed * 2);
  const g = Math.max(0, Math.min(255, Math.round(128 + 90 * k)));
  return [g, Math.round(g * 0.6 + 40 * seed) % 256, 255 - g];
};

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

test('п.C2: histogram — 4×4×4 в долях, прозрачные пиксели не считаются', () => {
  const data = raster(4, 1, (x) => (x < 2 ? [255, 0, 0] : x === 2 ? [0, 0, 255] : [0, 255, 0, 0]));
  const h = T.histogram(data, 4);
  assert.equal(h.length, 64);
  assert.ok(Math.abs(h[3 << 4] - 2 / 3) < 1e-9, 'красный');
  assert.ok(Math.abs(h[3] - 1 / 3) < 1e-9, 'синий');
  assert.equal(h[3 << 2], 0, 'прозрачный зелёный посчитан');
  assert.equal(T.histMatch(h, h), 1);
  assert.equal(T.histMatch(h, T.histogram(raster(1, 1, () => [0, 255, 0]), 1)), 0);
});

test('п.C2: bestCorr — шаблон, вырезанный из кадра, находится с корреляцией 1; ровный шаблон — 0', () => {
  const fw = 48;
  const fh = 27;
  const frame = T.luma(raster(fw, fh, scene(1)), fw * fh);
  const tw = 20;
  const th = 20;
  const g = new Uint8Array(tw * th);
  for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) g[y * tw + x] = frame[(y + 4) * fw + (x + 13)];
  assert.ok(T.bestCorr(frame, fw, fh, { w: tw, h: th, g: g }) > 0.999);
  assert.equal(T.bestCorr(frame, fw, fh, { w: tw, h: th, g: new Uint8Array(tw * th).fill(90) }), 0, 'ровный шаблон');
  assert.equal(T.bestCorr(frame, fw, fh, { w: 60, h: 10, g: new Uint8Array(600) }), -1, 'шаблон шире кадра');
});

/* E3 (study.md): пороги — максимум у кадров фильма на подборе + .02. */
test('E3: similar — гистограмма ≥ .71 или совместная корреляция ≥ .62; счёт и «чистый» ниже .85', () => {
  assert.equal(T.similar(0.71, 0), true);
  assert.equal(T.similar(0.1, 0.62), true);
  assert.equal(T.similar(0.7, 0.61), false, 'условия «обе ≥ .60» больше нет');
  assert.ok(Math.abs(T.score(0.71, 0) - 1) < 1e-9, 'на пороге гистограммы счёт 1');
  assert.ok(Math.abs(T.score(0, 0.62) - 1) < 1e-9, 'на пороге корреляции счёт 1');
  assert.equal(T.CLEAN, 0.85);
  assert.ok(T.score(0.6, 0.5) < T.CLEAN, '.6/.5 — чистый');
  assert.ok(T.score(0.62, 0.3) >= T.CLEAN, '.62 по гистограмме — серая зона');
});

test('E3: bestJoint — вырезанный из кадра шаблон находится и на нечётном смещении (шаг 2 + уточнение ±1), > .95', () => {
  const fw = 48;
  const fh = 27;
  const g = T.luma(raster(fw, fh, scene(1)), fw * fh);
  const frame = { w: fw, h: fh, g: g };
  for (const [ox, oy] of [[13, 3], [12, 4], [7, 1]]) {
    const tw = 21;
    const th = 22;
    const t = new Uint8Array(tw * th);
    for (let y = 0; y < th; y++) for (let x = 0; x < tw; x++) t[y * tw + x] = g[(y + oy) * fw + (x + ox)];
    /* Не единица: градиент у края шаблона считается по его собственным
       пикселям, у кадра — по соседям. */
    assert.ok(T.bestJoint(frame, { w: tw, h: th, g: t }) > 0.95, 'смещение ' + ox + ',' + oy);
  }
  assert.equal(T.bestJoint(frame, { w: 60, h: 10, g: new Uint8Array(600) }), -1, 'шаблон шире кадра');
  assert.equal(T.bestJoint(frame, { w: 3, h: 10, g: new Uint8Array(30) }), -1, 'шаблон уже 4 пикселей');
});

/* Общий световой рисунок (светлый верх, тёмный низ) при другом содержимом:
   корреляция одной яркости высокая, совместная с градиентом — нет. */
test('E3: bestJoint — тот же световой рисунок, другое содержимое — не совпадение (градиент)', () => {
  const fw = 48;
  const fh = 27;
  /* Спад яркости сверху вниз (общий рисунок) и мелкая псевдослучайная
     фактура (своя у каждой картинки). */
  const tex = (seed) => (x, y) => {
    const h = ((Math.imul(x + 31 * seed, 73856093) ^ Math.imul(y + 17 * seed, 19349663)) >>> 0) % 37;
    const v = Math.max(0, Math.min(255, Math.round(230 - (y / fh) * 200 + (h - 18))));
    return [v, v, v];
  };
  const g = T.luma(raster(fw, fh, tex(1)), fw * fh);
  const tw = 26;
  const t = T.luma(raster(tw, fh, (x, y) => tex(4)(x + 11, y)), tw * fh);
  const tmpl = { w: tw, h: fh, g: t };
  const luma = T.bestCorr(g, fw, fh, tmpl);
  const joint = T.bestJoint({ w: fw, h: fh, g: g }, tmpl);
  assert.ok(luma > 0.9, 'предусловие: по одной яркости совпадение ' + luma);
  assert.ok(joint < T.JOINT_SIM, 'совместная корреляция ' + joint);
});

test('E3: гистограмма тёмной пары — только по светлым пикселям', () => {
  /* Постер и кадр на 80 % чёрные, светлые пиксели — разного цвета. */
  const dark = (col) => (x, y) => (y < 8 ? col : [5, 5, 5]);
  const P = raster(10, 40, dark([230, 40, 40]));
  const F = raster(10, 40, dark([40, 40, 230]));
  const poster = { t: [], h: T.histogram(P, 400), hl: T.histogram(P, 400, true), light: T.lightShare(P, 400) };
  const frame = { w: 48, h: 27, g: new Uint8Array(48 * 27), hist: T.histogram(F, 400), histL: T.histogram(F, 400, true), light: T.lightShare(F, 400) };
  assert.ok(Math.abs(poster.light - 0.2) < 1e-9);
  assert.ok(T.histMatch(poster.h, frame.hist) >= 0.8, 'предусловие: полные гистограммы совпадают чёрной корзиной');
  assert.equal(T.judge(poster, frame).hist, 0, 'тёмная пара сравнена по всем пикселям');
  /* Светлая пара — полные гистограммы, как прежде. */
  const L1 = raster(10, 10, () => [200, 200, 200]);
  const lp = { t: [], h: T.histogram(L1, 100), hl: T.histogram(L1, 100, true), light: 1 };
  const lf = { w: 48, h: 27, g: new Uint8Array(48 * 27), hist: T.histogram(L1, 100), histL: T.histogram(L1, 100, true), light: 1 };
  assert.equal(T.judge(lp, lf).hist, 1);
});

/* Фикстура: признаки настоящих миниатюр w92, посчитанные тем же кодом на
   canvas Chromium (стенд study, make_fixture.py). Ожидания — разметка
   глазами: «Звёздные войны: Эпизод 8» №1 — горизонтальный арт той же
   кампании (не должен быть «чистым»), №2 — кадр фильма; «Побег из
   Шоушенка» №1 — лица с верха постера, №2 — кадр; «Одиссея» №1 — тот же
   арт; «Брат» №2 и №3 — тёмные кадры фильма, которые прежнее правило
   отмечало «похожими» по чёрной корзине гистограммы. */
test('E3: фикстура настоящих пар — повтор арта не чистый, кадры фильма чистые', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/thumbs_e3.json', import.meta.url), 'utf8'));
  const bytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
  const want = {
    181808: { 1: { clean: false }, 2: { clean: true } },
    278: { 1: { similar: true, clean: false }, 2: { clean: true } },
    1368337: { 1: { similar: true, clean: false }, 2: { clean: true } },
    20992: { 2: { similar: false, clean: true }, 3: { similar: false, clean: true } }
  };
  for (const id of Object.keys(want)) {
    const f = fx[id];
    const poster = { t: f.poster.t.map((t) => ({ w: t.w, h: t.h, g: bytes(t.g) })), h: f.poster.h, hl: f.poster.hl, light: f.poster.light };
    for (const o of f.order) {
      const fr = f.frames[o.path];
      const frame = { w: fr.w, h: fr.h, g: bytes(fr.g), hist: fr.hist, histL: fr.histL, light: fr.light };
      const j = T.judge(poster, frame);
      const w = want[id][o.n];
      if ('clean' in w) assert.equal(j.clean, w.clean, f.title + ' №' + o.n + ' ' + JSON.stringify(j));
      if ('similar' in w) assert.equal(j.similar, w.similar, f.title + ' №' + o.n + ' ' + JSON.stringify(j));
      assert.ok(Math.abs(j.corr - fr.expect.corr) < 1e-6, 'совместная корреляция разошлась со стендом');
    }
  }
});

test('п.C2: judge — постер из того же арта похож, из другого — нет', () => {
  const fw = 48;
  const fh = 27;
  const art = raster(fw, fh, scene(1));
  const frame = { w: fw, h: fh, g: T.luma(art, fw * fh), hist: T.histogram(art, fw * fh) };
  /* Шаблон «постера» — середина того же арта. */
  const tw = 24;
  const g = new Uint8Array(tw * fh);
  for (let y = 0; y < fh; y++) for (let x = 0; x < tw; x++) g[y * tw + x] = frame.g[y * fw + x + 12];
  const same = T.judge({ h: frame.hist, t: [{ w: tw, h: fh, g: g }] }, frame);
  assert.equal(same.similar, true);
  const other = raster(fw, fh, scene(3.7));
  const og = new Uint8Array(tw * fh);
  const ol = T.luma(other, fw * fh);
  for (let y = 0; y < fh; y++) for (let x = 0; x < tw; x++) og[y * tw + x] = ol[y * fw + x + 12];
  const diff = T.judge({ h: T.histogram(raster(10, 10, () => [20, 200, 40]), 100), t: [{ w: tw, h: fh, g: og }] }, frame);
  assert.equal(diff.similar, false, JSON.stringify(diff));
});

/* П.D: тёмный логотип — по светлоте L* непрозрачных пикселей: медиана ниже
   .25 или светлая четверть (75-й перцентиль) ниже .35. */
test('п.D: toneStats/darkOf — чёрный и тёмно-красный тёмные; цветной с бликами и насыщенный синий — нет', () => {
  const tone = (fn) => T.darkOf(T.toneStats(raster(8, 8, fn)));
  assert.equal(tone(() => [0, 0, 0]), true, 'чёрный');
  assert.equal(tone(() => [30, 20, 20]), true, 'почти чёрный');
  assert.equal(tone(() => [150, 20, 20]), true, 'тёмно-красный без бликов («Обитель зла»)');
  assert.equal(tone((x, y) => (y < 5 ? [90, 60, 160] : [230, 200, 255])), false, 'фиолетовый металл с бликами («Мстители: Финал»)');
  assert.equal(tone(() => [30, 60, 250]), false, 'насыщенный синий («ROCKY V»)');
  assert.equal(tone(() => [255, 255, 255]), false, 'белый');
  /* Прозрачные пиксели не голосуют: белая надпись на прозрачном фоне. */
  assert.equal(tone((x) => (x < 2 ? [255, 255, 255] : [0, 0, 0, 0])), false);
  const empty = T.toneStats(raster(4, 4, () => [0, 0, 0, 0]));
  assert.equal(empty.n, 0);
  assert.equal(T.darkOf(empty), false, 'пустой логотип — не тёмный');
});

/* ====================================================================== */
/* Рантайм: фейковые Image, canvas и простой браузера                     */
/* ====================================================================== */

const BLANK_GIF = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';

function env(opts) {
  opts = opts || {};
  const images = [];
  const idles = [];
  const timers = [];
  function FakeImage() {
    this.onload = null; this.onerror = null; this.src = ''; this.crossOrigin = null;
    this.complete = false; this.naturalWidth = 0; this.naturalHeight = 0; this.removed = false;
    this.srcSetAfterCors = null;
    images.push(this);
  }
  /* Находка Н1 (стенд 17e5a3d): загрузка снимается заменой адреса на пустой
     data:-GIF — removed; снятие адреса removeAttribute Chromium держит в
     памяти, и загрузку оно здесь снятой не считает (attrRemoved). */
  Object.defineProperty(FakeImage.prototype, 'src', {
    get() { return this._src || ''; },
    set(v) { this._src = v; if (v) this.corsAtSrc = this.crossOrigin; if (v === BLANK_GIF) { this.removed = true; this.blankHandlers = [this.onload, this.onerror]; } }
  });
  FakeImage.prototype.removeAttribute = function (n) { if (n === 'src') { this._src = ''; this.attrRemoved = true; } };
  globalThis.Image = FakeImage;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].done = true; };
  globalThis.window = {
    Lampa: { TMDB: { image: (u) => 'https://proxy/' + u + '?email=' } },
    requestIdleCallback: (fn, o) => { idles.push({ fn, timeout: o && o.timeout }); return idles.length; }
  };
  globalThis.Lampa = globalThis.window.Lampa;
  const canvas = { created: 0, draws: 0 };
  /* Раунд C: колбэк простоя делит работу на шаги по Date.now (SLICE_MS);
     часы теста стоят, а каждый растр «стоит» clock.tick миллисекунд. */
  const clock = { now: 1000, tick: 0 };
  globalThis.Date.now = () => clock.now;
  globalThis.document = {
    createElement: () => {
      let src = null;
      canvas.created++;
      /* Раунд C: смена width/height — новое выделение растра; счёт смен. */
      const box = { w: 0, h: 0 };
      return canvas.last = {
        get width() { return box.w; }, set width(v) { box.w = v; canvas.resized = (canvas.resized || 0) + 1; },
        get height() { return box.h; }, set height(v) { box.h = v; canvas.resized = (canvas.resized || 0) + 1; },
        getContext: () => ({
          drawImage: (img) => { src = img; canvas.draws++; clock.now += clock.tick; },
          getImageData: (x, y, w, h) => {
            if (src.tainted) { const e = new Error('tainted'); e.name = 'SecurityError'; throw e; }
            return { data: raster(w, h, src.paint) };
          }
        })
      };
    }
  };
  const e = {
    T: fresh(), images, idles, timers, canvas, clock,
    /* Картинка доехала: пиксели paint, размеры w×h. */
    arrive(img, paint, w, h, tainted) {
      img.paint = paint; img.tainted = !!tainted;
      img.complete = true; img.naturalWidth = w || 92; img.naturalHeight = h || 52;
      img.onload();
    },
    /* Один колбэк простоя. */
    /* Колбэк простоя: по умолчанию времени хватает на всю задачу (шагов —
       сколько влезет), left — сколько миллисекунд «осталось», didTimeout —
       колбэк по потолку IDLE_MS. */
    idle(left, didTimeout) {
      const it = idles.shift(); assert.ok(it, 'колбэка простоя нет');
      it.fn({ timeRemaining: () => (left === undefined ? 50 : left), didTimeout: !!didTimeout });
    },
    idleAll(left) { let n = 0; while (idles.length && n < 60) { e.idle(left); n++; } return n; },
    img(part) { return images.filter((i) => i.src.indexOf(part) !== -1).pop(); }
  };
  return e;
}

test('п.C2: compare — две миниатюры w92 через прокси, crossOrigin до src, разбор в простое по одной задаче', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  assert.equal(e.images.length, 2, 'постер и кадр пары едут вместе');
  const p = e.img('/p.jpg');
  const f = e.img('/f.jpg');
  assert.equal(p.src, 'https://proxy/t/p/w92/p.jpg?email=');
  assert.equal(f.src, 'https://proxy/t/p/w92/f.jpg?email=');
  assert.equal(p.corsAtSrc, 'anonymous', 'crossOrigin обязан стоять до src');
  assert.equal(f.corsAtSrc, 'anonymous');
  e.arrive(p, scene(1), 92, 138);
  e.arrive(f, scene(1), 92, 52);
  assert.deepEqual(got, [], 'canvas тронут вне простоя');
  assert.equal(e.idles.length, 1, 'задачи простоя ставятся по одной');
  assert.equal(e.idles[0].timeout, 120, 'простой с потолком');
  e.idle();
  assert.deepEqual(got, [], 'вердикт раньше разбора второй миниатюры');
  e.idle();
  assert.deepEqual(got, [], 'раунд C: сравнение пары — своя задача простоя, не хвост разбора кадра');
  e.idle();
  assert.equal(got.length, 1);
  assert.equal(typeof got[0], 'boolean');
  /* Второй раз — из памяти, синхронно, без загрузок. */
  const again = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => again.push(v));
  assert.deepEqual(again, got);
  assert.equal(e.images.length, 2);
  assert.equal(e.T.verdict('/p.jpg', '/f.jpg'), got[0]);
  assert.equal(e.T.verdict('/p.jpg', '/x.jpg'), undefined);
});

/* Раунд C (трейс листания после C4, CPU ×10): разбор постера (12 шаблонов)
   и сравнение пары шли одной задачей простоя — 50–88 мс, и нажатие пульта
   ждало её конца. Теперь — шагами: колбэк простоя делает шаг и берёт
   следующий, только пока deadline.timeRemaining() ≥ STEP_MS; по потолку
   (didTimeout) — один шаг. Недоделанная задача остаётся первой в очереди. */
test('раунд C: нет времени — один шаг на колбэк: шаблон постера, потом шаблон сравнения; задача не перебивается', () => {
  const e = env();
  let got;
  e.T.compare('/p.jpg', '/f.jpg', (v) => { got = v; });
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  const perCall = [];
  let calls = 0;
  while (e.idles.length && calls < 80) {
    const before = e.canvas.draws;
    e.idle(0);
    perCall.push(e.canvas.draws - before);
    calls++;
  }
  assert.equal(typeof got, 'boolean', 'ответ пришёл');
  assert.ok(perCall.every((n) => n <= 1), 'больше одного растра за колбэк: ' + perCall.join(','));
  /* Постер: 12 шаблонов и гистограмма — 13 колбэков, кадр — 1, сравнение —
     по шаблону за колбэк. */
  const tmpl = 4 * 3;
  assert.equal(perCall.slice(0, tmpl + 1).join(','), Array(tmpl + 1).fill(1).join(','), 'разбор постера — по шагу');
  assert.equal(perCall[tmpl + 1], 1, 'кадр — одним шагом');
  assert.equal(calls, tmpl + 2 + tmpl, 'сравнение пары — по шаблону за колбэк: ' + calls);
  /* Колбэк по потолку ожидания простоя (didTimeout) — шагами, но не дольше
     SLICE_MS: растр «стоит» 12 мс, SLICE_MS 30 — три шага (0, 12, 24 мс). */
  const e2 = env();
  e2.T.compare('/p.jpg', '/f.jpg', () => {});
  e2.arrive(e2.img('/p.jpg'), scene(1), 92, 138);
  e2.arrive(e2.img('/f.jpg'), scene(1), 92, 52);
  assert.equal(e2.T.SLICE_MS, 30);
  e2.clock.tick = 12;
  e2.idle(0, true);
  assert.equal(e2.canvas.draws, 3, 'по потолку — шаги до SLICE_MS');
  e2.idle(50);
  assert.equal(e2.canvas.draws, 6, 'и в простое колбэк не дольше SLICE_MS');
  e2.clock.tick = 0;
  e2.idle(50);
  assert.equal(e2.canvas.draws, tmpl + 1, 'есть время — задача доделывается в том же колбэке');
  assert.equal(e2.idles.length, 1, 'а следующая задача (кадр) — уже следующим колбэком');
});

/* Раунд C: сравнение кадра показа героя — срочное: ставится перед обычными
   задачами простоя и идёт ближайшим setTimeout (не ждёт простоя), теми же
   кусками; обычная задача, начатая раньше, доделывается после. */
test('раунд C: срочное сравнение — впереди обычных, по setTimeout, прерывает начатую обычную на границе шага', () => {
  const e = env();
  const got = {};
  e.T.compare('/p.jpg', '/lane.jpg', (v) => { got.lane = v; });
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/lane.jpg'), scene(1), 92, 52);
  e.idle(0);
  assert.equal(e.canvas.draws, 1, 'предусловие: обычная задача (постер) начата — шаг сделан');
  e.T.compare('/q.jpg', '/hero.jpg', (v) => { got.hero = v; }, true);
  e.arrive(e.img('/q.jpg'), scene(2), 92, 138);
  e.arrive(e.img('/hero.jpg'), scene(3), 92, 52);
  const soon = e.timers.filter((t) => !t.done && t.ms === 0);
  assert.equal(soon.length, 1, 'срочная — ближайшим setTimeout, не простоем');
  for (let guard = 0; guard < 20 && got.hero === undefined; guard++) {
    const t = e.timers.find((x) => !x.done && x.ms === 0);
    if (!t) break;
    t.done = true;
    t.fn();
  }
  assert.equal(typeof got.hero, 'boolean', 'срочное сравнение готово без единого колбэка простоя');
  assert.equal(got.lane, undefined, 'обычная ждёт');
  e.idleAll();
  assert.equal(typeof got.lane, 'boolean', 'обычная доделана после');
});

test('раунд C: один холст на модуль — сколько бы растров ни разбиралось', () => {
  const e = env();
  e.T.compare('/p.jpg', '/f.jpg', () => {});
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  e.idleAll();
  e.T.tone('/l.png', () => {});
  e.arrive(e.img('/l.png'), (x) => (x < 4 ? [0, 0, 0, 0] : [0, 0, 0]), 92, 30);
  e.idleAll();
  assert.ok(e.canvas.draws >= 15, 'предусловие: растров разобрано ' + e.canvas.draws);
  assert.equal(e.canvas.created, 1, 'холстов создано: ' + e.canvas.created);
  assert.equal(e.canvas.last.width, 64, 'холст 64 × 64');
  assert.equal(e.canvas.last.height, 64);
  assert.equal(e.canvas.resized, 2, 'размер задан один раз (ширина и высота) — растр не перевыделяется');
});

/* Раунд C: суммы окна кадра — из интегральных изображений (corrFast), а не
   заново на каждом положении; ответ тот же, что у прямого счёта. */
test('раунд C: corrFast с интегралом — та же корреляция, что прямой счёт окна', () => {
  const fw = 48;
  const fh = 27;
  const g = T.luma(raster(fw, fh, scene(2)), fw * fh);
  const e = T.sobel(g, fw, fh);
  const direct = (f, t, tw, th, x, y) => {
    let sf = 0, sff = 0, sft = 0, st = 0, stt = 0;
    const n = tw * th;
    for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) {
      const a = f[(y + r) * fw + x + c];
      const b = t[r * tw + c];
      sf += a; sff += a * a; sft += a * b; st += b; stt += b * b;
    }
    const vf = sff - sf * sf / n;
    const vt = stt - st * st / n;
    return { corr: (sft - sf * st / n) / Math.sqrt(vf * vt), st: st, vt: vt };
  };
  for (const f of [g, e]) {
    const I = T.integral(f, fw, fh);
    for (const [tw, th, x, y] of [[21, 22, 13, 3], [26, 27, 0, 0], [17, 17, 30, 9], [5, 4, 43, 23]]) {
      const t = [];
      for (let r = 0; r < th; r++) for (let c = 0; c < tw; c++) t.push(((r * 31 + c * 17) % 23) * 9);
      const want = direct(f, t, tw, th, x, y);
      const got = T.corrFast(f, fw, I, t, tw, th, x, y, want.st, want.vt);
      assert.ok(Math.abs(got - want.corr) < 1e-9, [tw, th, x, y].join('×') + ': ' + got + ' ≠ ' + want.corr);
    }
  }
});

test('раунд C: judgeSteps по шагам даёт тот же ответ, что judge', () => {
  const fx = JSON.parse(readFileSync(new URL('./fixtures/thumbs_e3.json', import.meta.url), 'utf8'));
  const bytes = (s) => Uint8Array.from(Buffer.from(s, 'base64'));
  const f = fx['181808'];
  const poster = { t: f.poster.t.map((t) => ({ w: t.w, h: t.h, g: bytes(t.g) })), h: f.poster.h, hl: f.poster.hl, light: f.poster.light };
  const fr = f.frames[f.order[0].path];
  const frame = { w: fr.w, h: fr.h, g: bytes(fr.g), hist: fr.hist, histL: fr.histL, light: fr.light };
  const j = T.judgeSteps(poster, frame);
  let n = 1;
  while (j.step()) n++;
  assert.equal(n, poster.t.length, 'шаг — шаблон');
  assert.deepEqual(j.result(), T.judge(poster, frame));
});

test('п.C2: compare — тот же арт похож, другой — нет; признаки постера переиспользуются', () => {
  const e = env();
  const got = {};
  e.T.compare('/p.jpg', '/same.jpg', (v) => { got.same = v; });
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/same.jpg'), scene(1), 92, 52);
  e.idleAll();
  e.T.compare('/p.jpg', '/other.jpg', (v) => { got.other = v; });
  assert.equal(e.images.length, 3, 'постер загружен второй раз');
  e.arrive(e.img('/other.jpg'), (x, y) => (((x >> 2) + (y >> 2)) % 2 ? [20, 200, 40] : [230, 240, 20]), 92, 52);
  e.idleAll();
  assert.equal(got.same, true);
  assert.equal(got.other, false);
  /* E3: счёт пары лежит в памяти рядом с вердиктом — для выбора наименее
     похожего, когда чистых кандидатов нет. */
  assert.equal(typeof e.T.scoreOf('/p.jpg', '/same.jpg'), 'number');
  assert.ok(e.T.scoreOf('/p.jpg', '/same.jpg') > e.T.scoreOf('/p.jpg', '/other.jpg'));
  assert.equal(e.T.scoreOf('/p.jpg', '/none.jpg'), undefined);
});

/* Раунд C, E3: вердикт compare — «не чистый», а не «похож»: пара в серой
   зоне (счёт от CLEAN до 1 — тот же стиль кампании, «Звёздные войны:
   Эпизод 8» №1) выбором кадра обходится, пока есть чистый кандидат.
   Постер одного цвета (шаблоны без контраста — корреляция 0), кадр на 62.5 %
   того же цвета: гистограмма .625 — ниже «похож» (.71), но счёт .88. */
test('E3: compare — пара в серой зоне (не похожа, но и не чистая) отвечает «не чистый», счёт в памяти', () => {
  const e = env();
  let got;
  e.T.compare('/p.jpg', '/gray.jpg', (v) => { got = v; });
  e.arrive(e.img('/p.jpg'), () => [200, 60, 60], 92, 138);
  e.arrive(e.img('/gray.jpg'), (x, y, w) => (x < w * 0.625 ? [200, 60, 60] : [60, 60, 200]), 92, 52);
  e.idleAll();
  const s = e.T.scoreOf('/p.jpg', '/gray.jpg');
  assert.ok(s >= e.T.CLEAN && s < 1, 'предусловие: серая зона, счёт ' + s);
  assert.equal(got, true, 'серая зона — не чистый кадр');
  assert.equal(e.T.verdict('/p.jpg', '/gray.jpg'), true);
});

/* Раунд C, E3: шаблоны постера — не только середина. Canvas заглушки здесь
   честно режет источник (drawImage с прямоугольником источника): арт
   «Побега из Шоушенка» стоит в кадре своей ВЕРХНЕЙ половиной (лица), а низ
   постера — другой рисунок; середина постера кадр не находит, верхняя
   полоса — находит. */
test('E3: compare — кадр повторяет верхнюю половину постера: находит полоса [0, .5]', () => {
  const e = env();
  globalThis.document = {
    createElement: () => {
      let src = null;
      let rect = null;
      return {
        width: 0, height: 0,
        getContext: () => ({
          /* Девять аргументов — прямоугольник источника (полосы постера),
             пять — картинка целиком. */
          drawImage: function (img, sx, sy, sw, sh) {
            src = img;
            rect = arguments.length >= 9 ? { sx: sx, sy: sy, sw: sw, sh: sh } : null;
          },
          getImageData: (x, y, w, h) => {
            const r = rect || { sx: 0, sy: 0, sw: src.naturalWidth, sh: src.naturalHeight };
            return { data: raster(w, h, (px, py) => src.paint(r.sx + (px + 0.5) / w * r.sw, r.sy + (py + 0.5) / h * r.sh, src.naturalWidth, src.naturalHeight)) };
          }
        })
      };
    }
  };
  const top = scene(1);
  const bottom = scene(4.3);
  const poster = (u, v, W, H) => (v < H / 2 ? top(u, v, W, H / 2) : bottom(u, v - H / 2, W, H / 2));
  const frame = (u, v, W, H) => {
    const fx = u / W;
    return fx >= 0.125 && fx < 0.875 ? top((fx - 0.125) / 0.75 * W, v, W, H) : [0, 0, 0];
  };
  let got;
  e.T.compare('/p.jpg', '/top.jpg', (v) => { got = v; });
  e.arrive(e.img('/p.jpg'), poster, 92, 138);
  e.arrive(e.img('/top.jpg'), frame, 92, 52);
  e.idleAll();
  assert.equal(got, true, 'повтор верхней половины постера — не чистый кадр, счёт ' + e.T.scoreOf('/p.jpg', '/top.jpg'));
  assert.ok(e.T.scoreOf('/p.jpg', '/top.jpg') >= 1, 'и похож: ' + e.T.scoreOf('/p.jpg', '/top.jpg'));
});

test('п.C2: пиксели закрыты (SecurityError) или картинка не пришла — вердикт null, и он в памяти', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138, true);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  e.idleAll();
  assert.deepEqual(got, [null]);
  assert.equal(e.T.verdict('/p.jpg', '/f.jpg'), null);
});

test('п.C2: отмена — колбэка нет, недоехавшие миниатюры сняты и в сети', () => {
  const e = env();
  const got = [];
  const h = e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  h.cancel();
  assert.equal(e.img('/p.jpg') === undefined, true, 'после отмены адрес остался');
  assert.ok(e.images.every((i) => i.removed), 'загрузка не снята');
  assert.deepEqual(got, []);
  assert.equal(e.T.stats().fly, 0);
});

/* Находка Н1 (стенд 17e5a3d, 4 × 400 шагов по главной: 860 отсоединённых
   <img> с пустым src, все из fetchImage): отмена ставит пустой data:-GIF,
   обработчики сняты ДО замены адреса, колбэк результата не зовётся. */
test('Н1: отмена миниатюры — адрес заменён пустым data:-GIF, не снят; обработчики сняты до замены; колбэка нет', () => {
  const e = env();
  const got = [];
  const h = e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  const imgs = e.images.slice();
  assert.equal(imgs.length, 2);
  h.cancel();
  for (const im of imgs) {
    assert.equal(im.src, BLANK_GIF, 'адрес — пустой GIF');
    assert.ok(!im.attrRemoved, 'removeAttribute(src) держит <img> в памяти Chromium');
    assert.deepEqual(im.blankHandlers, [null, null], 'onload/onerror сняты до замены адреса');
  }
  /* Пустой GIF «доехал» или «сломался» — это не результат сравнения. */
  for (const im of imgs) { if (im.onload) im.onload(); if (im.onerror) im.onerror(); }
  e.idleAll();
  assert.deepEqual(got, []);
  assert.equal(e.T.stats().fly, 0);
});

/* Раунд «без лагов», этап 2а: кадр карточки под фокусом решает заранее
   дорожка кадра (src/58_prefetch.js), а показ героя через DELAY спрашивает
   ту же пару, пока её ответ едет. Второй вопрос встаёт на сравнение в пути:
   один разбор, один ответ обоим. */
function runSoon(e, done, guard) {
  let n = 0;
  for (let g = 0; g < (guard || 40) && !done(); g++) {
    const t = e.timers.find((x) => !x.done && x.ms === 0);
    if (!t) break;
    t.done = true;
    t.fn();
    n++;
  }
  return n;
}

test('этап 2а: та же пара в пути — второй вопрос встаёт на неё: одно сравнение, ответ обоим; отмена одного не снимает другого', () => {
  const one = env();
  let solo;
  one.T.compare('/p.jpg', '/f.jpg', (v) => { solo = v; }, true);
  one.arrive(one.img('/p.jpg'), scene(1), 92, 138);
  one.arrive(one.img('/f.jpg'), scene(1), 92, 52);
  const soloTasks = runSoon(one, () => solo !== undefined);
  assert.equal(typeof solo, 'boolean', 'предусловие: одиночное срочное сравнение отвечает');

  const e = env();
  const got = {};
  e.T.compare('/p.jpg', '/f.jpg', (v) => { got.lane = v; }, true);
  e.T.compare('/p.jpg', '/f.jpg', (v) => { got.hero = v; }, true);
  assert.equal(e.images.length, 2, 'вторая пара грузит миниатюры заново');
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  const tasks = runSoon(e, () => got.lane !== undefined && got.hero !== undefined);
  assert.equal(got.lane, solo);
  assert.equal(got.hero, solo, 'ответ второму вопросу — тот же');
  assert.equal(tasks, soloTasks, 'второй вопрос завёл свои задачи разбора и сравнения: ' + tasks + ' против ' + soloTasks);

  const c = env();
  const late = [];
  const first = c.T.compare('/p.jpg', '/g.jpg', (v) => late.push(['lane', v]), true);
  c.T.compare('/p.jpg', '/g.jpg', (v) => late.push(['hero', v]), true);
  first.cancel();
  assert.ok(!c.images.some((i) => i.removed), 'отмена одного ждущего сняла миниатюры второго');
  c.arrive(c.img('/p.jpg'), scene(1), 92, 138);
  c.arrive(c.img('/g.jpg'), scene(2), 92, 52);
  runSoon(c, () => late.length > 0);
  assert.deepEqual(late.map((x) => x[0]), ['hero'], 'отменённый ждущий получил ответ или второй не получил');
});

test('этап 2а: последний отказавшийся снимает сравнение и миниатюры в сети; срочный вопрос на обычное сравнение не встаёт', () => {
  const e = env();
  const got = [];
  const a = e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v), true);
  const b = e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v), true);
  a.cancel();
  b.cancel();
  assert.ok(e.images.length === 2 && e.images.every((i) => i.removed), 'миниатюры остались в сети');
  assert.equal(e.T.stats().fly, 0);
  const again = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => again.push(v), true);
  assert.equal(e.images.length, 4, 'снятая пара осталась в пути — новый вопрос встал на мёртвое сравнение');

  const u = env();
  const out = {};
  u.T.compare('/p.jpg', '/f.jpg', (v) => { out.slow = v; });
  u.T.compare('/p.jpg', '/f.jpg', (v) => { out.urgent = v; }, true);
  u.arrive(u.img('/p.jpg'), scene(1), 92, 138);
  u.arrive(u.img('/f.jpg'), scene(1), 92, 52);
  runSoon(u, () => out.urgent !== undefined);
  assert.equal(typeof out.urgent, 'boolean', 'срочный встал на обычное сравнение и ждёт простоя');
  assert.equal(out.slow, undefined, 'обычное не ждёт простоя');
  u.idleAll();
  assert.equal(typeof out.slow, 'boolean');
});

test('этап 2а: prime — миниатюра и признаки заранее (срочно — по setTimeout, иначе в простое); вопрос о паре потом без загрузок и разбора', () => {
  const e = env();
  e.T.prime('poster', '/p.jpg', true);
  e.T.prime('frame', '/f.jpg', false);
  assert.equal(e.images.length, 2, 'миниатюры заранее не заказаны');
  assert.equal(e.img('/p.jpg').corsAtSrc, 'anonymous');
  assert.equal(e.img('/p.jpg').fetchPriority, 'high', 'срочная миниатюра — не высокий приоритет загрузки');
  assert.equal(e.img('/f.jpg').fetchPriority, undefined, 'обычная миниатюра обгоняет кадр показа');
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  runSoon(e, () => false);
  const posterDraws = e.canvas.draws;
  assert.equal(posterDraws, 13, 'срочный постер не разобран без простоя: ' + posterDraws);
  e.idleAll();
  assert.equal(e.canvas.draws, 14, 'кадр в простое не разобран');
  let got;
  e.T.compare('/p.jpg', '/f.jpg', (v) => { got = v; }, true);
  assert.equal(e.images.length, 2, 'признаки есть, а миниатюры грузятся снова');
  runSoon(e, () => got !== undefined);
  assert.equal(typeof got, 'boolean');
  assert.equal(e.canvas.draws, 14, 'пара разбирала растры заново');
  const off = env();
  off.T.prime('logo', '/l.png', true);
  off.T.prime('frame', '', true);
  assert.equal(off.images.length, 0, 'prime — только постер и кадр');
});

test('п.D: tone — чёрный логотип тёмный, белый светлый; ответ в памяти; одна загрузка на путь', () => {
  const e = env();
  const got = [];
  e.T.tone('/l.png', (t) => got.push(t));
  e.T.tone('/l.png', (t) => got.push(t));
  assert.equal(e.images.length, 1, 'одинаковый логотип в пути загружается дважды');
  /* Логотип — надпись на прозрачном фоне (раунд C, C8: без единого
     прозрачного пикселя это уже плашка, тон 'solid'). */
  e.arrive(e.images[0], (x) => (x < 4 ? [0, 0, 0, 0] : [0, 0, 0]), 92, 30);
  e.idleAll();
  assert.deepEqual(got, ['dark', 'dark']);
  assert.equal(e.T.toneOf('/l.png'), 'dark');
  const light = [];
  e.T.tone('/w.png', (t) => light.push(t));
  e.arrive(e.img('/w.png'), (x) => (x < 4 ? [0, 0, 0, 0] : [250, 250, 250]), 92, 30);
  e.idleAll();
  assert.deepEqual(light, ['light']);
  const sync = [];
  e.T.tone('/w.png', (t) => sync.push(t));
  assert.deepEqual(sync, ['light'], 'известный тон — синхронно');
  assert.equal(e.T.toneOf('/none.png'), undefined);
});

test('п.D: tone — пиксели закрыты или SVG без размеров — none, без исключения', () => {
  const e = env();
  const got = [];
  e.T.tone('/a.png', (t) => got.push(t));
  e.arrive(e.images[0], () => [0, 0, 0], 92, 30, true);
  e.T.tone('/b.svg', (t) => got.push(t));
  const svg = e.img('/b.svg');
  svg.complete = true;
  svg.onload();
  e.idleAll();
  assert.deepEqual(got, ['none', 'none']);
});

test('п.C2/D: шесть отказов подряд (прокси без CORS) — BLOCK_MS миниатюры не грузятся', () => {
  const e = env();
  const got = [];
  for (let i = 0; i < 6; i++) {
    e.T.tone('/l' + i + '.png', (t) => got.push(t));
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  assert.deepEqual(got, ['none', 'none', 'none', 'none', 'none', 'none']);
  assert.equal(e.T.stats().blocked, true);
  const before = e.images.length;
  const more = [];
  e.T.tone('/next.png', (t) => more.push(t));
  e.T.compare('/p.jpg', '/f.jpg', (v) => more.push(v));
  assert.deepEqual(more, ['none', null], 'ответ «нельзя» — сразу');
  assert.equal(e.images.length, before, 'после отказов миниатюры грузятся');
});

/* Ревью раунда героя (d97cffc), п.1 (critical): заблокированный модуль
   отвечал null синхронно и ответа не запоминал — verdict() оставался
   undefined, и выбор кадра героя спрашивал ту же пару снова, до
   переполнения стека. Ответ «сравнить нельзя» обязан лечь в память. */
test('ревью d97cffc п.1: заблокированный compare запоминает «сравнить нельзя» — verdict() null, а не undefined', () => {
  const e = env();
  for (let i = 0; i < 6; i++) {
    e.T.tone('/l' + i + '.png', () => {});
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  assert.equal(e.T.stats().blocked, true, 'предусловие: модуль заблокирован');
  assert.equal(e.T.verdict('/p.jpg', '/f.jpg'), undefined, 'предусловие: про пару ничего не известно');
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  assert.deepEqual(got, [null]);
  assert.equal(e.T.verdict('/p.jpg', '/f.jpg'), null, 'ответ «нельзя» не лёг в память — выбор кадра спросит снова');
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  assert.deepEqual(got, [null, null], 'повтор — из памяти, тот же ответ');
});

/* Проверка оркестровки простоя, O3: блок был до конца сеанса, а сетевой
   отказ (onerror, таймаут) считается тем же счётом — обрыв сети на минуту
   выключал сравнение и тон логотипа до перезапуска Lampa. Блок — на срок
   BLOCK_MS, потом проба. */
test('O3: шесть сетевых отказов — блок на BLOCK_MS; вышел срок — сравнение снова грузит, «нельзя» за время блока забыто', () => {
  const e = env();
  const got = [];
  for (let i = 0; i < 6; i++) {
    e.T.compare('/p' + i + '.jpg', '/f' + i + '.jpg', (v) => got.push(v));
    e.images[e.images.length - 2].onerror();
    e.idleAll();
  }
  assert.deepEqual(got, [null, null, null, null, null, null]);
  assert.equal(e.T.stats().blocked, true, 'шесть сетевых отказов — блок');
  const before = e.images.length;
  const during = [];
  e.T.compare('/q.jpg', '/g.jpg', (v) => during.push(v));
  e.T.tone('/l.png', (t) => during.push(t));
  e.clock.now += e.T.BLOCK_MS - 1;
  e.T.compare('/q2.jpg', '/g2.jpg', (v) => during.push(v));
  assert.deepEqual(during, [null, 'none', null], 'во время блока — «нельзя» сразу');
  assert.equal(e.images.length, before, 'во время блока загрузок нет');
  assert.equal(e.T.verdict('/q.jpg', '/g.jpg'), null);
  e.clock.now += 1;
  assert.equal(e.T.stats().blocked, false, 'срок вышел — проба');
  assert.equal(e.T.verdict('/q.jpg', '/g.jpg'), undefined, '«нельзя» за время блока забыто — пару спросят заново');
  const after = [];
  e.T.compare('/q.jpg', '/g.jpg', (v) => after.push(v));
  assert.equal(e.images.length, before + 2, 'сеть вернулась — миниатюры пары грузятся');
  e.arrive(e.img('/q.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/g.jpg'), scene(2), 92, 52);
  e.idleAll();
  assert.equal(typeof after[0], 'boolean', 'сравнение снова работает');
  assert.equal(e.T.stats().blocked, false);
});

test('O3: шесть CORS-отказов — блок; проба после срока снова отказ — блок сразу, ещё BLOCK_MS без загрузок', () => {
  const e = env();
  for (let i = 0; i < 6; i++) {
    e.T.tone('/l' + i + '.png', () => {});
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  assert.equal(e.T.stats().blocked, true);
  e.clock.now += e.T.BLOCK_MS;
  const before = e.images.length;
  e.T.tone('/probe.png', () => {});
  assert.equal(e.images.length, before + 1, 'проба — одна загрузка');
  e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
  e.idleAll();
  assert.equal(e.T.stats().blocked, true, 'проба не прошла — снова блок');
  const got = [];
  e.T.tone('/next.png', (t) => got.push(t));
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.clock.now += e.T.BLOCK_MS - 1;
  e.T.tone('/next2.png', (t) => got.push(t));
  assert.deepEqual(got, ['none', null, 'none']);
  assert.equal(e.images.length, before + 1, 'до конца нового срока — ни одной загрузки');
});

test('п.C2/D: удача сбрасывает счёт отказов; SVG без размеров — не отказ', () => {
  const e = env();
  for (let i = 0; i < 5; i++) {
    e.T.tone('/l' + i + '.png', () => {});
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  e.T.tone('/ok.png', () => {});
  e.arrive(e.images[e.images.length - 1], () => [255, 255, 255], 92, 30);
  e.idleAll();
  for (let i = 0; i < 5; i++) {
    e.T.tone('/bad' + i + '.png', () => {});
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  for (let i = 0; i < 3; i++) {
    e.T.tone('/v' + i + '.svg', () => {});
    const svg = e.images[e.images.length - 1];
    svg.complete = true;
    svg.onload();
    e.idleAll();
  }
  assert.equal(e.T.stats().blocked, false);
});

/* ====================================================================== */
/* Ревью H5: сетевой отказ миниатюры — не знание о картинке               */
/* ====================================================================== */

/* Один сбой загрузки (сеть моргнула, прокси ответил ошибкой) ложился в
   признаки растра как false — «прочитать нельзя» — и до вытеснения из LRU
   отключал проверку «кадр ≈ постер» для всех кадров фильма, а вердикт пары
   null — навсегда. Сетевой отказ теперь не запоминается ни в признаках, ни
   в вердикте, ни в тоне: следующий показ пробует снова. Пиксели, закрытые
   CORS (SecurityError), и SVG без размеров — знание о картинке, оно в
   памяти, как прежде. */
test('ревью H5: сетевой отказ постера — ответ null, но в памяти его нет: следующий вопрос грузит постер снова', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.img('/p.jpg').onerror();
  e.idleAll();
  assert.deepEqual(got, [null], 'нет постера — сравнить нельзя');
  assert.equal(e.T.verdict('/p.jpg', '/f.jpg'), undefined, 'сетевой отказ лёг в память вердиктом');
  const before = e.images.length;
  e.T.compare('/p.jpg', '/g.jpg', (v) => got.push(v));
  assert.equal(e.images.length, before + 2, 'постер после сетевого отказа больше не грузится — проверка отключена для фильма');
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/g.jpg'), scene(1), 92, 52);
  e.idleAll();
  assert.equal(got[1], true, 'после удачной загрузки проверка работает');
});

test('ревью H5: постер прочитать нельзя (в памяти) — ответ null сразу, кадр не грузится', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  const frame = e.img('/f.jpg');
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138, true);
  e.idleAll();
  assert.equal(frame.removed, true, 'постер прочитать нельзя, а кадр пары грузится дальше');
  assert.deepEqual(got, [null]);
  const before = e.images.length;
  e.T.compare('/p.jpg', '/g.jpg', (v) => got.push(v));
  assert.deepEqual(got, [null, null], 'известный отказ постера — ответ синхронно');
  assert.equal(e.images.length, before, 'кадр грузится, хотя сравнивать не с чем');
});

/* Раунд C, C8 (study.md, «After Impact» 1751701): логотип без единого
   прозрачного пикселя (PNG без альфы — тёмный текст на сером
   прямоугольнике) — тон 'solid', а не 'dark': белый силуэт закрашивал весь
   прямоугольник. Один прозрачный пиксель — уже надпись. */
test('C8: tone — логотип без прозрачных пикселей — плашка (solid), с прозрачным фоном — по светлоте', () => {
  const e = env();
  const got = {};
  e.T.tone('/plate.png', (t) => { got.plate = t; });
  e.arrive(e.img('/plate.png'), (x, y) => (y > 10 && y < 20 && x > 20 && x < 70 ? [30, 30, 30] : [128, 128, 128]), 92, 30);
  e.idleAll();
  e.T.tone('/text.png', (t) => { got.text = t; });
  e.arrive(e.img('/text.png'), (x, y) => (x === 0 && y === 0 ? [0, 0, 0, 0] : [30, 30, 30]), 92, 30);
  e.idleAll();
  assert.equal(got.plate, 'solid');
  assert.equal(e.T.toneOf('/plate.png'), 'solid', 'в памяти');
  assert.equal(got.text, 'dark', 'есть прозрачный пиксель — надпись, её тон по светлоте');
  assert.equal(e.T.solidOf(e.T.toneStats(raster(4, 4, () => [0, 0, 0, 0]))), false, 'пустой логотип — не плашка');
});

test('ревью H5: сетевой отказ логотипа — тон none, но не в памяти: следующая проба грузит снова', () => {
  const e = env();
  const got = [];
  e.T.tone('/l.png', (t) => got.push(t));
  e.images[0].onerror();
  e.idleAll();
  assert.deepEqual(got, ['none']);
  assert.equal(e.T.toneOf('/l.png'), undefined, 'сетевой отказ лёг в память тоном');
  e.T.tone('/l.png', (t) => got.push(t));
  assert.equal(e.images.length, 2, 'логотип после сетевого отказа больше не пробуется');
  e.arrive(e.images[1], (x) => (x < 4 ? [0, 0, 0, 0] : [0, 0, 0]), 92, 30);
  e.idleAll();
  assert.deepEqual(got, ['none', 'dark']);
});

/* Сомнительное ревью (S/H): при отказе прокси пользователя модуль шёл на
   прямой image.tmdb.org — в обход выбранного пользователем пути (его IP
   уходит TMDB, а где TMDB заблокирован — ещё и ожидание до 8 с на каждую
   миниатюру). Адрес — только тот, что дала Lampa. */
test('ревью: прокси не ответил — прямого запроса на image.tmdb.org нет, ответ null', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.img('/f.jpg').onerror();
  assert.equal(e.img('image.tmdb.org'), undefined, 'запрос в обход прокси пользователя');
  e.arrive(e.img('proxy/t/p/w92/p.jpg'), scene(1), 92, 138);
  e.idleAll();
  assert.deepEqual(got, [null]);
  assert.equal(e.images.length, 2);
});

/* Полоса gc3 (2026-09-27): на ТВ LoAF отдаёт имя функции, переданной
   таймеру или простою (sourceFunctionName), а у анонимной — пусто, и
   «TimerHandler:setTimeout» в подвале самотеста не говорил, чей таймер.
   Колбэки модуля — именованные. */
test('полоса gc3: колбэки таймеров, простоя и загрузки миниатюр — именованные', () => {
  const e = env();
  e.T.compare('/p.jpg', '/f.jpg', () => {});
  const p = e.img('/p.jpg');
  assert.equal(p.onload.name, 'onThumbsLoad');
  assert.equal(p.onerror.name, 'onThumbsError');
  const guard = e.timers.filter((t) => !t.done && t.ms > 0);
  assert.ok(guard.length > 0, 'потолок загрузки не заведён');
  assert.deepEqual([...new Set(guard.map((t) => t.fn.name))], ['onThumbsTimeout']);
  e.arrive(p, scene(1), 92, 138);
  assert.equal(e.idles.length, 1);
  assert.equal(e.idles[0].fn.name, 'onThumbsIdle', 'колбэк простоя');
  e.idleAll();
  /* Срочная задача — ближайшим setTimeout. */
  e.T.compare('/q.jpg', '/h.jpg', () => {}, true);
  e.arrive(e.img('/q.jpg'), scene(2), 92, 138);
  const soon = e.timers.filter((t) => !t.done && t.ms === 0);
  assert.equal(soon.length, 1);
  assert.equal(soon[0].fn.name, 'onThumbsUrgent');
  /* Без requestIdleCallback — тот же колбэк простоя запасным setTimeout. */
  const e2 = env();
  globalThis.window.requestIdleCallback = undefined;
  e2.T.compare('/p.jpg', '/f.jpg', () => {});
  e2.arrive(e2.img('/p.jpg'), scene(1), 92, 138);
  const fallback = e2.timers.filter((t) => !t.done && t.ms === 16);
  assert.equal(fallback.length, 1, 'запасной таймер простоя');
  assert.equal(fallback[0].fn.name, 'onThumbsIdle');
});

/* Финальный прогон 1.0.0: SVG-логотип с <foreignObject> портит общий холст
   навсегда (clearRect не очищает), и каждый следующий getImageData бросал
   SecurityError — до конца сеанса без «кадр ≈ постер» и тона логотипа.
   После SecurityError холст выбрасывается, следующий разбор — на новом. */
test('финальный прогон 1.0.0: после SecurityError общий холст пересоздаётся', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.arrive(e.img('/p.jpg'), scene(1), 92, 138, true);
  e.arrive(e.img('/f.jpg'), scene(1), 92, 52);
  e.idleAll();
  assert.deepEqual(got, [null]);
  const before = e.canvas.created;
  e.T.compare('/p2.jpg', '/f2.jpg', (v) => got.push(v));
  e.arrive(e.img('/p2.jpg'), scene(1), 92, 138);
  e.arrive(e.img('/f2.jpg'), scene(2), 92, 52);
  e.idleAll();
  assert.equal(got.length, 2);
  assert.equal(e.canvas.created, before + 1, 'испорченный холст не выброшен — следующий разбор на нём же');
});

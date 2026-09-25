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

test('п.C2: similar — гистограмма ≥ .70, или корреляция ≥ .75, или обе ≥ .60', () => {
  assert.equal(T.similar(0.7, 0), true);
  assert.equal(T.similar(0.1, 0.75), true);
  assert.equal(T.similar(0.6, 0.6), true);
  assert.equal(T.similar(0.69, 0.74), true, 'обе ≥ .60');
  assert.equal(T.similar(0.59, 0.74), false);
  assert.equal(T.similar(0.69, 0.59), false);
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
  Object.defineProperty(FakeImage.prototype, 'src', {
    get() { return this._src || ''; },
    set(v) { this._src = v; if (v) this.corsAtSrc = this.crossOrigin; }
  });
  FakeImage.prototype.removeAttribute = function (n) { if (n === 'src') { this._src = ''; this.removed = true; } };
  globalThis.Image = FakeImage;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, done: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].done = true; };
  globalThis.window = {
    Lampa: { TMDB: { image: (u) => 'https://proxy/' + u + '?email=' } },
    requestIdleCallback: (fn, o) => { idles.push({ fn, timeout: o && o.timeout }); return idles.length; }
  };
  globalThis.Lampa = globalThis.window.Lampa;
  globalThis.document = {
    createElement: () => {
      let src = null;
      return {
        width: 0, height: 0,
        getContext: () => ({
          drawImage: (img) => { src = img; },
          getImageData: (x, y, w, h) => {
            if (src.tainted) { const e = new Error('tainted'); e.name = 'SecurityError'; throw e; }
            return { data: raster(w, h, src.paint) };
          }
        })
      };
    }
  };
  const e = {
    T: fresh(), images, idles, timers,
    /* Картинка доехала: пиксели paint, размеры w×h. */
    arrive(img, paint, w, h, tainted) {
      img.paint = paint; img.tainted = !!tainted;
      img.complete = true; img.naturalWidth = w || 92; img.naturalHeight = h || 52;
      img.onload();
    },
    /* Один колбэк простоя. */
    idle() { const it = idles.shift(); assert.ok(it, 'колбэка простоя нет'); it.fn({ timeRemaining: () => 10 }); },
    idleAll() { let n = 0; while (idles.length && n < 20) { e.idle(); n++; } return n; },
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

test('п.C2: прокси не ответил — один запасной запрос на image.tmdb.org, потом отказ', () => {
  const e = env();
  const got = [];
  e.T.compare('/p.jpg', '/f.jpg', (v) => got.push(v));
  e.img('/f.jpg').onerror();
  const direct = e.img('image.tmdb.org');
  assert.ok(direct, 'запасного запроса нет');
  assert.equal(direct.src, 'https://image.tmdb.org/t/p/w92/f.jpg');
  assert.equal(direct.corsAtSrc, 'anonymous');
  direct.onerror();
  e.arrive(e.img('proxy/t/p/w92/p.jpg'), scene(1), 92, 138);
  e.idleAll();
  assert.deepEqual(got, [null]);
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

test('п.D: tone — чёрный логотип тёмный, белый светлый; ответ в памяти; одна загрузка на путь', () => {
  const e = env();
  const got = [];
  e.T.tone('/l.png', (t) => got.push(t));
  e.T.tone('/l.png', (t) => got.push(t));
  assert.equal(e.images.length, 1, 'одинаковый логотип в пути загружается дважды');
  e.arrive(e.images[0], () => [0, 0, 0], 92, 30);
  e.idleAll();
  assert.deepEqual(got, ['dark', 'dark']);
  assert.equal(e.T.toneOf('/l.png'), 'dark');
  const light = [];
  e.T.tone('/w.png', (t) => light.push(t));
  e.arrive(e.img('/w.png'), () => [250, 250, 250], 92, 30);
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

test('п.C2/D: четыре отказа подряд (прокси без CORS) — до конца сеанса миниатюры не грузятся', () => {
  const e = env();
  const got = [];
  for (let i = 0; i < 4; i++) {
    e.T.tone('/l' + i + '.png', (t) => got.push(t));
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  assert.deepEqual(got, ['none', 'none', 'none', 'none']);
  assert.equal(e.T.stats().blocked, true);
  const before = e.images.length;
  const more = [];
  e.T.tone('/next.png', (t) => more.push(t));
  e.T.compare('/p.jpg', '/f.jpg', (v) => more.push(v));
  assert.deepEqual(more, ['none', null], 'ответ «нельзя» — сразу');
  assert.equal(e.images.length, before, 'после отказов миниатюры грузятся');
});

test('п.C2/D: удача сбрасывает счёт отказов', () => {
  const e = env();
  for (let i = 0; i < 3; i++) {
    e.T.tone('/l' + i + '.png', () => {});
    e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
    e.idleAll();
  }
  e.T.tone('/ok.png', () => {});
  e.arrive(e.images[e.images.length - 1], () => [255, 255, 255], 92, 30);
  e.idleAll();
  e.T.tone('/bad.png', () => {});
  e.arrive(e.images[e.images.length - 1], () => [0, 0, 0], 92, 30, true);
  e.idleAll();
  assert.equal(e.T.stats().blocked, false);
});

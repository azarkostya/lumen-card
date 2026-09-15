import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 5b (правки координатора): 50_backdrops.js — не «чистый» модуль
   (трогает $/Image/document/setTimeout/window.Lampa), поэтому у него нет
   module.exports и его нельзя грузить через test/_load.mjs (как cardinfo/
   util/icons/template). Здесь — свой минимальный загрузчик + фейковые
   $/Image/document/таймеры, ровно в объёме, который нужен для проверки:
   гонки двух apply() подряд (п.2 — отмена + счётчик поколения), таймаута
   8с (Step 3), LC.backdrops.cancel (п.4) и того, что исключение в finish()
   не выходит наружу (п.3). LC.cardinfo (bgMode/backdropPath/imageUrl)
   грузится настоящий — эта логика уже покрыта test/cardinfo.test.mjs,
   здесь не переизобретается. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* -------------------------------------------------------------------- */
/* Мини-фейк $/DOM: только то, что вызывает 50_backdrops.js — addClass/  */
/* removeClass/toggleClass/data/removeData/css/find/children/append/     */
/* prepend/[0]/length. Вложенность не моделируется — дети плоским        */
/* списком, find===children (ищут по классу среди прямых детей: этого    */
/* достаточно для .lumen-backdrop -> .lumen-backdrop__img/veil*). */
/* -------------------------------------------------------------------- */

function classList(tagHtml) {
  const m = /class="([^"]*)"/.exec(tagHtml || '');
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function FakeEl(classes) {
  this._class = classes || [];
  this._children = [];
  this._data = {};
  this._css = {};
  this.length = 1;
  this[0] = this;
}
FakeEl.prototype.hasClass = function (c) { return this._class.indexOf(c) !== -1; };
FakeEl.prototype.addClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { if (c && self._class.indexOf(c) === -1) self._class.push(c); });
  return this;
};
FakeEl.prototype.removeClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { const i = self._class.indexOf(c); if (i !== -1) self._class.splice(i, 1); });
  return this;
};
FakeEl.prototype.toggleClass = function (c, on) { if (on) this.addClass(c); else this.removeClass(c); return this; };
FakeEl.prototype.css = function (name, val) { this._css[name] = val; return this; };
FakeEl.prototype.data = function (key, val) {
  if (arguments.length < 2) return this._data[key];
  this._data[key] = val;
  return this;
};
FakeEl.prototype.removeData = function (key) { delete this._data[key]; return this; };
FakeEl.prototype.append = function (child) { this._children.push(toEl(child)); return this; };
FakeEl.prototype.prepend = function (child) { this._children.unshift(toEl(child)); return this; };

const EMPTY = {
  length: 0,
  addClass() { return this; }, removeClass() { return this; }, css() { return this; },
  data() { }, removeData() { return this; },
  find() { return EMPTY; }, children() { return EMPTY; }
};

FakeEl.prototype.children = function (sel) {
  const cls = sel.replace(/^\./, '');
  for (let i = 0; i < this._children.length; i++) if (this._children[i].hasClass(cls)) return this._children[i];
  return EMPTY;
};
FakeEl.prototype.find = FakeEl.prototype.children;

function toEl(x) {
  if (x instanceof FakeEl) return x;
  return new FakeEl(classList(String(x)));
}

function fakeQuery(html) {
  const tags = String(html).match(/<div[^>]*>/g) || [];
  const root = new FakeEl(classList(tags[0]));
  for (let i = 1; i < tags.length; i++) root._children.push(new FakeEl(classList(tags[i])));
  return root;
}

function fakeBody() { return new FakeEl(['body-mock']); }
function mount(el) { el._mounted = true; return el; }

/* document.documentElement.contains — по флагу _mounted, который          */
/* выставляет сам тест (имитация «карточка ещё в DOM» / «закрыта»).        */
globalThis.document = { documentElement: { contains: (node) => !!(node && node._mounted) } };

/* Image — src ничего по-настоящему не грузит, onload/onerror вызывает     */
/* тест вручную и в нужном ему порядке — это и даёт возможность            */
/* смоделировать гонку двух apply() подряд. */
let loaders;
function FakeImage() { this.onload = null; this.onerror = null; this.src = ''; loaders.push(this); }

/* setTimeout/clearTimeout — ручной планировщик: тест сам решает, когда    */
/* «наступает» 8-секундный таймаут (fireTimer), без реального ожидания.    */
/* id — с 1 (как у настоящих setTimeout/Node/браузер): 0 — falsy, а код     */
/* проверяет таймер как `if (timer) clearTimeout(timer)` — с id от 0 это    */
/* маскировало бы недостающий clearTimeout в тесте, а не только в браузере. */
let timers;
function fakeSetTimeout(fn) { timers.push({ fn, cleared: false }); return timers.length; }
function fakeClearTimeout(id) { const t = timers[id - 1]; if (t) t.cleared = true; }
function fireTimer(id) { const t = timers[id - 1]; if (t && !t.cleared) t.fn(); }

globalThis.window = globalThis;
globalThis.Lampa = {
  TMDB: { image: (url) => 'https://img/' + url },
  Api: { img: (path, size) => 'https://api/' + size + '/' + path }
};

function freshLC() {
  loaders = [];
  timers = [];
  warnLog.length = 0;
  globalThis.$ = fakeQuery;
  globalThis.Image = FakeImage;
  globalThis.setTimeout = fakeSetTimeout;
  globalThis.clearTimeout = fakeClearTimeout;

  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '35_cardinfo.js');
  LC.motionMode = () => 'full';
  loadInto(LC, module, '50_backdrops.js');
  return LC;
}

/* ====================================================================== */
/* п.2: гонка — apply() отменяет предыдущую незавершённую загрузку.        */
/* ====================================================================== */

test('apply: второй вызов на том же body гасит обработчики/таймер предыдущей загрузки', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);
  const loaderA = loaders[0];
  assert.equal(typeof loaderA.onload, 'function');

  LC.backdrops.apply(null, body, { id: 2, backdrop_path: '/b.jpg' });
  assert.equal(loaderA.onload, null, 'onload A должен быть обнулён новым apply()');
  assert.equal(loaderA.onerror, null, 'onerror A должен быть обнулён новым apply()');
  assert.equal(timers[0].cleared, true, 'таймер A должен быть очищен');

  const loaderB = loaders[1];
  assert.equal(typeof loaderB.onload, 'function');
});

test('apply: устаревший finish() (счётчик поколения) не перезаписывает уже применённый более новый фон', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);
  /* Захватываем ИСХОДНЫЙ onload A до того, как его обнулит следующий apply() —
     имитация «а что если обработчик всё же был вызван до отмены» (защита
     через layer.data('lumenGen'), а не только через onload=null). */
  const staleOnload = loaders[0].onload;

  LC.backdrops.apply(null, body, { id: 2, backdrop_path: '/b.jpg' });
  loaders[1].onload(); // B успешно загрузился первым (типичная гонка сети)

  const img = layer.children('.lumen-backdrop__img');
  assert.ok(String(img._css['background-image']).includes('b.jpg'), 'фон должен быть от B');

  staleOnload(); // «поздний» ответ A

  assert.ok(String(img._css['background-image']).includes('b.jpg'), 'поздний ответ A не должен был перезаписать фон B');
  assert.equal(String(img._css['background-image']).includes('a.jpg'), false);
});

/* ====================================================================== */
/* Таймаут 8с -> размытый постер (без onload/onerror вовсе).               */
/* ====================================================================== */

test('apply: таймаут (8с) без onload/onerror -> .lumen-bg--blur с постером', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg', poster_path: '/poster.jpg' });
  const layer = mount(body._children[0]);

  fireTimer(1);

  assert.equal(layer.hasClass('lumen-bg--blur'), true);
  assert.equal(layer.hasClass('loaded'), true);
  const img = layer.children('.lumen-backdrop__img');
  assert.ok(String(img._css['background-image']).includes('poster.jpg'));
});

test('apply: таймаут при отсутствии poster_path -> процедурный градиент (постера для фолбэка нет), без исключений', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 4, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);

  fireTimer(1);

  assert.equal(layer.hasClass('lumen-bg--blur'), false);
  assert.equal(layer.hasClass('lumen-backdrop--proc' + (4 % 3)), true);
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* п.4: LC.backdrops.cancel — идемпотентен.                                 */
/* ====================================================================== */

test('cancel: снимает обработчики и таймер незавершённой загрузки, идемпотентен', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const loaderA = loaders[0];

  LC.backdrops.cancel(body);
  assert.equal(loaderA.onload, null);
  assert.equal(loaderA.onerror, null);
  assert.equal(timers[0].cleared, true);

  assert.doesNotThrow(() => LC.backdrops.cancel(body)); // второй вызов — идемпотентно
  assert.doesNotThrow(() => LC.backdrops.cancel(fakeBody())); // слоя вовсе нет
  assert.doesNotThrow(() => LC.backdrops.cancel(null));
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* п.3: исключение в finish() не выходит наружу.                           */
/* ====================================================================== */

test('finish(ok=true): исключение (URIError из encodeURI) перехвачено, не выходит наружу, warn вызван', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  mount(body._children[0]);
  const loaderA = loaders[0];

  const originalEncodeURI = globalThis.encodeURI;
  globalThis.encodeURI = () => { throw new URIError('boom'); };
  try {
    assert.doesNotThrow(() => loaderA.onload());
  } finally {
    globalThis.encodeURI = originalEncodeURI;
  }
  assert.ok(warnLog.length > 0, 'warn должен был быть вызван');
});

test('finish(ok=false): исключение внутри showNoFrame (img.css бросает) перехвачено, не выходит наружу', () => {
  const LC = freshLC();
  const body = fakeBody();

  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg', poster_path: '/poster.jpg' });
  const layer = mount(body._children[0]);
  const loaderA = loaders[0];

  const img = layer.children('.lumen-backdrop__img');
  const originalCss = img.css;
  img.css = () => { throw new Error('css boom'); };
  try {
    assert.doesNotThrow(() => loaderA.onerror());
  } finally {
    img.css = originalCss;
  }
  assert.ok(warnLog.length > 0, 'warn должен был быть вызван');
});

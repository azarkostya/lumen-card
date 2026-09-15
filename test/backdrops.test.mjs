import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

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
FakeEl.prototype.empty = function () { this._children = []; return this; };
/* Task 6 (fix, п.1): closest('.activity') — заглушка, не настоящий обход
   родителей (мок их не моделирует, см. комментарий вверху файла). Тест
   выставляет el._closestActivity = {length, hasClass} перед тиком, чтобы
   смоделировать «слой внутри активной/архивной .activity»; по умолчанию
   (свойство не выставлено) — EMPTY, как «не на странице предка не нашли» —
   isActivityForeground(EMPTY) в src/50_backdrops.js трактует это как true
   (безопасный дефолт), так что все ранее написанные тесты не ломаются. */
FakeEl.prototype.closest = function (sel) {
  if (sel === '.activity' && this._closestActivity) return this._closestActivity;
  return EMPTY;
};

const EMPTY = {
  length: 0,
  addClass() { return this; }, removeClass() { return this; }, toggleClass() { return this; }, css() { return this; },
  data() { }, removeData() { return this; }, empty() { return this; }, hasClass() { return false; },
  find() { return EMPTY; }, children() { return EMPTY; }, append() { return this; }, closest() { return EMPTY; }
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

/* setInterval/clearInterval (Task 6: таймер ротации слайдшоу) — тот же     */
/* ручной планировщик, что и для setTimeout выше, но отдельный список: в    */
/* одном и том же тесте может тикать и 8с-таймаут загрузки, и интервал      */
/* слайдшоу, и id у них независимые (оба с 1). fireInterval вызывает fn     */
/* один раз за вызов — реальный setInterval тикает сам по себе, здесь тест  */
/* решает, когда «наступает» каждый тик. */
let intervals;
function fakeSetInterval(fn) { intervals.push({ fn, cleared: false }); return intervals.length; }
function fakeClearInterval(id) { const t = intervals[id - 1]; if (t) t.cleared = true; }
function fireInterval(id) { const t = intervals[id - 1]; if (t && !t.cleared) t.fn(); }

globalThis.window = globalThis;
globalThis.Lampa = {
  TMDB: { image: (url) => 'https://img/' + url },
  Api: { img: (path, size) => 'https://api/' + size + '/' + path }
};

/* mk — та же фабрика тестовых backdrop-элементов, что в плане Task 6 Step 1
   (file_path/iso_639_1/vote_average/width, height по 16:9) — используется и
   в тестах pickBackdrops, и в тестах слайдшоу (movie.images.backdrops). */
function mk(p, lang, v, w = 1920) {
  return { file_path: p, iso_639_1: lang, vote_average: v, width: w, height: Math.round(w * 9 / 16) };
}

/* opts.motion — 'full'|'lite'|'off' (по умолчанию 'full', как раньше).
   opts.prefs — значения LC.pref (lumen_slideshow/lumen_slide_interval);
   отсутствующий ключ возвращает переданный в LC.pref() def — так же, как
   настоящий LC.pref читает Storage с фолбэком на default параметра. */
function freshLC(opts) {
  opts = opts || {};
  loaders = [];
  timers = [];
  intervals = [];
  warnLog.length = 0;
  globalThis.$ = fakeQuery;
  globalThis.Image = FakeImage;
  globalThis.setTimeout = fakeSetTimeout;
  globalThis.clearTimeout = fakeClearTimeout;
  globalThis.setInterval = fakeSetInterval;
  globalThis.clearInterval = fakeClearInterval;

  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '35_cardinfo.js');
  LC.motionMode = () => (opts.motion || 'full');
  const prefs = opts.prefs || {};
  LC.pref = function (name, def) {
    return Object.prototype.hasOwnProperty.call(prefs, name) ? prefs[name] : def;
  };
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

/* ====================================================================== */
/* Task 6 Step 1/2 (TDD): LC.backdrops.pickBackdrops — чистая функция,     */
/* грузится через общий test/_load.mjs (не через freshLC() выше — та      */
/* заглушка нужна только коду, трогающему $/Image/document/таймеры).      */
/* Правки координатора: ожидание теста исправлено на ['/main','/c','/a']  */
/* (у /d ширина 800 — в конце очереди, в max=3 не попадает); логика       */
/* pickBackdrops — как в черновике Step 2, без изменений. */
/* ====================================================================== */

test('pickBackdrops: без текста, по рейтингу, не больше max, без дублей главного', () => {
  const b = load('50_backdrops.js');
  const images = { backdrops: [mk('/a', null, 5), mk('/b', 'en', 9), mk('/c', null, 7), mk('/d', null, 6, 800), mk('/main', null, 8)] };
  const r = b.pickBackdrops(images, '/main', 3);
  assert.deepEqual(r, ['/main', '/c', '/a']);
});

test('pickBackdrops: пусто -> только главный', () => {
  const b = load('50_backdrops.js');
  assert.deepEqual(b.pickBackdrops(null, '/m', 5), ['/m']);
});

test('pickBackdrops: нет ничего -> []', () => {
  const b = load('50_backdrops.js');
  assert.deepEqual(b.pickBackdrops({ backdrops: [] }, null, 5), []);
});

/* ====================================================================== */
/* Task 6 Step 3/4/5: слайдшоу кадров внутри .lumen-backdrop.               */
/* ====================================================================== */

test('slideshow: смена кадра по таймеру (fake setInterval), следующий кадр показывается только после onload', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true, lumen_slide_interval: '14' } });
  const body = fakeBody();
  const movie = {
    id: 1, backdrop_path: '/main.jpg',
    images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7), mk('/a.jpg', null, 5)] }
  };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload(); // первый кадр — уже загружался apply(), второй раз не грузим

  assert.equal(intervals.length, 1, 'должен завестись один таймер ротации');
  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);

  fireInterval(1);
  assert.equal(loaders.length, 2, 'следующий кадр должен предзагружаться (второй Image())');
  loaders[1].onload();

  assert.equal(img0.hasClass('is-active'), false, 'первый кадр больше не активен (кроссфейд)');
  const slides = layer.children('.lumen-bg__slides');
  assert.equal(slides._children.length, 1);
  assert.equal(slides._children[0].hasClass('is-active'), true);
  assert.ok(String(slides._children[0]._css['background-image']).includes('c.jpg'), 'должен показаться /c.jpg (выше рейтингом, чем /a.jpg)');
});

test('slideshow: битый кадр (onerror) пропускается — показывается следующий рабочий кадр очереди', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = {
    id: 1, backdrop_path: '/main.jpg',
    images: { backdrops: [mk('/main.jpg', null, 9), mk('/broken.jpg', null, 7), mk('/ok.jpg', null, 5)] }
  };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();

  fireInterval(1);
  assert.equal(loaders.length, 2);
  loaders[1].onerror(); // /broken.jpg не загрузился

  assert.equal(loaders.length, 3, 'после битого кадра слайдшоу само пробует следующий по очереди в этот же тик');
  loaders[2].onload();

  const slides = layer.children('.lumen-bg__slides');
  assert.equal(slides._children.length, 1, 'битый кадр не должен был создать DOM-узел');
  assert.equal(slides._children[0].hasClass('is-active'), true);
  assert.ok(String(slides._children[0]._css['background-image']).includes('ok.jpg'));
});

test('slideshow: LC.backdrops.cancel(body) останавливает таймер ротации и предзагрузку следующего кадра', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  mount(body._children[0]);
  loaders[0].onload();
  assert.equal(intervals.length, 1);

  fireInterval(1); // запрос второго кадра в процессе (ещё не onload)
  assert.equal(loaders.length, 2);

  LC.backdrops.cancel(body);
  assert.equal(intervals[0].cleared, true, 'таймер ротации должен быть очищен');
  assert.equal(loaders[1].onload, null, 'предзагрузка следующего кадра должна быть отменена');
  assert.equal(loaders[1].onerror, null);

  assert.doesNotThrow(() => LC.backdrops.cancel(body)); // идемпотентно, как и cancel загрузки первого кадра
});

test('slideshow: pause() останавливает таймер, resume() заводит новый (с актуальным интервалом)', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  const slideshow = LC.backdrops.apply(null, body, movie);
  mount(body._children[0]);
  loaders[0].onload();
  assert.equal(intervals.length, 1);

  slideshow.pause();
  assert.equal(intervals[0].cleared, true);

  fireInterval(1); // тик после pause — ничего не должно произойти
  assert.equal(loaders.length, 1);

  slideshow.resume();
  assert.equal(intervals.length, 2, 'resume должен завести новый таймер');
  assert.equal(intervals[1].cleared, false);
});

test('slideshow: LC.motionMode() = off -> один кадр без смены, таймер не заводится', () => {
  const LC = freshLC({ motion: 'off', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = {
    id: 1, backdrop_path: '/main.jpg',
    images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7), mk('/a.jpg', null, 5)] }
  };

  LC.backdrops.apply(null, body, movie);
  mount(body._children[0]);
  loaders[0].onload();

  assert.equal(intervals.length, 0);
  assert.equal(loaders.length, 1, 'дополнительные кадры не должны предзагружаться в режиме off');
});

test('slideshow: lumen_slideshow = false -> первый кадр показывается (наезд Ken Burns), но ротация не заводится', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: false } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 0, 'при выключенной настройке ротация не запускается');
});

test('slideshow: максимум кадров по режиму движения (pickBackdrops max: full=8, lite=4)', () => {
  const many = [mk('/main.jpg', null, 9)];
  for (let i = 0; i < 10; i++) many.push(mk('/f' + i + '.jpg', null, 5 + i));
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: many } };

  const captured = [];
  ['full', 'lite'].forEach((motion) => {
    const LC = freshLC({ motion, prefs: { lumen_slideshow: true } });
    const original = LC.backdrops.pickBackdrops;
    LC.backdrops.pickBackdrops = function (images, main, max) { captured.push(max); return original(images, main, max); };
    const body = fakeBody();
    LC.backdrops.apply(null, body, movie);
    mount(body._children[0]);
    loaders[0].onload();
  });
  assert.deepEqual(captured, [8, 4]);
});

/* ====================================================================== */
/* Task 6 (fix, решение координатора по live-check п.4): пауза при уходе   */
/* вглубь — без подписки, проверкой isLayerForeground() в каждом тике.     */
/* ====================================================================== */

test('slideshow: activity--active отсутствует у closest(\'.activity\') -> тик пропущен целиком (нет Image, is-active не меняется), таймер не тронут', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 1, 'таймер должен быть заведён (карточка на экране в момент запуска)');

  // Карточка "ушла вглубь": её .activity больше не активна.
  layer._closestActivity = { length: 1, hasClass: () => false };

  fireInterval(1);
  assert.equal(loaders.length, 1, 'предзагрузка следующего кадра не должна была начаться');
  assert.equal(img0.hasClass('is-active'), true, 'is-active первого кадра не должен был снятся');
  assert.equal(intervals[0].cleared, false, 'таймер не трогаем — следующий тик проверит заново');

  fireInterval(1); // ещё тик — карточка всё ещё не на экране, повторный пропуск
  assert.equal(loaders.length, 1);
});

test('slideshow: activity--active появляется у closest(\'.activity\') -> следующий тик снова меняет кадр', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();

  layer._closestActivity = { length: 1, hasClass: () => false }; // не на экране
  fireInterval(1);
  assert.equal(loaders.length, 1, 'пока не на экране — без предзагрузки');

  layer._closestActivity = { length: 1, hasClass: (c) => c === 'activity--active' }; // снова на экране
  fireInterval(1);
  assert.equal(loaders.length, 2, 'вернулись на экран — тик снова предзагружает следующий кадр');
  loaders[1].onload();

  const slides = layer.children('.lumen-bg__slides');
  assert.equal(slides._children.length, 1);
  assert.equal(slides._children[0].hasClass('is-active'), true);
});

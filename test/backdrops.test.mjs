import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';
import { fakeQuery, fakeBody, mount } from './_fakedom.mjs';

/* Task 5b (правки координатора): 50_backdrops.js — не «чистый» модуль
   (трогает $/Image/document/setTimeout/window.Lampa), поэтому у него нет
   module.exports и его нельзя грузить через test/_load.mjs (как cardinfo/
   util/icons/template). Здесь — свой минимальный загрузчик + фейковые
   $/Image/document/таймеры, ровно в объёме, который нужен для проверки:
   гонки двух apply() подряд (п.2 — отмена + счётчик поколения), таймаута
   8с (Step 3), LC.backdrops.cancel (п.4) и того, что исключение в finish()
   не выходит наружу (п.3). LC.cardinfo (bgMode/backdropPath/imageUrl)
   грузится настоящий — эта логика уже покрыта test/cardinfo.test.mjs,
   здесь не переизобретается. Фейковый $/DOM (FakeEl/fakeQuery/EMPTY) —
   общий с test/slideshow.test.mjs, вынесен в test/_fakedom.mjs (Task 6,
   fix, обзор координатора п.6). */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

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
  /* Task 6 (refactor): apply() зовёт LC.slideshow.create(...) — сам
     контроллер и его тесты теперь в test/slideshow.test.mjs, но
     50_backdrops.js без него не соберётся. */
  loadInto(LC, module, '51_slideshow.js');
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
/* Task 6 (refactor, решение координатора): контроллер слайдшоу и его      */
/* тесты (ротация/pause/resume/destroy/foreground) переехали в             */
/* test/slideshow.test.mjs (src/51_slideshow.js, LC.slideshow.create).     */
/* Здесь остаётся только интеграционная проверка: apply() правильно        */
/* передаёт controller дальше и cancel() правильно его останавливает —     */
/* это про ПРОВОДКУ 50_backdrops.js, а не про поведение самого             */
/* контроллера. */
/* ====================================================================== */

test('apply()/cancel(): контроллер слайдшоу создаётся, активируется при загрузке первого кадра, cancel() его останавливает', () => {
  const LC = freshLC({ motion: 'full', prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  const controller = LC.backdrops.apply(null, body, movie);
  assert.equal(typeof controller.pause, 'function');
  assert.equal(typeof controller.resume, 'function');
  assert.equal(typeof controller.destroy, 'function');

  const layer = mount(body._children[0]);
  loaders[0].onload(); // первый кадр — уже загружался apply(), controller.activate() вызывается изнутри finish(true)

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 1, 'должен завестись таймер ротации');

  fireInterval(1); // запрос второго кадра в процессе (ещё не onload)
  assert.equal(loaders.length, 2);

  LC.backdrops.cancel(body);
  assert.equal(intervals[0].cleared, true, 'таймер ротации должен быть очищен');
  assert.equal(loaders[1].onload, null, 'предзагрузка следующего кадра должна быть отменена');
  assert.equal(loaders[1].onerror, null);

  assert.doesNotThrow(() => LC.backdrops.cancel(body)); // идемпотентно, как и cancel загрузки первого кадра
});

test('apply(): urls (pickBackdrops + max по режиму) считаются до вызова LC.slideshow.create, даже для режима off', () => {
  const many = [mk('/main.jpg', null, 9)];
  for (let i = 0; i < 10; i++) many.push(mk('/f' + i + '.jpg', null, 5 + i));
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: many } };

  const captured = [];
  ['full', 'lite', 'off'].forEach((motion) => {
    const LC = freshLC({ motion, prefs: { lumen_slideshow: true } });
    const originalCreate = LC.slideshow.create;
    LC.slideshow.create = function (layer, urls, opts) { captured.push(urls.length); return originalCreate(layer, urls, opts); };
    const body = fakeBody();
    LC.backdrops.apply(null, body, movie);
  });
  assert.deepEqual(captured, [8, 4, 1]);
});

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
  /* Task 38: размер в адресе проверяется наравне с именем файла. Блюр из CSS
     снят, и мягкость фона держится теперь только на апскейле крошечной
     картинки — откат к w500 не уронил бы ни один другой тест, а фон просто
     перестал бы быть размытым. */
  assert.ok(String(img._css['background-image']).includes('/w92/poster.jpg'),
    'мягкость даёт апскейл, а не фильтр: размер обязан остаться крошечным');
});

/* Task 39: кадр карточки — полноэкранный, поэтому размер выбирается по
   физической ширине экрана: до Full HD включительно w1280, шире — original.
   Постер размытого фона (Task 38) от DPR не зависит вовсе. */
test('Task 39: размер кадра по физическим пикселям, w92 размытого фона не меняется', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'innerWidth');
  const prevW = globalThis.innerWidth;
  const prevD = globalThis.devicePixelRatio;
  globalThis.innerWidth = 1920;
  globalThis.devicePixelRatio = 1;
  try {
    let LC = freshLC();
    let body = fakeBody();
    LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg', poster_path: '/poster.jpg' });
    mount(body._children[0]);
    assert.ok(loaders[0].src.includes('/w1280/'), '1920 физических — w1280: ' + loaders[0].src);

    globalThis.devicePixelRatio = 2;
    LC = freshLC();
    body = fakeBody();
    LC.backdrops.apply(null, body, { id: 2, backdrop_path: '/a.jpg', poster_path: '/poster.jpg' });
    const layer = mount(body._children[0]);
    assert.ok(loaders[0].src.includes('/original/'), '1920 × DPR 2 = 3840 физических — original: ' + loaders[0].src);

    /* Кадр не пришёл — фон собирается из постера, и он крошечный при любом DPR. */
    fireTimer(1);
    assert.ok(String(layer.children('.lumen-backdrop__img')._css['background-image']).includes('/w92/poster.jpg'));
  } finally {
    globalThis.devicePixelRatio = prevD;
    if (had) globalThis.innerWidth = prevW; else delete globalThis.innerWidth;
  }
});

/* Task 39: кадры слайдшоу лежат на том же полноэкранном слое, что и первый
   кадр, — размер у них общий. */
test('Task 39: кадры слайдшоу просятся в тот же размер, что и первый кадр', () => {
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'innerWidth');
  const prevW = globalThis.innerWidth;
  const prevD = globalThis.devicePixelRatio;
  globalThis.innerWidth = 1920;
  globalThis.devicePixelRatio = 2;
  try {
    const LC = freshLC();
    const body = fakeBody();
    LC.backdrops.apply(null, body, {
      id: 3, backdrop_path: '/a.jpg',
      images: { backdrops: [mk('/a.jpg', null, 8), mk('/b.jpg', null, 7), mk('/c.jpg', null, 6)] }
    });
    const layer = mount(body._children[0]);
    const urls = layer.data('lumenUrls');
    assert.ok(urls.length > 1, 'слайдшоу собрано из нескольких кадров');
    urls.forEach((u) => assert.ok(String(u).includes('/original/'), 'кадр слайдшоу: ' + u));
  } finally {
    globalThis.devicePixelRatio = prevD;
    if (had) globalThis.innerWidth = prevW; else delete globalThis.innerWidth;
  }
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
/* Task 7: трейлер живёт на том же слое (layer.data('lumenTrailer'),       */
/* кладёт LC.trailer.schedule) и гаснет вместе со слайдшоу — так           */
/* остановка достаётся бесплатно и своей карточке (cancel на destroy), и   */
/* осиротевшим карточкам из истории Lampa, без обратной зависимости        */
/* 50_backdrops.js от 55_trailer.js.                                       */
/* ====================================================================== */

test('Task 7: ensureLayer создаёт .lumen-bg__trailer — после кадров слайдшоу, но до вуалей', () => {
  const LC = freshLC();
  const body = fakeBody();
  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = body._children[0];

  const order = layer._children.map((c) => c._class[0]);
  const slides = order.indexOf('lumen-bg__slides');
  const trailer = order.indexOf('lumen-bg__trailer');
  const veil = order.indexOf('lumen-backdrop__veil');

  assert.ok(trailer !== -1, 'узел трейлера должен быть в слое');
  assert.ok(slides < trailer, 'трейлер идёт после кадров слайдшоу');
  assert.ok(trailer < veil, 'вуали обязаны рисоваться поверх ролика (порядок в DOM, без z-index)');
});

test('Task 7: cancel гасит трейлер и снимает ссылку — повторный вызов мёртвый контроллер не дёргает', () => {
  const LC = freshLC();
  const body = fakeBody();
  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);

  let destroyed = 0;
  layer.data('lumenTrailer', { destroy() { destroyed++; } });

  LC.backdrops.cancel(body);
  assert.equal(destroyed, 1);
  assert.equal(layer.data('lumenTrailer'), undefined);

  LC.backdrops.cancel(body);
  assert.equal(destroyed, 1, 'второй cancel не должен звать destroy повторно');
  assert.deepEqual(warnLog, []);
});

test('Task 7: повторный apply на том же слое снимает трейлер предыдущей карточки', () => {
  const LC = freshLC();
  const body = fakeBody();
  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);

  let destroyed = 0;
  layer.data('lumenTrailer', { destroy() { destroyed++; } });

  LC.backdrops.apply(null, body, { id: 2, backdrop_path: '/b.jpg' });
  assert.equal(destroyed, 1, 'новая карточка на том же слое не должна оставлять играть чужой ролик');
});

/* Ревью: revive() зовут ровно тогда, когда слой побывал ВНЕ DOM (Lampa тихо
   убрала карточку на 2+ уровня истории, без события 'destroy'). У трейлера,
   в отличие от слайдшоу, нет страховки тиком: без явного гашения его alive
   остался бы true, а классы lumen-trailer-on/-live висели бы на карточке,
   которую сейчас переоткрывают — после backward() она показалась бы в режиме
   трейлера (описание, рейтинги, боковая колонка и ряд серий скрыты
   display:none !important) без самого ролика. */
test('Task 7 (ревью): revive() гасит трейлер слоя и снимает ссылку', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload(); // слайдшоу активировано

  let destroyed = 0;
  layer.data('lumenTrailer', { destroy() { destroyed++; } });
  layer.data('lumenSlideshow').destroy(); // страховка isLayerMounted() в реальности

  const newCtrl = LC.backdrops.revive(layer);

  assert.ok(newCtrl, 'слайдшоу должно ожить');
  assert.equal(destroyed, 1, 'трейлер обязан гаснуть вместе с оживлением слоя');
  assert.equal(layer.data('lumenTrailer'), undefined, 'ссылка на мёртвый трейлер не должна оставаться на слое');
});

test('Task 7 (ревью): трейлер гаснет даже когда revive() выходит рано (оживлять слайдшоу нечего)', () => {
  const LC = freshLC();
  /* Слой без lumenUrls — apply() на нём не вызывался: revive вернёт null,
     но слой всё равно побывал вне DOM, поэтому трейлер обязан быть снят. */
  const layer = mount(fakeQuery('<div class="lumen-backdrop"><div class="lumen-backdrop__img"></div><div class="lumen-bg__slides"></div></div>'));
  let destroyed = 0;
  layer.data('lumenTrailer', { destroy() { destroyed++; } });

  assert.equal(LC.backdrops.revive(layer), null);
  assert.equal(destroyed, 1);
  assert.equal(layer.data('lumenTrailer'), undefined);
});

test('Task 7: исключение в destroy трейлера не ломает cancel', () => {
  const LC = freshLC();
  const body = fakeBody();
  LC.backdrops.apply(null, body, { id: 1, backdrop_path: '/a.jpg' });
  const layer = mount(body._children[0]);
  layer.data('lumenTrailer', { destroy() { throw new Error('boom'); } });

  assert.doesNotThrow(() => LC.backdrops.cancel(body));
  assert.equal(layer.data('lumenTrailer'), undefined);
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

/* ====================================================================== */
/* Task 6 (fix, обзор координатора, Important 3): LC.backdrops.revive()   */
/* — настоящий (не заглушка), в т.ч. составной селектор                   */
/* '.lumen-bg__img.is-active', который до правки test/_fakedom.mjs         */
/* (find/children — теперь по всем классам селектора) никогда не находился.*/
/* ====================================================================== */

test('revive() (fix, Important 3, а): смерть на кадре-слайде -> img0 получает его фон и is-active, новый контроллер стартует; старый слайд убирается через CROSSFADE_MS (Minor 2)', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };

  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload(); // первый кадр активирует слайдшоу

  fireInterval(1); // 0 -> 1 (кадр-слайд)
  loaders[1].onload();

  const img0 = layer.children('.lumen-backdrop__img');
  const slides = layer.children('.lumen-bg__slides');
  assert.equal(img0.hasClass('is-active'), false);
  const slideEl = slides._children[0];
  assert.equal(slideEl.hasClass('is-active'), true);
  const slideBg = slideEl._css['background-image'];

  const oldCtrl = layer.data('lumenSlideshow');
  oldCtrl.destroy(); // симулирует то, что в реальности делает страховка isLayerMounted()

  const newCtrl = LC.backdrops.revive(layer);

  assert.ok(newCtrl, 'revive должен вернуть новый контроллер');
  assert.notEqual(newCtrl, oldCtrl);
  assert.equal(newCtrl.isAlive(), true);
  assert.equal(img0.hasClass('is-active'), true, 'img0 должен стать активным');
  assert.equal(img0.css('background-image'), slideBg, 'img0 должен получить фон бывшего активного слайда');
  assert.equal(img0.css('transform'), '', 'img0 не должен унаследовать инлайн-transform');
  assert.equal(intervals[intervals.length - 1].cleared, false, 'новый интервал ротации должен быть запущен');

  assert.equal(layer.children('.lumen-bg__slides')._children.length, 1, 'старый слайд ещё не должен быть убран сразу (защита от вспышки, Minor 2)');
  fireTimer(timers.length);
  assert.equal(layer.children('.lumen-bg__slides')._children.length, 0, 'после CROSSFADE_MS старый слайд должен быть убран');
});

test('revive() (fix, Important 3, б): пустые urls (apply на этом layer никогда не вызывался) -> null', () => {
  const LC = freshLC();
  const layer = mount(fakeQuery('<div class="lumen-backdrop"><div class="lumen-backdrop__img"></div><div class="lumen-bg__slides"></div></div>'));
  assert.equal(LC.backdrops.revive(layer), null);
});

test('revive() (fix, Important 3, в): один кадр в urls -> новый контроллер живой, но без таймера ротации', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [] } }; // только главный кадр
  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();
  assert.equal(intervals.length, 0, 'проверка: с одним кадром таймер и так не заводится');

  const oldCtrl = layer.data('lumenSlideshow');
  oldCtrl.destroy();
  const ivBefore = intervals.length;
  const newCtrl = LC.backdrops.revive(layer);

  assert.ok(newCtrl);
  assert.equal(newCtrl.isAlive(), true);
  assert.equal(intervals.length, ivBefore, 'с одним кадром revive тоже не должен заводить таймер');
});

test('revive() (fix, Minor 1): backdrop-режим, но первый кадр не загрузился (запасной blur/procedural, activate() не вызывался) -> lumen-bg__img на img0 нет, revive -> null', () => {
  const LC = freshLC();
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', poster_path: '/p.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7)] } };
  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onerror(); // первый кадр не загрузился -> showNoFrame (запасной постер), controller.activate() не вызывается

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), false, 'проверка: activate() не отработал');
  assert.ok(layer.data('lumenUrls').length > 0, 'проверка: urls непустые (иначе это тест не про Minor 1, а про Important 3б)');

  assert.equal(LC.backdrops.revive(layer), null);
});

/* ====================================================================== */
/* Task 6 (fix, 3-й раунд ревью, мутационная проверка — R1/R2/R3/R5):      */
/* смерть на кадре-слайде -> revive() ставит отложенный таймер уборки      */
/* старого слайда (Minor 2) — этот таймер обязан: (1) чиститься вместе со  */
/* слайдшоу (stopSlideshow — cancel()/apply()), (2) не переживать двойной  */
/* revive() без clearTimeout прежнего, (3) убирать ИМЕННО старый слайд, а  */
/* не всё содержимое .lumen-bg__slides (иначе сносит кадры уже НОВОГО      */
/* контроллера, если тот успел провернуть ротацию раньше). */
/* ====================================================================== */

function deathOnSlide(LC) {
  const body = fakeBody();
  const movie = { id: 1, backdrop_path: '/main.jpg', images: { backdrops: [mk('/main.jpg', null, 9), mk('/c.jpg', null, 7), mk('/d.jpg', null, 6)] } };
  LC.backdrops.apply(null, body, movie);
  const layer = mount(body._children[0]);
  loaders[0].onload();
  fireInterval(1); loaders[1].onload(); // 0 -> 1 (кадр-слайд) — смерть застаёт слайдшоу здесь
  layer.data('lumenSlideshow').destroy(); // симулирует страховку isLayerMounted()
  const c = LC.backdrops.revive(layer);
  return { body, layer, c, rid: layer.data('lumenReviveCleanup') };
}

test('revive() (fix, R1): смерть на кадре-слайде -> revive -> cancel(body) в окне CROSSFADE_MS чистит таймер уборки старого слайда', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const { body, layer, rid } = deathOnSlide(LC);
  assert.ok(rid, 'проверка: revive() должен был поставить отложенный таймер (смерть на слайде)');

  LC.backdrops.cancel(body);

  assert.equal(timers[rid - 1].cleared, true, 'таймер уборки старого слайда должен быть очищен вместе со слайдшоу');
  assert.equal(layer.data('lumenReviveCleanup'), undefined, 'layer.data должна быть снята');
});

test('revive() (fix, R2): смерть на кадре-слайде -> revive -> новый apply() (переоткрытие того же layer) в окне CROSSFADE_MS чистит таймер уборки старого слайда', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const { body, rid } = deathOnSlide(LC);

  LC.backdrops.apply(null, body, { id: 2, backdrop_path: '/z.jpg' });

  assert.equal(timers[rid - 1].cleared, true, 'apply() (через stopSlideshow) должен был очистить таймер прежнего revive()');
});

test('revive() (fix, R5): ротация нового контроллера случается РАНЬШЕ, чем сработал отложенный таймер уборки старого слайда -> кадр нового контроллера не сносится', () => {
  const LC = freshLC({ prefs: { lumen_slideshow: true } });
  const { layer, rid } = deathOnSlide(LC);

  // Тик УЖЕ НОВОГО контроллера (его свой интервал ротации, независимый от
  // CROSSFADE_MS) — успевает провернуться раньше, чем сработает reviveTimer.
  fireInterval(intervals.length);
  loaders[loaders.length - 1].onload();

  const img0 = layer.children('.lumen-backdrop__img');
  const slidesBefore = layer.children('.lumen-bg__slides')._children;
  const activeBefore = slidesBefore.filter((x) => x.hasClass('is-active'));
  assert.equal(img0.hasClass('is-active'), false, 'проверка: новый контроллер увёл активность с img0 на свежий кадр');
  assert.equal(activeBefore.length, 1, 'проверка: у нового контроллера ровно один активный кадр-слайд');
  const activeBg = activeBefore[0]._css['background-image'];

  fireTimer(rid); // срабатывает ОТЛОЖЕННЫЙ таймер уборки старого (уже неактивного) слайда

  const slidesAfter = layer.children('.lumen-bg__slides')._children;
  const activeAfter = slidesAfter.filter((x) => x.hasClass('is-active'));
  assert.equal(activeAfter.length, 1, 'активный кадр НОВОГО контроллера не должен был пострадать от отложенной уборки старого');
  assert.equal(activeAfter[0]._css['background-image'], activeBg);
});

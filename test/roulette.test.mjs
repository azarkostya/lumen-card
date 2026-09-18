import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 23 (фаза 3): рулетка «Что посмотреть» — две отдельные (фильмы и
   сериалы), выбор подборок чипами, фильтры «не смотрел» и «есть 90 минут» /
   «серия до 30 минут».

   Здесь — чистая часть (пул кандидатов, фильтры, выбор, план барабана,
   разбор сохранённого набора подборок и проверка длительности по деталям) и
   те куски рантайма, что можно спросить без DOM: список подборок для медиа и
   чтение настроек. Основной сценарий (экран, фокус, прокрутка чипов)
   проверяется живьём; Task 34 добавил в конец файла отдельный минимальный
   стенд (фейковые $/Lampa.Scroll/Controller, ручной планировщик setTimeout,
   заглушка Image) — только для поведения фона результата рулетки, самого
   уязвимого места из живой жалобы пользователя. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const SRC = readFileSync(new URL('../src/56_roulette.js', import.meta.url), 'utf8');
const UTIL = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', UTIL)(LC, module);
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const R = fresh().api;

const movie = (id, extra) => Object.assign({ id, title: 'Фильм ' + id, release_date: '2020-01-01' }, extra || {});
const show = (id, extra) => Object.assign({ id, name: 'Сериал ' + id, first_air_date: '2020-01-01' }, extra || {});

/* ====================================================================== */
/* Пул кандидатов                                                         */
/* ====================================================================== */

test('buildPool: фильмы отделяются от сериалов по полям названия и даты', () => {
  const mixed = [movie(1), show(2), movie(3), show(4)];
  assert.deepEqual(R.buildPool(mixed, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.buildPool(mixed, 'tv').map((c) => c.id), [2, 4]);
});

test('buildPool: media_type сильнее догадки по полям', () => {
  const odd = [{ id: 7, title: 'Док', media_type: 'tv' }, { id: 8, name: 'Странное', media_type: 'movie' }];
  assert.deepEqual(R.buildPool(odd, 'tv').map((c) => c.id), [7]);
  assert.deepEqual(R.buildPool(odd, 'movie').map((c) => c.id), [8]);
});

test('buildPool: дубли по id снимаются, мусор пропускается', () => {
  const list = [movie(1), movie(1), null, { title: 'без id' }, movie(2)];
  assert.deepEqual(R.buildPool(list, 'movie').map((c) => c.id), [1, 2]);
  assert.deepEqual(R.buildPool(null, 'movie'), []);
});

test('buildPool: карточки без постера не годятся — барабану нечего показать', () => {
  const list = [movie(1, { poster_path: '/a.jpg' }), movie(2, { poster_path: '' }), movie(3)];
  const pool = R.buildPool(list, 'movie', true);
  assert.deepEqual(pool.map((c) => c.id), [1], 'с требованием постера остаётся только первый');
  assert.equal(R.buildPool(list, 'movie').length, 3, 'без требования — все');
});

/* ====================================================================== */
/* Фильтры                                                               */
/* ====================================================================== */

const ctx = {
  isSeen: (id) => id === 2,
  runtime: (id) => ({ 1: 80, 2: 120, 3: null, 4: 140 }[id])
};

test('applyFilters: «не смотрел» убирает просмотренное', () => {
  const pool = [movie(1), movie(2), movie(3)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true }, ctx, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.applyFilters(pool, {}, ctx, 'movie').map((c) => c.id), [1, 2, 3]);
});

test('applyFilters: «есть 90 минут» — короткие и те, чья длительность ещё неизвестна', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, ctx, 'movie').map((c) => c.id), [1, 3],
    'неизвестная длительность (3) остаётся — её проверят после выбора');
});

test('applyFilters: у сериалов порог другой — серия до 30 минут', () => {
  const tvCtx = { isSeen: () => false, runtime: (id) => ({ 10: 25, 11: 45, 12: null }[id]) };
  const pool = [show(10), show(11), show(12)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, tvCtx, 'tv').map((c) => c.id), [10, 12]);
});

test('applyFilters: оба фильтра вместе; пустой результат — пустой массив', () => {
  const pool = [movie(1), movie(2), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, ctx, 'movie').map((c) => c.id), [1]);
  assert.deepEqual(R.applyFilters([], { unseen: true }, ctx, 'movie'), []);
  assert.deepEqual(R.applyFilters(null, {}, ctx, 'movie'), []);
});

test('applyFilters: без ctx фильтры ничего не выбрасывают — данных для отказа нет', () => {
  const pool = [movie(1), movie(2)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, null, 'movie').map((c) => c.id), [1, 2]);
});

test('shortLimit: 90 минут фильму, 30 — серии', () => {
  assert.equal(R.shortLimit('movie'), 90);
  assert.equal(R.shortLimit('tv'), 30);
});

test('fitsShort: проверка выбранного по деталям — фильм по runtime, сериал по длине серии', () => {
  assert.equal(R.fitsShort({ runtime: 88 }, 'movie'), true);
  assert.equal(R.fitsShort({ runtime: 140 }, 'movie'), false);
  assert.equal(R.fitsShort({ episode_run_time: [22, 25] }, 'tv'), true);
  assert.equal(R.fitsShort({ episode_run_time: [52] }, 'tv'), false);
  assert.equal(R.fitsShort({ episode_run_time: [] }, 'tv'), true, 'нечего проверить — кандидат остаётся');
  assert.equal(R.fitsShort(null, 'movie'), true, 'деталей нет — не отказываем');
  assert.equal(R.fitsShort({ runtime: 0 }, 'movie'), true, 'ноль у TMDB означает «неизвестно»');
});

/* ====================================================================== */
/* Выбор и барабан                                                        */
/* ====================================================================== */

test('pick: равномерный выбор из пула', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.equal(R.pick(pool, () => 0).id, 1);
  assert.equal(R.pick(pool, () => 0.999).id, 4);
  assert.equal(R.pick(pool, () => 0.5).id, 3);
  assert.equal(R.pick([], Math.random), null);
  assert.equal(R.pick(null, Math.random), null);
});

test('pick: за много бросков достаются все элементы пула', () => {
  const pool = [movie(1), movie(2), movie(3)];
  const seen = new Set();
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 200; i++) seen.add(R.pick(pool, rnd).id);
  assert.equal(seen.size, 3);
});

test('spinPlan: разгон, вращение, торможение — 3100 мс ± 50, последний шаг на результате', () => {
  const plan = R.spinPlan(10);
  assert.ok(plan.length > 10, 'шагов должно быть больше, чем позиций ленты: ' + plan.length);
  const total = plan.reduce((sum, s) => sum + s.delay, 0);
  assert.ok(Math.abs(total - 3100) <= 50, 'длительность спина: ' + total);
  assert.equal(plan[plan.length - 1].index, 9, 'последний шаг — выбранный кадр (конец ленты)');
  for (const step of plan) {
    assert.ok(step.index >= 0 && step.index < 10, 'индекс вне ленты: ' + step.index);
    assert.ok(step.delay > 0);
  }
});

test('spinPlan: барабан ускоряется, потом тормозит', () => {
  const plan = R.spinPlan(12);
  const first = plan[0].delay;
  const middle = plan[Math.floor(plan.length / 2)].delay;
  const last = plan[plan.length - 1].delay;
  assert.ok(middle < first, 'в середине шаги чаще, чем в начале');
  assert.ok(last > middle, 'к концу барабан замедляется');
});

test('spinPlan: короткая лента и вырожденные значения', () => {
  assert.deepEqual(R.spinPlan(0), []);
  assert.deepEqual(R.spinPlan(1), [{ index: 0, delay: 0 }], 'один кандидат — крутить нечего');
  const plan = R.spinPlan(2);
  assert.equal(plan[plan.length - 1].index, 1);
});

/* ====================================================================== */
/* Подборки и сохранённый выбор                                           */
/* ====================================================================== */

const manifest = {
  home: ['trend', 'marvel'],
  collections: [
    { id: 'trend', title: 'В тренде', group: 'top', sources: { movie: { type: 'discover' }, tv: { type: 'discover' } } },
    { id: 'marvel', title: 'Marvel', group: 'franchise', sources: { movie: { type: 'collection', id: 1 } } },
    { id: 'hbo', title: 'HBO', group: 'studio', sources: { tv: { type: 'discover' } } },
    { id: 'kp', title: 'Кинопоиск', group: 'kp', sources: { movie: { type: 'kp', collection: 'TOP' } } }
  ]
};

test('collectionsFor: только подборки с источником нужного медиа, подборки главной первыми', () => {
  const movies = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(movies.map((c) => c.id), ['trend', 'marvel', 'kp']);
  const tv = R.collectionsFor(manifest, 'tv');
  assert.deepEqual(tv.map((c) => c.id), ['trend', 'hbo']);
  assert.deepEqual(R.collectionsFor(null, 'movie'), []);
});

test('chipList: на экране не весь каталог, но отмеченное видно всегда', () => {
  const list = [];
  for (let i = 0; i < 30; i++) list.push({ id: 'c' + i, title: 'c' + i });
  const shown = R.chipList(list, [], 14);
  assert.equal(shown.length, 14, 'предел соблюдён');
  assert.deepEqual(shown.map((c) => c.id), list.slice(0, 14).map((c) => c.id));

  const withPicked = R.chipList(list, ['c25'], 14);
  assert.equal(withPicked.length, 15, 'отмеченная подборка добавлена сверх предела');
  assert.equal(withPicked[withPicked.length - 1].id, 'c25');

  const already = R.chipList(list, ['c2'], 14);
  assert.equal(already.length, 14, 'отмеченная внутри предела второй раз не добавляется');
  assert.deepEqual(R.chipList([], ['c1'], 14), []);
  assert.deepEqual(R.chipList(null, [], 14), []);
});

test('parseIds / joinIds: сохранённый набор подборок — строка через запятую', () => {
  assert.deepEqual(R.parseIds('trend,marvel'), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(' trend , , marvel '), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(''), []);
  assert.deepEqual(R.parseIds(null), []);
  assert.equal(R.joinIds(['trend', 'marvel']), 'trend,marvel');
  assert.equal(R.joinIds([]), '');
});

test('sourcesFor: пустой выбор — подборки главной, иначе выбранные, не больше предела', () => {
  const all = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(R.sourcesFor(all, [], manifest).map((c) => c.id), ['trend', 'marvel'],
    '«Все» означает набор главной, а не полторы сотни запросов');
  assert.deepEqual(R.sourcesFor(all, ['kp'], manifest).map((c) => c.id), ['kp']);
  assert.deepEqual(R.sourcesFor(all, ['нет-такой'], manifest).map((c) => c.id), ['trend', 'marvel'],
    'неизвестные id — как будто выбора нет');
  const many = [];
  for (let i = 0; i < 12; i++) many.push({ id: 'c' + i, title: 'c' + i, sources: { movie: {} } });
  assert.equal(R.sourcesFor(many, many.map((c) => c.id), manifest).length, R.MAX_SOURCES);
});

/* ====================================================================== */
/* Настройки                                                              */
/* ====================================================================== */

test('unseenDefault: настройка lumen_roulette_unseen включена по умолчанию', () => {
  const on = fresh({ pref: (name, def) => def });
  assert.equal(on.api.unseenDefault(), true);
  const off = fresh({ pref: (name, def) => (name === 'lumen_roulette_unseen' ? false : def) });
  assert.equal(off.api.unseenDefault(), false);
});

test('storageKey: у фильмов и сериалов свои наборы подборок', () => {
  assert.equal(R.storageKey('movie'), 'lumen_roulette_movie');
  assert.equal(R.storageKey('tv'), 'lumen_roulette_tv');
});

test('normalizeMedia: чужое значение — фильмы', () => {
  assert.equal(R.normalizeMedia('tv'), 'tv');
  assert.equal(R.normalizeMedia('movie'), 'movie');
  assert.equal(R.normalizeMedia('мусор'), 'movie');
  assert.equal(R.normalizeMedia(undefined), 'movie');
});

/* ====================================================================== */
/* Прокрутка экрана (Task 32)                                             */
/* ====================================================================== */

/* ВНИМАНИЕ: это проверка ИСХОДНИКА, а не поведения. Компонент
   lumen_roulette в этом файле не поднимается (см. шапку: здесь только
   чистая логика, DOM-заглушек нет), а заводить ради двух вызовов целый
   фейковый DOM с событиями и десяток заглушек Lampa дороже пользы.
   Поэтому читаем текст src/56_roulette.js и убеждаемся, что обе половины
   штатного контракта прокрутки на месте; как экран листается на самом
   деле, проверяет координатор живьём на телевизоре. Поведенческие тесты
   тех же вызовов есть у хаба и сетки (test/hub.test.mjs). */

/* Кусок исходника от заголовка до строки, на которой он кончается. */
function section(from, to) {
  const start = SRC.indexOf(from);
  assert.notEqual(start, -1, 'в src/56_roulette.js не найдено: ' + from);
  const end = SRC.indexOf(to, start);
  assert.notEqual(end, -1, 'в src/56_roulette.js не найдено: ' + to);
  return SRC.slice(start, end);
}

test('исходник: create рулетки задаёт области прокрутки высоту экрана (scroll.minus)', () => {
  const create = section('this.create = function () {', 'this.render = function (js)');
  assert.ok(create.indexOf('scroll.minus();') !== -1,
    'без minus() контейнер прокрутки растянут по содержимому и экран не листается');
});

test('исходник: watchFocus рулетки подкручивает скролл к фокусу', () => {
  const watch = section('function watchFocus(node) {', 'Шапка, чипы, фильтры');
  assert.ok(watch.indexOf('keepVisible(node[0]);') !== -1,
    'через watchFocus проходят все .selector рулетки — подкрутка ставится там');
  const keep = section('function keepVisible(el) {', 'function watchFocus(node)');
  assert.ok(keep.indexOf('scroll.update(el, true)') !== -1,
    'подкрутка — штатным scroll.update, с выравниванием по центру');
});

/* ====================================================================== */
/* Фон результата рулетки (Task 34)                                       */
/* ====================================================================== */

/* Поднимаем настоящий RouletteComponent на минимальном стенде — тот же
   приём, что в test/hub.test.mjs (свой $/El, фейковый Lampa.Scroll и
   Controller), плюс то, что нужно именно здесь: ручной планировщик
   setTimeout/clearTimeout (тест сам решает, когда сработает шаг барабана —
   приём из test/util.test.mjs, test/hero.test.mjs) и заглушка window.Image
   (showResult предзагружает кадр через неё, Task 34). this.start() тоже
   нужен (перезапуск предзагрузки после stop()/start()) — Navigator и
   Lampa.Activity не заводим: navMove() внутри this.start() не зовётся из
   наших тестов, а Lampa.Activity.active() — в try/catch, без него просто
   тихо не отфильтрует активность.

   openRoulette34(cards, t) подменяет globalThis.window/Lampa/$/Image/
   setTimeout/clearTimeout и возвращает их через t.after(...) — так финал
   каждого теста восстанавливает окружение, даже если тест упал по assert
   (в отличие от «один раз в конце файла»): без этого первый же тест,
   дописанный в конец файла ПОСЛЕ этого блока, унаследовал бы подменённый
   setTimeout и завис бы на реальной сети. */

function El(classes) {
  this._class = classes || [];
  this._children = [];
  this._ev = {};
  this._css = {};
  this.length = 1;
  this[0] = this;
}
El.prototype.addClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { if (c && self._class.indexOf(c) < 0) self._class.push(c); });
  return this;
};
El.prototype.removeClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { var i = self._class.indexOf(c); if (i >= 0) self._class.splice(i, 1); });
  return this;
};
El.prototype.hasClass = function (c) { return this._class.indexOf(c) >= 0; };
El.prototype.append = function (child) { this._children.push(child); return this; };
El.prototype.empty = function () { this._children = []; return this; };
El.prototype.remove = function () { return this; };
El.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
El.prototype.on = function (name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return this; };
El.prototype.show = function () { return this; };
El.prototype.hide = function () { return this; };
El.prototype.all = function (sel) {
  var cls = sel.replace(/^\./, '');
  var out = [];
  (function walk(node) {
    for (var i = 0; i < node._children.length; i++) {
      var c = node._children[i];
      if (c.hasClass(cls)) out.push(c);
      walk(c);
    }
  })(this);
  return out;
};
var EMPTY_EL = new El([]);
EMPTY_EL.length = 0;
El.prototype.find = function (sel) {
  var found = this.all(sel);
  return found.length ? found[0] : EMPTY_EL;
};

function classesOf(html) {
  var m = /class="([^"]*)"/.exec('' + html);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function make$() {
  return function (arg) {
    if (arg instanceof El) return arg;
    if (typeof arg === 'string' && arg.charAt(0) === '<') {
      var tags = arg.match(/<div[^>]*>/g) || [];
      var root = new El(classesOf(tags[0]));
      for (var i = 1; i < tags.length; i++) root.append(new El(classesOf(tags[i])));
      return root;
    }
    return EMPTY_EL;
  };
}

function fire(node, name) {
  var list = (node && node._ev && node._ev[name]) || [];
  for (var i = 0; i < list.length; i++) list[i]();
}

function ElScroll() {
  var body = new El([]);
  this.append = function (el) { body.append(el); };
  this.render = function () { return body; };
  this.minus = function () { };
  this.update = function () { };
  this.destroy = function () { };
}

/* Заглушка Image: конструктор просто копится в createdImages, onload/onerror
   зовёт тест сам — ни настоящей сети, ни настоящей декодировки картинки в
   node нет и не будет. */
var createdImages = [];
function FakeImage() {
  this.onload = null;
  this.onerror = null;
  this._src = '';
  createdImages.push(this);
}
Object.defineProperty(FakeImage.prototype, 'src', {
  get: function () { return this._src; },
  set: function (v) { this._src = v; }
});

/* Ручной планировщик: setTimeout только копит колбэки, flushTimers()
   прогоняет их по одному (в порядке постановки) — так шаги барабана
   (spinPlan даёт от полусотни шагов) проходят без настоящей паузы в 3 с. */
var timers = [];
var nextTimerId = 1;
function resetTimers() { timers = []; nextTimerId = 1; }
function fakeSetTimeout(fn, ms) {
  var id = nextTimerId++;
  timers.push({ id: id, fn: fn, ms: ms, cancelled: false });
  return id;
}
function fakeClearTimeout(id) {
  for (var i = 0; i < timers.length; i++) {
    if (timers[i].id === id) timers[i].cancelled = true;
  }
}
function flushTimers() {
  var guard = 0;
  while (timers.length && guard < 2000) {
    var t = timers.shift();
    guard++;
    if (!t.cancelled) t.fn();
  }
}

var MANIFEST34 = {
  version: 1,
  home: ['col-a'],
  collections: [
    { id: 'col-a', title: 'Подборка', sources: { movie: { type: 'discover', params: {} } } }
  ]
};

var poolCards34 = [];
function fetchStub34(item, page, ok) {
  ok({ results: page === 1 ? poolCards34 : [] });
  return { clear: function () { } };
}

function backdropUrl(card) {
  return 'https://img/w1280' + card.backdrop_path;
}

/* Снимок настоящих globalThis.window/Lampa/$/Image/setTimeout/clearTimeout,
   сделанный ДО первой подмены (на момент загрузки этого файла ни один из
   них ещё не тронут — window/Lampa/$/Image в node их просто нет, отсюда
   undefined, и это тоже правильное значение для отката). restoreGlobals34()
   возвращает все шесть к этому снимку; openRoulette34 регистрирует её через
   t.after(...) на каждый тест отдельно. */
var REAL_GLOBALS34 = {
  window: globalThis.window,
  Lampa: globalThis.Lampa,
  $: globalThis.$,
  Image: globalThis.Image,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
};
function restoreGlobals34() {
  globalThis.window = REAL_GLOBALS34.window;
  globalThis.Lampa = REAL_GLOBALS34.Lampa;
  globalThis.$ = REAL_GLOBALS34.$;
  globalThis.Image = REAL_GLOBALS34.Image;
  globalThis.setTimeout = REAL_GLOBALS34.setTimeout;
  globalThis.clearTimeout = REAL_GLOBALS34.clearTimeout;
}

/* Поднимает lumen_roulette на минимальном стенде и возвращает {comp, root,
   bg}. cards — пул кандидатов, который отдаст LC.sources.fetch (одна
   подборка, одна страница с результатами — этого достаточно: pick() из
   единственного кандидата детерминирован независимо от Math.random).
   t — TestContext вызвавшего теста: им регистрируется восстановление
   глобалов после теста, что бы в нём ни случилось. */
/* Task 39: dpr — третий аргумент, потому что от него зависит размер и
   постера в барабане, и кадра под результатом. */
function openRoulette34(cards, t, dpr) {
  resetTimers();
  createdImages.length = 0;
  poolCards34 = cards;
  t.after(restoreGlobals34);

  var components = {};
  var Lampa = {
    Scroll: ElScroll,
    Component: { add: function (name, fn) { components[name] = fn; } },
    Controller: { add: function () { }, toggle: function () { }, collectionSet: function () { }, collectionFocus: function () { } },
    Menu: { addButton: function () { return new El([]); } }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920, devicePixelRatio: dpr || 1 };
  globalThis.Lampa = Lampa;
  globalThis.$ = make$();
  globalThis.Image = FakeImage;
  globalThis.setTimeout = fakeSetTimeout;
  globalThis.clearTimeout = fakeClearTimeout;

  var built = fresh({
    lang: function (k) { return k; },
    langCode: function () { return 'ru'; },
    pref: function (name, def) { return def; },
    motionMode: function () { return 'full'; },
    hub: { titleOf: function (item) { return (item && item.title) || ''; } },
    cardinfo: { imageUrl: function (path, size) { return path ? 'https://img/' + size + path : ''; } },
    rows: { viewedIds: function () { return []; } },
    manifest: { load: function (cb) { cb(MANIFEST34); } },
    sources: { fetch: fetchStub34 }
  });
  built.api.install();

  var Comp = components.lumen_roulette;
  var comp = new Comp({});
  comp.activity = { loader: function () { } };
  comp.create();
  var root = comp.render();
  return { comp: comp, root: root, bg: root.find('.lumen-roulette__bg') };
}

/* Нажимает «Крутить» и сразу прогоняет барабан до конца (все его шаги —
   через ручной планировщик). После возврата showResult уже вызван, но
   предзагрузка кадра (если backdrop_path есть) ещё не завершена — её
   отдельно резолвит тест через createdImages. */
function spinAndFlush(env) {
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  flushTimers();
}

test('spin(): фон прошлого результата снимается до прокрутки барабана, не после', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  createdImages[createdImages.length - 1].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'первый результат показал свой фон');

  /* Второе «Крутить»: пул уже в кэше (loadPool отдаёт его синхронно), но
     сама прокрутка барабана идёт через таймеры — до flushTimers() фон
     обязан быть уже снят, а не всё ещё держать кадр фильма A. */
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(env.bg.css('background-image'), '', 'фон снят сразу — до прокрутки, а не после её конца');
  flushTimers();
});

test('showResult: карточка без backdrop_path оставляет фон пустым, а не прошлым кадром', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const B = { id: 2, title: 'Фильм B', release_date: '2020-01-01', poster_path: '/b-p.jpg', backdrop_path: '' };
  /* Оба кандидата — в пуле с самого начала. loadPool кэширует пул по ключу
     «медиа + набор подборок»: без смены чипов второе «Крутить» сеть не
     перезапрашивает, оно просто выбирает элемент из уже загруженного —
     поэтому подмена poolCards34 ПОСЛЕ первого спина на выбор второго не
     влияет никак (ровно так уже один раз ошибочно было устроено здесь: B
     в пул не попадал, и тест был зелёным по факту, что B вообще не
     выбирался). Чтобы вторым спином гарантированно достался B, здесь
     подменяется Math.random — тем же приёмом, что и в тесте про поздний
     onload ниже. */
  const env = openRoulette34([A, B], t);
  const realRandom = Math.random;
  try {
    Math.random = function () { return 0; };
    spinAndFlush(env);
    createdImages[0].onload();
    assert.notEqual(env.bg.css('background-image'), '', 'подготовка: у фильма A фон есть');

    Math.random = function () { return 0.9; };
    spinAndFlush(env);
    assert.equal(env.bg.css('background-image'), '', 'у фильма B backdrop_path пуст — фон пустой, а не фон фильма A');
    assert.equal(createdImages.length, 1, 'у B нет кадра — loadResultBg на пустой backdrop_path новую предзагрузку не запускает');
  } finally {
    Math.random = realRandom;
  }
});

test('showResult: фон появляется только после onload картинки, до этого пусто', (t) => {
  const C = { id: 3, title: 'Фильм C', release_date: '2020-01-01', poster_path: '/c-p.jpg', backdrop_path: '/c-b.jpg' };
  const env = openRoulette34([C], t);
  spinAndFlush(env);
  assert.equal(env.bg.css('background-image'), '', 'до onload фон ещё не поставлен');
  assert.equal(createdImages.length, 1, 'предзагрузка кадра запущена — Image создан');
  assert.equal(createdImages[0].src, backdropUrl(C));
  createdImages[0].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(C) + '")');
});

test('showResult: поздний onload от прошлого запроса чужой кадр не ставит', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const C = { id: 3, title: 'Фильм C', release_date: '2020-01-01', poster_path: '/c-p.jpg', backdrop_path: '/c-b.jpg' };
  /* Оба кандидата — в одном и том же пуле с самого начала (см. предыдущий
     тест — почему не через смену poolCards34). Math.random подменяется,
     чтобы первый спин детерминированно достался A, а второй — C. */
  const env = openRoulette34([A, C], t);
  const realRandom = Math.random;
  try {
    Math.random = function () { return 0; };
    spinAndFlush(env);
    const staleOnload = createdImages[0].onload;
    assert.equal(typeof staleOnload, 'function');

    /* Второй спин запускается, НО НЕ прогоняется до конца — это и есть то
       самое временнóе окно, ради которого заведён cancelResultLoader:
       барабан ещё крутится, showResult(C) ещё не было. */
    Math.random = function () { return 0.9; };
    fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');

    /* Первая защита: cancelResultLoader() отработал СИНХРОННО, первой же
       строкой spin() (через clearResult()), поэтому у ИСТИНСКОГО объекта
       Image A обработчик уже снят. Ответь сеть сейчас по-настоящему — она
       не попала бы никуда, потому что вызывать нечего. */
    assert.equal(createdImages[0].onload, null,
      'onload у объекта Image A снят ДО конца прокрутки, а не только после showResult(C)');

    /* Вторая, независимая защита — на случай, если бы отмена почему-то не
       сработала: staleOnload — СОХРАНЁННАЯ ссылка на исходную функцию,
       вызов в обход отменённого свойства img.onload. clearResult() в
       начале spin() уже сбросила result в null (пока крутится барабан,
       подтверждённого результата нет — см. её комментарий в
       src/56_roulette.js), поэтому проверка result !== card внутри
       замыкания (null !== A) блокирует запись и тут: даже синтетический
       обход отменённого обработчика чужой кадр не ставит. */
    staleOnload();
    assert.equal(env.bg.css('background-image'), '',
      'синтетический вызов снятого обработчика — заблокирован проверкой result !== card (result уже null)');

    flushTimers();
    createdImages[createdImages.length - 1].onload();
    assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(C) + '")', 'актуальный onload по-прежнему работает');
  } finally {
    Math.random = realRandom;
  }
});

test('stop() → start(): фон, не успевший загрузиться до ухода с экрана, поднимается заново', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  assert.equal(createdImages.length, 1, 'подготовка: предзагрузка кадра A запущена');

  /* «Смотреть» → openCard → Lampa снимает слайд и зовёт stop(): bump()
     поднимает gen и cancelResultLoader() гасит недогруженную картинку —
     onload у неё пропадает, не долетев. */
  env.comp.stop();
  assert.equal(createdImages[0].onload, null, 'stop() погасил недогруженную предзагрузку');
  assert.equal(env.bg.css('background-image'), '', 'фон так и остался пустым — картинка не успела');

  /* «Назад»: Lampa возвращает слайд и зовёт start() — result (A) всё ещё
     на месте (его снимает только clearResult, а не bump/stop), а фон под
     ним не показан (resultBgShown=false) — предзагрузка перезапускается. */
  env.comp.start();
  assert.equal(createdImages.length, 2, 'start() запросил кадр A заново');
  assert.equal(createdImages[1].src, backdropUrl(A));
  createdImages[1].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'фон результата восстановился после stop()/start()');
});

test('stop() → start(): уже показанный фон повторно не перезагружается', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  createdImages[0].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'подготовка: фон A уже показан до ухода с экрана');

  env.comp.stop();
  env.comp.start();
  assert.equal(createdImages.length, 1, 'фон уже был показан (resultBgShown) — новой предзагрузки start() не запускает');
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'фон остался тем же');
});

/* Task 39: размеры считаются по физическим пикселям. Барабан —
   .lumen-roulette__reel шириной 9.2em (210 px на экране 1920, 420 при
   DPR 2), фон результата растянут на весь экран. */
test('Task 39: постер барабана и фон результата — по физическим пикселям', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };

  const one = openRoulette34([A], t);
  spinAndFlush(one);
  assert.ok(('' + one.root.find('.lumen-roulette__frame').css('background-image')).indexOf('/w185/a-p.jpg') !== -1,
    'барабан на экране 1920 — w185');
  assert.equal(createdImages[createdImages.length - 1].src, 'https://img/w1280/a-b.jpg', 'фон на экране 1920 — w1280');

  const two = openRoulette34([A], t, 2);
  spinAndFlush(two);
  assert.ok(('' + two.root.find('.lumen-roulette__frame').css('background-image')).indexOf('/w500/a-p.jpg') !== -1,
    'барабан при DPR 2 — w500');
  /* Ревью Task 39 (п.1): фон результата — кадр-подложка (opacity .22), у
     него потолок w1280, а не original. */
  assert.equal(createdImages[createdImages.length - 1].src, 'https://img/w1280/a-b.jpg', 'фон при DPR 2 — по-прежнему w1280');
});

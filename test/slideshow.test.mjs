import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 6 (refactor, решение координатора): контроллер слайдшоу выделен из
   50_backdrops.js в src/51_slideshow.js (LC.slideshow.create(layer, urls,
   opts)) — модуль сам не знает ни про TMDB/cardinfo, ни про имена настроек
   (opts.enabled/opts.intervalMs — функции, которые передаёт вызывающая
   сторона), поэтому тестируется здесь БЕЗ загрузки 50_backdrops.js/
   35_cardinfo.js/10_util.js — только сам модуль плюс минимальные DOM/
   таймер-заглушки (тот же приём, что в test/backdrops.test.mjs). Тесты
   гонки первого кадра / apply() / cancel() остаются в backdrops.test.mjs
   (они про 50_backdrops.js, а не про сам контроллер); здесь — только
   ротация, pause/resume/destroy, "не на экране" и (Task 6, fix) память и
   Ken Burns при смене кадра. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* -------------------------------------------------------------------- */
/* Мини-фейк $/DOM — копия из test/backdrops.test.mjs (та же нужна и      */
/* здесь: addClass/removeClass/toggleClass/data/removeData/css/find/      */
/* children/append/empty/closest). */
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
FakeEl.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
FakeEl.prototype.data = function (key, val) {
  if (arguments.length < 2) return this._data[key];
  this._data[key] = val;
  return this;
};
FakeEl.prototype.removeData = function (key) { delete this._data[key]; return this; };
FakeEl.prototype.append = function (child) { this._children.push(toEl(child)); return this; };
FakeEl.prototype.empty = function () { this._children = []; return this; };
/* closest('.activity') — заглушка, не настоящий обход родителей (мок их
   не моделирует). Тест выставляет el._closestActivity = {length,hasClass}
   перед тиком; по умолчанию — EMPTY (isActivityForeground трактует как
   true, безопасный дефолт). */
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

/* Слой в форме, которую строит ensureLayer() в 50_backdrops.js: первый
   кадр (.lumen-backdrop__img — уже "загружен" вызывающей стороной, как
   loadBackdrop() делает в реальности до activate()) + пустой контейнер
   для остальных кадров (.lumen-bg__slides). */
function makeLayer() {
  const layer = fakeQuery('<div class="lumen-backdrop">' +
    '<div class="lumen-backdrop__img"></div>' +
    '<div class="lumen-bg__slides"></div>' +
    '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
    '</div>');
  layer.children('.lumen-backdrop__img').css('background-image', 'url("main.jpg")');
  return layer;
}
function mount(el) { el._mounted = true; return el; }

globalThis.document = { documentElement: { contains: (node) => !!(node && node._mounted) } };
/* getComputedStyle — для заморозки transform уходящего кадра (Task 6,
   fix, п.4): тест управляет возвращаемым transform через el._computedTransform
   (по умолчанию 'none' — как у только что созданного, ещё не анимированного
   элемента). */
globalThis.window = globalThis;
globalThis.getComputedStyle = function (node) {
  return { transform: (node && node._computedTransform) || 'none' };
};

let loaders;
function FakeImage() { this.onload = null; this.onerror = null; this.src = ''; loaders.push(this); }

let timers;
function fakeSetTimeout(fn) { timers.push({ fn, cleared: false }); return timers.length; }
function fakeClearTimeout(id) { const t = timers[id - 1]; if (t) t.cleared = true; }
function fireTimer(id) { const t = timers[id - 1]; if (t && !t.cleared) t.fn(); }

let intervals;
function fakeSetInterval(fn) { intervals.push({ fn, cleared: false }); return intervals.length; }
function fakeClearInterval(id) { const t = intervals[id - 1]; if (t) t.cleared = true; }
function fireInterval(id) { const t = intervals[id - 1]; if (t && !t.cleared) t.fn(); }

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
  LC.motionMode = () => (opts.motion || 'full');
  loadInto(LC, module, '51_slideshow.js');
  return LC;
}

function urls(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push('https://img/f' + i + '.jpg');
  return out;
}

/* ====================================================================== */
/* maxFramesFor / isActivityForeground — чистые функции.                  */
/* ====================================================================== */

test('maxFramesFor: full=8, lite=4, off=1', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.maxFramesFor('full'), 8);
  assert.equal(LC.slideshow.maxFramesFor('lite'), 4);
  assert.equal(LC.slideshow.maxFramesFor('off'), 1);
});

test('isActivityForeground: контейнер не найден (пусто/length=0) -> true (безопасный дефолт)', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isActivityForeground(null), true);
  assert.equal(LC.slideshow.isActivityForeground({ length: 0 }), true);
});

test('isActivityForeground: activity--active есть/нет', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isActivityForeground({ length: 1, hasClass: (c) => c === 'activity--active' }), true);
  assert.equal(LC.slideshow.isActivityForeground({ length: 1, hasClass: () => false }), false);
});

/* ====================================================================== */
/* create(): ротация, битый кадр, pause/resume/destroy, off/выключено,    */
/* "не на экране" (перенесено из test/backdrops.test.mjs, Task 6 fix).    */
/* ====================================================================== */

test('slideshow: activate() помечает первый кадр lumen-bg__img/is-active и заводит таймер', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 1);
});

test('slideshow: смена кадра по таймеру, следующий кадр показывается только после onload', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  fireInterval(1);
  assert.equal(loaders.length, 1, 'должен запроситься следующий кадр');
  loaders[0].onload();

  assert.equal(img0.hasClass('is-active'), false);
  const slides = layer.children('.lumen-bg__slides');
  assert.equal(slides._children.length, 1);
  assert.equal(slides._children[0].hasClass('is-active'), true);
  assert.ok(String(slides._children[0]._css['background-image']).includes('f1.jpg'));
});

test('slideshow: битый кадр (onerror) пропускается — показывается следующий рабочий', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  assert.equal(loaders.length, 1);
  loaders[0].onerror();

  assert.equal(loaders.length, 2, 'после битого кадра пробуем следующий по очереди в этот же тик');
  loaders[1].onload();

  const slides = layer.children('.lumen-bg__slides');
  assert.equal(slides._children.length, 1, 'битый кадр не создаёт DOM-узел');
  assert.equal(slides._children[0].hasClass('is-active'), true);
  assert.ok(String(slides._children[0]._css['background-image']).includes('f2.jpg'));
});

test('slideshow: pause() останавливает таймер и предзагрузку, resume() заводит новый', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();
  assert.equal(intervals.length, 1);

  ctrl.pause();
  assert.equal(intervals[0].cleared, true);
  fireInterval(1);
  assert.equal(loaders.length, 0, 'после pause тик не должен ничего грузить');

  ctrl.resume();
  assert.equal(intervals.length, 2, 'resume должен завести новый таймер');
  assert.equal(intervals[1].cleared, false);
});

test('slideshow: destroy() останавливает таймер и обнуляет незавершённую предзагрузку', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1); // предзагрузка второго кадра в процессе
  assert.equal(loaders.length, 1);

  ctrl.destroy();
  assert.equal(intervals[0].cleared, true);
  assert.equal(loaders[0].onload, null);
  assert.equal(loaders[0].onerror, null);

  assert.doesNotThrow(() => ctrl.destroy()); // идемпотентно
});

test('slideshow: urls.length === 1 -> без таймера (в т.ч. off-режим: maxFramesFor(\'off\')=1 даёт вызывающей стороне 1 URL)', () => {
  const LC = freshLC({ motion: 'off' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(1), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 0);
});

test('slideshow: opts.enabled() === false -> первый кадр активен, но таймер не заводится', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => false, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 0);
});

test('slideshow: activity--active отсутствует у closest(\'.activity\') -> тик пропущен целиком, таймер не тронут', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  layer._closestActivity = { length: 1, hasClass: () => false }; // ушли вглубь
  fireInterval(1);
  assert.equal(loaders.length, 0, 'предзагрузка не должна была начаться');
  assert.equal(intervals[0].cleared, false, 'таймер не трогаем — следующий тик проверит заново');

  fireInterval(1); // ещё тик — по-прежнему не на экране
  assert.equal(loaders.length, 0);
});

test('slideshow: activity--active появляется у closest(\'.activity\') -> следующий тик снова меняет кадр', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  layer._closestActivity = { length: 1, hasClass: () => false };
  fireInterval(1);
  assert.equal(loaders.length, 0);

  layer._closestActivity = { length: 1, hasClass: (c) => c === 'activity--active' };
  fireInterval(1);
  assert.equal(loaders.length, 1, 'вернулись на экран — тик снова предзагружает следующий кадр');
});

/* ====================================================================== */
/* Task 6 (fix, Minor, п.3): память ТВ — не больше 2-3 "тёплых" кадров     */
/* (текущий + уходящий на время кроссфейда) одновременно, независимо от   */
/* max (8/4). */
/* ====================================================================== */

test('slideshow (fix, п.3, память): после 5 смен кадров непустых background-image у .lumen-bg__img не больше 3', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(8), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  for (let n = 0; n < 5; n++) {
    fireInterval(1);
    const lastLoader = loaders[loaders.length - 1];
    lastLoader.onload();
    /* Реалистичное соотношение: 1.2с кроссфейда всегда успевают пройти до
       следующего 8с-тика — не пропускаем последний специально, чтобы
       заодно проверить состояние "текущий + ещё не остывший уходящий". */
    if (n < 4) fireTimer(timers.length);
  }

  const img0 = layer.children('.lumen-backdrop__img');
  const slideEls = layer.children('.lumen-bg__slides')._children;
  const all = [img0].concat(slideEls);
  const warmCount = all.filter((el) => !!el._css['background-image']).length;
  assert.ok(warmCount >= 1 && warmCount <= 3, 'непустых background-image должно быть от 1 до 3, сейчас ' + warmCount);
});

test('slideshow (fix, п.3): "остывший" кадр при повторном заходе очереди получает background-image заново (без нового Image())', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(2), { enabled: () => true, intervalMs: () => 8000 }); // всего 2 кадра — быстрый повторный заход
  ctrl.activate();

  fireInterval(1); // 0 -> 1
  loaders[0].onload();
  fireTimer(timers.length); // кадр 0 остывает

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.css('background-image'), '', 'кадр 0 должен был остыть');

  fireInterval(1); // 1 -> 0 (тот же кадр 0, уже существует, но остыл)
  assert.equal(loaders.length, 1, 'новый Image() создаваться не должен — кадр 0 уже существует, только остыл');
  assert.ok(String(img0.css('background-image')).includes('f0.jpg'), 'background-image должен быть выставлен заново');
});

/* ====================================================================== */
/* Task 6 (fix, Minor, п.4): плавный Ken Burns — инлайн-transform          */
/* уходящего кадра фиксируется перед сменой (только lumen-motion-full) и  */
/* снимается вместе с background-image после кроссфейда. */
/* ====================================================================== */

test('slideshow (fix, п.4, Ken Burns): transform уходящего кадра фиксируется перед сменой и снимается после кроссфейда', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const img0 = layer.children('.lumen-backdrop__img');
  img0[0]._computedTransform = 'matrix(1.04,0,0,1.04,0,0)'; // Ken Burns "в процессе наезда"
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  loaders[0].onload();

  assert.equal(img0.hasClass('is-active'), false);
  assert.equal(img0.css('transform'), 'matrix(1.04,0,0,1.04,0,0)', 'transform должен быть зафиксирован инлайн ДО снятия is-active');

  fireTimer(timers.length); // CROSSFADE_MS истёк
  assert.equal(img0.css('transform'), '', 'после кроссфейда инлайн-transform должен быть снят');
  assert.equal(img0.css('background-image'), '', 'и background-image тоже (память, п.3)');
});

test('slideshow (fix, п.4): заморозка transform — только в lumen-motion-full, не в lite/off', () => {
  const LC = freshLC({ motion: 'lite' });
  const layer = mount(makeLayer());
  const img0 = layer.children('.lumen-backdrop__img');
  img0[0]._computedTransform = 'matrix(1.04,0,0,1.04,0,0)';
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  loaders[0].onload();

  assert.equal(img0.css('transform'), undefined, 'в lite/off transform не должен фиксироваться');
});

test('slideshow (fix, п.4): таймер снятия transform/background-image очищается в destroy()', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  loaders[0].onload(); // смена кадра запланировала таймер остывания уходящего

  const scheduled = timers.length;
  assert.equal(timers[scheduled - 1].cleared, false);
  ctrl.destroy();
  assert.equal(timers[scheduled - 1].cleared, true, 'destroy() должен очистить таймер остывания');
});

/* ====================================================================== */
/* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора):        */
/* публичный признак жизни — 90_runtime.js решает по нему, звать resume() */
/* или LC.backdrops.revive(), не читая внутренние поля контроллера.        */
/* ====================================================================== */

test('isAlive(): true сразу после create() и после activate(), false после destroy()', () => {
  const LC = freshLC({ motion: 'full' });
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  assert.equal(ctrl.isAlive(), true, 'создан, но ещё не активирован — всё равно жив');

  ctrl.activate();
  assert.equal(ctrl.isAlive(), true);

  ctrl.destroy();
  assert.equal(ctrl.isAlive(), false);
  assert.doesNotThrow(() => ctrl.destroy()); // повторный destroy идемпотентен, isAlive остаётся false
  assert.equal(ctrl.isAlive(), false);
});

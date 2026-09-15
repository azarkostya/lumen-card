import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery, mount } from './_fakedom.mjs';

/* Task 6 (refactor, решение координатора): контроллер слайдшоу выделен из
   50_backdrops.js в src/51_slideshow.js (LC.slideshow.create(layer, urls,
   opts)) — модуль сам не знает ни про TMDB/cardinfo, ни про имена настроек
   (opts.enabled/opts.intervalMs — функции, которые передаёт вызывающая
   сторона), ни про LC.motionMode (режим Ken Burns читается прямо с
   layer.hasClass('lumen-motion-full') — обзор координатора, fix п.2),
   поэтому тестируется здесь БЕЗ загрузки 50_backdrops.js/35_cardinfo.js/
   10_util.js — только сам модуль плюс минимальные DOM/таймер-заглушки из
   общего test/_fakedom.mjs (тот же фейковый DOM использует
   test/backdrops.test.mjs). Тесты гонки первого кадра / apply() / cancel()
   остаются в backdrops.test.mjs (они про 50_backdrops.js, а не про сам
   контроллер); здесь — только ротация, pause/resume/destroy, "не на
   экране" и (Task 6, fix) память и Ken Burns при смене кадра. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* Слой в форме, которую строит ensureLayer() в 50_backdrops.js: первый
   кадр (.lumen-backdrop__img — уже "загружен" вызывающей стороной, как
   loadBackdrop() делает в реальности до activate()) + пустой контейнер
   для остальных кадров (.lumen-bg__slides). full — есть ли у слоя класс
   lumen-motion-full (Ken Burns, fix п.2: читается прямо с layer, не через
   LC.motionMode). */
function makeLayer(full) {
  const layer = fakeQuery('<div class="lumen-backdrop' + (full ? ' lumen-motion-full' : '') + '">' +
    '<div class="lumen-backdrop__img"></div>' +
    '<div class="lumen-bg__slides"></div>' +
    '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
    '</div>');
  layer.children('.lumen-backdrop__img').css('background-image', 'url("main.jpg")');
  return layer;
}

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

function freshLC() {
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
  loadInto(LC, module, '51_slideshow.js');
  return LC;
}

function urls(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push('https://img/f' + i + '.jpg');
  return out;
}

function warmFrames(layer) {
  const img0 = layer.children('.lumen-backdrop__img');
  const slides = layer.children('.lumen-bg__slides')._children;
  return [img0, ...slides].filter((el) => !!el.css('background-image'));
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

test('isMounted: в документе / не в документе', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isMounted(mount(new FakeEl(['x']))), true);
  assert.equal(LC.slideshow.isMounted(new FakeEl(['x'])), false);
  assert.equal(LC.slideshow.isMounted(null), false);
});

/* ====================================================================== */
/* create(): ротация, битый кадр, pause/resume/destroy, off/выключено,    */
/* "не на экране" (перенесено из test/backdrops.test.mjs, Task 6 fix).    */
/* ====================================================================== */

test('slideshow: activate() помечает первый кадр lumen-bg__img/is-active и заводит таймер', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 1);
});

test('slideshow: смена кадра по таймеру, следующий кадр показывается только после onload', () => {
  const LC = freshLC();
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
  const LC = freshLC();
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

test('slideshow: pause() останавливает таймер, resume() заводит новый', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();
  assert.equal(intervals.length, 1);

  ctrl.pause();
  assert.equal(intervals[0].cleared, true);

  ctrl.resume();
  assert.equal(intervals.length, 2, 'resume должен завести новый таймер');
  assert.equal(intervals[1].cleared, false);
});

test('slideshow (fix, обзор координатора п.6, было тавтологично): тик начал предзагрузку -> pause() -> onload пришёл ПОСЛЕ pause() -> is-active остаётся на прежнем кадре', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  fireInterval(1); // тик начал предзагрузку следующего кадра (создал loaders[0])
  ctrl.pause();
  loaders[0].onload(); // ответ сети приходит ПОСЛЕ pause()

  assert.equal(img0.hasClass('is-active'), true, 'is-active должен остаться на прежнем (первом) кадре');
  const slides = layer.children('.lumen-bg__slides')._children;
  const newFrameBecameActive = slides.length > 0 && slides[0].hasClass('is-active');
  assert.equal(newFrameBecameActive, false, 'предзагруженный кадр не должен был стать активным после pause()');
});

test('slideshow: destroy() останавливает таймер и обнуляет незавершённую предзагрузку', () => {
  const LC = freshLC();
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
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(1), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 0);
});

test('slideshow: opts.enabled() === false -> первый кадр активен, но таймер не заводится', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => false, intervalMs: () => 8000 });
  ctrl.activate();

  const img0 = layer.children('.lumen-backdrop__img');
  assert.equal(img0.hasClass('lumen-bg__img'), true);
  assert.equal(img0.hasClass('is-active'), true);
  assert.equal(intervals.length, 0);
});

test('slideshow: activity--active отсутствует у closest(\'.activity\') -> тик пропущен целиком, таймер не тронут', () => {
  const LC = freshLC();
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
  const LC = freshLC();
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
/* Task 6 (fix, Minor, п.3): память ТВ — во время кроссфейда тёплых ровно  */
/* 2 (текущий + уходящий), после остывания — ровно 1. Обзор координатора: */
/* если смена случается быстрее CROSSFADE_MS, отменённое охлаждение не     */
/* должно теряться — тёплых всё равно ровно 2, не 3. */
/* ====================================================================== */

test('slideshow (fix, п.3, память): ровно 2 тёплых кадра во время кроссфейда, ровно 1 после остывания', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(8), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  loaders[0].onload();
  assert.equal(warmFrames(layer).length, 2, 'во время кроссфейда тёплых должно быть ровно 2 (текущий + уходящий)');

  fireTimer(timers.length);
  assert.equal(warmFrames(layer).length, 1, 'после остывания уходящего тёплый должен остаться ровно один');
});

test('slideshow (fix, п.3, обзор координатора): две смены кадра быстрее CROSSFADE_MS -> тёплых всё равно ровно 2', () => {
  const LC = freshLC();
  const layer = mount(makeLayer());
  const ctrl = LC.slideshow.create(layer, urls(8), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1); // 0 -> 1
  loaders[0].onload();
  // fireTimer НЕ вызываем — вторая смена происходит быстрее CROSSFADE_MS,
  // отложенное охлаждение кадра 0 ещё не выполнилось.
  fireInterval(1); // 1 -> 2
  loaders[1].onload();

  assert.equal(warmFrames(layer).length, 2, 'потерянное (отменённое) охлаждение кадра 0 не должно копить тёплые кадры');
});

test('slideshow (fix, п.3): "остывший" кадр при повторном заходе очереди получает background-image заново (без нового Image())', () => {
  const LC = freshLC();
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
/* уходящего кадра фиксируется перед сменой (только когда у САМОГО СЛОЯ    */
/* есть класс lumen-motion-full — обзор координатора п.2: не через         */
/* LC.motionMode) и снимается вместе с background-image после кроссфейда. */
/* ====================================================================== */

test('slideshow (fix, п.4, Ken Burns): transform уходящего кадра фиксируется перед сменой и снимается после кроссфейда', () => {
  const LC = freshLC();
  const layer = mount(makeLayer(true)); // класс lumen-motion-full на слое
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

test('slideshow (fix, п.4): заморозка transform — только когда у слоя есть класс lumen-motion-full (обзор координатора: класс на слое, не подмена LC.motionMode)', () => {
  const LC = freshLC();
  const layer = mount(makeLayer(false)); // без lumen-motion-full (как lite/off)
  const img0 = layer.children('.lumen-backdrop__img');
  img0[0]._computedTransform = 'matrix(1.04,0,0,1.04,0,0)';
  const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
  ctrl.activate();

  fireInterval(1);
  loaders[0].onload();

  assert.equal(img0.css('transform'), undefined, 'без lumen-motion-full на слое transform не должен фиксироваться');
});

test('slideshow (fix, п.4): fallback на webkitTransform, если transform недоступен', () => {
  const LC = freshLC();
  const layer = mount(makeLayer(true));
  const img0 = layer.children('.lumen-backdrop__img');
  const originalGCS = globalThis.getComputedStyle;
  globalThis.getComputedStyle = () => ({ webkitTransform: 'matrix(1.02,0,0,1.02,0,0)' }); // старый WebKit без transform
  try {
    const ctrl = LC.slideshow.create(layer, urls(3), { enabled: () => true, intervalMs: () => 8000 });
    ctrl.activate();
    fireInterval(1);
    loaders[0].onload();
    assert.equal(img0.css('transform'), 'matrix(1.02,0,0,1.02,0,0)');
  } finally {
    globalThis.getComputedStyle = originalGCS;
  }
});

test('slideshow (fix, п.4): таймер снятия transform/background-image очищается в destroy()', () => {
  const LC = freshLC();
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
  const LC = freshLC();
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

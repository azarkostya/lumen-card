import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 6 (fix, решение координатора, Important): обработчик подписки
   'activity' вынесен в именованную LC.onActivityEvent(e) — LC.init()
   только подписывает её (followActivityLifecycle), сам обработчик
   вызывается здесь напрямую с фейковыми e/LC.backdrops, без реальной
   Lampa. 90_runtime.js не «чистый» модуль (трогает window/Lampa/$ внутри
   других функций), но ни одна из них не вызывается при загрузке — только
   определения, поэтому грузим его целиком минимальным Function()-
   загрузчиком (как test/backdrops.test.mjs). */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* -------------------------------------------------------------------- */
/* Мини-фейк DOM: только то, что нужно layerOf() в 90_runtime.js —        */
/* find(selector) (поиск ЛЮБОЙ глубины — .lumen-backdrop лежит внутри     */
/* .activity__body, сам .activity__body внутри .activity, проверено       */
/* живьём) и parent() (LC.active.body = layer.parent()), плюс data() для  */
/* layer.data('lumenSlideshow'). */
/* -------------------------------------------------------------------- */

function FakeEl(classes, children) {
  this._class = classes || [];
  this._children = children || [];
  this._data = {};
  this.length = 1;
  this[0] = this;
  this._parentEl = null;
  const self = this;
  this._children.forEach((c) => { c._parentEl = self; });
}
FakeEl.prototype.hasClass = function (c) { return this._class.indexOf(c) !== -1; };
FakeEl.prototype.data = function (key, val) {
  if (arguments.length < 2) return this._data[key];
  this._data[key] = val;
  return this;
};
FakeEl.prototype.parent = function () { return this._parentEl || EMPTY; };
FakeEl.prototype.find = function (sel) {
  const cls = sel.replace(/^\./, '');
  function search(node) {
    for (let i = 0; i < node._children.length; i++) {
      const c = node._children[i];
      if (c.hasClass(cls)) return c;
      const found = search(c);
      if (found) return found;
    }
    return null;
  }
  return search(this) || EMPTY;
};

const EMPTY = { length: 0, find() { return EMPTY; }, data() { }, parent() { return EMPTY; }, hasClass() { return false; } };

/* Объект активности, как его видит e.object в событии 'activity':
   {title, activity:{render(){...}}}. hasLayer — есть ли у этой карточки
   уже построенный .lumen-backdrop (карточка уже открывалась раньше и
   LC.backdrops.apply() успел создать слой); ctrl — что вернёт
   layer.data('lumenSlideshow'), если слой есть. Глубина .activity ->
   .activity__body -> .lumen-backdrop — как проверено живьём (см. большой
   комментарий у layerOf() в src/90_runtime.js). */
function makeActivityObj(title, hasLayer, ctrl) {
  const backdrop = hasLayer ? new FakeEl(['lumen-backdrop']) : null;
  if (backdrop && ctrl) backdrop.data('lumenSlideshow', ctrl);
  const body = new FakeEl(['activity__body'], backdrop ? [backdrop] : []);
  const activityEl = new FakeEl(['activity'], [body]);
  return { title: title, activity: { render: function () { return activityEl; } } };
}

function makeCtrl() {
  return {
    resumeCalls: 0, pauseCalls: 0, destroyCalls: 0,
    resume() { this.resumeCalls++; },
    pause() { this.pauseCalls++; },
    destroy() { this.destroyCalls++; }
  };
}

function freshLC() {
  warnLog.length = 0;
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '90_runtime.js');
  return LC;
}

/* ====================================================================== */
/* (а) push вглубь: Activity.push НЕ шлёт события для оставленной         */
/* активности (проверено живьём — см. комментарий в 90_runtime.js); новые */
/* init/create/start чужой (пока без слоя) карточки не должны трогать     */
/* LC.active. */
/* ====================================================================== */

test('(а) push вглубь: LC.active не меняется — ни при отсутствии события, ни на init/create/start ещё не построенной карточки', () => {
  const LC = freshLC();
  LC.backdrops = { cancel: () => { } };
  const objA = makeActivityObj('A', true, makeCtrl());
  LC.active = { object: objA, body: objA.activity.render().find('.lumen-backdrop').parent(), slideshow: null };
  const before = LC.active.object;

  const objB = makeActivityObj('B', false, null); // у B ещё нет .lumen-backdrop — apply() не успел
  LC.onActivityEvent({ type: 'init', component: 'full', object: objB });
  LC.onActivityEvent({ type: 'create', component: 'full', object: objB });
  LC.onActivityEvent({ type: 'start', component: 'full', object: objB });

  assert.equal(LC.active.object, before);
});

/* ====================================================================== */
/* (б) backward: start вернувшейся -> LC.active = она + resume(); archive  */
/* той же -> без изменений; ~200мс спустя destroy покинутой -> LC.active   */
/* вернувшейся НЕ обнуляется, её слайдшоу не отменяется (осиротевшая       */
/* карточка B при этом всё равно останавливается — п.2). */
/* ====================================================================== */

test('(б) backward: start вернувшейся восстанавливает LC.active и резюмирует, archive не меняет, destroy покинутой не трогает вернувшуюся', () => {
  const LC = freshLC();
  const cancelCalls = [];
  LC.backdrops = { cancel: (body) => cancelCalls.push(body) };

  const ctrlA = makeCtrl();
  const objA = makeActivityObj('A', true, ctrlA); // карточка, к которой возвращаемся
  const ctrlB = makeCtrl();
  const objB = makeActivityObj('B', true, ctrlB); // покинутая (сейчас LC.active)

  LC.active = { object: objB, body: objB.activity.render().find('.lumen-backdrop').parent(), slideshow: ctrlB };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(LC.active.object, objA, 'LC.active должен восстановиться на A');
  assert.equal(LC.active.slideshow, ctrlA);
  assert.equal(ctrlA.resumeCalls, 1);

  LC.onActivityEvent({ type: 'archive', component: 'full', object: objA });
  assert.equal(LC.active.object, objA, 'archive той же активности не должен ничего менять');
  assert.equal(ctrlA.resumeCalls, 2, 'archive своей активности тоже resume() (идемпотентно)');

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objB }); // "через ~200мс"
  assert.equal(LC.active.object, objA, 'LC.active вернувшейся не должен обнуляться destroy-ом покинутой');
  assert.equal(cancelCalls.length, 1, 'но слайдшоу покинутой B всё равно останавливается — осиротевшая карточка (п.2)');
  assert.equal(cancelCalls[0], objB.activity.render().find('.lumen-backdrop').parent());
});

/* ====================================================================== */
/* (в) destroy СВОЕЙ (LC.active) активности -> cancel(body) + LC.active=null. */
/* ====================================================================== */

test('(в) destroy текущей активности -> LC.backdrops.cancel(body) и LC.active=null', () => {
  const LC = freshLC();
  const cancelCalls = [];
  LC.backdrops = { cancel: (body) => cancelCalls.push(body) };
  const objA = makeActivityObj('A', true, makeCtrl());
  const body = {};
  LC.active = { object: objA, body: body, slideshow: null };

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });
  assert.equal(LC.active, null);
  assert.equal(cancelCalls.length, 1);
  assert.equal(cancelCalls[0], body);
});

/* ====================================================================== */
/* (г) start полной карточки без нашего слоя -> LC.active не трогается.    */
/* ====================================================================== */

test('(г) start полной карточки без .lumen-backdrop -> LC.active не трогается', () => {
  const LC = freshLC();
  LC.backdrops = { cancel: () => { } };

  LC.active = null;
  const objX = makeActivityObj('X', false, null);
  LC.onActivityEvent({ type: 'start', component: 'full', object: objX });
  assert.equal(LC.active, null);

  const objA = makeActivityObj('A', true, makeCtrl());
  LC.active = { object: objA, body: {}, slideshow: null };
  const before = LC.active;
  const objY = makeActivityObj('Y', false, null);
  LC.onActivityEvent({ type: 'start', component: 'full', object: objY });
  assert.equal(LC.active, before);
});

/* ====================================================================== */
/* (п.2, fix, Important) Осиротевшие карточки: цепочка A -> B -> C          */
/* (LC.active уже C) — destroy A/B должен останавливать их таймеры          */
/* немедленно (а не дожидаться следующего тика isLayerMounted()).          */
/* ====================================================================== */

test('(п.2) цепочка A->B->C: destroy A/B (не LC.active), у которых уже есть слой, -> немедленный cancel(layer.parent())', () => {
  const LC = freshLC();
  const cancelCalls = [];
  LC.backdrops = { cancel: (body) => cancelCalls.push(body) };

  const objA = makeActivityObj('A', true, makeCtrl());
  const objB = makeActivityObj('B', true, makeCtrl());
  const objC = makeActivityObj('C', true, makeCtrl());
  LC.active = { object: objC, body: objC.activity.render().find('.lumen-backdrop').parent(), slideshow: null };

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });
  assert.equal(cancelCalls.length, 1);
  assert.equal(cancelCalls[0], objA.activity.render().find('.lumen-backdrop').parent());

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objB });
  assert.equal(cancelCalls.length, 2);

  assert.equal(LC.active.object, objC, 'осиротевшие destroy A/B не должны были тронуть текущую LC.active=C');

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objC });
  assert.equal(cancelCalls.length, 3);
  assert.equal(LC.active, null);
});

test('(п.2) destroy чужой активности без .lumen-backdrop -> cancel не вызывается', () => {
  const LC = freshLC();
  const cancelCalls = [];
  LC.backdrops = { cancel: (body) => cancelCalls.push(body) };
  const objC = makeActivityObj('C', true, makeCtrl());
  LC.active = { object: objC, body: {}, slideshow: null };

  const objOther = makeActivityObj('Other', false, null);
  LC.onActivityEvent({ type: 'destroy', component: 'torrents', object: objOther });
  assert.equal(cancelCalls.length, 0);
  assert.deepEqual(warnLog, []);
});

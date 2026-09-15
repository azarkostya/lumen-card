import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 6 (fix, решение координатора, Important): обработчик подписки
   'activity' вынесен в именованную LC.onActivityEvent(e) — LC.init()
   только подписывает её (followActivityLifecycle), сам обработчик
   вызывается здесь напрямую с фейковыми e/LC.backdrops, без реальной
   Lampa. 90_runtime.js не «чистый» модуль (трогает window/Lampa/$ внутри
   других функций), но ни одна из них не вызывается при загрузке — только
   определения, поэтому грузим его целиком минимальным Function()-
   загрузчиком (как test/backdrops.test.mjs). Фейковый DOM (FakeEl) —
   общий с backdrops.test.mjs/slideshow.test.mjs, из test/_fakedom.mjs
   (Task 6, fix, обзор координатора п.6): используем find(selector)
   (поиск ЛЮБОЙ глубины — .lumen-backdrop лежит внутри .activity__body,
   сам .activity__body внутри .activity, проверено живьём), parent()
   (LC.active.body = layer.parent()) и data() (layer.data('lumenSlideshow')). */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

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

/* isAlive() (fix, находка "мёртвое слайдшоу"): true, пока destroy() не
   вызывался — так же, как настоящий контроллер из src/51_slideshow.js. */
function makeCtrl() {
  return {
    resumeCalls: 0, pauseCalls: 0, destroyCalls: 0, _dead: false,
    resume() { this.resumeCalls++; },
    pause() { this.pauseCalls++; },
    destroy() { this.destroyCalls++; this._dead = true; },
    isAlive() { return !this._dead; }
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

/* ====================================================================== */
/* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора):        */
/* start полной карточки, чей контроллер !isAlive() (или отсутствует) —   */
/* LC.backdrops.revive() пересоздаёт ротацию вместо no-op resume() на      */
/* уничтоженном контроллере. */
/* ====================================================================== */

test('(fix) start полной карточки с destroyed контроллером -> LC.backdrops.revive создаёт новый живой контроллер, старый не резюмируется, повторный start второй раз не зовёт revive', () => {
  const LC = freshLC();
  const reviveCalls = [];
  const freshCtrl = makeCtrl();
  LC.backdrops = {
    cancel: () => { },
    revive: (layer) => { reviveCalls.push(layer); layer.data('lumenSlideshow', freshCtrl); return freshCtrl; }
  };

  const deadCtrl = makeCtrl();
  deadCtrl.destroy(); // уже уничтожен (Lampa ActivitySlide.stop() -> isLayerMounted() self-heal)
  const objA = makeActivityObj('A', true, deadCtrl);

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(reviveCalls.length, 1, 'revive должен быть вызван для мёртвого контроллера');
  assert.equal(deadCtrl.resumeCalls, 0, 'старый (мёртвый) контроллер не должен получать resume()');
  assert.equal(LC.active.object, objA);
  assert.equal(LC.active.slideshow, freshCtrl);
  assert.equal(freshCtrl.resumeCalls, 1);

  // Повторный start ТОЙ ЖЕ уже-LC.active активности — обычная ветка
  // (e.object === LC.active.object), revive второй раз вызываться не должен.
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(reviveCalls.length, 1, 'второй контроллер не должен появляться при повторном start');
  assert.equal(freshCtrl.resumeCalls, 2);
});

test('(fix) start полной карточки без сохранённого контроллера (layer есть, lumenSlideshow не задан) -> тоже вызывает revive', () => {
  const LC = freshLC();
  const reviveCalls = [];
  const freshCtrl = makeCtrl();
  LC.backdrops = {
    cancel: () => { },
    revive: (layer) => { reviveCalls.push(layer); return freshCtrl; }
  };

  const objA = makeActivityObj('A', true, null); // слой есть, lumenSlideshow не выставлен вовсе
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(reviveCalls.length, 1);
  assert.equal(LC.active.slideshow, freshCtrl);
});

/* ====================================================================== */
/* Task 6 (fix, обзор координатора п.6): e.component==='full' — start      */
/* НЕ-full компонента (например 'torrents') с уже готовым .lumen-backdrop  */
/* не должен ни восстанавливать LC.active, ни звать resume()/revive(). */
/* ====================================================================== */

test('(fix, обзор координатора п.6) start НЕ-full компонента у объекта со слоем -> LC.active и resume/revive не трогаются', () => {
  const LC = freshLC();
  const reviveCalls = [];
  const ctrl = makeCtrl();
  LC.backdrops = {
    cancel: () => { },
    revive: (layer) => { reviveCalls.push(layer); return ctrl; }
  };

  const objA = makeActivityObj('A', true, ctrl); // есть слой, есть живой контроллер
  LC.active = null;

  LC.onActivityEvent({ type: 'start', component: 'torrents', object: objA });

  assert.equal(LC.active, null, 'LC.active не должен был установиться на не-full компонент');
  assert.equal(ctrl.resumeCalls, 0);
  assert.equal(reviveCalls.length, 0);
});

/* ====================================================================== */
/* Task 6 (fix, обзор координатора п.2, корень проблемы): LC.applyMotionMode */
/* должен синхронизировать класс режима и на .lumen-card, и на              */
/* .lumen-backdrop активной карточки — иначе после переключения             */
/* lumen_motion на full->lite/off Ken Burns на слое фона продолжал бы        */
/* играть до следующего apply() (закрытия и повторного открытия карточки).  */
/* ====================================================================== */

test('(fix, обзор координатора п.2) LC.applyMotionMode снимает lumen-motion-full и с .lumen-card, и с .lumen-backdrop', () => {
  const LC = freshLC();
  LC.motionMode = () => 'lite';

  const cardRoot = new FakeEl(['lumen-card']).addClass('lumen-motion-full');
  const backdropLayer = new FakeEl(['lumen-backdrop']).addClass('lumen-motion-full');
  globalThis.$ = function (sel) {
    if (sel === '.activity--active .lumen-card') return cardRoot;
    if (sel === '.activity--active .lumen-backdrop') return backdropLayer;
    return EMPTY;
  };

  LC.applyMotionMode();

  assert.equal(cardRoot.hasClass('lumen-motion-lite'), true);
  assert.equal(cardRoot.hasClass('lumen-motion-full'), false);
  assert.equal(backdropLayer.hasClass('lumen-motion-lite'), true);
  assert.equal(backdropLayer.hasClass('lumen-motion-full'), false, 'слой фона тоже должен потерять lumen-motion-full — иначе Ken Burns продолжил бы играть');
});

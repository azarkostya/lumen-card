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

/* Task 5c (ревью качества, п.2): одна подписка на Lampa.Timeline за жизнь
   плагина; событие update -> LC.header.refreshEpisode(hash).
   Task 8 (поправки координатора): вторая подписка не заводится — та же
   обновляет строку «Продолжить» и подпись кнопки «Смотреть». */
test('Task 5c/8: LC.followTimeline — одна подписка на update: хэш в refreshEpisode, строка «Продолжить» через refreshProgress', () => {
  const LC = freshLC();
  const follows = [];
  const Lampa = { Timeline: { listener: { follow(name, fn) { follows.push({ name: name, fn: fn }); } } } };
  const prevWindow = globalThis.window;
  const prevLampa = globalThis.Lampa;
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  try {
    const hashes = [];
    let scheduled = 0;
    LC.header = { refreshEpisode(h) { hashes.push(h); }, scheduleProgressRefresh() { scheduled++; } };
    LC.followTimeline();
    LC.followTimeline();
    assert.equal(follows.length, 1);
    assert.equal(follows[0].name, 'update');
    follows[0].fn({ data: { hash: '908552078', road: { percent: 32 } } });
    follows[0].fn(null);
    follows[0].fn({});
    assert.deepEqual(hashes, ['908552078']);
    /* Строке «Продолжить» хэш записи не нужен — карточка сама решает, какую
       серию продолжать, по всем своим данным; поэтому перерисовка ставится на
       каждое событие, в том числе на пустое. Ревью Task 8 (п.2): подписка
       зовёт КОАЛЕСЦИРУЮЩУЮ обёртку — пачка событий синхронизации CUB схлопы-
       вается в одну перерисовку (сам дебаунс проверяет header.test.mjs). */
    assert.equal(scheduled, 3);
    assert.deepEqual(warnLog, []);
  } finally {
    globalThis.window = prevWindow;
    globalThis.Lampa = prevLampa;
  }
});

/* Ревью Task 8 (п.3): настройки Lampa открываются активностью ПОВЕРХ карточки
   и при возврате не шлют ни 'full', ни complite — без своего apply*Pref
   переключатель «Показывать «Продолжить»» не действовал бы до переоткрытия. */
test('Task 8: LC.applyProgressPref перерисовывает строку немедленно, мимо дебаунса', () => {
  const LC = freshLC();
  let immediate = 0, scheduled = 0;
  LC.header = { refreshProgress() { immediate++; }, scheduleProgressRefresh() { scheduled++; } };

  LC.applyProgressPref();
  assert.equal(immediate, 1);
  assert.equal(scheduled, 0, 'реакция на действие пользователя не ждёт 300 мс');
  assert.deepEqual(warnLog, []);

  LC.header = { refreshProgress() { throw new Error('bang'); } };
  LC.applyProgressPref();
  assert.equal(warnLog.length, 1, 'исключение не всплывает наружу');
});

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

/* ====================================================================== */
/* Task 6 (fix, повторное ревью, Important 1): мёртвый контроллер должен   */
/* оживать и в ветке "e.object === LC.active.object" (своя активность),    */
/* не только во второй (восстановление чужой). Частый сценарий: карточка   */
/* A -> актёр -> список (не-full активности, 'full':complite не шлют,      */
/* LC.active всё это время остаётся A) -> A сама уходит на 2+ уровня,      */
/* ActivitySlide.stop() -> тик isLayerMounted() уничтожает контроллер ->   */
/* backward() до A -> 'start' для A, но e.object === LC.active.object      */
/* (LC.active никогда не менялся) -> раньше это была ветка "resume() без   */
/* проверки" -> молчаливый застой. */
/* ====================================================================== */

test('(fix, Important 1) start СВОЕЙ активности (LC.active уже она) с destroyed контроллером -> ровно один revive, LC.active.slideshow живой, старый resume() не получает', () => {
  const LC = freshLC();
  const reviveCalls = [];
  const freshCtrl = makeCtrl();
  LC.backdrops = {
    cancel: () => { },
    revive: (layer) => { reviveCalls.push(layer); return freshCtrl; }
  };

  const deadCtrl = makeCtrl();
  deadCtrl.destroy(); // уже уничтожен (Lampa ActivitySlide.stop() -> isLayerMounted() self-heal)
  const objA = makeActivityObj('A', true, deadCtrl);
  LC.active = { object: objA, body: {}, slideshow: deadCtrl };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(reviveCalls.length, 1, 'должен быть ровно один revive');
  assert.equal(deadCtrl.resumeCalls, 0, 'старый мёртвый контроллер не должен получать resume()');
  assert.equal(LC.active.slideshow, freshCtrl);
  assert.equal(freshCtrl.resumeCalls, 1);

  // Повторный start той же (уже живой) активности не должен снова звать revive.
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(reviveCalls.length, 1, 'второй revive не должен появляться, когда контроллер уже жив');
  assert.equal(freshCtrl.resumeCalls, 2);
});

test('(fix, Important 1) archive СВОЕЙ активности с destroyed контроллером -> тоже вызывает revive (та же liveSlideshow)', () => {
  const LC = freshLC();
  const reviveCalls = [];
  const freshCtrl = makeCtrl();
  LC.backdrops = {
    cancel: () => { },
    revive: (layer) => { reviveCalls.push(layer); return freshCtrl; }
  };

  const deadCtrl = makeCtrl();
  deadCtrl.destroy();
  const objA = makeActivityObj('A', true, deadCtrl);
  LC.active = { object: objA, body: {}, slideshow: deadCtrl };

  LC.onActivityEvent({ type: 'archive', component: 'full', object: objA });

  assert.equal(reviveCalls.length, 1);
  assert.equal(LC.active.slideshow, freshCtrl);
});

/* ====================================================================== */
/* Task 7: фоновый трейлер — связка с жизненным циклом карточки.          */
/*                                                                        */
/* Остановка трейлера при закрытии карточки идёт НЕ отдельной веткой в    */
/* LC.onActivityEvent, а через LC.backdrops.cancel(body): контроллер       */
/* лежит на слое (layer.data('lumenTrailer')), и stopSlideshow() гасит его */
/* вместе со слайдшоу — это покрывает разом и свою карточку, и            */
/* осиротевшие карточки из истории (тесты cancel выше и в                 */
/* test/backdrops.test.mjs). Здесь — то, что живёт именно в 90_runtime.js: */
/* планирование на complite, остановка при уходе фокуса с full_start и    */
/* реакция на смену настройки.                                            */
/* ====================================================================== */

/* LC.init() нужен, чтобы зарегистрировались слушатели 'full' и 'toggle' —
   поэтому здесь грузится ещё и 80_settings.js (LC.addSettings/
   LC.followStorage/LC.pref), а всё остальное окружение Lampa заменено
   минимальными заглушками, как в test/menus_runtime.test.mjs. */
function initLC(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const storage = opts.storage || {};
  const full = [];
  const toggles = [];
  const Lampa = {
    Template: { all: () => ({ full_start_new: '<div>orig</div>' }), add: () => { }, get: () => '' },
    Listener: { follow: (name, fn) => { if (name === 'full') full.push(fn); } },
    Lang: { add: () => { } },
    SettingsApi: { addComponent: () => { }, addParam: () => { } },
    Controller: { listener: { follow: (name, fn) => { if (name === 'toggle') toggles.push(fn); } } },
    Storage: { field: (name) => storage[name], get: (name, def) => (name in storage ? storage[name] : def) },
    Platform: { screen: () => false },
    Timeline: { listener: { follow: () => { } } }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.$ = () => EMPTY;

  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '90_runtime.js');
  LC.template = { build: () => '<div class="lumen-card"></div>', assert: () => ({ ok: true, missingInOurs: [] }) };
  LC.injectFonts = () => { };
  LC.injectCss = () => { };
  LC.menus = { mode: () => { }, install: () => { } };
  LC.torrents = { install: () => { }, toggle: () => { } };
  const descrRows = [];
  LC.header = { decorate: () => { }, descr: (row) => descrRows.push(row) };
  LC.backdrops = { apply: () => null, cancel: () => { } };
  /* Task 9: ряд отзывов рисует свой модуль — здесь он такая же заглушка, как
     header/backdrops/trailer; вызовы пишем в журнал (проверка ниже: и таблица
     «ПОДРОБНО», и отзывы получают ОДИН и тот же узел ряда описания). */
  const reviewRows = [];
  const clearedRows = [];
  LC.reviews = { render: (row) => reviewRows.push(row), clearRow: (row) => clearedRows.push(row) };

  const calls = { bind: [], schedule: [], stop: 0 };
  LC.trailer = {
    bind: (root) => calls.bind.push(root),
    schedule: (root, body, data) => { calls.schedule.push({ root, body, data }); return opts.controller || null; },
    stopActive: () => { calls.stop++; },
    mode: () => opts.mode || 'auto'
  };

  LC.init();
  return { LC, calls, full, toggles, descrRows, reviewRows, clearedRows };
}

test('Task 7: complite — bind(root) и schedule(root, body, data), контроллер попадает в LC.active.trailer', () => {
  const controller = { destroy() { }, isAlive: () => true };
  const { LC, calls, full } = initLC({ controller });
  assert.equal(full.length, 1, 'ожидалась одна подписка на full');

  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  const data = { movie: { id: 1 }, videos: { results: [{ key: 'k', name: 'Trailer' }] } };
  const object = {};

  full[0]({ type: 'complite', body: body, object: object, data: data, item: { render: () => root } });

  assert.equal(calls.bind.length, 1, 'один capture-слушатель на корень карточки');
  assert.equal(calls.bind[0], root);
  assert.equal(calls.schedule.length, 1);
  assert.equal(calls.schedule[0].root, root);
  assert.equal(calls.schedule[0].body, body);
  assert.equal(calls.schedule[0].data, data, 'ролики берутся из e.data.videos — передаём всю data');
  assert.equal(LC.active.trailer, controller);
  assert.deepEqual(warnLog, []);
});

/* Task 9: блок отзывов встраивается в тот же узел ряда описания, что и
   таблица «ПОДРОБНО» (в Lampa нельзя завести свой тип ряда — план 0.2).
   Узел ищется ОДИН раз на оба рендера: разойдись они, класс .lumen-descr-row
   и содержимое оказались бы на разных уровнях разметки ряда. */
test('Task 9: на build ряда описания таблица и отзывы получают один и тот же узел', () => {
  const { full, descrRows, reviewRows } = initLC();
  const row = new FakeEl(['items-line'], [new FakeEl(['items-line__body'], [new FakeEl(['full-descr'])])]);

  full[0]({ type: 'build', name: 'description', body: EMPTY, data: { movie: { id: 1 } }, item: { render: () => row } });

  assert.equal(descrRows.length, 1, 'таблица «ПОДРОБНО» рисуется как раньше');
  assert.equal(reviewRows.length, 1, 'отзывы рисуются на том же событии');
  assert.equal(descrRows[0], row);
  assert.equal(reviewRows[0], row, 'оба рендера получают один узел ряда');
  assert.deepEqual(warnLog, []);
});

test('Task 9: complite — страховочный повтор обоих рендеров, данные карточки попадают в LC.active', () => {
  const { LC, full, descrRows, reviewRows } = initLC();
  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const descr = new FakeEl(['full-descr']);
  const body = new FakeEl(['activity__body'], [new FakeEl(['items-line'], [new FakeEl(['items-line__body'], [descr])])]);
  const data = { movie: { id: 1, imdb_id: 'tt1' } };

  full[0]({ type: 'complite', body: body, object: {}, data: data, item: { render: () => root } });

  assert.equal(descrRows.length, 1);
  assert.equal(reviewRows.length, 1);
  assert.equal(reviewRows[0], descrRows[0], 'и на complite узел ряда один на оба рендера');
  assert.equal(LC.active.data, data, 'данные нужны LC.applyReviewsPref — из настроек карточку иначе не перерисовать');
  assert.deepEqual(warnLog, []);
});

/* Настройки Lampa открываются активностью ПОВЕРХ карточки: при возврате не
   приходит ни 'full', ни complite, поэтому у настройки обязана быть своя точка
   применения — иначе введённый ключ подействовал бы только со следующего
   открытия карточки (та же причина, что у applyProgressPref в Task 8). */
test('Task 9: LC.applyReviewsPref — включение перерисовывает ряд по данным карточки, выключение снимает блок', () => {
  const storage = {};
  const { LC, reviewRows, clearedRows } = initLC({ storage });
  const row = new FakeEl(['items-line', 'lumen-descr-row']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-descr-row' ? row : EMPTY);

  LC.applyReviewsPref();
  assert.equal(reviewRows.length, 0, 'данных карточки ещё нет — рисовать нечего');
  assert.equal(clearedRows.length, 0);

  LC.active = { data: { movie: { id: 1, imdb_id: 'tt1' } } };
  LC.applyReviewsPref();
  assert.equal(reviewRows.length, 1, 'ключ введён — ряд перерисован без нового открытия карточки');
  assert.equal(reviewRows[0], row);

  /* Переключатели Lampa пишут в Storage строки 'true'/'false' (план 0.2). */
  storage.lumen_reviews = 'false';
  LC.applyReviewsPref();
  assert.equal(clearedRows.length, 1, 'выключение снимает блок на лету');
  assert.equal(reviewRows.length, 1, 'и не рисует его заново');
  assert.deepEqual(warnLog, []);
});

test('Task 7: уход фокуса с full_start снимает трейлер, возврат на кнопки — нет', () => {
  const { calls, toggles } = initLC();
  assert.equal(toggles.length, 1, 'вторая подписка на toggle не заводится (Task 4 уже сделал её)');

  const root = new FakeEl(['lumen-card']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card' ? root : EMPTY);

  /* Карточка сперва получает фокус — без этого уходить неоткуда
     (см. тест про 'content' ниже и комментарий focus_on_card в рантайме). */
  toggles[0]({ name: 'full_start' });
  assert.equal(calls.stop, 0);

  toggles[0]({ name: 'full_descr' });
  assert.equal(calls.stop, 1, 'спуск на описание — трейлер снимаем');
  assert.equal(root.hasClass('lumen-compact'), true, 'компактная шапка Task 4 продолжает работать');

  toggles[0]({ name: 'full_start' });
  assert.equal(calls.stop, 1, 'возврат на кнопки трейлер не трогает');
  assert.equal(root.hasClass('lumen-compact'), false);

  toggles[0]({ name: 'items_line' });
  assert.equal(calls.stop, 2);

  /* Чужой контроллер (открылось меню/окно поверх) — тоже уход, но только
     если до него карточка была в фокусе. */
  toggles[0]({ name: 'full_start' });
  toggles[0]({ name: 'select' });
  assert.equal(calls.stop, 3);
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Task 7 (регрессия по находке живой проверки). Замер в живой Lampa 3.3.4 */
/* — события Controller.listener 'toggle', мс от 'full':complite:          */
/*   content -201, content -200, content +3, full_start +4, content +5.    */
/* Lampa встаёт на 'full_start' и ТУТ ЖЕ возвращается на 'content'.        */
/* Признак «любое имя != full_start» гасил только что запланированный      */
/* трейлер на этом же +5 мс: снимался таймер 3 с, плеер не появлялся вовсе */
/* (ни iframe, ни запроса iframe_api), а LC.active.trailer становился null */
/* при том, что schedule() вернул контроллер.                              */
/* ====================================================================== */

test('Task 7: churn контроллера при открытии карточки (content -> full_start -> content) не гасит трейлер', () => {
  const controller = { destroy() { }, isAlive: () => true };
  const { LC, calls, full, toggles } = initLC({ controller });

  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card' ? root : EMPTY);

  full[0]({ type: 'complite', body: body, object: {}, data: { movie: {} }, item: { render: () => root } });
  assert.equal(LC.active.trailer, controller);

  /* Ровно тот порядок, что снят живьём. */
  toggles[0]({ name: 'content' });
  assert.equal(calls.stop, 0, 'карточка ещё не получала фокус — уходить неоткуда');

  toggles[0]({ name: 'full_start' });
  assert.equal(calls.stop, 0, 'фокус пришёл на карточку — это не уход');

  toggles[0]({ name: 'content' });
  assert.equal(calls.stop, 0, 'возврат Lampa на content сразу после full_start — часть открытия карточки, не уход');
  assert.equal(LC.active.trailer, controller, 'контроллер обязан дожить до старта плеера (таймер 3 с не снят)');

  toggles[0]({ name: 'full_descr' });
  assert.equal(calls.stop, 1, 'а вот теперь фокус действительно ушёл с карточки');
  assert.deepEqual(warnLog, []);
});

test('Task 7: уход в каталог (content) трейлер не снимает — это делает cancel слоя при destroy карточки', () => {
  const controller = { destroy() { }, isAlive: () => true };
  const { calls, full, toggles } = initLC({ controller });

  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card' ? root : EMPTY);

  full[0]({ type: 'complite', body: body, object: {}, data: { movie: {} }, item: { render: () => root } });
  toggles[0]({ name: 'full_start' });
  toggles[0]({ name: 'content' });
  toggles[0]({ name: 'content' });

  assert.equal(calls.stop, 0, 'content исключён из признака ухода (иначе ломается открытие карточки)');
});

test('Task 7: фокус, оставшийся от предыдущей карточки, не гасит трейлер следующей', () => {
  const controller = { destroy() { }, isAlive: () => true };
  const { LC, calls, full, toggles } = initLC({ controller });

  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card' ? root : EMPTY);

  /* Карточка A: открылась и получила фокус. */
  full[0]({ type: 'complite', body: body, object: {}, data: { movie: {} }, item: { render: () => root } });
  toggles[0]({ name: 'full_start' });
  assert.equal(calls.stop, 0);

  /* Карточка B: complite сбрасывает признак — её собственные 'content'
     (те самые, что приходят после complite) трейлер B не трогают. */
  full[0]({ type: 'complite', body: body, object: {}, data: { movie: {} }, item: { render: () => root } });
  toggles[0]({ name: 'content' });
  toggles[0]({ name: 'content' });
  assert.equal(calls.stop, 0, 'признак фокуса обязан сбрасываться на каждой новой карточке');
  assert.equal(LC.active.trailer, controller);
});

/* Ревью: у вернувшейся карточки LC.active обязан нести поле trailer — иначе
   «залипший» режим трейлера (классы lumen-trailer-on/-live на карточке, чей
   DOM Lampa тихо убирала на 2+ уровня истории) уже нечем было бы снять:
   stopActive() смотрит именно в LC.active.trailer. */
test('Task 7 (ревью): start вернувшейся карточки восстанавливает LC.active.trailer со слоя', () => {
  const LC = freshLC();
  const ctrl = makeCtrl();
  const objA = makeActivityObj('A', true, ctrl);
  const layer = objA.activity.render().find('.lumen-backdrop');
  const trailer = { destroy() { }, isAlive: () => true };
  layer.data('lumenTrailer', trailer);
  LC.backdrops = { cancel: () => { }, revive: () => ctrl };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(LC.active.object, objA);
  assert.equal(LC.active.trailer, trailer);
});

test('Task 7 (ревью): трейлера на слое нет (revive его погасил) -> поле trailer равно null, а не undefined', () => {
  const LC = freshLC();
  const ctrl = makeCtrl();
  const objA = makeActivityObj('A', true, ctrl);
  LC.backdrops = { cancel: () => { }, revive: () => ctrl };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(LC.active.trailer, null);
});

test('Task 7: LC.applyTrailerPref — выключение снимает играющий ролик, прочие значения не трогают', () => {
  const off = initLC({ mode: 'off' });
  off.LC.applyTrailerPref();
  assert.equal(off.calls.stop, 1);

  const on = initLC({ mode: 'on' });
  on.LC.applyTrailerPref();
  assert.equal(on.calls.stop, 0, 'включение на лету ничего не останавливает (и не запускает — старт от complite)');
  assert.deepEqual(warnLog, []);
});

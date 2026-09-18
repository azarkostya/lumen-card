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

/* Ревью Task 10 (п.1/п.4): подписки на activity, toggle и Timeline теперь
   загейчены флагом «оформление активно» — тем же, что подписка 'full'. Значит
   их тестам нужен ПРОШЕДШИЙ инициализацию плагин, а не голый модуль: freshLC
   поднимает то же окружение, что initLC (80+81+90 и LC.init с фейковой Lampa),
   и отдаёт только LC. Тесты, как и раньше, переопределяют LC.backdrops/
   LC.header/$ под себя уже после. */
function freshLC() {
  return initLC().LC;
}

/* Task 5c (ревью качества, п.2): одна подписка на Lampa.Timeline за жизнь
   плагина; событие update -> LC.header.refreshEpisode(hash).
   Task 8 (поправки координатора): вторая подписка не заводится — та же
   обновляет строку «Продолжить» и подпись кнопки «Смотреть». */
test('Task 5c/8: LC.followTimeline — одна подписка на update: хэш в refreshEpisode, строка «Продолжить» через refreshProgress', () => {
  const { LC, timelines } = initLC();
  const hashes = [];
  let scheduled = 0;
  LC.header = { refreshEpisode(h) { hashes.push(h); }, scheduleProgressRefresh() { scheduled++; } };
  /* LC.init уже подписался — повторный вызов второй подписки не заводит. */
  LC.followTimeline();
  assert.equal(timelines.length, 1);
  timelines[0]({ data: { hash: '908552078', road: { percent: 32 } } });
  timelines[0](null);
  timelines[0]({});
  assert.deepEqual(hashes, ['908552078']);
  /* Строке «Продолжить» хэш записи не нужен — карточка сама решает, какую
     серию продолжать, по всем своим данным; поэтому перерисовка ставится на
     каждое событие, в том числе на пустое. Ревью Task 8 (п.2): подписка
     зовёт КОАЛЕСЦИРУЮЩУЮ обёртку — пачка событий синхронизации CUB схлопы-
     вается в одну перерисовку (сам дебаунс проверяет header.test.mjs). */
  assert.equal(scheduled, 3);
  assert.deepEqual(warnLog, []);
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
  /* Долг Task 11 (сверка с планом): ресурсы покинутой B освобождаются ЗДЕСЬ
     же, на start возвращаемой. Ждать destroy(B) нельзя — Lampa шлёт его
     СЛЕДОМ за start/archive(A), когда LC.active уже указывает на A. */
  assert.equal(cancelCalls.length, 1, 'слой покинутой B снят сразу, а не по её следующему тику');
  assert.equal(cancelCalls[0], objB.activity.render().find('.lumen-backdrop').parent());
  assert.equal(ctrlB.destroyCalls, 1, 'интервал ротации B снят до тика');

  LC.onActivityEvent({ type: 'archive', component: 'full', object: objA });
  assert.equal(LC.active.object, objA, 'archive той же активности не должен ничего менять');
  assert.equal(ctrlA.resumeCalls, 2, 'archive своей активности тоже resume() (идемпотентно)');

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objB }); // "через ~200мс"
  assert.equal(LC.active.object, objA, 'LC.active вернувшейся не должен обнуляться destroy-ом покинутой');
  assert.equal(cancelCalls.length, 2, 'запоздавший destroy(B) идёт веткой осиротевших — cancel идемпотентен');
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
  /* Task 10: следы главного выключателя — какой шаблон отдан Lampa, кого
     позвали снимать слой фона и незавершённый запрос отзывов, сколько раз
     перерисовали актёров. */
  const timelines = [];
  /* noty — что плагин показал пользователю через Lampa.Noty (единственное
     сообщение плагина: неподдерживаемая сборка Lampa, ревью фазы 1 M2). */
  const extra = { added: [], bgCancel: [], reviewCancel: [], franchiseCancel: [], franchiseCleared: [], cast: 0, css: 0, noty: [], hubInstall: 0, hubUninstall: 0 };
  const Lampa = {
    Template: {
      all: () => ({ full_start_new: '<div>orig</div>' }),
      /* Task 11 (Step 2): templateAddFails моделирует Lampa, которая не приняла
         НАШ шаблон (оригинал она принимает — иначе нечем было бы проверить сам
         откат). */
      add: (name, html) => {
        extra.added.push({ name: name, html: html });
        if (opts.templateAddFails && html !== '<div>orig</div>') throw new Error('template add failed');
      },
      get: () => ''
    },
    Listener: { follow: (name, fn) => { if (name === 'full') full.push(fn); } },
    Lang: { add: () => { } },
    SettingsApi: { addComponent: () => { }, addParam: () => { } },
    Controller: { listener: { follow: (name, fn) => { if (name === 'toggle') toggles.push(fn); } } },
    Storage: { field: (name) => storage[name], get: (name, def) => (name in storage ? storage[name] : def) },
    Platform: { screen: () => false },
    Noty: { show: (msg) => extra.noty.push(msg) },
    Timeline: { listener: { follow: (name, fn) => { if (name === 'update') timelines.push(fn); } } }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.$ = () => EMPTY;

  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '81_prefs.js');
  loadInto(LC, module, '90_runtime.js');
  /* templateUnsupported моделирует сборку Lampa, чей штатный шаблон не проходит
     assert (не хватает обязательных классов/языковых ключей): плагин обязан
     оставить шаблон Lampa в покое и сказать об этом пользователю. */
  /* buildThrowsOnce роняет ПЕРВЫЙ заход init изнутри try — как упало бы любое
     исключение в сборке шаблона (Important 3). */
  let buildCalls = 0;
  LC.template = {
    build: () => {
      buildCalls++;
      if (opts.buildThrowsOnce && buildCalls === 1) throw new Error('build boom');
      return '<div class="lumen-card"></div>';
    },
    assert: () => (opts.templateUnsupported ? { ok: false, missingInOurs: ['lumen-card'] } : { ok: true, missingInOurs: [] })
  };
  LC.injectFonts = () => { };
  /* Ревью Task 11 (Important): счётчик нужен, чтобы откат неудачной подмены
     шаблона проверялся ЦЕЛИКОМ. Без него тесты не замечали потерю return
     после restoreOriginalTemplate(): activated уже false, но выполнение шло
     дальше — CSS, классы режима движения и оформления меню на body и маркеры
     на Select/Modal ложились на ШТАТНУЮ карточку Lampa, а снять их было некому
     (deactivate() выходит первой строкой по !activated). */
  /* injectCssThrowsOnce роняет ПЕРВЫЙ заход init уже ПОСЛЕ подписки на 'full'
     (activate() зовётся последним шагом, а LC.injectCss внутри него не обёрнут
     своим try/catch) — в отличие от buildThrowsOnce, который роняет ДО неё. */
  let cssCalls = 0;
  LC.injectCss = () => {
    cssCalls++;
    if (opts.injectCssThrowsOnce && cssCalls === 1) throw new Error('css boom');
    extra.css++;
  };
  LC.removeCss = () => { };
  LC.menus = { mode: () => { }, install: () => { } };
  LC.torrents = { install: () => { }, toggle: () => { } };
  const descrRows = [];
  LC.header = { decorate: () => { }, descr: (row) => descrRows.push(row), refreshCast: () => { extra.cast++; } };
  LC.backdrops = { apply: () => null, cancel: (body) => extra.bgCancel.push(body) };
  /* Task 9: ряд отзывов рисует свой модуль — здесь он такая же заглушка, как
     header/backdrops/trailer; вызовы пишем в журнал (проверка ниже: и таблица
     «ПОДРОБНО», и отзывы получают ОДИН и тот же узел ряда описания). */
  const reviewRows = [];
  const clearedRows = [];
  LC.reviews = { render: (row) => reviewRows.push(row), clearRow: (row) => clearedRows.push(row), cancel: (body) => extra.reviewCancel.push(body) };
  /* Task 28: ряд «Смотреть по порядку» — третий сосед в том же .full-descr,
     заглушка такая же, как у отзывов. */
  const franchiseRows = [];
  LC.franchise = {
    render: (row) => franchiseRows.push(row),
    clearRow: (row) => { extra.franchiseCleared.push(row); },
    cancel: (body) => extra.franchiseCancel.push(body)
  };

  const calls = { bind: [], reveal: [], schedule: [], stop: 0 };
  LC.trailer = {
    bind: (root) => calls.bind.push(root),
    /* Task 18: показ штатной кнопки «Трейлер» — отдельный от schedule вызов
       (кнопка живёт и при выключенном фоновом ролике). */
    reveal: (root, data) => { calls.reveal.push({ root, data }); return true; },
    schedule: (root, body, data) => { calls.schedule.push({ root, body, data }); return opts.controller || null; },
    stopActive: () => { calls.stop++; },
    mode: () => opts.mode || 'auto',
    /* Заглушка повторяет НАСТОЯЩУЮ LC.trailer.isLive (её саму проверяет
       test/trailer.test.mjs): признак — класс на слое, всё остальное false. */
    isLive: (layer) => !!(layer && layer.length && typeof layer.hasClass === 'function' && layer.hasClass('lumen-trailer-live'))
  };

  /* Task 17: хаб — такая же заглушка, как header/reviews/trailer. install()
     зовётся из activate(), franchise() — из complite. */
  const franchiseCalls = [];
  LC.hub = {
    install: () => { extra.hubInstall++; },
    uninstall: () => { extra.hubUninstall++; },
    franchise: (root, movie) => franchiseCalls.push({ root, movie })
  };

  /* Task 18: герой главной — заглушка того же рода, что hub/backdrops/trailer.
     Сам модуль проверяет test/hero.test.mjs; здесь важна СКЛЕЙКА: какие
     события его монтируют и снимают и какой корень при этом передан. Поэтому
     заглушка повторяет ровно тот контракт настоящего LC.hero, на который
     опирается 90_runtime.js: mount() на уже смонтированный корень — no-op
     (второго наблюдателя не бывает), detach() снимает героя только чужой
     активности, owns() отвечает «мой» лишь про корень, отданный при mount. */
  const hero = { mounts: 0, unmounts: 0, detaches: [], mountCurrent: 0, motion: 0, root: null };
  LC.hero = {
    mount: (root) => { if (hero.root === root) return; hero.mounts++; hero.root = root; },
    unmount: () => { if (!hero.root) return; hero.unmounts++; hero.root = null; },
    detach: (render) => { hero.detaches.push(render); if (hero.root && hero.root !== render) LC.hero.unmount(); },
    owns: (render) => !!render && hero.root === render,
    active: () => !!hero.root,
    mountCurrent: () => { hero.mountCurrent++; },
    applyMotion: () => { hero.motion++; }
  };

  /* Task 27: ускорители навигации. Здесь проверяется только СКЛЕЙКА — что
     смена экрана снимает панель мини-карты (дефект фазы 3: панель осталась
     поверх открытой карточки). Сам модуль проверяет test/nav.test.mjs. */
  const nav = { applies: 0, detaches: 0, uninstalls: 0 };
  LC.nav = {
    apply: () => { nav.applies++; },
    detach: () => { nav.detaches++; },
    uninstall: () => { nav.uninstalls++; }
  };

  /* Task 35: акцент от постера. Здесь важен ровно один вопрос — с каким
     вторым аргументом его зовёт карточка: 'true' означает «фильм открыт», и
     только он заказывает полную пересборку таблицы стилей (src/57_color.js).
     Потеря этого аргумента вернула бы открытую карточку на акцент из
     настроек, и без журнала такая регрессия прошла бы мимо тестов. */
  const accent = { applyFor: [], destroyed: 0 };
  LC.accent = {
    applyFor: (movie, deep) => accent.applyFor.push({ movie: movie, deep: deep }),
    setTheme: () => { },
    destroy: () => { accent.destroyed++; }
  };

  LC.init();
  return { LC, calls, full, toggles, timelines, descrRows, reviewRows, clearedRows, franchiseCalls, franchiseRows, extra, hero, nav, accent };
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

/* Task 35: акцент фильма в ОТКРЫТОЙ карточке виден весь (кнопки, кольца
   фокуса, подсветки — полсотни правил таблицы), поэтому здесь и только здесь
   заказывается полная пересборка: applyFor(movie, true). На главной герой
   зовёт applyFor(card) без второго аргумента (test/hero.test.mjs). */
test('Task 35: complite карточки зовёт applyFor с признаком «фильм открыт»', () => {
  const { full, accent } = initLC({});
  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  const movie = { id: 42, poster_path: '/a.jpg' };

  full[0]({ type: 'complite', body: body, object: {}, data: { movie: movie }, item: { render: () => root } });

  assert.equal(accent.applyFor.length, 1);
  assert.equal(accent.applyFor[0].movie, movie);
  assert.equal(accent.applyFor[0].deep, true, 'без этого карточка осталась бы на акценте из настроек');
  assert.deepEqual(warnLog, []);
});

test('Task 18: complite — reveal(root, data) зовётся отдельно от schedule и ДО него', () => {
  /* Кнопка «Трейлер» не зависит от настройки фонового ролика: при
     lumen_trailer=off schedule вернёт null, а кнопка обязана появиться. */
  const { LC, calls, full } = initLC({ controller: null, mode: 'off' });
  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const body = new FakeEl(['activity__body']);
  const data = { movie: { id: 1 }, videos: { results: [{ key: 'k', name: 'Trailer' }] } };

  full[0]({ type: 'complite', body: body, object: {}, data: data, item: { render: () => root } });

  assert.equal(calls.reveal.length, 1, 'кнопка показывается ровно один раз на карточку');
  assert.equal(calls.reveal[0].root, root);
  assert.equal(calls.reveal[0].data, data, 'ролики берутся из e.data.videos — передаём всю data');
  assert.equal(LC.active.trailer, null, 'фонового ролика при off нет, а кнопка есть');
  assert.deepEqual(warnLog, []);
});

/* Task 9: блок отзывов встраивается в тот же узел ряда описания, что и
   таблица «ПОДРОБНО» (в Lampa нельзя завести свой тип ряда — план 0.2).
   Узел ищется ОДИН раз на оба рендера: разойдись они, класс .lumen-descr-row
   и содержимое оказались бы на разных уровнях разметки ряда. */
test('Task 9: на build ряда описания таблица и отзывы получают один и тот же узел', () => {
  const { full, descrRows, reviewRows, franchiseRows } = initLC();
  const row = new FakeEl(['items-line'], [new FakeEl(['items-line__body'], [new FakeEl(['full-descr'])])]);

  full[0]({ type: 'build', name: 'description', body: EMPTY, data: { movie: { id: 1 } }, item: { render: () => row } });

  assert.equal(descrRows.length, 1, 'таблица «ПОДРОБНО» рисуется как раньше');
  assert.equal(reviewRows.length, 1, 'отзывы рисуются на том же событии');
  /* Task 28: ряд «Смотреть по порядку» — третий сосед в том же .full-descr. */
  assert.equal(franchiseRows.length, 1, 'ряд франшизы рисуется на том же событии');
  assert.equal(descrRows[0], row);
  assert.equal(reviewRows[0], row, 'оба рендера получают один узел ряда');
  assert.equal(franchiseRows[0], row, 'и ряд франшизы — тот же узел');
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

/* ====================================================================== */
/* Task 10: главный выключатель на УЖЕ ОТКРЫТОЙ карточке.                 */
/*                                                                        */
/* Настройки Lampa лежат активностью поверх карточки и при возврате не     */
/* шлют ни 'full', ни complite (находка ревью Task 8) — значит выключение  */
/* обязано само раздеть карточку: снять наши узлы, CSS-переменную подписи  */
/* кнопки «Смотреть», слайдшоу и трейлер. Саму карточку не трогаем — её    */
/* нарисует заново Lampa при следующем открытии (штатным шаблоном).        */
/* ====================================================================== */

/* Разметка открытой карточки в объёме, который снимает выключатель: узлы
   шапки лежат в .lumen-card, таблица «ПОДРОБНО» и отзывы — в ряду описания
   (он вне карточки, отдельный items-line — план 0.2). */
function openCard() {
  const facts = new FakeEl(['lumen-facts']);
  const reviews = new FakeEl(['lumen-reviews']);
  const descrRow = new FakeEl(['items-line', 'lumen-descr-row', 'lumen-descr-row--reviews'], [facts, reviews]);
  const progress = new FakeEl(['lumen-in', 'lumen-progress']);
  const episodes = new FakeEl(['lumen-in', 'lumen-episodes']);
  const card = new FakeEl(['full-start-new', 'lumen-card', 'lumen-continue'], [progress, episodes]);
  card.style.setProperty('--lumen-play-label', '"Продолжить S2 E3"');
  const layer = new FakeEl(['lumen-backdrop']);
  const body = new FakeEl(['activity__body'], [card, descrRow, layer]);
  const bodyTag = new FakeEl(['body-mock']);
  /* Ревью п.3: выключение обходит ВЕСЬ документ, а не .activity--active —
     карточки из истории Lampa не перестраивает при возврате «назад». */
  const map = {
    'body': bodyTag,
    '.lumen-card': card,
    '.lumen-descr-row': descrRow,
    '.lumen-facts': facts,
    '.lumen-reviews': reviews,
    '.lumen-progress': progress,
    '.lumen-episodes': episodes,
    '.lumen-backdrop': layer
  };
  globalThis.$ = (sel) => map[sel] || EMPTY;
  return { card, descrRow, facts, reviews, progress, episodes, layer, body, bodyTag };
}

test('Task 10: выключение снимает узлы плагина и подпись кнопки с открытой карточки', () => {
  const storage = {};
  const { LC, extra, clearedRows } = initLC({ storage });
  const c = openCard();
  LC.active = { object: {}, body: c.body, data: { movie: { id: 1 } } };

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();

  assert.equal(c.card._children.length, 0, 'строка «Продолжить» и ряд серий сняты');
  assert.equal(c.descrRow._children.length, 0, 'таблица «ПОДРОБНО» и ряд отзывов сняты');
  assert.equal(c.card.hasClass('lumen-continue'), false);
  assert.equal(c.card._css['--lumen-play-label'], undefined, 'CSS-переменная подписи кнопки снята');
  assert.equal(c.descrRow.hasClass('lumen-descr-row--reviews'), false, 'описание больше не поджато');
  assert.deepEqual(extra.bgCancel, [c.body], 'слайдшоу и трейлер сняты через LC.backdrops.cancel');
  /* Ревью (п.1): запрос отзывов снимается не через LC.reviews.cancel по
     LC.active, а обходом рядов — clearRow поднимает поколение, зовёт dropNet и
     снимает класс, и делает это для КАЖДОЙ карточки в DOM, а не только
     активной. */
  assert.deepEqual(clearedRows, [c.descrRow], 'незавершённый запрос отзывов снят через clearRow ряда');
  assert.equal(LC.active, null, 'ссылка на карточку отпущена');
  assert.equal(extra.added[extra.added.length - 1].html, '<div>orig</div>', 'штатный шаблон Lampa возвращён');
  assert.deepEqual(warnLog, []);
});

test('Task 10: карточка, открытая при выключенном плагине, не оформляется вовсе', () => {
  const { LC, full, calls, descrRows, reviewRows } = initLC({ storage: { lumen_enabled: 'false' } });
  assert.equal(full.length, 1, 'подписка на full нужна и выключенному плагину — иначе включение потребует перезагрузки');

  const root = new FakeEl(['full-start-new']);
  const body = new FakeEl(['activity__body']);
  full[0]({ type: 'complite', body: body, object: {}, data: { movie: { id: 1 } }, item: { render: () => root } });

  assert.deepEqual(descrRows, [], 'таблица «ПОДРОБНО» не рисуется');
  assert.deepEqual(reviewRows, [], 'ряд отзывов не рисуется');
  assert.equal(calls.bind.length, 0, 'трейлер не привязывается');
  assert.equal(calls.schedule.length, 0, 'трейлер не планируется');
  assert.equal(LC.active, null, 'фон не строится, карточку не запоминаем');
  assert.deepEqual(warnLog, []);
});

/* Правка пользователя 2026-09-16 (п.1): точки применения настройки
   «Показывать актёров» больше нет — вместе с настройкой и самим блоком. */
test('правка 2026-09-16 (п.1): точки применения настройки актёров не осталось', () => {
  const { LC } = initLC();
  assert.equal(typeof LC.applyCastPref, 'undefined');
});

/* Экран 09: «Ключ Kinopoisk API — нужен для отзывов и рейтинга КП». Рейтинг
   приходит тем же ответом films?imdbId, что и id для отзывов (лишних запросов
   не делаем), и ставится ТОЛЬКО если Lampa своего не дала: её значение
   (CUB/парсер) приоритетнее нашего. */
test('Task 10: LC.applyKpRate заполняет rate--kp только когда Lampa рейтинг не дала', () => {
  const { LC } = initLC();
  const value = new FakeEl([]);
  const label = new FakeEl([]);
  const chip = new FakeEl(['full-start__rate', 'rate--kp', 'hide'], [value, label]);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card .rate--kp' ? chip : EMPTY);

  LC.applyKpRate(0);
  assert.equal(chip.hasClass('hide'), true, 'нулевой рейтинг не показываем');
  LC.applyKpRate('нет');
  assert.equal(chip.hasClass('hide'), true, 'мусор не показываем');

  LC.applyKpRate(7.8);
  assert.equal(chip.hasClass('hide'), false, 'чип показан');
  assert.equal(value.text(), '7.8');

  /* Lampa уже заполнила чип (kp_rating из CUB) — своё значение не навязываем. */
  value.text('9.1');
  LC.applyKpRate(7.8);
  assert.equal(value.text(), '9.1');
  assert.deepEqual(warnLog, []);
});

test('Task 10: rate--kp на карточке нет (чужой шаблон) — LC.applyKpRate молча выходит', () => {
  const { LC } = initLC();
  globalThis.$ = () => EMPTY;
  LC.applyKpRate(7.8);
  assert.deepEqual(warnLog, []);
});

/* Ревью (п.6): когда row передан, глобального фолбэка быть не должно — иначе
   возвращается ровно то поведение, от которого защищались в п.2. */
test('ревью п.6: с переданным row чип НЕ ищется по глобальному .activity--active', () => {
  const { LC } = initLC();
  const value = new FakeEl([]);
  const foreignChip = new FakeEl(['full-start__rate', 'rate--kp', 'hide'], [value, new FakeEl([])]);
  /* Ряд своей активности чипа не содержит (карточка уже перестроена), а
     глобальный селектор ведёт на ЧУЖУЮ активную карточку. */
  const row = new FakeEl(['items-line', 'lumen-descr-row']);
  row._closestActivity = new FakeEl(['activity']);
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card .rate--kp' ? foreignChip : EMPTY);

  LC.applyKpRate(7.8, row);

  assert.equal(foreignChip.hasClass('hide'), true, 'чужой чип не тронут');
  assert.equal(value.text(), '', 'рейтинг в чужую карточку не записан');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Ревью Task 10: выключенный плагин не должен ничего оживлять.           */
/* ====================================================================== */

/* п.1. LC.backdrops.cancel гасит таймеры, но слой .lumen-backdrop остаётся в
   DOM вместе с данными кадров. Возврат «назад» на карточку из истории шлёт
   activity:start — и раньше это шло в liveSlideshow() -> revive() -> resume(),
   то есть ротация кадров и их загрузка возобновлялись при ВЫКЛЮЧЕННОМ плагине. */
test('ревью п.1: выключенный плагин — activity:start карточки со слоем ничего не оживляет', () => {
  const storage = {};
  const { LC } = initLC({ storage });
  const reviveCalls = [];
  const fresh = makeCtrl();
  LC.backdrops = { apply: () => null, cancel: () => { }, revive: (layer) => { reviveCalls.push(layer); return fresh; } };

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();

  const dead = makeCtrl();
  dead.destroy();
  const objA = makeActivityObj('A', true, dead);
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.deepEqual(reviveCalls, [], 'revive() не зовётся');
  assert.equal(fresh.resumeCalls, 0, 'ротация кадров не возобновляется');
  assert.equal(dead.resumeCalls, 0);
  assert.equal(LC.active, null, 'LC.active не восстанавливается');
  assert.deepEqual(warnLog, []);
});

/* п.4. Визуального эффекта без CSS нет, но состояние выключенный плагин
   ставить не должен: Timeline возвращал бы lumen-continue и переменную
   подписи, toggle — lumen-compact и остановку трейлера. */
test('ревью п.4: выключенный плагин не трогает состояние по toggle и Timeline', () => {
  const storage = {};
  const { LC, calls, toggles, timelines } = initLC({ storage });
  const root = new FakeEl(['lumen-card']);
  const hashes = [];
  let scheduled = 0;
  LC.header = { refreshEpisode: (h) => hashes.push(h), scheduleProgressRefresh: () => { scheduled++; }, refreshCast: () => { } };

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();
  globalThis.$ = (sel) => (sel === '.activity--active .lumen-card' ? root : EMPTY);

  toggles[0]({ name: 'full_start' });
  toggles[0]({ name: 'full_descr' });
  timelines[0]({ data: { hash: '908552078' } });

  assert.equal(root.hasClass('lumen-compact'), false, 'класс сжатой шапки не ставится');
  assert.equal(calls.stop, 0, 'трейлер не трогаем');
  assert.deepEqual(hashes, [], 'ряд серий не перерисовывается');
  assert.equal(scheduled, 0, 'строка «Продолжить» не возвращается');
  assert.deepEqual(warnLog, []);
});

/* п.3. Lampa держит карточки из истории живым DOM, и возврат «назад» их НЕ
   перестраивает. Разденем только активную — пользователь вернётся на карточку
   с нашим шаблоном и узлами, но уже без CSS. */
function setOf(list) {
  const set = {
    length: list.length,
    eq(i) { return list[i] || EMPTY; },
    remove() { list.forEach((el) => el.remove()); return set; },
    removeClass(cls) { list.forEach((el) => el.removeClass(cls)); return set; }
  };
  list.forEach((el, i) => { set[i] = el; });
  return set;
}

test('ревью п.3: выключение раздевает и карточку из истории, а не только активную', () => {
  const storage = {};
  const { LC, clearedRows } = initLC({ storage });

  function makeCard(mark) {
    const progress = new FakeEl(['lumen-in', 'lumen-progress']);
    const episodes = new FakeEl(['lumen-in', 'lumen-episodes']);
    const facts = new FakeEl(['lumen-facts']);
    const reviews = new FakeEl(['lumen-reviews']);
    const descr = new FakeEl(['items-line', 'lumen-descr-row', 'lumen-descr-row--reviews'], [facts, reviews]);
    const root = new FakeEl(['full-start-new', 'lumen-card', 'lumen-continue', 'lumen-compact', 'lumen-motion-full'], [progress, episodes]);
    root.style.setProperty('--lumen-play-label', '"Продолжить S2 E3"');
    const layer = new FakeEl(['lumen-backdrop']);
    const body = new FakeEl(['activity__body', mark], [root, descr, layer]);
    return { root, descr, progress, episodes, facts, reviews, layer, body };
  }
  const active = makeCard('active-body');
  const history = makeCard('history-body');
  LC.active = { object: {}, body: active.body, data: { movie: {} } };

  const cancelled = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancelled.push(b), revive: () => null };

  const map = {
    '.lumen-progress': [active.progress, history.progress],
    '.lumen-episodes': [active.episodes, history.episodes],
    '.lumen-facts': [active.facts, history.facts],
    '.lumen-reviews': [active.reviews, history.reviews],
    '.lumen-descr-row': [active.descr, history.descr],
    '.lumen-card': [active.root, history.root],
    '.lumen-backdrop': [active.layer, history.layer]
  };
  const bodyTag = new FakeEl(['body-mock']);
  globalThis.$ = (sel) => (sel === 'body' ? bodyTag : (map[sel] ? setOf(map[sel]) : EMPTY));

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();

  [['активная', active], ['из истории', history]].forEach(([what, c]) => {
    assert.equal(c.root._children.length, 0, what + ': узлы шапки сняты');
    assert.equal(c.descr._children.length, 0, what + ': таблица «ПОДРОБНО» и отзывы сняты');
    assert.equal(c.root.hasClass('lumen-continue'), false, what + ': класс подписи снят');
    assert.equal(c.root._css['--lumen-play-label'], undefined, what + ': CSS-переменная подписи снята');
    assert.equal(c.descr.hasClass('lumen-descr-row--reviews'), false, what + ': описание не поджато');
    assert.equal(c.descr.hasClass('lumen-descr-row'), false, what + ': маркер ряда снят');
  });
  assert.equal(cancelled.length, 2, 'слой фона гасится у обеих карточек');

  /* Ревью (п.5): класс режима движения и сжатая шапка живут и на самих
     карточках, а не только на body — иначе выключенный плагин оставил бы их. */
  [['активная', active], ['из истории', history]].forEach(([what, c]) => {
    assert.equal(c.root.hasClass('lumen-compact'), false, what + ': сжатая шапка снята');
    assert.equal(c.root.hasClass('lumen-motion-full'), false, what + ': класс режима движения снят');
  });

  /* Ревью (п.1): запрос отзывов снимается у КАЖДОГО ряда, а не только у
     LC.active, — иначе доехавший ответ вернул бы блок на раздетую карточку. */
  assert.equal(clearedRows.length, 2, 'clearRow позван для обоих рядов описания');
  assert.ok(clearedRows.indexOf(active.descr) !== -1 && clearedRows.indexOf(history.descr) !== -1,
    'сняты запросы и активной карточки, и той, что в истории');
  assert.deepEqual(warnLog, []);
});

/* Ревью (п.1), сценарий целиком: карточка A отправила запрос отзывов (таймаут
   8 с) и ушла в историю через Activity.push — Lampa для неё не шлёт ни destroy,
   ни archive, поэтому LC.reviews.cancel(LC.active.body) её не касался. Плагин
   выключают, ответ доезжает — и paintList вернул бы .lumen-reviews и класс
   lumen-descr-row--reviews на карточку, которую «назад» уже не перестроит. */
test('ревью п.1: выключение снимает запрос отзывов и у карточки, которая уже не LC.active', () => {
  const storage = {};
  const { LC, clearedRows } = initLC({ storage });

  const historyRow = new FakeEl(['items-line', 'lumen-descr-row', 'lumen-descr-row--reviews']);
  const activeRow = new FakeEl(['items-line', 'lumen-descr-row']);
  /* LC.active указывает на B — карточка A (historyRow) для него чужая. */
  LC.active = { object: {}, body: new FakeEl(['activity__body'], [activeRow]), data: { movie: {} } };

  const map = { '.lumen-descr-row': [activeRow, historyRow] };
  const bodyTag = new FakeEl(['body-mock']);
  globalThis.$ = (sel) => (sel === 'body' ? bodyTag : (map[sel] ? setOf(map[sel]) : EMPTY));

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();

  assert.equal(clearedRows.length, 2, 'оба ряда прошли через clearRow');
  assert.ok(clearedRows.indexOf(historyRow) !== -1, 'ряд карточки из истории тоже снят');
  assert.equal(historyRow.hasClass('lumen-descr-row'), false, 'класс снят ПОСЛЕ clearRow, а не до');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Task 11: LC.destroyActive() — все ресурсы открытой карточки в одной    */
/* точке.                                                                 */
/*                                                                        */
/* Поправка контроллера: отдельного интервала-стража document.body.contains */
/* здесь НЕТ — его роль выполняют проверки isMounted/isLayerMounted в      */
/* колбэках и тиках (слайдшоу, трейлер, загрузка кадра). destroyActive()   */
/* лишь сводит освобождение воедино поверх уже существующего хука          */
/* закрытия карточки (LC.onActivityEvent, Task 5b/6).                      */
/* ====================================================================== */

test('Task 11: LC.destroyActive снимает слой фона, запрос отзывов, слайдшоу и трейлер ровно по разу; повторный вызов — no-op', () => {
  const LC = freshLC();
  const cancels = [];
  const reviewCancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  /* Task 28: запрос коллекции ряда «Смотреть по порядку» — такой же ресурс
     карточки, как запрос отзывов, и снимается той же точкой. */
  const franchiseCancels = [];
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: (b) => franchiseCancels.push(b) };

  const slideshow = makeCtrl();
  let trailerDestroys = 0;
  const body = new FakeEl(['activity__body']);
  LC.active = {
    object: {}, body: body, slideshow: slideshow,
    trailer: { destroy() { trailerDestroys++; }, isAlive: () => true },
    data: { movie: { id: 1 } }
  };

  LC.destroyActive();

  assert.deepEqual(cancels, [body], 'слой фона (кадр, слайдшоу, трейлер, предзагрузка) снят через cancel(body)');
  assert.deepEqual(reviewCancels, [body], 'незавершённый запрос отзывов снят');
  assert.deepEqual(franchiseCancels, [body], 'незавершённый запрос коллекции франшизы снят');
  assert.equal(slideshow.destroyCalls, 1, 'контроллер слайдшоу уничтожен и по прямой ссылке');
  assert.equal(trailerDestroys, 1);
  assert.equal(LC.active, null, 'ссылка на карточку отпущена');

  /* Идемпотентность: 'destroy' может прийти дважды, а выключение плагина —
     наложиться на закрытие карточки. Второй раз освобождать уже нечего. */
  LC.destroyActive();
  assert.equal(cancels.length, 1);
  assert.equal(reviewCancels.length, 1);
  assert.equal(slideshow.destroyCalls, 1);
  assert.equal(trailerDestroys, 1);
  assert.deepEqual(warnLog, []);
});

test('Task 11: исключение в одном освобождении не мешает остальным и наружу не летит', () => {
  const LC = freshLC();
  const reviewCancels = [];
  let trailerDestroys = 0;
  LC.backdrops = { apply: () => null, cancel: () => { throw new Error('backdrop'); }, revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };

  const slideshow = makeCtrl();
  slideshow.destroy = function () { throw new Error('slideshow'); };
  LC.active = {
    object: {}, body: new FakeEl(['activity__body']), slideshow: slideshow,
    trailer: { destroy() { trailerDestroys++; } }, data: null
  };

  LC.destroyActive();

  assert.equal(reviewCancels.length, 1, 'запрос отзывов снят, хотя слой фона бросил исключение');
  assert.equal(trailerDestroys, 1, 'трейлер погашен, хотя слайдшоу бросило исключение');
  assert.equal(LC.active, null);
  assert.equal(warnLog.length, 2, 'каждая ошибка — свой warn, ни одна не всплыла наружу');
  warnLog.length = 0;
});

test('Task 11: LC.active обнуляется ДО освобождения — колбэк, доехавший во время уборки, карточки уже не находит', () => {
  const LC = freshLC();
  const seen = [];
  LC.backdrops = { apply: () => null, cancel: () => seen.push(LC.active), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: () => seen.push(LC.active) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };
  LC.active = { object: {}, body: new FakeEl(['activity__body']), slideshow: null, trailer: null, data: null };

  LC.destroyActive();

  assert.deepEqual(seen, [null, null], 'ни один освобождающий вызов не видит LC.active');
  assert.deepEqual(warnLog, []);
});

test('Task 11: destroy своей активности гасит трейлер даже тогда, когда слоя фона в теле уже нет', () => {
  const LC = freshLC();
  const cancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  let trailerDestroys = 0;

  /* Слоя у активности нет вовсе: Lampa успела убрать DOM (ActivitySlide.stop())
     — cancel(body) до контроллера трейлера уже не доберётся, и снять его можно
     только по ссылке из LC.active. */
  const objA = makeActivityObj('A', false, null);
  LC.active = {
    object: objA, body: new FakeEl(['activity__body']), slideshow: null,
    trailer: { destroy() { trailerDestroys++; }, isAlive: () => true }, data: null
  };

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });

  assert.equal(trailerDestroys, 1, 'контроллер трейлера снимается по ссылке из LC.active, а не только через слой');
  assert.equal(cancels.length, 1);
  assert.equal(LC.active, null);
  assert.deepEqual(warnLog, []);
});

test('Task 11: тик Timeline после destroyActive карточку не воскрешает и в закрытую не рисует', () => {
  const { LC, timelines } = initLC();
  let scheduled = 0;
  const hashes = [];
  LC.header = { refreshEpisode: (h) => hashes.push(h), scheduleProgressRefresh: () => { scheduled++; }, refreshCast: () => { } };
  LC.backdrops = { apply: () => null, cancel: () => { }, revive: () => null };
  LC.active = { object: {}, body: new FakeEl(['activity__body']), slideshow: null, trailer: null, data: null };

  LC.destroyActive();
  timelines[0]({ data: { hash: '908552078' } });

  assert.equal(LC.active, null, 'подписка Timeline закрытую карточку не восстанавливает');
  assert.equal(scheduled, 1, 'перерисовка идёт по живому DOM — закрытой карточки в нём уже нет');
  assert.deepEqual(hashes, ['908552078']);
  assert.deepEqual(warnLog, []);
});

test('Task 11: выключенный плагин — destroyActive безопасен, ресурсы карточки заново не создаются', () => {
  const storage = {};
  const { LC, full, calls } = initLC({ storage });

  storage.lumen_enabled = 'false';
  LC.applyEnabledPref();
  assert.equal(LC.active, null);

  LC.destroyActive(); // карточки нет — освобождать нечего

  full[0]({
    type: 'complite', body: new FakeEl(['activity__body']), object: {},
    data: { movie: { id: 1 } }, item: { render: () => new FakeEl(['full-start-new']) }
  });

  assert.equal(LC.active, null, 'выключенный плагин карточку не запоминает');
  assert.equal(calls.schedule.length, 0, 'трейлер не планируется');
  assert.equal(calls.bind.length, 0);
  LC.destroyActive();
  assert.deepEqual(warnLog, []);
});

/* Step 2: шаблон — единственное, без чего оформлять нечем. Если Lampa его не
   приняла, плагин обязан остаться выключенным с ОРИГИНАЛЬНЫМ шаблоном, а не
   считать себя активным (иначе подписка 'full' начала бы дорисовывать блоки в
   штатную карточку, для которой наших классов нет). */
test('Task 11 (Step 2): ошибка подмены шаблона на init — оригинал возвращён, оформление не активируется', () => {
  const { LC, full, extra, calls, descrRows } = initLC({ templateAddFails: true });

  assert.equal(extra.added[extra.added.length - 1].html, '<div>orig</div>', 'штатный шаблон Lampa возвращён');
  assert.equal(extra.css, 0, 'откат целиком: CSS не инжектится — иначе стили и классы легли бы на штатную карточку, а снять их было бы некому');
  assert.equal(warnLog.length, 1, 'ошибка записана в warn и наружу не вышла');
  warnLog.length = 0;

  /* Подписка заведена (включение из настроек не должно требовать перезагрузки),
     но оформление выключено — обработчик выходит первой же строкой. */
  assert.equal(full.length, 1);
  full[0]({
    type: 'complite', body: new FakeEl(['activity__body']), object: {},
    data: { movie: { id: 1 } }, item: { render: () => new FakeEl(['full-start-new']) }
  });

  assert.equal(LC.active, null, 'карточка не оформляется и не запоминается');
  assert.deepEqual(descrRows, []);
  assert.equal(calls.schedule.length, 0);
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Долг Task 11 (сверка с планом): покидаемая карточка освобождается на    */
/* start возвращаемой.                                                    */
/*                                                                        */
/* Порядок событий Lampa при backward() снят живьём: start:full(A) ->      */
/* archive:full(A) -> destroy:full(B). К моменту destroy(B) ветка «своей    */
/* активности» уже не про B (LC.active переключён на A), а ветка           */
/* осиротевших слоя не находит — Lampa успевает вычистить                  */
/* B.activity.render(). Раньше ресурсы B снимал только self-heal: трейлер  */
/* — сторожем за 1 с, слайдшоу — СЛЕДУЮЩИМ тиком ротации, то есть до       */
/* 8-20 с (по настройке интервала) закрытая карточка крутила таймер и      */
/* тянула фоновые кадры.                                                   */
/* ====================================================================== */

test('долг Task 11: backward A->B — start возвращаемой освобождает ресурсы покидаемой сразу, не дожидаясь её тика', () => {
  const LC = freshLC();
  const cancels = [];
  const reviewCancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };

  const ctrlA = makeCtrl();
  const objA = makeActivityObj('A', true, ctrlA);  // к ней возвращаемся
  const ctrlB = makeCtrl();
  const objB = makeActivityObj('B', true, ctrlB);  // покидаемая, сейчас LC.active
  let trailerB = 0;
  const bodyB = objB.activity.render().find('.lumen-backdrop').parent();
  LC.active = {
    object: objB, body: bodyB, slideshow: ctrlB,
    trailer: { destroy() { trailerB++; }, isAlive: () => true }, data: null
  };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.deepEqual(cancels, [bodyB], 'слой покидаемой снят на start возвращаемой');
  assert.deepEqual(reviewCancels, [bodyB], 'и её незавершённый запрос отзывов тоже');
  assert.equal(ctrlB.destroyCalls, 1, 'интервал ротации покидаемой снят до тика');
  assert.equal(trailerB, 1, 'трейлер покидаемой погашен, не дожидаясь сторожа');

  assert.equal(LC.active.object, objA, 'LC.active переключился на возвращаемую');
  assert.equal(LC.active.slideshow, ctrlA);
  assert.equal(ctrlA.resumeCalls, 1, 'возвращаемая ожила');

  /* Идемпотентность: повторный start той же карточки идёт веткой «своей
     активности» — второй раз освобождать нечего. */
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(cancels.length, 1, 'destroyActive второй раз не зовётся');
  assert.equal(ctrlA.resumeCalls, 2);
  assert.deepEqual(warnLog, []);
});

/* Дефект фазы 3 (найден живьём в Task 22/23): панель мини-карты рядов
   осталась видимой поверх открытой карточки. Панель снималась только через
   0.8 с после отпускания клавиши, и, успей человек за это время нажать OK,
   карточка открывалась под ней. Панель принадлежит экрану — значит снимать
   её обязана смена экрана, а она видна ровно по 'start' той активности, куда
   ушли (для покидаемой Lampa событий не шлёт вовсе). */
test('Task 27 (дефект): старт любой активности снимает панель мини-карты', () => {
  const { LC, nav } = initLC();
  const objCard = makeActivityObj('Карточка', false, null);

  LC.onActivityEvent({ type: 'start', component: 'full', object: objCard });
  assert.equal(nav.detaches, 1, 'открытие карточки снимает панель немедленно');

  LC.onActivityEvent({ type: 'start', component: 'main', object: makeActivityObj('Главная', false, null) });
  assert.equal(nav.detaches, 2, 'и возврат на главную тоже: экран пересобран заново');

  /* События, которые экран не меняют, панель не трогают: она нужна ровно
     столько, сколько человек держит клавишу. */
  LC.onActivityEvent({ type: 'archive', component: 'full', object: objCard });
  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objCard });
  assert.equal(nav.detaches, 2);
  assert.deepEqual(warnLog, []);
});

test('долг Task 11: возврат к ТОЙ ЖЕ карточке по-прежнему оживляет её слайдшоу, а не уничтожает', () => {
  const LC = freshLC();
  const cancels = [];
  const reviveCalls = [];
  const freshCtrl = makeCtrl();
  LC.backdrops = {
    apply: () => null,
    cancel: (b) => cancels.push(b),
    revive: (layer) => { reviveCalls.push(layer); return freshCtrl; }
  };

  const deadCtrl = makeCtrl();
  deadCtrl.destroy(); // Lampa тихо убрала DOM, тик self-heal уничтожил контроллер
  const objA = makeActivityObj('A', true, deadCtrl);
  LC.active = { object: objA, body: {}, slideshow: deadCtrl, trailer: null, data: null };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.deepEqual(cancels, [], 'своя карточка не освобождается — её оживляют (поведение Task 6)');
  assert.equal(reviveCalls.length, 1);
  assert.equal(LC.active.slideshow, freshCtrl);
  assert.equal(freshCtrl.resumeCalls, 1, 'ротация вернулась');
  assert.deepEqual(warnLog, []);
});

test('долг Task 11: push вглубь (start ещё не построенной карточки) ресурсы покидаемой не трогает', () => {
  const LC = freshLC();
  const cancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };

  const ctrlA = makeCtrl();
  const objA = makeActivityObj('A', true, ctrlA);
  const bodyA = objA.activity.render().find('.lumen-backdrop').parent();
  LC.active = { object: objA, body: bodyA, slideshow: ctrlA, trailer: null, data: null };

  /* У новой карточки слоя ещё нет — apply() не отработал. Это push вглубь:
     A остаётся жить в истории, её ротация только паузится тиком по
     .activity--active, уничтожать её нельзя. */
  const objB = makeActivityObj('B', false, null);
  LC.onActivityEvent({ type: 'start', component: 'full', object: objB });

  assert.deepEqual(cancels, [], 'карточка в истории продолжает жить');
  assert.equal(ctrlA.destroyCalls, 0);
  assert.equal(LC.active.object, objA, 'LC.active по-прежнему указывает на неё');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Ревью фазы 1 (I2): осиротевшая карточка освобождалась наполовину.      */
/*                                                                        */
/* Ветка 'destroy' ЧУЖОЙ активности звала только LC.backdrops.cancel,      */
/* тогда как своя (LC.destroyActive) освобождает и фон, и незавершённый    */
/* запрос отзывов. Lampa шлёт destroy чужой активности при вытеснении по   */
/* лимиту истории maxsave — это регулярный путь, а не экзотика; запрос     */
/* отзывов при этом живёт до таймаута 8 с и держит замыканием holder/row   */
/* уже уничтоженной карточки (инвариант 0.3 п.5).                          */
/* ====================================================================== */

test('I2: destroy осиротевшей карточки снимает и слой фона, и незавершённый запрос отзывов', () => {
  const LC = freshLC();
  const cancels = [];
  const reviewCancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };

  const objA = makeActivityObj('A', true, makeCtrl());
  const objC = makeActivityObj('C', true, makeCtrl());
  LC.active = {
    object: objC, body: objC.activity.render().find('.lumen-backdrop').parent(),
    slideshow: null, trailer: null, data: null
  };

  const bodyA = objA.activity.render().find('.lumen-backdrop').parent();
  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });

  assert.deepEqual(cancels, [bodyA], 'слой фона осиротевшей карточки снят');
  assert.deepEqual(reviewCancels, [bodyA],
    'её запрос отзывов снимается тем же телом активности — cancel ищет body.find(".full-descr")');
  assert.equal(LC.active.object, objC, 'текущая карточка не тронута');
  assert.deepEqual(warnLog, []);
});

test('I2: у осиротевшей карточки без слоя не зовётся ни один cancel', () => {
  const LC = freshLC();
  const cancels = [];
  const reviewCancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };
  LC.active = { object: makeActivityObj('C', true, makeCtrl()), body: {}, slideshow: null };

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: makeActivityObj('Other', false, null) });

  assert.deepEqual(cancels, []);
  assert.deepEqual(reviewCancels, [],
    'без слоя тела активности взять неоткуда — второго способа его искать не заводим');
  assert.deepEqual(warnLog, []);
});

/* Инвариант LC.destroyActive «ошибка одного ресурса не оставляет остальные
   висеть» действует и в ветке осиротевших: вытеснение по лимиту истории
   maxsave — регулярный путь, и падение одного освобождения не должно возвращать
   ровно тот дефект (висящий запрос отзывов), который чинит I2. */
test('I2: исключение при снятии фона не мешает снять запрос отзывов осиротевшей карточки', () => {
  const LC = freshLC();
  const reviewCancels = [];
  LC.backdrops = { apply: () => null, cancel: () => { throw new Error('backdrop'); }, revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: (b) => reviewCancels.push(b) };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };

  const objA = makeActivityObj('A', true, makeCtrl());
  const bodyA = objA.activity.render().find('.lumen-backdrop').parent();
  LC.active = { object: makeActivityObj('C', true, makeCtrl()), body: {}, slideshow: null, trailer: null, data: null };

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });

  assert.deepEqual(reviewCancels, [bodyA], 'запрос отзывов снят, хотя слой фона бросил исключение');
  assert.equal(warnLog.length, 1, 'ошибка записана своим warn и наружу не вышла');
  warnLog.length = 0;
});

/* ====================================================================== */
/* Ревью фазы 1, второй круг (Important 2): M1 закрыт на ВСЕХ входах.      */
/*                                                                        */
/* resume() без гейта оставался ещё в двух местах LC.onActivityEvent — в   */
/* ветке 'archive'|'start' своей активности и при восстановлении карточки  */
/* из истории. Сценарий: ролик играет, пользователь ушёл вглубь и вернулся */
/* БЫСТРЕЕ, чем тикнул сторож трейлера (WATCH_MS 1000), — ротация снимала  */
/* паузу под живым iframe, то есть ровно тот дефект, что чинил M1, но      */
/* другим входом.                                                          */
/* ====================================================================== */

test('Important 2: archive/start своей активности — под играющим роликом resume() не зовём', () => {
  const LC = freshLC();
  const ctrl = makeCtrl();
  const objA = makeActivityObj('A', true, ctrl);
  const layer = objA.activity.render().find('.lumen-backdrop');
  layer.addClass('lumen-trailer-live');                 // ролик играет
  LC.backdrops = { apply: () => null, cancel: () => { }, revive: () => null };
  LC.active = { object: objA, body: layer.parent(), slideshow: ctrl, trailer: null, data: null };

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(ctrl.resumeCalls, 0, 'вернулись раньше сторожа — кадры под роликом не поднимаем');

  LC.onActivityEvent({ type: 'archive', component: 'full', object: objA });
  assert.equal(ctrl.resumeCalls, 0, 'archive той же активности — то же самое');

  /* Сторож (или конец ролика) снял класс — поведение прежнее. */
  layer.removeClass('lumen-trailer-live');
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(ctrl.resumeCalls, 1, 'ролика нет — карточка оживает как раньше');
  assert.deepEqual(warnLog, []);
});

test('Important 2: восстановление карточки из истории — под играющим роликом resume() не зовём', () => {
  const LC = freshLC();
  const ctrl = makeCtrl();
  const objA = makeActivityObj('A', true, ctrl);
  const layer = objA.activity.render().find('.lumen-backdrop');
  layer.addClass('lumen-trailer-live');
  LC.backdrops = { apply: () => null, cancel: () => { }, revive: () => null };
  LC.active = null;                                     // не текущая — ветка восстановления

  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });

  assert.equal(LC.active.object, objA, 'LC.active восстановлен со слоя');
  assert.equal(ctrl.resumeCalls, 0, 'ротация под играющим роликом не поднимается');

  layer.removeClass('lumen-trailer-live');
  LC.active = null;
  LC.onActivityEvent({ type: 'start', component: 'full', object: objA });
  assert.equal(ctrl.resumeCalls, 1, 'ролик кончился — возврат оживляет карточку как прежде');
  assert.deepEqual(warnLog, []);
});

/* Minor 6: у DOM-узла children — это HTMLCollection, а не функция. Проверка
   «есть свойство» пропустила бы вызов, тот бросил бы TypeError, и ротация
   после смены настройки не вернулась бы вовсе. */
test('Minor 6: тело активности с DOM-ским children (HTMLCollection) — гейт не падает и ротацию возвращает', () => {
  const { LC } = initLC({ storage: { lumen_slideshow: 'true' } });
  const slideshow = makeCtrl();
  LC.active = { object: {}, body: { children: { length: 0 } }, slideshow: slideshow, trailer: null, data: null };

  LC.applySlideshowPref();

  assert.equal(slideshow.pauseCalls, 1);
  assert.equal(slideshow.resumeCalls, 1, 'ротация обязана вернуться, а не утонуть в TypeError');
  assert.deepEqual(warnLog, [], 'исключения быть не должно вовсе');
});

/* Important 3: флаг inited поднимается ДО addSettings/saveOriginalTemplate/
   template.build, поэтому любое исключение делало состояние необратимым —
   второй 'app':ready уже ничего не собрал бы, и пользователь остался бы без
   оформления до перезапуска Lampa. */
test('Important 3: исключение в LC.init сбрасывает флаг — повторный заход собирает оформление', () => {
  const { LC, full, extra } = initLC({ buildThrowsOnce: true });

  assert.equal(full.length, 0, 'первый заход упал до подписки на full');
  assert.equal(warnLog.length, 1, 'падение записано в warn');
  warnLog.length = 0;

  LC.init();

  assert.equal(full.length, 1, 'повторный init завёл подписку — состояние не заперто навсегда');
  assert.equal(extra.added[extra.added.length - 1].html, '<div class="lumen-card"></div>', 'шаблон подменён');
  assert.deepEqual(warnLog, []);
});

/* Ревью фазы 1, третий круг (Important): подписка на 'full' была последней без
   собственного флага — её гардом служил inited, а он теперь сбрасывается в
   catch (Important 3). Значит исключение МЕЖДУ подпиской и концом init делало
   второй 'app':ready заводящим вторую подписку: двойные decorate/descr/
   reviews.render/backdrops.apply на каждой карточке, LC.active переписывается
   дважды — на ТВ это мерцание фона и дублирующийся запрос отзывов на каждое
   открытие. Существующий тест выше роняет template.build, то есть ДО подписки,
   и этот случай не покрывает. */
test('Important (3-й круг): исключение ПОСЛЕ подписки на full — повторный init не заводит вторую', () => {
  const { LC, full, extra, descrRows, reviewRows } = initLC({ injectCssThrowsOnce: true });

  assert.equal(full.length, 1, 'подписка уже заведена — падение случилось после неё');
  assert.equal(warnLog.length, 1, 'падение записано в warn');
  warnLog.length = 0;

  LC.init();                       // inited сброшен в catch — заход повторяется
  assert.equal(full.length, 1, 'вторая подписка на full не заведена');
  /* Оформление повторный заход при этом НЕ пересобирает: activate() пометил его
     активным ещё до падения injectCss и назад флаг не откатывает (откат есть
     только у неудачной подмены шаблона, Task 11 Step 2). К этой находке отношения
     не имеет — здесь важно ровно то, что подписка не удвоилась, — но проверку на
     extra.css тут держать нельзя, она бы утверждала обратное. */

  /* Lampa рассылает событие ВСЕМ подписчикам — так и проверяем цену дубля. */
  const root = new FakeEl(['full-start-new', 'lumen-card']);
  const descr = new FakeEl(['full-descr']);
  const body = new FakeEl(['activity__body'], [new FakeEl(['items-line'], [new FakeEl(['items-line__body'], [descr])])]);
  full.forEach((fn) => fn({ type: 'complite', body: body, object: {}, data: { movie: { id: 1 } }, item: { render: () => root } }));

  assert.equal(descrRows.length, 1, 'таблица «ПОДРОБНО» рисуется один раз');
  assert.equal(reviewRows.length, 1, 'запрос отзывов уходит один раз, а не дважды на карточку');
  assert.deepEqual(warnLog, []);
});

/* Minor (3-й круг): Minor 6 был исправлен только в гейте слайдшоу. Здесь тот же
   паттерн на дубле данных карточки: у DOM-узла children — HTMLCollection, вызов
   бросал TypeError. Он гасился своим try/catch, поэтому симптом мягче — карточка
   тихо теряла lumenData на слое, и ряд отзывов после возврата из истории
   перерисовать было бы нечем (LC.applyReviewsPref читает LC.active.data). */
test('Minor 6 (3-й круг): тело-DOM-узел на complite — дубль данных на слое не бросает TypeError', () => {
  const { LC, full } = initLC();
  const root = new FakeEl(['full-start-new', 'lumen-card']);

  full[0]({ type: 'complite', body: { children: { length: 0 } }, object: {}, data: { movie: { id: 1 } }, item: { render: () => root } });

  assert.deepEqual(warnLog, [], 'вызов HTMLCollection как функции дал бы TypeError и warn');
  assert.equal(LC.active.data.movie.id, 1, 'сама карточка при этом запомнена');
});

test('Important 3: успешный init флаг сохраняет — идемпотентность не пострадала', () => {
  const { LC, full } = initLC();
  assert.equal(full.length, 1);
  LC.init();
  LC.init();
  assert.equal(full.length, 1, 'второй и третий заход по-прежнему no-op');
  assert.deepEqual(warnLog, []);
});

test('I2: исключение при снятии запроса отзывов не отменяет уже сделанное освобождение фона', () => {
  const LC = freshLC();
  const cancels = [];
  LC.backdrops = { apply: () => null, cancel: (b) => cancels.push(b), revive: () => null };
  LC.reviews = { render: () => { }, clearRow: () => { }, cancel: () => { throw new Error('reviews'); } };
  LC.franchise = { render: () => { }, clearRow: () => { }, cancel: () => { } };

  const objA = makeActivityObj('A', true, makeCtrl());
  const bodyA = objA.activity.render().find('.lumen-backdrop').parent();
  LC.active = null;

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: objA });

  assert.deepEqual(cancels, [bodyA], 'фон освобождён');
  assert.equal(warnLog.length, 1, 'исключение не всплыло в подписку activity');
  warnLog.length = 0;
});

/* ====================================================================== */
/* Ревью фазы 1 (M1): слайдшоу под играющим трейлером.                    */
/*                                                                        */
/* applySlideshowPref делал pause()+resume(), не глядя на трейлер: смена   */
/* настройки слайдшоу во время ролика поднимала ротацию кадров ПОД ним —   */
/* загрузка w1280 и кроссфейд в фон играющего iframe.                      */
/*                                                                        */
/* Признак «ролик РЕАЛЬНО играет» — класс lumen-trailer-live на слое, его    */
/* ставит onStart вместе с паузой слайдшоу и снимает cleanup() (жизненный   */
/* цикл класса запинан в test/trailer.test.mjs:550-560, 596-597, 706).      */
/* Живости контроллера здесь НЕДОСТАТОЧНО: schedule() возвращает живой      */
/* контроллер сразу, а ролик стартует лишь через 3 с и может не стартовать  */
/* вовсе (таймаут 6 с). Гейт по живости заморозил бы слайдшоу на всё это    */
/* окно, и при неудавшемся ролике cleanup() его бы не вернул — paused у     */
/* него остался бы false. Слой берётся из LC.active.body тем же путём, что  */
/* и везде в модуле (body.children('.lumen-backdrop')), без глобального     */
/* .activity--active.                                                       */
/* ====================================================================== */

function activeWithLayer(LC, slideshow, opts) {
  opts = opts || {};
  const layer = new FakeEl(opts.live ? ['lumen-backdrop', 'lumen-trailer-live'] : ['lumen-backdrop']);
  const body = new FakeEl(['activity__body'], [layer]);
  LC.active = { object: {}, body: body, slideshow: slideshow, trailer: opts.trailer || null, data: null };
  return layer;
}

test('M1: под играющим роликом кадры не поднимаем — признак берётся со слоя (lumen-trailer-live)', () => {
  const { LC } = initLC({ storage: { lumen_slideshow: 'true' } });
  const slideshow = makeCtrl();
  const layer = activeWithLayer(LC, slideshow, { live: true, trailer: { destroy() { }, isAlive: () => true } });

  LC.applySlideshowPref();
  assert.equal(slideshow.pauseCalls, 1, 'пауза ставится всегда — «выключили слайдшоу» обязано сработать и под роликом');
  assert.equal(slideshow.resumeCalls, 0, 'под играющим роликом кадры не крутим');

  /* Ролик закончился штатно: cleanup() снял класс со слоя (и сам вернул
     ротацию — паузу ставил onStart, paused был true). Поведение прежнее. */
  layer.removeClass('lumen-trailer-live');
  LC.applySlideshowPref();
  assert.equal(slideshow.pauseCalls, 2);
  assert.equal(slideshow.resumeCalls, 1, 'ролик кончился — ротация возвращается');
  assert.deepEqual(warnLog, []);
});

/* Долг, закрытый по решению координатора: именно тот сценарий, ради которого
   признак уточнён с «контроллер жив» до «ролик реально играет». */
test('M1 (долг): настройку сменили в окне ожидания ролика, ролик не завёлся — слайдшоу не осталось на паузе', () => {
  const { LC } = initLC({ storage: { lumen_slideshow: 'true' } });
  const slideshow = makeCtrl();
  /* Окно ожидания: schedule() уже вернул ЖИВОЙ контроллер (таймер старта 3 с,
     дальше таймаут 6 с), но onStart ещё не случился — класса на слое нет и
     слайдшоу никто не паузил. */
  const layer = activeWithLayer(LC, slideshow, { live: false, trailer: { destroy() { }, isAlive: () => true } });

  LC.applySlideshowPref();

  assert.equal(slideshow.resumeCalls, 1,
    'ролик ещё не пошёл — кадры обязаны крутиться, одного живого контроллера мало');

  /* Ролик так и не завёлся (нет сети, YouTube недоступен): player() убивает
     себя по WAIT_MS -> onEnd -> cleanup(). Класс на слой не ставился, paused у
     трейлера остался false — значит cleanup() слайдшоу НЕ возобновляет. Если
     бы мы оставили его на паузе, он провисел бы до переоткрытия карточки. */
  assert.equal(layer.hasClass('lumen-trailer-live'), false, 'ролик не играл — класса на слое не было');
  assert.equal(slideshow.pauseCalls, 1);
  assert.equal(slideshow.resumeCalls, 1, 'слайдшоу не должно остаться на паузе после неудавшегося трейлера');
  assert.deepEqual(warnLog, []);
});

test('M1: без трейлера поведение прежнее — включено резюмирует, выключено только паузит', () => {
  const storage = {};
  const { LC } = initLC({ storage });
  const slideshow = makeCtrl();
  activeWithLayer(LC, slideshow, { live: false });

  LC.applySlideshowPref();
  assert.equal(slideshow.resumeCalls, 1);

  storage.lumen_slideshow = 'false';
  LC.applySlideshowPref();
  assert.equal(slideshow.pauseCalls, 2);
  assert.equal(slideshow.resumeCalls, 1, 'выключенное слайдшоу остаётся на текущем кадре');

  /* Тела активности со слоем может не оказаться вовсе (слой сняли, тело
     пересобрали) — гейт не должен ни падать, ни блокировать ротацию. */
  storage.lumen_slideshow = 'true';
  LC.active = { object: {}, body: EMPTY, slideshow: slideshow, trailer: null, data: null };
  LC.applySlideshowPref();
  assert.equal(slideshow.resumeCalls, 2, 'без слоя признака «ролик играет» нет — ротация возвращается');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Ревью фазы 1 (M2): единственное сообщение плагина пользователю.        */
/*                                                                        */
/* «Lumen Card: версия Lampa не поддерживается» было зашито литералом      */
/* прямо в вызов Noty.show — и всегда по-русски, в том числе в en/uk       */
/* интерфейсе. Теперь строка живёт в LC.STRINGS (ru/en/uk) и проходит      */
/* через LC.lang, у которого есть собственный фолбэк на словарь, если      */
/* Lampa.Lang не поднялся (в этом окружении его translate и нет).          */
/* ====================================================================== */

test('M2: сообщение о неподдерживаемой сборке Lampa берётся из LC.STRINGS, а не из литерала', () => {
  /* Проверяем именно ВЫЗОВ, а не текст файла целиком: сама фраза законно
     остаётся в комментариях рантайма, которые объясняют ветку неподдерживаемой
     сборки (в этом проекте комментарии несут вес документации). Дефект, от
     которого защищаемся, — строковый литерал в Noty.show: любое сообщение
     пользователю обязано идти через LC.lang. */
  const src = readFileSync(new URL('../src/90_runtime.js', import.meta.url), 'utf8');
  assert.equal(/Noty\.show\(\s*['"]/.test(src), false,
    'Lampa.Noty.show обязан получать строку из LC.lang, а не литерал');

  const ru = initLC({ templateUnsupported: true });
  assert.deepEqual(ru.extra.noty, [ru.LC.STRINGS.lumen_card_unsupported.ru]);
  /* В этой ветке Lampa.Template.add не зовётся ВООБЩЕ: init выходит раньше, чем
     наш шаблон попадёт в our_template и в activate(), — штатный шаблон даже не
     трогали, и восстанавливать нечего. Это не то же самое, что ветка «add
     бросил исключение» (тест Task 11 Step 2 выше), где оригинал возвращают явно. */
  assert.deepEqual(ru.extra.added, [], 'штатный шаблон Lampa не подменяется вовсе');
  assert.equal(warnLog.length, 1, 'причина отказа по-прежнему уходит в warn');

  const en = initLC({ templateUnsupported: true, storage: { language: 'en' } });
  assert.deepEqual(en.extra.noty, [en.LC.STRINGS.lumen_card_unsupported.en]);
  assert.notEqual(en.extra.noty[0], en.LC.STRINGS.lumen_card_unsupported.ru,
    'в en-интерфейсе пользователь не должен получать русскую строку');
  warnLog.length = 0;
});


/* ====================================================================== */
/* Task 18: событийная склейка героя главной. Ветки в LC.onActivityEvent   */
/* иначе не исполняются ни одним тестом — LC.hero там просто не было бы,   */
/* и все `if (LC.hero)` тихо проходили бы мимо.                            */
/* ====================================================================== */

function heroLC() {
  const ctx = initLC();
  ctx.LC.backdrops = { apply: () => null, cancel: () => { } };
  return ctx;
}

test('Task 18: старт главной монтирует героя в корень её активности', () => {
  const { LC, hero } = heroLC();
  const main = makeActivityObj('main', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.equal(hero.mounts, 1);
  assert.equal(hero.root, main.activity.render(), 'герою отдан render() активности главной');
  assert.deepEqual(warnLog, []);
});

test('Task 18: повторный старт той же главной второго наблюдателя не заводит', () => {
  const { LC, hero } = heroLC();
  const main = makeActivityObj('main', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  /* Возврат из карточки шлёт start ещё раз — герой обязан остаться тем же. */
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.equal(hero.mounts, 1, 'монтирование одно');
  assert.equal(hero.unmounts, 0, 'и снятия между ними не было — кадр не мигает');
});

test('Task 18: старт полной карточки снимает героя главной (уход вглубь Lampa событием не сопровождает)', () => {
  const { LC, hero } = heroLC();
  const main = makeActivityObj('main', false);
  const card = makeActivityObj('card', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });

  LC.onActivityEvent({ type: 'start', component: 'full', object: card });
  assert.equal(hero.detaches[hero.detaches.length - 1], card.activity.render(), 'detach получил корень стартующей активности');
  assert.equal(hero.unmounts, 1);
  assert.equal(hero.root, null, 'герой снят');
  assert.equal(hero.mounts, 1, 'на чужой активности герой не монтируется');

  /* Возврат на главную поднимает его заново. */
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.equal(hero.mounts, 2);
  assert.ok(hero.root, 'герой снова на главной');
  assert.deepEqual(warnLog, []);
});

test('Task 18: destroy ЧУЖОЙ активности героя не трогает', () => {
  const { LC, hero } = heroLC();
  const main = makeActivityObj('main', false);
  const other = makeActivityObj('other', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });

  /* Вытеснение чужой карточки по лимиту истории — регулярный путь Lampa. */
  LC.onActivityEvent({ type: 'destroy', component: 'full', object: other });
  assert.equal(hero.unmounts, 0, 'owns() сказал «не мой»');
  assert.equal(hero.root, main.activity.render(), 'герой остался на главной');
});

test('Task 18: destroy активности-хозяина снимает героя', () => {
  const { LC, hero } = heroLC();
  const main = makeActivityObj('main', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });

  LC.onActivityEvent({ type: 'destroy', component: 'main', object: main });
  assert.equal(hero.unmounts, 1);
  assert.equal(hero.root, null);
  /* Повторный destroy идемпотентен. */
  LC.onActivityEvent({ type: 'destroy', component: 'main', object: main });
  assert.equal(hero.unmounts, 1);
  assert.deepEqual(warnLog, []);
});

test('Task 18: выключение плагина снимает героя, включение ставит его на открытую главную', () => {
  /* LC.init() уже прошёл через activate() — считаем ДЕЛЬТЫ от этого старта. */
  const { LC, hero } = heroLC();
  const mountedAtStart = hero.mountCurrent;
  const main = makeActivityObj('main', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.ok(hero.root, 'герой на главной');

  /* lumen_enabled читается из Storage; переключатели Lampa пишут строки. */
  globalThis.Lampa.Storage.field = (name) => (name === 'lumen_enabled' ? 'false' : undefined);
  globalThis.Lampa.Storage.get = (name, def) => (name === 'lumen_enabled' ? 'false' : def);
  LC.applyEnabledPref();
  assert.equal(hero.unmounts, 1, 'deactivate() снял героя целиком');
  assert.equal(hero.root, null);

  globalThis.Lampa.Storage.field = () => undefined;
  globalThis.Lampa.Storage.get = (name, def) => def;
  LC.applyEnabledPref();
  assert.equal(hero.mountCurrent - mountedAtStart, 1, 'activate() зовёт mountCurrent — возврат из настроек события не шлёт');
  assert.deepEqual(warnLog, []);
});

test('Task 18: смена режима анимаций доезжает до открытого героя', () => {
  const { LC, hero } = heroLC();
  LC.applyMotionMode();
  assert.equal(hero.motion, 1);
});

/* ====================================================================== */
/* Fix-раунд итогового ревью фазы 2.                                      */
/* ====================================================================== */

/* C1: поколение рядов главной поднимается ТОЛЬКО на 'destroy'.
   Реальная последовательность Lampa 3.3.4 (vendor/lampa/app.min.js,
   push$3 / backward() / start$4):
     push вглубь — покидаемая главная не получает вообще ничего;
     backward() — 'destroy' покидаемой активности, затем 'start' и
     'archive' той, к которой ВЕРНУЛИСЬ.
   То есть archive главной означает «снова на экране». Гашение рядов по
   archive убивало недогруженные ряды при каждом возврате из карточки. */
function genLC() {
  const ctx = heroLC();
  ctx.bumps = [];
  ctx.LC.rows = { bumpGen: () => ctx.bumps.push('rows') };
  ctx.LC.personal = { bumpGen: () => ctx.bumps.push('personal') };
  return ctx;
}

test('C1: последовательность backward() (destroy карточки → start+archive главной) поколение не поднимает', () => {
  const { LC, bumps } = genLC();
  const main = makeActivityObj('main', false);
  const card = makeActivityObj('card', false);

  /* Уход вглубь: Lampa шлёт только start карточки. */
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  LC.onActivityEvent({ type: 'start', component: 'full', object: card });
  assert.deepEqual(bumps, [], 'push вглубь главную не трогает');

  /* Возврат: destroy карточки, затем start и archive главной. */
  LC.onActivityEvent({ type: 'destroy', component: 'full', object: card });
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  LC.onActivityEvent({ type: 'archive', component: 'main', object: main });

  assert.deepEqual(bumps, [], 'archive главной — это «снова на экране», ряды обязаны достраиваться');
  assert.deepEqual(warnLog, []);
});

test('C1: destroy главной (вытеснение по лимиту истории) поколение поднимает', () => {
  const { LC, bumps } = genLC();
  const main = makeActivityObj('main', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  LC.onActivityEvent({ type: 'destroy', component: 'main', object: main });
  assert.deepEqual(bumps, ['rows', 'personal'], 'главную выбросили — запросы её рядов больше не нужны');
});

/* C2: настройки и селектбокс — это СЛОЙ поверх активности; активностью всё
   это время остаётся главная. Пересборка под открытым слоем уводит фокус:
   ActivitySlide.start() делает Controller.toggle('content'), и пульт
   перестаёт управлять открытым списком. Признак слоя берём тот же, что
   сама Lampa (body.settings--open / body.selectbox--open / .modal —
   vendor/lampa/app.min.js, toContent()). */
function layerLC(state) {
  const ctx = initLC();
  ctx.LC.backdrops = { apply: () => null, cancel: () => { } };
  const replaces = [];
  const bodyEl = new FakeEl(['body']);
  globalThis.$ = (sel) => {
    if (sel === 'body') return bodyEl;
    return EMPTY;
  };
  globalThis.Lampa.Activity = {
    active: () => ({ component: 'main' }),
    replace: () => replaces.push(1)
  };
  globalThis.Lampa.Select = { opened: () => !!state.selectbox };
  const closeHandlers = [];
  globalThis.Lampa.Settings = { listener: { follow: (name, fn) => { if (name === 'close') closeHandlers.push(fn); } } };
  ctx.bodyEl = bodyEl;
  ctx.replaces = replaces;
  ctx.closeHandlers = closeHandlers;
  return ctx;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test('C2: настройка меняется при открытом селектбоксе — Activity.replace не зовётся', async () => {
  const state = { selectbox: true };
  const { LC, bodyEl, replaces, closeHandlers } = layerLC(state);
  bodyEl.addClass('selectbox--open');

  LC.refreshComponent('main');
  await tick();
  assert.equal(replaces.length, 0, 'под открытым селектбоксом главную не пересобираем');
  assert.ok(closeHandlers.length, 'пересборка отложена — подписка на закрытие настроек поставлена');

  /* Селектбокс закрылся, настройки закрылись — теперь можно. */
  state.selectbox = false;
  bodyEl.removeClass('selectbox--open');
  closeHandlers[0]();
  await tick();
  assert.equal(replaces.length, 1, 'после закрытия слоя пересборка выполняется');
  assert.deepEqual(warnLog, []);
});

test('C2: слой открылся ПОСЛЕ постановки таймера — проверка в момент срабатывания', async () => {
  const state = { selectbox: false };
  const { LC, bodyEl, replaces, closeHandlers } = layerLC(state);

  /* На момент вызова слоя нет — replaceSoon ставит таймер. */
  LC.refreshComponent('main');
  /* А пока таймер не сработал, пользователь открыл селектбокс. */
  state.selectbox = true;
  bodyEl.addClass('selectbox--open');
  await tick();
  assert.equal(replaces.length, 0, 'слой проверяется в момент срабатывания таймера, а не только при постановке');

  state.selectbox = false;
  bodyEl.removeClass('selectbox--open');
  closeHandlers[0]();
  await tick();
  assert.equal(replaces.length, 1);
});

test('C2: слоя нет — пересборка идёт как прежде', async () => {
  const { LC, replaces } = layerLC({ selectbox: false });
  LC.refreshComponent('main');
  await tick();
  assert.equal(replaces.length, 1);
  assert.deepEqual(warnLog, []);
});

test('C2: открытые настройки Lampa (body.settings--open) тоже откладывают пересборку', async () => {
  const { LC, bodyEl, replaces } = layerLC({ selectbox: false });
  bodyEl.addClass('settings--open');
  LC.refreshComponent('main');
  await tick();
  assert.equal(replaces.length, 0);
});

/* Important 2: чипы настроения монтируются из ЕДИНСТВЕННОЙ подписки плагина
   (LC.onActivityEvent), сразу после героя — блок .lumen-moods живёт внутри
   .lumen-hero__text, которого до LC.hero.mount ещё нет. */
function moodsLC() {
  const ctx = heroLC();
  const log = [];
  let root = null;
  ctx.LC.moods = {
    mount: (r) => { log.push(['mount', r]); root = r; },
    unmount: () => { log.push(['unmount']); root = null; },
    detach: (r) => { log.push(['detach', r]); if (root && root !== r) { root = null; log.push(['unmount']); } },
    owns: (r) => !!r && root === r,
    active: () => !!root,
    install: () => log.push(['install']),
    uninstall: () => log.push(['uninstall'])
  };
  ctx.moodsLog = log;
  ctx.moodsRoot = () => root;
  return ctx;
}

/* Ревью Task 36, находка К1. Смена настройки «Размер кадра» на живой главной
   перемонтирует героя, а вместе с ним — место под чипы (при живом кадре они
   лежат в его слоте .lumen-hero__moods). Отсюда два требования к
   LC.applyHeroSizePref, и оба про порядок, а не про поведение: чипы обязаны
   монтироваться ПОСЛЕ работы с героем (до неё DOM ещё в старом состоянии) и в
   ОБЕИХ ветках, включая «Выключен» (раньше она уходила в return раньше
   монтирования, и чипы исчезали с экрана до перезахода на главную).

   Проверяется по исходнику: сама функция висит на гарде activated, который в
   этих тестах не поднят, а поднимать его значит тащить сюда Lampa.Template и
   половину activate(). Решение «переехали чипы или нет» принимает гард в
   LC.moods.mount — он закрыт своими тестами в test/moods.test.mjs. */
test('К1: applyHeroSizePref монтирует чипы после героя и в обеих ветках размера', () => {
  const src = readFileSync(new URL('../src/90_runtime.js', import.meta.url), 'utf8');
  const body = /LC\.applyHeroSizePref = function \(\) \{([\s\S]*?)\n  \};/.exec(src);
  assert.ok(body, 'LC.applyHeroSizePref не найдена');
  const text = body[1];
  const moodsAt = text.indexOf('LC.moods.mountCurrent()');
  assert.ok(moodsAt !== -1, 'чипы не монтируются вовсе');
  assert.ok(text.indexOf('LC.hero.unmount()') !== -1 && text.indexOf('LC.hero.unmount()') < moodsAt,
    'ветка «Выключен» обязана снять героя ДО монтирования чипов');
  assert.ok(text.indexOf('LC.hero.mountCurrent()') !== -1 && text.indexOf('LC.hero.mountCurrent()') < moodsAt,
    'герой обязан встать ДО монтирования чипов');
  /* И ни один return не должен стоять между героем и чипами — иначе ветка
     «Выключен» снова унесёт слот, не дав чипам переехать. Гард по activated
     в начале функции под это условие не попадает: считаем от пересборки
     таблицы стилей, с которой начинается сама работа. */
  const work = text.slice(text.indexOf('LC.injectCss()'), moodsAt);
  assert.equal(/\breturn\b/.test(work), false, 'между героем и чипами остался ранний выход: ' + work);
});

test('Important 2: старт главной монтирует чипы, и строго ПОСЛЕ героя', () => {
  const { LC, hero, moodsLog, moodsRoot } = moodsLC();
  const main = makeActivityObj('main', false);
  /* Фиксируем порядок: герой должен успеть построить .lumen-hero__text. */
  const order = [];
  const heroMount = LC.hero.mount;
  LC.hero.mount = (r) => { order.push('hero'); heroMount(r); };
  LC.moods.mount = (r) => { order.push('moods'); moodsLog.push(['mount', r]); };

  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.deepEqual(order, ['hero', 'moods'], 'чипы монтируются после героя');
  assert.equal(hero.root, main.activity.render());
  assert.deepEqual(warnLog, []);
});

test('Important 2: старт чужой активности снимает чипы', () => {
  const { LC, moodsRoot } = moodsLC();
  const main = makeActivityObj('main', false);
  const card = makeActivityObj('card', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });
  assert.ok(moodsRoot(), 'чипы на главной');
  LC.onActivityEvent({ type: 'start', component: 'full', object: card });
  assert.equal(moodsRoot(), null, 'на чужом экране чипов нет');
});

test('Important 2: destroy активности-хозяина снимает чипы, чужой — нет', () => {
  const { LC, moodsRoot } = moodsLC();
  const main = makeActivityObj('main', false);
  const other = makeActivityObj('other', false);
  LC.onActivityEvent({ type: 'start', component: 'main', object: main });

  LC.onActivityEvent({ type: 'destroy', component: 'full', object: other });
  assert.ok(moodsRoot(), 'owns() сказал «не мой»');

  LC.onActivityEvent({ type: 'destroy', component: 'main', object: main });
  assert.equal(moodsRoot(), null);
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Task 21 (фаза 3): тематическая атмосфера карточки.                     */
/* ====================================================================== */

/* Тело активности со слоем фона и пустым узлом атмосферы — так его строит
   LC.backdrops.apply (src/50_backdrops.js, ensureLayer). */
function fxBody() {
  const fx = new FakeEl(['lumen-fx']);
  const layer = new FakeEl(['lumen-backdrop'], [fx]);
  const body = new FakeEl(['activity__body'], [layer]);
  return { body, layer, fx };
}

/* Журналирующие LC.fx/LC.themes/LC.accent: в бандле это настоящие модули,
   здесь важно, ЧТО именно 90_runtime.js им говорит. */
function fxStubs(LC, theme) {
  const log = { mount: [], unmount: 0, accent: [] };
  LC.fx = {
    mount(node, preset, opts) { log.mount.push({ node, preset, color: opts.color, paused: opts.paused }); return { preset }; },
    unmount() { log.unmount++; },
    unmountAll() { log.unmount++; }
  };
  LC.themes = {
    classNames: () => 'lumen-theme--christmas lumen-theme--halloween',
    particleColor: (t) => (t.preset === 'snow' ? '#FFFFFF' : t.accent),
    forMovie: () => theme
  };
  LC.accent = { setTheme: (hex) => log.accent.push(hex), applyFor() {}, destroy() {} };
  return log;
}

test('Task 21: тема найдена — класс на слое фона, частицы смонтированы, акцент темы задан', () => {
  const LC = freshLC();
  const { body, layer, fx } = fxBody();
  const log = fxStubs(LC, { id: 'christmas', preset: 'snow', accent: '#E8C170' });

  LC.applyFxFor(body, { id: 771, keywords: { results: [{ name: 'christmas' }] } });

  assert.equal(layer.hasClass('lumen-theme--christmas'), true);
  assert.equal(log.mount.length, 1);
  assert.equal(log.mount[0].preset, 'snow');
  assert.equal(log.mount[0].color, '#FFFFFF', 'снег белый, а не золотой');
  assert.equal(log.mount[0].node, fx, 'частицы монтируются в узел .lumen-fx');
  assert.deepEqual(log.accent, ['#E8C170']);
  assert.equal(log.unmount, 1, 'прежняя атмосфера снимается перед новой');
});

test('Task 21: темы нет — слой чист, частиц нет, акцент темы снят', () => {
  const LC = freshLC();
  const { body, layer } = fxBody();
  layer.addClass('lumen-theme--halloween');
  const log = fxStubs(LC, null);

  assert.equal(LC.applyFxFor(body, { id: 1 }), null);
  assert.equal(layer.hasClass('lumen-theme--halloween'), false, 'класс прошлой темы снят');
  assert.equal(log.mount.length, 0);
  assert.deepEqual(log.accent, [null]);
  assert.equal(log.unmount, 1);
});

test('Task 21: цвет частиц у непрозрачных тем — акцент темы', () => {
  const LC = freshLC();
  const { body } = fxBody();
  const log = fxStubs(LC, { id: 'halloween', preset: 'bats', accent: '#E07B2C' });
  LC.applyFxFor(body, { id: 948 });
  assert.equal(log.mount[0].color, '#E07B2C');
});

test('Task 21: пауза слоя — под играющим роликом карточки', () => {
  const LC = freshLC();
  const { body, layer } = fxBody();
  const log = fxStubs(LC, { id: 'christmas', preset: 'snow', accent: '#E8C170' });
  let live = false;
  LC.trailer = { isLive: (node) => { assert.equal(node, layer, 'признак берётся со слоя фона'); return live; } };
  LC.applyFxFor(body, { id: 771 });
  const paused = log.mount[0].paused;
  assert.equal(paused(), false);
  live = true;
  assert.equal(paused(), true);
});

test('Task 21: нет слоя фона — вызов ничего не делает и не роняет', () => {
  const LC = freshLC();
  const log = fxStubs(LC, { id: 'christmas', preset: 'snow', accent: '#E8C170' });
  const bare = new FakeEl(['activity__body']);
  assert.equal(LC.applyFxFor(bare, { id: 1 }), null);
  assert.equal(LC.applyFxFor(null, { id: 1 }), null);
  assert.equal(log.mount.length, 0);
});

test('Task 21: закрытие карточки снимает частицы вместе со слайдшоу', () => {
  const LC = freshLC();
  const { body } = fxBody();
  const log = fxStubs(LC, null);
  const ctrl = makeCtrl();
  LC.backdrops = { cancel() {}, apply() {} };
  LC.reviews = { cancel() {} };
  LC.franchise = { cancel() {} };
  LC.active = { object: {}, body, slideshow: ctrl, data: null };

  LC.destroyActive();

  assert.equal(log.unmount, 1, 'слой частиц снят явно, а не дожидается самопроверки');
  assert.equal(ctrl.destroyCalls, 1);
  assert.equal(LC.active, null);
});

test('Task 21: смена настройки на лету — карточка пересобирает слой, без карточки зовётся герой', () => {
  const LC = freshLC();
  const { body } = fxBody();
  const log = fxStubs(LC, { id: 'christmas', preset: 'snow', accent: '#E8C170' });
  LC.active = { object: {}, body, slideshow: null, data: { movie: { id: 771 } } };
  LC.applyFxPref();
  assert.equal(log.mount.length, 1, 'слой открытой карточки пересобран');

  let heroCalls = 0;
  LC.hero = { applyFx: () => heroCalls++ };
  LC.active = null;
  LC.applyFxPref();
  assert.equal(heroCalls, 1, 'без карточки атмосферу пересобирает кадр главной');
  assert.equal(log.mount.length, 1, 'карточки нет — второго монтирования не случилось');
});

test('Task 21: смена режима анимаций на открытой карточке снимает и возвращает слой частиц', () => {
  const LC = freshLC();
  const { body, layer } = fxBody();
  const log = fxStubs(LC, { id: 'christmas', preset: 'snow', accent: '#E8C170' });
  LC.active = { object: {}, body, slideshow: null, data: { movie: { id: 771 } } };
  LC.hero = { applyMotion() {}, applyFx() {} };

  /* Полные анимации: атмосфера монтируется. */
  LC.applyMotionMode();
  assert.equal(log.mount.length, 1, 'при полных анимациях слой на месте');

  /* Лёгкие: LC.fx.mount сам вернул бы null, поэтому здесь проверяем, что
     точка применения вообще доходит до слоя — снятие делает unmount. */
  const unmountsBefore = log.unmount;
  LC.applyMotionMode();
  assert.ok(log.unmount > unmountsBefore, 'прежний слой снимается на каждой смене режима');
  assert.equal(layer.hasClass('lumen-theme--christmas'), true);
});

/* ====================================================================== */
/* Ревью фазы 3 (Critical 1): слои частиц карточек, ушедших вглубь.       */
/* Lampa не шлёт покидаемой активности НИ ОДНОГО события, а её DOM живёт  */
/* в истории дальше — значит канвас во весь экран (на FHD порядка 8 МБ,   */
/* на 4K вдвое больше) висел бы в памяти у каждой карточки цепочки        */
/* «карточка -> актёр -> другой фильм -> франшиза».                       */
/* ====================================================================== */

test('Critical 1: старт любой активности снимает слои частиц карточек, оставшихся в истории', () => {
  const LC = freshLC();
  let sweeps = 0;
  LC.fx = { sweep: () => { sweeps++; }, unmount() {}, unmountAll() {} };

  LC.onActivityEvent({ type: 'start', component: 'full', object: makeActivityObj('B', false, null) });
  assert.equal(sweeps, 1, 'уход вглубь: события для покидаемой карточки нет, уборка идёт на старте новой');

  LC.onActivityEvent({ type: 'start', component: 'main', object: makeActivityObj('Главная', false, null) });
  assert.equal(sweeps, 2, 'уход с карточки на главную — тот же случай');
  assert.deepEqual(warnLog, []);
});

test('Critical 1: уборка слоёв не роняет обработчик, если сама упала', () => {
  const LC = freshLC();
  LC.fx = { sweep: () => { throw new Error('bang'); }, unmount() {}, unmountAll() {} };
  LC.onActivityEvent({ type: 'start', component: 'main', object: makeActivityObj('Главная', false, null) });
  assert.equal(warnLog.length, 1, 'исключение записано в лог, а не всплыло наружу');
});

test('Critical 1: destroy осиротевшей карточки снимает и её слой частиц', () => {
  const LC = freshLC();
  const unmounted = [];
  LC.fx = { unmount: (node) => unmounted.push(node), sweep() {}, unmountAll() {} };
  LC.backdrops = { cancel() {} };
  LC.reviews = { cancel() {} };
  LC.franchise = { cancel() {} };

  const fx = new FakeEl(['lumen-fx']);
  const backdrop = new FakeEl(['lumen-backdrop'], [fx]);
  const body = new FakeEl(['activity__body'], [backdrop]);
  const activityEl = new FakeEl(['activity'], [body]);
  const orphan = { title: 'A', activity: { render: () => activityEl } };

  LC.active = null;
  LC.onActivityEvent({ type: 'destroy', component: 'full', object: orphan });

  assert.equal(unmounted.length, 1, 'слой частиц освобождён явно, а не ждёт самопроверки в тике');
  assert.equal(unmounted[0], fx, 'снят именно узел .lumen-fx осиротевшей карточки');
  assert.deepEqual(warnLog, []);
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';
import { FakeEl, fakeQuery } from './_fakedom.mjs';

/* Task 7: фоновый трейлер YouTube (экран 02 дизайна).

   Модуль src/55_trailer.js держит и чистую часть (pickTrailer/modeFor —
   без DOM и без Lampa), и рантайм плеера. Чистая часть грузится обычным
   test/_load.mjs; рантайм читает document/window/setTimeout ПО ВЫЗОВУ, а
   не при загрузке модуля, поэтому фейковые глобалы ставятся уже после
   load() — отдельно в каждом тесте плеера (freshEnv ниже).

   warn/PLUGIN объявлены в 00_head.js и в отдельный модуль не попадают —
   как и в остальных тестах рантайма, подменяем их глобалами. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const t = load('55_trailer.js');

/* Списки ожидания API (pending) и признак «глобальный хук уже поставлен»
   (hooked) — состояние УРОВНЯ МОДУЛЯ. Тесты плеера и schedule поэтому
   поднимают СВОЙ экземпляр модуля: с общим на весь файл hooked остался бы
   true от предыдущего теста, и проверка «обёртка ставится один раз» ничего
   бы не проверяла. Чистые pickTrailer/modeFor выше в общем экземпляре t. */
function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function freshModule() {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '55_trailer.js');
  return { LC, mod: module.exports };
}

/* ====================================================================== */
/* Step 2: выбор ролика — чистая функция.                                 */
/* ====================================================================== */

const v = (key, name, lang, official = true) => ({ key, name, iso_639_1: lang, official, youtube: true, published_at: '2024-01-01' });

test('предпочитает ru трейлер official, затем en Trailer, затем тизер', () => {
  assert.equal(t.pickTrailer([v('a', 'Teaser', 'en'), v('b', 'Official Trailer', 'en'), v('c', 'Дублированный трейлер', 'ru')]).key, 'c');
  assert.equal(t.pickTrailer([v('a', 'Teaser', 'en'), v('b', 'Official Trailer', 'en')]).key, 'b');
  assert.equal(t.pickTrailer([v('a', 'Teaser', 'en')]).key, 'a');
});

test('без key → пропуск', () => assert.equal(t.pickTrailer([{ name: 'Trailer', iso_639_1: 'ru' }]), null));

test('пусто', () => assert.equal(t.pickTrailer([]), null));

test('pickTrailer: мусор на входе (undefined/null/не массив/дырки) -> null, без исключений', () => {
  assert.equal(t.pickTrailer(undefined), null);
  assert.equal(t.pickTrailer(null), null);
  assert.equal(t.pickTrailer('nope'), null);
  assert.equal(t.pickTrailer([null, undefined]), null);
  assert.equal(t.pickTrailer([null, v('a', 'Trailer', 'ru')]).key, 'a');
});

test('pickTrailer: score — трейлер/тизер/прочее, ru/en, official; при равенстве побеждает первый', () => {
  /* «прочее» (+5) проигрывает тизеру (+20) даже с лучшим языком:
     ru прочее = 5+30+5 = 40, en тизер = 20+10+5 = 35 — тут выигрывает ru.
     Проверяем именно вклад типа: en прочее (20) против en тизера (35). */
  assert.equal(t.pickTrailer([v('a', 'Featurette', 'en'), v('b', 'Teaser', 'en')]).key, 'b');
  /* official +5 решает при прочих равных */
  assert.equal(t.pickTrailer([v('a', 'Trailer', 'en', false), v('b', 'Trailer', 'en', true)]).key, 'b');
  /* полное равенство — первый по порядку (стабильность) */
  assert.equal(t.pickTrailer([v('first', 'Trailer', 'ru'), v('second', 'Trailer', 'ru')]).key, 'first');
  /* кириллица и регистр */
  assert.equal(t.pickTrailer([v('a', 'ТИЗЕР', 'ru'), v('b', 'ТРЕЙЛЕР', 'ru')]).key, 'b');
});

/* ====================================================================== */
/* Step 3: режим настройки lumen_trailer (auto по платформе).             */
/* ====================================================================== */

test('modeFor: явные on/off возвращаются как есть, платформа не важна', () => {
  assert.equal(t.modeFor('on', { tizen: true }), 'on');
  assert.equal(t.modeFor('off', {}), 'off');
});

test('modeFor: auto -> off на tizen/webos (экономия ТВ), иначе on', () => {
  assert.equal(t.modeFor('auto', { tizen: true }), 'off');
  assert.equal(t.modeFor('auto', { webos: true }), 'off');
  assert.equal(t.modeFor('auto', {}), 'on');
  assert.equal(t.modeFor('auto', { tizen: false, webos: false }), 'on');
});

test('modeFor: незнакомое значение (undefined/null/пусто/мусор) — как auto', () => {
  assert.equal(t.modeFor(undefined, {}), 'on');
  assert.equal(t.modeFor(null, { webos: true }), 'off');
  assert.equal(t.modeFor('', {}), 'on');
  assert.equal(t.modeFor('garbage', { tizen: true }), 'off');
});

/* ====================================================================== */
/* Step 3: контроллер плеера на фейковом YT.                              */
/* ====================================================================== */

/* Фейковый документ: только то, что трогает player() — узел-контейнер по
   id, создание <script> и его добавление в head. scripts — журнал всего,
   что реально ушло в head (проверка «API грузится один раз»). */
function freshEnv(opts) {
  opts = opts || {};
  warnLog.length = 0;

  const created = [];
  const head = { children: [], appendChild(el) { head.children.push(el); el._inDoc = true; } };
  const byId = {};

  globalThis.document = {
    head: head,
    getElementById: (id) => byId[id] || null,
    createElement: (tag) => {
      const el = { tagName: tag, id: '', src: '', _inDoc: false };
      created.push(el);
      return el;
    }
  };
  /* Узел с нужным id «появляется» в документе, как только его id выставили
     и он попал в head — так ведёт себя настоящий getElementById. */
  const origAppend = head.appendChild;
  head.appendChild = function (el) { origAppend.call(head, el); if (el.id) byId[el.id] = el; };

  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { const x = timers[id - 1]; if (x) x.cleared = true; };

  const players = [];
  function FakePlayer(id, cfg) {
    this.id = id;
    this.cfg = cfg;
    this.destroyed = false;
    this.muted = false;
    this.played = false;
    players.push(this);
  }
  FakePlayer.prototype.destroy = function () { this.destroyed = true; };
  FakePlayer.prototype.mute = function () { this.muted = true; };
  FakePlayer.prototype.playVideo = function () { this.played = true; };

  globalThis.window = {
    YT: opts.ytReady === false ? undefined : { Player: FakePlayer },
    onYouTubeIframeAPIReady: opts.foreignHandler || undefined
  };

  const host = new FakeEl(['lumen-bg__trailer']);
  const events = { start: 0, end: 0 };
  const { mod } = freshModule();

  return {
    host, events, players, timers, created, head, byId,
    FakePlayer, mod,
    fire: (id) => { const x = timers[id - 1]; if (x && !x.cleared) x.fn(); },
    /* последний созданный плеер и его колбэки из cfg.events */
    last: () => players[players.length - 1],
    make: () => mod.player(host, 'KEY1', () => events.start++, () => events.end++)
  };
}

test('player: старт воспроизведения -> onStart, таймаут снят, слой помечен is-live', () => {
  const env = freshEnv();
  const ctl = env.make();

  const p = env.last();
  assert.ok(p, 'плеер должен создаться сразу — YT уже готов');
  assert.equal(p.cfg.videoId, 'KEY1');
  assert.equal(p.cfg.playerVars.mute, 1, 'трейлер обязан быть без звука');
  assert.equal(p.cfg.playerVars.autoplay, 1);
  assert.equal(p.cfg.playerVars.controls, 0);

  /* onReady — глушим и запускаем */
  p.cfg.events.onReady({ target: p });
  assert.equal(p.muted, true);
  assert.equal(p.played, true);

  /* состояние 1 = playing */
  p.cfg.events.onStateChange({ data: 1, target: p });
  assert.equal(env.events.start, 1);
  assert.equal(env.events.end, 0);
  assert.equal(env.host.hasClass('is-live'), true);
  assert.equal(env.timers[0].cleared, true, '6-секундный таймаут должен быть снят при старте');

  ctl.destroy();
  assert.deepEqual(warnLog, []);
});

test('player: ошибка YT -> тихо убираем и onEnd (слой очищен, is-live снят)', () => {
  const env = freshEnv();
  env.make();
  const p = env.last();

  p.cfg.events.onStateChange({ data: 1, target: p });
  assert.equal(env.host.hasClass('is-live'), true);

  p.cfg.events.onError({ data: 5 });
  assert.equal(env.events.end, 1);
  assert.equal(env.host.hasClass('is-live'), false);
  assert.equal(p.destroyed, true, 'плеер YT должен быть уничтожен');
  assert.deepEqual(warnLog, []);
});

test('player: конец ролика (state 0) -> onEnd', () => {
  const env = freshEnv();
  env.make();
  const p = env.last();
  p.cfg.events.onStateChange({ data: 1, target: p });
  p.cfg.events.onStateChange({ data: 0, target: p });
  assert.equal(env.events.end, 1);
  assert.equal(env.host.hasClass('is-live'), false);
});

test('player: таймаут 6 с без старта -> kill + onEnd, onStart не звучал', () => {
  const env = freshEnv();
  env.make();

  assert.equal(env.timers[0].ms, 6000, 'таймаут ожидания старта — 6 секунд');
  env.fire(1);

  assert.equal(env.events.start, 0);
  assert.equal(env.events.end, 1);
  assert.equal(env.host.hasClass('is-live'), false);
});

test('player: destroy идемпотентен — onEnd ровно один раз', () => {
  const env = freshEnv();
  const ctl = env.make();

  ctl.destroy();
  ctl.destroy();
  ctl.destroy();
  assert.equal(env.events.end, 1);

  /* и таймаут после destroy уже ничего не добавляет */
  env.fire(1);
  assert.equal(env.events.end, 1);
});

/* Task 11: YouTube — единственный ресурс карточки, чьи колбэки приходят из
   чужого кода: iframe_api зовёт onReady/onStateChange, когда ему удобно, и
   вполне может сделать это уже после kill() (карточку закрыли, пока плеер
   поднимался). Без гейта класс is-live возвращался бы на слой уже закрытой
   карточки, а onStart в schedule() пытался бы ставить слайдшоу на паузу и
   заводить сторож. */
test('Task 11: колбэки YouTube, доехавшие после kill(), ничего не делают', () => {
  const env = freshEnv();
  const ctl = env.make();
  const p = env.last();

  ctl.destroy();
  assert.equal(env.events.end, 1);

  p.cfg.events.onReady({ target: p });
  p.cfg.events.onStateChange({ data: 1, target: p });

  assert.equal(p.played, false, 'мёртвый плеер не запускается');
  assert.equal(env.host.hasClass('is-live'), false, 'слою не возвращается класс живого ролика');
  assert.equal(env.events.start, 0, 'onStart после kill не звучит — иначе schedule завёл бы сторож');
  assert.equal(env.events.end, 1, 'onEnd остаётся однократным');
  assert.deepEqual(warnLog, []);
});

test('player: YT ещё не загружен — <script id="lumen-yt-api"> вставляется один раз на все плееры', () => {
  const env = freshEnv({ ytReady: false });

  env.make();
  assert.equal(env.players.length, 0, 'без готового YT плеер создаваться не должен');
  const scripts = env.head.children.filter((el) => el.id === 'lumen-yt-api');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.youtube.com/iframe_api');

  /* второй плеер: тег уже в документе — повторно не добавляем */
  env.mod.player(new FakeEl(['lumen-bg__trailer']), 'KEY2', () => { }, () => { });
  assert.equal(env.head.children.filter((el) => el.id === 'lumen-yt-api').length, 1);
});

test('player: цепочка onYouTubeIframeAPIReady не теряет чужой обработчик', () => {
  let foreign = 0;
  const env = freshEnv({ ytReady: false, foreignHandler: () => { foreign++; } });

  env.make();
  assert.equal(typeof globalThis.window.onYouTubeIframeAPIReady, 'function');

  /* API «догрузилось»: YT появился, Lampa/чужой плагин зовёт глобальный колбэк */
  globalThis.window.YT = { Player: env.FakePlayer };
  globalThis.window.onYouTubeIframeAPIReady();

  assert.equal(foreign, 1, 'чужой обработчик обязан быть вызван');
  assert.equal(env.players.length, 1, 'наш плеер создаётся после готовности API');
});

test('player: убит до готовности API -> плеер не создаётся вовсе', () => {
  const env = freshEnv({ ytReady: false });
  const ctl = env.make();

  ctl.destroy();
  assert.equal(env.events.end, 1);

  globalThis.window.YT = { Player: env.FakePlayer };
  globalThis.window.onYouTubeIframeAPIReady();

  assert.equal(env.players.length, 0, 'мёртвый плеер не должен создавать YT.Player');
  assert.equal(env.events.end, 1, 'повторного onEnd быть не должно');
});

test('player: исключение конструктора YT.Player перехвачено -> onEnd, наружу не летит', () => {
  const env = freshEnv();
  globalThis.window.YT = {
    Player: function () { throw new Error('boom'); }
  };

  assert.doesNotThrow(() => env.make());
  assert.equal(env.events.end, 1);
});

/* ====================================================================== */
/* Ревью (утечка памяти): цепочка onYouTubeIframeAPIReady.                 */
/* Раньше каждый плеер оборачивал предыдущий глобальный обработчик своей   */
/* функцией, замыкающей create -> $host -> (через parentNode) всё дерево   */
/* карточки. При недоступном YouTube kill() по таймауту обнулял только yt, */
/* а ссылка из цепочки оставалась: 20-30 карточек за сессию = столько же   */
/* удержанных деревьев в памяти ТВ.                                        */
/* ====================================================================== */

test('утечка: глобальный хук ставится РОВНО один раз на все плееры', () => {
  const env = freshEnv({ ytReady: false });

  env.make();
  const afterFirst = globalThis.window.onYouTubeIframeAPIReady;
  assert.equal(typeof afterFirst, 'function');

  env.mod.player(new FakeEl(['lumen-bg__trailer']), 'K2', () => { }, () => { });
  env.mod.player(new FakeEl(['lumen-bg__trailer']), 'K3', () => { }, () => { });

  assert.equal(globalThis.window.onYouTubeIframeAPIReady, afterFirst,
    'обёртка не должна навешиваться поверх предыдущей на каждую карточку');
});

test('утечка: kill() вычёркивает свой create из очереди — мёртвая карточка не создаётся и не держится', () => {
  const env = freshEnv({ ytReady: false });

  const ctlA = env.make();
  const hostB = new FakeEl(['lumen-bg__trailer']);
  let bStarted = 0;
  env.mod.player(hostB, 'KEEP', () => bStarted++, () => { });

  /* Карточку A закрыли, не дождавшись API. */
  ctlA.destroy();
  assert.equal(env.events.end, 1);

  /* API догрузилось — создаётся ТОЛЬКО живой плеер B. */
  globalThis.window.YT = { Player: env.FakePlayer };
  globalThis.window.onYouTubeIframeAPIReady();

  assert.equal(env.players.length, 1, 'мёртвый плеер не должен создаваться');
  assert.equal(env.players[0].cfg.videoId, 'KEEP');

  /* Очередь опустошена: повторный вызов хука ничего не создаёт заново. */
  globalThis.window.onYouTubeIframeAPIReady();
  assert.equal(env.players.length, 1, 'очередь ожидания должна очищаться после вызова');
});

test('утечка: чужой обработчик вызывается один раз, сколько бы плееров ни ждало API', () => {
  let foreign = 0;
  const env = freshEnv({ ytReady: false, foreignHandler: () => { foreign++; } });

  env.make();
  env.mod.player(new FakeEl(['lumen-bg__trailer']), 'K2', () => { }, () => { });

  globalThis.window.YT = { Player: env.FakePlayer };
  globalThis.window.onYouTubeIframeAPIReady();

  assert.equal(foreign, 1, 'чужой обработчик не должен вызываться по разу на каждый ожидающий плеер');
  assert.equal(env.players.length, 2);
});

test('player: id узла — счётчик, а не Date.now (два плеера в одну миллисекунду)', () => {
  const env = freshEnv();
  env.make();
  env.mod.player(new FakeEl(['lumen-bg__trailer']), 'K2', () => { }, () => { });
  assert.notEqual(env.players[0].id, env.players[1].id);
});

test('player: host — youtube-nocookie (приватность фонового ролика)', () => {
  const env = freshEnv();
  env.make();
  assert.equal(env.last().cfg.host, 'https://www.youtube-nocookie.com');
});

/* ====================================================================== */
/* Ревью (тестовый пробел): schedule — планирование, guard'ы и полный цикл */
/* pause -> onEnd -> resume. Раньше не вызывался ни разу (в runtime-тестах */
/* LC.trailer замокан целиком), поэтому ветка LC.motionMode() === 'off' не */
/* исполнялась вовсе.                                                      */
/* ====================================================================== */

function scheduleEnv(opts) {
  opts = opts || {};
  warnLog.length = 0;

  const timers = [];
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { const x = timers[id - 1]; if (x) x.cleared = true; };
  const intervals = [];
  globalThis.setInterval = (fn, ms) => { intervals.push({ fn, ms, cleared: false }); return intervals.length; };
  globalThis.clearInterval = (id) => { const x = intervals[id - 1]; if (x) x.cleared = true; };
  globalThis.document = { head: { appendChild() { } }, getElementById: () => null, createElement: () => ({}) };

  const cfgs = [];
  function FakePlayer(id, cfg) { this.id = id; this.cfg = cfg; cfgs.push(cfg); }
  FakePlayer.prototype.destroy = function () { this.destroyed = true; };
  FakePlayer.prototype.mute = function () { };
  FakePlayer.prototype.playVideo = function () { };

  /* Журнал вызовов контроллера: без него правки «один перевод фокуса» и
     «не перекладывать коллекцию на невидимую карточку» не проверить. */
  const controllerCalls = { set: [], focus: [] };
  const Lampa = {
    Storage: { field: () => (opts.stored || 'auto') },
    Platform: { is: () => false },
    Controller: {
      enabled: () => ({ name: opts.controllerName || 'full_start' }),
      collectionSet(html) { controllerCalls.set.push(html); },
      collectionFocus(target, html) { controllerCalls.focus.push({ target: target, html: html }); }
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa, YT: opts.noYT ? undefined : { Player: FakePlayer } };
  globalThis.$ = (x) => (typeof x === 'string' ? fakeQuery(x) : x);

  /* Разметка в объёме, который трогает schedule: слой фона с узлом трейлера
     и карточка с рядом кнопок внутри .lumen-actions. */
  const trailerHost = new FakeEl(['lumen-bg__trailer']);
  const layer = new FakeEl(['lumen-backdrop'], [trailerHost]);
  const play = new FakeEl(['full-start__button', 'selector', 'button--play']);
  const buttons = new FakeEl(['full-start-new__buttons'], [play]);
  const actions = new FakeEl(['lumen-in', 'lumen-actions'], [buttons]);
  const root = new FakeEl(['full-start-new', 'lumen-card'], [actions]);
  const body = new FakeEl(['activity__body'], [layer]);

  const slideshow = {
    pauseCalls: 0, resumeCalls: 0,
    pause() { this.pauseCalls++; }, resume() { this.resumeCalls++; }
  };
  /* Ревью: пауза/возврат слайдшоу берутся СО СЛОЯ, а не из LC.active —
     иначе сторож карточки A снимал бы паузу со слайдшоу уже открытой B. */
  layer.data('lumenSlideshow', slideshow);

  const { LC, mod } = freshModule();
  LC.motionMode = () => opts.motion || 'full';
  LC.lang = (key) => key;
  LC.active = { slideshow: slideshow };
  LC.slideshow = {
    isMounted: () => (opts.mountedFn ? opts.mountedFn() : opts.mounted !== false),
    isLayerForeground: () => (opts.foregroundFn ? opts.foregroundFn() : opts.foreground !== false)
  };

  const data = opts.data !== undefined ? opts.data : {
    videos: { results: [{ key: 'K1', name: 'Official Trailer', iso_639_1: 'ru', official: true }] }
  };

  return {
    LC, mod, root, body, layer, trailerHost, slideshow, timers, intervals, cfgs, data, play, controllerCalls,
    run: () => mod.schedule(root, body, data),
    fire: (i) => { const x = timers[i - 1]; if (x && !x.cleared) x.fn(); },
    tick: (i) => { const x = intervals[i - 1]; if (x && !x.cleared) x.fn(); }
  };
}

test('schedule: настройка lumen_trailer=off — ничего не планируется', () => {
  const env = scheduleEnv({ stored: 'off' });
  assert.equal(env.run(), null);
  assert.equal(env.timers.length, 0, 'таймер старта не должен заводиться');
  assert.equal(env.layer.data('lumenTrailer'), undefined);
});

test('schedule: режим движения off — трейлера нет (экономия ТВ)', () => {
  const env = scheduleEnv({ motion: 'off' });
  assert.equal(env.run(), null);
  assert.equal(env.timers.length, 0);
});

test('schedule: подходящего ролика нет — null (и пустой список, и элементы без key)', () => {
  assert.equal(scheduleEnv({ data: { videos: { results: [] } } }).run(), null);
  assert.equal(scheduleEnv({ data: {} }).run(), null);
  assert.equal(scheduleEnv({ data: { videos: { results: [{ name: 'Trailer' }] } } }).run(), null);
});

test('schedule: планирует старт через 3 с и кладёт контроллер на слой', () => {
  const env = scheduleEnv();
  const api = env.run();
  assert.ok(api && typeof api.destroy === 'function');
  assert.equal(api.isAlive(), true);
  assert.equal(env.timers.length, 1);
  assert.equal(env.timers[0].ms, 3000);
  assert.equal(env.layer.data('lumenTrailer'), api, 'ссылка на слое — через неё гасит stopSlideshow/cancel');
});

test('schedule: слой уже не в документе — плеер не создаётся, слайдшоу не трогаем', () => {
  const env = scheduleEnv({ mounted: false });
  const api = env.run();
  env.fire(1);
  assert.equal(env.cfgs.length, 0, 'плеер создаваться не должен');
  assert.equal(env.slideshow.pauseCalls, 0);
  assert.equal(env.slideshow.resumeCalls, 0);
  assert.equal(api.isAlive(), false);
});

test('schedule: карточка ушла в фон под другую активность — старт отменяется', () => {
  const env = scheduleEnv({ foreground: false });
  const api = env.run();
  env.fire(1);
  assert.equal(env.cfgs.length, 0);
  assert.equal(env.slideshow.pauseCalls, 0);
  assert.equal(api.isAlive(), false);
});

test('schedule: destroy до старта — таймер снят, плеера нет, resume вхолостую не зовётся', () => {
  const env = scheduleEnv();
  const api = env.run();

  api.destroy();
  assert.equal(env.timers[0].cleared, true, 'таймер старта обязан сниматься');
  assert.equal(api.isAlive(), false);
  assert.equal(env.layer.data('lumenTrailer'), undefined, 'мёртвый контроллер не остаётся на слое');

  env.fire(1); // даже если таймер всё же сработает — ничего не произойдёт
  assert.equal(env.cfgs.length, 0);
  assert.equal(env.slideshow.pauseCalls, 0);
  assert.equal(env.slideshow.resumeCalls, 0, 'паузы не было — возобновлять нечего');
  assert.deepEqual(warnLog, []);
});

test('schedule: полный цикл — старт ролика ставит слайдшоу на паузу и рисует оформление, конец возвращает всё ровно по разу', () => {
  const env = scheduleEnv();
  const api = env.run();
  env.fire(1);

  assert.equal(env.cfgs.length, 1, 'плеер создан');
  assert.equal(env.slideshow.pauseCalls, 0, 'до фактического старта слайдшоу не паузим');

  /* Ролик пошёл. */
  env.cfgs[0].events.onStateChange({ data: 1 });
  assert.equal(env.slideshow.pauseCalls, 1);
  assert.equal(env.root.hasClass('lumen-trailer-on'), true);
  assert.equal(env.layer.hasClass('lumen-trailer-live'), true);
  assert.equal(env.root.find('.lumen-trailer-badge').length, 1);
  assert.equal(env.root.find('.lumen-stop').length, 1);
  assert.equal(env.root.find('.lumen-stop').hasClass('selector'), true);

  /* Ролик кончился. */
  env.cfgs[0].events.onStateChange({ data: 0 });
  assert.equal(env.slideshow.resumeCalls, 1, 'ровно один resume');
  assert.equal(env.root.hasClass('lumen-trailer-on'), false);
  assert.equal(env.layer.hasClass('lumen-trailer-live'), false);
  assert.equal(env.root.find('.lumen-trailer-badge').length, 0);
  assert.equal(env.root.find('.lumen-stop').length, 0);
  assert.equal(api.isAlive(), false);

  /* Повторный destroy ничего не дублирует. */
  api.destroy();
  assert.equal(env.slideshow.resumeCalls, 1);
  assert.deepEqual(warnLog, []);
});

/* Живая находка: Lampa не шлёт события для ПОКИДАЕМОЙ активности
   (Activity.push), а 'content' исключён из признака ухода фокуса — без
   сторожа ролик продолжал играть за чужим экраном, и карточка возвращалась
   из истории в режиме трейлера (сценарий push x2 + backward x2). */
test('schedule: сторож гасит ролик, когда карточка ушла вглубь (слой больше не на экране)', () => {
  let foreground = true;
  const env = scheduleEnv({ foregroundFn: () => foreground });
  const api = env.run();
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });

  assert.equal(env.intervals.length, 1, 'на время ролика заводится ровно один сторож');
  assert.equal(env.intervals[0].ms, 1000);
  assert.equal(env.root.hasClass('lumen-trailer-on'), true);

  /* Пока карточка на экране — тик ничего не меняет. */
  env.tick(1);
  assert.equal(api.isAlive(), true);
  assert.equal(env.root.hasClass('lumen-trailer-on'), true);

  /* Ушли вглубь: поверх открылась другая активность. */
  foreground = false;
  env.tick(1);

  assert.equal(api.isAlive(), false, 'ролик обязан гаснуть при уходе вглубь');
  assert.equal(env.root.hasClass('lumen-trailer-on'), false, 'режим трейлера не должен «залипать» на карточке');
  assert.equal(env.layer.hasClass('lumen-trailer-live'), false);
  assert.equal(env.root.find('.lumen-stop').length, 0);
  assert.equal(env.root.find('.lumen-trailer-badge').length, 0);
  assert.equal(env.slideshow.resumeCalls, 1, 'слайдшоу возвращается');
  assert.equal(env.intervals[0].cleared, true, 'сторож снимается вместе с роликом');
  assert.equal(env.layer.data('lumenTrailer'), undefined);
  assert.deepEqual(warnLog, []);
});

test('schedule: сторож гасит ролик и когда слой вообще исчез из документа', () => {
  let mounted = true;
  const env = scheduleEnv({ mountedFn: () => mounted });
  const api = env.run();
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });

  mounted = false;
  env.tick(1);

  assert.equal(api.isAlive(), false);
  assert.equal(env.intervals[0].cleared, true);
});

test('schedule: без старта ролика сторож не заводится вовсе', () => {
  const env = scheduleEnv();
  env.run();
  env.fire(1); // плеер создан, но onStateChange(1) не приходил
  assert.equal(env.intervals.length, 0, 'лишних таймеров на ТВ быть не должно');
});

/* ====================================================================== */
/* Ревью: recollect не должен перекладывать коллекцию пульта на карточку,  */
/* которой уже нет на экране. Сторож карточки A срабатывает и когда сверху */
/* открыта карточка B; на B фокус стоит на кнопках, то есть               */
/* enabled().name === 'full_start' — проверки имени контроллера мало.      */
/* Lampa прячет неактивную активность прозрачностью (.activity{opacity:0}),*/
/* а не display, поэтому offsetParent у её узлов НЕ null и collectionFocus */
/* честно сфокусировал бы невидимое дерево.                                */
/* ====================================================================== */

test('recollect: карточка ушла с экрана — коллекция пульта на неё не перекладывается', () => {
  let fg = true;
  const env = scheduleEnv({ foregroundFn: () => fg });
  const api = env.run();
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });

  assert.ok(env.controllerCalls.set.length >= 1, 'на видимой карточке кнопка «Стоп» коллекцию обновляет');
  env.controllerCalls.set.length = 0;
  env.controllerCalls.focus.length = 0;

  /* Ушли вглубь / открылась другая карточка — имя контроллера при этом
     по-прежнему 'full_start' (фокус на кнопках карточки B). */
  fg = false;
  env.tick(1);

  assert.equal(api.isAlive(), false, 'сторож обязан погасить ролик');
  assert.equal(env.controllerCalls.set.length, 0, 'collectionSet увёл бы пульт в дерево невидимой карточки');
  assert.equal(env.controllerCalls.focus.length, 0);
  assert.equal(env.root.hasClass('lumen-trailer-on'), false, 'оформление при этом всё равно снимается');
  assert.equal(env.root.find('.lumen-stop').length, 0);
});

test('removeStop: фокус переводится ровно один раз и именно на «Смотреть»', () => {
  const env = scheduleEnv();
  const api = env.run();
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });

  env.root.find('.lumen-stop').addClass('focus'); // пульт стоит на «Стоп»
  env.controllerCalls.set.length = 0;
  env.controllerCalls.focus.length = 0;

  api.destroy();

  assert.equal(env.controllerCalls.focus.length, 1, 'ровно один перевод фокуса, а не два подряд');
  assert.equal(env.controllerCalls.focus[0].target, env.play, 'фокус возвращается на «Смотреть»');
  assert.equal(env.controllerCalls.set.length, 1, 'коллекция пересобирается один раз');
});

test('слайдшоу паузится и возвращается ИМЕННО своего слоя (не через глобальный LC.active)', () => {
  const env = scheduleEnv();
  /* LC.active указывает на слайдшоу ДРУГОЙ карточки — трогать его нельзя. */
  const other = { pauseCalls: 0, resumeCalls: 0, pause() { this.pauseCalls++; }, resume() { this.resumeCalls++; } };
  env.LC.active = { slideshow: other };

  const api = env.run();
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });
  assert.equal(env.slideshow.pauseCalls, 1);
  assert.equal(other.pauseCalls, 0, 'пауза ушла бы чужой карточке');

  api.destroy();
  assert.equal(env.slideshow.resumeCalls, 1);
  assert.equal(other.resumeCalls, 0, 'возврат снялся бы с чужого слайдшоу');
});

test('schedule: stopActive снимает трейлер текущей карточки и обнуляет поле', () => {
  const env = scheduleEnv();
  const api = env.run();
  env.LC.active.trailer = api;
  env.fire(1);
  env.cfgs[0].events.onStateChange({ data: 1 });
  assert.equal(env.root.hasClass('lumen-trailer-on'), true);

  env.mod.stopActive();

  assert.equal(env.LC.active.trailer, null);
  assert.equal(api.isAlive(), false);
  assert.equal(env.root.hasClass('lumen-trailer-on'), false);
  assert.equal(env.slideshow.resumeCalls, 1);
  assert.equal(env.layer.data('lumenTrailer'), undefined);
});

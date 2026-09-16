import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
import { FakeEl } from './_fakedom.mjs';

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

  return {
    host, events, players, timers, created, head, byId,
    FakePlayer,
    fire: (id) => { const x = timers[id - 1]; if (x && !x.cleared) x.fn(); },
    /* последний созданный плеер и его колбэки из cfg.events */
    last: () => players[players.length - 1],
    make: () => t.player(host, 'KEY1', () => events.start++, () => events.end++)
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

test('player: YT ещё не загружен — <script id="lumen-yt-api"> вставляется один раз на все плееры', () => {
  const env = freshEnv({ ytReady: false });

  env.make();
  assert.equal(env.players.length, 0, 'без готового YT плеер создаваться не должен');
  const scripts = env.head.children.filter((el) => el.id === 'lumen-yt-api');
  assert.equal(scripts.length, 1);
  assert.equal(scripts[0].src, 'https://www.youtube.com/iframe_api');

  /* второй плеер: тег уже в документе — повторно не добавляем */
  t.player(new FakeEl(['lumen-bg__trailer']), 'KEY2', () => { }, () => { });
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

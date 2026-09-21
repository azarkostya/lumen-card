import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery, toEl } from './_fakedom.mjs';

/* Task 29 (фаза 3): переход «постер ряда → кадр карточки».

   Геометрия (geom) и раскладка прозрачности по времени (fade) — чистые
   функции, проверяются без окружения. Жизненный цикл (гейты режима и
   настройки, один узел на переход, снятие по таймеру, отмена при быстром
   повторном открытии) — на фейковых $, requestAnimationFrame и таймерах. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg) { warnLog.push(msg); };

const SRC = readFileSync(new URL('../src/67_transition.js', import.meta.url), 'utf8');

function build(extra) {
  const LC = Object.assign({
    motionMode: () => 'full',
    pref: (name, def) => def
  }, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const T = build().api;

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

const SCREEN = { width: 1920, height: 1080 };

/* Правка пользователя 2026-09-17 (четвёртый круг): «надо растягивать».
   Масштаб берётся как у background-size:cover — БОЛЬШИЙ из двух отношений,
   для обычного постера 2:3 на экране 16:9 это ширина. К концу слой шире и
   выше экрана по обеим сторонам, лишняя высота уходит под overflow оверлея,
   и на экране остаётся полноэкранный горизонтальный кадр. */
test('geom: масштаб покрывает экран целиком, а не вписывает постер', () => {
  const g = T.geom({ left: 100, top: 200, width: 180, height: 270 }, SCREEN);
  assert.ok(g.scale > 1920 / 180, 'масштаб по ширине плюс запас, а не 4 по высоте: ' + g.scale);
  assert.ok(180 * g.scale >= SCREEN.width, 'ширина покрыта');
  assert.ok(270 * g.scale >= SCREEN.height, 'высота покрыта с запасом — лишнее уходит в обрез');
  /* Запас невелик: он закрывает края, а не превращает кадр в кашу. */
  assert.ok(g.scale < (1920 / 180) * 1.1, 'запас не больше десятой доли: ' + g.scale);
});

test('geom: карточка шире экранных пропорций — покрытие даёт высота', () => {
  /* Горизонтальная карточка (ряд «Продолжить смотреть» и подобные): по
     ширине она дотянулась бы до края раньше, чем по высоте, и сверху с
     снизу остались бы полосы. */
  const g = T.geom({ left: 0, top: 0, width: 400, height: 150 }, SCREEN);
  assert.ok(g.scale > SCREEN.height / 150, 'взят больший из двух отношений плюс запас: ' + g.scale);
  assert.ok(400 * g.scale >= SCREEN.width);
  assert.ok(150 * g.scale >= SCREEN.height);
});

test('geom: сдвиг — из центра постера в центр экрана', () => {
  const g = T.geom({ left: 100, top: 200, width: 180, height: 270 }, SCREEN);
  assert.equal(g.tx, 960 - 190);
  assert.equal(g.ty, 540 - 335);
  const centred = T.geom({ left: 960 - 90, top: 540 - 135, width: 180, height: 270 }, SCREEN);
  assert.equal(centred.tx, 0);
  assert.equal(centred.ty, 0);
});

test('fade: прозрачность гаснет на последней доле перехода', () => {
  const f = T.fade(480, 0.4);
  assert.equal(f.ms, 192, '40 % от 480 мс');
  assert.equal(f.delay, 288, 'первые 60 % постер полностью непрозрачен');
  assert.equal(f.delay + f.ms, 480);
});

/* ====================================================================== */
/* Жизненный цикл                                                         */
/* ====================================================================== */

function env(opts) {
  opts = opts || {};
  const body = new FakeEl(['body-mock']);
  const frames = [];
  const timers = [];
  let nextRaf = 1;
  const cancelledFrames = [];
  const cancelledTimers = [];

  globalThis.$ = function (x) {
    if (typeof x !== 'string') return toEl(x);
    if (x === 'body') return body;
    return fakeQuery(x);
  };
  globalThis.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    requestAnimationFrame: (fn) => { frames.push({ id: nextRaf, fn }); return nextRaf++; },
    cancelAnimationFrame: (id) => {
      cancelledFrames.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    }
  };
  globalThis.setTimeout = (fn, ms) => { timers.push({ id: timers.length + 1, fn, ms, done: false }); return timers.length; };
  globalThis.clearTimeout = (id) => {
    cancelledTimers.push(id);
    const t = timers[id - 1];
    if (t) t.done = true;
  };

  /* Task 44: reveal() обязан обходиться БЕЗ героя — источник ему передают
     явно. Счётчик обращений к LC.hero.lastFocus проверяет это прямо. */
  const heroReads = { count: 0 };
  const { api } = build({
    motionMode: () => opts.motion || 'full',
    pref: (name, def) => (Object.prototype.hasOwnProperty.call(opts.prefs || {}, name) ? opts.prefs[name] : def),
    hero: {
      lastFocus: () => {
        heroReads.count++;
        return opts.last === undefined ? SOURCE : opts.last;
      }
    }
  });

  function frame() {
    const f = frames.shift();
    if (f) f.fn();
    return !!f;
  }
  function fire() {
    let ran = 0;
    for (const t of timers) if (!t.done) { t.done = true; t.fn(); ran++; }
    return ran;
  }
  function overlay() { return body._children.filter((c) => c.hasClass('lumen-overlay')); }
  /* Конец CSS-перехода у слоя: модуль вешает слушатель на сам узел. */
  function transitionEnd(prop) {
    const layers = overlay();
    if (!layers.length) return 0;
    const img = layers[0].find('.lumen-overlay__img');
    const list = img._listeners || [];
    list.slice().forEach((l) => { if (l.type === 'transitionend') l.fn({ propertyName: prop }); });
    return list.length;
  }

  return { api, body, frames, timers, cancelledFrames, cancelledTimers, frame, fire, overlay, transitionEnd, heroReads };
}

/* Task 37: герой отдаёт слою перехода УЗЕЛ карточки, а не снятый заранее
   прямоугольник — замер раскладки ушёл с горячего пути фокуса сюда, в момент
   открытия. Фейковый узел считает обращения: тесты ниже проверяют, что
   getBoundingClientRect зовётся ровно один раз и ровно на open. */
const RECT = { left: 100, top: 200, width: 180, height: 270 };

function cardNode(rect) {
  const node = { rect: rect, reads: 0 };
  node.getBoundingClientRect = () => { node.reads++; return node.rect; };
  return node;
}

const SOURCE = { id: 42, poster: 'https://img/poster.jpg', node: cardNode(RECT) };

test('open: рисует один слой поверх экрана с постером фокусной карточки', () => {
  const e = env();
  assert.equal(e.api.open({ id: 42 }), true);
  const layers = e.overlay();
  assert.equal(layers.length, 1);
  assert.equal(e.api.active(), true);
  const img = layers[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('poster.jpg') !== -1);
  assert.equal(img.css('width'), '180px');
  assert.equal(img.css('height'), '270px');
  assert.equal(img.css('left'), '100px');
  assert.equal(img.css('top'), '200px');
});

/* Task 27 (довесок): крупная версия постера, предзагруженная героем. */
test('open: берёт крупный постер, если герой успел его загрузить', () => {
  const e = env({ last: { id: 42, poster: 'https://img/t/p/w300/p.jpg', big: 'https://img/t/p/w500/p.jpg', node: cardNode(RECT) } });
  assert.equal(e.api.open({ id: 42 }), true);
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('/t/p/w500/p.jpg') !== -1, 'в слой пошла крупная версия');
});

test('open: крупная версия не успела — переход идёт на постере ряда, без ожидания', () => {
  const e = env({ last: { id: 42, poster: 'https://img/t/p/w300/p.jpg', node: cardNode(RECT) } });
  assert.equal(e.api.open({ id: 42 }), true);
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('/t/p/w300/p.jpg') !== -1);
});

test('open: разгон задаётся через два кадра — иначе браузеру нечего анимировать', () => {
  const e = env();
  e.api.open({ id: 42 });
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.equal(img.hasClass('is-run'), false, 'до кадров слой лежит на месте постера');
  e.frame();
  assert.equal(img.hasClass('is-run'), false, 'первый кадр идёт ДО отрисовки начального состояния');
  e.frame();
  assert.equal(img.hasClass('is-run'), true);
  const transform = String(img.css('transform'));
  assert.ok(transform.indexOf('translate(770px, 205px)') !== -1, transform);
  assert.ok(/scale\(11\./.test(transform), 'масштаб покрытия с запасом, а не вписывания: ' + transform);
  assert.equal(img.css('opacity'), 0);
});

/* Найдено живой проверкой (2026-09-17): переход начинается с первым
   отрисованным кадром, а Lampa держит главный поток построением карточки до
   600 мс. Снятие по часам обрывало разгон на середине. */
test('open: слой снимает конец растворения, а не часы', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.frame();
  e.frame();
  assert.equal(e.overlay().length, 1);
  e.transitionEnd('opacity');
  assert.equal(e.overlay().length, 0, 'доиграло — слой ушёл');
  assert.equal(e.api.active(), false);
  assert.equal(e.fire(), 0, 'страховочный таймер снят вместе со слоем');
});

test('open: конец разгона слоя не снимает — ждём именно растворения', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.frame();
  e.frame();
  e.transitionEnd('transform');
  assert.equal(e.overlay().length, 1, 'постер ещё виден — гасить его рано');
});

test('open: событие не пришло — снимает страховочный таймер', () => {
  const e = env();
  e.api.open({ id: 42 });
  assert.equal(e.timers[0].ms, 2500, 'страховка заметно длиннее самого перехода');
  e.fire();
  assert.equal(e.overlay().length, 0);
});

test('open: событие, доехавшее после снятия, второй раз ничего не делает', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.frame();
  e.frame();
  e.api.stop();
  e.transitionEnd('opacity');
  assert.equal(e.overlay().length, 0);
  assert.equal(e.api.active(), false);
});

test('open: анимируются только композиторные свойства, растворение — по кривой', () => {
  const e = env();
  e.api.open({ id: 42 });
  const img = e.overlay()[0].find('.lumen-overlay__img');
  const track = String(img.css('transition'));
  const webkit = String(img.css('-webkit-transition'));
  assert.ok(track.indexOf('transform 480ms cubic-bezier(.2,.8,.2,1)') !== -1, track);
  assert.ok(webkit.indexOf('-webkit-transform 480ms cubic-bezier(.2,.8,.2,1)') !== -1, 'старым webkit-движкам нужен префикс: ' + webkit);
  /* Одним списком их называть нельзя: в Chrome это одно и то же свойство,
     и переход залипал после первого шага (живая проверка 2026-09-17). */
  assert.ok(track.indexOf('-webkit-transform') === -1, 'непрефиксный список не должен содержать префиксного имени: ' + track);
  for (const t of [track, webkit]) {
    assert.ok(t.indexOf('opacity 192ms ease-in 288ms') !== -1, 'растворение по кривой, не линейное: ' + t);
    for (const layout of ['left ', 'top ', 'width ', 'height ']) {
      assert.ok(t.indexOf(layout) === -1, 'раскладку не анимируем — её ведёт занятый главный поток: ' + t);
    }
  }
});

test('open: точка кадрирования поднята выше середины постера', () => {
  const e = env();
  e.api.open({ id: 42 });
  assert.equal(e.overlay()[0].find('.lumen-overlay__img').css('background-position'), '50% 38%');
});

test('open: id открытой карточки не совпал с фокусной — перехода нет', () => {
  const e = env();
  assert.equal(e.api.open({ id: 7 }), false);
  assert.equal(e.overlay().length, 0);
  assert.equal(e.frames.length, 0, 'кадр не запрашивался');
});

test('open: карточка открыта не из ряда (фокуса не было) — перехода нет', () => {
  const e = env({ last: null });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: id берётся и из object.card — у активности Lampa он лежит там', () => {
  const e = env();
  assert.equal(e.api.open({ card: { id: 42 } }), true);
  assert.equal(e.overlay().length, 1);
});

test('open: в lite и off — мгновенно, без промежуточных кадров', () => {
  for (const motion of ['lite', 'off']) {
    const e = env({ motion });
    assert.equal(e.api.open({ id: 42 }), false, motion);
    assert.equal(e.overlay().length, 0, motion);
    assert.equal(e.frames.length, 0, motion);
    assert.equal(e.timers.length, 0, motion);
  }
});

test('open: выключенная настройка lumen_transition — перехода нет', () => {
  const e = env({ prefs: { lumen_transition: false } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: нет постера — перехода нет (растворять нечего)', () => {
  const e = env({ last: { id: 42, poster: '', node: cardNode(RECT) } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

test('open: нулевой прямоугольник — перехода нет', () => {
  const e = env({ last: { id: 42, poster: 'p.jpg', node: cardNode({ left: 0, top: 0, width: 0, height: 0 }) } });
  assert.equal(e.api.open({ id: 42 }), false);
  assert.equal(e.overlay().length, 0);
});

/* Task 37: замер раскладки — один и ровно в момент открытия. Пока фокус
   ходит по ряду, слой перехода узел не трогает вовсе. */
test('open: прямоугольник снимается с узла в момент открытия, один раз', () => {
  const node = cardNode(RECT);
  const e = env({ last: { id: 42, poster: 'https://img/poster.jpg', node: node } });
  assert.equal(node.reads, 0, 'до открытия раскладку не читаем');

  assert.equal(e.api.open({ id: 42 }), true);
  assert.equal(node.reads, 1);
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.equal(img.css('left'), '100px');
  assert.equal(img.css('top'), '200px');
});

/* Ряд успел прокрутиться между фокусом и нажатием OK: слой обязан встать на
   НОВОЕ место карточки, а не на запомненное. Ради этого узел и хранится. */
test('open: карточка переехала после фокуса — слой встаёт на её новое место', () => {
  const node = cardNode(RECT);
  const e = env({ last: { id: 42, poster: 'https://img/poster.jpg', node: node } });
  node.rect = { left: 620, top: 205, width: 180, height: 270 };

  assert.equal(e.api.open({ id: 42 }), true);
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.equal(img.css('left'), '620px');
  assert.equal(img.css('top'), '205px');
});

/* Ряд перестроился и узел выброшен из документа — у такого узла все размеры
   нулевые. Отдельный случай — узла нет вовсе. */
test('open: узла карточки больше нет — перехода нет', () => {
  for (const last of [
    { id: 42, poster: 'p.jpg', node: null },
    { id: 42, poster: 'p.jpg', node: {} },
    { id: 42, poster: 'p.jpg', node: cardNode(null) }
  ]) {
    const e = env({ last: last });
    assert.equal(e.api.open({ id: 42 }), false);
    assert.equal(e.overlay().length, 0);
  }
});

test('stop: быстрое открытие-закрытие не оставляет ни узла, ни кадра, ни таймера', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.stop();
  assert.equal(e.overlay().length, 0);
  assert.equal(e.frames.length, 0, 'отложенный кадр отменён');
  assert.equal(e.cancelledFrames.length, 1);
  assert.equal(e.cancelledTimers.length, 1, 'страховочный таймер отменён');
  assert.equal(e.api.active(), false);
  assert.equal(e.fire(), 0, 'живых таймеров не осталось');
});

test('stop: идемпотентна', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.stop();
  e.api.stop();
  assert.equal(e.overlay().length, 0);
});

test('open: второй переход подряд снимает первый — на экране всегда один слой', () => {
  const e = env();
  e.api.open({ id: 42 });
  e.api.open({ id: 42 });
  assert.equal(e.overlay().length, 1);
  e.api.stop();
  assert.equal(e.overlay().length, 0);
});

/* ====================================================================== */
/* Task 44: reveal — тот же слой по ЯВНОМУ источнику и без автоснятия      */
/* ====================================================================== */

/* Рулетка показывает выпавший фильм тем же приёмом, что и переход из ряда:
   прямоугольник барабана разворачивается в полноэкранный кадр. Отличий от
   open() ровно три, и каждое проверяется ниже:
     - источник приходит аргументом, героя reveal не спрашивает вовсе;
     - слой не растворяется и не снимается ни концом перехода, ни таймером —
       только stop() (его же зовёт следующий open());
     - конец разгона отдаётся наружу колбэком opts.then, ровно один раз. */

const REEL = { left: 396, top: 120, width: 166, height: 249 };
const KADR = { rect: REEL, poster: 'https://img/t/p/w342/p.jpg', big: 'https://img/t/p/w1280/b.jpg' };

test('reveal: слой встаёт по переданному прямоугольнику, героя не спрашивает', () => {
  const e = env();
  assert.equal(e.api.reveal(KADR, {}), true);
  assert.equal(e.heroReads.count, 0, 'reveal обошёлся без LC.hero.lastFocus');
  const layers = e.overlay();
  assert.equal(layers.length, 1);
  const img = layers[0].find('.lumen-overlay__img');
  assert.equal(img.css('left'), '396px');
  assert.equal(img.css('top'), '120px');
  assert.equal(img.css('width'), '166px');
  assert.equal(img.css('height'), '249px');
  assert.ok(String(img.css('background-image')).indexOf('/t/p/w1280/b.jpg') !== -1,
    'в слой идёт кадр w1280, а не постер барабана: ' + img.css('background-image'));
});

/* Главное отличие от open(): слой обязан ОСТАТЬСЯ на экране. Растворение в
   его переходе не участвует вовсе — иначе «держится до stop()» означало бы
   «держится невидимым». */
test('reveal: растворения в переходе нет, opacity остаётся непрозрачной', () => {
  const e = env();
  e.api.reveal(KADR, {});
  const img = e.overlay()[0].find('.lumen-overlay__img');
  for (const track of [String(img.css('transition')), String(img.css('-webkit-transition'))]) {
    assert.ok(track.indexOf('transform 480ms cubic-bezier(.2,.8,.2,1)') !== -1, track);
    assert.equal(track.indexOf('opacity'), -1, 'opacity в списке перехода — слой погаснет: ' + track);
  }
  e.frame();
  e.frame();
  assert.equal(img.hasClass('is-run'), true);
  assert.equal(img.css('opacity'), undefined, 'разгон не трогает прозрачность слоя');
});

test('reveal: ни конец перехода, ни часы слой не снимают — только stop()', () => {
  const e = env();
  e.api.reveal(KADR, {});
  e.frame();
  e.frame();
  e.transitionEnd('transform');
  assert.equal(e.overlay().length, 1, 'конец разгона слой не снимает');
  e.transitionEnd('opacity');
  assert.equal(e.overlay().length, 1, 'растворения у этого слоя нет вовсе');
  e.fire();
  assert.equal(e.overlay().length, 1, 'страховочного снятия по часам у reveal нет');
  assert.equal(e.api.active(), true);
  e.api.stop();
  assert.equal(e.overlay().length, 0);
  assert.equal(e.api.active(), false);
});

test('reveal: opts.then зовётся по концу разгона, ровно один раз', () => {
  const e = env();
  let calls = 0;
  e.api.reveal(KADR, { then: () => { calls++; } });
  e.frame();
  e.frame();
  assert.equal(calls, 0, 'до конца разгона результат не показывают');
  e.transitionEnd('transform');
  assert.equal(calls, 1);
  e.transitionEnd('transform');
  assert.equal(calls, 1, 'второе событие того же перехода — не второй результат');
  e.fire();
  assert.equal(calls, 1, 'страховочный таймер после события молчит');
});

/* На слабом ТВ (и на любом стенде, где переходы не проигрываются) события
   может не быть вовсе. Без страховки экран остался бы на барабане навсегда:
   результат показывает именно then. */
test('reveal: события не было — then зовёт страховочный таймер', () => {
  const e = env();
  let calls = 0;
  e.api.reveal(KADR, { then: () => { calls++; } });
  assert.equal(e.timers.length, 1, 'страховка одна');
  assert.equal(e.timers[0].ms, 960, 'вдвое к длительности разгона: ' + e.timers[0].ms);
  e.fire();
  assert.equal(calls, 1);
  assert.equal(e.overlay().length, 1, 'таймер отдаёт результат, но слой не снимает');
  e.transitionEnd('transform');
  assert.equal(calls, 1, 'опоздавшее событие второй раз результат не показывает');
});

test('reveal: слой снят до конца разгона — then не зовётся вовсе', () => {
  const e = env();
  let calls = 0;
  e.api.reveal(KADR, { then: () => { calls++; } });
  e.api.stop();
  e.transitionEnd('transform');
  e.fire();
  assert.equal(calls, 0, 'экрана уже нет — показывать результат некуда');
});

test('reveal: конец перехода чужого свойства результат не показывает', () => {
  const e = env();
  let calls = 0;
  e.api.reveal(KADR, { then: () => { calls++; } });
  e.transitionEnd('border-radius');
  assert.equal(calls, 0);
});

test('reveal: без rect и без картинки — false, слоя нет', () => {
  for (const source of [null, {}, { rect: REEL }, { poster: 'p.jpg' },
    { rect: { left: 0, top: 0, width: 0, height: 0 }, big: 'b.jpg' }]) {
    const e = env();
    assert.equal(e.api.reveal(source, {}), false, JSON.stringify(source));
    assert.equal(e.overlay().length, 0);
  }
});

test('reveal: только постер, без кадра — слой идёт на постере', () => {
  const e = env();
  assert.equal(e.api.reveal({ rect: REEL, poster: 'https://img/t/p/w342/p.jpg' }, {}), true);
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('/t/p/w342/p.jpg') !== -1);
});

/* Настройка «Переход от постера» описывает ровно открытие карточки из ряда
   (src/80_settings.js, lumen_transition_descr). Выключив её, пользователь не
   просил ломать экран результата рулетки — там слой не украшение, а способ
   показать кадр, и подменять его нечем. */
test('reveal: настройка lumen_transition его не гасит — она про открытие карточки', () => {
  const e = env({ prefs: { lumen_transition: false } });
  assert.equal(e.api.reveal(KADR, {}), true);
  assert.equal(e.api.stop(), undefined);
  assert.equal(e.api.open({ id: 42 }), false, 'а открытие карточки она по-прежнему гасит');
});

test('reveal: в режиме «Движение: выкл» — false, кадр покажут без перехода', () => {
  const e = env({ motion: 'off' });
  assert.equal(e.api.reveal(KADR, {}), false);
  assert.equal(e.overlay().length, 0);
  assert.equal(e.frames.length, 0);
  assert.equal(e.timers.length, 0);
});

/* В «Лёгких» барабан не крутится (src/56_roulette.js, runReel), но один
   композиторный слой с transform — не та цена, ради которой стоит лишать
   экран результата его главного приёма. */
test('reveal: в «Лёгких» работает — это один слой и только transform', () => {
  const e = env({ motion: 'lite' });
  assert.equal(e.api.reveal(KADR, {}), true);
  assert.equal(e.overlay().length, 1);
});

test('reveal: открытие карточки снимает удержанный слой своим stop()', () => {
  const e = env();
  e.api.reveal(KADR, {});
  assert.equal(e.api.open({ id: 42 }), true, 'open идёт обычным путём');
  assert.equal(e.overlay().length, 1, 'на экране по-прежнему один слой — новый');
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('poster.jpg') !== -1, 'слой уже от open');
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery, toEl } from './_fakedom.mjs';

/* Task 29 (фаза 3) / Task 44: слой, который разворачивает прямоугольник в
   полноэкранный кадр. Волна 2 (ТВ 2026-09-24, D3): переход «постер ряда →
   кадр карточки» (open) удалён по просьбе пользователя — «убери этот
   эффект, когда картинка расползается и открывается карточка фильма».
   Остался reveal для экрана результата рулетки и stop.

   Геометрия (geom) — чистая функция, проверяется без окружения. Жизненный
   цикл reveal (гейт режима, один узел, удержание до stop, колбэк конца
   разгона) — на фейковых $, requestAnimationFrame и таймерах. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg) { warnLog.push(msg); };

const SRC = readFileSync(new URL('../src/67_transition.js', import.meta.url), 'utf8');

/* onHero — ловушка на ЛЮБОЕ чтение LC.hero (геттер на самом LC): модуль
   к герою не обращается вовсе, ни при загрузке, ни в reveal/stop. */
function build(extra, onHero) {
  const LC = Object.assign({
    motionMode: () => 'full',
    pref: (name, def) => def
  }, extra || {});
  if (onHero) {
    Object.defineProperty(LC, 'hero', { configurable: true, enumerable: true, get: () => { onHero(); return undefined; } });
  }
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
     явно. Волна 2 (D3): источника перехода из ряда больше нет, а API героя,
     которое здесь подменялось (LC.hero.lastFocus), удалено в 38abe8e.
     Ревью раунда хвостов, п.3: мок несуществующего метода ловил только его
     вызов — чтение LC.hero мимо него проходило незамеченным. Теперь
     ловушка — на любое обращение к LC.hero (build, onHero). */
  const heroReads = { count: 0 };
  const { api } = build({
    motionMode: () => opts.motion || 'full',
    pref: (name, def) => (Object.prototype.hasOwnProperty.call(opts.prefs || {}, name) ? opts.prefs[name] : def)
  }, () => { heroReads.count++; });

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

const REEL = { left: 396, top: 120, width: 166, height: 249 };
const KADR = { rect: REEL, poster: 'https://img/t/p/w342/p.jpg', big: 'https://img/t/p/w1280/b.jpg' };

/* Волна 2 (ТВ 2026-09-24, D3): переход «постер → кадр» при открытии
   карточки удалён целиком — ни open, ни чтения настройки lumen_transition
   (её больше нет), ни вспомогательных idOf/sameId/fade. Открытие карточки
   рантайм теперь только снимает слой (stop, src/90_runtime.js). */
test('D3: перехода «постер → кадр» больше нет — модуль отдаёт только слой рулетки', () => {
  assert.equal(T.open, undefined, 'open остался — переход при открытии карточки жив');
  assert.equal(T.fade, undefined, 'растворение было только у open');
  assert.deepEqual(Object.keys(T).sort(), ['active', 'geom', 'reveal', 'stop']);
  assert.equal(/lumen_transition/.test(SRC.replace(/\/\*[\s\S]*?\*\//g, '')), false, 'код читает удалённую настройку');
});

test('stop: снимает удержанный слой — ни узла, ни кадра, ни таймера', () => {
  const e = env();
  e.api.reveal(KADR, { then: () => { } });
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
  e.api.reveal(KADR, {});
  e.api.stop();
  e.api.stop();
  assert.equal(e.overlay().length, 0);
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Task 44: reveal — тот же слой по ЯВНОМУ источнику и без автоснятия      */
/* ====================================================================== */

/* Рулетка показывает выпавший фильм так: прямоугольник барабана
   разворачивается в полноэкранный кадр. Три свойства, и каждое проверяется
   ниже:
     - источник приходит аргументом, героя reveal не спрашивает вовсе;
     - слой не растворяется и не снимается ни концом перехода, ни таймером —
       только stop() (его же зовёт следующий reveal и старт любого экрана);
     - конец разгона отдаётся наружу колбэком opts.then, ровно один раз. */


test('reveal: слой встаёт по переданному прямоугольнику, героя не спрашивает', () => {
  const e = env();
  assert.equal(e.api.reveal(KADR, {}), true);
  assert.equal(e.heroReads.count, 0, 'модуль перехода обратился к LC.hero — при загрузке или в reveal');
  const layers = e.overlay();
  assert.equal(layers.length, 1);
  const img = layers[0].find('.lumen-overlay__img');
  assert.equal(img.css('left'), '396px');
  assert.equal(img.css('top'), '120px');
  assert.equal(img.css('width'), '166px');
  assert.equal(img.css('height'), '249px');
  assert.ok(String(img.css('background-image')).indexOf('/t/p/w1280/b.jpg') !== -1,
    'в слой идёт кадр w1280, а не постер барабана: ' + img.css('background-image'));
  e.fire();
  e.api.stop();
  assert.equal(e.heroReads.count, 0, 'модуль перехода обратился к LC.hero — на страховке разгона или в stop');
});

/* Главное: слой обязан ОСТАТЬСЯ на экране. Растворение в
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

test('reveal: второй reveal снимает первый — на экране всегда один слой', () => {
  const e = env();
  e.api.reveal(KADR, {});
  e.api.reveal({ rect: REEL, poster: 'https://img/t/p/w342/q.jpg' }, {});
  assert.equal(e.overlay().length, 1, 'на экране по-прежнему один слой — новый');
  const img = e.overlay()[0].find('.lumen-overlay__img');
  assert.ok(String(img.css('background-image')).indexOf('q.jpg') !== -1, 'слой уже от второго вызова');
  e.api.stop();
  assert.equal(e.overlay().length, 0);
});

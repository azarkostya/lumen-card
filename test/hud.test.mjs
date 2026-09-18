import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 31 (фаза 4): HUD отладки на экране ТВ.

   Модуль работает с НАТИВНЫМ DOM (document.createElement, body.appendChild/
   removeChild, querySelectorAll) и requestAnimationFrame — не с jQuery-like
   объектами, которые отдаёт test/_fakedom.mjs (тот собран под $() и сюда не
   подходит). Поэтому окружение здесь — свои минимальные заглушки, по образцу
   test/perf.test.mjs: requestAnimationFrame — ручная очередь без авто-вызова
   (кадр выполняется только по явному tick()), поэтому после последнего теста
   файла node --test завершается сам — в очереди не остаётся ни одного
   реального таймера. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/69_hud.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

/* ====================================================================== */
/* format: чистая функция, DOM не нужен.                                  */
/* ====================================================================== */

test('hud: format — строка содержит fps, «1920×1080@2», режим, «long 3», «layers 5»', () => {
  const { api } = fresh();
  const line = api.format({ fps: 58, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 3, layers: 5 });
  assert.ok(line.indexOf('58') !== -1, 'fps в строке: ' + line);
  assert.ok(line.indexOf('1920×1080@2') !== -1, 'разрешение и dpr: ' + line);
  assert.ok(line.indexOf('full') !== -1, 'режим анимаций: ' + line);
  assert.ok(line.indexOf('long 3') !== -1, 'счётчик длинных задач: ' + line);
  assert.ok(line.indexOf('layers 5') !== -1, 'число полноэкранных слоёв: ' + line);
});

/* ====================================================================== */
/* Жизненный цикл: нативный DOM + requestAnimationFrame под ручным         */
/* управлением.                                                            */
/* ====================================================================== */

function env(opts) {
  opts = opts || {};
  const bodyChildren = [];
  const frames = [];
  let nextRaf = 1;
  const cancelled = [];
  let nowMs = 0;

  function makeNode(tag) {
    return { tagName: ('' + tag).toUpperCase(), className: '', textContent: '', parentNode: null };
  }

  const doc = {
    createElement: (tag) => makeNode(tag),
    body: {
      appendChild: (node) => { node.parentNode = doc.body; bodyChildren.push(node); },
      removeChild: (node) => {
        const i = bodyChildren.indexOf(node);
        if (i !== -1) bodyChildren.splice(i, 1);
        node.parentNode = null;
      }
    },
    /* HUD запрашивает только '.lumen-hud' — простого сравнения по className
       достаточно, полноценный движок селекторов здесь не нужен. */
    querySelectorAll: (sel) => {
      const cls = sel.replace('.', '');
      return bodyChildren.filter((n) => n.className === cls);
    }
  };

  const store = Object.assign({}, opts.store || {});
  /* Изменяемая ссылка (не снимок opts.enabled на момент env()): тест
     «выключенный плагин» переключает её между sync(), а замыкание enabled()
     обязано видеть текущее значение, а не то, что было при создании env(). */
  const enabledRef = { value: opts.enabled !== false };
  const win = {
    innerWidth: opts.width || 1920,
    innerHeight: opts.height || 1080,
    devicePixelRatio: opts.dpr || 2,
    performance: { now: () => nowMs },
    /* Ручная очередь: кадр не выполняется сам, только через tick() —
       поэтому висящих реальных таймеров не остаётся и после последнего
       теста node --test завершает процесс сам. */
    requestAnimationFrame: (fn) => { const id = nextRaf++; frames.push({ id, fn }); return id; },
    cancelAnimationFrame: (id) => {
      cancelled.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    }
    /* window.PerformanceObserver намеренно не задан — окружение теста
       воспроизводит браузер без longtask (см. src/69_hud.js: проверка
       supportedEntryTypes перед подпиской). */
  };

  globalThis.document = doc;
  globalThis.window = win;

  function pref(name, def) {
    return Object.prototype.hasOwnProperty.call(store, name) ? !!store[name] : def;
  }

  const { api } = fresh({
    pref, motionMode: () => opts.mode || 'full',
    /* LC.enabled() — гейт «выключенный плагин снял свой CSS, HUD поднимать
       нельзя» (sync(), src/69_hud.js). По умолчанию true, как у соседних
       тестов (test/fx.test.mjs и т.п.). */
    enabled: () => enabledRef.value
  });

  return {
    api, store, bodyChildren, cancelled,
    tick: (ms) => {
      const frame = frames.shift();
      if (!frame) return false;
      nowMs += ms || 0;
      frame.fn(nowMs);
      return true;
    },
    framesLeft: () => frames.length,
    setEnabled: (v) => { enabledRef.value = v; }
  };
}

test('hud: выключен — узла нет, running() === false, ни один кадр не запрошен', () => {
  const e = env({ store: { lumen_debug_hud: false } });
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел не создан');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0, 'requestAnimationFrame ни разу не вызван');
});

test('hud: включён — ровно один узел .lumen-hud, повторный sync() не плодит второй, running() === true; после выключения настройки и sync() узел снят, running() === false и кадр отменён', () => {
  const e = env({ store: { lumen_debug_hud: true } });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'ровно один узел создан');
  assert.equal(e.bodyChildren[0].className, 'lumen-hud');
  assert.equal(e.api.running(), true);
  assert.equal(e.framesLeft(), 1, 'первый кадр запрошен');

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'повторный sync() не плодит второй узел');
  assert.equal(e.api.running(), true);

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел снят при выключении настройки');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'висящий кадр отменён через cancelAnimationFrame');
});

/* ====================================================================== */
/* paint(): rAF-цикл — раз в секунду модельного времени переписывает       */
/* textContent узла тем же форматом, что и format(). Секунда набирается    */
/* двумя кадрами по 600мс: меньше секунды текст не трогается, после —      */
/* обновляется.                                                            */
/* ====================================================================== */

test('hud: после кадров, набравших больше секунды модельного времени, textContent узла совпадает с format(...) при тех же данных', () => {
  const e = env({ store: { lumen_debug_hud: true }, width: 1920, height: 1080, dpr: 2, mode: 'full' });

  e.api.sync();
  assert.equal(e.bodyChildren[0].textContent, '', 'до истечения секунды текст ещё не написан');

  assert.ok(e.tick(600), 'первый кадр');
  assert.equal(e.bodyChildren[0].textContent, '', 'меньше секунды — текст не трогаем');

  assert.ok(e.tick(600), 'второй кадр — секунда истекла (600+600=1200мс)');
  const expected = e.api.format({ fps: 2, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 0, layers: e.api.layers() });
  assert.equal(e.bodyChildren[0].textContent, expected);
  assert.ok(e.framesLeft() >= 1, 'после отрисовки следующий кадр снова запрошен');
});

/* ====================================================================== */
/* Гейт LC.enabled(): выключенный плагин снимает свой CSS целиком           */
/* (LC.removeCss, src/90_runtime.js) — HUD не имеет права поднимать         */
/* нестилизованный узел поверх штатной карточки Lampa.                     */
/* ====================================================================== */

test('hud: выключенный плагин — sync() не поднимает HUD, даже если настройка включена; включение плагина поднимает его, а выключение сразу снимает', () => {
  const e = env({ store: { lumen_debug_hud: true }, enabled: false });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключен — узла нет, хотя настройка включена');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0);

  e.setEnabled(true);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'плагин включили — HUD поднимается');
  assert.equal(e.api.running(), true);

  e.setEnabled(false);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключили — HUD снят, хотя настройка осталась включённой');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'rAF-цикл снят');
});

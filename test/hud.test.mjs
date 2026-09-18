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

  const { api } = fresh({ pref, motionMode: () => opts.mode || 'full' });

  return {
    api, store, bodyChildren, cancelled,
    tick: (ms) => {
      const frame = frames.shift();
      if (!frame) return false;
      nowMs += ms || 0;
      frame.fn(nowMs);
      return true;
    },
    framesLeft: () => frames.length
  };
}

test('hud: выключен — узла нет, running() === false', () => {
  const e = env({ store: { lumen_debug_hud: false } });
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел не создан');
  assert.equal(e.api.running(), false);
});

test('hud: включён — ровно один узел .lumen-hud, повторный sync() не плодит второй, running() === true; после выключения настройки и sync() узел снят и running() === false', () => {
  const e = env({ store: { lumen_debug_hud: true } });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'ровно один узел создан');
  assert.equal(e.bodyChildren[0].className, 'lumen-hud');
  assert.equal(e.api.running(), true);

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'повторный sync() не плодит второй узел');
  assert.equal(e.api.running(), true);

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел снят при выключении настройки');
  assert.equal(e.api.running(), false);
});

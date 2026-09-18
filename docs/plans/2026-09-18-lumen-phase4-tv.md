# Lumen Card — фаза 4: «Телевизор». Производительность + дизайн Apple TV+/Netflix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Плагин на реальном 4K Android TV работает плавно (фокус ≤ 1 кадр, переходы 60 fps на transform/opacity), хаб/сетка/рулетка листаются, картинки не мылятся, а главная/хаб/рулетка выглядят как Apple TV+/Netflix: один шрифт, без рамок и пёстрых бейджей, герой 2/3 экрана с длинным градиентом, крупные постеры.

**Architecture:** Четыре волны, каждая — рабочий плагин: (0) диагностический HUD на экране ТВ; (1) функциональные дефекты — прокрутка и навигация наших экранов, рулетка, подкраска от карточки; (2) производительность — герой и ряды на `transform`, горячий путь фокуса без `MutationObserver`/`getBoundingClientRect`, тени/маски/blur, DPR-размеры картинок, режим тяжёлых эффектов; (3) дизайн — баннерные плитки хаба, карточки без рамок, единая типографика, рулетка с переходом; (4) проверка на ТВ и калибровка.

**Целевое железо (телевизор пользователя):** Philips 50PUS8057/60 (серия 2022, платформа TPM216E, как PUS8007/PUS8107) — четырёхъядерный MediaTek, Android TV 11 R, 16 ГБ ROM, класс «середняк» (RAM по классу — 2 ГБ; уточнит HUD). Панель 4K, но Android TV WebView рендерит не выше 1080p (Google это подтверждает вплоть до Android 12); на части моделей WebView отдаёт `960×540 @ DPR 2`. Следствия: (а) «4K-картинок» через Lampa не будет — цель «чистый 1080p без повторного растяжения растра внутри страницы»; (б) все размеры TMDB считаются от `innerWidth × DPR`, а не от `innerWidth`; (в) после переезда анимаций на `transform`/`opacity` (T36-T38) режим `full` на этом железе должен тянуть — принудительный `lite` без замера только для совсем слабых устройств (≤ 2 ядер или ≤ 1 ГБ), тяжёлые эффекты (частицы, Ken Burns, зум, кроссфейд двух кадров) по умолчанию выключены на любом ТВ.

**Tech Stack:** Lampa 3.3.4 (`vendor/lampa`), строгий ES5 IIFE `src/NN_*.js` → `dist/lumen_card.js` (`node scripts/build.mjs`), тесты `node --test "test/*.test.mjs"` (fake DOM `test/_fakedom.mjs`, загрузчик `test/_load.mjs`), `node scripts/es5check.mjs dist/lumen_card.js`. CSS генерируется строками в `src/30_css.js` (проверка корней — `test/css.test.mjs`).

**Первоисточники (читать до начала):**
- `docs/research/2026-09-18-perf-audit.md` — аудит кода с точными `файл:строка` (номера — на коммит `4cc97d2`; после каждой задачи они сдвигаются, ищи по цитате).
- `docs/research/2026-09-18-android-tv-animations.md` — что можно и нельзя на Android TV WebView.
- `docs/plans/2026-09-15-lumen-phase3-features.md` — конвенции модулей, инварианты, долги.

**Действующие ограничения (не нарушать):**
- Реальный ключ Kinopoisk не получать и не вводить; `lumen_kp_key` в localStorage не трогать вовсе.
- Публикация — только ветка `feat/lumen-v2`; `main` и релиз — только по явному решению пользователя.
- Вкладка `tab-47` в Browser pane — рабочая вкладка пользователя: не трогать, не перезагружать. Для живых проверок открывать СВОЮ вкладку (`tabs_create`) и передавать `tabId` во ВСЕ вызовы.
- Настройки в Storage возвращать через `Lampa.Storage.set` (Lampa кэширует Storage в памяти, `localStorage.removeItem` не действует).
- Запреты CSS: `inset`, `:has()`, пустой `style=""`, U+2028/U+2029; строки — только через `LC.STRINGS` (ru/en/uk); CSS только под своими корнями.
- Инвариант хэшей кнопок карточки 7/7 (`test/template.test.mjs`).
- Правило единиц: em = px(FHD) ÷ 22.811; вложенные em складываются; на 1080p `1vh = 10.8px = 0.4735em`, `100vh = 47.35em`.

**Процесс на каждую задачу:** executor (Opus) → ревью (code-reviewer) → фикс → координатор лично: `node --test "test/*.test.mjs"` (0 fail), `node scripts/build.mjs --check`, `node scripts/es5check.mjs dist/lumen_card.js` → commit → push `feat/lumen-v2` → purge jsDelivr (`https://purge.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js`) → отметка ВЫПОЛНЕНО здесь.

**Комментарии в коде:** каждое утверждение в комментарии — проверяемое. За три фазы ревью 9-10 раз ловило комментарии, утверждающие неправду («ни одного слушателя», «мёртвая gen»). Пишешь «X не вызывается» — покажи grep.

---

## Волна 0 — измерить, прежде чем чинить

### Task 31: HUD отладки на экране ТВ

Без adb на ТВ ничего не видно. HUD показывает FPS, длинные задачи, разрешение/DPR, режим анимаций и число полноэкранных слоёв плагина — всё, что нужно для калибровки.

**Files:**
- Create: `src/69_hud.js`
- Modify: `src/81_prefs.js` (группа «Движение», после `lumen_fastscroll` — нет, после `lumen_motion`: пункт `lumen_debug_hud`, trigger, default `false`)
- Modify: `src/80_settings.js` — строки `lumen_debug_hud_name`/`lumen_debug_hud_descr` (ru/en/uk) + `applyPrefChange`: `if (name === 'lumen_debug_hud') { LC.hud.sync(); return true; }`
- Modify: `src/30_css.js` — правило `.lumen-hud` (корень свой)
- Modify: `src/90_runtime.js` — `LC.hud.sync()` после `LC.injectCss()` при старте
- Modify: `scripts/build.mjs` — порядок сборки: добавить `69_hud.js` после `68_perf.js` (проверь, как перечислены файлы; если сборка берёт `src/*.js` по маске — ничего не менять)
- Test: `test/hud.test.mjs`

- [ ] **Step 1: Тест** — `test/hud.test.mjs`:

```js
import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';
import { makeDom } from './_fakedom.mjs';

function boot(pref) {
  const dom = makeDom();
  globalThis.window = dom.window; globalThis.document = dom.document; globalThis.$ = dom.$;
  globalThis.warn = () => {};
  globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(Date.now()), 0);
  globalThis.performance = { now: () => Date.now() };
  const { api, LC } = loadCtx('69_hud.js', { pref: (name, def) => (name === 'lumen_debug_hud' ? pref : def), motionMode: () => 'full' });
  return { api, LC, dom };
}

test('hud: выключен — узла нет, цикла нет', () => {
  const { api, dom } = boot(false);
  api.sync();
  assert.equal(dom.document.querySelectorAll('.lumen-hud').length, 0);
  assert.equal(api.running(), false);
});

test('hud: включён — один узел, повторный sync не плодит второй', () => {
  const { api, dom } = boot(true);
  api.sync(); api.sync();
  assert.equal(dom.document.querySelectorAll('.lumen-hud').length, 1);
  assert.equal(api.running(), true);
});

test('hud: format — строка с fps, разрешением, DPR, режимом и long', () => {
  const { api } = boot(true);
  const s = api.format({ fps: 24, w: 1920, h: 1080, dpr: 2, mode: 'full', long: 3, layers: 5 });
  assert.match(s, /24 fps/); assert.match(s, /1920×1080@2/); assert.match(s, /full/); assert.match(s, /long 3/); assert.match(s, /layers 5/);
});
```

(Если `_fakedom.mjs` экспортирует другое имя фабрики — посмотри `test/moods.test.mjs`, как там поднимают DOM, и повтори.)

- [ ] **Step 2: Прогнать — падает** (`node --test test/hud.test.mjs` → «Cannot find module 69_hud.js»).

- [ ] **Step 3: Модуль** `src/69_hud.js`:

```js
/* ---------------------------------------------------------------------- */
/* Task 31 (фаза 4): HUD отладки — FPS, длинные задачи, разрешение, DPR,   */
/* режим анимаций, число полноэкранных слоёв плагина. Только по настройке  */
/* lumen_debug_hud; выключен — ни узла, ни таймера, ни rAF.               */
/* ---------------------------------------------------------------------- */
LC.hud = (function () {
  var state = null; /* { node, frames, last, long, raf, obs } */

  function format(d) {
    return d.fps + ' fps · ' + d.w + '×' + d.h + '@' + d.dpr + ' · ' + d.mode + ' · long ' + d.long + ' · layers ' + d.layers;
  }

  /* Полноэкранные слои плагина — по классам, которые ставят модули. */
  var FULL = '.lumen-hero__bg,.lumen-hero__veil--l,.lumen-hero__veil--b,.lumen-fx,.lumen-backdrop,.lumen-ambient,.lumen-overlay,.lumen-roulette__bg';
  function layers() {
    try { return document.querySelectorAll(FULL).length; } catch (e) { return 0; }
  }

  function paint(t) {
    if (!state) return;
    state.frames++;
    if (t - state.last >= 1000) {
      var mode = 'n/a';
      try { mode = LC.motionMode(); } catch (e) { }
      state.node.textContent = format({
        fps: state.frames, w: window.innerWidth, h: window.innerHeight,
        dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
        mode: mode, long: state.long, layers: layers()
      });
      state.frames = 0; state.last = t;
    }
    state.raf = requestAnimationFrame(paint);
  }

  function start() {
    if (state) return;
    var node = document.createElement('div');
    node.className = 'lumen-hud';
    document.body.appendChild(node);
    state = { node: node, frames: 0, last: performance.now(), long: 0, raf: 0, obs: null };
    try {
      if (window.PerformanceObserver && PerformanceObserver.supportedEntryTypes &&
          PerformanceObserver.supportedEntryTypes.indexOf('longtask') > -1) {
        state.obs = new PerformanceObserver(function (list) {
          if (state) state.long += list.getEntries().length;
        });
        state.obs.observe({ entryTypes: ['longtask'] });
      }
    } catch (e) { }
    state.raf = requestAnimationFrame(paint);
  }

  function stop() {
    if (!state) return;
    try { cancelAnimationFrame(state.raf); } catch (e) { }
    try { if (state.obs) state.obs.disconnect(); } catch (e2) { }
    try { state.node.parentNode.removeChild(state.node); } catch (e3) { }
    state = null;
  }

  function sync() {
    var on = false;
    try { on = LC.prefs && LC.prefs.boolOf ? LC.prefs.boolOf(LC.pref('lumen_debug_hud', false)) : !!LC.pref('lumen_debug_hud', false); } catch (e) { }
    if (on) start(); else stop();
  }

  return { sync: sync, format: format, running: function () { return !!state; }, layers: layers };
})();
if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hud;
```

Проверь, как другие модули читают trigger-настройки (`LC.prefs.boolOf` — см. `src/81_prefs.js`), и используй ту же функцию.

- [ ] **Step 4: CSS** в `src/30_css.js` (рядом с `.lumen-minimap`):

```js
css.push('.lumen-hud{position:fixed;top:.3em;left:.3em;z-index:99999;padding:.2em .5em;font:.7em/1.4 Consolas,"Courier New",monospace;color:#0f0;background:rgba(0,0,0,.75);border-radius:.3em;pointer-events:none;white-space:nowrap}');
```

- [ ] **Step 5: Настройка + строки + `applyPrefChange` + `sync()` при старте.** Строки: ru «Отладка: показать FPS» / «Счётчик кадров, длинные задачи, разрешение и режим анимаций в углу экрана. Для проверки на телевизоре», en «Debug: show FPS», uk «Налагодження: показати FPS».

- [ ] **Step 6: Тесты зелёные, сборка, ES5** — `node --test "test/*.test.mjs"`, `node scripts/build.mjs`, `node scripts/es5check.mjs dist/lumen_card.js`.

- [ ] **Step 7: Живая проверка на стенде** (своя вкладка, `tabId`): включить настройку через `Lampa.Storage.set('lumen_debug_hud', true)`, `window.lumen_card.hud.sync()` → в углу строка вида `60 fps · 1280×720@1 · full · long 0 · layers 7`.

- [ ] **Step 8: Commit** `feat: HUD отладки для проверки на ТВ (Task 31)`.

---

## Волна 1 — функциональные дефекты

### Task 32: Хаб, сетка и рулетка — прокрутка

Причина «вниз нельзя вообще»: `Lampa.Scroll` создан, но `scroll.minus()` (высота = экран − шапка, класс `layer--wheight`) и `scroll.update(node, true)` (подкрутка к фокусу) не вызываются ни разу. Эталон Lampa: `vendor/lampa/app.min.js:53170` (`scroll.minus()` в `create`), `:53107` (`scroll.update(card.render(true))` в `onFocus`).

**Files:**
- Modify: `src/46_hub.js` — `HubComponent.create` (≈`:765`), `GridComponent.create` (≈`:1180`), `hover:focus` плитки (≈`:634`), карточки сетки (≈`:973`), чипов (≈`:666`, `:1149`), кнопки поиска
- Modify: `src/56_roulette.js` — `RouletteComponent.create` (≈`:850`), `watchFocus`
- Test: `test/hub.test.mjs`, `test/roulette.test.mjs`

- [ ] **Step 1: Тесты.** В `test/hub.test.mjs` найди, как поднимается `HubComponent` с заглушкой `Lampa.Scroll` (там есть stub со `append/render/destroy`). Расширь stub полями `minus_calls` и `update_calls`:

```js
function ScrollStub() {
  this.minus_calls = 0; this.update_calls = [];
  this.minus = function () { this.minus_calls++; };
  this.update = function (el, center) { this.update_calls.push([el, !!center]); };
  this.append = function () {}; this.render = function () { return $('<div class="scroll"></div>'); }; this.destroy = function () {};
}
```

Тесты:

```js
test('hub: create() вызывает scroll.minus() ровно один раз', ...);   // после create → stub.minus_calls === 1
test('hub: hover:focus плитки зовёт scroll.update(node, true)', ...); // trigger('hover:focus') на плитке → update_calls.length === 1, [0][1] === true
test('grid: create() вызывает scroll.minus(); hover:focus карточки — scroll.update', ...);
test('roulette: create() вызывает scroll.minus(); фокус чипа — scroll.update', ...);
```

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: Реализация.** В каждом `create()` сразу после `scroll.append(root)`:

```js
/* Task 32: высота области прокрутки = экран − шапка (класс layer--wheight,
   штатный контракт Lampa: app.min.js, category_full.create → scroll.minus()).
   Без него .scroll растягивается по содержимому, maxOffset равен нулю и
   прокрутки нет вовсе (первая проверка на ТВ, 2026-09-18). */
scroll.minus();
```

В каждом обработчике `hover:focus` наших `.selector` (плитки, карточки сетки, чипы, кнопка поиска, элементы рулетки — введи одну функцию `keepVisible(node)` на компонент):

```js
function keepVisible(el) {
  try { scroll.update($(el), true); } catch (e) { warn('hub: scroll.update failed', e); }
}
```

и в `node.on('hover:focus', ...)` — первым делом `keepVisible(node[0])`. В рулетке `watchFocus` уже оборачивает все `.selector` — добавь вызов туда.

- [ ] **Step 4: Тесты зелёные.**

- [ ] **Step 5: Живая проверка** (своя вкладка): открыть хаб → «Франшизы» (34 плитки) → жать «вниз» до конца: фокус едет, сетка прокручивается, последний ряд виден целиком. Замер: `document.querySelector('.lumen-hub').closest('.scroll').classList.contains('layer--wheight') === true`. То же для сетки любой подборки и для рулетки (чипы подборок ниже экрана).

- [ ] **Step 6: Commit** `fix: прокрутка хаба, сетки и рулетки — scroll.minus/update (Task 32)`.

### Task 33: Навигация в наших экранах — окно коллекции, один `navigate` на нажатие, ускорение

Сейчас `Controller.collectionSet(root[0])` отдаёт Navigator все `.selector` (42 в хабе, до 300 в сетке), а `navMove` зовёт `canmove` + `move`, каждый — полный проход `getBoundingClientRect` по коллекции. Плюс `FAST_EXTRA = 2` в `64_nav.js` утраивает работу при удержании.

**Files:**
- Modify: `src/46_hub.js` — `navMove` (≈`:422`), `screenController` (≈`:444`), `recollect` в хабе (≈`:524`) и сетке (≈`:893`)
- Modify: `src/64_nav.js:79` (`FAST_EXTRA`), `onHorizontal` (≈`:541`)
- Test: `test/hub.test.mjs`, `test/nav.test.mjs`

- [ ] **Step 1: Тесты.**

```js
test('hub: navMove делает один Navigator.navigate — canmove вернул элемент, move не зовётся', ...);
// stub Navigator: canmove(dir) → elem или false; focus(elem) — считает вызовы; move — считает вызовы; ожидание: focus 1, move 0
test('grid: коллекция Navigator ограничена окном ±36 вокруг активной карточки', ...);
// 120 карточек, активная 80 → Navigator.setCollection получил 72 узла (44..116)
test('grid: карточки вне окна ±12 теряют layer--render, внутри — получают', ...);
test('nav: FAST_EXTRA даёт один дополнительный шаг, а не два', ...); // в test/nav.test.mjs, если там есть тест на ускорение — поправить ожидание ×2
```

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: `navMove`:**

```js
/* Task 33: canmove() у SpatialNavigator возвращает найденный элемент
   (vendor/lampa/vender/navigator/navigator.js, canmove → navigate(...)),
   а move() делал бы тот же поиск ещё раз — с getBoundingClientRect по всей
   коллекции. Второй проход снят: фокус ставим сразу на найденный узел. */
function navMove(dir) {
  try {
    if (!window.Navigator || typeof Navigator.canmove !== 'function') return false;
    var next = Navigator.canmove(dir);
    if (!next) return false;
    if (typeof Navigator.focus === 'function') Navigator.focus(next);
    else Navigator.move(dir);
    return true;
  } catch (e) {
    warn('hub: navigator failed', e);
  }
  return false;
}
```

Проверь по `navigator.js:732-770`, что `canmove` действительно возвращает элемент, а `focus(elem)` есть и ставит фокус + шлёт `hover:focus` (если `focus` только выставляет `focused` без события — используй `Navigator.move(dir)` и укажи в комментарии, почему). Замерь на стенде: `performance.now()` вокруг `navMove` до/после в сетке из 100 карточек.

- [ ] **Step 4: Окно коллекции** — общая функция в `46_hub.js`:

```js
/* Task 33: окно коллекции Navigator, как в штатной category_full
   (app.min.js, this.limit: limit_view 12, limit_collection 36). Всё, что
   вне окна ±12, теряет layer--render (Lampa его не рисует), вне ±36 — не
   участвует в поиске соседа. nodes — DOM-узлы .selector в порядке экрана,
   active — индекс узла в фокусе (−1 → окно от начала). */
var VIEW_WINDOW = 12;
var NAV_WINDOW = 36;
function limitCollection(nodes, active) {
  if (active < 0) active = 0;
  var from = Math.max(0, active - NAV_WINDOW);
  var to = active + NAV_WINDOW;
  var vf = Math.max(0, active - VIEW_WINDOW);
  var vt = active + VIEW_WINDOW;
  var slice = [];
  for (var i = 0; i < nodes.length; i++) {
    var inView = i >= vf && i < vt;
    try { nodes[i].classList.toggle('layer--render', inView); } catch (e) { }
    if (i >= from && i < to) slice.push(nodes[i]);
  }
  try { Navigator.setCollection(slice); } catch (e2) { warn('hub: setCollection failed', e2); }
}
```

`classList.toggle` с двумя аргументами — в старых WebView (Chromium < 24) нет; Lampa 3.3.4 требует ≥ Chrome 53, но для Tizen 2016 безопаснее `if (inView) add else remove`. Сделай через add/remove.

Применение: в сетке (`GridComponent`) `recollect` и `afterMove` → `limitCollection(cardNodes, indexOf(focused))` вместо `Controller.collectionSet(root[0])`; чипы сортировки сетки — включить в `nodes` первыми (они над карточками), чтобы «вверх» с первого ряда попадал на них. В хабе 42 узла — окно не нужно, но `layer--render` вне ±12 полезен: применяй ту же функцию. Убедись, что `Controller.collectionFocus` продолжает работать (он берёт коллекцию из `collectionSet` — если после `setCollection` `collectionFocus` не находит узел, зови `Navigator.focus(node)` напрямую).

- [ ] **Step 5: Ускорение** `src/64_nav.js`: `FAST_EXTRA = 1` и в `onHorizontal` — `if (LC.motionMode() === 'off') return;` перед циклом (на `off` ускорение выключено целиком). Обнови комментарий «итого ×3» → «итого ×2».

- [ ] **Step 6: Тесты зелёные; живая проверка** сетки любой подборки на 100+ карточках: `performance.now()` на нажатие ≤ 8 мс на стенде.

- [ ] **Step 7: Commit** `perf: окно коллекции и один navigate на нажатие в хабе/сетке; ускорение ×2 (Task 33)`.

### Task 34: Рулетка — фон только у результата

`spin()` не вызывает `clearResult()`, `showResult` ставит фон только при наличии `backdrop_path` — предыдущий кадр остаётся. Переход «постер → кадр» для рулетки — в Task 44 (дизайн), здесь только корректность.

**Files:**
- Modify: `src/56_roulette.js` — `spin` (≈`:807`), `showResult` (≈`:677`), `clearResult` (≈`:657`)
- Test: `test/roulette.test.mjs`

- [ ] **Step 1: Тесты:**

```js
test('roulette: spin() снимает фон и результат прошлого раза до прокрутки', ...);      // bg background-image === '' сразу после spin()
test('roulette: showResult без backdrop_path оставляет фон пустым, а не прошлый', ...);
test('roulette: фон ставится только после загрузки кадра (new Image onload)', ...);    // до onload — '', после — url
```

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: Реализация.** В `spin()` первой строкой после `spinning = true`: `clearResult();`. В `showResult`:

```js
function showResult(card) {
  result = card;
  try { bg.css('background-image', ''); } catch (e0) { }
  var backdrop = imageUrl(card.backdrop_path, 'w1280');
  if (backdrop) {
    /* Task 34: кадр ставится только загруженным — иначе на ТВ он
       декодируется уже на экране (заметный фриз), а при ошибке сети
       остался бы прошлый. */
    var img = new Image();
    var captured = gen;
    img.onload = function () {
      if (gen !== captured || result !== card) return;
      bg.css('background-image', 'url("' + backdrop + '")');
    };
    img.src = backdrop;
  }
  ...
```

- [ ] **Step 4: Тесты зелёные. Commit** `fix: рулетка — фон только у текущего результата (Task 34)`.

### Task 35: Подкраска фона от карточки — включить и сделать видимой

Шесть гипотез аудита (раздел I). Делаем так, чтобы работало при любой из них.

**Files:**
- Modify: `src/81_prefs.js:106` — `lumen_accent_auto` default `true`
- Modify: `src/57_color.js` — `on()` (≈`:500`), `tint()` (≈`:620`), `img.onerror` (≈`:411`), `read()` catch (≈`:375`), `apply()` (≈`:568`), `fromImage`/URL (≈`:540`)
- Modify: `src/30_css.js` — `palette()` (≈`:147`): цвет подложки больше не вшивается в общую таблицу
- Modify: `src/90_runtime.js` — узел `<style id="lumen-accent">`
- Test: `test/color.test.mjs`, `test/prefs.test.mjs`

- [ ] **Step 1: Тесты:**

```js
test('accent: включён по умолчанию', ...);                                   // prefs default true
test('accent: on() при motionMode lite — true, при off — false', ...);       // гейт === 'off', не !== 'full'
test('color.fromImage: onerror с прокси → повтор с https://image.tmdb.org, warn с URL', ...);
test('color.fromImage: провал НЕ кэшируется (второй вызов снова грузит)', ...);
test('accent.apply: пишет 3 правила в <style id="lumen-accent">, LC.injectCss не вызывается', ...);
```

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: Реализация.**
  1. `81_prefs.js`: `'default': true`; комментарий переписать («включён по умолчанию с фазы 4: на ТВ это единственная связь подложки рядов с кадром»).
  2. `57_color.js` `on()`: `if (LC.motionMode() === 'off') return false;` вместо `!== 'full'`; в `tint()` — то же.
  3. `img.onerror`: `warn('color: image failed', url)`; если `url` не начинается с `https://image.tmdb.org/` — повторить один раз с прямым адресом `'https://image.tmdb.org/t/p/w185' + path` (там `Access-Control-Allow-Origin: *`); только после второго провала — `done(null)`. Для этого `fromImage` должен принимать `path` (а не готовый URL) — посмотри вызов из `applyFor` и передай `poster_path`. Провал НЕ класть в кэш (`cachePut` только при успехе).
  4. `read()` catch: `warn('color: read failed', e && e.name, url)`.
  5. `apply(color)`: вместо `LC.injectCss()` — отдельный узел:

```js
/* Task 35: цвет подложки живёт в СВОЁМ <style>: пересборка общей таблицы
   (28-81 КБ) на каждую смену цвета — это разбор CSS и полный recalc на
   слабом ТВ. Три правила ниже — всё, что зависит от доминанты. */
function writeAccentStyle(rules) {
  var node = document.getElementById('lumen-accent');
  if (!node) {
    node = document.createElement('style');
    node.id = 'lumen-accent';
    document.head.appendChild(node);
  }
  node.textContent = rules;
}
```

Правила: `.lumen-main{background-color:<tint>}`, `.lumen-hero .lumen-hero__veil--b{background-image:<градиент к tint>}` (низ градиента должен уходить в тот же цвет, что подложка — иначе видна кромка), и `.lumen-main .items-line__title{color:...}` не трогать. Пустой `color` → `node.textContent = ''` (возврат к таблице).
  6. `30_css.js` `palette()`: `P.bg` для `.lumen-main` остаётся базой, `LC.accent.tint` из `palette()` убрать (иначе двойной источник).

- [ ] **Step 4: Тесты зелёные. Живая проверка** (своя вкладка): встать на карточку, ждать 3.5 с → `getComputedStyle(document.querySelector('.activity--active.lumen-main')).backgroundColor` изменился; `document.getElementById('lumen-accent').textContent` содержит `.lumen-main{background-color`. `window.lumen_card.color.requests()` вырос на 1.

- [ ] **Step 5: Commit** `fix: подкраска от карточки — включена, CORS-фолбэк, свой style-узел (Task 35)`.

---

## Волна 2 — производительность

### Task 36: Герой 2/3 → 1/2 на `transform`, кадр по лицам, длинный градиент, чипы внутри героя

Самая крупная задача. Убирает пять одновременных layout-анимаций (`height`, `margin-top`, `width`, `bottom` ×2) и переводит сжатие на два `translateY` + один `opacity`. Заодно реализует требования пользователя: герой 2/3 экрана в стартовом состоянии, 1/2 в сжатом, «переход к подложке плавнее», «лица видны», «ряды поднимаются, пустой зоны нет».

**Новая геометрия (1080p, em = 22.811 px, 1vh = 10.8 px):**

| Величина | Старт | Сжатый |
|---|---|---|
| `.lumen-hero` | `top:-4em; height:66.67vh` (низ на 720 px) | `transform:translateY(-16.67vh)` (низ на 540 px) |
| Кадр `.lumen-hero__bg` | `background-position:center 30%` | то же |
| Нижняя вуаль | `linear-gradient(0deg, bg 0%, rgba(bg,.92) 10%, rgba(bg,.6) 24%, rgba(bg,.25) 42%, rgba(bg,0) 62%)` | то же |
| Левая вуаль | `linear-gradient(90deg, rgba(bg,.85) 0%, rgba(bg,.45) 30%, rgba(bg,0) 65%)` | то же |
| Текст героя `.lumen-hero__text` | `bottom:` `TEXT_BOTTOM_VH = 10vh` (над первым рядом) | `transform:translateY(6.6vh)` (к кромке 540) |
| Чипы настроения | внутри `.lumen-hero__text`, под метой | `opacity:0` (transition), `pointer-events:none` |
| Ряды `.scroll.layer--wheight` | `margin-top:calc(50vh − 4em + AIR); height:calc(50vh + 4em − AIR)!important; transform:translateY(8vh)` | `transform:translateY(0)` |
| Карточка `.lumen-main .card` | `width:11.4em` (260 px; было 10.08em/230) | — |

`AIR = 1.5em`. Проверка бюджета в старте: заголовок первого ряда на `58vh + AIR ≈ 660 px`, карточки 260×390 с 700 по 1090 — низ ряда чуть за экраном (подписи), это норма tvOS («ряд наполовину виден»); при фокусе на первом ряду Lampa не скроллит (ряд первый). В сжатом: заголовок ряда на `50vh + AIR ≈ 574`, карточки 614-1004, подписи до 1075. Второй ряд — при листании вниз Lampa ставит его на место первого.

Все transition — только `transform` и `opacity`, `.42s cubic-bezier(.2,.8,.2,1)`, только в `lumen-motion-full`; в `lite` — те же transform без transition (мгновенно); в `off` — то же.

**Files:**
- Modify: `src/30_css.js` — блок героя (`:1534-1734`), блок рядов (`:1812-1933`), чипов (`:1748-1780`), константы `HERO_*`, `TEXT_*`, `MOODS_*`, `heroCutEm`, `compactAreaEm`, `heroSmallText`, `HERO_MIN_RATIO`
- Modify: `src/48_hero.js` — `setCompact` (≈`:973`), `logoBox`, `mount` (текст героя — контейнер для чипов), `HERO_SIZES` больше не двигают высоту через cut — размер (`large/medium/compact`) теперь = `66.67 / 56 / 45 vh` в старте и `50 / 42 / 34 vh` в сжатом
- Modify: `src/49_moods.js` — монтирование чипов в `.lumen-hero__text .lumen-hero__moods` (когда герой есть) либо под шапку (герой выключен) — как сейчас
- Test: `test/css.test.mjs`, `test/hero.test.mjs`, `test/moods.test.mjs`

- [ ] **Step 1: Тесты в `test/css.test.mjs`:**

```js
test('hero: сжатие — только transform/opacity, ни одного transition на height/margin/bottom/width/font-size', () => {
  const rules = css.split('}').filter(r => /\.lumen-hero|\.lumen-main.*layer--wheight|\.lumen-moods|\.lumen-hero__text|\.lumen-hero__logo/.test(r));
  for (const r of rules) {
    const m = r.match(/transition:([^;}]*)/);
    if (!m) continue;
    assert.doesNotMatch(m[1], /\b(height|margin-top|bottom|width|font-size|top|left)\b/, r);
  }
});
test('hero: стартовая высота 66.67vh, сжатие — translateY(-16.67vh)', () => {
  assert.match(css, /\.lumen-hero\{[^}]*height:66\.67vh/);
  assert.match(css, /\.lumen-hero\.lumen-hero--compact\{[^}]*translateY\(-16\.67vh\)/);
});
test('hero: кадр кадрируется по центру-верху лиц (center 30%), не center top', () => {
  assert.match(css, /\.lumen-hero__bg\{[^}]*background-position:center 30%/);
  assert.doesNotMatch(css, /\.lumen-hero__bg\{[^}]*background-position:center top/);
});
test('rows: контейнер рядов — фиксированные margin-top/height и translateY(8vh) в старте, 0 в сжатом', () => {
  assert.match(css, /\.lumen-main \.scroll\.layer--wheight\{[^}]*translateY\(8vh\)/);
  assert.match(css, /\.lumen-main\.lumen-rows-up \.scroll\.layer--wheight\{[^}]*translateY\(0\)/);
});
test('rows: карточка ряда 11.4em', () => { assert.match(css, /\.lumen-main \.card\{[^}]*width:11\.4em/); });
test('moods: полоса больше не absolute с bottom — чипы внутри текста героя', () => {
  assert.doesNotMatch(css, /\.lumen-main \.lumen-moods\{[^}]*bottom:/);
  assert.match(css, /\.lumen-hero__text \.lumen-hero__moods\{/);
});
```

Существующие тесты на `heroCutEm`, `HERO_MIN_RATIO`, `MOODS_H` в бюджете, «чипы не пересекают кадр» — переписать под новую модель или удалить с пояснением в коммите (каждый удалённый тест — строка в сообщении коммита: что проверял, почему больше не применим).

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: CSS.** Замени блок героя. Ключевые правила (полный список — по старому блоку, сохраняя все селекторы, которые проверяет `css.test.mjs`):

```js
/* Task 36 (фаза 4): высота героя — доля экрана, не «экран минус ряд».
   Сжатие — сдвиг вверх на 16.67vh (66.67 → 50), кадр уезжает под шапку,
   нижняя кромка с градиентом остаётся; ни одно свойство раскладки не
   анимируется (первая проверка на ТВ, 2026-09-18: пять одновременных
   reflow-анимаций давали 3-5 кадров из 25). */
var HERO_VH = { large: 66.67, medium: 56, compact: 45 };
var HERO_SHIFT_VH = { large: 16.67, medium: 14, compact: 11 };   // старт − сжатый
var ROWS_TOP_VH = { large: 50, medium: 42, compact: 34 };        // низ сжатого героя
var ROWS_SHIFT_VH = 8;                                            // ряды в старте ниже на столько
var ROWS_AIR = 1.5;                                               // em, воздух над заголовком ряда
var TEXT_BOTTOM_VH = 10;                                          // текст над первым рядом в старте
var TEXT_SHIFT_VH = 6.6;                                          // текст к кромке в сжатом
var size = heroSize();  // 'large' | 'medium' | 'compact' (см. HERO_SIZES/heroFactor сейчас)

css.push('.lumen-hero{position:absolute;top:-4em;left:0;right:0;height:' + HERO_VH[size] + 'vh;overflow:hidden;pointer-events:none;-webkit-transform:translateY(0);transform:translateY(0)}');
css.push('.lumen-hero.lumen-hero--compact{-webkit-transform:translateY(-' + HERO_SHIFT_VH[size] + 'vh);transform:translateY(-' + HERO_SHIFT_VH[size] + 'vh)}');
css.push('.lumen-hero.lumen-motion-full{-webkit-transition:-webkit-transform .42s cubic-bezier(.2,.8,.2,1);transition:transform .42s cubic-bezier(.2,.8,.2,1)}');
css.push('.lumen-hero .lumen-hero__bg{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-background-size:cover;background-size:cover;background-position:center 30%;background-repeat:no-repeat;opacity:0}');
css.push('.lumen-hero .lumen-hero__veil--b{position:absolute;left:0;right:0;bottom:0;top:0;background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%);background:linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.92) 10%,rgba(' + P.bgRgb + ',.6) 24%,rgba(' + P.bgRgb + ',.25) 42%,rgba(' + P.bgRgb + ',0) 62%)}');
css.push('.lumen-hero .lumen-hero__veil--l{position:absolute;left:0;right:0;bottom:0;top:0;background:-webkit-linear-gradient(left,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%);background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.85) 0%,rgba(' + P.bgRgb + ',.45) 30%,rgba(' + P.bgRgb + ',0) 65%)}');
css.push('.lumen-hero .lumen-hero__text{position:absolute;left:' + round2(2.81 / TEXT_ZOOM) + 'em;right:' + round2(2.81 / TEXT_ZOOM) + 'em;bottom:' + TEXT_BOTTOM_VH + 'vh;top:' + round2(HERO_HEAD_SAFE / TEXT_ZOOM) + 'em;font-size:' + TEXT_ZOOM + 'em;max-width:46em;overflow:hidden;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end;-webkit-transform:translateY(0);transform:translateY(0)}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__text{-webkit-transform:translateY(' + TEXT_SHIFT_VH + 'vh);transform:translateY(' + TEXT_SHIFT_VH + 'vh)}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__text{-webkit-transition:opacity .18s ease,-webkit-transform .42s cubic-bezier(.2,.8,.2,1);transition:opacity .18s ease,transform .42s cubic-bezier(.2,.8,.2,1)}');
/* Логотип: размер задаёт инлайн от logoBox; в сжатом — коэффициент через transform, не width/height. */
css.push('.lumen-hero .lumen-hero__logo{-webkit-transform-origin:left bottom;transform-origin:left bottom}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__logo{-webkit-transform:scale(' + LOGO_COMPACT + ');transform:scale(' + LOGO_COMPACT + ')}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__logo{-webkit-transition:-webkit-transform .42s cubic-bezier(.2,.8,.2,1);transition:transform .42s cubic-bezier(.2,.8,.2,1)}');
/* Чипы настроения — внутри текста героя, под метой; в сжатом гаснут. */
css.push('.lumen-hero__text .lumen-hero__moods{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:.9em;pointer-events:auto}');
css.push('.lumen-hero.lumen-hero--compact .lumen-hero__moods{opacity:0;pointer-events:none}');
css.push('.lumen-hero.lumen-motion-full .lumen-hero__moods{-webkit-transition:opacity .18s ease;transition:opacity .18s ease}');
/* Ряды. */
css.push('.lumen-main .scroll.layer--wheight{margin-top:-webkit-calc(' + ROWS_TOP_VH[size] + 'vh - 4em + ' + ROWS_AIR + 'em);margin-top:calc(' + ROWS_TOP_VH[size] + 'vh - 4em + ' + ROWS_AIR + 'em);height:-webkit-calc(' + (100 - ROWS_TOP_VH[size]) + 'vh + 4em - ' + ROWS_AIR + 'em) !important;height:calc(' + (100 - ROWS_TOP_VH[size]) + 'vh + 4em - ' + ROWS_AIR + 'em) !important;-webkit-transform:translateY(' + ROWS_SHIFT_VH + 'vh);transform:translateY(' + ROWS_SHIFT_VH + 'vh)}');
css.push('.lumen-main.lumen-rows-up .scroll.layer--wheight{-webkit-transform:translateY(0);transform:translateY(0)}');
css.push('.lumen-main .lumen-hero.lumen-motion-full ~ .activity__body .scroll.layer--wheight{-webkit-transition:-webkit-transform .42s cubic-bezier(.2,.8,.2,1);transition:transform .42s cubic-bezier(.2,.8,.2,1)}');
css.push('.lumen-main .card{width:11.4em}');
```

Компактный текст: `TEXT_ZOOM_COMPACT` — заменить на `transform: scale(.95)` в том же правиле `.lumen-hero--compact .lumen-hero__text` (комбинировать `translateY(...) scale(.95)`, `transform-origin: left bottom`). `lumen-hero--compact .lumen-hero__meta/descr{display:none}` — оставить (display не анимируется, это мгновенная смена). `heroCutEm`, `compactAreaEm`, `HERO_AIR`, `HERO_COMPACT`, `MOODS_H*`, `MOODS_GAP`, `MOODS_BAR`, `textNeedEm` — удалить вместе с тестами на них; `HERO_MIN_RATIO` оставить (порог низкого окна), но считать от `HERO_VH`: герой не показывается, если `innerHeight * HERO_VH/100 < HERO_HEAD_SAFE*em + TEXT_MIN_EM*em` — см. текущую формулу `:1924` и перепиши через vh.

`.lumen-main .scroll.layer--wheight` уже имеет `!important` на height — Lampa ставит инлайн. Проверь, что `Lampa.Layer.update()` не перебивает наш margin-top (сейчас работает — сохрани тот же приём).

Режим «Герой: выключен» (`lumen_hero_size === 'off'`, правила `:1926-1932`) — переписать под чипы под шапкой: `.lumen-moods-on.lumen-main:not(.lumen-hero-on) .scroll.layer--wheight{margin-top:...}` — `:not()` разрешён (проверь `css.test.mjs`), либо отдельный класс `lumen-hero-off` на корне.

- [ ] **Step 4: JS.** `48_hero.js`: `setCompact` без изменений по смыслу (два класса). `logoBox(ratio, compact)` — размер логотипа считать ТОЛЬКО для стартового состояния (compact-масштаб теперь в CSS через `scale`), убрать ветку `compact`. `mount`: в разметке `.lumen-hero__text` добавить `<div class="lumen-hero__moods"></div>` после `.lumen-hero__meta`… нет — после `.lumen-hero__descr` (чипы — последний элемент блока). `49_moods.js`: `mount(root)` — если есть `root.find('.lumen-hero__text .lumen-hero__moods')`, монтировать чипы туда и НЕ ставить `.lumen-moods-on`; иначе — как сейчас (под шапкой). `.lumen-hero{pointer-events:none}` — чипам нужен `pointer-events:auto` (в CSS выше есть).

Фокус на чипах: Navigator найдёт их геометрически при «вверх» с первого ряда. Проверь живьём; если не находит из-за `overflow:hidden`/`pointer-events` — добавь в контроллер главной Lampa `up`-фолбэк как в хабе (`onUp`), но только если фокус на первом ряду.

- [ ] **Step 5: Тесты зелёные, сборка, ES5.**

- [ ] **Step 6: Живая проверка** (своя вкладка, 1920×1080 через `resize_window`): `document.querySelector('.lumen-hero').getBoundingClientRect().bottom` ≈ 720; после перехода на второй ряд — ≈ 540; `.items-line:first-child .items-line__title` top ≈ 660 в старте, ≈ 574 в сжатом; кромки кадра глазом не найти (скриншот); `getComputedStyle(hero).transition` содержит только `transform`. При переходе — HUD показывает ≥ 55 fps на стенде.

- [ ] **Step 7: Commit** `perf: герой 2/3→1/2 на transform, длинный градиент, чипы в тексте героя (Task 36)`.

### Task 37: Горячий путь фокуса без `MutationObserver` и `getBoundingClientRect`

**Files:**
- Modify: `src/48_hero.js` — `observe` (≈`:1148`), `onMutations` (≈`:1132`), `rememberFocus` (≈`:995`), `onFocus` (≈`:1093`), `lastFocus`
- Modify: `src/67_transition.js` — `open()` (≈`:297`): прямоугольник снимать здесь
- Modify: `src/62_badges.js` — второй `MutationObserver` (≈`:212`): `childList` только, без `attributes` (проверь, что он и так `childList` — тогда не трогать)
- Test: `test/hero.test.mjs`, `test/transition.test.mjs`

- [ ] **Step 1: Тесты:**

```js
test('hero: фокус карточки ловится делегированным hover:focus на корне, MutationObserver не создаётся', ...);
// window.MutationObserver = function(){ throw new Error('must not') }; root.find('.card').trigger('hover:focus') → onFocus сработал (таймер показа взведён)
test('hero: rememberFocus не читает getBoundingClientRect', ...);
// el.getBoundingClientRect = () => { throw new Error('layout read in hot path') }; trigger hover:focus → не бросает; lastFocus().rect === null
test('transition.open: прямоугольник берётся в момент открытия из last.node', ...);
test('hero: повторный hover:focus той же карточки не перезапускает таймер акцента', ...);
```

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: Реализация.**

```js
/* Task 37: фокус — делегированное hover:focus. Lampa шлёт его jQuery-
   триггером на карточке (Controller.focus → $(elem).trigger('hover:focus')),
   и оно всплывает до корня активности. Прежний MutationObserver на всех
   class-мутациях поддерева срабатывал на КАЖДОЕ снятие/постановку .focus
   по всей коллекции (~37 записей на нажатие) и на card--loaded — тот
   второй раз перезапускал таймеры акцента и трейлера. */
function observe(root) {
  root.on('hover:focus.lumenHero', '.card', function () {
    if (state && state.focused === this) return;   // повтор на той же карточке — ничего
    onFocus(this);
  });
}
function unobserve(root) { root.off('hover:focus.lumenHero'); }
```

`state.focused = el` ставится в `onFocus`. Проверь живьём на стенде, что событие доходит до корня (`$('.activity--active').on('hover:focus', '.card', ...)` — консоль). Если Lampa шлёт его через `Lampa.Listener`/без всплытия — используй `Lampa.Listener.follow('hover', ...)`? Такого нет; тогда `document`-уровневый capture как для `hover:long` в `63_cardmenu.js` — посмотри, как там сделано, и повтори.

`rememberFocus(el, card)`: сохранять `{ id, poster, node: el }` и НЕ мерить. `LC.transition.open(object)`: `var rect = last.node.getBoundingClientRect()` — здесь чтение лейаута допустимо (одно, на открытие карточки). `scheduleBigPoster` — оставить.

Начальный фокус при монтировании (`initialFocus`, «Карточка, которая уже в фокусе на момент монтирования») — оставить как есть.

- [ ] **Step 4: Тесты зелёные. Живая проверка**: листание ряда — `performance.now()` вокруг обработчика ≤ 2 мс; `window.lumen_card.hero` → observer отсутствует.

- [ ] **Step 5: Commit** `perf: фокус героя через делегирование, без MutationObserver и замеров лейаута (Task 37)`.

### Task 38: Тени, маски, blur, `backdrop-filter`

**Files:**
- Modify: `src/30_css.js`
- Modify: `src/48_hero.js` (`:847` — постер для размытого фона), `src/50_backdrops.js:57`
- Test: `test/css.test.mjs`

- [ ] **Step 1: Тесты:**

```js
test('css: box-shadow нигде не входит в transition', () => { assert.doesNotMatch(css, /transition:[^;}]*box-shadow/); });
test('css: ни одного box-shadow с размытием больше .8em', () => {
  const re = /box-shadow:[^;}]*?\s(\d*\.?\d+)em\s+rgba/g; let m;
  while ((m = re.exec(css))) assert.ok(parseFloat(m[1]) <= 0.8, m[0]);
});
test('css: backdrop-filter отсутствует во всех режимах', () => { assert.doesNotMatch(css, /backdrop-filter/); });
test('css: filter:blur отсутствует', () => { assert.doesNotMatch(css, /filter:blur/); });
test('css: маска на движущейся области рядов снята', () => { assert.doesNotMatch(css, /\.lumen-main \.scroll\.layer--wheight\{[^}]*mask-image/); });
test('css: плитки хаба без теней у постеров', () => { assert.doesNotMatch(css, /\.lumen-tile__poster\{[^}]*box-shadow/); });
```

Старые тесты на `.lumen-bg--blur` с `blur(1.75em)`, на `backdrop-filter` кнопок — переписать (см. Step 3).

- [ ] **Step 2: Прогнать — падают.**

- [ ] **Step 3: Реализация.**
  1. Все `transition` со списком `... box-shadow .28s` — убрать `box-shadow` из списка (12 правил, см. аудит A). Тень фокуса становится статичной: появляется вместе с классом `.focus`.
  2. Радиусы теней фокуса: `1.754em`/`1.97em`/`1.53em` → `.7em`, смещение `.35em`. Постер карточки `:638` `2.63em` → `.8em`.
  3. `backdrop-filter` (`P.blur`, `P.blurWide`, `:174-177`) — убрать из палитры; `glass` везде = `P.glassLite` (полупрозрачный фон без размытия). Правила `:1339-1341` (гашение в lite/off) — удалить как мёртвые.
  4. `filter: blur(1.75em)` (`:621`, `:1560`) — заменить «естественным» размытием: для фона без кадра грузить постер в `w92` и растягивать `cover` (апскейл 92 → 1920 даёт мягкое мыло без фильтра). В `48_hero.js:847`: `blur ? 'w92' : sizeFor(...)`; в `50_backdrops.js:57`: `'w92'`. Класс `.lumen-bg--blur`/`.lumen-hero--blur` оставить — по нему `transform:scale(1.1)` (края) и затемнение.
  5. Маска `:1841-1842` на `.scroll.layer--wheight` — убрать; вместо неё статичный оверлей: `.lumen-main .lumen-rows-fade{position:absolute;left:0;right:0;bottom:0;height:3em;pointer-events:none;background:linear-gradient(0deg, P.bg 0%, rgba(P.bgRgb,0) 100%)}` — узел добавляет `LC.hero.mount` в корень активности. Если Lampa сама вешает маску (`app.css:2781` `.scroll--mask`) — наш `mask:true` в опциях Scroll для главной не наш (это Lampa main); тогда просто снять нашу переопределяющую маску.
  6. Тени коллажа `:1443` — удалить (плитки переделываются в Task 41; тени снять сейчас).
  7. Ken Burns `:1348`, зум заставки `:2108` и кроссфейд двух кадров героя `:1556` — оставить, но под гейтом `body.lumen-fx-heavy` (Task 40): без него второй полноэкранный слой `.lumen-hero__bg` не нужен вовсе — кадр подменяется в одном слое мгновенно (проверь `48_hero.js` `loadFrame`: при выключенном `fxHeavy()` писать в один узел).

- [ ] **Step 4: Тесты зелёные, живая проверка** карточки: кнопки без размытия читаются на светлом кадре (скриншот), фон-постер без кадра — мягкое мыло из `w92`.

- [ ] **Step 5: Commit** `perf: тени вне transition, без backdrop-filter и filter:blur, маска рядов снята (Task 38)`.

### Task 39: Размеры картинок по DPR, `decoding=async`

**Files:**
- Create helper в `src/10_util.js`: `LC.util.screenPx()` → `Math.round(innerWidth * Math.min(devicePixelRatio || 1, 2))`
- Modify: `src/48_hero.js:297-305` (`sizeFor`, `logoSizeFor` → через `screenPx()`), `src/46_hub.js:544, 971`, `src/56_roulette.js:647, 679`, `src/54_ambient.js:202` (перейти на общий helper), `src/50_backdrops.js:43, 316`
- Test: `test/util.test.mjs`, `test/hero.test.mjs`

- [ ] **Step 1: Тесты:**

```js
test('util.screenPx: 1920@1 → 1920, 1920@2 → 3840, DPR 3 ограничен 2', ...);
test('util.screenPx: 960@2 → 1920 (Android TV WebView в половинном HD) — постеры w342, кадр w1280, не w185/w780', ...);
test('hero.sizeFor: 1920 → w1280, 3840 → original', ...);       // уже есть — проверить, что вызывается с screenPx()
test('hub: постер карточки сетки — w342 при 1920@1, w500 при 1920@2', ...);
test('backdrops: кадр — w1280 при ≤1920, original выше', ...);
```

- [ ] **Step 2-3: Реализация.** Один helper, все места через него. Постеры карточек рядов (`w300` зашит в Lampa) — при `screenPx() > 2400` после отрисовки ряда заменить `/w300/` → `/w500/` в `src` у `.card__img` наших рядов (`44_rows.js`, там, где ряд получает `results` — посмотри, есть ли хук после рендера; если нет — сделать в `62_badges.decorate`, он уже обходит каждую карточку); при DPR 1 не трогать.

`<img>` в наших модулях (сетка `bindPoster`, барабан, заставка если `<img>`) — `img.decoding = 'async'` до `src`.

- [ ] **Step 4: Тесты зелёные. Commit** `perf: размеры TMDB по DPR, decoding=async (Task 39)`.

### Task 40: Режим тяжёлых эффектов и автодетект на главной/хабе

Частицы, Ken Burns, зум заставки, слайдшоу карточки, автотрейлер — «украшения», которые на ТВ стоят кадров. Отдельный тумблер, по умолчанию выключен на ТВ-платформах.

**Files:**
- Modify: `src/81_prefs.js` — `{ name: 'lumen_fx_heavy', type: 'trigger', 'default': <по платформе> }` в группе «Движение», после `lumen_motion`; `LC.fxHeavy()` — `true`, только если настройка включена И `motionMode() === 'full'`
- Modify: `src/52_fx.js` `allowedNow`, `src/54_ambient.js` (зум), `src/51_slideshow.js` (интервал: при выключенном — без смены кадров), `src/48_hero.js` `trailerAllowed`, `src/30_css.js` (`body.lumen-fx-heavy` гейт для `lumen-kb` и `lumen-amb-zoom`)
- Modify: `src/90_runtime.js` `applyMotionMode` — класс `lumen-fx-heavy` на `body`
- Modify: `src/68_perf.js` `shouldMeasure`: мерить и на Android (Lampa.Platform.is('android')), первый кадр `main` и `lumen_hub` тоже (не только `full`); пороги оставить 400/250 до калибровки по HUD
- Modify: `src/80_settings.js` — строки; `docs/tv-checklist.md` — пункт про HUD и тумблер
- Test: `test/prefs.test.mjs`, `test/fx.test.mjs`, `test/perf.test.mjs`

- [ ] **Step 1: Тесты:** default по платформе (`android/tizen/webos` → false, иначе true); `fxHeavy()` false при `lite`; частицы, Ken Burns (`lumen-kb`), зум заставки и кроссфейд двух полноэкранных кадров героя (`.lumen-hero__bg` `transition: opacity`) не включаются при `fxHeavy() === false` — без тумблера кадр меняется мгновенно; `shouldMeasure` true на android при `auto`; замер регистрируется на `activity start` компонента `main`; **совсем слабое железо без замеров**: `LC.perf.weakHardware()` → `true`, если на платформе android `navigator.hardwareConcurrency <= 2` ИЛИ (`navigator.deviceMemory` задан и `<= 1`) — тогда `motionModeFor('auto', …)` даёт `lite` сразу, не дожидаясь трёх замеров. Четырёхъядерный ТВ пользователя (PUS8057) под это правило НЕ попадает — там решает замер: после T36-T38 `full` состоит только из transform/opacity и должен тянуть. `deviceMemory` `undefined` → не учитывать (не считать нулём).

- [ ] **Step 2-4:** реализация, тесты, коммит `feat: тумблер тяжёлых эффектов, автодетект на главной и хабе (Task 40)`.

---

## Волна 3 — дизайн: Apple TV+/Netflix

Принципы (см. обсуждение с пользователем 2026-09-18): один шрифт, иерархия — вес и прозрачность (100/60/40 %); никаких рамок; фокус = `scale` + мягкая тень; на постере — ничего; много воздуха; кромок нет. Все размеры — с дивана: подписи ≥ 1em (23 px) при `lumen_scale` normal, заголовки рядов 1.5em.

### Task 41: Хаб — баннерные плитки и сегмент-контрол

**Files:**
- Modify: `src/46_hub.js` — `tileNode` (≈`:612`), `paintCollage`/`loadCollage` (≈`:538-580`) → `paintBanner`/`loadBanner`; `COLLAGE_EAGER` → `BANNER_AHEAD = 8` (окно вокруг фокуса, как `POSTER_AHEAD` в сетке)
- Modify: `src/43_sources.js` — `collagePaths(item, count, ...)` → добавить `bannerPath(item, ok, err, alive)`: первый `backdrop_path` из первой страницы (для КП — постер первого); `collagePaths` оставить (его зовёт что-то ещё? grep; если нет — удалить)
- Modify: `src/30_css.js` — блок хаба `:1412-1497`
- Test: `test/hub.test.mjs`, `test/sources.test.mjs`, `test/css.test.mjs`

- [ ] **Step 1: Тесты:** `bannerPath` возвращает `backdrop_path` первой карточки с кадром; плитка содержит один `<img class="lumen-tile__img" decoding="async">`, а не три `.lumen-tile__poster`; баннеры грузятся в окне ±8 от фокуса; CSS: `.lumen-tile` без `border`, фокус — `scale(1.05)` + тень `.7em`; `.lumen-chip` без `border` в покое, `.lumen-chip--on` — светлая подложка.

- [ ] **Step 2-3: Реализация.** Плитка:

```js
var node = $(
  '<div class="lumen-tile selector">' +
    '<div class="lumen-tile__media"></div>' +
    '<div class="lumen-tile__scrim"></div>' +
    season +
    '<div class="lumen-tile__text">' +
      '<div class="lumen-tile__title">' + esc(item.title) + '</div>' +
      '<div class="lumen-tile__sub">' + esc(sub) + '</div>' +
    '</div>' +
  '</div>'
);
```

`paintBanner(node, path)`: `var img = document.createElement('img'); img.className = 'lumen-tile__img'; img.decoding = 'async'; img.onload = function(){ $(node).addClass('lumen-tile--filled'); }; img.src = imageUrl(path, 'w780'); media.appendChild(img)`. CSS: `.lumen-tile__img{position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;object-position:center 30%;opacity:0;transition:opacity .25s}` `.lumen-tile--filled .lumen-tile__img{opacity:1}`; `.lumen-tile{border:0;border-radius:.6em;background:P.panel}`; `.lumen-tile.focus{transform:scale(1.05);box-shadow:0 .35em .7em rgba(0,0,0,.45)}`; scrim: `linear-gradient(0deg, rgba(bg,.9) 0%, rgba(bg,.35) 45%, rgba(bg,0) 100%)`; заголовок плитки `1.15em`, одна строка `white-space:nowrap; text-overflow:ellipsis`, подпись `.85em` muted.

Вкладки: `.lumen-hub__chips` → сегмент-контрол: `.lumen-chip{border:0;background:transparent;color:P.muted;height:2.2em;padding:0 1em;border-radius:1.1em}`; `.lumen-chip--on{background:rgba(textRgb,.14);color:P.text}`; `.lumen-chip.focus{background:P.text;color:P.bg}`; счётчик `.lumen-chip__count` — убрать из разметки (оставить только в заголовке «148 подборок»). Поиск — тот же стиль чипа с иконкой лупы, справа.

`.lumen-hub__title` → `2.1em`, weight 700, без моно-счётчика: `.lumen-hub__count{font-family:FB;font-size:1em;color:P.muted}`.

- [ ] **Step 4: Тесты зелёные, живая проверка** (скриншот хаба «Франшизы» и «Темы»), `document.querySelectorAll('.lumen-tile img').length ≤ 17` сразу после открытия.

- [ ] **Step 5: Commit** `design: хаб — баннерные плитки, сегмент-контрол, без рамок (Task 41)`.

### Task 42: Карточки рядов — без рамок и бейджей, подпись «год · ★ рейтинг»

**Files:**
- Modify: `src/30_css.js` — блок рядов `:1934-1995`, метки `:1976-1990`
- Modify: `src/62_badges.js` — `decorate`: метки только `progress` (полоска) и текстовые `soon/new/continue` мелким pill в левом нижнем углу; рейтинг → в `.card__age`
- Test: `test/css.test.mjs`, `test/badges.test.mjs`

- [ ] **Step 1: Тесты:** CSS: `.lumen-main .card.focus .card__view:after{border:0}` (или `display:none`), `.lumen-main .card.focus .card__view{transform:scale(1.08)}`, `.lumen-main .card__vote{display:none}`; `decorate` дописывает в `.card__age` текст `2017 · ★ 6.4` при наличии `vote_average ≥ 1`; без рейтинга — только год.

- [ ] **Step 2-3: Реализация.** CSS:

```js
css.push('.lumen-main .card__view{margin-bottom:.6em;border-radius:.6em;overflow:hidden;-webkit-transform:scale(1);transform:scale(1);-webkit-transform-origin:center bottom;transform-origin:center bottom}');
css.push('.lumen-main .card.focus .card__view:after,.lumen-main .card.hover .card__view:after{display:none}');
css.push('.lumen-main .card.focus .card__view{-webkit-transform:scale(1.08);transform:scale(1.08);-webkit-box-shadow:0 .5em .8em rgba(0,0,0,.5);box-shadow:0 .5em .8em rgba(0,0,0,.5)}');
css.push('body.lumen-motion-full .lumen-main .card__view{-webkit-transition:-webkit-transform .18s ease-out;transition:transform .18s ease-out}');
css.push('.lumen-main .card__vote,.lumen-main .card__quality{display:none}');
css.push('.lumen-main .card__title{font-family:' + FB + ';font-weight:600;font-size:1em;line-height:1.2;color:' + P.muted + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
css.push('.lumen-main .card.focus .card__title{color:' + P.text + '}');
css.push('.lumen-main .card__age{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.2;margin-top:.15em;color:' + P.smoke + '}');
css.push('.lumen-main .items-line__title{font-family:' + FB + ';font-weight:700;font-size:1.5em;letter-spacing:-.01em}');
```

Lampa при `body.advanced--animation` вешает на `.card.focus` свои keyframes — погасить `animation:none !important` внутри `.lumen-main`. `.card{will-change:transform}` Lampa — оставить (это как раз для scale).

`62_badges.js`: в `decorate` — `var age = $(el).find('.card__age'); var v = Number(card.vote_average); if (v >= 1 && age.length && !age[0].lumen_rated) { age[0].lumen_rated = 1; age.text(age.text() + ' · ★ ' + v.toFixed(1)); }`. Метки-кружки с рейтингом (если `badgeFor` такие даёт) — убрать.

- [ ] **Step 4: Тесты зелёные, скриншот ряда. Commit** `design: карточки рядов без рамок и бейджей, рейтинг в подписи (Task 42)`.

### Task 43: Типографика и элементы — один шрифт, без моно и рамок

**Files:**
- Modify: `src/30_css.js` — `FONT_SETS` (без `mono`), `FONT_DISPLAY_ON` = стек body (Unbounded убрать), `LC.fontsUrl` (без Unbounded/JetBrains, веса `400;500;600;700`), все `FM` → `FB`, все `border` у чипов/рейтинга/меты/статуса/кнопок → `0`, фон чипов/кнопок `rgba(textRgb,.12)`, фокус — `P.text` на `P.bg` (инверсия, как в tvOS); `.lumen-hero__rate` — без рамки, в строке меты: «★ 6.5»; `.lumen-hero__meta` — `FB`, `1em`, `P.muted`, `letter-spacing:0`; `.lumen-hero__title` (когда нет логотипа) — `3.4em`, weight 700, обычный регистр; `.full-start-new__title` карточки `3.86em/800` → `3.2em/700`, `letter-spacing:-.02em`
- Modify: `src/48_hero.js` `render` — рейтинг в `meta.join(' · ')` последним элементом `'★ ' + rating`, узел `.lumen-hero__rate` — `display:none` всегда (или удалить с обновлением тестов)
- Modify: `src/80_settings.js` — описание `lumen_font` («Шрифт интерфейса»), значения без «пары»
- Test: `test/css.test.mjs`

- [ ] **Step 1: Тесты:** `css` не содержит `Unbounded`, `JetBrains`, `Plex Mono`, `Consolas` вне `.lumen-hud`; `LC.fontsUrl()` содержит ровно одно `family=`; `.lumen-hero__meta` без `letter-spacing:.03em`; ни одного `border:.04em solid` у `.lumen-chip`, `.lumen-hero__rate`, `.lumen-roulette__chip`, `.lumen-roulette__tab`, `.lumen-next-chip`, `.lumen-quality-chip`.

- [ ] **Step 2-3: Реализация** по списку. Кнопки карточки (`.full-start__button`) — оставить как есть по геометрии (инвариант хэшей), только фон `rgba(textRgb,.12)`, без рамки, фокус — инверсия.

- [ ] **Step 4: Тесты зелёные, скриншоты главной и карточки. Commit** `design: единая типографика, без моно и рамок (Task 43)`.

### Task 44: Рулетка — спокойный экран и переход в кадр

**Files:**
- Modify: `src/67_transition.js` — публичный `reveal(source, opts)`: `source = { rect, poster, big }`, `opts.then` — колбэк после того, как слой закрыл экран; слой не снимается таймером, а остаётся до `stop()`; `open(object)` — как раньше
- Modify: `src/56_roulette.js` — разметка/логика: без `bg` до результата; результат: `reveal` с прямоугольником барабана и `backdrop` w1280 как `big` → по завершении — карточка результата (`.lumen-roulette__result`) появляется внизу слева поверх кадра (как текст героя), фон под ней — тот же `.lumen-roulette__bg` с кадром, но `opacity:1` и градиент-вуаль как у героя; «Крутить ещё» — `stop()` + очистка
- Modify: `src/30_css.js` — блок рулетки: заголовок и медиа-переключатель как сегмент; фильтры — сегмент; чипы подборок — ОДНА горизонтальная строка с `overflow:hidden` и прокруткой через `transform` (Lampa `Scroll({horizontal:true})`) — не «в кучу»; барабан по центру: `18em × 27em`, кнопка «Крутить» под ним pill `P.text`/`P.bg`, подсказка под кнопкой muted
- Test: `test/transition.test.mjs`, `test/roulette.test.mjs`, `test/css.test.mjs`

- [ ] **Step 1: Тесты:** `reveal` показывает слой из переданного `rect` без обращения к `LC.hero`; `reveal` вызывает `opts.then` после `transitionend`; рулетка: до результата `.lumen-roulette__bg` пуст; после результата — `reveal` вызван с rect барабана; «ещё» → `LC.transition.stop()`.

- [ ] **Step 2-3: Реализация.** `reveal`:

```js
/* Task 44: тот же слой, что у перехода «постер → кадр», но по явному
   источнику и без автоснятия: рулетка показывает выпавший фильм на весь
   экран и держит его, пока пользователь не нажмёт «ещё» или не откроет
   карточку (тогда open() снимет слой своим stop()). */
function reveal(source, opts) {
  if (motion() === 'off') return false;
  if (!source || !source.rect || !source.poster) return false;
  var ok = show(source);
  if (!ok) return false;
  state.hold = true;                       // снимать только через stop()
  if (opts && typeof opts.then === 'function') {
    var live = state;
    state.img.one('transitionend', function () { if (state === live) opts.then(); });
    setTimeout(function () { if (state === live && !live.done) { live.done = true; opts.then(); } }, DURATION + 100);
  }
  return true;
}
```

В `show()` — таймер автоснятия («слой живёт максимум 700 мс») ставить только если `!state.hold` (переставь: hold выставляется до планирования таймера — передавай флаг в `show(source, hold)`).

Рулетка: барабан в фокусе → `spin()` → `runReel` → `showResult(card)`: `var rect = reelBox[0].getBoundingClientRect(); LC.transition.reveal({ rect: rect, poster: posterUrl(card, 'w342'), big: imageUrl(card.backdrop_path || card.poster_path, 'w1280') }, { then: function(){ paintResultOverKadr(card); } })`. `paintResultOverKadr` — ставит `bg` с тем же `big` и `opacity:1`, добавляет вуаль, показывает `.lumen-roulette__result` (title 2.4em, meta, три кнопки-pill) внизу слева, скрывает барабан/чипы (`opacity:0`, чтобы не мерцало), `recollect` на первую кнопку. «Ещё» → `LC.transition.stop()`, `bg` пуст, всё обратно, `spin()`.

- [ ] **Step 4: Тесты зелёные, живая проверка** (скриншоты до/после «Крутить»). **Commit** `design: рулетка — спокойный экран, результат открывается кадром (Task 44)`.

---

## Волна 4 — телевизор

### Task 45: Проверка на ТВ, калибровка, чек-лист

**Files:**
- Modify: `docs/tv-checklist.md` — шаги: включить HUD; записать строку HUD на главной в покое, при листании ряда, при переходе на второй ряд, в хабе «Франшизы», в сетке, в рулетке; включить «Тяжёлые эффекты» и повторить; выключить; отметить, где `fps < 45`
- Modify: `src/68_perf.js` — пороги по результатам (если на ТВ пользователя первый кадр главной ≥ 400 мс при плавном 50+ fps — порог поднять до 600)
- Modify: `README.md` — раздел «Проверка на телевизоре»

- [ ] Пользователь присылает фото HUD + впечатления → калибровка → commit `chore: калибровка порогов и чек-лист ТВ (Task 45)`.

---

## Приложение А: факты, проверенные координатором живьём (2026-09-18, стенд `vendor/lampa`, 1920×1080, DPR 1)

Исполнителям Task 32-33 перепроверять не нужно — цифры сняты на живой Lampa с загруженным плагином.

**Диагноз Task 32 подтверждён полностью.** На экране `lumen_hub` (34 плитки, 42 селектора):
- `.lumen-hub` лежит в `.scroll.scroll--mask.scroll--over` — **класса `layer--wheight` нет**, инлайновой высоты нет;
- высота контейнера **2824 px** при `innerHeight` 1080, высота `.scroll__body` — 2710 px (контейнер растянут по содержимому, диапазона прокрутки нет);
- шесть нажатий «вниз» двигают фокус исправно (`top` плитки: 398 → 663 → 927 → 1191 → 1456 → 1720), но у `.scroll__body` `transform: none` — экран не сдвинулся ни на пиксель. Уже на четвёртом шаге плитка за нижней кромкой.

Вывод: сломаны обе половины — и высота контейнера (`scroll.minus()`), и подкрутка к фокусу (`scroll.update()`). Navigator при этом исправен, чинить его не нужно.

**Контракты Lampa (проверены в `vendor/lampa/app.min.js` и живьём):**
- `scroll.minus()` **без аргумента** — то, что нужно: `mheight` остаётся `undefined`, и `Layer.update` (`app.min.js:31684-31695`) ставит `height = innerHeight − head_height − navi_height`. С аргументом вычиталась бы ещё высота переданного узла.
- `scroll.update(elem, tocenter)` (`app.min.js:32130`) — плавная подкрутка через `startScroll`; `scroll.immediate(elem, tocenter)` — то же без анимации. Для ТВ берём `update` (движение идёт через `translate3d`, композитное).

**Допущения Task 33 подтверждены живьём:**
- `Navigator.canmove(dir)` возвращает **DOM-элемент** будущего соседа (проверено: вернул `lumen-tile selector`), а не boolean. Значит второй проход `move(dir)` действительно лишний.
- `Navigator.focus` существует, ставит классу `focus` и **шлёт элементу `hover:focus`** (проверено подпиской на конкретной плитке). Поэтому `navMove` можно переписать на `canmove` + `focus(next)` без потери события, на котором висит вся логика подгрузки.

**Базовый замер навигации ДО оптимизации** (стенд, ПК): 42 селектора хаба → медиана **1.2 мс** на нажатие (min 0.9, max 1.9). Это точка отсчёта для Task 33; на MT5806 те же проходы дороже в 15-30 раз, а в сетке селекторов до 300.

**Ограничение стенда, важное для всей фазы:** `requestAnimationFrame` в Browser pane **не тикает вовсе** — собственный пробник получил 1 кадр за 3 с при `visibilityState === 'visible'` и вкладке на переднем плане. Любая живая проверка FPS, анимаций и rAF-циклов на стенде недостоверна. Проверять ЛОГИКУ цикла — подменой `window.requestAnimationFrame` на `setTimeout(cb(performance.now()), 16)` с возвратом оригинала после. Настоящие кадры — только с телевизора пользователя через HUD.

**Как поднять стенд** (для живых проверок): `export PATH="$PATH:/c/Users/azark/AppData/Local/Programs/nodejs"`; сервер — конфигурация `lumen-static` (порт 8766); `http://localhost:8766/vendor/lampa/index.html`; стартует на выборе языка — `$('.lang__selector-item').eq(0).trigger('hover:enter')`; плагин — `fetch('/dist/lumen_card.js').then(r=>r.text())` и `<script textContent>` в `head`.

## Самопроверка плана (выполнена координатором 2026-09-18)

- Все шесть пунктов пользователя + два дополнительных покрыты: (1) герой 2/3 — T36; (2) постеры крупнее и центрирование — T36 (260 px, `center 30%`), T41; (3) тормоза — T33, T36-T40; (4) пиксельность — T39, T42 (`scale` на композитном слое с `will-change` Lampa); (5) хаб не листается — T32, T33; (6) рулетка — T34, T44; подкраска — T35; «переход плавнее» — T36 (градиент), T35 (низ градиента в цвет подложки).
- Дизайн-предложения (одобрены пользователем: «давай ебашить»): чипы в герое → T36; без рамок/бейджей/моно → T42, T43; баннеры и сегмент-контрол → T41; рулетка → T44.
- Имена, введённые планом и используемые в нескольких задачах: `LC.util.screenPx()` (T39, T41), `LC.fxHeavy()` (T40, T38), `LC.transition.reveal(source, opts)` (T44), `limitCollection(nodes, active)` (T33), `keepVisible(el)` (T32), `<style id="lumen-accent">` (T35), классы `.lumen-hero__moods` (T36), `.lumen-tile__media/__img` (T41), `.lumen-rows-fade` (T38).
- Долги, сознательно не вошедшие: виртуализация рядов главной (±1 ряд в DOM) — после замеров на ТВ; отложенная загрузка постеров при key-repeat — если HUD покажет `long > 0` при листании; `lumen_rows_limit` default 15 → 10 — по решению пользователя.

---

## Ход выполнения (координатор, 2026-09-18)

| Задача | Статус | Коммиты | Живая проверка |
|---|---|---|---|
| 31 · HUD отладки | **ВЫПОЛНЕНО** | `af6f676`, `8be945e`, `36a01f8` | Строка `61 fps · 1920×1080@1 · full · long 0 · layers 5`; выключение снимает узел и цикл. Ревью нашло баг: при отсутствии `performance.now` HUD не обновлялся бы никогда (смешение шкал rAF и `Date.now`) — исправлено, первый кадр стал опорным; fps теперь считается делением на фактический интервал. |
| 32 · Прокрутка хаба/сетки/рулетки | **ВЫПОЛНЕНО** | `93fadac`, `4ca2565` | До: `.scroll` без `layer--wheight`, высота 2824 px при экране 1080, `scroll__body` `transform: none`. После: высота 993 px, тело едет −198…−1784 за 8 шагов, фокус после анимации на 458 px. Сетка и рулетка — так же. |
| 33 · Окно коллекции и один navigate | **ВЫПОЛНЕНО** | `88a5d3d`, `5a8d336` | Синтетика на 300 узлах: было 0.8 мс (`canmove`+`move`), стало 0.2 мс с окном 72 — **−75%**. Хаб (42 узла): 1.2 → 1.6 (регресс от холостой пересборки) → **1.1** мс после кэша окна. |
| 34 · Рулетка: фон только у результата | **ВЫПОЛНЕНО** | `b7472bb`, `db9e386` | Исполнитель нашёл гонку сверх задачи: при повторном «Крутить» поздний `onload` прошлого фильма подставлял чужой кадр. Ревью нашло ещё одну: фон не переживал `stop()`→`start()` — закрыто `loadResultBg` + перезапуск в `start()`. |
| 35 · Подкраска от карточки | **ВЫПОЛНЕНО** | `0947581`, `033210a` | Включена по умолчанию; смена цвета пишет **822 байта** в `<style id="lumen-accent">` вместо пересборки **103 КБ** таблицы. В узле пять правил: подложка, обе вуали героя, кольцо фокуса карточки, чип настроения — иначе фон ехал бы, а кольцо застывало. Потолок повторов при устойчивом отказе — 3 попытки на URL. |
| 36 · Герой 2/3 → 1/2 на transform | **ВЫПОЛНЕНО** | `3bb4ce2`, `28485b4` | Старт: низ героя **720** (2/3), заголовок ряда 667, постер 718…1108. Сжатый: низ **540** (1/2), заголовок 581, постер **631…1021**, подписи до 1083. `transitionProperty === "transform"`. Кадр `50% 30%` — по лицам. Чипы гаснут. Мета в сжатом возвращена (просьба пользователя из фазы 3). Пустота под текстом 125 → 24 px. Смена размера героя на живой главной: чипы переезжают в обе стороны, дублей нет. |

**Ошибки плана, найденные исполнителями (план писал координатор):**
- Task 31: `test/_fakedom.mjs` не экспортирует `makeDom` — тест переписан под нативный DOM.
- Task 31: селектор `layers()` недосчитывал 4-6 полноэкранных слоёв карточки — расширен до 11 классов.
- Task 33: утверждение «Lampa не рисует узлы без `layer--render`» **неверно** — в `vendor/lampa/css/` правил под этот класс нет вовсе; экономию даёт только окно навигации.
- Task 36: план забыл `padding: 2.5em 0` у `.scroll--mask .scroll__content` (`app.css:2787`) — по плановой формуле заголовок первого ряда встал бы на 717.6 px вместо 660. Высота области рядов была завышена на 1.5em.
- Task 36: `TEXT_BOTTOM_VH`/`TEXT_SHIFT_VH` как константы оставляли бы 2.67vh пустоты при `medium` и 5.67vh при `compact` — сделаны вычисляемыми.

**Урок координации:** параллельных исполнителей по этому репозиторию запускать нельзя — два агента конфликтуют через `dist/lumen_card.js` и через git-операции (коммит одного дважды откатывал незакоммиченные правки другого). Дальше — строго последовательно.

### Волна 2 — закрыта (2026-09-18)

| Задача | Коммиты | Итог |
|---|---|---|
| 36 · Герой 2/3→1/2 на transform | `3bb4ce2`, `28485b4` | Старт 720 px (2/3), сжатый 540 (1/2), `transition` только `transform`; кадр `50% 30%`; мета в сжатом возвращена; пустота под текстом 125→24 px; смена размера героя на живой главной больше не ломает чипы |
| 37 · Фокус без MutationObserver | `7df2720`, `6459544` | Наблюдатель за ~37 мутациями класса на нажатие заменён capture-слушателем (`hover:focus` имеет `bubbles:false` — делегирование не работает); `getBoundingClientRect` убран из горячего пути, прямоугольник снимается при открытии карточки. Ревью поймало регрессию: `showFocused` не заводил источник перехода — переход после возврата из карточки не показывался |
| 38 · Тени, blur, маски | `a01fb6f`, `f645588` | 7 анимаций теней → 0; 29 теней >0.8em → 0; 12 `backdrop-filter` → 0; 10 `filter:blur` → 0 (размытие даёт апскейл `w92`); маска на движущейся области рядов заменена двумя статическими градиентами |
| 39 · Размеры по физическим пикселям | `cb261c9`, `b38425a` | `LC.util.screenPx/emPx/posterSize/frameSize/scrimSize/baseEm`; единый допуск апскейла 0.85 для всех картинок; `decoding='async'`. Ревью поймало: первая версия увела кадр героя с `original` на `w1280` (1.5× апскейл — против цели фазы), рамка логотипа считалась на 10 % меньше (не учитывался `TEXT_ZOOM`), база `em` не учитывала `interface_size` Lampa и `lumen_scale` плагина |
| 40 · Тумблер тяжёлых эффектов | `b83f4d4`, `9f56be6` | `lumen_fx_heavy` (на ТВ выключен по умолчанию) гейтит частицы, Ken Burns, зум заставки, слайдшоу, автотрейлер, кроссфейд кадров героя; автодетект расширен на главную и хаб (с главной — не больше одного замера за запуск); `weakHardware()`; HUD показывает ядра и память |

**Долги, записанные по ходу волны 2:**
- Режим «Герой: выключен» остаётся со штатной маской Lampa на движущейся области (класс `lumen-main` там не ставится вовсе).
- Горизонтальные маски рядов (`.scroll--horizontal.scroll--mask`, `app.css:2798`) — по одной на каждый ряд, тоже на движущихся слоях.
- `lumen_scale` не действует на текст и логотип героя: правило `SCALE_ROOTS{font-size}` (`30_css.js:605`) и `.lumen-hero .lumen-hero__text{font-size:1.1em}` (`:1746`) имеют одинаковую специфичность, второе ниже по файлу.
- Пороги автодетекта 400/250 мс не откалиброваны — ждут замеров с телевизора пользователя.

---

## Состояние на конец сессии 2026-09-18

**Запушено в `feat/lumen-v2` (HEAD `9e53fa8`), jsDelivr сброшен. Тесты 1580/1580, сборка актуальна, ES5 ok.**

### Закрыто и проверено живьём на стенде
Волна 0: Task 31 (HUD). Волна 1: Task 32-35. Волна 2: Task 36-40. Волна 3: Task 42-43. Все с ревью и фикс-раундами.

**Task 42 · карточки рядов** (`47ac843` + фикс `91c46f5`). Кольцо фокуса Lampa и плашки рейтинга/качества/типа убраны, фокус = `scale(1.08)` от нижней кромки + ореол цвета фильма, рейтинг переехал в подпись («2026 · ★ 8.1»). Ревью и замеры вскрыли три дефекта: постер закрывал нижние 9 px строки заголовка своего ряда (зазор поднят до `round2(1.4 × scale)` — плоская константа чинила только «обычный» масштаб, на «огромном» дефект возвращался); фокусной карточке не хватало `z-index` (ореол уходил под соседа); выключение настройки «Метки на постерах» отнимало и рейтинг — теперь при выключенных метках возвращается штатная плашка Lampa. Замеры после фикса: просвет под заголовком +7 px, `z-index: 3`, подпись с рейтингом, дублей нет.

**Task 43 · типографика** (`e7b6327` + фикс `9e53fa8`). Одна гарнитура (`Golos Text:wght@400;500;600;700`), Unbounded и моноширинный убраны везде, кроме HUD; рамки сняты у чипов, рейтинга, статуса, кнопок; фокус кнопок = инверсия (`P.text` на `P.bg`); рейтинг героя — последним элементом строки меты, узел `.lumen-hero__rate` удалён; заголовок карточки 3.2em/700. Сверх плана: сетка подборки приведена к языку Task 42 (кольцо снято, `scale` + ореол, штатные плашки скрыты, рейтинг в подписи). Ревью вскрыло шесть дефектов, все закрыты: мёртвый блок `.lumen-hub__search` (pill из Task 41 перебивался коробкой из Task 17); непогашенные keyframes Lampa в сетке (`animation-card-focus` и `animate-trigger-enter` с `forwards`); невидимый спиннер (`filter:none` снимал штатную `invert(1)` на белом фокусе); `TEXT_RATE` — бюджет раскладки под исчезнувшую строку рейтинга (→ `TEXT_STATUS` 1.98em, оба порога медиазапросов пересчитаны: 2.08:1 → 2.14:1 и 2.58:1 → 2.68:1); мёртвые `border-left/right:0` в склейке; чипы настроения `.lumen-mood-chip` остались в рамках на главной.

### Закрыто, но НЕ проверено живьём и НЕ прошло ревью
- **Task 41 · хаб баннерами** (`3bb0acf`). Плитка = один кадр 16:9 вместо трёх повёрнутых постеров; картинок на экране 9 вместо 24; чипы групп → сегмент-контрол без рамок; `collagePaths` и `LC.hub.collage` удалены как мёртвые. Исполнитель отступил от задачи в четырёх местах, каждое обосновал: своя `bannerSize()` (`w780`/`w300`) вместо `posterSize`/`frameSize`; поиск оставлен с подписью, а не голой иконкой; сегмент-контролом стали и чипы сортировки сетки (общее правило с хабом); добавлен `outline` акцентом для фокуса плитки в режимах lite/off (иначе там фокус пропадал бы совсем — `transform` выключен, а тень на чёрном не видна).
  **Что проверить:** не мыло ли `w780` на 4K; не слишком ли тёмный scrim; попадает ли `object-position: center 30%` по лицам, когда подборка отдала постер вместо кадра (у подборок Кинопоиска кадров в API нет вовсе); подгрузка окном при прокрутке 34 плиток; читаются ли метки `nokey` и сезонная на баннере; устраивает ли, что чипы сортировки в сетке стали такими же.
- **Task 46 · шлейф при листании** (`6c11406`). Пользователь сообщил с телевизора: «когда листаешь, остаётся шлейф некрасивый» — недорисованные полосы под нижней кромкой кадра. Причина уточнена исполнителем: слой создаётся и уничтожается на каждом листании (Blink промоутит элемент на время композитной анимации и сливает обратно), и на границе demote освобождённая полоса остаётся непомеченной; плюс `.scroll__body` Lampa держит постоянный `will-change: transform` (`app.css:2769`) внутри области, которая слоя не имела. Лечение: постоянный слой обоим движущимся элементам (`translateZ(0)` рядом с `translateY`) + `backface-visibility: hidden`. Геометрия не тронута.
  **Что спросить у пользователя:** шлейф ушёл совсем или стал слабее/реже (разница важна — «слабее» значит, причина не одна); фото того же места; не стало ли листание медленнее (плата — ~16 МБ видеопамяти на два постоянных слоя).

### Осталось
- **Task 44 · рулетка**: спокойный экран до результата, барабан по центру, результат открывается кадром через новый публичный `LC.transition.reveal(source, opts)`. Блок рулетки Task 43 тронул по минимуму (сняты рамки чипов и вкладок, фокус приведён к инверсии) — при переписывании возможен текстовый конфликт, смыслового нет.
- **Task 45 · калибровка**: пороги автодетекта 400/250 мс по замерам с телевизора; в HUD уже добавлены ядра и память (`hw 4c/2gb`).
- **Проход по инверсии фокуса.** Task 43 привёл к инверсии только кнопки карточки, чипы и сетку. Акцентной заливкой в фокусе остались: `.lumen-grid__back` (`30_css.js:1693`), `.lumen-roulette__btn` (`:2545`), `.lumen-franchise` (`:1543`), `.lumen-reviews__hint-hide` (`:1293`), `.lumen-reviews__mode` (`:1330`), `.lumen-review-modal__reveal` (`:1348`), `.lumen-fr__mode` (`:1363`), `.lumen-episode`, и весь путь до плеера — `.selectbox-item` (`65_torrents.js:116`). Разнобой реальный; делать после рулетки, одним проходом, иначе правки разъедутся.

### Долги, накопленные за фазу
- Режим «Герой: выключен» остаётся со штатной маской Lampa на движущейся области (класс `lumen-main` там не ставится).
- Горизонтальные маски рядов (`.scroll--horizontal.scroll--mask`, `app.css:2798`) — по одной на ряд, на движущихся слоях.
- `lumen_scale` не действует на текст и логотип героя: `SCALE_ROOTS{font-size}` (`30_css.js:605`) и `.lumen-hero .lumen-hero__text{font-size:1.1em}` (`:1746`) имеют одинаковую специфичность, второе ниже по файлу.
- `LC.hud.layers()` не считает два новых принудительных слоя (он считает рисующие узлы, а это контейнеры) — цифра в HUD занижена на 2.
- `test/menus_runtime.test.mjs` сверяет журналы активации полным `deepEqual` с жёстким порядком — каждая новая подсистема правит три ассерта вручную.
- **`.card{will-change:transform}` Lampa** (`app.css:3095`) выдаёт постоянный composited-слой каждой карточке ряда — на слабом ТВ это пробивает бюджет 10-15 слоёв из ресёрча независимо от нашего CSS. Снятие (`will-change:auto`) рискует вернуть шлейф из Task 46, проверить можно только на телевизоре: замерить HUD до и после.
- Переключение настройки «Метки на постерах» на уже нарисованном экране показывает рейтинг дважды до следующей отрисовки: `strip()` снимает метки и полосы, но `.card__age` не правит.

## Бэклог с телевизора — 2026-09-18, вечер (на понедельник)

Пользователь проверил `b4d20a0` на своём Philips 50PUS8057/60. Итог: **стало хуже, чем было**. Все пункты ниже — с его фото; причины помечены как гипотезы, пока не подтверждены замером.

### Б1 · Листание — 21 кадр/с (HUD)
Главная при листании проседает до 21 fps. Волны 2-3 не дали эффекта на железе, а часть правок, вероятно, его ухудшила. Прямой причины живьём не видели: rAF на стенде не тикает, так что все замеры фазы — только логика, не кадры.
Подозреваемые, по убыванию:
1. **Картинки `original`.** `frameSize()` (`src/10_util.js:212`) при 1920 физических пикселях отдаёт `original` (1920 × 0.85 = 1632 > 1280). Кадр TMDB в `original` — обычно 3840×2160: ~33 МБ в распакованном виде против ~4 МБ у `w1280`, декод на 4 слабых ядрах — сотни мс. Используется в герое (кросс-фейд держит два кадра), слое перехода и слайдшоу карточки. Это откат цели Task 39 «чистый 1080p без повторного растяжения»: выигрыш в резкости не стоит восьмикратной памяти на ТВ с ~2 ГБ.
2. **Слои.** `.card{will-change:transform}` Lampa (`app.css:3095`) — постоянный слой каждой карточке ряда, плюс два принудительных полноэкранных слоя из Task 46, плюс слои героя. Бюджет по ресёрчу — 10-15.
3. **Фокус карточки** (Task 42): `scale(1.08)` + статичный `box-shadow` ореол — при каждом шаге перерисовка двух карточек с тенью.
4. **Подкраска** на каждой остановке фокуса пишет `<style id="lumen-accent">` → пересчёт стилей всего документа.
5. Смена кадра героя на каждой остановке фокуса → загрузка и декод большой картинки.

**Порядок работы:** сначала бисекция на телевизоре, без правок кода: HUD при «Движение: Выкл», при выключенной подкраске, при выключенном герое. Для этого нужен ещё один отладочный тумблер «Качество кадров: w1280 / original», чтобы проверить п. 1 без пересборки. Чинить только то, что подтвердит замер.

### Б2 · Картинки грузятся дольше и рисуются частями с чёрными полосами
Классическая картина checkerboarding: композитор показывает кадр раньше, чем растеризованы все тайлы слоя, и нерастеризованные тайлы видны чёрными. Совпадает с Б1 п. 1-2: огромные текстуры + переполненная видеопамять → тайлы вытесняются и растеризуются заново. Проверять тем же тумблером качества кадров.

### Б3 · На главной не видны названия фильмов
Фото 2: в стартовом состоянии (герой 2/3 экрана) ряд уходит за нижнюю кромку — постеры обрезаны экраном, подписи с названием и «год · ★» целиком за экраном. Task 42 добавил ещё ~16 px (зазор заголовка ряда `.7em → 1.4em`). Раскладка Task 36 считала, что ряд «выглядывает» снизу; для пользователя это не работает — названия должны быть видны без нажатий. Варианты: уменьшить стартовую высоту героя, уменьшить карточку ряда в стартовом состоянии, или поднять ряд так, чтобы подпись помещалась на экране (пересчитать `ROWS_TOP_VH`).

### Б4 · Выпадающее меню Lampa (selectbox) — светящаяся рамка
Фото 3 (меню «Движение»: Авто / Полные / Лёгкие / Выкл): фокус пункта — белая рамка с большим размытым ореолом. Это и «колхоз», и запрещённый паттерн (крупный `box-shadow` с размытием). Текст «Полные» прилип к левой кромке рамки и срезан. Проверить источник: наш `.selectbox-item.focus` в `src/65_torrents.js` (~`:116`, под `body.lumen-torrents-on`) или штатный стиль Lampa. Привести к инверсии фокуса (тот же язык, что кнопки после Task 43), вернуть внутренний отступ слева.

### Б5 · Разрешение
Пользователь писал, что прислал HUD с разрешением и fps, но фото HUD в сообщении не было — три фото: главная издалека, главная крупно, меню. Нужна строка HUD целиком: `WxH@DPR`, fps, `hw`.

### Не жалоба, а вопрос к пользователю
Жёлтые плашки «Новинка» на постерах остались — по плану Task 42 текстовые метки `soon/new/continue` сохраняются. Спросить, оставить или убрать.

### Б6 · Кадр героя при листании сначала встаёт по центру, потом съезжает
Со слов пользователя: при листании картинка героя сначала нормально центрирована, а затем смещается. Не воспроизводилось; гипотезы, по убыванию:
1. **Два носителя кадра с разным кадрированием.** Слой перехода (`src/67_transition.js`) или временный маленький размер показывают кадр с одним `object-position`/`background-position`, затем подменяется на кадр героя с другим (в Task 39 и Task 41 встречались `center 30%` и центр). Подмена видна как сдвиг.
2. **Смена размера картинки на лету.** Сначала грузится/показывается меньший размер, потом `original` другой пропорции (у TMDB кадры бывают не строго 16:9) — при `cover` меняется точка обреза.
3. **Сжатие героя** (Task 36, `HERO_SHIFT_VH`): кадр сдвигается вместе с героем по `translateY`, и при переходе крупный → сжатый это читается как «съехал».
**Что нужно от пользователя:** в какой момент съезжает — при переходе фокуса с героя в ряд (тогда п. 3) или при смене фильма внутри ряда (тогда п. 1-2); фото «до» и «после».

### Б5 (дополнение) · HUD виден, но с фото не читается
На фото 19:51 HUD есть в левом верхнем углу, но с расстояния строка нечитаема. Нужно фото крупным планом, только верхний левый угол экрана, в покое и во время листания.

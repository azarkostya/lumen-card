# Lumen Card — фаза 1b: путь просмотра через TorrServer в едином дизайне

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Все экраны от кнопки «Смотреть» до плеера — меню источников, список раздач, подключение к TorrServer и его ошибки, список файлов и серий, загрузка перед плеером — оформлены в стиле карточки Lumen (токены, шрифты, иконки, единый фокус), при этом ни одна строка логики и разметки Lampa не изменена.

**Architecture:** Два новых модуля той же IIFE. `64_menus.js` — классификация вызовов общих компонентов (`Lampa.Select`, `Lampa.Modal`) и маркер-классы на их корнях; `65_torrents.js` — CSS экранов пути в отдельном `<style>`, включаемом по настройке, плюс маркер на активности «Торренты». Оформление — только CSS поверх штатных классов Lampa; экраны с уникальными классами (`.torrent-*`, `.explorer`, `.media-loading`) стилизуются напрямую, общие (`.selectbox`, `.modal`) — только под маркером или в режиме «все меню».

**Tech Stack:** как в фазе 1 (ES5, jQuery Lampa, `node --test`, стенд `harness/`, живая Lampa 3.3.4 на `http://localhost:8766/vendor/lampa/index.html`).

**Порядок:** исполняется сразу после Task 6 фазы 1 (раздел 5 плана фазы 1, пункт 1d): пользователь смотрит только через TorrServer, путь до плеера нужен ему к первому тесту. До Task 12–13 (ревью и публикация). Настройки `lumen_menus` / `lumen_torrents` добавляются здесь, Task 10 фазы 1 потом включает их в общий список. Блоки «Поправки контроллера» приоритетнее текста задач.

---

## 0. Контекст

### 0.1 Источники (читать в этом порядке)

| Что | Где |
|---|---|
| Разбор компонентов пути: шаблоны, CSS, хуки, данные | `docs/research/API_NOTES_5_torrents.md` |
| Живой аудит: замеры, рабочие рецепты открытия каждого экрана на моках, ловушки | `docs/research/API_NOTES_6_torrents_visual.md` (§0 — обязательно) |
| Бриф для дизайна, экраны 33–40 | `docs/design/claude-design-brief-torrents.md` |
| Экспорт дизайна (есть с 2026-09-15) | `design/Lumen Torrents for Lampa - FHD.dc.html` (главный для кода), `- 2K`, `- 4K`; экраны по комментариям `<!-- 33 ------ -->` … `<!-- 40 ------ -->` |
| Сверка экспорта с брифом, размеры px/em по классам Lampa, решения | `docs/design/design-spec-torrents.md` — источник размеров для Task 32 |
| Токены, шрифты, иконки | план фазы 1 §0.4, `src/20_icons.js` |

Экспорт экранов 33–40 принят и сверен: 5 экранов полностью по брифу (33, 35, 36, 37, 40), 3 частично (34, 38, 39 — расхождения только в числах и шрифтах, см. спецификацию). Task 32 берёт размеры из `design-spec-torrents.md`; Task 33 Step 1 — контрольная сверка результата с экспортом.

### 0.2 Факты (проверены живьём, детали в API_NOTES_6)

- **Единица размера.** Lampa задаёт `body{font-size}` формулой `max(innerWidth / 84.17 × k, 10.6px)`, `k` = 1 / 0.9 / 1.05 для настройки «Размер интерфейса» (normal / small / bigger). При 1920 px это **22.811 px**, при 3840 — 45.6 px. Все `em` плагина наследуют эту базу. Перевод из дизайна: **em = px(FHD) ÷ 22.811 = px(4K) ÷ 45.62.** Не 16.
- **Путь (12 шагов):** 1 Select «Источник» → 2 активность `torrents` (Explorer + Filter + `.torrent-item`) → 3 Select «Действие» над раздачей → 4 модал `modal_loading` → 5 `torrent_install` → 6 `torrent_error` (чеклист) → 7 `torrent_nohash` → 8 `error` (таймаут) → 9 `torrent_file` → 10 `torrent_file_serial` → 11 Select «Действие» над файлом → 12 `media-loading`. Шаги 4–12 показываются только при включённом «Встроенном клиенте» (`internal_torrclient`; на Android по умолчанию выключен). «Мои торренты» заходят в шаги 4–12 тем же кодом — оформляются заодно, это осознанно.
- **Общие компоненты.** `.selectbox` и `.modal` — синглтоны на всё приложение (никогда не удалять их из DOM; закрывать `Select.close()` / `Modal.close()`). У корней нет отличимых классов. Хуки: `Lampa.Select.listener` — `preshow {active}`, `fullshow {active, html}`, `toggle`, `hide`, `close`. `Lampa.Listener 'torrent'` — `render / onenter / onlong {element, item, menu}`; `Lampa.Listener 'torrent_file'` — `list_open / render / onenter / onlong / onfocus / list_close`. Есть ли `Lampa.Modal.listener` — проверить в Task 31 Step 1.
- **Распознавание Select-вызовов** только по содержимому `active`: источник — `title === Lang.translate('settings_rest_source')` и у пунктов есть `btn`; меню раздачи — пункты с флагами `tomy / mark / unmark`; меню файла — `timeclear / timefull / player / link`; сортировка и фильтр — вызываются из `Filter` активности `torrents` (в момент вызова `Lampa.Activity.active().component === 'torrents'`).
- **Классы-ловушки.** `.torrent-filter` вшит в конструктор общего `Filter`; `.explorer*` — миксин, подключаемый не только к торрентам; `.error` — общий блок ошибок; `.simple-button` — все пилюли приложения; `.time-line` — прогресс по всему приложению. Их оформлять только внутри скоупа пути. `.torrent-install` стоит и на корне экрана, и на `<img>` внутри него. `.torrnet-folder-name` — опечатка Lampa, писать как есть. `.torrent-list` (раздачи) ≠ `.torrent-files` (файлы).
- **Анимации фокуса Lampa.** `.simple-button.focus` (чипы фильтра, кнопка чеклиста), `.torrent-item.animate-trigger-enter` (после OK на раздаче, с `forwards`) и другие элементы пути анимируются keyframes Lampa при `body.advanced--animation`; наш `transform` на них — только с `!important`, в режимах `lite`/`off` — `animation:none !important` (подробно — план фазы 1, раздел 0.2, пункт о кнопках).
- **Живые проверки.** Кнопка «Торренты» в vendor-сборке скрыта (парсер не настроен): `$('.buttons--container').removeClass('hide'); $('.view--torrent').removeClass('hide').addClass('selector')`. OK на пульте — пара `keydown` + `keyup` с интервалом 40 мс (один `keydown` только взводит таймер долгого нажатия); стрелки — одним `keydown`. На вставленных вручную элементах `hover:long`/`hover:enter` не работают — меню вызывать `Lampa.Select.show(...)` напрямую (рецепты §2.7, §4.4 API_NOTES_6). `torrent_nohash` в `Modal.update` оборачивать в один `<div>` (баг `Element.append`). `media-loading`: любая клавиша отменяет. Перед каждым блоком проверок — `resize_window` 1920×1080 и `window.innerWidth === 1920`; в конце — preset `desktop`.

### 0.3 Инварианты фазы 1b

1. Ни одного изменения разметки, текста и обработчиков Lampa на пути: плагин добавляет только CSS и классы-маркеры на корни `.selectbox`, `.modal`, активности `torrents` и на `body`. Все хуки — только чтение и `addClass/removeClass` на корнях (не на пунктах).
2. Путь до плеера работает как без плагина: OK на раздаче → `Torrent.start`, OK на файле → плеер; «Мои торренты», настройки Lampa и любые чужие Select/Modal при режиме `path` выглядят штатно; при режиме `all` меняется только внешний вид, не поведение.
3. Чужие вставки в Select (пункты сторонних плагинов с их иконками, HTML-блоки вроде рекламы) не переопределяются: правила только на `.selectbox__head/__title/__body`, `.selectbox-item` и его `__title/__subtitle/__icon`; никаких `display:none` внутри панели.
4. Настройки применяются без перезагрузки: `<style id="lumen-torrents-css">` и класс режима на `body` переключаются в `onChange`; при выключенном плагине (`lumen_enabled = false`) или `lumen_torrents = off` в DOM нет ни одного нашего правила для пути.
5. Строгий ES5, `inset` и `:has()` не использовать (старые webview); `@supports`-фолбэки как в Task 3. Инвариант хэшей кнопок 7/7 сохраняется (Select источников строится из кнопок, мы их не трогаем).

### 0.4 Скоупинг CSS (единая схема для Task 32)

```
режим all   : body.lumen-menus-all .selectbox …      body.lumen-menus-all .modal …
режим path  : .selectbox.lumen-select …              .modal.lumen-modal …
экраны пути : body.lumen-torrents-on .lumen-torrents .explorer …   (активность «Торренты»)
              body.lumen-torrents-on .torrent-item / .torrent-files / .torrent-file / .torrent-serial /
              .torrnet-folder-name / .torrent-checklist / .torrent-install / .torrent-error / .modal-loading /
              .media-loading   (уникальные классы — маркер активности не нужен)
общий .error: только внутри .modal.lumen-modal или body.lumen-menus-all .modal
```
Генератор `scoped(sel)` в `65_torrents.js` возвращает `'body.lumen-menus-all ' + sel + ',' + sel.replace(/^\.(selectbox|modal)\b/, '.$1.lumen-$1')` — одно правило пишется один раз и работает в обоих режимах. Единицы — `em` от базы Lampa (0.2): чип 32 px из FHD-экрана = `1.4em`, кнопка 72 px = `3.16em`, радиус 18 px = `.79em`.

---

## 1. Файлы

```
src/64_menus.js        LC.menus: kind(active, activeComponent) → 'source'|'torrent'|'file'|'filter'|null (чисто);
                       install() — подписки на Select/Modal/Listener, маркеры lumen-select / lumen-modal; mode(v) — класс на body
src/65_torrents.js     LC.torrents: css() → строка правил экранов пути; scoped(sel); install() — маркер .lumen-torrents
                       на активности torrents, инжект/удаление <style id="lumen-torrents-css">
src/80_settings.js     + lumen_menus (all/path/off, default all), lumen_torrents (trigger, default true)
src/90_runtime.js      + вызовы LC.menus.install() и LC.torrents.install() в init (после injectCss)
test/menus.test.mjs    kind() на фикстурах вызовов из API_NOTES_5/6
test/torrents.test.mjs css(): скоупинг всех правил, запрет inset/:has, наличие правил на каждый экран
```

Контракт модулей — фаза 1 §1.1 (IIFE-модули, экспорт по `module.lumen`). Порядок сборки: `64`, `65` после `30_css.js` и `20_icons.js` (нужны `LC.icons.maskUrl` и токены цвета, которые `30_css.js` держит в замыкании — вынести объект токенов в `LC.tokens` в `30_css.js` одной строкой, если он ещё не наружу; тест на это добавить в `test/torrents.test.mjs`).

---

## 2. Задачи

> **Поправки контроллера по экспорту дизайна (2026-09-15, `docs/design/design-spec-torrents.md`; приоритетнее текста задач).**
> - **Иконки (Task 32, `src/20_icons.js`):** добавить две с тестом в `icons.test.mjs`: `search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>'` и `check: '<path d="M4.5 12.5l5 5L20 6.5"/>'` (сетка 24, stroke 1.8, контурные). Кнопка «назад» в фильтре (экран 34) — зеркальный `chevronR` (`transform:scaleX(-1)` на маске), новой иконки нет. Иконка ошибки — `close` в круглой плашке `spice`; «пиры» в пилюле предзагрузки — `torrent`.
> - **Кегль приглушённого текста:** мета-строки, подписи, пояснения — не мельче 20 px FHD (`.877em`); там, где бриф писал 16 px, брать 20 px (в дизайне 27 вхождений, исключений нет).
> - **Экраны 35 и 36 — документационная компоновка:** ширина панели Select всегда как на экране 33 — 35 % экрана (`.selectbox__content` Lampa, 672 px при FHD), а не 570 px из трёх вариантов экрана 35; высоты состояний модалки на экране 36 сжаты для сравнения — брать высоту по контенту.
> - **Чек-лист (экран 37а) — три состояния через штатные классы:** будущий шаг — `li` (smoke); текущий — `li.wait` без `.check` (цвет text, кегль крупнее); пройденный — `li.wait.check` (muted + зачёркивание). Подтверждено кодом Lampa (`API_NOTES_5` §3.4).
> - **`.torrnet-folder-name`** — JetBrains Mono (как в экспорте), не Golos из брифа.
> - **Индикатор «применён фильтр» на чипе «Фильтр» (экран 34):** нативного класса-маркера не найдено. В Task 32 проверить живьём, заполняет ли `Filter` скрытый `div` внутри `.filter--filter` при выбранных значениях (`$('.filter--filter div').text()` после `filter.chosen(...)` / выбора в Select); если да — точка только CSS: `.lumen-torrents .filter--filter div:not(:empty){display:block;width:.4em;height:.4em;border-radius:50%;background:accent;font-size:0;…}` (переопределяя `.hide`); если нет — индикатор не делать (новый JS-хук за пределами инварианта 0.3.1).
> - **«Продолжить» и раскрывающееся поле поиска** на экране 34 — штатные `.watched-history` и `.filter--search` со скрытым инпутом, оформлять как есть; сверх Lampa дизайнер ничего не добавил.

### Task 31: Маркеры и настройки

**Files:** Create `src/64_menus.js`, `test/menus.test.mjs`; Modify `src/80_settings.js`, `src/90_runtime.js`.

- [ ] **Step 1: Разведка (5 минут, в консоли живой Lampa)** — `typeof Lampa.Modal.listener`, и если есть — какие типы событий шлёт (`Lampa.Modal.listener.follow('open', console.log)` + открыть любую модалку); `Lampa.Select.listener` — подтвердить `preshow/fullshow/hide/close` и что `e.active.title` / `e.active.items` доступны в `preshow`. Записать результат в шапку `64_menus.js` комментарием.

- [ ] **Step 2: Тест `kind`**

```js
// test/menus.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const m = load('64_menus.js');
const t = s => s; // подмена Lampa.Lang.translate: kind получает уже переведённые строки через аргумент titles
const titles = { source: 'Источник', action: 'Действие' };
test('источник: title + пункты с btn', () => {
  assert.equal(m.kind({ title: 'Источник', items: [{ title: 'Торренты', btn: {} }] }, 'full', titles), 'source');
});
test('меню раздачи: флаги tomy/mark/unmark', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ tomy: true }, { mark: true }, { unmark: true }] }, 'torrents', titles), 'torrent');
});
test('меню файла: timeclear/timefull/player/link', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ timeclear: true }, { timefull: true }, { player: 'lampa' }, { link: true }] }, 'full', titles), 'file');
});
test('сортировка/фильтр: любой Select при активной активности torrents', () => {
  assert.equal(m.kind({ title: 'Сортировать', items: [{ title: 'По сидам' }] }, 'torrents', titles), 'filter');
});
test('чужой Select с тем же заголовком «Действие» → null', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ title: 'Удалить' }] }, 'main', titles), null);
  assert.equal(m.kind(null, 'main', titles), null);
});
```

- [ ] **Step 3: Модуль**

```js
// src/64_menus.js
  LC.menus = (function () {
    var MARK_SELECT = 'lumen-select', MARK_MODAL = 'lumen-modal', MODES = ['all', 'path', 'off'];
    function hasFlag(items, names) {
      var i, j;
      for (i = 0; i < items.length; i++) for (j = 0; j < names.length; j++) if (items[i] && items[i][names[j]]) return true;
      return false;
    }
    // active — объект вызова Select.show; component — Lampa.Activity.active().component; titles — {source, action} (переведённые)
    function kind(active, component, titles) {
      if (!active || !active.items || !active.items.length) return null;
      var items = active.items;
      if (active.title === titles.source && hasFlag(items, ['btn'])) return 'source';
      if (hasFlag(items, ['tomy', 'mark', 'unmark'])) return 'torrent';
      if (hasFlag(items, ['timeclear', 'timefull', 'player', 'link'])) return 'file';
      if (component === 'torrents') return 'filter';
      return null;
    }
    function mode(v) {
      var b = document.body, i;
      for (i = 0; i < MODES.length; i++) b.classList.remove('lumen-menus-' + MODES[i]);
      if (v !== 'off') b.classList.add('lumen-menus-' + v);
    }
    function install() {
      var titles = { source: Lampa.Lang.translate('settings_rest_source'), action: Lampa.Lang.translate('title_action') };
      var modalArmed = false;
      Lampa.Select.listener.follow('preshow', function (e) {
        var k = kind(e && e.active, (Lampa.Activity.active() || {}).component, titles);
        var root = $(Lampa.Select.render(true)); /* jq */
        root.toggleClass(MARK_SELECT, !!k).attr('data-lumen-kind', k || '');
      });
      Lampa.Select.listener.follow('close', function () { $(Lampa.Select.render(true)).removeClass(MARK_SELECT).attr('data-lumen-kind', ''); });
      // Модалки пути: с клика по раздаче (onenter) до закрытия списка файлов; Step 1 может дать более прямой хук (Modal.listener)
      Lampa.Listener.follow('torrent', function (e) { if (e.type === 'onenter') modalArmed = true; });
      Lampa.Listener.follow('torrent_file', function (e) { if (e.type === 'list_close') modalArmed = false; });
      Lampa.Controller.listener.follow('toggle', function (e) {
        if (e.name === 'modal' && modalArmed) $('.modal').addClass(MARK_MODAL);
        else if (e.name !== 'modal' && e.name !== 'select') { $('.modal').removeClass(MARK_MODAL); modalArmed = false; }
      });
    }
    return { kind: kind, mode: mode, install: install, MARK_SELECT: MARK_SELECT, MARK_MODAL: MARK_MODAL };
  })();
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.menus;
```
Если Step 1 показал `Lampa.Modal.listener` с событиями открытия/закрытия — ставить и снимать `lumen-modal` в них (по `modalArmed`), а ветку через `Controller.listener` убрать. Маркер модалки нужен только режиму `path`; в `all` модалки оформляются классом на `body`.

- [ ] **Step 4: Настройки и init** — в `80_settings.js`: `lumen_menus` (select: all «Все меню и окна», path «Только путь до плеера», off «Выкл»; default `all`; `onChange: LC.menus.mode`), `lumen_torrents` (trigger, default true; `onChange: LC.torrents.toggle` — Task 32). В `LC.init` после `injectCss`: `LC.menus.mode(Lampa.Storage.field('lumen_menus')); LC.menus.install();` — в `try/catch`, ошибка не ломает карточку.

- [ ] **Step 5: Живая проверка** — рецепты API_NOTES_6 §1, §2.7, §4.4, §9: у Select источников, меню раздачи и меню файла на `.selectbox` появляется `lumen-select` с `data-lumen-kind` = `source / torrent / file`; открыть Select из настроек Lampa (например, «Размер интерфейса») — маркера нет; при `lumen_menus = all` на `body` класс `lumen-menus-all`, при `path` — `lumen-menus-path`, при `off` — ни одного. Модалка: после `Lampa.Listener.send('torrent', {type:'onenter'})` (эмуляция клика) и `Modal.open` спиннера — на `.modal` есть `lumen-modal`; после `Modal.close` и возврата контроллера — нет. Консоль без ошибок. Хэши 7/7 (методика фазы 1 Task 3 Step 5).

- [ ] **Step 6: Commit** `feat: маркеры меню и окон пути TorrServer, настройки режима`.

---

### Task 32: CSS экранов пути (33–40)

**Files:** Create `src/65_torrents.js`, `test/torrents.test.mjs`; Modify `src/30_css.js` (экспорт `LC.tokens`, если нужен), `src/90_runtime.js`.

> Размеры — из экспорта дизайна (FHD px ÷ 22.811 = em), при его отсутствии — по брифу и аналогам карточки. Иконки — только `LC.icons.maskUrl(name)` поверх штатных `svg` (`display:none !important` + `:before`-маска, как в Task 3), и только для спрайтов Lampa (`use[xlink:href="#sprite-torrent"]` → `torrent`, `#sprite-play` → `play`, `#sprite-search` → лупа — нужна новая иконка `search` в `20_icons.js` с тестом); чужие иконки в Select не трогать (селектор по `use[xlink:href]`, а не по `.selectbox-item__icon svg`).

- [ ] **Step 1: Тест каркаса**

```js
// test/torrents.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const t = load('65_torrents.js');
const rules = () => t.css().split('\n').filter(Boolean);
test('scoped: два префикса из одного селектора', () => {
  assert.equal(t.scoped('.selectbox .selectbox-item.focus'), 'body.lumen-menus-all .selectbox .selectbox-item.focus,.selectbox.lumen-select .selectbox-item.focus');
  assert.equal(t.scoped('.modal .torrent-checklist'), 'body.lumen-menus-all .modal .torrent-checklist,.modal.lumen-modal .torrent-checklist');
});
test('каждое правило заскоуплено', () => {
  for (const r of rules()) assert.match(r, /^(body\.lumen-menus-all |\.selectbox\.lumen-select|\.modal\.lumen-modal|body\.lumen-torrents-on |@supports not \()/, r);
});
test('нет inset и :has', () => { for (const r of rules()) { assert.ok(r.indexOf('inset:') === -1, r); assert.ok(r.indexOf(':has(') === -1, r); } });
test('покрыты все экраны пути', () => {
  const css = t.css();
  for (const c of ['.selectbox__title', '.selectbox-item.focus', '.torrent-item', '.torrent-item__size', '.torrent-filter', '.explorer-card__title', '.empty-filter',
    '.modal-loading', '.torrent-install__title', '.torrent-checklist__progress-bar', '.torrent-error code', '.torrent-file', '.torrent-serial__episode', '.torrnet-folder-name', '.media-loading__status'])
    assert.ok(css.indexOf(c) !== -1, c);
});
test('внутри панели ничего не скрыто', () => {
  for (const r of rules()) if (/\.selectbox/.test(r)) assert.ok(!/display:none/.test(r), r);
});
```

- [ ] **Step 2: Модуль** — `LC.torrents = (function(){ … return { css, scoped, install, toggle }; })()`. `css()` собирает массив правил группами по экранам (комментарий-заголовок над каждой группой: `/* 33 Источник */` …): панель Select (фон `panel`, заголовок Unbounded, пункт Golos, подзаголовок muted, фокус — заливка акцентом и `onac`-текст, `scale(1.02)` внутри панели, иконки спрайтов маской); `.lumen-torrents .explorer` (левая колонка как экран 04 карточки — постер, мета моно, описание 2 строки; чипы фильтра как чипы карточки; `.torrent-item` — карточка с мета-строкой моно, чип размера в акценте, `m-*` медиаинфо как чипы качества, `.torrent-item__viewed` — галочка `good`, фокус — кольцо `ring` + тень `acglow`, без `::after`-рамки Lampa: перекрыть `border-color:transparent`); `.empty`/`.empty-filter` внутри `.lumen-torrents`; модалки (`.modal__content` — фон `panel`, радиус, заголовок Unbounded; `.modal-loading` — вместо картинки маска иконки `torrent` с пульсом; `.torrent-install`, `.torrent-checklist` (прогресс в акценте, `li.wait` — текст, `li.check` — muted + зачёркнут), `.torrent-error` + `.error` внутри скоупа, `.torrent-file`/`.torrent-serial`/`.torrnet-folder-name` — как ряд серий карточки, `.time-line` в акценте, `.torrent-serial__progress` — акцент); `.media-loading` (вуаль в токенах, `__title` Unbounded, `__mark-fill` — акцентный цвет через `filter`/`color`, `__status` — пилюля `panel` с моно-цифрами). `install()`: `Lampa.Listener.follow('activity', e => { if (e.type === 'start' && e.component === 'torrents') e.object.activity.render().addClass('lumen-torrents') })` плюс инжект `<style id="lumen-torrents-css">` и класс `lumen-torrents-on` на `body`; `toggle(on)` — добавляет/удаляет и стиль, и класс.

- [ ] **Step 3: Живые проверки по экранам** — каждый экран открыть рецептом API_NOTES_6 (§1, §2 «2б», §2.7, §4–§12; с починками из §0), снять скриншот, сравнить с экраном дизайна 33–40 (или с брифом), проверить: фокус виден и в акценте; чужой пункт в Select (добавить в рецепт §1 пункт `{title:'Онлайн', subtitle:'Z01', template:'selectbox_icon', icon:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>'}`) — иконка чужая, не маска; в режиме `path` Select настроек Lampa штатный; `lumen_torrents = off` → `#lumen-torrents-css` удалён, экраны штатные; консоль чистая. Все состояния — таблицей «экран → рецепт → что проверено → отличие от дизайна».

- [ ] **Step 4: Commit** `feat: экраны пути TorrServer в стиле Lumen` (при большом объёме — по коммиту на группу: панель Select; список раздач; модалки и файлы; media-loading).

---

### Task 33: Сверка с дизайном, регресс, ревью фазы

- [ ] **Step 1: Сверка с экспортом** (когда экраны 33–40 лежат в `design/`): по каждому экрану — «дизайн / реализация / совпадает», методика `docs/design/design-spec-card.md`, но с базой 22.811 px. Расхождения ✗ — закрыть в `65_torrents.js`, коммит `fix: сверка экранов пути с дизайном`.
- [ ] **Step 2: Регресс** в живой Lampa: (1) без плагина и с плагином путь идентичен по поведению: OK на раздаче (эмуляция `Lampa.Listener.send('torrent', {type:'onenter', …})` недостаточна — открыть `Torrent.start` с заведомо недоступным приватным адресом `http://192.168.1.50:8090` в `torrserver_url`, дождаться чеклиста, затем вернуть пустой адрес); (2) «Мои торренты» (меню → «Ещё») открываются и выглядят согласованно; (3) настройки Lampa при `all` — Select и модалки в новом стиле, но все элементы читаемы и работают (пройти «Размер интерфейса», «Плеер», ввод строки); при `path` — штатные; (4) переключение `lumen_menus` и `lumen_torrents` без перезагрузки; (5) выключение плагина убирает всё; (6) хэши 7/7; (7) `resize_window` 1280×720 и 3840×2160 — пропорции держатся (em); (8) консоль без ошибок.
- [ ] **Step 3: Ревью** — `superpowers:code-reviewer` на диапазон фазы с инвариантами 0.3; Critical/Important чинятся и перепроверяются. Commit `chore: ревью фазы 1b`.
- [ ] **Step 4: README** — раздел «Путь до плеера»: что оформлено, настройки `lumen_menus` / `lumen_torrents`, совет включить «Встроенный клиент» TorrServer на Android.

---

## 3. Риски

| Риск | Митигация |
|---|---|
| `Lampa.Select.render(true)` вернёт не корень `.selectbox` | Step 1 Task 31 проверяет; запасной путь — `$('.selectbox')` (синглтон) |
| Чужой плагин подменяет шаблон `selectbox_item`/`torrent` | Правила только по штатным классам; если класса нет — экран остаётся как у плагина, ничего не ломается |
| Режим `all` портит чужую модалку с жёсткими размерами | Ограничить правила `.modal__content` фоном, радиусом, шрифтом заголовка и цветом текста; размеры не трогать |
| `:before`-маска конфликтует с чужими `:before` на `.selectbox-item__icon svg` | Маска только на `svg` со спрайтом Lampa (`use[xlink:href^="#sprite-"]`) |
| Обновление Lampa переименует классы пути | Тест «покрыты все экраны» ловит только наш CSS; живой регресс Task 33 Step 2 — единственная защита, повторять при обновлении vendor |

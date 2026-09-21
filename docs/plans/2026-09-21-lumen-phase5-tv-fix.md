# Lumen Card — фаза 5: 21 fps, чёрные полосы, недоделанный дизайн

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Исполнители — строго последовательно (параллельные конфликтуют через `dist/` и git).

**Goal:** вернуть плавное листание главной на Philips 50PUS8057/60 (`960×540@2`, 4 ядра, ~2 ГБ), убрать чёрные полосы при загрузке кадров, показать названия под постерами, довести меню и остальные экраны до языка Task 42-43.

**Architecture:** точечные правки под своими корнями (`.lumen-main`, `.selectbox` под `lumen-menus-all`), без переписывания. Порядок — по вкладу в 21 fps: сначала память (кадры `original`), потом дерево слоёв (три слоя на карточку от Lampa), потом фон Lampa, потом перерисовки на шаге фокуса. Дизайн — после того, как HUD подтвердит, что кадры вернулись.

**Tech Stack:** ES5, Lampa 3.3.4 (`vendor/lampa`), тесты `node --test "test/*.test.mjs"`, сборка `node scripts/build.mjs`, `node scripts/es5check.mjs`. `node` в Bash: `export PATH="$PATH:/c/Users/azark/AppData/Local/Programs/nodejs"`.

**Первоисточники:** аудит 2026-09-21 (выжимка ниже), замеры координатора на стенде в режиме `960×540@2` (Приложение Б), ресёрч `docs/research/2026-09-18-android-tv-animations.md`, бэклог с ТВ в конце `docs/plans/2026-09-18-lumen-phase4-tv.md`.

---

## Что известно точно (замеры 2026-09-21, стенд `vendor/lampa`, 960×540, DPR подменён на 2)

| Факт | Значение | Откуда |
|---|---|---|
| База em | 11.41 CSS px = 22.8 физ. | `baseEm()` |
| Кадр героя | `original` = **3840×2160 = 31.6 МБ** RGBA на кадр; `w1280` было бы 3.7 МБ | `Image.naturalWidth` на стенде |
| Постеры рядов | `w300` от Lampa (`poster_size`) — норма для 260 физ. px | DOM |
| Слои на главной | 138 кандидатов, 9 полноэкранных; на **каждую карточку три**: `.card{will-change}` (`app.css:3095`), `.card__title{translateZ(0)}` (`:3166`), `.card__age{translateZ(0)}` (`:3173`) | обход DOM + аудит |
| Фон Lampa | 4 полноэкранных `position:fixed; will-change:opacity` (`app.css:2320-2344`) под нашим героем; `Background.change` грузит `w1280` и читает пиксели канвасом (`app.min.js:21473`) | DOM + аудит |
| Подпись первого ряда (старт) | постер до 558, название 564…576, «год · ★» 579…589 при кромке 540 → **49 px за экраном** | `getBoundingClientRect` |
| Горячий путь (наш JS) | 0 `getBoundingClientRect` на шаг; 104 вызова за 5 шагов — все от Lampa `Navigator`/`Scroll` | подмена прототипа |
| Дебаунс героя | 5 шагов по 300 мс → 1 смена кадра | `MutationObserver` |
| На ТВ `lumen_fx_heavy = false` | кросс-фейд героя не работает, кадр подменяется в одном слое; слайдшоу выключено | `81_prefs.js:65` |
| Меню | наш стиль: заливка акцентом, тени нет; в **`lite` фокус пункта теряет заливку** (bg прозрачный) | замер в трёх режимах |

Ранжирование причин 21 fps (аудит): 1) `original` — высокий; 2) три слоя на карточку — высокий; 3) фон Lampa (4 слоя + канвас) — высокий для полос, средний для fps; 4) ореол `box-shadow` на фокусе — средний; 5) маски рядов — средний; 6) `backdrop-filter` панелей меню — средний, только в меню.

---

## Волна 1 — память и слои (ожидаемый эффект на fps: высокий)

### Task 47: Кадры — `w1280` на 1080p, `img.decode()` перед показом

**Files:**
- Modify: `src/10_util.js:205-214` (`frameSize`)
- Modify: `src/48_hero.js:936-968` (`loadFrame`)
- Test: `test/util.test.mjs`, `test/hero.test.mjs`

Почему: ревью Task 39 (`b38425a`) перевело порог `frameSize` на `FIT × px > 1280`, и при `screenPx() = 1920` кадр ушёл в `original`. На растре 1080p `w1280` растягивается в 1.5 раза — компромисс, но 3.7 МБ против 31.6 на кадр; ресёрч §4: «`original` — никогда, если растр не выше 1080p». `original` остаётся только для честного 4K-окна.

- [ ] **Step 1: Тест `frameSize`** — в `test/util.test.mjs` заменить ожидания: `frameSize(1920) === 'w1280'`, `frameSize(1366) === 'w1280'`, `frameSize(3840) === 'original'`, `frameSize(2260) === 'w1280'`, `frameSize(2270) === 'original'`. Запустить — падает на 1920.

- [ ] **Step 2: Реализация**

```js
    /* Размер кадра, который СМОТРЯТ: кадр героя на главной, кадр за текстом
       карточки, кадр заставки. Порог — растр выше 1080p: original у TMDB
       обычно 3840×2160 (31.6 МБ RGBA, замер 2026-09-21), w1280 — 3.7 МБ.
       На 1920 физических пикселей w1280 растягивается в полтора раза, и это
       осознанная плата: на Android TV с ~2 ГБ два original-кадра при смене
       фильма дают checkerboarding (чёрные полосы) и 21 fps — проверено на
       Philips 50PUS8057 (960×540@2). original — только когда растр шире
       1920 с тем же допуском FIT, то есть от 2260 физических пикселей. */
    function frameSize(px) {
      return (Number(px) || 0) * FIT > 1920 ? 'original' : 'w1280';
    }
```

- [ ] **Step 3: `img.decode()` в `loadFrame`** — после `img.src = url` и до `swapFrame`: если `typeof img.decode === 'function'`, ждать `img.decode().then(swap, swap)` (в `catch` тоже показывать — decode отвергается на некоторых WebView без причины), иначе `onload` как сейчас. Тест в `test/hero.test.mjs`: заглушка `Image` с `decode` → `swapFrame` вызван после резолва промиса, не в `onload`; без `decode` — по `onload`.

- [ ] **Step 4: Прогон, сборка, ES5. Commit** `perf: кадры w1280 на 1080p, decode() перед показом (Task 47)`.

### Task 48: Слои карточек и маски рядов

**Files:**
- Modify: `src/30_css.js` — блок рядов у `:2465` и правило области у `:2244-2248`
- Test: `test/css.test.mjs`

Почему: Lampa выдаёт три composited-слоя каждой карточке (`app.css:3095, 3166, 3173`); на главной ~200 карточек → 480-720 слоёв при бюджете 10-15 (ресёрч §3). Маска на каждом ряду (`app.css:2798`) — то же, что Task 38 снял с вертикального скролла.

- [ ] **Step 1: Тесты** — в собранном CSS есть `.lumen-main .card{will-change:auto}`, `.lumen-main .card__title,.lumen-main .card__age{transform:none}` (с `-webkit-`), `.lumen-main .items-line__body.scroll--mask{mask-image:none}` (с `-webkit-`). Проверить, что правило `transform:none` для подписей стоит **после** любых наших правил с `transform` на тех же селекторах (по аудиту их нет, но тест обязан это зафиксировать).

- [ ] **Step 2: Реализация** — рядом с `:2465`:

```js
    /* Три composited-слоя на карточку выдаёт сама Lampa: .card{will-change:
       transform} (app.css:3095), .card__title и .card__age {transform:
       translateZ(0)} (app.css:3166, 3173). На главной ~200 карточек — это
       480-720 слоёв при бюджете слабого ТВ 10-15 (ресёрч §3). Снимаем под
       своим корнем; слой на время перехода scale Blink выдаст сам. Шлейф
       Task 46 не возвращается: у обоих движущихся контейнеров свои постоянные
       слои (герой и область рядов выше по файлу). */
    css.push('.lumen-main .card{will-change:auto}');
    css.push('.lumen-main .card__title,.lumen-main .card__age{-webkit-transform:none;transform:none}');
    /* Маска ряда (app.css:2798) — поверх едущего .scroll__body, по одной на
       ряд; хвостов по бокам нет: ряд обрезает кромка экрана. */
    css.push('.lumen-main .items-line__body.scroll--mask{-webkit-mask-image:none;mask-image:none}');
```

Проверь в `app.css:2798` точный селектор маски и то, что `.items-line__body` действительно несёт `scroll--mask` (иначе селектор мёртв — найди реальный).

- [ ] **Step 3: Прогон. Commit** `perf: без слоёв на карточках и масок на рядах (Task 48)`.

### Task 49: Фон Lampa под главной

**Files:**
- Modify: `src/30_css.js` (правило под состоянием body), `src/48_hero.js` (`mount`/`unmount`, ~`:1394`)
- Test: `test/hero.test.mjs`, `test/css.test.mjs`

Почему: `.background`, `.background__one/two/fade` — четыре полноэкранных слоя `position:fixed; will-change:opacity` (33 МБ) под героем, который закрывает 2/3 экрана; плюс `Background.change` на каждой остановке фокуса грузит `w1280` и читает его пиксели канвасом на главном потоке (`app.min.js:21473, 21505`; `Utils.cardImgBackgroundBlur`). Пользовательскую настройку «Фон» не трогаем.

- [ ] **Step 1: Тесты** — `LC.hero.mount` ставит на `body` класс `lumen-main-on`, `unmount` снимает; в CSS есть `body.lumen-main-on .background{display:none}`; пока класс стоит, `Lampa.Background.change` не доходит до оригинала (обёртка), после `unmount` оригинал восстановлен и работает. Проверь по `app.min.js`, что `Background.change` — свойство объекта `Lampa.Background` и его можно переопределить, и что события активности главной действительно проходят через `mount`/`unmount` (память проекта: `Activity.push` не шлёт событий покидаемой активности — гард по `.activity--active`).

- [ ] **Step 2: Реализация** — обёртка `guardBackground()` в `48_hero.js`: сохранить `orig = Lampa.Background.change`, поставить `function(){ if (document.body.classList.contains('lumen-main-on')) return; return orig.apply(this, arguments); }`; в `unmount` — вернуть `orig`, если текущее значение — наша обёртка (иначе кто-то ещё переопределил — не трогать). Класс `lumen-main-on` ставить в `mount`, снимать в `unmount`. Комментарий — только проверенное: строки `app.min.js`, где Lampa зовёт `change`.

- [ ] **Step 3: Прогон. Commit** `perf: фон Lampa не рисуется и не грузится под главной (Task 49)`.

### Task 50: Фокус карточки без размытия

**Files:**
- Modify: `src/30_css.js:248` (`AR.cardFocus`), `test/css.test.mjs`, `test/color.test.mjs`

Почему: `box-shadow 0 .35em .7em` — перерисовка слоя уходящей и приходящей карточки с размытием 16 физ. px на каждом шаге. Ресёрч §2: тени с размытием — не на шаге фокуса.

- [ ] **Step 1: Тест** — `AR.cardFocus` содержит `box-shadow:0 .2em 0 ` (размытие 0), ни одного `box-shadow` с ненулевым размытием в правилах `.lumen-main .card`.
- [ ] **Step 2:** `cardFocus: '.lumen-main .card.focus .card__view{-webkit-box-shadow:0 .2em 0 ' + t.glow + ';box-shadow:0 .2em 0 ' + t.glow + '}'` — плоская подложка цветом акцента под увеличенным постером; комментарий переписать (ссылка на ресёрч §2 и замер 21 fps).
- [ ] **Step 3: Прогон. Commit** `perf: подложка фокуса без размытия (Task 50)`.

**После волны 1 — замер на ТВ (HUD в покое и при листании), прежде чем идти дальше.** Если fps не вырос — бисекция по Task 47/48/49 через `git revert` по одному, а не новые правки.

---

## Волна 2 — раскладка и герой

### Task 51: Названия под постерами на экране (Б3)

**Files:**
- Modify: `src/30_css.js:303` (`ROW_CARD_W`), `:341` (`ROWS_SHIFT_VH`), `:2463` (`ROW_FOCUS`), `:2498` (зазор заголовка)
- Test: `test/css.test.mjs` (пороги медиазапросов, «зазор ≥ рост», новый тест «подпись первого ряда выше кромки»)

Арифметика (аудит, CSS px при 540): низ подписи в старте — 586, в поднятом — 543. Нужно −50 в старте, ≥ −10 в поднятом, не трогая `HERO_VH.large = 66.67`.

Цепочка высот от верха экрана: `LAMPA_HEAD` 4em = 45.6 → `margin-top` области `ROWS_TOP_VH − 5em` = 213 → `translateY(ROWS_SHIFT_VH)` 8vh = +43.2 → `padding 2.5em` Lampa (`app.css:2787`) = +28.5 → заголовок 1.23em + зазор `1.4em` = 14 + 16 → постер `ROW_CARD_W × 1.5` = 195 → `margin-bottom .5em` = 5.7 → название .96em × 1.15 = 12.6 → `.card__age` .25em + .88em = 12.5.

- [ ] **Step 1: Тест раскладки** — функция в тесте, повторяющая эту цепочку для 960×540: низ подписи ≤ 540 в старте **и** ≤ 530 в поднятом (`.lumen-rows-up`, без `translateY`). Сначала падает.
- [ ] **Step 2:** `ROWS_SHIFT_VH: 8 → 5.5` (−13.5 px); `ROW_CARD_W: 11.4 → 9.6` (постер 164 вместо 195, −31 px); `ROW_FOCUS: 1.08 → 1.06`; зазор `round2(1.4 * scale)` → `round2(1.0 * scale)` (рост 164 × 0.06 = 9.9 px = 0.86em < 1.0em — инвариант «зазор ≥ рост» держится, −4.6 px). Проверить порог показа описания (`textRatio`): не ниже 190/100 (экран ТВ — 177.78); аудит ожидает ≈204. Обновить пины порогов в тестах с объяснением.
- [ ] **Step 3: Живая проверка на стенде в 960×540** (координатор): `getBoundingClientRect` подписи первого ряда < 540 в старте.
- [ ] **Step 4: Commit** `design: подписи рядов на экране — карточка 9.6em, сдвиг 5.5vh (Task 51)`.

### Task 52: Кадр героя не «съезжает» (Б6)

**Files:**
- Modify: `src/48_hero.js:894, 903` (класс blur), `src/30_css.js:1864`
- Test: `test/hero.test.mjs`, `test/css.test.mjs`

Аудит: `.lumen-hero--blur` стоит на корне героя, правило `:1864` даёт `scale(1.1)` обоим слоям кадра; переход «фильм без backdrop → с backdrop» снимает класс скачком на 10 %. Вторая возможная причина — сжатие героя на 16.67vh при уходе фокуса ниже первого ряда — задумана; спросить пользователя, её ли он видит.

- [ ] **Step 1: Тест** — после `swapFrame(url, blur=true)` класс `lumen-hero__bg--blur` стоит на **активном слое**, на корне `.lumen-hero--blur` нет; `swapFrame(url2, blur=false)` снимает класс с того же слоя; CSS: селектор `.lumen-hero.lumen-motion-full .lumen-hero__bg--blur{transform:scale(1.1)}`, старого селектора нет.
- [ ] **Step 2:** в обеих ветках `swapFrame` — `only/next.toggleClass('lumen-hero__bg--blur', !!blur)` вместо `node.toggleClass(...)`; `prev.removeClass('lumen-hero__bg--blur')`; правило `:1864` переписать; grep `lumen-hero--blur` по `src/` и `test/` — не оставить мёртвых.
- [ ] **Step 3: Commit** `fix: размытие кадра героя — на слое, не на корне (Task 52)`.

---

## Волна 3 — меню и остальные экраны

### Task 53: Меню (selectbox/modal) — отступы, инверсия, без backdrop-filter

**Files:**
- Modify: `src/65_torrents.js:99, 103, 116, 267`
- Test: `test/torrents.test.mjs`

- [ ] **Step 1: Тесты** — в CSS меню: `.selectbox-item{…padding:.7em 1.4em…}`; `.selectbox-item.focus{background-color:<k.text>;color:<k.bg>…}`; `.selectbox__content{…backdrop-filter:none}` и `.modal__content{…backdrop-filter:none}` (с `-webkit-`); `.selectbox .selectbox-item{will-change:auto}` (Lampa: `app.css:7154`); **во всех трёх режимах движения** у `.selectbox-item.focus` есть непрозрачная заливка (замер 2026-09-21: в `lite` заливка терялась — найди правило, которое её гасит, и покрой тестом).
- [ ] **Step 2: Реализация** по списку; `backdrop-filter` Lampa — `app.css:16046-16058` под `body.glass--style` (проверь строки); штатный `padding: 1.5em 2em` пункта — `app.css:7151-7155`.
- [ ] **Step 3: Живая проверка** (координатор, стенд): `Lampa.Select.show` в `full/lite/off` — заливка есть, текст в 1.4em от кромки.
- [ ] **Step 4: Commit** `design: меню — инверсия фокуса, отступы, без backdrop-filter (Task 53)`.

### Task 54: Инверсия фокуса на остальных экранах

**Files:** `src/30_css.js` — `.lumen-grid__back` (`:1693`), `.lumen-roulette__btn` (`:2545`), `.lumen-franchise` (`:1543`, `:1562`), `.lumen-reviews__hint-hide` (`:1293`), `.lumen-reviews__mode` (`:1330`), `.lumen-review-modal__reveal` (`:1348`), `.lumen-fr__mode` (`:1363`), `.lumen-episode`; `src/65_torrents.js` — `.torrent-item.focus`. Номера строк — от 2026-09-18, сверить grep'ом.

- [ ] **Step 1: Тест** — единый список селекторов фокуса; для каждого в собранном CSS правило `.focus{background:<P.text>;color:<P.bg>}` и **нет** правила с `background:<A>`/`border-color:<AL>` на том же селекторе (мёртвые акцентные — снять). Тест — один, параметризованный по списку.
- [ ] **Step 2: Реализация.** `accentRules`/`LC.accentCss` — снять всё, что красило эти фокусы акцентом (иначе мёртвые правила в узле подкраски — ошибка, которую ловили в Task 42/43).
- [ ] **Step 3: Commit** `design: фокус — инверсия на всех экранах (Task 54)`.

### Task 44 · рулетка — без изменений, из плана фазы 4 (после Task 53, чтобы не конфликтовать по блоку рулетки).

---

## Волна 4 — телевизор

### Task 55: HUD — размер кадра и слои; чек-лист бисекции

**Files:** `src/69_hud.js`, `docs/tv-checklist.md`

- [ ] HUD показывает размер последнего кадра героя (`w1280`/`original` — из состояния `LC.hero`) и число `.lumen-main .card` × 3 как оценку слоёв карточек до Task 48 (после — × 0).
- [ ] `docs/tv-checklist.md`: фото HUD в покое / при листании / в хабе / в сетке / в меню; отдельно — с выключенной настройкой Lampa «Фон» и с `lumen_fx_heavy` on/off; куда присылать.
- [ ] Commit `chore: HUD — размер кадра, оценка слоёв; чек-лист ТВ (Task 55)`.

### Task 45 · калибровка порогов — из плана фазы 4, по фото HUD после волны 1.

---

## Что НЕ делать
- Не трогать `HERO_VH.large` (2/3 экрана — решение пользователя).
- Не возвращать `original` «для резкости» без замера на ТВ: 1.5× растяжение `w1280` на 1080p — осознанная плата.
- Не снимать два постоянных слоя Task 46 (герой, область рядов) — они нужны против шлейфа; их цена (9.85 МБ) мала после Task 48.
- Не менять пользовательские настройки Lampa (`background`, `glass_style`, `poster_size`) из кода.
- Не пушить `main`; публикация — только `feat/lumen-v2` + purge jsDelivr.

## Приложение Б — как гонять стенд в режиме ТВ
`resize_window` 960×540; до инжекта плагина: `Object.defineProperty(window,'devicePixelRatio',{get:function(){return 2},configurable:true})`; затем инжект `dist/lumen_card.js`. Клавиши — `keydown` на `document` с `keyCode` через `defineProperty`; если фокус не двигается — `Lampa.Controller.enabled().name` и `Lampa.Controller.toggle('content')` (открытый Select перехватывает контроллер). rAF на стенде не тикает — fps только с ТВ.

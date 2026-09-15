# Lumen Card — фаза 3: фишки оформления, навигации и опыта

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Реализовать принятые пользователем фишки (`docs/design/ux-ideas.md`, раздел «Решения»): тематические атмосферы и сезонность, ambient-режим, две рулетки, логотипы и акцент от постера, метки на постерах, контекстное меню, навигационные ускорители, хронология франшизы, автотрейлер в герое, переход постер → кадр, автодетект слабого ТВ. Отменены: «Где смотреть легально», цветные кнопки пульта.

**Architecture:** Те же модули `src/NN_*.js` и контракт из плана фазы 1 (раздел 1.1). Всё, что рисуется поверх Lampa, живёт в собственных слоях (`.lumen-fx`, `.lumen-ambient`, `.lumen-overlay`) и не меняет штатный DOM, кроме добавления элементов внутрь карточек рядов (метки) и блока описания карточки (хронология). Правила тем и список кадров ambient — в манифесте (`manifest.themes`, `manifest.ambient`), обновляются без переустановки. Каждая фишка выключается отдельной настройкой и подчиняется `LC.motionMode()`.

**Tech Stack:** как в фазах 1–2. Ресёрч: `API_NOTES*.md` в `C:\Users\azark\AppData\Local\Temp\lampa\`. Дизайн: экраны 26–32 из `docs/design/claude-design-brief-main.md` (экспорт пользователя появится в `design/`).

**Зависимости:** фаза 1 (карточка, `LC.icons`, `LC.trailer.pickTrailer`, `LC.trailerPlayer`, `LC.motionMode`, `LC.reviews`) и фаза 2 (`LC.manifest`, `LC.sources`, `LC.rows`, `LC.hero`, `LC.hub`, компоненты `lumen_hub`/`lumen_grid`) должны быть завершены.

---

## 0. Факты и решения, на которых строится фаза

- **Ключевые слова фильма** есть в данных карточки: `e.data.movie.keywords.results` (movie) или `.keywords` (tv) — массив `{id, name}` на английском. На главной у `el.card_data` ключевых слов нет; герой (фаза 2, Task 18) запрашивает детали с `append_to_response=images` — расширить до `images,keywords`.
- **Бездействие пульта** = отсутствие `keydown` на `document` (мышь и тач на ТВ не считаем, но `mousemove`/`touchstart` тоже сбрасывают таймер — для браузерной версии).
- **Открыт ли плеер/модал**: `Lampa.Modal.opened()` — есть; для плеера проверить живьём `typeof Lampa.Player.opened` (ожидаемо функция) и класс на `body` при открытом плеере; ambient не запускается, если открыт плеер, модал или `Lampa.Controller.enabled().name` не в `['content','full_start','full_descr','items_line']`.
- **Штатное контекстное меню карточки** существует: `src/interaction/card/module/menu.js` (удержание OK на постере в рядах). Наше меню — расширение штатного, не дубль; точку расширения найти в Task 26 Step 1.
- **Похожие**: штатная карточка имеет ряды «Рекомендации»/«Похожие» (`full.js` → `cards`); открыть отдельной сеткой можно через `Lampa.Activity.push({url: 'movie/' + id + '/similar', component: 'category_full', source: 'tmdb', page: 1})` — проверить живьём в Task 26.
- **Закладки/скрытие**: `Lampa.Favorite.toggle('book', card)`, `Lampa.Favorite.toggle('thrown', card)` (`src/core/favorite.js:208`); `Lampa.Favorite.check(card)` → флаги.
- **Цвет постера**: Lampa грузит постеры с `crossOrigin = "Anonymous"` (`poster.js`), значит `getImageData` на canvas доступен, когда сервер картинок отдаёт CORS; при `SecurityError` — фолбэк на фиксированный акцент. Проверить живьём наличие `Lampa.Color`/`Lampa.Utils` для цвета — не полагаться, свой расчёт.
- **Слабый ТВ**: измеряем время от события `complite` карточки до второго `requestAnimationFrame`; порог 400 мс.
- **Пользовательские решения**: ambient — 3 минуты, курируемые кадры известных фильмов (не постеры) в 1080p/2K/4K, опционально свой арт-пак; рулетка — две отдельные (фильмы / сериалы), выбор подборок чипами, фильтры «не смотрел» и «есть 90 минут» / «серия до 30 минут»; трейлер в герое главной запускается сам через 8 с покоя фокуса (удержание OK занято штатным меню).

## 1. Файлы фазы 3

```
src/52_fx.js         LC.fx — движок частиц (canvas) и пресеты: bats, snow, stars, rain, sand, bubbles, petals, embers, glitch
src/53_themes.js     LC.themes — правила тем (из манифеста), matchTheme(movie|details, month), сезонные подборки, адвент
src/54_ambient.js    LC.ambient — таймер бездействия, слой слайдшоу, выбор размера кадра, выход по клавише
src/56_roulette.js   LC.roulette — компонент lumen_roulette: выбор медиа/подборок/фильтров, пул кандидатов, барабан, результат
src/57_color.js      LC.color — доминантный цвет постера → акцент/on-accent/glow (чистая математика + canvas)
src/58_logos.js      LC.logos — pickLogo (переносится из hero), get(media, id, cb) с кэшем, применение в карточке/герое/рулетке
src/62_badges.js     LC.badges — метки на постерах рядов (Новинка / Скоро / Продолжить / 4K), обратный отсчёт, скелетоны
src/63_cardmenu.js   LC.cardmenu — расширение штатного меню карточки (Трейлер, Вся франшиза, Похожие, В закладки, Скрыть)
src/64_nav.js        LC.nav — мини-карта рядов при удержании ↓, ускорение при удержании ←/→, поиск подборок в хабе
src/66_franchise.js  LC.franchise — ряд «Смотреть по порядку» в карточке, отметки просмотренного
src/67_transition.js LC.transition — оверлей постер → кадр при открытии карточки
src/68_perf.js       LC.perf — автодетект слабого ТВ, запись режима анимаций
src/30_css.js        + CSS слоёв fx/ambient/roulette/badges/minimap/franchise/transition/skeleton
src/80_settings.js   + параметры фазы 3
scripts/ambient-pick.mjs   заготовка выборки кадров (см. Task 22), результат — manifest.ambient
test/fx.test.mjs, themes.test.mjs, ambient.test.mjs, roulette.test.mjs, color.test.mjs, logos.test.mjs, badges.test.mjs, nav.test.mjs, franchise.test.mjs, perf.test.mjs
```

## 2. Расширение манифеста

```json
{
  "themes": [
    {"id": "halloween", "preset": "bats", "accent": "#E58A2E", "keywords": ["halloween", "haunted house", "slasher", "witch", "trick or treat"], "genres": [27], "months": [10], "requireGenre": true},
    {"id": "christmas", "preset": "snow", "accent": "#E8C170", "keywords": ["christmas", "santa claus", "new year", "christmas eve"], "months": [12, 1]},
    {"id": "space", "preset": "stars", "accent": "#8FB8D9", "keywords": ["space", "alien", "spaceship", "astronaut", "outer space"]},
    {"id": "noir", "preset": "rain", "accent": "#9AA7B5", "keywords": ["film noir", "detective", "private detective", "neo-noir"]},
    {"id": "desert", "preset": "sand", "accent": "#E8B87A", "keywords": ["desert", "sand", "dune"]},
    {"id": "ocean", "preset": "bubbles", "accent": "#7FB7C9", "keywords": ["ocean", "underwater", "shark", "submarine", "sea"]},
    {"id": "sakura", "preset": "petals", "accent": "#E6A3B8", "keywords": ["cherry blossom", "anime", "romance"], "genres": [16], "requireGenre": true},
    {"id": "war", "preset": "embers", "accent": "#C97B4A", "keywords": ["war", "world war ii", "explosion", "battle"]},
    {"id": "zombie", "preset": "glitch", "accent": "#9FCF8A", "keywords": ["zombie", "undead", "zombie apocalypse"]}
  ],
  "ambient": [
    {"media": "movie", "id": 693134, "title": "Дюна: Часть вторая", "path": "/eZ239CUp1d6OryZEBPnO2n87gMG.jpg", "width": 3840},
    {"media": "movie", "id": 335984, "title": "Бегущий по лезвию 2049", "path": "/…", "width": 3840}
  ]
}
```
Правило темы: совпало хотя бы одно ключевое слово (без учёта регистра, по вхождению) или, если `requireGenre`, — ключевое слово И жанр. Месяцы (`months`) влияют только на сезонную сортировку хаба и адвент, не на определение темы фильма. Первое совпадение по порядку массива побеждает.

## 3. Задачи

### Task 21: Движок частиц, темы, сезонность, адвент

**Files:** Create `src/52_fx.js`, `src/53_themes.js`, `test/fx.test.mjs`, `test/themes.test.mjs`. Modify `src/42_manifest.js` (`themes` в DEFAULT), `src/90_runtime.js` (слой `.lumen-fx` в карточке), `src/48_hero.js` (слой в герое, `keywords` в запросе деталей), `src/46_hub.js` (сезонная сортировка), `src/44_rows.js` (адвент-ряд), `src/80_settings.js` (`lumen_fx`: all / seasonal / off, default all).

- [ ] **Step 1: Тесты themes**
```js
// test/themes.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const T = load('53_themes.js');
const rules = [
  { id: 'halloween', preset: 'bats', keywords: ['halloween', 'slasher'], genres: [27], requireGenre: true },
  { id: 'christmas', preset: 'snow', keywords: ['christmas', 'santa claus'] },
  { id: 'space', preset: 'stars', keywords: ['space', 'alien'] }
];
const kw = (...names) => ({ results: names.map((n, i) => ({ id: i, name: n })) });
test('matchTheme: по ключевому слову, регистр и вхождение', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('Christmas Eve'), genres: [] }).id, 'christmas');
  assert.equal(T.matchTheme(rules, { keywords: kw('Outer Space'), genres: [] }).id, 'space');
});
test('matchTheme: requireGenre — слово без жанра не считается', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genres: [{ id: 35 }] }), null);
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genres: [{ id: 27 }] }).id, 'halloween');
});
test('matchTheme: первое правило по порядку побеждает; нет совпадений → null', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('space', 'christmas'), genres: [] }).id, 'christmas');
  assert.equal(T.matchTheme(rules, { keywords: kw('western'), genres: [] }), null);
  assert.equal(T.matchTheme(rules, { keywords: { keywords: [{ name: 'alien' }] }, genres: [] }).id, 'space'); // формат tv
});
test('seasonalIds: месяц → id подборок с season, включая год через границу', () => {
  const cols = [{ id: 'xmas', season: [12, 1] }, { id: 'hw', season: [10] }, { id: 'plain' }];
  assert.deepEqual(T.seasonalIds(cols, 1), ['xmas']); assert.deepEqual(T.seasonalIds(cols, 10), ['hw']); assert.deepEqual(T.seasonalIds(cols, 5), []);
});
test('adventDays: декабрь → дни 1..min(today,24), детерминированный фильм на день', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, title: 't' + i }));
  const d = T.adventDays(pool, new Date(2026, 11, 5));
  assert.equal(d.length, 5); assert.equal(d[4].day, 5); assert.ok(d[4].lumen_badge.indexOf('Сегодня') === 0);
  assert.deepEqual(T.adventDays(pool, new Date(2026, 11, 5)).map(x => x.id), d.map(x => x.id)); // детерминизм
  assert.equal(new Set(d.map(x => x.id)).size, 5); // без повторов
  assert.deepEqual(T.adventDays(pool, new Date(2026, 10, 30)), []); // ноябрь — пусто
  assert.equal(T.adventDays(pool, new Date(2026, 11, 28)).length, 24);
});
```
- [ ] **Step 2: Модуль themes** — `LC.themes = (function(){ function matchTheme(rules, movie){…}; function seasonalIds(collections, month){…}; function adventDays(pool, today){ /* seed = день; индекс = (day * 7919) % pool.length с обходом повторов */ }; function current(){ return LC.manifest.get().themes || [] } return {…} })();`. Слова сравниваются `name.toLowerCase().indexOf(keyword) >= 0`.
- [ ] **Step 3: Тесты fx (чистая часть)** — `LC.fx.spawn(preset, w, h, n, rnd)` возвращает массив частиц `{x,y,vx,vy,size,life,rot}` длиной `n`, все внутри `[0,w]×[-h*0.2,h]`, `n` не больше `LC.fx.MAX = 60`; `LC.fx.step(particles, dt, w, h)` двигает и заворачивает частицы (снег падает: `vy > 0`; мыши летят по дуге: `vx` знакопеременно; звёзды почти неподвижны), после 1000 шагов ни одна не выходит за границы более чем на размер; `LC.fx.presets` содержит 9 пресетов с полями `{count, spawn, step, draw}`.
- [ ] **Step 4: Рантайм fx** — `LC.fx.mount($layer, preset, opts)`: `<canvas class="lumen-fx__canvas">` по размеру слоя (DPR ≤ 1.5 для экономии), цикл `requestAnimationFrame` с `dt` капом 50 мс, пауза при `document.hidden`, при трейлере (`LC.active.trailer`), при `LC.motionMode() === 'off'`; `unmount` останавливает цикл и удаляет canvas. Пресеты: `bats` (силуэт из `LC.icons`? нет — простой путь крыльев из двух дуг, 10–14 шт., синусоидальный полёт), `snow` (два слоя: 40 мелких + 15 крупных, лёгкий ветер), `stars` (50 точек, мерцание, дрейф 2 px/с), `rain` (40 штрихов под углом, капли на «стекле» — 8 медленных кругов), `sand` (30 частиц дымки, горизонтальное дрожание), `bubbles` (20 пузырей вверх + 3 световых луча), `petals` (18 лепестков, кручение), `embers` (30 искр вверх с угасанием), `glitch` (2 полосы помех раз в 3–6 с + зелёный отсвет). Дополнительно каждая тема может задавать `overlay` (CSS-градиент: тыквенный свет снизу, гирлянда сверху) — задаётся классом `.lumen-theme--<id>` на корне.
- [ ] **Step 5: Применение** — карточка (`complite`): `theme = LC.themes.matchTheme(LC.themes.current(), movie)`; если есть и `lumen_fx !== 'off'` (при `seasonal` — только темы, чей `months` включает текущий месяц) → `$root.addClass('lumen-theme--' + id)`, `LC.fx.mount($root.find('.lumen-fx'), preset)`, акцент темы применяется как временный `--lumen-accent` (если не включён «акцент от постера» — Task 24 решает приоритет: постер > тема > настройка). Герой: то же по деталям (`keywords` из запроса). Уничтожение — в `LC.destroyActive()`.
- [ ] **Step 6: Сезонность и адвент** — хаб: `LC.themes.seasonalIds(manifest.collections, month)` поднимаются в начало списка группы и получают чип «Сезон»; главная: ряды с `season` включающим текущий месяц идут первыми среди подборок; адвент: в декабре `LC.rows` регистрирует ряд `lumen_advent` («Адвент-календарь · день N») из `adventDays(pool)` где `pool` = первые 2 страницы подборок `xmas-comedy` + `christmas` (добавить подборку `christmas` — keyword 207317 без жанра), карточки — обычные (Lampa рисует), метка «День 5 · Сегодня» через `LC.badges` (Task 25) по полю `lumen_badge`.
- [ ] **Step 7: Живая проверка** — карточка «Один дома» (id 771): класс `lumen-theme--christmas`, canvas есть, кадры идут (`window.lumen_card.fx.active() === 1`); «Хэллоуин» (id 948, жанр ужасы): `bats`; «Дюна» (693134): `sand` (keyword «desert» есть? если нет — тема не назначается, это нормально: зафиксировать); после закрытия карточки `fx.active() === 0`. Подменить дату (`Date` мок через `window.lumen_card.themes._now = function(){ return new Date(2026, 11, 5) }` — предусмотреть хук) → на главной ряд адвента с 5 карточками. Commit `feat: атмосферы, темы, сезонность, адвент`.

### Task 22: Ambient-режим

**Files:** Create `src/54_ambient.js`, `test/ambient.test.mjs`, `scripts/ambient-pick.mjs`. Modify `src/42_manifest.js` (`ambient` в DEFAULT), `src/80_settings.js` (`lumen_ambient`: on/off default on; `lumen_ambient_source`: curated / current, default curated; `lumen_ambient_delay`: 3/5/10 минут, default 3), `src/30_css.js`.

- [ ] **Step 1: Курируемый список кадров** — в живой Lampa выполнить скрипт (текст положить в `scripts/ambient-pick.mjs` как строку для вставки в `javascript_tool`): для 40 фильмов/сериалов из списка (Дюна 438631 и 693134, Бегущий по лезвию 2049 335984, Интерстеллар 157336, Оппенгеймер 872585, Аватар: Путь воды 76600, Мандалорец tv 82856, Властелин колец 120, Безумный Макс: Дорога ярости 76341, Начало 27205, Гравитация 49047, Марсианин 286217, Джокер 475557, 1917 530915, Дюнкерк 374720, Матрица 603, Тёмный рыцарь 155, Джон Уик 4 603692, Топ Ган: Мэверик 361743, Форма воды 399055, Ла-Ла Ленд 313369, Паразиты 496243, Драйв 64690, Прибытие 329865, Бёрдмэн 194662, Отель «Гранд Будапешт» 120467, Однажды в Голливуде 466272, Стражи Галактики 118340, Человек-паук: Через вселенные 324857, Унесённые призраками 129, Твоё имя 372058, Барби 346698, Everything Everywhere 545611, Killers of the Flower Moon 466420, Poor Things 792307, Фоллаут tv 106379, Разделение tv 95396, Андор tv 83867, Игра в кальмара tv 93405, Одни из нас tv 100088, Шоу Трумана 37165) запросить `Lampa.Api.sources.tmdb.get(media + '/' + id + '/images', { filter: { include_image_language: 'null' } }, ok)`, отобрать `backdrops` с `iso_639_1 === null`, `width >= 3840`, топ-2 по `vote_average` (если нет 4K — топ-1 с `width >= 1920`), собрать JSON `{media, id, title, path, width}` и вставить в `LC.manifest.DEFAULT.ambient` (и `manifest.json`). Итог: 60–80 кадров.
- [ ] **Step 2: Тесты** — `sizeFor(widthPx)` → `'w1280'` при ≤ 1366, иначе `'original'`; `nextIndex(i, len, rnd)` — случайный, не равный текущему; `canStart(state)` → false при открытом модале/плеере, чужом контроллере, `lumen_ambient` off, `motion off`; `schedule` — таймер сбрасывается на активность (тест с фейковыми таймерами: подменяемые `setTimeout/clearTimeout` через параметры модуля `LC.ambient._timers`).
- [ ] **Step 3: Рантайм** — слушатели `keydown/mousemove/touchstart` на `document` (capture) сбрасывают таймер; таймер = `lumen_ambient_delay` минут; старт: `canStart()` → слой `<div class="lumen-ambient">` с двумя `.lumen-ambient__img` (кроссфейд 2 с, смена каждые 20 с, наезд 1.00→1.06 за 20 с), логотип фильма мелко (из `LC.logos`, Task 24; до него — название текстом), часы `HH:MM`, точки-индикатор; кадр: `Lampa.TMDB.image('t/p/' + sizeFor(screen.width * (window.devicePixelRatio || 1)) + item.path)`, предзагрузка следующего; источник `current` — кадры открытой карточки (`LC.active.backdrops` из слайдшоу Task 6). Выход: первое `keydown` в capture-фазе — `preventDefault(); stopPropagation();` убрать слой за 400 мс, восстановить таймер. Пока слой активен, слайдшоу карточки и частицы на паузе.
- [ ] **Step 4: Живая проверка** — установить задержку через хук `window.lumen_card.ambient._delayMs = 3000`, подождать 4 с без клавиш: `.lumen-ambient` есть, `img` src содержит `t/p/original` (при 1920×1080 вьюпорте `screen.width*dpr` может быть ≤ 1366 — тогда `w1280`; зафиксировать); через 25 с второй кадр активен; `keydown` 40 → слой исчез, фокус на карточке не сдвинулся (первое нажатие проглочено). Открыть модал (`Lampa.Modal.open`) и подождать — ambient не стартует. Commit `feat: ambient-режим`.

### Task 23: Рулетка «Что посмотреть»

**Files:** Create `src/56_roulette.js`, `test/roulette.test.mjs`. Modify `src/46_hub.js` (кнопки «Рулетка» в хабе и в сетке подборки), `src/48_hero.js` («Мне повезёт» в чипах настроения), `src/30_css.js`, `src/80_settings.js` (`lumen_roulette_unseen` default on).

- [ ] **Step 1: Тесты чистых функций** — `buildPool(results, media)` — фильтрует по медиа (`movie`: нет `name`/`first_air_date`; `tv`: есть), убирает дубли; `applyFilters(pool, {unseen, short}, ctx)` где `ctx = {isSeen(id), runtime(id)}` — `unseen` убирает `isSeen`, `short` оставляет `runtime <= 90` (tv: `<= 30`) и неизвестные (null) — неизвестные проверяются позже; `pick(pool, rnd)` — равномерный выбор; `spinPlan(total)` → массив шагов барабана (разгон 400 мс, вращение 1800 мс, торможение 900 мс), сумма длительностей 3100 ± 50, последний шаг попадает на выбранный индекс.
- [ ] **Step 2: Компонент `lumen_roulette`** (образец — хаб): вход `object.media` ('movie'|'tv'), `object.preselect` (id подборки, опционально). Экран 28: переключатель Фильмы/Сериалы (`.selector`, переключает `object.media` без перезагрузки), чипы подборок (все + группы, галочки, состояние в `Storage 'lumen_roulette_' + media`), чипы фильтров, барабан из постеров (лента `.lumen-roulette__reel`, три видимых, `transform: translateY`), кнопка «Крутить». Данные: для выбранных подборок `LC.sources.fetch(item, 1)` и `2` (кэш) → `buildPool` → `applyFilters` (`isSeen`: `Lampa.Favorite.check(card).viewed || history` + `Timeline.view(hash).percent >= 95`; `runtime` из кэша деталей `LC.details.get(media, id)` — если деталей нет, кандидат допускается и проверяется после выбора: при провале фильтра «90 минут» перевыбор до 5 раз). Результат: кадр-фон, логотип/название, мета, кнопки «Смотреть» (→ `Lampa.Activity.push({component:'full', id, method: media, card, source:'tmdb'})`), «Ещё раз», «В закладки» (`Lampa.Favorite.toggle('book', card)` + Noty). Звук не нужен.
- [ ] **Step 3: Входы** — хаб: кнопка «Рулетка · Фильмы» и «Рулетка · Сериалы» в шапке хаба; сетка подборки: кнопка «Крутить по этой подборке» (`preselect`); главная: чип «Мне повезёт» → рулетка фильмов со всеми подборками.
- [ ] **Step 4: Живая проверка** — открыть `Lampa.Activity.push({component:'lumen_roulette', media:'movie', title:'Рулетка'})`, снять чип «Все», выбрать «Звёздные войны», «Крутить» → через ~3.2 с результат из 9 фильмов коллекции; «Ещё раз» даёт другой (не обязательно, но за 5 попыток минимум 2 разных); переключить на «Сериалы» → чипы сериальных подборок, результат — сериал (`method:'tv'`); «Смотреть» открывает карточку; назад → рулетка. Commit `feat: рулетка фильмов и сериалов`.

### Task 24: Логотипы и акцент от постера

**Files:** Create `src/57_color.js`, `src/58_logos.js`, `test/color.test.mjs`, `test/logos.test.mjs`. Modify `src/48_hero.js` (использовать `LC.logos.pickLogo`), `src/90_runtime.js` (логотип в карточке вместо текстового заголовка при `lumen_logo`), `src/56_roulette.js`, `src/54_ambient.js`, `src/80_settings.js` (`lumen_logo` on/off default on; `lumen_accent_mode`: fixed / poster / theme, default poster).

- [ ] **Step 1: Тесты color** — `rgbToHsl/hslToRgb` round-trip; `adjust({h,s,l})` → `s` в [0.45, 0.85], `l` в [0.55, 0.72] (акцент читается на тёмном); `onAccent(hsl)` → тёмный `#1A120A`-подобный с тем же оттенком (`l ≤ 0.12`); `glow(hsl)` → `rgba(r,g,b,.35)`; `dominant(pixels)` — усреднение с отбрасыванием почти серых и почти чёрных/белых (тест: массив пикселей с 70 % серых и 30 % синих → синий).
- [ ] **Step 2: Рантайм color** — `LC.color.fromImage(url, cb)`: `new Image()`, `crossOrigin = 'anonymous'`, canvas 32×32, `drawImage`, `getImageData` в `try/catch` (SecurityError → `cb(null)`), кэш по url в памяти (Map нельзя — объект) на 50 записей.
- [ ] **Step 3: Логотипы** — `LC.logos.pickLogo(logos, langs)` (перенос из hero с тестами: ru → en → без языка → null; предпочитать `png`/`svg` по `file_path`), `LC.logos.get(media, id, cb)` — из кэша деталей героя, иначе `tmdb.get(media + '/' + id + '/images', { filter: { include_image_language: 'ru,en,null' } }, …, { life: 10080 })`; URL `Lampa.TMDB.image('t/p/w500' + path)`. Карточка: если `lumen_logo` и логотип есть — `<img class="lumen-logo">` (макс. ширина 26em, высота 7em) вместо текста, текст остаётся в DOM для Lampa (`.full-start-new__title` скрывается CSS-классом `.lumen-title--logo`; `start.js` продолжает писать туда). Ошибка загрузки логотипа → вернуть текст.
- [ ] **Step 4: Акцент** — приоритет: `poster` (если удалось посчитать) → тема (Task 21) → фиксированный из настроек. Применение: `root.style.setProperty('--lumen-accent', …)` и производные `--lumen-on-accent`, `--lumen-ring`, `--lumen-glow`; CSS фазы 1 должен использовать эти переменные (проверить `LC.buildCss`: акцент там подставляется строкой — перевести на переменные с фолбэком `var(--lumen-accent, #E8B87A)`). Герой: акцент фокусной карточки (по постеру из `card_data.poster_path`, `w185`).
- [ ] **Step 5: Живая проверка** — «Дюна»: логотип показан (в `images.logos` он есть), `--lumen-accent` песочно-оранжевый (проверить `getComputedStyle(root).getPropertyValue('--lumen-accent')` — не равен дефолту); «Аватар: Путь воды» — синий; фильм без логотипа (найти, например id 1000 из discover) — текстовый заголовок. CORS-ошибок в консоли нет (если есть — включить фолбэк и зафиксировать). Commit `feat: логотипы и акцент от постера`.

### Task 25: Метки на постерах, обратный отсчёт, скелетоны

**Files:** Create `src/62_badges.js`, `test/badges.test.mjs`. Modify `src/30_css.js`, `src/90_runtime.js` (обратный отсчёт в мета-строке карточки; скелетоны описания/отзывов), `src/44_rows.js`/`src/45_personal.js` (поле `lumen_badge` у карточек), `src/80_settings.js` (`lumen_badges` on/off).

- [ ] **Step 1: Тесты** — `badgeFor(card, today, ctx)` где `ctx = {progress(card) → percent|null, quality(card) → string|null}`: `release_date` в будущем → `{kind:'soon', text:'Скоро · 17 дек'}`; в последние 30 дней → `'Новинка'`; `progress` 5–95 → `'Продолжить · 43 %'` с `percent`; `card.lumen_badge` (адвент, новые серии) имеет приоритет; `quality` → `'4K'` вторым бейджем; ничего → null; `countdown(dateStr, today)` → `'Премьера через 31 день · 17 декабря'` / `'Премьера завтра'` / `'Сегодня премьера'` / null для прошлого; склонение дней (1 день, 2 дня, 5 дней).
- [ ] **Step 2: Рантайм** — наблюдатель `childList` на `.scroll__body` активности главной (и сеток `lumen_grid`, хаба): для добавленных `.card` (и уже существующих при монтировании) → `badgeFor(el.card_data)` → вставить `<div class="lumen-badge lumen-badge--soon">` внутрь `.card__view` (не трогая штатные `.card__quality/.card__type`), прогресс — с полосой внизу постера. Не более одной вставки на элемент (флаг `el.lumen_badged`). Отключение наблюдателя при `destroy` активности.
- [ ] **Step 3: Обратный отсчёт в карточке** — в мета-строке (Task 5) для `release_date > today` — чип `countdown(...)`; для сериалов уже есть «Следующая серия».
- [ ] **Step 4: Скелетоны** — CSS `.lumen-skeleton` (плашки с shimmer 1.4 с, при motion off — статичные); применить: описание героя до загрузки деталей, блок отзывов до ответа, ряды подборок хаба (плитки без постеров).
- [ ] **Step 5: Живая проверка** — главная: у карточек с датой в будущем метка «Скоро»; после `Timeline.update` для «Дюны» на 40 % — на её постере в «Досмотреть» метка «Продолжить · 40 %»; в карточке будущего фильма (найти через `discover/movie?primary_release_date.gte=<+20д>`) — чип «Премьера через N дней». Наблюдателей после ухода с главной — 0. Commit `feat: метки на постерах, обратный отсчёт, скелетоны`.

### Task 26: Контекстное меню карточки

**Files:** Create `src/63_cardmenu.js`, `test/cardmenu.test.mjs`. Modify `src/30_css.js`.

- [ ] **Step 1: Исследовать штатное меню** — прочитать `src/interaction/card/module/menu.js` (curl из lampa-source): как формируется список пунктов (ожидаемо массив `menu` → `Select.show({title, items, onSelect})`), есть ли событие для плагинов (`Lampa.Listener.send('card', {type:'menu', …})`, `card.onMenu`) или публичный хук. Проверить живьём: удержание OK на постере главной (диспатч `keydown` 13 с `repeat`? — Lampa различает long через таймер удержания: диспатчить `keydown` без `keyup` на 800 мс, затем `keyup`; см. `src/core/keypad`/`hover:long` реализацию в `vender/navigator`) → какое меню открылось (`Lampa.Controller.enabled().name === 'select'`, пункты). Записать точку расширения в комментарий модуля. Если хука нет — вариант Б: обёртка над `Lampa.Select.show`: если `params.items` содержит штатные пункты меню карточки (распознать по наличию пункта с `Lampa.Lang.translate('title_book')` или по `params.title === Lampa.Lang.translate('title_action')`) и `LC.cardmenu.lastCard` (последняя карточка в фокусе из наблюдателя героя) — дописать свои пункты в конец. Обёртка ставится один раз, восстанавливается при выключении настройки.
- [ ] **Step 2: Тесты** — `extraItems(card, ctx)` → пункты по данным: «Трейлер» всегда; «Вся франшиза» только если `ctx.collection` известна (из кэша деталей); «Похожие»; «В закладки»/«Убрать из закладок» по `ctx.booked`; «Скрыть» (`thrown`). Каждый — `{title, lumen: 'trailer'|'franchise'|'similar'|'book'|'hide'}`.
- [ ] **Step 3: Действия** — трейлер: `tmdb.get(media + '/' + id + '/videos', {langs:'ru-RU'})`, fallback `en-US`, `LC.trailer.pickTrailer` → `Lampa.YouTube.play(key)` если `Lampa.YouTube` есть и не Android, на Android — `Lampa.Android.openYoutube(key)` (как штатно, API_NOTES_2 §2), иначе Noty; франшиза → `lumen_grid` коллекции; похожие → `Lampa.Activity.push({url: media + '/' + id + '/similar', component:'category_full', source:'tmdb', page:1})`; закладки/скрыть → `Lampa.Favorite.toggle`, Noty; после `Скрыть` — если `lumen_hide_watched`/скрытые фильтруются в рядах — карточку убрать из DOM ряда (`$(el).remove()` только своей копии? нет — штатный ряд; оставить до следующего построения, Noty «Скрыто, исчезнет при обновлении»).
- [ ] **Step 4: Живая проверка** — удержание OK на постере → в меню есть наши пункты после штатных; «Похожие» открывает сетку; «В закладки» меняет текст на «Убрать из закладок» при повторном открытии; назад возвращает фокус на тот же постер. Commit `feat: контекстное меню карточки`.

### Task 27: Навигационные ускорители и поиск подборок

**Files:** Create `src/64_nav.js`, `test/nav.test.mjs`. Modify `src/46_hub.js` (строка поиска), `src/30_css.js`, `src/80_settings.js` (`lumen_minimap` on/off, `lumen_fastscroll` on/off).

- [ ] **Step 1: Тесты** — `holdTracker` (чистый автомат): события `{key, type:'down'|'up', t}` → состояние `{holding, repeats, fast}`; `fast` становится true после 6 повторов одной клавиши в пределах 1200 мс и сбрасывается на `up`; `minimapModel(rowTitles, activeIndex)` → элементы с флагом `active` и «окно» из 7 строк вокруг активной; `searchCollections(collections, query)` → по вхождению в `title` без регистра и по `id`, сортировка: начало слова раньше, не больше 8.
- [ ] **Step 2: Мини-карта** — на главной при `holding` клавиши 40/38 ≥ 500 мс показать `.lumen-minimap` справа: названия рядов из `$('.items-line__title', activity)`, активный из `LC.rows` (событие `line toggle`), обновлять на каждом `toggle`; скрыть через 800 мс после `up`. Не перехватывать сами нажатия — только отображение.
- [ ] **Step 3: Ускорение** — при `fast` для 37/39 внутри ряда: на каждое событие `keydown` дополнительно дважды `Lampa.Controller.move('right'|'left')` (проверить наличие `Controller.move`; иначе `Navigator.move`) — итого ×3; при `up` — стоп. Для 40/38 — не ускорять (мини-карта и так помогает).
- [ ] **Step 4: Поиск подборок в хабе** — кнопка «Найти подборку» (`.selector`, иконка `search` — добавить в набор иконок с тем же стилем) → `Lampa.Input.edit({title: 'Подборка', value: '', free: true, nosave: true}, function (q) { … })` (проверить сигнатуру в `src/interaction/input.js`) → результаты `searchCollections` показываются `Lampa.Select.show({title: 'Подборки', items: [{title, item}], onSelect: open, onBack: → 'content'})`. Голосовой ввод: grep `voice` по `src/core/android.js`/`src/core/platform.js`/`src/interaction/input.js` — если Lampa сама предлагает микрофон в `Input` на Android, ничего не делать; иначе зафиксировать «нет API» в acceptance и закрыть пункт.
- [ ] **Step 5: Живая проверка** — диспатч `keydown` 40 подряд 8 раз с интервалом 120 мс без `keyup` → `.lumen-minimap` видима с подсветкой активного; `keyup` → скрылась через ~0.8 с; 39 ×8 быстро в ряду → фокус ушёл дальше, чем на 8 карточек; поиск «звёзд» → «Звёздные войны». Commit `feat: мини-карта, ускорение, поиск подборок`.

### Task 28: Хронология франшизы, отзывы без спойлеров, автотрейлер в герое

**Files:** Create `src/66_franchise.js`, `test/franchise.test.mjs`. Modify `src/60_reviews.js` (режим headlines), `src/48_hero.js` (автотрейлер), `src/80_settings.js` (`lumen_reviews_mode`: headlines / full, default headlines; `lumen_hero_trailer` on/off default on), `src/30_css.js`.

- [ ] **Step 1: Тесты franchise** — `orderParts(parts, mode)`: `chronology` (по `release_date`, без даты — в конец), `rating`, `release` (то же, что chronology, но с датами будущего в конце и пометкой), `markWatched(parts, ctx)` → `watched: true` при `viewed`/percent ≥ 95, `current: true` для открытого фильма; `nextToWatch(parts)` → первый непросмотренный после текущего.
- [ ] **Step 2: Ряд в карточке** — при `belongs_to_collection`: `tmdb.get('collection/' + id, {langs:'ru-RU'}, …, {life: 10080})` → ряд «Смотреть по порядку» внутри блока описания (как отзывы, Task 9 Step 4): карточки `Lampa.Card` с номером `№ 3 из 9`, отметкой ✓ просмотренного (иконка `check` — добавить в набор), «Вы здесь» для текущего, «Дальше» — первая непросмотренная; OK → карточка фильма. Переключатель порядка «Хронология / По рейтингу» чипами (локальная сортировка).
- [ ] **Step 3: Отзывы без спойлеров** — в `render` отзывов (Task 9): при `headlines` карточка отзыва показывает автора, дату, тон, заголовок и «полезно», текст скрыт; OK открывает модал с полным текстом (уже есть). Переключатель в шапке блока «Показывать текст» (`.selector`) переключает режим на лету и сохраняет.
- [ ] **Step 4: Автотрейлер в герое** — после 8 с покоя фокуса на карточке (таймер поверх debounce 350 мс героя): `tmdb.get(media + '/' + id + '/videos', {langs:'ru-RU'})`, fallback `en-US`, `LC.trailer.pickTrailer` → `LC.trailerPlayer($hero, key, onStart, onEnd)` (Task 7) в `.lumen-hero__bg`; при старте — класс `.lumen-hero--trailer` (вуали слабее, текст компактнее — экран 02 по аналогии); любой перевод фокуса, уход с главной, ambient → `destroy`. На Tizen/webOS — по `lumen_trailer` auto = off.
- [ ] **Step 5: Живая проверка** — «Дюна: Часть вторая» (коллекция «Дюна» 726871): ряд с двумя фильмами, «Вы здесь» на второй, отметка на первой после `Timeline.update` до 96 %; отзывы (с ключом) в режиме заголовков; главная: фокус на карточке 9 с → `.lumen-hero--trailer` и `iframe` в герое; ← → трейлер снят. Commit `feat: хронология франшизы, отзывы без спойлеров, автотрейлер`.

### Task 29: Переход постер → кадр и автодетект слабого ТВ

**Files:** Create `src/67_transition.js`, `src/68_perf.js`, `test/perf.test.mjs`. Modify `src/48_hero.js` (сохранять `rect` и `poster` фокусной карточки), `src/90_runtime.js` (сигнал готовности кадра карточки), `src/80_settings.js` (`lumen_transition` on/off default on).

- [ ] **Step 1: Тесты perf** — `decide(samplesMs)` → `'lite'` если медиана ≥ 400 мс за 3 замера, `'full'` если < 250, иначе `null` (не менять); `merge(stored, decision)` — понижение сохраняется, повышение только после 5 хороших замеров.
- [ ] **Step 2: Perf** — замер: `complite` карточки → `requestAnimationFrame` ×2 → `performance.now()` разница; 3 первых карточки после старта; `LC.motionMode()` учитывает `Storage 'lumen_motion_auto'`; при понижении — `Lampa.Noty.show('Lumen Card: включены лёгкие анимации')` один раз (`Storage 'lumen_motion_noty'`).
- [ ] **Step 3: Переход** — герой (Task 18) при фокусе сохраняет `LC.hero.last = {rect: el.getBoundingClientRect(), poster: Lampa.TMDB.image('t/p/w342' + poster_path), id}`; на `Lampa.Listener 'activity'` `start` с `component === 'full'` и `LC.hero.last.id === e.object.id` (проверить поле id в `e.object`) → создать `.lumen-overlay` (fixed) с `img` постера в `rect`, за 480 мс `cubic-bezier(.2,.8,.2,1)` перевести в прямоугольник экрана (масштаб по высоте, центр) с `opacity: 1 → 0` на последних 40 %; удалить по `transitionend` или через 700 мс; при `motion !== 'full'` — не показывать. Кадр карточки под оверлеем грузится параллельно (Task 5/6).
- [ ] **Step 4: Живая проверка** — с главной OK на постере: в течение 500 мс существует `.lumen-overlay`, затем исчезает; карточка открыта, ошибок нет; `window.lumen_card.perf.samples()` содержит 3 замера, режим не понизился на десктопе (если понизился — порог не трогать, зафиксировать значения замеров в acceptance для калибровки на реальном ТВ). Commit `feat: переход постер → кадр, автодетект слабого ТВ`.

### Task 30: Настройки фазы 3, README, ревью, чек-лист

- [ ] Настройки: все параметры фазы 3 в компоненте `lumen_card`, сгруппированы заголовками-разделителями (в `SettingsApi` — параметр типа `title`, проверить наличие; иначе префиксы в названиях): «Атмосферы», «Ambient», «Рулетка», «Оформление», «Навигация».
- [ ] README: разделы по каждой фишке (что делает, как выключить, откуда данные), «Как добавить тему в манифест», «Как добавить кадр в ambient», ограничения (частицы отключаются на слабых ТВ; трейлеры в герое только там, где работает YouTube).
- [ ] Ревью `code-reviewer` на модули 52–68 с инвариантами фаз 1–2 плюс: ни один слой не перехватывает клавиши, кроме выхода из ambient; все наблюдатели/таймеры/canvas уничтожаются (`window.lumen_card.fx.active() === 0`, `hero.observers() === 1` на главной, `0` вне её); при `motion off` нет ни одного `requestAnimationFrame`-цикла.
- [ ] Финальный чек-лист живой проверки всех фаз (карточка, главная, хаб, рулетка, ambient, темы) — по одному скриншоту на экран брифов 01–32, сложить описания в `docs/plans/acceptance-final.md`.
- [ ] Публикация: `dist/lumen_card.js` и `manifest.json` на GitHub Pages (`gh` на машине нет — пользователь создаёт репозиторий, план даёт команды `git remote add` + `git push` + включение Pages в настройках репозитория), в `00_head.js` заполнить `LC.MANIFEST_URL`, пересобрать, закоммитить, сообщить пользователю URL для установки.

## 4. Риски

| Риск | Митигация |
|---|---|
| Штатное меню карточки без точки расширения | вариант Б — обёртка над `Lampa.Select.show` с распознаванием контекста; включается настройкой, по умолчанию on, при ошибке распознавания — ничего не добавляем |
| Canvas-частицы тормозят старые ТВ | ≤ 60 частиц, DPR ≤ 1.5, пауза при скрытой вкладке/трейлере, автодетект → `lite` (частицы отключены) |
| CORS на постерах для расчёта цвета | `try/catch` → фолбэк на тему/фиксированный акцент, без ошибок в консоли |
| Ambient стартует в неподходящий момент (плеер, ввод текста) | `canStart` проверяет модал, плеер, контроллер, наличие открытого `Lampa.Input` (проверить признак); выход проглатывает первое нажатие |
| Автотрейлер в герое мешает навигации | старт только после 8 с покоя, любой перевод фокуса снимает; на Tizen/webOS выключен |
| Много наблюдателей DOM | один наблюдатель на активность (герой + метки используют общий `LC.observe(root, handlers)`), отключение по `activity destroy` |

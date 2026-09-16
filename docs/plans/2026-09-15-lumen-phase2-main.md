# Lumen Card — фаза 2: главная в стиле Netflix и подборки

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** На главной Lampa появляются герой фокусного фильма и ряды подборок (франшизы, темы, сервисы, страны, эпохи, люди, топы Кинопоиска) плюс персональные ряды; в левом меню — экран «Подборки» с группами и сетками; всё без своего парсера, на данных TMDB и API Кинопоиска.

**Architecture:** Продолжение плагина из фазы 1 (`docs/plans/2026-09-15-lumen-card.md`): те же модули `src/NN_*.js`, контракт модулей из раздела 1.1 того плана, та же сборка и тесты. Подборки описываются декларативно в JSON-манифесте (встроенный по умолчанию + загружаемый с хостинга с кэшем 12 ч). Один загрузчик источников превращает описание в `{results[]}` для штатных механизмов Lampa: ряды на главной — через `Lampa.ContentRows.add`, сетки — через штатный `category_full` (discover) или свой компонент `lumen_grid` (коллекции, списки, Кинопоиск). Герой — DOM-слой над рядами главной, обновляется по фокусу карточки через MutationObserver.

**Tech Stack:** тот же, что в фазе 1. Ресёрч: `C:\Users\azark\AppData\Local\Temp\lampa\API_NOTES_4.md` (главная, ContentRows, discover, id TMDB, Кинопоиск), `API_NOTES_3.md` (события активности, контроллеры, модалки).

---

## 0. Факты, на которых строится фаза (проверено в Lampa 3.3.4)

- **Из фазы 1 (проверено живьём):** **События активностей Lampa 3.3.4 (найдено в Task 6, исходник + живой лог):** `Lampa.Activity.push` НЕ шлёт события для покидаемой активности; `backward()` шлёт `start`, затем `archive` для активности, к которой ВЕРНУЛИСЬ (`e.object` — её объект), и `destroy` — для удалённой. Поэтому «пауза при уходе вглубь» делается проверкой `closest('.activity').hasClass('activity--active')` в тике таймера, а не подпиской; при `start` полной карточки восстанавливать `LC.active` на вернувшийся объект. **Булевы настройки:** `Lampa.Storage.set(name, false)` с JS-значением `false` не сохраняется (`Storage.get`: `value || empty`); переключатели настроек Lampa пишут строки `'true'` / `'false'` — читать через `Lampa.Storage.field` и сравнивать и со строкой, и с булевым; в живых проверках ставить строку.

- **Ряд на главную**: `Lampa.ContentRows.add({name, title, screen:'main', index, call: function(params, screen){ return function(call){ … call(json) } }})`, где `json = {results:[…], title}`. Проверено: ряд из коллекции «Звёздные войны» появился и открывает карточки. Регистрировать до построения главной (при `init` плагина); `index` — позиция среди рядов. Если `params.genres`/`params.keywords` заданы (экран категории), `call` не вызывается — нам нужно только `screen:'main'`.
- **Запросы к TMDB через Lampa** (идут через прокси пользователя и кэшируются): `Lampa.Api.sources.tmdb.get(url, params, ok, err, {life: минуты})`. `params` → query: `genres→with_genres`, `keywords→with_keywords`, `companies→with_companies`, `networks→with_networks`, `watch_providers→with_watch_providers`, `watch_region`, `sort_by`, `orig_lang→with_original_language`, `page`, `langs` (язык), `filter:{любой_ключ: значение}` → как есть.
- **Ответы, которые надо нормализовать**: `collection/{id}` → `parts[]` (не `results`), `list/{id}` → `items[]`, discover → `results[]`. `category_full` с `url:'collection/10'` падает (`TypeError`), поэтому коллекции и списки открываем своей сеткой.
- **Сетка штатная**: `Lampa.Activity.push({url:'discover/movie?with_keywords=379196&with_genres=35', title, component:'category_full', source:'tmdb', page:1})` — query-строка в `url` работает, есть пагинация.
- **Меню**: `Lampa.Menu.addButton(svgHtml, title, onEnter)` добавляет `<li class="menu__item selector">` в первый список меню (`src/interaction/menu/menu.js:381`).
- **Свой компонент-активность**: `Lampa.Component.add('name', function(object){ this.create/start/pause/stop/render/destroy })`, образец — `plugins/iptv/component.js` (lifecycle, `Lampa.Controller.add('content', {toggle, left→'menu', up→'head', back→Lampa.Activity.backward})`, `this.activity.loader(true|false)`, `Lampa.Layer.update/visible`). Открывается `Lampa.Activity.push({title, component:'name', page:1, …любые поля object})`.
- **Фокус карточки в ряду**: данные лежат в нативном свойстве DOM-узла `el.card_data` (`id, title|name, backdrop_path, poster_path, overview, vote_average, genre_ids, release_date|first_air_date, media_type`). `$(el).data()` пуст. Делегирование `hover:focus` через `$(document).on` не работает; рабочий способ — `MutationObserver` на `attributeFilter:['class']`, `subtree:true`, реагировать на `.card.focus`. `Lampa.Listener 'line'` даёт `toggle/append/create/visible` (ряд получил фокус — по нему определяем «фокус ниже первого ряда»).
- **Штатный фон главной**: при фокусе карточки Lampa сама вызывает `Background.change(...)` (размытый фон). Не трогаем; герой рисуется поверх.
- **История и закладки**: `Lampa.Favorite.get({type:'history'|'book'|'like'|'wath'|'viewed'|'thrown'|…})` → массив карточек (объекты TMDB); `Lampa.Favorite.continues('movie'|'tv'|'anime')` → «продолжить»: история минус досмотренное/брошенное, до 19 карточек (`src/core/favorite.js:378`). С CUB-аккаунтом данные приходят из `Account.Bookmarks` — тот же формат. Проверить в первом шаге Task 16, что `Lampa.Favorite` экспортирован и `continues` есть в объекте.
- **Идентификаторы TMDB** (живые запросы): keyword christmas 207317, star wars 379196; жанры комедия 35, драма 18, мультфильм 16, ужасы 27, фантастика 878, семейный 10751, боевик 28, приключения 12; коллекции Звёздные войны 10 (9 фильмов), Гарри Поттер 1241, Властелин колец 119, Хоббит 121938; компании Lucasfilm 1, Pixar 3, Marvel Studios 420, Studio Ghibli 10342, A24 41077, DC Studios 128064; сети Netflix 213, Apple TV+ 2552; провайдер Netflix 8 только в регионе US (в RU его нет — для фильмов Netflix использовать `companies` или keyword «netflix original»? нет такого — использовать сеть 213 для сериалов и `watch_providers=8&watch_region=US` для фильмов с оговоркой); Apple TV провайдер 350 есть в RU; люди Нолан 525, Тарантино 138, Ди Каприо 6193; список TMDB `list/10` — «Top 50 Grossing Films», читается без аккаунта.
- **Кинопоиск**: `GET https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=TOP_250_MOVIES&page=1`, заголовок `X-API-KEY`, CORS открыт; типы: TOP_250_MOVIES, TOP_250_TV_SHOWS, TOP_POPULAR_ALL, POPULAR_SERIES, FAMILY, KIDS_ANIMATION_THEME, COMICS_THEME, VAMPIRE_THEME, ZOMBIE_THEME, LOVE_THEME, CATASTROPHE_THEME, OSKAR_WINNERS_2021; ответ `{total, totalPages, items:[{kinopoiskId, imdbId, nameRu, year, rating}]}`. Маппинг на TMDB: `Lampa.Api.sources.tmdb.get('find/' + imdbId, {filter:{external_source:'imdb_id'}}, ok)` → `movie_results[0] || tv_results[0]`. Цена: 1 запрос КП + до 20 запросов TMDB на страницу; кэшировать 30 дней.
- **Файлы плана фазы 1, которые фаза 2 переиспользует**: `LC.util`, `LC.pref`, `LC.lang`, `LC.icons` (Task 3), `LC.reviews` (ключ Кинопоиска `lumen_kp_key`, Task 9), `LC.motionMode` (Task 4).

## 1. Файлы фазы 2

```
src/42_manifest.js    LC.manifest — встроенный манифест + загрузка с хостинга, кэш 12 ч, сезонная сортировка
src/43_sources.js     LC.sources — buildRequest(spec, page), normalize(type, json), fetch(spec, page, ok, err), discoverUrl(spec), kp-маппинг
src/44_rows.js        LC.rows — регистрация рядов подборок на главной (ContentRows), выбор рядов, «скрыть досмотренное»
src/45_personal.js    LC.personal — ряды «Досмотреть», «Потому что вы смотрели», «Новые серии», «Скоро»
src/46_hub.js         LC.hub — пункт меню, компонент lumen_hub (группы + плитки), компонент lumen_grid (сетка коллекции/списка/КП), кнопка «Франшиза» в карточке
src/48_hero.js        LC.hero — герой над рядами главной и мини-герой в сетках
src/30_css.js         + CSS главной, хаба, сетки, героя, чипов настроения (правила с префиксом .lumen-main / .lumen-hub / .lumen-grid / .lumen-hero)
src/80_settings.js    + параметры фазы 2
manifest.json         публикуемый манифест (корень репозитория) — копия LC.manifest.DEFAULT в JSON, обновляется отдельно от плагина
test/manifest.test.mjs, test/sources.test.mjs, test/rows.test.mjs, test/personal.test.mjs, test/hero.test.mjs
```

Нумерация 42–48 не пересекается с модулями фазы 1 (20, 30, 40, 50, 55, 60, 70, 80, 90). Порядок загрузки не критичен: модули только объявляют функции, всё вызывается из `LC.init`.

## 2. Формат манифеста (источник правды для подборок)

```json
{
  "version": 1,
  "collections": [
    {"id": "star-wars", "title": "Звёздные войны", "group": "franchise", "icon": "film",
     "sources": {"movie": {"type": "collection", "id": 10}, "tv": {"type": "discover", "params": {"keywords": 379196, "sort_by": "popularity.desc"}}}},
    {"id": "xmas-comedy", "title": "Рождественские комедии", "group": "theme", "icon": "star", "season": [12, 1],
     "sources": {"movie": {"type": "discover", "params": {"genres": 35, "keywords": 207317, "sort_by": "popularity.desc"}}}},
    {"id": "comedy", "title": "Комедии", "group": "theme", "sources": {"movie": {"type": "discover", "params": {"genres": 35, "sort_by": "popularity.desc", "filter": {"vote_count.gte": 200}}}}},
    {"id": "netflix-comedy", "title": "Комедии от Netflix", "group": "service", "badge": "NETFLIX",
     "sources": {"tv": {"type": "discover", "params": {"genres": 35, "networks": 213, "sort_by": "popularity.desc"}}, "movie": {"type": "discover", "params": {"genres": 35, "watch_providers": 8, "watch_region": "US", "sort_by": "popularity.desc"}}}},
    {"id": "apple-tv", "title": "Сериалы Apple TV+", "group": "service", "badge": "APPLE TV+", "sources": {"tv": {"type": "discover", "params": {"networks": 2552, "sort_by": "popularity.desc"}}}},
    {"id": "pixar", "title": "Pixar", "group": "studio", "sources": {"movie": {"type": "discover", "params": {"companies": 3, "sort_by": "popularity.desc"}}}},
    {"id": "ghibli", "title": "Studio Ghibli", "group": "studio", "sources": {"movie": {"type": "discover", "params": {"companies": 10342, "sort_by": "popularity.desc"}}}},
    {"id": "nolan", "title": "Фильмы Нолана", "group": "people", "sources": {"movie": {"type": "discover", "params": {"sort_by": "popularity.desc", "filter": {"with_people": 525}}}}},
    {"id": "kdrama", "title": "Дорамы", "group": "country", "sources": {"tv": {"type": "discover", "params": {"genres": 18, "sort_by": "popularity.desc", "filter": {"with_origin_country": "KR"}}}}},
    {"id": "anime", "title": "Аниме", "group": "country", "sources": {"tv": {"type": "discover", "params": {"genres": 16, "orig_lang": "ja", "sort_by": "popularity.desc"}}}},
    {"id": "best-80s", "title": "Лучшее из 80-х", "group": "era", "sources": {"movie": {"type": "discover", "params": {"sort_by": "vote_average.desc", "filter": {"primary_release_date.gte": "1980-01-01", "primary_release_date.lte": "1989-12-31", "vote_count.gte": 500}}}}},
    {"id": "top-grossing", "title": "Самые кассовые", "group": "top", "sources": {"movie": {"type": "list", "id": 10}}},
    {"id": "kp-top250", "title": "Топ-250 Кинопоиска", "group": "kp", "badge": "КИНОПОИСК", "sources": {"movie": {"type": "kp", "collection": "TOP_250_MOVIES"}}}
  ],
  "groups": [
    {"id": "franchise", "title": "Франшизы"}, {"id": "studio", "title": "Студии"}, {"id": "service", "title": "Сервисы"},
    {"id": "theme", "title": "Темы"}, {"id": "country", "title": "Страны"}, {"id": "era", "title": "Эпохи"},
    {"id": "people", "title": "Люди"}, {"id": "top", "title": "Топы"}, {"id": "kp", "title": "Кинопоиск"}, {"id": "mood", "title": "Настроение"}
  ],
  "home": ["continue", "because", "new-episodes", "soon", "star-wars", "xmas-comedy", "netflix-comedy", "apple-tv", "kdrama", "anime", "kp-top250"],
  "moods": [
    {"id": "friday", "title": "Вечер пятницы", "sources": {"movie": {"type": "discover", "params": {"genres": "28|12|35", "sort_by": "popularity.desc", "filter": {"vote_average.gte": 6.5, "with_runtime.lte": 130}}}}},
    {"id": "family", "title": "Семейный просмотр", "sources": {"movie": {"type": "discover", "params": {"genres": "10751|16", "sort_by": "popularity.desc", "filter": {"certification_country": "US", "certification.lte": "PG"}}}}},
    {"id": "scary", "title": "Страшное на ночь", "sources": {"movie": {"type": "discover", "params": {"genres": 27, "sort_by": "vote_average.desc", "filter": {"vote_count.gte": 300}}}}},
    {"id": "short", "title": "Есть 90 минут", "sources": {"movie": {"type": "discover", "params": {"sort_by": "popularity.desc", "filter": {"with_runtime.lte": 90, "vote_count.gte": 200}}}}}
  ]
}
```

Правила: `id` — латиница, уникален; `season` — месяцы, когда подборка поднимается наверх; `sources` — хотя бы один из `movie`/`tv`; типы `discover` (params как у `Lampa.Api.sources.tmdb.get`), `collection` (TMDB collection id), `list` (TMDB list id), `kp` (тип коллекции Кинопоиска), `person` — не нужен: люди через `discover` + `filter.with_people`. Персональные ряды `continue/because/new-episodes/soon` — зарезервированные id, их даёт `LC.personal`. Встроенный `LC.manifest.DEFAULT` должен содержать не меньше 40 подборок: по 6–8 в каждой группе, id из раздела 0 плюс те, что исполнитель добавит с проверкой `total_results > 20` живым запросом (франшизы: Джон Уик 404609, Миссия невыполнима 87359, Матрица 2344, Терминатор 528, Чужой 8091, Индиана Джонс 84, Бэтмен 263, Люди Икс 748, Шрек 2150, Форсаж 9485; компании: Marvel 420, A24 41077, DC 128064, Lucasfilm 1; сети HBO 49, Disney+ 2739, Amazon 1024; ключевые слова проверить `search/keyword`: heist, zombie, time travel, space, superhero, vampire, halloween 3335; страны: TR, JP, KR, GB, FR, IN, ES; эпохи: 1970-е, 1990-е, 2000-е, 2010-е; люди: Спилберг 488, Финчер 7467, Скорсезе 1032, Вильнёв 137427, Хаяо Миядзаки 608, Ким Ки Дук нет — не брать; Кинопоиск: все 12 типов).

## 3. Задачи

> **Поправки контроллера по экспорту дизайна (2026-09-15, `docs/design/design-spec-main.md`, экраны 15–32; приоритетнее текста задач).** Единицы: em = px(FHD) ÷ 22.811 (правило 0.4 плана фазы 1). Размеры всех элементов главной, рядов, героя, хаба, чипов, плиток, скелетонов — из спецификации §0.1–0.19, не из текста задач.
> - **Task 14 (манифест):** `groups` остаются 10 id, но добавляется `hubGroups` — 7 видимых чипов хаба, каждый со списком id: Франшизы `[franchise]`, Студии и сервисы `[studio, service]`, Темы `[theme]`, Страны `[country]`, Эпохи `[era]`, Люди `[people]`, Топы Кинопоиска `[top, kp]`; `mood` в хабе не показывается (это профили настроения, Task 19). Пользовательские подборки в манифест не входят — они живут в `Lampa.Storage` (`lumen_user_collections`, см. Task 20) и подмешиваются при построении рядов (Task 15) и хаба (Task 17).
> - **Task 15 (ряды):** заголовки всех рядов одного кегля — 32 px FHD (`1.4em`), значок/метка источника — по §0.3; правую границу ряда плагин не фиксирует (её задаёт штатный `.items-line`). «Все N» — у каждого ряда подборки, включая сервисные (экран 18 его не показывает — считать пропуском дизайна, не решением).
> - **Task 17 (хаб и сетки):** `groupsWithCounts` считает по объединению id из `hubGroups`; сетка `lumen_grid` — safe area с обеих сторон, ровно 6 карточек в ряд (экран 20 даёт ~7 из-за bleed справа — это дефект макета); в хабе оставить место под строку поиска по подборкам (узел скрыт до Task 27).
> - **Task 18 (герой):** текстовый фолбэк логотипа — обычный текст без панели, единообразно с экранами 16–19 (панель экрана 15 не делать); статус сериала в герое — текстом «Выходит · 17 дек» (как экран 19), без чипа обратного отсчёта (чип остаётся в карточке, фаза 1 Task 5c).
> - **Task 19 (настроение):** ровно 4 чипа (Вечер пятницы / Семейный просмотр / Страшное на ночь / Есть 90 минут); чип «Мне повезёт» не делать — вход в рулетку см. поправку к Task 23 в плане фазы 3.
> - **Task 20 (настройки):** экран 21 расширяет объём: (а) список подборок с тумблерами и меткой «СЕЗОННАЯ» у сезонных; (б) порядок рядов — на фокусной строке долгое нажатие открывает `Lampa.Select` «Выше / Ниже / Скрыть» (стрелки экрана 21 — визуализация этого меню, отдельных кнопок-стрелок не делать); (в) **свои подборки**: форма «Новая подборка» из штатных `Lampa.Input` (название, ключевое слово) и `Lampa.Select` (тип фильм/сериал, жанр, сервис, сортировка), результат — запись `{id:'user_'+Date.now(), title, media, params}` в `lumen_user_collections`, отображается рядом на главной и плиткой в хабе; удаление — из того же долгого нажатия. Это подзадача 20b, отдельный коммит.

### Task 14: Манифест и загрузчик источников

**Files:** Create `src/42_manifest.js`, `src/43_sources.js`, `manifest.json`, `test/manifest.test.mjs`, `test/sources.test.mjs`. Modify `src/80_settings.js` (параметр `lumen_manifest_url`, input, default ''), `src/00_head.js` (`LC.MANIFEST_URL = ''` — заполнится, когда появится хостинг).

- [ ] **Step 1: Тесты sources (падают)**

```js
// test/sources.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const S = load('43_sources.js');
test('buildRequest discover: url и params с page и langs', () => {
  const r = S.buildRequest({ type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } }, 'movie', 2);
  assert.equal(r.url, 'discover/movie');
  assert.deepEqual(r.params, { genres: 35, keywords: 207317, sort_by: 'popularity.desc', page: 2 });
  assert.equal(r.life, 720);
});
test('buildRequest collection/list: page игнорируется, кэш неделя', () => {
  assert.deepEqual(S.buildRequest({ type: 'collection', id: 10 }, 'movie', 3), { url: 'collection/10', params: {}, life: 10080 });
  assert.deepEqual(S.buildRequest({ type: 'list', id: 10 }, 'movie', 1), { url: 'list/10', params: {}, life: 10080 });
});
test('normalize: parts/items → results, служебные поля', () => {
  const c = S.normalize('collection', { name: 'Звёздные Войны', parts: [{ id: 2, release_date: '1980-05-17' }, { id: 1, release_date: '1977-05-25' }] });
  assert.deepEqual(c.results.map(x => x.id), [1, 2]); // по дате выхода
  assert.equal(c.total_results, 2); assert.equal(c.total_pages, 1); assert.equal(c.page, 1);
  const l = S.normalize('list', { name: 'Top 50', items: [{ id: 5 }], total_results: 50, total_pages: 3, page: 2 });
  assert.deepEqual(l.results, [{ id: 5 }]); assert.equal(l.total_pages, 3); assert.equal(l.page, 2);
  const d = S.normalize('discover', { results: [{ id: 9 }], total_results: 1, total_pages: 1, page: 1 });
  assert.deepEqual(d.results, [{ id: 9 }]);
  assert.deepEqual(S.normalize('discover', null).results, []);
});
test('discoverUrl: query-строка для category_full, filter раскрывается', () => {
  assert.equal(S.discoverUrl({ type: 'discover', params: { genres: 35, keywords: 207317, filter: { 'vote_count.gte': 200 } } }, 'movie'),
    'discover/movie?with_genres=35&with_keywords=207317&vote_count.gte=200');
  assert.equal(S.discoverUrl({ type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc', orig_lang: 'ja' } }, 'tv'),
    'discover/tv?with_networks=2552&sort_by=popularity.desc&with_original_language=ja');
});
test('kpToFinds: items → список imdbId без пустых, не больше лимита', () => {
  assert.deepEqual(S.kpToFinds({ items: [{ imdbId: 'tt1' }, { imdbId: null }, { imdbId: 'tt2' }, { imdbId: 'tt3' }] }, 2), ['tt1', 'tt2']);
});
test('mergeMedia: фильмы и сериалы чередуются; дубли только внутри той же медиа (ключ media:id)', () => {
  // movie:1 != tv:1, поэтому оба попадают
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 1 }]);
  assert.deepEqual(m.map(x => x.id), [1, 3, 2, 1]);
});
```

- [ ] **Step 2: Модуль sources**

```js
// src/43_sources.js — описание подборки → запросы к TMDB/КП → {results[]}
  LC.sources = (function () {
    var MAP = { genres: 'with_genres', keywords: 'with_keywords', companies: 'with_companies', networks: 'with_networks',
                watch_providers: 'with_watch_providers', watch_region: 'watch_region', sort_by: 'sort_by', orig_lang: 'with_original_language' };
    var LIFE_DISCOVER = 720, LIFE_STATIC = 10080, LIFE_KP = 43200;
    function buildRequest(spec, media, page) {
      if (spec.type === 'collection') return { url: 'collection/' + spec.id, params: {}, life: LIFE_STATIC };
      if (spec.type === 'list') return { url: 'list/' + spec.id, params: {}, life: LIFE_STATIC };
      var params = {}, k;
      for (k in spec.params) if (spec.params.hasOwnProperty(k)) params[k] = spec.params[k];
      params.page = page || 1;
      return { url: 'discover/' + media, params: params, life: LIFE_DISCOVER };
    }
    function normalize(type, json) {
      json = json || {};
      var results = type === 'collection' ? (json.parts || []).slice() : type === 'list' ? (json.items || []).slice() : (json.results || []).slice();
      if (type === 'collection') results.sort(function (a, b) { var da = String(a.release_date || '9999'), db = String(b.release_date || '9999'); return da < db ? -1 : da > db ? 1 : 0; }); // триstate comparator
      var out = { results: results, title: json.title || json.name || '', page: json.page || 1 };
      out.total_results = json.total_results || results.length;
      out.total_pages = json.total_pages || 1;
      return out;
    }
    function discoverUrl(spec, media) {
      var q = [], p = spec.params || {}, k;
      for (k in p) if (p.hasOwnProperty(k) && k !== 'filter') q.push((MAP[k] || k) + '=' + encodeURIComponent(p[k]));
      for (k in (p.filter || {})) if (p.filter.hasOwnProperty(k)) q.push(k + '=' + encodeURIComponent(p.filter[k]));
      return 'discover/' + media + (q.length ? '?' + q.join('&') : '');
    }
    function kpToFinds(json, limit) {
      var ids = [];
      LC.util.each((json && json.items) || [], function (it) { if (it && it.imdbId && ids.length < limit) ids.push(it.imdbId); });
      return ids;
    }
    function mergeMedia(movies, tv) {
      var out = [], seen = {}, i, km, kt, a = movies || [], b = tv || [];
      for (i = 0; i < Math.max(a.length, b.length); i++) {
        // Ключ — media + ':' + id: фильм и сериал с одинаковым TMDB id — разные объекты
        if (a[i]) { km = 'movie:' + a[i].id; if (!seen[km]) { seen[km] = 1; out.push(a[i]); } }
        if (b[i]) { kt = 'tv:' + b[i].id; if (!seen[kt]) { seen[kt] = 1; out.push(b[i]); } }
      }
      return out;
    }
    // рантайм: один источник одного медиа
    function fetchOne(spec, media, page, ok, err) {
      if (spec.type === 'kp') return fetchKp(spec, page, ok, err);
      var r = buildRequest(spec, media, page);
      Lampa.Api.sources.tmdb.get(r.url, r.params, function (json) { ok(normalize(spec.type, json)); }, err, { life: r.life });
    }
    // Кинопоиск → imdbId → TMDB find; кэш страницы в Storage 30 дней
    function fetchKp(spec, page, ok, err, alive) {
      // Ключ КП напрямую через LC.pref — без зависимости от LC.reviews
      var key = typeof LC.pref === 'function' ? LC.pref('lumen_kp_key', '') : '';
      if (!key) return err({ nokey: true });
      var cacheKey = 'lumen_kp_' + spec.collection + '_' + (page || 1);
      var cached = Lampa.Storage.get(cacheKey, null);
      if (cached && cached.at && Date.now() - cached.at < LIFE_KP * 60000) return ok(cached.data);
      var net = new Lampa.Reguest();
      net.silent('https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=' + spec.collection + '&page=' + (page || 1), function (json) {
        var ids = kpToFinds(json, 20), results = [], i = 0;
        function next() {
          if (i >= ids.length) {
            var data = { results: results, page: page || 1, total_pages: json.totalPages || 1, total_results: json.total || results.length, title: '' };
            Lampa.Storage.set(cacheKey, { at: Date.now(), data: data });
            return ok(data);
          }
          var id = ids[i++];
          Lampa.Api.sources.tmdb.get('find/' + id, { filter: { external_source: 'imdb_id' } }, function (f) {
            var m = (f.movie_results && f.movie_results[0]) || (f.tv_results && f.tv_results[0]);
            if (m) results.push(m);
            next();
          }, next, { life: LIFE_KP });
        }
        next();
      }, function () { err('kp_failed'); }, false, { headers: { 'X-API-KEY': key }, dataType: 'json', timeout: 8000 });
    }
    // Подборка целиком: movie и tv (если оба есть) → один список
    function fetch(item, page, ok, err) {
      var src = item.sources || {}, want = [], got = {}, failed = 0;
      if (src.movie) want.push('movie'); if (src.tv) want.push('tv');
      if (!want.length) return err('no_sources');
      function done() {
        if (Object.keys(got).length + failed < want.length) return;
        if (!Object.keys(got).length) return err('all_failed');
        var m = got.movie || { results: [] }, t = got.tv || { results: [] };
        ok({ results: mergeMedia(m.results, t.results), title: item.title, page: page || 1,
             total_pages: Math.max(m.total_pages || 1, t.total_pages || 1), total_results: (m.total_results || 0) + (t.total_results || 0) });
      }
      LC.util.each(want, function (media) {
        fetchOne(src[media], media, page, function (json) { got[media] = json; done(); }, function () { failed++; done(); });
      });
    }
    return { buildRequest: buildRequest, normalize: normalize, discoverUrl: discoverUrl, kpToFinds: kpToFinds, mergeMedia: mergeMedia, fetchOne: fetchOne, fetch: fetch };
  })();
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.sources;
```
`Object.keys` — ES5, допустимо. Для `media_type` карточек из tv-источника проставлять `name` уже есть в ответе TMDB; Lampa определяет сериал по `first_air_date`/`name` — ничего добавлять не нужно.

- [ ] **Step 3: Тесты manifest (падают)**

```js
// test/manifest.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const M = load('42_manifest.js');
test('DEFAULT валиден: ≥40 подборок, уникальные id, у каждой sources и group из groups', () => {
  const d = M.DEFAULT; const ids = new Set(); const groups = new Set(d.groups.map(g => g.id));
  assert.ok(d.collections.length >= 40);
  for (const c of d.collections) { assert.ok(!ids.has(c.id), c.id); ids.add(c.id); assert.ok(c.sources.movie || c.sources.tv, c.id); assert.ok(groups.has(c.group), c.id); assert.match(c.id, /^[a-z0-9-]+$/); }
  for (const h of d.home) assert.ok(ids.has(h) || ['continue', 'because', 'new-episodes', 'soon'].indexOf(h) >= 0, h);
});
test('orderForMonth: сезонные наверх в свой месяц, остальные в исходном порядке', () => {
  const list = [{ id: 'a' }, { id: 'x', season: [12, 1] }, { id: 'b' }, { id: 'h', season: [10] }];
  assert.deepEqual(M.orderForMonth(list, 12).map(c => c.id), ['x', 'a', 'b', 'h']);
  assert.deepEqual(M.orderForMonth(list, 10).map(c => c.id), ['h', 'a', 'x', 'b']);
  assert.deepEqual(M.orderForMonth(list, 6).map(c => c.id), ['a', 'x', 'b', 'h']);
});
test('validate: чужой манифест без collections или с дублями отвергается', () => {
  assert.equal(M.validate({ version: 1, collections: [{ id: 'a', sources: { movie: { type: 'discover', params: {} } }, group: 'theme', title: 't' }], groups: [{ id: 'theme', title: 'T' }], home: [] }).ok, true);
  assert.equal(M.validate({ version: 1 }).ok, false);
  assert.equal(M.validate({ version: 1, collections: [{ id: 'a' }, { id: 'a' }], groups: [], home: [] }).ok, false);
});
test('isFresh 12 часов', () => { assert.equal(M.isFresh({ at: Date.now() - 1000 }), true); assert.equal(M.isFresh({ at: Date.now() - 13 * 3600e3 }), false); });
```

- [ ] **Step 4: Модуль manifest** — `LC.manifest = (function(){ var DEFAULT = {…из раздела 2, расширенный до ≥40…}; function validate(m){…}; function orderForMonth(list, month){…}; function isFresh(rec){…}; function load(cb){ var url = LC.pref('lumen_manifest_url','') || LC.MANIFEST_URL; var cached = Lampa.Storage.get('lumen_manifest', null); if (!url) return cb(DEFAULT); if (isFresh(cached) && validate(cached.data).ok) return cb(cached.data); new Lampa.Reguest().silent(url + (url.indexOf('?')>=0?'&':'?') + 't=' + Math.floor(Date.now()/3600e3), function(json){ if (validate(json).ok) { Lampa.Storage.set('lumen_manifest', {at: Date.now(), data: json}); cb(json); } else cb((cached && cached.data) || DEFAULT); }, function(){ cb((cached && cached.data) || DEFAULT); }, false, {dataType:'json', timeout: 8000}); } function get(){ return current || DEFAULT } return {DEFAULT, validate, orderForMonth, isFresh, load, get}; })();` — `current` выставляется в `load`. `manifest.json` в корне репозитория = `JSON.stringify(DEFAULT, null, 2)`; добавить `scripts/manifest.mjs`, который генерирует его из `src/42_manifest.js` (через `load()` тестового загрузчика) — чтобы файл и код не расходились; `node scripts/build.mjs` вызывает его.

- [ ] **Step 5: Живая проверка** (локальная Lampa, порт 8766, процедура из плана фазы 1 разд. 0.8): после загрузки `dist/lumen_card.js` выполнить для 6 подборок (`star-wars`, `xmas-comedy`, `netflix-comedy`, `apple-tv`, `top-grossing`, `best-80s`) `LC.sources.fetch(item, 1, ok, err)` (`item` из `window.lumen_card.manifest.get().collections`) — каждый `ok` даёт `results.length > 0`, у «Звёздных войн» первые три по датам 1977/1980/1983 плюс сериалы вперемежку; `kp-top250` без ключа → `err('no_key')`. Commit `feat: манифест подборок и загрузчик источников`.

### Task 15: Ряды подборок на главной

**Files:** Create `src/44_rows.js`, `test/rows.test.mjs`. Modify `src/80_settings.js` (`lumen_home_rows` — список id через запятую, default = `manifest.home`; `lumen_hide_watched` trigger, default false; `lumen_rows_limit` select 10/15/25, default 15), `src/90_runtime.js` (`LC.init` → `LC.manifest.load(function(m){ LC.rows.register(m); LC.personal.register(m); })` до появления главной).

- [ ] **Step 1: Тесты** — `homeRows(manifest, storedIds, month, limit)` → упорядоченный список объектов подборок (персональные id остаются строками-маркерами), сезонные наверх, лимит; `filterWatched(results, viewedIds, hide)`; `rowName(id)` → `'lumen_' + id`.
- [ ] **Step 2: Регистрация** — для каждого элемента `homeRows` с индексом i: `Lampa.ContentRows.add({ name: LC.rows.rowName(item.id), title: item.title, screen: 'main', index: i + 1, call: function (params, screen) { return function (call) { var handle = LC.sources.fetch(item, 1, function (json) { json.results = LC.rows.filterWatched(json.results, LC.rows.viewedIds(), LC.pref('lumen_hide_watched', false)); json.title = item.title; if (item.badge) json.title += ' · ' + item.badge; call(json); }, function () { call({ results: [] }); }, screen._alive); return { cancel: function () { if (handle) handle.clear(); } }; }; } })`. При уходе с главного экрана Lampa вызовет `cancel()` — активные запросы отменяются. `viewedIds()` — `Lampa.Favorite.get({type:'viewed'})` ids + фильмы с `Lampa.Timeline.view(hash) >= 95`. Проверить живьём, что ряд с пустыми `results` не рисуется и не ломает главную; если ломает — не регистрировать `call` результата, а звать `call(false)`. `viewedIds()` — `Lampa.Favorite.get({type:'viewed'})` ids + фильмы с `Lampa.Timeline.view(hash) >= 95`. Проверить живьём, что ряд с пустыми `results` не рисуется и не ломает главную; если ломает — не регистрировать `call` результата, а звать `call(false)`.
- [ ] **Step 3: Живая проверка** — открыть главную заново (`Lampa.Activity.push({url:'', title:'Главная', component:'main', source:'tmdb', page:1})`), дождаться `.items-line` с заголовками: ряды из `manifest.home` присутствуют в заданном порядке после штатного первого ряда; фокус в ряд подборки → OK открывает карточку (контроллер `full_start`). Скриншот. Commit `feat: ряды подборок на главной`.

### Task 16: Персональные ряды

**Files:** Create `src/45_personal.js`, `test/personal.test.mjs`.

- [ ] **Step 1: Проверить API** живьём: `typeof Lampa.Favorite.continues`, `Lampa.Favorite.get({type:'history'})` (структура карточек), `Lampa.Favorite.get({type:'book'})`. Если `continues` нет — реализовать по `src/core/favorite.js:378` (history минус viewed/thrown).
- [ ] **Step 2: Тесты чистых функций** — `pickBecause(history, n)` → последние n разных карточек с полями `{id, media:'movie'|'tv', title}`; `newEpisodes(shows, today)` — из деталей сериалов (`last_episode_to_air.air_date`, `next_episode_to_air.air_date`) выбирает те, где последняя серия ≤ 14 дней назад или следующая ≤ 7 дней вперёд, сортирует по дате, добавляет `lumen_badge` («Новая серия · 12 сен» / «Через 3 дня»); `soonRange(today)` → `{gte, lte}` на 30 дней.
- [ ] **Step 3: Ряды** через `ContentRows.add` с `index` 0–3 (перед подборками): «Досмотреть» (`Lampa.Favorite.continues('movie').concat(continues('tv'))`, до 19, пусто → ряд не регистрируется), «Потому что вы смотрели «X»» (по 2 последним из истории: `tmdb.get(media + '/' + id + '/recommendations', {langs}, …, {life: 1440})`), «Новые серии ваших сериалов» (сериалы из `book` ∪ history, не больше 12, `tmdb.get('tv/' + id, …, {life: 720})`, фильтр `newEpisodes`), «Скоро на экранах» (`discover/movie` с `filter: {'primary_release_date.gte': gte, 'primary_release_date.lte': lte}`, `sort_by: 'popularity.desc'`; сериалы `first_air_date.*`; слить `mergeMedia`).
- [ ] **Step 4: Живая проверка** — открыть 2 карточки (Дюна, Фоллаут), записать прогресс `Lampa.Timeline.update({hash: Lampa.Utils.hash('Dune: Part Two'), percent: 40, time: 4000, duration: 9960})`, добавить в историю (`Lampa.Favorite.add('history', card)` — проверить сигнатуру `add(where, card, limit)`), переоткрыть главную: ряды «Досмотреть», «Потому что вы смотрели «Дюна: Часть вторая»», «Скоро на экранах» есть. Commit `feat: персональные ряды`.

### Task 17: Хаб подборок, сетки, кнопка «Франшиза»

**Files:** Create `src/46_hub.js`, `test/hub.test.mjs`. Modify `src/30_css.js`, `src/90_runtime.js` (кнопка «Франшиза» в `complite`).

- [ ] **Step 1: Сверить API карточки** — `src/interaction/card.js` (grep `class Card`, `create()`, `render()`, `onEnter`, `onFocus`, `card_data`, `use(`): как создать карточку вне ряда: ожидаемо `var c = new Lampa.Card(item, {card_category: true}); c.create(); c.onEnter = function(){…}; c.onFocus = function(){…}; $(c.render(true))`. Записать точный вариант в комментарий модуля.
- [ ] **Step 2: Тесты** — `groupsWithCounts(manifest)` → `[{id, title, count}]` только непустые; `tilesFor(manifest, groupId)`; `openTarget(item)` → `{component:'category_full', url, source:'tmdb'}` для чисто-discover подборок с одним медиа, иначе `{component:'lumen_grid', lumen: item}`.
- [ ] **Step 3: Меню** — в `init` после `appready`: `Lampa.Menu.addButton(LC.icons.get('list'), LC.lang('lumen_hub_title'), function(){ Lampa.Activity.push({ title: LC.lang('lumen_hub_title'), component: 'lumen_hub', page: 1 }); })`. Проверить, что кнопка одна (guard по классу `.lumen-menu-hub`).
- [ ] **Step 4: Компонент `lumen_hub`** по образцу IPTV: `create` → html `.lumen-hub` (строка чипов групп `.selector`, сетка плиток `.selector`), `start` → `Lampa.Controller.add('content', { toggle: function(){ Lampa.Controller.collectionSet(html); Lampa.Controller.collectionFocus(last || false, html); }, left: → 'menu', up: → 'head', back: → Lampa.Activity.backward })`, `Lampa.Controller.toggle('content')`; `hover:enter` на чипе перестраивает плитки; на плитке — `Lampa.Activity.push(openTarget(item))`. Плитка: заголовок, подпись группы/бейдж, коллаж из 3 постеров — постеры подгружать лениво: при `hover:focus` плитки и для первых 12 плиток группы, из `LC.sources.fetch(item, 1)` (кэш уже стоит), брать `poster_path` первых трёх → `Lampa.TMDB.image('t/p/w342' + path)`.
- [ ] **Step 5: Компонент `lumen_grid`** — `object.lumen` = подборка; `LC.sources.fetch(item, page)` → карточки `Lampa.Card`, `onEnter` → `Lampa.Activity.push({url:'', component:'full', id: card.id, method: card.name ? 'tv' : 'movie', card: card, source:'tmdb'})`; `Lampa.Scroll({mask:true, over:true, step:250})`; догрузка следующей страницы при фокусе последнего ряда, если `page < total_pages`; сортировка (чипы «По популярности / По рейтингу / Новые» — для collection/list сортируем локально по `popularity`/`vote_average`/`release_date`).
- [ ] **Step 6: «Франшиза» в карточке** — в обработчике `complite` (Task 5 рантайм): если `movie.belongs_to_collection`, добавить в `.full-start-new__buttons` (НЕ в `.buttons--container` — там хэш приоритета) кнопку `<div class="full-start__button selector lumen-button--franchise">` с иконкой `film` и текстом «Франшиза»; `hover:enter` → `Lampa.Activity.push({title: movie.belongs_to_collection.name, component:'lumen_grid', lumen: {id:'col-'+id, title, sources:{movie:{type:'collection', id}}}, page:1})`. Проверить, что `Controller.collectionSet` подхватил кнопку (фокус доходит стрелкой).
- [ ] **Step 7: Живая проверка** — меню → «Подборки» открывается (контроллер `content`), чипы групп переключают плитки, плитка «Звёздные войны» → сетка из 9 фильмов, OK → карточка, назад → сетка с тем же фокусом; из карточки «Дюны» кнопка «Франшиза» → сетка коллекции «Дюна». Плитка «Рождественские комедии» → штатная сетка `category_full` с «Ещё». Скриншоты. Commit `feat: хаб подборок и сетки`.

### Task 18: Герой на главной

**Files:** Create `src/48_hero.js`, `test/hero.test.mjs`. Modify `src/30_css.js`, `src/90_runtime.js`.

- [ ] **Step 1: Тесты чистых функций** — `pickLogo(logos)` → ru, потом en, потом первый без языка, иначе null; `heroModel(card_data, details)` → `{title, backdrop, logo, meta:[year, runtime|seasons, genres], overview, rating, media}` с фолбэками (нет details → только card_data); `shouldUpdate(prevId, nextId, elapsedMs, delay)` → false, если тот же id или elapsed < delay.
- [ ] **Step 2: Монтирование** — `Lampa.Listener.follow('activity', e)`: `e.type === 'start' && e.component === 'main'` → `LC.hero.mount(e.object.activity.render())`; `destroy` той же активности → `unmount` (disconnect observer, clearTimeout). `mount`: вставить `.lumen-hero` первым ребёнком в `activity.render()`, добавить `activity.render().addClass('lumen-main')` (CSS: `.lumen-main .scroll__body{padding-top: 46vh}` — проверить селектор скролла главной живьём и подобрать, чтобы первый ряд лежал под героем, а при фокусе на втором ряду Lampa сама прокрутила, а герой получил `.lumen-hero--compact`). MutationObserver на корне активности: `.card.focus` → `el.card_data` → debounce 350 мс → `LC.hero.show(data)`. `show`: `new Image()` предзагрузка `Lampa.TMDB.image('t/p/w1280' + backdrop_path)`; после `onload` кроссфейд слоёв (два `.lumen-hero__bg`, активный `.is-active`); текст: класс `.is-swapping` 180 мс, затем новый контент, `.is-in`. Детали: `Lampa.Api.sources.tmdb.get(media + '/' + id, { langs: 'ru-RU', filter: { append_to_response: 'images', include_image_language: 'ru,en,null' } }, ok, err, { life: 1440 })` → `overview`, `runtime`/`number_of_seasons`, `genres`, `images.logos`; пока грузится — скелетон двух строк. `media` = `card_data.media_type || (card_data.name ? 'tv' : 'movie')`.
- [ ] **Step 3: Компактный режим** — `Lampa.Listener.follow('line', e.type === 'toggle')`: индекс ряда в DOM (`$(e.item.render()).index()` или через `LC.active` главной) > 0 → `.lumen-hero--compact` (высота 42 %, описание скрыто), иначе снять. Также при `Lampa.Controller.listener 'toggle'` с `e.name !== 'content'` (ушли в меню/шапку) — не трогать.
- [ ] **Step 4: Мини-герой в сетках** — `LC.hero.mount(root, {compact: true})` в `lumen_grid` и хабе (экран 20): тот же модуль, наблюдатель за `.card.focus`/`.lumen-tile.focus`.
- [ ] **Step 5: Живая проверка** — главная: `.lumen-hero` есть, при переводе фокуса (диспатч `keydown` 39 несколько раз с паузами 500 мс) `.lumen-hero__title` меняется на название карточки в фокусе, при быстром листании (5 нажатий по 100 мс) обновление одно; `keydown` 40 → `.lumen-hero--compact`; консоль без ошибок; после `Lampa.Activity.backward()` из карточки герой на месте и обновляется; наблюдатель отключён после ухода с главной (`window.lumen_card.hero.active() === false`). Скриншоты: герой, компакт. Commit `feat: герой на главной`.

### Task 19: Профили настроения

**Files:** Modify `src/48_hero.js` (строка чипов внизу героя), `src/42_manifest.js` (`moods`), `src/30_css.js`.

- [ ] Чипы `.selector` под текстом героя: `hover:enter` → `Lampa.Activity.push({url: LC.sources.discoverUrl(mood.sources.movie, 'movie'), title: mood.title, component: 'category_full', source: 'tmdb', page: 1})`. Навигация: из первого ряда вверх → чипы → вверх → шапка (`Lampa.Controller.toggle('head')`): реализовать через собственный контроллер `lumen_moods` (`Lampa.Controller.add`, `collectionSet(chipsRoot)`, `down` → `Lampa.Controller.toggle('content')`, `up` → `'head'`), а переход из ряда вверх перехватить: в `Lampa.Listener 'line' toggle` для первого ряда не получится — вместо этого чипы включаются с шапки вниз (`head` → down → `lumen_moods` → down → `content`): проверить, есть ли у контроллера `head` настраиваемый `down`; если нет — оставить вход в чипы только из шапки не делать, а сделать чипы первым «рядом» через `ContentRows`? Нельзя (ряд карточек). Решение по факту живой проверки; минимально допустимо: чипы доступны с шапки (`up` из первого ряда → `head` → `down` → чипы). Записать выбранный путь в acceptance.
- [ ] Живая проверка и Commit `feat: профили настроения`.

### Task 20: Настройки фазы 2, README, ревью, публикация манифеста

- [ ] Настройки (компонент `lumen_card`): «Ряды на главной» (multi-select нет в SettingsApi → экран выбора через `Lampa.Select.show({items:[{title, checkbox:true, checked}], onSelect})` из кнопки-параметра типа `button`; сохранять в `lumen_home_rows`), «Скрыть досмотренное», «Лимит рядов», «URL манифеста», «Персональные ряды» (trigger).
- [ ] README: раздел «Подборки» (что откуда, как добавить свою в `manifest.json`, формат), «Ключ Кинопоиска» общий с отзывами, «Главная» (герой, компакт, профили настроения), ограничения (Netflix-фильмы по региону US).
- [ ] `manifest.json` в корне; после появления GitHub Pages — `LC.MANIFEST_URL = 'https://<owner>.github.io/lumen-card/manifest.json'`.
- [ ] Ревью: `code-reviewer` на всю фазу (модули 42–48, CSS, тесты) с инвариантами из плана фазы 1 (0.3) плюс: наблюдатели отключаются при уходе с главной; ни один запрос не выполняется чаще, чем раз в 12 ч на подборку (кэш `life`); Кинопоиск не вызывается без ключа; ContentRows не регистрируется дважды при повторном `init`.
- [ ] Чек-лист живой проверки всей фазы: главная с героем и 11 рядами из `manifest.home`; хаб; сетка коллекции; франшиза из карточки; профили настроения; консоль чистая; после 5 переходов главная↔карточка число наблюдателей = 1 (`window.lumen_card.hero.observers()`).

## 4. Риски

| Риск | Митигация |
|---|---|
| `ContentRows.add` после того, как главная уже построена (плагин добавлен в рантайме) | ряды появятся при следующем открытии главной; в README и в `Lampa.Noty` после установки: «Откройте главную заново» |
| Позиция рядов `index` конфликтует с другими плагинами | наши индексы с шагом 1 от 0; при коллизии Lampa добавит в конец — приемлемо |
| MutationObserver на всей активности главной дорог на слабых ТВ | наблюдаем только `attributeFilter:['class']`, обработчик выходит, если `!el.classList.contains('card')`; debounce 350 мс; в режиме motion `off` герой не обновляет кадр, только текст |
| Netflix-фильмы недоступны в регионе RU через провайдера | для фильмов используем `watch_region=US` с бейджем, в README оговорка |
| Кинопоиск: 500 запросов/день | страница = 1 + ≤ 20 запросов, кэш 30 дней, без ключа группа «Кинопоиск» в хабе помечена «нужен ключ» (экран 13) |
| `category_full` меняет формат `url` в новых версиях Lampa | сетки коллекций и списков уже на своём `lumen_grid`; при ошибке discover-сетки — фолбэк на `lumen_grid` |

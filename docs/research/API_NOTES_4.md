# Lampa API Notes 4 — Netflix-главная и подборки без парсера

**Версия Lampa**: 3.3.4 (localhost:8766)
**Дата**: сентябрь 2026
**Источники**: raw.githubusercontent.com/yumata/lampa-source/main, живой инстанс localhost:8766

---

## Часть A. Главная в стиле Netflix

### A1. Архитектура главной

**Файл компонента**: `src/components/main.js`

```js
function component(object){
    let comp = Utils.createInstance(Main, object)
    let next = null

    comp.use({
        onCreate: function(){
            let nextCall = Api.main(object, this.build.bind(this), this.empty.bind(this))
            if(typeof nextCall == 'function') next = nextCall
        },
        onNext: function(resolve, reject){
            if(next) next(resolve.bind(this), reject.bind(this))
            else reject.call(this)
        },
        onInstance: function(item, data){
            item.use({
                onMore: Router.call.bind(Router, 'category_full', data),
                onInstance: function(card, data){
                    card.use({
                        onEnter: Router.call.bind(Router, 'full', data),
                        onFocus: function(){
                            Background.change(Utils.cardImgBackground(data))
                        }
                    })
                }
            })
        }
    })
    return comp
}
```

**Цепочка**: `Activity.push({component:'main'})` -> `Component.create('main')` -> `component(object)` -> `Api.main(object, build, empty)` -> `Api.sources.tmdb.main(params, oncomplite, onerror)`.

**Файл**: `src/interaction/items/main/base.js` (класс Main):
- `this.items[]` — массив экземпляров Line (рядов)
- `this.active` — индекс текущего активного ряда (Int)
- `this.limit_view = Platform.screen('tv') ? 1 : 6`
- Контроллер: `'content'`

**Файл**: `src/interaction/items/line/line.js` — `class Line extends Base`.

### A2. Данные карточки и событие фокуса

**КЛЮЧЕВОЕ**: данные карточки хранятся в нативном JS-свойстве DOM-узла:

```js
var card_el = document.querySelector('.card.focus')
var data = card_el.card_data   // НЕ $(el).data() — там пусто! Проверено живьём.
// data.id, data.title, data.backdrop_path, data.vote_average, data.overview
```

Поля `card_data` (проверено живьём, id 1423191):
```json
{
  "adult": false,
  "backdrop_path": "/mRM28tIIm8y0gKy9GKYGwotxuPM.jpg",
  "id": 1423191,
  "title": "Обитель зла",
  "media_type": "movie",
  "genre_ids": [27, 53],
  "popularity": 125.4,
  "release_date": "2026-09-16",
  "vote_average": 9.2
}
```

**Фокус карточки — рабочий способ: MutationObserver** (проверено живьём):

```js
var observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        var el = m.target
        if (el.classList.contains('card') && el.classList.contains('focus') && el.card_data) {
            var d = el.card_data
            var bgUrl = Lampa.TMDB.image('t/p/w1280' + d.backdrop_path)
            var title = d.title || d.name
            var overview = d.overview
            var vote = d.vote_average
            // Обновить блок героя здесь
        }
    })
})
observer.observe(document.body, {attributes: true, attributeFilter: ['class'], subtree: true})
```

**НЕ работает**: `$(document).on('hover:focus', '.card', fn)` — событие не всплывает через делегирование.

**Lampa.Listener.follow('line')** — типы событий: `'toggle'`, `'append'`, `'create'`, `'visible'`. Типа `'focus'` нет.

### A3. Публичные классы Lampa (проверено живьём)

| Имя | Тип | Назначение |
|---|---|---|
| `Lampa.InteractionMain` | function | Базовый класс главной |
| `Lampa.InteractionLine` | function | Базовый класс ряда |
| `Lampa.ContentRows` | object | {init, add, remove, call} — API рядов для плагинов |
| `Lampa.Component` | object | {create, add, get} — регистрация компонентов |
| `Lampa.Card` | function | Конструктор карточки |
| `Lampa.Menu` | object | {addElement, addButton, open, close, toggle} |
| `Lampa.Scroll` | function | Скролл-контейнер |
| `Lampa.Api.sources.tmdb` | object | 23 метода: main, list, category, search, get, full |

**Подмена стартовой страницы**:
```js
Lampa.Component.add('main', function MyNetflixMain(object) {
    // Требует lifecycle: create, start, pause, destroy, render, build, empty
})
var sp = Lampa.Storage.field('start_page')   // -> 'main' по умолчанию
Lampa.Storage.set('start_page', 'my_component')
```

---

## Часть B. Подборки без парсера (TMDB discover)

### B1. Механизм параметров категории

**Функция `url()` в `src/core/api/sources/tmdb.js`** (строки 102-137):

| Поле params | Query-параметр TMDB |
|---|---|
| `genres` | `with_genres` |
| `keywords` | `with_keywords` |
| `watch_region` | `watch_region` |
| `watch_providers` | `with_watch_providers` |
| `companies` | `with_companies` |
| `networks` | `with_networks` |
| `sort_by` | `sort_by` |
| `orig_lang` | `with_original_language` |
| `filter: {key: val}` | произвольные параметры |

**Query-строка в url напрямую — РАБОТАЕТ** (проверено живьём):
```js
Lampa.Activity.push({
    url: 'discover/movie?with_keywords=207317&with_genres=35',
    title: 'Рождественские комедии',
    component: 'category_full',
    source: 'tmdb',
    page: 1
})
```

**ОШИБКА** — `collection/{id}` не работает через `category_full`:
- `TypeError: Cannot read properties of undefined (reading 'length')`
- TMDB `/collection/{id}` возвращает `{parts:[]}`, а `category_full` ожидает `{results:[]}`

**Решение для коллекций** — конвертация в call-функции:
```js
Lampa.Api.sources.tmdb.get('collection/10', {langs: 'ru-RU'}, function(json) {
    json.results = json.parts || []
    json.title = json.name
    call(json)
}, call, {life: 60 * 24 * 7})
```

### B2. Добавление ряда на главную (ContentRows)

```js
Lampa.ContentRows.add({
    name: 'xmas_comedy',
    title: 'Рождественские комедии',
    screen: 'main',
    index: 2,
    call: function(params, screen) {
        return function(call) {
            Lampa.Api.sources.tmdb.get(
                'discover/movie',
                {genres: 35, keywords: 207317, sort_by: 'popularity.desc', page: 1},
                function(json) { json.title = 'Рождественские комедии'; call(json); },
                call,
                {life: 60 * 24 * 7}
            )
        }
    }
})
```

**ПРОВЕРЕНО ЖИВЬЁМ**: ряд с коллекцией Звёздные войны (collection/10, parts->results) добавился на главную.

**Блокировка**: если `params.genres` или `params.keywords` установлены -> ContentRows.call не вызывается для category-экранов.

### B3. Добавление пункта меню

```js
Lampa.Menu.addButton(
    '<svg viewBox="0 0 24 24">...</svg>',
    'Рождественские комедии',
    function() {
        Lampa.Activity.push({
            url: 'discover/movie?with_genres=35&with_keywords=207317',
            title: 'Рождественские комедии',
            component: 'category_full',
            source: 'tmdb',
            page: 1
        })
    }
)
```

### B4. TMDB ID (все проверены живьём)

**Ключевые слова**:
| Слово | ID |
|---|---|
| christmas | **207317** |
| star wars | **379196** |

**Жанры** (id одинаков для movie и tv):
| Жанр | ID |
|---|---|
| комедия | **35** |
| драма | **18** |
| мультфильм | **16** |
| ужасы | **27** |
| фантастика | **878** |

**Провайдеры** (зависят от региона):
| Провайдер | ID | Регион RU | Регион US |
|---|---|---|---|
| Netflix | **8** | НЕТ | ДА |
| Apple TV | **350** | ДА | — |

**Сети** (для сериалов, регион-независимы):
| Сеть | ID |
|---|---|
| Netflix | **213** |
| Apple TV | **2552** |

**Контрольные выборки discover**:
| Запрос | total |
|---|---|
| movie genres=35 keywords=207317 | **1551** |
| movie genres=35 providers=8 US | **1823** |
| tv networks=2552 | **242** |
| tv genres=35 networks=213 | **649** |

---

## B5. Массовые подборки

### B5.1. Франшизы (TMDB collections)

```js
// Поиск:
Lampa.Api.sources.tmdb.get('search/collection', {query: 'star wars', langs: 'ru-RU', page: 1}, ...)
// -> total=7, [{id:10, name:'Звёздные Войны (Коллекция)'}]

// Получить коллекцию (parts[], НЕ results[]):
Lampa.Api.sources.tmdb.get('collection/10', {langs: 'ru-RU'}, function(json) {
    json.results = json.parts || []  // конвертация
    call(json)
})
```

**Известные id коллекций**:
| Коллекция | ID | parts |
|---|---|---|
| Звёздные Войны | **10** | 9 |
| Гарри Поттер | **1241** | 8 |
| Властелин Колец | **119** | 3 |
| Хоббит | **121938** | 3 |

**ОГРАНИЧЕНИЕ**: `category_full` не умеет открывать `collection/{id}` напрямую — TypeError. Всегда конвертировать `parts->results`.

### B5.2. Keyword-вселенные

```js
// Keyword Star Wars = 379196 (проверено живьём):
Lampa.Activity.push({
    url: 'discover/movie?with_keywords=379196',
    title: 'Звёздные войны',
    component: 'category_full',
    source: 'tmdb',
    page: 1
})
```

### B5.3. Студии (with_companies)

| Студия | ID | total фильмов |
|---|---|---|
| Marvel Studios | **420** | 103 |
| Pixar | **3** | 138 |
| Studio Ghibli | **10342** | 83 |
| A24 | **41077** | 175 |
| DC Studios | **128064** | 17 |
| Lucasfilm Ltd. | **1** | 108 |

```js
return function(call) {
    Lampa.Api.sources.tmdb.get('discover/movie', {companies: 10342, sort_by: 'popularity.desc', page: 1},
        function(json) { json.title = 'Studio Ghibli'; call(json); }, call)
}
```

### B5.4. Режиссёры и актёры (with_people)

| Человек | ID | total |
|---|---|---|
| Кристофер Нолан | **525** | 61 |
| Квентин Тарантино | **138** | 135 |
| Леонардо Ди Каприо | **6193** | 137 |

```js
Lampa.Api.sources.tmdb.get('discover/movie', {
    filter: {'with_people': 525},
    sort_by: 'popularity.desc',
    page: 1
}, function(json) { json.title = 'Кристофер Нолан'; call(json); }, call)
```

Компонент `'actor'` зарегистрирован. Открывать через `Lampa.Router.call('actor', personData)`.

### B5.5. Страны и языки

| Подборка | Параметры | total |
|---|---|---|
| K-Drama | genres=18, filter={'with_origin_country':'KR'} | **3086** |
| Турецкие сериалы | orig_lang='tr' (TV) | **2459** |
| Аниме | genres=16, orig_lang='ja' (TV) | **5431** |

```js
Lampa.Api.sources.tmdb.get('discover/tv', {genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc', page: 1},
    function(json) { json.title = 'Аниме'; call(json); }, call)
```

### B5.6. Временные срезы

```js
// Лучшие фильмы 1980-1989 (total=532):
Lampa.Api.sources.tmdb.get('discover/movie', {
    sort_by: 'vote_average.desc',
    filter: {
        'primary_release_date.gte': '1980-01-01',
        'primary_release_date.lte': '1989-12-31',
        'vote_count.gte': 500
    },
    page: 1
}, function(json) { json.title = 'Лучшие фильмы 80-х'; call(json); }, call)
```

### B5.7. Публичные списки TMDB

```js
// list/10 = 'Top 50 Grossing Films of All Time', 50 фильмов, без аккаунта:
Lampa.Api.sources.tmdb.get('list/10', {}, function(json) {
    // json.items[] — НЕ json.results[]
    json.results = json.items || []
    json.title = json.name
    call(json)
}, call)
```

### B5.8. Кинопоиск: тематические коллекции

**CORS**: открыт (Access-Control-Allow-Origin: *). Нужен API-ключ (500 req/день бесплатно).

```
URL: GET https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=TYPE&page=1
Header: X-API-KEY: <key>
```

**Доступные types**: TOP_250_MOVIES, TOP_POPULAR_ALL, TOP_250_TV_SHOWS, VAMPIRE_THEME, COMICS_THEME, FAMILY, OSKAR_WINNERS_2021, LOVE_THEME, ZOMBIE_THEME, CATASTROPHE_THEME, KIDS_ANIMATION_THEME, POPULAR_SERIES

**Формат ответа**:
```json
{"total": 250, "totalPages": 13, "items": [{"kinopoiskId": 258687, "imdbId": "tt0111161", "nameRu": "Побег из Шоушенка", "year": 1994, "rating": 9.1}]}
```

**Маппинг на TMDB** через imdbId:
```js
Lampa.Api.sources.tmdb.get('find/' + imdbId, {filter: {'external_source': 'imdb_id'}}, function(json) {
    var movie = (json.movie_results || json.tv_results || [])[0]
    // movie.id = TMDB id
})
```

Стоимость: TOP_250 = 1 запрос КП + до 250 /find TMDB = 251 req. Кэшировать `{life: 60*24*30}`.

### B5.9. Проверка произвольной выборки (итог)

| URL | Результат |
|---|---|
| `discover/movie?with_keywords=379196` | РАБОТАЕТ |
| `discover/tv?with_networks=213` | РАБОТАЕТ |
| `collection/10` | ОШИБКА — нужна конвертация parts->results |
| `list/10` | РАБОТАЕТ — нужна конвертация items->results |

### B5.10. Рекомендованный метод добавления рядов

**РЕКОМЕНДОВАННЫЙ метод**: `ContentRows.add` (проверено живьём).

Для добавления именно в main: ставить `screen: 'main'`.

```js
Lampa.Activity.push({component: 'main', source: 'tmdb', title: 'Главная'})
```

---

## Архитектурные рекомендации

### Netflix-герой: надстройка vs замена

**РЕКОМЕНДУЮ надстройку** (ContentRows + MutationObserver):
1. MutationObserver следит за `.card.focus` -> `el.card_data.backdrop_path`
2. `Lampa.TMDB.image('t/p/w1280' + path)` -> CSS фон с transition
3. `ContentRows.add` для дополнительных рядов
4. `Menu.addButton` для пунктов меню подборок

Плюсы: совместимо с обновлениями, не ломает навигацию, меньше кода.

Полная замена `Component.add('main', ...)` — только если нужен принципиально другой UX.

### Типы подборок без парсера

| Тип | API | Примечание |
|---|---|---|
| Жанр | `genres: 35` | |
| Ключевое слово | `keywords: 207317` или `?with_keywords=` | |
| Сеть (TV) | `networks: 213` | Лучший для Netflix/Apple TV сериалов |
| Провайдер | `watch_providers: 8, watch_region:'US'` | Зависит от региона! Netflix нет в RU |
| Студия | `companies: 420` | |
| Режиссёр/актёр | `filter:{'with_people':525}` | |
| Язык оригинала | `orig_lang:'ja'` | Аниме, дорамы |
| Страна | `filter:{'with_origin_country':'KR'}` | |
| Дата | `filter:{'primary_release_date.gte':'...'}` | |
| Коллекция | `collection/{id}` + конвертация parts->results | |
| Публичный список | `list/{id}` + конвертация items->results | |
| Кинопоиск | API КП + /find маппинг | Нужен ключ |

---

## Сводная шпаргалка

```js
// 1. ФОКУС КАРТОЧКИ (MutationObserver, проверено)
new MutationObserver(function(mutations) {
    mutations.forEach(function(m) {
        var el = m.target
        if (el.classList && el.classList.contains('card') && el.classList.contains('focus') && el.card_data) {
            var d = el.card_data
            // d.id, d.title||d.name, d.backdrop_path, d.overview, d.vote_average, d.genre_ids
            var bgUrl = Lampa.TMDB.image('t/p/w1280' + d.backdrop_path)
        }
    })
}).observe(document.body, {attributes: true, attributeFilter: ['class'], subtree: true})

// 2. РЯД НА ГЛАВНУЮ (ContentRows, проверено живьём)
Lampa.ContentRows.add({
    name: 'xmas_comedy', title: 'Рождественские комедии', screen: 'main', index: 2,
    call: function(params, screen) {
        return function(call) {
            Lampa.Api.sources.tmdb.get('discover/movie', {genres: 35, keywords: 207317, sort_by: 'popularity.desc', page: 1},
                function(json) { json.title = 'Рождественские комедии'; call(json); }, call, {life: 60*24*7})
        }
    }
})

// 3. ПУНКТ МЕНЮ
Lampa.Menu.addButton('<svg>...</svg>', 'Подборка', function() {
    Lampa.Activity.push({url: 'discover/movie?with_genres=35&with_keywords=207317',
        title: 'Рождественские комедии', component: 'category_full', source: 'tmdb', page: 1})
})

// 4. ОТКРЫТЬ ВЫБОРКУ (url с query-строкой)
Lampa.Activity.push({url: 'discover/movie?with_keywords=379196',
    title: 'Звёздные войны', component: 'category_full', source: 'tmdb', page: 1})

// 5. КОЛЛЕКЦИЯ (нужна конвертация parts->results)
Lampa.Api.sources.tmdb.get('collection/10', {langs: 'ru-RU'}, function(json) {
    json.results = json.parts || []; call(json)
}, call, {life: 60*24*7})

// 6. СТУДИЯ
Lampa.Api.sources.tmdb.get('discover/movie', {companies: 10342, sort_by: 'popularity.desc', page: 1}, ...)

// 7. АНИМЕ
Lampa.Api.sources.tmdb.get('discover/tv', {genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc', page: 1}, ...)

// 8. ЛЮДИ
Lampa.Api.sources.tmdb.get('discover/movie', {filter: {'with_people': 525}, sort_by: 'popularity.desc', page: 1}, ...)

// 9. СПИСОК TMDB (нужна конвертация items->results)
Lampa.Api.sources.tmdb.get('list/10', {}, function(json) { json.results = json.items||[]; call(json) }, call)
```

---

## Критические замечания

1. **`el.card_data`** — нативное JS-свойство DOM-узла. `$(el).data()` пустой. Проверено живьём.
2. **MutationObserver** — единственный надёжный способ отследить фокус карточки на главной.
3. **ContentRows.add** — проверен живьём. Не вызывается при params.genres/keywords для category-экранов.
4. **`collection/{id}` через category_full** — ОШИБКА. Нужна конвертация `parts->results`.
5. **`list/{id}`** — нужна конвертация `items->results`.
6. **Netflix в RU** — provider id=8 отсутствует в регионе RU. Для Netflix-сериалов: `networks=213`.
7. **Apple TV сеть**: id=2552 называется 'Apple TV' в TMDB (не 'Apple TV+').
8. **ContentRows** — пользователь может отключить ряд плагина через настройки ContentRows.
9. **Компонент 'actor'** зарегистрирован. Открывать через `Lampa.Router.call('actor', personData)`.
10. **Ряды главной строятся лениво**: первые 1 (TV) или 6 (browser), остальные при скролле.
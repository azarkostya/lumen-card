# Lampa API Notes 2 — Исследование для плагина "full card"

**Источники**: raw.githubusercontent.com/yumata/lampa-source/main  
**Дата исследования**: сентябрь 2026  
**Изученные файлы**: src/core/api/sources/tmdb.js, src/utils/reguest.js, src/core/tmdb/tmdb.js, src/components/full/start/trailers.js, src/components/full/discuss.js, src/templates/full/start_new.js, src/templates/icons/sprite.js, src/interaction/youtube.js

---

## Тема 1: Кадры/бэкдропы фильма (для слайдшоу)

### Что приходит в e.data.movie.images

Файл `src/core/api/sources/tmdb.js`, функция `full()`, строка 545:

```js
get(
    params.method + '/' + params.id +
    '?append_to_response=content_ratings,release_dates,external_ids,keywords,alternative_titles,images' +
    '&include_image_language=' + image_languages,
    params, (json) => { ... }
)
```

**Важно**: `images` входит в `append_to_response`, `videos` — НЕТ. Videos запрашиваются отдельным вызовом (Тема 2).

Параметр `include_image_language` (строки 540–541):

```js
let image_language  = (Storage.field('tmdb_lang') || 'en').split(/[-_]/)[0]
let image_languages = [image_language, 'en', 'null']
    .filter((l, i, arr) => arr.indexOf(l) === i)
    .join(',')
// Для ru: "ru,en,null"
```

Загруженный json попадает в e.data.movie через `status.append('movie', json)`.

### Структура e.data.movie.images

```js
e.data.movie.images = {
    backdrops: [
        {
            file_path:    '/xyz123.jpg',  // начинается с '/'
            width:        3840,
            height:       2160,
            iso_639_1:    'en',           // null — без языка
            vote_average: 5.312,
            vote_count:   12,
            aspect_ratio: 1.778
        }
        // ...
    ],
    posters: [ { file_path, width, height, ... } ],
    logos:   [ { file_path, width, height, ... } ]
}
```

### Как построить URL изображения

`src/core/tmdb/tmdb.js`, функция `image()`:

```js
function image(url) {
    let base = Utils.protocol() + 'image.tmdb.org/' + url
    return Storage.field('proxy_tmdb') && Storage.field('tmdb_proxy_image')
        ? proxy('tmdb_proxy_image') + '/' + base
        : base
}
```

Правильный вызов из плагина:

```js
// Вариант A — TMDB.image (учитывает прокси пользователя)
let imgUrl = Lampa.TMDB.image('t/p/w1280' + file_path)
// → 'https://image.tmdb.org/t/p/w1280/xyz123.jpg'

// Вариант B — Api.img (обёртка, вызывает то же самое)
let imgUrl = Lampa.Api.img(file_path, 'w1280')
```

Доступные размеры backdrop: `w300`, `w780`, `w1280`, `original`.

### Получение backdrops в плагине

```js
Lampa.Listener.follow('full', function(e) {
    if (e.type !== 'complite') return
    let backdrops = (e.data.movie.images && e.data.movie.images.backdrops) || []
    let urls = backdrops
        .filter(b => b.file_path)
        .map(b => Lampa.TMDB.image('t/p/w1280' + b.file_path))
    // urls — массив строк URL для слайдшоу
})
```

### imdb_id и external_ids

Строки 548–550 tmdb.js (full):

```js
if (json.external_ids) {
    json.imdb_id = json.external_ids.imdb_id
}
```

`e.data.movie.imdb_id` — строка 'tt1234567'. Поле `e.data.movie.external_ids` тоже присутствует целиком.  
`kinopoisk_id` в standard TMDB external_ids отсутствует — получать через kinopoiskapiunofficial.tech (Тема 4).

---

## Тема 2: Трейлеры YouTube

### Откуда берутся e.data.videos

Функция `videos()` в tmdb.js (строки 635–656) запрашивает ОТДЕЛЬНО от основных данных:

```js
function videos(params = {}, oncomplite, onerror) {
    let lg = Storage.field('tmdb_lang')
    // Запрос на языке пользователя
    get(params.method + '/' + params.id + '/videos', { langs: lg }, (json) => {
        status.append('one', json)
    }, ...)
    // Если язык не en — дополнительный запрос на английском
    if (lg !== 'en') get(params.method + '/' + params.id + '/videos', { langs: 'en' }, (json) => {
        status.append('two', json)
    }, ...)
    // Объединение: status.onComplite → oncomplite({ results: [...one, ...two] })
}
```

Вызов из full() (строка 601–608): `videos()` вызывается только если `!Permit.child && !disable_features.trailers`.  
Результат: `e.data.videos = { results: [...] }`.

### Структура каждого элемента results

```js
{
    key:          'dQw4w9WgXcQ',   // YouTube video ID — главное поле
    name:         'Official Trailer',
    official:     true,
    published_at: '2023-03-15T14:00:00.000Z',
    iso_639_1:    'en',            // язык видео
    site:         'YouTube',       // поле из TMDB API
    url:          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    youtube:      true,            // если undefined — в trailers.js считается true
    icon:         'https://img.youtube.com/vi/dQw4w9WgXcQ/default.jpg',
    player:       undefined        // для нестандартных плееров
}
```

В trailers.js: `url = element.url || 'https://www.youtube.com/watch?v=' + element.key`.

### Как Lampa воспроизводит трейлер (trailers.js строки 63–101)

```js
if (Platform.is('android') && Storage.field('player_launch_trailers') == 'youtube' && a.youtube) {
    Android.openYoutube(a.id)     // открыть нативный YouTube на Android
}
else {
    Player.play(a)                // встроенный плеер Lampa
    Player.playlist(playlist)
}
```

Сигнатуры:
- `Lampa.Android.openYoutube(youtubeId: string): void`
- `Lampa.Player.play(item: {url, title, ...}): void`

### YouTube IFrame API (src/interaction/youtube.js)

Экспортирует одну публичную функцию:

```js
// Сигнатура:
Lampa.YouTube.play(id: string): void

// Реализация:
function play(id) {
    if (typeof YT == 'undefined') return   // молча игнорирует если API не загружен!
    // Создаёт <div class="youtube-player"> + new YT.Player('youtube-player', {
    //   videoId: id, playerVars: { controls: 0, autoplay: 1, ... }
    // })
    Controller.toggle('youtube')
}
```

Это не для трейлеров — для встроенного фонового/отдельного воспроизведения. На Android TV `YT` чаще недоступен.

Проверка платформы: `Lampa.Platform.is('android')` → boolean.

---

## Тема 3: Сетевые запросы (Reguest)

### Класс и конструктор

Файл: `src/utils/reguest.js`. JS-класс внутри называется `Request`, экспортируется и используется везде как `Reguest` (историческая опечатка).

```js
let network = new Lampa.Reguest()
```

### Методы

```js
network.timeout(ms)
// Установить таймаут (по умолчанию 30000). СБРАСЫВАЕТСЯ на 30000 после каждого запроса!

network.get(url, ok, err, post_data)
// Видимый: посылает события start/end → показывает loader.

network.silent(url, ok, err, post_data, params)
// Тихий: при следующем вызове silent/get колбэки предыдущих отменяются.

network.quiet(url, ok, err, post_data, params)
// Всегда выполняется, не отменяется.

network.last(url, ok, err, post_data)
// Выполняет только последний поставленный запрос.

network.native(url, ok, err, post_data, params)
// На Android: Android.httpReq; иначе: как silent.

network.clear()
// Отменить все ожидающие колбэки текущего экземпляра.

network.again()
// Повторить последний запрос.
```

### Поддерживаемые params (5й аргумент)

```js
{
    cache:           { life: N },               // кэш N минут через IndexedDB
    dataType:        'json' | 'text' | ...,     // тип ответа (по умолчанию 'json')
    timeout:         15000,                     // таймаут для этого запроса
    headers:         { 'X-API-KEY': 'abc' },    // HTTP заголовки (→ $.ajax headers)
    beforeSend:      { name: 'X-H', value: 'v' }, // один заголовок через xhr.setRequestHeader
    post_data:       { key: 'val' },            // POST тело (выставляет type: 'POST')
    type:            'POST' | 'GET',
    withCredentials: true,                      // xhrFields.withCredentials
    attempts:        2                          // повторных попыток при ошибке
}
```

Реализация `headers` (строки 566–569 reguest.js):

```js
if (params.headers) {
    data.headers = params.headers   // передаётся прямо в $.ajax({headers: ...})
}
```

### CORS и прокси

Lampa использует `$.ajax()` (jQuery) — стандартный браузерный CORS без обхода.

**Прокси для TMDB** (через настройки пользователя):
- `Storage.field('proxy_tmdb')` — включить прокси
- `Storage.field('tmdb_proxy_api')` — URL прокси API (используется в `TMDB.api()`)
- `Storage.field('tmdb_proxy_image')` — URL прокси изображений (используется в `TMDB.image()`)

**Зеркала CUB**: `Manifest.cub_mirrors` — при ошибке Reguest автоматически пробует следующее зеркало.

Для стороннего API в плагине — нужно чтобы API сам отдавал `Access-Control-Allow-Origin: *`.

### Пример запроса с заголовками

```js
let network = new Lampa.Reguest()
network.timeout(15000)
network.silent(
    'https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=' + imdbId,
    function(data) { /* data.items[0].kinopoiskId */ },
    function() { /* ошибка */ },
    false,
    {
        headers: { 'X-API-KEY': userApiKey },
        cache:   { life: 60 * 24 * 7 }
    }
)
```

---

## Тема 4: Русские отзывы пользователей

### Результаты CORS проверки

**kinopoiskapiunofficial.tech** — preflight OPTIONS:
```
HTTP/1.1 200
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET,POST,OPTIONS,PATCH,DELETE,PUT
Access-Control-Allow-Headers: x-api-key
```
CORS открыт полностью. GET без ключа возвращает HTTP 401.

**api.kinopoisk.dev** — делает HTTP 301 → **api.poiskkino.dev**:
```
HTTP/1.1 204 (api.poiskkino.dev)
Access-Control-Allow-Origin: *
Access-Control-Allow-Headers: x-api-key
```
CORS открыт. jQuery следует редиректу автоматически.

### kinopoiskapiunofficial.tech — полная схема

Требования: бесплатный API ключ (регистрация на kinopoiskapiunofficial.tech), 500 req/день на бесплатном тарифе.

**Шаг 1**: KinoPoisk ID по IMDB ID:
```
GET https://kinopoiskapiunofficial.tech/api/v2.2/films?imdbId=tt1234567
X-API-KEY: <ключ>
```
Ответ: `{ total: 1, items: [{ kinopoiskId: 301, imdbId: "tt1234567", nameRu: "...", ... }] }`

**Шаг 2**: Отзывы по kinopoiskId:
```
GET https://kinopoiskapiunofficial.tech/api/v2.2/films/301/reviews?page=1&order=DATE_DESC
X-API-KEY: <ключ>
```
Ответ:
```json
{
  "total": 100,
  "totalPositiveReviews": 70,
  "totalNegativeReviews": 20,
  "totalNeutralReviews": 10,
  "items": [
    {
      "kinopoiskId": 301,
      "type":            "POSITIVE",
      "date":            "2023-01-15T10:30:00",
      "positiveRating":  50,
      "negativeRating":  5,
      "author":          "Имя автора",
      "title":           "Заголовок",
      "description":     "Текст отзыва..."
    }
  ]
}
```
`type`: `POSITIVE` | `NEGATIVE` | `NEUTRAL`.

### CUB Discuss (e.data.discuss)

Из tmdb.js full(), строки 618–624:

```js
if (Lang.selected(['ru','uk','be']) && window.lampa_settings.account_use && !Permit.child) {
    Api.sources.cub.discussGet(params, (json) => {
        status.append('discuss', json)
    })
}
```

Загружается только при: язык RU/UK/BE + аккаунт CUB + не детский режим.  
Это внутренние CUB-отзывы, не KinoPoisk. Использовать как дополнение, не как основу.

### Получение external_ids в плагине

```js
let movie   = e.data.movie
let imdbId  = movie.imdb_id                // 'tt1234567' (строка)
// kinopoisk_id нет в стандартных external_ids TMDB:
// movie.external_ids.kinopoisk_id — не стандартное поле
// Получать kpId через запрос к kinopoiskapiunofficial.tech
```

### Итоговая таблица

| Источник | CORS | Ключ пользователя | Лимит/день | Рекомендация |
|---|---|---|---|---|
| kinopoiskapiunofficial.tech | * (открыт) | Бесплатный | 500 req | Лучший выбор |
| api.kinopoisk.dev (poiskkino.dev) | * (открыт) | Нужен | По тарифу | Альтернатива |
| CUB discuss | Встроен | Нет (нужен CUB-аккаунт) | — | Дополнение |

---

## Тема 5: Иконки кнопок карточки

### Источник спрайтов

Файл: `src/templates/icons/sprite.js` — вставляется в DOM как `<svg id="sprites" style="display: none;">`.  
Все иконки используют `currentColor` — наследуют цвет через CSS.

### Кнопки шаблона full_start_new

#### 1. button--play — «Смотреть»
```html
<svg><use xlink:href="#sprite-play"></use></svg>
```
sprite.js: `viewBox="0 0 28 29"`, fill=none — окружность stroke + треугольник fill.

#### 2. button--book — «Закладки» (инлайн в шаблоне)
```html
<svg width="21" height="32" viewBox="0 0 21 32" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M2 1.5H19...V2C1.5 1.72386 1.72386 1.5 2 1.5Z" stroke="currentColor" stroke-width="2.5"/>
</svg>
```
`viewBox="0 0 21 32"`, только stroke. Bookmark-закладка.

#### 3. button--reaction — «Реакции»
```html
<svg><use xlink:href="#sprite-reaction"></use></svg>
```
sprite.js: `viewBox="0 0 38 34"`, fill. Конверт-мессенджер с карандашом.

#### 4. button--subscribe — «Подписка» (инлайн, класс hide по умолчанию)
```html
<svg viewBox="0 0 25 30" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M6.01892 24C...30C..." fill="currentColor"/>
  <path d="M3.81972 14.5957V10.2679..." stroke="currentColor" stroke-width="2.6"/>
</svg>
```
`viewBox="0 0 25 30"`, fill + stroke. Колокольчик уведомлений.

#### 5. button--options — «Ещё» (три точки)
```html
<svg><use xlink:href="#sprite-dots"></use></svg>
```
sprite.js: `viewBox="0 0 38 10"`, fill. Три горизонтальные точки.

#### 6. view--torrent — «Торренты» (в buttons--container, скрытый)
```html
<svg><use xlink:href="#sprite-torrent"></use></svg>
```
sprite.js: `viewBox="0 0 47 47"`, fill. Логотип BitTorrent.

#### 7. view--trailer — «Трейлеры» (в buttons--container, скрытый)
```html
<svg><use xlink:href="#sprite-trailer"></use></svg>
```
sprite.js: `viewBox="0 0 80 70"`, fill. Прямоугольник с треугольником воспроизведения (стиль YouTube).

### Как заменить иконку спрайта из плагина

```js
// Изменить symbol в уже вставленном спрайте:
function replaceSprite(spriteId, newInnerSvg) {
    let sym = document.querySelector('#sprites #sprite-' + spriteId)
    if (sym) sym.innerHTML = newInnerSvg
}
// Пример:
replaceSprite('play', '<path d="M8 5l15 9.5L8 24V5z" fill="currentColor"/>')
```

Для инлайн-кнопок (button--book, button--subscribe) — только через замену шаблона `Lampa.Template.add('full_start_new', newHtml)`.

---

## Сводная шпаргалка

```js
// BACKDROPS
let backdrops = (e.data.movie.images && e.data.movie.images.backdrops) || []
let toUrl = (fp) => Lampa.TMDB.image('t/p/w1280' + fp)

// VIDEOS (трейлеры)
let videos = (e.data.videos && e.data.videos.results) || []

// IMDB_ID
let imdbId = e.data.movie.imdb_id   // 'tt1234567'

// СЕТЬ С ЗАГОЛОВКАМИ
let net = new Lampa.Reguest()
net.timeout(15000)
net.silent(url, onOk, onErr, false, { headers: { 'X-API-KEY': key } })

// ТРЕЙЛЕР: Android
Lampa.Android.openYoutube(youtubeKey)
// ТРЕЙЛЕР: все остальные
Lampa.Player.play({ url: 'https://www.youtube.com/watch?v=' + youtubeKey, title: name })
```

---

## Критические замечания

1. **`e.data.videos`** может отсутствовать (детский режим или `disable_features.trailers`). Всегда проверяйте.
2. **`e.data.movie.images`** может отсутствовать или иметь пустой `backdrops`. Проверяйте.
3. **`network.timeout(ms)`** сбрасывается на 30000 мс после каждого запроса — вызывайте перед каждым `.silent()`.
4. **KinoPoisk ID**: не входит в стандартный TMDB external_ids. Нужен отдельный запрос с imdb_id.
5. **API ключ kinopoiskapiunofficial.tech**: нужен UI для ввода пользователем; хранить через `Lampa.Storage.set('plugin_kp_key', key)`.
6. **api.kinopoisk.dev** делает редирект 301 → `api.poiskkino.dev`. jQuery следует автоматически.
7. **Lampa.YouTube.play(id)** молча отказывает при `typeof YT == 'undefined'` (типично для Android TV-приложения).
8. **Замена спрайта** — только после `app:ready`, когда спрайт уже вставлен в DOM.
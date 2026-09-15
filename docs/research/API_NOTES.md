# Lampa API Notes — Исследование для плагина "full card"

**Источники**: raw.githubusercontent.com/yumata/lampa-source/main  
**Версия package.json**: 0.0.1 (техническая; реальная версия приложения не указана в package.json)  
**Последний коммит дерева**: sha 56be33eb7077e326f4e00529ba35fe0040489810  
**Дата исследования**: сентябрь 2026

---

## 1. Шаблон full_start_new

**Файл**: `src/templates/full/start_new.js`

```html
<div class="full-start-new">

    <div class="full-start-new__body">
        <div class="full-start-new__left">
            <div class="full-start-new__poster">
                <img class="full-start-new__img full--poster" />
            </div>
        </div>

        <div class="full-start-new__right">
            <div class="full-start-new__head"></div>
            <div class="full-start-new__title">{title}</div>
            <div class="full-start-new__tagline full--tagline">{tagline}</div>
            <div class="full-start-new__rate-line">
                <div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>
                <div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>
                <div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>
                <div class="full-start__pg hide"></div>
                <div class="full-start__status hide"></div>
            </div>
            <div class="full-start-new__details"></div>
            <div class="full-start-new__reactions">
                <div>#{reactions_none}</div>
            </div>
            <div class="full-start-new__buttons">
                <div class="full-start__button selector button--play">...</div>
                <div class="full-start__button selector button--book">...</div>
                <div class="full-start__button selector button--reaction">...</div>
                <div class="full-start__button selector button--subscribe hide">...</div>
                <div class="full-start__button selector button--options">...</div>
            </div>
        </div>
    </div>

    <!-- скрытый контейнер с кнопками для .button--play select-меню -->
    <div class="hide buttons--container">
        <div class="full-start__button view--torrent hide">...</div>
        <div class="full-start__button selector view--trailer">...</div>
    </div>
</div>
```

### Переменные шаблона ({...})
- `{title}` — локализованное название
- `{rating}` — рейтинг TMDB (число с одним десятичным знаком)
- `{tagline}` — слоган (если нет — элемент `.full--tagline` удаляется через `.remove()`)

### Языковые ключи (#{...})
- `#{reactions_none}`, `#{title_watch}`, `#{settings_input_links}`, `#{title_reactions}`, `#{title_subscribe}`, `#{full_torrents}`, `#{full_trailers}`

### Классы-маркеры (добавляются JS-логикой, не шаблоном)
- `.full--poster` — img постера (используется для загрузки изображения)
- `.full--tagline` — строка слогана
- `.full-start__background` — фоновое изображение (добавляется в DOM отдельно через `Template.elem('img', {...})`)
- `.rate--tmdb`, `.rate--imdb`, `.rate--kp` — блоки рейтингов (rate--imdb и rate--kp начинают со state hide)
- `.full-start__pg` — возрастной рейтинг (hide пока нет данных)
- `.full-start__status` — статус сериала (hide пока нет данных)
- `.full-start-new__title.twolines` — добавляется если нет tagline и title > 25 символов
- `.card--tv`, `.card--adult` — добавляются на `.full-start-new__poster`

---

## 2. Стили (SCSS)

**Файл**: `src/sass/components/full/start_new.scss`

### Ключевые правила

```scss
.full-start-new {
    padding: 0 $offset;
    padding-bottom: 4em;

    &__body { display: flex; align-items: flex-end; }

    /* Левая колонка — постер */
    &__left {
        flex-shrink: 0;
        width: 17em;          /* фиксированная ширина */
        margin-right: 3em;
    }

    /* Правая колонка — весь контент */
    &__right { flex-grow: 1; }

    /* Постер: padding-bottom 150% — соотношение 2:3 */
    &__poster {
        position: relative;
        padding-bottom: 150%;
        background-color: $bg_light;
        border-radius: 1em;

        &.loaded img { opacity: 1; transform: translate3d(0,0,0); }
        &.with-out img { mask-image: linear-gradient(to bottom, white 40%, rgba(255,255,255,0) 100%); }
    }

    /* img: position:absolute, заполняет постер */
    &__img { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; border-radius: 1em; opacity: 0; }

    /* Заголовок */
    &__head { color: rgba(255,255,255,0.6); font-size: 1.2em; }
    &__title {
        font-size: 4em; font-weight: 600;
        -webkit-line-clamp: 1;    /* одна строка по умолчанию */
        &.twolines { -webkit-line-clamp: 2; font-size: 3.5em; }
    }
    &__tagline { font-size: 1.8em; }

    /* Details: flex wrap, разделитель ● */
    &__details { display: flex; align-items: center; flex-wrap: wrap; min-height: 1.9em; font-size: 1.1em; }

    /* Кнопки: скрывают span если нет .focus */
    &__buttons .full-start__button:not(.focus) span { display: none; }

    /* Рейтинги */
    &__rate-line { display: flex; margin-bottom: 2.2em; align-items: center; }
}

/* Убираем poster-колонку если нет постера */
@media (min-width: $media_md) {
    body.no--poster .full-start-new__left { display: none; }
}
```

### Адаптивность
- `max-width: $media_sm` — постер 30% ширины, шрифт заголовка 2.8em
- `max-width: $media_xm` — вертикальная раскладка: постер на всю ширину, контент перекрывает постер снизу с градиентом `linear-gradient(to bottom, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)`

---

## 3. Событие Lampa.Listener 'full'

**Файл**: `src/components/full.js`

Все три типа события посылаются через `Lampa.Listener.send('full', {...})`.

### Типы событий

| type | когда | что есть в объекте |
|---|---|---|
| `'start'` | Данные загружены, до создания компонентов | link, type, props, body, object, data |
| `'complite'` | После создания всех компонентов (опечатка — не complete) | link, type, props, body, object, data |
| `'build'` | При создании каждого дочернего компонента (start, description, etc.) | link, type, props, body, name, item, data |

### Поля объекта события

```js
Lampa.Listener.follow('full', function(e) {
    // e.type      — 'start' | 'complite' | 'build'
    // e.link      — экземпляр компонента full (Main instance)
    // e.props     — Props-объект с данными (e.props.get('movie') → объект фильма)
    // e.body      — jQuery-обёртка над корневым DOM-узлом компонента ($(this.html))
    // e.object    — исходный объект Activity (e.object.id, e.object.method, e.object.card)
    // e.data      — объект с данными от Api.full(): {movie, persons, episodes, recomend, simular, discuss, collection, metadata}
    // e.name      — имя под-компонента (только для type='build'): 'start'|'description'|'persons'|'cards'|'discuss'|'episodes'
    // e.item      — экземпляр под-компонента (только для type='build')
})
```

### Практически важно

```js
Lampa.Listener.follow('full', function(e) {
    if (e.type == 'complite') {
        let movie = e.data.movie   // объект фильма
        let body  = e.body         // jQuery корень
        // Фоновое изображение доступно как:
        let bg = body.find('.full-start__background')
    }
})
```

---

## 4. Как плагины подключают CSS и подменяют шаблоны

**Файл документации**: `docs/ru/05-templates-lang.md`

### Подмена шаблона (полная замена)

```js
function init() {
    // Заменить встроенный шаблон full_start_new своим HTML
    Lampa.Template.add('full_start_new', `
        <div class="full-start-new my-plugin">
            ...
        </div>
    `)
}
```

`Template.add(name, html)` сбрасывает кэш (`delete created[name]`) и заменяет строку в словаре шаблонов. При следующем вызове `Template.get('full_start_new', {...})` будет использован новый HTML.

### Подключение CSS

```js
function init() {
    // Вариант 1: через Template (рекомендован документацией)
    Lampa.Template.add('my_plugin_css', `
        <style>
            .my-selector { color: red; }
        </style>
    `)
    $('body').append(Lampa.Template.get('my_plugin_css', {}, true))

    // Вариант 2: напрямую (используется в twolines.js)
    $('body').append('<style>.my-selector { color: red; }</style>')
}
```

**Файл twolines.js** (src: plugins/twolines/twolines.js):
```js
function init(){
    $('body').append(`<style>@@include('../plugins/twolines/css/style.css')</style>`)
}

if(window.appready) init()
else {
    Lampa.Listener.follow('app', function(e) {
        if (e.type == 'ready') init()
    })
}
```

### Template API

```js
// Получить jQuery DOM (для вставки)
let el = Lampa.Template.get('full_start_new', { title: 'Мой фильм' })

// Получить сырую HTML-строку
let str = Lampa.Template.get('full_start_new', {}, true)

// Получить все шаблоны
let all = Lampa.Template.all()

// Создать DOM-элемент
let img = Lampa.Template.elem('img', { class: 'full-start__background' })

// Найти по префиксу класса BEM
let parts = Lampa.Template.prefix(html, 'full-start-new')
// → { body: el, left: el, right: el, title: el, ... }
```

---

## 5. Откуда брать данные

### Рейтинги

Все три рейтинга берутся из `e.data.movie` в событии 'full':

```js
let movie = e.data.movie

// TMDB (всегда есть)
let tmdb = parseFloat(movie.vote_average || 0).toFixed(1)   // Number

// IMDB и KP — устанавливаются внешними парсерами/источниками (cub, lampa-server)
// В стандартном TMDB источнике НЕ заполняются
let imdb = movie.imdb_rating   // String или Number, может быть undefined
let kp   = movie.kp_rating     // String или Number, может быть undefined
```

Проверка в full_start.js:
```js
if (this.card.imdb_rating && parseFloat(this.card.imdb_rating) > 0) {
    this.html.find('.rate--imdb').removeClass('hide')
        .find('> div').eq(0).text(parseFloat(this.card.imdb_rating) >= 10 ? 10 : this.card.imdb_rating)
}
```

**Важно**: `imdb_rating` и `kp_rating` заполняются только когда в Lampa настроен парсер-сервер или используется CUB-аккаунт. Из чистого TMDB эти поля отсутствуют.

### Прогресс просмотра (Timeline)

```js
// Хэш для фильма (не сериала)
let hash = Lampa.Utils.hash(movie.original_title)
// Хэш для эпизода сериала
let hash = Lampa.Utils.hash([season, season > 10 ? ':' : '', episode, movie.original_name].join(''))

// Получить прогресс
let progress = Lampa.Timeline.view(hash)
// → {hash, percent, time, duration, profile, updated, handler}
// percent: 0–100, time: секунды, duration: секунды

// Проверить, смотрел ли фильм (только для фильмов, не сериалов)
let watchedPercent = Lampa.Timeline.watched(movie)  // Number 0–100

// Хранилище: localStorage под ключом 'file_view' (или 'file_view_<profileId>' при синке)
```

### Качество

```js
// Только для фильмов (не сериалов: у них нет release_date)
let quality = !movie.first_air_date
    ? (movie.release_quality || movie.quality)
    : false
// Строка: 'HD', '4K', 'CAM', etc. — устанавливается парсером, не TMDB
```

### Бэкдроп

```js
// Стандартный API
let url = Lampa.Api.img(movie.backdrop_path, 'w1280')
// → 'https://image.tmdb.org/t/p/w1280/...'

// Альтернатива (TMDB.image задаёт домен)
let url2 = Lampa.TMDB.image('t/p/w1280/' + movie.backdrop_path)
```

Используемый размер:
- backdrop: `'w1280'`
- poster: из настроек пользователя (`Storage.field('poster_size')`), обычно `'w500'`

### Жанры, страны, персоны

```js
// Жанры (из movie.genres[])
let genres = movie.genres.slice(0, 5).map(g => g.name).join(' | ')

// Страны — через TMDB.parseCountries()
let countries = Lampa.TMDB.parseCountries(movie)   // → Array<string>

// Актёры (из e.data.persons)
let cast = e.data.persons && e.data.persons.cast   // Array<{name, character, profile_path, ...}>
let crew = e.data.persons && e.data.persons.crew   // Array<{name, job, profile_path, ...}>

// Статус сериала (строка типа 'Returning Series', 'Ended', etc.)
let status = movie.status
// Lampa переводит через: Lang.translate('tv_status_' + status.toLowerCase().replace(/ /g,'_'))
```

---

## 6. Навигация пультом

**Файл документации**: `docs/ru/13-controller.md`

### Класс .selector

Любой элемент с классом `selector` автоматически становится фокусируемым. Достаточно добавить его в DOM.

```js
let btn = $('<div class="selector">Нажми</div>')

btn.on('hover:focus',  () => { /* фокус пришёл */ })
btn.on('hover:enter',  () => { /* нажат OK/Enter */ })
btn.on('hover:long',   () => { /* удержание 800 мс */ })
btn.on('hover:hover',  () => { /* наведение мышью */ })
btn.on('hover:touch',  () => { /* touch start */ })
```

### Регистрация контроллера

Используется в full_start.js под именем `'full_start'`:

```js
Controller.add('full_start', {
    link: this,
    toggle: () => {
        this.emit('groupButtons')
        Controller.collectionSet(this.html)          // указать пул .selector
        Controller.collectionFocus(this.last || false, this.html)  // начальный фокус
    },
    right: () => { Navigator.move('right') },
    left:  () => { if (Navigator.canmove('left')) Navigator.move('left'); else this.emit('left') },
    down:  () => { if (Navigator.canmove('down')) Navigator.move('down'); else this.emit('down') },
    up:    () => { if (Navigator.canmove('up'))   Navigator.move('up');   else this.emit('up') },
    back:  this.emit.bind(this, 'back'),
})
Controller.toggle('full_start')
```

### Важное: кнопки full-start__button

В `start_new.scss` span в кнопках скрыт, пока нет `.focus`:
```scss
.full-start-new__buttons .full-start__button:not(.focus) span { display: none; }
```

`.focus` — это CSS-класс, который Lampa добавляет на сфокусированный `.selector`. Это не `:focus` псевдокласс.

Чтобы новые кнопки были в пуле навигации:
1. Добавить класс `selector` и `full-start__button`
2. Кнопки должны быть внутри элемента, переданного в `Controller.collectionSet(html)` — то есть в `this.html`

---

## 7. Референс: Cardify (bylampa)

**Источник**: bylampa.github.io/cardify.js (обфусцирован) + github.com/zxcghoul1000-7/LampaCustomCardify/cardify-original.js

### Стратегия модификации

Cardify полностью заменяет шаблон `full_start_new` через `Lampa.Template.add('full_start_new', newHtml)` и добавляет свой CSS. Затем вешает хук на событие `'full'` с `type == 'complite'` для модификации DOM после рендера.

```js
// 1. Заменить шаблон
Lampa.Template.add('full_start_new', `<div class="full-start-new cardify">...</div>`)

// 2. Добавить CSS
Lampa.Template.add('cardify_css', `<style>.cardify .full-start-new__body{height:80vh}...</style>`)
$('body').append(Lampa.Template.get('cardify_css', {}, true))

// 3. Модифицировать фон при complite
Lampa.Listener.follow('full', function(e) {
    if (e.type == 'complite') {
        e.object.activity.render()
            .find('.full-start__background')
            .addClass('cardify__background')
    }
})
```

### Структурные изменения в шаблоне Cardify

- `.full-start-new__left` скрыт (`hide`) — постера нет
- `.full-start-new__right` разделён на:
  - `.cardify__left` (flex-grow:1) — title + details + buttons
  - `.cardify__right` (flex-shrink:0) — reactions + rate-line
- `.full-start-new__body` получает `height: 80vh`
- Добавляется `.cardify__background` на элемент фона (фиксированный фон на весь экран с градиентами)
- Фоновое изображение: 4 градиента по краям (top, bottom, left, right) по 70%

### CSS Cardify (ключевые правила)

```css
.cardify .full-start-new__body { height: 80vh; }
.cardify .full-start-new__right { display: flex; align-items: flex-end; }
.cardify__left { flex-grow: 1; }
.cardify__right { display: flex; align-items: center; flex-shrink: 0; }
.cardify__background { left: 0; }
.cardify__background.loaded:not(.dim) { opacity: 1; }
body:not(.menu--open) .cardify__background {
    background:
        linear-gradient(to top,  rgba(0,0,0,0.8), rgba(0,0,0,0) 70%),
        linear-gradient(to bottom, rgba(0,0,0,0.8), rgba(0,0,0,0) 70%),
        linear-gradient(to left,  rgba(0,0,0,0.8), rgba(0,0,0,0) 70%),
        linear-gradient(to right, rgba(0,0,0,0.8), rgba(0,0,0,0) 70%);
}
```

---

## 8. Версия Lampa

- `package.json version`: `"0.0.1"` — это версия npm-пакета (build-конфиг), не версия приложения
- Реальная версия приложения задаётся через Gulp-сборку и не хранится в package.json
- SHA дерева репозитория (текущий): `56be33eb7077e326f4e00529ba35fe0040489810`
- Стек: Gulp 4 + Rollup + SCSS + Babel (ES2015 target для Smart TV совместимости)

---

## Сводная шпаргалка для написания плагина

```js
(function() {
    'use strict';

    function init() {
        // 1. Заменить шаблон
        Lampa.Template.add('full_start_new', `<div class="full-start-new my-plugin">
            <div class="full-start-new__body">
                <!-- ваша разметка -->
                <div class="full-start-new__left">
                    <div class="full-start-new__poster">
                        <img class="full-start-new__img full--poster" />
                    </div>
                </div>
                <div class="full-start-new__right">
                    <div class="full-start-new__title">{title}</div>
                    <div class="full-start-new__rate-line">
                        <div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>
                        <div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>
                        <div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>
                        <div class="full-start__pg hide"></div>
                        <div class="full-start__status hide"></div>
                    </div>
                    <div class="full-start-new__details"></div>
                    <div class="full-start-new__buttons">
                        <div class="full-start__button selector button--play">
                            <svg><use xlink:href="#sprite-play"></use></svg>
                            <span>#{title_watch}</span>
                        </div>
                        <!-- остальные кнопки -->
                        <div class="full-start__button selector button--book">...</div>
                        <div class="full-start__button selector button--reaction">...</div>
                        <div class="full-start__button selector button--subscribe hide">...</div>
                        <div class="full-start__button selector button--options">...</div>
                    </div>
                </div>
            </div>
            <div class="hide buttons--container">
                <div class="full-start__button view--torrent hide">...</div>
                <div class="full-start__button selector view--trailer">...</div>
            </div>
        </div>`)

        // 2. Добавить CSS
        $('body').append('<style>.my-plugin { /* стили */ }</style>')

        // 3. Хук на события карточки
        Lampa.Listener.follow('full', function(e) {
            if (e.type == 'start') {
                // данные загружены, компоненты ещё не созданы
                let movie = e.data.movie
            }
            if (e.type == 'complite') {
                // DOM построен
                let movie = e.data.movie
                let body  = e.body

                // Прогресс просмотра
                let hash     = Lampa.Utils.hash(movie.original_title)
                let progress = Lampa.Timeline.view(hash)  // { percent, time, duration, ... }

                // Бэкдроп
                let bgUrl = movie.backdrop_path
                    ? Lampa.Api.img(movie.backdrop_path, 'w1280')
                    : ''

                // Доп. рейтинги (только при парсере)
                let imdb = movie.imdb_rating
                let kp   = movie.kp_rating

                // Актёры
                let cast = e.data.persons && e.data.persons.cast || []
            }
        })
    }

    // Безопасный старт
    if (window.appready) init()
    else Lampa.Listener.follow('app', function(e) {
        if (e.type == 'ready') init()
    })
})()
```

---

## Критические замечания

1. **`type: 'complite'`** — намеренная опечатка в исходниках (не 'complete'). Используйте именно её.
2. **rate--imdb / rate--kp** скрыты по умолчанию (`hide`). JS сам снимает hide при наличии данных. Если перерисовываете шаблон — сохраните эту логику.
3. **buttons--container** скрыт (`hide`) намеренно — это скрытый пул источников для select-меню при нажатии button--play. Он не должен быть виден.
4. **Controller.collectionSet** нужно вызывать каждый раз при toggle, не при init.
5. **imdb_rating / kp_rating** — отсутствуют при чистом TMDB без парсера. Всегда проверяйте перед использованием.
6. **Timeline.view** требует hash — строку, обработанную `Utils.hash()`. Для сериалов — другой алгоритм хэширования с учётом сезона/эпизода.

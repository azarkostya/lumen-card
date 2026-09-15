# Lampa API Notes 3 — Реакции, сериалы, timeline, activity-события, controller, модалки, плагины, ряды

**Источники**: raw.githubusercontent.com/yumata/lampa-source/main + живая Lampa 3.3.4 (localhost:8765, TMDB, без CUB-аккаунта)
**Дата исследования**: сентябрь 2026
**Изученные файлы**: `src/components/full/start/reactios.js`, `src/interaction/timeline.js`, `src/interaction/activity/activity.js`, `src/core/controller.js`, `src/interaction/modal.js`, `src/components/full/episodes.js`, `src/components/full.js`, `src/utils/utils.js`, `src/core/plugins.js`, `src/interaction/extensions/add.js`, `src/interaction/items/main/base.js`, `src/interaction/items/main/module/items.js`, `docs/ru/03-events.md`, `docs/ru/13-controller.md`, `nb557.github.io/plugins/online_mod.js`

---

## 1. Реакции CUB

**Файл**: `src/components/full/start/reactios.js` (row-компонент `start`, метод `onCreate`)

### Откуда берутся данные

Реакции — **не отдельный запрос**, а часть общего ответа `Api.full()`. Они приходят в `e.data.reactions` уже на событии `type:'start'` (проверено живьём — ключ `reactions` присутствует в `e.data` уже в первом событии `'start'`, до `'complite'`).

```js
this.data.reactions   // = e.data.reactions в контексте row-компонента 'start'
```

### Формат (проверено живьём на «Дюна: Часть вторая», tmdb id 693134, без аккаунта)

```json
{
  "secuses": true,
  "result": [
    {"card_id": "movie_693134", "type": "fire",  "counter": 5606, "modified_at": "2026-09-15T04:37:19.000Z"},
    {"card_id": "movie_693134", "type": "nice",  "counter": 1325, "modified_at": "2026-09-10T23:49:46.000Z"},
    {"card_id": "movie_693134", "type": "shit",  "counter": 895,  "modified_at": "2026-09-13T05:23:06.000Z"},
    {"card_id": "movie_693134", "type": "bore",  "counter": 610,  "modified_at": "2026-09-13T15:06:44.000Z"},
    {"card_id": "movie_693134", "type": "think", "counter": 548,  "modified_at": "2026-09-08T10:26:06.000Z"}
  ],
  "duration": 3.656270980834961
}
```

**Ответ на «сколько огня у Дюны без аккаунта»: 5606** (реакции CUB общие для всех, счётчик не зависит от логина — аккаунт нужен только чтобы голосовать через `Api.sources.cub.reactionsAdd`, само чтение доступно анонимно).

### Типы реакций (5 штук, фиксированный список в коде, не приходит с сервера)

```js
let items = [
    {type: 'fire'}, {type: 'nice'}, {type: 'think'}, {type: 'bore'}, {type: 'shit'}
]
```
Иконки: `Utils.protocol() + Manifest.cub_domain + '/img/reactions/' + type + '.svg'`.
Локализация названия: `Lang.translate('reactions_' + type)`.

### Рендер (сортировка по убыванию counter)

```js
reactions_data.result.sort((a,b)=> a.counter > b.counter ? -1 : a.counter < b.counter ? 1 : 0)
// count.text(Utils.bigNumberToShort(r.counter))  → "5.6K" и т.п.
```

### Голосование

```js
Api.sources.cub.reactionsAdd({
    method: this.card.name ? 'tv' : 'movie',   // 'tv' если сериал (по наличию .name), иначе 'movie'
    id: this.card.id,
    type: a.type                                // 'fire'|'nice'|'think'|'bore'|'shit'
}, onOk, onError)
```
Своя история голосов хранится локально: `Storage.get('mine_reactions', {})`, ключ `(card.name ? 'tv' : 'movie') + '_' + card.id'`, значение — массив уже отданных типов (используется, чтобы поставить класс `reaction--voted` и запретить повторное голосование за тот же тип: `noenter: vote(a.type)`).

Если `!Storage.field('card_interfice_reactions')` или `window.lampa_settings.disable_features.reactions` — блок реакций и кнопка `.button--reaction` полностью удаляются (`this.html.find('.full-start-new__reactions, .button--reaction').remove()`).

**Когда данные доступны относительно `complite`**: уже на `'start'` (реакции приходят вместе с основным батчем `Api.full`, отдельного запроса после `complite` нет).

---

## 2. Данные сериала (Фоллаут, tmdb id 106379, tv)

Всё проверено живьём — `Lampa.Activity.push({component:'full', id:106379, method:'tv', card:{id:106379, source:'tmdb'}, source:'tmdb'})`, событие `'full'` `type:'complite'`.

### e.data.episodes — структура

```js
e.data.episodes = {
    _id: ..., air_date: '2025-12-16', name: 'Сезон 2', networks: [...],
    overview: '...', id: 157235, poster_path: '/...', season_number: 2,
    vote_average: ..., url: '', source: 'tmdb',
    episodes: [ /* массив эпизодов ТОЛЬКО последнего сезона */ ]
}
```

**Какой сезон Lampa кладёт в `episodes`: последний из уже вышедших** (`seasons[data.episodes.seasons_count] || seasons[1]`, см. `src/components/full.js` строки 124–133). Для Фоллаута с 2 сезонами вернулась `Сезон 2` (`season_number: 2`), хотя в БД он ещё не полностью вышел (`status: 'Returning Series'`, `next_episode_to_air: null` — сезон уже полностью вышел на момент теста).

Сокращённый реальный элемент `episodes.episodes[]` (2 поля значимых для карточки, остальное — `crew`/`guest_stars`, обычно не нужны плагину):

```json
{
  "air_date": "2025-12-16",
  "episode_number": 1,
  "episode_type": "standard",
  "id": 6468112,
  "name": "Инноватор",
  "overview": "2077-ой год. Загадочный мужчина спорит с посетителями бара...",
  "production_code": "HNDO 201",
  "runtime": 63,
  "season_number": 2,
  "show_id": 106379,
  "still_path": "/sUOKyZaODDbkSlOH0lxdPygYh4A.jpg",
  "vote_average": 6.9,
  "vote_count": 104,
  "crew": [ /* массив, ~12 элементов на эпизод — job/department/name/profile_path */ ],
  "guest_stars": [ /* массив, до ~25 элементов — character/name/profile_path/order */ ],
  "original_name": "Fallout"
}
```

Важно: `original_name` **добавляется вручную** Lampa в `full.js` (строка ~145: `cameout.forEach(episode => episode.original_name = data.movie.original_name || data.movie.name)`) — в сыром ответе TMDB его нет на уровне эпизода, это инъекция специально для хэширования таймлайна (см. раздел 3).

`data.episodes.episodes` в `e.data` (который приходит из `Api.full`) — это ещё НЕотфильтрованный список; фильтрация на «уже вышедшие / +1 будущий» и добавление `original_name` происходит в `full.js` при формировании `this.rows.push(['episodes', {...}])`, а НЕ в самом `e.data.episodes.episodes`. То есть если плагин слушает `'full'` и берёт `e.data.episodes.episodes` напрямую — там **все** эпизоды сезона (включая ещё не вышедшие), без поля `original_name`, без деления на `cameout`/`comeing`.

### e.data.movie — поля сериала (проверено живьём)

```json
{
  "name": "Фоллаут",
  "status": "Returning Series",
  "number_of_seasons": 2,
  "next_episode_to_air": null,
  "last_episode_to_air": {
    "id": 6468145, "name": "Стрип", "overview": "...",
    "vote_average": 7.8, "vote_count": 72, "air_date": "2026-02-03",
    "episode_number": 8, "episode_type": "finale", "production_code": "HNDO 208",
    "runtime": 57, "season_number": 2, "show_id": 106379,
    "still_path": "/43IgeZ32BT6fYCMLoQTqrYg0xKd.jpg"
  },
  "networks": [
    {"id": 1024, "logo_path": "/w7HfLNm9CWwRmAMU58udl2L7We7.png", "name": "Prime Video", "origin_country": ""}
  ],
  "created_by": [
    {"id": 1807680, "credit_id": "636d3c8d8138310080844843", "name": "Грэм Вагнер",
     "original_name": "Graham Wagner", "gender": 2, "profile_path": "/5mQ8bOEe8z0rhNgATRgjS9NtjLI.jpg"},
    {"id": 1612453, "name": "Женева Робертсон-Дуорет", "original_name": "Geneva Robertson-Dworet", ...}
  ],
  "seasons": [
    {"air_date": "2024-03-24", "episode_count": 24, "id": 391707, "name": "Спецматериалы",
     "overview": "", "poster_path": "/y7TMQf9rsHU4RcPkL5HUxio3Pry.jpg", "season_number": 0, "vote_average": 0},
    {"air_date": "2024-04-10", "episode_count": 8, "id": 157128, "name": "Сезон 1",
     "overview": "Через 200 лет после апокалипсиса...", "poster_path": "/bUm4yXs07YeeFZMkOOSkuXuzAVA.jpg",
     "season_number": 1, "vote_average": 7.7}
  ]
}
```
`movie.networks[0].name` = `"Prime Video"`, `movie.created_by[0].name` = `"Грэм Вагнер"` — оба поля подтверждены живьём, ровно как в стандартном TMDB API `/tv/{id}?append_to_response=...`.

---

## 3. Хэш серии/фильма и Timeline API

**Файл**: `src/utils/utils.js`, функция `hash()` (строка 586), используется как `Lampa.Utils.hash(...)`.

### Точная формула хэша (djb2-подобный, 32-битный, всегда положительный)

```js
function hash(input){
    let str  = (input || '') + ''
    let hash = 0
    if (str.length == 0) return hash
    for (let i = 0; i < str.length; i++) {
        let char = str.charCodeAt(i)
        hash = ((hash<<5) - hash) + char
        hash = hash & hash            // привести к 32-битному int
    }
    return Math.abs(hash) + ''        // возвращает СТРОКУ
}
```

### Формула для фильма

```js
Lampa.Utils.hash(movie.original_title)
```
Проверено живьём: `Lampa.Utils.hash('Dune: Part Two')` → `"958532077"`.

### Формула для эпизода сериала

Источник: `src/interaction/timeline.js`, функция `watchedEpisode()` (строка 224), и подтверждено grep'ом по `online_mod.js` (десятки одинаковых вхождений):

```js
Lampa.Utils.hash([season, season > 10 ? ':' : '', episode, card.original_name || card.original_title].join(''))
```

Разделитель `':'` вставляется ТОЛЬКО если сезон > 10 (чтобы отличить сезон 1 эпизод 23 от сезона 12 эпизод 3 — без разделителя оба дали бы строку "123..."). Для сезона ≤10 сезон и эпизод просто склеиваются без разделителя.

Проверено живьём для S2E3 сериала «Fallout» (`original_name`):
```js
Lampa.Utils.hash([2, '', 3, 'Fallout'].join(''))   // строка на входе: "23Fallout"
// → "908552078"
```

### Timeline API — сигнатуры (файл `src/interaction/timeline.js`)

```js
// Обновить прогресс просмотра
Lampa.Timeline.update({
    hash: string,        // обязателен, hash == 0 — игнорируется
    percent: number,      // 0–100
    time: number,          // опционально, секунды текущей позиции
    duration: number,      // опционально, секунды общей длительности
    profile: number,       // опционально, id профиля (для sync)
    updated: number,       // опционально, timestamp мс; если params.received не true — ставится Date.now() автоматически
    received: boolean      // true — данные пришли с сервера/другого устройства, updated не перезаписывается
})

// Получить прогресс просмотра
Lampa.Timeline.view(hash) 
// → { hash, percent, time, duration, profile, updated, handler(percent,time,duration) }
// handler — готовая функция для вызова update с тем же hash/profile

// Проверить просмотр фильма/сериала (агрегированно)
Lampa.Timeline.watched(card, return_time = false)
// card.original_name задан (сериал) → перебирает эпизоды 1..24 сезона 1 (!) и считает watched.percent>0
//   → number (кол-во просмотренных) или, если return_time=true, [{ep, view}]
// card.original_name НЕ задан (фильм) → view(hash(card.original_title)).percent, либо весь объект view() при return_time=true
// ВАЖНО: watched() для сериала жёстко перебирает season=1 episode=1..24 — это НЕ универсальная проверка по всем сезонам!

Lampa.Timeline.watchedEpisode(card, season, episode, return_time=false)
// → view(hash([season, season>10?':':'', episode, card.original_name||card.original_title].join(''))).percent
// (или весь объект view(), если return_time=true) — правильная функция для конкретного season/episode
```

### Проверка живьём (Timeline.update → Timeline.view round-trip)

```js
let hMovie = Lampa.Utils.hash('Dune: Part Two')                         // "958532077"
Lampa.Timeline.update({hash: hMovie, percent: 43, time: 4320, duration: 9960})
Lampa.Timeline.view(hMovie)
// → {hash:"958532077", percent:43, time:4320, duration:9960, profile:0, updated:1789468703239, handler: fn}

let hEp = Lampa.Utils.hash([2, '', 3, 'Fallout'].join(''))              // "908552078"
Lampa.Timeline.update({hash: hEp, percent: 77, time: 2500, duration: 3300})
Lampa.Timeline.view(hEp)
// → {hash:"908552078", percent:77, time:2500, duration:3300, profile:0, updated:1789468703240, handler: fn}
```
Оба round-trip прошли 1-в-1 — хэш и Timeline работают в точности как описано.

Хранилище: `localStorage` под ключом `'file_view'` (или `'file_view_' + profile.id` при активном sync-профиле), см. `filename()` в timeline.js.

---

## 4. События активности при закрытии карточки

**Файл**: `src/interaction/activity/activity.js`. Все события шлются через `Lampa.Listener.send('activity', {component, type, object})`.

### Все типы, которые реально отправляются (grep по `Listener.send('activity'`)

| type | где отправляется | когда |
|---|---|---|
| `'init'` | `create()` (строка 343) | сразу после создания компонента, до `.create()` компонента |
| `'create'` | `create()` (строка 347) | после `object.activity.create()` |
| `'start'` | `start()` (строка 504) | активность стала активной (видимой, `.activity--active`) |
| `'archive'` | `backward()` (строка 444) | активность возвращается в фокус после `backward()` (родительская, на которую вернулись) |
| `'destroy'` | `backward()` (строка 428), `limit()` (строка 261), `replace()` (строка 619) | активность уничтожается — из-за возврата назад, лимита сохранённых страниц (`pages_save_total`) или `Activity.replace()` |

Поля объекта события: `{component: string, type: string, object: {component, activity, ...}}` — `object` это сам элемент из внутреннего стека `activites[]` (тот же объект, что передавался в `Activity.push()`), НЕ jQuery.

### Проверено живьём: открыть full → `Activity.backward()`

Открыли «Дюна» (full поверх «Фоллаут», который был открыт раньше), затем `Lampa.Activity.backward()`:

```json
[
  {"type": "start",   "component": "full"},   
  {"type": "archive", "component": "full"},   
  {"type": "destroy", "component": "full"}    
]
```
Комментарии к событиям: `start`/`archive` — для «Дюны» (предыдущая активность, на которую вернулись — тот же компонент, синхронно). `destroy` — для «Фоллаута» (активность, которую покинули), приходит с задержкой ~200мс (`setTimeout`).

Порядок: `start`+`archive` — синхронно (для активности, на которую вернулись), `destroy` — через `setTimeout(...,200)` (для активности, которую покидаем). **`destroy` — то самое событие для перехвата ухода с карточки full**, но оно приходит для ЛЮБОГО компонента, поэтому в обработчике нужно проверять `e.component == 'full'` (а лучше сверять `e.object === (сохранённая ссылка на свою активность)`, т.к. `component` не уникален при множественных открытых full-карточках в стеке).

```js
Lampa.Listener.follow('activity', function(e){
    if (e.type == 'destroy' && e.component == 'full') {
        // пользователь ушёл с конкретной карточки — e.object содержит { component, id, method, card, ... }
    }
})
```

Также см. `docs/ru/03-events.md` (тот же список типов подтверждён официальной документацией репозитория).

---

## 5. Определение смены контроллера (фокус ушёл из full_start)

**Файл**: `src/core/controller.js`. Переключение — `Controller.toggle(name)` (строка 129), которое в конце всегда шлёт:

```js
listener.send('toggle', {name: name})
```

### Подписка на смену контроллера

```js
Lampa.Controller.listener.follow('toggle', function(e){
    // e.name — имя нового активного контроллера
})

// Синхронно узнать текущий:
Lampa.Controller.enabled()   // → { name: string, controller: object }
Lampa.Controller.enabled().name
```

### Проверено живьём: цепочка контроллеров при спуске по карточке «Дюна»

| Состояние | `Controller.enabled().name` |
|---|---|
| Карточка только открыта, фокус на кнопках | `full_start` |
| `вниз` — фокус ушёл в блок описания | `full_descr` |
| `вниз` ещё раз — фокус ушёл в первый ряд (Line: комментарии/эпизоды/карточки) | `items_line` |

Это подтверждает, что для «компактного режима, когда фокус ниже кнопок» достаточно проверять `Controller.enabled().name !== 'full_start'` (или слушать `toggle` и сравнивать `e.name`). Названия остальных под-контроллеров строки-компонентов (`persons`, `cards`, `discuss`, `episodes`) на практике сводятся к одному и тому же имени `items_line` — потому что все они построены через общий модуль `Line` (`src/interaction/items/line/line.js`), который регистрирует контроллер с фиксированным именем `'items_line'`, а не именем строки. Значит по одному только имени контроллера нельзя определить, в каком именно ряду фокус — нужно дополнительно смотреть `Controller.enabled().controller.link` (ссылка на экземпляр компонента строки) или ловить `hover:focus` на элементах.

Ключ `gone` в объекте, переданном в `Controller.add()`, вызывается у ПРЕДЫДУЩЕГО активного контроллера, когда фокус его теряет (`if(active && active.gone) active.gone(name)` — строка 130 controller.js), — альтернативный способ узнать об уходе фокуса именно из своего контроллера, без глобальной подписки на `toggle`.

---

## 6. Модалки

**Файл**: `src/interaction/modal.js`.

### Сигнатура `Lampa.Modal.open(params)`

```js
Lampa.Modal.open({
    title: string,                  // заголовок; пусто → добавляется класс modal--empty-title
    html: jQuery|HTMLElement,       // содержимое (например, jQuery-набор с .selector-элементами)
    size: 'small'|'medium'|'large'|'full',   // по умолчанию поведение как 'small' (buttons-column)
    overlay: boolean,               // класс modal--overlay
    align: 'top'|'center',          // align:'center' → modal--align-center
    mask: boolean,                  // маска скролла (передаётся в new Scroll({mask}))
    buttons: [{name: string, onSelect: fn}],   // кнопки внизу
    buttons_position: 'inside'|'outside',      // где рендерить кнопки
    select: HTMLElement|jQuery,     // на что поставить фокус при открытии (иначе — первый .selector)
    onBack: function,               // вызывается когда пользователь нажал "назад" в модалке (Controller back)
    onSelect: function($target),    // вызывается по hover:enter на любом .selector внутри html
    zIndex: number
})

Lampa.Modal.close()                 // удаляет html модалки из DOM, сбрасывает opened=false
                                     // (НЕ восстанавливает предыдущий Controller — это забота вызывающего кода!)
Lampa.Modal.update(new_html)        // заменить содержимое без пересоздания модалки
Lampa.Modal.opened()                // → boolean, открыта ли модалка сейчас
```

### Механизм контроллера модалки

`Modal.open()` регистрирует контроллер с именем `'modal'` и сразу же `Controller.toggle('modal')` (строка 223 modal.js) — то есть пока модалка открыта, `Controller.enabled().name === 'modal'` (подтверждено живьём). Модалка **не хранит и не восстанавливает** предыдущий активный контроллер сама — это обязанность вызывающего кода в `onBack`.

### Как вернуть фокус в карточку после закрытия — проверено живьём

```js
let before = Lampa.Controller.enabled().name;   // например, 'full_start'

Lampa.Modal.open({
    title: 'Заголовок',
    html: $('<div class="selector">Пункт 1</div>'),
    size: 'medium',
    onBack: function(){
        Lampa.Modal.close()
        Lampa.Controller.toggle(before)          // вручную вернуть фокус туда, где был
    }
})
```
Результат живого теста: `before` = `'full_start'`, во время открытой модалки `Controller.enabled().name` = `'modal'`, после `onBack` (эмуляция кнопки «назад», keyCode 8) → `Controller.enabled().name` снова `'full_start'`, `Modal.opened()` = `false`.

**Какой контроллер активен у блока описания/рядов**: `full_descr` — у блока описания (см. раздел 5), `items_line` — у любого ряда (persons/cards/discuss/episodes). Соответственно, если модалка открыта из описания или ряда карточки, в `onBack` нужно восстанавливать именно `'full_descr'` или `'items_line'`, а не всегда `'full_start'` — то есть всегда захватывать `Controller.enabled().name` непосредственно ПЕРЕД `Modal.open()`, как в примере выше, а не хардкодить имя.

Сам `reactios.js` (раздел 1) вместо сохранения `before` жёстко переключает после выбора реакции на `Controller.toggle('content')` — это НЕ универсальный паттерн, а особенность конкретно того компонента (реакции выбираются через `Select.show`, а не `Modal.open`; `Select` — отдельный модуль с похожим, но не идентичным API).

---

## 7. Загрузка скриптов плагинов

**Файл**: `src/utils/utils.js` (строки 391–441), **файл**: `src/core/plugins.js` (весь механизм подключения расширений).

### Сигнатура `Lampa.Utils.putScriptAsync`

```js
Lampa.Utils.putScriptAsync(items, complite, error, success, show_logs)
// items      — array<string> URL-ов скриптов, ВСЕ грузятся ПАРАЛЛЕЛЬНО (в отличие от putScript — та грузит последовательно)
// complite   — fn(), вызывается один раз когда ВСЕ items завершили загрузку (успешно или с ошибкой)
// error      — fn(url), вызывается для каждого скрипта, упавшего с ошибкой ИЛИ не загрузившегося за 60 секунд (таймаут)
// success    — fn(url), вызывается для каждого успешно загруженного скрипта
// show_logs  — boolean, по умолчанию true — логировать в консоль (Script: create/include/error)
```
Реализация: для каждого `url` создаётся `<script async src=url>`, добавляется в `document.body`; хук `cub.watch` → `Manifest.cub_domain` подменяется прямо в URL перед вставкой. Есть отдельный `setTimeout(60000)`, который сам вызывает `s.onerror()`, если скрипт не отдал ни `onload`, ни `onerror` за минуту.

Также есть `Lampa.Utils.putScriptOfMirrors(items, complite, error, success, show_logs)` — то же самое, но для URL-ов, совпадающих с одним из `Manifest.cub_mirrors`, при ошибке автоматически пробует другое зеркало.

### Откуда Lampa берёт список плагинов для загрузки — `src/core/plugins.js`

1. **Хранилище**: `Lampa.Storage.get('plugins', '[]')` — массив объектов `{url: string, status: 0|1}` (или просто строка URL — приводится к объекту в `modify()`). Управляется через UI: Настройки → Расширения (`Extensions.show()`, см. `src/interaction/extensions/*`).
2. **Добавление плагина пользователем** — `src/interaction/extensions/add.js`, класс `Add`: клик по «+» → (если ещё не согласился с правилами — показывает `Modal.open` с чекбоксом правил) → `Input.edit({title: 'extensions_set_url', ...}, url => this.onAdd(url))` — то есть **обычное текстовое поле ввода URL**, без выбора файла.
3. **Загрузка при старте приложения** (`task()` → `load()` в plugins.js):
   - `modify()` нормализует сохранённые записи (строка → `{url, status:1}`, подмена доменов `cub.watch`→`Manifest.cub_domain`, `bwa.to`→`bwa.ad`).
   - Список объединяется: свои плагины из `Storage` + плагины аккаунта CUB (`Account.Api.plugins(...)`) + всегда добавляется `'./plugins/modification.js'`.
   - Применяется блэклист (запрос к `cub_domain/api/plugins/blacklist` + локальный `./plugins_black_list.json` + хардкод — `lipp.xyz`, `bylampa.github.io`, `t.me/`, `4pda.` и т.д.).
   - Каждый URL прогоняется через `addPluginParams(url)`, который дописывает GET-параметры: `email=` (Base64, если юзер залогинен), `logged=true/false`, `reset=<random>` (анти-кэш), `origin=<base64(host)>`; также подставляет `{storage_KEY}` → Base64 значения `localStorage.getItem(KEY)`.
   - Итоговый список грузится одним вызовом `Utils.putScriptAsync(include, complite, onError, onSuccess, false)`.
   - При ошибке загрузки скрипт также пытаются взять из локального кэша (`Cache.getData('plugins', name)` → вставить как inline `<script>`), а при успехе — закэшировать (`updatePluginDB` → `Cache.rewriteData`).

**Для README про установку плагина пользователю нужно знать только**: Настройки → Расширения → «+» → вставить URL `.js`-файла плагина → согласиться с предупреждением об установке (один раз, флаг `Storage.set('agree_installation', true)`) → Lampa сама подгрузит через `putScriptAsync` при следующей загрузке приложения (или сразу через `push()` — немедленную загрузку при добавлении, `Plugins.push(plug)` в `add()`).

---

## 8. Добавление своего ряда под описанием (проверено живьём — работает!)

**Файл**: `src/components/full.js`. Ряды карточки хранятся в `this.rows` — обычном JS-массиве вида `[componentName, data]`, который строится ВНУТРИ callback'а `Api.full(...)` синхронно, ДО события `'full'` `type:'complite'`, но `this.rows` УЖЕ существует (как `['start','description']`) в момент события `type:'start'`.

### Ключевое ограничение: имена компонентов — закрытый список

```js
// src/components/full.js, строка 26 — приватная переменная модуля, НЕ экспортируется наружу
let components = {
    start: Start, description: Description, metadata_chart: MetadataChart,
    metadata_tags: MetadataTags, persons: Persons, cards: Cards,
    discuss: Discuss, episodes: Episodes
}
```
Т.к. `components` — замыкание модуля `full.js`, а не свойство на `Lampa.*`, плагин **не может зарегистрировать полностью новый тип ряда** (вызов `new components['my_row'](data)` упадёт, `components['my_row']` будет `undefined`). Единственный рабочий путь — переиспользовать один из 8 существующих типов со своими данными.

### Рабочий паттерн (проверено живьём: реальный тестовый ряд карточек добавлен без ошибок)

```js
Lampa.Listener.follow('full', function(e){
    if (e.type == 'start') {
        // e.link — экземпляр компонента карточки, e.link.rows — тот самый this.rows
        e.link.rows.push(['cards', {
            results: [ /* массив карточек в формате TMDB (id, poster_path, title, vote_average, ...) */ ],
            title: 'Мой ряд отзывов'
        }])
        // Для текстовых отзывов лучше подходит тип 'discuss' (переиспользует UI комментариев):
        // e.link.rows.push(['discuss', { results: [...], title: '...', movie: e.data.movie }])
    }
})
```

### Проверено живьём на карточке «Интерстеллар» (id 157336)

```js
comp.rows.map(r => r[0] + ' | ' + (r[1].title||''))
// -> [
//   "start",
//   "description",
//   "discuss | Комментарии",
//   "cards | ТЕСТ РЯД ОТЗЫВОВ",     <- мой ряд, встал на 4-е место
//   "metadata_chart",
//   "metadata_tags",
//   "persons | Режиссер",
//   "persons | Актеры",
//   "cards | Рекомендации",
//   "cards | Похожие"
// ]
comp.items.length   // -> 3   (построены только первые 3: start, description, discuss)
```

**Важные детали по позиции ряда**:
- Мой `push` на событии `'start'` добавил ряд ПОСЛЕ `['start','description']` (на индекс 2), но встроенный код Lampa сразу следом вставляет `discuss` через `Arrays.insert(this.rows, 2, [...])` — то есть **жёстко на индекс 2**, что сдвигает мой ряд на индекс 3. Порядок ряда, добавленного плагином, не гарантирован — зависит от гонки с внутренней логикой `full.js` (`discuss` всегда лезет на индекс 2 или в конец, если пусто).
- `this.view = 3` — при первой отрисовке строится **только первые 3 ряда** (`this.build(this.rows.slice(0, this.view))`). Остальные (включая ряд плагина, если он оказался на 4+ позиции) достраиваются лениво через `onScroll` по мере навигации вниз (`this.active` увеличивается при переходе фокуса между рядами — `size = Math.min(this.active + this.view, this.rows.length)`), см. `src/interaction/items/main/module/items.js`, `onDown`/`onUp`.
- Чтобы ряд плагина гарантированно попал в первую тройку — либо добавлять его САМЫМ первым (до вызова остальной логики, т.е. сразу на `'start'`, что мы и сделали — но `discuss` всё равно обгоняет через `Arrays.insert` с фиксированным индексом), либо явно переставить его в `e.link.rows` уже на `'complite'` (когда все встроенные ряды точно сформированы) через `Arrays.move`/`splice`, и при необходимости заново вызвать построение — но пересборка уже отрендеренных `this.items` нетривиальна и в проверке не выполнялась.
- Готового примера такого ряда в бандловых `plugins/*` репозитория **не найдено** (проверено: grep `rows.push` / `type == 'build'` по `plugins/shots/shots.js` и по всем именам плагинов `collections/dlna/etor/halloween/iptv/online/online_prestige/radio/record/shots/snow/tmdb_proxy/tracks/twolines/view_plugin/womens-day` — ни один встроенный плагин репозитория не добавляет ряд в full-карточку через `e.link.rows`). Техника выше выведена из чтения `src/components/full.js` и подтверждена собственным живым тестом, а не скопирована из существующего примера.

---

## Сводная шпаргалка (только новое из этого файла)

```js
// 1. РЕАКЦИИ - доступны уже на type:'start', без отдельного запроса
Lampa.Listener.follow('full', e => {
    if (e.type == 'start' && e.data.reactions) {
        let sorted = e.data.reactions.result.slice().sort((a,b)=>b.counter-a.counter)
        // [{type:'fire', counter:5606, card_id:'movie_693134', modified_at:'...'}, ...]
    }
})

// 3. ХЭШ + TIMELINE
let movieHash   = Lampa.Utils.hash(movie.original_title)
let episodeHash = Lampa.Utils.hash([season, season>10?':':'', episode, movie.original_name || movie.original_title].join(''))
Lampa.Timeline.update({hash: episodeHash, percent: 77, time: 2500, duration: 3300})
let progress = Lampa.Timeline.view(episodeHash)   // {hash,percent,time,duration,profile,updated,handler}
```

```js
// 4. УХОД С КАРТОЧКИ
Lampa.Listener.follow('activity', e => {
    if (e.type == 'destroy' && e.component == 'full') { /* карточка закрыта */ }
})

// 5. СМЕНА ФОКУСА С КНОПОК
Lampa.Controller.listener.follow('toggle', e => {
    let compact = e.name !== 'full_start'   // true когда фокус ушёл ниже кнопок (full_descr / items_line / modal)
})

// 6. МОДАЛКА С ВОЗВРАТОМ ФОКУСА
let before = Lampa.Controller.enabled().name
Lampa.Modal.open({ title:'...', html:$('<div class="selector">...</div>'), onBack(){
    Lampa.Modal.close()
    Lampa.Controller.toggle(before)
}})

// 7. ПОДКЛЮЧЕНИЕ СВОЕГО ПЛАГИНА (для README)
// Настройки -> Расширения -> "+" -> вставить URL .js файла -> согласиться с предупреждением
// (внутри Lampa грузит через Lampa.Utils.putScriptAsync([url], onAllDone, onError, onEachSuccess, false))

// 8. СВОЙ РЯД ПОД ОПИСАНИЕМ (переиспользуя встроенный тип 'cards' или 'discuss')
Lampa.Listener.follow('full', e => {
    if (e.type == 'start') e.link.rows.push(['cards', { results: [/*...*/], title: 'Мой ряд' }])
})
```

---

## Критические замечания

1. **Реакции читаются анонимно** — счётчики видны без аккаунта, голосование (`reactionsAdd`) требует CUB-аккаунт (без него запрос скорее всего вернёт ошибку — не проверялось живьём, т.к. аккаунт не настроен).
2. **`e.data.episodes.episodes`** — это эпизоды ПОСЛЕДНЕГО вышедшего сезона целиком, БЕЗ поля `original_name` и без деления на «вышедшие/анонс» — эта обработка происходит только внутри `full.js` при формировании `this.rows`, не в сырых данных события.
3. **`Timeline.watched(card)`** для сериала — не универсальная проверка: жёстко перебирает `season=1, episode=1..24`. Для конкретного сезона/эпизода использовать `Timeline.watchedEpisode(card, season, episode)`.
4. **`hash()` возвращает строку**, не число — важно при сравнении (`===` со строкой, не с числом).
5. **`activity` событие `destroy`** приходит НЕ только при явном закрытии карточки пользователем, но и при вытеснении из истории по лимиту `pages_save_total` (`limit()`) — если нужно различать, сверяйте `e.object` с сохранённой ссылкой на свою активность, а не полагайтесь только на `component == 'full'`.
6. **Имя контроллера НЕ идентифицирует конкретный ряд** — все ряды-Line (persons/cards/discuss/episodes) используют одно и то же имя `'items_line'`. Для различения нужен `Controller.enabled().controller.link` или собственные метки на DOM/данных ряда.
7. **`Modal.close()` не восстанавливает фокус** — контроллер, который был активен до открытия модалки, нужно сохранять и восстанавливать вручную в `onBack`.
8. **Плагин не может создать принципиально новый тип ряда** карточки (`components` — приватное замыкание в `full.js`) — только переиспользовать `start/description/metadata_chart/metadata_tags/persons/cards/discuss/episodes` со своими данными; порядок ряда, добавленного через `e.link.rows.push()` на `'start'`, может быть сдвинут встроенной логикой (`discuss` вставляется на фиксированный индекс 2 через `Arrays.insert`).

# Lumen Card — план реализации плагина карточки для Lampa

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Бесплатный плагин `lumen_card.js` для Lampa (Android TV / Smart TV), который перерисовывает карточку фильма/сериала лучше платного Cardify: слайдшоу кадров, фоновый трейлер с YouTube, анимации в духе Apple TV, единый набор иконок, русские отзывы с Кинопоиска — при этом не трогает источники, TorrServer, плеер и навигацию пультом.

**Architecture:** Один итоговый файл (строгий ES5, IIFE) собирается из модулей `src/*.js` простым конкатенатором на Node. Чистая логика (выбор кадров, выбор трейлера, нормализация отзывов, форматирование) живёт в модулях без DOM и тестируется `node --test`. Рантайм-часть подменяет шаблон `full_start_new` через `Lampa.Template.add`, дорисовывает блоки в событии `Lampa.Listener 'full'` (`type == 'complite'`) и подключает CSS одним `<style>`. Проверка — стенд `harness/` плюс инжект в настоящую Lampa 3.3.1 на `https://cf.lampa.mx` через браузерную панель.

**Tech Stack:** ES5 JavaScript + jQuery (есть в Lampa), CSS с custom properties, Node 24 (`C:\Users\azark\AppData\Local\Programs\nodejs\node.exe`) для сборки и тестов, Python 3.12 embeddable (`C:\Users\azark\AppData\Local\Programs\Python\Python312\python.exe`) для `http.server`, YouTube IFrame API, Kinopoisk Unofficial API (ключ пользователя).

---

## 0. Контекст, который нужно знать до начала

### 0.1 Что уже сделано (не переделывать)

| Артефакт | Где | Статус |
|---|---|---|
| Ресёрч API Lampa (шаблон, SCSS, события, данные, навигация, Cardify) | `C:\Users\azark\AppData\Local\Temp\lampa\API_NOTES.md` | готов, читать первым |
| Ресёрч №2 (кадры/бэкдропы, трейлеры, `Lampa.Reguest`, CORS отзывов, иконки) | `C:\Users\azark\AppData\Local\Temp\lampa\API_NOTES_2.md` | готов, читать вторым (ключевые факты продублированы в 0.2) |
| Дизайн-канвас (Claude Design) | https://claude.ai/artifact/UB9wLYpMR7TvLbaux6KAmk ; исходники артбордов `C:\Users\azark\AppData\Local\Temp\claude\C--Users-azark------------\09155d57-6cfc-4e6b-b3f6-db5fab93f381\scratchpad\lumen-design\*.dc.html` | готов |
| HTML-мокап карточки | https://claude.ai/artifact/Ea8RynwbThUA7iuUtCLSDm | готов |
| Плагин v1 (карточка без слайдшоу/трейлера/отзывов) + стенд `harness/` + README | `C:\Users\azark\Новая папка\lumen-card\lumen_card.js`, `harness/index.html`, `README.md` | пишется фоновым executor'ом. Task 1 = приёмка |

### 0.2 Факты об API Lampa (проверены на исходниках и на живой cf.lampa.mx 3.3.1)

- Шаблон карточки: `Lampa.Template.get('full_start_new', {}, true)` → строка HTML. Подмена: `Lampa.Template.add('full_start_new', html)`. Полный оригинал шаблона лежит в API_NOTES.md §1 — новый шаблон обязан сохранить все классы, к которым обращается `start.js`: `.full-start-new__title`, `__head`, `.full--tagline`, `__details`, `__reactions`, `__buttons`, `.buttons--container` (`.button--play`, `.button--book`, `.button--reaction`, `.button--subscribe`, `.button--options`, `.view--torrent`, `.view--trailer` и остальные из оригинала), `.rate--tmdb/.rate--imdb/.rate--kp` с вложенными `div`, `.tag--year/.tag--time/.tag--quality/.tag--episode`, `.full-start__pg`, `.full-start__status`, `.is--serial`, `img.full--poster` внутри `.full-start-new__poster`, все `#{lang_key}`.
- Событие карточки: `Lampa.Listener.follow('full', function(e){})`. `e.type`: `'start'` (данные есть, DOM нет), `'complite'` (DOM построен — именно так, с опечаткой), `'build'` (на каждый под-компонент, есть `e.name`). Поля: `e.data.movie` (объект TMDB), `e.data.persons` (`cast[]`, `crew[]`), `e.data.episodes` (для сериалов), `e.body` (jQuery узел активности), `e.object` (объект активности, `e.object.activity.render()`).
- В `e.data.movie` реально есть: `images.backdrops[]` (у «Дюны» 136 шт., поля `file_path, iso_639_1, vote_average, width, height`), `images.logos[]`, `images.posters[]`, `external_ids` (`imdb_id`), `imdb_id`, `vote_average`, `release_quality`/`quality` (только фильмы), `status`, `genres[]`, `production_countries`, `runtime`, `tagline`, `overview`, `backdrop_path`, `poster_path`. `videos` в самом объекте movie НЕТ — см. API_NOTES_2 §2, откуда trailers.js берёт ролики.
- Рейтинги IMDb/КП: `movie.imdb_rating`, `movie.kp_rating` появляются только с CUB-аккаунтом или парсер-сервером. Показывать только если число > 0.
- Картинки: `Lampa.TMDB.image('t/p/w1280' + file_path)` → URL с учётом TMDB-прокси пользователя (это то, что использует сама Lampa); запасной вариант `Lampa.Api.img(path, 'w1280')`. Плагин никогда не собирает `image.tmdb.org` руками. Список `images.backdrops[]` приходит в `full()` через `append_to_response=…,images`.
- Трейлеры: `e.data.videos.results[]` — отдельный запрос Lampa к `/videos`; поля элемента `{key, name, official, published_at, iso_639_1, url, youtube, icon}` — полей `site` и `type` НЕТ. Штатная кнопка «Трейлеры»: на Android с `player_launch_trailers == 'youtube'` → `Lampa.Android.openYoutube(key)`, иначе `Lampa.Player.play(item)`; есть `Lampa.YouTube.play(id)` (iframe API, молча не работает без `YT`). Штатное поведение не трогаем.
- Сеть: `new Lampa.Reguest().silent(url, ok, err, false, {headers:{'X-API-KEY': key}, dataType:'json', timeout: 8000})` — `headers` пробрасываются в `$.ajax`. CORS: `kinopoiskapiunofficial.tech` отвечает `Access-Control-Allow-Origin: *` и разрешает `x-api-key` (проверено OPTIONS-запросом) — прокси не нужен. `api.kinopoisk.dev` редиректит на `api.poiskkino.dev`, тоже `*`.
- Иконки Lampa: кнопки карточки используют спрайты `<svg><use xlink:href="#sprite-play">` с разными viewBox (play 0 0 28 29, torrent 0 0 47 47, trailer 0 0 80 70) и инлайн-svg (book, subscribe). Замена «удалить svg внутри кнопки, вставить свой» работает для обоих случаев.
- Прогресс: `Lampa.Timeline.view(hash)` → `{percent, time, duration}`; хэш фильма `Lampa.Utils.hash(movie.original_title)`; хэш серии — формула из online_mod (`grep -n "Utils.hash(\[" C:\Users\azark\AppData\Local\Temp\lampa\tmp.js`), ожидаемо `Lampa.Utils.hash([season, season > 10 ? ':' : '', episode, movie.original_name].join(''))`. Проверить grep'ом до реализации Task 8.
- Навигация: любой элемент с классом `.selector` попадает в пул; фокус = CSS-класс `.focus`; события `hover:focus`, `hover:enter`, `hover:long`. Контроллер карточки `full_start` собирает `.selector` через `Controller.collectionSet(html)`. Кнопка `.button--play` при `hover:enter` открывает `Lampa.Select` со списком источников из `.buttons--container` — это и есть путь к TorrServer/торрентам; его не трогаем.
- Настройки: `Lampa.SettingsApi.addComponent({component:'lumen_card', name:'Lumen Card', icon:'<svg…>'})`, `Lampa.SettingsApi.addParam({component:'lumen_card', param:{name:'lumen_accent', type:'select', values:{sand:'Песок',…}, default:'sand'}, field:{name:'Акцент', description:'…'}, onChange:function(v){}})`. Значения читаются `Lampa.Storage.field('lumen_accent')` (field применяет default) или `Lampa.Storage.get(name, def)`.
- Платформа: `Lampa.Platform.screen('tv')`, `Lampa.Platform.is('android')`, `Lampa.Platform.is('tizen')`, `Lampa.Platform.is('webos')`, `Lampa.Platform.is('browser')`.
- Уведомления: `Lampa.Noty.show('текст')`. Модал: `Lampa.Modal.open({title, html: $('<div>…</div>'), size:'medium', onBack:function(){ Lampa.Modal.close(); Lampa.Controller.toggle('full_start') }})`.
- Старт плагина: `if(window.appready) init(); else Lampa.Listener.follow('app', function(e){ if(e.type=='ready') init() })`.

Проверено живьём в Lampa 3.3.4 (подробности `C:\Users\azark\AppData\Local\Temp\lampa\API_NOTES_3.md`):
- **Реакции CUB** читаются без аккаунта: `e.data.reactions.result[]` = `{type:'fire'|'nice'|'think'|'bore'|'shit', counter}`, доступны уже на `type:'start'`. У «Дюны» `fire` = 5606. Короткая запись числа: `Lampa.Utils.bigNumberToShort(n)` → `5.6K`. Если `!Lampa.Storage.field('card_interfice_reactions')`, Lampa удаляет блок реакций — тогда и наш чип не показываем.
- **Сериал**: `e.data.episodes.episodes[]` — серии **только последнего сезона**, все подряд (включая не вышедшие), без `original_name`; поля `season_number, episode_number, name, air_date, runtime, still_path`. Студия `movie.networks[0].name` («Prime Video»), автор `movie.created_by[0].name`, плюс `next_episode_to_air`, `last_episode_to_air`, `seasons[]`, `status`.
- **Хэш и прогресс**: фильм `Lampa.Utils.hash(movie.original_title)`, серия `Lampa.Utils.hash([s, s > 10 ? ':' : '', e, movie.original_name || movie.original_title].join(''))`. `Lampa.Timeline.view(hash)` → `{hash, percent, time, duration, profile, updated, handler}`; запись `Lampa.Timeline.update({hash, percent, time, duration})`; для одной серии есть `Lampa.Timeline.watchedEpisode(card, s, e, true)`.
- **Закрытие карточки**: `Lampa.Listener.follow('activity', fn)`, типы `init/create/start/archive/destroy`, поля `{type, component, object}`. `destroy` покинутой карточки приходит через ~200 мс и также при вытеснении по лимиту истории — сверять `e.object` с сохранённым `e.object` из события `full`.
- **Смена контроллера**: `Lampa.Controller.listener.follow('toggle', function(e){ e.name })`; цепочка при спуске по карточке: `full_start` → `full_descr` → `items_line` (все ряды одним именем).
- **Модалки**: `Lampa.Modal.open({title, html, size, onBack})` включает контроллер `modal` и фокус не восстанавливает. Перед открытием запомнить `Lampa.Controller.enabled().name`, в `onBack` — `Lampa.Modal.close(); Lampa.Controller.toggle(сохранённое)`.
- **Ряды карточки**: свой тип ряда создать нельзя (`components` — замыкание `full.js`). `e.link.rows.push(['cards'|'discuss', data])` на `type:'start'` работает только для штатных типов, позиция не гарантирована (`discuss` вставляется на индекс 2), строятся лениво по 3. Поэтому наши блоки (отзывы, факты) встраиваем в DOM ряда описания — его контроллер `full_descr` собирает все `.selector` внутри себя.
- **Установка плагина пользователем**: Настройки → Расширения → «+» → URL `.js` → согласие с предупреждением. Lampa грузит через `Lampa.Utils.putScriptAsync(urls, complite, error, success, show_logs)`.

### 0.3 Инварианты (нарушение = провал задачи)

1. Кнопки источников, «Торренты», `button--play` → `Lampa.Select`, реакции, закладки, подписка работают как в оригинале. TorrServer и онлайн-балансеры плагин не видит и не трогает.
2. Пульт: все интерактивные элементы — `.selector`; вниз/вверх со стартового блока уводят на описание/наши ряды и обратно; «назад» закрывает модалы и возвращает фокус.
3. Строгий ES5: нет `let/const/=>/`template`/class/spread/Object.assign/Array.find/includes/Promise` (Promise нет на старых Tizen). Проверяется скриптом `scripts/es5check.mjs`.
4. Любое исключение внутри плагина не ломает карточку: рантайм обёрнут в `try/catch`, при ошибке шаблона восстанавливается оригинал.
5. Все таймеры/наблюдатели/iframe уничтожаются при закрытии карточки (утечки на ТВ = зависание через час).
6. На мобильной раскладке (`!Lampa.Platform.screen('tv')` или `innerWidth <= 480`) плагин ничего не подменяет.

### 0.4 Дизайн-токены (из канваса, px даны для 1920×1080; в CSS использовать em при базовом 16px: 1em = 16px)

```
--lumen-bg:#0B0908  --lumen-panel:#1C1613  --lumen-line:#2C231D
--lumen-text:#F3EDE4  --lumen-muted:#A89A8A  --lumen-smoke:#7A6A5A
--lumen-accent:#E8B87A (Песок) | #7FB7C9 (Лёд) | #C46A8F (Вино) | #9FCF8A (Мята)
--lumen-spice:#D9622B  --lumen-good:#8FBF7A
Шрифты: Unbounded 500/700/800 (заголовки), Golos Text 400/500/600 (текст), JetBrains Mono 400/600 (цифры, метки).
Заголовок 88px/1.02, мета 20px mono, описание 24px/1.45 2 строки, чипы рейтингов 28px число + 14px метка,
кнопки 72px высоты, radius 18px, фокус: заливка accent, текст #1A120A, border 2.5px #FFF2DC, scale 1.06, тень 0 14px 40px rgba(accent,.35).
Вуали: слева linear 90deg rgba(11,9,8,.96)→0 к 82%; снизу 0deg .98→0 к 60%; сверху 180deg .7→0 к 22%.
```

### 0.5 Как тестировать в настоящей Lampa (главный инструмент проверки)

1. В браузерной панели открыть `https://cf.lampa.mx` (`lampa.mx` в панели заблокирован, `cf.lampa.mx` открывается). На приветствии выбрать «Русский». Выставить `resize_window` 1920×1080 — тогда `Lampa.Platform.screen('tv') === true`.
2. Инжект плагина: файл больше лимита одного вызова, поэтому грузить чанками через `javascript_tool`:
   ```js
   // вызов 1
   window.__lc = ''; 'ok'
   // вызовы 2..N (по ~20 КБ): window.__lc += <JSON-строка чанка>; 'ok'
   // последний вызов
   (function(){ var s=document.createElement('script'); s.text=window.__lc; document.head.appendChild(s); return 'injected ' + window.__lc.length })()
   ```
   Чанки готовит скрипт `scripts/chunks.mjs` (Task 2), он пишет `dist/chunks/NN.js` с уже готовыми выражениями `window.__lc += "...";`.
3. Открыть карточку без поиска: `Lampa.Activity.push({url:'', title:'Дюна', component:'full', id:693134, method:'movie', card:{id:693134, source:'tmdb'}, source:'tmdb'})`. Сериал «Фоллаут»: `{…, id:106379, method:'tv', card:{id:106379, source:'tmdb'}}`.
4. Снимки: `computer.screenshot`, состояния проверять `read_page`/`javascript_tool` (`document.querySelector('.lumen-card')`), консоль — `read_console_messages` с `onlyErrors:true`.
5. Пульт эмулировать клавишами: `computer.key` `"ArrowRight"`, `"ArrowDown"`, `"Enter"`, `"Escape"`/`"Backspace"` (Lampa слушает keydown).
6. Данные для проверки, снятые с живой карточки «Дюны»: `imdb_id 'tt15239678'`, `vote_average 8.135`, `images.backdrops.length 136`, `videos` в movie отсутствует.

### 0.6 Если API_NOTES_2.md отсутствует — ТЗ повторного исследования

Через `curl https://raw.githubusercontent.com/yumata/lampa-source/main/<path>` выяснить: (1) `src/core/api/sources/tmdb.js` — `append_to_response` в `full()`, где лежат `videos`, есть ли `Lampa.TMDB.api()`; (2) `src/components/full/start/trailers.js` и `src/interaction/youtube*` — как Lampa играет трейлер на TV; (3) `src/utils/reguest.js` — сигнатура `silent/native`, поддержка `headers`; (4) CORS у `https://kinopoiskapiunofficial.tech/api/v2.2/films/{id}/reviews` (curl `-i -X OPTIONS -H "Origin: https://lampa.mx" -H "Access-Control-Request-Headers: x-api-key"`), у `https://api.kinopoisk.dev/v1.4/review`; (5) svg-иконки в `src/templates/full/start_new.js`. Записать в API_NOTES_2.md.

### 0.7 Источник дизайна — экспорт Claude Design (заменяет канвас из 0.1)

Файлы: `C:\Users\azark\Новая папка\lumen-card\design\Lumen Card for Lampa - FHD.dc.html` (главный для кода: 1920×1080, **px ÷ 16 = em**), `- 2K.dc.html`, `- 4K.dc.html` (те же 14 экранов ×1.33 / ×2). Экраны разделены комментариями `<!-- 01 --- -->` … `<!-- 14 --- -->`, стили инлайновые, акценты через CSS-переменные `--ac --onac --ring --acglow`. Посмотреть вживую: `python -m http.server 8766` из `lumen-card\`, открыть `http://localhost:8766/design/Lumen%20Card%20for%20Lampa%20-%20FHD.dc.html`. Папка `design\_ds\` — TVI Design System, прицепилась к проекту случайно, в экранах не используется: **игнорировать**.

Решения дизайна, которые меняют задачи плана:

| Экран | Что показано | Какая задача меняется |
|---|---|---|
| 01 Film — Focus Play | в мета-строке `· реж. Дени Вильнёв`; под актёрами строка полных имён; чип «4.1K СМОТРЯТ» | Task 5. Верхнюю панель Lampa (на экране дорисованы вкладки «Главная / Фильмы…») **не трогаем**. Чип «смотрят» берёт число из реакций CUB (`reactios.js`, реакция `fire`), подпись «РЕАКЦИЙ»; нет данных — чип скрыт |
| 02 Trailer Playing | контент сжимается в компактный блок: метка «ТРЕЙЛЕР · БЕЗ ЗВУКА», заголовок меньше, строка `2024 · 2:46 · 4K HDR`, кнопки «Смотреть» и «Стоп», таймкод `00:05 / 02:18` | Task 7: режим `.lumen-trailer-on` на корне; кнопка «Стоп» — новый `.selector`, останавливает трейлер и возвращает полный вид |
| 03 Focus Sources | подпись иконочной кнопки видна только в фокусе | Task 5 (CSS) |
| 04 No Backdrop | кадров нет → постер 2:3 слева с чипом TMDB, контент справа | Task 6: вместо процедурного фона раскладка «постер слева»; процедурный фон — только если нет и постера |
| 05 Series — Focus Continue | мета со студией (`Amazon Prime` = `networks[0].name`), подзаголовок `Fallout · Джонатан Нолан` (`created_by[0].name`), чип «Следующая серия — 17 декабря, через 31 день», прогресс `S2 E3 «Голова» · 18:40 / 58:12 · 32 %`, кнопки «Продолжить S2 E3» и «Подписка», ряд серий сезона: просмотрена / «смотрите · осталось 39 мин» / не вышла | Task 8 + новый блок ряда серий в Task 5 (данные `e.data.episodes`) |
| 06 Episode Focus | фокус в ряду серий → шапка сжимается (заголовок меньше, описание скрыто) | Task 4 (класс `.lumen-compact` при фокусе ниже кнопок) |
| 07 Description & Reviews | полное описание, таблица «ПОДРОБНО» (Оригинал, Премьера, Страна, Режиссёр, Жанр, Время), заголовок отзывов «КИНОПОИСК · 318 ОТЗЫВОВ» (`total` из API), метка тона «ПОЗИТИВНЫЙ», «12 полезно» | Task 9 + таблица фактов в Task 5 |
| 08 Review Modal | модал: аватар, автор, дата, тон, «полезно», источник, заголовок, текст с прокруткой | Task 9 |
| 09 Settings | Включить · Акцент · Анимации · Слайдшоу кадров · **Интервал 14 с** · Трейлер в фоне · Актёры в карточке · Отзывы Кинопоиска · Ключ Kinopoisk API «нужен для отзывов и рейтинга КП» | Task 10: интервал `8/14/20`, по умолчанию `14`. С ключом заполнять `rate--kp` из `ratingKinopoisk` ответа `films?imdbId=`, если Lampa его не дала |
| 10 States & Chips | статусы: Выпущенный / Выходит / **Анонс**; иконочная кнопка в фокусе расширяется с подписью | Task 5: статус `Planned`, `In Production`, `Post Production` → «Анонс» |
| 12 Motion Storyboard | появление: подъём на 24 px (1.5em), 700 мс, `cubic-bezier(.2,.8,.2,1)`, шаг 60 мс, порядок мета → заголовок → описание → рейтинги → кнопки; фокус: 280 мс `cubic-bezier(.2,.9,.3,1.25)`, обводка 2.5 px, scale 1.06; кадры: кроссфейд 1.2 с ease-in-out + наезд 14 с линейно 1.00→1.08; старт трейлера: вуали гаснут 1 с | Task 4, Task 6, Task 7 — значения брать отсюда |
| 13 Empty & Error | нет отзывов → блок скрыт целиком; нет ключа → блок-подсказка «Настройки → Lumen Card → Ключ Kinopoisk API»; кадры не загрузились → фон из размытого постера | Task 6, Task 9 |
| 14 Accent Variants | четыре акцента, у каждого своя тройка `--onac --ring --acglow` (см. ниже) | Task 10 |

Акценты из логики дизайна (цвет, текст на акценте, кольцо фокуса, свечение):
```
Песок #E8B87A #1A120A #FFF2DC rgba(232,184,122,.35)
Лёд   #7FB7C9 #08171C #E9F7FB rgba(127,183,201,.35)
Вино  #C46A8F #1C0A12 #FBEAF1 rgba(196,106,143,.35)
Мята  #9FCF8A #0C1608 #EEFBE7 rgba(159,207,138,.35)
```

### 0.8 Локальная Lampa для проверки

Официальная собранная Lampa 3.3.4 (`github.com/yumata/lampa`, коммит от 2026-09-12) клонируется в `lumen-card\vendor\lampa\` (в `.gitignore`). Раздаётся тем же `http.server` на 8766: `http://localhost:8766/vendor/lampa/index.html`. Плагин грузится с того же origin без блокировок: `Lampa.Utils.putScriptAsync(['http://localhost:8766/dist/lumen_card.js?' + Date.now()], function(){})` или обычным `<script>`. Процедура 0.5 с cf.lampa.mx остаётся запасной — оттуда localhost недоступен (Private Network Access), только инжект чанками.

---

## 1. Структура файлов

```
C:\Users\azark\Новая папка\lumen-card\
├── src\
│   ├── 00_head.js        IIFE-начало, guard, константы, объект LC (namespace)
│   ├── 10_util.js        ES5-хелперы: each/map/filter/find/clamp/fmtTime/esc/debounce/once
│   ├── 20_icons.js       единый набор SVG (stroke 1.8, 24×24) + replaceIcons()
│   ├── 30_css.js         CSS-строка (токены, шаблон, анимации, слайдшоу, трейлер, отзывы)
│   ├── 40_template.js    HTML новой карточки + сравнение с оригиналом (assertTemplate)
│   ├── 50_backdrops.js   pickBackdrops(images, max) — чистая функция + рантайм слайдшоу
│   ├── 55_trailer.js     pickTrailer(videos) — чистая + рантайм YouTube iframe
│   ├── 60_reviews.js     нормализация ответа Kinopoisk Unofficial, кэш, рантайм ряда отзывов
│   ├── 70_progress.js    прогресс фильма/сериала (Timeline) — чистая findLastEpisode + рендер
│   ├── 80_settings.js    SettingsApi: акцент, анимации, слайдшоу, трейлер, отзывы, ключ API, шрифты
│   ├── 90_runtime.js     init(): Template.add, Listener 'full', сборка блоков, destroy
│   └── 99_tail.js        IIFE-конец
├── dist\
│   ├── lumen_card.js     результат сборки (коммитится — это то, что ставят пользователи)
│   └── chunks\NN.js      чанки для инжекта в cf.lampa.mx (не коммитить)
├── scripts\
│   ├── build.mjs         конкатенация src → dist/lumen_card.js + node --check
│   ├── es5check.mjs      грубый линт ES5 по регуляркам
│   └── chunks.mjs        режет dist на чанки-выражения
├── test\
│   ├── util.test.mjs
│   ├── backdrops.test.mjs
│   ├── trailer.test.mjs
│   ├── reviews.test.mjs
│   └── progress.test.mjs
├── harness\index.html    стенд с эмуляцией Lampa API (делает executor v1; подключает dist/lumen_card.js)
├── docs\plans\2026-09-15-lumen-card.md   этот план
├── README.md
└── .gitignore            dist/chunks/
```

Модули пишутся так, чтобы работать и в IIFE, и в `node --test`:

```js
// конец каждого src-модуля с чистой логикой
if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;
```

В браузере `module` не определён, ветка не выполняется. В тестах `require('../src/50_backdrops.js')` работает, потому что `LC` объявляется в модуле как `var LC = (typeof window !== 'undefined' && window.LC) || (typeof LC !== 'undefined' ? LC : {});` — см. Task 2.

---

## 2. Задачи

### Task 1: Приёмка v1 от executor'а

**Files:**
- Read: `C:\Users\azark\Новая папка\lumen-card\lumen_card.js`, `harness\index.html`, `README.md`, отчёт executor'а
- Read: `C:\Users\azark\AppData\Local\Temp\lampa\API_NOTES.md`

- [ ] **Step 1: Проверить, что файлы существуют и синтаксис валиден**

Run:
```bash
"C:/Users/azark/AppData/Local/Programs/nodejs/node.exe" --check "C:/Users/azark/Новая папка/lumen-card/lumen_card.js" && echo SYNTAX_OK
grep -nE "=>|\blet\b|\bconst\b|\`|\bclass\s|Object\.assign|\.includes\(|\.find\(|Promise" "C:/Users/azark/Новая папка/lumen-card/lumen_card.js" | head
```
Expected: `SYNTAX_OK`, grep пустой. Если grep нашёл — записать строки, чинить в Task 2 при переносе в `src/`.

- [ ] **Step 2: Сверить шаблон v1 с оригиналом**

Взять оригинал из API_NOTES.md §1, выписать все `class="…"`, `#{…}` и `{…}`; для каждого убедиться, что в шаблоне v1 есть такой же класс/ключ. Список отсутствующих сохранить в `docs/plans/acceptance-v1.md`.

- [ ] **Step 3: Прогнать v1 в живой Lampa (процедура 0.5)**

Инжектировать `lumen_card.js` (пока без чанкера — если файл < 25 КБ, одним вызовом), открыть «Дюну», снять скриншот, проверить консоль на ошибки, нажать `ArrowRight` ×2 и `Enter` на кнопке источников — должен открыться `Lampa.Select` (селектор `.selectbox`). Нажать `Escape`. Нажать `ArrowDown` — фокус уходит в описание.

- [ ] **Step 4: Записать результат**

В `docs/plans/acceptance-v1.md`: что работает, что сломано, скриншот-описание. Всё сломанное становится пунктами Task 2/Task 5.

---

### Task 2: Инфраструктура сборки и тестов, перенос v1 в src/

**Files:**
- Create: `scripts/build.mjs`, `scripts/es5check.mjs`, `scripts/chunks.mjs`, `.gitignore`
- Create: `src/00_head.js`, `src/10_util.js`, `src/99_tail.js`, остальные `src/*.js` как заготовки с содержимым v1, разнесённым по ответственности
- Test: `test/util.test.mjs`

- [ ] **Step 1: build.mjs**

```js
// scripts/build.mjs — конкатенация src/*.js по имени, проверка синтаксиса
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const banner = `// Lumen Card for Lampa — build ${new Date().toISOString().slice(0,10)}\n`;
const out = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');
mkdirSync(join(root, 'dist'), { recursive: true });
const dist = join(root, 'dist', 'lumen_card.js');
writeFileSync(dist, out);
execFileSync(process.execPath, ['--check', dist], { stdio: 'inherit' });
console.log(`built ${dist} (${out.length} bytes, ${files.length} modules)`);
```

- [ ] **Step 2: es5check.mjs**

```js
// scripts/es5check.mjs — грубая проверка ES5; падает с кодом 1 при находках
import { readFileSync } from 'node:fs';
const file = process.argv[2] || 'dist/lumen_card.js';
const src = readFileSync(file, 'utf8');
const rules = [
  [/=>/g, 'arrow function'], [/\blet\b/g, 'let'], [/\bconst\b/g, 'const'],
  [/`/g, 'template literal'], [/\bclass\s+[A-Za-z]/g, 'class'],
  [/Object\.assign/g, 'Object.assign'], [/\.includes\(/g, 'includes'],
  [/\.find\(/g, 'Array.find (jQuery .find( допустим только на jQuery-объектах — проверь вручную)'],
  [/\bPromise\b/g, 'Promise'], [/\.\.\./g, 'spread'], [/\bfor\s*\(\s*(var\s+)?\w+\s+of\b/g, 'for-of'],
];
let bad = 0;
for (const [re, name] of rules) {
  let m; while ((m = re.exec(src))) {
    const line = src.slice(0, m.index).split('\n').length;
    console.log(`${name} at line ${line}`); bad++;
  }
}
if (bad) { console.error(`ES5 check: ${bad} findings`); process.exit(1); }
console.log('ES5 check: ok');
```
Примечание: `.find(` на jQuery-объектах легитимен; правило оставить, но в коде jQuery-поиск писать как `$el.find(` — и добавлять в whitelist через комментарий `/* jq */` на той же строке, а в скрипте пропускать строки, содержащие `/* jq */`. Реализовать: перед `bad++` проверить `src.split('\n')[line-1].indexOf('/* jq */') === -1`.

- [ ] **Step 3: chunks.mjs**

```js
// scripts/chunks.mjs — режет dist/lumen_card.js на выражения для javascript_tool
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const src = readFileSync('dist/lumen_card.js', 'utf8');
const SIZE = 20000;
rmSync('dist/chunks', { recursive: true, force: true }); mkdirSync('dist/chunks', { recursive: true });
let n = 0;
for (let i = 0; i < src.length; i += SIZE, n++) {
  writeFileSync(`dist/chunks/${String(n).padStart(2,'0')}.js`, `window.__lc += ${JSON.stringify(src.slice(i, i + SIZE))}; 'chunk ${n}'`);
}
console.log(`${n} chunks; first run: window.__lc=''; last run: (function(){var s=document.createElement('script');s.text=window.__lc;document.head.appendChild(s);return 'injected '+window.__lc.length})()`);
```

- [ ] **Step 4: 00_head.js / 10_util.js / 99_tail.js**

```js
// src/00_head.js
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.lumen_card_plugin) return;
  var LC = (typeof window !== 'undefined') ? (window.LC = window.LC || {}) : {};
  LC.VERSION = '0.2.0';
  LC.PREFIX = 'lumen_';
```

```js
// src/10_util.js
  LC.util = {
    each: function (arr, fn) { for (var i = 0; i < (arr ? arr.length : 0); i++) fn(arr[i], i); },
    map: function (arr, fn) { var r = []; LC.util.each(arr, function (a, i) { r.push(fn(a, i)); }); return r; },
    filter: function (arr, fn) { var r = []; LC.util.each(arr, function (a, i) { if (fn(a, i)) r.push(a); }); return r; },
    find: function (arr, fn) { for (var i = 0; i < (arr ? arr.length : 0); i++) if (fn(arr[i], i)) return arr[i]; return null; },
    clamp: function (n, a, b) { return Math.max(a, Math.min(b, n)); },
    // 4012 сек -> "01:06:52"; 166 сек -> "02:46"
    fmtTime: function (sec) {
      sec = Math.max(0, Math.round(sec || 0));
      var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
      var p = function (n) { return (n < 10 ? '0' : '') + n; };
      return (h ? p(h) + ':' : '') + p(m) + ':' + p(s);
    },
    esc: function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); },
    initials: function (name) {
      var parts = String(name || '').trim().split(/\s+/);
      return (parts[0] ? parts[0].charAt(0) : '') + (parts[1] ? parts[1].charAt(0) : '');
    },
    once: function (fn) { var done = false, r; return function () { if (!done) { done = true; r = fn.apply(this, arguments); } return r; }; }
  };
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.util;
```

```js
// src/99_tail.js
  if (typeof window !== 'undefined') {
    window.lumen_card_plugin = true;
    if (window.appready) LC.init(); else if (window.Lampa) Lampa.Listener.follow('app', function (e) { if (e.type == 'ready') LC.init(); });
  }
})();
```

Тесты требуют `require` модуля без IIFE-обёртки: в `test/*.test.mjs` читать файл и выполнять через `new Function('LC','module', src)`:

```js
// test/_load.mjs
import { readFileSync } from 'node:fs';
export function load(name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const LC = { util: null }; const module = { exports: null, lumen: true };
  // util нужен почти всем модулям
  if (name !== '10_util.js') LC.util = load('10_util.js');
  new Function('LC', 'module', src)(LC, module);
  return module.exports;
}
```

- [ ] **Step 5: Тест util (падает, пока файла нет)**

```js
// test/util.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const u = load('10_util.js');
test('fmtTime', () => { assert.equal(u.fmtTime(166), '02:46'); assert.equal(u.fmtTime(4012), '01:06:52'); assert.equal(u.fmtTime(0), '00:00'); });
test('initials', () => { assert.equal(u.initials('Тимоти Шаламе'), 'ТШ'); assert.equal(u.initials('Zendaya'), 'Z'); });
test('esc', () => assert.equal(u.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;'));
```
Run: `cd "C:/Users/azark/Новая папка/lumen-card" && "C:/Users/azark/AppData/Local/Programs/nodejs/node.exe" --test test/` → Expected: FAIL (module not found) до создания util, PASS после.

- [ ] **Step 6: Перенести код v1 в src/ по модулям** (CSS → `30_css.js` как `LC.css = '...'`, шаблон → `40_template.js` как `LC.template = '...'`, настройки → `80_settings.js`, рантайм → `90_runtime.js`). Собрать: `node scripts/build.mjs && node scripts/es5check.mjs dist/lumen_card.js`. Expected: `built …`, `ES5 check: ok`.

- [ ] **Step 7: Harness переключить на `../dist/lumen_card.js`**, открыть стенд через `preview_start` (launch.json: `python -m http.server 8766` в папке проекта), скриншот — карточка рендерится как в v1.

- [ ] **Step 8: git**

```bash
cd "C:/Users/azark/Новая папка/lumen-card" && git init -b main && printf "dist/chunks/\n" > .gitignore && git add -A && git commit -m "chore: v1 карточка, сборка, тесты"
```

---

### Task 3: Единый набор иконок

**Files:**
- Create: `src/20_icons.js`
- Modify: `src/40_template.js` (svg в кнопках заменить на `LC.icons.get('play')` и т.д.)
- Test: `test/icons.test.mjs`

- [ ] **Step 1: Тест**

```js
// test/icons.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const icons = load('20_icons.js');
test('все иконки в одном формате', () => {
  for (const name of icons.names()) {
    const svg = icons.get(name);
    assert.match(svg, new RegExp('^<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" '));
    // единый стиль экрана 11: контурные — stroke 1.8 round; залитые только play и more
    if (name === 'play' || name === 'more') assert.match(svg, / fill="currentColor"/);
    else assert.match(svg, / fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/);
    assert.ok(svg.endsWith('</svg>'));
  }
});
test('map кнопок Lampa покрыт', () => {
  for (const cls of ['button--play','button--book','button--reaction','button--subscribe','button--options','view--torrent','view--trailer'])
    assert.ok(icons.forButton(cls), cls);
});
```

- [ ] **Step 2: Модуль**

```js
// src/20_icons.js — единый стиль: 24×24, stroke 1.8, round caps
  LC.icons = (function () {
    var P = {
      // пути 1:1 из экрана 11 «Icons» файла design/Lumen Card for Lampa - FHD.dc.html
      play:     '<path d="M8 5l11 7-11 7V5z"/>',
      trailer:  '<path d="M3 7.5h18v11.5H3z"/><path d="M3 7.5L6.5 3h11L14 7.5"/><path d="M10 11.5l4.5 2.5-4.5 2.5v-5z"/>',
      bookmark: '<path d="M7 3h10v18l-5-4-5 4V3z"/>',
      torrent:  '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 19h16"/>',
      reaction: '<path d="M7 10.5V20H4v-9.5h3z"/><path d="M7 10.5l4-6.5a2 2 0 013 2.4l-.8 4.1h5a2 2 0 011.95 2.45l-1.3 5.6A2 2 0 0116.9 20H7"/>',
      bell:     '<path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 22h4"/>',
      more:     '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
      list:     '<path d="M9 6h11M9 12h11M9 18h7"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
      comment:  '<path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3v9z"/>',
      star:     '<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8L12 4z"/>',
      clock:    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
      film:     '<path d="M3 4.5h18v15H3z"/><path d="M7.5 4.5v15M16.5 4.5v15M3 12h18"/>',
      chevronR: '<path d="M9 6l6 6-6 6"/>',
      close:    '<path d="M6 6l12 12M18 6L6 18"/>'
    };
    var byButton = { 'button--play': 'play', 'button--book': 'bookmark', 'button--reaction': 'reaction', 'button--subscribe': 'bell', 'button--options': 'more', 'view--torrent': 'torrent', 'view--trailer': 'trailer' };
    function get(name) {
      var paint = (name === 'play' || name === 'more') ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return '<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" ' + paint + '>' + P[name] + '</svg>';
    }
    function names() { var r = []; for (var k in P) if (P.hasOwnProperty(k)) r.push(k); return r; }
    function forButton(cls) { return byButton[cls] || null; }
    // заменяет svg в кнопках карточки (в т.ч. добавленных другими плагинами в .buttons--container)
    function replaceIn($root) {
      $root.find('.full-start__button').each(function () { /* jq */
        var $b = $(this), cls = (this.className || '').split(/\s+/), ico = null;
        for (var i = 0; i < cls.length; i++) if (byButton[cls[i]]) { ico = byButton[cls[i]]; break; }
        if (!ico && $b.hasClass('button--priority')) ico = 'play';
        if (ico) { $b.find('svg').remove(); $b.prepend(get(ico)); } /* jq */
      });
    }
    return { get: get, names: names, forButton: forButton, replaceIn: replaceIn };
  })();
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.icons;
```

- [ ] **Step 3: Тесты зелёные, сборка, стенд**: `node --test test/`, `node scripts/build.mjs`, скриншот стенда — у всех кнопок одинаковая толщина линий. Commit `feat: единый набор иконок`.

---

### Task 4: Анимации в духе Apple TV

**Files:**
- Modify: `src/30_css.js` (блок анимаций), `src/80_settings.js` (параметр `lumen_motion`: full / lite / off), `src/90_runtime.js` (класс на корне)

- [ ] **Step 1: CSS**

```css
/* появление контента: stagger снизу */
.lumen-card.lumen-motion-full .lumen-in { opacity: 0; transform: translateY(1.2em); animation: lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards; }
.lumen-card.lumen-motion-full .lumen-in:nth-child(1){animation-delay:.05s} .lumen-card.lumen-motion-full .lumen-in:nth-child(2){animation-delay:.11s}
.lumen-card.lumen-motion-full .lumen-in:nth-child(3){animation-delay:.17s} .lumen-card.lumen-motion-full .lumen-in:nth-child(4){animation-delay:.23s}
.lumen-card.lumen-motion-full .lumen-in:nth-child(5){animation-delay:.29s} .lumen-card.lumen-motion-full .lumen-in:nth-child(6){animation-delay:.35s}
@keyframes lumen-rise { to { opacity: 1; transform: none; } }
/* фокус кнопки: пружина */
.lumen-card .full-start__button { transition: transform .28s cubic-bezier(.2,.9,.3,1.25), background-color .2s, color .2s, box-shadow .28s; }
.lumen-card .full-start__button.focus { transform: scale(1.06); }
.lumen-card.lumen-motion-lite .full-start__button { transition: background-color .15s, color .15s; }
.lumen-card.lumen-motion-off .full-start__button, .lumen-card.lumen-motion-off .lumen-in { transition: none !important; animation: none !important; opacity: 1; transform: none; }
/* бэкдроп: медленный наезд (Ken Burns) */
.lumen-card.lumen-motion-full .lumen-bg__img.is-active { animation: lumen-kb 14s linear forwards; }
@keyframes lumen-kb { from { transform: scale(1.0) } to { transform: scale(1.08) } }
```
В шаблоне (Task 5) обернуть мета-строку, заголовок, описание, рейтинги, прогресс, кнопки в элементы с классом `lumen-in` — они и есть 6 «детей» контейнера `.lumen-content`.

- [ ] **Step 2: Настройка и авто-режим**

```js
// src/80_settings.js — фрагмент
  LC.motionMode = function () {
    var v = Lampa.Storage.field('lumen_motion'); // 'auto' | 'full' | 'lite' | 'off'
    if (v !== 'auto') return v;
    if (Lampa.Platform.is('tizen') || Lampa.Platform.is('webos')) return 'lite';
    return 'full';
  };
```
Параметр: `{name:'lumen_motion', type:'select', values:{auto:'Авто', full:'Полные', lite:'Лёгкие', off:'Выкл'}, default:'auto'}`. В рантайме при `complite`: `$root.addClass('lumen-motion-' + LC.motionMode())`.

- [ ] **Step 3: Проверка в cf.lampa.mx**: открыть «Дюну», сразу скриншот и через 1 с — контент «поднялся»; `ArrowRight` — кнопка масштабируется без дёрганья. Commit `feat: анимации появления и фокуса`.

---

### Task 5: Шаблон и CSS карточки по дизайну (доводка v1)

**Files:**
- Modify: `src/40_template.js`, `src/30_css.js`, `src/90_runtime.js`

- [ ] **Step 1: assertTemplate** — при `init()` сравнить оригинальный шаблон с нашим по списку обязательных классов/ключей; при расхождении `console.warn` и НЕ подменять шаблон (карточка остаётся штатной, плагин пишет `Lampa.Noty.show('Lumen Card: версия Lampa не поддерживается')`).

```js
// src/40_template.js — фрагмент
  LC.REQUIRED = ['full-start-new__title','full-start-new__head','full--tagline','full-start-new__details','full-start-new__reactions','full-start-new__buttons','buttons--container','button--play','button--book','button--reaction','button--subscribe','button--options','rate--tmdb','rate--imdb','rate--kp','tag--year','tag--time','tag--quality','tag--episode','full-start__pg','full-start__status','is--serial','full--poster','full-start-new__poster'];
  LC.assertTemplate = function (original, ours) {
    var missingInOriginal = [], missingInOurs = [];
    LC.util.each(LC.REQUIRED, function (c) {
      if (original.indexOf(c) === -1) missingInOriginal.push(c);
      if (ours.indexOf(c) === -1) missingInOurs.push(c);
    });
    // языковые ключи оригинала обязаны быть и у нас
    var keys = original.match(/#\{[a-z_]+\}/g) || [];
    LC.util.each(keys, function (k) { if (ours.indexOf(k) === -1) missingInOurs.push(k); });
    return { ok: missingInOurs.length === 0, missingInOurs: missingInOurs, missingInOriginal: missingInOriginal };
  };
```
Тест `test/template.test.mjs`: загрузить `40_template.js`, взять оригинал из API_NOTES.md (скопировать его в `test/fixtures/full_start_new.original.html`), `assert.ok(assertTemplate(orig, LC.template).ok)`.

- [ ] **Step 2: Разметка карточки** — структура (все оригинальные узлы внутри, поверх — наши обёртки):

```html
<div class="full-start-new lumen-card">
  <div class="lumen-bg"><div class="lumen-bg__slides"></div><div class="lumen-bg__trailer"></div><div class="lumen-bg__veil"></div></div>
  <div class="full-start-new__body">
    <div class="full-start-new__left"><div class="full-start-new__poster"><img class="full-start-new__img full--poster" /></div></div>
    <div class="full-start-new__right lumen-content">
      <div class="lumen-in lumen-meta"><div class="full-start-new__head"></div><div class="full-start-new__tags"> …оригинальные .tag--year/.tag--time/.tag--quality/.tag--episode… </div><div class="full-start__pg hide"></div></div>
      <div class="lumen-in"><div class="full-start-new__title">{title}</div><div class="lumen-orig"></div><div class="full-start-new__tagline full--tagline">{tagline}</div></div>
      <div class="lumen-in lumen-desc"></div>
      <div class="lumen-in lumen-rates"><div class="full-start-new__rate-line"> …оригинальные .rate--tmdb/.rate--imdb/.rate--kp… <div class="full-start__status hide"></div><div class="is--serial hide">…</div></div></div>
      <div class="lumen-in lumen-progress hide"></div>
      <div class="lumen-in"><div class="full-start-new__reactions selector">…</div><div class="full-start-new__buttons"> …оригинальные кнопки… </div></div>
      <div class="lumen-side"><div class="lumen-quality"></div><div class="lumen-cast"></div></div>
    </div>
  </div>
  <div class="buttons--container hide"> …оригинальный пул кнопок… </div>
</div>
```
Точное содержимое оригинальных узлов копировать из API_NOTES.md §1 без изменений. `.full-start-new__details` тоже оставить (скрыть CSS), потому что start.js пишет в него.

- [ ] **Step 3: Рантайм заполнения при `complite`** (`src/90_runtime.js`, функция `LC.decorate(e)`): описание из `movie.overview` в `.lumen-desc` (обрезка 2 строки через CSS `-webkit-line-clamp:2`), оригинальное название + режиссёр (`persons.crew` с `job=='Director'`), теги качества (`movie.release_quality||movie.quality`; языки дорожек не показывать — данных нет), «В ролях» из `persons.cast.slice(0,5)` + `+N`, `.full-start__status` — точка по классу статуса (`Released`→good, `Returning Series`→accent, `Ended`→muted).

- [ ] **Step 3b: Дефекты приёмки v1** (`docs/plans/acceptance-v1.md`), все обязательны:
  1. Заголовок целиком: если `title.length > 18` — класс `.lumen-title--long` (4em, до 2 строк), иначе 5.5em в одну строку; многоточие только после второй строки.
  2. Страна по-русски: брать текст из штатного `.full-start-new__head`, который `start.js` заполняет до `complite` (формат `2024, США`), отрезать год; фолбэк — `production_countries[].iso_3166_1` через словарь `{US:'США', GB:'Великобритания', RU:'Россия', FR:'Франция', DE:'Германия', JP:'Япония', KR:'Южная Корея', CN:'Китай', CA:'Канада', AU:'Австралия', IT:'Италия', ES:'Испания', IN:'Индия'}`, иначе английское имя.
  3. URL картинок только через `Lampa.TMDB.image('t/p/w1280' + path)` (фолбэк `Lampa.Api.img`), без двойного слэша.
  4. Режиссёр в мета-строке: `e.data.persons.crew` с `job === 'Director'` → `· реж. Имя`; у сериала вместо режиссёра `created_by[0].name` в подзаголовке рядом с оригинальным названием.
  5. Постер: кадров нет → раскладка экрана 04 (постер 2:3 слева, 17em); кадр не загрузился → фон из `poster_path` с `filter: blur(2em) saturate(1.2)` и затемнением (экран 13).

- [ ] **Step 4: Проверить в локальной Lampa (0.8)** (фильм и сериал), скриншоты в `docs/screens/` описать словами в acceptance. Commit `feat: карточка по дизайну`.

---

### Task 6: Слайдшоу кадров

**Files:**
- Create: `src/50_backdrops.js`
- Modify: `src/90_runtime.js`, `src/80_settings.js` (`lumen_slideshow`: on/off, `lumen_slide_interval`: 6/8/12 с)
- Test: `test/backdrops.test.mjs`

- [ ] **Step 1: Тест**

```js
// test/backdrops.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const b = load('50_backdrops.js');
const mk = (p, lang, v, w=1920) => ({ file_path: p, iso_639_1: lang, vote_average: v, width: w, height: Math.round(w*9/16) });
test('без текста, по рейтингу, не больше max, без дублей главного', () => {
  const images = { backdrops: [mk('/a', null, 5), mk('/b', 'en', 9), mk('/c', null, 7), mk('/d', null, 6, 800), mk('/main', null, 8)] };
  const r = b.pickBackdrops(images, '/main', 3);
  assert.deepEqual(r, ['/main', '/c', '/d'].slice(0, 3).length === 3 ? ['/main', '/c', '/d'] : r);
  assert.equal(r[0], '/main');            // главный бэкдроп всегда первый
  assert.ok(r.indexOf('/b') === -1);      // с текстом (iso_639_1 = en) отбрасываем
  assert.ok(r.indexOf('/d') === -1 || r.length === 3); // узкие (<1280) — в конце очереди
});
test('пусто → только главный', () => assert.deepEqual(b.pickBackdrops(null, '/m', 5), ['/m']));
test('нет ничего → []', () => assert.deepEqual(b.pickBackdrops({backdrops:[]}, null, 5), []));
```

- [ ] **Step 2: Чистая функция**

```js
// src/50_backdrops.js
  LC.backdrops = {
    // images: movie.images; main: movie.backdrop_path; max: сколько кадров
    pickBackdrops: function (images, main, max) {
      var list = (images && images.backdrops) ? images.backdrops : [];
      var clean = LC.util.filter(list, function (b) { return b && b.file_path && !b.iso_639_1 && b.file_path !== main; });
      clean.sort(function (x, y) {
        var wx = (x.width || 0) >= 1280 ? 1 : 0, wy = (y.width || 0) >= 1280 ? 1 : 0;
        if (wx !== wy) return wy - wx;
        return (y.vote_average || 0) - (x.vote_average || 0);
      });
      var r = main ? [main] : [];
      LC.util.each(clean, function (b) { if (r.length < max) r.push(b.file_path); });
      return r;
    }
  };
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;
```

- [ ] **Step 3: Рантайм слайдшоу** (в `90_runtime.js`):

```js
  LC.slideshow = function ($root, paths, intervalMs, motion) {
    var $wrap = $root.find('.lumen-bg__slides'); /* jq */
    var idx = 0, timer = null, alive = true, imgs = [];
    function url(p) { return (Lampa.TMDB && Lampa.TMDB.image) ? Lampa.TMDB.image('t/p/w1280' + p) : Lampa.Api.img(p, 'w1280'); }
    function show(i) {
      if (!alive) return;
      var $img = imgs[i];
      if (!$img) {
        $img = $('<div class="lumen-bg__img"></div>').css('background-image', 'url(' + url(paths[i]) + ')');
        imgs[i] = $img; $wrap.append($img);
      }
      $wrap.children().removeClass('is-active'); $img.addClass('is-active');
      // префетч следующего
      var n = (i + 1) % paths.length; if (!imgs[n]) { var pre = new Image(); pre.src = url(paths[n]); }
    }
    show(0);
    if (paths.length > 1 && motion !== 'off') timer = setInterval(function () { idx = (idx + 1) % paths.length; show(idx); }, intervalMs);
    return { destroy: function () { alive = false; if (timer) clearInterval(timer); $wrap.empty(); }, pause: function(){ if(timer){clearInterval(timer); timer=null;} }, resume: function(){ if(!timer && paths.length>1) timer=setInterval(function(){ idx=(idx+1)%paths.length; show(idx); }, intervalMs); } };
  };
```
CSS: `.lumen-bg__img{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease}` `.lumen-bg__img.is-active{opacity:1}`. Если `paths.length === 0` — класс `.lumen-bg--procedural` с CSS-градиентами из артборда Main (радиальные «дюны»).
Кадров брать `max = 8` для full, `4` для lite, `1` для off.

- [ ] **Step 4: Уничтожение** — хранить текущий инстанс в `LC.active.slideshow` и объект активности `LC.active.object = e.object` (из события `full`). Подписка один раз в `init`: `Lampa.Listener.follow('activity', function(e){ if (e.type == 'destroy' && LC.active && e.object === LC.active.object) LC.destroyActive(); })`. На `type:'archive'` той же активности (ушли вглубь, карточка осталась в истории) — `pause()`, на `type:'start'` — `resume()`. Страж `document.body.contains($root[0])` раз в 2 с оставить как страховку.

- [ ] **Step 5: Проверить в cf.lampa.mx**: два скриншота с интервалом 8 с — фон другой; `Escape` из карточки → `LC.active === null`, интервалов не осталось (`javascript_tool`: обернуть `setInterval` счётчиком до инжекта). Commit `feat: слайдшоу кадров`.

---

### Task 7: Фоновый трейлер YouTube

**Files:**
- Create: `src/55_trailer.js`
- Modify: `src/90_runtime.js`, `src/80_settings.js` (`lumen_trailer`: on/off, default: on для browser/android, off для tizen/webos — авто), `src/30_css.js`
- Test: `test/trailer.test.mjs`

Ролики лежат в `e.data.videos.results[]`, элемент `{key, name, official, published_at, iso_639_1, youtube}` — без `type`/`site`; тип угадываем по `name` (трейлер/trailer vs тизер/teaser). Штатную кнопку «Трейлеры» не менять.

- [ ] **Step 1: Тест**

```js
// test/trailer.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const t = load('55_trailer.js');
const v = (key, name, lang, official=true) => ({ key, name, iso_639_1: lang, official, youtube: true, published_at: '2024-01-01' });
test('предпочитает ru трейлер official, затем en Trailer, затем тизер', () => {
  assert.equal(t.pickTrailer([v('a','Teaser','en'), v('b','Official Trailer','en'), v('c','Дублированный трейлер','ru')]).key, 'c');
  assert.equal(t.pickTrailer([v('a','Teaser','en'), v('b','Official Trailer','en')]).key, 'b');
  assert.equal(t.pickTrailer([v('a','Teaser','en')]).key, 'a');
});
test('без key → пропуск', () => assert.equal(t.pickTrailer([{ name: 'Trailer', iso_639_1: 'ru' }]), null));
test('пусто', () => assert.equal(t.pickTrailer([]), null));
```

- [ ] **Step 2: Чистая функция**

```js
// src/55_trailer.js
  LC.trailer = {
    pickTrailer: function (videos) {
      var yt = LC.util.filter(videos || [], function (x) { return x && x.key; });
      function score(x) {
        var s = 0, n = String(x.name || '').toLowerCase();
        if (/trailer|трейлер/.test(n)) s += 40; else if (/teaser|тизер/.test(n)) s += 20; else s += 5;
        if (x.iso_639_1 === 'ru') s += 30; else if (x.iso_639_1 === 'en') s += 10;
        if (x.official) s += 5;
        return s;
      }
      var best = null, bs = -1;
      LC.util.each(yt, function (x) { var s = score(x); if (s > bs) { bs = s; best = x; } });
      return best;
    }
  };
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.trailer;
```

- [ ] **Step 3: Рантайм** — YouTube IFrame API, без звука, старт через 3 с после открытия карточки, слайдшоу ставится на паузу пока играет, при ошибке/таймауте 6 с — тихо убрать и вернуть слайдшоу:

```js
  LC.trailerPlayer = function ($root, key, onStart, onEnd) {
    var $host = $root.find('.lumen-bg__trailer'); /* jq */
    var id = 'lumen-yt-' + Date.now(), player = null, dead = false, timeout = null;
    $host.html('<div id="' + id + '"></div>');
    function kill() { if (dead) return; dead = true; if (timeout) clearTimeout(timeout); try { if (player && player.destroy) player.destroy(); } catch (e) {} $host.empty().removeClass('is-live'); onEnd(); }
    function create() {
      if (dead) return;
      try {
        player = new YT.Player(id, {
          videoId: key, width: '100%', height: '100%',
          playerVars: { autoplay: 1, mute: 1, controls: 0, rel: 0, modestbranding: 1, playsinline: 1, start: 4, iv_load_policy: 3, disablekb: 1, fs: 0 },
          events: {
            onReady: function (ev) { ev.target.mute(); ev.target.playVideo(); },
            onStateChange: function (ev) {
              if (ev.data === 1) { if (timeout) clearTimeout(timeout); $host.addClass('is-live'); onStart(); }
              if (ev.data === 0) kill();
            },
            onError: kill
          }
        });
      } catch (e) { kill(); }
    }
    timeout = setTimeout(kill, 6000);
    if (window.YT && window.YT.Player) create();
    else {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () { if (prev) prev(); create(); };
      if (!document.getElementById('lumen-yt-api')) { var s = document.createElement('script'); s.id = 'lumen-yt-api'; s.src = 'https://www.youtube.com/iframe_api'; document.head.appendChild(s); }
    }
    return { destroy: kill };
  };
```
CSS: `.lumen-bg__trailer{position:absolute;inset:-10% 0;opacity:0;transition:opacity 1s} .lumen-bg__trailer.is-live{opacity:1} .lumen-bg__trailer iframe{width:100%;height:100%;pointer-events:none}` (высота с запасом 120%, чтобы спрятать чёрные полосы). Трейлер убивать при `hover:enter` на любой кнопке (`$root.on('hover:enter', '.selector', kill)`), при `destroyActive`, при уходе фокуса вниз: `Lampa.Controller.listener.follow('toggle', function(e){ if (LC.active && e.name !== 'full_start') LC.active.trailer && LC.active.trailer.destroy(); })`. Тот же слушатель ставит на корень `.lumen-compact` (экран 06) при `e.name === 'full_descr' || e.name === 'items_line'` и снимает при `full_start`. Подписываться один раз в `init`, не на каждую карточку.

- [ ] **Step 4: Проверить в cf.lampa.mx** (там браузер, YouTube работает): через 5 с после открытия «Дюны» `document.querySelector('.lumen-bg__trailer.is-live iframe')` не null; `ArrowRight`, `Enter` → трейлер снят, `Lampa.Select` открыт. Commit `feat: фоновый трейлер`.

---

### Task 8: «Продолжить» для фильмов и сериалов

**Files:**
- Create: `src/70_progress.js`
- Modify: `src/90_runtime.js`
- Test: `test/progress.test.mjs`

- [ ] **Step 1: Исходное состояние**

Формула хэша серии подтверждена живьём (см. 0.2): `[s, s > 10 ? ':' : '', e, original_name || original_title].join('')`. После Task 2 модуль `src/70_progress.js` уже содержит `LC.progress.movieProgress(movie, view, hash)` и `serialProgress(movie, view, hash)` из v1, возвращающие `{view, season, episode}` или `null` (перебор ≤10 сезонов × ≤30 серий, выбор по `updated`). Эту сигнатуру сохранить — рантайм и `test/progress.test.mjs` на неё опираются. Задача ниже добавляет: границу «досмотрено» (`percent >= 95` → не показывать и перейти к следующей серии), приоритет последнего сезона из `e.data.episodes.episodes` (название серии и длительность для подписи `S2 E3 «Голова»`), и форматирование подписи. Тесты из Step 2 адаптировать к форме `{view, season, episode}`: вместо `r.label`/`r.percent` проверять `r.season`, `r.episode`, `r.view.percent`, а подпись — отдельной чистой функцией `LC.progress.label(found, episodes)`.

- [ ] **Step 2: Тест**

```js
// test/progress.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const p = load('70_progress.js');
const hash = s => 'h:' + s; // подмена Lampa.Utils.hash
test('фильм: percent>0 и <95 → показываем', () => {
  const r = p.movieProgress({ original_title: 'Dune' }, h => h === 'h:Dune' ? { percent: 43, time: 4320, duration: 9960 } : null, hash);
  assert.deepEqual(r, { percent: 43, time: 4320, duration: 9960, label: 'ПРОДОЛЖИТЬ' });
});
test('фильм: досмотрен → null', () => assert.equal(p.movieProgress({ original_title: 'Dune' }, () => ({ percent: 97 }), hash), null));
test('сериал: последняя начатая серия', () => {
  const eps = [{ season_number: 2, episode_number: 2 }, { season_number: 2, episode_number: 3 }, { season_number: 2, episode_number: 4 }];
  const view = h => h === 'h:23Fallout' ? { percent: 32, time: 1120, duration: 3492 } : (h === 'h:22Fallout' ? { percent: 100 } : null);
  const r = p.seriesProgress({ original_name: 'Fallout' }, eps, view, hash);
  assert.equal(r.label, 'ПРОДОЛЖИТЬ · S2 E3'); assert.equal(r.percent, 32);
});
```

- [ ] **Step 3: Модуль**

```js
// src/70_progress.js — view = Lampa.Timeline.view, hash = Lampa.Utils.hash (передаются для тестируемости)
  LC.progress = {
    movieProgress: function (movie, view, hash) {
      var v = view(hash(movie.original_title || movie.title || ''));
      if (!v || !(v.percent > 0) || v.percent >= 95) return null;
      return { percent: v.percent, time: v.time || 0, duration: v.duration || 0, label: 'ПРОДОЛЖИТЬ' };
    },
    // episodes: e.data.episodes.episodes (или episodes_original); берём последнюю по порядку серию с 0<percent<95,
    // если такой нет — первую не начатую после последней досмотренной
    seriesProgress: function (movie, episodes, view, hash) {
      var name = movie.original_name || movie.name || '', found = null, lastDone = -1;
      LC.util.each(episodes || [], function (ep, i) {
        var s = ep.season_number, n = ep.episode_number;
        var v = view(hash([s, s > 10 ? ':' : '', n, name].join('')));
        if (v && v.percent > 0 && v.percent < 95) found = { ep: ep, v: v };
        if (v && v.percent >= 95) lastDone = i;
      });
      if (!found && lastDone >= 0 && episodes[lastDone + 1]) found = { ep: episodes[lastDone + 1], v: { percent: 0, time: 0, duration: 0 } };
      if (!found) return null;
      return { percent: found.v.percent, time: found.v.time || 0, duration: found.v.duration || 0, label: 'ПРОДОЛЖИТЬ · S' + found.ep.season_number + ' E' + found.ep.episode_number };
    }
  };
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;
```
Рендер в `.lumen-progress`: `label` + полоса `width: percent%` + `fmtTime(time) / fmtTime(duration)` (если duration 0 — только label). Показывать только когда результат не null.

- [ ] **Step 4: Проверить в cf.lampa.mx**: `Lampa.Timeline.update({hash: Lampa.Utils.hash('Dune: Part Two'), percent: 43, time: 4320, duration: 9960})` (сигнатуру `update` взять из `src/interaction/timeline.js`), переоткрыть карточку — строка «ПРОДОЛЖИТЬ» с 43 %. Commit `feat: продолжить для фильмов и сериалов`.

---

### Task 9: Русские отзывы (Кинопоиск)

**Files:**
- Create: `src/60_reviews.js`
- Modify: `src/90_runtime.js`, `src/80_settings.js` (`lumen_kp_key` — type `input`, `lumen_reviews` on/off), `src/30_css.js`
- Test: `test/reviews.test.mjs`

CORS у `kinopoiskapiunofficial.tech` открыт (`*`, заголовок `x-api-key` разрешён — проверено), запросы идут напрямую из плагина, прокси не нужен. Без ключа блок отзывов не рендерится, в настройках подсказка «Получите бесплатный ключ на kinopoiskapiunofficial.tech (500 запросов/день)».

Эндпоинты: поиск `GET /api/v2.2/films?imdbId=tt15239678` → `items[0].kinopoiskId`; отзывы `GET /api/v2.2/films/{kinopoiskId}/reviews?page=1&order=USER_POSITIVE_RATING_DESC` → `{total, items:[{kinopoiskId, type:'POSITIVE'|'NEGATIVE'|'NEUTRAL', date, positiveRating, negativeRating, author, title, description}]}`. Точные имена полей сверить с API_NOTES_2 §4 (там записан живой ответ).

- [ ] **Step 1: Тест**

```js
// test/reviews.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const r = load('60_reviews.js');
test('normalize: обрезка, тип, дата, html-эскейп', () => {
  const out = r.normalize({ items: [{ type: 'POSITIVE', date: '2024-03-02T10:00:00', author: 'Иван', title: 'Шедевр <b>', description: 'Очень ' + 'длинный '.repeat(200), positiveRating: 12, negativeRating: 3 }] });
  assert.equal(out.length, 1);
  assert.equal(out[0].tone, 'good'); assert.equal(out[0].date, '02.03.2024'); assert.equal(out[0].title, 'Шедевр &lt;b&gt;');
  assert.ok(out[0].excerpt.length <= 320); assert.equal(out[0].likes, 12);
});
test('normalize: NEGATIVE→bad, NEUTRAL→mid, без title → первые слова', () => {
  const out = r.normalize({ items: [{ type: 'NEGATIVE', description: 'Скучно и долго. Очень.' }, { type: 'NEUTRAL', description: 'x' }] });
  assert.equal(out[0].tone, 'bad'); assert.equal(out[0].title, 'Скучно и долго.'); assert.equal(out[1].tone, 'mid');
});
test('cache key и TTL', () => {
  assert.equal(r.cacheKey('tt1'), 'lumen_rv_tt1');
  assert.equal(r.isFresh({ at: Date.now() - 1000 }), true);
  assert.equal(r.isFresh({ at: Date.now() - 25 * 3600 * 1000 }), false);
});
```

- [ ] **Step 2: Модуль**

```js
// src/60_reviews.js
  LC.reviews = {
    TTL: 24 * 3600 * 1000,
    cacheKey: function (imdbId) { return 'lumen_rv_' + imdbId; },
    isFresh: function (rec) { return !!(rec && rec.at && (Date.now() - rec.at) < LC.reviews.TTL); },
    normalize: function (resp) {
      var items = (resp && resp.items) || [];
      return LC.util.map(items, function (it) {
        var text = String(it.description || '').replace(/\s+/g, ' ').trim();
        var title = String(it.title || '').trim();
        if (!title) { var m = text.match(/^(.{10,80}?[.!?])\s/); title = m ? m[1] : text.slice(0, 60); }
        var d = String(it.date || ''); var dm = d.match(/^(\d{4})-(\d{2})-(\d{2})/);
        return {
          tone: it.type === 'POSITIVE' ? 'good' : (it.type === 'NEGATIVE' ? 'bad' : 'mid'),
          author: LC.util.esc(it.author || 'Аноним'),
          title: LC.util.esc(title),
          excerpt: LC.util.esc(text.length > 300 ? text.slice(0, 297) + '…' : text),
          full: LC.util.esc(text),
          date: dm ? dm[3] + '.' + dm[2] + '.' + dm[1] : '',
          likes: it.positiveRating || 0, dislikes: it.negativeRating || 0
        };
      });
    },
    // load(imdbId, key, cb(list|null)) — Storage-кэш → films?imdbId → reviews
    load: function (imdbId, key, cb) {
      if (!imdbId || !key) return cb(null);
      var rec = Lampa.Storage.get(LC.reviews.cacheKey(imdbId), null);
      if (LC.reviews.isFresh(rec)) return cb(rec.list);
      var net = new Lampa.Reguest(), base = 'https://kinopoiskapiunofficial.tech/api/v2.2/films';
      var opts = { headers: { 'X-API-KEY': key, 'accept': 'application/json' }, dataType: 'json', timeout: 8000 }; // сигнатуру сверить с API_NOTES_2 §3
      net.silent(base + '?imdbId=' + imdbId, function (r1) {
        var kp = r1 && r1.items && r1.items[0] && r1.items[0].kinopoiskId;
        if (!kp) return cb(null);
        net.silent(base + '/' + kp + '/reviews?page=1&order=USER_POSITIVE_RATING_DESC', function (r2) {
          var list = LC.reviews.normalize(r2).slice(0, 12);
          Lampa.Storage.set(LC.reviews.cacheKey(imdbId), { at: Date.now(), list: list, kp: kp });
          cb(list);
        }, function () { cb(null); }, false, opts);
      }, function () { cb(null); }, false, opts);
    }
  };
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.reviews;
```

- [ ] **Step 3: UI ряда отзывов** — в `complite`: если ключ есть, `LC.reviews.load(movie.imdb_id || (movie.external_ids||{}).imdb_id, key, render)`. `render(list)`: если пусто — ничего. Иначе вставить после `.full-descr` в `e.object.activity.render()`:

```html
<div class="lumen-reviews">
  <div class="lumen-reviews__head"><span class="lumen-ico-wrap">{icons.comment}</span> Отзывы зрителей <span class="lumen-reviews__src">КИНОПОИСК</span></div>
  <div class="lumen-reviews__row">
    <div class="lumen-review selector lumen-review--good" data-i="0">
      <div class="lumen-review__top"><div class="lumen-review__ava">ИП</div><div><div class="lumen-review__author">Иван П.</div><div class="lumen-review__date">02.03.2024</div></div><div class="lumen-review__likes">{icons.star} 12</div></div>
      <div class="lumen-review__title">Шедевр</div>
      <div class="lumen-review__text">…4 строки…</div>
    </div>
  </div>
</div>
```
Тон — левая полоса 4px: good `--lumen-good`, mid `--lumen-muted`, bad `--lumen-spice`. Карточки 30em шириной, горизонтальный ряд с `overflow:hidden`; фокус (`.focus`) — рамка accent и `scale(1.03)`; при фокусе прокручивать ряд так, чтобы карточка была видна (`scrollLeft` анимировать через `$row.stop().animate({scrollLeft: …}, 250)`). `hover:enter` → `Lampa.Modal.open({title: author + ' · ' + date, html: $('<div class="lumen-review__full">' + full + '</div>'), size: 'medium', onBack: function(){ Lampa.Modal.close(); Lampa.Controller.toggle('content'); }})` — имя контроллера для возврата проверить в живой Lampa: `Lampa.Controller.enabled().name` перед открытием модала, сохранить и восстановить его.

- [ ] **Step 4: Встраивание и навигация** — свой тип ряда в Lampa создать нельзя (см. 0.2), поэтому блок отзывов вставляется ВНУТРЬ ряда описания: в `Lampa.Listener.follow('full', …)` на `e.type === 'build' && e.name === 'description'` взять `e.item.render()` (jQuery ряда `items_line` с телом `.full-descr`) и дописать `.lumen-reviews` после `.full-descr__tags`. Если на `build` данных ещё нет (запрос асинхронный) — сохранить ссылку на тело ряда и дописать, когда придёт ответ. Контроллер `full_descr` сам соберёт новые `.selector`: после вставки вызвать `Lampa.Controller.collectionAppend(nodes)` (если `full_descr` уже активен). Проверить в локальной Lampa (0.8) диспатчем `keydown` с `keyCode` на `document` (40 вниз, 39 вправо, 13 Enter, 8 назад): кнопки → описание → карточка отзыва получает `.focus`, → переходит к следующей, Enter открывает модал, назад возвращает `full_descr` с тем же фокусом, ↑ ↑ возвращает на кнопки.

- [ ] **Step 5: Настройки**: `lumen_kp_key` type `input` (в SettingsApi: `param:{name:'lumen_kp_key', type:'input', values:'', default:''}, field:{name:'Ключ Kinopoisk Unofficial API', description:'Бесплатно на kinopoiskapiunofficial.tech'}`). Commit `feat: отзывы Кинопоиска`.

---

### Task 10: Настройки — полный список и применение без перезапуска

**Files:**
- Modify: `src/80_settings.js`, `src/90_runtime.js`

| param | type | values | default |
|---|---|---|---|
| lumen_enabled | trigger | | true |
| lumen_accent | select | sand/ice/wine/mint | sand |
| lumen_fonts | trigger | | true (Google Fonts; off = системный) |
| lumen_motion | select | auto/full/lite/off | auto |
| lumen_slideshow | trigger | | true |
| lumen_slide_interval | select | 8/14/20 | 14 |
| lumen_trailer | select | auto/on/off | auto (on для browser/android, off для tizen/webos) |
| lumen_cast | trigger | | true |
| lumen_reviews | trigger | | true |
| lumen_kp_key | input | | '' |

- [ ] `onChange` акцента: `document.documentElement.style.setProperty('--lumen-accent', hex)`; остальное читается при следующем открытии карточки. `lumen_enabled=false` → `Lampa.Template.add('full_start_new', LC.originalTemplate)`; `true` → наш. Commit `feat: настройки`.

---

### Task 11: Очистка ресурсов и устойчивость

**Files:**
- Modify: `src/90_runtime.js`

- [ ] `LC.active = {root, slideshow, trailer, guard}`; `LC.destroyActive()` вызывает `destroy` у всех и `clearInterval(guard)`. Страж: `setInterval(function(){ if(LC.active && !document.body.contains(LC.active.root[0])) LC.destroyActive() }, 2000)`.
- [ ] Весь `decorate(e)` в `try{}catch(err){ console.error('[lumen]', err); }`; ошибка в шаблоне на `init` → восстановить оригинал.
- [ ] Проверка утечек в cf.lampa.mx: открыть/закрыть карточку 5 раз, `javascript_tool`: `document.querySelectorAll('.lumen-bg__img').length === 0` после закрытия, число активных интервалов не растёт (патч `setInterval/clearInterval` счётчиком до инжекта). Commit `fix: очистка ресурсов`.

---

### Task 12: Ревью и финальная проверка

- [ ] `node --test "test/*.test.mjs"` — все зелёные (форма `node --test test/` на этой машине падает с «Cannot find module 'test'»); `node scripts/build.mjs && node scripts/es5check.mjs dist/lumen_card.js` — ok.
- [ ] Стенд `harness/` — фильм и сериал, скриншоты.
- [ ] cf.lampa.mx — чек-лист: (1) карточка «Дюна» по дизайну, (2) слайдшоу меняет кадр, (3) трейлер стартует и снимается при `Enter`, (4) `Enter` на источниках открывает `Lampa.Select` (путь к торрентам жив), (5) `ArrowDown` → описание → отзывы, `Enter` → модал, `Escape` → назад, (6) сериал «Фоллаут» — статус «Выходит», следующая серия, (7) настройки: смена акцента применяется, выключение плагина возвращает штатную карточку, (8) консоль без ошибок, (9) закрытие карточки убирает таймеры.
- [ ] Отправить `dist/lumen_card.js` и `src/` агенту `code-reviewer` с этим планом и инвариантами 0.3; исправить найденное. Commit `chore: ревью`.

---

### Task 13: Публикация и установка

- [ ] README: что это, скриншоты (описание), установка (Настройки → Расширения → Добавить плагин → URL), настройки, ключ Кинопоиска, ограничения (IMDb/КП рейтинги только с CUB/парсером; трейлер требует YouTube в webview; шрифты требуют интернет), совместимость (Lampa ≥ 3.x, TV-раскладка), лицензия MIT.
- [ ] Хостинг: `gh auth status`; если авторизован — `gh repo create lumen-card --public --source . --push`, включить Pages из `main`/root (`gh api -X POST repos/{owner}/lumen-card/pages -f build_type=legacy -f source[branch]=main -f source[path]=/`), URL плагина `https://<owner>.github.io/lumen-card/dist/lumen_card.js`. Если `gh` не авторизован — написать в README инструкцию для ручной публикации и отдать файл пользователю через `SendUserFile`.
- [ ] Финальный отчёт пользователю: ссылка на плагин, как поставить, что проверено, что не проверялось (реальные Tizen/webOS/Android TV — только браузерная Lampa и стенд).

---

## 3. Риски и как с ними работать

| Риск | Митигация |
|---|---|
| Шаблон Lampa изменится в новой версии | `assertTemplate` на старте: при расхождении плагин не подменяет шаблон и пишет Noty |
| YouTube не работает в webview ТВ | таймаут 6 с → тихий откат к слайдшоу; auto-режим off на Tizen/webOS |
| Kinopoisk Unofficial закроет CORS или изменит схему | запросы обёрнуты в err-колбэк, блок просто не рендерится; в README указать альтернативу `api.poiskkino.dev` (CORS тоже открыт) |
| Лимит 500 запросов/день | кэш 24 ч в Storage, 2 запроса на фильм |
| Ряд отзывов не попадает в навигацию | два варианта вставки (после `.full-descr` / внутрь), выбрать по живой проверке |
| Формула хэша серии | grep по online_mod.js до реализации; при несовпадении показывать прогресс только для фильмов |
| Производительность на старых ТВ | режимы motion auto/lite/off, кадров 4 в lite, Ken Burns только в full |
| Утечки таймеров | `LC.destroyActive` + страж на `document.body.contains` |

## 4. Чего плагин НЕ делает (осознанно)

- Не меняет плеер, источники, парсер, TorrServer — только оформление карточки и новые информационные блоки.
- Не работает на мобильной раскладке.
- Не тянет рейтинги IMDb/КП сам (это делает CUB/парсер); показывает то, что есть в `movie`.
- Не хранит ключ API нигде, кроме `Lampa.Storage` на устройстве.

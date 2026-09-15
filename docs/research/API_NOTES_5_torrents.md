# Lampa API Notes 5 — путь просмотра через TorrServer

Версия: Lampa 3.3.4 (собранная, `vendor/lampa/app.min.js` + `css/app.css`).
Источник для сверки: `https://raw.githubusercontent.com/yumata/lampa-source/main/<path>` (ветка `main` отвечает, дерево получено через GitHub Trees API). Все приведённые ниже фрагменты JS — дословные цитаты из исходников репозитория, все CSS-блоки — дословные цитаты из `vendor/lampa/css/app.css` (номера строк указаны).

Не пересекается с `API_NOTES.md`…`API_NOTES_4.md` (там — карточка `full_start_new`, реакции, timeline-формула хэша, Netflix-подборки). Здесь — всё начиная с нажатия «Смотреть» и до старта плеера через TorrServer.

## Карта пути (обзор)

| # | Экран | Компонент / функция | Файл-источник | Как открывается |
|---|---|---|---|---|
| 1 | Выбор источника | `Lampa.Select.show()` (данные из `onGroupButtons`) | `src/components/full/start/buttons.js` | `.button--play` → `hover:enter`, если источников >1 |
| 2 | Список торрентов | компонент `torrents` (`Explorer`+`Filter`) | `src/components/torrents.js` | `Activity.push({component:'torrents', movie, search})` из `src/components/full/start/torrents.js` (кнопка `.view--torrent`) |
| 3 | Меню действий на торренте | `Lampa.Select.show()` | `src/components/torrents.js` (`hover:long` на `.torrent-item`) | долгое нажатие на элемент списка |
| 4 | Спиннер подключения | `Modal.open(...modal_loading...)` | `src/interaction/torrent.js` → `loading()` | вызывается из `Torrent.start`/`Torrent.open` |
| 5 | TorrServer не задан | `Modal.open(...torrent_install...)` | `src/interaction/torrent.js` → `install()` | если `Torserver.url()` пуст |
| 6 | TorrServer недоступен | `Torserver.error()` (шаблон `torrent_error`, классы `.torrent-checklist`) | `src/interaction/torserver.js` | колбэк ошибки `Torserver.connected()` |
| 7 | Не удалось получить хэш | `Modal.update(...torrent_nohash...)` | `src/interaction/torrent.js` → `hash()` | колбэк ошибки `Torserver.hash()` |
| 8 | Таймаут списка файлов | `Modal.update(...error...)` | `src/interaction/torrent.js` → `files()` | 45×2с опроса `Torserver.files()` без результата |
| 9 | Список файлов (фильм) | `Modal.update(...torrent_file...)` | `src/interaction/torrent.js` → `list()` | после получения `file_stats` |
| 10 | Список файлов (сериал) | `Modal.update(...torrent_file_serial...)` | `src/interaction/torrent.js` → `list()` | то же, когда найдены сезоны |
| 11 | Меню действий на файле | `Lampa.Select.show()` | `src/interaction/torrent.js` (`hover:long` на файле) | долгое нажатие на файл |
| 12 | Предзагрузка/буфер | `Lampa.Loading.start(..., {media})` → `media-loading` | `src/interaction/torrent.js` → `preload()`, реализация в `src/interaction/media_loading.js` | по `hover:enter` на файле, только если ссылка со своего TorrServer и содержит `&preload` |

Дополнительно: экран «Мои торренты» (`src/components/mytorrents.js`, меню «Ещё» → «Мои торренты») **не** относится к пути через карточку, но заходит в шаги 4–12 через тот же `Lampa.Torrent.open(hash, movie)` — см. раздел 7.

---

## 1. Выбор источника (Select «Источник»)

**Компонент**: не отдельный экран, а обычный вызов `Lampa.Select.show()`. Собирается в `onGroupButtons` — обработчике клика по `.button--play`.

**Файл**: `src/components/full/start/buttons.js`

```js
play.on('hover:enter',(e)=>{
    ...
    btns = this.html.find('.buttons--container > .full-start__button').not('.hide').filter(...)

    if(btns.length == 1){
        btns.trigger('hover:enter')             // единственный источник — сразу открываем его
    }
    else{
        let items = []
        btns.each(function(){
            let icon = $(this).find('svg').prop('outerHTML')
            items.push({
                title: $(this).text(),
                subtitle: $(this).data('subtitle'),
                template: typeof icon == 'undefined' || icon == 'undefined' ? 'selectbox_item' : 'selectbox_icon',
                icon: icon,
                btn: $(this)
            })
        })
        Select.show({
            title: Lang.translate('settings_rest_source'),   // RU: "Источник"
            items: items,
            onSelect: (a)=>{ a.btn.trigger('hover:enter') }, // повторно триггерит hover:enter на исходной кнопке (.view--torrent и т.п.)
            onLong: (a)=>{ Storage.set('full_btn_priority', Utils.hash(...)); this.emit('priorityButton', a.btn) },
            onBack: ()=>{ Controller.toggle('content') }
        })
    }
})
```

Т.е. пункты меню строятся **из самих кнопок** `.buttons--container > .full-start__button` (та же зона, где `.view--torrent`, `.view--trailer` и т.п. — см. `API_NOTES_2.md` §5). `.view--torrent` триггерит обработчик из `src/components/full/start/torrents.js`:

```js
button.on('hover:enter',()=>{
    ...
    Activity.push({
        url: '', title: Lang.translate('title_torrents'), component: 'torrents',
        search: combinations[Storage.field('parse_lang')],
        search_one: this.card.title, search_two: this.card.original_title,
        movie: this.card, page: 1
    })
})
```

**Шаблон**: `selectbox` (`src/templates/selectbox/box.js`) + по одному `selectbox_icon` (есть SVG-иконка) на пункт:

```html
<div class="selectbox">
    <div class="selectbox__layer"></div>
    <div class="selectbox__content layer--height">
        <div class="selectbox__head"><div class="selectbox__title"></div></div>
        <div class="selectbox__body"></div>
    </div>
</div>
```
```html
<!-- selectbox_icon, src/templates/selectbox/icon.js -->
<div class="selectbox-item selectbox-item--icon selector">
    <div class="selectbox-item__icon">{icon}</div>
    <div>
        <div class="selectbox-item__title">{title}</div>
        <div class="selectbox-item__subtitle">{subtitle}</div>
    </div>
</div>
```

**CSS** (`app.css:7020-7275`, root-классы):
```css
.selectbox{ position:fixed; top:0; right:0; z-index:55; }
.selectbox__content{
  position:fixed; top:0; left:100%; width:35%;              /* 50% <=767px, 70% <=580px, 100% <=480px (снизу, слайд вверх) */
  background:#262829; display:flex; flex-direction:column;
  transition:transform .2s; will-change:transform;
}
.selectbox__head{ padding:2em; padding-bottom:0; }
.selectbox__title{ font-size:2.2em; font-weight:300; }
.selectbox-item{ padding:1.5em 2em; position:relative; }
.selectbox-item__title{ font-size:1.3em; line-height:1.3; }
.selectbox-item__subtitle{ font-size:1.1em; margin-top:.4em; opacity:.7; }
.selectbox-item__icon > *{ width:2.7em; height:2.7em; }
.selectbox-item.focus{ background-color:#353535; }
body.selectbox--open .selectbox__layer{ display:block; }
```

**Навигация**: контроллер `'select'` (`Controller.add('select', {...})`, `select.js`). `.selector` = `.selectbox-item`. Открытие/закрытие — `left`/`back` → `close()` → `Activity.mixState()` сброс + `onBack()`.

**Данные**: `title`/`subtitle` = текст и `data-subtitle` самой кнопки-источника; `icon` = её `<svg>.outerHTML` как есть (т.е. это та же спрайт-иконка, что и в `.full-start__button`, см. `API_NOTES_2.md` про `#sprite-torrent`).

**Хук**: `Lampa.Select.listener` — `'preshow'`(`{active}`) до отрисовки, `'fullshow'`(`{active, html}`) после вставки в DOM, `'toggle'`, `'hide'`, `'close'`. Единственный способ узнать, что это именно наш селект источников — сверить `e.active.title` со значением `Lampa.Lang.translate('settings_rest_source')` (или, надёжнее, что среди `e.active.items` есть `btn`, у которого `.hasClass('view--torrent')`).

**Рецепт для консоли (мгновенно, без сети)**:
```js
Lampa.Select.show({
  title: Lampa.Lang.translate('settings_rest_source'),
  items: [
    { title: 'Торренты', template: 'selectbox_icon', icon: '<svg viewBox="0 0 47 47"><use xlink:href="#sprite-torrent"></use></svg>' },
    { title: 'Трейлеры', template: 'selectbox_icon', icon: '<svg viewBox="0 0 32 32"><use xlink:href="#sprite-play"></use></svg>' }
  ],
  onSelect: function(a){ Lampa.Noty.show('selected: ' + a.title) },
  onBack: function(){ Lampa.Controller.toggle('content') }
})
```

---

## 2. Экран «Торренты» — список результатов парсера

**Компонент**: `torrents` (регистрируется под этим именем; открывается через `Activity.push` см. §1).
**Файл**: `src/components/torrents.js` (34 KB, самый большой в пути). Обёртка — класс `Explorer` (`src/interaction/explorer.js`), панель — класс `Filter` (`src/interaction/filter.js`).

### 2.1 Корневая раскладка — Explorer

Шаблон `explorer` (`src/templates/explorer/main.js`):
```html
<div class="explorer layer--width">
  <div class="explorer__left">
    <div class="explorer__card">
      <div class="explorer-card">
        <div class="explorer-card__head">
          <div class="explorer-card__head-left">
            <div class="explorer-card__head-img selector"><img alt=""></div>
          </div>
          <div class="explorer-card__head-body">
            <div class="explorer-card__head-create"></div>
            <div class="explorer-card__head-rate"><svg><use xlink:href="#sprite-star"></use></svg><span></span></div>
          </div>
        </div>
        <div class="explorer-card__body">
          <div class="explorer-card__title"></div>
          <div class="explorer-card__genres"></div>
          <div class="explorer-card__descr"></div>
        </div>
      </div>
    </div>
  </div>
  <div class="explorer__files">
    <div class="explorer__files-head"></div>
    <div class="explorer__files-body"></div>
  </div>
</div>
```
Левая колонка — постер+рейтинг+жанры+описание фильма (`Explorer.movie()` заполняет текстом; если `object.movie` не передан — сам подставляет моковые данные `title:'Фильм не найден', overview:'Этот фильм мог бы быть интересным...'`, это специально предусмотрено в коде). Правая — `.explorer__files-head` (сюда `Filter.render()` кладётся через `files.appendHead(filter.render())`) и `.explorer__files-body` (сюда — сам скролл с `.torrent-item`).

**CSS** (`app.css:11399-11600`):
```css
.explorer{ display:flex; }
.explorer__left{ width:27%; flex-shrink:0; }         /* display:none на <=767px */
.explorer__files{ width:73%; flex-shrink:0; }         /* 100% на <=767px */
.explorer__files-head{ padding:1.5em; padding-bottom:0; line-height:1.4; }
.explorer-card__head-img{ position:relative; padding-bottom:150%; }   /* постер, aspect-ratio через padding-bottom */
.explorer-card__head-img > img{ border-radius:.3em; position:absolute; inset:0; background-color:#3E3E3E; }
.explorer-card__head-img.focus::after{ /* рамка фокуса — top/left/right/bottom:-0.5em; border:.3em solid #fff; border-radius:.7em */ }
.explorer-card__title{ font-size:2.3em; font-weight:700; line-height:1.1; }
.explorer-card__title.small{ font-size:1.6em; }        /* если название длиннее 50 символов */
.explorer-card__descr{ font-size:1.15em; font-weight:300; }
```

**Навигация**: ДВА контроллера, переключаются стрелками влево/вправо:
- `'explorer'` (Explorer.toggle()) — фокус на постере `.explorer-card__head-img.selector` (Enter → `Activity.push({component:'full', id:movie.id,...})`, открыть саму карточку);
- `'content'` (torrents.js `this.start()`) — фокус на списке/фильтрах, `Controller.collectionSet(scroll.render(), files.render(true))`.

`content.left` при невозможности сдвинуться внутри списка вызывает `files.toggle()` → включает `'explorer'`; `explorer.right` включает обратно `'content'`.

### 2.2 Панель фильтра/сортировки/поиска — Filter

Шаблон `filter` (`src/templates/filter.js`), в конструкторе `Filter()` **жёстко** получает класс `torrent-filter` (`Template.get('filter').addClass('torrent-filter')` — это в самом переиспользуемом классе, не в `torrents.js`!):

```html
<div>
  <div class="simple-button simple-button--filter selector filter--search">
    <svg><use xlink:href="#sprite-search"></use></svg><div class="hide"></div>
  </div>
  <div class="simple-button simple-button--filter selector filter--sort">
    <span>#{filter_sorted}</span><div class="hide"></div>
  </div>
  <div class="simple-button simple-button--filter selector filter--filter">
    <span>#{filter_filtred}</span><div class="hide"></div>
  </div>
</div>
```
Плюс отдельно `explorer_button_back` (`src/templates/explorer/button_back.js`, кнопка-стрелка «назад к карточке», добавляется `prepend`-ом через `filter.addButtonBack()`).

**CSS** (`app.css:10536-10557` + переопределения внутри `.explorer__files`, `app.css:11439-11454`):
```css
.torrent-filter{ display:flex; margin-bottom:2em; }
.torrent-filter .simple-button.filter--back{ display:none; }         /* показывается только <767px */
.explorer__files .torrent-filter{ margin-bottom:0; }
.explorer__files .torrent-filter .simple-button{ font-size:1.2em; border-radius:.7em; }
.explorer__files .torrent-filter .simple-button:not(.focus){ background-color:rgba(0,0,0,.07); }
```
`.filter--sort`/`.filter--filter` получают/теряют класс `.selector` динамически (`Filter.toggle()`), когда для карточки есть/нет данных сортировки/фильтров (`filter.set('sort', ...)`, `filter.set('filter', ...)`).

Клик по `.filter--search`, `.filter--sort`, `.filter--filter` открывает **тот же** `Select.show()` (см. §1) — с деревом уточнений поиска / вариантов сортировки / чекбоксов фильтра (качество/HDR/Dolby Vision/субтитры/голос/язык/сезон/трекер/год/3D). Это **та же** общая selectbox-разметка.

### 2.3 Элемент результата — torrent-item

**Шаблон** `torrent` (`src/templates/torrent/item.js`):
```html
<div class="torrent-item selector layer--visible layer--render">
    <div class="torrent-item__title">{title}</div>
    <div class="torrent-item__ffprobe hide"></div>
    <div class="torrent-item__details">
        <div class="torrent-item__date">{date}</div>
        <div class="torrent-item__tracker">{tracker}</div>
        <div class="torrent-item__bitrate bitrate">#{torrent_item_bitrate}: <span>{bitrate} #{torrent_item_mb}</span></div>
        <div class="torrent-item__seeds">#{torrent_item_seeds}: <span>{seeds}</span></div>
        <div class="torrent-item__grabs">#{torrent_item_grabs}: <span>{grabs}</span></div>
        <div class="torrent-item__size">{size}</div>
    </div>
</div>
```
`.torrent-item__ffprobe` заполняется отдельно JS-кодом (см. §2.5) тегами `<div class="m-video|m-audio|m-subtitle|m-resolution|m-general">…</div>`; бейдж «просмотрено» — `<div class="torrent-item__viewed">` добавляется/удаляется через `append`/`remove` (не в шаблоне).

**CSS** (`app.css:10179-10420`):
```css
.torrent-list{ padding:0 1.5em; }                       /* обёртка скролла результатов — НЕ путать с .torrent-files (список файлов в модалке, §4) */
.torrent-item{
  background-color:rgba(0,0,0,.3); border-radius:.3em; padding:1em; line-height:1.2; position:relative;
}
.torrent-item__title{ font-size:1.3em; word-break:break-all; }
.torrent-item__details{ display:flex; color:rgba(255,255,255,.5); margin-top:.6em; font-weight:600; align-items:center; white-space:nowrap; }
.torrent-item__size{ background-color:#fff; border-radius:.3em; color:#000; padding:.3em .5em; font-weight:600; }
.torrent-item__bitrate>span, .torrent-item__grabs>span, .torrent-item__seeds>span{ color:#fff; }  /* фон-плашка только на >=767px */
.torrent-item__viewed{ position:absolute; top:-.75em; left:-.75em; border-radius:100%; width:1.5em; height:1.5em; padding:.3em; background-color:#fff; color:#000; }
.torrent-item + .torrent-item{ margin-top:1em; }
.torrent-item.focus::after{
  content:""; position:absolute; top:-.5em; left:-.5em; right:-.5em; bottom:-.5em;
  border:.3em solid #fff; border-radius:.7em; z-index:-1;
}
.torrent-item--popular{ background-color:rgba(255,255,255,.2); }   /* класс объявлен в SCSS, в текущем JS-пути не навешивается — вероятно legacy */
```
Над списком, первым элементом — строка «Продолжить» (`watched-history`, см. §6) через `history.render(true)`.

### 2.4 Состояния: загрузка / ошибка сети / пусто

- **Загрузка**: `this.activity.loader(true)` перед парсингом, `loader(false)` в колбэке (стандартный лоадер Activity — не отдельный шаблон этого пути).
- **Сетевая ошибка парсера** (`Parser.get` зовёт fail-колбэк): `this.empty(Lang.translate('torrent_error_connect') + ': ' + text)` → класс `Empty` (`src/interaction/empty/empty.js`, шаблон `empty`, общий для всего приложения, см. §6) c текстом ошибки, вставляется в `.explorer__files-body` вместо списка, `scroll.body()` теряет класс `torrent-list`.
- **Ничего не найдено после фильтра, но результаты есть** (`this.listEmpty()`): шаблон `empty_filter` (`src/templates/empty/filter.js`):
  ```html
  <div class="empty-filter">
      <div class="empty-filter__title">{title}</div>
      <div class="empty-filter__subtitle">{text}</div>
      <div class="empty-filter__buttons hide"></div>
      <div class="empty-filter__templates">...３× .empty-template...</div>
  </div>
  ```
  CSS (`app.css:9405-9445`, плюс переопределение `.explorer__files .empty-filter{max-width:100%; padding:3em 1.5em 0 1.5em}`):
  ```css
  .empty-filter__title{ font-size:1.8em; margin-bottom:.3em; }
  .empty-filter__subtitle{ font-size:1.2em; font-weight:300; margin-bottom:1.6em; }
  .empty-filter__buttons .simple-button{ font-size:1.2em; border-radius:.2em; margin-bottom:2.4em; }
  ```
- **Вообще ничего не нашлось у парсера** (`results.Results.length == 0`): `this.empty(Lang.translate('search_nofound'), true)` — тот же `Empty`, но с кнопкой «уточнить».

### 2.5 Данные элемента — откуда берутся

Из `this.append()` (`torrents.js:780-968`):
- `title/date/tracker/bitrate/seeds/grabs/size` — из ответа парсера (`element.Title/PublishDate/Tracker/Size/Seeders/Peers`), `bitrate` считается `Utils.calcBitrate(Size, movie.runtime)`.
- `.torrent-item__ffprobe` (качество/HDR/видео WxH/каналы 5.1-7.1/аудио-дорожки с языком и озвучкой/субтитры) — если у элемента есть `element.ffprobe` (пробитый парсером медиаинфо), иначе блок скрыт; season/episode-бейдж (`m-general`, `S{season} {episodes}`) — только когда у фильма `number_of_seasons` и парсер извлёк сезон (`TitleParser.general`, `src/components/torrents/parser.js`).
- Бейдж «просмотрено» — из `Storage.cache('torrents_view', 5000, [])` (локально) либо `element.viewed` с сервера парсера.

### 2.6 Хук для плагина

```js
Lampa.Listener.send('torrent', { type: 'render', element, item })   // на каждый отрисованный элемент
Lampa.Listener.send('torrent', { type: 'onenter', element, item })  // клик — сразу до запуска Torrent.start
Lampa.Listener.send('torrent', { type: 'onlong', element, item, menu }) // перед открытием Select с меню действий — можно донабить menu
```
`menu` в `onlong` — обычный массив пунктов Select (мутируется по ссылке до вызова `Select.show`).

### 2.7 Меню действий на торренте (долгое нажатие)

`Select.show({title: Lang.translate('title_action'), items: [{tomy:true,...добавить в мои торренты}, {mark:true,...}, {unmark:true,...}]})` — снова общий `Select`/`selectbox_item` без иконок (не icon-вариант).

### 2.8 Рецепт для консоли (список без парсера, мгновенно)

```js
var explorer = new Lampa.Explorer({}); // без movie — подставит мок "Фильм не найден" сам
var filter = new Lampa.Filter({ movie: { id: 0, title: 'Mock' } });
explorer.appendHead(filter.render());

var list = $('<div class="torrent-list"></div>');
var mock = { title:'Movie.Name.2024.2160p.HDR.WEB-DL.mkv', date:'01.01.2024', tracker:'rutracker.org', bitrate:38, seeds:154, grabs:12, size:'18.4 GB' };
for (var i = 0; i < 6; i++) list.append(Lampa.Template.get('torrent', mock));
explorer.appendFiles(list);

$('body').empty().append(explorer.render());
```
(Полная интерактивность/пульт потребует ещё `Controller.add('content', ...)` + `Controller.toggle('content')` — для статичных скриншотов оформления не нужно.)

---

## 3. Подключение к TorrServer

Все экраны 3.x переиспользуют **один и тот же** `Modal`-инстанс: `loading()` открывает его один раз (`size:'large'`), дальше всё — `Modal.update()`/`Modal.title()` поверх того же `.modal.modal--large`. Реализация — `src/interaction/torrent.js`.

### 3.1 Точка входа

```js
function start(element, movie){
    SERVER.object = element
    if(movie) SERVER.movie = movie
    if(Platform.is('android') && !Storage.field('internal_torrclient')){
        Android.openTorrent(SERVER)              // на Android по умолчанию — системный торрент-клиент, экраны ниже не показываются
    }
    else if(Torserver.url()) { loading(); connect() }
    else install()
}
```
Экраны 3.2–3.5 актуальны только когда `internal_torrclient` включён (веб-плеер) — это и есть режим, который стилизуется.

### 3.2 Спиннер (modal_loading)

```js
function loading(){
    Modal.open({ title: '', html: Template.get('modal_loading'), size: 'large', mask: true,
        onBack: ()=>{ Modal.close(); close() } })
}
```
Шаблон: `<div class="modal-loading"></div>` (пусто, вся анимация — фоновая картинка).
CSS (`app.css:8858-8866`):
```css
.modal-loading{ height:6em; background:url(../img/loader.svg) no-repeat 50% 50%; background-size:contain; }
```

### 3.3 TorrServer не задан — torrent-install

```js
function install(){
    Modal.open({ title: '', html: Template.get('torrent_install', {}), size: 'large',
        onBack: ()=>{ Modal.close(); Controller.toggle('content') } })
}
```
Шаблон (`src/templates/torrent/install.js`):
```html
<div class="torrent-install">
    <div class="torrent-install__left">
        <img src="https://yumata.github.io/lampa/img/ili/tv.png" class="torrent-install"/>
    </div>
    <div class="torrent-install__details">
        <div class="torrent-install__title">#{torrent_install_need}</div>       <!-- "Необходим TorrServer" -->
        <div class="torrent-install__descr">#{torrent_install_text}</div>
        <div class="torrent-install__label">#{torrent_install_contact}</div>
        <div class="torrent-install__links">
            <div class="torrent-install__link"><div>LG - Samsung</div><div>@lampa_group</div></div>
        </div>
    </div>
</div>
```
CSS (`app.css:10790-10855`):
```css
.torrent-install{ display:flex; }                         /* display:block на <=580px */
.torrent-install__left,.torrent-install__details{ width:50%; }
.torrent-install__left{ padding-right:3em; }               /* display:none на <=580px */
.torrent-install__title{ font-size:2em; line-height:1.4; margin-bottom:.7em; }
.torrent-install__descr{ font-size:1.3em; line-height:1.4em; margin-bottom:3em; }
.torrent-install__link{ float:left; margin-right:1em; margin-bottom:1em; padding:1em; border-radius:.3em; background-color:#363636; }
```
`.selector` здесь **нет вообще** — экран не навигируется пультом, только `back`.

### 3.4 TorrServer недоступен — «чеклист» (torrent-checklist)

**Файл**: `src/interaction/torserver.js`, функция `error()`. Это не просто ошибка, а пошаговый мастер диагностики (6 шагов, translate-ключи `torrent_error_step_1..6` / `torrent_error_info_1..7`), с прогресс-баром и счётчиком «Выполнено N из 6», листается кнопкой «Далее»/«Начать проверку» (`torrent_error_start`/`torrent_error_next`/`torrent_error_complite`).

```js
function error(){
    let temp = Template.get('torrent_error', { ip: ip() })
    ...
    Modal.title(Lang.translate('torrent_error_connect'))
    Modal.update(temp)
    Controller.add('modal', { invisible:true, toggle(){...}, back(){ Modal.close(); Controller.toggle('content') } })
    Controller.toggle('modal')
}
```
Вызывается из `src/interaction/torrent.js`:`connect()` при неуспехе `Torserver.connected()`.

Шаблон `torrent_error` (`src/templates/torrent/error.js`):
```html
<div class="torrent-checklist">
    <div class="torrent-checklist__descr">#{torrent_error_text}</div>
    <div class="torrent-checklist__progress-steps"></div>
    <div class="torrent-checklist__progress-bar"><div style="width: 0"></div></div>
    <div class="torrent-checklist__content">
        <div class="torrent-checklist__steps">
            <ul class="torrent-checklist__list">
                <li>#{torrent_error_step_1}</li> ... <li>#{torrent_error_step_6}</li>
            </ul>
        </div>
        <div class="torrent-checklist__info">
            <div class="hide">#{torrent_error_info_1}</div> ... <div class="hide">#{torrent_error_info_7}</div>
        </div>
    </div>
    <div class="torrent-checklist__footer">
        <div class="simple-button selector">#{torrent_error_start}</div><div class="torrent-checklist__next-step"></div>
    </div>
</div>
```
RU-тексты (для контекста): `torrent_error_text` = «Не удалось подключиться к TorrServer. Давайте быстро пройдёмся по списку возможных проблем и всё проверим.»; шаги — «Запущен ли TorrServer», «Динамический IP-адрес», «Протокол и порт»…

CSS (`app.css:10855-10933`; у самого `.torrent-checklist` **нет собственного фона/паддинга** — это голый `<div>` внутри `.modal__content`, все правила — на потомках):
```css
.torrent-checklist__descr{ /* нет явного правила — использует общий line-height модалки */ }
.torrent-checklist__progress-bar{ background-color:rgba(255,255,255,.15); border-radius:5em; margin-bottom:2em; }
.torrent-checklist__progress-bar > div{ height:.5em; background-color:#fff; border-radius:5em; }
.torrent-checklist__content{ display:flex; }
.torrent-checklist__steps,.torrent-checklist__info{ width:50%; }                 /* steps: display:none на <=480px */
.torrent-checklist__list > li{ margin-bottom:1em; color:#8D8D8D; }
.torrent-checklist__list > li.wait{ color:#fff; }                                 /* текущий и пройденные шаги */
.torrent-checklist__list > li.check{ text-decoration:line-through; }              /* полностью пройденные */
.torrent-checklist__info > div{ font-size:1.2em; line-height:1.6; }
```
Единственный `.selector` — кнопка `.torrent-checklist__footer .simple-button`.

**Важно**: в дереве исходников есть ещё `src/templates/torrent/errors/{nocheck,noconnect}.js` и языковые ключи `torrent_nocheck`/`torrent_noconnect` — они **зарегистрированы** в центральной таблице шаблонов приложения (подтверждено прямо в `app.min.js`: `torrent_nocheck: html$1x, torrent_noconnect: html$1y,`), но ни один найденный путь вызова в 3.3.4 их не использует (текущий `connect()`→`Torserver.error()` всегда идёт через унифицированный `torrent_error`-чеклист). Похоже на легаси/задел на будущее — сами по себе эти шаблоны верстают `.torrent-error.noconnect` (см. ниже, §3.5) внутри общего `.error` блока, так что теоретически они могут всплыть где-то ещё — стоит перепроверить это на живом экране перед тем, как считать их мёртвым кодом.

### 3.5 Не удалось получить хэш — torrent_nohash

```js
function hash(){
    Torserver.hash({...}, (json)=>{ SERVER.hash = json.hash; files() }, (echo)=>{
        let jac = Storage.field('parser_torrent_type') == 'jackett'
        let tpl = Template.get('torrent_nohash', { title: Lang.translate('title_error'), text: Lang.translate('torrent_parser_no_hash'), url: SERVER.object.MagnetUri || SERVER.object.Link, echo })
        if(jac) tpl.find('.is--torlook').remove(); else tpl.find('.is--jackett').remove()
        Modal.update(tpl)
    })
}
```
Шаблон (`src/templates/torrent/errors/nohash.js`) — сначала общий блок `.error` (см. §6), затем `.torrent-error.noconnect` с двумя альтернативными ветками `.is--jackett`/`.is--torlook` (одна из них всегда вырезается по типу парсера):
```html
<div class="error">
    <div class="error__ico"></div>
    <div class="error__body"><div class="error__title">{title}</div><div class="error__text">{text}</div></div>
</div>
<div class="torrent-error noconnect">
    <div><div>#{torent_nohash_reasons}</div><ul>
        <li>#{torent_nohash_reason_one}</li>
        <li>#{torent_nohash_reason_two}: {echo}</li>
        <li>#{torent_nohash_reason_three}: <code>{url}</code></li>
    </ul></div>
    <div class="is--jackett">...</div>
    <div class="is--torlook">...</div>
</div>
```
CSS общая для всех `.torrent-error` (`app.css:10486-10535`):
```css
.torrent-error > div + div{ margin-top:1.3em; }
.torrent-error > div > div{ font-size:1.4em; }
.torrent-error > div > ul{ margin:0; margin-top:.2em; font-size:1.2em; font-weight:300; }
.torrent-error > div > ul > li{ position:relative; padding-left:1em; }
.torrent-error > div > ul > li::before{ content:''; width:.3em; height:.3em; border-radius:100%; background-color:#ddd; position:absolute; top:.5em; left:0; }
.torrent-error code{ background-color:#4c4c4c; border-radius:.2em; padding:0 .5em; word-break:break-all; }
.error + .torrent-error{ margin-top:2em; }
```

### 3.6 Таймаут получения списка файлов

```js
function files(){
    let repeat = 0
    timers.files = setInterval(function(){
        repeat++
        Torserver.files(SERVER.hash, (json)=>{ if(json.file_stats){ clearInterval(timers.files); show(json.file_stats) } })
        if(repeat >= 45){                               // 45×2с = 90 секунд
            Modal.update(Template.get('error', { title: Lang.translate('title_error'), text: Lang.translate('torrent_parser_timeout') }))
            Torserver.clear(); Torserver.drop(SERVER.hash)
        }
    }, 2000)
}
```
Шаблон `error` — общий для всего приложения (`src/templates/error.js`, тот же что использован выше в nohash):
```html
<div class="error">
    <div class="error__ico"></div>
    <div class="error__body"><div class="error__title">{title}</div><div class="error__text">{text}</div></div>
</div>
```
(CSS `.error*` не искал отдельно — компонент общеприкладной, используется десятками экранов вне TorrServer; стилизовать точечно только в контексте `.torrent-error`-соседства, см. §6.)

### 3.7 Рецепты для консоли

Экран «не задан» и «недоступен» — мгновенные, без ожидания реальной сети:

```js
// 3.3 TorrServer не задан
Lampa.Storage.set('torrserver_url', ''); Lampa.Storage.set('torrserver_url_two', '');
Lampa.Torrent.start(
  { title: 'Mock', MagnetUri: 'magnet:?xt=urn:btih:0000000000000000000000000000000000000000' },
  { title: 'Mock Movie' }
);

// 3.4 TorrServer недоступен (чеклист) — сразу, без реального сетевого таймаута
Lampa.Storage.set('torrserver_url', 'http://192.168.1.50:8090');
Lampa.Modal.open({ title:'', html: Lampa.Template.get('modal_loading'), size:'large', mask:true,
  onBack: function(){ Lampa.Modal.close() } });
Lampa.Torserver.error();   // строит и вставляет чеклист в уже открытую модалку

// 3.5 Не удалось получить хэш
Lampa.Modal.open({ title:'', html: Lampa.Template.get('modal_loading'), size:'large', mask:true,
  onBack: function(){ Lampa.Modal.close() } });
var tpl = Lampa.Template.get('torrent_nohash', {
  title: Lampa.Lang.translate('title_error'), text: Lampa.Lang.translate('torrent_parser_no_hash'),
  url: 'magnet:?xt=urn:btih:mock', echo: 'timeout'
});
tpl.find('.is--torlook').remove();
Lampa.Modal.update(tpl);

// 3.6 Таймаут
Lampa.Modal.update(Lampa.Template.get('error', { title: Lampa.Lang.translate('title_error'), text: Lampa.Lang.translate('torrent_parser_timeout') }));
```
Функции `loading/connect/hash/files/install/show/list/autostart` из `torrent.js` **не экспортированы** (`export default {start, open, opened, back}`) — напрямую из консоли недоступны, поэтому промежуточные состояния 3.2–3.6 воссозданы через публичные `Modal`/`Template`/`Torserver.error()`, а не вызовом настоящего внутреннего билдера.

---

## 4. Список файлов

**Функция**: `list(items, params)` внутри `src/interaction/torrent.js` (не экспортирована напрямую, но это конечная точка `show()`, куда попадают после успешного `files()`). Строит `<div class="torrent-files">` и для каждого файла кладёт туда `torrent_file` (фильм) либо `torrent_file_serial` (серия/эпизод), затем `Modal.update(html)` в ту же модалку из §3.

```js
Lampa.Listener.send('torrent_file', { type: 'list_open', items, params })   // хук №1 — до отрисовки
...
Lampa.Listener.send('torrent_file', { type: 'render', element, item, items, params })   // на каждый файл
...
Lampa.Listener.send('torrent_file', { type: 'onenter', element, item, items, params })  // клик "смотреть"
Lampa.Listener.send('torrent_file', { type: 'onlong', element, item, menu, items, params }) // перед меню действий
Lampa.Listener.send('torrent_file', { type: 'onfocus', element, item, items, params })
Lampa.Listener.send('torrent_file', { type: 'list_close' })                              // при закрытии (Torrent.close)
```

### 4.1 Файл фильма — torrent-file

Шаблон (`src/templates/torrent/file.js`):
```html
<div class="torrent-file selector">
    <div class="torrent-file__title">{title}<span class="exe">.{exe}</span></div>
    <div class="torrent-file__size">{size}</div>
</div>
```
Плюс `item.append(Timeline.render(view))` — прогресс-бар `.time-line` абсолютно спозиционирован внутри.

CSS (`app.css:10423-10483`):
```css
.torrent-file{ display:flex; background:rgba(0,0,0,.2); border-radius:.3em; padding:1em; align-items:center; position:relative; padding-bottom:2em; }
.torrent-file__title{ flex-grow:1; font-size:1.3em; line-height:1.2; overflow:hidden; padding-right:1em; text-overflow:ellipsis; }
.torrent-file__title .exe{ border-radius:.3em; background:rgba(255,255,255,.06); padding:.2em .4em; display:inline-block; margin-left:.6em; }
.torrent-file__size{ flex-shrink:0; border-radius:.3em; background:#262829; font-size:1.3em; padding:.3em .5em; }
.torrent-file .time-line{ position:absolute; left:1em; right:1em; bottom:1em; display:block !important; }
.torrent-file.focus{ background-color:rgba(255,255,255,.2); }
```

### 4.2 Серия — torrent-file_serial (класс `.torrent-serial`)

Тот же шаблон используется и для «фильма одним файлом без имени» (тогда `.torrent-serial__episode` вырезается, а `.torrent-serial__line` заполняется таглайном). Шаблон (`src/templates/torrent/serial.js`):
```html
<div class="torrent-serial selector layer--visible layer--render">
    <img data-src="{img}" class="torrent-serial__img" />
    <div class="torrent-serial__content">
        <div class="torrent-serial__body">
            <div class="torrent-serial__title">{fname}</div>
            <div class="torrent-serial__line"><span>#{torrent_serial_season} - <b>{season}</b></span><span>#{torrent_serial_date} - {air_date}</span></div>
        </div>
        <div class="torrent-serial__detail">
            <div class="torrent-serial__size">{size}</div>
            <div class="torrent-serial__exe">.{exe}</div>
        </div>
        <div class="torrent-serial__clear"></div>
    </div>
    <div class="torrent-serial__episode">{episode}</div>
</div>
```
CSS (`app.css:10558-10790`, ключевое):
```css
.torrent-serial{ position:relative; border-radius:.3em; background:#1d1f20; display:flex; align-items:center; }
.torrent-serial__img{ width:12em; height:7em; border-radius:.3em; flex-shrink:0; opacity:0; transition:opacity .2s; }   /* 7em×5em на <=400px */
.torrent-serial__img.loaded{ opacity:1; }
.torrent-serial__content{ padding:.8em 1em; flex-grow:1; overflow:hidden; }
.torrent-serial__title{ font-size:1.7em; overflow:hidden; line-height:1.2; text-overflow:ellipsis; white-space:nowrap; }
.torrent-serial__line{ font-size:1.1em; margin-top:.5em; font-weight:300; }
.torrent-serial__size{ border-radius:.3em; background:#262829; font-size:1.3em; padding:.3em .5em; }
.torrent-serial__episode{ position:absolute; background-color:rgba(0,0,0,.7); left:0; top:0; border-radius:.2em; padding:.3em .5em; font-size:1.4em; font-weight:600; }
.torrent-serial.focus{ background-color:#353535; }
.torrent-serial__progress{ width:.3em; position:absolute; height:0; background:#fff; top:50%; right:0; border-radius:.3em; transition:height .1s linear; transform:translateY(-50%); }  /* см. §4.3 — автостарт */
```
Между соседними `.torrent-file`/`.torrent-serial` внутри `.torrent-files` — `margin-top:1em` (`app.css:10172`). Если файлы сгруппированы по подпапкам торрента — перед группой вставляется `<div class="torrnet-folder-name(...) selector">` (да, опечатка `torrnet-` — это дословно так в коде и в CSS, не «наша» опечатка):
```css
.torrnet-folder-name{ font-size:1.4em; padding:1.4em 0; opacity:.5; }
```

### 4.3 Автостарт единственного файла

Если в раздаче ровно один воспроизводимый файл — `autostart(first_item)`: в файл добавляется `<div class="torrent-serial__progress">`, которая растёт по высоте 0→100% десять секунд (JS выставляет `style.height` каждые 10мс), по истечении — авто-клик по файлу; любая клавиша (`Keypad.listener` `keydown`) отменяет автостарт. CSS-переход уже заложен (`transition:height .1s linear`), фактическую анимацию двигает JS через инлайн-стиль — CSS может задать только внешний вид полоски (ширина/цвет/радиус), но не сам тайминг заполнения.

### 4.4 Меню действий на файле (долгое нажатие)

```js
Select.show({
  title: Lang.translate('title_action'),
  items: [
    { title: Lang.translate('time_reset'), timeclear:true },
    { title: Lang.translate('time_viewed'), timefull:true },
    // + player: 'webos'/'android' на соответствующих платформах
    { title: Lang.translate('player_lauch') + ' - Lampa', player:'lampa' },
    { title: Lang.translate('copy_link'), link:true }
  ], ...
})
```
Снова общий `Select`/`selectbox_item`, без иконок.

### 4.5 «Мои торренты» — тот же экран, другой вход

`src/components/mytorrents.js` — отдельный компонент на движке `Category`+`CardModule` (обычная плиточная сетка карточек, **не** `Explorer`/`Filter`/`.torrent-item`). По клику на сохранённый торрент:
```js
onEnter: function(){ Torrent.open(data.hash, data.data.lampa && data.data.movie ? data.data.movie : false) }
```
`Torrent.open()` — та же публичная функция из `torrent.js`, ведёт в тот же `files()`→`list()`→Modal. Значит: **список файлов и вся цепочка ошибок TorrServer (§3–4) — общие между «Торрентами» из карточки и «Моими торрентами» из меню**, а вот `.torrent-item/.explorer*/.torrent-filter` (§2) — нет, они специфичны только для результатов парсера.

### 4.6 Рецепты для консоли

```js
// Фильм, один файл
var html = $('<div class="torrent-files"></div>');
html.append(Lampa.Template.get('torrent_file', { title: 'Movie.Name.2024.1080p', exe: 'mkv', size: '4.2 GB' }));
Lampa.Modal.open({ title: Lampa.Lang.translate('title_files'), html: html, size: 'large', mask: true,
  onBack: function(){ Lampa.Modal.close() } });

// Сериал, несколько серий с прогрессом
var html2 = $('<div class="torrent-files"></div>');
[['1 сезон / 1 серия', 63], ['1 сезон / 2 серия', 0]].forEach(function(pair, i){
  var el = Lampa.Template.get('torrent_file_serial', {
    fname: pair[0], season: 1, episode: i + 1, air_date: '01.01.2024',
    size: '1.1 GB', exe: 'mkv', img: './img/img_broken.svg'
  });
  var view = Lampa.Timeline.view('mock_' + i);
  view.percent = pair[1];                         // проценты подставляем сами — Timeline.render просто читает params.percent
  el.find('.torrent-serial__content').append(Lampa.Timeline.render(view));
  html2.append(el);
});
Lampa.Modal.open({ title: Lampa.Lang.translate('title_files'), html: html2, size: 'large', mask: true,
  onBack: function(){ Lampa.Modal.close() } });

// Меню действий на файле
Lampa.Select.show({
  title: Lampa.Lang.translate('title_action'),
  items: [
    { title: Lampa.Lang.translate('time_reset') },
    { title: Lampa.Lang.translate('time_viewed') },
    { title: Lampa.Lang.translate('player_lauch') + ' - Lampa' },
    { title: Lampa.Lang.translate('copy_link') }
  ],
  onBack: function(){ Lampa.Controller.toggle('modal') }
});
```

---

## 5. Предзагрузка/буфер перед плеером — media-loading

**Функция**: `preload(data, run)` в `src/interaction/torrent.js`, срабатывает по клику на файл, **только если** ссылка ведёт на свой же TorrServer и содержит `&preload` (`Storage.field('torrserver_preload')` включена в `Torserver.stream()`). Показ реализован через общий `Lampa.Loading.start(cancel, text, {media: data})` (`src/interaction/loading.js`), который при наличии `options.media` вместо обычного тост-спиннера (`.loading-layer`) создаёт `MediaLoading.create()` (`src/interaction/media_loading.js`) — **отдельный полноэкранный** оверлей, не связанный с Modal вообще.

```js
function preload(data, run){
    let need_preload = Torserver.ip() && data.url.indexOf(Torserver.ip())>-1 && data.url.indexOf('&preload')>-1
    if(!need_preload) return run()
    Loading.start(stop, '', {media: data})
    let update = ()=>{
        network.silent(first? data.url : data.url.replace('&preload','&stat'), (res)=>{
            let progress = Math.min(100, (res.preloaded_bytes*100)/res.preload_size)
            if(progress>=95) { stop(); run() }
            else Loading.setProgress(progress, { speed: Utils.bytesToSize(res.download_speed*8,true), active_peers: res.active_peers, total_peers: res.total_peers })
        })
    }
}
```

Разметка строится JS-ом напрямую (не через `Template.add`, поэтому в реестре шаблонов её нет):
```html
<div class="media-loading hide">
    <img class="media-loading__backdrop" alt="">
    <div class="media-loading__shade"></div>
    <div class="media-loading__content">
        <div class="media-loading__mark">
            <div class="media-loading__mark-background"></div>   <!-- тусклая копия лого/тайтла -->
            <div class="media-loading__mark-fill"></div>          <!-- та же копия, но width растёт вместе с прогрессом — эффект "заливки" -->
        </div>
        <div class="media-loading__status">
            <span class="media-loading__peers"><svg class="media-loading__peers-icon">…</svg><span class="media-loading__peers-value"></span></span>
            <span class="media-loading__separator media-loading__peers-separator"></span>
            <span class="media-loading__speed"></span>
            <span class="media-loading__separator media-loading__speed-separator"></span>
            <span class="media-loading__percent">0%</span>
        </div>
    </div>
</div>
```
Класс `media-loading__mark-content--background|--foreground` содержит либо `<img class="media-loading__logo">` (если у фильма есть TMDB-лого), либо `<div class="media-loading__title">` (текст названия) — `.media-loading--text` вешается на корень при отсутствии лого.

CSS (`app.css:7677-7920`):
```css
.media-loading{
  position:fixed; inset:0; z-index:5; display:flex; align-items:center; justify-content:center;
  overflow:hidden; background-color:#1d1f20; opacity:1; transition:opacity .3s ease;
}
.media-loading--standalone{ z-index:100; }              /* именно этот модификатор ставится в цепочке TorrServer-предзагрузки */
.media-loading--leaving{ opacity:0; pointer-events:none; }
.media-loading__backdrop{ position:absolute; inset:0; width:100%; height:100%; object-fit:cover; opacity:.58; }
.media-loading__shade{ position:absolute; inset:0; background:linear-gradient(180deg, rgba(4,4,8,.3) 0%, rgba(4,4,8,.58) 60%, rgba(4,4,8,.82) 100%); }
.media-loading__mark{ position:relative; width:46em; max-width:46em; height:13em; animation:mediaLoadingPulse 2s ease-in-out infinite; }
.media-loading__mark-fill{ width:0; transition:width .18s ease-out; }   /* JS правит width= прогресс% */
.media-loading__title{ width:100%; color:#fff; font-size:3.6em; font-weight:700; line-height:1.08; letter-spacing:-.025em; text-shadow:0 .08em .3em rgba(0,0,0,.65); }
.media-loading__status{
  position:fixed; left:50%; bottom:3em; transform:translateX(-50%); display:flex; align-items:center;
  min-height:1.5em; max-width:88%; padding:.75em 1.35em; border-radius:2em;
  background-color:rgba(255,255,255,.1); box-shadow:0 .35em 1.2em rgba(0,0,0,.28);
  color:rgba(255,255,255,.72); font-size:1.05em; white-space:nowrap;
}
.media-loading__percent{ color:#fff; font-weight:600; font-variant-numeric:tabular-nums; }
```
Это уже довольно современно оформленный экран (пульсирующий бейдж лого/тайтла, плавающая пилюля статуса) — вероятно, из более свежего апдейта 3.3.4; для Lumen Card, скорее всего, речь о смене палитры/шрифтов/скруглений под тему, а не о полной перестройке.

**Навигация**: не через `Controller.add('...')` с обычным `.selector` — сама media-loading ничего не фокусирует; активен контроллер `'loading'` (`src/interaction/loading.js`), где **любая** клавиша (`up/down/left/right/back`) вызывает `cancel()` (отмена предзагрузки).

**Хук**: отдельного `Lampa.Listener`-события у предзагрузки нет (не нашёл ни одного `Listener.send` в `preload()`/`media_loading.js`); зацепиться можно только патчингом/подпиской через `Lampa.Loading` косвенно (не тема этого CSS-ресёрча).

**Рецепт для консоли**:
```js
Lampa.Loading.start(function(){ Lampa.Loading.stop() }, '', {
  media: { title: 'Mock Movie Title', background: 'https://image.tmdb.org/t/p/original/xxxxxxxxxxxxxxxxxxxxxx.jpg' }
});
Lampa.Loading.setProgress(35, { speed: '8.4 Mb/s', active_peers: 6, total_peers: 24 });
// когда нужно закрыть:  Lampa.Loading.stop()
```
(`background` можно подставить и с реального открытого сейчас фильма: `Lampa.Api.img(Lampa.Activity.active().movie.backdrop_path, 'original')`.)

---

## 6. Общие компоненты на пути — зоны поражения CSS

| Компонент/класс | Где ещё используется | Есть отличимый маркер на пути? |
|---|---|---|
| `Lampa.Select` / `.selectbox*` | Все меню приложения: настройки, сортировки, языковые пикеры, любые «длинные нажатия», выбор профиля и т.д. | Нет собственного класса на корне — только `active.title`/состав `active.items`, сверяемые в `Select.listener('preshow'/'fullshow')`. На пути встречается 4 раза: выбор источника (§1), сортировка/фильтр/уточнение поиска (§2.2), меню на торренте (§2.7), меню на файле (§4.4) — у каждого свой узнаваемый `title`. |
| `Lampa.Modal` / `.modal, .modal__content, .modal--large` | Вообще все модалки приложения (настройки, авторизация, «о программе», QR и т.п.) | Нет. `size:'large'` — не уникально для TorrServer. Отличить можно только по внутреннему контенту (`.torrent-files`/`.torrent-checklist`/`.torrent-install`/`.torrent-error`/`.modal-loading`), не по обёртке. |
| `.torrent-filter` (класс объекта `Filter`) | Класс вшит **в конструктор** `src/interaction/filter.js` (`Template.get('filter').addClass('torrent-filter')`) — то есть у любого потребителя `Filter`, не только у «Торрентов» | Нет; название вводит в заблуждение — это не «специфика торрентов», а имя случайно так исторически закрепилось за переиспользуемым фильтром. |
| `.explorer, .explorer-card, .explorer__files*` (класс `Explorer`) | Подключается миксином `src/interaction/items/category/module/explorer.js` к любому компоненту на движке `Category`/`CardModule`, который его укажет — не только к `torrents`. Не проверял исчерпывающе, какие ещё компоненты 3.3.4 реально его подключают — при широком редизайне стоит перепроверить живьём. | Нет. |
| `Empty` / `.empty, .empty-filter` | Общий «пусто/ошибка» экран всего приложения (пустой поиск, пустые подборки и т.д.) | Нет. |
| `.time-line` (`Timeline.render`) | Прогресс-бар просмотра — вставляется в карточки, эпизоды и т.д. по всему приложению, не только в файлы торрента | Нет собственного маркера, только `data-hash`. |
| `.watched-history` («Продолжить…») | Хранилище `online_watched_last` общее — вероятно, тот же виджет использует и «онлайн»-источник (не торрент), не проверял отдельно | Нет. |
| `Torrent.open/start`, `files()/list()`, все экраны §3–4 | Общие между «Торрентами» из карточки (парсер) и «Моими торрентами» (сохранённые, меню приложения) — см. §4.5 | Нет специального класса-маркера «это TorrServer-путь» на `.modal`; есть только сами `.torrent-*`-классы содержимого. |
| `.simple-button` | Базовый класс кнопок-пилюль по всему приложению (фильтр, сортировка, назад, чеклист-«Далее», кнопки Empty) | Нет — почти любая мелкая кнопка в Lampa `.simple-button`. |

---

## Риски для CSS-оформления (сводно)

1. **Модалка не различима.** Все экраны TorrServer (спиннер/install/чеклист/nohash/список файлов) — это один и тот же общий `.modal.modal--large > .modal__content`, которым пользуются десятки несвязанных диалогов приложения. Красить можно только внутренний контент (`.torrent-files`, `.torrent-checklist`, `.torrent-install`, `.torrent-error`, `.modal-loading`), а не `.modal/.modal__content/.modal__head/.modal__title` — иначе задета вся модальная система.
2. **Обманчивые имена.** `.torrent-filter` — не «фильтр торрентов», а класс, зашитый в конструктор переиспользуемого `Filter`; `.explorer*` — общая раскладка «карточка+список», подключаемая к любому компоненту через отдельный миксин, а не эксклюзив «Торрентов». Если красить по этим селекторам «в лоб» — велик шанс задеть другие экраны.
3. **Select/Modal — сквозные.** Единственный способ прицельно оформить именно «выбор источника» или «меню действий над файлом», не трогая остальные selectbox/модалки приложения — навешивать свой класс-маркер через `Select.listener`/`Modal.listener` (`'preshow'/'fullshow'`) по сигнатуре вызова (`active.title`, состав `active.items`). Это уже JS-логика плагина, а не чистый CSS, и её придётся закладывать заранее.
4. **`.torrent-list` vs `.torrent-files`.** Очень похожие имена, разные экраны: `.torrent-list` — обёртка результатов парсера (§2), `.torrent-files` — обёртка списка файлов в модалке (§4). Легко перепутать при написании селекторов.
5. **«Мои торренты» задета неявно.** Экран из меню приложения «Мои торренты» не похож на путь через карточку (другой движок, без `.explorer/.torrent-item/.torrent-filter`), но заходит в тот же `Torrent.open()` → значит весь блок §3–4 (включая чеклист ошибок и список файлов) отрисуется и там. Оформляя «путь через карточку», нужно держать в уме, что заодно меняется и «Мои торренты».

---

## Как открыть путь целиком вручную (сводный чеклист рецептов)

Все фрагменты — в соответствующих разделах выше (§1, §2.8, §3.7, §4.6, §5). Каждый выполняется независимо в консоли открытой Lampa (без парсера и без реального TorrServer), используя только подтверждённые публичные `window.Lampa.*` (`Select, Modal, Template, Lang, Explorer, Filter, Torrent, Torserver, Loading, Timeline, Storage, Controller, Api, Noty` — все перечислены в финальном экспорте `window.Lampa = {...}` в `app.min.js:55947+`).

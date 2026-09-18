# Аудит производительности Lumen Card по итогам проверки на 4K Android TV (2026-09-18)

Источник: read-only аудит кода (Opus, architect) по жалобам пользователя: герой мал, постеры малы и обрезаны, всё тормозит, пиксельно, хаб не листается вниз, рулетка держит чужой фон, подкраска от карточки не работает. Номера строк — на коммит `4cc97d2`.

## Резюме — три независимых корневых дефекта

1. **Хаб/сетка/рулетка физически не умеют прокручиваться.** Создают `Lampa.Scroll`, но никогда не вызывают ни `scroll.minus()` (высота контейнера), ни `scroll.update(node)` (подкрутка к фокусу).
2. **Навигация в наших экранах перебирает всю коллекцию `.selector` дважды на каждое нажатие** — `Controller.collectionSet(root)` целиком (34 плитки / сотни карточек), Lampa держит окно 36. `navMove` зовёт `canmove` + `move`, оба делают `navigate()` → `_getAllRects()`.
3. **Автодетект слабого железа почти никогда не срабатывает** — меряет только открытие карточки при `lumen_motion='auto'`; до вердикта главная/хаб/рулетка живут в `full`.

## A. Тяжёлые CSS-приёмы (`src/30_css.js`)

### `backdrop-filter` — только на карточке
- `:174` → `:754` каждая `.full-start__button` (5-7 шт) поверх живого фона (кроссфейд, Ken Burns, iframe) — очень дорого.
- `:174` → `:817` `.lumen-stop`; `:177` → `:832` `.lumen-trailer-badge`.
- Гасится в lite/off `:1339-1341`.

### `filter: blur()` — полноэкранные
- `:621` `.lumen-bg--blur .lumen-backdrop__img{filter:blur(1.75em);transform:scale(1.1)}` (карточка без кадра).
- `:1560` то же для `.lumen-hero__bg` — одновременно с `transition: opacity .6s` (`:1556`) и анимацией `height .42s` родителя (`:1549`).

### `box-shadow` > 10px — 16 правил
Анимируемые (в `transition … box-shadow .28s`): `:805`, `:828`, `:901`, `:1122`, `:1233`, `:1406` (≈40px); `:1432` чипы (35px); `:1458` плитка хаба в фокусе (45px); `:1485` карточка сетки; `:1974` карточка ряда главной; `:2068/:2078` рулетка; `:2156`.
Статичные массовые: **`:1443` `.lumen-tile__poster{box-shadow:0 .4em 1.2em}` × 3 на плитку × 34 плитки = 102 тени под `rotate()` (`:1444-1446`)**; `:638` постер карточки 60px.

### Прочее
- `text-shadow` — только `65_torrents.js:381`. `mix-blend-mode` — нет.
- `mask-image`: 15 иконок (дёшево) + **`:1841-1842` маска на `.lumen-main .scroll.layer--wheight`** — движущийся `translate3d` слой рядов; отдельный проход композитора на каждый кадр прокрутки (Lampa тоже вешает маску, `app.css:2781`; `body.no--mask` снимает).

### Transition на НЕ-композитных свойствах — главный источник тормозов главной
| Место | Свойство | Слой | Когда |
|---|---|---|---|
| `:1549` | `height .42s` `.lumen-hero` | полноэкранный, с 2 `__bg`, вуалями, canvas | каждый переход «первый ряд ↔ остальные» (`48_hero.js:973-988`) |
| `:1883` | `margin-top, height .42s` `.scroll.layer--wheight` | контейнер всех рядов (15 × ~20 карточек) | одновременно |
| `:1715` | `width/height .42s` `.lumen-hero__logo` | | там же |
| `:1729` | `bottom .42s` `.lumen-hero__text` | | там же |
| `:1767` | `bottom .42s` `.lumen-moods` | | там же |
| `:1546` | `background-color .6s` `.lumen-main` | фон главной | смена акцента |
| `:1368` | `font-size, margin-top .28s` шапка карточки | | сжатие шапки |

Пять reflow-анимаций одновременно 420 мс на экране с 300 карточками — ТВ рисует 3-5 кадров из 25.

### Keyframes
- `:2003` `.lumen-skeleton` infinite opacity (до 8 плиток в хабе, `46_hub.js:80`); гасится в lite/off.
- `:1348` Ken Burns 14 с scale на полноэкранном кадре; `:2108` зум заставки 20 с. Композитные, но на 4K заставляют перерисовывать слой.
- `will-change`: `:2023` оверлей перехода (ок). Не наше: `app.css:3100` `.card{will-change:transform}` × ~300 карточек 15 рядов плагина (`44_rows.js:316`, `lumen_rows_limit` default 15).
- Градиенты: вуали героя `:1582` (левая), `:1600` (нижняя); `:1447` scrim на каждой плитке; `:591` гирлянда — 10 `radial-gradient` полноэкранных; `:606-608` процедурные фоны.
- `opacity < 1` на крупных: `:567` canvas .82; `:1576` кадр под трейлером .25; `:2042` фон рулетки .22; `:876`; `:620`.
- `border-radius` + `overflow:hidden` + `scale`: `:1438`/`:1458` плитки ×34; `:2062` барабан.

## B. Слои на главной одновременно
Герой (`48_hero.js:421-455`), все absolute во всю ширину: `.lumen-hero` (анимируемая height), `.lumen-hero__bg--a/--b` (2 полноэкранных, кроссфейд), `.lumen-hero__trailer`, `.lumen-hero__veil--l/--b` (2 градиента), `.lumen-fx` + canvas (`52_fx.js:828`), `.lumen-hero__text`. Плюс `.lumen-moods` (absolute, анимируемый bottom), `.lumen-minimap`/`.lumen-jump` (fixed при удержании), `.lumen-overlay` (fixed z90), `.lumen-ambient` (fixed z95, внутри ещё 2 img + scrim), штатный `Background` Lampa (прячется только на карточке `:623`).
**Итого в покое: 7 полноэкранных слоёв плагина + фон Lampa + ~300 карточек с `will-change`.**

## C. JS горячие пути — что происходит на КАЖДОЕ нажатие стрелки в ряду
1. `64_nav.js:557-569` `handleDown`; при удержании `onHorizontal` делает `for (i<FAST_EXTRA) move(dir)` (`:546`, `FAST_EXTRA=2` `:79`) — **одно нажатие = 3 перемещения**. Включено по умолчанию (`81_prefs.js:225`).
2. `Controller.move` → `Navigator.navigate` → `_getAllRects` → `getBoundingClientRect()` на каждый элемент коллекции (`vendor/lampa/vender/navigator/navigator.js:268-281, 224-225`).
3. Lampa `focus()` на ТВ: `removeClass('focus')` по всей коллекции + `toggleClass` (`app.min.js:46434-46442`) — ~37 мутаций `class`.
4. Их ловит **единственный `MutationObserver` плагина** `48_hero.js:1148-1157` (`attributes, attributeFilter:['class'], subtree` на корне ВСЕЙ активности). `onMutations` (`:1132`) перебирает записи до первой `.card.focus`.
5. `onFocus` (`:1093-1130`): `updateCompact` → `rowIndex` → `closest('.items-line').index()` (`:953-960`); `rememberFocus` (`:995-1007`) → **`getBoundingClientRect()`** + `find('.card__img').attr('src')`; `scheduleAccent` (`:1078`); `cancelTrailer`+`scheduleTrailer` (`:1112-1116`); таймер показа 350 мс (`:1122`).
6. Через 350 мс — `show()` (`:924`) → `render`, `loadFrame` (w1280/original), `loadDetails` (сеть).
7. Переход с первого ряда на второй — `setCompact(true)` (`:973`) → пять одновременных 420-мс reflow-анимаций.

Lampa ставит `card--loaded` после загрузки постера (`app.min.js:20889, 20967`) — ещё мутация `class`; если карточка под фокусом, **весь `onFocus` выполняется повторно** и перезапускает таймеры акцента/трейлера.

rAF/таймеры: `52_fx.js:671-725` частицы (гейт `motionMode()==='full'` `:585-591`, idle-таймер `:724`); `68_perf.js:300-313`; `54_ambient.js` (20 с); `64_nav.js:534,576,513,497`; `51_slideshow.js` (8/14/20 с).
Синхронные измерения: `48_hero.js:1002`; `85_header.js:683-695` (`scrollToEpisode`: innerWidth, gBCR, offsetLeft/Width, scrollWidth); `64_nav.js:452-467` (`rowPosition`: `$('.card.focus')` по документу); `navigator.js:224` × N × 2.
Доминанта (`57_color.js`): `read()` `:361-378` canvas 16×16 — дёшево. Гейты `on()` `:500-507`: `motionMode()==='full'` **и** `lumen_accent_auto` (default **false**, `81_prefs.js:106`). Вызов из `scheduleAccent` через 3 с, кэш 50 URL, квантование 16; `apply()` `:568` при смене цвета → **`LC.injectCss()` пересобирает всю таблицу (28-81 КБ)**.

## D. Изображения
| Что | Размер | Где | На экране |
|---|---|---|---|
| Постер ряда главной | **w300** (Lampa `app.min.js:4637`) | ряды | 230 px (плагин сузил 12.75em→10.08em `:1959`) |
| Постер сетки | w342 (`46_hub.js:971`) | | ~282, фокус ×1.08 |
| Постеры коллажа | w342 ×3 (`46_hub.js:544, 83`) | хаб | 130 px — вдвое избыточно |
| Кадр героя | w1280 / original при `innerWidth>1366` (`48_hero.js:297-299, 847`) | | |
| Постер героя (нет кадра) | w500 (`:847`) → blur | | |
| Логотип | w500/w780 (`:303-305`) | | |
| Фон карточки | w1280 (`50_backdrops.js:43`), слайдшоу w1280 (`:316`), постер w500 (`:57`) | | |
| Заставка | w1280/original по `screen.width × DPR` (`54_ambient.js:202-203, 73`) — **единственное место с DPR** | | |
| Фон рулетки | w1280 (`56_roulette.js:679`) | opacity .22 | |
| Барабан | w342 (`:647`) | 210 px | |
| Кадры серий | w300 (`85_header.js:643`) | | |

В DOM: главная — 15 рядов × ~20 = **~300 `<img>`** + штатные ряды; хаб — до 34 плиток × 3 постера (первые 8 сразу, остальные по фокусу → при обходе 102 картинки + 34 запроса `collagePaths`); сетка — окно `POSTER_AHEAD=14` (`46_hub.js:72, 914-923`) — правильно.
`decoding="async"` нет нигде. Стартовавшие `img.src` не отменяются.
Причины «пиксельности»: (1) DPR не учитывается нигде, кроме заставки → при `innerWidth=1920, DPR=2` кадр героя `w1280` растянут на 3840; (2) постеры рядов w300 на 230 CSS px при DPR 2 — 1.5× апскейл, `poster_size` Lampa на ряды не влияет; (3) `scale(1.08)`/`scale(1.06)` растягивают растр; (4) коллаж w342 в 130 px — избыток.

## E. Хаб — почему «вниз нельзя вообще»
Устройство: `HubComponent` `46_hub.js:474-827`: `new Lampa.Scroll({mask:true, over:true, step:250})` `:476`, `scroll.append(root)` `:770`, `render` → `scroll.render()` `:780`. Сетка — `flex-wrap` (`30_css.js:1422, 1438`). Контроллер `screenController` `:444-468` как `'content'` `:791`: `toggle: collectionSet(root[0]); collectionFocus(...)`; `down: if (navMove('down') && afterMove) afterMove()` — `afterMove === null`. `navMove` `:422-432`: `canmove` → `move`.

**Гипотеза 1 (причина): у контейнера нет высоты.** Все штатные компоненты вызывают `scroll.minus()` → класс `layer--wheight` (`app.min.js:32231-32233`), по нему Lampa ставит инлайн `height = innerHeight − head` (`31685-31695`); примеры `53170` (category_full), `52904`, `39088`, `44315`. Плагин `minus()`/`height()` не вызывает ни разу (`46_hub.js:476, 770, 780, 824; :836, 1194, 1199, 1239; 56_roulette.js:393, 866, 876, 921`). `.scroll` растягивается по содержимому → `maxOffset` = 0 → прокрутка невозможна. Проверка: `document.querySelector('.lumen-hub').closest('.scroll').getBoundingClientRect().height > innerHeight`.

**Гипотеза 2 (вторая половина): никто не двигает скролл к фокусу.** Эталон `card.onFocus → scroll.update(card.render(true))` (`app.min.js:53107`, также `41297, 43466, 53269, 53526`). `scroll.update` в `src/` не встречается. На ТВ Lampa двигает только `translate3d` в `Scroll.translateScroll` и гасит нативный скролл. Проверка: после «вниз» `document.querySelector('.lumen-hub .focus').getBoundingClientRect().top > innerHeight`.

**Гипотеза 3 (тормоза): коллекция не ограничена.** `collectionSet(html)` берёт все `.selector` (`app.min.js:46448-46456`): хаб 42 узла, сетка 100-300. `canmove` (`navigator.js:762-770`) и `move` (`:732`) оба вызывают `navigate()` → 2×N gBCR на нажатие. Штатно: `Navigator.setCollection(items.slice(active−36, active+36))` (`app.min.js:53157`, `39329`, `limit_collection:36` `39192`) + снятие `layer--render` с дальних (`53148-53156`).

Гипотеза 4 (маловероятно): `canmove('down')` = false. Гипотеза 5 (нет): перехвата `down` вкладками нет (`onUp` только вверх, `:719-729`).
Та же болезнь у `GridComponent` (`46_hub.js:833-1242`) и рулетки (`56_roulette.js:393`).

## F. Рулетка — чужой фон
`:395` `<div class="lumen-roulette__bg">`, стиль `30_css.js:2042`. (1) **`spin()` (`:807-835`) не вызывает `clearResult()`** — единственный вызов в `setMedia` (`:513`); во время прокрутки висит прошлый кадр. (2) **`showResult` (`:677-680`) ставит фон только при наличии кадра** — у фильма без `backdrop_path` предыдущий фон остаётся навсегда. (3) Предзагрузки нет — w1280 декодируется на экране.
Связь с переходом: `LC.transition` наружу — только `open/stop/active/geom/fade` (`67_transition.js:313-319`); `open(object)` берёт источник из `LC.hero.lastFocus()` (`:303`) и сверяет id (`:305`). На рулетке герой снят (`48_hero.js:1334-1338`) → `lastFocus()` null → перехода нет. Нужна публичная точка входа в `show(source)` (`:205`) с `{rect, poster, big}` от произвольного узла.

## G. Герой
- `30_css.js:243-249` `HERO_SIZES={large:1, medium:1.26, compact:1.54}`, default large. `:253-255` `heroCutEm(scale)=(1.2 + 19.4×scale)×heroFactor()`. `:1547` `.lumen-hero{top:-4em;height:calc(100vh − (heroCut+HERO_AIR)em)}`, `HERO_AIR=2.4`. `:1548` сжатый `calc(72vh − …)`, `HERO_COMPACT=.72`. `HERO_MIN_RATIO=220` `:343`.
- На 1920×1080 (em = 22.811): старт 555 px = 51.4 %; сжатый 385 px = 35.6 %. Геометрически половина уже есть, но: `:1600` нижняя вуаль гасит кадр с 50 % высоты (.18), на 14 % — .62, на 0 % — сплошной; `:1582` левая вуаль .94→.6→0 на 72 % ширины; **`:1554` `background-position: center top` при `cover` на блоке 3.46:1 показывает только верхнюю полосу кадра — небо вместо лиц.**
- Требование 2/3 (720 px) и 1/2 (540 px) конфликтует с тождеством «герой = экран − один ряд» (`:1516-1522`): ряд требует 23.1em = 527 px. Варианты: отвязать высоту героя от ряда (`66vh` + свой margin рядов, первый ряд заходит под прозрачный низ кадра); уменьшить карточки (противоречит «постеры больше»).
- Карточки: `:1959` `.lumen-main .card{width:10.08em}` = 230 px вместо штатных 12.75em (290 px). Постер — штатный `<img class="card__img">` без `object-fit` (`app.css:3103-3112`); пропорция 2:3 совпадает, кадрирования нет — «обрезано» относится к кадру героя, фону рулетки (`:2042` center) и плиткам.
- «Переход к подложке плавнее»: `:1600` крутой участок 14 %→50 %, сплошной нижний стоп, обрыв по `overflow:hidden` (`:1547`), дальше `background-color` (`:1545`).

## H. Рекомендации (ранжированы)
**Уровень 1 — функциональность:** (1) `scroll.minus()` в `create()` `46_hub.js:765, :1180`, `56_roulette.js:850`; (2) `scroll.update(node, true)` в `hover:focus` плиток `:634`, карточек сетки `:973`, чипов `:666, :1149`, элементов рулетки; (3) `Navigator.setCollection(nodes.slice(active−36, active+36))` вместо `collectionSet(root[0])` `:446, 526, 895`; (4) `navMove` `:422-432` — `canmove` возвращает элемент → `Navigator.focus(elem)` без второго `navigate`; (5) снимать `layer--render` с дальних карточек сетки (образец `app.min.js:53148-53156`).
**Уровень 2 — тормоза:** (6) не анимировать `height`/`margin-top` (`:1549, :1883, :1715, :1729, :1767`) — на `transform: translateY`; (7) `FAST_EXTRA` (`64_nav.js:79`) гейтить/снизить; (8) убрать тени коллажа `:1443`; (9) радиусы теней фокуса ≤ .8em и вне `transition` (`:754, :1438, :1475`); (10) маску `:1841-1842` → статичный оверлей; (11) `<img decoding="async">` вместо `background-image` в `paintCollage` `46_hub.js:538-552`; (12) коллаж 3×w342 → 1 картинка.
**Уровень 3 — пиксельность:** (13) DPR в `sizeFor`/`logoSizeFor` (`48_hero.js:297-305`), `46_hub.js:544, 971`, `56_roulette.js:679` — эталон `54_ambient.js:202-203`; (14) постеры рядов: w300 зашит в Lampa — либо переопределить `src`, либо вернуть карточке большую ширину.
**Уровень 4 — режим ТВ:** автодетект (`68_perf.js:215-241`) меряет только карточку; Android TV до вердикта — `full` (`81_prefs.js:43-50`). Явный режим: не грузить `52_fx`, `54_ambient`, `51_slideshow`, `67_transition`, `57_color`, `49_moods`; выключить кроссфейд/blur героя (`:1556, :1560`), Ken Burns (`:1348`), тени в transition, `backdrop-filter`, layout-анимации, `FAST_EXTRA`, мини-карту, автотрейлер (`48_hero.js:58`); оставить геометрию, кадр, карточки, метки, хаб/сетку. Расширить автодетект на первый кадр главной и хаба.

## I. Подкраска от карточки не работает на ТВ
Цепочка: `onFocus` `48_hero.js:1093` → `scheduleAccent` `:1078` (3000 мс `:51`) → `LC.accent.applyFor` `57_color.js:592` → `LC.color.fromImage` `:385` → `read()` `:361` → `apply()` `:568` → `LC.injectCss()` → `palette()` `30_css.js:127-184` → `LC.accent.tint` `:147-151` → `.lumen-main{background-color}` `:1545`.

1. **Выключена по умолчанию (высокая):** `81_prefs.js:106` `lumen_accent_auto default false`; `57_color.js:488-491`, комментарий `:455-457`. Проверка: `lumen_card.pref('lumen_accent_auto', false)`.
2. **CORS с прокси (высокая, если п.1 исключён):** `:414-415` `crossOrigin='anonymous'`, URL через `Lampa.TMDB.image('t/p/w185'+path)` `:540-549` — уважает прокси пользователя (`app.min.js:19740-19743`). Прокси без `Access-Control-Allow-Origin` → `onerror` `:411` → `done(null)` → молча; `cachePut(url, null)` `:406` запоминает провал. Комментарий `:357-360` описывает не тот сценарий. Проверка: `(function(){var u=Lampa.TMDB.image('t/p/w185/'+Lampa.Activity.active().card.poster_path);var i=new Image();i.crossOrigin='anonymous';i.onload=function(){console.log('OK',u)};i.onerror=function(){console.log('CORS FAIL',u)};i.src=u;})()`; косвенно `lumen_card.color.requests()` растёт при `lumen_card.accent.dominant()` null.
3. **Режим не `full` (средняя):** гейты `57_color.js:503` и `:620-626`; пороги `68_perf.js:47-48` (400/250), понижение сразу `:119`, повышение после 5 хороших `:55, :123`. Проверка: `lumen_card.motionMode()`, `Lampa.Storage.get('lumen_motion_auto')`.
4. **Нет `.lumen-main` на корне (средняя):** ставит только `LC.hero.mount` `48_hero.js:1212-1213`; при `lumen_hero_size==='off'` или после `detach` класса нет. Проверка: `document.querySelectorAll('.activity--active.lumen-main').length === 1`.
5. **Таймер сбрасывается повторными `onFocus` (низкая-средняя):** `card--loaded` от Lampa → мутация → `onFocus` → `stopTimer('accentTimer')` `:1079`. Проверка: стоять 4 с, `lumen_card.color.requests()` не растёт.
6. **Цвет неразличим (низкая):** сторож контраста `P.muted ≥ 4.5` (`30_css.js:149`), квантование 16, transition .6s. Проверка: `getComputedStyle(...).backgroundColor` до/после.

Независимо от гипотезы: в `57_color.js:411` (`onerror`) и `:375` (`catch`) добавить `warn` с URL.

## Ключевые файлы
- `src/30_css.js` — герой `1534-1734`, ряды `1812-1933`, хаб `1412-1497`, рулетка `2031-2082`, заставка `2084-2123`.
- `src/46_hub.js` — `476`, `836` (Scroll без `minus`), `444-468` (контроллер), `634`, `973` (`hover:focus` без `update`).
- `src/48_hero.js` — `1148-1157` (MutationObserver), `1093-1130` (горячий путь), `297-305` (размеры без DPR).
- `src/56_roulette.js` — `677-692`, `807-835`.
- `src/57_color.js` — `385-423`, `500-507`, `620-628`.
- `src/64_nav.js` — `79`, `544-548`. `src/68_perf.js` — `47-55`, `215-241`.
- `vendor/lampa/app.min.js` — `53107` (`scroll.update`), `53170` (`scroll.minus`), `53145-53160` (`limit()`: `layer--render` + `setCollection`), `46448-46456` (`collectionSet`), `31685-31695` (`layer--wheight`), `32232` (`minus`), `32130` (`update(elem, tocenter)`).
- `vendor/lampa/vender/navigator/navigator.js` — `217-281`, `732-770`.

# Производительность WebView на Android TV (MediaTek, 4×A55, ~2 ГБ) — ресёрч 2026-09-21

Внешний ресёрч (document-specialist, Opus) по заказу координатора после замера 21 fps на Philips 50PUS8057/60. Источники — код Chromium `main`, официальные доки, баг-трекеры; где данных нет — так и написано. Полный список ссылок в конце.

## 0. Какой у нас Chromium — снять первым

Philips на Android TV 11: легаси-WebView 2021/22 — `Chrome/77`; Google TV-платформы на той же ОС — System WebView из Play, легко `Chrome/125+`. Снимается из JS: `navigator.userAgent.match(/Chrome\/(\d+)/)[1]`, `/\bwv\b/.test(navigator.userAgent)`. При ≥123 доступен Long Animation Frames API; при 77 — нет `content-visibility`, `fetchpriority`. **Добавить мажор Chromium в HUD (Task 55).**

## 1. Память и растеризация

### 1.1 Бюджет tile memory — главная цифра
`layer_tree_settings.cc`, `GetGpuMemoryPolicy`: **Android, low-end или < 2000 MiB физической памяти → 96 МБ**, иначе 256. `sys_info.cc` предупреждает, что из-за carveout'ов Android `AmountOfTotalPhysicalMemory()` меньше номинала — 2 ГБ маркетинговых почти наверняка дают **96 МБ**. Плюс `kWebViewMemoryMultiplier` в WebView может срезать ещё (10-100 %, публичной документации нет).

Арифметика для 1920×1080 RGBA: полноэкранный слой **8.29 МБ**. Четыре `position:fixed; will-change:opacity` слоя фона Lampa = **33 МБ из 96** до первой карточки. Карточка 200×300 CSS → 400×600 device → **0.96 МБ на слой**; при 3 слоях × 12 видимых = ~35 МБ на один ряд. Бюджет кончается на первом-втором ряду.

### 1.2 Что происходит при переполнении
`TileManager` растеризует по приоритету; при исчерпании бюджета тайлы не растеризуются — в активном дереве дыры → **checkerboarding** (чёрные полосы). В `adb logcat` это `WARNING: tile memory limits exceeded, some content may not draw` — **единственный сигнал, доступный без DevTools**. Репорты с тем же симптомом: react-native-webview#2683, chromium 559665, 552398. Также `cc` умеет активировать дерево с low-res тайлами («мыло, потом резкость»); если чёрное — бюджет кончился совсем.

### 1.3 Тайлы и prepaint
Android: тайл 256 px, >16 тайлов на экран → 384, ≥40 → 512. Prepaint 67 % на low-end (растеризуется 1.67 экрана). `skewport_target_time` 1 с, `max_preraster_distance` 1000 px.

### 1.4 Discardable memory и кэш декодированных картинок
`discardable_shared_memory_manager.cc`: Android 128 МБ, low-end /8 = 16 МБ. Working set декода (`image_decode_cache_utils.cc`): low-end 32 МБ, WebView использует `kDefaultWorkingSet` (по внешним данным 128 МБ — не прочитано в файле напрямую). `gpu_image_decode_cache.cc`: если картинка не влезает в бюджет — **at-raster decode**: декодирование синхронно внутри растр-задачи, тайл за тайлом. **Это и есть «кадр рисуется частями»**: 31-МБ `original` не влез, декодируется по ходу растеризации. Вытесненные по LRU картинки при возврате в кадр декодируются заново — сотни мс A55 на 8-мегапиксельный JPEG.

### 1.5 Размер изображений
| Что | device px | Мпикс | RGBA |
|---|---|---|---|
| Полный экран | 1920×1080 | 2.07 | 8.3 МБ |
| Герой 2/3 | 1920×720 | 1.38 | 5.5 МБ |
| TMDB `w1280` | 1280×720 | 0.92 | 3.7 МБ |
| TMDB `original` | 3840×2160 | 8.3 | **33.2 МБ** |

**Потолок для полноэкранного фона на таком железе — ~2 Мпикс, рабочий 1.0-1.4.** Netflix: 3.5 МБ на 1280×720, surface cache устройств 20-96 МБ, на 28 МБ помещается ~8 полноэкранных картинок. Меньший JPEG + растяжение — детерминированно; scaled decode libjpeg-turbo (partial IDCT) существует, но полагаться на него нельзя (целевой размер на старте декода может быть неизвестен; трафик и парсинг остаются). `image-rendering` на объём декода не влияет.

### 1.6 GPU-растеризация на Mali в WebView
Включена по умолчанию (allow-list — все Android 4.4+; в WebView и для документов без viewport-меты). Блоклист в WebView работает иначе, чем в Chrome (android-webview-dev, баг 40409991); записей про Mali-G52/G57 не найдено. Проверка — только через WebView DevTools флаг `DISABLE_GPU_RASTERIZATION`. Из JS GPU-raster не определить; сам GPU — `WEBGL_debug_renderer_info`.

## 2. Слои

### 2.1 Лимит — в байтах, не в штуках
Публичных замеров «N слоёв на Mali-G52» нет; жёсткого `kMaxLayerCount` в `cc` нет. Рабочая метрика: **сумма площадей промоутнутых слоёв × 4 байта против 96 МБ**. web.dev: «on devices with limited memory the impact on performance can far outweigh any benefit of creating a layer»; композитинг ≤ 4-5 мс на кадр.

### 2.2 Переопределение хостового `will-change`
`will-change:auto` в нашем CSS снимает промоушен — законно. Последствия: промоушен на лету стоит commit'а — «поставил `will-change` и стартовал transition в том же кадре» даёт первый кадр без слоя («pop»). Фольклор (не подтверждено ссылкой): при промоушене без непрозрачного фона Chromium отключает subpixel-AA текста — текст «худеет» на миг; проверить на устройстве. Практика TV: `will-change:transform` только на контейнере ряда, который едет; на карточки — `contain`, не слой.

### 2.3 `contain` / `content-visibility`
`contain: layout paint` — Chrome 52+, безопасно при фиксированных размерах; `contain: size` без явных размеров схлопывает элемент. `content-visibility: auto` (Chrome 85+) на рядах с D-pad-фокусом **не брать**: `getBoundingClientRect` на скрытом содержимом даёт мусор, `scrollIntoView` на потомках — дыра в спецификации (csswg#9337), `contain-intrinsic-size: auto` на мобильном Chromium схлопывал скролл-диапазон, в 85-89 выпадало из a11y-дерева.

## 3. Виртуализация и DOM
- Netflix (2017, железо того же класса): Virtual List с переиспользованием DOM, 60 fps через делегирование скролла браузеру, фичи включаются по объёму surface cache. Потолок DOM — они ушли в свой рендерер Gibbon.
- Пульт даёт **15-30 нажатий/с** (33-66 мс между событиями при кадре 16.6). Практика: контейнер через `translate3d`, **одна** движущаяся фокус-рамка, геометрия кэшируется при инициализации, позиция фокуса — арифметикой, не `getBoundingClientRect` на нажатие. Виртуальные списки держат ~20-30 узлов; recalc по 10 000 узлов на mid-range Android — ~180 мс/кадр.
- Jellyfin-web: полноценной горизонтальной виртуализации нет, только scroll-менеджер; jellyfin-vue обсуждал DOM-recycling + IntersectionObserver. Plex/YouTube TV/Kodi — открытых данных нет.
- «Слой на карточку» vs «слой на ряд»: 36 слоёв/35 МБ против 1 слоя/4.8 МБ на ряд — **~7×**; минус — подсветка фокуса не-композитным свойством перерастеризует весь ряд → фокус-эффект отдельным оверлеем на `transform`.

## 4. Изображения
- `img.decode()` — Chrome 64+; промис резолвится, когда картинку можно вставить без синхронного декода. Реджект: битые данные, упавший запрос, **смена `src` после вызова** (главный источник ошибок в каруселях) — всегда `catch`. Специфичных багов WebView не найдено.
- `<img>` vs `background-image`: в растр-пути разницы нет (один `ImageDecodeCache`), но у фона нет `decoding`, `loading`, `fetchpriority`, `decode()`, `srcset`, событий `load/error`, и запрос стартует позже (после layout). **Герой — только `<img>`.**
- TMDB отдаёт JPEG; планов на WebP/AVIF нет (форум); одна ветка утверждает, что CDN отдаёт WebP по `Accept` — проверено координатором отдельно (см. ниже). Маппинг при 960@2: герой → `w1280` один в один; постер 200 CSS → `w342`/`w500`. `srcset` при фиксированном DPR ничего не даёт — выбирать URL в JS.
- LQIP: под героем держать декодированный `w300` (0.05 Мпикс), поверх по `decode()` проявлять `w1280`. `filter: blur()` — только статикой, не в анимации; альтернатива — blurhash в canvas (единицы мс на A55).

## 5. Измерение без DevTools
| API | Статус | Польза |
|---|---|---|
| `performance.memory` | **сломан в WebView**: константа `usedJSHeapSize = 10000000` (mdn/bcd#16560) | нулевая |
| `navigator.deviceMemory` | есть, округление до степени 2 | гейт low-end |
| `PerformanceObserver('longtask')` | Chrome 58+ | задачи > 50 мс |
| `PerformanceObserver('long-animation-frame')` | **Chrome 123+** | лучший инструмент: `renderStart`, `styleAndLayoutStart`, `blockingDuration`, атрибуция скриптов |
| `'event'`/`'element'`/`'paint'` | есть | задержка key-событий, момент появления героя (`elementtiming`) |
| `measureUserAgentSpecificMemory` | нужен `crossOriginIsolated` | в Lampa нереализуемо |

FPS: считать **гистограмму дельт rAF**, не среднее — пики на 33/50 мс = GPU-bound, вставания на 200 мс = декод/layout/JS. Checkerboarding из JS не виден — только `adb logcat | grep -i "tile memory"`; комбинация «дельты 16-20 мс, но чёрные полосы» = растеризация не успевает, main thread ни при чём.

Remote debugging: `setWebContentsDebuggingEnabled(true)` должно вызвать приложение-хост; device-wide переключателя нет. Рабочий путь — свой минимальный APK-контейнер с WebView и тем же URL → `chrome://inspect`. **WebView DevTools** работает на user-build без root: `adb shell am start -a "com.android.webview.SHOW_DEV_UI"` → Flags: `SHOW_COMPOSITED_LAYER_BORDERS` (границы слоёв прямо на ТВ), `DISABLE_GPU_RASTERIZATION`, `WEBVIEW_SURFACE_CONTROL`, **`WEBVIEW_SURFACE_CONTROL_FOR_TV`**. Командная строка (`--force-gpu-mem-available-mb`) — только userdebug/eng, на Philips `user` — закрыто.

## 6. Известные проблемы WebView на TV
Подтверждено: checkerboard/пустые области при скролле (chromium 552398, 559665, rn-webview#2683); отдельная TV-ветка SurfaceControl в WebView (флаг `_FOR_TV`); WebView не блокирует GPU-фичи как Chrome; известная проблема разрешения WebView на Android TV (android-webview-dev «Adjust the real webview resolution for Android TV»).
**Не подтверждено:** лок WebView на 30 fps на Android TV — нет ни бага, ни доки; 21 fps — не делитель 60, это честная перегрузка (~47 мс/кадр). Специфичных багов MT9602+WebView нет; `SurfaceView` vs `TextureView` к WebView не относится (draw functor / SurfaceControl).

## Топ-10 для нашего случая
0. (Вне рейтинга) Рендер в 960×540@1 вместо @2 — 4× меньше растра. **Не наш рычаг:** DPR задаёт WebView/система, растр 1080p — минимум для 4K-панели; из страницы ниже 1080p не опуститься.
1. **Герой `w1280`, не `original`** — 33 → 3.7 МБ, убирает at-raster decode. (Task 47)
2. **Снять хостовые слои с карточек** (`will-change:auto`, `translateZ` → none), один слой на ряд; до/после смотреть через `SHOW_COMPOSITED_LAYER_BORDERS`. (Task 48)
3. **Погасить четыре полноэкранных слоя фона Lampa** под главной — треть бюджета. (Task 49)
4. **Виртуализация рядов до ~20-30 узлов на ряд** — 200+ карточек в DOM это и память, и style recalc, и hit-testing на нажатие. (новая задача, после замера волны 1)
5. `decoding="async"` везде + `await img.decode()` перед показом героя. (Task 47)
6. Геометрия рядов — кэш один раз, фокус арифметикой; свой `transform`-скролл вместо `scrollIntoView`. (Lampa `Scroll`/`Navigator` — исследовать, что перехватываемо)
7. Троттлинг key-repeat до одного шага на кадр через `requestAnimationFrame`-гейт. (исследовать `64_nav.js`)
8. `contain: layout paint` на карточках с фиксированными размерами. (в Task 48)
9. Флаги `WEBVIEW_SURFACE_CONTROL(_FOR_TV)` через WebView DevTools — нулевая цена, замерить. (чек-лист ТВ, если у пользователя есть adb)
10. Телеметрия: гистограмма rAF-дельт + LoAF при ≥123 + `adb logcat "tile memory"`. (Task 55)

## Что НЕ делать
`performance.memory`; `content-visibility:auto` на рядах с фокусом; `contain:size` без размеров; `--force-gpu-mem-available-mb` (недоступно и вредно); `will-change` «на всякий случай»; `will-change` + анимация в одном кадре; анимировать `filter/box-shadow/border-radius`; `image-rendering:pixelated` на фото; перекодировать картинки на устройстве; `requestIdleCallback` при key-repeat (idle не наступает); `getBoundingClientRect` в обработчике клавиш; «чинить» 21 fps понижением частоты анимаций — это симптом памяти, а не анимаций.

## Чего ресёрч не нашёл
Замеров слоёв на Mali-G52; подтверждения 30-fps-лока; Mali в блоклисте; багов `decode()` в WebView; точного `kDefaultWorkingSet`; практик Plex/YouTube TV/Kodi; проверки WebP на TMDB (см. отдельный замер координатора).

## Источники
- layer_tree_settings.cc (GetGpuMemoryPolicy, tile size, prepaint, kWebViewMemoryMultiplier): https://chromium.googlesource.com/chromium/src/+/main/third_party/blink/renderer/platform/widget/compositing/layer_tree_settings.cc
- cc/trees/layer_tree_settings.h · cc/tiles/gpu_image_decode_cache.cc (at-raster decode) · cc/tiles/image_decode_cache_utils.cc · components/discardable_memory/service/discardable_shared_memory_manager.cc · base/system/sys_info.cc — https://chromium.googlesource.com/chromium/src/+/main/
- docs/how_cc_works.md — https://chromium.googlesource.com/chromium/src/+/main/docs/how_cc_works.md
- android_webview/docs: commandline-flags.md, developer-ui.md, webview-shell.md; ProductionSupportedFlagList.java
- How to get GPU Rasterization — https://www.chromium.org/developers/design-documents/chromium-graphics/how-to-get-gpu-rasterization/
- Remote debugging WebViews — https://developer.chrome.com/docs/devtools/remote-debugging/webviews
- Long Animation Frames API — https://developer.chrome.com/docs/web-platform/long-animation-frames
- web.dev Manage Layer Count — https://web.dev/articles/stick-to-compositor-only-properties-and-manage-layer-count
- MDN: will-change, contain, HTMLImageElement.decode, Navigator.deviceMemory, WEBGL_debug_renderer_info
- Netflix TechBlog — https://netflixtechblog.com/crafting-a-high-performance-tv-user-interface-using-react-3350e5a6ad3b
- TO THE NEW — https://www.tothenew.com/blog/optimizing-performance-in-smarttv-html-tv-apps · dev.to — https://dev.to/vanyaxk/handling-performance-issues-in-smart-tv-javascript-applications-25g1
- jellyfin-vue#274, jellyfin-web#680, jellyquest-tizen#21
- react-native-webview#2683 · chromium 552398 · chromium 559665
- android-webview-dev: «Adjust the real webview resolution for Android TV», «Sluggish GPU performance»; баг 40409991
- mdn/browser-compat-data#16560 (performance.memory в WebView)
- csswg-drafts#9337 · nyk.dev content-visibility intrinsic size · New in Chrome 85 · Marcy Sutton content-visibility a11y
- TMDB talk: Image sizes; WebP/AVIF планов нет; guillaumetech JPEG scaling in Chrome
- UA Philips Google TV TA7 (Android 11 + Chrome/125 wv) — user-agents.net

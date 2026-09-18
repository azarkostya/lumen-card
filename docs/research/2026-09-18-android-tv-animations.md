# Плавные анимации на Android TV WebView — ресёрч (2026-09-18)

Источник: внешний ресёрч (Opus, document-specialist) по запросу координатора после первой проверки Lumen Card на реальном 4K Android TV. Сжатая выжимка; ссылки в конце.

Ключевой контекст: Android TV WebView почти всегда растеризует в 1920×1080 при `devicePixelRatio = 1` даже на 4K-панели (4K-масштабирование делает сам ТВ/SurfaceFlinger). На части устройств `innerWidth = 1920` при DPR 2 (тогда физически 3840). Значит «пиксельность» — либо мелкий исходник TMDB под DPR 2, либо растяжение растра слоя через `transform: scale()`. «Сетка не двигается вообще» — почти наверняка длинная задача в `keydown` (JS блокирует поток) плюс перерасчёт лейаута на каждое нажатие, а не анимация.

## 1. Композитные свойства

- В анимациях только `transform` и `opacity` — они идут на стадии Composite, не трогают Layout/Paint. Эффект: высокий.
- `width/height/top/left/margin/font-size` → Layout всего поддерева + Paint + Composite на каждый кадр. `box-shadow/filter/backdrop-filter/border-radius` → Paint на каждый кадр.
- Фокус карточки — только `scale`; не анимировать `box-shadow`. Lampa при `body.advanced--animation` навязывает свои keyframes — гасить `animation: none !important`.
- «Сжатие героя» без перекладки: герой фиксированной высоты, сжатие = `translate3d` героя вверх + `translate3d` контейнера рядов вверх на ту же дельту + `opacity` текста. `transform-origin: top`. Ещё проще — герой не сжимается, а уезжает вверх целиком под `overflow:hidden` родителя: на ТВ выглядит так же, стоит ноль.

## 2. Дорогие эффекты — что нельзя на TV

| Эффект | Вердикт | Замена |
|---|---|---|
| `backdrop-filter: blur()` | запрещено | заранее размытый слой + `opacity` |
| `filter: blur()` на живом узле | запрещено | то же |
| `box-shadow` радиус > 20px на многих узлах | запрещено в анимации | статичный псевдоэлемент с `radial-gradient` / PNG |
| `mix-blend-mode` | запрещено | сведённый градиент |
| `mask-image` | только статично | `linear-gradient` оверлей |
| `text-shadow` на сотнях подписей | плохо | подложка под текстом |
| градиент с alpha поверх 1920×1080 | ок, если статичен | вшить в JPEG |
| `opacity` на большом composited-слое | дёшево | — |

`backdrop-filter` читает пиксели под элементом каждый кадр; полноэкранная панель с blur 40px на S905 — гарантированный фриз. Свечение фокуса — не `box-shadow: 0 0 60px`, а псевдоэлемент с `radial-gradient` (Paint один раз).

## 3. Слои композитинга

- Один полноэкранный слой 1920×1080×4 ≈ 8 МБ GPU-памяти. При переполнении бюджета Chromium падает в software-растеризацию — и «тормозит всё».
- Бюджет: ≤ 10-15 composited-слоёв. Не ставить `will-change`/`translateZ(0)` на каждую карточку (layer explosion).
- `will-change` ставить перед движением и снимать в `transitionend`. В WebView 70-80 `translateZ(0)` работает предсказуемее, точечно на контейнер ряда.
- Смотреть слои: `adb connect <ip>:5555` → `chrome://inspect` → DevTools → Layers; Rendering → Layer borders / Paint flashing / FPS meter.

## 4. Изображения

- TMDB: постеры w92/w154/w185/w342/w500/w780/original; backdrops w300/w780/w1280/original. Карточка 230-290 CSS px при DPR 1 → `w342`; при DPR 2 → `w500`. Фон 1920 → `w1280` (при DPR 2 — `original`, иначе никогда).
- `scale()` размывает: слой растеризован в масштабе на момент создания растра. Лечение: растеризовать в конечном масштабе (держать элемент ×1.08 и в покое `scale(.93)`) либо `will-change: transform` до старта анимации.
- Декод крупного JPEG на слабом CPU — 30-120 мс на главном потоке: `img.decoding = 'async'` (Chrome 65+), `img.decode()` (64+) перед вставкой в DOM. `loading="lazy"` только с Chrome 77+ — свой лентяй через `IntersectionObserver` (51+).
- В DOM держать ~24-30 постеров (видимые + экран запаса), остальное выгружать.

## 5. Canvas и бесконечные `@keyframes`

- Полноэкранный canvas частиц на TV — выключить по умолчанию.
- Бесконечные keyframes не бесплатны даже на transform/opacity: композитор не уходит в idle.
- `prefers-reduced-motion` на TV не работает — свой детектор: замер частоты rAF за ~40 кадров **во время реальной прокрутки** + `hardwareConcurrency`/`deviceMemory`, результат в Storage, три профиля.
- Пауза невидимого: `.lumen-paused *{animation-play-state:paused!important}`, canvas-цикл — флаг без планирования следующего кадра.

## 6. JS: главный поток

- Обработчик пульта < 8 мс: движение фокуса = только классы + transform; всё тяжёлое — в `setTimeout` после кадра.
- Key repeat: пока интервал между нажатиями < ~180 мс — не грузить картинки, не трогать фон; при паузе догрузить видимое. Так делают Netflix/Plex.
- Layout thrashing: `getBoundingClientRect`/`offsetHeight` после записи стиля форсируют Layout. Разделять фазы READ → rAF → WRITE; лучше не мерить вовсе (позиции в сетке детерминированы).
- `MutationObserver` на `body` с `subtree` — убрать; вешать на контейнер активности, `childList` без `attributes`.
- `mousemove`/`scroll` — троттлить через rAF; фокус-эффекты — дебаунс 250-400 мс.

## 7. Измерение на реальном ТВ

- adb + `chrome://inspect` → Performance panel (Frames, Main, Summary).
- FPS-оверлей без DevTools (обязателен, adb не всегда доступен):

```js
var f = 0, last = performance.now(), box = document.createElement('div');
box.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;background:#000;color:#0f0;font:14px monospace;padding:4px';
document.body.appendChild(box);
(function loop(t) { f++; if (t - last >= 1000) { box.textContent = f + ' fps'; f = 0; last = t; } requestAnimationFrame(loop); })(performance.now());
```

- Long tasks (Chrome 58+): `PerformanceObserver.supportedEntryTypes.indexOf('longtask') > -1` → `observe({entryTypes:['longtask']})`, вывод на экран.
- Ручной замер: `performance.now()` вокруг обработчика пульта и билда карточек, лог при > 8 мс.

## 8. Шрифты

- `-webkit-font-smoothing: antialiased` на TV не ускоряет и делает текст тоньше — не использовать.
- `text-rendering: optimizeLegibility` замедляет Paint длинных списков — убрать.
- Веб-шрифты: один файл woff2, начертания 400/700, `font-display: swap`.
- `text-shadow` на подписях карточек удорожает Paint — подложка вместо тени.

## 9. Особенности Android TV WebView

- Рендер 1920×1080 (иногда 960×540 при DPR 2). Проверять `innerWidth`/`devicePixelRatio` на месте.
- GPU-растеризация отключена на части SoC (чёрные списки Chromium, `--disable-gpu`). Признак: Paint flashing мигает всегда. В этом режиме любой blur/тень фатальны.
- Chromium 70-110: `contain` есть (52+); `content-visibility` нет ниже 85; `IntersectionObserver` есть; `loading=lazy` 77+; `backdrop-filter` 76+; `image-rendering` есть, для фото вредно.
- Дешёвое: `.lumen-row{contain:layout paint}`, `backface-visibility:hidden` только при мерцании.

## 10. Практика TV-интерфейсов (Netflix/YouTube/Plex)

- Фокус — один composited-слой, `scale(1.0→1.1)` за 150-200 мс ease-out, без теней в анимации.
- Виртуализация: в DOM текущий ряд ±1-2; соседи `visibility: hidden` (лейаут и слой сохранены), дальние — из DOM.
- Плейсхолдер (доминирующий цвет) → картинка с `decode()` → кросс-фейд 150 мс. Никогда не вставлять 40 `<img>` разом.
- Backdrop меняется через 400 мс после остановки фокуса, кросс-фейдом двух слоёв, без blur в рантайме.

## Сводная таблица

| Приём | Эффект | Сложность |
|---|---|---|
| Только transform/opacity в анимациях | высокий | низкая |
| Убрать backdrop-filter / filter: blur | высокий | низкая |
| Отложенная загрузка картинок при key repeat | высокий | средняя |
| Герой-сжатие через transform вместо height | высокий | средняя |
| Ограничить число слоёв, снимать will-change | высокий | средняя |
| Виртуализация рядов | высокий | высокая |
| Правильный размер TMDB (w342 / w1280, DPR) | высокий | низкая |
| `decoding=async` + `img.decode()` | средне-высокий | низкая |
| Перф-профили по FPS-детектору | высокий | средняя |
| Убрать box-shadow/text-shadow из анимаций | средний | низкая |
| `contain: layout paint` на рядах | средний | низкая |
| Пауза анимаций вне экрана | средний | низкая |
| Батчинг чтений/записей лейаута | средний | средняя |
| Сузить MutationObserver | средний | низкая |
| Canvas-частицы off на TV | средний | низкая |

## Топ-10 для слабого Android TV

1. Измерить: FPS-оверлей + longtask-лог на экране ТВ.
2. Убрать из рантайма `backdrop-filter`/`filter: blur`.
3. Обработчик `keydown` < 8 мс.
4. Не грузить картинки при быстром листании.
5. Анимации фокуса и сжатия героя — только transform/opacity.
6. TMDB `w342`/`w1280` с учётом DPR; `original` — никогда при DPR 1.
7. Composited-слои ≤ 10-15; `will-change` по событию.
8. ≤ 30 постеров в DOM, дальние ряды `visibility: hidden`.
9. Профили full/lite/off по детектору + ручной переключатель.
10. Тени и градиенты — статичные; затемнение — в подложке.

## Источники

- https://web.dev/articles/animations-guide
- https://web.dev/articles/animations-overview
- https://web.dev/articles/speed-layers
- https://www.chromium.org/developers/design-documents/gpu-accelerated-compositing-in-chrome/
- https://developer.chrome.com/articles/renderingng-architecture
- https://blog.hao.dev/improving-css-performance-of-cordova-apps-on-android-tvs/
- https://dev.to/vanyaxk/handling-performance-issues-in-smart-tv-javascript-applications-25g1
- https://www.oxagile.com/article/optimize-tizen-tv-app-performance/
- https://www.wiztivi.com/blog/smart-tv-app-development-performance-tips
- https://netflixtechblog.com/crafting-a-high-performance-tv-user-interface-using-react-3350e5a6ad3b
- https://support.google.com/androidtv/thread/218276021
- https://forum.ionicframework.com/t/android-tv-webview-resolution-seems-to-be-1-2-hd-960x540-for-all-devices-hd-4k-8k/246839
- https://developer.android.com/develop/ui/views/layout/webapps/targeting
- https://developer.themoviedb.org/docs/image-basics
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLImageElement/decoding
- https://web.dev/articles/browser-level-image-lazy-loading
- https://caniuse.com/css-containment
- https://caniuse.com/css-content-visibility
- https://developer.mozilla.org/en-US/docs/Web/API/PerformanceLongTaskTiming

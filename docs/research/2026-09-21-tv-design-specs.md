# Спецификации TV-интерфейсов: Apple tvOS, Android TV, Fire TV, Microsoft, W3C — ресёрч 2026-09-21

Внешний ресёрч (document-specialist, Opus, два подзапроса) по заказу координатора: числа, которые можно перенести в CSS Lumen Card (1080p, база em = 22.8 px, em = px ÷ 22.8). Только первоисточники; где числа нет — так и написано. **Netflix / Disney+ — данных нет**: они спецификаций не публикуют, возможны только измерения по кадрам (не заказывали).

## 0. Правило перевода единиц
- tvOS: pt = px на 1920×1080 (спецификации «@1x»).
- Android TV / Fire TV / Xbox: макет 960×540 dp/epx, **1 dp = 2 физических px** на 1080p (Fire TV: 320 dpi, «output resolution 960x540dp»; Microsoft: масштаб 200 %). Утверждение «1 dp = 1 px на 1080p» неверно.
- W3C reference pixel на 3 м ≈ 1.1 мм ≈ 1.9 физ. px 50″-панели → корректный масштаб «как web с 71 см» на ТВ — ×2. Отсюда все три вендора сходятся на минимуме тела текста **28-30 px**.

## 1. Apple tvOS HIG

### Safe area
Основной контент: **60 pt сверху/снизу, 80 pt по бокам** (2.63em / 3.51em). Фон — до краёв (`ignoresSafeArea`), полки — по safe area. Google/Amazon: 48/27 dp = 96/54 px (5 %); Microsoft: 48/27 epx = 96/54 px. Apple закладывает больший запас по вертикали (60 против 54) и меньший по бокам (80 против 96).

### Типографика tvOS (официальная таблица)
| Стиль | Вес | px | leading | line-height | em |
|---|---|---|---|---|---|
| Title 1 | Medium | 76 | 96 | 1.26 | 3.33 |
| Title 2 | Medium | 57 | 66 | 1.16 | 2.50 |
| Title 3 | Medium | 48 | 56 | 1.17 | 2.11 |
| Headline | Medium | 38 | 46 | 1.21 | 1.67 |
| Subtitle 1 | Regular | 38 | 46 | 1.21 | 1.67 |
| Callout | Medium | 31 | 38 | 1.23 | 1.36 |
| Body | Medium | 29 | 36 | 1.24 | 1.27 |
| Caption 1 | Medium | 25 | 32 | 1.28 | 1.10 |
| Caption 2 | Medium | 23 | 30 | 1.30 | 1.01 |

**Дефолт 29 px, минимум 23 px (1.01em).** Дефолтный вес — **Medium**, light-начертания запрещены. Tracking на ТВ **положительный или ноль**: 23 pt −0.004em, 25 +0.006, 29 +0.014, 38 +0.010, 48 +0.008, 57 +0.005, 76 +0.001, ≥80 → 0. Отрицательный трекинг на крупных заголовках (наш −0.02em на 3.2em) — против системной шкалы. Цвета текста для tvOS Apple числами не публикует; сторонний ориентир тёмной темы: label 100 % белого, secondary `rgba(235,235,245,.6)`, tertiary .3, фон `#000` / `#1C1C1E`.

### Фокус
HIG процентов не даёт («rely on system-provided focus effects»), но из пар focused/unfocused в спецификации Top Shelf: 16:9 — **×1.089**, постер 2:3 и квадрат — **×1.14**, inset banner ×1.107. «Avoid using only color to indicate focus. Subtle scaling and responsive animation are the primary ways». Lockup при фокусе: картинка приподнимается, **подпись уезжает вниз**, заголовок полки тоже уступает; тень — «slight drop shadow», клиппинг скролла отключают, чтобы тень и выросшая плитка не резались. Параллакс: «designed to be almost unnoticeable» — первый кандидат на выключение. Motion: «avoid adding motion to UI interactions that occur frequently».

Android (androidx.tv.material3, код): `focusedScale` **1.1** у Card/Button/Surface, **1.05** у ListItem; border 3 dp Card / 2 ListItem / 1.5 Button; glow по умолчанию **None**; длительности **300 мс вход / 500 мс выход / 120 нажатие**, easing `cubic-bezier(0,0,.2,1)` (decelerate). Leanback: zoom xsmall 1.06 / small 1.10 / medium 1.14 / large 1.18.

### Сетки и полки (HIG Layout → Grids; горизонтальный зазор 40 px, вертикальный минимум 100 px)
| Колонок | Ширина плитки px | em |
|---|---|---|
| 4 | 410 | 17.98 |
| 5 | 320 | 14.04 |
| **6** | **260** | **11.40** |
| **7** | **217** | **9.52** |
| 8 | 184 | 8.07 |

Проверка: 6×260 + 5×40 = 1760 = 1920 − 2×80. Постер 2:3 в 6 колонок — **260×390 px = 11.40×17.11em** (ровно наш `ROW_CARD_W = 11.4`). Зазор между плитками **40 px = 1.75em** (у нас ~33 px). Между рядами **≥ 100 px = 4.39em**, для рядов с заголовком — больше (числа нет). Следующая плитка обязана «подглядывать» с края, симметрично. Подпись под lockup — **всегда**, при фокусе смещается. Google: карточки 844/412/268/196/124 dp при зазоре 20 dp (40 px), скругление 8 dp = 16 px; Leanback: карточка 140×188 dp, зазор 8 dp, ряд 224 dp.

### Герой / Top Shelf
Верх — промо до краёв, ниже полки; композиция — заголовок + пара кнопок с воздухом; вуаль — **линейный градиент-маска по изображению**; при уходе фокуса вниз фон **убирается полностью**. Карусель 3-8 элементов. Проектная дистанция «8 футов и больше».

### Цвет, скругления, кнопки
«Limited color palette… deferring to the content». Радиусов в HIG нет (только «gently rounded corners»; Android — 16 px). Кнопки tvOS: platter, который **lifts and changes color when focused** — инверсия при фокусе системна.

## 2. Android TV / Fire TV / Microsoft / W3C — сводная таблица для 1080p
| Что | dp | px | Источник |
|---|---|---|---|
| Overscan-safe поля | 48 / 27 | 96 / 54 | Google, Amazon (5 %), Microsoft |
| Боковые поля контентной сетки | 58 | 116 | Google Layouts |
| Колонка / gutter | 52 / 20 | 104 / 40 | Google |
| Зазор между карточками | 20 | 40 | Google Cards |
| Скругление карточки | 8 | 16 | AOSP CardDefaults |
| Focus scale | 1.1 (карточка/кнопка), 1.05 (list item) | — | AOSP |
| Анимация фокуса | 300 / 500 / 120 мс | — | AOSP SurfaceScaleTokens |
| Минимум body-текста | 14 sp | **28** | Amazon; Microsoft 15 epx = 30 |
| Минимум второстепенного | 12 epx | **24** | Microsoft |
| Мин. высота интерактивного элемента | 32 epx | 64 | Microsoft; ListItem 48 dp |
| Контраст | — | 4.5:1 (3:1 для ≥24 px / 18.5 px bold) | WCAG 2.2 |
| Навигация | ≤ 6 шагов через экран | — | Microsoft |
| TV-safe цвета | RGB 16-235 | — | Microsoft |

Compose for TV TypeScale (sp → px ×2): Display 57/45/36, Headline 32/28/24, Title 22/16/14, Body 16/14/12, Label 14/12/11 → body medium 28 px. Google TV: число рядов/карточек на экране не документировано; типографика — только в Figma-ките.

## 2а. Netflix, Disney+, Prime Video, Roku — что задокументировано (третий подзапрос)
Легенда: [Д] — вендор, [Н] — наблюдение третьей стороны, [?] — числа нет.
- **Netflix, плиток в ряду на ТВ:** [Н] шесть до редизайна 2025, четыре после (плитки «раздуваются» при фокусе) — TechRadar. [Д] Пользователь просматривает 10-20 тайтлов на одном-двух экранах за 60-90 с (Gomez-Uribe & Hunt). Ширина/гэпы/scale — [?].
- **Netflix, артворк:** [Д] партнёрская система UBA — один гибкий шаблон под все канвасы; title treatment — отдельный прозрачный PNG ≥ 2500 px. [Н, измерено по web] боксарт строго 16:9 (912×513, 800×450, 1200×675…), герой 2.18:1. Подтверждения 2:3 на ТВ — нет.
- **Netflix, автоплей:** [Д] переключатель автопревью есть, задержка не указана; [Н] «after a few seconds». Новый TV-UI 2025: карусель сверху, навигация вверху, синопсис/хронометраж/Top-10 «up-front while you browse»; первая плитка ряда сама играет превью. Что происходит с текстом при старте видео — [?].
- **Netflix, бейджи:** [Д] «Top 10» — бейдж **на артворке** везде, где встречается тайтл; ряды «New & Popular», «New on Netflix»; «Coming Soon» + «Remind me». «New Episode» — на артворке или под ним — [?].
- **Netflix, Continue Watching:** [Д] ряд живёт в «My Netflix», удаление через страницу тайтла; [Н] прогресс — красная полоса по низу обложки; толщина/цвет/позиция — [?].
- **Netflix, ряды:** [Д] «число рядов, длина ряда и размер видимой части — параметры устройства», единого числа нет; сканирование идёт «сверху-слева, чаще вертикально». Netflix TechBlog 2013: полноэкранная сцена 1080p = 8 МБ, 720p = 3.5 МБ, встречаются устройства с 20 МБ кэша рендера.
- **Disney+:** [Д] hero-карусель с видео, «более кинематографичный артворк в стиле постеров» (движение от 16:9 к 2:3), бейджи «Season Finales», «New Series», «New Movies». Числа — [?].
- **Prime Video:** [Д] cover 16:9 и poster 2:3 с обязательным title treatment, hero 16:9, фон 1920×1080; на карточке — кнопка play (one-click), метка подписки «синяя галочка».
- **Roku:** [Д] safe area ≥ 5 % = 90 px по бокам, 60 сверху/снизу; title safe 1534×866 (80 %), action safe 1726×970 (90 %).
- **Smashing Magazine «Designing for TV» (2025), сторонний:** базовый кегль на ТВ от **24 px**, 12 колонок с полями 80 px.
- **Compose for TV (Google):** `focusedScale` 1.1, рамка фокуса 2 dp; пример состояний в доке — 1.2 focused / 0.8 pressed (пример, не дефолт).
- **Не найдено ни в одном источнике:** px-теардаунов Netflix/Disney+; длительностей их анимаций; задержки автоплея в секундах; сколько рядов видно на 1080p и на сколько «выглядывает» следующий.

## 3. Что «дорого» для восприятия (по формулировкам Apple)
Текст на изображении без вуали; декоративные плотные градиенты (у Apple градиент — маска изображения); подписи < 23 px и light-начертания; несколько носителей фокуса разом (кольцо + рамка + цвет); заметный параллакс/3D; анимация частых действий; ряд, обрезанный встык без «подглядывания»; несколько гарнитур.

## 4. Десять правок для Lumen Card (em = px ÷ 22.8; «сейчас» — из `src/30_css.js` на 2026-09-21)
| # | Правка | Сейчас | Стало | Основание |
|---|---|---|---|---|
| 1 | Подписи ≥ минимума tvOS | `.card__title` .96em = 21.9 px, `.card__age` .88em = 20 px, чипы .79em = 18, счётчики .70em = 16, лейблы .66/.61em = 15/14 | **≥ 1.01em (23 px)**; мета героя — 1.27em (29 px) | tvOS min 23 / default 29; Amazon 28; Microsoft 30/24 |
| 2 | Safe area | `2.81em` = 64 px по бокам | **3.51em (80 px)** бока, **2.63em (60 px)** верх/низ | HIG Layout |
| 3 | Ряд постеров по сетке | ширина 11.4em (= 6 колонок Apple), зазор ~33 px | 6 колонок: 11.40em + зазор **1.75em (40 px)**; или 7 колонок: **9.52em** + 1.75em | HIG Grids; 7×217+6×40 = 1759 |
| 4 | Вертикальный зазор между рядами | — | **≥ 4.39em (100 px)**, с заголовком больше | HIG Layout |
| 5 | Заголовок карточки — Title 1 | 3.2em / lh 1.02 | **3.33em (76 px) / lh 1.26** | HIG Typography |
| 6 | Трекинг заголовка | −.02em | **0…+0.001em** | tvOS tracking values |
| 7 | Описание — Body | 1.05em (24 px) / 1.45 | **1.27em (29 px) / 1.24** | HIG; Samsung 1.2-1.4 |
| 8 | Вес вторичного текста | 400-500 | **500 (Medium)** база, 700 — emphasized | tvOS default Medium |
| 9 | Масштаб фокуса | 1.06 (ряды после Task 51), 1.08 | **1.09** для 16:9, **1.10-1.14** для постеров; единственный носитель фокуса | Top Shelf пары; AOSP 1.1 |
| 10 | Подпись уезжает при фокусе, ряд не клиппится | — | сдвиг подписи ~0.35em (8 px, число наше), `overflow: visible` у ряда | WWDC24 lockup |

Бонус: вуаль героя — линейный градиент-маска по изображению; гасить герой, когда фокус ушёл в полки; кнопки — platter с инверсией (уже так).

**Конфликт с Task 51 плана фазы 5:** масштаб фокуса там снижен до 1.06 ради зазора под заголовком, а Apple/AOSP — 1.10-1.14. Разрешение: увеличивать зазор заголовка, а не резать масштаб (см. план).

## Источники
Apple HIG: Typography, Layout, Focus and selection, Color, Images, Motion, Top Shelf, Designing for tvOS — https://developer.apple.com/design/human-interface-guidelines/ ; WWDC24 10207 «Migrate your TVML app to SwiftUI» — https://developer.apple.com/videos/play/wwdc2024/10207/ ; Android TV Design: Layouts, Cards, Typography, Focus system, Color on TV — https://developer.android.com/design/ui/tv/ ; AOSP androidx.tv.material3 (Card.kt, SurfaceDefaults.kt, ButtonDefaults.kt, ListItemDefaults.kt, tokens/SurfaceTokens.kt, tokens/TypeScaleTokens.kt), leanback dimens.xml — https://android.googlesource.com/platform/frameworks/support/ ; Amazon Fire TV Design & UX Guidelines — https://developer.amazon.com/docs/fire-tv/design-and-user-experience-guidelines.html ; Microsoft Designing for Xbox and TV — https://learn.microsoft.com/en-us/windows/apps/design/devices/designing-for-tv ; WCAG 2.2 SC 1.4.3; CSS Values 4 reference pixel; Samsung Apps screen; LG UI Guideline v4.18; Sarunw dark color cheat sheet (третья сторона).

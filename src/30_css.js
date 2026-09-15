  /* -------------------------------------------------------------------- */
  /* CSS: палитра, шрифты, генерация и инжект стилей.                      */
  /* -------------------------------------------------------------------- */

  var STYLE_ID = 'lumen-card-css';
  var FONTS_ID = 'lumen-card-fonts';
  var FONTS_URL = 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800&family=Golos+Text:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap';

  var C = {
    bg: '#0B0908',
    panel: '#1C1613',
    spice: '#D9622B',
    text: '#F3EDE4',
    muted: '#A89A8A',
    smoke: '#7A6A5A',
    good: '#8FBF7A',
    dark: '#1A120A',
    /* Task 5a Step 4 (design-spec §0): «тёмная карточка» — фон и обводка,
       общие для чипов/кнопок/статуса на всех экранах дизайна. */
    line: '#2C231D',
    chipBg: 'rgba(28,22,19,.78)',
    buttonBg: 'rgba(28,22,19,.82)'
  };

  /* onac — текст на заливке акцентом (Task 32, экспорт «Lumen Torrents»,
     карта акцентов DCLogic: --onac). Карточка по-прежнему пишет C.dark. */
  var ACCENTS = {
    sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)', onac: '#1A120A' },
    ice: { color: '#7FB7C9', light: '#DCF1F8', glow: 'rgba(127,183,201,0.35)', onac: '#08171C' },
    wine: { color: '#C46A8F', light: '#F8DCE7', glow: 'rgba(196,106,143,0.35)', onac: '#1C0A12' },
    mint: { color: '#9FCF8A', light: '#E7F8DC', glow: 'rgba(159,207,138,0.35)', onac: '#0C1608' }
  };

  /* '#RRGGBB' -> 'R,G,B' для rgba(...) — так цвет не дублируется как отдельная
     hex- и rgb-запись (ревью Task 5a). */
  function hexToRgb(hex) {
    hex = ('' + hex).replace('#', '');
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return r + ',' + g + ',' + b;
  }

  /* Акцент «спайс» (чип реакций, тег «следующая серия») — фиксированный цвет,
     не зависит от темы, поэтому переводится в rgb один раз при загрузке модуля. */
  var SPICE_RGB = hexToRgb(C.spice);

  var FONT_DISPLAY_ON = '"Unbounded","Arial Black",Impact,sans-serif';
  var FONT_BODY_ON = '"Golos Text","Segoe UI",Roboto,Arial,sans-serif';
  var FONT_MONO_ON = '"JetBrains Mono",Consolas,"Courier New",monospace';
  var FONT_DISPLAY_OFF = '"Arial Black",Impact,sans-serif';
  var FONT_BODY_OFF = 'inherit';
  var FONT_MONO_OFF = 'Consolas,"Courier New",monospace';

  function theme() {
    var key = LC.pref(PLUGIN + '_accent', 'sand');
    return ACCENTS[key] || ACCENTS.sand;
  }

  function useFonts() {
    return LC.pref(PLUGIN + '_fonts', true);
  }

  /* Task 32: токены наружу для CSS экранов пути (src/65_torrents.js) —
     та же палитра, текущий акцент и стеки шрифтов, что у LC.buildCss,
     читаются заново на каждый вызов (смена акцента/шрифтов без перезагрузки). */
  LC.tokens = function () {
    var t = theme();
    var fonts = useFonts();
    return {
      bg: C.bg, panel: C.panel, line: C.line, text: C.text, muted: C.muted, smoke: C.smoke,
      spice: C.spice, spiceRgb: SPICE_RGB, good: C.good, dark: C.dark, chipBg: C.chipBg, buttonBg: C.buttonBg,
      accent: t.color, accentRgb: hexToRgb(t.color), onac: t.onac, ring: t.light, acglow: t.glow,
      fontDisplay: fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF,
      fontBody: fonts ? FONT_BODY_ON : FONT_BODY_OFF,
      fontMono: fonts ? FONT_MONO_ON : FONT_MONO_OFF
    };
  };

  LC.buildCss = function () {
    var t = theme();
    var A = t.color;
    var AL = t.light;
    var AG = t.glow;
    var A_RGB = hexToRgb(A);
    var fonts = useFonts();
    var FD = fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF;
    var FB = fonts ? FONT_BODY_ON : FONT_BODY_OFF;
    var FM = fonts ? FONT_MONO_ON : FONT_MONO_OFF;

    var css = [];

    /* --- Бэкдроп (лежит вне .lumen-card, в корне компонента) --- */
    css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;-webkit-transition:opacity .5s ease;transition:opacity .5s ease;pointer-events:none}');
    css.push('.lumen-backdrop.loaded{opacity:1}');
    css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');
    /* Task 6: кадры слайдшоу — .lumen-bg__img (первый кадр — тот же узел
       .lumen-backdrop__img, получает этот класс дополнительно к своему;
       следующие кадры — отдельные div внутри .lumen-bg__slides, см.
       src/50_backdrops.js). Позиционирование/масштаб повторяют
       .lumen-backdrop__img (72% 32%, cover) — оба правила должны выглядеть
       одинаково независимо от того, какое применится по каскаду. Без
       inset (план 0.3/0.4: запрет inset — нет в старых webview), только
       top/right/bottom/left. Кроссфейд — opacity 1.2s ease-in-out (design
       screen 12); Ken Burns (14s, 1.00→1.08) — уже в правиле
       .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active ниже. */
    css.push('.lumen-backdrop .lumen-bg__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 1.2s ease-in-out;transition:opacity 1.2s ease-in-out}');
    css.push('.lumen-backdrop .lumen-bg__img.is-active{opacity:1}');
    css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
    css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(11,9,8,0.96) 0%,rgba(11,9,8,0.88) 30%,rgba(11,9,8,0.35) 58%,rgba(11,9,8,0) 82%)}');
    css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(11,9,8,0.98) 0%,rgba(11,9,8,0.60) 28%,rgba(11,9,8,0) 60%)}');
    css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(11,9,8,0.70) 0%,rgba(11,9,8,0) 22%)}');
    /* Процедурные фоны — когда бэкдропа нет */
    css.push('.lumen-backdrop--proc0 .lumen-backdrop__img{background:radial-gradient(ellipse 56% 57% at 72% 58%,rgba(255,214,150,0.85) 0%,rgba(232,150,80,0.40) 28%,rgba(232,150,80,0) 70%),linear-gradient(180deg,#1A0D08 0%,#7A2E12 42%,#D9622B 60%,#E8B87A 78%,#3A2418 100%)}');
    css.push('.lumen-backdrop--proc1 .lumen-backdrop__img{background:radial-gradient(ellipse 52% 52% at 74% 52%,rgba(238,214,120,0.78) 0%,rgba(200,170,70,0.35) 30%,rgba(200,170,70,0) 70%),linear-gradient(180deg,#0F1210 0%,#3A3E22 45%,#B99A3A 66%,#6E5A24 82%,#17140E 100%)}');
    css.push('.lumen-backdrop--proc2 .lumen-backdrop__img{background:radial-gradient(ellipse 58% 55% at 68% 54%,rgba(190,214,236,0.70) 0%,rgba(120,150,190,0.32) 30%,rgba(120,150,190,0) 70%),linear-gradient(180deg,#07090E 0%,#1B2536 44%,#46617F 64%,#8FA6BC 80%,#181C22 100%)}');
    /* Task 5b Step 3/4 (design-spec §12, дополнение к задаче): нет кадра
       (режимы 'poster'/'procedural' LC.cardinfo.bgMode, либо кадр из
       режима 'backdrop' не загрузился/завис) -> размытый постер поверх
       диагонального градиента. blur(40px)=1.75em, opacity:.8 — числа из
       дополнения к Task 5b (экран 13 сам даёт только уменьшенный макет,
       числового fullscreen-примера не содержит). Блюр — только в полном
       режиме анимаций (lumen-motion-full): в lite/off дорого для ТВ,
       остаётся только затемнение (opacity). .lumen-backdrop — сосед
       карточки в DOM, не потомок (см. 50_backdrops.js) — режим анимаций
       поэтому зеркалится прямо на этот слой, а не читается через .lumen-card. */
    css.push('.lumen-backdrop.lumen-bg--blur{background:linear-gradient(160deg,#2A1B10 0%,#1A110B 38%,#0B0908 72%)}');
    css.push('.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img{background-position:50% 50%;opacity:.8}');
    css.push('.lumen-backdrop.lumen-motion-full.lumen-bg--blur .lumen-backdrop__img{-webkit-filter:blur(1.75em);filter:blur(1.75em);-webkit-transform:scale(1.1);transform:scale(1.1)}');
    css.push('.lumen-backdrop.lumen-motion-lite.lumen-bg--blur .lumen-backdrop__img,.lumen-backdrop.lumen-motion-off.lumen-bg--blur .lumen-backdrop__img{-webkit-transform:none;transform:none}');
    css.push('.full-start__background.lumen-off{display:none !important}');

    /* --- Корень карточки --- */
    /* Task 5a Step 4 (design-spec §1): safe area 64px по всем краям (÷22.811 = 2.81em). */
    css.push('.full-start-new.lumen-card{position:relative;padding:0 2.81em 2.81em;color:' + C.text + ';font-family:' + FB + '}');
    css.push('.lumen-card .full-start-new__left{display:none !important}');
    /* Task 5b Step 2 (design-spec §11, экран 04): режим 'poster' (нет
       кадров, есть постер) показывает постер 2:3 — v1-правило выше скрывает
       .full-start-new__left безусловно, переопределяем его здесь большей
       специфичностью (3 класса против 2) + !important, как требуют поправки
       контроллера. order/align-self переносят постер в конец строки
       .full-start-new__body (визуально справа, design screen 04 держит его
       у правого края) и к верхнему краю (top:140px дизайна), не трогая
       .full-start-new__right — он остаётся первым и растягивается (flex-grow:1). */
    css.push('.lumen-card.lumen-card--poster .full-start-new__left{display:block !important;-webkit-box-ordinal-group:2;-webkit-order:1;order:1;-webkit-align-self:flex-start;-ms-flex-item-align:start;align-self:flex-start;-webkit-flex-shrink:0;flex-shrink:0;width:16.66em;margin:6.14em 0 0 2.63em}');
    css.push('.lumen-card.lumen-card--poster .full-start-new__poster{border-radius:.61em;overflow:hidden;background:linear-gradient(180deg,' + C.panel + ',#0E0B09);border:.04em solid ' + C.line + ';box-shadow:0 .88em 2.63em rgba(0,0,0,.6)}');
    css.push('.lumen-card.lumen-card--poster .full-start-new__img{border-radius:.61em}');
    css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{position:absolute;left:0;right:0;bottom:0;padding:0 1.05em 1.05em;font-family:' + FD + ';font-weight:600;font-size:.88em;line-height:1.3;color:' + C.smoke + '}');
    css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:74vh}');
    css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');
    /* .lumen-content — сетка из двух колонок: шесть .lumen-in (главная колонка,
       col 1, друг под другом в порядке документа) и .lumen-side (col 2, во всю
       высоту первой колонки, прижат к низу) — без промежуточного .lumen-main/
       .lumen-cols, разметка Task 5a Step 2 держит их прямыми соседями ради
       stagger-подбора Task 4 (nth-child(1..6) считает по прямым детям). Gap
       между колонками — design-spec §1 (60px ÷ 22.811 = 2.63em). */
    /* display:flex — база (и фолбэк для браузеров без CSS Grid, см. ниже),
       display:grid следующей декларацией того же свойства переопределяет её
       там, где grid поддерживается (невалидное значение в старом браузере
       просто не применяется, действует последнее валидное — flex). */
    css.push('.lumen-card .lumen-content{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:end;-webkit-align-items:end;align-items:end;display:-ms-grid;display:grid;grid-template-columns:minmax(0,1fr) auto;grid-auto-rows:auto;-webkit-column-gap:2.63em;column-gap:2.63em}');
    css.push('.lumen-card .lumen-content > .lumen-in{grid-column:1;max-width:52em}');
    css.push('.lumen-card .lumen-content > .lumen-side{grid-column:2;grid-row:1 / 7;-ms-grid-row-align:end;align-self:end;-webkit-flex-shrink:0;flex-shrink:0;text-align:right;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end}');
    /* Фолбэк для Chromium < 57 (webOS 3, старые Tizen — CSS Grid ещё не
       поддержан, но @supports у них уже есть). На чистом flex-wrap каждый
       .lumen-in занимает всю строку (width:100%) — переносится сам по себе,
       кроме шестого (кнопки: узкий по содержимому, не тянется на всю ширину)
       — в его строке остаётся свободное место, куда margin-left:auto
       прижимает .lumen-side. Так боковая колонка держится справа у нижнего
       края стопки контента (там же, где кнопки), а не проваливается под неё
       седьмой строкой. @supports not исключает блок целиком там, где grid
       поддержан — сбрасывать эти правила отдельно не нужно. */
    css.push('@supports not (display:grid){.lumen-card .lumen-content > .lumen-in{width:100%}.lumen-card .lumen-content > .lumen-in:nth-child(6){width:auto;-webkit-box-flex:0;-webkit-flex:0 1 auto;flex:0 1 auto}.lumen-card .lumen-content > .lumen-side{margin-left:auto}}');

    /* Скрытые узлы оригинала (нужны Lampa, но не нужны дизайну) */
    css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
    css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
    css.push('.lumen-card .full-start__pg{display:none !important}');

    /* --- Мета-строка (design-spec §2: 20px, gap 12px, разделитель #2C231D) --- */
    css.push('.lumen-card .lumen-meta{font-family:' + FM + ';font-size:.88em;color:' + C.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    css.push('.lumen-card .lumen-meta > *{margin:0 .53em .2em 0}');
    css.push('.lumen-card .lumen-meta__sep{color:' + C.line + '}');

    /* --- Заголовок (design-spec §3: 88px, line-height 1.02, letter-spacing -.015em;
       .lumen-title--long меняет только line-clamp — кегль не уменьшается, как на
       экране 01; заменяет разбор по нативному .twolines из v1) --- */
    css.push('.lumen-card .full-start-new__title{font-family:' + FD + ';font-size:3.86em;font-weight:800;line-height:1.02;letter-spacing:-.015em;margin:.70em 0 0 -.02em}');
    /* Ревью Task 5a: line-clamp не работает без полной тройки display/box-orient/
       overflow (иначе длинный заголовок не обрезается многоточием вовсе). */
    css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');
    css.push('.lumen-card .lumen-original{font-family:' + FM + ';font-size:.88em;color:' + C.smoke + ';margin-top:.53em;overflow:hidden;white-space:nowrap;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    css.push('.lumen-card .lumen-original:empty{display:none}');

    /* --- Описание (design-spec §4: 24px, max-width 980px, margin-top 20px) --- */
    css.push('.lumen-card .lumen-descr{font-size:1.05em;line-height:1.45;color:' + C.muted + ';max-width:42.96em;margin-top:.88em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}');

    /* --- Рейтинги (design-spec §5a: колонка значение/подпись, тёмная карта) --- */
    css.push('.lumen-card .full-start-new__rate-line{margin:1.05em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    /* !important обязателен: у Lampa в native-scss .full-start-new__rate-line > *
       уже есть margin-left:0 !important;margin-right:1em !important (harness/
       start_new.scss) — обычной специфичностью её не перебить, только другим
       !important. */
    css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .53em .53em 0 !important}');
    css.push('.lumen-card .full-start__rate{font-family:' + FM + ';background:' + C.chipBg + ';border:.04em solid ' + C.line + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
    css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.23em;font-weight:600;line-height:1;color:' + C.text + '}');
    css.push('.lumen-card .full-start__rate > div:last-child{font-size:.61em;letter-spacing:.1em;color:' + C.smoke + ';padding:.18em 0 0}');
    /* Чип «РЕАКЦИЙ» (fire) — та же геометрия что рейтинги, акцент «спайс», design-spec §5d/5f. */
    css.push('.lumen-card .lumen-reactions-chip{font-family:' + FM + ';background:rgba(' + SPICE_RGB + ',.12);border:.04em solid rgba(' + SPICE_RGB + ',.5);border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
    css.push('.lumen-card .lumen-reactions-chip__value{font-size:1.23em;font-weight:600;line-height:1;color:' + C.spice + '}');
    css.push('.lumen-card .lumen-reactions-chip__label{font-size:.61em;letter-spacing:.1em;opacity:.8;color:' + C.spice + ';padding:.18em 0 0}');
    css.push('.lumen-card .full-start-new__rate-line .tag--episode{font-family:' + FM + ';font-size:1em;background:rgba(' + SPICE_RGB + ',0.14);border:.04em solid rgba(' + SPICE_RGB + ',0.40);border-radius:.75em;padding:.6em 1em;color:' + C.text + ';text-transform:none;max-width:34em}');
    css.push('.lumen-card .full-start-new__rate-line .tag--episode > div{font-size:1em;color:' + A + '}');

    /* --- Продолжить (design-spec §6: ширина 760px, margin-top 24px) --- */
    css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FM + ';font-size:1em;color:' + C.muted + ';letter-spacing:.04em}');
    css.push('.lumen-card .lumen-progress__label{-webkit-flex-shrink:0;flex-shrink:0;font-size:.79em;color:' + C.text + '}');
    css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;height:.18em;background:rgba(243,237,228,0.16);border-radius:.09em;overflow:hidden;margin:0 1.1em}');
    css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;background:' + A + '}');
    css.push('.lumen-card .lumen-progress__time{-webkit-flex-shrink:0;flex-shrink:0;font-size:.79em}');

    /* --- Кнопки (design-spec §7a-c: 72px, тёмная карта, blur, раскрытие подписи в фокусе) --- */
    /* Ревью Task 5a: margin-top был остатком базы 16 (1.75em = 28/16, v1).
       Дизайн (экран 01, ряд кнопок после «Продолжить»): 32px ÷ 22.811 = 1.40em. */
    css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.40em;overflow:visible}');
    /* Task 4: пружина фокуса — transform на кривой с перелётом (overshoot), background/color/box-shadow отдельно. Разметка и outerHTML кнопок не менялись (хэш приоритета, см. 0.2).
       Task 5a: ширина/паддинг/фон/бордер/blur — под дизайн; у иконочных кнопок ширина/паддинг
       ещё и анимированы (раскрытие подписи в фокусе, §7c) — transition здесь общий для всех. */
    css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:3.16em;min-width:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid ' + C.line + ';background:' + C.buttonBg + ';-webkit-backdrop-filter:blur(.88em);backdrop-filter:blur(.88em);color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.14em;height:1.14em;-webkit-flex-shrink:0;flex-shrink:0}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.05em;margin:0 0 0 .53em;line-height:1}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
    css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span{display:block}');
    /* Ревью Task 5a, design-spec §7b «АКТИВНА»: из наших кнопок класс active
       на карточке ставит только сама Lampa на .button--subscribe (когда уже
       подписан — app.min.js, onSubscribed(): this.html.find('.button--subscribe')
       .addClass('active')). У .button--book того же нет — там только смена
       fill у <path> (Favorite.check), без класса на самой кнопке; без :has()
       поймать это чистым CSS нельзя, поэтому закладку не трогаем. */
    css.push('.lumen-card .full-start-new__buttons .full-start__button.active{background:rgba(' + A_RGB + ',.16);border-color:' + A + ';color:' + A + '}');
    /* Иконочные кнопки — квадрат 72×72 без подписи; в фокусе ширина авто с паддингом
       под раскрытую подпись (design-spec §7b/§7c, экран 10 «ФОКУС · С ПОДПИСЬЮ»). */
    css.push('.lumen-card .full-start-new__buttons .button--book,.lumen-card .full-start-new__buttons .button--reaction,.lumen-card .full-start-new__buttons .button--subscribe,.lumen-card .full-start-new__buttons .button--options{padding:0;width:3.16em}');
    css.push('.lumen-card .full-start-new__buttons .button--book.focus,.lumen-card .full-start-new__buttons .button--reaction.focus,.lumen-card .full-start-new__buttons .button--subscribe.focus,.lumen-card .full-start-new__buttons .button--options.focus{width:auto;padding:0 1.05em}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus span{display:block}');
    /* Ревью Task 5a: тень фокуса была остатком дефекта единиц — .875em/2.5em =
       14/16 и 40/16 (v1 при базе 16). Дизайн 0.4: 0 14px 40px -> ÷22.811 =
       0 .614em 1.754em. */
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    /* Нажатие — отдельный тон, без scale (design-spec §7a «НАЖАТА»); !important —
       поверх правила .focus выше и нативной анимации Lampa (план 0.2). */
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:#C4924F !important;border-color:rgba(255,242,220,.6) !important;-webkit-transform:scale(1) !important;transform:scale(1) !important}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.loading:before{filter:none}');

    /* --- Правая колонка (design-spec §8/экраны 01,10: статус первым над чипами
       качества, аватар 62px Golos Text, чипы качества раздельно). Ревью Task 5a:
       .full-start__status переехал сюда из общей ленты рейтингов — Step 2 плана
       был неточен, экраны 01/03/10 однозначно держат пилюлю статуса в боковой
       колонке. Пилюля та же, что и была (5b), просто без правого выравнивания
       текста внутри самой пилюли — align-items:flex-end колонки прижимает её
       целиком к правому краю. */
    css.push('.lumen-card .lumen-side .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;letter-spacing:normal;text-transform:none;background:' + C.chipBg + ';border:.04em solid ' + C.line + ';border-radius:1.32em;padding:.35em .70em;margin-bottom:1.05em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;color:' + C.text + '}');
    css.push('.lumen-card .lumen-side .full-start__status:before{content:"";display:block;width:.44em;height:.44em;border-radius:50%;background:currentColor;margin-right:.44em}');
    css.push('.lumen-card .lumen-status--good:before{color:' + C.good + '}');
    css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
    css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + C.smoke + '}');
    css.push('.lumen-card .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
    css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');
    css.push('.lumen-card .lumen-quality-chip{font-family:' + FM + ';font-size:.66em;letter-spacing:.08em;color:' + C.text + ';border:.04em solid rgba(243,237,228,.24);border-radius:.31em;padding:.31em .48em;margin:0 0 .35em .35em;white-space:nowrap}');
    css.push('.lumen-card .lumen-cast{margin-top:1.05em}');
    css.push('.lumen-card .lumen-cast__label{font-size:.79em;color:' + C.smoke + ';margin-bottom:.53em}');
    css.push('.lumen-card .lumen-cast__row{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
    css.push('.lumen-card .lumen-cast__item{font-family:' + FB + ';font-size:.88em;font-weight:500;width:2.72em;height:2.72em;border-radius:50%;background:' + C.panel + ';border:.13em solid ' + C.bg + ';margin-left:-.61em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;color:' + C.muted + ';overflow:hidden}');
    css.push('.lumen-card .lumen-cast__row .lumen-cast__item:first-child{margin-left:0}');
    css.push('.lumen-card .lumen-cast__more{font-family:' + FM + ';font-weight:600;font-size:.75em;color:' + C.smoke + '}');

    /* --- Компактная раскладка на узких экранах (страховка) --- */
    css.push('@media screen and (max-width:1000px){.lumen-card .lumen-content{display:block}.lumen-card .lumen-content > .lumen-side{text-align:left;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;margin-top:1.5em}.lumen-card .full-start-new__title{font-size:2.43em}.lumen-card .full-start-new__body{min-height:0}}');

    /* Task 4: motion — анимации в духе Apple TV. */

    /* Появление контента: разметку .lumen-in (6 «детей» .lumen-content) добавит Task 5a —
       здесь только правила подъёма и раскадровка задержек с шагом 60мс. */
    css.push('.lumen-card.lumen-motion-full .lumen-in{opacity:0;-webkit-transform:translateY(1.05em);transform:translateY(1.05em);-webkit-animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards;animation:lumen-rise .7s cubic-bezier(.2,.8,.2,1) forwards}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(1){-webkit-animation-delay:.05s;animation-delay:.05s}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(2){-webkit-animation-delay:.11s;animation-delay:.11s}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(3){-webkit-animation-delay:.17s;animation-delay:.17s}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(4){-webkit-animation-delay:.23s;animation-delay:.23s}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(5){-webkit-animation-delay:.29s;animation-delay:.29s}');
    css.push('.lumen-card.lumen-motion-full .lumen-in:nth-child(6){-webkit-animation-delay:.35s;animation-delay:.35s}');
    css.push('@-webkit-keyframes lumen-rise{to{opacity:1;-webkit-transform:none}}');
    css.push('@keyframes lumen-rise{to{opacity:1;transform:none}}');

    /* Режимы движения на корне карточки: lite — только цветовые переходы (без transform/box-shadow,
       дешевле для Tizen/webOS), off — всё отключено (!important — эти правила обязаны выигрывать). */
    css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-transition:background-color .15s,color .15s;transition:background-color .15s,color .15s}');
    /* lite = «только цвета», значит и сам scale не должен применяться (не только не анимироваться) —
       иначе фокус в lite скакал бы на 1.06 мгновенным скачком вместо честного «без transform». Гасим
       transform:scale(1.06) из v1-правила .lumen-card .full-start-new__buttons .full-start__button.focus
       (4 класса специфичности: lumen-card, full-start-new__buttons, full-start__button, focus).
       Правило ниже — lumen-card + lumen-motion-lite + full-start-new__buttons + full-start__button +
       focus = 5 классов специфичности, выше v1-правила независимо от порядка объявления в файле —
       но специфичности тут НЕДОСТАТОЧНО: у Lampa в app.css на .full-start__button.focus/.hover висит
       собственная CSS-анимация (`animation: .2s ease 0s 1 normal none running animation-button-focus`,
       @keyframes 40%{scale(.9)} 100%{scale(1)}, найдено и проверено живьём в локальной Lampa). По каскаду
       (CSS Cascade §4.1) активная анимация перебивает ЛЮБОЕ обычное правило автора независимо от
       специфичности — сильнее её только `!important`. Поэтому transform:none здесь тоже с !important
       (как и в lumen-motion-off ниже, который вдобавок глушит саму анимацию через animation:none). */
    css.push('.lumen-card.lumen-motion-lite .full-start-new__buttons .full-start__button.focus{-webkit-transform:none !important;transform:none !important}');
    /* !important и на opacity/transform тоже — по двум причинам сразу: (1) у .full-start__button.focus
       есть v1-правило с 4 классами специфичности (.full-start-new__buttons .full-start__button.focus);
       (2) у Lampa в app.css на этом же .focus висит своя CSS-анимация animation-button-focus (см.
       комментарий у lumen-motion-lite выше) — она перебивает обычные правила вне зависимости от
       специфичности, поэтому её саму дополнительно глушим через animation:none !important. */
    css.push('.lumen-card.lumen-motion-off .full-start__button,.lumen-card.lumen-motion-off .lumen-in{-webkit-transition:none !important;transition:none !important;-webkit-animation:none !important;animation:none !important;opacity:1 !important;-webkit-transform:none !important;transform:none !important}');
    /* Ревью Task 4 (эта задача, попутная мелочь): в lite transform уже глушится выше, но сама
       нативная CSS-анимация Lampa (animation-button-focus, .full-start__button.focus/.hover,
       app.css ~15820-15880) на кнопках карточки продолжала играть — getComputedStyle(btn).animationName
       оставался 'animation-button-focus' вместо 'none'. lite задуман как «только цвета», поэтому
       анимацию гасим так же, как в off. */
    css.push('.lumen-card.lumen-motion-lite .full-start__button{-webkit-animation:none !important;animation:none !important}');

    /* Бэкдроп: медленный наезд (Ken Burns). Класс .lumen-bg__img подготовлен для слайдшоу кадров Task 6.
       Task 6 (исправление): корень — .lumen-backdrop, а не .lumen-card. Слой фона лежит в e.body, вне
       .lumen-card (сосед, не потомок — см. 50_backdrops.js/syncMotionClass) — с корнем .lumen-card этот
       потомковый селектор не находил бы .lumen-bg__img вовсе, и наезд никогда бы не включался. Режим
       анимаций на .lumen-backdrop зеркалит syncMotionClass() при каждом успешном apply(). */
    css.push('.lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s linear forwards;animation:lumen-kb 14s linear forwards}');
    css.push('@-webkit-keyframes lumen-kb{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
    css.push('@keyframes lumen-kb{from{transform:scale(1)}to{transform:scale(1.08)}}');

    /* Компактная шапка при фокусе ниже кнопок (ряд серий / описание, экран 06 design/*.dc.html).
       Значения — px экрана 06 ÷ 22.811 (правило единиц 0.4: база Lampa при 1920px, не ÷16).
       Заголовок: 48px ÷ 22.811 = 2.104em. Описание в этом режиме на экране не показано — скрыто целиком.
       Отступы рейтингов/кнопок сжаты тем же соотношением, что и заголовок (48/88 ≈ .545 от обычных
       1.6em/1.75em), т.к. экран 06 сводит мета+заголовок+рейтинг в одну строку, а наш DOM (без правки
       шаблона — Task 5) сохраняет их отдельными блоками. Переход — та же кривая и длительность, что у
       пружины фокуса кнопок (280мс cubic-bezier(.2,.9,.3,1.25)).

       Решение: почему это layout-анимация (font-size/margin-top триггерят reflow), а не transform.
       transform:scale() тут не подходит — он не освобождает место в потоке документа, а сжатие шапки
       должно реально уменьшить её высоту, чтобы ряд описания/серий под кнопками поднялся на освободившееся
       место (а не просто визуально наехал). Reflow-анимация принята осознанно: событие редкое (переключение
       контроллера вниз/вверх по карточке), происходит по одной штуке за раз, длительность ограничена 280мс.
       На слабых ТВ transition для этих трёх свойств отключён ниже в .lumen-motion-lite/-off — auto уходит
       в lite уже на Tizen/webOS (LC.motionModeFor); автодетект слабых Android — фаза 3 Task 29 (ещё не
       реализован), пока для них тоже нужно выбирать «Лёгкие»/«Выкл» вручную в настройках. */
    css.push('.lumen-card .full-start-new__title,.lumen-card .full-start-new__rate-line,.lumen-card .full-start-new__buttons{-webkit-transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25);transition:font-size .28s cubic-bezier(.2,.9,.3,1.25),margin-top .28s cubic-bezier(.2,.9,.3,1.25)}');
    css.push('.lumen-card.lumen-compact .full-start-new__title{font-size:2.104em}');
    css.push('.lumen-card.lumen-compact .lumen-descr{display:none}');
    css.push('.lumen-card.lumen-compact .full-start-new__rate-line{margin-top:.87em}');
    css.push('.lumen-card.lumen-compact .full-start-new__buttons{margin-top:.95em}');
    css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');

    /* --- Иконки кнопок (единый набор через CSS-маску, см. src/20_icons.js) --- */
    css.push(LC.icons.css());

    return css.join('\n');
  };

  LC.injectCss = function () {
    try {
      var el = document.getElementById(STYLE_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        el.type = 'text/css';
        (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(el);
      }
      var text = LC.buildCss();
      if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
      else el.innerHTML = text;
      /* Task 32: CSS экранов пути пересобирается вместе с CSS карточки
         (смена акцента/шрифтов); сама функция уважает ui_active и lumen_torrents. */
      if (typeof LC.applyTorrentsPref === 'function') LC.applyTorrentsPref();
    } catch (e) {
      warn('css inject failed', e);
    }
  };

  LC.injectFonts = function () {
    try {
      var existing = document.getElementById(FONTS_ID);
      if (!useFonts()) {
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        return;
      }
      if (existing) return;
      var link = document.createElement('link');
      link.id = FONTS_ID;
      link.rel = 'stylesheet';
      link.href = FONTS_URL;
      (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
    } catch (e) {
      warn('fonts inject failed', e);
    }
  };

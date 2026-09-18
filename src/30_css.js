  /* -------------------------------------------------------------------- */
  /* CSS: палитра, шрифты, генерация и инжект стилей.                      */
  /* -------------------------------------------------------------------- */

  var STYLE_ID = 'lumen-card-css';
  var FONTS_ID = 'lumen-card-fonts';

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
       общие для чипов/кнопок/статуса на всех экранах дизайна. Сами заливки
       карт (прежние C.chipBg/C.buttonBg — .78/.82 от цвета панели) переехали
       в palette(): они зависят от темы и от настройки «Плотные подложки». */
    line: '#2C231D',
    /* Task 32 (экспорт «Lumen Torrents», экраны 34–39): панель в фокусе,
       тёмная панель строк/файлов, приподнятый чип (ссылки, code). */
    panelHi: '#221A13',
    panelLo: '#17120F',
    raised: '#241C17'
  };

  /* onac — текст на заливке акцентом (Task 32, экспорт «Lumen Torrents»,
     карта акцентов DCLogic: --onac). Карточка по-прежнему пишет C.dark. */
  /* Task 10 (экран 14 «ACCENT VARIANTS»): у каждого акцента своя ЧЕТВЁРКА
     токенов — цвет, текст на акценте, кольцо фокуса и свечение. Значения 1:1
     из DCLogic.accents() экспорта design/Lumen Card for Lampa - FHD.dc.html:
     кольца ice/wine/mint были взяты на глаз в v1 (#DCF1F8/#F8DCE7/#E7F8DC) и
     расходились с дизайном — выправлено здесь, вместе со смыслом «смена
     акцента меняет всю группу разом». */
  /* Фаза 3 (расширенные настройки оформления): к четвёрке дизайна добавлены
     пять акцентов — медь, гранат, изумруд, лаванда и нейтральный графит
     («акцент без цвета» для тех, кому пёстро). Правило подбора то же, что у
     исходных четырёх: цвет светлее фона настолько, чтобы тёмный текст на
     заливке акцентом (onac — подписи кнопок в фокусе, чипов, «Скрыть») читался
     на ТВ с трёх метров. Замеренный контраст onac к своему цвету (WCAG 2.1):
     песок 10.19, медь 7.17, вино 5.27, гранат 7.36, мята 10.38, изумруд 9.65,
     лёд 8.28, лаванда 8.37, графит 9.50 — все выше порога 4.5:1, восемь из
     девяти выше целевых 7:1. Вино — единственное исключение (5.27): это
     значение из экспорта дизайна, оно уже стоит в профилях пользователей,
     выбравших этот акцент, и менять его задним числом значило бы менять их
     карточку без спроса.
     Свечение графита слабее прочих (0.30 против 0.35): нейтральный цвет даёт
     не цветной ореол, а белое сияние, и на 0.35 оно спорило бы с самим
     акцентом — тем самым «без выраженного цвета», ради которого графит и
     добавлен. */
  var ACCENTS = {
    sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)', onac: '#1A120A' },
    copper: { color: '#D0925F', light: '#FBE7D4', glow: 'rgba(208,146,95,0.35)', onac: '#1A0E06' },
    wine: { color: '#C46A8F', light: '#FBEAF1', glow: 'rgba(196,106,143,0.35)', onac: '#1C0A12' },
    garnet: { color: '#E08592', light: '#FBE6EA', glow: 'rgba(224,133,146,0.35)', onac: '#1A070B' },
    mint: { color: '#9FCF8A', light: '#EEFBE7', glow: 'rgba(159,207,138,0.35)', onac: '#0C1608' },
    emerald: { color: '#7ACCA0', light: '#E4FBEE', glow: 'rgba(122,204,160,0.35)', onac: '#06170F' },
    ice: { color: '#7FB7C9', light: '#E9F7FB', glow: 'rgba(127,183,201,0.35)', onac: '#08171C' },
    lavender: { color: '#B3A3E8', light: '#EFEAFB', glow: 'rgba(179,163,232,0.35)', onac: '#130E22' },
    graphite: { color: '#BDB8B2', light: '#EFEDEA', glow: 'rgba(189,184,178,0.30)', onac: '#131211' }
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

  /* Фаза 3, настройка «Тема»: тёплый тёмный набор выше — значение по умолчанию,
     ровно те цвета, что были у карточки до этой задачи. «Глубокая чёрная» —
     набор для OLED: настоящий чёрный фон (пиксель выключен) и нейтрально-серые
     подложки без тёплого оттенка. Меняются только фон, подложки, линии и серые
     тона текста; «спайс», «хороший» зелёный и сам акцент — общие для тем:
     первые два фиксированы дизайном, акцент выбирает соседняя настройка.
     Поля ровно те же, что у C, — palette() возвращает набор той же формы,
     поэтому ни одно правило не знает, какая тема выбрана. */
  /* Градиенты (grad*) перечислены целиком, а не собираются из цветов: в
     дизайне это самостоятельные заливки со своими промежуточными тонами
     (карта серии, например, уходит в холодный синий #161825), и разложить их
     на «панель + дно» без потери вида нельзя. */
  var THEMES = {
    warm: {
      bg: C.bg, panel: C.panel, line: C.line, dark: C.dark,
      text: C.text, muted: C.muted, smoke: C.smoke,
      panelHi: C.panelHi, panelLo: C.panelLo, raised: C.raised,
      gradPoster: 'linear-gradient(180deg,#1C1613,#0E0B09)',
      gradPanel: 'linear-gradient(180deg,#1C1613,#120E0B)',
      gradHint: 'linear-gradient(180deg,#120E0B,#0B0908)',
      gradSlate: 'linear-gradient(180deg,#0C0D0F,#161825)',
      gradWatching: 'linear-gradient(180deg,#171310,#221A13)',
      gradFocus: 'linear-gradient(180deg,#221A13,#2C2318)',
      gradBlur: 'linear-gradient(160deg,#2A1B10 0%,#1A110B 38%,#0B0908 72%)'
    },
    black: {
      bg: '#000000', panel: '#101012', line: '#26262B', dark: '#08080A',
      text: '#F2F2F3', muted: '#A7A6A8', smoke: '#7B7A7D',
      panelHi: '#17171A', panelLo: '#0A0A0C', raised: '#1D1D21',
      gradPoster: 'linear-gradient(180deg,#101012,#08080A)',
      gradPanel: 'linear-gradient(180deg,#101012,#08080A)',
      gradHint: 'linear-gradient(180deg,#0E0E10,#000000)',
      gradSlate: 'linear-gradient(180deg,#0A0A0C,#151519)',
      gradWatching: 'linear-gradient(180deg,#121216,#1C1C21)',
      gradFocus: 'linear-gradient(180deg,#1A1A1F,#232329)',
      gradBlur: 'linear-gradient(160deg,#17171B 0%,#0B0B0D 38%,#000000 72%)'
    }
  };

  /* Фаза 3, настройка «Плотные подложки»: тёмные карты плагина (чипы, кнопки,
     подложки описания и таблицы «ПОДРОБНО», кнопка «Стоп» и метка трейлера)
     нарисованы полупрозрачными — сквозь них подтекает кадр. На части ТВ это
     мылит картинку и стоит кадров: полупрозрачность поверх живого бэкдропа
     композитор пересобирает постоянно, а backdrop-filter — тем более. С
     включённой настройкой те же карты становятся сплошными, а размытие
     подложки не выводится вовсе.
     Возвращает набор цветов темы плюс производные токены; читается заново на
     каждую сборку CSS, поэтому обе настройки применяются без перезахода. */
  function palette() {
    var base = THEMES[LC.pref('lumen_theme', 'warm')] || THEMES.warm;
    var solid = LC.pref('lumen_solid', false);
    var p = {};
    for (var k in base) {
      if (Object.prototype.hasOwnProperty.call(base, k)) p[k] = base[k];
    }
    /* Не зависят от темы: «спайс» — чип реакций и негативный отзыв,
       «хороший» — точка статуса и отметка просмотренной серии. */
    p.good = C.good;
    p.spice = C.spice;
    /* Правка пользователя 2026-09-17 (третий круг): «фон определялся от
       картинки». Фон темы получает оттенок постера текущего фильма ДО того,
       как из него посчитаны производные (bgRgb, plate, glass, badge) — тогда
       тон подхватывают разом все подложки плагина и вуали героя, и ни одному
       правилу ниже не нужно знать, откуда взялся цвет.
       Сторож читаемости — P.muted, самый слабый текст на этом фоне (подпись
       года под постером ряда): LC.accent.tint уменьшает подмешивание, пока
       контраст не вернётся к порогу (src/57_color.js). Подкраска выключена
       по умолчанию (lumen_accent_auto) и не работает в lite/off. */
    try {
      if (LC.accent && typeof LC.accent.tint === 'function') {
        var tinted = LC.accent.tint(p.bg, p.muted, 4.5);
        if (tinted) p.bg = tinted;
      }
    } catch (eTint) {
      warn('bg tint failed', eTint);
    }
    p.bgRgb = hexToRgb(p.bg);
    p.textRgb = hexToRgb(p.text);
    p.panelRgb = hexToRgb(p.panel);
    /* Тёмная карта чипов/рейтингов и заливка кнопок — те же .78/.82 от цвета
       панели, что были литералами C.chipBg/C.buttonBg. Плотный вариант: чип
       становится самой панелью, кнопка — приподнятой панелью, чтобы ряд
       кнопок не слился с чипами рейтингов. */
    p.chipBg = solid ? p.panel : 'rgba(' + p.panelRgb + ',.78)';
    p.buttonBg = solid ? p.panelHi : 'rgba(' + p.panelRgb + ',.82)';
    /* Подложки блоков ряда описания (описание, «ПОДРОБНО», заголовок отзывов):
       цвет страницы с прозрачностью .85 — над тёмной областью кадра их почти
       не видно, над светлой они работают как плотная подложка. */
    p.plate = solid ? p.bg : 'rgba(' + p.bgRgb + ',.85)';
    /* Кнопка «Стоп» и метка «ТРЕЙЛЕР · БЕЗ ЗВУКА» лежат поверх играющего
       ролика — они самые прозрачные в карточке (.5 и .62). */
    p.glass = solid ? p.bg : 'rgba(' + p.bgRgb + ',.5)';
    p.badge = solid ? p.bg : 'rgba(' + p.bgRgb + ',.62)';
    /* Размытие подложки кнопок, «Стопа» и метки. В плотном режиме — пустая
       строка: свойство не выводится вовсе, а не выводится со значением none. */
    p.blur = solid ? '' : '-webkit-backdrop-filter:blur(.88em);backdrop-filter:blur(.88em);';
    /* Метка «ТРЕЙЛЕР · БЕЗ ЗВУКА» размыта сильнее остальных карт (1.1em
       против .88em) — она самая прозрачная и лежит прямо на кадре. */
    p.blurWide = solid ? '' : '-webkit-backdrop-filter:blur(1.1em);backdrop-filter:blur(1.1em);';
    /* «Стоп» и метка в режимах «Лёгкие»/«Выкл»: блюр там снят, и подложка
       уплотняется до .9, иначе белый текст поверх светлой сцены ролика теряется
       (ревью фазы 1, I1). С плотными подложками уплотнять нечего — они уже
       сплошные. */
    p.glassLite = solid ? p.bg : 'rgba(' + p.bgRgb + ',.9)';
    return p;
  }

  /* Фаза 3, настройка «Масштаб интерфейса». Все размеры плагина считаются в em
     от базового кегля Lampa (она сама ставит его на body: innerWidth / 84.17,
     то есть 22.811 px при 1920 — отсюда правило единиц «px дизайна ÷ 22.811»).
     Значит достаточно одного коэффициента на КОРНЯХ плагина: em внутри них
     пересчитываются целиком, и вся раскладка — отступы, кегли, карты, иконки —
     меняется пропорционально, ровно как при штатной настройке Lampa «Размер
     интерфейса» (её коэффициенты 0.9 / 1 / 1.05).
     Величины в vh (высота героя, область рядов главной, предел описания)
     коэффициент не трогает намеренно: это доли ЭКРАНА, а не текста. */
  var SCALES = { small: 0.9, normal: 1, large: 1.1, huge: 1.2 };
  var SCALE_DEFAULT = 'normal';

  /* Числа коэффициента попадают прямо в CSS, поэтому длинный хвост двоичной
     дроби (0.96 * 1.1 = 1.0560000000000003) обязан отсекаться: два знака —
     это сотая доля кегля, меньше пикселя на 4K. */
  function round2(value) {
    return Math.round(value * 100) / 100;
  }

  /* Раскладка главной (design-spec-main §0.3/§0.4) в em базового кегля Lampa.
     Высота ряда складывается из двух частей:
       ROW_BLOCK_EM (19.4em) — то, что масштабируется вместе с карточкой:
         заголовок ряда (1.23em × 1.46 межстрочного = 1.8em), постер 2:3
         (15.12em), строка названия (1.1em) и строка меты (1.1em);
       ROW_BLOCK_FIXED (1.2em) — зазоры, заданные в em базы и от масштаба не
         зависящие: .7em под заголовком ряда и .5em под постером.
     Замер живьём при базе 22.811 и обычном масштабе: 464 px = 20.34em, формула
     даёт 20.6em — запас в 6 px, чтобы ряд не упирался в кромку экрана.
     LAMPA_ROW_PAD — padding-top у .scroll__content, который Lampa держит над
     фокусным рядом сама (57 px при 1920). LAMPA_HEAD — на столько ниже верха
     экрана начинается .activitys (высота штатной шапки Lampa). */
  var ROW_CARD_W = 10.08;
  var ROW_BLOCK_EM = 19.4;
  var ROW_BLOCK_FIXED = 1.2;
  var LAMPA_ROW_PAD = 2.5;
  var LAMPA_HEAD = 4;

  /* Правка пользователя 2026-09-17 (п.2): размер героя — настройка, а не
     константа. Дизайнские 58 % экрана на живом телевизоре оказались велики.

     Множитель применяется к ОДНОЙ величине — высоте, которую забирают ряды
     (heroCutEm): и низ кадра героя, и верх первого ряда считаются из неё,
     поэтому развести их нельзя по построению — зазор между кадром и рядом
     всегда ровно ноль. Крупный герой оставляет рядам ровно один ряд (как
     было до правки), средний и компактный отдают им больше: под первым рядом
     начинает выглядывать следующий — обычная ТВ-раскладка.

     Доля героя при 16:9 одинакова на 1920×1080 и 1280×720: em Lampa считает
     от ШИРИНЫ, поэтому вычитаемое и высота экрана растут вместе.
     Значение 'off' сюда не попадает: при нём герой не монтируется вовсе
     (src/48_hero.js), класса .lumen-main на активности нет, и раскладка
     главной остаётся штатной Lampa.

     Правка пользователя 2026-09-17 (второй круг): по умолчанию снова
     КРУПНЫЙ — «средний» на живом экране оказался мелковат. Замер долей с
     воздухом над заголовком ряда (HERO_AIR ниже): крупный — 51.4 %,
     средний — 40.1 %, компактный — 27.9 % высоты экрана. */
  var HERO_SIZES = { large: 1, medium: 1.26, compact: 1.54 };
  var HERO_DEFAULT = 'large';

  function heroFactor() {
    var key = LC.pref('lumen_hero_size', HERO_DEFAULT);
    return HERO_SIZES[key] || HERO_SIZES[HERO_DEFAULT];
  }

  /* Сколько высоты экрана забирают ряды: блок ряда (постер, две строки
     подписи и зазоры) на множитель размера героя. */
  function heroCutEm(scale) {
    return round2((ROW_BLOCK_FIXED + ROW_BLOCK_EM * scale) * heroFactor());
  }

  /* Высота области рядов главной: то, что забирают ряды, плюс отступ, который
     Lampa держит над фокусным рядом. Остальной экран достаётся герою. */
  function rowsAreaEm(scale) {
    return round2(LAMPA_ROW_PAD + heroCutEm(scale));
  }

  /* Правка пользователя 2026-09-17 (второй круг). Четыре величины, которыми
     связаны кадр героя, его текст, чипы настроения и ряды.

     HERO_COMPACT — доля сжатого героя (§0.2: 42 % против 58 %, то есть .72
       от полной высоты). Раньше это число стояло прямо в правиле.
     HERO_AIR — воздух между нижней кромкой кадра и заголовком первого ряда.
       Пользователь: «вот тут надо отступ, слишком близко к границе»; ориентир
       — полторы-две высоты строки заголовка (1.23em × 1.3 ≈ 1.6em). Воздух
       отнимается у КАДРА, а не добавляется рядам: сдвинь мы ряды вниз, и
       нижний край области уехал бы за кромку экрана вместе с подписями.
     MOODS_H / MOODS_GAP — высота полосы чипов настроения (чип .88em × 2.46em
       = 2.17em плюс собственный нижний отступ .47em) и её воздух до нижней
       кромки кадра. Полоса живёт ВНУТРИ кадра, над этой кромкой: её высота
       входит в высоту кадра, а низ текстового блока поднят над ней. Прежний
       вариант — «полоса в воздухе над рядом» — дал наложение сразу на оба
       стыка (замер пользователя, окно 1153×798: чипы 474…510 при низе кадра
       483 и верхе области рядов 482), потому что воздуха в 2.4em на полосу
       в 2.63em не хватает по определению.
     MOODS_BAR — то же самое, когда кадра нет вовсе («Герой: выключен» и
       приплюснутое окно): на эту высоту опущены ряды, иначе полоса легла бы
       на первый из них.
     HERO_HEAD_SAFE — безопасная зона сверху. Кадр героя начинается у самой
       кромки экрана и проходит ПОД штатной шапкой Lampa (замер живьём: .head
       занимает 3.8em), поэтому текст, прижатый к низу, на высоком содержимом
       упирался в заголовок активности и иконки — находка пользователя на
       низком окне: «элементы перекрывают друг друга». Блок текста ограничен
       этой зоной сверху и лишнее срезает сам.
     TEXT_* — слагаемые высоты текстового блока (каждое с собственным
       отступом сверху): мета, логотип обычный и уменьшенный, описание в две
       строки, строка рейтинга. Из них складывается бюджет: кадр, в который
       содержимое не помещается, описания не показывает, а кадр, в который не
       помещается и минимум, не показывается вовсе — ряды занимают экран
       целиком, как при «Герой: выключен». Промежуточных состояний с
       наложениями нет по построению.
     TEXT_ZOOM / TEXT_ZOOM_COMPACT — кегль содержимого кадра. Пользователь:
       «больше текст на 10 % (попробуем)» для верхнего состояния и на 3-5 %
       для сжатого. Коэффициент вешается на .lumen-hero__text, а не на сам
       кадр: его высота считается от высоты ряда, и общий кегль корня удвоил
       бы этот множитель в ней (см. правило героя ниже). Бюджеты умножаются
       на тот же коэффициент — иначе пороги считали бы старый текст. */
  var HERO_COMPACT = 0.72;
  var HERO_AIR = 2.4;
  /* Чип: высота 2.46em и нижний отступ .53em в его собственном кегле (.88em
     в верхнем состоянии, .8em в сжатом — правка третьего круга, пользователь
     попросил те же чипы и на листании, а высоты там меньше). Отсюда высота
     всей полосы в базовых em. */
  var CHIP_BOX = 2.99;
  var CHIP_ZOOM = 0.88;
  var CHIP_ZOOM_COMPACT = 0.8;
  var MOODS_H = round2(CHIP_BOX * CHIP_ZOOM);
  var MOODS_H_COMPACT = round2(CHIP_BOX * CHIP_ZOOM_COMPACT);
  var MOODS_GAP = 0.8;
  var MOODS_BAR = round2(MOODS_H + MOODS_GAP);
  var HERO_HEAD_SAFE = 4.4;
  var TEXT_BOTTOM = 1.6;
  /* В сжатом состоянии отступ снизу меньше: высоты там меньше, а полоса
     чипов теперь занимает место и в нём (правка третьего круга). */
  var TEXT_BOTTOM_COMPACT = 1.2;
  var TEXT_META = 1.06;
  /* Логотип: САМЫЙ ВЫСОКИЙ из возможных плюс .4em отступа сверху. Высота
     логотипа с правки четвёртого круга не постоянна — её считает герой по
     пропорции (LC.hero.logoBox, src/48_hero.js: равная площадь вместо равной
     высоты), а бюджет обязан покрывать потолок этой высоты (LOGO_H_MAX =
     5.2em, в сжатом состоянии и при компактном размере кадра — 5.2 × 0.65 =
     3.38em). Возьми бюджет по среднему логотипу — и высокий двухстрочный
     выдавил бы мету под верхнюю кромку текстового блока. Связь константы с
     логотипом проверяется тестом css.test.mjs «бюджет высоты под логотип». */
  var TEXT_LOGO = 5.6;
  var TEXT_LOGO_SMALL = 3.8;
  var TEXT_DESCR = 4.05;
  /* Описание в ОДНУ строку (1.05em × 1.45 плюс свой отступ сверху) — столько
     просит сжатое состояние: пользователь отметил пропажу описания на
     листании, а на две строки высоты сжатого кадра не хватает. */
  var TEXT_DESCR_ONE = 2.02;
  var TEXT_RATE = 2.62;
  var TEXT_ZOOM = 1.1;
  var TEXT_ZOOM_COMPACT = 1.04;
  /* Ниже этого отношения сторон кадр показывается при любом размере: 2.2:1 —
     заведомо за пределами обычного окна и телевизора (16:9 = 1.78, 16:10 =
     1.6, 21:9 = 2.33 уже считается приплюснутым для нашей раскладки). */
  var HERO_MIN_RATIO = 220;

  /* Сколько высоты забирают ряды у СЖАТОГО героя и какой при этом становится
     область прокрутки. Из этих двух величин ряды и поднимаются: область
     расширяется вверх ровно на то, на сколько уменьшился кадр. */
  function heroCompactCutEm(scale) {
    return round2(heroCutEm(scale) * HERO_COMPACT);
  }

  function compactAreaEm(scale) {
    return round2(LAMPA_ROW_PAD + heroCompactCutEm(scale));
  }

  /* Самый маленький размер кадра («компактный», 1.54 блока ряда) отдаёт
     тексту заметно меньше высоты, поэтому там логотип мельче, а мета-строка
     не показывается вовсе: год и хронометраж и без того написаны на карточке
     под фокусом. */
  function heroSmallText() {
    return LC.pref('lumen_hero_size', HERO_DEFAULT) === 'compact';
  }

  /* Сколько высоты просит содержимое кадра. withDescr — считать ли описание
     (две строки). Из этой величины считаются оба порога раскладки. */
  function textNeedEm(withDescr) {
    var small = heroSmallText();
    var inner = TEXT_RATE + (small ? TEXT_LOGO_SMALL : TEXT_LOGO + TEXT_META);
    if (withDescr) inner += TEXT_DESCR;
    /* Полоса чипов считается всегда: настройка «Профили настроения» включена
       по умолчанию, а пороги — одни на всю таблицу стилей. С выключенными
       чипами кадр просто получает лишний запас. */
    return round2(HERO_HEAD_SAFE + TEXT_BOTTOM + MOODS_GAP + MOODS_H + inner * TEXT_ZOOM);
  }

  /* Сколько высоты просит содержимое СЖАТОГО кадра вместе с описанием в одну
     строку. Из этой величины считается порог, ниже которого на листании
     остаются только логотип и рейтинг. */
  /* Сколько высоты просит содержимое СЖАТОГО кадра. Приоритет при нехватке
     (правка третьего круга, порядок задан пользователем): мета → логотип →
     чипы → описание, поэтому бюджет считается в двух вариантах и порогов
     тоже два: без описания мета остаётся дольше. Полоса чипов входит в оба —
     она видна и на листании. */
  function compactNeedEm(withDescr) {
    var small = heroSmallText();
    var inner = TEXT_RATE + TEXT_LOGO_SMALL + (small ? 0 : TEXT_META);
    if (withDescr) inner += TEXT_DESCR_ONE;
    return round2(HERO_HEAD_SAFE + TEXT_BOTTOM_COMPACT + MOODS_GAP + MOODS_H_COMPACT + inner * TEXT_ZOOM_COMPACT);
  }

  /* Корни, на которые вешается коэффициент. Каждый из них — самостоятельный
     узел плагина, и ни один не лежит внутри другого: карточка и слой фона —
     соседи в теле активности, ряд описания — отдельный ряд ниже карточки,
     модал отзыва живёт в .modal Lampa, хаб и сетка — свои экраны. Поэтому
     коэффициент нигде не перемножается сам на себя.
     Экранов пути до плеера (Select/Modal TorrServer, src/65_torrents.js) в
     списке нет: там наша только раскраска, а разметка и размеры — штатные
     Lampa, и растянуть её окна нашим кеглем значило бы сломать чужую
     раскладку.

     У героя главной коэффициент вешается не на корень, а на его текстовый
     блок: сам .lumen-hero — это геометрия кадра, его высота и подъём под
     шапку Lampa считаются от ЭКРАНА и от высоты ряда (см. правило героя
     ниже). Подними ему кегль — и те же em умножились бы на коэффициент
     второй раз: кадр переставал бы кончаться там, где начинается первый ряд
     (проверено живьём: при «мельче» герой накрывал ряд на 35 px, при
     «крупнее» между ними зияла полоса в 40 px). Всё, что в герое читают —
     логотип, название, мета, описание, чипы и профили настроения, — лежит
     внутри .lumen-hero__text и масштабируется вместе с ним. */
  var SCALE_ROOTS = '.lumen-card,.lumen-backdrop,.lumen-descr-row,.lumen-review-modal,.lumen-hero .lumen-hero__text,.lumen-hub,.lumen-grid,.lumen-minimap,.lumen-jump,.lumen-ambient,.lumen-roulette';

  function scaleFactor() {
    return SCALES[LC.pref('lumen_scale', SCALE_DEFAULT)] || SCALES[SCALE_DEFAULT];
  }

  /* Правка пользователя 2026-09-16 (п.6, настройка «Шрифт»): пять пар
     «текстовая гарнитура + моноширинная к ней». Заголовочная Unbounded общая
     для всех пар — это фирменный знак карточки; меняется то, что читают:
     текст и цифры. Все гарнитуры есть на Google Fonts — CSP плагина другого
     источника не пропустит. Пара, а не одна гарнитура, потому что моно
     остаётся на таймкодах и счётчиках, и семейство IBM Plex логично тянет за
     собой свой же моно; остальным парам JetBrains Mono подходит нейтрально.
     bodyW/monoW — начертания, которые реально используются в стилях
     (400/500/600 у текста, 400/600 у моно): лишние веса — лишние килобайты
     на ТВ. */
  var FONT_SETS = {
    golos: { body: 'Golos Text', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
    onest: { body: 'Onest', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
    manrope: { body: 'Manrope', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
    inter: { body: 'Inter', bodyW: '400;500;600', mono: 'JetBrains Mono', monoW: '400;600' },
    plex: { body: 'IBM Plex Sans', bodyW: '400;500;600', mono: 'IBM Plex Mono', monoW: '400;600' }
  };
  var FONT_DEFAULT = 'golos';

  var FONT_DISPLAY_ON = '"Unbounded","Arial Black",Impact,sans-serif';
  var FONT_DISPLAY_OFF = '"Arial Black",Impact,sans-serif';
  var FONT_BODY_OFF = 'inherit';
  var FONT_MONO_OFF = 'Consolas,"Courier New",monospace';

  /* Незнакомое значение (старый профиль, битый Storage) — набор по умолчанию,
     ровно как LC.prefs.boolOf не превращает мусор в «ложь». */
  function fontSet() {
    return FONT_SETS[LC.pref('lumen_font', FONT_DEFAULT)] || FONT_SETS[FONT_DEFAULT];
  }

  function bodyStack(set) {
    return '"' + set.body + '","Segoe UI",Roboto,Arial,sans-serif';
  }

  function monoStack(set) {
    return '"' + set.mono + '",Consolas,"Courier New",monospace';
  }

  /* Адрес <link> Google Fonts под выбранную пару: грузится ровно то, что
     используется (Unbounded + пара), а не все пять гарнитур сразу. */
  LC.fontsUrl = function () {
    var set = fontSet();
    return 'https://fonts.googleapis.com/css2?family=Unbounded:wght@500;700;800' +
      '&family=' + set.body.replace(/ /g, '+') + ':wght@' + set.bodyW +
      '&family=' + set.mono.replace(/ /g, '+') + ':wght@' + set.monoW +
      '&display=swap';
  };

  /* Task 24 (фаза 3): пока открыта карточка с включённой настройкой
     «Акцент от постера», её цвет переопределяет выбранный в настройках.
     LC.accent.current() отдаёт четвёрку той же формы, что записи ACCENTS
     (src/57_color.js), и null, когда переопределения нет, — поэтому ни одно
     правило ниже не знает, откуда взялся акцент. */
  function theme() {
    var auto = null;
    try {
      if (LC.accent && typeof LC.accent.current === 'function') auto = LC.accent.current();
    } catch (e) {
      warn('accent override failed', e);
    }
    if (auto) return auto;
    var key = LC.pref(PLUGIN + '_accent', 'sand');
    return ACCENTS[key] || ACCENTS.sand;
  }

  /* Task 10: выключенный плагин не должен оставлять за собой <link> на Google
     Fonts — это наш ресурс, а не Lampa. LC.applyEnabledPref (90_runtime.js)
     зовёт LC.injectFonts() на выключении, и ветка удаления срабатывает именно
     отсюда: отдельной функции снятия не нужно. */
  function useFonts() {
    return LC.enabled() && LC.pref(PLUGIN + '_fonts', true);
  }

  /* Task 32: токены наружу для CSS экранов пути (src/65_torrents.js) —
     та же палитра, текущий акцент и стеки шрифтов, что у LC.buildCss,
     читаются заново на каждый вызов (смена акцента/шрифтов без перезагрузки). */
  LC.tokens = function () {
    var t = theme();
    var P = palette();
    var fonts = useFonts();
    var set = fontSet();
    return {
      bg: P.bg, panel: P.panel, line: P.line, text: P.text, muted: P.muted, smoke: P.smoke,
      spice: P.spice, dark: P.dark,
      panelHi: P.panelHi, panelLo: P.panelLo, raised: P.raised, textRgb: P.textRgb, bgRgb: P.bgRgb,
      accent: t.color, accentRgb: hexToRgb(t.color), onac: t.onac, ring: t.light, acglow: t.glow,
      fontDisplay: fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF,
      fontBody: fonts ? bodyStack(set) : FONT_BODY_OFF,
      fontMono: fonts ? monoStack(set) : FONT_MONO_OFF
    };
  };

  LC.buildCss = function () {
    var t = theme();
    /* Палитра читается на каждую сборку: смена темы и плотности подложек —
       это пересборка CSS, без перезахода в Lampa (src/80_settings.js). */
    var P = palette();
    var A = t.color;
    var AL = t.light;
    var AG = t.glow;
    var A_RGB = hexToRgb(A);
    var fonts = useFonts();
    var set = fontSet();
    var FD = fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF;
    var FB = fonts ? bodyStack(set) : FONT_BODY_OFF;
    var FM = fonts ? monoStack(set) : FONT_MONO_OFF;

    var css = [];

    /* --- Фаза 3: масштаб интерфейса ---
       Одно правило на все корни плагина: font-size задаётся в em, то есть как
       доля базового кегля Lampa, и дальше вся вёрстка (она у нас целиком в em)
       пересчитывается сама. При «обычном» правило не выводится вовсе — так вид
       по умолчанию до последней строки совпадает с прежним. Правило стоит
       первым, но порядок здесь ни при чём: font-size корней больше нигде не
       задаётся, спорить не с чем. */
    var scale = scaleFactor();
    if (scale !== SCALES[SCALE_DEFAULT]) css.push(SCALE_ROOTS + '{font-size:' + scale + 'em}');

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
    /* Task 7 (экран 02): слой фонового трейлера — между кадрами слайдшоу и
       вуалями (порядок в DOM задаёт ensureLayer в 50_backdrops.js), поэтому
       вуали остаются поверх ролика без z-index. Растянут по вертикали на
       ±10 %, чтобы чёрные поля кадра 16:9 ушли за край экрана. Без inset —
       план запрещает (top/bottom/left/right по отдельности). Появление —
       1 с, как гаснут вуали (design-spec §12, «старт трейлера»). */
    css.push('.lumen-backdrop .lumen-bg__trailer{position:absolute;top:-10%;bottom:-10%;left:0;right:0;overflow:hidden;opacity:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
    css.push('.lumen-backdrop .lumen-bg__trailer.is-live{opacity:1}');
    css.push('.lumen-backdrop .lumen-bg__trailer iframe{width:100%;height:100%;border:0;pointer-events:none}');
    /* Task 21 (фаза 3): слой тематической атмосферы. В разметке он ПОСЛЕ
       вуалей (50_backdrops.js), поэтому частицы видны поверх затемнения —
       под вуалями снег превращался бы в серую взвесь. Клики и фокус слой не
       перехватывает (pointer-events:none) — под ним живой экран Lampa.
       Канвас держится на .82 прозрачности: атмосфера не должна спорить с
       текстом карточки, который лежит выше по DOM. */
    css.push('.lumen-backdrop .lumen-fx,.lumen-hero .lumen-fx{position:absolute;top:0;bottom:0;left:0;right:0;overflow:hidden;pointer-events:none}');
    css.push('.lumen-backdrop .lumen-fx__canvas,.lumen-hero .lumen-fx__canvas{position:absolute;top:0;left:0;width:100%;height:100%;opacity:.82}');
    /* Оверлеи тем — чистый CSS поверх частиц, без SVG-фильтров: на ТВ
       фильтр стоит отдельного прохода композитора, а градиент растеризуется
       один раз (поправки контроллера к Task 21). Класс темы ставится только
       при полных анимациях, поэтому отдельного гейта по motion тут нет.

       Гирлянда «рождества» — десять огоньков по дуге вдоль верхней кромки
       (экран 27). Позиции по горизонтали 5…95 %, по вертикали — точки
       квадратичной кривой (0,10)-(500,90)-(1000,10) из макета, пересчитанные
       в em: y = (10 + 160·t·(1−t)) / 30. Так дуга провисает к середине
       ровно как на макете, а сама гирлянда остаётся одним фоном. */
    var LIGHT = 'rgba(255,214,150,.42) 0%,rgba(255,182,72,.14) 45%,rgba(255,182,72,0) 72%';
    var garland = [
      'radial-gradient(circle 1.1em at 5% .59em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 15% 1.01em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 25% 1.33em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 35% 1.55em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 45% 1.65em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 55% 1.65em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 65% 1.55em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 75% 1.33em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 85% 1.01em,' + LIGHT + ')',
      'radial-gradient(circle 1.1em at 95% .59em,' + LIGHT + ')'
    ].join(',');
    css.push('.lumen-backdrop.lumen-theme--christmas .lumen-fx,.lumen-hero.lumen-theme--christmas .lumen-fx{background-image:' + garland + ';background-repeat:no-repeat;background-position:top center;background-size:100% 4em}');
    /* «Хэллоуин» — тыквенный свет снизу (экран 27): тёплое зарево от нижней
       кромки, гаснущее к трети высоты. */
    css.push('.lumen-backdrop.lumen-theme--halloween .lumen-fx,.lumen-hero.lumen-theme--halloween .lumen-fx{background-image:linear-gradient(0deg,rgba(224,123,44,.20) 0%,rgba(224,123,44,.07) 14%,rgba(224,123,44,0) 34%)}');
    /* Остальные темы обходятся частицами: у «космоса» и «нуара» градиент
       поверх кадра спорил бы с вуалями, и в макете его нет. */
    /* Пока играет ролик, вуали приглушаются (экран 02 держит их заметно
       светлее обычных: .34/.55/.28 против .96/.98/.70) — текст остаётся
       читаемым, но кадр видно. */
    css.push('.lumen-backdrop.lumen-trailer-live .lumen-backdrop__veil{opacity:.45}');
    css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
    css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(' + P.bgRgb + ',0.96) 0%,rgba(' + P.bgRgb + ',0.88) 30%,rgba(' + P.bgRgb + ',0.35) 58%,rgba(' + P.bgRgb + ',0) 82%)}');
    css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(' + P.bgRgb + ',0.98) 0%,rgba(' + P.bgRgb + ',0.60) 28%,rgba(' + P.bgRgb + ',0) 60%)}');
    css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(' + P.bgRgb + ',0.70) 0%,rgba(' + P.bgRgb + ',0) 22%)}');
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
    css.push('.lumen-backdrop.lumen-bg--blur{background:' + P.gradBlur + '}');
    css.push('.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img{background-position:50% 50%;opacity:.8}');
    css.push('.lumen-backdrop.lumen-motion-full.lumen-bg--blur .lumen-backdrop__img{-webkit-filter:blur(1.75em);filter:blur(1.75em);-webkit-transform:scale(1.1);transform:scale(1.1)}');
    css.push('.lumen-backdrop.lumen-motion-lite.lumen-bg--blur .lumen-backdrop__img,.lumen-backdrop.lumen-motion-off.lumen-bg--blur .lumen-backdrop__img{-webkit-transform:none;transform:none}');
    css.push('.full-start__background.lumen-off{display:none !important}');

    /* --- Корень карточки --- */
    /* Task 5a Step 4 (design-spec §1): safe area 64px по всем краям (÷22.811 = 2.81em). */
    css.push('.full-start-new.lumen-card{position:relative;padding:0 2.81em 2.81em;color:' + P.text + ';font-family:' + FB + '}');
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
    css.push('.lumen-card.lumen-card--poster .full-start-new__poster{border-radius:.61em;overflow:hidden;background:' + P.gradPoster + ';border:.04em solid ' + P.line + ';box-shadow:0 .88em 2.63em rgba(0,0,0,.6)}');
    css.push('.lumen-card.lumen-card--poster .full-start-new__img{border-radius:.61em}');
    css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{position:absolute;left:0;right:0;bottom:0;padding:0 1.05em 1.05em;font-family:' + FD + ';font-weight:600;font-size:.88em;line-height:1.3;color:' + P.smoke + '}');
    css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:74vh}');
    css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');
    /* Правка пользователя 2026-09-16 (п.1): боковой колонки .lumen-side больше
       нет — кружки «В ролях» дублировали ряд актёров, который Lampa рисует
       ниже (и показывали инициалы вместо фотографий), а статус фильма
       («Выпущенный») пользователю не нужен. Вместе с колонкой ушла и сетка из
       двух колонок: у .lumen-content остался один поток из шести .lumen-in,
       поэтому здесь простой блок. Так после удаления колонки контент занимает
       освободившееся место без «дыры» справа: пустая дорожка auto вместе с
       column-gap оставляла бы 60px мёртвой зоны у правого края.
       Заодно отпал и фолбэк @supports not (display:grid) — держать раскладку
       на Chromium < 57 больше нечем: блочный поток одинаков везде.
       Stagger Task 4 (nth-child(1..6)) не затронут: .lumen-in остаются
       прямыми соседями в том же порядке, а .lumen-side был седьмым. */
    css.push('.lumen-card .lumen-content{display:block}');
    css.push('.lumen-card .lumen-content > .lumen-in{max-width:52em}');

    /* Скрытые узлы оригинала (нужны Lampa, но не нужны дизайну) */
    css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
    css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
    css.push('.lumen-card .full-start__pg{display:none !important}');

    /* --- Мета-строка (design-spec §2: 20px, gap 12px, разделитель #2C231D) ---
       Правка пользователя 2026-09-16 (п.6): гарнитура основная, не моноширинная.
       Цифр, которые надо выравнивать по колонкам, здесь нет (год, хронометраж и
       жанры идут сплошной строкой), а моно давало всей шапке вид консоли. */
    css.push('.lumen-card .lumen-meta{font-family:' + FB + ';font-size:.88em;color:' + P.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    css.push('.lumen-card .lumen-meta > *{margin:0 .53em .2em 0}');
    css.push('.lumen-card .lumen-meta__sep{color:' + P.line + '}');

    /* --- Заголовок (design-spec §3: 88px, line-height 1.02, letter-spacing -.015em;
       .lumen-title--long меняет только line-clamp — кегль не уменьшается, как на
       экране 01; заменяет разбор по нативному .twolines из v1) --- */
    css.push('.lumen-card .full-start-new__title{font-family:' + FD + ';font-size:3.86em;font-weight:800;line-height:1.02;letter-spacing:-.015em;margin:.70em 0 0 -.02em}');
    /* Ревью Task 5a: line-clamp не работает без полной тройки display/box-orient/
       overflow (иначе длинный заголовок не обрезается многоточием вовсе). */
    css.push('.lumen-card .full-start-new__title.lumen-title--long{display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}');
    /* Правка пользователя 2026-09-16 (п.2): оригинальное название из шапки
       убрано вместе с узлом .lumen-original — оно дублировало строку
       «Оригинал» таблицы «ПОДРОБНО», которая и есть нужное для него место. */

    /* --- Описание (design-spec §4: 24px, max-width 980px, margin-top 20px) --- */
    css.push('.lumen-card .lumen-descr{font-size:1.05em;line-height:1.45;color:' + P.muted + ';max-width:42.96em;margin-top:.88em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}');

    /* --- Рейтинги (design-spec §5a: колонка значение/подпись, тёмная карта) --- */
    css.push('.lumen-card .full-start-new__rate-line{margin:1.05em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:stretch;-webkit-align-items:stretch;align-items:stretch;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    /* !important обязателен: у Lampa в native-scss .full-start-new__rate-line > *
       уже есть margin-left:0 !important;margin-right:1em !important (harness/
       start_new.scss) — обычной специфичностью её не перебить, только другим
       !important. */
    css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .53em .53em 0 !important}');
    css.push('.lumen-card .full-start__rate{font-family:' + FM + ';background:' + P.chipBg + ';border:.04em solid ' + P.line + ';border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
    css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.23em;font-weight:600;line-height:1;color:' + P.text + '}');
    css.push('.lumen-card .full-start__rate > div:last-child{font-size:.61em;letter-spacing:.1em;color:' + P.smoke + ';padding:.18em 0 0}');
    /* Чип «РЕАКЦИЙ» (fire) — та же геометрия что рейтинги, акцент «спайс», design-spec §5d/5f. */
    css.push('.lumen-card .lumen-reactions-chip{font-family:' + FM + ';background:rgba(' + SPICE_RGB + ',.12);border:.04em solid rgba(' + SPICE_RGB + ',.5);border-radius:.53em;padding:.44em .70em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
    css.push('.lumen-card .lumen-reactions-chip__value{font-size:1.23em;font-weight:600;line-height:1;color:' + P.spice + '}');
    css.push('.lumen-card .lumen-reactions-chip__label{font-size:.61em;letter-spacing:.1em;opacity:.8;color:' + P.spice + ';padding:.18em 0 0}');
    /* Task 5c (design-spec §5e, экран 05): вместо штатного tag--episode (свой
       формат строки Lampa «Следующая серия: … / Осталось дней: …») — чип
       .lumen-next-chip: тёмная карта как у рейтингов, часы 22px маской, текст
       18px Golos 500. em внутри чипа — от его 18px: радиус 12px=.67em, паддинг
       16px=.89em, иконка 22px=1.22em, зазор 10px=.56em. */
    css.push('.lumen-card .full-start-new__rate-line .tag--episode{display:none !important}');
    /* Правка пользователя 2026-09-16 (п.1): статус переехал из боковой колонки
       в ленту рейтингов и по умолчанию не показывается. У фильма он говорит
       «Выпущенный» — бесполезно; у сериала («Выходит», «Завершён») смысл есть,
       и его возвращает правило .lumen-card--serial ниже: у него на класс
       больше, поэтому оно выигрывает независимо от порядка. Порядок всё же
       соблюдён — правило сериала объявлено следующим. */
    css.push('.lumen-card .full-start-new__rate-line .full-start__status{display:none}');
    css.push('.lumen-card .lumen-next-chip{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;color:' + P.text + ';background:' + P.chipBg + ';border:.05em solid ' + P.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
    css.push('.lumen-card .lumen-next-chip:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.56em;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('clock') + ';mask-image:' + LC.icons.maskUrl('clock') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
    /* Task 5c Step 2 (design-spec §8, экран 05): у сериала статус перенесён в
       ленту рейтингов (LC.header renderSerialMode) — там он карта с точкой той
       же геометрии, что чип следующей серии, а не пилюля боковой колонки. */
    css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status{font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1;letter-spacing:normal;text-transform:none;color:' + P.text + ';background:' + P.chipBg + ';border:.05em solid ' + P.line + ';border-radius:.67em;padding:0 .89em;white-space:nowrap;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
    css.push('.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.56em;height:.56em;border-radius:50%;background:currentColor;margin-right:.56em}');

    /* --- Продолжить (design-spec §6, экраны 01/05) ---
       Task 8: подпись — ОДНА строка над полосой («01:12 / 02:46 · 43 %» у
       фильма, «S2 E3 «Голова» · 18:40 / 58:12 · 32 %» у сериала), а не метка
       слева и время справа, как было в v1. Узлов в шаблоне два (__label —
       серия, __time — таймкод), поэтому строку собирает flex-wrap: оба текста
       встают рядом, а полоса (flex-basis 100 %) переносится под них. Пустой
       узел убирается :empty — иначе у фильма остался бы зазор от __time.
       Числа §6: ширина 760px = 33.32em, кегль 18px = .79em, цвет muted,
       трекинг .04em, зазор до полосы 10px = .44em, полоса 4px/2px. */
    css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:33.32em;max-width:100%;margin-top:1.05em;font-family:' + FM + ';font-size:1em;color:' + P.muted + ';letter-spacing:.04em}');
    css.push('.lumen-card .lumen-progress__label{font-size:.79em;line-height:1;color:' + P.muted + '}');
    css.push('.lumen-card .lumen-progress__time{font-size:.79em;line-height:1;color:' + P.muted + ';margin-left:.35em}');
    css.push('.lumen-card .lumen-progress__label:empty,.lumen-card .lumen-progress__time:empty{display:none}');
    css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:0;-webkit-flex:0 0 100%;flex:0 0 100%;width:100%;height:.18em;background:rgba(' + P.textRgb + ',0.16);border-radius:.09em;overflow:hidden;margin:.44em 0 0}');
    css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;border-radius:.09em;background:' + A + '}');

    /* Task 8 (экран 05): «Продолжить S2 E3» на кнопке «Смотреть». Текст кнопки
       не трогается ничем — её outerHTML хэширует Lampa (план 0.2), поэтому
       подпись рисует псевдоэлемент :after (:before занят маской иконки,
       Task 3), а сама строка приходит переменной --lumen-play-label с корня
       карточки (LC.header). Штатный span гасится ТОЛЬКО там, где переменные
       поддерживаются: на старом WebView без них :after не покажет ничего, и
       кнопка обязана остаться с родным текстом. В режиме трейлера (экран 02)
       подписи нет — там кнопка снова «Смотреть», поэтому :not(.lumen-trailer-on). */
    css.push('.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play:after{content:var(--lumen-play-label);font-size:1.05em;line-height:1;margin-left:.53em;white-space:nowrap}');
    css.push('@supports (--lumen-probe:0){.lumen-card.lumen-continue:not(.lumen-trailer-on) .full-start-new__buttons .button--play span{display:none}}');

    /* --- Кнопки (design-spec §7a-c: 72px, тёмная карта, blur, раскрытие подписи в фокусе) --- */
    /* Ревью Task 5a: margin-top был остатком базы 16 (1.75em = 28/16, v1).
       Дизайн (экран 01, ряд кнопок после «Продолжить»): 32px ÷ 22.811 = 1.40em. */
    css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.40em;overflow:visible}');
    /* Task 4: пружина фокуса — transform на кривой с перелётом (overshoot), background/color/box-shadow отдельно. Разметка и outerHTML кнопок не менялись (хэш приоритета, см. 0.2).
       Task 5a: ширина/паддинг/фон/бордер/blur — под дизайн; у иконочных кнопок ширина/паддинг
       ещё и анимированы (раскрытие подписи в фокусе, §7c) — transition здесь общий для всех. */
    css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:3.16em;min-width:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';' + P.blur + 'color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:width .2s,padding .2s,background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.14em;height:1.14em;-webkit-flex-shrink:0;flex-shrink:0}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.05em;margin:0 0 0 .53em;line-height:1}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
    css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span,.lumen-card .full-start-new__buttons .view--trailer span{display:block}');

    /* --- Task 18: штатная кнопка «Трейлер» (design-spec-card §13 п.9, экран 01) ---
       Разметка кнопки не трогается вовсе — ни класса, ни атрибута: её
       outerHTML хэширует Lampa (план 0.2). Показ целиком на CSS:
        - .buttons--container переехал внутрь ряда кнопок (40_template.js) и
          остался .hide, то есть display:none !important. Перебить его можно
          только своим !important — отсюда три строки display у контейнера;
        - ВСЕ его дети скрыты по умолчанию (селектор на класс кнопки,
          специфичность выше базового правила .full-start__button): кнопки
          чужих плагинов, которые Lampa и Online Mod кладут в контейнер
          (.view--online_mod и подобные), обязаны остаться там же, где были,
          — их путь к пользователю прежний, через «Смотреть»;
        - показывается ровно один ребёнок, .view--trailer, и только когда на
          корне есть lumen-card--trailer (его ставит LC.trailer.reveal, когда
          pickTrailer нашёл ролик). Настройка lumen_trailer здесь ни при чём:
          она управляет ФОНОВЫМ роликом, а кнопка — осознанное действие
          пользователя и работает даже при lumen_trailer=off.
       .view--torrent скрыт вдвойне — своим собственным .hide.
       Всё остальное (габариты, фон, фокус, иконка-маска) кнопка получает от
       общих правил .full-start__button и src/20_icons.js. */
    css.push('.lumen-card .full-start-new__buttons > .buttons--container{-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-order:1;order:1}');
    css.push('.lumen-card .full-start-new__buttons > .buttons--container > .full-start__button{display:none}');
    css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container{display:-webkit-box !important;display:-webkit-flex !important;display:flex !important}');
    css.push('.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container > .view--trailer{display:-webkit-box;display:-webkit-flex;display:flex}');
    /* Порядок ряда (экран 01): «Смотреть», «Трейлер», дальше иконочные.
       Контейнер лежит в разметке ПОСЛЕДНИМ (переносить сами кнопки нельзя),
       поэтому вторым местом он становится через order — и иконочные кнопки
       уезжают за него. Клон приоритетной кнопки Lampa (.button--priority,
       prepend в ряд) остаётся с order 0 и идёт первым, как и раньше. */
    css.push('.lumen-card .full-start-new__buttons > .button--book,.lumen-card .full-start-new__buttons > .button--reaction,.lumen-card .full-start-new__buttons > .button--subscribe,.lumen-card .full-start-new__buttons > .button--options{-webkit-order:2;order:2}');

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
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + A + ';color:' + P.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    /* Нажатие — отдельный тон, без scale (design-spec §7a «НАЖАТА»); !important —
       поверх правила .focus выше и нативной анимации Lampa (план 0.2). */
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:#C4924F !important;border-color:rgba(255,242,220,.6) !important;-webkit-transform:scale(1) !important;transform:scale(1) !important}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.loading:before{filter:none}');

    /* --- Task 7: режим фонового трейлера (экран 02) ---
       Кнопка «Стоп» и метка появляются только на время ролика (их создаёт и
       удаляет src/55_trailer.js), поэтому display по умолчанию none — на
       случай, если узел пережил остановку. Геометрия кнопки — та же, что у
       текстовых кнопок карточки (§7a, 72px/18px/30px ÷ 22.811), но тёмная
       «стеклянная» заливка экрана 02 вместо общей P.buttonBg. */
    css.push('.lumen-card .lumen-stop{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:0 .70em .6em 0;border-radius:.79em;border:.04em solid rgba(' + P.textRgb + ',.2);background:' + P.glass + ';' + P.blur + 'color:' + P.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    /* Выравнивание по вертикали: в flex(.lumen-actions, align-items:center)
       центр content-box = center_line + (MT−MB)/2.
       Кнопки ряда (MT=0, MB=0.6em) → offset −0.3em от центра ряда.
       Ряд .full-start-new__buttons (MT=1.40em, MB=0) → center_row = center_actions+0.7em.
       Итого центр кнопок ряда = center_actions+0.4em.
       «Стоп»: MT=1.40em, MB=0.6em → (1.40−0.6)/2=0.4em ✓.
       MB=0.6em задан явно — Chrome-CSSOM при одном MT-longhand обнуляет MB. */
    css.push('.lumen-card.lumen-trailer-on .lumen-stop{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:1.40em;margin-bottom:.6em}');
    css.push('.lumen-card .lumen-stop__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('stop') + ';mask-image:' + LC.icons.maskUrl('stop') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
    css.push('.lumen-card .lumen-stop span{font-size:1.05em;line-height:1}');
    css.push('.lumen-card .lumen-stop.focus{background:' + A + ';color:' + P.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    /* Метка «ТРЕЙЛЕР · БЕЗ ЗВУКА»: экран 02 — top 112px, right 64px, mono 18px,
       радиус 30px, паддинг 10/18px; внутренние em — от кегля метки (÷18). */
    /* Правка 2026-09-16, п.6: метка — текст без цифр, гарнитура основная. */
    css.push('.lumen-card .lumen-trailer-badge{display:none;position:absolute;top:4.91em;right:2.81em;z-index:6;font-family:' + FB + ';font-size:.79em;line-height:1;letter-spacing:.06em;color:' + P.text + ';background:' + P.badge + ';border:.05em solid rgba(' + P.textRgb + ',.2);border-radius:1.67em;padding:.56em 1em;' + P.blurWide + '-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
    css.push('.lumen-card.lumen-trailer-on .lumen-trailer-badge{display:-webkit-box;display:-webkit-flex;display:flex}');
    css.push('.lumen-card .lumen-trailer-badge:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.22em;height:1.22em;margin-right:.67em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('mute') + ';mask-image:' + LC.icons.maskUrl('mute') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
    /* Компактная шапка экрана 02: заголовок 42px ÷ 22.811 = 1.84em, описание,
       лента рейтингов, боковая колонка и ряд серий убраны — на экране их нет.
       Шестой .lumen-in (реакции + кнопки + ряд серий) становится строкой,
       чтобы «Стоп» встал рядом с рядом кнопок, а не под ним. */
    css.push('.lumen-card.lumen-trailer-on .full-start-new__title{font-size:1.84em;opacity:.92}');
    /* Task 8: строки «Продолжить» на экране 02 тоже нет — под роликом остаются
       только заголовок, мета-строка и ряд кнопок. */
    css.push('.lumen-card.lumen-trailer-on .lumen-descr,.lumen-card.lumen-trailer-on .full-start-new__rate-line,.lumen-card.lumen-trailer-on .lumen-episodes,.lumen-card.lumen-trailer-on .lumen-progress{display:none !important}');
    css.push('.lumen-card.lumen-trailer-on .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');

    /* --- Точка статуса (design-spec §8): красится только маркер, текст всегда
       нейтральный. Сама карта статуса описана выше, в ленте рейтингов. --- */
    css.push('.lumen-card .lumen-status--good:before{color:' + P.good + '}');
    css.push('.lumen-card .lumen-status--accent:before{color:' + A + '}');
    css.push('.lumen-card .lumen-status--muted:before,.lumen-card .lumen-status--soon:before{color:' + P.smoke + '}');
    /* Правка пользователя 2026-09-16 (п.1): раздельные чипы качества (4K/HDR/BD,
       design-spec §5c) переехали из боковой колонки в ленту рейтингов —
       последним её элементом. Лента тянет детей по высоте (align-items:stretch),
       поэтому чипы центрируются внутри своего держателя, а зазор у них теперь
       справа, а не слева: в ленте они идут слева направо, как рейтинги.
       Штатный узел tag--quality остаётся в разметке (Lampa в него пишет), но
       по-прежнему скрыт — видимые чипы рисует renderQualityChips. */
    css.push('.lumen-card .full-start-new__rate-line .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
    css.push('.lumen-card .lumen-tags .full-start__tag{display:none !important}');
    /* Правка 2026-09-16 (п.6): «4K · HDR · BD» — метки, а не колонка цифр;
       моно здесь только добавлял карточке вид консоли. */
    css.push('.lumen-card .lumen-quality-chip{font-family:' + FB + ';font-weight:600;font-size:.66em;letter-spacing:.08em;color:' + P.text + ';border:.04em solid rgba(' + P.textRgb + ',.24);border-radius:.31em;padding:.31em .48em;margin:0 .35em .35em 0;white-space:nowrap}');

    /* --- Ряд серий сезона (design-spec §9, экраны 05/06; px ÷ 22.811) ---
       Заголовок «Сезон 2» 28px Unbounded 700 + «8 СЕРИЙ» 16px mono smoke;
       карточка 340×150, radius 14, padding 18, зазор 16. Дорожка — absolute
       внутри viewport фиксированной высоты: длинный ряд не раздувает
       колонку (и flex-фолбэк без grid), выходит за правый край экрана и
       сдвигается transform'ом к фокусу (LC.header scrollToEpisode). */
    css.push('.lumen-card .lumen-episodes{margin-top:1.75em}');
    css.push('.lumen-card .lumen-episodes__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;margin-bottom:.79em}');
    css.push('.lumen-card .lumen-episodes__title{font-family:' + FD + ';font-weight:700;font-size:1.23em;line-height:1;color:' + P.text + ';margin-right:.5em}');
    css.push('.lumen-card .lumen-episodes__count{font-family:' + FM + ';font-size:.70em;line-height:1;letter-spacing:.12em;text-transform:uppercase;color:' + P.smoke + '}');
    css.push('.lumen-card .lumen-episodes__viewport{position:relative;height:6.58em}');
    css.push('.lumen-card .lumen-episodes__track{position:absolute;top:0;left:0;height:100%;display:-webkit-box;display:-webkit-flex;display:flex}');
    css.push('.lumen-card .lumen-episode{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:14.9em;height:6.58em;margin-right:.70em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:.61em;padding:.79em;overflow:hidden;background:' + P.gradSlate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');
    css.push('.lumen-card .lumen-episode__still{position:absolute;top:0;right:0;bottom:0;left:0;background-position:50% 50%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:.28}');
    css.push('.lumen-card .lumen-episode__top{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:1.40em}');
    css.push('.lumen-card .lumen-episode__num{font-family:' + FM + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;color:' + P.smoke + '}');
    css.push('.lumen-card .lumen-episode__check{width:.88em;height:.88em;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
    css.push('.lumen-card .lumen-episode__percent{font-family:' + FM + ';font-size:.66em;line-height:1;color:' + A + '}');
    css.push('.lumen-card .lumen-episode__play{display:none;position:relative;width:1.40em;height:1.40em;border-radius:50%;background:' + A + '}');
    css.push('.lumen-card .lumen-episode__play:before{content:"";position:absolute;top:50%;left:50%;width:.75em;height:.75em;margin:-.375em 0 0 -.33em;background-color:' + P.dark + ';-webkit-mask-image:' + LC.icons.maskUrl('play') + ';mask-image:' + LC.icons.maskUrl('play') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
    css.push('.lumen-card .lumen-episode__bottom{position:relative;min-width:0}');
    css.push('.lumen-card .lumen-episode__name{font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1.2;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    css.push('.lumen-card .lumen-episode__caption{font-family:' + FM + ';font-size:.70em;line-height:1;color:' + P.smoke + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    css.push('.lumen-card .lumen-episode__bar{height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.16);margin-top:.44em;overflow:hidden}');
    css.push('.lumen-card .lumen-episode__bar > div{height:100%;border-radius:.09em;background:' + A + '}');
    /* Состояния §9: просмотрена — приглушена; смотрите — тёплый фон, номер и %
       акцентом; не вышла — полупрозрачная карта с пунктиром, текст smoke. */
    css.push('.lumen-card .lumen-episode--watched{opacity:.6}');
    css.push('.lumen-card .lumen-episode--watching{background:' + P.gradWatching + ';border-color:#303552}');
    css.push('.lumen-card .lumen-episode--watching .lumen-episode__num{color:' + A + '}');
    css.push('.lumen-card .lumen-episode--watching .lumen-episode__caption{color:' + P.muted + '}');
    css.push('.lumen-card .lumen-episode--soon{background:rgba(' + P.panelRgb + ',.35);border:.07em dashed ' + P.line + '}');
    css.push('.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + P.smoke + '}');
    /* Фокус (экран 06): обводка 3px акцентом, тёплый фон, свечение, scale 1.03;
       бейдж уступает место кружку play. Lampa не анимирует .lumen-episode
       своими keyframes, поэтому transform без !important. */
    /* Ревью (п.10): рамка растёт .04 -> .13em, поэтому паддинг .79 -> .70em —
       сумма .83em та же, содержимое карточки в фокусе не съезжает. */
    css.push('.lumen-card .lumen-episode.focus{opacity:1;background:' + P.gradFocus + ';border:.13em solid ' + A + ';padding:.70em;-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    css.push('.lumen-card .lumen-episode.focus .lumen-episode__play{display:block}');
    css.push('.lumen-card .lumen-episode.focus .lumen-episode__check,.lumen-card .lumen-episode.focus .lumen-episode__percent{display:none}');
    css.push('.lumen-card .lumen-episode.focus .lumen-episode__name{font-weight:600}');
    /* Task 8 (экран 06): в сжатой шапке фокусная серия подписана иначе —
       «E3 · СМОТРИТЕ» вместо «E3» и таймкод «18:40 / 58:12 · 32 %» вместо
       «смотрите · осталось 39 мин». Узлы рисует LC.header у каждой начатой
       серии и по умолчанию они скрыты: показывает их только эта пара условий
       (сжатая шапка + фокус). Класс .lumen-progress-on ставит renderProgress
       по настройке lumen_card_progress — выключатель гасит и эти надписи.
       margin-right:auto прижимает «· СМОТРИТЕ» к номеру серии, оставляя кружок
       play у правого края (в .lumen-episode__top — space-between). */
    css.push('.lumen-card .lumen-episode__state{display:none;font-family:' + FM + ';font-weight:600;font-size:.75em;line-height:1;letter-spacing:.1em;text-transform:uppercase;color:' + A + ';margin:0 auto 0 .35em}');
    css.push('.lumen-card .lumen-episode__timecode{display:none;font-family:' + FM + ';font-size:.70em;line-height:1;color:' + P.muted + ';margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__state,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__timecode{display:block}');
    css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{display:none}');
    /* Движок без масок: пустые закрашенные квадраты вместо иконок не рисуем. */
    css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-next-chip:before,.lumen-card .lumen-episode__check,.lumen-card .lumen-episode__play:before{display:none}}');

    /* --- Ряд описания: полное описание + таблица «ПОДРОБНО» (design-spec §10,
       экран 07; px ÷ 22.811) ---
       Корень — .lumen-descr-row: ряд описания строит сама Lampa (компонент
       'description'), он лежит ОТДЕЛЬНЫМ items-line ниже шапки, вне
       .lumen-card, поэтому корнем карточки эти правила не ограничить. Класс
       вешает LC.header.descr на узел ряда — без него ни одно правило ниже на
       чужую разметку не действует.
       Описание 24px/1.45 в колонке 980px = 42.96em, зазор до панели 80px =
       3.51em, панель не уже 450px = 19.73em. Штатный .full-descr__details
       (Дата выхода / Бюджет / Страны) скрыт — это ровно то, что теперь
       показывает наша таблица; .full-descr__tags (жанры, студии) остаётся:
       там живут .selector, их убирать нельзя — сломается навигация пультом. */
    /* Ревью Task 5d (п.2): штатный заголовок ряда — «Подробно» (Descriptiopn.
       create(): Template.get('items_line', {title: Lang.translate('full_detail')}),
       lang/ru.js = «Подробно»), он дублировал бы нашу метку панели из §10.
       Скрываем именно __head, а не __title: у head свои margin-bottom и
       горизонтальный padding, от __title осталась бы пустая полоса. .selector
       внутри head у ряда описания нет — навигация не затрагивается. */
    /* Ревью Task 5d (M1): дочерний комбинатор — прячем ТОЛЬКО собственный
       заголовок ряда описания. Потомковый селектор задел бы вложенный
       items_line, если блок отзывов Task 9 соберут внутри .full-descr — тот
       молча остался бы без заголовка. */
    css.push('.lumen-descr-row > .items-line__head{display:none}');
    /* --- Правка пользователя 2026-09-16, п.3: «полоса» под рядом описания ---
       Раньше читаемость поверх светлого кадра давала сплошная вуаль всего ряда
       (rgba(bg,.9) с растушёвкой первого em). На тёмном кадре она читалась как
       лишняя горизонтальная полоса поперёк экрана: у неё край во всю ширину
       вьюпорта, и именно градиентная кромка делала его заметным — полоса
       меняющейся яркости видна там, где ровный стык ещё нет.
       Вуаль ряда убрана совсем. Читаемость дают локальные подложки СТРОГО по
       границам своих блоков — описание, таблица «ПОДРОБНО» и заголовок ряда
       отзывов: это скруглённые карты по содержимому, границ во всю ширину
       экрана у них нет по построению. Цвет тот же фоновый rgba(bg,.85), так
       что над тёмной областью карты практически не видны, а над светлым кадром
       работают как плотная подложка (замеры — в отчёте и design-spec §10).
       Прочее содержимое ряда своей подложкой уже обладает: карточки отзывов и
       панель-подсказка непрозрачны, штатные .full-descr__tag Lampa рисует на
       собственном rgba(0,0,0,.3) и лежат они в левой, самой затенённой вуалью
       кадра части экрана. --- */
    /* Правка 2026-09-16, п.5: боковой отступ ряда — как у шапки карточки
       (2.81em = 64px safe area, §1). Штатные у Lampa 1.5em (34px), из-за чего
       описание начиналось заметно левее заголовка и кнопок. Единица та же
       (em от базового кегля Lampa), поэтому отступ масштабируется вместе со
       всей раскладкой — и на 1280, и на 4K. */
    css.push('.lumen-descr-row .full-descr{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;-webkit-flex-wrap:wrap;flex-wrap:wrap;padding-left:2.81em;padding-right:2.81em}');
    /* Правка 2026-09-16, п.4: колонка описания — ровно 980px (§10), таблица
       забирает остаток строки справа. Раньше у левой колонки был flex:1 1 auto:
       она растягивалась на всё свободное место, текст внутри упирался в свой
       max-width, и между текстом и прижатой к правому краю таблицей зияло
       ~370px пустоты. Теперь базис левой колонки — те самые 42.96em, ограниченные
       max-width, а весь избыток свободного места по правилам flexbox достаётся
       таблице (её max-width нет): зазор равен заданным §10 80px, таблица стоит
       справа и не «вжата». align-items:flex-start (выше) держит верх таблицы на
       одной линии с первой строкой описания. */
    css.push('.lumen-descr-row .full-descr__left{-webkit-box-flex:1;-webkit-flex:1 1 42.96em;flex:1 1 42.96em;max-width:42.96em;min-width:0;margin-right:3.51em}');
    /* Ревью Task 5d (п.1): у Lampa на .full-descr__text висят max-height (70vh,
       следом 41vh) и mask-image с прозрачным низом (vendor/lampa/css/app.css) —
       маска применяется ВСЕГДА, поэтому низ описания выцветал на любой карточке,
       а типовой текст обрезался на 41vh. Маску снимаем совсем (обе записи, у
       движков ТВ работает именно префиксная), высоту — поднимаем до 70vh, а не
       до none.

       Почему не none (ревью 2, Important 1; проверено живьём, overview 6750
       символов при вьюпорте 1080): без предела текст вырастает до 3159px, ряд —
       до 3340px, и .full-descr__tags уезжают на top 4356. Прокрутка контента у
       Lampa происходит только при переключении РЯДА (Items.onAppend ->
       scroll.update), а Descriptiopn.toggle на 'down' делает лишь
       Navigator.move('down') без прокрутки — фокус на теги уходит (класс .focus
       появляется), но экран не двигается, и жанры/студии становятся физически
       недостижимы. 70vh (756px) оставляет ряд в пределах экрана: текст + теги +
       отступы ~900px < 1080. На типовом описании TMDB (300-1500 знаков) предел
       не достигается вовсе — §10 требует отсутствия выцветания и обрезки на
       типовом тексте, а не буквального max-height:none. */
    /* Правка 2026-09-16, п.3: собственная подложка описания вместо вуали всего
       ряда. Паддинг и радиус — в em СОБСТВЕННОГО кегля узла (1.05em базового):
       .75em = 18px и 1em = 24px повторяют внутренние отступы .lumen-facts,
       .58em = 14px — тот же радиус .61em соседних карт. box-sizing обязателен,
       иначе паддинг раздул бы колонку описания сверх 980px. */
    css.push('.lumen-descr-row .full-descr__text{-webkit-box-sizing:border-box;box-sizing:border-box;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + P.text + ';max-width:42.96em;width:auto;max-height:70vh;padding:.75em 1em;border-radius:.58em;background:' + P.plate + ';-webkit-mask-image:none;mask-image:none}');
    css.push('.lumen-descr-row .full-descr__details{display:none}');
    /* --- Правка пользователя 2026-09-16 (осознанное отступление от §10) ---
       §10 задаёт подписи таблицы цветом smoke, рассчитывая на тёмный фон. Но
       ряд описания лежит ПОВЕРХ кадра: у светлого бэкдропа («Дюна» — оранжевая
       пустыня) подписи практически сливались с фоном — замеренный контраст
       smoke #7A6A5A к пикселю кадра #E08A3C всего 2.06:1, на ТВ с трёх метров
       читать нечем. Поэтому здесь:
         1) у блока своя плотная подложка с рамкой и радиусом соседних карт.
            Без backdrop-filter — блюр на ТВ дорог (то же решение, что у пилюли
            предзагрузки в Task 32);
         2) подписи и заголовок подняты smoke -> muted;
         3) кегль .79em -> .88em (20px) — правило проекта «приглушённый текст
            не мельче 20px», уже применённое на экранах TorrServer.
       Контраст подписи muted #A89A8A к подложке: 7.2:1 поверх вуали ряда (любой
       кадр) и 4.9:1 в худшем случае голого белого кадра — обе цифры выше порога
       4.5:1, целевые 7:1 достигаются в реальной раскладке. Значения остаются
       text #F3EDE4 (17:1). Чтобы блок не распух от большего кегля, вертикальный
       ритм сжат: row-gap .44 -> .35em, отступ заголовка .88 -> .79em. */
    /* Правка 2026-09-16, п.4: таблица забирает остаток строки справа
       (flex:1 1 19.73em вместо flex-shrink:0) — при базисе левой колонки 980px
       свободного места на 1920 остаётся ~280px, и без роста они превращались бы
       в пустоту у правого края. min-width — те же 450px §10. */
    css.push('.lumen-descr-row .lumen-facts{-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-box-flex:1;-webkit-flex:1 1 19.73em;flex:1 1 19.73em;min-width:19.73em;max-width:100%;padding:.79em 1.05em;border-radius:.61em;background:' + P.plate + ';border:.04em solid ' + P.line + '}');
    /* Правка 2026-09-16, п.6: «ПОДРОБНО» — метка, цифр в ней нет. */
    css.push('.lumen-descr-row .lumen-facts__title{font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1;letter-spacing:.14em;color:' + P.muted + ';margin-bottom:.79em}');
    /* Сетка: display:flex — база и фолбэк (webOS 3 / старые Tizen не знают
       grid и оставят последнее валидное значение), display:grid следующей
       декларацией переопределяет её там, где grid есть — тот же приём, что у
       .lumen-content. Зазоры §10: 10px/24px = .44em/1.05em.
       Ревью Task 5d (Minor 1): у Chrome 57–65 (webOS 4.x, Tizen 3/4) grid уже
       есть — значит @supports not (display:grid) их НЕ поймает, — но зазоры
       там назывались grid-row-gap/grid-column-gap, а row-gap/column-gap ещё
       нет; без старых записей таблица на этих ТВ шла бы вплотную. Прежний
       -webkit-column-gap убран: это свойство multicol, в grid оно не работает
       вовсе. display:-ms-grid снят (Minor 2): без -ms-grid-columns старый
       Edge/IE сложил бы все ячейки в одну клетку 1×1 — внахлёст, что заметно
       хуже честного flex-фолбэка строкой выше. */
    css.push('.lumen-descr-row .lumen-facts__grid{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;display:grid;grid-template-columns:auto 1fr;grid-row-gap:.35em;grid-column-gap:1.05em;row-gap:.35em;column-gap:1.05em}');
    /* Колонка подписей — auto, то есть по ширине самой длинной («Режиссёр»);
       white-space:nowrap не даёт ей ломаться и расшатывать выравнивание.
       Значению — min-width:0 и перенос по словам: длинный список жанров
       переносится внутри своей колонки, а не растягивает сетку «лесенкой». */
    css.push('.lumen-descr-row .lumen-facts__label{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.3;color:' + P.muted + ';white-space:nowrap}');
    css.push('.lumen-descr-row .lumen-facts__value{font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.3;color:' + P.text + ';min-width:0;word-wrap:break-word;overflow-wrap:break-word}');
    /* Без grid row-gap/column-gap не работают, а пары «лейбл/значение» не знают,
       где кончается строка: лейбл получает фиксированную колонку, значение
       занимает остаток строки и переносит следующую пару. em здесь считаются
       от собственных 18px ячеек: 24px = 1.33em, 10px = .56em. */
    css.push('@supports not (display:grid){.lumen-descr-row .lumen-facts__label{width:6.3em;margin:0 1.2em .5em 0}.lumen-descr-row .lumen-facts__value{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;margin-bottom:.5em}}');

    /* --- Task 9: ряд отзывов Кинопоиска (экран 07), подсказка без ключа
       (экран 13, панель 2) и модал отзыва (экран 08). px ÷ 22.811 ---
       Блок лежит в том же .full-descr, что и таблица «ПОДРОБНО»: своего типа
       ряда в Lampa создать нельзя (план 0.2), а контроллер full_descr собирает
       .selector внутри всего ряда описания. .full-descr — flex с wrap, поэтому
       блоку хватает width:100% + flex-basis:100%, чтобы встать целой строкой
       под описанием и таблицей. */
    css.push('.lumen-descr-row .lumen-reviews{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');
    /* Замер живьём (карточка «Дюны», вьюпорт 1080): ряд описания начинается за
       нижним краем экрана и въезжает в него прокруткой ЛЕНТЫ рядов. Внутри
       самого ряда Lampa не прокручивает (находка Task 5d: Descriptiopn.toggle
       двигает Navigator, но не scroll), поэтому при длинном описании (предел
       70vh = 756px) заголовок и карточки отзывов оказались бы ниже экрана,
       получая .focus вне поля зрения. Пока ряд отзывов нарисован, описание
       ограничено восемью строками (≈ 340px при 24px/1.45): вместе с тегами
       (90) и рядом карточек (~360) это ≈ 830 < 1080.
       Ревью Task 9: именно КЛАМП по строкам, а не max-height — обрезка по
       пикселям резала последнюю строку пополам, без многоточия (Task 5d
       снимал такую обрезку намеренно). max-height:70vh остаётся страховкой для
       движков без -webkit-line-clamp, а мягкая маска низа возвращается ТОЛЬКО
       здесь: в ряду без отзывов описание по-прежнему не выцветает. */
    css.push('.lumen-descr-row.lumen-descr-row--reviews .full-descr__text{display:-webkit-box;-webkit-line-clamp:8;-webkit-box-orient:vertical;overflow:hidden;max-height:70vh;-webkit-mask-image:-webkit-linear-gradient(top,#000 86%,rgba(0,0,0,0) 100%);-webkit-mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%);mask-image:linear-gradient(180deg,#000 86%,rgba(0,0,0,0) 100%)}');
    /* Правка 2026-09-16, п.3: заголовок ряда отзывов лежит прямо на кадре —
       вуали ряда, которая раньше его прикрывала, больше нет. Даём ему такую же
       локальную подложку, как у описания и таблицы, но по СОДЕРЖИМОМУ:
       inline-flex сжимает блок до текста, поэтому никакой кромки во всю ширину
       экрана не появляется. Отрицательный margin компенсирует паддинг, чтобы
       заголовок остался на одной вертикали с карточками отзывов под ним. */
    css.push('.lumen-descr-row .lumen-reviews__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');
    /* Иконка «комментарий» из общего набора — маской, как у всех наших иконок
       (свой svg в разметку не вставляем: 20_icons.js, план 0.3). */
    css.push('.lumen-descr-row .lumen-reviews__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em;-webkit-align-self:center;align-self:center}');
    css.push('.lumen-descr-row .lumen-reviews__title{font-family:' + FD + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');
    /* Правка 2026-09-16, п.6: «КИНОПОИСК» — метка источника, не колонка цифр. */
    css.push('.lumen-descr-row .lumen-reviews__src{font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + A + ';margin-right:.61em}');
    /* Ревью (п.2), та же правка читаемости, что у таблицы «ПОДРОБНО»: заголовок
       ряда лежит на вуали поверх кадра, и smoke давал там 2.9-3.8:1. Цвет
       поднят до muted (5.6:1 над светлым кадром, 7.2:1 над тёмным), кегль — до
       20px по правилу «приглушённый текст не мельче 20px». */
    css.push('.lumen-descr-row .lumen-reviews__total{font-family:' + FM + ';font-weight:400;font-size:.88em;line-height:1;letter-spacing:.08em;color:' + P.muted + '}');
    /* Горизонтальный ряд: карточки не сжимаются, лишнее скрыто, к карточке в
       фокусе ряд подкручивается scrollLeft (Lampa ряды ВНУТРИ ряда описания
       не двигает — находка Task 5d). */
    css.push('.lumen-descr-row .lumen-reviews__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
    css.push('.lumen-descr-row .lumen-review{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:21.04em;height:11.4em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;border-radius:.61em;overflow:hidden;background:' + P.gradSlate + ';border:.04em solid ' + P.line + ';color:' + P.text + ';display:-webkit-box;display:-webkit-flex;display:flex}');
    /* Тон отзыва — левая полоса 4px (экран 07): позитив good, нейтраль muted,
       негатив spice. */
    css.push('.lumen-descr-row .lumen-review__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-review--good .lumen-review__tone{background:' + P.good + '}');
    css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tone{background:' + P.spice + '}');
    css.push('.lumen-descr-row .lumen-review__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:.96em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column}');
    css.push('.lumen-descr-row .lumen-review__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:.53em}');
    /* Аватар-инициалы 48×48 при шрифте 19px: ширина/высота в em считаются от
       СОБСТВЕННОГО font-size узла, поэтому 48 ÷ 19 = 2.53em, а не 48 ÷ 22.811. */
    css.push('.lumen-descr-row .lumen-review__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.53em;height:2.53em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + P.panel + ';font-family:' + FB + ';font-weight:500;font-size:.83em;line-height:2.53em;text-align:center;color:' + P.muted + ';margin-right:.63em;overflow:hidden}');
    css.push('.lumen-descr-row .lumen-review__who{min-width:0}');
    css.push('.lumen-descr-row .lumen-review__author{font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1.1;color:' + P.text + ';margin-bottom:.25em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');
    /* Ревью (п.2): мета отзыва лежит на СВОЁМ непрозрачном фоне карточки, а не
       на кадре, поэтому кегль не трогаем — карточка фиксированной высоты
       11.4em (экран 07), рост кегля её переполнит. Поднимаем только цвет:
       smoke давал 3.7:1 к фону карточки, muted даёт 7.1:1. */
    css.push('.lumen-descr-row .lumen-review__meta{font-family:' + FM + ';font-weight:400;font-size:.66em;line-height:1.2;color:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-review__meta > span{margin-right:.66em}');
    css.push('.lumen-descr-row .lumen-review__tag{color:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-review--good .lumen-review__tag{color:' + P.good + '}');
    css.push('.lumen-descr-row .lumen-review--bad .lumen-review__tag{color:' + P.spice + '}');
    /* «12 полезно» — со звездой экрана 07, тоже маской. */
    css.push('.lumen-descr-row .lumen-review__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
    css.push('.lumen-descr-row .lumen-review__title{font-family:' + FB + ';font-weight:600;font-size:1.05em;line-height:1.25;color:' + P.text + ';margin-bottom:.53em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;white-space:nowrap}');
    /* Текст — ровно 4 строки (экран 07). -webkit-line-clamp работает во всех
       webkit-движках ТВ; на движке без него текст просто обрежется по
       overflow:hidden внутри фиксированной высоты карточки. */
    css.push('.lumen-descr-row .lumen-review__text{font-family:' + FB + ';font-weight:400;font-size:.83em;line-height:1.45;color:' + P.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');
    css.push('.lumen-descr-row .lumen-review.focus{border:.13em solid ' + A + ';-webkit-transform:scale(1.03);transform:scale(1.03);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    css.push('.lumen-descr-row .lumen-review.focus .lumen-review__title{white-space:normal}');
    /* Переходы — только в режиме полных анимаций (как у ряда серий Task 5c);
       в lite/off пружины нет вовсе. Класс режима стоит на body (LC.init), а не
       на ряду: ряд описания лежит вне .lumen-card. */
    css.push('body.lumen-motion-full .lumen-descr-row .lumen-review{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('body.lumen-motion-lite .lumen-descr-row .lumen-review.focus,body.lumen-motion-off .lumen-descr-row .lumen-review.focus{-webkit-transform:none;transform:none}');

    /* Экран 13, панель 2: ключа нет — вместо пустоты путь до настройки. */
    css.push('.lumen-descr-row .lumen-reviews__hint{-webkit-box-sizing:border-box;box-sizing:border-box;max-width:28.06em;border-radius:.61em;background:' + P.gradHint + ';border:.04em solid ' + P.line + ';padding:1.40em}');
    css.push('.lumen-descr-row .lumen-reviews__hint-ico{width:2.10em;height:2.10em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('comment') + ';mask-image:' + LC.icons.maskUrl('comment') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-bottom:.70em}');
    css.push('.lumen-descr-row .lumen-reviews__hint-title{font-family:' + FD + ';font-weight:700;font-size:1.23em;line-height:1.15;color:' + P.text + ';margin-bottom:.44em}');
    css.push('.lumen-descr-row .lumen-reviews__hint-text{font-family:' + FB + ';font-weight:400;font-size:.88em;line-height:1.4;color:' + P.muted + ';margin-bottom:.70em}');
    css.push('.lumen-descr-row .lumen-reviews__hint-path{display:inline-block;padding:.61em .79em;border-radius:.53em;background:rgba(' + A_RGB + ',.1);border:.04em solid rgba(' + A_RGB + ',.4);font-family:' + FB + ';font-weight:500;font-size:.79em;line-height:1.3;color:' + A + '}');
    /* Task 20: кнопка «Скрыть» подсказки про ключ — тот же размер, что путь
       до настройки рядом, но нейтральных цветов: это не подсказка, а
       действие. Фокусируется пультом (.selector), поэтому обязана иметь
       заметное состояние .focus, как остальные кнопки плагина. */
    css.push('.lumen-descr-row .lumen-reviews__hint-hide{display:inline-block;margin-left:.53em;padding:.61em .79em;border-radius:.53em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1.3;color:' + P.text + '}');
    css.push('.lumen-descr-row .lumen-reviews__hint-hide.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');

    /* Экран 08: модал отзыва. Живёт в .modal Lampa (вне карточки и вне ряда),
       поэтому корень правил — собственный класс .lumen-review-modal, который
       ставит сам блок: маркер оформления пути TorrServer (lumen-modal,
       src/64_menus.js) на него не попадает — он вешается только по
       .modal-loading/.torrent-install. */
    css.push('.lumen-review-modal{display:-webkit-box;display:-webkit-flex;display:flex;border-radius:.61em;overflow:hidden;background:' + P.gradPanel + ';border:.04em solid ' + P.line + ';color:' + P.text + '}');
    css.push('.lumen-review-modal__tone{width:.18em;-webkit-box-flex:0;-webkit-flex:none;flex:none;background:' + P.muted + '}');
    css.push('.lumen-review-modal--good .lumen-review-modal__tone{background:' + P.good + '}');
    css.push('.lumen-review-modal--bad .lumen-review-modal__tone{background:' + P.spice + '}');
    css.push('.lumen-review-modal__body{-webkit-box-sizing:border-box;box-sizing:border-box;padding:1.75em;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
    css.push('.lumen-review-modal__top{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');
    /* 62×62 при шрифте 22px: 62 ÷ 22 = 2.82em (в em собственного font-size). */
    css.push('.lumen-review-modal__ava{-webkit-box-sizing:border-box;box-sizing:border-box;width:2.82em;height:2.82em;-webkit-box-flex:0;-webkit-flex:none;flex:none;border-radius:50%;background:' + P.bg + ';border:.05em solid ' + P.line + ';font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:2.72em;text-align:center;color:' + P.muted + ';margin-right:.64em}');
    css.push('.lumen-review-modal__who{min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto}');
    css.push('.lumen-review-modal__author{font-family:' + FB + ';font-weight:600;font-size:1.14em;line-height:1.1;margin-bottom:.26em}');
    /* Ревью (п.2): модал лежит на своей панели, не на кадре — но smoke давал к
       ней 3.4:1, ниже порога. Цвет поднят до muted (6.5:1). */
    css.push('.lumen-review-modal__meta{font-family:' + FM + ';font-weight:400;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
    css.push('.lumen-review-modal__meta > span{margin-right:.75em}');
    css.push('.lumen-review-modal--good .lumen-review-modal__tag{color:' + P.good + '}');
    css.push('.lumen-review-modal--bad .lumen-review-modal__tag{color:' + P.spice + '}');
    css.push('.lumen-review-modal__likes:before{content:"";display:inline-block;vertical-align:-.1em;width:1em;height:1em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('star') + ';mask-image:' + LC.icons.maskUrl('star') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.33em}');
    css.push('.lumen-review-modal__src{font-family:' + FM + ';font-weight:600;font-size:.70em;line-height:1;letter-spacing:.16em;color:' + P.muted + ';-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-left:.88em}');
    css.push('.lumen-review-modal__line{height:.04em;background:' + P.line + ';margin:.88em 0}');
    css.push('.lumen-review-modal__title{font-family:' + FD + ';font-weight:700;font-size:1.58em;line-height:1.18;margin-bottom:.88em}');
    /* Длинный отзыв прокручивается внутри модала: контроллер modal у Lampa
       двигает собственный скролл окна, а высота ограничена вьюпортом. */
    css.push('.lumen-review-modal__text{font-family:' + FB + ';font-weight:400;font-size:.96em;line-height:1.5;color:' + P.muted + ';max-height:50vh;overflow:auto}');
    /* --- Task 28 (фаза 3): отзывы без спойлеров. --- */

    /* Переключатель режима в шапке ряда: справа от счётчика отзывов, тем же
       ростом, что метка источника. Включённое состояние — акцентом, как
       чипы порядка ряда франшизы ниже. */
    css.push('.lumen-descr-row .lumen-reviews__mode{margin-left:auto;padding:.35em .61em;border-radius:.44em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-reviews__mode--on{color:' + A + ';border-color:rgba(' + A_RGB + ',.5)}');
    css.push('.lumen-descr-row .lumen-reviews__mode.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');
    /* Метка «в отзыве есть спойлер» — внизу карточки, у самой кромки: она
       обещает, что под OK ждёт скрытый кусок. */
    css.push('.lumen-descr-row .lumen-review__spoiler{margin-top:auto;font-family:' + FM + ';font-weight:600;font-size:.61em;line-height:1;letter-spacing:.12em;color:' + P.spice + '}');
    /* В режиме заголовков текста в карточке нет, и высота ей нужна меньше:
       заголовку при этом достаётся две строки вместо одной. */
    css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review{height:8.33em}');
    css.push('.lumen-descr-row .lumen-reviews--headlines .lumen-review__title{white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
    /* Замазка спойлера в окне отзыва: текст на месте (высота окна не
       прыгает при раскрытии), но не читается — плотная плашка цвета текста
       поверх собственных букв. Никакого blur: на ТВ он дорог, а на движке без
       фильтров буквы остались бы видны. */
    css.push('.lumen-review-modal .lumen-spoiler{border-radius:.26em;background:rgba(' + P.textRgb + ',.22);color:transparent}');
    css.push('.lumen-review-modal--open .lumen-spoiler{background:rgba(' + A_RGB + ',.14);color:' + P.text + '}');
    css.push('body.lumen-motion-full .lumen-review-modal .lumen-spoiler{-webkit-transition:color .2s,background-color .2s;transition:color .2s,background-color .2s}');
    /* Кнопка раскрытия — единственный .selector окна, поэтому фокус достаётся
       ей сразу (контроллер modal собирает коллекцию из содержимого окна). */
    css.push('.lumen-review-modal__reveal{display:inline-block;margin-top:1.05em;padding:.61em .96em;border-radius:.53em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.83em;line-height:1.3;color:' + P.text + '}');
    css.push('.lumen-review-modal__reveal.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');

    /* --- Task 28 (фаза 3): ряд «Смотреть по порядку» (src/66_franchise.js).
       Живёт в том же .full-descr, что таблица «ПОДРОБНО» и отзывы, и занимает
       целую строку — те же width/flex-basis, что у ряда отзывов.
       Класс ряда — .lumen-fr; .lumen-franchise (без сокращения) — это КНОПКА
       «Франшиза» в ряду кнопок из Task 17, другой узел. --- */
    css.push('.lumen-descr-row .lumen-fr{width:100%;-webkit-flex-basis:100%;flex-basis:100%;margin-top:1.75em}');
    css.push('.lumen-descr-row .lumen-fr__head{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-sizing:border-box;box-sizing:border-box;max-width:100%;margin:0 0 .79em -.7em;padding:.44em .7em;border-radius:.61em;background:' + P.plate + '}');
    css.push('.lumen-descr-row .lumen-fr__ico{width:1.05em;height:1.05em;-webkit-flex-shrink:0;flex-shrink:0;background-color:' + P.muted + ';-webkit-mask-image:' + LC.icons.maskUrl('list') + ';mask-image:' + LC.icons.maskUrl('list') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain;margin-right:.44em}');
    css.push('.lumen-descr-row .lumen-fr__title{font-family:' + FD + ';font-weight:700;font-size:1.40em;line-height:1;color:' + P.text + ';margin-right:.61em}');
    css.push('.lumen-descr-row .lumen-fr__name{font-family:' + FM + ';font-weight:400;font-size:.79em;line-height:1;letter-spacing:.06em;color:' + P.muted + ';margin-right:.88em}');
    css.push('.lumen-descr-row .lumen-fr__modes{display:-webkit-box;display:-webkit-flex;display:flex}');
    css.push('.lumen-descr-row .lumen-fr__mode{padding:.35em .61em;margin-right:.35em;border-radius:.44em;background:' + P.buttonBg + ';border:.04em solid ' + P.line + ';font-family:' + FB + ';font-weight:600;font-size:.70em;line-height:1.2;color:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-fr__mode--on{color:' + A + ';border-color:rgba(' + A_RGB + ',.5)}');
    css.push('.lumen-descr-row .lumen-fr__mode.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');
    /* Ряд частей — горизонтальный, как ряд отзывов: Lampa внутри ряда
       описания не прокручивает (находка Task 5d), к карточке в фокусе ряд
       подкручивается сам (scrollToCard в src/66_franchise.js нет — карточки
       узкие, восемь частей помещаются в экран; при большем числе ряд просто
       обрезается по overflow). */
    css.push('.lumen-descr-row .lumen-fr__row{display:-webkit-box;display:-webkit-flex;display:flex;overflow:hidden;padding:.26em 0}');
    css.push('.lumen-descr-row .lumen-fr-card{position:relative;-webkit-box-sizing:border-box;box-sizing:border-box;width:7.90em;-webkit-box-flex:0;-webkit-flex:none;flex:none;margin-right:.88em;color:' + P.text + '}');
    css.push('.lumen-descr-row .lumen-fr-card__poster{position:relative;width:100%;height:11.84em;border-radius:.53em;overflow:hidden;background-color:' + P.panel + ';-webkit-background-size:cover;background-size:cover;background-position:center;background-repeat:no-repeat;border:.04em solid ' + P.line + '}');
    /* Просмотренная часть приглушается, а поверх постера ставится галочка —
       та же иконка, что у отмеченных пунктов меню. */
    css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__poster{opacity:.45}');
    css.push('.lumen-descr-row .lumen-fr-card__mark{position:absolute;top:.35em;right:.35em;width:1.32em;height:1.32em;border-radius:50%;background:' + P.bg + ';opacity:0}');
    css.push('.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__mark{opacity:1;background-color:' + P.good + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:.88em}');
    css.push('.lumen-descr-row .lumen-fr-card__num{font-family:' + FM + ';font-weight:400;font-size:.61em;line-height:1.2;letter-spacing:.06em;color:' + P.muted + ';margin-top:.53em}');
    css.push('.lumen-descr-row .lumen-fr-card__name{font-family:' + FB + ';font-weight:600;font-size:.79em;line-height:1.2;color:' + P.text + ';margin-top:.26em;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
    css.push('.lumen-descr-row .lumen-fr-card__year{font-family:' + FM + ';font-weight:400;font-size:.61em;line-height:1.2;color:' + P.smoke + ';margin-top:.18em}');
    css.push('.lumen-descr-row .lumen-fr-card__flag{display:inline-block;margin-top:.26em;padding:.18em .44em;border-radius:.35em;font-family:' + FM + ';font-weight:600;font-size:.53em;line-height:1.3;letter-spacing:.08em;background:' + P.buttonBg + ';color:' + P.muted + '}');
    css.push('.lumen-descr-row .lumen-fr-card__flag--current{background:' + A + ';color:' + t.onac + '}');
    css.push('.lumen-descr-row .lumen-fr-card__flag--next{background:rgba(' + A_RGB + ',.18);color:' + A + '}');
    css.push('.lumen-descr-row .lumen-fr-card__flag--soon{color:' + P.spice + '}');
    css.push('.lumen-descr-row .lumen-fr-card__flag--watched{color:' + P.good + '}');
    css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{border:.13em solid ' + A + ';-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    css.push('.lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__name{color:' + A + '}');
    css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card__poster{-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('body.lumen-motion-full .lumen-descr-row .lumen-fr-card.focus .lumen-fr-card__poster{-webkit-transform:scale(1.04);transform:scale(1.04)}');
    /* Скелетон ряда, пока идёт запрос коллекции: те же плашки, что у отзывов
       (мерцают только при полных анимациях — правило .lumen-skeleton). */
    css.push('.lumen-descr-row .lumen-fr-card--sk{height:11.84em;border-radius:.53em}');
    /* Движок без масок: пустые закрашенные квадраты вместо иконок не рисуем. */
    css.push(LC.icons.NO_MASK + '{.lumen-descr-row .lumen-reviews__ico,.lumen-descr-row .lumen-reviews__hint-ico,.lumen-descr-row .lumen-review__likes:before,.lumen-review-modal__likes:before,.lumen-descr-row .lumen-fr__ico,.lumen-descr-row .lumen-fr-card__mark{display:none}}');

    /* --- Компактная раскладка на узких экранах (страховка). Правка 2026-09-16
       (п.1): правил боковой колонки здесь больше нет, а одноколоночный поток
       .lumen-content теперь и так базовый — остаются только кегль заголовка и
       снятая минимальная высота шапки. --- */
    css.push('@media screen and (max-width:1000px){.lumen-card .full-start-new__title{font-size:2.43em}.lumen-card .full-start-new__body{min-height:0}}');

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
    /* Task 5c: пружина фокуса карточки серии и сдвиг дорожки ряда — только в
       full; lite/off — без scale (как у кнопок), off ещё и без переходов. */
    /* Ревью (п.10): background-color в списке был бесполезен — фон карточки
       задан градиентом (background-image), он не интерполируется. */
    css.push('.lumen-card.lumen-motion-full .lumen-episode{-webkit-transition:border-color .2s,opacity .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,opacity .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('.lumen-card.lumen-motion-full .lumen-episodes__track{-webkit-transition:-webkit-transform .4s cubic-bezier(.2,.8,.2,1);transition:transform .4s cubic-bezier(.2,.8,.2,1)}');
    css.push('.lumen-card.lumen-motion-lite .lumen-episode.focus,.lumen-card.lumen-motion-off .lumen-episode.focus{-webkit-transform:none;transform:none}');
    /* Task 7: кнопка «Стоп» — та же логика режимов, что у кнопок карточки
       (в lite/off пружины фокуса нет; !important — поверх нативной анимации
       Lampa, см. комментарий у .lumen-motion-lite выше). */
    /* background здесь — не дубль v1-правила, а защита от уплотнённой подложки
       ниже (ревью фазы 1, второй круг): у неё 3 класса специфичности, ровно как
       у .lumen-card .lumen-stop.focus, и объявлена она ПОЗЖЕ — то есть выиграла
       бы по порядку и перекрасила бы кнопку в фокусе из акцента в тёмный. */
    css.push('.lumen-card.lumen-motion-lite .lumen-stop.focus,.lumen-card.lumen-motion-off .lumen-stop.focus{background:' + A + ';-webkit-transform:none !important;transform:none !important}');
    /* Ревью фазы 1 (I1): blur подложки — самый дорогой эффект карточки, и в
       lite/off он гасится вместе с остальным движением. Дело не в движении как
       таковом: backdrop-filter пересобирается композитором ПОКАДРОВО, потому
       что фон под кнопками живой (кроссфейд кадров 1.2 с, наезд Ken Burns,
       играющий iframe трейлера). Для КНОПОК это ровно те ТВ, куда «Авто» само
       ставит lite (Tizen/webOS, см. LC.motionModeFor). Раньше lite/off снимали
       только transition/transform/animation, а блюр оставался под каждой из
       5-7 кнопок сразу.
       Но одного гашения мало, и прежнее обоснование («заливки у всех трёх
       правил непрозрачные») было НЕВЕРНЫМ — исправлено по второму кругу ревью.
       Плотная заливка только у кнопок: P.buttonBg .82, да ещё поверх нижней
       вуали (.98 -> .60). А «Стоп» (.5) и метка (.62) полупрозрачны И
       показываются ТОЛЬКО при lumen-trailer-on — то есть всегда поверх живого
       кадра YouTube, где вуали слоя вдобавок приглушены до opacity .45 (см.
       .lumen-backdrop.lumen-trailer-live выше). На светлой сцене ролика контраст
       текста P.text к такой подложке поверх белого кадра — 3.1:1 у «Стоп» и
       4.8:1 у метки, против целевых 7:1 проекта: сняв блюр и не сделав больше
       ничего, мы бы ухудшили читаемость ровно тому пользователю слабого ТВ,
       ради которого правка и делается.
       Поэтому тем же правилом подложка уплотняется до .9 от P.bgRgb (цвет из
       палитры, не литерал): поверх белого кадра это 13.5:1, а поверх тёмного —
       визуально то же, что и было, потому что цвет тот же, что у страницы.
       Кнопкам компенсация не нужна и только утяжелила бы их вид.
       Адресат у компенсации при этом ДРУГОЙ, чем у гашения блюра на кнопках: на
       Tizen/webOS «Авто» даёт трейлеру 'off' (LC.trailer.modeFor), то есть
       «Стоп» и метки там не бывает вовсе. Эти два узла страдают в другой
       комбинации — трейлер включён ВРУЧНУЮ, а анимации стоят «Лёгкие»/«Выкл».
       Специфичность: тот же селектор плюс класс режима на корне карточки —
       строго выше исходного правила, поэтому !important здесь не нужен (в
       отличие от transform/animation выше, где спорит нативная анимация Lampa).
       Единственное исключение — фокус «Стоп»: у него столько же классов, сколько
       у уплотнения, поэтому акцент ему возвращает правило режима с .focus
       (4 класса) выше по файлу. */
    css.push('.lumen-card.lumen-motion-lite .full-start-new__buttons .full-start__button,.lumen-card.lumen-motion-off .full-start-new__buttons .full-start__button{-webkit-backdrop-filter:none;backdrop-filter:none}');
    css.push('.lumen-card.lumen-motion-lite .lumen-stop,.lumen-card.lumen-motion-off .lumen-stop{-webkit-backdrop-filter:none;backdrop-filter:none;background:' + P.glassLite + '}');
    css.push('.lumen-card.lumen-motion-lite .lumen-trailer-badge,.lumen-card.lumen-motion-off .lumen-trailer-badge{-webkit-backdrop-filter:none;backdrop-filter:none;background:' + P.glassLite + '}');

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
    /* Task 8 (экран 06): «Следующая серия — 17 декабря, через 31 день» в сжатой
       шапке не помещается — там одна карта «● Выходит · 17 дек». Статус у
       сериала уже стоит в ленте непосредственно перед чипом (renderSerialMode),
       поэтому карты склеиваются срезкой смежных краёв: у статуса правый, у чипа
       левый. Короткая дата — собственный узел чипа (его дописывает LC.header).
       Срезать край статуса можно только когда чип виден — это и означает класс
       .lumen-card--nextchip на корне (:has() план запрещает). */
    css.push('.lumen-card .lumen-next-chip__short{display:none}');
    css.push('.lumen-card.lumen-compact .lumen-next-chip__text{display:none}');
    css.push('.lumen-card.lumen-compact .lumen-next-chip__short{display:block}');
    css.push('.lumen-card.lumen-compact .lumen-next-chip{border-left:0;border-top-left-radius:0;border-bottom-left-radius:0;padding-left:0}');
    css.push('.lumen-card.lumen-compact .lumen-next-chip:before{display:none}');
    css.push('.lumen-card.lumen-card--nextchip.lumen-compact .full-start-new__rate-line .full-start__status{margin-right:0 !important;border-right:0;border-top-right-radius:0;border-bottom-right-radius:0;padding-right:.45em}');
    css.push('.lumen-card.lumen-motion-lite .full-start-new__title,.lumen-card.lumen-motion-lite .full-start-new__rate-line,.lumen-card.lumen-motion-lite .full-start-new__buttons,.lumen-card.lumen-motion-off .full-start-new__title,.lumen-card.lumen-motion-off .full-start-new__rate-line,.lumen-card.lumen-motion-off .full-start-new__buttons{-webkit-transition:none;transition:none}');

    /* --- Task 17: кнопка «Франшиза» в карточке (design-spec-card §7a) ---
       Собственный .selector рядом с рядом кнопок, НЕ внутри него: Lampa
       хэширует outerHTML кнопок в .buttons--container (план 0.2), и любая
       вставка туда сбивает приоритетную кнопку пользователя. Геометрия и
       фокус — те же, что у кнопки «Стоп» режима трейлера, включая расчёт
       выравнивания по ряду кнопок (MT 1.40em / MB .6em, см. комментарий
       над .lumen-stop выше). */
    css.push('.lumen-card .lumen-franchise{display:none;font-family:' + FB + ';font-weight:600;font-size:1em;height:3.16em;padding:0 1.32em;margin:1.40em .70em .6em 0;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';color:' + P.text + ';white-space:nowrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    /* Класс корня ставит LC.hub.franchise только когда кнопка вставлена:
       без него ряд кнопок и наша кнопка остались бы двумя блоками друг под
       другом (.lumen-actions в обычном режиме — не flex). Реакции и ряд
       серий занимают всю ширину, поэтому строка получается одна: кнопки +
       «Франшиза». */
    css.push('.lumen-card.lumen-card--franchise .lumen-franchise{display:-webkit-box;display:-webkit-flex;display:flex}');
    css.push('.lumen-card.lumen-card--franchise .lumen-actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
    css.push('.lumen-card.lumen-card--franchise .full-start-new__reactions,.lumen-card.lumen-card--franchise .lumen-episodes{-webkit-flex-basis:100%;flex-basis:100%;width:100%}');
    css.push('.lumen-card .lumen-franchise__ico{-webkit-flex-shrink:0;flex-shrink:0;width:1.14em;height:1.14em;margin-right:.53em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('film') + ';mask-image:' + LC.icons.maskUrl('film') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
    css.push('.lumen-card .lumen-franchise span{font-size:1.05em;line-height:1}');
    css.push('.lumen-card .lumen-franchise.focus{background:' + A + ';color:' + P.dark + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .614em 1.754em ' + AG + ';box-shadow:0 .614em 1.754em ' + AG + '}');
    css.push('.lumen-card.lumen-motion-lite .lumen-franchise.focus,.lumen-card.lumen-motion-off .lumen-franchise.focus{background:' + A + ';-webkit-transform:none !important;transform:none !important}');
    /* Движка без CSS-масок (старые Tizen/webOS) пустой квадрат иконки не
       получает — тот же приём, что у иконок кнопок в src/20_icons.js. */
    css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-franchise__ico{display:none}}');

    /* --- Task 17: хаб подборок (design-spec-main §0.1, §0.7, §0.8) ---
       Свой корень .lumen-hub: экран целиком наш, чужой разметки Lampa
       внутри нет, поэтому ни одно правило не может протечь на её экраны. */
    css.push('.lumen-hub{padding:2.81em 2.81em 3.5em 2.81em;color:' + P.text + '}');
    css.push('.lumen-hub__head{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
    css.push('.lumen-hub__title{font-family:' + FD + ';font-weight:700;font-size:2.28em;line-height:1;margin-right:.6em}');
    css.push('.lumen-hub__count{font-family:' + FM + ';font-size:.88em;color:' + P.smoke + '}');
    css.push('.lumen-hub__search{font-family:' + FM + ';font-size:.88em;letter-spacing:.06em;color:' + P.smoke + ';margin-left:auto}');
    css.push('.lumen-hub__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';padding:2em 0}');
    css.push('.lumen-hub__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
    css.push('.lumen-hub__tiles{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');

    /* Чип (§0.7) — общий для групп хаба и сортировки сетки. Оба корня
       перечислены явно: собственный класс без корня оставлял бы правило
       глобальным. */
    css.push('.lumen-hub .lumen-chip,.lumen-grid .lumen-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.46em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:.53em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:.92em;line-height:1;color:' + P.muted + ';white-space:nowrap;-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
    css.push('.lumen-hub .lumen-chip__count{font-family:' + FM + ';font-size:.8em;margin-left:.6em;color:' + P.smoke + '}');
    /* Выбранная группа/сортировка — приглушённый акцент, чтобы её было видно
       и когда фокус ушёл на другой чип. */
    css.push('.lumen-hub .lumen-chip.lumen-chip--on,.lumen-grid .lumen-chip.lumen-chip--on{color:' + A + ';border-color:' + A + ';background:rgba(' + A_RGB + ',.14)}');
    css.push('.lumen-hub .lumen-chip.focus,.lumen-grid .lumen-chip.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .53em 1.53em ' + AG + ';box-shadow:0 .53em 1.53em ' + AG + '}');
    css.push('.lumen-hub.lumen-motion-lite .lumen-chip.focus,.lumen-hub.lumen-motion-off .lumen-chip.focus,.lumen-grid.lumen-motion-lite .lumen-chip.focus,.lumen-grid.lumen-motion-off .lumen-chip.focus{-webkit-transform:none;transform:none}');
    css.push('.lumen-hub.lumen-motion-off .lumen-chip,.lumen-grid.lumen-motion-off .lumen-chip{-webkit-transition:none;transition:none}');

    /* Плитка 430×242 (16:9), 4 в ряд при safe area 64 с обеих сторон:
       ширина = (100% − 3 промежутка по .88em) / 4. */
    css.push('.lumen-hub__tiles .lumen-tile{position:relative;width:-webkit-calc((100% - 2.64em) / 4);width:calc((100% - 2.64em) / 4);margin:0 .88em .88em 0;border-radius:.44em;overflow:hidden;background:' + P.panel + ';border:.04em solid ' + P.line + ';-webkit-transition:border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),-webkit-box-shadow .28s;transition:border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),box-shadow .28s}');
    css.push('.lumen-hub__tiles .lumen-tile:nth-child(4n){margin-right:0}');
    /* Пропорция 16:9 распоркой (aspect-ratio нет на старых webOS/Tizen). */
    css.push('.lumen-hub__tiles .lumen-tile:before{content:"";display:block;padding-top:56.25%}');
    css.push('.lumen-hub .lumen-tile__collage{position:absolute;top:0;left:0;right:0;bottom:0;overflow:hidden}');
    css.push('.lumen-hub .lumen-tile__poster{position:absolute;width:5.70em;height:8.55em;border-radius:.31em;-webkit-background-size:cover;background-size:cover;background-position:center;-webkit-box-shadow:0 .4em 1.2em rgba(0,0,0,.5);box-shadow:0 .4em 1.2em rgba(0,0,0,.5)}');
    css.push('.lumen-hub .lumen-tile__poster--1{left:1.1em;top:-.88em;-webkit-transform:rotate(-6deg);transform:rotate(-6deg)}');
    css.push('.lumen-hub .lumen-tile__poster--2{left:6.2em;top:-.44em;-webkit-transform:rotate(2deg);transform:rotate(2deg)}');
    css.push('.lumen-hub .lumen-tile__poster--3{left:11.3em;top:-1.1em;-webkit-transform:rotate(8deg);transform:rotate(8deg)}');
    css.push('.lumen-hub .lumen-tile__scrim{position:absolute;top:0;left:0;right:0;bottom:0;background:-webkit-linear-gradient(bottom,rgba(' + P.bgRgb + ',.98) 0%,rgba(' + P.bgRgb + ',.7) 40%,rgba(' + P.bgRgb + ',.2) 100%);background:linear-gradient(0deg,rgba(' + P.bgRgb + ',.98) 0%,rgba(' + P.bgRgb + ',.7) 40%,rgba(' + P.bgRgb + ',.2) 100%)}');
    css.push('.lumen-hub .lumen-tile__text{position:absolute;left:.88em;right:.88em;bottom:.7em}');
    css.push('.lumen-hub .lumen-tile__title{font-family:' + FD + ';font-weight:700;font-size:1.27em;line-height:1.06;color:' + P.text + ';overflow:hidden}');
    css.push('.lumen-hub .lumen-tile__sub{font-family:' + FM + ';font-size:.88em;line-height:1;color:' + P.muted + ';margin-top:.35em;overflow:hidden}');
    css.push('.lumen-hub .lumen-tile__nokey{display:none;position:absolute;top:.7em;right:.7em;font-family:' + FM + ';font-size:.7em;letter-spacing:.04em;color:' + P.text + ';background:rgba(' + P.bgRgb + ',.8);border:.05em solid rgba(' + P.textRgb + ',.3);border-radius:.2em;padding:.25em .45em}');
    css.push('.lumen-hub .lumen-tile--nokey .lumen-tile__nokey{display:block}');
    /* Task 21 (фаза 3): метка сезонной подборки. Место — левый верхний угол
       плитки: правый занят подсказкой про ключ API, и на подборках
       Кинопоиска они могут встретиться на одной плитке. Цвет — акцент: это
       единственная плитка в списке, на которую сейчас стоит смотреть. */
    css.push('.lumen-hub .lumen-tile__season{position:absolute;top:.7em;left:.7em;font-family:' + FM + ';font-size:.7em;letter-spacing:.04em;color:' + t.onac + ';background:' + A + ';border-radius:.2em;padding:.25em .45em}');
    css.push('.lumen-hub__tiles .lumen-tile.focus{border-color:' + AL + ';border-width:.13em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');
    css.push('.lumen-hub.lumen-motion-lite .lumen-tile.focus,.lumen-hub.lumen-motion-off .lumen-tile.focus{-webkit-transform:none;transform:none}');
    css.push('.lumen-hub.lumen-motion-off .lumen-tile{-webkit-transition:none;transition:none}');

    /* --- Task 17: сетка подборки (design-spec-main §0.4, экран 20) ---
       Safe area с обеих сторон и ровно 6 карточек в ряд (поправка
       контроллера: bleed справа на экране 20 — дефект макета). */
    css.push('.lumen-grid{padding:2.81em 2.81em 3.5em 2.81em;color:' + P.text + '}');
    css.push('.lumen-grid__head{margin-bottom:1.05em}');
    css.push('.lumen-grid__title{font-family:' + FD + ';font-weight:700;font-size:2.10em;line-height:1}');
    css.push('.lumen-grid__sub{font-family:' + FM + ';font-size:.88em;color:' + P.smoke + ';margin-top:.5em}');
    css.push('.lumen-grid__sorts{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:1.4em}');
    css.push('.lumen-grid__items{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    /* Карточка сетки — штатная разметка Lampa ('card'), поэтому правила
       навешиваются на её классы; наш корень .lumen-grid держит их в скоупе.
       Ширина считается под 6 в ряд: (100% − 5 промежутков по .88em) / 6 —
       штатные 12.75em переопределяются двумя классами. */
    css.push('.lumen-grid__items .lumen-gcard{-webkit-flex-shrink:0;flex-shrink:0;width:-webkit-calc((100% - 4.4em) / 6);width:calc((100% - 4.4em) / 6);margin:0 .88em 1.4em 0;position:relative;-webkit-transition:-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:transform .28s cubic-bezier(.2,.9,.3,1.25)}');
    css.push('.lumen-grid__items .lumen-gcard:nth-child(6n){margin-right:0}');
    css.push('.lumen-grid .lumen-gcard .card__view{margin-bottom:.5em;border-radius:.31em;background-color:' + P.panel + '}');
    css.push('.lumen-grid .lumen-gcard .card__img{border-radius:.31em;background-color:' + P.panelLo + '}');
    css.push('.lumen-grid .lumen-gcard .card__title{font-family:' + FD + ';font-weight:700;font-size:.96em;line-height:1.15;color:' + P.text + '}');
    css.push('.lumen-grid .lumen-gcard .card__age{font-family:' + FM + ';font-size:.88em;line-height:1;margin-top:.25em;color:' + P.muted + '}');
    /* Фокус: акцентное кольцо вместо белого штатного, пружина и подъём над
       соседями — без z-index увеличенная карточка ныряет под соседнюю и
       тень срезается (ревью Task 17). */
    css.push('.lumen-grid__items .lumen-gcard.focus{-webkit-transform:scale(1.08);transform:scale(1.08);z-index:3}');
    css.push('.lumen-grid .lumen-gcard.focus .card__view:after{border-width:.13em;border-color:' + AL + ';border-radius:.44em;-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');
    css.push('.lumen-grid.lumen-motion-lite .lumen-gcard.focus,.lumen-grid.lumen-motion-off .lumen-gcard.focus{-webkit-transform:none;transform:none}');
    css.push('.lumen-grid.lumen-motion-off .lumen-gcard{-webkit-transition:none;transition:none}');
    /* Полоса продолжения просмотра (design-spec-main §0.6): данные те же,
       что у строки «Продолжить» в карточке — Lampa.Timeline. */
    css.push('.lumen-grid .lumen-gcard__bar{position:absolute;left:.53em;right:.53em;bottom:.53em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden}');
    css.push('.lumen-grid .lumen-gcard__bar > div{height:100%;border-radius:.09em;background:' + A + '}');
    css.push('.lumen-grid__empty{padding:2em 0}');
    css.push('.lumen-grid .lumen-grid__empty-text{font-family:' + FB + ';font-size:1.05em;color:' + P.muted + ';margin-bottom:1.05em;max-width:42.96em}');
    css.push('.lumen-grid .lumen-grid__back{display:-webkit-inline-box;display:-webkit-inline-flex;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.32em;border-radius:.79em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:1em;color:' + P.text + '}');
    css.push('.lumen-grid .lumen-grid__back.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');
    /* Task 20: «Скрыть» стоит слева от «Назад» и отделено от неё зазором. */
    css.push('.lumen-grid .lumen-grid__hide{margin-right:.79em}');

    /* --- Task 18: герой главной (design-spec-main §0.2, экраны 15–19) ---
       Герой лежит первым ребёнком .activity (класс .lumen-main на ней же) и
       рисуется ПОД рядами: .activity__body идёт следом в DOM, поэтому
       порядок отрисовки задаёт разметка, а не z-index.

       top:-4em — высота штатной шапки Lampa: .activitys начинается на 4em
       ниже верха экрана (проверено живьём: rect.y = 91.23 при базе 22.811),
       и без этого сдвига кадр не доходил бы до верхней кромки, как на
       экранах 15–19.

       Фаза 3, находка пользователя (скриншот невысокого окна ~1160×520):
       высота героя больше не задаётся отдельной долей экрана. Раньше кадр
       был 58vh, а ряды начинались на 22vh — при большой высоте окна лишняя
       часть кадра просто уходила под ряды и это выглядело задуманным, но
       стоило окну стать низким, как первый ряд оказывался ПОД непрозрачной
       частью героя: от карточек торчали только подписи с годом.

       Теперь высота героя и сдвиг рядов — одна и та же величина: кадр
       кончается ровно там, где начинается первый ряд, то есть
       100vh − (высота ряда). Ряд считается в em (ROW_BLOCK*), поэтому
       пропорция сама подстраивается под любую высоту окна и под масштаб
       интерфейса, и ни одного слушателя resize для этого не нужно.
       При обычном масштабе и 16:9 это даёт 56–57 % экрана — те самые 58 %
       спецификации.

       Сжатый герой (фокус ниже первого ряда, §0.2 — 42 % против 58 %)
       считается той же долей от полной высоты: 42/58 = .72. Фиксированные
       42vh здесь больше не годятся — на низком окне они оказались бы БОЛЬШЕ
       новой полной высоты, и сжатие превратилось бы в рост поверх рядов. */
    /* Правка пользователя 2026-09-17 (второй круг, п.3): кадр кончается не
       там, где начинается ряд, а на HERO_AIR выше — заголовок «Сейчас
       смотрят» больше не лежит на кромке картинки. Верх первого ряда при
       этом не двинулся: воздух вычтен из высоты кадра, ряды и их область
       остались ровно там же, где были, поэтому ленивой догрузке и прокрутке
       эта правка не видна вовсе. */
    var heroCut = heroCutEm(scale);
    var heroCompactCut = heroCompactCutEm(scale);
    /* Правка пользователя 2026-09-17 (третий круг): фон под рядами — это фон
       самой активности главной, и он тоже берёт оттенок постера (P.bg уже
       подкрашен в palette()). Своего фона у .activity нет, за ней чёрный
       body, поэтому цвет ставится здесь — под кадром героя (он absolute,
       первый ребёнок того же узла) и под рядами.
       Плавность — только в режиме полных анимаций и только у ЦВЕТА: градиенты
       вуалей CSS-переходом не интерполируются, а background-color — да, и
       именно он занимает всю площадь под рядами. Класс режима на body ставит
       LC.applyMotionMode. */
    css.push('.lumen-main{background-color:' + P.bg + '}');
    css.push('body.lumen-motion-full .lumen-main{-webkit-transition:background-color .6s ease-in-out;transition:background-color .6s ease-in-out}');
    css.push('.lumen-hero{position:absolute;top:-4em;left:0;right:0;height:-webkit-calc(100vh - ' + round2(heroCut + HERO_AIR) + 'em);height:calc(100vh - ' + round2(heroCut + HERO_AIR) + 'em);overflow:hidden;pointer-events:none}');
    css.push('.lumen-hero.lumen-hero--compact{height:-webkit-calc(72vh - ' + round2(heroCompactCut + HERO_AIR) + 'em);height:calc(72vh - ' + round2(heroCompactCut + HERO_AIR) + 'em)}');
    css.push('.lumen-hero.lumen-motion-full{-webkit-transition:height .42s cubic-bezier(.2,.8,.2,1);transition:height .42s cubic-bezier(.2,.8,.2,1)}');

    /* Два слоя кадра: новый проявляется поверх старого за 600 мс
       (раскадровка 23а). Пока новый кадр грузится, на экране остаётся
       прежний — фон при листании не мигает (ограничение брифа 1). */
    css.push('.lumen-hero .lumen-hero__bg{position:absolute;top:0;left:0;right:0;bottom:0;-webkit-background-size:cover;background-size:cover;background-position:center top;background-repeat:no-repeat;opacity:0}');
    css.push('.lumen-hero .lumen-hero__bg.is-active{opacity:1}');
    css.push('.lumen-hero.lumen-motion-full .lumen-hero__bg{-webkit-transition:opacity .6s ease-in-out;transition:opacity .6s ease-in-out}');
    /* Кадра нет — герой собирается из размытого постера (экран 22). Blur на
       всю площадь дорог для слабых ТВ, поэтому в lite/off его нет вовсе —
       то же решение, что у фона карточки (.lumen-bg--blur). */
    css.push('.lumen-hero.lumen-motion-full.lumen-hero--blur .lumen-hero__bg{-webkit-filter:blur(1.75em);filter:blur(1.75em);-webkit-transform:scale(1.1);transform:scale(1.1)}');

    /* Task 28: слой автотрейлера — поверх кадра, но под вуалями (порядок
       узлов задаёт buildNode в src/48_hero.js). Правила те же, что у
       .lumen-bg__trailer в слое фона карточки: запас ±10 % по вертикали
       прячет чёрные поля ролика 16:9 в кадре другой высоты, проявление за 1 с
       ставит класс is-live — его вешает сам плеер (src/55_trailer.js), когда
       ролик РЕАЛЬНО пошёл. pointer-events на iframe сняты: кликов по нему нет
       ни на ТВ, ни мышью — герой целиком не кликается (.lumen-hero). */
    css.push('.lumen-hero .lumen-hero__trailer{position:absolute;top:-10%;bottom:-10%;left:0;right:0;overflow:hidden;opacity:0;-webkit-transition:opacity 1s ease;transition:opacity 1s ease}');
    css.push('.lumen-hero .lumen-hero__trailer.is-live{opacity:1}');
    css.push('.lumen-hero .lumen-hero__trailer iframe{width:100%;height:100%;border:0;pointer-events:none}');
    /* Пока ролик играет, кадр под ним гасится (иначе сквозь тёмные сцены
       ролика просвечивает статичная картинка), а текст героя поджимается:
       описание уходит, остаются логотип/заголовок и мета — экран 02 карточки
       решает ту же задачу тем же приёмом. */
    css.push('.lumen-hero.lumen-hero--trailer .lumen-hero__bg.is-active{opacity:.25}');
    css.push('.lumen-hero.lumen-hero--trailer .lumen-hero__descr{display:none}');

    /* Вуали — градиенты, не фильтры (ограничение брифа 5): слева под текст,
       снизу под ряды (там фон почти чёрный). */
    css.push('.lumen-hero .lumen-hero__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
    css.push('.lumen-hero .lumen-hero__veil--l{background:-webkit-linear-gradient(left,rgba(' + P.bgRgb + ',.94) 0%,rgba(' + P.bgRgb + ',.6) 38%,rgba(' + P.bgRgb + ',0) 72%);background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.94) 0%,rgba(' + P.bgRgb + ',.6) 38%,rgba(' + P.bgRgb + ',0) 72%)}');
    /* Правка пользователя 2026-09-17 (второй круг, п.2): «условно с середины
       картинки сделаем полупрозрачный, в середине 70 %, до 0 % в конце».
       Раньше нижняя вуаль выходила в сплошной фон за 16 % высоты — переход
       читался как граница. Теперь кадр растворяется от середины: на половине
       высоты картинка видна на 70 % (вуаль .3), к низу — фон целиком.
       Нового слоя ради этого не заводим: стопы правятся у той же вуали,
       которую композитор уже рисует. */
    /* Правка пользователя 2026-09-17 (третий круг): «фон хочется чтобы был
       больше прозрачного». Ослаблены СРЕДНИЕ стопы: на 14 % высоты вуаль
       .62 вместо .86, на половине — .18 вместо .3. Картинка читается заметно
       ниже, чем раньше.
       Нижний стоп при этом остался полностью непрозрачным, и это проверено
       живьём (снимок главной, 2026-09-17): кадр героя обрезан по своей
       высоте (overflow:hidden), ниже кромки картинки нет вовсе, поэтому
       полупрозрачный нижний стоп давал на стыке с рядами видимую ступеньку —
       7 % кадра резко обрывались в фон. Прозрачность имеет смысл там, где
       под вуалью ещё есть что показывать, а не на самой границе. */
    css.push('.lumen-hero .lumen-hero__veil--b{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.62) 14%,rgba(' + P.bgRgb + ',.18) 50%,rgba(' + P.bgRgb + ',0) 88%);background:linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',.62) 14%,rgba(' + P.bgRgb + ',.18) 50%,rgba(' + P.bgRgb + ',0) 88%)}');

    /* Правка пользователя 2026-09-17 (второй круг, п.1): «а может текст вниз
       спустить, чтобы не перекрывало картинку?». Блок прижат к НИЖНЕЙ кромке
       кадра — верх картинки (лица, центр композиции) остаётся открытым.

       Прежний запрет («к низу героя блок прижать нельзя») снят той же
       правкой, что свела кадр и ряд в одну точку: кадр больше не уходит под
       ряды, его низ и есть граница свободного места, поэтому прижатый к нему
       текст под ряды не попадает. Отступ снизу — TEXT_BOTTOM, а когда на
       главной есть чипы настроения (класс .lumen-moods-on ставит LC.moods),
       текст поднят ещё на высоту их полосы: чипы стоят под ним.

       Плавность перехода в сжатое состояние отдельного правила не просит:
       блок прижат к низу кадра, а высота кадра уже анимируется (правило
       .lumen-hero.lumen-motion-full выше) — текст едет вместе с кромкой.

       Сверху блок ограничен безопасной зоной HERO_HEAD_SAFE: кадр проходит
       ПОД шапкой Lampa, и без этой границы высокое содержимое налезало на
       заголовок активности и иконки (находка пользователя на низком окне).
       Блок занимает всю зону между шапкой и своим отступом снизу, содержимое
       прижато к нижнему краю (box-pack:end — у старых webkit это единственный
       рабочий способ), а лишнее срезается его собственным overflow.
       Срезаться, впрочем, нечему: ниже посчитан порог, за которым кадр с
       таким содержимым не показывается вовсе.

       Safe area слева — 2.81em (§0.1); по ней же выровнены заголовки рядов
       (правило .lumen-main .items-line__head ниже), чтобы логотип фильма и
       «Сейчас смотрят» стояли на одной вертикали. */
    /* Собственные отступы блока делятся на его же кегль: em у left/top/bottom
       считается от font-size САМОГО элемента, и без деления поднятый кегль
       увёл бы текст вправо от safe area (замер живьём: 71 px вместо 64 px —
       логотип переставал стоять на одной вертикали с заголовком ряда). После
       деления обе величины дают те же 2.81em и 1.6em базового кегля, а смена
       состояния не двигает блок вбок. */
    function textBox(zoom) {
      return 'left:' + round2(2.81 / zoom) + 'em;right:' + round2(2.81 / zoom) + 'em;top:' + round2(HERO_HEAD_SAFE / zoom) + 'em;bottom:' + round2(TEXT_BOTTOM / zoom) + 'em;font-size:' + zoom + 'em';
    }
    css.push('.lumen-hero .lumen-hero__text{position:absolute;' + textBox(TEXT_ZOOM) + ';max-width:46em;overflow:hidden;' +
      'display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-box-direction:normal;-webkit-flex-direction:column;flex-direction:column;' +
      '-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
    /* В сжатом состоянии кегль почти тот же (пользователь просил 3-5 % против
       прежнего), но анимировать его нельзя: font-size пересчитывает раскладку
       блока каждый кадр. Смена мгновенная, а едет блок целиком — вместе с
       нижней кромкой кадра, высота которой и анимируется. */
    css.push('.lumen-hero.lumen-hero--compact .lumen-hero__text{' + textBox(TEXT_ZOOM_COMPACT) + '}');
    /* Полоса чипов стоит в нижней части кадра, поэтому низ текста поднят над
       ней ровно на её высоту с воздухом. В сжатом состоянии чипов нет, и
       текст опускается к самой кромке — это движение и есть часть перехода,
       поэтому в полном режиме анимаций оно едет (правило ниже), а в lite/off
       происходит мгновенно, как и всё остальное. */
    var textBottomMoods = round2(MOODS_GAP + MOODS_H + TEXT_BOTTOM);
    css.push('.lumen-moods-on .lumen-hero .lumen-hero__text{bottom:' + round2(textBottomMoods / TEXT_ZOOM) + 'em}');
    css.push('.lumen-moods-on.lumen-rows-up .lumen-hero .lumen-hero__text{bottom:' + round2((MOODS_GAP + MOODS_H_COMPACT + TEXT_BOTTOM_COMPACT) / TEXT_ZOOM_COMPACT) + 'em}');
    css.push('.lumen-hero .lumen-hero__meta{font-family:' + FM + ';font-weight:400;font-size:.88em;line-height:1.2;letter-spacing:.03em;color:' + P.muted + '}');
    /* Логотип фильма — фоном (contain), максимум 30.69em = 700 px FHD (§0.2).
       Отдельного <img> нет: единственный путь к картинкам — прокси TMDB. */
    /* Правка пользователя 2026-09-17 (четвёртый круг): «нет какого-то
       единого размера». Третий круг выровнял логотипы по ВЫСОТЕ этой рамки,
       и высота у всех стала одна — но двухстрочный логотип укладывает в неё
       две строки букв и читается вдвое мельче однострочного. Размер
       конкретного логотипа теперь считает герой по его пропорции из TMDB
       (LC.hero.logoBox, src/48_hero.js: равная ПЛОЩАДЬ) и пишет инлайном —
       в таблице стилей пропорцию знать неоткуда.

       Правила ниже задают рамку ПО УМОЛЧАНИЮ: её получают логотипы, у
       которых в ответе нет ни aspect_ratio, ни width/height. Она та же, что
       была в третьем круге, — 37.84 × 4.4em, то есть 8.6:1: всё, что не
       длиннее, упирается в высоту, а не в ширину. */
    css.push('.lumen-hero .lumen-hero__logo{display:none;width:37.84em;max-width:100%;height:4.4em;margin-top:.4em;-webkit-background-size:contain;background-size:contain;background-position:left bottom;background-repeat:no-repeat}');
    css.push('.lumen-hero.lumen-hero--logo .lumen-hero__logo{display:block}');
    /* Текстовый фолбэк названия — обычный текст без панели (поправка
       контроллера к Task 18, единообразно с экранами 16–19). */
    /* Фолбэк без логотипа: две строки по 1.08 при кегле 2.04em дают 4.4em —
       середину диапазона высот логотипа (2.4…5.2em, LC.hero.logoBox). По
       весу он сопоставим с логотипами и не выпадает ни в одну сторону, а
       фиксированная высота не даёт длинному названию разъехать блок. */
    css.push('.lumen-hero .lumen-hero__title{font-family:' + FD + ';font-weight:800;font-size:2.04em;line-height:1.08;color:' + P.text + ';margin-top:.4em;height:2.16em;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}');
    css.push('.lumen-hero.lumen-hero--compact .lumen-hero__title{height:1.57em;-webkit-line-clamp:1}');
    css.push('.lumen-hero.lumen-hero--logo .lumen-hero__title{display:none}');
    css.push('.lumen-hero .lumen-hero__descr{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;font-family:' + FB + ';font-weight:400;font-size:1.05em;line-height:1.45;color:' + P.muted + ';max-width:39.45em;margin-top:.5em}');

    /* Скелетон, пока грузятся детали (ограничение брифа 3): плашка меты —
       всегда (жанров и длительности в данных ряда нет), плашки описания —
       только когда у карточки нет и краткого overview. */
    css.push('.lumen-hero .lumen-hero__sk{display:none;height:.75em;border-radius:.37em;background:-webkit-linear-gradient(left,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06));background:linear-gradient(90deg,rgba(' + P.textRgb + ',.14),rgba(' + P.textRgb + ',.06))}');
    css.push('.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta{display:block;width:14em;max-width:60%;margin-top:.4em}');
    css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr{display:block;width:39.45em;max-width:100%;margin-top:.8em}');
    css.push('.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--short{display:block;width:26.3em;max-width:67%;margin-top:.4em}');

    /* Чип рейтинга TMDB (§0.2, тот же паттерн, что в карточке) и статус
       сериала текстом «Выходит · 17 дек» (поправка контроллера). */
    css.push('.lumen-hero .lumen-hero__chips{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:.45em}');
    css.push('.lumen-hero .lumen-hero__rate{display:none;font-family:' + FM + ';font-weight:600;font-size:1.05em;line-height:1;color:' + P.text + ';background:' + P.chipBg + ';border:.04em solid ' + P.line + ';border-radius:.53em;padding:.32em .7em;margin-right:.53em}');
    css.push('.lumen-hero.lumen-hero--rated .lumen-hero__rate{display:block}');
    css.push('.lumen-hero .lumen-hero__rate:after{content:"TMDB";font-size:.5em;letter-spacing:.1em;color:' + P.smoke + ';margin-left:.7em}');
    css.push('.lumen-hero .lumen-hero__status{display:none;font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1;color:' + A + ';background:rgba(' + A_RGB + ',.1);border:.04em solid rgba(' + A_RGB + ',.4);border-radius:.53em;padding:.4em .7em}');
    css.push('.lumen-hero.lumen-hero--status .lumen-hero__status{display:block}');

    /* Сжатый и мини-герой описания не показывают (§0.2, экраны 17/18/20).
       Правка 2026-09-17 (второй круг, п.1): и логотип в сжатом мельче —
       текст прижат к низу кадра, а кадр стал ниже на ту же долю .72, и
       полноразмерному логотипу места уже не остаётся. Высоту логотипа
       анимируем вместе с высотой кадра (правило motion-full ниже), чтобы
       переход между состояниями был одним движением, а не подменой.
       Мета-строка в сжатом состоянии тоже уходит: сжатый кадр — это .72 от
       полного, и её строка там уже не помещается (проверено живьём при всех
       четырёх размерах), а год и хронометраж видны на карточке под фокусом.
       Ровно тот же компактный набор — при самом маленьком размере кадра
       («компактный»), там он нужен уже в верхнем состоянии. */
    var smallText = heroSmallText();
    css.push('.lumen-hero.lumen-hero--compact .lumen-hero__logo{width:27.52em;height:3.2em}');
    /* Ширина едет вместе с высотой: обе задаёт инлайн-стиль от logoBox и на
       переходе в сжатое состояние меняются разом — анимируй одну высоту, и
       пропорция логотипа была бы порвана все 420 мс перехода. */
    css.push('.lumen-hero.lumen-motion-full .lumen-hero__logo{-webkit-transition:height .42s cubic-bezier(.2,.8,.2,1),width .42s cubic-bezier(.2,.8,.2,1);transition:height .42s cubic-bezier(.2,.8,.2,1),width .42s cubic-bezier(.2,.8,.2,1)}');
    css.push('.lumen-hero.lumen-hero--compact .lumen-hero__meta,.lumen-hero.lumen-hero--compact .lumen-hero__sk--meta{display:none}');
    css.push('.lumen-hero.lumen-hero--compact .lumen-hero__descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--descr,.lumen-hero.lumen-hero--compact .lumen-hero__sk--short{display:none}');
    if (smallText) {
      css.push('.lumen-hero .lumen-hero__logo{height:3.2em}');
      css.push('.lumen-hero .lumen-hero__meta,.lumen-hero .lumen-hero__sk--meta{display:none}');
    }

    /* Подмена текста (раскадровка 23а): старый уходит вниз за 180 мс, новый
       поднимается за 420 мс. В lite/off — мгновенно и без анимаций: подъём
       текста и плавная высота на слабых ТВ дороже, чем стоят. */
    /* bottom в этом же списке — им текст опускается к кромке кадра, когда
       на листании уходят чипы; время и кривая те же, что у высоты кадра,
       поэтому текст и кромка едут одним движением. */
    css.push('.lumen-hero.lumen-motion-full .lumen-hero__text{-webkit-transition:opacity .18s ease,-webkit-transform .18s ease,bottom .42s cubic-bezier(.2,.8,.2,1);transition:opacity .18s ease,transform .18s ease,bottom .42s cubic-bezier(.2,.8,.2,1)}');
    css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping{opacity:0;-webkit-transform:translateY(.53em);transform:translateY(.53em)}');
    css.push('.lumen-hero.lumen-motion-full .lumen-hero__text.is-in{-webkit-animation:lumen-hero-in .42s cubic-bezier(.2,.8,.2,1);animation:lumen-hero-in .42s cubic-bezier(.2,.8,.2,1)}');
    css.push('@-webkit-keyframes lumen-hero-in{from{opacity:0;-webkit-transform:translateY(.53em)}to{opacity:1;-webkit-transform:none}}');
    css.push('@keyframes lumen-hero-in{from{opacity:0;transform:translateY(.53em)}to{opacity:1;transform:none}}');
    css.push('.lumen-hero.lumen-motion-lite .lumen-hero__text,.lumen-hero.lumen-motion-off .lumen-hero__text{opacity:1;-webkit-transform:none;transform:none;-webkit-transition:none;transition:none;-webkit-animation:none;animation:none}');

    /* --- Task 19: чипы профилей настроения (design-spec-main §Task 19) ---
       Правка пользователя 2026-09-17 (второй круг): блок .lumen-moods живёт
       СОБСТВЕННЫМ узлом в корне активности главной, а не внутри
       .lumen-hero__text. Раньше он был частью героя и исчезал вместе с ним
       при «Герой: выключен», а в сжатом состоянии его срезала кромка кадра
       (у героя overflow:hidden). Теперь чипы на главной есть при любом
       размере героя, включая выключенный. Класс .lumen-moods-on на корне
       ставит LC.moods (src/49_moods.js) — им же раскладка узнаёт, что под
       чипы нужно место.
       pointer-events блоку больше не нужны: он вне героя, а тот один во всём
       плагине отключает указатель.
       Чипы используют те же токены акцента, что хабовые .lumen-chip. */
    css.push('.lumen-moods{position:absolute;left:2.81em;right:2.81em;z-index:2;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    /* Полоса стоит ВНУТРИ кадра, над его нижней кромкой: её низ отстоит от
       кромки на MOODS_GAP, а сама кромка — на HERO_AIR выше заголовка
       первого ряда. Ни с кадром, ни с областью рядов полоса не пересекается,
       а текст героя поднят над ней (правило выше). При переносе строк она
       растёт вверх, в кадр. В сжатом состоянии чипы уходят вместе с
       описанием: на листании они не нужны, а ряды поднимаются на их место. */
    css.push('.lumen-main .lumen-moods{bottom:' + round2(heroCut + HERO_AIR + MOODS_GAP) + 'em}');
    /* Правка пользователя 2026-09-17 (третий круг): «а добавить такие же
       теги?» — полоса остаётся и на листании. Нижняя кромка сжатого кадра —
       это 28vh + (compactCut + HERO_AIR)em от низа экрана, полоса встаёт над
       ней на тот же зазор, что и в верхнем состоянии. Блок не появляется и
       не исчезает: между состояниями меняются только его место и кегль
       чипов, поэтому переход — одно движение (transition ниже), а не
       подмена. Чипы в сжатом чуть мельче (.8em против .88em): без этого
       содержимому не хватает высоты, но нажимаемыми они остаются — высота
       чипа 1.97em, то есть 45 px при 1920×1080. */
    css.push('.lumen-main.lumen-rows-up .lumen-moods{bottom:-webkit-calc(28vh + ' + round2(heroCompactCut + HERO_AIR + MOODS_GAP) + 'em);bottom:calc(28vh + ' + round2(heroCompactCut + HERO_AIR + MOODS_GAP) + 'em)}');
    css.push('.lumen-main.lumen-rows-up .lumen-mood-chip{font-size:' + CHIP_ZOOM_COMPACT + 'em}');
    css.push('body.lumen-motion-full .lumen-moods{-webkit-transition:bottom .42s cubic-bezier(.2,.8,.2,1);transition:bottom .42s cubic-bezier(.2,.8,.2,1)}');
    /* Герой выключен настройкой: узла героя нет и класса .lumen-main на
       активности нет тоже — чипы встают под штатной шапкой Lampa, а ряды
       опускаются на высоту их полосы (иначе полоса легла бы на первый ряд). */
    css.push('.lumen-moods-on:not(.lumen-main) .lumen-moods{top:.53em}');
    css.push('.lumen-moods-on:not(.lumen-main) .scroll.layer--wheight{margin-top:' + MOODS_BAR + 'em;height:-webkit-calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important;height:calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important}');
    css.push('.lumen-mood-chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.46em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:.53em;border:.04em solid ' + P.line + ';background:' + P.chipBg + ';font-family:' + FB + ';font-weight:600;font-size:.88em;line-height:1;color:' + P.muted + ';white-space:nowrap;cursor:default;-webkit-transition:background-color .2s,border-color .2s,color .2s;transition:background-color .2s,border-color .2s,color .2s}');
    css.push('.lumen-mood-chip.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');
    /* Режим анимаций читается с body (его держит LC.applyMotionMode, пока
       плагин активен): чипы больше не лежат внутри героя, и его собственный
       класс режима до них не достаёт. */
    css.push('body.lumen-motion-off .lumen-mood-chip,body.lumen-motion-lite .lumen-mood-chip{-webkit-transition:none;transition:none}');

    /* Ряды живут в СВОЕЙ области — под героем. Сдвигается сама область
       прокрутки (margin-top + height), а не содержимое (padding-top).

       Найдено живьём (первый круг Task 18): padding-top у .scroll__body
       работает ровно до первой прокрутки — Lampa выравнивает ряд, получивший
       фокус, по верху области прокрутки, и после первого же шага вниз-вверх
       первый ряд вставал на место героя, закрывая его совсем. Со сдвинутой
       областью «верх области» и есть нижняя кромка героя, поэтому любой ряд
       под фокусом оказывается под ним.

       Фаза 3 (долг фазы 2): раньше здесь стояло margin-top:22vh — предел,
       дальше которого штатная карточка главной Lampa (290×563 при 1920) не
       помещалась в остаток экрана, и видимая часть героя была ~36 % вместо
       58 % дизайна. Теперь карточки рядов приведены к дизайнерским 230×345
       (правила ниже), и высота области считается от НИХ, а не берётся долей
       экрана: область — ровно один ряд, всё остальное достаётся герою.

       Слагаемые (все — в em, то есть в долях базового кегля Lampa, поэтому
       раскладка одинакова на 1280, 1920 и 3840):
         LAMPA_ROW_PAD 2.5em — padding-top у .scroll__content, тот самый
           «ещё ~57 px над фокусным рядом», который Lampa держит сама;
         ROW_BLOCK_EM + ROW_BLOCK_FIXED — сам ряд: заголовок, постер 2:3 и две
           строки подписи с зазорами (20.6em при обычном масштабе; замер живьём
           дал 464 px = 20.34em, разница — запас до кромки экрана).
       Масштаб интерфейса умножает ROW_BLOCK, потому что карточки рядов он
       увеличивает тоже: крупнее ряд — меньше остаётся герою, и наоборот.
       margin-top = экран − шапка Lampa (4em) − область: герой виден ровно на
       ту часть экрана, что осталась (≈57 % при обычном масштабе).

       Селектор — главный ВЕРТИКАЛЬНЫЙ скролл активности (.layer--wheight);
       горизонтальные скроллы рядов (.scroll--horizontal) под него не
       попадают. height Lampa задаёт инлайном, поэтому !important. */
    var rowsArea = rowsAreaEm(scale);
    var rowsTop = round2(LAMPA_HEAD + rowsArea) + 'em';
    /* Правка пользователя 2026-09-17 (п.1): хвосты подписей под кадром героя.

       Что это было (замер живьём, 1920×1080): Lampa держит над фокусным
       рядом 2.5em отступа (.scroll__content{padding:57px 0}) и выравнивает
       фокусный ряд по НЕМУ, а не по кромке области. В эти 57 пикселей и
       попадает нижний край предыдущего ряда — строка года у каждой карточки.
       Получалась полоса «2026 2026 2026…» поперёк экрана прямо под кадром.
       Обрезка тут бессильна: хвост лежит ВНУТРИ области, а не над ней.

       Лечится маской. Она на этом узле уже есть — Lampa вешает .scroll--mask
       с затуханием 0→8 % сверху и 92→100 % снизу (vendor/lampa/css/app.css),
       и на 8 % (52 px) хвост оставался читаемым. Мы подменяем ТОЛЬКО стопы:
       до 2em маска пустая, к 2.5em (ровно отступ Lampa) выходит в полную
       непрозрачность. Фокусный ряд при этом не теряет ни пикселя — он
       начинается как раз на 2.5em. Нижнее затухание Lampa оставляем как есть.
       Лишней цены для ТВ нет: композитор уже применял здесь маску, изменились
       только точки градиента.

       overflow:hidden оставлен явным, хотя Lampa на этот скролл сама вешает
       .scroll--over: полагаться на чужой флаг (его ставит компонент, передав
       over:true) для нашей раскладки нельзя — без обрезки нижний ряд вылезал
       бы за кромку области.

       Прокрутку и ленивую догрузку рядов это не трогает: .scroll__body
       по-прежнему ездит transform'ом, а видимость ряда Lampa считает по
       геометрии (offsetTop/height), а не по нарисованным пикселям. */
    var maskStops = 'rgba(255,255,255,0) 0,rgba(255,255,255,0) 2em,#fff 2.5em,#fff 92%,rgba(255,255,255,0) 100%';
    css.push('.lumen-main .scroll.layer--wheight{margin-top:-webkit-calc(100vh - ' + rowsTop + ');margin-top:calc(100vh - ' + rowsTop + ');height:' + rowsArea + 'em !important;overflow:hidden;' +
      '-webkit-mask-image:-webkit-linear-gradient(top,' + maskStops + ');mask-image:linear-gradient(to bottom,' + maskStops + ')}');

    /* Окно настолько низкое, что под героя не остаётся ничего: ряд плюс шапка
       Lampa уже выше экрана, и вычисленный отступ ушёл бы в минус — ряды
       наехали бы на шапку, а кадр героя накрыл бы их сверху (тот самый
       дефект, из-за которого высота героя и стала считаться от ряда).
       Порог — отношение сторон, при котором (4em + область рядов) равно
       высоте экрана: em Lampa считает от ширины (innerWidth / 84.17), так
       что условие «высоты не хватает» выражается одним aspect-ratio.
       На ТВ и в обычном окне браузера (16:9, 16:10, 21:9) правило не
       срабатывает; за порогом плагин отдаёт весь экран рядам и кадр героя
       не показывает — показывать его там негде. */
    /* Правка пользователя 2026-09-17 (второй круг, главное): «когда начинаем
       листать список фильмов, ряды должны быть подняты».

       Что было: сжатый герой (фокус ниже первого ряда) отдавал 28 % своей
       высоты никому — область рядов оставалась на месте, и под кадром зияла
       пустая полоса в половину экрана (замер живьём при 1920×1080 и среднем
       герое: низ кадра 351 px, верх ряда 488 px — 137 px пустоты).

       Теперь та же величина достаётся рядам: класс .lumen-rows-up на корне
       (его ставит LC.hero там же, где .lumen-hero--compact, — второго
       источника правды о фокусе не заводим) расширяет область вверх ровно
       на столько, на сколько уменьшился кадр. Арифметика та же, что у
       верхнего состояния, только высота кадра теперь 72vh − compactCut:
         верх первого ряда = 72vh − compactCut,
         область = 2.5em (отступ Lampa над фокусным рядом) + compactCut + 28vh,
         отступ сверху = 100vh − 4em − область = 72vh − (4em + область).
       Проверка смыкания — в тестах css: низ кадра обязан отставать от верха
       ряда ровно на HERO_AIR в ОБОИХ состояниях.

       Переход плавный только в режиме полных анимаций, как и высота самого
       кадра: класс режима стоит на герое, а он — сосед .activity__body в
       корне активности, поэтому до области прокрутки правило дотягивается
       соседним комбинатором, не заводя второго класса. Кривая и длительность
       те же, что у высоты кадра: обе величины линейны по vh и em, поэтому в
       каждый момент перехода низ кадра и верх ряда сходятся, и пустой зоны
       не возникает ни в одном промежуточном положении. */
    var compactArea = compactAreaEm(scale);
    var compactTop = round2(LAMPA_HEAD + compactArea);
    css.push('.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:-webkit-calc(72vh - ' + compactTop + 'em);margin-top:calc(72vh - ' + compactTop + 'em);height:-webkit-calc(28vh + ' + compactArea + 'em) !important;height:calc(28vh + ' + compactArea + 'em) !important}');
    css.push('.lumen-main .lumen-hero.lumen-motion-full ~ .activity__body .scroll.layer--wheight{-webkit-transition:margin-top .42s cubic-bezier(.2,.8,.2,1),height .42s cubic-bezier(.2,.8,.2,1);transition:margin-top .42s cubic-bezier(.2,.8,.2,1),height .42s cubic-bezier(.2,.8,.2,1)}');

    /* Два порога низкого окна. Оба выражены отношением сторон: em Lampa
       считается от ШИРИНЫ (innerWidth / 84.17), поэтому «высоты в em не
       хватает» — это ровно «экран слишком широк по отношению к высоте».

       Первый: кадру не хватает высоты на описание — тогда в нём остаются
       мета, логотип и рейтинг (текст прижат к низу, лишние строки срезало бы
       верхней кромкой безопасной зоны).
       Второй: не помещается и этот минимум — героя не показываем вовсе, ряды
       занимают экран целиком, как при «Герой: выключен», а чипы настроения
       встают полосой под шапкой (правила ниже — те же, что в режиме без
       героя, но специфичнее, потому что класс .lumen-main здесь остаётся).
       Промежуточных состояний между ними нет: либо содержимое помещается
       целиком, либо кадра нет — это и есть страховка от наложений на шапку
       Lampa и друг на друга, найденных пользователем на низком окне. */
    var descrMinRatio = Math.round(84.17 / (heroCut + HERO_AIR + textNeedEm(true)) * 100);
    css.push('@media screen and (min-aspect-ratio:' + descrMinRatio + '/100){' +
      '.lumen-hero .lumen-hero__descr,.lumen-hero .lumen-hero__sk--descr,.lumen-hero .lumen-hero__sk--short{display:none}}');

    /* Пол порога. Бюджет содержимого считается в em, а em Lampa — это доля
       ШИРИНЫ: у мелкого кадра (средний, компактный) вычисленный порог падал
       до 1.93 и 1.79, то есть кадр исчезал бы в обычном окне (1920×950,
       21:9-мониторы). Ниже 2.2:1 порог не опускается: в таком окне высоты на
       содержимое хватает всегда, а если чего-то не хватит, текст ограничен
       безопасной зоной сверху и срежет лишнее сам — это мягче, чем пропажа
       кадра. Ветка «кадра нет» остаётся тем, чем задумана: экстремально
       приплюснутое окно и явный выбор «Герой: выключен» в настройках. */
    /* Правка пользователя 2026-09-17 (третий круг): «в сжатом состоянии нет
       описания». Возвращаем его — одной строкой с многоточием, вместе с
       мета-строкой, ровно там, где сжатому кадру хватает на них высоты.
       Условие то же по форме, что у порогов выше, только высота кадра здесь
       72vh − (compactCut + HERO_AIR)em, отсюда множитель .72. Ниже порога на
       листании остаются логотип и рейтинг — то, что помещается всегда. */
    var compactMetaMaxRatio = Math.round(84.17 * HERO_COMPACT / (heroCompactCut + HERO_AIR + compactNeedEm(false)) * 100);
    css.push('@media screen and (max-aspect-ratio:' + compactMetaMaxRatio + '/100){' +
      '.lumen-hero.lumen-hero--compact .lumen-hero__meta{display:block}}');
    var compactDescrMaxRatio = Math.round(84.17 * HERO_COMPACT / (heroCompactCut + HERO_AIR + compactNeedEm(true)) * 100);
    css.push('@media screen and (max-aspect-ratio:' + compactDescrMaxRatio + '/100){' +
      '.lumen-hero.lumen-hero--compact .lumen-hero__descr{display:-webkit-box;-webkit-line-clamp:1}}');

    var heroMinRatio = Math.max(HERO_MIN_RATIO, Math.round(84.17 / (heroCut + HERO_AIR + textNeedEm(false)) * 100));
    css.push('@media screen and (min-aspect-ratio:' + heroMinRatio + '/100){' +
      '.lumen-main .scroll.layer--wheight,.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:0;height:-webkit-calc(100vh - 4em) !important;height:calc(100vh - 4em) !important;overflow:hidden}' +
      '.lumen-moods-on.lumen-main .lumen-moods{top:.53em;bottom:auto}' +
      /* Кадра нет — прятать чипы на листании незачем: их полоса стоит под
         шапкой и рядам не мешает, а место, которое они освобождали, здесь
         уже отдано рядам самим отсутствием кадра. */
      '.lumen-moods-on.lumen-main.lumen-rows-up .lumen-moods{display:-webkit-box;display:-webkit-flex;display:flex}' +
      '.lumen-moods-on.lumen-main .scroll.layer--wheight,.lumen-moods-on.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:' + MOODS_BAR + 'em;height:-webkit-calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important;height:calc(100vh - ' + round2(LAMPA_HEAD + MOODS_BAR) + 'em) !important}' +
      '.lumen-hero{display:none}}');

    /* --- Фаза 3 (долг фазы 2): карточка ряда главной (design-spec-main §0.4) ---
       Штатная карточка Lampa — .card шириной 12.75em (290 px при 1920), дизайн
       требует 230×345, то есть 10.08em (высоту даёт штатный padding-bottom:150 %
       у .card__view — пропорция 2:3 сохраняется сама).

       Правила стоят под нашим корнем .lumen-main (класс ставит LC.hero на
       активности главной), то есть действуют только там, где плагин рисует
       героя. Задеты при этом ВСЕ ряды главной, а не только наши: ряды плагина
       ничем не помечены в разметке (Lampa кладёт всем items-line--type-default,
       проверено живьём), а главное — раскладка «герой + один ряд» имеет смысл
       только целиком: оставь мы штатные ряды 290×563, первый же из них не
       поместился бы в область и был бы обрезан её нижней кромкой. Дизайн
       главной (экраны 15–19) и рисует все ряды одного размера.

       Подписи — из §0.4: название 22px/1.15 (.96em) в ОДНУ строку, мета
       20px (.88em). Одна строка, а не две: вторая строка отнимает у героя
       столько же экрана, сколько сама занимает, а полное название видно в
       карточке. Заголовок ряда — 28px (1.23em, §0.3), у Lampa он 1.6em.

       Фокус: кольцо акцентом вместо белого штатного и свечение (§0.4). scale
       здесь НЕ ставим, в отличие от сетки подборки: у Lampa на .card__view
       висит собственная анимация фокуса (animation-card-focus), и свой
       transform на карточке спорил бы с ней в чужом горизонтальном скролле. */
    var rowCardW = round2(ROW_CARD_W * scale) + 'em';
    css.push('.lumen-main .card{width:' + rowCardW + '}');
    css.push('.lumen-main .card__view{margin-bottom:.5em;border-radius:.31em}');
    css.push('.lumen-main .card__img{border-radius:.31em}');
    css.push('.lumen-main .card__title{font-family:' + FD + ';font-weight:700;font-size:' + round2(.96 * scale) + 'em;line-height:1.15;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.text + '}');
    css.push('.lumen-main .card__age{font-family:' + FM + ';font-size:' + round2(.88 * scale) + 'em;line-height:1;margin-top:.25em;color:' + P.muted + '}');
    css.push('.lumen-main .items-line__title{font-family:' + FD + ';font-weight:700;font-size:' + round2(1.23 * scale) + 'em}');
    css.push('.lumen-main .items-line{padding-bottom:1.4em}');
    /* Правка пользователя 2026-09-17 (второй круг): «левый край логотипа и
       левый край „Сейчас смотрят“ должны стоять на одной линии». У Lampa и
       заголовок ряда, и лента карточек отступают от кромки на 1.5em, а
       safe area плагина — 2.81em (§0.1), по ней стоит текст героя. Двигаем
       ряды к ней, а не героя к Lampa: 1.5em — это меньше безопасной зоны
       телевизора, на ТВ такой отступ съедает оверскан. */
    css.push('.lumen-main .items-line__head{margin-bottom:.7em;padding-left:2.81em}');
    css.push('.lumen-main .items-line .scroll__content{padding-left:2.81em}');
    css.push('.lumen-main .card.focus .card__view:after{border-width:.13em;border-color:' + AL + ';border-radius:.44em;-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');

    /* --- Task 25: метки на постерах рядов (главная и сетка подборки) ---
       Метка лежит ВНУТРИ штатного .card__view, поэтому у неё собственное имя
       (.lumen-badge) и она не спорит со штатными .card__quality/.card__type/
       .card__marker: те висят по правому верхнему и нижнему краю, наша — по
       левому верхнему. Узкая карточка ряда (10.08em) длинного текста не
       вмещает, поэтому метка не переносится и обрезается многоточием.
       Полоса прогресса — только на главной: в сетке подборки её рисует сама
       сетка (.lumen-gcard__bar), и LC.badges зовётся там с bar:false. */
    css.push('.lumen-main .lumen-badge,.lumen-grid .lumen-badge{position:absolute;top:.4em;left:.4em;max-width:-webkit-calc(100% - .8em);max-width:calc(100% - .8em);font-family:' + FB + ';font-weight:600;font-size:.61em;line-height:1;letter-spacing:.02em;padding:.4em .6em;border-radius:.4em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + t.onac + ';background:' + A + ';z-index:2}');
    /* «Новинка» и «Скоро» — акцентом (это приглашение), «Продолжить» и метки
       рядов (новая серия, адвент) — плотной тёмной картой: там важнее не
       перебить постер, по которому пользователь и так уже ходил. */
    css.push('.lumen-main .lumen-badge--progress,.lumen-grid .lumen-badge--progress,.lumen-main .lumen-badge--custom,.lumen-grid .lumen-badge--custom{color:' + P.text + ';background:' + P.chipBg + ';border:.04em solid ' + P.line + '}');
    css.push('.lumen-main .lumen-badge-bar{position:absolute;left:.4em;right:.4em;bottom:.4em;height:.18em;border-radius:.09em;background:rgba(' + P.textRgb + ',.2);overflow:hidden;z-index:2}');
    css.push('.lumen-main .lumen-badge-bar > div{height:100%;border-radius:.09em;background:' + A + '}');

    /* --- Task 25: скелетоны ---
       Одно правило на все плашки плагина: описание героя до прихода деталей
       (.lumen-hero__sk), ряд отзывов до ответа Кинопоиска (.lumen-review--sk)
       и коллаж плитки хаба, пока идёт запрос.

       Пульсация — ОДНО свойство opacity: его меняет композитор, без
       перерисовки слоя. Именно поэтому здесь нет «бегущего блика» с
       background-position из плана: тот заставляет ТВ перерисовывать плашку
       каждый кадр. В lite/off анимация снимается целиком — гейт на body,
       потому что скелетоны живут на трёх разных корнях (герой, ряд описания,
       хаб), а класс режима на body ставит LC.applyMotionMode для всех. */
    css.push('.lumen-skeleton{background:rgba(' + P.textRgb + ',.10);-webkit-animation:lumen-sk 1.4s ease-in-out infinite;animation:lumen-sk 1.4s ease-in-out infinite}');
    css.push('@-webkit-keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
    css.push('@keyframes lumen-sk{0%,100%{opacity:.5}50%{opacity:1}}');
    css.push('body.lumen-motion-lite .lumen-skeleton,body.lumen-motion-off .lumen-skeleton{-webkit-animation:none;animation:none;opacity:1}');
    /* Плашка на месте карточки отзыва: геометрию даёт сам .lumen-review
       (21.04em × 11.4em), здесь — только заливка вместо содержимого. */
    css.push('.lumen-descr-row .lumen-review--sk{background-image:none}');
    /* Коллаж плитки хаба: плашка занимает весь прямоугольник плитки, поэтому
       ей достаточно скруглений её собственного контейнера. */
    css.push('.lumen-hub .lumen-tile__collage.lumen-skeleton{border-radius:.53em}');

    /* --- Task 29: слой перехода «постер → кадр» ---
       Только раскладка: длительности и конечная геометрия — инлайном из
       src/67_transition.js (иначе одно и то же число жило бы в двух местах).
       pointer-events:none и ни одного слушателя — слой не может ни отобрать
       фокус, ни съесть нажатие пульта. z-index выше всего, что рисует плагин
       на главной, но ниже модалов Lampa (у них 1000+).
       Слой живёт максимум 700 мс и снимается таймером, поэтому «оставить
       экран накрытым» он не может даже при ошибке перехода. */
    css.push('.lumen-overlay{position:fixed;top:0;left:0;right:0;bottom:0;z-index:90;pointer-events:none;overflow:hidden}');
    css.push('.lumen-overlay .lumen-overlay__img{position:absolute;-webkit-background-size:cover;background-size:cover;background-position:center;background-repeat:no-repeat;border-radius:.31em;-webkit-transform-origin:center center;transform-origin:center center;will-change:transform,opacity}');
    /* На бегу скругление уходит: постер превращается в кадр во весь экран, а
       у кадра углов нет. Снимается сразу, а не плавно: инлайновый transition
       перечисляет только transform и opacity, и добавлять в него третье
       свойство ради полутора пикселей на углу — лишняя работа композитору.
       В первом же кадре разгона углы уезжают за пределы экрана. */
    css.push('.lumen-overlay .lumen-overlay__img.is-run{border-radius:0}');

    /* --- Task 23: рулетка «Что посмотреть» ---
       Экран компонента lumen_roulette: шапка с тумблером «Фильмы/Сериалы»,
       лента чипов подборок, чипы фильтров, барабан с постером, кнопка
       «Крутить» и карточка результата. Кадр выпавшего фильма лежит фоном
       под всем этим (.lumen-roulette__bg) и приглушён — текст поверх него
       обязан читаться и на светлой сцене.
       Две размерные семьи кнопок (поправка контроллера к Task 23):
       «Крутить» — 72 px (3.16em) с радиусом 18 px (.79em), кнопки результата
       — 56 px (2.45em) с радиусом 14 px (.61em); это разные классы, а не
       один .full-start__button. */
    css.push('.lumen-roulette{position:relative;min-height:100vh;padding:2.81em 2.81em 3.5em}');
    css.push('.lumen-roulette .lumen-roulette__bg{position:absolute;top:0;right:0;bottom:0;left:0;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:.22;pointer-events:none}');
    css.push('body.lumen-motion-full .lumen-roulette .lumen-roulette__bg{-webkit-transition:opacity .6s ease;transition:opacity .6s ease}');
    css.push('.lumen-roulette .lumen-roulette__head{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:1.4em}');
    css.push('.lumen-roulette .lumen-roulette__title{font-family:' + FD + ';font-weight:700;font-size:2.1em;line-height:1.1;color:' + P.text + ';margin-right:1.05em}');
    css.push('.lumen-roulette .lumen-roulette__media{display:-webkit-box;display:-webkit-flex;display:flex}');
    css.push('.lumen-roulette .lumen-roulette__tab{height:2.1em;padding:0 .96em;margin-right:.53em;border-radius:.53em;border:.04em solid ' + P.line + ';background:' + P.chipBg + ';font-family:' + FB + ';font-weight:600;font-size:.96em;line-height:2.1em;color:' + P.smoke + '}');
    css.push('.lumen-roulette .lumen-roulette__tab.is-on{color:' + P.text + ';border-color:' + AL + '}');
    css.push('.lumen-roulette .lumen-roulette__tab.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + '}');
    /* Лента чипов: подборки в одну строку с переносом — каталог отдаёт их
       десятками, и вертикальный список занял бы весь экран. */
    css.push('.lumen-roulette .lumen-roulette__chips,.lumen-roulette .lumen-roulette__filters{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-bottom:.88em}');
    /* Чип подборки и чип фильтра: собственное оформление, а не наследство
       от .lumen-chip хаба (тот живёт только под .lumen-hub). Отмеченный —
       акцентной рамкой и светлым текстом, фокус — заливкой акцентом. */
    css.push('.lumen-roulette .lumen-roulette__chip{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.1em;padding:0 .88em;margin:0 .53em .53em 0;border-radius:.53em;border:.04em solid ' + P.line + ';background:' + P.chipBg + ';font-family:' + FB + ';font-weight:500;font-size:.96em;line-height:1;color:' + P.smoke + ';white-space:nowrap}');
    css.push('.lumen-roulette .lumen-roulette__chip.lumen-chip--on{color:' + P.text + ';border-color:' + AL + ';background:rgba(' + A_RGB + ',.14)}');
    css.push('.lumen-roulette .lumen-roulette__chip.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em}');
    /* Барабан: окно одного постера 2:3. Постер меняется на каждом шаге плана
       (src/56_roulette.js), «щелчок» — короткая анимация того же узла. */
    css.push('.lumen-roulette .lumen-roulette__stage{position:relative;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;margin-top:1.05em}');
    css.push('.lumen-roulette .lumen-roulette__reel{width:9.2em;height:13.8em;border-radius:.53em;overflow:hidden;background:' + P.panel + ';border:.04em solid ' + P.line + ';-webkit-flex-shrink:0;flex-shrink:0}');
    css.push('.lumen-roulette .lumen-roulette__frame{width:100%;height:100%;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');
    css.push('body.lumen-motion-full .lumen-roulette .lumen-roulette__frame.is-step{-webkit-animation:lumen-roul-step .12s ease-out;animation:lumen-roul-step .12s ease-out}');
    css.push('@-webkit-keyframes lumen-roul-step{from{-webkit-transform:translateY(12%)}to{-webkit-transform:translateY(0)}}');
    css.push('@keyframes lumen-roul-step{from{transform:translateY(12%)}to{transform:translateY(0)}}');
    css.push('.lumen-roulette .lumen-roulette__spin{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:3.16em;padding:0 1.75em;margin-left:1.4em;border-radius:.79em;background:' + A + ';color:' + t.onac + ';font-family:' + FD + ';font-weight:700;font-size:1.05em;border:.04em solid transparent}');
    css.push('.lumen-roulette .lumen-roulette__spin.focus{border-color:' + AL + ';border-width:.11em;-webkit-box-shadow:0 .7em 1.97em ' + AG + ';box-shadow:0 .7em 1.97em ' + AG + '}');
    css.push('.lumen-roulette .lumen-roulette__spin.is-busy{opacity:.7}');
    css.push('.lumen-roulette .lumen-roulette__hint{position:relative;margin-left:1.4em;font-family:' + FB + ';font-size:.96em;color:' + P.smoke + '}');
    /* Карточка результата: название, мета и три кнопки. Появляется на месте
       подсказки, поэтому у неё своя строка под барабаном. */
    css.push('.lumen-roulette .lumen-roulette__result{position:relative;margin-left:1.4em;max-width:31.5em}');
    css.push('.lumen-roulette .lumen-roulette__rtitle{font-family:' + FD + ';font-weight:700;font-size:1.75em;line-height:1.15;color:' + P.text + '}');
    css.push('.lumen-roulette .lumen-roulette__rmeta{font-family:' + FM + ';font-size:.96em;line-height:1;margin-top:.44em;color:' + P.muted + '}');
    css.push('.lumen-roulette .lumen-roulette__actions{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.05em}');
    css.push('.lumen-roulette .lumen-roulette__btn{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.45em;padding:0 1.05em;margin:0 .53em .53em 0;border-radius:.61em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';font-family:' + FB + ';font-weight:600;font-size:.96em;color:' + P.text + '}');
    css.push('.lumen-roulette .lumen-roulette__btn.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em;-webkit-box-shadow:0 .53em 1.53em ' + AG + ';box-shadow:0 .53em 1.53em ' + AG + '}');
    css.push('.lumen-roulette .lumen-roulette__empty{font-family:' + FB + ';font-size:1.05em;color:' + P.smoke + '}');
    /* Пункт меню «Что посмотреть»: иконка набора плагина — 1em, штатные
       иконки меню Lampa — 1.5em (та же правка, что у пункта «Подборки»). */
    css.push('.lumen-menu-roulette .lumen-ico{width:1.5em;height:1.5em}');

    /* --- Task 22: ambient-режим (заставка из кадров) ---
       Слой поверх всего, что рисует плагин (переход постер → кадр — 90,
       мини-карта — 80), но ниже модалов Lampa (1000+): при открытом модале
       заставка и не стартует (canStart, src/54_ambient.js).
       pointer-events:none и ни одного слушателя на самом слое — клавиши
       ловит document, и ровно одно нажатие (первое) он проглатывает.
       Фон слоя — цвет страницы: кадр 16:9 на панели 21:9 не закрывает края,
       и просвечивать туда должен наш фон, а не кадр Lampa под ним. */
    css.push('.lumen-ambient{position:fixed;top:0;left:0;right:0;bottom:0;z-index:95;overflow:hidden;pointer-events:none;background:' + P.bg + ';-webkit-animation:lumen-amb-in .8s ease both;animation:lumen-amb-in .8s ease both}');
    /* Уход слоя. Длительность совпадает с FADE_MS в src/54_ambient.js: узел
       снимается таймером ровно тогда, когда анимация закончилась. */
    css.push('.lumen-ambient.is-out{-webkit-animation:lumen-amb-out .4s ease both;animation:lumen-amb-out .4s ease both}');
    css.push('@-webkit-keyframes lumen-amb-in{from{opacity:0}to{opacity:1}}');
    css.push('@keyframes lumen-amb-in{from{opacity:0}to{opacity:1}}');
    css.push('@-webkit-keyframes lumen-amb-out{from{opacity:1}to{opacity:0}}');
    css.push('@keyframes lumen-amb-out{from{opacity:1}to{opacity:0}}');
    /* Два кадра, между которыми переезжает класс is-active, — тот же приём,
       что у слайдшоу карточки: кроссфейд делает transition на opacity, и
       композитору не нужно перерисовывать ни один пиксель. Без inset. */
    css.push('.lumen-ambient .lumen-ambient__img{position:absolute;top:0;right:0;bottom:0;left:0;background-position:center;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:0;-webkit-transition:opacity 2s ease-in-out;transition:opacity 2s ease-in-out}');
    css.push('.lumen-ambient .lumen-ambient__img.is-active{opacity:1}');
    /* Наезд 1.00 → 1.08 за 20 с (поправка контроллера к Task 22) — только
       при полных анимациях: в «Лёгких» остаётся один кроссфейд, и заставка
       не стоит телевизору ничего, кроме смены картинки раз в 20 секунд. */
    css.push('body.lumen-motion-full .lumen-ambient .lumen-ambient__img.is-active{-webkit-animation:lumen-amb-zoom 20s linear both;animation:lumen-amb-zoom 20s linear both}');
    css.push('@-webkit-keyframes lumen-amb-zoom{from{-webkit-transform:scale(1)}to{-webkit-transform:scale(1.08)}}');
    css.push('@keyframes lumen-amb-zoom{from{transform:scale(1)}to{transform:scale(1.08)}}');
    /* Вуаль под подписью: кадр к низу темнеет, иначе название и часы
       пропадают на светлой сцене. */
    css.push('.lumen-ambient .lumen-ambient__scrim{position:absolute;top:auto;right:0;bottom:0;left:0;height:40%;background:-webkit-linear-gradient(top,rgba(' + P.bgRgb + ',0) 0%,rgba(' + P.bgRgb + ',.82) 100%);background:linear-gradient(to bottom,rgba(' + P.bgRgb + ',0) 0%,rgba(' + P.bgRgb + ',.82) 100%)}');
    css.push('.lumen-ambient .lumen-ambient__info{position:absolute;left:2.81em;bottom:2.81em;right:14em;max-width:36em}');
    css.push('.lumen-ambient .lumen-ambient__title{font-family:' + FD + ';font-weight:700;font-size:1.75em;line-height:1.15;color:' + P.text + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    /* Точки-индикаторы: сколько кадров в ленте сеанса и который идёт
       сейчас (REEL = 8, src/54_ambient.js). */
    css.push('.lumen-ambient .lumen-ambient__dots{display:-webkit-box;display:-webkit-flex;display:flex;margin-top:.88em}');
    css.push('.lumen-ambient .lumen-ambient__dot{width:.35em;height:.35em;border-radius:50%;margin-right:.44em;background:rgba(' + P.textRgb + ',.28)}');
    css.push('.lumen-ambient .lumen-ambient__dot.is-on{background:' + A + '}');
    /* Часы — моно-гарнитурой, как все цифры плагина. Секунд нет: они стоили
       бы отдельного таймера (см. шапку src/54_ambient.js). */
    css.push('.lumen-ambient .lumen-ambient__clock{position:absolute;right:2.81em;bottom:2.81em;font-family:' + FM + ';font-size:2.2em;line-height:1;letter-spacing:.04em;color:' + P.text + '}');

    /* Task 31 (фаза 4): HUD отладки (src/69_hud.js). Верхний левый угол —
       не спорит ни с мини-картой (справа), ни с шапкой карточки; моно-
       гарнитура и зелёный на чёрном — как у консольных оверлеев FPS,
       узнаваемо и не путается с оформлением плагина. pointer-events:none —
       HUD только показывает цифры, фокус отобрать не может. z-index:99999
       — поверх ВСЕГО, включая модалы Lampa (1000+) и оверлеи плеера: иначе
       открытый диалог настроек, где и включают HUD, закрывал бы собой
       цифры, которые должен был показать. */
    css.push('.lumen-hud{position:fixed;top:.3em;left:.3em;z-index:99999;padding:.2em .5em;font:.7em/1.4 Consolas,"Courier New",monospace;color:#0f0;background:rgba(0,0,0,.75);border-radius:.3em;pointer-events:none;white-space:nowrap}');

    /* --- Task 27: мини-карта рядов и индикатор позиции ---
       Панель — design-spec-main §0.16 (экран 32): right 64, top 260,
       width 300, padding 24×22, radius 12. Подложка — общий токен плагина
       P.plate (.85 от цвета темы, в «плотных подложках» — сплошной), а не
       литерал rgba(11,9,8,.72) из дизайна: тёплый литерал не переживает
       смену темы (в «глубокой чёрной» он даёт коричневый ореол на чёрном), а
       .85 против .72 на панели поверх ярких постеров только читабельнее.
       Размытия подложки здесь нет намеренно: панель живёт доли секунды и
       появляется ровно в тот момент, когда ТВ занят прокруткой рядов.
       Слой поверх рядов, но ниже слоя перехода (z-index 90) и модалов Lampa
       (1000+). pointer-events:none и ни одного слушателя: панель только
       показывает, где фокус, и отобрать его не может (план Task 27 Step 2 —
       «не перехватывать сами нажатия»). */
    css.push('.lumen-minimap{position:fixed;right:2.81em;top:11.40em;width:13.15em;padding:1.05em .96em;border-radius:.53em;background:' + P.plate + ';border:.04em solid ' + P.line + ';z-index:80;pointer-events:none}');
    css.push('.lumen-minimap .lumen-minimap__head{font-family:' + FM + ';font-size:.88em;line-height:1;letter-spacing:.14em;color:' + P.smoke + ';margin-bottom:.7em}');
    css.push('.lumen-minimap .lumen-minimap__row{font-family:' + FB + ';font-weight:500;font-size:.88em;line-height:1.15;color:' + P.smoke + ';min-height:2.02em;padding:.31em .61em;border-radius:.35em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}');
    /* Активная строка — тот же паттерн, что у фокуса пункта меню (§0.13):
       подложка приглушённым акцентом и полоса слева его же цветом. */
    css.push('.lumen-minimap .lumen-minimap__row--on{background:rgba(' + A_RGB + ',.14);border-left:.18em solid ' + A + ';color:' + A + ';font-weight:600;padding-left:.43em}');

    /* Индикатор «где я в ряду»: появляется на прыжке и на ускоренном
       листании. Собственного образца в экранах 15–32 у него нет — взяты
       подложка и моно-кегль панели мини-карты, место — нижний край экрана
       по центру, чтобы не спорить с самой панелью справа. */
    css.push('.lumen-jump{position:fixed;left:50%;bottom:2.81em;-webkit-transform:translateX(-50%);transform:translateX(-50%);padding:.53em 1.05em;border-radius:.53em;background:' + P.plate + ';border:.04em solid ' + P.line + ';font-family:' + FM + ';font-size:.96em;line-height:1;letter-spacing:.06em;color:' + P.text + ';z-index:80;pointer-events:none;white-space:nowrap}');

    /* Кнопка поиска по подборкам в шапке хаба (§0.8). Место под неё
       (.lumen-hub__search) держалось с Task 17; теперь это .selector, и у
       него есть состояние фокуса — как у чипов групп. */
    css.push('.lumen-hub .lumen-hub__search{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;height:2.46em;padding:0 1.05em;border-radius:.53em;border:.04em solid ' + P.line + ';background:' + P.buttonBg + ';-webkit-transition:background-color .2s,border-color .2s,color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,border-color .2s,color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
    css.push('.lumen-hub .lumen-hub__search .lumen-ico{width:1.05em;height:1.05em;margin-right:.53em}');
    css.push('.lumen-hub .lumen-hub__search.focus{background:' + A + ';color:' + t.onac + ';border-color:' + AL + ';border-width:.11em;-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .53em 1.53em ' + AG + ';box-shadow:0 .53em 1.53em ' + AG + '}');
    css.push('.lumen-hub.lumen-motion-lite .lumen-hub__search.focus,.lumen-hub.lumen-motion-off .lumen-hub__search.focus{-webkit-transform:none;transform:none}');

    /* Пункт меню «Подборки»: штатные иконки меню Lampa — 1.5em, а наш набор
       отдаёт svg в 1em (src/20_icons.js), и пункт выглядел мельче соседей. */
    css.push('.lumen-menu-hub .lumen-ico{width:1.5em;height:1.5em}');

    /* --- Иконки кнопок (единый набор через CSS-маску, см. src/20_icons.js) --- */
    css.push(LC.icons.css());

    return css.join('\n');
  };

  /* Последний записанный текст CSS карточки: тот же текст повторно в <style>
     не пишем — смена любой настройки lumen_card_* зовёт injectCss, а
     переразбор ~28 КБ стилей на ТВ заметен. */
  var card_css_text = null;

  LC.injectCss = function () {
    try {
      var el = document.getElementById(STYLE_ID);
      if (!el) {
        el = document.createElement('style');
        el.id = STYLE_ID;
        el.type = 'text/css';
        (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(el);
        card_css_text = null;
      }
      var text = LC.buildCss();
      if (text !== card_css_text) {
        if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
        else el.innerHTML = text;
        card_css_text = text;
      }
      /* Task 32: CSS экранов пути пересобирается вместе с CSS карточки
         (смена акцента/шрифтов); сама функция уважает ui_active и lumen_torrents. */
      if (typeof LC.applyTorrentsPref === 'function') LC.applyTorrentsPref();
    } catch (e) {
      warn('css inject failed', e);
    }
  };

  /* Task 10: плагин выключили — <style> карточки снимаем целиком (а не
     подменяем пустым текстом): пустой узел в <head> так же вводил бы в
     заблуждение при разборе DOM, как и наши правила. Сброс card_css_text
     обязателен — иначе повторное включение сочло бы текст неизменившимся и
     оставило бы пустой <style>. */
  LC.removeCss = function () {
    try {
      var el = document.getElementById(STYLE_ID);
      if (el && el.parentNode) el.parentNode.removeChild(el);
      card_css_text = null;
    } catch (e) {
      warn('css remove failed', e);
    }
  };

  LC.injectFonts = function () {
    try {
      var existing = document.getElementById(FONTS_ID);
      if (!useFonts()) {
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
        return;
      }
      /* Правка 2026-09-16 (п.6): адрес зависит от настройки «Шрифт», поэтому
         существующий <link> не просто оставляется, а сверяется с нужным — иначе
         смена гарнитуры применилась бы только после перезахода в Lampa. Тот же
         адрес переписывать нельзя: браузер перезапросит стили и на ТВ это
         заметное мигание текста. */
      var href = LC.fontsUrl();
      if (existing) {
        if (existing.getAttribute('href') !== href) existing.setAttribute('href', href);
        return;
      }
      var link = document.createElement('link');
      link.id = FONTS_ID;
      link.rel = 'stylesheet';
      link.href = href;
      (document.head || document.getElementsByTagName('head')[0]).appendChild(link);
    } catch (e) {
      warn('fonts inject failed', e);
    }
  };

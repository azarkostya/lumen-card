  /* -------------------------------------------------------------------- */
  /* Чистые хелперы форматирования и ES5-коллекции.                        */
  /* Ни Lampa, ни jQuery, ни DOM модуль не трогает — он проверяется        */
  /* тестами (node --test) без браузера. Единственное исключение —         */
  /* screenPx() (Task 39): ширина экрана и devicePixelRatio берутся с      */
  /* window по вызову, внутри try/catch, поэтому загрузка модуля по-       */
  /* прежнему ничего снаружи не требует.                                   */
  /* -------------------------------------------------------------------- */

  LC.util = (function () {
    function esc(str) {
      if (str === null || typeof str === 'undefined') return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function pad2(n) {
      n = Math.floor(n);
      return n < 10 ? '0' + n : '' + n;
    }

    /* Русская/славянская плюрализация: [1, 2-4, 5+] */
    function plural(n, forms) {
      n = Math.abs(n) % 100;
      var tail = n % 10;
      if (n > 10 && n < 20) return forms[2];
      if (tail > 1 && tail < 5) return forms[1];
      if (tail === 1) return forms[0];
      return forms[2];
    }

    /* Имя -> инициалы (максимум 2 буквы) */
    function initials(name) {
      var clean = ('' + (name || '')).replace(/[^\S]+/g, ' ');
      clean = clean.replace(/^\s+|\s+$/g, '');
      if (!clean) return '?';
      var parts = clean.split(' ');
      var out = '';
      for (var i = 0; i < parts.length && out.length < 2; i++) {
        if (parts[i]) out += parts[i].charAt(0).toUpperCase();
      }
      return out || '?';
    }

    /* Секунды -> "01:12" (часы:минуты), если часов нет — "18:40" (минуты:секунды) */
    function fmtTime(sec) {
      sec = Math.max(0, Math.round(Number(sec) || 0));
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      if (h > 0) return pad2(h) + ':' + pad2(m);
      return pad2(m) + ':' + pad2(s);
    }

    /* Минуты -> "2:46" (часы) или "48 <unit>". Единица измерения — параметром,
       чтобы модуль не зависел от Lang/перевода. */
    function fmtRuntime(minutes, unit) {
      minutes = Math.max(0, Math.round(Number(minutes) || 0));
      if (!minutes) return '';
      var h = Math.floor(minutes / 60);
      var m = minutes % 60;
      if (h > 0) return h + ':' + pad2(m);
      return m + ' ' + unit;
    }

    /* Task 5c: календарная разница в днях от локальной даты now до 'YYYY-MM-DD'
       (air_date TMDB). Строку не разбираем через new Date(str) — тот считает её
       полночью UTC, и вечером западнее Гринвича дата съезжает на день. Обе даты
       сводятся к Date.UTC по календарным полям, поэтому ни час, ни переход на
       летнее время на результат не влияют. now — Date или мс (по умолчанию
       текущий момент). Пусто/мусор/несуществующий месяц -> null. */
    function daysUntil(ymd, now) {
      var m = /^(\d{4})-(\d{2})-(\d{2})/.exec('' + (ymd || ''));
      if (!m) return null;
      var month = parseInt(m[2], 10);
      var day = parseInt(m[3], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      var d = now instanceof Date ? now : new Date(typeof now === 'number' ? now : Date.now());
      var today = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
      var target = Date.UTC(parseInt(m[1], 10), month - 1, day);
      return Math.round((target - today) / 86400000);
    }

    /* ------------------------------------------------------------------ */
    /* Task 39: выбор размера картинки TMDB.                               */
    /* ------------------------------------------------------------------ */

    /* Допуск апскейла для порогов, где ступень выбирает не резкость, а
       ПАМЯТЬ: frameSize и scrimSize ниже. Размер берётся, если закрывает не
       меньше 0.85 нужной ширины, то есть растягивается не больше чем в 1.18
       раза.

       Task 68: у постеров теперь свой допуск (FIT_POSTER ниже), и прежнее
       «одно число на все картинки» (Task 39, п.1) снято сознательно. Двумя
       числами здесь названы два разных ВОПРОСА, а не разная заметность
       одного и того же растяжения. У frameSize следующая ступень после
       w1280 — original, а у кадров TMDB это обычно 3840×2160, то есть
       31.6 МБ распакованного растра против 3.7 у w1280: там допуск решает,
       платить ли памятью. У постера следующая ступень после w185 — w342,
       то есть 0.70 МБ против 0.21: там допуск решает, показывать ли
       растянутую картинку.
       Оговорка, чтобы «единый допуск» никого больше не вводил в
       заблуждение: stillSize (src/85_header.js), logoSizeFor
       (src/48_hero.js) и bannerSize (src/46_hub.js) от этой константы не
       зависели и раньше — у каждого своя копия 0.85 и свой потолок. */
    var FIT = 0.85;

    /* devicePixelRatio с потолком 2. Потолок нужен, потому что выше TMDB
       всё равно нечего предложить сверх original, а лишний апскейл стоит
       памяти. Мусор и отсутствие свойства считаются за 1. */
    function dprCapped() {
      var dpr = 1;
      try {
        dpr = Number(window.devicePixelRatio) || 1;
      } catch (e) {
        dpr = 1;
      }
      if (!(dpr > 0)) dpr = 1;
      return dpr > 2 ? 2 : dpr;
    }

    /* Эффективная ширина экрана в ФИЗИЧЕСКИХ пикселях. Android TV WebView
       отдаёт CSS-ширину, которая на части моделей вдвое меньше физической
       (960 при DPR 2), а на других равна ей (1920 при DPR 1) — размер
       картинки надо выбирать по произведению.

       Берём innerWidth, а не screen.width (как это делал собственный расчёт
       заставки до Task 39): screen.width — ширина устройства, и в окне
       браузера на большом мониторе она завышает результат вдвое-втрое.
       innerWidth — ровно та ширина, от которой Lampa считает свой базовый
       кегль (см. baseEm), а значит и все размеры наших элементов; две мерки
       от одного числа не расходятся. */
    function screenPx() {
      var w = 0;
      try {
        w = Number(window.innerWidth) || 0;
      } catch (e) { }
      return Math.round(w * dprCapped());
    }

    /* Множители кегля из настройки Lampa «Размер интерфейса». Таблица —
       копия sz из app.min.js:31630-31634 (функция size()); незнакомое или
       пустое значение считается за 'normal'. */
    var LAMPA_SIZES = { normal: 1, small: 0.9, bigger: 1.05 };

    /* Текущий множитель. Отдан наружу (lampaSizeK), потому что от него
       зависят не только замеры картинок здесь, но и пороги раскладки в
       таблице стилей: em Lampa = innerWidth / 84.17 × k, значит «экран
       шириной 84.17em» верно только при k = 1, а на «крупнее» экран —
       80.16em (ревью волны A, важное 1). Второй копии таблицы заводить
       нельзя: разойдись эти две — и порог включался бы не там, где модель
       его считает. */
    /* Storage.field, а не LC.pref: interface_size — настройка САМОЙ Lampa,
       её пункт и дефолт ('normal') регистрирует Lampa
       (vendor/lampa/app.min.js:47705-47709), а field отдаёт значение с этим
       дефолтом (Params.field — Storage.get(name, defaults[name] + ''),
       app.min.js:47697-47699). В LC.prefs.LIST такого ключа нет, и дефолт
       для LC.pref пришлось бы дублировать. */
    function lampaSize() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
          var size = Lampa.Storage.field('interface_size');
          if (LAMPA_SIZES[size]) return size;
        }
      } catch (e) { }
      return 'normal';
    }

    function lampaSizeK() {
      return LAMPA_SIZES[lampaSize()];
    }

    /* ВТОРОЙ множитель того же «Размера интерфейса», и он бьёт только по
       КАРТОЧКЕ: vendor/lampa/css/app.css:3525-3528 —
       @media screen and (min-width:767px){body.size--bigger .card{font-size:1.14em}}.
       То есть на «крупнее» внутри .card em стоит 1.05 × 1.14 = 1.197 против
       обычного, а снаружи карточки — только 1.05. У 'small' и 'normal' таких
       правил в app.css нет вовсе (поиск по size--small/size--normal), поэтому
       в таблице одна строка.
       Порог 767 px — ШИРИНА ОКНА в CSS-пикселях, а не физический растр: на
       целевом телевизоре окно 960 px, то есть правило там действует (живая
       проверка фикс-раунда волны A на стенде 960×540@2: кегль .card
       13.6524 px при кегле body 11.9758).
       Ради этого множителя функция и заведена: без него порог узкой колонки
       (rowNarrowRatio, src/30_css.js) считал блок ряда на 14 % короче
       фактического — это и есть те ~13 px, которых ревью волны A не смогло
       объяснить одним лишь lampaSizeK. */
    var LAMPA_CARD_SIZES = { bigger: 1.14 };

    function lampaCardK() {
      return LAMPA_CARD_SIZES[lampaSize()] || 1;
    }

    /* Кегль <body> в CSS-пикселях — база всех em в вёрстке плагина.
       Формула ровно та же, которой его ставит сама Lampa (app.min.js:
       31629-31639): Math.max(innerWidth / 84.17 * sz[interface_size], 10.6).
       До находки ревью Task 39 (п.3) здесь стоял голый innerWidth / 84.17, и
       при «Размер интерфейса: крупнее» все расчётные ширины выходили на 5 %
       меньше фактических.

       Читаем настройку, а не getComputedStyle(body): размер картинки
       спрашивают в том числе на остановке фокуса главной, а чтение
       вычисленного стиля там — принудительный пересчёт раскладки, который
       Task 37 с горячего пути как раз убрал. Storage.field у Lampa отдаёт
       значение из своего кэша в памяти и раскладку не трогает. */
    function baseEm() {
      var w = 0;
      try {
        w = Number(window.innerWidth) || 0;
      } catch (e) { }
      var px = w / 84.17 * lampaSizeK();
      return px > 10.6 ? px : 10.6;
    }

    /* Масштаб интерфейса ПЛАГИНА (настройка lumen_scale): его таблица стилей
       вешает font-size на свои корни (SCALE_ROOTS в src/30_css.js), и внутри
       них em стоит дороже. Модуль стилей отдаёт множитель как LC.uiScale;
       если его нет (тесты грузят 10_util.js в одиночку) — единица. */
    function uiScale() {
      try {
        if (typeof LC.uiScale === 'function') return Number(LC.uiScale()) || 1;
      } catch (e) { }
      return 1;
    }

    /* Ширина в ФИЗИЧЕСКИХ пикселях у элемента, которому таблица стилей
       задала ширину в `em`. Три множителя: кегль body (baseEm — в нём уже
       сидит «Размер интерфейса» Lampa), масштаб интерфейса плагина и DPR.

       Второй аргумент задаёт масштаб явно и нужен ровно одному месту —
       логотипу героя, до которого lumen_scale не доходит (см. src/48_hero.js,
       LOGO_EM). Везде остальном его опускают, и берётся текущий. */
    function emPx(em, scale) {
      var s = typeof scale === 'number' ? scale : uiScale();
      if (!(s > 0)) s = 1;
      return Math.round(baseEm() * (Number(em) || 0) * s * dprCapped());
    }

    /* Task 68: ширина экрана в em ТОГО КОРНЯ, на котором стоит масштаб
       интерфейса плагина (SCALE_ROOTS в src/30_css.js) — то есть в тех же
       единицах, в которых написаны ширины хаба и сетки подборки и которые
       ждёт emPx. Величина, обратная к emPx: emPx(emScreen()) даёт screenPx()
       с точностью до округления.

       Не путать с приватной screenEm() в src/30_css.js: та отвечает на
       другой вопрос — сколько БАЗОВЫХ em Lampa в экране (84.17 / k), — и
       масштаба плагина не знает намеренно, потому что пороги раскладки
       пишутся в медиазапросах, где em считается от кегля body, а не от
       нашего корня. Здесь же вдобавок работает пол кегля 10.6 px (см.
       baseEm): на окне 960 px при «мельче» он поднимает кегль с 10.264 до
       10.6, и экран содержит 90.57 базовых em вместо 93.52 — долг,
       зафиксированный в docs/plans/2026-09-22-lumen-final.md, здесь закрыт
       тем, что число берётся из baseEm, а не из литерала 84.17. */
    function emScreen() {
      var w = 0;
      try {
        w = Number(window.innerWidth) || 0;
      } catch (e) { }
      var one = baseEm() * uiScale();
      return one > 0 ? w / one : 0;
    }

    /* Ширина экрана в БАЗОВЫХ em Lampa — без масштаба плагина. Это число
       нужно порогам раскладки в src/30_css.js (screenEm): медиазапросы
       считают em от кегля body, а не от нашего корня. Источник тот же, что
       у emScreen, — baseEm() с полом кегля 10.6 px, — второй формулы нет.
       Долг раздела D docs/plans/2026-09-22-lumen-final.md: таблица стилей
       считала экран как 84.17 / k без пола, и на «мельче» при окне 960 px
       брала 93.52 em вместо фактических 90.57 (+3.3 %).
       Окна нет (сборка таблицы вне браузера) — пол недостижим, и в экран
       входит 84.17 / k: ширина в этой формуле сокращается. Порог читается
       в момент сборки таблицы, как и DPR у narrowWindowPx (src/30_css.js):
       окно телевизора своей ширины не меняет. */
    function screenBaseEm() {
      var w = 0;
      try {
        w = Number(window.innerWidth) || 0;
      } catch (e) { }
      return w > 0 ? w / baseEm() : 84.17 / lampaSizeK();
    }

    /* Task 44: доля ВЫСОТЫ окна в физических пикселях — для элементов,
       размер которых задан в vh, а не в em. Такой сейчас один: барабан
       рулетки (.lumen-roulette__reel, src/30_css.js). Он обязан помещаться
       на экране целиком, а высота экрана — единственная мерка, на которую
       не влияют ни «Размер интерфейса» Lampa, ни масштаб интерфейса
       плагина; em обе умножают, и на «огромном» барабан уехал бы за нижнюю
       кромку. Множителей поэтому два, а не три: доля окна и DPR с тем же
       потолком 2, что у screenPx/emPx. */
    function vhPx(vh) {
      var h = 0;
      try {
        h = Number(window.innerHeight) || 0;
      } catch (e) { }
      return Math.round(h * (Number(vh) || 0) / 100 * dprCapped());
    }

    /* Лестница ширин постеров TMDB. original сюда не входит: это исходный
       файл (у постеров он в разы шире любой ступени), а самый крупный
       постер плагина — карточка сетки подборки: 12.36em, то есть 282
       физических пикселя на экране 1920 и 564 при DPR 2. */
    var POSTERS = [185, 342, 500, 780];

    /* Task 68: свой допуск апскейла для ПОСТЕРА — 0.9, то есть растяжение
       не больше чем в 1.111 раза (прежние общие 0.85 разрешали 1.176).
       Постер разглядывают в упор, и у него, в отличие от кадра героя и
       кадра серии, следующая ступень существует: там потолок стоит по
       памяти, и выше него у TMDB размера просто нет.

       Откуда 0.9, а не вкус. Замер 2026-09-22 на живом стенде — 960 CSS px
       при DPR 2 и 1920 при DPR 1, по 3 размера интерфейса Lampa × 4
       масштаба плагина, 24 клетки на каждое место:
       - прежний допуск давал растяжение ровно в одном месте — постер ряда
         франшизы (.lumen-fr-card, 7.90em, src/66_franchise.js). По клеткам
         он выходит 146-227 физических пикселей, и ширины 189-216 брались из
         w185: до 1.17 раза. Новый допуск уводит на w342 те две клетки, где
         растяжение было наибольшим (208 и 216 px, то есть 1.12 и 1.17), и
         оставляет не больше 1.086;
       - карточка сетки подборки (262-285 px) и барабан рулетки (310 px)
         попадают в w342 при обоих допусках — ни одна клетка не меняется;
       - постер карточки ряда главной плагин не выбирает вовсе: его ставит
         сама Lampa по своей настройке poster_size (разбор в src/44_rows.js),
         по умолчанию w300 на 194-244 физических пикселя, то есть всегда с
         уменьшением.
       Оставшиеся 1.086 терпим сознательно: собственное увеличение постера в
       фокусе у плагина того же порядка — 1.04 у .lumen-fr-card, 1.08 у
       .lumen-gcard, 1.10 у карточки ряда главной (src/30_css.js), — и
       гоняться за растяжением мельче того, которое экран и так показывает
       на каждом шаге фокуса, нечем оправдать.

       Туже (0.95 и нулевой допуск) не берём по цене, и цена посчитана, а не
       угадана. На экране 1920 CSS px при DPR 2 — не целевом, но живом
       (монитор удвоенной плотности) — карточка сетки подборки выходит 553
       физических пикселя. При 0.9 она остаётся на w500, как и сейчас, а при
       0.95 ушла бы на w780: 3.48 МБ распакованного растра вместо 1.43, при
       15 карточках на экране это 52 МБ против 21 — больше половины
       96-мегабайтного бюджета композитора ради растяжения в 1.11.

       Цена самой правки поэтому ограничена рядом франшизы: w185 (185×278) —
       0.20 МБ растра, w342 (342×513) — 0.67 МБ, а в ряд помещается до 9
       карточек (шаг 7.90 + 0.88 = 8.78em при ширине экрана 84.17em минус
       поля 2 × 3.51em). То есть не больше +4.2 МБ на карточке фильма с
       коллекцией и РОВНО НОЛЬ на главной, в хабе и в сетке — при бюджете
       композитора 96 МБ и полноэкранном слое 1080p в 8.29 МБ. */
    var FIT_POSTER = 0.9;

    /* Наименьший размер постера, покрывающий нужную ширину с допуском
       FIT_POSTER. Ширина неизвестна (0) — самый дешёвый размер. */
    function posterSize(px) {
      var need = (Number(px) || 0) * FIT_POSTER;
      for (var i = 0; i < POSTERS.length; i++) {
        if (POSTERS[i] >= need) return 'w' + POSTERS[i];
      }
      return 'w' + POSTERS[POSTERS.length - 1];
    }

    /* Размер кадра, который СМОТРЯТ: кадр героя на главной, кадр за текстом
       карточки, кадр заставки. Порог — растр выше 1080p. original у TMDB
       для кадров обычно 3840×2160: 31.6 МБ RGBA против 3.7 МБ у w1280
       (замер координатора 2026-09-21 на стенде 960×540@2). Картинка, не
       влезающая в бюджет декодера, декодируется синхронно внутри
       растеризации, тайл за тайлом (at-raster decode, GpuImageDecodeCache;
       docs/research/2026-09-21-webview-perf.md §1.4) — это и даёт чёрные
       полосы на кадре при листании на Philips 50PUS8057. На 1920 физических
       пикселей w1280 растягивается в полтора раза — осознанная плата.
       Допуск FIT прежний: original остаётся растру ВЫШЕ 1080p с тем же
       допуском, то есть от 2259 физических пикселей (2259 × 0.85 =
       1920.15). */
    function frameSize(px) {
      return (Number(px) || 0) * FIT > 1920 ? 'original' : 'w1280';
    }

    /* Размер кадра, которому положен потолок w1280 вместо original. Довод
       общий для всех, кто эту функцию зовёт: original полноэкранного кадра
       TMDB обычно 3840×2160 — это 31.6 МБ распакованного растра против 3.7
       у w1280, и на телевизоре с 2 ГБ памяти разница видна сразу (бэклог с
       ТВ, п. Б1). Тот же довод, что у потолка w300 у кадров серий
       (src/85_header.js, stillSize).
       Task 44: раньше это был размер кадра-ПОДЛОЖКИ (.lumen-roulette__bg
       лежал под содержимым на opacity .22). Подложки больше нет — кадр
       результата рулетки показывают целиком, — но потолок остаётся: он
       нужен не потому, что кадр приглушён, а потому, что original на этом
       железе не окупается. */
    function scrimSize(px) {
      return (Number(px) || 0) * FIT > 780 ? 'w1280' : 'w780';
    }

    function each(arr, fn) {
      if (!arr) return;
      for (var i = 0; i < arr.length; i++) fn(arr[i], i);
    }

    function map(arr, fn) {
      var out = [];
      if (!arr) return out;
      for (var i = 0; i < arr.length; i++) out.push(fn(arr[i], i));
      return out;
    }

    function filter(arr, fn) {
      var out = [];
      if (!arr) return out;
      for (var i = 0; i < arr.length; i++) {
        if (fn(arr[i], i)) out.push(arr[i]);
      }
      return out;
    }

    function find(arr, fn) {
      if (!arr) return null;
      for (var i = 0; i < arr.length; i++) {
        if (fn(arr[i], i)) return arr[i];
      }
      return null;
    }

    /* Сборщик N параллельных ответов с дедлайном: finish вызывается РОВНО
       один раз — либо когда tick() пришёл total раз (partial = false), либо
       когда истёк timeout и пришло не всё (partial = true). Поздние tick()
       после закрытия молчат, полный результат снимает таймер, cancel()
       запрещает finish навсегда (и снимает таймер).

       total <= 0 — finish(false) вызывается синхронно, таймер не ставится;
       timeout <= 0 — дедлайна нет, только счётчик ответов.

       cancel() возвращает true, если закрыл ещё открытый сборщик, и false,
       если finish уже прошёл (или сборщик был отменён раньше). Это позволяет
       вызывающему решить, отвечать ли самому: LC.sources так отдаёт свою
       фатальную ошибку {nokey} только пока подборка никому не ответила.

       Единственная в проекте механика «отдать то, что успело»: ею живут
       дедлайн подборки в LC.sources (FETCH_TIMEOUT) и персональные ряды
       главной в LC.personal (ROW_TIMEOUT). В обоих случаях дедлайн — это
       страховка от запроса, который не ответит ни ok, ни err: ждущий обязан
       получить ответ, иначе пачка рядов Lampa не завершится и главная
       перестанет достраиваться. setTimeout читается по вызову — тесты
       подменяют его своим планировщиком. */
    function gate(total, timeout, finish) {
      var left = total;
      var closed = false;
      var timer = null;

      function close(partial) {
        if (closed) return;
        closed = true;
        if (timer !== null) { clearTimeout(timer); timer = null; }
        finish(partial);
      }

      if (total > 0 && timeout > 0) {
        timer = setTimeout(function () { close(true); }, timeout);
      }
      if (total <= 0) close(false);

      return {
        tick: function () {
          if (closed) return;
          left--;
          if (left <= 0) close(false);
        },
        cancel: function () {
          if (closed) return false;
          closed = true;
          if (timer !== null) { clearTimeout(timer); timer = null; }
          return true;
        }
      };
    }

    /* Долг фазы 1, п.4 (docs/plans/2026-09-15-lumen-card.md:1123), правка
       2026-09-23: «наша карточка на экране» — ОДИН ответ на весь плагин.

       Правило. Lampa держит в DOM все активности истории (до maxsave) и
       помечает показанную классом activity--active: снимает его с прошлой и
       ставит на render() новой (vendor/lampa/app.min.js:46024-46026).
       Скрытая активность убрана прозрачностью, а не display
       (.activity{opacity:0}), поэтому ни offsetParent, ни размеры узла на
       вопрос не отвечают — только класс ближайшей .activity. Узел вне
       всякой активности (кадр главной, ещё не вставленный в экран) считается
       показанным: не нашли, кому он принадлежит, — не блокируем.

       До правки ответов было пять, по-разному записанных: глобальный
       селектор .activity--active в src/90_runtime.js и src/69_hud.js,
       LC.slideshow.isLayerForeground (трейлер, ряд серий, тик слайдшоу),
       его же копии isForeground в src/60_reviews.js и src/66_franchise.js,
       склеенные с проверкой «в документе», и отдельная запись на голом DOM
       в src/52_fx.js (archived). Теперь все они спрашивают onScreen, а
       селекторы собираются из ON_SCREEN_SEL — это то же правило, записанное
       для поиска: $(ON_SCREEN_SEL + ' .lumen-card') находит ровно те
       карточки в документе, для которых onScreen ответил бы «да».

       Чем onScreen НЕ является — это два других вопроса, у них свои
       ответы. «Узел ещё в документе» (LC.slideshow.isMounted): карточку,
       вытесненную из истории, Lampa выбрасывает из DOM, и там вопрос — не
       «на экране», а «существует ли». И LC.active (src/90_runtime.js) — не
       ответ про экран, а реестр ресурсов последней открытой карточки
       (слайдшоу, трейлер, данные): при уходе с неё вглубь он остаётся
       прежним, пока карточка жива в истории.

       Принимает и набор jQuery (или FakeEl тестов), и голый DOM-узел:
       closest у набора отдаёт набор (решают length и hasClass), у узла —
       элемент (решает classList). Ошибка чтения — «на экране», как было у
       всех пяти. */
    var ON_SCREEN = 'activity--active';

    function activityOnScreen(activity) {
      if (!activity) return true;
      if (typeof activity.length === 'number') {
        if (!activity.length) return true;
        return !!activity.hasClass(ON_SCREEN);
      }
      return !activity.classList || !!activity.classList.contains(ON_SCREEN);
    }

    function onScreen(node) {
      try {
        return activityOnScreen(node.closest('.activity'));
      } catch (e) {
        return true;
      }
    }

    /* Ревью «Волны 1», п.1: открыт ли плеер Lampa. Плеер — не активность:
       на 'start' он добавляет свой узел поверх в body (app.min.js:30624-30632)
       и поднимает is_opened (Player.opened, :31149), а класс
       activity--active остаётся у экрана под ним — onScreen этот случай не
       видит. Спрашивают смена кадров (src/51_slideshow.js), автотрейлер
       героя (src/48_hero.js) и заставка (src/54_ambient.js). Нет Lampa или
       ошибка чтения — «не открыт»: ничего не блокируем. */
    function playerOpen() {
      try {
        return !!(window.Lampa && Lampa.Player && typeof Lampa.Player.opened === 'function' && Lampa.Player.opened());
      } catch (e) {
        return false;
      }
    }

    /* Поверх экрана открыто то, что Lampa сама закрывает, возвращаясь к
       содержимому (Controller.toContent, app.min.js:46504-46542), — но не
       всё оттуда. Здесь: классы body settings--open (:10306),
       selectbox--open (:7084) и search--open (поиск из шапки, открывается
       поверх главной — :41514), узлы .modal (модальное окно, :32415) и
       .youtube-player (YouTube Lampa, :53323-53324); оба узла Lampa удаляет
       на закрытии (:32561, :53401). У toContent сверх этого: .player —
       плеер, его отвечает playerOpen; .search — узел того же поиска, что и
       search--open; .search-box — SearchInput; и снимает она
       body.ambience--enable («Расширения», SearchInput, поиск — под ним
       .wrap спрятан целиком). Последние два в набор не входят (ревью раунда
       хвостов, п.2): ambience--enable ставит и сам поиск, а набор
       сверяет с тем, что было открыто при запросе, трейлер меню карточки;
       их спрашивает только автотрейлер героя (homeHidden в
       src/48_hero.js). Читаем голый DOM: jQuery здесь не нужен.

       overlays() — ЧТО открыто: имена классов и селекторы узлов в порядке
       набора. Ревью раунда хвостов, п.1: трейлер из меню карточки сверяет
       его с тем, что было открыто при запросе (src/63_cardmenu.js,
       verdict), — из результатов поиска его просят под открытым поиском.
       overlayOpen() — открыто ли хоть что-то. Ошибка чтения — «ничего не
       открыто»: ничего не блокируем. */
    var OVERLAY_CLASSES = ['settings--open', 'selectbox--open', 'search--open'];
    var OVERLAY_NODES = ['.modal', '.youtube-player'];

    function overlays() {
      var out = [];
      var i;
      try {
        var list = document.body && document.body.classList;
        for (i = 0; list && i < OVERLAY_CLASSES.length; i++) {
          if (list.contains(OVERLAY_CLASSES[i])) out.push(OVERLAY_CLASSES[i]);
        }
        if (typeof document.querySelector !== 'function') return out;
        for (i = 0; i < OVERLAY_NODES.length; i++) {
          if (document.querySelector(OVERLAY_NODES[i])) out.push(OVERLAY_NODES[i]);
        }
      } catch (e) {
        return [];
      }
      return out;
    }

    function overlayOpen() {
      return overlays().length > 0;
    }

    return {
      ON_SCREEN_SEL: '.' + ON_SCREEN,
      onScreen: onScreen,
      playerOpen: playerOpen,
      overlays: overlays,
      overlayOpen: overlayOpen,
      activityOnScreen: activityOnScreen,
      esc: esc,
      pad2: pad2,
      plural: plural,
      initials: initials,
      fmtTime: fmtTime,
      fmtRuntime: fmtRuntime,
      daysUntil: daysUntil,
      screenPx: screenPx,
      lampaSizeK: lampaSizeK,
      lampaCardK: lampaCardK,
      baseEm: baseEm,
      emPx: emPx,
      emScreen: emScreen,
      screenBaseEm: screenBaseEm,
      vhPx: vhPx,
      posterSize: posterSize,
      frameSize: frameSize,
      scrimSize: scrimSize,
      each: each,
      map: map,
      filter: filter,
      find: find,
      gate: gate
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.util;

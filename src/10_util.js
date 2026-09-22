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

    /* Единый допуск апскейла для ВСЕХ картинок плагина: размер берётся,
       если закрывает не меньше 0.85 нужной ширины, то есть растягивается не
       больше чем в 1.18 раза. Порог один на постеры, кадры и логотипы —
       разные числа в разных функциях означали бы, что где-то мы считаем
       заметным то, что в соседней строке названо незаметным (находка ревью
       Task 39, п.1). */
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

    /* Наименьший размер постера, покрывающий нужную ширину с допуском FIT.
       Ширина неизвестна (0) — самый дешёвый размер. */
    function posterSize(px) {
      var need = (Number(px) || 0) * FIT;
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

    return {
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

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
      var k = 1;
      try {
        w = Number(window.innerWidth) || 0;
      } catch (e) { }
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
          var size = Lampa.Storage.field('interface_size');
          if (LAMPA_SIZES[size]) k = LAMPA_SIZES[size];
        }
      } catch (e2) { }
      var px = w / 84.17 * k;
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
       карточки, кадр заставки. Допуск тот же FIT, что у постеров: на 1920
       физических пикселей w1280 растягивается в полтора раза, и это ровно
       та «пиксельность», на которую пожаловался пользователь (фаза 4, цель
       «чистый 1080p без повторного растяжения растра»). Поэтому там
       original, а узкое окно (1366 и меньше) остаётся на w1280. */
    function frameSize(px) {
      return (Number(px) || 0) * FIT > 1280 ? 'original' : 'w1280';
    }

    /* Размер кадра-ПОДЛОЖКИ: он лежит под содержимым экрана с большой
       прозрачностью (.lumen-roulette__bg — opacity .22, src/30_css.js), его
       не рассматривают. Потолок w1280: original полноэкранного кадра TMDB
       бывает 3840 px — вдевятеро больше пикселей в памяти, — и платить их за
       картинку под четвертью прозрачности незачем. Тот же довод, что у
       потолка w300 у кадров серий (src/85_header.js, stillSize). */
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
      baseEm: baseEm,
      emPx: emPx,
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

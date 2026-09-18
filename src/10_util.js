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

    /* Эффективная ширина экрана в ФИЗИЧЕСКИХ пикселях. Android TV WebView
       отдаёт CSS-ширину, которая на части моделей вдвое меньше физической
       (960 при DPR 2), а на других равна ей (1920 при DPR 1) — размер
       картинки надо выбирать по произведению. Потолок 2: при DPR 3 и выше
       TMDB всё равно нечего предложить сверх original, а лишний апскейл
       стоит памяти.

       Берём innerWidth, а не screen.width (как это делал собственный расчёт
       заставки до Task 39): screen.width — ширина устройства, и в окне
       браузера на большом мониторе она завышает результат вдвое-втрое.
       innerWidth — ровно та ширина, по которой Lampa считает свой базовый
       кегль (innerWidth / 84.17), а значит и все размеры наших элементов;
       две мерки от одного числа не расходятся. */
    function screenPx() {
      var w = 0;
      try {
        w = Number(window.innerWidth) || 0;
        var dpr = Number(window.devicePixelRatio) || 1;
        if (!(dpr > 0)) dpr = 1;
        w = w * (dpr > 2 ? 2 : dpr);
      } catch (e) { }
      return Math.round(w);
    }

    /* Ширина в ФИЗИЧЕСКИХ пикселях у элемента, которому таблица стилей
       задала ширину в `em`. База em у Lampa — innerWidth / 84.17 (она сама
       ставит кегль на body, см. шапку src/30_css.js), поэтому элемент
       занимает em/84.17 ширины экрана, и в физических пикселях это та же
       доля от screenPx(). */
    function emPx(em) {
      return Math.round(screenPx() * (Number(em) || 0) / 84.17);
    }

    /* Лестница ширин постеров TMDB. original сюда не входит: это исходный
       файл (у постеров он в разы шире любой ступени), а самый крупный
       постер плагина — карточка сетки подборки: 12.36em, то есть 282
       физических пикселя на экране 1920 и 564 при DPR 2. */
    var POSTERS = [185, 342, 500, 780];

    /* Наименьший размер постера, покрывающий нужную ширину. Допуск 15%:
       размер берётся, если закрывает не меньше 0.85 требуемой ширины, то
       есть апскейл не больше чем в 1.18 раза — на постере такой не виден,
       а следующая ступень TMDB заметно дороже и по байтам, и по пикселям в
       памяти. Ширина неизвестна (0) — самый дешёвый размер. */
    function posterSize(px) {
      var need = (Number(px) || 0) * 0.85;
      for (var i = 0; i < POSTERS.length; i++) {
        if (POSTERS[i] >= need) return 'w' + POSTERS[i];
      }
      return 'w' + POSTERS[POSTERS.length - 1];
    }

    /* Размер полноэкранного кадра (backdrop). Порог — ширина Full HD:
       w1280, растянутый на 1920, это апскейл в полтора раза, которого на
       фотографии за текстом не видно, а original того же кадра бывает и
       3840 px — втрое по ширине, то есть в девять раз больше пикселей в
       памяти WebView. Шире Full HD (настоящие 2K/4K-панели) полуторный
       апскейл уже виден — там original. */
    function frameSize(px) {
      return (Number(px) || 0) > 1920 ? 'original' : 'w1280';
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
      emPx: emPx,
      posterSize: posterSize,
      frameSize: frameSize,
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

  /* -------------------------------------------------------------------- */
  /* LC.thumbs — анализ маленьких растров TMDB на canvas (волна «хвосты    */
  /* героя», п.C2 и п.D).                                                   */
  /*                                                                       */
  /* Жалобы пользователя: «Герой = карточка» (кадр героя «Мятежа» — арт    */
  /* постера из ряда под ним) и «Логотип не читается» (чёрный логотип      */
  /* «Семи самураев» на тёмном кадре).                                     */
  /*                                                                       */
  /* Что умеет модуль:                                                     */
  /*   compare(poster, frame, cb) — похож ли кадр на постер: миниатюры w92  */
  /*     обоих, цветовые гистограммы 4×4×4 и корреляция скользящего        */
  /*     шаблона постера по кадру (similar ниже). cb(true | false | null), */
  /*     null — сравнить нельзя (картинка не пришла, пиксели закрыты);     */
  /*   verdict(poster, frame) — известный ответ или undefined;             */
  /*   tone(path, cb) — тон логотипа: 'dark' | 'light' | 'none' (прочитать */
  /*     нельзя); toneOf(path) — известный тон или undefined.              */
  /*                                                                       */
  /* Цена и правила (жёсткое ограничение производительности волны):        */
  /*   - растры маленькие: w92 у TMDB (92 × 52 у кадра, 92 × 138 у         */
  /*     постера, 92 × N у логотипа), на canvas — 48 × 27, 30 × 32 и 64 × N; */
  /*   - сама работа с canvas — только в простое браузера                  */
  /*     (requestIdleCallback с потолком IDLE_MS), по ОДНОЙ задаче за        */
  /*     колбэк простоя; зовут модуль только после показа героя (не в      */
  /*     обработчике фокуса), а уход фокуса с показанной карточки снимает  */
  /*     идущие сравнения (src/48_hero.js, onFocus): во время листания      */
  /*     canvas не работает, выбор кадра доделывает потолок ожидания;       */
  /*   - всё посчитанное лежит в памяти: признаки растра по пути (LRU),     */
  /*     ответы по паре и тоны по пути — до конца сеанса; одна и та же      */
  /*     миниатюра в пути грузится один раз (склейка), отказ последнего     */
  /*     ждущего снимает её и в сети.                                       */
  /*                                                                       */
  /* CORS. Пиксели читаются только у картинки, загруженной с               */
  /* crossOrigin='anonymous' и с заголовком Access-Control-Allow-Origin в  */
  /* ответе: иначе canvas «испорчен», и getImageData бросает SecurityError.*/
  /* Адрес — через Lampa.TMDB.image, как у всех картинок плагина: прокси   */
  /* Lampa (imagetmdb.com) отдаёт ACAO: * (проверено 2026-09-25). Запасного */
  /* адреса нет (сомнительное полного ревью c644bfd): прямой image.tmdb.org */
  /* в обход прокси пользователя отдавал TMDB его IP, а где TMDB закрыт —  */
  /* ждал до LOAD_MS на каждую миниатюру; без прокси адрес и так прямой.    */
  /* Прокси без CORS даёт отказ каждой миниатюре — после FAIL_LIMIT подряд */
  /* модуль молчит до конца сеанса. Размер w92 выбран ещё и потому,         */
  /* что сама Lampa его не грузит (ряды — w200…w500, логотипы героя и       */
  /* карточки — w500/w780, все без CORS): тот же адрес в другом режиме      */
  /* CORS — это второй ресурс в кэше браузера и, без HTTP-кэша на ТВ,       */
  /* вторая загрузка. Своих адресов модуль с чужими не делит.               */
  /* -------------------------------------------------------------------- */

  LC.thumbs = (function () {

    var SIZE = 'w92';
    /* Растр кадра на canvas: 16:9, как сам кадр героя. */
    var FW = 48;
    var FH = 27;
    /* У постера сравнивается средняя часть по высоте — сверху и снизу у
       ключевого арта обычно надписи (название, слоган, титры). */
    var CROP = 0.7;
    /* Высоты шаблона постера в долях высоты кадра: ключевой арт в кадре
       16:9 бывает и во всю высоту, и мельче — слева или справа от надписи. */
    var SCALES = [1, 0.8, 0.64];
    /* Ширина растра постера для гистограммы. */
    var HIST_W = 30;
    /* Пороги «похож» (исследование hero2, выборка 48 фильмов; сверено на
       стенде 2026-09-25 на 72 фильмах главной): совпадение гистограмм
       ≥ HIST_SIM, или корреляция шаблона ≥ CORR_SIM, или обе ≥ BOTH_SIM. */
    var HIST_SIM = 0.7;
    var CORR_SIM = 0.75;
    var BOTH_SIM = 0.6;
    /* Логотип: растр шириной LOGO_W, высота — по пропорции, не больше
       LOGO_H_MAX. Непрозрачный пиксель — альфа от ALPHA_MIN. */
    var LOGO_W = 64;
    var LOGO_H_MAX = 64;
    var ALPHA_MIN = 128;
    /* Тёмный логотип — по светлоте L* (CIELAB, в долях единицы) его
       непрозрачных пикселей: медиана ниже DARK_MED или даже светлая
       четверть (75-й перцентиль) ниже DARK_P75. Замер стенда 2026-09-25
       (66 фильмов главной, логотипы w92): тёмные — «Семь самураев» ru
       (медиана .20), «Рокки Бальбоа» (0), «Муха» ru (.11), «Обитель зла» ru
       (.32 при светлой четверти .32 — тёмно-красный без бликов). Цветные
       логотипы с бликами остаются как есть: «Мстители: Финал» (.34 / .45),
       «Секретные войны» (.34 / .50), «Мятеж» (.41 / .42). Порог по
       относительной яркости (WCAG) здесь не годится: насыщенный синий
       «ROCKY V» у него темнее «Обители зла», хотя на тёмном кадре читается. */
    var DARK_MED = 0.25;
    var DARK_P75 = 0.35;
    var LOAD_MS = 8000;
    /* Потолок ожидания простоя: задача не ждёт дольше, даже если браузер
       всё это время занят. */
    var IDLE_MS = 120;
    /* Признаков растров в памяти: постер и до трёх кадров на показ героя —
       с запасом на возвраты. Растр в признаках — Uint8Array, около 3 КБ. */
    var KEEP = 60;
    /* Ответов по парам и тонов — таблица сбрасывается целиком, если
       разрослась: это кэш, а не знание. */
    var TABLE_MAX = 600;

    /* ------------------------------------------------------------------ */
    /* Чистые функции: массивы RGBA, без DOM.                              */
    /* ------------------------------------------------------------------ */

    function bytes(n) {
      return typeof Uint8Array === 'function' ? new Uint8Array(n) : new Array(n);
    }

    /* Яркость пикселей (0…255) — для корреляции. */
    function luma(data, n) {
      var out = bytes(n);
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        out[i] = Math.round(0.299 * data[j] + 0.587 * data[j + 1] + 0.114 * data[j + 2]);
      }
      return out;
    }

    /* Цветовая гистограмма 4×4×4 непрозрачных пикселей, в долях. */
    function histogram(data, n) {
      var h = [];
      var k;
      for (k = 0; k < 64; k++) h[k] = 0;
      var count = 0;
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        if (data[j + 3] < ALPHA_MIN) continue;
        h[((data[j] >> 6) << 4) | ((data[j + 1] >> 6) << 2) | (data[j + 2] >> 6)]++;
        count++;
      }
      if (count) for (k = 0; k < 64; k++) h[k] /= count;
      return h;
    }

    /* Совпадение гистограмм — сумма минимумов (1 — одинаковые). */
    function histMatch(a, b) {
      var s = 0;
      for (var k = 0; k < 64; k++) s += Math.min(a[k] || 0, b[k] || 0);
      return s;
    }

    /* Корреляция Пирсона шаблона t (tw × th, сумма st, дисперсия vt) с
       окном кадра f шириной fw в точке (x, y). */
    function corrAt(f, fw, t, tw, th, x, y, st, vt) {
      var n = tw * th;
      var sf = 0;
      var sff = 0;
      var sft = 0;
      for (var r = 0; r < th; r++) {
        var fo = (y + r) * fw + x;
        var to = r * tw;
        for (var c = 0; c < tw; c++) {
          var a = f[fo + c];
          sf += a;
          sff += a * a;
          sft += a * t[to + c];
        }
      }
      var vf = sff - sf * sf / n;
      if (vf <= 1e-6 || vt <= 1e-6) return 0;
      return (sft - sf * st / n) / Math.sqrt(vf * vt);
    }

    /* Лучшая корреляция шаблона {w, h, g} по всем положениям в кадре
       f (fw × fh); шаблон больше кадра — -1. */
    function bestCorr(f, fw, fh, tmpl) {
      if (!tmpl || tmpl.w > fw || tmpl.h > fh) return -1;
      var n = tmpl.w * tmpl.h;
      var st = 0;
      var stt = 0;
      for (var i = 0; i < n; i++) {
        st += tmpl.g[i];
        stt += tmpl.g[i] * tmpl.g[i];
      }
      var vt = stt - st * st / n;
      var best = -1;
      for (var y = 0; y + tmpl.h <= fh; y++) {
        for (var x = 0; x + tmpl.w <= fw; x++) {
          var v = corrAt(f, fw, tmpl.g, tmpl.w, tmpl.h, x, y, st, vt);
          if (v > best) best = v;
        }
      }
      return best;
    }

    function similar(hist, corr) {
      return hist >= HIST_SIM || corr >= CORR_SIM || (hist >= BOTH_SIM && corr >= BOTH_SIM);
    }

    /* Сравнение признаков постера {h, t:[шаблоны]} и кадра {w, h, g, hist}:
       {hist, corr, similar}. */
    function judge(poster, frame) {
      var hist = histMatch(poster.h, frame.hist);
      var corr = -1;
      for (var i = 0; i < poster.t.length; i++) {
        var c = bestCorr(frame.g, frame.w, frame.h, poster.t[i]);
        if (c > corr) corr = c;
      }
      return { hist: hist, corr: corr, similar: similar(hist, corr) };
    }

    function linear(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    /* Светлота L* (CIELAB) в долях единицы по относительной яркости y. */
    function lightness(y) {
      return y > 0.008856 ? (116 * Math.pow(y, 1 / 3) - 16) / 100 : 9.033 * y;
    }

    /* Светлота непрозрачных пикселей логотипа: {n, med, p75}. */
    function toneStats(data) {
      var ls = [];
      for (var j = 0; j < data.length; j += 4) {
        if (data[j + 3] < ALPHA_MIN) continue;
        ls.push(lightness(0.2126 * linear(data[j]) + 0.7152 * linear(data[j + 1]) + 0.0722 * linear(data[j + 2])));
      }
      ls.sort(function (a, b) { return a - b; });
      var n = ls.length;
      return { n: n, med: n ? ls[n >> 1] : 0, p75: n ? ls[Math.min(n - 1, Math.floor(n * 0.75))] : 0 };
    }

    function darkOf(stats) {
      return !!(stats && stats.n > 0 && (stats.med < DARK_MED || stats.p75 < DARK_P75));
    }

    /* ------------------------------------------------------------------ */
    /* Простой браузера: одна задача на колбэк.                            */
    /* ------------------------------------------------------------------ */

    var idleQueue = [];
    var idleArmed = false;

    function idle(fn) {
      idleQueue.push(fn);
      arm();
    }

    function arm() {
      if (idleArmed || !idleQueue.length) return;
      idleArmed = true;
      var run = function () {
        idleArmed = false;
        var fn = idleQueue.shift();
        try {
          if (fn) fn();
        } catch (e) {
          warn('thumbs: idle task failed', e);
        }
        arm();
      };
      try {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(run, { timeout: IDLE_MS });
          return;
        }
      } catch (e) { }
      setTimeout(run, 16);
    }

    /* ------------------------------------------------------------------ */
    /* Загрузка миниатюр: склейка, отмена, запасной адрес.                  */
    /* ------------------------------------------------------------------ */

    function urlOf(path) {
      try {
        var tmdb = window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function' ?
          function (u) { return Lampa.TMDB.image(u); } : null;
        var api = window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function' ?
          function (p, s) { return Lampa.Api.img(p, s); } : null;
        return LC.cardinfo.imageUrl(path, SIZE, tmdb, api);
      } catch (e) {
        return '';
      }
    }

    /* Картинки в пути: путь → {img, subs, timer}. */
    var flights = {};

    function unhook(fl) {
      if (fl.img) {
        fl.img.onload = null;
        fl.img.onerror = null;
      }
      if (fl.timer) {
        clearTimeout(fl.timer);
        fl.timer = null;
      }
    }

    function land(path, fl, img) {
      if (flights[path] !== fl) return;
      delete flights[path];
      unhook(fl);
      var subs = fl.subs;
      fl.subs = [];
      for (var i = 0; i < subs.length; i++) {
        try { subs[i](img); } catch (e) { warn('thumbs: callback failed', e); }
      }
    }

    function start(path, fl, url) {
      var img = new Image();
      fl.img = img;
      img.onload = function () { land(path, fl, img); };
      img.onerror = function () { land(path, fl, null); };
      fl.timer = setTimeout(function () {
        fl.timer = null;
        land(path, fl, img.complete && img.naturalWidth ? img : null);
      }, LOAD_MS);
      /* crossOrigin — ДО src: после присвоения адреса он на запрос уже не
         влияет, и пиксели остались бы закрытыми. decoding='async' не
         ставится — как у подкраски: декодированный кадр нужен drawImage
         сразу после onload. */
      img.crossOrigin = 'anonymous';
      img.src = url;
    }

    /* cb(img | null) — ровно один раз, если не отменено. Возвращает
       {cancel}: отказ последнего ждущего снимает загрузку и в сети. */
    function fetchImage(path, cb) {
      var fl = flights[path];
      if (!fl) {
        var url = urlOf(path);
        if (!url) {
          cb(null);
          return { cancel: function () { } };
        }
        fl = { img: null, subs: [], timer: null };
        flights[path] = fl;
        start(path, fl, url);
      }
      fl.subs.push(cb);
      return {
        cancel: function () {
          var i = fl.subs.indexOf(cb);
          if (i !== -1) fl.subs.splice(i, 1);
          if (fl.subs.length || flights[path] !== fl) return;
          delete flights[path];
          unhook(fl);
          try {
            if (fl.img && typeof fl.img.removeAttribute === 'function') fl.img.removeAttribute('src');
          } catch (e) { }
        }
      };
    }

    /* ------------------------------------------------------------------ */
    /* Признаки растров (canvas) и память.                                 */
    /* ------------------------------------------------------------------ */

    function context(w, h) {
      var canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      /* willReadFrequently — как у подкраски: без него Chrome пишет в
         консоль про readback с GPU-полотна. */
      return canvas.getContext('2d', { willReadFrequently: true });
    }

    function framePixels(img) {
      var ctx = context(FW, FH);
      ctx.drawImage(img, 0, 0, FW, FH);
      var data = ctx.getImageData(0, 0, FW, FH).data;
      return { w: FW, h: FH, g: luma(data, FW * FH), hist: histogram(data, FW * FH) };
    }

    function posterPixels(img) {
      var W = img.naturalWidth;
      var H = img.naturalHeight;
      var sy = H * (1 - CROP) / 2;
      var sh = H * CROP;
      var aspect = W / sh;
      var t = [];
      for (var i = 0; i < SCALES.length; i++) {
        var th = Math.round(FH * SCALES[i]);
        var tw = Math.round(th * aspect);
        if (tw < 2 || th < 2 || tw > FW) continue;
        var ctx = context(tw, th);
        ctx.drawImage(img, 0, sy, W, sh, 0, 0, tw, th);
        t.push({ w: tw, h: th, g: luma(ctx.getImageData(0, 0, tw, th).data, tw * th) });
      }
      var hh = Math.max(1, Math.round(HIST_W / aspect));
      var hc = context(HIST_W, hh);
      hc.drawImage(img, 0, sy, W, sh, 0, 0, HIST_W, hh);
      return { t: t, h: histogram(hc.getImageData(0, 0, HIST_W, hh).data, HIST_W * hh) };
    }

    function logoPixels(img) {
      var h = Math.max(1, Math.min(LOGO_H_MAX, Math.round(LOGO_W * img.naturalHeight / img.naturalWidth)));
      var ctx = context(LOGO_W, h);
      ctx.drawImage(img, 0, 0, LOGO_W, h);
      return toneStats(ctx.getImageData(0, 0, LOGO_W, h).data);
    }

    /* Признаки растров: 'poster:путь' / 'frame:путь' → признаки или false
       (прочитать нельзя). LRU на KEEP записей. */
    var feats = {};
    var featKeys = [];

    function featGet(key) {
      return Object.prototype.hasOwnProperty.call(feats, key) ? feats[key] : undefined;
    }

    function featPut(key, value) {
      if (!Object.prototype.hasOwnProperty.call(feats, key)) {
        featKeys.push(key);
        while (featKeys.length > KEEP) delete feats[featKeys.shift()];
      }
      feats[key] = value;
    }

    /* Признаки по картинке — внутри задачи простоя. Исключение (испорченный
       canvas — SecurityError, нет 2d-контекста) — false: этот растр в сеансе
       больше не читаем.
       Ревью H5: картинка не пришла — null, а не false. Это знание о сети, а
       не о картинке: в память (признаки, вердикт пары, тон) оно не ложится,
       и следующий вопрос грузит миниатюру снова. Прежде один сбой загрузки
       постера отключал проверку «кадр ≈ постер» для всех кадров фильма. */
    function extract(kind, img) {
      /* Картинка не пришла — отказ (счёт FAIL_LIMIT). Пришла без размеров
         (SVG-логотип без собственного размера) — прочитать нечего, но это
         не отказ сети или CORS. */
      if (!img) { score(false); return null; }
      if (!img.naturalWidth || !img.naturalHeight) return false;
      try {
        var out = kind === 'poster' ? posterPixels(img) : (kind === 'frame' ? framePixels(img) : logoPixels(img));
        score(true);
        return out;
      } catch (e) {
        warn('thumbs: pixels blocked', e);
        score(false);
        return false;
      }
    }

    var verdicts = {};
    var verdictCount = 0;
    var tones = {};
    var toneCount = 0;

    /* Отказы подряд. Прокси без CORS-заголовка (или сеть, где недоступен и
       запасной image.tmdb.org) отказывает КАЖДОЙ миниатюре, и каждый показ
       героя тратил бы на это две-три загрузки впустую. После FAIL_LIMIT
       отказов подряд модуль до конца сеанса не грузит ничего и отвечает
       «сравнить нельзя» / 'none' сразу — кадр и логотип тогда как без
       модуля. Любая удача счёт сбрасывает. */
    var FAIL_LIMIT = 6;
    var failRow = 0;

    function blocked() {
      return failRow >= FAIL_LIMIT;
    }

    function score(ok) {
      failRow = ok ? 0 : failRow + 1;
    }

    function remember(table, key, value) {
      if (table === verdicts) {
        if (verdictCount >= TABLE_MAX) { verdicts = {}; verdictCount = 0; table = verdicts; }
        if (!Object.prototype.hasOwnProperty.call(table, key)) verdictCount++;
      } else {
        if (toneCount >= TABLE_MAX) { tones = {}; toneCount = 0; table = tones; }
        if (!Object.prototype.hasOwnProperty.call(table, key)) toneCount++;
      }
      table[key] = value;
    }

    function verdict(poster, frame) {
      var key = poster + '|' + frame;
      return Object.prototype.hasOwnProperty.call(verdicts, key) ? verdicts[key] : undefined;
    }

    function toneOf(path) {
      return path && Object.prototype.hasOwnProperty.call(tones, path) ? tones[path] : undefined;
    }

    /* Признаки растра: из памяти — синхронно, иначе загрузка и разбор в
       простое. cb(признаки | false | null — не доехала). Возвращает {cancel}. */
    function need(kind, path, cb) {
      var key = kind + ':' + path;
      var got = featGet(key);
      if (got !== undefined) {
        cb(got);
        return { cancel: function () { } };
      }
      var live = true;
      var load = fetchImage(path, function (img) {
        if (!live) return;
        idle(function () {
          if (!live) return;
          var now = featGet(key);
          if (now === undefined) {
            now = extract(kind, img);
            if (now !== null) featPut(key, now);
          }
          cb(now);
        });
      });
      return {
        cancel: function () {
          if (!live) return;
          live = false;
          load.cancel();
        }
      };
    }

    /* Похож ли кадр на постер. cb(true | false | null) — ровно один раз,
       если не отменено; известный ответ — синхронно. Пара — одна задача:
       обе миниатюры едут вместе (постер обычно уже в памяти от прошлой
       пары этого показа), разбор каждой — своим колбэком простоя, а
       сравнение — сразу за последним. */
    function compare(poster, frame, cb) {
      var known = verdict(poster, frame);
      if (known !== undefined || blocked()) {
        /* Ревью раунда героя (d97cffc), п.1: у заблокированного модуля
           ответ «сравнить нельзя» ложится в память, как любой другой. Без
           этого verdict() оставался undefined, и выбор кадра героя
           (chooseFrame, src/48_hero.js) снова спрашивал ту же пару —
           синхронный ответ, тот же вопрос, и так до переполнения стека:
           кадр w1280 не грузился до перезапуска Lampa. */
        if (known === undefined) {
          known = null;
          remember(verdicts, poster + '|' + frame, known);
        }
        cb(known);
        return { cancel: function () { } };
      }
      var live = true;
      var pf;
      var ff;
      var jobs = [];
      /* Ревью H5: постер прочитать нельзя или он не доехал — ответ «сравнить
         нельзя» сразу, кадр пары не нужен (из памяти — даже не грузится,
         в пути — снимается). Вердикт с сетевым отказом (null) в память не
         ложится: следующий показ спросит снова. */
      function settle() {
        if (!live || pf === undefined || (pf && ff === undefined)) return;
        live = false;
        for (var i = 1; i < jobs.length; i++) jobs[i].cancel();
        var value = pf && ff ? judge(pf, ff).similar : null;
        if (pf !== null && ff !== null) remember(verdicts, poster + '|' + frame, value);
        cb(value);
      }
      jobs.push(need('poster', poster, function (got) { pf = got; settle(); }));
      if (live) jobs.push(need('frame', frame, function (got) { ff = got; settle(); }));
      return {
        cancel: function () {
          if (!live) return;
          live = false;
          for (var i = 0; i < jobs.length; i++) jobs[i].cancel();
        }
      };
    }

    /* Тон логотипа: 'dark' | 'light' | 'none'. cb — ровно один раз, если не
       отменено; известный — синхронно. */
    function tone(path, cb) {
      var known = toneOf(path);
      if (known !== undefined || blocked()) {
        cb(known === undefined ? 'none' : known);
        return { cancel: function () { } };
      }
      var live = true;
      var job = need('logo', path, function (stats) {
        if (!live) return;
        live = false;
        var value = stats ? (darkOf(stats) ? 'dark' : 'light') : 'none';
        /* Ревью H5: логотип не доехал (null) — 'none' только этому ответу. */
        if (stats !== null) remember(tones, path, value);
        cb(value);
      });
      return {
        cancel: function () {
          if (!live) return;
          live = false;
          job.cancel();
        }
      };
    }

    return {
      /* Чистые — наружу ради тестов. */
      luma: luma,
      histogram: histogram,
      histMatch: histMatch,
      bestCorr: bestCorr,
      similar: similar,
      judge: judge,
      toneStats: toneStats,
      darkOf: darkOf,
      /* Рантайм. */
      compare: compare,
      verdict: verdict,
      tone: tone,
      toneOf: toneOf,
      /* Для HUD и живой проверки: сколько миниатюр в пути. */
      stats: function () {
        var fly = 0;
        for (var k in flights) if (Object.prototype.hasOwnProperty.call(flights, k)) fly++;
        return { fly: fly, idle: idleQueue.length, feats: featKeys.length, blocked: blocked() };
      }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.thumbs;

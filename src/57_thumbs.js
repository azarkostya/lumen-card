  /* -------------------------------------------------------------------- */
  /* LC.thumbs — анализ маленьких растров TMDB на canvas (волна «хвосты    */
  /* героя», п.C2 и п.D).                                                   */
  /*                                                                       */
  /* Жалобы пользователя: «Герой = карточка» (кадр героя «Мятежа» — арт    */
  /* постера из ряда под ним) и «Логотип не читается» (чёрный логотип      */
  /* «Семи самураев» на тёмном кадре).                                     */
  /*                                                                       */
  /* Что умеет модуль:                                                     */
  /*   compare(poster, frame, cb[, urgent]) — «не чистый» ли кадр (похож  */
  /*     на постер или в серой зоне, E3; urgent — срочно, см. idle):       */
  /*     миниатюры w92 обоих, гистограммы 4×4×4 и                         */
  /*     совместная корреляция яркости и градиента полос постера по кадру  */
  /*     (judge ниже). cb(true | false | null), null — сравнить нельзя     */
  /*     (картинка не пришла, пиксели закрыты);                             */
  /*   verdict(poster, frame) — известный ответ или undefined;             */
  /*   scoreOf(poster, frame) — счёт пары (1 — порог «похож») или undefined; */
  /*   tone(path, cb) — тон логотипа: 'dark' | 'light' | 'solid' (нет    */
  /*     ни одного прозрачного пикселя — плашка, раунд C, C8) | 'none'     */
  /*     (прочитать нельзя); toneOf(path) — известный тон или undefined.   */
  /*                                                                       */
  /* Цена и правила (жёсткое ограничение производительности волны):        */
  /*   - растры маленькие: w92 у TMDB (92 × 52 у кадра, 92 × 138 у         */
  /*     постера, 92 × N у логотипа), на canvas — 48 × 27, 30 × 32 и 64 × N; */
  /*   - сама работа с canvas — только в простое браузера                  */
  /*     (requestIdleCallback с потолком IDLE_MS), по ОДНОЙ задаче за        */
  /*     колбэк простоя, а задача — шагами (шаблон постера, шаблон         */
  /*     сравнения), пока браузер даёт время (STEP_MS; раунд C, замер      */
  /*     длинных задач); зовут модуль только после показа героя (не в      */
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
  /* модуль молчит BLOCK_MS, затем проба (разбор у FAIL_LIMIT). Размер w92 */
  /* выбран ещё и потому, что сама Lampa его не грузит (ряды — w200…w500,  */
  /* логотипы героя и карточки — w500/w780, все без CORS): тот же адрес в  */
  /* другом режиме CORS — это второй ресурс в кэше браузера и, без         */
  /* HTTP-кэша на ТВ, вторая загрузка. Своих адресов модуль с чужими не    */
  /* делит.                                                                */
  /* -------------------------------------------------------------------- */

  LC.thumbs = (function () {

    var SIZE = 'w92';
    /* Растр кадра на canvas: 16:9, как сам кадр героя. */
    var FW = 48;
    var FH = 27;
    /* Гистограмма постера — по средней части высоты: сверху и снизу у
       ключевого арта обычно надписи (название, слоган, титры). */
    var CROP = 0.7;
    /* Исследование E3 (study.md, 40 фильмов русской главной, 317 пар
       «постер ряда — кандидат», разметка глазами, подбор/проверка по
       фильмам): шаблон только из середины постера не находит арт, который
       в кадре стоит своей верхней половиной («Побег из Шоушенка» — лица
       с верха постера) или мельче кадра («Мстители: Война бесконечности»).
       Шаблоны — полосы постера BANDS (доли высоты) в масштабах SCALES
       (высота шаблона в долях высоты кадра). */
    var BANDS = [[0.15, 0.85], [0, 0.5], [0.25, 0.75], [0.5, 1]];
    /* Масштабы .5 и .4 проверены и сняты (study.md, отбор на подборе):
       мелкий шаблон случайно совпадает с кадрами фильма, порог растёт, и
       полнота падает; цена — вдвое больше. */
    var SCALES = [1, 0.8, 0.64];
    /* Грубый шаг перебора положений и уточнение ±1 вокруг лучшего: в 2.7
       раза меньше умножений, чем полный перебор, качество на выборке то же.
       Сравнение пары на стенде при CPU ×10 — 24 мс (медиана, макс. 36),
       у прежнего правила — 6 мс. */
    var STEP = 2;
    /* Шаблон уже этого — не шаблон: корреляция по трём пикселям случайна. */
    var TMPL_MIN = 4;
    /* Ширина растра постера для гистограммы. */
    var HIST_W = 30;
    /* Светлый пиксель — самый яркий канал от LIGHT_MIN. Гистограмма 4×4×4
       у тёмных картинок почти целиком в одной чёрной корзине, и любой тёмный
       кадр «совпадал» с тёмным постером («Славные парни», «Брат», «Волк с
       Уолл-стрит» — 9 из 13 ложных «похож» на кадрах фильма у прежнего
       правила). Если у постера или кадра светлых пикселей меньше LIGHT_GATE,
       гистограммы сравниваются только по светлым. */
    var LIGHT_MIN = 40;
    var LIGHT_GATE = 0.7;
    /* Пороги (study.md): максимум у кадров ФИЛЬМА на подборе + 0.02
       (гистограмма .693 «Дэдпул и Росомаха» №5, корреляция .604 After
       Impact №3; «Звёздные войны: Эпизод 8» и «Побег из Шоушенка» — в
       проверке, на них порог не подбирался) —
       гистограмма ≥ HIST_SIM или совместная корреляция ≥ JOINT_SIM — «похож»
       (similar). Счёт пары — max(hist / HIST_SIM, joint / JOINT_SIM);
       кадр «чистый», если счёт ниже CLEAN: серую зону (тот же стиль
       кампании, «Звёздные войны: Эпизод 8») выбор кадра обходит, пока есть
       чистый кандидат. */
    var HIST_SIM = 0.71;
    var JOINT_SIM = 0.62;
    var CLEAN = 0.85;
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
    /* Отмена загрузки миниатюры — заменой адреса на пустой GIF (data:, в
       сеть не ходит), а не removeAttribute('src'): Chromium держит <img>,
       у которого адрес сняли во время или после загрузки, — отсоединённые
       картинки копились на перемещениях фокуса главной (стенд, 4 × 400
       шагов: узлы 3998 → 9359, 860 отсоединённых <img> с пустым src, все
       отсюда; опыт на 40 картинках: removeAttribute — удержаны 40,
       data:-GIF или без отмены — 0). Пустой src = '' не годится: старые
       движки шлют с ним запрос к адресу страницы. */
    var BLANK_SRC = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    /* Потолок ожидания простоя: задача не ждёт дольше, даже если браузер
       всё это время занят. */
    var IDLE_MS = 120;
    /* Раунд C (трейс листания после C4, CPU ×10, 20 фильмов главной): разбор
       постера (12 шаблонов) и сравнение пары (12 шаблонов) шли ОДНОЙ
       задачей простоя — 50–88 мс; нажатие пульта, пришедшее в это время,
       ждало её конца. Теперь задача идёт шагами — шаблон постера или
       шаблон сравнения за шаг (при CPU ×10 — единицы миллисекунд), — и
       колбэк простоя берёт следующий шаг, только пока у браузера остаётся
       не меньше STEP_MS (deadline.timeRemaining()) и сам колбэк идёт меньше
       SLICE_MS. Колбэк по потолку IDLE_MS (didTimeout: браузер всё это время
       занят) и запасной setTimeout без requestIdleCallback — тоже шагами до
       SLICE_MS: по одному шагу на такой колбэк сравнение показа растянулось
       бы на два десятка ожиданий простоя и не успевало к потолку героя
       (LOOK_WAIT, стенд — 2 срабатывания из 4 ожиданий за прогон).
       Недоделанная задача остаётся первой в очереди: другая задача её шагов
       не перебивает. */
    var STEP_MS = 5;
    var SLICE_MS = 30;
    /* Признаков растров в памяти: постер и до трёх кадров на показ героя —
       с запасом на возвраты. E3: признаки постера — 12 шаблонов (7439
       пикселей яркости Uint8Array и столько же градиентов Float32Array),
       около 37 КБ; кадра — около 6.5 КБ. */
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

    function lit(data, j) {
      return Math.max(data[j], data[j + 1], data[j + 2]) >= LIGHT_MIN;
    }

    /* Цветовая гистограмма 4×4×4 непрозрачных пикселей, в долях; light —
       только светлые пиксели (LIGHT_MIN). */
    function histogram(data, n, light) {
      var h = [];
      var k;
      for (k = 0; k < 64; k++) h[k] = 0;
      var count = 0;
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        if (data[j + 3] < ALPHA_MIN) continue;
        if (light && !lit(data, j)) continue;
        h[((data[j] >> 6) << 4) | ((data[j + 1] >> 6) << 2) | (data[j + 2] >> 6)]++;
        count++;
      }
      if (count) for (k = 0; k < 64; k++) h[k] /= count;
      return h;
    }

    /* Доля светлых среди непрозрачных пикселей. */
    function lightShare(data, n) {
      var all = 0;
      var on = 0;
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        if (data[j + 3] < ALPHA_MIN) continue;
        all++;
        if (lit(data, j)) on++;
      }
      return all ? on / all : 0;
    }

    function floats(n) {
      return typeof Float32Array === 'function' ? new Float32Array(n) : new Array(n);
    }

    /* Модуль градиента Собеля по растру яркости (края — повтором крайнего
       пикселя). Корреляция одной яркости на растрах 48 × 27 ловит общий
       световой рисунок («светлый верх, тёмный низ»), и кадр фильма с таким
       же рисунком получал 0.8–0.9; совпадение картинки видно по совпадению
       контуров в той же точке. */
    function sobel(g, w, h) {
      var out = floats(w * h);
      for (var y = 0; y < h; y++) {
        var y0 = y > 0 ? y - 1 : 0;
        var y1 = y < h - 1 ? y + 1 : h - 1;
        for (var x = 0; x < w; x++) {
          var x0 = x > 0 ? x - 1 : 0;
          var x1 = x < w - 1 ? x + 1 : w - 1;
          var a = g[y0 * w + x0], b = g[y0 * w + x], c = g[y0 * w + x1];
          var d = g[y * w + x0], f = g[y * w + x1];
          var p = g[y1 * w + x0], q = g[y1 * w + x], r = g[y1 * w + x1];
          var gx = (c + 2 * f + r) - (a + 2 * d + p);
          var gy = (p + 2 * q + r) - (a + 2 * b + c);
          out[y * w + x] = Math.sqrt(gx * gx + gy * gy);
        }
      }
      return out;
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

    /* Сумма и «дисперсия» (сумма квадратов отклонений) растра. */
    function stats(a, n) {
      var s = 0;
      var ss = 0;
      for (var i = 0; i < n; i++) {
        s += a[i];
        ss += a[i] * a[i];
      }
      return { s: s, v: ss - s * s / n };
    }

    function wide(n) {
      if (typeof Float64Array === 'function') return new Float64Array(n);
      var out = new Array(n);
      for (var i = 0; i < n; i++) out[i] = 0;
      return out;
    }

    /* Раунд C (трейс листания: corrAt — самая дорогая функция дорожки):
       суммы и суммы квадратов окна кадра — из интегральных изображений,
       а не заново на каждом положении шаблона; в цикле остаётся один
       перекрёстный член. Интеграл: s[(y)(w+1) + x] — сумма по строкам < y
       и столбцам < x; Float64 — суммы квадратов яркости до 8·10⁷, Float32
       их не держит точно. */
    function integral(a, w, h) {
      var W1 = w + 1;
      var s = wide(W1 * (h + 1));
      var q = wide(W1 * (h + 1));
      for (var y = 0; y < h; y++) {
        var rs = 0;
        var rq = 0;
        for (var x = 0; x < w; x++) {
          var v = a[y * w + x];
          rs += v;
          rq += v * v;
          s[(y + 1) * W1 + x + 1] = s[y * W1 + x + 1] + rs;
          q[(y + 1) * W1 + x + 1] = q[y * W1 + x + 1] + rq;
        }
      }
      return { s: s, q: q, W1: W1 };
    }

    /* Интегралы яркости и градиента кадра — один раз на пару (judgeSteps). */
    function frameSums(frame) {
      var fe = frame.e || (frame.e = sobel(frame.g, frame.w, frame.h));
      return { g: integral(frame.g, frame.w, frame.h), e: integral(fe, frame.w, frame.h) };
    }

    /* То же, что corrAt, с суммами окна из интеграла I. */
    function corrFast(f, fw, I, t, tw, th, x, y, st, vt) {
      var n = tw * th;
      var W1 = I.W1;
      var a = y * W1 + x;
      var b = a + tw;
      var c = (y + th) * W1 + x;
      var d = c + tw;
      var sf = I.s[d] - I.s[b] - I.s[c] + I.s[a];
      var sff = I.q[d] - I.q[b] - I.q[c] + I.q[a];
      var sft = 0;
      for (var r = 0; r < th; r++) {
        var fo = (y + r) * fw + x;
        var to = r * tw;
        for (var k = 0; k < tw; k++) sft += f[fo + k] * t[to + k];
      }
      var vf = sff - sf * sf / n;
      if (vf <= 1e-6 || vt <= 1e-6) return 0;
      return (sft - sf * st / n) / Math.sqrt(vf * vt);
    }

    /* Совместная корреляция шаблона {w, h, g[, e]} с кадром {w, h, g[, e]}:
       в КАЖДОЙ точке — среднее корреляций яркости и градиента, по всем
       точкам — максимум. Градиенты, если их нет в признаках (старые
       фикстуры тестов), считаются здесь. Шаблон больше кадра или уже
       TMPL_MIN — -1. */
    function bestJoint(frame, tmpl, sums) {
      if (!tmpl || tmpl.w > frame.w || tmpl.h > frame.h || tmpl.w < TMPL_MIN || tmpl.h < TMPL_MIN) return -1;
      var n = tmpl.w * tmpl.h;
      var te = tmpl.e || (tmpl.e = sobel(tmpl.g, tmpl.w, tmpl.h));
      var fe = frame.e || (frame.e = sobel(frame.g, frame.w, frame.h));
      var I = sums || frameSums(frame);
      var sg = stats(tmpl.g, n);
      var se = stats(te, n);
      var mx = frame.w - tmpl.w;
      var my = frame.h - tmpl.h;
      function at(x, y) {
        return (corrFast(frame.g, frame.w, I.g, tmpl.g, tmpl.w, tmpl.h, x, y, sg.s, sg.v) +
          corrFast(fe, frame.w, I.e, te, tmpl.w, tmpl.h, x, y, se.s, se.v)) / 2;
      }
      var best = -1;
      var bx = 0;
      var by = 0;
      var x, y, v;
      for (y = 0; y <= my; y += STEP) {
        for (x = 0; x <= mx; x += STEP) {
          v = at(x, y);
          if (v > best) { best = v; bx = x; by = y; }
        }
      }
      for (y = Math.max(0, by - 1); y <= Math.min(my, by + 1); y++) {
        for (x = Math.max(0, bx - 1); x <= Math.min(mx, bx + 1); x++) {
          v = at(x, y);
          if (v > best) best = v;
        }
      }
      return best;
    }

    /* «Похож»: гистограмма ≥ HIST_SIM или совместная корреляция ≥ JOINT_SIM. */
    function similar(hist, joint) {
      return hist >= HIST_SIM || joint >= JOINT_SIM;
    }

    /* Счёт пары: 1 — на пороге «похож», ниже CLEAN — «чистый» кадр. */
    function pairScore(hist, joint) {
      return Math.max(hist / HIST_SIM, joint / JOINT_SIM);
    }

    /* Гистограммы пары: полные, если у обеих картинок светлых пикселей не
       меньше LIGHT_GATE, иначе — только по светлым. Признаки без светлой
       гистограммы (старые фикстуры) — полные. */
    function histPair(poster, frame) {
      var dark = typeof poster.light === 'number' && typeof frame.light === 'number' &&
        Math.min(poster.light, frame.light) < LIGHT_GATE && poster.hl && frame.histL;
      return dark ? histMatch(poster.hl, frame.histL) : histMatch(poster.h, frame.hist);
    }

    /* Сравнение признаков постера {h, hl, light, t:[шаблоны]} и кадра
       {w, h, g, e, hist, histL, light}: {hist, corr (совместная), score,
       similar, clean}. */
    function judge(poster, frame) {
      var j = judgeSteps(poster, frame);
      while (j.step()) { }
      return j.result();
    }

    /* То же сравнение шагами: step() — гистограммы и первый шаблон, дальше
       по шаблону за шаг; true — шаги ещё есть. result() — ответ judge после
       последнего шага. */
    function judgeSteps(poster, frame) {
      var i = 0;
      var hist = 0;
      var corr = -1;
      var out = null;
      var sums = null;
      return {
        step: function () {
          if (i === 0) hist = histPair(poster, frame);
          if (i < poster.t.length) {
            if (!sums) sums = frameSums(frame);
            var c = bestJoint(frame, poster.t[i], sums);
            if (c > corr) corr = c;
          }
          i++;
          if (i < poster.t.length) return true;
          var s = pairScore(hist, corr);
          out = { hist: hist, corr: corr, score: s, similar: similar(hist, corr), clean: s < CLEAN };
          return false;
        },
        result: function () { return out; }
      };
    }

    function linear(v) {
      v /= 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    /* Светлота L* (CIELAB) в долях единицы по относительной яркости y. */
    function lightness(y) {
      return y > 0.008856 ? (116 * Math.pow(y, 1 / 3) - 16) / 100 : 9.033 * y;
    }

    /* Светлота непрозрачных пикселей логотипа: {n, all, med, p75}; all —
       все пиксели растра. */
    function toneStats(data) {
      var ls = [];
      for (var j = 0; j < data.length; j += 4) {
        if (data[j + 3] < ALPHA_MIN) continue;
        ls.push(lightness(0.2126 * linear(data[j]) + 0.7152 * linear(data[j + 1]) + 0.0722 * linear(data[j + 2])));
      }
      ls.sort(function (a, b) { return a - b; });
      var n = ls.length;
      return { n: n, all: data.length >> 2, med: n ? ls[n >> 1] : 0, p75: n ? ls[Math.min(n - 1, Math.floor(n * 0.75))] : 0 };
    }

    /* Раунд C, C8 (study.md, «After Impact» 1751701): логотип без единого
       прозрачного пикселя — не надпись, а картинка-плашка (PNG без альфы:
       тёмный текст на сером прямоугольнике). Тёмным его силуэт белил весь
       прямоугольник — на месте названия вставала белая плашка. Такой логотип
       не рисуется вовсе: название — текстом (src/48_hero.js). */
    function solidOf(stats) {
      return !!(stats && stats.n > 0 && stats.n >= stats.all);
    }

    function darkOf(stats) {
      return !!(stats && stats.n > 0 && (stats.med < DARK_MED || stats.p75 < DARK_P75));
    }

    /* ------------------------------------------------------------------ */
    /* Простой браузера: одна задача на колбэк, задача — шагами.           */
    /* ------------------------------------------------------------------ */

    /* Задача — функция шага: true — шаги ещё есть (задача остаётся первой
       в очереди), иначе она снята.
       Срочная задача (urgent) — сравнение кадра карточки, которую герой
       показывает прямо сейчас (chooseFrame, src/48_hero.js): её ждёт
       потолок LOOK_WAIT (300 мс), а при занятом браузере простой приходит
       раз в IDLE_MS, и сравнение шагами за такие колбэки не успевало (стенд,
       CPU ×10: ожиданий героя 3–8 и срабатываний потолка 0–3 за 20 фильмов
       против 0 и 0 у сравнения одной задачей). Срочная встаёт в очередь
       перед обычными (среди срочных — по порядку) и идёт не в простое, а
       ближайшим setTimeout — теми же кусками не дольше SLICE_MS: между
       кусками браузер берёт ввод и кадр. Обычная задача, начатая раньше,
       прерывается на границе шага и доделывается после. */
    var idleQueue = [];
    var idleArmed = false;
    var urgentArmed = false;

    function idle(fn, urgent) {
      if (urgent) {
        fn.urgent = true;
        var at = 0;
        while (at < idleQueue.length && idleQueue[at].urgent) at++;
        idleQueue.splice(at, 0, fn);
      } else {
        idleQueue.push(fn);
      }
      arm();
    }

    /* Хватит ли колбэку, начатому в started, времени ещё на шаг (разбор — у
       STEP_MS и SLICE_MS). */
    function roomFor(deadline, started) {
      if (Date.now() - started >= SLICE_MS) return false;
      try {
        if (!deadline || typeof deadline.timeRemaining !== 'function') return true;
        return !!deadline.didTimeout || deadline.timeRemaining() >= STEP_MS;
      } catch (e) {
        return false;
      }
    }

    /* Шаги первой задачи очереди, пока есть время (roomFor) и пока её не
       потеснила срочная. Кончившаяся снимается — где бы она ни стояла. */
    function run(deadline) {
      var started = Date.now();
      var fn = idleQueue[0];
      var more = false;
      do {
        try {
          more = !!(fn && fn() === true);
        } catch (e) {
          warn('thumbs: idle task failed', e);
          more = false;
        }
      } while (more && idleQueue[0] === fn && roomFor(deadline, started));
      if (!more) {
        var at = idleQueue.indexOf(fn);
        if (at !== -1) idleQueue.splice(at, 1);
      }
      arm();
    }

    function arm() {
      if (!idleQueue.length) return;
      if (idleQueue[0].urgent) {
        if (urgentArmed) return;
        urgentArmed = true;
        setTimeout(function () {
          urgentArmed = false;
          run(null);
        }, 0);
        return;
      }
      if (idleArmed) return;
      idleArmed = true;
      var fire = function (deadline) {
        idleArmed = false;
        run(deadline);
      };
      try {
        if (typeof window.requestIdleCallback === 'function') {
          window.requestIdleCallback(fire, { timeout: IDLE_MS });
          return;
        }
      } catch (e) { }
      setTimeout(fire, 16);
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

    function start(path, fl, url, urgent) {
      var img = new Image();
      fl.img = img;
      /* Этап 2а: миниатюра срочного сравнения (кадр карточки под фокусом —
         показ или дорожка кадра) — высокий приоритет загрузки: на стенде
         (сеть +200 мс) миниатюра карточки под фокусом в 3–5 КБ ехала до
         полусекунды за логотипами и постерами окна. Свойство — Chrome 101+,
         старее — просто поле. */
      if (urgent) img.fetchPriority = 'high';
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
    function fetchImage(path, cb, urgent) {
      var fl = flights[path];
      if (!fl) {
        var url = urlOf(path);
        if (!url) {
          cb(null);
          return { cancel: function () { } };
        }
        fl = { img: null, subs: [], timer: null };
        flights[path] = fl;
        start(path, fl, url, urgent);
      }
      fl.subs.push(cb);
      return {
        cancel: function () {
          var i = fl.subs.indexOf(cb);
          if (i !== -1) fl.subs.splice(i, 1);
          if (fl.subs.length || flights[path] !== fl) return;
          delete flights[path];
          /* Обработчики — до замены адреса: onload/onerror пустого GIF
             не должны прийти результатом. */
          unhook(fl);
          try {
            if (fl.img) fl.img.src = BLANK_SRC;
          } catch (e) { }
        }
      };
    }

    /* ------------------------------------------------------------------ */
    /* Признаки растров (canvas) и память.                                 */
    /* ------------------------------------------------------------------ */

    /* Раунд C (тот же трейс и ревью rv4): новый <canvas> с контекстом на
       каждый шаблон — 13 холстов на постер — стоил половину разбора постера
       (песочница rv4, CPU ×10: 27.5 мс против 13.5 с одним холстом) и
       полную сборку мусора 110–156 мс от брошенных холстов. Холст один на
       модуль, CANVAS_SIZE в квадрате, и размер его не меняется (смена
       width/height — новое выделение растра): растр рисуется в левый
       верхний угол и читается getImageData по тому же прямоугольнику,
       перед рисованием он очищается (у логотипа прозрачность). Растры
       модуля — до 48 × 27 (кадр, шаблоны), 30 × 32 (гистограмма постера) и
       64 × 64 (логотип); больший — холст растёт один раз. */
    var CANVAS_SIZE = 64;
    var scratch = null;

    function context(w, h) {
      if (!scratch) {
        var canvas = document.createElement('canvas');
        canvas.width = CANVAS_SIZE;
        canvas.height = CANVAS_SIZE;
        /* willReadFrequently — как у подкраски: без него Chrome пишет в
           консоль про readback с GPU-полотна. Нет контекста — исключение у
           вызывающего (растр не прочитан), и следующий раз — новая попытка. */
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        scratch = { canvas: canvas, ctx: ctx };
      }
      if (w > scratch.canvas.width || h > scratch.canvas.height) {
        scratch.canvas.width = Math.max(w, scratch.canvas.width);
        scratch.canvas.height = Math.max(h, scratch.canvas.height);
      }
      if (typeof scratch.ctx.clearRect === 'function') scratch.ctx.clearRect(0, 0, w, h);
      return scratch.ctx;
    }

    function framePixels(img) {
      var ctx = context(FW, FH);
      ctx.drawImage(img, 0, 0, FW, FH);
      var data = ctx.getImageData(0, 0, FW, FH).data;
      var n = FW * FH;
      var g = luma(data, n);
      return { w: FW, h: FH, g: g, e: sobel(g, FW, FH), hist: histogram(data, n), histL: histogram(data, n, true), light: lightShare(data, n) };
    }

    /* Шаблоны постера: каждая полоса BANDS в каждом масштабе SCALES (высота
       шаблона — доля высоты кадра FH, ширина — по пропорции полосы). */
    function posterPixels(img) {
      var plan = posterPlan(img);
      for (var i = 0; i < plan.steps.length; i++) plan.steps[i]();
      return plan.out;
    }

    /* Шаблон полосы — шаг разбора постера (фабрика: var в цикле ES5 своей
       области не создаёт). */
    function templateStep(img, out, sy, sh, tw, th) {
      return function () {
        var ctx = context(tw, th);
        ctx.drawImage(img, 0, sy, img.naturalWidth, sh, 0, 0, tw, th);
        var g = luma(ctx.getImageData(0, 0, tw, th).data, tw * th);
        out.t.push({ w: tw, h: th, g: g, e: sobel(g, tw, th) });
      };
    }

    /* Разбор постера по шагам: {steps: [шаг шаблона…, шаг гистограммы],
       out — признаки, готовые после последнего шага}. */
    function posterPlan(img) {
      var W = img.naturalWidth;
      var H = img.naturalHeight;
      var out = { t: [], h: null, hl: null, light: 0 };
      var steps = [];
      for (var b = 0; b < BANDS.length; b++) {
        var by = H * BANDS[b][0];
        var bh = H * (BANDS[b][1] - BANDS[b][0]);
        for (var i = 0; i < SCALES.length; i++) {
          var th = Math.round(FH * SCALES[i]);
          var tw = Math.round(th * W / bh);
          if (tw < TMPL_MIN || th < TMPL_MIN || tw > FW) continue;
          steps.push(templateStep(img, out, by, bh, tw, th));
        }
      }
      steps.push(function () {
        var sy = H * (1 - CROP) / 2;
        var sh = H * CROP;
        var hh = Math.max(1, Math.round(HIST_W * sh / W));
        var hc = context(HIST_W, hh);
        hc.drawImage(img, 0, sy, W, sh, 0, 0, HIST_W, hh);
        var data = hc.getImageData(0, 0, HIST_W, hh).data;
        var n = HIST_W * hh;
        out.h = histogram(data, n);
        out.hl = histogram(data, n, true);
        out.light = lightShare(data, n);
      });
      return { steps: steps, out: out };
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
    /* Раунд C: разбор — шагами (постер — по шаблону, кадр и логотип —
       одним шагом). {step() → true, пока шаги есть; value — признаки,
       false или null после последнего}; step null — ответ уже в value. */
    function extractor(kind, img) {
      var job = { step: null, value: undefined };
      /* Картинка не пришла — отказ (счёт FAIL_LIMIT). Пришла без размеров
         (SVG-логотип без собственного размера) — прочитать нечего, но это
         не отказ сети или CORS. */
      if (!img) { score(false); job.value = null; return job; }
      if (!img.naturalWidth || !img.naturalHeight) { job.value = false; return job; }
      var plan = null;
      var at = 0;
      job.step = function () {
        try {
          if (kind === 'poster') {
            if (!plan) plan = posterPlan(img);
            plan.steps[at++]();
            if (at < plan.steps.length) return true;
            job.value = plan.out;
          } else {
            job.value = kind === 'frame' ? framePixels(img) : logoPixels(img);
          }
          score(true);
        } catch (e) {
          warn('thumbs: pixels blocked', e);
          score(false);
          job.value = false;
        }
        return false;
      };
      return job;
    }

    var verdicts = {};
    var verdictCount = 0;
    var tones = {};
    var toneCount = 0;

    /* Отказы подряд. Прокси без CORS-заголовка (или сеть, где недоступен и
       запасной image.tmdb.org) отказывает КАЖДОЙ миниатюре, и каждый показ
       героя тратил бы на это две-три загрузки впустую. После FAIL_LIMIT
       отказов подряд модуль BLOCK_MS не грузит ничего и отвечает
       «сравнить нельзя» / 'none' сразу — кадр и логотип тогда как без
       модуля. Любая удача счёт сбрасывает.
       Проверка оркестровки простоя, O3: блок был до конца сеанса, а сброс
       счёта — только удачей, которой без загрузок взяться неоткуда; отказ
       сети (onerror, таймаут LOAD_MS) считается тем же счётом, и обрыв
       Wi-Fi или прокси на минуту выключал сравнение «кадр ≈ постер» и тон
       логотипа до перезапуска Lampa. Не считать сетевые отказы нельзя:
       миниатюра с crossOrigin от прокси без заголовка ACAO — тот же
       onerror, что и обрыв сети. Поэтому блок — на срок: вышел —
       проба (счёт на единицу ниже порога), удача сбрасывает счёт, отказ
       снова блокирует на BLOCK_MS; прокси без CORS стоит одной-двух
       загрузок в минуту. Ответы «сравнить нельзя», запомненные за время
       блока (compare ниже), с пробой забываются — пару спросят заново. */
    var FAIL_LIMIT = 6;
    var BLOCK_MS = 60000;
    var failRow = 0;
    var blockedAt = 0;
    var blockNulls = [];

    function blocked() {
      if (failRow < FAIL_LIMIT) return false;
      if (Date.now() - blockedAt < BLOCK_MS) return true;
      failRow = FAIL_LIMIT - 1;
      for (var i = 0; i < blockNulls.length; i++) {
        var key = blockNulls[i];
        if (Object.prototype.hasOwnProperty.call(verdicts, key) && verdicts[key] === null) {
          delete verdicts[key];
          verdictCount--;
        }
      }
      blockNulls = [];
      return false;
    }

    function score(ok) {
      if (ok) {
        failRow = 0;
        return;
      }
      failRow++;
      if (failRow === FAIL_LIMIT) blockedAt = Date.now();
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

    /* Счёт пары (score) — для выбора наименее похожего кадра, когда чистых
       нет (pickFrame в src/48_hero.js). Та же таблица-кэш, что у вердиктов. */
    var scores = {};
    var scoreCount = 0;

    function keepScore(key, s) {
      if (scoreCount >= TABLE_MAX) { scores = {}; scoreCount = 0; }
      if (!Object.prototype.hasOwnProperty.call(scores, key)) scoreCount++;
      scores[key] = s;
    }

    function scoreOf(poster, frame) {
      var key = poster + '|' + frame;
      return Object.prototype.hasOwnProperty.call(scores, key) ? scores[key] : undefined;
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
    function need(kind, path, cb, urgent) {
      var key = kind + ':' + path;
      var got = featGet(key);
      if (got !== undefined) {
        cb(got);
        return { cancel: function () { } };
      }
      var live = true;
      var load = fetchImage(path, function (img) {
        if (!live) return;
        var job = null;
        idle(function () {
          if (!live) return false;
          var now = featGet(key);
          if (now === undefined) {
            if (!job) job = extractor(kind, img);
            if (job.step && job.step()) return true;
            now = job.value;
            if (now !== null) featPut(key, now);
          }
          cb(now);
          return false;
        }, urgent);
      }, urgent);
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
       пары этого показа), разбор каждой — своей задачей простоя, и
       сравнение — тоже своей, шагами (раунд C).
       Раунд «без лагов», этап 2а: та же пара в пути — второй вопрос
       встаёт на неё, а не заводит второе сравнение. Кадр карточки под
       фокусом решает заранее дорожка кадра (src/58_prefetch.js, через 250
       мс покоя фокуса), и показ героя (chooseFrame, src/48_hero.js) через
       DELAY спрашивает ту же пару, пока её ответ ещё едет: без склейки
       это второй разбор той же пары (24 мс при CPU ×10) и два ответа в
       памяти вразнобой. Ответ один на всех ждущих; отмена снимает только
       своего ждущего, последний — и само сравнение (миниатюры в сети
       тоже). Срочный вопрос на обычное сравнение в пути не встаёт: у того
       задачи в очереди простоя, а срочному нужна очередь setTimeout (idle
       ниже) — он заводит своё. */
    var pairFlights = {};

    function compare(poster, frame, cb, urgent) {
      var key = poster + '|' + frame;
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
          remember(verdicts, key, known);
          if (blockNulls.length < TABLE_MAX) blockNulls.push(key);
        }
        cb(known);
        return { cancel: function () { } };
      }
      var sub = { cb: cb };
      var fl = pairFlights[key];
      if (fl && (fl.urgent || !urgent)) {
        fl.subs.push(sub);
      } else {
        fl = { subs: [sub], urgent: !!urgent, handle: null, over: false };
        pairFlights[key] = fl;
        var own = fl;
        var handle = judgePair(poster, frame, urgent, function (value) {
          own.over = true;
          if (pairFlights[key] === own) delete pairFlights[key];
          var subs = own.subs;
          own.subs = [];
          for (var i = 0; i < subs.length; i++) {
            var fn = subs[i].cb;
            subs[i].cb = null;
            if (!fn) continue;
            try { fn(value); } catch (e) { warn('thumbs: callback failed', e); }
          }
        });
        if (!fl.over) fl.handle = handle;
      }
      var pair = fl;
      return {
        cancel: function () {
          if (!sub.cb) return;
          sub.cb = null;
          var at = pair.subs.indexOf(sub);
          if (at !== -1) pair.subs.splice(at, 1);
          if (pair.subs.length || pair.over) return;
          pair.over = true;
          if (pairFlights[key] === pair) delete pairFlights[key];
          if (pair.handle) pair.handle.cancel();
        }
      };
    }

    /* Этап 2а: признаки миниатюры заранее, без вопроса о паре. Дорожка
       кадра (src/58_prefetch.js) решает кадр карточки под фокусом, и на
       стенде (сеть +200 мс, CPU ×10) цепочка «детали → миниатюры пары →
       разбор → вторая пара, если первая похожа, → её миниатюра» — это
       четыре-пять обходов сети подряд. Постер карточки известен сразу (он
       в данных ряда) — его миниатюра едет вместе с деталями; кандидаты —
       все сразу, как пришли детали: следующая пара ждёт только разбора.
       kind — 'poster' | 'frame'. Возвращает {cancel}. */
    function prime(kind, path, urgent) {
      if (!path || (kind !== 'poster' && kind !== 'frame') || blocked()) return { cancel: function () { } };
      return need(kind, path, function () { }, urgent);
    }

    /* Само сравнение пары (разбор ниже): cb(true | false | null) — один
       раз, если не отменено. */
    function judgePair(poster, frame, urgent, cb) {
      var live = true;
      var pf;
      var ff;
      var jobs = [];
      /* Ревью H5: постер прочитать нельзя или он не доехал — ответ «сравнить
         нельзя» сразу, кадр пары не нужен (из памяти — даже не грузится,
         в пути — снимается). Вердикт с сетевым отказом (null) в память не
         ложится: следующий показ спросит снова. */
      var judging = false;
      function settle() {
        if (!live || judging || pf === undefined || (pf && ff === undefined)) return;
        for (var i = 1; i < jobs.length; i++) jobs[i].cancel();
        if (!(pf && ff)) {
          finish(null);
          return;
        }
        judging = true;
        var steps = judgeSteps(pf, ff);
        idle(function () {
          if (!live) return false;
          if (steps.step()) return true;
          finish(steps.result());
          return false;
        }, urgent);
      }
      /* Вердикт пары — «не чистый» (счёт от CLEAN): выбор кадра обходит и
         похожие, и серую зону; счёт — отдельно, для выбора наименее
         похожего. */
      function finish(j) {
        live = false;
        var value = j ? !j.clean : null;
        if (pf !== null && ff !== null) {
          remember(verdicts, poster + '|' + frame, value);
          if (j) keepScore(poster + '|' + frame, j.score);
        }
        cb(value);
      }
      jobs.push(need('poster', poster, function (got) { pf = got; settle(); }, urgent));
      if (live) jobs.push(need('frame', frame, function (got) { ff = got; settle(); }, urgent));
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
        var value = stats ? (solidOf(stats) ? 'solid' : (darkOf(stats) ? 'dark' : 'light')) : 'none';
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
      score: pairScore,
      sobel: sobel,
      lightShare: lightShare,
      bestJoint: bestJoint,
      judge: judge,
      judgeSteps: judgeSteps,
      integral: integral,
      corrFast: corrFast,
      STEP_MS: STEP_MS,
      SLICE_MS: SLICE_MS,
      BLOCK_MS: BLOCK_MS,
      /* Для стенда и тестов: признаки растров так же, как их считает рантайм. */
      posterPixels: posterPixels,
      framePixels: framePixels,
      HIST_SIM: HIST_SIM,
      JOINT_SIM: JOINT_SIM,
      CLEAN: CLEAN,
      toneStats: toneStats,
      darkOf: darkOf,
      solidOf: solidOf,
      /* Рантайм. */
      compare: compare,
      prime: prime,
      verdict: verdict,
      scoreOf: scoreOf,
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

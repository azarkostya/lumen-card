  /* -------------------------------------------------------------------- */
  /* Task 24 (фаза 3): акцент интерфейса от постера фильма.                */
  /*                                                                       */
  /* LC.color — чистая математика цвета (HSL, контраст WCAG, доминанта     */
  /* постера, подбор читаемой четвёрки токенов) плюс единственная          */
  /* браузерная функция fromImage: постер уменьшается до 16×16 на canvas,  */
  /* и цвет считается по 256 пикселям, а не по оригиналу.                  */
  /*                                                                       */
  /* LC.accent — применение: пока открыта карточка, её цвет ПЕРЕОПРЕДЕЛЯЕТ */
  /* акцент из настроек. Переопределение читает theme() в src/30_css.js,   */
  /* поэтому применение — это обычная пересборка таблицы стилей            */
  /* (LC.injectCss), та же, что при смене акцента руками; отдельного слоя  */
  /* правил и CSS-переменных акцента не заводится.                         */
  /*                                                                       */
  /* Проверено живьём в Lampa 3.3.4 (2026-09-17, tab с localhost:8766):    */
  /*  - image.tmdb.org отдаёт Access-Control-Allow-Origin: * , картинка с  */
  /*    crossOrigin = 'anonymous' грузится, и getImageData на canvas с ней */
  /*    НЕ бросает SecurityError — пиксели постера доступны;               */
  /*  - drawImage(16×16) + getImageData = 2.8 мс, загрузка w185 из кэша    */
  /*    5 мс, пересборка и переразбор 81 КБ CSS — 3.4–4.2 мс (десктоп).    */
  /* Ветка «пиксели закрыты» всё равно написана и протестирована: у        */
  /* пользователя может стоять свой TMDB-прокси (Lampa.TMDB.image уважает  */
  /* настройку), и он вправе отдавать картинки без CORS-заголовка. Тогда   */
  /* акцент остаётся тем, что выбран в настройках.                         */
  /* -------------------------------------------------------------------- */

  LC.color = (function () {

    /* Порог читаемости WCAG 2.1 для крупного текста и элементов интерфейса.
       Тот же, по которому в test/css.test.mjs проверены девять акцентов
       настроек: авто-акцент не имеет права быть хуже выбранного руками. */
    var MIN_RATIO = 4.5;

    /* Целевой контраст: восемь из девяти акцентов настроек держат 7:1 (замеры
       в шапке ACCENTS, src/30_css.js), и авто-акцент целится туда же — иначе
       цвет фильма читался бы заметно хуже выбранного руками. Порог 7 —
       предпочтение, а не требование: если к пределу светлоты его взять не
       удалось, годится первый цвет с 4.5:1. */
    var GOOD_RATIO = 7;

    /* Рамка акцента (план фазы 3, Task 24 Step 1): насыщенность 0.45–0.85,
       светлота от 0.55. Верх рамки 0.72 — стартовый, а не жёсткий: холодные
       оттенки (синий, фиолетовый) при той же светлоте заметно темнее тёплых,
       и на почти чёрном фоне карточки синий с l = 0.55 даёт всего ~2.5:1.
       Поэтому светлота поднимается шагами, пока не станет читаемо, но не
       выше L_LIMIT — дальше цвет вырождается в белёсый. */
    var S_MIN = 0.45;
    var S_MAX = 0.85;
    var L_MIN = 0.55;
    var L_MAX = 0.72;
    var L_LIMIT = 0.92;
    var L_STEP = 0.03;

    /* Сторона квадрата, до которого ужимается постер. 16×16 = 256 пикселей:
       достаточно, чтобы преобладающий цвет плаката не потерялся, и в сотни
       раз дешевле обхода оригинала (w185 — это 51 430 пикселей). */
    var SAMPLE = 16;

    /* Подкраска фона (tint). Насыщенность подмешиваемого тона режется до
       TINT_S, а его доля в фоне не превышает TINT_MIX: фон обязан остаться
       тёмной комнатой с отсветом плаката, а не стать цветной панелью,
       которая спорит с акцентом кнопок. TINT_STEPS — сколько раз доля
       уменьшается, прежде чем вернуть чистый фон темы. */
    var TINT_S = 0.28;
    var TINT_MIX = 0.55;
    var TINT_STEPS = 6;
    /* Насколько подмешиваемый тон светлее фона темы. Без этого подъёма
       подкраски не видно вовсе: фон тёплой темы — #0B0908, его светлота
       0.037, у чёрной темы — ноль, и тон той же светлоты на глаз от фона не
       отличается. Значение выбрано по замерам на четырёх доминантах (тёплая,
       зелёная, синяя, розовая) в обеих темах: при 0.06 фон уходил в #0F1614
       — различимо только рядом с эталоном, при 0.12 даёт #1E1D1B…#251B16, то
       есть видимый отсвет плаката, оставаясь тёмной комнатой. Плата —
       контраст самой слабой подписи (P.muted) 6.0–6.4:1 на тёплой теме и
       7.6–7.8:1 на чёрной против 7.24 и 8.3 без подкраски; порог 4.5:1 с
       запасом держится, и проверка ниже всё равно обязательна. */
    var TINT_LIFT = 0.12;

    /* Кэш «адрес постера -> цвет»: один расчёт на фильм за сеанс. Хранится
       в памяти (не в Storage): цвет считается за миллисекунды, а место в
       localStorage нужнее кэшу отзывов. Вытеснение — FIFO по списку ключей,
       как в кэше отзывов (src/60_reviews.js), только без индекса: терять
       тут нечего, запись восстанавливается одним расчётом. */
    var CACHE_LIMIT = 50;
    var cache = {};
    var cache_keys = [];
    var pending_count = 0;
    var request_count = 0;

    function clamp(v, lo, hi) {
      if (v < lo) return lo;
      if (v > hi) return hi;
      return v;
    }

    function normHue(h) {
      h = Number(h) || 0;
      h = h % 360;
      return h < 0 ? h + 360 : h;
    }

    function parseHex(hex) {
      var s = ('' + hex).replace('#', '');
      return {
        r: parseInt(s.substring(0, 2), 16),
        g: parseInt(s.substring(2, 4), 16),
        b: parseInt(s.substring(4, 6), 16)
      };
    }

    function byte(v) {
      v = Math.round(v);
      if (v < 0) v = 0;
      if (v > 255) v = 255;
      var s = v.toString(16).toUpperCase();
      return s.length < 2 ? '0' + s : s;
    }

    function hex(rgb) {
      return '#' + byte(rgb.r) + byte(rgb.g) + byte(rgb.b);
    }

    /* Строку принимаем везде, где принимаем цвет: токены плагина хранятся
       hex-строками, пиксели — тройками. */
    function toRgb(c) {
      if (!c) return { r: 0, g: 0, b: 0 };
      if (typeof c === 'string') return parseHex(c);
      return c;
    }

    function rgbToHsl(rgb) {
      var r = rgb.r / 255, g = rgb.g / 255, b = rgb.b / 255;
      var max = Math.max(r, g, b), min = Math.min(r, g, b);
      var d = max - min;
      var l = (max + min) / 2;
      var h = 0, s = 0;
      if (d) {
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return { h: h, s: s, l: l };
    }

    function hue2rgb(p, q, t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }

    function hslToRgb(hsl) {
      var h = normHue(hsl.h) / 360;
      var s = clamp(Number(hsl.s) || 0, 0, 1);
      var l = clamp(Number(hsl.l) || 0, 0, 1);
      var r, g, b;
      if (!s) {
        r = g = b = l;
      } else {
        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1 / 3);
      }
      return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }

    /* Относительная яркость и контраст — формулы WCAG 2.1. Единственная
       реализация в плагине: и проверка авто-акцента, и тесты считают одним
       и тем же кодом. */
    function chan(v) {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    }

    function luminance(c) {
      var rgb = toRgb(c);
      return 0.2126 * chan(rgb.r) + 0.7152 * chan(rgb.g) + 0.0722 * chan(rgb.b);
    }

    function contrast(a, b) {
      var l1 = luminance(a);
      var l2 = luminance(b);
      var hi = Math.max(l1, l2);
      var lo = Math.min(l1, l2);
      return (hi + 0.05) / (lo + 0.05);
    }

    /* Пиксели, которые о фильме ничего не говорят: прозрачные, почти чёрные
       (рамка и тени плаката), почти белые (титры, засветы) и почти серые
       (у них нет оттенка, а нам нужен именно он). */
    function usable(r, g, b, a) {
      if (a < 128) return false;
      var max = Math.max(r, g, b);
      var min = Math.min(r, g, b);
      if (max < 45) return false;
      if (min > 225) return false;
      return max - min >= 26;
    }

    /* Доминанта: годные пиксели раскладываются по двенадцати корзинам
       оттенка (по 30°), вес корзины — сумма насыщенностей. Побеждает самая
       весомая корзина, её пиксели усредняются. Простое среднее по всем
       цветным пикселям тут не годится: оранжевый плакат с синей полосой дал
       бы грязно-серый, а на постере обычно есть один «свой» цвет.
       pixels — RGBA-поток canvas (getImageData().data) или обычный массив. */
    function dominant(pixels) {
      if (!pixels || !pixels.length) return null;
      var bins = [];
      var i;
      for (i = 0; i < 12; i++) bins.push({ w: 0, r: 0, g: 0, b: 0, n: 0 });
      for (i = 0; i + 3 < pixels.length; i += 4) {
        var r = pixels[i], g = pixels[i + 1], b = pixels[i + 2], a = pixels[i + 3];
        if (!usable(r, g, b, a)) continue;
        var hsl = rgbToHsl({ r: r, g: g, b: b });
        var bin = bins[Math.floor(normHue(hsl.h) / 30) % 12];
        bin.w += hsl.s;
        bin.r += r;
        bin.g += g;
        bin.b += b;
        bin.n++;
      }
      var best = null;
      for (i = 0; i < bins.length; i++) {
        if (bins[i].n && (!best || bins[i].w > best.w)) best = bins[i];
      }
      if (!best) return null;
      return {
        r: Math.round(best.r / best.n),
        g: Math.round(best.g / best.n),
        b: Math.round(best.b / best.n)
      };
    }

    /* Текст на заливке акцентом: тот же оттенок, но почти чёрный —
       ровно так устроены onac у девяти акцентов настроек (#1A120A у песка).
       Насыщенность вдвое меньше акцента, чтобы тон не отдавал цветной
       грязью на крупных подписях кнопок. */
    function onAccent(hsl) {
      return { h: normHue(hsl.h), s: clamp(hsl.s * 0.5, 0.12, 0.6), l: 0.07 };
    }

    /* Кольцо фокуса: тот же оттенок, почти белый — как light у акцентов
       настроек (#FFF2DC у песка). */
    function ringOf(hsl) {
      return { h: normHue(hsl.h), s: clamp(hsl.s * 0.85, 0.3, 0.9), l: 0.93 };
    }

    function glow(rgb) {
      return 'rgba(' + Math.round(rgb.r) + ',' + Math.round(rgb.g) + ',' + Math.round(rgb.b) + ',0.35)';
    }

    /* Линейное смешивание двух цветов в sRGB: ratio — доля второго. Для
       подкраски фона этого достаточно: оба цвета почти одинаковой светлоты
       (см. tint ниже), а на таких парах разница между sRGB и линейным
       пространством меньше одного кванта байта. */
    function mixRgb(a, b, ratio) {
      var k = clamp(ratio, 0, 1);
      return {
        r: Math.round(a.r + (b.r - a.r) * k),
        g: Math.round(a.g + (b.g - a.g) * k),
        b: Math.round(a.b + (b.b - a.b) * k)
      };
    }

    /* Правка пользователя 2026-09-17 (третий круг): «фон хочется чтобы был
       больше прозрачного, а фон определялся от картинки».

       Фон страницы, окрашенный доминантой постера. Берётся ОТТЕНОК плаката,
       насыщенность режется до TINT_S (иначе фон становится цветной панелью,
       а не тёмной комнатой с отсветом), светлота — светлота базового фона
       темы плюс маленький подъём TINT_LIFT, и только потом получившийся тон
       подмешивается к базовому.

       Гарантия читаемости всё равно проверяется явно: guard — самый слабый
       текст на этом фоне (подпись года под постером, P.muted), ratio — порог
       для него. Не проходит — доля тона уменьшается шагами, и в пределе
       возвращается чистый фон темы, а не цвет похуже.

       null — красить нечем (нет доминанты или фон нечитаем). */
    function tint(rgb, bg, guard, ratio, maxMix) {
      if (!rgb) return null;
      var base = toRgb(bg);
      if (!base) return null;
      var src = rgbToHsl(rgb);
      var baseHsl = rgbToHsl(base);
      var toned = hslToRgb({ h: src.h, s: Math.min(src.s, TINT_S), l: clamp(baseHsl.l + TINT_LIFT, 0, 1) });
      var mix = typeof maxMix === 'number' ? maxMix : TINT_MIX;
      var limit = typeof ratio === 'number' ? ratio : MIN_RATIO;
      for (var i = 0; i < TINT_STEPS; i++) {
        var out = mixRgb(base, toned, mix);
        if (!guard || contrast(guard, out) >= limit) return hex(out);
        mix *= 0.6;
      }
      return hex(base);
    }

    /* Приводит цвет постера к рамке акцента и поднимает светлоту, пока не
       выполнятся ОБА условия читаемости: акцент на фоне страницы (он служит
       текстом — метка «КИНОПОИСК», статус героя) и тёмный текст на заливке
       акцентом (подписи кнопок в фокусе). Не вышло к L_LIMIT — null, и
       вызывающая сторона остаётся на акценте из настроек. */
    function adjust(hsl, bg) {
      var h = normHue(hsl.h);
      var s = clamp(hsl.s, S_MIN, S_MAX);
      var start = clamp(hsl.l, L_MIN, L_MAX);
      var bgRgb = toRgb(bg);

      /* Два прохода по светлоте: сначала ищем цвет, который держит целевые
         7:1, и только если такого нет — довольствуемся порогом 4.5:1. */
      function search(ratio) {
        var l = start;
        while (l <= L_LIMIT + 0.0001) {
          var cand = { h: h, s: s, l: l };
          var rgb = hslToRgb(cand);
          if (contrast(rgb, bgRgb) >= ratio &&
            contrast(hslToRgb(onAccent(cand)), rgb) >= ratio) return cand;
          l += L_STEP;
        }
        return null;
      }

      return search(GOOD_RATIO) || search(MIN_RATIO);
    }

    /* Четвёрка токенов того же вида, что у акцентов настроек (ACCENTS в
       src/30_css.js): цвет, кольцо фокуса, свечение и текст на акценте. */
    function tokens(rgb, bg) {
      if (!rgb) return null;
      var hsl = adjust(rgbToHsl(rgb), bg);
      if (!hsl) return null;
      var accent = hslToRgb(hsl);
      return {
        color: hex(accent),
        light: hex(hslToRgb(ringOf(hsl))),
        glow: glow(accent),
        onac: hex(hslToRgb(onAccent(hsl)))
      };
    }

    function cachePut(url, rgb) {
      if (!Object.prototype.hasOwnProperty.call(cache, url)) {
        cache_keys.push(url);
        while (cache_keys.length > CACHE_LIMIT) {
          var old = cache_keys.shift();
          delete cache[old];
        }
      }
      cache[url] = { rgb: rgb || null };
    }

    /* Чтение пикселей уменьшенной копии. SecurityError бросает getImageData,
       когда картинка пришла без CORS-заголовка («испорченный» canvas), —
       это не ошибка плагина, а отсутствие разрешения, поэтому ответ null,
       а не лог с жалобой. */
    function read(img, doc) {
      if (!img.naturalWidth || !img.naturalHeight) return null;
      try {
        var canvas = doc.createElement('canvas');
        canvas.width = SAMPLE;
        canvas.height = SAMPLE;
        /* willReadFrequently: Chrome иначе пишет в консоль предупреждение о
           readback с GPU-полотна («Multiple readback operations… are faster
           with willReadFrequently») — проверено живьём. Движки, которые
           второго аргумента не знают, просто его игнорируют. */
        var ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return null;
        ctx.drawImage(img, 0, 0, SAMPLE, SAMPLE);
        return dominant(ctx.getImageData(0, 0, SAMPLE, SAMPLE).data);
      } catch (e) {
        return null;
      }
    }

    /* Считает доминирующий цвет картинки и отдаёт его колбэку: {r,g,b} или
       null (не загрузилась, пиксели закрыты, цвета нет). Возвращает ручку
       {cancel} для незавершённого запроса — уход с карточки обязан её
       дёрнуть, иначе поздний ответ применил бы чужой акцент. Ответ из кэша
       приходит синхронно, и ручки тогда нет (null). */
    function fromImage(url, cb) {
      if (!url) { cb(null); return null; }
      if (Object.prototype.hasOwnProperty.call(cache, url)) { cb(cache[url].rgb); return null; }
      var doc = typeof document !== 'undefined' ? document : null;
      if (!doc || typeof Image === 'undefined') { cb(null); return null; }

      var img = new Image();
      var live = true;
      pending_count++;
      request_count++;

      function release() {
        live = false;
        pending_count--;
        img.onload = null;
        img.onerror = null;
      }

      function done(rgb) {
        if (!live) return;
        release();
        cachePut(url, rgb);
        cb(rgb);
      }

      img.onload = function () { done(read(img, doc)); };
      img.onerror = function () { done(null); };
      /* crossOrigin ставится ДО src: после присвоения адреса атрибут уже не
         влияет на запрос, и пиксели остались бы закрытыми. */
      img.crossOrigin = 'anonymous';
      img.src = url;

      return {
        cancel: function () {
          if (!live) return;
          release();
        }
      };
    }

    return {
      MIN_RATIO: MIN_RATIO,
      rgbToHsl: rgbToHsl,
      hslToRgb: hslToRgb,
      hex: hex,
      parseHex: parseHex,
      luminance: luminance,
      contrast: contrast,
      dominant: dominant,
      adjust: adjust,
      onAccent: onAccent,
      ring: ringOf,
      glow: glow,
      tokens: tokens,
      mixRgb: mixRgb,
      tint: tint,
      fromImage: fromImage,
      cacheSize: function () { return cache_keys.length; },
      pending: function () { return pending_count; },
      /* Сколько раз за сеанс дело дошло до расчёта цвета по картинке (кэш
         сюда не считается). Нужен живой проверке: быстрый проход по ряду
         обязан давать ноль — акцент считается только после паузы фокуса
         (src/48_hero.js). */
      requests: function () { return request_count; }
    };
  })();

  /* -------------------------------------------------------------------- */
  /* LC.accent — акцент текущего фильма.                                   */
  /*                                                                       */
  /* Настройка lumen_accent_auto по умолчанию ВЫКЛЮЧЕНА: вид карточки без  */
  /* спроса не меняем. Пока она выключена, модуль не создаёт ни одной      */
  /* картинки и не пересобирает CSS.                                       */
  /* -------------------------------------------------------------------- */

  LC.accent = (function () {

    var AUTO_KEY = 'lumen_accent_auto';
    /* Размер копии постера для расчёта: w185 — самая маленькая у TMDB,
       ~10 КБ. Адрес собирает Lampa.TMDB.image — он уважает TMDB-прокси
       пользователя (план 0.2: image.tmdb.org руками не собираем).
       Размер выбран ещё и потому, что сама Lampa постеры w185 не грузит
       (ряды — w300, карточка — w500, оба без crossOrigin): картинка, уже
       лежащая в HTTP-кэше как ответ на запрос БЕЗ CORS, закрыла бы нам
       пиксели, и такую ошибку видно в консоли у самой Lampa на её w300. */
    var POSTER_SIZE = 't/p/w185';

    /* Четвёрка токенов текущего фильма либо null («акцент из настроек»).
       Читается функцией theme() в src/30_css.js на каждой сборке CSS. */
    var override = null;
    /* Task 21 (фаза 3): акцент тематической атмосферы — запасной цвет на
       случай, когда постер своего не дал. Приоритет плана: постер -> тема ->
       настройка, поэтому тема лежит отдельным значением и уступает
       постеру в current(), а не затирает его. */
    var themeTokens = null;
    /* Доминанта постера текущего фильма — из неё красится фон страницы
       (tint ниже). Живёт отдельно от акцента: акцент мог не собраться, а
       фону доминанты достаточно. */
    var source = null;
    var task = null;

    /* Переключатели Lampa пишут строки 'true'/'false' (план 0.2), поэтому
       сравниваем и со строкой, и с булевым. */
    function auto() {
      var v = LC.pref(AUTO_KEY, false);
      return v === true || v === 'true';
    }

    /* Ревью фазы 3 (Important 2): акцент от постера — работа режима «полные
       анимации». Дело не в арифметике по картинке (она копеечная), а в том,
       что КАЖДОЕ применение пересобирает всю таблицу стилей плагина (~81 КБ)
       и заставляет браузер пересчитать стили документа целиком — во время
       навигации по главной это самое дорогое, что плагин умеет делать. В
       lite/off акцент не считается и не применяется вовсе, ровно как
       подкраска фона (tint ниже). */
    function on() {
      if (!LC.enabled() || !auto()) return false;
      try {
        return LC.motionMode() === 'full';
      } catch (e) {
        return false;
      }
    }

    /* Шаг сетки, к которой сводится доминанта постера. Точное сравнение «тот
       же ли цвет» на проходе по главной почти всегда отвечает «другой» — у
       каждой карточки своя доминанта, — и каждая остановка фокуса стоила бы
       пересборки стилей (ревью фазы 3, Important 2). Округление идёт ДО
       расчёта токенов, поэтому близкие постеры дают буквально один и тот же
       акцент, и apply() честно видит «ничего не изменилось». Шаг 16 на канал
       — граница, за которой сдвиг тона уже заметен на однотонной заливке;
       пересборку он не отменяет, а снимает её там, где цвет на глаз тот же. */
    var QUANT = 16;

    function quantChannel(v) {
      var n = Math.floor(Number(v) / QUANT) * QUANT + QUANT / 2;
      if (!(n > 0)) return 0;
      return n > 255 ? 255 : n;
    }

    function quantize(rgb) {
      if (!rgb) return null;
      return { r: quantChannel(rgb.r), g: quantChannel(rgb.g), b: quantChannel(rgb.b) };
    }

    function bg() {
      try {
        var t = LC.tokens();
        if (t && t.bg) return t.bg;
      } catch (e) {
        warn('accent: tokens failed', e);
      }
      return '#0B0908';
    }

    function posterUrl(path) {
      try {
        if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
          return Lampa.TMDB.image(POSTER_SIZE + path);
        }
      } catch (e) {
        warn('accent: tmdb image failed', e);
      }
      return '';
    }

    function cancel() {
      if (task) {
        task.cancel();
        task = null;
      }
    }

    function sameRgb(a, b) {
      if (!a || !b) return !a && !b;
      return a.r === b.r && a.g === b.g && a.b === b.b;
    }

    /* Единственная точка смены акцента и подкраски фона. Пересборка CSS —
       только когда что-то действительно другое: лишний переразбор 81 КБ
       стилей на ТВ заметен. Доминанта сравнивается отдельно от акцента: два
       разных постера могут дать один и тот же акцент (он загнан в узкую
       рамку светлоты и насыщенности) и при этом разный тон фона. */
    function apply(next, rgb) {
      var sameTokens = next && override ? next.color === override.color : (!next && !override);
      if (sameTokens && sameRgb(source, rgb || null)) return;
      override = next || null;
      source = rgb || null;
      /* У выключенного плагина своего <style> в head нет (LC.removeCss), и
         пересборка вернула бы его на место. Переопределение при этом уже
         снято — включат обратно, и карточка нарисуется акцентом настроек. */
      if (!LC.enabled()) return;
      try {
        LC.injectCss();
      } catch (e) {
        warn('accent: css inject failed', e);
      }
    }

    function reset() {
      cancel();
      apply(null, null);
    }

    /* Считает и применяет акцент фильма. Пока новый цвет не посчитан,
       предыдущий остаётся на месте — так переход между карточками не
       моргает серединным сбросом на акцент настроек. */
    function applyFor(movie) {
      cancel();
      if (!on()) { apply(null, null); return; }
      var path = movie && movie.poster_path;
      if (!path) { apply(null, null); return; }
      var url = posterUrl(path);
      if (!url) { apply(null, null); return; }
      task = LC.color.fromImage(url, function (rgb) {
        task = null;
        /* Доминанта сохраняется даже тогда, когда акцент из неё собрать не
           удалось (цвет не вытянул контраст к пределу светлоты): фону она
           годится — он красится тоном, а не самим цветом плаката. Хранится и
           сравнивается уже округлённая (quantize выше) — иначе «тот же цвет»
           не совпал бы сам с собой при возврате на карточку. */
        var dom = quantize(rgb);
        apply(dom ? LC.color.tokens(dom, bg()) : null, dom);
      });
    }

    /* Правка пользователя 2026-09-17 (третий круг): фон страницы получает
       оттенок постера. Цвет — та же доминанта, что дала акцент; второго
       расчёта нет. Зовётся из palette() (src/30_css.js) на каждой сборке
       CSS, поэтому дешёвая: чистая арифметика по сохранённому rgb.

       bg — фон темы, guard — самый слабый текст на нём (подпись года под
       постером), ratio — порог его читаемости. В lite/off подкраски нет
       вовсе: на слабом ТВ это лишняя работа композитора, а «фон другого
       оттенка» там ничего не стоит показывать плавно. */
    function tint(bg, guard, ratio) {
      if (!source) return null;
      try {
        if (LC.motionMode() !== 'full') return null;
      } catch (e) {
        return null;
      }
      return LC.color.tint(source, bg, guard, ratio);
    }

    /* Карточка закрыта: снимаем всё, что принадлежало ей. */
    function destroy() {
      cancel();
      var had = !!(override || source || themeTokens);
      override = null;
      source = null;
      themeTokens = null;
      if (!had || !LC.enabled()) return;
      try {
        LC.injectCss();
      } catch (e) {
        warn('accent: css inject failed', e);
      }
    }

    /* Акцент темы фильма (Task 21). hex — цвет правила темы из манифеста,
       null снимает его. Пересборка CSS — только на реальной смене цвета:
       темы меняются раз в карточку, но зовут эту функцию и complite, и
       возврат из истории. */
    function setTheme(hex) {
      var next = null;
      if (hex) {
        try {
          next = LC.color.tokens(LC.color.parseHex(hex), bg());
        } catch (e) {
          warn('accent: theme color failed', e);
        }
      }
      var same = next && themeTokens ? next.color === themeTokens.color : (!next && !themeTokens);
      if (same) return;
      themeTokens = next;
      /* Постер главнее темы: пока его цвет стоит, экран не перекрашиваем —
         current() всё равно вернёт постерный. */
      if (override) return;
      if (!LC.enabled()) return;
      try {
        LC.injectCss();
      } catch (eCss) {
        warn('accent: css inject failed', eCss);
      }
    }

    return {
      current: function () { return override || themeTokens; },
      theme: function () { return themeTokens; },
      setTheme: setTheme,
      dominant: function () { return source; },
      tint: tint,
      applyFor: applyFor,
      reset: reset,
      /* Уход с карточки: незавершённая картинка отменяется, оба акцента
         карточки (постер и тема) снимаются, экран пересобирается ОДИН раз —
         последовательные reset() + setTheme(null) стоили бы двух разборов
         таблицы стилей на каждом уходе с карточки. */
      destroy: destroy
    };
  })();

  /* Настройка переключена на лету: выключили — акцент настроек возвращается
     немедленно; включили — считаем по фильму открытой карточки (её данные
     лежат в LC.active.data, src/90_runtime.js). Настройки Lampa открываются
     ПОВЕРХ карточки и при возврате не шлют ни 'full', ни complite. */
  LC.applyAccentPref = function () {
    try {
      var movie = LC.active && LC.active.data && LC.active.data.movie;
      LC.accent.applyFor(movie || null);
    } catch (e) {
      warn('accent pref failed', e);
    }
  };

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.color;

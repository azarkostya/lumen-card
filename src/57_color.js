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

    /* Кэш «адрес постера -> цвет»: один расчёт на фильм за сеанс. Хранится
       в памяти (не в Storage): цвет считается за миллисекунды, а место в
       localStorage нужнее кэшу отзывов. Вытеснение — FIFO по списку ключей,
       как в кэше отзывов (src/60_reviews.js), только без индекса: терять
       тут нечего, запись восстанавливается одним расчётом. */
    var CACHE_LIMIT = 50;
    var cache = {};
    var cache_keys = [];
    var pending_count = 0;

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
      fromImage: fromImage,
      cacheSize: function () { return cache_keys.length; },
      pending: function () { return pending_count; }
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
    var task = null;

    /* Переключатели Lampa пишут строки 'true'/'false' (план 0.2), поэтому
       сравниваем и со строкой, и с булевым. */
    function auto() {
      var v = LC.pref(AUTO_KEY, false);
      return v === true || v === 'true';
    }

    function on() {
      return LC.enabled() && auto();
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

    /* Единственная точка смены акцента. Пересборка CSS — только когда цвет
       действительно другой: лишний переразбор 81 КБ стилей на ТВ заметен. */
    function apply(next) {
      if (!next && !override) return;
      if (next && override && next.color === override.color) return;
      override = next || null;
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
      apply(null);
    }

    /* Считает и применяет акцент фильма. Пока новый цвет не посчитан,
       предыдущий остаётся на месте — так переход между карточками не
       моргает серединным сбросом на акцент настроек. */
    function applyFor(movie) {
      cancel();
      if (!on()) { apply(null); return; }
      var path = movie && movie.poster_path;
      if (!path) { apply(null); return; }
      var url = posterUrl(path);
      if (!url) { apply(null); return; }
      task = LC.color.fromImage(url, function (rgb) {
        task = null;
        apply(rgb ? LC.color.tokens(rgb, bg()) : null);
      });
    }

    return {
      current: function () { return override; },
      applyFor: applyFor,
      reset: reset,
      /* Уход с карточки: незавершённая картинка отменяется, акцент
         возвращается к выбранному в настройках. */
      destroy: reset
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

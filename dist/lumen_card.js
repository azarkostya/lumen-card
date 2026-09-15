// Lumen Card for Lampa v0.2.0

/* ---- 00_head.js ---- */
/*!
 * Lumen Card — плагин карточки фильма/сериала для Lampa. Строгий ES5.
 */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.lumen_card_plugin) return;
  if (typeof window !== 'undefined') window.lumen_card_plugin = true;

  var LC = {};
  if (typeof window !== 'undefined') window.lumen_card = LC;
  LC.VERSION = '0.2.0';

  var PLUGIN = 'lumen_card';

  /* Тихий лог в консоль — ошибка в отрисовке не должна ронять плагин. */
  function warn(msg, err) {
    try { if (typeof window !== 'undefined' && window.console && console.log) console.log('[lumen-card] ' + msg, err || ''); } catch (e) { }
  }


/* ---- 10_util.js ---- */
  /* -------------------------------------------------------------------- */
  /* Чистые хелперы форматирования и ES5-коллекции.                        */
  /* Никаких обращений к window/Lampa/jQuery — модуль изолирован в своей    */
  /* функции и проверяется тестами (node --test) без браузера.             */
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

    return {
      esc: esc,
      pad2: pad2,
      plural: plural,
      initials: initials,
      fmtTime: fmtTime,
      fmtRuntime: fmtRuntime,
      each: each,
      map: map,
      filter: filter,
      find: find
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.util;


/* ---- 20_icons.js ---- */
  /* -------------------------------------------------------------------- */
  /* Единый набор иконок кнопок карточки: 24×24, stroke 1.8, round caps.   */
  /* Иконки подменяются ТОЛЬКО через CSS-маску (:before + mask-image) —    */
  /* outerHTML кнопок не меняется нигде (ни здесь, ни в шаблоне/рантайме): */
  /* от него зависит хэш приоритетной кнопки, см. план 0.2 «Кнопки и хэш   */
  /* приоритета». Модуль не трогает DOM и не знает о window/Lampa.        */
  /* -------------------------------------------------------------------- */

  LC.icons = (function () {
    var P = {
      // пути 1:1 из экрана 11 «Icons» файла design/Lumen Card for Lampa - FHD.dc.html
      play:     '<path d="M8 5l11 7-11 7V5z"/>',
      trailer:  '<path d="M3 7.5h18v11.5H3z"/><path d="M3 7.5L6.5 3h11L14 7.5"/><path d="M10 11.5l4.5 2.5-4.5 2.5v-5z"/>',
      bookmark: '<path d="M7 3h10v18l-5-4-5 4V3z"/>',
      torrent:  '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 19h16"/>',
      reaction: '<path d="M7 10.5V20H4v-9.5h3z"/><path d="M7 10.5l4-6.5a2 2 0 013 2.4l-.8 4.1h5a2 2 0 011.95 2.45l-1.3 5.6A2 2 0 0116.9 20H7"/>',
      bell:     '<path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 22h4"/>',
      more:     '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
      list:     '<path d="M9 6h11M9 12h11M9 18h7"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
      comment:  '<path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3v9z"/>',
      star:     '<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8L12 4z"/>',
      clock:    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
      film:     '<path d="M3 4.5h18v15H3z"/><path d="M7.5 4.5v15M16.5 4.5v15M3 12h18"/>',
      chevronR: '<path d="M9 6l6 6-6 6"/>',
      close:    '<path d="M6 6l12 12M18 6L6 18"/>'
    };
    var byButton = { 'button--play': 'play', 'button--book': 'bookmark', 'button--reaction': 'reaction', 'button--subscribe': 'bell', 'button--options': 'more', 'view--torrent': 'torrent', 'view--trailer': 'trailer' };
    function get(name) {
      var paint = (name === 'play' || name === 'more') ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return '<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" ' + paint + '>' + P[name] + '</svg>';
    }
    function names() { var r = []; for (var k in P) if (P.hasOwnProperty(k)) r.push(k); return r; }
    function forButton(cls) { return byButton[cls] || null; }
    // Отдельный svg для CSS-маски: цвет не важен (маска берёт альфу), currentColor в data-URI не работает — ставим #000
    function maskSvg(name) {
      var paint = (name === 'play' || name === 'more') ? 'fill="#000"' : 'fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + paint + '>' + P[name].replace(/currentColor/g, '#000') + '</svg>';
    }
    function maskUrl(name) {
      return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskSvg(name)) + '")';
    }
    // Иконки кнопок заменяются ТОЛЬКО через CSS: outerHTML кнопок не меняется (хэш приоритета, см. план 0.2).
    // Селекторы по классу покрывают и клон .button--priority, и кнопки, вставленные другими плагинами позже.
    function css() {
      var rules = [], fallback = [], sel, k, name;
      var map = {};
      for (k in byButton) if (byButton.hasOwnProperty(k)) map['.' + k] = byButton[k];
      map['[class*="view--online"]'] = 'play'; // Online Mod и аналоги: .view--online_mod, .view--online
      for (sel in map) {
        if (!map.hasOwnProperty(sel)) continue;
        name = map[sel];
        var btn = '.lumen-card .full-start__button' + sel;
        rules.push(btn + ' > svg{display:none !important}');
        rules.push(btn + ':before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.625em;height:1.625em;background-color:currentColor;-webkit-mask-image:' + maskUrl(name) + ';mask-image:' + maskUrl(name) + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
        // Фолбэк — ТЕМ ЖЕ селектором btn (та же специфичность, что у правил выше):
        // иначе при равном !important побеждает более специфичное основное правило
        // (.lumen-card .full-start__button.button--play > svg — 3 класса) и фолбэк
        // с общим селектором (.lumen-card .full-start__button > svg — 2 класса)
        // никогда не выигрывает каскад, оставаясь мёртвым кодом.
        fallback.push(btn + ' > svg{display:block !important}');
        fallback.push(btn + ':before{display:none !important}');
      }
      // Движок без поддержки CSS-масок (старые WebOS/Tizen): вместо пустого
      // закрашенного прямоугольника от :before показываем исходный svg кнопки.
      // !important на :before и совпадающий с основным правилом селектор на svg
      // гарантируют победу фолбэка независимо от порядка вставки CSS в документ.
      rules.push('@supports not ((-webkit-mask-image:none) or (mask-image:none)){' + fallback.join('') + '}');
      return rules.join('\n');
    }
    return { get: get, names: names, forButton: forButton, maskSvg: maskSvg, maskUrl: maskUrl, css: css };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.icons;


/* ---- 30_css.js ---- */
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

  var ACCENTS = {
    sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)' },
    ice: { color: '#7FB7C9', light: '#DCF1F8', glow: 'rgba(127,183,201,0.35)' },
    wine: { color: '#C46A8F', light: '#F8DCE7', glow: 'rgba(196,106,143,0.35)' },
    mint: { color: '#9FCF8A', light: '#E7F8DC', glow: 'rgba(159,207,138,0.35)' }
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


/* ---- 35_cardinfo.js ---- */
  /* -------------------------------------------------------------------- */
  /* Данные шапки карточки (Task 5a). Чистая логика без обращений к         */
  /* window/Lampa/jQuery — рантайм (90_runtime.js) только вставляет         */
  /* результат в DOM. Проверяется тестами (node --test) без браузера.       */
  /* -------------------------------------------------------------------- */

  LC.cardinfo = (function () {
    /* Task 5 Step 3b.2: словарь ISO -> русское название страны. */
    var COUNTRY_RU = {
      US: 'США',
      GB: 'Великобритания',
      RU: 'Россия',
      FR: 'Франция',
      DE: 'Германия',
      JP: 'Япония',
      KR: 'Южная Корея',
      CN: 'Китай',
      CA: 'Канада',
      AU: 'Австралия',
      IT: 'Италия',
      ES: 'Испания',
      IN: 'Индия'
    };

    function trim(str) {
      return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
    }

    /* headText — текст штатного .full-start-new__head, который start.js
       заполняет до события complite (формат '2024, США' или просто '2024').
       Отрезаем ведущий год с разделителем; если после этого ничего не
       осталось — фолбэк на production_countries[].iso_3166_1 по словарю,
       иначе английское имя страны из TMDB. */
    function country(headText, productionCountries) {
      var text = trim(headText).replace(/^\d{4}\s*,?\s*/, '');
      text = trim(text);
      if (text) return text;

      if (productionCountries && productionCountries.length) {
        var first = productionCountries[0] || {};
        var iso = first.iso_3166_1;
        if (iso && COUNTRY_RU[iso]) return COUNTRY_RU[iso];
        return first.name || iso || '';
      }
      return '';
    }

    /* Первый член съёмочной группы с job === 'Director'. */
    function director(crew) {
      if (!crew || !crew.length) return '';
      for (var i = 0; i < crew.length; i++) {
        if (crew[i] && crew[i].job === 'Director') return crew[i].name || '';
      }
      return '';
    }

    /* Автор сериала: created_by[0].name. */
    function creator(movie) {
      if (movie && movie.created_by && movie.created_by.length && movie.created_by[0]) {
        return movie.created_by[0].name || '';
      }
      return '';
    }

    /* Task 5 Step 3b.1: длинное название (> 18 символов) переносится
       классом .lumen-title--long вместо однострочного обрезания. */
    function titleClass(title) {
      return trim(title).length > 18 ? 'lumen-title--long' : '';
    }

    /* Task 5a Step 3: статус -> визуальный вид точки/подписи.
       'soon' покрывает Planned/In Production/Post Production (подпись
       «Анонс» выставляет рантайм, здесь только цветовой вид). */
    function statusKind(status) {
      var s = trim(status).toLowerCase();
      if (s === 'released') return 'good';
      if (s === 'returning series') return 'accent';
      if (s === 'planned' || s === 'in production' || s === 'post production') return 'soon';
      return 'muted';
    }

    /* Строка качества -> раздельные чипы (экран 01/03/10: "4K", "HDR", "BD").
       BDRip/BluRay схлопываются в 'BD', WEB-DL/WEBRip/WEBDL — в 'WEB'.
       Остальные токены — как есть, в верхнем регистре, без дублей. */
    function qualityChips(q) {
      q = trim(q);
      if (!q) return [];
      var raw = q.split(/[\s,\/]+/);
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var tok = raw[i];
        if (!tok) continue;
        var up = tok.toUpperCase();
        var mapped = up;
        if (up.indexOf('BDRIP') !== -1 || up.indexOf('BLURAY') !== -1 || up.indexOf('BLU-RAY') !== -1) mapped = 'BD';
        else if (up.indexOf('WEB-DL') !== -1 || up.indexOf('WEBDL') !== -1 || up.indexOf('WEBRIP') !== -1 || up === 'WEB') mapped = 'WEB';
        var exists = false;
        for (var j = 0; j < out.length; j++) { if (out[j] === mapped) { exists = true; break; } }
        if (!exists) out.push(mapped);
      }
      return out;
    }

    /* Счётчик реакции 'fire' (список e.data.reactions.result) или 0. */
    function reactionsCount(reactions) {
      if (!reactions || !reactions.length) return 0;
      for (var i = 0; i < reactions.length; i++) {
        if (reactions[i] && reactions[i].type === 'fire') return reactions[i].counter || 0;
      }
      return 0;
    }

    /* Ревью Task 5a (Task 5 Step 3b.3): URL картинок только через прокси
       TMDB Lampa — сам плагин image.tmdb.org руками не собирает (план 0.2).
       tmdbImage/apiImg — внешние функции (обычно Lampa.TMDB.image/Lampa.Api.img),
       передаются параметрами, чтобы модуль остался чистым (без window/Lampa).
       path нормализуется (без ведущего '/') перед вызовом ОБОИХ методов —
       так двойной слэш ('t/p/w1280//x.jpg', дефект приёмки v1) невозможен
       независимо от того, добавляет ли сам вызванный метод свой '/'.
       Основной путь — tmdbImage('t/p/' + size + '/' + path) (то, чем
       пользуется сама Lampa, живьём проверено — учитывает proxy_tmdb);
       apiImg(path, size) — фолбэк, если TMDB.image недоступен/бросил. */
    function imageUrl(path, size, tmdbImage, apiImg) {
      path = '' + (path || '');
      if (!path) return '';
      var clean = path.charAt(0) === '/' ? path.slice(1) : path;
      size = size || 'original';

      if (typeof tmdbImage === 'function') {
        try {
          var url = tmdbImage('t/p/' + size + '/' + clean);
          if (url) return url;
        } catch (e) { }
      }
      if (typeof apiImg === 'function') {
        try {
          var url2 = apiImg(clean, size);
          if (url2) return url2;
        } catch (e2) { }
      }
      return '';
    }

    /* Ревью Task 5a (рефакторинг LC.header): true, если карточка — сериал.
       Раньше жила в 90_runtime.js как локальная isSerial(movie), логика та же —
       чистая, без Lampa/DOM, просто переехала. */
    function isSerial(movie) {
      return !!(movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes || movie.name);
    }

    /* До 3 жанров, каждый — через capitalizeFn (обычно Lampa.Utils.capitalize
       FirstLetter, внедряется параметром из LC.header — сам cardinfo Lampa не
       знает). Без capitalizeFn имена жанров возвращаются как есть. */
    function genres(rawGenres, capitalizeFn) {
      var out = [];
      var cap = typeof capitalizeFn === 'function' ? capitalizeFn : function (s) { return s; };
      try {
        if (rawGenres && rawGenres.length) {
          for (var i = 0; i < rawGenres.length && i < 3; i++) {
            if (rawGenres[i] && rawGenres[i].name) out.push(cap(rawGenres[i].name));
          }
        }
      } catch (e) { }
      return out;
    }

    /* Возрастной рейтинг: приоритет у распознанного Lampa.TMDB.parsePG (parsed),
       иначе текст штатного узла .full-start__pg (domText) — оба добывает
       LC.header (Lampa API + DOM), здесь только чистое слияние. */
    function pgText(parsed, domText) {
      var pg = parsed ? ('' + parsed) : '';
      if (!pg && domText) pg = '' + domText;
      return pg;
    }

    /* Ревью Task 5b (правки координатора, п.1): единая точка правды для
       «какой путь кадра использовать» — раньше bgMode и backdropUrl
       (50_backdrops.js) были рассинхронизированы: bgMode учитывал кадр из
       movie.images.backdrops[], а backdropUrl читал только backdrop_path,
       из-за чего режим 'backdrop' с кадром только в альбоме давал пустой
       URL (гибрид вне design-spec §11/§12: ни постера, ни настоящего
       кадра). Приоритет — backdrop_path, иначе первый элемент
       images.backdrops[] с непустым file_path и БЕЗ iso_639_1 (кадр без
       текста/логотипа), иначе ''. И bgMode, и LC.backdrops.backdropUrl
       вызывают именно эту функцию. */
    function backdropPath(movie) {
      movie = movie || {};
      if (movie.backdrop_path) return movie.backdrop_path;

      var backdrops = (movie.images && movie.images.backdrops) || [];
      for (var i = 0; i < backdrops.length; i++) {
        var b = backdrops[i];
        if (b && b.file_path && !b.iso_639_1) return b.file_path;
      }
      return '';
    }

    /* Task 5b Step 1: режим фона ДО попытки реальной загрузки картинки
       (onload/onerror/таймаут — уже забота LC.backdrops, не этой чистой
       функции). 'backdrop' — backdropPath(movie) непуст. 'poster' — кадров
       нет, но есть poster_path. 'procedural' — нет вообще ничего, тогда
       фон — старые процедурные градиенты v1. */
    function bgMode(movie) {
      movie = movie || {};
      if (backdropPath(movie)) return 'backdrop';
      if (movie.poster_path) return 'poster';
      return 'procedural';
    }

    return {
      country: country,
      director: director,
      creator: creator,
      titleClass: titleClass,
      statusKind: statusKind,
      qualityChips: qualityChips,
      reactionsCount: reactionsCount,
      imageUrl: imageUrl,
      isSerial: isSerial,
      genres: genres,
      pgText: pgText,
      bgMode: bgMode,
      backdropPath: backdropPath
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardinfo;


/* ---- 40_template.js ---- */
  /* -------------------------------------------------------------------- */
  /* Шаблон.                                                               */
  /* Разметка кнопок (.full-start-new__buttons и .buttons--container)      */
  /* здесь НЕ хранится: она вырезается дословно (innerOf) из настоящего     */
  /* оригинального шаблона Lampa, который рантайм сохраняет до подмены      */
  /* (saveOriginalTemplate() в 90_runtime.js, до Template.add). Раньше       */
  /* кнопки были ручной копией прямо в этом файле, и она расходилась с      */
  /* оригиналом побайтово (другое форматирование — без пробелов/переносов   */
  /* строк между тегами), из-за чего Lampa.Utils.hash(outerHTML) не совпадал */
  /* с оригиналом и сбивал сохранённую пользователем приоритетную кнопку     */
  /* (buttons.js хэширует именно outerHTML кнопки, см. план 0.2 «Кнопки и   */
  /* хэш приоритета»). Вырезка из живого оригинала переживёт и апдейт       */
  /* Lampa, и чужой плагин, подменивший шаблон раньше нас.                  */
  /* -------------------------------------------------------------------- */

  LC.template = (function () {
    function innerOf(html, cls) {
      if (typeof html !== 'string' || !cls) return null;
      var wordRe = new RegExp('(^|\\s)' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)');

      /* Индекс первой НЕэкранированной кавычками '>' начиная с pos, или -1
         (незакрытый тег). '>' внутри "…"/'…' (например, в data-x="1>2") не
         считается концом тега — без этого учёта строка вроде
         '<div class="x" data-y="1>2">' обрывалась бы на первом '>'. */
      function findTagClose(pos) {
        var i = pos, quote = null, c;
        for (; i < html.length; i++) {
          c = html.charAt(i);
          if (quote) { if (c === quote) quote = null; }
          else if (c === '"' || c === '\'') quote = c;
          else if (c === '>') return i;
        }
        return -1;
      }

      function classOf(tagText) {
        var m = /class\s*=\s*"([^"]*)"/i.exec(tagText) || /class\s*=\s*'([^']*)'/i.exec(tagText);
        return m ? m[1] : '';
      }

      /* Токен, начинающийся с html[i] === '<':
         - 'comment' — HTML-комментарий, пропускается целиком до '-->' (то,
           что внутри, тегом не считается — иначе закомментированный старый
           <div class="…">…</div> мог бы подменить собой настоящий блок);
         - 'open'/'close' — <div…>/</div>, граница имени тега проверена явно
           (символ сразу после "div" — пробел, '>' или '/'), чтобы 'divider'
           не приняло за div; у 'open' есть selfClosing (тег вида <div … />:
           последний непробельный символ перед '>' — '/') — такой тег сам
           закрывает себя и не требует парного </div>;
         - 'other' — любой другой тег (span, svg, use, br…), на глубину
           вложенности не влияет.
         null — незакрытый тег или незакрытый комментарий: выше по стеку это
         тоже даёт null (см. innerOf/цикл ниже). Регистр важен: '<DIV' тегом
         div не считается (это осознанно — Lampa/наш build() пишут div только
         строчными; тег становится 'other', что для div-поиска даёт null). */
      function readTag(i) {
        var e, tagText, body, selfClosing;
        if (html.slice(i, i + 4) === '<!--') {
          e = html.indexOf('-->', i + 4);
          return e === -1 ? null : { type: 'comment', next: e + 3 };
        }
        if (html.slice(i, i + 4) === '<div' && /[\s>\/]/.test(html.charAt(i + 4) || '>')) {
          e = findTagClose(i);
          if (e === -1) return null;
          tagText = html.slice(i, e + 1);
          body = tagText.slice(0, -1).replace(/\s+$/, '');
          selfClosing = body.charAt(body.length - 1) === '/';
          return { type: 'open', next: e + 1, cls: classOf(tagText), selfClosing: selfClosing };
        }
        if (html.slice(i, i + 5) === '</div' && /[\s>]/.test(html.charAt(i + 5) || '>')) {
          e = findTagClose(i);
          return e === -1 ? null : { type: 'close', next: e + 1 };
        }
        e = findTagClose(i);
        return e === -1 ? null : { type: 'other', next: e + 1 };
      }

      /* Фаза 1: ищем первый <div>, у которого в class есть токен cls целым словом.
         Если сам он самозакрывающийся (<div class="cls"/>), содержимого у него
         нет по определению — сразу пустая строка, парный </div> не ищем. */
      var pos = html.indexOf('<'), tok, contentStart = -1;
      while (pos !== -1) {
        tok = readTag(pos);
        if (!tok) return null;
        if (tok.type === 'open' && wordRe.test(tok.cls)) {
          if (tok.selfClosing) return '';
          contentStart = tok.next;
          break;
        }
        pos = html.indexOf('<', tok.next);
      }
      if (contentStart === -1) return null;

      /* Фаза 2: от конца открывающего тега считаем вложенность по всем
         <div…>/</div> (остальные теги и комментарии пропускаем как есть) —
         так парный </div> находится даже если внутри блока есть свои
         вложенные div. Самозакрывающийся <div … /> глубину не увеличивает —
         он не требует своего </div>, иначе он «съедал» бы чужой закрывающий
         тег дальше по документу. Срез — по индексам исходной строки,
         дословно, без trim/replace: комментарии и прочая разметка внутри
         блока остаются в вырезке как есть, они могут быть частью outerHTML
         кнопки. */
      var depth = 1;
      pos = html.indexOf('<', contentStart);
      while (pos !== -1) {
        tok = readTag(pos);
        if (!tok) return null;
        if (tok.type === 'open') {
          if (!tok.selfClosing) depth++;
        } else if (tok.type === 'close') {
          depth--;
          if (depth === 0) return html.slice(contentStart, pos);
        }
        pos = html.indexOf('<', tok.next);
      }
      return null; /* нет баланса — незакрытый div */
    }

    function build(original) {
      var buttons = innerOf(original, 'full-start-new__buttons');
      var pool = innerOf(original, 'buttons--container');
      if (buttons === null || pool === null) return null;
      if (buttons.indexOf('button--play') === -1) return null;

      /* Task 5a Step 2: шесть .lumen-in — соседние дети ОДНОГО .lumen-content
         (совпадает с .full-start-new__right), между ними нет посторонних
         узлов — на этом основан stagger-подбор Task 4 (nth-child(1..6)).
         .lumen-side идёт следом седьмым ребёнком, на нумерацию первых
         шести не влияет. Порядок блоков — по Task 5a: мета; заголовок +
         оригинал/режиссёр; описание; рейтинги + статус + чип реакций;
         прогресс; кнопки. */
      return '' +
        '<div class="full-start-new lumen-card">' +
        '<div class="full-start-new__body">' +
        '<div class="full-start-new__left">' +
        '<div class="full-start-new__poster">' +
        '<img class="full-start-new__img full--poster" />' +
        '</div>' +
        '</div>' +
        '<div class="full-start-new__right lumen-content">' +

        /* 1: мета (год · страна · хронометраж/сезоны · жанры · 18+ · реж.) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__head"></div>' +
        '<div class="lumen-meta"></div>' +
        '<div class="full-start__pg hide"></div>' +
        '</div>' +

        /* 2: заголовок + оригинальное название/режиссёр(создатель) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__title">{title}</div>' +
        '<div class="lumen-original">{original_title}</div>' +
        '<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
        '</div>' +

        /* 3: описание (2 строки, line-clamp в CSS) */
        '<div class="lumen-in lumen-descr">{descr}</div>' +

        /* 4: рейтинги + чип реакций (статус — в боковой колонке, design-spec §8 /
           экраны 01,10: пилюля стоит первой над чипами качества, а не в общей
           ленте — уточнение по ревью Task 5a, Step 2 плана был неточен) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__rate-line">' +
        '<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
        '<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
        '<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
        '<div class="full-start__tag tag--episode hide"><div></div></div>' +
        '<div class="lumen-reactions-chip hide"><div class="lumen-reactions-chip__value"></div><div class="lumen-reactions-chip__label"></div></div>' +
        '</div>' +
        '</div>' +

        /* 5: продолжить просмотр */
        '<div class="lumen-in lumen-progress hide">' +
        '<span class="lumen-progress__label"></span>' +
        '<div class="lumen-progress__bar"><div></div></div>' +
        '<span class="lumen-progress__time"></span>' +
        '</div>' +

        /* 6: кнопки (только LC.template.build — содержимое не трогать) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +
        /* Обёртка константна (только этот один div), хэшируется НЕ она —
           хэшируются кнопки внутри (innerOf вырезает только их, план 0.2). */
        '<div class="full-start-new__buttons">' + buttons + '</div>' +
        '</div>' +

        /* Боковая колонка: статус (первым, над чипами качества) + раздельные
           чипы качества + «В ролях». */
        '<div class="lumen-side">' +
        '<div class="full-start__status hide"></div>' +
        '<div class="lumen-tags">' +
        '<div class="full-start__tag tag--quality hide"><div></div></div>' +
        '</div>' +
        '<div class="lumen-cast hide">' +
        '<div class="lumen-cast__label"></div>' +
        '<div class="lumen-cast__row"></div>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '<div class="lumen-keep">' +
        '<div class="full-start__tag tag--year hide"><div></div></div>' +
        '<div class="full-start__tag tag--time hide"><div></div></div>' +
        '<div class="full-start-new__details"></div>' +
        '<div class="is--serial hide"></div>' +
        '</div>' +
        '</div>' +
        /* Та же логика: обёртка константна, вырезаны и вставлены дословно
           только сами кнопки-альтернативы (торренты/трейлеры) внутри неё. */
        '<div class="hide buttons--container">' + pool + '</div>' +
        '</div>';
    }

    /* Task 5/5a Step 1: список классов/ключей, обязательных в НАШЕМ шаблоне —
       start.js обращается к ним независимо от того, есть ли они в текущем
       original (missingInOriginal — только информативно, на assert.ok не
       влияет). */
    var REQUIRED = ['full-start-new__title', 'full-start-new__head', 'full--tagline', 'full-start-new__details',
      'full-start-new__reactions', 'full-start-new__buttons', 'buttons--container', 'button--play', 'button--book',
      'button--reaction', 'button--subscribe', 'button--options', 'rate--tmdb', 'rate--imdb', 'rate--kp',
      'tag--year', 'tag--time', 'tag--quality', 'tag--episode', 'full-start__pg', 'full-start__status',
      'is--serial', 'full--poster', 'full-start-new__poster'];

    function assert(original, ours) {
      var missingInOriginal = [], missingInOurs = [];
      LC.util.each(REQUIRED, function (c) {
        if (original.indexOf(c) === -1) missingInOriginal.push(c);
        if (ours.indexOf(c) === -1) missingInOurs.push(c);
      });
      var keys = original.match(/#\{[a-z_]+\}/g) || [];
      LC.util.each(keys, function (k) { if (ours.indexOf(k) === -1) missingInOurs.push(k); });
      return { ok: missingInOurs.length === 0, missingInOurs: missingInOurs, missingInOriginal: missingInOriginal };
    }

    return { innerOf: innerOf, build: build, REQUIRED: REQUIRED, assert: assert };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.template;


/* ---- 50_backdrops.js ---- */
  /* -------------------------------------------------------------------- */
  /* Фон карточки (Task 5b: перенесено из 90_runtime.js без изменения      */
  /* поведения для режима 'backdrop'; добавлены режимы 'poster' и          */
  /* 'procedural' по LC.cardinfo.bgMode). Публично — LC.backdrops.apply     */
  /* (root, body, movie) и LC.backdrops.cancel(body); apply вызывает        */
  /* Listener 'full' в 90_runtime.js на complite (там же, где раньше был    */
  /* applyBackdrop), cancel — 'activity' destroy (правки координатора,      */
  /* п.4). Task 6: LC.backdrops.pickBackdrops (чистая функция отбора        */
  /* кадров); сам контроллер слайдшоу — в src/51_slideshow.js (LC.slideshow,*/
  /* рефакторинг, решение координатора: Task 7 будет ставить его на паузу   */
  /* извне). apply() считает urls (pickBackdrops + LC.cardinfo.imageUrl) и  */
  /* вызывает LC.slideshow.create(layer, urls, opts) — возвращённый         */
  /* контроллер {pause,resume,destroy} 90_runtime.js хранит в                */
  /* LC.active.slideshow и дёргает pause/resume из той же подписки          */
  /* 'activity' (archive/start), cancel(body) вызывает destroy(). URL       */
  /* любых картинок — только через LC.cardinfo.imageUrl (план 0.2           */
  /* «Картинки», прокси TMDB, без двойного слэша). */
  /* -------------------------------------------------------------------- */

  function tmdbImageFn() {
    if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
      return function (url) { return Lampa.TMDB.image(url); };
    }
    return null;
  }

  function apiImgFn() {
    if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
      return function (path, size) { return Lampa.Api.img(path, size); };
    }
    return null;
  }

  /* Ревью Task 5b (правки координатора, п.1): путь кадра — из
     LC.cardinfo.backdropPath (backdrop_path либо первый чистый элемент
     images.backdrops[]), той же функции, что определяет bgMode — раньше
     это были два независимых источника правды, и режим 'backdrop' с кадром
     только в альбоме отдавал пустой URL. */
  function backdropUrl(movie) {
    var url = '';
    try {
      var path = LC.cardinfo.backdropPath(movie);
      if (path) url = LC.cardinfo.imageUrl(path, 'w1280', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('image url failed', e);
    }
    if (!url && movie.background_image) url = movie.background_image;
    return url;
  }

  /* Task 5b Step 3: постер для размытого фона — 'w500', то же качество,
     которое родная Poster.onCreate (app.min.js) грузит в .full--poster
     (card.img = Api.img(poster_path, ...).replace(/\/w\d+/, '/w500')) —
     сам постер-<img> плагин не трогает, эта функция только про фон. */
  function posterUrl(movie) {
    try {
      if (movie.poster_path) return LC.cardinfo.imageUrl(movie.poster_path, 'w500', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('poster url failed', e);
    }
    return '';
  }

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  /* .lumen-backdrop лежит в e.body — сосед карточки (.lumen-card вложена
     глубже, внутри .scroll__body), обычный потомковый селектор вида
     .lumen-card.lumen-motion-lite … .lumen-backdrop тут не сработает
     (план 1.1: ALLOWED_ROOTS в css.test.mjs держит .lumen-backdrop как
     самостоятельный корень отдельно от .lumen-card). Поэтому режим
     анимаций зеркалится прямо на сам слой фона — CSS для .lumen-bg--blur
     читает класс lumen-motion-* на .lumen-backdrop (design-spec §12/доп.
     к Task 5b: в lite/off — без filter:blur, только затемнение). */
  function syncMotionClass(layer) {
    try {
      layer.removeClass('lumen-motion-full lumen-motion-lite lumen-motion-off').addClass('lumen-motion-' + LC.motionMode());
    } catch (e) { }
  }

  /* Task 5b Step 5 (утечки): перед любой мутацией DOM после асинхронного
     ответа (Image().onload/onerror/таймер) — проверяем, что узел ещё в
     документе. Карточку могли закрыть до ответа: Lampa убирает весь
     .activity__body (а с ним и .lumen-backdrop) при destroy активности. */
  function isMounted(node) {
    try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
  }

  /* Task 6: .lumen-bg__slides — контейнер для дополнительных кадров
     слайдшоу (первый кадр остаётся .lumen-backdrop__img — грузится он
     один раз в loadBackdrop(), см. ниже). Вставлен ДО вуалей в разметке,
     поэтому и он сам, и все кадры, которые в него добавит слайдшоу,
     всегда рисуются под вуалями (план: «вуали слоя остаются поверх
     кадров») — без явного z-index, просто по порядку в DOM. */
  function ensureLayer(body) {
    var layer = body.children('.lumen-backdrop');
    if (!layer.length) {
      layer = $('<div class="lumen-backdrop">' +
        '<div class="lumen-backdrop__img"></div>' +
        '<div class="lumen-bg__slides"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
        '</div>');
      body.prepend(layer);
    }
    return layer;
  }

  /* Task 6: тот же layer (то же e.body) может получить apply() ещё раз
     (смена карточки без полного размонтирования слоя — тот же сценарий,
     ради которого уже существуют lumenGen/lumenPending) — сбрасываем и
     кадры предыдущего слайдшоу: .lumen-backdrop__img теряет
     lumen-bg__img/is-active (иначе на нём ещё секунду доиграл бы Ken
     Burns предыдущей карточки), .lumen-bg__slides опустошается. */
  function clearLayer(layer) {
    layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2 lumen-bg--blur');
    layer.find('.lumen-backdrop__img').removeClass('lumen-bg__img is-active');
    layer.find('.lumen-bg__slides').empty();
  }

  /* Ревью Task 5b (правки координатора, п.2/4): у каждого слоя — счётчик
     поколения (layer.data('lumenGen')) и ссылка на незавершённую загрузку
     (layer.data('lumenPending') = {timer, loader}). Без этого повторный
     apply() на том же e.body (смена карточки без полного размонтирования
     слоя, либо будущий слайдшоу Task 6) мог получить кадр от уже
     неактуального вызова, если тот ответит позже нового — новый фон
     перезаписывался бы устаревшим. cancelPending() гасит и обработчики
     (onload/onerror = null — сама сеть их больше не вызовет), и таймер;
     gen — запасная сеть НА СЛУЧАЙ, если что-то всё же успело выполниться
     до отмены (см. finish() ниже). */
  function cancelPending(layer) {
    var pending = layer.data('lumenPending');
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    if (pending.loader) { pending.loader.onload = null; pending.loader.onerror = null; }
    layer.removeData('lumenPending');
  }

  function nextGen(layer) {
    var gen = (layer.data('lumenGen') || 0) + 1;
    layer.data('lumenGen', gen);
    return gen;
  }

  /* Task 5b Step 3/4: нет кадра — ни в режиме 'poster'/'procedural', ни
     когда кадр из режима 'backdrop' не загрузился/завис (design-spec §12,
     дополнение к Task 5b: размытый постер, blur(40px)=1.75em, opacity:.8
     поверх диагонального градиента — сам градиент в CSS у .lumen-bg--blur).
     Постера тоже нет — старые процедурные градиенты v1, без изменений. */
  function showNoFrame(layer, movie) {
    var img = layer.find('.lumen-backdrop__img');
    var url = posterUrl(movie);
    if (url) {
      img.css('background-image', 'url("' + encodeURI(url) + '")');
      syncMotionClass(layer);
      layer.addClass('lumen-bg--blur').addClass('loaded');
    } else {
      img.css('background-image', '');
      layer.addClass(procClass(movie)).addClass('loaded');
    }
  }

  /* Task 5b Step 3: предзагрузка кадра как в v1 (Image().onload/onerror),
     плюс таймаут 8с (экран 13 design-spec §12 не даёт точного числа
     зависания — восьмисекундный таймаут свой). Любая ветка завершения
     (onload/onerror/таймер) проходит через finish(), которая гасит все
     остальные пути и таймер — второй мутации после первой не будет.
     Ревью Task 5b (правки координатора, п.3): весь блок ПОСЛЕ проверки
     isMounted — в одном try/catch (как было в v1): encodeURI может бросить
     URIError на «сломанном» URL, showNoFrame тоже может исключить —
     раньше try/catch стоял только вокруг успешной ветки.
     Task 6 (refactor): пятый параметр controller — контроллер слайдшоу
     этого apply() (LC.slideshow.create(), src/51_slideshow.js), уже создан
     и ждёт на layer.data('lumenSlideshow') к моменту, когда сеть ответит.
     Первый кадр слайдшоу — именно этот, уже загружаемый здесь,
     .lumen-backdrop__img (план: «не грузить его дважды») —
     controller.activate() только помечает узел классами и решает,
     отбирать ли ещё кадры/заводить ли таймер, новой загрузки не делает. */
  function loadBackdrop(layer, movie, gen, controller) {
    var url = backdropUrl(movie);
    var img = layer.find('.lumen-backdrop__img');

    if (!url) { showNoFrame(layer, movie); return; }

    img.css('background-image', '');
    var node = layer[0];
    var done = false;
    var timer = null;
    var loader = new Image();

    function finish(ok) {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      loader.onload = null;
      loader.onerror = null;
      layer.removeData('lumenPending');
      /* Устарела: более новый apply() уже поменял поколение слоя (запасная
         сеть — cancelPending() выше по стеку уже обнулил onload/onerror,
         это на случай, если finish() всё же был вызван до отмены). */
      if (layer.data('lumenGen') !== gen) return;
      if (!isMounted(node)) return;
      try {
        if (ok) {
          /* encodeURI страхует от "/\/) в URL, которые сломали бы строку url("...") */
          img.css('background-image', 'url("' + encodeURI(url) + '")');
          layer.addClass('loaded');
          /* Task 6: syncMotionClass раньше вызывался только из showNoFrame
             (poster/procedural/таймаут) — успешный кадр 'backdrop' класс
             lumen-motion-* на layer не получал вовсе, а Ken Burns (Task 4,
             30_css.js) заведён именно на .lumen-backdrop.lumen-motion-full
             .lumen-bg__img.is-active. Без этой строки наезд не включался
             бы никогда. */
          syncMotionClass(layer);
          controller.activate();
        } else {
          showNoFrame(layer, movie);
        }
      } catch (e) {
        warn('backdrop apply failed', e);
      }
    }

    loader.onload = function () { finish(true); };
    loader.onerror = function () { finish(false); };
    timer = setTimeout(function () { finish(false); }, 8000);
    loader.src = url;

    layer.data('lumenPending', { timer: timer, loader: loader });
  }

  /* Task 5b Step 2: сам <img class="full--poster"> заполняет родная
     Lampa (Poster.onCreate в app.min.js: card.img из poster_path, w500,
     добавляет .loaded на .full-start-new__poster сама) — плагин его не
     трогает вовсе, только раскрывает узел через CSS (.lumen-card--poster,
     v1-правило .full-start-new__left{display:none} переопределяется там
     большей специфичностью + !important) и добавляет подпись-атрибуцию
     источника (design-spec §11: текст «TMDB» снизу-слева плейсхолдера). */
  function ensurePosterLabel(root) {
    var poster = root.find('.full-start-new__poster');
    if (!poster.length) return;
    if (!poster.children('.lumen-poster-tmdb').length) {
      poster.append('<div class="lumen-poster-tmdb">TMDB</div>');
    }
  }

  /* Task 6 (refactor): apply() считает urls (pickBackdrops + LC.cardinfo.
     imageUrl) и передаёт их в LC.slideshow.create(layer, urls, opts) —
     возвращённый контроллер {pause,resume,destroy} 90_runtime.js кладёт в
     LC.active.slideshow сразу (синхронно, до ответа сети: сам контроллер
     создаётся здесь же, ниже, ДО loadBackdrop()/showNoFrame();
     pause/resume/destroy на нём безопасны в любой момент — до activate()
     (ещё грузится первый кадр или режим не 'backdrop') это просто no-op,
     см. src/51_slideshow.js). urls считается ДЛЯ ЛЮБОГО режима (даже
     poster/procedural, где слайдшоу не активируется вовсе) — так
     LC.active.slideshow всегда валидный объект, а не undefined. На ранних
     return (нет body) и в catch — undefined, вызывающая сторона это уже
     проверяет через `if (LC.active.slideshow)`. */
  function apply(root, body, movie) {
    try {
      if (!body || !body.length) return;
      movie = movie || {};

      var mode = LC.cardinfo.bgMode(movie);

      if (root && root.length) {
        root.toggleClass('lumen-card--poster', mode === 'poster');
        if (mode === 'poster') ensurePosterLabel(root);
      }

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

      var layer = ensureLayer(body);
      /* Отменяем незавершённую загрузку ПРЕДЫДУЩЕГО apply() на этом же
         слое ДО того, как начнём новую (правки координатора, п.2), и
         останавливаем слайдшоу предыдущего вызова той же логикой (Task 6). */
      cancelPending(layer);
      stopSlideshow(layer);
      clearLayer(layer);
      var gen = nextGen(layer);

      var main = LC.cardinfo.backdropPath(movie);
      var max = LC.slideshow.maxFramesFor(LC.motionMode());
      var paths = pickBackdrops(movie.images, main, max);
      var urls = LC.util.map(paths, function (p) { return LC.cardinfo.imageUrl(p, 'w1280', tmdbImageFn(), apiImgFn()); });
      var slideshowOpts = { enabled: slideshowEnabled, intervalMs: slideIntervalMs };

      var controller = LC.slideshow.create(layer, urls, slideshowOpts);
      layer.data('lumenSlideshow', controller);
      /* Task 6 (fix, находка "мёртвое слайдшоу"): urls/opts сохраняются на
         слое отдельно от контроллера — если Lampa позже "оживит" этот же
         layer без нового apply() (см. revive() ниже и комментарий в
         90_runtime.js), их можно достать и пересобрать ротацию, не имея
         под рукой movie ещё раз. */
      layer.data('lumenUrls', urls);
      layer.data('lumenOpts', slideshowOpts);

      if (mode === 'backdrop') loadBackdrop(layer, movie, gen, controller);
      else showNoFrame(layer, movie);

      return controller;
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  /* Ревью Task 5b (правки координатора, п.4): хук закрытия карточки —
     90_runtime.js вызывает это на 'activity' destroy СВОЕЙ активности
     (LC.active), до того как Lampa уберёт DOM сама. Идемпотентен: повторный
     вызов на уже отменённом/отсутствующем слое ничего не делает.
     Task 6: тем же вызовом останавливаем и слайдшоу (иначе его
     setInterval пережил бы закрытие карточки — план 0.3, инвариант 5). */
  function cancel(body) {
    try {
      if (!body || !body.length) return;
      var layer = body.children('.lumen-backdrop');
      if (!layer.length) return;
      cancelPending(layer);
      stopSlideshow(layer);
    } catch (e) {
      warn('backdrop cancel failed', e);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Task 6: слайдшоу кадров.                                              */
  /* -------------------------------------------------------------------- */

  /* Шаг 1/2 (TDD): images — movie.images (может быть undefined), main —
     LC.cardinfo.backdropPath(movie) (главный кадр, всегда первым и без
     дублей), max — сколько кадров всего вернуть. Кадры с текстом/логотипом
     (iso_639_1 непустой) отбрасываются; из оставшихся сперва идут широкие
     (>= 1280 по width), затем по убыванию vote_average — так у "узких"
     дублей меньше шансов попасть в max. Правки координатора: тест ниже
     ожидает ['/main', '/c', '/a'] для эталонных данных (у /d ширина 800 —
     он в конце очереди и в max=3 не попадает) — логика функции не менялась
     относительно черновика Step 2, поправлено только ожидание теста. */
  function pickBackdrops(images, main, max) {
    var list = (images && images.backdrops) ? images.backdrops : [];
    var clean = LC.util.filter(list, function (b) { return b && b.file_path && !b.iso_639_1 && b.file_path !== main; });
    clean.sort(function (x, y) {
      var wx = (x.width || 0) >= 1280 ? 1 : 0, wy = (y.width || 0) >= 1280 ? 1 : 0;
      if (wx !== wy) return wy - wx;
      return (y.vote_average || 0) - (x.vote_average || 0);
    });
    var r = main ? [main] : [];
    LC.util.each(clean, function (b) { if (r.length < max) r.push(b.file_path); });
    return r;
  }

  /* Настройки Task 6 (src/80_settings.js): имена без префикса PLUGIN,
     как lumen_motion. lumen_slideshow — вкл/выкл по умолчанию вкл;
     lumen_slide_interval — '8'|'14'|'20' (секунды), по умолчанию '14'. */
  function slideshowEnabled() {
    return !!LC.pref('lumen_slideshow', true);
  }

  function slideIntervalMs() {
    var n = parseInt(LC.pref('lumen_slide_interval', '14'), 10);
    if (n !== 8 && n !== 14 && n !== 20) n = 14;
    return n * 1000;
  }

  /* Task 6, Ревью (симметрично stopSlideshow ниже): достаёт и уничтожает
     контроллер слайдшоу, привязанный к слою через layer.data
     ('lumenSlideshow') — общая точка входа и для apply() (гасит слайдшоу
     ПРЕДЫДУЩЕГО вызова на том же layer) и для cancel() (закрытие карточки). */
  function stopSlideshow(layer) {
    var s = layer.data('lumenSlideshow');
    if (s) { try { s.destroy(); } catch (e) { } }
    layer.removeData('lumenSlideshow');
  }

  /* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора): Lampa
     умеет тихо "убить" карточку, которая ушла на 2+ уровня в историю
     (ActivitySlide.stop() -> this.slide.remove(), БЕЗ единого события
     Listener) — наша страховка isLayerMounted() корректно ловит это на
     следующем тике и вызывает controller.destroy(). Но когда пользователь
     потом возвращается backward()-ом, Lampa у такой карточки переиспользует
     ТОТ ЖЕ DOM/ActivitySlide (start$4: is_stopped -> slides.append(render()))
     БЕЗ нового 'full':complite — то есть без нового apply(). 90_runtime.js
     (LC.onActivityEvent) находит слой, видит контроллер !isAlive() и зовёт
     сюда revive() вместо resume().

     Выбор между двумя вариантами из сообщения координатора:
       (A) повторить apply() целиком (тот же путь, что 'full':complite) —
           отклонено: на 'activity':'start' нет доступа к movie (это
           отдельное событие, e.object — запись стека активностей, а не
           объект/данные карточки; e.data.movie есть только в событии
           'full'). Кроме того, apply() -> clearLayer() снимает is-active
           с .lumen-backdrop__img (opacity:0 по CSS) ДО того, как новый
           controller.activate() отработает — гарантированная вспышка фона
           в пустоту на время нового цикла загрузки, даже с generation guard
           (тот спасает только от ДВОЙНОГО контроллера/лишней сетевой
           загрузки, не от самого сброса классов).
       (B) (выбрано) лёгкий LC.slideshow.create(layer, urls, opts) с urls/
           opts, сохранёнными в layer.data ещё исходным apply() — без
           повторного обращения к movie, без промежуточного opacity:0.
           Видимый сейчас кадр (может быть НЕ .lumen-backdrop__img, если
           ротация к моменту "убийства" успела провернуться дальше) остаётся
           на экране: его background-image переносится на
           .lumen-backdrop__img (канонический "нулевой" кадр нового
           контроллера — activate() его не перезагружает, просто помечает
           классами), .lumen-bg__slides очищается (не плодим дубликаты
           поверх кадров старого, уже мёртвого контроллера). Дальше
           ротация просто продолжает идти по тому же пулу urls — какой
           именно кадр окажется "следующим", пользователю не важно и не
           заметно.
     Отдельный generation guard (lumenGen) здесь не нужен: проверка
     isAlive() и создание нового контроллера происходят синхронно в одном
     вызове LC.onActivityEvent, без асинхронного окна для гонки (в отличие
     от варианта A, где новый apply() снова ждёт сеть). */
  function revive(layer) {
    try {
      var urls = layer.data('lumenUrls');
      if (!urls || !urls.length) return null;
      var opts = layer.data('lumenOpts');

      var img0 = layer.find('.lumen-backdrop__img');
      var activeFrame = layer.find('.lumen-bg__img.is-active');
      var activeBg = activeFrame.length ? activeFrame.css('background-image') : img0.css('background-image');
      if (activeBg) img0.css('background-image', activeBg);
      img0.addClass('lumen-bg__img is-active');
      layer.find('.lumen-bg__slides').empty();

      var controller = LC.slideshow.create(layer, urls, opts);
      layer.data('lumenSlideshow', controller);
      controller.activate();
      return controller;
    } catch (e) {
      warn('slideshow revive failed', e);
      return null;
    }
  }

  LC.backdrops = { apply: apply, cancel: cancel, pickBackdrops: pickBackdrops, revive: revive };

  /* В браузере "module" не определён — ветка не выполняется. Экспорт нужен
     только test/backdrops.test.mjs (Step 1, TDD pickBackdrops) через общий
     test/_load.mjs — остальные тесты этого файла грузят модуль своим
     загрузчиком (DOM-заглушки) и обращаются к LC.backdrops напрямую, им
     module.exports не требуется. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;


/* ---- 51_slideshow.js ---- */
  /* -------------------------------------------------------------------- */
  /* Слайдшоу кадров (Task 6, refactor — решение координатора): контроллер */
  /* вынесен из 50_backdrops.js в отдельный модуль, потому что Task 7      */
  /* (фоновый трейлер) будет ставить его на паузу/возобновлять извне так   */
  /* же, как 90_runtime.js уже делает это для archive/start (LC.active.    */
  /* slideshow.pause()/.resume()). Публично — LC.slideshow.create(layer,   */
  /* urls, opts) -> {activate, pause, resume, destroy}. urls — уже готовый */
  /* список URL кадров (LC.backdrops.pickBackdrops + LC.cardinfo.imageUrl, */
  /* посчитан заранее в 50_backdrops.js — этот модуль про TMDB/cardinfo не */
  /* знает вовсе). activate() — отдельный от create() шаг: 50_backdrops.js */
  /* вызывает его из finish(true) loadBackdrop(), т.е. когда первый кадр,  */
  /* .lumen-backdrop__img, уже реально загружен и показан (план: «не       */
  /* грузить его дважды») — сам create() ничего не грузит и не трогает DOM.*/
  /* pause/resume/destroy — контракт LC.active.slideshow из 90_runtime.js. */
  /* opts = {enabled: fn, intervalMs: fn} — 50_backdrops.js передаёт сюда   */
  /* чтения настроек lumen_slideshow/lumen_slide_interval, сам модуль про  */
  /* имена настроек не знает (вызывает их заново на каждый pause/resume/   */
  /* activate — так подхватываются изменения на уже открытой карточке).    */
  /* -------------------------------------------------------------------- */

  /* Task 6 (fix, решение координатора по live-check п.4): "пауза" слайдшоу
     при уходе вглубь карточки (Lampa.Activity.push поверх открытой) не
     детектируется через Lampa.Listener.follow('activity') — проверено
     исходником и живым логом (см. большой комментарий в 90_runtime.js над
     followActivityLifecycle): push ничего не шлёт для оставленной активности.
     Вместо подписки — проверка в каждом тике таймера, ДО предзагрузки
     следующего кадра (tryFrom ниже): если слой сейчас не на экране (лежит
     внутри архивной .activity без класса .activity--active), тик просто
     пропускается — ни Image(), ни смены is-active, — а сам таймер не
     трогаем: следующий тик проверит снова, и как только карточка опять на
     экране, смена кадров возобновится сама. isActivityForeground — чистая
     часть (только .length/.hasClass, без .closest()) — тестируется
     заглушками отдельно от DOM-обхода. */
  function isActivityForeground(activityEl) {
    if (!activityEl || !activityEl.length) return true; // не нашли контейнер — не блокируем (безопасный дефолт)
    return !!activityEl.hasClass('activity--active');
  }

  function isLayerForeground(layer) {
    try {
      return isActivityForeground(layer.closest('.activity'));
    } catch (e) {
      return true;
    }
  }

  /* Максимум кадров по режиму анимаций (план: full 8, lite 4, off 1 без
     смены) — off даёт вызывающей стороне max=1, т.е. только главный кадр,
     и сама возможность завести таймер ротации отпадает в create() ниже
     без отдельной проверки режима (urls.length <= 1). */
  function maxFramesFor(mode) {
    if (mode === 'off') return 1;
    if (mode === 'lite') return 4;
    return 8;
  }

  /* Тот же приём, что и в 50_backdrops.js (Task 5b Step 5): перед любой
     мутацией DOM после асинхронного ответа (Image().onload/onerror/таймер)
     — проверяем, что узел ещё в документе. Отдельная копия здесь (не
     импорт из 50_backdrops.js) — модуль не должен зависеть от порядка
     сборки файлов, а сама функция — одна строка. */
  function isNodeMounted(node) {
    try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
  }

  /* Длительность кроссфейда — должна совпадать с opacity-transition
     .lumen-bg__img в src/30_css.js (transition:opacity 1.2s ease-in-out).
     Используется дважды (fix, Important/Minor): чтобы не гасить
     background-image уходящего кадра раньше, чем он реально долетит до
     opacity:0 (память, п.3), и чтобы держать инлайн-transform (Ken Burns,
     п.4) ровно на время затухания. */
  var CROSSFADE_MS = 1200;

  /* Контроллер слайдшоу для ОДНОГО layer/apply(). Создаётся синхронно (до
     ответа сети) в неактивном состоянии — pause/resume/destroy безопасны
     сразу, но ничего не делают, пока activate() не вызван. activate()
     помечает первый кадр (.lumen-backdrop__img) классами lumen-bg__img/
     is-active (Ken Burns, Task 4/30_css.js) и, если opts.enabled() и есть
     больше одного кадра, заводит ротацию. Дальнейшие кадры — элементы
     .lumen-bg__img внутри .lumen-bg__slides, предзагружаются Image() и
     показываются только по onload; битый кадр (onerror) помечается false
     и пропускается — advance() пробует следующий по очереди, но не больше
     urls.length попыток за один тик (чтобы не зациклиться, если битые все).

     Task 6 (fix, п.3, Minor — память ТВ): в DOM с background-image держим
     только текущий кадр и уходящий (на время кроссфейда) — warm[i]
     отмечает, у какого frames[i] сейчас реально стоит background-image.
     Когда кадр перестаёт быть текущим/уходящим (через CROSSFADE_MS после
     смены), его background-image снимается и warm[i] сбрасывается; если
     очередь дойдёт до него снова, ensureFrame() увидит "холодный" элемент
     и переставит ту же строку url() заново — HTTP-кэш браузера делает это
     бесплатным (сеть уже не ходит, Image() второй раз не создаётся).

     Task 6 (fix, п.4, Minor — плавный Ken Burns): снятие is-active мгновенно
     останавливает CSS-анимацию lumen-kb, и transform уходящего кадра тут же
     прыгает обратно к scale(1) — заметный скачок посреди кроссфейда. Перед
     тем как снять is-active, читаем getComputedStyle(...).transform ПОКА
     анимация ещё идёт и фиксируем его инлайн-стилем на уходящем кадре —
     инлайн-стиль слабее активной CSS-анимации (просто не виден, пока она
     играет), поэтому это безопасно сделать заранее; как только is-active
     снят и анимация останавливается, инлайн-transform "подхватывает" её
     последнее значение вместо прыжка на scale(1). Через CROSSFADE_MS
     инлайн-transform снимается вместе с background-image. Только в
     lumen-motion-full — там же, где вообще играет Ken Burns (30_css.js:
     .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active). */
  function create(layer, urls, opts) {
    opts = opts || {};
    var enabledFn = typeof opts.enabled === 'function' ? opts.enabled : function () { return true; };
    var intervalFn = typeof opts.intervalMs === 'function' ? opts.intervalMs : function () { return 14000; };

    var alive = true;
    var paused = false;
    var timer = null;
    var pendingLoader = null;
    var frames = null;   // null, пока activate() не вызван
    var warm = null;     // warm[i] === true, если у frames[i] сейчас стоит background-image
    var activeIdx = -1;
    var idx = 0;
    var lastFrameEl = null;
    var cleanupTimer = null;

    function isLayerMounted() {
      return isNodeMounted(layer[0]);
    }

    function stopTimer() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function stopCleanupTimer() {
      if (cleanupTimer) { clearTimeout(cleanupTimer); cleanupTimer = null; }
    }

    /* Снимает background-image и (если был) инлайн-transform с кадра,
       который уже CROSSFADE_MS как не активен и не уходящий. */
    function coolDown(i, el) {
      try {
        el.css('transform', '');
        el.css('background-image', '');
      } catch (e) { }
      warm[i] = false;
    }

    function scheduleCoolDown(i, el) {
      stopCleanupTimer(); // переходы редки (минимум 8с) — одного отложенного таймера достаточно
      cleanupTimer = setTimeout(function () {
        cleanupTimer = null;
        coolDown(i, el);
      }, CROSSFADE_MS);
    }

    function setActive(i) {
      var prevIdx = activeIdx;
      var prevEl = (prevIdx !== -1 && frames[prevIdx]) ? frames[prevIdx] : null;

      /* Заморозка Ken Burns — ДО снятия is-active, пока анимация ещё
         реально играет (иначе getComputedStyle уже вернёт то, что после
         остановки анимации, то есть scale(1)). */
      if (prevEl && prevIdx !== i) {
        try {
          if (LC.motionMode() === 'full' && window.getComputedStyle) {
            var cs = window.getComputedStyle(prevEl[0]);
            var t = cs && cs.transform;
            if (t && t !== 'none') prevEl.css('transform', t);
          }
        } catch (e) { }
      }

      for (var k = 0; k < frames.length; k++) {
        if (frames[k]) frames[k].toggleClass('is-active', k === i);
      }

      if (prevEl && prevIdx !== i) scheduleCoolDown(prevIdx, prevEl);
      activeIdx = i;
    }

    function ensureFrame(i, cb) {
      if (frames[i] === false) { cb(null); return; }
      if (frames[i]) {
        /* Кадр уже создавался раньше, но остыл (память, п.3) — url() тот
           же, повторная установка ничего не грузит из сети (HTTP-кэш). */
        if (!warm[i]) {
          try { frames[i].css('background-image', 'url("' + encodeURI(urls[i]) + '")'); warm[i] = true; } catch (e) { }
        }
        cb(frames[i]);
        return;
      }
      var url = urls[i];
      if (!url) { frames[i] = false; cb(null); return; }
      var loader = new Image();
      pendingLoader = loader;
      loader.onload = function () {
        if (pendingLoader !== loader) return;
        pendingLoader = null;
        if (!alive || !isLayerMounted()) return;
        try {
          var el = $('<div class="lumen-bg__img"></div>');
          el.css('background-image', 'url("' + encodeURI(url) + '")');
          layer.find('.lumen-bg__slides').append(el);
          lastFrameEl = el;
          frames[i] = el;
          warm[i] = true;
          cb(el);
        } catch (e) {
          warn('slideshow frame failed', e);
          frames[i] = false;
          cb(null);
        }
      };
      loader.onerror = function () {
        if (pendingLoader !== loader) return;
        pendingLoader = null;
        frames[i] = false;
        cb(null);
      };
      loader.src = url;
    }

    /* offset растёт при каждом битом кадре в рамках одного тика (план:
       «битый — пропускается»); offset > urls.length — все кандидаты уже
       перепробованы в этот тик, остаёмся на текущем кадре до следующего. */
    function tryFrom(offset) {
      if (!alive || paused || !frames) return;
      if (!isLayerMounted()) { destroy(); return; }
      /* Карточка сейчас не на экране (открыта другая активность поверх) —
         пропускаем тик целиком: ни Image() для следующего кадра, ни смены
         is-active. Таймер не трогаем — следующий тик проверит заново. */
      if (!isLayerForeground(layer)) return;
      if (offset > urls.length) return;
      var next = (idx + offset) % urls.length;
      ensureFrame(next, function (el) {
        if (!alive || paused || !frames) return;
        if (!isLayerMounted()) { destroy(); return; }
        if (!el) { tryFrom(offset + 1); return; }
        idx = next;
        setActive(idx);
      });
    }

    function advance() { tryFrom(1); }

    function startTimer() {
      if (timer || !frames || urls.length <= 1) return;
      timer = setInterval(advance, intervalFn());
    }

    function activate() {
      if (!alive || frames) return; // уже активирован
      try {
        frames = [];
        warm = [];
        var firstNode = layer.find('.lumen-backdrop__img');
        firstNode.addClass('lumen-bg__img is-active');
        frames[0] = firstNode;
        warm[0] = true; // background-image первого кадра уже стоит — его поставил 50_backdrops.js до activate()
        lastFrameEl = firstNode;
        idx = 0;
        activeIdx = 0;
        if (enabledFn() && !paused) startTimer();
      } catch (e) {
        warn('slideshow activate failed', e);
      }
    }

    function destroy() {
      alive = false;
      stopTimer();
      stopCleanupTimer();
      if (pendingLoader) { pendingLoader.onload = null; pendingLoader.onerror = null; pendingLoader = null; }
    }

    return {
      activate: activate,
      /* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора):
         публичный признак жизни — без него снаружи (90_runtime.js) пришлось
         бы читать внутреннее поле контроллера напрямую, чтобы понять, можно
         ли ещё resume() или пора пересоздавать (LC.backdrops.revive). */
      isAlive: function () { return alive; },
      /* archive своей активности (или resume-по-факту, см. 90_runtime.js)
         — ставит на паузу текущий кадр, не сбрасывая его. */
      pause: function () { paused = true; stopTimer(); },
      /* start своей активности, а также включение lumen_slideshow / смена
         lumen_slide_interval на открытой карточке (90_runtime.js
         LC.applySlideshowPref вызывает pause()+resume() на каждое
         изменение — resume() всегда читает opts.intervalMs()/opts.
         enabled() заново, поэтому подхватывает и новый интервал). */
      resume: function () {
        paused = false;
        if (alive && frames && enabledFn()) startTimer();
      },
      destroy: destroy
    };
  }

  LC.slideshow = {
    create: create,
    isActivityForeground: isActivityForeground,
    isLayerForeground: isLayerForeground,
    maxFramesFor: maxFramesFor
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.slideshow;


/* ---- 70_progress.js ---- */
  /* -------------------------------------------------------------------- */
  /* Прогресс просмотра.                                                   */
  /* view/hash — функции-обёртки, передаются параметрами (в рантайме это    */
  /* обёртки над Lampa.Timeline.view и Lampa.Utils.hash), поэтому модуль    */
  /* не зависит от window/Lampa и проверяется тестами без браузера.         */
  /* -------------------------------------------------------------------- */

  LC.progress = (function () {
    function movieProgress(movie, view, hash) {
      var key = movie.original_title || movie.original_name || movie.title || movie.name;
      if (!key) return null;
      var v = view(hash(key));
      if (v && v.percent > 0) return { view: v, season: 0, episode: 0 };
      return null;
    }

    function serialProgress(movie, view, hash) {
      var key = movie.original_name || movie.original_title || movie.name || movie.title;
      if (!key) return null;

      var maxSeason = parseInt(movie.number_of_seasons, 10) || 1;
      if (maxSeason > 10) maxSeason = 10;
      if (maxSeason < 1) maxSeason = 1;

      var best = null;
      for (var s = 1; s <= maxSeason; s++) {
        for (var ep = 1; ep <= 30; ep++) {
          var h = hash([s, s > 10 ? ':' : '', ep, key].join(''));
          var v = view(h);
          if (v && v.percent > 0) {
            if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
              best = { view: v, season: s, episode: ep };
            }
          }
        }
      }
      return best;
    }

    return {
      movieProgress: movieProgress,
      serialProgress: serialProgress
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;


/* ---- 80_settings.js ---- */
  /* -------------------------------------------------------------------- */
  /* Настройки и локализация.                                             */
  /* -------------------------------------------------------------------- */

  LC.STRINGS = {
    lumen_card_title: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
    lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
    lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
    lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
    lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
    lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },
    lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
    lumen_card_fonts_descr: {
      ru: 'Unbounded / Golos Text / JetBrains Mono. Требуется интернет. Выключите, если шрифты не грузятся.',
      en: 'Unbounded / Golos Text / JetBrains Mono. Requires internet access.',
      uk: 'Unbounded / Golos Text / JetBrains Mono. Потрібен інтернет.'
    },
    lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },
    lumen_card_cast_name: { ru: 'Показывать актёров', en: 'Show cast', uk: 'Показувати акторів' },
    lumen_card_motion: { ru: 'Анимации', en: 'Animations', uk: 'Анімації' },
    lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
    lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
    lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    lumen_card_continue: { ru: 'ПРОДОЛЖИТЬ', en: 'CONTINUE', uk: 'ПРОДОВЖИТИ' },
    lumen_card_cast: { ru: 'В ролях', en: 'Cast', uk: 'У ролях' },
    lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
    lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' },
    lumen_card_director: { ru: 'реж.', en: 'dir.', uk: 'реж.' },
    lumen_card_status_soon: { ru: 'Анонс', en: 'Announced', uk: 'Анонс' },
    lumen_card_reactions: { ru: 'РЕАКЦИЙ', en: 'REACTIONS', uk: 'РЕАКЦІЙ' },
    lumen_card_slideshow_name: { ru: 'Слайдшоу кадров', en: 'Backdrop slideshow', uk: 'Слайдшоу кадрів' },
    lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
    lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' }
  };

  function langCode() {
    var code = 'ru';
    try {
      if (window.Lampa && Lampa.Storage) {
        code = Lampa.Storage.get('language', 'ru') || 'ru';
      }
    } catch (e) { }
    return ('' + code).toLowerCase().slice(0, 2);
  }

  function isSlavic() {
    var c = langCode();
    return c === 'ru' || c === 'uk' || c === 'be' || c === 'bg';
  }

  LC.seasonsWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['сезон', 'сезона', 'сезонов']);
    return n === 1 ? 'season' : 'seasons';
  };

  LC.episodesWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['серия', 'серии', 'серий']);
    return n === 1 ? 'episode' : 'episodes';
  };

  /* Читает настройку плагина из Lampa.Storage с нормализацией булевых. */
  LC.pref = function (name, def) {
    var value;
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
        value = Lampa.Storage.get(name, def);
      }
    } catch (e) {
      warn('storage read failed: ' + name, e);
    }
    if (typeof value === 'undefined' || value === null || value === '') return def;
    if (typeof def === 'boolean') {
      if (value === 'true' || value === true || value === 1 || value === '1') return true;
      if (value === 'false' || value === false || value === 0 || value === '0') return false;
      return def;
    }
    return value;
  };

  LC.lang = function (key) {
    try {
      if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
        var out = Lampa.Lang.translate(key);
        if (out && out !== key) return out;
      }
    } catch (e) { }
    var pack = LC.STRINGS[key];
    if (!pack) return key;
    return pack[langCode()] || pack.ru || key;
  };

  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 15h20"/><circle cx="7" cy="9" r="2"/></svg>';

  LC.addSettings = function () {
    try {
      if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return;

      Lampa.SettingsApi.addComponent({
        component: PLUGIN,
        icon: ICON,
        name: LC.lang('lumen_card_title')
      });

      var accentValues = {
        sand: LC.lang('lumen_card_accent_sand'),
        ice: LC.lang('lumen_card_accent_ice'),
        wine: LC.lang('lumen_card_accent_wine'),
        mint: LC.lang('lumen_card_accent_mint')
      };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_accent', type: 'select', values: accentValues, 'default': 'sand' },
        field: { name: LC.lang('lumen_card_accent') },
        onChange: function () { LC.injectCss(); }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_fonts', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_fonts_name'), description: LC.lang('lumen_card_fonts_descr') },
        onChange: function () { LC.injectFonts(); LC.injectCss(); }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_progress', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_progress_name') }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_cast', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_cast_name') }
      });

      var motionValues = {
        auto: LC.lang('lumen_card_motion_auto'),
        full: LC.lang('lumen_card_motion_full'),
        lite: LC.lang('lumen_card_motion_lite'),
        off: LC.lang('lumen_card_motion_off')
      };

      /* Имя параметра — 'lumen_motion' (без префикса lumen_card_): так задано планом Task 4
         (Lampa.Storage.field('lumen_motion') в LC.motionMode). LC.followStorage ниже подписан
         на него отдельной веткой, вне общего префиксного фильтра PLUGIN + '_'. */
      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_motion', type: 'select', values: motionValues, 'default': 'auto' },
        field: { name: LC.lang('lumen_card_motion') },
        onChange: function () { LC.applyMotionMode(); }
      });

      /* Task 6: имена без префикса PLUGIN, как у lumen_motion выше —
         LC.followStorage подписан на них отдельной веткой, вне общего
         префиксного фильтра PLUGIN + '_'. onChange у обоих — одна и та же
         LC.applySlideshowPref (90_runtime.js): и выключение, и смена
         интервала на уже открытой карточке идут через pause()+resume()
         контроллера слайдшоу. */
      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_slideshow', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_slideshow_name') },
        onChange: function () { LC.applySlideshowPref(); }
      });

      var seconds = LC.lang('lumen_card_seconds');
      var intervalValues = { '8': '8 ' + seconds, '14': '14 ' + seconds, '20': '20 ' + seconds };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_slide_interval', type: 'select', values: intervalValues, 'default': '14' },
        field: { name: LC.lang('lumen_card_slide_interval') },
        onChange: function () { LC.applySlideshowPref(); }
      });
    } catch (e) {
      warn('settings failed', e);
    }
  };

  LC.followStorage = function () {
    try {
      if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
      Lampa.Storage.listener.follow('change', function (e) {
        if (!e || !e.name) return;
        if (e.name === 'lumen_motion') { LC.applyMotionMode(); return; }
        if (e.name === 'lumen_slideshow' || e.name === 'lumen_slide_interval') { LC.applySlideshowPref(); return; }
        if (e.name.indexOf(PLUGIN + '_') !== 0) return;
        if (e.name === PLUGIN + '_fonts') LC.injectFonts();
        LC.injectCss();
      });
    } catch (err) {
      warn('storage listener failed', err);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Task 4: режим анимаций. Чистая логика выбора — тестируется отдельно   */
  /* от Lampa (test/settings.test.mjs); применение класса на DOM карточки  */
  /* живёт в 90_runtime.js (LC.applyMotionMode ссылается сюда извне).      */
  /* -------------------------------------------------------------------- */

  /* stored — сырое значение параметра lumen_motion ('auto'|'full'|'lite'|'off'),
     platform — {tizen:bool, webos:bool}. Не 'auto' -> как есть; 'auto' на tizen/webos -> 'lite',
     иначе 'full'. Любое незнакомое значение (undefined/null/''/мусор — например, старый профиль
     без этого ключа или битое значение в Storage) считается как 'auto', а не возвращается как есть. */
  LC.motionModeFor = function (stored, platform) {
    if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
    if (stored !== 'auto') return stored;
    platform = platform || {};
    if (platform.tizen || platform.webos) return 'lite';
    return 'full';
  };

  LC.motionMode = function () {
    var stored = 'auto';
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_motion');
    } catch (e) { }
    var platform = { tizen: false, webos: false };
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
        platform.tizen = !!Lampa.Platform.is('tizen');
        platform.webos = !!Lampa.Platform.is('webos');
      }
    } catch (e2) { }
    return LC.motionModeFor(stored, platform);
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.motionModeFor;


/* ---- 85_header.js ---- */
  /* -------------------------------------------------------------------- */
  /* Отрисовка шапки карточки (Task 5a, рефакторинг). Выделено из            */
  /* 90_runtime.js — тот вырос и смешивал данные карточки, обёртки Lampa,   */
  /* фон, восемь render* шапки, decorate/findRoot, раскладку, motion,       */
  /* toggle, init/boot. Чистая логика данных (isSerial/genres/pgText и      */
  /* остальные хелперы cardinfo) — в 35_cardinfo.js с тестами; здесь только */
  /* сборка DOM+Lampa вокруг неё. Публично наружу — только LC.header.decorate, */
  /* её вызывает Listener 'full' в 90_runtime.js на build/complite.          */
  /* -------------------------------------------------------------------- */

  var isSerial = LC.cardinfo.isSerial;

  function capitalize(str) {
    str = '' + (str || '');
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
        return Lampa.Utils.capitalizeFirstLetter(str);
      }
    } catch (e) { }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getGenres(movie) {
    return LC.cardinfo.genres(movie && movie.genres, capitalize);
  }

  function getPG(movie, root) {
    var parsed = '';
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parsePG === 'function') parsed = Lampa.TMDB.parsePG(movie);
    } catch (e) { }
    var domText = '';
    if (root) {
      try {
        var node = root.find('.full-start__pg');
        if (node.length) domText = node.text();
      } catch (e2) { }
    }
    return LC.cardinfo.pgText(parsed, domText);
  }

  /* Task 5a Step 4: чип «РЕАКЦИЙ» показывается, только если пользователь не
     выключил блок реакций Lampa (та же настройка, что скрывает штатный
     .full-start-new__reactions/.button--reaction — 0.2 «Реакции CUB»). */
  function reactionsEnabled() {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
        return !!Lampa.Storage.field('card_interfice_reactions');
      }
    } catch (e) { }
    return false;
  }

  function bigNumber(n) {
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.bigNumberToShort === 'function') return Lampa.Utils.bigNumberToShort(n);
    } catch (e) { }
    return '' + n;
  }

  /* -------------------------------------------------------------------- */
  /* Прогресс: обёртки над Lampa.Timeline.view / Lampa.Utils.hash,          */
  /* передаются параметрами в чистые LC.progress.movieProgress/serialProgress. */
  /* -------------------------------------------------------------------- */

  function timelineView(hash) {
    try {
      if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.view === 'function') return Lampa.Timeline.view(hash);
    } catch (e) { }
    return null;
  }

  function utilsHash(str) {
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.hash === 'function') return Lampa.Utils.hash(str);
    } catch (e) { }
    return 0;
  }

  /* -------------------------------------------------------------------- */
  /* Отрисовка карточки.                                                   */
  /* -------------------------------------------------------------------- */

  /* Task 5a Step 3b.2/3b.4: мета-строка — год · страна · хронометраж/сезоны ·
     жанры · 18+ · «реж. Имя» (у сериала режиссёр не показывается — там вместо
     него в строке оригинального названия стоит создатель, см. renderOriginal).
     Инлайн-чип качества/«СЕРИАЛ» из v1 убран — лишний узел, дизайну не
     соответствует (design-spec-card.md §2); раздельные чипы качества теперь
     в боковой колонке (renderQualityChips). */
  function renderMeta(root, movie, data) {
    var parts = [];
    var serial = isSerial(movie);

    var release = (movie.release_date || movie.first_air_date || '') + '';
    var year = release ? release.slice(0, 4) : '';
    if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');

    /* Штатный .full-start-new__head заполняется Lampa (start.js) ДО complite
       форматом «2024, США» — cardinfo.country сам отрезает год и падает на
       словарь ISO/английское имя, если head пуст (план 0.2, Task 5 3b.2). */
    var headText = root.find('.full-start-new__head').text();
    var countryText = LC.cardinfo.country(headText, movie.production_countries);
    if (countryText) parts.push('<span>' + LC.util.esc(countryText) + '</span>');

    if (serial) {
      var counts = [];
      if (movie.number_of_seasons) counts.push(movie.number_of_seasons + ' ' + LC.seasonsWord(movie.number_of_seasons));
      if (movie.number_of_episodes) counts.push(movie.number_of_episodes + ' ' + LC.episodesWord(movie.number_of_episodes));
      if (counts.length) parts.push('<span>' + LC.util.esc(counts.join(' · ')) + '</span>');
    } else if (movie.runtime > 0) {
      parts.push('<span>' + LC.util.esc(LC.util.fmtRuntime(movie.runtime, LC.lang('lumen_card_min'))) + '</span>');
    }

    var genres = getGenres(movie);
    if (genres.length) parts.push('<span>' + LC.util.esc(genres.join(', ')) + '</span>');

    var pg = getPG(movie, root);
    if (pg) parts.push('<span>' + LC.util.esc(pg) + '</span>');

    if (!serial) {
      var director = LC.cardinfo.director(data && data.persons && data.persons.crew);
      if (director) parts.push('<span>' + LC.util.esc(LC.lang('lumen_card_director')) + ' ' + LC.util.esc(director) + '</span>');
    }

    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i) html.push('<span class="lumen-meta__sep">·</span>');
      html.push(parts[i]);
    }

    root.find('.lumen-meta').html(html.join(''));
    root.addClass('lumen--meta');
  }

  /* Task 5a Step 3b.4: у сериала вместо режиссёра — created_by[0].name рядом
     с оригинальным названием («Fallout · Джонатан Нолан», экран 05). */
  function renderOriginal(root, movie) {
    var title = movie.title || movie.name || '';
    var original = movie.original_title || movie.original_name || '';
    var node = root.find('.lumen-original');
    if (!node.length) return;

    var text = (!original || original === title) ? '' : original;

    if (isSerial(movie)) {
      var creator = LC.cardinfo.creator(movie);
      if (creator) text = text ? (text + ' · ' + creator) : creator;
    }

    node.text(text);
  }

  /* Task 5a Step 3/3b: заголовок целиком — .lumen-title--long при длине > 18
     символов (класс переключает line-clamp 1 -> 2 в CSS, см. design-spec §3). */
  function renderTitleClass(root, movie) {
    var node = root.find('.full-start-new__title');
    if (!node.length) return;
    var title = movie.title || movie.name || '';
    node.removeClass('lumen-title--long');
    var cls = LC.cardinfo.titleClass(title);
    if (cls) node.addClass(cls);
  }

  /* Task 5a Step 3: статус -> точка/подпись (кегль дизайна, только точка
     красится — текст всегда нейтральный, кроме 'soon', где подписи Lampa
     нет вовсе и мы её подставляем сами: «Анонс»). */
  function renderStatus(root, movie) {
    var node = root.find('.full-start__status');
    if (!node.length) return;

    node.removeClass('lumen-status--good lumen-status--accent lumen-status--muted lumen-status--soon');

    var kind = LC.cardinfo.statusKind(movie.status);
    node.addClass('lumen-status--' + kind);

    if (kind === 'soon') node.text(LC.lang('lumen_card_status_soon'));
  }

  /* Task 5a Step 3/3b: чип «РЕАКЦИЙ» — счётчик fire (CUB), скрыт без данных
     и при выключенном card_interfice_reactions (0.2 «Реакции CUB»). */
  function renderReactionsChip(root, data) {
    var chip = root.find('.lumen-reactions-chip');
    if (!chip.length) return;

    chip.addClass('hide');
    var count = LC.cardinfo.reactionsCount(data && data.reactions && data.reactions.result);
    if (!count || !reactionsEnabled()) return;

    chip.find('.lumen-reactions-chip__value').text(bigNumber(count));
    chip.find('.lumen-reactions-chip__label').text(LC.lang('lumen_card_reactions'));
    chip.removeClass('hide');
  }

  /* Task 5a Step 3/4: раздельные чипы качества (4K/HDR/BD) в боковой колонке
     вместо одного составного tag--quality (design-spec §5c). Штатный узел
     tag--quality остаётся в разметке (Lampa пишет в него), но всегда скрыт —
     видимые чипы рисуем сами по cardinfo.qualityChips. */
  function renderQualityChips(root, movie) {
    var holder = root.find('.lumen-tags');
    if (!holder.length) return;

    holder.find('.lumen-quality-chip').remove();
    if (isSerial(movie)) return;

    var chips = LC.cardinfo.qualityChips(movie.release_quality || movie.quality);
    var html = [];
    for (var i = 0; i < chips.length; i++) html.push('<div class="lumen-quality-chip">' + LC.util.esc(chips[i]) + '</div>');
    if (html.length) holder.append(html.join(''));
  }

  function renderProgress(root, movie) {
    var row = root.find('.lumen-progress');
    if (!row.length) return;

    row.addClass('hide');
    if (!LC.pref(PLUGIN + '_progress', true)) return;

    var found = isSerial(movie)
      ? LC.progress.serialProgress(movie, timelineView, utilsHash)
      : LC.progress.movieProgress(movie, timelineView, utilsHash);
    if (!found || !found.view || !(found.view.percent > 0)) return;

    var percent = Math.max(0, Math.min(100, Math.round(found.view.percent)));
    var label = LC.lang('lumen_card_continue');
    if (found.season) label += ' · S' + found.season + ' E' + found.episode;

    var time = '';
    if (found.view.duration > 0) time = LC.util.fmtTime(found.view.time) + ' / ' + LC.util.fmtTime(found.view.duration);
    else if (found.view.time > 0) time = LC.util.fmtTime(found.view.time);
    else time = percent + '%';

    row.find('.lumen-progress__label').text(label);
    row.find('.lumen-progress__time').text(time);
    row.find('.lumen-progress__bar > div').css('width', percent + '%');
    row.removeClass('hide');
  }

  function renderCast(root, data) {
    var block = root.find('.lumen-cast');
    if (!block.length) return;

    block.addClass('hide');
    block.find('.lumen-cast__row').empty();

    if (!LC.pref(PLUGIN + '_cast', true)) return;

    var cast = data && data.persons && data.persons.cast;
    if (!cast || !cast.length) return;

    var html = [];
    var limit = Math.min(5, cast.length);
    for (var i = 0; i < limit; i++) {
      html.push('<div class="lumen-cast__item">' + LC.util.esc(LC.util.initials(cast[i] && cast[i].name)) + '</div>');
    }
    if (cast.length > limit) {
      html.push('<div class="lumen-cast__item lumen-cast__more">+' + (cast.length - limit) + '</div>');
    }

    block.find('.lumen-cast__label').text(LC.lang('lumen_card_cast'));
    block.find('.lumen-cast__row').html(html.join(''));
    block.removeClass('hide');
  }

  function decorate(root, data) {
    if (!root || !root.length) return;
    if (!root.hasClass('lumen-card')) return;

    var movie = (data && data.movie) || {};

    try { renderTitleClass(root, movie); } catch (e) { warn('title failed', e); }
    try { renderMeta(root, movie, data); } catch (e) { warn('meta failed', e); }
    try { renderOriginal(root, movie); } catch (e) { warn('original failed', e); }
    try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
    try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
    try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
    try { renderProgress(root, movie); } catch (e) { warn('progress failed', e); }
    try { renderCast(root, data); } catch (e) { warn('cast failed', e); }
  }

  LC.header = { decorate: decorate };


/* ---- 90_runtime.js ---- */
  /* -------------------------------------------------------------------- */
  /* Поиск корня карточки в событии 'full' (build/complite).                */
  /* -------------------------------------------------------------------- */

  function findRoot(e) {
    var root = null;
    try {
      if (e.item && typeof e.item.render === 'function') {
        var html = e.item.render();
        if (html && html.hasClass && html.hasClass('full-start-new')) root = html;
      }
    } catch (err) { }
    if ((!root || !root.length) && e.body && e.body.find) {
      try { root = e.body.find('.full-start-new.lumen-card').eq(0); } catch (err2) { }
    }
    return root;
  }

  /* -------------------------------------------------------------------- */
  /* Раскладка.                                                            */
  /* -------------------------------------------------------------------- */

  function isWideLayout() {
    var width = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    if (width && width <= 480) return false;
    var tv = false;
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') tv = !!Lampa.Platform.screen('tv');
    } catch (e) { }
    return tv || width > 480;
  }

  /* -------------------------------------------------------------------- */
  /* Task 4: режим анимаций и компактная шапка.                            */
  /* -------------------------------------------------------------------- */

  var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';

  function activeCardRoot() {
    try { return $('.activity--active .lumen-card'); } catch (e) { return null; }
  }

  function applyMotionMode(root) {
    if (!root || !root.length) return;
    try {
      root.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
    } catch (e) {
      warn('motion mode failed', e);
    }
  }

  /* Вызывается извне (LC.followStorage / onChange параметра lumen_motion), когда режим
     меняется на уже открытой карточке — находит активный корень сама. */
  LC.applyMotionMode = function () {
    applyMotionMode(activeCardRoot());
  };

  var toggle_followed = false;

  /* Одна подписка на переключение контроллера за всё время жизни плагина (не на карточку):
     спуск с кнопок на ряд описания/серий сжимает шапку, подъём обратно на кнопки — возвращает.
     Task 7 добавит сюда же остановку трейлера. */
  function followToggle() {
    if (toggle_followed) return;
    toggle_followed = true;
    try {
      if (!window.Lampa || !Lampa.Controller || !Lampa.Controller.listener) return;
      Lampa.Controller.listener.follow('toggle', function (e) {
        try {
          if (!e || !e.name) return;
          var root = activeCardRoot();
          if (!root || !root.length) return;
          if (e.name === 'full_descr' || e.name === 'items_line') root.addClass('lumen-compact');
          else if (e.name === 'full_start') root.removeClass('lumen-compact');
        } catch (err) {
          warn('controller toggle failed', err);
        }
      });
    } catch (e2) {
      warn('controller listener failed', e2);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Task 5b (правки координатора, п.4): хук закрытия карточки.             */
  /* -------------------------------------------------------------------- */

  /* Активность открытой карточки — {object, body, slideshow} с события
     'full' complite. Одно значение, не стек: если вторая карточка
     открылась раньше, чем destroy первой дошёл до слушателя, LC.active уже
     указывает на вторую — destroy первой тогда просто пропускается (её
     слой всё равно самоочистится через isMounted() в 50_backdrops.js, это
     лишь более раннее/явное закрытие для типичного случая). slideshow —
     контроллер {pause,resume,destroy} из LC.backdrops.apply() (Task 6). */
  LC.active = null;

  var activity_followed = false;

  /* Достаёт .lumen-backdrop из e.object.activity.render() той активности,
     о которой пришло событие (любой 'full', не обязательно LC.active).

     Проверено живьём: e.object.activity.render() возвращает ВНЕШНИЙ
     .activity-контейнер (class="activity layer--width…"), а не e.body из
     события 'full' — .lumen-backdrop лежит на уровень глубже, внутри
     .activity__body (прямой потомок .activity), поэтому
     .children('.lumen-backdrop') здесь мимо (нашёл это именно так:
     .children дал 0, .find — 1). Ищем через find() (любая глубина); тело,
     в которое LC.backdrops.apply()/ensureLayer() когда-то сделал
     body.prepend(layer), — это layer.parent(), так что
     LC.backdrops.cancel(layer.parent()) снова найдёт слой через свой
     body.children(...). Возвращает layer (length может быть 0) или null,
     если у e.object вообще нет activity.render(). */
  function layerOf(object) {
    try {
      if (!object || !object.activity || typeof object.activity.render !== 'function') return null;
      var rendered = object.activity.render();
      return rendered && rendered.find ? rendered.find('.lumen-backdrop') : null;
    } catch (e) {
      return null;
    }
  }

  /* Единственный обработчик подписки 'activity' за всё время жизни
     плагина (правки координатора к Task 6: вторую подписку не заводить).
     Вынесен в именованную LC.onActivityEvent — LC.init() только подписывает
     её (followActivityLifecycle ниже), а test/runtime.test.mjs вызывает её
     напрямую с фейковыми e/Lampa/$, без реальной Lampa.

     Реальные события Lampa 3.3.4 при push/backward (проверено исходником
     vendor/lampa/app.min.js — функции push$3/backward()/start$4 — и живым
     логом Lampa.Listener.follow('activity', …) до/после вызовов):
       - Activity.push(новая карточка) — уход вглубь — НЕ шлёт вообще
         никакого события для карточки, которую оставляют позади (ни
         archive, ни pause/stop). Она просто продолжает жить в стеке.
       - Activity.push тому, кто открывается, шлёт init -> create -> start
         (e.component — реальное имя компонента, у карточки — 'full';
         проверено логом).
       - backward() шлёт destroy для покидаемой активности и, для той,
         К КОТОРОЙ ВОЗВРАЩАЮТСЯ, — start$4() уже шлёт start, а следом сама
         backward() шлёт ЕЩЁ и archive (тот же e.object). То есть archive
         в этой сборке означает «снова на экране», а не «ушли в фон» —
         обратное плановому предположению archive->pause.
     Отсюда следствия (решение координатора по live-check п.4 и fix-раунду):
       1) «Пауза при уходе вглубь» через эту подписку недостижима (push
          ничего не шлёт для оставленной активности) — реализована не
          здесь, а проверкой isLayerForeground() в каждом тике таймера
          слайдшоу (src/51_slideshow.js, tryFrom): если слой сейчас не в
          .activity.activity--active, тик молча пропускается, таймер не
          трогаем — как заново на экране, тик снова меняет кадр.
       2) 'start' и 'archive' СВОЕЙ активности (LC.active уже указывает на
          неё) — оба означают «видна снова» -> resume() (resume() дважды
          безопасен).
       3) Возврат backward() на карточку, которая уже не LC.active (за это
          время открылась и была complite-нута другая) — LC.active так и
          не восстанавливается событием 'full' (Lampa не шлёт complite
          повторно на backward, только 'activity':start/archive). Поэтому
          на 'start' ЛЮБОЙ 'full'-активности, если это не текущая
          LC.active, ищем в её DOM уже готовый слой .lumen-backdrop
          (значит, карточка уже строилась раньше) и восстанавливаем
          LC.active по нему — контроллер слайдшоу достаём из
          layer.data('lumenSlideshow') (положен туда LC.backdrops.apply()),
          а не храним отдельно, поэтому найти его можно в любой момент.
       4) Осиротевшие карточки (fix, Important): в цепочке A -> B -> C
          (LC.active уже C) 'destroy' карточки A или B (Lampa шлёт его при
          вытеснении по лимиту истории maxsave, не только на backward())
          не совпадает ни с одной веткой выше — но если у A/B уже есть
          .lumen-backdrop, её таймер иначе тикал бы до СЛЕДУЮЩЕГО своего
          интервала, когда isLayerMounted() сам заметит пропавший DOM
          (secondhand self-heal, уже был в fix #1). Здесь — немедленно:
          destroy ЛЮБОЙ (не только LC.active) активности с готовым слоем ->
          LC.backdrops.cancel(layer.parent()) сразу же. */
  LC.onActivityEvent = function (e) {
    try {
      if (!e) return;

      if (LC.active && e.object === LC.active.object) {
        if (e.type === 'destroy') {
          LC.backdrops.cancel(LC.active.body);
          LC.active = null;
        } else if (e.type === 'archive' || e.type === 'start') {
          if (LC.active.slideshow) LC.active.slideshow.resume();
        }
        return;
      }

      if (e.type === 'destroy') {
        var orphanLayer = layerOf(e.object);
        if (orphanLayer && orphanLayer.length) LC.backdrops.cancel(orphanLayer.parent());
        return;
      }

      /* e.object !== LC.active.object (или LC.active вовсе null): для
         свежей, ещё не построенной карточки слоя нет — layerOf() вернёт
         пустой/null, ветка тихо no-op (нормальный путь на самый первый
         'start' любого push, ДО того как 'full' complite впервые выставит
         LC.active). Для карточки, к которой вернулись через backward(),
         слой уже есть — восстанавливаем LC.active.

         Находка (fix, решение координатора): у Lampa есть свой механизм
         ActivitySlide.stop() (карточка на 2+ уровня в глубине истории) —
         тихо убирает DOM (slide.remove()) БЕЗ единого события Listener.
         Наша страховка isLayerMounted() в src/51_slideshow.js корректно
         ловит это на следующем тике таймера и завершает контроллер
         (destroy()). Но когда backward() возвращает пользователя на такую
         карточку, Lampa переиспользует ТОТ ЖЕ DOM/ActivitySlide (start$4:
         is_stopped -> slides.append(render())) БЕЗ нового 'full':complite —
         resume() на уже уничтоженном контроллере молча ничего не делает
         (alive=false). Поэтому: контроллера нет ИЛИ он !isAlive() ->
         LC.backdrops.revive(layer) пересобирает ротацию на месте (см.
         обоснование выбора в комментарии над revive() — 50_backdrops.js). */
      if (e.type === 'start' && e.component === 'full') {
        var layer = layerOf(e.object);
        if (layer && layer.length) {
          var slideshow = layer.data('lumenSlideshow');
          if (!slideshow || (typeof slideshow.isAlive === 'function' && !slideshow.isAlive())) {
            slideshow = LC.backdrops.revive(layer);
          }
          LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow };
          if (slideshow) slideshow.resume();
        }
      }
    } catch (err) {
      warn('activity listener failed', err);
    }
  };

  function followActivityLifecycle() {
    if (activity_followed) return;
    activity_followed = true;
    try {
      if (!window.Lampa || !Lampa.Listener) return;
      Lampa.Listener.follow('activity', LC.onActivityEvent);
    } catch (e2) {
      warn('activity listener failed', e2);
    }
  }

  /* Task 6: lumen_slideshow/lumen_slide_interval меняются на уже открытой
     карточке через LC.followStorage (80_settings.js). pause()+resume() —
     единственные операции на контроллере (план: LC.active.slideshow =
     {pause,resume,destroy}), поэтому оба случая идут через них: выключили
     — pause() без resume() (остановка на текущем кадре); включили или
     сменили интервал — resume() читает slideIntervalMs()/lumen_slideshow
     заново и either запускает ротацию, либо (если всё ещё выключено)
     остаётся no-op. */
  LC.applySlideshowPref = function () {
    try {
      if (!LC.active || !LC.active.slideshow) return;
      LC.active.slideshow.pause();
      if (LC.pref('lumen_slideshow', true)) LC.active.slideshow.resume();
    } catch (e) {
      warn('slideshow pref failed', e);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Инициализация.                                                        */
  /* -------------------------------------------------------------------- */

  var original_template = '';

  function saveOriginalTemplate() {
    try {
      if (Lampa.Template && typeof Lampa.Template.all === 'function') {
        var all = Lampa.Template.all();
        if (all && all.full_start_new) {
          original_template = all.full_start_new;
          return;
        }
      }
    } catch (e) { }
    try {
      /* Сигнатура: Template.get(name, vars, like_static) -> строка */
      original_template = Lampa.Template.get('full_start_new', {}, true) || '';
    } catch (e2) {
      warn('cannot save original template', e2);
    }
  }

  function restoreOriginalTemplate() {
    try {
      if (original_template) Lampa.Template.add('full_start_new', original_template);
    } catch (e) {
      warn('cannot restore original template', e);
    }
  }

  LC.init = function () {
    try {
      if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;

      try { if (Lampa.Lang && typeof Lampa.Lang.add === 'function') Lampa.Lang.add(LC.STRINGS); } catch (e) { }

      LC.addSettings();
      LC.followStorage();

      if (!isWideLayout()) return;

      saveOriginalTemplate();

      /* Task 5/5a Step 1: build() вернул null ИЛИ ours не проходит assert
         (не хватает обязательных классов/языковых ключей из REQUIRED) ->
         версия Lampa не поддерживается, штатный шаблон не подменяем. */
      var tpl = LC.template.build(original_template);
      var check = tpl ? LC.template.assert(original_template, tpl) : null;
      if (!tpl || !check.ok) {
        warn('template not supported' + (check ? ': missing ' + check.missingInOurs.join(', ') : ' (build failed)'));
        try {
          if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show('Lumen Card: версия Lampa не поддерживается');
        } catch (e3) { }
        return;
      }
      Lampa.Template.add('full_start_new', tpl);

      LC.injectFonts();
      LC.injectCss();

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            LC.header.decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            var root = findRoot(e);
            LC.header.decorate(root, e.data);
            var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
            LC.active = { object: e.object, body: e.body, slideshow: slideshow };
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });

      followToggle();
      followActivityLifecycle();
    } catch (e) {
      warn('init failed', e);
      restoreOriginalTemplate();
    }
  };

  /* Безопасный старт. Если Lampa ещё не загрузилась — подождём. */
  LC.boot = function (attempt) {
    attempt = attempt || 0;
    if (typeof window.Lampa === 'undefined') {
      if (attempt > 40) return;
      setTimeout(function () { LC.boot(attempt + 1); }, 250);
      return;
    }
    if (window.appready) LC.init();
    else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') LC.init();
      });
    }
  };


/* ---- 99_tail.js ---- */
  if (typeof window !== 'undefined') {
    LC.boot(0);
  }
})();

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
    dark: '#1A120A'
  };

  var ACCENTS = {
    sand: { color: '#E8B87A', light: '#FFF2DC', glow: 'rgba(232,184,122,0.35)' },
    ice: { color: '#7FB7C9', light: '#DCF1F8', glow: 'rgba(127,183,201,0.35)' },
    wine: { color: '#C46A8F', light: '#F8DCE7', glow: 'rgba(196,106,143,0.35)' },
    mint: { color: '#9FCF8A', light: '#E7F8DC', glow: 'rgba(159,207,138,0.35)' }
  };

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
    var fonts = useFonts();
    var FD = fonts ? FONT_DISPLAY_ON : FONT_DISPLAY_OFF;
    var FB = fonts ? FONT_BODY_ON : FONT_BODY_OFF;
    var FM = fonts ? FONT_MONO_ON : FONT_MONO_OFF;

    var css = [];

    /* --- Бэкдроп (лежит вне .lumen-card, в корне компонента) --- */
    css.push('.lumen-backdrop{position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;overflow:hidden;opacity:0;-webkit-transition:opacity .5s ease;transition:opacity .5s ease;pointer-events:none}');
    css.push('.lumen-backdrop.loaded{opacity:1}');
    css.push('.lumen-backdrop__img{position:absolute;top:0;left:0;right:0;bottom:0;background-position:72% 32%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover}');
    css.push('.lumen-backdrop__veil{position:absolute;top:0;left:0;right:0;bottom:0}');
    css.push('.lumen-backdrop__veil--l{background:linear-gradient(90deg,rgba(11,9,8,0.96) 0%,rgba(11,9,8,0.88) 30%,rgba(11,9,8,0.35) 58%,rgba(11,9,8,0) 82%)}');
    css.push('.lumen-backdrop__veil--b{background:linear-gradient(0deg,rgba(11,9,8,0.98) 0%,rgba(11,9,8,0.60) 28%,rgba(11,9,8,0) 60%)}');
    css.push('.lumen-backdrop__veil--t{background:linear-gradient(180deg,rgba(11,9,8,0.70) 0%,rgba(11,9,8,0) 22%)}');
    /* Процедурные фоны — когда бэкдропа нет */
    css.push('.lumen-backdrop--proc0 .lumen-backdrop__img{background:radial-gradient(ellipse 56% 57% at 72% 58%,rgba(255,214,150,0.85) 0%,rgba(232,150,80,0.40) 28%,rgba(232,150,80,0) 70%),linear-gradient(180deg,#1A0D08 0%,#7A2E12 42%,#D9622B 60%,#E8B87A 78%,#3A2418 100%)}');
    css.push('.lumen-backdrop--proc1 .lumen-backdrop__img{background:radial-gradient(ellipse 52% 52% at 74% 52%,rgba(238,214,120,0.78) 0%,rgba(200,170,70,0.35) 30%,rgba(200,170,70,0) 70%),linear-gradient(180deg,#0F1210 0%,#3A3E22 45%,#B99A3A 66%,#6E5A24 82%,#17140E 100%)}');
    css.push('.lumen-backdrop--proc2 .lumen-backdrop__img{background:radial-gradient(ellipse 58% 55% at 68% 54%,rgba(190,214,236,0.70) 0%,rgba(120,150,190,0.32) 30%,rgba(120,150,190,0) 70%),linear-gradient(180deg,#07090E 0%,#1B2536 44%,#46617F 64%,#8FA6BC 80%,#181C22 100%)}');
    css.push('.full-start__background.lumen-off{display:none !important}');

    /* --- Корень карточки --- */
    css.push('.full-start-new.lumen-card{position:relative;padding-bottom:3.5em;color:' + C.text + ';font-family:' + FB + '}');
    css.push('.lumen-card .full-start-new__left{display:none !important}');
    css.push('.lumen-card .full-start-new__body{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;min-height:74vh}');
    css.push('.lumen-card .full-start-new__right{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0}');
    css.push('.lumen-card .lumen-cols{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end;-webkit-box-pack:justify;-webkit-justify-content:space-between;justify-content:space-between}');
    css.push('.lumen-card .lumen-main{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;min-width:0;max-width:74em}');
    css.push('.lumen-card .lumen-side{-webkit-flex-shrink:0;flex-shrink:0;margin-left:2.5em;text-align:right;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:end;-webkit-align-items:flex-end;align-items:flex-end}');

    /* Скрытые узлы оригинала (нужны Lampa, но не нужны дизайну) */
    css.push('.lumen-card .full-start-new__tagline,.lumen-card .full-start-new__reactions,.lumen-card .lumen-keep{display:none !important}');
    css.push('.lumen-card.lumen--meta .full-start-new__head,.lumen-card.lumen--meta .full-start-new__details{display:none !important}');
    css.push('.lumen-card .full-start-new__rate-line .full-start__pg{display:none !important}');

    /* --- Мета-строка --- */
    css.push('.lumen-card .lumen-meta{font-family:' + FM + ';font-size:1.25em;color:' + C.muted + ';letter-spacing:.03em;line-height:1.3;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    css.push('.lumen-card .lumen-meta > *{margin:0 .55em .2em 0}');
    css.push('.lumen-card .lumen-meta__sep{opacity:.5}');
    css.push('.lumen-card .lumen-meta__chip{color:' + A + ';border:.09em solid ' + A + ';padding:.1em .5em;border-radius:.35em;font-size:.85em;white-space:nowrap}');

    /* --- Заголовок --- */
    css.push('.lumen-card .full-start-new__title{font-family:' + FD + ';font-size:5.4em;font-weight:800;line-height:1.04;letter-spacing:-0.01em;margin:.16em 0 0 -0.02em}');
    css.push('.lumen-card .full-start-new__title.twolines{font-size:3.9em;-webkit-line-clamp:2;line-clamp:2}');
    css.push('.lumen-card .lumen-original{font-family:' + FM + ';font-size:1.25em;color:' + C.smoke + ';margin-top:.5em;overflow:hidden;white-space:nowrap;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
    css.push('.lumen-card .lumen-original:empty{display:none}');

    /* --- Описание --- */
    css.push('.lumen-card .lumen-descr{font-size:1.5em;line-height:1.45;color:' + C.muted + ';max-width:41em;margin-top:.9em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;line-clamp:2;-webkit-box-orient:vertical}');

    /* --- Рейтинги --- */
    css.push('.lumen-card .full-start-new__rate-line{margin:1.6em 0 0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
    css.push('.lumen-card .full-start-new__rate-line > *{margin:0 .75em .5em 0 !important}');
    css.push('.lumen-card .full-start__rate{font-family:' + FM + ';font-size:1em;background:rgba(243,237,228,0.06);border:.0625em solid rgba(243,237,228,0.10);border-radius:.75em;padding:.55em 1em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline}');
    css.push('.lumen-card .full-start__rate > div:first-child{display:block;width:auto;height:auto;background:transparent;border-radius:0;font-size:1.75em;font-weight:600;line-height:1;color:' + C.text + '}');
    css.push('.lumen-card .full-start__rate > div:last-child{font-size:.875em;letter-spacing:.1em;color:' + C.muted + ';padding:0 0 0 .7em}');
    css.push('.lumen-card .full-start-new__rate-line .tag--episode{font-family:' + FM + ';font-size:1em;background:rgba(217,98,43,0.14);border:.0625em solid rgba(217,98,43,0.40);border-radius:.75em;padding:.6em 1em;color:' + C.text + ';text-transform:none;max-width:34em}');
    css.push('.lumen-card .full-start-new__rate-line .tag--episode > div{font-size:1em;color:' + A + '}');

    /* --- Продолжить --- */
    css.push('.lumen-card .lumen-progress{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;width:47.5em;max-width:100%;margin-top:1.6em;font-family:' + FM + ';font-size:1em;color:' + C.muted + ';letter-spacing:.08em}');
    css.push('.lumen-card .lumen-progress__label{-webkit-flex-shrink:0;flex-shrink:0;color:' + C.text + '}');
    css.push('.lumen-card .lumen-progress__bar{-webkit-box-flex:1;-webkit-flex-grow:1;flex-grow:1;height:.25em;background:rgba(243,237,228,0.14);border-radius:.125em;overflow:hidden;margin:0 1.1em}');
    css.push('.lumen-card .lumen-progress__bar > div{height:100%;width:0;background:' + A + '}');
    css.push('.lumen-card .lumen-progress__time{-webkit-flex-shrink:0;flex-shrink:0}');

    /* --- Кнопки --- */
    css.push('.lumen-card .full-start-new__buttons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:wrap;flex-wrap:wrap;margin-top:1.75em;overflow:visible}');
    /* Task 4: пружина фокуса — transform на кривой с перелётом (overshoot), background/color/box-shadow отдельно. Разметка и outerHTML кнопок не менялись (хэш приоритета, см. 0.2). */
    css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:4.5em;min-width:4.5em;padding:0 1.75em;margin:0 1em .6em 0;border-radius:1.125em;border:.15em solid transparent;background:rgba(243,237,228,0.08);color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25),color .2s,-webkit-box-shadow .28s;transition:background-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25),color .2s,box-shadow .28s}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg{width:1.625em;height:1.625em;-webkit-flex-shrink:0;flex-shrink:0}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button > svg + span{font-size:1.5em;margin:0 0 0 .58em;line-height:1}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button span{display:none}');
    css.push('.lumen-card .full-start-new__buttons .button--play span,.lumen-card .full-start-new__buttons .button--priority span{display:block}');
    css.push('.lumen-card .full-start-new__buttons .button--book,.lumen-card .full-start-new__buttons .button--reaction,.lumen-card .full-start-new__buttons .button--subscribe,.lumen-card .full-start-new__buttons .button--options{padding:0;width:4.5em}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus{background:' + A + ';color:' + C.dark + ';border-color:' + AL + ';-webkit-transform:scale(1.06);transform:scale(1.06);-webkit-box-shadow:0 .875em 2.5em ' + AG + ';box-shadow:0 .875em 2.5em ' + AG + '}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.focus.lumen-press{background:' + A + ';-webkit-transform:scale(1);transform:scale(1)}');
    css.push('.lumen-card .full-start-new__buttons .full-start__button.loading:before{filter:none}');

    /* --- Правая колонка --- */
    css.push('.lumen-card .lumen-side .full-start__status{font-family:' + FM + ';font-size:1em;letter-spacing:.12em;text-transform:uppercase;border:0;padding:0;border-radius:0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;color:' + C.muted + '}');
    css.push('.lumen-card .lumen-side .full-start__status:before{content:"";display:block;width:.625em;height:.625em;border-radius:50%;background:currentColor;margin-right:.75em;-webkit-box-shadow:0 0 .9em currentColor;box-shadow:0 0 .9em currentColor}');
    css.push('.lumen-card .lumen-side .lumen-status--good{color:' + C.good + '}');
    css.push('.lumen-card .lumen-side .lumen-status--accent{color:' + A + '}');
    css.push('.lumen-card .lumen-side .lumen-status--muted{color:' + C.muted + '}');
    css.push('.lumen-card .lumen-tags{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end;margin-top:1em}');
    css.push('.lumen-card .lumen-tags .full-start__tag{font-family:' + FM + ';font-size:.95em;letter-spacing:.1em;text-transform:uppercase;background:transparent !important;color:' + C.text + ' !important;border:.0625em solid rgba(243,237,228,0.24);border-radius:.45em;padding:.45em .7em;margin:0 0 .5em .6em;white-space:nowrap}');
    css.push('.lumen-card .lumen-tags .full-start__tag > img{display:none}');
    css.push('.lumen-card .lumen-cast{margin-top:1.4em}');
    css.push('.lumen-card .lumen-cast__label{font-size:1em;color:' + C.smoke + ';margin-bottom:.7em}');
    css.push('.lumen-card .lumen-cast__row{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
    css.push('.lumen-card .lumen-cast__item{font-family:' + FD + ';font-size:1.05em;font-weight:700;width:3.7em;height:3.7em;border-radius:50%;background:' + C.panel + ';border:.18em solid ' + C.bg + ';margin-left:-.85em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;color:' + A + ';overflow:hidden}');
    css.push('.lumen-card .lumen-cast__row .lumen-cast__item:first-child{margin-left:0}');
    css.push('.lumen-card .lumen-cast__more{font-family:' + FM + ';font-weight:400;font-size:.95em;color:' + C.muted + '}');

    /* --- Компактная раскладка на узких экранах (страховка) --- */
    css.push('@media screen and (max-width:1000px){.lumen-card .lumen-cols{display:block}.lumen-card .lumen-side{margin-left:0;text-align:left;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;margin-top:1.5em}.lumen-card .full-start-new__title{font-size:3.4em}.lumen-card .full-start-new__title.twolines{font-size:2.8em}.lumen-card .full-start-new__body{min-height:0}}');

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

    /* Бэкдроп: медленный наезд (Ken Burns). Класс .lumen-bg__img подготовлен для слайдшоу кадров Task 6. */
    css.push('.lumen-card.lumen-motion-full .lumen-bg__img.is-active{-webkit-animation:lumen-kb 14s linear forwards;animation:lumen-kb 14s linear forwards}');
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

      return '' +
        '<div class="full-start-new lumen-card">' +
        '<div class="full-start-new__body">' +
        '<div class="full-start-new__left">' +
        '<div class="full-start-new__poster">' +
        '<img class="full-start-new__img full--poster" />' +
        '</div>' +
        '</div>' +
        '<div class="full-start-new__right">' +
        '<div class="lumen-cols">' +
        '<div class="lumen-main">' +
        '<div class="full-start-new__head"></div>' +
        '<div class="lumen-meta"></div>' +
        '<div class="full-start-new__title">{title}</div>' +
        '<div class="lumen-original">{original_title}</div>' +
        '<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
        '<div class="lumen-descr">{descr}</div>' +
        '<div class="full-start-new__rate-line">' +
        '<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
        '<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
        '<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
        '<div class="full-start__pg hide"></div>' +
        '<div class="full-start__tag tag--episode hide"><div></div></div>' +
        '</div>' +
        '<div class="lumen-progress hide">' +
        '<span class="lumen-progress__label"></span>' +
        '<div class="lumen-progress__bar"><div></div></div>' +
        '<span class="lumen-progress__time"></span>' +
        '</div>' +
        '<div class="full-start-new__details"></div>' +
        '<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +
        /* Обёртка константна (только этот один div), хэшируется НЕ она —
           хэшируются кнопки внутри (innerOf вырезает только их, план 0.2). */
        '<div class="full-start-new__buttons">' + buttons + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="lumen-side">' +
        '<div class="lumen-side__status"><div class="full-start__status hide"></div></div>' +
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
        '<div class="is--serial hide"></div>' +
        '</div>' +
        '</div>' +
        /* Та же логика: обёртка константна, вырезаны и вставлены дословно
           только сами кнопки-альтернативы (торренты/трейлеры) внутри неё. */
        '<div class="hide buttons--container">' + pool + '</div>' +
        '</div>';
    }

    return { innerOf: innerOf, build: build };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.template;


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
    lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' }
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


/* ---- 90_runtime.js ---- */
  /* -------------------------------------------------------------------- */
  /* Данные карточки.                                                      */
  /* -------------------------------------------------------------------- */

  function isSerial(movie) {
    return !!(movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes || movie.name);
  }

  function getCountries(movie) {
    var out = [];
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parseCountries === 'function') {
        out = Lampa.TMDB.parseCountries(movie) || [];
      }
    } catch (e) {
      warn('parseCountries failed', e);
    }
    if (out && out.length) return out;
    out = [];
    try {
      var i;
      if (movie.production_countries && movie.production_countries.length) {
        for (i = 0; i < movie.production_countries.length; i++) {
          out.push(movie.production_countries[i].name || movie.production_countries[i].iso_3166_1);
        }
      } else if (movie.origin_country && movie.origin_country.length) {
        for (i = 0; i < movie.origin_country.length; i++) out.push(movie.origin_country[i]);
      }
    } catch (e2) { }
    return out;
  }

  function getPG(movie, root) {
    var pg = '';
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parsePG === 'function') pg = Lampa.TMDB.parsePG(movie);
    } catch (e) { }
    if (!pg && root) {
      try {
        var node = root.find('.full-start__pg');
        if (node.length) pg = node.text();
      } catch (e2) { }
    }
    return pg ? ('' + pg) : '';
  }

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
    var out = [];
    try {
      if (movie.genres && movie.genres.length) {
        for (var i = 0; i < movie.genres.length && i < 3; i++) {
          if (movie.genres[i] && movie.genres[i].name) out.push(capitalize(movie.genres[i].name));
        }
      }
    } catch (e) { }
    return out;
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
  /* Бэкдроп.                                                              */
  /* -------------------------------------------------------------------- */

  function backdropUrl(movie) {
    var url = '';
    try {
      if (movie.backdrop_path && window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
        url = Lampa.Api.img(movie.backdrop_path, 'w1280') || '';
      }
    } catch (e) {
      warn('Api.img failed', e);
    }
    if (!url && movie.background_image) url = movie.background_image;
    return url;
  }

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  function applyBackdrop(body, movie) {
    try {
      if (!body || !body.length) return;

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

      var layer = body.children('.lumen-backdrop');
      if (!layer.length) {
        layer = $('<div class="lumen-backdrop">' +
          '<div class="lumen-backdrop__img"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
          '</div>');
        body.prepend(layer);
      }

      layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2');

      var url = backdropUrl(movie);
      var img = layer.find('.lumen-backdrop__img');

      if (url) {
        img.css('background-image', '');
        var loader = new Image();
        loader.onload = function () {
          try {
            /* encodeURI страхует от "/\/) в URL, которые сломали бы строку url("...") */
            img.css('background-image', 'url("' + encodeURI(url) + '")');
            layer.addClass('loaded');
          } catch (e) { }
        };
        loader.onerror = function () {
          try {
            img.css('background-image', '');
            layer.addClass(procClass(movie)).addClass('loaded');
          } catch (e) { }
        };
        loader.src = url;
      } else {
        img.css('background-image', '');
        layer.addClass(procClass(movie)).addClass('loaded');
      }
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Отрисовка карточки.                                                   */
  /* -------------------------------------------------------------------- */

  function renderMeta(root, movie) {
    var parts = [];
    var serial = isSerial(movie);

    var release = (movie.release_date || movie.first_air_date || '') + '';
    var year = release ? release.slice(0, 4) : '';
    if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');

    var countries = getCountries(movie);
    if (countries.length) parts.push('<span>' + LC.util.esc(countries.slice(0, 2).join(' · ')) + '</span>');

    if (serial) {
      var counts = [];
      if (movie.number_of_seasons) counts.push(movie.number_of_seasons + ' ' + LC.seasonsWord(movie.number_of_seasons));
      if (movie.number_of_episodes) counts.push(movie.number_of_episodes + ' ' + LC.episodesWord(movie.number_of_episodes));
      if (counts.length) parts.push('<span>' + LC.util.esc(counts.join(' · ')) + '</span>');
    } else if (movie.runtime > 0) {
      parts.push('<span>' + LC.util.esc(LC.util.fmtRuntime(movie.runtime, LC.lang('lumen_card_min'))) + '</span>');
    }

    var quality = !movie.first_air_date ? (movie.release_quality || movie.quality) : '';
    if (quality) parts.push('<span class="lumen-meta__chip">' + LC.util.esc(('' + quality).toUpperCase()) + '</span>');
    else if (serial) parts.push('<span class="lumen-meta__chip">' + LC.util.esc(LC.lang('lumen_card_serial')) + '</span>');

    var genres = getGenres(movie);
    if (genres.length) parts.push('<span>' + LC.util.esc(genres.join(', ')) + '</span>');

    var pg = getPG(movie, root);
    if (pg) parts.push('<span>' + LC.util.esc(pg) + '</span>');

    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i) html.push('<span class="lumen-meta__sep">·</span>');
      html.push(parts[i]);
    }

    root.find('.lumen-meta').html(html.join(''));
    root.addClass('lumen--meta');
  }

  function renderOriginal(root, movie) {
    var title = movie.title || movie.name || '';
    var original = movie.original_title || movie.original_name || '';
    var node = root.find('.lumen-original');
    if (!node.length) return;
    if (!original || original === title) node.text('');
    else node.text(original);
  }

  function renderStatus(root, movie) {
    var node = root.find('.full-start__status');
    if (!node.length) return;

    /* Переносим статус из строки рейтингов в правую колонку. */
    var holder = root.find('.lumen-side__status');
    if (holder.length && !holder.find('.full-start__status').length) holder.append(node);

    node.removeClass('lumen-status--good lumen-status--accent lumen-status--muted');

    var status = ('' + (movie.status || '')).toLowerCase();
    var cls = 'lumen-status--muted';
    if (status.indexOf('return') >= 0 || status.indexOf('production') >= 0 || status.indexOf('progress') >= 0 || status.indexOf('planned') >= 0) cls = 'lumen-status--accent';
    else if (status.indexOf('released') >= 0) cls = 'lumen-status--good';
    node.addClass(cls);
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

    try { renderMeta(root, movie); } catch (e) { warn('meta failed', e); }
    try { renderOriginal(root, movie); } catch (e) { warn('original failed', e); }
    try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
    try { renderProgress(root, movie); } catch (e) { warn('progress failed', e); }
    try { renderCast(root, data); } catch (e) { warn('cast failed', e); }
  }

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

      var tpl = LC.template.build(original_template);
      if (!tpl) { warn('buttons block not found, template left intact'); return; }
      Lampa.Template.add('full_start_new', tpl);

      LC.injectFonts();
      LC.injectCss();

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            var root = findRoot(e);
            decorate(root, e.data);
            applyBackdrop(e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });

      followToggle();
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

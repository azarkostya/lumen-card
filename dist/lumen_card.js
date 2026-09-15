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
      var rules = [], sel, k, name;
      var map = {};
      for (k in byButton) if (byButton.hasOwnProperty(k)) map['.' + k] = byButton[k];
      map['[class*="view--online"]'] = 'play'; // Online Mod и аналоги: .view--online_mod, .view--online
      for (sel in map) {
        if (!map.hasOwnProperty(sel)) continue;
        name = map[sel];
        var btn = '.lumen-card .full-start__button' + sel;
        rules.push(btn + ' > svg{display:none !important}');
        rules.push(btn + ':before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.625em;height:1.625em;background-color:currentColor;-webkit-mask-image:' + maskUrl(name) + ';mask-image:' + maskUrl(name) + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
      }
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
    css.push('.lumen-card .full-start-new__buttons .full-start__button{font-size:1em;font-weight:600;height:4.5em;min-width:4.5em;padding:0 1.75em;margin:0 1em .6em 0;border-radius:1.125em;border:.15em solid transparent;background:rgba(243,237,228,0.08);color:' + C.text + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;-webkit-transition:background .18s ease,-webkit-transform .18s ease;transition:background .18s ease,transform .18s ease}');
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
  /* Шаблон                                                                */
  /* -------------------------------------------------------------------- */

  /* Кнопки скопированы 1:1 из src/templates/full/start_new.js — менять их
     нельзя: buttons.js хэширует outerHTML для приоритетной кнопки. */
  LC.buildTemplate = function () {
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
      '<div class="full-start-new__buttons">' +
      '<div class="full-start__button selector button--play">' +
      '<svg><use xlink:href="#sprite-play"></use></svg>' +
      '<span>#{title_watch}</span>' +
      '</div>' +
      '<div class="full-start__button selector button--book">' +
      '<svg width="21" height="32" viewBox="0 0 21 32" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M2 1.5H19C19.2761 1.5 19.5 1.72386 19.5 2V27.9618C19.5 28.3756 19.0261 28.6103 18.697 28.3595L12.6212 23.7303C11.3682 22.7757 9.63183 22.7757 8.37885 23.7303L2.30302 28.3595C1.9739 28.6103 1.5 28.3756 1.5 27.9618V2C1.5 1.72386 1.72386 1.5 2 1.5Z" stroke="currentColor" stroke-width="2.5"/>' +
      '</svg>' +
      '<span>#{settings_input_links}</span>' +
      '</div>' +
      '<div class="full-start__button selector button--reaction">' +
      '<svg><use xlink:href="#sprite-reaction"></use></svg>' +
      '<span>#{title_reactions}</span>' +
      '</div>' +
      '<div class="full-start__button selector button--subscribe hide">' +
      '<svg viewBox="0 0 25 30" fill="none" xmlns="http://www.w3.org/2000/svg">' +
      '<path d="M6.01892 24C6.27423 27.3562 9.07836 30 12.5 30C15.9216 30 18.7257 27.3562 18.981 24H15.9645C15.7219 25.6961 14.2632 27 12.5 27C10.7367 27 9.27804 25.6961 9.03542 24H6.01892Z" fill="currentColor"></path>' +
      '<path d="M3.81972 14.5957V10.2679C3.81972 5.41336 7.7181 1.5 12.5 1.5C17.2819 1.5 21.1803 5.41336 21.1803 10.2679V14.5957C21.1803 15.8462 21.5399 17.0709 22.2168 18.1213L23.0727 19.4494C24.2077 21.2106 22.9392 23.5 20.9098 23.5H4.09021C2.06084 23.5 0.792282 21.2106 1.9273 19.4494L2.78317 18.1213C3.46012 17.0709 3.81972 15.8462 3.81972 14.5957Z" stroke="currentColor" stroke-width="2.6"></path>' +
      '</svg>' +
      '<span>#{title_subscribe}</span>' +
      '</div>' +
      '<div class="full-start__button selector button--options">' +
      '<svg><use xlink:href="#sprite-dots"></use></svg>' +
      '</div>' +
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
      '</div>' +
      '<div class="hide buttons--container">' +
      '<div class="full-start__button view--torrent hide">' +
      '<svg><use xlink:href="#sprite-torrent"></use></svg>' +
      '<span>#{full_torrents}</span>' +
      '</div>' +
      '<div class="full-start__button selector view--trailer">' +
      '<svg><use xlink:href="#sprite-trailer"></use></svg>' +
      '<span>#{full_trailers}</span>' +
      '</div>' +
      '</div>' +
      '</div>';
  };


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
    } catch (e) {
      warn('settings failed', e);
    }
  };

  LC.followStorage = function () {
    try {
      if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
      Lampa.Storage.listener.follow('change', function (e) {
        if (!e || !e.name) return;
        if (e.name.indexOf(PLUGIN + '_') !== 0) return;
        if (e.name === PLUGIN + '_fonts') LC.injectFonts();
        LC.injectCss();
      });
    } catch (err) {
      warn('storage listener failed', err);
    }
  };


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

      try {
        Lampa.Template.add('full_start_new', LC.buildTemplate());
      } catch (e) {
        warn('template add failed', e);
        restoreOriginalTemplate();
        return;
      }

      LC.injectFonts();
      LC.injectCss();

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            decorate(findRoot(e), e.data);
            applyBackdrop(e.body, (e.data && e.data.movie) || {});
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });
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

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

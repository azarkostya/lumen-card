  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экраны 41 (Настройки) и 42 (левое меню Lampa).     */
  /* docs/design/v2-unify/SPEC.txt, разделы 41–42 и «DOM Lampa».           */
  /* Только CSS поверх штатного DOM: .settings и .menu — узлы самой Lampa, */
  /* правила действуют на ВСЕ разделы её настроек (так задано спекой), а   */
  /* снимаются вместе со всей таблицей при выключении плагина.             */
  /* -------------------------------------------------------------------- */

  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'settings-menu',
    order: 41,
    build: function (ctx) {
      var P = ctx.P;
      var APPLE = ctx.APPLE;
      var V2 = ctx.V2;
      var css = [];
      /* Гарнитура плагина; пусто — шрифты плагина выключены, и панель
         наследует шрифт Lampa, как раньше. */
      var font = typeof LC.fontStack === 'function' ? LC.fontStack() : '';
      var FF = font ? 'font-family:' + font + ';' : '';
      /* Заливка фокуса — та же, что у пунктов плагина (экран 33): P.text в
         Lumen, белый в Apple TV; подпись — P.bg, описание — 70 % чернил. */
      var FILL = APPLE ? V2.fillA : P.text;
      /* Вторичный текст: P.muted в Lumen (6.5:1 на P.panel тёплой темы),
         .64 от светлого tvOS в Apple TV (6.6:1 на #1C1C1E). Заголовок
         секции светлее описаний: P.soft (L, 12.1:1) и .72 (A, 8.0:1) —
         было #6F6F6F на #262829, 2.9:1. */
      var SUB = APPLE ? 'rgba(235,235,245,.64)' : P.muted;
      var SECTION = APPLE ? 'rgba(235,235,245,.72)' : P.soft;
      var PANEL = APPLE ? '#1C1C1E' : P.panel;
      var ICON = APPLE ? 'rgba(235,235,245,.72)' : P.soft;
      /* Числа макета — FHD, em от базового кегля Lampa 22.811 px:
         14 px = .61em, 20 px = .88em, 23 px = 1.01em, 26 px = 1.14em,
         28 px = 1.23em, 30 px = 1.32em, 38 px = 1.67em, 40 px = 1.75em,
         64 px = 2.81em, 76 px = 3.33em, 80 px = 3.51em, 480 px = 21.04em,
         720 px = 31.56em. */
      var R = '.61em';

      /* ---------------- 41 · Настройки ---------------- */

      /* Панель цвета темы вместо серой #262829 (и вместо «стекла»
         glass--style: полупрозрачность с размытием на слабом ТВ дорогая),
         720 px на FHD. Фон без анимации. Под панелью — статичное
         затемнение фоном темы .55 (штатный слой пустой). */
      css.push('body .settings .settings__content{background:' + PANEL + ';-webkit-backdrop-filter:none;backdrop-filter:none;' + FF + (APPLE ? '' : '-webkit-box-shadow:-1.05em 0 2.1em rgba(0,0,0,.35);box-shadow:-1.05em 0 2.1em rgba(0,0,0,.35)') + '}');
      css.push('@media screen and (min-width:768px){body .settings .settings__content{width:31.56em}}');
      css.push('body.settings--open .settings__layer{background:rgba(' + P.bgRgb + ',.55)}');
      /* Заголовок панели: 38 px Bold вместо 2.2em Light (Light запрещён). */
      css.push('body .settings .settings__head{padding:2.63em 3.51em .79em 2.63em}');
      css.push('body .settings .settings__title{font-size:1.67em;font-weight:700;line-height:1.2;color:' + P.text + '}');
      /* Колонка пунктов: 40 px от левой кромки панели, 80 px — от правой
         (поле экрана). Пункты — скруглённые строки, а не полосы во всю
         ширину. */
      css.push('body .settings .settings__body .scroll__body{padding:0 3.51em .88em 1.75em}');
      css.push('body .settings .settings-param,body .settings .settings-folder{padding:.61em .88em;border-radius:' + R + ';margin-bottom:.26em}');
      /* Пункт: значение — справа в строке имени, описание — второй
         строкой. flex-wrap: длинное значение (адрес сервера) уходит на
         свою строку целиком, а не режется. Статус-точка Lampa стоит
         абсолютно и раскладку не трогает. */
      css.push('body .settings .settings-param{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline}');
      css.push('body .settings .settings-param > *{-webkit-flex-basis:100%;flex-basis:100%}');
      css.push('body .settings .settings-param__name{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0;font-size:1.14em;font-weight:500;line-height:1.3;margin-bottom:0}');
      css.push('body .settings .settings-param__value{-webkit-box-flex:0;-webkit-flex:0 1 auto;flex:0 1 auto;margin-left:.77em;max-width:100%;font-size:1.01em;line-height:1.3;text-align:right;word-wrap:break-word;overflow-wrap:break-word;color:' + SUB + '}');
      css.push('body .settings .settings-param__value:empty{display:none}');
      css.push('body .settings .settings-param__descr{opacity:1;margin-top:.17em;font-size:1.01em;line-height:1.3;color:' + SUB + '}');
      /* Секция: 23 px 600, светлее описаний. */
      css.push('body .settings .settings-param-title{padding:.96em .88em .35em}');
      css.push('body .settings .settings-param-title > span{font-size:1.01em;font-weight:600;color:' + SECTION + '}');
      /* Корень настроек: строка 76 px, иконка 30 px цветом soft. */
      css.push('body .settings .settings-folder{min-height:3.33em;padding-top:0;padding-bottom:0;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
      css.push('body .settings .settings-folder__icon,body .settings .settings-folder__icon > *{width:1.32em;height:1.32em}');
      css.push('body .settings .settings-folder__icon{margin-right:.88em;color:' + ICON + '}');
      css.push('body .settings .settings-folder__name{font-size:1.14em;font-weight:500;line-height:1.3}');
      if (APPLE) {
        /* tvOS: строки разделены волосяной линией, фокус — белая плашка. */
        css.push('body .settings .settings-param,body .settings .settings-folder{-webkit-box-shadow:inset 0 -.04em 0 rgba(255,255,255,.1);box-shadow:inset 0 -.04em 0 rgba(255,255,255,.1)}');
      }

      /* Фокус — заливка (было #353535 на #262829, 1.2:1), без обводки.
         Иконки корня Lampa белые: на светлой заливке инвертируются (так
         делает и её собственный стеклянный стиль). Правило пунктов плагина
         (src/30_css.js, [data-name^="lumen_"]) перекрыто тем же
         селектором ниже по таблице. */
      /* QA v2 (P2, основная Lampa): тема CUB «Neon» (Расширения → Темы,
         <link id="cub-theme"> в конце body) ставит пунктам
         background:transparent !important и color:#fff !important, а
         поверх пункта — ::before с отступами 1em, кольцом, свечением и
         белой вуалью .2. Наша заливка пропадала, текст P.bg оставался на
         сером, кольцо стояло уже пункта: первые буквы описания и значение
         справа уходили под кромку («ерез», «Д»). Поэтому заливка, цвет и
         иконка — с !important (селектор у нас специфичнее, чем у темы:
         body + .settings + 2 класса), а чужой ::before в панели снят —
         Lampa сама псевдоэлементы пунктам настроек не рисует. */
      var FOCUS = 'body .settings .settings-param.focus,body .settings .settings-folder.focus,body .settings .settings-param[data-name^="lumen_"].focus';
      css.push(FOCUS + '{background:' + FILL + ' !important;color:' + P.bg + ' !important;outline:0;-webkit-box-shadow:none;box-shadow:none}');
      css.push('body .settings .settings-param.focus:before,body .settings .settings-folder.focus:before{content:none !important;display:none !important}');
      css.push('body .settings .settings-param.focus .settings-param__name,body .settings .settings-folder.focus .settings-folder__name{font-weight:600}');
      css.push('body .settings .settings-param.focus .settings-param__value,body .settings .settings-param[data-name^="lumen_"].focus .settings-param__value{opacity:1;color:' + P.bg + ' !important}');
      css.push('body .settings .settings-param.focus .settings-param__descr,body .settings .settings-param[data-name^="lumen_"].focus .settings-param__descr{opacity:1;color:' + V2.sub + ' !important}');
      css.push('body .settings .settings-folder.focus .settings-folder__icon,body .settings .settings-param.focus .settings-folder__icon{color:' + P.bg + ';-webkit-filter:invert(1) !important;filter:invert(1) !important}');

      /* ---------------- 42 · Левое меню ---------------- */

      /* Ширина 480 px вместо 342: подпись «Что посмотреть» 26 px с полем
         80 px и иконкой не помещалась бы. Сдвиг открытия — на ту же
         ширину. Только у обычного выезжающего меню: «всегда открытое»
         (menu--always) и «лёгкая версия» Lampa раскладываются иначе. */
      var MW = '21.04em';
      var OPEN = 'body.menu--open:not(.light--version):not(.menu--always)';
      css.push('body:not(.light--version):not(.menu--always) .wrap__left{width:' + MW + ';margin-left:-' + MW + '}');
      css.push(OPEN + ' .wrap__left,' + OPEN + ' .wrap__content{-webkit-transform:translate3d(' + MW + ',0,0);transform:translate3d(' + MW + ',0,0)}');
      /* Подложка: Lumen — панель цвета темы с тенью вправо; Apple TV — без
         коробки, затемнение от чёрного у кромки к .35 над экраном. Слой —
         псевдоэлемент на высоту экрана, сам пункт его не перекрашивает. */
      if (APPLE) {
        css.push(OPEN + ' .wrap__left:before{content:"";position:absolute;top:0;left:0;width:100vw;height:100vh;z-index:-1;pointer-events:none;background:-webkit-linear-gradient(left,#000 0%,rgba(0,0,0,.92) 25%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.35) 100%);background:linear-gradient(90deg,#000 0%,rgba(0,0,0,.92) 25%,rgba(0,0,0,.35) 55%,rgba(0,0,0,.35) 100%)}');
      } else {
        css.push(OPEN + ' .wrap__left:before{content:"";position:absolute;top:0;left:0;width:100%;height:100vh;z-index:-1;pointer-events:none;background:' + P.panel + ';-webkit-box-shadow:1.05em 0 2.1em rgba(0,0,0,.35);box-shadow:1.05em 0 2.1em rgba(0,0,0,.35)}');
      }
      /* Разделители-черты не рисуем — группы отделены воздухом. */
      css.push('body .menu .menu__split{border-top:0;width:auto;margin:.7em 0}');
      /* Иконки — на линии 80 px, фокус выступает на 20 px левее. */
      css.push('body .menu .menu__list{padding-left:2.63em;padding-right:1.75em}');
      css.push('body .menu .menu__item{min-height:2.81em;padding:.35em .88em;border-radius:' + R + ';' + FF + (APPLE ? 'color:rgba(235,235,245,.85)' : 'color:' + P.text) + '}');
      css.push('body .menu .menu__item + li{margin-top:.18em}');
      css.push('body .menu .menu__ico{width:1.23em;height:1.23em;margin-right:.88em;color:' + ICON + ';stroke-width:2}');
      css.push('body .menu .menu__ico > svg,body .menu .menu__ico > img,body .menu .menu__ico .lumen-ico{width:1.23em;height:1.23em}');
      css.push('body .menu .menu__text{font-size:1.14em;font-weight:500;line-height:1.2;margin-top:0}');
      /* Фокус — заливка темы вместо белой плашки; иконка — цветом подписи. */
      /* Тема CUB «Neon»: .menu__item.focus{background:transparent !important;
         color:#fff !important}, ::after с кольцом и вуалью и fill/stroke
         #fff !important у svg иконки — белая иконка на светлой заливке.
         Заливка и цвета — с !important (наш селектор специфичнее). ::after
         пункта Lampa рисует сама только в режиме правки меню (.editable:
         значок, стрелки .traverse) — там снимаем лишь кольцо темы, вне
         правки — псевдоэлемент целиком. */
      var MI = ['body .menu .menu__item.focus', 'body .menu .menu__item.hover', 'body .menu .menu__item.traverse'];
      css.push(MI.join(',') + '{background:' + FILL + ' !important;color:' + P.bg + ' !important}');
      css.push('body .menu .menu__item.focus .menu__ico,body .menu .menu__item.hover .menu__ico,body .menu .menu__item.traverse .menu__ico{color:' + P.bg + '}');
      var ICO = [];
      for (var mi = 0; mi < MI.length; mi++) {
        ICO.push(MI[mi] + ' .menu__ico path[fill]:not([fill="none"])', MI[mi] + ' .menu__ico rect[fill]:not([fill="none"])', MI[mi] + ' .menu__ico circle[fill]:not([fill="none"])');
      }
      css.push(ICO.join(',') + '{fill:' + P.bg + ' !important}');
      var NOFILL = [];
      for (var mn = 0; mn < MI.length; mn++) NOFILL.push(MI[mn] + ' .menu__ico [fill="none"]');
      css.push(NOFILL.join(',') + '{fill:none !important}');
      var STROKE = [];
      for (var ms = 0; ms < MI.length; ms++) STROKE.push(MI[ms] + ' .menu__ico [stroke]:not([stroke="none"])');
      css.push(STROKE.join(',') + '{stroke:' + P.bg + ' !important}');
      css.push('body .menu:not(.editable) .menu__item.focus:not(.traverse):after{content:none !important;display:none !important}');
      css.push('body .menu .menu__item.focus:after{-webkit-box-shadow:none !important;box-shadow:none !important;outline:0 !important;background:none !important}');
      css.push('body .menu .menu__item.focus .menu__text,body .menu .menu__item.hover .menu__text{font-weight:600}');

      return css.join('\n');
    }
  });

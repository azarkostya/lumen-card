  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экран 38 — штатный поиск Lampa в цветах темы.      */
  /*                                                                       */
  /* docs/design/v2-unify/SPEC.txt §38, макеты 38-L / 38-A / 38-L·E /      */
  /* 38-A·E. Структура и .selector Lampa не меняются: раскладка клавиатуры */
  /* — штатная трёхрядная (бриф, ограничение 9), меняется только           */
  /* оформление и место блоков.                                            */
  /*                                                                       */
  /* DOM Lampa (vendor/lampa/app.min.js, Search.open/create, html$1S):     */
  /*   .main-search > .scroll.search > … > .search__body:                  */
  /*     .search__input · .search__keypad (.simple-keyboard .hg-button) ·  */
  /*     .search__history (.search-history-key / -empty) ·                 */
  /*     .search__sources (.search-source) · .search__results              */
  /*     (.items-line с .card; пусто — .search-looking__text).             */
  /*   Открытый поиск ставит body.search--open (и ambience--enable) и      */
  /*   снимает их при закрытии — своя метка body не нужна, все правила     */
  /*   под body.search--open .search.                                      */
  /*                                                                       */
  /* Раскладка: поле, клавиатура, недавние и вкладки источников — колонкой */
  /* слева (float, 864 px = 37.88em от кромки 3.51em), ряды результатов —  */
  /* справа от x = 1000 px. Обтекание, а не flex: блок результатов первым  */
  /* в потоке встаёт к верху колонки сам, и порядок узлов Lampa (а с ним   */
  /* её навигация вверх/вниз) не трогается.                                */
  /*                                                                       */
  /* Числа макета даны для FHD; em — от базового кегля Lampa 22.811 px.    */
  /*                                                                       */
  /* LC.v2search — рейтинг в подпись: при метках «на постере» и «в         */
  /* подписи» плашка .card__vote спрятана (как на главной), а «★ 7.8»      */
  /* дописывается к строке года. При выключенных метках — штатная плашка.  */
  /* -------------------------------------------------------------------- */

  LC.v2css = LC.v2css || [];

  (function () {
    /* Иконки служебных клавиш — тот же набор, что LC.icons (24×24, штрих
       1.8, круглые концы): «стереть», «язык», «пробел». */
    var KEY_ICONS = {
      bksp: '<path d="M9 5h11a1 1 0 011 1v12a1 1 0 01-1 1H9l-6-7z"/><path d="M17 9.5l-5 5M12 9.5l5 5"/>',
      globe: '<circle cx="12" cy="12" r="8.6"/><path d="M3.4 12h17.2"/><path d="M12 3.4c2.3 2.4 3.4 5.3 3.4 8.6s-1.1 6.2-3.4 8.6c-2.3-2.4-3.4-5.3-3.4-8.6s1.1-6.2 3.4-8.6z"/>',
      space: '<path d="M3.5 11v4.5h17V11"/>'
    };

    function keyMask(name) {
      var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + KEY_ICONS[name] + '</svg>';
      return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg) + '")';
    }

    function maskDecl(url) {
      return 'background-image:none;background-color:currentColor;-webkit-mask-image:' + url + ';mask-image:' + url + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain';
    }

    function build(ctx) {
      var P = ctx.P;
      var APPLE = ctx.APPLE;
      var V2 = ctx.V2;
      var tok = (typeof LC.tokens === 'function') ? LC.tokens() : {};
      var FB = tok.fontBody || 'inherit';
      var S = 'body.search--open .search';
      var KB = S + ' .simple-keyboard';
      var RES = S + ' .search__results';
      var hasMask = '@supports (-webkit-mask-image:none) or (mask-image:none)';
      var css = [];

      /* Цвета стиля. Lumen: клавиши — панель темы, служебные — тоном
         светлее (линия темы), иконки P.soft. Apple TV: клавиши без
         подложки, буквы — вторичный белый .85, иконки — .64 (макет 38-A). */
      var KEY_BG = APPLE ? 'transparent' : P.panel;
      var SVC_BG = APPLE ? 'transparent' : P.line;
      var KEY_INK = APPLE ? 'rgba(235,235,245,.85)' : P.text;
      var SVC_INK = APPLE ? 'rgba(235,235,245,.64)' : P.soft;
      var MUTED = APPLE ? 'rgba(235,235,245,.64)' : P.muted;
      /* Фон — сам цвет темы, без подкраски от постера (P.bg подкрашен
         последним постером главной или карточки: на ТВ поиск после «Дюны»
         выходил серо-синим — ровно то, что ревью и просило убрать).
         Значения — THEMES.warm.bg / THEMES.black.bg из src/30_css.js. */
      var BG = (typeof LC.pref === 'function' && LC.pref('lumen_theme', 'warm') === 'black') ? '#000000' : '#0B0908';
      var FILL = APPLE ? V2.fillA : P.text;
      var ON_FILL = BG;
      var CHIP = APPLE ? V2.blockA : P.chipBg;
      /* Кегль букв: 27 px (L) / 28 px (A) — 1.18em / 1.23em; размеры
         клавиши пересчитаны в её собственный em. */
      var KF = APPLE ? 1.23 : 1.18;
      var kem = function (fhdEm) { return ctx.round2(fhdEm / KF) + 'em'; };
      var tr = function (ms) { return '-webkit-transition:-webkit-transform ' + (ms / 1000) + 's ease-out;transition:transform ' + (ms / 1000) + 's ease-out'; };

      /* --- Фон: тема вместо размытого постера и серо-синего градиента. --- */
      css.push('body.search--open .background{display:none}');
      css.push(S + '{background:' + BG + ';font-family:' + FB + '}');

      /* --- Раскладка: колонка слева, результаты справа. ---
         Сверху 60 px (2.63em) — safe area; шапки Lampa над поиском нет
         (ambience--enable её прячет). */
      css.push(S + ' .search__body{padding:2.63em 0 2.63em 3.51em}');
      css.push(S + ' .search__body:after{content:"";display:table;clear:both}');
      css.push(S + ' .search__input,' + S + ' .search__keypad,' + S + ' .search__history,' + S + ' .search__sources{float:left;clear:left;width:37.88em;-webkit-box-sizing:border-box;box-sizing:border-box}');
      /* Карточки ряда Lampa отступают от края результатов на 1.5em (поле
         горизонтального скролла под масштаб фокуса): край постера — на
         1000 px = 43.84em, значит сам блок — на 42.34em от края экрана. */
      css.push(RES + '{margin-left:' + ctx.round2(43.84 - 3.51 - 1.5) + 'em}');

      /* --- Поле запроса: 84 px, радиус 16, лупа слева. --- */
      /* Размеры поля — в em его СОБСТВЕННОГО кегля (у пустого поля 29 px,
         у запроса 42/46 px), иначе ширина 37.88em росла бы вместе с текстом. */
      var FIELD_EMPTY = 1.27;
      var FIELD_FULL = APPLE ? 2.02 : 1.84;
      var field = function (f) {
        var e = function (v) { return ctx.round2(v / f) + 'em'; };
        return 'width:' + e(37.88) + ';height:' + e(3.68) + ';margin:0 0 ' + e(1.23) + ';padding:0 ' + (APPLE ? '0' : e(1.23)) + ';border-radius:' + (APPLE ? '0' : e(0.7)) + ';font-size:' + f + 'em';
      };
      var fieldIcon = function (f) {
        var e = function (v) { return ctx.round2(v / f) + 'em'; };
        return 'width:' + e(1.4) + ';height:' + e(1.4) + ';margin-right:' + e(0.79);
      };
      css.push(S + ' .search__input{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;' + field(FIELD_EMPTY) + ';overflow:hidden;white-space:nowrap;background:' + (APPLE ? 'transparent' : P.panel) + (APPLE ? ';border-bottom:2px solid rgba(255,255,255,.3)' : '') + ';font-family:' + FB + ';font-weight:500;line-height:1;color:' + MUTED + '}');
      css.push(S + ' .search__input.filled{' + field(FIELD_FULL) + ';font-weight:600;color:' + P.text + (APPLE ? ';letter-spacing:-.015em' : '') + '}');
      css.push(hasMask + '{' + S + ' .search__input:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;' + fieldIcon(FIELD_EMPTY) + ';color:' + MUTED + ';' + maskDecl(LC.icons.maskUrl('search')) + '}' + S + ' .search__input.filled:before{' + fieldIcon(FIELD_FULL) + '}}');
      css.push(S + ' .search__input.filled:after{border-right-color:' + P.text + '}');

      /* --- Клавиатура: раскладка Lampa, оформление макета. ---
         Клавиша 64 px высотой (2.81em), зазор 6 px (.26em), ряды через
         8 px (.35em), радиус 10 px (.44em). */
      css.push(S + ' .search__keypad{padding:0;margin-bottom:1.4em}');
      css.push(KB + '{margin:0;color:' + KEY_INK + '}');
      css.push(KB + ' .hg-row{margin:0}');
      css.push(KB + ' .hg-row + .hg-row{margin-top:.35em}');
      css.push(KB + ' .hg-button{height:' + kem(2.81) + ';margin:0 ' + kem(0.26) + ' 0 0;padding:0;border-radius:' + kem(0.44) + ';background:' + KEY_BG + ';font-family:' + FB + ';font-weight:500;font-size:' + KF + 'em;line-height:1;color:' + KEY_INK + '}');
      css.push(KB + ' .hg-button:last-child{margin-right:0}');
      css.push(KB + ' .hg-functionBtn{background:' + SVC_BG + ';color:' + SVC_INK + '}');
      css.push(KB + ' .hg-button[data-skbtn="{MIC}"]{color:' + SVC_INK + '}');
      css.push(KB + ' .hg-button[data-skbtn="{SIM}"]{font-size:' + ctx.round2(KF * 0.85) + 'em;height:' + ctx.round2(2.81 / (KF * 0.85)) + 'em;margin-right:' + ctx.round2(0.26 / (KF * 0.85)) + 'em;border-radius:' + ctx.round2(0.44 / (KF * 0.85)) + 'em}');
      /* Служебные клавиши — иконки одного набора маской (цвет — currentColor,
         в фокусе он сам становится цветом текста на заливке). Без масок —
         картинки Lampa, в фокусе затемнённые, чтобы не исчезнуть на светлой
         заливке. */
      css.push(hasMask + '{' +
        KB + ' .hg-button[data-skbtn="{BKSP}"]:after{width:.95em;height:.95em;' + maskDecl(keyMask('bksp')) + '}' +
        KB + ' .hg-button[data-skbtn="{LANG}"]:after{width:.95em;height:.95em;' + maskDecl(keyMask('globe')) + '}' +
        KB + ' .hg-button[data-skbtn="{SPACE}"]:after{width:1.15em;height:1.15em;margin-top:0;' + maskDecl(keyMask('space')) + '}' +
      '}');
      css.push(LC.icons.NO_MASK + '{' + KB + ' .hg-button.focus:after{-webkit-filter:brightness(0);filter:brightness(0)}}');
      /* Фокус клавиши — система экрана 33: заливка. Apple TV — белая
         плитка ×1.12 с тенью; в «Лёгких» и «Выкл» без масштаба. Цвет
         микрофона Lampa пишет в style узла (запись — красный, потом белый),
         поэтому в фокусе он с !important — иначе белая иконка на белом. */
      css.push(KB + ' .hg-button.focus,' + KB + ' .hg-button.hg-activeButton{background:' + FILL + ';color:' + ON_FILL + '}');
      css.push(KB + ' .hg-button[data-skbtn="{MIC}"].focus{color:' + ON_FILL + ' !important}');
      if (APPLE) {
        css.push(KB + ' .hg-button.focus{position:relative;z-index:1;font-weight:600;-webkit-transform:scale(1.12);transform:scale(1.12);-webkit-box-shadow:' + V2.buttonShadowA + ';box-shadow:' + V2.buttonShadowA + '}');
        css.push('body.lumen-motion-lite.search--open .search .simple-keyboard .hg-button.focus,body.lumen-motion-off.search--open .search .simple-keyboard .hg-button.focus{-webkit-transform:none;transform:none}');
        css.push('body.lumen-motion-full.search--open .search .simple-keyboard .hg-button{' + tr(V2.durA) + '}');
      }

      /* --- Недавние запросы и «История поиска пуста». ---
         Ряд Lampa горизонтальный (навигация влево/вправо) — остаётся рядом:
         плашки 52 px с часами, фокус — заливка. */
      css.push(S + ' .search__history{margin-bottom:.7em}');
      /* Ряды недавних и вкладок — от кромки колонки (у горизонтального
         скролла Lampa поля по 1.5em; фокус здесь — заливка без масштаба,
         запас под него не нужен). */
      css.push(S + ' .search__history .scroll__content,' + S + ' .search__sources .scroll__content{padding-left:0;padding-right:0}');
      css.push(S + ' .search-history-key{font-size:1em;height:2.28em;padding:0 .7em;border-radius:.44em;background:' + CHIP + ';color:' + P.text + '}');
      css.push(S + ' .search-history-key + div{margin-left:.35em}');
      css.push(S + ' .search-history-key > div{font-family:' + FB + ';font-weight:500;font-size:1.1em;line-height:1.2;padding:0;background:none}');
      css.push(S + ' .search-history-key:before{width:1.05em;height:1.05em;margin-right:.5em;background-image:none}');
      css.push(hasMask + '{' + S + ' .search-history-key:before{color:' + MUTED + ';' + maskDecl(LC.icons.maskUrl('clock')) + '}' + S + ' .search-history-key.focus:before{color:' + ON_FILL + '}}');
      css.push(S + ' .search-history-key.focus{background:' + FILL + ';color:' + ON_FILL + '}');
      css.push(S + ' .search-history-empty{display:inline-block;padding:.5em .7em;border-radius:.44em;font-family:' + FB + ';font-weight:500;font-size:1.1em;line-height:1.2;color:' + MUTED + '}');
      css.push(S + ' .search-history-empty.focus{background:' + FILL + ';color:' + ON_FILL + '}');

      /* --- Вкладки источников (TMDB, CUB, «Подборки»): выбранная — плашкой,
         фокус — заливкой (заливка занята фокусом, выбор её не берёт).
         Невыбранные Lampa гасит прозрачностью (ТВ: 2.5:1) — она снята,
         цвет подписи — вторичный текст темы. --- */
      css.push(S + ' .search__sources{margin-bottom:.7em}');
      css.push(S + ' .search-source{height:2.1em;padding:0 .84em;border-radius:.44em;font-family:' + FB + ';font-weight:500;font-size:1.1em;background:transparent;color:' + MUTED + ';opacity:1}');
      css.push(S + ' .search-source + .search-source{margin-left:.35em}');
      css.push(S + ' .search-source__tab{padding:0}');
      css.push(S + ' .search-source__count{margin-left:.45em;padding:.12em .4em;min-width:1.4em;font-size:.8em;font-weight:600;background:rgba(' + P.textRgb + ',.14);color:inherit}');
      css.push(S + ' .search-source.active{background:' + CHIP + ';color:' + P.text + '}');
      css.push(S + ' .search-source.focus{background:' + FILL + ';color:' + ON_FILL + '}');
      css.push(S + ' .search-source.focus .search-source__count{background:rgba(0,0,0,.14)}');

      /* --- Ряды результатов — постерами главной. ---
         Постер 217 px (9.52em, седьмая колонка), зазор 40 px (1.75em),
         заголовок ряда — как на главной. Подпись в одну строку с «…»: и
         название, и «год · ★». Поле сверху горизонтального скролла — под
         масштаб фокуса (у поиска Lampa оно обнулено с !important). */
      css.push(RES + ' .items-line__head{margin-bottom:.79em}');
      css.push(RES + ' .items-line__title{font-family:' + FB + ';font-weight:' + (APPLE ? '600' : '700') + ';font-size:' + (APPLE ? '1.67em' : '1.32em') + ';line-height:1.2;color:' + P.text + (APPLE ? ';letter-spacing:-.01em' : '') + '}');
      css.push('body.search--open .search .search__results .scroll--horizontal{padding-top:1.2em !important;padding-bottom:1.6em !important}');
      /* От заголовка до постера 18 px макета мало: фокус ×1.14 вместе с
         подписью растёт вверх на ~27 px и закрывал заголовок ряда (ТВ,
         Apple TV). Видимый зазор — 32 px (1.4em). */
      css.push(RES + ' .items-line__head + .items-line__body{margin-top:-.59em}');
      css.push(RES + ' .card{width:9.52em;margin-right:1.75em}');
      /* Ревью [perf]: Lampa даёт каждой .card will-change:transform
         (app.css) — слой на карточку при масштабе у .card__view; снят, как
         на главной (src/30_css.js). Отдельным правилом — ширину сторожит тест. */
      css.push(RES + ' .card{will-change:auto}');
      css.push(RES + ' .card__view,' + RES + ' .card__img{border-radius:' + V2.rImg + 'em}');
      css.push(RES + ' .card__title{display:block;max-height:none;margin-top:.45em;font-family:' + FB + ';font-weight:600;font-size:1.01em;line-height:1.25;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + P.text + ';-webkit-line-clamp:none}');
      css.push(RES + ' .card__age{margin-top:.1em;font-family:' + FB + ';font-weight:500;font-size:1.01em;line-height:1.25;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;color:' + MUTED + '}');
      if (typeof LC.badgesMode === 'function' && LC.badgesMode() !== 'off') css.push(RES + ' .card__vote{display:none}');
      /* QA v2 P3-10: белая плашка «TV» (.card__type) и жёлтая качества
         (.card__quality) на постерах — те же «пёстрые» плашки, что сняты на
         главной; сериалы и так в своём ряду «Сериалы». */
      css.push(RES + ' .card__type,' + RES + ' .card__quality{display:none}');
      /* Фокус постера — картинка по экрану 33: Lumen — ×1.10, рамка
         снаружи с зазором и тень; Apple TV — ×1.14 и тень без рамки. Масштаб
         остаётся и в «Лёгких» (фокус обязан быть виден без движения),
         переход — только в «Полных». */
      css.push(RES + ' .card.focus .card__view:after,' + RES + ' .card.hover .card__view:after{display:none}');
      /* QA main: масштаб — у картинки, не у всей карточки. Прежде .card.focus
         масштабировался целиком, и подпись под постером росла и съезжала;
         теперь она остаётся своего кегля и на месте (как на главной). */
      var SC = APPLE ? V2.scalePosterA : V2.scalePosterL;
      css.push(RES + ' .card.focus{z-index:2}');
      if (APPLE) {
        css.push(RES + ' .card.focus .card__view{-webkit-transform:scale(' + SC + ');transform:scale(' + SC + ');outline:0;-webkit-box-shadow:' + V2.shadowA + ';box-shadow:' + V2.shadowA + '}');
      } else {
        css.push(RES + ' .card.focus .card__view{-webkit-transform:scale(' + SC + ');transform:scale(' + SC + ');outline:' + V2.ring + 'em solid ' + P.text + ';outline-offset:' + V2.ringGap + 'em;-webkit-box-shadow:' + V2.shadowL + ';box-shadow:' + V2.shadowL + '}');
      }
      /* Ревью: у Lampa на .card__view в фокусе своя анимация
         (body.advanced--animation … .card.focus .card__view{animation:
         animation-card-focus .2s}, по Enter — animation-trigger-enter
         forwards; app.css, кадры — тот же transform) — она перебивала наш
         масштаб, и постер прыгал без него, потом щёлкал. Снята, как на
         главной (src/30_css.js). */
      css.push(RES + ' .card.focus .card__view,' + RES + ' .card.hover .card__view,' + RES + ' .card.animate-trigger-enter .card__view{-webkit-animation:none !important;animation:none !important}');
      css.push('body.lumen-motion-full.search--open .search .search__results .card__view{' + tr(APPLE ? V2.durA : V2.durL) + '}');

      /* QA main (08-search-empty-field-stale-results): пустое поле — рядов нет.
         На пустой запрос Lampa вызывает recall('') и заново строит ряды
         прошлого поиска из кэша (Results.search, app.min.js) — после
         стирания запроса справа оставались чужие результаты и их счётчики
         на вкладках. Поле и результаты — соседи в .search__body, класс
         filled поля ставит сама Lampa. Пульт в скрытые ряды не пускает
         LC.v2search.onToggle ниже. */
      css.push(S + ' .search__input:not(.filled) ~ .search__results .items-line,' + S + ' .search__input:not(.filled) ~ .search__sources .search-source__count{display:none}');

      /* --- Пустые состояния и «Идёт поиск». ---
         Текст Lampa один («Начните вводить…», «Ничего не найдено…») —
         заголовком P.text 38 px над лупой; контраст ≥ 4.5:1 и тот и другой. */
      css.push(RES + ' .search-looking{padding-left:1.5em}');
      css.push(RES + ' .search-looking__text{max-width:20em;margin-top:5.5em;font-family:' + FB + ';font-weight:' + (APPLE ? '600' : '700') + ';font-size:1.67em;line-height:1.2;color:' + P.text + '}');
      css.push(hasMask + '{' + RES + ' .search-looking__text:before{content:"";display:block;width:1.47em;height:1.47em;margin-bottom:.37em;color:' + MUTED + ';' + maskDecl(LC.icons.maskUrl('search')) + '}}');
      css.push(RES + ' .broadcast__text{padding-left:1.3em;font-family:' + FB + ';font-size:1.27em;color:' + (APPLE ? 'rgba(235,235,245,.85)' : P.soft) + '}');

      return css.join('\n');
    }

    LC.v2css.push({ id: 'search', order: 38, build: build });
  })();

  /* Рейтинг в подписи карточек поиска (см. шапку файла). Карточки Lampa
     дорисовывает по мере ответа источников, плашку .card__vote — уже после
     вставки карточки; поэтому — наблюдатель на открытом поиске. */
  LC.v2search = (function () {
    var obs = null;
    var installed = false;
    /* Вкладки источников открытого поиска — объект Sources Lampa из события
       Search.listener 'sources' (его toggle() — штатный вход в вкладки). */
    var sources = null;

    function mode() {
      try { return LC.badgesMode ? LC.badgesMode() : 'poster'; } catch (e) { return 'poster'; }
    }

    /* Подпись «2021» → «2021 · ★ 7.8». Идемпотентна (флаг на узле); без
       оценки ≥ 1 или без строки года ничего не делает. */
    function rateCard(card) {
      if (!card || card.lumen_v2rated) return false;
      var vote = card.querySelector('.card__vote');
      var age = card.querySelector('.card__age');
      if (!vote || !age) return false;
      var v = parseFloat(('' + vote.textContent).replace(',', '.'));
      if (!(v >= 1)) return false;
      var was = ('' + age.textContent).replace(/^\s+|\s+$/g, '');
      age.textContent = (was ? was + ' · ' : '') + '★ ' + v.toFixed(1);
      card.lumen_v2rated = true;
      return true;
    }

    function scan(root) {
      if (!root || !root.querySelectorAll) return 0;
      var cards = root.querySelectorAll('.search__results .card');
      var n = 0;
      for (var i = 0; i < cards.length; i++) if (rateCard(cards[i])) n++;
      return n;
    }

    function rootNode() {
      try {
        var r = window.Lampa && Lampa.Search && Lampa.Search.render ? Lampa.Search.render(true) : null;
        return r && r.querySelectorAll ? r : null;
      } catch (e) {
        return null;
      }
    }

    function stop() {
      if (obs) {
        try { obs.disconnect(); } catch (e) {}
        obs = null;
      }
    }

    function onOpen() {
      stop();
      if (mode() === 'off') return;
      var root = rootNode();
      if (!root) return;
      scan(root);
      if (typeof window.MutationObserver !== 'function') return;
      try {
        obs = new window.MutationObserver(function () { scan(root); });
        obs.observe(root, { childList: true, subtree: true });
      } catch (e) {
        warn('v2search: observe failed', e);
      }
    }

    function onClose() {
      stop();
      sources = null;
    }

    function onSources(e) {
      sources = e && e.sources && typeof e.sources.toggle === 'function' ? e.sources : null;
    }

    /* Запрос не пуст — класс filled на поле ставит Lampa (keyboard 'change'). */
    function filled(root) {
      var input = root && root.querySelector ? root.querySelector('.search__input') : null;
      return !!(input && input.classList && input.classList.contains('filled'));
    }

    function hasRows(root) {
      return !!(root && root.querySelector && root.querySelector('.search__results .items-line'));
    }

    function canMove(dir) {
      var nav = window.Navigator;
      try {
        return !!(nav && typeof nav.canmove === 'function' && nav.canmove(dir));
      } catch (e) {
        return true;
      }
    }

    /* Пульт поиска (QA main, QA v2 P3-10). Контроллеры Lampa собирает заново
       на каждом toggle — обёртка ставится на свежий объект после 'toggle'
       (подписка рантайма, src/90_runtime.js), как bindPair у второго экрана
       карточки (src/31_v2_card_lower.js):
         keybord        — «вправо» с крайней клавиши, где Navigator шага не
                          находит: в результаты штатным путём вкладок
                          (sources.toggle(), затем их «вниз»), если запрос не
                          пуст и ряды есть;
         search_sources — «вниз» при пустом запросе ничего не делает: ряды
                          прошлого поиска скрыты (CSS выше), фокус в них
                          ушёл бы в невидимое. */
    function onToggle(name) {
      try {
        if (!installed || !sources) return;
        if (name !== 'keybord' && name !== 'search_sources') return;
        var body = document.body;
        if (!body || !body.classList || !body.classList.contains('search--open')) return;
        /* Клавиатура ввода настроек (settings_input) — тот же 'keybord'. */
        if (body.classList.contains('keyboard-input--visible')) return;
        var en = Lampa.Controller.enabled();
        var c = en && en.name === name ? en.controller : null;
        if (!c || c.lumenSearchBound) return;
        var root = rootNode();
        if (!root) return;
        c.lumenSearchBound = true;
        if (name === 'keybord' && typeof c.right === 'function') {
          var right = c.right;
          c.right = function () {
            if (!canMove('right') && sources && filled(root) && hasRows(root)) {
              try {
                sources.toggle();
                var tabs = Lampa.Controller.enabled();
                if (tabs && tabs.name === 'search_sources' && tabs.controller && typeof tabs.controller.down === 'function') tabs.controller.down();
                return;
              } catch (err) {
                warn('v2search: right to results failed', err);
              }
            }
            return right.apply(this, arguments);
          };
        }
        if (name === 'search_sources' && typeof c.down === 'function') {
          var down = c.down;
          c.down = function () {
            if (!filled(root)) return;
            return down.apply(this, arguments);
          };
        }
      } catch (e) {
        warn('v2search: toggle failed', e);
      }
    }

    function install() {
      if (installed) return;
      try {
        if (!window.Lampa || !Lampa.Search || !Lampa.Search.listener) return;
        Lampa.Search.listener.follow('open', onOpen);
        Lampa.Search.listener.follow('close', onClose);
        Lampa.Search.listener.follow('sources', onSources);
        installed = true;
      } catch (e) {
        warn('v2search: install failed', e);
      }
    }

    function uninstall() {
      stop();
      if (!installed) return;
      try {
        Lampa.Search.listener.remove('open', onOpen);
        Lampa.Search.listener.remove('close', onClose);
        Lampa.Search.listener.remove('sources', onSources);
      } catch (e) {}
      installed = false;
      sources = null;
    }

    return { rateCard: rateCard, scan: scan, install: install, uninstall: uninstall, onToggle: onToggle };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.v2search;

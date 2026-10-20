  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экран 36: карточка ниже первого экрана.             */
  /*                                                                       */
  /* Штатные ряды Lampa под рядом описания — «Комментарии», «Актеры»,      */
  /* «Рекомендации», «Похожие», коллекция — получают ту же систему, что    */
  /* ряды главной: кромка 80 px FHD (3.51em), заголовок ряда, постер 201   */
  /* px, фокус v2 (картинка — масштаб, у L ещё кольцо; текст — заливка).   */
  /*                                                                       */
  /* Ряды Lampa в разметке не различаются (у всех                          */
  /* items-line--type-default, замер на ТВ 2026-10-20), поэтому модуль     */
  /* метит их сам по событию full/build (имя компонента приходит в e.name: */
  /* discuss, persons, cards) — вызов из followFull, src/90_runtime.js.    */
  /*                                                                       */
  /* Две колонки второго экрана: «Комментарии» и «Актеры», стоящие в       */
  /* списке рядов карточки рядом, встают в одну строку по 50 % ширины      */
  /* (inline-block). Соседство берётся из списка рядов компонента          */
  /* (e.link.rows), а не из DOM: ряд людей Lampa строит позже, при входе   */
  /* в ряд описания, и класс левой колонки комментариям нужен сразу.       */
  /* Порядок пульта при этом не меняется (вниз — следующий ряд списка), а  */
  /* верх у обеих колонок один, поэтому прокрутка Lampa (Scroll.update к   */
  /* верху ряда) при переходе «комментарии → актёры» не двигает экран.     */
  /* -------------------------------------------------------------------- */

  LC.cardLower = (function () {
    /* metadata_chart / metadata_tags — ряды анализа Lampa («Метаданные»,
       «Настроения»): им — только кромка и заголовок. */
    var NAMES = { discuss: 1, persons: 1, cards: 1, metadata_chart: 1, metadata_tags: 1 };

    function trim(s) {
      return String(s == null ? '' : s).replace(/^\s+|\s+$/g, '');
    }

    function nameOf(row) {
      if (!row) return '';
      if (typeof row === 'string') return row;
      return row[0] || '';
    }

    /* Индекс ряда с этими данными в списке компонента. */
    function indexOf(rows, data) {
      if (!rows || !rows.length) return -1;
      for (var i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (row && typeof row !== 'string' && row[1] === data) return i;
      }
      return -1;
    }

    /* Сторона ряда в паре «Комментарии | Актеры»: 'left', 'right' или ''.
       Пара — два соседа в списке рядов, один discuss, другой persons. */
    function sideOf(rows, data, name) {
      var i = indexOf(rows, data);
      if (i < 0) return '';
      var other = name === 'discuss' ? 'persons' : name === 'persons' ? 'discuss' : '';
      if (!other) return '';
      if (nameOf(rows[i + 1]) === other) return 'left';
      if (i > 0 && nameOf(rows[i - 1]) === other) {
        /* Слева может стоять только первый из пары: у Lampa бывает два
           ряда persons подряд (режиссёры отдельно, если актёров нет). */
        return 'right';
      }
      return '';
    }

    /* Отзывы Кинопоиска без ключа — одна тихая строка в шапке
       «Комментариев» вместо панели-подсказки (SPEC 36). */
    function needsKeyLine() {
      try {
        if (!LC.pref('lumen_reviews', true)) return false;
        return !trim(LC.pref('lumen_kp_key', ''));
      } catch (e) { return false; }
    }

    /* Строка о ключе в шапке ряда — ровно по needsKeyLine(): нужна и её
       нет — дописать, не нужна — снять. Возвращает «строка в шапке есть». */
    function syncKeyLine(line) {
      var head = line.find('.items-line__head').eq(0);
      if (!head.length) return false;
      var had = head.find('.lumen-lower__kp');
      if (!needsKeyLine()) {
        had.remove();
        return false;
      }
      if (!had.length) head.find('.items-line__title').eq(0).after('<div class="lumen-lower__kp">' + LC.util.esc(LC.lang('lumen_lower_kp_line')) + '</div>');
      return true;
    }

    /* Класс на теле активности прячет панель «нет ключа» в ряду описания —
       только пока строка о ключе стоит в шапке «Комментариев». */
    function markBody(body, on) {
      if (!body || !body.length) return;
      if (on) body.addClass('lumen-lower-kp');
      else body.removeClass('lumen-lower-kp');
    }

    function decorateDiscuss(line, body) {
      markBody(body, syncKeyLine(line));
      labelAdd(line);
    }

    /* Ключ Кинопоиска ввели или стёрли в настройках поверх открытой
       карточки: 'full' повторно не приходит, и строку о ключе вместе с
       классом на теле перечитывает LC.applyReviewsPref (src/90_runtime.js).
       body — тело активности карточки (e.body события 'full'). */
    function refresh(body) {
      try {
        if (!body || !body.length) return;
        var lines = body.find('.items-line.lumen-lower--discuss');
        var on = false;
        for (var i = 0; i < lines.length; i++) {
          if (syncKeyLine(lines.eq(i))) on = true;
        }
        markBody(body, on);
      } catch (err) {
        warn('card lower refresh failed', err);
      }
    }

    /* Подпись «Написать» у плитки добавления комментария: у Lampa там
       только иконка (::before), а макет даёт иконку и слово. */
    function labelAdd(line) {
      var add = line.find('.full-review-add').eq(0);
      if (!add.length || add.find('.lumen-lower__add').length) return;
      add.append('<span class="lumen-lower__add">' + LC.util.esc(LC.lang('lumen_lower_write')) + '</span>');
    }

    function lineOf(item) {
      if (!item || typeof item.render !== 'function') return null;
      var node = item.render(true);
      if (!node) return null;
      var line = $(node);
      return line.length && line.hasClass('items-line') ? line : null;
    }

    /* QA v2 (P2-2): пульт между колонками. Колонки стоят в одну строку, но
       для Lampa это два ряда подряд: «вправо» с последней плитки левой
       колонки уходило в пустоту (контроллер items_line двигает только
       Navigator внутри ряда, app.min.js:36096-36101), а «влево» с первой
       плитки правой — в меню. Контроллер ряд собирает заново на каждом
       toggle и перед Controller.add отдаёт модулям событием 'controller' —
       та же точка расширения, что у bindStart (src/85_header.js). Там, где
       Navigator шага не находит, левая колонка делает шаг «вниз», правая —
       «вверх»: это и есть соседняя колонка (пара — соседи в списке рядов),
       а фокус в ней Lampa возвращает туда, где он стоял в прошлый раз (last). */
    function bindPair(item, side) {
      if (!item || typeof item.use !== 'function' || item.lumenPairBound) return;
      item.lumenPairBound = true;
      item.use({
        onController: function (controller) {
          if (!controller) return;
          var key = side === 'left' ? 'right' : 'left';
          var step = side === 'left' ? controller.down : controller.up;
          var move = controller[key];
          if (typeof move !== 'function' || typeof step !== 'function') return;
          controller[key] = function () {
            var nav = window.Navigator;
            try {
              if (nav && typeof nav.canmove === 'function' && !nav.canmove(key)) return step.apply(this, arguments);
            } catch (err) {
              warn('card lower pair move failed', err);
            }
            return move.apply(this, arguments);
          };
        }
      });
    }

    /* e — событие Lampa 'full' (type 'build'). */
    function tag(e) {
      try {
        if (!e || e.type !== 'build' || !NAMES[e.name]) return;
        var line = lineOf(e.item);
        if (!line) return;
        line.addClass('lumen-lower lumen-lower--' + e.name);
        var side = sideOf(e.link && e.link.rows, e.data, e.name);
        line.removeClass('lumen-lower--left lumen-lower--right');
        if (side) {
          line.addClass('lumen-lower--' + side);
          bindPair(e.item, side);
        }
        if (e.name === 'discuss') {
          decorateDiscuss(line, e.body);
          /* Плитку «Написать» ряд может дорисовать после build. */
          setTimeout(function () {
            try { labelAdd(line); } catch (e2) { }
          }, 0);
        }
      } catch (err) {
        warn('card lower tag failed', err);
      }
    }

    /* Панель «Ключ API не задан» под рядом описания не рисуется: строка о
       ключе — в шапке «Комментариев» (SPEC 36). Читает src/60_reviews.js. */
    var api = {
      tag: tag,
      refresh: refresh,
      sideOf: sideOf,
      bindPair: bindPair,
      needsKeyLine: needsKeyLine,
      quietKey: true
    };
    return api;
  })();

  /* --- CSS экрана 36 (точка подключения — LC.v2css, src/30_css.js) ---
     Числа макета — FHD, em — от базового кегля Lampa 22.811 px:
     80 px = 3.51em, 40 = 1.75em, 30 = 1.32em, 38 = 1.67em, 23 = 1.01em,
     201 = 8.81em, 110 = 4.82em, 195 = 8.55em, 320 = 14.03em,
     300 = 13.15em, 150 = 6.58em, 120 = 5.26em, 16 = .7em, 52 = 2.28em. */
  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'card-lower',
    order: 36,
    build: function (ctx) {
      var P = ctx.P;
      var V2 = ctx.V2;
      var A = !!ctx.APPLE;
      var css = [];
      var L = 'body .items-line.lumen-lower';
      var EDGE = '3.51em';
      var HALF = '1.75em';
      /* Кромка минус половина зазора: 80 − 40 px FHD. */
      var SEAM = '1.76em';
      var MUTED = A ? 'rgba(235,235,245,.64)' : P.muted;
      var LINE = 'rgba(255,255,255,.16)';
      function tf(v) { return '-webkit-transform:' + v + ';transform:' + v; }
      function shadow(v) { return '-webkit-box-shadow:' + v + ';box-shadow:' + v; }
      var RING = 'outline:.13em solid ' + P.text + ';outline-offset:.13em';
      var IMG_FOCUS = A ? (tf('scale(' + V2.scalePosterA + ')') + ';' + shadow(V2.shadowA) + ';outline:0')
        : (tf('scale(' + V2.scalePosterL + ')') + ';' + shadow(V2.shadowL) + ';' + RING);
      /* Переход масштаба — только в «Полных» анимациях, гейтом по классу
         режима на body: смена lumen_motion таблицу стилей не пересобирает
         (LC.applyMotionMode переставляет лишь классы), как в
         src/31_v2_search.js. */
      var TR = '-webkit-transition:-webkit-transform ' + (A ? V2.durA : V2.durL) + 'ms ease-out;transition:transform ' + (A ? V2.durA : V2.durL) + 'ms ease-out';
      var LM = 'body.lumen-motion-full .items-line.lumen-lower';

      /* Ряд: кромка, воздух между рядами, заголовок как у рядов главной. */
      css.push(L + '{padding-bottom:2.1em}');
      css.push(L + ' .items-line__head{padding-left:' + EDGE + ';padding-right:' + EDGE + ';margin-bottom:.79em;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline}');
      css.push(L + ' .items-line__title{font-weight:' + (A ? 600 : 700) + ';font-size:' + (A ? '1.67em' : '1.32em') + ';line-height:1.15;letter-spacing:' + (A ? '-.01em' : '0') + ';color:' + P.text + '}');
      css.push(L + ' .scroll--horizontal .scroll__content{padding-left:' + EDGE + ';padding-right:' + EDGE + '}');
      /* «Ещё» в шапке ряда — тихий текст, фокус — заливка. */
      css.push(L + ' .items-line__more{background:none;color:' + MUTED + ';font-size:1.01em;padding:.3em .7em;border-radius:.5em}');
      css.push(L + ' .items-line__more.focus{background:' + (A ? V2.fillA : P.text) + ';color:' + (A ? '#000' : P.bg) + '}');

      /* Две колонки: «Комментарии» | «Актеры». */
      css.push(L + '.lumen-lower--left,' + L + '.lumen-lower--right{display:inline-block;vertical-align:top;width:50%;overflow:hidden;-webkit-box-sizing:border-box;box-sizing:border-box}');
      css.push(L + '.lumen-lower--left .items-line__head{padding-right:' + HALF + '}');
      css.push(L + '.lumen-lower--right .items-line__head{padding-left:' + HALF + '}');
      /* QA v2 (P2-2): поля ленты в колонке симметричны. Предел прокрутки
         Lampa считает как ширина ленты + ДВА левых поля (maxOffset,
         app.min.js:32714-32721), а у левой колонки правое поле вдвое уже
         левого — лента уезжала на 1.76em дальше нужного, и плитка «Написать»
         при двух комментариях, влезавших целиком, срезалась левой кромкой.
         Поэтому поле ленты с обеих сторон одно (левая колонка — кромка,
         правая — половина зазора), а разницу до макета даёт ширина самой
         прокрутки: у левой она заходит за шов колонок (там её режет
         overflow колонки), у правой на столько же не доходит до кромки
         экрана. Плитки на месте покоя стоят там же, где стояли. */
      css.push(L + '.lumen-lower--left .scroll--horizontal{margin-right:-' + SEAM + '}');
      css.push(L + '.lumen-lower--right .scroll--horizontal{margin-right:' + SEAM + '}');
      css.push(L + '.lumen-lower--right .scroll--horizontal .scroll__content{padding-left:' + HALF + ';padding-right:' + HALF + '}');
      /* Колонки режутся по своей половине, а не маской Lampa по краям. */
      css.push(L + '.lumen-lower--left .scroll--mask,' + L + '.lumen-lower--right .scroll--mask{-webkit-mask-image:none;mask-image:none}');

      /* Строка о ключе Кинопоиска в шапке «Комментариев». */
      css.push(L + ' .lumen-lower__kp{margin-left:.78em;font-size:1.01em;font-weight:500;line-height:1.2;color:' + MUTED + ';white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;min-width:0}');
      css.push('body .lumen-lower-kp .lumen-descr-row .lumen-reviews[data-lumen-state="nokey"]{display:none}');

      /* Постеры «Рекомендаций», «Похожих», коллекции — одна ширина 201 px. */
      var C = L + '.lumen-lower--cards';
      css.push(C + ' .mapping--line > * + *{margin-left:' + HALF + '}');
      css.push(C + ' .card{width:8.81em}');
      css.push(C + ' .card__view{border-radius:' + V2.rImg + 'em}');
      css.push(LM + '.lumen-lower--cards .card__view{' + TR + '}');
      css.push(C + ' .card__img{border-radius:' + V2.rImg + 'em}');
      css.push(C + ' .card.focus .card__view{' + IMG_FOCUS + '}');
      css.push(C + ' .card.focus .card__view:after,' + C + ' .card.hover .card__view:after{display:none}');
      css.push(C + ' .card__title{font-size:1.01em;font-weight:500;line-height:1.25;margin-top:.44em;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;max-height:none;display:block}');
      css.push(C + ' .card__age{font-size:1.01em;line-height:1.25;color:' + MUTED + '}');

      /* «Актеры»: круг 110 px, имя и роль под ним, без белой плашки. */
      var Pp = L + '.lumen-lower--persons';
      css.push(Pp + ' .mapping--line > * + *{margin-left:.88em}');
      css.push(Pp + ' .full-person{font-size:1em;width:8.55em;padding:.6em 0 0;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:center;-webkit-align-items:center;align-items:center;text-align:center;background:none;border-radius:0;color:' + P.text + '}');
      css.push(Pp + ' .full-person.focus,' + Pp + ' .full-person.hover{background:none;color:' + P.text + '}');
      css.push(Pp + ' .full-person__photo{width:4.82em;height:4.82em;margin:0 0 .44em;border-radius:50%}');
      css.push(LM + '.lumen-lower--persons .full-person__photo{' + TR + '}');
      css.push(Pp + ' .full-person.focus .full-person__photo{' + IMG_FOCUS + '}');
      css.push(Pp + ' .full-person__body{-webkit-box-flex:0;-webkit-flex:none;flex:none;width:100%}');
      css.push(Pp + ' .full-person__name{font-size:1.01em;font-weight:500;line-height:1.2}');
      css.push(Pp + ' .full-person__role{font-size:1.01em;font-weight:500;line-height:1.2;margin-top:.09em;color:' + MUTED + '}');

      /* «Комментарии»: без пунктира; L — тихие плитки, A — плоский текст. */
      var D = L + '.lumen-lower--discuss';
      css.push(D + ' .mapping--line > * + *{margin-left:' + (A ? HALF : '.88em') + '}');
      css.push(D + ' .full-review{-webkit-box-sizing:border-box;box-sizing:border-box;width:' + (A ? '13.15em' : '14.03em') + ';min-width:0;max-width:none;height:5.26em;padding:.53em .88em;border-radius:.7em;background:' + (A ? 'none' : P.panel) + ';color:' + P.text + '}');
      css.push(D + ' .full-review__text{font-size:1.01em;line-height:1.3;margin-bottom:.3em}');
      css.push(D + ' .full-review__footer{font-size:1.01em;color:' + MUTED + '}');
      css.push(D + ' .full-review__user{margin-right:.7em;min-width:0}');
      css.push(D + ' .full-review__user-icon{display:none}');
      css.push(D + ' .full-review__user-email{max-width:8em}');
      css.push(D + ' .full-review__like-icon{margin-right:.3em}');
      css.push(D + ' .full-review.focus{background:' + (A ? V2.blockA : P.text) + ';color:' + (A ? P.text : P.bg) + '}');
      css.push(D + ' .full-review.focus .full-review__footer{color:inherit;opacity:.72}');
      /* Плитка «Написать»: L — плитка 150×120, A — чип 52 px. */
      css.push(D + ' .full-review-add{-webkit-box-sizing:border-box;box-sizing:border-box;border:0;min-height:0;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;color:' + P.text + ';' +
        (A ? 'width:auto;height:2.28em;padding:0 1.05em;border-radius:1.14em;background:' + LINE + ';-webkit-align-self:flex-start;align-self:flex-start'
          : 'width:6.58em;height:5.26em;padding:0;border-radius:.7em;background:' + P.panel + ';-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column') + '}');
      css.push(D + ' .full-review-add:before{position:static;margin:' + (A ? '0 .44em 0 0' : '0 0 .44em') + ';width:' + (A ? '.96em' : '1.32em') + ';height:' + (A ? '.96em' : '1.32em') + ';-webkit-flex-shrink:0;flex-shrink:0}');
      css.push(D + ' .full-review-add.focus:after{display:none}');
      css.push(D + ' .full-review-add.focus{background:' + (A ? V2.fillA : P.text) + ';color:' + (A ? '#000' : P.bg) + '}');
      css.push(D + ' .full-review-add.focus:before{-webkit-filter:invert(1);filter:invert(1)}');
      css.push(D + ' .lumen-lower__add{font-size:1.01em;font-weight:500;line-height:1.2;white-space:nowrap}');

      /* «Подробно»: счётчики разделов — тихий текст без плашек (оба стиля;
         фокус — штатная заливка Lampa, её не трогаем). */
      css.push('.lumen-descr-row .tag-count:not(.focus){background-color:transparent;padding-left:0;padding-right:0}');
      css.push('.lumen-descr-row .tag-count__name{font-size:1.01em;padding:.2em .3em .2em 0}');
      css.push('.lumen-descr-row .tag-count__count{font-size:1.01em;font-weight:500;padding:.2em .3em}');
      css.push('.lumen-descr-row .tag-count:not(.focus) .tag-count__name{color:' + MUTED + '}');
      css.push('.lumen-descr-row .tag-count:not(.focus) .tag-count__count{background-color:transparent;color:' + MUTED + ';padding-left:0}');
      css.push('.lumen-descr-row .tag-count + .tag-count:not(.focus):before{content:"\\00B7";color:' + MUTED + ';margin-right:.5em;font-size:1.01em}');
      /* Строка «ПОДРОБНО» в словаре — капсом (метка прежнего вида); заголовок
         ряда v2 — «Подробно»: строчные и заглавная первая буква. */
      css.push('.lumen-descr-row .lumen-facts__title{text-transform:lowercase}');
      css.push('.lumen-descr-row .lumen-facts__title:first-letter{text-transform:uppercase}');
      if (A) {
        /* Apple: «Подробно» плоско — заголовок ряда и строка фактов под
           линией, без подложки (сам плоский вид — в src/30_css.js). */
        css.push('.lumen-descr-row .lumen-facts__title{display:block;font-weight:600;font-size:1.67em;line-height:1.15;letter-spacing:-.01em;color:' + P.text + ';margin-bottom:.5em}');
        css.push('.lumen-descr-row .lumen-facts__grid{border-top:.04em solid ' + LINE + ';padding-top:.79em}');
        css.push('.lumen-descr-row .lumen-facts__label{color:' + MUTED + '}');
        /* «The Odyssey· Премьера»: у значения нет отступа до «·». */
        css.push('.lumen-descr-row .lumen-facts__value{margin-right:.3em}');
      } else {
        /* Lumen: мягкая панель, факты в две пары колонок. */
        css.push('.lumen-descr-row .lumen-facts{background:' + P.panel + ';border-color:transparent;border-radius:.7em;padding:1.05em 1.23em}');
        css.push('.lumen-descr-row .lumen-facts__title{font-weight:700;font-size:1.32em;line-height:1.2;letter-spacing:0;color:' + P.text + ';margin-bottom:.6em}');
        css.push('@supports (display:grid){.lumen-descr-row .lumen-facts__grid{grid-template-columns:auto 1fr auto 1fr;grid-row-gap:.35em;grid-column-gap:1.05em;row-gap:.35em;column-gap:1.05em}}');
      }
      return css.join('\n');
    }
  });

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardLower;

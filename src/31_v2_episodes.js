  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экран 37: сериал — ряд серий (оба стиля).          */
  /* Спецификация: docs/design/v2-unify/SPEC.txt, раздел 37; макеты        */
  /* «37-L» и «37-A» в v2-unify.dc.html. Логика ряда (окно узлов, сдвиг к  */
  /* кромке, сезоны, порядок пульта) — src/85_header.js; снятие штатного   */
  /* ряда Lampa — src/90_runtime.js (dropEpisodesRow).                     */
  /*                                                                       */
  /* Числа макета даны для FHD 1920 (4K — вдвое), em = 22.8 px:            */
  /*   плитка 360 × 203 → 15.79 × 8.88em, зазор 40 → 1.75em;               */
  /*   подпись 23 px → 1.01em, отступ подписи 12 → .53em;                  */
  /*   полоса прогресса L 6 px у нижней кромки кадра → .26em, акцент;      */
  /*   A 5 px в треке .28 с полями 14/12 → .22em, .61em, .53em;            */
  /*   чип сезона L 52 px, поля 24, радиус 26 → 2.28em, 1.05em, 1.14em;    */
  /*   таб сезона A — подчёркивание 3 px → .13em.                           */
  /* -------------------------------------------------------------------- */

  /* Метрика плитки — общий источник LC.episodeEm (src/30_css.js, Task 67):
     по нему пишется ширина плитки в базовом правиле и считаются окно узлов
     и распорка дорожки в src/85_header.js. Модуль грузится после 30_css.js
     и до первой сборки таблицы, поэтому правка доходит до обоих сразу. */
  if (LC.episodeEm) {
    LC.episodeEm.width = 15.79;
    LC.episodeEm.gap = 1.75;
  }

  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'episodes',
    order: 37,
    build: function (ctx) {
      var P = ctx.P;
      var V2 = ctx.V2;
      var APPLE = ctx.APPLE;
      var tokens = typeof LC.tokens === 'function' ? LC.tokens() : {};
      var A = tokens.accent || P.text;
      var H = 8.88;
      var css = [];
      var check = 'content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.96em;height:.96em;margin-right:.44em;background-color:' + A + ';-webkit-mask-image:' + LC.icons.maskUrl('check') + ';mask-image:' + LC.icons.maskUrl('check') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain';

      /* Плитка = кадр 16:9; подпись — ПОД кадром (макет), поэтому у плитки
         больше нет overflow:hidden: скругление держат сам кадр и верхняя
         строка. Высота ряда — кадр плюс подпись плюс запас на масштаб
         фокуса (1.08/1.09 — по .36/.40em сверху и снизу). */
      var rowH = APPLE ? H + 3.6 : H + 2.3;
      css.push('.lumen-card .lumen-episodes__viewport{height:' + ctx.round2(rowH) + 'em}');
      css.push('.lumen-card .lumen-episodes__track{height:' + H + 'em}');
      css.push('.lumen-card .lumen-episode{height:' + H + 'em;overflow:visible}');
      css.push('.lumen-card .lumen-episode__still{border-radius:inherit}');
      css.push('.lumen-card .lumen-episode__top{background:none;border-top-left-radius:inherit;border-top-right-radius:inherit}');
      /* Отметка просмотра и процент лежат на кадре — им оставлено
         затемнение сверху. */
      css.push('.lumen-card .lumen-episode--watched .lumen-episode__top,.lumen-card .lumen-episode--watching .lumen-episode__top{background:-webkit-linear-gradient(top,rgba(' + P.bgRgb + ',.72) 0%,rgba(' + P.bgRgb + ',0) 100%);background:linear-gradient(180deg,rgba(' + P.bgRgb + ',.72) 0%,rgba(' + P.bgRgb + ',0) 100%)}');
      /* «E1» на кадре уходит: номер — в подписи, «1. После часа». */
      css.push('.lumen-card .lumen-episode__num{display:none}');
      /* Пробел после точки — неразрывный: обычный в конце ::before
         схлопывается (проверка на ТВ: «1.После часа»). */
      css.push('.lumen-card .lumen-episode__name:before{content:attr(data-n) ".\\00a0"}');

      /* Подпись под кадром: блок встаёт абсолютно сразу под плиткой, а
         полоса прогресса в нём — отрицательным top обратно на кадр. */
      css.push('.lumen-card .lumen-episode__bottom,.lumen-card .lumen-episode.focus .lumen-episode__bottom,.lumen-card .lumen-episode--cut.focus .lumen-episode__bottom{position:absolute;top:100%;left:0;right:0;padding:.53em 0 0;background:none}');
      css.push('.lumen-card .lumen-episode__name{font-size:1.01em;line-height:1.25;color:' + P.text + '}');
      css.push('.lumen-card .lumen-episode.focus .lumen-episode__name,.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + P.text + '}');
      css.push('.lumen-card .lumen-episode__caption,.lumen-card .lumen-episode__timecode{font-size:1.01em;line-height:1.25;margin-top:0;color:' + P.muted + '}');
      /* Длительность видна и в фокусе (ревью Lumen #11): правило Task 8
         подменяло её таймкодом в сжатой шапке — здесь подпись остаётся
         всегда, таймкод не показывается. */
      css.push('.lumen-card .lumen-episode.focus .lumen-episode__caption,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{display:block;color:' + P.soft + '}');
      css.push('.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__timecode,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__state{display:none}');

      /* Плитка за левой кромкой ряда (класс ставит markClipped) — скрыта:
         фокус стоит у кромки первой видимой плиткой, срезанной слева нет. */
      css.push('.lumen-card .lumen-episodes .lumen-episode--past:not(.focus){opacity:0}');

      if (!APPLE) {
        /* L: «N. Название» и длительность справа в одной строке. */
        css.push('.lumen-card .lumen-episode__bottom{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:baseline;-webkit-align-items:baseline;align-items:baseline}');
        css.push('.lumen-card .lumen-episode__name{-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;min-width:0}');
        css.push('.lumen-card .lumen-episode__caption{-webkit-flex-shrink:0;flex-shrink:0;max-width:55%;margin-left:.53em}');
        /* Полоса прогресса — 6 px акцентом по нижней кромке кадра, без трека. */
        css.push('.lumen-card .lumen-episode__bar,.lumen-card .lumen-episode.focus .lumen-episode__bar{position:absolute;left:0;right:0;top:-.26em;height:.26em;margin:0;border-radius:0 0 .42em .42em;background:none}');
        css.push('.lumen-card .lumen-episode__bar > div,.lumen-card .lumen-episode.focus .lumen-episode__bar > div{border-radius:0;background:' + A + '}');
      } else {
        /* A: название и длительность — двумя строками. */
        css.push('.lumen-card .lumen-episode__caption{margin-top:.09em;color:rgba(235,235,245,.64)}');
        css.push('.lumen-card .lumen-episode.focus .lumen-episode__caption,.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption{color:rgba(235,235,245,.8)}');
        /* Полоса — белая в треке .28, с полями внутри кадра. */
        css.push('.lumen-card .lumen-episode__bar,.lumen-card .lumen-episode.focus .lumen-episode__bar{position:absolute;left:.61em;right:.61em;top:-.75em;height:.22em;margin:0;border-radius:.13em;background:rgba(255,255,255,.28)}');
        css.push('.lumen-card .lumen-episode__bar > div,.lumen-card .lumen-episode.focus .lumen-episode__bar > div{border-radius:.13em;background:#FFFFFF}');
      }

      /* Шапка ряда: чипы сезонов и «8 серий» строчными (макет), заголовок
         «Сезон N» прячется, когда есть чипы — сезон назван в них. */
      css.push('.lumen-card .lumen-episodes__head{-webkit-box-align:center;-webkit-align-items:center;align-items:center;margin-bottom:1.2em}');
      css.push('.lumen-card .lumen-episodes--seasons .lumen-episodes__title{display:none}');
      css.push('.lumen-card .lumen-episodes__count{text-transform:none;letter-spacing:0;color:' + P.muted + ';margin-left:.44em}');
      css.push('.lumen-card .lumen-seasons{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-wrap:nowrap;flex-wrap:nowrap;-webkit-flex-shrink:0;flex-shrink:0}');
      css.push('.lumen-card .lumen-seasons.hide{display:none}');
      css.push('.lumen-card .lumen-season{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-flex-shrink:0;flex-shrink:0;white-space:nowrap;font-size:1.01em;font-weight:500;line-height:1}');
      if (!APPLE) {
        /* L: чип; выбранный — галочка акцентом, фокус — заливка. */
        css.push('.lumen-card .lumen-season{height:2.26em;padding:0 1.04em;margin-right:.61em;border-radius:1.13em;background:' + P.buttonBg + ';color:' + P.soft + '}');
        css.push('.lumen-card .lumen-season--on{color:' + P.text + '}');
        css.push('.lumen-card .lumen-season--on:before{' + check + '}');
        css.push('.lumen-card .lumen-season.focus{background:' + P.text + ';color:' + P.bg + '}');
        css.push('.lumen-card .lumen-season--on.focus:before{background-color:' + P.bg + '}');
      } else {
        /* A: табы; выбранный — подчёркивание, фокус — белая заливка. */
        css.push('.lumen-card .lumen-season{font-size:1.1em;font-weight:600;padding:.3em .5em;margin-right:.7em;border-radius:.3em;color:rgba(235,235,245,.64)}');
        css.push('.lumen-card .lumen-seasons .lumen-season:first-child{margin-left:-.5em}');
        css.push('.lumen-card .lumen-season--on{color:#FFFFFF;-webkit-box-shadow:inset 0 -.13em 0 #FFFFFF;box-shadow:inset 0 -.13em 0 #FFFFFF}');
        css.push('.lumen-card .lumen-season.focus{background:' + V2.fillA + ';color:#000000;-webkit-box-shadow:none;box-shadow:none}');
        css.push('.lumen-card .lumen-episodes__count{color:rgba(235,235,245,.64)}');
      }
      css.push(LC.icons.NO_MASK + '{.lumen-card .lumen-season--on:before{display:none}}');
      return css.join('\n');
    }
  });

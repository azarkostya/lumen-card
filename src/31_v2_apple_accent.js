  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль»: Apple TV без тёплых цветов в метках и полосах.     */
  /* -------------------------------------------------------------------- */

  /* Акцент в Apple TV — только из настроек (theme() в src/30_css.js), но
     часть правил карточки красится не акцентом:
     - «спайс» (#D9622B, P.spice) — фиксированный оранжевый: негативный
       отзыв и метка «скоро» части франшизы. В Apple TV негатив — системный
       красный #FF453A, «скоро» — тихий вторичный текст;
     - полосы прогресса карточки, сетки и меток ряда — акцентом; в Apple TV
       полоса белая, как у ряда серий (src/31_v2_episodes.js).
     Правила те же по весу, что в src/30_css.js, и стоят позже — побеждают
     порядком. Lumen не получает отсюда ничего. */

  LC.v2css = LC.v2css || [];

  LC.v2css.push({
    id: 'apple-accent',
    order: 99,
    build: function (ctx) {
      if (!ctx.APPLE) return '';
      var P = ctx.P;
      var RED = '#FF453A';
      var r = [];
      r.push('.lumen-descr-row .lumen-review--bad .lumen-review__tone,.lumen-descr-row .lumen-review--bad.focus .lumen-review__tone,.lumen-review-modal--bad .lumen-review-modal__tone{background:' + RED + '}');
      r.push('.lumen-descr-row .lumen-fr-card__flag--soon{color:' + P.soft + '}');
      r.push('.lumen-card .lumen-progress__bar > div,.lumen-grid .lumen-gcard__bar > div,.lumen-main .lumen-badge-bar > div{background:#FFFFFF}');
      /* Процедурные фоны карточки без кадра (proc0 «закат» #D9622B/#E8B87A,
         proc1 оливковый, proc2 голубой — src/30_css.js): в Apple TV все три
         — один нейтральный тёмный градиент. Тот же вес, правило позже. */
      r.push('.lumen-backdrop--proc0 .lumen-backdrop__img,.lumen-backdrop--proc1 .lumen-backdrop__img,.lumen-backdrop--proc2 .lumen-backdrop__img{background:linear-gradient(180deg,#0B0B0D 0%,#1D1D21 55%,#0B0B0D 100%)}');
      /* Штатные жёлтые метки Lampa на экранах, которые плагин не
         оформляет (Избранное, закладки, категории): качество на постере
         (#ffe216, app.css .card__quality), точка «Просмотрено» (#FFD028,
         .card__marker--viewed) и качество в шапке штатной карточки
         (.full-start__tag.tag--quality). В Apple TV — белая подпись на
         тёмной плашке и серая точка; метки остаются видны. На класс
         тяжелее штатных (html body …), светлая версия Lampa
         (body.light--version) их по-прежнему перекрывает. */
      r.push('html body .card__quality{background:rgba(28,28,30,.85);color:#FFFFFF}');
      r.push('html body .card__marker--viewed::before{background-color:rgba(235,235,245,.6)}');
      r.push('html body .full-start__tag.tag--quality{background:rgba(255,255,255,.16);color:#FFFFFF}');
      /* Сезонные темы (решение владельца 21.10.2026): в Apple TV фон не
         подкрашивается — тыквенное зарево Хэллоуина снято, остаётся
         нейтральная дымка; частицы (летучие мыши) — своим цветом, как в
         Lumen. Вес выше правил src/30_css.js (html body …). */
      var MIST = '176,168,196';
      var mist = 'radial-gradient(ellipse 38% 18% at 78% 100%,rgba(' + MIST + ',.3) 0%,rgba(' + MIST + ',.12) 55%,rgba(' + MIST + ',0) 100%),' +
        'radial-gradient(ellipse 32% 13% at 46% 102%,rgba(' + MIST + ',.2) 0%,rgba(' + MIST + ',.07) 55%,rgba(' + MIST + ',0) 100%),' +
        'radial-gradient(ellipse 26% 10% at 12% 103%,rgba(' + MIST + ',.07) 0%,rgba(' + MIST + ',0) 100%)';
      r.push('html body .lumen-backdrop.lumen-theme--halloween .lumen-fx,html body .lumen-hero.lumen-theme--halloween .lumen-fx{background-image:none}');
      r.push('html body .lumen-backdrop.lumen-theme--halloween .lumen-fx.lumen-fx--scene,html body .lumen-hero.lumen-theme--halloween .lumen-fx.lumen-fx--scene,html body .lumen-hero .lumen-fx.lumen-fx--halloween{background-image:' + mist + '}');
      return r.join('\n');
    }
  });

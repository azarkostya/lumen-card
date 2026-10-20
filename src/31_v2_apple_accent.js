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
      return r.join('\n');
    }
  });

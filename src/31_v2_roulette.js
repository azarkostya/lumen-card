  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экран 45: «Что посмотреть» (SPEC.txt, раздел 45;   */
  /* ревью Lumen #17, #18, Apple TV #27).                                  */
  /*                                                                       */
  /* Старт: фон из кадра главной карточки выборки и в стиле Lumen (было    */
  /* плоское чёрное), вуаль — как у вида «как Apple TV». Галочка чипов и   */
  /* «Крутить» с фокусом-заливкой — часть 1 (src/30_css.js, блок v2).      */
  /* Итог: компонент героя главной — логотип (src/56_roulette.js,          */
  /* paintResultLogo, в обоих стилях), мета, описание 29/500 FHD; кнопки   */
  /* как у карточки фильма — 64 px FHD (128 на 4K), 25/600, радиус 12.      */
  /* Вращение: текст главной карточки выборки слева (вид «как Apple TV»)   */
  /* гаснет до opacity 0 — переходом только в «Полных», в «Лёгких» сразу.  */
  /* Барабан, его скорость и раскладка вида Apple TV не трогаются.          */
  /*                                                                       */
  /* Единица: 1em корня .lumen-roulette = 22.811 px FHD × масштаб           */
  /* интерфейса. Без blur, анимируется только opacity.                     */
  /* -------------------------------------------------------------------- */

  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'roulette',
    order: 45,
    build: function (ctx) {
      var P = ctx.P;
      var css = [];
      var S = '.lumen-roulette-screen';
      var ATV = S + '.is-atv';
      var R = S + ' .lumen-roulette';
      var bgA = function (a) { return 'rgba(' + P.bgRgb + ',' + a + ')'; };

      /* Старт, стиль Lumen: кадр w300 во весь экран (сам расплывается на
         растяжении — без filter) под вуалью слева и снизу. */
      css.push(S + ':not(.is-atv):not(.is-kadr) .lumen-roulette__bg{opacity:.6}');
      css.push(S + ':not(.is-atv):not(.is-kadr) .lumen-roulette__veil{opacity:1}');
      css.push(S + ':not(.is-atv):not(.is-kadr) .lumen-roulette__veil--l{background:-webkit-linear-gradient(left,' + bgA('.94') + ' 0%,' + bgA('.75') + ' 45%,' + bgA('.35') + ' 100%);background:linear-gradient(90deg,' + bgA('.94') + ' 0%,' + bgA('.75') + ' 45%,' + bgA('.35') + ' 100%)}');
      css.push(S + ':not(.is-atv):not(.is-kadr) .lumen-roulette__veil--b{background:-webkit-linear-gradient(bottom,' + P.bg + ' 0%,' + bgA('.86') + ' 26%,' + bgA('0') + ' 58%);background:linear-gradient(0deg,' + P.bg + ' 0%,' + bgA('.86') + ' 26%,' + bgA('0') + ' 58%)}');

      /* Итог: логотип вместо названия текстом — в обоих стилях. Пока
         решение о логотипе не принято, название не показано (как у героя). */
      css.push(R + '__result{max-width:40em}');
      css.push(R + '__rlogo{display:none;width:18em;max-width:100%;height:5em;margin-bottom:.7em;background-position:left bottom;background-repeat:no-repeat;-webkit-background-size:contain;background-size:contain}');
      css.push(R + '__result.has-logo .lumen-roulette__rlogo{display:block}');
      css.push(R + '__result.has-logo .lumen-roulette__rtitle{display:none}');
      css.push(R + '__result.is-logo-wait .lumen-roulette__rtitle{visibility:hidden}');
      css.push(R + '__rlogo.lumen-logo-white{-webkit-filter:brightness(0) invert(1);filter:brightness(0) invert(1)}');
      /* Мета — как у героя: 26/500 FHD мягким цветом (Apple TV свою не
         меняет — «меняются только кнопки и кегль описания»). */
      css.push(S + ':not(.is-atv) .lumen-roulette__rmeta{font-size:1.14em;font-weight:500;line-height:1.3;color:' + P.soft + '}');
      /* Описание 29/500 FHD (58 на 4K), 880 px: Lumen — две строки, Apple
         TV — три. */
      css.push(R + '__rdescr{font-size:1.27em;font-weight:500;line-height:1.4;max-width:30.3em;margin-top:.45em;color:' + P.text + '}');
      css.push(ATV + ' .lumen-roulette__rdescr{-webkit-line-clamp:3}');

      /* Кнопки итога = кнопки карточки: 64 px FHD при кегле 25/600,
         поля 32 px, радиус 12 px, зазор 20 px (в em своего кегля). */
      css.push(R + '__actions{margin-top:1.3em}');
      css.push(R + '__btn{font-size:1.1em;font-weight:600;height:2.55em;padding:0 1.28em;margin:0 .8em .5em 0;border-radius:.48em}');
      css.push(R + '__btn--watch:before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:.88em;height:.88em;margin-right:.48em;background-color:currentColor;-webkit-mask-image:' + LC.icons.maskUrl('play') + ';mask-image:' + LC.icons.maskUrl('play') + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-size:contain;mask-size:contain}');
      css.push(LC.icons.NO_MASK + '{' + R + '__btn--watch:before{display:none}}');

      /* Вращение (вид «как Apple TV»): название, мета и описание главной
         карточки выборки гаснут — экран не говорит о двух фильмах разом
         (Apple TV #27). Счётчик и «Крутить» остаются. */
      css.push(ATV + '.is-spinning .lumen-roulette__ltitle,' + ATV + '.is-spinning .lumen-roulette__lmeta,' + ATV + '.is-spinning .lumen-roulette__ldescr{opacity:0}');
      css.push(ATV + ' .lumen-roulette.lumen-motion-full .lumen-roulette__ltitle,' + ATV + ' .lumen-roulette.lumen-motion-full .lumen-roulette__lmeta,' + ATV + ' .lumen-roulette.lumen-motion-full .lumen-roulette__ldescr{-webkit-transition:opacity .2s ease-out;transition:opacity .2s ease-out}');

      return css.join('');
    }
  });

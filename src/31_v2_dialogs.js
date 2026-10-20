  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль»: штатные окна Lampa — Select (.selectbox: списки    */
  /* выбора, «Выход» по «Назад») и Modal (.modal: подтверждения вроде     */
  /* «Для применения плагина необходимо перезагрузить приложение»).        */
  /* -------------------------------------------------------------------- */

  /* Тот же язык, что у меню карточки (экран 40, src/31_v2_torrents_menu.js)
     и панели настроек (экран 41): панель цвета темы (Lumen P.panel, Apple
     TV #1C1C1E), без размытия; пункт и кнопка — скругление .526em, фокус —
     заливка (P.text / #FFF) с подписью P.bg (экран 33); вторичный текст
     ≥ 4.5:1; гарнитура плагина; акцент темы не используется.

     Каскад. Правила живут в основной таблице плагина и уходят вместе с ней.
     - Меню карточки (.selectbox.lumen-cardmenu) — своё, исключено через
       :not(.lumen-cardmenu): ни одно правило здесь его не трогает.
     - Путь TorrServer (src/65_torrents.js, свой <style> ПОСЛЕ основного).
       Веса — на примере пункта (.selectbox-item):
       body.lumen-menus-all .selectbox .selectbox-item — (0,3,1),
       .selectbox.lumen-select .selectbox-item — (0,3,0). Раскладку (поля,
       кегли) пишем лёгким селектором G0: .selectbox:not(.lumen-cardmenu)
       .selectbox-item — (0,3,0), не тяжелее пути, а при равенстве путь
       побеждает порядком; цвета — тяжёлым G: html body
       .selectbox:not(.lumen-cardmenu) .selectbox-item — (0,3,2), он
       перекрывает путь, иначе в Apple TV там остаются тёплая панель и
       акцент темы.
     - Тема CUB «Neon» (cub.best/extensions/212, <link> в конце body):
       .selectbox-item.focus{background:transparent !important;
       color:#fff !important} и ::before с кольцом и белой вуалью. Заливка и
       цвета в фокусе — с !important (наш селектор специфичнее), ::before
       пункта снят: Lampa сама его пунктам Select не рисует.
     - body.black--style на узком экране (@media max-width:480px,
       vendor/lampa/css/app.css:231-236) красит .selectbox__content/
       .modal__content в #000 с !important — выбор пользователя, его не
       перебиваем (как у настроек). */

  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'dialogs',
    order: 44,
    build: function (ctx) {
      var P = ctx.P;
      var A = ctx.APPLE;
      var V2 = ctx.V2;
      var css = [];
      var font = typeof LC.fontStack === 'function' ? LC.fontStack() : '';
      var FF = font ? 'font-family:' + font + ';' : '';

      var PANEL = A ? '#1C1C1E' : P.panel;
      var FILL = A ? V2.fillA : P.text;
      var ON = P.bg;
      /* Описание на заливке — как у меню карточки: 70 % чёрного (A),
         P.bg .72 (L). */
      var ON_SUB = A ? V2.sub : 'rgba(' + P.bgRgb + ',.72)';
      var TEXT = P.text;
      var MUTED = A ? 'rgba(235,235,245,.64)' : P.muted;
      var SOFT = A ? 'rgba(235,235,245,.8)' : P.soft;
      /* Отметка выбранного — цветом текста, не акцентом. */
      var CHECK = A ? '#FFFFFF' : P.text;
      var BOX = A ? 'rgba(235,235,245,.6)' : P.muted;
      var BTN = A ? V2.blockA : 'rgba(' + P.textRgb + ',.12)';
      var SHADOW = A ? '' : '-webkit-box-shadow:0 1.052em 2.104em rgba(0,0,0,.55);box-shadow:0 1.052em 2.104em rgba(0,0,0,.55);';
      var R = '.526em';
      var NOBLUR = '-webkit-backdrop-filter:none;backdrop-filter:none';

      function sel(prefix, list) {
        var out = [];
        for (var i = 0; i < list.length; i++) out.push(prefix + list[i]);
        return out.join(',');
      }

      /* ---------------- Select ---------------- */
      var G0 = '.selectbox:not(.lumen-cardmenu) ';
      var G = 'html body .selectbox:not(.lumen-cardmenu) ';
      function g0(list) { return sel(G0, list); }
      function g(list) { return sel(G, list); }

      /* Подложку не затемняем (Select открывается и поверх плеера), только
         снимаем размытие Lampa (на узких экранах — blur(1em)). */
      css.push(g(['.selectbox__layer']) + '{' + NOBLUR + '}');
      css.push(g(['.selectbox__content']) + '{background:' + PANEL + ';color:' + TEXT + ';' + FF + SHADOW + NOBLUR + '}');
      /* Заголовок: Bold вместо Light 2.2em (Light запрещён). */
      css.push(g0(['.selectbox__title']) + '{font-size:1.67em;font-weight:700;line-height:1.2}');
      css.push(g(['.selectbox__title']) + '{color:' + TEXT + '}');
      css.push(g0(['.selectbox__text']) + '{color:' + SOFT + '}');
      /* Пункт: скруглённая строка с полями от кромки панели, а не полоса
         во всю ширину. */
      css.push(g0(['.selectbox-item']) + '{margin:0 1.4em .175em;padding:.7em 1.05em;border-radius:' + R + '}');
      css.push(g0(['.selectbox-item__title']) + '{font-size:1.096em;font-weight:500;line-height:1.25}');
      css.push(g0(['.selectbox-item--checkbox']) + '{padding-right:3.3em}');
      css.push(g0(['.selectbox-item__checkbox']) + '{top:50%;right:1.05em;margin-top:-.614em;width:1.227em;height:1.227em;-webkit-box-sizing:border-box;box-sizing:border-box;border-width:.11em}');
      css.push(g0(['.selectbox-item.selected:not(.nomark)::after', '.selectbox-item.picked::after']) + '{right:1.4em}');
      css.push(g0(['.settings-param-title']) + '{padding:.6em 2.45em .3em}');
      css.push(g(['.selectbox-item']) + '{color:' + TEXT + '}');
      css.push(g(['.selectbox-item__subtitle', '.settings-param-title > span']) + '{color:' + MUTED + ';opacity:1}');
      css.push(g(['.selectbox-item__checkbox']) + '{border-color:' + BOX + '}');
      css.push(g(['.selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + CHECK + '}');
      css.push(g(['.selectbox-item--checked .selectbox-item__checkbox::after', '.selectbox-item.selected:not(.nomark)::after', '.selectbox-item.picked::after']) + '{color:' + CHECK + ';border-color:' + CHECK + '}');
      /* Фокус — заливка, под темой «Neon» тоже. */
      css.push(g(['.selectbox-item.focus']) + '{background:' + FILL + ' !important;color:' + ON + ' !important;outline:0;-webkit-box-shadow:none;box-shadow:none}');
      css.push(g(['.selectbox-item.focus::before']) + '{content:none !important;display:none !important}');
      css.push(g(['.selectbox-item.focus .selectbox-item__title']) + '{font-weight:600}');
      css.push(g(['.selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + ON_SUB + ' !important;opacity:1}');
      css.push(g(['.selectbox-item.focus .selectbox-item__lock']) + '{color:' + ON_SUB + ' !important}');
      css.push(g(['.selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + ON + ' !important;-webkit-filter:none !important;filter:none !important}');
      css.push(g(['.selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + ON + ' !important}');
      css.push(g(['.selectbox-item--checked.focus .selectbox-item__checkbox::after']) + '{color:' + FILL + ' !important;border-color:' + FILL + ' !important}');
      css.push(g(['.selectbox-item.selected.focus:not(.nomark)::after', '.selectbox-item.picked.focus::after']) + '{color:' + ON + ' !important;border-color:' + ON + ' !important}');

      /* ---------------- Modal ---------------- */
      /* .modal.modal — класс дважды: html body .modal.modal .modal__content
         — (0,3,2), тяжелее оболочки пути TorrServer
         (body.lumen-menus-all .modal .modal__content — 0,3,1). */
      var M0 = 'body .modal ';
      var M = 'html body .modal.modal ';
      function m0(list) { return sel(M0, list); }
      function m(list) { return sel(M, list); }

      css.push('body .modal{background-color:rgba(' + P.bgRgb + ',.55);' + NOBLUR + '}');
      css.push(m(['.modal__content']) + '{background-color:' + PANEL + ';border-radius:.79em;color:' + TEXT + ';' + FF + SHADOW + NOBLUR + '}');
      css.push(m0(['.modal__title']) + '{font-size:1.67em;font-weight:700;line-height:1.2}');
      css.push(m(['.modal__title']) + '{color:' + TEXT + '}');
      /* Текст окна (.about Lampa — Light 300): 500, вторичным цветом. */
      css.push(m0(['.about']) + '{font-weight:500}');
      css.push(m(['.about']) + '{color:' + SOFT + '}');
      css.push(m0(['.modal__button']) + '{padding:.7em 1.4em;border-radius:' + R + ';font-size:1.096em;font-weight:500;line-height:1.25}');
      css.push(m(['.modal__button']) + '{background:' + BTN + ';color:' + TEXT + '}');
      /* Фокус кнопки — заливка; свечение .simple-button.focus темы «Neon»
         и чужие псевдоэлементы сняты. */
      css.push(m(['.modal__button.focus']) + '{background:' + FILL + ' !important;color:' + ON + ' !important;font-weight:600;outline:0;-webkit-box-shadow:none !important;box-shadow:none !important}');
      css.push(m(['.modal__button.focus::before', '.modal__button.focus::after']) + '{content:none !important;display:none !important}');

      return css.join('\n');
    }
  });

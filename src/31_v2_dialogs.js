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
     - Настройка «Оформление меню и окон» (lumen_menus, src/64_menus.js):
       'all' — класс body.lumen-menus-all, 'path' — только маркеры
       .selectbox.lumen-select / .modal.lumen-modal на окнах пути
       TorrServer, 'off' — ни того, ни другого. Каждое правило здесь —
       пара селекторов «режим all ИЛИ маркер», как у пути
       (src/65_torrents.js, scoped): при 'off' обычные Select и Modal
       остаются штатными.
     - Путь TorrServer (src/65_torrents.js, свой <style> ПОСЛЕ основного).
       Веса — на примере пункта (.selectbox-item):
       body.lumen-menus-all .selectbox .selectbox-item — (0,3,1),
       .selectbox.lumen-select .selectbox-item — (0,3,0). Раскладку (поля,
       кегли) пишем селекторами G0 ровно того же веса (те же селекторы),
       и путь побеждает порядком, а без его таблицы (lumen_torrents
       выключен) раскладка наша; цвета — тяжёлым G:
       html body.lumen-menus-all .selectbox:not(.lumen-cardmenu)
       .selectbox-item — (0,4,2), html body .selectbox.lumen-select
       :not(.lumen-cardmenu) .selectbox-item — (0,4,2); он перекрывает
       путь, иначе в Apple TV там остаются тёплая панель и акцент темы.
     - Меню карточки (.selectbox.lumen-cardmenu) — своё. Цвета G его
       исключают через :not(.lumen-cardmenu). У G0 исключения нет: оно
       сделало бы G0 тяжелее пути (класс весит больше body). Раскладку
       меню карточки и так держат его правила (src/31_v2_torrents_menu.js,
       body.selectbox--open .selectbox.lumen-cardmenu … — 0,4,1 у пункта),
       они тяжелее G0 и задают все её свойства, кроме right галочки
       выбранного (1.4em — то же значение, что путь ставит меню карточки
       в режиме all); шапка меню скрыта. Проверено тестом.
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

      /* Режим «все меню» и маркеры окон пути — src/64_menus.js. */
      var ALL = 'body.lumen-menus-all';
      var MS = (LC.menus && LC.menus.MARK_SELECT) || 'lumen-select';
      var MM = (LC.menus && LC.menus.MARK_MODAL) || 'lumen-modal';

      /* prefixes — пара «режим all ИЛИ маркер»; каждый селектор списка
         пишется с обоими. */
      function sel(prefixes, list) {
        var out = [];
        for (var i = 0; i < list.length; i++) {
          for (var j = 0; j < prefixes.length; j++) out.push(prefixes[j] + list[i]);
        }
        return out.join(',');
      }

      /* ---------------- Select ---------------- */
      var G0 = [ALL + ' .selectbox ', '.selectbox.' + MS + ' '];
      var G = ['html ' + ALL + ' .selectbox:not(.lumen-cardmenu) ', 'html body .selectbox.' + MS + ':not(.lumen-cardmenu) '];
      function g0(list) { return sel(G0, list); }
      function g(list) { return sel(G, list); }

      /* Подложку не затемняем (Select открывается и поверх плеера), только
         снимаем размытие Lampa (на узких экранах — blur(1em)). */
      css.push(g(['.selectbox__layer']) + '{' + NOBLUR + '}');
      css.push(g(['.selectbox__content']) + '{background:' + PANEL + ';color:' + TEXT + ';' + FF + NOBLUR + '}');
      /* Тень — только у открытого: закрытая панель стоит за правой кромкой
         (left:100%), и её тень иначе лежит полосой у края каждого экрана. */
      if (SHADOW) css.push(sel(['html ' + ALL + '.selectbox--open .selectbox:not(.lumen-cardmenu) ', 'html body.selectbox--open .selectbox.' + MS + ':not(.lumen-cardmenu) '], ['.selectbox__content']) + '{' + SHADOW + '}');
      /* Заголовок: Bold вместо Light 2.2em (Light запрещён). */
      css.push(g0(['.selectbox__title']) + '{font-size:1.67em;font-weight:700;line-height:1.2}');
      css.push(g(['.selectbox__title']) + '{color:' + TEXT + '}');
      css.push(g(['.selectbox__text']) + '{color:' + SOFT + '}');
      /* Пункт: скруглённая строка с полями от кромки панели, а не полоса
         во всю ширину. */
      css.push(g0(['.selectbox-item']) + '{margin:0 1.4em .175em;padding:.7em 1.05em;border-radius:' + R + '}');
      css.push(g0(['.selectbox-item__title']) + '{font-size:1.096em;font-weight:500;line-height:1.25}');
      css.push(g0(['.selectbox-item--checkbox']) + '{padding-right:3.3em}');
      css.push(g0(['.selectbox-item__checkbox']) + '{top:50%;right:1.05em;margin-top:-.614em;width:1.227em;height:1.227em;-webkit-box-sizing:border-box;box-sizing:border-box;border-width:.11em}');
      /* Замок (закладки без CUB Premium, app.min.js onDraw) встаёт вместо
         чекбокса — в его же гнездо: у Lampa он 2em на right:1.7em и
         залезал на текст при нашем поле 3.3em. */
      css.push(g0(['.selectbox-item__lock']) + '{right:1.05em;margin-top:-.614em}');
      css.push(g0(['.selectbox-item__lock > svg']) + '{width:1.227em !important;height:1.227em !important}');
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
      /* QA U4: окно «Источник» (Select кнопки «Смотреть», app.min.js
         38808) — у пункта Shots подзаголовок «Смотреть нарезки <span
         class="shots-view-button__count">12</span>» (plugins/shots/utils/
         view.js), а плагин ставит счётчик абсолютом left:12em под поля
         Lampa (shots/css/style.scss) — при наших полях и кегле он ложился
         на текст. Счётчик — в строку после текста, видом счётчика вкладок
         поиска (src/31_v2_search.js). Весом G: меню карточки (своё,
         src/31_v2_torrents_menu.js) пункта Shots не содержит. */
      css.push(g(['.selectbox-item__subtitle .shots-view-button__count']) + '{position:static;display:inline-block;vertical-align:middle;margin-left:.45em;padding:.12em .4em;min-width:1.4em;border-radius:.44em;font-size:.8em;font-weight:600;line-height:1.2;text-align:center}');
      css.push(g(['.selectbox-item__subtitle .shots-view-button__count']) + '{background:rgba(' + P.textRgb + ',.14);color:inherit}');
      css.push(g(['.selectbox-item.focus .selectbox-item__subtitle .shots-view-button__count']) + '{background:rgba(0,0,0,.14);color:inherit}');

      /* ---------------- Modal ---------------- */
      /* M0 (раскладка) — те же селекторы, что у пути; M (цвета) — с html:
         html body.lumen-menus-all .modal .modal__content и
         html body .modal.lumen-modal .modal__content — (0,3,2), тяжелее
         оболочки пути TorrServer (body.lumen-menus-all .modal
         .modal__content — 0,3,1; .modal.lumen-modal .modal__content —
         0,3,0). */
      var M0 = [ALL + ' .modal', '.modal.' + MM];
      var M = ['html ' + ALL + ' .modal ', 'html body .modal.' + MM + ' '];
      function m0(list) { return sel([M0[0] + ' ', M0[1] + ' '], list); }
      function m(list) { return sel(M, list); }

      /* Подложка — тем же весом, что у пути (он позже и побеждает). */
      css.push(M0.join(',') + '{background-color:rgba(' + P.bgRgb + ',.55);' + NOBLUR + '}');
      css.push(m(['.modal__content']) + '{background-color:' + PANEL + ';border-radius:.79em;color:' + TEXT + ';' + FF + SHADOW + NOBLUR + '}');
      /* Окно во весь экран (Modal.open size:'full', .modal--full — QR
         «Добавить комментарий») — без скругления, как у Lampa; правило
         тяжелее нашего и пути (.614em). */
      css.push(sel(['html ' + ALL + ' .modal.modal--full ', 'html body .modal.' + MM + '.modal--full '], ['.modal__content']) + '{border-radius:0}');
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

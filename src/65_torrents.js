  /* -------------------------------------------------------------------- */
  /* Task 32 (фаза 1b): CSS экранов пути TorrServer (дизайн, экраны 33–40). */
  /* -------------------------------------------------------------------- */

  /* Только CSS поверх штатных классов Lampa и маркер lumen-torrents на корне
     активности 'torrents'. Разметку, тексты и обработчики Lampa не трогаем.

     Скоупинг (план фазы 1b §0.4) — единая схема:
       режим all   : body.lumen-menus-all .selectbox …   body.lumen-menus-all .modal …
       режим path  : .selectbox.lumen-select …           .modal.lumen-modal …
                     (маркеры ставит LC.menus, src/64_menus.js)
       экраны пути : body.lumen-torrents-on .lumen-torrents .explorer …  (активность «Торренты»:
                     .torrent-filter, .explorer*, .empty*, .simple-button — общие классы Lampa)
                     body.lumen-torrents-on .torrent-item / .torrent-file / .torrent-serial /
                     .torrnet-folder-name / .torrent-checklist / .torrent-install / .torrent-error /
                     .modal-loading / .media-loading  (уникальные классы — маркер активности не нужен)
       общий .error — только внутри Modal (через scoped()).
     Правило для Select/Modal пишется один раз через scoped(sel) — оно даёт
     пару селекторов для обоих режимов. Все правила пути живут в одном
     <style id="lumen-torrents-css">: toggle(false) (lumen_torrents выключен
     или плагин не активен) удаляет его целиком, режим меню решает лишь, к
     каким Select/Modal они применяются. Режим движения — класс
     lumen-motion-* на body (LC.applyMotionMode, 90_runtime.js).

     Единицы: em от базы Lampa (22.811px при 1920), размеры —
     docs/design/design-spec-torrents.md. Если элемент сам меняет font-size,
     его отступы пересчитаны от собственного кегля (помечено «лок. em»).
     Цвета — только LC.tokens() (30_css.js). Иконки — LC.icons.maskUrl():
     группа только регистрирует селектор (useMask), в конце css() на каждую
     иконку одно правило с data-URI и одно общее — repeat/position/size.

     Тени фокуса (Task 50c) — плоские подложки без размытия и НЕ в списке
     transition: они появляются и снимаются вместе с классом .focus. Правило
     то же, что у таблицы карточки (Task 38, src/30_css.js), и сторожит его
     здесь свой тест — каждый кадр анимации тени это перерисовка растра
     элемента, а фокус на этих экранах идёт по длинным спискам. */

  LC.torrents = (function () {
    var STYLE_ID = 'lumen-torrents-css';
    var BODY_ON = 'lumen-torrents-on';
    var MARK = 'lumen-torrents';
    var MARKS = { selectbox: LC.menus.MARK_SELECT, modal: LC.menus.MARK_MODAL };
    var SUPPORTS_NO_MASK = LC.icons.NO_MASK + '{';
    var installed = false;
    var maskUse = null;
    var lastText = null;

    /* Регулярка строже, чем \b: '.modal-loading' и '.selectbox-item' — другие классы. */
    function marked(sel) {
      return sel.replace(/^\.(selectbox|modal)(?![\w-])/, function (all, name) { return '.' + name + '.' + MARKS[name]; });
    }

    function scoped(sel) {
      return 'body.lumen-menus-all ' + sel + ',' + marked(sel);
    }

    /* Пара селекторов для Select/Modal с условием режима движения на body. */
    function scopedMotion(mode, sel) {
      return 'body.lumen-motion-' + mode + '.lumen-menus-all ' + sel + ',body.lumen-motion-' + mode + ' ' + marked(sel);
    }

    function join(list, fn) {
      var out = [];
      for (var i = 0; i < list.length; i++) out.push(fn(list[i]));
      return out.join(',');
    }

    /* S — Select/Modal; T — уникальные классы пути; A — внутри активности «Торренты». */
    function S(list) { return join(list, scoped); }
    function SM(mode, list) { return join(list, function (s) { return scopedMotion(mode, s); }); }
    function T(list) { return join(list, function (s) { return 'body.' + BODY_ON + ' ' + s; }); }
    function TM(mode, list) { return join(list, function (s) { return 'body.' + BODY_ON + '.lumen-motion-' + mode + ' ' + s; }); }
    function A(list) { return join(list, function (s) { return 'body.' + BODY_ON + ' .' + MARK + ' ' + s; }); }
    function AM(mode, list) { return join(list, function (s) { return 'body.' + BODY_ON + '.lumen-motion-' + mode + ' .' + MARK + ' ' + s; }); }

    /* sel — уже готовая строка селекторов (S/T/A). */
    function useMask(name, sel) {
      if (!maskUse.by.hasOwnProperty(name)) {
        maskUse.by[name] = [];
        maskUse.order.push(name);
      }
      maskUse.by[name].push(sel);
    }

    function maskRules() {
      var r = ['/* Маски иконок: data-URI один раз на иконку, repeat/position/size — одним правилом */'];
      var all = [];
      for (var i = 0; i < maskUse.order.length; i++) {
        var name = maskUse.order[i];
        var sel = maskUse.by[name].join(',');
        var u = LC.icons.maskUrl(name);
        all.push(sel);
        r.push(sel + '{-webkit-mask-image:' + u + ';mask-image:' + u + '}');
      }
      r.push(all.join(',') + '{-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
      return r;
    }

    /* ---------------- 33 / 35: панель Select ---------------- */
    function selectRules(k) {
      var r = [];
      var check = ['.selectbox .selectbox-item--checked .selectbox-item__checkbox::after'];
      var sortCheck = ['.selectbox .selectbox-item.selected:not(.nomark)::after', '.selectbox .selectbox-item.picked::after'];
      r.push('/* 33 Источник · 35 Фильтр, Сортировать, Действие — панель Select (ширина штатная, 35 %) */');
      /* Task 53: backdrop-filter снят явно. Lampa под body.glass--style вешает
         на .selectbox__content (и на .modal__content, .settings__content и ещё
         шесть узлов одним правилом — vendor/lampa/css/app.css:16047-16059)
         background-color rgba(70,70,70,.3) плюс blur(1.6em). Наша панель
         непрозрачна (k.panel), поэтому размытие под ней не видно вовсе, но
         стоит оно дорого: backdrop-filter заставляет WebView читать пиксели
         под элементом каждый кадр. По этой же причине размытия сняты по всему
         плагину — src/30_css.js:122, :180, :1001. */
      r.push(S(['.selectbox .selectbox__content']) + '{background:' + k.panel + ';border-left:.044em solid ' + k.line + ';color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-backdrop-filter:none;backdrop-filter:none}');
      r.push(S(['.selectbox .selectbox__head']) + '{padding:2.805em 2.805em 1.052em 1.403em}');
      r.push(S(['.selectbox .selectbox__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');
      /* Горизонтальный отступ панели — полями пункта, а не паддингом тела:
         scale(1.02) фокуса не упирается в край скролла, чужие блоки в теле не сдвигаются.
         Task 53: паддинг .7em 1.4em — текст стоит в 1.4em от кромки заливки.
         Штатный у Lampa — 1.5em 2em (vendor/lampa/css/app.css:7151-7155).
         will-change:auto снимает штатный will-change:transform (там же, :7154):
         он обещает браузеру движение каждому пункту списка и поднимает их все
         в отдельные слои композитора, а двигается у нас только один — тот, что
         в фокусе (scale(1.02) ниже, и то лишь в режиме «Полные»). */
      r.push(S(['.selectbox .selectbox-item']) + '{margin:0 2.805em .351em 1.403em;padding:.7em 1.4em;border-radius:.438em;color:' + k.text + ';will-change:auto;-webkit-transition:background-color .2s,color .2s,-webkit-transform .2s;transition:background-color .2s,color .2s,transform .2s}');
      r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:1.01em;font-weight:600;line-height:1.2}');
      /* Разделитель групп (штатный items c separator:true — Lampa рисует его
         как .settings-param-title, app.min.js bind). Он есть и в штатном меню
         карточки («Избранное»), и перед нашими пунктами в нём (Task 26,
         src/63_cardmenu.js:411, :483). Подпись группы обязана стоять по одной
         линии со списком — так её держит и сама Lampa: у пункта и у подписи
         один и тот же padding 1.5em 2em (vendor/lampa/css/app.css:7151-7155 и
         :2546-2548).
         Ревью Task 53: горизонтальные поля считаются в СОБСТВЕННОМ кегле
         подписи (.745em базового, то есть 16.99 px при 1920), а у пункта — в
         базовом. Прежние 1.403em/2.805em брались у ПОЛЕЙ пункта как есть и
         линию не давали никогда: текст пункта стоял в 48.0 px от кромки
         панели, подпись — в 23.8 px. Task 53 поднял паддинг пункта с .701 до
         1.4em и развёл их до 40.1 px. Теперь пересчитано честно: текст пункта
         — 1.403 + 1.4 = 2.803em базовых, это 2.803 / .745 = 3.763em местных;
         справа 2.805 + 1.4 = 4.205em базовых = 5.644em местных. Вертикальные
         поля местные и были — они про ритм, а не про линию. */
      r.push(S(['.selectbox .settings-param-title']) + '{margin:.776em 4.163em .258em 2.776em;padding:0;border:0;background:none;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:700;line-height:1.2;letter-spacing:.059em;text-transform:uppercase;color:' + k.muted + '}');
      /* Текст подписи Lampa кладёт в <span> и красит его своим правилом
         (rgba(255,255,255,.4)) — цвет на обёртке до него не доходит. */
      r.push(S(['.selectbox .settings-param-title > span']) + '{color:' + k.muted + '}');
      r.push(S(['.selectbox .selectbox-item__subtitle']) + '{font-size:1.01em;font-weight:400;line-height:1.2;margin-top:.174em;color:' + k.muted + ';opacity:1}');
      /* Task 53: фокус пункта — инверсия (цвет текста становится заливкой, фон
         страницы — подписью), как у кнопок карточки (src/30_css.js, правило
         .full-start__button.focus). Так же показывает фокус и сама Lampa в
         «стеклянной» теме: body.glass--style .selectbox-item.focus —
         background-color #fff, color #000 (vendor/lampa/css/app.css:16067-16072),
         только у нас это два цвета темы, а не чужие белый с чёрным.
         Всё, что внутри фокуса стояло на k.onac, переезжает на k.bg — подпись,
         рамка и заливка чекбокса, галочка выбранного пункта. */
      r.push(S(['.selectbox .selectbox-item.focus']) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.02);transform:scale(1.02)}');
      r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + k.bg + ';opacity:.72}');
      /* Иконки: без :has() svg не выбрать по вложенному <use>, поэтому маской
         спрайт не заменить — голый <svg><use/></svg> без атрибутов только
         уменьшен до 26px. Цвет ему не задаётся ВООБЩЕ: как он покрасится,
         решает его собственная разметка (Lampa подставляет в шаблон пункта
         готовый {icon} целиком — app.min.js:2544, и что там за svg, зависит
         от того, кто открыл меню). Иконки плагинов (svg с viewBox/width/class)
         не трогаются тем более. Отсюда следствие Task 54: с инверсией фокуса
         заливка светлая, и белый логотип стороннего балансёра на ней
         пропадает — README, «Путь до плеера». */
      r.push(S(['.selectbox .selectbox-item__icon']) + '{margin-right:.701em;min-width:1.403em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(S(['.selectbox .selectbox-item__icon > svg:not([viewBox]):not([class]):not([width])']) + '{width:1.14em;height:1.14em}');
      /* Чекбоксы фильтра (штатные selectbox-item--checkbox / __checkbox / --checked): квадрат слева, галочка check.
         Task 53: производные от базового паддинга пересчитаны под 1.4em.
         Квадрат встаёт на ту же кромку, что и текст (left:1.4em), зазор между
         ним и текстом прежний: 2.543 − (.701 + 1.227) = .615em, значит
         padding-left = 1.4 + 1.227 + .615 = 3.242em. */
      r.push(S(['.selectbox .selectbox-item--checkbox']) + '{padding-left:3.242em;padding-right:1.4em}');
      r.push(S(['.selectbox .selectbox-item__checkbox']) + '{top:50%;right:auto;left:1.4em;width:1.227em;height:1.227em;margin-top:-.614em;border:.044em solid ' + k.line + ';border-radius:.307em;-webkit-box-sizing:border-box;box-sizing:border-box}');
      r.push(S(['.selectbox .selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + k.accent + '}');
      /* Ревью Task 53: filter:none обязателен. Lampa под body.glass--style
         вешает на квадрат чекбокса в фокусе filter:invert(1)
         (vendor/lampa/css/app.css:16073-16081) — под свой белый фокус, где
         инверсия и задумана. Свойство filter мы не задавали, значит правило
         действовало и у нас: с Task 54 квадрат стал цветом k.bg, инверсия
         превращала его в почти-белый поверх почти-белой заливки, и чекбокс
         пропадал. Раньше инвертировался k.onac на акцентной заливке — тоже
         не задумано, но хотя бы видно. Бьёт только тех, кто сам включил
         «Стеклянный стиль»: на ТВ он выключен по умолчанию
         (app.min.js:47432 — trigger('glass_style', Platform.screen('mobile')),
         и :47923 — trigger('glass_style', false)). */
      r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + k.bg + ';-webkit-filter:none;filter:none}');
      r.push(S(['.selectbox .selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + k.bg + '}');
      r.push(S(check) + '{top:50%;left:50%;right:auto;width:.877em;height:.877em;margin:-.439em 0 0 -.439em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
      useMask('check', S(check));
      /* Выбранный пункт сортировки (штатные .selected / .picked): галочка check справа, как у Lampa.
         Task 53: тот же пересчёт от 1.4em. Галочка встаёт на правую кромку
         текста (right:1.4em), зазор прежний: 2.63 − (.701 + .964) = .965em,
         значит padding-right = 1.4 + .964 + .965 = 3.329em. */
      r.push(S(['.selectbox .selectbox-item.selected:not(.nomark)', '.selectbox .selectbox-item.picked']) + '{padding-right:3.329em}');
      r.push(S(sortCheck) + '{top:50%;right:1.4em;width:.964em;height:.964em;margin-top:-.482em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
      useMask('check', S(sortCheck));
      r.push(S(['.selectbox .selectbox-item.selected.focus:not(.nomark)::after', '.selectbox .selectbox-item.picked.focus::after']) + '{color:' + k.bg + '}');
      /* Без масок — штатная галочка Lampa из рамок (цвет тот же). */
      r.push(SUPPORTS_NO_MASK + S(check.concat(sortCheck)) + '{background-color:transparent;width:.3em;height:.6em;margin:-.4em 0 0 -.15em;border-right:.15em solid currentColor;border-bottom:.15em solid currentColor;-webkit-transform:rotate(45deg);transform:rotate(45deg)}}');
      /* Движение: lite — только цвета, off — без переходов (как у карточки). */
      r.push(SM('lite', ['.selectbox .selectbox-item']) + '{-webkit-transition:background-color .2s,color .2s;transition:background-color .2s,color .2s}');
      r.push(SM('off', ['.selectbox .selectbox-item']) + '{-webkit-transition:none;transition:none}');
      r.push(SM('lite', ['.selectbox .selectbox-item.focus']) + ',' + SM('off', ['.selectbox .selectbox-item.focus']) + '{-webkit-transform:none;transform:none}');
      return r;
    }

    /* ---------------- 34: экран «Торренты» (Explorer + Filter + раздачи) ---------------- */
    function explorerRules(k) {
      var r = [];
      var chips = ['.torrent-filter .simple-button', '.empty__footer .simple-button', '.empty-filter__buttons .simple-button'];
      var chipsFocus = [];
      for (var i = 0; i < chips.length; i++) chipsFocus.push(chips[i] + '.focus');
      r.push('/* 34 Торренты — Explorer, Filter, список раздач, пусто/ошибка */');
      r.push(A(['.explorer']) + '{color:' + k.text + ';font-family:' + k.fontBody + '}');
      /* Колонки: левая 25 % (дизайн), правая забирает остаток flex-ом — так
         штатное скрытие левой (<=767px, light--version, explorer--fullsize) не ломается. */
      r.push(A(['.explorer__left']) + '{width:25%}');
      r.push(A(['.explorer__files']) + '{width:auto;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 0%;flex:1 1 0%}');
      r.push(A(['.explorer__card']) + '{padding-left:2.805em}');
      /* Левая колонка: постер 2:3 320px сверху, год и рейтинг строкой под ним. */
      r.push(A(['.explorer-card__head']) + '{-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column;-webkit-box-align:start;-webkit-align-items:flex-start;align-items:flex-start;margin-bottom:.614em}');
      r.push(A(['.explorer-card__head-left']) + '{width:14.028em;max-width:100%;margin-right:0}');
      r.push(A(['.explorer-card__head-img > img']) + '{border-radius:.438em;background-color:' + k.panel + '}');
      r.push(A(['.explorer-card__head-img.focus::after']) + '{border-color:' + k.accent + ';border-width:.132em;border-radius:.7em}');
      r.push(A(['.explorer-card__head-body']) + '{padding-top:.789em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center}');
      r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontBody + ';font-size:1.01em;letter-spacing:.026em;color:' + k.muted + '}');
      r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
      r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontBody + ';font-size:1.1em;font-weight:600}');
      r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
      r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor}');
      useMask('star', A(['.explorer-card__head-rate:before']));
      r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
      r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
      r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontBody + ';font-size:1.01em;color:' + k.smoke + ';margin-bottom:.695em}');
      r.push(A(['.explorer-card__descr']) + '{font-size:1.01em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');

      /* Чипы фильтра и кнопки пустого состояния: h56 r12 panel+line (лок. em от 20px). */
      r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
      r.push(A(chips) + '{font-size:1.01em;height:2.431em;padding:0 .868em;margin-right:.521em;border-radius:.521em;border:.043em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
      r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');
      /* Фокус — токен «Кнопка» карточки: заливка, scale 1.06, подложка.
         !important — поверх animation-button-focus Lampa.
         Task 54: заливка — инверсия k.text/k.bg, как у кнопок карточки
         (src/30_css.js). Кольцо k.ring снято вместе с акцентной заливкой: оно
         отделяло акцент от подложки, а светлую карту отделять не от чего.
         Подписи внутри чипа («Поиск: …», «Сортировать: …») и точка «фильтр
         применён» переехали с k.onac на k.bg — правила ниже.
         Task 50c: у подложки больше нет размытия — было 0 .7em 2em, то есть
         40 px радиуса по контуру каждого чипа (em тут свой, от font-size
         .877em — 20 px при базе 22.811). Смещение .23em даёт те же ~4.6 px,
         что .2em на главной (src/30_css.js, accentRules). */
      r.push(A(chipsFocus) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .23em 0 ' + k.acglow + ';box-shadow:0 .23em 0 ' + k.acglow + '}');
      /* «Назад» — зеркальный chevronR; «Поиск» — search с раскрытым запросом. */
      r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
      r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
      r.push(A(['.torrent-filter .filter--back:before']) + '{-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
      useMask('chevronR', A(['.torrent-filter .filter--back:before']));
      useMask('search', A(['.torrent-filter .filter--search:before']));
      r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.594em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;color:' + k.smoke + '}');
      r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
      r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.bg + ';border-left-color:' + k.bg + '}');
      /* Индикатор «применён фильтр»: Filter.chosen() заполняет div и снимает
         .hide — точка accent, а на инверсии фокуса — k.bg. */
      r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1.01em;width:.495em;height:.495em;margin-left:.495em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:1.98em;color:transparent}');
      r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.bg + '}');

      /* Раздачи (.torrent-item — уникальный класс пути). */
      r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
      r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
      r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:.701em}');
      /* Фокус: рамка 3px accent + плоская подложка, без scale; паддинг -2px
         компенсирует рамку. Task 50c: размытие было 1.754em (40 px) — фокус
         идёт по длинному списку раздач тем же D-pad, и каждый шаг
         перерисовывал слой по площади, расширенной радиусом. */
      r.push(T(['.torrent-item.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;padding:.701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
      r.push(T(['.torrent-item.focus::after']) + '{border-color:transparent}');
      r.push(T(['.torrent-item__title']) + '{font-size:1.052em;font-weight:600;line-height:1.2;word-break:normal;word-wrap:break-word;overflow-wrap:break-word;padding-right:6.667em}');
      r.push(T(['.torrent-item__details']) + '{margin-top:.391em;font-size:1.01em;font-weight:400;color:' + k.muted + '}');
      r.push(T(['.torrent-item__details > div']) + '{margin-right:0}');
      r.push(T(['.torrent-item__tracker']) + '{-webkit-box-flex:0;-webkit-flex-grow:0;flex-grow:0}');
      r.push(T(['.torrent-item__details > div + div:not(.torrent-item__size):before']) + '{content:"\\00B7";margin:0 .6em;color:' + k.smoke + '}');
      r.push(T(['.torrent-item__bitrate > span', '.torrent-item__seeds > span', '.torrent-item__grabs > span']) + '{background:transparent;padding:0;min-width:0;border-radius:0;color:inherit}');
      /* Размер — светлый чип справа сверху, одинаково во всех строках (лок. em от 20px). */
      r.push(T(['.torrent-item__size']) + '{position:absolute;top:.891em;right:.891em;margin:0;padding:.347em .693em;border-radius:.347em;background-color:' + k.text + ';color:' + k.dark + ';font-size:1.01em;font-weight:600;line-height:1}');
      r.push(T(['.torrent-item.focus .torrent-item__size']) + '{top:.8em;right:.8em}');
      /* Медиачипы ffprobe (m-*): рамка, лок. em от 20px, штатные значки Lampa остаются. */
      r.push(T(['.torrent-item__ffprobe']) + '{padding-top:.175em}');
      r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:1.01em;font-family:' + k.fontBody + ';font-weight:400;letter-spacing:.052em;line-height:1;color:' + k.text + ';background:transparent;border:.043em solid rgba(' + k.textRgb + ',.24);border-radius:.304em;padding:.304em .478em;margin:.347em .347em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
      r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1.01em;padding:0;background:transparent;border-radius:0}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');
      /* «Просмотрено» — круг accent с check (угол, как у Lampa: элемент в конце строки). */
      r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
      r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor}');
      useMask('check', T(['.torrent-item__viewed:before']));

      /* «Продолжить» (штатный .watched-history). */
      r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontBody + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s;transition:border-color .2s}');
      r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
      r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
      r.push(A(['.watched-history__body']) + '{padding-left:.533em;font-size:1.01em;line-height:1.3}');
      r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
      r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
      r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');

      /* Пусто / ошибка парсера (.empty) и «фильтр ничего не дал» (.empty-filter). */
      r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
      r.push(A(['.empty__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.2}');
      r.push(A(['.empty__descr']) + '{font-size:1.01em;line-height:1.45;margin-top:.521em;color:' + k.muted + '}');
      r.push(A(['.empty__footer']) + '{margin-top:1.2em}');
      r.push(A(['.empty-filter__title']) + '{font-size:1.1em;font-weight:600;line-height:1.2;margin-bottom:.263em}');
      r.push(A(['.empty-filter__subtitle']) + '{font-size:1.01em;font-weight:400;line-height:1.25;margin-bottom:1.042em;color:' + k.muted + '}');
      r.push(A(['.empty-template']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em}');
      r.push(A(['.empty-template > *']) + '{background-color:rgba(' + k.textRgb + ',.06);border-radius:.307em}');

      /* Без масок — исходные svg Lampa. */
      r.push(SUPPORTS_NO_MASK + A(['.explorer-card__head-rate > svg']) + '{display:block !important;width:.964em !important;height:.964em !important;margin-right:.307em}' +
        A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:block !important;width:1.3em;height:1.3em}' +
        T(['.torrent-item__viewed > svg']) + '{display:block !important;width:.964em;height:.964em}' +
        A(['.explorer-card__head-rate:before', '.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + ',' + T(['.torrent-item__viewed:before']) + '{display:none !important}}');

      /* Движение: lite — только цвета, off — без переходов; анимации Lampa гасятся. */
      r.push(AM('lite', chipsFocus) + ',' + AM('off', chipsFocus) + '{-webkit-transform:none !important;transform:none !important}');
      r.push(AM('lite', chips) + ',' + AM('off', chips) + ',' + TM('lite', ['.torrent-item']) + ',' + TM('off', ['.torrent-item']) + ',' + AM('lite', ['.explorer-card__head-img']) + ',' + AM('off', ['.explorer-card__head-img']) + '{-webkit-animation:none !important;animation:none !important}');
      r.push(AM('lite', chips) + '{-webkit-transition:background-color .2s,color .2s,border-color .2s;transition:background-color .2s,color .2s,border-color .2s}');
      r.push(TM('lite', ['.torrent-item']) + ',' + AM('lite', ['.watched-history']) + '{-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
      r.push(AM('off', chips) + ',' + TM('off', ['.torrent-item']) + ',' + AM('off', ['.watched-history']) + '{-webkit-transition:none;transition:none}');
      return r;
    }

    /* ---------------- 36 / 37: окна TorrServer (Modal) ---------------- */
    function modalRules(k) {
      var r = [];
      var btn = ['.torrent-checklist__footer .simple-button'];
      var btnFocus = ['.torrent-checklist__footer .simple-button.focus'];
      r.push('/* 36 Подключение · 37 Ошибки — оболочка Modal (размеры окна штатные), спиннер, install, чек-лист, nohash, таймаут */');
      r.push(S(['.modal']) + '{background-color:rgba(' + k.bgRgb + ',.7)}');
      /* Task 53: backdrop-filter снят по той же причине, что у панели Select
         выше — Lampa вешает blur(1.6em) на .modal__content одним правилом с
         .selectbox__content (vendor/lampa/css/app.css:16047-16059). */
      r.push(S(['.modal .modal__content']) + '{background-color:' + k.panel + ';border-radius:.614em;-webkit-box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-backdrop-filter:none;backdrop-filter:none}');
      r.push(S(['.modal .modal__head']) + '{margin-bottom:.701em;padding-bottom:.701em;border-bottom:.044em solid ' + k.line + '}');
      /* Заголовок окна и заголовок общего блока .error — один кегль (дизайн: 28px на всех окнах пути). */
      r.push(S(['.modal .modal__title', '.modal .error__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');
      /* Общий блок .error — только внутри Modal: иконка close в круге spice. */
      r.push(S(['.modal .error__ico']) + '{position:relative;width:2.455em;height:2.455em;margin-right:.701em;border-radius:50%;background:' + k.spice + '}');
      r.push(S(['.modal .error__ico:before']) + '{content:"";position:absolute;top:50%;left:50%;width:1.227em;height:1.227em;margin:-.614em 0 0 -.614em;background-color:' + k.dark + '}');
      useMask('close', S(['.modal .error__ico:before']));
      r.push(S(['.modal .error__text']) + '{font-size:1.01em;font-weight:400;line-height:1.4;margin-top:.334em;color:' + k.muted + '}');
      /* Причины (torrent_nohash): code-чип с многоточием (лок. em от 20px). */
      r.push(T(['.torrent-error']) + '{margin-top:1.052em;padding-top:1.052em;border-top:.044em solid ' + k.line + ';font-family:' + k.fontBody + '}');
      r.push(T(['.torrent-error > div > div']) + '{font-size:1.01em;font-weight:600;line-height:1.2}');
      r.push(T(['.torrent-error > div > ul']) + '{margin-top:.347em;font-size:1.01em;font-weight:400;line-height:1.3;color:' + k.muted + '}');
      r.push(T(['.torrent-error > div > ul > li + li']) + '{margin-top:.4em}');
      r.push(T(['.torrent-error > div > ul > li::before']) + '{top:.55em;background-color:' + k.smoke + '}');
      r.push(T(['.torrent-error code']) + '{display:block;margin-top:.396em;padding:.495em .693em;border-radius:.347em;background-color:' + k.raised + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-size:1.01em;word-break:normal;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
      /* Спиннер: вместо loader.svg — маска torrent 48px на радиальном glow 100px. */
      r.push(T(['.modal-loading']) + '{position:relative;height:4.384em;background:none}');
      r.push(T(['.modal-loading:before']) + '{content:"";position:absolute;top:50%;left:50%;width:4.384em;height:4.384em;margin:-2.192em 0 0 -2.192em;border-radius:50%;background:radial-gradient(circle,' + k.acglow + ' 0%,rgba(' + k.accentRgb + ',0) 70%)}');
      r.push(T(['.modal-loading:after']) + '{content:"";position:absolute;top:50%;left:50%;width:2.104em;height:2.104em;margin:-1.052em 0 0 -1.052em;background-color:' + k.accent + '}');
      useMask('torrent', T(['.modal-loading:after']));
      r.push(TM('full', ['.modal-loading:after']) + '{-webkit-animation:lumen-tp-pulse 2s ease-in-out infinite;animation:lumen-tp-pulse 2s ease-in-out infinite}');
      r.push('@-webkit-keyframes lumen-tp-pulse{0%,100%{-webkit-transform:scale(1)}50%{-webkit-transform:scale(1.08)}}');
      r.push('@keyframes lumen-tp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}');
      /* TorrServer не задан: корень div.torrent-install (тот же класс у <img> внутри). */
      r.push(T(['div.torrent-install']) + '{-webkit-box-align:center;-webkit-align-items:center;align-items:center;font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(T(['.torrent-install__left']) + '{width:47%;padding-right:1.754em}');
      r.push(T(['.torrent-install__details']) + '{width:53%}');
      r.push(T(['.torrent-install__left img']) + '{display:block;max-width:100%;border-radius:.438em}');
      r.push(T(['.torrent-install__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.403em;line-height:1.1;margin-bottom:.563em}');
      r.push(T(['.torrent-install__descr']) + '{font-size:1.052em;line-height:1.45;margin-bottom:.75em;color:' + k.muted + '}');
      r.push(T(['.torrent-install__label']) + '{font-size:1.01em;font-weight:600;margin-bottom:.521em}');
      r.push(T(['.torrent-install__link']) + '{margin:0 .526em .526em 0;padding:.526em .789em;border-radius:.307em;background-color:' + k.raised + ';color:' + k.text + '}');
      r.push(T(['.torrent-install__link > div:first-child']) + '{font-size:1.01em;font-weight:500;margin-bottom:.174em}');
      r.push(T(['.torrent-install__link > div:last-child']) + '{font-size:1.01em;font-family:' + k.fontBody + ';color:' + k.muted + '}');
      /* Чек-лист: прогресс 4px accent; шаги — будущий smoke, текущий text 22px 600,
         пройденный (li.wait.check) muted + зачёркнут. */
      r.push(T(['.torrent-checklist']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(T(['.torrent-checklist__descr']) + '{font-size:1.1em;line-height:1.4;margin-bottom:.438em;color:' + k.muted + '}');
      r.push(T(['.torrent-checklist__progress-steps']) + '{font-family:' + k.fontBody + ';font-size:1.01em;margin-bottom:.478em;color:' + k.text + '}');
      r.push(T(['.torrent-checklist__progress-bar']) + '{height:.175em;margin-bottom:1.403em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
      r.push(T(['.torrent-checklist__progress-bar > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');
      r.push(T(['.torrent-checklist__steps']) + '{width:44%;padding-right:1.403em}');
      r.push(T(['.torrent-checklist__info']) + '{width:56%}');
      r.push(T(['.torrent-checklist__list > li']) + '{font-size:1.01em;font-weight:400;line-height:1.2;margin-bottom:.391em;color:' + k.smoke + '}');
      r.push(T(['.torrent-checklist__list > li.wait']) + '{color:' + k.text + ';font-size:1.1em;font-weight:600;margin-bottom:.359em}');
      r.push(T(['.torrent-checklist__list > li.wait.check', '.torrent-checklist__list > li.check']) + '{color:' + k.muted + ';font-size:1.01em;font-weight:400;margin-bottom:.391em;text-decoration:line-through}');
      r.push(T(['.torrent-checklist__info > div']) + '{font-size:1.01em;line-height:1.45;color:' + k.muted + '}');
      r.push(T(['.torrent-checklist__footer']) + '{margin-top:1.052em;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
      r.push(T(['.torrent-checklist__next-step']) + '{margin-left:.912em;font-size:1.01em;color:' + k.muted + '}');
      /* «Далее» — токен «Кнопка» карточки: h72 r18, фокус scale 1.06 +
         подложка (лок. em от 24px: font-size кнопки 1.052em). Task 54:
         заливка фокуса — инверсия k.text/k.bg, кольцо k.ring снято. Task 50c:
         размытия нет, было 0 .583em 1.667em (14/40 px); смещение .19em — те
         же ~4.6 px, что .2em на базовой шкале. */
      r.push(T(btn) + '{font-size:1.052em;height:3em;padding:0 1.25em;margin-right:0;border-radius:.75em;border:.042em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
      r.push(T(btnFocus) + '{background-color:' + k.text + ';color:' + k.bg + ';-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .19em 0 ' + k.acglow + ';box-shadow:0 .19em 0 ' + k.acglow + '}');
      r.push(TM('lite', btnFocus) + ',' + TM('off', btnFocus) + '{-webkit-transform:none !important;transform:none !important}');
      r.push(TM('lite', btn) + ',' + TM('off', btn) + '{-webkit-animation:none !important;animation:none !important}');
      r.push(TM('lite', btn) + '{-webkit-transition:background-color .2s,color .2s,border-color .2s;transition:background-color .2s,color .2s,border-color .2s}');
      r.push(TM('off', btn) + '{-webkit-transition:none;transition:none}');
      /* Без масок: иконки ошибки нет (остаётся круг spice), спиннер — кольцо accent. */
      r.push(SUPPORTS_NO_MASK + S(['.modal .error__ico:before']) + '{display:none}' + T(['.modal-loading:after']) + '{background-color:transparent;border:.132em solid ' + k.accent + ';border-radius:50%}}');
      return r;
    }

    /* ---------------- 38 / 39: списки файлов ---------------- */
    function filesRules(k) {
      var r = [];
      var rows = ['.torrent-file', '.torrent-serial'];
      r.push('/* 38 Файлы — фильм · 39 Файлы — сериал (+ полоска автостарта) */');
      r.push(T(['.torrent-files .torrent-file + .torrent-file', '.torrent-files .torrent-file + .torrent-serial', '.torrent-files .torrent-serial + .torrent-file', '.torrent-files .torrent-serial + .torrent-serial']) + '{margin-top:.701em}');
      r.push(T(['.torrnet-folder-name']) + '{font-family:' + k.fontBody + ';font-size:1.01em;line-height:1.2;padding:.695em 0;color:' + k.muted + ';opacity:.5}');
      r.push(T(['.torrnet-folder-name.focus']) + '{opacity:1;color:' + k.accent + '}');
      r.push(T(rows) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
      /* Task 50c: подложка фокуса без размытия (было 0 .526em 1.534em —
         12/35 px). Список файлов особенно длинный, фокус идёт по нему
         шагами, и каждый шаг перерисовывал сразу две строки. */
      r.push(T(['.torrent-file.focus', '.torrent-serial.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;-webkit-box-shadow:0 .2em 0 ' + k.acglow + ';box-shadow:0 .2em 0 ' + k.acglow + '}');
      /* Файл фильма: название 500 22px (muted вне фокуса), .exe инлайном, тёмный чип размера. */
      r.push(T(['.torrent-file']) + '{padding:.701em .789em;overflow:hidden}');
      r.push(T(['.torrent-file.focus']) + '{padding:.614em .701em}');
      r.push(T(['.torrent-file__title']) + '{font-size:1.1em;font-weight:500;line-height:1.25;padding-right:.637em;color:' + k.muted + '}');
      r.push(T(['.torrent-file__title .exe']) + '{display:inline;margin-left:.36em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;color:' + k.smoke + '}');
      r.push(T(['.torrent-file.focus .torrent-file__title']) + '{color:' + k.text + '}');
      r.push(T(['.torrent-file.focus .torrent-file__title .exe']) + '{color:' + k.muted + '}');
      r.push(T(['.torrent-file__size', '.torrent-serial__size']) + '{font-size:1.01em;font-family:' + k.fontBody + ';font-weight:400;line-height:1;padding:.304em .608em;border-radius:.304em;border:.043em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + '}');
      r.push(T(['.torrent-file.focus .torrent-file__size', '.torrent-serial.focus .torrent-serial__size']) + '{color:' + k.text + '}');
      /* Прогресс просмотра (.time-line — только внутри файла/серии): 4px accent. */
      r.push(T(['.torrent-file .time-line']) + '{left:0;right:0;bottom:0;margin:0;height:.175em;border-radius:0;background-color:rgba(' + k.textRgb + ',.16)}');
      r.push(T(['.torrent-serial .time-line']) + '{margin-top:.35em;height:.175em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
      r.push(T(['.torrent-file .time-line > div', '.torrent-serial .time-line > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');
      /* Серия: превью 200×112, бейдж номера 17px (лок. em), мета muted. */
      r.push(T(['.torrent-serial']) + '{padding:.526em}');
      r.push(T(['.torrent-serial.focus']) + '{padding:.439em}');
      r.push(T(['.torrent-serial__img']) + '{width:8.768em;height:4.932em;border-radius:.307em;-webkit-align-self:center;-ms-flex-item-align:center;align-self:center}');
      r.push(T(['.torrent-serial__content']) + '{padding:0 .175em 0 .701em}');
      r.push(T(['.torrent-serial__title']) + '{font-size:1.01em;font-weight:600;line-height:1.25;margin-top:0}');
      r.push(T(['.torrent-serial__line']) + '{font-family:' + k.fontBody + ';font-size:1.01em;font-weight:400;line-height:1.2;margin-top:.304em;color:' + k.muted + '}');
      r.push(T(['.torrent-serial__line b']) + '{font-weight:400}');
      r.push(T(['.torrent-serial__line span + span:before']) + '{content:"\\00B7";margin:0 .5em;color:' + k.smoke + '}');
      r.push(T(['.torrent-serial__exe']) + '{font-family:' + k.fontBody + ';font-size:1.01em;margin-top:.304em;color:' + k.smoke + '}');
      r.push(T(['.torrent-serial__episode']) + '{top:.867em;left:.867em;padding:.173em .39em;border-radius:.173em;background-color:rgba(0,0,0,.7);font-family:' + k.fontBody + ';font-size:1.01em;font-weight:600;line-height:1;color:' + k.text + '}');
      r.push(T(['.torrent-serial.focus .torrent-serial__episode']) + '{top:1.059em;left:1.059em}');
      /* Автостарт единственного файла: полоска 3px accent + glow, растёт снизу вверх (высоту двигает JS Lampa). */
      r.push(T(['.torrent-serial__progress']) + '{top:auto;bottom:.526em;right:.526em;width:.132em;max-height:-webkit-calc(100% - 1.052em);max-height:calc(100% - 1.052em);border-radius:.066em;background-color:' + k.accent + ';-webkit-box-shadow:0 0 .526em ' + k.acglow + ';box-shadow:0 0 .526em ' + k.acglow + ';-webkit-transform:none;transform:none}');
      r.push(TM('lite', rows) + '{-webkit-transition:border-color .2s,background-color .2s;transition:border-color .2s,background-color .2s}');
      r.push(TM('off', rows) + '{-webkit-transition:none;transition:none}');
      return r;
    }

    /* ---------------- 40: предзагрузка (media-loading) ---------------- */
    function mediaRules(k) {
      var r = [];
      var markSel = ['.media-loading__mark'];
      r.push('/* 40 Предзагрузка — media-loading: вуаль, название-фолбэк, пилюля статуса */');
      r.push(T(['.media-loading']) + '{background-color:' + k.bg + ';font-family:' + k.fontBody + '}');
      r.push(T(['.media-loading__shade']) + '{background:linear-gradient(0deg,rgba(' + k.bgRgb + ',.98) 0%,rgba(' + k.bgRgb + ',.72) 34%,rgba(' + k.bgRgb + ',.3) 100%)}');
      /* Тусклая копия 12 %, яркая (ширину двигает JS Lampa по прогрессу) — акцент с glow. */
      r.push(T(['.media-loading__mark-background']) + '{opacity:.12}');
      r.push(T(['.media-loading__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.403em;line-height:1.1;letter-spacing:.06em;text-transform:uppercase;color:' + k.text + ';text-shadow:none}');
      r.push(T(['.media-loading__mark-fill .media-loading__title']) + '{color:' + k.accent + ';text-shadow:0 0 .94em ' + k.acglow + '}');
      r.push(T(['.media-loading__mark-fill .media-loading__logo']) + '{-webkit-filter:drop-shadow(0 0 .6em ' + k.acglow + ');filter:drop-shadow(0 0 .6em ' + k.acglow + ')}');
      /* Пульс 1→1.02 / 2 с вместо штатного mediaLoadingPulse — только в full; lite/off — без пульса. */
      r.push(TM('full', markSel) + '{-webkit-animation:lumen-tp-soft 2s ease-in-out infinite;animation:lumen-tp-soft 2s ease-in-out infinite}');
      r.push(TM('lite', markSel) + ',' + TM('off', markSel) + '{-webkit-animation:none !important;animation:none !important;-webkit-transform:none;transform:none}');
      r.push('@-webkit-keyframes lumen-tp-soft{0%,100%{-webkit-transform:scale(1)}50%{-webkit-transform:scale(1.02)}}');
      r.push('@keyframes lumen-tp-soft{0%,100%{transform:scale(1)}50%{transform:scale(1.02)}}');
      /* Пилюля: 20px muted, процент 28px text, «пиры» — маска torrent в accent (лок. em от 20px).
         Фон — светлая полупрозрачная заливка с рамкой, а не rgba(bg,.62) экспорта: у нижнего
         края вуаль .98 и тёмная пилюля сливалась с фоном (живой регресс Task 33). */
      r.push(T(['.media-loading__status']) + '{bottom:5.644em;padding:.695em 1.216em;border-radius:1.302em;border:.043em solid rgba(' + k.textRgb + ',.24);background-color:rgba(' + k.textRgb + ',.1);-webkit-box-shadow:0 .608em 1.737em rgba(0,0,0,.35);box-shadow:0 .608em 1.737em rgba(0,0,0,.35);color:' + k.muted + ';font-family:' + k.fontBody + ';font-size:1.01em}');
      r.push(T(['.media-loading__peers-value']) + '{color:' + k.muted + '}');
      r.push(T(['.media-loading__peers-icon']) + '{display:none}');
      r.push(T(['.media-loading__peers:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;margin-right:.5em;background-color:' + k.accent + '}');
      useMask('torrent', T(['.media-loading__peers:before']));
      r.push(T(['.media-loading__separator']) + '{width:.05em;height:1.2em;margin:0 1em;border-radius:0;background-color:rgba(' + k.textRgb + ',.2)}');
      r.push(T(['.media-loading__percent']) + '{font-size:1.4em;font-weight:600;color:' + k.text + '}');
      r.push(SUPPORTS_NO_MASK + T(['.media-loading__peers-icon']) + '{display:block !important;width:1.3em;height:1.3em;margin-right:.5em;color:' + k.accent + ';opacity:1}' + T(['.media-loading__peers:before']) + '{display:none !important}}');
      return r;
    }

    /* ---------------- Task 73: плоский вид пути TorrServer ---------------- */
    /* Настройка lumen_flat (src/81_prefs.js) выключена по умолчанию и
       включена в пресете «Как Apple TV». Отзыв пользователя 2026-09-21
       (п.3): стиль менял только главную — на пути до плеера раскладка
       оставалась прежней, список карточек-коробок с рамками.
       Плоский вид снимает у раздач и файлов заливку, рамку и радиус, а
       строки разделяет тонкой линией: рамка остаётся в раскладке (цвет
       прозрачный, ширина та же .044em), поэтому ни одна строка не съезжает,
       а верхняя кромка соседней строки получает цвет k.line и становится
       разделителем.
       Фокус не трогается ни одной строкой: правила .torrent-item.focus,
       .torrent-file.focus и .torrent-serial.focus специфичнее базовых
       (лишний класс), поэтому и заливка, и акцентная рамка фокуса остаются
       ровно такими же, как в обычном виде. */
    function flatRules(k) {
      var r = [];
      var rows = ['.torrent-file', '.torrent-serial'];
      var next = ['.torrent-files .torrent-file + .torrent-file', '.torrent-files .torrent-file + .torrent-serial',
        '.torrent-files .torrent-serial + .torrent-file', '.torrent-files .torrent-serial + .torrent-serial'];
      r.push('/* 41 Плоский вид (lumen_flat): раздачи и файлы без карточек */');
      r.push(T(['.torrent-item']) + '{background-color:transparent;border-color:transparent;border-radius:0}');
      r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:0;border-top-color:' + k.line + '}');
      r.push(T(rows) + '{background-color:transparent;border-color:transparent;border-radius:0}');
      r.push(T(next) + '{margin-top:0;border-top-color:' + k.line + '}');
      return r;
    }

    function css() {
      var k = LC.tokens();
      maskUse = { order: [], by: {} };
      var flat = LC.pref('lumen_flat', false) ? flatRules(k) : [];
      return [].concat(selectRules(k), explorerRules(k), modalRules(k), filesRules(k), mediaRules(k), flat, maskRules()).join('\n');
    }

    /* ---------------- DOM ---------------- */

    function mark(object) {
      if (!object || !object.activity || typeof object.activity.render !== 'function') return;
      var root = object.activity.render();
      if (root && root.length && typeof root.addClass === 'function') root.addClass(MARK);
    }

    /* Lampa 3.3.4: 'start' приходит и при Activity.push, и при возврате
       backward() (см. 90_runtime.js, LC.onActivityEvent); render() —
       внешний .activity (проверено живьём). */
    function onActivity(e) {
      try {
        if (e && e.type === 'start' && e.component === 'torrents') mark(e.object);
      } catch (err) {
        warn('torrents activity failed', err);
      }
    }

    /* Одна подписка за время жизни плагина; уже открытый экран «Торренты»
       помечается сразу. */
    function install() {
      if (installed) return;
      if (typeof Lampa === 'undefined' || !Lampa) {
        warn('torrents: Lampa not found');
        return;
      }
      installed = true;
      try {
        if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') Lampa.Listener.follow('activity', onActivity);
      } catch (e) {
        warn('torrents listener failed', e);
      }
      try {
        var act = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        if (act && act.component === 'torrents') mark(act);
      } catch (e2) {
        warn('torrents active mark failed', e2);
      }
    }

    /* on — вставить/пересобрать <style> (смена акцента/шрифтов тоже идёт
       сюда через LC.injectCss -> LC.applyTorrentsPref) и класс на body;
       off — удалить оба. Тот же текст повторно в DOM не пишется — лишний
       разбор ~45 КБ стилей на ТВ. */
    function toggle(on) {
      try {
        var el = document.getElementById(STYLE_ID);
        if (on) {
          if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.type = 'text/css';
            (document.head || document.getElementsByTagName('head')[0] || document.body).appendChild(el);
            lastText = null;
          }
          var text = css();
          if (text !== lastText) {
            if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
            else el.innerHTML = text;
            lastText = text;
          }
        } else {
          if (el && el.parentNode) el.parentNode.removeChild(el);
          lastText = null;
        }
        $('body').toggleClass(BODY_ON, !!on);
      } catch (e) {
        warn('torrents toggle failed', e);
      }
    }

    return { css: css, scoped: scoped, install: install, toggle: toggle };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.torrents;

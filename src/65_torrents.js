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
     иконку одно правило с data-URI и одно общее — repeat/position/size. */

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
      r.push(S(['.selectbox .selectbox__content']) + '{background:' + k.panel + ';border-left:.044em solid ' + k.line + ';color:' + k.text + ';font-family:' + k.fontBody + '}');
      r.push(S(['.selectbox .selectbox__head']) + '{padding:2.805em 2.805em 1.052em 1.403em}');
      r.push(S(['.selectbox .selectbox__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');
      /* Горизонтальный отступ панели — полями пункта, а не паддингом тела:
         scale(1.02) фокуса не упирается в край скролла, чужие блоки в теле не сдвигаются. */
      r.push(S(['.selectbox .selectbox-item']) + '{margin:0 2.805em .351em 1.403em;padding:.614em .701em;border-radius:.438em;color:' + k.text + ';-webkit-transition:background-color .2s,color .2s,-webkit-transform .2s;transition:background-color .2s,color .2s,transform .2s}');
      r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
      /* Разделитель групп (штатный items c separator:true — Lampa рисует его
         как .settings-param-title, app.min.js bind). Он есть и в штатном меню
         карточки («Избранное»), и перед нашими пунктами в нём (Task 26,
         src/63_cardmenu.js). Поля — как у пункта, чтобы подпись группы стояла
         по одной линии со списком. */
      r.push(S(['.selectbox .settings-param-title']) + '{margin:1.052em 2.805em .35em 1.403em;padding:0;border:0;background:none;font-family:' + k.fontBody + ';font-size:.745em;font-weight:700;line-height:1.2;letter-spacing:.08em;text-transform:uppercase;color:' + k.muted + '}');
      /* Текст подписи Lampa кладёт в <span> и красит его своим правилом
         (rgba(255,255,255,.4)) — цвет на обёртке до него не доходит. */
      r.push(S(['.selectbox .settings-param-title > span']) + '{color:' + k.muted + '}');
      r.push(S(['.selectbox .selectbox-item__subtitle']) + '{font-size:.877em;font-weight:400;line-height:1.2;margin-top:.2em;color:' + k.muted + ';opacity:1}');
      r.push(S(['.selectbox .selectbox-item.focus']) + '{background-color:' + k.accent + ';color:' + k.onac + ';-webkit-transform:scale(1.02);transform:scale(1.02)}');
      r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + k.onac + ';opacity:.72}');
      /* Иконки: без :has() svg не выбрать по вложенному <use>, поэтому маской
         спрайт не заменить — штатный спрайт Lampa (голый <svg><use/></svg> из
         кнопок карточки) только уменьшен до 26px и красится currentColor.
         Иконки плагинов (svg с viewBox/width/class) не трогаются. */
      r.push(S(['.selectbox .selectbox-item__icon']) + '{margin-right:.701em;min-width:1.403em;display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(S(['.selectbox .selectbox-item__icon > svg:not([viewBox]):not([class]):not([width])']) + '{width:1.14em;height:1.14em}');
      /* Чекбоксы фильтра (штатные selectbox-item--checkbox / __checkbox / --checked): квадрат слева, галочка check. */
      r.push(S(['.selectbox .selectbox-item--checkbox']) + '{padding-left:2.543em;padding-right:.701em}');
      r.push(S(['.selectbox .selectbox-item__checkbox']) + '{top:50%;right:auto;left:.701em;width:1.227em;height:1.227em;margin-top:-.614em;border:.044em solid ' + k.line + ';border-radius:.307em;-webkit-box-sizing:border-box;box-sizing:border-box}');
      r.push(S(['.selectbox .selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + k.accent + '}');
      r.push(S(['.selectbox .selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + k.onac + '}');
      r.push(S(['.selectbox .selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + k.onac + '}');
      r.push(S(check) + '{top:50%;left:50%;right:auto;width:.877em;height:.877em;margin:-.439em 0 0 -.439em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
      useMask('check', S(check));
      /* Выбранный пункт сортировки (штатные .selected / .picked): галочка check справа, как у Lampa. */
      r.push(S(['.selectbox .selectbox-item.selected:not(.nomark)', '.selectbox .selectbox-item.picked']) + '{padding-right:2.63em}');
      r.push(S(sortCheck) + '{top:50%;right:.701em;width:.964em;height:.964em;margin-top:-.482em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor}');
      useMask('check', S(sortCheck));
      r.push(S(['.selectbox .selectbox-item.selected.focus:not(.nomark)::after', '.selectbox .selectbox-item.picked.focus::after']) + '{color:' + k.onac + '}');
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
      r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontBody + ';font-size:.877em;letter-spacing:.03em;color:' + k.muted + '}');
      r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
      r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontBody + ';font-size:.964em;font-weight:600}');
      r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
      r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor}');
      useMask('star', A(['.explorer-card__head-rate:before']));
      r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
      r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
      r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontBody + ';font-size:.877em;color:' + k.smoke + ';margin-bottom:.8em}');
      r.push(A(['.explorer-card__descr']) + '{font-size:.877em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');

      /* Чипы фильтра и кнопки пустого состояния: h56 r12 panel+line (лок. em от 20px). */
      r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
      r.push(A(chips) + '{font-size:.877em;height:2.8em;padding:0 1em;margin-right:.6em;border-radius:.6em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-box-shadow .28s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,box-shadow .28s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
      r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');
      /* Фокус — токен «Кнопка» карточки: заливка, кольцо, scale 1.06, glow.
         !important — поверх animation-button-focus Lampa. */
      r.push(A(chipsFocus) + '{background-color:' + k.accent + ';color:' + k.onac + ';border-color:' + k.ring + ';border-width:.125em;-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .7em 2em ' + k.acglow + ';box-shadow:0 .7em 2em ' + k.acglow + '}');
      /* «Назад» — зеркальный chevronR; «Поиск» — search с раскрытым запросом. */
      r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
      r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
      r.push(A(['.torrent-filter .filter--back:before']) + '{-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
      useMask('chevronR', A(['.torrent-filter .filter--back:before']));
      useMask('search', A(['.torrent-filter .filter--search:before']));
      r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.6em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:1em;font-weight:400;color:' + k.smoke + '}');
      r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
      r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.onac + ';border-left-color:' + k.onac + '}');
      /* Индикатор «применён фильтр»: Filter.chosen() заполняет div и снимает .hide — точка accent. */
      r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1em;width:.5em;height:.5em;margin-left:.5em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:2em;color:transparent}');
      r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.onac + '}');

      /* Раздачи (.torrent-item — уникальный класс пути). */
      r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
      r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,background-color .2s,box-shadow .2s}');
      r.push(T(['.torrent-item + .torrent-item']) + '{margin-top:.701em}');
      /* Фокус: рамка 3px accent + glow, без scale; паддинг -2px компенсирует рамку. */
      r.push(T(['.torrent-item.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;padding:.701em;-webkit-box-shadow:0 .614em 1.754em ' + k.acglow + ';box-shadow:0 .614em 1.754em ' + k.acglow + '}');
      r.push(T(['.torrent-item.focus::after']) + '{border-color:transparent}');
      r.push(T(['.torrent-item__title']) + '{font-size:1.052em;font-weight:600;line-height:1.2;word-break:normal;word-wrap:break-word;overflow-wrap:break-word;padding-right:6.667em}');
      r.push(T(['.torrent-item__details']) + '{margin-top:.45em;font-size:.877em;font-weight:400;color:' + k.muted + '}');
      r.push(T(['.torrent-item__details > div']) + '{margin-right:0}');
      r.push(T(['.torrent-item__tracker']) + '{-webkit-box-flex:0;-webkit-flex-grow:0;flex-grow:0}');
      r.push(T(['.torrent-item__details > div + div:not(.torrent-item__size):before']) + '{content:"\\00B7";margin:0 .6em;color:' + k.smoke + '}');
      r.push(T(['.torrent-item__bitrate > span', '.torrent-item__seeds > span', '.torrent-item__grabs > span']) + '{background:transparent;padding:0;min-width:0;border-radius:0;color:inherit}');
      /* Размер — светлый чип справа сверху, одинаково во всех строках (лок. em от 20px). */
      r.push(T(['.torrent-item__size']) + '{position:absolute;top:.9em;right:.9em;margin:0;padding:.35em .7em;border-radius:.35em;background-color:' + k.text + ';color:' + k.dark + ';font-size:1em;font-weight:600;line-height:1}');
      r.push(T(['.torrent-item.focus .torrent-item__size']) + '{top:.8em;right:.8em}');
      /* Медиачипы ffprobe (m-*): рамка, лок. em от 20px, штатные значки Lampa остаются. */
      r.push(T(['.torrent-item__ffprobe']) + '{padding-top:.175em}');
      r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:.877em;font-family:' + k.fontBody + ';font-weight:400;letter-spacing:.06em;line-height:1;color:' + k.text + ';background:transparent;border:.05em solid rgba(' + k.textRgb + ',.24);border-radius:.35em;padding:.35em .55em;margin:.4em .4em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
      r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1em;padding:0;background:transparent;border-radius:0}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');
      /* «Просмотрено» — круг accent с check (угол, как у Lampa: элемент в конце строки). */
      r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
      r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor}');
      useMask('check', T(['.torrent-item__viewed:before']));

      /* «Продолжить» (штатный .watched-history). */
      r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontBody + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,box-shadow .2s}');
      r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
      r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
      r.push(A(['.watched-history__body']) + '{padding-left:.614em;font-size:.877em;line-height:1.3}');
      r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
      r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .614em 1.754em ' + k.acglow + ';box-shadow:0 .614em 1.754em ' + k.acglow + '}');
      r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');

      /* Пусто / ошибка парсера (.empty) и «фильтр ничего не дал» (.empty-filter). */
      r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
      r.push(A(['.empty__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.2}');
      r.push(A(['.empty__descr']) + '{font-size:.877em;line-height:1.45;margin-top:.6em;color:' + k.muted + '}');
      r.push(A(['.empty__footer']) + '{margin-top:1.2em}');
      r.push(A(['.empty-filter__title']) + '{font-size:.964em;font-weight:600;line-height:1.2;margin-bottom:.3em}');
      r.push(A(['.empty-filter__subtitle']) + '{font-size:.877em;font-weight:400;line-height:1.25;margin-bottom:1.2em;color:' + k.muted + '}');
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
      r.push(S(['.modal .modal__content']) + '{background-color:' + k.panel + ';border-radius:.614em;-webkit-box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);box-shadow:0 1.315em 3.945em rgba(0,0,0,.7);color:' + k.text + ';font-family:' + k.fontBody + '}');
      r.push(S(['.modal .modal__head']) + '{margin-bottom:.701em;padding-bottom:.701em;border-bottom:.044em solid ' + k.line + '}');
      /* Заголовок окна и заголовок общего блока .error — один кегль (дизайн: 28px на всех окнах пути). */
      r.push(S(['.modal .modal__title', '.modal .error__title']) + '{font-family:' + k.fontBody + ';font-weight:700;font-size:1.227em;line-height:1.1}');
      /* Общий блок .error — только внутри Modal: иконка close в круге spice. */
      r.push(S(['.modal .error__ico']) + '{position:relative;width:2.455em;height:2.455em;margin-right:.701em;border-radius:50%;background:' + k.spice + '}');
      r.push(S(['.modal .error__ico:before']) + '{content:"";position:absolute;top:50%;left:50%;width:1.227em;height:1.227em;margin:-.614em 0 0 -.614em;background-color:' + k.dark + '}');
      useMask('close', S(['.modal .error__ico:before']));
      r.push(S(['.modal .error__text']) + '{font-size:.964em;font-weight:400;line-height:1.4;margin-top:.35em;color:' + k.muted + '}');
      /* Причины (torrent_nohash): code-чип с многоточием (лок. em от 20px). */
      r.push(T(['.torrent-error']) + '{margin-top:1.052em;padding-top:1.052em;border-top:.044em solid ' + k.line + ';font-family:' + k.fontBody + '}');
      r.push(T(['.torrent-error > div > div']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
      r.push(T(['.torrent-error > div > ul']) + '{margin-top:.4em;font-size:.877em;font-weight:400;line-height:1.3;color:' + k.muted + '}');
      r.push(T(['.torrent-error > div > ul > li + li']) + '{margin-top:.4em}');
      r.push(T(['.torrent-error > div > ul > li::before']) + '{top:.55em;background-color:' + k.smoke + '}');
      r.push(T(['.torrent-error code']) + '{display:block;margin-top:.4em;padding:.5em .7em;border-radius:.35em;background-color:' + k.raised + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-size:1em;word-break:normal;white-space:nowrap;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis}');
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
      r.push(T(['.torrent-install__label']) + '{font-size:.877em;font-weight:600;margin-bottom:.6em}');
      r.push(T(['.torrent-install__link']) + '{margin:0 .526em .526em 0;padding:.526em .789em;border-radius:.307em;background-color:' + k.raised + ';color:' + k.text + '}');
      r.push(T(['.torrent-install__link > div:first-child']) + '{font-size:.877em;font-weight:500;margin-bottom:.2em}');
      r.push(T(['.torrent-install__link > div:last-child']) + '{font-size:.877em;font-family:' + k.fontBody + ';color:' + k.muted + '}');
      /* Чек-лист: прогресс 4px accent; шаги — будущий smoke, текущий text 22px 600,
         пройденный (li.wait.check) muted + зачёркнут. */
      r.push(T(['.torrent-checklist']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(T(['.torrent-checklist__descr']) + '{font-size:.964em;line-height:1.4;margin-bottom:.5em;color:' + k.muted + '}');
      r.push(T(['.torrent-checklist__progress-steps']) + '{font-family:' + k.fontBody + ';font-size:.877em;margin-bottom:.55em;color:' + k.text + '}');
      r.push(T(['.torrent-checklist__progress-bar']) + '{height:.175em;margin-bottom:1.403em;border-radius:.088em;background-color:rgba(' + k.textRgb + ',.16);overflow:hidden}');
      r.push(T(['.torrent-checklist__progress-bar > div']) + '{height:100%;border-radius:.088em;background-color:' + k.accent + '}');
      r.push(T(['.torrent-checklist__steps']) + '{width:44%;padding-right:1.403em}');
      r.push(T(['.torrent-checklist__info']) + '{width:56%}');
      r.push(T(['.torrent-checklist__list > li']) + '{font-size:.877em;font-weight:400;line-height:1.2;margin-bottom:.45em;color:' + k.smoke + '}');
      r.push(T(['.torrent-checklist__list > li.wait']) + '{color:' + k.text + ';font-size:.964em;font-weight:600;margin-bottom:.41em}');
      r.push(T(['.torrent-checklist__list > li.wait.check', '.torrent-checklist__list > li.check']) + '{color:' + k.muted + ';font-size:.877em;font-weight:400;margin-bottom:.45em;text-decoration:line-through}');
      r.push(T(['.torrent-checklist__info > div']) + '{font-size:.877em;line-height:1.45;color:' + k.muted + '}');
      r.push(T(['.torrent-checklist__footer']) + '{margin-top:1.052em;-webkit-box-pack:end;-webkit-justify-content:flex-end;justify-content:flex-end}');
      r.push(T(['.torrent-checklist__next-step']) + '{margin-left:1.05em;font-size:.877em;color:' + k.muted + '}');
      /* «Далее» — токен «Кнопка» карточки: h72 r18, фокус scale 1.06 + кольцо + glow 0 14px 40px (лок. em от 24px). */
      r.push(T(btn) + '{font-size:1.052em;height:3em;padding:0 1.25em;margin-right:0;border-radius:.75em;border:.042em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.text + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-box-shadow .28s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,box-shadow .28s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
      r.push(T(btnFocus) + '{background-color:' + k.accent + ';color:' + k.onac + ';border-color:' + k.ring + ';border-width:.104em;-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .583em 1.667em ' + k.acglow + ';box-shadow:0 .583em 1.667em ' + k.acglow + '}');
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
      r.push(T(['.torrnet-folder-name']) + '{font-family:' + k.fontBody + ';font-size:.877em;line-height:1.2;padding:.8em 0;color:' + k.muted + ';opacity:.5}');
      r.push(T(['.torrnet-folder-name.focus']) + '{opacity:1;color:' + k.accent + '}');
      r.push(T(rows) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;color:' + k.text + ';font-family:' + k.fontBody + ';-webkit-transition:border-color .2s,background-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,background-color .2s,box-shadow .2s}');
      r.push(T(['.torrent-file.focus', '.torrent-serial.focus']) + '{background-color:' + k.panelHi + ';border-color:' + k.accent + ';border-width:.132em;-webkit-box-shadow:0 .526em 1.534em ' + k.acglow + ';box-shadow:0 .526em 1.534em ' + k.acglow + '}');
      /* Файл фильма: название 500 22px (muted вне фокуса), .exe инлайном, тёмный чип размера. */
      r.push(T(['.torrent-file']) + '{padding:.701em .789em;overflow:hidden}');
      r.push(T(['.torrent-file.focus']) + '{padding:.614em .701em}');
      r.push(T(['.torrent-file__title']) + '{font-size:.964em;font-weight:500;line-height:1.25;padding-right:.727em;color:' + k.muted + '}');
      r.push(T(['.torrent-file__title .exe']) + '{display:inline;margin-left:.4em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontBody + ';font-size:.909em;font-weight:400;color:' + k.smoke + '}');
      r.push(T(['.torrent-file.focus .torrent-file__title']) + '{color:' + k.text + '}');
      r.push(T(['.torrent-file.focus .torrent-file__title .exe']) + '{color:' + k.muted + '}');
      r.push(T(['.torrent-file__size', '.torrent-serial__size']) + '{font-size:.877em;font-family:' + k.fontBody + ';font-weight:400;line-height:1;padding:.35em .7em;border-radius:.35em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + '}');
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
      r.push(T(['.torrent-serial__title']) + '{font-size:.877em;font-weight:600;line-height:1.25;margin-top:0}');
      r.push(T(['.torrent-serial__line']) + '{font-family:' + k.fontBody + ';font-size:.877em;font-weight:400;line-height:1.2;margin-top:.35em;color:' + k.muted + '}');
      r.push(T(['.torrent-serial__line b']) + '{font-weight:400}');
      r.push(T(['.torrent-serial__line span + span:before']) + '{content:"\\00B7";margin:0 .5em;color:' + k.smoke + '}');
      r.push(T(['.torrent-serial__exe']) + '{font-family:' + k.fontBody + ';font-size:.877em;margin-top:.35em;color:' + k.smoke + '}');
      r.push(T(['.torrent-serial__episode']) + '{top:1.176em;left:1.176em;padding:.235em .529em;border-radius:.235em;background-color:rgba(0,0,0,.7);font-family:' + k.fontBody + ';font-size:.745em;font-weight:600;line-height:1;color:' + k.text + '}');
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
      r.push(T(['.media-loading__status']) + '{bottom:6.5em;padding:.8em 1.4em;border-radius:1.5em;border:.05em solid rgba(' + k.textRgb + ',.24);background-color:rgba(' + k.textRgb + ',.1);-webkit-box-shadow:0 .7em 2em rgba(0,0,0,.35);box-shadow:0 .7em 2em rgba(0,0,0,.35);color:' + k.muted + ';font-family:' + k.fontBody + ';font-size:.877em}');
      r.push(T(['.media-loading__peers-value']) + '{color:' + k.muted + '}');
      r.push(T(['.media-loading__peers-icon']) + '{display:none}');
      r.push(T(['.media-loading__peers:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;margin-right:.5em;background-color:' + k.accent + '}');
      useMask('torrent', T(['.media-loading__peers:before']));
      r.push(T(['.media-loading__separator']) + '{width:.05em;height:1.2em;margin:0 1em;border-radius:0;background-color:rgba(' + k.textRgb + ',.2)}');
      r.push(T(['.media-loading__percent']) + '{font-size:1.4em;font-weight:600;color:' + k.text + '}');
      r.push(SUPPORTS_NO_MASK + T(['.media-loading__peers-icon']) + '{display:block !important;width:1.3em;height:1.3em;margin-right:.5em;color:' + k.accent + ';opacity:1}' + T(['.media-loading__peers:before']) + '{display:none !important}}');
      return r;
    }

    function css() {
      var k = LC.tokens();
      maskUse = { order: [], by: {} };
      return [].concat(selectRules(k), explorerRules(k), modalRules(k), filesRules(k), mediaRules(k), maskRules()).join('\n');
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

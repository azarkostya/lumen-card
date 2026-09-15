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
     Цвета — только LC.tokens() (30_css.js), иконки — LC.icons.maskUrl(). */

  LC.torrents = (function () {
    var STYLE_ID = 'lumen-torrents-css';
    var BODY_ON = 'lumen-torrents-on';
    var MARK = 'lumen-torrents';
    var MARKS = { selectbox: 'lumen-select', modal: 'lumen-modal' };
    var SUPPORTS_NO_MASK = '@supports not ((-webkit-mask-image:none) or (mask-image:none)){';
    var installed = false;

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
    function A(list) { return T(join(list, function (s) { return '.' + MARK + ' ' + s; }).split(',')); }
    function AM(mode, list) { return TM(mode, join(list, function (s) { return '.' + MARK + ' ' + s; }).split(',')); }

    function mask(name) {
      var u = LC.icons.maskUrl(name);
      return '-webkit-mask-image:' + u + ';mask-image:' + u + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain';
    }

    /* ---------------- 33 / 35: панель Select ---------------- */
    function selectRules(k) {
      var r = [];
      var check = ['.selectbox .selectbox-item--checked .selectbox-item__checkbox::after'];
      var sortCheck = ['.selectbox .selectbox-item.selected:not(.nomark)::after', '.selectbox .selectbox-item.picked::after'];
      r.push('/* 33 Источник · 35 Фильтр, Сортировать, Действие — панель Select (ширина штатная, 35 %) */');
      r.push(S(['.selectbox .selectbox__content']) + '{background:' + k.panel + ';border-left:.044em solid ' + k.line + ';color:' + k.text + ';font-family:' + k.fontBody + '}');
      r.push(S(['.selectbox .selectbox__head']) + '{padding:2.805em 2.805em 1.052em 1.403em}');
      r.push(S(['.selectbox .selectbox__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.227em;line-height:1.1}');
      /* Горизонтальный отступ панели — полями пункта, а не паддингом тела:
         scale(1.02) фокуса не упирается в край скролла, чужие блоки в теле не сдвигаются. */
      r.push(S(['.selectbox .selectbox-item']) + '{margin:0 2.805em .351em 1.403em;padding:.614em .701em;border-radius:.438em;color:' + k.text + ';-webkit-transition:background-color .2s,color .2s,-webkit-transform .2s;transition:background-color .2s,color .2s,transform .2s}');
      r.push(S(['.selectbox .selectbox-item__title']) + '{font-size:.877em;font-weight:600;line-height:1.2}');
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
      r.push(S(check) + '{top:50%;left:50%;right:auto;width:.877em;height:.877em;margin:-.439em 0 0 -.439em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor;' + mask('check') + '}');
      /* Выбранный пункт сортировки (штатные .selected / .picked): галочка check справа, как у Lampa. */
      r.push(S(['.selectbox .selectbox-item.selected:not(.nomark)', '.selectbox .selectbox-item.picked']) + '{padding-right:2.63em}');
      r.push(S(sortCheck) + '{top:50%;right:.701em;width:.964em;height:.964em;margin-top:-.482em;border:0;-webkit-transform:none;transform:none;color:' + k.accent + ';background-color:currentColor;' + mask('check') + '}');
      r.push(S(['.selectbox .selectbox-item.selected.focus:not(.nomark)::after', '.selectbox .selectbox-item.picked.focus::after']) + '{color:' + k.onac + '}');
      /* Без масок — штатная галочка Lampa из рамок (цвет тот же). */
      r.push(SUPPORTS_NO_MASK + S(check.concat(sortCheck)) + '{-webkit-mask-image:none;mask-image:none;background-color:transparent;width:.3em;height:.6em;margin:-.4em 0 0 -.15em;border-right:.15em solid currentColor;border-bottom:.15em solid currentColor;-webkit-transform:rotate(45deg);transform:rotate(45deg)}}');
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
      r.push(A(['.explorer-card__head-create']) + '{font-family:' + k.fontMono + ';font-size:.877em;letter-spacing:.03em;color:' + k.muted + '}');
      r.push(A(['.explorer-card__head-rate']) + '{margin:0 0 0 .614em;color:' + k.accent + '}');
      r.push(A(['.explorer-card__head-rate > span']) + '{font-family:' + k.fontMono + ';font-size:.964em;font-weight:600}');
      r.push(A(['.explorer-card__head-rate > svg']) + '{display:none !important}');
      r.push(A(['.explorer-card__head-rate:before']) + '{content:"";display:block;width:.964em;height:.964em;margin-right:.307em;background-color:currentColor;' + mask('star') + '}');
      r.push(A(['.explorer-card__title']) + '{font-family:' + k.fontDisplay + ';font-weight:800;font-size:1.666em;line-height:1.06;margin-bottom:.316em}');
      r.push(A(['.explorer-card__title.small']) + '{font-size:1.227em}');
      r.push(A(['.explorer-card__genres']) + '{font-family:' + k.fontMono + ';font-size:.877em;color:' + k.smoke + ';margin-bottom:.8em}');
      r.push(A(['.explorer-card__descr']) + '{font-size:.877em;font-weight:400;line-height:1.45;color:' + k.muted + ';display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}');

      /* Чипы фильтра и кнопки пустого состояния: h56 r12 panel+line (лок. em от 20px). */
      r.push(A(['.explorer__files-head']) + '{padding:1.052em 2.805em 0 1.403em}');
      r.push(A(chips) + '{font-size:.877em;height:2.8em;padding:0 1em;margin-right:.6em;border-radius:.6em;border:.05em solid ' + k.line + ';background-color:' + k.panel + ';color:' + k.muted + ';font-family:' + k.fontBody + ';font-weight:600;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-transition:background-color .2s,color .2s,border-color .2s,-webkit-box-shadow .28s,-webkit-transform .28s cubic-bezier(.2,.9,.3,1.25);transition:background-color .2s,color .2s,border-color .2s,box-shadow .28s,transform .28s cubic-bezier(.2,.9,.3,1.25)}');
      r.push(A(['.torrent-filter .simple-button > span', '.empty__footer .simple-button > span']) + '{margin-top:0}');
      /* Фокус — токен «Кнопка» карточки: заливка, кольцо, scale 1.06, glow.
         !important — поверх animation-button-focus Lampa. */
      r.push(A(chipsFocus) + '{background-color:' + k.accent + ';color:' + k.onac + ';border-color:' + k.ring + ';border-width:.125em;-webkit-transform:scale(1.06) !important;transform:scale(1.06) !important;-webkit-box-shadow:0 .7em 2em ' + k.acglow + ';box-shadow:0 .7em 2em ' + k.acglow + '}');
      /* «Назад» — зеркальный chevronR; «Поиск» — search, раскрытый запрос моно. */
      r.push(A(['.torrent-filter .filter--back']) + '{width:2.8em;padding:0;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(A(['.torrent-filter .filter--back > svg', '.torrent-filter .filter--search > svg']) + '{display:none}');
      r.push(A(['.torrent-filter .filter--back:before', '.torrent-filter .filter--search:before']) + '{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.3em;height:1.3em;background-color:currentColor}');
      r.push(A(['.torrent-filter .filter--back:before']) + '{' + mask('chevronR') + ';-webkit-transform:scaleX(-1);transform:scaleX(-1)}');
      r.push(A(['.torrent-filter .filter--search:before']) + '{' + mask('search') + '}');
      r.push(A(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{margin-left:.6em;padding:0;border-radius:0;background:transparent;font-family:' + k.fontMono + ';font-size:1em;font-weight:400;color:' + k.smoke + '}');
      r.push(A(['.torrent-filter .filter--search > div']) + '{padding-left:.6em;border-left:.05em solid ' + k.line + ';max-width:15em}');
      r.push(A(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + k.onac + ';border-left-color:' + k.onac + '}');
      /* Индикатор «применён фильтр»: Filter.chosen() заполняет div и снимает .hide — точка accent. */
      r.push(A(['.torrent-filter .filter--filter > div:not(.hide)']) + '{display:block;-webkit-flex-shrink:0;flex-shrink:0;font-size:1em;width:.5em;height:.5em;margin-left:.5em;padding:0;border-radius:50%;background-color:' + k.accent + ';overflow:hidden;white-space:nowrap;text-indent:2em;color:transparent}');
      r.push(A(['.torrent-filter .filter--filter.focus > div:not(.hide)']) + '{background-color:' + k.onac + '}');

      /* Раздачи (.torrent-item — уникальный класс пути). */
      r.push(A(['.torrent-list']) + '{padding:0 2.805em 1.403em 1.403em}');
      r.push(T(['.torrent-item']) + '{background-color:' + k.panel + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.789em;line-height:1.2;color:' + k.text + ';font-family:' + k.fontMono + ';-webkit-transition:border-color .2s,background-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,background-color .2s,box-shadow .2s}');
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
      /* Медиачипы ffprobe (m-*): рамка, моно (лок. em от 20px), штатные значки Lampa остаются. */
      r.push(T(['.torrent-item__ffprobe']) + '{padding-top:.175em}');
      r.push(T(['.torrent-item__ffprobe > div']) + '{font-size:.877em;font-family:' + k.fontMono + ';font-weight:400;letter-spacing:.06em;line-height:1;color:' + k.text + ';background:transparent;border:.05em solid rgba(' + k.textRgb + ',.24);border-radius:.35em;padding:.35em .55em;margin:.4em .4em 0 0;-webkit-box-shadow:none;box-shadow:none;outline:0}');
      r.push(T(['.torrent-item__ffprobe > div::before']) + '{width:.9em;height:.9em;margin-right:.4em}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(1)', '.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{font-size:1em;padding:0;background:transparent;border-radius:0}');
      r.push(T(['.torrent-item__ffprobe > div.m-general > div:nth-child(2)']) + '{padding-left:.4em}');
      /* «Просмотрено» — круг accent с check (угол, как у Lampa: элемент в конце строки). */
      r.push(T(['.torrent-item__viewed']) + '{top:-.482em;left:-.482em;width:1.578em;height:1.578em;padding:0;border-radius:50%;background-color:' + k.accent + ';color:' + k.onac + ';display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center}');
      r.push(T(['.torrent-item__viewed > svg']) + '{display:none}');
      r.push(T(['.torrent-item__viewed:before']) + '{content:"";display:block;width:.964em;height:.964em;background-color:currentColor;' + mask('check') + '}');

      /* «Продолжить» (штатный .watched-history). */
      r.push(A(['.watched-history']) + '{background-color:' + k.panelLo + ';border:.044em solid ' + k.line + ';border-radius:.438em;padding:.701em .789em;margin-bottom:.701em;color:' + k.muted + ';font-family:' + k.fontMono + ';-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-transition:border-color .2s,-webkit-box-shadow .2s;transition:border-color .2s,box-shadow .2s}');
      r.push(A(['.watched-history__icon']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-box-align:center;-webkit-align-items:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;justify-content:center;width:1.578em;height:1.578em;border-radius:.175em;border:.044em solid ' + k.accent + ';background-color:rgba(' + k.accentRgb + ',.16);color:' + k.accent + '}');
      r.push(A(['.watched-history__icon > svg']) + '{width:.964em !important;height:.964em !important}');
      r.push(A(['.watched-history__body']) + '{padding-left:.614em;font-size:.877em;line-height:1.3}');
      r.push(A(['.watched-history__body > span + span::before']) + '{color:' + k.smoke + '}');
      r.push(A(['.watched-history.focus']) + '{color:' + k.text + ';border-color:' + k.accent + ';border-width:.132em;padding:.614em .701em;-webkit-box-shadow:0 .614em 1.754em ' + k.acglow + ';box-shadow:0 .614em 1.754em ' + k.acglow + '}');
      r.push(A(['.watched-history.focus::after']) + '{border-color:transparent}');

      /* Пусто / ошибка парсера (.empty) и «фильтр ничего не дал» (.empty-filter). */
      r.push(A(['.empty', '.empty-filter']) + '{font-family:' + k.fontBody + ';color:' + k.text + '}');
      r.push(A(['.empty__img']) + '{height:7.014em;margin-bottom:1.403em;opacity:.35}');
      r.push(A(['.empty__title']) + '{font-family:' + k.fontDisplay + ';font-weight:700;font-size:1.227em;line-height:1.2}');
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

    function css() {
      var k = LC.tokens();
      return [].concat(selectRules(k), explorerRules(k)).join('\n');
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
       off — удалить оба. */
    function toggle(on) {
      try {
        var el = document.getElementById(STYLE_ID);
        if (on) {
          if (!el) {
            el = document.createElement('style');
            el.id = STYLE_ID;
            el.type = 'text/css';
            (document.head || document.getElementsByTagName('head')[0]).appendChild(el);
          }
          var text = css();
          if ('styleSheet' in el && el.styleSheet) el.styleSheet.cssText = text;
          else el.innerHTML = text;
        } else if (el && el.parentNode) {
          el.parentNode.removeChild(el);
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

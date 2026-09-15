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

    function css() {
      var k = LC.tokens();
      return [].concat(selectRules(k)).join('\n');
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

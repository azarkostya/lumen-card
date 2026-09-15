  /* -------------------------------------------------------------------- */
  /* Task 31 (фаза 1b): маркеры меню и окон пути TorrServer.                */
  /* -------------------------------------------------------------------- */

  /* Разведка Step 1 (координатор, живая Lampa 3.3.4 + vendor/lampa/app.min.js):
     - Lampa.Select.listener: preshow {active} -> fullshow {active, html} ->
       toggle -> (Controller toggle 'select') -> hide {active} -> close {active};
       e.active.title/items есть уже в preshow. close$a() зовёт onBack() ДО
       send('close'): вложенный Select фильтра в onBack сам открывает
       родительский Select.show, поэтому на close маркер снимаем, только если
       Select.opened() === false.
     - Lampa.Select.render(true) — DOM-элемент .selectbox (не jQuery), тот же
       синглтон, что document.querySelector('.selectbox') — оборачиваем $().
     - Lampa.Modal.listener ЕСТЬ: preshow {active} -> fullshow {active, html} ->
       toggle {active, html} -> (Controller toggle 'modal') -> ... -> close {active}.
       active — объект из Modal.open. .modal НЕ синглтон: создаётся в Modal.open,
       удаляется в Modal.close, поэтому маркер ставится на каждом fullshow.
     - Модалки пути узнаются по содержимому: все состояния шагов 4–12 живут в
       двух Modal.open — loading() (html: modal_loading, дальше Modal.update тем
       же окном: torrent_nohash, error таймаута, чек-лист torrent_error, список
       файлов) и install$1() (html: torrent_install). Modal.update меняет только
       тело (_scroll.clear/append), корень .modal не пересоздаёт.
     - Ключи пунктов (сверено с исходником): источник — title
       settings_rest_source + у пунктов btn; меню раздачи — tomy/mark/unmark;
       меню файла — timeclear/timefull/player/link; сортировка/фильтр — Filter
       активности component === 'torrents' (Select без флагов).
     - Переводы settings_rest_source = «Источник», title_action = «Действие» —
       берём в install(), когда язык уже загружен.
     Разметку, тексты и обработчики Lampa не трогаем: только классы и
     data-lumen-kind на корнях .selectbox/.modal и классы на body. */

  LC.menus = (function () {
    var MARK_SELECT = 'lumen-select';
    var MARK_MODAL = 'lumen-modal';
    var KIND_ATTR = 'data-lumen-kind';
    var MODES = ['all', 'path', 'off'];

    /* 'off' до первого mode(): пока LC.init не активировал плагин, колбэки
       (если install() всё же вызван) маркеров не ставят. */
    var current = 'off';
    var installed = false;
    var titles = { source: '', action: '' };

    function hasFlag(items, names) {
      var i, j;
      for (i = 0; i < items.length; i++) {
        for (j = 0; j < names.length; j++) {
          if (items[i] && items[i][names[j]]) return true;
        }
      }
      return false;
    }

    /* active — объект вызова Select.show; component — компонент активной
       активности; titles — {source, action}, уже переведённые. Пустые items
       допустимы: живьём «Сортировать» на экране торрентов без раздач
       открывается шторкой с 0 пунктов — это тоже экран пути ('filter'). */
    function kind(active, component, titles) {
      if (!active) return null;
      var items = active.items || [];
      if (titles && active.title === titles.source && hasFlag(items, ['btn'])) return 'source';
      if (hasFlag(items, ['tomy', 'mark', 'unmark'])) return 'torrent';
      if (hasFlag(items, ['timeclear', 'timefull', 'player', 'link'])) return 'file';
      if (component === 'torrents') return 'filter';
      return null;
    }

    /* root — jQuery-корень .modal (или любой объект с find/length). */
    function isPathModal(root) {
      if (!root || !root.length || typeof root.find !== 'function') return false;
      return !!(root.find('.modal-loading').length || root.find('.torrent-install').length);
    }

    function normalize(v) {
      for (var i = 0; i < MODES.length; i++) if (v === MODES[i]) return v;
      return 'all';
    }

    function unmarkSelect(root) {
      if (root && root.length) root.removeClass(MARK_SELECT).removeAttr(KIND_ATTR);
    }

    /* Режим оформления: ровно один класс lumen-menus-<v> на body (или ни
       одного при 'off'). Неизвестное значение — как 'all' (значение по
       умолчанию настройки lumen_menus). При 'off' снимает и уже
       поставленные маркеры с открытых корней. Возвращает применённый режим. */
    function mode(v) {
      current = normalize(v);
      var body = $('body');
      for (var i = 0; i < MODES.length; i++) body.removeClass('lumen-menus-' + MODES[i]);
      if (current !== 'off') {
        body.addClass('lumen-menus-' + current);
      } else {
        unmarkSelect($('.selectbox'));
        $('.modal').removeClass(MARK_MODAL);
      }
      return current;
    }

    /* Select из настроек Lampa, открытых поверх экрана торрентов, — не
       фильтр: Activity.active() в этот момент всё ещё 'torrents'. */
    function activeComponent() {
      var enabled = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
      if (enabled && ('' + enabled.name).indexOf('settings') === 0) return '';
      var act = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
      return (act && act.component) || '';
    }

    function onSelectPreshow(e) {
      try {
        var root = $(Lampa.Select.render(true));
        var k = current === 'off' ? null : kind(e && e.active, activeComponent(), titles);
        if (k) root.addClass(MARK_SELECT).attr(KIND_ATTR, k);
        else unmarkSelect(root);
      } catch (err) {
        warn('menus select preshow failed', err);
      }
    }

    function onSelectClose() {
      try {
        if (typeof Lampa.Select.opened === 'function' && Lampa.Select.opened()) return;
        unmarkSelect($(Lampa.Select.render(true)));
      } catch (err) {
        warn('menus select close failed', err);
      }
    }

    function onModalFullshow(e) {
      try {
        if (!e || !e.html) return;
        var root = $(e.html);
        if (current !== 'off' && isPathModal(root)) root.addClass(MARK_MODAL);
        else root.removeClass(MARK_MODAL);
      } catch (err) {
        warn('menus modal fullshow failed', err);
      }
    }

    function onModalClose() {
      try {
        var root = typeof Lampa.Modal.render === 'function' ? Lampa.Modal.render() : null;
        if (root) $(root).removeClass(MARK_MODAL);
      } catch (err) {
        warn('menus modal close failed', err);
      }
    }

    /* Одна подписка на Select/Modal за всё время жизни плагина. */
    function install() {
      if (installed) return;
      if (typeof Lampa === 'undefined' || !Lampa) return;
      installed = true;
      try {
        if (Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
          titles = { source: Lampa.Lang.translate('settings_rest_source'), action: Lampa.Lang.translate('title_action') };
        }
      } catch (e) { }
      try {
        if (Lampa.Select && Lampa.Select.listener) {
          Lampa.Select.listener.follow('preshow', onSelectPreshow);
          Lampa.Select.listener.follow('close', onSelectClose);
        }
      } catch (e2) {
        warn('menus select listener failed', e2);
      }
      try {
        if (Lampa.Modal && Lampa.Modal.listener) {
          Lampa.Modal.listener.follow('fullshow', onModalFullshow);
          Lampa.Modal.listener.follow('close', onModalClose);
        }
      } catch (e3) {
        warn('menus modal listener failed', e3);
      }
    }

    return {
      kind: kind,
      mode: mode,
      install: install,
      isPathModal: isPathModal,
      MARK_SELECT: MARK_SELECT,
      MARK_MODAL: MARK_MODAL
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.menus;

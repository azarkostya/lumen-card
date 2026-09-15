  /* -------------------------------------------------------------------- */
  /* Task 31 (фаза 1b): маркеры меню и окон пути TorrServer.                */
  /* -------------------------------------------------------------------- */

  /* Разведка Step 1 (координатор, живая Lampa 3.3.4 + vendor/lampa/app.min.js):
     - Lampa.Select.listener: preshow {active} -> fullshow {active, html} ->
       toggle -> (Controller toggle 'select') -> hide {active} -> close {active};
       e.active.title/items есть уже в preshow. Выбор пункта шлёт только hide,
       «Назад» — hide -> onBack -> close. На hide/close НЕ подписываемся:
       .selectbox__content уезжает transition 0.2s, снятый в этот момент маркер
       дал бы мелькание штатного стиля. Единственный источник истины — preshow
       (следующий Select сам перезапишет маркер), в 'off' маркеры снимает mode().
     - Lampa.Select.render(true) — DOM-элемент .selectbox (не jQuery), тот же
       синглтон, что document.querySelector('.selectbox') — оборачиваем $().
     - Lampa.Modal.listener ЕСТЬ: preshow {active} -> fullshow {active, html} ->
       toggle {active, html} -> (Controller toggle 'modal') -> ... -> close {active}.
       .modal НЕ синглтон: создаётся в Modal.open, в Modal.close узел удаляется
       ДО send('close') — маркер ставится на каждом fullshow, снимать нечего.
     - Модалки пути узнаются по содержимому: все состояния шагов 4–12 живут в
       двух Modal.open — loading() (html: modal_loading, дальше Modal.update тем
       же окном: torrent_nohash, error таймаута, чек-лист torrent_error, список
       файлов) и install$1() (html: torrent_install). Modal.update меняет только
       тело (_scroll.clear/append), корень .modal не пересоздаёт.
     - Ключи пунктов (сверено с исходником): источник — title
       settings_rest_source + у пунктов btn (37754); меню файла (40817) и меню
       раздачи (43505) — title title_action + timeclear/timefull (всегда есть в
       меню файла; player/link одни не годятся — player бывает у пунктов
       Select трейлеров 37223, плейлист копирует поля элементов) либо
       tomy/mark/unmark; сортировка/фильтр — Filter активности 'torrents',
       открывается из контроллера content (живьём), вложенный Select и
       переоткрытие родителя из onBack — из контроллера select.
     - Select плеера (настройки 12151, плейлист 11581), левого меню (9418,
       10035), шапки (23272) и настроек Lampa открываются поверх, не меняя
       Activity.active() — отсекаются белым списком контроллеров.
     - Перевод settings_rest_source = «Источник», title_action = «Действие» —
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
    var labels = { source: '', action: '' };

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
       активности ('' если Select открыт поверх неё — плеер, меню, шапка,
       настройки); t — {source, action}, уже переведённые. Пустые items
       допустимы: живьём «Сортировать» на экране торрентов без раздач
       открывается шторкой с 0 пунктов — это тоже экран пути ('filter'). */
    function kind(active, component, t) {
      if (!active) return null;
      var items = active.items || [];
      if (t && active.title === t.source && hasFlag(items, ['btn'])) return 'source';
      if (t && active.title === t.action) {
        if (hasFlag(items, ['tomy', 'mark', 'unmark'])) return 'torrent';
        if (hasFlag(items, ['timeclear', 'timefull'])) return 'file';
      }
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
       поставленные маркеры с корней. Возвращает применённый режим. */
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

    /* Поля пунктов Filter экрана торрентов (app.min.js): sort — сортировка
       (42870), stype/reset — фильтр (42971, 43034), global_search/query —
       уточнение поиска (40180). У Select плеера, левого меню, шапки и
       настроек таких полей нет. */
    var FILTER_FLAGS = ['sort', 'stype', 'reset', 'global_search', 'query'];

    /* Компонент для kind(). На torrents Select фильтра узнаётся по полям
       пунктов Filter независимо от контроллера: клик мышью/тачем
       (аэромышь) по кнопке фильтра идёт через hover:enter без проверки
       контроллера (46352). Без таких полей (пустая сортировка без раздач,
       вложенные пункты фильтра) — белый список контроллеров: content
       (Filter открывается из него) или select, когда на корне уже стоит
       filter (вложенный Select и переоткрытие родителя из onBack). Всё
       прочее поверх torrents — плеер, левое меню, шапка, настройки —
       отсекается.
       Допущение: после закрытия фильтра Lampa всегда возвращает контроллер
       content (onBack Filter -> start() компонента torrents), поэтому
       оставшийся на скрытом корне filter при контроллере select не даёт
       ложного срабатывания в штатной Lampa — Select из Select открывает
       только сам Filter. */
    function pathComponent(root, items) {
      var act = Lampa.Activity.active();
      var component = (act && act.component) || '';
      if (component !== 'torrents') return component;
      if (hasFlag(items, FILTER_FLAGS)) return component;
      var enabled = Lampa.Controller.enabled();
      var name = enabled ? '' + enabled.name : '';
      if (name === 'content') return component;
      if (name === 'select' && root.attr(KIND_ATTR) === 'filter') return component;
      return '';
    }

    /* Компонент нужен только для 'filter': source/file/torrent решаются по
       заголовку и флагам без него, и исключение в Activity/Controller их
       не гасит. */
    function selectKind(root, active) {
      var k = kind(active, '', labels);
      if (k || !active) return k;
      var component = '';
      try {
        component = pathComponent(root, active.items || []);
      } catch (err) {
        warn('menus component failed', err);
      }
      return kind(active, component, labels);
    }

    function onSelectPreshow(e) {
      try {
        var root = $(Lampa.Select.render(true));
        var k = current === 'off' ? null : selectKind(root, e && e.active);
        if (k) root.addClass(MARK_SELECT).attr(KIND_ATTR, k);
        else unmarkSelect(root);
      } catch (err) {
        warn('menus select preshow failed', err);
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

    /* Одна подписка на Select/Modal за всё время жизни плагина. */
    function install() {
      if (installed) return;
      if (typeof Lampa === 'undefined' || !Lampa) {
        warn('menus: Lampa not found');
        return;
      }
      installed = true;
      try {
        labels = { source: Lampa.Lang.translate('settings_rest_source'), action: Lampa.Lang.translate('title_action') };
      } catch (e) {
        warn('menus: titles not translated, source/file/torrent menus will not be marked', e);
      }
      try {
        if (Lampa.Select && Lampa.Select.listener) Lampa.Select.listener.follow('preshow', onSelectPreshow);
        else warn('menus: Lampa.Select.listener not found');
      } catch (e2) {
        warn('menus select listener failed', e2);
      }
      try {
        if (Lampa.Modal && Lampa.Modal.listener) Lampa.Modal.listener.follow('fullshow', onModalFullshow);
        else warn('menus: Lampa.Modal.listener not found');
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

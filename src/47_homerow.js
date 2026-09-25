  /* -------------------------------------------------------------------- */
  /* LC.homeRow — фокус возвращается в прежний ряд главной после смены     */
  /* «Кадра над рядами» (следующий раунд, п.10; полное ревью c644bfd, D4). */
  /*                                                                       */
  /* Сценарий. Фокус в третьем ряду главной, пользователь пультом идёт в    */
  /* шапку, шестерёнкой — в настройки, меняет «Кадр над рядами» и выходит   */
  /* «Назад». Главная не пересобирается (LC.applyHeroSizePref: таблица       */
  /* стилей и герой), фокус Lampa возвращает в шапку, а «вниз» из шапки      */
  /* приводит в ПЕРВЫЙ ряд: позиция потеряна.                              */
  /*                                                                       */
  /* Почему первый. Номер ряда главной ведёт Lampa сама — поле active       */
  /* модуля рядов Items$1 (vendor/lampa/app.min.js:35145-35181). Шаг вверх  */
  /* из ряда — onUp: active-- и toggle ряда выше, а из первого — active = 0 */
  /* и Controller.toggle('head') (:35157-35166). То есть путь пульта в      */
  /* шапку идёт ЧЕРЕЗ все ряды выше, и каждый получает фокус. Поэтому       */
  /* «ряд последней карточки в фокусе до ухода в шапку» — всегда первый, и  */
  /* запоминать нужно другое: ряд, из которого пользователь начал подъём.   */
  /* Правило: фокус пульта, пришедший в ряд ВЫШЕ прежнего, ряд-источник не  */
  /* меняет; любой другой (шаг по ряду, вниз, возврат из карточки) — ставит */
  /* свой ряд источником. Подъём из третьего ряда через второй и первый в   */
  /* шапку оставляет источником третий; шаг вправо во втором — уже второй.  */
  /* Мышь номера ряда Lampa не меняет: Items$2 ведёт active по фокусу      */
  /* пульта и касанию (:18988-19001), наведение туда не доходит, — и здесь  */
  /* оно не считается (LC.focus.remote).                                   */
  /*                                                                       */
  /* Возврат — штатными средствами, теми же шагами, что сделал бы пульт:    */
  /* из шапки Controller.toggle('content') (ровно «вниз» шапки,            */
  /* :10207-10209: главная ставит фокус в ряд active, то есть в первый),    */
  /* затем Controller.move('down'), пока фокус не придёт в ряд-источник.   */
  /* Номер ряда Lampa ведёт                                                */
  /* сама (onDown), карточку в ряду даёт память ряда (Line.toggle —         */
  /* collectionFocus(last), :35287-35288: та карточка, с которой из ряда    */
  /* ушли), экран к ряду подкручивает её же onToggle (scroll.update,        */
  /* :35178-35180). Во внутренности Lampa модуль не лезет: ни active, ни    */
  /* items, ни Navigator он не трогает.                                    */
  /*                                                                       */
  /* Когда. Смена размера кадра (LC.applyHeroSizePref, готовый стиль —      */
  /* LC.applyPresetChanges) взводит возврат, если открыта главная и         */
  /* источник известен. Срабатывает он на первом переключении контроллера   */
  /* в шапку или в ряды (выход из настроек: «Назад» — в шапку, «влево» —    */
  /* в ряды; select, settings_component и прочее внутри настроек его не     */
  /* трогают) — через такт, не из рассылки события Lampa. Только на экране  */
  /* ТВ: на телефоне главная фокус в ряды не ставит вовсе (Main.toggle,    */
  /* :35096-35098). Ряд-источник пропал из документа (главную пересобрали)  */
  /* или выше ряда, куда Lampa поставила фокус, — фокус остаётся, где его   */
  /* поставила Lampa.                                                      */
  /*                                                                       */
  /* API: install() / uninstall() — слушатель фокуса на body (фаза         */
  /* захвата, LC.focus.capture: события Lampa не всплывают); arm() — смена  */
  /* размера кадра; onToggle(name) — из общей подписки followToggle         */
  /* (src/90_runtime.js).                                                  */
  /* -------------------------------------------------------------------- */

  LC.homeRow = (function () {

    /* Предел шагов вниз: рядов на главной до трёх десятков. */
    var MAX_STEPS = 60;
    /* Сколько предков карточки обходить в поисках ряда. */
    var MAX_DEPTH = 40;

    var bound = null;
    /* {line, card} — последний фокус пульта в рядах главной. */
    var last = null;
    /* {line, card} — ряд, из которого начали подъём (разбор в шапке). */
    var origin = null;
    /* Ряд, в который вернуть фокус, — снимок источника на момент смены
       настройки. Снимок, а не сам источник: при выходе из настроек
       «влево» Lampa ставит фокус в первый ряд ДО того, как рассылает
       'toggle', и этот фокус (не подъём) переписал бы источник первым
       рядом. */
    var armed = null;

    function lineOf(el) {
      var node = el;
      for (var i = 0; node && i < MAX_DEPTH; i++) {
        if (node.classList && node.classList.contains('items-line')) return node;
        node = node.parentNode;
      }
      return null;
    }

    /* a выше b: ряды главной — соседи одного контейнера прокрутки, и тот,
       что идёт в документе раньше, стоит выше. Ряды разных контейнеров
       (прежняя главная и новая) не сравниваются: у отсоединённого узла
       compareDocumentPosition отвечает как придётся. */
    function above(a, b) {
      if (!a || !b || a === b || !a.parentNode || a.parentNode !== b.parentNode) return false;
      try {
        /* 4 — DOCUMENT_POSITION_FOLLOWING: b идёт после a. */
        return !!(a.compareDocumentPosition(b) & 4);
      } catch (e) {
        return false;
      }
    }

    function onMain() {
      try {
        var act = Lampa.Activity.active();
        return !!(act && act.component === 'main');
      } catch (e) {
        return false;
      }
    }

    function tvScreen() {
      try {
        if (Lampa.Platform && typeof Lampa.Platform.screen === 'function') return Lampa.Platform.screen('tv') !== false;
      } catch (e) { }
      return true;
    }

    function onFocus(e) {
      try {
        if (!LC.focus.remote(e)) return;
        var el = e && e.target;
        if (!el || !el.classList || !el.classList.contains('card')) return;
        var line = lineOf(el);
        if (!line || !onMain()) return;
        var up = !!last && above(line, last.line);
        last = { line: line, card: el };
        if (!up) origin = last;
      } catch (err) {
        warn('homeRow: focus failed', err);
      }
    }

    function install() {
      if (bound) return;
      try {
        var body = typeof document !== 'undefined' ? document.body : null;
        if (body && LC.focus.capture(body, onFocus)) bound = body;
      } catch (e) {
        warn('homeRow: install failed', e);
      }
    }

    function uninstall() {
      if (bound) {
        try { LC.focus.release(bound, onFocus); } catch (e) { }
      }
      bound = null;
      last = null;
      origin = null;
      armed = null;
    }

    function arm() {
      armed = origin && onMain() ? origin : null;
    }

    function inDocument(node) {
      try {
        return !!(node && document.body && document.body.contains(node));
      } catch (e) {
        return false;
      }
    }

    function goBack(target) {
      try {
        if (!target || !onMain() || !tvScreen() || !inDocument(target.line)) return;
        var ctl = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        var name = ctl && ctl.name;
        if (name === 'head') Lampa.Controller.toggle('content');
        else if (name !== 'content' && name !== 'items_line') return;
        for (var i = 0; i < MAX_STEPS; i++) {
          var cur = last && last.line;
          if (!cur || !above(cur, target.line)) break;
          Lampa.Controller.move('down');
          if ((last && last.line) === cur) break;
        }
      } catch (e) {
        warn('homeRow: return failed', e);
      }
    }

    function onToggle(name) {
      if (!armed) return;
      if (name !== 'head' && name !== 'content' && name !== 'items_line') return;
      var target = armed;
      armed = null;
      setTimeout(function () { goBack(target); }, 0);
    }

    return {
      install: install,
      uninstall: uninstall,
      arm: arm,
      onToggle: onToggle
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.homeRow;

  /* -------------------------------------------------------------------- */
  /* LC.focus — подписка на фокус элемента ЛЮБЫМ способом управления.      */
  /*                                                                       */
  /* Один и тот же перевод фокуса Lampa сопровождает РАЗНЫМИ событиями:    */
  /*   - пульт и любая программная навигация: Controller.focus шлёт цели   */
  /*     'hover:focus' (vendor/lampa/app.min.js:46438);                    */
  /*   - мышь: elem.trigger_mouseenter снимает фокус со всех, ставит цели  */
  /*     класс focus и шлёт 'hover:hover', а НЕ 'hover:focus'              */
  /*     (vendor/lampa/app.min.js:46360-46364). Слушатели mouseenter/      */
  /*     mouseleave вешаются только при !Utils.isTouchDevice() &&          */
  /*     Storage.field('navigation_type') == 'mouse'                       */
  /*     (vendor/lampa/app.min.js:46374-46381) — то есть 'hover:hover'     */
  /*     приходит ровно в мышином режиме управления.                       */
  /*                                                                       */
  /* Отсюда правило: слушать надо ОБА события. Подписка только на          */
  /* 'hover:focus' мышью молчит — экран за фокусом не едет, герой главной  */
  /* остаётся от карточки, на которой стоял фокус пульта.                  */
  /*                                                                       */
  /* Задвоения не будет: одно действие пользователя даёт ровно одно из     */
  /* двух событий. trigger_mouseenter Controller.focus не зовёт            */
  /* (app.min.js:46360-46364 — там только clearAllFocus, toggleClass и     */
  /* Utils.trigger), а Controller.focus не трогает мышиные обработчики.    */
  /* Так же устроена и штатная карточка Lampa: её Card вешает на свой узел */
  /* ТРИ отдельных слушателя — 'hover:focus' (app.min.js:52323),           */
  /* 'hover:touch' (:52328) и 'hover:hover' (:52333), — и во всех трёх     */
  /* зовёт один и тот же watched() (поправка ревью волны A, М1: здесь      */
  /* стояло «два», и это было неверно).                                    */
  /*                                                                       */
  /* Третьего имени у нас сознательно нет. 'hover:touch' — это тач, а на   */
  /* тач-устройстве не проверялось ничего: и гейт раскладки, и геометрия   */
  /* героя, и все живые замеры плагина сделаны на телевизоре (пульт) и на  */
  /* стенде в мышином режиме. Подписаться на событие значило бы запустить  */
  /* наши обработчики там, где поведение никто не видел, — а цена молчания */
  /* на таче ровно та же, какой была цена молчания мышью до A1: экран за   */
  /* фокусом не едет. Снимать это ограничение — отдельной задачей, с       */
  /* живой проверкой на тач-устройстве; тогда имя добавляется в EVENTS, и  */
  /* всё остальное (on/capture/release) работает без правок.               */
  /*                                                                       */
  /* Имена событий не повторяются больше нигде в src/ — за этим следит     */
  /* тест-сторож (test/focus.test.mjs); он же пинит и само решение про     */
  /* 'hover:touch', чтобы третье имя не появилось молча.                   */
  /*                                                                       */
  /* API:                                                                  */
  /*   on(node, handler) — jQuery-подписка на САМ узел; возвращает node,   */
  /*     чтобы годиться в цепочках вида watchFocus($('<div…>'));           */
  /*   capture(el, handler) — нативный слушатель в фазе ЗАХВАТА на предке. */
  /*     Всплытия у событий Lampa нет: Utils.trigger создаёт их            */
  /*     initEvent(name, false, true), второй аргумент — bubbles           */
  /*     (app.min.js:4497-4500), поэтому делегирование по всплытию их не   */
  /*     видит, а вниз к цели событие проходит всегда;                     */
  /*   release(el, handler) — снять то, что навесил capture (та же         */
  /*     функция и та же фаза, как требует removeEventListener);           */
  /*   remote(e) — true, если событие пришло от пульта ('hover:focus').    */
  /*                                                                       */
  /* Модуль сознательно не трогает Lampa и jQuery по имени: он работает с  */
  /* тем, что ему передали, поэтому проверяется тестами без браузера.      */
  /* -------------------------------------------------------------------- */

  LC.focus = (function () {
    var EVENTS = ['hover:focus', 'hover:hover'];

    function on(node, handler) {
      if (!node || typeof node.on !== 'function') return node;
      for (var i = 0; i < EVENTS.length; i++) node.on(EVENTS[i], handler);
      return node;
    }

    function capture(el, handler) {
      if (!el || typeof el.addEventListener !== 'function') return false;
      for (var i = 0; i < EVENTS.length; i++) el.addEventListener(EVENTS[i], handler, true);
      return true;
    }

    function release(el, handler) {
      if (!el || typeof el.removeEventListener !== 'function') return false;
      for (var i = 0; i < EVENTS.length; i++) el.removeEventListener(EVENTS[i], handler, true);
      return true;
    }

    /* Волна 2 (ТВ 2026-09-24): пришло ли событие от пульта. Прокрутку за
       фокусом делает только пульт — мышь наводится на то, что уже видит, и
       ехать под курсором странице незачем (второй экран карточки,
       bindDescr в src/85_header.js). Имена событий живут только здесь,
       поэтому и признак отдаёт этот модуль. */
    function remote(e) {
      return !!(e && e.type === EVENTS[0]);
    }

    return {
      EVENTS: EVENTS,
      on: on,
      capture: capture,
      release: release,
      remote: remote
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.focus;

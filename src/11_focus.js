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
  /* два ОТДЕЛЬНЫХ слушателя, 'hover:focus' и 'hover:hover', и в обоих     */
  /* зовёт один и тот же watched() (app.min.js:52323-52337).               */
  /*                                                                       */
  /* Имена событий не повторяются больше нигде в src/ — за этим следит     */
  /* тест-сторож (test/focus.test.mjs).                                    */
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
  /*     функция и та же фаза, как требует removeEventListener).           */
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

    return {
      EVENTS: EVENTS,
      on: on,
      capture: capture,
      release: release
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.focus;

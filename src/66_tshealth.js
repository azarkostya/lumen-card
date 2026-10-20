  /* -------------------------------------------------------------------- */
  /* «Состояние TorrServer» на карточке.                                    */
  /*                                                                       */
  /* Карточка открылась (Listener 'full' complite, src/90_runtime.js) —    */
  /* не чаще раза в 60 с GET <адрес TorrServer>/echo с таймаутом 3 с.       */
  /* Адрес и авторизация — как у автоочистки (LC.tsclean.server: адрес      */
  /* Lampa или приложение TorrServe; Lampa.Reguest сам ставит Basic).       */
  /* Не ответил — тихая красная точка (#FF453A — негатив, допустим и в      */
  /* нейтральном стиле Apple TV) в углу кнопки «Смотреть» карточки; ответил */
  /* — точки нет. Главную и героя не трогает.                               */
  /*                                                                       */
  /* Переход «отвечал / неизвестно → не отвечает» и задана запасная ссылка  */
  /* (torrserver_url_two) — один Noty с подсказкой, где переключить ссылку. */
  /* Настройки Lampa модуль не меняет.                                      */
  /*                                                                       */
  /* Работает, только если задан torrserver_url и включён пункт             */
  /* lumen_ts_health (по умолчанию включён). Ни таймеров, ни опроса:        */
  /* запрос — только по открытию карточки, результат кэшируется на 60 с.   */
  /* -------------------------------------------------------------------- */

  LC.tshealth = (function () {
    var TTL = 60000;
    var TIMEOUT = 3000;
    var DOT = 'lumen-ts-dot';
    var DOT_HTML = '<i class="' + DOT + '" style="position:absolute;top:.32em;right:.32em;width:.42em;height:.42em;' +
      'border-radius:50%;background:#FF453A;pointer-events:none"></i>';

    /* '' — ещё не проверяли, 'ok', 'down'. */
    var _state = '';
    var _at = 0;
    var _pending = false;
    var _root = null;
    var _net = null;

    function now() {
      var hook = api._now;
      return typeof hook === 'function' ? hook() : Date.now();
    }

    function storageGet(key) {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
          var v = Lampa.Storage.get(key, '');
          return v === null || typeof v === 'undefined' ? '' : String(v).replace(/^\s+|\s+$/g, '');
        }
      } catch (e) { }
      return '';
    }

    function enabled() {
      try { return !!LC.pref('lumen_ts_health', true); } catch (e) { return false; }
    }

    function net() {
      if (_net) return _net;
      var make = api._net;
      if (typeof make === 'function') _net = make();
      else if (window.Lampa && typeof Lampa.Reguest === 'function') _net = new Lampa.Reguest();
      return _net;
    }

    /* Точка на кнопке «Смотреть» карточки root (jQuery): down — есть,
       иначе снята. */
    function paint(root, down) {
      try {
        if (!root || typeof root.find !== 'function') return;
        var btn = root.find('.full-start-new__buttons .button--play');
        if (!btn || !btn.length) return;
        var old = btn.find('.' + DOT);
        if (down) {
          if (old && old.length) return;
          btn.css('position', 'relative');
          btn.append(DOT_HTML);
        } else if (old && old.length) {
          old.remove();
          btn.css('position', '');
        }
      } catch (e) { }
    }

    function hint() {
      try {
        if (!storageGet('torrserver_url_two')) return;
        if (LC.tsclean && typeof LC.tsclean.appMode === 'function' && LC.tsclean.appMode()) return;
        if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
          Lampa.Noty.show(typeof LC.lang === 'function' ? LC.lang('lumen_ts_health_noty') : 'TorrServer');
        }
      } catch (e) { }
    }

    function done(ok) {
      var prev = _state;
      _pending = false;
      _state = ok ? 'ok' : 'down';
      _at = now();
      paint(_root, !ok);
      if (!ok && prev !== 'down') hint();
    }

    /* Карточка открыта: root — её корень (jQuery). */
    function check(root) {
      if (!enabled() || !storageGet('torrserver_url')) { paint(root, false); return; }
      _root = root;
      if (_pending) return;
      var t = now();
      if (_state && t - _at < TTL) { paint(root, _state === 'down'); return; }
      var url = LC.tsclean && typeof LC.tsclean.server === 'function' ? LC.tsclean.server() : '';
      var n = net();
      if (!url || !n || typeof n.silent !== 'function') return;
      _pending = true;
      _at = t;
      try {
        if (typeof n.timeout === 'function') n.timeout(TIMEOUT);
        n.silent(url + '/echo', function () { done(true); }, function () { done(false); }, false, { dataType: 'text' });
      } catch (e) {
        done(false);
      }
    }

    /* Пункт переключили: выключили — точка с открытой карточки снимается. */
    function apply() {
      if (!enabled()) paint(_root, false);
    }

    var api = {
      TTL: TTL,
      TIMEOUT: TIMEOUT,
      check: check,
      apply: apply,
      state: function () { return _state; },
      _now: null,
      _net: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.tshealth;

  /* -------------------------------------------------------------------- */
  /* 1.4: «Автовыбор TorrServer».                                          */
  /*                                                                       */
  /* У Lampa два адреса TorrServer: основной (torrserver_url) и второй      */
  /* (torrserver_url_two), а какой из них брать, решает только ручной       */
  /* выбор torrserver_use_link ('one' / 'two'): Torserver.url(), Basic-     */
  /* авторизация Reguest и поиск парсером TorrServer читают его, сами на    */
  /* недоступность не переключаются. Типичный случай: основной TorrServer  */
  /* на ПК, запасной — на самом ТВ (127.0.0.1:8090); ПК выключен — Lampa    */
  /* упирается в основной.                                                  */
  /*                                                                       */
  /* Пункт lumen_ts_auto (по умолчанию ВЫКЛЮЧЕН — меняет настройку Lampa): */
  /* GET <основной>/echo с таймаутом 2 с; ответил — 'one', иначе ответил     */
  /* второй — 'two', оба молчат — не трогаем. Пишем torrserver_use_link,    */
  /* только если значение меняется, и тогда один короткий Noty.             */
  /*                                                                       */
  /* Когда: через 4 с после включения плагина (или пункта), при открытии   */
  /* карточки ('full' complite, src/90_runtime.js) и при создании экрана   */
  /* раздач (Listener 'activity' init, component 'torrents'). Не чаще раза   */
  /* в 60 с, один проход за раз. Без обоих адресов и в режиме приложения    */
  /* TorrServe на Android (Lampa отдаёт раздачи ему, а не адресам) — ничего.*/
  /*                                                                       */
  /* Запросы — как у «Состояния TorrServer» (src/66_tshealth.js): свой       */
  /* Lampa.Reguest, silent, dataType text. Reguest сам ставит Basic только   */
  /* для адреса, выбранного сейчас (torrserver_use_link); для другого       */
  /* адреса заголовок ставим мы через params.beforeSend — тем же логином     */
  /* и паролем Lampa. Лог — только при «Показать FPS».                     */
  /* -------------------------------------------------------------------- */

  LC.tsauto = (function () {
    var TTL = 60000;
    var TIMEOUT = 2000;
    var START_DELAY = 4000;

    var _on = false;
    var _at = 0;
    var _pending = false;
    var _timer = null;
    var _net = null;
    /* Поколение прохода: выключение пункта или плагина обнуляет ответы,
       которые придут позже. */
    var _gen = 0;
    var _followed = false;

    function now() {
      var hook = api._now;
      return typeof hook === 'function' ? hook() : Date.now();
    }

    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      clearTimeout(id);
    }

    function enabled() {
      try { return !!LC.pref('lumen_ts_auto', false); } catch (e) { return false; }
    }

    function log(msg) {
      var debug = false;
      try { debug = !!LC.pref('lumen_debug_hud', false); } catch (e) { }
      if (debug) warn('tsauto: ' + msg);
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

    function appMode() {
      try { return !!(LC.tsclean && typeof LC.tsclean.appMode === 'function' && LC.tsclean.appMode()); } catch (e) { return false; }
    }

    /* Адрес как у Lampa (Utils.checkEmptyUrl): без протокола — http://. */
    function addr(key) {
      var v = storageGet(key);
      if (!v) return '';
      if (v.indexOf('http://') !== 0 && v.indexOf('https://') !== 0) v = 'http://' + v;
      return v.replace(/\/+$/, '');
    }

    function current() {
      return storageGet('torrserver_use_link') === 'two' ? 'two' : 'one';
    }

    function net() {
      if (_net) return _net;
      var make = api._net;
      if (typeof make === 'function') _net = make();
      else if (window.Lampa && typeof Lampa.Reguest === 'function') _net = new Lampa.Reguest();
      return _net;
    }

    function b64(s) {
      try { if (window.Lampa && Lampa.Base64 && typeof Lampa.Base64.encode === 'function') return Lampa.Base64.encode(s); } catch (e) { }
      try { return window.btoa(unescape(encodeURIComponent(s))); } catch (e2) { return ''; }
    }

    /* Basic-заголовок, если Lampa сама его не поставит: авторизация
       включена, а адрес не тот, что выбран сейчас (условие — как в
       beforeSend Reguest). */
    function params(url) {
      var p = { dataType: 'text', timeout: TIMEOUT };
      try {
        var S = Lampa.Storage;
        var use = typeof S.field === 'function' ? S.field('torrserver_auth') : S.get('torrserver_auth', false);
        if (!use || use === 'false') return p;
        var srv = storageGet(current() === 'two' ? 'torrserver_url_two' : 'torrserver_url');
        if (srv && url.indexOf(srv) >= 0) return p;
        var pass = typeof S.value === 'function' ? S.value('torrserver_password') : S.get('torrserver_password', '');
        var token = b64(storageGet('torrserver_login') + ':' + (pass === null || typeof pass === 'undefined' ? '' : pass));
        if (token) p.beforeSend = { name: 'Authorization', value: 'Basic ' + token };
      } catch (e) { }
      return p;
    }

    /* GET <url>/echo: ответил текстом (TorrServer — «MatriX…») — true. */
    function probe(url, cb) {
      var n = net();
      if (!n || typeof n.silent !== 'function') { cb(false); return; }
      try {
        if (typeof n.timeout === 'function') n.timeout(TIMEOUT);
        n.silent(url + '/echo', function (data) {
          /* Ответ TorrServer — версия: «MatriX.150», у старых — число. Другой
             веб-сервер на том же адресе живым не считается. */
          cb(data !== null && typeof data !== 'undefined' && /^\s*(MatriX|\d)/i.test(String(data)));
        }, function () { cb(false); }, false, params(url));
      } catch (e) {
        cb(false);
      }
    }

    function noty(key) {
      try {
        if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
          Lampa.Noty.show(typeof LC.lang === 'function' ? LC.lang(key) : 'TorrServer', { time: 3000 });
        }
      } catch (e) { }
    }

    function finish(gen, v) {
      if (gen !== _gen) return;
      _pending = false;
      if (!_on || !enabled()) return;
      if (!v) { log('both addresses silent'); return; }
      if (current() === v) return;
      try { Lampa.Storage.set('torrserver_use_link', v); } catch (e) { log('set failed'); return; }
      log('use_link -> ' + v);
      noty(v === 'two' ? 'lumen_ts_auto_two' : 'lumen_ts_auto_one');
    }

    /* Один проход: основной, при молчании — второй. */
    function check() {
      if (!_on || !enabled() || _pending || appMode()) return;
      var one = addr('torrserver_url');
      var two = addr('torrserver_url_two');
      if (!one || !two) return;
      var t = now();
      if (_at && t - _at < TTL) return;
      _at = t;
      _pending = true;
      var gen = ++_gen;
      probe(one, function (ok) {
        if (gen !== _gen) return;
        if (ok) { finish(gen, 'one'); return; }
        probe(two, function (ok2) { finish(gen, ok2 ? 'two' : ''); });
      });
    }

    function onActivity(e) {
      if (e && e.type === 'init' && e.component === 'torrents') check();
    }

    function stopTimer() {
      clearT(_timer);
      _timer = null;
    }

    function schedule() {
      if (_timer) return;
      _timer = setT(function () { _timer = null; check(); }, START_DELAY);
    }

    /* Снять начатый проход: поздние ответы игнорируются. */
    function drop() {
      _gen++;
      _pending = false;
      try { if (_net && typeof _net.clear === 'function') _net.clear(); } catch (e) { }
    }

    function install() {
      _on = true;
      if (!_followed) {
        try {
          if (window.Lampa && Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
            Lampa.Listener.follow('activity', onActivity);
            _followed = true;
          }
        } catch (e) { }
      }
      if (enabled()) schedule();
    }

    function uninstall() {
      _on = false;
      stopTimer();
      drop();
      if (_followed) {
        try { Lampa.Listener.remove('activity', onActivity); } catch (e) { }
        _followed = false;
      }
    }

    /* Пункт переключили: включили — проверка через 4 с, без оглядки на
       прошлый проход; выключили — таймер и начатый проход сняты. */
    function apply() {
      if (!_on) return;
      if (enabled()) { _at = 0; schedule(); }
      else { stopTimer(); drop(); }
    }

    var api = {
      TTL: TTL,
      TIMEOUT: TIMEOUT,
      START_DELAY: START_DELAY,
      check: check,
      install: install,
      uninstall: uninstall,
      apply: apply,
      _now: null,
      _net: null,
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.tsauto;

  /* -------------------------------------------------------------------- */
  /* 1.4: окно знакомства при ПЕРВОЙ установке плагина.                    */
  /*                                                                       */
  /* Один раз, поверх готовой главной: что умеет плагин, что удержание OK  */
  /* на постере открывает меню, где взять ключ Кинопоиска и где настройки. */
  /* Устроено как «Что нового» (src/82_whatsnew.js) и делит с ним          */
  /* выключатель (lumen_whatsnew) и правила показа: не успели показать за  */
  /* первую минуту — пропускаем насовсем. При обновлении со старой версии  */
  /* окна нет: его ждут только новые установки.                            */
  /*                                                                       */
  /* Два окна подряд не бывает: «Что нового» на первой установке не        */
  /* показывается вовсе (decide в 82_whatsnew.js), а знакомство — только   */
  /* на первой установке; вдобавок «Что нового» уступает этому окну, пока  */
  /* оно ждёт или открыто, и не открывается в сеансе, где оно уже было     */
  /* (busy/shown, tick в 82_whatsnew.js).                                  */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   decide(onboarded, seen, installed) → { show, write }                */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   detect() — в LC.init ДО LC.whatsnew.detect(): тот пишет ключ версии, */
  /*              и после него первая установка неотличима от обновления;  */
  /*   schedule(ready) — после activate(): как у «Что нового»;             */
  /*   cancel() — снять таймер и забыть ожидающее окно (deactivate);       */
  /*   open() — показать окно;                                             */
  /*   pending() / busy() / shown() — состояние для «Что нового»;          */
  /*   _timers — хук тестов (подменяемые setTimeout/clearTimeout).         */
  /*                                                                       */
  /* Сеть модуль не трогает: тексты — LC.STRINGS, ключ — в Lampa.Storage.  */
  /* -------------------------------------------------------------------- */

  LC.onboard = (function () {

    /* '1' — окно уже решено (показано, пропущено или профиль старый). */
    var KEY = 'lumen_onboarded';
    /* Ключ версии «Что нового» и признаки прежней установки — те же, что у
       него (INSTALLED_KEYS в src/82_whatsnew.js): план главной и кэш
       каталога пишутся только из activate(). */
    var SEEN_KEY = 'lumen_seen_version';
    var INSTALLED_KEYS = ['lumen_home_epoch', 'lumen_manifest'];

    var FIRST_DELAY = 4000;
    var RETRY_DELAY = 5000;
    var TRIES = 12;

    /* onboarded — значение KEY, seen — значение ключа версии «Что нового»,
       installed — есть ли признаки прежней установки. show — показывать ли
       окно, write — что записать в KEY (null — ничего). Решение пишется
       сразу, при первом же запуске: показ — один шанс, как у «Что нового»,
       а старый профиль (ключ версии или признаки установки) получает метку
       молча и окна не увидит никогда. */
    function decide(onboarded, seen, installed) {
      if (onboarded !== null && typeof onboarded !== 'undefined' && onboarded !== '') return { show: false, write: null };
      var old = installed || (seen !== null && typeof seen !== 'undefined' && seen !== '');
      return { show: !old, write: '1' };
    }

    /* ---------------------------- рантайм ---------------------------- */

    var _pending = false;
    var _open = false;
    var _shown = false;
    var _timer = null;
    var _tries = 0;
    var _ready = null;

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

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    /* Выключатель общий с «Что нового» (решение 1.4). */
    function enabled() {
      return !!LC.pref('lumen_whatsnew', true);
    }

    /* Синхронно, до LC.whatsnew.detect() и до activate(). Выключенный пункт
       тоже пишет метку — включив его позже, человек не получит знакомства
       посреди давно освоенного плагина. Своя запись — без события 'change'
       (nolisten). */
    function detect() {
      _pending = false;
      var st = storage();
      if (!st) return false;
      try {
        var installed = false;
        for (var i = 0; i < INSTALLED_KEYS.length; i++) {
          if (st.get(INSTALLED_KEYS[i], '')) installed = true;
        }
        var d = decide(st.get(KEY, ''), st.get(SEEN_KEY, ''), installed);
        if (d.write && typeof st.set === 'function') st.set(KEY, d.write, true);
        if (d.show && enabled()) _pending = true;
      } catch (e) {
        _pending = false;
        warn('onboard detect failed', e);
      }
      return _pending;
    }

    function stopTimer() {
      clearT(_timer);
      _timer = null;
    }

    /* ready() — та же проверка, что у «Что нового» (homeReady,
       src/90_runtime.js): главная на экране, ничего поверх. */
    function schedule(ready) {
      stopTimer();
      if (!_pending) return;
      _ready = typeof ready === 'function' ? ready : null;
      _tries = 0;
      _timer = setT(tick, FIRST_DELAY);
    }

    function tick() {
      _timer = null;
      if (!_pending) return;
      if (!enabled()) { _pending = false; return; }
      /* Окно «Вернуться к просмотру» (src/71_resume.js) — уступаем, как
         «Что нового», и попытку не тратим. */
      var resume = false;
      try { resume = !!(LC.resume && typeof LC.resume.busy === 'function' && LC.resume.busy()); } catch (eResume) { resume = false; }
      if (resume) { _timer = setT(tick, RETRY_DELAY); return; }
      var ok = false;
      try { ok = !!(_ready && _ready()); } catch (e) { ok = false; }
      if (ok) {
        _pending = false;
        open();
        return;
      }
      _tries++;
      if (_tries >= TRIES) { _pending = false; return; }
      _timer = setT(tick, RETRY_DELAY);
    }

    function cancel() {
      stopTimer();
      _pending = false;
    }

    function lang() {
      try { if (typeof LC.langCode === 'function') return LC.langCode(); } catch (e) { }
      return 'ru';
    }

    /* Пункты окна — из строк LC.STRINGS; путь до ключа — та же строка, что
       у пояснения «ключ не принят» в ряду отзывов (src/60_reviews.js). */
    function items() {
      return [
        LC.lang('lumen_onboard_home'),
        LC.lang('lumen_onboard_hold'),
        LC.lang('lumen_onboard_kp') + ' ' + LC.lang('lumen_card_reviews_nokey_path'),
        LC.lang('lumen_onboard_settings')
      ];
    }

    /* «Выключить это окно: …» — как у «Что нового»: выключатель общий. */
    function hintText() {
      var q = lang() === 'en' ? ['"', '"'] : ['«', '»'];
      return LC.lang('lumen_whatsnew_off') + ' → ' + [LC.lang('lumen_card_title'), LC.lang('lumen_more_name'),
        LC.lang('lumen_group_remote'), q[0] + LC.lang('lumen_whatsnew_name') + q[1]].join(' → ');
    }

    /* Окно — штатный Lampa.Modal, разметка и оформление — те же, что у
       «Что нового» (классы lumen-whatsnew, src/30_css.js): одна кнопка,
       фокус встаёт на неё сам; «Назад» и клик мимо окна — onBack. Фокус
       возвращается контроллеру, что был до окна. Заголовок идёт в шаблон
       'modal' строкой (без «<&${»), пункты — только текстом (esc). */
    function open() {
      try {
        if (!window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return false;
        var back = 'content';
        try {
          var cur = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
          if (cur && cur.name) back = cur.name;
        } catch (e) { }
        var list = items();
        var html = '<div class="lumen-whatsnew lumen-onboard"><ul class="lumen-whatsnew__list">';
        for (var i = 0; i < list.length; i++) html += '<li class="lumen-whatsnew__item">' + LC.util.esc(list[i]) + '</li>';
        html += '</ul><div class="lumen-whatsnew__hint">' + LC.util.esc(hintText()) + '</div></div>';
        var closed = false;
        var close = function () {
          if (closed) return;
          closed = true;
          _open = false;
          try { Lampa.Modal.close(); } catch (e2) { }
          try { if (Lampa.Controller && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle(back); } catch (e3) { }
        };
        _open = true;
        _shown = true;
        Lampa.Modal.open({
          title: LC.lang('lumen_onboard_title'),
          html: $(html),
          size: 'medium',
          buttons: [{ name: LC.lang('lumen_onboard_ok'), onSelect: close }],
          onBack: close
        });
        return true;
      } catch (err) {
        _open = false;
        warn('onboard open failed', err);
        return false;
      }
    }

    var api = {
      KEY: KEY,
      FIRST_DELAY: FIRST_DELAY,
      RETRY_DELAY: RETRY_DELAY,
      TRIES: TRIES,
      decide: decide,
      items: items,
      hintText: hintText,
      detect: detect,
      schedule: schedule,
      cancel: cancel,
      open: open,
      pending: function () { return _pending; },
      /* Ждёт показа или открыто — «Что нового» уступает. */
      busy: function () { return _pending || _open; },
      /* Показано в этом сеансе — «Что нового» в нём уже не открывается. */
      shown: function () { return _shown; },
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.onboard;

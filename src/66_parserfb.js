  /* -------------------------------------------------------------------- */
  /* «Запасной парсер»: основной Jackett молчит — раздачи со второго адреса. */
  /*                                                                       */
  /* У Lampa два адреса Jackett (jackett_url / jackett_url_two) и выбор     */
  /* parser_use_link: 'one', 'two' или 'both' (get$5, selectParserLinks,    */
  /* vendor/lampa/app.min.js:42588-42780). 'both' ждёт ответа обоих, а      */
  /* «сначала основной, при отказе запасной» в Lampa нет. Модуль добавляет   */
  /* именно его, оборачивая Lampa.Parser.get: экран раздач зовёт его через   */
  /* свойство объекта (Parser.get(object, oncomplite, onerror), :43604), и   */
  /* Lampa.Parser — тот же объект (:43029, :57249).                         */
  /*                                                                       */
  /* Работает, только когда: пункт lumen_parser_fallback включён (по        */
  /* умолчанию да), parser_torrent_type == 'jackett', parser_use_link ==    */
  /* 'one', jackett_url_two задан, а у Lampa есть Parser.jackett. Иначе —   */
  /* исходный вызов как есть (в том числе режимы 'two' и 'both').          */
  /*                                                                       */
  /* Порядок: исходный get; ошибка, пустой Results или 8 с без ответа →     */
  /* один запрос Parser.jackett(params, url_two, key_two, 1, ...) — та же   */
  /* функция и те же параметры, что Lampa даёт второму адресу; Storage не   */
  /* меняется. Раздачи с запасного — с уведомлением Lampa.Noty. Ответ        */
  /* основного после таймаута отбрасывается: результат у вызова ровно один. */
  /* Lampa.Parser.clear (закрыли экран раздач, :44389) поднимает поколение:  */
  /* ждущие таймеры и поздние ответы старых вызовов ничего не отдают.       */
  /*                                                                       */
  /* Отдача при неудаче запасного: основной вернул пустой список — он и     */
  /* отдаётся («ничего не найдено»); основной упал — его ошибка; таймаут —  */
  /* ошибка запасного.                                                      */
  /*                                                                       */
  /* Ставится в activate(), снимается в deactivate() (src/90_runtime.js).   */
  /* Без Lampa.Parser (старая Lampa) install ничего не делает.             */
  /* -------------------------------------------------------------------- */

  LC.parserfb = (function () {

    var TIMEOUT = 8000;
    var _orig = null;
    var _origClear = null;
    var _wrap = null;
    var _wrapClear = null;
    var _on = false;
    var _gen = 0;

    function parser() {
      return (typeof window !== 'undefined' && window.Lampa && window.Lampa.Parser) || null;
    }

    /* Настройки Lampa — через Storage.field (дефолты Lampa), ключи
       литералами (test/prefs.test.mjs, Task 60). Исключения ловит вызывающий
       (обёртка get: без настроек — исходный вызов). */
    function storage() {
      return window.Lampa.Storage;
    }

    function enabled() {
      try { return !!LC.pref('lumen_parser_fallback', true); } catch (e) { }
      return true;
    }

    /* Адрес запасного так, как Lampa собирает его сама (parserLinks,
       selectParserLinks + Utils.checkEmptyUrl); null — запасного нет. */
    function backup() {
      var S = storage();
      var url = S.field('jackett_url_two');
      if (!url || typeof url !== 'string') return null;
      url = url.replace('jacred.xyz', 'jac.red');
      try {
        var U = window.Lampa.Utils;
        if (U && typeof U.checkEmptyUrl === 'function') url = U.checkEmptyUrl(url);
      } catch (e) { }
      if (!url) return null;
      return { url: url, key: S.field('jackett_key_two') || '' };
    }

    /* Подходит ли вызов под подстраховку. */
    function active() {
      if (!enabled()) return null;
      var S = storage();
      if (S.field('parser_torrent_type') !== 'jackett') return null;
      if ((S.field('parser_use_link') || 'one') !== 'one') return null;
      var P = parser();
      if (!P || typeof P.jackett !== 'function') return null;
      return backup();
    }

    function hasResults(data) {
      return !!(data && data.Results && data.Results.length);
    }

    function setT(fn, ms) {
      if (api._timers) return api._timers.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      if (api._timers) return api._timers.clear(id);
      clearTimeout(id);
    }

    function noty() {
      try {
        var L = window.Lampa;
        if (L.Noty && typeof L.Noty.show === 'function') L.Noty.show('' + LC.lang('lumen_parser_fallback_noty'));
      } catch (e) { }
    }

    /* Один вызов Parser.get с подстраховкой. */
    function guarded(self, args, link) {
      var params = args[0];
      var oncomplite = args[1];
      var onerror = args[2];
      var gen = _gen;
      /* Стадии: 0 — ждём основной, 1 — ждём запасной, 2 — результат отдан. */
      var stage = 0;
      var timer = null;
      var primaryData = null;
      var primaryErr = null;

      function live() {
        return gen === _gen && stage !== 2;
      }

      function finish(ok, value) {
        stage = 2;
        if (timer !== null) { clearT(timer); timer = null; }
        if (ok) { if (typeof oncomplite === 'function') oncomplite(value); }
        else if (typeof onerror === 'function') onerror(value);
      }

      function fallback() {
        if (!live() || stage !== 0) return;
        stage = 1;
        if (timer !== null) { clearT(timer); timer = null; }
        var P = parser();
        try {
          P.jackett(params, link.url, link.key, 1, function (json) {
            if (!live()) return;
            if (hasResults(json)) { noty(); finish(true, json); }
            else if (primaryData) finish(true, primaryData);
            else finish(true, json && json.Results ? json : { Results: [] });
          }, function (e) {
            if (!live()) return;
            if (primaryData) finish(true, primaryData);
            else finish(false, primaryErr !== null ? primaryErr : e);
          });
        } catch (err) {
          if (!live()) return;
          if (primaryData) finish(true, primaryData);
          else finish(false, primaryErr !== null ? primaryErr : '');
        }
      }

      timer = setT(function () {
        timer = null;
        fallback();
      }, TIMEOUT);

      try {
        return _orig.call(self, params, function (data) {
          /* Основной ответил раздачами уже после нашего таймаута (Lampa ждёт
             его parse_timeout, по умолчанию 15 с), а запасной ещё в пути —
             берём основной: побеждает первый непустой ответ. */
          if (!live() || stage === 2) return;
          if (hasResults(data)) { finish(true, data); return; }
          if (stage !== 0) return;
          if (hasResults(data)) finish(true, data);
          else { primaryData = data && data.Results ? data : { Results: [] }; fallback(); }
        }, function (e) {
          if (!live() || stage !== 0) return;
          primaryErr = e === undefined ? '' : e;
          fallback();
        });
      } catch (err) {
        /* Синхронное исключение исходного get — как без модуля: наружу,
           таймер снят, запасной не зовётся. */
        stage = 2;
        if (timer !== null) { clearT(timer); timer = null; }
        throw err;
      }
    }

    function install() {
      var P = parser();
      if (!P || typeof P.get !== 'function') return false;
      _on = true;
      /* Обёртка уже стоит (или осталась под чужой после uninstall) —
         достаточно снова включить её. */
      if (_wrap) return true;
      _orig = P.get;
      _wrap = function () {
        var args = Array.prototype.slice.call(arguments);
        var link = null;
        if (_on) {
          try { link = active(); } catch (e) { link = null; }
        }
        if (!link) return _orig.apply(this, args);
        return guarded(this, args, link);
      };
      P.get = _wrap;
      if (!_wrapClear && typeof P.clear === 'function') {
        _origClear = P.clear;
        _wrapClear = function () {
          _gen++;
          return _origClear.apply(this, arguments);
        };
        P.clear = _wrapClear;
      }
      return true;
    }

    /* Снять обёртки. Если поверх нас кто-то обернул Parser.get ещё раз,
       свою не трогаем — она просто становится сквозной (_on = false). */
    function uninstall() {
      _on = false;
      _gen++;
      var P = parser();
      if (!P) return;
      if (_wrap && P.get === _wrap) { P.get = _orig; _wrap = null; _orig = null; }
      if (_wrapClear && P.clear === _wrapClear) { P.clear = _origClear; _wrapClear = null; _origClear = null; }
    }

    var api = {
      TIMEOUT: TIMEOUT,
      install: install,
      uninstall: uninstall,
      active: active,
      installed: function () { return !!_wrap && _on; },
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.parserfb;

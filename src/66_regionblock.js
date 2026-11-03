  /* -------------------------------------------------------------------- */
  /* «Без региональной блокировки»: карточка не закрывается экраном         */
  /* «Контент ограничен».                                                   */
  /*                                                                       */
  /* Lampa в регионе ru/by (vpn.is, ответ geo.<cub_domain> при запуске)     */
  /* принудительно включает lgbt_content_block и прячет его тумблер         */
  /* (vendor/lampa/app.min.js:55466). Проверок три, и каждая требует        */
  /* window.lampa_settings.lgbt (карта «id_тип» от CUB, ServiceLGBT, :55440):*/
  /* ключевые слова TMDB (:38802), список CUB (:38811) и узор на постере    */
  /* (Lgbt.onVisible, :22201). Модуль подменяет это свойство геттером:      */
  /* пункт включён — undefined, и все три ветки пропускаются; выключен —     */
  /* то, что Lampa записала. Запись Lampa (кэш или сеть, позже нашей        */
  /* установки) попадает в _store, поэтому выключение действует сразу.      */
  /* Регион не подменяется: от него зависит автоустановка TMDB Proxy.       */
  /*                                                                       */
  /* Ставится в activate(), снимается в deactivate() (src/90_runtime.js).   */
  /* -------------------------------------------------------------------- */

  LC.regionblock = (function () {

    var _host = null;
    var _store;
    var _on = false;

    function settings() {
      return (typeof window !== 'undefined' && window.lampa_settings) || null;
    }

    function enabled() {
      try { return LC.pref('lumen_region_unblock', false) === true; } catch (e) { }
      return false;
    }

    function install() {
      var S = settings();
      if (!S || _on) return _on;
      var d = Object.getOwnPropertyDescriptor(S, 'lgbt');
      if (d && !d.configurable) return false;
      _store = S.lgbt;
      Object.defineProperty(S, 'lgbt', {
        configurable: true,
        enumerable: true,
        get: function () { return enabled() ? undefined : _store; },
        set: function (v) { _store = v; }
      });
      _host = S;
      _on = true;
      return true;
    }

    /* Вернуть обычное свойство с последним значением Lampa. */
    function uninstall() {
      if (!_on || !_host) return;
      Object.defineProperty(_host, 'lgbt', { value: _store, writable: true, configurable: true, enumerable: true });
      _host = null;
      _store = undefined;
      _on = false;
    }

    return {
      install: install,
      uninstall: uninstall,
      enabled: enabled,
      installed: function () { return _on; }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.regionblock;

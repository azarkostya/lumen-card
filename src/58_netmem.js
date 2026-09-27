  /* -------------------------------------------------------------------- */
  /* Полоса «память за долгий сеанс» (2026-09-27): LC.netmem — колбэки     */
  /* запросов Lampa не держат экраны после ответа.                         */
  /*                                                                       */
  /* Утечка Lampa: Request.silent кладёт каждый запрос {url, complite,     */
  /* error} в свой список _calls и НЕ вынимает его после ответа            */
  /* (vendor/lampa/app.min.js:33296-33318); список чистит только clear()    */
  /* — отмена поиска и выбор профиля (:20283, :23277). Источник TMDB        */
  /* (network$7, :19452) — один на сеанс, и его _calls держат всё, что      */
  /* держат колбэки: get$c (:19693) замыкает oncomplite/onerror и params     */
  /* вызывающего, Api.full (:34623 → full$3 :20060) — объект активности    */
  /* карточки (params.activity → ActivitySlide → Full со всей разметкой)   */
  /* и колбэк Full, который держит сам компонент. Стенд (чистый CDP, после  */
  /* GC, сборка 17e5a3d): каждый вход в карточку и выход +560 узлов,        */
  /* +170 JS-слушателей, +3.9 тыс. объектов кучи Blink (Lampa без плагина — */
  /* +307/+31/+1.9 тыс.: карточка плагина больше); вход в хаб → сетка →     */
  /* назад +600 узлов; «Что посмотреть» +100 узлов, +95 слушателей.         */
  /*                                                                       */
  /* Что делаем: оборачиваем Lampa.Api.full и Lampa.Api.sources.tmdb.get   */
  /* (свойства объектов — внутренние вызовы Lampa идут через них же:        */
  /* Full зовёт Api.full, :38791). Колбэки уходят в Lampa «трамплинами»:     */
  /* первый вызов любого из двух отдаёт управление настоящему и обнуляет   */
  /* обе ссылки — в _calls остаётся пустая коробка. У Api.full ещё и params */
  /* — копия без поля activity (источники берут из params только method,   */
  /* id, url, source; activity им не нужна). Поведение то же: Lampa зовёт  */
  /* ровно один из двух колбэков ровно один раз (Status.onComplite /        */
  /* onerror; сезонная поправка get$c пробрасывает те же функции дальше и  */
  /* зовёт одну из них позже — трамплин ещё полон). Замер со стенда: хаб и */
  /* «Что посмотреть» — 0 узлов прироста за вход (было +600 и +100),       */
  /* повторный вход в ту же карточку — 0 (было +560).                       */
  /*                                                                       */
  /* Чего модуль НЕ лечит (остаётся Lampa): кнопка «Shots» в карточке       */
  /* (запрос через Lampa.Network, его complite держит кнопку и через неё   */
  /* всю разметку карточки), подписка shots_status в Lampa.Listener,        */
  /* запросы CUB (network$4) и поиска — +450…700 узлов за вход в НОВУЮ      */
  /* карточку и +800…1000 за поиск.                                          */
  /*                                                                       */
  /* Чужая обёртка поверх нашей — не снимаем её при выключении (как        */
  /* LC.rows с Api.main): восстанавливаем, только если свойство — наше.     */
  /* -------------------------------------------------------------------- */

  LC.netmem = (function () {

    var state = null;

    /* Трамплин: зовёт box[key] один раз, после первого вызова любого из
       пары коробка пуста. */
    function tramp(box, key) {
      return function () {
        var fn = box[key];
        box.ok = null;
        box.err = null;
        if (typeof fn === 'function') return fn.apply(this, arguments);
      };
    }

    /* Копия params без activity (ссылки на экран); другие поля — те же. */
    function slim(params) {
      if (!params || typeof params !== 'object' || !Object.prototype.hasOwnProperty.call(params, 'activity')) return params;
      var out = {};
      for (var k in params) {
        if (k !== 'activity' && Object.prototype.hasOwnProperty.call(params, k)) out[k] = params[k];
      }
      return out;
    }

    function wrapFull(orig) {
      var fn = function (params, oncomplite, onerror) {
        var box = { ok: oncomplite, err: onerror };
        if (state) state.stats.full++;
        return orig.call(this, slim(params), tramp(box, 'ok'), tramp(box, 'err'));
      };
      fn.lumen_netmem = true;
      return fn;
    }

    function wrapGet(orig) {
      var fn = function (method, params, oncomplite, onerror) {
        var box = { ok: oncomplite, err: onerror };
        var args = Array.prototype.slice.call(arguments);
        args[2] = tramp(box, 'ok');
        args[3] = tramp(box, 'err');
        if (state) state.stats.get++;
        return orig.apply(this, args);
      };
      fn.lumen_netmem = true;
      return fn;
    }

    function on() {
      try {
        return LC.pref ? LC.pref('lumen_netmem', true) !== false : true;
      } catch (e) {
        return true;
      }
    }

    function install() {
      if (state || !on()) return false;
      try {
        if (!window.Lampa || !Lampa.Api) return false;
        var api = Lampa.Api;
        var src = api.sources && api.sources.tmdb;
        var s = { api: api, src: src, full: null, get: null, stats: { full: 0, get: 0 } };
        if (typeof api.full === 'function' && !api.full.lumen_netmem) {
          s.full = api.full;
          api.full = wrapFull(s.full);
        }
        if (src && typeof src.get === 'function' && !src.get.lumen_netmem) {
          s.get = src.get;
          src.get = wrapGet(s.get);
        }
        state = s;
        return !!(s.full || s.get);
      } catch (e) {
        warn('netmem: install failed', e);
        return false;
      }
    }

    function uninstall() {
      if (!state) return;
      var s = state;
      state = null;
      try {
        if (s.full && s.api.full && s.api.full.lumen_netmem) s.api.full = s.full;
        if (s.get && s.src && s.src.get && s.src.get.lumen_netmem) s.src.get = s.get;
      } catch (e) {
        warn('netmem: uninstall failed', e);
      }
    }

    return {
      install: install,
      uninstall: uninstall,
      slim: slim,
      tramp: tramp,
      active: function () { return !!state; },
      stats: function () { return state ? { full: state.stats.full, get: state.stats.get } : null; }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.netmem;

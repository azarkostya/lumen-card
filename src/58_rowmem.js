  /* -------------------------------------------------------------------- */
  /* Полоса «память за долгий сеанс» (2026-09-27): LC.rowmem — ряды        */
  /* главной далеко от фокуса «спят».                                       */
  /*                                                                       */
  /* Lampa не освобождает ничего из построенного на главной: каждый ряд,   */
  /* до которого дошли, остаётся в DOM со всеми карточками (Items$1,        */
  /* vendor/lampa/app.min.js:35145-35215), и главная живёт весь сеанс под   */
  /* карточками и хабом (Activity хранит её в истории). Стенд (ТВ-профиль   */
  /* 960x540@2, CPU x10, сценарий «долгий сеанс», чистый CDP без агента     */
  /* сети DevTools): за 11 минут 42 ряда и 434-462 карточки, 5.3-5.6 тыс.   */
  /* элементов, 12.8-13.2 тыс. JS-слушателей, куча Blink 21 МБ / 280 тыс.   */
  /* объектов и 33-35 МБ сжатых байтов картинок в памяти рендерера —        */
  /* одинаково в 098a4b0 и 17e5a3d: растёт сама Lampa. На карточку ~330      */
  /* объектов кучи Blink (28 КБ): половина — раскладка, стиль и отрисовка   */
  /* (фрагменты, LayoutObject, ComputedStyle, узлы свойств отрисовки), они  */
  /* живут, пока ряд в раскладке, даже если Lampa скрыла карточки           */
  /* visibility:hidden (Layer, :31719-31766). Каждую из них обходит пауза   */
  /* сборки мусора (финализация маркировки, сжатие кучи Blink в покое — на  */
  /* ТВ 450 мс «other» в самотесте) и каждый конец вертикальной прокрутки:  */
  /* Layer.visible(лента главной) читает getBoundingClientRect у ВСЕХ       */
  /* .layer--visible главной (combineElements, :31785-31805).              */
  /*                                                                       */
  /* Что делает модуль (ничего не удаляя из данных Lampa — items, active,  */
  /* last, results рядов остаются как были):                                */
  /*   - ряд дальше FAR рядов от ряда под фокусом «засыпает» в простое:    */
  /*     его .items-line__body получает свою текущую высоту (лента главной */
  /*     не сдвигается), а лента ряда (.scroll) — display:none: раскладка, */
  /*     стиль и слои его карточек уходят; с карточек снимается класс      */
  /*     layer--visible (Layer.visible их больше не обходит), вместо него —  */
  /*     метка MARK;                                                        */
  /*   - дальше BYTES_FAR рядов спящий ряд ещё и отпускает сжатые байты    */
  /*     загруженных постеров: src снимается (removeAttribute — без         */
  /*     load/error, обработчики карточки Lampa не зовутся), адрес — в поле */
  /*     узла. ТОЛЬКО при lumen_rowmem_bytes = 'true': по умолчанию         */
  /*     выключено до проверки на ТВ (см. bytesOn);                         */
  /*   - на переводе фокуса, СИНХРОННО: ряды в пределах BYTES_NEAR получают */
  /*     src обратно (сеть — за несколько шагов до показа), в пределах NEAR */
  /*     просыпаются (класс и лента на место). Между NEAR и FAR — ничего:   */
  /*     гистерезис, ряд на границе не мигает туда-сюда. Мышь: активный ряд */
  /*     Lampa обновляет после захвата события — вторая проверка таймером 0.*/
  /* Спящий ряд никогда не бывает рядом с фокусом: переход вверх-вниз идёт  */
  /* на соседний ряд (Items$1.onDown/onUp, :35152-35166), а соседи в        */
  /* пределах NEAR разбужены на прошлом шаге. Это верно для пульта и мыши   */
  /* (колесо тоже переводит фокус: Items$1 scroll.onWheel → down/up), но не */
  /* для тача: на ТВ-экране с сенсором (планшет 1280x800 для Lampa — «tv»)  */
  /* лента главной едет пальцем без смены фокуса (Scroll, :31929-31935), и  */
  /* спящий ряд въехал бы пустой полосой. Поэтому первое касание будит все  */
  /* ряды и выключает сон до конца сеанса (touched). На экране не-ТВ        */
  /* (Platform.screen — телефон, планшет портретом: нативная прокрутка      */
  /* ленты) модуль не работает вовсе.                                       */
  /*                                                                       */
  /* Переходы лент Lampa модуль не трогает (урок B1). Незнакомая форма      */
  /* компонента или ряда — тихий отказ.                                     */
  /*                                                                       */
  /* v1.4 «Слабый ТВ» (только на слабой приставке, LC.perf.weakInfo):      */
  /*   - ряды засыпают раньше: FAR_WEAK = 4 вместо FAR;                     */
  /*   - «сон» карточек АКТИВНОГО ряда: дальше CARD_FAR экранов от фокуса   */
  /*     ряда у карточки .card__view получает display:none (в простое).    */
  /*     Сама .card (она и есть .selector Lampa) остаётся в раскладке со    */
  /*     своей шириной: offsetParent не null (collectionSet с visible_only, */
  /*     app.min.js:48238), offsetLeft соседей и прокрутка ряда те же;      */
  /*     меняется только высота спящей карточки, а высоту ряда держат       */
  /*     живые карточки у фокуса. На переводе фокуса, СИНХРОННО и до         */
  /*     обработчиков Lampa (фаза захвата; класс focus Lampa ставит уже     */
  /*     после 'hover:focus', app.min.js:48221-48229), карточки в пределах   */
  /*     CARD_NEAR экранов от цели просыпаются. Риск — геометрия            */
  /*     Navigator: соседи цели всегда живые (окно ±CARD_NEAR), поэтому     */
  /*     шаг влево/вправо и прыжок CH± на десять карточек до спящей не       */
  /*     достают. Окно — по экранам (ширина окна / ширина карточки), а не   */
  /*     по числу карточек.                                                 */
  /*                                                                       */
  /* Ушли с главной вглубь (detach) — её ряды спят дальше, а компонент      */
  /* остаётся в списке «припаркованных»: выключение плагина не с главной    */
  /* (uninstall) будит и их, иначе при «Назад» пустые полосы до перезапуска */
  /* Lampa (выключенный плагин главную не пересобирает). Список чистится,   */
  /* когда главная снова смонтирована (mount того же корня) или уничтожена  */
  /* (forget на 'destroy' её активности).                                   */
  /*                                                                       */
  /* API: mount(root) / mountCurrent() / detach(render) / owns(render) /    */
  /*   forget(render) / unmount() / uninstall() / wakeAll() / active() /    */
  /*   parked() / stats();                                                  */
  /*   plan(at, n, flags) — чистая функция решений (для тестов);            */
  /*   tick() — одна единица работы простоя (для тестов).                   */
  /* -------------------------------------------------------------------- */

  LC.rowmem = (function () {

    /* Рядов от фокуса, которые всегда целиком живые (будятся на переводе
       фокуса). Три ряда — больше экрана ниже героя на ТВ 960x540. */
    var NEAR = 3;
    /* С какого расстояния ряд засыпает (в простое). Между NEAR и FAR —
       гистерезис: ряд остаётся, каким был. */
    var FAR = 5;
    /* С какого расстояния спящий ряд отпускает байты постеров и с какого
       получает их обратно (раньше, чем проснётся, — сеть успевает). */
    var BYTES_FAR = 9;
    var BYTES_NEAR = 7;
    /* Покой фокуса перед усыплением: серия нажатий работу не заводит. */
    var QUIET_MS = 1500;
    /* Потолок ожидания простоя браузера. */
    var IDLE_WAIT_MS = 1000;
    /* Пауза, когда делать нечего или экран не тот. */
    var REST_MS = 3000;
    var MARK = 'lumen-rowmem-lv';
    /* v1.4 «Слабый ТВ» (см. шапку): ряды — раньше, карточки активного ряда
       — по экранам от фокуса ряда. */
    var FAR_WEAK = 4;
    var CARD_NEAR = 2;
    var CARD_FAR = 3;

    var state = null;
    /* Главные, от которых ушли вглубь: [{root, comp}] (см. шапку). В истории
       Lampa их может быть больше одной — «Главная» из меню делает push. */
    var parked = [];
    /* Было касание экрана — сон выключен до конца сеанса (см. шапку). Флаг
       модуля, а не state: новая главная того же сеанса его помнит. */
    var touched = false;

    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      clearTimeout(id);
    }

    function idleReq(fn) {
      var hook = api._idle;
      if (hook && typeof hook.request === 'function') return { id: hook.request(fn), idle: true };
      try {
        if (typeof window.requestIdleCallback === 'function') {
          return { id: window.requestIdleCallback(fn, { timeout: IDLE_WAIT_MS }), idle: true };
        }
      } catch (e) { }
      return { id: setT(fn, 0), idle: false };
    }

    function idleCancel(h) {
      if (!h) return;
      if (!h.idle) { clearT(h.id); return; }
      var hook = api._idle;
      if (hook && typeof hook.cancel === 'function') { hook.cancel(h.id); return; }
      try { window.cancelIdleCallback(h.id); } catch (e) { }
    }

    function on() {
      try {
        if (touched) return false;
        if (typeof LC.enabled === 'function' && !LC.enabled()) return false;
        /* Только ТВ-экран Lampa (Platform.screen, app.min.js:32740-32763). ПК
           с мышью — тоже «tv»: не tv()/desktop(), но и не тач, is_tv остаётся
           true. Без Platform (тесты, старые сборки) — ТВ. */
        if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function' && Lampa.Platform.screen('tv') === false) return false;
        return LC.pref ? LC.pref('lumen_rowmem', true) !== false : true;
      } catch (e) {
        return false;
      }
    }

    /* Отпускание байтов постеров — по умолчанию ВЫКЛЮЧЕНО, до проверки на
       ТВ. Вернувшийся src при сетевом сбое чинит только Card.onerror Lampa
       (vendor/lampa/app.min.js:20890-20915): после 4 ошибок — img_broken.svg
       навсегда, а каждая ошибка идёт в TMDB.broken → ImageMirror.broken
       (:19273-19291): 20 ошибок за 10 с — зеркало картинок забанено, выбор
       другого сохраняется в Storage (tmdb_img_mirror). Включить:
       Lampa.Storage.set('lumen_rowmem_bytes', 'true') или пункт «Отпускать
       постеры дальних рядов». Ревью 1.4: выключено на всех ТВ, в том числе
       на слабых, — смена зеркала картинок это поведение Lampa. */
    function bytesOn() {
      try {
        return LC.pref ? LC.pref('lumen_rowmem_bytes', false) === true : false;
      } catch (e) {
        return false;
      }
    }

    function weakTv() {
      try {
        return !!(LC.perf && typeof LC.perf.weakInfo === 'function' && LC.perf.weakInfo());
      } catch (e) {
        return false;
      }
    }

    function farRows() {
      return weakTv() ? FAR_WEAK : FAR;
    }

    /* Компонент главной (Main/Items$1): items — построенные ряды, active —
       ряд под фокусом. Только знакомая форма и только наш корень. */
    function component() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main' || !act.activity) return null;
        var c = act.activity.component;
        if (!c || !Array.isArray(c.items) || typeof c.active !== 'number') return null;
        if (state && state.root && typeof act.activity.render === 'function') {
          var r = act.activity.render();
          if (r && r[0] && state.root[0] && r[0] !== state.root[0]) return null;
        }
        /* Компонент своей главной — на случай ухода с неё (detach). */
        if (state) state.comp = c;
        return c;
      } catch (e) {
        return null;
      }
    }

    /* Лента ряда Lampa: Line.scroll.render(true) — .scroll, его родитель —
       .items-line__body. */
    function tape(line) {
      try {
        if (!line || !line.scroll || typeof line.scroll.render !== 'function') return null;
        var sc = line.scroll.render(true);
        return sc && sc.style && sc.parentNode && sc.parentNode.style ? sc : null;
      } catch (e) {
        return null;
      }
    }

    /* Чистая: что делать с рядом на расстоянии d от фокуса при его флагах
       {sleep, bytes}. Ответ: {wake, sleep, back, drop} — булевы. */
    function decide(d, sleep, bytes, withBytes, far) {
      var out = { wake: false, sleep: false, back: false, drop: false };
      if (!(far > NEAR)) far = FAR;
      if (d <= NEAR && sleep) out.wake = true;
      if (d <= BYTES_NEAR && bytes) out.back = true;
      if (d >= far && !sleep) out.sleep = true;
      if (withBytes && d >= BYTES_FAR && !bytes && (sleep || out.sleep)) out.drop = true;
      return out;
    }

    /* Чистая: план по всем рядам — для тестов и stats. flags[i] =
       {sleep, bytes}. */
    function plan(at, n, flags, withBytes) {
      var out = [];
      for (var i = 0; i < n; i++) {
        var f = flags && flags[i] ? flags[i] : {};
        out.push(decide(Math.abs(i - at), !!f.sleep, !!f.bytes, withBytes !== false));
      }
      return out;
    }

    function swapClass(list, from, to) {
      for (var i = 0; i < list.length; i++) {
        list[i].classList.remove(from);
        list[i].classList.add(to);
      }
      return list.length;
    }

    function sleepLine(line) {
      var sc = tape(line);
      if (!sc || line.lumen_rowmem_sleep) return false;
      var body = sc.parentNode;
      /* Дробная высота, не offsetHeight: тот округляет до целого, и каждый
         спящий ряд выше фокуса сдвигал бы ленту главной на долю пикселя
         (стенд 960x540@2: 183.6875 → 184, 10 рядов — 3 px). */
      var h = body.getBoundingClientRect().height;
      /* Ряд не в раскладке (главная скрыта) — высоту не узнать: не трогаем. */
      if (!h) return false;
      body.style.height = h + 'px';
      sc.style.display = 'none';
      state.stats.cards += swapClass(sc.querySelectorAll('.layer--visible'), 'layer--visible', MARK);
      line.lumen_rowmem_sleep = true;
      state.stats.slept++;
      return true;
    }

    function wakeLine(line) {
      var sc = tape(line);
      if (!sc || !line.lumen_rowmem_sleep) return false;
      swapClass(sc.querySelectorAll('.' + MARK), MARK, 'layer--visible');
      sc.style.display = '';
      sc.parentNode.style.height = '';
      line.lumen_rowmem_sleep = false;
      if (state) state.stats.woke++;
      return true;
    }

    /* Байты: только загруженные постеры (complete и naturalWidth) —
       у недоехавшего жив таймер Lampa (Card.onVisible ставит onerror через
       15 с), и снятый src он бы вернул сам. */
    function dropBytes(line) {
      var sc = tape(line);
      if (!sc || line.lumen_rowmem_bytes) return false;
      var imgs = sc.querySelectorAll('img.card__img');
      var n = 0;
      for (var i = 0; i < imgs.length; i++) {
        var img = imgs[i];
        if (img.lumen_rowmem_src) continue;
        var src = img.getAttribute('src');
        if (!src || src.indexOf('img_load') !== -1 || src.indexOf('img_broken') !== -1) continue;
        if (!img.complete || !img.naturalWidth) continue;
        img.lumen_rowmem_src = src;
        img.removeAttribute('src');
        n++;
      }
      line.lumen_rowmem_bytes = true;
      state.stats.dropped += n;
      return true;
    }

    function backBytes(line) {
      var sc = tape(line);
      if (!sc || !line.lumen_rowmem_bytes) return false;
      var imgs = sc.querySelectorAll('img.card__img');
      for (var i = 0; i < imgs.length; i++) {
        var src = imgs[i].lumen_rowmem_src;
        if (!src) continue;
        imgs[i].lumen_rowmem_src = null;
        if (!imgs[i].getAttribute('src')) imgs[i].setAttribute('src', src);
      }
      line.lumen_rowmem_bytes = false;
      if (state) state.stats.back++;
      return true;
    }

    /* ---- v1.4: сон карточек активного ряда (см. шапку) ---- */

    function viewOf(card) {
      try {
        return typeof card.querySelector === 'function' ? card.querySelector('.card__view') : null;
      } catch (e) {
        return null;
      }
    }

    function showCard(card) {
      if (!card || !card.lumen_rowmem_view) return false;
      var view = viewOf(card);
      if (view && view.style) view.style.display = '';
      card.lumen_rowmem_view = false;
      return true;
    }

    function hideCard(card) {
      if (!card || card.lumen_rowmem_view) return false;
      var view = viewOf(card);
      if (!view || !view.style) return false;
      view.style.display = 'none';
      card.lumen_rowmem_view = true;
      return true;
    }

    function indexIn(list, node) {
      for (var i = 0; i < list.length; i++) if (list[i] === node) return i;
      return -1;
    }

    /* Карточек на экран: ширина окна / ширина карточки (в простое, где
       чтение раскладки ничего не стоит). Запоминается на ленте ряда — на
       переводе фокуса раскладку не читаем. 0 — не узнать. */
    function perScreen(sc, card) {
      if (sc.lumen_rowmem_per > 0) return sc.lumen_rowmem_per;
      var w = 0;
      var sw = 0;
      try { w = card.offsetWidth || 0; } catch (e) { w = 0; }
      try { sw = window.innerWidth || 0; } catch (e2) { sw = 0; }
      if (!(w > 0) || !(sw > 0)) return 0;
      sc.lumen_rowmem_per = Math.max(1, Math.ceil(sw / w));
      return sc.lumen_rowmem_per;
    }

    /* Простой: у активного ряда усыпить карточки дальше CARD_FAR экранов
       от карточки под фокусом. true — кто-то уснул. */
    function sleepCards(c) {
      var line = c.items[c.active];
      var sc = tape(line);
      if (!sc || typeof sc.querySelector !== 'function') return false;
      var focused = sc.querySelector('.card.focus');
      if (!focused) return false;
      var list = sc.querySelectorAll('.card');
      var at = indexIn(list, focused);
      if (at < 0) return false;
      var per = perScreen(sc, focused);
      if (!per) return false;
      var far = CARD_FAR * per;
      var n = 0;
      for (var i = 0; i < list.length; i++) {
        if (Math.abs(i - at) >= far && hideCard(list[i])) n++;
      }
      if (n) {
        sc.lumen_rowmem_cards = true;
        state.stats.cardViews += n;
      }
      return n > 0;
    }

    /* Перевод фокуса на карточку: соседи в пределах CARD_NEAR экранов —
       живые. Без запомненной ширины — будим весь ряд (безопасно). */
    function wakeCardsAround(card) {
      if (!card || typeof card.closest !== 'function') return;
      var sc = card.closest('.scroll');
      if (!sc || !sc.lumen_rowmem_cards || typeof sc.querySelectorAll !== 'function') return;
      var list = sc.querySelectorAll('.card');
      var at = indexIn(list, card);
      var per = sc.lumen_rowmem_per;
      if (at < 0 || !(per > 0)) { wakeCards(sc); return; }
      var reach = CARD_NEAR * per;
      var from = Math.max(0, at - reach);
      var to = Math.min(list.length - 1, at + reach);
      for (var i = from; i <= to; i++) showCard(list[i]);
    }

    function wakeCards(sc) {
      if (!sc || !sc.lumen_rowmem_cards || typeof sc.querySelectorAll !== 'function') return;
      var list = sc.querySelectorAll('.card');
      for (var i = 0; i < list.length; i++) showCard(list[i]);
      sc.lumen_rowmem_cards = false;
    }

    function targetCard(e) {
      try {
        var t = e && e.target;
        if (!t || typeof t.closest !== 'function') return null;
        return t.closest('.card');
      } catch (err) {
        return null;
      }
    }

    /* Синхронная часть перевода фокуса: будит ближние, возвращает байты.
       Обходит только окно ±BYTES_NEAR — O(1) на нажатие. */
    function near(c) {
      var at = c.active;
      var from = Math.max(0, at - BYTES_NEAR);
      var to = Math.min(c.items.length - 1, at + BYTES_NEAR);
      for (var i = from; i <= to; i++) {
        var line = c.items[i];
        if (!line) continue;
        var d = Math.abs(i - at);
        if (line.lumen_rowmem_bytes && d <= BYTES_NEAR) backBytes(line);
        if (line.lumen_rowmem_sleep && d <= NEAR) wakeLine(line);
      }
    }

    /* Одна единица работы простоя: самый дальний ряд, который пора усыпить
       (или отпустить его байты). true — что-то сделано. */
    function work(c) {
      var at = c.active;
      var withBytes = bytesOn();
      var far = farRows();
      var best = -1;
      var bestD = -1;
      var what = null;
      for (var i = 0; i < c.items.length; i++) {
        var line = c.items[i];
        if (!line || line.lumen_rowmem_skip) continue;
        var d = Math.abs(i - at);
        if (d < far) continue;
        var dec = decide(d, !!line.lumen_rowmem_sleep, !!line.lumen_rowmem_bytes, withBytes, far);
        if ((dec.sleep || dec.drop) && d > bestD) {
          best = i;
          bestD = d;
          what = dec;
        }
      }
      if (best === -1) return weakTv() ? sleepCards(c) : false;
      var target = c.items[best];
      if (what.sleep && !sleepLine(target)) {
        /* Ряд не той формы или не в раскладке — больше не пробуем. */
        target.lumen_rowmem_skip = true;
        return true;
      }
      if (what.drop) dropBytes(target);
      return true;
    }

    function stopWork() {
      if (!state) return;
      if (state.timer) { clearT(state.timer); state.timer = null; }
      if (state.idle) { idleCancel(state.idle); state.idle = null; }
    }

    /* Колбэки таймеров и простоя — именованные, как во всех модулях
       (69_bench): на ТВ LoAF подписывает длинный кадр только именем функции. */
    function arm(ms) {
      if (!state) return;
      stopWork();
      state.timer = setT(function onRowmemQuiet() {
        if (!state) return;
        state.timer = null;
        state.idle = idleReq(function onRowmemIdle() {
          if (!state) return;
          state.idle = null;
          tick();
        });
      }, ms);
    }

    function onRows() {
      try {
        var en = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        var name = en && en.name;
        return name === 'items_line' || name === 'content';
      } catch (e) {
        return false;
      }
    }

    function tick() {
      if (!state) return false;
      /* Выключили посреди сеанса (lumen_rowmem из консоли) — спящих рядов
         не оставляем: без модуля их больше никто не разбудит. */
      if (!on()) { wakeAll(); if (!touched) arm(REST_MS); return false; }
      if ((typeof document !== 'undefined' && document.hidden) || !onRows()) { arm(REST_MS); return false; }
      var c = component();
      if (!c) { arm(REST_MS); return false; }
      var did = false;
      try {
        near(c);
        did = work(c);
        state.failed = 0;
      } catch (e) {
        warn('rowmem: work failed', e);
        state.failed++;
        if (state.failed >= 2) { stopWork(); return false; }
      }
      if (did) arm(0);
      return did;
    }

    /* Перевод фокуса: ближние — сразу; усыпление — после QUIET_MS покоя. */
    function onFocus(e) {
      if (!state) return;
      try {
        if (on()) {
          wakeCardsAround(targetCard(e));
          var c = component();
          if (c) near(c);
        } else {
          wakeAll();
        }
      } catch (e) {
        warn('rowmem: focus failed', e);
      }
      arm(QUIET_MS);
      /* Мышь: Lampa обновляет active ряда уже после нашего захвата. */
      if (!state.recheck) {
        state.recheck = setT(function onRowmemRecheck() {
          if (!state) return;
          state.recheck = null;
          try {
            var c2 = on() ? component() : null;
            if (c2) near(c2);
          } catch (e2) {
            warn('rowmem: recheck failed', e2);
          }
        }, 0);
      }
    }

    /* Все ряды компонента главной — как были. */
    function wakeAllOf(c) {
      try {
        if (!c || !Array.isArray(c.items)) return;
        for (var i = 0; i < c.items.length; i++) {
          var line = c.items[i];
          if (!line) continue;
          line.lumen_rowmem_skip = false;
          if (line.lumen_rowmem_bytes) backBytes(line);
          if (line.lumen_rowmem_sleep) wakeLine(line);
          wakeCards(tape(line));
        }
      } catch (e) {
        warn('rowmem: wake all failed', e);
      }
    }

    /* Все ряды открытой главной (выключение настройки, смена размера окна). */
    function wakeAll() {
      wakeAllOf(component());
    }

    function onResize() {
      if (!state) return;
      wakeAll();
      arm(QUIET_MS);
    }

    /* Все известные главные: открытая (по её компоненту) и припаркованные. */
    function wakeKnown() {
      if (state) wakeAllOf(state.comp || component());
      for (var i = 0; i < parked.length; i++) wakeAllOf(parked[i].comp);
    }

    /* Первое касание экрана (см. шапку): всё разбудить, работу снять; дальше
       on() — false до конца сеанса. */
    function onTouch() {
      if (touched) return;
      touched = true;
      stopWork();
      wakeKnown();
    }

    function mount(root) {
      try {
        if (!root || !root.length || !root[0]) return;
        if (state && state.root && state.root[0] === root[0]) { onFocus(); return; }
        unmount();
        /* Вернулись на припаркованную главную — дальше она снова наша. */
        forget(root);
        state = { root: root, timer: null, idle: null, recheck: null, failed: 0, handler: onFocus, resize: onResize, touch: onTouch,
          stats: { slept: 0, woke: 0, cards: 0, dropped: 0, back: 0, cardViews: 0 } };
        if (!LC.focus.capture(root[0], state.handler)) state.handler = null;
        try { root[0].addEventListener('touchstart', state.touch, { capture: true, passive: true }); } catch (eT) { state.touch = null; }
        try { window.addEventListener('resize', state.resize); } catch (eR) { state.resize = null; }
        state.comp = component();
        arm(QUIET_MS);
      } catch (e) {
        warn('rowmem: mount failed', e);
      }
    }

    function unmount() {
      if (!state) return;
      var s = state;
      stopWork();
      if (s.recheck) clearT(s.recheck);
      state = null;
      try { if (s.handler) LC.focus.release(s.root[0], s.handler); } catch (e) { warn('rowmem: unmount failed', e); }
      try { if (s.resize) window.removeEventListener('resize', s.resize); } catch (e2) { warn('rowmem: unmount failed', e2); }
      try { if (s.touch) s.root[0].removeEventListener('touchstart', s.touch, true); } catch (e3) { warn('rowmem: unmount failed', e3); }
    }

    /* Корень root — это render или лежит в нём. */
    function inside(root, render) {
      try {
        var node = root && root[0];
        var box = render && render.length ? render[0] : null;
        return !!(box && node && (box === node || (typeof box.contains === 'function' && box.contains(node))));
      } catch (e) {
        return false;
      }
    }

    function owns(render) {
      return !!state && inside(state.root, render);
    }

    /* Главная больше не припаркована: её активность уничтожена ('destroy' —
       вытеснена из истории, закрыта «Назад») или снова смонтирована. */
    function forget(render) {
      var keep = [];
      for (var i = 0; i < parked.length; i++) {
        if (!inside(parked[i].root, render)) keep.push(parked[i]);
      }
      parked = keep;
    }

    function detach(render) {
      if (!state) return;
      if (owns(render)) return;
      /* Ушли вглубь: главная остаётся в истории со своими спящими рядами. */
      if (state.comp) parked.push({ root: state.root, comp: state.comp });
      unmount();
    }

    function mountCurrent() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main' || !act.activity || typeof act.activity.render !== 'function') return;
        mount(act.activity.render());
      } catch (e) {
        warn('rowmem: mount current failed', e);
      }
    }

    /* Выключение плагина: всё разбудить — и открытую главную, и те, от
       которых ушли вглубь, — потом снять. */
    function uninstall() {
      wakeKnown();
      parked = [];
      unmount();
    }

    var api = {
      NEAR: NEAR, FAR: FAR, BYTES_FAR: BYTES_FAR, BYTES_NEAR: BYTES_NEAR, QUIET_MS: QUIET_MS, MARK: MARK,
      FAR_WEAK: FAR_WEAK, CARD_NEAR: CARD_NEAR, CARD_FAR: CARD_FAR,
      decide: decide, plan: plan,
      mount: mount, unmount: unmount, uninstall: uninstall, detach: detach, owns: owns, forget: forget, mountCurrent: mountCurrent,
      wakeAll: wakeAll, tick: tick, onFocus: onFocus,
      active: function () { return !!state; },
      parked: function () { return parked.length; },
      stats: function () { return state ? { slept: state.stats.slept, woke: state.stats.woke, cards: state.stats.cards, dropped: state.stats.dropped, back: state.stats.back, cardViews: state.stats.cardViews } : null; },
      _timers: null,
      _idle: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rowmem;

  /* -------------------------------------------------------------------- */
  /* Исследование «без лагов» 2026-09-27, полоса scroll: LC.prefill —       */
  /* достройка рядов главной в ПРОСТОЕ, а не в конце прокрутки.             */
  /*                                                                       */
  /* Худший кадр самотеста на ТВ («lite scroll», 229/330 мс, фаза r+ev) —   */
  /* обработчик webkitTransitionEnd ленты ряда Lampa: scrollEnded → onScroll */
  /* ряда (Items.onScroll, vendor/lampa/app.min.js:19030-19036) дописывает  */
  /* пачку из view карточек разом (Card.create, шаблон, иконки, избранное), */
  /* затем Layer.visible(ряд) → frameVisible: getBoundingClientRect каждой  */
  /* карточки (первый — принудительная раскладка) и 'visible' каждой новой  */
  /* (src картинки, update). Стенд 960×540@2, CPU×10, трейс: скрипт         */
  /* 205 мс = создание 60 + 'visible' 54 + раскладка 43 + наблюдатели DOM   */
  /* 20 (метки 62_badges — 16). Та же работа для ряда главной — onPushLoaded */
  /* (app.min.js:35185-35194) в конце вертикальной прокрутки.               */
  /*                                                                       */
  /* Модуль делает ту же работу ТЕМИ ЖЕ вызовами Lampa, но заранее, когда   */
  /* фокус и клавиши стоят IDLE_MS, и по одной единице за задачу простоя    */
  /* браузера:                                                              */
  /*   1) ряд под фокусом — на AHEAD_VIEWS экранов вперёд от фокуса (а не   */
  /*      до конца results); новая карточка — сразу в коллекцию навигации;  */
  /*   2) ряды ниже — на пачку вперёд (NEXT_ROWS, по замеру сейчас 0);     */
  /*   3) ряд достроен и по нему уже шагнули вправо — новые карточки        */
  /*      видимыми, по одной: Layer.visible(карточка) — постер, как у       */
  /*      onScroll;                                                         */
  /*   4) рядов ниже фокуса меньше ROWS_AHEAD, а в очереди Lampa (loaded)   */
  /*      они есть — emit('pushLoaded') компонента главной (в полном        */
  /*      простое: эту задачу дробить нечем).                               */
  /* К концу прокрутки onScroll находит ряд уже достроенным: slice(start,   */
  /* size) пуст, остаётся один Layer.visible.                               */
  /*                                                                       */
  /* Полоса «длинные кадры на ТВ» (фото самотеста 27.09 14:07, сборка       */
  /* 98f7145): худший кадр стадии «stop scroll» — 450 мс, blk 0, скрипт      */
  /* наш setTimeout 45 мс, «other» 388. Стенд (CPU×10, трейс): кадр с blk 0 */
  /* и большим «other» — это задача сборки мусора V8 без кадра-владельца    */
  /* (MajorGC, финализация маркировки: в blockingDuration не входит, в      */
  /* длительность кадра — да), и её пауза растёт с DOM — эпилог трассировки */
  /* Blink-кучи (узлы, стили, раскладка): 3168 узлов — 171 мс, из них       */
  /* эпилог 133; 1224 — 80. Прежний модуль открывал такие кадры сам: его    */
  /* setTimeout(0)-цепочка (карточка, потом Layer.visible всего ряда — до   */
  /* 83 мс при CPU×10) шла через 400 мс после каждой остановки, а ряд       */
  /* достраивался целиком (40 из 40). Теперь:                               */
  /*   - ряд под фокусом — только на AHEAD_VIEWS экранов вперёд: ряд из 40  */
  /*     — 25 карточек, и DOM не растёт рядами целиком (8 шагов вниз:       */
  /*     карточек 217 → 179);                                                */
  /*   - колбэки простоя (requestIdleCallback), одна единица на колбэк и    */
  /*     только если до кадра остаётся MIN_LEFT_MS (иначе новая заявка через */
  /*     RETRY_MS; потолок ожидания — IDLE_WAIT_MS);                         */
  /*   - видимость — не весь ряд одним Layer.visible, а каждая новая        */
  /*     карточка отдельной задачей, в конце, когда ряд достроен, и только  */
  /*     после шага вправо по нему: кто идёт вниз с остановками, хвостов не */
  /*     смотрит (полоса 2б); в коллекцию навигации карточка идёт сразу —   */
  /*     зажатая стрелка вправо не упирается в восьмую;                     */
  /*   - ЛЮБОЕ нажатие — keydown в фазе захвата на window, раньше Lampa —   */
  /*     снимает запланированную единицу, и работа ждёт IDLE_MS покоя;      */
  /*   - поверх главной (плеер, поиск, настройки, меню, окно) — стоим.      */
  /*                                                                       */
  /* Переходы ленты Lampa модуль НЕ трогает (урок B1: дописывание по        */
  /* webkitTransitionEnd остаётся как было и лишь находит работу сделанной).*/
  /* Всё, что зовётся, — методы самой Lampa: line.emit('createAndAppend',   */
  /* элемент results) — ровно то, что зовёт onScroll; Lampa.Layer.visible;  */
  /* компонент.emit('pushLoaded') — то, что зовёт onAnimateEnd. Незнакомая  */
  /* форма ряда или компонента (другая версия Lampa) — модуль молчит.        */
  /*                                                                       */
  /* API: mount(root) / mountCurrent() / detach(render) / owns(render) /    */
  /*   unmount() / poke() / active() / stats()                              */
  /*   tick() — проверка покоя и условий и заявка на простой (в рантайме —  */
  /*   таймер; для тестов).                                                  */
  /* -------------------------------------------------------------------- */

  LC.prefill = (function () {

    /* Покой фокуса и клавиш перед работой. Больше перехода ленты Lampa
       (.3s): конец прокрутки после последнего шага уже прошёл, и модуль не
       соревнуется с ним за тот же кадр. Шаг зажатой стрелки (~100 мс)
       до работы не доживает ни разу. */
    var IDLE_MS = 400;
    /* Сколько построенных рядов держать ниже фокуса. */
    var ROWS_AHEAD = 2;
    /* Рядов ниже фокуса, которым дописывается пачка вперёд. Ноль — по
       замеру: пачка вперёд соседям (17 карточек вместо 8) удорожала каждый
       шаг вниз — коллекция навигации ряда и Layer.visible всей ленты растут
       с числом карточек, — и удержание «вниз» падало с 30-33 до 23-27 fps
       (стенд, CPU×10, по два прогона); с нулём — 28-31 при тех же 30-33 у
       штатного. Механизм оставлен: число — одна строка. */
    var NEXT_ROWS = 0;
    /* Ряд под фокусом — на столько экранов (view карточек) вперёд от
       фокуса. onScroll Lampa на карточке a строит до (round(a/view)+1)·
       view+1; запас в два экрана значит, что ни одна из 2·view следующих
       карточек не застанет ряд недостроенным — пачки в конце прокрутки
       нет, пока между остановками не больше 2·view шагов. */
    var AHEAD_VIEWS = 2;
    /* Пауза, когда делать нечего или экран не тот: не крутить таймер
       впустую. */
    var REST_MS = 1500;
    /* Единица — только в простое браузера, где до следующего кадра
       остаётся не меньше MIN_LEFT_MS (deadline.timeRemaining()): карточка
       при CPU×10 — 5 мс медиана, 14 максимум. */
    var MIN_LEFT_MS = 10;
    /* Потолок ожидания простоя: браузер всё время занят кадрами (HUD,
       частицы) — единица всё равно идёт, но не чаще раза в IDLE_WAIT_MS. */
    var IDLE_WAIT_MS = 500;
    /* Простоя не хватило — новая заявка не сразу (колбэк не крутится на
       каждом кадре анимации), а через RETRY_MS. */
    var RETRY_MS = 100;
    /* Ряд главной (pushLoaded) — одна задача, дробить нечем (Lampa строит
       ряд с view карточками и Layer.visible всей ленты разом): только в
       полном простое — до кадра не меньше ROW_LEFT_MS — и после
       ROW_QUIET_MS покоя. */
    var ROW_LEFT_MS = 40;
    var ROW_QUIET_MS = 1200;
    /* Единица дольше LONG_MS считается в stats().long; самая долгая — в
       stats().maxMs и по видам (stats().max: card, visible, next, row). */
    var LONG_MS = 16;

    var state = null;

    function now() { return api._now(); }

    function clock() {
      try {
        if (typeof performance !== 'undefined' && performance && typeof performance.now === 'function') return performance.now();
      } catch (e) { }
      return now();
    }

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

    /* Заявка на простой браузера: requestIdleCallback с потолком
       IDLE_WAIT_MS; нет его — задача таймером (deadline null). */
    function idleReq(fn) {
      var hook = api._idle;
      if (hook && typeof hook.request === 'function') return { id: hook.request(fn, IDLE_WAIT_MS), idle: true };
      try {
        if (typeof window.requestIdleCallback === 'function' && typeof window.cancelIdleCallback === 'function') {
          return { id: window.requestIdleCallback(fn, { timeout: IDLE_WAIT_MS }), idle: true };
        }
      } catch (e) { }
      return { id: setT(function () { fn(null); }, 0), idle: false };
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
        if (typeof LC.enabled === 'function' && !LC.enabled()) return false;
        return LC.pref ? LC.pref('lumen_prefill', true) !== false : true;
      } catch (e) {
        return false;
      }
    }

    /* Корень активности: render(true) — без обёртки jQuery на каждый
       вызов; Lampa отдаёт узел или jQuery-объект. */
    function nodeOf(r) {
      if (!r) return null;
      return r.nodeType ? r : r[0] || null;
    }

    /* Компонент главной Lampa (Main, app.min.js:35040): items — построенные
       ряды, active — ряд под фокусом, loaded — очередь ещё не вставленных,
       emit — шина модулей. Только если форма знакомая. */
    function component() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main' || !act.activity) return null;
        var c = act.activity.component;
        if (!c || !Array.isArray(c.items) || typeof c.emit !== 'function') return null;
        if (state && state.root && typeof act.activity.render === 'function') {
          var r = nodeOf(act.activity.render(true));
          if (r && state.root[0] && r !== state.root[0]) return null;
        }
        return c;
      } catch (e) {
        return null;
      }
    }

    /* Работать можно, пока на экране ряды главной: контроллер Lampa —
       'items_line' или 'content'. Открытое меню, настройки, поиск — стоим. */
    function onRows() {
      try {
        var en = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        var name = en && en.name;
        return name === 'items_line' || name === 'content';
      } catch (e) {
        return false;
      }
    }

    /* Что-то поверх главной: классы body, которые ставит сама Lampa
       (настройки, выбор, меню, поиск, экранная клавиатура), и тот же набор
       узлов, по которому Lampa решает «поверх контента что-то есть»
       (плеер, трейлер, окно, поиск — app.min.js:46511). Селектор — раз на
       заход в простой, классы — на каждую единицу. */
    var COVER_CLASSES = ['settings--open', 'selectbox--open', 'menu--open', 'search--open', 'keyboard-input--visible', 'orsay-player--show'];
    var COVER_NODES = '.modal,.youtube-player,.player,.search-box,.search';

    function covered(deep) {
      try {
        if (typeof document === 'undefined' || !document) return false;
        var cls = document.body && document.body.classList;
        if (cls) {
          for (var i = 0; i < COVER_CLASSES.length; i++) if (cls.contains(COVER_CLASSES[i])) return true;
        }
        if (deep && typeof document.querySelector === 'function' && document.querySelector(COVER_NODES)) return true;
      } catch (e) {
        return true;
      }
      return false;
    }

    /* Все условия работы, кроме покоя. */
    function allowed(deep) {
      if (!on()) return false;
      if (typeof document !== 'undefined' && document && document.hidden) return false;
      if (!onRows()) return false;
      return !covered(deep);
    }

    /* Ряд Lampa (Line с модулями Items/Create, app.min.js:18977-19040). */
    function isLine(line) {
      return !!(line && line.tv === true && Array.isArray(line.items) && line.data && Array.isArray(line.data.results) &&
        typeof line.emit === 'function' && line.scroll && typeof line.scroll.render === 'function');
    }

    /* Сколько карточек results уже построено: items минус кнопка «Ещё»
       (MoreFirst кладёт её первой, More — последней, app.min.js:18949-19178). */
    function built(line) {
      var n = line.items.length;
      if (line.more && line.items.indexOf(line.more) >= 0) n--;
      return n;
    }

    /* Сколько карточек ряду нужно. Ряду под фокусом (full) — на
       AHEAD_VIEWS экранов вперёд от фокуса: то, что onScroll построил бы
       на карточке active + AHEAD_VIEWS·view ((round(a/view) + 1)·view + 1,
       app.min.js:19031). Соседним — на пачку вперёд от их позиции
       ((round(active/view) + 2)·view + 1). */
    function wanted(line, full) {
      var total = line.data.results.length;
      var view = line.view > 0 ? line.view : 7;
      var at = line.active > 0 ? line.active : 0;
      var ahead = full ? 1 + AHEAD_VIEWS : 2;
      return Math.min(total, (Math.round(at / view) + ahead) * view + 1);
    }

    /* Карточка ряда — последняя в items (Items.onAppend кладёт её в конец;
       «Ещё» MoreFirst — первая). */
    function lastCard(line) {
      try {
        var it = line.items[line.items.length - 1];
        if (!it || it === line.more || typeof it.render !== 'function') return null;
        return nodeOf(it.render(true));
      } catch (e) {
        return null;
      }
    }

    /* Новая карточка ряда под фокусом — сразу в коллекцию навигации (то же,
       что делает её 'visible' у Items.onAppend, app.min.js:19003-19005, —
       Controller.collectionAppend, только если ряд сейчас владеет
       контроллером): картинку она не грузит (видимой её делает шаг вправо),
       а зажатая стрелка вправо после паузы не упирается в последнюю
       видимую. Повтор безвреден: Navigator.add не кладёт узел дважды. */
    function navAppend(line, el) {
      try {
        var C = window.Lampa && Lampa.Controller;
        if (C && typeof C.own === 'function' && typeof C.collectionAppend === 'function' && C.own(line)) C.collectionAppend(el);
      } catch (e) {
        warn('prefill: collection append failed', e);
      }
    }

    /* Карточку, которую Lampa создать не может, Create.onCreateAndAppend
       глотает сам (try/catch и console.warn, app.min.js:19135-19146): items
       не растёт, и следующая единица строила бы тот же results[have] снова —
       бесконечно (ревью этапа 1: 545 попыток и 597 предупреждений за 3 с,
       ряд застрял на 9 из 20). Не выросло — ряд помечается и больше не
       достраивается: карточки после битой дописать нельзя, не сбив счёт
       built() с индексами results. Её дописанные — видимыми, как у целого. */
    function addCard(line, full, own) {
      var before = line.items.length;
      line.emit('createAndAppend', line.data.results[built(line)]);
      if (line.items.length > before) {
        state.stats.cards++;
        if (own) {
          var el = lastCard(line);
          if (el) {
            state.queue.push(el);
            navAppend(line, el);
          }
        }
      } else {
        line.lumen_prefill_stuck = true;
        state.stats.stuck++;
      }
    }

    function needsCards(line, full) {
      return isLine(line) && !line.lumen_prefill_stuck && built(line) < wanted(line, full);
    }

    /* Следующая единица: 'card' / 'visible' / 'next' / 'row' или ''.
       Видимыми (картинка постера) новые карточки становятся, только когда
       ряд достроен и по нему уже шагнули вправо (line.active > 0): кто
       идёт вниз с остановками, хвостов не смотрит, и их постеры не отнимают
       канал у постеров рядов ниже (полоса 2б: 35–39 непоказанных постеров,
       0,9–1,3 МБ на 8 шагов вниз). Сменился ряд под фокусом — невидимые
       карточки прежнего остаются Lampa (её Layer.visible в конце прокрутки
       того ряда). */
    function plan(c) {
      var at = c.active > 0 ? c.active : 0;
      var line = c.items[at];
      if (state.line !== line) {
        state.line = line;
        state.queue.length = 0;
      }
      if (needsCards(line, true)) return 'card';
      if (state.queue.length && line.active > 0) return 'visible';
      for (var k = 1; k <= NEXT_ROWS; k++) {
        if (needsCards(c.items[at + k], false)) return 'next';
      }
      if (Array.isArray(c.loaded) && c.loaded.length && c.items.length - 1 - at < ROWS_AHEAD) return 'row';
      return '';
    }

    /* Одна единица. Карточка ряда под фокусом, её видимость, пачка соседу
       или ряд главной. */
    function run(c, kind) {
      var at = c.active > 0 ? c.active : 0;
      if (kind === 'card') {
        addCard(c.items[at], true, true);
      } else if (kind === 'visible') {
        var el = state.queue.shift();
        /* Уже видимую (called_visible ставит frameVisible Lampa — её
           Layer.visible в конце прокрутки ряда успел раньше) не трогаем:
           лишний getBoundingClientRect. */
        if (el && !el.called_visible && el.isConnected !== false && window.Lampa && Lampa.Layer && typeof Lampa.Layer.visible === 'function') {
          Lampa.Layer.visible(el);
          state.stats.visible++;
        }
      } else if (kind === 'next') {
        for (var k = 1; k <= NEXT_ROWS; k++) {
          if (needsCards(c.items[at + k], false)) { addCard(c.items[at + k], false, false); break; }
        }
      } else if (kind === 'row') {
        c.emit('pushLoaded');
        state.stats.rows++;
      }
    }

    /* Сколько ждать, прежде чем снова просить простой: 0 — единице этого
       вида простоя хватает. deadline null — задача таймером (нет
       requestIdleCallback): хватает всем, кроме ряда главной до
       ROW_QUIET_MS покоя. */
    function waitFor(deadline, kind) {
      if (kind === 'row') {
        var quiet = ROW_QUIET_MS - (now() - state.focusAt);
        if (quiet > 0) return quiet;
      }
      if (!deadline || typeof deadline.timeRemaining !== 'function') return 0;
      var left = deadline.timeRemaining();
      if (kind === 'row') return !deadline.didTimeout && left >= ROW_LEFT_MS ? 0 : RETRY_MS;
      return deadline.didTimeout || left >= MIN_LEFT_MS ? 0 : RETRY_MS;
    }

    function stopAll() {
      if (!state) return;
      if (state.timer) { clearT(state.timer); state.timer = null; }
      if (state.idle) { idleCancel(state.idle); state.idle = null; }
    }

    function arm(ms) {
      if (!state) return;
      stopAll();
      state.timer = setT(onTimer, ms);
    }

    function askIdle() {
      if (!state) return;
      stopAll();
      state.idle = idleReq(onIdle);
    }

    function onTimer() {
      if (!state) return;
      state.timer = null;
      tick();
    }

    /* Новая заявка на простой через ms — без повторной проверки узлов
       поверх главной (её делает tick на заходе в простой). */
    function retry(ms) {
      if (!state) return;
      stopAll();
      state.timer = setT(onRetry, ms);
    }

    function onRetry() {
      if (!state) return;
      state.timer = null;
      askIdle();
    }

    /* Покой и условия — и заявка на простой. true — заявка подана. */
    function tick() {
      if (!state) return false;
      var wait = IDLE_MS - (now() - state.focusAt);
      if (wait > 0) { arm(wait); return false; }
      if (!allowed(true)) { arm(REST_MS); return false; }
      var c = component();
      if (!c) { arm(REST_MS); return false; }
      var kind = '';
      try {
        kind = plan(c);
      } catch (e) {
        return fail(e);
      }
      if (!kind) { arm(REST_MS); return false; }
      askIdle();
      return true;
    }

    function fail(e) {
      warn('prefill: work failed', e);
      state.failed++;
      /* Два отказа подряд — форма Lampa не та: молчим до перемонтирования. */
      if (state.failed >= 2) { stopAll(); return false; }
      arm(REST_MS);
      return false;
    }

    /* Колбэк простоя: одна единица, если на неё хватает времени, и заявка
       на следующую. Нажатие между заявкой и колбэком заявку уже сняло
       (poke); покой всё равно проверяется заново. */
    function onIdle(deadline) {
      if (!state) return;
      state.idle = null;
      if (IDLE_MS - (now() - state.focusAt) > 0) { tick(); return; }
      if (!allowed(false)) { arm(REST_MS); return; }
      var c = component();
      if (!c) { arm(REST_MS); return; }
      var kind;
      try {
        kind = plan(c);
        if (!kind) { arm(REST_MS); return; }
        var wait = waitFor(deadline, kind);
        if (wait > 0) {
          state.stats.waits++;
          retry(wait);
          return;
        }
        var t0 = clock();
        run(c, kind);
        var ms = clock() - t0;
        if (ms > state.stats.maxMs) state.stats.maxMs = ms;
        if (ms > state.stats.max[kind]) state.stats.max[kind] = ms;
        if (ms > LONG_MS) state.stats.long++;
      } catch (e) {
        fail(e);
        return;
      }
      state.failed = 0;
      askIdle();
    }

    /* Перевод фокуса или нажатие — отсчёт покоя заново, запланированная
       единица снимается. Нажатие без перевода фокуса (стрелка вниз упёрлась
       в последний построенный ряд) — тоже не покой: пока клавишу держат,
       модуль не работает вовсе (стенд: достройка посреди удержания «вниз»
       роняла fps 30 → 18). */
    function poke() {
      if (!state) return;
      state.focusAt = now();
      arm(IDLE_MS);
    }

    /* Нажатие — в фазе захвата на window, раньше обработчиков Lampa:
       единица, стоящая в очереди задач за нажатием, уже не начнётся.
       Нет window.addEventListener — подписка Keypad Lampa. */
    function keypad() {
      try {
        var k = window.Lampa && Lampa.Keypad && Lampa.Keypad.listener;
        return k && typeof k.follow === 'function' && typeof k.remove === 'function' ? k : null;
      } catch (e) {
        return null;
      }
    }

    function listenKeys(s) {
      try {
        if (typeof window.addEventListener === 'function') {
          window.addEventListener('keydown', poke, true);
          s.win = true;
          return;
        }
      } catch (e) { }
      var k = keypad();
      if (k) { k.follow('keydown', poke); s.keys = k; }
    }

    function mount(root) {
      try {
        if (!root || !root.length || !root[0]) return;
        if (state && state.root && state.root[0] === root[0]) { poke(); return; }
        unmount();
        state = {
          root: root, timer: null, idle: null, focusAt: now(), failed: 0, handler: poke, keys: null, win: false,
          line: null, queue: [],
          stats: { cards: 0, visible: 0, rows: 0, stuck: 0, waits: 0, long: 0, maxMs: 0, max: { card: 0, visible: 0, next: 0, row: 0 } }
        };
        if (!LC.focus.capture(root[0], state.handler)) state.handler = null;
        listenKeys(state);
        arm(IDLE_MS);
      } catch (e) {
        warn('prefill: mount failed', e);
      }
    }

    function unmount() {
      if (!state) return;
      var s = state;
      stopAll();
      state = null;
      s.queue.length = 0;
      try { if (s.handler) LC.focus.release(s.root[0], s.handler); } catch (e) { warn('prefill: unmount failed', e); }
      try { if (s.win) window.removeEventListener('keydown', poke, true); } catch (e2) { warn('prefill: unmount failed', e2); }
      try { if (s.keys) s.keys.remove('keydown', poke); } catch (e3) { warn('prefill: unmount failed', e3); }
    }

    /* Корень смонтирован внутри render (или это он сам). */
    function owns(render) {
      if (!state || !render || !render.length) return false;
      try {
        var node = state.root[0];
        var box = render[0];
        return !!(box && node && (box === node || (typeof box.contains === 'function' && box.contains(node))));
      } catch (e) {
        return false;
      }
    }

    /* Смена экрана: снять, если корень лежит вне стартующей активности
       (тот же приём, что у LC.badges.detach). */
    function detach(render) {
      if (!state) return;
      if (owns(render)) return;
      unmount();
    }

    /* Плагин включили из настроек поверх открытой главной: события 'start'
       не будет (тот же случай, что у героя и меток). */
    function mountCurrent() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main' || !act.activity || typeof act.activity.render !== 'function') return;
        mount(act.activity.render());
      } catch (e) {
        warn('prefill: mount current failed', e);
      }
    }

    function r1(x) { return Math.round(x * 10) / 10; }

    function stats() {
      if (!state) return null;
      var s = state.stats;
      return {
        cards: s.cards, visible: s.visible, rows: s.rows, stuck: s.stuck, waits: s.waits, long: s.long,
        maxMs: r1(s.maxMs),
        max: { card: r1(s.max.card), visible: r1(s.max.visible), next: r1(s.max.next), row: r1(s.max.row) }
      };
    }

    var api = {
      IDLE_MS: IDLE_MS, ROWS_AHEAD: ROWS_AHEAD, NEXT_ROWS: NEXT_ROWS, AHEAD_VIEWS: AHEAD_VIEWS,
      MIN_LEFT_MS: MIN_LEFT_MS, IDLE_WAIT_MS: IDLE_WAIT_MS, ROW_LEFT_MS: ROW_LEFT_MS, ROW_QUIET_MS: ROW_QUIET_MS,
      wanted: wanted, built: built,
      mount: mount, unmount: unmount, detach: detach, owns: owns, mountCurrent: mountCurrent, poke: poke, tick: tick,
      active: function () { return !!state; },
      stats: stats,
      /* Хуки тестов: часы, пара таймеров и заявка на простой
         ({ request(fn, timeout) → id, cancel(id) }). */
      _now: function () { return Date.now(); },
      _timers: null,
      _idle: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefill;

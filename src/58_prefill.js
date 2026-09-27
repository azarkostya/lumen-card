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
  /* Модуль делает ту же работу ТЕМИ ЖЕ вызовами Lampa, но заранее и по    */
  /* одной единице за задачу, когда фокус стоит IDLE_MS:                    */
  /*   1) ряд под фокусом — до конца results;                               */
  /*   2) ряды ниже — на пачку вперёд (NEXT_ROWS, по замеру сейчас 0);     */
  /*   3) после дописанных карточек ряда — один Layer.visible этого ряда    */
  /*      (картинки и коллекция навигации — как у onScroll);                 */
  /*   4) рядов ниже фокуса меньше ROWS_AHEAD, а в очереди Lampa (loaded)   */
  /*      они есть — emit('pushLoaded') компонента главной.                 */
  /* К концу прокрутки onScroll находит ряд уже достроенным: slice(start,   */
  /* size) пуст, остаётся один Layer.visible. Замер (стенд, CPU×10, по 3    */
  /* прогона): скрипт webkitTransitionEnd медиана 115-157 → 36-74 мс;      */
  /* самотест, стадия «lite scroll»: худший кадр 130-155 → 65-68 мс, и это  */
  /* уже не конец прокрутки.                                                */
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
  /*   tick() — одна единица работы (для тестов; в рантайме — таймер).       */
  /* -------------------------------------------------------------------- */

  LC.prefill = (function () {

    /* Покой фокуса перед работой. Больше перехода ленты Lampa (.3s):
       конец прокрутки после последнего шага уже прошёл, и модуль не
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
    /* Пауза, когда делать нечего или экран не тот: не крутить таймер
       впустую. */
    var REST_MS = 1500;

    var state = null;

    function now() { return api._now(); }

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

    function on() {
      try {
        if (typeof LC.enabled === 'function' && !LC.enabled()) return false;
        return LC.pref ? LC.pref('lumen_prefill', true) !== false : true;
      } catch (e) {
        return false;
      }
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
          var r = act.activity.render();
          if (r && r[0] && state.root[0] && r[0] !== state.root[0]) return null;
        }
        return c;
      } catch (e) {
        return null;
      }
    }

    /* Работать можно, пока на экране ряды главной: контроллер Lampa —
       'content' или 'items_line'. Открытое меню, настройки, поиск — стоим. */
    function onRows() {
      try {
        var en = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        var name = en && en.name;
        return name === 'items_line' || name === 'content';
      } catch (e) {
        return false;
      }
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

    /* Сколько карточек ряду нужно: ряду под фокусом — все, соседним —
       то, что onScroll построил бы на пачку вперёд от их позиции
       ((round(active/view) + 2) * view + 1, ср. app.min.js:19031). */
    function wanted(line, full) {
      var total = line.data.results.length;
      if (full) return total;
      var view = line.view > 0 ? line.view : 7;
      var at = line.active > 0 ? line.active : 0;
      return Math.min(total, (Math.round(at / view) + 2) * view + 1);
    }

    /* Карточку, которую Lampa создать не может, Create.onCreateAndAppend
       глотает сам (try/catch и console.warn, app.min.js:19135-19146): items
       не растёт, и следующая единица строила бы тот же results[have] снова —
       бесконечно (ревью этапа 1: 545 попыток и 597 предупреждений за 3 с,
       ряд застрял на 9 из 20). Не выросло — ряд помечается и больше не
       достраивается: карточки после битой дописать нельзя, не сбив счёт
       built() с индексами results. Его Layer.visible остаётся. */
    function lineWork(line, full) {
      if (!isLine(line)) return false;
      var have = built(line);
      if (!line.lumen_prefill_stuck && have < wanted(line, full)) {
        var before = line.items.length;
        line.emit('createAndAppend', line.data.results[have]);
        line.lumen_prefill_dirty = true;
        if (line.items.length > before) state.stats.cards++;
        else { line.lumen_prefill_stuck = true; state.stats.stuck++; }
        return true;
      }
      if (line.lumen_prefill_dirty) {
        line.lumen_prefill_dirty = false;
        if (window.Lampa && Lampa.Layer && typeof Lampa.Layer.visible === 'function') {
          Lampa.Layer.visible(line.scroll.render(true));
          state.stats.visible++;
        }
        return true;
      }
      return false;
    }

    /* Одна единица работы. true — что-то сделано (следующая — сразу). */
    function work(c) {
      var at = c.active > 0 ? c.active : 0;
      if (lineWork(c.items[at], true)) return true;
      for (var k = 1; k <= NEXT_ROWS; k++) {
        if (lineWork(c.items[at + k], false)) return true;
      }
      if (Array.isArray(c.loaded) && c.loaded.length && c.items.length - 1 - at < ROWS_AHEAD) {
        c.emit('pushLoaded');
        state.stats.rows++;
        return true;
      }
      return false;
    }

    function arm(ms) {
      if (!state) return;
      if (state.timer) clearT(state.timer);
      state.timer = setT(function () {
        if (!state) return;
        state.timer = null;
        tick();
      }, ms);
    }

    function tick() {
      if (!state) return false;
      var wait = IDLE_MS - (now() - state.focusAt);
      if (wait > 0) { arm(wait); return false; }
      if (!on() || (typeof document !== 'undefined' && document.hidden) || !onRows()) { arm(REST_MS); return false; }
      var c = component();
      if (!c) { arm(REST_MS); return false; }
      var did = false;
      try {
        did = work(c);
      } catch (e) {
        warn('prefill: work failed', e);
        state.failed++;
        /* Два отказа подряд — форма Lampa не та: молчим до перемонтирования. */
        if (state.failed >= 2) { stopTimer(); return false; }
      }
      if (did) state.failed = 0;
      arm(did ? 0 : REST_MS);
      return did;
    }

    function stopTimer() {
      if (state && state.timer) { clearT(state.timer); state.timer = null; }
    }

    /* Перевод фокуса или нажатие — отсчёт покоя заново. Нажатие без
       перевода фокуса (стрелка вниз упёрлась в последний построенный ряд)
       — тоже не покой: пока клавишу держат, модуль не работает вовсе
       (стенд: достройка посреди удержания «вниз» роняла fps 30 → 18). */
    function poke() {
      if (!state) return;
      state.focusAt = now();
      arm(IDLE_MS);
    }

    function keypad() {
      try {
        var k = window.Lampa && Lampa.Keypad && Lampa.Keypad.listener;
        return k && typeof k.follow === 'function' && typeof k.remove === 'function' ? k : null;
      } catch (e) {
        return null;
      }
    }

    function mount(root) {
      try {
        if (!root || !root.length || !root[0]) return;
        if (state && state.root && state.root[0] === root[0]) { poke(); return; }
        unmount();
        state = { root: root, timer: null, focusAt: now(), failed: 0, handler: poke, keys: null, stats: { cards: 0, visible: 0, rows: 0, stuck: 0 } };
        if (!LC.focus.capture(root[0], state.handler)) state.handler = null;
        var k = keypad();
        if (k) { k.follow('keydown', poke); state.keys = k; }
        arm(IDLE_MS);
      } catch (e) {
        warn('prefill: mount failed', e);
      }
    }

    function unmount() {
      if (!state) return;
      var s = state;
      stopTimer();
      state = null;
      try { if (s.handler) LC.focus.release(s.root[0], s.handler); } catch (e) { warn('prefill: unmount failed', e); }
      try { if (s.keys) s.keys.remove('keydown', poke); } catch (e2) { warn('prefill: unmount failed', e2); }
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

    var api = {
      IDLE_MS: IDLE_MS, ROWS_AHEAD: ROWS_AHEAD, NEXT_ROWS: NEXT_ROWS,
      wanted: wanted, built: built,
      mount: mount, unmount: unmount, detach: detach, owns: owns, mountCurrent: mountCurrent, poke: poke, tick: tick,
      active: function () { return !!state; },
      stats: function () { return state ? { cards: state.stats.cards, visible: state.stats.visible, rows: state.stats.rows, stuck: state.stats.stuck } : null; },
      /* Хуки тестов: часы и пара таймеров. */
      _now: function () { return Date.now(); },
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefill;

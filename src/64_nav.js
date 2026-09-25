  /* -------------------------------------------------------------------- */
  /* Task 27 (фаза 3): навигационные ускорители и поиск подборок.          */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   holdTracker() → автомат удержания клавиши                            */
  /*   minimapModel(titles, activeIndex, word) → окно рядов или null        */
  /*   searchCollections(list, query) → до 8 подборок                       */
  /*   jumpLabel(index, total) → «14 / 60» или пустая строка                */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   install() / uninstall() — подписки на клавиатуру Lampa               */
  /*   detach() — снять панель, индикатор и таймеры при смене экрана        */
  /*   apply() — перечитать настройки на лету                               */
  /*   openSearch(opts) — поиск по подборкам (зовёт хаб, src/46_hub.js)     */
  /*   active() → видна ли мини-карта                                       */
  /*                                                                       */
  /* Три ускорителя, и все три сидят на ШТАТНОМ пути Lampa:                 */
  /*                                                                        */
  /*  1. Прыжок на 10 позиций — клавиши CH+/CH- пульта (33/427 и 34/428).   */
  /*     Lampa их уже разбирает: Keypad.keydownTrigger (app.min.js ~3580)   */
  /*     шлёт события 'toup'/'todown' и зовёт Controller.move('toup') /     */
  /*     ('todown'). Ни один контроллер Lampa 3.3.4 этих команд НЕ          */
  /*     реализует (grep 'toup:' по app.min.js — ни одного совпадения),     */
  /*     то есть клавиши доезжают до пустого места. Мы подписываемся на     */
  /*     событие клавиатуры и делаем JUMP_STEPS обычных шагов               */
  /*     Controller.move — ничего не перехватывая и ничего не ломая: если   */
  /*     в будущей версии Lampa эти команды заработают, наши шаги просто    */
  /*     сложатся с её поведением.                                          */
  /*  2. Ускорение ×3 при удержании ←/→ — на каждое штатное событие         */
  /*     клавиши добавляем FAST_EXTRA шага тем же Controller.move. Порог    */
  /*     удержания считает holdTracker по частоте событий, а не по своему   */
  /*     таймеру: Keypad троттлит keydown до одного раза в 100 мс           */
  /*     (app.min.js ~3526), и шести событий подряд не бывает ни при каком  */
  /*     ручном нажатии.                                                    */
  /*  3. Мини-карта рядов при удержании ↑/↓ — только показ: ни одного       */
  /*     Controller.move, ни одного preventDefault. Панель рисует, где      */
  /*     фокус среди рядов главной, и снимается через HIDE_MS после того,   */
  /*     как клавишу отпустили.                                             */
  /*                                                                        */
  /* Почему подписка идёт на Lampa.Keypad.listener, а не на document:       */
  /* Keypad вешает свои слушатели на WINDOW (app.min.js ~3684), то есть     */
  /* слушатель на document сработал бы РАНЬШЕ Lampa и видел бы состояние    */
  /* экрана до перемещения фокуса. Штатный listener сам нормализует коды    */
  /* пультов (Samsung orsay, LG, Philips) и снимается методом remove —      */
  /* второй источник правды о клавишах плагину не нужен.                    */
  /*                                                                        */
  /* Фокус после нашего обработчика ещё не переехал: keydownTrigger шлёт    */
  /* событие ДО Controller.move. Поэтому и мини-карта, и индикатор позиции  */
  /* перерисовываются отложенно (setTimeout 0) — к этому моменту Lampa уже  */
  /* передвинула фокус. Тик один на все события: пока он поставлен, новые   */
  /* вызовы ничего не добавляют и ничего не сдвигают.                       */
  /*                                                                        */
  /* Ресурсы: две подписки Keypad и не более четырёх таймеров (показ,       */
  /* скрытие, перерисовка, жизнь индикатора). Узлов два — панель мини-карты */
  /* и индикатор позиции, оба в body. Их снимает detach() — его зовёт смена */
  /* активности (src/90_runtime.js, 'start'), — а вместе с подписками их    */
  /* снимает uninstall(), который зовут выключение плагина и обе настройки. */
  /* Наблюдателей DOM модуль не заводит вовсе.                              */
  /* -------------------------------------------------------------------- */

  LC.nav = (function () {

    /* Окно мини-карты и порог, после которого оно включается (план Task 27
       Step 1; design-spec-main §0.16 показывает 9 строк без усечения). */
    var WINDOW = 7;
    var FULL_LIST = 9;

    /* Ускорение: сколько событий клавиши подряд считается удержанием и в
       каком окне они должны уложиться. */
    var FAST_REPEATS = 6;
    var FAST_WINDOW = 1200;
    /* Пауза между событиями, после которой серия начинается заново. Взята с
       запасом к троттлингу Keypad (100 мс): автоповтор пульта идёт плотнее,
       а вручную так часто не нажимают — двумя нажатиями в секунду ускорение
       не включается (проверено живьём 2026-09-17: четыре нажатия с паузой
       450 мс дали ровно четыре шага). */
    var FAST_GAP = 350;
    /* Дополнительных шагов на каждое штатное событие — итого ×2.
       Task 33: было два (×3). Каждый шаг — это полный проход Navigator по
       коллекции экрана с getBoundingClientRect на каждом её узле
       (vendor/lampa/vender/navigator/navigator.js:786 navigate ->
       :268 _getAllRects -> :217 _getRect), и на слабом ТВ утроение этой
       работы при удержании стрелки и есть то, что видно как торможение. */
    var FAST_EXTRA = 1;

    /* Прыжок по CH+/CH-. */
    var JUMP_STEPS = 10;

    /* Удержание ↑/↓ до показа мини-карты и её жизнь после отпускания. */
    var HOLD_MS = 500;
    var HIDE_MS = 800;
    /* Предельное время жизни панели без нажатий. Мелочь ревью фазы 3
       (docs/plans/2026-09-15-lumen-phase3-features.md:251): панель
       снималась только по keyup и на смене экрана, и потерянный keyup (у
       пультов ТВ он теряется) оставлял её висеть до смены экрана. Пока
       клавишу держат, keydown приходит автоповтором — каждые десятки или
       сотни миллисекунд, — и каждый продлевает жизнь; две секунды тишины
       значат, что клавишу уже отпустили. */
    var STALE_MS = 2000;
    /* Сколько на экране держится индикатор позиции в ряду. */
    var JUMP_LIFE = 1200;

    /* Больше восьми пунктов в списке результатов на ТВ не помещается без
       прокрутки, а поиск по названию редко даёт больше двух-трёх. */
    var SEARCH_LIMIT = 8;

    /* Коды клавиш вместе с вариантами пультов Samsung orsay/LG, которые
       нормализует Keypad (app.min.js ~3545). */
    var KEY_LEFT = [37, 4];
    var KEY_RIGHT = [39, 5];
    var KEY_UP = [38, 29460];
    var KEY_DOWN = [40, 29461];
    var KEY_PAGE_UP = [33, 427];
    var KEY_PAGE_DOWN = [34, 428];

    function esc(text) {
      return LC.util.esc('' + (text == null ? '' : text));
    }

    function has(list, code) {
      for (var i = 0; i < list.length; i++) if (list[i] === code) return true;
      return false;
    }

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Автомат удержания клавиши. На вход — события пульта
       {key, type:'down'|'up', t}, на выход — состояние
       {key, holding, repeats, since, fast}.

       Серия обрывается тремя способами: отпустили клавишу, нажали другую,
       между событиями прошло больше FAST_GAP. Последнее и отличает
       удержание от частых одиночных нажатий: автоповтор идёт плотно, рука —
       нет. Само ускорение включается, когда FAST_REPEATS событий уложились
       в FAST_WINDOW от начала серии. */
    function holdTracker() {
      var key = 0;
      var holding = false;
      var repeats = 0;
      var since = 0;
      var last = 0;
      var fast = false;

      function snapshot() {
        return { key: key, holding: holding, repeats: repeats, since: since, fast: fast };
      }

      function reset() {
        key = 0;
        holding = false;
        repeats = 0;
        since = 0;
        last = 0;
        fast = false;
      }

      function start(code, t) {
        key = code;
        holding = true;
        repeats = 1;
        since = t;
        last = t;
        fast = false;
      }

      function feed(ev) {
        if (!ev || !ev.type) return snapshot();
        var code = Number(ev.key) || 0;
        var t = Number(ev.t) || 0;
        if (ev.type === 'up') {
          /* Отпустили не ту клавишу, что держим (пользователь успел нажать
             вторую) — серию это не касается. */
          if (holding && code && code !== key) return snapshot();
          reset();
          return snapshot();
        }
        if (ev.type !== 'down') return snapshot();
        if (!holding || key !== code || (t - last) > FAST_GAP) {
          start(code, t);
          return snapshot();
        }
        repeats++;
        last = t;
        if (repeats >= FAST_REPEATS && (t - since) <= FAST_WINDOW) fast = true;
        return snapshot();
      }

      /* Сколько миллисекунд держат клавишу к моменту t. */
      function heldFor(t) {
        if (!holding) return 0;
        return Math.max(0, (Number(t) || 0) - since);
      }

      return { feed: feed, state: snapshot, reset: reset, heldFor: heldFor };
    }

    /* Модель мини-карты: список рядов с пометкой активного и «окно» вокруг
       него. Пока рядов не больше FULL_LIST, окна нет вовсе — на экране 32
       дизайна видны все девять. Дальше показываем WINDOW строк вокруг
       активной, прижимая окно к краям списка.

       word — слово для безымянного ряда («Ряд 4»). Параметром, а не из
       LC.lang: модуль про язык интерфейса не знает (контракт фазы 1).
       Пустой список → null: рисовать нечего. */
    function minimapModel(titles, activeIndex, word) {
      if (!titles || !titles.length) return null;
      var total = titles.length;
      var active = Math.floor(Number(activeIndex));
      if (!(active >= 0) || active >= total) active = -1;
      var name = word || 'Ряд';
      var from = 0;
      var to = total - 1;
      if (total > FULL_LIST) {
        var half = Math.floor(WINDOW / 2);
        var center = active < 0 ? 0 : active;
        from = Math.min(Math.max(0, center - half), total - WINDOW);
        to = from + WINDOW - 1;
      }
      var items = [];
      for (var i = from; i <= to; i++) {
        var title = ('' + (titles[i] == null ? '' : titles[i])).replace(/^\s+|\s+$/g, '');
        items.push({
          index: i,
          title: title || (name + ' ' + (i + 1)),
          active: i === active
        });
      }
      return { total: total, active: active, from: from, to: to, items: items };
    }

    /* Приведение к виду для сравнения: регистр и «ё» на клавиатуре пульта
       набирают как придётся. */
    function normalize(text) {
      return ('' + (text == null ? '' : text))
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/^\s+|\s+$/g, '');
    }

    /* Насколько хорошо подборка отвечает запросу: 0 — название начинается с
       запроса, 1 — с запроса начинается слово внутри названия, 2 — запрос
       где-то в середине слова, 3 — совпал только id (им пользуются те, кто
       знает каталог). -1 — не подходит вовсе. */
    function rankOf(title, id, query) {
      if (title) {
        var at = title.indexOf(query);
        if (at === 0) return 0;
        if (at > 0) {
          var before = title.charAt(at - 1);
          return /[0-9a-zа-я]/.test(before) ? 2 : 1;
        }
      }
      if (id && id.indexOf(query) >= 0) return 3;
      return -1;
    }

    /* Поиск подборок по названию и id. Список приходит готовым — с
       названиями на языке интерфейса (их собирает LC.hub.titleOf), поэтому
       здесь только сравнение и сортировка: сначала по качеству совпадения,
       при равном — в порядке каталога. */
    function searchCollections(list, query) {
      var q = normalize(query);
      if (!list || !list.length || !q) return [];
      var found = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        if (!item) continue;
        var rank = rankOf(normalize(item.title), normalize(item.id), q);
        if (rank < 0) continue;
        found.push({ item: item, rank: rank, order: i });
      }
      found.sort(function (a, b) {
        if (a.rank !== b.rank) return a.rank - b.rank;
        return a.order - b.order;
      });
      var out = [];
      for (var k = 0; k < found.length && out.length < SEARCH_LIMIT; k++) out.push(found[k].item);
      return out;
    }

    /* Подпись индикатора «где я в ряду». Пусто — показывать нечего: позиция
       неизвестна или карточка в ряду одна. */
    function jumpLabel(index, total) {
      var i = Math.floor(Number(index));
      var n = Math.floor(Number(total));
      if (!(n > 1)) return '';
      if (!(i >= 0) || i >= n) return '';
      return (i + 1) + ' / ' + n;
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function minimapOn() {
      try { return LC.pref('lumen_minimap', true) !== false; } catch (e) { return false; }
    }

    function fastOn() {
      try { return LC.pref('lumen_fastscroll', true) !== false; } catch (e) { return false; }
    }

    /* Режим анимаций (LC.motionMode, src/81_prefs.js): 'full' | 'lite' | 'off'.
       Читаем в момент вызова — настройку меняют на ходу. */
    function motionMode() {
      try { return LC.motionMode(); } catch (e) { return 'full'; }
    }

    function lang(key) {
      try { return LC.lang(key); } catch (e) { return ''; }
    }

    function keypad() {
      try {
        if (window.Lampa && Lampa.Keypad && Lampa.Keypad.listener) return Lampa.Keypad;
      } catch (e) { }
      return null;
    }

    /* Имя активного контроллера. */
    function controllerName() {
      try {
        var c = Lampa.Controller.enabled();
        return c && c.name ? c.name : '';
      } catch (e) {
        return '';
      }
    }

    /* Экраны, где ускорители работают: ряды главной ведёт собственный
       контроллер Lampa 'items_line' (снято живьём 2026-09-17 — на главной
       Controller.enabled().name именно он, а не 'content'), сетки и наши
       экраны — 'content'. В меню, поиске, селектах, настройках и плеере
       лишние шаги не нужны, и там ни один из этих двух не активен. */
    function onCards() {
      var name = controllerName();
      return name === 'content' || name === 'items_line';
    }

    /* Корень открытой главной или null. */
    function currentMain() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main') return null;
        if (!act.activity || typeof act.activity.render !== 'function') return null;
        return act.activity.render();
      } catch (e) {
        return null;
      }
    }

    function move(dir) {
      try {
        if (window.Lampa && Lampa.Controller && typeof Lampa.Controller.move === 'function') {
          Lampa.Controller.move(dir);
          return true;
        }
      } catch (e) {
        warn('nav: move failed', e);
      }
      return false;
    }

    function now() {
      return Date.now();
    }

    /* ------------------------------------------------------------------ */
    /* Состояние                                                           */
    /* ------------------------------------------------------------------ */

    var tracker = holdTracker();
    var bound = null;
    var panel = null;
    var jumpNode = null;
    var showTimer = null;
    var hideTimer = null;
    var staleTimer = null;
    var paintTimer = null;
    var jumpTimer = null;

    function stopTimer(id) {
      try { if (id) clearTimeout(id); } catch (e) { }
      return null;
    }

    /* ------------------------------------------------------------------ */
    /* Мини-карта рядов                                                    */
    /* ------------------------------------------------------------------ */

    /* Названия рядов главной и номер того, в котором сейчас фокус.
       Считается по DOM, а не подпиской на Lampa.Listener('line'): ряды
       строятся и пересобираются самой Lampa, и один проход по .items-line в
       момент показа дешевле постоянной подписки, которая жила бы всё время
       работы плагина ради панели, видимой полсекунды в час. Названия берутся
       из .items-line__title каждого ряда, поэтому индексы строк панели и
       рядов экрана совпадают даже у рядов без заголовка. */
    function readRows(root) {
      var lines = $('.items-line', root);
      var focus = $('.card.focus', root);
      var focusNode = focus && focus.length ? focus[0] : null;
      var titles = [];
      var active = -1;
      for (var i = 0; i < lines.length; i++) {
        var head = $('.items-line__title', lines[i]);
        titles.push(head && head.length ? head.eq(0).text() : '');
        if (focusNode && lines[i].contains && lines[i].contains(focusNode)) active = i;
      }
      return { titles: titles, active: active };
    }

    function minimapHtml(model) {
      var count = model.active >= 0
        ? (model.active + 1) + ' ' + lang('lumen_minimap_of') + ' ' + model.total
        : '' + model.total;
      var html = '<div class="lumen-minimap__head">' + esc(lang('lumen_minimap_rows')) + ' · ' + esc(count) + '</div>';
      for (var i = 0; i < model.items.length; i++) {
        var item = model.items[i];
        html += '<div class="lumen-minimap__row' + (item.active ? ' lumen-minimap__row--on' : '') + '">' + esc(item.title) + '</div>';
      }
      return html;
    }

    /* Перерисовать панель под текущее положение фокуса. Главная закрылась
       или рядов не осталось — панель снимается: она не имеет права пережить
       экран, к которому относится. */
    function paintMinimap() {
      if (!panel) return;
      var root = currentMain();
      if (!root || !root.length) { hideMinimap(); return; }
      var rows = readRows(root);
      var model = minimapModel(rows.titles, rows.active, lang('lumen_minimap_row'));
      if (!model) { hideMinimap(); return; }
      panel.html(minimapHtml(model));
    }

    /* Продлить жизнь панели ещё на STALE_MS: зовётся на показе и на
       каждом нажатии ↑/↓, пока панель на экране. */
    function touchMinimap() {
      staleTimer = stopTimer(staleTimer);
      if (!panel) return;
      staleTimer = setTimeout(function () {
        staleTimer = null;
        hideMinimap();
      }, STALE_MS);
    }

    function showMinimap() {
      if (panel) { paintMinimap(); return; }
      var root = currentMain();
      if (!root || !root.length) return;
      try {
        panel = $('<div class="lumen-minimap"></div>');
        $('body').append(panel);
      } catch (e) {
        panel = null;
        warn('nav: minimap show failed', e);
        return;
      }
      paintMinimap();
      touchMinimap();
    }

    function hideMinimap() {
      staleTimer = stopTimer(staleTimer);
      if (!panel) return;
      var node = panel;
      panel = null;
      try { node.remove(); } catch (e) {
        warn('nav: minimap remove failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Индикатор позиции в ряду                                            */
    /* ------------------------------------------------------------------ */

    /* Позиция карточки под фокусом среди карточек своего ряда или сетки.
       Ряд главной — .items-line; наши сетки (lumen_grid) и штатная
       category_full держат карточки в теле прокрутки .scroll__body.
       null — фокус не на карточке (кнопка, чип, меню). */
    function rowPosition() {
      try {
        var focus = $('.card.focus');
        if (!focus || !focus.length) return null;
        var box = focus.closest('.items-line');
        if (!box || !box.length) box = focus.closest('.scroll__body');
        if (!box || !box.length) return null;
        var cards = $('.card', box[0]);
        for (var i = 0; i < cards.length; i++) {
          if (cards[i] === focus[0]) return { index: i, total: cards.length };
        }
      } catch (e) {
        warn('nav: position failed', e);
      }
      return null;
    }

    function hideJump() {
      jumpTimer = stopTimer(jumpTimer);
      if (!jumpNode) return;
      var node = jumpNode;
      jumpNode = null;
      try { node.remove(); } catch (e) {
        warn('nav: jump remove failed', e);
      }
    }

    /* Показать «14 / 60» на JUMP_LIFE миллисекунд. Индикатор один: повторный
       прыжок обновляет текст и продлевает жизнь, а не плодит узлы. */
    function showJump() {
      var pos = rowPosition();
      var label = pos ? jumpLabel(pos.index, pos.total) : '';
      if (!label) { hideJump(); return; }
      try {
        if (!jumpNode) {
          jumpNode = $('<div class="lumen-jump"></div>');
          $('body').append(jumpNode);
        }
        jumpNode.text(label);
      } catch (e) {
        jumpNode = null;
        warn('nav: jump show failed', e);
        return;
      }
      jumpTimer = stopTimer(jumpTimer);
      jumpTimer = setTimeout(function () {
        jumpTimer = null;
        hideJump();
      }, JUMP_LIFE);
    }

    /* ------------------------------------------------------------------ */
    /* Отложенная перерисовка                                              */
    /* ------------------------------------------------------------------ */

    /* Фокус переезжает уже ПОСЛЕ нашего обработчика (Keypad шлёт событие
       клавиши до Controller.move), поэтому и панель, и индикатор читают DOM
       из отложенного тика. Тик один: пока он стоит, повторные вызовы ничего
       не добавляют. */
    function schedulePaint(withJump) {
      if (paintTimer) return;
      paintTimer = setTimeout(function () {
        paintTimer = null;
        if (panel) paintMinimap();
        if (withJump) showJump();
      }, 0);
    }

    /* ------------------------------------------------------------------ */
    /* Обработчики клавиш                                                  */
    /* ------------------------------------------------------------------ */

    /* Удержание ↑/↓: панель появляется через HOLD_MS и живёт, пока клавишу
       держат. Ни одного Controller.move здесь нет — по рядам пользователь
       идёт сам, мы только показываем, где он. */
    function onVertical(state) {
      if (!minimapOn()) return;
      if (!onCards()) return;
      if (!currentMain()) return;
      hideTimer = stopTimer(hideTimer);
      if (panel) { touchMinimap(); schedulePaint(false); return; }
      if (showTimer) return;
      showTimer = setTimeout(function () {
        showTimer = null;
        /* Клавишу успели отпустить — панель не нужна вовсе. */
        if (!tracker.state().holding) return;
        showMinimap();
      }, Math.max(0, HOLD_MS - (now() - state.since)));
    }

    function onHorizontal(state, dir) {
      if (!state.fast) return;
      if (!fastOn()) return;
      /* Task 33: в режиме «без анимаций» пользователь прямо попросил
         минимум движения — лишних шагов ему не добавляем. */
      if (motionMode() === 'off') return;
      if (!onCards()) return;
      for (var i = 0; i < FAST_EXTRA; i++) move(dir);
      schedulePaint(true);
    }

    function onJump(dir) {
      if (!fastOn()) return;
      if (!onCards()) return;
      for (var i = 0; i < JUMP_STEPS; i++) move(dir);
      schedulePaint(true);
    }

    function handleDown(e) {
      var code = e && e.code;
      if (!code) return;
      /* Управление отключено (открыт плеер, идёт ввод текста) — Lampa свои
         команды не выполняет, и нам тем более нечего добавлять. */
      if (e.enabled === false) return;
      var state = tracker.feed({ key: code, type: 'down', t: now() });
      if (has(KEY_UP, code) || has(KEY_DOWN, code)) { onVertical(state); return; }
      if (has(KEY_LEFT, code)) { onHorizontal(state, 'left'); return; }
      if (has(KEY_RIGHT, code)) { onHorizontal(state, 'right'); return; }
      if (has(KEY_PAGE_UP, code)) { onJump('left'); return; }
      if (has(KEY_PAGE_DOWN, code)) onJump('right');
    }

    function handleUp(e) {
      var code = e && e.code;
      tracker.feed({ key: code, type: 'up', t: now() });
      showTimer = stopTimer(showTimer);
      if (!panel || hideTimer) return;
      hideTimer = setTimeout(function () {
        hideTimer = null;
        hideMinimap();
      }, HIDE_MS);
    }

    /* ------------------------------------------------------------------ */
    /* Поиск по подборкам (Task 27 Step 4)                                 */
    /* ------------------------------------------------------------------ */

    /* Ввод запроса и выбор подборки. Клавиатура — штатная Lampa.Input.edit,
       голосовой ввод — тоже её, своего API плагину заводить не надо. При
       keyboard_type 'integrate' (системное поле ввода) Lampa сама вешает
       кнопку микрофона рядом с полем, пока ей не передали nomic, и по ней
       зовёт Android.voiceStart или SpeechRecognition (app.min.js ~46792);
       живая проверка 2026-09-17 показала у нашего ввода узел
       .simple-keyboard-mic. В собственной раскладке Lampa тот же микрофон
       приходит кнопкой {MIC}, а она есть в раскладке 'search' (app.min.js
       ~46575) — поэтому layout здесь именно 'search', а не 'default'.

       Две ловушки штатного ввода, обе обойдены здесь:
        - Input.edit зовёт колбэк И на «Готово», И на «Назад» (keyboard
          listener 'enter' и 'back' — app.min.js ~47154/47221), поэтому
          пустой запрос здесь просто возвращает фокус экрану;
        - закрывая клавиатуру, Lampa переводит контроллер на
          'settings_component' (back$1, app.min.js ~47235) — это верно для
          настроек, откуда Input и вызывают, но не для нашего экрана. Фокус
          возвращаем сами: onDone у вызывающего.

       opts: {items, words:{title, results, empty}, onSelect(item), onDone()}. */
    function openSearch(opts) {
      var o = opts || {};
      var words = o.words || {};
      function done() {
        try { if (typeof o.onDone === 'function') o.onDone(); } catch (e) {
          warn('nav: search done failed', e);
        }
      }
      try {
        if (!window.Lampa || !Lampa.Input || typeof Lampa.Input.edit !== 'function') return false;
        Lampa.Input.edit({
          free: true,
          nosave: true,
          value: '',
          layout: 'search',
          title: words.title || ''
        }, function (query) {
          var found = searchCollections(o.items, query);
          if (!found.length) {
            if (normalize(query)) {
              try { Lampa.Noty.show(words.empty || ''); } catch (eN) { }
            }
            done();
            return;
          }
          /* Полное ревью, S1: Lampa.Select вставляет заголовок пункта в
             разметку сырым, а названия приходят из каталога (он может быть
             внешним) — экранируем. */
          var items = [];
          for (var i = 0; i < found.length; i++) {
            items.push({ title: LC.util.esc(found[i].title || found[i].id), lumen_item: found[i] });
          }
          Lampa.Select.show({
            title: words.results || '',
            items: items,
            onSelect: function (item) {
              try { if (typeof o.onSelect === 'function') o.onSelect(item.lumen_item); } catch (eS) {
                warn('nav: search select failed', eS);
              }
            },
            onBack: done
          });
        });
        return true;
      } catch (err) {
        warn('nav: search failed', err);
        done();
        return false;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Установка                                                           */
    /* ------------------------------------------------------------------ */

    function install() {
      if (bound) return;
      var kp = keypad();
      if (!kp) return;
      var handlers = { down: handleDown, up: handleUp };
      try {
        kp.listener.follow('keydown', handlers.down);
        kp.listener.follow('keyup', handlers.up);
      } catch (e) {
        warn('nav: install failed', e);
        return;
      }
      bound = handlers;
    }

    /* Снять с экрана всё, что модуль на нём нарисовал, и погасить его
       таймеры — не трогая подписки на клавиатуру.

       Панель и индикатор принадлежат ЭКРАНУ, на котором их показали, а не
       плагину: своей жизни у них нет. До этой функции панель снималась
       только через HIDE_MS после отпускания клавиши, и, успей человек за эти
       0.8 с нажать OK, карточка открывалась ПОД уже показанной панелью —
       дефект, замеченный живьём в фазе 3 (панель осталась поверх открытой
       карточки). Зовёт её src/90_runtime.js на 'start' любой активности:
       Lampa для покидаемой активности событий не шлёт вовсе, так что смена
       экрана видна только по старту той, куда ушли. */
    function detach() {
      tracker.reset();
      showTimer = stopTimer(showTimer);
      hideTimer = stopTimer(hideTimer);
      paintTimer = stopTimer(paintTimer);
      hideJump();
      hideMinimap();
    }

    function uninstall() {
      var kp = keypad();
      if (bound && kp) {
        try {
          kp.listener.remove('keydown', bound.down);
          kp.listener.remove('keyup', bound.up);
        } catch (e) {
          warn('nav: uninstall failed', e);
        }
      }
      bound = null;
      detach();
    }

    /* Обе настройки выключены — модулю нечего делать, и подписок он не
       держит. Любая включена — подписки нужны: гейт каждой проверяется в
       момент события. */
    function apply() {
      if (minimapOn() || fastOn()) install();
      else uninstall();
    }

    return {
      holdTracker: holdTracker,
      minimapModel: minimapModel,
      searchCollections: searchCollections,
      jumpLabel: jumpLabel,
      openSearch: openSearch,
      install: install,
      uninstall: uninstall,
      detach: detach,
      apply: apply,
      active: function () { return !!panel; }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.nav;

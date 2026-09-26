  /* -------------------------------------------------------------------- */
  /* Волна «Логотипы сразу» (2026-09-24): LC.prefetch — предзагрузка       */
  /* деталей и логотипов соседей карточки под фокусом героя главной.       */
  /*                                                                       */
  /* Жалоба пользователя: «логотипы подгружаются только при выборе, и      */
  /* появляется сначала текст, а потом лого». Исследование logo (стенд в   */
  /* условиях ТВ: без HTTP-кэша, детали — медиана 545 мс, логотип — 490):  */
  /* при шаге 1200 мс «текст → логотип» у 19 из 31 карточки. Герой узнаёт  */
  /* про логотип только из ответа деталей, который сам же и запрашивает    */
  /* через 350 мс покоя фокуса, — к потолку TITLE_WAIT (600 мс от вывода)  */
  /* детали плюс картинка успевают не всегда. Прототип предзагрузки дал    */
  /* 9 из 9 «сразу логотип».                                                */
  /*                                                                       */
  /* Что делает модуль:                                                    */
  /*   around(el) — на каждом переводе фокуса (герой, onFocus). Очередь     */
  /*     прошлого окна выкидывается сразу, а новое окно планируется после  */
  /*     IDLE покоя: при зажатой стрелке (шаг ~100 мс) не уходит ни одного */
  /*     запроса. Окно — соседи в ряду по направлению движения (вперёд     */
  /*     AHEAD, назад BEHIND) и первые NEXT_ROW карточек следующего ряда;  */
  /*   details(card, ok, err) — запрос деталей самого героя: из памяти —    */
  /*     синхронно, запрос того же фильма в пути — склейка, иначе запрос   */
  /*     сразу, мимо очереди и лимита (герою ждать соседей нельзя);        */
  /*   warm(root) — один раз на корень, после первого показа героя:        */
  /*     WARM_FIRST карточек первого ряда и WARM_SECOND второго;           */
  /*   stop() — park и unmount героя: очередь пуста, поколение поднято,    */
  /*     свои загрузки логотипов сняты (в сети тоже — хранилище снимает    */
  /*     src у картинки, которую больше никто не ждёт).                    */
  /*                                                                       */
  /* Задача окна — детали карточки, а за ними, первым делом в очереди, её  */
  /* логотип (если настройка «Логотип названия» включена, а логотип        */
  /* незнаком или не доехал один раз; известный освежается в памяти).     */
  /* Одновременно в пути не больше SLOTS запросов предзагрузки.            */
  /* Раунд «Цвет сразу» (2026-09-26): своя дорожка — цвет фильма          */
  /* (LC.accent.prepare, src/57_color.js): карточка под фокусом и то же    */
  /* окно, по одному, в простое браузера (requestIdleCallback), постер     */
  /* w185 и канвас 16×16. Герой ставит цвет вместе с текстом, и к этому    */
  /* мигу он уже посчитан.                                                  */
  /* Кадры w1280 заранее НЕ грузятся: 3.7 МБ растра на кадр — это память   */
  /* и канал, отнятые у кадра карточки под фокусом. decode() не зовётся.   */
  /*                                                                       */
  /* Память:                                                               */
  /*   - детали — LRU из DETAILS_KEEP записей по ключу media/id/язык;      */
  /*   - логотипы — ОБЩЕЕ хранилище героя (LC.hero.preloadLogo/logoState,  */
  /*     src/48_hero.js): там же склейка одинаковых загрузок и LRU         */
  /*     загруженных картинок (24 штуки и 16 МБ растра), вытеснение снимает */
  /*     'ok'. Второй копии знания о логотипах нет.                         */
  /*                                                                       */
  /* HUD (src/69_hud.js) — поле «pf в пути/в очереди/попадания».           */
  /* -------------------------------------------------------------------- */

  LC.prefetch = (function () {

    /* Покой фокуса перед планом окна. Меньше DELAY героя (350 мс): соседи
       трогаются раньше, чем герой покажет карточку, на которой
       остановились, а шаг зажатой стрелки (около 100 мс) до плана не
       доживает ни разу. */
    var IDLE = 250;
    /* Запросов предзагрузки в пути одновременно. Собственные запросы
       героя сюда не входят. */
    var SLOTS = 2;
    /* Окно в ряду: вперёд по направлению движения и назад. В «Полном» оно
       шире — +3/−2, в «Лёгких» и «Выкл» (слабые устройства) — +2/−1. */
    var AHEAD = { full: 3, lite: 2 };
    var BEHIND = { full: 2, lite: 1 };
    /* Первые карточки следующего ряда — туда фокус уходит стрелкой вниз. */
    var NEXT_ROW = 3;
    /* warm: первый экран главной — около семи карточек первого ряда и три
       второго. */
    var WARM_FIRST = 7;
    var WARM_SECOND = 3;
    /* Детали в памяти: окно и первый экран с запасом. Один ответ с
       images и keywords — единицы-десятки КБ. */
    var DETAILS_KEEP = 40;
    /* Ревью H1: срок запроса деталей (разбор у send). Живой запрос Lampa
       сама обрывает через 10 с (get$c ставит network.timeout(1000 * 10),
       vendor/lampa/app.min.js:19700), но при прокси TMDB через зеркала CUB
       таймаут одного зеркала — ещё не конец: Lampa пробует следующее
       зеркало тем же запросом (app.min.js:33500-33520), и живой ответ
       приходит позже 10 с. Следующий раунд, п.6: срок 25 с (было 12) —
       два зеркала с запасом; срабатывает он только на запросе, чьи колбэки
       Lampa выбросила. */
    var SEND_LIMIT = 25000;

    /* Поколение: поднимается на каждом переводе фокуса и в stop(). Ответ
       деталей, заказанный прошлым поколением, логотип за собой уже не
       заводит — иначе при листании уходили бы запросы. */
    var gen = 0;
    var idleTimer = null;
    var focusEl = null;
    var prevEl = null;
    /* Направление последнего шага в ряду: 1 — вправо, -1 — влево. */
    var dir = 1;
    /* Задачи: {req} — детали карточки, {path, url} — её логотип. */
    var queue = [];
    /* Запросов предзагрузки в пути (деталей и логотипов). */
    var busy = 0;
    /* Сколько раз герой получил детали из памяти. */
    var hits = 0;
    /* LRU деталей: {key, json}, старые впереди. */
    var kept = [];
    /* Запросы деталей в пути: ключ → список ждущих {ok, err}. */
    var flight = {};
    /* Свои загрузки логотипов в пути: {handle} — снимаются в stop(). */
    var logoJobs = [];
    /* Корень, для которого warm уже был. */
    var warmed = null;
    /* Раунд «Цвет сразу»: дорожка цвета. Карточки ждут своей очереди в
       colors, расчёт идёт ОДИН (colorJob — {handle, over}), следующий
       стартует в простое браузера (colorWait — ручка ожидания). Отдельно от
       SLOTS: детали и логотип нужны герою к показу так же, как цвет, и
       делить с ними два места цвету незачем — его запрос — десяток КБ. */
    var colors = [];
    var colorJob = null;
    var colorWait = null;
    /* Потолок ожидания простоя: браузер, занятый без передышки (листание
       мышью, частицы), иначе не дал бы дорожке ни одного окна. */
    var COLOR_IDLE_MAX = 500;
    /* Шаг дорожки там, где requestIdleCallback нет (старые WebView). */
    var COLOR_GAP = 50;

    function langCode() {
      try {
        if (typeof LC.langCode === 'function') return LC.langCode();
      } catch (e) { }
      return 'ru';
    }

    function logoAllowed() {
      try { return LC.pref ? LC.pref('lumen_hero_logo', true) !== false : true; } catch (e) { return true; }
    }

    function windowMode() {
      var m = 'lite';
      try { m = LC.motionMode(); } catch (e) { }
      return m === 'full' ? 'full' : 'lite';
    }

    /* Герой смонтирован и его главная на экране. */
    function ready() {
      try {
        return !!(LC.hero && LC.hero.active() && !LC.hero.parked());
      } catch (e) {
        return false;
      }
    }

    function lampaGet() {
      return !!(window.Lampa && Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb &&
        typeof Lampa.Api.sources.tmdb.get === 'function');
    }

    /* Запрос деталей — ровно тот, что делал бы герой (LC.hero.
       detailsRequest): тот же адрес, те же параметры и тот же life, то
       есть и тот же ключ кэша Lampa. */
    function requestOf(card) {
      if (!card || card.id == null || !LC.hero) return null;
      var media = LC.hero.mediaOf(card);
      var lang = langCode();
      var req = LC.hero.detailsRequest(media, card.id, lang);
      req.key = media + '/' + card.id + '/' + lang;
      return req;
    }

    function recall(key) {
      for (var i = kept.length - 1; i >= 0; i--) {
        if (kept[i].key === key) {
          var hit = kept.splice(i, 1)[0];
          kept.push(hit);
          return hit.json;
        }
      }
      return null;
    }

    function remember(key, json) {
      for (var i = 0; i < kept.length; i++) {
        if (kept[i].key === key) {
          kept.splice(i, 1);
          break;
        }
      }
      kept.push({ key: key, json: json });
      while (kept.length > DETAILS_KEEP) kept.shift();
    }

    /* Запрос деталей со склейкой: тот же ключ в пути — ждущий
       добавляется к нему. Ответ пишется в память (пустой и ошибка — нет) и
       раздаётся всем ждущим. Сторож mine: поздний второй колбэк Lampa по
       уже отработанному запросу чужой, новый запрос того же ключа не
       тронет.
       Ревью H1: у запроса свой срок, SEND_LIMIT. Lampa умеет отменить
       запрос молча — network.clear() очищает список вызовов, и колбэки не
       приходят никогда (vendor/lampa/app.min.js:20283; поиск зовёт clear на
       каждом запросе и при закрытии, :41336-41339, :41369-41375; Api.clear —
       :23277, :44784). Без срока запись в flight и место в лимите висели
       до конца сеанса: два таких запроса — и предзагрузка мертва, а герой,
       вставший на запрос (details), навсегда со скелетоном меты. По сроку —
       отказ всем ждущим; ответ, доехавший позже, отсекает тот же сторож. */
    function send(req, sub) {
      var key = req.key;
      if (flight[key]) {
        flight[key].push(sub);
        return;
      }
      var mine = [sub];
      flight[key] = mine;
      var limit = setTimeout(function () {
        limit = null;
        settle(null, false);
      }, SEND_LIMIT);
      function settle(json, ok) {
        if (flight[key] !== mine) return;
        delete flight[key];
        if (limit) {
          clearTimeout(limit);
          limit = null;
        }
        if (ok && json) remember(key, json);
        for (var i = 0; i < mine.length; i++) {
          try {
            if (ok) mine[i].ok(json);
            else mine[i].err();
          } catch (e) {
            warn('prefetch: callback failed', e);
          }
        }
      }
      try {
        Lampa.Api.sources.tmdb.get(req.url, req.params,
          function (json) { settle(json, true); },
          function () { settle(null, false); },
          { life: req.life });
      } catch (e) {
        warn('prefetch: request failed', e);
        settle(null, false);
      }
    }

    /* Детали для самого героя (loadDetails в src/48_hero.js). */
    function details(card, ok, err) {
      var req = lampaGet() ? requestOf(card) : null;
      if (!req) {
        err();
        return;
      }
      var json = recall(req.key);
      if (json) {
        hits++;
        ok(json);
        return;
      }
      send(req, { ok: ok, err: err });
    }

    /* Задача логотипа по ответу деталей — тот же выбор, что у героя
       (heroModel: язык интерфейса, английский, без языка). Незнакомый и
       не доехавший один раз ('retry' — единственный повтор, лучше заранее,
       чем на показе) — задача; в пути и дважды битый — ничего. Известный
       ('ok') освежается в памяти логотипов: стенд, шаг 1200 мс — логотип
       соседа, загруженный давно, лежал в памяти самым старым, и его
       вытеснял первый же новый логотип этого же окна. */
    function logoJob(json) {
      if (!logoAllowed() || !json || !LC.hero) return null;
      var path = LC.hero.pickLogo(json.images && json.images.logos, langCode());
      if (!path) return null;
      var state = LC.hero.logoState(path);
      if (state === 'ok') LC.hero.touchLogo(path);
      if (state && state !== 'retry') return null;
      var url = LC.hero.logoUrl(path);
      return url ? { path: path, url: url } : null;
    }

    /* Логотип карточки, чьи детали только что пришли, — в очередь ПЕРВЫМ:
       карточка готова, когда у неё есть и детали, и логотип, и её логотип
       нужнее деталей следующего соседа. */
    function chainLogo(json) {
      var job = logoJob(json);
      if (job) queue.unshift(job);
    }

    function runLogo(job) {
      var state = LC.hero.logoState(job.path);
      if (state && state !== 'retry') return;
      var entry = { handle: null, over: false };
      entry.handle = LC.hero.preloadLogo(job.path, job.url, function () {
        if (entry.over) return;
        entry.over = true;
        var i = logoJobs.indexOf(entry);
        if (i !== -1) logoJobs.splice(i, 1);
        busy--;
        pump();
      });
      busy++;
      logoJobs.push(entry);
    }

    function runDetails(job) {
      var json = recall(job.req.key);
      if (json) {
        chainLogo(json);
        return;
      }
      /* Тот же фильм уже едет (запрос героя или прошлого окна) — его
         ответ ляжет в память и так. */
      if (flight[job.req.key]) return;
      var captured = gen;
      busy++;
      send(job.req, {
        ok: function (j) {
          busy--;
          if (captured === gen) chainLogo(j);
          pump();
        },
        err: function () {
          busy--;
          pump();
        }
      });
    }

    function pump() {
      while (busy < SLOTS && queue.length) {
        var job = queue.shift();
        try {
          if (job.path) runLogo(job);
          else runDetails(job);
        } catch (e) {
          warn('prefetch: job failed', e);
        }
      }
    }

    /* План по списку карточек, без повторов. Детали уже в памяти —
       сразу задача логотипа (в начало очереди, в порядке окна; известный
       логотип при этом освежается), нет — задача деталей в конец. */
    function plan(cards) {
      var seen = {};
      var logos = [];
      for (var i = 0; i < queue.length; i++) if (queue[i].req) seen[queue[i].req.key] = true;
      for (var c = 0; c < cards.length; c++) {
        var req = requestOf(cards[c]);
        if (!req || seen[req.key]) continue;
        seen[req.key] = true;
        var json = recall(req.key);
        if (json) {
          var job = logoJob(json);
          if (job) logos.push(job);
        } else {
          queue.push({ req: req });
        }
      }
      queue = logos.concat(queue);
      pump();
    }

    function colorAllowed() {
      return !!(LC.accent && typeof LC.accent.prepare === 'function' && typeof LC.accent.known === 'function');
    }

    /* Ожидание простоя браузера; ручка {cancel}. */
    function idle(fn) {
      var w = typeof window !== 'undefined' ? window : null;
      if (w && typeof w.requestIdleCallback === 'function' && typeof w.cancelIdleCallback === 'function') {
        var id = w.requestIdleCallback(fn, { timeout: COLOR_IDLE_MAX });
        return { cancel: function () { w.cancelIdleCallback(id); } };
      }
      var t = setTimeout(fn, COLOR_GAP);
      return { cancel: function () { clearTimeout(t); } };
    }

    function stopColorWait() {
      if (colorWait) {
        colorWait.cancel();
        colorWait = null;
      }
    }

    /* Следующий расчёт дорожки — в простое и только когда прошлый кончился.
       Цвет, ставший известным, пока карточка ждала (его посчитал показ
       героя), пропускается. */
    function pumpColors() {
      if (colorJob || colorWait || !colors.length) return;
      var captured = gen;
      colorWait = idle(function () {
        colorWait = null;
        if (captured !== gen || !ready()) return;
        var card = null;
        while (colors.length && !card) {
          card = colors.shift();
          if (LC.accent.known(card)) card = null;
        }
        if (!card) return;
        var entry = { handle: null, over: false };
        colorJob = entry;
        try {
          entry.handle = LC.accent.prepare(card, function () {
            if (entry.over) return;
            entry.over = true;
            if (colorJob === entry) colorJob = null;
            pumpColors();
          });
        } catch (e) {
          warn('prefetch: color failed', e);
          entry.over = true;
          colorJob = null;
        }
      });
    }

    /* Очередь цвета — в порядке списка, без повторов и без уже известных. */
    function planColors(cards) {
      if (!colorAllowed()) return;
      var seen = {};
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card || card.id == null) continue;
        var key = (LC.hero ? LC.hero.mediaOf(card) : '') + '/' + card.id;
        if (seen[key] || LC.accent.known(card)) continue;
        seen[key] = true;
        colors.push(card);
      }
      pumpColors();
    }

    /* Узлы карточек ряда с данными — в порядке разметки. */
    function cardsIn(line) {
      var out = [];
      var list = line.find('.card');
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].card_data && list[i].card_data.id != null) out.push(list[i]);
      }
      return out;
    }

    /* Следующий ряд главной — ближайший сосед .items-line ниже. */
    function nextLine(line) {
      var next = line.next();
      for (var guard = 0; next && next.length && guard < 4; guard++) {
        if (next.hasClass('items-line')) return next;
        next = next.next();
      }
      return null;
    }

    function dataOf(nodes, from, count, out) {
      for (var i = from; i < nodes.length && i < from + count; i++) out.push(nodes[i].card_data);
    }

    /* Окно вокруг карточки под фокусом: вперёд по направлению последнего
       шага в ряду, назад, первые карточки следующего ряда. Направление
       считается здесь, раз на покой фокуса, а не на каждое нажатие: на
       горячем пути фокуса модуль только переставляет таймер. */
    function windowOf(el) {
      var line = $(el).closest('.items-line');
      if (!line || !line.length) return [];
      var nodes = cardsIn(line);
      var at = nodes.indexOf(el);
      if (at === -1) return [];
      var from = prevEl ? nodes.indexOf(prevEl) : -1;
      if (from !== -1 && from !== at) dir = at > from ? 1 : -1;
      var m = windowMode();
      var out = [];
      var k;
      for (k = 1; k <= AHEAD[m]; k++) if (nodes[at + dir * k]) out.push(nodes[at + dir * k].card_data);
      for (k = 1; k <= BEHIND[m]; k++) if (nodes[at - dir * k]) out.push(nodes[at - dir * k].card_data);
      var next = nextLine(line);
      if (next) dataOf(cardsIn(next), 0, NEXT_ROW, out);
      return out;
    }

    function stopIdle() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    function around(el) {
      gen++;
      queue.length = 0;
      colors.length = 0;
      stopColorWait();
      stopIdle();
      if (!el) return;
      prevEl = focusEl;
      focusEl = el;
      var captured = gen;
      idleTimer = setTimeout(function () {
        idleTimer = null;
        if (captured !== gen || !ready()) return;
        try {
          var near = windowOf(el);
          plan(near);
          /* Цвет — и самой карточке под фокусом, первой: герой покажет её
             через DELAY, и её цвет нужен раньше соседских. */
          planColors([el.card_data].concat(near));
        } catch (e) {
          warn('prefetch: window failed', e);
        }
      }, IDLE);
    }

    function warm(root) {
      if (!root || !root.length || !ready()) return;
      if (warmed === root[0]) return;
      warmed = root[0];
      try {
        var lines = root.find('.items-line');
        var out = [];
        if (lines.length > 0) dataOf(cardsIn($(lines[0])), 0, WARM_FIRST, out);
        if (lines.length > 1) dataOf(cardsIn($(lines[1])), 0, WARM_SECOND, out);
        plan(out);
        planColors(out);
      } catch (e) {
        warn('prefetch: warm failed', e);
      }
    }

    /* Запросы деталей в пути отменить нечем (Lampa.Api.sources.tmdb.get
       ничего не возвращает, см. cancelPending в src/48_hero.js) — их
       ответы лягут в память, но логотипов за собой уже не заведут
       (поколение поднято), а место освободят. */
    function stop() {
      gen++;
      queue.length = 0;
      stopIdle();
      colors.length = 0;
      stopColorWait();
      if (colorJob) {
        var job = colorJob;
        colorJob = null;
        job.over = true;
        try { if (job.handle) job.handle.cancel(); } catch (eColor) { warn('prefetch: stop failed', eColor); }
      }
      focusEl = null;
      prevEl = null;
      /* Волна «хвосты героя», п.F (ниже порога ревью логотипов): корень
         снятой главной не держим в памяти; на возврате warm спланирует
         первый экран заново — всё, что уже в памяти, из неё. */
      warmed = null;
      var jobs = logoJobs;
      logoJobs = [];
      for (var i = 0; i < jobs.length; i++) {
        if (jobs[i].over) continue;
        jobs[i].over = true;
        busy--;
        try { if (jobs[i].handle) jobs[i].handle.cancel(); } catch (e) { warn('prefetch: stop failed', e); }
      }
    }

    /* Для HUD: fly — в пути, queue — в очереди, hits — детали героя из
       памяти. */
    function stats() {
      return { fly: busy, queue: queue.length, hits: hits };
    }

    return {
      around: around,
      details: details,
      warm: warm,
      stop: stop,
      stats: stats
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefetch;

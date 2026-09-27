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
  /* (src/57_color.js): карточка под фокусом и то же окно, по одному, в    */
  /* простое браузера (requestIdleCallback), канвас 16×16. Герой ставит   */
  /* цвет вместе с кадром, и к этому мигу он уже посчитан. Раунд C, C3:   */
  /* цвет — низ КАДРА фильма (w300, LC.accent.prepareFrame), поэтому      */
  /* карточка ждёт в очереди, пока её кадр не решён (детали в памяти и   */
  /* ответы сравнения с постером — LC.hero.frameFor); кадра у фильма нет  */
  /* — постер w185 (LC.accent.prepare), как прежде.                        */
  /* Раунд C (E3, 2026-09-26): третья дорожка — вердикты «кадр ≈ постер»   */
  /* соседей (LC.thumbs.compare) по их деталям из памяти, по одной паре, в  */
  /* простое и не раньше, чем герой выбрал кадр своей карточки: к показу    */
  /* соседа выбор его первого кадра решается из памяти, без потолка         */
  /* LOOK_WAIT (разбор — у переменной looks).                               */
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
    /* Раунд C, E3: дорожка вердиктов «кадр ≈ постер» (LC.thumbs.compare,
       src/57_thumbs.js) для первого кадра соседей. Новый признак сравнения
       точнее прежнего, но дороже: пара — 24 мс против 6, признаки постера
       — 37 мс против 12 (стенд, CPU ×10, study.md), и на медленном ТВ
       сравнение карточки под фокусом чаще не успевало бы к потолку
       LOOK_WAIT героя (300 мс) — тогда кадр выбирается вслепую. Посчитанный
       заранее вердикт герой берёт из памяти синхронно, без ожидания.
       Устроена как дорожка цвета: карточки окна по одной, пара за парой,
       в простое; при зажатой стрелке — ничего (окно планируется после
       IDLE покоя, смена фокуса снимает и очередь, и сравнение в пути —
       canvas во время листания не работает). Карточку под фокусом дорожка
       не считает — её сравнивает сам герой, — и пока он выбирает её кадр,
       своих пар не заводит: очередь простоя у LC.thumbs одна, и пара
       соседа, начатая раньше, задержала бы сравнение героя. Пары — те же,
       что спросил бы герой: кандидаты LC.hero.frameCandidates по деталям
       из памяти и правило LC.hero.pickFrame (дальше первого чистого не
       идём). */
    var looks = [];
    var lookJob = null;
    var lookWait = null;
    /* Пока герой выбирает кадр своей карточки — проверка снова через
       LOOK_RETRY. */
    var LOOK_RETRY = 120;

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
        /* Ревью rv4, RV4-1: сосед ждёт своих деталей в очереди вердиктов,
           а заказать их могло прошлое окно (его ответ несёт старое
           поколение) или сам герой (details) — будим дорожку на любой
           ответ: она работает от текущих очереди и поколения. */
        if (ok && json) {
          pumpLooks();
          /* Раунд C, C3: и дорожку цвета — кадр соседа решается по деталям. */
          pumpColors();
          /* Раунд «без ожидания», п.2: и байты кадра — по той же причине. */
          pumpFrames();
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
       логотип при этом освежается), нет — задача деталей в конец.

       Раунд «без ожидания» (фото с ТВ 27.09: мета и описание на экране, а
       на месте названия пусто), п.1: lead — САМА карточка под фокусом, и
       её задачи — самыми первыми в очереди, впереди соседей. До правки окно
       было только из соседей: карточка, на которой остановилась серия
       нажатий (шаг 150 мс, покоя IDLE между нажатиями нет) или двойное
       «вниз», в окно прошлой остановки не попадала, и её детали с
       логотипом просил только сам показ — через BURST_DELAY/DELAY, а
       логотип — ещё позже, по ответу деталей. Стенд (ТВ-профиль, CPU ×10,
       задержка сети 150–300 мс): серия — логотип в памяти к показу у 2 из
       11, название пустое у 10 из 12 показов, медиана 500 мс. Теперь запрос
       уходит через IDLE (250 мс) после последнего нажатия, то есть за
       450 мс до показа серии и за 100 мс до одиночного; показ склеивается с
       ним (send, logoFlight героя). */
    function plan(cards, lead) {
      var seen = {};
      var logos = [];
      var head = [];
      for (var i = 0; i < queue.length; i++) if (queue[i].req) seen[queue[i].req.key] = true;
      var lreq = lead ? requestOf(lead) : null;
      if (lreq && !seen[lreq.key]) {
        seen[lreq.key] = true;
        var ljson = recall(lreq.key);
        if (ljson) {
          var ljob = logoJob(ljson);
          if (ljob) head.push(ljob);
        } else if (!flight[lreq.key]) {
          head.push({ req: lreq });
        }
      }
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
      queue = head.concat(logos, queue);
      pump();
    }

    function colorAllowed() {
      return !!(LC.accent && typeof LC.accent.prepare === 'function' && typeof LC.accent.prepareFrame === 'function' &&
        typeof LC.accent.known === 'function' && typeof LC.accent.knownFrame === 'function' && typeof LC.accent.key === 'function' &&
        LC.hero && typeof LC.hero.frameFor === 'function');
    }

    /* Раунд C, C3: кадр карточки, если он уже решён: путь, '' — кадра нет,
       undefined — деталей ещё нет или ответа сравнения ещё нет. */
    function frameOf(card) {
      var req = requestOf(card);
      var json = req ? recall(req.key) : null;
      if (!json) return undefined;
      return LC.hero.frameFor(card, json);
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
       героя), пропускается. Раунд C, C3: карточка, чей кадр ещё не решён,
       остаётся в очереди — её зовут снова ответ деталей и ответ сравнения
       (runDetails, дорожка вердиктов); считается первая готовая. Кадр
       решён — цвет его низа, кадра нет — постер. */
    function pumpColors() {
      if (colorJob || colorWait || !colors.length) return;
      var captured = gen;
      colorWait = idle(function () {
        colorWait = null;
        if (captured !== gen || !ready()) return;
        var card = null;
        var path;
        var at = 0;
        while (at < colors.length && !card) {
          var c = colors[at];
          if (LC.accent.known(c)) { colors.splice(at, 1); continue; }
          path = frameOf(c);
          if (path === undefined) { at++; continue; }
          colors.splice(at, 1);
          if (path && LC.accent.knownFrame(path)) continue;
          card = c;
        }
        if (!card) return;
        var entry = { handle: null, over: false };
        colorJob = entry;
        var done = function () {
          if (entry.over) return;
          entry.over = true;
          if (colorJob === entry) colorJob = null;
          pumpColors();
        };
        try {
          entry.handle = path ? LC.accent.prepareFrame(path, done, card) : LC.accent.prepare(card, done);
        } catch (e) {
          warn('prefetch: color failed', e);
          entry.over = true;
          colorJob = null;
        }
      });
    }

    /* Очередь цвета — в порядке списка, без повторов и без уже известных.
       Раунд правок финальной проверки, A9: повтор — по ключу цвета фильма
       «источник:тип/id» (LC.accent.key, src/57_color.js), а не «тип/id»:
       карточки с одним id из разных источников — разные фильмы, и вторая
       выпадала из предрасчёта. */
    function planColors(cards) {
      if (!colorAllowed()) return;
      var seen = {};
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card || card.id == null) continue;
        var key = LC.accent.key(card);
        if (seen[key] || LC.accent.known(card)) continue;
        seen[key] = true;
        colors.push(card);
      }
      pumpColors();
    }

    function lookAllowed() {
      if (!LC.thumbs || typeof LC.thumbs.compare !== 'function' || typeof LC.thumbs.verdict !== 'function') return false;
      if (!LC.hero || typeof LC.hero.frameCandidates !== 'function' || typeof LC.hero.pickFrame !== 'function') return false;
      /* В «Выкл» кадр не грузится, и герой не сравнивает. */
      try { return LC.motionMode() !== 'off'; } catch (e) { return true; }
    }

    function heroChoosing() {
      try {
        return !!(LC.hero && typeof LC.hero.choosing === 'function' && LC.hero.choosing());
      } catch (e) {
        return false;
      }
    }

    /* Следующая пара карточки — та, чей ответ нужен выбору первого кадра
       (pickFrame без потолка): {poster, frame}; null — выбор уже решён
       (или решать нечего); undefined — деталей ещё нет в памяти. Постер и
       ключевой арт — как у героя (heroModel, chooseFrame). */
    function lookPair(card) {
      var req = requestOf(card);
      if (!req) return null;
      var json = recall(req.key);
      if (!json) return undefined;
      var poster = card.poster_path || json.poster_path || '';
      if (!poster) return null;
      var cands = LC.hero.frameCandidates(json.images, json.backdrop_path || card.backdrop_path || '');
      if (!cands.paths.length) return null;
      var r = LC.hero.pickFrame(cands.paths, cands.strong, function (path) { return LC.thumbs.verdict(poster, path); }, '', false);
      return r.wait ? { poster: poster, frame: r.wait } : null;
    }

    function stopLooks() {
      looks.length = 0;
      if (lookWait) {
        lookWait.cancel();
        lookWait = null;
      }
      if (lookJob) {
        var job = lookJob;
        lookJob = null;
        job.over = true;
        try { if (job.handle) job.handle.cancel(); } catch (e) { warn('prefetch: look cancel failed', e); }
      }
    }

    /* Следующая пара дорожки — в простое и только когда прошлая кончилась.
       Карточка без деталей в памяти ждёт их (runDetails зовёт pumpLooks
       снова); решённая — уходит из очереди. */
    function pumpLooks() {
      if (lookJob || lookWait || !looks.length) return;
      var captured = gen;
      lookWait = idle(function () {
        lookWait = null;
        if (captured !== gen || !ready() || !lookAllowed()) return;
        if (heroChoosing()) {
          var t = setTimeout(function () {
            lookWait = null;
            pumpLooks();
          }, LOOK_RETRY);
          lookWait = { cancel: function () { clearTimeout(t); } };
          return;
        }
        var pair = null;
        var at = 0;
        while (at < looks.length && !pair) {
          var got = lookPair(looks[at]);
          if (got === undefined) at++;
          else if (!got) looks.splice(at, 1);
          else pair = got;
        }
        if (!pair) return;
        var card = looks[at];
        var entry = { handle: null, over: false };
        lookJob = entry;
        var sync = true;
        try {
          entry.handle = LC.thumbs.compare(pair.poster, pair.frame, function () {
            if (entry.over) return;
            entry.over = true;
            if (lookJob === entry) lookJob = null;
            /* Ответ не лёг в память (миниатюра не доехала) — эту карточку
               сейчас не повторяем: следующий вопрос о той же паре — ещё
               одна загрузка. */
            if (LC.thumbs.verdict(pair.poster, pair.frame) === undefined) {
              var i = looks.indexOf(card);
              if (i !== -1) looks.splice(i, 1);
            }
            if (!sync) {
              pumpLooks();
              /* Раунд C, C3: кадр соседа мог решиться этим ответом. */
              pumpColors();
              pumpFrames();
            }
          });
        } catch (e) {
          warn('prefetch: look failed', e);
          entry.over = true;
          if (lookJob === entry) lookJob = null;
          looks.length = 0;
          return;
        }
        sync = false;
        if (entry.over) {
          pumpLooks();
          pumpColors();
          pumpFrames();
        }
      });
    }

    /* Раунд «без ожидания», п.2 (фото с ТВ 27.09: серый фон вместо кадра
       при листании). Байты кадра показа w1280 — заранее, для двух карточек:
       под фокусом и следующей по ходу листания. Стенд (ТВ-профиль, CPU ×10,
       задержка 150–300 мс): от остановки до кадра медиана 834 мс, из них
       сеть w1280 — 250–500 мс, и у 71 из 81 показа между кадром прошлого
       фильма и своим был нейтральный фон (медиана 80 мс, p95 277).
       Декодирования здесь нет (decode() не зовётся): растр 3.7 МБ на кадр
       появляется, только когда герой его покажет, а до того в памяти лежат
       сжатые байты — 100–300 КБ. Карточка ждёт, пока её кадр не решён
       (frameOf: детали и ответы сравнения с постером в памяти) — зовут
       снова ответ деталей и ответ сравнения, как у дорожки цвета. Кадр
       карточки под фокусом сам показ грузил бы через DELAY/BURST_DELAY —
       здесь тот же адрес уходит раньше, и загрузка показа склеивается с ним
       (кэш Blink в памяти, LC.hero.preloadFrame); следующая по ходу —
       ставка: 100–300 КБ канала, приоритет низкий. */
    var frames = [];

    function frameAllowed() {
      if (!LC.hero || typeof LC.hero.preloadFrame !== 'function' || typeof LC.hero.frameFor !== 'function') return false;
      try { return LC.motionMode() !== 'off'; } catch (e) { return true; }
    }

    function pumpFrames() {
      if (!frames.length || !ready()) return;
      for (var i = 0; i < frames.length; i++) {
        var path = frameOf(frames[i].card);
        if (path === undefined) continue;
        var job = frames.splice(i, 1)[0];
        i--;
        if (!path) continue;
        try { LC.hero.preloadFrame(path, job.low); } catch (e) { warn('prefetch: frame failed', e); }
      }
    }

    function planFrames(lead, ahead) {
      frames.length = 0;
      if (!frameAllowed()) return;
      if (lead) frames.push({ card: lead, low: false });
      if (ahead && ahead !== lead) frames.push({ card: ahead, low: true });
      pumpFrames();
    }

    /* Очередь вердиктов — карточки окна в его порядке, без повторов. */
    function planLooks(cards) {
      if (!lookAllowed()) return;
      var seen = {};
      for (var i = 0; i < cards.length; i++) {
        var card = cards[i];
        if (!card || card.id == null) continue;
        var req = requestOf(card);
        if (!req || seen[req.key]) continue;
        seen[req.key] = true;
        looks.push(card);
      }
      pumpLooks();
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
      frames.length = 0;
      stopColorWait();
      stopLooks();
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
          /* Раунд «без ожидания», п.1: сама карточка — первой. */
          plan(near, el.card_data);
          /* П.2: байты кадра — её и следующей по ходу (near[0] — первый
             сосед по направлению шага, windowOf). */
          planFrames(el.card_data, near[0]);
          /* Цвет — и самой карточке под фокусом, первой: герой покажет её
             через DELAY, и её цвет нужен раньше соседских. */
          planColors([el.card_data].concat(near));
          /* Вердикты «кадр ≈ постер» — только соседям: карточку под
             фокусом сравнивает сам герой. */
          planLooks(near);
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
        planLooks(out);
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
      frames.length = 0;
      stopColorWait();
      stopLooks();
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

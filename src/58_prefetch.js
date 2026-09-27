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
  /*     AHEAD, назад BEHIND), в ряду ниже — карточка, куда Lampa        */
  /*     поставит фокус (последняя посещённая, иначе первая), и две за ней, */
  /*     в ряду выше — она одна;                                           */
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
  /* Кадры w1280 заранее не декодируются: 3.7 МБ растра на кадр. Байты    */
  /* кадра показа — карточке под фокусом и следующей по ходу (дорожка      */
  /* кадра, раунд «без ожидания»). decode() не зовётся.                    */
  /*                                                                       */
  /* Память:                                                               */
  /*   - детали — LRU из DETAILS_KEEP записей по ключу media/id/язык;      */
  /*   - логотипы — ОБЩЕЕ хранилище героя (LC.hero.preloadLogo/logoState,  */
  /*     src/48_hero.js): там же склейка одинаковых загрузок и LRU         */
  /*     загруженных картинок (24 штуки и 16 МБ растра), вытеснение снимает */
  /*     'ok'. Второй копии знания о логотипах нет.                         */
  /*                                                                       */
  /* HUD (src/69_hud.js) — поле «pf в пути/в очереди/попадания».           */
  /*                                                                       */
  /* Колбэки таймеров и простоя — именованные (pfWindowIdle, pfFrameTimer, */
  /* pfLookIdle…): LoAF на ТВ подписывает длинный кадр таймера только      */
  /* именем функции, и самотест по нему видит, чей таймер открыл кадр.     */
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
    /* Ряд ниже — карточка, куда уйдёт фокус стрелкой вниз, и две за ней
       (этап 2а, п.3: windowOf, targetIn). */
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
       не считает — её пары срочные, их заводит дорожка кадра (этап 2а,
       askLead), и с ними склеивается показ героя, — и пока он выбирает её кадр,
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
      var limit = setTimeout(function pfSendLimit() {
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
      colorWait = idle(function pfColorIdle() {
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
      lookWait = idle(function pfLookIdle() {
        lookWait = null;
        if (captured !== gen || !ready() || !lookAllowed()) return;
        if (heroChoosing()) {
          var t = setTimeout(function pfLookRetry() {
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

    /* Дорожка кадра — одна на две полосы исследования 2026-09-27 (hero:
       «серый фон вместо кадра при листании», фото с ТВ 5/12; images: кадр
       на остановке ~700 мс, заглушка в 61 из 80 остановок). Байты кадра
       показа — тот же адрес w1280, что соберёт loadFrame героя
       (LC.hero.preloadFrame → frameUrl), без decode(): растр 3.7 МБ на кадр
       появляется, только когда герой его покажет, до того в памяти сжатые
       100–300 КБ, и таких объектов не больше двух (FRAME_KEEP героя).
       Порядок — по одному, не параллельно:
         1) карточка под фокусом — первой, как только её кадр решён
            (frameOf: детали и ответы сравнения с постером в памяти; зовут
            снова ответ деталей и ответ сравнения, как у дорожки цвета;
            этап 2а — сравнения для неё заводит сама дорожка, askLead
            ниже), с подложкой w300; показ через DELAY/BURST_DELAY
            склеивается с этой загрузкой (тот же адрес — кэш Blink в
            памяти). Кадр решил сам показ — дорожка берёт тот же адрес
            (склейка, не второй запрос); не решён и решать некому — дальше,
            к следующей;
         2) следующая по ходу листания в ряду — ставка, низкий
            приоритет, без подложки, и только когда:
              - последний шаг был по ряду (rowStep): после шага вниз
                «следующая» — сосед справа в новом ряду, туда обычно не
                идут, а загрузка на каждом шаге вниз подняла лаг шага с 265
                до 340 мс (p50, стенд полосы images);
              - прошло FRAME_AFTER от перевода фокуса и байты кадра под
                фокусом уже доехали (frameBusy; загрузка, у которой нет
                исхода дольше FRAME_BUSY_MAX, очередь не держит), и герой
                не выбирает кадр — канал и главный поток отданы показу.
       При зажатой стрелке и в серии нажатий — ни одного старта: план
       строится только после IDLE покоя, а новый перевод фокуса снимает
       очередь и таймер (around). В «Выкл» герой кадр не грузит вовсе.
       Замер при объединении (стенд 960×540@2, CPU ×10, сеть +200 мс /
       20 Мбит, «Лёгкие», 2 прогона на сценарий): против дорожки hero
       (под фокусом и следующая сразу, 3 кадра + 6 подложек) и дорожки
       images (только следующая после 900 мс) — кадр на остановке тот же
       (шаг 1.2 с: 442/620 мс p50/p95 против 456/554 и 452/1046), серый фон
       реже или так же (остановок с серым 19 из 94 против 20 и 28 из 78),
       в памяти 2 кадра + 2 подложки, стартов в серии 0 у всех. */
    /* Раунд «без лагов», этап 2а, п.1 (приёмка интегратора: после серии
       нажатий кадр встаёт через 1.2–1.4 с, серый фон в 7 из 10 показов).
       Кадр карточки под фокусом (п.1 выше) решался только показом: детали
       приходили к дорожке через IDLE + сеть, а ответы сравнения кандидатов
       с постером (LC.thumbs) заводил сам показ героя — через BURST_DELAY
       (700 мс) и после этого ещё миниатюры w92 и разбор. Стенд (ТВ-профиль,
       CPU ×10, сеть +200 мс), серии 3 × 150 мс: детали карточки — к ~530
       мс от последнего нажатия, сравнение показа — 760…1080, байты w1280 —
       1090…1370, кадр — 1400.
       Теперь выбор делает дорожка, как только у неё есть детали: пара за
       парой — те, что спросил бы показ (lookPair: кандидаты
       LC.hero.frameCandidates, правило LC.hero.pickFrame, дальше первого
       чистого не идём), в СРОЧНОЙ очереди LC.thumbs (куски не дольше 30 мс,
       между ними ввод и кадр), и по решённому — байты w1280 с подложкой.
       Показ героя берёт готовое: те же ответы в памяти LC.thumbs по той же
       паре «постер | кадр» решают его выбор синхронно тем же правилом, а
       пара, ещё едущая, склеивается с вопросом показа (compare в
       src/57_thumbs.js) — выбор один, разойтись нечему. Выбрал показ раньше
       (потолок LOOK_WAIT) — frameFor отвечает его выбором.
       В пути не больше одного такого сравнения (leadLook); перевод фокуса
       снимает его (around → stopFrames) — в серии нажатий, как и прежде,
       ни одного старта: план строится только после IDLE покоя. Ответ, не
       легший в память (миниатюра не доехала), дорожка второй раз не
       спрашивает (given) — выбирает показ, как до правки. */
    var leadLook = null;
    var FRAME_AFTER = 900;
    var FRAME_BUSY_MAX = 8000;
    var frames = [];
    var frameAt = 0;
    var frameTimer = null;
    /* Байты кадра, заказанные дорожкой, ещё едут (с какого мига). */
    var frameBusy = false;
    var frameBusyAt = 0;
    /* Последний перевод фокуса был шагом по ряду, и следующая по ходу
       карточка этого ряда (windowOf). */
    var rowStep = false;
    var nextCard = null;

    function frameAllowed() {
      if (!LC.hero || typeof LC.hero.preloadFrame !== 'function' || typeof LC.hero.frameFor !== 'function') return false;
      try { return LC.motionMode() !== 'off'; } catch (e) { return true; }
    }

    function stopFrames() {
      frames.length = 0;
      if (frameTimer) {
        clearTimeout(frameTimer);
        frameTimer = null;
      }
      if (leadLook) {
        var job = leadLook;
        leadLook = null;
        job.over = true;
        try { if (job.handle) job.handle.cancel(); } catch (e) { warn('prefetch: lead look cancel failed', e); }
      }
      var primes = leadPrimes;
      leadPrimes = [];
      for (var i = 0; i < primes.length; i++) {
        try { primes[i].cancel(); } catch (e2) { warn('prefetch: lead prime cancel failed', e2); }
      }
      dropGuess();
    }

    /* Этап 2в, п.2 (стенд, серии 3 × 150 мс, ТВ-профиль, CPU ×10, сеть
       +200 мс): детали карточки под фокусом — к ~550 мс от последнего
       нажатия, миниатюры кандидатов — к ~800, ответ сравнения (разбор на
       главном потоке) — к ~950–1110, и только тогда уходил запрос w1280:
       байты — ещё ~300 мс, кадр — к ~1340. Выбор кадра — первый кандидат,
       не похожий на постер; первый кандидат выбирается в ~75 % выборки
       (исследование hero2). Поэтому байты w1280 и подложки кандидата,
       чей ответ сравнения ждёт выбор (обычно первого), уходят НАУДАЧУ
       вместе с первой парой, параллельно миниатюрам и разбору. Угадали —
       решение дорожки встаёт на ту же загрузку (preloadFrame склеивает
       адрес), показ — тоже (тот же адрес — один ресурс браузера). Не
       угадали или фокус ушёл — недоехавшие байты снимаются и в сети
       (LC.hero.dropFrame). Одна ставка на перевод фокуса; decode() не
       зовётся; в памяти — те же FRAME_KEEP кадров и LQIP_KEEP подложек
       героя; в серии нажатий — ни одного старта (дорожка — только после
       покоя). guess — путь ставки, пока она не стала решением. */
    var guess = '';

    function guessLead(job, path) {
      if (job.guessed) return;
      job.guessed = true;
      try {
        if (LC.hero.preloadFrame(path, false)) guess = path;
      } catch (e) {
        warn('prefetch: frame guess failed', e);
      }
    }

    function dropGuess() {
      var path = guess;
      guess = '';
      if (!path || !LC.hero || typeof LC.hero.dropFrame !== 'function') return;
      try { LC.hero.dropFrame(path); } catch (e) { warn('prefetch: frame guess drop failed', e); }
    }

    /* Этап 2а, п.1: миниатюры w92 для решения карточки под фокусом —
       заранее (LC.thumbs.prime). Первый прогон на стенде (серии 3 × 150
       мс): пара уходила по ответу деталей (~560 мс от последнего нажатия
       вместо ~760 у показа), но похожий первый кандидат стоил ещё одного
       обхода сети за миниатюрой второго, а миниатюра постера — своего
       обхода внутри той же пары: выбор к ~1040 мс, кадр к ~1430, как до
       правки. Постер известен сразу (данные ряда) — его миниатюра едет
       вместе с запросом деталей; кандидаты — все, как только есть детали.
       Разбор — срочный (разбор кадра — один шаг, единицы миллисекунд при
       CPU ×10): в простое, которого под листанием почти нет, миниатюра
       второго кандидата ждала разбора, и пара с ней шла 240 мс вместо ~50.
       Ответ пары уже в памяти — миниатюру кандидата не трогаем. */
    var leadPrimes = [];

    function primeLead(job) {
      if (!LC.thumbs || typeof LC.thumbs.prime !== 'function' || !lookAllowed()) return;
      var card = job.card;
      var req = requestOf(card);
      var json = req ? recall(req.key) : null;
      var poster = card.poster_path || (json && json.poster_path) || '';
      if (!poster) return;
      try {
        if (!job.posterPrimed) {
          job.posterPrimed = true;
          leadPrimes.push(LC.thumbs.prime('poster', poster, true));
        }
        if (!json || job.framesPrimed) return;
        job.framesPrimed = true;
        var cands = LC.hero.frameCandidates(json.images, json.backdrop_path || card.backdrop_path || '');
        for (var i = 0; i < cands.paths.length; i++) {
          if (LC.thumbs.verdict(poster, cands.paths[i]) === undefined) leadPrimes.push(LC.thumbs.prime('frame', cands.paths[i], true));
        }
      } catch (e) {
        warn('prefetch: lead prime failed', e);
      }
    }

    /* Этап 2а, п.1: вопрос о паре карточки под фокусом — срочный. true —
       ответ пришёл синхронно (он в памяти или модуль заблокирован), false
       — сравнение в пути, его ответ позовёт дорожку снова. */
    function askLead(job, pair) {
      var entry = { handle: null, over: false };
      leadLook = entry;
      var sync = true;
      try {
        entry.handle = LC.thumbs.compare(pair.poster, pair.frame, function () {
          if (entry.over) return;
          entry.over = true;
          if (leadLook === entry) leadLook = null;
          if (LC.thumbs.verdict(pair.poster, pair.frame) === undefined) job.given = true;
          if (!sync) {
            pumpFrames();
            /* Кадр решён — и цвет его низа (дорожка цвета ждёт frameOf). */
            pumpColors();
          }
        }, true);
      } catch (e) {
        warn('prefetch: lead look failed', e);
        entry.over = true;
        if (leadLook === entry) leadLook = null;
        job.given = true;
      }
      sync = false;
      return entry.over;
    }

    function framesLater(ms) {
      if (frameTimer) clearTimeout(frameTimer);
      var captured = gen;
      frameTimer = setTimeout(function pfFrameTimer() {
        frameTimer = null;
        if (captured === gen) pumpFrames();
      }, ms > 0 ? ms : 0);
    }

    /* Байты заказанного кадра доехали (или загрузку сняли): следующий шаг
       дорожки — отдельной задачей, не внутри колбэка картинки. */
    function frameSettled() {
      frameBusy = false;
      if (frames.length) framesLater(0);
    }

    function pumpFrames() {
      if (!frames.length || !ready() || !frameAllowed()) return;
      var job = frames[0];
      var wait = frameAt - Date.now();
      if (!job.lead) {
        if (wait > 0) { framesLater(wait); return; }
        if (frameBusy && Date.now() - frameBusyAt < FRAME_BUSY_MAX) return;
        if (heroChoosing()) { framesLater(LOOK_RETRY); return; }
      }
      var path = frameOf(job.card);
      /* Этап 2а, п.1: карточку под фокусом решает сама дорожка — пара за
         парой, пока выбор не решён (кандидатов не больше трёх). */
      if (path === undefined && job.lead && !job.given) primeLead(job);
      while (path === undefined && job.lead && !job.given) {
        if (leadLook) return;
        var pair = lookAllowed() ? lookPair(job.card) : null;
        if (!pair) break;
        if (!askLead(job, pair)) {
          /* Этап 2в, п.2: сравнение в пути — байты его кандидата наудачу. */
          guessLead(job, pair.frame);
          return;
        }
        path = frameOf(job.card);
      }
      if (path === undefined) {
        /* Не решён. Соседа решат ответы деталей и сравнения — они зовут
           дорожку сами. Карточку под фокусом — ответ её деталей (таймер
           FRAME_AFTER лишь страхует); деталей нет и к FRAME_AFTER или
           ответ сравнения не лёг в память — её решает сам показ: пока
           герой выбирает кадр, ждём, решать больше некому — дальше, к
           соседу. */
        if (!job.lead) return;
        if (wait > 0) { framesLater(wait); return; }
        if (heroChoosing()) { framesLater(LOOK_RETRY); return; }
        frames.shift();
        pumpFrames();
        return;
      }
      frames.shift();
      /* Этап 2в, п.2: выбор решён — ставка либо он сам (дальше это
         обычный кадр под фокусом), либо мимо: её байты больше не нужны. */
      if (job.lead && guess) {
        if (guess === path) guess = '';
        else dropGuess();
      }
      if (path) {
        var got = '';
        try {
          got = LC.hero.preloadFrame(path, !job.lead, frameSettled);
        } catch (e) {
          warn('prefetch: frame failed', e);
        }
        if (got === 'load') {
          frameBusy = true;
          frameBusyAt = Date.now();
          return;
        }
      }
      pumpFrames();
    }

    function planFrames(lead, ahead) {
      stopFrames();
      if (!frameAllowed()) return;
      frameAt = Date.now() + FRAME_AFTER - IDLE;
      if (lead) frames.push({ card: lead, lead: true });
      if (ahead && ahead !== lead && rowStep) frames.push({ card: ahead, lead: false });
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

    /* Соседний ряд главной — ближайший сосед .items-line ниже (way
       'next') или выше ('prev'). */
    function lineBeside(line, way) {
      var near = line[way]();
      for (var guard = 0; near && near.length && guard < 4; guard++) {
        if (near.hasClass('items-line')) return near;
        near = near[way]();
      }
      return null;
    }

    /* Раунд «без лагов», этап 2а, п.3 (исследование preload, 5.6): куда
       встанет фокус в соседнем ряду. Lampa помнит в каждом ряду последнюю
       карточку под фокусом (Items: onAppend, hover:focus → this.last,
       vendor/lampa/app.min.js:18989) и на переходе вверх-вниз ставит фокус
       на неё (toggle → Controller.collectionFocus(this.last), :35288), а в
       ряду, где фокуса не было, — на первую карточку (collectionFocus без
       цели, :46483). Окно прежде брало первые три карточки ряда ниже: при
       возврате в пройденный ряд цель в окно не попадала, и вверх окна не
       было вовсе. Теперь три карточки ряда ниже считаются от цели, а в ряду
       выше берётся цель. Помним последние VISITED_MAX переводов фокуса
       (на горячем пути — только push, без поиска ряда); ряд цели ищется
       раз на покой фокуса, в windowOf. stop() их забывает — вместе с
       корнем снятой главной. */
    var VISITED_MAX = 64;
    var visited = [];

    function targetIn(line) {
      if (!line) return null;
      var nodes = cardsIn(line);
      if (!nodes.length) return null;
      for (var i = visited.length - 1; i >= 0; i--) {
        if (nodes.indexOf(visited[i]) !== -1) return visited[i];
      }
      return nodes[0];
    }

    function dataOf(nodes, from, count, out) {
      for (var i = from; i < nodes.length && i < from + count; i++) out.push(nodes[i].card_data);
    }

    /* Окно вокруг карточки под фокусом: вперёд по направлению последнего
       шага в ряду, назад, в рядах ниже и выше — от карточки, куда встанет
       фокус (targetIn, этап 2а). Направление считается здесь, раз на покой
       фокуса, а не на каждое нажатие: на горячем пути фокуса модуль только
       переставляет таймер и помнит карточку. */
    function windowOf(el) {
      rowStep = false;
      nextCard = null;
      var line = $(el).closest('.items-line');
      if (!line || !line.length) return [];
      var nodes = cardsIn(line);
      var at = nodes.indexOf(el);
      if (at === -1) return [];
      var from = prevEl ? nodes.indexOf(prevEl) : -1;
      if (from !== -1 && from !== at) dir = at > from ? 1 : -1;
      /* Шаг был по ряду (прошлая карточка — в этом же ряду): дорожке кадра. */
      rowStep = from !== -1 && from !== at;
      nextCard = nodes[at + dir] ? nodes[at + dir].card_data : null;
      var m = windowMode();
      var out = [];
      var k;
      for (k = 1; k <= AHEAD[m]; k++) if (nodes[at + dir * k]) out.push(nodes[at + dir * k].card_data);
      for (k = 1; k <= BEHIND[m]; k++) if (nodes[at - dir * k]) out.push(nodes[at - dir * k].card_data);
      /* Вниз ходят чаще, чем вверх: ряд ниже — цель и NEXT_ROW - 1 карточек
         за ней (в ряду без посещений это первые три, как прежде), ряд выше —
         одна цель. Первый вариант этапа — одна цель и внизу — стенд
         опроверг (шаг вниз 2 с + вправо 1.5 с, 3 + 3 прогона: кадр на шаге
         вниз p50/p95 740/1180 → 854/1573 мс, серых 0 → 5 из 12): вторая и
         третья карточки ряда ниже — это шаги вправо после шага вниз, и,
         доехав заранее, они освобождали окно следующей остановки под цель
         следующего ряда; без них её детали шли третьими-четвёртыми, и
         сравнение с постером не успевало до показа. */
      var nextRow = lineBeside(line, 'next');
      var down = targetIn(nextRow);
      if (down) {
        var below = cardsIn(nextRow);
        dataOf(below, below.indexOf(down), NEXT_ROW, out);
      }
      var up = targetIn(lineBeside(line, 'prev'));
      if (up) out.push(up.card_data);
      return out;
    }

    function stopIdle() {
      if (idleTimer) {
        clearTimeout(idleTimer);
        idleTimer = null;
      }
    }

    /* Исследование 2026-09-27 (полоса images): постеры рядов, которых
       Lampa ещё не создала, — без ожидания покоя (src/58_posters.js). */
    function posters(name) {
      try {
        if (LC.posters && typeof LC.posters[name] === 'function') LC.posters[name]();
      } catch (e) {
        warn('prefetch: posters failed', e);
      }
    }

    function around(el) {
      gen++;
      queue.length = 0;
      colors.length = 0;
      stopFrames();
      stopColorWait();
      stopLooks();
      stopIdle();
      if (!el) return;
      posters('around');
      prevEl = focusEl;
      focusEl = el;
      /* Этап 2а, п.3: посещения рядов (targetIn) — только запись. */
      visited.push(el);
      if (visited.length > VISITED_MAX) visited.shift();
      var captured = gen;
      idleTimer = setTimeout(function pfWindowIdle() {
        idleTimer = null;
        if (captured !== gen || !ready()) return;
        try {
          var near = windowOf(el);
          /* Раунд «без ожидания», п.1: сама карточка — первой. */
          plan(near, el.card_data);
          /* Дорожка кадра — её и следующей по ходу (windowOf). */
          planFrames(el.card_data, nextCard);
          /* Цвет — и самой карточке под фокусом, первой: герой покажет её
             через DELAY, и её цвет нужен раньше соседских. */
          planColors([el.card_data].concat(near));
          /* Вердикты «кадр ≈ постер» — только соседям: карточку под
             фокусом сравнивает дорожка кадра, срочно (askLead). */
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
        posters('around');
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
      posters('stop');
      colors.length = 0;
      stopFrames();
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
      visited.length = 0;
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

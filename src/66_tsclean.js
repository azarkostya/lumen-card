  /* -------------------------------------------------------------------- */
  /* 1.3: «Автоочистка TorrServer».                                        */
  /*                                                                       */
  /* Каждая раздача, открытая из Lampa, остаётся в списке TorrServer        */
  /* навсегда («Торренты → Мои торренты» — десятки старых сезонов).        */
  /* Пункт (по умолчанию выключен) убирает из TorrServer раздачи, которые   */
  /* не открывали больше суток.                                             */
  /*                                                                       */
  /* «Открывали» — запускали воспроизведение. Сам TorrServer хранит только  */
  /* timestamp добавления, поэтому момент запуска модуль помнит сам:        */
  /* ключ lumen_tsclean_played — { 'h:<хэш>': мс, 'm:tv:<id>': мс }.       */
  /* Записи приходят из подписок «Вернуться к просмотру» (src/71_resume.js,  */
  /* одни подписки на плеер на весь плагин):                                */
  /*   - Player 'create' — любой запуск плеера Lampa (встроенный и внешний), */
  /*     хэш — data.torrent_hash или link=<хэш> в адресе потока;           */
  /*   - Listener 'torrent' onenter — раздача открыта (у приложения         */
  /*     TorrServe на Android Player не зовётся вовсе); хэш — из magnet,    */
  /*     а если у раздачи только ссылка на .torrent — по карточке: тот же   */
  /*     фильм или сериал в поле data раздачи (его пишет Lampa).            */
  /* Последнее открытие раздачи = max(timestamp·1000, по хэшу, по карточке). */
  /*                                                                       */
  /* Никогда не удаляется: раздача не в состоянии «в базе» (stat 5,         */
  /* «Torrent in db») — то есть качается, предзагружается или отдаёт поток; */
  /* та, что сейчас в плеере Lampa; раздача без timestamp.                 */
  /*                                                                       */
  /* Посев: проход ничего не удаляет, а всё, что лежит в TorrServer,      */
  /* записывает открытым в этот момент. Посевной проход — после каждого   */
  /* включения пункта, после выключения плагина (deactivate) и старта     */
  /* Lampa с выключенным плагином (markOff из LC.init) — в это время      */
  /* запуски не писались; без карты вовсе; при раздач больше CAP; после   */
  /* запуска при неверных часах. Иначе включение снесло бы всё, что       */
  /* добавлено больше суток назад, вместе с сериалом, который смотрят.   */
  /*                                                                       */
  /* Часы: раньше MIN_CLOCK (ТВ без батарейки часов до синхронизации) или  */
  /* раньше самой поздней записи карты — проход пропускается, запуск не    */
  /* пишется. Перед каждым rem раздача перепроверяется по свежей карте,   */
  /* часам и плееру: план составлен до первого удаления.                  */
  /*                                                                       */
  /* Когда: через 30 с после включения плагина (главная уже на экране,      */
  /* старт слабого ТВ не делит сеть и CPU с очисткой), потом раз в 6 ч,      */
  /* пока Lampa открыта. Открыт плеер — проход откладывается на 10 мин.    */
  /* Адрес — как у Lampa (Lampa.Torserver.url: torrserver_url /             */
  /* torrserver_url_two по torrserver_use_link), а в режиме приложения      */
  /* TorrServe на Android (internal_torrclient выключен) — само приложение, */
  /* 127.0.0.1:8090: Lampa отдаёт ему раздачи, а не серверу из настроек.   */
  /* Запросы — свой экземпляр Lampa.Reguest: он сам ставит Basic-авторизацию*/
  /* для адреса из настроек (torrserver_auth), а Lampa.Torserver.my/remove */
  /* не годятся — они обрывают запросы самой Lampa к TorrServer            */
  /* (network.clear). Сервер недоступен — тишина; лог в консоль — только   */
  /* при включённом «Показать FPS». Уведомлений нет.                       */
  /*                                                                       */
  /* Срок — пункт lumen_tsclean_days (1 / 3 / 7 дней, по умолчанию сутки).  */
  /* Раздача сериала из «Досмотреть» (Favorite.continues 'tv'/'anime') или */
  /* из первых 20 записей истории лежит до 14 дней. Сериал раздачи — по    */
  /* карточке в поле data (её пишет Lampa); раздача без data не защищена.  */
  /* «Очистить сейчас» (runNow) — проход сразу и Noty с числом удалённых.   */
  /*                                                                       */
  /* Чистые функции: hashOf, cardKey, movieOf, touch, lastSeen, removable,  */
  /* plan, prune. Рантайм: install/uninstall (activate/deactivate), apply  */
  /* (пункт настроек), onPlay/onStop/onTorrent (из src/71_resume.js),      */
  /* run(done) — один проход.                                              */
  /* -------------------------------------------------------------------- */

  LC.tsclean = (function () {

    var KEY = 'lumen_tsclean_played';
    /* Пометка «следующий проход — посевной»: ставит включение пункта
       (apply), снимает посевной проход. В Storage, а не в памяти: Lampa
       могут перезапустить раньше первого прохода. */
    var SEED_KEY = 'lumen_tsclean_seed';
    var HOUR = 3600000;
    /* Сколько раздача может лежать неоткрытой — по умолчанию; срок
       выбирается пунктом lumen_tsclean_days (1 / 3 / 7 дней, idleMs). */
    var MAX_IDLE = 24 * HOUR;
    var DAY = 24 * HOUR;
    var DAYS = ['1', '3', '7'];
    /* Раздача сериала из «Досмотреть» или недавно смотренного (protectedSet)
       лежит до 14 дней. Карта запусков живёт столько же: иначе запуск
       старше срока выпадал бы из неё, и защита считалась бы от добавления. */
    var PROTECT = 14 * DAY;
    var KEEP = PROTECT;
    /* «Недавно смотренные» — первые записи истории Lampa (Favorite
       'history' — новые первыми). */
    var RECENT = 20;
    var FIRST_DELAY = 30000;
    var PERIOD = 6 * HOUR;
    var PLAYER_RETRY = 10 * 60000;
    var LIST_TIMEOUT = 8000;
    var REM_TIMEOUT = 5000;
    /* Удалений за проход: первый проход у давнего пользователя — десятки
       раздач; остальное заберёт следующий. */
    var MAX_PER_RUN = 40;
    /* Записей «открыто» — запусков за сутки (и посев — по записи на
       раздачу); старше суток они ничего не решают и выбрасываются при
       каждой записи. */
    var CAP = 300;
    var IN_DB = 5;
    var IN_DB_TEXT = 'Torrent in db';
    var APP_URL = 'http://127.0.0.1:8090';
    /* Часы раньше этой даты — заведомо неверные: ТВ без батарейки часов
       стартует с 1970/2000 года и узнаёт время по сети позже. С такими
       часами модуль ничего не записывает и проходов не делает: запуск,
       записанный «в 2000 году», после поправки часов выглядел бы давним,
       и раздача ушла бы. Дата — около выпуска 1.3. */
    var MIN_CLOCK = Date.UTC(2026, 9, 1);
    /* Часы ушли назад сильнее этого (самая поздняя запись карты в
       будущем) — проход пропускается. */
    var CLOCK_SLACK = 10 * 60000;
    /* Запись дальше этого в будущем — мусор от неверных часов: touch её
       выбрасывает, иначе она блокировала бы проходы бесконечно. */
    var FUTURE_MAX = 30 * 24 * HOUR;

    /* ------------------------------ чистое ------------------------------ */

    function str(v) {
      return (v === null || typeof v === 'undefined') ? '' : ('' + v);
    }

    var B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

    /* btih в base32 (32 знака) → hex (40). */
    function b32hex(s) {
      var bits = '';
      var i;
      s = s.toUpperCase();
      for (i = 0; i < s.length; i++) {
        var v = B32.indexOf(s.charAt(i));
        if (v < 0) return '';
        var b = v.toString(2);
        while (b.length < 5) b = '0' + b;
        bits += b;
      }
      var hex = '';
      for (i = 0; i + 4 <= bits.length; i += 4) hex += parseInt(bits.substr(i, 4), 2).toString(16);
      return hex.length === 40 ? hex : '';
    }

    /* Инфохэш раздачи из того, что знает Lampa: голый хэш, адрес потока
       TorrServer (…/stream/имя?link=<хэш>&index=N, …/play/<хэш>/N) или
       magnet (xt=urn:btih:<hex40|base32>). '' — хэша нет. */
    function hashOf(v) {
      var s = str(v);
      if (!s) return '';
      var m = /^([0-9a-fA-F]{40})$/.exec(s) ||
        /[?&]link=([0-9a-fA-F]{40})(?:[&#]|$)/.exec(s) ||
        /\/play\/([0-9a-fA-F]{40})(?:[\/?#]|$)/.exec(s) ||
        /urn:btih:([0-9a-fA-F]{40})(?:[&#]|$)/i.exec(s);
      if (m) return m[1].toLowerCase();
      m = /urn:btih:([A-Za-z2-7]{32})(?:[&#]|$)/i.exec(s);
      return m ? b32hex(m[1]) : '';
    }

    /* Карточка → 'tv:<id>' | 'movie:<id>' (TMDB нумерует фильмы и сериалы
       независимо). '' — карточки нет. */
    function cardKey(card) {
      if (!card || typeof card !== 'object') return '';
      var id = card.id;
      if (id === null || typeof id === 'undefined' || id === '') return '';
      var tv = !!(card.name || card.original_name || card.first_air_date);
      return (tv ? 'tv:' : 'movie:') + id;
    }

    /* Карточка из поля data раздачи: Lampa кладёт туда JSON
       { lampa: true, movie: {…} } (Torserver.add, Android.openTorrent). */
    function movieOf(torrent) {
      var d = torrent && torrent.data;
      if (!d) return null;
      try {
        if (typeof d === 'string') d = JSON.parse(d);
      } catch (e) {
        return null;
      }
      return d && typeof d === 'object' && d.movie && typeof d.movie === 'object' ? d.movie : null;
    }

    /* Копия карты с ключами keys = now: без записей старше KEEP (14 дней —
       дольше любого срока и защиты) и не больше CAP самых свежих. */
    function touch(map, keys, now) {
      var out = {};
      var list = [];
      var k;
      if (map && typeof map === 'object') {
        for (k in map) {
          if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
          var t = Number(map[k]);
          if (isFinite(t) && t > 0 && now - t <= KEEP && t - now <= FUTURE_MAX) list.push([k, t]);
        }
      }
      for (var i = 0; i < keys.length; i++) if (keys[i]) list.push([keys[i], now]);
      /* Самые свежие первыми: у повторного ключа остаётся новое время. */
      list.sort(function (a, b) { return b[1] - a[1]; });
      var count = 0;
      for (var j = 0; j < list.length && count < CAP; j++) {
        if (Object.prototype.hasOwnProperty.call(out, list[j][0])) continue;
        out[list[j][0]] = list[j][1];
        count++;
      }
      return out;
    }

    function stamp(map, key) {
      if (!map || !key || !Object.prototype.hasOwnProperty.call(map, key)) return 0;
      var t = Number(map[key]);
      return isFinite(t) && t > 0 ? t : 0;
    }

    /* Последнее «открытие» раздачи, мс: добавление в TorrServer, запуск по
       хэшу, запуск того же фильма или сериала. */
    function lastSeen(torrent, map) {
      var ts = Number(torrent && torrent.timestamp);
      var t = isFinite(ts) && ts > 0 ? ts * 1000 : 0;
      var hash = hashOf(torrent && torrent.hash);
      t = Math.max(t, stamp(map, 'h:' + hash));
      var ck = cardKey(movieOf(torrent));
      if (ck) t = Math.max(t, stamp(map, 'm:' + ck));
      return t;
    }

    /* Раздача лежит в базе и ничего не делает. stat — число состояния
       TorrServer (0 добавлена, 1 получает сведения, 2 предзагрузка,
       3 работает, 4 закрыта, 5 в базе); нет числа — по stat_string. */
    function idle(torrent) {
      if (typeof torrent.stat === 'number') return torrent.stat === IN_DB;
      return torrent.stat_string === IN_DB_TEXT;
    }

    /* rule (необязательно) — { idle: срок, мс; keep: { 'tv:<id>': true } —
       сериалы под защитой }. Раздача защищённого сериала лежит
       max(срок, PROTECT). Сериал раздачи — только из поля data (карточка,
       которую пишет Lampa); раздача без data не защищается. */
    function limitOf(torrent, rule) {
      var lim = rule && rule.idle > 0 ? rule.idle : MAX_IDLE;
      if (rule && rule.keep) {
        var ck = cardKey(movieOf(torrent));
        if (ck && rule.keep[ck] === true) lim = Math.max(lim, PROTECT);
      }
      return lim;
    }

    function removable(torrent, map, now, current, rule) {
      if (!torrent || typeof torrent !== 'object') return false;
      var hash = hashOf(torrent.hash);
      if (!hash || hash === current) return false;
      if (!idle(torrent)) return false;
      var ts = Number(torrent.timestamp);
      if (!isFinite(ts) || ts <= 0) return false;
      return now - lastSeen(torrent, map) > limitOf(torrent, rule);
    }

    /* Хэши на удаление, самые давние первыми, не больше MAX_PER_RUN. */
    function plan(list, map, now, current, rule) {
      if (!Array.isArray(list)) return [];
      var picked = [];
      for (var i = 0; i < list.length; i++) {
        if (removable(list[i], map, now, current || '', rule)) picked.push([hashOf(list[i].hash), lastSeen(list[i], map)]);
      }
      picked.sort(function (a, b) { return a[1] - b[1]; });
      var out = [];
      for (var j = 0; j < picked.length && out.length < MAX_PER_RUN; j++) {
        if (out.indexOf(picked[j][0]) === -1) out.push(picked[j][0]);
      }
      return out;
    }

    /* Срок из пункта lumen_tsclean_days ('1' / '3' / '7'), мс; иное — сутки. */
    function idleOf(v) {
      var s = str(v);
      return DAYS.indexOf(s) === -1 ? MAX_IDLE : Number(s) * DAY;
    }

    /* { 'tv:<id>': true } по спискам карточек — только сериалы (у фильма
       своей защиты нет: он смотрится за раз). */
    function keepOf(lists) {
      var out = {};
      for (var i = 0; lists && i < lists.length; i++) {
        var arr = lists[i];
        for (var j = 0; Array.isArray(arr) && j < arr.length; j++) {
          var ck = cardKey(arr[j]);
          if (ck.indexOf('tv:') === 0) out[ck] = true;
        }
      }
      return out;
    }

    /* Самая поздняя запись карты, мс (0 — записей нет). */
    function latest(map) {
      var max = 0;
      for (var k in (map || {})) {
        if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
        var t = Number(map[k]);
        if (isFinite(t) && t > max) max = t;
      }
      return max;
    }

    /* Часам можно верить: не раньше MIN_CLOCK и не раньше самой поздней
       записи карты (с запасом) — иначе часы ушли назад. */
    function clockOk(now, map) {
      if (!isFinite(now) || now < MIN_CLOCK) return false;
      return now >= latest(map) - CLOCK_SLACK;
    }

    /* Карта без записей о раздачах, которых в TorrServer уже нет (и без
       удалённых этим проходом), и без записей старше суток. Записи по
       карточке живут, пока в списке есть раздача того же фильма. */
    function prune(map, list, now, removed) {
      var hashes = {};
      var cards = {};
      var gone = {};
      var i;
      for (i = 0; removed && i < removed.length; i++) gone[removed[i]] = true;
      for (i = 0; Array.isArray(list) && i < list.length; i++) {
        var h = hashOf(list[i] && list[i].hash);
        if (!h || gone[h]) continue;
        hashes['h:' + h] = true;
        var ck = cardKey(movieOf(list[i]));
        if (ck) cards['m:' + ck] = true;
      }
      var kept = {};
      for (var k in (map || {})) {
        if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
        if (!hashes[k] && !cards[k]) continue;
        kept[k] = map[k];
      }
      return touch(kept, [], now);
    }

    /* Посев: каждая раздача списка — «открыта сейчас» (по хэшу), карта —
       без раздач, которых в списке нет. */
    function seed(map, list, now) {
      var keys = [];
      for (var i = 0; Array.isArray(list) && i < list.length; i++) {
        var h = hashOf(list[i] && list[i].hash);
        if (h) keys.push('h:' + h);
      }
      return prune(touch(map, keys, now), list, now, []);
    }

    /* ------------------------------ рантайм ----------------------------- */

    var _on = false;
    var _timer = null;
    var _running = false;
    var _current = '';
    var _net = null;

    function now() {
      var hook = api._now;
      return typeof hook === 'function' ? hook() : Date.now();
    }

    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      clearTimeout(id);
    }

    function enabled() {
      try { return !!LC.pref('lumen_tsclean', false); } catch (e) { return false; }
    }

    /* Лог — только при включённом «Показать FPS»: недоступный TorrServer
       (у многих его нет вовсе) — штатное состояние, а не ошибка. */
    function log(msg, err) {
      var debug = false;
      try { debug = !!LC.pref('lumen_debug_hud', false); } catch (e) { }
      if (debug) warn('tsclean: ' + msg, err);
    }

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    function load() {
      var st = storage();
      if (!st) return {};
      try {
        var v = st.get(KEY, '');
        if (typeof v === 'string') v = v ? JSON.parse(v) : null;
        return v && typeof v === 'object' ? v : {};
      } catch (e) {
        return {};
      }
    }

    /* Карта есть и читается. Ключа нет — модуль ещё ни разу не работал на
       этом устройстве; значение испорчено (не JSON-объект) — запуски
       неизвестны так же: оба случая — посевной проход. Пустой объект —
       карта есть (проход всё удалил). */
    function mapExists() {
      var st = storage();
      if (!st) return false;
      try {
        var v = st.get(KEY, '');
        if (typeof v === 'string') v = v ? JSON.parse(v) : null;
        return !!(v && typeof v === 'object' && !Array.isArray(v));
      } catch (e) {
        return false;
      }
    }

    function seedPending() {
      var st = storage();
      if (!st) return false;
      try { return !!st.get(SEED_KEY, ''); } catch (e) { return false; }
    }

    function setSeed(on) {
      var st = storage();
      if (!st || typeof st.set !== 'function') return;
      try { st.set(SEED_KEY, on ? '1' : '', true); } catch (e) { log('seed failed', e); }
    }

    /* Своя запись — без события 'change' (nolisten), как у «Вернуться к
       просмотру» и «Что нового». */
    function save(map) {
      var st = storage();
      if (!st || typeof st.set !== 'function') return;
      try { st.set(KEY, map, true); } catch (e) { log('save failed', e); }
    }

    function remember(keys) {
      var list = [];
      for (var i = 0; i < keys.length; i++) if (keys[i]) list.push(keys[i]);
      if (!list.length) return;
      var t = now();
      /* Часы неверные — время запуска записать нечем; следующий проход с
         верными часами будет посевным (ничего не удалит). */
      if (!isFinite(t) || t < MIN_CLOCK) { setSeed(true); return; }
      save(touch(load(), list, t));
    }

    function activeCard() {
      try {
        var a = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        return a ? (a.card || a.movie || null) : null;
      } catch (e) {
        return null;
      }
    }

    /* Player 'create' (src/71_resume.js, onCreate): данные запуска. Не
       торрент (онлайн, трейлер, IPTV) — не про нас. */
    function onPlay(data) {
      try {
        if (!data || typeof data !== 'object') return;
        var hash = hashOf(data.torrent_hash) || hashOf(data.url);
        if (!hash) return;
        _current = hash;
        var ck = cardKey(data.card || data.movie || activeCard());
        remember(['h:' + hash, ck ? 'm:' + ck : '']);
      } catch (e) {
        log('play failed', e);
      }
    }

    /* Player 'destroy': плеер Lampa закрыт — раздача больше не «в плеере». */
    function onStop() {
      _current = '';
    }

    /* Listener 'torrent' onenter (src/71_resume.js, onTorrent): раздачу
       открыли — у приложения TorrServe это и есть запуск. */
    function onTorrent(element, card) {
      try {
        if (!element || typeof element !== 'object') return;
        var hash = hashOf(element.hash) || hashOf(element.MagnetUri) || hashOf(element.Link);
        var ck = cardKey(card);
        remember([hash ? 'h:' + hash : '', ck ? 'm:' + ck : '']);
      } catch (e) {
        log('torrent failed', e);
      }
    }

    /* Режим приложения TorrServe на Android: Lampa отдаёт раздачи ему,
       а не серверу из настроек. */
    function appMode() {
      try {
        return !!(window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function' && Lampa.Platform.is('android') &&
          Lampa.Storage && typeof Lampa.Storage.field === 'function' && !Lampa.Storage.field('internal_torrclient'));
      } catch (e) {
        return false;
      }
    }

    /* Адрес TorrServer, куда Lampa кладёт раздачи; '' — его нет. */
    function server() {
      try {
        if (!window.Lampa) return '';
        if (appMode()) return APP_URL;
        var u = Lampa.Torserver && typeof Lampa.Torserver.url === 'function' ? Lampa.Torserver.url() : '';
        return str(u).replace(/\/+$/, '');
      } catch (e) {
        return '';
      }
    }

    function net() {
      if (_net) return _net;
      var make = api._net;
      if (typeof make === 'function') _net = make();
      else if (window.Lampa && typeof Lampa.Reguest === 'function') _net = new Lampa.Reguest();
      return _net;
    }

    function playerOpen() {
      try { return !!(LC.util && LC.util.playerOpen && LC.util.playerOpen()); } catch (e) { return false; }
    }

    function idleMs() {
      try { return idleOf(LC.pref('lumen_tsclean_days', '1')); } catch (e) { return MAX_IDLE; }
    }

    /* Сериалы под защитой: «Досмотреть» (Favorite.continues 'tv' и
       'anime' — Lampa делит их, app.min.js continues) и первые RECENT
       записей истории. Без сети: всё из памяти Lampa. */
    function protectedSet() {
      var lists = [];
      try {
        var fav = window.Lampa && Lampa.Favorite;
        if (!fav) return {};
        if (typeof fav.continues === 'function') {
          lists.push(fav.continues('tv'));
          lists.push(fav.continues('anime'));
        }
        if (typeof fav.get === 'function') {
          var h = fav.get({ type: 'history' });
          if (Array.isArray(h)) lists.push(h.slice(0, RECENT));
        }
      } catch (e) {
        log('favorite failed', e);
      }
      return keepOf(lists);
    }

    /* Один проход: список → план → удаления по одному. done(n, seeded) —
       сколько удалено (null — проход не состоялся; seeded — проход был
       посевным). force — «Очистить сейчас»: проход и при выключенной
       автоочистке (все остальные защиты те же). */
    function run(done, force) {
      var on = function () { return _on && (force || enabled()); };
      var finish = function (n, seeded) {
        _running = false;
        if (typeof done === 'function') { try { done(n, !!seeded); } catch (e) { } }
      };
      if (_running || !_on) { if (typeof done === 'function') done(null); return; }
      var url = server();
      var n0 = net();
      if (!url || !n0 || typeof n0.silent !== 'function') { if (typeof done === 'function') done(null); return; }
      _running = true;
      try {
        if (typeof n0.timeout === 'function') n0.timeout(LIST_TIMEOUT);
        n0.silent(url + '/torrents', function (list) {
          if (!on() || !Array.isArray(list)) { finish(null); return; }
          var t = now();
          /* Неверные часы — ни посева, ни удалений: всё выглядело бы
             давним (или посев записал бы бессмысленное время). */
          if (!clockOk(t, load())) {
            log('clock looks wrong, pass skipped');
            finish(null);
            return;
          }
          /* Посевной проход: пункт только что включили (впервые или после
             перерыва — запуски за это время не записаны, если плагин был
             выключен) или карты нет вовсе. Всё, что сейчас лежит в
             TorrServer, считается открытым сейчас, и ничего не удаляется;
             дальше — обычное правило суток. Иначе первый проход снёс бы
             всё, что добавлено больше суток назад, включая сериал, который
             смотрят прямо сейчас. */
          /* Раздач больше CAP — карта не вместила бы все их запуски, и
             часть «открытых» выглядела бы неоткрытой. Такой проход только
             сеет (что вмещается) и ничего не удаляет. */
          if (seedPending() || !mapExists() || list.length > CAP) {
            save(seed(load(), list, t));
            if (list.length <= CAP) setSeed(false);
            log((list.length > CAP ? 'too many torrents, seeded only ' : 'seeded ') + list.length);
            finish(0, true);
            return;
          }
          /* Срок и защита — один раз на проход. */
          var rule = { idle: idleMs(), keep: protectedSet() };
          var byHash = {};
          for (var i = 0; i < list.length; i++) {
            var h = hashOf(list[i] && list[i].hash);
            if (h && !byHash[h]) byHash[h] = list[i];
          }
          var queue = plan(list, load(), t, _current, rule);
          var removed = [];
          var next = function () {
            /* Остановка: плагин или пункт выключили, пункт включили заново
               (seedPending — ждёт посев, старый план недействителен), открыли
               плеер. */
            if (!on() || seedPending() || playerOpen() || !queue.length) {
              save(prune(load(), list, now(), removed));
              if (removed.length) log('removed ' + removed.length);
              finish(removed.length);
              return;
            }
            var hash = queue.shift();
            /* План составлен до первого удаления, а удаления идут по одному:
               раздачу могли открыть за это время (у приложения TorrServe это
               только запись карты, без _current). Каждую — перепроверить по
               свежей карте и свежим часам. */
            var tnow = now();
            var fresh = load();
            if (!clockOk(tnow, fresh) || !removable(byHash[hash], fresh, tnow, _current, rule)) { next(); return; }
            if (typeof n0.timeout === 'function') n0.timeout(REM_TIMEOUT);
            n0.silent(url + '/torrents', function () {
              removed.push(hash);
              next();
            }, function (a, c) {
              log('rem failed ' + hash, c);
              next();
            }, JSON.stringify({ action: 'rem', hash: hash }), { dataType: 'text' });
          };
          next();
        }, function (a, c) {
          log('list failed', c);
          finish(null);
        }, JSON.stringify({ action: 'list' }));
      } catch (e) {
        log('run failed', e);
        finish(null);
      }
    }

    function stopTimer() {
      clearT(_timer);
      _timer = null;
    }

    function wait(ms) {
      stopTimer();
      _timer = setT(tick, ms);
    }

    function tick() {
      _timer = null;
      if (!_on || !enabled()) return;
      if (playerOpen()) { wait(PLAYER_RETRY); return; }
      /* Плеер Lampa закрыт: 'destroy' мог и не прийти (внешний плеер) —
         раздачу из него защищает уже время запуска, а не «в плеере». */
      _current = '';
      wait(PERIOD);
      run();
    }

    /* activate(): первый проход — через 30 с. Выключенный пункт таймера
       не держит; включат в настройках — apply(). */
    function install() {
      _on = true;
      if (enabled() && !_timer) wait(FIRST_DELAY);
    }

    /* Плагин выключен: подписки «Вернуться к просмотру» сняты, и запуски
       раздач не записываются. Следующий проход после включения плагина —
       посевной, иначе раздачи, которые смотрели в это время, ушли бы.
       Зовётся из deactivate (через uninstall) и из LC.init, если Lampa
       стартовала с выключенным плагином. Пометка — в Storage: включить
       плагин могут и после перезапуска Lampa. */
    function markOff() {
      setSeed(true);
    }

    function uninstall() {
      markOff();
      _on = false;
      stopTimer();
      _current = '';
      try { if (_net && typeof _net.clear === 'function') _net.clear(); } catch (e) { }
      _running = false;
    }

    /* Пункт переключили: включили — первый проход через 30 с (не посреди
       раздела настроек), выключили — таймер снят, начатый проход
       останавливается перед следующим удалением. */
    function apply() {
      /* Включение — до проверки _on: пункт могут включить и при
         выключенном плагине. Lampa шлёт 'change' только на смену значения,
         так что enabled() здесь — переход выкл → вкл. */
      if (enabled()) setSeed(true);
      if (!_on) return;
      if (enabled()) { if (!_timer) wait(FIRST_DELAY); }
      else stopTimer();
    }

    function noty(text) {
      try {
        if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(text);
      } catch (e) { }
    }

    /* Пункт «Очистить сейчас»: один проход немедленно (и при выключенной
       автоочистке) и Noty с итогом: сколько удалено; посевной проход —
       «запомнены, удалять нечего»; не состоялся — сервер недоступен или
       занят. */
    function word(key) {
      try { return typeof LC.lang === 'function' ? str(LC.lang(key)) : key; } catch (e) { return key; }
    }

    function runNow() {
      run(function (n, seeded) {
        var text;
        if (n === null) text = word('lumen_tsclean_now_fail');
        else if (seeded) text = word('lumen_tsclean_now_seeded');
        else text = word('lumen_tsclean_now_done').replace('{n}', n);
        noty(text);
      }, true);
    }

    var api = {
      KEY: KEY,
      PROTECT: PROTECT,
      KEEP: KEEP,
      RECENT: RECENT,
      idleOf: idleOf,
      keepOf: keepOf,
      protectedSet: protectedSet,
      runNow: runNow,
      SEED_KEY: SEED_KEY,
      MAX_IDLE: MAX_IDLE,
      FIRST_DELAY: FIRST_DELAY,
      PERIOD: PERIOD,
      PLAYER_RETRY: PLAYER_RETRY,
      MAX_PER_RUN: MAX_PER_RUN,
      CAP: CAP,
      APP_URL: APP_URL,
      hashOf: hashOf,
      cardKey: cardKey,
      movieOf: movieOf,
      touch: touch,
      lastSeen: lastSeen,
      removable: removable,
      plan: plan,
      prune: prune,
      seed: seed,
      clockOk: clockOk,
      MIN_CLOCK: MIN_CLOCK,
      markOff: markOff,
      server: server,
      appMode: appMode,
      install: install,
      uninstall: uninstall,
      apply: apply,
      run: run,
      onPlay: onPlay,
      onStop: onStop,
      onTorrent: onTorrent,
      current: function () { return _current; },
      pending: function () { return !!_timer; },
      _now: null,
      _timers: null,
      _net: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.tsclean;

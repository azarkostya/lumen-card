  /* -------------------------------------------------------------------- */
  /* 1.3: «Вернуться к просмотру» после перезапуска Lampa.                 */
  /*                                                                       */
  /* Жалоба с ТВ (Philips 50PUS8057, 2 ГБ): после серии во внешнем плеере  */
  /* Lampa открывается на главной — Android убил её процесс, пока шёл      */
  /* плеер, и при новом запуске место потеряно (исследование              */
  /* scratchpad r6/torrent и r6/resume). Модуль помнит последнее, что      */
  /* ушло в плеер, и при холодном старте предлагает вернуться.            */
  /*                                                                       */
  /* Два режима торрент-клиента Lampa на Android:                          */
  /*   - встроенный (internal_torrclient=true): список файлов Lampa →      */
  /*     Player.play → 'create' → Android.openPlayer → 'external'. Lampa   */
  /*     знает файл (url TorrServer с ?link=<hash>&index=N), серию и хэш   */
  /*     таймкода — «Продолжить» запускает тот же файл с того же места;   */
  /*   - приложение TorrServe (по умолчанию): Torrent.start →              */
  /*     Android.openTorrent, Player не зовётся вовсе. Lampa знает только  */
  /*     раздачу (magnet из Listener 'torrent' onenter) — «Открыть раздачу */
  /*     снова», серию и место человек выбирает в TorrServe.               */
  /* Онлайн-источники: ссылки подписаны и истекают — только «Открыть       */
  /* карточку».                                                            */
  /*                                                                       */
  /* Окно — только при холодном старте (LC.init = новая загрузка страницы; */
  /* при живом возврате из фона Lampa сама стоит там, где её оставили),   */
  /* не поверх плеера и чужих окон, не одновременно с «Что нового»        */
  /* (src/82_whatsnew.js ждёт, пока busy()). В детском режиме — только    */
  /* для карточки, которую пропускает фильтр рядов (LC.kids.strict).       */
  /*                                                                       */
  /* Счётчики перезапусков (lumen_resume_stats) пишутся всегда, и при     */
  /* выключенном пункте: HUD показывает «boot#N · ext M мин назад ·        */
  /* cold/ext a/b» (src/69_hud.js) — сколько холодных стартов пришлось на  */
  /* уходы во внешний плеер.                                               */
  /*                                                                       */
  /* Сеть модуль не трогает: только localStorage через Lampa.Storage.       */
  /*                                                                       */
  /* Чистые функции (без window/Lampa/DOM): capture, fromTorrent, advance, */
  /* decide, trim, buildPlay, clock, episodeText, statsText, bootStats.    */
  /* Рантайм: boot() — в LC.init; install()/uninstall() — activate/        */
  /* deactivate; schedule(ready)/cancel(); onTimeline(data), onActivity(e);*/
  /* busy(), menuItem(card), raise(items), resumeNow(), stats().           */
  /* -------------------------------------------------------------------- */

  LC.resume = (function () {

    var KEY = 'lumen_resume';
    var STATS_KEY = 'lumen_resume_stats';
    var HOUR = 3600000;
    var TTLS = [2, 6, 12, 24];
    var TTL_DEFAULT = 6;
    /* Досмотр — тот же порог, что у прогресса сериала (src/70_progress.js). */
    var WATCHED = 95;
    /* Окно плейлиста вокруг текущей серии: запись ≤ ~6 КБ даже у сезона
       из 24 серий с длинными путями. */
    var WINDOW = 8;
    /* Холодный старт позже этого срока после ухода в плеер — уже не
       «перезапуск во время плеера», а просто новый запуск. */
    var COLD_GAP = 2 * HOUR;
    var FIRST_DELAY = 2000;
    var RETRY_DELAY = 2000;
    var TRIES = 15;

    /* ------------------------------ чистое ------------------------------ */

    function num(v) {
      var n = Number(v);
      return isFinite(n) ? n : 0;
    }

    function str(v) {
      return (v === null || typeof v === 'undefined') ? '' : ('' + v);
    }

    /* Названия файлов и серий приходят с разметкой (Lampa сама чистит их
       Utils.clearHtmlTags перед внешним плеером). */
    function plain(v) {
      return str(v).replace(/<[^>]*>?/g, '').replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
    }

    function indexOf(url) {
      var m = /[?&]index=(\d+)/.exec(str(url));
      return m ? +m[1] : -1;
    }

    /* Карточка — только поля для «Открыть карточку», заголовка, постера
       ряда и фильтра детского режима (genre_ids): без описаний и прочего
       веса, который Lampa тащит в данных плеера. */
    var CARD_FIELDS = ['id', 'source', 'name', 'title', 'original_name', 'original_title', 'poster_path',
      'backdrop_path', 'first_air_date', 'release_date', 'runtime', 'number_of_seasons', 'vote_average', 'img', 'adult'];

    function cardOf(card) {
      if (!card || typeof card !== 'object' || card.id === null || typeof card.id === 'undefined' || card.id === '') return null;
      var out = {};
      for (var i = 0; i < CARD_FIELDS.length; i++) {
        var v = card[CARD_FIELDS[i]];
        if (v === null || typeof v === 'undefined' || typeof v === 'function' || typeof v === 'object') continue;
        out[CARD_FIELDS[i]] = v;
      }
      var genres = [];
      var j;
      if (Array.isArray(card.genre_ids)) {
        for (j = 0; j < card.genre_ids.length; j++) genres.push(num(card.genre_ids[j]));
      } else if (Array.isArray(card.genres)) {
        for (j = 0; j < card.genres.length; j++) if (card.genres[j] && card.genres[j].id !== undefined) genres.push(num(card.genres[j].id));
      }
      out.genre_ids = genres;
      return out;
    }

    function tlOf(t) {
      if (!t || typeof t !== 'object' || !t.hash) return null;
      return { hash: str(t.hash), percent: num(t.percent), time: num(t.time), duration: num(t.duration) };
    }

    /* Элемент плейлиста. Для онлайн-источника ссылку не храним вовсе:
       подписанная и истекающая, она ни на что не годится, а лишнее в
       localStorage не нужно. */
    function itemOf(p, online) {
      var tl = tlOf(p && p.timeline);
      var out = {
        title: plain(p && p.title),
        tl_hash: tl ? tl.hash : '',
        season: num(p && p.season),
        episode: num(p && p.episode)
      };
      if (!online) out.url = str(p && p.url);
      return out;
    }

    /* Окно ±WINDOW вокруг текущего элемента: { list, cur } — cur — его
       индекс в окне. */
    function trim(list, cur) {
      if (!Array.isArray(list) || !list.length) return { list: [], cur: -1 };
      if (cur < 0 || cur >= list.length) cur = 0;
      var from = Math.max(0, cur - WINDOW);
      var to = Math.min(list.length, cur + WINDOW + 1);
      return { list: list.slice(from, to), cur: cur - from };
    }

    function findCurrent(list, tlHash, url) {
      var i;
      if (tlHash) for (i = 0; i < list.length; i++) if (list[i].tl_hash === tlHash) return i;
      if (url) for (i = 0; i < list.length; i++) if (list[i].url && list[i].url === url) return i;
      return -1;
    }

    /* data — данные плеера ('create'/'start' — e.data, 'external' — сам
       объект), mode — 'pending' | 'external' | 'inner', card — карточка
       (data.card, иначе активность), extra — { torrent } раздача из
       Listener 'torrent', если она про эту же карточку. null — записывать
       нечего: трейлер, IPTV, нет ни таймкода, ни раздачи, нет карточки. */
    function capture(data, mode, now, card, extra) {
      if (!data || typeof data !== 'object') return null;
      if (data.youtube || data.iptv || data.tv) return null;
      var tl = tlOf(data.timeline);
      var torrent = !!data.torrent_hash;
      if (!tl && !torrent) return null;
      var c = cardOf(data.card || data.movie || card);
      if (!c) return null;
      var online = !torrent;
      var rec = {
        v: 1, at: now, kind: online ? 'online' : 'torrent', mode: mode || 'pending',
        url: online ? '' : str(data.url),
        torrent_hash: online ? '' : str(data.torrent_hash),
        index: online ? -1 : indexOf(data.url),
        title: plain(data.title),
        card: c,
        season: num(data.season), episode: num(data.episode),
        tl_hash: tl ? tl.hash : '', percent: tl ? tl.percent : 0, time: tl ? tl.time : 0, duration: tl ? tl.duration : 0,
        playlist: [], cur: -1,
        subtitles: [],
        torrent: (extra && extra.torrent) || null,
        shown: false, settled: false, returned: false, hidden_at: 0
      };
      var subs = Array.isArray(data.subtitles) ? data.subtitles : [];
      for (var s = 0; s < subs.length && s < 6 && !online; s++) {
        if (subs[s] && subs[s].url) rec.subtitles.push({ label: plain(subs[s].label), url: str(subs[s].url) });
      }
      if (Array.isArray(data.playlist) && data.playlist.length) {
        var all = [];
        for (var i = 0; i < data.playlist.length; i++) {
          var p = data.playlist[i];
          if (!p || typeof p !== 'object') continue;
          if (!online && typeof p.url !== 'string') continue;
          all.push(itemOf(p, online));
        }
        var at = findCurrent(all, rec.tl_hash, rec.url);
        if (at >= 0) {
          var w = trim(all, at);
          rec.playlist = w.list;
          rec.cur = w.cur;
        }
      }
      return rec;
    }

    /* Режим приложения TorrServe: Player не зовётся, известна только
       раздача. element — объект раздачи из Listener 'torrent' (MagnetUri
       или Link — то же, что берёт Android.openTorrent). */
    function torrentOf(element) {
      if (!element || typeof element !== 'object') return null;
      var magnet = str(element.MagnetUri || element.Link);
      if (!magnet) return null;
      return { magnet: magnet, title: plain(element.title || element.Title), poster: str(element.poster) };
    }

    function fromTorrent(element, card, now) {
      var t = torrentOf(element);
      var c = cardOf(card);
      if (!t || !c) return null;
      return {
        v: 1, at: now, kind: 'torrent-app', mode: 'external',
        url: '', torrent_hash: '', index: -1, title: t.title, card: c,
        season: 0, episode: 0, tl_hash: '', percent: 0, time: 0, duration: 0,
        playlist: [], cur: -1, subtitles: [], torrent: t,
        shown: false, settled: false, returned: false, hidden_at: 0
      };
    }

    /* TMDB нумерует фильмы и сериалы независимо: один id бывает у обоих. */
    function isTv(c) {
      return !!(c && (c.name || c.original_name || c.first_air_date));
    }

    function sameCard(a, b) {
      return !!(a && b && String(a.id) === String(b.id) && isTv(a) === isTv(b));
    }

    function valid(rec) {
      return !!(rec && typeof rec === 'object' && rec.v === 1 && rec.card && rec.card.id !== undefined &&
        (rec.kind === 'torrent' || rec.kind === 'online' || rec.kind === 'torrent-app') && num(rec.at) > 0);
    }

    function copy(rec) {
      try { return JSON.parse(JSON.stringify(rec)); } catch (e) { return null; }
    }

    /* Запись таймкода (Timeline 'update' — плеер Lampa или клиент Android
       после внешнего плеера). Возвращает { rec, change }: change — ''
       (не про нас), 'update', 'next' (досмотрено, дальше следующая серия),
       'drop' (досмотрено, а дальше ничего — запись удаляется, rec: null).
       Хэш другой серии того же плейлиста — внешний плеер сам перешёл на
       неё: текущей становится она. */
    function advance(rec, upd, now) {
      if (!valid(rec) || !upd || !upd.hash || rec.kind === 'torrent-app') return { rec: rec, change: '' };
      var out = copy(rec);
      var hash = str(upd.hash);
      if (hash !== out.tl_hash) {
        var j = -1;
        for (var i = 0; i < out.playlist.length; i++) if (out.playlist[i].tl_hash === hash) j = i;
        if (j < 0) return { rec: rec, change: '' };
        moveTo(out, j);
      }
      out.percent = num(upd.percent);
      out.time = num(upd.time);
      if (num(upd.duration) > 0) out.duration = num(upd.duration);
      if (now) out.at = now;
      if (out.percent < WATCHED) return { rec: out, change: 'update' };
      var next = out.cur >= 0 ? out.cur + 1 : -1;
      if (next < 0 || next >= out.playlist.length) return { rec: null, change: 'drop' };
      moveTo(out, next);
      out.percent = 0;
      out.time = 0;
      out.duration = 0;
      out.shown = false;
      return { rec: out, change: 'next' };
    }

    function moveTo(rec, j) {
      var p = rec.playlist[j];
      rec.cur = j;
      rec.tl_hash = p.tl_hash;
      rec.title = p.title;
      rec.season = p.season;
      rec.episode = p.episode;
      if (p.url) {
        rec.url = p.url;
        rec.index = indexOf(p.url);
      }
      /* Внешние субтитры относились к прежнему файлу. */
      rec.subtitles = [];
      rec.percent = 0;
      rec.time = 0;
    }

    /* opts: { ttl (мс), enabled, kidsOk(card) → bool }. 'expire' — запись
       битая или старше срока (удаляется), 'skip' — хранится, но окна нет,
       'show'. */
    function decide(rec, now, opts) {
      opts = opts || {};
      if (!valid(rec)) return 'expire';
      var ttl = num(opts.ttl) || TTL_DEFAULT * HOUR;
      var age = now - num(rec.at);
      if (age > ttl || age < -HOUR) return 'expire';
      if (opts.enabled === false) return 'skip';
      if (rec.shown || rec.settled || rec.returned) return 'skip';
      if (rec.kind !== 'torrent-app' && num(rec.percent) >= WATCHED) return 'skip';
      if (typeof opts.kidsOk === 'function' && !opts.kidsOk(rec.card)) return 'skip';
      return 'show';
    }

    /* Данные для Lampa.Player.play: сохранённые поля плюс свежий
       Timeline.view (с handler — в localStorage он не живёт; позицию из
       timeline.time Lampa передаст плееру сама). view(hash) → объект. */
    function buildPlay(rec, view) {
      if (!valid(rec) || rec.kind !== 'torrent' || !rec.url) return null;
      function tl(hash) {
        try { return hash && typeof view === 'function' ? view(hash) : null; } catch (e) { return null; }
      }
      var data = {
        url: rec.url, title: rec.title, torrent_hash: rec.torrent_hash, card: rec.card,
        season: rec.season, episode: rec.episode, first_title: rec.card.name || rec.card.title || ''
      };
      var t = tl(rec.tl_hash);
      if (t) data.timeline = t;
      if (rec.subtitles && rec.subtitles.length) data.subtitles = rec.subtitles.slice();
      var list = [];
      for (var i = 0; i < rec.playlist.length; i++) {
        var p = rec.playlist[i];
        if (!p.url) continue;
        var item = { url: p.url, title: p.title, torrent_hash: rec.torrent_hash, card: rec.card, season: p.season, episode: p.episode };
        var pt = i === rec.cur ? t : tl(p.tl_hash);
        if (pt) item.timeline = pt;
        list.push(item);
      }
      if (list.length) data.playlist = list;
      return data;
    }

    /* 23:10, 1:48:00. */
    function clock(sec) {
      sec = Math.max(0, Math.floor(num(sec)));
      var h = Math.floor(sec / 3600);
      var m = Math.floor((sec % 3600) / 60);
      var s = sec % 60;
      var mm = h ? (m < 10 ? '0' : '') + m : '' + m;
      return (h ? h + ':' : '') + mm + ':' + (s < 10 ? '0' : '') + s;
    }

    /* «S2 E5 · 23:10 из 48:00» — что и откуда продолжим; of — «из». */
    function episodeText(rec, of) {
      var parts = [];
      if (num(rec.season) > 0 && num(rec.episode) > 0) parts.push('S' + rec.season + ' E' + rec.episode);
      if (num(rec.time) > 0) parts.push(clock(rec.time) + (num(rec.duration) > 0 ? ' ' + (of || '/') + ' ' + clock(rec.duration) : ''));
      return parts.join(' · ');
    }

    /* Счётчики перезапусков на холодном старте. prev — прежние счётчики
       (или пусто). cold_after_ext растёт, если последний уход во внешний
       плеер/приложение (ext_open) был не раньше COLD_GAP назад и после
       него страница не возвращалась живой (visible снимает ext_open). */
    function bootStats(prev, now) {
      var s = prev && typeof prev === 'object' ? copy(prev) || {} : {};
      s.boots = num(s.boots) + 1;
      s.ext_n = num(s.ext_n);
      s.cold_after_ext = num(s.cold_after_ext);
      s.ext_at = num(s.ext_at);
      if (s.ext_open && s.ext_at && now - s.ext_at >= 0 && now - s.ext_at < COLD_GAP) {
        s.cold_after_ext++;
        s.last_gap_min = Math.round((now - s.ext_at) / 60000);
      }
      s.ext_open = 0;
      s.boot_at = now;
      return s;
    }

    /* «boot#12 · ext 23 мин назад · cold/ext 3/5» — строка HUD. Больше
       трёх часов — часами: «ext 26 ч назад». */
    function statsText(s, now, words) {
      s = s || {};
      words = words || {};
      var ext = 'ext —';
      if (num(s.ext_at) > 0) {
        var min = Math.max(0, Math.round((now - num(s.ext_at)) / 60000));
        ext = min < 180 ? 'ext ' + min + ' ' + (words.min || 'мин') + ' ' + (words.ago || 'назад')
          : 'ext ' + Math.round(min / 60) + ' ' + (words.hours || 'ч') + ' ' + (words.ago || 'назад');
      }
      return 'boot#' + num(s.boots) + ' · ' + ext + ' · cold/ext ' + num(s.cold_after_ext) + '/' + num(s.ext_n);
    }

    /* ------------------------------ рантайм ----------------------------- */

    var _on = false;
    var _followed = null;
    var _pending = false;
    var _open = false;
    var _timer = null;
    var _tries = 0;
    var _ready = null;
    var _torrent = null;

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

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    function read(key) {
      var st = storage();
      if (!st) return null;
      try {
        var v = st.get(key, '');
        if (typeof v === 'string') v = v ? JSON.parse(v) : null;
        return v && typeof v === 'object' ? copy(v) : null;
      } catch (e) {
        return null;
      }
    }

    /* Своя запись — без события 'change' (nolisten), как служебные ключи
       плана главной и «Что нового». */
    function write(key, value) {
      var st = storage();
      if (!st || typeof st.set !== 'function') return;
      try { st.set(key, value === null ? '' : value, true); } catch (e) { warn('resume write failed', e); }
    }

    function load() {
      var rec = read(KEY);
      return valid(rec) ? rec : null;
    }

    function save(rec) {
      write(KEY, rec);
    }

    function enabled() {
      try { return !!LC.pref('lumen_resume', true); } catch (e) { return true; }
    }

    function ttl() {
      var h = 0;
      try { h = Number(LC.pref('lumen_resume_ttl', '6')); } catch (e) { h = 0; }
      if (TTLS.indexOf(h) === -1) h = TTL_DEFAULT;
      return h * HOUR;
    }

    /* Детский режим: окно, пункт меню и метка — только для карточки,
       которую пропускает фильтр рядов главной (LC.kids.strict — тот же,
       что у «Досмотреть» в детском режиме). Запись хранится: режим могут
       выключить. */
    function kidsOk(card) {
      try {
        if (!LC.kids || typeof LC.kids.enabled !== 'function' || !LC.kids.enabled()) return true;
        return typeof LC.kids.strict === 'function' ? !!LC.kids.strict(card) : false;
      } catch (e) {
        return false;
      }
    }

    function opts() {
      return { ttl: ttl(), enabled: enabled(), kidsOk: kidsOk };
    }

    function stats() {
      return read(STATS_KEY) || {};
    }

    function bumpStats(fn) {
      var s = stats();
      try { fn(s); } catch (e) { }
      write(STATS_KEY, s);
    }

    /* Уход во внешний плеер или приложение TorrServe. */
    function markExt() {
      var t = now();
      bumpStats(function (s) {
        s.ext_at = t;
        s.ext_n = num(s.ext_n) + 1;
        s.ext_open = 1;
      });
    }

    function activeCard() {
      try {
        var a = Lampa.Activity && typeof Lampa.Activity.active === 'function' ? Lampa.Activity.active() : null;
        return a ? (a.card || a.movie || null) : null;
      } catch (e) {
        return null;
      }
    }

    /* Раздача, открытая встроенным клиентом, — та же карточка, и не
       давнее срока записи. Прежняя запись того же торрента свою раздачу
       отдаёт новой. */
    function torrentFor(data, card, prev) {
      var id = card && card.id;
      if (_torrent && id !== undefined && String(_torrent.card_id) === String(id) && now() - _torrent.at < ttl()) {
        return { magnet: _torrent.magnet, title: _torrent.title, poster: _torrent.poster };
      }
      if (prev && prev.torrent && prev.torrent_hash && prev.torrent_hash === str(data.torrent_hash)) return prev.torrent;
      return null;
    }

    function record(data, mode) {
      if (!enabled()) return null;
      var card = data && (data.card || data.movie) ? (data.card || data.movie) : activeCard();
      var prev = load();
      var c = cardOf(card);
      var rec = capture(data, mode, now(), card, { torrent: c ? torrentFor(data, c, prev) : null });
      if (rec) save(rec);
      return rec;
    }

    function onCreate(e) {
      if (!_on) return;
      try { record(e && e.data, 'pending'); } catch (err) { warn('resume create failed', err); }
    }

    function onExternal(data) {
      if (!_on) return;
      try {
        markExt();
        record(data, 'external');
      } catch (err) {
        warn('resume external failed', err);
      }
    }

    function onStart(data) {
      if (!_on) return;
      try { record(data, 'inner'); } catch (err) { warn('resume start failed', err); }
    }

    /* Плеер Lampa закрыли (или внешний запуск отменили): человек ушёл из
       него сам, при живом процессе, — место не потеряно. Окна при
       следующем запуске не будет, запись остаётся для меню и ряда. */
    function onDestroy() {
      if (!_on) return;
      try {
        var rec = load();
        if (rec && rec.mode !== 'external' && !rec.settled) {
          rec.settled = true;
          save(rec);
        }
      } catch (err) {
        warn('resume destroy failed', err);
      }
    }

    function appMode() {
      try {
        return !!(Lampa.Platform && Lampa.Platform.is('android') && !Lampa.Storage.field('internal_torrclient'));
      } catch (e) {
        return false;
      }
    }

    /* Listener 'torrent' onenter: Lampa уже вызвала Torrent.start (у
       приложения TorrServe — Android.openTorrent). Карточка — у активности
       «Торренты» (object.movie). */
    function onTorrent(e) {
      if (!_on || !e || e.type !== 'onenter') return;
      try {
        var card = activeCard();
        var t = torrentOf(e.element);
        if (!t || !card) return;
        _torrent = { magnet: t.magnet, title: t.title, poster: t.poster, card_id: card.id, at: now() };
        if (!appMode()) return;
        markExt();
        if (!enabled()) return;
        var rec = fromTorrent(e.element, card, now());
        if (rec) save(rec);
      } catch (err) {
        warn('resume torrent failed', err);
      }
    }

    /* Страница ушла в фон после внешнего плеера и вернулась живой — место
       не потеряно (Lampa стоит на окне файлов), окна при следующем запуске
       не будет; и холодным стартом «после плеера» следующий запуск уже не
       считается. */
    function onVisibility() {
      if (!_on) return;
      try {
        var hidden = document.visibilityState === 'hidden' || document.hidden === true;
        var t = now();
        var s = stats();
        if (hidden) s.last_hidden = t;
        else {
          s.last_visible = t;
          if (s.ext_open && num(s.last_hidden) >= num(s.ext_at)) s.ext_open = 0;
        }
        write(STATS_KEY, s);
        var rec = load();
        if (!rec || (rec.mode !== 'external' && rec.kind !== 'torrent-app')) return;
        if (hidden) {
          rec.hidden_at = t;
          save(rec);
        } else if (num(rec.hidden_at) >= num(rec.at) && !rec.returned) {
          rec.returned = true;
          save(rec);
        }
      } catch (err) {
        warn('resume visibility failed', err);
      }
    }

    /* Из LC.followTimeline (src/90_runtime.js): одна подписка на Timeline
       на весь плагин. Lampa шлёт { hash, road: { percent, time, duration } }
       (Timeline.update, app.min.js:23874) — позиция лежит в road, не рядом
       с хэшем (стенд 30.09: без этого запись не двигалась вовсе). */
    function onTimeline(data) {
      if (!_on || !data || !data.hash) return;
      try {
        var rec = load();
        if (!rec) return;
        var road = data.road && typeof data.road === 'object' ? data.road : data;
        var r = advance(rec, { hash: data.hash, percent: road.percent, time: road.time, duration: road.duration }, now());
        if (!r.change) return;
        save(r.rec);
      } catch (err) {
        warn('resume timeline failed', err);
      }
    }

    /* Из LC.onActivityEvent: открыл другую карточку — ушёл дальше сам.
       Пока ждёт или открыто окно, первый экран холодного старта (при
       «Стартовая страница: Последняя» это чужая карточка) не в счёт. */
    function onActivity(e) {
      if (!_on || _pending || _open || !e || e.type !== 'start' || e.component !== 'full') return;
      try {
        var o = e.object || {};
        var id = o.id !== undefined && o.id !== null ? o.id : (o.card && o.card.id);
        if (id === undefined || id === null) return;
        var tv = o.method ? o.method === 'tv' : isTv(o.card);
        var rec = load();
        if (!rec || rec.settled || (String(rec.card.id) === String(id) && isTv(rec.card) === tv)) return;
        rec.settled = true;
        save(rec);
      } catch (err) {
        warn('resume activity failed', err);
      }
    }

    function install() {
      if (_on) return;
      _on = true;
      try {
        if (_followed || !window.Lampa) return;
        _followed = { player: false, listener: false, doc: false };
        if (Lampa.Player && Lampa.Player.listener && typeof Lampa.Player.listener.follow === 'function') {
          Lampa.Player.listener.follow('create', onCreate);
          Lampa.Player.listener.follow('external', onExternal);
          Lampa.Player.listener.follow('start', onStart);
          Lampa.Player.listener.follow('destroy', onDestroy);
          _followed.player = true;
        }
        if (Lampa.Listener && typeof Lampa.Listener.follow === 'function') {
          Lampa.Listener.follow('torrent', onTorrent);
          _followed.listener = true;
        }
        if (typeof document !== 'undefined' && document.addEventListener) {
          document.addEventListener('visibilitychange', onVisibility);
          _followed.doc = true;
        }
      } catch (e) {
        warn('resume install failed', e);
      }
    }

    function unfollow(obj, name, fn) {
      try { if (obj && typeof obj.remove === 'function') obj.remove(name, fn); } catch (e) { }
    }

    function uninstall() {
      _on = false;
      cancel();
      if (!_followed) return;
      if (_followed.player) {
        unfollow(Lampa.Player.listener, 'create', onCreate);
        unfollow(Lampa.Player.listener, 'external', onExternal);
        unfollow(Lampa.Player.listener, 'start', onStart);
        unfollow(Lampa.Player.listener, 'destroy', onDestroy);
      }
      if (_followed.listener) unfollow(Lampa.Listener, 'torrent', onTorrent);
      if (_followed.doc) {
        try { document.removeEventListener('visibilitychange', onVisibility); } catch (e) { }
      }
      _followed = null;
    }

    /* LC.init, до activate(): счётчики и решение на этот запуск. Истёкшая
       запись удаляется здесь же. */
    function boot() {
      _pending = false;
      try {
        write(STATS_KEY, bootStats(read(STATS_KEY), now()));
        var rec = read(KEY);
        if (!rec) return false;
        var d = decide(rec, now(), opts());
        if (d === 'expire') { save(null); return false; }
        _pending = d === 'show';
      } catch (e) {
        _pending = false;
        warn('resume boot failed', e);
      }
      return _pending;
    }

    function stopTimer() {
      clearT(_timer);
      _timer = null;
    }

    /* ready() — «первый экран есть, поверх ничего, плеер не открыт»
       (resumeReady, src/90_runtime.js). Мягче, чем у «Что нового»: при
       «Стартовая страница: Последняя» первым будет карточка или «Торренты»,
       и окно нужно и там. */
    function schedule(ready) {
      stopTimer();
      if (!_pending) return;
      _ready = typeof ready === 'function' ? ready : null;
      _tries = 0;
      _timer = setT(tick, FIRST_DELAY);
    }

    function tick() {
      _timer = null;
      if (!_pending) return;
      if (!_on || !enabled()) { _pending = false; return; }
      var ok = false;
      try { ok = !!(_ready && _ready()); } catch (e) { ok = false; }
      if (ok) {
        _pending = false;
        show();
        return;
      }
      _tries++;
      if (_tries >= TRIES) { _pending = false; return; }
      _timer = setT(tick, RETRY_DELAY);
    }

    function cancel() {
      stopTimer();
      _pending = false;
    }

    function lang(key) {
      try { return LC.lang(key); } catch (e) { return key; }
    }

    function nameOf(card) {
      return plain(card && (card.name || card.title || card.original_name || card.original_title));
    }

    /* Позиция — свежая, из Timeline (клиент Android пишет её сам, и уже
       после перезапуска): по ней же видно, досмотрена ли серия. */
    function refresh(rec) {
      if (!rec || rec.kind === 'torrent-app' || !rec.tl_hash) return rec;
      try {
        if (!Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return rec;
        var v = Lampa.Timeline.view(rec.tl_hash);
        if (!v) return rec;
        if (num(v.time) === num(rec.time) && num(v.percent) === num(rec.percent)) return rec;
        if (num(v.time) <= 0 && num(v.percent) <= 0) return rec;
        var r = advance(rec, { hash: rec.tl_hash, percent: v.percent, time: v.time, duration: v.duration }, 0);
        return r.rec;
      } catch (e) {
        return rec;
      }
    }

    function controllerName() {
      try {
        var cur = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (cur && cur.name) return cur.name;
      } catch (e) { }
      return 'content';
    }

    function toggle(name) {
      try { if (Lampa.Controller && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle(name); } catch (e) { }
    }

    /* Пункты окна по виду записи. Названия из TMDB и имена файлов —
       через esc: Select вставляет title/subtitle в разметку сырыми. */
    function items(rec) {
      var esc = LC.util.esc;
      var head = nameOf(rec.card);
      var ep = episodeText(rec, lang('lumen_resume_of'));
      var out = [];
      if (rec.kind === 'torrent') {
        out.push({ title: lang('lumen_resume_continue'), subtitle: esc([head, ep].filter(Boolean).join(' · ')), lumen: 'play' });
        if ((rec.torrent && rec.torrent.magnet) || rec.torrent_hash) {
          out.push({ title: lang('lumen_resume_reopen'), subtitle: esc(lang('lumen_resume_reopen_hint')), lumen: 'reopen' });
        }
      } else if (rec.kind === 'torrent-app') {
        out.push({ title: lang('lumen_resume_reopen'), subtitle: esc([head, lang('lumen_resume_app_hint')].filter(Boolean).join(' · ')), lumen: 'reopen' });
      }
      out.push({ title: lang('lumen_resume_open_card'), subtitle: rec.kind === 'online' ? esc([head, ep].filter(Boolean).join(' · ')) : '', lumen: 'card' });
      out.push({ title: lang('lumen_resume_later'), lumen: 'later' });
      return out;
    }

    function play(rec) {
      var data = buildPlay(rec, function (hash) { return Lampa.Timeline.view(hash); });
      if (!data || !Lampa.Player || typeof Lampa.Player.play !== 'function') return false;
      Lampa.Player.play(data);
      if (data.playlist && typeof Lampa.Player.playlist === 'function') Lampa.Player.playlist(data.playlist);
      return true;
    }

    /* Раздача заново. Приложение TorrServe — Torrent.start уйдёт в
       Android.openTorrent с тем же magnet; встроенный клиент — штатное окно
       файлов (серия с таймкодом там подсвечена), по magnet, а без него —
       по хэшу из базы TorrServer (Torrent.open). */
    function reopen(rec) {
      if (!Lampa.Torrent) return false;
      var t = rec.torrent;
      if (t && t.magnet && typeof Lampa.Torrent.start === 'function') {
        Lampa.Torrent.start({ MagnetUri: t.magnet, Link: t.magnet, title: t.title, Title: t.title, poster: t.poster || rec.card.img || '' }, rec.card);
      } else if (rec.torrent_hash && typeof Lampa.Torrent.open === 'function') {
        Lampa.Torrent.open(rec.torrent_hash, rec.card);
      } else {
        return false;
      }
      if (rec.kind === 'torrent-app') {
        /* Новый сеанс в TorrServe: убьёт Lampa снова — окно снова нужно. */
        var fresh = load();
        if (fresh) {
          fresh.at = now();
          fresh.shown = false;
          fresh.returned = false;
          fresh.hidden_at = 0;
          save(fresh);
        }
        markExt();
      }
      return true;
    }

    function openCard(rec) {
      var c = rec.card;
      Lampa.Activity.push({
        url: '', component: 'full', id: c.id, method: isTv(c) ? 'tv' : 'movie',
        card: c, source: c.source || 'tmdb'
      });
    }

    function run(kind, rec) {
      try {
        if (kind === 'play') return play(rec);
        if (kind === 'reopen') return reopen(rec);
        if (kind === 'card') { openCard(rec); return true; }
      } catch (e) {
        warn('resume action failed: ' + kind, e);
      }
      return false;
    }

    /* Окно. Показанное — shown=true сразу, при любом выборе: второй раз
       этот же обрыв не предлагается. Контроллер снимается до показа и
       возвращается на «Не сейчас» и «Назад»; «Продолжить» и «Открыть…»
       уводят фокус сами (плеер, окно файлов, карточка), им контроллер
       возвращается ДО действия — внешний плеер Lampa фокус не забирает. */
    function show() {
      try {
        if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return false;
        var rec = refresh(load());
        if (!rec) { save(null); return false; }
        if (decide(rec, now(), opts()) !== 'show') { save(rec); return false; }
        rec.shown = true;
        save(rec);
        var back = controllerName();
        var list = items(rec);
        var done = false;
        var finish = function (kind) {
          if (done) return;
          done = true;
          _open = false;
          toggle(back);
          if (kind && kind !== 'later') run(kind, rec);
        };
        for (var i = 0; i < list.length; i++) {
          (function (it) {
            it.onSelect = function () { finish(it.lumen); };
          })(list[i]);
        }
        _open = true;
        Lampa.Select.show({
          lumen_own: true,
          title: lang('lumen_resume_title'),
          items: list,
          onBack: function () { finish('later'); }
        });
        return true;
      } catch (err) {
        _open = false;
        warn('resume show failed', err);
        return false;
      }
    }

    function busy() {
      return _pending || _open;
    }

    /* Запись, к которой можно вернуться из меню карточки и ряда
       «Досмотреть»: живая по сроку, не досмотрена, пункт включён, детский
       фильтр пропускает. shown/settled здесь не мешают — это доступ после
       «Не сейчас». */
    function alive(card) {
      var rec = load();
      if (!rec || !enabled()) return null;
      if (card && !sameCard(card, rec.card)) return null;
      var d = decide(rec, now(), { ttl: ttl(), enabled: true, kidsOk: kidsOk });
      if (d === 'expire') return null;
      if (rec.kind !== 'torrent-app' && num(rec.percent) >= WATCHED) return null;
      if (!kidsOk(rec.card)) return null;
      return rec;
    }

    /* Пункт меню карточки (src/63_cardmenu.js): «Вернуться к просмотру»
       с подписью серии. Онлайн-источнику пункта нет — его «вернуться» и
       есть открыть карточку. */
    function menuItem(card) {
      var rec = alive(card);
      if (!rec || rec.kind === 'online') return null;
      var sub = rec.kind === 'torrent-app' ? lang('lumen_resume_app_hint') : episodeText(rec, lang('lumen_resume_of'));
      return { title: lang('lumen_resume_name'), subtitle: LC.util.esc(sub), lumen: 'resume' };
    }

    /* Действие пункта меню: торрент встроенного клиента — тот же файл с
       того же места, приложение TorrServe — раздача заново. */
    function resumeNow() {
      var rec = alive(null);
      if (!rec) return false;
      return run(rec.kind === 'torrent' ? 'play' : 'reopen', rec);
    }

    /* Ряд «Досмотреть» (src/45_personal.js): карточка записи — первой и с
       меткой «Вернуться». Клик по ней штатный — открывает карточку. Нет её
       в ряду — ряд не меняется. items — уже копии (markContinue). */
    function raise(list) {
      if (!Array.isArray(list) || !list.length) return list;
      var rec = alive(null);
      if (!rec) return list;
      var at = -1;
      for (var i = 0; i < list.length; i++) {
        if (sameCard(list[i], rec.card)) { at = i; break; }
      }
      if (at < 0) return list;
      var out = list.slice();
      var card = out.splice(at, 1)[0];
      card.lumen_badge = lang('lumen_resume_badge');
      out.unshift(card);
      return out;
    }

    function statsLine() {
      return statsText(stats(), now(), { min: lang('lumen_resume_min'), hours: lang('lumen_resume_hours'), ago: lang('lumen_resume_ago') });
    }

    var api = {
      KEY: KEY,
      STATS_KEY: STATS_KEY,
      WATCHED: WATCHED,
      WINDOW: WINDOW,
      FIRST_DELAY: FIRST_DELAY,
      RETRY_DELAY: RETRY_DELAY,
      TRIES: TRIES,
      capture: capture,
      fromTorrent: fromTorrent,
      advance: advance,
      decide: decide,
      trim: trim,
      buildPlay: buildPlay,
      clock: clock,
      episodeText: episodeText,
      bootStats: bootStats,
      statsText: statsText,
      boot: boot,
      install: install,
      uninstall: uninstall,
      schedule: schedule,
      cancel: cancel,
      show: show,
      busy: busy,
      pending: function () { return _pending; },
      onTimeline: onTimeline,
      onActivity: onActivity,
      menuItem: menuItem,
      resumeNow: resumeNow,
      raise: raise,
      stats: stats,
      statsLine: statsLine,
      record: function () { return load(); },
      _timers: null,
      _now: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.resume;

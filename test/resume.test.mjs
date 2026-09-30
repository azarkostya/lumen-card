import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCtx } from './_load.mjs';

/* 1.3: «Вернуться к просмотру» после перезапуска Lampa (src/71_resume.js).
   Чистая часть — запись из данных плеера и раздачи, досмотр и следующая
   серия, решение о показе, данные повторного запуска, счётчики HUD;
   рантайм — подписки, окно Lampa.Select, меню карточки, ряд «Досмотреть»
   с фейковой Lampa и подменными таймерами. */

globalThis.warn = function () { };

function strings() {
  const LC = {};
  new Function('LC', 'module', readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8'))(LC, { exports: null, lumen: true });
  return LC.STRINGS;
}
const STR = strings();

const HASH = 'aabbccddeeff00112233445566778899aabbccdd';
const HOUR = 3600000;
const T0 = 1790000000000;

function stream(ep, mode) {
  return 'http://192.168.1.5:8090/stream/Show.S02E' + (ep < 10 ? '0' : '') + ep + '.mkv?link=' + HASH + '&index=' + ep + '&' + (mode || 'play');
}

const SHOW = { id: 1399, name: 'Игра престолов', original_name: 'Game of Thrones', first_air_date: '2011-04-17', poster_path: '/x.jpg',
  source: 'tmdb', overview: 'длинное описание'.repeat(50), genres: [{ id: 18 }, { id: 10765 }], seasons: [{ a: 1 }], number_of_seasons: 8 };

/* Данные, какими их отдаёт окно файлов Lampa (list$1): url TorrServer,
   хэш раздачи, серия, таймкод с handler, плейлист из копий, viewed. */
function playData(ep, count, opts) {
  opts = opts || {};
  const list = [];
  for (let i = 1; i <= count; i++) {
    list.push({ title: i + ' / Серия <b>' + i + '</b>', url: stream(i, opts.mode), torrent_hash: HASH, season: 2, episode: i,
      card: SHOW, timeline: { hash: 'tl' + i, percent: 0, time: 0, duration: 0, handler: () => { } }, viewed: () => { } });
  }
  const d = Object.assign({}, list[ep - 1]);
  d.timeline = { hash: 'tl' + ep, percent: opts.percent || 37, time: opts.time || 1394, duration: 3760, handler: () => { } };
  d.playlist = list;
  d.subtitles = [{ label: 'Rus', url: stream(ep) + '&sub', index: 0 }];
  return d;
}

function pure() {
  return loadCtx('71_resume.js', { lang: (k) => (STR[k] ? STR[k].ru : k), pref: (n, d) => d }).api;
}

/* ------------------------------ capture ------------------------------ */

test('resume: capture — запись из данных внешнего плеера: файл, серия, таймкод, окно плейлиста ±8', () => {
  const R = pure();
  const rec = R.capture(playData(12, 24), 'external', T0, null, null);
  assert.equal(rec.kind, 'torrent');
  assert.equal(rec.mode, 'external');
  assert.equal(rec.url, stream(12));
  assert.equal(rec.torrent_hash, HASH);
  assert.equal(rec.index, 12);
  assert.equal(rec.season, 2);
  assert.equal(rec.episode, 12);
  assert.equal(rec.title, '12 / Серия 12', 'разметка из названия снята');
  assert.deepEqual([rec.tl_hash, rec.percent, rec.time, rec.duration], ['tl12', 37, 1394, 3760]);
  assert.equal(rec.playlist.length, 17, 'окно ±8 вокруг текущей');
  assert.equal(rec.playlist[rec.cur].tl_hash, 'tl12');
  assert.equal(rec.playlist[0].episode, 4);
  assert.equal(rec.playlist[16].episode, 20);
  assert.equal(rec.card.id, 1399);
  assert.deepEqual(rec.card.genre_ids, [18, 10765], 'жанры — для детского фильтра');
  assert.equal(rec.card.overview, undefined, 'без лишнего веса');
  assert.equal(rec.subtitles.length, 1);
  const json = JSON.stringify(rec);
  assert.equal(json.indexOf('handler'), -1, 'функции не пишутся');
  assert.ok(json.length < 8192, 'запись ' + json.length + ' байт');
  assert.equal(rec.shown, false);
  assert.equal(rec.settled, false);
});

test('resume: capture — начало и конец плейлиста: окно обрезается, cur верный', () => {
  const R = pure();
  let rec = R.capture(playData(1, 24), 'external', T0);
  assert.deepEqual([rec.playlist.length, rec.cur], [9, 0]);
  rec = R.capture(playData(24, 24), 'external', T0);
  assert.deepEqual([rec.playlist.length, rec.cur], [9, 8]);
  assert.deepEqual(R.trim([], 0), { list: [], cur: -1 });
});

test('resume: capture — онлайн-источник: kind online, подписанных ссылок не храним', () => {
  const R = pure();
  const d = { url: 'https://cdn.example/sig/abc.m3u8?token=secret', title: 'Серия 5', season: 1, episode: 5, card: SHOW,
    timeline: { hash: 'on5', percent: 20, time: 600, duration: 3000 },
    playlist: [{ url: 'https://cdn.example/sig/4.m3u8?token=s', title: 'Серия 4', timeline: { hash: 'on4' }, season: 1, episode: 4 },
      { url: d0url(), title: 'Серия 5', timeline: { hash: 'on5' }, season: 1, episode: 5 }] };
  function d0url() { return 'https://cdn.example/sig/abc.m3u8?token=secret'; }
  const rec = R.capture(d, 'inner', T0);
  assert.equal(rec.kind, 'online');
  assert.equal(rec.url, '');
  assert.equal(JSON.stringify(rec).indexOf('token'), -1, 'ни одной ссылки источника');
  assert.equal(rec.playlist.length, 2);
  assert.equal(rec.cur, 1);
  assert.equal(R.buildPlay(rec, () => ({})), null, 'онлайн плеером не запускается');
});

test('resume: capture — трейлер, IPTV, данные без таймкода и раздачи, без карточки — не записываются', () => {
  const R = pure();
  assert.equal(R.capture({ url: 'https://www.youtube.com/watch?v=x', youtube: true, card: SHOW }, 'inner', T0), null);
  assert.equal(R.capture({ url: 'http://iptv/1.m3u8', iptv: true, timeline: { hash: 'x' }, card: SHOW }, 'inner', T0), null);
  assert.equal(R.capture({ url: 'http://x/1.mp4', card: SHOW }, 'inner', T0), null);
  assert.equal(R.capture({ url: 'http://x/1.mp4', timeline: { hash: 'x' } }, 'inner', T0), null);
  assert.ok(R.capture({ url: 'http://x/1.mp4', timeline: { hash: 'x' } }, 'inner', T0, SHOW), 'карточка активности — запасная');
});

test('resume: fromTorrent — режим приложения TorrServe: только раздача и карточка', () => {
  const R = pure();
  const rec = R.fromTorrent({ Title: 'Game.of.Thrones.S02.1080p', MagnetUri: 'magnet:?xt=urn:btih:' + HASH, poster: 'p.jpg' }, SHOW, T0);
  assert.equal(rec.kind, 'torrent-app');
  assert.equal(rec.torrent.magnet, 'magnet:?xt=urn:btih:' + HASH);
  assert.equal(rec.torrent.title, 'Game.of.Thrones.S02.1080p');
  assert.equal(rec.url, '');
  assert.equal(R.decide(rec, T0 + 1000, {}), 'show', 'таймкода нет — и не нужен');
  assert.equal(R.fromTorrent({ Title: 'x' }, SHOW, T0), null, 'без magnet и Link — нечего открывать');
  assert.equal(R.fromTorrent({ Link: 'http://jackett/dl/1' }, SHOW, T0).torrent.magnet, 'http://jackett/dl/1');
  assert.equal(R.advance(rec, { hash: 'tl1', percent: 99 }, T0).change, '', 'таймкод раздачи не двигает');
});

/* ------------------------------ advance ------------------------------ */

test('resume: advance — позиция, досмотр ≥95 % → следующая серия, на последней — запись удаляется', () => {
  const R = pure();
  const rec = R.capture(playData(5, 6), 'external', T0);
  let r = R.advance(rec, { hash: 'tl5', percent: 60, time: 2256, duration: 3760 }, T0 + 10);
  assert.equal(r.change, 'update');
  assert.deepEqual([r.rec.percent, r.rec.time, r.rec.at], [60, 2256, T0 + 10]);
  assert.equal(rec.percent, 37, 'исходная запись не меняется');
  r = R.advance(r.rec, { hash: 'tl5', percent: 96, time: 3610, duration: 3760 }, T0 + 20);
  assert.equal(r.change, 'next');
  assert.equal(r.rec.episode, 6);
  assert.equal(r.rec.tl_hash, 'tl6');
  assert.equal(r.rec.url, stream(6));
  assert.equal(r.rec.index, 6);
  assert.deepEqual([r.rec.time, r.rec.percent, r.rec.shown], [0, 0, false]);
  r.rec.shown = true;
  const last = R.advance(r.rec, { hash: 'tl6', percent: 100, time: 3700 }, T0 + 30);
  assert.deepEqual(last, { rec: null, change: 'drop' });
  assert.equal(R.advance(rec, { hash: 'чужой', percent: 99 }, T0).change, '', 'чужой хэш — без изменений');
});

test('resume: advance — внешний плеер сам перешёл на серию из плейлиста: текущей становится она', () => {
  const R = pure();
  const rec = R.capture(playData(5, 8), 'external', T0);
  const r = R.advance(rec, { hash: 'tl7', percent: 12, time: 400, duration: 3000 }, T0 + 5);
  assert.equal(r.change, 'update');
  assert.deepEqual([r.rec.episode, r.rec.tl_hash, r.rec.index, r.rec.time], [7, 'tl7', 7, 400]);
  assert.deepEqual(r.rec.subtitles, [], 'субтитры прежнего файла не переносятся');
});

/* ------------------------------ decide ------------------------------- */

test('resume: decide — срок, показано, ушёл сам, вернулся живым, досмотрено, выключатель, детский фильтр', () => {
  const R = pure();
  const rec = R.capture(playData(5, 6), 'external', T0);
  const o = { ttl: 6 * HOUR, enabled: true, kidsOk: () => true };
  assert.equal(R.decide(rec, T0 + 5 * HOUR, o), 'show');
  assert.equal(R.decide(rec, T0 + 7 * HOUR, o), 'expire');
  assert.equal(R.decide(rec, T0 + 7 * HOUR, Object.assign({}, o, { ttl: 12 * HOUR })), 'show', 'срок из настройки');
  assert.equal(R.decide(rec, T0 - 2 * HOUR, o), 'expire', 'запись из будущего (часы сбились) — не верим');
  assert.equal(R.decide(Object.assign({}, rec, { shown: true }), T0, o), 'skip');
  assert.equal(R.decide(Object.assign({}, rec, { settled: true }), T0, o), 'skip');
  assert.equal(R.decide(Object.assign({}, rec, { returned: true }), T0, o), 'skip');
  assert.equal(R.decide(Object.assign({}, rec, { percent: 95 }), T0, o), 'skip');
  assert.equal(R.decide(rec, T0, Object.assign({}, o, { enabled: false })), 'skip', 'выключено: храним, не показываем');
  assert.equal(R.decide(rec, T0, Object.assign({}, o, { kidsOk: () => false })), 'skip');
  assert.equal(R.decide(null, T0, o), 'expire');
  assert.equal(R.decide({ v: 1, kind: 'x', card: { id: 1 }, at: T0 }, T0, o), 'expire', 'битая запись');
});

/* ----------------------------- buildPlay ----------------------------- */

test('resume: buildPlay — тот же файл и раздача, свежий Timeline.view у текущей и всех серий плейлиста', () => {
  const R = pure();
  const rec = R.capture(playData(5, 6), 'external', T0);
  const asked = [];
  const data = R.buildPlay(rec, (h) => { asked.push(h); return { hash: h, time: h === 'tl5' ? 1500 : 0, handler: () => { } }; });
  assert.equal(data.url, stream(5));
  assert.equal(data.torrent_hash, HASH);
  assert.equal(data.card.id, 1399);
  assert.deepEqual([data.season, data.episode], [2, 5]);
  assert.equal(data.timeline.hash, 'tl5');
  assert.equal(data.timeline.time, 1500, 'позицию Lampa передаст из timeline.time');
  assert.equal(typeof data.timeline.handler, 'function');
  assert.equal(data.playlist.length, 6);
  assert.equal(data.playlist[4].timeline, data.timeline, 'текущая серия плейлиста — тот же объект таймкода');
  assert.deepEqual(asked.slice().sort(), ['tl1', 'tl2', 'tl3', 'tl4', 'tl5', 'tl6']);
  assert.equal(data.subtitles.length, 1);
  assert.equal(R.buildPlay(R.fromTorrent({ MagnetUri: 'magnet:?x' }, SHOW, T0), () => ({})), null);
});

test('resume: подписи — «S2 E5 · 23:10 из 1:02:40», часы и минуты', () => {
  const R = pure();
  assert.equal(R.clock(1390), '23:10');
  assert.equal(R.clock(3760), '1:02:40');
  assert.equal(R.clock(59), '0:59');
  assert.equal(R.episodeText({ season: 2, episode: 5, time: 1390, duration: 3760 }, 'из'), 'S2 E5 · 23:10 из 1:02:40');
  assert.equal(R.episodeText({ season: 0, episode: 0, time: 600, duration: 0 }, 'из'), '10:00', 'фильм без длительности');
  assert.equal(R.episodeText({ season: 1, episode: 3, time: 0 }, 'из'), 'S1 E3');
});

/* --------------------------- счётчики (C) ---------------------------- */

test('resume: bootStats — холодный старт после ухода в плеер считается один раз и только в пределах 2 ч', () => {
  const R = pure();
  let s = R.bootStats(null, T0);
  assert.deepEqual([s.boots, s.cold_after_ext, s.ext_n], [1, 0, 0]);
  s.ext_at = T0 + 1000; s.ext_n = 1; s.ext_open = 1;
  s = R.bootStats(s, T0 + 1000 + 23 * 60000);
  assert.deepEqual([s.boots, s.cold_after_ext, s.last_gap_min, s.ext_open], [2, 1, 23, 0]);
  s = R.bootStats(s, T0 + 2000 + 30 * 60000);
  assert.equal(s.cold_after_ext, 1, 'второй перезапуск без нового ухода в плеер — не считается');
  s.ext_at = T0; s.ext_open = 1;
  s = R.bootStats(s, T0 + 3 * HOUR);
  assert.equal(s.cold_after_ext, 1, 'позже 2 ч — обычный запуск');
});

test('resume: statsText — строка HUD «boot#N · ext M мин назад · cold/ext a/b»', () => {
  const R = pure();
  assert.equal(R.statsText({ boots: 12, ext_at: T0, ext_n: 5, cold_after_ext: 3 }, T0 + 23 * 60000), 'boot#12 · ext 23 мин назад · cold/ext 3/5');
  assert.equal(R.statsText({ boots: 1 }, T0), 'boot#1 · ext — · cold/ext 0/0');
  assert.equal(R.statsText({ boots: 2, ext_at: T0, ext_n: 1 }, T0 + 26 * HOUR), 'boot#2 · ext 26 ч назад · cold/ext 0/1');
  assert.equal(R.statsText({ boots: 2, ext_at: T0, ext_n: 1 }, T0 + 5 * 60000, { min: 'min', hours: 'h', ago: 'ago' }), 'boot#2 · ext 5 min ago · cold/ext 0/1');
});

/* ------------------------------ рантайм ------------------------------ */

/* Фейковая Lampa: Storage в памяти (JSON, как localStorage), журналы
   Select/Player/Torrent/Activity/Controller, подписки Player.listener и
   Listener, document с visibilitychange, очередь таймеров. */
function setup(opts) {
  opts = opts || {};
  const store = {};
  for (const k of Object.keys(opts.storage || {})) store[k] = JSON.stringify(opts.storage[k]);
  const subs = {};
  const follow = (ns) => ({
    follow: (n, fn) => { (subs[ns + n] = subs[ns + n] || []).push(fn); },
    remove: (n, fn) => { subs[ns + n] = (subs[ns + n] || []).filter((f) => f !== fn); },
    send: (n, e) => { (subs[ns + n] || []).slice().forEach((f) => f(e)); }
  });
  const log = { select: [], play: [], playlist: [], torrentStart: [], torrentOpen: [], push: [], toggles: [] };
  let ctrl = opts.ctrl || 'items_line';
  let active = opts.active || { component: 'main' };
  const timeline = Object.assign({}, opts.timeline || {});
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? (store[k] === '' ? '' : JSON.parse(store[k])) : d),
      set: (k, v, nolisten) => { store[k] = v === '' ? '' : JSON.stringify(v); log.nolisten = nolisten; },
      field: (k) => (opts.fields || {})[k]
    },
    Player: {
      listener: follow('player:'),
      play: (d) => log.play.push(d),
      playlist: (p) => log.playlist.push(p)
    },
    Listener: follow('app:'),
    Select: { show: (p) => log.select.push(p) },
    Controller: { enabled: () => ({ name: ctrl }), toggle: (n) => log.toggles.push(n) },
    Timeline: { view: (h) => Object.assign({ hash: h, percent: 0, time: 0, duration: 0, handler: () => { } }, timeline[h] || {}) },
    Torrent: { start: (el, card) => log.torrentStart.push({ el, card }), open: (h, card) => log.torrentOpen.push({ h, card }) },
    Activity: { active: () => active, push: (o) => log.push.push(o) },
    Platform: { is: (n) => n === 'android' && !!opts.android }
  };
  const docSubs = [];
  const doc = { visibilityState: 'visible', hidden: false,
    addEventListener: (n, fn) => { if (n === 'visibilitychange') docSubs.push(fn); },
    removeEventListener: (n, fn) => { const i = docSubs.indexOf(fn); if (i >= 0) docSubs.splice(i, 1); } };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  globalThis.document = doc;
  const prefs = Object.assign({ lumen_resume: true, lumen_resume_ttl: '6', lumen_kids: false }, opts.prefs || {});
  const { api, LC } = loadCtx('71_resume.js', {
    lang: (k) => (STR[k] ? STR[k].ru : k),
    pref: (n, d) => (n in prefs ? prefs[n] : d),
    kids: { enabled: () => prefs.lumen_kids === true, strict: (c) => (c.genre_ids || []).indexOf(10751) !== -1 && (c.genre_ids || []).indexOf(27) === -1 }
  });
  let clock = opts.now || T0;
  api._now = () => clock;
  const timers = [];
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; }
  };
  function step() {
    const t = timers.shift();
    if (!t) return null;
    if (t.fn) t.fn();
    return t.ms;
  }
  function vis(state) {
    doc.visibilityState = state;
    doc.hidden = state === 'hidden';
    docSubs.slice().forEach((f) => f());
  }
  const env = {
    api, LC, Lampa, store, log, timers, step, vis, prefs, timeline, docSubs, subs,
    rec: () => (store.lumen_resume ? JSON.parse(store.lumen_resume) : null),
    stats: () => (store.lumen_resume_stats ? JSON.parse(store.lumen_resume_stats) : null),
    tick: (ms) => { clock += ms; },
    setCtrl: (n) => { ctrl = n; },
    setActive: (a) => { active = a; },
    player: (n, e) => Lampa.Player.listener.send(n, e),
    listener: (n, e) => Lampa.Listener.send(n, e)
  };
  return env;
}

/* Сессия встроенного клиента на Android: раздача → серия → внешний плеер. */
function watchEpisode(env, ep, count) {
  env.setActive({ component: 'torrents', movie: SHOW });
  env.listener('torrent', { type: 'onenter', element: { title: 'Game.of.Thrones.S02', MagnetUri: 'magnet:?xt=urn:btih:' + HASH, poster: 'p.jpg' } });
  const d = playData(ep, count || 6, { mode: 'preload' });
  env.player('create', { data: d, abort: () => { } });
  const ext = playData(ep, count || 6);
  env.player('external', ext);
}

test('resume: install — встроенный клиент: create → external пишут одну запись с раздачей; ext в счётчике', () => {
  const env = setup({ android: true, fields: { internal_torrclient: true } });
  env.api.boot();
  env.api.install();
  watchEpisode(env, 2);
  const rec = env.rec();
  assert.equal(rec.kind, 'torrent');
  assert.equal(rec.mode, 'external');
  assert.equal(rec.url, stream(2), 'url — как ушёл во внешний плеер (&play)');
  assert.equal(rec.torrent.magnet, 'magnet:?xt=urn:btih:' + HASH, 'раздача из Listener torrent');
  assert.equal(env.log.nolisten, true, 'запись без события change');
  const s = env.stats();
  assert.deepEqual([s.boots, s.ext_n, s.ext_open], [1, 1, 1]);
});

test('resume: install — приложение TorrServe: запись по раздаче, Player не нужен', () => {
  const env = setup({ android: true, fields: { internal_torrclient: false } });
  env.api.boot();
  env.api.install();
  env.setActive({ component: 'torrents', movie: SHOW });
  env.listener('torrent', { type: 'onenter', element: { title: 'GoT S02', MagnetUri: 'magnet:?xt=urn:btih:' + HASH } });
  const rec = env.rec();
  assert.equal(rec.kind, 'torrent-app');
  assert.equal(rec.card.id, 1399);
  assert.equal(env.stats().ext_n, 1, 'уход в приложение — тоже уход из Lampa');
  env.listener('torrent', { type: 'onlong', element: { MagnetUri: 'magnet:?other' } });
  assert.equal(env.rec().torrent.magnet, 'magnet:?xt=urn:btih:' + HASH, 'только onenter');
});

test('resume: выключатель — записи нет, счётчики пишутся; uninstall снимает подписки', () => {
  const env = setup({ android: true, fields: { internal_torrclient: true }, prefs: { lumen_resume: false } });
  env.api.boot();
  env.api.install();
  watchEpisode(env, 2);
  assert.equal(env.rec(), null);
  assert.equal(env.stats().ext_n, 1);
  env.api.uninstall();
  assert.deepEqual([env.subs['player:create'].length, env.subs['player:external'].length, env.subs['app:torrent'].length, env.docSubs.length], [0, 0, 0, 0]);
});

test('resume: холодный старт — окно через 2 с, «Продолжить» запускает тот же файл с таймкодом и плейлистом', () => {
  const first = setup({ android: true, fields: { internal_torrclient: true } });
  first.api.boot();
  first.api.install();
  watchEpisode(first, 2);
  /* Перезапуск: новая страница, та же localStorage. Клиент Android уже
     записал позицию в Timeline. */
  const env = setup({ android: true, fields: { internal_torrclient: true }, now: T0 + 20 * 60000,
    storage: { lumen_resume: first.rec(), lumen_resume_stats: first.stats() }, timeline: { tl2: { time: 1390, percent: 37, duration: 3760 } } });
  assert.equal(env.api.boot(), true);
  assert.equal(env.stats().cold_after_ext, 1, 'перезапуск после внешнего плеера посчитан');
  env.api.install();
  env.api.schedule(() => true);
  assert.equal(env.api.busy(), true);
  assert.equal(env.step(), 2000);
  assert.equal(env.log.select.length, 1);
  const p = env.log.select[0];
  assert.equal(p.title, 'Вернуться к просмотру?');
  assert.deepEqual(p.items.map((i) => i.title), ['Продолжить', 'Открыть раздачу снова', 'Открыть карточку', 'Не сейчас']);
  assert.equal(p.items[0].subtitle, 'Игра престолов · S2 E2 · 23:10 из 1:02:40');
  assert.equal(env.rec().shown, true, 'показано — второй раз этот обрыв не предлагается');
  assert.equal(env.api.busy(), true, 'окно открыто');
  env.setCtrl('select');
  p.items[0].onSelect(p.items[0]);
  assert.deepEqual(env.log.toggles, ['items_line'], 'контроллер возвращён до запуска');
  assert.equal(env.log.play.length, 1);
  const d = env.log.play[0];
  assert.equal(d.url, stream(2));
  assert.equal(d.torrent_hash, HASH);
  assert.equal(d.timeline.time, 1390);
  assert.equal(d.card.id, 1399);
  assert.equal(env.log.playlist.length, 1);
  assert.equal(env.log.playlist[0].length, 6);
  assert.equal(env.api.busy(), false);
  /* Повторный выбор (двойной клик) — без второго запуска. */
  p.onBack();
  assert.equal(env.log.play.length, 1);
});

test('resume: окно — «Назад» = «Не сейчас»: фокус обратно, ничего не запускается; «Открыть раздачу снова» — Torrent.start с magnet', () => {
  const first = setup({ android: true, fields: { internal_torrclient: true } });
  first.api.install();
  watchEpisode(first, 3);
  for (const how of ['back', 'reopen', 'card']) {
    const env = setup({ android: true, fields: { internal_torrclient: true }, storage: { lumen_resume: first.rec() }, ctrl: 'content' });
    env.api.boot();
    env.api.install();
    env.api.schedule(() => true);
    env.step();
    const p = env.log.select[0];
    if (how === 'back') p.onBack();
    if (how === 'reopen') p.items[1].onSelect(p.items[1]);
    if (how === 'card') p.items[2].onSelect(p.items[2]);
    assert.deepEqual(env.log.toggles, ['content'], how);
    assert.equal(env.log.play.length, 0, how);
    if (how === 'reopen') {
      assert.equal(env.log.torrentStart.length, 1);
      assert.equal(env.log.torrentStart[0].el.MagnetUri, 'magnet:?xt=urn:btih:' + HASH);
      assert.equal(env.log.torrentStart[0].card.id, 1399);
    }
    if (how === 'card') assert.deepEqual([env.log.push[0].component, env.log.push[0].id, env.log.push[0].method], ['full', 1399, 'tv']);
  }
});

test('resume: окно режима TorrServe — «Открыть раздачу снова» с честной подписью; новый сеанс снова ждёт окна', () => {
  const env = setup({ android: true, fields: { internal_torrclient: false },
    storage: { lumen_resume: pure().fromTorrent({ Title: 'GoT S02', MagnetUri: 'magnet:?xt=urn:btih:' + HASH }, SHOW, T0) }, now: T0 + HOUR });
  env.api.boot();
  env.api.install();
  env.api.schedule(() => true);
  env.step();
  const p = env.log.select[0];
  assert.deepEqual(p.items.map((i) => i.title), ['Открыть раздачу снова', 'Открыть карточку', 'Не сейчас']);
  assert.equal(p.items[0].subtitle, 'Игра престолов · серию и место выберете в TorrServe');
  p.items[0].onSelect(p.items[0]);
  assert.equal(env.log.torrentStart.length, 1);
  assert.equal(env.log.torrentStart[0].el.MagnetUri, 'magnet:?xt=urn:btih:' + HASH);
  const rec = env.rec();
  assert.deepEqual([rec.shown, rec.at], [false, T0 + HOUR], 'новый сеанс в TorrServe — если Lampa убьют снова, окно снова нужно');
});

test('resume: окно онлайн-источника — только «Открыть карточку» и «Не сейчас»', () => {
  const R = pure();
  const rec = R.capture({ url: 'https://cdn/x.m3u8', title: 'Фильм', card: { id: 5, title: 'Фильм', original_title: 'Film' },
    timeline: { hash: 'm5', percent: 30, time: 1800, duration: 6000 } }, 'external', T0);
  const env = setup({ storage: { lumen_resume: rec } });
  env.api.boot();
  env.api.install();
  env.api.schedule(() => true);
  env.step();
  const p = env.log.select[0];
  assert.deepEqual(p.items.map((i) => i.title), ['Открыть карточку', 'Не сейчас']);
  assert.equal(p.items[0].subtitle, 'Фильм · 30:00 из 1:40:00');
  p.items[0].onSelect(p.items[0]);
  assert.deepEqual([env.log.push[0].id, env.log.push[0].method], [5, 'movie']);
});

test('resume: название с разметкой экранируется — Select вставляет подпись сырой', () => {
  const R = pure();
  const rec = R.capture(Object.assign(playData(1, 2), { card: Object.assign({}, SHOW, { name: '<img src=x onerror=1>' }) }), 'external', T0);
  const env = setup({ storage: { lumen_resume: rec } });
  env.api.boot();
  env.api.install();
  env.api.schedule(() => true);
  env.step();
  assert.equal(env.log.select[0].items[0].subtitle.indexOf('<img'), -1);
});

test('resume: окно не готово (плеер, модалка) — повтор раз в 2 с, 15 попыток, потом без окна; первый экран — любой', () => {
  const first = setup();
  first.api.install();
  first.player('start', playData(1, 2));
  const env = setup({ storage: { lumen_resume: first.rec() } });
  env.api.boot();
  env.api.install();
  let n = 0;
  env.api.schedule(() => { n++; return false; });
  const delays = [];
  let d;
  while ((d = env.step()) !== null) delays.push(d);
  assert.equal(n, 15);
  assert.deepEqual(delays, new Array(15).fill(2000));
  assert.equal(env.log.select.length, 0);
  assert.equal(env.api.busy(), false, '«Что нового» больше не ждёт');
  assert.equal(env.rec().shown, false, 'не показали — предложим при следующем запуске');
});

test('resume: досмотр ≥95 % → следующая серия; при перезапуске окно про неё', () => {
  const first = setup({ android: true, fields: { internal_torrclient: true } });
  first.api.boot();
  first.api.install();
  watchEpisode(first, 2);
  /* Форма события Lampa: позиция — в road (Timeline.update, app.min.js:23874). */
  first.api.onTimeline({ hash: 'tl2', road: { percent: 40, time: 1500, duration: 3760 } });
  assert.deepEqual([first.rec().episode, first.rec().time, first.rec().percent], [2, 1500, 40]);
  first.api.onTimeline({ hash: 'tl2', road: { percent: 96, time: 3610, duration: 3760 } });
  assert.equal(first.rec().episode, 3);
  const env = setup({ storage: { lumen_resume: first.rec() } });
  env.api.boot();
  env.api.install();
  env.api.schedule(() => true);
  env.step();
  assert.equal(env.log.select[0].items[0].subtitle, 'Игра престолов · S2 E3');
});

test('resume: позиция из Timeline после перезапуска — досмотрено: следующая серия, последняя — окна нет, запись удалена', () => {
  const first = setup();
  first.api.install();
  first.player('external', playData(6, 6));
  const env = setup({ storage: { lumen_resume: first.rec() }, timeline: { tl6: { percent: 98, time: 3700, duration: 3760 } } });
  env.api.boot();
  env.api.install();
  env.api.schedule(() => true);
  env.step();
  assert.equal(env.log.select.length, 0);
  assert.equal(env.rec(), null);
});

test('resume: другой фильм — ушёл сам: окна нет; первый экран холодного старта не в счёт', () => {
  const first = setup();
  first.api.install();
  first.player('external', playData(2, 6));
  first.api.onActivity({ type: 'start', component: 'full', object: { id: 1399, method: 'tv' } });
  assert.equal(first.rec().settled, false, 'та же карточка');
  first.api.onActivity({ type: 'start', component: 'full', object: { id: 1399, method: 'movie' } });
  assert.equal(first.rec().settled, true, 'фильм с тем же id — другая карточка');
  const env = setup({ storage: { lumen_resume: first.rec() } });
  assert.equal(env.api.boot(), false);

  const f2 = setup();
  f2.api.install();
  f2.player('external', playData(2, 6));
  const e2 = setup({ storage: { lumen_resume: f2.rec() } });
  e2.api.boot();
  e2.api.install();
  e2.api.onActivity({ type: 'start', component: 'full', object: { id: 550, method: 'movie' } });
  assert.equal(e2.rec().settled, false, 'пока окно ждёт — «Последняя» открыла чужую карточку, это не выбор человека');
});

test('resume: закрыл плеер Lampa сам — окна при следующем запуске нет, запись для меню остаётся', () => {
  const env = setup();
  env.api.install();
  env.player('start', playData(2, 6));
  assert.equal(env.rec().mode, 'inner');
  env.player('destroy', {});
  assert.equal(env.rec().settled, true);
  assert.ok(env.api.menuItem(SHOW), 'в меню карточки — есть');
});

test('resume: живой возврат из внешнего плеера — окна при следующем запуске нет, cold/ext не растёт', () => {
  const first = setup({ android: true, fields: { internal_torrclient: true } });
  first.api.boot();
  first.api.install();
  watchEpisode(first, 2);
  first.tick(1000);
  first.vis('hidden');
  first.tick(60000);
  first.vis('visible');
  assert.equal(first.rec().returned, true);
  assert.equal(first.stats().ext_open, 0);
  const env = setup({ storage: { lumen_resume: first.rec(), lumen_resume_stats: first.stats() }, now: T0 + 5 * 60000 });
  assert.equal(env.api.boot(), false);
  assert.equal(env.stats().cold_after_ext, 0);
});

test('resume: истёк срок — окна нет, запись удалена', () => {
  const first = setup();
  first.api.install();
  first.player('external', playData(2, 6));
  const env = setup({ storage: { lumen_resume: first.rec() }, now: T0 + 7 * HOUR });
  assert.equal(env.api.boot(), false);
  assert.equal(env.rec(), null);
});

test('resume: детский режим — карточка не проходит фильтр: ни окна, ни меню, ни метки; запись хранится', () => {
  const first = setup();
  first.api.install();
  first.player('external', playData(2, 6));
  const env = setup({ storage: { lumen_resume: first.rec() }, prefs: { lumen_kids: true } });
  assert.equal(env.api.boot(), false);
  env.api.install();
  assert.equal(env.api.menuItem(SHOW), null);
  const row = [{ id: 1 }, Object.assign({}, SHOW)];
  assert.equal(env.api.raise(row), row);
  assert.ok(env.rec(), 'запись на месте');
  const kid = setup({ storage: { lumen_resume: Object.assign(first.rec(), { card: Object.assign({}, first.rec().card, { genre_ids: [16, 10751] }) }) }, prefs: { lumen_kids: true } });
  assert.equal(kid.api.boot(), true, 'семейный мультсериал — окно есть');
});

test('resume: меню карточки и ряд «Досмотреть» — пункт с серией, карточка первой с меткой «Вернуться»', () => {
  const first = setup();
  first.api.install();
  first.player('external', playData(5, 6));
  const env = setup({ storage: { lumen_resume: Object.assign(first.rec(), { shown: true }) } });
  env.api.install();
  const item = env.api.menuItem(SHOW);
  assert.equal(item.title, 'Вернуться к просмотру');
  assert.equal(item.subtitle, 'S2 E5 · 23:14 из 1:02:40');
  assert.equal(env.api.menuItem({ id: 1399, title: 'Фильм' }), null, 'фильм с тем же id — не та карточка');
  assert.equal(env.api.menuItem({ id: 7, name: 'Другое' }), null);
  const row = [{ id: 1, name: 'A' }, { id: 2, name: 'B' }, Object.assign({ lumen_continue: true }, SHOW)];
  const out = env.api.raise(row);
  assert.deepEqual(out.map((c) => c.id), [1399, 1, 2]);
  assert.equal(out[0].lumen_badge, 'Вернуться');
  assert.equal(row[0].id, 1, 'исходный список не меняется');
  env.api.resumeNow();
  assert.equal(env.log.play.length, 1, 'пункт меню — тот же файл с того же места');
});

test('resume: HUD-строка читает счётчики', () => {
  const env = setup({ storage: { lumen_resume_stats: { boots: 4, ext_at: T0 - 10 * 60000, ext_n: 2, cold_after_ext: 1 } } });
  assert.equal(env.api.statsLine(), 'boot#4 · ext 10 мин назад · cold/ext 1/2');
});

/* --------------------------- «Что нового» ----------------------------- */

test('resume + «Что нового»: пока окно возврата ждёт или открыто, «Что нового» ждёт и попыток не тратит', () => {
  const LC = { resume: { busy: () => busy } };
  let busy = true;
  const store = { lumen_seen_version: '1.1.0' };
  const opened = [];
  globalThis.Lampa = {
    Storage: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } },
    Modal: { open: (p) => opened.push(p), close: () => { } },
    Controller: { enabled: () => ({ name: 'items_line' }), toggle: () => { } }
  };
  globalThis.window = { Lampa: globalThis.Lampa };
  globalThis.$ = (html) => ({ html });
  const { api } = loadCtx('82_whatsnew.js', Object.assign(LC, { VERSION: '1.2.0', pref: (n, d) => d, lang: (k) => k, langCode: () => 'ru' }));
  const timers = [];
  api._timers = { set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clear: () => { } };
  api.detect();
  api.schedule(() => true);
  for (let i = 0; i < 30; i++) timers.shift().fn();
  assert.equal(opened.length, 0, 'два окна разом не открываются');
  assert.equal(api.pending(), '1.2.0', 'минута «Что нового» не сгорела');
  busy = false;
  timers.shift().fn();
  assert.equal(opened.length, 1, 'окно возврата закрыто — «Что нового» следом');
});

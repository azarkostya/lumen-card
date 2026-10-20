import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* 1.3: «Автоочистка TorrServer» (src/66_tsclean.js). Чистая часть — хэш из
   адреса/magnet, карточка раздачи, карта «открыто», план удаления; рантайм —
   таймеры, адрес сервера, запросы через свой Lampa.Reguest (фейк), запись
   запусков. Передачу запусков из подписок плеера проверяет
   test/resume.test.mjs; ветку настройки — test/settings.test.mjs. */

globalThis.warn = function () { };

const H = 'aabbccddeeff00112233445566778899aabbccdd';
const H2 = '1111111111111111111111111111111111111111';
const H3 = '2222222222222222222222222222222222222222';
const HOUR = 3600000;
const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);
const SHOW = { id: 95480, name: 'Медленные лошади', original_name: 'Slow Horses' };
const MOVIE = { id: 9767, title: 'Развод по-американски', name: null };

/* Раздача из ответа {"action":"list"} MatriX: timestamp — секунды
   добавления, stat 5 / 'Torrent in db' — лежит в базе. */
function tor(hash, agoH, extra) {
  return Object.assign({ hash, title: '[LAMPA] x', stat: 5, stat_string: 'Torrent in db', timestamp: Math.floor((T0 - agoH * HOUR) / 1000), data: '' }, extra || {});
}
function withMovie(card) {
  return { data: JSON.stringify({ lampa: true, movie: card }) };
}

function setup(opts) {
  opts = opts || {};
  /* Карта уже есть (модуль работал раньше) — обычный проход; посевной
     проверяют отдельные тесты (fresh). */
  const store = Object.assign(opts.fresh ? {} : { lumen_tsclean_played: {} }, opts.storage || {});
  const writes = [];
  const prefs = Object.assign({ lumen_tsclean: true, lumen_debug_hud: false }, opts.prefs || {});
  const fields = Object.assign({ internal_torrclient: true }, opts.fields || {});
  const reqs = [];
  let player = false;
  let active = opts.active || null;
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v, nolisten) => { store[k] = v; writes.push({ k, nolisten }); },
      field: (k) => fields[k]
    },
    Torserver: { url: () => (opts.url === undefined ? 'http://192.168.1.5:8090' : opts.url) },
    Platform: { is: (n) => n === 'android' && !!opts.android },
    Activity: { active: () => active }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  const { api, LC } = loadCtx('66_tsclean.js', { pref: (n, d) => (n in prefs ? prefs[n] : d) });
  LC.util.playerOpen = () => player;
  let clock = opts.now || T0;
  api._now = () => clock;
  const timers = [];
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; }
  };
  /* Фейковый Lampa.Reguest: запросы копятся, ответ даёт тест (reply). */
  let cleared = 0;
  api._net = () => ({
    timeout: (ms) => { reqs.timeout = ms; },
    silent: (url, ok, fail, post, params) => reqs.push({ url, ok, fail, post: JSON.parse(post), params, timeout: reqs.timeout }),
    clear: () => { cleared++; }
  });
  function live() { return timers.filter((t) => t.fn); }
  function step() {
    const t = timers.shift();
    if (!t) return null;
    if (t.fn) t.fn();
    return t.ms;
  }
  /* Ответить на все запросы: список — list, rem — успех (кроме failRem). */
  function serve(list, failRem) {
    let guard = 0;
    while (reqs.length && guard++ < 500) {
      const r = reqs.shift();
      if (r.post.action === 'list') r.ok(list);
      else if (failRem && failRem.indexOf(r.post.hash) !== -1) r.fail({ status: 500 }, 'error');
      else r.ok('');
    }
  }
  return {
    api, LC, store, writes, prefs, fields, reqs, timers, live, step, serve,
    played: () => (store.lumen_tsclean_played || {}),
    tick: (ms) => { clock += ms; },
    setPlayer: (v) => { player = v; },
    setActive: (a) => { active = a; },
    cleared: () => cleared
  };
}

/* ------------------------------ чистое ------------------------------ */

test('tsclean: hashOf — голый хэш, адрес потока, /play/, magnet hex и base32', () => {
  const { api } = setup();
  assert.equal(api.hashOf(H.toUpperCase()), H);
  assert.equal(api.hashOf('http://192.168.1.5:8090/stream/Show.S02E03.mkv?link=' + H + '&index=3&play'), H);
  assert.equal(api.hashOf('http://127.0.0.1:8090/play/' + H + '/2'), H);
  assert.equal(api.hashOf('magnet:?xt=urn:btih:' + H.toUpperCase() + '&dn=x'), H);
  /* base32 того же хэша: 20 байт → 32 знака. */
  const bytes = Buffer.from(H, 'hex');
  let bits = ''; for (const b of bytes) bits += b.toString(2).padStart(8, '0');
  const A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let b32 = ''; for (let i = 0; i < bits.length; i += 5) b32 += A[parseInt(bits.slice(i, i + 5), 2)];
  assert.equal(api.hashOf('magnet:?xt=urn:btih:' + b32 + '&tr=udp'), H);
  assert.equal(api.hashOf('http://jackett/dl/file.torrent?id=5'), '', 'ссылка на .torrent — хэша нет');
  assert.equal(api.hashOf('https://cdn.example/video.m3u8'), '');
  assert.equal(api.hashOf(null), '');
  assert.equal(api.hashOf('?link=' + H + 'ff'), '', 'не 40 знаков — не хэш');
});

test('tsclean: cardKey и movieOf — фильм и сериал с одним id различаются; data раздачи разбирается', () => {
  const { api } = setup();
  assert.equal(api.cardKey(SHOW), 'tv:95480');
  assert.equal(api.cardKey(MOVIE), 'movie:9767');
  assert.equal(api.cardKey({ id: 5, first_air_date: '2020-01-01' }), 'tv:5');
  assert.equal(api.cardKey({}), '');
  assert.equal(api.cardKey(null), '');
  assert.deepEqual(api.movieOf(tor(H, 1, withMovie(SHOW))), SHOW);
  assert.equal(api.movieOf(tor(H, 1)), null, 'пустое data');
  assert.equal(api.movieOf({ data: '{битый' }), null);
  assert.deepEqual(api.movieOf({ data: { movie: MOVIE } }), MOVIE, 'объект, а не строка');
});

test('tsclean: touch — время по ключу, без записей старше суток, не больше CAP', () => {
  const { api } = setup();
  const m = api.touch({ 'h:old': T0 - 25 * HOUR, 'h:keep': T0 - HOUR, 'h:bad': 'x' }, ['h:' + H, ''], T0);
  assert.deepEqual(m, { 'h:keep': T0 - HOUR, ['h:' + H]: T0 });
  assert.deepEqual(api.touch({ 'h:a': T0 - HOUR }, ['h:a'], T0), { 'h:a': T0 }, 'повтор — новое время');
  const big = {};
  for (let i = 0; i < api.CAP + 30; i++) big['h:' + i] = T0 - i * 1000;
  const out = api.touch(big, ['h:new'], T0);
  assert.equal(Object.keys(out).length, api.CAP);
  assert.equal(out['h:new'], T0, 'свежая запись остаётся');
  assert.ok(!('h:' + (api.CAP + 29) in out), 'самые старые уходят');
  assert.deepEqual(api.touch(null, [], T0), {});
});

test('tsclean: план — неоткрытые больше суток, самые давние первыми', () => {
  const { api } = setup();
  const list = [tor(H, 30), tor(H2, 23), tor(H3, 100)];
  assert.deepEqual(api.plan(list, {}, T0, ''), [H3, H]);
  /* Сутки ровно — ещё не «больше суток». */
  assert.deepEqual(api.plan([tor(H, 24)], {}, T0, ''), []);
  assert.deepEqual(api.plan(null, {}, T0, ''), []);
});

test('tsclean: план — запуск по хэшу и по карточке продлевает раздачу', () => {
  const { api } = setup();
  const list = [tor(H, 200), tor(H2, 200, withMovie(SHOW)), tor(H3, 200, withMovie(MOVIE))];
  const map = { ['h:' + H]: T0 - 2 * HOUR, 'm:tv:95480': T0 - 3 * HOUR, 'm:tv:9767': T0 - HOUR };
  /* H — открыт 2 ч назад; H2 — открыт тот же сериал; H3 — фильм, а
     запись про сериал с тем же id: не спасает. */
  assert.deepEqual(api.plan(list, map, T0, ''), [H3]);
  assert.equal(api.lastSeen(list[0], map), T0 - 2 * HOUR);
  assert.equal(api.lastSeen(list[2], map), list[2].timestamp * 1000);
  /* Запуск больше суток назад — раздача уходит. */
  assert.deepEqual(api.plan([tor(H, 200)], { ['h:' + H]: T0 - 25 * HOUR }, T0, ''), [H]);
});

test('tsclean: активные, текущая в плеере и раздачи без timestamp не удаляются', () => {
  const { api } = setup();
  const states = [[0, 'Torrent added'], [1, 'Torrent getting info'], [2, 'Torrent preload'], [3, 'Torrent working'], [4, 'Torrent closed']];
  for (const [stat, text] of states) {
    assert.equal(api.removable(tor(H, 200, { stat, stat_string: text }), {}, T0, ''), false, text);
  }
  assert.equal(api.removable(tor(H, 200, { stat: undefined, stat_string: 'Torrent working' }), {}, T0, ''), false);
  assert.equal(api.removable(tor(H, 200, { stat: undefined }), {}, T0, ''), true, 'без числа — по stat_string');
  assert.equal(api.removable(tor(H, 200, { stat: 5, stat_string: 'что-то' }), {}, T0, ''), true, 'число решает');
  assert.equal(api.removable(tor(H, 200), {}, T0, H), false, 'в плеере');
  assert.equal(api.removable(tor(H, 200, { timestamp: 0 }), {}, T0, ''), false);
  assert.equal(api.removable(tor(H, 200, { timestamp: undefined }), {}, T0, ''), false);
  assert.equal(api.removable(tor('кривой', 200), {}, T0, ''), false);
  assert.equal(api.removable(null, {}, T0, ''), false);
});

test('tsclean: план — не больше MAX_PER_RUN за проход', () => {
  const { api } = setup();
  const list = [];
  for (let i = 0; i < api.MAX_PER_RUN + 10; i++) list.push(tor(i.toString(16).padStart(40, '0'), 100 + i));
  const out = api.plan(list, {}, T0, '');
  assert.equal(out.length, api.MAX_PER_RUN);
  assert.equal(out[0], (api.MAX_PER_RUN + 9).toString(16).padStart(40, '0'), 'самая давняя первой');
});

test('tsclean: prune — без раздач, которых нет в TorrServer или удалены, и без старых', () => {
  const { api } = setup();
  const list = [tor(H, 1), tor(H2, 1, withMovie(SHOW))];
  const map = { ['h:' + H]: T0 - HOUR, ['h:' + H2]: T0 - HOUR, ['h:' + H3]: T0 - HOUR, 'm:tv:95480': T0 - HOUR, 'm:movie:1': T0 - HOUR, ['h:old']: T0 - 30 * HOUR };
  assert.deepEqual(api.prune(map, list, T0, [H2]), { ['h:' + H]: T0 - HOUR });
  assert.deepEqual(api.prune(map, list, T0, []), { ['h:' + H]: T0 - HOUR, ['h:' + H2]: T0 - HOUR, 'm:tv:95480': T0 - HOUR });
});

/* ------------------------------ рантайм ------------------------------ */

test('tsclean: install — первый проход через 30 с, дальше раз в 6 ч; rem только для старых', () => {
  const env = setup();
  env.api.install();
  assert.equal(env.live().length, 1);
  assert.equal(env.timers[0].ms, 30000);
  assert.equal(env.reqs.length, 0, 'до таймера — ни одного запроса');
  env.step();
  assert.equal(env.timers[0].ms, 6 * HOUR, 'следующий — через 6 ч');
  assert.equal(env.reqs.length, 1);
  assert.equal(env.reqs[0].url, 'http://192.168.1.5:8090/torrents');
  assert.deepEqual(env.reqs[0].post, { action: 'list' });
  assert.ok(env.reqs[0].timeout > 0, 'с таймаутом');
  const removed = [];
  const list = [tor(H, 30), tor(H2, 2), tor(H3, 50, { stat: 3, stat_string: 'Torrent working' })];
  /* Ответ по шагам: список, затем один rem. */
  const r = env.reqs.shift();
  r.ok(list);
  assert.equal(env.reqs.length, 1);
  assert.deepEqual(env.reqs[0].post, { action: 'rem', hash: H });
  assert.deepEqual(env.reqs[0].params, { dataType: 'text' });
  removed.push(env.reqs[0].post.hash);
  env.reqs.shift().ok('');
  assert.equal(env.reqs.length, 0, 'H2 свежая, H3 качается');
  assert.deepEqual(removed, [H]);
});

test('tsclean: пункт выключен (по умолчанию) — ни таймера, ни запросов; включили — проход через 30 с', () => {
  const env = setup({ prefs: { lumen_tsclean: false } });
  env.api.install();
  assert.equal(env.live().length, 0);
  env.prefs.lumen_tsclean = true;
  env.api.apply();
  assert.equal(env.live().length, 1);
  assert.equal(env.live()[0].ms, 30000);
  env.api.apply();
  assert.equal(env.live().length, 1, 'повторный apply второго таймера не заводит');
  env.prefs.lumen_tsclean = false;
  env.api.apply();
  assert.equal(env.live().length, 0, 'выключили — таймер снят');
});

test('tsclean: значение по умолчанию из таблицы настроек — выключено', () => {
  const env = setup();
  delete env.prefs.lumen_tsclean;
  env.api.install();
  assert.equal(env.live().length, 0);
});

test('tsclean: плагин выключен (uninstall) — таймер снят, начатый проход дальше не удаляет', () => {
  const env = setup();
  env.api.install();
  env.step();
  env.reqs.shift().ok([tor(H, 30), tor(H2, 40)]);
  assert.equal(env.reqs.length, 1, 'первый rem ушёл');
  env.api.uninstall();
  assert.equal(env.cleared(), 1, 'запросы сняты');
  assert.equal(env.live().length, 0);
  env.reqs.shift().ok('');
  assert.equal(env.reqs.length, 0, 'второго rem нет');
  env.api.apply();
  assert.equal(env.live().length, 0, 'apply при выключенном плагине ничего не заводит');
});

test('tsclean: выключили пункт посреди прохода — остановка перед следующим удалением', () => {
  const env = setup();
  env.api.install();
  env.step();
  env.reqs.shift().ok([tor(H, 30), tor(H2, 40)]);
  env.prefs.lumen_tsclean = false;
  env.reqs.shift().ok('');
  assert.equal(env.reqs.length, 0);
});

test('tsclean: открыт плеер — проход откладывается на 10 мин', () => {
  const env = setup();
  env.api.install();
  env.setPlayer(true);
  env.step();
  assert.equal(env.reqs.length, 0);
  assert.equal(env.live()[0].ms, 10 * 60000);
  env.setPlayer(false);
  env.step();
  assert.equal(env.reqs.length, 1);
});

test('tsclean: TorrServer недоступен или ответ не список — тихо, без удалений и без исключений', () => {
  const env = setup();
  const res = [];
  env.api.install();
  env.api.run((n) => res.push(n));
  env.reqs.shift().fail({ status: 0 }, 'timeout');
  env.api.run((n) => res.push(n));
  env.reqs.shift().ok({ error: 'x' });
  assert.deepEqual(res, [null, null]);
  assert.equal(env.reqs.length, 0);
  /* Ошибка rem — следующий всё равно идёт. */
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 30), tor(H2, 40)], [H2]);
  assert.deepEqual(res, [null, null, 1]);
});

test('tsclean: проход не накладывается на идущий', () => {
  const env = setup();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.api.run((n) => res.push('второй ' + n));
  assert.deepEqual(res, ['второй null']);
  assert.equal(env.reqs.length, 1);
});

test('tsclean: адрес — как у Lampa; приложение TorrServe на Android — 127.0.0.1:8090; нет адреса — нет запросов', () => {
  assert.equal(setup({ url: 'http://10.0.0.2:8090/' }).api.server(), 'http://10.0.0.2:8090');
  const app = setup({ android: true, url: '', fields: { internal_torrclient: false } });
  assert.equal(app.api.server(), 'http://127.0.0.1:8090');
  assert.equal(setup({ android: true, url: 'http://10.0.0.2:8090', fields: { internal_torrclient: true } }).api.server(), 'http://10.0.0.2:8090');
  const none = setup({ url: '' });
  const res = [];
  none.api.install();
  none.api.run((n) => res.push(n));
  assert.deepEqual(res, [null]);
  assert.equal(none.reqs.length, 0);
});

test('tsclean: onPlay пишет хэш и карточку (nolisten); не торрент — ничего', () => {
  const env = setup();
  env.api.onPlay({ url: 'https://cdn/x.m3u8', card: MOVIE });
  assert.deepEqual(env.played(), {});
  env.api.onPlay({ url: 'http://192.168.1.5:8090/stream/a.mkv?link=' + H + '&index=1&play', card: SHOW });
  assert.deepEqual(env.played(), { ['h:' + H]: T0, 'm:tv:95480': T0 });
  assert.equal(env.writes[0].nolisten, true);
  assert.equal(env.api.current(), H);
  env.api.onStop();
  assert.equal(env.api.current(), '');
  /* torrent_hash важнее адреса; карточки в данных нет — из активности. */
  env.setActive({ movie: MOVIE });
  env.tick(HOUR);
  env.api.onPlay({ torrent_hash: H2, url: 'http://x/y' });
  assert.equal(env.played()['h:' + H2], T0 + HOUR);
  assert.equal(env.played()['m:movie:9767'], T0 + HOUR);
});

test('tsclean: onTorrent — хэш из magnet, без magnet — по карточке; запись спасает раздачу', () => {
  const env = setup();
  env.api.onTorrent({ MagnetUri: 'magnet:?xt=urn:btih:' + H }, SHOW);
  env.api.onTorrent({ Link: 'http://jackett/dl?id=1' }, MOVIE);
  assert.deepEqual(env.played(), { ['h:' + H]: T0, 'm:tv:95480': T0, 'm:movie:9767': T0 });
  env.tick(2 * HOUR);
  env.api.install();
  env.step();
  env.serve([tor(H, 100), tor(H2, 100, withMovie(MOVIE)), tor(H3, 100)]);
  /* Карта после прохода — только про раздачи, что остались. */
  assert.deepEqual(Object.keys(env.played()).sort(), ['h:' + H, 'm:movie:9767'].sort());
});

test('tsclean: в плеере Lampa — не удаляется даже старая; после закрытия плеера — по времени запуска', () => {
  const env = setup();
  env.api.onPlay({ torrent_hash: H });
  env.tick(30 * HOUR);
  env.api.install();
  env.setPlayer(false);
  const res = [];
  env.api.run((n) => res.push(n));
  const r = env.reqs.shift();
  r.ok([tor(H, 100)]);
  assert.deepEqual(res, [0], 'current — не трогаем');
  /* Проход по таймеру при закрытом плеере сбрасывает «в плеере». */
  env.step();
  env.serve([tor(H, 100)]);
  assert.equal(env.api.current(), '');
});

test('tsclean: лог — только при включённом «Показать FPS»', () => {
  const logs = [];
  globalThis.warn = (m) => logs.push(m);
  try {
    const env = setup();
    env.api.install();
    env.api.run();
    env.reqs.shift().fail({ status: 0 }, 'timeout');
    assert.deepEqual(logs, []);
    env.prefs.lumen_debug_hud = true;
    env.api.run();
    env.reqs.shift().fail({ status: 0 }, 'timeout');
    assert.equal(logs.length, 1);
    assert.match(logs[0], /tsclean/);
  } finally {
    globalThis.warn = function () { };
  }
});

/* ----------------------------- посев ----------------------------- */

test('tsclean: первый проход без карты — посевной: ничего не удаляет, все раздачи «открыты сейчас»', () => {
  const env = setup({ fresh: true });
  const list = [tor(H, 300), tor(H2, 500), tor(H3, 2)];
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve(list);
  assert.deepEqual(res, [0]);
  assert.deepEqual(env.reqs.length, 0, 'ни одного rem');
  assert.deepEqual(env.played(), { ['h:' + H]: T0, ['h:' + H2]: T0, ['h:' + H3]: T0 });
  /* Через 6 ч — обычный проход: всё ещё «открыто» меньше суток назад. */
  env.tick(6 * HOUR);
  env.api.run((n) => res.push(n));
  env.serve(list);
  assert.deepEqual(res, [0, 0]);
  /* Через сутки с посева — обычное правило. */
  env.tick(19 * HOUR);
  const removed = [];
  env.api.run((n) => res.push(n));
  while (env.reqs.length) {
    const r = env.reqs.shift();
    if (r.post.action === 'rem') removed.push(r.post.hash);
    r.ok(r.post.action === 'list' ? list : '');
  }
  assert.deepEqual(removed.sort(), [H, H2, H3].sort());
});

test('tsclean: включение пункта (впервые) — посев на первом проходе, и после перезапуска Lampa тоже', () => {
  const env = setup({ prefs: { lumen_tsclean: false } });
  env.api.install();
  env.prefs.lumen_tsclean = true;
  env.api.apply();
  assert.equal(env.store.lumen_tsclean_seed, '1');
  assert.equal(env.writes.find((w) => w.k === 'lumen_tsclean_seed').nolisten, true);
  /* Lampa перезапустилась до первого прохода: пометка в Storage. */
  env.api.uninstall();
  env.api.install();
  env.step();
  env.step();
  env.serve([tor(H, 300)]);
  assert.deepEqual(env.played(), { ['h:' + H]: T0 });
  assert.equal(env.store.lumen_tsclean_seed, '', 'пометка снята');
  /* Следующий проход — обычный. */
  env.tick(25 * HOUR);
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 325)]);
  assert.deepEqual(res, [1]);
});

test('tsclean: повторное включение после перерыва — снова посев, а не удаление всего', () => {
  const env = setup();
  env.api.install();
  /* Обычная работа: карта есть, свежая раздача остаётся. */
  env.api.run();
  env.serve([tor(H, 2)]);
  /* Выключили на неделю (плагин тоже — запуски не писались). */
  env.prefs.lumen_tsclean = false;
  env.api.apply();
  env.api.uninstall();
  env.tick(7 * 24 * HOUR);
  const list = [tor(H, 170), tor(H2, 100)];
  /* Включили пункт при выключенном плагине, потом плагин. */
  env.prefs.lumen_tsclean = true;
  env.api.apply();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve(list);
  assert.deepEqual(res, [0], 'после включения ничего не удалено');
  assert.equal(env.played()['h:' + H], T0 + 7 * 24 * HOUR);
  assert.equal(env.played()['h:' + H2], T0 + 7 * 24 * HOUR);
  /* Ошибка списка пометку не снимает: посев переносится на следующий проход. */
  env.prefs.lumen_tsclean = false; env.api.apply();
  env.prefs.lumen_tsclean = true; env.api.apply();
  env.tick(30 * HOUR);
  env.api.run((n) => res.push(n));
  env.reqs.shift().fail({ status: 0 }, 'timeout');
  env.api.run((n) => res.push(n));
  env.serve(list);
  assert.deepEqual(res, [0, null, 0]);
});

test('tsclean: seed — хэши списка с текущим временем, без раздач вне списка', () => {
  const { api } = setup();
  const out = api.seed({ ['h:' + H]: T0 - HOUR, 'h:gone': T0 - HOUR, 'm:tv:95480': T0 - HOUR }, [tor(H, 300), tor(H2, 300, withMovie(SHOW)), tor('плохой', 1)], T0);
  assert.deepEqual(out, { ['h:' + H]: T0, ['h:' + H2]: T0, 'm:tv:95480': T0 - HOUR });
  const many = [];
  for (let i = 0; i < 250; i++) many.push(tor(i.toString(16).padStart(40, '0'), 300));
  assert.equal(Object.keys(api.seed({}, many, T0)).length, 250, 'посев не обрезается на большом списке');
});

/* ------------------------- ревью: защита от потерь ------------------------- */

/* Блокирующее: плагин выключали при включённом пункте — запуски за это
   время не записаны; первый проход после включения обязан быть посевным. */
test('tsclean: плагин выключили и включили (пункт включён) — посев, раздача из перерыва цела', () => {
  const env = setup();
  env.api.install();
  env.api.run();
  env.serve([tor(H, 2)]);
  assert.equal(env.store.lumen_tsclean_seed, undefined, 'обычная работа — пометки нет');
  env.api.uninstall();
  assert.equal(env.store.lumen_tsclean_seed, '1', 'выключение плагина помечает посев');
  /* Пока плагин выключен, H2 смотрели (запись не дошла): добавлен 3 суток
     назад, H — давно. */
  env.tick(2 * 24 * HOUR);
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 50), tor(H2, 72)]);
  assert.equal(env.reqs.length, 0, 'ни одного rem');
  assert.deepEqual(res, [0]);
  assert.equal(env.played()['h:' + H2], T0 + 2 * 24 * HOUR);
  assert.equal(env.store.lumen_tsclean_seed, '');
});

test('tsclean: markOff (Lampa стартовала с выключенным плагином) — следующий проход посевной', () => {
  const env = setup();
  env.api.markOff();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 300)]);
  assert.deepEqual(res, [0]);
  assert.equal(env.played()['h:' + H], T0);
});

/* Среднее 1: план составлен до удалений; раздачу открыли посреди прохода. */
test('tsclean: раздачу открыли посреди прохода — перед каждым rem перепроверка по свежей карте', () => {
  const env = setup();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.reqs.shift().ok([tor(H, 100), tor(H2, 90), tor(H3, 80)]);
  assert.deepEqual(env.reqs[0].post, { action: 'rem', hash: H });
  /* Пока шёл rem H, в приложении TorrServe открыли H2 (только карта). */
  env.api.onTorrent({ MagnetUri: 'magnet:?xt=urn:btih:' + H2 }, null);
  env.reqs.shift().ok('');
  assert.deepEqual(env.reqs[0].post, { action: 'rem', hash: H3 }, 'H2 пропущена');
  /* А H3 тем временем запустили в плеере Lampa (current). */
  env.api.onPlay({ torrent_hash: H3 });
  env.reqs.shift().ok('');
  assert.deepEqual(res, [2], 'rem уже ушёл до запуска — счёт по факту');
  /* Следующий проход: H3 — в плеере, не трогается. */
  env.api.run((n) => res.push(n));
  env.serve([tor(H2, 90), tor(H3, 80)]);
  assert.deepEqual(res, [2, 0]);
});

test('tsclean: посреди прохода открыли плеер — проход останавливается', () => {
  const env = setup();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.reqs.shift().ok([tor(H, 100), tor(H2, 90)]);
  env.setPlayer(true);
  env.reqs.shift().ok('');
  assert.equal(env.reqs.length, 0);
  assert.deepEqual(res, [1]);
});

/* Среднее 2: выкл → вкл пункта посреди прохода — старый план недействителен. */
test('tsclean: пункт быстро выключили и включили посреди прохода — остановка, следующий проход посевной', () => {
  const env = setup();
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.reqs.shift().ok([tor(H, 100), tor(H2, 90)]);
  env.prefs.lumen_tsclean = false; env.api.apply();
  env.prefs.lumen_tsclean = true; env.api.apply();
  env.reqs.shift().ok('');
  assert.equal(env.reqs.length, 0, 'второго rem нет');
  assert.deepEqual(res, [1]);
  env.api.run((n) => res.push(n));
  env.serve([tor(H2, 90)]);
  assert.deepEqual(res, [1, 0], 'посев');
});

/* Среднее 3: неверные часы. */
test('tsclean: часы раньше MIN_CLOCK — ни прохода, ни записи; потом посев', () => {
  const env = setup({ now: Date.UTC(2000, 0, 1) });
  env.api.install();
  env.api.onPlay({ torrent_hash: H });
  assert.deepEqual(env.played(), {}, 'запуск с неверными часами не пишется');
  assert.equal(env.store.lumen_tsclean_seed, '1', '…но следующий проход — посевной');
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 1), tor(H2, 1)]);
  assert.deepEqual(res, [null], 'проход пропущен, посева тоже нет');
  /* Часы поправились (NTP). */
  env.tick(T0 - Date.UTC(2000, 0, 1));
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 300), tor(H2, 300)]);
  assert.deepEqual(res, [null, 0]);
  assert.equal(env.played()['h:' + H], T0);
});

test('tsclean: часы ушли назад (запись карты в будущем) — проход пропускается', () => {
  const env = setup({ storage: { lumen_tsclean_played: { ['h:' + H2]: T0 + 3 * HOUR } } });
  env.api.install();
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 100)]);
  assert.deepEqual(res, [null]);
  /* В пределах запаса (10 мин) — обычный проход. */
  env.tick(3 * HOUR - 5 * 60000);
  env.api.run((n) => res.push(n));
  env.serve([tor(H, 100)]);
  assert.deepEqual(res, [null, 1]);
  assert.equal(env.api.clockOk(env.api.MIN_CLOCK - 1, {}), false);
  assert.equal(env.api.clockOk(T0, {}), true);
});

test('tsclean: touch выбрасывает записи дальше 30 суток в будущем — проходы не блокируются навсегда', () => {
  const { api } = setup();
  const out = api.touch({ 'h:far': T0 + 40 * 24 * HOUR, 'h:near': T0 + HOUR }, ['h:' + H], T0);
  assert.deepEqual(Object.keys(out).sort(), ['h:' + H, 'h:near'].sort());
});

/* Низкое 4: раздач больше CAP — карта не вместит запуски всех. */
test('tsclean: раздач больше CAP — проход только сеет, ничего не удаляет', () => {
  const env = setup();
  env.api.install();
  const list = [];
  for (let i = 0; i < env.api.CAP + 5; i++) list.push(tor(i.toString(16).padStart(40, '0'), 300));
  const res = [];
  env.api.run((n) => res.push(n));
  env.serve(list);
  assert.deepEqual(res, [0]);
  assert.equal(env.reqs.length, 0);
  assert.equal(Object.keys(env.played()).length, env.api.CAP);
});

/* Испорченная карта — не «пустая существующая», а «нет карты»: посев. */
test('tsclean: карта в Storage испорчена — посевной проход, ничего не удаляется', () => {
  for (const bad of ['{битый', '[1,2]', 'null', 42]) {
    const env = setup({ storage: { lumen_tsclean_played: bad } });
    env.api.install();
    const res = [];
    env.api.run((n) => res.push(n));
    env.serve([tor(H, 300)]);
    assert.deepEqual(res, [0], String(bad));
    assert.equal(env.reqs.length, 0);
    assert.deepEqual(env.played(), { ['h:' + H]: T0 }, String(bad));
  }
  /* Строка с целым JSON-объектом — карта есть, проход обычный. */
  const ok = setup({ storage: { lumen_tsclean_played: '{}' } });
  ok.api.install();
  const res = [];
  ok.api.run((n) => res.push(n));
  ok.serve([tor(H, 300)]);
  assert.deepEqual(res, [1]);
});

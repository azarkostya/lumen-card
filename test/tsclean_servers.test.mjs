import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* «Автоочистка TorrServer» (src/66_tsclean.js) при двух адресах TorrServer
   и «Автовыборе TorrServer» (src/66_tsauto.js): оба модуля настоящие, общий
   Storage, Lampa.Torserver.url() — по torrserver_use_link. Запуски раздач
   учитываются по серверу: проход на одном сервере не стирает запуски
   другого. Сценарий первого теста — воспроизведение независимого аудита
   (Codex, 2026-11-28). */

globalThis.warn = function () { };

const ONE = 'http://192.168.1.10:8090';
const TWO = 'http://127.0.0.1:8090';
const HOUR = 3600000;
const DAY = 24 * HOUR;
const T0 = Date.UTC(2026, 10, 28, 12, 0, 0);
const HA = 'a'.repeat(40);
const HB = 'b'.repeat(40);
const HC = 'c'.repeat(40);
const HD = 'd'.repeat(40);
const SHOW = { id: 42, name: 'Сериал для проверки', original_name: 'Fixture Show' };

function setup(opts) {
  opts = opts || {};
  const store = Object.assign({ torrserver_url: ONE, torrserver_url_two: TWO, torrserver_use_link: 'one' }, opts.storage || {});
  const prefs = Object.assign({ lumen_tsclean: true, lumen_ts_auto: true, lumen_debug_hud: false }, opts.prefs || {});
  const history = [];
  const reqs = [];
  const removed = [];
  let clock = opts.now || T0;
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v) => { store[k] = v; },
      field: (k) => store[k],
      value: (k) => store[k]
    },
    Torserver: { url: () => (store.torrserver_use_link === 'two' ? store.torrserver_url_two : store.torrserver_url) },
    Platform: { is: () => false },
    Favorite: { continues: () => [], get: (p) => (p.type === 'history' ? history : []) },
    Noty: { show: () => { } },
    Listener: { follow: () => { }, remove: () => { } }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  const pref = (n, d) => (n in prefs ? prefs[n] : d);
  const { api: clean, LC } = loadCtx('66_tsclean.js', { pref });
  LC.util.playerOpen = () => false;
  const { api: auto, LC: autoLC } = loadCtx('66_tsauto.js', { pref, tsclean: clean });
  autoLC.lang = (k) => k;
  const net = () => ({
    timeout: () => { },
    clear: () => { },
    silent: (url, ok, fail, post) => {
      const body = post ? JSON.parse(post) : null;
      if (body && body.action === 'rem') removed.push(body.hash);
      reqs.push({ url, ok, fail, body });
    }
  });
  for (const api of [clean, auto]) {
    api._now = () => clock;
    api._timers = { set: () => 1, clear: () => { } };
    api._net = net;
  }
  clean.install();
  auto.install();

  function take(url) {
    const r = reqs.shift();
    assert.ok(r, 'ждали запрос ' + url);
    assert.equal(r.url, url);
    return r;
  }
  /* «Автовыбор»: which — какой адрес отвечает ('one' или только 'two'). */
  function switchTo(which) {
    clock += 61000;
    auto.check();
    if (which === 'one') take(ONE + '/echo').ok('MatriX.135');
    else {
      take(ONE + '/echo').fail({ status: 0 }, 'timeout');
      take(TWO + '/echo').ok('MatriX.135');
    }
    assert.equal(store.torrserver_use_link, which);
  }
  /* Один проход очистки на текущем адресе: список list, rem — успех. */
  function pass(list) {
    const res = [];
    const url = Lampa.Torserver.url();
    clean.run((n) => res.push(n));
    take(url + '/torrents').ok(list);
    while (reqs.length) take(url + '/torrents').ok('');
    assert.equal(res.length, 1, 'проход завершился');
    return res[0];
  }
  /* Раздача в базе TorrServer, добавлена agoH часов назад. */
  function tor(hash, agoH, card) {
    return {
      hash, title: '[LAMPA] x', stat: 5, stat_string: 'Torrent in db',
      timestamp: Math.floor((clock - agoH * HOUR) / 1000),
      data: card ? JSON.stringify({ lampa: true, movie: card }) : ''
    };
  }
  function stream(server, hash) {
    return server + '/stream/Show.S01E01.mkv?link=' + hash + '&index=1&play';
  }
  return {
    clean, auto, store, prefs, history, reqs, removed, take, switchTo, pass, tor, stream,
    tick: (ms) => { clock += ms; },
    now: () => clock
  };
}

/* ------------------------- воспроизведение потери ------------------------- */

test('tsclean+tsauto: раздачу открыли на запасном, проход на основном, вернулись — запуск цел (аудит Codex)', () => {
  const e = setup();
  /* Оба сервера уже знакомы модулю: на каждом прошёл первый проход. */
  assert.equal(e.pass([e.tor(HA, 1)]), 0);
  e.switchTo('two');
  assert.equal(e.pass([e.tor(HC, 1)]), 0);
  /* Основной уснул — на запасном открыли сериал из истории: старая
     раздача (добавлена 20 дней назад), открыта сейчас. */
  e.history.push(SHOW);
  e.clean.onTorrent({ MagnetUri: 'magnet:?xt=urn:btih:' + HB }, SHOW);
  e.clean.onPlay({ torrent_hash: HB, url: e.stream(TWO, HB), card: SHOW });
  e.clean.onStop();
  /* Основной проснулся: проход на основном (там раздачи B нет). */
  e.switchTo('one');
  assert.equal(e.pass([e.tor(HA, 1)]), 0);
  /* Снова запасной: раздачу открывали пару минут назад. */
  e.switchTo('two');
  e.pass([e.tor(HC, 1), e.tor(HB, 20 * 24, SHOW)]);
  assert.deepEqual(e.removed, [], 'раздачу, открытую пару минут назад, удалять нельзя');
});

test('tsclean+tsauto: зеркально — открыли на основном, проход на запасном, вернулись — запуск цел', () => {
  const e = setup();
  assert.equal(e.pass([e.tor(HA, 30)]), 0);
  e.switchTo('two');
  assert.equal(e.pass([e.tor(HC, 1)]), 0);
  e.switchTo('one');
  /* Через трое суток на основном открыли раздачу A (запись посева ей уже
     не защита: больше суток). */
  e.tick(3 * DAY);
  e.clean.onPlay({ torrent_hash: HA, url: e.stream(ONE, HA) });
  e.clean.onStop();
  e.switchTo('two');
  assert.equal(e.pass([e.tor(HD, 1)]), 0);
  e.switchTo('one');
  e.pass([e.tor(HA, 30 + 72)]);
  assert.deepEqual(e.removed, [], 'A открывали пару минут назад');
});

test('tsclean+tsauto: адрес сменился, пока шёл запрос списка, — проход ничего не удаляет и карту не трогает', () => {
  const e = setup();
  assert.equal(e.pass([e.tor(HA, 1), e.tor(HB, 1)]), 0);
  e.tick(3 * DAY);
  const before = JSON.stringify(e.store);
  const res = [];
  e.clean.run((n) => res.push(n));
  const list = e.take(ONE + '/torrents');
  /* Пока основной отвечал, автовыбор ушёл на запасной. */
  e.switchTo('two');
  const mid = JSON.stringify(e.store);
  list.ok([e.tor(HA, 73), e.tor(HB, 73)]);
  assert.equal(e.reqs.length, 0, 'ни одного rem');
  assert.deepEqual(res, [null], 'проход не состоялся');
  assert.equal(JSON.stringify(e.store), mid, 'Storage не тронут');
  assert.notEqual(before, mid);
});

test('tsclean+tsauto: адрес сменился посреди удалений — следующих rem нет, карта не чистится', () => {
  const e = setup();
  assert.equal(e.pass([e.tor(HA, 1), e.tor(HB, 1)]), 0);
  e.tick(3 * DAY);
  const res = [];
  e.clean.run((n) => res.push(n));
  e.take(ONE + '/torrents').ok([e.tor(HA, 74), e.tor(HB, 73)]);
  const rem = e.take(ONE + '/torrents');
  assert.deepEqual(rem.body, { action: 'rem', hash: HA });
  e.switchTo('two');
  const mid = JSON.stringify(e.store);
  rem.ok('');
  assert.equal(e.reqs.length, 0, 'второго rem нет');
  assert.deepEqual(res, [1], 'удалённое до смены — по факту');
  assert.equal(JSON.stringify(e.store), mid, 'карта не чистится');
});

test('tsclean: один TorrServer под двумя адресами — запуск через основной защищает и при проходе через запасной', () => {
  /* Основной — локальный адрес, запасной — внешний адрес того же сервера
     (дома и вне дома). В 1.3 это покрывала общая карта. */
  const OUT = 'http://tvbox.example:8090';
  const e = setup({ storage: { torrserver_url_two: OUT } });
  const use = (v) => { e.store.torrserver_use_link = v; };
  assert.equal(e.pass([e.tor(HA, 30), e.tor(HB, 30)]), 0);
  use('two');
  assert.equal(e.pass([e.tor(HA, 30), e.tor(HB, 30)]), 0);
  use('one');
  e.tick(3 * DAY);
  /* A открыли через локальный адрес. */
  e.clean.onPlay({ torrent_hash: HA, url: e.stream(ONE, HA) });
  e.clean.onStop();
  /* Вне дома — внешний адрес того же сервера. */
  use('two');
  assert.equal(e.pass([e.tor(HA, 30 + 72), e.tor(HB, 30 + 72)]), 1);
  assert.deepEqual(e.removed, [HB], 'A открывали только что — через другой адрес того же сервера');
  /* Карта внешнего адреса чистится только своим списком: запись A у
     локального адреса цела. */
  assert.equal(e.store.lumen_tsclean_servers[ONE].m['h:' + HA], e.now());
});

/* ------------------------- пометка посева по серверам ------------------------- */

test('tsclean+tsauto: плагин выключали — посевной проход на КАЖДОМ сервере, а не только на первом', () => {
  const e = setup();
  assert.equal(e.pass([e.tor(HA, 1)]), 0);
  e.switchTo('two');
  assert.equal(e.pass([e.tor(HC, 1)]), 0);
  e.switchTo('one');
  /* Плагин выключили на трое суток: запуски не писались (C на запасном
     смотрели как раз тогда). */
  e.clean.uninstall();
  e.tick(3 * DAY);
  e.clean.install();
  const res = [];
  e.clean.run((n, seeded) => res.push([n, seeded]));
  e.take(ONE + '/torrents').ok([e.tor(HA, 73)]);
  assert.deepEqual(res, [[0, true]], 'основной — посев');
  e.switchTo('two');
  e.clean.run((n, seeded) => res.push([n, seeded]));
  e.take(TWO + '/torrents').ok([e.tor(HC, 73)]);
  assert.deepEqual(res[1], [0, true], 'запасной — тоже посев');
  assert.deepEqual(e.removed, []);
  /* Дальше — обычное правило суток на обоих. */
  e.tick(25 * HOUR);
  assert.equal(e.pass([e.tor(HC, 100)]), 1);
  e.switchTo('one');
  assert.equal(e.pass([e.tor(HA, 100)]), 1);
});

/* ----------------------------- обновление с 1.3 ----------------------------- */

test('tsclean: обновление с 1.3 — общая карта не переносится, первый проход на каждом сервере посевной', () => {
  /* Общая карта 1.3 уже вычищена проходом на запасном: о запуске A на
     основном в ней ничего нет (сам баг). */
  const e = setup({ storage: { lumen_tsclean_played: { ['h:' + HC]: T0 - HOUR }, lumen_tsclean_seed: '' } });
  const res = [];
  e.clean.run((n, seeded) => res.push([n, seeded]));
  e.take(ONE + '/torrents').ok([e.tor(HA, 20 * 24), e.tor(HB, 5 * 24)]);
  assert.deepEqual(res, [[0, true]], 'посев: ничего не удалено');
  assert.equal(e.reqs.length, 0);
  assert.equal(e.store.lumen_tsclean_played, '', 'старая карта обнулена: откат на 1.3 тоже начнёт с посева');
  assert.deepEqual(e.store.lumen_tsclean_servers, { [ONE]: { t: e.now(), m: { ['h:' + HA]: e.now(), ['h:' + HB]: e.now() } } });
  /* Запасной своей карты не имеет — у него свой посев. */
  e.switchTo('two');
  e.clean.run((n, seeded) => res.push([n, seeded]));
  e.take(TWO + '/torrents').ok([e.tor(HC, 20 * 24)]);
  assert.deepEqual(res[1], [0, true]);
  /* Через сутки с посева — обычное правило. */
  e.tick(25 * HOUR);
  e.switchTo('one');
  assert.equal(e.pass([e.tor(HA, 20 * 24), e.tor(HB, 5 * 24)]), 2);
});

test('tsclean: следы 1.3 при уже заведённых картах (откат и снова обновление) — посев на всех серверах', () => {
  for (const legacy of [{ lumen_tsclean_played: { ['h:' + HA]: T0 } }, { lumen_tsclean_played: '{битый' }, { lumen_tsclean_seed: '1' }]) {
    const e = setup({ storage: Object.assign({ lumen_tsclean_servers: { [ONE]: { t: T0, m: {} }, [TWO]: { t: T0, m: {} } } }, legacy) });
    e.pass([e.tor(HA, 30)]);
    assert.deepEqual(e.removed, [], JSON.stringify(legacy));
    assert.equal(e.store.lumen_tsclean_played || '', '');
    assert.equal(e.store.lumen_tsclean_seed || '', '');
    assert.equal(e.store.lumen_tsclean_servers[TWO].s, 1, 'запасной помечен');
    e.switchTo('two');
    e.pass([e.tor(HC, 30)]);
    assert.deepEqual(e.removed, [], JSON.stringify(legacy));
  }
});

test('tsclean: запуск до первого прохода после обновления пишется в новую карту, а проход всё равно посевной', () => {
  const e = setup({ storage: { lumen_tsclean_played: { ['h:' + HC]: T0 - HOUR } } });
  e.clean.onPlay({ torrent_hash: HA, url: e.stream(ONE, HA) });
  e.clean.onStop();
  assert.equal(e.store.lumen_tsclean_played, '');
  assert.deepEqual(e.store.lumen_tsclean_servers, { [ONE]: { t: T0, s: 1, m: { ['h:' + HA]: T0 } } });
  assert.equal(e.pass([e.tor(HA, 30), e.tor(HB, 30)]), 0, 'B смотрели до обновления — посев');
});

/* ---------------------------- запись запусков ---------------------------- */

test('tsclean: norm и serverOf — один сервер при любой записи адреса', () => {
  const { clean } = setup();
  assert.equal(clean.norm('http://192.168.1.10:8090/'), ONE);
  assert.equal(clean.norm(' 192.168.1.10:8090 '), ONE, 'без протокола — http://');
  assert.equal(clean.norm('HTTPS://TS.Example:443/ts//'), 'https://ts.example:443/ts');
  assert.equal(clean.norm(''), '');
  assert.equal(clean.serverOf(ONE + '/stream/a.mkv?link=' + HA + '&index=1&play'), ONE);
  assert.equal(clean.serverOf('http://192.168.1.10:8090/play/' + HA + '/2'), ONE);
  assert.equal(clean.serverOf('https://ts.example/ts/stream/a?link=' + HA), 'https://ts.example/ts');
  assert.equal(clean.serverOf('magnet:?xt=urn:btih:' + HA), '');
  assert.equal(clean.serverOf(HA), '');
  assert.equal(clean.serverOf('https://cdn.example/video.m3u8'), '');
});

test('tsclean: запуск пишется в карту сервера, где раздачу открыли', () => {
  const e = setup({ storage: { lumen_tsclean_servers: { [ONE]: { t: T0, m: {} }, [TWO]: { t: T0, m: {} } } } });
  /* Открыто на текущем (основном) — только его карта. */
  e.clean.onTorrent({ MagnetUri: 'magnet:?xt=urn:btih:' + HA }, SHOW);
  assert.deepEqual(e.store.lumen_tsclean_servers[ONE].m, { ['h:' + HA]: T0, 'm:tv:42': T0 });
  assert.deepEqual(e.store.lumen_tsclean_servers[TWO].m, {});
  /* Поток с запасного, а адрес уже основной (автовыбор успел сменить):
     запуск — в карту запасного, и в карту текущего (только продлевает). */
  e.tick(HOUR);
  e.clean.onPlay({ torrent_hash: HB, url: e.stream(TWO, HB) });
  e.clean.onStop();
  assert.equal(e.store.lumen_tsclean_servers[TWO].m['h:' + HB], T0 + HOUR);
  assert.equal(e.store.lumen_tsclean_servers[ONE].m['h:' + HB], T0 + HOUR);
  /* Адрес в настройке записан иначе — карта та же. */
  e.store.torrserver_url = '192.168.1.10:8090/';
  e.clean.onPlay({ torrent_hash: HC, url: e.stream(ONE, HC) });
  e.clean.onStop();
  assert.deepEqual(Object.keys(e.store.lumen_tsclean_servers).sort(), [ONE, TWO].sort());
  assert.equal(e.store.lumen_tsclean_servers[ONE].m['h:' + HC], T0 + HOUR);
  /* На запасном — только запасной. */
  e.store.torrserver_url = ONE;
  e.store.torrserver_use_link = 'two';
  e.clean.onTorrent({ MagnetUri: 'magnet:?xt=urn:btih:' + HD }, null);
  assert.equal(e.store.lumen_tsclean_servers[TWO].m['h:' + HD], T0 + HOUR);
  assert.equal(e.store.lumen_tsclean_servers[ONE].m['h:' + HD], undefined);
});

test('tsclean: запуск на незнакомом сервере заводит карту с пометкой посева — первый проход там ничего не удаляет', () => {
  const e = setup({ storage: { lumen_tsclean_servers: { [ONE]: { t: T0, m: {} } } } });
  e.store.torrserver_use_link = 'two';
  e.clean.onPlay({ torrent_hash: HC, url: e.stream(TWO, HC) });
  e.clean.onStop();
  assert.deepEqual(e.store.lumen_tsclean_servers[TWO], { t: T0, s: 1, m: { ['h:' + HC]: T0 } });
  assert.equal(e.pass([e.tor(HC, 300), e.tor(HD, 300)]), 0, 'D на запасном смотрели раньше — модуль этого не знает');
  assert.equal(e.store.lumen_tsclean_servers[TWO].s, undefined, 'пометка снята посевом');
});

/* ------------------------------ размер Storage ------------------------------ */

test('tsclean: карт не больше MAX_SERVERS — самые давние уходят, вернувшийся сервер получает посев', () => {
  const e = setup();
  const max = e.clean.MAX_SERVERS;
  assert.equal(max, 4);
  const addrs = [];
  for (let i = 0; i < max + 2; i++) addrs.push('http://10.0.0.' + (i + 1) + ':8090');
  for (const a of addrs) {
    e.store.torrserver_url = a;
    e.tick(HOUR);
    assert.equal(e.pass([e.tor(HA, 1)]), 0);
    e.clean.onPlay({ torrent_hash: HB, url: e.stream(a, HB) });
    e.clean.onStop();
    assert.ok(Object.keys(e.store.lumen_tsclean_servers).length <= max);
  }
  assert.deepEqual(Object.keys(e.store.lumen_tsclean_servers).sort(), addrs.slice(2).sort(), 'остались четыре последних');
  /* Самый первый вернулся через трое суток — его карты уже нет: посев. */
  e.store.torrserver_url = addrs[0];
  e.tick(3 * DAY);
  const res = [];
  e.clean.run((n, seeded) => res.push([n, seeded]));
  e.take(addrs[0] + '/torrents').ok([e.tor(HA, 80)]);
  assert.deepEqual(res, [[0, true]]);
  assert.equal(Object.keys(e.store.lumen_tsclean_servers).length, max);
  assert.ok(addrs[0] in e.store.lumen_tsclean_servers, 'текущий сервер не вытесняется');
});

test('tsclean: union — запуски всех серверов, по ключу самое позднее; мусор пропускается', () => {
  const { clean } = setup();
  const all = {
    [ONE]: { t: T0, m: { ['h:' + HA]: T0 - HOUR, 'm:tv:42': T0 - 2 * HOUR } },
    [TWO]: { t: T0, m: { ['h:' + HA]: T0, ['h:' + HB]: 'x', 'm:tv:42': T0 - 3 * HOUR } }
  };
  assert.deepEqual(clean.union(all), { ['h:' + HA]: T0, 'm:tv:42': T0 - 2 * HOUR });
  assert.deepEqual(clean.union({}), {});
  assert.deepEqual(clean.union(null), {});
});

test('tsclean: fit — текущий сервер остаётся всегда, остальные по свежести', () => {
  const { clean } = setup();
  const all = {};
  for (let i = 1; i <= 6; i++) all['s' + i] = { t: i, m: {} };
  assert.deepEqual(Object.keys(clean.fit(all, 's1')).sort(), ['s1', 's4', 's5', 's6']);
  assert.deepEqual(Object.keys(clean.fit(all, '')).sort(), ['s3', 's4', 's5', 's6']);
  assert.deepEqual(clean.fit({}, 'x'), {});
});

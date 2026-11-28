import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

/* Аудит 2026-11-28 (Codex, ts-regressions, второй сценарий): закреп раздачи,
   которую парсер отдал ссылкой на .torrent (без магнета и поля хэша), не был
   защищён от «Автоочистки TorrServer» — очистка сверяет только хэши
   (src/66_tsclean.js, removable), а у такого закрепа hash пустой. Хэш Lampa
   получает от TorrServer уже после открытия (SERVER.hash, app.min.js
   Torrent hash()) и кладёт его в каждую строку окна файлов: Listener
   'torrent_file' render, element.torrent_hash (app.min.js list$1). */

const LINK = 'https://tracker.invalid/download/42.torrent?apikey=secret';
const hashB = 'b'.repeat(40);
const hashC = 'c'.repeat(40);
const movie = { id: 42, title: 'Фильм для проверки' };
const HOUR = 3600000;

function run(store = {}) {
  const listeners = {};
  const opened = [];
  const card = { component: 'torrents', movie };
  const Lampa = {
    Storage: { get: (k, d) => Object.hasOwn(store, k) ? store[k] : d, set: (k, v) => { store[k] = v; } },
    Activity: { active: () => card },
    Controller: { enabled: () => ({ name: 'content' }), toggle: () => {} },
    Listener: {
      follow: (name, fn) => { (listeners[name] = listeners[name] || []).push(fn); },
      remove: (name, fn) => { listeners[name] = (listeners[name] || []).filter((f) => f !== fn); }
    }
  };
  globalThis.Lampa = globalThis.window = Lampa;
  globalThis.warn = () => {};
  const tsclean = load('66_tsclean.js');
  const { api } = loadCtx('72_pins.js', {
    lang: (k) => k,
    pref: (k, d) => Object.hasOwn(store, k) ? store[k] : d,
    tsclean,
    resume: { openTorrent: (pin, c) => { opened.push([pin, c]); return true; } }
  });
  const send = (name, e) => (listeners[name] || []).forEach((fn) => fn(e));
  /* Строка списка раздач: Lampa шлёт 'torrent' onenter (65_torrents
     передаёт событие в LC.pins.onTorrent), затем, когда TorrServer вернул
     хэш, — строки окна файлов с torrent_hash. */
  const files = (hash, n = 2) => {
    send('torrent_file', { type: 'list_open', items: [], params: { movie } });
    for (let i = 0; i < n; i++) send('torrent_file', { type: 'render', element: { path: i + '.mkv', torrent_hash: hash }, params: { movie } });
  };
  return { P: api, tsclean, store, listeners, send, files, opened };
}

function pinRow(P, element) {
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { ...element, viewed: true }, menu });
  assert.equal(menu[0] && menu[0].title, 'lumen_pins_pin');
  menu[0].onSelect();
}

/* Тот же план удаления, что у прохода очистки: removable с rule.pins. */
function cleaned(tsclean, pins, hash, now) {
  const row = { hash, timestamp: (now - 26 * HOUR) / 1000, stat: 5, stat_string: 'Torrent in db' };
  return tsclean.plan([row], {}, now, '', { idle: 24 * HOUR, keep: {}, pins: pins.protectedHashes() });
}

test('закреп .torrent: хэш, который вернул сервер при открытии, сохраняется и защищает раздачу', () => {
  const { P, tsclean, files } = run();
  const release = { Link: LINK, Title: 'Release 1080p' };
  P.onTorrent({ type: 'onenter', element: release });
  files(hashB);
  pinRow(P, release);
  const pin = P.get(movie);
  assert.equal(pin.link, LINK);
  assert.equal(pin.hash, hashB);
  assert.deepEqual(P.protectedHashes(), { [hashB]: true });
  assert.deepEqual(cleaned(tsclean, P, hashB, Date.now() + 25 * HOUR), [], 'закреплённую раздачу удалять нельзя');
});

test('закреп .torrent старого формата без хэша получает его при открытии «Моей раздачи»', () => {
  const old = { 'movie:42': { key: 'movie:42', at: 100, seen: 100, magnet: '', link: LINK, hash: '', title: 'Release', quality: '', size: 0, seeds: 0 } };
  const { P, tsclean, files, opened, store } = run({ lumen_pins: old });
  assert.deepEqual(cleaned(tsclean, P, hashB, Date.now()), [hashB], 'до открытия защиты нет');
  assert.equal(P.open(movie, 0, () => assert.fail('лишний поиск')), true);
  assert.equal(opened[0][0].link, LINK);
  files(hashB);
  assert.equal(store.lumen_pins['movie:42'].hash, hashB);
  assert.equal(store.lumen_pins['movie:42'].link, LINK, 'ссылка остаётся');
  assert.deepEqual(cleaned(tsclean, P, hashB, Date.now()), []);
  /* Трекер перевыпустил .torrent: по той же ссылке — новый хэш. */
  P.open(movie, 0, () => assert.fail('лишний поиск'));
  files(hashC);
  assert.deepEqual(P.protectedHashes(), { [hashC]: true });
});

test('хэш берётся только у раздачи, которую открыли по ссылке закрепа', () => {
  const old = { 'movie:42': { key: 'movie:42', at: 100, seen: 100, magnet: '', link: LINK, hash: '', title: 'Release', quality: '', size: 0, seeds: 0 } };
  const { P, send, files, store } = run({ lumen_pins: old });
  /* Окно файлов без открытия строки (Torrent.open по хэшу из «Моих торрентов»). */
  files(hashC);
  assert.equal(store.lumen_pins['movie:42'].hash, '');
  /* Открыли по ссылке, но сервер хэш не дал и окно закрыли: list_close. */
  P.onTorrent({ type: 'onenter', element: { Link: LINK, Title: 'Release' } });
  send('torrent_file', { type: 'list_close' });
  files(hashC);
  assert.equal(store.lumen_pins['movie:42'].hash, '');
  /* Следом открыли другую раздачу — магнетом: ожидание ссылки снято. */
  P.onTorrent({ type: 'onenter', element: { Link: LINK, Title: 'Release' } });
  P.onTorrent({ type: 'onenter', element: { MagnetUri: 'magnet:?xt=urn:btih:' + 'd'.repeat(40), Title: 'Other' } });
  files('d'.repeat(40));
  assert.equal(store.lumen_pins['movie:42'].hash, '');
  /* Окно файлов другой карточки (открыли не отсюда) — не наш хэш. */
  P.onTorrent({ type: 'onenter', element: { Link: LINK, Title: 'Release' } });
  send('torrent_file', { type: 'render', element: { torrent_hash: hashC }, params: { movie: { id: 7, name: 'Другой' } } });
  files(hashC);
  assert.equal(store.lumen_pins['movie:42'].hash, '');
  /* Другая ссылка — не наш закреп. */
  P.onTorrent({ type: 'onenter', element: { Link: 'https://tracker.invalid/download/43.torrent', Title: 'Other' } });
  files(hashC);
  assert.equal(store.lumen_pins['movie:42'].hash, '');
  assert.equal(P.get(movie).hash, '');
});

test('ожидание хэша: устаревшее не срабатывает, при выключенных закрепах карта не пишется', (t) => {
  t.mock.timers.enable({ apis: ['Date'], now: 1e12 });
  const old = {
    'movie:42': { key: 'movie:42', at: 100, seen: 100, magnet: '', link: LINK, hash: '', title: 'Release', quality: '', size: 0, seeds: 0 }
  };
  const { P, files, store } = run({ lumen_pins: old });
  P.onTorrent({ type: 'onenter', element: { Link: LINK, Title: 'Release' } });
  t.mock.timers.tick(10 * 60000);
  files(hashB);
  assert.equal(store.lumen_pins['movie:42'].hash, '', 'через 10 минут окно файлов — уже не это открытие');
  store.lumen_pins_enabled = false;
  const off = run(store);
  off.P.onTorrent({ type: 'onenter', element: { Link: LINK, Title: 'Release' } });
  off.files(hashB);
  assert.equal(store.lumen_pins['movie:42'].hash, '');
});

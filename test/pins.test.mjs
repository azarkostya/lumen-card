import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const hash = 'a'.repeat(40);
const raw = 'magnet:?xt=urn:btih:' + hash + '&dn=Release&xl=42&' +
  Array.from({length: 7}, (_, i) => 'tr=udp%3A%2F%2Ftracker' + i).join('&');
const movie = {id: 6, title: 'Film'};
const show = {id: 6, name: 'Show', number_of_seasons: 3};

function run(store = {}) {
  const calls = [];
  const modal = new Map();
  const card = { component: 'full' };
  const Lampa = {
    Storage: { get: (k, d) => store[k] || d, set: (k, v) => { store[k] = v; } },
    Activity: { active: () => card },
    Modal: { listener: {
      follow: (name, fn) => modal.set(name, fn),
      remove: (name, fn) => { if (modal.get(name) === fn) modal.delete(name); }
    } },
    Noty: { show: s => calls.push(s) }
  };
  globalThis.Lampa = globalThis.window = Lampa;
  globalThis.warn = () => {};
  const {api, LC} = loadCtx('72_pins.js', {
    lang: k => k,
    pref: (k, d) => Object.hasOwn(store, k) ? store[k] : d,
    tsclean: load('66_tsclean.js'),
    resume: { openTorrent: (r, c) => { calls.push([r, c]); return true; } }
  });
  return { P: api, LC, store, calls, modal, Lampa };
}

test('закрепления: отдельный сезон, очистка magnet и предел численности', () => {
  const {P, store} = run();
  assert.equal(P.keyOf(movie, 3), 'movie:6');
  assert.equal(P.keyOf(show, 3), 'tv:6:s3');
  assert.equal(P.keyOf(show, 0), 'tv:6');
  assert.equal(P.seasonOf({title:'Show S02E05 1080p'}), 2);
  assert.equal(P.seasonOf({title:'Show S01-S03 1080p'}), 0);
  assert.equal((P.slim(raw).match(/&tr=/g) || []).length, 5);
  assert.doesNotMatch(P.slim(raw), /xl=/);
  assert.equal(P.slim('magnet:?dn=Bad'), '');
  assert.equal(P.put(show, {MagnetUri: raw, title: 'Show S02'}, 100), true);
  assert.equal(P.get(show, 3), null);
  assert.equal(P.get(show, 2).hash, hash);
  assert.equal(P.get(movie), null);
  for (let id = 1; id < 63; id++) P.put({id}, {MagnetUri:raw, title:'Film'}, 200 + id);
  assert.equal(Object.keys(store.lumen_pins).length, 60);
  assert.equal(P.get(show, 2), null);
});

test('закрепления: ссылка остаётся локальной; открытие идёт без поиска', () => {
  const {P, calls} = run();
  const link = 'https://example.org/download?apikey=sensitive';
  P.put(movie, {Link:link, title:'<b>Release</b>', size: 4000}, 100);
  const pin = P.get(movie);
  assert.equal(pin.link, link);
  assert.doesNotMatch(P.subtitle(pin), /sensitive|https|<b>/);
  assert.equal(P.open(movie, 0, () => assert.fail('лишний поиск')), true);
  assert.equal(calls[0][0].link, link);
  assert.equal(calls[0][1], movie);
  assert.equal(P.drop(pin.key), true);
  let fallback = 0;
  assert.equal(P.open(movie, 0, () => fallback++), false);
  assert.equal(fallback, 1);
});

test('закрепления: штатная ошибка раздачи ведёт в обычный поиск, постороннее окно игнорируется', (t) => {
  const {P, LC, modal} = run();
  t.mock.timers.enable({apis:['setTimeout']});
  P.put(movie, {MagnetUri:raw, title:'Release'}, 100);
  let closed = 0, fallback = 0;
  const owner = { html: { hasClass: c => c === 'modal-loading' }, onBack: () => closed++ };
  LC.resume.openTorrent = () => { modal.get('preshow')({active:owner}); return true; };
  P.open(movie, 0, () => fallback++);
  const error = { hasClass: c => c === 'error' };
  modal.get('update')({active:{}, new_html:error});
  assert.equal(fallback, 0);
  modal.get('update')({active:owner, new_html:error});
  t.mock.timers.tick(1);
  assert.equal(fallback, 1);
  assert.equal(closed, 1);
  assert.equal(P.get(movie).hash, hash, 'при сетевом сбое запись можно открыть снова');
});

test('закрепления: обычное открытие не делает запись, только ручной выбор в меню', () => {
  const {P, Lampa, store} = run();
  Lampa.Activity.active().movie = movie;
  const toggled = [];
  Lampa.Controller = { enabled: () => ({name:'content'}), toggle: n => toggled.push(n) };
  const el = {MagnetUri:raw, title:'Release', Seeders:7};
  P.onTorrent({type:'onenter', element:el});
  assert.equal(store.lumen_pins, undefined);
  const menu = [];
  P.onTorrent({type:'onlong', element:el, menu});
  assert.deepEqual(menu, [], 'Lampa ещё не подтвердила открытие');
  el.viewed = true;
  P.onTorrent({type:'onlong', element:el, menu});
  assert.equal(P.get(movie), null);
  assert.equal(menu[0].title, 'lumen_pins_pin');
  menu[0].onSelect();
  assert.deepEqual(P.protectedHashes(), {[hash]:true});
  assert.equal(P.get(movie).seeds, 7);
  P.onTorrent({type:'render', element:{...el, Seeders:12}});
  assert.equal(P.get(movie).seeds, 12);
  const unpin = [];
  el.viewed = false;
  P.onTorrent({type:'onlong', element:el, menu:unpin});
  assert.equal(unpin[0].title, 'lumen_pins_unpin');
  unpin[0].onSelect();
  assert.deepEqual(P.protectedHashes(), {});
  assert.deepEqual(toggled, ['content','content']);
});

test('закрепления: выключение сохраняет карту и проходит перезапуск', () => {
  const {P, store} = run();
  assert.equal(P.put(movie, {MagnetUri:raw, title:'Release'}, 100), true);
  store.lumen_pins_enabled = false;
  const restarted = run(store).P;
  assert.equal(restarted.get(movie), null);
  assert.equal(store.lumen_pins['movie:6'].hash, hash);
  store.lumen_pins_enabled = true;
  assert.equal(restarted.get(movie).hash, hash);
});

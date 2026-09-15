import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 31 (ревью, Minor 7): связка маркеров меню с рантаймом —
   флаг «плагин активен» (LC.applyMenusPref/LC.applyTorrentsPref ничего не
   делают, пока LC.init не дошёл до оформления), порядок mode -> install в
   init и ветки LC.followStorage для lumen_menus/lumen_torrents.
   80_settings.js и 90_runtime.js грузятся в один LC (как в бандле);
   LC.menus/LC.template/LC.injectCss — фейки с журналом вызовов. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

function setup(opts) {
  opts = opts || {};
  const log = [];
  const storage = Object.assign({ lumen_menus: 'all', lumen_torrents: 'true' }, opts.storage || {});
  const storageCbs = [];
  const Lampa = {
    Template: { all: () => ({ full_start_new: '<div>orig</div>' }), add: () => { }, get: () => '' },
    Listener: { follow: () => { } },
    Lang: { add: () => { } },
    Controller: { listener: { follow: () => { } } },
    Storage: {
      field: (name) => storage[name],
      get: (name, def) => (name in storage ? storage[name] : def),
      listener: { follow: (name, cb) => { if (name === 'change') storageCbs.push(cb); } }
    },
    Platform: { screen: () => false }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa, innerWidth: opts.width || 1920 };

  const LC = {};
  loadInto(LC, '80_settings.js');
  loadInto(LC, '90_runtime.js');
  LC.template = { build: () => '<div class="lumen-card"></div>', assert: () => ({ ok: true, missingInOurs: [] }) };
  LC.injectFonts = () => log.push('fonts');
  LC.injectCss = () => log.push('css');
  LC.menus = {
    mode: (v) => { log.push('mode:' + v); return v; },
    install: () => log.push('install')
  };
  LC.torrents = { toggle: (on) => log.push('torrents:' + on), install: () => log.push('torrents-install') };
  /* Task 32: класс режима движения на body — фейковый $('body'). */
  const body = new FakeEl(['body-mock']);
  globalThis.$ = (sel) => (sel === 'body' ? body : EMPTY);
  opts.body = body;
  return { LC, log, storage, storageCbs, body };
}

test('Task 32: LC.init после меню — LC.torrents.install и LC.applyTorrentsPref (сохранённое значение)', () => {
  const { LC, log } = setup({ storage: { lumen_torrents: 'false' } });
  LC.init();
  const i = log.indexOf('install');
  assert.deepEqual(log.slice(i, i + 3), ['install', 'torrents-install', 'torrents:false']);
});

test('Task 32: класс режима движения на body ставит LC.init, меняет LC.applyMotionMode', () => {
  const { LC, storage, body } = setup({ storage: { lumen_motion: 'full' } });
  assert.equal(body.hasClass('lumen-motion-full'), false, 'до init класса нет');
  LC.init();
  assert.equal(body.hasClass('lumen-motion-full'), true);
  storage.lumen_motion = 'off';
  LC.applyMotionMode();
  assert.equal(body.hasClass('lumen-motion-off'), true);
  assert.equal(body.hasClass('lumen-motion-full'), false);
});

test('Task 32: плагин не активен (узкая раскладка) — класс движения на body не ставится', () => {
  const { LC, body } = setup({ width: 400, storage: { lumen_motion: 'lite' } });
  LC.init();
  LC.applyMotionMode();
  assert.deepEqual(body._class, ['body-mock']);
});

test('до LC.init: applyMenusPref/applyTorrentsPref ничего не делают (плагин не активен)', () => {
  const { LC, log } = setup();
  LC.applyMenusPref();
  LC.applyTorrentsPref();
  assert.deepEqual(log, []);
});

test('LC.init на широкой раскладке: css -> mode(сохранённый) -> install, дальше смена настроек применяется', () => {
  const { LC, log, storage } = setup({ storage: { lumen_menus: 'path' } });
  LC.init();
  const i = log.indexOf('css');
  assert.deepEqual(log.slice(i, i + 3), ['css', 'mode:path', 'install']);
  log.length = 0;
  storage.lumen_menus = 'off';
  LC.applyMenusPref();
  storage.lumen_torrents = 'false';
  LC.applyTorrentsPref();
  assert.deepEqual(log, ['mode:off', 'torrents:false']);
});

test('LC.init на узкой раскладке (плагин не активируется): ни mode, ни install; настройки не ставят классы', () => {
  const { LC, log } = setup({ width: 400 });
  LC.init();
  assert.deepEqual(log, []);
  LC.applyMenusPref();
  LC.applyTorrentsPref();
  assert.deepEqual(log, []);
});

test('LC.followStorage: change lumen_menus -> mode, lumen_torrents -> toggle (строка true/false нормализуется)', () => {
  const { LC, log, storage, storageCbs } = setup();
  LC.init();
  assert.equal(storageCbs.length, 1);
  log.length = 0;
  storage.lumen_menus = 'path';
  storageCbs[0]({ name: 'lumen_menus' });
  storage.lumen_torrents = 'false';
  storageCbs[0]({ name: 'lumen_torrents' });
  storage.lumen_torrents = 'true';
  storageCbs[0]({ name: 'lumen_torrents' });
  assert.deepEqual(log, ['mode:path', 'torrents:false', 'torrents:true']);
});

test('LC.followStorage до активации (узкая раскладка): ветки lumen_menus/lumen_torrents — no-op', () => {
  const { LC, log, storageCbs } = setup({ width: 400 });
  LC.init();
  storageCbs[0]({ name: 'lumen_menus' });
  storageCbs[0]({ name: 'lumen_torrents' });
  assert.deepEqual(log, []);
});

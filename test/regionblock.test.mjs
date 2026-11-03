import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* «Без региональной блокировки» (src/66_regionblock.js): геттер на
   window.lampa_settings.lgbt — пункт включён, Lampa видит undefined и
   пропускает все три проверки; выключен — то, что она записала. */

globalThis.warn = function () { };

function setup(opts) {
  opts = opts || {};
  const prefs = Object.assign({ lumen_region_unblock: true }, opts.prefs || {});
  const S = {};
  if (opts.initial !== undefined) S.lgbt = opts.initial;
  globalThis.window = { lampa_settings: S };
  const { api } = loadCtx('66_regionblock.js', {
    pref: (n, d) => (n in prefs ? prefs[n] : d)
  });
  return { api, S, prefs };
}

test('включённый пункт прячет карту Lampa, запись после установки сохраняется', () => {
  const { api, S, prefs } = setup({ initial: { '1_movie': true } });
  assert.equal(api.install(), true);
  assert.equal(S.lgbt, undefined);
  S.lgbt = { '937287_movie': true };
  assert.equal(S.lgbt, undefined);
  prefs.lumen_region_unblock = false;
  assert.deepEqual(S.lgbt, { '937287_movie': true });
});

test('выключенный пункт — карта как есть', () => {
  const { api, S } = setup({ prefs: { lumen_region_unblock: false }, initial: { '1_movie': true } });
  api.install();
  assert.deepEqual(S.lgbt, { '1_movie': true });
});

test('uninstall возвращает обычное свойство с последним значением', () => {
  const { api, S } = setup();
  api.install();
  S.lgbt = { a: true };
  api.uninstall();
  assert.equal(api.installed(), false);
  assert.deepEqual(S.lgbt, { a: true });
  const d = Object.getOwnPropertyDescriptor(S, 'lgbt');
  assert.equal(d.writable, true);
  assert.equal(api.install(), true);
  assert.equal(S.lgbt, undefined);
});

test('без lampa_settings install ничего не делает', () => {
  globalThis.window = {};
  const { api } = loadCtx('66_regionblock.js', { pref: () => true });
  assert.equal(api.install(), false);
  api.uninstall();
});

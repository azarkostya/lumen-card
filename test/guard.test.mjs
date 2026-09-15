import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

test('гард экспорта: без метки lumen — чужой module.exports не трогаем', () => {
  const LC = {};
  const module = { exports: 'host' };
  new Function('LC', 'module', src)(LC, module);
  assert.equal(module.exports, 'host');
});

test('гард экспорта: с меткой lumen — LC.util экспортируется', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', src)(LC, module);
  assert.equal(typeof module.exports, 'object');
  assert.equal(typeof module.exports.fmtTime, 'function');
});

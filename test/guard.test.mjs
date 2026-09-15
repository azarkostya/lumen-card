import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const utilSrc = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

test('10_util.js гард экспорта: без метки lumen — чужой module.exports не трогаем', () => {
  const LC = {};
  const module = { exports: 'host' };
  new Function('LC', 'module', utilSrc)(LC, module);
  assert.equal(module.exports, 'host');
});

test('10_util.js гард экспорта: с меткой lumen — LC.util экспортируется', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', utilSrc)(LC, module);
  assert.equal(typeof module.exports, 'object');
  assert.equal(typeof module.exports.fmtTime, 'function');
});

const progressSrc = readFileSync(new URL('../src/70_progress.js', import.meta.url), 'utf8');

test('70_progress.js гард экспорта: без метки lumen — чужой module.exports не трогаем', () => {
  const LC = {};
  const module = { exports: 'host' };
  new Function('LC', 'module', progressSrc)(LC, module);
  assert.equal(module.exports, 'host');
});

test('70_progress.js гард экспорта: с меткой lumen — LC.progress экспортируется', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', progressSrc)(LC, module);
  assert.equal(typeof module.exports, 'object');
  assert.equal(typeof module.exports.movieProgress, 'function');
  assert.equal(typeof module.exports.serialProgress, 'function');
});

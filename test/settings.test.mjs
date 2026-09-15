import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const motionModeFor = load('80_settings.js');

test('motionModeFor: значение не auto -> возвращается как есть, платформа не важна', () => {
  assert.equal(motionModeFor('full', {}), 'full');
  assert.equal(motionModeFor('lite', { tizen: true }), 'lite');
  assert.equal(motionModeFor('off', { webos: true }), 'off');
});

test('motionModeFor: auto на tizen/webos -> lite', () => {
  assert.equal(motionModeFor('auto', { tizen: true }), 'lite');
  assert.equal(motionModeFor('auto', { webos: true }), 'lite');
  assert.equal(motionModeFor('auto', { tizen: true, webos: true }), 'lite');
});

test('motionModeFor: auto на прочих платформах -> full', () => {
  assert.equal(motionModeFor('auto', {}), 'full');
  assert.equal(motionModeFor('auto', { tizen: false, webos: false }), 'full');
  assert.equal(motionModeFor('auto'), 'full');
});

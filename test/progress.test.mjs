import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const progress = load('70_progress.js');

test('movieProgress: фильм с percent 43 -> view.percent === 43', () => {
  const movie = { original_title: 'Dune: Part Two' };
  const view = () => ({ percent: 43 });
  const hash = (s) => 'h:' + s;
  const found = progress.movieProgress(movie, view, hash);
  assert.equal(found.view.percent, 43);
  assert.equal(found.season, 0);
  assert.equal(found.episode, 0);
});

test('serialProgress: находит сезон/серию по хэшу h:23Fallout', () => {
  const movie = { original_name: 'Fallout', number_of_seasons: 2 };
  const hash = (s) => 'h:' + s;
  const view = (h) => (h === 'h:23Fallout' ? { percent: 60, updated: 1 } : null);
  const found = progress.serialProgress(movie, view, hash);
  assert.equal(found.season, 2);
  assert.equal(found.episode, 3);
});

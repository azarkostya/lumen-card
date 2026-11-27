import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const data = JSON.parse(readFileSync(new URL('./fixtures/release_titles.json', import.meta.url), 'utf8'));
const epparse = () => load('64_epparse.js');
const exact = ({ seasons, from, to, total, single, known }) => ({ seasons, from, to, total, single, known });

test('разбирает все дословные названия раунда 0 без ложной галочки', () => {
  const api = epparse();
  assert.equal(data.tv.length, 24);
  for (const { title, expected } of data.tv) {
    const parsed = api.parse(title);
    assert.deepEqual(exact(parsed), expected, title);
    if (expected.to === 7 && expected.total === 8) {
      assert.equal(api.verdict(parsed, { season: 1, episode: 8 }), 'upto', title);
    }
    for (let s = 1; s <= 6; s++) for (let e = 1; e <= 13; e++) {
      const result = api.verdict(parsed, { season: s, episode: e });
      const present = expected.seasons.includes(s) && e >= expected.from && e <= expected.to;
      assert.equal(result === 'has', present, title + ' S' + s + 'E' + e);
    }
  }
});

test('форматы, границы и неоднозначные названия из синтетической выборки', () => {
  const api = epparse();
  for (const { title, expected } of data.synthetic) assert.deepEqual(exact(api.parse(title)), expected, title);
});

test('вердикт различает серию в раздаче, верхнюю границу и другой сезон', () => {
  const api = epparse();
  const verdict = (title, episode, season = 2) => api.verdict(api.parse(title), { season, episode });
  assert.equal(verdict('Сериал (2 сезон: 1-7 серии из 8)', 8), 'upto');
  assert.equal(verdict('Сериал (2 сезон: 1-7 серии из 8)', 7), 'has');
  assert.equal(verdict('Сериал (2 сезон: 3-7 серии из 8)', 2), 'unknown');
  assert.equal(verdict('Сериал (3 сезон: 1-7 серии из 8)', 5), 'other_season');
  assert.equal(verdict('Сериал [S01-02]', 5), 'unknown');
  assert.equal(verdict('Сериал [12 из 12]', 12), 'unknown');
  assert.equal(verdict('Сериал S02E05', 0), 'unknown');
});

test('сквозной диапазон раздачи «Медленные лошади» не обещает конкретную серию сезона', () => {
  const api = epparse();
  const { title, expected } = data.acceptance[0];
  const parsed = api.parse(title);
  assert.deepEqual(exact(parsed), expected);
  assert.equal(api.verdict(parsed, { season: 3, episode: 5 }), 'unknown');
  assert.equal(api.verdict(parsed, { season: 6, episode: 36 }), 'unknown');
});

test('полный набор из нескольких сезонов подтверждает серию каждого сезона', () => {
  const api = epparse();
  const { title, expected } = data.acceptance[1];
  const parsed = api.parse(title);
  assert.deepEqual(exact(parsed), expected);
  for (const season of [1, 3, 6]) {
    assert.equal(api.verdict(parsed, { season, episode: 5 }), 'has');
    assert.equal(api.verdict(parsed, { season, episode: 36 }), 'has');
  }
  assert.equal(api.verdict(parsed, { season: 7, episode: 5 }), 'other_season');
  assert.equal(api.verdict(parsed, { season: 3, episode: 37 }), 'upto');
  const partial = api.parse(title.replace('1-36', '1-35'));
  assert.equal(partial.known, true);
  assert.equal(api.verdict(partial, { season: 3, episode: 5 }), 'unknown');
  assert.equal(api.verdict(api.parse(title.replace('1-36', '2-36')), { season: 3, episode: 5 }), 'unknown');
});

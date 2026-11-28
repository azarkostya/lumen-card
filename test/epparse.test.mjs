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

/* «Из 36» — число серий на дату публикации раздачи, а не всего у сезонов.
   Когда у сезона внутри диапазона выходит новая серия, старый пакет её не
   содержит, но сквозной счёт «1-36 из 36» этого не выдаёт. Поэтому ни
   полный, ни неполный многосезонный пакет не подтверждает серию сезона. */
test('«(1-6 сезоны: 1-36 серии из 36)»: многосезонный пакет не ручается за серию сезона, даже полный', () => {
  const api = epparse();
  const [, full, partial] = data.acceptance;
  const parsedFull = api.parse(full.title);
  assert.deepEqual(exact(parsedFull), full.expected);
  assert.equal(api.verdict(parsedFull, { season: 3, episode: 5 }), 'unknown');
  assert.equal(api.verdict(parsedFull, { season: 6, episode: 6 }), 'unknown');
  assert.equal(api.verdict(parsedFull, { season: 1, episode: 1 }), 'unknown');
  assert.equal(api.verdict(parsedFull, { season: 7, episode: 1 }), 'other_season');
  const parsedPartial = api.parse(partial.title);
  assert.deepEqual(exact(parsedPartial), partial.expected);
  assert.equal(api.verdict(parsedPartial, { season: 3, episode: 5 }), 'unknown');
  /* Сквозная запись цифрами с полным набором — то же правило. */
  assert.equal(api.verdict(api.parse('Сериал [01-03x01-30 из 30]'), { season: 2, episode: 4 }), 'unknown');
});

test('старый пакет «1-2 сезоны: 1-12 серии из 12» не получает галочку новой S2E7', () => {
  const api = epparse();
  const parsed = api.parse('Сериал (1-2 сезоны: 1-12 серии из 12) / WEB-DL (1080p)');
  /* Пакет остаётся разобранным и подходящим по сезону: диапазон S1-2 виден. */
  assert.deepEqual(exact(parsed), { seasons: [1, 2], from: 1, to: 12, total: 12, single: false, known: true });
  assert.equal(api.verdict(parsed, { season: 2, episode: 7 }), 'unknown');
  assert.equal(api.verdict(parsed, { season: 2, episode: 1 }), 'unknown');
  assert.equal(api.verdict(parsed, { season: 1, episode: 6 }), 'unknown');
  assert.equal(api.verdict(parsed, { season: 3, episode: 1 }), 'other_season');
  /* Один сезон с явным диапазоном серий — покрытие доказано, галочка остаётся. */
  assert.equal(api.verdict(api.parse('Сериал (2 сезон: 1-12 серии из 12) / WEB-DL (1080p)'), { season: 2, episode: 7 }), 'has');
  assert.equal(api.verdict(api.parse('Сериал / Сезон: 2 / Серии: 1-12 из 12 [2026, WEB-DL 1080p]'), { season: 2, episode: 7 }), 'has');
  assert.equal(api.verdict(api.parse('Сериал (2 сезон: 1-12 серии из 12)'), { season: 2, episode: 13 }), 'upto');
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const S = load('43_sources.js');

// --- buildRequest ---
test('buildRequest discover: url и params с page и langs', () => {
  const r = S.buildRequest({ type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } }, 'movie', 2);
  assert.equal(r.url, 'discover/movie');
  assert.deepEqual(r.params, { genres: 35, keywords: 207317, sort_by: 'popularity.desc', page: 2 });
  assert.equal(r.life, 720);
});
test('buildRequest collection/list: page игнорируется, кэш неделя', () => {
  assert.deepEqual(S.buildRequest({ type: 'collection', id: 10 }, 'movie', 3), { url: 'collection/10', params: {}, life: 10080 });
  assert.deepEqual(S.buildRequest({ type: 'list', id: 10 }, 'movie', 1), { url: 'list/10', params: {}, life: 10080 });
});
test('buildRequest discover page по умолчанию 1', () => {
  const r = S.buildRequest({ type: 'discover', params: { genres: 35 } }, 'tv');
  assert.equal(r.params.page, 1);
});
test('buildRequest discover tv', () => {
  const r = S.buildRequest({ type: 'discover', params: { networks: 213 } }, 'tv', 3);
  assert.equal(r.url, 'discover/tv');
  assert.equal(r.params.page, 3);
});

// --- normalize ---
test('normalize: parts/items -> results, служебные поля', () => {
  const c = S.normalize('collection', { name: 'Звёздные Войны', parts: [{ id: 2, release_date: '1980-05-17' }, { id: 1, release_date: '1977-05-25' }] });
  assert.deepEqual(c.results.map(function(x) { return x.id; }), [1, 2]); // по дате выхода
  assert.equal(c.total_results, 2); assert.equal(c.total_pages, 1); assert.equal(c.page, 1);
  const l = S.normalize('list', { name: 'Top 50', items: [{ id: 5 }], total_results: 50, total_pages: 3, page: 2 });
  assert.deepEqual(l.results, [{ id: 5 }]); assert.equal(l.total_pages, 3); assert.equal(l.page, 2);
  const d = S.normalize('discover', { results: [{ id: 9 }], total_results: 1, total_pages: 1, page: 1 });
  assert.deepEqual(d.results, [{ id: 9 }]);
  assert.deepEqual(S.normalize('discover', null).results, []);
});
test('normalize collection: сортировка по возрастанию даты', () => {
  const c = S.normalize('collection', { parts: [
    { id: 3, release_date: '1983-05-25' },
    { id: 1, release_date: '1977-05-25' },
    { id: 2, release_date: '1980-05-17' }
  ]});
  assert.deepEqual(c.results.map(function(x) { return x.id; }), [1, 2, 3]);
});
test('normalize: нет release_date — ставится в конец', () => {
  const c = S.normalize('collection', { parts: [
    { id: 2, release_date: '2020-01-01' },
    { id: 3 },
    { id: 1, release_date: '2015-01-01' }
  ]});
  assert.equal(c.results[0].id, 1);
  assert.equal(c.results[1].id, 2);
  assert.equal(c.results[2].id, 3);
});
test('normalize list пустые items', () => {
  const l = S.normalize('list', { items: [] });
  assert.deepEqual(l.results, []);
  assert.equal(l.total_results, 0);
});
test('normalize discover пустой json', () => {
  const d = S.normalize('discover', {});
  assert.deepEqual(d.results, []);
});

// --- discoverUrl ---
test('discoverUrl: query-строка для category_full, filter раскрывается', () => {
  assert.equal(S.discoverUrl({ type: 'discover', params: { genres: 35, keywords: 207317, filter: { 'vote_count.gte': 200 } } }, 'movie'),
    'discover/movie?with_genres=35&with_keywords=207317&vote_count.gte=200');
  assert.equal(S.discoverUrl({ type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc', orig_lang: 'ja' } }, 'tv'),
    'discover/tv?with_networks=2552&sort_by=popularity.desc&with_original_language=ja');
});
test('discoverUrl: пустые params', () => {
  assert.equal(S.discoverUrl({ type: 'discover', params: {} }, 'movie'), 'discover/movie');
});
test('discoverUrl: watch_providers и watch_region', () => {
  const u = S.discoverUrl({ type: 'discover', params: { watch_providers: 8, watch_region: 'US' } }, 'movie');
  assert.ok(u.indexOf('with_watch_providers=8') >= 0);
  assert.ok(u.indexOf('watch_region=US') >= 0);
});
test('discoverUrl: companies', () => {
  const u = S.discoverUrl({ type: 'discover', params: { companies: 3 } }, 'movie');
  assert.ok(u.indexOf('with_companies=3') >= 0);
});

// --- kpToFinds ---
test('kpToFinds: items -> список imdbId без пустых, не больше лимита', () => {
  assert.deepEqual(S.kpToFinds({ items: [{ imdbId: 'tt1' }, { imdbId: null }, { imdbId: 'tt2' }, { imdbId: 'tt3' }] }, 2), ['tt1', 'tt2']);
});
test('kpToFinds: пустой json', () => {
  assert.deepEqual(S.kpToFinds(null, 10), []);
  assert.deepEqual(S.kpToFinds({}, 10), []);
});
test('kpToFinds: все с imdbId', () => {
  assert.deepEqual(S.kpToFinds({ items: [{ imdbId: 'tt1' }, { imdbId: 'tt2' }] }, 10), ['tt1', 'tt2']);
});

// --- mergeMedia ---
test('mergeMedia: фильмы и сериалы чередуются; дубли — только внутри той же медиа (I1: ключ media:id)', () => {
  // movie:1 != tv:1 — фильм и сериал с одинаковым TMDB id разные объекты, оба попадают
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 1 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 3, 2, 1]);
});
test('mergeMedia: только movies', () => {
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }], []);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 2]);
});
test('mergeMedia: только tv', () => {
  const m = S.mergeMedia([], [{ id: 3 }, { id: 4 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [3, 4]);
});
test('mergeMedia: null входы', () => {
  assert.deepEqual(S.mergeMedia(null, null), []);
  assert.deepEqual(S.mergeMedia(null, [{ id: 1 }]), [{ id: 1 }]);
});
test('mergeMedia: длинный список movies и короткий tv', () => {
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }, { id: 3 }], [{ id: 4 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 4, 2, 3]);
});

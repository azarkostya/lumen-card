import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 23 (фаза 3): рулетка «Что посмотреть» — две отдельные (фильмы и
   сериалы), выбор подборок чипами, фильтры «не смотрел» и «есть 90 минут» /
   «серия до 30 минут».

   Здесь — чистая часть (пул кандидатов, фильтры, выбор, план барабана,
   разбор сохранённого набора подборок и проверка длительности по деталям) и
   те куски рантайма, что можно спросить без DOM: список подборок для медиа и
   чтение настроек. Сам компонент lumen_roulette проверяется живьём. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const SRC = readFileSync(new URL('../src/56_roulette.js', import.meta.url), 'utf8');
const UTIL = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', UTIL)(LC, module);
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const R = fresh().api;

const movie = (id, extra) => Object.assign({ id, title: 'Фильм ' + id, release_date: '2020-01-01' }, extra || {});
const show = (id, extra) => Object.assign({ id, name: 'Сериал ' + id, first_air_date: '2020-01-01' }, extra || {});

/* ====================================================================== */
/* Пул кандидатов                                                         */
/* ====================================================================== */

test('buildPool: фильмы отделяются от сериалов по полям названия и даты', () => {
  const mixed = [movie(1), show(2), movie(3), show(4)];
  assert.deepEqual(R.buildPool(mixed, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.buildPool(mixed, 'tv').map((c) => c.id), [2, 4]);
});

test('buildPool: media_type сильнее догадки по полям', () => {
  const odd = [{ id: 7, title: 'Док', media_type: 'tv' }, { id: 8, name: 'Странное', media_type: 'movie' }];
  assert.deepEqual(R.buildPool(odd, 'tv').map((c) => c.id), [7]);
  assert.deepEqual(R.buildPool(odd, 'movie').map((c) => c.id), [8]);
});

test('buildPool: дубли по id снимаются, мусор пропускается', () => {
  const list = [movie(1), movie(1), null, { title: 'без id' }, movie(2)];
  assert.deepEqual(R.buildPool(list, 'movie').map((c) => c.id), [1, 2]);
  assert.deepEqual(R.buildPool(null, 'movie'), []);
});

test('buildPool: карточки без постера не годятся — барабану нечего показать', () => {
  const list = [movie(1, { poster_path: '/a.jpg' }), movie(2, { poster_path: '' }), movie(3)];
  const pool = R.buildPool(list, 'movie', true);
  assert.deepEqual(pool.map((c) => c.id), [1], 'с требованием постера остаётся только первый');
  assert.equal(R.buildPool(list, 'movie').length, 3, 'без требования — все');
});

/* ====================================================================== */
/* Фильтры                                                               */
/* ====================================================================== */

const ctx = {
  isSeen: (id) => id === 2,
  runtime: (id) => ({ 1: 80, 2: 120, 3: null, 4: 140 }[id])
};

test('applyFilters: «не смотрел» убирает просмотренное', () => {
  const pool = [movie(1), movie(2), movie(3)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true }, ctx, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.applyFilters(pool, {}, ctx, 'movie').map((c) => c.id), [1, 2, 3]);
});

test('applyFilters: «есть 90 минут» — короткие и те, чья длительность ещё неизвестна', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, ctx, 'movie').map((c) => c.id), [1, 3],
    'неизвестная длительность (3) остаётся — её проверят после выбора');
});

test('applyFilters: у сериалов порог другой — серия до 30 минут', () => {
  const tvCtx = { isSeen: () => false, runtime: (id) => ({ 10: 25, 11: 45, 12: null }[id]) };
  const pool = [show(10), show(11), show(12)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, tvCtx, 'tv').map((c) => c.id), [10, 12]);
});

test('applyFilters: оба фильтра вместе; пустой результат — пустой массив', () => {
  const pool = [movie(1), movie(2), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, ctx, 'movie').map((c) => c.id), [1]);
  assert.deepEqual(R.applyFilters([], { unseen: true }, ctx, 'movie'), []);
  assert.deepEqual(R.applyFilters(null, {}, ctx, 'movie'), []);
});

test('applyFilters: без ctx фильтры ничего не выбрасывают — данных для отказа нет', () => {
  const pool = [movie(1), movie(2)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, null, 'movie').map((c) => c.id), [1, 2]);
});

test('shortLimit: 90 минут фильму, 30 — серии', () => {
  assert.equal(R.shortLimit('movie'), 90);
  assert.equal(R.shortLimit('tv'), 30);
});

test('fitsShort: проверка выбранного по деталям — фильм по runtime, сериал по длине серии', () => {
  assert.equal(R.fitsShort({ runtime: 88 }, 'movie'), true);
  assert.equal(R.fitsShort({ runtime: 140 }, 'movie'), false);
  assert.equal(R.fitsShort({ episode_run_time: [22, 25] }, 'tv'), true);
  assert.equal(R.fitsShort({ episode_run_time: [52] }, 'tv'), false);
  assert.equal(R.fitsShort({ episode_run_time: [] }, 'tv'), true, 'нечего проверить — кандидат остаётся');
  assert.equal(R.fitsShort(null, 'movie'), true, 'деталей нет — не отказываем');
  assert.equal(R.fitsShort({ runtime: 0 }, 'movie'), true, 'ноль у TMDB означает «неизвестно»');
});

/* ====================================================================== */
/* Выбор и барабан                                                        */
/* ====================================================================== */

test('pick: равномерный выбор из пула', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.equal(R.pick(pool, () => 0).id, 1);
  assert.equal(R.pick(pool, () => 0.999).id, 4);
  assert.equal(R.pick(pool, () => 0.5).id, 3);
  assert.equal(R.pick([], Math.random), null);
  assert.equal(R.pick(null, Math.random), null);
});

test('pick: за много бросков достаются все элементы пула', () => {
  const pool = [movie(1), movie(2), movie(3)];
  const seen = new Set();
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 200; i++) seen.add(R.pick(pool, rnd).id);
  assert.equal(seen.size, 3);
});

test('spinPlan: разгон, вращение, торможение — 3100 мс ± 50, последний шаг на результате', () => {
  const plan = R.spinPlan(10);
  assert.ok(plan.length > 10, 'шагов должно быть больше, чем позиций ленты: ' + plan.length);
  const total = plan.reduce((sum, s) => sum + s.delay, 0);
  assert.ok(Math.abs(total - 3100) <= 50, 'длительность спина: ' + total);
  assert.equal(plan[plan.length - 1].index, 9, 'последний шаг — выбранный кадр (конец ленты)');
  for (const step of plan) {
    assert.ok(step.index >= 0 && step.index < 10, 'индекс вне ленты: ' + step.index);
    assert.ok(step.delay > 0);
  }
});

test('spinPlan: барабан ускоряется, потом тормозит', () => {
  const plan = R.spinPlan(12);
  const first = plan[0].delay;
  const middle = plan[Math.floor(plan.length / 2)].delay;
  const last = plan[plan.length - 1].delay;
  assert.ok(middle < first, 'в середине шаги чаще, чем в начале');
  assert.ok(last > middle, 'к концу барабан замедляется');
});

test('spinPlan: короткая лента и вырожденные значения', () => {
  assert.deepEqual(R.spinPlan(0), []);
  assert.deepEqual(R.spinPlan(1), [{ index: 0, delay: 0 }], 'один кандидат — крутить нечего');
  const plan = R.spinPlan(2);
  assert.equal(plan[plan.length - 1].index, 1);
});

/* ====================================================================== */
/* Подборки и сохранённый выбор                                           */
/* ====================================================================== */

const manifest = {
  home: ['trend', 'marvel'],
  collections: [
    { id: 'trend', title: 'В тренде', group: 'top', sources: { movie: { type: 'discover' }, tv: { type: 'discover' } } },
    { id: 'marvel', title: 'Marvel', group: 'franchise', sources: { movie: { type: 'collection', id: 1 } } },
    { id: 'hbo', title: 'HBO', group: 'studio', sources: { tv: { type: 'discover' } } },
    { id: 'kp', title: 'Кинопоиск', group: 'kp', sources: { movie: { type: 'kp', collection: 'TOP' } } }
  ]
};

test('collectionsFor: только подборки с источником нужного медиа, подборки главной первыми', () => {
  const movies = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(movies.map((c) => c.id), ['trend', 'marvel', 'kp']);
  const tv = R.collectionsFor(manifest, 'tv');
  assert.deepEqual(tv.map((c) => c.id), ['trend', 'hbo']);
  assert.deepEqual(R.collectionsFor(null, 'movie'), []);
});

test('chipList: на экране не весь каталог, но отмеченное видно всегда', () => {
  const list = [];
  for (let i = 0; i < 30; i++) list.push({ id: 'c' + i, title: 'c' + i });
  const shown = R.chipList(list, [], 14);
  assert.equal(shown.length, 14, 'предел соблюдён');
  assert.deepEqual(shown.map((c) => c.id), list.slice(0, 14).map((c) => c.id));

  const withPicked = R.chipList(list, ['c25'], 14);
  assert.equal(withPicked.length, 15, 'отмеченная подборка добавлена сверх предела');
  assert.equal(withPicked[withPicked.length - 1].id, 'c25');

  const already = R.chipList(list, ['c2'], 14);
  assert.equal(already.length, 14, 'отмеченная внутри предела второй раз не добавляется');
  assert.deepEqual(R.chipList([], ['c1'], 14), []);
  assert.deepEqual(R.chipList(null, [], 14), []);
});

test('parseIds / joinIds: сохранённый набор подборок — строка через запятую', () => {
  assert.deepEqual(R.parseIds('trend,marvel'), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(' trend , , marvel '), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(''), []);
  assert.deepEqual(R.parseIds(null), []);
  assert.equal(R.joinIds(['trend', 'marvel']), 'trend,marvel');
  assert.equal(R.joinIds([]), '');
});

test('sourcesFor: пустой выбор — подборки главной, иначе выбранные, не больше предела', () => {
  const all = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(R.sourcesFor(all, [], manifest).map((c) => c.id), ['trend', 'marvel'],
    '«Все» означает набор главной, а не полторы сотни запросов');
  assert.deepEqual(R.sourcesFor(all, ['kp'], manifest).map((c) => c.id), ['kp']);
  assert.deepEqual(R.sourcesFor(all, ['нет-такой'], manifest).map((c) => c.id), ['trend', 'marvel'],
    'неизвестные id — как будто выбора нет');
  const many = [];
  for (let i = 0; i < 12; i++) many.push({ id: 'c' + i, title: 'c' + i, sources: { movie: {} } });
  assert.equal(R.sourcesFor(many, many.map((c) => c.id), manifest).length, R.MAX_SOURCES);
});

/* ====================================================================== */
/* Настройки                                                              */
/* ====================================================================== */

test('unseenDefault: настройка lumen_roulette_unseen включена по умолчанию', () => {
  const on = fresh({ pref: (name, def) => def });
  assert.equal(on.api.unseenDefault(), true);
  const off = fresh({ pref: (name, def) => (name === 'lumen_roulette_unseen' ? false : def) });
  assert.equal(off.api.unseenDefault(), false);
});

test('storageKey: у фильмов и сериалов свои наборы подборок', () => {
  assert.equal(R.storageKey('movie'), 'lumen_roulette_movie');
  assert.equal(R.storageKey('tv'), 'lumen_roulette_tv');
});

test('normalizeMedia: чужое значение — фильмы', () => {
  assert.equal(R.normalizeMedia('tv'), 'tv');
  assert.equal(R.normalizeMedia('movie'), 'movie');
  assert.equal(R.normalizeMedia('мусор'), 'movie');
  assert.equal(R.normalizeMedia(undefined), 'movie');
});

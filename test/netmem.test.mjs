import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* Полоса «память за долгий сеанс» (2026-09-27): LC.netmem
   (src/58_netmem.js) оборачивает Lampa.Api.full и Lampa.Api.sources.tmdb.get:
   колбэки уходят в Lampa трамплинами (после первого вызова пусты), у
   Api.full params — копия без activity. Request.silent Lampa держит каждый
   запрос в _calls до clear() (app.min.js:33296-33318) — теперь там пустые
   коробки, а не экраны. */

globalThis.warn = function () {};
globalThis.window = globalThis;

function makeEnv(opts) {
  opts = opts || {};
  const calls = { full: [], get: [] };
  const fullOrig = function (params, ok, err) { calls.full.push({ params, ok, err, self: this }); return 'full-ret'; };
  const getOrig = function (method, params, ok, err, cache) { calls.get.push({ method, params, ok, err, cache, self: this, n: arguments.length }); return 'get-ret'; };
  const tmdb = { get: getOrig };
  globalThis.Lampa = { Api: { full: fullOrig, sources: { tmdb } } };
  const env = { calls, fullOrig, getOrig, tmdb, pref: opts.pref !== false };
  const { api } = loadCtx('58_netmem.js', { pref: (name, def) => (name === 'lumen_netmem' ? env.pref : def) });
  env.api = api;
  return env;
}

test('netmem: install оборачивает Api.full и tmdb.get, аргументы и this — насквозь', () => {
  const env = makeEnv();
  assert.equal(env.api.install(), true);
  assert.notEqual(Lampa.Api.full, env.fullOrig);
  assert.notEqual(env.tmdb.get, env.getOrig);
  const r = env.tmdb.get('movie/1', { langs: 'en' }, () => {}, () => {}, { life: 5 });
  assert.equal(r, 'get-ret');
  const c = env.calls.get[0];
  assert.equal(c.method, 'movie/1');
  assert.deepEqual(c.params, { langs: 'en' });
  assert.deepEqual(c.cache, { life: 5 }, 'пятый аргумент (кэш) — насквозь');
  assert.equal(c.self, env.tmdb, 'this — объект источника');
  assert.equal(Lampa.Api.full({ id: 1, method: 'movie' }, () => {}, () => {}), 'full-ret');
});

test('netmem: трамплин зовёт настоящий колбэк один раз и после этого пуст', () => {
  const env = makeEnv();
  env.api.install();
  const got = [];
  env.tmdb.get('movie/2', {}, (json) => got.push(['ok', json]), (e) => got.push(['err', e]));
  const c = env.calls.get[0];
  c.ok({ id: 2 });
  c.ok({ id: 3 });
  c.err('late');
  assert.deepEqual(got, [['ok', { id: 2 }]], 'второй вызов и ошибка после ответа — никуда');
  const got2 = [];
  env.tmdb.get('movie/4', {}, (j) => got2.push(['ok', j]), (e) => got2.push(['err', e]));
  env.calls.get[1].err('boom');
  env.calls.get[1].ok({});
  assert.deepEqual(got2, [['err', 'boom']]);
});

test('netmem: сезонная поправка get$c — трамплины уходят дальше и срабатывают позже', () => {
  const env = makeEnv();
  env.api.install();
  const got = [];
  env.tmdb.get('tv/1/season/3', {}, (j) => got.push(j), () => got.push('err'));
  const first = env.calls.get[0];
  /* Lampa: ошибка первого запроса -> seasonFix(…, oncomplite, onerror) -> новый запрос, ответ позже. */
  const later = { ok: first.ok, err: first.err };
  later.ok({ season: 3 });
  assert.deepEqual(got, [{ season: 3 }]);
});

test('netmem: Api.full получает params без activity, исходный объект не тронут', () => {
  const env = makeEnv();
  env.api.install();
  const activity = { component: { html: {} } };
  const params = { id: 7, method: 'movie', source: 'tmdb', card: { id: 7 }, activity };
  let data = null;
  Lampa.Api.full(params, (d) => { data = d; }, () => {});
  const c = env.calls.full[0];
  assert.equal('activity' in c.params, false, 'activity не уходит в Lampa');
  assert.deepEqual(c.params, { id: 7, method: 'movie', source: 'tmdb', card: { id: 7 } });
  assert.equal(params.activity, activity, 'объект активности Lampa — как был');
  c.ok({ movie: { id: 7 } });
  assert.deepEqual(data, { movie: { id: 7 } });
  const plain = { id: 8, method: 'tv' };
  Lampa.Api.full(plain, () => {}, () => {});
  assert.equal(env.calls.full[1].params, plain, 'без activity — тот же объект, без копии');
});

test('netmem: uninstall возвращает оригиналы; чужая обёртка поверх нашей — остаётся', () => {
  const env = makeEnv();
  env.api.install();
  env.api.uninstall();
  assert.equal(Lampa.Api.full, env.fullOrig);
  assert.equal(env.tmdb.get, env.getOrig);
  env.api.install();
  const ours = Lampa.Api.full;
  const foreign = function () { return ours.apply(this, arguments); };
  Lampa.Api.full = foreign;
  env.api.uninstall();
  assert.equal(Lampa.Api.full, foreign, 'чужую не снимаем');
  assert.equal(env.tmdb.get, env.getOrig);
});

test('netmem: повторный install не оборачивает дважды; настройка выключена — ничего', () => {
  const env = makeEnv();
  env.api.install();
  const w = env.tmdb.get;
  assert.equal(env.api.install(), false);
  assert.equal(env.tmdb.get, w);
  const off = makeEnv({ pref: false });
  assert.equal(off.api.install(), false);
  assert.equal(off.tmdb.get, off.getOrig);
});

test('netmem: нет Lampa.Api или источника — тихий отказ', () => {
  const env = makeEnv();
  globalThis.Lampa = {};
  assert.equal(env.api.install(), false);
  assert.equal(env.api.active(), false);
  globalThis.Lampa = { Api: { full: env.fullOrig } };
  assert.equal(env.api.install(), true, 'только full — тоже годится');
  assert.equal(env.api.slim(null), null);
});

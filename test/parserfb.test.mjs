import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* «Запасной парсер» (src/66_parserfb.js): обёртка Lampa.Parser.get —
   основной Jackett ошибся, вернул пустой Results или молчит 8 с → один
   запрос Parser.jackett ко второму адресу. Фейковый Parser: get и jackett
   копят вызовы, ответы даёт тест. Склейку с activate/deactivate проверяет
   test/runtime.test.mjs, ветку настройки — test/settings.test.mjs. */

globalThis.warn = function () { };

const R1 = { Title: 'A', MagnetUri: 'magnet:?xt=urn:btih:1' };
const R2 = { Title: 'B', MagnetUri: 'magnet:?xt=urn:btih:2' };

function setup(opts) {
  opts = opts || {};
  const fields = Object.assign({
    parser_torrent_type: 'jackett',
    parser_use_link: 'one',
    jackett_url: 'https://jr.maxvol.pro',
    jackett_key: '',
    jackett_url_two: 'https://jacred.su',
    jackett_key_two: 'k2'
  }, opts.fields || {});
  const prefs = Object.assign({}, opts.prefs || {});
  const sets = [];
  const gets = [];
  const jacks = [];
  const noty = [];
  let cleared = 0;
  const Parser = opts.noParser ? undefined : {
    get: function (params, ok, fail) { gets.push({ params, ok, fail, self: this }); return 'ret'; },
    jackett: function (params, url, key, rank, ok, fail) { jacks.push({ params, url, key, rank, ok, fail }); },
    clear: function () { cleared++; }
  };
  if (Parser && opts.noJackett) delete Parser.jackett;
  const Lampa = {
    Storage: {
      field: (k) => fields[k],
      get: (k, d) => (k in fields ? fields[k] : d),
      set: (k, v) => { sets.push(k); fields[k] = v; }
    },
    Utils: { checkEmptyUrl: (u) => (/^https?:\/\//.test(u) ? u : 'http://' + u) },
    Noty: { show: (t) => noty.push(t) },
    Parser
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  const { api, LC } = loadCtx('66_parserfb.js', {
    pref: (n, d) => (n in prefs ? prefs[n] : d),
    lang: (k) => 'T:' + k
  });
  const timers = [];
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; }
  };
  function fire() {
    for (const t of timers) if (t.fn) { const f = t.fn; t.fn = null; f(); }
  }
  function live() { return timers.filter((t) => t.fn); }
  /* Вызов, как его делает экран раздач Lampa (:43604). */
  function call(params) {
    const out = { ok: [], err: [] };
    out.ret = Lampa.Parser.get(params || { search: 'x', movie: {} }, (d) => out.ok.push(d), (e) => out.err.push(e));
    return out;
  }
  return { api, LC, Lampa, Parser, fields, prefs, sets, gets, jacks, noty, timers, fire, live, call, cleared: () => cleared };
}

test('parserfb: основной ответил раздачами — запасной не зовётся, таймер снят, без уведомления', () => {
  const env = setup();
  assert.equal(env.api.install(), true);
  const out = env.call();
  assert.equal(out.ret, 'ret', 'возврат исходного get проходит наружу');
  assert.equal(env.gets.length, 1);
  assert.equal(env.timers[0].ms, 8000);
  env.gets[0].ok({ Results: [R1] });
  assert.deepEqual(out.ok, [{ Results: [R1] }]);
  assert.equal(env.jacks.length, 0);
  assert.equal(env.live().length, 0, 'таймер снят');
  env.fire();
  assert.equal(env.jacks.length, 0);
  assert.deepEqual(env.noty, []);
  assert.deepEqual(env.sets, [], 'Storage не меняется');
});

test('parserfb: ошибка основного → один запрос jackett ко второму адресу, раздачи с уведомлением', () => {
  const env = setup();
  env.api.install();
  const params = { search: 'Дюна', movie: { title: 'Дюна' } };
  const out = env.call(params);
  env.gets[0].fail('нет ответа (https://jr.maxvol.pro)');
  assert.equal(env.jacks.length, 1);
  const j = env.jacks[0];
  assert.equal(j.params, params, 'те же параметры поиска');
  assert.equal(j.url, 'https://jacred.su');
  assert.equal(j.key, 'k2');
  assert.equal(j.rank, 1, 'ранг второго адреса — как у Lampa');
  assert.equal(env.live().length, 0, 'таймер снят после перехода на запасной');
  j.ok({ Results: [R2] });
  assert.deepEqual(out.ok, [{ Results: [R2] }]);
  assert.deepEqual(out.err, []);
  assert.deepEqual(env.noty, ['T:lumen_parser_fallback_noty']);
  assert.deepEqual(env.sets, [], 'Storage не меняется');
});

test('parserfb: пустой Results основного → запасной; запасной тоже пуст — отдаётся пустой список, без уведомления', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  const empty = { Results: [] };
  env.gets[0].ok(empty);
  assert.equal(env.jacks.length, 1);
  env.jacks[0].ok({ Results: [] });
  assert.equal(out.ok.length, 1);
  assert.deepEqual(out.ok[0], { Results: [] });
  assert.deepEqual(env.noty, []);
});

test('parserfb: пустой основной и раздачи у запасного — раздачи запасного', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.gets[0].ok({ Results: [] });
  env.jacks[0].ok({ Results: [R2] });
  assert.deepEqual(out.ok, [{ Results: [R2] }]);
  assert.equal(env.noty.length, 1);
});

test('parserfb: пустой основной и ошибка запасного — «ничего не найдено» основного, не ошибка', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  const empty = { Results: [] };
  env.gets[0].ok(empty);
  env.jacks[0].fail('нет ответа (https://jacred.su)');
  assert.deepEqual(out.ok, [empty]);
  assert.deepEqual(out.err, []);
  assert.deepEqual(env.noty, []);
});

test('parserfb: ошибка обоих — ошибка основного, ровно одна', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.gets[0].fail('E1');
  env.jacks[0].fail('E2');
  env.jacks[0].fail('E2');
  assert.deepEqual(out.err, ['E1']);
  assert.deepEqual(out.ok, []);
});

test('parserfb: 8 с без ответа → запасной; поздний ответ основного отбрасывается', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  assert.equal(env.jacks.length, 0);
  env.fire();
  assert.equal(env.jacks.length, 1, 'таймаут → запасной');
  env.gets[0].ok({ Results: [R1] });
  assert.deepEqual(out.ok, [], 'основной после таймаута не отдаётся');
  env.jacks[0].ok({ Results: [R2] });
  assert.deepEqual(out.ok, [{ Results: [R2] }]);
  env.gets[0].fail('late');
  env.gets[0].ok({ Results: [R1] });
  assert.equal(out.ok.length, 1, 'результат ровно один');
  assert.deepEqual(out.err, []);
  assert.equal(env.noty.length, 1);
});

test('parserfb: таймаут и ошибка запасного — ошибка запасного', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.fire();
  env.jacks[0].fail('E2');
  assert.deepEqual(out.err, ['E2']);
});

test('parserfb: ответ основного после ответа запасного и повторный таймер — ничего', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.gets[0].fail('E1');
  env.jacks[0].ok({ Results: [R2] });
  env.fire();
  env.gets[0].ok({ Results: [R1] });
  assert.equal(env.jacks.length, 1, 'запасной — один раз');
  assert.equal(out.ok.length, 1);
});

test('parserfb: Parser.clear (экран раздач закрыт) — ждущий таймер и поздние ответы ничего не отдают', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.Lampa.Parser.clear();
  assert.equal(env.cleared(), 1, 'исходный clear вызван');
  env.fire();
  assert.equal(env.jacks.length, 0, 'после clear запасной не зовётся');
  env.gets[0].ok({ Results: [R1] });
  assert.deepEqual(out.ok, []);
  /* Новый вызов после clear работает как обычно. */
  const out2 = env.call();
  env.gets[1].ok({ Results: [R1] });
  assert.deepEqual(out2.ok, [{ Results: [R1] }]);
});

test('parserfb: clear во время запроса к запасному — его ответ отбрасывается', () => {
  const env = setup();
  env.api.install();
  const out = env.call();
  env.gets[0].fail('E1');
  env.Lampa.Parser.clear();
  env.jacks[0].ok({ Results: [R2] });
  assert.deepEqual(out.ok, []);
  assert.deepEqual(env.noty, []);
});

test('parserfb: два вызова одновременно не мешают друг другу', () => {
  const env = setup();
  env.api.install();
  const a = env.call();
  const b = env.call();
  env.gets[1].ok({ Results: [R2] });
  env.gets[0].ok({ Results: [R1] });
  assert.deepEqual(a.ok, [{ Results: [R1] }]);
  assert.deepEqual(b.ok, [{ Results: [R2] }]);
});

test('parserfb: второй адрес не задан — исходный get как есть, без таймера', () => {
  for (const v of ['', undefined, null]) {
    const env = setup({ fields: { jackett_url_two: v } });
    env.api.install();
    const out = env.call();
    assert.equal(env.timers.length, 0);
    env.gets[0].fail('E1');
    assert.deepEqual(out.err, ['E1']);
    assert.equal(env.jacks.length, 0);
  }
});

test('parserfb: пункт выключен — исходный get как есть', () => {
  const env = setup({ prefs: { lumen_parser_fallback: false } });
  env.api.install();
  const out = env.call();
  assert.equal(env.timers.length, 0);
  env.gets[0].ok({ Results: [] });
  assert.deepEqual(out.ok, [{ Results: [] }]);
  assert.equal(env.jacks.length, 0);
});

test('parserfb: пункт читается на каждом вызове — выключили на лету', () => {
  const env = setup();
  env.api.install();
  env.call();
  assert.equal(env.timers.length, 1);
  env.prefs.lumen_parser_fallback = false;
  env.call();
  assert.equal(env.timers.length, 1, 'второй вызов — без подстраховки');
});

test('parserfb: режимы «both» и «two», Prowlarr и TorrServer не трогаются', () => {
  for (const fields of [
    { parser_use_link: 'both' },
    { parser_use_link: 'two' },
    { parser_torrent_type: 'prowlarr' },
    { parser_torrent_type: 'torrserver' }
  ]) {
    const env = setup({ fields });
    env.api.install();
    const out = env.call();
    assert.equal(env.timers.length, 0, JSON.stringify(fields));
    env.gets[0].fail('E');
    assert.deepEqual(out.err, ['E']);
    assert.equal(env.jacks.length, 0);
  }
});

test('parserfb: parser_use_link не задан — это «one» (как у Lampa)', () => {
  const env = setup({ fields: { parser_use_link: undefined } });
  env.api.install();
  env.call();
  assert.equal(env.timers.length, 1);
});

test('parserfb: адрес запасного — как у Lampa: jacred.xyz → jac.red, checkEmptyUrl', () => {
  const env = setup({ fields: { jackett_url_two: 'jacred.xyz', jackett_key_two: undefined } });
  env.api.install();
  env.call();
  env.gets[0].fail('E');
  assert.equal(env.jacks[0].url, 'http://jac.red');
  assert.equal(env.jacks[0].key, '');
});

test('parserfb: нет Lampa.Parser (старая Lampa) — install ничего не делает и не падает', () => {
  const env = setup({ noParser: true });
  assert.equal(env.api.install(), false);
  assert.equal(env.api.installed(), false);
  env.api.uninstall();
});

test('parserfb: нет Parser.jackett — исходный get как есть', () => {
  const env = setup({ noJackett: true });
  env.api.install();
  const out = env.call();
  assert.equal(env.timers.length, 0);
  env.gets[0].fail('E');
  assert.deepEqual(out.err, ['E']);
});

test('parserfb: исключение в исходном get — наружу, таймер снят, запасной не зовётся', () => {
  const env = setup();
  env.Parser.get = () => { throw new Error('boom'); };
  env.api.install();
  assert.throws(() => env.call(), /boom/);
  assert.equal(env.live().length, 0);
  env.fire();
  assert.equal(env.jacks.length, 0);
});

test('parserfb: исключение в jackett — ошибка основного, без падения', () => {
  const env = setup();
  env.Parser.jackett = () => { throw new Error('boom'); };
  env.api.install();
  const out = env.call();
  env.gets[0].fail('E1');
  assert.deepEqual(out.err, ['E1']);
});

test('parserfb: uninstall возвращает исходные get и clear; повторный install не оборачивает дважды', () => {
  const env = setup();
  const get0 = env.Parser.get;
  const clear0 = env.Parser.clear;
  env.api.install();
  const wrapped = env.Parser.get;
  assert.notEqual(wrapped, get0);
  env.api.install();
  assert.equal(env.Parser.get, wrapped, 'второй install — та же обёртка');
  env.api.uninstall();
  assert.equal(env.Parser.get, get0);
  assert.equal(env.Parser.clear, clear0);
  assert.equal(env.api.installed(), false);
});

test('parserfb: поверх нас обернули ещё раз — uninstall оставляет чужую обёртку, наша становится сквозной', () => {
  const env = setup();
  env.api.install();
  const ours = env.Parser.get;
  const theirs = function () { return ours.apply(this, arguments); };
  env.Parser.get = theirs;
  env.api.uninstall();
  assert.equal(env.Parser.get, theirs);
  const out = env.call();
  assert.equal(env.timers.length, 0, 'после uninstall подстраховки нет');
  env.gets[0].fail('E');
  assert.deepEqual(out.err, ['E']);
  /* Снова включили — та же обёртка снова работает, без второго слоя. */
  env.api.install();
  env.call();
  assert.equal(env.timers.length, 1);
  assert.equal(env.gets.length, 2);
});

test('parserfb: Lampa зовёт Parser.get через свойство — после install зовётся обёртка с тем же this', () => {
  const env = setup();
  env.api.install();
  env.call();
  assert.equal(env.gets[0].self, env.Parser);
});

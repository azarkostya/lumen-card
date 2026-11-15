import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* «Автовыбор TorrServer» (src/66_tsauto.js): /echo основного, при молчании
   — второго; запись torrserver_use_link только при смене, один Noty;
   троттлинг 60 с; uninstall снимает таймер, подписку и начатый проход.
   Ветка настройки — test/settings.test.mjs. */

const T0 = Date.UTC(2026, 10, 15, 12, 0, 0);
const ONE = 'http://192.168.1.10:8090';
const TWO = 'http://127.0.0.1:8090';

globalThis.warn = function () { };

function setup(opts) {
  opts = opts || {};
  const store = Object.assign({ torrserver_url: ONE, torrserver_url_two: TWO }, opts.storage || {});
  const prefs = Object.assign({ lumen_ts_auto: true }, opts.prefs || {});
  const noty = [];
  const reqs = [];
  const sets = [];
  const follows = [];
  const removes = [];
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      field: (k) => store[k],
      value: (k) => store[k],
      set: (k, v) => { sets.push([k, v]); store[k] = v; }
    },
    Noty: { show: (t) => noty.push(t) },
    Listener: {
      follow: (n, fn) => follows.push([n, fn]),
      remove: (n, fn) => removes.push([n, fn])
    },
    Base64: { encode: (s) => Buffer.from(s, 'utf8').toString('base64') }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  const { api, LC } = loadCtx('66_tsauto.js', { pref: (n, d) => (n in prefs ? prefs[n] : d) });
  LC.lang = (k) => k;
  const app = { on: !!opts.app };
  LC.tsclean = { appMode: () => app.on };
  let clock = T0;
  api._now = () => clock;
  let cleared = 0;
  api._net = () => ({
    timeout: (ms) => { reqs.timeout = ms; },
    clear: () => { cleared++; },
    silent: (url, ok, fail, post, params) => reqs.push({ url, ok, fail, post, params, timeout: reqs.timeout })
  });
  const timers = [];
  api._timers = {
    set: (fn, ms) => { const t = { fn, ms, live: true }; timers.push(t); return t; },
    clear: (t) => { t.live = false; }
  };
  const fire = () => { const t = timers.filter((x) => x.live); t.forEach((x) => { x.live = false; x.fn(); }); return t.length; };
  return { api, LC, store, prefs, noty, reqs, sets, follows, removes, timers, fire, cleared: () => cleared, tick: (ms) => { clock += ms; } };
}

test('tsauto: основной отвечает — use_link остаётся/становится one', () => {
  const env = setup({ storage: { torrserver_use_link: 'two' } });
  env.api.install();
  assert.equal(env.timers.length, 1);
  assert.equal(env.timers[0].ms, 4000);
  assert.equal(env.fire(), 1);
  assert.equal(env.reqs.length, 1);
  assert.equal(env.reqs[0].url, ONE + '/echo');
  assert.equal(env.reqs[0].timeout, 2000);
  assert.ok(!env.reqs[0].post);
  assert.equal(env.reqs[0].params.dataType, 'text');
  env.reqs.shift().ok('MatriX.135');
  assert.equal(env.reqs.length, 0, 'второй не спрашиваем');
  assert.deepEqual(env.sets, [['torrserver_use_link', 'one']]);
  assert.deepEqual(env.noty, ['lumen_ts_auto_one']);
});

test('tsauto: основной уже выбран и отвечает — без записи и без Noty', () => {
  const env = setup();
  env.api.install();
  env.api.check();
  env.reqs.shift().ok('MatriX');
  assert.deepEqual(env.sets, []);
  assert.deepEqual(env.noty, []);
});

test('tsauto: основной молчит, второй отвечает — two и один Noty', () => {
  const env = setup({ storage: { torrserver_use_link: 'one' } });
  env.api.install();
  env.api.check();
  env.reqs.shift().fail({ status: 0 }, 'timeout');
  assert.equal(env.reqs.length, 1);
  assert.equal(env.reqs[0].url, TWO + '/echo');
  env.reqs.shift().ok('MatriX');
  assert.deepEqual(env.sets, [['torrserver_use_link', 'two']]);
  assert.deepEqual(env.noty, ['lumen_ts_auto_two']);
  /* Через минуту основной ожил — назад на основной. */
  env.tick(61000);
  env.api.check();
  env.reqs.shift().ok('MatriX');
  assert.deepEqual(env.sets[1], ['torrserver_use_link', 'one']);
  assert.deepEqual(env.noty, ['lumen_ts_auto_two', 'lumen_ts_auto_one']);
});

test('tsauto: пустой ответ 200 — не «отвечает»', () => {
  const env = setup();
  env.api.install();
  env.api.check();
  env.reqs.shift().ok('');
  assert.equal(env.reqs[0].url, TWO + '/echo');
});

test('tsauto: на адресе основного отвечает не TorrServer — не «отвечает»', () => {
  const env = setup();
  env.api.install();
  env.api.check();
  env.reqs.shift().ok('<html>login</html>');
  assert.equal(env.reqs[0].url, TWO + '/echo');
});

test('tsauto: оба молчат — ничего не пишем', () => {
  const env = setup({ storage: { torrserver_use_link: 'one' } });
  env.api.install();
  env.api.check();
  env.reqs.shift().fail({}, 'timeout');
  env.reqs.shift().fail({}, 'timeout');
  assert.deepEqual(env.sets, []);
  assert.deepEqual(env.noty, []);
});

test('tsauto: пункт выключен — ни таймера, ни запроса', () => {
  const env = setup({ prefs: { lumen_ts_auto: false } });
  env.api.install();
  assert.equal(env.timers.length, 0);
  env.api.check();
  assert.equal(env.reqs.length, 0);
  delete env.prefs.lumen_ts_auto;
  env.api.check();
  assert.equal(env.reqs.length, 0, 'по умолчанию выключен');
});

test('tsauto: задан только один адрес (или режим приложения TorrServe) — ничего', () => {
  for (const storage of [{ torrserver_url_two: '' }, { torrserver_url: '' }, { torrserver_url_two: '   ' }]) {
    const env = setup({ storage });
    env.api.install();
    env.fire();
    env.api.check();
    assert.equal(env.reqs.length, 0, JSON.stringify(storage));
  }
  const app = setup({ app: true });
  app.api.install();
  app.api.check();
  assert.equal(app.reqs.length, 0);
});

test('tsauto: адрес без протокола и со слэшем — как у Lampa', () => {
  const env = setup({ storage: { torrserver_url: '192.168.1.10:8090/', torrserver_url_two: '127.0.0.1:8090' } });
  env.api.install();
  env.api.check();
  assert.equal(env.reqs[0].url, 'http://192.168.1.10:8090/echo');
});

test('tsauto: троттлинг 60 с и один проход за раз', () => {
  const env = setup();
  env.api.install();
  env.api.check();
  env.api.check();
  assert.equal(env.reqs.length, 1, 'пока идёт — второго нет');
  env.reqs.shift().ok('MatriX');
  env.tick(30000);
  env.api.check();
  assert.equal(env.reqs.length, 0, 'в пределах 60 с');
  env.tick(30000);
  env.api.check();
  assert.equal(env.reqs.length, 1);
});

test('tsauto: экран раздач (activity init, torrents) — проверка; другие экраны — нет', () => {
  const env = setup();
  env.api.install();
  assert.equal(env.follows.length, 1);
  assert.equal(env.follows[0][0], 'activity');
  const on = env.follows[0][1];
  on({ type: 'init', component: 'full' });
  on({ type: 'start', component: 'torrents' });
  assert.equal(env.reqs.length, 0);
  on({ type: 'init', component: 'torrents' });
  assert.equal(env.reqs.length, 1);
});

test('tsauto: uninstall снимает таймер, подписку и начатый проход', () => {
  const env = setup({ storage: { torrserver_use_link: 'one' } });
  env.api.install();
  const t = env.timers[0];
  env.api.uninstall();
  assert.equal(t.live, false, 'таймер снят');
  assert.equal(env.removes.length, 1);
  assert.equal(env.removes[0][1], env.follows[0][1]);
  /* Проход начался, потом плагин выключили — поздний ответ не пишет. */
  env.api.install();
  env.api.check();
  env.api.uninstall();
  assert.ok(env.cleared() >= 1);
  env.reqs.shift().fail({}, 'timeout');
  assert.equal(env.reqs.length, 0, 'второй адрес уже не спрашиваем');
  assert.deepEqual(env.sets, []);
  /* Выключенный плагин сам не проверяет. */
  env.tick(120000);
  env.api.check();
  assert.equal(env.reqs.length, 0);
});

test('tsauto: apply — выключили пункт: таймер и проход сняты; включили — проверка через 4 с', () => {
  const env = setup({ storage: { torrserver_use_link: 'one' } });
  env.api.install();
  const t = env.timers[0];
  env.api.check();
  env.prefs.lumen_ts_auto = false;
  env.api.apply();
  assert.equal(t.live, false);
  env.reqs.shift().fail({}, 'timeout');
  assert.equal(env.reqs.length, 0);
  env.prefs.lumen_ts_auto = true;
  env.api.apply();
  assert.equal(env.fire(), 1);
  assert.equal(env.reqs.length, 1, 'включение не ждёт 60 с');
});

test('tsauto: авторизация — Basic только для адреса, на который Lampa её не ставит', () => {
  const env = setup({ storage: { torrserver_auth: true, torrserver_login: 'u', torrserver_password: 'p', torrserver_use_link: 'one' } });
  env.api.install();
  env.api.check();
  assert.equal(env.reqs[0].params.beforeSend, undefined, 'основной выбран — заголовок ставит Reguest');
  env.reqs.shift().fail({}, 'timeout');
  assert.deepEqual(env.reqs[0].params.beforeSend, { name: 'Authorization', value: 'Basic ' + Buffer.from('u:p').toString('base64') });
  const off = setup();
  off.api.install();
  off.api.check();
  off.reqs.shift().fail({}, 'timeout');
  assert.equal(off.reqs[0].params.beforeSend, undefined, 'без torrserver_auth — без заголовка');
});

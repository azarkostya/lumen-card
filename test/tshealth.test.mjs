import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* «Состояние TorrServer» на карточке (src/66_tshealth.js): кэш на 60 с,
   один запрос за раз, точка на «Смотреть», Noty при переходе в «не
   отвечает» и только с запасной ссылкой. Вызов из 'full' complite —
   src/90_runtime.js; ветка настройки — test/settings.test.mjs. */

const T0 = Date.UTC(2026, 9, 20, 12, 0, 0);

/* Корень карточки — минимальный jQuery: find по кнопке «Смотреть» и по
   точке внутри неё, append, remove, css. */
function fakeRoot(withButton) {
  const btn = { dots: 0, style: {} };
  const dotSet = () => ({ length: btn.dots, remove: () => { btn.dots = 0; } });
  const btnSet = {
    length: withButton === false ? 0 : 1,
    find: (sel) => { assert.equal(sel, '.lumen-ts-dot'); return dotSet(); },
    append: (html) => { assert.match(html, /lumen-ts-dot/); assert.match(html, /#FF453A/); btn.dots++; },
    css: (k, v) => { btn.style[k] = v; }
  };
  return {
    btn,
    find: (sel) => { assert.equal(sel, '.full-start-new__buttons .button--play'); return btnSet; }
  };
}

function setup(opts) {
  opts = opts || {};
  const store = Object.assign({ torrserver_url: 'http://127.0.0.1:8090' }, opts.storage || {});
  const prefs = Object.assign({ lumen_ts_health: true }, opts.prefs || {});
  const noty = [];
  const reqs = [];
  const Lampa = {
    Storage: { get: (k, d) => (k in store ? store[k] : d) },
    Noty: { show: (t) => noty.push(t) }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  const app = { on: !!opts.app };
  const { api, LC } = loadCtx('66_tshealth.js', { pref: (n, d) => (n in prefs ? prefs[n] : d) });
  LC.lang = (k) => k;
  LC.tsclean = { server: () => (opts.server === undefined ? 'http://127.0.0.1:8090' : opts.server), appMode: () => app.on };
  let clock = T0;
  api._now = () => clock;
  api._net = () => ({
    timeout: (ms) => { reqs.timeout = ms; },
    silent: (url, ok, fail, post, params) => reqs.push({ url, ok, fail, post, params, timeout: reqs.timeout })
  });
  return { api, LC, store, prefs, noty, reqs, tick: (ms) => { clock += ms; } };
}

test('tshealth: первая карточка — GET /echo с таймаутом 5 с, ответил — точки нет', () => {
  const env = setup();
  const root = fakeRoot();
  env.api.check(root);
  assert.equal(env.reqs.length, 1);
  assert.equal(env.reqs[0].url, 'http://127.0.0.1:8090/echo');
  assert.equal(env.reqs[0].timeout, 5000);
  assert.ok(!env.reqs[0].post, 'GET, без тела');
  assert.deepEqual(env.reqs[0].params, { dataType: 'text' });
  env.reqs.shift().ok('MatriX.135');
  assert.equal(env.api.state(), 'ok');
  assert.equal(root.btn.dots, 0);
  assert.deepEqual(env.noty, []);
});

test('tshealth: не ответил — точка на «Смотреть»; кэш 60 с — без нового запроса, точка и на следующей карточке', () => {
  const env = setup();
  const r1 = fakeRoot();
  env.api.check(r1);
  env.reqs.shift().fail({ status: 0 }, 'timeout');
  assert.equal(env.api.state(), 'down');
  assert.equal(r1.btn.dots, 1);
  assert.equal(r1.btn.style.position, 'relative');
  env.tick(30000);
  const r2 = fakeRoot();
  env.api.check(r2);
  assert.equal(env.reqs.length, 0, 'в пределах 60 с — из кэша');
  assert.equal(r2.btn.dots, 1);
  /* Повторный вызов на той же карточке точку не дублирует. */
  env.api.check(r2);
  assert.equal(r2.btn.dots, 1);
  /* Через 60 с — новый запрос; ответил — точка снята. */
  env.tick(30000);
  env.api.check(r2);
  assert.equal(env.reqs.length, 1);
  env.reqs.shift().ok('MatriX');
  assert.equal(r2.btn.dots, 0);
  assert.equal(r2.btn.style.position, '');
});

test('tshealth: пока запрос идёт — второго нет, ответ рисуется на последней открытой карточке', () => {
  const env = setup();
  const r1 = fakeRoot();
  const r2 = fakeRoot();
  env.api.check(r1);
  env.tick(70000);
  env.api.check(r2);
  assert.equal(env.reqs.length, 1);
  env.reqs.shift().fail({ status: 0 }, 'timeout');
  assert.equal(r2.btn.dots, 1);
  assert.equal(r1.btn.dots, 0);
});

test('tshealth: Noty — только при переходе в «не отвечает» и только с запасной ссылкой', () => {
  const none = setup();
  none.api.check(fakeRoot());
  none.reqs.shift().fail({}, 'timeout');
  assert.deepEqual(none.noty, [], 'без torrserver_url_two — молча');

  const env = setup({ storage: { torrserver_url_two: 'http://192.168.1.5:8090' } });
  env.api.check(fakeRoot());
  env.reqs.shift().fail({}, 'timeout');
  assert.deepEqual(env.noty, ['lumen_ts_health_noty']);
  /* Всё ещё не отвечает — повторного Noty нет. */
  env.tick(61000);
  env.api.check(fakeRoot());
  env.reqs.shift().fail({}, 'timeout');
  assert.equal(env.noty.length, 1);
  /* Ожил и снова упал — новый Noty. */
  env.tick(61000);
  env.api.check(fakeRoot());
  env.reqs.shift().ok('MatriX');
  env.tick(61000);
  env.api.check(fakeRoot());
  env.reqs.shift().fail({}, 'timeout');
  assert.equal(env.noty.length, 2);
  /* Настройки Lampa модуль не меняет. */
  assert.equal(env.store.torrserver_url, 'http://127.0.0.1:8090');
});

test('tshealth: режим приложения TorrServe — запасная ссылка ни при чём, ни запроса, ни Noty', () => {
  const env = setup({ app: true, storage: { torrserver_url_two: 'http://192.168.1.5:8090' } });
  const root = fakeRoot();
  env.api.check(root);
  assert.equal(env.reqs.length, 0);
  assert.equal(root.btn.dots, 0);
  assert.deepEqual(env.noty, []);
});

test('tshealth: без torrserver_url или с выключенным пунктом — ни запроса, ни точки', () => {
  const env = setup({ storage: { torrserver_url: '' } });
  env.api.check(fakeRoot());
  assert.equal(env.reqs.length, 0);
  const off = setup({ prefs: { lumen_ts_health: false } });
  off.api.check(fakeRoot());
  assert.equal(off.reqs.length, 0);
  const noAddr = setup({ server: '' });
  noAddr.api.check(fakeRoot());
  assert.equal(noAddr.reqs.length, 0);
});

test('tshealth: выключили пункт — apply снимает точку с открытой карточки; кнопки нет — без исключений', () => {
  const env = setup();
  const root = fakeRoot();
  env.api.check(root);
  env.reqs.shift().fail({}, 'timeout');
  assert.equal(root.btn.dots, 1);
  env.prefs.lumen_ts_health = false;
  env.api.apply();
  assert.equal(root.btn.dots, 0);
  env.prefs.lumen_ts_health = true;
  env.tick(61000);
  env.api.check(fakeRoot(false));
  env.reqs.shift().fail({}, 'timeout');
  env.api.check(null);
});

test('tshealth: режим приложения TorrServe — ни запроса, ни точки (Lampa сама его не проверяет)', () => {
  const env = setup({ app: true });
  const root = fakeRoot();
  env.api.check(root);
  assert.equal(env.reqs.length, 0);
  assert.equal(root.btn.dots, 0);
});

test('tshealth: по умолчанию выключено (1.3.1) — без пункта ни запроса, ни точки', () => {
  const env = setup({ prefs: { lumen_ts_health: undefined } });
  delete env.prefs.lumen_ts_health;
  const root = fakeRoot();
  env.api.check(root);
  assert.equal(env.reqs.length, 0);
  assert.equal(root.btn.dots, 0);
});

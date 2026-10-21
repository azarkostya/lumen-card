import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCtx } from './_load.mjs';

/* 1.5: окно знакомства при первой установке (src/82_onboard.js). Чистая
   часть — decide; рантайм — detect/schedule/open с фейковой Lampa и
   подменными таймерами, как в test/whatsnew.test.mjs; там же — уступка
   «Что нового» этому окну. */

globalThis.warn = function () { };

function strings() {
  const LC = {};
  new Function('LC', 'module', readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8'))(LC, { exports: null, lumen: true });
  return LC.STRINGS;
}
const STR = strings();

function setup(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const writes = [];
  const modal = { opened: [], closed: 0 };
  const toggles = [];
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v, nolisten) => { store[k] = v; writes.push({ k, v, nolisten }); }
    },
    Modal: { open: (p) => modal.opened.push(p), close: () => { modal.closed++; } },
    Controller: { enabled: () => ({ name: 'items_line' }), toggle: (name) => toggles.push(name) }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  globalThis.$ = (html) => ({ html });
  const lang = opts.lang || 'ru';
  const { api, LC } = loadCtx('82_onboard.js', {
    pref: (name, def) => (name === 'lumen_whatsnew' && 'lumen_whatsnew' in store ? store.lumen_whatsnew !== 'false' : def),
    lang: (k) => (STR[k] ? STR[k][lang] : k),
    langCode: () => lang
  });
  const timers = [];
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; }
  };
  function step() {
    const t = timers.shift();
    if (!t) return null;
    if (t.fn) t.fn();
    return t.ms;
  }
  return { api, LC, store, writes, modal, toggles, timers, step };
}

test('onboard: decide — только первая установка; обновление и повтор — без окна', () => {
  const { api } = setup();
  assert.deepEqual(api.decide('', '', false), { show: true, write: '1' }, 'первая установка');
  assert.deepEqual(api.decide(null, null, false), { show: true, write: '1' });
  assert.deepEqual(api.decide('', '1.3.1', false), { show: false, write: '1' }, 'обновление: ключ версии «Что нового» уже есть');
  assert.deepEqual(api.decide('', '', true), { show: false, write: '1' }, 'обновление с 1.1.0: главная уже строилась');
  assert.deepEqual(api.decide('1', '', false), { show: false, write: null }, 'уже решено — ничего не пишем');
});

test('onboard: detect — первая установка: окно ждёт, метка записана без события', () => {
  const env = setup();
  assert.equal(env.api.detect(), true);
  assert.equal(env.api.pending(), true);
  assert.equal(env.api.busy(), true);
  assert.deepEqual(env.writes, [{ k: 'lumen_onboarded', v: '1', nolisten: true }]);
  /* Второй запуск — уже ничего. */
  env.writes.length = 0;
  assert.equal(env.api.detect(), false);
  assert.deepEqual(env.writes, []);
});

test('onboard: detect — обновление со старой версии: окна нет, метка записана молча', () => {
  for (const storage of [{ lumen_seen_version: '1.3.1' }, { lumen_home_epoch: '5' }, { lumen_manifest: { groups: [] } }]) {
    const env = setup({ storage });
    assert.equal(env.api.detect(), false, JSON.stringify(storage));
    assert.equal(env.store.lumen_onboarded, '1');
  }
});

test('onboard: detect — выключатель общий с «Что нового»: окна нет, но метка записана', () => {
  const env = setup({ storage: { lumen_whatsnew: 'false' } });
  assert.equal(env.api.detect(), false);
  assert.equal(env.store.lumen_onboarded, '1');
});

test('onboard: schedule — окно поверх готовой главной; «Удерживайте OK», ключ КП и путь до настроек внутри', () => {
  const env = setup();
  env.api.detect();
  env.api.schedule(() => true);
  assert.equal(env.step(), env.api.FIRST_DELAY);
  assert.equal(env.modal.opened.length, 1);
  const p = env.modal.opened[0];
  assert.equal(p.title, 'Lumen Card установлен');
  assert.equal(/[<&$]/.test(p.title), false, 'заголовок идёт в шаблон строкой');
  assert.equal(p.buttons.length, 1);
  assert.equal(p.buttons[0].name, 'Начать');
  const html = p.html.html;
  assert.ok(html.indexOf('Удерживайте OK') !== -1, html);
  assert.ok(html.indexOf('Настройки → Lumen Card → Дополнительно… → Ключ Kinopoisk API') !== -1, html);
  assert.ok(html.indexOf('Настройки → Lumen Card') !== -1);
  assert.ok(html.indexOf('lumen-whatsnew__item') !== -1, 'оформление — как у «Что нового»');
  assert.equal(env.api.shown(), true);
  assert.equal(env.api.busy(), true, 'открыто — «Что нового» ждёт');
  p.buttons[0].onSelect();
  assert.equal(env.modal.closed, 1);
  assert.deepEqual(env.toggles, ['items_line'], 'фокус — туда, откуда открыли');
  assert.equal(env.api.busy(), false);
  p.onBack();
  assert.equal(env.modal.closed, 1, 'второе закрытие ничего не делает');
});

test('onboard: тексты окна переведены на три языка и не длиннее трёх строк', () => {
  for (const key of ['lumen_onboard_title', 'lumen_onboard_home', 'lumen_onboard_hold', 'lumen_onboard_kp', 'lumen_onboard_settings', 'lumen_onboard_ok']) {
    const pack = STR[key];
    assert.ok(pack, key);
    for (const lang of ['ru', 'en', 'uk']) assert.ok(pack[lang] && pack[lang].length <= 140, key + '.' + lang);
    assert.equal(/<|&|\$\{/.test(pack.ru + pack.en + pack.uk), false, key);
  }
  for (const lang of ['ru', 'en', 'uk']) {
    const env = setup({ lang });
    assert.equal(env.api.items().length, 4);
  }
});

test('onboard: главная не готова — 12 проверок, потом окно пропускается насовсем', () => {
  const env = setup();
  env.api.detect();
  env.api.schedule(() => false);
  let n = 0;
  while (env.step() !== null) n++;
  assert.equal(n, env.api.TRIES);
  assert.equal(env.modal.opened.length, 0);
  assert.equal(env.api.pending(), false);
});

test('onboard: окно «Вернуться к просмотру» ждёт — уступаем, попытку не тратим', () => {
  const env = setup();
  let busy = true;
  env.LC.resume = { busy: () => busy };
  env.api.detect();
  env.api.schedule(() => true);
  env.step();
  assert.equal(env.modal.opened.length, 0);
  busy = false;
  env.step();
  assert.equal(env.modal.opened.length, 1);
});

test('onboard: выключили пункт, пока окно ждало, — не открывается; cancel снимает ожидание', () => {
  const env = setup();
  env.api.detect();
  env.api.schedule(() => true);
  env.store.lumen_whatsnew = 'false';
  env.step();
  assert.equal(env.modal.opened.length, 0);
  const env2 = setup();
  env2.api.detect();
  env2.api.schedule(() => true);
  env2.api.cancel();
  assert.equal(env2.api.pending(), false);
  assert.equal(env2.step(), env2.api.FIRST_DELAY, 'таймер снят — его функция пуста');
  assert.equal(env2.modal.opened.length, 0);
});

/* «Что нового» и окно знакомства: два окна подряд не открываются. */
test('onboard + whatsnew: «Что нового» уступает ждущему окну знакомства и не открывается после него', () => {
  const store = { lumen_seen_version: '1.2.0' };
  const Lampa = {
    Storage: { get: (k, d) => (k in store ? store[k] : d), set: (k, v) => { store[k] = v; } },
    Modal: { opened: [], open(p) { this.opened.push(p); }, close() { } },
    Controller: { enabled: () => ({ name: 'items_line' }), toggle: () => { } }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  globalThis.$ = (html) => ({ html });
  let onboardBusy = true;
  let onboardShown = false;
  const { api } = loadCtx('82_whatsnew.js', {
    VERSION: '1.3.1',
    pref: (n, d) => d,
    lang: (k) => (STR[k] ? STR[k].ru : k),
    langCode: () => 'ru',
    onboard: { busy: () => onboardBusy, shown: () => onboardShown }
  });
  const timers = [];
  api._timers = { set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; }, clear: () => { } };
  api.detect();
  assert.equal(api.pending(), '1.3.1');
  api.schedule(() => true);
  timers.shift().fn();
  assert.equal(Lampa.Modal.opened.length, 0, 'окно знакомства ждёт — «Что нового» не открывается');
  assert.equal(timers.length, 1, 'повтор заведён');
  onboardBusy = false;
  onboardShown = true;
  timers.shift().fn();
  assert.equal(Lampa.Modal.opened.length, 0, 'знакомство уже было в этом сеансе — второго окна нет');
  assert.equal(api.pending(), null);
  assert.equal(timers.length, 0);
});

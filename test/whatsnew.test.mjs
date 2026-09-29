import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { loadCtx } from './_load.mjs';

/* 1.2: окно «Что нового» после обновления (src/82_whatsnew.js).
   Чистая часть — разбор версий, выбор заметок, решение «показать/записать»
   и сами тексты; рантайм — detect/schedule/open с фейковой Lampa и
   подменными таймерами. Склейку с LC.init/activate/deactivate проверяет
   test/runtime.test.mjs. */

globalThis.warn = function () { };

function head() {
  return readFileSync(new URL('../src/00_head.js', import.meta.url), 'utf8');
}
const VERSION = /LC\.VERSION = '([^']+)'/.exec(head())[1];

function strings() {
  const LC = {};
  new Function('LC', 'module', readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8'))(LC, { exports: null, lumen: true });
  return LC.STRINGS;
}

/* Окружение рантайма: Storage в памяти (set с nolisten — журнал), Modal и
   Controller журналом, таймеры — очередью, которую тест прокручивает сам. */
function setup(opts) {
  opts = opts || {};
  const store = Object.assign({}, opts.storage || {});
  const writes = [];
  const modal = { opened: [], closed: 0 };
  const toggles = [];
  let ctrl = opts.ctrl || 'items_line';
  const Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v, nolisten) => { store[k] = v; writes.push({ k, v, nolisten }); }
    },
    Modal: {
      open: (p) => modal.opened.push(p),
      close: () => { modal.closed++; }
    },
    Controller: {
      enabled: () => ({ name: ctrl }),
      toggle: (name) => toggles.push(name)
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa };
  globalThis.$ = (html) => ({ html });
  const STR = strings();
  const { api, LC } = loadCtx('82_whatsnew.js', {
    VERSION: opts.version || '1.2.0',
    pref: (name, def) => (name === 'lumen_whatsnew' && 'lumen_whatsnew' in store ? store.lumen_whatsnew !== 'false' : def),
    lang: (k) => (STR[k] ? STR[k].ru : k),
    langCode: () => opts.lang || 'ru'
  });
  const timers = [];
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].fn = null; }
  };
  /* Выполнить следующий заведённый таймер; вернуть его задержку. */
  function step() {
    const t = timers.shift();
    if (!t) return null;
    if (t.fn) t.fn();
    return t.ms;
  }
  return { api, LC, store, writes, modal, toggles, timers, step, setCtrl: (n) => { ctrl = n; } };
}

/* ---------------------------- версии ---------------------------- */

test('whatsnew: версии сравниваются по числам — 1.1.0 < 1.2.0 < 1.10.0', () => {
  const { api } = setup();
  assert.deepEqual(api.parseVersion('1.10.2'), [1, 10, 2]);
  assert.equal(api.parseVersion('1.2'), null);
  assert.equal(api.parseVersion('v1.2.0'), null);
  assert.equal(api.parseVersion(null), null);
  assert.equal(api.compare('1.1.0', '1.2.0'), -1);
  assert.equal(api.compare('1.2.0', '1.10.0'), -1);
  assert.equal(api.compare('1.9.0', '1.10.0'), -1, 'строковое сравнение сказало бы наоборот');
  assert.equal(api.compare('2.0.0', '1.99.99'), 1);
  assert.equal(api.compare('1.2.0', '1.2.0'), 0);
  assert.equal(api.compare('мусор', '0.0.1'), -1, 'неразборчивая версия — меньше любой');
});

test('whatsnew: pick — самая новая запись в (seen; version]', () => {
  const { api } = setup();
  assert.equal(api.pick('1.1.0', '1.2.0'), '1.2.0');
  assert.equal(api.pick(null, '1.2.0'), '1.2.0', 'версия неизвестна — последняя запись не новее текущей');
  assert.equal(api.pick('1.1.0', '1.2.3'), '1.2.0', 'патч без записи показывает заметки своей минорной');
  assert.equal(api.pick('1.2.0', '1.2.1'), null, 'заметки 1.2.0 уже видели');
  assert.equal(api.pick('1.2.0', '1.2.0'), null, 'повторный запуск');
  assert.equal(api.pick('9.9.9', '1.2.0'), null, 'откат');
  assert.equal(api.pick('1.0.2', '1.1.0'), null, 'записи не новее текущей нет — окна нет');
});

test('whatsnew: decide — первая установка, обновление, повтор, откат, версия без текста', () => {
  const { api } = setup();
  /* Первая установка: ключа нет, признаков прежней установки нет. */
  assert.deepEqual(api.decide('', '1.2.0', false), { show: null, write: '1.2.0' });
  /* Обновление с 1.1.0: ключа нет, но главная уже строилась. */
  assert.deepEqual(api.decide('', '1.2.0', true), { show: '1.2.0', write: '1.2.0' });
  assert.deepEqual(api.decide(null, '1.2.0', true), { show: '1.2.0', write: '1.2.0' });
  /* Обновление с версии, которая уже пишет ключ. */
  assert.deepEqual(api.decide('1.1.0', '1.2.0', true), { show: '1.2.0', write: '1.2.0' });
  assert.deepEqual(api.decide('1.1.0', '1.2.0', false), { show: '1.2.0', write: '1.2.0' }, 'ключ сам по себе — признак обновления');
  /* Повторный запуск — ничего не пишем. */
  assert.deepEqual(api.decide('1.2.0', '1.2.0', true), { show: null, write: null });
  /* Откат и версия без текста — окна нет, ключ = текущая версия. */
  assert.deepEqual(api.decide('9.9.9', '1.2.0', true), { show: null, write: '1.2.0' });
  assert.deepEqual(api.decide('1.0.2', '1.1.0', true), { show: null, write: '1.1.0' });
  /* Ключ испорчен руками — неизвестно, что видели: окна нет. */
  assert.deepEqual(api.decide('abc', '1.2.0', true), { show: null, write: '1.2.0' });
  assert.deepEqual(api.decide('', 'bad', true), { show: null, write: null });
});

/* ----------------------------- тексты ----------------------------- */

test('whatsnew: у каждой записи 3–5 пунктов на трёх языках, для зрителя', () => {
  const { api } = setup();
  const bad = /\b(Task|HUD|LQIP|rowmem|prefetch|prefill|netmem|Storage|CSS|DOM|Ken Burns|TMDB|API|manifest)\b|lumen_|LC\.|[<>]/i;
  const keys = Object.keys(api.NOTES);
  assert.ok(keys.length >= 1);
  for (const v of keys) {
    assert.ok(api.parseVersion(v), 'ключ записи — версия x.y.z: ' + v);
    const pack = api.NOTES[v];
    const n = pack.ru.length;
    assert.ok(n >= 3 && n <= 5, v + ': пунктов ' + n);
    for (const lang of ['ru', 'en', 'uk']) {
      assert.ok(Array.isArray(pack[lang]), v + ': нет языка ' + lang);
      assert.equal(pack[lang].length, n, v + ' ' + lang + ': число пунктов как у ru');
      for (const s of pack[lang]) {
        assert.ok(s && s.trim(), v + ' ' + lang + ': пустой пункт');
        assert.ok(s.length <= 160, v + ' ' + lang + ': пункт длиннее 160 знаков: ' + s);
        assert.equal(bad.test(s), false, v + ' ' + lang + ': «' + s + '»');
      }
    }
    assert.notDeepEqual(pack.en, pack.ru, v + ': en — не копия ru');
    assert.notDeepEqual(pack.uk, pack.ru, v + ': uk — не копия ru');
  }
});

/* Сторож выпуска: минорная версия без записи молча осталась бы без окна.
   Запись может быть и НОВЕЕ LC.VERSION — черновик заметок следующего
   выпуска до поднятия номера (тогда окно не показывается: pick берёт
   только записи не новее текущей). Патчам (z > 0) запись не нужна. */
test('whatsnew: у текущей минорной версии есть заметки (или готов черновик следующей)', () => {
  const { api } = setup();
  const p = api.parseVersion(VERSION);
  assert.ok(p, 'LC.VERSION разбирается: ' + VERSION);
  if (p[2] > 0) return;
  const newest = Object.keys(api.NOTES).sort(api.compare).pop();
  assert.ok(api.compare(newest, VERSION) >= 0, 'нет заметок для ' + VERSION + ' (последняя запись — ' + newest + ')');
});

test('whatsnew: заголовок и кнопка безопасны для шаблона Lampa, подсказка — путь из строк раздела', () => {
  const STR = strings();
  for (const key of ['lumen_whatsnew_title', 'lumen_whatsnew_ok', 'lumen_whatsnew_off', 'lumen_whatsnew_name', 'lumen_whatsnew_descr']) {
    for (const lang of ['ru', 'en', 'uk']) {
      assert.ok(STR[key] && STR[key][lang], key + ' ' + lang);
      assert.equal(/[<&${]/.test(STR[key][lang]), false, key + ' ' + lang + ': «<&${» в строке');
    }
  }
  const { api } = setup();
  const hint = api.hintText();
  assert.equal(hint, 'Выключить это окно: Настройки → Lumen Card → Дополнительно… → Пульт и окна → «Что нового после обновления»');
});

test('whatsnew: notesFor — язык интерфейса, иначе русский; копия, а не сама запись', () => {
  const { api } = setup();
  assert.deepEqual(api.notesFor('1.2.0', 'en'), api.NOTES['1.2.0'].en);
  assert.deepEqual(api.notesFor('1.2.0', 'be'), api.NOTES['1.2.0'].ru);
  const copy = api.notesFor('1.2.0', 'ru');
  copy.push('x');
  assert.notEqual(api.NOTES['1.2.0'].ru[api.NOTES['1.2.0'].ru.length - 1], 'x');
  assert.equal(api.notesFor('0.0.1', 'ru'), null);
});

/* ----------------------------- detect ----------------------------- */

test('whatsnew: detect — обновление с 1.1.0 (эпоха плана главной есть): окно ждёт, ключ записан без события', () => {
  const env = setup({ storage: { lumen_home_epoch: { n: 5, at: 1 } } });
  assert.equal(env.api.detect(), '1.2.0');
  assert.equal(env.api.pending(), '1.2.0');
  assert.deepEqual(env.writes, [{ k: 'lumen_seen_version', v: '1.2.0', nolisten: true }]);
});

test('whatsnew: detect — кэш каталога тоже признак прежней установки', () => {
  const env = setup({ storage: { lumen_manifest: { at: 1, data: {} } } });
  assert.equal(env.api.detect(), '1.2.0');
});

test('whatsnew: detect — первая установка, повтор, откат: окна нет, ключ = текущая версия', () => {
  let env = setup();
  assert.equal(env.api.detect(), null, 'первая установка');
  assert.equal(env.store.lumen_seen_version, '1.2.0');

  env = setup({ storage: { lumen_seen_version: '1.2.0', lumen_home_epoch: { n: 1 } } });
  assert.equal(env.api.detect(), null, 'повторный запуск');
  assert.deepEqual(env.writes, [], 'повторный запуск ничего не пишет');

  env = setup({ storage: { lumen_seen_version: '9.9.9', lumen_home_epoch: { n: 1 } } });
  assert.equal(env.api.detect(), null, 'откат');
  assert.equal(env.store.lumen_seen_version, '1.2.0', 'ключ перезаписан текущей версией');

  env = setup({ version: '1.1.0', storage: { lumen_home_epoch: { n: 1 } } });
  assert.equal(env.api.detect(), null, 'версия без заметок');
  assert.equal(env.store.lumen_seen_version, '1.1.0');
});

test('whatsnew: detect — выключенный пункт: окна нет, но ключ записан', () => {
  const env = setup({ storage: { lumen_whatsnew: 'false', lumen_seen_version: '1.1.0' } });
  assert.equal(env.api.detect(), null);
  assert.equal(env.store.lumen_seen_version, '1.2.0');
});

/* ---------------------------- schedule ---------------------------- */

test('whatsnew: schedule — первая проверка через 4 с, окно поверх готовой главной, фокус на «Понятно»', () => {
  const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  env.api.schedule(() => true);
  assert.equal(env.modal.opened.length, 0, 'сразу не открывается');
  assert.equal(env.step(), 4000);
  assert.equal(env.modal.opened.length, 1);
  const p = env.modal.opened[0];
  assert.equal(p.title, 'Что нового в Lumen Card 1.2.0');
  assert.equal(p.size, 'medium');
  assert.equal(p.buttons.length, 1, 'одна кнопка — единственный .selector окна');
  assert.equal(p.buttons[0].name, 'Понятно');
  assert.equal(typeof p.onBack, 'function');
  for (const item of env.api.NOTES['1.2.0'].ru) {
    const esc = item.replace(/"/g, '&quot;');
    assert.ok(p.html.html.indexOf(esc) !== -1 || p.html.html.indexOf(item) !== -1, 'в окне есть пункт: ' + item);
  }
  assert.ok(p.html.html.indexOf('Пульт и окна') !== -1, 'подсказка про выключатель');
  assert.equal(env.api.pending(), null, 'показанное окно больше не ждёт');
  assert.equal(env.timers.length, 0, 'таймеров не осталось');
});

test('whatsnew: «Понятно» и «Назад» закрывают окно и возвращают контроллер, с которого открыли', () => {
  for (const how of ['ok', 'back']) {
    const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
    env.api.detect();
    env.api.schedule(() => true);
    env.step();
    env.setCtrl('modal');
    const p = env.modal.opened[0];
    if (how === 'ok') p.buttons[0].onSelect(); else p.onBack();
    assert.equal(env.modal.closed, 1, how);
    assert.deepEqual(env.toggles, ['items_line'], how + ': фокус — обратно в ряд главной');
    /* Повторное нажатие (двойной клик, «Назад» после OK) — без второго закрытия. */
    p.onBack();
    p.buttons[0].onSelect();
    assert.equal(env.modal.closed, 1, how + ': закрытие одно');
  }
});

test('whatsnew: не готово (плеер, карточка, модалка) — повтор раз в 5 с, всего 12 проверок, потом окно пропускается', () => {
  const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  let checks = 0;
  env.api.schedule(() => { checks++; return false; });
  const delays = [];
  let d;
  while ((d = env.step()) !== null) delays.push(d);
  assert.equal(checks, 12);
  assert.deepEqual(delays, [4000].concat(new Array(11).fill(5000)));
  assert.equal(env.modal.opened.length, 0);
  assert.equal(env.api.pending(), null, 'после минуты окно не ждёт');
});

test('whatsnew: главная стала готова на третьей проверке — окно открывается тогда', () => {
  const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  let checks = 0;
  env.api.schedule(() => ++checks >= 3);
  env.step(); env.step();
  assert.equal(env.modal.opened.length, 0);
  env.step();
  assert.equal(env.modal.opened.length, 1);
});

test('whatsnew: пункт выключили, пока окно ждало, — не открывается', () => {
  const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  env.api.schedule(() => true);
  env.store.lumen_whatsnew = 'false';
  env.step();
  assert.equal(env.modal.opened.length, 0);
  assert.equal(env.api.pending(), null);
});

test('whatsnew: ничего не ждёт — schedule таймер не заводит; cancel снимает таймер и ожидание', () => {
  let env = setup({ storage: { lumen_seen_version: '1.2.0' } });
  env.api.detect();
  env.api.schedule(() => true);
  assert.equal(env.timers.length, 0);

  env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  env.api.schedule(() => true);
  env.api.cancel();
  env.step();
  assert.equal(env.modal.opened.length, 0);
  assert.equal(env.api.pending(), null);
});

test('whatsnew: проверка готовности бросила — считается «не готово», без исключения наружу', () => {
  const env = setup({ storage: { lumen_seen_version: '1.1.0' } });
  env.api.detect();
  env.api.schedule(() => { throw new Error('boom'); });
  assert.doesNotThrow(() => env.step());
  assert.equal(env.modal.opened.length, 0);
  assert.equal(env.timers.length, 1, 'следующая проверка заведена');
});

test('whatsnew: окно на английском интерфейсе — пункты en', () => {
  const env = setup({ lang: 'en', storage: { lumen_seen_version: '1.1.0' } });
  assert.equal(env.api.open('1.2.0'), true);
  const html = env.modal.opened[0].html.html;
  assert.ok(html.indexOf('Coen Brothers') !== -1);
});

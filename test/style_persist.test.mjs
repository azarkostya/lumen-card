import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Баг 2026-10-20: «Стиль: Apple TV сбрасывается при перезаходе».

   Здесь Lampa.Storage повторяет вендора ДОСЛОВНО в той части, от которой
   зависит баг (app.min.js 3.3.7, get$1/set/value, строки 49990-50080):
   - get(name, empty) кладёт в кэш readed не только прочитанное, но и
     ДЕФОЛТ того, кто спросил, если ключа в localStorage нет (или он пуст):
     «value = value || empty || ''; … readed[name] = value». Следующий
     читатель с другим дефолтом получает чужой дефолт, а читатель с пустым
     значением в кэше перезаписывает его своим;
   - set пишет и в readed, и в localStorage;
   - value(name) читает localStorage мимо кэша.
   «Перезапуск» — новый readed при том же localStorage.

   До правки стиль Apple TV оставлял три ключа набора (размер кадра,
   логотип, цвет фона от кадра) ОТСУТСТВУЮЩИМИ: «пишутся только отличия», а
   их значения совпадают с дефолтами. Состояние «Apple TV» после
   перезапуска поэтому держалось не на записанном, а на том, какой дефолт
   окажется в кэше Lampa первым, и сверка при старте (syncStyle) записывала
   в lumen_style 'custom' — навсегда, хотя пользователь ничего не правил. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

function vendorStorage(ls) {
  const readed = {};
  const subscribers = [];
  function get(name, empty) {
    let value = readed[name];
    if (typeof value === 'undefined') value = Object.prototype.hasOwnProperty.call(ls, name) ? ls[name] : null;
    value = value || empty || '';
    if (value == 'true' || value == 'false') return value == 'true';
    const convert = parseInt(value);
    if (!isNaN(convert) && /^\d+$/.test(value)) return convert;
    readed[name] = value;
    return value;
  }
  function set(name, value, nolisten) {
    readed[name] = value;
    ls[name] = String(value);
    if (nolisten) return;
    try {
      for (let i = 0; i < subscribers.length; i++) subscribers[i]({ name: name, value: value });
    } catch (e) { }
  }
  return {
    get: get,
    set: set,
    value: (name, empty) => (Object.prototype.hasOwnProperty.call(ls, name) && ls[name]) || empty || '',
    field: (name) => get(name),
    listener: { follow: (name, cb) => { if (name === 'change') subscribers.push(cb); } }
  };
}

/* Один «запуск» Lampa с плагином над общим localStorage ls. before(Storage)
   — что успело прочитать Storage до инициализации плагина. */
function boot(ls, before) {
  const Storage = vendorStorage(ls);
  const params = [];
  const notys = [];
  const presets = [];
  globalThis.Lampa = {
    Storage: Storage,
    Noty: { show: (t) => notys.push(t) },
    Lang: { add: () => { }, translate: (k) => k },
    SettingsApi: { addComponent: () => { }, addParam: (p) => params.push(p) }
  };
  globalThis.window = { Lampa: globalThis.Lampa };
  const LC = {};
  loadInto(LC, '80_settings.js');
  loadInto(LC, '81_prefs.js');
  LC.injectCss = () => { };
  LC.injectFonts = () => { };
  LC.applyPresetChanges = (keys) => presets.push(keys.slice());
  if (before) before(Storage);
  LC.migratePrefs();
  LC.addSettings();
  LC.followStorage();
  /* Выбор в select Lampa: Storage.set с событием, потом onChange пункта. */
  function choose(style) {
    Storage.set('lumen_style', style);
    const p = params.filter((x) => x.param.name === 'lumen_style')[0];
    if (p && typeof p.onChange === 'function') p.onChange(style);
  }
  /* То, что видит плагин при отрисовке (LC.pref с дефолтом пункта). */
  function look() {
    const out = {};
    for (const key of LC.prefs.PRESET_KEYS) {
      const entry = LC.prefs.find(key);
      let v = LC.pref(key, entry['default']);
      if (key === 'lumen_badges') v = LC.prefs.badgesMode(v);
      out[key] = v;
    }
    return out;
  }
  return { LC, Storage, choose, look, notys, presets };
}

const APPLE = {
  lumen_theme: 'black', lumen_card_accent: 'graphite', lumen_font: 'inter', lumen_accent_auto: true,
  lumen_accent_scope: 'veil', lumen_hero_size: 'large', lumen_hero_logo: true, lumen_badges: 'caption',
  lumen_flat: true, lumen_hide_meta: true
};

test('баг стиля: Apple TV записывает ВСЕ десять пунктов — состояние не держится на дефолтах', () => {
  const ls = {};
  const first = boot(ls);
  first.choose('appletv');
  for (const key of Object.keys(APPLE)) {
    const want = typeof APPLE[key] === 'boolean' ? String(APPLE[key]) : APPLE[key];
    assert.equal(ls[key], want, key + ' обязан лежать в localStorage');
  }
  assert.equal(ls.lumen_style, 'appletv');
  /* Применение и уведомление — по-прежнему только о том, что реально
     поменялось: три совпавших с дефолтом пункта вид не меняют. */
  assert.deepEqual(first.presets, [['lumen_theme', 'lumen_card_accent', 'lumen_font', 'lumen_accent_scope', 'lumen_badges', 'lumen_flat', 'lumen_hide_meta']]);
  assert.equal(first.notys.length, 1);
  assert.equal(first.notys[0].indexOf('Логотип'), -1, 'неизменившийся пункт попал в уведомление: ' + first.notys[0]);
});

test('баг стиля: перезапуск, где Storage успели спросить с чужим дефолтом, не сбрасывает Apple TV', () => {
  const ls = {};
  boot(ls).choose('appletv');
  /* Чужой код (другой плагин, скрипт отладки) спросил ключи набора со
     своим дефолтом раньше плагина — вендор кладёт этот дефолт в readed. */
  const again = boot(ls, (Storage) => {
    Storage.get('lumen_hero_size', 'compact');
    Storage.get('lumen_hero_logo', '(unset)');
    Storage.get('lumen_accent_auto', '(unset)');
  });
  assert.equal(ls.lumen_style, 'appletv', '«Стиль» после перезапуска');
  assert.deepEqual(again.look(), APPLE, 'вид после перезапуска');
});

test('баг стиля: профиль, где Apple TV выбрали прежней сборкой (три пункта не записаны), чинится при старте', () => {
  /* Ровно то, что оставляла в localStorage сборка до правки. */
  const ls = {
    lumen_style: 'appletv', lumen_theme: 'black', lumen_card_accent: 'graphite', lumen_font: 'inter',
    lumen_accent_scope: 'veil', lumen_badges: 'caption', lumen_flat: 'true', lumen_hide_meta: 'true'
  };
  const env = boot(ls);
  assert.equal(ls.lumen_hero_size, 'large');
  assert.equal(ls.lumen_hero_logo, 'true');
  assert.equal(ls.lumen_accent_auto, 'true');
  assert.equal(ls.lumen_style, 'appletv');
  assert.equal(env.notys.length, 0, 'при старте — без уведомлений');
  /* Отравленный кэш следующего запуска на записанное уже не влияет. */
  const again = boot(ls, (Storage) => { Storage.get('lumen_hero_size', 'compact'); });
  assert.deepEqual(again.look(), APPLE);
  assert.equal(ls.lumen_style, 'appletv');
});

test('баг стиля: при старте дописываются только ОТСУТСТВУЮЩИЕ пункты Apple TV, чужая запись остаётся и честно даёт «Свой»', () => {
  /* Пропавший ключ (потерянная запись) — дописывается стилем. */
  const lost = {};
  boot(lost).choose('appletv');
  delete lost.lumen_theme;
  const healed = boot(lost);
  assert.equal(lost.lumen_style, 'appletv');
  assert.equal(lost.lumen_theme, 'black');
  assert.deepEqual(healed.look(), APPLE);

  /* Записанное кем-то другое значение (откат на прежнюю версию и правка
     там) не перетирается: «Стиль» — «Свой», как до правки. */
  const edited = {};
  boot(edited).choose('appletv');
  edited.lumen_flat = 'false';
  const env = boot(edited);
  assert.equal(edited.lumen_flat, 'false');
  assert.equal(edited.lumen_style, 'custom');
  assert.equal(env.look().lumen_flat, false);
});

test('баг стиля: «Стиль: Lumen» при старте ничего не дописывает', () => {
  const ls = { lumen_style: 'lumen', lumen_theme: 'black' };
  boot(ls);
  assert.deepEqual(ls, { lumen_style: 'custom', lumen_theme: 'black' });
});

test('баг стиля: ручная правка в настройках по-прежнему делает «Стиль» «Своим» — и это переживает перезапуск', () => {
  const ls = {};
  const env = boot(ls);
  env.choose('appletv');
  env.Storage.set('lumen_card_accent', 'mint');
  assert.equal(ls.lumen_style, 'custom');
  const again = boot(ls);
  assert.equal(ls.lumen_style, 'custom');
  assert.equal(again.look().lumen_card_accent, 'mint', 'ручной выбор не откатывается');
});

test('баг стиля: Lumen на чистом профиле по-прежнему ничего не пишет — значения идут от дефолтов пунктов', () => {
  const ls = {};
  const env = boot(ls);
  env.choose('lumen');
  assert.deepEqual(Object.keys(ls).sort(), ['lumen_style']);
  boot(ls);
  assert.deepEqual(Object.keys(ls).sort(), ['lumen_style'], 'старт с «Lumen» тоже ничего не пишет');
  /* А из Apple TV Lumen возвращается полностью и переживает перезапуск. */
  env.choose('appletv');
  env.choose('lumen');
  const again = boot(ls);
  assert.equal(ls.lumen_style, 'lumen');
  const defaults = {};
  for (const key of again.LC.prefs.PRESET_KEYS) defaults[key] = again.LC.prefs.find(key)['default'];
  assert.deepEqual(again.look(), defaults);
});

test('баг стиля: чистый профиль без выбранного стиля при старте ничего не пишет', () => {
  const ls = {};
  boot(ls);
  assert.deepEqual(ls, {});
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

/* Task 10 (поправка контроллера): src/80_settings.js перевалил за 300 строк,
   поэтому чистая логика настроек — нормализация булевых, режим движения и
   таблица пунктов (порядок/типы/значения по умолчанию, экран 09) — вынесена в
   src/81_prefs.js. Поведение не меняется: LC.pref/LC.motionModeFor остались под
   теми же именами, просто живут в соседнем модуле.

   Здесь — только чистая часть: ни window, ни Lampa, ни DOM. Регистрация
   параметров в Lampa.SettingsApi проверяется в test/settings.test.mjs. */

const prefs = load('81_prefs.js');

/* ====================================================================== */
/* Режим анимаций (перенесено из test/settings.test.mjs без изменений).    */
/* ====================================================================== */

test('motionModeFor: значение не auto -> возвращается как есть, платформа не важна', () => {
  assert.equal(prefs.motionModeFor('full', {}), 'full');
  assert.equal(prefs.motionModeFor('lite', { tizen: true }), 'lite');
  assert.equal(prefs.motionModeFor('off', { webos: true }), 'off');
});

test('motionModeFor: auto на tizen/webos -> lite', () => {
  assert.equal(prefs.motionModeFor('auto', { tizen: true }), 'lite');
  assert.equal(prefs.motionModeFor('auto', { webos: true }), 'lite');
  assert.equal(prefs.motionModeFor('auto', { tizen: true, webos: true }), 'lite');
});

test('motionModeFor: auto на прочих платформах -> full', () => {
  assert.equal(prefs.motionModeFor('auto', {}), 'full');
  assert.equal(prefs.motionModeFor('auto', { tizen: false, webos: false }), 'full');
  assert.equal(prefs.motionModeFor('auto'), 'full');
});

test('motionModeFor: незнакомое stored (undefined/null/пусто/мусор) -> как auto', () => {
  assert.equal(prefs.motionModeFor(undefined, {}), 'full');
  assert.equal(prefs.motionModeFor(null, {}), 'full');
  assert.equal(prefs.motionModeFor('', {}), 'full');
  assert.equal(prefs.motionModeFor('garbage', {}), 'full');
  assert.equal(prefs.motionModeFor(undefined, { tizen: true }), 'lite');
  assert.equal(prefs.motionModeFor(null, { webos: true }), 'lite');
  assert.equal(prefs.motionModeFor('nonsense', { tizen: true }), 'lite');
});

/* ====================================================================== */
/* Нормализация булевых: Lampa хранит переключатели строками 'true'/'false' */
/* (план 0.2), а Storage.set(name, false) с JS-false не сохраняется вовсе.  */
/* ====================================================================== */

test('boolOf: строки и числа Lampa приводятся к булевым', () => {
  for (const yes of ['true', true, 1, '1']) assert.equal(prefs.boolOf(yes, false), true, String(yes));
  for (const no of ['false', false, 0, '0']) assert.equal(prefs.boolOf(no, true), false, String(no));
});

test('boolOf: пусто/мусор -> значение по умолчанию', () => {
  for (const def of [true, false]) {
    assert.equal(prefs.boolOf(undefined, def), def);
    assert.equal(prefs.boolOf(null, def), def);
    assert.equal(prefs.boolOf('', def), def);
    assert.equal(prefs.boolOf('nonsense', def), def);
  }
});

/* ====================================================================== */
/* Таблица пунктов — экран 09 дизайна.                                    */
/*                                                                        */
/* Порядок экрана 09: Включить · Акцент · Анимации · Слайдшоу кадров ·     */
/* Интервал смены кадра · Трейлер в фоне · Актёры в карточке · Отзывы      */
/* Кинопоиска · Ключ Kinopoisk API. Настройки, которых на экране нет       */
/* (шрифты, «Продолжить», меню, экраны TorrServer), вставлены в свои       */
/* группы, не нарушая относительного порядка экранных пунктов.            */
/* ====================================================================== */

const LIST = prefs.LIST;
const names = LIST.filter((e) => e.type !== 'title').map((e) => e.name);

test('LIST: порядок пунктов экрана 09 сохранён', () => {
  const screen09 = ['lumen_enabled', 'lumen_card_accent', 'lumen_motion', 'lumen_slideshow',
    'lumen_slide_interval', 'lumen_trailer', 'lumen_card_cast', 'lumen_reviews', 'lumen_kp_key'];
  const seen = names.filter((n) => screen09.indexOf(n) !== -1);
  assert.deepEqual(seen, screen09);
});

test('LIST: «Включить Lumen Card» — первый пункт раздела, без заголовка группы над ним', () => {
  assert.equal(LIST[0].name, 'lumen_enabled');
  assert.equal(LIST[0].type, 'trigger');
  assert.equal(LIST[0]['default'], true);
  assert.ok(LIST[0].descr, 'у выключателя обязана быть подсказка (карточка перерисуется при следующем открытии)');
});

test('LIST: полный набор ключей — существующие имена не переименованы', () => {
  assert.deepEqual(names.slice().sort(), [
    'lumen_card_accent', 'lumen_card_cast', 'lumen_card_fonts', 'lumen_card_progress',
    'lumen_enabled', 'lumen_kp_key',
    'lumen_manifest_url', /* Task 14 (фаза 2): URL внешнего манифеста подборок */
    'lumen_menus', 'lumen_motion', 'lumen_reviews',
    'lumen_slide_interval', 'lumen_slideshow', 'lumen_torrents', 'lumen_trailer',
    /* Task 15 (фаза 2): ряды подборок на главной */
    'lumen_hide_watched', 'lumen_rows_limit'
  ].sort());
});

test('LIST: типы и значения по умолчанию', () => {
  const def = {};
  for (const e of LIST) if (e.type !== 'title') def[e.name] = [e.type, e['default']];
  assert.deepEqual(def.lumen_enabled, ['trigger', true]);
  assert.deepEqual(def.lumen_card_accent, ['select', 'sand']);
  assert.deepEqual(def.lumen_card_fonts, ['trigger', true]);
  assert.deepEqual(def.lumen_motion, ['select', 'auto']);
  assert.deepEqual(def.lumen_slideshow, ['trigger', true]);
  assert.deepEqual(def.lumen_slide_interval, ['select', '14']);
  assert.deepEqual(def.lumen_trailer, ['select', 'auto']);
  assert.deepEqual(def.lumen_card_progress, ['trigger', true]);
  assert.deepEqual(def.lumen_card_cast, ['trigger', true]);
  assert.deepEqual(def.lumen_reviews, ['trigger', true]);
  assert.deepEqual(def.lumen_kp_key, ['input', '']);
  assert.deepEqual(def.lumen_menus, ['select', 'all']);
  assert.deepEqual(def.lumen_torrents, ['trigger', true]);
});

test('LIST: у select перечислены значения, у каждого пункта есть строка подписи', () => {
  for (const e of LIST) {
    assert.ok(e.label, 'нет ключа подписи: ' + e.name);
    if (e.type !== 'select') continue;
    assert.ok(e.values && e.values.length, 'select без значений: ' + e.name);
    assert.ok(e.vprefix || e.vsuffix, 'select без правила подписи значений: ' + e.name);
  }
  assert.deepEqual(prefs.find('lumen_card_accent').values, ['sand', 'ice', 'wine', 'mint']);
  assert.deepEqual(prefs.find('lumen_motion').values, ['auto', 'full', 'lite', 'off']);
  assert.deepEqual(prefs.find('lumen_slide_interval').values, ['8', '14', '20']);
  assert.deepEqual(prefs.find('lumen_trailer').values, ['auto', 'on', 'off']);
  assert.deepEqual(prefs.find('lumen_menus').values, ['all', 'path', 'off']);
});

test('LIST: имена не повторяются, заголовки групп на своих местах', () => {
  const all = LIST.map((e) => e.name);
  assert.equal(new Set(all).size, all.length, 'повтор имени параметра');
  const titles = LIST.filter((e) => e.type === 'title').map((e) => e.name);
  assert.ok(titles.length >= 3, 'ожидались заголовки групп (Lampa рисует param.type === "title")');
  /* Заголовок группы не может быть последним пунктом — под ним обязаны быть настройки. */
  assert.notEqual(LIST[LIST.length - 1].type, 'title');
});

test('find: неизвестное имя -> null (ветка applyChange без своего пункта)', () => {
  assert.equal(prefs.find('lumen_nope'), null);
  assert.equal(prefs.find(''), null);
  assert.equal(prefs.find(), null);
});

/* ====================================================================== */
/* Связка таблицы пунктов со словарём (ревью Task 10, п.5).               */
/*                                                                        */
/* LC.lang отдаёт САМ КЛЮЧ, если строки в словаре нет, — незамеченная     */
/* опечатка в label/descr/подписи значения показала бы пользователю       */
/* «lumen_card_group_look» вместо «Оформление». Проверяем все три языка.  */
/* ====================================================================== */

const LANGS = ['ru', 'en', 'uk'];

function loadStrings() {
  const LC = {};
  for (const f of ['80_settings.js', '81_prefs.js']) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
  }
  return LC;
}

test('каждый пункт LIST имеет строки label/descr во всех трёх языках', () => {
  const LC = loadStrings();
  for (const e of LC.prefs.LIST) {
    for (const key of [e.label, e.descr]) {
      if (!key) continue;
      const pack = LC.STRINGS[key];
      assert.ok(pack, 'нет строки в LC.STRINGS: ' + key + ' (пункт ' + e.name + ')');
      for (const lang of LANGS) {
        assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang + ' у ' + key);
      }
    }
  }
});

test('каждое значение select имеет подпись во всех трёх языках', () => {
  const LC = loadStrings();
  for (const e of LC.prefs.LIST) {
    if (e.type !== 'select') continue;
    for (const v of e.values) {
      const key = e.vprefix ? e.vprefix + v : e.vsuffix;
      const pack = LC.STRINGS[key];
      assert.ok(pack, 'нет подписи значения: ' + key + ' (пункт ' + e.name + ')');
      for (const lang of LANGS) {
        assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang + ' у ' + key);
      }
    }
  }
});

/* Ревью фазы 1 (M2): строки, которые пользователь видит ВНЕ раздела настроек,
   проверками выше не покрыты — они не пункты LIST. А это ровно те две, что
   были захардкожены по-русски: сообщение Noty о неподдерживаемой сборке Lampa
   (единственное, что видит пользователь на такой сборке) и подпись отзыва без
   автора. Совпадение переводов дословно — тот самый признак копипасты
   русской строки в en/uk, от которого и защищаемся. */
test('M2: строки вне раздела настроек переведены на все три языка и не совпадают дословно', () => {
  const LC = loadStrings();
  for (const key of ['lumen_card_unsupported', 'lumen_card_anon']) {
    const pack = LC.STRINGS[key];
    assert.ok(pack, 'нет строки в LC.STRINGS: ' + key);
    for (const lang of LANGS) {
      assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang + ' у ' + key);
    }
    assert.equal(new Set(LANGS.map((l) => pack[l])).size, LANGS.length,
      'переводы ' + key + ' не должны совпадать дословно: ' + LANGS.map((l) => pack[l]).join(' / '));
  }
});

test('в словаре нет пунктов-сирот: каждая строка lumen_card_group_* принадлежит заголовку из LIST', () => {
  const LC = loadStrings();
  const used = {};
  for (const e of LC.prefs.LIST) { if (e.label) used[e.label] = true; }
  for (const key of Object.keys(LC.STRINGS)) {
    if (key.indexOf('lumen_card_group_') !== 0) continue;
    assert.ok(used[key], 'заголовок группы не используется в LIST: ' + key);
  }
});

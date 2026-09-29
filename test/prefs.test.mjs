import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
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

/* Task 40 (фаза 4): platform.weak — «железо заведомо слабое» без замеров
   (LC.perf.weakHardware). Работает так же, как tizen/webos: понижает 'auto'
   до 'lite', а выбранный руками режим не трогает. */
test('motionModeFor: auto на заведомо слабом железе -> lite, выбранный руками режим не трогает', () => {
  assert.equal(prefs.motionModeFor('auto', { android: true, weak: true }), 'lite');
  assert.equal(prefs.motionModeFor('auto', { android: true, weak: true }, 'full'), 'lite',
    'даже быстрый замер не поднимает выше платформенного вердикта');
  assert.equal(prefs.motionModeFor('full', { android: true, weak: true }), 'full');
  assert.equal(prefs.motionModeFor('auto', { android: true, weak: false }), 'full',
    'четырёхъядерный ТВ под правило не попадает — решает замер');
});

/* Task 40: значение по умолчанию тумблера тяжёлых эффектов — платформенное. */
test('fxHeavyDefault: на телевизоре выключено, в браузере включено', () => {
  assert.equal(prefs.fxHeavyDefault({ android: true }), false);
  assert.equal(prefs.fxHeavyDefault({ tizen: true }), false);
  assert.equal(prefs.fxHeavyDefault({ webos: true }), false);
  assert.equal(prefs.fxHeavyDefault({}), true);
  assert.equal(prefs.fxHeavyDefault(), true, 'платформа неизвестна — как обычный браузер');
});

/* Task 29 (фаза 3): третий аргумент — вердикт автодетекта слабого ТВ
   (src/68_perf.js). Он умеет только понижать: 'full' от замеров означает
   «понижать не за что», а не «поднять выше платформенного lite». */
test('motionModeFor: вердикт автодетекта lite понижает auto на обычной платформе', () => {
  assert.equal(prefs.motionModeFor('auto', {}, 'lite'), 'lite');
  assert.equal(prefs.motionModeFor('auto', { tizen: false }, 'lite'), 'lite');
});

test('motionModeFor: вердикт автодетекта full ничего не поднимает', () => {
  assert.equal(prefs.motionModeFor('auto', {}, 'full'), 'full');
  assert.equal(prefs.motionModeFor('auto', { tizen: true }, 'full'), 'lite', 'платформенный lite остаётся');
  assert.equal(prefs.motionModeFor('auto', { webos: true }, 'full'), 'lite');
});

test('motionModeFor: ручной выбор приоритетнее вердикта автодетекта', () => {
  assert.equal(prefs.motionModeFor('full', {}, 'lite'), 'full');
  assert.equal(prefs.motionModeFor('off', {}, 'lite'), 'off');
  assert.equal(prefs.motionModeFor('lite', {}, 'full'), 'lite');
});

test('motionModeFor: вердикта нет (null/undefined/мусор) -> прежнее поведение', () => {
  assert.equal(prefs.motionModeFor('auto', {}, null), 'full');
  assert.equal(prefs.motionModeFor('auto', {}, undefined), 'full');
  assert.equal(prefs.motionModeFor('auto', {}, 'turbo'), 'full');
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
/* Таблица пунктов — версия 1.0.2.                                        */
/*                                                                        */
/* Автор 2026-09-27: «в настройках куча мусора; хочу шарить плагин другим */
/* людям — привести к нормальному виду». Было 53 пункта в одиннадцати     */
/* группах одного списка, стало два экрана: главный раздел (18 строк) и   */
/* «Дополнительно…» — раскладку согласовал автор («Да, так»).             */
/* ====================================================================== */

const LIST = prefs.LIST;
const names = LIST.filter((e) => e.type !== 'title').map((e) => e.name);

test('LIST: «Включить Lumen Card» — первый пункт раздела, без заголовка группы над ним', () => {
  assert.equal(LIST[0].name, 'lumen_enabled');
  assert.equal(LIST[0].type, 'trigger');
  assert.equal(LIST[0]['default'], true);
  assert.ok(LIST[0].descr, 'у выключателя обязана быть подсказка (карточка перерисуется при следующем открытии)');
});

/* Полный набор ключей: имена не переименованы (профили пользователей живут
   с ними), слитые пункты получили новые ключи, а четыре бывших
   «консольных» выключателя теперь в разделе. */
test('LIST: полный набор ключей 1.0.2 — старые имена не переименованы', () => {
  assert.deepEqual(names.slice().sort(), [
    'lumen_enabled',
    /* Внешний вид */
    'lumen_style', 'lumen_accent_auto', 'lumen_card_accent', 'lumen_font', 'lumen_scale',
    /* Главная */
    'lumen_hero_size', 'lumen_hero_media', 'lumen_tile_size', 'lumen_rows_limit', 'lumen_home_rows',
    /* Карточка фильма */
    'lumen_reviews', 'lumen_kp_key', 'lumen_franchise',
    /* Движение */
    'lumen_motion', 'lumen_fx', 'lumen_ambient',
    'lumen_more',
    /* Дополнительно: оформление */
    'lumen_theme', 'lumen_solid', 'lumen_flat', 'lumen_accent_scope', 'lumen_card_logo', 'lumen_hero_logo',
    'lumen_badges', 'lumen_posters',
    /* карточка и главная */
    'lumen_fx_heavy', 'lumen_slideshow', 'lumen_slide_interval', 'lumen_trailer', 'lumen_card_progress',
    'lumen_hide_meta', 'lumen_moods', 'lumen_personal_rows', 'lumen_home_start', 'lumen_rows_dedupe',
    'lumen_hide_watched',
    /* пульт и окна */
    'lumen_context_menu', 'lumen_remote_boost', 'lumen_menus', 'lumen_torrents', 'lumen_ambient_source',
    'lumen_ambient_delay',
    /* для разработчика */
    'lumen_debug_hud', 'lumen_debug_bench', 'lumen_manifest_url', 'lumen_rowmem', 'lumen_rowmem_bytes',
    'lumen_netmem', 'lumen_prefill'
  ].sort());
});

/* Убраны из раздела, но НЕ из плагина: ключи читаются как раньше. Слитые
   ключи тоже — их дочитывают места чтения (LC.prefs.MERGED). */
test('1.0.2: убранные и слитые ключи в разделе больше не стоят', () => {
  for (const gone of ['lumen_reviews_mode', 'lumen_kp_hint', 'lumen_roulette_unseen', 'lumen_card_fonts',
    'lumen_hero_trailer', 'lumen_franchise_button', 'lumen_franchise_row', 'lumen_minimap', 'lumen_fastscroll',
    'lumen_preset_appletv', 'lumen_preset_lumen']) {
    assert.equal(prefs.find(gone), null, 'пункт вернулся в раздел: ' + gone);
  }
  assert.deepEqual(prefs.MERGED, {
    lumen_font: ['lumen_card_fonts'],
    lumen_hero_media: ['lumen_hero_trailer'],
    lumen_franchise: ['lumen_franchise_button', 'lumen_franchise_row'],
    lumen_remote_boost: ['lumen_minimap', 'lumen_fastscroll']
  });
  for (const key of Object.keys(prefs.MERGED)) assert.ok(prefs.find(key), 'нового пункта нет в разделе: ' + key);
});

test('фаза 3: значения по умолчанию сохраняют прежний вид', () => {
  assert.deepEqual(['select', 'warm'], [prefs.find('lumen_theme').type, prefs.find('lumen_theme')['default']]);
  assert.deepEqual(['trigger', false], [prefs.find('lumen_solid').type, prefs.find('lumen_solid')['default']]);
  assert.deepEqual(['select', 'normal'], [prefs.find('lumen_scale').type, prefs.find('lumen_scale')['default']]);
  assert.ok(prefs.find('lumen_theme').descr, 'у темы обязана быть подсказка про OLED');
  assert.ok(prefs.find('lumen_solid').descr, 'у «Без прозрачности» обязана быть подсказка, когда включать');
  assert.ok(prefs.find('lumen_scale').descr);
});

/* Правка 2026-09-26 (пользователь: «Может подгоним размер плиток» → «Да,
   сделай»): отдельная настройка размера плиток рядов главной и сеток
   подборок — три ступени, по умолчанию «Обычные» (прежний вид). */
test('правка 2026-09-26: «Размер плиток» — три ступени, по умолчанию «Обычные», в группе «Главная»', () => {
  const e = prefs.find('lumen_tile_size');
  assert.ok(e, 'пункта нет в разделе');
  assert.equal(e.type, 'select');
  assert.equal(e['default'], 'normal');
  assert.deepEqual(e.values, ['small', 'normal', 'large']);
  assert.equal(e.vprefix, 'lumen_tile_size_');
  assert.equal(e.label, 'lumen_tile_size_name');
  assert.equal(e.descr, 'lumen_tile_size_descr');
});

test('фаза 3: масштаб — четыре ступени от «мельче» до «ещё крупнее»', () => {
  assert.deepEqual(prefs.find('lumen_scale').values, ['small', 'normal', 'large', 'huge']);
  assert.equal(prefs.find('lumen_scale').vprefix, 'lumen_scale_');
});

/* 1.0.2: два экрана. Тест закрепляет и состав групп, и их порядок, и то,
   на каком экране стоит пункт: перестановка — решение, а не побочный
   эффект правки соседней строки. */
const MAIN_GROUPS = [
  ['lumen_group_look', ['lumen_style', 'lumen_accent_auto', 'lumen_card_accent', 'lumen_font', 'lumen_scale']],
  ['lumen_group_home', ['lumen_hero_size', 'lumen_hero_media', 'lumen_tile_size', 'lumen_rows_limit', 'lumen_home_rows']],
  ['lumen_group_card', ['lumen_reviews', 'lumen_kp_key', 'lumen_franchise']],
  ['lumen_group_motion', ['lumen_motion', 'lumen_fx', 'lumen_ambient', 'lumen_more']]
];
const MORE_GROUPS = [
  ['lumen_group_style', ['lumen_theme', 'lumen_solid', 'lumen_flat', 'lumen_accent_scope', 'lumen_card_logo',
    'lumen_hero_logo', 'lumen_badges', 'lumen_posters']],
  ['lumen_group_screens', ['lumen_fx_heavy', 'lumen_slideshow', 'lumen_slide_interval', 'lumen_trailer',
    'lumen_card_progress', 'lumen_hide_meta', 'lumen_moods', 'lumen_personal_rows', 'lumen_home_start',
    'lumen_rows_dedupe', 'lumen_hide_watched']],
  ['lumen_group_remote', ['lumen_context_menu', 'lumen_remote_boost', 'lumen_menus', 'lumen_torrents',
    'lumen_ambient_source', 'lumen_ambient_delay']],
  /* «Для разработчика» — в самом низу второго экрана. */
  ['lumen_group_dev', ['lumen_debug_hud', 'lumen_debug_bench', 'lumen_manifest_url', 'lumen_rowmem',
    'lumen_rowmem_bytes', 'lumen_netmem', 'lumen_prefill']]
];

function groupsOf(entries) {
  const groups = [];
  let current = null;
  for (const e of entries) {
    if (e.type === 'title') {
      current = [e.name, []];
      groups.push(current);
      continue;
    }
    assert.ok(current, 'пункт вне группы: ' + e.name);
    current[1].push(e.name);
  }
  return groups;
}

test('1.0.2: главный раздел — выключатель, четыре группы и «Дополнительно…» последней строкой', () => {
  const main = LIST.filter((e) => e.section !== 'more');
  assert.deepEqual(groupsOf(main.slice(1)), MAIN_GROUPS);
  const rows = main.filter((e) => e.type !== 'title');
  /* 18 строк — столько согласовал автор: всё, что меняют чаще. */
  assert.equal(rows.length, 18, 'строк в главном разделе: ' + rows.length);
  assert.equal(rows[rows.length - 1].name, 'lumen_more');
  assert.equal(prefs.find('lumen_more').type, 'button');
  for (const e of main) assert.equal(e.section, undefined, 'у пункта главного раздела нет section: ' + e.name);
});

test('1.0.2: второй экран — четыре группы, «Для разработчика» в самом низу', () => {
  const more = LIST.filter((e) => e.section === 'more');
  assert.deepEqual(groupsOf(more), MORE_GROUPS);
  /* Главный раздел — строго впереди: экраны не перемешаны. */
  const first = LIST.findIndex((e) => e.section === 'more');
  assert.ok(LIST.slice(first).every((e) => e.section === 'more'), 'пункт главного раздела оказался среди второго экрана');
  assert.equal(more[more.length - 1].name, 'lumen_prefill');
  const dev = more.findIndex((e) => e.name === 'lumen_group_dev');
  assert.ok(more.slice(dev + 1).every((e) => e.type !== 'title'), 'после «Для разработчика» есть ещё группа');
});

test('1.0.2: в главном разделе группы короткие — не длиннее пяти строк', () => {
  for (const [title, items] of MAIN_GROUPS) {
    assert.ok(items.length >= 1 && items.length <= 5, 'группа ' + title + ': ' + items.length);
  }
});

test('Task 30: у каждого пункта раздела есть и название, и описание', () => {
  for (const e of LIST) {
    assert.ok(e.label, 'нет подписи: ' + e.name);
    if (e.type === 'title') continue;
    /* Человек смотрит на раздел с дивана и с пультом: название говорит,
       что это, описание — что случится. */
    assert.ok(e.descr, 'нет описания: ' + e.name);
  }
});

/* 1.0.2: бывшие «консольные» выключатели — в «Для разработчика», с
   ПРЕЖНИМИ значениями по умолчанию: читают их те же места (58_rowmem,
   58_netmem, 58_prefill), и у того, кто ничего не трогал, не меняется
   ничего. Сверку дефолтов с местами чтения держит Task 60 ниже. */
test('1.0.2: выключатели для разработчика — переключатели с прежними значениями по умолчанию', () => {
  const want = { lumen_rowmem: true, lumen_rowmem_bytes: false, lumen_netmem: true, lumen_prefill: true };
  for (const key of Object.keys(want)) {
    const e = prefs.find(key);
    assert.equal(e.type, 'trigger', key);
    assert.equal(e['default'], want[key], key);
    assert.equal(e.section, 'more', key);
  }
});

test('1.0.2: «Стиль» — select из трёх значений, «Свой» ставит сам плагин', () => {
  const e = prefs.find('lumen_style');
  assert.equal(e.type, 'select');
  assert.deepEqual(e.values, ['lumen', 'appletv', 'custom']);
  assert.equal(e['default'], 'lumen');
  assert.equal(e.vprefix, 'lumen_style_');
});

test('1.0.2: «Франшизы» и «Ускорители пульта» — переключатели, по умолчанию включены', () => {
  for (const key of ['lumen_franchise', 'lumen_remote_boost']) {
    const e = prefs.find(key);
    assert.equal(e.type, 'trigger', key);
    assert.equal(e['default'], true, key);
  }
});

test('1.0.2: «Праздничные эффекты» — два значения, по умолчанию праздники', () => {
  const e = prefs.find('lumen_fx');
  assert.equal(e.type, 'select', 'select, а не тумблер: значения — строки, как и прежде');
  assert.deepEqual(e.values, ['seasonal', 'off']);
  assert.equal(e['default'], 'seasonal');
});

test('Task 20: «Какие подборки показывать» — кнопка-параметр без значения', () => {
  const entry = prefs.find('lumen_home_rows');
  assert.equal(entry.type, 'button', 'multi-select в SettingsApi нет — это кнопка на экран выбора');
  assert.equal(typeof entry['default'], 'undefined', 'кнопка ничего не хранит');
  assert.ok(entry.label && entry.descr);
});

/* Task 35 (фаза 4): «Цвет фона от кадра» (бывший «Акцент от постера»)
   включён по умолчанию. На телевизоре это единственная видимая связь
   подложки рядов с кадром, а выключенной настройку просто не находят. */
test('Task 35: цвет фона от кадра включён по умолчанию', () => {
  const entry = prefs.find('lumen_accent_auto');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
});

/* Task 71 (фаза 6): логотип названия в кадре главной. Включён по умолчанию —
   это текущий вид, и менять его настройка не должна. */
test('Task 71: логотип в кадре — переключатель, по умолчанию включён', () => {
  const entry = prefs.find('lumen_hero_logo');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
  assert.ok(entry.descr, 'с дивана без описания не понять, что пункт меняет');
  /* 1.0.2: рядом с логотипом в карточке — оба про одно и то же. */
  const names = LIST.map((e) => e.name);
  assert.equal(names[names.indexOf('lumen_card_logo') + 1], 'lumen_hero_logo');
});

/* Волна 4 (ТВ 2026-09-24): «нет ротации списков в начале, постоянно только
   что вы смотрели раньше». По умолчанию первые ряды крутятся; кто привык к
   истории сверху — возвращает её этим пунктом. */
test('волна 4: «Начало главной» — подборки по очереди по умолчанию, «Досмотреть» сверху — по выбору', () => {
  const entry = prefs.find('lumen_home_start');
  assert.equal(entry.type, 'select');
  assert.deepEqual(entry.values, ['rotate', 'history']);
  assert.equal(entry['default'], 'rotate');
  assert.equal(entry.vprefix, 'lumen_home_start_');
  const LC = loadStrings();
  assert.equal(LC.STRINGS.lumen_home_start_name.ru, 'Начало главной');
  assert.equal(LC.STRINGS.lumen_home_start_rotate.en, 'Rotating collections');
  assert.equal(LC.STRINGS.lumen_home_start_history.uk, 'Спочатку «Досивитися»');
  assert.match(LC.STRINGS.lumen_home_start_descr.ru, /при каждом запуске Lampa/);
  assert.match(LC.STRINGS.lumen_home_start_descr.ru, /«Досмотреть» стоит вторым/);
});

test('Task 20: чипы настроения — переключатель, по умолчанию включён', () => {
  const entry = prefs.find('lumen_moods');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
});

test('LIST: типы и значения по умолчанию', () => {
  const def = {};
  for (const e of LIST) if (e.type !== 'title') def[e.name] = [e.type, e['default']];
  assert.deepEqual(def.lumen_enabled, ['trigger', true]);
  assert.deepEqual(def.lumen_card_accent, ['select', 'sand']);
  assert.deepEqual(def.lumen_motion, ['select', 'auto']);
  assert.deepEqual(def.lumen_slideshow, ['trigger', true]);
  assert.deepEqual(def.lumen_slide_interval, ['select', '14']);
  assert.deepEqual(def.lumen_trailer, ['select', 'auto']);
  assert.deepEqual(def.lumen_card_progress, ['trigger', true]);
  assert.deepEqual(def.lumen_font, ['select', 'golos']);
  assert.deepEqual(def.lumen_reviews, ['trigger', true]);
  assert.deepEqual(def.lumen_kp_key, ['input', '']);
  assert.deepEqual(def.lumen_menus, ['select', 'all']);
  assert.deepEqual(def.lumen_torrents, ['trigger', true]);
  assert.deepEqual(def.lumen_hero_media, ['select', 'trailer']);
  /* Решение пользователя 2026-09-26: 10 рядов подборок по умолчанию. */
  assert.deepEqual(def.lumen_rows_limit, ['select', '10']);
});

/* 1.0.2: «Шрифт» — «Как в Lampa» и пять гарнитур с Google Fonts (CSP
   плагина разрешает только его). «Как в Lampa» — бывший выключатель
   «Фирменные шрифты», поэтому первым в списке; по умолчанию — Golos, как и
   было. Ключи гарнитур не менялись: они уже записаны у тех, кто менял
   шрифт. */
test('настройка «Шрифт»: «Как в Lampa» и пять гарнитур, по умолчанию Golos', () => {
  const entry = prefs.find('lumen_font');
  assert.equal(entry.type, 'select');
  assert.deepEqual(entry.values, ['system', 'golos', 'onest', 'manrope', 'inter', 'plex']);
  assert.equal(entry['default'], 'golos');
  assert.equal(entry.vprefix, 'lumen_card_font_');
  const LC = loadStrings();
  assert.deepEqual(LC.STRINGS.lumen_card_font_system, { ru: 'Как в Lampa', en: 'As in Lampa', uk: 'Як у Lampa' });
});

test('LIST: у select перечислены значения, у каждого пункта есть строка подписи', () => {
  for (const e of LIST) {
    assert.ok(e.label, 'нет ключа подписи: ' + e.name);
    if (e.type !== 'select') continue;
    assert.ok(e.values && e.values.length, 'select без значений: ' + e.name);
    assert.ok(e.vprefix || e.vsuffix, 'select без правила подписи значений: ' + e.name);
  }
  /* Фаза 3: девять акцентов, порядок по цветовому кругу, нейтральный графит
     последним; «песок» остаётся первым и значением по умолчанию. */
  assert.deepEqual(prefs.find('lumen_card_accent').values,
    ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite']);
  assert.deepEqual(prefs.find('lumen_theme').values, ['warm', 'black']);
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

test('каждый пункт LIST имеет строки label/descr/placeholder во всех трёх языках', () => {
  const LC = loadStrings();
  for (const e of LC.prefs.LIST) {
    /* placeholder есть только у текстовых полей — и обязан быть у каждого:
       пустое поле Lampa показывает именно его (src/80_settings.js). */
    if (e.type === 'input') assert.ok(e.placeholder, 'текстовое поле без плейсхолдера: ' + e.name);
    for (const key of [e.label, e.descr, e.placeholder]) {
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
  for (const key of ['lumen_card_unsupported', 'lumen_card_anon', 'lumen_card_descr_more']) {
    const pack = LC.STRINGS[key];
    assert.ok(pack, 'нет строки в LC.STRINGS: ' + key);
    for (const lang of LANGS) {
      assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang + ' у ' + key);
    }
    assert.equal(new Set(LANGS.map((l) => pack[l])).size, LANGS.length,
      'переводы ' + key + ' не должны совпадать дословно: ' + LANGS.map((l) => pack[l]).join(' / '));
  }
});

/* ====================================================================== */
/* Task 56 (фаза 5): заставка — штатная Lampa по умолчанию.               */
/*                                                                        */
/* Пользователь (интервью 2026-09-21): «почему мы ушли на экране сна от   */
/* видео с крутыми картинками к постерам фильмов». Он ничего не менял:    */
/* lumen_ambient стояла включённой по умолчанию и с задержкой 3 минуты    */
/* опережала штатную (screensaver_time = '5', app.min.js:47771-47775).    */
/* ====================================================================== */

test('Task 56: наша заставка по умолчанию выключена — показывает штатная Lampa', () => {
  const entry = prefs.find('lumen_ambient');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], false);
});

test('Task 56: описание пункта называет штатную заставку Lampa, а не только кадры', () => {
  const LC = loadStrings();
  const descr = LC.STRINGS[prefs.find('lumen_ambient').descr];
  /* Человек, у которого пропало видео Lampa, должен по описанию понять,
     что оно пропало из-за этого пункта, — то есть в тексте обязано стоять
     имя Lampa. */
  for (const lang of LANGS) assert.ok(descr[lang].indexOf('Lampa') !== -1, lang + ': ' + descr[lang]);
});

/* ====================================================================== */
/* Task 61 (фаза 5), 1.0.2: трейлер в кадре главной.                      */
/*                                                                        */
/* Жалоба пользователя (интервью 2026-09-21): «Трейлер в герое через 8 с — */
/* отлично, но надо отключаемым в настройках». В 1.0.2 отдельный           */
/* выключатель автотрейлера слит в «Что в кадре»: «Только кадры» — без      */
/* трейлера. Описание обязано назвать ту же задержку, что в коде героя.    */
/* ====================================================================== */

test('Task 61, 1.0.2: «Что в кадре» называет ту же задержку трейлера, что стоит в коде героя', () => {
  const LC = loadStrings();
  const hero = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const m = /var TRAILER_DELAY = (\d+);/.exec(hero);
  assert.ok(m, 'в src/48_hero.js не нашлась константа TRAILER_DELAY');
  const seconds = String(parseInt(m[1], 10) / 1000);

  const descr = LC.STRINGS[prefs.find('lumen_hero_media').descr];
  for (const lang of LANGS) {
    /* Число в описании — единственное, по чему человек узнаёт свой случай
       («через 8 секунд сам включается»). Разойдётся с кодом — описание
       станет ложным. */
    assert.ok(new RegExp('(^|[^\\d])' + seconds + '([^\\d]|$)').test(descr[lang]),
      'в описании (' + lang + ') нет задержки ' + seconds + ' с: ' + descr[lang]);
    /* Как выключить трейлер — сказано тем же описанием, значением пункта. */
    const frames = LC.STRINGS.lumen_hero_media_frames[lang];
    assert.ok(descr[lang].indexOf(frames) !== -1, lang + ': описание не называет «' + frames + '»: ' + descr[lang]);
  }
});

test('Task 61: трейлер карточки и кадр главной названы по-разному', () => {
  const LC = loadStrings();
  const card = LC.STRINGS[prefs.find('lumen_trailer').label];
  const hero = LC.STRINGS[prefs.find('lumen_hero_media').label];
  for (const lang of LANGS) {
    assert.notEqual(card[lang], hero[lang], lang);
    assert.ok(card[lang].indexOf(hero[lang]) === -1 && hero[lang].indexOf(card[lang]) === -1, lang);
  }
  assert.equal(card.ru, 'Трейлер в карточке');
});

/* Ревью Task 62 (М6): строки подтверждения готового стиля показываются
   через Lampa.Noty, то есть ВНЕ раздела настроек, и сторожа переводов у
   пунктов LIST их не видят. Проверяем отдельно — как проверены остальные
   строки вне раздела (тест M2 выше). */
test('Task 62b: строки уведомления о готовом стиле переведены на все три языка', () => {
  const LC = loadStrings();
  for (const key of ['lumen_preset_appletv_short', 'lumen_preset_lumen_short', 'lumen_preset_same']) {
    const pack = LC.STRINGS[key];
    assert.ok(pack, 'нет строки в LC.STRINGS: ' + key);
    for (const lang of LANGS) {
      assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang + ' у ' + key);
    }
  }
  /* Названия стилей — имена собственные и совпадают во всех языках, а вот
     «уже применён» обязано быть переведено. */
  const same = LC.STRINGS.lumen_preset_same;
  assert.equal(new Set(LANGS.map((l) => same[l])).size, LANGS.length,
    'переводы lumen_preset_same не должны совпадать дословно: ' + LANGS.map((l) => same[l]).join(' / '));
});

/* 1.0.2: вместо двух длинных описаний кнопок (все десять пунктов набора
   перечислением) — одно короткое у «Стиля». Что именно поменял выбор,
   перечисляет уведомление после него (test/settings.test.mjs). Описание
   обязано сказать, какие стороны вида трогает стиль, и объяснить «Свой» —
   его ставит сам плагин, человек увидит его без всякого выбора. */
test('1.0.2: описание «Стиля» говорит, что меняется, и объясняет «Свой»', () => {
  const LC = loadStrings();
  const pack = LC.STRINGS.lumen_style_descr;
  const must = {
    ru: ['тему', 'шрифт', 'метки', '«Свой»'],
    en: ['theme', 'font', 'badges', '"Custom"'],
    uk: ['тему', 'шрифт', 'мітки', '«Свій»']
  };
  for (const lang of LANGS) {
    for (const part of must[lang]) assert.ok(pack[lang].indexOf(part) !== -1, lang + ': нет «' + part + '»: ' + pack[lang]);
    assert.equal(LC.STRINGS['lumen_style_custom'][lang], { ru: 'Свой', en: 'Custom', uk: 'Свій' }[lang]);
  }
});

/* Ревью 1.0.2 (возврат сторожа Task 73/A6): описание «Стиля» называет ВЕСЬ
   набор — иначе человек узнаёт о правке своей настройки уже после выбора.
   Разные у двух стилей пункты стиль меняет; одинаковые — возвращает из
   ручного значения, и это описание тоже обязано сказать: «Кадр над рядами»
   на «Крупный», логотип в кадре — включён. «Логотипы» во множественном
   числе были неправдой: логотип карточки (lumen_card_logo) в набор не
   входит. Набор изменился — сторож требует поправить описание. */
test('ревью 1.0.2: описание «Стиля» называет все пункты набора — что меняет и что возвращает', () => {
  const LC = loadStrings();
  const S = LC.STRINGS;
  const pack = S.lumen_style_descr;
  const lumen = prefs.presetValues('lumen');
  const apple = prefs.presetValues('appletv');
  const differ = prefs.PRESET_KEYS.filter((k) => lumen[k] !== apple[k]).sort();
  assert.deepEqual(differ, ['lumen_accent_scope', 'lumen_badges', 'lumen_card_accent', 'lumen_flat', 'lumen_font',
    'lumen_hide_meta', 'lumen_theme'], 'разные у стилей пункты изменились — поправить описание «Стиля»');
  /* Одинаковые пункты: значение, к которому стиль возвращает. */
  assert.equal(lumen.lumen_hero_size, 'large');
  assert.equal(apple.lumen_hero_size, 'large');
  assert.equal(lumen.lumen_hero_logo, true);
  assert.equal(apple.lumen_hero_logo, true);
  assert.equal(prefs.PRESET_KEYS.indexOf('lumen_card_logo'), -1, 'логотип карточки в набор не входит');

  const q = { ru: (t) => '«' + t + '»', en: (t) => '"' + t + '"', uk: (t) => '«' + t + '»' };
  const colours = { ru: 'цвета', en: 'colours', uk: 'кольори' };
  const named = {
    lumen_theme: { ru: ['тему'], en: ['theme'], uk: ['тему'] },
    lumen_card_accent: colours,
    lumen_accent_scope: colours,
    lumen_accent_auto: colours,
    lumen_font: { ru: ['шрифт'], en: ['font'], uk: ['шрифт'] },
    lumen_badges: { ru: ['метки'], en: ['badges'], uk: ['мітки'] },
    lumen_flat: { ru: ['плоское'], en: ['flat'], uk: ['пласке'] },
    lumen_hide_meta: 'lumen_hide_meta_name',
    lumen_hero_size: ['lumen_hero_size_name', 'lumen_hero_size_large'],
    lumen_hero_logo: { ru: ['включает логотип в кадре'], en: ['turns the hero logo on'], uk: ['вмикає логотип у кадрі'] }
  };
  assert.deepEqual(Object.keys(named).sort(), prefs.PRESET_KEYS.slice().sort(), 'набор стиля изменился — поправить описание «Стиля»');
  for (const lang of LANGS) {
    const text = pack[lang];
    for (const key of Object.keys(named)) {
      const want = named[key];
      let parts;
      if (typeof want === 'string') parts = [q[lang](S[want][lang])];
      else if (Array.isArray(want)) parts = want.map((k) => q[lang](S[k][lang]));
      else parts = [].concat(want[lang]);
      for (const part of parts) assert.ok(text.indexOf(part) !== -1, lang + ': ' + key + ' — нет «' + part + '»: ' + text);
    }
    assert.equal(/логотипы|logos|логотипи/i.test(text), false, lang + ': «логотипы» во множественном — логотип карточки стиль не трогает: ' + text);
  }
});

test('в словаре нет пунктов-сирот: заголовки групп — только те, что стоят в LIST', () => {
  const LC = loadStrings();
  const used = {};
  for (const e of LC.prefs.LIST) { if (e.label) used[e.label] = true; }
  for (const key of Object.keys(LC.STRINGS)) {
    if (key.indexOf('lumen_card_group_') !== 0 && key.indexOf('lumen_group_') !== 0) continue;
    assert.ok(used[key], 'заголовок группы не используется в LIST: ' + key);
  }
  /* 1.0.2: строки убранных из раздела пунктов ушли вместе с ними. */
  for (const key of ['lumen_preset_appletv_name', 'lumen_preset_lumen_descr', 'lumen_card_fonts_name',
    'lumen_hero_trailer_name', 'lumen_kp_hint_name', 'lumen_reviews_mode_name', 'lumen_roulette_unseen_name',
    'lumen_minimap_name', 'lumen_fastscroll_descr', 'lumen_franchise_button_name', 'lumen_franchise_row_descr',
    'lumen_fx_all']) {
    assert.equal(LC.STRINGS[key], undefined, 'строка убранного пункта осталась: ' + key);
  }
});

/* 1.0.2: плагин отдают другим людям, и подписи раздела читает не его
   автор. Внутренние слова — имена задач, модулей, ключей, API браузера —
   человеку с пультом ничего не говорят. Проверяется ВСЁ видимое: подписи,
   описания, подписи значений и плейсхолдеры, на трёх языках. */
test('1.0.2: в видимых строках раздела нет внутренних терминов', () => {
  const LC = loadStrings();
  const bad = /\b(Task|HUD|LQIP|rowmem|prefetch|prefill|netmem|Storage|CSS|DOM|Ken Burns)\b|lumen_|LC\./i;
  const keys = [];
  for (const e of LC.prefs.LIST) {
    for (const k of [e.label, e.descr, e.placeholder]) if (k) keys.push(k);
    if (e.type === 'select') for (const v of e.values) keys.push(e.vprefix ? e.vprefix + v : e.vsuffix);
  }
  for (const key of keys) {
    for (const lang of LANGS) {
      const text = LC.STRINGS[key][lang];
      assert.equal(bad.test(text), false, key + ' (' + lang + '): «' + text + '»');
    }
  }
});

/* 1.0.2: «настроек очень много» — описания короткие: одна-две фразы, что
   будет. Прежние доходили до тысячи знаков. */
test('1.0.2: описания пунктов короткие — не длиннее 240 знаков', () => {
  const LC = loadStrings();
  for (const e of LC.prefs.LIST) {
    if (!e.descr) continue;
    for (const lang of LANGS) {
      const text = LC.STRINGS[e.descr][lang];
      assert.ok(text.length <= 240, e.name + ' (' + lang + '): ' + text.length + ' знаков');
    }
  }
});

/* Шрифт грузится из интернета, и без него вид молча не меняется — это
   человек должен знать до того, как решит, что настройка сломана. */
test('1.0.2: описание «Шрифта» говорит про интернет и про то, что будет без него', () => {
  const LC = loadStrings();
  const must = {
    ru: ['интернет', 'не загрузился', 'не изменится'],
    en: ['internet', 'fails to load', 'nothing changes'],
    uk: ['інтернет', 'не завантажився', 'не зміниться']
  };
  for (const lang of LANGS) {
    for (const part of must[lang]) {
      assert.ok(LC.STRINGS.lumen_card_font_descr[lang].indexOf(part) !== -1, lang + ': нет «' + part + '»');
    }
  }
});

/* ====================================================================== */
/* Task 40: LC.fxHeavy — гейт тяжёлых эффектов.                           */
/* ====================================================================== */

/* Поднимает 81_prefs.js с минимальной Lampa: Storage.field отдаёт режим
   анимаций, Storage.get — значения настроек, Platform.is — платформу.
   globalThis.window ставится только на время вызова fn. */
function withPrefs(opts, fn) {
  const LC = {};
  const store = opts.store || {};
  const writes = opts.writes || [];
  const Lampa = {
    Storage: {
      field: (name) => store[name],
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : def),
      /* Task 62a: миграция значений пишет через Lampa.Storage.set — штатным
         путём Lampa, поднимающим её же listener 'change', а не правкой
         localStorage мимо неё. Журнал записей и проверяют тесты миграции. */
      set: (name, value) => { store[name] = value; writes.push([name, value]); }
    },
    Platform: { is: (name) => !!(opts.platform || {})[name] }
  };
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'window');
  const prev = globalThis.window;
  /* После 1.0.2: миграция кэша Кинопоиска перебирает localStorage — тесты
     кладут свой (fakeLocalStorage ниже); без него его нет вовсе. */
  globalThis.window = opts.localStorage ? { Lampa, localStorage: opts.localStorage } : { Lampa };
  globalThis.Lampa = Lampa;
  try {
    const src = readFileSync(new URL('../src/81_prefs.js', import.meta.url), 'utf8');
    new Function('LC', 'module', src)(LC, { exports: null, lumen: false });
    if (opts.perf) LC.perf = opts.perf;
    return fn(LC);
  } finally {
    if (had) globalThis.window = prev; else delete globalThis.window;
    delete globalThis.Lampa;
  }
}

/* Волна производительности: самотест подменяет настройки ТОЛЬКО в памяти.
   LC.prefs.override(map) — первое, что спрашивает LC.pref; Storage при этом
   не читается и не пишется, и clearOverride() возвращает настоящие
   значения. Пользователь, прервавший тест выдёргиванием питания, не должен
   найти у себя «Полный» режим вместо своего «Лёгкого». */
test('волна perf: override — подмена видна через LC.pref, Storage не пишется, clearOverride возвращает настоящее', () => {
  const writes = [];
  withPrefs({ store: { lumen_motion: 'lite', lumen_fx_heavy: 'false', lumen_trailer: 'auto' }, writes }, (LC) => {
    LC.prefs.override({ lumen_motion: 'full', lumen_fx_heavy: true, lumen_trailer: 'off', lumen_hero_trailer: false });
    assert.equal(LC.pref('lumen_motion', 'auto'), 'full');
    assert.equal(LC.pref('lumen_fx_heavy', false), true, 'булево приходит булевым');
    assert.equal(LC.pref('lumen_hero_trailer', true), false, 'false подмены — не «пусто», а false');
    assert.equal(LC.pref('lumen_trailer', 'auto'), 'off');
    assert.equal(LC.motionMode(), 'full', 'режим анимаций читает подмену');
    assert.equal(LC.pref('lumen_scale', 'normal'), 'normal', 'неподменённое читается как было');
    LC.prefs.clearOverride();
    assert.equal(LC.pref('lumen_motion', 'auto'), 'lite');
    assert.equal(LC.pref('lumen_fx_heavy', true), false);
    assert.equal(LC.pref('lumen_trailer', 'auto'), 'auto');
  });
  assert.deepEqual(writes, [], 'подмена писала в Lampa.Storage');
});

test('волна perf: override копирует карту — правка исходного объекта подмену не меняет', () => {
  withPrefs({ store: {} }, (LC) => {
    const map = { lumen_motion: 'full' };
    LC.prefs.override(map);
    map.lumen_motion = 'off';
    assert.equal(LC.pref('lumen_motion', 'auto'), 'full');
    LC.prefs.override(null);
    assert.equal(LC.pref('lumen_motion', 'auto'), 'auto');
  });
});

/* Проверка на ТВ 2026-09-24, сторож: телевизор пользователя — Android,
   режим lite (и выбранный руками, и по вердикту автодетекта), все прочие
   настройки по умолчанию. Тумблер тяжёлых эффектов там выключен — и всё
   равно смена кадров карточки и трейлер героя обязаны быть разрешены:
   именно их пользователь не видел («кадры не менялись, трейлер не
   запускался»). Модули — настоящие, в один LC с настоящими настройками. */
test('сторож ТВ 09-24: android + lite + дефолты — кадры карточки и трейлер героя разрешены', () => {
  const variants = [
    { platform: { android: true }, store: { lumen_motion: 'lite' } },
    { platform: { android: true }, store: {}, perf: { mode: () => 'lite' } }
  ];
  for (const v of variants) {
    withPrefs(v, (LC) => {
      const load = (name) => new Function('LC', 'module', readFileSync(new URL('../src/' + name, import.meta.url), 'utf8'))(LC, { exports: null, lumen: false });
      load('10_util.js');
      load('51_slideshow.js');
      load('50_backdrops.js');
      load('55_trailer.js');
      load('48_hero.js');
      assert.equal(LC.motionMode(), 'lite', 'предусловие: режим lite');
      assert.equal(LC.fxHeavy(), false, 'предусловие: тяжёлых эффектов нет');
      assert.equal(LC.backdrops.slideshowEnabled(), true, 'смена кадров карточки разрешена');
      assert.equal(LC.pref('lumen_hero_media', 'trailer'), 'trailer', 'дефолт «Кадры и трейлер»');
      assert.equal(LC.hero.trailerAllowed(LC.pref('lumen_hero_trailer', true), LC.motionMode(), LC.trailer.mode()), true,
        'трейлер героя разрешён');
      assert.equal(LC.slideshow.maxFramesFor(LC.motionMode()), 4, 'кадров в lite — четыре');
    });
  }
  /* «Выкл» — единственный режим, где контента нет. */
  withPrefs({ platform: { android: true }, store: { lumen_motion: 'off' } }, (LC) => {
    const load = (name) => new Function('LC', 'module', readFileSync(new URL('../src/' + name, import.meta.url), 'utf8'))(LC, { exports: null, lumen: false });
    load('10_util.js');
    load('51_slideshow.js');
    load('50_backdrops.js');
    load('55_trailer.js');
    load('48_hero.js');
    assert.equal(LC.backdrops.slideshowEnabled(), false);
    assert.equal(LC.hero.trailerAllowed(true, LC.motionMode(), LC.trailer.mode()), false);
  });
});

test('fxHeavy: на телевизоре выключен по умолчанию, в браузере включён', () => {
  assert.equal(withPrefs({ platform: { android: true } }, (LC) => LC.fxHeavy()), false);
  assert.equal(withPrefs({ platform: {} }, (LC) => LC.fxHeavy()), true);
  /* Включённый руками тумблер действует и на телевизоре. */
  assert.equal(withPrefs({ platform: { android: true }, store: { lumen_fx_heavy: 'true' } }, (LC) => LC.fxHeavy()), true);
  assert.equal(withPrefs({ platform: {}, store: { lumen_fx_heavy: 'false' } }, (LC) => LC.fxHeavy()), false);
});

test('fxHeavy: в lite и off тяжёлых эффектов нет даже при включённом тумблере', () => {
  for (const mode of ['lite', 'off']) {
    assert.equal(withPrefs({ platform: {}, store: { lumen_motion: mode, lumen_fx_heavy: 'true' } }, (LC) => LC.fxHeavy()), false, mode);
  }
  assert.equal(withPrefs({ platform: {}, store: { lumen_motion: 'full', lumen_fx_heavy: 'true' } }, (LC) => LC.fxHeavy()), true);
});

/* Task 40: заведомо слабое железо понижает режим до lite ещё до замеров —
   значит и тяжёлых эффектов там нет, как бы ни стоял тумблер. */
test('fxHeavy: на заведомо слабом железе выключен вместе с режимом', () => {
  const weak = { weakHardware: () => true, mode: () => null };
  assert.equal(withPrefs({ platform: { android: true }, perf: weak, store: { lumen_fx_heavy: 'true' } }, (LC) => LC.motionMode()), 'lite');
  assert.equal(withPrefs({ platform: { android: true }, perf: weak, store: { lumen_fx_heavy: 'true' } }, (LC) => LC.fxHeavy()), false);
});

test('platformInfo: собирает платформу и признак слабого железа одним объектом', () => {
  const info = withPrefs({
    platform: { android: true },
    perf: { weakHardware: () => true, mode: () => null }
  }, (LC) => LC.platformInfo());
  assert.deepEqual(info, { tizen: false, webos: false, android: true, weak: true });
  /* Без LC.perf (модуль не загружен) признак слабого железа просто ложен. */
  assert.deepEqual(withPrefs({ platform: { tizen: true } }, (LC) => LC.platformInfo()),
    { tizen: true, webos: false, android: false, weak: false });
});

/* ====================================================================== */
/* Task 62a (фаза 5): метки — три состояния вместо двух, и область         */
/* подкраски от постера.                                                   */
/*                                                                         */
/* «Метки на постерах» были переключателем (Task 25). У Apple TV плашек на  */
/* постере нет вовсе — статус читается в подписи под ним, — а пользователь  */
/* про дубли на карточке говорил ровно то же (интервью 2026-09-21).         */
/* Значит состояний три: плашка на постере · строка в подписи · нет.        */
/* ====================================================================== */

test('Task 62a: метки — select из трёх значений, по умолчанию плашка на постере', () => {
  const entry = prefs.find('lumen_badges');
  assert.equal(entry.type, 'select', 'переключателя мало: значений стало три');
  assert.deepEqual(entry.values, ['poster', 'caption', 'off']);
  assert.equal(entry['default'], 'poster', 'вид по умолчанию не меняется — это прежнее «включено»');
  assert.equal(entry.vprefix, 'lumen_badges_');
});

/* Сохранённое значение старого переключателя — СТРОКА 'true'/'false'
   (Lampa.Storage.set(name, false) с JS-false не сохраняется вовсе, см.
   boolOf выше). Кто метки не трогал — ключа в Storage не имеет вовсе. */
test('Task 62a: badgesMode переводит старое значение переключателя в новое', () => {
  for (const yes of ['true', true, 1, '1']) assert.equal(prefs.badgesMode(yes), 'poster', String(yes));
  for (const no of ['false', false, 0, '0']) assert.equal(prefs.badgesMode(no), 'off', String(no));
});

test('Task 62a: badgesMode — новые значения как есть, пусто и мусор -> poster', () => {
  assert.equal(prefs.badgesMode('poster'), 'poster');
  assert.equal(prefs.badgesMode('caption'), 'caption');
  assert.equal(prefs.badgesMode('off'), 'off');
  assert.equal(prefs.badgesMode(undefined), 'poster', 'ключа в Storage нет — значение по умолчанию');
  assert.equal(prefs.badgesMode(null), 'poster');
  assert.equal(prefs.badgesMode(''), 'poster');
  assert.equal(prefs.badgesMode('nonsense'), 'poster');
});

/* Миграция выполняется ОДИН раз, через Lampa.Storage.set: правка
   localStorage мимо Lampa не поднимет её listener 'change' и разойдётся с
   её же кэшем значений. */
test('Task 62a: migratePrefs переписывает старое значение меток ровно один раз', () => {
  for (const [old, want] of [['true', 'poster'], ['false', 'off']]) {
    const writes = [];
    withPrefs({ store: { lumen_badges: old }, writes: writes }, (LC) => {
      LC.migratePrefs();
      LC.migratePrefs();
    });
    assert.deepEqual(writes, [['lumen_badges', want]], old + ' -> ' + want + ', и только первым вызовом');
  }
});

test('Task 62a: migratePrefs молчит, когда мигрировать нечего', () => {
  for (const store of [{}, { lumen_badges: 'caption' }, { lumen_badges: 'poster' }, { lumen_badges: 'off' }]) {
    const writes = [];
    withPrefs({ store: store, writes: writes }, (LC) => LC.migratePrefs());
    assert.deepEqual(writes, [], 'лишняя запись при ' + JSON.stringify(store));
  }
});

/* ====================================================================== */
/* 1.0.2: миграции слитых пунктов.                                        */
/*                                                                        */
/* Значения — СТРОКИ: Lampa.Storage не хранит JS-false (boolOf выше).     */
/* Старые булевы Lampa отдаёт из Storage.get уже булевыми (true/false) —  */
/* оба вида проверяются. Старые ключи миграция не трогает (ревью 1.0.2:   */
/* 1.0.1 читает только их, откат не должен включать выключенное); второй  */
/* запуск ничего не пишет — новый пункт уже переведён.                    */
/* ====================================================================== */

function migrated(store) {
  const writes = [];
  withPrefs({ store: store, writes: writes }, (LC) => { LC.migratePrefs(); LC.migratePrefs(); });
  return { writes, store };
}

test('1.0.2: «Фирменные шрифты» выкл → «Шрифт: Как в Lampa», ровно один раз, старый ключ не тронут', () => {
  for (const off of ['false', false]) {
    const { writes, store } = migrated({ lumen_card_fonts: off, lumen_font: 'inter' });
    assert.deepEqual(writes, [['lumen_font', 'system']], String(off));
    assert.equal(store.lumen_font, 'system');
    assert.equal(store.lumen_card_fonts, off, 'для отката на 1.0.1 шрифты остаются выключенными');
  }
  /* Включённые шрифты — выбор гарнитуры остаётся. */
  assert.deepEqual(migrated({ lumen_card_fonts: 'true', lumen_font: 'plex' }).writes, []);
  /* Уже переведённый профиль (следующий запуск) — записей нет. */
  assert.deepEqual(migrated({ lumen_card_fonts: 'false', lumen_font: 'system' }).writes, []);
});

test('1.0.2: автотрейлер в кадре главной выкл → «Что в кадре: Только кадры», старый ключ не тронут', () => {
  for (const off of ['false', false]) {
    const { writes, store } = migrated({ lumen_hero_trailer: off });
    assert.deepEqual(writes, [['lumen_hero_media', 'frames']], String(off));
    assert.equal(store.lumen_hero_trailer, off);
  }
  assert.deepEqual(migrated({ lumen_hero_trailer: 'true', lumen_hero_media: 'trailer' }).writes, []);
  assert.deepEqual(migrated({ lumen_hero_trailer: 'false', lumen_hero_media: 'frames' }).writes, []);
});

test('1.0.2: «Атмосферы: Все» → «Праздничные эффекты: Новый год и Хэллоуин», «Выкл» остаётся', () => {
  assert.deepEqual(migrated({ lumen_fx: 'all' }).writes, [['lumen_fx', 'seasonal']]);
  assert.deepEqual(migrated({ lumen_fx: 'off' }).writes, []);
  assert.deepEqual(migrated({ lumen_fx: 'seasonal' }).writes, []);
});

/* Слитые из двух: выключены оба — новый пункт выключен. Выключен один —
   переводить не во что: новый пункт остаётся включённым, а старый ключ
   дочитывает место чтения (кнопка «Франшиза» так и остаётся скрытой, пока
   человек не тронет «Франшизы»). */
test('1.0.2: «Франшизы» и «Ускорители пульта» — выкл, только если были выключены обе части', () => {
  const fr = migrated({ lumen_franchise_button: 'false', lumen_franchise_row: false });
  assert.deepEqual(fr.writes, [['lumen_franchise', 'false']]);
  assert.equal(fr.store.lumen_franchise_button, 'false', 'старые ключи не тронуты — откат на 1.0.1 их видит');
  assert.equal(fr.store.lumen_franchise_row, false);
  const nav = migrated({ lumen_minimap: 'false', lumen_fastscroll: 'false' });
  assert.deepEqual(nav.writes, [['lumen_remote_boost', 'false']]);
  assert.equal(nav.store.lumen_minimap, 'false');
  assert.equal(nav.store.lumen_fastscroll, 'false');
  for (const store of [{ lumen_franchise_button: 'false' }, { lumen_franchise_row: 'false' },
    { lumen_minimap: 'false' }, { lumen_fastscroll: 'false', lumen_minimap: 'true' },
    { lumen_franchise_button: 'false', lumen_franchise_row: 'false', lumen_franchise: 'false' },
    { lumen_minimap: 'false', lumen_fastscroll: 'false', lumen_remote_boost: false }]) {
    assert.deepEqual(migrated(store).writes, [], 'частичный выбор или уже переведённый: ' + JSON.stringify(store));
  }
});

/* Ревью 1.0.2: какое значение старых ключей отвечает значению нового
   пункта — его пишет releaseMerged, и его же видит откат на 1.0.1. */
test('1.0.2: mergedOn — старые ключи выключены ровно при «выключающем» значении нового пункта', () => {
  assert.equal(prefs.mergedOn('lumen_font', 'system'), false);
  for (const v of ['golos', 'inter', 'plex', undefined]) assert.equal(prefs.mergedOn('lumen_font', v), true, String(v));
  assert.equal(prefs.mergedOn('lumen_hero_media', 'frames'), false);
  assert.equal(prefs.mergedOn('lumen_hero_media', 'trailer'), true);
  for (const name of ['lumen_franchise', 'lumen_remote_boost']) {
    for (const v of ['false', false]) assert.equal(prefs.mergedOn(name, v), false, name + ' ' + String(v));
    for (const v of ['true', true, undefined, '']) assert.equal(prefs.mergedOn(name, v), true, name + ' ' + String(v));
  }
});

test('1.0.2: сбой одного шага миграции не отменяет остальные', () => {
  const writes = [];
  const warns = [];
  const had = Object.prototype.hasOwnProperty.call(globalThis, 'warn');
  const prev = globalThis.warn;
  globalThis.warn = (msg) => warns.push(msg);
  try {
    withPrefs({ store: { lumen_badges: 'true', lumen_card_fonts: 'false', lumen_fx: 'all' }, writes: writes }, (LC) => {
      const set = Lampa.Storage.set;
      Lampa.Storage.set = (name, value) => { if (name === 'lumen_font') throw new Error('квота'); set(name, value); };
      LC.migratePrefs();
    });
  } finally {
    if (had) globalThis.warn = prev; else delete globalThis.warn;
  }
  assert.deepEqual(writes, [['lumen_badges', 'poster'], ['lumen_fx', 'seasonal']]);
  assert.equal(warns.length, 1);
});

/* ====================================================================== */
/* После 1.0.2: кэш снятых подборок Кинопоиска.                            */
/*                                                                         */
/* Страницы lumen_kp_<КОЛЛЕКЦИЯ>_<страница>, постеры плиток                */
/* lumen_kpp_<КОЛЛЕКЦИЯ> и их индекс lumen_sources_index занимают квоту    */
/* localStorage, нужную отзывам. Миграция удаляет их один раз (второй      */
/* запуск ничего не пишет), не трогая ключ API, подсказку, состав рядов    */
/* главной и кэш отзывов.                                                  */
/* ====================================================================== */

function fakeLocalStorage(data) {
  const removed = [];
  return {
    data, removed,
    get length() { return Object.keys(data).length; },
    key(i) { const k = Object.keys(data)[i]; return k === undefined ? null : k; },
    getItem(k) { return Object.prototype.hasOwnProperty.call(data, k) ? data[k] : null; },
    removeItem(k) { removed.push(k); delete data[k]; }
  };
}

test('после 1.0.2: migratePrefs удаляет кэш подборок Кинопоиска и его индекс — один раз', () => {
  const index = ['lumen_kp_TOP_250_MOVIES_1', 'lumen_kpp_TOP_250_MOVIES', 'lumen_kp_TOP_250_MOVIES_2'];
  const store = { lumen_sources_index: index.slice(), lumen_kp_key: 'СЕКРЕТ', lumen_kp_hint: 'false', lumen_home_rows: 'kp-top250,star-wars' };
  const ls = fakeLocalStorage({
    lumen_kp_TOP_250_MOVIES_1: '{}', lumen_kpp_TOP_250_MOVIES: '{}', lumen_kp_TOP_250_MOVIES_2: '{}',
    /* Отметка неудачи на 10 минут: в индекс она не попадала. */
    lumen_kp_POPULAR_SERIES_1: '{}',
    lumen_sources_index: '[]',
    lumen_kp_key: 'СЕКРЕТ', lumen_kp_hint: 'false', lumen_home_rows: 'kp-top250,star-wars',
    lumen_rv_tt0111161: '{}', lumen_rv_index: '[]', lumen_manifest: '{}'
  });
  const writes = [];
  withPrefs({ store, writes, localStorage: ls }, (LC) => { LC.migratePrefs(); LC.migratePrefs(); });
  const gone = index.concat(['lumen_kp_POPULAR_SERIES_1', 'lumen_sources_index']);
  assert.deepEqual(writes.map((w) => w[0]).sort(), gone.slice().sort(), 'каждый ключ — одной записью, второй запуск молчит');
  for (const w of writes) assert.equal(w[1], '', 'значение обнуляется через Lampa.Storage: ' + w[0]);
  assert.deepEqual(ls.removed.slice().sort(), gone.slice().sort(), 'и ключ уходит из localStorage');
  assert.deepEqual(Object.keys(ls.data).sort(),
    ['lumen_home_rows', 'lumen_kp_hint', 'lumen_kp_key', 'lumen_manifest', 'lumen_rv_index', 'lumen_rv_tt0111161']);
  assert.equal(store.lumen_kp_key, 'СЕКРЕТ', 'ключ API — отзывам');
  assert.equal(store.lumen_kp_hint, 'false');
  assert.equal(store.lumen_home_rows, 'kp-top250,star-wars', 'состав рядов не переписывается: откат на 1.0.2');
});

/* Имя из индекса — только вида кэша КП: мусор или чужой ключ в индексе
   (хоть сам ключ API) не удаляется. localStorage недоступен — индекс
   чистится через Lampa.Storage, как у прочих шагов. */
test('после 1.0.2: миграция кэша Кинопоиска — только имена его вида, без localStorage — через Storage', () => {
  const store = { lumen_sources_index: ['lumen_kp_key', 'lumen_kp_hint', 'lumen_rv_index', 'lumen_kpp_X', 5, null, 'lumen_kp_top_1'] };
  const writes = [];
  withPrefs({ store, writes }, (LC) => LC.migratePrefs());
  assert.deepEqual(writes, [['lumen_kpp_X', ''], ['lumen_sources_index', '']]);
});

test('после 1.0.2: кэша Кинопоиска нет — миграция ничего не пишет и не удаляет', () => {
  const ls = fakeLocalStorage({ lumen_kp_key: 'K', lumen_kp_hint: 'false', lumen_rv_tt1: '{}', lumen_home_rows: 'kp-top250' });
  const writes = [];
  withPrefs({ store: { lumen_kp_key: 'K' }, writes, localStorage: ls }, (LC) => LC.migratePrefs());
  assert.deepEqual(writes, []);
  assert.deepEqual(ls.removed, []);
});

/* Частичный выбор дочитывается местами чтения — сверка по исходникам:
   каждый старый ключ из MERGED по-прежнему читается рядом с новым. */
test('1.0.2: места чтения дочитывают старые ключи слитых пунктов', () => {
  const src = (name) => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
  assert.match(src('46_hub.js'), /LC\.pref\('lumen_franchise', true\) && !!LC\.pref\('lumen_franchise_button', true\)/);
  assert.match(src('66_franchise.js'), /LC\.pref\('lumen_franchise', true\) && !!LC\.pref\('lumen_franchise_row', true\)/);
  assert.match(src('90_runtime.js'), /!LC\.pref\('lumen_franchise', true\) \|\| !LC\.pref\('lumen_franchise_row', true\)/);
  assert.match(src('64_nav.js'), /boostOn\(\) && LC\.pref\('lumen_minimap', true\)/);
  assert.match(src('64_nav.js'), /boostOn\(\) && LC\.pref\('lumen_fastscroll', true\)/);
  assert.match(src('30_css.js'), /LC\.pref\('lumen_font', FONT_DEFAULT\) !== 'system' && !!LC\.pref\(PLUGIN \+ '_fonts', true\)/);
  assert.match(src('48_hero.js'), /LC\.pref\('lumen_hero_trailer', true\)/);
});

/* Пункт читается ровно одной функцией — иначе дефолт вызова и дефолт
   пункта однажды разойдутся (ровно так молчала подкраска с Task 35 по
   Task 60, см. сверку в самом низу файла). */
test('Task 62a: LC.badgesMode читает настройку с тем же дефолтом, что стоит в LIST', () => {
  assert.equal(withPrefs({ store: {} }, (LC) => LC.badgesMode()), prefs.find('lumen_badges')['default']);
  assert.equal(withPrefs({ store: { lumen_badges: 'true' } }, (LC) => LC.badgesMode()), 'poster');
  assert.equal(withPrefs({ store: { lumen_badges: 'false' } }, (LC) => LC.badgesMode()), 'off');
  assert.equal(withPrefs({ store: { lumen_badges: 'caption' } }, (LC) => LC.badgesMode()), 'caption');
});

/* Постеры: источник постера — та же сверка двух дефолтов. Расхождение
   «дефолт вызова» и «дефолт пункта» и было дефектом Task 60: настройка
   молча работала не так, как её показывает раздел. */
test('Постеры: LC.postersMode читает настройку с тем же дефолтом, что стоит в LIST', () => {
  assert.equal(withPrefs({ store: {} }, (LC) => LC.postersMode()), prefs.find('lumen_posters')['default']);
  assert.equal(withPrefs({ store: {} }, (LC) => LC.postersMode()), 'lampa');
  assert.equal(withPrefs({ store: { lumen_posters: 'original' } }, (LC) => LC.postersMode()), 'original');
  assert.equal(withPrefs({ store: { lumen_posters: 'clean' } }, (LC) => LC.postersMode()), 'clean');
  /* Незнакомое значение — режим без единого лишнего запроса, самый
     безопасный из трёх. */
  for (const bad of ['', 'true', 'nope', '1']) {
    assert.equal(withPrefs({ store: { lumen_posters: bad } }, (LC) => LC.postersMode()), 'lampa',
      'битое значение ' + JSON.stringify(bad) + ' обязано читаться как lampa');
  }
});

test('Постеры: источник постера — select из трёх положений, по умолчанию «как в Lampa»', () => {
  const entry = prefs.find('lumen_posters');
  assert.equal(entry.type, 'select');
  assert.deepEqual(entry.values, ['lampa', 'original', 'clean']);
  assert.equal(entry['default'], 'lampa', 'у того, кто пункт не трогал, не должно меняться ничего');
  assert.equal(entry.vprefix, 'lumen_posters_');
  assert.ok(entry.descr, 'у пункта обязано быть описание — цену режимов надо назвать до нажатия');
});

/* Цена режима «без надписей» — запрос на карточку, и человеку с
   телевизором это важнее красоты формулировки. Сторож держит обещания
   описания: цена названа числами (ряд из одного списка, смешанный ряд,
   набор главной — Ф3 п.4 ревью фикс-раундов: прежнее «около двадцати на
   ряд» занижало смешанные ряды), названа компенсация — кэш, и сказано, на
   чём он держится — на настройке Lampa «Кэширование запросов». */
test('Постеры: описание называет цену «без надписей», кэш и настройку Lampa, на которой он держится', () => {
  const LC = loadStrings();
  const pack = LC.STRINGS.lumen_posters_descr;
  /* 1.0.2: описание короткое — цену называет словами «запрос на каждую
     карточку» (числа по рядам — в README, раздел настроек). */
  const numbers = { ru: ['по запросу на карточку'], en: ['once per card'], uk: ['по запиту на картку'] };
  const cache = { ru: 'кэш', en: 'cache', uk: 'кеш' };
  /* Подписи самой Lampa: vendor/lampa/app.min.js:48930 и :51226,
     vendor/lampa/lang/uk.js:1246. */
  const lampaCaching = { ru: 'кэширование запросов', en: 'request caching', uk: 'кешування запитів' };
  for (const lang of LANGS) {
    const text = ('' + pack[lang]).toLowerCase();
    for (const one of numbers[lang]) {
      assert.ok(text.indexOf(one) !== -1, lang + ': в описании не названа цена «' + one + '»');
    }
    assert.ok(text.indexOf(cache[lang]) !== -1, lang + ': в описании не сказано про кэш');
    assert.ok(text.indexOf(lampaCaching[lang]) !== -1, lang + ': не сказано, что кэш держится на настройке Lampa');
  }
});

/* Ф3 (решение координатора): режим 'original' даёт английскую обложку, а
   не обложку на языке оригинала — подпись это и говорит. Ключ значения
   прежний: он уже сохранён у пользователя. */
test('Постеры: режим original подписан «Английские» на трёх языках, ключ значения прежний', () => {
  const LC = loadStrings();
  assert.deepEqual(LC.STRINGS.lumen_posters_original, { ru: 'Английские', en: 'English', uk: 'Англійські' });
  assert.deepEqual(prefs.find('lumen_posters').values, ['lampa', 'original', 'clean']);
  const said = { ru: '«английские»', en: '"english"', uk: '«англійські»' };
  const old = { ru: '«оригинал»', en: '"original"', uk: '«оригінал»' };
  for (const lang of LANGS) {
    const text = ('' + LC.STRINGS.lumen_posters_descr[lang]).toLowerCase();
    assert.ok(text.indexOf(said[lang]) !== -1, lang + ': описание зовёт режим новой подписью');
    assert.equal(text.indexOf(old[lang]), -1, lang + ': старой подписи в описании нет');
  }
});

/* Область подкраски: у Apple TV цвет с постера живёт только в фоне, а
   элементы управления остаются нейтральными. «Полная» — как было. */
test('Task 62a: область подкраски — select full/veil, по умолчанию как было', () => {
  const entry = prefs.find('lumen_accent_scope');
  assert.equal(entry.type, 'select');
  assert.deepEqual(entry.values, ['full', 'veil']);
  assert.equal(entry['default'], 'full');
  assert.equal(entry.vprefix, 'lumen_accent_scope_');
  assert.ok(entry.descr, 'у пункта обязано быть описание — с дивана иначе не понять, что он меняет');
});

/* ====================================================================== */
/* Task 62b (фаза 5): готовый стиль — таблица значений.                    */
/*                                                                         */
/* Кнопка не «режим», а НАБОР ЗНАЧЕНИЙ: каждое отличие — тот же пункт       */
/* раздела, который пользователь может потом поправить по одному и не       */
/* потерять правку при следующем запуске.                                   */
/* ====================================================================== */

test('Task 62b: пресет трогает только оформление — и ни одной настройки вне него', () => {
  /* Запрет из плана фазы 5 («Что НЕ делать») и прямое требование
     пользователя: ключ Кинопоиска, масштаб, движение, заставка, ряды,
     адрес каталога и настройки самой Lampa — выбор пользователя, к
     оформлению отношения не имеющий. */
  const forbidden = ['lumen_kp_key', 'lumen_scale', 'lumen_motion', 'lumen_fx', 'lumen_fx_heavy',
    'lumen_ambient', 'lumen_ambient_source', 'lumen_ambient_delay', 'lumen_home_rows',
    'lumen_rows_limit', 'lumen_manifest_url', 'lumen_hero_trailer', 'lumen_solid',
    'background', 'glass_style', 'poster_size', 'interface_size'];
  for (const key of prefs.PRESET_KEYS) {
    assert.ok(forbidden.indexOf(key) === -1, 'пресет трогает чужую настройку: ' + key);
    assert.ok(prefs.find(key), 'ключа пресета нет в разделе настроек: ' + key);
  }
  /* Ревью 2026-09-22 (п.4): lumen_hero_logo в наборе обязателен — стиль
     обязан быть полным состоянием вида, а не разницей, и план фазы 6
     оговаривал логотип прямо («в обоих стилях включён»). Без него
     «Применить стиль Apple TV» давал Apple TV без title treatment, а
     «Вернуть стиль Lumen» логотип не возвращал.
     A6: десятым в наборе — lumen_hide_meta: курс стиля Apple TV на «ничего
     лишнего» доходит и до чужих блоков анализа на карточке, а стиль Lumen
     возвращает их значением по умолчанию пункта (выключено). */
  assert.deepEqual(prefs.PRESET_KEYS.slice().sort(), [
    'lumen_accent_auto', 'lumen_accent_scope', 'lumen_badges', 'lumen_card_accent',
    'lumen_flat', 'lumen_font', 'lumen_hero_logo', 'lumen_hero_size', 'lumen_theme',
    'lumen_hide_meta'
  ].sort());
});

/* «Вернуть стиль Lumen» — это ровно значения по умолчанию плагина, и взяты
   они из самой таблицы LIST, а не переписаны литералами рядом: два списка
   одних и тех же чисел однажды разойдутся. */
test('Task 62b: стиль Lumen — значения по умолчанию из LIST, без второй копии', () => {
  const lumen = prefs.presetValues('lumen');
  assert.deepEqual(Object.keys(lumen).sort(), prefs.PRESET_KEYS.slice().sort());
  for (const key of prefs.PRESET_KEYS) {
    assert.equal(lumen[key], prefs.find(key)['default'], key);
  }
  /* Контрольные значения — чтобы тест ловил и подмену самих дефолтов. */
  assert.equal(lumen.lumen_theme, 'warm');
  assert.equal(lumen.lumen_card_accent, 'sand');
  assert.equal(lumen.lumen_font, 'golos');
  assert.equal(lumen.lumen_badges, 'poster');
  assert.equal(lumen.lumen_accent_scope, 'full');
  /* Task 73: плоский вид — это стиль Apple TV, в Lumen коробки остаются. */
  assert.equal(lumen.lumen_flat, false);
});

test('Task 62b: стиль Apple TV — нейтральная палитра, метки в подписи, цвет только в фоне', () => {
  const apple = prefs.presetValues('appletv');
  assert.deepEqual(Object.keys(apple).sort(), prefs.PRESET_KEYS.slice().sort(),
    'оба стиля обязаны задавать ОДИН и тот же набор ключей — иначе переключение оставит хвост');
  assert.equal(apple.lumen_theme, 'black', 'глубокая чёрная — OLED-фон Apple TV');
  assert.equal(apple.lumen_card_accent, 'graphite', 'нейтральный акцент против тёплого Lumen');
  assert.equal(apple.lumen_font, 'inter');
  assert.equal(apple.lumen_badges, 'caption', 'на обложке плашек нет — статус в подписи');
  assert.equal(apple.lumen_accent_scope, 'veil', 'цвет кадра не заходит на управление');
  assert.equal(apple.lumen_hero_size, 'large');
  assert.equal(apple.lumen_accent_auto, true);
  /* Task 73: отзыв пользователя 2026-09-21 (п.3) — «менялся только дизайн
     стартовой». Плоский вид и есть то, чем стиль доходит до карточки,
     сетки, хаба и пути TorrServer. */
  assert.equal(apple.lumen_flat, true, 'плоский вид обязан входить в стиль Apple TV');

  /* Каждое значение обязано быть допустимым для своего пункта — иначе
     раздел настроек покажет пустую строку, а код получит мусор. */
  for (const key of prefs.PRESET_KEYS) {
    const entry = prefs.find(key);
    if (entry.type === 'select') assert.ok(entry.values.indexOf(apple[key]) !== -1, key + ': ' + apple[key]);
    if (entry.type === 'trigger') assert.equal(typeof apple[key], 'boolean', key);
  }
});

test('Task 62b: неизвестный стиль — пустой набор, а не половина значений', () => {
  assert.deepEqual(prefs.presetValues('nope'), {});
  assert.deepEqual(prefs.presetValues(''), {});
  assert.deepEqual(prefs.presetValues(), {});
});

/* 1.0.2: «Стиль» показывает то, что стоит на самом деле: набор целиком
   совпал со стилем — его имя, иначе «Свой». */
test('1.0.2: styleOf — стиль по фактическим значениям, иначе custom', () => {
  const read = (values) => (key) => values[key];
  assert.equal(prefs.styleOf(read(prefs.presetValues('lumen'))), 'lumen');
  assert.equal(prefs.styleOf(read(prefs.presetValues('appletv'))), 'appletv');
  for (const key of prefs.PRESET_KEYS) {
    const tweaked = Object.assign({}, prefs.presetValues('appletv'));
    const entry = prefs.find(key);
    tweaked[key] = entry.type === 'trigger' ? !tweaked[key] : '__другое__';
    assert.equal(prefs.styleOf(read(tweaked)), 'custom', 'правка ' + key + ' не сделала стиль «Своим»');
  }
});

/* ====================================================================== */
/* Task 60: дефолт вызова и дефолт пункта — одно и то же число.            */
/* ====================================================================== */

/* Lampa.Storage.get(name, empty) при отсутствующем в localStorage ключе
   возвращает ровно empty (vendor/lampa/app.min.js, тело Storage.get:
   `value = value || empty || ''`), а раздел настроек рисует пункт по СВОЕМУ
   дефолту — тому, что плагин зарегистрировал через SettingsApi.addParam из
   LC.prefs.LIST (Lampa.Params.trigger/select кладут его в defaults,
   app.min.js:47484-47501). Значит два дефолта у одной настройки — это два
   разных ответа на один вопрос: пользователь видит в разделе «Вкл», а код
   ведёт себя как при «Выкл». Ровно так с Task 35 по Task 60 молчала
   подкраска от постера (см. src/57_color.js, auto()).

   Тест читает исходники и сверяет их построчно: у каждого вызова
   LC.pref('ключ', дефолт), чей ключ есть в LIST со своим 'default',
   дефолты обязаны совпадать. Имя ключа и дефолт разрешаются и через
   переменную модуля (var AUTO_KEY = 'lumen_accent_auto'), потому что
   промах Task 35 прятался именно за ней. */
test('Task 60: у каждого вызова LC.pref дефолт совпадает с пунктом LC.prefs.LIST', () => {
  /* Разбирается СОБРАННЫЙ файл, а не src/: сборка вычищает из него
     комментарии (scripts/build.mjs), сохраняя переводы строк и маркеры
     модулей, — иначе сверка спотыкалась бы о примеры вызовов, написанные в
     комментариях (в src/57_color.js такой есть, и он описывает как раз
     неправильный дефолт). Актуальность dist относительно src проверяет
     test/build.test.mjs. */
  const dist = readFileSync(new URL('../dist/lumen_card.js', import.meta.url), 'utf8');
  const byName = {};
  for (const e of LIST) if (e.type !== 'title' && typeof e['default'] !== 'undefined') byName[e.name] = e['default'];

  /* Литерал ES5, который может стоять дефолтом пункта: строка, число,
     true/false. Всё остальное (функция у lumen_fx_heavy) сверять нечем. */
  function literal(text) {
    const s = text.trim();
    if (/^'[^']*'$/.test(s)) return s.slice(1, -1);
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s);
    return undefined;
  }
  /* Константы модулей: var NAME = <литерал>; — ими записаны и ключ
     (var AUTO_KEY = 'lumen_accent_auto'), и часть дефолтов ('large',
     'normal'). Имена верхнего уровня в бандле уникальны — это гарантирует
     сама сборка (scripts/build.mjs сверяет их и падает при повторе), —
     поэтому одной таблицы на весь файл достаточно. */
  const consts = {};
  const cre = /\bvar\s+([A-Za-z_$][\w$]*)\s*=\s*('[^']*'|true|false|-?\d+(?:\.\d+)?)\s*;/g;
  let c;
  while ((c = cre.exec(dist))) consts[c[1]] = literal(c[2]);

  function resolve(text) {
    const s = text.trim();
    const lit = literal(s);
    if (typeof lit !== 'undefined') return { ok: true, value: lit };
    if (Object.prototype.hasOwnProperty.call(consts, s)) return { ok: true, value: consts[s] };
    /* Ключ, склеенный с префиксом плагина: LC.pref(PLUGIN + '_accent',
       'sand') в src/30_css.js и LC.pref(PLUGIN + '_progress', true) в
       src/85_header.js. Без разбора конкатенации три ключа молча выпадали
       из сверки — ровно те, у которых имя пишется не литералом. */
    const glue = /^([A-Za-z_$][\w$]*)\s*\+\s*('[^']*')$/.exec(s);
    if (glue && Object.prototype.hasOwnProperty.call(consts, glue[1])) {
      const head = consts[glue[1]];
      if (typeof head === 'string') return { ok: true, value: head + literal(glue[2]) };
    }
    return { ok: false };
  }

  const checked = [];
  dist.split(/\r?\n/).forEach((line, i) => {
    const call = /LC\.pref\(\s*([^,()]+?)\s*,\s*([^,()]+?)\s*\)/g;
    let m;
    while ((m = call.exec(line))) {
      const key = resolve(m[1]);
      const def = resolve(m[2]);
      if (!key.ok || typeof key.value !== 'string') continue;
      if (!Object.prototype.hasOwnProperty.call(byName, key.value)) continue;
      if (!def.ok) continue;
      checked.push(key.value);
      assert.equal(def.value, byName[key.value],
        'дефолт вызова расходится с пунктом настроек: dist:' + (i + 1) + ' ' + key.value);
    }
  });
  /* Сторож самого теста: молчаливый ноль сверок означал бы, что разбор
     перестал находить вызовы, а не что расхождений нет. */
  assert.ok(checked.length >= 8, 'сверено подозрительно мало вызовов: ' + checked.length);
  /* Task 62a (поправка ревью, М3): новые ключи перечислены наравне со
     старыми. Сейчас они читаются литералом и в сверку попадают сами, но
     стоит завтра записать чтение через переменную или конкатенацию — и они
     выпадут молча, ровно как выпадали ключи с PLUGIN + '…'. */
  for (const key of ['lumen_accent_auto', 'lumen_card_accent', 'lumen_card_progress',
    'lumen_badges', 'lumen_accent_scope', 'lumen_hero_logo',
    /* Правка 2026-09-23 (долг фазы 1, п.5): эти три читались через
       Lampa.Storage.field и в сверку не попадали вовсе. */
    'lumen_motion', 'lumen_trailer', 'lumen_menus',
    /* Ф3 п.11 (ревью фикс-раундов): ключи последней волны — тем же списком. */
    'lumen_posters', 'lumen_hero_media', 'lumen_card_logo',
    /* Волна 4: начало главной — читает план главной (src/47_homeplan.js). */
    'lumen_home_start',
    /* 1.0.2: слитые пункты и бывшие «консольные» выключатели — теперь в
       разделе, и их дефолт обязан совпадать с местом чтения. */
    'lumen_font', 'lumen_franchise', 'lumen_remote_boost', 'lumen_rowmem', 'lumen_rowmem_bytes',
    'lumen_netmem', 'lumen_prefill', 'lumen_fx']) {
    assert.ok(checked.indexOf(key) !== -1,
      'ключ, записанный не литералом, выпал из сверки: ' + key + ' (сверено: ' + checked.join(', ') + ')');
  }

  /* Чтения через Lampa.Storage.field сверять не нужно: field(name) — это
     Params.field(name), то есть Storage.get(name, defaults[name] + '')
     (app.min.js:48540-48542 и :47697-47699), и дефолт там из той таблицы,
     которую заполняет регистрация раздела.
     Правка 2026-09-23 (долг фазы 1, п.5): но для НАШИХ ключей механизм один —
     LC.pref с дефолтом пункта, и сторож ниже держит это правило: field в
     плагине читает только настройки самой Lampa (interface_size,
     screensaver, player_launch_trailers, card_interfice_reactions), у
     которых дефолт свой и в LIST их нет. */
  const fieldReads = [];
  const fre = /\.field\(\s*([^)]*?)\s*\)/g;
  let fm;
  while ((fm = fre.exec(dist))) fieldReads.push(fm[1]);
  assert.ok(fieldReads.length >= 4, 'чтений field подозрительно мало — разбор сломан: ' + fieldReads.join(', '));
  for (const arg of fieldReads) {
    const key = resolve(arg);
    assert.ok(key.ok && typeof key.value === 'string', 'ключ field не литерал — сверить нечем: ' + arg);
    assert.ok(!Object.prototype.hasOwnProperty.call(byName, key.value) && key.value.indexOf('lumen_') !== 0,
      'своя настройка читается мимо LC.pref: field(' + arg + ')');
  }
  assert.match(String(load('81_prefs.js').boolOf), /function/, 'модуль настроек загрузился');
});

/* Сверка 2026-09-26: описание «Быстрого листания» (1.0.2 — «Ускорителей
   пульта») обещало ускорение втрое,
   а код с Task 33 добавляет один шаг на каждое штатное событие (FAST_EXTRA
   = 1 в src/64_nav.js), то есть ×2. Кратность в описании — от той же
   константы, на всех трёх языках. */
test('сверка: «Ускорители пульта» — кратность листания в описании та же, что в коде (FAST_EXTRA)', () => {
  const nav = readFileSync(new URL('../src/64_nav.js', import.meta.url), 'utf8');
  const extra = /var FAST_EXTRA = (\d+);/.exec(nav);
  assert.ok(extra, 'FAST_EXTRA в src/64_nav.js не найдена');
  const factor = 1 + Number(extra[1]);
  const words = {
    2: { ru: /вдвое/, en: /twice as fast/, uk: /удвічі/ },
    3: { ru: /втрое/, en: /three times faster/, uk: /втричі/ }
  }[factor];
  assert.ok(words, 'кратность ×' + factor + ' тест не знает — допишите слова');
  const LC = loadStrings();
  for (const lang of LANGS) {
    const text = LC.STRINGS.lumen_remote_boost_descr[lang];
    assert.match(text, words[lang], lang + ': описание не называет ×' + factor + ': ' + text);
    assert.doesNotMatch(text, /втрое|three times|втричі/, lang + ': в описании осталось «втрое»');
  }
});

test('сверка: строка «Осталось N мин» на трёх языках с местом под число', () => {
  const LC = loadStrings();
  const s = LC.STRINGS.lumen_badge_left;
  assert.ok(s, 'строки lumen_badge_left нет');
  assert.equal(s.ru, 'Осталось {n} мин');
  assert.equal(s.en, '{n} min left');
  assert.equal(s.uk, 'Залишилось {n} хв');
});

test('1.0.2: «Франшизы» — один переключатель на кнопку и ряд, три языка', () => {
  const LC = loadStrings();
  const entry = prefs.find('lumen_franchise');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
  assert.deepEqual(LC.STRINGS.lumen_franchise_name, { ru: 'Франшизы', en: 'Franchises', uk: 'Франшизи' });
  /* Описание называет обе части — кнопку и ряд — их экранными именами. */
  const parts = {
    ru: [LC.STRINGS.lumen_card_franchise.ru, LC.STRINGS.lumen_fr_title.ru],
    en: [LC.STRINGS.lumen_card_franchise.en, LC.STRINGS.lumen_fr_title.en],
    uk: [LC.STRINGS.lumen_card_franchise.uk, LC.STRINGS.lumen_fr_title.uk]
  };
  for (const lang of LANGS) {
    for (const part of parts[lang]) assert.ok(LC.STRINGS.lumen_franchise_descr[lang].indexOf(part) !== -1, lang + ': нет «' + part + '»');
  }
});

test('решение 2026-09-26: подпись группы «Настроение» в хабе — три языка', () => {
  const LC = loadStrings();
  assert.deepEqual(LC.STRINGS.lumen_hub_moods, { ru: 'Настроение', en: 'Mood', uk: 'Настрій' });
});

test('решение 2026-09-26: вкладка подборок в поиске Lampa — три языка', () => {
  const LC = loadStrings();
  assert.deepEqual(LC.STRINGS.lumen_search_source, { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' });
});

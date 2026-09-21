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
  /* Правка 2026-09-16 (п.1): пункт «Показывать актёров» убран вместе с боковой
     колонкой — кружки инициалов дублировали ряд актёров, который Lampa рисует
     ниже. Остальной порядок экрана 09 не тронут. */
  const screen09 = ['lumen_enabled', 'lumen_card_accent', 'lumen_motion', 'lumen_slideshow',
    'lumen_slide_interval', 'lumen_trailer', 'lumen_reviews', 'lumen_kp_key'];
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
    'lumen_card_accent', 'lumen_card_fonts', 'lumen_card_progress',
    'lumen_font', /* Правка 2026-09-16 (п.6): выбор гарнитуры */
    'lumen_enabled', 'lumen_kp_key',
    'lumen_manifest_url', /* Task 14 (фаза 2): адрес каталога подборок */
    'lumen_menus', 'lumen_motion', 'lumen_reviews',
    'lumen_slide_interval', 'lumen_slideshow', 'lumen_torrents', 'lumen_trailer',
    /* Task 15 (фаза 2): ряды подборок на главной */
    'lumen_hide_watched', 'lumen_rows_limit',
    /* Task 57 (фаза 5): фильм не повторяется в рядах ниже */
    'lumen_rows_dedupe',
    /* Task 16 (фаза 2): персональные ряды */
    'lumen_personal_rows',
    /* Task 20 (фаза 2): состав рядов, чипы настроения, подсказка про ключ */
    'lumen_home_rows', 'lumen_moods', 'lumen_kp_hint',
    /* Фаза 3: тема, плотность подложек, масштаб интерфейса */
    'lumen_theme', 'lumen_solid', 'lumen_scale',
    /* Task 25 (фаза 3): метки на постерах рядов */
    'lumen_badges',
    /* Task 26 (фаза 3): пункты плагина в меню карточки по удержанию OK */
    'lumen_context_menu',
    /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами */
    'lumen_hero_size',
    /* Task 24 (фаза 3): акцент от постера открытого фильма */
    'lumen_accent_auto',
    /* Task 62a (фаза 5): область подкраски от постера */
    'lumen_accent_scope',
    /* Task 31 (фаза 4): HUD отладки на экране ТВ */
    'lumen_debug_hud',
    /* Task 29 (фаза 3): переход «постер → кадр» при открытии карточки */
    'lumen_transition',
    /* Task 27 (фаза 3): мини-карта рядов и быстрое листание */
    'lumen_minimap', 'lumen_fastscroll',
    /* Task 28 (фаза 3): режим показа отзывов и автотрейлер в кадре главной */
    'lumen_reviews_mode', 'lumen_hero_trailer',
    /* Task 21 (фаза 3): тематические атмосферы (слой частиц) */
    'lumen_fx',
    /* Task 40 (фаза 4): тумблер тяжёлых эффектов */
    'lumen_fx_heavy',
    /* Task 22 (фаза 3): заставка из кадров после покоя пульта */
    'lumen_ambient', 'lumen_ambient_source', 'lumen_ambient_delay',
    /* Task 23 (фаза 3): фильтр, с которым открывается рулетка */
    'lumen_roulette_unseen'
  ].sort());
});

/* Фаза 3: тема, плотность и масштаб — в группе «Оформление», сразу за
   акцентом: это всё про вид, и на пульте их ищут рядом. */
test('фаза 3: тема, плотность подложек и масштаб — сразу за акцентом, до шрифтов', () => {
  const at = names.indexOf('lumen_card_accent');
  assert.ok(at > 0, 'пункта акцента нет в списке');
  /* Task 24 (фаза 3): «Акцент от постера» вклинивается сразу за выбором
     акцента — это тот же выбор, только его делает фильм. */
  assert.equal(names[at + 1], 'lumen_accent_auto');
  /* Task 62a (фаза 5): область подкраски — сразу за самой подкраской: пункт
     отвечает на второй вопрос про неё же («докуда доходит цвет постера»). */
  assert.equal(names[at + 2], 'lumen_accent_scope');
  assert.deepEqual(names.slice(at + 3, at + 6), ['lumen_theme', 'lumen_solid', 'lumen_scale']);
  assert.equal(names[at + 6], 'lumen_card_fonts', 'выключатель шрифтов остаётся следующим');
});

test('фаза 3: значения по умолчанию сохраняют прежний вид', () => {
  assert.deepEqual(['select', 'warm'], [prefs.find('lumen_theme').type, prefs.find('lumen_theme')['default']]);
  assert.deepEqual(['trigger', false], [prefs.find('lumen_solid').type, prefs.find('lumen_solid')['default']]);
  assert.deepEqual(['select', 'normal'], [prefs.find('lumen_scale').type, prefs.find('lumen_scale')['default']]);
  assert.ok(prefs.find('lumen_theme').descr, 'у темы обязана быть подсказка про OLED');
  assert.ok(prefs.find('lumen_solid').descr, 'у плотных подложек обязана быть подсказка, когда включать');
  assert.ok(prefs.find('lumen_scale').descr);
});

test('фаза 3: масштаб — четыре ступени от «мельче» до «ещё крупнее»', () => {
  assert.deepEqual(prefs.find('lumen_scale').values, ['small', 'normal', 'large', 'huge']);
  assert.equal(prefs.find('lumen_scale').vprefix, 'lumen_scale_');
});

/* Task 30 (финал фазы 3; Task 31 фазы 4 и Task 57 фазы 5 добавили ещё по
   одному): пунктов сейчас 40, и раскладка по группам — единственное, что
   делает их обозримыми с дивана. Группа отвечает на вопрос «про что это»:
   вид · движение · фон карточки · блоки карточки · главная · ряды подборок ·
   пульт · рулетка · заставка · путь до плеера.

   Тест закрепляет и состав групп, и их порядок: перестановка пункта из
   группы в группу — решение, а не побочный эффект правки соседней строки. */
const GROUPS = [
  ['lumen_group_look', [
    /* Task 24: «Акцент от постера» — сразу за выбором акцента: тот же
       выбор, только его делает фильм. */
    'lumen_card_accent', 'lumen_accent_auto',
    /* Task 62a (фаза 5): область подкраски от постера. */
    'lumen_accent_scope',
    'lumen_theme', 'lumen_solid', 'lumen_scale',
    'lumen_card_fonts', 'lumen_font'
  ]],
  /* Task 30: движение вынесено из «Оформления» в свою группу. Переход и
     атмосферы живут только при полных анимациях, и рядом с режимом анимаций
     это видно сразу. Task 31 (фаза 4) добавил HUD отладки — этой зависимости
     он не подчиняется (работает при любом режиме анимаций), но место рядом с
     режимом анимаций логично и для него: сам HUD и калибрует его пороги. */
  ['lumen_group_motion', ['lumen_motion', 'lumen_fx_heavy', 'lumen_debug_hud', 'lumen_transition', 'lumen_fx']],
  ['lumen_group_backdrop', ['lumen_slideshow', 'lumen_slide_interval', 'lumen_trailer']],
  ['lumen_group_blocks', [
    'lumen_card_progress', 'lumen_reviews', 'lumen_reviews_mode', 'lumen_kp_key', 'lumen_kp_hint'
  ]],
  ['lumen_group_home', [
    /* Правка пользователя 2026-09-17 (п.2): размер кадра — первым пунктом:
       от него зависит, сколько экрана достанется всему остальному. */
    'lumen_hero_size', 'lumen_hero_trailer', 'lumen_moods', 'lumen_personal_rows'
  ]],
  /* Task 57 (фаза 5): ряды подборок отделены от «Главной» — с настройкой
     дедупликации прежняя группа выросла бы до десяти строк. */
  ['lumen_group_rows', [
    'lumen_home_rows', 'lumen_rows_limit', 'lumen_rows_dedupe', 'lumen_badges', 'lumen_hide_watched',
    /* Каталог — последним: настройка «на один раз», и она про источник всех
       подборок разом. */
    'lumen_manifest_url'
  ]],
  /* Task 30: всё, что меняет поведение ПУЛЬТА, — одной группой. Раньше эти
     три пункта стояли в «Главной», хотя работают и в сетках подборок. */
  ['lumen_group_nav', ['lumen_context_menu', 'lumen_minimap', 'lumen_fastscroll']],
  /* Task 30: у рулетки в разделе один пункт, но без заголовка неясно, к
     какому экрану он относится, — сама рулетка открывается из левого меню. */
  ['lumen_group_roulette', ['lumen_roulette_unseen']],
  ['lumen_group_ambient', ['lumen_ambient', 'lumen_ambient_source', 'lumen_ambient_delay']],
  ['lumen_group_path', ['lumen_menus', 'lumen_torrents']]
];

test('Task 30: раздел разложен по группам — состав и порядок', () => {
  const groups = [];
  let current = null;
  for (const e of LIST.slice(1)) {
    if (e.type === 'title') {
      current = [e.name, []];
      groups.push(current);
      continue;
    }
    assert.ok(current, 'пункт вне группы: ' + e.name);
    current[1].push(e.name);
  }
  assert.deepEqual(groups, GROUPS);
});

test('Task 30: у каждой группы есть пункты, и ни одна не длиннее девяти строк', () => {
  for (const [title, items] of GROUPS) {
    assert.ok(items.length >= 1, 'пустая группа: ' + title);
    /* Девять — столько строк раздела помещается на экране ТВ без прокрутки
       (та же величина, что у мини-карты рядов, src/64_nav.js). Группа
       длиннее превращается в сплошной список, ради которого группы и
       заводились. */
    assert.ok(items.length <= 9, 'группа слишком длинная: ' + title + ' (' + items.length + ')');
  }
});

test('Task 30: у каждого пункта раздела есть и название, и описание', () => {
  for (const e of LIST) {
    assert.ok(e.label, 'нет подписи: ' + e.name);
    if (e.type === 'title') continue;
    /* Человек смотрит на раздел с дивана и с пультом: название говорит,
       что это, описание — что случится и когда. */
    assert.ok(e.descr, 'нет описания: ' + e.name);
  }
});

test('Task 20: подсказка про ключ — переключатель сразу за полем ключа', () => {
  const names = LIST.map((e) => e.name);
  assert.equal(names[names.indexOf('lumen_kp_key') + 1], 'lumen_kp_hint');
  const entry = prefs.find('lumen_kp_hint');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true, 'по умолчанию подсказка показывается');
  assert.ok(entry.descr, 'у переключателя обязана быть подсказка — как вернуть скрытое');
});

test('Task 20: «Какие ряды показывать» — кнопка-параметр без значения', () => {
  const entry = prefs.find('lumen_home_rows');
  assert.equal(entry.type, 'button', 'multi-select в SettingsApi нет — это кнопка на экран выбора');
  assert.equal(typeof entry['default'], 'undefined', 'кнопка ничего не хранит');
  assert.ok(entry.label && entry.descr);
});

/* Task 35 (фаза 4): «Акцент от постера» включён по умолчанию. На телевизоре
   это единственная видимая связь подложки рядов с кадром, а выключенной
   настройку просто не находят; цена смены цвета при этом снижена до одного
   маленького <style id="lumen-accent"> (src/57_color.js). */
test('Task 35: акцент от постера включён по умолчанию', () => {
  const entry = prefs.find('lumen_accent_auto');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
});

test('Task 20: профили настроения — переключатель, по умолчанию включён', () => {
  const entry = prefs.find('lumen_moods');
  assert.equal(entry.type, 'trigger');
  assert.equal(entry['default'], true);
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
  assert.deepEqual(def.lumen_font, ['select', 'golos']);
  assert.deepEqual(def.lumen_reviews, ['trigger', true]);
  assert.deepEqual(def.lumen_kp_key, ['input', '']);
  assert.deepEqual(def.lumen_menus, ['select', 'all']);
  assert.deepEqual(def.lumen_torrents, ['trigger', true]);
});

/* Выбор гарнитуры стоит сразу за выключателем «Фирменные шрифты» — при
   выключенных шрифтах он не действует, и рядом это очевиднее всего. Пять
   гарнитур, все с Google Fonts (CSP плагина разрешает только его).
   Task 43: за каждым ключом стоит одна гарнитура, прежде была пара
   «текстовая + моноширинная»; сами ключи не менялись — они уже записаны в
   Storage у тех, кто менял шрифт. */
test('настройка «Шрифт»: select из пяти гарнитур, сразу после lumen_card_fonts', () => {
  const at = names.indexOf('lumen_font');
  assert.ok(at > 0, 'пункта lumen_font нет в списке');
  assert.equal(names[at - 1], 'lumen_card_fonts', 'выбор шрифта должен стоять сразу за выключателем шрифтов');

  const entry = prefs.find('lumen_font');
  assert.equal(entry.type, 'select');
  assert.deepEqual(entry.values, ['golos', 'onest', 'manrope', 'inter', 'plex']);
  assert.ok(entry.values.length <= 5, 'не больше пяти вариантов');
  assert.equal(entry.vprefix, 'lumen_card_font_');
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
/* Task 61 (фаза 5): автотрейлер в кадре главной — обнаружимость.         */
/*                                                                        */
/* Жалоба пользователя (интервью 2026-09-21): «Трейлер в герое через 8 с —  */
/* заебись, но надо отключаемым в настройках». Настройка есть с Task 28,   */
/* значит её не нашли. В разделе ДВА пункта со словом «трейлер»:           */
/* lumen_trailer (фон карточки фильма, группа «Фон карточки») и            */
/* lumen_hero_trailer (кадр главной, группа «Главная»); первый по списку   */
/* идёт раньше, и человек, дойдя до него, дальше не ищет.                  */
/* ====================================================================== */

test('Task 61: два пункта про трейлер названы по-разному и каждый называет своё место', () => {
  const LC = loadStrings();
  const hero = LC.STRINGS[prefs.find('lumen_hero_trailer').label];
  const card = LC.STRINGS[prefs.find('lumen_trailer').label];
  for (const lang of LANGS) {
    assert.notEqual(hero[lang], card[lang], 'названия совпадают в ' + lang);
    /* Ни одно название не должно быть префиксом другого: на экране ТВ
       «Трейлер в фоне» и «Трейлер в фоне карточки» с трёх метров читаются
       как один и тот же пункт. */
    assert.ok(hero[lang].indexOf(card[lang]) === -1 && card[lang].indexOf(hero[lang]) === -1,
      'одно название содержит другое целиком в ' + lang + ': ' + hero[lang] + ' / ' + card[lang]);
  }
  /* Название говорит, что он запускается САМ: это и есть то, что человек
     хочет выключить, — не «трейлер», а «трейлер без спроса». */
  assert.ok(/^Автотрейлер/.test(hero.ru), 'ru: ' + hero.ru);
  assert.ok(/^Auto-trailer/.test(hero.en), 'en: ' + hero.en);
  assert.ok(/^Автотрейлер/.test(hero.uk), 'uk: ' + hero.uk);
});

test('Task 61: описание автотрейлера называет ту же задержку, что стоит в коде героя', () => {
  const LC = loadStrings();
  const hero = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const m = /var TRAILER_DELAY = (\d+);/.exec(hero);
  assert.ok(m, 'в src/48_hero.js не нашлась константа TRAILER_DELAY');
  const seconds = String(parseInt(m[1], 10) / 1000);

  const descr = LC.STRINGS[prefs.find('lumen_hero_trailer').descr];
  for (const lang of LANGS) {
    /* Число в описании — единственное, по чему человек узнаёт свой случай
       («через 8 секунд сам включается»). Разойдётся с кодом — описание
       станет ложным. */
    assert.ok(new RegExp('(^|[^\\d])' + seconds + '([^\\d]|$)').test(descr[lang]),
      'в описании (' + lang + ') нет задержки ' + seconds + ' с: ' + descr[lang]);
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
  globalThis.window = { Lampa };
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

/* Пункт читается ровно одной функцией — иначе дефолт вызова и дефолт
   пункта однажды разойдутся (ровно так молчала подкраска с Task 35 по
   Task 60, см. сверку в самом низу файла). */
test('Task 62a: LC.badgesMode читает настройку с тем же дефолтом, что стоит в LIST', () => {
  assert.equal(withPrefs({ store: {} }, (LC) => LC.badgesMode()), prefs.find('lumen_badges')['default']);
  assert.equal(withPrefs({ store: { lumen_badges: 'true' } }, (LC) => LC.badgesMode()), 'poster');
  assert.equal(withPrefs({ store: { lumen_badges: 'false' } }, (LC) => LC.badgesMode()), 'off');
  assert.equal(withPrefs({ store: { lumen_badges: 'caption' } }, (LC) => LC.badgesMode()), 'caption');
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
     комментарии (scripts/build.mjs), сохраняя нумерацию строк и маркеры
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
  for (const key of ['lumen_accent_auto', 'lumen_card_accent', 'lumen_card_fonts', 'lumen_card_progress']) {
    assert.ok(checked.indexOf(key) !== -1,
      'ключ, записанный не литералом, выпал из сверки: ' + key + ' (сверено: ' + checked.join(', ') + ')');
  }

  /* Чтения через Lampa.Storage.field сверять не нужно, и это не пробел, а
     свойство самой Lampa: field(name) — это Params.field(name), то есть
     Storage.get(name, defaults[name] + '') (app.min.js:48540-48542 и
     :47697-47699). Дефолт там берётся из ТОЙ ЖЕ таблицы, которую заполняет
     регистрация раздела, поэтому разойтись с пунктом он не может по
     построению — в отличие от LC.pref, где дефолт передаёт вызывающий. */
  assert.match(String(load('81_prefs.js').boolOf), /function/, 'модуль настроек загрузился');
});

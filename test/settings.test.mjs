import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 10: регистрация раздела «Lumen Card» в Lampa.SettingsApi — полный
   список пунктов экрана 09, русские подписи и описания, значения по
   умолчанию, и главное — ОДНА точка применения на настройку.

   Чистая таблица пунктов (порядок/типы/дефолты) проверяется в
   test/prefs.test.mjs; здесь — то, что видит Lampa: addComponent/addParam,
   собранные values, и связка Storage 'change' <-> onChange параметра.

   80_settings.js + 81_prefs.js грузятся в один LC (как в бандле). Применение
   настроек (LC.apply*Pref) подменено журналом — сами функции живут в
   90_runtime.js и проверяются в test/menus_runtime.test.mjs. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

/* Lampa.Storage у вендора: Storage.set сначала шлёт listener 'change' всем
   подписчикам (ОДИН общий try/catch на весь цикл — app.min.js Subscribe.send),
   и только потом настройки зовут onChange параметра. Мок повторяет и порядок,
   и общий try/catch: на нём проверяется долг ревью Task 9 (чужой подписчик
   бросил исключение — наш до события не дошёл). */
function setup(opts) {
  opts = opts || {};
  const log = [];
  const storage = Object.assign({}, opts.storage || {});
  const subscribers = [];
  const params = [];
  const components = [];

  const Storage = {
    get: (name, def) => (name in storage ? storage[name] : def),
    field: (name) => storage[name],
    set: function (name, value) {
      storage[name] = value;
      /* Subscribe.send вендора: весь цикл подписчиков в одном try/catch —
         исключение любого из них обрывает рассылку остальным. */
      try {
        for (let i = 0; i < subscribers.length; i++) subscribers[i]({ name: name, value: value });
      } catch (e) { /* как у вендора: молча */ }
      /* Настройки Lampa после записи зовут onChange самого параметра. */
      const p = params.filter((x) => x.param.name === name)[0];
      if (p && typeof p.onChange === 'function') p.onChange(value);
    },
    listener: opts.noStorageListener ? undefined : {
      follow: (name, cb) => { if (name === 'change') subscribers.push(cb); }
    }
  };

  const Lampa = {
    Storage: Storage,
    Lang: { add: () => { }, translate: (k) => k },
    SettingsApi: {
      addComponent: (c) => components.push(c),
      addParam: (p) => params.push(p)
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa };

  const LC = {};
  loadInto(LC, '80_settings.js');
  loadInto(LC, '81_prefs.js');

  /* Точки применения — журнал вместо 90_runtime.js. */
  const mark = (name) => () => log.push(name);
  LC.injectCss = mark('css');
  LC.injectFonts = mark('fonts');
  LC.applyEnabledPref = mark('enabled');
  LC.applyMotionMode = mark('motion');
  LC.applySlideshowPref = mark('slideshow');
  LC.applyMenusPref = mark('menus');
  LC.applyTorrentsPref = mark('torrents');
  LC.applyTrailerPref = mark('trailer');
  LC.applyProgressPref = mark('progress');
  LC.applyReviewsPref = mark('reviews');
  /* Task 15/16/19/20 (фаза 2): точки применения главной и подборок. */
  LC.applyRowsPref = mark('rows');
  LC.applyPersonalPref = mark('personal');
  LC.applyMoodsPref = mark('moods');
  LC.applyKpHintPref = mark('kphint');
  /* Task 25 (фаза 3): метки на постерах — ставятся и снимаются на живом
     экране, пересборка активности им не нужна. */
  LC.applyBadgesPref = mark('badges');
  LC.applyCardmenuPref = mark('cardmenu');
  LC.applyNavPref = mark('nav');
  /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами. */
  LC.applyHeroSizePref = mark('herosize');
  /* Task 24 (фаза 3): акцент от постера — пересобирает CSS сам. */
  LC.applyAccentPref = mark('accent');

  return { LC, log, storage, params, components, subscribers, Storage, prependSubscriber: (cb) => subscribers.unshift(cb) };
}

function paramOf(params, name) {
  return params.filter((p) => p.param.name === name)[0];
}

/* ====================================================================== */
/* Список пунктов: экран 09, русские подписи через LC.STRINGS.             */
/* ====================================================================== */

test('addSettings: раздел зарегистрирован один раз, с именем и иконкой', () => {
  const { LC, components } = setup();
  LC.addSettings();
  assert.equal(components.length, 1);
  assert.equal(components[0].component, 'lumen_card');
  assert.equal(components[0].name, 'Lumen Card');
  assert.ok(components[0].icon.indexOf('<svg') === 0, 'иконка раздела — svg');
});

/* Ревью фазы 1, второй круг (Minor 4): у LC.addSettings свой гард, как у
   LC.followStorage. Снаружи его прикрывает inited в LC.init, но полагаться на
   единственную внешнюю защиту нельзя — повторная регистрация продублировала бы
   весь раздел в настройках Lampa. */
test('Minor 4: повторный LC.addSettings не регистрирует раздел и пункты второй раз', () => {
  const { LC, params, components } = setup();
  LC.addSettings();
  const first = params.length;
  assert.ok(first > 0, 'первый вызов зарегистрировал пункты');

  LC.addSettings();

  assert.equal(components.length, 1, 'раздел зарегистрирован один раз');
  assert.equal(params.length, first, 'пункты раздела не продублированы');
});

test('addSettings: порядок и типы параметров — как в таблице LC.prefs.LIST (экран 09)', () => {
  const { LC, params } = setup();
  LC.addSettings();
  assert.deepEqual(params.map((p) => p.param.name), LC.prefs.LIST.map((e) => e.name));
  assert.deepEqual(params.map((p) => p.param.type), LC.prefs.LIST.map((e) => e.type));
  for (const p of params) assert.equal(p.component, 'lumen_card');
});

test('addSettings: подписи и описания по-русски, значения select переведены', () => {
  const { LC, params } = setup();
  LC.addSettings();

  assert.equal(paramOf(params, 'lumen_enabled').field.name, 'Включить Lumen Card');
  assert.ok(paramOf(params, 'lumen_enabled').field.description.indexOf('штатн') !== -1,
    'подсказка обязана сказать, что вернётся штатная карточка Lampa');
  assert.equal(paramOf(params, 'lumen_card_accent').field.name, 'Акцентный цвет');
  assert.equal(paramOf(params, 'lumen_font').field.name, 'Шрифт');
  assert.equal(paramOf(params, 'lumen_reviews').field.name, 'Отзывы Кинопоиска');
  assert.equal(paramOf(params, 'lumen_kp_key').field.name, 'Ключ Kinopoisk API');

  /* Фаза 3: девять акцентов — четыре из экспорта дизайна и пять новых. */
  assert.deepEqual(paramOf(params, 'lumen_card_accent').param.values,
    { sand: 'Песок', copper: 'Медь', wine: 'Вино', garnet: 'Гранат', mint: 'Мята',
      emerald: 'Изумруд', ice: 'Лёд', lavender: 'Лаванда', graphite: 'Графит' });
  assert.deepEqual(paramOf(params, 'lumen_theme').param.values,
    { warm: 'Тёплая тёмная', black: 'Глубокая чёрная' });
  assert.deepEqual(paramOf(params, 'lumen_scale').param.values,
    { small: 'Мельче', normal: 'Обычный', large: 'Крупнее', huge: 'Ещё крупнее' });
  assert.equal(paramOf(params, 'lumen_solid').field.name, 'Плотные подложки');
  assert.deepEqual(paramOf(params, 'lumen_motion').param.values,
    { auto: 'Авто', full: 'Полные', lite: 'Лёгкие', off: 'Выкл' });
  assert.deepEqual(paramOf(params, 'lumen_slide_interval').param.values,
    { '8': '8 с', '14': '14 с', '20': '20 с' });
  assert.deepEqual(paramOf(params, 'lumen_trailer').param.values,
    { auto: 'Авто', on: 'Вкл', off: 'Выкл' });
  assert.deepEqual(paramOf(params, 'lumen_menus').param.values,
    { all: 'Все меню и окна', path: 'Только путь до плеера', off: 'Выкл' });
  /* Правка 2026-09-16 (п.6): имена гарнитур — собственные, во всех трёх
     языках пишутся одинаково, но идут через LC.STRINGS, как все строки. */
  assert.deepEqual(paramOf(params, 'lumen_font').param.values,
    { golos: 'Golos Text', onest: 'Onest', manrope: 'Manrope', inter: 'Inter', plex: 'IBM Plex Sans' });
});

test('addSettings: заголовки групп — параметры type "title" без onChange и без значения', () => {
  const { LC, params } = setup();
  LC.addSettings();
  const titles = params.filter((p) => p.param.type === 'title');
  assert.ok(titles.length >= 3);
  for (const t of titles) {
    assert.equal(typeof t.onChange, 'undefined', 'у заголовка группы нет обработчика');
    assert.equal(typeof t.param['default'], 'undefined', 'заголовок группы ничего не хранит');
    assert.ok(/^[А-ЯЁ]/.test(t.field.name), 'заголовок группы по-русски: ' + t.field.name);
  }
});

test('addSettings: значения по умолчанию доезжают до Lampa без изменений', () => {
  const { LC, params } = setup();
  LC.addSettings();
  for (const e of LC.prefs.LIST) {
    if (e.type === 'title') continue;
    assert.equal(paramOf(params, e.name).param['default'], e['default'], e.name);
  }
});

/* ====================================================================== */
/* Одна точка применения на настройку.                                    */
/* ====================================================================== */

/* Долг ревью Task 9 (п.2): раньше проверялись 4 имени из 7 — теперь все
   настройки раздела разом. Каждая обязана примениться РОВНО один раз на
   Storage.set (listener 'change' + onChange параметра вместе). */
test('каждая настройка применяется ровно один раз на Storage.set', () => {
  const expected = {
    lumen_enabled: ['enabled'],
    lumen_card_accent: ['css'],
    lumen_card_fonts: ['fonts', 'css'],
    lumen_motion: ['motion'],
    lumen_slideshow: ['slideshow'],
    lumen_slide_interval: ['slideshow'],
    lumen_trailer: ['trailer'],
    lumen_card_progress: ['progress'],
    /* Правка 2026-09-16 (п.6): смена гарнитуры — подмена <link> шрифтов плюс
       пересборка CSS (стеки font-family зашиты в текст стилей). */
    lumen_font: ['fonts', 'css'],
    lumen_reviews: ['reviews'],
    lumen_kp_key: ['reviews'],
    lumen_menus: ['menus'],
    lumen_torrents: ['torrents'],
    /* Task 20: подсказка про ключ — перерисовка ряда отзывов карточки плюс
       сетки подборки (applyKpHintPref). */
    lumen_kp_hint: ['reviews', 'kphint'],
    /* Task 14/20 (фаза 2): адрес каталога — сброс кэша и перезагрузка каталога. */
    lumen_manifest_url: ['rows'],
    /* Task 15/20 (фаза 2): состав, число и фильтр рядов главной — один путь. */
    lumen_hide_watched: ['rows'],
    lumen_rows_limit: ['rows'],
    lumen_home_rows: ['rows'],
    /* Task 19/20 (фаза 2): чипы настроения монтируются и снимаются на лету. */
    lumen_moods: ['moods'],
    /* Task 16 (фаза 2): персональные ряды. */
    lumen_personal_rows: ['personal'],
    /* Task 25 (фаза 3): метки на постерах — узлы внутри уже нарисованных
       карточек, снимаются и ставятся на живом экране без его пересборки. */
    lumen_badges: ['badges'],
    /* Task 26 (фаза 3): пункты в меню карточки — две подписки, ставятся и
       снимаются на лету; экран перерисовывать не нужно. */
    lumen_context_menu: ['cardmenu'],
    /* Task 27 (фаза 3): мини-карта и быстрое листание — одни и те же две
       подписки на клавиатуру Lampa, поэтому точка применения общая. */
    lumen_minimap: ['nav'],
    lumen_fastscroll: ['nav'],
    /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами —
       пересборка CSS и жизнь узла героя одной точкой. */
    lumen_hero_size: ['herosize'],
    /* Фаза 3: тема, плотность подложек и масштаб живут целиком в таблице
       стилей — одной пересборки CSS достаточно, экран пересобирать не нужно. */
    lumen_theme: ['css'],
    lumen_solid: ['css'],
    lumen_scale: ['css'],
    /* Task 24 (фаза 3): акцент от постера — своя точка применения: при
       выключении возвращает цвет настроек, при включении считает по фильму
       открытой карточки (пересборку CSS делает она сама). */
    lumen_accent_auto: ['accent'],
    /* Task 29 (фаза 3): переход «постер → кадр» читается в момент открытия
       карточки — на живом экране применять нечего, поэтому список пуст, но
       ветка у настройки своя (иначе имя ушло бы дальше как чужое). */
    lumen_transition: []
  };
  const { LC, log, Storage, params } = setup();
  LC.addSettings();
  LC.followStorage();

  for (const name of Object.keys(expected)) {
    log.length = 0;
    Storage.set(name, paramOf(params, name).param['default']);
    assert.deepEqual(log, expected[name], name + ': применение должно быть ровно одно');
  }
  /* Ни одна настройка раздела не осталась без своей ветки. */
  const covered = Object.keys(expected).sort();
  const all = LC.prefs.LIST.filter((e) => e.type !== 'title').map((e) => e.name).sort();
  assert.deepEqual(covered, all, 'в проверке должны быть все пункты раздела');
});

/* Долг ревью Task 9 (п.1). Subscribe.send вендора оборачивает ВЕСЬ цикл
   подписчиков в один try/catch: если чужой подписчик на Storage 'change'
   бросит исключение раньше нашего, LC.followStorage события не получит.
   Прежняя проверка «LC.storageFollowed не выставлен» тут молчала, и
   настройка применялась только после перезахода в Lampa. */
test('чужой подписчик на Storage бросил исключение — настройка всё равно применяется (через onChange)', () => {
  const env = setup();
  env.LC.addSettings();
  env.LC.followStorage();
  env.prependSubscriber(() => { throw new Error('чужой плагин упал'); });

  env.log.length = 0;
  env.Storage.set('lumen_card_accent', 'ice');
  assert.deepEqual(env.log, ['css'], 'onChange обязан подхватить настройку');

  env.log.length = 0;
  env.Storage.set('lumen_menus', 'path');
  assert.deepEqual(env.log, ['menus']);
});

test('без подписки на Storage (у сборки нет listener) onChange остаётся рабочим путём', () => {
  const { LC, log, Storage } = setup({ noStorageListener: true });
  LC.addSettings();
  LC.followStorage();
  log.length = 0;
  Storage.set('lumen_card_accent', 'wine');
  Storage.set('lumen_torrents', 'false');
  assert.deepEqual(log, ['css', 'torrents']);
});

/* Метка «событие уже обработано» обязана сбрасываться: иначе следующая
   запись ТОГО ЖЕ параметра прошла бы мимо onChange, если подписка отвалится. */
test('метка обработанного события не залипает между записями', () => {
  const { LC, log, Storage } = setup();
  LC.addSettings();
  LC.followStorage();
  log.length = 0;
  Storage.set('lumen_card_accent', 'ice');
  Storage.set('lumen_card_accent', 'mint');
  Storage.set('lumen_card_accent', 'sand');
  assert.deepEqual(log, ['css', 'css', 'css'], 'каждая запись — ровно одно применение');
});

test('чужой ключ Storage не трогает плагин', () => {
  const { LC, log, Storage } = setup();
  LC.addSettings();
  LC.followStorage();
  log.length = 0;
  Storage.set('language', 'en');
  Storage.set('player_normalization', 'true');
  assert.deepEqual(log, []);
});

/* Ключи без префикса lumen_card_ (план: их ловят отдельные ветки) не должны
   утекать в общую ветку «пересобрать CSS». */
test('lumen_card_* без своей ветки пересобирает CSS, прочие ключи lumen_* — нет', () => {
  const { LC, log, Storage } = setup();
  LC.addSettings();
  LC.followStorage();
  log.length = 0;
  Storage.set('lumen_card_unknown_future', '1');
  assert.deepEqual(log, ['css'], 'новая настройка карточки по умолчанию пересобирает CSS');
});

/* ====================================================================== */
/* Task 20: экран выбора рядов подборок (кнопка-параметр lumen_home_rows). */
/*                                                                        */
/* Multi-select в SettingsApi нет: пункт — параметр type:'button', Lampa   */
/* зовёт его onChange по нажатию, а выбор идёт на Lampa.Select с           */
/* чекбоксами. Чекбокс селектбокс не закрывает, поэтому запись в Storage   */
/* обязана идти на каждом onCheck.                                        */
/* ====================================================================== */

const CATALOG = {
  version: 1,
  groups: [{ id: 'franchise', title: 'Франшизы' }, { id: 'theme', title: 'Темы' }],
  collections: [
    { id: 'star-wars', title: 'Звёздные войны', group: 'franchise', sources: { movie: { type: 'collection', id: 10 } } },
    { id: 'comedy', title: 'Комедии', group: 'theme', sources: { movie: { type: 'discover', params: {} } } },
    { id: 'horror', title: 'Ужасы', group: 'theme', sources: { movie: { type: 'discover', params: {} } } }
  ],
  home: ['comedy']
};

function setupHomeRows(storage) {
  const env = setup({ storage: storage || {} });
  loadInto(env.LC, '10_util.js');
  loadInto(env.LC, '44_rows.js');
  env.LC.manifest = { get: () => CATALOG };
  const shown = [];
  globalThis.Lampa.Select = { show: (o) => shown.push(o) };
  globalThis.Lampa.Controller = { toggle: () => { } };
  env.LC.addSettings();
  env.LC.followStorage();
  return Object.assign({ shown }, env);
}

function pressHomeRows(env) {
  const param = env.params.filter((p) => p.param.name === 'lumen_home_rows')[0];
  assert.ok(param, 'пункт lumen_home_rows не зарегистрирован');
  assert.equal(param.param.type, 'button');
  param.onChange();
  assert.equal(env.shown.length, 1, 'нажатие обязано открыть экран выбора');
  return env.shown[0];
}

test('Task 20: нажатие кнопки открывает Lampa.Select — отмечен набор каталога, группы подписаны', () => {
  const env = setupHomeRows();
  const box = pressHomeRows(env);

  assert.equal(box.title, 'Ряды подборок на главной');
  const checks = box.items.filter((i) => i.checkbox);
  assert.deepEqual(checks.map((i) => i.lumen_id), ['comedy', 'star-wars', 'horror'],
    'отмеченные идут первыми, остальные — в порядке каталога');
  assert.deepEqual(checks.map((i) => i.checked), [true, false, false],
    'по умолчанию отмечен manifest.home');
  assert.deepEqual(box.items.filter((i) => i.separator).map((i) => i.title), ['Франшизы', 'Темы']);
});

test('Task 20: галочка сохраняется сразу и применяется через ту же ветку, что лимит рядов', () => {
  const env = setupHomeRows();
  const box = pressHomeRows(env);
  env.log.length = 0;

  const horror = box.items.filter((i) => i.lumen_id === 'horror')[0];
  horror.checked = true;           /* Lampa переключает поле сама, потом зовёт onCheck */
  box.onCheck(horror);

  assert.equal(env.storage.lumen_home_rows, 'comedy,horror');
  assert.deepEqual(env.log, ['rows'], 'ряды перерегистрируются немедленно');
});

test('Task 20: сохранённый состав приходит на экран отмеченным и в своём порядке', () => {
  const env = setupHomeRows({ lumen_home_rows: 'horror,star-wars' });
  const box = pressHomeRows(env);
  const checks = box.items.filter((i) => i.checkbox);
  assert.deepEqual(checks.map((i) => i.lumen_id), ['horror', 'star-wars', 'comedy']);
  assert.deepEqual(checks.map((i) => i.checked), [true, true, false]);
});

test('Task 20: снятая последняя галочка возвращает набор каталога (пустая главная не сохраняется)', () => {
  const env = setupHomeRows({ lumen_home_rows: 'comedy' });
  const box = pressHomeRows(env);
  const comedy = box.items.filter((i) => i.lumen_id === 'comedy')[0];
  comedy.checked = false;
  box.onCheck(comedy);
  assert.equal(env.storage.lumen_home_rows, '', 'пустая строка = набор по умолчанию');
});

test('Task 20: без Lampa.Select нажатие ничего не ломает', () => {
  const env = setupHomeRows();
  delete globalThis.Lampa.Select;
  const param = env.params.filter((p) => p.param.name === 'lumen_home_rows')[0];
  param.onChange();
  assert.equal(env.shown.length, 0);
});

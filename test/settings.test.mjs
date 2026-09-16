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
  LC.applyCastPref = mark('cast');
  LC.applyReviewsPref = mark('reviews');

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
  assert.equal(paramOf(params, 'lumen_card_cast').field.name, 'Показывать актёров');
  assert.equal(paramOf(params, 'lumen_reviews').field.name, 'Отзывы Кинопоиска');
  assert.equal(paramOf(params, 'lumen_kp_key').field.name, 'Ключ Kinopoisk API');

  assert.deepEqual(paramOf(params, 'lumen_card_accent').param.values,
    { sand: 'Песок', ice: 'Лёд', wine: 'Вино', mint: 'Мята' });
  assert.deepEqual(paramOf(params, 'lumen_motion').param.values,
    { auto: 'Авто', full: 'Полные', lite: 'Лёгкие', off: 'Выкл' });
  assert.deepEqual(paramOf(params, 'lumen_slide_interval').param.values,
    { '8': '8 с', '14': '14 с', '20': '20 с' });
  assert.deepEqual(paramOf(params, 'lumen_trailer').param.values,
    { auto: 'Авто', on: 'Вкл', off: 'Выкл' });
  assert.deepEqual(paramOf(params, 'lumen_menus').param.values,
    { all: 'Все меню и окна', path: 'Только путь до плеера', off: 'Выкл' });
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
    lumen_card_cast: ['cast'],
    lumen_reviews: ['reviews'],
    lumen_kp_key: ['reviews'],
    lumen_menus: ['menus'],
    lumen_torrents: ['torrents']
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

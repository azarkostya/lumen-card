import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 31 (ревью, Minor 7): связка маркеров меню с рантаймом —
   флаг «плагин активен» (LC.applyMenusPref/LC.applyTorrentsPref ничего не
   делают, пока LC.init не дошёл до оформления), порядок mode -> install в
   init и ветки LC.followStorage для lumen_menus/lumen_torrents.
   80_settings.js и 90_runtime.js грузятся в один LC (как в бандле);
   LC.menus/LC.template/LC.injectCss — фейки с журналом вызовов. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

function setup(opts) {
  opts = opts || {};
  const log = [];
  const storage = Object.assign({ lumen_menus: 'all', lumen_torrents: 'true' }, opts.storage || {});
  const storageCbs = [];
  /* Ревью фазы 1 (I3): подписки на Lampa.Listener 'full' считаем — второй
     LC.init() заводил бы вторую, то есть двойной рендер каждой карточки. */
  const fulls = [];
  const params = [];
  /* Task 10: какой шаблон карточки отдан Lampa — наш или возвращённый
     оригинал (главный выключатель lumen_enabled). */
  const added = [];
  const Lampa = {
    Template: { all: () => ({ full_start_new: '<div>orig</div>' }), add: (name, html) => added.push({ name, html }), get: () => '' },
    Listener: { follow: (name, cb) => { if (name === 'full') fulls.push(cb); } },
    Lang: { add: () => { } },
    SettingsApi: { addComponent: () => { }, addParam: (p) => params.push(p) },
    Controller: { listener: { follow: () => { } } },
    Storage: {
      field: (name) => storage[name],
      get: (name, def) => (name in storage ? storage[name] : def),
      listener: opts.noStorageListener ? undefined : { follow: (name, cb) => { if (name === 'change') storageCbs.push(cb); } }
    },
    Platform: { screen: () => false }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa, innerWidth: opts.width || 1920 };

  const LC = {};
  loadInto(LC, '80_settings.js');
  loadInto(LC, '81_prefs.js');
  loadInto(LC, '90_runtime.js');
  LC.template = { build: () => '<div class="lumen-card"></div>', assert: () => ({ ok: true, missingInOurs: [] }) };
  LC.injectFonts = () => log.push('fonts');
  LC.injectCss = () => log.push('css');
  LC.menus = {
    mode: (v) => { log.push('mode:' + v); return v; },
    install: () => log.push('install')
  };
  LC.torrents = { toggle: (on) => log.push('torrents:' + on), install: () => log.push('torrents-install') };
  LC.removeCss = () => log.push('css-remove');
  /* Task 10: применение настроек из 90_runtime.js здесь НАСТОЯЩЕЕ — заглушки
     стоят только на том, до чего оно дотягивается (рендеры карточки, трейлер,
     отзывы, фон). Так проверка «одна точка применения» бьёт по реальной
     цепочке applyPrefChange -> LC.apply*Pref, а не по моку всей цепочки. */
  LC.header = { decorate: () => { }, descr: () => { }, refreshProgress: () => log.push('progress'), refreshCast: () => log.push('cast') };
  LC.trailer = {
    bind: () => { }, schedule: () => null, stopActive: () => log.push('trailer-stop'),
    mode: () => opts.trailerMode || 'auto',
    /* Как настоящая LC.trailer.isLive: признак — класс на слое (здесь слоёв нет). */
    isLive: (layer) => !!(layer && layer.length && typeof layer.hasClass === 'function' && layer.hasClass('lumen-trailer-live'))
  };
  LC.reviews = { render: () => log.push('reviews-render'), clearRow: () => log.push('reviews-clear'), cancel: () => { } };
  LC.backdrops = { apply: () => null, cancel: () => log.push('bg-cancel') };
  /* Task 31 (фаза 4, ревью качества): applyPrefChange зовёт LC.hud.sync() под
     try/catch и проверкой if (LC.hud) — отсутствие LC.hud само по себе
     ничего не сломало бы. Стаб здесь не ради защиты от падения, а чтобы
     журналом log проверить, что для lumen_debug_hud вызов РЕАЛЬНО случился
     (тест «долг ревью (п.2)» ниже). Сам HUD (src/69_hud.js) здесь не
     грузится — покрытие самого модуля в test/hud.test.mjs. */
  LC.hud = { sync: () => log.push('hud-sync'), stop: () => log.push('hud-stop') };
  /* Task 32: класс режима движения на body — фейковый $('body'). */
  const body = new FakeEl(['body-mock']);
  globalThis.$ = (sel) => (sel === 'body' ? body : EMPTY);
  opts.body = body;
  LC.active = { object: {}, body: EMPTY, data: null, slideshow: { pause: () => log.push('slide-pause'), resume: () => log.push('slide-resume') } };
  return { LC, log, storage, storageCbs, fulls, body, params, added };
}

/* Оборачивает настоящие методы LC счётчиками, не подменяя поведение: после
   LC.init() видно, СКОЛЬКО раз каждая точка применения была вызвана. */
function countCalls(LC, names) {
  const seen = {};
  names.forEach((name) => {
    const orig = LC[name];
    seen[name] = 0;
    LC[name] = function () { seen[name]++; return orig.apply(LC, arguments); };
  });
  return seen;
}

function onChangeOf(params, name) {
  return params.filter((p) => p.param.name === name)[0].onChange;
}

test('fix ревью: настройка из меню Lampa применяется один раз — Storage change уже применил, onChange не дублирует', () => {
  const { LC, log, storageCbs, params } = setup();
  LC.init();
  log.length = 0;
  for (const name of ['lumen_card_accent', 'lumen_card_fonts', 'lumen_menus', 'lumen_torrents']) {
    storageCbs[0]({ name }); // Lampa Storage.set: сначала listener 'change'
    onChangeOf(params, name)(); // затем onChange параметра
  }
  assert.deepEqual(log, ['css', 'fonts', 'css', 'mode:all', 'torrents:true']);
});

/* Долг ревью Task 9 (п.2): проверка выше покрывала 4 имени из 7 — а настройка
   без своей ветки молча не применяется до перезахода в Lampa. Здесь — ВСЕ
   пункты раздела разом, по настоящей цепочке applyPrefChange -> LC.apply*Pref
   (счётчики навешаны поверх, поведение не подменено). */
test('долг ревью (п.2): каждая настройка раздела применяется ровно один раз — ни одна не забыта и ни одна не дублируется', () => {
  const { LC, storageCbs, params } = setup();
  LC.init();

  const POINTS = ['applyEnabledPref', 'applyMotionMode', 'applySlideshowPref', 'applyMenusPref',
    'applyTorrentsPref', 'applyTrailerPref', 'applyProgressPref', 'applyReviewsPref',
    'injectCss', 'injectFonts'];
  const spies = countCalls(LC, POINTS);

  const expected = {
    lumen_enabled: ['applyEnabledPref'],
    lumen_card_accent: ['injectCss'],
    lumen_card_fonts: ['injectFonts', 'injectCss'],
    /* Проверка на ТВ 2026-09-24: ротацию кадров карточки гасит «Выкл». */
    lumen_motion: ['applyMotionMode', 'applySlideshowPref'],
    /* Task 31 (фаза 4): HUD отладки — LC.hud.sync() (вне POINTS: только
       ставит/снимает свой узел и rAF-цикл, ни CSS, ни шаблон не трогает). */
    lumen_debug_hud: [],
    lumen_slideshow: ['applySlideshowPref'],
    lumen_slide_interval: ['applySlideshowPref'],
    lumen_trailer: ['applyTrailerPref'],
    lumen_card_progress: ['applyProgressPref'],
    /* Правка 2026-09-16 (п.6): гарнитура — подмена <link> и пересборка CSS. */
    lumen_font: ['injectFonts', 'injectCss'],
    lumen_reviews: ['applyReviewsPref'],
    lumen_kp_key: ['applyReviewsPref'],
    lumen_menus: ['applyMenusPref'],
    lumen_torrents: ['applyTorrentsPref'],
    /* Task 20: подсказка «Ключ API не задан» — тот же перерисовщик ряда
       отзывов, что у самого ключа, плюс сетка подборки (вне POINTS). */
    lumen_kp_hint: ['applyReviewsPref'],
    /* Task 14/20 (фаза 2): адрес каталога — сброс кэша и перезагрузка
       каталога (applyRowsPref, вне POINTS). */
    lumen_manifest_url: [],
    /* Task 15/20 (фаза 2): состав, число и фильтр рядов главной —
       applyRowsPref, вне POINTS. */
    lumen_hide_watched: [],
    lumen_rows_limit: [],
    lumen_home_rows: [],
    /* Task 57 (фаза 5): дедупликация между рядами — тот же applyRowsPref. */
    lumen_rows_dedupe: [],
    /* Постеры: источник постера карточки — тот же applyRowsPref (вне
       POINTS). Набор карточек он не меняет, но обложки берутся при сборке
       ряда, а не правкой готового узла, поэтому применяется ряд целиком. */
    lumen_posters: [],
    /* Task 19/20 (фаза 2): чипы настроения — applyMoodsPref, вне POINTS. */
    lumen_moods: [],
    /* Task 16 (фаза 2): персональные ряды — applyPersonalPref без точек POINTS. */
    lumen_personal_rows: [],
    /* Волна 4: начало главной — applyPersonalPref, вне POINTS. */
    lumen_home_start: [],
    /* Фаза 3: тема, плотность подложек и масштаб — только пересборка CSS. */
    lumen_theme: ['injectCss'],
    lumen_solid: ['injectCss'],
    /* Task 73 (фаза 6): плоский вид — та же одна пересборка CSS; правила
       экранов пути до плеера переписывает она же (LC.injectCss зовёт
       LC.applyTorrentsPref). */
    lumen_flat: ['injectCss'],
    /* A6 (волна A): «Скрывать блоки анализа Lampa» читается в момент
       ПОСТРОЕНИЯ карточки (src/90_runtime.js, dropMetaRow) — на живом экране
       применять нечего, но ветка у настройки своя, иначе имя ушло бы дальше
       как чужое. */
    lumen_hide_meta: [],
    lumen_scale: ['injectCss'],
    /* Task 25 (фаза 3): метки на постерах — applyBadgesPref: наблюдатель и
       метки на живом экране (вне POINTS) плюс пересборка таблицы, от вида
       меток зависит скрытие штатной плашки .card__vote (Task 42/62a).
       До ревью Task 62 пересборки здесь не было видно: функция выходила
       раньше неё, если LC.badges не загружен, — а в этом окружении модуля
       нет. Теперь порядок обратный (метки, потом таблица), и пересборка
       случается в любом случае: правила зависят от НАСТРОЙКИ, а не от того,
       поднялся ли модуль. */
    lumen_badges: ['injectCss'],
    /* Task 26 (фаза 3): пункты в меню карточки — applyCardmenuPref, вне
       POINTS: он только ставит и снимает две подписки. */
    lumen_context_menu: [],
    /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами —
       пересборка CSS (высота кадра и сдвиг области рядов) плюс монтирование
       или снятие самого героя (вне POINTS). */
    lumen_hero_size: ['injectCss'],
    /* Task 24 (фаза 3): акцент от постера — applyAccentPref (вне POINTS).
       Пересборку CSS он делает сам и только когда цвет действительно меняется:
       на выключенной настройке и без открытой карточки injectCss не зовётся. */
    lumen_accent_auto: [],
    /* Task 62a (фаза 5): область подкраски живёт целиком в таблице стилей
       (правило подложки фокуса либо есть, либо нет), и узел подкраски
       переписывает сама пересборка — LC.injectCss зовёт LC.accent.restyle. */
    lumen_accent_scope: ['injectCss'],
    /* Task 27 (фаза 3): мини-карта и быстрое листание — applyNavPref (вне
       POINTS): он только ставит и снимает подписки на клавиатуру Lampa. */
    lumen_minimap: [],
    lumen_fastscroll: [],
    /* Task 28 (фаза 3): режим показа отзывов — тот же перерисовщик ряда, что
       у ключа API; автотрейлер в кадре главной — LC.hero.applyTrailer (вне
       POINTS: он только снимает играющий ролик). */
    lumen_reviews_mode: ['applyReviewsPref'],
    lumen_hero_trailer: [],
    /* Правка 2026-09-23: что показывает кадр главной — LC.hero.applyMedia
       (вне POINTS: он снимает ролик или смену кадров у самого героя). */
    lumen_hero_media: [],
    /* Task 71 (фаза 6): логотип названия в кадре главной —
       LC.hero.applyLogoPref (вне POINTS: он перерисовывает героя той же
       моделью, не трогая ни CSS, ни шаблон карточки). */
    lumen_hero_logo: [],
    /* Правка 2026-09-23: логотип названия в карточке —
       LC.header.applyLogoPref (вне POINTS: он перерисовывает только узел
       названия уже открытых карточек, не трогая ни CSS, ни шаблон). */
    lumen_card_logo: [],
    /* Task 21 (фаза 3): атмосферы — LC.applyFxPref (вне POINTS: он
       пересобирает слой частиц открытого экрана, не трогая ни CSS, ни
       шаблон карточки). */
    lumen_fx: [],
    /* Task 22 (фаза 3): заставка из кадров — LC.applyAmbientPref (вне
       POINTS: он только ставит и снимает подписки document, таймер покоя и
       сам слой, не трогая ни CSS, ни шаблон карточки). */
    lumen_ambient: [],
    lumen_ambient_source: [],
    lumen_ambient_delay: [],
    /* Task 23 (фаза 3): фильтр рулетки читается при входе в неё — на живом
       экране применять нечего. */
    lumen_roulette_unseen: [],
    /* Task 40 (фаза 4): тумблер тяжёлых эффектов — класс на body и слой
       частиц через applyMotionMode. Ротация кадров карточки от него с
       2026-09-24 не зависит. */
    lumen_fx_heavy: ['applyMotionMode'],
    /* Task 62b (фаза 5): кнопки готового стиля. Своего значения у них нет —
       нажатие пишет ЧУЖИЕ настройки, и каждая применяется своей веткой
       выше. Здесь проверяется только то, что «запись» самой кнопки ничего
       не запускает и не уходит в общий фильтр по префиксу; само нажатие в
       этом окружении безопасно уходит в no-op (Storage.set в моке выше
       нет), а что именно оно пишет — в test/settings.test.mjs. */
    lumen_preset_appletv: [],
    lumen_preset_lumen: []
  };

  /* В проверке обязаны быть все пункты раздела — иначе она снова отстанет от
     списка настроек, как отстала после Task 6/7/9. */
  assert.deepEqual(Object.keys(expected).sort(),
    LC.prefs.LIST.filter((e) => e.type !== 'title').map((e) => e.name).sort());

  for (const name of Object.keys(expected)) {
    const before = Object.assign({}, spies);
    storageCbs[0]({ name });      // Lampa Storage.set: сначала listener 'change'
    onChangeOf(params, name)();   // затем onChange параметра
    for (const point of POINTS) {
      const delta = spies[point] - before[point];
      const want = expected[name].indexOf(point) !== -1 ? 1 : 0;
      assert.equal(delta, want, name + ' -> ' + point + ': ожидалось ' + want + ' вызовов, было ' + delta);
    }
  }
});

/* ====================================================================== */
/* Task 10: главный выключатель lumen_enabled.                            */
/*                                                                        */
/* Выключенный плагин обязан вернуть Lampa её собственный шаблон карточки  */
/* и снять за собой всё: оба <style>, классы на body, маркеры меню,        */
/* слайдшоу и трейлер открытой карточки. Включение возвращает наш шаблон   */
/* и оформление — без перезагрузки Lampa.                                 */
/* ====================================================================== */

test('Task 10: lumen_enabled=false на старте — плагин ничего не оформляет, шаблон Lampa не подменяется', () => {
  const { LC, log, added, body } = setup({ storage: { lumen_enabled: 'false', lumen_motion: 'full' } });
  LC.init();
  assert.deepEqual(log, [], 'ни CSS, ни шрифтов, ни меню, ни экранов торрентов');
  assert.deepEqual(added, [], 'шаблон full_start_new остаётся штатным');
  assert.deepEqual(body._class, ['body-mock'], 'на body нет классов плагина');
});

test('Task 10: включение на лету активирует оформление и ставит наш шаблон', () => {
  const { LC, log, added, storage, storageCbs } = setup({ storage: { lumen_enabled: 'false' } });
  LC.init();
  log.length = 0;

  storage.lumen_enabled = 'true';
  storageCbs[0]({ name: 'lumen_enabled' });

  assert.deepEqual(log, ['fonts', 'css', 'hud-sync', 'mode:all', 'install', 'torrents-install', 'torrents:true']);
  assert.deepEqual(added, [{ name: 'full_start_new', html: '<div class="lumen-card"></div>' }]);
});

test('Task 10: выключение на лету возвращает штатный шаблон и снимает оформление', () => {
  const { LC, log, added, body, storage, storageCbs } = setup({ storage: { lumen_motion: 'full' } });
  LC.init();
  assert.equal(body.hasClass('lumen-motion-full'), true, 'до выключения класс режима на body стоит');
  log.length = 0;
  added.length = 0;

  storage.lumen_enabled = 'false';
  storageCbs[0]({ name: 'lumen_enabled' });

  assert.deepEqual(added, [{ name: 'full_start_new', html: '<div>orig</div>' }], 'вернулся оригинал Lampa');
  /* Слои фона гасятся обходом .lumen-backdrop по всему документу (ревью п.3),
     а в этом фейковом DOM слоёв нет — отсюда отсутствие bg-cancel. Сам обход
     проверяет test/runtime.test.mjs на двух карточках (активной и из истории). */
  assert.deepEqual(log, ['hud-stop', 'css-remove', 'fonts', 'torrents:false', 'mode:off'],
    'сняты: CSS карточки, <link> шрифтов, CSS и класс экранов торрентов, маркеры меню');
  assert.equal(body.hasClass('lumen-motion-full'), false, 'класс режима движения снят с body');
  assert.equal(LC.active, null, 'ссылка на открытую карточку отпущена');
});

test('Task 10: повторное выключение/включение идемпотентны', () => {
  const { LC, log, storage, storageCbs } = setup();
  LC.init();

  storage.lumen_enabled = 'false';
  storageCbs[0]({ name: 'lumen_enabled' });
  log.length = 0;
  storageCbs[0]({ name: 'lumen_enabled' });
  assert.deepEqual(log, [], 'второе выключение подряд ничего не делает');

  storage.lumen_enabled = 'true';
  storageCbs[0]({ name: 'lumen_enabled' });
  log.length = 0;
  storageCbs[0]({ name: 'lumen_enabled' });
  assert.deepEqual(log, [], 'второе включение подряд ничего не делает');
});

test('Task 10: пока плагин выключен, смена прочих настроек не ставит классы и не трогает экраны', () => {
  const { LC, log, storage, storageCbs, body } = setup({ storage: { lumen_enabled: 'false' } });
  LC.init();
  log.length = 0;

  storage.lumen_menus = 'path';
  storageCbs[0]({ name: 'lumen_menus' });
  storage.lumen_torrents = 'true';
  storageCbs[0]({ name: 'lumen_torrents' });
  storage.lumen_motion = 'off';
  storageCbs[0]({ name: 'lumen_motion' });

  assert.deepEqual(log, [], 'оформление выключено целиком — применять нечего');
  assert.deepEqual(body._class, ['body-mock']);
});

test('fix ревью: без подписки на Storage onChange остаётся рабочим путём', () => {
  const { LC, log, params } = setup({ noStorageListener: true });
  LC.init();
  log.length = 0;
  onChangeOf(params, 'lumen_card_accent')();
  onChangeOf(params, 'lumen_torrents')();
  assert.deepEqual(log, ['css', 'torrents:true']);
});

test('Task 32: LC.init после меню — LC.torrents.install и LC.applyTorrentsPref (сохранённое значение)', () => {
  const { LC, log } = setup({ storage: { lumen_torrents: 'false' } });
  LC.init();
  const i = log.indexOf('install');
  assert.deepEqual(log.slice(i, i + 3), ['install', 'torrents-install', 'torrents:false']);
});

test('Task 32: класс режима движения на body ставит LC.init, меняет LC.applyMotionMode', () => {
  const { LC, storage, body } = setup({ storage: { lumen_motion: 'full' } });
  assert.equal(body.hasClass('lumen-motion-full'), false, 'до init класса нет');
  LC.init();
  assert.equal(body.hasClass('lumen-motion-full'), true);
  storage.lumen_motion = 'off';
  LC.applyMotionMode();
  assert.equal(body.hasClass('lumen-motion-off'), true);
  assert.equal(body.hasClass('lumen-motion-full'), false);
});

/* Task 40: класс тяжёлых эффектов живёт там же, где класс режима, — на body,
   потому что от него зависят и наезд на кадр карточки (слой .lumen-backdrop
   лежит вне .lumen-card), и зум заставки, и кроссфейд кадра героя. */
test('Task 40: класс lumen-fx-heavy ставит LC.init, снимает выключение тумблера и режим lite', () => {
  const { LC, storage, body } = setup({ storage: { lumen_motion: 'full' } });
  assert.equal(body.hasClass('lumen-fx-heavy'), false, 'до init класса нет');
  LC.init();
  assert.equal(body.hasClass('lumen-fx-heavy'), true, 'вне телевизора тяжёлые эффекты включены по умолчанию');

  storage.lumen_fx_heavy = 'false';
  LC.applyMotionMode();
  assert.equal(body.hasClass('lumen-fx-heavy'), false, 'тумблер выключен');

  storage.lumen_fx_heavy = 'true';
  storage.lumen_motion = 'lite';
  LC.applyMotionMode();
  assert.equal(body.hasClass('lumen-fx-heavy'), false, 'в lite тяжёлых эффектов нет и при включённом тумблере');

  storage.lumen_motion = 'full';
  LC.applyMotionMode();
  assert.equal(body.hasClass('lumen-fx-heavy'), true, 'вернулись в full — класс вернулся');
});

test('Task 40: выключение плагина снимает с body и класс тяжёлых эффектов', () => {
  const { LC, body, storage, storageCbs } = setup({ storage: { lumen_motion: 'full' } });
  LC.init();
  assert.equal(body.hasClass('lumen-fx-heavy'), true);
  storage.lumen_enabled = 'false';
  storageCbs[0]({ name: 'lumen_enabled' });
  assert.equal(body.hasClass('lumen-fx-heavy'), false);
});

test('Task 32: плагин не активен (узкая раскладка) — класс движения на body не ставится', () => {
  const { LC, body } = setup({ width: 400, storage: { lumen_motion: 'lite' } });
  LC.init();
  LC.applyMotionMode();
  assert.deepEqual(body._class, ['body-mock']);
});

test('до LC.init: applyMenusPref/applyTorrentsPref ничего не делают (плагин не активен)', () => {
  const { LC, log } = setup();
  LC.applyMenusPref();
  LC.applyTorrentsPref();
  assert.deepEqual(log, []);
});

test('LC.init на широкой раскладке: css -> mode(сохранённый) -> install, дальше смена настроек применяется', () => {
  const { LC, log, storage } = setup({ storage: { lumen_menus: 'path' } });
  LC.init();
  const i = log.indexOf('css');
  assert.deepEqual(log.slice(i, i + 4), ['css', 'hud-sync', 'mode:path', 'install']);
  log.length = 0;
  storage.lumen_menus = 'off';
  LC.applyMenusPref();
  storage.lumen_torrents = 'false';
  LC.applyTorrentsPref();
  assert.deepEqual(log, ['mode:off', 'torrents:false']);
});

test('LC.init на узкой раскладке (плагин не активируется): ни mode, ни install; настройки не ставят классы', () => {
  const { LC, log } = setup({ width: 400 });
  LC.init();
  assert.deepEqual(log, []);
  LC.applyMenusPref();
  LC.applyTorrentsPref();
  assert.deepEqual(log, []);
});

test('LC.followStorage: change lumen_menus -> mode, lumen_torrents -> toggle (строка true/false нормализуется)', () => {
  const { LC, log, storage, storageCbs } = setup();
  LC.init();
  assert.equal(storageCbs.length, 1);
  log.length = 0;
  storage.lumen_menus = 'path';
  storageCbs[0]({ name: 'lumen_menus' });
  storage.lumen_torrents = 'false';
  storageCbs[0]({ name: 'lumen_torrents' });
  storage.lumen_torrents = 'true';
  storageCbs[0]({ name: 'lumen_torrents' });
  assert.deepEqual(log, ['mode:path', 'torrents:false', 'torrents:true']);
});

test('LC.followStorage до активации (узкая раскладка): ветки lumen_menus/lumen_torrents — no-op', () => {
  const { LC, log, storageCbs } = setup({ width: 400 });
  LC.init();
  storageCbs[0]({ name: 'lumen_menus' });
  storageCbs[0]({ name: 'lumen_torrents' });
  assert.deepEqual(log, []);
});

/* ====================================================================== */
/* Ревью фазы 1 (I3): сам LC.init идемпотентным не был.                   */
/*                                                                        */
/* Все его подписки защищены флагами по отдельности (followToggle,        */
/* followActivityLifecycle, LC.followTimeline, menus.install,             */
/* torrents.install), но не сам init, не LC.addSettings и не              */
/* LC.followStorage (её флаг LC.storageFollowed ставился ПОСЛЕ подписки и */
/* в начале не проверялся). Второй вызов заводил вторую подписку          */
/* Listener 'full', вторую подписку Storage 'change' и повторно           */
/* регистрировал пункты раздела. Цена — двойной рендер карточки и ДВОЙНОЕ */
/* применение каждой настройки: обработчик события применяет и лишь потом */
/* ставит pref_handled, а onChange съедает ровно одно событие.            */
/*                                                                        */
/* В vendor 3.3.4 сценарий сегодня не воспроизводится (startApp() закрыт   */
/* гардом if (window.appready || window.app_time_launch) return), но       */
/* LC.boot подписку на 'app' не снимает, а src/00_head.js страхует только  */
/* от повторной ЗАГРУЗКИ скрипта — не от повторного вызова init.          */
/* ====================================================================== */

test('I3: повторный LC.init не заводит вторых подписок и не дублирует пункты настроек', () => {
  const { LC, log, fulls, storageCbs, params } = setup();
  LC.init();
  const firstParams = params.length;
  assert.equal(fulls.length, 1, 'первая подписка на full заведена');
  assert.equal(storageCbs.length, 1);
  assert.ok(firstParams > 0, 'пункты раздела зарегистрированы');
  log.length = 0;

  LC.init();

  assert.equal(fulls.length, 1, 'вторая подписка на full — двойной рендер каждой карточки');
  assert.equal(storageCbs.length, 1, 'вторая подписка на Storage change — двойное применение каждой настройки');
  assert.equal(params.length, firstParams, 'пункты раздела зарегистрированы повторно');
  assert.deepEqual(log, [], 'оформление второй раз не собирается');
});

/* Та самая цена двойной подписки: Lampa рассылает событие 'change' ВСЕМ
   подписчикам, а pref_handled гасит ровно одно повторение. */
test('I3: после повторного init настройка из меню по-прежнему применяется ровно один раз', () => {
  const { LC, log, storageCbs, params } = setup();
  LC.init();
  LC.init();
  log.length = 0;

  storageCbs.forEach((cb) => cb({ name: 'lumen_card_accent' }));  // Storage.set: рассылка ВСЕМ подписчикам
  onChangeOf(params, 'lumen_card_accent')();                      // затем onChange параметра

  assert.deepEqual(log, ['css'], 'две подписки на Storage пересобрали бы CSS дважды');
});

/* ====================================================================== */
/* Task 20: пересборка главной под новый состав рядов.                    */
/*                                                                        */
/* Ряды живут в Lampa.ContentRows: перерегистрация меняет то, что Lampa    */
/* построит в СЛЕДУЮЩИЙ раз. Инвариант проекта — настройка применяется на  */
/* лету, поэтому экран пересобирается сам: сразу, если открыт, и на        */
/* возврате, если пользователь ещё в настройках.                          */
/* ====================================================================== */

/* Волна 4: ряды главной регистрирует план (LC.homeplan.apply,
   src/47_homeplan.js) — его и считаем. */
function setupRefresh(component) {
  const env = setup();
  const registered = [];
  let replaced = 0;
  let current = component;
  env.LC.manifest = { load: (cb) => cb({ collections: [], home: [] }) };
  env.LC.homeplan = { apply: (o) => registered.push(o), unregister: () => { }, hold: () => { } };
  globalThis.Lampa.Activity = {
    active: () => ({ component: current }),
    replace: () => { replaced++; }
  };
  env.LC.init();
  return Object.assign({
    registered,
    replaced: () => replaced,
    setActive: (name) => { current = name; }
  }, env);
}

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

test('Task 20: открыта главная — состав рядов применяется сразу', async () => {
  const env = setupRefresh('main');
  env.registered.length = 0;

  env.LC.applyRowsPref();
  assert.equal(env.registered.length, 1, 'ряды перерегистрированы');
  assert.ok(env.registered[0].manifest, 'план получил загруженный каталог');
  assert.ok(!env.registered[0].fresh, 'перерегистрация эпоху не двигает — её двигает только построение главной');
  await tick();
  assert.equal(env.replaced(), 1, 'главная пересобрана');
});

test('Task 20: пользователь в настройках — главная пересобирается при возврате, один раз', async () => {
  const env = setupRefresh('settings');

  env.LC.applyRowsPref();
  await tick();
  assert.equal(env.replaced(), 0, 'активность настроек заменять нельзя');

  env.setActive('main');
  env.LC.onActivityEvent({ type: 'start', component: 'main', object: {} });
  await tick();
  assert.equal(env.replaced(), 1);

  /* Второй возврат на главную — пересобирать уже нечего. */
  env.LC.onActivityEvent({ type: 'start', component: 'main', object: {} });
  await tick();
  assert.equal(env.replaced(), 1);
});

test('Task 20: возврат на ЧУЖОЙ экран пересборку не запускает', async () => {
  const env = setupRefresh('settings');
  env.LC.applyRowsPref();

  env.setActive('full');
  env.LC.onActivityEvent({ type: 'start', component: 'full', object: {} });
  await tick();
  assert.equal(env.replaced(), 0);
});

test('Task 20: подсказка про ключ пересобирает только открытую сетку подборки', async () => {
  const env = setupRefresh('main');
  env.LC.applyKpHintPref();
  await tick();
  assert.equal(env.replaced(), 0, 'на главной подсказки про ключ нет');

  env.setActive('lumen_grid');
  env.LC.applyKpHintPref();
  await tick();
  assert.equal(env.replaced(), 1);
});

/* Настройки Lampa 3.3.4 — слой поверх активности, а не активность: пересборка
   под ними закрыла бы раздел и увела фокус (видно живьём, Task 20). */
function setupSettingsLayer() {
  const env = setup();
  const registered = [];
  let replaced = 0;
  let controller = 'settings_component';
  const closeCbs = [];
  env.LC.manifest = { load: (cb) => cb({ collections: [], home: [] }) };
  env.LC.homeplan = { apply: (o) => registered.push(o), unregister: () => { }, hold: () => { } };
  globalThis.Lampa.Activity = { active: () => ({ component: 'main' }), replace: () => { replaced++; } };
  globalThis.Lampa.Controller.enabled = () => ({ name: controller });
  globalThis.Lampa.Settings = { listener: { follow: (name, cb) => { if (name === 'close') closeCbs.push(cb); } } };
  env.LC.init();
  return Object.assign({
    registered,
    replaced: () => replaced,
    closeSettings: () => { controller = 'content'; closeCbs.forEach((cb) => cb()); },
    closeCbs
  }, env);
}

test('Task 20: настройка меняется под открытым слоем настроек — экран пересобирается после его закрытия', async () => {
  const env = setupSettingsLayer();
  env.registered.length = 0;

  env.LC.applyRowsPref();
  await tick();
  assert.equal(env.registered.length, 1, 'ряды перерегистрированы сразу');
  assert.equal(env.replaced(), 0, 'пока раздел открыт, экран не трогаем');

  env.closeSettings();
  await tick();
  assert.equal(env.replaced(), 1, 'закрыли настройки — главная пересобралась');
});

test('Task 20: несколько настроек подряд дают одну пересборку и одну подписку на закрытие', async () => {
  const env = setupSettingsLayer();

  env.LC.applyRowsPref();
  env.LC.applyPersonalPref();
  env.LC.applyRowsPref();
  await tick();
  assert.equal(env.closeCbs.length, 1, 'подписка на закрытие настроек заводится один раз');

  env.closeSettings();
  await tick();
  assert.equal(env.replaced(), 1);
});

/* ====================================================================== */
/* Гонка первого экрана: главная построилась раньше, чем приехал плагин.   */
/*                                                                        */
/* Главную Lampa поднимает по setTimeout(last, 500) из Activity.init       */
/* (app.min.js:45641, last — 46039), а плагин грузится по сети. Проиграли  */
/* гонку — первый экран без наших рядов подборок и без персональных.       */
/* Чиним один раз за активацию и только по факту: главная на экране И ни   */
/* одна наша call-функция ещё не вызывалась (LC.rows.served()).            */
/* ====================================================================== */

function setupHomeRace(opts) {
  opts = opts || {};
  const env = setup();
  let replaced = 0;
  let current = opts.active || null;
  let served = !!opts.served;
  env.LC.manifest = { load: (cb) => cb({ collections: [], home: [] }) };
  env.LC.rows = {
    installDedupe: () => { },
    uninstallDedupe: () => { },
    served: () => served
  };
  env.LC.homeplan = { apply: () => { }, unregister: () => { }, hold: () => { } };
  globalThis.Lampa.Activity = {
    active: () => (current ? { component: current } : null),
    replace: () => { replaced++; }
  };
  return Object.assign({
    replaced: () => replaced,
    setActive: (name) => { current = name; },
    setServed: (value) => { served = value; }
  }, env);
}

/* Волна 4: ряды главной — и личные, и подборки — регистрирует план; он же
   их снимает, когда плагин выключают. */
test('волна 4: активация отдаёт ряды плану главной, выключение их снимает', async () => {
  const env = setupHomeRace({ active: null, served: false });
  const log = [];
  env.LC.homeplan = { apply: (o) => log.push('apply:' + Object.keys(o || {}).join(',')), unregister: () => log.push('unregister'), hold: () => { } };
  env.LC.init();
  assert.deepEqual(log, ['apply:start', 'apply:manifest'], 'личные ряды сразу, подборки — с каталогом');
  log.length = 0;
  env.storage.lumen_enabled = 'false';
  env.LC.applyEnabledPref();
  assert.deepEqual(log, ['unregister']);
});

test('гонку выиграли: главной на экране ещё нет — пересборки нет', async () => {
  const env = setupHomeRace({ active: null, served: false });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 0, 'следующая главная и так построится с нашими рядами');
});

test('гонку выиграли: главная уже построена с нашими рядами — пересборки нет', async () => {
  /* Ложное срабатывание, от которого спасает served(): Lampa успела
     построить главную между нашей регистрацией и проверкой. */
  const env = setupHomeRace({ active: 'main', served: true });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 0);
});

test('гонку проиграли: главная на экране без наших рядов — ровно одна пересборка', async () => {
  const env = setupHomeRace({ active: 'main', served: false });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 1);
});

test('гонку проиграли: повторная активация второй пересборки не даёт', async () => {
  const env = setupHomeRace({ active: 'main', served: false });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 1);

  /* Выключение и включение плагина из настроек — активация вторая, но
     главная уже пересобрана с нашими рядами. */
  env.setServed(true);
  env.log.length = 0;
  env.storage.lumen_enabled = 'false';
  env.LC.applyEnabledPref();
  env.storage.lumen_enabled = 'true';
  env.LC.applyEnabledPref();
  assert.ok(env.log.indexOf('css-remove') !== -1 && env.log.indexOf('css') !== -1,
    'плагин действительно выключился и включился заново');
  await tick();
  assert.equal(env.replaced(), 1, 'повторных пересборок быть не должно');
});

test('гонку проиграли, но открыт слой настроек — экран под руками не дёргаем', async () => {
  const env = setupHomeRace({ active: 'main', served: false });
  env.body.addClass('settings--open');
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 0, 'пересборка под открытым слоем закрыла бы раздел и увела фокус');
});

test('гонку проиграли, но фокус в меню Lampa — ждём, а не вырываем фокус', async () => {
  const env = setupHomeRace({ active: 'main', served: false });
  globalThis.Lampa.Controller.enabled = () => ({ name: 'menu' });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 0);
});

test('на чужом экране пересборки нет', async () => {
  const env = setupHomeRace({ active: 'full', served: false });
  env.LC.init();
  await tick();
  assert.equal(env.replaced(), 0);
});

/* ====================================================================== */
/* A6 (волна A финального плана): блоки анализа Lampa на карточке.        */
/*                                                                         */
/* «Метаданные» (Темп/Страх/Экшн…) и «Настроения» (проценты) — ряды САМОЙ  */
/* Lampa: компонент карточки кладёт их в rows именами 'metadata_chart' и   */
/* 'metadata_tags' (vendor/lampa/app.min.js:38843 и :38849), собирают их   */
/* MetadataChart (:38200) и MetadataTags (:38272) из data.metadata, а её   */
/* приносит Api.sources.cub.metadataGet — только для фильма                */
/* (`params.method == 'movie'`, :20160-20166). Штатного выключателя нет,   */
/* поэтому узел ряда мы помечаем своим классом, а показывать его или нет   */
/* решает одно правило таблицы стилей.                                     */
/* ====================================================================== */

/* Данные карточки в том виде, в каком их отдаёт Api.full: анализ CUB лежит
   в data.metadata и читается Lampa ровно один раз — на app.min.js:38842,
   сразу ПОСЛЕ события 'full' типа 'start' (:38833-38840). */
function fullData() {
  return { movie: { id: 1, title: 'X' }, metadata: { status: 'completed', review: [{ name: 'pace' }], moods: [{ name: 'тревога', percent: 40 }] } };
}

/* Ряды не прячутся и не снимаются со сцены, а НЕ СОЗДАЮТСЯ: оба других пути
   проверены живьём на стенде и ломают навигацию — скрытый display:none ряд
   остаётся в наборе Navigator (Controller.collectionSet отбирает по
   offsetParent только при visible_only, app.min.js:46453-46456, а карточка
   зовёт его одним аргументом, :39126), а снятый со сцены узел остаётся в
   this.items, и шаг «вниз» отдаёт управление его компоненту с пустым
   набором — фокус пропадает совсем. */
test('A6: при включённой настройке Lampa не получает данных для рядов анализа', () => {
  const { LC, fulls } = setup({ storage: { lumen_hide_meta: 'true' } });
  LC.init();
  assert.equal(fulls.length, 1, 'подписка на full должна быть ровно одна');
  const data = fullData();
  fulls[0]({ type: 'start', body: EMPTY, data: data });
  /* Ровно то состояние, при котором Lampa не кладёт ни metadata_chart, ни
     metadata_tags: проверка на :38842 не проходит. */
  assert.equal(data.metadata, null, 'Lampa всё ещё построит ряды анализа');
});

test('A6: настройка выключена — данные Lampa не трогаем вовсе', () => {
  for (const storage of [{}, { lumen_hide_meta: 'false' }]) {
    const { LC, fulls } = setup({ storage: storage });
    LC.init();
    const data = fullData();
    const meta = data.metadata;
    fulls[0]({ type: 'start', body: EMPTY, data: data });
    assert.equal(data.metadata, meta, 'чужие данные молча не прячем: ' + JSON.stringify(storage));
    assert.ok(!data.lumen_metadata, 'лишнего поля в данных Lampa быть не должно');
  }
});

/* «Мы не трогаем её данные»: снятое возвращается на 'complite' — он уходит
   из того же синхронного блока сразу после build (app.min.js:38961-38972),
   то есть после единственного чтения на :38842. */
test('A6: данные Lampa не остаются изменёнными — complite возвращает анализ на место', () => {
  const { LC, fulls } = setup({ storage: { lumen_hide_meta: 'true' } });
  LC.init();
  const data = fullData();
  const meta = data.metadata;
  fulls[0]({ type: 'start', body: EMPTY, data: data });
  assert.equal(data.metadata, null);
  fulls[0]({ type: 'complite', body: EMPTY, object: {}, data: data });
  assert.equal(data.metadata, meta, 'анализ не вернулся в данные карточки');
  assert.ok(!data.lumen_metadata, 'след от подмены остался в данных Lampa');
});

test('A6: карточка без анализа (сериал, не-русский язык, анализ не готов) ничего не ломает', () => {
  const { LC, fulls } = setup({ storage: { lumen_hide_meta: 'true' } });
  LC.init();
  for (const data of [{ movie: {} }, { movie: {}, metadata: null }, {}]) {
    fulls[0]({ type: 'start', body: EMPTY, data: data });
    fulls[0]({ type: 'complite', body: EMPTY, object: {}, data: data });
    assert.ok(!data.metadata, JSON.stringify(data));
  }
  fulls[0]({ type: 'start', body: EMPTY });
});

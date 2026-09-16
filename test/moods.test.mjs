import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';
import { load, loadCtx } from './_load.mjs';

/* Task 19: чипы профилей настроения на главной.
   Чистые функции (moodTitle, moodActivityObj) проверяются без Lampa.
   Жизненный цикл (mount/unmount/detach, active, install/uninstall)
   — на фейковых $ и Lampa-заглушках. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/49_moods.js', import.meta.url), 'utf8');
const SOURCES = load('43_sources.js');

/* Минимальный манифест с 4 чипами настроения. */
var MOODS = [
  { id: 'friday', title: 'Пятничный вечер', i18n: { en: 'Friday Evening', uk: 'П\'ятничний вечір' },
    sources: { movie: { type: 'discover', params: { genres: '28|12|35', sort_by: 'popularity.desc', filter: { 'vote_average.gte': 6.5, 'with_runtime.lte': 130 } } } } },
  { id: 'family', title: 'Семейный просмотр', i18n: { en: 'Family Viewing', uk: 'Сімейний перегляд' },
    sources: { movie: { type: 'discover', params: { genres: '10751|16', sort_by: 'popularity.desc', filter: { certification_country: 'US', 'certification.lte': 'PG' } } } } },
  { id: 'scary', title: 'Страшное на ночь', i18n: { en: 'Scary at Night', uk: 'Страшне вночі' },
    sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } } },
  { id: 'short', title: '90 минут', i18n: { en: '90 Minutes', uk: '90 хвилин' },
    sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'with_runtime.lte': 90, 'vote_count.gte': 200 } } } } }
];

var MANIFEST_DEFAULT = { moods: MOODS };

/* Создаёт свежий экземпляр LC.moods с нужными зависимостями. */
function freshMoods(extra) {
  var listeners = {};
  var controllers = {};
  var pushed = [];
  var activeAct = null;

  var fakeLampa = {
    Listener: {
      follow: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
      remove: function (ev, fn) {
        if (!listeners[ev]) return;
        var idx = listeners[ev].indexOf(fn);
        if (idx !== -1) listeners[ev].splice(idx, 1);
      }
    },
    Controller: {
      add: function (name, ctrl) { controllers[name] = ctrl; },
      toggle: function (name) { if (controllers[name] && controllers[name].toggle) controllers[name].toggle(); },
      get: function (name) { return controllers[name] || null; }
    },
    Activity: {
      push: function (obj) { pushed.push(obj); },
      active: function () { return activeAct; }
    },
    Lang: { code: function () { return 'ru'; } }
  };

  var LC = Object.assign({
    sources: SOURCES,
    /* Заглушка повторяет ПУБЛИЧНОЕ API src/42_manifest.js: get() отдаёт
       загруженный каталог, DEFAULT — встроенный. Метода current() наружу
       модуль не отдаёт (это его приватная переменная), и заглушка его
       больше не выдумывает — настоящий модуль проверяют тесты ниже. */
    manifest: {
      get: function () { return { moods: MOODS }; },
      DEFAULT: MANIFEST_DEFAULT
    },
    lang: function (k) { return k; }
  }, extra || {});

  /* Фейковый $ — минимальный для нужд mount/unmount. */
  function makeNode(className) {
    var el = new FakeEl(className ? [className] : []);
    el.on = function () { return el; };
    el.off = function () { return el; };
    return el;
  }

  var fakeQ = function (html) {
    if (typeof html !== 'string') return html instanceof FakeEl ? html : EMPTY;
    /* Парсим класс из строки вида '<div class="foo bar"></div>' */
    var m = /class="([^"]*)"/.exec(html);
    var classes = m ? m[1].split(/\s+/).filter(Boolean) : [];
    var el = new FakeEl(classes);
    el.on = function () { return el; };
    el.off = function () { return el; };
    return el;
  };

  var module = { exports: null, lumen: true };
  new Function('LC', 'module', '$', 'Lampa', SRC)(LC, module, fakeQ, fakeLampa);
  return {
    api: module.exports, LC: LC, listeners: listeners, controllers: controllers,
    pushed: pushed, fakeLampa: fakeLampa,
    setActive: function (a) { activeAct = a; }
  };
}

/* ====================================================================== */
/* moodTitle                                                              */
/* ====================================================================== */

test('moodTitle: русский title по умолчанию', function () {
  var M = freshMoods().api;
  assert.equal(M.moodTitle(MOODS[0], 'ru'), 'Пятничный вечер');
});
test('moodTitle: i18n.en при lang=en', function () {
  var M = freshMoods().api;
  assert.equal(M.moodTitle(MOODS[0], 'en'), 'Friday Evening');
});
test('moodTitle: i18n.uk при lang=uk', function () {
  var M = freshMoods().api;
  assert.equal(M.moodTitle(MOODS[1], 'uk'), 'Сімейний перегляд');
});
test('moodTitle: нет перевода на язык — title (русский)', function () {
  var mood = { title: 'Тест', i18n: { en: 'Test' } };
  var M = freshMoods().api;
  assert.equal(M.moodTitle(mood, 'de'), 'Test', 'нет de — en');
  assert.equal(M.moodTitle({ title: 'Тест' }, 'en'), 'Тест', 'нет i18n — title');
});
test('moodTitle: null/пустой объект не роняет', function () {
  var M = freshMoods().api;
  assert.equal(M.moodTitle(null, 'ru'), '');
  assert.equal(M.moodTitle({}, 'ru'), '');
});

/* ====================================================================== */
/* active / mount / unmount / detach                                      */
/* ====================================================================== */

/* Строит фейковый корень активности главной с вложенной структурой
   .lumen-hero > .lumen-hero__text > .lumen-hero__chips. */
function makeMainRoot() {
  var chipsEl = new FakeEl(['lumen-hero__chips']);
  chipsEl.on = function () { return chipsEl; };
  var textEl = new FakeEl(['lumen-hero__text']);
  textEl.on = function () { return textEl; };
  textEl._children = [chipsEl];
  chipsEl._parentEl = textEl;
  /* after() — вставляет переданный элемент ПОСЛЕ себя в родителе. */
  chipsEl.after = function (newEl) {
    var p = chipsEl._parentEl;
    if (!p) return chipsEl;
    var idx = p._children.indexOf(chipsEl);
    p._children.splice(idx + 1, 0, newEl);
    newEl._parentEl = p;
    return chipsEl;
  };
  var heroEl = new FakeEl(['lumen-hero']);
  heroEl._children = [textEl];
  textEl._parentEl = heroEl;
  var root = new FakeEl(['activity']);
  root.on = function () { return root; };
  root._children = [heroEl];
  heroEl._parentEl = root;
  return root;
}

test('active: до mount возвращает false', function () {
  var ctx = freshMoods();
  assert.equal(ctx.api.active(), false);
});

test('mount: после mount — active() true, чипы вставлены', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  assert.equal(ctx.api.active(), true);
  /* .lumen-moods должен быть вставлен в .lumen-hero__text */
  var textEl = root.find('lumen-hero__text');
  var hasMoods = false;
  for (var i = 0; i < textEl._children.length; i++) {
    if (textEl._children[i].hasClass('lumen-moods')) { hasMoods = true; break; }
  }
  assert.equal(hasMoods, true, '.lumen-moods не вставлен в .lumen-hero__text');
});

test('mount: число чипов равно числу настроений в манифесте', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  var textEl = root.find('lumen-hero__text');
  var moodsEl = null;
  for (var i = 0; i < textEl._children.length; i++) {
    if (textEl._children[i].hasClass('lumen-moods')) { moodsEl = textEl._children[i]; break; }
  }
  assert.ok(moodsEl, '.lumen-moods не найден');
  var chipCount = 0;
  for (var j = 0; j < moodsEl._children.length; j++) {
    if (moodsEl._children[j].hasClass('lumen-mood-chip')) chipCount++;
  }
  assert.equal(chipCount, MOODS.length);
});

test('mount: повторный mount того же root — идемпотентен', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  ctx.api.mount(root);
  /* Только один .lumen-moods */
  var textEl = root.find('lumen-hero__text');
  var count = 0;
  for (var i = 0; i < textEl._children.length; i++) {
    if (textEl._children[i].hasClass('lumen-moods')) count++;
  }
  assert.equal(count, 1);
});

test('unmount: после unmount — active() false', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  ctx.api.unmount();
  assert.equal(ctx.api.active(), false);
});

test('unmount: повторный unmount безопасен', function () {
  var ctx = freshMoods();
  ctx.api.unmount();
  assert.equal(ctx.api.active(), false);
});

test('mount: нет манифеста — не монтируется', function () {
  var ctx = freshMoods({
    manifest: { current: function () { return { moods: [] }; }, DEFAULT: { moods: [] } }
  });
  var root = makeMainRoot();
  ctx.api.mount(root);
  assert.equal(ctx.api.active(), false);
});

test('mount: нет .lumen-hero__text в root — не монтируется', function () {
  var ctx = freshMoods();
  var root = new FakeEl(['activity']);
  root.on = function () { return root; };
  /* Пустой корень без иерархии героя. */
  ctx.api.mount(root);
  assert.equal(ctx.api.active(), false);
});

test('detach: тот же root — не снимает', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  ctx.api.detach(root);
  assert.equal(ctx.api.active(), true, 'detach(того же root) не должен снимать');
});

test('detach: другой render — снимает', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  var other = new FakeEl(['activity']);
  other.on = function () { return other; };
  ctx.api.detach(other);
  assert.equal(ctx.api.active(), false);
});

/* ====================================================================== */
/* install / uninstall                                                    */
/* ====================================================================== */

/* Important 2 (fix-раунд итогового ревью фазы 2): модуль НЕ заводит своей
   подписки на 'activity'. Подписка на плагин ровно одна — LC.onActivityEvent
   в src/90_runtime.js; она же монтирует чипы сразу после LC.hero.mount.
   Причина: Subscribe.send вендора оборачивает весь цикл подписчиков одним
   try/catch, и исключение у более раннего подписчика оборвало бы рассылку
   всем следующим. install/uninstall остались гейтом настройки. */

test('install: своей подписки на activity не заводит', function () {
  var ctx = freshMoods();
  ctx.api.install();
  var cnt = ctx.listeners['activity'] ? ctx.listeners['activity'].length : 0;
  assert.equal(cnt, 0, 'вторая подписка на activity запрещена');
  ctx.api.uninstall();
});

test('install: монтирует чипы на уже открытую главную (возврат из настроек события не шлёт)', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.setActive({ component: 'main', activity: { render: function () { return root; } } });
  ctx.api.install();
  assert.equal(ctx.api.active(), true);
  ctx.api.uninstall();
});

test('install: открыта не главная — чипы не монтируются', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.setActive({ component: 'full', activity: { render: function () { return root; } } });
  ctx.api.install();
  assert.equal(ctx.api.active(), false);
});

test('uninstall: снимает чипы', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  ctx.api.mount(root);
  assert.equal(ctx.api.active(), true);
  ctx.api.uninstall();
  assert.equal(ctx.api.active(), false);
});

test('owns: true только для активности, которой принадлежит корень чипов', function () {
  var ctx = freshMoods();
  var root = makeMainRoot();
  var other = makeMainRoot();
  assert.equal(ctx.api.owns(root), false, 'до mount чипов нет');
  ctx.api.mount(root);
  assert.equal(ctx.api.owns(root), true);
  assert.equal(ctx.api.owns(other), false);
});

/* ====================================================================== */
/* Task 20: настройка «Профили настроения» (lumen_moods).                 */
/* ====================================================================== */

test('Task 20: настройка выключена — mount не вставляет чипы', function () {
  var s = freshMoods({ pref: function (name, def) { return name === 'lumen_moods' ? false : def; } });
  var root = makeMainRoot();
  s.api.mount(root);
  assert.equal(s.api.active(), false, 'чипов быть не должно');
});

test('Task 20: настройку выключили на смонтированных чипах — mount снимает их', function () {
  var on = true;
  var s = freshMoods({ pref: function (name, def) { return name === 'lumen_moods' ? on : def; } });
  var root = makeMainRoot();
  s.api.mount(root);
  assert.equal(s.api.active(), true);

  on = false;
  s.api.mount(makeMainRoot());
  assert.equal(s.api.active(), false);
});

test('Task 20: без LC.pref (старый профиль) чипы показываются', function () {
  var s = freshMoods();
  s.api.mount(makeMainRoot());
  assert.equal(s.api.active(), true);
});

test('Task 20: mountCurrent монтирует на уже открытую главную и молчит на чужом экране', function () {
  var s = freshMoods();
  var root = makeMainRoot();
  s.fakeLampa.Activity.active = function () { return { component: 'full', activity: { render: function () { return root; } } }; };
  s.api.mountCurrent();
  assert.equal(s.api.active(), false, 'не главная — монтировать нечего');

  s.fakeLampa.Activity.active = function () { return { component: 'main', activity: { render: function () { return root; } } }; };
  s.api.mountCurrent();
  assert.equal(s.api.active(), true);
});

/* Task 20 (найдено живой проверкой): чипы показывали английские названия при
   русском интерфейсе — язык брался из Lampa.Lang.code(), которого в Lampa
   3.3.4 нет, и moodTitle получал пустую строку. Теперь язык идёт через
   LC.langCode — тот же источник, что у заголовков хаба. */
test('Task 20: названия чипов — на языке интерфейса (LC.langCode)', function () {
  function titlesFor(langCode) {
    var s = freshMoods(langCode ? { langCode: function () { return langCode; } } : null);
    var root = makeMainRoot();
    s.api.mount(root);
    var textEl = root.find('lumen-hero__text');
    var moodsEl = null;
    for (var i = 0; i < textEl._children.length; i++) {
      if (textEl._children[i].hasClass('lumen-moods')) { moodsEl = textEl._children[i]; break; }
    }
    return moodsEl._children.map(function (c) { return c.text(); });
  }

  assert.deepEqual(titlesFor('ru'), ['Пятничный вечер', 'Семейный просмотр', 'Страшное на ночь', '90 минут']);
  assert.deepEqual(titlesFor('en'), ['Friday Evening', 'Family Viewing', 'Scary at Night', '90 Minutes']);
  /* Нет LC.langCode (модуль поднят в одиночку) — русские названия манифеста. */
  assert.deepEqual(titlesFor(null), ['Пятничный вечер', 'Семейный просмотр', 'Страшное на ночь', '90 минут']);
});

/* ====================================================================== */
/* Important 1 (fix-раунд итогового ревью фазы 2): источник настроений.    */
/*                                                                       */
/* Чипы обязаны брать настроения из ПОЛЬЗОВАТЕЛЬСКОГО каталога, если он   */
/* загружен. Прежний код звал LC.manifest.current() — такого метода в      */
/* публичном API модуля манифеста нет (current — приватная переменная,     */
/* наружу отдаются DEFAULT, validate, orderForMonth, isFresh, load, get),  */
/* ветка всегда была ложной и чипы всегда брали встроенный каталог.        */
/* Поэтому здесь НАСТОЯЩИЙ модуль манифеста, а не заглушка с current().    */
/* ====================================================================== */

/* Поднимает настоящий LC.manifest (src/42_manifest.js).
   customMoods !== null → каталог с этими настроениями лежит в кэше
   Lampa.Storage и будет загружен load()'ом (та же ветка, что живьём при
   свежем кэше пользовательского адреса). */
function realManifestModule(customMoods) {
  const prevLampa = globalThis.Lampa;
  const store = {};
  globalThis.Lampa = {
    Storage: {
      get: (k, d) => (k in store ? store[k] : d),
      set: (k, v) => { store[k] = v; }
    },
    Reguest: function () { return { silent: function () {} }; }
  };
  globalThis.window = { Lampa: globalThis.Lampa };
  const ctx = loadCtx('42_manifest.js', {
    pref: (k, d) => (k === 'lumen_manifest_url' ? 'https://example.test/manifest.json' : d)
  });
  if (customMoods) {
    const custom = Object.assign({}, ctx.api.DEFAULT, { moods: customMoods });
    store['lumen_manifest'] = { at: Date.now(), data: custom };
  }
  return { manifest: ctx.api, restore: () => { globalThis.Lampa = prevLampa; } };
}

/* Собирает названия чипов, смонтированных в root. */
function chipTitles(root) {
  const textEl = root.find('lumen-hero__text');
  let moodsEl = null;
  for (let i = 0; i < textEl._children.length; i++) {
    if (textEl._children[i].hasClass('lumen-moods')) { moodsEl = textEl._children[i]; break; }
  }
  if (!moodsEl) return [];
  const out = [];
  for (let j = 0; j < moodsEl._children.length; j++) {
    if (moodsEl._children[j].hasClass('lumen-mood-chip')) out.push(moodsEl._children[j].text());
  }
  return out;
}

test('Important 1: чипы берут настроения из загруженного пользовательского каталога', function () {
  const CUSTOM = [
    { id: 'rainy', title: 'Дождливый день', sources: { movie: { type: 'discover', params: {} } } },
    { id: 'road', title: 'В дорогу', sources: { movie: { type: 'discover', params: {} } } }
  ];
  const mf = realManifestModule(CUSTOM);
  try {
    let loaded = null;
    mf.manifest.load(function (m) { loaded = m; });
    assert.ok(loaded, 'манифест загружен из кэша');
    assert.deepEqual(loaded.moods.map((m) => m.id), ['rainy', 'road'], 'в каталоге пользовательские настроения');

    const ctx = freshMoods({ manifest: mf.manifest, langCode: () => 'ru' });
    const root = makeMainRoot();
    ctx.api.mount(root);
    assert.deepEqual(chipTitles(root), ['Дождливый день', 'В дорогу'],
      'чипы обязаны читать каталог через публичный LC.manifest.get()');
  } finally {
    mf.restore();
  }
});

test('Important 1: каталог не загружен — чипы берут встроенный DEFAULT', function () {
  const mf = realManifestModule(null);
  try {
    const ctx = freshMoods({ manifest: mf.manifest, langCode: () => 'ru' });
    const root = makeMainRoot();
    ctx.api.mount(root);
    const titles = chipTitles(root);
    assert.equal(titles.length, mf.manifest.DEFAULT.moods.length);
    assert.deepEqual(titles, mf.manifest.DEFAULT.moods.map((m) => m.title));
  } finally {
    mf.restore();
  }
});

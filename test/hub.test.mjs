import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const SOURCES = load('43_sources.js');
const H = loadCtx('46_hub.js', { sources: SOURCES, lang: function (k) { return k; } }).api;

/* Манифест для тестов хаба: 4 группы манифеста, 3 чипа хаба.
   Группа 'mood' в hubGroups не входит (профили настроения — Task 19),
   группа 'era' входит в чип, но не имеет ни одной подборки — чип пустой. */
var MANIFEST = {
  version: 1,
  home: ['star-wars'],
  groups: [
    { id: 'franchise', title: 'Франшизы' },
    { id: 'studio', title: 'Студии' },
    { id: 'service', title: 'Сервисы' },
    { id: 'era', title: 'Эпохи' },
    { id: 'mood', title: 'Настроение' }
  ],
  hubGroups: [
    { id: 'franchises', title: 'Франшизы', i18n: { en: 'Franchises', uk: 'Франшизи' }, groups: ['franchise'] },
    { id: 'studios', title: 'Студии и сервисы', i18n: { en: 'Studios & Services' }, groups: ['studio', 'service'] },
    { id: 'eras', title: 'Эпохи', groups: ['era'] }
  ],
  collections: [
    { id: 'star-wars', title: 'Звёздные войны', group: 'franchise', icon: 'film', sources: { movie: { type: 'collection', id: 10 }, tv: { type: 'discover', params: { keywords: 379196 } } } },
    { id: 'matrix', title: 'Матрица', group: 'franchise', sources: { movie: { type: 'collection', id: 2344 } } },
    { id: 'pixar', title: 'Pixar', group: 'studio', sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'popularity.desc' } } } },
    { id: 'apple-tv', title: 'Apple TV+', group: 'service', badge: 'APPLE TV+', sources: { tv: { type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc' } } } },
    { id: 'kp-top250', title: 'КП Топ-250', group: 'kp', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } },
    { id: 'mood-x', title: 'Настроенческая', group: 'mood', sources: { movie: { type: 'discover', params: {} } } }
  ]
};

// --- titleOf ---
test('titleOf: русский title по умолчанию, i18n по коду языка', function () {
  var g = MANIFEST.hubGroups[0];
  assert.equal(H.titleOf(g, 'ru'), 'Франшизы');
  assert.equal(H.titleOf(g, 'en'), 'Franchises');
  assert.equal(H.titleOf(g, 'uk'), 'Франшизи');
});
test('titleOf: нет перевода на язык — остаётся title', function () {
  assert.equal(H.titleOf(MANIFEST.hubGroups[1], 'uk'), 'Студии и сервисы');
  assert.equal(H.titleOf(MANIFEST.hubGroups[2], 'en'), 'Эпохи');
});
test('titleOf: пустой объект не роняет', function () {
  assert.equal(H.titleOf(null, 'ru'), '');
  assert.equal(H.titleOf({}, 'ru'), '');
});

// --- groupsWithCounts ---
test('groupsWithCounts: только непустые чипы, count по объединению групп', function () {
  var g = H.groupsWithCounts(MANIFEST, 'ru');
  assert.equal(g.length, 2, 'чип "Эпохи" пуст и не показывается');
  assert.deepEqual(g.map(function (x) { return x.id; }), ['franchises', 'studios']);
  assert.equal(g[0].count, 2);
  assert.equal(g[1].count, 2, 'studio + service считаются вместе');
  assert.equal(g[0].title, 'Франшизы');
});
test('groupsWithCounts: подборки групп вне hubGroups (kp/mood) не попадают ни в один чип', function () {
  var g = H.groupsWithCounts(MANIFEST, 'ru');
  var total = 0;
  for (var i = 0; i < g.length; i++) total += g[i].count;
  assert.equal(total, 4, 'kp-top250 и mood-x в чипы не входят');
});
test('groupsWithCounts: нет hubGroups/манифеста — пустой массив', function () {
  assert.deepEqual(H.groupsWithCounts(null, 'ru'), []);
  assert.deepEqual(H.groupsWithCounts({ collections: [] }, 'ru'), []);
  assert.deepEqual(H.groupsWithCounts({ hubGroups: [], collections: [] }, 'ru'), []);
});

// --- tilesFor ---
test('tilesFor: подборки чипа в порядке манифеста', function () {
  var t = H.tilesFor(MANIFEST, 'studios');
  assert.deepEqual(t.map(function (x) { return x.id; }), ['pixar', 'apple-tv']);
});
test('tilesFor: неизвестный чип — пусто', function () {
  assert.deepEqual(H.tilesFor(MANIFEST, 'nope'), []);
  assert.deepEqual(H.tilesFor(null, 'studios'), []);
});

// --- openTarget ---
test('openTarget: одиночный discover-источник — штатная сетка category_full', function () {
  var t = H.openTarget(MANIFEST.collections[2]); /* pixar, только movie/discover */
  assert.equal(t.component, 'category_full');
  assert.equal(t.source, 'tmdb');
  assert.equal(t.page, 1);
  assert.equal(t.title, 'Pixar');
  assert.equal(t.url, 'discover/movie?with_companies=3&sort_by=popularity.desc');
  assert.equal(t.lumen, undefined);
});
test('openTarget: одиночный discover для сериалов — discover/tv', function () {
  var t = H.openTarget(MANIFEST.collections[3]); /* apple-tv, только tv */
  assert.equal(t.component, 'category_full');
  assert.equal(t.url, 'discover/tv?with_networks=2552&sort_by=popularity.desc');
});
test('openTarget: коллекция TMDB — свой компонент lumen_grid', function () {
  var t = H.openTarget(MANIFEST.collections[1]); /* matrix, collection */
  assert.equal(t.component, 'lumen_grid');
  assert.equal(t.url, '');
  assert.equal(t.page, 1);
  assert.equal(t.lumen.id, 'matrix');
});
test('openTarget: два медиа-источника — свой компонент (штатная сетка одного url не даёт)', function () {
  var t = H.openTarget(MANIFEST.collections[0]); /* star-wars: movie+tv */
  assert.equal(t.component, 'lumen_grid');
  assert.equal(t.lumen.id, 'star-wars');
});
test('openTarget: Кинопоиск — свой компонент', function () {
  var t = H.openTarget(MANIFEST.collections[4]);
  assert.equal(t.component, 'lumen_grid');
});
test('openTarget: подборка без источников — свой компонент, без падения', function () {
  var t = H.openTarget({ id: 'broken', title: 'X', sources: {} });
  assert.equal(t.component, 'lumen_grid');
  assert.equal(t.title, 'X');
});

// --- franchiseItem ---
test('franchiseItem: belongs_to_collection → подборка для lumen_grid', function () {
  var item = H.franchiseItem({ id: 726871, name: 'Дюна — Коллекция' });
  assert.equal(item.id, 'col-726871');
  assert.equal(item.title, 'Дюна — Коллекция');
  assert.deepEqual(item.sources, { movie: { type: 'collection', id: 726871 } });
});
test('franchiseItem: нет id — null', function () {
  assert.equal(H.franchiseItem(null), null);
  assert.equal(H.franchiseItem({ name: 'X' }), null);
});

// --- sortModes / applySort / sortLocal ---
test('sortModes: три режима с ключами строк', function () {
  var m = H.sortModes();
  assert.deepEqual(m.map(function (x) { return x.id; }), ['popular', 'rating', 'new']);
  assert.equal(m[0].key, 'lumen_sort_popular');
});
test('applySort: discover-источники получают свой sort_by, оригинал не мутирует', function () {
  var src = MANIFEST.collections[2];
  var item = H.applySort(src, 'rating');
  assert.equal(item.sources.movie.params.sort_by, 'vote_average.desc');
  assert.equal(src.sources.movie.params.sort_by, 'popularity.desc', 'оригинал не тронут');
  assert.equal(item.sources.movie.params.companies, 3, 'остальные параметры сохранены');
});
test('applySort: для tv «Новые» — first_air_date.desc, для movie — primary_release_date.desc', function () {
  assert.equal(H.applySort(MANIFEST.collections[3], 'new').sources.tv.params.sort_by, 'first_air_date.desc');
  assert.equal(H.applySort(MANIFEST.collections[2], 'new').sources.movie.params.sort_by, 'primary_release_date.desc');
});
test('applySort: collection/list/kp не меняются (сортируются локально)', function () {
  var item = H.applySort(MANIFEST.collections[1], 'rating');
  assert.deepEqual(item.sources.movie, { type: 'collection', id: 2344 });
});
test('applySort: неизвестный режим возвращает подборку как есть', function () {
  assert.equal(H.applySort(MANIFEST.collections[2], 'nope').sources.movie.params.sort_by, 'popularity.desc');
});
test('sortLocal: rating/new/popular, копия массива', function () {
  var list = [
    { id: 1, popularity: 5, vote_average: 9, release_date: '1999-03-30' },
    { id: 2, popularity: 50, vote_average: 4, release_date: '2021-12-22' },
    { id: 3, popularity: 20, vote_average: 7, first_air_date: '2010-01-01' }
  ];
  assert.deepEqual(H.sortLocal(list, 'popular').map(function (x) { return x.id; }), [2, 3, 1]);
  assert.deepEqual(H.sortLocal(list, 'rating').map(function (x) { return x.id; }), [1, 3, 2]);
  assert.deepEqual(H.sortLocal(list, 'new').map(function (x) { return x.id; }), [2, 3, 1]);
  assert.equal(list[0].id, 1, 'исходный массив не переставлен');
});
test('sortLocal: пустое/мусор не роняет', function () {
  assert.deepEqual(H.sortLocal(null, 'rating'), []);
  assert.deepEqual(H.sortLocal([{ id: 1 }], 'nope').map(function (x) { return x.id; }), [1]);
});

// --- needsLocalSort ---
test('needsLocalSort: true для collection/list/kp, false для чистого discover', function () {
  assert.equal(H.needsLocalSort(MANIFEST.collections[1]), true);
  assert.equal(H.needsLocalSort(MANIFEST.collections[4]), true);
  assert.equal(H.needsLocalSort(MANIFEST.collections[2]), false);
  assert.equal(H.needsLocalSort(MANIFEST.collections[0]), true, 'смешанная подборка с коллекцией');
});

// --- collage ---
test('collage: до трёх постеров из результатов, пустые пропускаются', function () {
  var res = [{ poster_path: '/a.jpg' }, { poster_path: null }, { poster_path: '/b.jpg' }, { poster_path: '/c.jpg' }, { poster_path: '/d.jpg' }];
  assert.deepEqual(H.collage(res, 3), ['/a.jpg', '/b.jpg', '/c.jpg']);
  assert.deepEqual(H.collage([], 3), []);
  assert.deepEqual(H.collage(null, 3), []);
});

// --- cardMedia ---
test('cardMedia: media_type приоритетнее эвристики, иначе name → tv', function () {
  assert.equal(H.cardMedia({ media_type: 'tv', title: 'X' }), 'tv');
  assert.equal(H.cardMedia({ name: 'Фоллаут' }), 'tv');
  assert.equal(H.cardMedia({ title: 'Дюна' }), 'movie');
  assert.equal(H.cardMedia(null), 'movie');
});

// --- hasMore ---
test('hasMore: страница меньше общего числа страниц', function () {
  assert.equal(H.hasMore({ page: 1, total_pages: 3 }), true);
  assert.equal(H.hasMore({ page: 3, total_pages: 3 }), false);
  assert.equal(H.hasMore({ page: 1, total_pages: 1 }), false);
  assert.equal(H.hasMore(null), false);
});

/* ====================================================================== */
/* Runtime: компоненты lumen_hub / lumen_grid, пункт меню, кнопка         */
/* «Франшиза». Фейковые Lampa и jQuery — ровно тот минимум, которым       */
/* пользуется src/46_hub.js.                                              */
/* ====================================================================== */

var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

/* --- минимальный jQuery --- */
function El(classes) {
  this._class = classes || [];
  this._children = [];
  this._parent = null;
  this._ev = {};
  this._css = {};
  this._removed = false;
  this.length = 1;
  this[0] = this;
}
El.prototype.addClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { if (c && self._class.indexOf(c) < 0) self._class.push(c); });
  return this;
};
El.prototype.removeClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { var i = self._class.indexOf(c); if (i >= 0) self._class.splice(i, 1); });
  return this;
};
El.prototype.toggleClass = function (c, on) { return on ? this.addClass(c) : this.removeClass(c); };
El.prototype.hasClass = function (c) { return this._class.indexOf(c) >= 0; };
El.prototype.append = function (child) {
  var el = child instanceof El ? child : new El(classesOf(child));
  if (el._parent) el._parent._children.splice(el._parent._children.indexOf(el), 1);
  el._parent = this;
  this._children.push(el);
  return this;
};
El.prototype.empty = function () { this._children = []; return this; };
El.prototype.remove = function () {
  this._removed = true;
  if (this._parent) {
    var i = this._parent._children.indexOf(this);
    if (i >= 0) this._parent._children.splice(i, 1);
    this._parent = null;
  }
  return this;
};
El.prototype.parent = function () { return this._parent || EMPTY_EL; };
El.prototype.closest = function (sel) {
  var want = sel.replace(/^\./, '');
  for (var el = this; el; el = el._parent) {
    if (el.hasClass(want) || (sel === 'body' && el._isBody)) return el;
  }
  return EMPTY_EL;
};
El.prototype.find = function (sel) {
  var want = sel.replace(/^\./, '');
  function search(node) {
    for (var i = 0; i < node._children.length; i++) {
      if (node._children[i].hasClass(want)) return node._children[i];
      var deep = search(node._children[i]);
      if (deep) return deep;
    }
    return null;
  }
  return search(this) || EMPTY_EL;
};
El.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
El.prototype.html = function (text) { this._html = text; return this; };
El.prototype.on = function (name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return this; };
El.prototype.all = function (cls) {
  var out = [];
  (function walk(node) {
    for (var i = 0; i < node._children.length; i++) {
      if (node._children[i].hasClass(cls)) out.push(node._children[i]);
      walk(node._children[i]);
    }
  })(this);
  return out;
};

var EMPTY_EL = new El([]);
EMPTY_EL.length = 0;

function classesOf(html) {
  var m = /class="([^"]*)"/.exec('' + html);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function fire(node, name) {
  var el = node instanceof El ? node : node[0];
  var list = el._ev[name] || [];
  for (var i = 0; i < list.length; i++) list[i]();
}

/* $(html) — первый тег корнем, остальные плоско его детьми (вложенность
   нашей разметке не нужна: все поиски идут по классу внутри плитки). */
function make$(doc) {
  return function (arg) {
    if (arg instanceof El) return arg;
    if (typeof arg === 'string' && arg.charAt(0) === '<') {
      var tags = arg.match(/<div[^>]*>|<span[^>]*>/g) || [];
      var root = new El(classesOf(tags[0]));
      for (var i = 1; i < tags.length; i++) root.append(new El(classesOf(tags[i])));
      return root;
    }
    if (typeof arg === 'string') {
      var want = arg.replace(/^\./, '');
      var found = doc.body.all(want);
      if (found.length) return found[0];
      var none = new El([]);
      none.length = 0;
      return none;
    }
    return arg;
  };
}

/* --- фейковая Lampa --- */
function setupLampa(opts) {
  opts = opts || {};
  var doc = { body: new El(['body']) };
  doc.body._isBody = true;

  var log = {
    components: {},
    pushes: [],
    controllers: {},
    toggles: [],
    collectionSets: [],
    focuses: [],
    menuButtons: [],
    backward: 0,
    scrolls: []
  };

  function Scroll(params) {
    var body = new El(['scroll__body']);
    var self = this;
    this.params = params;
    this.destroyed = false;
    this.updates = [];
    this.append = function (el) { body.append(el); };
    this.render = function () { return body; };
    this.body = function () { return body; };
    this.clear = function () { body.empty(); };
    this.update = function (el) { self.updates.push(el); };
    this.destroy = function () { self.destroyed = true; };
    log.scrolls.push(this);
  }

  var Lampa = {
    Scroll: Scroll,
    Component: { add: function (name, fn) { log.components[name] = fn; } },
    Controller: {
      add: function (name, ctrl) { log.controllers[name] = ctrl; },
      toggle: function (name) { log.toggles.push(name); },
      collectionSet: function (root) { log.collectionSets.push(root); },
      collectionFocus: function (node) { log.focuses.push(node); },
      enabled: function () { return { name: 'content' }; }
    },
    Activity: {
      push: function (o) { log.pushes.push(o); },
      backward: function () { log.backward++; },
      active: function () { return opts.active || {}; }
    },
    Menu: {
      addButton: function (icon, title, action) {
        var node = new El(['menu__item', 'selector']);
        node._title = title;
        node.on('hover:enter', action);
        doc.body.append(node);
        log.menuButtons.push(node);
        return node;
      }
    },
    TMDB: { image: function (url) { return 'https://proxy/' + url; } },
    Storage: { get: function (k, d) { return d; }, set: function () {} }
  };

  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  globalThis.$ = make$(doc);
  return { log: log, doc: doc, Lampa: Lampa };
}

/* Загружает LC.hub в чистый контекст с подставленными зависимостями.
   fetchCalls — журнал вызовов LC.sources.fetch: у каждого есть ok/err и
   cleared (ставится, когда компонент отменил запрос). */
function loadHub(opts) {
  opts = opts || {};
  var fetchCalls = [];
  var sources = {
    discoverUrl: SOURCES.discoverUrl,
    'fetch': function (item, page, ok, err, alive) {
      var call = { item: item, page: page, ok: ok, err: err, alive: alive, cleared: false };
      fetchCalls.push(call);
      return { clear: function () { call.cleared = true; } };
    }
  };
  var ctx = loadCtx('46_hub.js', {
    sources: sources,
    lang: function (k) { return k; },
    langCode: function () { return 'ru'; },
    collectionsWord: function () { return 'подборок'; },
    motionMode: function () { return opts.motion || 'full'; },
    icons: { get: function () { return '<svg></svg>'; } },
    cardinfo: { imageUrl: function (path) { return path ? 'https://proxy/t/p/w342' + path : ''; } },
    manifest: { load: function (cb) { cb(MANIFEST); } }
  });
  return { api: ctx.api, LC: ctx.LC, fetchCalls: fetchCalls };
}

/* Фейковая activity компонента: журнал loader(). */
function fakeActivity() {
  var states = [];
  return { loader: function (on) { states.push(!!on); }, states: states, render: function () { return null; } };
}

function makeComponent(name, object, env) {
  var Comp = env.log.components[name];
  var comp = new Comp(object || {});
  comp.activity = fakeActivity();
  return comp;
}

// --- install / uninstall ---
test('install: регистрирует компоненты lumen_hub и lumen_grid и один пункт меню', function () {
  var env = setupLampa();
  var h = loadHub();
  warnLog.length = 0;
  h.api.install();
  assert.equal(typeof env.log.components.lumen_hub, 'function');
  assert.equal(typeof env.log.components.lumen_grid, 'function');
  assert.equal(env.log.menuButtons.length, 1);
  assert.equal(env.log.menuButtons[0]._title, 'lumen_hub_title');
  assert.ok(env.log.menuButtons[0].hasClass('lumen-menu-hub'), 'пункт помечен своим классом');
  assert.deepEqual(warnLog, []);
});
test('install: повторный вызов второй пункт меню не заводит', function () {
  var env = setupLampa();
  var h = loadHub();
  h.api.install();
  h.api.install();
  h.api.install();
  assert.equal(env.log.menuButtons.length, 1);
});
test('uninstall: пункт меню снимается', function () {
  var env = setupLampa();
  var h = loadHub();
  h.api.install();
  var node = env.log.menuButtons[0];
  h.api.uninstall();
  assert.equal(node._removed, true);
  assert.equal(h.api.menuNode(), null);
});
test('install после uninstall возвращает пункт меню', function () {
  var env = setupLampa();
  var h = loadHub();
  h.api.install();
  h.api.uninstall();
  h.api.install();
  assert.equal(env.log.menuButtons.length, 2, 'второй пункт добавлен уже после снятия первого');
  assert.equal(env.log.menuButtons[0]._removed, true);
});
test('пункт меню открывает активность lumen_hub', function () {
  var env = setupLampa();
  var h = loadHub();
  h.api.install();
  fire(env.log.menuButtons[0], 'hover:enter');
  assert.equal(env.log.pushes.length, 1);
  assert.equal(env.log.pushes[0].component, 'lumen_hub');
  assert.equal(env.log.pushes[0].page, 1);
});

// --- компонент lumen_hub ---
function openHub(opts) {
  var env = setupLampa(opts);
  var h = loadHub(opts);
  h.api.install();
  var comp = makeComponent('lumen_hub', {}, env);
  comp.create();
  return { env: env, h: h, comp: comp };
}

test('lumen_hub: create строит чипы групп и плитки первой группы, лоадер гаснет', function () {
  warnLog.length = 0;
  var s = openHub();
  var scroll = s.env.log.scrolls[0];
  var root = scroll.body()._children[0];
  assert.ok(root.hasClass('lumen-hub'));
  assert.ok(root.hasClass('lumen-motion-full'), 'режим анимаций зеркалится на корень экрана');
  assert.equal(root.all('lumen-chip').length, 2, 'пустой чип «Эпохи» не показывается');
  assert.equal(root.all('lumen-tile').length, 2, 'плитки первой группы (Франшизы)');
  assert.deepEqual(s.comp.activity.states, [true, false], 'лоадер включился и погас');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: коллажи запрашиваются для видимых плиток первой группы', function () {
  var s = openHub();
  assert.equal(s.h.fetchCalls.length, 2);
  assert.equal(s.h.fetchCalls[0].page, 1);
});

test('lumen_hub: пришедшие постеры становятся коллажем плитки', function () {
  var s = openHub();
  s.h.fetchCalls[0].ok({ results: [{ poster_path: '/a.jpg' }, { poster_path: '/b.jpg' }, { poster_path: '/c.jpg' }, { poster_path: '/d.jpg' }] });
  var tile = s.env.log.scrolls[0].body()._children[0].all('lumen-tile')[0];
  var posters = tile.all('lumen-tile__poster');
  assert.equal(posters.length, 3, 'коллаж из трёх постеров');
  assert.ok(('' + posters[0].css('background-image')).indexOf('https://proxy/t/p/w342/a.jpg') !== -1);
  assert.ok(tile.hasClass('lumen-tile--filled'));
});

test('lumen_hub: подборка Кинопоиска без ключа помечается на плитке', function () {
  var s = openHub();
  s.h.fetchCalls[0].err({ nokey: true });
  var tile = s.env.log.scrolls[0].body()._children[0].all('lumen-tile')[0];
  assert.ok(tile.hasClass('lumen-tile--nokey'));
});

test('lumen_hub: start ставит свой контроллер content и включает его', function () {
  var s = openHub();
  s.comp.start();
  assert.ok(s.env.log.controllers.content, 'контроллер content зарегистрирован');
  assert.equal(s.env.log.toggles[s.env.log.toggles.length - 1], 'content');
  assert.equal(typeof s.env.log.controllers.content.right, 'function', 'вправо обязателен: Lampa сама фокус не двигает');
});

test('lumen_hub: пульт — чипы по горизонтали, вниз в плитки, вверх обратно', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  var first = s.env.log.focuses[s.env.log.focuses.length - 1];
  assert.ok(first.hasClass('lumen-chip'), 'первый фокус — на чипе группы');
  ctrl.right();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-chip'));
  ctrl.down();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-tile'), 'вниз — на плитку');
  ctrl.up();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-chip'), 'вверх — обратно на чип');
});

test('lumen_hub: переход между рядами возвращает фокус туда, откуда ушли', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  ctrl.right();                       /* второй чип */
  var chip = s.env.log.focuses[s.env.log.focuses.length - 1];
  ctrl.down();                        /* первая плитка */
  ctrl.right();                       /* вторая плитка */
  var tile = s.env.log.focuses[s.env.log.focuses.length - 1];
  ctrl.up();
  assert.equal(s.env.log.focuses[s.env.log.focuses.length - 1], chip, 'вверх — на тот же чип, а не на соседний по столбцу');
  ctrl.down();
  assert.equal(s.env.log.focuses[s.env.log.focuses.length - 1], tile, 'вниз — на ту же плитку');
});

test('lumen_hub: влево с первого элемента уводит в меню, вверх с чипов — в шапку', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  s.env.log.toggles.length = 0;
  ctrl.left();
  assert.deepEqual(s.env.log.toggles, ['menu']);
  s.env.log.toggles.length = 0;
  ctrl.up();
  assert.deepEqual(s.env.log.toggles, ['head']);
});

test('lumen_hub: назад возвращает на предыдущую активность', function () {
  var s = openHub();
  s.comp.start();
  s.env.log.controllers.content.back();
  assert.equal(s.env.log.backward, 1);
});

test('lumen_hub: смена группы перестраивает плитки и оставляет фокус на чипе', function () {
  var s = openHub();
  s.comp.start();
  var root = s.env.log.scrolls[0].body()._children[0];
  var chips = root.all('lumen-chip');
  fire(chips[1], 'hover:enter');
  assert.equal(root.all('lumen-tile').length, 2, 'плитки чипа «Студии и сервисы»');
  assert.ok(chips[1].hasClass('lumen-chip--on'));
  assert.equal(chips[0].hasClass('lumen-chip--on'), false);
  assert.equal(s.env.log.focuses[s.env.log.focuses.length - 1], chips[1], 'фокус остался на выбранном чипе');
});

test('lumen_hub: плитка открывает подборку через openTarget', function () {
  var s = openHub();
  s.comp.start();
  var tile = s.env.log.scrolls[0].body()._children[0].all('lumen-tile')[0];
  s.env.log.pushes.length = 0;
  fire(tile, 'hover:enter');
  assert.equal(s.env.log.pushes.length, 1);
  assert.equal(s.env.log.pushes[0].component, 'lumen_grid', 'у «Звёздных войн» два медиа-источника');
  assert.equal(s.env.log.pushes[0].lumen.id, 'star-wars');
});

test('lumen_hub: destroy гасит незавершённые запросы, скролл и DOM', function () {
  var s = openHub();
  s.comp.start();
  var scroll = s.env.log.scrolls[0];
  var root = scroll.body()._children[0];
  var pending = s.h.fetchCalls[0];
  s.comp.destroy();
  assert.equal(pending.cleared, true, 'запрос коллажа отменён');
  assert.equal(scroll.destroyed, true);
  assert.equal(root._removed, true);
});

test('lumen_hub: ответ, доехавший после destroy, в DOM не пишет', function () {
  var s = openHub();
  s.comp.start();
  var root = s.env.log.scrolls[0].body()._children[0];
  var pending = s.h.fetchCalls[0];
  s.comp.destroy();
  warnLog.length = 0;
  pending.ok({ results: [{ poster_path: '/late.jpg' }] });
  assert.equal(root.all('lumen-tile__poster').length, 0, 'поколение съело поздний ответ');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: alive-сторож ложен после destroy', function () {
  var s = openHub();
  var alive = s.h.fetchCalls[0].alive;
  assert.equal(alive(), true);
  s.comp.destroy();
  assert.equal(alive(), false);
});

// --- компонент lumen_grid ---
function openGrid(item, opts) {
  var env = setupLampa(opts);
  var h = loadHub(opts);
  h.api.install();
  var comp = makeComponent('lumen_grid', { lumen: item, title: item.title }, env);
  comp.create();
  return { env: env, h: h, comp: comp, root: env.log.scrolls[0].body()._children[0] };
}

var COLLECTION = MANIFEST.collections[1]; /* matrix: type collection */
var DISCOVER = MANIFEST.collections[2];   /* pixar: type discover */

function results(n, from) {
  var out = [];
  for (var i = 0; i < n; i++) {
    out.push({
      id: (from || 0) + i,
      title: 'Фильм ' + ((from || 0) + i),
      poster_path: '/p' + i + '.jpg',
      release_date: '2020-01-01',
      vote_average: 7
    });
  }
  return out;
}

test('lumen_grid: create запрашивает первую страницу и рисует карточки', function () {
  warnLog.length = 0;
  var g = openGrid(COLLECTION);
  assert.equal(g.h.fetchCalls.length, 1);
  assert.equal(g.h.fetchCalls[0].page, 1);
  assert.deepEqual(g.comp.activity.states, [true], 'лоадер включён до ответа');
  g.h.fetchCalls[0].ok({ results: results(9), page: 1, total_pages: 1, total_results: 9 });
  assert.equal(g.root.all('lumen-gcard').length, 9);
  assert.deepEqual(g.comp.activity.states, [true, false]);
  assert.deepEqual(warnLog, []);
});

test('lumen_grid: данные карточки лежат в card_data узла', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: results(2), page: 1, total_pages: 1, total_results: 2 });
  assert.equal(g.root.all('lumen-gcard')[0].card_data.id, 0);
});

test('lumen_grid: OK на карточке открывает полную карточку', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: results(2), page: 1, total_pages: 1, total_results: 2 });
  g.comp.start();
  g.env.log.pushes.length = 0;
  fire(g.root.all('lumen-gcard')[1], 'hover:enter');
  assert.equal(g.env.log.pushes.length, 1);
  assert.equal(g.env.log.pushes[0].component, 'full');
  assert.equal(g.env.log.pushes[0].id, 1);
  assert.equal(g.env.log.pushes[0].method, 'movie');
});

test('lumen_grid: коллекция сортируется на месте, без нового запроса', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({
    results: [{ id: 1, title: 'A', vote_average: 5 }, { id: 2, title: 'B', vote_average: 9 }],
    page: 1, total_pages: 1, total_results: 2
  });
  g.comp.start();
  var chips = g.root.all('lumen-chip');
  assert.equal(chips.length, 3, 'три чипа сортировки');
  assert.equal(g.root.all('lumen-gcard')[0].card_data.id, 1, 'исходный порядок — хронологический');
  fire(chips[1], 'hover:enter'); /* по рейтингу */
  assert.equal(g.h.fetchCalls.length, 1, 'коллекция уже загружена целиком — в сеть не идём');
  assert.equal(g.root.all('lumen-gcard').length, 2, 'список перестроен, а не дополнен');
  assert.equal(g.root.all('lumen-gcard')[0].card_data.id, 2, 'первым — с большим рейтингом');
  assert.ok(chips[1].hasClass('lumen-chip--on'));
});

test('lumen_grid: у discover-подборки смена сортировки уходит в запрос через sort_by', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(3), page: 1, total_pages: 2, total_results: 40 });
  g.comp.start();
  fire(g.root.all('lumen-chip')[1], 'hover:enter');
  assert.equal(g.h.fetchCalls.length, 2);
  assert.equal(g.h.fetchCalls[1].item.sources.movie.params.sort_by, 'vote_average.desc');
  assert.equal(g.h.fetchCalls[1].page, 1);
});

test('lumen_grid: следующая страница грузится, когда фокус дошёл до последней строки', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(12), page: 1, total_pages: 3, total_results: 60 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  assert.equal(g.h.fetchCalls.length, 1, 'на чипах сортировки ничего не грузится');
  ctrl.down(); /* первая строка из двух */
  assert.equal(g.h.fetchCalls.length, 1);
  ctrl.down(); /* вторая строка — последняя */
  assert.equal(g.h.fetchCalls.length, 2, 'дошли до последней строки — грузим следующую страницу');
  assert.equal(g.h.fetchCalls[1].page, 2);
  g.h.fetchCalls[1].ok({ results: results(12, 100), page: 2, total_pages: 3, total_results: 60 });
  assert.equal(g.root.all('lumen-gcard').length, 24, 'страница дописана к списку');
});

test('lumen_grid: последняя страница следующую не запрашивает', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(6), page: 1, total_pages: 1, total_results: 6 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  ctrl.down();
  assert.equal(g.h.fetchCalls.length, 1);
});

test('lumen_grid: пустой ответ показывает заглушку с кнопкой «Назад»', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: [], page: 1, total_pages: 1, total_results: 0 });
  g.comp.start();
  var back = g.root.all('lumen-grid__back');
  assert.equal(back.length, 1, 'в пустом экране обязан остаться хотя бы один .selector');
  fire(back[0], 'hover:enter');
  assert.equal(g.env.log.backward, 1);
});

test('lumen_grid: ошибка «нет ключа» объясняет, чего не хватает', function () {
  var g = openGrid(MANIFEST.collections[4]); /* kp */
  warnLog.length = 0;
  g.h.fetchCalls[0].err({ nokey: true });
  assert.equal(g.root.all('lumen-grid__empty-text').length, 1);
  assert.deepEqual(g.comp.activity.states, [true, false], 'лоадер гаснет и на ошибке');
  assert.deepEqual(warnLog, []);
});

test('lumen_grid: destroy гасит запрос, скролл и DOM', function () {
  var g = openGrid(DISCOVER);
  var scroll = g.env.log.scrolls[0];
  var pending = g.h.fetchCalls[0];
  g.comp.destroy();
  assert.equal(pending.cleared, true);
  assert.equal(scroll.destroyed, true);
  assert.equal(g.root._removed, true);
});

test('lumen_grid: пришедшая страница сама себя не догружает', function () {
  /* Живая проверка на «Супергероях» поймала обратное: фокус после каждой
     пришедшей страницы ставился программно, тот же код грузил следующую, и
     сетка набрала 320 карточек за один заход. Догрузка обязана идти только
     от пульта. */
  var g = openGrid(DISCOVER);
  g.comp.start();
  g.env.log.controllers.content.toggle();
  for (var i = 0; i < 5; i++) {
    var call = g.h.fetchCalls[g.h.fetchCalls.length - 1];
    call.ok({ results: results(12, i * 100), page: i + 1, total_pages: 9, total_results: 300 });
  }
  assert.equal(g.h.fetchCalls.length, 1, 'ни одного запроса сверх первого');
  assert.equal(g.env.log.scrolls[0].onEnd, undefined, 'на onEnd скролла догрузка не вешается');
});

test('lumen_grid: ответ после destroy карточек не рисует', function () {
  var g = openGrid(DISCOVER);
  var pending = g.h.fetchCalls[0];
  g.comp.destroy();
  warnLog.length = 0;
  pending.ok({ results: results(5), page: 1, total_pages: 1, total_results: 5 });
  assert.equal(g.root.all('lumen-gcard').length, 0);
  assert.deepEqual(warnLog, []);
});

// --- кнопка «Франшиза» ---
function cardRoot() {
  var root = new El(['full-start-new', 'lumen-card']);
  var actions = new El(['lumen-in', 'lumen-actions']);
  var buttons = new El(['full-start-new__buttons']);
  var container = new El(['buttons--container']);
  buttons.append(container);
  actions.append(buttons);
  root.append(actions);
  return { root: root, actions: actions, buttons: buttons, container: container };
}

test('франшиза: кнопка — сосед ряда кнопок, внутрь групп кнопок не попадает', function () {
  setupLampa();
  var h = loadHub();
  var c = cardRoot();
  warnLog.length = 0;
  h.api.franchise(c.root, { belongs_to_collection: { id: 726871, name: 'Дюна — Коллекция' } });
  var btns = c.actions.all('lumen-franchise');
  assert.equal(btns.length, 1, 'кнопка добавлена в .lumen-actions');
  assert.equal(c.buttons.all('lumen-franchise').length, 0, 'внутри ряда кнопок её быть не должно');
  assert.equal(c.container.all('lumen-franchise').length, 0, 'внутри .buttons--container — тем более (хэш приоритета)');
  assert.ok(btns[0].hasClass('selector'), 'кнопка доступна пультом');
  assert.ok(c.root.hasClass('lumen-card--franchise'), 'класс корня включает раскладку строки');
  assert.deepEqual(warnLog, []);
});

test('франшиза: без belongs_to_collection кнопки нет и класс снят', function () {
  setupLampa();
  var h = loadHub();
  var c = cardRoot();
  h.api.franchise(c.root, { belongs_to_collection: { id: 10, name: 'X' } });
  h.api.franchise(c.root, { id: 5 });
  assert.equal(c.actions.all('lumen-franchise').length, 0);
  assert.equal(c.root.hasClass('lumen-card--franchise'), false);
});

test('франшиза: повторный вызов кнопку не дублирует', function () {
  setupLampa();
  var h = loadHub();
  var c = cardRoot();
  h.api.franchise(c.root, { belongs_to_collection: { id: 10, name: 'X' } });
  h.api.franchise(c.root, { belongs_to_collection: { id: 10, name: 'X' } });
  assert.equal(c.actions.all('lumen-franchise').length, 1);
});

test('франшиза: OK открывает сетку коллекции этого фильма', function () {
  var env = setupLampa();
  var h = loadHub();
  var c = cardRoot();
  h.api.franchise(c.root, { belongs_to_collection: { id: 726871, name: 'Дюна — Коллекция' } });
  fire(c.actions.all('lumen-franchise')[0], 'hover:enter');
  assert.equal(env.log.pushes.length, 1);
  assert.equal(env.log.pushes[0].component, 'lumen_grid');
  assert.equal(env.log.pushes[0].title, 'Дюна — Коллекция');
  assert.deepEqual(env.log.pushes[0].lumen.sources, { movie: { type: 'collection', id: 726871 } });
});

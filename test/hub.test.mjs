import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const SOURCES = load('43_sources.js');
/* Task 21: сезонный порядок плиток хаб берёт у LC.manifest.orderForMonth. */
const MANIFEST_MOD = load('42_manifest.js');
const H = loadCtx('46_hub.js', { sources: SOURCES, manifest: MANIFEST_MOD, lang: function (k) { return k; } }).api;

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
/* «Франшиза». Фейковые Lampa, Navigator и jQuery — ровно тот минимум,    */
/* которым пользуется src/46_hub.js.                                      */
/* ====================================================================== */

var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

/* --- минимальный jQuery --- */
function El(classes, tag) {
  this._tag = tag || 'div';
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
El.prototype.end = function () { return this._end || this; };
El.prototype.closest = function (sel) {
  var want = sel.replace(/^\./, '');
  for (var el = this; el; el = el._parent) {
    if (el.hasClass(want) || (sel === 'body' && el._isBody)) return el;
  }
  return EMPTY_EL;
};
El.prototype.contains = function (node) {
  if (this === node) return true;
  for (var i = 0; i < this._children.length; i++) {
    if (this._children[i].contains(node)) return true;
  }
  return false;
};
El.prototype.find = function (sel) {
  var found = this.all(sel);
  if (!found.length) return EMPTY_EL;
  var set = found[0];
  set._end = this;
  return set;
};
El.prototype.querySelector = function (sel) {
  var found = this.all(sel);
  return found.length ? found[0] : null;
};
El.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
El.prototype.html = function (text) { this._html = text; return this; };
El.prototype.text = function (t) { if (!arguments.length) return this._text || ''; this._text = '' + t; return this; };
El.prototype.on = function (name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return this; };
/* Селектор по классу ('.x' или 'x') либо по тегу ('span') — настоящий
   jQuery в src/46_hub.js используется и так, и так. */
El.prototype.all = function (sel) {
  /* Тегами в разметке плагина ищется только <span> (текст метки карточки);
     всё остальное — классы, с точкой или без. */
  var byTag = sel === 'span' ? 'span' : null;
  var cls = sel.replace(/^\./, '');
  var out = [];
  (function walk(node) {
    for (var i = 0; i < node._children.length; i++) {
      var c = node._children[i];
      if (byTag ? c._tag === byTag : c.hasClass(cls)) out.push(c);
      walk(c);
    }
  })(this);
  return out;
};

var EMPTY_EL = new El([]);
EMPTY_EL.length = 0;

function tagOf(html) {
  var m = /^<([a-z]+)/.exec('' + html);
  return m ? m[1] : 'div';
}

function classesOf(html) {
  var m = /class="([^"]*)"/.exec('' + html);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function fire(node, name) {
  var el = node instanceof El ? node : node[0];
  var list = el._ev[name] || [];
  for (var i = 0; i < list.length; i++) list[i]();
}

function make$(doc) {
  return function (arg) {
    if (arg instanceof El) return arg;
    if (typeof arg === 'string' && arg.charAt(0) === '<') {
      var tags = arg.match(/<div[^>]*>|<span[^>]*>/g) || [];
      var root = new El(classesOf(tags[0]), tagOf(tags[0]));
      for (var i = 1; i < tags.length; i++) root.append(new El(classesOf(tags[i]), tagOf(tags[i])));
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

/* Штатный шаблон карточки Lampa (app.min.js 2510) — те узлы, которые
   использует src/46_hub.js. */
function cardTemplate(vars) {
  var card = new El(['card', 'selector', 'layer--visible', 'layer--render']);
  var view = new El(['card__view']);
  var img = new El(['card__img']);
  var icons = new El(['card__icons']);
  var inner = new El(['card__icons-inner']);
  icons.append(inner);
  view.append(img);
  view.append(icons);
  card.append(view);
  card.append(new El(['card__title']).text(vars.title || ''));
  card.append(new El(['card__age']).text(vars.release_year || ''));
  return card;
}

/* --- фейковая Lampa + Navigator --- */
function setupLampa(opts) {
  opts = opts || {};
  var doc = { body: new El(['body']) };
  doc.body._isBody = true;

  var log = {
    components: {},
    pushes: [],
    controllers: {},
    toggles: [],
    focuses: [],
    menuButtons: [],
    backward: 0,
    scrolls: [],
    /* Task 20: записи в Lampa.Storage (кнопка «Скрыть» подсказки про ключ). */
    stored: [],
    favorite: opts.favorite || {},
    timeline: opts.timeline || {}
  };

  /* Модель SpatialNavigator: линейная коллекция .selector, шаг вправо/влево
     ±1, вверх/вниз ±cols. Геометрию он считает по-настоящему, но контракт,
     который проверяют тесты, тот же: canmove=false на краю — и контроллер
     уводит фокус в меню/шапку. */
  var nav = {
    collection: [],
    index: -1,
    cols: opts.cols || 6,
    canmove: function (dir) { return nav.target(dir) >= 0; },
    target: function (dir) {
      if (nav.index < 0) return -1;
      var n = nav.index;
      if (dir === 'right') n = nav.index + 1;
      else if (dir === 'left') n = nav.index - 1;
      else if (dir === 'down') n = nav.index + nav.cols;
      else if (dir === 'up') n = nav.index - nav.cols;
      if (n < 0 || n > nav.collection.length - 1) return -1;
      return n;
    },
    move: function (dir) {
      var n = nav.target(dir);
      if (n < 0) return false;
      nav.focus(nav.collection[n]);
      return true;
    },
    focus: function (el) {
      var i = nav.collection.indexOf(el);
      if (i < 0) return false;
      nav.index = i;
      log.focuses.push(el);
      fire(el, 'hover:focus');
      return true;
    }
  };
  globalThis.Navigator = nav;

  function Scroll(params) {
    var body = new El(['scroll__body']);
    var self = this;
    this.params = params;
    this.destroyed = false;
    this.append = function (el) { body.append(el); };
    this.render = function () { return body; };
    this.body = function () { return body; };
    this.clear = function () { body.empty(); };
    this.update = function () {};
    this.destroy = function () { self.destroyed = true; };
    log.scrolls.push(this);
  }

  var Lampa = {
    Scroll: Scroll,
    Component: { add: function (name, fn) { log.components[name] = fn; } },
    Template: { js: function (name, vars) { return cardTemplate(vars || {}); } },
    Lang: { translate: function (k) { return k; } },
    Favorite: { check: function (card) { return log.favorite[card.id] || {}; } },
    Timeline: { view: function (hash) { return log.timeline[hash] || null; } },
    Utils: { hash: function (s) { return 'h:' + s; } },
    Controller: {
      add: function (name, ctrl) { log.controllers[name] = ctrl; },
      toggle: function (name) { log.toggles.push(name); },
      collectionSet: function (root) { nav.collection = root.all('selector'); nav.index = -1; },
      collectionFocus: function (node) {
        if (node && nav.collection.indexOf(node) >= 0) nav.focus(node);
        else if (nav.collection.length) nav.focus(nav.collection[0]);
      },
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
    Storage: { get: function (k, d) { return d; }, set: function (k, v) { log.stored.push({ name: k, value: v }); } }
  };

  globalThis.window = { Lampa: Lampa, Navigator: nav };
  globalThis.Lampa = Lampa;
  globalThis.$ = make$(doc);
  return { log: log, doc: doc, Lampa: Lampa, nav: nav };
}

/* Загружает LC.hub в чистый контекст с подставленными зависимостями.
   fetchCalls — журнал LC.sources.fetch, collageCalls — LC.sources.collagePaths;
   у каждого есть ok/err, alive и cleared. */
function loadHub(opts) {
  opts = opts || {};
  var fetchCalls = [];
  var collageCalls = [];
  function record(list) {
    return function (item, arg, ok, err, alive) {
      var call = { item: item, arg: arg, page: arg, ok: ok, err: err, alive: alive, cleared: false };
      list.push(call);
      return { clear: function () { call.cleared = true; } };
    };
  }
  var sources = {
    discoverUrl: SOURCES.discoverUrl,
    collagePaths: record(collageCalls)
  };
  sources['fetch'] = record(fetchCalls);
  var ctx = loadCtx('46_hub.js', {
    sources: sources,
    lang: function (k) { return k; },
    langCode: function () { return 'ru'; },
    collectionsWord: function () { return 'подборок'; },
    motionMode: function () { return opts.motion || 'full'; },
    icons: { get: function () { return '<svg></svg>'; } },
    cardinfo: { imageUrl: function (path) { return path ? 'https://proxy/t/p/w342' + path : ''; } },
    manifest: { load: function (cb) { cb(MANIFEST); } },
    /* Task 20: настройки читает только подсказка про ключ Кинопоиска —
       по умолчанию её нет вовсе, как и в бандле до LC.init. */
    pref: opts.pref
  });
  return { api: ctx.api, LC: ctx.LC, fetchCalls: fetchCalls, collageCalls: collageCalls };
}

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
  assert.equal(env.log.menuButtons.length, 2);
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
  opts = opts || {};
  /* В тестовом манифесте у хаба два чипа и две плитки — «строка» модели
     Navigator равна двум. */
  if (!opts.cols) opts.cols = 2;
  var env = setupLampa(opts);
  var h = loadHub(opts);
  h.api.install();
  var comp = makeComponent('lumen_hub', {}, env);
  comp.create();
  return { env: env, h: h, comp: comp, root: env.log.scrolls[0].body()._children[0] };
}

test('lumen_hub: create строит чипы групп и плитки первой группы, лоадер гаснет', function () {
  warnLog.length = 0;
  var s = openHub();
  assert.ok(s.root.hasClass('lumen-hub'));
  assert.ok(s.root.hasClass('lumen-motion-full'), 'режим анимаций зеркалится на корень экрана');
  assert.equal(s.root.all('lumen-chip').length, 2, 'пустой чип «Эпохи» не показывается');
  assert.equal(s.root.all('lumen-tile').length, 2, 'плитки первой группы (Франшизы)');
  assert.deepEqual(s.comp.activity.states, [true, false], 'лоадер включился и погас');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: коллаж идёт дешёвым путём collagePaths, а не полной страницей (C1)', function () {
  var s = openHub();
  assert.equal(s.h.fetchCalls.length, 0, 'целая страница подборки для коллажа не запрашивается');
  assert.equal(s.h.collageCalls.length, 2, 'по одному запросу на видимую плитку');
  assert.equal(s.h.collageCalls[0].arg, 3, 'просим ровно три картинки');
});

test('lumen_hub: коллаж принимает и готовые URL Кинопоиска, и пути TMDB', function () {
  var s = openHub();
  s.h.collageCalls[0].ok(['https://kp/a.jpg', '/b.jpg']);
  var tile = s.root.all('lumen-tile')[0];
  var posters = tile.all('lumen-tile__poster');
  assert.equal(posters.length, 2);
  assert.ok(('' + posters[0].css('background-image')).indexOf('https://kp/a.jpg') !== -1, 'URL КП берётся как есть');
  assert.ok(('' + posters[1].css('background-image')).indexOf('https://proxy/t/p/w342/b.jpg') !== -1, 'путь TMDB — через прокси');
  assert.ok(tile.hasClass('lumen-tile--filled'));
});

test('lumen_hub: подборка Кинопоиска без ключа помечается на плитке', function () {
  var s = openHub();
  s.h.collageCalls[0].err({ nokey: true });
  assert.ok(s.root.all('lumen-tile')[0].hasClass('lumen-tile--nokey'));
});

test('lumen_hub: коллаж, упавший с ошибкой, перезапрашивается при следующем фокусе', function () {
  var s = openHub();
  var tile = s.root.all('lumen-tile')[0];
  s.h.collageCalls[0].err({ kp_failed: true });
  var before = s.h.collageCalls.length;
  fire(tile, 'hover:focus');
  assert.equal(s.h.collageCalls.length, before + 1, 'вторая попытка есть');
});

test('lumen_hub: start ставит свой контроллер content и включает его', function () {
  var s = openHub();
  s.comp.start();
  assert.ok(s.env.log.controllers.content, 'контроллер content зарегистрирован');
  assert.equal(s.env.log.toggles[s.env.log.toggles.length - 1], 'content');
  assert.equal(typeof s.env.log.controllers.content.right, 'function');
});

test('lumen_hub: пульт двигает фокус штатным Navigator', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-chip'), 'первый фокус — на чипе группы');
  ctrl.right();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-chip'));
  ctrl.down();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-tile'), 'вниз — на плитку');
  ctrl.up();
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-chip'), 'вверх — обратно на чип');
});

/* Task 27: первым .selector экрана стала кнопка поиска в шапке, а вход
   по-прежнему начинается с чипа группы (focusTarget). В линейной модели
   фейкового Navigator «влево» с первого чипа ведёт на эту кнопку, и только
   с неё экран кончается — на живом SpatialNavigator кнопка стоит справа в
   шапке, то есть «влево» с чипа уводит в меню сразу. Проверяем контракт
   контроллера: пока внутри экрана есть куда шагнуть, меню не трогаем. */
test('lumen_hub: влево с края экрана уводит в меню, вверх с чипов — в шапку', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  s.env.log.toggles.length = 0;
  ctrl.left();
  assert.deepEqual(s.env.log.toggles, [], 'шаг внутри экрана меню не открывает');
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-hub__search'), 'влево с чипа — на кнопку поиска');
  ctrl.left();
  assert.deepEqual(s.env.log.toggles, ['menu']);
  s.env.log.toggles.length = 0;
  ctrl.right();
  /* Первый «вверх» с чипа — на кнопку поиска (Navigator её не находит:
     кнопка в правой части шапки, чипы слева), второй — уже в шапку Lampa. */
  ctrl.up();
  assert.deepEqual(s.env.log.toggles, [], 'шаг на кнопку поиска шапку не открывает');
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-hub__search'));
  ctrl.up();
  assert.deepEqual(s.env.log.toggles, ['head']);
});

test('lumen_hub: назад возвращает на предыдущую активность', function () {
  var s = openHub();
  s.comp.start();
  s.env.log.controllers.content.back();
  assert.equal(s.env.log.backward, 1);
});

test('lumen_hub: смена группы гасит коллажи снятой группы (I1)', function () {
  var s = openHub();
  s.comp.start();
  var old = s.h.collageCalls.slice();
  var chips = s.root.all('lumen-chip');
  fire(chips[1], 'hover:enter');
  for (var i = 0; i < old.length; i++) {
    assert.equal(old[i].cleared, true, 'запрос коллажа снятой группы отменён');
    assert.equal(old[i].alive(), false, 'и его сторож поколения уже ложен');
  }
  assert.equal(s.root.all('lumen-tile').length, 2, 'плитки чипа «Студии и сервисы»');
  assert.ok(chips[1].hasClass('lumen-chip--on'));
  assert.equal(chips[0].hasClass('lumen-chip--on'), false);
});

test('lumen_hub: ответ коллажа снятой группы в новые плитки не пишет (I1)', function () {
  var s = openHub();
  s.comp.start();
  var stale = s.h.collageCalls[0];
  fire(s.root.all('lumen-chip')[1], 'hover:enter');
  warnLog.length = 0;
  stale.ok(['/late.jpg']);
  var posters = 0;
  s.root.all('lumen-tile').forEach(function (t) { posters += t.all('lumen-tile__poster').length; });
  assert.equal(posters, 0, 'поздний ответ снятой группы не рисует');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: смена группы оставляет фокус на выбранном чипе', function () {
  var s = openHub();
  s.comp.start();
  s.env.log.controllers.content.toggle();
  var chips = s.root.all('lumen-chip');
  fire(chips[1], 'hover:enter');
  assert.equal(s.env.log.focuses[s.env.log.focuses.length - 1], chips[1]);
});

test('lumen_hub: плитка открывает подборку через openTarget', function () {
  var s = openHub();
  s.comp.start();
  s.env.log.pushes.length = 0;
  fire(s.root.all('lumen-tile')[0], 'hover:enter');
  assert.equal(s.env.log.pushes.length, 1);
  assert.equal(s.env.log.pushes[0].component, 'lumen_grid');
  assert.equal(s.env.log.pushes[0].lumen.id, 'star-wars');
});

test('lumen_hub: stop() гасит коллажи, start() их возобновляет (I2)', function () {
  var s = openHub();
  s.comp.start();
  var before = s.h.collageCalls.slice();
  s.comp.stop();
  for (var i = 0; i < before.length; i++) {
    assert.equal(before[i].cleared, true, 'уход вглубь гасит незавершённый коллаж');
  }
  warnLog.length = 0;
  before[0].ok(['/late.jpg']);
  assert.equal(s.root.all('lumen-tile__poster').length, 0, 'ответ после stop() в снятый экран не пишет');
  var count = s.h.collageCalls.length;
  s.comp.start();
  assert.ok(s.h.collageCalls.length > count, 'возврат восстанавливает коллажи видимых плиток');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: destroy гасит незавершённые запросы, скролл и DOM', function () {
  var s = openHub();
  s.comp.start();
  var scroll = s.env.log.scrolls[0];
  var pending = s.h.collageCalls[0];
  s.comp.destroy();
  assert.equal(pending.cleared, true);
  assert.equal(pending.alive(), false);
  assert.equal(scroll.destroyed, true);
  assert.equal(s.root._removed, true);
});

// --- компонент lumen_grid ---
function openGrid(item, opts) {
  opts = opts || {};
  if (!opts.cols) opts.cols = 6;
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
      original_title: 'Movie ' + ((from || 0) + i),
      poster_path: '/p' + i + '.jpg',
      release_date: '2020-01-01',
      vote_average: 7
    });
  }
  return out;
}

test('lumen_grid: create запрашивает первую страницу и рисует штатные карточки', function () {
  warnLog.length = 0;
  var g = openGrid(COLLECTION);
  assert.equal(g.h.fetchCalls.length, 1);
  assert.equal(g.h.fetchCalls[0].page, 1);
  assert.deepEqual(g.comp.activity.states, [true], 'лоадер включён до ответа');
  g.h.fetchCalls[0].ok({ results: results(9), page: 1, total_pages: 1, total_results: 9 });
  var cards = g.root.all('lumen-gcard');
  assert.equal(cards.length, 9);
  assert.ok(cards[0].hasClass('card'), 'разметка штатная: класс .card от шаблона Lampa');
  assert.equal(cards[0].all('card__view').length, 1);
  assert.deepEqual(g.comp.activity.states, [true, false]);
  assert.deepEqual(warnLog, []);
});

test('lumen_grid: данные карточки лежат в card_data узла', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: results(2), page: 1, total_pages: 1, total_results: 2 });
  assert.equal(g.root.all('lumen-gcard')[0].card_data.id, 0);
});

test('lumen_grid: постеры грузятся окном, а не все разом (I6)', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(20), page: 1, total_pages: 3, total_results: 60 });
  var cards = g.root.all('lumen-gcard');
  var loaded = cards.filter(function (c) { return !!c.lumen_posted; });
  assert.ok(loaded.length < cards.length, 'не все постеры разом');
  assert.ok(loaded.length >= 6, 'первый экран карточек картинки получил: ' + loaded.length);
  var img = cards[0].querySelector('.card__img');
  assert.ok(('' + img.src).indexOf('https://proxy/t/p/w342/p0.jpg') !== -1);
  assert.equal(cards[cards.length - 1].querySelector('.card__img').src, undefined, 'дальней карточке постер не грузили');
});

test('lumen_grid: шаг фокуса догружает постеры следующих карточек (I6)', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(20), page: 1, total_pages: 3, total_results: 60 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  var last = g.root.all('lumen-gcard')[19];
  assert.ok(!last.lumen_posted, 'пока не грузили');
  ctrl.down(); ctrl.down(); ctrl.down();
  assert.ok(last.lumen_posted, 'после спуска постер дальней карточки запрошен');
});

test('lumen_grid: метка закладки и полоса продолжения — как на штатной карточке (I6)', function () {
  var env = setupLampa({
    cols: 6,
    favorite: { 1: { book: true, continued: true } },
    timeline: { 'h:Movie 1': { percent: 43 } }
  });
  var h = loadHub();
  h.api.install();
  var comp = makeComponent('lumen_grid', { lumen: COLLECTION, title: 'x' }, env);
  comp.activity = fakeActivity();
  comp.create();
  h.fetchCalls[0].ok({ results: results(2), page: 1, total_pages: 1, total_results: 2 });
  var root = env.log.scrolls[0].body()._children[0];
  var card = root.all('lumen-gcard')[1];
  assert.equal(card.all('card__icon').length, 1, 'иконка закладки');
  assert.equal(card.all('card__marker').length, 1, 'метка «продолжено»');
  var bar = card.all('lumen-gcard__bar');
  assert.equal(bar.length, 1, 'полоса продолжения просмотра');
  assert.equal(root.all('lumen-gcard')[0].all('lumen-gcard__bar').length, 0, 'у карточки без прогресса полосы нет');
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
  fire(chips[1], 'hover:enter');
  assert.equal(g.h.fetchCalls.length, 1, 'коллекция уже загружена целиком — в сеть не идём');
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

test('lumen_grid: сортировка во время загрузки отменяет запрос и отправляет новый (C2)', function () {
  var g = openGrid(DISCOVER);
  /* ответ ещё не пришёл — ровно то окно, в котором фокус стоит на чипах */
  assert.equal(g.h.fetchCalls.length, 1);
  g.comp.start();
  fire(g.root.all('lumen-chip')[1], 'hover:enter');
  assert.equal(g.h.fetchCalls[0].cleared, true, 'первый запрос отменён');
  assert.equal(g.h.fetchCalls[0].alive(), false, 'его ответ уже неактуален');
  assert.equal(g.h.fetchCalls.length, 2, 'новый запрос ушёл, а не «проглотился» гардом loading');
  assert.equal(g.h.fetchCalls[1].item.sources.movie.params.sort_by, 'vote_average.desc');
  /* прежний ответ, доехавший после отмены, не должен подменить список */
  g.h.fetchCalls[0].ok({ results: results(5), page: 1, total_pages: 1, total_results: 5 });
  assert.equal(g.root.all('lumen-gcard').length, 0, 'отменённый ответ ничего не нарисовал');
  g.h.fetchCalls[1].ok({ results: results(3, 100), page: 1, total_pages: 1, total_results: 3 });
  assert.equal(g.root.all('lumen-gcard').length, 3);
  assert.equal(g.root.all('lumen-grid__sub')[0]._html, 'lumen_grid_total 3 · lumen_sort_rating', 'подпись совпадает с тем, что показано');
});

test('lumen_grid: смена сортировки оставляет фокус на нажатом чипе (I4)', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(12), page: 1, total_pages: 2, total_results: 40 });
  g.comp.start();
  var chips = g.root.all('lumen-chip');
  fire(chips[2], 'hover:enter');
  assert.equal(g.env.log.focuses[g.env.log.focuses.length - 1], chips[2], 'фокус на «Новые», а не на первом чипе');
  g.h.fetchCalls[1].ok({ results: results(12, 50), page: 1, total_pages: 2, total_results: 40 });
  assert.equal(g.env.log.focuses[g.env.log.focuses.length - 1], chips[2], 'и после ответа он там же');
});

test('lumen_grid: догрузка страницы с сортировкой на месте не теряет фокус (I3)', function () {
  /* Кинопоиск многостраничный, и его страницы пересобирают список целиком. */
  var kp = MANIFEST.collections[4];
  var g = openGrid(kp);
  g.h.fetchCalls[0].ok({ results: results(12), page: 1, total_pages: 3, total_results: 36 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  ctrl.down();
  ctrl.down();
  var focusedId = g.env.log.focuses[g.env.log.focuses.length - 1].card_data.id;
  assert.equal(g.h.fetchCalls.length, 2, 'на последней строке ушла вторая страница');
  g.h.fetchCalls[1].ok({ results: results(12, 100), page: 2, total_pages: 3, total_results: 36 });
  var after = g.env.log.focuses[g.env.log.focuses.length - 1];
  assert.ok(after.card_data, 'фокус остался на карточке, а не уехал на чип');
  assert.equal(after.card_data.id, focusedId, 'и на той же самой');
});

test('lumen_grid: следующая страница грузится, когда фокус дошёл до последней строки', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(12), page: 1, total_pages: 3, total_results: 60 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  assert.equal(g.h.fetchCalls.length, 1, 'на чипах сортировки ничего не грузится');
  ctrl.down();
  assert.equal(g.h.fetchCalls.length, 1, 'первая строка из двух — не конец');
  ctrl.down();
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

test('lumen_grid: пришедшая страница сама себя не догружает', function () {
  var g = openGrid(DISCOVER);
  g.comp.start();
  g.env.log.controllers.content.toggle();
  for (var i = 0; i < 5; i++) {
    var call = g.h.fetchCalls[g.h.fetchCalls.length - 1];
    call.ok({ results: results(12, i * 100), page: i + 1, total_pages: 9, total_results: 300 });
  }
  assert.equal(g.h.fetchCalls.length, 1, 'ни одного запроса сверх первого');
});

test('lumen_grid: stop() гасит страницу в полёте, start() её возобновляет (I2)', function () {
  var g = openGrid(DISCOVER);
  g.comp.start();
  var first = g.h.fetchCalls[0];
  g.comp.stop();
  assert.equal(first.cleared, true, 'уход вглубь гасит незавершённую страницу');
  assert.equal(first.alive(), false);
  warnLog.length = 0;
  first.ok({ results: results(5), page: 1, total_pages: 1, total_results: 5 });
  assert.equal(g.root.all('lumen-gcard').length, 0, 'ответ после stop() в снятый экран не пишет');
  g.comp.start();
  assert.equal(g.h.fetchCalls.length, 2, 'возврат возобновляет прерванную страницу');
  assert.equal(g.h.fetchCalls[1].page, 1);
  g.h.fetchCalls[1].ok({ results: results(4), page: 1, total_pages: 1, total_results: 4 });
  assert.equal(g.root.all('lumen-gcard').length, 4);
  assert.deepEqual(warnLog, []);
});

test('lumen_grid: stop() без запроса в полёте ничего не возобновляет', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(6), page: 1, total_pages: 1, total_results: 6 });
  g.comp.start();
  g.comp.stop();
  g.comp.start();
  assert.equal(g.h.fetchCalls.length, 1, 'лишнего запроса при возврате нет');
  assert.equal(g.root.all('lumen-gcard').length, 6, 'список на месте');
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
  var g = openGrid(MANIFEST.collections[4]);
  warnLog.length = 0;
  g.h.fetchCalls[0].err({ nokey: true });
  assert.equal(g.root.all('lumen-grid__empty-text').length, 1);
  assert.deepEqual(g.comp.activity.states, [true, false], 'лоадер гаснет и на ошибке');
  assert.deepEqual(warnLog, []);
});

/* Task 20: подсказку про ключ Кинопоиска можно убрать одной кнопкой — она
   висела на каждом заходе в подборки КП, пока ключа нет. */
test('Task 20: подсказка «нет ключа» даёт кнопку «Скрыть», она пишет настройку', function () {
  var g = openGrid(MANIFEST.collections[4]);
  g.h.fetchCalls[0].err({ nokey: true });
  g.comp.start();

  var hide = g.root.all('lumen-grid__hide');
  assert.equal(hide.length, 1, 'ожидалась кнопка «Скрыть»');
  assert.ok(hide[0].hasClass('selector'), 'кнопка обязана фокусироваться пультом');
  fire(hide[0], 'hover:enter');
  /* Строка, а не JS-false: Storage.set(name, false) у Lampa не сохраняется. */
  assert.deepEqual(g.env.log.stored, [{ name: 'lumen_kp_hint', value: 'false' }]);
  assert.equal(g.env.log.backward, 0, '«Скрыть» экран не закрывает');
});

test('Task 20: подсказка выключена — обычный пустой экран, кнопки «Скрыть» нет', function () {
  var g = openGrid(MANIFEST.collections[4], { pref: function (name, def) { return name === 'lumen_kp_hint' ? false : def; } });
  g.h.fetchCalls[0].err({ nokey: true });

  assert.equal(g.root.all('lumen-grid__empty-text').length, 1, 'экран всё равно не пустой');
  assert.equal(g.root.all('lumen-grid__hide').length, 0, 'прятать нечего — подсказки нет');
  assert.equal(g.root.all('lumen-grid__back').length, 1, '«Назад» остаётся единственным .selector');
});

test('lumen_grid: destroy гасит запрос, скролл и DOM', function () {
  var g = openGrid(DISCOVER);
  var scroll = g.env.log.scrolls[0];
  var pending = g.h.fetchCalls[0];
  g.comp.destroy();
  assert.equal(pending.cleared, true);
  assert.equal(pending.alive(), false);
  assert.equal(scroll.destroyed, true);
  assert.equal(g.root._removed, true);
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

/* Task 21 (фаза 3): сезонные подборки в хабе. */
const SEASON_MANIFEST = {
  version: 1,
  home: [],
  groups: [{ id: 'theme', title: 'Темы' }],
  hubGroups: [{ id: 'themes', title: 'Темы', groups: ['theme'] }],
  collections: [
    { id: 'comedy', title: 'Комедии', group: 'theme', sources: { movie: {} } },
    { id: 'xmas', title: 'Рождественские', group: 'theme', season: [12, 1], sources: { movie: {} } },
    { id: 'hw', title: 'Хэллоуин', group: 'theme', season: [9, 10, 11], sources: { movie: {} } }
  ]
};

test('tilesFor: без месяца порядок манифестный, с месяцем сезонные — первыми', function () {
  assert.deepEqual(H.tilesFor(SEASON_MANIFEST, 'themes').map(c => c.id), ['comedy', 'xmas', 'hw']);
  assert.deepEqual(H.tilesFor(SEASON_MANIFEST, 'themes', 12).map(c => c.id), ['xmas', 'comedy', 'hw']);
  assert.deepEqual(H.tilesFor(SEASON_MANIFEST, 'themes', 10).map(c => c.id), ['hw', 'comedy', 'xmas']);
  assert.deepEqual(H.tilesFor(SEASON_MANIFEST, 'themes', 5).map(c => c.id), ['comedy', 'xmas', 'hw']);
});

test('inSeason: подборка своего месяца получает метку «Сезон»', function () {
  const xmas = SEASON_MANIFEST.collections[1];
  assert.equal(H.inSeason(xmas, 12), true);
  assert.equal(H.inSeason(xmas, 1), true);
  assert.equal(H.inSeason(xmas, 7), false);
  assert.equal(H.inSeason(SEASON_MANIFEST.collections[0], 12), false);
  assert.equal(H.inSeason(null, 12), false);
  assert.equal(H.inSeason(xmas, 0), false);
});

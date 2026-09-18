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
  /* Task 33: окно коллекции ставит layer--render через нативный classList —
     так же, как штатная сетка Lampa (app.min.js:53152-53154). */
  var self = this;
  this.classList = {
    add: function (c) { self.addClass(c); },
    remove: function (c) { self.removeClass(c); },
    contains: function (c) { return self.hasClass(c); }
  };
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
  var el = child instanceof El ? child : new El(classesOf(child), tagOf(child));
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
/* Task 41: атрибут узла — плитка хаба создаёт <img decoding="async">. */
El.prototype.attr = function (name) { return this._attr ? this._attr[name] : undefined; };
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

/* Task 41: атрибуты тега (кроме class) — плитка хаба создаёт <img
   decoding="async">, и подсказка декодирования обязана быть видна тестом. */
function attrsOf(html) {
  var out = {};
  var re = /([a-z-]+)="([^"]*)"/g;
  var m;
  while ((m = re.exec('' + html))) {
    if (m[1] !== 'class') out[m[1]] = m[2];
  }
  return out;
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
      /* Task 41: <img> — кадр плитки хаба (paintBanner). */
      var tags = arg.match(/<div[^>]*>|<span[^>]*>|<img[^>]*>/g) || [];
      var root = new El(classesOf(tags[0]), tagOf(tags[0]));
      root._attr = attrsOf(tags[0]);
      for (var i = 1; i < tags.length; i++) {
        var child = new El(classesOf(tags[i]), tagOf(tags[i]));
        child._attr = attrsOf(tags[i]);
        root.append(child);
      }
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
    /* Task 33: сколько раз звали Navigator.move — то есть второй проход
       navigate по всей коллекции, которого после Task 33 быть не должно;
       и какие коллекции выставляли Navigator напрямую. */
    moves: 0,
    collections: [],
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
    /* Как настоящий SpatialNavigator: canmove отдаёт сам найденный узел,
       а не boolean (navigator.js:762-770). */
    canmove: function (dir) {
      var n = nav.target(dir);
      return n >= 0 ? nav.collection[n] : false;
    },
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
      log.moves++;
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
    },
    /* Task 33: то, чем окно коллекции пользуется напрямую — как штатная
       limit() сетки Lampa (app.min.js:53157-53160). setCollection снимает
       фокус (navigator.js:568-574), focused ставит его без события
       (navigator.js:640-642). */
    setCollection: function (list) {
      log.collections.push(list.slice());
      nav.collection = list.slice();
      nav.index = -1;
    },
    focused: function (el) { nav.index = nav.collection.indexOf(el); },
    getFocusedElement: function () { return nav.index >= 0 ? nav.collection[nav.index] : null; }
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
    /* Task 32: штатный контракт прокрутки Lampa — minus() задаёт области
       высоту экрана, update(elem, tocenter) подкручивает её к элементу.
       Считаем вызовы, чтобы тесты видели обе половины. */
    this.minus_calls = 0;
    this.minus = function () { self.minus_calls++; };
    this.update_calls = [];
    this.update = function (el, center) { self.update_calls.push([el, !!center]); };
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
      /* Task 33: коллекцию экраны плагина выставляют окном сами. Вызов
         collectionSet отдал бы Navigator все .selector узла разом — это и
         есть тот регресс, который тест обязан поймать по имени. */
      collectionSet: function () {
        assert.fail('collectionSet отдал бы Navigator все .selector — окно Task 33 потеряно');
      },
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

  /* Task 39: innerWidth нужен LC.util.screenPx — от него зависит размер
     кадров плиток и постеров карточек сетки. */
  globalThis.window = { Lampa: Lampa, Navigator: nav, innerWidth: 1920, devicePixelRatio: opts.dpr || 1 };
  globalThis.Lampa = Lampa;
  globalThis.$ = make$(doc);
  return { log: log, doc: doc, Lampa: Lampa, nav: nav };
}

/* Загружает LC.hub в чистый контекст с подставленными зависимостями.
   fetchCalls — журнал LC.sources.fetch, bannerCalls — LC.sources.bannerPath;
   у каждого есть ok/err, alive и cleared. */
function loadHub(opts) {
  opts = opts || {};
  var fetchCalls = [];
  var bannerCalls = [];
  function record(list) {
    return function (item, arg, ok, err, alive) {
      var call = { item: item, arg: arg, page: arg, ok: ok, err: err, alive: alive, cleared: false };
      list.push(call);
      return { clear: function () { call.cleared = true; } };
    };
  }
  /* Task 41: у bannerPath аргумента count нет — колбэки сдвинуты на одну
     позицию влево относительно fetch(item, page, ok, err, alive). */
  function recordBanner(list) {
    return function (item, ok, err, alive) {
      var call = { item: item, ok: ok, err: err, alive: alive, cleared: false };
      list.push(call);
      return { clear: function () { call.cleared = true; } };
    };
  }
  var sources = {
    discoverUrl: SOURCES.discoverUrl,
    bannerPath: recordBanner(bannerCalls)
  };
  sources['fetch'] = record(fetchCalls);
  var ctx = loadCtx('46_hub.js', {
    sources: sources,
    lang: function (k) { return k; },
    langCode: function () { return 'ru'; },
    collectionsWord: function () { return 'подборок'; },
    motionMode: function () { return opts.motion || 'full'; },
    icons: { get: function () { return '<svg></svg>'; } },
    /* Task 39: заглушка отдаёт ЗАПРОШЕННЫЙ размер, иначе выбор размера
       нечем проверить. */
    cardinfo: { imageUrl: function (path, size) { return path ? 'https://proxy/t/p/' + size + path : ''; } },
    manifest: { load: function (cb) { cb(opts.manifest || MANIFEST); } },
    /* Task 20: настройки читает только подсказка про ключ Кинопоиска —
       по умолчанию её нет вовсе, как и в бандле до LC.init. */
    pref: opts.pref,
    /* Task 40: замер автодетекта — модуля perf в этих тестах по умолчанию
       нет, как и в бандле до его загрузки (вызов защищён проверкой). */
    perf: opts.perf
  });
  return { api: ctx.api, LC: ctx.LC, fetchCalls: fetchCalls, bannerCalls: bannerCalls };
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

/* Task 32: на стенде хаб не листался вниз вообще — scroll создавался, но
   ни minus(), ни update() наши компоненты не звали. Обе половины штатного
   контракта Lampa проверяем здесь. */
test('lumen_hub: create вызывает scroll.minus() ровно один раз', function () {
  var s = openHub();
  assert.equal(s.env.log.scrolls[0].minus_calls, 1);
});

test('lumen_hub: hover:focus плитки подкручивает скролл к ней', function () {
  var s = openHub();
  var scroll = s.env.log.scrolls[0];
  var tile = s.root.all('lumen-tile')[1];
  scroll.update_calls.length = 0;
  fire(tile, 'hover:focus');
  assert.equal(scroll.update_calls.length, 1);
  assert.equal(scroll.update_calls[0][0], tile, 'подкрутка именно к этой плитке');
  assert.equal(scroll.update_calls[0][1], true, 'ряд встаёт по центру');
});

test('lumen_hub: кадр плитки идёт дешёвым путём bannerPath, а не полной страницей (C1)', function () {
  var s = openHub();
  assert.equal(s.h.fetchCalls.length, 0, 'целая страница подборки для плитки не запрашивается');
  assert.equal(s.h.bannerCalls.length, 2, 'по одному запросу на плитку окна');
});

/* Task 41: на плитке ОДНА картинка — <img> с подсказкой декодирования,
   вместо трёх постеров коллажа, которые рисовались фоном блоков. */
test('lumen_hub: плитка рисует один <img decoding="async">, принимая и URL КП, и путь TMDB', function () {
  var s = openHub();
  s.h.bannerCalls[0].ok('https://kp/a.jpg');
  s.h.bannerCalls[1].ok('/bd.jpg');

  var first = s.root.all('lumen-tile')[0];
  var imgs = first.all('lumen-tile__img');
  assert.equal(imgs.length, 1, 'ровно одна картинка на плитку');
  assert.equal(imgs[0]._tag, 'img', 'это <img>, а не фон блока');
  assert.equal(imgs[0].attr('decoding'), 'async', 'декодирование вне главного потока');
  assert.equal(imgs[0].src, 'https://kp/a.jpg', 'URL КП берётся как есть');

  var second = s.root.all('lumen-tile')[1].all('lumen-tile__img')[0];
  assert.equal(second.src, 'https://proxy/t/p/w780/bd.jpg', 'путь TMDB — через прокси, кадровой ступенью');
});

test('lumen_hub: кадр проявляется только после загрузки картинки', function () {
  var s = openHub();
  s.h.bannerCalls[0].ok('/bd.jpg');
  var tile = s.root.all('lumen-tile')[0];
  assert.equal(tile.hasClass('lumen-tile--filled'), false, 'до onload плитка — ровная панель');
  tile.all('lumen-tile__img')[0].onload();
  assert.ok(tile.hasClass('lumen-tile--filled'));
});

/* Task 39: размер выбирается по ФАКТИЧЕСКОЙ ширине элемента в физических
   пикселях. Плитка хаба — 18.98em (433 px на экране 1920, 866 при DPR 2:
   обе ширины закрывает кадровая ступень w780), карточка сетки — 12.36em
   (282 и 564). */
test('Task 39: DPR 2 поднимает размер картинок карточек сетки', function () {
  var s = openHub({ dpr: 2 });
  s.h.bannerCalls[0].ok('/bd.jpg');
  var img = s.root.all('lumen-tile')[0].all('lumen-tile__img')[0];
  assert.equal(img.src, 'https://proxy/t/p/w780/bd.jpg',
    'кадр плитки и при DPR 2 остаётся w780 — выше ступень только w1280');

  var g = openGrid(DISCOVER, { dpr: 2 });
  g.h.fetchCalls[0].ok({ results: results(20), page: 1, total_pages: 3, total_results: 60 });
  var card = g.root.all('lumen-gcard')[0].querySelector('.card__img');
  assert.ok(('' + card.src).indexOf('/t/p/w500/p0.jpg') !== -1,
    'карточка сетки при DPR 2 — w500 (при DPR 1 хватало w342)');
});

test('lumen_hub: подборка Кинопоиска без ключа помечается на плитке', function () {
  var s = openHub();
  s.h.bannerCalls[0].err({ nokey: true });
  assert.ok(s.root.all('lumen-tile')[0].hasClass('lumen-tile--nokey'));
});

/* Task 41: кадры грузятся окном вперёд от фокуса (BANNER_AHEAD = 8), а не
   все разом и не по одному на фокус. Манифест на 20 подборок в одной
   группе: тестовый MANIFEST даёт всего две плитки, на которых окно не
   видно. */
var BIG_MANIFEST = (function () {
  var m = { version: 1, home: [], groups: [{ id: 'franchise', title: 'Франшизы' }], hubGroups: [{ id: 'franchises', title: 'Франшизы', groups: ['franchise'] }], collections: [] };
  for (var i = 0; i < 20; i++) {
    m.collections.push({ id: 'c' + i, title: 'Подборка ' + i, group: 'franchise', sources: { movie: { type: 'discover', params: {} } } });
  }
  return m;
})();

test('Task 41: кадры грузятся окном вперёд от фокуса, а не всей группой', function () {
  var s = openHub({ manifest: BIG_MANIFEST, cols: 4 });
  assert.equal(s.root.all('lumen-tile').length, 20, 'в группе 20 плиток');
  assert.equal(s.h.bannerCalls.length, 9, 'при входе — окно от начала списка: плитки 0..8');

  /* Шаг фокуса двигает окно: с девятой плитки видно до семнадцатой. */
  fire(s.root.all('lumen-tile')[8], 'hover:focus');
  assert.equal(s.h.bannerCalls.length, 17, 'окно доехало до 16-й плитки включительно');

  /* Уже запрошенные кадры второй раз не просят. */
  fire(s.root.all('lumen-tile')[0], 'hover:focus');
  assert.equal(s.h.bannerCalls.length, 17, 'возврат назад ничего не перезапрашивает');
});

test('lumen_hub: кадр, упавший с ошибкой, перезапрашивается при следующем фокусе', function () {
  var s = openHub();
  var tile = s.root.all('lumen-tile')[0];
  s.h.bannerCalls[0].err({ kp_failed: true });
  var before = s.h.bannerCalls.length;
  fire(tile, 'hover:focus');
  assert.equal(s.h.bannerCalls.length, before + 1, 'вторая попытка есть');
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

/* ---------------------------------------------------------------------- */
/* Task 33: один проход навигации на нажатие.                              */
/* ---------------------------------------------------------------------- */

test('Task 33: шаг по экрану — один проход Navigator: canmove нашёл узел, focus его ставит', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  var nav = s.env.nav;
  var calls = { canmove: 0, focus: 0 };
  var realCanmove = nav.canmove;
  var realFocus = nav.focus;
  nav.canmove = function (dir) { calls.canmove++; return realCanmove(dir); };
  nav.focus = function (el) { calls.focus++; return realFocus(el); };
  s.env.log.moves = 0;

  ctrl.down();

  assert.equal(calls.canmove, 1, 'соседа ищем ровно один раз');
  assert.equal(calls.focus, 1, 'и сразу ставим фокус на найденный узел');
  assert.equal(s.env.log.moves, 0, 'второго прохода navigate по всей коллекции нет');
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-tile'), 'фокус при этом реально переехал');
});

test('Task 33: окно, которое ничего не режет, коллекцию не пересобирает', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  var before = s.env.log.collections.length;
  assert.equal(before, 1, 'вход в экран коллекцию выставил');

  ctrl.down();
  ctrl.up();
  ctrl.right();

  /* Плиток меньше окна навигации, границы упираются в концы списка и не
     меняются — пересобирать коллекцию не за чем. Без этого каждый шаг стоил
     бы setCollection -> multiAdd -> add с indexOf на каждый узел. */
  assert.equal(s.env.log.collections.length, before, 'шаг фокуса лишнего setCollection не делает');
});

test('Task 33: сборка Lampa без Navigator.focus — шаг делает move (страховка)', function () {
  var s = openHub();
  s.comp.start();
  var ctrl = s.env.log.controllers.content;
  ctrl.toggle();
  var nav = s.env.nav;
  var realFocus = nav.focus;
  var moves = 0;
  /* Ровно тот случай, ради которого ветка и оставлена: canmove есть, focus
     нет. Фокус внутри move ставим в обход подменённого свойства. */
  nav.focus = null;
  nav.move = function (dir) {
    moves++;
    var n = nav.target(dir);
    if (n < 0) return false;
    realFocus(nav.collection[n]);
    return true;
  };

  ctrl.down();

  assert.equal(moves, 1, 'шаг всё равно сделан');
  assert.ok(s.env.log.focuses[s.env.log.focuses.length - 1].hasClass('lumen-tile'));
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

test('lumen_hub: смена группы гасит кадры снятой группы (I1)', function () {
  var s = openHub();
  s.comp.start();
  var old = s.h.bannerCalls.slice();
  var chips = s.root.all('lumen-chip');
  fire(chips[1], 'hover:enter');
  for (var i = 0; i < old.length; i++) {
    assert.equal(old[i].cleared, true, 'запрос кадра снятой группы отменён');
    assert.equal(old[i].alive(), false, 'и его сторож поколения уже ложен');
  }
  assert.equal(s.root.all('lumen-tile').length, 2, 'плитки чипа «Студии и сервисы»');
  assert.ok(chips[1].hasClass('lumen-chip--on'));
  assert.equal(chips[0].hasClass('lumen-chip--on'), false);
});

test('lumen_hub: ответ кадра снятой группы в новые плитки не пишет (I1)', function () {
  var s = openHub();
  s.comp.start();
  var stale = s.h.bannerCalls[0];
  fire(s.root.all('lumen-chip')[1], 'hover:enter');
  warnLog.length = 0;
  stale.ok('/late.jpg');
  var imgs = 0;
  s.root.all('lumen-tile').forEach(function (t) { imgs += t.all('lumen-tile__img').length; });
  assert.equal(imgs, 0, 'поздний ответ снятой группы не рисует');
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

test('lumen_hub: stop() гасит кадры, start() их возобновляет (I2)', function () {
  var s = openHub();
  s.comp.start();
  var before = s.h.bannerCalls.slice();
  s.comp.stop();
  for (var i = 0; i < before.length; i++) {
    assert.equal(before[i].cleared, true, 'уход вглубь гасит незавершённый запрос кадра');
  }
  warnLog.length = 0;
  before[0].ok('/late.jpg');
  assert.equal(s.root.all('lumen-tile__img').length, 0, 'ответ после stop() в снятый экран не пишет');
  var count = s.h.bannerCalls.length;
  s.comp.start();
  assert.ok(s.h.bannerCalls.length > count, 'возврат восстанавливает кадры видимых плиток');
  assert.deepEqual(warnLog, []);
});

test('lumen_hub: destroy гасит незавершённые запросы, скролл и DOM', function () {
  var s = openHub();
  s.comp.start();
  var scroll = s.env.log.scrolls[0];
  var pending = s.h.bannerCalls[0];
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

test('lumen_grid: create вызывает scroll.minus() ровно один раз', function () {
  var g = openGrid(COLLECTION);
  assert.equal(g.env.log.scrolls[0].minus_calls, 1);
});

test('lumen_grid: hover:focus карточки подкручивает скролл к ней', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: results(9), page: 1, total_pages: 1, total_results: 9 });
  var scroll = g.env.log.scrolls[0];
  var card = g.root.all('lumen-gcard')[4];
  scroll.update_calls.length = 0;
  fire(card, 'hover:focus');
  assert.equal(scroll.update_calls.length, 1);
  assert.equal(scroll.update_calls[0][0], card, 'подкрутка именно к этой карточке');
  assert.equal(scroll.update_calls[0][1], true, 'ряд карточек встаёт по центру');
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

/* Task 40: сборка экрана подборок — точка замера автодетекта: хаб самый
   тяжёлый экран плагина (чипы групп плюс плитки с кадрами подборок). */
test('Task 40: сборка хаба запускает замер автодетекта, помеченный как hub', function () {
  var tracks = [];
  var env = setupLampa({ cols: 2 });
  var h = loadHub({ perf: { track: function (source) { tracks.push(source); } } });
  h.api.install();
  var comp = makeComponent('lumen_hub', {}, env);
  comp.create();
  assert.deepEqual(tracks, ['hub'], 'замер начат после того, как экран собран, и помечен источником');
});

/* Task 39: <img> карточки сетки живёт в документе, и без decoding='async'
   каждый постер декодируется на главном потоке в момент показа. */
test('Task 39: постеру карточки сетки ставится decoding=async', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(20), page: 1, total_pages: 3, total_results: 60 });
  var img = g.root.all('lumen-gcard')[0].querySelector('.card__img');
  assert.equal(img.decoding, 'async');
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

/* ---------------------------------------------------------------------- */
/* Task 33: окно коллекции в сетке.                                        */
/* ---------------------------------------------------------------------- */

/* Сетка со 120 карточками и фокусом на 80-й. */
function openWideGrid() {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(120), page: 1, total_pages: 1, total_results: 120 });
  g.comp.start();
  g.cards = g.root.all('lumen-gcard');
  g.chips = g.root.all('lumen-chip');
  return g;
}

/* Фокус на карточке index и пересборка коллекции вокруг неё. */
function focusCard(g, index) {
  fire(g.cards[index], 'hover:focus');
  g.env.log.controllers.content.toggle();
  return g.env.log.collections[g.env.log.collections.length - 1];
}

test('Task 33: в коллекцию Navigator едет окно карточек, а не весь список', function () {
  var g = openWideGrid();
  assert.equal(g.cards.length, 120);
  assert.equal(g.chips.length, 3, 'чипов сортировки три — они и есть постоянная часть коллекции');

  var collection = focusCard(g, 80);

  /* Границы как у штатной limit(): slice(active - 36, active + 36),
     то есть карточки 44..115 включительно (app.min.js:53157). */
  assert.equal(collection.length, 3 + 72, 'три чипа плюс 72 карточки окна');
  assert.equal(collection[0], g.chips[0], 'чипы сортировки идут первыми и в коллекции всегда');
  assert.equal(collection[3], g.cards[44], 'нижняя граница окна');
  assert.equal(collection[collection.length - 1], g.cards[115], 'верхняя граница окна');
  assert.equal(collection.indexOf(g.cards[43]), -1, 'карточка за нижней границей в коллекцию не попала');
  assert.equal(collection.indexOf(g.cards[116]), -1, 'и за верхней тоже');
});

test('Task 33: окно у начала списка не уходит в минус', function () {
  var g = openWideGrid();
  var collection = focusCard(g, 2);
  /* slice(Math.max(0, 2 - 36), 2 + 36) — слева обрезано нулём, справа окно
     полное: карточки 0..37. */
  assert.equal(collection.length, 3 + 38);
  assert.equal(collection[3], g.cards[0]);
  assert.equal(collection[collection.length - 1], g.cards[37]);
});

test('Task 33: карточки вне окна просмотра теряют layer--render, внутри — получают', function () {
  var g = openWideGrid();
  /* Штатный шаблон карточки Lampa приходит с этим классом (app.min.js:2510),
     поэтому содержательна прежде всего потеря. */
  assert.equal(g.cards[0].hasClass('layer--render'), true, 'до окна класс стоял у всех');

  focusCard(g, 80);

  assert.equal(g.cards[80].hasClass('layer--render'), true, 'сама карточка под фокусом');
  assert.equal(g.cards[68].hasClass('layer--render'), true, 'нижняя граница окна просмотра');
  assert.equal(g.cards[67].hasClass('layer--render'), false, 'на шаг ниже — уже нет');
  assert.equal(g.cards[91].hasClass('layer--render'), true, 'верхняя граница окна просмотра');
  assert.equal(g.cards[92].hasClass('layer--render'), false, 'на шаг выше — уже нет');
  assert.equal(g.cards[0].hasClass('layer--render'), false);

  focusCard(g, 0);
  assert.equal(g.cards[0].hasClass('layer--render'), true, 'окно вернулось — класс тоже');
  assert.equal(g.cards[80].hasClass('layer--render'), false);
});

test('Task 33: шаг вверх двигает окно назад — подняться со дна списка можно до самого верха', function () {
  var g = openWideGrid();
  focusCard(g, 80);
  var ctrl = g.env.log.controllers.content;
  /* Шесть колонок: тринадцать шагов вверх — это 78 карточек, больше окна
     навигации. Без пересчёта окна на «вверх» фокус упёрся бы в 44-ю. */
  for (var i = 0; i < 13; i++) ctrl.up();
  var focused = g.env.log.focuses[g.env.log.focuses.length - 1];
  assert.ok(focused.card_data, 'фокус всё ещё на карточке');
  assert.equal(focused.card_data.id, 2, 'дошли до первой строки, окно ехало следом');
});

test('Task 33: узел под фокусом попадает в коллекцию, даже когда окно до него не достаёт', function () {
  var g = openWideGrid();
  focusCard(g, 80);
  assert.equal(g.env.nav.getFocusedElement(), g.cards[80], 'Navigator держит 80-ю');

  /* Уводим lastFocus в начало списка, не трогая _focus самого Navigator —
     ровно та рассинхронизация, при которой окно построится вокруг одного
     узла, а фокус будет стоять на другом. */
  fire(g.cards[0], 'hover:focus');
  g.env.log.controllers.content.toggle();

  var collection = g.env.log.collections[g.env.log.collections.length - 1];
  assert.equal(collection.indexOf(g.cards[36]), -1, 'окно встало на начало списка');
  assert.ok(collection.indexOf(g.cards[80]) >= 0, 'но узел под фокусом в коллекцию дописан');
  assert.equal(g.env.nav.getFocusedElement(), g.cards[0], 'а фокус дальше переставил collectionFocus');
});

test('Task 33: перестройка списка кэш окна не обманывает', function () {
  var g = openGrid(COLLECTION);
  g.h.fetchCalls[0].ok({ results: results(120), page: 1, total_pages: 1, total_results: 120 });
  g.comp.start();
  g.env.log.controllers.content.toggle();
  var oldCards = g.root.all('lumen-gcard');

  /* Сортировка на месте: список пересобран целиком, узлы новые. */
  fire(g.root.all('lumen-chip')[1], 'hover:enter');

  var newCards = g.root.all('lumen-gcard');
  var collection = g.env.log.collections[g.env.log.collections.length - 1];
  assert.notEqual(newCards[0], oldCards[0], 'узлы действительно новые');
  assert.ok(collection.indexOf(newCards[0]) >= 0, 'в коллекции новые узлы');
  assert.equal(collection.indexOf(oldCards[0]), -1, 'старых в ней нет');
});

test('Task 33: догрузка страницы в тот же список окно обновляет', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: results(12), page: 1, total_pages: 2, total_results: 24 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  ctrl.down();
  ctrl.down();
  assert.equal(g.h.fetchCalls.length, 2, 'на последней строке ушла вторая страница');

  /* Список тот же массив, но длиннее — кэш обязан это заметить. */
  g.h.fetchCalls[1].ok({ results: results(12, 100), page: 2, total_pages: 2, total_results: 24 });

  var cards = g.root.all('lumen-gcard');
  assert.equal(cards.length, 24);
  var collection = g.env.log.collections[g.env.log.collections.length - 1];
  assert.ok(collection.indexOf(cards[23]) >= 0, 'карточка дописанной страницы в коллекции есть');
  /* Фокус стоит на 9-й, окно просмотра — [0, 21). Карточки приходят из
     штатного шаблона Lampa уже с layer--render, и дальние обязаны его
     потерять: длина списка выросла, значит окно пересчитывается заново. */
  assert.equal(cards[20].hasClass('layer--render'), true, 'у края окна класс есть');
  assert.equal(cards[23].hasClass('layer--render'), false, 'за окном — снят');
});

test('Task 33: на пустой сетке кнопки остаются в коллекции', function () {
  var g = openGrid(DISCOVER);
  g.h.fetchCalls[0].ok({ results: [], page: 1, total_pages: 1, total_results: 0 });
  g.comp.start();
  var ctrl = g.env.log.controllers.content;
  ctrl.toggle();
  var collection = g.env.log.collections[g.env.log.collections.length - 1];
  var back = g.root.all('lumen-grid__back')[0];
  assert.ok(collection.indexOf(back) >= 0, 'кнопка «Назад» достижима, хотя карточкой не является');
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

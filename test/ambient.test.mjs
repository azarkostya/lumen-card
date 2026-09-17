import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 22 (фаза 3): ambient-режим — кадры вместо статичного экрана после
   трёх минут без пульта.

   Чистая часть (sizeFor / nextIndex / playlist / canStart / clockText /
   normalizeFrames) проверяется без окружения. Жизненный цикл (таймер
   бездействия, сброс на активность, слой, смена кадров, выход по клавише,
   уборка ресурсов) — на фейковых document/Lampa/$/Image и подменяемых
   таймерах: модуль читает их в момент вызова, а не загрузки. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const SRC = readFileSync(new URL('../src/54_ambient.js', import.meta.url), 'utf8');
const UTIL = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', UTIL)(LC, module);
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const A = fresh().api;

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

test('sizeFor: узкий экран — w1280, широкий — original', () => {
  assert.equal(A.sizeFor(1366), 'w1280', 'ровно порог — ещё узкий');
  assert.equal(A.sizeFor(1280), 'w1280');
  assert.equal(A.sizeFor(1920), 'original');
  assert.equal(A.sizeFor(3840), 'original');
  assert.equal(A.sizeFor(0), 'w1280', 'размер неизвестен — дешёвый кадр');
  assert.equal(A.sizeFor(null), 'w1280');
});

test('nextIndex: по кругу, пустая и одиночная лента', () => {
  assert.equal(A.nextIndex(0, 3), 1);
  assert.equal(A.nextIndex(2, 3), 0);
  assert.equal(A.nextIndex(-1, 3), 0, 'до первого показа — нулевой кадр');
  assert.equal(A.nextIndex(0, 1), 0);
  assert.equal(A.nextIndex(0, 0), -1, 'кадров нет — показывать нечего');
});

test('normalizeFrames: оставляет только кадры с путём, чинит заголовок', () => {
  const list = [
    { media: 'movie', id: 1, title: 'Дюна', path: '/a.jpg', width: 3840 },
    { media: 'movie', id: 2, path: '/b.jpg' },
    { media: 'movie', id: 3, title: 'Без пути' },
    null,
    { path: '' },
    { url: 'https://host/c.jpg', title: 'Готовый адрес' }
  ];
  const out = A.normalizeFrames(list);
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { title: 'Дюна', path: '/a.jpg', url: '' });
  assert.equal(out[1].title, '', 'без названия — пустая подпись, кадр остаётся');
  assert.deepEqual(out[2], { title: 'Готовый адрес', path: '', url: 'https://host/c.jpg' });
  assert.deepEqual(A.normalizeFrames(null), []);
});

test('playlist: до size кадров без повторов, перемешанных rnd', () => {
  const frames = [];
  for (let i = 0; i < 20; i++) frames.push({ title: 't' + i, path: '/' + i + '.jpg', url: '' });
  const out = A.playlist(frames, 8, () => 0.5);
  assert.equal(out.length, 8);
  assert.equal(new Set(out.map((f) => f.path)).size, 8, 'один кадр не попадает в ленту дважды');
  assert.equal(A.playlist(frames.slice(0, 3), 8, Math.random).length, 3, 'кадров меньше размера — берём все');
  assert.deepEqual(A.playlist([], 8, Math.random), []);
});

test('playlist: разные броски rnd дают разный порядок', () => {
  const frames = [];
  for (let i = 0; i < 12; i++) frames.push({ title: 't' + i, path: '/' + i + '.jpg', url: '' });
  let seed = 0;
  const a = A.playlist(frames, 6, () => ((seed = (seed * 9301 + 49297) % 233280) / 233280));
  seed = 7;
  const b = A.playlist(frames, 6, () => ((seed = (seed * 9301 + 49297) % 233280) / 233280));
  assert.notDeepEqual(a.map((f) => f.path), b.map((f) => f.path));
});

const OK_STATE = {
  enabled: true, motion: 'full', hidden: false, modal: false,
  player: false, trailer: false, controller: 'content', frames: 12
};

test('canStart: обычный экран карточки — запускаемся', () => {
  assert.equal(A.canStart(OK_STATE), true);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { controller: 'full_start' })), true);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { controller: 'items_line' })), true);
});

test('canStart: выключенный плагин, настройка off и режим анимаций off', () => {
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { enabled: false })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { motion: 'off' })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { motion: 'lite' })), true, 'лёгкие анимации кадрам не мешают');
});

test('canStart: неактивная вкладка, модал, плеер, трейлер и чужой контроллер', () => {
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { hidden: true })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { modal: true })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { player: true })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { trailer: true })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { controller: 'select' })), false);
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { controller: '' })), false);
});

test('canStart: без кадров показывать нечего', () => {
  assert.equal(A.canStart(Object.assign({}, OK_STATE, { frames: 0 })), false);
  assert.equal(A.canStart(null), false);
});

test('clockText: часы и минуты с ведущим нулём', () => {
  assert.equal(A.clockText(new Date(2026, 8, 17, 9, 5)), '09:05');
  assert.equal(A.clockText(new Date(2026, 8, 17, 23, 40)), '23:40');
  assert.equal(A.clockText(new Date(2026, 8, 17, 0, 0)), '00:00');
  assert.equal(A.clockText(null), '');
});

/* ====================================================================== */
/* Жизненный цикл                                                         */
/* ====================================================================== */

/* Минимальный узел: ровно то, что модуль дёргает у jQuery-обёртки. */
function Node(cls) {
  this._class = (cls || '').split(/\s+/).filter(Boolean);
  this._children = [];
  this._parent = null;
  this._css = {};
  this._text = '';
  this.length = 1;
  this[0] = this;
}
Node.prototype.addClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { if (c && self._class.indexOf(c) === -1) self._class.push(c); });
  return this;
};
Node.prototype.removeClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { const i = self._class.indexOf(c); if (i !== -1) self._class.splice(i, 1); });
  return this;
};
Node.prototype.toggleClass = function (c, on) { return on ? this.addClass(c) : this.removeClass(c); };
Node.prototype.hasClass = function (c) { return this._class.indexOf(c) !== -1; };
Node.prototype.css = function (name, val) {
  if (name && typeof name === 'object') { for (const k in name) this.css(k, name[k]); return this; }
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
Node.prototype.text = function (t) {
  if (arguments.length < 1) return this._text;
  this._text = '' + t;
  return this;
};
Node.prototype.append = function (child) { child._parent = this; this._children.push(child); return this; };
Node.prototype.remove = function () {
  if (this._parent) {
    const i = this._parent._children.indexOf(this);
    if (i !== -1) this._parent._children.splice(i, 1);
    this._parent = null;
  }
  return this;
};
Node.prototype.find = function (sel) {
  const want = sel.split('.').filter(Boolean);
  const out = [];
  (function walk(node) {
    node._children.forEach((c) => {
      if (want.every((w) => c.hasClass(w))) out.push(c);
      walk(c);
    });
  })(this);
  const set = out.length ? out[0] : new Node('');
  set.length = out.length;
  set.all = out;
  set.eq = (i) => out[i] || new Node('');
  return set;
};
Node.prototype.eq = function (i) { return i === 0 ? this : new Node(''); };

function env(opts) {
  opts = opts || {};
  const store = Object.assign({
    lumen_ambient: 'true',
    lumen_ambient_source: 'curated',
    lumen_ambient_delay: '3'
  }, opts.store || {});

  const body = new Node('body');
  const listeners = [];
  const timers = [];
  const images = [];
  let seq = 1;

  const Lampa = {
    Storage: {
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) ? store[name] : def),
      set: (name, value) => { store[name] = value; },
      field: (name) => store[name]
    },
    Modal: { opened: () => !!opts.modal },
    Player: { opened: () => !!opts.player },
    Controller: { enabled: () => ({ name: opts.controller || 'content' }) },
    TMDB: { image: (u) => 'https://image.tmdb.org/' + u }
  };

  const $ = function (arg) {
    if (typeof arg === 'string' && arg.charAt(0) === '<') {
      const tags = arg.match(/<div[^>]*>/g) || [];
      const root = new Node((/class="([^"]*)"/.exec(tags[0]) || [])[1] || '');
      for (let i = 1; i < tags.length; i++) {
        root.append(new Node((/class="([^"]*)"/.exec(tags[i]) || [])[1] || ''));
      }
      return root;
    }
    if (arg === 'body') return body;
    if (typeof arg === 'string') {
      /* Селекторы живого трейлера — их модуль только считает. */
      const live = opts.trailer ? 1 : 0;
      return { length: live };
    }
    return arg;
  };

  globalThis.document = {
    hidden: !!opts.hidden,
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture: !!capture }),
    removeEventListener: (type, fn) => {
      for (let i = 0; i < listeners.length; i++) if (listeners[i].type === type && listeners[i].fn === fn) { listeners.splice(i, 1); return; }
    }
  };
  globalThis.window = {
    Lampa,
    $,
    innerWidth: opts.width || 1920,
    devicePixelRatio: opts.dpr || 1,
    screen: { width: opts.width || 1920 },
    Image: function () {
      const img = { src: '', onload: null, onerror: null };
      images.push(img);
      return img;
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.$ = $;

  /* LC.pref живёт в src/81_prefs.js — здесь его поведение (нормализация
     булевых строк 'true'/'false' Lampa) воспроизводится напрямую. */
  function pref(name, def) {
    const value = Object.prototype.hasOwnProperty.call(store, name) ? store[name] : def;
    if (value === undefined || value === null || value === '') return def;
    if (typeof def === 'boolean') return value === true || value === 'true' || value === 1 || value === '1';
    return value;
  }

  const { api, LC } = fresh(Object.assign({
    pref,
    enabled: () => opts.enabled !== false,
    motionMode: () => opts.motion || 'full',
    lang: (key) => key,
    manifest: { get: () => ({ ambient: opts.frames === undefined ? sample(12) : opts.frames }) }
  }, opts.lc || {}));

  api._timers = {
    set: (fn, ms) => { const id = seq++; timers.push({ id, fn, ms }); return id; },
    clear: (id) => { for (let i = 0; i < timers.length; i++) if (timers[i].id === id) { timers.splice(i, 1); return; } }
  };

  /* Сработать таймером с наибольшей задержкой из поставленных (в модуле их
     одновременно не больше одного на роль, а роли различаются задержкой). */
  function fire(ms) {
    for (let i = 0; i < timers.length; i++) {
      if (ms === undefined || timers[i].ms === ms) {
        const t = timers.splice(i, 1)[0];
        t.fn();
        return true;
      }
    }
    return false;
  }

  function send(type, event) {
    listeners.filter((l) => l.type === type).forEach((l) => l.fn(event || {}));
  }

  function layer() {
    for (let i = 0; i < body._children.length; i++) {
      if (body._children[i].hasClass('lumen-ambient')) return body._children[i];
    }
    return null;
  }

  return { api, LC, store, body, listeners, timers, images, fire, send, layer, $, Lampa };
}

function sample(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push({ media: 'movie', id: i, title: 'Фильм ' + i, path: '/f' + i + '.jpg', width: 3840 });
  return out;
}

test('install: один слушатель на тип события и один таймер бездействия', () => {
  const e = env();
  e.api.install();
  e.api.install();
  assert.equal(e.listeners.filter((l) => l.type === 'keydown').length, 1, 'повторный install подписки не удваивает');
  assert.equal(e.listeners.filter((l) => l.type === 'mousemove').length, 1);
  assert.equal(e.listeners.filter((l) => l.type === 'touchstart').length, 1);
  assert.equal(e.listeners.every((l) => l.capture), true, 'слушатели в capture — иначе выход не проглотит нажатие');
  assert.equal(e.timers.length, 1);
  assert.equal(e.timers[0].ms, 180000, 'три минуты по умолчанию');
  e.api.uninstall();
});

test('uninstall: ни слушателей, ни таймеров, ни слоя', () => {
  const e = env();
  e.api.install();
  e.fire();
  assert.ok(e.layer(), 'слой показан');
  e.api.uninstall();
  assert.equal(e.listeners.length, 0);
  assert.equal(e.timers.length, 0);
  assert.equal(e.layer(), null);
  assert.equal(e.api.active(), false);
});

test('schedule: любая активность сбрасывает таймер бездействия', () => {
  const e = env();
  e.api.install();
  const first = e.timers[0].id;
  e.send('keydown', { keyCode: 40 });
  assert.equal(e.timers.length, 1, 'таймер один, а не два');
  assert.notEqual(e.timers[0].id, first, 'таймер перезаведён');
  e.send('mousemove', {});
  assert.equal(e.timers.length, 1);
  e.api.uninstall();
});

test('delay: настройка задаёт задержку, живой хук _delayMs её перебивает', () => {
  const e = env({ store: { lumen_ambient_delay: '10' } });
  e.api.install();
  assert.equal(e.timers[0].ms, 600000);
  e.api.uninstall();
  e.api._delayMs = 3000;
  e.api.install();
  assert.equal(e.timers[0].ms, 3000);
  e.api._delayMs = 0;
  e.api.uninstall();
});

test('start: слой с двумя кадрами, названием и часами; первый кадр активен', () => {
  const e = env();
  e.api.install();
  e.fire();
  const node = e.layer();
  assert.ok(node);
  assert.equal(node.find('.lumen-ambient__img').length, 2, 'два кадра — для кроссфейда');
  assert.equal(node.find('.lumen-ambient__img.is-active').length, 1);
  assert.ok(node.find('.lumen-ambient__img.is-active').css('background-image').indexOf('image.tmdb.org') >= 0);
  assert.ok(/^\d\d:\d\d$/.test(node.find('.lumen-ambient__clock').text()));
  assert.ok(node.find('.lumen-ambient__title').text().indexOf('Фильм') === 0);
  assert.equal(e.api.active(), true);
  e.api.uninstall();
});

test('start: кадры просятся в размер экрана', () => {
  const wide = env({ width: 3840 });
  wide.api.install();
  wide.fire();
  assert.ok(wide.layer().find('.lumen-ambient__img.is-active').css('background-image').indexOf('t/p/original') >= 0);
  wide.api.uninstall();

  const narrow = env({ width: 1280 });
  narrow.api.install();
  narrow.fire();
  assert.ok(narrow.layer().find('.lumen-ambient__img.is-active').css('background-image').indexOf('t/p/w1280') >= 0);
  narrow.api.uninstall();
});

test('start: запрещённый момент слой не создаёт, но следующую попытку планирует', () => {
  for (const opts of [{ modal: true }, { player: true }, { hidden: true }, { controller: 'select' }, { trailer: true }, { motion: 'off' }, { enabled: false }]) {
    const e = env(opts);
    e.api.install();
    e.fire();
    assert.equal(e.layer(), null, JSON.stringify(opts));
    assert.equal(e.timers.length, 1, 'попытка перенесена, а не потеряна: ' + JSON.stringify(opts));
    e.api.uninstall();
  }
});

test('start: пустой список кадров — ambient не показывается', () => {
  const e = env({ frames: [] });
  e.api.install();
  e.fire();
  assert.equal(e.layer(), null);
  e.api.uninstall();
});

test('слайд: через 20 с активен второй кадр, следующий предзагружен', () => {
  const e = env();
  e.api.install();
  e.fire();
  const node = e.layer();
  const first = node.find('.lumen-ambient__img').all[0];
  const second = node.find('.lumen-ambient__img').all[1];
  assert.equal(first.hasClass('is-active'), true);
  assert.equal(e.images.length, 1, 'следующий кадр предзагружается сразу');
  e.fire(20000);
  assert.equal(second.hasClass('is-active'), true);
  assert.equal(first.hasClass('is-active'), false);
  assert.equal(e.images.length, 2);
  assert.equal(e.timers.length, 1, 'висит ровно один таймер смены кадра');
  e.api.uninstall();
});

test('слайд: точки-индикаторы отмечают текущий кадр ленты', () => {
  const e = env();
  e.api.install();
  e.fire();
  const dots = e.layer().find('.lumen-ambient__dot');
  assert.ok(dots.length > 1 && dots.length <= 8, 'лента сеанса ограничена');
  assert.equal(dots.all.filter((d) => d.hasClass('is-on')).length, 1);
  assert.equal(dots.all[0].hasClass('is-on'), true);
  e.fire(20000);
  assert.equal(e.layer().find('.lumen-ambient__dot').all[1].hasClass('is-on'), true);
  e.api.uninstall();
});

test('слайд: скрытая вкладка кадры не листает и картинок не грузит', () => {
  const e = env();
  e.api.install();
  e.fire();
  const before = e.images.length;
  globalThis.document.hidden = true;
  e.fire(20000);
  assert.equal(e.images.length, before, 'в фоне ничего не предзагружаем');
  assert.equal(e.timers.length, 1, 'таймер продолжает жить — вкладка вернётся');
  e.api.uninstall();
});

test('выход: первое нажатие проглатывается и снимает слой', () => {
  const e = env();
  e.api.install();
  e.fire();
  let prevented = 0;
  let stopped = 0;
  e.send('keydown', { keyCode: 40, preventDefault: () => prevented++, stopPropagation: () => stopped++ });
  assert.equal(prevented, 1, 'нажатие не должно двигать фокус под слоем');
  assert.equal(stopped, 1);
  assert.equal(e.layer().hasClass('is-out'), true, 'слой уходит плавно');
  assert.equal(e.api.active(), false, 'режим уже не активен — второе нажатие пройдёт к Lampa');
  e.fire(400);
  assert.equal(e.layer(), null);
  assert.equal(e.timers.length, 1, 'после выхода снова ждём бездействия');
  e.api.uninstall();
});

test('выход: второе нажатие уже не перехватывается', () => {
  const e = env();
  e.api.install();
  e.fire();
  e.send('keydown', { keyCode: 40, preventDefault: () => {}, stopPropagation: () => {} });
  let prevented = 0;
  e.send('keydown', { keyCode: 40, preventDefault: () => prevented++, stopPropagation: () => {} });
  assert.equal(prevented, 0);
  e.api.uninstall();
});

test('выход: мышь и тач тоже снимают слой, но нажатие не глотают', () => {
  const e = env();
  e.api.install();
  e.fire();
  let prevented = 0;
  e.send('mousemove', { preventDefault: () => prevented++ });
  assert.equal(prevented, 0, 'мышь — не пульт, отменять нечего');
  assert.equal(e.api.active(), false);
  e.api.uninstall();
});

test('stop: слой, таймеры и незавершённая предзагрузка уходят разом', () => {
  const e = env();
  e.api.install();
  e.fire();
  const pending = e.images[e.images.length - 1];
  e.api.stop();
  assert.equal(e.layer(), null);
  assert.equal(pending.onload, null, 'картинка не должна оживить снятый слой');
  assert.equal(pending.onerror, null);
  assert.equal(e.timers.filter((t) => t.ms === 20000).length, 0, 'смена кадров остановлена');
  e.api.uninstall();
});

test('apply: выключенная настройка снимает режим целиком, включённая возвращает', () => {
  const e = env({ store: { lumen_ambient: 'false' } });
  e.api.apply();
  assert.equal(e.listeners.length, 0, 'выключенный ambient не подписывается вовсе');
  e.store.lumen_ambient = 'true';
  e.api.apply();
  assert.equal(e.listeners.filter((l) => l.type === 'keydown').length, 1);
  e.fire();
  assert.ok(e.layer());
  e.store.lumen_ambient = 'false';
  e.api.apply();
  assert.equal(e.layer(), null, 'открытый слой уходит сразу');
  assert.equal(e.listeners.length, 0);
  assert.equal(e.timers.length, 0);
});

test('apply: смена задержки перезаводит таймер на новое значение', () => {
  const e = env();
  e.api.install();
  assert.equal(e.timers[0].ms, 180000);
  e.store.lumen_ambient_delay = '5';
  e.api.apply();
  assert.equal(e.timers.length, 1);
  assert.equal(e.timers[0].ms, 300000);
  e.api.uninstall();
});

test('источник «кадры текущего фильма»: берёт кадры открытой карточки', () => {
  const urls = ['https://host/one.jpg', 'https://host/two.jpg', 'https://host/three.jpg'];
  const layerNode = new Node('lumen-backdrop');
  layerNode.data = (key) => (key === 'lumenUrls' ? urls : null);
  const bodyNode = new Node('activity__body');
  bodyNode.children = () => layerNode;
  const e = env({
    store: { lumen_ambient_source: 'current' },
    lc: { active: { body: bodyNode, data: { movie: { title: 'Дюна' } } } }
  });
  e.api.install();
  e.fire();
  const img = e.layer().find('.lumen-ambient__img.is-active');
  assert.ok(img.css('background-image').indexOf('https://host/') >= 0, 'кадр карточки, а не каталога');
  assert.equal(e.layer().find('.lumen-ambient__title').text(), 'Дюна');
  e.api.uninstall();
});

test('источник «кадры текущего фильма»: без открытой карточки — курируемые кадры', () => {
  const e = env({ store: { lumen_ambient_source: 'current' } });
  e.api.install();
  e.fire();
  assert.ok(e.layer().find('.lumen-ambient__img.is-active').css('background-image').indexOf('image.tmdb.org') >= 0);
  e.api.uninstall();
});

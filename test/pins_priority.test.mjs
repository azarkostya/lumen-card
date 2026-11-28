import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Аудит 2026-11-28 (Codex, data-pins-priority): «Моя раздача», выбранная
   приоритетным источником, недоступна с пульта. Lampa клонирует кнопку из
   .buttons--container в верхний ряд (Buttons.onPriorityButton), а коллекция
   фокуса берёт только .selector (Controller.collectionSet). Здесь работают
   настоящие Buttons и collectionSet из vendor/lampa/app.min.js на подменённом
   DOM; кнопку рисует настоящий LC.header.refreshPins. */

const read = (path) => readFileSync(new URL('../' + path, import.meta.url), 'utf8');
const vendor = read('vendor/lampa/app.min.js');
const buttonsSource = vendor.slice(vendor.indexOf('  var Buttons = {'), vendor.indexOf('  var Start =', vendor.indexOf('  var Buttons = {')));
const collectionSource = vendor.slice(vendor.indexOf('  function collectionSet(html)'), vendor.indexOf('  function collectionAppend(append)'));
const LABEL = 'Моя раздача';

function scene(priority = '') {
  const make = (classes, text = '') => ({ classes: new Set(classes.split(' ')), text, children: [], data: {}, events: {} });
  const root = make('lumen-card');
  const row = make('full-start-new__buttons');
  const group = make('buttons--container hide');
  const play = make('full-start__button selector button--play');
  const normal = make('full-start__button selector view--torrent', 'Торренты');
  const is = (el, selector) => selector.split('.').filter(Boolean).every((cls) => el.classes.has(cls));
  const all = () => [row, group, ...row.children, ...group.children];
  function append(parent, child, first = false) {
    child.parent = parent;
    if (first) parent.children.unshift(child);
    else parent.children.push(child);
  }
  append(root, row);
  append(root, group);
  append(row, play);
  append(group, normal);
  root.data.lumenMetaMovie = { id: 1, title: 'A film' };
  root.querySelectorAll = (selector) => all().filter((el) => is(el, selector));

  class JQ extends Array {
    find(selector) {
      if (selector === 'svg') return $();
      if (selector === 'span') return $(this[0]);
      if (selector === '.buttons--container > .full-start__button') return $(group.children.filter((el) => is(el, '.full-start__button')));
      const area = this[0] === root ? all() : this[0]?.children ?? [];
      return $(area.filter((el) => is(el, selector)));
    }
    not(selector) { return $(Array.from(this).filter((el) => !is(el, selector))); }
    filter(fn) { return $(Array.from(this).filter((el) => fn.call(el))); }
    each(fn) { this.forEach((el) => fn.call(el)); return this; }
    eq(index) { return $(this[index]); }
    remove() { this.each(function () { this.parent.children.splice(this.parent.children.indexOf(this), 1); }); return this; }
    on(event, fn) { this.each(function () { this.events[event.split('.')[0]] = fn; }); return this; }
    off(event) { this.each(function () { delete this.events[event.split('.')[0]]; }); return this; }
    unbind() { this.each(function () { this.events = {}; }); return this; }
    trigger(event) { this.each(function () { this.events[event]?.(); }); return this; }
    data(key, value) { if (value === undefined) return this[0]?.data[key]; this[0].data[key] = value; return this; }
    text(value) { if (value === undefined) return this[0]?.text; this[0].text = value; return this; }
    prepend(child) { append(this[0], child[0], true); return this; }
    clone() { return $(make([...this[0].classes].join(' '), this[0].text)); }
    addClass(cls) { this.each(function () { this.classes.add(cls); }); return this; }
    removeClass(cls) { this.each(function () { this.classes.delete(cls); }); return this; }
    toggleClass(cls, enabled) { return enabled ? this.addClass(cls) : this.removeClass(cls); }
    /* outerHTML подмены: классы в порядке разметки и текст — Lampa хэширует
       его как есть (hash ниже — тождество, чтобы сверять строки глазами). */
    prop(name) { return name === 'outerHTML' && this[0] ? `${[...this[0].classes].join(' ')} ${this[0].text}` : undefined; }
  }
  function $(value) {
    const set = new JQ();
    if (value === '.lumen-card') set.push(root);
    else if (typeof value === 'string') set.push(make(value.match(/class="([^"]+)"/)[1]));
    else if (Array.isArray(value)) set.push(...value);
    else if (value) set.push(value);
    return set;
  }

  const store = { full_btn_priority: priority };
  const Storage = { get: (key, d) => Object.hasOwn(store, key) ? store[key] : d, set: (key, value) => { store[key] = value; } };
  const Utils = { hash: (value) => value };
  globalThis.Lampa = { Storage, Utils };
  globalThis.warn = () => {};
  const LC = { cardinfo: {}, lang: () => LABEL, pins: { get: () => ({ key: 'movie:1' }), subtitle: () => '' } };
  new Function('LC', '$', read('src/85_header.js'))(LC, $);

  let dialog;
  let targets;
  let openedNormal = 0;
  normal.events['hover:enter'] = () => { openedNormal++; };
  const Select = { show: (params) => { dialog = params; } };
  const Navigator = { setCollection: (nodes) => { targets = nodes; } };
  const collectionSet = new Function('jQuery', 'Navigator', 'clearSelects', `${collectionSource}\nreturn collectionSet;`)(JQ, Navigator, () => {});
  let buttons;
  const instance = { html: $(root), emit: (event, item) => buttons.onPriorityButton.call(instance, item) };
  /* Controller.toggle('content') у карточки — это toggle контроллера Start:
     groupButtons и сбор коллекции фокуса (app.min.js, Start.toggle). */
  const Controller = { toggle: () => { buttons.onGroupButtons.call(instance); collectionSet(root); } };
  buttons = new Function('$', 'Storage', 'Utils$1', 'Select', 'Lang', 'Controller', `${buttonsSource}\nreturn Buttons;`)(
    $, Storage, Utils, Select, { translate: (key) => key }, Controller
  );
  return {
    LC, root, row, group, play, store, instance, buttons, Controller,
    pin: () => group.children.find((el) => el.classes.has('view--lumen-pin')),
    clone: () => row.children.find((el) => el.classes.has('button--priority')),
    dialog: () => dialog, targets: () => targets, openedNormal: () => openedNormal,
    watch: () => { dialog = null; $(play).trigger('hover:enter'); return dialog; }
  };
}

test('приоритетная «Моя раздача» — в коллекции пульта; сброс приоритета возвращает всё как было', () => {
  const s = scene();
  s.LC.header.refreshPins();
  const pin = s.pin();
  assert.ok(pin, 'кнопка закрепа в контейнере источников');
  s.Controller.toggle();
  assert.ok(!s.clone());
  assert.equal(s.watch().items.length, 2);
  assert.equal(s.dialog().items[0].btn[0], pin);

  s.dialog().onLong(s.dialog().items[0]);
  s.Controller.toggle();
  const clone = s.clone();
  assert.ok(clone, 'копия кнопки в верхнем ряду');
  assert.ok(s.targets().includes(clone), 'копия «Моя раздача» досягаема с пульта');
  assert.ok(s.targets().includes(s.play));
  s.watch();
  assert.equal(s.openedNormal(), 1, '«Смотреть» при одном оставшемся источнике открывает обычные «Торренты»');

  /* Сброс приоритета — удержание OK на копии (штатный hover:long Lampa). */
  clone.events['hover:long']();
  assert.equal(s.store.full_btn_priority, '');
  assert.ok(!s.clone(), 'копия ушла из верхнего ряда');
  assert.ok(!s.targets().includes(clone));
  assert.ok(s.targets().includes(s.play));
  assert.equal(s.watch().items.length, 2, '«Моя раздача» снова в списке источников');
  assert.equal(s.dialog().items[0].btn[0], pin);
});

test('приоритет, выбранный до правки (кнопка без selector), переживает обновление', () => {
  const legacy = 'full-start__button view--lumen-pin ' + LABEL;
  const s = scene(legacy);
  s.LC.header.refreshPins();
  assert.equal(s.store.full_btn_priority, 'full-start__button selector view--lumen-pin ' + LABEL);
  s.Controller.toggle();
  assert.ok(s.clone(), 'копия в верхнем ряду при открытии карточки');
  assert.ok(s.targets().includes(s.clone()));
});

test('чужой приоритет кнопка закрепа не трогает', () => {
  const s = scene('full-start__button selector view--torrent Торренты');
  s.LC.header.refreshPins();
  assert.equal(s.store.full_btn_priority, 'full-start__button selector view--torrent Торренты');
});

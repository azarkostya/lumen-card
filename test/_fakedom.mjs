/* Task 6 (fix, обзор координатора п.6): общий фейковый DOM для
   test/backdrops.test.mjs, test/slideshow.test.mjs и test/runtime.test.mjs —
   раньше в каждом файле была своя почти идентичная копия FakeEl/fakeQuery/
   EMPTY. Имя начинается с "_" и не оканчивается на ".test.mjs" — глоб
   node --test "test/*.test.mjs" его не подхватывает и не пытается
   запустить как тест-файл.

   Поддерживает то, что реально дёргают src/50_backdrops.js, src/
   51_slideshow.js и src/90_runtime.js на своих layer/body/activity-
   объектах: addClass/removeClass/toggleClass/hasClass, css (get при 1
   аргументе, set при 2), data (get/set)/removeData, append/prepend/empty,
   children(sel) — первый ПРЯМОЙ ребёнок с классом (или EMPTY, как
   настоящий jQuery для непустого набора), find(sel) — первый найденный на
   ЛЮБОЙ глубине (или EMPTY) — глубже, чем строго нужно текущим тестам с
   плоской разметкой, но так вернее совпадает с настоящим jQuery.find() и
   заодно годится для вложенной .activity -> .activity__body ->
   .lumen-backdrop из runtime.test.mjs. parent() — реальный родитель (или
   EMPTY), проставляется конструктором/append/prepend. closest(sel) —
   ЗАГЛУШКА через el._closestActivity, а не обход parent(): тестам
   достаточно смоделировать «слой внутри активной/архивной .activity», не
   строя целое родительское поддерево ради одной проверки. */

export function classList(tagHtml) {
  const m = /class="([^"]*)"/.exec(tagHtml || '');
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

export function FakeEl(classes, children) {
  this._class = classes || [];
  this._children = children || [];
  this._data = {};
  this._css = {};
  this.length = 1;
  this[0] = this;
  this._parentEl = null;
  const self = this;
  this._children.forEach((c) => { c._parentEl = self; });
}
FakeEl.prototype.hasClass = function (c) { return this._class.indexOf(c) !== -1; };
FakeEl.prototype.addClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { if (c && self._class.indexOf(c) === -1) self._class.push(c); });
  return this;
};
FakeEl.prototype.removeClass = function (list) {
  const self = this;
  ('' + list).split(/\s+/).forEach((c) => { const i = self._class.indexOf(c); if (i !== -1) self._class.splice(i, 1); });
  return this;
};
FakeEl.prototype.toggleClass = function (c, on) { if (on) this.addClass(c); else this.removeClass(c); return this; };
FakeEl.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
FakeEl.prototype.data = function (key, val) {
  if (arguments.length < 2) return this._data[key];
  this._data[key] = val;
  return this;
};
FakeEl.prototype.removeData = function (key) { delete this._data[key]; return this; };
FakeEl.prototype.append = function (child) { const el = toEl(child); el._parentEl = this; this._children.push(el); return this; };
FakeEl.prototype.prepend = function (child) { const el = toEl(child); el._parentEl = this; this._children.unshift(el); return this; };
FakeEl.prototype.empty = function () { this._children = []; return this; };
/* Ревью (3-й раунд, п.2): .remove() — как настоящий jQuery, убирает СЕБЯ
   из массива детей родителя (по _parentEl, который append()/prepend()/
   конструктор уже проставляют) точечно — соседей не трогает. Нужен
   LC.backdrops.revive() (50_backdrops.js): таймер уборки старого кадра
   после revive() должен снести ИМЕННО его, а не всё содержимое
   .lumen-bg__slides (иначе снёс бы кадры уже НОВОГО контроллера, если тот
   успеет провернуть ротацию раньше, чем таймер сработает — репро R5). */
FakeEl.prototype.remove = function () {
  if (this._parentEl) {
    const idx = this._parentEl._children.indexOf(this);
    if (idx !== -1) this._parentEl._children.splice(idx, 1);
    this._parentEl = null;
  }
  return this;
};
FakeEl.prototype.parent = function () { return this._parentEl || EMPTY; };
FakeEl.prototype.closest = function (sel) {
  if (sel === '.activity' && this._closestActivity) return this._closestActivity;
  return EMPTY;
};
/* Ревью (fix, Important 3): составной селектор вида '.lumen-bg__img.is-active'
   (класс на класс, без пробела — "элемент с ОБОИМИ классами") раньше
   резался только по первой точке (sel.replace(/^\./, '')), а остаток
   ("lumen-bg__img.is-active" целиком) никогда не совпадал ни с одним
   hasClass() — составные селекторы в 50_backdrops.js (LC.backdrops.revive)
   тихо никогда не находили ничего, тесты на этом молча шли по запасной
   (пустой) ветке. selectorClasses разбивает ЛЮБОЕ число точек на список
   классов, matchesSelector требует совпадения всех. */
function selectorClasses(sel) {
  return sel.split('.').filter(Boolean);
}
function matchesSelector(el, classes) {
  for (let i = 0; i < classes.length; i++) if (!el.hasClass(classes[i])) return false;
  return true;
}
FakeEl.prototype.children = function (sel) {
  const classes = selectorClasses(sel);
  for (let i = 0; i < this._children.length; i++) if (matchesSelector(this._children[i], classes)) return this._children[i];
  return EMPTY;
};
FakeEl.prototype.find = function (sel) {
  const classes = selectorClasses(sel);
  function search(node) {
    for (let i = 0; i < node._children.length; i++) {
      const c = node._children[i];
      if (matchesSelector(c, classes)) return c;
      const found = search(c);
      if (found) return found;
    }
    return null;
  }
  return search(this) || EMPTY;
};

export const EMPTY = {
  length: 0,
  addClass() { return this; }, removeClass() { return this; }, toggleClass() { return this; }, css() { return this; },
  data() { }, removeData() { return this; }, empty() { return this; }, hasClass() { return false; },
  find() { return EMPTY; }, children() { return EMPTY; }, append() { return this; }, closest() { return EMPTY; },
  parent() { return EMPTY; }, remove() { return this; }
};

export function toEl(x) {
  if (x instanceof FakeEl) return x;
  return new FakeEl(classList(String(x)));
}

/* Плоский разбор: первый <div> — корень, остальные — его ПРЯМЫЕ дети (в
   порядке появления). Вложенность в самой HTML-строке не моделируется —
   этого достаточно для разметки, которую строит ensureLayer() в
   src/50_backdrops.js ($('<div class="lumen-backdrop">...</div>')). */
export function fakeQuery(html) {
  const tags = String(html).match(/<div[^>]*>/g) || [];
  const root = new FakeEl(classList(tags[0]));
  for (let i = 1; i < tags.length; i++) {
    const child = new FakeEl(classList(tags[i]));
    child._parentEl = root;
    root._children.push(child);
  }
  return root;
}

export function fakeBody() { return new FakeEl(['body-mock']); }
export function mount(el) { el._mounted = true; return el; }

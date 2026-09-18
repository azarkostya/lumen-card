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
  /* Task 8: инлайн-стиль узла как в DOM — src/85_header.js ставит подпись
     кнопки «Смотреть» CSS-переменной через root[0].style.setProperty (текст
     кнопки трогать нельзя, её outerHTML хэширует Lampa). Пишем в тот же
     _css/style, что и jQuery-подобный css(), чтобы ловушка пустого style=""
     (clearInlineStyleIfEmpty) проверялась и здесь. */
  this.style = {
    setProperty(name, value) { self._css[name] = value; syncStyleAttr(self); },
    removeProperty(name) { delete self._css[name]; syncStyleAttr(self); }
  };
}
function syncStyleAttr(el) {
  if (!el._attr) el._attr = {};
  el._attr.style = Object.keys(el._css)
    .filter((k) => el._css[k] !== '' && el._css[k] != null)
    .map((k) => k + ':' + el._css[k])
    .join(';');
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
/* Task 5c: css({…}) объектом (как jQuery) и зеркало инлайн-стиля в атрибуте
   style — пустое значение свойство убирает, но сам атрибут остаётся "" (как в
   браузере: ловушка style="", см. clearInlineStyleIfEmpty в 50_backdrops.js). */
FakeEl.prototype.css = function (name, val) {
  if (name && typeof name === 'object') {
    for (const k in name) this.css(k, name[k]);
    return this;
  }
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  syncStyleAttr(this);
  return this;
};
FakeEl.prototype.data = function (key, val) {
  if (arguments.length < 2) return this._data[key];
  this._data[key] = val;
  return this;
};
FakeEl.prototype.removeData = function (key) { delete this._data[key]; return this; };
/* Task 31: attr (get при 1 аргументе, set при 2) / removeAttr — нужны
   src/64_menus.js для data-lumen-kind на корне .selectbox. */
FakeEl.prototype.attr = function (name, val) {
  if (!this._attr) this._attr = {};
  if (arguments.length < 2) return this._attr[name];
  this._attr[name] = '' + val;
  return this;
};
FakeEl.prototype.removeAttr = function (name) { if (this._attr) delete this._attr[name]; return this; };
/* Task 5c (src/85_header.js, ряд серий): DOM-подобные getAttribute/removeAttribute
   (узел — сам себе [0]); text/html — html разбирает div-теги плоско, как
   fakeQuery, и считает перезаписи (_htmlSets); next/before — перенос статуса в
   ленту; eq/not/trigger — OK на «Смотреть»; addEventListener/
   removeEventListener — слушатели в capture на корне карточки и на корне
   активности (вызываются тестом вручную). */
FakeEl.prototype.getAttribute = function (name) {
  return this._attr && Object.prototype.hasOwnProperty.call(this._attr, name) ? this._attr[name] : null;
};
FakeEl.prototype.removeAttribute = function (name) { if (this._attr) delete this._attr[name]; };
FakeEl.prototype.text = function (t) {
  if (arguments.length < 1) return this._text || '';
  this._text = '' + t;
  return this;
};
FakeEl.prototype.html = function (s) {
  if (arguments.length < 1) return this._html || '';
  const self = this;
  this._html = '' + s;
  this._htmlSets = (this._htmlSets || 0) + 1;
  this._children = (this._html.match(/<div[^>]*>/g) || []).map((tag) => {
    const c = new FakeEl(classList(tag));
    c._parentEl = self;
    return c;
  });
  return this;
};
FakeEl.prototype.next = function () {
  const p = this._parentEl;
  if (!p) return EMPTY;
  return p._children[p._children.indexOf(this) + 1] || EMPTY;
};
FakeEl.prototype.before = function (child) {
  const el = toEl(child);
  const p = this._parentEl;
  if (!p) return this;
  el.remove();
  p._children.splice(p._children.indexOf(this), 0, el);
  el._parentEl = p;
  return this;
};
FakeEl.prototype.eq = function (i) { return i === 0 ? this : EMPTY; };
FakeEl.prototype.not = function (sel) { return matchesSelector(this, selectorClasses(sel)) ? EMPTY : this; };
FakeEl.prototype.trigger = function (name) { (this._triggered = this._triggered || []).push(name); return this; };
FakeEl.prototype.addEventListener = function (type, fn, capture) {
  (this._listeners = this._listeners || []).push({ type: type, fn: fn, capture: !!capture });
};
/* Task 37: снятие слушателя — как в DOM, по тройке «тип, та же функция, та
   же фаза». Герой главной (src/48_hero.js) ловит фокус capture-слушателем на
   корне активности, и утечка подписки после unmount обязана быть видна
   тестом: без removeEventListener её ничем не отличить от живой. */
FakeEl.prototype.removeEventListener = function (type, fn, capture) {
  const list = this._listeners || [];
  for (let i = 0; i < list.length; i++) {
    if (list[i].type === type && list[i].fn === fn && list[i].capture === !!capture) { list.splice(i, 1); return; }
  }
};
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
  /* Долг ревью Task 5c (п.3): заглушка '.activity' действует только там, где
     тест её явно задал (_closestActivity) — иначе спец-ветка перекрывала бы
     честный обход предков и прятала бы реальную разметку .activity в тестах,
     которые её строят. */
  if (sel === '.activity' && this._closestActivity) return this._closestActivity;
  /* Task 5c: остальные селекторы — настоящий обход себя и предков. */
  const classes = selectorClasses(sel);
  for (let el = this; el; el = el._parentEl) if (matchesSelector(el, classes)) return el;
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
/* Task 10: селектор может отсутствовать вовсе — jQuery .children() без
   аргумента отдаёт ВСЕХ прямых детей (наш фейк, как и с селектором, отдаёт
   первого: этого хватает связке .children().eq(0), которой src/90_runtime.js
   пишет число в чип рейтинга КП, не трогая разметку кнопок). */
function selectorClasses(sel) {
  return String(sel == null ? '' : sel).split('.').filter(Boolean);
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
  parent() { return EMPTY; }, remove() { return this; },
  /* Долг ревью Task 5c (п.3): html() у пустого набора возвращает '' — как
     text(), а не сам набор: иначе чтение html() пустого узла давало объект,
     и проверка вида html().indexOf(...) молча шла не по той ветке. */
  text() { return ''; }, html() { return ''; }, next() { return EMPTY; }, before() { return this; },
  eq() { return EMPTY; }, not() { return EMPTY; }, trigger() { return this; }, attr() { }
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

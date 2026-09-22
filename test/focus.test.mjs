import test from 'node:test'; import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { load } from './_load.mjs';

const F = load('11_focus.js');

/* ------------------------------- EVENTS ---------------------------------- */

test('LC.focus.EVENTS: оба события фокуса Lampa, пульт и мышь', () => {
  assert.deepEqual(F.EVENTS, ['hover:focus', 'hover:hover']);
});

/* Ревью волны A (М1). У штатной карточки Lampa имён ТРИ: к 'hover:focus' и
   'hover:hover' добавлен 'hover:touch', и watched() зовут все три
   (app.min.js:52323-52337). Третьего имени у нас нет сознательно — разбор
   в шапке src/11_focus.js. Сторож держит обе половины решения: имя в EVENTS
   не появляется молча, а первоисточник у Lampa остаётся тем же, каким его
   прочли. */
test('М1: у Lampa три имени, у нас два — решение про hover:touch зафиксировано', () => {
  const lampa = readFileSync(new URL('../vendor/lampa/app.min.js', import.meta.url), 'utf8');
  const at = lampa.indexOf("this.card.addEventListener('hover:focus'");
  assert.notEqual(at, -1, 'создание карточки Lampa не найдено');
  const block = lampa.slice(at, at + 700);
  const names = (block.match(/addEventListener\('(hover:[a-z]+)'/g) || [])
    .map((m) => /'(hover:[a-z]+)'/.exec(m)[1]);
  assert.deepEqual(names.slice(0, 4), ['hover:focus', 'hover:touch', 'hover:hover', 'hover:enter'],
    'набор слушателей карточки Lampa изменился — комментарий в src/11_focus.js обязан измениться вместе с ним');
  assert.equal(F.EVENTS.indexOf('hover:touch'), -1,
    'hover:touch попал в EVENTS — это снятие ограничения, и оно требует живой проверки на тач-устройстве');
});

/* --------------------------------- on ------------------------------------ */

function jqNode() {
  const ev = {};
  return {
    _ev: ev,
    on(name, fn) { (ev[name] = ev[name] || []).push(fn); return this; },
    fire(name, arg) { (ev[name] || []).forEach((fn) => fn(arg)); }
  };
}

test('LC.focus.on: обработчик встаёт на оба события и зовётся каждым из них', () => {
  const node = jqNode();
  const seen = [];
  const back = F.on(node, (e) => seen.push(e && e.type));
  assert.equal(back, node, 'возвращает узел — для цепочек watchFocus/railChip');
  assert.deepEqual(Object.keys(node._ev).sort(), ['hover:focus', 'hover:hover']);
  node.fire('hover:focus', { type: 'hover:focus' });
  assert.deepEqual(seen, ['hover:focus'], 'пульт');
  node.fire('hover:hover', { type: 'hover:hover' });
  assert.deepEqual(seen, ['hover:focus', 'hover:hover'], 'мышь');
});

test('LC.focus.on: на каждое событие ровно одна подписка — обработчик не задваивается', () => {
  const node = jqNode();
  let calls = 0;
  F.on(node, () => { calls++; });
  node.fire('hover:focus');
  node.fire('hover:hover');
  assert.equal(calls, 2, 'два РАЗНЫХ события — два вызова, но каждое по одному разу');
  assert.equal(node._ev['hover:focus'].length, 1);
  assert.equal(node._ev['hover:hover'].length, 1);
});

test('LC.focus.on: цель без .on не роняет вызов', () => {
  assert.doesNotThrow(() => F.on(null, () => {}));
  assert.doesNotThrow(() => F.on({}, () => {}));
});

/* ---------------------------- capture / release --------------------------- */

function domNode() {
  const list = [];
  return {
    _listeners: list,
    addEventListener(type, fn, capture) { list.push({ type, fn, capture: !!capture }); },
    removeEventListener(type, fn, capture) {
      for (let i = 0; i < list.length; i++) {
        if (list[i].type === type && list[i].fn === fn && list[i].capture === !!capture) { list.splice(i, 1); return; }
      }
    }
  };
}

test('LC.focus.capture: оба события в фазе ЗАХВАТА — события Lampa не всплывают', () => {
  const el = domNode();
  const fn = () => {};
  assert.equal(F.capture(el, fn), true);
  assert.deepEqual(el._listeners.map((l) => l.type).sort(), ['hover:focus', 'hover:hover']);
  assert.ok(el._listeners.every((l) => l.capture === true), 'обе подписки в захвате');
  assert.ok(el._listeners.every((l) => l.fn === fn), 'обе — та же функция');
});

test('LC.focus.release: снимает обе подписки — тем же типом, функцией и фазой', () => {
  const el = domNode();
  const fn = () => {};
  F.capture(el, fn);
  assert.equal(F.release(el, fn), true);
  assert.deepEqual(el._listeners, [], 'после снятия живых подписок не остаётся');
});

test('LC.focus.release: чужой обработчик не снимается', () => {
  const el = domNode();
  const mine = () => {};
  F.capture(el, mine);
  F.release(el, () => {});
  assert.equal(el._listeners.length, 2, 'снимается только та же функция');
});

test('LC.focus.capture/release: узел без addEventListener не роняет вызов', () => {
  assert.equal(F.capture(null, () => {}), false);
  assert.equal(F.capture({}, () => {}), false);
  assert.equal(F.release(null, () => {}), false);
  assert.equal(F.release({}, () => {}), false);
});

/* ------------------------------- сторож ---------------------------------- */

/* Сторож единого механизма. Имена событий фокуса Lampa живут ровно в одном
   месте — LC.focus.EVENTS (src/11_focus.js). Любая новая подписка в обход
   хелпера (в том числе одиночная, только на 'hover:focus' — её мышь не
   увидит, vendor/lampa/app.min.js:46360-46364) упомянет имя события в своём
   модуле и здесь же и упадёт.

   Смотрим в dist, а не в src: сборка вычищает комментарии (scripts/build.mjs
   -> stripComments), а про hover:focus и hover:hover в src/ много написано
   текстом — запрещать упоминание в комментарии смысла нет. Отдельный файл
   src/*.js сам по себе не парсится: модули — куски тела общей IIFE, которую
   открывает 00_head.js и закрывает 99_tail.js. Срез по маркерам — тот же
   приём, что в test/build.test.mjs; расхождение dist и src ловят
   «строки dist совпадают со строками src» там же и `build.mjs --check`. */
const dist = readFileSync(new URL('../dist/lumen_card.js', import.meta.url), 'utf8');
const FOCUS_NAME_RE = /hover:(?:focus|hover)/g;

function moduleOf(name) {
  const marker = '/* ---- ' + name + ' ---- */';
  const from = dist.indexOf(marker);
  assert.ok(from >= 0, 'в dist нет маркера ' + name);
  const start = from + marker.length;
  const next = dist.indexOf('/* ---- ', start);
  return dist.slice(start, next < 0 ? dist.length : next);
}

test('сторож: имена событий фокуса встречаются в коде только в src/11_focus.js', () => {
  const files = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^\d\d_.*\.js$/.test(f));
  const offenders = [];
  for (const f of files) {
    if (f === '11_focus.js') continue;
    const hits = moduleOf(f).match(FOCUS_NAME_RE);
    if (hits) offenders.push(f + ': ' + hits.join(', '));
  }
  assert.deepEqual(offenders, [], 'подписка на фокус — только через LC.focus (on/capture/release)');
});

test('сторож: src/11_focus.js действительно держит оба имени', () => {
  const code = moduleOf('11_focus.js');
  assert.ok(/'hover:focus'/.test(code), "в модуле нет 'hover:focus'");
  assert.ok(/'hover:hover'/.test(code), "в модуле нет 'hover:hover'");
});

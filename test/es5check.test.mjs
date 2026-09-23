import test from 'node:test';
import assert from 'node:assert/strict';
import { check } from '../scripts/es5check.mjs';

/* ------------------------------------------------------------------ */
/* (а) Запрещённые конструкции — каждая по отдельности даёт >=1 находку. */
/* ------------------------------------------------------------------ */

var FORBIDDEN = [
  // -- синтаксис ES2015+: ловит acorn.parse(..., { ecmaVersion: 5 }) --
  ['стрелочная функция', 'var f = function (x) { return x; }; var g = (x) => x;'],
  ['let', 'let x = 1;'],
  ['const', 'const x = 1;'],
  ['шаблонная строка', 'var s = `hi`;'],
  ['класс', 'class Foo {}'],
  ['spread в вызове', 'f(...args);'],
  ['деструктуризация', 'var [a, b] = [1, 2];'],
  ['дефолтные параметры', 'function f(a = 1) { return a; }'],
  ['короткий метод в объекте', 'var o = { foo() { return 1; } };'],
  ['короткое свойство в объекте', 'var b = 1; var o = { b };'],
  ['вычисляемый ключ', 'var key = "a"; var o = { [key]: 1 };'],
  ['нулевое слияние ??', 'var a, b; var x = a ?? b;'],
  ['опциональная цепочка ?.', 'var a; var x = a?.b;'],
  ['возведение в степень **', 'var a = 2, b = 3; var x = a ** b;'],
  ['генератор', 'function* gen() { yield 1; }'],
  ['catch без параметра', 'try { doIt(); } catch { }'],
  ['числовой разделитель 1_000', 'var n = 1_000;'],
  ['флаг регэкспа /u', 'var re = /a/u;'],
  ['import', "import x from 'y';"],
  ['висящая запятая в вызове', 'function f(a, b) {} f(1, 2,);'],

  // -- запрещённые API/методы ES2015+ при валидном ES5-синтаксисе --
  ['Object.values', 'Object.values(o);'],
  ['Object.entries', 'Object.entries(o);'],
  ['Object.fromEntries', 'Object.fromEntries(a);'],
  ['Object.is', 'Object.is(a, b);'],
  ['Object.assign', 'Object.assign(a, b);'],
  ['Object.getOwnPropertySymbols', 'Object.getOwnPropertySymbols(o);'],
  ['Number.isNaN', 'Number.isNaN(x);'],
  ['Number.isFinite', 'Number.isFinite(x);'],
  ['Number.isInteger', 'Number.isInteger(x);'],
  ['Number.parseFloat', 'Number.parseFloat(x);'],
  ['Number.parseInt', 'Number.parseInt(x);'],
  ['Math.trunc', 'Math.trunc(x);'],
  ['Math.sign', 'Math.sign(x);'],
  ['Math.log2', 'Math.log2(x);'],
  ['Math.log10', 'Math.log10(x);'],
  ['Math.hypot', 'Math.hypot(x);'],
  ['Math.cbrt', 'Math.cbrt(x);'],
  ['Array.from', 'Array.from(x);'],
  ['Array.of', 'Array.of(1, 2);'],
  ['new Map', 'var m = new Map();'],
  ['new Set', 'var s = new Set();'],
  ['new WeakMap', 'var w = new WeakMap();'],
  ['new WeakSet', 'var w2 = new WeakSet();'],
  ['new Proxy', 'var p = new Proxy(a, b);'],
  ['new URL', 'var u = new URL(x);'],
  ['new URLSearchParams', 'var q = new URLSearchParams(x);'],
  ['голое имя Promise', 'var p2 = Promise;'],
  ['голое имя Symbol', 'var s2 = Symbol;'],
  ['голое имя Reflect', 'var r = Reflect;'],
  ['голое имя fetch', 'fetch(url);'],
  ['голое имя globalThis', 'var g = globalThis;'],
  ['голое имя requestIdleCallback', 'requestIdleCallback(cb);'],
  ['.includes(', 'arr.includes(x);'],
  ['.startsWith(', 'str.startsWith(x);'],
  ['.endsWith(', 'str.endsWith(x);'],
  ['.repeat(', 'str.repeat(3);'],
  ['.padStart(', 'str.padStart(3);'],
  ['.padEnd(', 'str.padEnd(3);'],
  ['.replaceAll(', 'str.replaceAll(a, b);'],
  ['.trimStart(', 'str.trimStart();'],
  ['.trimEnd(', 'str.trimEnd();'],
  ['.fill(', 'arr.fill(0);'],
  ['.flat(', 'arr.flat();'],
  ['.flatMap(', 'arr.flatMap(fn);'],
  ['.at(', 'arr.at(0);'],
  ['.findIndex(', 'arr.findIndex(fn);'],
  ['.findLast(', 'arr.findLast(fn);'],
  ['.findLastIndex(', 'arr.findLastIndex(fn);'],
  ['.copyWithin(', 'arr.copyWithin(0, 1);'],
  ['.finally(', 'p.then(a).finally(fn);'],
  ['Array.prototype.find', 'arr.find(function (x) { return x; });']
];

assert.ok(FORBIDDEN.length >= 30, 'ожидалось >= 30 фикстур, есть ' + FORBIDDEN.length);

FORBIDDEN.forEach(function (item) {
  var label = item[0];
  var src = item[1];
  test('запрещено: ' + label, function () {
    var findings = check(src);
    assert.ok(findings.length >= 1, 'ожидалась находка для: ' + label + ' (src: ' + src + ')');
  });
});

/* ------------------------------------------------------------------ */
/* (б) Допустимые строки — ноль находок (никаких ложных срабатываний). */
/* ------------------------------------------------------------------ */

var ALLOWED = [
  ['строка с многоточием', "var msg = 'Загрузка...';"],
  ['комментарий с Promise', '// Promise позже'],
  ['свойство async, не ключевое слово', 'script.async = true;'],
  ['блочный комментарий с запрещёнными словами', '/* let const class */'],
  ['строка с текстом "class Foo"', 'var s = "class Foo";'],
  ['строка с литеральным бэктиком', 'var t = "`";'],
  ['геттер в объекте (валиден с ES5)', 'var o = { get a() { return 1; } };'],
  ['Object.keys — не в списке запрещённых', 'Object.keys(o);'],
  ['Array.isArray — не в списке запрещённых', 'Array.isArray(a);'],
  ['String.prototype.trim — ES5', "' x '.trim();"],
  ['jQuery .find с селектором-строкой', "$(el).find('.a');"],
  ['висящая запятая в объекте (валидна с ES5)', 'var o2 = { a: 1, };'],
  ['try … finally — ES3, не метод', 'try { f(); } finally { g(); }']
];

ALLOWED.forEach(function (item) {
  var label = item[0];
  var src = item[1];
  test('разрешено: ' + label, function () {
    var findings = check(src);
    assert.deepEqual(findings, [], 'не ожидалось находок для: ' + label + ' (src: ' + src + '), получено: ' + JSON.stringify(findings));
  });
});

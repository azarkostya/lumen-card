import test from 'node:test'; import assert from 'node:assert/strict';
import { minify, needSpace, tokenStream, firstMismatch } from '../scripts/lib/minify.mjs';

/* Сжатие сборки (scripts/lib/minify.mjs). Проверяется не «стало короче», а
   что код ведёт себя так же: ASI не сдвинулся, токены не склеились,
   строки и регэкспы с «//» и «/*» целы. На всей сборке ту же сверку потоков
   токенов делают build.mjs и test/build.test.mjs. */

const NONE = () => false;
const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

function run(src) {
  return new Function(src + '\n;return typeof probe === "undefined" ? undefined : probe;')();
}

/* Исходник и сжатый вариант дают одно значение probe и один поток токенов. */
function same(src) {
  const out = minify(src, NONE);
  assert.deepEqual(run(out), run(src), 'значение изменилось:\n' + src + '\n---\n' + out);
  assert.equal(firstMismatch(tokenStream(src), tokenStream(out)), null, out);
  return out;
}

[['\\n', '\n'], ['CR', '\r'], ['U+2028', LS], ['U+2029', PS], ['CRLF', '\r\n']].forEach(function (item) {
  test('ASI: перевод строки ' + item[0] + ' в пробелах и внутри комментария переживает сжатие', () => {
    const a = same('function f() { return' + item[1] + '  1; }\nvar probe = f();');
    assert.equal(run(a), undefined);
    const b = same('function f() { return /*' + item[1] + '*/ 1; }\nvar probe = f();');
    assert.equal(run(b), undefined);
    assert.match(b, /return\n1/);
  });
});

test('ASI: постфиксный ++ после перевода строки остаётся префиксным к следующей строке', () => {
  same('var a = 1, b = 1;\na\n++b\nvar probe = [a, b];');
});

test('без перевода строки в исходнике его нет и в выводе; пустые строки и отступы уходят', () => {
  const out = same('var probe = 1 +\n\n\n    2;   // хвост\n\n\n  probe = probe * 3;\n');
  assert.equal(out, 'var probe=1+\n2;\nprobe=probe*3;\n');
});

test('склейка токенов: слова, «+ +», «- -», «/ /re/», «1 .x», регэксп перед словом', () => {
  same('var a = 5, b = 2; var probe = [a - -b, a + +b, a - --b, a++ + b, a-- - b];');
  same('var x = 6, probe = x / /3/.source.length;');
  same('var probe = [1 .toString(), 1..toString(), 0x10 .toString()];');
  same('var probe = /a/ instanceof RegExp;');
  same('var probe = typeof/*c*/probe;');
  assert.equal(minify('var probe = typeof/*c*/x;', NONE), 'var probe=typeof x;\n');
  same('var o = { get x() { return 1; } }; var probe = o.x;');
  same('var probe = "a" in { a: 1 };');
});

test('HTML-комментарии в скрипте не образуются: «< !--» и «-- >»', () => {
  const a = same('var a = 1, b = 3; var probe = a < !--b;');
  assert.equal(a.indexOf('<!--'), -1);
  const b = same('var a = 3, b = 1; var probe = a-- > b;');
  assert.equal(b.indexOf('-->'), -1);
});

test('needSpace: пары, которые склеились бы', () => {
  assert.equal(needSpace('return', 'x', 'return'), true);
  assert.equal(needSpace('return', "'x'", 'return'), false);
  assert.equal(needSpace('/a/', 'in', 'regexp'), true);
  assert.equal(needSpace('1', '.', 'num'), true);
  assert.equal(needSpace('+', '+b', '+/-'), true);
  assert.equal(needSpace('x', '(', 'name'), false);
});

test('строки и регэкспы с «//» и «/*» внутри не трогаются', () => {
  const src = "var probe = ['http://x.y/a  b', \"a /* b */ c\", /\\/\\*[ ]+\\*\\//.source, 'x' + // хвост\n 'y', /[/]{2}/.test('//')];";
  const out = same(src);
  assert.ok(out.indexOf("'http://x.y/a  b'") >= 0);
  assert.ok(out.indexOf('"a /* b */ c"') >= 0);
  assert.equal(out.indexOf('хвост'), -1);
});

test('строка с продолжением через обратную косую остаётся дословной', () => {
  const out = same("var probe = 'a\\\n   b';");
  assert.ok(out.indexOf("'a\\\n   b'") >= 0);
});

test('бэктик (шаблонная строка ES2015) — ошибка сжатия, то есть сборки', () => {
  assert.throws(() => minify('var s = `x`;', NONE), SyntaxError);
});

test('уцелевшие комментарии — каждый своей строкой, остальные вырезаны', () => {
  const keep = (c) => c.block && /^ ---- /.test(c.text);
  const out = minify('// баннер\n\n/* ---- 10_a.js ---- */\nvar a = 1; /* прочь */\n/* ---- 20_b.js ---- */\n  var b = 2;\n', keep);
  assert.equal(out, '/* ---- 10_a.js ---- */\nvar a=1;\n/* ---- 20_b.js ---- */\nvar b=2;\n');
});

test('уцелевший комментарий не с начала строки — отказ, а не сдвиг ASI', () => {
  assert.throws(() => minify('var a = 1; /*! x */ var b = 2;', () => true), /не с начала строки/);
});

test('tokenStream различает перевод строки между токенами', () => {
  assert.notEqual(firstMismatch(tokenStream('a\n+b'), tokenStream('a+b')), null);
  assert.equal(firstMismatch(tokenStream('a /*\n*/ +b'), tokenStream('a\n+b')), null);
});

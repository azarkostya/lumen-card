import test from 'node:test'; import assert from 'node:assert/strict';
import { stripComments, squeeze, keepComment, atLineStart } from '../scripts/lib/strip.mjs';

/* Юнит-тесты вырезания комментариев (scripts/lib/strip.mjs). Проверяется не
   «строк стало меньше», а то, что текст после обработки ведёт себя ровно как
   до неё: ASI не сдвинулся, строковые литералы и регэкспы целы, нумерация
   строк не разъехалась. */

const NONE = () => false;
const lines = s => s.split(/\r\n?|\n|\u2028|\u2029/).length;

function run(src) {
  return new Function(src + '\n;return typeof probe === "undefined" ? undefined : probe;')();
}

/* ---------------------------------------------------------------- */
/* ASI: перевод строки внутри комментария должен пережить вырезание. */
/* ---------------------------------------------------------------- */

const ASI_BREAKS = [['\\n', '\n'], ['CR', '\r'], ['U+2028', '\u2028'], ['U+2029', '\u2029'], ['CRLF', '\r\n']];

ASI_BREAKS.forEach(function (item) {
  test('ASI сохраняется: перевод строки ' + item[0] + ' внутри комментария', () => {
    const src = 'function f() { return /*' + item[1] + '*/ 1; }\nvar probe = f();';
    assert.equal(run(src), undefined, 'фикстура должна возвращать undefined и до обработки');
    const out = stripComments(src, NONE);
    assert.equal(run(out), undefined, 'после вырезания return стал возвращать значение');
  });
});

test('однострочный блочный комментарий между токенами не склеивает их', () => {
  const src = 'var x;\nvar probe = typeof/*c*/x;';
  const out = stripComments(src, NONE);
  assert.equal(run(out), 'undefined');
  assert.match(out, /typeof x/);
});

/* ---------------------------------------------------------------- */
/* Литералы и регэкспы: «/*» и «//» внутри них — не комментарии.     */
/* ---------------------------------------------------------------- */

test('«/*» и «//» внутри строковых литералов целы', () => {
  const src = "var probe = ['/* Маски иконок */', \"http://x.y/z\", 'a // b'].join('|'); /* вырезать */";
  const out = stripComments(src, NONE);
  assert.equal(run(out), '/* Маски иконок */|http://x.y/z|a // b');
  assert.ok(out.indexOf('вырезать') < 0, 'настоящий комментарий остался');
});

test('data-URI не режется', () => {
  const src = "var probe = 'url(\"data:image/svg+xml;charset=utf-8,%3Csvg/%3E\")'; // хвост";
  assert.equal(run(stripComments(src, NONE)), 'url("data:image/svg+xml;charset=utf-8,%3Csvg/%3E")');
});

test('регэксп с «/*» внутри цел, деление не путается с комментарием', () => {
  const src = 'var re = /a\\/*b/; var a = 6, b = 2;\nvar probe = [re.source, a/b/*делим*/].join("|");';
  const out = stripComments(src, NONE);
  assert.equal(run(out), 'a\\/*b|3');
  assert.ok(out.indexOf('делим') < 0, 'комментарий после деления не вырезан');
});

/* ---------------------------------------------------------------- */
/* squeeze: пробелы, литералы с продолжением строки, нумерация.      */
/* ---------------------------------------------------------------- */

test('squeeze срезает пробелы и табы в начале и конце строки', () => {
  const src = '\tvar a = 1;   \n    var probe = a + 1;\n';
  const out = squeeze(src);
  assert.equal(out, 'var a = 1;\nvar probe = a + 1;\n');
  assert.equal(run(out), 2);
});

test('squeeze не трогает строку с продолжением литерала (обратный слэш)', () => {
  const src = "var probe = 'abc\\\n     def';\n";
  const out = squeeze(src);
  assert.equal(run(out), 'abc     def');
  assert.equal(run(src), run(out));
});

test('squeeze не трогает тело уцелевшего комментария', () => {
  const src = '/*!\n * Шапка\n */\nvar probe = 1;\n';
  const out = squeeze(src);
  assert.equal(out, src, 'многострочный комментарий должен остаться дословно');
});

test('squeeze отдаёт файл нетронутым, если есть CR или U+2028', () => {
  for (const br of ['\r', '\u2028', '\u2029']) {
    const src = '  var a = 1;' + br + '  var probe = a;\n';
    assert.equal(squeeze(src), src, 'файл с экзотическим переводом строки не должен сжиматься');
  }
});

test('нумерация строк не разъезжается ни в stripComments, ни в squeeze', () => {
  const src = 'var a = 1;\n/* коммент\n   на три\n   строки */\nvar probe = a;\n';
  const stripped = stripComments(src, NONE);
  assert.equal(lines(stripped), lines(src));
  assert.equal(lines(squeeze(stripped)), lines(src));
  assert.equal(run(squeeze(stripped)), 1);
});

/* ---------------------------------------------------------------- */
/* keepComment: что именно переживает сборку.                        */
/* ---------------------------------------------------------------- */

const names = new Set(['00_head.js', '10_util.js']);
const opts = { names: names, headEnd: 100 };

function only(src) {
  const kept = [];
  stripComments(src, (c, s) => { const k = keepComment(c, s, opts); if (k) kept.push(c.text); return k; });
  return kept.reverse(); // stripComments идёт с конца — возвращаем порядок появления
}

test('keepComment: баннер, шапка и маркеры файлов остаются', () => {
  const src = '// баннер\n/* ---- 00_head.js ---- */\n/*!\n * шапка\n */\nvar a = 1;\n';
  assert.deepEqual(only(src), [' баннер', ' ---- 00_head.js ---- ', '!\n * шапка\n ']);
});

test('keepComment: маркер не с начала строки и чужое имя не сохраняются', () => {
  const src = 'var a = 1; /* ---- 10_util.js ---- */\n/* ---- 99_foreign.js ---- */\nvar b = 2;\n';
  assert.deepEqual(only(src), []);
});

test('keepComment: «/*!» за пределами шапки не сохраняется', () => {
  const head = '// баннер\n/* ---- 00_head.js ---- */\n';
  const src = head + 'var a = 1;\n'.repeat(20) + '/*! подделка */\nvar b = 2;\n';
  assert.deepEqual(only(src), [' баннер', ' ---- 00_head.js ---- ']);
});

test('atLineStart', () => {
  const src = 'a\n  b';
  assert.equal(atLineStart(src, 0), true);
  assert.equal(atLineStart(src, 2), true);
  assert.equal(atLineStart(src, 4), false);
});

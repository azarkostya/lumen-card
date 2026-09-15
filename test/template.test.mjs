import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

const template = load('40_template.js');
const fixture = readFileSync(new URL('./fixtures/full_start_new.original.html', import.meta.url), 'utf8');

/* Тестовый хелпер (не часть модуля): полный outerHTML первого div с токеном
   cls в class — открывающий тег + содержимое (через innerOf) + </div>. Все
   кнопки фикстуры — простые <div class="..."> без прочих атрибутов, этого
   достаточно, чтобы дословно найти открывающий тег каждой из них. */
function outerOf(html, cls) {
  const m = new RegExp('<div class="[^"]*\\b' + cls + '\\b[^"]*">').exec(html);
  const inner = template.innerOf(html, cls);
  if (!m || inner === null) return null;
  return m[0] + inner + '</div>';
}

test('innerOf на фикстуре: блок кнопок и пул', () => {
  const buttons = template.innerOf(fixture, 'full-start-new__buttons');
  const pool = template.innerOf(fixture, 'buttons--container');
  assert.notEqual(buttons, null);
  assert.notEqual(pool, null);

  for (const cls of ['button--play', 'button--book', 'button--reaction', 'button--subscribe', 'button--options']) {
    assert.ok(buttons.indexOf(cls) !== -1, cls);
  }
  for (const cls of ['view--torrent', 'view--trailer']) {
    assert.ok(pool.indexOf(cls) !== -1, cls);
  }

  assert.ok(fixture.indexOf(buttons) !== -1, 'buttons — дословная подстрока оригинала');
  assert.ok(fixture.indexOf(pool) !== -1, 'pool — дословная подстрока оригинала');
  assert.match(buttons, /^\s/);
  assert.match(pool, /^\s/);
});

test('innerOf на синтетике: вложенность, целое слово, класс отсутствует, баланс', () => {
  const nested = '<div class="outer"><div class="inner"><div class="deep">x</div>y</div>z</div>';
  assert.equal(template.innerOf(nested, 'outer'), '<div class="inner"><div class="deep">x</div>y</div>z');
  assert.equal(template.innerOf(nested, 'inner'), '<div class="deep">x</div>y');
  assert.equal(template.innerOf(nested, 'deep'), 'x');

  // токен целым словом: "full-start-new__buttons-x" не даёт совпадения по "full-start-new__buttons"
  assert.equal(template.innerOf('<div class="full-start-new__buttons-x">content</div>', 'full-start-new__buttons'), null);

  // класс отсутствует
  assert.equal(template.innerOf('<div class="a">x</div>', 'nope'), null);

  // несбалансированный html (незакрытый div)
  assert.equal(template.innerOf('<div class="a"><div>x</div>', 'a'), null);
});

test('innerOf: кавычки в атрибутах и HTML-комментарии не путают границы тега', () => {
  // '>' внутри значения атрибута (data-x="1>2") не должен обрывать открывающий тег раньше времени
  assert.equal(
    template.innerOf('<div class="buttons--container" data-x="1>2">PAYLOAD</div>', 'buttons--container'),
    'PAYLOAD'
  );
  // закомментированный старый блок не должен подменить собой настоящий
  assert.equal(
    template.innerOf('<!-- old: <div class="buttons--container">DEAD</div> --><div class="buttons--container">ALIVE</div>', 'buttons--container'),
    'ALIVE'
  );
  // одинарные кавычки у class, '>' внутри двойных кавычек другого атрибута, комментарий внутри
  // блока остаётся в вырезке дословно (без trim/replace) — он может быть частью outerHTML кнопки
  assert.equal(
    template.innerOf('<div class=\'buttons--container\' title="a > b">X<!-- <div> --></div>', 'buttons--container'),
    'X<!-- <div> -->'
  );
  // незакрытый комментарий -> null
  assert.equal(template.innerOf('<div class="a"><!-- oops</div>', 'a'), null);
});

test('innerOf: самозакрывающийся <div … /> не требует парного </div> и не «съедает» чужой', () => {
  // Регрессия: <div class="x"/> раньше считался обычным открывающим тегом
  // (увеличивал depth) и поглощал ПОСТОРОННИЙ </div> дальше по документу.
  assert.equal(
    template.innerOf('<div class="buttons--container">A<div class="x"/></div>B</div>', 'buttons--container'),
    'A<div class="x"/>'
  );
});

test('innerOf: регистр важен — <DIV class="…">…</DIV> тегом div не считается (даёт null)', () => {
  // Фиксируем текущее (допустимое) поведение явным тестом, чтобы оно не
  // изменилось незаметно при будущих правках парсера.
  assert.equal(template.innerOf('<DIV class="buttons--container">X</DIV>', 'buttons--container'), null);
});

test('build(фикстура): один корневой элемент — div-теги сбалансированы, buttons--container вложен в корень', () => {
  // Регрессия: buttons--container — сосед .full-start-new__body ВНУТРИ корня
  // (как в оригинале), а не отдельный элемент верхнего уровня. Раньше build()
  // закрывал корень на один </div> раньше, и остаток HTML отваливался.
  const result = template.build(fixture);
  const opens = (result.match(/<div\b[^>]*>/g) || []).length;
  const closes = (result.match(/<\/div\s*>/g) || []).length;
  assert.equal(opens, closes, 'открывающих и закрывающих div должно быть поровну');

  const rootInner = template.innerOf(result, 'lumen-card');
  assert.notEqual(rootInner, null);
  assert.ok(rootInner.indexOf('buttons--container') !== -1, 'buttons--container должен быть потомком корня, а не соседом');
});

test('build(фикстура): каждая кнопка оригинала целиком встречается в результате дословно', () => {
  const result = template.build(fixture);
  assert.notEqual(result, null);

  for (const cls of ['button--play', 'button--book', 'button--reaction', 'button--subscribe', 'button--options', 'view--torrent', 'view--trailer']) {
    const outer = outerOf(fixture, cls);
    assert.ok(outer, cls + ': не найдена в фикстуре');
    assert.ok(result.indexOf(outer) !== -1, cls + ': не найдена дословно в build()');
  }
});

test('build: блок кнопок не найден -> null', () => {
  assert.equal(template.build('<div class="full-start-new">nothing here</div>'), null);
});

test('build: пустая строка -> null', () => {
  assert.equal(template.build(''), null);
});

test('build: buttons найден, но button--play отсутствует -> null', () => {
  const html = '<div class="full-start-new__buttons"><div class="button--book">x</div></div>' +
               '<div class="buttons--container">y</div>';
  assert.equal(template.build(html), null);
});

test('build: найден только один из двух блоков -> null', () => {
  assert.equal(template.build('<div class="full-start-new__buttons"><div class="button--play">x</div></div>'), null);
  assert.equal(template.build('<div class="buttons--container"><div class="button--play">x</div></div>'), null);
});

test('build(фикстура): ключевые классы v1 на месте', () => {
  const result = template.build(fixture);
  for (const cls of ['lumen-card', 'full-start-new__title', 'rate--tmdb', 'lumen-side', 'tag--year']) {
    assert.ok(result.indexOf(cls) !== -1, cls);
  }
});

/* -------------------------------------------------------------------- */
/* Task 5/5a Step 1: REQUIRED/assert                                     */
/* -------------------------------------------------------------------- */

test('REQUIRED: непустой список, без дублей', () => {
  assert.ok(Array.isArray(template.REQUIRED));
  assert.ok(template.REQUIRED.length > 0);
  assert.equal(new Set(template.REQUIRED).size, template.REQUIRED.length);
});

test('assert(orig, build(orig)).ok === true на фикстуре', () => {
  const ours = template.build(fixture);
  const result = template.assert(fixture, ours);
  assert.equal(result.ok, true, 'missingInOurs: ' + JSON.stringify(result.missingInOurs));
  assert.deepEqual(result.missingInOurs, []);
});

test('assert: фикстура не содержит tag--year/time/quality/episode/is--serial (missingInOriginal, не влияет на ok)', () => {
  const ours = template.build(fixture);
  const result = template.assert(fixture, ours);
  for (const cls of ['tag--year', 'tag--time', 'tag--quality', 'tag--episode', 'is--serial']) {
    assert.ok(result.missingInOriginal.indexOf(cls) !== -1, cls);
  }
});

test('assert: чего-то не хватает в ours -> ok === false, класс в missingInOurs', () => {
  const result = template.assert(fixture, '<div class="full-start-new__title">x</div>');
  assert.equal(result.ok, false);
  assert.ok(result.missingInOurs.indexOf('full-start-new__buttons') !== -1);
});

test('assert: языковой ключ оригинала отсутствует в ours -> ok === false', () => {
  const orig = '<div class="button--play">#{title_watch}</div>';
  const ours = '<div class="button--play">Смотреть</div>';
  const result = template.assert(orig, ours);
  assert.equal(result.ok, false);
  assert.ok(result.missingInOurs.indexOf('#{title_watch}') !== -1);
});

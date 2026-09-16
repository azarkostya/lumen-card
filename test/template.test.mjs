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

test('build(фикстура): Task 18 — .buttons--container лежит ВНУТРИ ряда кнопок и остаётся .hide', () => {
  // Показ штатной кнопки «Трейлер» делает CSS по классу корня, а флекс-ряд
  // ей даёт только .full-start-new__buttons: вне ряда кнопка встала бы
  // отдельным блоком. Разметка самих кнопок при этом не меняется — их
  // outerHTML хэширует Lampa (план 0.2), проверка дословности ниже.
  const result = template.build(fixture);
  const row = template.innerOf(result, 'full-start-new__buttons');
  assert.notEqual(row, null);
  assert.ok(row.indexOf('buttons--container') !== -1, 'контейнер должен быть внутри ряда кнопок');
  assert.ok(row.indexOf('class="hide buttons--container"') !== -1, 'контейнер обязан остаться скрытым по умолчанию');
  // Кнопки пула — внутри контейнера, а не рассыпаны по ряду: от состава пула
  // зависит меню кнопки «Смотреть» (onGroupButtons) и хэш приоритетной кнопки.
  const pool = template.innerOf(row, 'buttons--container');
  assert.notEqual(pool, null);
  assert.ok(pool.indexOf('view--trailer') !== -1);
  assert.ok(pool.indexOf('view--torrent') !== -1);
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
  for (const cls of ['lumen-card', 'full-start-new__title', 'rate--tmdb', 'full-start__status', 'tag--year']) {
    assert.ok(result.indexOf(cls) !== -1, cls);
  }
});

test('build(фикстура), Task 5c: чип следующей серии в ленте рейтингов, ряд серий в шестом .lumen-in после кнопок', () => {
  const result = template.build(fixture);
  const rate = template.innerOf(result, 'full-start-new__rate-line');
  assert.ok(rate.indexOf('lumen-next-chip') !== -1, 'чип следующей серии — внутри ленты рейтингов');

  // шесть .lumen-in по-прежнему (stagger nth-child 1..6), ряд серий — не отдельный ребёнок .lumen-content
  assert.equal((result.match(/class="lumen-in[ "]/g) || []).length, 6);
  const buttonsAt = result.indexOf('full-start-new__buttons');
  const episodesAt = result.indexOf('lumen-episodes');
  assert.ok(buttonsAt < episodesAt, 'ряд серий — после кнопок');
  const lastIn = result.lastIndexOf('class="lumen-in', episodesAt);
  assert.ok(result.slice(lastIn, episodesAt).indexOf('full-start-new__buttons') !== -1, 'ряд серий — в том же .lumen-in, что и кнопки');
  assert.ok(result.indexOf('<div class="lumen-episodes hide">') !== -1, 'ряд скрыт до отрисовки');
});

/* Task 7 (ревью): CSS режима трейлера и flex-фолбэк без grid держатся на
   классе .lumen-actions, а не на порядковом номере блока — закрепляем
   контракт: класс ровно один, стоит на одном из шести .lumen-in и это
   именно блок с рядом кнопок. */
test('build(фикстура), Task 7: .lumen-actions — ровно один, на шестом .lumen-in, с рядом кнопок внутри', () => {
  const result = template.build(fixture);

  assert.equal((result.match(/lumen-actions/g) || []).length, 1, 'класс должен быть ровно один');
  assert.ok(result.indexOf('class="lumen-in lumen-actions"') !== -1, '.lumen-actions — это один из .lumen-in');
  assert.equal((result.match(/class="lumen-in[ "]/g) || []).length, 6, 'шесть .lumen-in (stagger nth-child 1..6) не меняется');

  const actionsAt = result.indexOf('lumen-actions');
  const buttonsAt = result.indexOf('full-start-new__buttons');
  assert.ok(actionsAt < buttonsAt, 'ряд кнопок лежит внутри .lumen-actions');
  const lastInBeforeButtons = result.lastIndexOf('class="lumen-in', buttonsAt);
  assert.ok(result.slice(lastInBeforeButtons, buttonsAt).indexOf('lumen-actions') !== -1,
    'ближайший .lumen-in перед кнопками — именно .lumen-actions');
});

/* -------------------------------------------------------------------- */
/* Правка 2026-09-16 (пп. 1-2): боковой колонки и оригинального названия  */
/* в шапке больше нет. Колонка дублировала ряд актёров, который Lampa     */
/* рисует ниже (и показывала инициалы вместо фотографий), оригинальное    */
/* название осталось строкой «Оригинал» в таблице «ПОДРОБНО».             */
/* -------------------------------------------------------------------- */

test('правка 2026-09-16 (п.1): в шаблоне нет .lumen-side и .lumen-cast', () => {
  const result = template.build(fixture);
  assert.equal(result.indexOf('lumen-side'), -1, 'боковая колонка убрана целиком');
  assert.equal(result.indexOf('lumen-cast'), -1, 'блок «В ролях» убран вместе с колонкой');
});

test('правка 2026-09-16 (п.1): статус и чипы качества переехали в ленту рейтингов', () => {
  const result = template.build(fixture);
  const rate = template.innerOf(result, 'full-start-new__rate-line');
  assert.ok(rate.indexOf('full-start__status') !== -1, 'статус — внутри ленты рейтингов');
  assert.ok(rate.indexOf('lumen-tags') !== -1, 'держатель чипов качества — внутри ленты рейтингов');
  assert.ok(rate.indexOf('tag--quality') !== -1, 'штатный tag--quality остаётся в разметке (в него пишет Lampa)');

  /* renderSerialMode (85_header.js) двигает статус ПЕРЕД чипом следующей
     серии — в шаблоне он уже стоит там, значит перестановки не будет. */
  const statusAt = rate.indexOf('full-start__status');
  const chipAt = rate.indexOf('lumen-next-chip');
  assert.ok(statusAt < chipAt, 'статус стоит перед чипом следующей серии');
});

test('правка 2026-09-16 (п.1): статус скрыт разметкой — показывает его Lampa, а у фильма гасит CSS', () => {
  const result = template.build(fixture);
  assert.ok(result.indexOf('<div class="full-start__status hide"></div>') !== -1);
});

test('правка 2026-09-16 (п.2): оригинального названия в шапке нет', () => {
  const result = template.build(fixture);
  assert.equal(result.indexOf('lumen-original'), -1);
  assert.equal(result.indexOf('{original_title}'), -1, 'ключ подстановки тоже убран');
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

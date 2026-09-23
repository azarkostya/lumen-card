import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Долг фазы 1 (docs/plans/2026-09-15-lumen-card.md:1123, п.4): «пять
   способов ответить на вопрос „наша карточка на экране“». Этот файл — сторож
   ПОВЕДЕНИЯ ответа, написанный до сведения способов в одну функцию и
   проходящий и до, и после: он спрашивает только публичные
   LC.slideshow.isLayerForeground / isActivityForeground / isMounted (они
   существуют в обеих редакциях) на наборе состояний узла, и ответы обязаны
   остаться прежними.

   Состояния — все, что встречаются у вызывающих: узел в активной
   активности, в активности из истории (без activity--active), вне всякой
   активности (кадр главной, узел, ещё не вставленный в экран), пустой
   набор, null и узел, у которого closest бросает. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
}

function freshLC() {
  const LC = {};
  loadInto(LC, '10_util.js');
  loadInto(LC, '51_slideshow.js');
  return LC;
}

function inside(activityClasses) {
  const leaf = new FakeEl(['lumen-backdrop']);
  const body = new FakeEl(['activity__body'], [leaf]);
  new FakeEl(activityClasses, [body]);
  return leaf;
}

test('на экране: узел в активной активности — да, в активности из истории — нет', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isLayerForeground(inside(['activity', 'activity--active'])), true);
  assert.equal(LC.slideshow.isLayerForeground(inside(['activity'])), false);
});

test('на экране: вне всякой активности — да (безопасный дефолт: не блокировать)', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isLayerForeground(new FakeEl(['lumen-hero'])), true, 'узел без предка-активности');
  assert.equal(LC.slideshow.isLayerForeground(EMPTY), true, 'пустой набор: closest отдаёт пустой набор');
  assert.equal(LC.slideshow.isLayerForeground(null), true, 'null');
  assert.equal(LC.slideshow.isLayerForeground({ closest() { throw new Error('boom'); } }), true, 'closest бросает');
});

test('на экране: активность, найденная по _closestActivity (заглушка фейка), — по её классу', () => {
  const LC = freshLC();
  const node = new FakeEl(['lumen-card']);
  node._closestActivity = { length: 1, hasClass: (c) => c === 'activity--active' };
  assert.equal(LC.slideshow.isLayerForeground(node), true);
  node._closestActivity = { length: 1, hasClass: () => false };
  assert.equal(LC.slideshow.isLayerForeground(node), false);
});

test('isActivityForeground: сама активность — пустая/нет → да, класс решает', () => {
  const LC = freshLC();
  assert.equal(LC.slideshow.isActivityForeground(null), true);
  assert.equal(LC.slideshow.isActivityForeground({ length: 0 }), true);
  assert.equal(LC.slideshow.isActivityForeground(new FakeEl(['activity', 'activity--active'])), true);
  assert.equal(LC.slideshow.isActivityForeground(new FakeEl(['activity'])), false);
});

test('в документе: отвечает documentElement.contains, без документа — нет', () => {
  const LC = freshLC();
  const node = new FakeEl(['x']);
  const prev = globalThis.document;
  try {
    globalThis.document = { documentElement: { contains: (n) => n === node } };
    assert.equal(LC.slideshow.isMounted(node), true);
    assert.equal(LC.slideshow.isMounted(new FakeEl(['y'])), false);
    assert.equal(LC.slideshow.isMounted(null), false);
    delete globalThis.document;
    assert.equal(LC.slideshow.isMounted(node), false, 'документа нет — узел не считается живым');
  } finally {
    if (prev === undefined) delete globalThis.document; else globalThis.document = prev;
  }
});

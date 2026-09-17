import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const M = load('64_nav.js');

/* ---------------------------------------------------------------------- */
/* holdTracker — автомат удержания клавиши.                                */
/*                                                                        */
/* Вход — события Lampa.Keypad ({code} → key) в виде {key, type, t}.       */
/* Выход — состояние {key, holding, repeats, since, fast}.                 */
/* ---------------------------------------------------------------------- */

/* Удобная подача серии повторов одной клавиши. */
function hold(tracker, key, times, step, start) {
  let t = start;
  let state = null;
  for (let i = 0; i < times; i++) {
    state = tracker.feed({ key: key, type: 'down', t: t });
    t += step;
  }
  return state;
}

test('holdTracker: первое нажатие — удержание началось, повторов один', () => {
  const tr = M.holdTracker();
  const s = tr.feed({ key: 40, type: 'down', t: 1000 });
  assert.equal(s.key, 40);
  assert.equal(s.holding, true);
  assert.equal(s.repeats, 1);
  assert.equal(s.since, 1000);
  assert.equal(s.fast, false);
});

test('holdTracker: шесть повторов в пределах окна — ускорение включилось', () => {
  const tr = M.holdTracker();
  /* Автоповтор Lampa шлёт keydown не чаще раза в 100 мс (Keypad.keydownTrigger). */
  assert.equal(hold(tr, 39, 5, 100, 0).fast, false);
  const six = tr.feed({ key: 39, type: 'down', t: 500 });
  assert.equal(six.repeats, 6);
  assert.equal(six.fast, true);
});

test('holdTracker: ускорение держится, пока клавишу не отпустили', () => {
  const tr = M.holdTracker();
  hold(tr, 39, 6, 100, 0);
  assert.equal(tr.feed({ key: 39, type: 'down', t: 600 }).fast, true);
  const up = tr.feed({ key: 39, type: 'up', t: 700 });
  assert.equal(up.fast, false);
  assert.equal(up.holding, false);
  assert.equal(up.repeats, 0);
  assert.equal(up.key, 0);
});

test('holdTracker: редкие нажатия ускорением не считаются — окно перезапускается', () => {
  const tr = M.holdTracker();
  /* Человек жмёт «вниз» раз в 400 мс: шесть нажатий, но это не удержание. */
  const s = hold(tr, 40, 6, 400, 0);
  assert.equal(s.fast, false);
  assert.equal(s.repeats, 1);
});

test('holdTracker: другая клавиша начинает счёт заново', () => {
  const tr = M.holdTracker();
  hold(tr, 39, 6, 100, 0);
  const other = tr.feed({ key: 37, type: 'down', t: 620 });
  assert.equal(other.key, 37);
  assert.equal(other.repeats, 1);
  assert.equal(other.fast, false);
});

test('holdTracker: отпускание чужой клавиши состояние не рушит', () => {
  const tr = M.holdTracker();
  hold(tr, 40, 3, 100, 0);
  const s = tr.feed({ key: 39, type: 'up', t: 250 });
  assert.equal(s.key, 40);
  assert.equal(s.holding, true);
  assert.equal(s.repeats, 3);
});

test('holdTracker: сколько удерживают и сброс', () => {
  const tr = M.holdTracker();
  tr.feed({ key: 40, type: 'down', t: 1000 });
  assert.equal(tr.heldFor(1500), 500);
  tr.reset();
  assert.equal(tr.state().holding, false);
  assert.equal(tr.heldFor(1500), 0);
});

test('holdTracker: мусорное событие ничего не меняет', () => {
  const tr = M.holdTracker();
  tr.feed({ key: 40, type: 'down', t: 1000 });
  const s = tr.feed(null);
  assert.equal(s.key, 40);
  assert.equal(s.repeats, 1);
});

/* ---------------------------------------------------------------------- */
/* minimapModel — окно рядов вокруг активного.                             */
/* ---------------------------------------------------------------------- */

const titles = (n) => Array.from({ length: n }, (_, i) => 'Ряд ' + (i + 1));

test('minimapModel: коротких списков окно не касается', () => {
  const m = M.minimapModel(titles(5), 2);
  assert.equal(m.total, 5);
  assert.equal(m.active, 2);
  assert.equal(m.from, 0);
  assert.equal(m.to, 4);
  assert.equal(m.items.length, 5);
  assert.deepEqual(m.items.map((i) => i.active), [false, false, true, false, false]);
  assert.deepEqual(m.items.map((i) => i.index), [0, 1, 2, 3, 4]);
});

test('minimapModel: девять рядов показываются целиком (design-spec-main §0.16)', () => {
  const m = M.minimapModel(titles(9), 8);
  assert.equal(m.items.length, 9);
  assert.equal(m.from, 0);
});

test('minimapModel: больше девяти — окно из семи вокруг активного', () => {
  const m = M.minimapModel(titles(12), 6);
  assert.equal(m.items.length, 7);
  assert.equal(m.from, 3);
  assert.equal(m.to, 9);
  assert.equal(m.items[3].active, true);
  assert.equal(m.items[3].title, 'Ряд 7');
});

test('minimapModel: у краёв окно прижимается, а не выходит за список', () => {
  const head = M.minimapModel(titles(12), 0);
  assert.equal(head.from, 0);
  assert.equal(head.to, 6);
  const tail = M.minimapModel(titles(12), 11);
  assert.equal(tail.from, 5);
  assert.equal(tail.to, 11);
  assert.equal(tail.items[6].active, true);
});

test('minimapModel: активного ряда нет — окно с начала, подсветки нет', () => {
  const m = M.minimapModel(titles(12), -1);
  assert.equal(m.active, -1);
  assert.equal(m.from, 0);
  assert.equal(m.items.length, 7);
  assert.equal(m.items.some((i) => i.active), false);
});

test('minimapModel: индекс за пределами списка — как будто его нет', () => {
  const m = M.minimapModel(titles(4), 9);
  assert.equal(m.active, -1);
  assert.equal(m.items.length, 4);
});

test('minimapModel: безымянный ряд получает номер, пустой список — null', () => {
  const m = M.minimapModel(['Новинки', '   ', ''], 0);
  assert.equal(m.items[1].title, 'Ряд 2');
  assert.equal(m.items[2].title, 'Ряд 3');
  assert.equal(M.minimapModel([], 0), null);
  assert.equal(M.minimapModel(null, 0), null);
});

/* ---------------------------------------------------------------------- */
/* searchCollections — поиск подборок по названию и id.                    */
/* ---------------------------------------------------------------------- */

const COLLECTIONS = [
  { id: 'star-wars', title: 'Звёздные войны' },
  { id: 'harry-potter', title: 'Гарри Поттер' },
  { id: 'lotr', title: 'Властелин колец' },
  { id: 'marvel', title: 'Марвел: весь кинематографический' },
  { id: 'star-trek', title: 'Звёздный путь' },
  { id: 'night-stars', title: 'Кино под звёздами' },
  { id: 'nolan', title: 'Кристофер Нолан' },
  { id: 'retro', title: 'Ретрокино' },
  { id: 'a24', title: 'A24' }
];

const ids = (list) => list.map((i) => i.id);

test('searchCollections: совпадение с начала названия — первым', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'звёзд')), ['star-wars', 'star-trek', 'night-stars']);
});

test('searchCollections: регистр и «ё» не мешают', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'ЗВЕЗД')), ['star-wars', 'star-trek', 'night-stars']);
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'нолан')), ['nolan']);
});

test('searchCollections: начало слова внутри названия важнее середины', () => {
  const found = M.searchCollections(COLLECTIONS, 'кол');
  assert.deepEqual(ids(found), ['lotr']);
  /* «Кино под звёздами» начинается с запроса, у «Ретрокино» он в середине
     слова — этот всегда ниже. */
  const kino = M.searchCollections(COLLECTIONS, 'кино');
  assert.deepEqual(ids(kino), ['night-stars', 'retro']);
});

test('searchCollections: ищет и по id — им пользуются только с клавиатуры', () => {
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'lotr')), ['lotr']);
  assert.deepEqual(ids(M.searchCollections(COLLECTIONS, 'a24')), ['a24']);
});

test('searchCollections: пустой запрос и мусор — пусто', () => {
  assert.deepEqual(M.searchCollections(COLLECTIONS, ''), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, '   '), []);
  assert.deepEqual(M.searchCollections(null, 'звёзд'), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, null), []);
  assert.deepEqual(M.searchCollections(COLLECTIONS, 'чебурашка'), []);
});

test('searchCollections: не больше восьми результатов', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ id: 'c' + i, title: 'Кино ' + i }));
  assert.equal(M.searchCollections(many, 'кино').length, 8);
});

test('searchCollections: подборка без названия не роняет поиск', () => {
  const list = [{ id: 'x' }, { id: 'y', title: 'Ужасы' }];
  assert.deepEqual(ids(M.searchCollections(list, 'ужас')), ['y']);
});

/* ---------------------------------------------------------------------- */
/* jumpLabel — подпись индикатора «где я в ряду».                          */
/* ---------------------------------------------------------------------- */

test('jumpLabel: позиция считается от единицы', () => {
  assert.equal(M.jumpLabel(0, 60), '1 / 60');
  assert.equal(M.jumpLabel(13, 60), '14 / 60');
  assert.equal(M.jumpLabel(59, 60), '60 / 60');
});

test('jumpLabel: без позиции или в ряду из одной карточки показывать нечего', () => {
  assert.equal(M.jumpLabel(-1, 60), '');
  assert.equal(M.jumpLabel(0, 1), '');
  assert.equal(M.jumpLabel(0, 0), '');
  assert.equal(M.jumpLabel(70, 60), '');
  assert.equal(M.jumpLabel(null, null), '');
});

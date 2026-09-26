import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 25: метки на постерах, обратный отсчёт, скелетоны.

   Чистые функции (badgeFor, countdown) зависят от LC.util.daysUntil и
   LC.cardinfo.shortDate, поэтому модуль грузится не общим test/_load.mjs
   (тот кладёт в LC только util), а своим мини-загрузчиком в ОДИН LC —
   тем же приёмом, что в test/css.test.mjs. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/62_badges.js', import.meta.url), 'utf8');

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

/* Свежий экземпляр LC.badges. deps копируются в LC до выполнения модуля
   (pref/lang/Lampa/$ подменяются тестами рантайма). */
function fresh(deps) {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '35_cardinfo.js');
  const extra = deps || {};
  for (const k in extra) LC[k] = extra[k];
  new Function('LC', 'module', '$', 'Lampa', SRC)(LC, module, extra.$q || null, extra.Lampa || null);
  return { api: module.exports, LC: LC };
}

const MONTHS = 'янв,фев,мар,апр,мая,июн,июл,авг,сен,окт,ноя,дек'.split(',');
const WORDS = { soon: 'Скоро', fresh: 'Новинка', cont: 'Продолжить', months: MONTHS };
const TODAY = new Date(2026, 8, 17); /* 17 сентября 2026 */

/* ====================================================================== */
/* badgeFor                                                               */
/* ====================================================================== */

test('badgeFor: дата в будущем — «Скоро · 17 дек»', () => {
  const B = fresh().api;
  const b = B.badgeFor({ release_date: '2026-12-17' }, TODAY, { words: WORDS });
  assert.equal(b.kind, 'soon');
  assert.equal(b.text, 'Скоро · 17 дек');
  assert.equal(b.percent, 0);
});

test('badgeFor: сериал — first_air_date тем же путём', () => {
  const B = fresh().api;
  const b = B.badgeFor({ first_air_date: '2026-10-01', name: 'X' }, TODAY, { words: WORDS });
  assert.equal(b.kind, 'soon');
  assert.equal(b.text, 'Скоро · 1 окт');
});

test('badgeFor: премьера в последние 30 дней — «Новинка», раньше — ничего', () => {
  const B = fresh().api;
  assert.equal(B.badgeFor({ release_date: '2026-09-17' }, TODAY, { words: WORDS }).kind, 'new');
  assert.equal(B.badgeFor({ release_date: '2026-08-18' }, TODAY, { words: WORDS }).kind, 'new', 'ровно 30 дней — ещё новинка');
  assert.equal(B.badgeFor({ release_date: '2026-08-18' }, TODAY, { words: WORDS }).text, 'Новинка');
  assert.equal(B.badgeFor({ release_date: '2026-08-17' }, TODAY, { words: WORDS }), null, '31 день — уже нет');
});

/* Ревью Task 63: в метке прогресса остался один процент. Со слова
   «Продолжить» строка перестала помещаться на постер, когда кегль метки
   поднялся до минимума tvOS: замер на стенде 960×540@2 — «Продолжить · 43 %»
   просит 118 CSS px при доступных 101, «43 %» — 35. Слово при этом никуда не
   делось с экрана: им подписаны строка прогресса в карточке и кнопка
   «Смотреть». */
test('badgeFor: прогресс 5–95 — метка «43 %» с percent, без слова', () => {
  const B = fresh().api;
  const ctx = { words: WORDS, progress: function () { return 43.4; } };
  const b = B.badgeFor({ release_date: '2020-01-01' }, TODAY, ctx);
  assert.equal(b.kind, 'progress');
  assert.equal(b.text, '43 %');
  assert.equal(b.percent, 43);
  /* Слово из ctx.words метка больше не берёт — даже если рантайм его
     передаст. */
  assert.equal(B.badgeFor({ release_date: '2020-01-01' }, TODAY, { words: { cont: 'Продолжить' }, progress: function () { return 43.4; } }).text, '43 %');
});

test('badgeFor: прогресс вне 5–95 меткой не становится', () => {
  const B = fresh().api;
  const low = { words: WORDS, progress: function () { return 3; } };
  const high = { words: WORDS, progress: function () { return 97; } };
  assert.equal(B.badgeFor({ release_date: '2020-01-01' }, TODAY, low), null);
  assert.equal(B.badgeFor({ release_date: '2020-01-01' }, TODAY, high), null);
});

test('badgeFor: прогресс перебивает «Новинку», но не готовую метку ряда', () => {
  const B = fresh().api;
  const ctx = { words: WORDS, progress: function () { return 50; } };
  assert.equal(B.badgeFor({ release_date: '2026-09-10' }, TODAY, ctx).kind, 'progress');
  const withOwn = B.badgeFor({ release_date: '2026-09-10', lumen_badge: 'Новая серия · 12 сен' }, TODAY, ctx);
  assert.equal(withOwn.kind, 'custom');
  assert.equal(withOwn.text, 'Новая серия · 12 сен');
});

test('badgeFor: нет данных — null, входные данные не мутируются', () => {
  const B = fresh().api;
  assert.equal(B.badgeFor(null, TODAY, { words: WORDS }), null);
  assert.equal(B.badgeFor({}, TODAY, { words: WORDS }), null);
  assert.equal(B.badgeFor({ release_date: '' }, TODAY, { words: WORDS }), null);
  assert.equal(B.badgeFor({ release_date: 'мусор' }, TODAY, { words: WORDS }), null);
  const card = { release_date: '2026-12-17' };
  B.badgeFor(card, TODAY, { words: WORDS });
  assert.deepEqual(card, { release_date: '2026-12-17' });
});

test('badgeFor: без ctx и без слов не падает и не даёт голого «· »', () => {
  const B = fresh().api;
  assert.equal(B.badgeFor({ release_date: '2026-12-17' }, TODAY).kind, 'soon');
  /* Без списка месяцев дата не собирается — рантайм в таком состоянии не
     бывает, но метка обязана остаться пустой строкой, а не «· 17 дек» без
     подписи и не «Скоро · ». Пустой текст decorate() не рисует вовсе. */
  assert.equal(B.badgeFor({ release_date: '2026-12-17' }, TODAY, {}).text, '');
});

/* ====================================================================== */
/* countdown                                                              */
/* ====================================================================== */

function plural(n, forms) {
  n = Math.abs(n) % 100;
  var tail = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

const CW = {
  premiere: 'Премьера',
  today: 'Сегодня премьера',
  tomorrow: 'завтра',
  inDays: 'через',
  months: MONTHS,
  daysWord: function (n) { return plural(n, ['день', 'дня', 'дней']); }
};

test('countdown: «Премьера через 31 день · 17 дек»', () => {
  const B = fresh().api;
  assert.equal(B.countdown('2026-10-18', TODAY, CW), 'Премьера через 31 день · 18 окт');
});

test('countdown: склонение дней — 1/2/5', () => {
  const B = fresh().api;
  assert.equal(B.countdown('2026-09-19', TODAY, CW), 'Премьера через 2 дня · 19 сен');
  assert.equal(B.countdown('2026-09-22', TODAY, CW), 'Премьера через 5 дней · 22 сен');
  assert.equal(B.countdown('2026-09-38', TODAY, CW), null, 'несуществующий день — null');
});

test('countdown: сегодня и завтра — словами', () => {
  const B = fresh().api;
  assert.equal(B.countdown('2026-09-17', TODAY, CW), 'Сегодня премьера');
  assert.equal(B.countdown('2026-09-18', TODAY, CW), 'Премьера завтра');
});

test('countdown: прошлое, мусор и отсутствие слов — null', () => {
  const B = fresh().api;
  assert.equal(B.countdown('2026-09-16', TODAY, CW), null);
  assert.equal(B.countdown('', TODAY, CW), null);
  assert.equal(B.countdown(null, TODAY, CW), null);
  assert.equal(B.countdown('2026-12-17', TODAY, null), null);
});

/* ====================================================================== */
/* Рантайм: decorate / mount / unmount / strip                            */
/* ====================================================================== */

/* Фейковая карточка ряда: .card с вложенными .card__view и .card__age, как в
   шаблоне 'card' Lampa (<div class="card__age">{release_year}</div>). year —
   текст подписи; '' моделирует карточку без года. */
function makeCard(data, year) {
  const view = new FakeEl(['card__view']);
  const age = new FakeEl(['card__age']);
  age.text(year === undefined ? '2017' : year);
  const card = new FakeEl(['card'], [view, age]);
  card.card_data = data;
  card.nodeType = 1;
  card.classList = { contains: (c) => card._class.indexOf(c) !== -1 };
  card.querySelectorAll = () => [];
  return card;
}

/* Корень активности с набором карточек. find('.card') отдаёт весь набор —
   фейковый DOM с правки 2026-09-23 отвечает на find всеми совпадениями, как
   jQuery (долг фазы 1, п.6); прежде здесь стояла подмена find под массив. */
function makeRoot(cards) {
  const root = new FakeEl(['activity'], cards);
  root.closest = () => EMPTY;
  return root;
}

/* Минимальный $: строка -> узел с распознанным классом, узел -> он сам. */
function makeQ() {
  return function (html) {
    if (typeof html !== 'string') {
      if (html instanceof FakeEl) return html;
      return EMPTY;
    }
    const m = /class="([^"]*)"/.exec(html);
    /* text() остаётся штатным (FakeEl.prototype): Task 62a читает текст
       собранной метки, и «сеттер, который молча работает и геттером»
       отдавал бы на чтении сам узел. */
    return new FakeEl(m ? m[1].split(/\s+/).filter(Boolean) : []);
  };
}

function runtime(extra) {
  const q = makeQ();
  const deps = Object.assign({
    pref: function () { return true; },
    /* Task 62a: вид меток читает одна функция на весь плагин (LC.badgesMode,
       src/81_prefs.js) — там же, где стоит дефолт пункта настроек. */
    badgesMode: function () { return 'poster'; },
    lang: function (key) {
      if (key === 'lumen_badge_soon') return 'Скоро';
      if (key === 'lumen_badge_new') return 'Новинка';
      if (key === 'lumen_card_continue') return 'Продолжить';
      if (key === 'lumen_card_months_short') return MONTHS.join(',');
      return key;
    },
    $q: q,
    Lampa: { Activity: { active: function () { return null; } } }
  }, extra || {});
  const out = fresh(deps);
  out.q = q;
  return out;
}

test('decorate: метка попадает внутрь .card__view один раз', () => {
  const { api } = runtime();
  const card = makeCard({ release_date: '2026-12-17' });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    api.decorate(card, null, null);
  } finally {
    delete globalThis.window;
  }
  const view = card._children[0];
  const badges = view._children.filter((c) => c.hasClass('lumen-badge'));
  assert.equal(badges.length, 1, 'ровно одна метка');
  assert.ok(badges[0].hasClass('lumen-badge--soon'));
  assert.equal(card.lumen_badged, true);
});

test('decorate: без метки узел не создаётся вовсе', () => {
  const { api } = runtime();
  const card = makeCard({ release_date: '2000-01-01' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.equal(card._children[0]._children.length, 0);
});

/* Task 42: штатная плашка рейтинга (.card__vote) на постере ряда скрыта
   CSS, число переезжает в подпись под постером. */
test('decorate: рейтинг дописывается в .card__age через « · ★ »', () => {
  const { api } = runtime();
  const card = makeCard({ release_date: '2026-12-17', vote_average: 6.42 });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    api.decorate(card, null, null);
  } finally {
    delete globalThis.window;
  }
  assert.equal(card._children[1].text(), '2017 · ★ 6.4', 'один знак после запятой, дубля нет');
});

test('decorate: без рейтинга подпись остаётся годом, без года — только рейтинг', () => {
  const { api } = runtime();
  const bare = makeCard({ release_date: '2026-12-17' });
  const noYear = makeCard({ release_date: '2026-12-17', vote_average: 8 }, '');
  const low = makeCard({ release_date: '2026-12-17', vote_average: 0.4 });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(bare, null, null);
    api.decorate(noYear, null, null);
    api.decorate(low, null, null);
  } finally {
    delete globalThis.window;
  }
  assert.equal(bare._children[1].text(), '2017', 'нечего дописывать');
  assert.equal(noYear._children[1].text(), '★ 8.0', 'без года разделитель не нужен');
  assert.equal(low._children[1].text(), '2017', 'рейтинг ниже 1 — это «нет оценок», а не оценка');
});

/* Task 43: флага opts.rating больше нет, и тест на него снят вместе с ним.
   Его просила сетка подборки, пока показывала рейтинг штатной плашкой
   .card__vote; теперь подпись там такая же, как на главной (src/46_hub.js
   зовёт decorate только с bar:false), а плашку прячет CSS. */

test('decorate: выключенная настройка не ставит ни метки, ни флага', () => {
  const { api } = runtime({ badgesMode: function () { return 'off'; } });
  const card = makeCard({ release_date: '2026-12-17' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.equal(card._children[0]._children.length, 0);
  assert.ok(!card.lumen_badged, 'флаг не ставится — включение настройки нарисует метку');
});

/* ====================================================================== */
/* Task 62a (фаза 5): метка в подписи под постером.                        */
/*                                                                         */
/* У Apple TV на постере плашек нет вовсе: статус читается строкой под ним  */
/* (docs/research/2026-09-21-tv-design-specs.md §1). Значение 'caption'     */
/* переносит тот же текст в .card__age, к году и рейтингу.                  */
/* ====================================================================== */

test('Task 62a: в режиме caption метка уходит в подпись, а постер остаётся чистым', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-12-17', vote_average: 6.42 });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    api.decorate(card, null, null);
  } finally {
    delete globalThis.window;
  }
  const view = card._children[0];
  assert.deepEqual(view._children.filter((c) => c.hasClass('lumen-badge')), [], 'плашки на постере быть не должно');
  const age = card._children[1];
  const caps = age._children.filter((c) => c.hasClass('lumen-badge-cap'));
  assert.equal(caps.length, 1, 'ровно одна метка в подписи');
  assert.ok(caps[0].hasClass('lumen-badge-cap--soon'), 'вид метки сохранён: ' + caps[0]._class.join(' '));
  /* Метка стоит ПЕРВОЙ: подпись узкая (ширина карточки ряда) и обрезается
     многоточием, и срезать она должна год с рейтингом, а не статус. */
  assert.equal(age._children[0], caps[0], 'метка обязана стоять перед годом');
  assert.equal(caps[0].text(), 'Скоро · 17 дек · ', 'разделитель — при непустой подписи');
  /* A2: рейтинг в подпись с меткой больше не дописывается — разбор и замеры
     в тесте «A2» ниже. */
  assert.equal(age.text(), '2017', 'год остаётся на месте');
});

/* ====================================================================== */
/* A2 (волна A финального плана): метка в подписи съедала год и рейтинг.    */
/*                                                                         */
/* Замер на стенде 960×540@2, оба шрифта раздела (Golos Text и Inter), все  */
/* четыре масштаба интерфейса. Доступная ширина подписи: 98 px на «мелком», */
/* 109 на «штатном», 101 на «крупном», 110 на «огромном» (на трёх последних */
/* работает правило узкой колонки, src/30_css.js).                          */
/*   «Новинка · 2026 · ★ 7.3» — 112.8…125.1 px: не влезает ни на одном      */
/*      масштабе, ellipsis съедает год и рейтинг целиком;                   */
/*   «Новинка · 2026»          —  77.7…87.3 px: влезает на всех четырёх;    */
/*   «49 % · 2026»             —  53.9…67.4 px: влезает на всех четырёх.    */
/* Выброшен рейтинг, а не год: штатную плашку .card__vote на главной мы и   */
/* так прячем (src/30_css.js), то есть рейтинг в подписи дублирует оценку   */
/* из кадра героя, а год в кадре не повторяется нигде.                      */
/* ====================================================================== */

test('A2: caption — у карточки с меткой рейтинга в подписи нет, остаётся «метка · год»', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  const age = card._children[1];
  assert.equal(age._children[0].text(), 'Новинка · ', 'метка на месте');
  assert.equal(age.text(), '2017', 'рейтинг в подпись с меткой не дописывается');
  assert.ok(!age[0].lumen_rated, 'флага рейтинга быть не должно');
});

test('A2: caption — карточка БЕЗ метки рейтинг в подписи сохраняет', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  /* Дата далеко в прошлом: ни «Скоро», ни «Новинка», прогресса нет — метки
     не будет вовсе, и подписи ничего не мешает. */
  const card = makeCard({ release_date: '2000-01-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  const age = card._children[1];
  assert.deepEqual(age._children.filter((c) => c.hasClass('lumen-badge-cap')), [], 'метки нет');
  assert.equal(age.text(), '2017 · ★ 7.3', 'рейтинг остаётся');
});

test('A2: poster — рейтинг в подписи остаётся и у карточки с меткой', () => {
  const { api } = runtime({ badgesMode: function () { return 'poster'; } });
  const card = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.equal(card._children[1].text(), '2017 · ★ 7.3', 'метка на обложке строке не мешает');
});

/* Смена вида меток на ЖИВОМ экране (пресет из карточки, настройка из меню):
   strip() снимает метку подписи, а рейтинг дописан прямо в текст узла, своего
   узла у него нет. Без восстановления прежнего текста возврат вида 'caption'
   собрал бы ровно ту строку, ради которой A2 и делался. */
test('A2: strip возвращает подписи год без рейтинга — вид меток переключаем на живом экране', () => {
  const { api } = runtime({ badgesMode: function () { return 'poster'; } });
  const card = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    assert.equal(card._children[1].text(), '2017 · ★ 7.3');
    const root = makeRoot([card]);
    const baseFind = root.find.bind(root);
    root.find = function (sel) {
      if (sel.indexOf('.lumen-badge') === 0) return { length: 0, remove: function () { return this; } };
      return baseFind(sel);
    };
    api.strip(root);
    assert.equal(card._children[1].text(), '2017', 'рейтинг снят вместе с меткой');
    assert.ok(!card._children[1][0].lumen_rated, 'флаг сброшен — второй проход перепишет подпись заново');
  } finally {
    delete globalThis.window;
  }
});

/* Ревью Task 62: метка РЯДА («Новая серия · 12 сен» собирает src/45_personal.js)
   в подписи теряет хвост с датой. Замер на стенде 960×540@2 (штатный масштаб,
   Golos): подписи доступно 109.0 CSS px, полная метка просит 108.4 — год с
   рейтингом (65.4) не поместились бы вовсе, а плашку .card__vote в этом виде
   мы прячем. Без даты метка просит 66.1. */
test('Task 62a: caption — у метки ряда остаётся повод без даты', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-12-17', lumen_badge: 'Новая серия · 12 сен' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.equal(card._children[1]._children[0].text(), 'Новая серия · ');

  /* Метка без хвоста остаётся целой. */
  const plain = makeCard({ release_date: '2026-12-17', lumen_badge: 'Через 14 дней' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(plain, null, null); } finally { delete globalThis.window; }
  assert.equal(plain._children[1]._children[0].text(), 'Через 14 дней · ');
});

test('Task 62a: на постере метка ряда остаётся полной — там ей разрешены две строки', () => {
  const { api } = runtime({ badgesMode: function () { return 'poster'; } });
  const card = makeCard({ release_date: '2026-12-17', lumen_badge: 'Новая серия · 12 сен' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  const badge = card._children[0]._children.filter((c) => c.hasClass('lumen-badge'))[0];
  assert.equal(badge.text(), 'Новая серия · 12 сен', 'дата на постере не теряется');
});

/* Сетка подборки снимает .card__age у карточки без года (src/46_hub.js) —
   в этом виде метку тогда ставить некуда, и карточка остаётся без неё. */
test('Task 62a: caption — подписи нет вовсе, метка просто не ставится', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const view = new FakeEl(['card__view']);
  const card = new FakeEl(['card'], [view]);
  card.card_data = { release_date: '2026-12-17' };
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.deepEqual(view._children, [], 'на постер метка в этом виде не уходит');
});

test('Task 62a: caption — пустая подпись обходится без висящего разделителя', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-12-17' }, '');
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  assert.equal(card._children[1]._children[0].text(), 'Скоро · 17 дек');
});

/* Полоса прогресса на постере остаётся в ОБОИХ режимах: это не плашка с
   текстом, а тонкая линия у нижней кромки — ровно то, чем показывает
   недосмотренное и сам Apple TV. */
test('Task 62a: caption — процент уходит в подпись, полоса прогресса остаётся на постере', () => {
  const { api } = runtime({
    badgesMode: function () { return 'caption'; },
    Lampa: {
      Activity: { active: function () { return null; } },
      Utils: { hash: function (k) { return k; } },
      Timeline: { view: function () { return { percent: 43 }; } }
    }
  });
  const card = makeCard({ release_date: '2020-01-01', original_title: 'X' });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  const view = card._children[0];
  assert.deepEqual(view._children.filter((c) => c.hasClass('lumen-badge')), []);
  assert.equal(view._children.filter((c) => c.hasClass('lumen-badge-bar')).length, 1, 'полоса прогресса на месте');
  assert.equal(card._children[1]._children[0].text(), '43 % · ');
});

/* Найдено живьём на стенде 2026-09-21: вид меток сменили из настроек,
   лежащих ПОВЕРХ карточки, а главная осталась в истории с нарисованными
   плашками и флагом lumen_badged на карточках — возврат на неё показывал
   метки прошлого вида. LC.applyBadgesPref до чужого экрана не достаёт
   (он работает с ОТКРЫТОЙ главной), значит сверять вид обязано само
   монтирование. */
test('Task 62a: вид сменился, пока экран лежал в истории — возврат перерисовывает метки', () => {
  class FakeObserver { constructor() {} observe() {} disconnect() {} }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    let view = 'poster';
    const { api } = runtime({ badgesMode: function () { return view; } });
    const card = makeCard({ release_date: '2026-12-17' });
    const root = makeRoot([card]);
    api.mount(root);
    assert.equal(card._children[0]._children.length, 1, 'плашка на постере нарисована');

    view = 'caption';
    api.mount(root);
    assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 0,
      'плашка прошлого вида осталась на постере');
    assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1,
      'метка нового вида не нарисована');

    /* Тот же вид второй раз экран не перерисовывает: это обычный возврат на
       главную, и лишний проход по всем карточкам ряда стоит кадров. */
    const before = card.lumen_badged;
    api.mount(root);
    assert.equal(card.lumen_badged, before);
    assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

/* Волна «подложка», п.C1: на главной с живым кадром героя строки «год · ★»
   под постером нет (src/30_css.js, правило .card__age), а в виде меток
   «в подписи» метка живёт именно в ней. Поэтому на такой главной метку
   рисует постер — как в виде «на постере», вместе с рейтингом в подписи
   (строка скрыта, но за порогом «кадра нет» она возвращается целой). */
function mountedCaption(extra, rootClasses, win) {
  class FakeObserver { constructor() {} observe() {} disconnect() {} }
  globalThis.window = Object.assign({ Lampa: {}, MutationObserver: FakeObserver }, win || {});
  globalThis.MutationObserver = FakeObserver;
  try {
    const { api } = runtime(Object.assign({ badgesMode: function () { return 'caption'; } }, extra || {}));
    const card = makeCard({ release_date: '2026-12-17', vote_average: 6.42 });
    const root = makeRoot([card]);
    rootClasses.forEach((c) => root.addClass(c));
    api.mount(root);
    return card;
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
}

test('волна «подложка», п.C1: «в подписи» на главной с героем — метка на постере, подпись с годом и рейтингом', () => {
  /* Правка 2026-09-26: так — только со сжатым состоянием (флаг
     LC.heroCompact, src/30_css.js), без него строка «год · ★» на месте. */
  const card = mountedCaption({ heroCompact: true, pref: function (key, def) { return key === 'lumen_hero_size' ? 'large' : def; } }, ['lumen-main']);
  const view = card._children[0];
  const age = card._children[1];
  const plates = view._children.filter((c) => c.hasClass('lumen-badge'));
  assert.equal(plates.length, 1, 'метка обязана встать на постер');
  assert.ok(plates[0].hasClass('lumen-badge--soon'));
  assert.equal(age._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 0, 'метка в скрытой строке подписи пропала бы');
  assert.equal(age.text(), '2017 · ★ 6.4', 'подпись — как в виде «на постере»');
});

test('волна «подложка», п.C1: «в подписи» без героя и при компактном кадре — метка в подписи, как прежде', () => {
  /* Без героя (класса .lumen-main нет — «Кадр над рядами: выключен»). */
  let card = mountedCaption({ pref: function (key, def) { return key === 'lumen_hero_size' ? 'off' : def; } }, []);
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 0, 'без героя плашки на постере быть не должно');
  assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1, 'без героя метка — в подписи');
  /* Компактный кадр строку «год · ★» не прячет (мету он не показывает). */
  card = mountedCaption({ pref: function (key, def) { return key === 'lumen_hero_size' ? 'compact' : def; } }, ['lumen-main']);
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 0, 'компактный кадр: плашки на постере быть не должно');
  assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1, 'компактный кадр: метка — в подписи');
});

/* Волна «хвосты героя», п.H: строку «год · ★» CSS прячет только при живом
   кадре — до порога «кадра нет» по отношению сторон окна (heroMinRatio в
   src/30_css.js, наружу — LC.heroOffRatio). В широком окне кадра нет,
   строка на месте, и метка «в подписи» обязана жить в ней, а не на постере.
   Признак тот же, что у CSS: тот же медиазапрос через matchMedia (без него
   — innerWidth/innerHeight). */
function mediaAt(ratio) {
  return {
    matchMedia: (q) => {
      const m = /min-aspect-ratio:\s*(\d+)\/100/.exec(q);
      assert.ok(m, 'медиазапрос не тот, что у CSS: ' + q);
      return { matches: ratio >= Number(m[1]) / 100 };
    }
  };
}

test('п.H: «в подписи» в окне шире порога «кадра нет» — метка в подписи, как без героя', () => {
  const large = { heroCompact: true, pref: function (key, def) { return key === 'lumen_hero_size' ? 'large' : def; }, heroOffRatio: () => 287 };
  let card = mountedCaption(large, ['lumen-main'], mediaAt(3.0));
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 0, 'кадра нет — плашки на постере быть не должно');
  assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1, 'кадра нет — метка в подписи');
  /* До порога кадр живой — метка на постере (п.C1). */
  card = mountedCaption(large, ['lumen-main'], mediaAt(1.78));
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 1, 'живой кадр — метка на постере');
  /* Без matchMedia — по размерам окна. */
  card = mountedCaption(large, ['lumen-main'], { innerWidth: 2592, innerHeight: 864 });
  assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1, '3:1 без matchMedia — метка в подписи');
  card = mountedCaption(large, ['lumen-main'], { innerWidth: 1920, innerHeight: 1080 });
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 1, '16:9 без matchMedia — метка на постере');
});

/* Правка 2026-09-26 (пользователь: «чтобы ряд плиток включал год»): без
   сжатого состояния (флаг LC.heroCompact выключен — так по умолчанию)
   строка «год · ★» под постером главной есть и при живом кадре, поэтому
   метка «в подписи» живёт в ней, а не на постере, — при любом размере кадра
   и в любом окне. */
test('правка 2026-09-26: «в подписи» на главной с героем без сжатия — метка в подписи, не на постере', () => {
  for (const size of ['large', 'medium', 'compact']) {
    for (const flag of [undefined, false]) {
      const extra = { pref: function (key, def) { return key === 'lumen_hero_size' ? size : def; }, heroOffRatio: () => 287 };
      if (flag !== undefined) extra.heroCompact = flag;
      const card = mountedCaption(extra, ['lumen-main'], mediaAt(1.78));
      assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge')).length, 0, size + ': метка на постере при строке «год · ★» под ним');
      assert.equal(card._children[1]._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 1, size + ': метки нет в подписи');
    }
  }
});

/* Долг фазы 1, п.6 (2026-09-23): фейковый DOM отдаёт на find все
   совпадения, и strip проверяется на нескольких карточках, а не на первой.
   На прежнем фейке (find — первый найденный) тест падает: метка второй и
   третьей карточки оставалась на месте. */
test('strip: снимает метки и рейтинг со ВСЕХ карточек экрана, а не с первой', () => {
  const { api } = runtime();
  const cards = [
    makeCard({ release_date: '2026-12-17', vote_average: 6.4 }),
    makeCard({ release_date: '2026-12-18', vote_average: 7.1 }),
    makeCard({ release_date: '2026-12-19', vote_average: 8.3 })
  ];
  globalThis.window = { Lampa: {} };
  try {
    cards.forEach((c) => api.decorate(c, null, null));
    const root = makeRoot(cards);
    assert.equal(root.find('.lumen-badge').length, 3, 'предусловие: метка у каждой карточки');
    api.strip(root);
    assert.equal(root.find('.lumen-badge').length, 0, 'метки сняты у всех трёх');
    cards.forEach((c, i) => {
      assert.equal(c.lumen_badged, false, 'карточка ' + i + ': флаг снят — метку можно нарисовать заново');
      assert.equal(c._children[1].text(), '2017', 'карточка ' + i + ': рейтинг ушёл из подписи');
    });
  } finally {
    delete globalThis.window;
  }
});

test('Task 62a: strip снимает и метки подписи — режим можно переключить на живом экране', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-12-17' });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    const removed = [];
    const root = makeRoot([card]);
    const baseFind = root.find.bind(root);
    root.find = function (sel) {
      if (sel.indexOf('.lumen-badge') === 0) return { length: 1, remove: function () { removed.push(sel); } };
      return baseFind(sel);
    };
    api.strip(root);
    assert.ok(removed.indexOf('.lumen-badge-cap') !== -1, 'метка подписи осталась бы дублем: ' + removed.join(', '));
  } finally {
    delete globalThis.window;
  }
});

test('mount/unmount: наблюдатель один, снимается и не воскресает сам', () => {
  const observed = [];
  let disconnects = 0;
  class FakeObserver {
    constructor(cb) { this.cb = cb; }
    observe(node, opts) { observed.push({ node: node, opts: opts }); }
    disconnect() { disconnects++; }
  }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    const { api } = runtime();
    const root = makeRoot([makeCard({ release_date: '2026-12-17' })]);
    api.mount(root);
    api.mount(root);
    assert.equal(observed.length, 1, 'повторный mount того же корня наблюдателя не удваивает');
    assert.equal(observed[0].opts.childList, true);
    assert.equal(observed[0].opts.subtree, true);
    assert.ok(!observed[0].opts.attributes, 'атрибуты слушает герой — фильтры не пересекаются');
    assert.equal(api.active(), true);
    api.unmount();
    assert.equal(disconnects, 1);
    assert.equal(api.active(), false);
    api.unmount();
    assert.equal(disconnects, 1, 'unmount идемпотентен');
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

test('mount: карточки, уже лежащие в корне, получают метки сразу', () => {
  class FakeObserver { constructor() {} observe() {} disconnect() {} }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    const { api } = runtime();
    const cards = [makeCard({ release_date: '2026-12-17' }), makeCard({ release_date: '2000-01-01' })];
    api.mount(makeRoot(cards));
    assert.equal(cards[0]._children[0]._children.length, 1);
    assert.equal(cards[1]._children[0]._children.length, 0);
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

test('mount: выключенная настройка снимает уже стоящий наблюдатель', () => {
  let disconnects = 0;
  class FakeObserver { constructor() {} observe() {} disconnect() { disconnects++; } }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    let on = true;
    const { api } = runtime({ badgesMode: function () { return on ? 'poster' : 'off'; } });
    api.mount(makeRoot([]));
    assert.equal(api.active(), true);
    on = false;
    api.mount(makeRoot([]));
    assert.equal(api.active(), false);
    assert.equal(disconnects, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

test('strip: метки и флаги снимаются — настройку можно включить обратно', () => {
  const { api } = runtime();
  const card = makeCard({ release_date: '2026-12-17' });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, null);
    const removed = [];
    const root = makeRoot([card]);
    const baseFind = root.find.bind(root);
    root.find = function (sel) {
      if (sel.indexOf('.lumen-badge') === 0) {
        return { length: 1, remove: function () { removed.push(sel); } };
      }
      return baseFind(sel);
    };
    api.strip(root);
    /* Task 62a: третьим снимается метка подписи (.lumen-badge-cap) — иначе
       переключение режима оставило бы её дублем рядом с новой. */
    assert.deepEqual(removed, ['.lumen-badge', '.lumen-badge-bar', '.lumen-badge-cap']);
    assert.equal(card.lumen_badged, false);
  } finally {
    delete globalThis.window;
  }
});

test('detach: чужая активность снимает наблюдатель, своя — нет', () => {
  let disconnects = 0;
  class FakeObserver { constructor() {} observe() {} disconnect() { disconnects++; } }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    const { api } = runtime();
    const root = makeRoot([]);
    api.mount(root);
    api.detach(root);
    assert.equal(api.active(), true, 'своя активность наблюдателя не трогает');
    assert.equal(api.owns(root), true);
    api.detach(makeRoot([]));
    assert.equal(api.active(), false);
    assert.equal(disconnects, 1);
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

/* ====================================================================== */
/* Ревью волны A (важное 2): opts.wide — подпись сетки и хаба.             */
/*                                                                        */
/* Правило A2 заведено под карточку ГЛАВНОЙ. Карточка сетки подборки шире, */
/* и там та же строка теряет не год, а хвост рейтинга; замеры по каждому   */
/* масштабу — у самого правила в src/62_badges.js. Без флага карточка      */
/* сетки с меткой оставалась без оценки вовсе: штатную плашку .card__vote  */
/* прячет CSS, а в подпись рейтинг не дописывался.                         */
/* ====================================================================== */

test('важное 2: wide — у карточки с меткой рейтинг в подписи остаётся', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, { bar: false, wide: true }); } finally { delete globalThis.window; }
  const age = card._children[1];
  assert.equal(age.text(), '2017 · ★ 7.3', 'рейтинг обязан быть дописан к году');
  /* Узел метки цел: rate() пишет подпись целиком через text(), и порядок
     «сначала рейтинг, потом метка» — единственный, при котором метка
     переживает запись. */
  assert.equal(age._children[0].text(), 'Новинка · ', 'метка на месте и первой');
  assert.ok(age._children[0].hasClass('lumen-badge-cap'), 'метка осталась своим узлом, а не плоским текстом');
  assert.ok(age._children[0].hasClass('lumen-badge-cap--new'), 'вид метки сохранён: ' + age._children[0]._class.join(' '));
});

test('важное 2: wide не трогает главную — там правило A2 прежнее', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const plain = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  const bar = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(plain, null, null);
    api.decorate(bar, null, { bar: false });
  } finally {
    delete globalThis.window;
  }
  assert.equal(plain._children[1].text(), '2017', 'без opts рейтинга в подписи с меткой нет');
  assert.equal(bar._children[1].text(), '2017', 'bar:false сам по себе рейтинга не возвращает');
});

test('важное 2: wide — strip возвращает подписи чистый год', () => {
  const { api } = runtime({ badgesMode: function () { return 'caption'; } });
  const card = makeCard({ release_date: '2026-09-01', vote_average: 7.3 });
  const root = makeRoot([card]);
  globalThis.window = { Lampa: {} };
  try {
    api.decorate(card, null, { bar: false, wide: true });
    api.strip(root);
  } finally {
    delete globalThis.window;
  }
  const age = card._children[1];
  assert.equal(age.text(), '2017', 'после strip в подписи остаётся только год');
  assert.equal(age._children.filter((c) => c.hasClass('lumen-badge-cap')).length, 0, 'узел метки снят');
  assert.equal(card.lumen_badged, false, 'флаг снят — вид можно нарисовать заново');
});

/* Мелочь ревью фазы 3 (docs/plans/2026-09-15-lumen-phase3-features.md:251):
   строки метки и дата считались заново на каждую карточку ряда. Проход по
   экрану считает их один раз — и метки при этом те же. */
test('scan: строки метки берутся один раз на проход, а не на каждую карточку', () => {
  class FakeObserver { constructor() {} observe() {} disconnect() {} }
  globalThis.window = { Lampa: {}, MutationObserver: FakeObserver };
  globalThis.MutationObserver = FakeObserver;
  try {
    const asked = [];
    const { api } = runtime({
      lang: function (key) {
        asked.push(key);
        if (key === 'lumen_badge_soon') return 'Скоро';
        if (key === 'lumen_badge_new') return 'Новинка';
        if (key === 'lumen_card_months_short') return MONTHS.join(',');
        return key;
      }
    });
    const cards = [];
    for (let i = 0; i < 12; i++) cards.push(makeCard({ release_date: '2026-12-17' }));
    api.mount(makeRoot(cards));
    const months = asked.filter((k) => k === 'lumen_card_months_short').length;
    assert.equal(months, 1, 'месяцы разобраны ' + months + ' раз на 12 карточек');
    for (const card of cards) {
      const badge = card._children[0]._children.filter((c) => c.hasClass('lumen-badge'));
      assert.equal(badge.length, 1, 'у каждой карточки своя метка');
      assert.ok(badge[0].hasClass('lumen-badge--soon'));
    }
  } finally {
    delete globalThis.window;
    delete globalThis.MutationObserver;
  }
});

/* ====================================================================== */
/* Сверка 2026-09-26: «Осталось N мин» в «Досмотреть».                    */
/*                                                                        */
/* Процент говорит, сколько досмотрено, а решают «успею ли» минутами.     */
/* Timeline Lampa хранит и позицию, и длительность файла в секундах       */
/* (view, app.min.js:23899-23944) — метка карточки РЯДА «Досмотреть»      */
/* (card.lumen_continue, src/45_personal.js) пишет остаток минутами       */
/* вместо «43 %»; полоса прогресса на постере остаётся. В остальных рядах */
/* — прежний процент. Нет длительности — прежний процент.                 */
/* ====================================================================== */

test('сверка: badgeFor — в «Досмотреть» «Осталось 57 мин» вместо процента', () => {
  const B = fresh().api;
  const words = Object.assign({ left: 'Осталось {n} мин' }, WORDS);
  const ctx = { words: words, progress: function () { return 43; }, left: function () { return 57; } };
  const b = B.badgeFor({ release_date: '2020-01-01', lumen_continue: true }, TODAY, ctx);
  assert.equal(b.kind, 'progress');
  assert.equal(b.text, 'Осталось 57 мин');
  assert.equal(b.percent, 43, 'полоса прогресса считает тот же процент');
  assert.equal(b.left, true);
  /* Не «Досмотреть» — процент, как был. */
  assert.equal(B.badgeFor({ release_date: '2020-01-01' }, TODAY, ctx).text, '43 %');
  /* Остатка нет (длительность неизвестна) — процент. */
  const none = { words: words, progress: function () { return 43; }, left: function () { return null; } };
  assert.equal(B.badgeFor({ lumen_continue: true }, TODAY, none).text, '43 %');
  /* Без строки — процент, без «{n}» на экране. */
  assert.equal(B.badgeFor({ lumen_continue: true }, TODAY, { words: WORDS, progress: ctx.progress, left: ctx.left }).text, '43 %');
});

test('сверка: decorate — остаток из Timeline (секунды), вверх до минуты; метке «Досмотреть» разрешены две строки', () => {
  const view = { percent: 43, time: 3000, duration: 6420 };
  const { api } = runtime({
    lang: function (key) {
      if (key === 'lumen_badge_left') return 'Осталось {n} мин';
      if (key === 'lumen_card_months_short') return MONTHS.join(',');
      return key;
    },
    Lampa: {
      Activity: { active: function () { return null; } },
      Utils: { hash: function (k) { return k; } },
      Timeline: { view: function () { return view; } }
    }
  });
  const card = makeCard({ release_date: '2020-01-01', original_title: 'X', lumen_continue: true });
  globalThis.window = { Lampa: {} };
  try { api.decorate(card, null, null); } finally { delete globalThis.window; }
  const badge = card._children[0]._children.filter((c) => c.hasClass('lumen-badge'))[0];
  assert.ok(badge, 'метки нет');
  assert.equal(badge.text(), 'Осталось 57 мин', '(6420 − 3000) / 60 = 57');
  assert.ok(badge.hasClass('lumen-badge--progress') && badge.hasClass('lumen-badge--left'));
  assert.equal(card._children[0]._children.filter((c) => c.hasClass('lumen-badge-bar')).length, 1, 'полоса прогресса на месте');
});

test('сверка: decorate — в Timeline нет длительности или позиция за концом — процент', () => {
  for (const view of [{ percent: 43 }, { percent: 43, time: 100, duration: 0 }, { percent: 43, time: 7000, duration: 6420 }]) {
    const { api } = runtime({
      lang: function (key) { return key === 'lumen_badge_left' ? 'Осталось {n} мин' : (key === 'lumen_card_months_short' ? MONTHS.join(',') : key); },
      Lampa: {
        Activity: { active: function () { return null; } },
        Utils: { hash: function (k) { return k; } },
        Timeline: { view: function () { return view; } }
      }
    });
    const card = makeCard({ release_date: '2020-01-01', original_title: 'X', lumen_continue: true });
    globalThis.window = { Lampa: {} };
    try { api.decorate(card, null, null); } finally { delete globalThis.window; }
    const badge = card._children[0]._children.filter((c) => c.hasClass('lumen-badge'))[0];
    assert.equal(badge.text(), '43 %', JSON.stringify(view));
  }
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const T = load('53_themes.js');

const rules = [
  { id: 'halloween', preset: 'bats', keywords: ['halloween', 'slasher'], genres: [27], requireGenre: true, months: [10] },
  { id: 'christmas', preset: 'snow', keywords: ['christmas', 'santa claus'], months: [12, 1] },
  { id: 'space', preset: 'stars', keywords: ['space', 'alien'] }
];
const kw = (...names) => ({ results: names.map((n, i) => ({ id: i, name: n })) });

test('matchTheme: по ключевому слову, регистр и вхождение', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('Christmas Eve'), genres: [] }).id, 'christmas');
  assert.equal(T.matchTheme(rules, { keywords: kw('Outer Space'), genres: [] }).id, 'space');
});

/* Волна производительности (C3a): частицы — самая дорогая часть «Полного»
   режима, а совпадение по вхождению подстроки давало их фильмам, к теме
   отношения не имеющим: «war» ловился в «award» и «edward», «sea» — в
   «seattle» и «research», «sand» — в «sandwich», «space» — в «workspace».
   Теперь слово правила ищется целым словом (или целой фразой) внутри
   ключевого слова фильма. */
test('волна perf: matchTheme — совпадение по целым словам, фразы находятся', () => {
  const R = [
    { id: 'war', preset: 'embers', keywords: ['war'] },
    { id: 'ocean', preset: 'bubbles', keywords: ['sea'] },
    { id: 'desert', preset: 'sand', keywords: ['sand'] },
    { id: 'space', preset: 'stars', keywords: ['space', 'outer space'] }
  ];
  const id = (...names) => { const t = T.matchTheme(R, { keywords: kw(...names), genres: [] }); return t ? t.id : null; };
  for (const miss of ['award', 'edward', 'seattle', 'research', 'sandwich', 'workspace', 'warrior', 'seaside town']) {
    assert.equal(id(miss), null, miss);
  }
  assert.equal(id('world war ii'), 'war');
  assert.equal(id('anti-war'), 'war', 'дефис — граница слова');
  assert.equal(id('War'), 'war', 'регистр не важен');
  assert.equal(id('the sea'), 'ocean');
  assert.equal(id('sand dune'), 'desert');
  assert.equal(id('outer space'), 'space');
  assert.equal(T.matchTheme([{ id: 'p', preset: 'stars', keywords: ['outer space'] }], { keywords: kw('journey into outer space'), genres: [] }).id, 'p',
    'фраза правила внутри ключевого слова');
  assert.equal(T.matchTheme([{ id: 'p', preset: 'stars', keywords: ['outer space'] }], { keywords: kw('outer spacecraft'), genres: [] }), null);
});

/* Волна «хвосты героя», п.E (ревью perf): ключевые слова TMDB нередко во
   множественном числе — «zombies», «explosions», «aliens», «witches», — и
   целое слово их не ловило. Окончание множественного числа английского:
   -es после s/x/z/ch/sh, иначе -s. Ложных совпадений это не возвращает:
   «award» по-прежнему не «war» (граница слова слева), а «wares» — не
   множественное «war». */
test('волна «хвосты героя», п.E: matchTheme — слово правила и во множественном числе', () => {
  const R = [
    { id: 'zombie', preset: 'glitch', keywords: ['zombie'] },
    { id: 'war', preset: 'embers', keywords: ['war', 'explosion'] },
    { id: 'halloween', preset: 'bats', keywords: ['witch'] },
    { id: 'ocean', preset: 'bubbles', keywords: ['sea'] },
    { id: 'space', preset: 'stars', keywords: ['alien', 'outer space'] }
  ];
  const id = (...names) => { const t = T.matchTheme(R, { keywords: kw(...names), genres: [] }); return t ? t.id : null; };
  assert.equal(id('zombies'), 'zombie');
  assert.equal(id('explosions'), 'war');
  assert.equal(id('witches'), 'halloween', '-es после ch');
  assert.equal(id('seven seas'), 'ocean');
  assert.equal(id('aliens'), 'space');
  assert.equal(id('outer spaces'), 'space', 'и у фразы');
  assert.equal(id('culture wars'), 'war');
  for (const miss of ['award', 'awards', 'wares', 'warsaw', 'witchs', 'seasons', 'zombieses', 'explosionsx']) {
    assert.equal(id(miss), null, miss);
  }
});

test('matchTheme: requireGenre — слово без жанра не считается', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genres: [{ id: 35 }] }), null);
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genres: [{ id: 27 }] }).id, 'halloween');
});

test('matchTheme: жанр числом (герой главной отдаёт genre_ids)', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genres: [27] }).id, 'halloween');
  assert.equal(T.matchTheme(rules, { keywords: kw('halloween'), genre_ids: [27] }).id, 'halloween');
});

test('matchTheme: первое правило по порядку побеждает; нет совпадений → null', () => {
  assert.equal(T.matchTheme(rules, { keywords: kw('space', 'christmas'), genres: [] }).id, 'christmas');
  assert.equal(T.matchTheme(rules, { keywords: kw('western'), genres: [] }), null);
  assert.equal(T.matchTheme(rules, { keywords: { keywords: [{ name: 'alien' }] }, genres: [] }).id, 'space'); // формат tv
});

test('matchTheme: пустые и битые входные данные — null, без исключения', () => {
  assert.equal(T.matchTheme(rules, null), null);
  assert.equal(T.matchTheme(null, { keywords: kw('christmas') }), null);
  assert.equal(T.matchTheme(rules, {}), null);
  assert.equal(T.matchTheme(rules, { keywords: [{ name: 'christmas' }] }).id, 'christmas'); // голый массив
  assert.equal(T.matchTheme([{ id: 'x', preset: 'snow' }], { keywords: kw('christmas') }), null); // правило без keywords
});

test('allowed: режим настройки решает, показывать ли тему', () => {
  const xmas = rules[1];
  const space = rules[2];
  assert.equal(T.allowed(xmas, 'off', 12), false);
  assert.equal(T.allowed(xmas, 'all', 5), true);
  assert.equal(T.allowed(space, 'all', 5), true);
  /* seasonal: только темы со своим месяцем и только в этот месяц */
  assert.equal(T.allowed(xmas, 'seasonal', 12), true);
  assert.equal(T.allowed(xmas, 'seasonal', 1), true);
  assert.equal(T.allowed(xmas, 'seasonal', 5), false);
  assert.equal(T.allowed(space, 'seasonal', 5), false, 'тема без months в seasonal не показывается никогда');
  assert.equal(T.allowed(null, 'all', 12), false);
});

test('seasonalIds: месяц → id подборок с season, включая год через границу', () => {
  const cols = [{ id: 'xmas', season: [12, 1] }, { id: 'hw', season: [10] }, { id: 'plain' }];
  assert.deepEqual(T.seasonalIds(cols, 1), ['xmas']);
  assert.deepEqual(T.seasonalIds(cols, 10), ['hw']);
  assert.deepEqual(T.seasonalIds(cols, 5), []);
  assert.deepEqual(T.seasonalIds(null, 5), []);
  assert.deepEqual(T.seasonalIds(cols, 0), []);
});

/* ====================================================================== */
/* Раунд holB: адвент под СНГ — 31 окошко (1–31 декабря).                 */
/*                                                                        */
/* Пользователь: «Адвент — прикольная тема, но это надо адаптировать под  */
/* СНГ: у нас 31 день, где 31 числа обычно смотрят „Иронию судьбы“».       */
/* Все 31 окошко видны; прошедшие и сегодняшний открыты (фильм дня),       */
/* будущие закрыты (дата и замок), 31-е — «Ирония судьбы». Открытые        */
/* окошки запоминаются (lumen_advent_open) — фильм прошедшего дня не       */
/* меняется, даже если TMDB переставил подборку.                          */
/* ====================================================================== */

const words = { today: 'Сегодня', day: 'День', date: '{d} декабря', final: 'Новогодняя ночь' };
const pool = (from, n) => Array.from({ length: n }, (_, i) => ({ id: from + i, title: 't' + (from + i), poster_path: '/p' + (from + i) + '.jpg' }));
const IRONY = { id: 43430, title: 'Ирония судьбы, или С лёгким паром!', poster_path: '/irony.jpg' };
const dec = (d) => new Date(2026, 11, d, 12, 0, 0);
const states = (cards) => cards.map((c) => c.lumen_advent.state);

test('holB адвент: 31 окошко — прошедшие открыты, сегодняшнее «сегодня», будущие закрыты', () => {
  const cards = T.adventDays({ world: pool(100, 40), ours: pool(500, 10) }, dec(15), words);
  assert.equal(cards.length, 31);
  assert.deepEqual(cards.map((c) => c.day), Array.from({ length: 31 }, (_, i) => i + 1));
  const st = states(cards);
  assert.ok(st.slice(0, 14).every((s) => s === 'open'), 'дни 1–14 открыты');
  assert.equal(st[14], 'today');
  assert.ok(st.slice(15).every((s) => s === 'locked'), 'дни 16–31 закрыты');
  const open = cards.slice(0, 15);
  assert.equal(new Set(open.map((c) => c.id)).size, 15, 'фильмы без повторов');
  assert.equal(cards[0].lumen_badge, 'День 1');
  assert.equal(cards[14].lumen_badge, 'Сегодня', 'одно слово — «Сегодня · день 15» рвалось на постере надвое');
  const locked = cards[20];
  assert.equal(locked.id, undefined, 'у закрытого окошка нет фильма');
  assert.equal(locked.poster_path, undefined);
  assert.equal(locked.title, '21 декабря');
  assert.equal(locked.lumen_badge, undefined);
  assert.equal(cards[30].lumen_advent.final, true, '31-е — особая плитка и закрытым');
  assert.ok(!cards[29].lumen_advent.final);
});

test('holB адвент: каждое третье окошко — наше новогоднее кино, остальные — мировое', () => {
  const ours = pool(500, 10);
  const cards = T.adventDays({ world: pool(100, 40), ours: ours }, dec(30), words);
  const oursIds = new Set(ours.map((c) => c.id));
  for (let day = 1; day <= 30; day++) {
    assert.equal(oursIds.has(cards[day - 1].id), day % 3 === 0, 'день ' + day);
  }
});

test('holB адвент: раскладка детерминирована, исходные карточки не мутируются, не декабрь — пусто', () => {
  const world = pool(100, 40);
  const a = T.adventDays({ world: world, ours: pool(500, 10) }, dec(12), words);
  const b = T.adventDays({ world: world, ours: pool(500, 10) }, dec(12), words);
  assert.deepEqual(a.map((c) => c.id), b.map((c) => c.id));
  assert.equal(world[0].lumen_badge, undefined);
  assert.equal(world[0].lumen_advent, undefined);
  assert.deepEqual(T.adventDays({ world: world }, new Date(2026, 10, 30), words), []);
  assert.deepEqual(T.adventDays({ world: world }, new Date(2027, 0, 1), words), []);
  /* Голый массив — прежняя форма пула: всё «мировое». */
  assert.equal(T.adventDays(world, dec(2), words)[1].lumen_advent.state, 'today');
});

test('holB адвент: пул короче числа дней — прошедшие окошки без фильма «пустые», повторов нет', () => {
  const cards = T.adventDays({ world: pool(1, 3) }, dec(10), words);
  assert.equal(cards.length, 31);
  assert.deepEqual(states(cards).slice(0, 10).filter((s) => s !== 'empty').length, 3);
  assert.equal(new Set(cards.filter((c) => c.id).map((c) => c.id)).size, 3);
  assert.ok(states(T.adventDays({}, dec(10), words)).slice(0, 10).every((s) => s === 'empty'));
  assert.ok(states(T.adventDays(null, dec(10), words)).slice(0, 10).every((s) => s === 'empty'));
});

test('holB адвент: «Ирония судьбы» — только в окошке 31-го, и 31-го оно открыто', () => {
  const ours = pool(500, 10).concat([IRONY]);
  for (let d = 1; d <= 30; d++) {
    const cards = T.adventDays({ world: pool(100, 40), ours: ours }, dec(d), words);
    assert.ok(cards.every((c) => c.id !== 43430), 'день ' + d + ': Ирония ещё закрыта');
  }
  const eve = T.adventDays({ world: pool(100, 40), ours: ours }, dec(31), words);
  const last = eve[30];
  assert.equal(last.id, 43430);
  assert.equal(last.lumen_advent.state, 'today');
  assert.equal(last.lumen_advent.final, true);
  assert.equal(last.lumen_badge, 'Сегодня');
  assert.equal(T.ADVENT_FINAL_ID, 43430);
  /* Отдельно запрошенная карточка (в пулах её нет) — тоже 31-го. */
  const alone = T.adventDays({ world: pool(100, 40), final: IRONY }, dec(31), words);
  assert.equal(alone[30].id, 43430);
  /* Иронии нет нигде — 31-е получает фильм из пула, не пустое окошко. */
  const none = T.adventDays({ world: pool(100, 40) }, dec(31), words);
  assert.ok(none[30].id > 0 && none[30].lumen_advent.final);
});

test('holB адвент: запомненные окошки — фильм прошедшего дня тот же, даже если подборку переставили', () => {
  const world = pool(100, 40);
  const ours = pool(500, 10);
  const day3 = T.adventDays({ world: world, ours: ours }, dec(3), words);
  const record = T.adventRecord(day3, dec(3));
  assert.equal(record.y, 2026);
  assert.deepEqual(Object.keys(record.d).sort(), ['1', '2', '3']);
  const shuffled = { world: world.slice().reverse().slice(5), ours: ours.slice().reverse() };
  const day4 = T.adventDays(shuffled, dec(4), words, record);
  for (let d = 1; d <= 3; d++) {
    const before = day3[d - 1].id;
    if (shuffled.world.concat(shuffled.ours).some((c) => c.id === before)) assert.equal(day4[d - 1].id, before, 'день ' + d);
  }
  assert.equal(day4[3].lumen_advent.fresh, true, 'новое окошко сегодня — открывается впервые');
  assert.ok(!day4[2].lumen_advent.fresh, 'вчерашнее уже открывали');
  const again = T.adventDays(shuffled, dec(4), words, T.adventRecord(day4, dec(4)));
  assert.ok(!again[3].lumen_advent.fresh, 'второй показ того же дня — без открытия');
});

test('holB адвент: запись прошлого года не действует; запись — только открытые окошки с фильмом', () => {
  const world = pool(100, 40);
  const cards = T.adventDays({ world: world }, dec(2), words, { y: 2025, d: { 1: 111, 2: 112 } });
  assert.equal(cards[1].lumen_advent.fresh, true);
  const rec = T.adventRecord(cards, dec(2));
  assert.deepEqual(Object.keys(rec.d), ['1', '2']);
  assert.ok(Object.keys(rec.d).every((k) => rec.d[k] > 0));
  assert.deepEqual(T.adventRecord([], dec(2)), { y: 2026, d: {} });
});

test('monthOf: месяц 1..12 из даты, хук _now подменяем для живой проверки', () => {
  assert.equal(T.monthOf(new Date(2026, 11, 5)), 12);
  assert.equal(T.monthOf(new Date(2026, 0, 31)), 1);
  const saved = T._now;
  T._now = function () { return new Date(2026, 9, 3); };
  assert.equal(T.month(), 10);
  T._now = saved;
});

/* Найдено живой проверкой (2026-09-17): каталог с хостинга, собранный до
   этой задачи, поля themes не содержит, а кэш держится 12 часов. */
test('волна «праздники крупнее»: particleColor — зимняя сцена белая (снег), Хэллоуин и Валентин — акцент темы', () => {
  assert.equal(T.particleColor({ id: 'christmas', preset: 'winter', accent: '#E8C170' }), '#FFFFFF');
  assert.equal(T.particleColor({ id: 'halloween', preset: 'halloween', accent: '#E07B2C' }), '#E07B2C');
  assert.equal(T.particleColor({ id: 'valentine', preset: 'hearts', accent: '#E8607D' }), '#E8607D');
});

test('current: каталог без тем — встроенные правила; свои темы каталога побеждают', () => {
  const DEFAULT_THEMES = [{ id: 'built', preset: 'snow', keywords: ['x'] }];
  const own = [{ id: 'own', preset: 'stars', keywords: ['y'] }];
  const make = (manifestThemes) => loadCtx('53_themes.js', {
    manifest: { get: () => ({ version: 1, themes: manifestThemes }), DEFAULT: { themes: DEFAULT_THEMES } }
  }).api;
  assert.equal(make(undefined).current()[0].id, 'built');
  assert.equal(make([]).current()[0].id, 'built');
  assert.equal(make(own).current()[0].id, 'own');
});


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

const words = { today: 'Сегодня', day: 'День' };

test('adventDays: декабрь → дни 1..min(today,24), детерминированный фильм на день', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, title: 't' + i }));
  const d = T.adventDays(pool, new Date(2026, 11, 5), words);
  assert.equal(d.length, 5);
  assert.equal(d[4].day, 5);
  assert.ok(d[4].lumen_badge.indexOf('Сегодня') === 0);
  assert.deepEqual(T.adventDays(pool, new Date(2026, 11, 5), words).map(x => x.id), d.map(x => x.id)); // детерминизм
  assert.equal(new Set(d.map(x => x.id)).size, 5); // без повторов
  assert.deepEqual(T.adventDays(pool, new Date(2026, 10, 30), words), []); // ноябрь — пусто
  assert.equal(T.adventDays(pool, new Date(2026, 11, 28), words).length, 24);
});

test('adventDays: метка прошедшего дня — «День N», сегодняшнего — «Сегодня · день N»', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i, title: 't' + i }));
  const d = T.adventDays(pool, new Date(2026, 11, 3), words);
  assert.equal(d[0].lumen_badge, 'День 1');
  assert.equal(d[2].lumen_badge, 'Сегодня · день 3');
});

test('adventDays: исходные карточки не мутируются, порядок — от сегодняшнего дня вниз не идёт', () => {
  const pool = [{ id: 1, title: 'a' }, { id: 2, title: 'b' }, { id: 3, title: 'c' }];
  const d = T.adventDays(pool, new Date(2026, 11, 2), words);
  assert.equal(pool[0].lumen_badge, undefined);
  assert.deepEqual(d.map(x => x.day), [1, 2]);
});

test('adventDays: пул короче числа дней — дни без фильма отбрасываются, повторов нет', () => {
  const pool = [{ id: 1 }, { id: 2 }, { id: 3 }];
  const d = T.adventDays(pool, new Date(2026, 11, 10), words);
  assert.equal(d.length, 3);
  assert.equal(new Set(d.map(x => x.id)).size, 3);
  assert.deepEqual(T.adventDays([], new Date(2026, 11, 10), words), []);
  assert.deepEqual(T.adventDays(null, new Date(2026, 11, 10), words), []);
});

test('adventDays: день 24 помечен особой плиткой (дизайн: акцентная рамка)', () => {
  const pool = Array.from({ length: 30 }, (_, i) => ({ id: 100 + i }));
  const d = T.adventDays(pool, new Date(2026, 11, 24), words);
  assert.equal(d.length, 24);
  assert.equal(d[23].day, 24);
  assert.equal(d[23].lumen_final, true);
  assert.equal(d[0].lumen_final, undefined);
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

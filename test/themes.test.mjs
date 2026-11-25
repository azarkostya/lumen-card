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
const dec = (d) => new Date(2026, 11, d, 12);
const schedule = [
  508965, 5255, 1551025, 527435, 615665, 360920, 562, 833097, 1570488, 17979,
  1234811, 845781, 333348, 10719, 12193, 549053, 9279, 1581, 10147, 77762,
  508, 5825, 828613, 771, 772, 384682, 41977, 57809, 85317, 63258, 43430
];

test('адвент: фиксированные 31 уникальный фильм и полный посев постеров', () => {
  const cards = T.adventDays(null, dec(31), words);
  assert.deepEqual(T.ADVENT_LIST, schedule);
  assert.deepEqual(cards.map((c) => c.id), schedule);
  assert.deepEqual(T.adventDays(null, new Date(2027, 11, 31), words).map((c) => c.id), schedule);
  assert.equal(new Set(cards.map((c) => c.id)).size, 31);
  assert.equal(T.ADVENT_FINAL_ID, 43430);
  assert.ok(cards.every((c) => c.title.trim() && c.poster_path.startsWith('/')));
  assert.deepEqual(Object.keys(T.ADVENT_SEED).map(Number).sort((a, b) => a - b), [...schedule].sort((a, b) => a - b));
  assert.equal(cards[30].lumen_advent.state, 'today');
  assert.equal(cards[30].lumen_advent.final, true);
  assert.equal(cards[30].lumen_advent.label, 'Сегодня');
});

test('адвент: сегодня и прошлые дни открыты, будущие без id и постера', () => {
  const cards = T.adventDays({}, dec(15), words);
  assert.equal(cards.length, 31);
  assert.ok(cards.slice(0, 14).every((c, i) => c.lumen_advent.state === 'open' && c.day === i + 1));
  assert.equal(cards[0].lumen_advent.label, 'День 1');
  assert.equal(cards[14].lumen_advent.state, 'today');
  assert.equal(cards[14].lumen_advent.fresh, true);
  assert.ok(cards.slice(15).every((c) => c.lumen_advent.state === 'locked' && c.id == null && c.poster_path == null));
  assert.equal(cards[20].title, '21 декабря');
  assert.equal(cards[30].lumen_advent.final, true);
  assert.equal(cards[29].lumen_advent.final, undefined);
  assert.deepEqual(T.adventDays({}, new Date(2026, 10, 30), words), []);
  assert.deepEqual(T.adventDays({}, new Date(2027, 0, 1), words), []);
});

test('адвент: запись v2 удерживает открытый фильм при перестановке списка', () => {
  const stored = { y: 2026, v: 2, d: { 1: schedule[1], 2: schedule[0] } };
  const cards = T.adventDays({}, dec(3), words, stored);
  assert.deepEqual(cards.slice(0, 3).map((c) => c.id), [schedule[1], schedule[0], schedule[2]]);
  const saved = T.adventRecord(cards, dec(3), stored);
  assert.deepEqual(saved, { y: 2026, v: 2, d: { 1: schedule[1], 2: schedule[0], 3: schedule[2] } });
  assert.equal(T.adventDays({}, dec(3), words, saved)[2].lumen_advent.fresh, undefined);
});

test('адвент: старые записи и id вне списка отбрасываются', () => {
  for (const record of [
    { y: 2026, d: { 1: schedule[1] } },
    { y: 2026, v: 1, d: { 1: schedule[1] } },
    { y: 2025, v: 2, d: { 1: schedule[1] } },
    { y: 2026, v: 2, d: { 1: 123, 2: 'x/../1' } }
  ]) {
    const cards = T.adventDays({}, dec(1), words, record);
    assert.equal(cards[0].id, schedule[0]);
    assert.equal(cards[0].lumen_advent.fresh, true);
    assert.deepEqual(T.adventRecord(cards, dec(1), record), { y: 2026, v: 2, d: { 1: schedule[0] } });
  }
});

test('адвент: окошко 31 декабря не закрепляется за другим фильмом', () => {
  const record = { y: 2026, v: 2, d: { 30: 43430, 31: schedule[0] } };
  const cards = T.adventDays({}, dec(31), words, record);
  assert.equal(cards[29].id, schedule[29]);
  assert.equal(cards[30].id, 43430);
  assert.equal(cards[30].lumen_advent.fresh, true);
  assert.equal(T.adventRecord(cards, dec(31), record).d[31], 43430);
});

test('адвент: карточка по id предпочтительна, пустое название заменяется оригинальным', () => {
  const translated = { id: schedule[0], title: '  ', original_title: 'Klaus', poster_path: '/translated.jpg' };
  const [card] = T.adventDays({ cards: { [schedule[0]]: translated } }, dec(1), words);
  assert.equal(card.title, 'Klaus');
  assert.equal(card.poster_path, '/translated.jpg');
  assert.equal(translated.title, '  ');
  assert.equal(translated.lumen_advent, undefined);
});

test('адвент: при переводе часов назад запись будущего открытого дня сохраняется', () => {
  const stored = { y: 2026, v: 2, d: { 4: schedule[3], 40: schedule[0] } };
  const cards = T.adventDays({}, dec(1), words, stored);
  assert.deepEqual(T.adventRecord(cards, dec(1), stored), { y: 2026, v: 2, d: { 1: schedule[0], 4: schedule[3] } });
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

/* ====================================================================== */
/* Раунд holB: праздничные сцены — Новый год и Хэллоуин                     */
/*                                                                        */
/* Пользователь: праздничные частицы видны и в «Лёгких»; после скрина       */
/* «Одиссеи» с лучами и пузырями — «оставим только Рождество и Хэллоуин,   */
/* а оформление потом будем руками докидывать». Автотемы по ключевым        */
/* словам (космос, море, война, нуар…) — за флагом LC.fxAutoThemes,        */
/* по умолчанию выключены.                                                 */
/* ====================================================================== */

const at = (m, d, y) => new Date(y || 2026, m - 1, d, 12, 0, 0);
const hid = (m, d) => { const h = T.holidayAt(at(m, d)); return h ? h.id : null; };

test('holB: праздников по дате два — Новый год 1.12–7.01 через границу года и Хэллоуин 25.10–1.11', () => {
  const cases = [
    [11, 30, null], [12, 1, 'newyear'], [12, 15, 'newyear'], [12, 31, 'newyear'], [1, 1, 'newyear'], [1, 7, 'newyear'], [1, 8, null], [1, 10, null],
    [10, 24, null], [10, 25, 'halloween'], [10, 31, 'halloween'], [11, 1, 'halloween'], [11, 2, null],
    [2, 14, null], [2, 23, null], [3, 8, null], [4, 12, null], [5, 9, null], [6, 1, null], [9, 1, null], [9, 26, null]
  ];
  for (const [m, d, want] of cases) assert.equal(hid(m, d), want, m + '/' + d);
  assert.equal(T.holidayAt(null), null);
  assert.equal(T.holidayAt({}), null);
  assert.deepEqual(T.HOLIDAYS.map((h) => h.id + ':' + h.preset), ['newyear:winter', 'halloween:halloween']);
});

test('holB: пресеты праздников — праздничные сцены движка (видны и в «Лёгких», переживают смену фильма)', () => {
  const FX = loadCtx('52_fx.js', { motionMode: () => 'full', enabled: () => true }).api;
  for (const h of T.HOLIDAYS) {
    assert.ok(FX.presets[h.preset], h.id);
    assert.equal(FX.presets[h.preset].festive, true, h.id);
    assert.equal(FX.presets[h.preset].keep, true, h.id);
    assert.ok(/^#[0-9A-F]{6}$/i.test(h.accent), h.id + '.accent');
  }
});

/* Окружение forMovie: правила тем каталога по умолчанию (их часть),
   настройка «Атмосферы», дата, флаг автотем и герой главной. home — герой
   смонтирован и не запаркован (главная на экране); карточка фильма
   паркует героя (src/48_hero.js, park). */
function ambientEnv(o) {
  const RULES = [
    { id: 'halloween', preset: 'halloween', accent: '#E07B2C', keywords: ['halloween'], genres: [27], months: [10], requireGenre: true },
    { id: 'christmas', preset: 'winter', accent: '#E8C170', keywords: ['christmas', 'new year'], months: [12, 1] },
    { id: 'valentine', preset: 'hearts', accent: '#E8607D', keywords: ['valentine'], months: [2] },
    { id: 'space', preset: 'stars', accent: '#8FB8D9', keywords: ['space'] },
    { id: 'ocean', preset: 'bubbles', accent: '#7FB7C9', keywords: ['ocean', 'sea'] }
  ];
  let hero;
  if (o.hero === 'none') hero = undefined;
  else if (o.home === false) hero = { active: () => true, parked: () => true };
  else hero = { active: () => true, parked: () => false };
  const ctx = loadCtx('53_themes.js', {
    pref: (name, def) => (name === 'lumen_fx' ? (o.mode || 'seasonal') : def),
    manifest: { get: () => ({ version: 1, themes: RULES }), DEFAULT: { themes: RULES } },
    hero: hero
  });
  if (o.auto) ctx.LC.fxAutoThemes = true;
  ctx.api._now = () => o.now;
  return ctx.api;
}
const film = (...names) => ({ keywords: { results: names.map((n, i) => ({ id: i, name: n })) }, genres: [{ id: 27 }] });
const odyssey = film('sea', 'ocean', 'greek mythology', 'odysseus');
const id = (t) => (t ? t.id : null);

test('holB: флаг автотем — по умолчанию выключен: у обычного фильма («Одиссея» — море) частиц нет ни на главной, ни в карточке', () => {
  const T1 = ambientEnv({ now: at(9, 26), mode: 'all' });
  assert.equal(loadCtx('53_themes.js', {}).LC.fxAutoThemes, false, 'одна константа, по умолчанию false');
  assert.equal(T1.forMovie(odyssey), null, 'главная');
  assert.equal(ambientEnv({ now: at(9, 26), mode: 'all', home: false }).forMovie(odyssey), null, 'карточка');
  assert.equal(ambientEnv({ now: at(9, 26), mode: 'all' }).forMovie(film('space')), null, 'космос — тоже нет');
  assert.equal(ambientEnv({ now: at(2, 14), mode: 'all' }).forMovie(film('valentine')), null, 'Валентин — нет');
  /* Флаг включён — прежнее поведение целиком. */
  assert.equal(id(ambientEnv({ now: at(9, 26), mode: 'all', auto: true }).forMovie(odyssey)), 'ocean');
  assert.equal(id(ambientEnv({ now: at(2, 14), mode: 'seasonal', auto: true }).forMovie(film('valentine'))), 'valentine');
});

test('holB: новогодние и хэллоуинские фильмы — своя сцена и при выключенных автотемах, в свой сезон', () => {
  assert.equal(id(ambientEnv({ now: at(12, 5), home: false }).forMovie(film('christmas'))), 'christmas', 'карточка рождественского фильма в декабре');
  assert.equal(id(ambientEnv({ now: at(1, 5), home: false }).forMovie(film('new year'))), 'christmas', 'и в январе — до 7-го');
  assert.equal(ambientEnv({ now: at(7, 1), home: false }).forMovie(film('christmas')), null, '«Только сезонные»: летом нет');
  assert.equal(id(ambientEnv({ now: at(7, 1), home: false, mode: 'all' }).forMovie(film('christmas'))), 'christmas', '«Все»: и летом');
  assert.equal(id(ambientEnv({ now: at(10, 27), home: false }).forMovie(film('halloween'))), 'halloween', 'хоррор про Хэллоуин в неделю праздника');
  /* Окно Нового года — с 1 декабря (решение 2026-09-26): до окна в декабре дней нет;
     5 декабря на главной у рождественского фильма уже сцена праздника. */
  assert.equal(id(ambientEnv({ now: at(12, 5) }).forMovie(film('christmas'))), 'newyear', 'главная в окне праздника — сцена праздника');
});

/* Финальная проверка, B8 (logic-rows S1): при «Только сезонные» сцена
   фильма по ключевым словам — в окно праздника (решение пользователя
   2026-09-26: Новый год 1.12–7.01, Хэллоуин 25.10–1.11), а не весь январь
   и весь октябрь по months каталога. «Все» — круглый год, как прежде. */
test('B8: «Только сезонные» — сцена новогоднего и хэллоуинского фильма только в окно праздника, «Все» — круглый год', () => {
  const card = (m, d, mode) => id(ambientEnv({ now: at(m, d), home: false, mode: mode }).forMovie(film('christmas')));
  const horror = (m, d, mode) => id(ambientEnv({ now: at(m, d), home: false, mode: mode }).forMovie(film('halloween')));
  assert.equal(card(11, 30), null, '30 ноября — ещё нет');
  assert.equal(card(12, 1), 'christmas');
  assert.equal(card(1, 7), 'christmas', '7 января — последний день');
  assert.equal(card(1, 8), null, '8 января — уже нет (прежде — весь январь)');
  assert.equal(card(1, 25), null);
  assert.equal(horror(10, 3), null, '3 октября — нет (прежде — весь октябрь)');
  assert.equal(horror(10, 24), null);
  assert.equal(horror(10, 25), 'halloween');
  assert.equal(horror(11, 1), 'halloween', '1 ноября — последний день (прежде его не было)');
  assert.equal(horror(11, 2), null);
  /* Новогодний фильм в окно Хэллоуина — не его праздник. */
  assert.equal(card(10, 31), null);
  /* «Все» — не трогаем: круглый год. */
  assert.equal(card(1, 25, 'all'), 'christmas');
  assert.equal(card(7, 15, 'all'), 'christmas');
  assert.equal(horror(10, 3, 'all'), 'halloween');
  /* Главная вне окна: у новогоднего фильма при «Только сезонные» — тоже нет. */
  assert.equal(ambientEnv({ now: at(1, 20) }).forMovie(film('christmas')), null);
  /* Прочие темы при включённых автотемах — по months, как прежде. */
  assert.equal(id(ambientEnv({ now: at(2, 20), mode: 'seasonal', auto: true, home: false }).forMovie(film('valentine'))), 'valentine');
});

test('holB: на главной в окно праздника — сцена праздника у любого фильма; в карточке — нет', () => {
  const ny = ambientEnv({ now: at(12, 25) }).forMovie(odyssey);
  assert.equal(ny.id, 'newyear');
  assert.equal(ny.preset, 'winter');
  assert.equal(ny.holiday, true);
  assert.equal(ambientEnv({ now: at(1, 7) }).forMovie(film()).id, 'newyear');
  assert.equal(ambientEnv({ now: at(10, 31) }).forMovie(film('christmas')).preset, 'halloween', 'праздник дня первым');
  assert.equal(ambientEnv({ now: at(11, 1) }).forMovie(null).id, 'halloween', 'деталей нет — праздник всё равно');
  assert.equal(ambientEnv({ now: at(12, 25), home: false }).forMovie(odyssey), null, 'карточка обычного фильма — без праздника');
  assert.equal(ambientEnv({ now: at(12, 25), hero: 'none' }).forMovie(odyssey), null, 'героя нет вовсе');
  assert.equal(ambientEnv({ now: at(12, 31), mode: 'off' }).forMovie(film('christmas')), null, '«Выключены» — ничего');
});

test('holB: holiday() — по хуку даты; classNames — и праздники, и все правила каталога, без повторов', () => {
  const T1 = ambientEnv({ now: at(12, 20) });
  assert.equal(T1.holiday().id, 'newyear');
  T1._now = () => at(1, 11);
  assert.equal(T1.holiday(), null);
  const cls = T1.classNames().split(' ');
  for (const c of ['newyear', 'halloween', 'christmas', 'space', 'ocean']) assert.ok(cls.indexOf('lumen-theme--' + c) !== -1, c);
  assert.equal(cls.filter((c) => c === 'lumen-theme--halloween').length, 1);
});

test('holB: particleColor — снег Нового года белый, Хэллоуин — акцент праздника', () => {
  const ny = ambientEnv({ now: at(12, 20) });
  assert.equal(ny.particleColor(ny.forMovie(film())), '#FFFFFF');
  const hw = ambientEnv({ now: at(10, 31) });
  assert.equal(hw.particleColor(hw.forMovie(film())), '#E07B2C');
});

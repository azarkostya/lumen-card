import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
import { readFileSync } from 'node:fs';
const M = load('42_manifest.js');

test('DEFAULT валиден: >=40 подборок, уникальные id, у каждой sources и group из groups', () => {
  const d = M.DEFAULT;
  const ids = new Set();
  const groups = new Set(d.groups.map(function(g) { return g.id; }));
  assert.ok(d.collections.length >= 40, 'нужно >= 40 подборок, есть ' + d.collections.length);
  for (const c of d.collections) {
    assert.ok(!ids.has(c.id), 'дублированный id: ' + c.id);
    ids.add(c.id);
    assert.ok(c.sources.movie || c.sources.tv, 'нет sources у ' + c.id);
    assert.ok(groups.has(c.group), 'неизвестная группа ' + c.group + ' у ' + c.id);
    assert.match(c.id, /^[a-z0-9-]+$/, 'id не латиница: ' + c.id);
    assert.ok(typeof c.title === 'string' && c.title.length > 0, 'нет title у ' + c.id);
  }
  for (const h of d.home) {
    assert.ok(ids.has(h) || ['continue', 'because', 'new-episodes', 'soon'].indexOf(h) >= 0, 'home: неизвестный id ' + h);
  }
});

test('DEFAULT: groups имеет ровно 10 id, hubGroups имеет 7 групп', () => {
  const d = M.DEFAULT;
  assert.equal(d.groups.length, 10);
  const gids = new Set(d.groups.map(function(g) { return g.id; }));
  const expected = ['franchise', 'studio', 'service', 'theme', 'country', 'era', 'people', 'top', 'kp', 'mood'];
  for (const id of expected) {
    assert.ok(gids.has(id), 'нет группы ' + id);
  }
  assert.ok(Array.isArray(d.hubGroups), 'hubGroups должен быть массивом');
  assert.equal(d.hubGroups.length, 7);
  for (const hg of d.hubGroups) {
    assert.ok(hg.id, 'hubGroups запись без id');
    assert.ok(Array.isArray(hg.groups), 'hubGroups запись без groups');
    assert.ok(hg.title, 'hubGroups запись без title');
  }
});

test('DEFAULT: moods имеет ровно 4 чипа', () => {
  const d = M.DEFAULT;
  assert.ok(Array.isArray(d.moods), 'moods должен быть массивом');
  assert.equal(d.moods.length, 4);
  const moodIds = ['friday', 'family', 'scary', 'short'];
  for (var i = 0; i < moodIds.length; i++) {
    assert.ok(d.moods.some(function(m) { return m.id === moodIds[i]; }), 'нет mood ' + moodIds[i]);
  }
});

test('DEFAULT: сезонные подборки имеют season-массив с числами', () => {
  const d = M.DEFAULT;
  for (const c of d.collections) {
    if (c.season) {
      assert.ok(Array.isArray(c.season), 'season должен быть массивом у ' + c.id);
      for (const m of c.season) {
        assert.ok(typeof m === 'number' && m >= 1 && m <= 12, 'месяц вне 1-12 у ' + c.id);
      }
    }
  }
});

test('DEFAULT: КП-подборки имеют тип kp и collection', () => {
  const d = M.DEFAULT;
  const kpItems = d.collections.filter(function(c) { return c.group === 'kp'; });
  assert.ok(kpItems.length >= 6, 'мало kp-подборок');
  for (const c of kpItems) {
    assert.ok(c.sources.movie && c.sources.movie.type === 'kp', 'kp-подборка без type:kp у ' + c.id);
    assert.ok(c.sources.movie.collection, 'kp-подборка без collection у ' + c.id);
  }
});

test('orderForMonth: сезонные наверх в свой месяц, остальные в исходном порядке', () => {
  const list = [{ id: 'a' }, { id: 'x', season: [12, 1] }, { id: 'b' }, { id: 'h', season: [10] }];
  assert.deepEqual(M.orderForMonth(list, 12).map(function(c) { return c.id; }), ['x', 'a', 'b', 'h']);
  assert.deepEqual(M.orderForMonth(list, 10).map(function(c) { return c.id; }), ['h', 'a', 'x', 'b']);
  assert.deepEqual(M.orderForMonth(list, 6).map(function(c) { return c.id; }), ['a', 'x', 'b', 'h']);
});
test('orderForMonth: несколько сезонных в одном месяце — в исходном порядке между собой', () => {
  const list = [{ id: 'b', season: [12] }, { id: 'a', season: [12] }, { id: 'c' }];
  const res = M.orderForMonth(list, 12).map(function(c) { return c.id; });
  assert.deepEqual(res, ['b', 'a', 'c']);
});
test('orderForMonth: месяц null/0 — не поднимает ни одного', () => {
  const list = [{ id: 'a' }, { id: 'x', season: [12] }];
  const res = M.orderForMonth(list, 6).map(function(c) { return c.id; });
  assert.equal(res[0], 'a');
  assert.equal(res[1], 'x');
});

test('validate: чужой манифест без collections или с дублями отвергается', () => {
  assert.equal(M.validate({
    version: 1,
    collections: [{ id: 'a', sources: { movie: { type: 'discover', params: {} } }, group: 'theme', title: 't' }],
    groups: [{ id: 'theme', title: 'T' }],
    home: []
  }).ok, true);
  assert.equal(M.validate({ version: 1 }).ok, false);
  // дубль id — groups непустой, но коллекция без title: отклоняется
  assert.equal(M.validate({ version: 1, collections: [{ id: 'a', title: 't', sources: { movie: { type: 'discover', params: {} } } }, { id: 'a', title: 't', sources: { movie: { type: 'discover', params: {} } } }], groups: [{ id: 'g', title: 'G' }], home: [] }).ok, false);
});
test('validate: нет groups или groups пустой — отклоняется (C4)', () => {
  assert.equal(M.validate({ version: 1, collections: [], home: [] }).ok, false);
  assert.equal(M.validate({ version: 1, collections: [], groups: [], home: [] }).ok, false);
});
test('validate: нет home — отклоняется (C4)', () => {
  assert.equal(M.validate({ version: 1, collections: [], groups: [{ id: 'g', title: 'G' }] }).ok, false);
});
test('validate: коллекция без title — отклоняется (C4)', () => {
  assert.equal(M.validate({
    version: 1,
    collections: [{ id: 'a', sources: { movie: { type: 'discover', params: {} } } }],
    groups: [{ id: 'g', title: 'G' }],
    home: []
  }).ok, false);
});
test('validate: нет version — отклоняется', () => {
  assert.equal(M.validate({ collections: [], groups: [], home: [] }).ok, false);
});
test('validate: подборка без sources — отклоняется', () => {
  assert.equal(M.validate({
    version: 1,
    collections: [{ id: 'a', title: 't', group: 'theme' }],
    groups: [{ id: 'theme', title: 'T' }],
    home: []
  }).ok, false);
});
test('validate: некорректный JSON (не объект) — отклоняется', () => {
  assert.equal(M.validate(null).ok, false);
  assert.equal(M.validate([]).ok, false);
  assert.equal(M.validate('string').ok, false);
});

test('isFresh 12 часов', () => {
  assert.equal(M.isFresh({ at: Date.now() - 1000 }), true);
  assert.equal(M.isFresh({ at: Date.now() - 13 * 3600e3 }), false);
});
test('isFresh: точно 12 часов — уже протух', () => {
  assert.equal(M.isFresh({ at: Date.now() - 12 * 3600e3 - 1 }), false);
});
test('isFresh: нет at — протух', () => {
  assert.equal(M.isFresh({}), false);
  assert.equal(M.isFresh(null), false);
});

test('get: возвращает DEFAULT до вызова load', () => {
  const d = M.get();
  assert.ok(d && d.collections, 'get() должен вернуть DEFAULT');
  assert.ok(d.collections.length >= 40);
});

/* Task 20: каталог опубликован на GitHub Pages (ветка feat/lumen-v2, корень
   репозитория), поэтому адрес зашит в LC.MANIFEST_URL — плагин подтягивает
   свежий каталог сам, без настройки. Настройка lumen_manifest_url остаётся
   приоритетнее (src/42_manifest.js, load). */
test('Task 20: LC.MANIFEST_URL — адрес каталога на хостинге, https и .json', () => {
  const head = readFileSync(new URL('../src/00_head.js', import.meta.url), 'utf8');
  const m = head.match(/LC\.MANIFEST_URL\s*=\s*'([^']*)'/);
  assert.ok(m, 'в src/00_head.js нет присваивания LC.MANIFEST_URL');
  assert.equal(m[1], 'https://azarkostya.github.io/lumen-card/manifest.json');
});

/* Task 21 (фаза 3): правила тематических атмосфер в каталоге. */
test('DEFAULT.themes: девять правил, у каждого id, preset из набора LC.fx, accent и ключевые слова', () => {
  const presets = ['bats', 'snow', 'stars', 'rain', 'sand', 'bubbles', 'petals', 'embers', 'glitch'];
  const themes = M.DEFAULT.themes;
  assert.equal(themes.length, 9);
  const ids = new Set();
  for (const t of themes) {
    assert.ok(!ids.has(t.id), 'дублированный id темы: ' + t.id);
    ids.add(t.id);
    assert.ok(presets.indexOf(t.preset) >= 0, 'неизвестный пресет ' + t.preset + ' у ' + t.id);
    assert.match(t.accent, /^#[0-9A-F]{6}$/, 'акцент темы ' + t.id);
    assert.ok(Array.isArray(t.keywords) && t.keywords.length > 0, 'нет ключевых слов у ' + t.id);
    for (const k of t.keywords) assert.equal(k, k.toLowerCase(), 'ключевое слово в нижнем регистре: ' + k);
    if (t.requireGenre) assert.ok(Array.isArray(t.genres) && t.genres.length, 'requireGenre без genres: ' + t.id);
  }
  /* Поправки контроллера к Task 21: акцент halloween — из экспорта дизайна. */
  assert.equal(themes[0].id, 'halloween');
  assert.equal(themes[0].accent, '#E07B2C');
  /* Рождество должно побеждать «космос» и прочие общие темы — оно раньше. */
  assert.ok(themes.findIndex(t => t.id === 'christmas') < themes.findIndex(t => t.id === 'space'));
});

test('DEFAULT: подборка christmas — пул адвент-календаря, сезон декабрь-январь', () => {
  const c = M.DEFAULT.collections.filter(x => x.id === 'christmas')[0];
  assert.ok(c, 'нет подборки christmas');
  assert.deepEqual(c.season, [12, 1]);
  assert.equal(c.sources.movie.params.keywords, 207317);
  assert.equal(c.sources.movie.params.genres, undefined, 'жанр не ограничен — иначе пул адвента только комедийный');
});

/* Task 22 (фаза 3): курируемые кадры заставки в каталоге. */
test('DEFAULT.ambient: кадры собраны живьём — путь, название, медиа и ширина у каждого', () => {
  const list = M.DEFAULT.ambient;
  assert.ok(Array.isArray(list), 'нет списка кадров');
  assert.ok(list.length >= 60, 'кадров меньше, чем требует план (60–80): ' + list.length);
  const paths = new Set();
  const ids = new Set();
  for (const f of list) {
    assert.ok(f.media === 'movie' || f.media === 'tv', 'медиа кадра: ' + f.media);
    assert.ok(typeof f.id === 'number' && f.id > 0, 'id кадра ' + f.title);
    assert.ok(typeof f.title === 'string' && f.title.length, 'название кадра ' + f.path);
    assert.match(f.path, /^\/[A-Za-z0-9]+\.jpg$/, 'путь кадра: ' + f.path);
    assert.ok(f.width >= 1920, 'кадр мельче FHD: ' + f.path);
    assert.ok(!paths.has(f.path), 'кадр повторяется: ' + f.path);
    paths.add(f.path);
    ids.add(f.id);
  }
  assert.ok(ids.size >= 30, 'кадры взяты слишком у немногих фильмов: ' + ids.size);
});

test('validate: ambient не массив — каталог отвергается, отсутствие ambient допустимо', () => {
  const base = { version: 1, groups: [{ id: 'g' }], home: [], collections: [] };
  assert.equal(M.validate(base).ok, true);
  assert.equal(M.validate(Object.assign({}, base, { ambient: [] })).ok, true);
  const bad = M.validate(Object.assign({}, base, { ambient: { path: '/x.jpg' } }));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'ambient_not_array');
});

test('validate: themes не массив — каталог отвергается, отсутствие themes допустимо', () => {
  const base = { version: 1, groups: [{ id: 'g' }], home: [], collections: [] };
  assert.equal(M.validate(base).ok, true);
  assert.equal(M.validate(Object.assign({}, base, { themes: [] })).ok, true);
  const bad = M.validate(Object.assign({}, base, { themes: { id: 'x' } }));
  assert.equal(bad.ok, false);
  assert.equal(bad.reason, 'themes_not_array');
});

/* Сезонные подборки к 9 мая и 14 февраля (docs/design/ux-ideas.md:34). */
test('DEFAULT: «Кино о войне» — сезон май, только художественное, название нейтральное', () => {
  const c = M.DEFAULT.collections.filter(x => x.id === 'war-may')[0];
  assert.ok(c, 'нет подборки war-may');
  assert.deepEqual(c.season, [5]);
  assert.equal(c.group, 'theme');
  const p = c.sources.movie.params;
  assert.equal(c.sources.movie.type, 'discover');
  assert.equal(p.genres, 10752, 'не жанр «военный» — в подборку поедет то, что помечено темой мимо');
  assert.equal(p.keywords, 1956);
  assert.ok(('' + p.filter.without_genres).split(',').indexOf('99') !== -1, 'документальное не исключено');
  assert.equal(c.sources.tv, undefined);
  /* Название — только о содержимом: никаких оценочных и праздничных слов. */
  assert.equal(c.title, 'Кино о войне');
  assert.deepEqual(c.i18n, { en: 'War Films', uk: 'Кіно про війну' });
  assert.equal(/побед|подвиг|геро|слав|памят|victory|hero|glory/i.test(c.title + c.i18n.en + c.i18n.uk), false);
});

test('DEFAULT: «Кино о любви» — сезон февраль, романтика и драма без анимации и ужасов', () => {
  const c = M.DEFAULT.collections.filter(x => x.id === 'love-feb')[0];
  assert.ok(c, 'нет подборки love-feb');
  assert.deepEqual(c.season, [2]);
  assert.equal(c.group, 'theme');
  const p = c.sources.movie.params;
  assert.equal(p.genres, '10749,18', 'романтика И драма: запятая, а не черта');
  const without = ('' + p.filter.without_genres).split(',');
  for (const g of ['99', '16', '27']) assert.ok(without.indexOf(g) !== -1, 'жанр ' + g + ' не исключён');
  assert.equal(c.title, 'Кино о любви');
  assert.ok(c.i18n && c.i18n.en && c.i18n.uk, 'нет перевода названия');
  /* В своём месяце подборка поднимается наверх, вне его — нет. */
  const theme = M.DEFAULT.collections.filter(x => x.group === 'theme');
  assert.equal(M.orderForMonth(theme, 2)[0].id, 'love-feb');
  assert.equal(M.orderForMonth(theme, 5)[0].id, 'war-may');
  assert.notEqual(M.orderForMonth(theme, 3)[0].id, 'love-feb');
});

/* Правка 2026-09-23: сериальная половина франшиз — по студиям (разбор и
   данные TMDB — в комментарии к подборкам в src/42_manifest.js). Прежний
   источник «Звёздных войн» — ключевое слово 379196 — давал два сериала; у
   «Гарри Поттера», «Властелина колец» и Marvel Studios сериалов не было
   вовсе. Сторож держит форму запросов: вернуть ключевое слово или потерять
   исключения — значит снова получить пустую или чужую половину. */
test('франшизы: сериалы по студиям — «Звёздные войны», «Гарри Поттер», «Властелин колец», Marvel Studios', () => {
  const byId = {};
  for (const c of M.DEFAULT.collections) byId[c.id] = c;

  const sw = byId['star-wars'].sources;
  assert.deepEqual(sw.movie, { type: 'collection', id: 10 }, 'фильмы — прежняя коллекция TMDB');
  assert.equal(sw.tv.type, 'discover');
  assert.equal(sw.tv.params.companies, 1, 'Lucasfilm');
  assert.equal(sw.tv.params.keywords, undefined, 'ключевое слово «star wars» отдавало два сериала из тридцати');
  assert.equal(sw.tv.params.genres, '10765|16', 'фантастика ИЛИ анимация — снимает комедию и документалки о франшизе');
  assert.deepEqual(sw.tv.params.filter.without_keywords.split(',').sort(), ['211227', '215470'],
    '«Уиллоу» (high fantasy) и «Хроники молодого Индианы Джонса» (treasure hunter)');

  assert.deepEqual(byId['harry-potter'].sources.tv, { type: 'discover', params: { companies: '437,3268', sort_by: 'popularity.desc' } },
    'Heyday Films И HBO — сериал HBO 2026');
  assert.deepEqual(byId['lotr'].sources.tv, { type: 'discover', params: { companies: '12,20580', sort_by: 'popularity.desc' } },
    'New Line Cinema И Amazon Studios — «Кольца власти»');
  assert.equal(byId['harry-potter'].sources.movie.id, 1241);
  assert.equal(byId['lotr'].sources.movie.id, 119);

  const marvel = byId['marvel'].sources;
  assert.equal(marvel.tv.params.companies, 420, 'сериалы той же студии');
  assert.equal(marvel.tv.params.filter.without_genres, '99', 'без документальных выпусков о студии');
});

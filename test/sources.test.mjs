import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const S = load('43_sources.js');

// --- buildRequest ---
test('buildRequest discover: url и params с page и langs', () => {
  const r = S.buildRequest({ type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } }, 'movie', 2);
  assert.equal(r.url, 'discover/movie');
  assert.deepEqual(r.params, { genres: 35, keywords: 207317, sort_by: 'popularity.desc', page: 2 });
  assert.equal(r.life, 720);
});
test('buildRequest collection/list: page игнорируется, кэш неделя', () => {
  assert.deepEqual(S.buildRequest({ type: 'collection', id: 10 }, 'movie', 3), { url: 'collection/10', params: {}, life: 10080 });
  assert.deepEqual(S.buildRequest({ type: 'list', id: 10 }, 'movie', 1), { url: 'list/10', params: {}, life: 10080 });
});
test('buildRequest discover page по умолчанию 1', () => {
  const r = S.buildRequest({ type: 'discover', params: { genres: 35 } }, 'tv');
  assert.equal(r.params.page, 1);
});
test('buildRequest discover tv', () => {
  const r = S.buildRequest({ type: 'discover', params: { networks: 213 } }, 'tv', 3);
  assert.equal(r.url, 'discover/tv');
  assert.equal(r.params.page, 3);
});
/* Находка 2026-09-23: подкаст «The Escape Pod» в «Звёздных войнах». Жанр
   10767 (Talk) отделяет ток-шоу и подкасты от сериалов — разбор данных у
   TV_WITHOUT в src/43_sources.js. */
test('buildRequest discover tv: ток-шоу и подкасты (жанр 10767) запрещены на стороне TMDB', () => {
  const r = S.buildRequest({ type: 'discover', params: { keywords: 379196 } }, 'tv', 1);
  assert.equal(r.params.filter.without_genres, '10767');
  const spec = { type: 'discover', params: { genres: 18, filter: { without_genres: '99', 'vote_count.gte': 50 } } };
  const own = S.buildRequest(spec, 'tv', 1);
  assert.deepEqual(own.params.filter, { without_genres: '99,10767', 'vote_count.gte': 50 }, 'свой запрет источника сохранён');
  assert.equal(spec.params.filter.without_genres, '99', 'манифест не мутируется');
  assert.equal(S.buildRequest({ type: 'discover', params: { filter: { without_genres: '10767' } } }, 'tv').params.filter.without_genres, '10767', 'без дубля');
  const movie = S.buildRequest({ type: 'discover', params: { genres: 35 } }, 'movie', 1);
  assert.equal(movie.params.filter, undefined, 'у фильмов жанра Talk не бывает — запрос не меняется');
  assert.equal(S.discoverUrl({ type: 'discover', params: { keywords: 379196 } }, 'tv'), 'discover/tv?with_keywords=379196&without_genres=10767',
    'полный список подборки (category_full) — с тем же запретом');
});

// --- normalize ---
test('normalize: parts/items -> results, служебные поля', () => {
  const c = S.normalize('collection', { name: 'Звёздные Войны', parts: [{ id: 2, release_date: '1980-05-17' }, { id: 1, release_date: '1977-05-25' }] });
  assert.deepEqual(c.results.map(function(x) { return x.id; }), [1, 2]); // по дате выхода
  assert.equal(c.total_results, 2); assert.equal(c.total_pages, 1); assert.equal(c.page, 1);
  const l = S.normalize('list', { name: 'Top 50', items: [{ id: 5 }], total_results: 50, total_pages: 3, page: 2 });
  assert.deepEqual(l.results, [{ id: 5 }]); assert.equal(l.total_pages, 3); assert.equal(l.page, 2);
  const d = S.normalize('discover', { results: [{ id: 9 }], total_results: 1, total_pages: 1, page: 1 });
  assert.deepEqual(d.results, [{ id: 9 }]);
  assert.deepEqual(S.normalize('discover', null).results, []);
});
test('normalize collection: сортировка по возрастанию даты', () => {
  const c = S.normalize('collection', { parts: [
    { id: 3, release_date: '1983-05-25' },
    { id: 1, release_date: '1977-05-25' },
    { id: 2, release_date: '1980-05-17' }
  ]});
  assert.deepEqual(c.results.map(function(x) { return x.id; }), [1, 2, 3]);
});
test('normalize: нет release_date — ставится в конец', () => {
  const c = S.normalize('collection', { parts: [
    { id: 2, release_date: '2020-01-01' },
    { id: 3 },
    { id: 1, release_date: '2015-01-01' }
  ]});
  assert.equal(c.results[0].id, 1);
  assert.equal(c.results[1].id, 2);
  assert.equal(c.results[2].id, 3);
});
test('normalize list пустые items', () => {
  const l = S.normalize('list', { items: [] });
  assert.deepEqual(l.results, []);
  assert.equal(l.total_results, 0);
});
test('normalize discover пустой json', () => {
  const d = S.normalize('discover', {});
  assert.deepEqual(d.results, []);
});

// --- discoverUrl ---
test('discoverUrl: query-строка для category_full, filter раскрывается', () => {
  assert.equal(S.discoverUrl({ type: 'discover', params: { genres: 35, keywords: 207317, filter: { 'vote_count.gte': 200 } } }, 'movie'),
    'discover/movie?with_genres=35&with_keywords=207317&vote_count.gte=200');
  assert.equal(S.discoverUrl({ type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc', orig_lang: 'ja' } }, 'tv'),
    'discover/tv?with_networks=2552&sort_by=popularity.desc&with_original_language=ja&without_genres=10767');
});
test('discoverUrl: пустые params', () => {
  assert.equal(S.discoverUrl({ type: 'discover', params: {} }, 'movie'), 'discover/movie');
});
test('discoverUrl: watch_providers и watch_region', () => {
  const u = S.discoverUrl({ type: 'discover', params: { watch_providers: 8, watch_region: 'US' } }, 'movie');
  assert.ok(u.indexOf('with_watch_providers=8') >= 0);
  assert.ok(u.indexOf('watch_region=US') >= 0);
});
test('discoverUrl: companies', () => {
  const u = S.discoverUrl({ type: 'discover', params: { companies: 3 } }, 'movie');
  assert.ok(u.indexOf('with_companies=3') >= 0);
});

// --- kpToFinds ---
test('kpToFinds: items -> список imdbId без пустых, не больше лимита', () => {
  assert.deepEqual(S.kpToFinds({ items: [{ imdbId: 'tt1' }, { imdbId: null }, { imdbId: 'tt2' }, { imdbId: 'tt3' }] }, 2), ['tt1', 'tt2']);
});
test('kpToFinds: пустой json', () => {
  assert.deepEqual(S.kpToFinds(null, 10), []);
  assert.deepEqual(S.kpToFinds({}, 10), []);
});
test('kpToFinds: все с imdbId', () => {
  assert.deepEqual(S.kpToFinds({ items: [{ imdbId: 'tt1' }, { imdbId: 'tt2' }] }, 10), ['tt1', 'tt2']);
});

// --- mergeMedia ---
test('mergeMedia: фильмы и сериалы чередуются; дубли — только внутри той же медиа (I1: ключ media:id)', () => {
  // movie:1 != tv:1 — фильм и сериал с одинаковым TMDB id разные объекты, оба попадают
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }], [{ id: 3 }, { id: 1 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 3, 2, 1]);
});
test('mergeMedia: только movies', () => {
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }], []);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 2]);
});
test('mergeMedia: только tv', () => {
  const m = S.mergeMedia([], [{ id: 3 }, { id: 4 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [3, 4]);
});
test('mergeMedia: null входы', () => {
  assert.deepEqual(S.mergeMedia(null, null), []);
  assert.deepEqual(S.mergeMedia(null, [{ id: 1 }]), [{ id: 1 }]);
});
test('mergeMedia: длинный список movies и короткий tv', () => {
  const m = S.mergeMedia([{ id: 1 }, { id: 2 }, { id: 3 }], [{ id: 4 }]);
  assert.deepEqual(m.map(function(x) { return x.id; }), [1, 4, 2, 3]);
});

/* ====================================================================== */
/* Task 74: источник постера карточки — чистая часть.                     */
/* ====================================================================== */

/* Допуск по пропорции. Границы поставлены замером на живых данных TMDB
   2026-09-23 (160 фильмов из восьми разнородных рядов, 2133 постера, из
   них 1318 без языка), и числа в тесте — те самые, что в замере.
   Ниже 2:3 у постеров без языка ровно две области: шум округления
   (0.651…0.666) и один выброс — 21 постер 0.486 (1440×2960, «Крёстный
   отец» I и II). Между 0.487 и 0.650 нет ни одного постера, поэтому
   нижняя граница стоит в этой пустой полосе, у её тугого края. */
test('Task 74: допуск пропорции — 0.64…0.75, выброс 0.486 отсекается', () => {
  assert.equal(S.posterFits(2 / 3), true, 'штатные 2:3 обязаны проходить');
  assert.equal(S.posterFits(0.64), true, 'нижняя граница включительно');
  assert.equal(S.posterFits(0.75), true, 'верхняя граница включительно (3:4)');
  /* Реальные значения из замера, которые обязаны проходить. */
  for (const ar of [0.666, 0.667, 0.68, 0.696, 0.701, 0.707, 0.714, 0.719, 0.736]) {
    assert.equal(S.posterFits(ar), true, 'отсечена живая пропорция ' + ar);
  }
  /* Выброс «обои телефона» и всё, что шире 3:4. */
  for (const ar of [0.486, 0.5, 0.6, 0.639, 0.751, 0.754, 0.756, 1.78]) {
    assert.equal(S.posterFits(ar), false, 'пропущена негодная пропорция ' + ar);
  }
  /* Пропорции нет вовсе — постер не берём: проверить нечем. */
  for (const bad of [undefined, null, 0, '', 'abc', NaN]) {
    assert.equal(S.posterFits(bad), false, 'пропущен постер без пропорции: ' + bad);
  }
});

/* Срез, который допуск разрешает, — в тех же числах, что и его границы.
   Ячейка ровно 2:3 (vendor/lampa/css/app.css:3135-3139), кадрирование
   cover: постер ВЫШЕ 2:3 теряет (1 − ar/(2/3)) высоты, ШИРЕ — (1 − (2/3)/ar)
   ширины. Допуск асимметричен намеренно: по бокам у постера поля, сверху
   голова. */
test('Task 74: границы допуска — это 4 % высоты и 11.1 % ширины', () => {
  const box = 2 / 3;
  const cutV = (ar) => 1 - ar / box;
  const cutH = (ar) => 1 - box / ar;
  assert.ok(Math.abs(cutV(0.64) - 0.04) < 0.001, 'нижняя граница не равна срезу 4 % высоты: ' + cutV(0.64));
  assert.ok(Math.abs(cutH(0.75) - 0.1111) < 0.001, 'верхняя граница не равна срезу 11.1 % ширины: ' + cutH(0.75));
  /* Первый же шаг за границу срез только увеличивает — знак допуска не
     перепутан. */
  assert.ok(cutV(0.639) > 0.04);
  assert.ok(cutH(0.751) > 0.1111);
});

/* cleanPoster — выбор постера «без надписей» из ответа {media}/{id}/images. */
test('Task 74: берётся первый постер без языка подходящей пропорции', () => {
  const json = {
    posters: [
      { file_path: '/ru.jpg', iso_639_1: 'ru', aspect_ratio: 0.667 },
      { file_path: '/wide.jpg', iso_639_1: null, aspect_ratio: 0.486 },
      { file_path: '/good.jpg', iso_639_1: null, aspect_ratio: 0.701 },
      { file_path: '/later.jpg', iso_639_1: null, aspect_ratio: 0.667 }
    ]
  };
  assert.equal(S.cleanPoster(json), '/good.jpg', 'порядок TMDB (по голосам) обязан сохраняться');
});

test('Task 74: «без языка» — это строго null, а не «xx» и не пустая строка', () => {
  /* У TMDB 'xx' означает «No Language» и стоит на изображениях, где текст
     ЕСТЬ, но язык не определён, — такой постер режиму не годится. */
  for (const lang of ['xx', '', 'en', 'ru']) {
    assert.equal(S.cleanPoster({ posters: [{ file_path: '/x.jpg', iso_639_1: lang, aspect_ratio: 0.667 }] }), '',
      'постер с iso_639_1=' + JSON.stringify(lang) + ' принят за «без языка»');
  }
  assert.equal(S.cleanPoster({ posters: [{ file_path: '/x.jpg', iso_639_1: null, aspect_ratio: 0.667 }] }), '/x.jpg');
});

test('Task 74: подходящего постера нет — пустая строка, карточка остаётся с постером Lampa', () => {
  assert.equal(S.cleanPoster(null), '');
  assert.equal(S.cleanPoster({}), '');
  assert.equal(S.cleanPoster({ posters: [] }), '');
  assert.equal(S.cleanPoster({ posters: [{ file_path: '/a.jpg', iso_639_1: null, aspect_ratio: 0.486 }] }), '',
    'кривой постер хуже обычного — подставлять его нельзя');
  assert.equal(S.cleanPoster({ posters: [{ iso_639_1: null, aspect_ratio: 0.667 }] }), '',
    'постер без file_path подставлять нечем');
});

/* posterIndex / applyPosters — сопоставление списков в режиме «оригинал». */
test('Task 74: сопоставление по id учитывает медиа — фильм и сериал с одним id не путаются', () => {
  const map = S.posterIndex([
    { id: 5, title: 'Фильм', poster_path: '/movie.jpg' },
    { id: 5, name: 'Сериал', poster_path: '/tv.jpg' }
  ]);
  assert.deepEqual(map, { 'movie:5': '/movie.jpg', 'tv:5': '/tv.jpg' });

  const cards = [{ id: 5, title: 'Фильм', poster_path: '/ru-movie.jpg' }, { id: 5, name: 'Сериал', poster_path: '/ru-tv.jpg' }];
  assert.equal(S.applyPosters(cards, map), 2);
  assert.equal(cards[0].poster_path, '/movie.jpg');
  assert.equal(cards[1].poster_path, '/tv.jpg');
});

test('Task 74: постера в карте нет — карточка остаётся со своим', () => {
  const map = S.posterIndex([
    { id: 1, title: 'Есть', poster_path: '/en.jpg' },
    { id: 2, title: 'Пусто', poster_path: null },
    { id: 3, title: 'Нет поля' }
  ]);
  assert.deepEqual(map, { 'movie:1': '/en.jpg' });

  const cards = [
    { id: 1, title: 'Есть', poster_path: '/ru.jpg' },
    { id: 2, title: 'Пусто', poster_path: '/ru2.jpg' },
    { id: 3, title: 'Нет поля', poster_path: '/ru3.jpg' }
  ];
  assert.equal(S.applyPosters(cards, map), 1, 'подменена ровно одна карточка');
  assert.equal(cards[1].poster_path, '/ru2.jpg');
  assert.equal(cards[2].poster_path, '/ru3.jpg');
});

test('Task 74: тот же самый постер за подмену не считается', () => {
  const cards = [{ id: 1, title: 'A', poster_path: '/same.jpg' }];
  assert.equal(S.applyPosters(cards, { 'movie:1': '/same.jpg' }), 0);
});

test('Task 74: дырки в списке карточек ничего не роняют', () => {
  assert.equal(S.applyPosters(null, {}), 0);
  assert.equal(S.applyPosters([null, undefined, {}, { title: 'без id' }], { 'movie:1': '/a.jpg' }), 0);
  assert.deepEqual(S.posterIndex(null), {});
  assert.deepEqual(S.posterIndex([null, {}, { id: 0, poster_path: '/a.jpg' }]), {});
});

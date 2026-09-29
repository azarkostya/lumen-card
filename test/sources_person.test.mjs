/* test/sources_person.test.mjs — источник person: фильмография человека
   (раунд r4, 2026-09-29). Режиссёры каталога были discover с with_crew —
   любая роль в съёмочной группе («Трудности перевода» Копполы у Уэса
   Андерсона, «Назад в будущее» у Спилберга). Источник person — один запрос
   person/{id}/movie_credits, из crew — только должность job (Director по
   умолчанию). Разбор — у credits в src/43_sources.js. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

const S0 = load('43_sources.js');

function setup(mode) {
  const calls = [];
  global.Lampa = {
    Storage: { get(k, d) { return d; }, set() {} },
    Api: { sources: { tmdb: { get(url, params, ok, err, cache) { calls.push({ url, params, ok, err, cache }); } } } }
  };
  global.window = { localStorage: null };
  const S = loadCtx('43_sources.js', {
    pref: function () { return ''; },
    postersMode: function () { return mode || 'lampa'; }
  }).api;
  return { S, calls };
}

/* Ответ TMDB в том виде, что отдаёт person/5655/movie_credits (поля —
   живые, 2026-09-29; числа popularity упрощены). */
const CREDITS = {
  id: 5655,
  cast: [{ id: 999, title: 'Роль в кадре', poster_path: '/c.jpg', popularity: 99, character: 'Himself' }],
  crew: [
    { id: 153, title: 'Трудности перевода', poster_path: '/lit.jpg', popularity: 30, job: 'Thanks', department: 'Crew', credit_id: 'a1' },
    { id: 120467, title: 'Отель «Гранд Будапешт»', poster_path: '/gb.jpg', backdrop_path: '/gbb.jpg', popularity: 20, job: 'Director', department: 'Directing', credit_id: 'a2', release_date: '2014-02-26', vote_average: 8.0, genre_ids: [35, 18] },
    { id: 120467, title: 'Отель «Гранд Будапешт»', poster_path: '/gb.jpg', popularity: 20, job: 'Screenplay', department: 'Writing', credit_id: 'a3' },
    { id: 120467, title: 'Отель «Гранд Будапешт»', poster_path: '/gb.jpg', popularity: 20, job: 'Director', department: 'Directing', credit_id: 'a4' },
    { id: 83666, title: 'Королевство полной луны', poster_path: '/mk.jpg', popularity: 12, job: 'Director', department: 'Directing', credit_id: 'a5', release_date: '2012-05-16', vote_average: 7.7 },
    { id: 1, title: 'Короткий метр', poster_path: null, popularity: 50, job: 'Director', department: 'Directing', credit_id: 'a6' },
    { id: 2, title: 'Взрослое', poster_path: '/x.jpg', adult: true, popularity: 60, job: 'Director', department: 'Directing', credit_id: 'a7' },
    { id: 4, title: 'Равный по популярности', poster_path: '/eq.jpg', popularity: 12, job: 'Director', department: 'Directing', credit_id: 'a8', release_date: '1996-02-21' },
    { id: 5, title: 'Анонс', poster_path: '/new.jpg', popularity: 40, job: 'Director', department: 'Directing', credit_id: 'a9', release_date: '' },
    { id: 6, title: 'Продюсер', poster_path: '/p.jpg', popularity: 70, job: 'Producer', department: 'Production', credit_id: 'b1' },
    null,
    { title: 'Без id', poster_path: '/n.jpg', job: 'Director' }
  ]
};

test('person: buildRequest — фильмография одним запросом, page не идёт, кэш неделя', () => {
  assert.deepEqual(S0.buildRequest({ type: 'person', id: 5655, job: 'Director' }, 'movie', 3),
    { url: 'person/5655/movie_credits', params: {}, life: 10080 });
  assert.equal(S0.buildRequest({ type: 'person', id: '240' }, 'movie', 1).url, 'person/240/movie_credits');
  assert.equal(S0.buildRequest({ type: 'person', id: 1 }, 'tv', 1).url, 'person/1/tv_credits', 'сериальный источник — tv_credits');
});

test('person: normalize — только режиссёрское, без повторов, adult и записей без постера, по популярности', () => {
  const r = S0.normalize('person', CREDITS, 'Director');
  assert.deepEqual(r.results.map((c) => c.id), [5, 120467, 83666, 4],
    'Thanks, Screenplay, Producer и актёрская роль — мимо; равная популярность — в порядке ответа');
  assert.equal(r.total_results, 4);
  assert.equal(r.total_pages, 1, 'одна страница — сетка дальше не просит');
  assert.equal(r.page, 1);
  const gb = r.results[1];
  assert.equal(gb.title, 'Отель «Гранд Будапешт»');
  assert.equal(gb.backdrop_path, '/gbb.jpg', 'первая запись с должностью — со своими полями');
  assert.deepEqual(gb.genre_ids, [35, 18]);
  assert.equal('job' in gb || 'department' in gb || 'credit_id' in gb, false, 'поля роли в карточку не идут');
  assert.equal('job' in CREDITS.crew[1], true, 'ответ не мутируется');
});

test('person: job по умолчанию — Director, другая должность — свой список', () => {
  assert.deepEqual(S0.normalize('person', CREDITS).results.map((c) => c.id), [5, 120467, 83666, 4]);
  assert.deepEqual(S0.normalize('person', CREDITS, '').results.map((c) => c.id), [5, 120467, 83666, 4]);
  assert.deepEqual(S0.normalize('person', CREDITS, 'Producer').results.map((c) => c.id), [6]);
  assert.deepEqual(S0.normalize('person', {}).results, [], 'пустой ответ — пустой список');
  assert.deepEqual(S0.normalize('person', null).results, []);
});

test('person: fetch — один запрос, фильмография по популярности, сортировки запрос не меняют', () => {
  const s = setup();
  const item = { id: 'wes-anderson', title: 'Уэс Андерсон', sources: { movie: { type: 'person', id: 5655, job: 'Director' } } };
  const got = [];
  s.S['fetch'](item, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, 'person/5655/movie_credits');
  assert.deepEqual(s.calls[0].params, {}, 'язык дописывает Lampa сама');
  assert.equal(s.calls[0].cache.life, 10080);
  /* Та же подборка, пока запрос летит, — подписка на него же (id:page:подпись). */
  s.S['fetch'](item, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  assert.equal(s.calls.length, 1, 'дедупликация: второй запрос не ушёл');
  assert.equal(s.S.sortSignature(item), '', 'порядок задаёт сортировка на месте, не запрос');
  s.calls[0].ok(CREDITS);
  assert.equal(got.length, 2);
  assert.deepEqual(got[0].results.map((c) => c.id), [5, 120467, 83666, 4]);
  assert.equal(got[0].title, 'Уэс Андерсон');
  assert.equal(got[0].total_pages, 1);
});

test('person: ошибка сети — подборка отвечает ошибкой, а не пустым списком', () => {
  const s = setup();
  const item = { id: 'lynch', title: 'Дэвид Линч', sources: { movie: { type: 'person', id: 5602 } } };
  const got = [];
  s.S['fetch'](item, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  s.calls[0].err();
  assert.equal(got.length, 1);
  assert.ok(got[0].err && got[0].err.all_failed);
});

test('person: отмена — поздний ответ подписчику не доходит', () => {
  const s = setup();
  const item = { id: 'nolan', title: 'Нолан', sources: { movie: { type: 'person', id: 525 } } };
  const got = [];
  const h = s.S['fetch'](item, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  h.clear();
  s.calls[0].ok(CREDITS);
  assert.equal(got.length, 0);
});

test('person: bannerPath — кадр первого по популярности фильма с backdrop_path', () => {
  const s = setup();
  const item = { id: 'wes-anderson', title: 'Уэс Андерсон', sources: { movie: { type: 'person', id: 5655, job: 'Director' } } };
  let got = null;
  s.S.bannerPath(item, (p) => { got = p; }, (e) => { throw new Error(JSON.stringify(e)); }, null);
  assert.equal(s.calls[0].url, 'person/5655/movie_credits');
  s.calls[0].ok(CREDITS);
  assert.equal(got, '/gbb.jpg', 'у «Анонса» кадра нет — кадр «Гранд Будапешта»');
});

test('person: «английские» постеры — та же фильмография с langs=en, та же должность', () => {
  const s = setup('original');
  const item = { id: 'x', title: 'X', sources: { movie: { type: 'person', id: 5655, job: 'Director' } } };
  const cards = S0.normalize('person', CREDITS, 'Director').results;
  const done = [];
  s.S.posters(item, cards, (n) => done.push(n), null, 1);
  assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].url, 'person/5655/movie_credits');
  assert.equal(s.calls[0].params.langs, 'en');
  s.calls[0].ok({ crew: [
    { id: 120467, title: 'The Grand Budapest Hotel', poster_path: '/en-gb.jpg', job: 'Director' },
    { id: 6, title: 'Producer', poster_path: '/en-p.jpg', job: 'Producer' }
  ] });
  assert.deepEqual(done, [1]);
  assert.equal(cards[1].poster_path, '/en-gb.jpg');
});

/* План 1.2, фича 4: подборка из нескольких людей (person + also). «Братья
   Коэн» — Джоэл (1223) режиссёр всех общих фильмов, сольные работы Итана
   (1224) есть только в его фильмографии. Числа ответов — упрощённые живые
   (2026-09-29). */
const JOEL = {
  id: 1223,
  crew: [
    { id: 275, title: 'Фарго', poster_path: '/fargo.jpg', backdrop_path: '/fargo-b.jpg', popularity: 9, job: 'Director', credit_id: 'j1', release_date: '1996-03-08' },
    { id: 115, title: 'Большой Лебовски', poster_path: '/leb.jpg', popularity: 15, job: 'Director', credit_id: 'j2', release_date: '1998-03-06' },
    { id: 6977, title: 'Старикам тут не место', poster_path: '/nc.jpg', popularity: 12, job: 'Director', credit_id: 'j3', release_date: '2007-11-08' },
    { id: 602734, title: 'Трагедия Макбета', poster_path: '/mac.jpg', popularity: 5, job: 'Director', credit_id: 'j4' }
  ]
};
const ETHAN = {
  id: 1224,
  crew: [
    { id: 275, title: 'Фарго', poster_path: '/fargo.jpg', popularity: 9, job: 'Director', credit_id: 'e1' },
    { id: 957304, title: 'Красотки в бегах', poster_path: '/drive.jpg', popularity: 12, job: 'Director', credit_id: 'e2', release_date: '2024-02-22' },
    { id: 1149504, title: 'Хани, не надо!', poster_path: '/honey.jpg', popularity: 7, job: 'Director', credit_id: 'e3' },
    { id: 962537, title: 'Jerry Lee Lewis: Trouble in Mind', poster_path: null, popularity: 3, job: 'Director', credit_id: 'e4' },
    { id: 115, title: 'Большой Лебовски', poster_path: '/leb.jpg', popularity: 15, job: 'Writer', credit_id: 'e5' }
  ]
};
const COEN = { id: 'coen-brothers', title: 'Братья Коэн', sources: { movie: { type: 'person', id: 1223, also: [1224], job: 'Director' } } };

test('person+also: personIds — базовый первым, без повторов и мусора, also не больше 3', () => {
  assert.deepEqual(S0.personIds({ type: 'person', id: 1223 }), ['1223']);
  assert.deepEqual(S0.personIds({ type: 'person', id: 1223, also: [1224] }), ['1223', '1224']);
  assert.deepEqual(S0.personIds({ type: 'person', id: 1223, also: [1223, '1224', 1224, 'x', 0, '01', -3, 5.5, null] }), ['1223', '1224'],
    'повтор базового и also, строки не из цифр, 0 и дроби — мимо');
  assert.deepEqual(S0.personIds({ type: 'person', id: 1, also: [2, 3, 4, 5, 6] }), ['1', '2', '3', '4'], 'не больше 1 + 3 запросов');
  assert.deepEqual(S0.personIds({ type: 'person', id: 1, also: [1, 1, 1, 2, 3, 4] }), ['1', '2', '3', '4'], 'повторы в предел не идут');
  assert.deepEqual(S0.personIds({ type: 'person', id: 1, also: 2 }), ['1'], 'не массив — нет добавок');
  assert.equal(S0.isPersonSet({ type: 'person', id: 1223, also: [1224] }), true);
  assert.equal(S0.isPersonSet({ type: 'person', id: 1223 }), false);
  assert.equal(S0.isPersonSet({ type: 'person', id: 1223, also: [1223, 'x'] }), false, 'добавок не осталось — одиночный запрос');
  assert.equal(S0.isPersonSet({ type: 'collection', id: 1, also: [2] }), false);
  assert.equal(S0.isSet({ type: 'person', id: 1223, also: [1224] }), false, 'набор коллекций его не забирает');
});

test('person+also: personRequests — по фильмографии на человека, кэш неделя, должность с собой', () => {
  const spec = COEN.sources.movie;
  assert.deepEqual(S0.personRequests(spec, 'movie'), [
    { url: 'person/1223/movie_credits', params: {}, life: 10080, kind: 'person', job: 'Director' },
    { url: 'person/1224/movie_credits', params: {}, life: 10080, kind: 'person', job: 'Director' }
  ]);
  assert.deepEqual(S0.personRequests({ type: 'person', id: 1, also: [2] }, 'tv').map((r) => r.url),
    ['person/1/tv_credits', 'person/2/tv_credits'], 'сериальный источник — tv_credits');
  assert.deepEqual(S0.buildRequest(spec, 'movie', 1),
    { url: 'person/1223/movie_credits', params: {}, life: 10080 }, 'одиночный buildRequest не меняется (1.1.0 так и спросит)');
});

test('person+also: mergeCredits — одна фильмография: без повторов, без чужих должностей и без постера, по популярности', () => {
  const r = S0.mergeCredits([JOEL, ETHAN], 'Director');
  assert.deepEqual(r.results.map((c) => c.id), [115, 6977, 957304, 275, 1149504, 602734],
    'равная популярность (12) — в порядке ответов: сначала Джоэл');
  assert.equal(r.results.filter((c) => c.id === 275).length, 1, '«Фарго» один раз');
  assert.equal(r.results[3].backdrop_path, '/fargo-b.jpg', 'повтор — первая встреченная запись (базового человека)');
  assert.equal(r.total_pages, 1);
  assert.equal(r.total_results, 6);
  assert.deepEqual(S0.mergeCredits([null, ETHAN], 'Director').results.map((c) => c.id), [957304, 275, 1149504], 'пропуск — мимо');
  assert.deepEqual(S0.mergeCredits([JOEL, ETHAN], 'Writer').results.map((c) => c.id), [115]);
  assert.deepEqual(S0.mergeCredits([], 'Director').results, []);
});

test('person+also: fetch — два запроса сразу, объединение в любом порядке ответов, дедупликация in-flight', () => {
  const s = setup();
  const got = [];
  s.S['fetch'](COEN, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  assert.deepEqual(s.calls.map((c) => c.url), ['person/1223/movie_credits', 'person/1224/movie_credits']);
  assert.deepEqual(s.calls.map((c) => c.cache.life), [10080, 10080]);
  assert.deepEqual(s.calls[1].params, {});
  s.S['fetch'](COEN, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  assert.equal(s.calls.length, 2, 'та же подборка, пока летит, — подписка, а не новые запросы');
  s.calls[1].ok(ETHAN);
  assert.equal(got.length, 0, 'ждёт второго');
  s.calls[0].ok(JOEL);
  assert.equal(got.length, 2);
  assert.deepEqual(got[0].results.map((c) => c.id), [115, 6977, 957304, 275, 1149504, 602734],
    'порядок ответов не важен: склейка — по порядку запросов');
  assert.equal(got[0].title, 'Братья Коэн');
  assert.equal(got[0].total_pages, 1);
});

test('person+also: один запрос упал — подборка из второго; оба — ошибка подборки', () => {
  let s = setup();
  let got = [];
  s.S['fetch'](COEN, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  s.calls[0].err();
  s.calls[1].ok(ETHAN);
  assert.deepEqual(got[0].results.map((c) => c.id), [957304, 275, 1149504]);
  s = setup();
  got = [];
  s.S['fetch'](COEN, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  s.calls[0].err();
  s.calls[1].err();
  assert.equal(got.length, 1);
  assert.ok(got[0].err && got[0].err.all_failed, 'не пустой список, а ошибка');
});

test('person+also: отмена — поздние ответы подписчику не доходят', () => {
  const s = setup();
  const got = [];
  const h = s.S['fetch'](COEN, 1, (j) => got.push(j), (e) => got.push({ err: e }), null);
  h.clear();
  s.calls[0].ok(JOEL);
  s.calls[1].ok(ETHAN);
  assert.equal(got.length, 0);
});

test('person+also: bannerPath — кадр первого по популярности из объединения', () => {
  const s = setup();
  let got = null;
  s.S.bannerPath(COEN, (p) => { got = p; }, (e) => { throw new Error(JSON.stringify(e)); }, null);
  assert.equal(s.calls.length, 2);
  s.calls[0].ok({ crew: [{ id: 275, title: 'Фарго', poster_path: '/f.jpg', backdrop_path: '/fb.jpg', popularity: 9, job: 'Director' }] });
  s.calls[1].ok({ crew: [{ id: 957304, title: 'Красотки в бегах', poster_path: '/d.jpg', backdrop_path: '/db.jpg', popularity: 12, job: 'Director' }] });
  assert.equal(got, '/db.jpg', 'сольный фильм Итана популярнее — его кадр');
});

test('person+also: «английские» постеры — по запросу на человека с langs=en и той же должностью', () => {
  const s = setup('original');
  const cards = S0.mergeCredits([JOEL, ETHAN], 'Director').results;
  const done = [];
  s.S.posters(COEN, cards, (n) => done.push(n), null, 1);
  assert.deepEqual(s.calls.map((c) => c.url), ['person/1223/movie_credits', 'person/1224/movie_credits']);
  assert.deepEqual(s.calls.map((c) => c.params.langs), ['en', 'en']);
  s.calls[0].ok({ crew: [{ id: 275, title: 'Fargo', poster_path: '/en-fargo.jpg', job: 'Director' }] });
  s.calls[1].ok({ crew: [
    { id: 957304, title: 'Drive-Away Dolls', poster_path: '/en-drive.jpg', job: 'Director' },
    { id: 115, title: 'The Big Lebowski', poster_path: '/en-leb.jpg', job: 'Writer' }
  ] });
  assert.deepEqual(done, [2], 'Лебовски у Итана — сценарий: не его режиссёрская запись');
  const byId = {};
  for (const c of cards) byId[c.id] = c.poster_path;
  assert.equal(byId[275], '/en-fargo.jpg');
  assert.equal(byId[957304], '/en-drive.jpg');
  assert.equal(byId[115], '/leb.jpg');
});

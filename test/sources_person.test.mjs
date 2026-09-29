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

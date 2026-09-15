import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const cardinfo = load('35_cardinfo.js');

/* -------------------------------------------------------------------- */
/* isSerial / genres / pgText (рефакторинг: вынесены из 90_runtime.js в       */
/* LC.header — эти три чистые остались/переехали в LC.cardinfo, без Lampa/DOM) */
/* -------------------------------------------------------------------- */

test('isSerial: сериал по first_air_date/number_of_seasons/number_of_episodes/name', () => {
  assert.equal(cardinfo.isSerial({ first_air_date: '2024-01-01' }), true);
  assert.equal(cardinfo.isSerial({ number_of_seasons: 2 }), true);
  assert.equal(cardinfo.isSerial({ number_of_episodes: 10 }), true);
  assert.equal(cardinfo.isSerial({ name: 'Фоллаут' }), true);
});

test('isSerial: фильм -> false', () => {
  assert.equal(cardinfo.isSerial({ title: 'Дюна', release_date: '2024-01-01' }), false);
  assert.equal(cardinfo.isSerial({}), false);
});

test('genres: до 3 жанров, каждый через переданный capitalizeFn', () => {
  const raw = [{ name: 'фантастика' }, { name: 'приключения' }, { name: 'драма' }, { name: 'триллер' }];
  const cap = (s) => s.toUpperCase();
  assert.deepEqual(cardinfo.genres(raw, cap), ['ФАНТАСТИКА', 'ПРИКЛЮЧЕНИЯ', 'ДРАМА']);
});

test('genres: без capitalizeFn -> как есть; пусто/нет данных -> []', () => {
  assert.deepEqual(cardinfo.genres([{ name: 'драма' }]), ['драма']);
  assert.deepEqual(cardinfo.genres([]), []);
  assert.deepEqual(cardinfo.genres(null), []);
});

test('genres: элемент без name пропускается', () => {
  assert.deepEqual(cardinfo.genres([{ name: 'драма' }, {}, { name: 'комедия' }]), ['драма', 'комедия']);
});

test('pgText: приоритет у распознанного Lampa.TMDB.parsePG, иначе текст узла .full-start__pg', () => {
  assert.equal(cardinfo.pgText('18+', '16+'), '18+');
  assert.equal(cardinfo.pgText('', '16+'), '16+');
  assert.equal(cardinfo.pgText(null, null), '');
  assert.equal(cardinfo.pgText(undefined, undefined), '');
});

/* -------------------------------------------------------------------- */
/* country                                                               */
/* -------------------------------------------------------------------- */

test('country: берёт текст штатного .full-start-new__head без года', () => {
  assert.equal(cardinfo.country('2024, США', []), 'США');
});

test('country: несколько стран в head — берёт целиком остаток без года', () => {
  assert.equal(cardinfo.country('2024, США, Канада', []), 'США, Канада');
});

test('country: head пустой -> фолбэк по словарю ISO', () => {
  assert.equal(cardinfo.country('', [{ iso_3166_1: 'US', name: 'United States of America' }]), 'США');
  assert.equal(cardinfo.country('', [{ iso_3166_1: 'FR', name: 'France' }]), 'Франция');
  assert.equal(cardinfo.country('', [{ iso_3166_1: 'RU', name: 'Russia' }]), 'Россия');
});

test('country: head содержит только год -> фолбэк по странам', () => {
  assert.equal(cardinfo.country('2024', [{ iso_3166_1: 'JP', name: 'Japan' }]), 'Япония');
});

test('country: код не найден в словаре -> английское имя', () => {
  assert.equal(cardinfo.country('', [{ iso_3166_1: 'ZZ', name: 'Wonderland' }]), 'Wonderland');
});

test('country: ни head, ни countries -> пустая строка', () => {
  assert.equal(cardinfo.country('', []), '');
  assert.equal(cardinfo.country('', null), '');
});

/* -------------------------------------------------------------------- */
/* director / creator                                                    */
/* -------------------------------------------------------------------- */

test('director: первый Director из crew', () => {
  const crew = [
    { job: 'Writer', name: 'Джон Спейтс' },
    { job: 'Director', name: 'Дени Вильнёв' },
    { job: 'Director', name: 'Второй режиссёр' }
  ];
  assert.equal(cardinfo.director(crew), 'Дени Вильнёв');
});

test('director: нет Director в crew -> пусто', () => {
  assert.equal(cardinfo.director([{ job: 'Writer', name: 'X' }]), '');
  assert.equal(cardinfo.director([]), '');
  assert.equal(cardinfo.director(null), '');
});

test('creator: created_by[0].name', () => {
  assert.equal(cardinfo.creator({ created_by: [{ name: 'Джонатан Нолан' }, { name: 'Другой' }] }), 'Джонатан Нолан');
});

test('creator: нет created_by -> пусто', () => {
  assert.equal(cardinfo.creator({}), '');
  assert.equal(cardinfo.creator({ created_by: [] }), '');
  assert.equal(cardinfo.creator(null), '');
});

/* -------------------------------------------------------------------- */
/* titleClass                                                            */
/* -------------------------------------------------------------------- */

test('titleClass: длиннее 18 символов -> lumen-title--long', () => {
  assert.equal(cardinfo.titleClass('Дюна: Часть вторая!'), 'lumen-title--long'); // 19 символов
});

test('titleClass: короче или равно 18 -> пусто', () => {
  assert.equal(cardinfo.titleClass('Фоллаут'), '');
  assert.equal(cardinfo.titleClass('123456789012345678'), ''); // ровно 18
});

test('titleClass: пусто/нет данных -> пусто', () => {
  assert.equal(cardinfo.titleClass(''), '');
  assert.equal(cardinfo.titleClass(null), '');
});

/* -------------------------------------------------------------------- */
/* statusKind                                                            */
/* -------------------------------------------------------------------- */

test('statusKind: Released -> good', () => {
  assert.equal(cardinfo.statusKind('Released'), 'good');
});

test('statusKind: Returning Series -> accent', () => {
  assert.equal(cardinfo.statusKind('Returning Series'), 'accent');
});

test('statusKind: Ended/Canceled -> muted', () => {
  assert.equal(cardinfo.statusKind('Ended'), 'muted');
  assert.equal(cardinfo.statusKind('Canceled'), 'muted');
});

test('statusKind: Planned/In Production/Post Production -> soon', () => {
  assert.equal(cardinfo.statusKind('Planned'), 'soon');
  assert.equal(cardinfo.statusKind('In Production'), 'soon');
  assert.equal(cardinfo.statusKind('Post Production'), 'soon');
});

test('statusKind: регистр не важен', () => {
  assert.equal(cardinfo.statusKind('released'), 'good');
  assert.equal(cardinfo.statusKind('RETURNING SERIES'), 'accent');
});

test('statusKind: неизвестный статус -> muted', () => {
  assert.equal(cardinfo.statusKind('Rumored'), 'muted');
  assert.equal(cardinfo.statusKind(''), 'muted');
});

/* -------------------------------------------------------------------- */
/* qualityChips                                                          */
/* -------------------------------------------------------------------- */

test('qualityChips: раздельные токены', () => {
  assert.deepEqual(cardinfo.qualityChips('4K HDR'), ['4K', 'HDR']);
});

test('qualityChips: BDRip/BluRay -> BD', () => {
  assert.deepEqual(cardinfo.qualityChips('BDRip'), ['BD']);
  assert.deepEqual(cardinfo.qualityChips('BluRay 4K'), ['BD', '4K']);
});

test('qualityChips: WEB-DL -> WEB', () => {
  assert.deepEqual(cardinfo.qualityChips('WEB-DL'), ['WEB']);
});

test('qualityChips: пусто -> []', () => {
  assert.deepEqual(cardinfo.qualityChips(''), []);
  assert.deepEqual(cardinfo.qualityChips(null), []);
});

test('qualityChips: без дублей (соседних)', () => {
  assert.deepEqual(cardinfo.qualityChips('4K 4K'), ['4K']);
});

test('qualityChips: без дублей (несоседний повтор)', () => {
  assert.deepEqual(cardinfo.qualityChips('4K WEB 4K'), ['4K', 'WEB']);
});

/* -------------------------------------------------------------------- */
/* reactionsCount                                                        */
/* -------------------------------------------------------------------- */

test('reactionsCount: counter реакции fire', () => {
  const result = [
    { type: 'fire', counter: 5606 },
    { type: 'nice', counter: 1325 }
  ];
  assert.equal(cardinfo.reactionsCount(result), 5606);
});

test('reactionsCount: нет fire -> 0', () => {
  assert.equal(cardinfo.reactionsCount([{ type: 'nice', counter: 10 }]), 0);
});

test('reactionsCount: пусто/нет данных -> 0', () => {
  assert.equal(cardinfo.reactionsCount([]), 0);
  assert.equal(cardinfo.reactionsCount(null), 0);
  assert.equal(cardinfo.reactionsCount(undefined), 0);
});

/* -------------------------------------------------------------------- */
/* imageUrl (ревью Task 5a: URL картинок только через прокси TMDB Lampa,  */
/* Task 5 Step 3b.3) — стабы ниже намеренно копируют реальное поведение   */
/* Lampa.TMDB.image (без двойного слэша) и Lampa.Api.img (с двойным      */
/* слэшем, если path передан с ведущим '/') — проверено живьём на         */
/* vendor/lampa 3.3.4: Lampa.Api.img('/x.jpg','w1280') даёт '.../w1280//x.jpg'. */
/* -------------------------------------------------------------------- */

function tmdbImageStub(url) { return 'https://image.tmdb.org/' + url; }
function apiImgStub(path, size) { return 'https://image.tmdb.org/t/p/' + size + '/' + path; } /* как реальный Lampa.Api.img — если path сохранил ведущий '/', получается двойной слэш */

test('imageUrl: основной путь — Lampa.TMDB.image, без двойного слэша (path с ведущим /)', () => {
  const url = cardinfo.imageUrl('/eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg', 'w1280', tmdbImageStub, apiImgStub);
  assert.equal(url, 'https://image.tmdb.org/t/p/w1280/eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg');
  assert.equal(url.indexOf('//eZ239'), -1);
});

test('imageUrl: path без ведущего / — тот же результат', () => {
  const url = cardinfo.imageUrl('eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg', 'w1280', tmdbImageStub, apiImgStub);
  assert.equal(url, 'https://image.tmdb.org/t/p/w1280/eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg');
});

test('imageUrl: tmdbImage недоступен -> фолбэк apiImg, тоже без двойного слэша', () => {
  const url = cardinfo.imageUrl('/eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg', 'w1280', null, apiImgStub);
  assert.equal(url, 'https://image.tmdb.org/t/p/w1280/eZ239CyMFqXOwhcaTFrBrNZBpb9.jpg');
  assert.equal(url.indexOf('//eZ239'), -1);
});

test('imageUrl: ни один метод недоступен -> пусто', () => {
  assert.equal(cardinfo.imageUrl('/eZ239.jpg', 'w1280', null, null), '');
});

test('imageUrl: пустой path -> пусто, методы не вызываются', () => {
  let called = false;
  function spy() { called = true; return 'x'; }
  assert.equal(cardinfo.imageUrl('', 'w1280', spy, spy), '');
  assert.equal(cardinfo.imageUrl(null, 'w1280', spy, spy), '');
  assert.equal(called, false);
});

test('imageUrl: tmdbImage бросает исключение -> фолбэк на apiImg', () => {
  function throwing() { throw new Error('boom'); }
  const url = cardinfo.imageUrl('/eZ239.jpg', 'w1280', throwing, apiImgStub);
  assert.equal(url, 'https://image.tmdb.org/t/p/w1280/eZ239.jpg');
});

/* -------------------------------------------------------------------- */
/* bgMode (Task 5b Step 1, TDD): режим фона по данным movie, ДО попытки  */
/* реальной загрузки картинки — 'backdrop' (есть кадр или пригодный      */
/* элемент images.backdrops), 'poster' (кадров нет, но есть постер),     */
/* 'procedural' (нет вообще ничего, v1-градиенты). Порядок движка загрузки */
/* самой картинки (onload/onerror/таймаут) — забота LC.backdrops, не эта  */
/* чистая функция. */
/* -------------------------------------------------------------------- */

test('bgMode: есть backdrop_path -> backdrop', () => {
  assert.equal(cardinfo.bgMode({ backdrop_path: '/x.jpg' }), 'backdrop');
});

test('bgMode: backdrop_path пуст, но в images.backdrops есть элемент без iso_639_1 -> backdrop', () => {
  const movie = {
    images: { backdrops: [
      { file_path: '/logo.jpg', iso_639_1: 'en' },
      { file_path: '/frame.jpg', iso_639_1: null }
    ] }
  };
  assert.equal(cardinfo.bgMode(movie), 'backdrop');
});

test('bgMode: в images.backdrops только элементы с iso_639_1 (текст/логотипы) -> не backdrop', () => {
  const movie = {
    poster_path: '/poster.jpg',
    images: { backdrops: [{ file_path: '/logo.jpg', iso_639_1: 'en' }] }
  };
  assert.equal(cardinfo.bgMode(movie), 'poster');
});

test('bgMode: элемент images.backdrops без file_path не считается -> не backdrop', () => {
  const movie = { poster_path: '/poster.jpg', images: { backdrops: [{ iso_639_1: null }] } };
  assert.equal(cardinfo.bgMode(movie), 'poster');
});

test('bgMode: нет кадров, есть poster_path -> poster', () => {
  assert.equal(cardinfo.bgMode({ poster_path: '/p.jpg' }), 'poster');
});

test('bgMode: нет ничего -> procedural', () => {
  assert.equal(cardinfo.bgMode({}), 'procedural');
  assert.equal(cardinfo.bgMode({ images: { backdrops: [] } }), 'procedural');
});

test('bgMode: movie не передан (null/undefined) -> procedural, без исключения', () => {
  assert.equal(cardinfo.bgMode(null), 'procedural');
  assert.equal(cardinfo.bgMode(undefined), 'procedural');
});

test('bgMode: images без backdrops -> как отсутствие кадров', () => {
  assert.equal(cardinfo.bgMode({ poster_path: '/p.jpg', images: {} }), 'poster');
  assert.equal(cardinfo.bgMode({ images: {} }), 'procedural');
});

/* -------------------------------------------------------------------- */
/* backdropPath (Task 5b, правки координатора п.1): единая точка правды  */
/* для bgMode И LC.backdrops.backdropUrl (50_backdrops.js) — раньше они  */
/* были рассинхронизированы (bgMode учитывал images.backdrops[], а       */
/* backdropUrl — только backdrop_path). */
/* -------------------------------------------------------------------- */

test('backdropPath: есть backdrop_path -> он и возвращается', () => {
  assert.equal(cardinfo.backdropPath({ backdrop_path: '/x.jpg' }), '/x.jpg');
});

test('backdropPath: backdrop_path пуст, но в images.backdrops есть элемент без iso_639_1 -> его file_path', () => {
  const movie = {
    images: { backdrops: [
      { file_path: '/logo.jpg', iso_639_1: 'en' },
      { file_path: '/frame.jpg', iso_639_1: null }
    ] }
  };
  assert.equal(cardinfo.backdropPath(movie), '/frame.jpg');
  assert.equal(cardinfo.bgMode(movie), 'backdrop');
});

test('backdropPath: только элементы с iso_639_1/без file_path -> "" (и bgMode не backdrop)', () => {
  const movie = { poster_path: '/p.jpg', images: { backdrops: [{ file_path: '/logo.jpg', iso_639_1: 'en' }, { iso_639_1: null }] } };
  assert.equal(cardinfo.backdropPath(movie), '');
  assert.equal(cardinfo.bgMode(movie), 'poster');
});

test('backdropPath: нет ничего -> "" ; movie не передан -> "", без исключения', () => {
  assert.equal(cardinfo.backdropPath({}), '');
  assert.equal(cardinfo.backdropPath(null), '');
  assert.equal(cardinfo.backdropPath(undefined), '');
});

/* -------------------------------------------------------------------- */
/* Task 5c: сериал — чип «Следующая серия», короткая дата, студия/сеть    */
/* -------------------------------------------------------------------- */

const NOW = new Date(2026, 10, 16, 23, 50); // 16 ноября 2026, 23:50 местного

test('nextEpisode: дата через 31 день -> дата в родительном падеже, склонение «день»', () => {
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-12-17', episode_number: 1 }, NOW), {
    date: '17 декабря',
    days: 31,
    text: 'Следующая серия — 17 декабря, через 31 день'
  });
});

test('nextEpisode: склонения «дня»/«дней» через LC.util.plural', () => {
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-08' }, NOW).text, 'Следующая серия — 8 декабря, через 22 дня');
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-11' }, NOW).text, 'Следующая серия — 11 декабря, через 25 дней');
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-11-27' }, NOW).text, 'Следующая серия — 27 ноября, через 11 дней');
});

test('nextEpisode: сегодня и завтра — словом, без «через N»', () => {
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-11-16' }, NOW), {
    date: '16 ноября', days: 0, text: 'Следующая серия — сегодня'
  });
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-11-17' }, new Date(2026, 10, 16, 0, 5)), {
    date: '17 ноября', days: 1, text: 'Следующая серия — завтра'
  });
});

test('nextEpisode: дата в прошлом или нет данных -> null', () => {
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-11-15' }, NOW), null);
  assert.equal(cardinfo.nextEpisode(null, NOW), null);
  assert.equal(cardinfo.nextEpisode(undefined, NOW), null);
  assert.equal(cardinfo.nextEpisode({}, NOW), null);
  assert.equal(cardinfo.nextEpisode({ air_date: '' }, NOW), null);
  assert.equal(cardinfo.nextEpisode({ air_date: 'скоро' }, NOW), null);
});

test('shortDate: «17 дек» для серии, которая не вышла; май — «мая»; пусто/мусор -> ""', () => {
  assert.equal(cardinfo.shortDate('2026-12-17'), '17 дек');
  assert.equal(cardinfo.shortDate('2026-05-03'), '3 мая');
  assert.equal(cardinfo.shortDate('2026-01-09'), '9 янв');
  assert.equal(cardinfo.shortDate(''), '');
  assert.equal(cardinfo.shortDate(null), '');
  assert.equal(cardinfo.shortDate('2026-13-01'), '');
});

test('network: networks[0].name, иначе первая студия production_companies, иначе ""', () => {
  assert.equal(cardinfo.network({ networks: [{ name: 'Prime Video' }, { name: 'HBO' }] }), 'Prime Video');
  assert.equal(cardinfo.network({ networks: [], production_companies: [{ name: 'Kilter Films' }] }), 'Kilter Films');
  assert.equal(cardinfo.network({ networks: [{}] }), '');
  assert.equal(cardinfo.network({}), '');
  assert.equal(cardinfo.network(null), '');
});

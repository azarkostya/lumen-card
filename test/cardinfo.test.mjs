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

/* Долг фазы 1 (docs/plans/2026-09-15-lumen-card.md:1123, п.3): фолбэк
   по ISO отдавал русское название при любом языке интерфейса. */
test('country: фолбэк по ISO — на языке интерфейса, а не всегда по-русски', () => {
  const us = [{ iso_3166_1: 'US', name: 'United States of America' }];
  const de = [{ iso_3166_1: 'DE', name: 'Germany' }];
  assert.equal(cardinfo.country('', us, 'en'), 'United States of America', 'английский — имя TMDB как есть');
  assert.equal(cardinfo.country('', de, 'en'), 'Germany');
  assert.equal(cardinfo.country('', de, 'uk'), 'Німеччина');
  assert.equal(cardinfo.country('', de, 'ru'), 'Германия');
  assert.equal(cardinfo.country('', de, 'be'), 'Germany', 'языка без словаря — имя TMDB, а не русское');
  assert.equal(cardinfo.country('2024, Deutschland', de, 'en'), 'Deutschland', 'текст Lampa в шапке главнее словаря');
});

test('country: ни head, ни countries -> пустая строка', () => {
  assert.equal(cardinfo.country('', []), '');
  assert.equal(cardinfo.country('', null), '');
});

/* -------------------------------------------------------------------- */
/* creator                                                               */
/* -------------------------------------------------------------------- */

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
/* titleParts (разбор композиции 2026-09-22, п.2.1)                      */
/* -------------------------------------------------------------------- */

test('titleParts: длинное название режется по первому разделителю', () => {
  assert.deepEqual(
    cardinfo.titleParts('Звёздные войны: Эпизод 5 - Империя наносит ответный удар'),
    { lead: 'Звёздные войны', sub: 'Эпизод 5 - Империя наносит ответный удар' }
  );
  /* Тире в роли разделителя — обычное, среднее и длинное, и только
     окружённое пробелами: в «Человеке-пауке» дефис внутри слова. */
  assert.deepEqual(cardinfo.titleParts('Ты + Я — против всего мира'), { lead: 'Ты + Я', sub: 'против всего мира' });
  assert.deepEqual(cardinfo.titleParts('Легенда об Аанге – Последний маг'), { lead: 'Легенда об Аанге', sub: 'Последний маг' });
  assert.deepEqual(cardinfo.titleParts('Человек-паук: Новый день'), { lead: 'Человек-паук', sub: 'Новый день' });
});

test('titleParts: без разделителя и у короткого названия — null (работает фолбэк)', () => {
  /* Замер по живым данным TMDB (у самой функции): разделителя нет примерно
     у половины длинных названий — вот они. */
  assert.equal(cardinfo.titleParts('Закон и порядок. Специальный корпус'), null);
  assert.equal(cardinfo.titleParts('Очень позднее шоу с Джеймсом Корденом'), null);
  /* Короткое помещается в строку целиком — разносить его по двум уровням
     значило бы добавить карточке высоты там, где проблемы нет. */
  assert.equal(cardinfo.titleParts('Дюна: часть 2'), null);
  assert.equal(cardinfo.titleParts(''), null);
  assert.equal(cardinfo.titleParts(null), null);
});

test('titleParts: пустая часть разделителем не считается', () => {
  assert.equal(cardinfo.titleParts(': Империя наносит ответный удар'), null);
  assert.equal(cardinfo.titleParts('Империя наносит ответный удар:'), null);
});

/* Ф3 п.3 (ревью фикс-раундов): двоеточие внутри имени франшизы. Названия —
   живые ответы TMDB 2026-09-23 (разбор выборки — у самой функции). */
test('titleParts: двоеточие без пробела после — часть имени, не разделитель', () => {
  assert.deepEqual(
    cardinfo.titleParts('Re:ZERO – Жизнь с нуля в альтернативном мире'),
    { lead: 'Re:ZERO', sub: 'Жизнь с нуля в альтернативном мире' }
  );
  assert.equal(cardinfo.titleParts('Re:ZERO -Starting Life in Another World-'), null);
});

test('titleParts: у одного слова перед двоеточием тире дальше — разделитель', () => {
  assert.deepEqual(cardinfo.titleParts('Mission: Impossible - Fallout'), { lead: 'Mission: Impossible', sub: 'Fallout' });
  assert.deepEqual(
    cardinfo.titleParts('Mission: Impossible - Dead Reckoning Part One'),
    { lead: 'Mission: Impossible', sub: 'Dead Reckoning Part One' }
  );
  /* Два слова перед двоеточием — это и есть имя франшизы, тире дальше
     остаётся во второй строке. */
  assert.deepEqual(
    cardinfo.titleParts('Star Wars: Episode II - Attack of the Clones'),
    { lead: 'Star Wars', sub: 'Episode II - Attack of the Clones' }
  );
  /* Одно слово перед двоеточием и тире дальше нет — режем по двоеточию. */
  assert.deepEqual(cardinfo.titleParts('Thor: Love and Thunder'), { lead: 'Thor', sub: 'Love and Thunder' });
});

test('titleParts: слово и слово (номер не в счёт) не разносятся по уровням', () => {
  assert.equal(cardinfo.titleParts('Mission: Impossible'), null);
  assert.equal(cardinfo.titleParts('Mission: Impossible III'), null);
  /* Цена правила — та же форма у честного подзаголовка: он уходит в
     фолбэк длинного названия. */
  assert.equal(cardinfo.titleParts('Матрица: Перезагрузка'), null);
  /* Номер перед двоеточием словом не считается — «007» не одно слово. */
  assert.deepEqual(cardinfo.titleParts('007: Квант милосердия'), { lead: '007', sub: 'Квант милосердия' });
  assert.deepEqual(cardinfo.titleParts('Терминатор 2: Судный день'), { lead: 'Терминатор 2', sub: 'Судный день' });
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

/* Ревью Task 5c (п.4): cardinfo без Lampa — строки и склонение передаются
   параметром (в рантайме их собирает LC.header из LC.STRINGS). */
const util = load('10_util.js');
const RU = {
  next: 'Следующая серия', today: 'сегодня', tomorrow: 'завтра', inDays: 'через',
  months: ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'],
  daysWord: (n) => util.plural(n, ['день', 'дня', 'дней'])
};
const RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const sd = cardinfo.shortDate;
const shortRu = (ymd) => sd(ymd, RU_SHORT);
const AT = new Date(2026, 10, 16, 12, 0);

test('nextEpisode: английские строки из параметра words', () => {
  const EN = {
    next: 'Next episode', today: 'today', tomorrow: 'tomorrow', inDays: 'in',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    daysWord: (n) => (n === 1 ? 'day' : 'days')
  };
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-17' }, AT, EN).text, 'Next episode — 17 December, in 31 days');
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-11-17' }, AT, EN).text, 'Next episode — tomorrow');
});

test('nextEpisode/shortDate: без строк или с неполным списком месяцев -> null / ""', () => {
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-17' }, AT), null);
  assert.equal(sd('2026-12-17'), '');
  assert.equal(sd('2026-12-17', ['янв']), '');
});

test('nextEpisode: дата через 31 день -> дата в родительном падеже, склонение «день»', () => {
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-12-17', episode_number: 1 }, NOW, RU), {
    date: '17 декабря',
    days: 31,
    /* Правка 2026-09-23 (п.2.3): when — та же строка без ведущего
       «Следующая серия — ». В чипе статуса она стоит подписью под словом
       «Онгоинг», и повторять там про серии незачем. */
    when: '17 декабря, через 31 день',
    text: 'Следующая серия — 17 декабря, через 31 день'
  });
});

test('nextEpisode: склонения «дня»/«дней» через LC.util.plural', () => {
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-08' }, NOW, RU).text, 'Следующая серия — 8 декабря, через 22 дня');
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-12-11' }, NOW, RU).text, 'Следующая серия — 11 декабря, через 25 дней');
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-11-27' }, NOW, RU).text, 'Следующая серия — 27 ноября, через 11 дней');
});

test('nextEpisode: сегодня и завтра — словом, без «через N»', () => {
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-11-16' }, NOW, RU), {
    date: '16 ноября', days: 0, when: 'сегодня', text: 'Следующая серия — сегодня'
  });
  assert.deepEqual(cardinfo.nextEpisode({ air_date: '2026-11-17' }, new Date(2026, 10, 16, 0, 5), RU), {
    date: '17 ноября', days: 1, when: 'завтра', text: 'Следующая серия — завтра'
  });
});

test('nextEpisode: дата в прошлом или нет данных -> null', () => {
  assert.equal(cardinfo.nextEpisode({ air_date: '2026-11-15' }, NOW, RU), null);
  assert.equal(cardinfo.nextEpisode(null, NOW, RU), null);
  assert.equal(cardinfo.nextEpisode(undefined, NOW, RU), null);
  assert.equal(cardinfo.nextEpisode({}, NOW, RU), null);
  assert.equal(cardinfo.nextEpisode({ air_date: '' }, NOW, RU), null);
  assert.equal(cardinfo.nextEpisode({ air_date: 'скоро' }, NOW, RU), null);
});

test('shortDate: «17 дек» для серии, которая не вышла; май — «мая»; пусто/мусор -> ""', () => {
  assert.equal(shortRu('2026-12-17'), '17 дек');
  assert.equal(shortRu('2026-05-03'), '3 мая');
  assert.equal(shortRu('2026-01-09'), '9 янв');
  assert.equal(shortRu(''), '');
  assert.equal(shortRu(null), '');
  assert.equal(shortRu('2026-13-01'), '');
});

/* -------------------------------------------------------------------- */
/* Task 5d: таблица «ПОДРОБНО» (design-spec §10, экран 07)                */
/* -------------------------------------------------------------------- */

/* Как и nextEpisode, facts не знает ни про Lampa, ни про язык интерфейса:
   подписи, названия месяцев, склонения и capitalize приходят параметром
   (в рантайме их собирает LC.header из LC.STRINGS). */
const FACTS_RU = {
  original: 'Оригинал', premiere: 'Премьера', creator: 'Создатель', budget: 'Бюджет',
  months: RU.months,
  capitalize: (s) => s.charAt(0).toUpperCase() + s.slice(1)
};

const DUNE = {
  title: 'Дюна: Часть вторая',
  original_title: 'Dune: Part Two',
  release_date: '2024-02-29',
  runtime: 166,
  budget: 190000000,
  genres: [{ name: 'фантастика' }, { name: 'приключения' }],
  production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }]
};
const CREW = { crew: [{ job: 'Producer', name: 'Мэри Пэрент' }, { job: 'Director', name: 'Дени Вильнёв' }] };

/* Task 59 (фаза 5): «эти дублирования абсолютно не нужны» (интервью
   2026-09-21). Страна, режиссёр, жанр и хронометраж слово в слово стоят в
   мета-строке шапки (renderMeta, src/85_header.js) — из таблицы они ушли.
   Осталось то, чего в мете нет: оригинальное название, полная дата
   премьеры (в мете только год), создатель сериала (в мете у сериала стоит
   студия) и бюджет фильма. */
test('Task 59: фильм — оригинал, премьера и бюджет; мета-строка не повторяется', () => {
  assert.deepEqual(cardinfo.facts(DUNE, FACTS_RU), [
    { label: 'Оригинал', value: 'Dune: Part Two' },
    { label: 'Премьера', value: '29 февраля 2024' },
    { label: 'Бюджет', value: '$ 190 000 000' }
  ]);
});

test('facts: оригинал совпадает с названием -> строки нет', () => {
  const same = cardinfo.facts({ title: 'Аватар', original_title: 'Аватар', release_date: '2009-12-17' }, FACTS_RU);
  assert.deepEqual(same.map((f) => f.label), ['Премьера']);
});

/* Бюджет Lampa показывала в своём .full-descr__details (app.min.js:38018),
   а мы этот блок скрываем (src/30_css.js) — значит строка в таблице и есть
   его единственное место. Нулевой бюджет TMDB отдаёт у всего, чего не
   знает, — такую строку не выводим, как и сама Lampa (app.min.js:38072). */
test('Task 59: бюджет — только когда он есть; у сериала его не бывает', () => {
  const noBudget = cardinfo.facts({ title: 'Фильм', release_date: '2024-01-01', budget: 0 }, FACTS_RU);
  assert.deepEqual(noBudget.map((f) => f.label), ['Премьера']);
  const serial = cardinfo.facts({ name: 'Шоу', first_air_date: '2024-01-01', budget: 5000000 }, FACTS_RU);
  assert.deepEqual(serial.map((f) => f.label), ['Премьера'], 'у сериала бюджета нет — строки тоже');
});

test('Task 59: сериал — создатель остаётся (в мете у сериала студия, не он)', () => {
  const fallout = {
    name: 'Фоллаут', original_name: 'Fallout', first_air_date: '2024-04-10',
    number_of_seasons: 2, number_of_episodes: 16,
    created_by: [{ name: 'Джонатан Нолан' }],
    genres: [{ name: 'фантастика' }],
    production_countries: [{ iso_3166_1: 'US' }]
  };
  assert.deepEqual(cardinfo.facts(fallout, FACTS_RU), [
    { label: 'Оригинал', value: 'Fallout' },
    { label: 'Премьера', value: '10 апреля 2024' },
    { label: 'Создатель', value: 'Джонатан Нолан' }
  ]);
});

test('facts: пустые значения не выводятся; пустой movie и отсутствие words -> []', () => {
  assert.deepEqual(cardinfo.facts({}, FACTS_RU), []);
  assert.deepEqual(cardinfo.facts(null, FACTS_RU), []);
  assert.deepEqual(cardinfo.facts(DUNE), []);
});

test('facts: дата без дня/месяца -> только год; мусор в дате -> строки нет', () => {
  const yearOnly = cardinfo.facts({ title: 'Фильм', release_date: '2024' }, FACTS_RU);
  assert.deepEqual(yearOnly, [{ label: 'Премьера', value: '2024' }]);
  assert.deepEqual(cardinfo.facts({ title: 'Фильм', release_date: 'скоро' }, FACTS_RU), []);
  assert.deepEqual(cardinfo.facts({ title: 'Фильм', release_date: '2024-13-01' }, FACTS_RU), [{ label: 'Премьера', value: '2024' }]);
});

test('facts: дата у границы суток не съезжает на соседний день (без часового пояса)', () => {
  const late = cardinfo.facts({ title: 'Фильм', release_date: '2024-01-01' }, FACTS_RU);
  assert.equal(late[0].value, '1 января 2024');
});

test('network: networks[0].name, иначе первая студия production_companies, иначе ""', () => {
  assert.equal(cardinfo.network({ networks: [{ name: 'Prime Video' }, { name: 'HBO' }] }), 'Prime Video');
  assert.equal(cardinfo.network({ networks: [], production_companies: [{ name: 'Kilter Films' }] }), 'Kilter Films');
  assert.equal(cardinfo.network({ networks: [{}] }), '');
  assert.equal(cardinfo.network({}), '');
  assert.equal(cardinfo.network(null), '');
});

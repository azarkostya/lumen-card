import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const cardinfo = load('35_cardinfo.js');

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

test('qualityChips: без дублей', () => {
  assert.deepEqual(cardinfo.qualityChips('4K 4K'), ['4K']);
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { load } from './_load.mjs';

const M = load('63_cardmenu.js');

/* Строки интерфейса приходят параметром (модуль про язык не знает), как у
   LC.badges и LC.header. */
const W = {
  section: 'Lumen Card',
  trailer: 'Трейлер',
  franchise: 'Вся франшиза',
  similar: 'Похожие',
  watched: 'Отметить просмотренным',
  unwatched: 'Снять отметку о просмотре',
  hide: 'Скрыть из рекомендаций',
  unhide: 'Вернуть в рекомендации'
};

const kinds = (items) => items.map((i) => i.lumen);

const MOVIE = { id: 693134, title: 'Дюна: Часть вторая', original_title: 'Dune: Part Two', release_date: '2024-02-27' };
const TV = { id: 82856, name: 'Мандалорец', original_name: 'The Mandalorian', first_air_date: '2019-11-12' };

/* Штатное меню карточки Lampa 3.3.4 (app.min.js, CardMap.Favorite.drawMenu):
   заголовок title_action, четыре чекбокса book/like/wath/history. */
const nativeItems = () => ([
  { title: 'В закладки', where: 'book', checkbox: true, checked: false },
  { title: 'Нравится', where: 'like', checkbox: true, checked: false },
  { title: 'Смотреть позже', where: 'wath', checkbox: true, checked: false },
  { title: 'История', where: 'history', checkbox: true, checked: true }
]);

/* ---------------------------------------------------------------------- */
/* Распознавание штатного меню карточки.                                   */
/* ---------------------------------------------------------------------- */

test('isCardMenu: штатное меню карточки — заголовок «Действие» и чекбокс «в закладки»', () => {
  assert.equal(M.isCardMenu({ title: 'Действие', items: nativeItems() }, 'Действие'), true);
});

test('isCardMenu: заголовок не сверяется, если его не передали (язык ещё не поднялся)', () => {
  assert.equal(M.isCardMenu({ title: 'Action', items: nativeItems() }, ''), true);
  assert.equal(M.isCardMenu({ title: 'Action', items: nativeItems() }, 'Действие'), false);
});

test('isCardMenu: меню файла и раздачи TorrServer — не карточка', () => {
  const torrent = [
    { title: 'Сбросить время', timeclear: true },
    { title: 'Отметить просмотренным', timefull: true }
  ];
  assert.equal(M.isCardMenu({ title: 'Действие', items: torrent }, 'Действие'), false);
});

test('isCardMenu: мусор и уже расширенное меню — нет', () => {
  assert.equal(M.isCardMenu(null, 'Действие'), false);
  assert.equal(M.isCardMenu({ title: 'Действие' }, 'Действие'), false);
  assert.equal(M.isCardMenu({ title: 'Действие', items: [] }, 'Действие'), false);
  assert.equal(M.isCardMenu({ title: 'Источник', items: nativeItems() }, 'Действие'), false);
  const twice = nativeItems().concat([{ title: 'Похожие', lumen: 'similar' }]);
  assert.equal(M.isCardMenu({ title: 'Действие', items: twice }, 'Действие'), false);
});

/* ---------------------------------------------------------------------- */
/* Состав наших пунктов.                                                   */
/* ---------------------------------------------------------------------- */

test('extraItems: фильм без известной коллекции', () => {
  const items = M.extraItems(MOVIE, { words: W });
  assert.deepEqual(kinds(items), ['trailer', 'similar', 'watched', 'hide']);
  assert.equal(items[0].title, W.trailer);
  assert.equal(items[2].title, W.watched);
  assert.equal(items[3].title, W.hide);
});

test('extraItems: известная коллекция добавляет «Вся франшиза» с её названием', () => {
  const items = M.extraItems(MOVIE, { words: W, collection: { id: 726871, name: 'Дюна — Коллекция' } });
  assert.deepEqual(kinds(items), ['trailer', 'franchise', 'similar', 'watched', 'hide']);
  assert.equal(items[1].title, W.franchise);
  assert.equal(items[1].subtitle, 'Дюна — Коллекция');
});

test('extraItems: коллекция без id не считается известной', () => {
  const items = M.extraItems(MOVIE, { words: W, collection: { name: 'ничто' } });
  assert.equal(kinds(items).indexOf('franchise'), -1);
});

test('extraItems: сериал — без отметки просмотра (Lampa держит её по сериям)', () => {
  const items = M.extraItems(TV, { words: W });
  assert.deepEqual(kinds(items), ['trailer', 'similar', 'hide']);
});

test('extraItems: состояние отметки и скрытия меняет пункт на обратный', () => {
  const items = M.extraItems(MOVIE, { words: W, watched: true, thrown: true });
  assert.deepEqual(kinds(items), ['trailer', 'similar', 'unwatched', 'unhide']);
  assert.equal(items[2].title, W.unwatched);
  assert.equal(items[3].title, W.unhide);
});

test('extraItems: у каждого пункта есть непустой заголовок и вид, разделителей нет', () => {
  const items = M.extraItems(MOVIE, { words: W, collection: { id: 1, name: 'c' } });
  items.forEach((i) => {
    assert.equal(typeof i.title, 'string');
    assert.ok(i.title.length > 0);
    assert.ok(i.lumen);
    assert.equal(i.separator, undefined);
    assert.equal(i.checkbox, undefined);
  });
});

test('extraItems: без карточки и без словаря — пустой список, не исключение', () => {
  assert.deepEqual(M.extraItems(null, { words: W }), []);
  assert.deepEqual(M.extraItems(MOVIE, null), []);
});

/* ---------------------------------------------------------------------- */
/* Данные действий.                                                        */
/* ---------------------------------------------------------------------- */

test('mediaOf: сериал по name/first_air_date, иначе фильм', () => {
  assert.equal(M.mediaOf(TV), 'tv');
  assert.equal(M.mediaOf({ id: 1, first_air_date: '2020-01-01' }), 'tv');
  assert.equal(M.mediaOf(MOVIE), 'movie');
  assert.equal(M.mediaOf(null), 'movie');
});

/* Ролики берёт штатный Lampa.Api.sources.tmdb.videos: он сам спрашивает их на
   языке интерфейса и вторым запросом на английском, склеивает и кэширует на
   неделю. Наше дело — только пара {method, id}. */
test('videosParams: медиа и id для штатного запроса роликов', () => {
  assert.deepEqual(M.videosParams(MOVIE), { method: 'movie', id: 693134 });
  assert.deepEqual(M.videosParams(TV), { method: 'tv', id: 82856 });
  assert.equal(M.videosParams(null), null);
  assert.equal(M.videosParams({ title: 'без id' }), null);
});

test('similarTarget: активность штатной сетки «Похожие»', () => {
  const t = M.similarTarget(MOVIE);
  assert.equal(t.url, 'movie/693134/similar');
  assert.equal(t.component, 'category_full');
  assert.equal(t.source, 'tmdb');
  assert.equal(t.page, 1);
  assert.equal(t.title, 'Дюна: Часть вторая');
  assert.equal(M.similarTarget(TV).url, 'tv/82856/similar');
  assert.equal(M.similarTarget(null), null);
});

test('watchKey: ключ прогресса — тот же, что считает Lampa для фильма', () => {
  assert.equal(M.watchKey(MOVIE), 'Dune: Part Two');
  assert.equal(M.watchKey({ title: 'Только русское' }), 'Только русское');
  assert.equal(M.watchKey({ original_name: 'Serial', name: 'Сериал' }), 'Serial');
  assert.equal(M.watchKey({}), '');
  assert.equal(M.watchKey(null), '');
});

/* ---------------------------------------------------------------------- */
/* Экспорт модуля.                                                         */
/* ---------------------------------------------------------------------- */

test('гард экспорта: без метки lumen чужой module.exports не трогаем', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/63_cardmenu.js', import.meta.url), 'utf8');
  const LC = { util: load('10_util.js') };
  const mod = { exports: 'host' };
  new Function('LC', 'module', src)(LC, mod);
  assert.equal(mod.exports, 'host');
});

test('рантайм-часть на месте и при загрузке ни Lampa, ни document не трогает', () => {
  ['install', 'uninstall', 'open', 'active'].forEach((name) => {
    assert.equal(typeof M[name], 'function', name);
  });
  assert.equal(M.active(), false);
});

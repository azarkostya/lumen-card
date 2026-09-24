import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load, loadCtx } from './_load.mjs';

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

/* ---------------------------------------------------------------------- */
/* Проверка на ТВ 2026-09-24: трейлер из меню (долгое OK -> «Трейлер»)      */
/* запускался и тогда, когда пользователь уже ушёл с экрана: запрос роликов */
/* на телевизоре идёт секундами, а колбэк ни о чём не спрашивал.            */
/* ---------------------------------------------------------------------- */

globalThis.warn = globalThis.warn || function () { };

/* Заглушки — как у настоящей Lampa 3.3.4: Activity.active() отдаёт запись
   стека (app.min.js:45889-45891, activites[activites.length - 1]),
   Player.opened() — флаг открытого плеера (:31149), классы
   settings--open/menu--open на body ставят настройки и левое меню
   (:10306, :9789), selectbox--open и search--open — список выбора и поиск
   (:7084, :41514); модальное окно и YouTube Lampa — узлы .modal и
   .youtube-player в body (:32415, :53324). tmdb.videos(params, cb)
   отвечает колбэком позже. */
function trailerEnv() {
  const activities = [{ component: 'main' }];
  const bodyClasses = [];
  const nodes = [];
  const played = [];
  const notes = [];
  const calls = [];
  let playerOpen = false;
  const clock = { now: 1000000 };
  const Lampa = {
    Activity: { active: () => activities[activities.length - 1] },
    Player: { play: (item) => { played.push(item); }, opened: () => playerOpen },
    Platform: { is: () => false },
    Storage: { field: () => 'inner' },
    Noty: { show: (t) => notes.push(t) },
    Api: { sources: { tmdb: { videos: (params, cb) => { calls.push({ params, cb }); } } } }
  };
  globalThis.window = { Lampa };
  globalThis.Lampa = Lampa;
  globalThis.document = {
    body: { classList: { contains: (c) => bodyClasses.indexOf(c) !== -1 } },
    querySelector: (sel) => (sel.split(',').some((s) => nodes.indexOf(s.trim()) !== -1) ? {} : null)
  };
  const realNow = Date.now;
  Date.now = () => clock.now;
  const { api } = loadCtx('63_cardmenu.js', {
    lang: (k) => k,
    pref: (n, d) => d,
    trailer: { pickTrailer: (list) => (list && list[0] && list[0].key ? list[0] : null) }
  });
  return {
    api, activities, bodyClasses, nodes, played, notes, calls, clock,
    setPlayer: (v) => { playerOpen = v; },
    answer: (i) => calls[i].cb({ results: [{ key: 'K' + i, name: 'Трейлер' }] }),
    restore: () => { Date.now = realNow; delete globalThis.window; delete globalThis.Lampa; delete globalThis.document; }
  };
}

test('трейлер из меню: ответ пришёл на том же экране — играет (контроль)', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.clock.now += 2000;
    env.answer(0);
    assert.equal(env.played.length, 1);
    assert.equal(env.played[0].id, 'K0');
  } finally { env.restore(); }
});

test('трейлер из меню: пользователь ушёл на другой экран — не играет и молчит', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.activities.push({ component: 'full' });
    env.answer(0);
    assert.equal(env.played.length, 0);
    assert.deepEqual(env.notes, [], 'и «трейлера нет» не показываем');
  } finally { env.restore(); }
});

test('трейлер из меню: плеер уже открыт — не играет', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.setPlayer(true);
    env.answer(0);
    assert.equal(env.played.length, 0);
  } finally { env.restore(); }
});

test('трейлер из меню: открыты настройки или левое меню — не играет', () => {
  for (const cls of ['settings--open', 'menu--open']) {
    const env = trailerEnv();
    try {
      env.api.playTrailer(MOVIE);
      env.bodyClasses.push(cls);
      env.answer(0);
      assert.equal(env.played.length, 0, cls);
    } finally { env.restore(); }
  }
});

/* Ревью волны 1b, п.4: «что открыто поверх» у меню спрашивалось своим
   набором (настройки и левое меню), у автотрейлера героя — другим
   (LC.util.overlayOpen). Наборы разошлись: под поиском, списком выбора,
   модальным окном или YouTube Lampa трейлер из меню стартовал. Теперь —
   тот же LC.util.playerOpen/overlayOpen плюс левое меню. */
test('трейлер из меню: открыт поиск, список выбора, модальное окно или YouTube Lampa — не играет и молчит', () => {
  const cases = {
    'поиск': (env) => env.bodyClasses.push('search--open'),
    'список выбора': (env) => env.bodyClasses.push('selectbox--open'),
    'модальное окно': (env) => env.nodes.push('.modal'),
    'YouTube Lampa': (env) => env.nodes.push('.youtube-player')
  };
  for (const name of Object.keys(cases)) {
    for (const late of [false, true]) {
      const env = trailerEnv();
      try {
        env.api.playTrailer(MOVIE);
        if (late) env.clock.now += 9000;
        cases[name](env);
        env.answer(0);
        assert.equal(env.played.length, 0, name + (late ? ' (опоздал)' : ''));
        assert.deepEqual(env.notes, [], name + (late ? ' (опоздал)' : ''));
      } finally { env.restore(); }
    }
  }
});

test('трейлер из меню: ответ дольше 8 с — не играет', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.clock.now += 8001;
    env.answer(0);
    assert.equal(env.played.length, 0);
  } finally { env.restore(); }
});

/* Ревью «Волны 1», п.4: человек выбрал «Трейлер» и ждёт на том же экране,
   а ответ пришёл на 9-й секунде — прежде была тишина, как будто пункт не
   сработал. Опоздал ТОЛЬКО ответ — говорим об этом, один раз.
   Ревью волны 1b, п.3: не «Трейлер не найден» — это неправда, ролик мог
   и найтись. Своя строка: «не успел загрузиться — попробуйте ещё раз». */
test('трейлер из меню: ответ дольше 8 с на том же экране — не играет, но сообщает об опоздании, ровно один раз', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.clock.now += 9000;
    env.answer(0);
    assert.equal(env.played.length, 0);
    assert.deepEqual(env.notes, ['lumen_menu_trailer_late']);
    env.answer(0);
    assert.deepEqual(env.notes, ['lumen_menu_trailer_late'], 'повторный колбэк молчит');
  } finally { env.restore(); }
});

test('трейлер из меню: строка опоздания — на трёх языках и не «не найден»', () => {
  const LC = {};
  const src = readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, { exports: null, lumen: true });
  assert.deepEqual(LC.STRINGS.lumen_menu_trailer_late, {
    ru: 'Трейлер не успел загрузиться — попробуйте ещё раз',
    en: 'The trailer took too long to load — try again',
    uk: 'Трейлер не встиг завантажитися — спробуйте ще раз'
  });
  assert.equal(LC.STRINGS.lumen_menu_no_trailer.ru, 'Трейлер не найден', '«не найден» остаётся для ответа без роликов');
});

/* «Роликов нет» и «опоздал» — разные строки: ответ вовремя и пустой —
   по-прежнему «Трейлер не найден». */
test('трейлер из меню: ответ вовремя, но без роликов — «Трейлер не найден»', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.calls[0].cb({ results: [] });
    assert.deepEqual(env.notes, ['lumen_menu_no_trailer']);
  } finally { env.restore(); }
});

test('трейлер из меню: опоздал и ушли / открыт плеер / оверлей / новый выбор — молчит', () => {
  const cases = {
    'другой экран': (env) => env.activities.push({ component: 'full' }),
    'плеер': (env) => env.setPlayer(true),
    'настройки': (env) => env.bodyClasses.push('settings--open'),
    'левое меню': (env) => env.bodyClasses.push('menu--open')
  };
  for (const name of Object.keys(cases)) {
    const env = trailerEnv();
    try {
      env.api.playTrailer(MOVIE);
      env.clock.now += 9000;
      cases[name](env);
      env.answer(0);
      assert.equal(env.played.length, 0, name);
      assert.deepEqual(env.notes, [], name);
    } finally { env.restore(); }
  }
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.api.playTrailer(MOVIE);
    env.clock.now += 9000;
    env.answer(0);
    assert.deepEqual(env.notes, [], 'устаревший запрос');
  } finally { env.restore(); }
});

test('трейлер из меню: двойной выбор — играет только последний запрос и ровно один раз', () => {
  const env = trailerEnv();
  try {
    env.api.playTrailer(MOVIE);
    env.api.playTrailer(MOVIE);
    env.answer(0);
    assert.equal(env.played.length, 0, 'устаревший запрос не играет');
    env.answer(1);
    assert.equal(env.played.length, 1);
    env.answer(1);
    assert.equal(env.played.length, 1, 'повторный колбэк того же запроса ничего не делает');
  } finally { env.restore(); }
});

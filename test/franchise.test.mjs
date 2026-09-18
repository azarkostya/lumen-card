import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery } from './_fakedom.mjs';
import { load } from './_load.mjs';

/* Task 28 (фаза 3): ряд «Смотреть по порядку» в блоке описания карточки.

   Чистая часть (orderParts/markWatched/nextToWatch) проверяется без
   окружения; рендер и жизненный цикл запроса — на том же фейковом DOM и
   фейковой Lampa, что в test/reviews.test.mjs: ряд франшизы живёт в том же
   .full-descr и по тем же правилам (поколение, снятие запроса, проверка
   «карточка на экране»). */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const F = load('66_franchise.js');

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

const DUNE_PARTS = [
  { id: 438631, title: 'Дюна', release_date: '2021-09-15', vote_average: 7.8, poster_path: '/d1.jpg' },
  { id: 693134, title: 'Дюна: Часть вторая', release_date: '2024-02-27', vote_average: 8.2, poster_path: '/d2.jpg' },
  { id: 1059811, title: 'Дюна: Часть третья', release_date: '2028-12-18', vote_average: 0, poster_path: '/d3.jpg' },
  { id: 999999, title: 'Дюна: без даты', release_date: '', vote_average: 6.1, poster_path: '/d4.jpg' }
];

const TODAY = new Date(2026, 8, 17);

test('orderParts: chronology — по дате премьеры, без даты в конец, вход не мутируется', () => {
  const before = JSON.stringify(DUNE_PARTS);
  const list = F.orderParts(DUNE_PARTS, 'chronology', TODAY);
  assert.deepEqual(list.map((x) => x.id), [438631, 693134, 1059811, 999999]);
  assert.equal(JSON.stringify(DUNE_PARTS), before, 'исходный массив TMDB не трогаем — он лежит в кэше Lampa');
  assert.equal(list[0].card, DUNE_PARTS[0], 'карточка для Activity.push — исходный объект части');
});

test('orderParts: release — вышедшие по дате, невышедшие в конец с пометкой upcoming', () => {
  const list = F.orderParts(DUNE_PARTS, 'release', TODAY);
  assert.deepEqual(list.map((x) => x.id), [438631, 693134, 999999, 1059811]);
  assert.deepEqual(list.map((x) => !!x.upcoming), [false, false, false, true]);
});

/* Живая проверка 2026-09-17: в порядке «по рейтингу» анонс получал пометку
   «Дальше» — смотреть его негде. Пометка «ещё не вышла» обязана ставиться во
   всех порядках, в конец списка её переносит только 'release'. */
test('orderParts: невышедшая часть помечена upcoming в любом порядке', () => {
  const rating = F.orderParts(DUNE_PARTS, 'rating', TODAY);
  const chrono = F.orderParts(DUNE_PARTS, 'chronology', TODAY);
  assert.equal(rating.filter((x) => x.upcoming).map((x) => x.id).join(), '1059811');
  assert.equal(chrono.filter((x) => x.upcoming).map((x) => x.id).join(), '1059811');
  /* В порядке «по рейтингу» за «Дюной» (7.8) идёт часть без даты (6.1), а
     анонс с нулевой оценкой — последним: «Дальше» достаётся вышедшей. */
  assert.equal(F.nextToWatch(F.markWatched(rating, { percent: () => 0, currentId: 438631 })).id, 999999);
  /* А если непросмотренным остался только анонс — «Дальше» нет вовсе. */
  assert.equal(F.nextToWatch(F.markWatched(rating, {
    percent: (item) => (item.id === 1059811 ? 0 : 100),
    currentId: 693134
  })), null);
});

test('orderParts: rating — по убыванию оценки, при равной оценке порядок исходный', () => {
  const same = [
    { id: 1, title: 'a', release_date: '2001-01-01', vote_average: 7 },
    { id: 2, title: 'b', release_date: '2002-01-01', vote_average: 9 },
    { id: 3, title: 'c', release_date: '2003-01-01', vote_average: 7 }
  ];
  assert.deepEqual(F.orderParts(same, 'rating', TODAY).map((x) => x.id), [2, 1, 3]);
});

test('orderParts: незнакомый режим считается как release; мусор на входе — пустой список', () => {
  assert.deepEqual(F.orderParts(DUNE_PARTS, 'какой-то', TODAY).map((x) => x.id), F.orderParts(DUNE_PARTS, 'release', TODAY).map((x) => x.id));
  assert.deepEqual(F.orderParts(null, 'release', TODAY), []);
  assert.deepEqual(F.orderParts([null, undefined, {}], 'release', TODAY).map((x) => x.id), [undefined]);
});

test('orderParts: год и постер берутся из части, номер — позиция в выбранном порядке', () => {
  const list = F.orderParts(DUNE_PARTS, 'release', TODAY);
  assert.equal(list[0].year, '2021');
  assert.equal(list[0].poster, '/d1.jpg');
  assert.deepEqual(list.map((x) => x.num), [1, 2, 3, 4]);
});

test('markWatched: percent >= 95 — просмотрено, открытый фильм — current', () => {
  const list = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), {
    percent: function (item) { return item.id === 438631 ? 96 : 12; },
    currentId: 693134
  });
  assert.deepEqual(list.map((x) => !!x.watched), [true, false, false, false]);
  assert.deepEqual(list.map((x) => !!x.current), [false, true, false, false]);
});

test('markWatched: без контекста ничего не помечает и не падает', () => {
  const list = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), null);
  assert.deepEqual(list.map((x) => !!x.watched), [false, false, false, false]);
  assert.deepEqual(list.map((x) => !!x.current), [false, false, false, false]);
});

test('nextToWatch: первый непросмотренный ПОСЛЕ текущего', () => {
  const list = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), {
    percent: function (item) { return (item.id === 438631 || item.id === 693134) ? 99 : 0; },
    currentId: 693134
  });
  const next = F.nextToWatch(list);
  assert.equal(next.id, 999999);
  assert.equal(next.next, true, 'пометка «Дальше» ставится на самом элементе');
});

test('nextToWatch: после текущего всё просмотрено — null; текущего нет — первый непросмотренный', () => {
  const all = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), {
    percent: function () { return 100; },
    currentId: 438631
  });
  assert.equal(F.nextToWatch(all), null);

  const none = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), {
    percent: function (item) { return item.id === 438631 ? 100 : 0; },
    currentId: 0
  });
  assert.equal(F.nextToWatch(none).id, 693134);
});

test('nextToWatch: невышедшая часть «Дальше» не становится', () => {
  const list = F.markWatched(F.orderParts(DUNE_PARTS, 'release', TODAY), {
    percent: function (item) { return item.id === 1059811 ? 0 : 100; },
    currentId: 438631
  });
  assert.equal(F.nextToWatch(list), null, 'осталась только невышедшая — смотреть нечего');
});

test('orderFor: режим из хранилища, незнакомое значение — release', () => {
  assert.equal(F.orderFor('rating'), 'rating');
  assert.equal(F.orderFor('release'), 'release');
  assert.equal(F.orderFor('chronology'), 'chronology');
  assert.equal(F.orderFor(''), 'release');
  assert.equal(F.orderFor('мусор'), 'release');
});

/* ====================================================================== */
/* Рендер и ресурсы                                                       */
/* ====================================================================== */

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function $(x) {
  if (x instanceof FakeEl) return x;
  if (typeof x === 'string' && x.charAt(0) === '<') return fakeQuery(x);
  return { length: 0, each() { return this; }, find() { return { length: 0 }; } };
}

function freshEnv(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const store = Object.assign({ language: 'ru' }, opts.store || {});
  const requests = [];
  const pushed = [];
  const collected = [];
  const Lampa = {
    Storage: {
      get: (name, def) => (Object.prototype.hasOwnProperty.call(store, name) && store[name] !== '' ? store[name] : def),
      set: (name, value) => { store[name] = value; },
      field: (name) => store[name]
    },
    Api: {
      img: (path, size) => 'https://img/t/p/' + size + path,
      sources: {
        tmdb: {
          get(url, params, ok, err, o) {
            const req = { url: url, params: params, ok: ok, err: err, opts: o, cleared: 0 };
            requests.push(req);
            return { clear() { req.cleared++; } };
          }
        }
      }
    },
    TMDB: { image: (u) => 'https://img/' + u },
    Activity: { push: (o) => pushed.push(o) },
    Controller: {
      enabled: () => ({ name: opts.controller || 'full_descr' }),
      collectionAppend: (nodes) => collected.push(nodes)
    },
    Timeline: { view: (hash) => ({ percent: (opts.percents || {})[hash] || 0 }) },
    Utils: { hash: (s) => 'h:' + s }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
  globalThis.Lampa = Lampa;
  globalThis.$ = $;

  const LC = {};
  const module = { exports: null, lumen: false };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '35_cardinfo.js');
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '81_prefs.js');
  loadInto(LC, module, '66_franchise.js');
  LC.slideshow = {
    isMounted: () => (opts.mounted === false ? false : true),
    isLayerForeground: () => (opts.foreground === false ? false : true)
  };
  return { LC, store, requests, pushed, collected, Lampa };
}

function makeDescrRow() {
  const text = new FakeEl(['full-descr__text', 'selector']);
  const left = new FakeEl(['full-descr__left'], [text]);
  const descr = new FakeEl(['full-descr'], [left, new FakeEl(['lumen-facts'])]);
  const body = new FakeEl(['items-line__body'], [descr]);
  const row = new FakeEl(['items-line'], [body]);
  return { row, descr };
}

function blocksOf(d) { return d.descr._children.filter((n) => n.hasClass('lumen-fr')); }

const DATA = {
  movie: {
    id: 693134,
    title: 'Дюна: Часть вторая',
    original_title: 'Dune: Part Two',
    belongs_to_collection: { id: 726871, name: 'Дюна (Коллекция)' }
  }
};

const COLLECTION_OK = { id: 726871, name: 'Дюна (Коллекция)', parts: DUNE_PARTS };

test('render: запрос коллекции с недельным кэшем, скелетон до ответа, ряд после', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);

  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, 'collection/726871');
  assert.equal(env.requests[0].opts.life, 10080);
  assert.equal(blocksOf(d).length, 1, 'скелетон — тот же класс .lumen-fr, что и ряд');
  assert.equal(blocksOf(d)[0].hasClass('lumen-fr--sk'), true);

  env.requests[0].ok(COLLECTION_OK);
  const block = blocksOf(d)[0];
  assert.equal(block.hasClass('lumen-fr--sk'), false, 'скелетон снят');
  const html = block.html();
  assert.ok(html.indexOf('data-lumen-fr="0"') >= 0, 'карточки частей нарисованы');
  assert.ok(html.indexOf('lumen-fr-card--current') >= 0, '«Вы здесь» на открытом фильме');
  /* Task 39: размер — по фактической ширине карточки части (7.90em), то есть
     180 физических пикселей на экране 1920: w185, а не прежний зашитый w300. */
  assert.ok(html.indexOf('https://img/t/p/w185/d1.jpg') >= 0, 'постеры через прокси TMDB Lampa');
  assert.equal(d.row.hasClass('lumen-descr-row--franchise'), true);
  assert.deepEqual(warnLog, []);

});

/* Task 39: на вдвое более плотном экране та же карточка части — 360
   физических пикселей вместо 180, и постер берётся на ступень крупнее. */
test('Task 39: постер части выбирается по физическим пикселям', () => {
  const env = freshEnv();
  globalThis.window.devicePixelRatio = 2;
  try {
    const d = makeDescrRow();
    env.LC.franchise.render(d.row, DATA);
    env.requests[0].ok(COLLECTION_OK);
    assert.ok(blocksOf(d)[0].html().indexOf('https://img/t/p/w342/d1.jpg') >= 0);
  } finally {
    delete globalThis.window.devicePixelRatio;
  }
});

/* Живая проверка 2026-09-17: инструментирование сломало
   Lampa.Api.sources.tmdb.get, запроса не случилось — и скелетон висел на
   карточке до ухода с неё. Колбэков в этом случае не будет никогда, поэтому
   плашки снимаются сразу. */
test('render: запрос не удалось отправить — скелетон снимается сразу', () => {
  const env = freshEnv();
  env.Lampa.Api.sources.tmdb.get = function () { throw new Error('tmdb broken'); };
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  assert.equal(blocksOf(d).length, 0, 'ни ряда, ни висящих плашек');

  const env2 = freshEnv();
  delete env2.Lampa.Api.sources.tmdb.get;
  const d2 = makeDescrRow();
  env2.LC.franchise.render(d2.row, DATA);
  assert.equal(blocksOf(d2).length, 0, 'сборка Lampa без tmdb-источника — то же самое');
});

test('render: фильм без коллекции — ни блока, ни запроса', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, { movie: { id: 1, title: 'Одиночка' } });
  assert.equal(env.requests.length, 0);
  assert.equal(blocksOf(d).length, 0);
  assert.deepEqual(warnLog, []);
});

test('render: повторный вызов с теми же данными не шлёт второго запроса и не дублирует блок', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok(COLLECTION_OK);
  env.LC.franchise.render(d.row, DATA);
  assert.equal(env.requests.length, 1);
  assert.equal(blocksOf(d).length, 1);
});

test('render: коллекция из одной части — ряд не рисуется (смотреть по порядку нечего)', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok({ id: 726871, name: 'Дюна', parts: [DUNE_PARTS[0]] });
  assert.equal(blocksOf(d).length, 0);
  assert.equal(d.row.hasClass('lumen-descr-row--franchise'), false);
});

test('render: ответ, догнавший уже смененную карточку, не рисуется', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  const late = env.requests[0];
  env.LC.franchise.clearRow(d.row);
  late.ok(COLLECTION_OK);
  assert.equal(blocksOf(d).length, 0);
});

test('render: ответ карточки из истории не уходит в навигацию текущей', () => {
  const env = freshEnv({ foreground: false });
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok(COLLECTION_OK);
  assert.equal(env.collected.length, 0, 'collectionAppend для фоновой карточки не зовётся');
});

test('render: новые .selector отдаются контроллеру, только когда активен full_descr', () => {
  const env = freshEnv({ controller: 'full_start' });
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok(COLLECTION_OK);
  assert.equal(env.collected.length, 0);

  const env2 = freshEnv();
  const d2 = makeDescrRow();
  env2.LC.franchise.render(d2.row, DATA);
  env2.requests[0].ok(COLLECTION_OK);
  assert.equal(env2.collected.length, 1);
});

test('clearRow и cancel снимают блок и незавершённый запрос', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.LC.franchise.clearRow(d.row);
  assert.equal(env.requests[0].cleared, 1, 'запрос снят');
  assert.equal(blocksOf(d).length, 0);
  assert.equal(d.row.hasClass('lumen-descr-row--franchise'), false);

  const env2 = freshEnv();
  const d2 = makeDescrRow();
  env2.LC.franchise.render(d2.row, DATA);
  const body = new FakeEl(['activity__body'], [d2.descr]);
  env2.LC.franchise.cancel(body);
  assert.equal(env2.requests[0].cleared, 1);
});

test('cancel: карточка без нашего рендера — тихо, без warn и без состояния', () => {
  const env = freshEnv();
  const body = new FakeEl(['activity__body'], [new FakeEl(['full-descr'])]);
  env.LC.franchise.cancel(body);
  env.LC.franchise.cancel(null);
  assert.deepEqual(warnLog, []);
});

test('порядок: чип «По рейтингу» пишет режим в Storage без события и перерисовывает ряд из тех же данных', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok(COLLECTION_OK);
  const block = blocksOf(d)[0];

  const listener = (block._listeners || []).filter((l) => l.type === 'hover:enter')[0];
  assert.ok(listener, 'делегирование hover:enter на корне блока');
  const chip = new FakeEl(['lumen-fr__mode']);
  chip.attr('data-lumen-fr-order', 'rating');
  chip._parentEl = block;
  listener.fn({ target: chip });

  assert.equal(env.store.lumen_franchise_order, 'rating');
  assert.equal(env.requests.length, 1, 'данные коллекции уже на руках — второго запроса нет');
  assert.ok(blocksOf(d)[0].html().indexOf('lumen-fr__mode--on') >= 0);
});

test('OK по части открывает её карточку штатным Activity.push', () => {
  const env = freshEnv();
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, DATA);
  env.requests[0].ok(COLLECTION_OK);
  const block = blocksOf(d)[0];
  const listener = (block._listeners || []).filter((l) => l.type === 'hover:enter')[0];

  const card = new FakeEl(['lumen-fr-card']);
  card.attr('data-lumen-fr', '0');
  card._parentEl = block;
  listener.fn({ target: card });

  assert.equal(env.pushed.length, 1);
  assert.equal(env.pushed[0].component, 'full');
  assert.equal(env.pushed[0].id, 438631);
  assert.equal(env.pushed[0].method, 'movie');
  assert.equal(env.pushed[0].card.id, 438631);
  assert.equal(env.pushed[0].source, 'tmdb');
});

test('просмотренное берётся из Lampa.Timeline по хэшу оригинального названия', () => {
  const env = freshEnv({ percents: { 'h:Dune': 97 } });
  const d = makeDescrRow();
  env.LC.franchise.render(d.row, {
    movie: { id: 693134, title: 'Дюна: Часть вторая', belongs_to_collection: { id: 726871, name: 'Дюна' } }
  });
  env.requests[0].ok({
    id: 726871,
    parts: [
      { id: 438631, title: 'Дюна', original_title: 'Dune', release_date: '2021-09-15' },
      { id: 693134, title: 'Дюна: Часть вторая', original_title: 'Dune: Part Two', release_date: '2024-02-27' }
    ]
  });
  const html = blocksOf(d)[0].html();
  assert.ok(html.indexOf('lumen-fr-card--watched') >= 0, 'первая часть отмечена просмотренной');
});

test('render: чужая разметка ряда и пустые аргументы — тихо, без warn', () => {
  const env = freshEnv();
  env.LC.franchise.render(new FakeEl(['items-line']), DATA);
  env.LC.franchise.render(null, DATA);
  env.LC.franchise.render(makeDescrRow().row, null);
  assert.equal(env.requests.length, 0);
  assert.deepEqual(warnLog, []);
});

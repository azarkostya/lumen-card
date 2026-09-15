import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, fakeQuery } from './_fakedom.mjs';

/* Task 5c (ревью качества, п.2): связующий код ряда серий в src/85_header.js
   на фейковом DOM. 85_header.js зовёт функции верхнего уровня других файлов
   общей IIFE (tmdbImageFn/apiImgFn/clearInlineStyleIfEmpty из 50_backdrops.js),
   поэтому модули грузятся склейкой в ОДНУ область видимости — как у
   scripts/build.mjs. Проверки идут через публичные LC.header.decorate и
   LC.header.refreshEpisode; слушатели capture на корне вызываются вручную. */

globalThis.PLUGIN = 'lumen_card';
const warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push(msg + (err ? ': ' + (err && err.message) : '')); };

/* Настоящая формула Lampa.Utils.hash (API_NOTES_3 §3) — data-hash сверяется
   с живым значением S2E3 «Fallout» = 908552078. */
function lampaHash(input) {
  const str = (input || '') + '';
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) - h) + str.charCodeAt(i); h = h & h; }
  return Math.abs(h) + '';
}

const views = {};
const docRoots = [];

function walk(el, fn) { fn(el); el._children.forEach((c) => walk(c, fn)); }

/* Мини-$: HTML-строка -> FakeEl, FakeEl -> он же, селектор -> все узлы
   документа (docRoots) с классами последнего простого селектора. */
function $(x) {
  if (x instanceof FakeEl) return x;
  if (typeof x === 'string' && x.charAt(0) === '<') return fakeQuery(x);
  const parts = String(x).trim().split(/\s+/);
  const classes = parts[parts.length - 1].split('.').filter(Boolean);
  const found = [];
  docRoots.forEach((r) => walk(r, (el) => { if (classes.every((c) => el.hasClass(c))) found.push(el); }));
  return { length: found.length, each(fn) { found.forEach((el, i) => fn.call(el, i, el)); return this; } };
}

const Lampa = {
  Storage: { get: (name, def) => def },
  Utils: { hash: lampaHash },
  Timeline: { view: (h) => views[h] || { percent: 0, time: 0, duration: 0 } },
  TMDB: { image: (url) => 'https://img.test/' + url }
};
globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
globalThis.Lampa = Lampa;
globalThis.$ = $;

function loadLC() {
  const LC = {};
  const module = { exports: null, lumen: false };
  const names = ['10_util.js', '35_cardinfo.js', '50_backdrops.js', '70_progress.js', '80_settings.js', '85_header.js'];
  const src = names.map((n) => readFileSync(new URL(`../src/${n}`, import.meta.url), 'utf8')).join('\n');
  new Function('LC', 'module', src)(LC, module);
  return LC;
}

const LC = loadLC();

/* Долг ревью Task 5c (п.4): размер окна кадров тест берёт из самой константы
   модуля, а не повторяет числом — иначе подбор окна (величина, за которую
   отвечает 85_header.js) ломал бы тест, ничего не сломав в поведении. */
const STILL_WINDOW = parseInt(/STILL_WINDOW\s*=\s*(\d+)/.exec(readFileSync(new URL('../src/85_header.js', import.meta.url), 'utf8'))[1], 10);

const RU_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const RU_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function dateIn(days) { const d = new Date(); d.setDate(d.getDate() + days); return d; }
function ymd(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
function hashOf(s, e) { return lampaHash([s, s > 10 ? ':' : '', e, 'Fallout'].join('')); }

/* Разметка карточки в объёме, который трогают рендеры Task 5c (шаблон
   src/40_template.js): лента рейтингов с чипом, боковая колонка со статусом,
   кнопки, ряд серий. */
function makeCard() {
  const text = new FakeEl(['lumen-next-chip__text']);
  const chip = new FakeEl(['lumen-next-chip', 'hide'], [text]);
  const rate = new FakeEl(['full-start__rate', 'rate--tmdb']);
  const rateLine = new FakeEl(['full-start-new__rate-line'], [rate, chip]);
  const status = new FakeEl(['full-start__status']);
  const side = new FakeEl(['lumen-side'], [status]);
  const play = new FakeEl(['full-start__button', 'selector', 'button--play']);
  const book = new FakeEl(['full-start__button', 'selector', 'button--book']);
  const buttons = new FakeEl(['full-start-new__buttons'], [play, book]);
  const title = new FakeEl(['lumen-episodes__title']);
  const count = new FakeEl(['lumen-episodes__count']);
  const head = new FakeEl(['lumen-episodes__head'], [title, count]);
  const track = new FakeEl(['lumen-episodes__track']);
  const viewport = new FakeEl(['lumen-episodes__viewport'], [track]);
  viewport.getBoundingClientRect = () => ({ left: 64 });
  const row = new FakeEl(['lumen-episodes', 'hide'], [head, viewport]);
  const root = new FakeEl(['full-start-new', 'lumen-card'], [rateLine, side, buttons, row]);
  docRoots.push(root);
  return { root, chip, text, rateLine, status, side, play, book, buttons, row, track, title, count };
}

function serial(n) {
  const episodes = [];
  for (let i = 1; i <= n; i++) {
    episodes.push({ season_number: 2, episode_number: i, name: 'Серия ' + i, air_date: '2025-12-16', runtime: 50 + i, still_path: '/s' + i + '.jpg' });
  }
  return { movie: { name: 'Фоллаут', original_name: 'Fallout', number_of_seasons: 2 }, episodes: { season_number: 2, episodes: episodes } };
}

/* Геометрия дорожки: карточка 340 + зазор 16, viewport с x = 64, экран 1920. */
function layout(track) {
  track._children.forEach((n, i) => { n.offsetLeft = i * 356; n.offsetWidth = 340; });
  track.scrollWidth = track._children.length * 356 - 16;
}

function fire(root, type, target) {
  (root._listeners || []).filter((l) => l.type === type).forEach((l) => l.fn({ type: type, target: target }));
}

function stillOf(node) { return node.find('.lumen-episode__still').css('background-image'); }

/* ------------------------------ renderEpisodes ------------------------------ */

test('renderEpisodes: data-hash по формуле плана 0.2, data-index — индекс в episodes[], заголовок и число серий', () => {
  const c = makeCard();
  const data = serial(8);
  data.episodes.episodes.splice(3, 0, { season_number: 2, name: 'без номера' });
  LC.header.decorate(c.root, data);

  assert.equal(c.row.hasClass('hide'), false);
  assert.equal(c.track._children.length, 8, 'серия без episode_number пропущена');
  assert.equal(c.track._children[2].attr('data-hash'), '908552078');
  assert.equal(c.track._children[2].attr('data-index'), '2');
  assert.equal(c.track._children[3].attr('data-index'), '4', 'после пропуска индекс указывает в исходный массив');
  assert.ok(c.track._children[0].hasClass('selector'));
  assert.equal(c.title.text(), 'Сезон 2');
  assert.equal(c.count.text(), '8 серий');
  assert.deepEqual(warnLog, []);
});

test('renderEpisodes: фильм и сериал без episodes — ряд скрыт, дорожка пуста', () => {
  const film = makeCard();
  LC.header.decorate(film.root, { movie: { title: 'Дюна', original_title: 'Dune: Part Two', release_date: '2024-02-27' }, episodes: serial(3).episodes });
  assert.ok(film.row.hasClass('hide'));
  assert.equal(film.track._children.length, 0);

  const bare = makeCard();
  LC.header.decorate(bare.root, { movie: serial(1).movie });
  assert.ok(bare.row.hasClass('hide'));
  assert.equal(bare.track._children.length, 0);
});

test('renderEpisodes: повторный decorate с тем же списком (build + complite) не пересобирает ряд', () => {
  const c = makeCard();
  const data = serial(5);
  LC.header.decorate(c.root, data);
  const first = c.track._children[0];
  const sets = first._htmlSets;
  LC.header.decorate(c.root, data);
  assert.equal(c.track._children[0], first, 'узлы те же');
  assert.equal(c.track._children.length, 5);
  assert.equal(first._htmlSets, sets);
});

/* Долг ревью Task 5c (п.2): сверка «тот же список» только по ссылке на массив
   пропускала мутацию на месте — Lampa дописывает вышедшую серию/переименовывает
   её в том же e.data.episodes.episodes[], и ряд оставался старым. */
test('renderEpisodes: мутация того же массива серий (дописали серию, сдвинули дату) перерисовывает ряд', () => {
  const c = makeCard();
  const data = serial(5);
  LC.header.decorate(c.root, data);
  assert.equal(c.track._children.length, 5);

  const list = data.episodes.episodes;
  list.push({ season_number: 2, episode_number: 6, name: 'Серия 6', air_date: '2025-12-23', runtime: 56, still_path: '/s6.jpg' });
  LC.header.decorate(c.root, data);
  assert.equal(c.track._children.length, 6, 'тот же массив, но список изменился — ряд пересобран');
  assert.equal(c.count.text(), '6 серий');

  list[5].air_date = '2025-12-30';
  LC.header.decorate(c.root, data);
  assert.equal(c.track._children.length, 6);
  assert.deepEqual(warnLog, []);
});

test('renderEpisodes: состояния и подписи — просмотрена / смотрите · осталось / вышла / не вышла', () => {
  const c = makeCard();
  const data = serial(4);
  const soon = dateIn(40);
  data.episodes.episodes[2].air_date = ymd(soon);
  views[hashOf(2, 1)] = { percent: 100, time: 3060, duration: 3060 };
  views[hashOf(2, 2)] = { percent: 32, time: 1120, duration: 3492 };
  try {
    LC.header.decorate(c.root, data);
  } finally {
    delete views[hashOf(2, 1)];
    delete views[hashOf(2, 2)];
  }
  const [e1, e2, e3, e4] = c.track._children;
  assert.ok(e1.hasClass('lumen-episode--watched'));
  assert.ok(e1.html().indexOf('51 мин · просмотрена') !== -1);
  assert.ok(e1.html().indexOf('lumen-episode__check') !== -1);
  assert.ok(e2.hasClass('lumen-episode--watching'));
  assert.ok(e2.html().indexOf('смотрите · осталось 39 мин') !== -1);
  assert.ok(e2.html().indexOf('32 %') !== -1);
  assert.ok(e3.hasClass('lumen-episode--soon'));
  assert.ok(e3.html().indexOf(soon.getDate() + ' ' + RU_SHORT[soon.getMonth()] + ' · не вышла') !== -1);
  assert.ok(e4.hasClass('lumen-episode--aired'));
  assert.ok(e4.html().indexOf('54 мин') !== -1);
});

/* ------------------------------ кадры окном (п.3, п.6) ------------------------------ */

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

test('кадры: при отрисовке — только окно ±STILL_WINDOW от первой и от текущей серии, по фокусу — окно вокруг неё', () => {
  const c = makeCard();
  const data = serial(30);
  views[hashOf(2, 20)] = { percent: 40, time: 1000, duration: 3000 };
  try {
    LC.header.decorate(c.root, data);
  } finally {
    delete views[hashOf(2, 20)];
  }
  const W = STILL_WINDOW;
  const loaded = () => c.track._children.map((n, i) => (stillOf(n) ? i : -1)).filter((i) => i >= 0);
  assert.deepEqual(loaded(), range(0, W).concat(range(19 - W, 19 + W)));
  assert.ok(c.track._children.every((n) => n.attr('data-still')), 'URL есть у всех карточек в data-still');

  /* Долг ревью Task 5c (п.1): по фокусу кадры не только добавляются — всё, что
     дальше ±2×STILL_WINDOW от фокуса, снимается (окно 0..W от отрисовки уходит). */
  layout(c.track);
  fire(c.root, 'hover:focus', c.track._children[28]);
  assert.deepEqual(loaded(), range(28 - 2 * W, 29));
});

test('кадры: проход фокусом по всему сезону не копит кадры — держится окно ±2×STILL_WINDOW', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(30));
  layout(c.track);

  const count = () => c.track._children.filter((n) => stillOf(n)).length;
  const ceiling = 4 * STILL_WINDOW + 1;
  let peak = 0;
  for (let i = 0; i < 30; i++) {
    fire(c.root, 'hover:focus', c.track._children[i]);
    peak = Math.max(peak, count());
  }
  assert.ok(peak <= ceiling, 'одновременно загруженных кадров ' + peak + ', потолок ' + ceiling);
  assert.ok(count() < 30, 'после прохода по сезону кадры остались у всех серий');
  assert.deepEqual(warnLog, []);
});

test('кадры: background-image через css с url("…") и экранированием " и \\, не инлайном в html', () => {
  const c = makeCard();
  const data = serial(1);
  data.episodes.episodes[0].still_path = '/a"b\\c.jpg';
  LC.header.decorate(c.root, data);
  const e1 = c.track._children[0];
  assert.equal(stillOf(e1), 'url("https://img.test/t/p/w300/a\\"b\\\\c.jpg")');
  assert.equal(e1.html().indexOf('background-image'), -1);
});

/* ------------------------------ scrollToEpisode (п.1) ------------------------------ */

test('scrollToEpisode: сдвиг к фокусной карточке, границы 0..max, возврат на E1 не оставляет style=""', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(8));
  layout(c.track);
  assert.equal(c.track.getAttribute('style'), null, 'после отрисовки у дорожки нет атрибута style');

  fire(c.root, 'hover:focus', c.track._children[3]);
  assert.equal(c.track.getAttribute('style'), null, 'E4 целиком на экране — сдвига нет');

  fire(c.root, 'hover:focus', c.track._children[4]);
  assert.equal(c.track.lumenShift, 78);
  assert.equal(c.track.css('transform'), 'translate3d(-78px,0,0)');

  fire(c.root, 'hover:focus', c.track._children[7]);
  assert.equal(c.track.lumenShift, 976, 'сдвиг не больше ширины дорожки минус видимая часть');

  fire(c.root, 'hover:focus', c.track._children[0]);
  assert.equal(c.track.lumenShift, 0);
  assert.equal(c.track.getAttribute('style'), null, 'пустой style="" снят');
});

/* ------------------------------ bindEpisodes (п.2, п.5) ------------------------------ */

test('bindEpisodes: повторный decorate не удваивает слушатели; фокус на серии — компакт, на кнопке — снят', () => {
  const c = makeCard();
  const data = serial(3);
  LC.header.decorate(c.root, data);
  LC.header.decorate(c.root, data);
  assert.equal(c.root._listeners.length, 2);
  assert.ok(c.root._listeners.every((l) => l.capture), 'слушатели в фазе перехвата');

  fire(c.root, 'hover:focus', c.track._children[1]);
  assert.ok(c.root.hasClass('lumen-compact'));
  fire(c.root, 'hover:focus', c.book);
  assert.equal(c.root.hasClass('lumen-compact'), false);
});

test('bindEpisodes: OK -> «Смотреть» только с карточки серии и только если «Смотреть» не скрыта', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(3));

  fire(c.root, 'hover:enter', c.book);
  assert.equal(c.play._triggered, undefined, 'OK на кнопке не трогаем');

  fire(c.root, 'hover:enter', c.track._children[0]);
  assert.deepEqual(c.play._triggered, ['hover:enter']);

  c.play.addClass('hide');
  fire(c.root, 'hover:enter', c.track._children[0]);
  assert.deepEqual(c.play._triggered, ['hover:enter'], 'нет источников — ничего не делаем');
});

/* ------------------------------ renderSerialMode / renderNextChip ------------------------------ */

test('renderSerialMode: статус переносится в ленту перед чипом один раз; у фильма остаётся в правой колонке', () => {
  const c = makeCard();
  const data = serial(2);
  LC.header.decorate(c.root, data);
  LC.header.decorate(c.root, data);
  assert.ok(c.root.hasClass('lumen-card--serial'));
  assert.deepEqual(c.rateLine._children.map((n) => n._class[0]), ['full-start__rate', 'full-start__status', 'lumen-next-chip']);
  assert.equal(c.side._children.length, 0);

  const f = makeCard();
  LC.header.decorate(f.root, { movie: { title: 'Дюна', original_title: 'Dune: Part Two', release_date: '2024-02-27' } });
  assert.equal(f.root.hasClass('lumen-card--serial'), false);
  assert.equal(f.status.parent(), f.side);
});

test('renderNextChip: текст из LC.STRINGS со склонением; скрыт без next_episode_to_air и у фильма', () => {
  const c = makeCard();
  const data = serial(1);
  const next = dateIn(31);
  data.movie.next_episode_to_air = { air_date: ymd(next) };
  LC.header.decorate(c.root, data);
  assert.equal(c.chip.hasClass('hide'), false);
  assert.equal(c.text.text(), 'Следующая серия — ' + next.getDate() + ' ' + RU_GEN[next.getMonth()] + ', через 31 день');

  const none = makeCard();
  LC.header.decorate(none.root, serial(1));
  assert.ok(none.chip.hasClass('hide'));

  const film = makeCard();
  LC.header.decorate(film.root, { movie: { title: 'Дюна', release_date: '2024-02-27', next_episode_to_air: { air_date: ymd(next) } } });
  assert.ok(film.chip.hasClass('hide'));
});

test('LC.daysWord: склонения на славянских языках', () => {
  assert.equal(LC.daysWord(31), 'день');
  assert.equal(LC.daysWord(22), 'дня');
  assert.equal(LC.daysWord(25), 'дней');
});

/* ------------------------------ Task 5d: таблица «ПОДРОБНО» ------------------------------ */

/* Ряд описания Lampa (компонент 'description'): items_line, внутри
   .items-line__body -> .full-descr -> .full-descr__left (текст, details, теги).
   e.item.render() отдаёт именно узел items_line — его и получает LC.header.descr. */
function makeDescrRow() {
  const text = new FakeEl(['full-descr__text', 'selector']);
  const details = new FakeEl(['full-descr__details']);
  const tags = new FakeEl(['full-descr__tags']);
  const left = new FakeEl(['full-descr__left'], [text, details, tags]);
  const descr = new FakeEl(['full-descr'], [left]);
  const body = new FakeEl(['items-line__body'], [descr]);
  const row = new FakeEl(['items-line'], [body]);
  docRoots.push(row);
  return { row, descr, left, text };
}

function factsOf(d) { return d.descr._children.filter((n) => n.hasClass('lumen-facts')); }

const DUNE = {
  movie: {
    title: 'Дюна: Часть вторая', original_title: 'Dune: Part Two', release_date: '2024-02-29',
    runtime: 166, genres: [{ name: 'фантастика' }, { name: 'приключения' }],
    production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }]
  },
  persons: { crew: [{ job: 'Director', name: 'Дени Вильнёв' }] }
};

test('descr: таблица «ПОДРОБНО» дописывается в тело ряда, ряд помечен .lumen-descr-row', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, DUNE);

  assert.ok(d.row.hasClass('lumen-descr-row'), 'ряд помечен нашим классом — иначе CSS не применится');
  const facts = factsOf(d);
  assert.equal(facts.length, 1);
  const html = facts[0].html();
  for (const part of ['ПОДРОБНО', 'Оригинал', 'Dune: Part Two', 'Премьера', '29 февраля 2024', 'Страна', 'США',
    'Режиссёр', 'Дени Вильнёв', 'Жанр', 'Фантастика, Приключения', 'Время', '2:46']) {
    assert.ok(html.indexOf(part) !== -1, 'нет строки таблицы: ' + part);
  }
  assert.equal(html.indexOf('selector'), -1, 'таблица не участвует в навигации пультом');
  assert.deepEqual(warnLog, []);
});

test('descr: повторный build/открытие карточки не дублирует таблицу', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, DUNE);
  LC.header.descr(d.row, DUNE);
  LC.header.descr(d.row, DUNE);
  assert.equal(factsOf(d).length, 1);
});

test('descr: сериал — создатель и «сезонов · серий»', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, {
    movie: {
      name: 'Фоллаут', original_name: 'Fallout', first_air_date: '2024-04-10',
      number_of_seasons: 2, number_of_episodes: 16, created_by: [{ name: 'Джонатан Нолан' }],
      genres: [{ name: 'фантастика' }], production_countries: [{ iso_3166_1: 'US' }]
    }
  });
  const html = factsOf(d)[0].html();
  assert.ok(html.indexOf('Создатель') !== -1 && html.indexOf('Джонатан Нолан') !== -1);
  assert.ok(html.indexOf('2 сезона · 16 серий') !== -1);
  assert.equal(html.indexOf('Режиссёр'), -1, 'у сериала режиссёра в таблице нет');
});

test('descr: нечего показать или чужая разметка ряда — тихо без таблицы и без warn', () => {
  const empty = makeDescrRow();
  LC.header.descr(empty.row, { movie: {} });
  assert.equal(factsOf(empty).length, 0);

  const alien = new FakeEl(['items-line'], [new FakeEl(['items-line__body'])]);
  LC.header.descr(alien, DUNE);

  LC.header.descr(null, DUNE);
  assert.deepEqual(warnLog, []);
});

/* ------------------------------ refreshEpisode (п.2, п.8) ------------------------------ */

test('refreshEpisode: перерисовывает только серию с этим хэшем и только при изменении состояния; кадр сохраняется', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(8));
  const e3 = c.track._children[2];
  const e4 = c.track._children[3];
  const sets3 = e3._htmlSets;
  const sets4 = e4._htmlSets;

  LC.header.refreshEpisode('908552078');
  assert.equal(e3._htmlSets, sets3, 'состояние не изменилось — innerHTML не трогаем');

  views['908552078'] = { percent: 32, time: 1056, duration: 3300 };
  try {
    LC.header.refreshEpisode('908552078');
    assert.ok(e3.hasClass('lumen-episode--watching'));
    assert.equal(e3._htmlSets, sets3 + 1);
    assert.equal(e4._htmlSets, sets4, 'соседняя серия не перерисована');
    assert.ok(stillOf(e3), 'кадр в окне переустановлен после перерисовки');

    LC.header.refreshEpisode('908552078');
    assert.equal(e3._htmlSets, sets3 + 1, 'повтор того же состояния — без перерисовки');
  } finally {
    delete views['908552078'];
  }

  LC.header.refreshEpisode('abc');
  LC.header.refreshEpisode(null);
  assert.deepEqual(warnLog, []);
});

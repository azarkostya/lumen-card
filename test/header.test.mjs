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
  /* Словарь самой Lampa: подпись роли режиссёра в объединённой ленте людей
     берётся оттуда (title_producer), своих строк правка не заводит. */
  Lang: { translate: (key) => (key === 'title_producer' ? 'Режиссер' : key) },
  Timeline: { view: (h) => views[h] || { percent: 0, time: 0, duration: 0 } },
  TMDB: { image: (url) => 'https://img.test/' + url }
};
globalThis.window = { Lampa: Lampa, innerWidth: 1920 };
globalThis.Lampa = Lampa;
globalThis.$ = $;

function loadLC() {
  const LC = {};
  const module = { exports: null, lumen: false };
  /* Task 25: 62_badges.js — от него renderNextChip берёт обратный отсчёт до
     премьеры фильма (у сериала в том же чипе живёт следующая серия). */
  /* Task 67: 30_css.js — источник метрики плитки ряда серий (LC.episodeEm);
     по ней 85_header.js считает окно узлов и распорку дорожки. На верхнем
     уровне модуль только объявляет функции и константы (ни Lampa, ни $ он
     при загрузке не трогает), поэтому грузится рядом с остальными. */
  /* Task 68: 11_focus.js — общий механизм подписки на фокус (LC.focus),
     им bindEpisodes вешает обработчик на оба события Lampa. */
  /* Долг фазы 1, п.4 (2026-09-23): 51_slideshow.js — настоящая проверка
     «карточка на экране» для пересбора коллекции ряда серий; тест задаёт
     состояние (активность вокруг корня), а не ответ функции. */
  const names = ['10_util.js', '11_focus.js', '30_css.js', '35_cardinfo.js', '50_backdrops.js', '51_slideshow.js', '62_badges.js', '70_progress.js', '80_settings.js', '81_prefs.js', '85_header.js'];
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
  /* Правка 2026-09-16 (п.1): боковой колонки больше нет — статус стоит прямо
     в ленте рейтингов, перед чипом следующей серии. */
  const status = new FakeEl(['full-start__status']);
  const rateLine = new FakeEl(['full-start-new__rate-line'], [rate, status, chip]);
  const play = new FakeEl(['full-start__button', 'selector', 'button--play']);
  const book = new FakeEl(['full-start__button', 'selector', 'button--book']);
  const buttons = new FakeEl(['full-start-new__buttons'], [play, book]);
  /* Task 8: блок «Продолжить» из шаблона — подпись, полоса, таймкод. */
  const pLabel = new FakeEl(['lumen-progress__label']);
  /* Узел заливки — голый <div> без класса: так он стоит в шаблоне
     (src/40_template.js), и src/85_header.js ищет его селектором
     '.lumen-progress__bar > div'. Тег назван, чтобы фейковый DOM его нашёл. */
  const pFill = new FakeEl([], null, 'div');
  const pBar = new FakeEl(['lumen-progress__bar'], [pFill]);
  const pTime = new FakeEl(['lumen-progress__time']);
  const progress = new FakeEl(['lumen-in', 'lumen-progress', 'hide'], [pLabel, pBar, pTime]);
  const title = new FakeEl(['lumen-episodes__title']);
  const count = new FakeEl(['lumen-episodes__count']);
  const head = new FakeEl(['lumen-episodes__head'], [title, count]);
  const track = new FakeEl(['lumen-episodes__track']);
  const viewport = new FakeEl(['lumen-episodes__viewport'], [track]);
  viewport.getBoundingClientRect = () => ({ left: 64 });
  const row = new FakeEl(['lumen-episodes', 'hide'], [head, viewport]);
  /* Правка 2026-09-23 (п.2.1): заголовок карточки — узел из шаблона
     (src/40_template.js), текст в него кладёт Lampa, а плагин переписывает
     его двумя уровнями, когда в названии есть разделитель. */
  const cardTitle = new FakeEl(['full-start-new__title']);
  /* Мета-строка карточки: узел из шаблона (src/40_template.js), содержимое
     собирает renderMeta. */
  const meta = new FakeEl(['lumen-meta']);
  const root = new FakeEl(['full-start-new', 'lumen-card'], [cardTitle, meta, rateLine, progress, buttons, row]);
  docRoots.push(root);
  return { root, chip, text, rateLine, status, play, book, buttons, row, track, viewport, title, count, progress, pLabel, pTime, pFill, cardTitle, meta };
}

function serial(n) {
  const episodes = [];
  for (let i = 1; i <= n; i++) {
    episodes.push({ season_number: 2, episode_number: i, name: 'Серия ' + i, air_date: '2025-12-16', runtime: 50 + i, still_path: '/s' + i + '.jpg' });
  }
  return { movie: { name: 'Фоллаут', original_name: 'Fallout', number_of_seasons: 2 }, episodes: { season_number: 2, episodes: episodes } };
}

/* Геометрия дорожки: карточка 340 + зазор 16, viewport с x = 64, экран 1920.
   Task 67: позиция плитки считается от её МЕСТА В СЕЗОНЕ (lumenPos), а не от
   номера в дорожке — за краем окна узлов нет, и их место держит распорка.
   total — длина всего сезона: ширина дорожки не зависит от размера окна.
   Ревью 2026-09-22 (М2): последний зазор из scrollWidth больше не
   вычитается. Замер на стенде 960×540@2: у короткого сезона (9 плиток,
   распорок нет) scrollWidth дорожки равен offsetLeft последней плитки
   плюс её ширина И её margin-right — 1601 px при 1423 + 170 + 7.98, — а
   у «Дораэмона» (окно 25 плиток, padding-right 19038 px) scrollWidth
   равен clientWidth, то есть распорка в него тоже входит. Дорожка —
   absolute с overflow:visible, её ширина shrink-to-fit и считается по
   содержимому вместе с паддингом, поэтому модель здесь — ровно
   total × шаг. */
function layout(track, total) {
  track._children.forEach((n, i) => {
    const pos = typeof n.lumenPos === 'number' ? n.lumenPos : i;
    n.offsetLeft = pos * 356;
    n.offsetWidth = 340;
  });
  track.scrollWidth = (total || track._children.length) * 356;
}

/* Task 67: узел серии по её месту в сезоне — или null, если он сейчас за
   окном. Пульт ходит по тому, что есть в DOM, поэтому «дыра» в проходе по
   сезону — это как раз null там, где фокус обязан был найти соседа. */
function nodeAt(c, pos) {
  return c.track._children.filter((n) => n.lumenPos === pos)[0] || null;
}

/* Шаг пульта вправо: пересчитать геометрию (новые узлы её не имеют) и отдать
   плитке фокус так же, как это делает Lampa — hover:focus в фазе перехвата. */
function stepTo(c, pos, total) {
  const node = nodeAt(c, pos);
  if (!node) return null;
  layout(c.track, total);
  fire(c.root, 'hover:focus', node);
  return node;
}

/* Половина окна узлов — та же формула, что в src/85_header.js (episodeHalf):
   плиток в ширину экрана плюс запас в окно кадров с каждой стороны. Тест
   повторяет её сознательно: он сторожит РАЗМЕР окна, и расхождение формулы
   с этим ожиданием должно быть видно. */
function halfWindow() {
  const step = LC.util.emPx(LC.episodeEm.width + LC.episodeEm.gap);
  return Math.ceil(LC.util.screenPx() / step) + STILL_WINDOW;
}

function fire(root, type, target) {
  (root._listeners || []).filter((l) => l.type === type).forEach((l) => l.fn({ type: type, target: target }));
}

function stillOf(node) { return node.find('.lumen-episode__still').css('background-image'); }

/* ------------------------------ renderEpisodes ------------------------------ */

/* Task 67: хэш и место серии в массиве Lampa живут в описании её места в
   сезоне (lumenEpisodes.eps), а не в атрибутах узла — узла за окном может и
   не быть. Формула хэша (план 0.2) сверяется с живым значением S2E3
   «Fallout» = 908552078 по-прежнему. */
test('renderEpisodes: хэш по формуле плана 0.2, index — место в episodes[], заголовок и число серий', () => {
  const c = makeCard();
  const data = serial(8);
  data.episodes.episodes.splice(3, 0, { season_number: 2, name: 'без номера' });
  LC.header.decorate(c.root, data);

  const eps = c.row.lumenEpisodes.eps;
  assert.equal(c.row.hasClass('hide'), false);
  assert.equal(c.track._children.length, 8, 'серия без episode_number пропущена');
  assert.equal(eps[2].hash, '908552078');
  assert.equal(eps[2].index, 2);
  assert.equal(eps[3].index, 4, 'после пропуска индекс указывает в исходный массив');
  assert.equal(c.track._children[2].getAttribute('data-hash'), null, 'в разметке плитки хэша нет');
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

  /* Ревью Task 5d (Minor 3): сезон входит в подпись — новый сезон в том же
     массиве пересобирает ряд, а не оставляет серии прошлого. */
  const before = c.track._children[0];
  list[0].season_number = 3;
  LC.header.decorate(c.root, data);
  assert.notEqual(c.track._children[0], before, 'сменился сезон — ряд пересобран');
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

/* Task 67: номера серий, у которых сейчас стоит кадр — по месту в сезоне
   (lumenPos), а не по номеру в дорожке: за окном узлов нет вовсе. */
const loadedPos = (c) => c.track._children.filter((n) => stillOf(n)).map((n) => n.lumenPos).sort((a, b) => a - b);

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
  /* Task 67: «смотрят» — 20-я серия (место 19); она попала в первое окно
     узлов, поэтому кадры вокруг неё ставятся. Справа окно кадров упирается
     в край окна узлов: дальше плиток ещё нет. */
  const to = c.row.lumenEpisodes.to;
  assert.deepEqual(loadedPos(c), range(0, W).concat(range(19 - W, Math.min(19 + W, to))));
  assert.ok(c.track._children.every((n) => n.attr('data-still')), 'URL есть у всех карточек в data-still');

  /* Долг ревью Task 5c (п.1): по фокусу кадры не только добавляются — всё, что
     дальше ±2×STILL_WINDOW от фокуса, снимается (окно 0..W от отрисовки уходит). */
  for (let pos = 0; pos <= 28; pos++) assert.ok(stepTo(c, pos, 30), 'дыра на пути к серии ' + (pos + 1));
  const loaded = loadedPos(c);
  assert.ok(loaded.indexOf(28) !== -1 && loaded.indexOf(22) !== -1, 'кадры вокруг фокуса стоят');
  assert.equal(loaded.indexOf(0), -1, 'кадр начала сезона снят вместе с уехавшим окном');
  assert.ok(loaded[0] >= 28 - 2 * W, 'ничего дальше ±2×STILL_WINDOW от фокуса не осталось');
});

test('кадры: проход фокусом по всему сезону не копит кадры — держится окно ±2×STILL_WINDOW', () => {
  const c = makeCard();
  const total = 60;
  LC.header.decorate(c.root, serial(total));

  const count = () => c.track._children.filter((n) => stillOf(n)).length;
  const ceiling = 4 * STILL_WINDOW + 1;
  let peak = 0;
  for (let pos = 0; pos < total; pos++) {
    assert.ok(stepTo(c, pos, total), 'дыра на пути к серии ' + (pos + 1));
    peak = Math.max(peak, count());
  }
  assert.ok(peak <= ceiling, 'одновременно загруженных кадров ' + peak + ', потолок ' + ceiling);
  assert.ok(count() < total, 'после прохода по сезону кадры остались у всех серий');
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

/* Task 39: размер кадра серии — по фактической ширине плитки (14.9em).
   На экране 1920 это 340 физических пикселей (w300); потолок w300 держится
   и при DPR 2, потому что следующая ступень TMDB для кадров серий — сразу
   original, то есть полный кадр 1920×1080 под текстом с opacity .28. На
   узком экране берётся w185. */
test('Task 39: размер кадра серии по ширине плитки, потолок w300', () => {
  const prevW = globalThis.window.innerWidth;
  const prevD = globalThis.window.devicePixelRatio;
  try {
    globalThis.window.devicePixelRatio = 2;
    let c = makeCard();
    LC.header.decorate(c.root, serial(1));
    assert.equal(stillOf(c.track._children[0]), 'url("https://img.test/t/p/w300/s1.jpg")', 'DPR 2 потолок не поднимает');

    globalThis.window.devicePixelRatio = 1;
    globalThis.window.innerWidth = 1024;
    c = makeCard();
    LC.header.decorate(c.root, serial(1));
    assert.equal(stillOf(c.track._children[0]), 'url("https://img.test/t/p/w185/s1.jpg")', 'узкий экран — w185');
  } finally {
    globalThis.window.innerWidth = prevW;
    globalThis.window.devicePixelRatio = prevD;
  }
});

/* ------------------------------ окно узлов (Task 67) ------------------------------ */

test('Task 67: длинный сезон строится окном — узлов не больше 2×окна+1, остальное держит распорка', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(300));
  const W = halfWindow();

  assert.equal(c.track._children.length, W * 2 + 1, 'построено ровно окно вокруг начала ряда');
  assert.equal(nodeAt(c, 0) !== null, true, 'первая серия в DOM — ряд показывается с начала');
  assert.equal(c.track._children[c.track._children.length - 1].lumenPos, W * 2, 'окно кончается на 2×окна');
  assert.equal(nodeAt(c, W * 2 + 1), null, 'за краем окна узлов нет');
  assert.equal(c.count.text(), '300 серий', 'счётчик показывает весь сезон, а не размер окна');

  /* Распорка справа — место снятых плиток: (300 − 1 − to) шагов по (ширина +
     зазор) em. Слева окно начинается с нуля, поэтому левой распорки нет. */
  const step = LC.episodeEm.width + LC.episodeEm.gap;
  assert.equal(c.track.css('padding-left'), '', 'окно от начала списка — левой распорки нет');
  assert.equal(c.track.css('padding-right'), Math.round((300 - 1 - W * 2) * step * 100) / 100 + 'em');
  assert.deepEqual(warnLog, []);
});

test('Task 67: сезон короче окна строится целиком и без распорки', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(8));
  assert.equal(c.track._children.length, 8);
  assert.equal(c.track.getAttribute('style'), null, 'ни сдвига, ни распорки — атрибута style нет');
});

test('Task 67: проход пультом по всему сезону — без «дыр», окно едет за фокусом, узлы не копятся', () => {
  const c = makeCard();
  const total = 300;
  LC.header.decorate(c.root, serial(total));
  const W = halfWindow();
  const ceiling = W * 2 + 1;
  let peak = 0;

  for (let pos = 0; pos < total; pos++) {
    const node = stepTo(c, pos, total);
    assert.ok(node, 'серия ' + (pos + 1) + ' не найдена в DOM — «дыра» на пути пульта');
    peak = Math.max(peak, c.track._children.length);
  }
  assert.ok(peak <= ceiling, 'узлов одновременно ' + peak + ', потолок ' + ceiling);
  assert.equal(nodeAt(c, total - 1) !== null, true, 'последняя серия сезона доступна');
  assert.equal(nodeAt(c, 0), null, 'начало сезона снято — окно уехало');

  /* Порядок в дорожке — по местам в сезоне: prepend слева, append справа. */
  const order = c.track._children.map((n) => n.lumenPos);
  assert.deepEqual(order, order.slice().sort((a, b) => a - b), 'плитки лежат по возрастанию номера');

  /* У правого края окно упирается в конец сезона: правой распорки больше нет,
     а левая держит место всех снятых плиток. */
  const step = LC.episodeEm.width + LC.episodeEm.gap;
  const info = c.row.lumenEpisodes;
  assert.equal(c.track.css('padding-right'), '');
  assert.equal(c.track.css('padding-left'), Math.round(info.from * step * 100) / 100 + 'em');
  assert.equal(info.to, total - 1);

  /* И обратный путь — до первой серии. */
  for (let pos = total - 1; pos >= 0; pos--) {
    assert.ok(stepTo(c, pos, total), 'серия ' + (pos + 1) + ' не найдена на обратном пути');
  }
  assert.equal(c.track.css('padding-left'), '', 'вернулись к началу — левой распорки нет');
  assert.deepEqual(warnLog, []);
});

/* Navigator ходит по СНИМКУ .selector'ов (Controller.collectionSet ->
   Navigator.setCollection, vendor/lampa/app.min.js:46448-46466), поэтому
   досозданные за краем окна плитки в него сами не попадут, а снятые
   останутся в нём мёртвыми. */
test('Task 67: сдвиг окна пересобирает коллекцию Navigator и возвращает фокус на ту же плитку', () => {
  const c = makeCard();
  const total = 300;
  LC.header.decorate(c.root, serial(total));
  const calls = [];
  const prev = Lampa.Controller;
  Lampa.Controller = {
    enabled: () => ({ name: 'full_start' }),
    collectionSet: (html) => calls.push(['set', html]),
    collectionFocus: (target, html) => calls.push(['focus', target, html])
  };
  try {
    stepTo(c, 1, total);
    assert.deepEqual(calls, [], 'окно не двигалось — коллекцию не трогаем');

    const W = halfWindow();
    const node = stepTo(c, W * 2 - STILL_WINDOW + 1, total);
    assert.equal(calls.length, 2, 'окно сдвинулось — пересбор и возврат фокуса');
    assert.equal(calls[0][0], 'set');
    assert.equal(calls[0][1], c.root, 'коллекция собирается по корню карточки');
    assert.equal(calls[1][0], 'focus');
    assert.equal(calls[1][1], node, 'фокус возвращается на ту же плитку');
  } finally {
    Lampa.Controller = prev;
  }
  assert.deepEqual(warnLog, []);
});

/* Ревью 2026-09-22 (М3): ряд пересобирают не только сдвигом окна. Смена
   сигнатуры списка (другой сезон, догрузка серий) сносит ВСЕ плитки
   разом — и без пересбора снимок Navigator остаётся с мёртвыми узлами.
   На первой сборке карточки коллекцию собирает сама Lampa, и лезть
   раньше неё незачем. */
test('Task 67 (ревью М3): пересборка ряда другим списком тоже пересобирает коллекцию', () => {
  const c = makeCard();
  const calls = [];
  const prev = Lampa.Controller;
  Lampa.Controller = {
    enabled: () => ({ name: 'full_start' }),
    collectionSet: (html) => calls.push(['set', html]),
    collectionFocus: (target, html) => calls.push(['focus', target, html])
  };
  try {
    LC.header.decorate(c.root, serial(8));
    assert.deepEqual(calls, [], 'первая сборка ряда коллекцию Lampa не трогает');

    /* Фокус вне ряда серий — на кнопке карточки: её узел пересборку
       переживает, и возвращать надо именно его. */
    const button = c.play;
    button.addClass('focus');
    LC.header.decorate(c.root, serial(5));
    assert.equal(calls.length, 2, 'ряд пересобран, а коллекция — нет: ' + calls.map((one) => one[0]).join(','));
    assert.equal(calls[0][0], 'set');
    assert.equal(calls[0][1], c.root, 'коллекция собирается по корню карточки');
    assert.equal(calls[1][1], button, 'фокус вне ряда обязан вернуться на свой узел');

    /* Тот же список второй раз — ряд не трогается, значит и коллекция. */
    calls.length = 0;
    const same = serial(5);
    LC.header.decorate(c.root, same);
    calls.length = 0;
    LC.header.decorate(c.root, same);
    assert.deepEqual(calls, [], 'ряд не пересобирался — коллекцию трогать не за что');

    /* Фокус стоял на плитке серии: её узла больше нет, и вернуть его
       нельзя — уходим на первый .selector карточки (collectionFocus
       с false). */
    calls.length = 0;
    button.removeClass('focus');
    c.track._children[0].addClass('focus');
    LC.header.decorate(c.root, serial(9));
    assert.equal(calls.length, 2, 'ряд пересобран, а коллекция — нет');
    assert.equal(calls[1][1], false, 'мёртвый узел плитки не имеет права остаться фокусом');
  } finally {
    Lampa.Controller = prev;
  }
  assert.deepEqual(warnLog, []);
});

/* Карточка, оставленная в истории Lampa, остаётся живым DOM, и пересбор по
   ней увёл бы навигацию с видимого экрана (тот же урок, что у кнопки «Стоп»
   трейлера). Имени контроллера для различения не хватает: у обеих карточек
   он full_start. */
test('Task 67: коллекцию не пересобираем с чужого экрана и из-под чужого контроллера', () => {
  const c = makeCard();
  const total = 300;
  LC.header.decorate(c.root, serial(total));
  const W = halfWindow();
  const calls = [];
  const prev = Lampa.Controller;
  Lampa.Controller = {
    enabled: () => ({ name: 'full_start' }),
    collectionSet: () => calls.push('set'),
    collectionFocus: () => calls.push('focus')
  };
  try {
    /* Карточка ушла в историю: её активность без activity--active. */
    const archived = new FakeEl(['activity'], [c.root]);
    stepTo(c, W * 2 - STILL_WINDOW + 1, total);
    assert.deepEqual(calls, [], 'карточка не на экране — навигацию не трогаем');
    assert.equal(c.row.lumenEpisodes.to > W * 2, true, 'окно при этом всё равно доехало');

    archived.addClass('activity--active');
    Lampa.Controller.enabled = () => ({ name: 'full_descr' });
    stepTo(c, c.row.lumenEpisodes.to - STILL_WINDOW + 1, total);
    assert.deepEqual(calls, [], 'фокус в другом контроллере — коллекция не наша');
  } finally {
    Lampa.Controller = prev;
    c.root._parentEl = null;
  }
  assert.deepEqual(warnLog, []);
});

/* Controller.collectionFocus -> Navigator.focus -> Controller.focus шлёт узлу
   тот же hover:focus (vendor/lampa/app.min.js:56069, 46434-46446), то есть
   обработчик получает своё же событие. Бесконечным заход не будет (окно уже
   на месте), но без защёлки весь путь прошёл бы заново — вместе с чтением
   геометрии ряда. Его и считаем: getBoundingClientRect на viewport зовёт
   ровно scrollToEpisode. */
test('Task 67: повторный hover:focus от Navigator не гоняет обработчик по второму кругу', () => {
  const c = makeCard();
  const total = 300;
  LC.header.decorate(c.root, serial(total));
  let geom = 0;
  c.viewport.getBoundingClientRect = () => { geom++; return { left: 64 }; };
  const prev = Lampa.Controller;
  Lampa.Controller = {
    enabled: () => ({ name: 'full_start' }),
    collectionSet: () => { },
    collectionFocus: (target) => { if (target) fire(c.root, 'hover:focus', target); }
  };
  try {
    const W = halfWindow();
    stepTo(c, W * 2 - STILL_WINDOW + 1, total);
    assert.equal(geom, 1, 'раскладка ряда пересчитана один раз, а не дважды');
  } finally {
    Lampa.Controller = prev;
  }
  assert.deepEqual(warnLog, []);
});

/* ↑ с плитки серии правее кнопок (долг фазы 1, план фазы 1 Task 12, п.2).
   Navigator Lampa с прямой полосой (straightOnly) не находит кнопок над
   дальней плиткой, и штатный up контроллера full_start уводит фокус в
   шапку Lampa. bindStart оборачивает up того контроллера, который Start
   отдаёт модулям событием 'controller' (vendor/lampa/app.min.js:37918-37943). */
function startItem() {
  const comps = [];
  return {
    comps,
    use(m) { comps.push(m); },
    controller() {
      const calls = [];
      const ctrl = { up: function () { calls.push('lampa-up'); } };
      comps.forEach((m) => { if (m.onController) m.onController(ctrl); });
      return { ctrl, calls };
    }
  };
}

function upCard() {
  const c = makeCard();
  const opts = new FakeEl(['full-start__button', 'selector', 'button--options']);
  const hidden = new FakeEl(['full-start__button', 'selector', 'button--trailer']);
  c.buttons.append(opts);
  c.buttons.append(hidden);
  /* Геометрия стенда 960×540@2 («Дораэмон»): кнопки 40…152, 281…317,
     413…449; скрытая кнопка трейлера — вне раскладки (offsetParent null). */
  const box = (el, left, width, parent) => {
    el.getBoundingClientRect = () => ({ left: left, width: width, top: 292, height: 36 });
    el.offsetParent = parent;
  };
  box(c.play, 40, 112, c.buttons);
  box(c.book, 281, 36, c.buttons);
  box(opts, 413, 36, c.buttons);
  box(hidden, 460, 36, null);
  c.buttons.querySelectorAll = () => [c.play, c.book, opts, hidden];
  c.opts = opts;
  c.hidden = hidden;
  return c;
}

function withNavigator(focused, canUp, fn) {
  const prevNav = window.Navigator;
  const prevCtl = Lampa.Controller;
  const nav = {
    focus: focused,
    getFocusedElement() { return nav.focus; },
    canmove(dir) { return dir === 'up' && canUp ? {} : false; }
  };
  const focusCalls = [];
  window.Navigator = nav;
  Lampa.Controller = {
    collectionFocus(target, html) { focusCalls.push([target, html]); nav.focus = target; }
  };
  try {
    fn(nav, focusCalls);
  } finally {
    window.Navigator = prevNav;
    Lampa.Controller = prevCtl;
  }
}

test('↑ с дальней плитки серии: на ближайшую по горизонтали кнопку, а не в шапку Lampa', () => {
  const c = upCard();
  LC.header.decorate(c.root, serial(60));
  const item = startItem();
  LC.header.bindStart(item, c.root);
  const tile = nodeAt(c, 3);
  tile.getBoundingClientRect = () => ({ left: 574, width: 170, top: 378, height: 96 });
  withNavigator(tile, false, (nav, focusCalls) => {
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.deepEqual(calls, [], 'штатный up (он уводит в шапку) не зовётся');
    assert.equal(focusCalls.length, 1);
    assert.equal(focusCalls[0][0], c.opts, 'ближайшая видимая кнопка — последняя в ряду');
    assert.equal(focusCalls[0][1], c.root, 'фокус ставится в коллекции этой карточки');
  });
  assert.deepEqual(warnLog, []);
});

test('↑ с плитки серии: если Navigator сам находит цель — работает штатный up', () => {
  const c = upCard();
  LC.header.decorate(c.root, serial(60));
  const item = startItem();
  LC.header.bindStart(item, c.root);
  const tile = nodeAt(c, 0);
  tile.getBoundingClientRect = () => ({ left: 40, width: 170, top: 378, height: 96 });
  withNavigator(tile, true, (nav, focusCalls) => {
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.deepEqual(calls, ['lampa-up']);
    assert.deepEqual(focusCalls, []);
  });
  assert.deepEqual(warnLog, []);
});

test('↑ не с плитки серии и не из этой карточки — штатный up без изменений', () => {
  const c = upCard();
  const other = upCard();
  LC.header.decorate(c.root, serial(60));
  LC.header.decorate(other.root, serial(60));
  const item = startItem();
  LC.header.bindStart(item, c.root);
  /* Фокус на кнопке: с верхнего ряда карточки ↑ по-прежнему в шапку. */
  withNavigator(c.opts, false, (nav, focusCalls) => {
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.deepEqual(calls, ['lampa-up']);
    assert.deepEqual(focusCalls, []);
  });
  /* Плитка чужой карточки (история Lampa держит прежние в DOM). */
  const foreign = nodeAt(other, 5);
  foreign.getBoundingClientRect = () => ({ left: 705, width: 170, top: 378, height: 96 });
  withNavigator(foreign, false, (nav, focusCalls) => {
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.deepEqual(calls, ['lampa-up']);
    assert.deepEqual(focusCalls, []);
  });
  assert.deepEqual(warnLog, []);
});

test('↑ с плитки: при равном расстоянии — первая кнопка; фокус не встал — штатный up', () => {
  const c = upCard();
  LC.header.decorate(c.root, serial(60));
  const item = startItem();
  LC.header.bindStart(item, c.root);
  /* Плитка под «Смотреть»: центр 125 лежит внутри 40…152 и внутри
     подставленной второй кнопки на тех же координатах — побеждает первая. */
  c.book.getBoundingClientRect = () => ({ left: 40, width: 112, top: 292, height: 36 });
  const tile = nodeAt(c, 0);
  tile.getBoundingClientRect = () => ({ left: 40, width: 170, top: 378, height: 96 });
  withNavigator(tile, false, (nav, focusCalls) => {
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.equal(focusCalls[0][0], c.play);
    assert.deepEqual(calls, []);
  });
  /* collectionFocus не смог (узла нет в коллекции Navigator) — не
     оставляем пульт без ответа, отдаём нажатие Lampa. */
  withNavigator(tile, false, (nav) => {
    Lampa.Controller.collectionFocus = () => { };
    const { ctrl, calls } = item.controller();
    ctrl.up();
    assert.deepEqual(calls, ['lampa-up']);
  });
  assert.deepEqual(warnLog, []);
});

test('bindStart: без Emit.use или повторно — ничего не делает', () => {
  const c = upCard();
  LC.header.bindStart(null, c.root);
  LC.header.bindStart({}, c.root);
  const item = startItem();
  LC.header.bindStart(item, c.root);
  LC.header.bindStart(item, c.root);
  assert.equal(item.comps.length, 1, 'обёртка ставится один раз на модуль');
  assert.deepEqual(warnLog, []);
});

test('Task 67: refreshEpisode серии за окном ничего не ломает, а в окне она встаёт с актуальным Timeline', () => {
  const c = makeCard();
  const total = 300;
  LC.header.decorate(c.root, serial(total));
  const far = 150;
  assert.equal(nodeAt(c, far), null, 'серия за окном — узла нет');

  views[hashOf(2, far + 1)] = { percent: 40, time: 1200, duration: 3000 };
  try {
    LC.header.refreshEpisode(hashOf(2, far + 1));
    assert.deepEqual(warnLog, [], 'обновление Timeline за окном проходит тихо');

    for (let pos = 0; pos <= far; pos++) assert.ok(stepTo(c, pos, total), 'дыра на пути к серии ' + (pos + 1));
    const node = nodeAt(c, far);
    assert.ok(node.hasClass('lumen-episode--watching'), 'встала в окно уже с актуальным состоянием');
    assert.ok(node.html().indexOf('40 %') !== -1);
  } finally {
    delete views[hashOf(2, far + 1)];
  }
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
  /* Потолок — ширина дорожки минус видимая часть: 8 × 356 − 1856 = 992.
     Ревью 2026-09-22 (М2): до правки модели здесь стояло 976 — на один
     зазор меньше, потому что зазор вычитался из scrollWidth, чего Blink
     не делает (замер у layout выше). Последняя плитка у упора отстоит от
     правого края экрана ровно на свой margin-right, а не прижимается к
     нему вплотную. */
  assert.equal(c.track.lumenShift, 992, 'сдвиг не больше ширины дорожки минус видимая часть');

  fire(c.root, 'hover:focus', c.track._children[0]);
  assert.equal(c.track.lumenShift, 0);
  assert.equal(c.track.getAttribute('style'), null, 'пустой style="" снят');
});

/* Правка 2026-09-23 (разбор композиции, п.4.2): «Режиссер» и «Актеры» — одна
   сущность, свёрстанная двумя рядами. Lampa строит их из data.persons.crew
   (фильтр по job === 'Director') и data.persons.cast; правка переносит
   режиссёров в начало cast, и второй ряд просто не создаётся. */
test('одна лента людей: режиссёры уходят в начало актёров, ряд режиссёра не создаётся', () => {
  const data = {
    persons: {
      cast: [{ id: 2, name: 'Марк Хэмилл', character: 'Люк' }],
      crew: [
        { id: 1, name: 'Ирвин Кершнер', job: 'Director', profile_path: '/k.jpg' },
        { id: 3, name: 'Лоуренс Кэздан', job: 'Writer' }
      ]
    }
  };
  LC.header.mergePeople(data);
  assert.equal(data.persons.cast.length, 2);
  assert.equal(data.persons.cast[0].name, 'Ирвин Кершнер', 'режиссёр не встал первым');
  assert.equal(data.persons.cast[0].character, 'Режиссер', 'подпись роли не взята из словаря Lampa');
  assert.equal(data.persons.cast[0].profile_path, '/k.jpg', 'портрет режиссёра потерян');
  assert.equal(data.persons.cast[1].name, 'Марк Хэмилл', 'порядок актёров нарушен');
  /* Именно это и убирает второй ряд: Lampa фильтрует crew по job. */
  assert.deepEqual(data.persons.crew.map((m) => m.job), ['Writer'], 'режиссёр остался в crew — Lampa построит второй ряд');
  /* Запись crew копируется, а не правится на месте: тот же объект Lampa
     отдаёт экрану персоны по OK. */
  assert.equal(data.persons.cast[0] === data.persons.crew[0], false);

  /* Идемпотентность: второй проход (карточка открыта повторно) ничего не
     дублирует. */
  LC.header.mergePeople(data);
  assert.equal(data.persons.cast.length, 2);
});

test('одна лента людей: без актёров или без режиссёров данные не трогаются', () => {
  const onlyCrew = { persons: { cast: [], crew: [{ name: 'Ирвин Кершнер', job: 'Director' }] } };
  LC.header.mergePeople(onlyCrew);
  assert.equal(onlyCrew.persons.cast.length, 0, 'без актёров секция режиссёра — единственное место, где он виден');
  assert.equal(onlyCrew.persons.crew.length, 1);

  const noDirector = { persons: { cast: [{ name: 'Марк Хэмилл' }], crew: [{ name: 'Кэздан', job: 'Writer' }] } };
  LC.header.mergePeople(noDirector);
  assert.deepEqual(noDirector.persons.cast.map((p) => p.name), ['Марк Хэмилл']);
  assert.deepEqual(noDirector.persons.crew.map((p) => p.job), ['Writer']);

  /* Пустые и битые данные проходят насквозь. */
  assert.doesNotThrow(() => LC.header.mergePeople(null));
  assert.doesNotThrow(() => LC.header.mergePeople({}));
});

/* Обёртка над Lampa.Api.full — единственная точка, где данные ещё можно
   тронуть: rows компонент собирает прямо в её колбэке. */
test('одна лента людей: обёртка Api.full ставится и снимается, чужую поверх не срывает', () => {
  const original = (object, oncomplite) => oncomplite({ persons: { cast: [{ name: 'А' }], crew: [{ name: 'Р', job: 'Director' }] } });
  Lampa.Api = { full: original };
  try {
    LC.header.installPeople();
    assert.notEqual(Lampa.Api.full, original, 'обёртка не встала');
    const wrapped = Lampa.Api.full;
    LC.header.installPeople();
    assert.equal(Lampa.Api.full, wrapped, 'повторная установка обернула саму себя');

    let got = null;
    Lampa.Api.full({}, (data) => { got = data; });
    assert.equal(got.persons.cast[0].name, 'Р', 'обёртка не слила ленты');

    /* Чужая обёртка поверх нашей: свою гасим флагом, чужую не срываем. */
    const foreign = Lampa.Api.full;
    Lampa.Api.full = (o, c, e) => foreign(o, c, e);
    const after = Lampa.Api.full;
    LC.header.uninstallPeople();
    assert.equal(Lampa.Api.full, after, 'чужая обёртка сорвана');
    got = null;
    Lampa.Api.full({}, (data) => { got = data; });
    assert.equal(got.persons.cast[0].name, 'А', 'снятая обёртка продолжает сливать ленты');
  } finally {
    delete Lampa.Api;
  }
  assert.deepEqual(warnLog, []);
});

/* Решение координатора по п.2.2 разбора: режиссёр ушёл из мета-строки — он
   дублировался лентой людей ниже по странице, где у него есть портрет.
   Остальные поля строки не тронуты. */
test('мета-строка: режиссёра нет у фильма, студия у сериала осталась', () => {
  const c = makeCard();
  LC.header.decorate(c.root, {
    movie: {
      title: 'Дюна', release_date: '1980-05-20', runtime: 124,
      genres: [{ name: 'фантастика' }],
      production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }]
    },
    persons: { crew: [{ job: 'Director', name: 'Ирвин Кершнер' }] }
  });
  const html = c.meta.html();
  assert.ok(html.indexOf('1980') !== -1 && html.indexOf('США') !== -1, 'год и страна пропали: ' + html);
  assert.ok(html.indexOf('Фантастика') !== -1, 'жанры пропали: ' + html);
  assert.equal(html.indexOf('Кершнер'), -1, 'режиссёр остался в мета-строке: ' + html);

  const serialData = serial(3);
  serialData.movie.networks = [{ name: 'HBO' }];
  LC.header.decorate(c.root, serialData);
  assert.ok(c.meta.html().indexOf('HBO') !== -1, 'у сериала пропала студия: ' + c.meta.html());
});

/* Правка 2026-09-23 (разбор композиции, п.2.1): длинное название режется по
   своему разделителю, а не по ширине колонки. Доля названий с разделителем
   и разбор правила — у LC.cardinfo.titleParts. */
test('заголовок карточки: с разделителем — два уровня, без него — прежний класс переноса', () => {
  const c = makeCard();
  const data = serial(3);
  data.movie.name = 'Звёздные войны: Эпизод 5 - Империя наносит ответный удар';
  LC.header.decorate(c.root, data);
  assert.ok(c.cardTitle.hasClass('lumen-title--split'), 'двухуровневый заголовок не помечен');
  assert.equal(c.cardTitle.hasClass('lumen-title--long'), false, 'вместе со split остался класс переноса');
  assert.ok(c.cardTitle.html().indexOf('<div class="lumen-title__lead">Звёздные войны</div>') !== -1, c.cardTitle.html());
  assert.ok(c.cardTitle.html().indexOf('Эпизод 5 - Империя наносит ответный удар</div>') !== -1, c.cardTitle.html());

  /* Название без разделителя — прежний фолбэк, и разметка прошлого тайтла
     из узла уходит: узел карточки Lampa переживает смену тайтла в истории. */
  const plain = serial(3);
  plain.movie.name = 'Закон и порядок. Специальный корпус';
  LC.header.decorate(c.root, plain);
  assert.equal(c.cardTitle.hasClass('lumen-title--split'), false, 'класс двух уровней не снят');
  assert.ok(c.cardTitle.hasClass('lumen-title--long'), 'длинное название осталось без класса переноса');
  assert.equal(c.cardTitle.text(), 'Закон и порядок. Специальный корпус', 'текст не вернулся на место');

  /* Экранирование: текст заголовка приходит из TMDB и попадает в разметку. */
  const risky = serial(3);
  risky.movie.name = 'Кавычки и <тег>: часть вторая';
  LC.header.decorate(c.root, risky);
  assert.equal(risky.movie.name.indexOf('<тег>') !== -1, true);
  assert.equal(c.cardTitle.html().indexOf('<тег>'), -1, 'разметка из названия не экранирована: ' + c.cardTitle.html());
});

/* Правило кромки (разбор композиции 2026-09-22, п.6). Ряд серий уходит за
   правый край экрана по замыслу, и кромка резала плитку вместе с названием
   серии («Железный трон» → «Же»). Модель здесь та же, что у scrollToEpisode
   выше: плитка 340, шаг 356, viewport с x = 64 при экране 1920, то есть
   видно 1856 px. Плитки 0…4 кончаются на 1764 и помещаются целиком, плитка
   5 занимает 1780…2120 — её и режет кромка. */
test('правило кромки: срезанную плитку помечает класс, а сдвиг ряда его переставляет', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(8));
  layout(c.track);

  const cut = () => c.track._children.map((n) => n.hasClass('lumen-episode--cut'));
  fire(c.root, 'hover:focus', c.track._children[0]);
  assert.deepEqual(cut(), [false, false, false, false, false, true, true, true], 'помечены не те плитки, что режет кромка');

  /* Дойдя фокусом до срезанной плитки, ряд сдвигается, и подпись
     возвращается: срезанной становится соседняя, а не фокусная. */
  fire(c.root, 'hover:focus', c.track._children[5]);
  assert.equal(c.track.lumenShift, 434, 'сдвиг к шестой плитке');
  assert.equal(c.track._children[5].hasClass('lumen-episode--cut'), false, 'фокусная плитка осталась срезанной');
  assert.equal(c.track._children[0].hasClass('lumen-episode--cut'), true, 'плитка, ушедшая за левый край, не помечена');

  /* Возврат в начало ряда возвращает и метки. */
  fire(c.root, 'hover:focus', c.track._children[0]);
  assert.deepEqual(cut(), [false, false, false, false, false, true, true, true], 'метки не вернулись вместе со сдвигом');
});

/* Первая сборка карточки идёт до вставки узла в документ — там у плиток
   offsetLeft нулевой, и мерить нечего. Ждать первого нажатия нельзя: ряд
   виден с самого начала, и именно этот кадр и пришёл в разбор скриншотом.
   Поэтому пометка повторяется следующей задачей таймера. */
test('правило кромки: пометка повторяется после вставки карточки в документ', () => {
  const c = makeCard();
  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  try {
    /* Раскладки ещё нет — ровно как у карточки вне документа. */
    LC.header.decorate(c.root, serial(8));
    assert.equal(c.track._children.some((n) => n.hasClass('lumen-episode--cut')), false, 'без раскладки помечать нечего');
    assert.ok(timers.length >= 1, 'отложенной пометки нет вовсе');

    layout(c.track);
    timers.forEach((t) => t.fn());
    assert.deepEqual(
      c.track._children.map((n) => n.hasClass('lumen-episode--cut')),
      [false, false, false, false, false, true, true, true],
      'после вставки в документ срезанные плитки не помечены'
    );
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.deepEqual(warnLog, []);
});

/* ------------------------------ bindEpisodes (п.2, п.5) ------------------------------ */

test('bindEpisodes: повторный decorate не удваивает слушатели; фокус на серии — компакт, на кнопке — снят', () => {
  const c = makeCard();
  const data = serial(3);
  LC.header.decorate(c.root, data);
  LC.header.decorate(c.root, data);
  /* Task 68: подписок три — фокус пультом ('hover:focus'), фокус мышью
     ('hover:hover', vendor/lampa/app.min.js:46360-46364) и OK
     ('hover:enter'). Первые две ставит LC.focus.capture одним обработчиком. */
  assert.deepEqual(
    c.root._listeners.map((l) => l.type).sort(),
    ['hover:enter', 'hover:focus', 'hover:hover'],
    'повторный decorate слушатели не удваивает'
  );
  assert.ok(c.root._listeners.every((l) => l.capture), 'слушатели в фазе перехвата');

  fire(c.root, 'hover:focus', c.track._children[1]);
  assert.ok(c.root.hasClass('lumen-compact'));
  fire(c.root, 'hover:focus', c.book);
  assert.equal(c.root.hasClass('lumen-compact'), false);
});

/* Task 68: мышиный режим Lampa шлёт плитке 'hover:hover', а не 'hover:focus'
   (vendor/lampa/app.min.js:46360-46364) — до общего LC.focus ряд серий мышью
   не отзывался вовсе. Проверяется та же пара переходов, что и пультом. */
test('bindEpisodes: мышиный hover:hover работает так же, как пультовый hover:focus', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(3));

  fire(c.root, 'hover:hover', c.track._children[1]);
  assert.ok(c.root.hasClass('lumen-compact'), 'фокус мышью на серии сжимает шапку');
  fire(c.root, 'hover:hover', c.book);
  assert.equal(c.root.hasClass('lumen-compact'), false, 'фокус мышью на кнопке снимает компакт');
});

/* Task 68: обработчик один на оба события — значит одно наведение мышью даёт
   ровно один проход, а не два. Считаем по сдвигу дорожки: мышиное событие
   двигает её так же и ровно столько же раз, сколько пультовое. */
test('bindEpisodes: одно событие — один проход, пульт и мышь не задваиваются', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(8));
  layout(c.track);
  fire(c.root, 'hover:focus', c.track._children[4]);
  assert.equal(c.track.lumenShift, 78, 'пультом — тот же сдвиг, что в тесте scrollToEpisode');

  const m = makeCard();
  LC.header.decorate(m.root, serial(8));
  layout(m.track);
  fire(m.root, 'hover:hover', m.track._children[4]);
  assert.equal(m.track.lumenShift, 78, 'мышью — ровно тот же сдвиг, не удвоенный');
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

/* Правка 2026-09-16 (п.1): боковой колонки нет, статус стоит в ленте
   рейтингов у всех карточек. Порядок узлов ленты не меняется ни у сериала
   (renderSerialMode находит статус уже на месте и ничего не двигает), ни у
   фильма — у фильма статус гасит CSS (.lumen-card--serial нет). */
test('renderSerialMode: статус уже стоит в ленте перед чипом — порядок не меняется ни у сериала, ни у фильма', () => {
  const c = makeCard();
  const data = serial(2);
  LC.header.decorate(c.root, data);
  LC.header.decorate(c.root, data);
  assert.ok(c.root.hasClass('lumen-card--serial'));
  assert.deepEqual(c.rateLine._children.map((n) => n._class[0]), ['full-start__rate', 'full-start__status', 'lumen-next-chip']);

  const f = makeCard();
  LC.header.decorate(f.root, { movie: { title: 'Дюна', original_title: 'Dune: Part Two', release_date: '2024-02-27' } });
  assert.equal(f.root.hasClass('lumen-card--serial'), false);
  assert.equal(f.status.parent(), f.rateLine);
  assert.deepEqual(f.rateLine._children.map((n) => n._class[0]), ['full-start__rate', 'full-start__status', 'lumen-next-chip']);
});

test('renderNextChip: текст из LC.STRINGS со склонением; скрыт без next_episode_to_air и у фильма', () => {
  const c = makeCard();
  const data = serial(1);
  const next = dateIn(31);
  data.movie.next_episode_to_air = { air_date: ymd(next) };
  /* Текст статуса в узел кладёт сама Lampa — здесь он проставлен руками,
     чтобы проверить, что разметка чипа его сохраняет. */
  c.status.text('Онгоинг');
  LC.header.decorate(c.root, data);
  /* Правка 2026-09-23 (разбор композиции, п.2.3): у сериала строка
     следующей серии стала ПОДПИСЬЮ двухуровневого чипа статуса, а
     отдельный чип прячется — на экране одна карта вместо двух. */
  assert.ok(c.chip.hasClass('hide'), 'отдельный чип у сериала остался виден');
  assert.equal(c.status.find('.lumen-status__label').text(), next.getDate() + ' ' + RU_GEN[next.getMonth()] + ', через 31 день');
  assert.equal(c.status.find('.lumen-status__value').text(), 'Онгоинг', 'значение чипа — сам статус');

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

/* ------------------------------ Task 8: «Продолжить» ------------------------------ */

const FILM = { title: 'Дюна: Часть вторая', original_title: 'Dune: Part Two', release_date: '2024-02-27' };

function withViews(map, fn) {
  const keys = Object.keys(map);
  keys.forEach((h) => { views[h] = map[h]; });
  try { return fn(); } finally { keys.forEach((h) => { delete views[h]; }); }
}

test('progress: фильм — одна строка «01:12 / 02:46 · 43 %», кнопка остаётся штатной', () => {
  const c = makeCard();
  withViews({ [lampaHash('Dune: Part Two')]: { percent: 43, time: 4320, duration: 9960 } }, () => {
    LC.header.decorate(c.root, { movie: FILM });
  });
  assert.equal(c.progress.hasClass('hide'), false);
  assert.equal(c.pLabel.text(), '', 'у фильма подписи серии нет — по §6 там только таймкод и процент');
  assert.equal(c.pTime.text(), '01:12 / 02:46 · 43 %');
  assert.equal(c.root.hasClass('lumen-continue'), false, 'на экране 01 кнопка фильма — «Смотреть»');
  assert.deepEqual(warnLog, []);
});

/* Долг плана lumen-final (раздел D, 2026-09-23): ширину заливки полосы
   «Продолжить» не проверял ни один тест — фейковый DOM не понимал селектор
   '.lumen-progress__bar > div', и css('width', …) уходил в пустой набор.
   Проверено, что тест ловит поломку: с шириной '50%' вместо percent + '%'
   в src/85_header.js он падает на первом же сравнении. */
test('progress: полоса «Продолжить» — ширина заливки равна проценту просмотра', () => {
  const film = makeCard();
  withViews({ [lampaHash('Dune: Part Two')]: { percent: 43, time: 4320, duration: 9960 } }, () => {
    LC.header.decorate(film.root, { movie: FILM });
  });
  assert.equal(film.root.find('.lumen-progress__bar > div'), film.pFill, 'селектор полосы не находит узел заливки');
  assert.equal(film.pFill.css('width'), '43%', 'фильм, 43 %');
  const show = makeCard();
  withViews({ [hashOf(2, 3)]: { percent: 31.6, time: 1120, duration: 3492, updated: 5 } }, () => {
    LC.header.decorate(show.root, serial(8));
  });
  assert.equal(show.pFill.css('width'), '32%', 'сериал, 31.6 % — округление до целого, как в подписи');
  /* Перерисовка той же карточки с новым процентом (событие Timeline после
     плеера) — ширина следует за ним, а не остаётся от первой отрисовки. */
  withViews({ [lampaHash('Dune: Part Two')]: { percent: 60, time: 5976, duration: 9960 } }, () => {
    LC.header.decorate(film.root, { movie: FILM });
  });
  assert.equal(film.pFill.css('width'), '60%', 'фильм после перерисовки, 60 %');
});

test('progress: досмотренный фильм (97 %) строки не показывает', () => {
  const c = makeCard();
  withViews({ [lampaHash('Dune: Part Two')]: { percent: 97, time: 9700, duration: 9960 } }, () => {
    LC.header.decorate(c.root, { movie: FILM });
  });
  assert.ok(c.progress.hasClass('hide'));
  assert.equal(c.root.hasClass('lumen-continue'), false);
});

test('progress: сериал — «S2 E3 «Серия 3» · 18:40 / 58:12 · 32 %» и подпись кнопки переменной', () => {
  const c = makeCard();
  withViews({ [hashOf(2, 3)]: { percent: 32, time: 1120, duration: 3492, updated: 5 } }, () => {
    LC.header.decorate(c.root, serial(8));
  });
  assert.equal(c.progress.hasClass('hide'), false);
  assert.equal(c.pLabel.text(), 'S2 E3 «Серия 3»');
  assert.equal(c.pTime.text(), '· 18:40 / 58:12 · 32 %');
  assert.ok(c.root.hasClass('lumen-continue'));
  assert.equal(c.root._css['--lumen-play-label'], '"Продолжить S2 E3"');
  assert.equal(c.play.getAttribute('style'), null, 'на кнопке инлайн-стилей нет — её outerHTML хэширует Lampa');
  assert.equal(c.play.html(), '', 'разметка кнопки не тронута');
});

test('progress: подпись кнопки экранируется для строки CSS (кавычка и обратный слэш)', () => {
  const c = makeCard();
  const original = LC.lang;
  LC.lang = (key) => (key === 'lumen_card_continue' ? 'Про"дол\\жить' : original(key));
  try {
    withViews({ [hashOf(2, 2)]: { percent: 20, time: 100, duration: 1000, updated: 5 } }, () => {
      LC.header.decorate(c.root, serial(3));
    });
  } finally {
    LC.lang = original;
  }
  assert.equal(c.root._css['--lumen-play-label'], '"Про\\"дол\\\\жить S2 E2"',
    'неэкранированная кавычка оборвала бы значение и правило стало бы невалидным');
});

test('progress: досмотренные серии ведут к следующей — «S2 E3 «Серия 3» · 53 мин», без таймкода', () => {
  const c = makeCard();
  withViews({
    [hashOf(2, 1)]: { percent: 100, time: 3060, duration: 3060, updated: 1 },
    [hashOf(2, 2)]: { percent: 96, time: 3000, duration: 3120, updated: 2 }
  }, () => {
    LC.header.decorate(c.root, serial(4));
  });
  assert.equal(c.progress.hasClass('hide'), false);
  assert.equal(c.pLabel.text(), 'S2 E3 «Серия 3» · 53 мин', 'у не начатой серии вместо таймкода — её длительность');
  assert.equal(c.pTime.text(), '');
  assert.equal(c.root._css['--lumen-play-label'], '"Продолжить S2 E3"');
});

test('progress: весь сезон досмотрен — ни строки, ни подписи, пустой style="" снят', () => {
  const c = makeCard();
  withViews({
    [hashOf(2, 1)]: { percent: 100, time: 3060, duration: 3060, updated: 1 },
    [hashOf(2, 2)]: { percent: 100, time: 3120, duration: 3120, updated: 2 }
  }, () => {
    LC.header.decorate(c.root, serial(2));
  });
  assert.ok(c.progress.hasClass('hide'));
  assert.equal(c.root.hasClass('lumen-continue'), false);
  assert.equal(c.root.getAttribute('style'), null);
});

test('progress: выключатель lumen_card_progress гасит строку, подпись кнопки и надписи сжатой шапки', () => {
  const c = makeCard();
  const get = Lampa.Storage.get;
  Lampa.Storage.get = (name, def) => (name === 'lumen_card_progress' ? false : def);
  try {
    withViews({ [hashOf(2, 3)]: { percent: 32, time: 1120, duration: 3492, updated: 5 } }, () => {
      LC.header.decorate(c.root, serial(4));
    });
  } finally {
    Lampa.Storage.get = get;
  }
  assert.ok(c.progress.hasClass('hide'));
  assert.equal(c.root.hasClass('lumen-continue'), false);
  assert.equal(c.root.hasClass('lumen-progress-on'), false, 'без этого класса CSS не покажет и надписи экрана 06');
});

test('progress: надписи экрана 06 — «· смотрите» у номера и таймкод в карточке серии', () => {
  const c = makeCard();
  withViews({ [hashOf(2, 3)]: { percent: 32, time: 1120, duration: 3492, updated: 5 } }, () => {
    LC.header.decorate(c.root, serial(4));
  });
  const html = c.track._children[2].html();
  assert.ok(html.indexOf('<div class="lumen-episode__state">· смотрите</div>') !== -1, 'нет узла состояния «E3 · СМОТРИТЕ»');
  assert.ok(html.indexOf('<div class="lumen-episode__timecode">18:40 / 58:12 · 32 %</div>') !== -1, 'нет таймкода сжатой шапки');
  assert.ok(html.indexOf('смотрите · осталось 39 мин') !== -1, 'обычная подпись остаётся — её подменяет CSS, а не рендер');
  assert.ok(c.root.hasClass('lumen-progress-on'));
});

test('renderNextChip: короткая дата «· 17 дек» для сжатой шапки и класс склейки со статусом', () => {
  const c = makeCard();
  const data = serial(1);
  const next = dateIn(31);
  data.movie.next_episode_to_air = { air_date: ymd(next) };
  LC.header.decorate(c.root, data);

  /* Короткая дата у сериала живёт подписью статуса — её показывает сжатая
     шапка вместо полной строки. Разделителя «· » у неё больше нет: она
     стоит не встык к статусу, а под ним. */
  assert.equal(c.status.find('.lumen-status__short').text(), next.getDate() + ' ' + RU_SHORT[next.getMonth()]);
  assert.equal(c.chip.find('.lumen-next-chip__short').text(), '· ' + next.getDate() + ' ' + RU_SHORT[next.getMonth()], 'узел чипа заполняется по-прежнему — он нужен фильму');

  LC.header.decorate(c.root, data);
  assert.equal(c.status._children.filter((n) => n.hasClass('lumen-status__short')).length, 1, 'узел подписи не дублируется');

  /* У фильма карты статуса в ленте нет вовсе, и чип остаётся отдельным. */
  const film = makeCard();
  LC.header.decorate(film.root, { movie: FILM });
  assert.equal(film.status.find('.lumen-status__value').length, 0, 'фильму разметку статуса строить незачем');
  assert.deepEqual(warnLog, []);
});

/* Ревью Task 8 (п.1): «Продолжить» не должно вести на серию, которой ещё нет. */
test('progress: следующая серия ещё не вышла — ни строки, ни подписи на кнопке', () => {
  const c = makeCard();
  const data = serial(4);
  data.episodes.episodes[3].air_date = ymd(dateIn(20));
  withViews({
    [hashOf(2, 1)]: { percent: 100, time: 3060, duration: 3060, updated: 1 },
    [hashOf(2, 2)]: { percent: 100, time: 3120, duration: 3120, updated: 2 },
    [hashOf(2, 3)]: { percent: 100, time: 3180, duration: 3180, updated: 3 }
  }, () => {
    LC.header.decorate(c.root, data);
  });
  assert.ok(c.progress.hasClass('hide'), 'E4 выйдет через 20 дней — продолжать нечего');
  assert.equal(c.root.hasClass('lumen-continue'), false);
  assert.deepEqual(warnLog, []);
});

/* Ревью Task 8 (п.2): синхронизация CUB прогоняет Timeline.update по всему
   changelog — каждая запись не должна вызывать полный обход карточек. */
test('scheduleProgressRefresh: пачка событий Timeline схлопывается в одну перерисовку', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(4));

  const timers = [];
  const realSetTimeout = globalThis.setTimeout;
  globalThis.setTimeout = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
  try {
    for (let i = 0; i < 5; i++) LC.header.scheduleProgressRefresh();
    assert.equal(timers.length, 1, 'пять событий — один таймер');
    assert.ok(timers[0].ms >= 100 && timers[0].ms <= 1000, 'окно коалесценции ~300 мс, получено ' + timers[0].ms);

    withViews({ [hashOf(2, 2)]: { percent: 12, time: 300, duration: 2500, updated: 9 } }, () => {
      timers[0].fn();
      assert.equal(c.pLabel.text(), 'S2 E2 «Серия 2»', 'по срабатыванию таймера строка обновилась');
    });

    LC.header.scheduleProgressRefresh();
    assert.equal(timers.length, 2, 'после срабатывания следующая пачка заводит таймер заново');
    /* Ревью 2 (п.2): второй таймер обязателен к дренажу — иначе модульный флаг
       остался бы взведённым навсегда и любой следующий тест, зовущий
       scheduleProgressRefresh, молча стал бы no-op и «прошёл» по ложной
       причине. */
    timers[1].fn();
  } finally {
    globalThis.setTimeout = realSetTimeout;
  }
  assert.deepEqual(warnLog, []);
});

/* Ревью Task 8 (п.6): в CSS перевод строки — это и form feed (U+000C). */
test('progress: form feed в подписи кнопки заменяется пробелом', () => {
  const c = makeCard();
  const original = LC.lang;
  LC.lang = (key) => (key === 'lumen_card_continue' ? 'Про\fдолжить' : original(key));
  try {
    withViews({ [hashOf(2, 2)]: { percent: 20, time: 100, duration: 1000, updated: 5 } }, () => {
      LC.header.decorate(c.root, serial(3));
    });
  } finally {
    LC.lang = original;
  }
  assert.equal(c.root._css['--lumen-play-label'], '"Про должить S2 E2"');
});

/* Ревью Task 8 (п.4): статус Lampa показывает только при непустом movie.status. */
test('renderNextChip: без видимого статуса класс склейки не ставится', () => {
  const c = makeCard();
  c.status.addClass('hide');
  const data = serial(1);
  data.movie.next_episode_to_air = { air_date: ymd(dateIn(31)) };
  LC.header.decorate(c.root, data);

  /* Статуса на экране нет — подпись вешать некуда, и чип остаётся
     отдельной картой со своей полной строкой. */
  assert.equal(c.chip.hasClass('hide'), false, 'сам чип показывается как обычно');
  assert.equal(c.text.text().indexOf('Следующая серия') === 0, true, 'полная строка осталась в самом чипе');
});

/* Ревью Task 8 (п.7): нераспознанная дата не должна оставлять голое «· ». */
test('renderNextChip: пустая короткая дата не оставляет одиноким разделитель', () => {
  const c = makeCard();
  const data = serial(1);
  data.movie.next_episode_to_air = { air_date: ymd(dateIn(31)) };
  const original = LC.cardinfo.shortDate;
  LC.cardinfo.shortDate = () => '';
  try {
    LC.header.decorate(c.root, data);
  } finally {
    LC.cardinfo.shortDate = original;
  }
  assert.equal(c.chip.find('.lumen-next-chip__short').text(), '');
  assert.deepEqual(warnLog, []);
});

test('refreshProgress: обновление Timeline перерисовывает строку без повторного decorate', () => {
  const c = makeCard();
  LC.header.decorate(c.root, serial(4));
  assert.ok(c.progress.hasClass('hide'), 'ничего не начато — строки нет');

  withViews({ [hashOf(2, 2)]: { percent: 12, time: 300, duration: 2500, updated: 9 } }, () => {
    LC.header.refreshProgress();
    assert.equal(c.progress.hasClass('hide'), false);
    assert.equal(c.pLabel.text(), 'S2 E2 «Серия 2»');
    assert.equal(c.pTime.text(), '· 05:00 / 41:40 · 12 %');
    assert.equal(c.root._css['--lumen-play-label'], '"Продолжить S2 E2"');
  });
  assert.deepEqual(warnLog, []);
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
    runtime: 166, budget: 190000000, genres: [{ name: 'фантастика' }, { name: 'приключения' }],
    production_countries: [{ iso_3166_1: 'US', name: 'United States of America' }]
  },
  persons: { crew: [{ job: 'Director', name: 'Дени Вильнёв' }] }
};

/* Task 59 (фаза 5): страны, режиссёра, жанра и хронометража в таблице больше
   нет — все четыре слово в слово стоят в мета-строке шапки (renderMeta). */
test('descr: таблица «ПОДРОБНО» дописывается в тело ряда, ряд помечен .lumen-descr-row', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, DUNE);

  assert.ok(d.row.hasClass('lumen-descr-row'), 'ряд помечен нашим классом — иначе CSS не применится');
  const facts = factsOf(d);
  assert.equal(facts.length, 1);
  const html = facts[0].html();
  for (const part of ['ПОДРОБНО', 'Оригинал', 'Dune: Part Two', 'Премьера', '29 февраля 2024',
    'Бюджет', '$ 190 000 000']) {
    assert.ok(html.indexOf(part) !== -1, 'нет строки таблицы: ' + part);
  }
  for (const gone of ['Страна', 'США', 'Режиссёр', 'Дени Вильнёв', 'Жанр', 'Фантастика', '2:46']) {
    assert.equal(html.indexOf(gone), -1, 'таблица повторяет мета-строку шапки: ' + gone);
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

/* Ревью Task 5d (Minor 4): decorate ряда приходит дважды на открытие (build
   description и страховочный complite) — второй раз таблица не пересобирается. */
test('descr: тот же e.data — рендер пропущен целиком; изменившиеся данные перерисовывают', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, DUNE);
  const first = factsOf(d)[0];

  LC.header.descr(d.row, DUNE);
  assert.equal(factsOf(d)[0], first, 'узел тот же — повторная сборка пропущена по подписи');

  LC.header.descr(d.row, { movie: { title: 'Дюна', original_title: 'Dune', release_date: '2021-09-15', runtime: 155 } });
  const second = factsOf(d)[0];
  assert.notEqual(second, first, 'данные другие — таблица пересобрана');
  assert.ok(second.html().indexOf('Dune') !== -1);
  assert.equal(factsOf(d).length, 1);
});

/* Ревью Task 5d (M5): язык интерфейса входит в подпись — смена языка обязана
   перерисовать таблицу, иначе подписи остались бы от прошлого языка. */
test('descr: смена языка интерфейса перерисовывает таблицу', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, DUNE);
  const ru = factsOf(d)[0];
  assert.ok(ru.html().indexOf('ПОДРОБНО') !== -1);

  const EN = {
    lumen_card_facts: 'DETAILS', lumen_card_fact_original: 'Original', lumen_card_fact_premiere: 'Premiere',
    lumen_card_fact_creator: 'Creator', lumen_card_fact_budget: 'Budget',
    lumen_card_months_gen: 'January,February,March,April,May,June,July,August,September,October,November,December'
  };
  const original = LC.lang;
  LC.lang = (key) => (Object.prototype.hasOwnProperty.call(EN, key) ? EN[key] : original(key));
  try {
    LC.header.descr(d.row, DUNE);
  } finally {
    LC.lang = original;
  }

  const en = factsOf(d)[0];
  assert.notEqual(en, ru, 'язык другой — таблица пересобрана, а не пропущена по подписи');
  assert.equal(factsOf(d).length, 1);
  assert.ok(en.html().indexOf('DETAILS') !== -1);
  assert.ok(en.html().indexOf('29 February 2024') !== -1, 'месяцы тоже из нового языка');
});

test('descr: значения экранируются — разметка из данных не становится тегом', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, { movie: { title: 'X', original_title: '<b>x</b>', release_date: '2024-01-01' } });
  const html = factsOf(d)[0].html();
  assert.equal(html.indexOf('<b>'), -1, 'тег из данных не должен попасть в разметку');
  assert.ok(html.indexOf('&lt;b&gt;x&lt;/b&gt;') !== -1, 'ожидалось экранированное значение');
});

test('descr: сериал — создатель без повтора меты', () => {
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
  assert.equal(html.indexOf('2 сезона · 16 серий'), -1, 'сезоны и серии уже стоят в мета-строке шапки');
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

/* Фикс-раунд Task 59: описание внизу — единственное, но при включённых
   отзывах CSS поджимает его до восьми строк (.lumen-descr-row--reviews,
   src/30_css.js), а прокрутки внутри ряда у Lampa нет. Значит полный текст
   обязан открываться по OK — как карточка отзыва открывает свой модал. */
function modalLog() {
  const opened = [];
  const prevModal = Lampa.Modal;
  const prevController = Lampa.Controller;
  Lampa.Modal = { open: (params) => opened.push(params), close: () => { } };
  Lampa.Controller = { enabled: () => ({ name: 'full_descr' }), toggle: () => { }, collectionFocus: () => { } };
  return {
    opened,
    restore() { Lampa.Modal = prevModal; Lampa.Controller = prevController; }
  };
}

const OVERVIEW = { movie: Object.assign({}, DUNE.movie, { overview: 'Пол Атрейдес объединяется с Чани и фрименами.' }) };

test('Фикс Task 59: OK на описании открывает модал с полным текстом', () => {
  const d = makeDescrRow();
  const log = modalLog();
  try {
    LC.header.descr(d.row, OVERVIEW);
    fire(d.descr, 'hover:enter', d.text);
    assert.equal(log.opened.length, 1, 'модал не открылся');
    assert.equal(log.opened[0].title, 'Дюна: Часть вторая', 'в шапке окна — название фильма');
    assert.ok(log.opened[0].html.html().indexOf('фрименами') !== -1, 'в окне — полный текст описания');
  } finally {
    log.restore();
  }
});

test('Фикс Task 59: слушатель один на узел, OK мимо описания модала не открывает', () => {
  const d = makeDescrRow();
  const log = modalLog();
  try {
    LC.header.descr(d.row, OVERVIEW);
    LC.header.descr(d.row, OVERVIEW);
    LC.header.descr(d.row, { movie: Object.assign({}, OVERVIEW.movie, { id: 7 }) });
    assert.equal((d.descr._listeners || []).filter((l) => l.type === 'hover:enter').length, 1);
    assert.ok((d.descr._listeners || []).every((l) => l.capture), 'события Lampa не всплывают — только перехват');

    fire(d.descr, 'hover:enter', d.left);
    assert.equal(log.opened.length, 0, 'OK не на описании модала открывать не должен');
  } finally {
    log.restore();
  }
});

test('Фикс Task 59: без описания модала нет, подсказка не показывается', () => {
  const d = makeDescrRow();
  const log = modalLog();
  try {
    LC.header.descr(d.row, DUNE);
    fire(d.descr, 'hover:enter', d.text);
    assert.equal(log.opened.length, 0);
    assert.deepEqual(warnLog, []);
  } finally {
    log.restore();
  }
});

/* Подсказка — отдельный узел БЕЗ .selector: контроллер full_descr собирает
   .selector внутри ряда, и лишний фокусируемый узел изменил бы навигацию
   пультом (тот же инвариант, что у таблицы «ПОДРОБНО»). */
test('Фикс Task 59: подсказка «весь текст» — один узел рядом с описанием, вне навигации', () => {
  const d = makeDescrRow();
  LC.header.descr(d.row, OVERVIEW);
  LC.header.descr(d.row, OVERVIEW);
  const hints = d.left._children.filter((n) => n.hasClass('lumen-descr-more'));
  assert.equal(hints.length, 1);
  assert.equal(hints[0].hasClass('selector'), false, 'подсказка не участвует в навигации пультом');

  /* Карточка без описания — подсказки быть не должно: открывать нечего. */
  LC.header.descr(d.row, { movie: { id: 9, title: 'Без текста', release_date: '2024-01-01' } });
  assert.equal(d.left._children.filter((n) => n.hasClass('lumen-descr-more')).length, 0);
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

/* ------------------------------ правка 2026-09-16 (пп. 1-2) ------------------------------ */

/* Кружки «В ролях» и оригинальное название в шапке убраны вместе со своими
   узлами: первое дублировало ряд актёров Lampa ниже по экрану, второе —
   строку «Оригинал» таблицы «ПОДРОБНО». Вместе с блоками ушли и их рендеры —
   мёртвых веток в decorate не остаётся. */
test('правка 2026-09-16 (пп. 1-2): рендеров каста и оригинального названия больше нет', () => {
  assert.equal(typeof LC.header.refreshCast, 'undefined', 'LC.header.refreshCast убран вместе с блоком');
  const src = readFileSync(new URL('../src/85_header.js', import.meta.url), 'utf8');
  assert.equal(/renderCast|lumen-cast/.test(src), false, 'в 85_header.js не осталось кода блока актёров');
  assert.equal(/renderOriginal|lumen-original/.test(src), false, 'в 85_header.js не осталось кода оригинального названия');
});

/* ====================================================================== */
/* Правка 2026-09-23: логотип названия в карточке (renderLogo). Механика    */
/* ожидания — общая с героем (LC.hero.waitLogo, её тесты — в hero.test);   */
/* здесь — связка карточки: какие классы, когда и что с текстом.           */
/* ====================================================================== */

function logoCard() {
  const c = makeCard();
  const logo = new FakeEl(['lumen-logo']);
  c.root._children.splice(1, 0, logo);
  logo.parent = c.root;
  c.logo = logo;
  return c;
}

/* Заглушка героя: решение логотипа отдаётся тестом вручную (decide). */
function stubHero() {
  const calls = [];
  const hero = {
    calls: calls,
    CARD_TITLE_EM: 3.33,
    pickLogoItem: (logos, lang) => {
      calls.push(['pick', lang]);
      return (logos && logos[0]) || null;
    },
    logoRatioOf: (item) => Number(item.aspect_ratio) || 0,
    cardLogoBox: (r) => (r > 0 ? { w: 4.6, h: 1.55 } : null),
    logoUrl: (path) => 'https://img.test/t/p/w500' + path,
    waitLogo: (path, url, decide) => {
      const h = { path: path, url: url, decide: decide, cancelled: 0, cancel() { h.cancelled++; } };
      calls.push(['wait', path]);
      hero.last = h;
      if (hero.known !== undefined) decide(hero.known);
      return h;
    }
  };
  return hero;
}

function withHero(hero, fn) {
  const prev = LC.hero;
  LC.hero = hero;
  try { return fn(); } finally { LC.hero = prev; }
}

const LOGO_MOVIE = () => ({
  movie: { title: 'Звёздные войны: Эпизод 5 - Империя наносит ответный удар', images: { logos: [{ file_path: '/sw.png', iso_639_1: 'ru', aspect_ratio: 3.3 }] } }
});

test('логотип в карточке: пока исход неизвестен — рамка стоит, заголовок скрыт; доехал — логотип', () => {
  warnLog.length = 0;
  const c = logoCard();
  const hero = stubHero();
  withHero(hero, () => LC.header.decorate(c.root, LOGO_MOVIE()));
  assert.ok(c.root.hasClass('lumen-logo-wait'), 'ожидание не включено — заголовок был бы виден до логотипа');
  assert.equal(c.root.hasClass('lumen-logo-on'), false);
  assert.equal(c.logo.css('width'), '4.6em', 'место под логотип не зарезервировано по пропорции');
  assert.equal(c.logo.css('height'), '1.55em');
  /* Текст заголовка остаётся в DOM (его пишет Lampa) — двухуровневым. */
  assert.ok(c.cardTitle.hasClass('lumen-title--split'));
  hero.last.decide(true);
  assert.ok(c.root.hasClass('lumen-logo-on'));
  assert.equal(c.root.hasClass('lumen-logo-wait'), false);
  assert.ok(String(c.logo.css('background-image')).indexOf('/sw.png') !== -1, 'картинка не поставлена');
  assert.deepEqual(warnLog, []);
});

test('логотип в карточке: не доехал — текст, и классов логотипа нет', () => {
  const c = logoCard();
  const hero = stubHero();
  withHero(hero, () => LC.header.decorate(c.root, LOGO_MOVIE()));
  hero.last.decide(false);
  assert.equal(c.root.hasClass('lumen-logo-wait'), false);
  assert.equal(c.root.hasClass('lumen-logo-on'), false);
  assert.equal(c.logo.css('background-image'), 'none');
});

test('логотип в карточке: build и complite — одно ожидание, второй decorate ничего не перезапускает', () => {
  const c = logoCard();
  const hero = stubHero();
  const data = LOGO_MOVIE();
  withHero(hero, () => {
    LC.header.decorate(c.root, data);
    LC.header.decorate(c.root, data);
  });
  assert.equal(hero.calls.filter((x) => x[0] === 'wait').length, 1, 'второй decorate завёл второе ожидание');
  assert.equal(hero.last.cancelled, 0);
});

test('логотип в карточке: известный исход решается сразу, без видимого ожидания', () => {
  const c = logoCard();
  const hero = stubHero();
  hero.known = true;
  withHero(hero, () => LC.header.decorate(c.root, LOGO_MOVIE()));
  assert.ok(c.root.hasClass('lumen-logo-on'));
  assert.equal(c.root.hasClass('lumen-logo-wait'), false);
});

test('логотип в карточке: нет логотипа — текст сразу, ожидания нет', () => {
  const c = logoCard();
  const hero = stubHero();
  withHero(hero, () => LC.header.decorate(c.root, { movie: { title: 'Без логотипа', images: { logos: [] } } }));
  assert.equal(hero.calls.filter((x) => x[0] === 'wait').length, 0);
  assert.equal(c.root.hasClass('lumen-logo-wait'), false);
  assert.equal(c.root.hasClass('lumen-logo-on'), false);
});

test('логотип в карточке: другой фильм в том же узле отменяет прошлое ожидание', () => {
  const c = logoCard();
  const hero = stubHero();
  withHero(hero, () => {
    LC.header.decorate(c.root, LOGO_MOVIE());
    const first = hero.last;
    LC.header.decorate(c.root, { movie: { title: 'Другой', images: { logos: [{ file_path: '/other.png', aspect_ratio: 4 }] } } });
    assert.equal(first.cancelled, 1, 'ожидание прошлого фильма не отменено');
    /* Позднее решение прошлого фильма узел уже не трогает. */
    first.decide(true);
    assert.ok(c.root.hasClass('lumen-logo-wait'), 'чужое решение сняло ожидание текущего');
  });
});

test('логотип в карточке: настройка выключена — всегда текст; включили на лету — логотип', () => {
  const c = logoCard();
  const hero = stubHero();
  const realGet = Lampa.Storage.get;
  Lampa.Storage.get = (name, def) => (name === 'lumen_card_logo' ? 'false' : def);
  try {
    withHero(hero, () => LC.header.decorate(c.root, LOGO_MOVIE()));
    assert.equal(hero.calls.filter((x) => x[0] === 'wait').length, 0, 'выключенная настройка всё равно ждёт логотип');
    assert.equal(c.root.hasClass('lumen-logo-wait') || c.root.hasClass('lumen-logo-on'), false);
  } finally {
    Lampa.Storage.get = realGet;
  }
  hero.known = true;
  withHero(hero, () => LC.header.applyLogoPref());
  assert.ok(c.root.hasClass('lumen-logo-on'), 'включение на открытой карточке логотип не поставило');
});

test('логотип в карточке: чужой шаблон без узла логотипа — текст, без ошибок', () => {
  warnLog.length = 0;
  const c = makeCard();
  const hero = stubHero();
  withHero(hero, () => LC.header.decorate(c.root, LOGO_MOVIE()));
  assert.equal(hero.calls.filter((x) => x[0] === 'wait').length, 0);
  assert.equal(c.root.hasClass('lumen-logo-wait'), false);
  assert.deepEqual(warnLog, []);
});

/* -------------------- второй экран: обычная прокрутка -------------------- */

/* Волна 2 (ТВ 2026-09-24, B). Постраничность 5da8ae6 откатана: ряд
   описания снова один, блоки отзывов и «Смотреть по порядку» лежат под
   описанием. Lampa внутри ряда не прокручивает (контроллер full_descr
   делает только Navigator.move, app.min.js:38152-38181), поэтому за фокусом
   пульта ведёт bindDescr: блок под фокусом выходит за кромку или выше
   области — Scroll карточки ставит к верху сам блок (Scroll.update,
   app.min.js:32130); фокус в основной части ряда за кадром — к верху сам
   ряд. Мышь страницу не двигает.

   Модель геометрии своя: у каждого узла смещение в теле прокрутки и
   высота, экранное положение считается от прокрутки, как у Lampa
   (getElementPosition, app.min.js:32046-32057: верх узла встаёт на верх
   тела при нулевой прокрутке). Экран 960×540, верх области 65 (html 40 +
   паддинг .scroll__content 25). */
function GNode(cls, off, height, kids) {
  this._cls = cls ? cls.split(/\s+/) : [];
  this._off = off;
  this._h = height;
  this.children = [];
  this.parentNode = null;
  this._listeners = [];
  const self = this;
  this.classList = {
    contains: (c) => self._cls.indexOf(c) !== -1,
    add: (c) => { if (self._cls.indexOf(c) === -1) self._cls.push(c); },
    remove: (c) => { const i = self._cls.indexOf(c); if (i !== -1) self._cls.splice(i, 1); }
  };
  (kids || []).forEach((k) => { k.parentNode = self; self.children.push(k); });
  this[0] = this;
  this.length = 1;
}
GNode.prototype.getBoundingClientRect = function () {
  return { left: 0, top: GNode.scroll.bodyTop() + this._off, width: 900, height: this._h };
};
GNode.prototype.querySelectorAll = function (sel) {
  const cls = sel.replace(/^\./, '');
  const out = [];
  (function walkG(n) { n.children.forEach((c) => { if (c.classList.contains(cls)) out.push(c); walkG(c); }); })(this);
  return out;
};
GNode.prototype.addEventListener = function (type, fn, capture) { this._listeners.push({ type, fn, capture }); };
GNode.prototype.fire = function (type, target) {
  this._listeners.filter((l) => l.type === type).forEach((l) => l.fn({ type: type, target: target }));
};

/* Scroll карточки: html 40…540, у .scroll__content паддинг 25 — верх
   области 65. pos — заказанная прокрутка (scroll_position у Lampa; в
   vieport().position она отрицательная), shown — то, до чего тело уже
   доехало: пока идёт анимация, getBoundingClientRect видит старое
   положение, а vieport — уже новое. settle() — анимация кончилась. */
function descrScroll() {
  const s = { pos: 0, shown: 0, updates: [], wheelCalls: [] };
  const content = { _pad: 25 };
  const html = {
    getBoundingClientRect: () => ({ left: 0, top: 40, width: 960, height: 500 }),
    querySelector: (sel) => (sel === '.scroll__content' ? content : null)
  };
  const body = { getBoundingClientRect: () => ({ left: 0, top: 65 - s.shown, width: 960, height: 3000 }) };
  s.render = () => html;
  s.body = () => body;
  s.vieport = () => ({ position: -s.pos, body: 3000, content: 500 });
  s.update = (el) => { s.updates.push(el); s.pos = el._off; };
  s.settle = () => { s.shown = s.pos; };
  s.bodyTop = () => 65 - s.shown;
  s.onWheel = (step) => s.wheelCalls.push(step);
  return s;
}

/* Ряд описания на втором экране: описание 1000…1188, счётчики 1212…1247,
   блок отзывов 1316…1507 («Скрыть» 1460), франшиза 1528…1803. Ряд Lampa
   поставила к верху области — отзывы на экране 381…572, под кромкой 540. */
function descrRowModel() {
  const text = new GNode('full-descr__text selector', 1000, 188);
  const tag = new GNode('tag-count selector', 1212, 35);
  const left = new GNode('full-descr__left', 1000, 247, [text, new GNode('full-descr__tags', 1212, 35, [tag])]);
  const facts = new GNode('lumen-facts', 1260, 20);
  const hide = new GNode('lumen-reviews__hint-hide selector', 1460, 29);
  const reviews = new GNode('lumen-reviews lumen-reviews--hint', 1316, 191, [hide]);
  const frMode = new GNode('lumen-fr__mode selector', 1532, 22);
  const frCard = new GNode('lumen-fr-card selector', 1574, 227);
  const fr = new GNode('lumen-fr', 1528, 275, [frMode, frCard]);
  const holder = new GNode('full-descr', 1000, 803, [left, facts, reviews, fr]);
  const row = new GNode('items-line lumen-descr-row', 1000, 840, [new GNode('items-line__body', 1000, 803, [holder])]);
  const stranger = new GNode('card selector', 2000, 200);
  return { row, holder, text, tag, facts, reviews, hide, fr, frMode, frCard, stranger };
}

/* Модуль ряда (Emit): первым в списке компонентов — Items карточки со своим
   onToggle (scroll.update ряда, app.min.js:35178-35180), наш встаёт после. */
function descrItemModel(scroll, rowRef) {
  const item = {
    comps: [],
    last: undefined,
    use(m) { this.comps.push(m); },
    emit(name) {
      const key = 'on' + name.charAt(0).toUpperCase() + name.slice(1);
      const args = [].slice.call(arguments, 1);
      this.comps.forEach((m) => { if (typeof m[key] === 'function') m[key].apply(item, args); });
    }
  };
  item.use({ onToggle() { scroll.update(rowRef()); } });
  return item;
}

function withDescr(fn) {
  const prevCs = window.getComputedStyle;
  const prevH = window.innerHeight;
  const prevCtl = Lampa.Controller;
  const scroll = descrScroll();
  GNode.scroll = scroll;
  const c = descrRowModel();
  const item = descrItemModel(scroll, () => c.row);
  const enabled = { name: 'full_descr', controller: { link: item } };
  window.getComputedStyle = (el) => ({ getPropertyValue: (p) => (p === 'padding-top' ? el._pad + 'px' : '') });
  window.innerHeight = 540;
  Lampa.Controller = { enabled: () => enabled };
  /* Lampa уже поставила ряд описания к верху области. */
  scroll.update(c.row);
  scroll.settle();
  scroll.updates.length = 0;
  warnLog.length = 0;
  try {
    fn({ c, item, scroll, enabled, link: { scroll: scroll } });
  } finally {
    window.getComputedStyle = prevCs;
    window.innerHeight = prevH;
    Lampa.Controller = prevCtl;
  }
}

test('B: пульт в блоке под кромкой — к верху области встаёт сам блок, в основной части — ряд', () => {
  withDescr(({ c, item, scroll, link }) => {
    LC.header.bindDescr(item, c.row, link);
    c.holder.fire('hover:focus', c.hide);
    assert.deepEqual(scroll.updates, [c.reviews], 'блок отзывов (381…572) уходил под кромку 540');
    assert.equal(item.last, c.hide, 'возврат в ряд придёт на тот же узел');
    scroll.settle();

    /* Дальше вниз — франшиза: при отзывах у верха она 277…552, снова под
       кромкой. */
    c.holder.fire('hover:focus', c.frCard);
    assert.deepEqual(scroll.updates, [c.reviews, c.fr]);
    scroll.settle();
    c.holder.fire('hover:focus', c.frMode);
    assert.equal(scroll.updates.length, 2, 'блок уже на экране — прокрутки нет');

    /* Вверх: отзывы выше области — к ним; основная часть выше области — к
       ряду. */
    c.holder.fire('hover:focus', c.hide);
    assert.equal(scroll.updates[2], c.reviews);
    scroll.settle();
    c.holder.fire('hover:focus', c.tag);
    assert.equal(scroll.updates[3], c.row, 'фокус в основной части ряда — к верху сам ряд');
    scroll.settle();
    c.holder.fire('hover:focus', c.text);
    assert.equal(scroll.updates.length, 4, 'ряд уже у верха — прокрутки нет');
    assert.deepEqual(warnLog, []);
  });
});

test('B: мышь страницу не двигает, но последний узел ряда помнит', () => {
  withDescr(({ c, item, scroll, link }) => {
    LC.header.bindDescr(item, c.row, link);
    c.holder.fire('hover:hover', c.frCard);
    assert.deepEqual(scroll.updates, [], 'наведение мышью не прокручивает');
    assert.equal(item.last, c.frCard);
    assert.deepEqual(warnLog, []);
  });
});

test('B: блок целиком на экране не прокручивается; узел вне ряда — ничего', () => {
  withDescr(({ c, item, scroll, link }) => {
    /* Короткий ряд: отзывы сразу под описанием и целиком над кромкой. */
    c.reviews._off = 1250;
    c.hide._off = 1300;
    LC.header.bindDescr(item, c.row, link);
    c.holder.fire('hover:focus', c.hide);
    assert.deepEqual(scroll.updates, []);
    c.holder.fire('hover:focus', c.stranger);
    assert.deepEqual(scroll.updates, [], 'узел вне ряда описания не трогается');
    assert.equal(item.last, c.hide, 'чужой узел в last не пишется');
    assert.deepEqual(warnLog, []);
  });
});

test('B: возврат ↑ со следующего ряда — Lampa ставит ряд, мы после неё — блок, где last', () => {
  withDescr(({ c, item, scroll, link }) => {
    LC.header.bindDescr(item, c.row, link);
    item.last = c.frCard;
    scroll.pos = 2200;
    scroll.settle();
    scroll.updates.length = 0;
    /* Controller.toggle модуля ряда: фокус на last (он же шлёт hover:focus),
       затем emit('toggle') — onToggle Items и наш. Тело ещё не доехало:
       расчёт обязан идти от заказанной прокрутки, а не от кадра анимации. */
    c.holder.fire('hover:focus', c.frCard);
    item.emit('toggle');
    assert.equal(scroll.updates[scroll.updates.length - 2], c.row, 'Lampa ставит ряд');
    assert.equal(scroll.updates[scroll.updates.length - 1], c.fr, 'после неё — блок, где фокус');
    assert.equal(scroll.pos, c.fr._off);

    /* last в основной части — после Lampa ничего не добавляем. */
    item.last = c.text;
    scroll.updates.length = 0;
    item.emit('toggle');
    assert.deepEqual(scroll.updates, [c.row]);
    assert.deepEqual(warnLog, []);
  });
});

test('B: контроллер ряда не оборачивается, повторный вызов подписок не множит', () => {
  withDescr(({ c, item, scroll, link }) => {
    LC.header.bindDescr(item, c.row, link);
    LC.header.bindDescr(item, c.row, link);
    const ctrl = { up() {}, down() {} };
    const up = ctrl.up;
    const down = ctrl.down;
    item.emit('controller', ctrl);
    assert.equal(ctrl.up, up, '↑ пульта остаётся штатным');
    assert.equal(ctrl.down, down, '↓ пульта остаётся штатным');
    assert.equal(item.comps.length, 2, 'одна наша подписка на модуль ряда');
    assert.equal(c.holder._listeners.length, 2, 'одна подписка на фокус (два имени события)');
    c.holder.fire('hover:focus', c.hide);
    assert.equal(scroll.updates.length, 1);
  });
});

test('B: колесо мыши — к следующему блоку за кромкой и обратно, дальше — штатный шаг рядами', () => {
  withDescr(({ c, item, scroll, link, enabled }) => {
    LC.header.bindDescr(item, c.row, link);
    scroll.onWheel(1);
    assert.deepEqual(scroll.updates, [c.reviews]);
    scroll.settle();
    scroll.onWheel(1);
    assert.deepEqual(scroll.updates, [c.reviews, c.fr]);
    scroll.settle();
    assert.deepEqual(scroll.wheelCalls, []);
    scroll.onWheel(1);
    assert.deepEqual(scroll.wheelCalls, [1], 'за франшизой — следующий ряд Lampa');

    scroll.onWheel(-1);
    assert.equal(scroll.updates[2], c.reviews);
    scroll.settle();
    scroll.onWheel(-1);
    assert.equal(scroll.updates[3], c.row);
    scroll.settle();
    scroll.onWheel(-1);
    assert.deepEqual(scroll.wheelCalls, [1, -1], 'от верха ряда — предыдущий ряд Lampa');

    /* Активен чужой контроллер — колесо штатное. */
    enabled.controller = { link: {} };
    scroll.onWheel(1);
    assert.deepEqual(scroll.wheelCalls, [1, -1, 1]);
    assert.equal(scroll.updates.length, 4);
    assert.deepEqual(warnLog, []);
  });
});

test('B: без узла ряда, Scroll или модуля — ничего не роняет', () => {
  withDescr(({ c, item, link }) => {
    LC.header.bindDescr(null, c.row, link);
    LC.header.bindDescr(item, null, link);
    LC.header.bindDescr(item, c.row, null);
    c.holder.fire('hover:focus', c.hide);
    assert.deepEqual(warnLog, []);
  });
});

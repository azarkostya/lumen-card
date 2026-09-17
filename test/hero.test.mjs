import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY, fakeQuery, toEl } from './_fakedom.mjs';
import { load } from './_load.mjs';

/* Task 18 (герой на главной). Чистые функции (pickLogo/heroModel/
   shouldUpdate/sizeFor/detailsRequest) проверяются без окружения; жизненный
   цикл (mount/unmount/detach, наблюдатель, задержка 350 мс, отмена запроса и
   предзагрузки кадра) — на фейковых $, MutationObserver, Image и таймерах:
   ровно тех, что модуль читает из глобалов в момент вызова, а не загрузки. */

globalThis.PLUGIN = 'lumen_card';
var warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
const UTIL = load('10_util.js');
const CARDINFO = load('35_cardinfo.js');

/* Слова героя в тестах — латиницей, чтобы проверять состав меты, а не
   перевод: сами строки живут в LC.STRINGS (src/80_settings.js). */
const WORDS = {
  min: 'min',
  airing: 'Airing',
  months: 'jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec'.split(','),
  seasonsWord: function (n) { return n === 1 ? 'season' : 'seasons'; },
  cap: function (s) { return s; },
  lang: 'ru'
};

function freshHero(extra) {
  const LC = Object.assign({ util: UTIL, cardinfo: CARDINFO, motionMode: function () { return 'full'; } }, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC: LC };
}

const H = freshHero().api;

/* ====================================================================== */
/* Чистые функции                                                         */
/* ====================================================================== */

test('pickLogo: язык интерфейса впереди английского и безъязыкого', () => {
  const logos = [
    { file_path: '/en.png', iso_639_1: 'en' },
    { file_path: '/none.png', iso_639_1: null },
    { file_path: '/ru.png', iso_639_1: 'ru' }
  ];
  assert.equal(H.pickLogo(logos, 'ru'), '/ru.png');
  assert.equal(H.pickLogo(logos, 'en'), '/en.png');
  assert.equal(H.pickLogo(logos, 'uk'), '/en.png', 'нет украинского — английский');
});

test('pickLogo: нет языка интерфейса и английского — первый безъязыкий', () => {
  assert.equal(H.pickLogo([{ file_path: '/a.png', iso_639_1: 'de' }, { file_path: '/b.png', iso_639_1: '' }], 'ru'), '/b.png');
});

test('pickLogo: пусто/мусор/без file_path — null', () => {
  assert.equal(H.pickLogo(null, 'ru'), null);
  assert.equal(H.pickLogo([], 'ru'), null);
  assert.equal(H.pickLogo([{ iso_639_1: 'ru' }, null], 'ru'), null);
  assert.equal(H.pickLogo([{ file_path: '/x.png', iso_639_1: 'de' }], 'ru'), null);
});

/* Правка пользователя 2026-09-17 (четвёртый круг), дословно: «нет какого-то
   единого размера». Прошлый круг выровнял логотипы по ВЫСОТЕ рамки, и высота
   у всех стала одна — но у двухстрочного логотипа («Хитрый койот», «Южный
   парк») на эту высоту приходятся две строки букв, то есть буквы вдвое
   мельче, чем у однострочного широкого («Одиссея», «Колония»). Равным должен
   быть видимый размер, а он определяется ПЛОЩАДЬЮ: одно и то же название,
   разбитое на две строки, теряет вдвое по ширине и приобретает вдвое по
   высоте — площадь у него та же. */
test('logoBox: равная площадь вместо равной высоты — узкий логотип выше широкого', () => {
  const narrow = H.logoBox(2.5, false);
  const wide = H.logoBox(6, false);
  assert.ok(narrow.h > wide.h, 'двухстрочный логотип обязан получить больше высоты: ' + JSON.stringify(narrow) + ' / ' + JSON.stringify(wide));
  assert.ok(wide.w > narrow.w, 'однострочный широкий обязан получить больше ширины');
  const areaN = narrow.w * narrow.h;
  const areaW = wide.w * wide.h;
  assert.ok(Math.abs(areaN - areaW) / areaN < 0.01, 'площади обязаны совпадать: ' + areaN + ' и ' + areaW);
});

test('logoBox: клампы — узкому не выше бюджета, очень длинному не шире рамки', () => {
  /* Близкий к квадрату (1.5:1 — замер живьём на одном ряду прошлого круга)
     по площади просил бы 6.58em и съел бы мету: выше бюджета раскладки его
     не пускает верхний кламп. */
  assert.deepEqual(H.logoBox(1.5, false), { w: 7.8, h: 5.2 });
  /* Логотип-баннер 20:1 по площади получил бы 1.8em — нижний кламп поднимает
     его до 2.4em, и тогда в бюджет уже не влезает ШИРИНА: она и решает. */
  const banner = H.logoBox(20, false);
  assert.equal(banner.w, 37.84, 'ширина упирается в рамку: ' + JSON.stringify(banner));
  assert.equal(banner.h, 1.89);

  for (const ratio of [0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 20]) {
    const full = H.logoBox(ratio, false);
    assert.ok(full.h <= 5.2, ratio + ':1 — высота ' + full.h + 'em выше бюджета TEXT_LOGO');
    assert.ok(full.w <= 37.84, ratio + ':1 — ширина ' + full.w + 'em шире рамки');
    const small = H.logoBox(ratio, true);
    assert.ok(small.h <= 3.38, ratio + ':1 сжатый — высота ' + small.h + 'em выше бюджета TEXT_LOGO_SMALL');
    assert.ok(small.w <= 24.6, ratio + ':1 сжатый — ширина ' + small.w + 'em');
  }
});

test('logoBox: сжатое состояние — то же самое, умноженное на 0.65', () => {
  const full = H.logoBox(6, false);
  const small = H.logoBox(6, true);
  assert.deepEqual(small, { w: 12.84, h: 2.14 });
  assert.ok(Math.abs(small.h / full.h - 0.65) < 0.01, 'в сжатом всё пропорционально мельче');
  assert.ok(Math.abs(small.w / full.w - 0.65) < 0.01);
});

test('logoBox: пропорция неизвестна — null, размер остаётся за рамкой из CSS', () => {
  assert.equal(H.logoBox(0, false), null);
  assert.equal(H.logoBox(null, false), null);
  assert.equal(H.logoBox(-3, false), null);
  assert.equal(H.logoBox('нет', false), null);
});

test('heroModel: пропорция логотипа — aspect_ratio TMDB, иначе width/height', () => {
  const card = { id: 1, title: 'Фильм' };
  const withRatio = H.heroModel(card, { images: { logos: [{ file_path: '/a.png', iso_639_1: 'ru', aspect_ratio: 3.21 }] } }, WORDS);
  assert.equal(withRatio.logoRatio, 3.21);
  const withSize = H.heroModel(card, { images: { logos: [{ file_path: '/b.png', iso_639_1: 'ru', width: 800, height: 400 }] } }, WORDS);
  assert.equal(withSize.logoRatio, 2);
  const bare = H.heroModel(card, { images: { logos: [{ file_path: '/c.png', iso_639_1: 'ru' }] } }, WORDS);
  assert.equal(bare.logoRatio, 0, 'пропорции нет — рисуем рамкой по умолчанию');
  assert.equal(H.heroModel(card, null, WORDS).logoRatio, 0);
});

test('mediaOf: media_type важнее признака name', () => {
  assert.equal(H.mediaOf({ media_type: 'tv', title: 'X' }), 'tv');
  assert.equal(H.mediaOf({ name: 'Сериал' }), 'tv');
  assert.equal(H.mediaOf({ title: 'Фильм' }), 'movie');
  assert.equal(H.mediaOf(null), 'movie');
});

test('heroModel: только card_data — заголовок, кадр, год, рейтинг, описание; pending для скелетона', () => {
  const card = {
    id: 969681, title: 'Человек-паук', backdrop_path: '/b.jpg', poster_path: '/p.jpg',
    overview: 'Питер Паркер', release_date: '2026-07-29', vote_average: 7.852
  };
  const m = H.heroModel(card, null, WORDS);
  assert.equal(m.id, 969681);
  assert.equal(m.media, 'movie');
  assert.equal(m.title, 'Человек-паук');
  assert.equal(m.backdrop, '/b.jpg');
  assert.equal(m.poster, '/p.jpg');
  assert.equal(m.logo, null);
  assert.deepEqual(m.meta, ['2026']);
  assert.equal(m.overview, 'Питер Паркер');
  assert.equal(m.rating, '7.9');
  assert.equal(m.status, '');
  assert.equal(m.pending, true, 'деталей нет — скелетон меты и описания');
});

test('heroModel: фильм с деталями — год, длительность, жанры, логотип, описание из деталей', () => {
  const card = { id: 1, title: 'Фильм', backdrop_path: '/b.jpg', overview: 'кратко', release_date: '2026-07-29', vote_average: 7.1 };
  const details = {
    runtime: 145, status: 'Released', overview: 'полное описание',
    genres: [{ name: 'фантастика' }, { name: 'боевик' }, { name: 'приключения' }, { name: 'драма' }],
    images: { logos: [{ file_path: '/ru.png', iso_639_1: 'ru' }] }
  };
  const m = H.heroModel(card, details, WORDS);
  assert.deepEqual(m.meta, ['2026', '2:25', 'фантастика, боевик, приключения'], 'не больше трёх жанров');
  assert.equal(m.overview, 'полное описание');
  assert.equal(m.logo, '/ru.png');
  assert.equal(m.pending, false);
  assert.equal(m.status, '');
});

test('heroModel: сериал — сезоны вместо длительности, статус «Выходит · 17 dec»', () => {
  const card = { id: 2, name: 'Сериал', backdrop_path: '/b.jpg', first_air_date: '2019-07-25', vote_average: 8.4 };
  const details = {
    number_of_seasons: 5, status: 'Returning Series',
    next_episode_to_air: { air_date: '2026-12-17' },
    genres: [{ name: 'драма' }]
  };
  const m = H.heroModel(card, details, WORDS);
  assert.equal(m.media, 'tv');
  assert.deepEqual(m.meta, ['2019', '5 seasons', 'драма']);
  assert.equal(m.status, 'Airing · 17 dec');
});

test('heroModel: сериал без анонса серии — статуса нет', () => {
  const m = H.heroModel({ id: 3, name: 'S', first_air_date: '2010-01-01' }, { number_of_seasons: 1, status: 'Ended' }, WORDS);
  assert.equal(m.status, '');
  assert.deepEqual(m.meta, ['2010', '1 season']);
});

test('heroModel: без карточки — null; нулевой рейтинг не показывается', () => {
  assert.equal(H.heroModel(null, null, WORDS), null);
  assert.equal(H.heroModel({ id: 4, title: 'X', vote_average: 0 }, null, WORDS).rating, '');
});

test('shouldUpdate: тот же id или не выдержана задержка — не обновляем', () => {
  assert.equal(H.shouldUpdate(10, 10, 999, 350), false, 'тот же фильм');
  assert.equal(H.shouldUpdate(10, 11, 120, 350), false, 'быстрое листание');
  assert.equal(H.shouldUpdate(10, 11, 350, 350), true);
  assert.equal(H.shouldUpdate(null, 11, 400, 350), true, 'первый показ');
  assert.equal(H.shouldUpdate(10, null, 400, 350), false, 'нет карточки');
});

test('sizeFor/logoSizeFor: ≤1366 — w1280/w500, выше — original/w780', () => {
  assert.equal(H.sizeFor(1366), 'w1280');
  assert.equal(H.sizeFor(1367), 'original');
  assert.equal(H.sizeFor(3840), 'original');
  assert.equal(H.sizeFor(0), 'w1280', 'ширина неизвестна — дешёвый кадр');
  assert.equal(H.logoSizeFor(1366), 'w500');
  assert.equal(H.logoSizeFor(1920), 'w780');
});

test('detailsRequest: url media/id, images с языком интерфейса, кэш сутки', () => {
  const r = H.detailsRequest('movie', 550, 'ru');
  assert.equal(r.url, 'movie/550');
  assert.deepEqual(r.params, { filter: { append_to_response: 'images', include_image_language: 'ru,en,null' } });
  assert.equal(r.life, 1440);
  assert.deepEqual(H.detailsRequest('tv', 1, 'en').params.filter.include_image_language, 'en,null');
});

/* ====================================================================== */
/* Жизненный цикл: монтирование, наблюдатель, задержка, отмена            */
/* ====================================================================== */

/* Фейковый MutationObserver: запоминает цели и считает disconnect —
   утечка наблюдателя на subtree:true (требование задачи) обязана быть
   видна тестом, а не только живой проверкой. */
function makeEnv(extra) {
  const observers = [];
  const timers = [];
  const images = [];
  const requests = [];

  function FakeObserver(fn) {
    this.fn = fn; this.targets = []; this.disconnects = 0;
    observers.push(this);
  }
  FakeObserver.prototype.observe = function (node, opts) { this.targets.push({ node: node, opts: opts }); };
  FakeObserver.prototype.disconnect = function () { this.disconnects++; };

  function FakeImage() { this.onload = null; this.onerror = null; this.src = ''; images.push(this); }

  const env = {
    observers: observers, timers: timers, images: images, requests: requests,
    now: 100000,
    /* Виртуальное время: выполняются только таймеры, чей срок наступил —
       включая поставленные из уже сработавших колбэков (подмена текста
       через 180 мс ставится внутри показа). Таймаут предзагрузки кадра
       (8 с) при обычном шаге в сотни миллисекунд не срабатывает, как и в
       браузере. */
    advance(ms) {
      env.now += ms;
      for (let round = 0; round < 10; round++) {
        const due = timers.filter((t) => !t.done && t.at <= env.now);
        if (!due.length) return;
        due.forEach((t) => { t.done = true; t.fn(); });
      }
    }
  };

  globalThis.MutationObserver = FakeObserver;
  globalThis.Image = FakeImage;
  globalThis.Date.now = () => env.now;
  globalThis.setTimeout = (fn, ms) => {
    const id = timers.length + 1;
    timers.push({ id: id, fn: fn, ms: ms, at: env.now + ms, done: false });
    return id;
  };
  globalThis.clearTimeout = (id) => { const t = timers[id - 1]; if (t) t.done = true; };

  const Lampa = {
    TMDB: { image: (u) => 'https://img/' + u },
    Api: {
      img: (p, s) => 'https://img/t/p/' + s + p,
      sources: {
        tmdb: {
          get(url, params, ok, err, opts) {
            const req = { url: url, params: params, ok: ok, err: err, opts: opts, cleared: 0 };
            requests.push(req);
            return { clear() { req.cleared++; } };
          }
        }
      }
    },
    Storage: { get: () => 'ru' },
    Activity: { active: () => env.activeActivity || null }
  };
  globalThis.window = { Lampa: Lampa, innerWidth: 1920, MutationObserver: FakeObserver };
  globalThis.Lampa = Lampa;
  globalThis.document = { documentElement: { clientWidth: 1920 }, body: { contains: () => true } };
  globalThis.$ = function (x) { return typeof x === 'string' ? fakeQuery(x) : toEl(x); };

  const hero = freshHero(Object.assign({
    lang: (k) => ({ lumen_card_min: 'min', lumen_hero_airing: 'Airing', lumen_card_months_short: 'jan,feb,mar,apr,may,jun,jul,aug,sep,oct,nov,dec' }[k] || k),
    langCode: () => 'ru',
    seasonsWord: (n) => (n === 1 ? 'season' : 'seasons')
  }, extra || {}));
  env.hero = hero.api;
  env.LC = hero.LC;
  return env;
}

/* Task 29: карточка ряда как в разметке Lampa — с <img class="card__img">
   внутри и собственным прямоугольником: герой снимает с неё источник для
   перехода «постер → кадр» (lastFocus). */
function makeCard(id, title, opts) {
  const img = new FakeEl(['card__img']);
  img.attr('src', opts.poster);
  const card = new FakeEl(['card', 'selector'], [new FakeEl(['card__view'], [img])]);
  card.getBoundingClientRect = () => opts.rect;
  return card;
}

/* Главная: .activity -> .activity__body -> ... -> .scroll__body -> .items-line -> .card */
function makeMain() {
  const card1 = makeCard(11, 'Первый', { poster: 'https://img/t/p/w300/p1.jpg', rect: { left: 100, top: 200, width: 180, height: 270 } });
  card1.card_data = { id: 11, title: 'Первый', backdrop_path: '/b1.jpg', poster_path: '/p1.jpg', overview: 'о первом', release_date: '2024-01-01', vote_average: 7.2 };
  const card2 = makeCard(22, 'Второй', { poster: 'https://img/t/p/w300/p2.jpg', rect: { left: 300, top: 200, width: 180, height: 270 } });
  card2.card_data = { id: 22, title: 'Второй', backdrop_path: '/b2.jpg', poster_path: '/p2.jpg', overview: 'о втором', release_date: '2025-02-02', vote_average: 6.4 };
  const line0 = new FakeEl(['items-line'], [card1]);
  const line1 = new FakeEl(['items-line'], [card2]);
  const scrollBody = new FakeEl(['scroll__body'], [line0, line1]);
  const activity = new FakeEl(['activity', 'activity--active'], [new FakeEl(['activity__body'], [scrollBody])]);
  return { activity: activity, card1: card1, card2: card2, line0: line0, line1: line1 };
}

/* FakeEl не знает index(); герой считает позицию ряда именно им. */
FakeEl.prototype.index = function () {
  const p = this._parentEl;
  return p ? p._children.indexOf(this) : -1;
};
/* classList — наблюдатель читает его у цели мутации. */
Object.defineProperty(FakeEl.prototype, 'classList', {
  configurable: true,
  get() { const self = this; return { contains: (c) => self.hasClass(c) }; }
});

test('mount: герой первым ребёнком активности, класс .lumen-main, один наблюдатель на subtree', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), true);
  assert.equal(main.activity._children[0].hasClass('lumen-hero'), true, 'герой — первый ребёнок');
  assert.equal(main.activity.hasClass('lumen-main'), true);
  assert.equal(env.observers.length, 1);
  assert.deepEqual(env.observers[0].targets[0].opts, { attributes: true, attributeFilter: ['class'], subtree: true });
  assert.deepEqual(warnLog, []);
});

/* Правка пользователя 2026-09-17 (п.2): «Кадр над рядами: выключен». Героя
   нет вовсе — ни узла, ни класса .lumen-main (а значит, и наших правил
   размера карточек), ни наблюдателя, ни запросов деталей. */
test('правка: размер героя «off» — герой не монтируется вовсе', () => {
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_size' ? 'off' : def) });
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), false);
  assert.equal(main.activity._children.filter((c) => c.hasClass('lumen-hero')).length, 0);
  assert.equal(main.activity.hasClass('lumen-main'), false, 'без класса хоста ряды остаются штатными');
  assert.equal(env.observers.length, 0, 'наблюдателя тоже нет');
  assert.deepEqual(warnLog, []);
});

/* Смена размера «выключен» на любой другой возвращает героя на открытую
   главную: гард «тот же корень» сюда не мешает — unmount обнулил состояние. */
test('правка: «off» -> обычный размер возвращает героя на ту же активность', () => {
  let size = 'off';
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_size' ? size : def) });
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), false);
  size = 'medium';
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), true);
  assert.equal(main.activity.hasClass('lumen-main'), true);
  assert.equal(env.observers.length, 1);
});

test('mount: повторный вызов на ту же активность не создаёт второго наблюдателя и второго узла', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  env.hero.mount(main.activity);
  assert.equal(env.observers.length, 1);
  assert.equal(main.activity._children.filter((c) => c.hasClass('lumen-hero')).length, 1);
});

test('mount на другой корень снимает предыдущего героя целиком (наблюдатель один на плагин)', () => {
  const env = makeEnv();
  const a = makeMain();
  const b = makeMain();
  env.hero.mount(a.activity);
  env.hero.mount(b.activity);
  assert.equal(env.observers.length, 2, 'у нового корня свой наблюдатель');
  assert.equal(env.observers[0].disconnects, 1, 'старый отключён');
  assert.equal(a.activity._children.some((c) => c.hasClass('lumen-hero')), false);
  assert.equal(a.activity.hasClass('lumen-main'), false);
});

test('фокус карточки: кадр грузится только после задержки 350 мс, быстрое листание даёт одну загрузку', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  assert.equal(env.images.length, 0, 'до задержки кадр не грузится');

  /* Фокус ушёл на вторую карточку раньше 350 мс — первый таймер снят. */
  env.advance(100);
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);

  env.advance(350);
  assert.equal(env.images.length, 1, 'ровно одна предзагрузка кадра');
  assert.equal(env.images[0].src, 'https://img/t/p/original/b2.jpg', 'кадр карточки, на которой фокус остановился');
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, 'movie/22');
});

test('повторный фокус той же карточки не грузит кадр заново', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  assert.equal(env.images.length, 1);

  env.advance(400);
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  assert.equal(env.images.length, 1, 'тот же id — ни кадра, ни запроса деталей');
  assert.equal(env.requests.length, 1);
});

test('загруженный кадр проявляется вторым слоем, текст берётся из card_data до ответа деталей', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  /* Текст подменяется не сразу: старый уходит за 180 мс (раскадровка 23а). */
  env.advance(200);

  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');
  assert.equal(node.find('.lumen-hero__descr').text(), 'о первом');
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'скелетон меты до ответа деталей');

  env.images[0].onload();
  const a = node.find('.lumen-hero__bg--a');
  const b = node.find('.lumen-hero__bg--b');
  assert.equal(a.hasClass('is-active'), true, 'первый кадр проявлён');
  assert.equal(b.hasClass('is-active'), false);
  assert.equal(a.css('background-image'), 'url("https://img/t/p/original/b1.jpg")');

  /* Ответ деталей дорисовывает мету, жанры и снимает скелетон. */
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное', images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru' }] } });
  assert.equal(node.hasClass('lumen-hero--pending'), false);
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("https://img/t/p/w780/l.png")');
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип есть — текстовый заголовок скрыт CSS');
});

/* Правка четвёртого круга: размер логотипа считается по его пропорции
   (logoBox) и пишется инлайном — в CSS её знать неоткуда. Значит, пересчёт
   нужен и при переходе между полным и сжатым состоянием: инлайн-стиль
   правилу .lumen-hero--compact перебить нечем. */
test('логотип: размер по пропорции и пересчёт при переходе в сжатое состояние', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];
  const logo = node.find('.lumen-hero__logo');

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  env.advance(200);
  env.requests[0].ok({ images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(node.hasClass('lumen-hero--compact'), false, 'первый ряд — полное состояние');
  assert.equal(logo.css('width'), '12.75em');
  assert.equal(logo.css('height'), '5.1em');

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);
  env.advance(400);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'второй ряд — сжатое состояние');
  env.requests[1].ok({ images: { logos: [{ file_path: '/l2.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(logo.css('width'), '8.29em', 'та же пропорция в сжатом — те же размеры × 0.65');
  assert.equal(logo.css('height'), '3.31em');
});

/* Размер кадра «компактный» отдаёт тексту столько же высоты, сколько сжатое
   состояние (бюджет TEXT_LOGO_SMALL в src/30_css.js один на оба случая), —
   значит, и логотип там считается как сжатый, ещё до всякого листания. */
test('логотип: при компактном размере кадра сразу сжатый размер', () => {
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_size' ? 'compact' : def) });
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  env.advance(200);
  env.requests[0].ok({ images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(node.hasClass('lumen-hero--compact'), false, 'первый ряд — состояние всё-таки полное');
  const logo = node.find('.lumen-hero__logo');
  assert.equal(logo.css('width'), '8.29em');
  assert.equal(logo.css('height'), '3.31em');
});

test('логотип без пропорции в ответе TMDB: размер отдаём CSS, style пустым не остаётся', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  env.advance(200);
  env.requests[0].ok({ images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru' }] } });
  const logo = node.find('.lumen-hero__logo');
  assert.ok(!logo.css('width'), 'без пропорции инлайн-ширины быть не должно: ' + logo.css('width'));
  assert.ok(!logo.css('height'));
  /* Ловушка плана 0.2: пустой style="" меняет outerHTML. Фоновая картинка
     на узле есть всегда, поэтому атрибут пустым не становится. */
  assert.ok(logo.attr('style').indexOf('background-image') !== -1, 'style: ' + logo.attr('style'));
});

test('второй ряд в фокусе — компактный герой, возврат на первый снимает класс', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'ряд с индексом 1 — герой сжат');
  /* Правка пользователя 2026-09-17 (второй круг): вместе с кадром класс
     получает и КОРЕНЬ активности — по нему раскладка поднимает ряды на
     освободившуюся высоту. Без него под сжатым кадром оставалась пустая
     полоса в половину экрана. */
  assert.equal(main.activity.hasClass('lumen-rows-up'), true, 'ряды не подняты вслед за кадром');

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  assert.equal(node.hasClass('lumen-hero--compact'), false);
  assert.equal(main.activity.hasClass('lumen-rows-up'), false, 'вернулись на первый ряд — верхнее состояние');
});

test('unmount возвращает ряды в штатную раскладку', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card2.addClass('focus');
  env.observers[0].fn([{ target: main.card2 }]);
  assert.equal(main.activity.hasClass('lumen-rows-up'), true);

  env.hero.unmount();
  assert.equal(main.activity.hasClass('lumen-rows-up'), false, 'без героя область прокрутки обязана быть штатной');
  assert.equal(main.activity.hasClass('lumen-main'), false);
});

test('unmount: узел, класс хоста, наблюдатель, таймер, предзагрузка и запрос деталей снимаются', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  assert.equal(env.requests.length, 1);

  /* Запрос ещё летит, кадр ещё грузится — unmount обязан погасить оба. */
  env.hero.unmount();
  assert.equal(env.hero.active(), false);
  assert.equal(obs.disconnects, 1);
  assert.equal(env.requests[0].cleared, 1);
  assert.equal(env.images[0].onload, null);
  assert.equal(main.activity._children.some((c) => c.hasClass('lumen-hero')), false);
  assert.equal(main.activity.hasClass('lumen-main'), false);
  assert.equal(env.timers.every((t) => t.done), true, 'ни одного живого таймера');
});

test('отложенный показ не рисует в снятого героя (сторож поколения)', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);

  env.hero.unmount();
  env.advance(400);
  assert.equal(env.images.length, 0, 'ушли с главной — кадр не грузится');
  assert.equal(env.requests.length, 0);
  assert.deepEqual(warnLog, []);
});

test('ответ деталей, доехавший после ухода с главной, ничего не рисует', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  env.advance(200);
  const node = main.activity._children[0];

  env.hero.unmount();
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }] });
  assert.equal(node.find('.lumen-hero__meta').text(), '2024', 'мета осталась той, что была до ухода');
  assert.deepEqual(warnLog, []);
});

test('detach: герой остаётся, пока активность его, и снимается при уходе в чужую', () => {
  const env = makeEnv();
  const main = makeMain();
  const other = makeMain();
  env.hero.mount(main.activity);

  env.hero.detach(main.activity);
  assert.equal(env.hero.active(), true, 'та же активность — герой на месте');

  env.hero.detach(other.activity);
  assert.equal(env.hero.active(), false);
  assert.equal(env.observers[0].disconnects, 1);
});

/* opts.compact/hostClass — контракт монтирования в чужой корень (пригодится
   экрану франшизы, Task 25): герой сжат всегда и не смотрит на индекс ряда, а
   класс хоста снимается вместе с ним. На экране сетки подборки этот режим
   пока не включён — см. долг Task 18 (прокрутка lumen_grid). */
test('mount с compact/hostClass: сжат всегда, класс хоста снимается при unmount', () => {
  const env = makeEnv();
  const card = new FakeEl(['card', 'lumen-gcard', 'focus']);
  card.card_data = { id: 33, title: 'Сеточный', backdrop_path: '/b3.jpg', release_date: '2020-05-05' };
  const items = new FakeEl(['lumen-grid__items'], [card]);
  const grid = new FakeEl(['lumen-grid'], [items]);
  new FakeEl(['activity', 'activity--active'], [grid]);

  env.hero.mount(grid, { hostClass: 'lumen-grid--hero', compact: true });
  const node = grid._children[0];
  assert.equal(node.hasClass('lumen-hero'), true);
  assert.equal(node.hasClass('lumen-hero--compact'), true);
  assert.equal(grid.hasClass('lumen-grid--hero'), true);
  assert.equal(grid.hasClass('lumen-rows-up'), true, 'сжатый всегда — значит и место отдано сразу');

  env.observers[0].fn([{ target: card }]);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/original/b3.jpg');
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'компактный герой не разжимается по индексу ряда');

  env.hero.unmount();
  assert.equal(grid.hasClass('lumen-grid--hero'), false);
  assert.equal(grid.hasClass('lumen-rows-up'), false);
});

test('mountCurrent монтирует только главную', () => {
  const env = makeEnv();
  const main = makeMain();
  env.activeActivity = { component: 'full', activity: { render: () => main.activity } };
  env.hero.mountCurrent();
  assert.equal(env.hero.active(), false);

  env.activeActivity = { component: 'main', activity: { render: () => main.activity } };
  env.hero.mountCurrent();
  assert.equal(env.hero.active(), true);
});

test('applyMotion зеркалит режим анимаций на узел героя', () => {
  const env = makeEnv();
  const main = makeMain();
  env.LC.motionMode = () => 'full';
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  assert.equal(node.hasClass('lumen-motion-full'), true);

  env.LC.motionMode = () => 'off';
  env.hero.applyMotion();
  assert.equal(node.hasClass('lumen-motion-off'), true);
  assert.equal(node.hasClass('lumen-motion-full'), false);
});

test('режим off: текст меняется без подмены и БЕЗ загрузки кадра', () => {
  /* В 'off' дорога не плавность (её гасит CSS), а сама загрузка и
     декодирование кадра w1280/original на каждую остановку фокуса — поверх
     кадра, который параллельно тянет сама Lampa (Background.change). */
  const env = makeEnv();
  env.LC.motionMode = () => 'off';
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  assert.equal(node.find('.lumen-hero__text').hasClass('is-swapping'), false);
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');
  assert.equal(env.images.length, 0, 'ни одной предзагрузки кадра');
  /* Task 29: единственный живой таймер — трёхсекундный расчёт акцента; он от
     режима анимаций не зависит (цвет кнопок — не движение). Таймаута
     загрузки кадра при этом нет: кадр в 'off' не запрашивается вовсе. */
  assert.deepEqual(env.timers.filter((t) => !t.done).map((t) => t.ms), [3000], 'ни одного таймаута загрузки');

  /* Текст при этом живой: детали запрашиваются и дорисовываются. */
  assert.equal(env.requests.length, 1);
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное' });
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма');
  assert.equal(env.images.length, 0, 'ответ деталей тоже не тянет кадр');
  assert.deepEqual(warnLog, []);
});

test('режим off: кадр не грузится и когда он есть только в деталях', () => {
  const env = makeEnv();
  env.LC.motionMode = () => 'off';
  const main = makeMain();
  main.card1.card_data = { id: 55, title: 'Без кадра в ряду', release_date: '2022-02-02' };
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  env.advance(400);
  env.requests[0].ok({ backdrop_path: '/late.jpg', runtime: 90, genres: [] });
  assert.equal(env.images.length, 0);
});

test('режимы full и lite кадр грузят — гейт стоит только на off', () => {
  ['full', 'lite'].forEach((mode) => {
    const env = makeEnv();
    env.LC.motionMode = () => mode;
    const main = makeMain();
    main.card1.addClass('focus');
    env.hero.mount(main.activity);
    env.advance(400);
    assert.equal(env.images.length, 1, mode + ': кадр грузится');
  });
});

test('нет кадра — используется постер, слой помечается для размытия', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  obs.fn([{ target: main.card1 }]);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/w500/p.jpg');
  env.images[0].onload();
  assert.equal(node.hasClass('lumen-hero--blur'), true);
});

test('карточка без данных наблюдателя не роняет и не грузит', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const bare = new FakeEl(['card', 'focus']);
  obs.fn([{ target: bare }, { target: null }, { target: main.line0 }]);
  env.advance(400);
  assert.equal(env.images.length, 0);
  assert.deepEqual(warnLog, []);
});

test('детали из кэша приходят синхронно — отложенная подмена текста их не затирает', () => {
  /* Найдено живьём: Lampa отдаёт закэшированный ответ ДО того, как сработает
     подмена текста через 180 мс, и та возвращала модель без деталей —
     мета съезжала на голый год, скелетон горел навсегда. */
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(350);
  /* Ответ деталей доехал раньше подмены текста. */
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное' });
  assert.equal(node.hasClass('lumen-hero--pending'), false);

  env.advance(200);
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма', 'подмена текста пишет последнюю модель');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'скелетон не возвращается');
  assert.deepEqual(warnLog, []);
});

test('ошибка деталей гасит скелетон и переживает отложенную подмену текста', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(350);
  env.requests[0].err({ code: 500 });
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'ждать больше нечего — скелетона нет');
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'остаётся то, что дала карточка ряда');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024');
  assert.deepEqual(warnLog, []);
});

test('пустой ответ деталей равносилен ошибке — скелетон не горит вечно', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(350);
  env.requests[0].ok(null);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--pending'), false);
});

/* ====================================================================== */
/* Task 29: источник перехода «постер → кадр» и отложенный акцент          */
/* ====================================================================== */

test('lastFocus: до фокуса источника нет', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.lastFocus(), null);
});

test('lastFocus: фокус запоминает id, адрес уже отрисованного постера и прямоугольник', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  assert.deepEqual(env.hero.lastFocus(), {
    id: 11,
    poster: 'https://img/t/p/w300/p1.jpg',
    rect: { left: 100, top: 200, width: 180, height: 270 }
  });
});

test('lastFocus: обновляется сразу, не дожидаясь смены героя', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(50);
  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);
  assert.equal(env.hero.lastFocus().id, 22, 'до истечения 350 мс герой ещё первый, а источник — уже второй');
  assert.equal(env.images.length, 0);
});

test('lastFocus: карточка без постера источником не становится', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  const bare = new FakeEl(['card', 'focus']);
  bare.card_data = { id: 33, title: 'Голый' };
  main.line0._children.push(bare);
  bare._parentEl = main.line0;
  obs.fn([{ target: bare }]);
  assert.equal(env.hero.lastFocus(), null);
});

test('lastFocus: снятие героя обнуляет источник', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.hero.unmount();
  assert.equal(env.hero.lastFocus(), null);
});

function accentEnv() {
  const calls = [];
  const env = makeEnv({ accent: { applyFor: (card) => calls.push(card && card.id) } });
  env.calls = calls;
  return env;
}

test('акцент: считается только после трёх секунд покоя фокуса', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(2900);
  assert.deepEqual(env.calls, [], 'до 3 с — ни одного расчёта');
  env.advance(200);
  assert.deepEqual(env.calls, [11]);
});

test('акцент: быстрый проход по ряду не даёт ни одного расчёта', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  for (let i = 0; i < 10; i++) {
    const card = i % 2 ? main.card2 : main.card1;
    card.addClass('focus');
    obs.fn([{ target: card }]);
    env.advance(200);
  }
  assert.deepEqual(env.calls, [], 'фокус нигде не стоял 3 с');
});

test('акцент: считается по карточке, на которой остановились, а не по покинутой', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.advance(1000);
  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);
  env.advance(3100);
  assert.deepEqual(env.calls, [22]);
});

test('акцент: снятие героя гасит отложенный расчёт', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  env.hero.unmount();
  env.advance(5000);
  assert.deepEqual(env.calls, []);
});

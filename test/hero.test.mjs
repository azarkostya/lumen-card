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

/* Главная: .activity -> .activity__body -> ... -> .scroll__body -> .items-line -> .card */
function makeMain() {
  const card1 = new FakeEl(['card', 'selector']);
  card1.card_data = { id: 11, title: 'Первый', backdrop_path: '/b1.jpg', overview: 'о первом', release_date: '2024-01-01', vote_average: 7.2 };
  const card2 = new FakeEl(['card', 'selector']);
  card2.card_data = { id: 22, title: 'Второй', backdrop_path: '/b2.jpg', overview: 'о втором', release_date: '2025-02-02', vote_average: 6.4 };
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

test('второй ряд в фокусе — компактный герой, возврат на первый снимает класс', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const obs = env.observers[0];
  const node = main.activity._children[0];

  main.card2.addClass('focus');
  obs.fn([{ target: main.card2 }]);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'ряд с индексом 1 — герой сжат');

  main.card1.addClass('focus');
  obs.fn([{ target: main.card1 }]);
  assert.equal(node.hasClass('lumen-hero--compact'), false);
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

  env.observers[0].fn([{ target: card }]);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/original/b3.jpg');
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'компактный герой не разжимается по индексу ряда');

  env.hero.unmount();
  assert.equal(grid.hasClass('lumen-grid--hero'), false);
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

test('режим off: текст меняется без промежуточного класса подмены', () => {
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

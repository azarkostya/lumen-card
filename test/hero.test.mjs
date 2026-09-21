import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY, fakeQuery, toEl } from './_fakedom.mjs';
import { load } from './_load.mjs';

/* Task 18 (герой на главной). Чистые функции (pickLogo/heroModel/
   shouldUpdate/sizeFor/detailsRequest) проверяются без окружения; жизненный
   цикл (mount/unmount/detach, слушатель фокуса, задержка 350 мс, отмена
   запроса и предзагрузки кадра) — на фейковых $, Image и таймерах:
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
  const narrow = H.logoBox(2.5);
  const wide = H.logoBox(6);
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
  assert.deepEqual(H.logoBox(1.5), { w: 7.8, h: 5.2 });
  /* Логотип-баннер 20:1 по площади получил бы 1.8em — нижний кламп поднимает
     его до 2.4em, и тогда в бюджет уже не влезает ШИРИНА: она и решает. */
  const banner = H.logoBox(20);
  assert.equal(banner.w, 37.84, 'ширина упирается в рамку: ' + JSON.stringify(banner));
  assert.equal(banner.h, 1.89);

  for (const ratio of [0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 20]) {
    const full = H.logoBox(ratio);
    assert.ok(full.h <= 5.2, ratio + ':1 — высота ' + full.h + 'em выше бюджета TEXT_LOGO');
    assert.ok(full.w <= 37.84, ratio + ':1 — ширина ' + full.w + 'em шире рамки');
  }
});

/* Task 36: прежний тест «сжатое состояние — то же самое, умноженное на 0.65»
   удалён вместе со вторым аргументом logoBox. Уменьшение логотипа при
   листании делает теперь CSS (transform: scale, правило
   .lumen-hero--compact .lumen-hero__logo), потому что пара width/height
   анимировалась раскладкой. Здесь проверяем контракт: размер от состояния
   кадра не зависит вовсе. */
test('logoBox: размер не зависит от состояния кадра — сжатие делает CSS', () => {
  assert.deepEqual(H.logoBox(6, true), H.logoBox(6), 'второго аргумента у logoBox больше нет');
  assert.deepEqual(H.logoBox(6), { w: 19.75, h: 3.29 });
});

test('logoBox: пропорция неизвестна — null, размер остаётся за рамкой из CSS', () => {
  assert.equal(H.logoBox(0), null);
  assert.equal(H.logoBox(null), null);
  assert.equal(H.logoBox(-3), null);
  assert.equal(H.logoBox('нет'), null);
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
  /* Task 43 (фикс-раунд): порог тот же, что у подписи карточки ряда
     (src/62_badges.js, rate) — иначе в кадре стояло бы «★ 0.0», а в ряду под
     ним ничего. Сравнение с 1 заодно отсекает NaN. */
  assert.equal(H.heroModel({ id: 5, title: 'X', vote_average: 0.04 }, null, WORDS).rating, '');
  assert.equal(H.heroModel({ id: 6, title: 'X', vote_average: 1 }, null, WORDS).rating, '1.0');
  assert.equal(H.heroModel({ id: 7, title: 'X', vote_average: 'нет' }, null, WORDS).rating, '');
});

test('shouldUpdate: тот же id или не выдержана задержка — не обновляем', () => {
  assert.equal(H.shouldUpdate(10, 10, 999, 350), false, 'тот же фильм');
  assert.equal(H.shouldUpdate(10, 11, 120, 350), false, 'быстрое листание');
  assert.equal(H.shouldUpdate(10, 11, 350, 350), true);
  assert.equal(H.shouldUpdate(null, 11, 400, 350), true, 'первый показ');
  assert.equal(H.shouldUpdate(10, null, 400, 350), false, 'нет карточки');
});

/* Task 39: аргумент обеих функций — ФИЗИЧЕСКИЕ пиксели, а не CSS-ширина
   окна. У кадра общий порог LC.util.frameSize, у логотипа — его собственная
   рамка (LOGO_EM × TEXT_ZOOM). */
test('sizeFor: кадр героя — original только выше 1080p', () => {
  assert.equal(H.sizeFor(1366), 'w1280', 'узкое окно');
  assert.equal(H.sizeFor(1920), 'w1280', 'Task 47: на Full HD платим апскейлом за память');
  assert.equal(H.sizeFor(3840), 'original');
  assert.equal(H.sizeFor(0), 'w1280', 'ширина неизвестна — дешёвый кадр');
});

/* Ревью Task 39 (п.2, п.4): рамка логотипа — 950 px на экране 1920 (em
   внутри .lumen-hero__text дороже базового в 1.1 раза), а w780 — потолок:
   следующая ступень у логотипов сразу original, то есть PNG с альфой на
   2000+ px. */
test('logoSizeFor: по ширине самого логотипа, потолок w780', () => {
  assert.equal(H.logoSizeFor(0), 'w500', 'ширина неизвестна — дешёвый');
  assert.equal(H.logoSizeFor(500), 'w500');
  assert.equal(H.logoSizeFor(950), 'w780', 'рамка логотипа на экране 1920');
  assert.equal(H.logoSizeFor(1900), 'w780', 'та же рамка при DPR 2 — выше потолка не идём');
});

test('detailsRequest: url media/id, images с языком интерфейса, кэш сутки', () => {
  const r = H.detailsRequest('movie', 550, 'ru');
  assert.equal(r.url, 'movie/550');
  /* Task 21 (фаза 3): к логотипам добавлены ключевые слова — по ним герой
     выбирает тематическую атмосферу кадра, отдельного запроса на это нет. */
  assert.deepEqual(r.params, { filter: { append_to_response: 'images,keywords', include_image_language: 'ru,en,null' } });
  assert.equal(r.life, 1440);
  assert.deepEqual(H.detailsRequest('tv', 1, 'en').params.filter.include_image_language, 'en,null');
});

/* ====================================================================== */
/* Жизненный цикл: монтирование, наблюдатель, задержка, отмена            */
/* ====================================================================== */

/* Task 37: фокус ловится нативным слушателем 'hover:focus' в фазе захвата, и
   MutationObserver на горячем пути больше не участвует вовсе — на ТВ одно
   нажатие стрелки давало десятки мутаций класса по всей активности. Ловушка
   ниже роняет любой тест, который снова заведёт наблюдателя. */
function makeEnv(extra) {
  const timers = [];
  const images = [];
  const requests = [];

  function ForbiddenObserver() { throw new Error('MutationObserver must not be used'); }

  function FakeImage() { this.onload = null; this.onerror = null; this.src = ''; images.push(this); }

  const env = {
    timers: timers, images: images, requests: requests,
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

  globalThis.MutationObserver = ForbiddenObserver;
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
    Activity: { active: () => env.activeActivity || null },
    /* Task 49: штатный фон Lampa. change — обычное свойство объекта-литерала
       Lampa.Background (vendor/lampa/app.min.js:31563-31570), поэтому его и
       можно обернуть; здесь он считает вызовы, дошедшие до оригинала. */
    Background: { change: (url) => { env.bgCalls.push(url); } }
  };
  env.Lampa = Lampa;
  env.bgCalls = [];
  env.bgOrig = Lampa.Background.change;
  /* Классы на body: герой помечает им свою главную (lumen-main-on), под этой
     меткой CSS гасит фон Lampa, а обёртка Background.change — его загрузку. */
  const bodyClasses = [];
  env.bodyClasses = bodyClasses;
  globalThis.window = { Lampa: Lampa, innerWidth: 1920, MutationObserver: ForbiddenObserver };
  globalThis.Lampa = Lampa;
  globalThis.document = {
    documentElement: { clientWidth: 1920 },
    body: {
      contains: () => true,
      classList: {
        add: (c) => { if (bodyClasses.indexOf(c) === -1) bodyClasses.push(c); },
        remove: (c) => { const i = bodyClasses.indexOf(c); if (i !== -1) bodyClasses.splice(i, 1); },
        contains: (c) => bodyClasses.indexOf(c) !== -1
      }
    }
  };
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
  /* Task 37: замер раскладки ушёл с горячего пути фокуса в момент открытия
     карточки (LC.transition.open, src/67_transition.js). Герой не имеет права
     звать getBoundingClientRect вовсе — здесь это ловушка; сам прямоугольник
     лежит рядом, его читает уже слой перехода со своего фейка. */
  card._rect = opts.rect;
  card.getBoundingClientRect = () => { throw new Error('layout read in hot path'); };
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

/* Task 37: перевод фокуса. Событие 'hover:focus' у Lampa не всплывает
   (bubbles:false), поэтому герой ловит его нативным слушателем в фазе
   ЗАХВАТА на корне активности — тест зовёт ровно тот слушатель, что там
   зарегистрирован, и попутно проверяет, что он ОДИН: вторая подписка на тот
   же корень (повторный mount без снятия) сломала бы этот вызов. */
function focusListeners(root) {
  return (root._listeners || []).filter((l) => l.type === 'hover:focus' && l.capture);
}

function fireFocus(root, target) {
  const list = focusListeners(root);
  assert.equal(list.length, 1, 'на корне обязан жить ровно один capture-слушатель фокуса');
  list[0].fn({ target: target });
}

test('mount: герой первым ребёнком активности, класс .lumen-main, один слушатель фокуса', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), true);
  assert.equal(main.activity._children[0].hasClass('lumen-hero'), true, 'герой — первый ребёнок');
  assert.equal(main.activity.hasClass('lumen-main'), true);
  /* Task 37: подписка ровно одна и именно в фазе захвата — 'hover:focus' не
     всплывает, на фазе всплытия его не видно вовсе. */
  assert.equal(focusListeners(main.activity).length, 1);
  assert.deepEqual(warnLog, []);
});

/* Правка пользователя 2026-09-17 (п.2): «Кадр над рядами: выключен». Героя
   нет вовсе — ни узла, ни класса .lumen-main (а значит, и наших правил
   размера карточек), ни слушателя фокуса, ни запросов деталей. */
test('правка: размер героя «off» — герой не монтируется вовсе', () => {
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_size' ? 'off' : def) });
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), false);
  assert.equal(main.activity._children.filter((c) => c.hasClass('lumen-hero')).length, 0);
  assert.equal(main.activity.hasClass('lumen-main'), false, 'без класса хоста ряды остаются штатными');
  assert.equal(focusListeners(main.activity).length, 0, 'слушателя фокуса тоже нет');
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
  assert.equal(focusListeners(main.activity).length, 1);
});

/* Task 37, суть задачи: горячий путь фокуса живёт без MutationObserver.
   Ловушка стоит и в globalThis, и в window — герой читал его оттуда в момент
   вызова, а не загрузки, и обе двери обязаны быть закрыты. */
test('фокус: ни монтирование, ни обработка фокуса не трогают MutationObserver', () => {
  const env = makeEnv();
  const main = makeMain();
  assert.throws(() => new globalThis.MutationObserver(() => {}), /must not be used/);
  assert.equal(globalThis.window.MutationObserver, globalThis.MutationObserver);

  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), true, 'монтирование обошлось без наблюдателя');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/w1280/b1.jpg', 'фокус обработан');
  assert.deepEqual(warnLog, []);
});

test('mount: повторный вызов на ту же активность не создаёт второго слушателя и второго узла', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  env.hero.mount(main.activity);
  assert.equal(focusListeners(main.activity).length, 1);
  assert.equal(main.activity._children.filter((c) => c.hasClass('lumen-hero')).length, 1);
});

/* Task 37: слушатель живёт на узле активности, а не на document — утечка
   выглядела бы как вторая подписка на том же корне после повторного
   монтирования, и именно это здесь проверяется. */
test('mount: снятие и повторное монтирование оставляют один слушатель фокуса', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  env.hero.unmount();
  assert.equal(focusListeners(main.activity).length, 0, 'unmount снял подписку');

  env.hero.mount(main.activity);
  assert.equal(focusListeners(main.activity).length, 1, 'после второго монтирования слушатель по-прежнему один');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images.length, 1, 'и он рабочий: фокус дошёл до героя');
});

test('mount на другой корень снимает предыдущего героя целиком (слушатель один на плагин)', () => {
  const env = makeEnv();
  const a = makeMain();
  const b = makeMain();
  env.hero.mount(a.activity);
  env.hero.mount(b.activity);
  assert.equal(focusListeners(b.activity).length, 1, 'у нового корня своя подписка');
  assert.equal(focusListeners(a.activity).length, 0, 'со старого корня слушатель снят');
  assert.equal(a.activity._children.some((c) => c.hasClass('lumen-hero')), false);
  assert.equal(a.activity.hasClass('lumen-main'), false);
});

/* ====================================================================== */
/* Task 49: фон Lampa под нашей главной                                   */
/* ====================================================================== */

/* Штатный фон Lampa — .background с тремя канвасами внутри
   (vendor/lampa/app.min.js:31225); промоутятся по CSS все четыре узла —
   fixed на весь экран + will-change:opacity (vendor/lampa/css/
   app.css:2320-2344), рисуемых поверхностей три (у корня своего
   содержимого нет). Под нашей главной фона не видно (кадр героя сверху,
   P.bg под рядами), а Background.change на каждой остановке фокуса грузит
   кадр (vendor/lampa/app.min.js:52722 зовёт change в card.onFocus;
   cardImgBackground там же:4298-4308 отдаёт w1280, если включена настройка
   «Фон», background_type равен 'poster' и окно шире 790, иначе постер
   размером из poster_size) и читает его пиксели канвасом (Color.get в
   load, там же:31496; getImageData — :5210). Метка на body закрывает и то
   и другое: по ней гаснет CSS, по ней же обёртка не пускает вызов к
   оригиналу. */
test('Task 49: mount метит body классом lumen-main-on, unmount снимает', () => {
  const env = makeEnv();
  const main = makeMain();
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1, 'до монтирования метки нет');
  env.hero.mount(main.activity);
  assert.ok(env.bodyClasses.indexOf('lumen-main-on') !== -1, 'метка главной не поставлена');
  env.hero.unmount();
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1, 'метка осталась на body после снятия героя');
  assert.deepEqual(warnLog, []);
});

/* Герой на ДРУГОМ экране (mount с чужим hostClass — франшиза, см.
   комментарий к mount в src/48_hero.js). Там нет корня .lumen-main, а
   значит и его background-color: погаси мы фон Lampa меткой на body,
   экран остался бы на чёрном. */
test('Task 49: на чужом hostClass метки на body нет и фон Lampa не глушится', () => {
  const env = makeEnv();
  const other = makeMain();
  env.hero.mount(other.activity, { hostClass: 'lumen-franchise' });
  assert.equal(env.hero.active(), true, 'герой смонтирован');
  assert.equal(other.activity.hasClass('lumen-franchise'), true, 'корень получил свой класс');
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1, 'метка главной поставлена на чужом экране');
  assert.equal(env.Lampa.Background.change, env.bgOrig, 'фон чужого экрана оборачивать нельзя');
  env.Lampa.Background.change('u');
  assert.deepEqual(env.bgCalls, ['u'], 'вызов обязан доходить до Lampa');
});

/* Герой выключен настройкой — главная штатная, и фон Lampa обязан остаться
   её фоном: метки нет, оборачивать нечего. */
test('Task 49: размер героя «off» — метки на body нет', () => {
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_size' ? 'off' : def) });
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1);
  assert.equal(env.Lampa.Background.change, env.bgOrig, 'оборачивать нечего — героя нет');
});

test('Task 49: под нашей главной Background.change не доходит до оригинала', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.notEqual(env.Lampa.Background.change, env.bgOrig, 'обёртка не поставлена');
  env.Lampa.Background.change('https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(env.bgCalls, [], 'вызов дошёл до оригинала: фон будет загружен и разобран канвасом');
});

test('Task 49: после unmount оригинал восстановлен и работает', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  env.hero.unmount();
  assert.equal(env.Lampa.Background.change, env.bgOrig, 'оригинал не вернули на место');
  env.Lampa.Background.change('https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(env.bgCalls, ['https://img/t/p/w1280/b1.jpg'], 'фон Lampa за пределами главной обязан работать');
});

/* Кто-то переопределил change ПОСЛЕ нас (другой плагин). Вернуть туда наш
   оригинал — значит стереть чужую работу, поэтому unmount оставляет чужое
   значение как есть. Метка с body при этом снята, и наша обёртка — если она
   осталась в чужой цепочке — вызовы уже пропускает. */
test('Task 49: чужое переопределение change после нас unmount не затирает', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const foreign = (url) => { env.bgCalls.push('foreign:' + url); };
  env.Lampa.Background.change = foreign;
  env.hero.unmount();
  assert.equal(env.Lampa.Background.change, foreign, 'чужую обёртку затёрли нашим оригиналом');
  env.Lampa.Background.change('u');
  assert.deepEqual(env.bgCalls, ['foreign:u']);
});

/* Обёртка ставится один раз на монтирование: повторный mount того же корня
   не имеет права обернуть уже обёрнутое — иначе каждый возврат на главную
   наращивал бы цепочку, а восстановить оригинал стало бы нечем. */
test('Task 49: повторное монтирование не наращивает цепочку обёрток', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const wrap = env.Lampa.Background.change;
  env.hero.mount(main.activity);
  assert.equal(env.Lampa.Background.change, wrap, 'обёртка обёрнута второй раз');
  env.hero.unmount();
  assert.equal(env.Lampa.Background.change, env.bgOrig, 'после одного unmount оригинал обязан вернуться');
});

/* Смена корня (главная -> главная) проходит через unmount внутри mount:
   оригинал возвращается и оборачивается заново, метка остаётся. */
test('Task 49: mount на другой корень оставляет ровно одну обёртку и метку', () => {
  const env = makeEnv();
  const a = makeMain();
  const b = makeMain();
  env.hero.mount(a.activity);
  env.hero.mount(b.activity);
  assert.ok(env.bodyClasses.indexOf('lumen-main-on') !== -1, 'метка снята при переезде героя');
  env.hero.unmount();
  assert.equal(env.Lampa.Background.change, env.bgOrig);
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1);
});

test('фокус карточки: кадр грузится только после задержки 350 мс, быстрое листание даёт одну загрузку', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  assert.equal(env.images.length, 0, 'до задержки кадр не грузится');

  /* Фокус ушёл на вторую карточку раньше 350 мс — первый таймер снят. */
  env.advance(100);
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);

  env.advance(350);
  assert.equal(env.images.length, 1, 'ровно одна предзагрузка кадра');
  assert.equal(env.images[0].src, 'https://img/t/p/w1280/b2.jpg', 'кадр карточки, на которой фокус остановился');
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, 'movie/22');
});

test('повторный фокус той же карточки не грузит кадр заново', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images.length, 1);

  env.advance(400);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images.length, 1, 'тот же id — ни кадра, ни запроса деталей');
  assert.equal(env.requests.length, 1);
});

test('загруженный кадр проявляется вторым слоем, текст берётся из card_data до ответа деталей', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
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
  assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg');

  /* Ответ деталей дорисовывает мету, жанры и снимает скелетон. */
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное', images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru' }] } });
  assert.equal(node.hasClass('lumen-hero--pending'), false);
  /* Task 43: рейтинг — последний элемент той же строки, отдельного чипа нет. */
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("https://img/t/p/w780/l.png")');
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип есть — текстовый заголовок скрыт CSS');
});

/* Task 40: монтирование героя на главной — точка замера автодетекта. До
   Task 40 мерилось только открытие карточки, и до третьей открытой карточки
   главная работала в полном режиме. */
test('Task 40: монтирование героя запускает замер автодетекта, помеченный как main', () => {
  const tracks = [];
  const env = makeEnv({ perf: { track: (source) => tracks.push(source) } });
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.deepEqual(tracks, ['main'], 'замер начат после того, как герой собран, и помечен источником');
  /* Повторный mount той же активности героя не пересобирает — и не мерит.
     Источник нужен как раз здесь: главной разрешён один замер за запуск
     (ревью Task 40, п.5), а mount() зовётся на каждом возврате из карточки. */
  env.hero.mount(main.activity);
  assert.deepEqual(tracks, ['main']);
  assert.deepEqual(warnLog, []);
});

/* Task 40: при выключенных тяжёлых эффектах кроссфейда нет — кадр
   подменяется в одном и том же слое, а второй полноэкранный слой остаётся
   пустым навсегда. Два таких слоя одновременно — это и есть цена плавной
   смены кадра на главной. */
test('Task 40: без тяжёлых эффектов кадр меняется в одном слое, второй не используется', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  const a = node.find('.lumen-hero__bg--a');
  const b = node.find('.lumen-hero__bg--b');

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.images[0].onload();
  assert.equal(a.hasClass('is-active'), true);
  assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.equal(b.hasClass('is-active'), false, 'второй слой не поднимался');

  /* Вторая карточка: кадр обязан приехать в ТОТ ЖЕ слой. */
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  env.images[env.images.length - 1].onload();
  assert.equal(a.attr('src'), 'https://img/t/p/w1280/b2.jpg', 'подмена в том же слое');
  assert.equal(b.hasClass('is-active'), false, 'второй слой так и не понадобился');
  assert.equal(b.attr('src'), undefined, 'во втором слое картинки нет вовсе');
});

/* Правка четвёртого круга: размер логотипа считается по его пропорции
   (logoBox) и пишется инлайном — в CSS её знать неоткуда.
   Task 36: при переходе в сжатое состояние инлайн больше НЕ пересчитывается.
   Уменьшение делает CSS масштабом, а масштаб раскладку не трогает — значит
   и переписывать width/height при каждом setCompact незачем. Тест закрывает
   именно это: пара чисел обязана пережить переход неизменной. */
test('логотип: размер по пропорции и неизменность при переходе в сжатое состояние', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  const logo = node.find('.lumen-hero__logo');

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.advance(200);
  env.requests[0].ok({ images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(node.hasClass('lumen-hero--compact'), false, 'первый ряд — полное состояние');
  assert.equal(logo.css('width'), '12.75em');
  assert.equal(logo.css('height'), '5.1em');

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'второй ряд — сжатое состояние');
  env.requests[1].ok({ images: { logos: [{ file_path: '/l2.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(logo.css('width'), '12.75em', 'инлайн-размер переход не трогает — мельче логотип делает CSS');
  assert.equal(logo.css('height'), '5.1em');
});

/* Task 36: тест «при компактном размере кадра сразу сжатый размер» удалён.
   Он проверял, что герой САМ считает уменьшенный логотип, когда размер кадра
   «компактный»; теперь это делает CSS одним правилом (масштаб в базовом
   правиле .lumen-hero__logo при компактном кадре), и знать про размер кадра
   в 48_hero.js больше незачем. */

test('логотип без пропорции в ответе TMDB: размер отдаём CSS, style пустым не остаётся', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
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
  const node = main.activity._children[0];

  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'ряд с индексом 1 — герой сжат');
  /* Правка пользователя 2026-09-17 (второй круг): вместе с кадром класс
     получает и КОРЕНЬ активности — по нему раскладка поднимает ряды на
     освободившуюся высоту. Без него под сжатым кадром оставалась пустая
     полоса в половину экрана. */
  assert.equal(main.activity.hasClass('lumen-rows-up'), true, 'ряды не подняты вслед за кадром');

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  assert.equal(node.hasClass('lumen-hero--compact'), false);
  assert.equal(main.activity.hasClass('lumen-rows-up'), false, 'вернулись на первый ряд — верхнее состояние');
});

test('unmount возвращает ряды в штатную раскладку', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  assert.equal(main.activity.hasClass('lumen-rows-up'), true);

  env.hero.unmount();
  assert.equal(main.activity.hasClass('lumen-rows-up'), false, 'без героя область прокрутки обязана быть штатной');
  assert.equal(main.activity.hasClass('lumen-main'), false);
});

test('unmount: узел, класс хоста, слушатель, таймер, предзагрузка и запрос деталей снимаются', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.requests.length, 1);

  /* Запрос ещё летит, кадр ещё грузится — unmount обязан погасить оба. */
  env.hero.unmount();
  assert.equal(env.hero.active(), false);
  assert.equal(focusListeners(main.activity).length, 0, 'слушатель фокуса снят');
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
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);

  env.hero.unmount();
  env.advance(400);
  assert.equal(env.images.length, 0, 'ушли с главной — кадр не грузится');
  assert.equal(env.requests.length, 0);
  assert.deepEqual(warnLog, []);
});

/* Task 43: чипа рейтинга больше нет — оценка стоит последним элементом
   строки меты. У фильма без оценки (vote_average 0) строка обязана
   кончаться жанром, без висящего разделителя. */
test('Task 43: фильм без оценки — мета без хвостового разделителя', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.card_data.vote_average = 0;
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.advance(200);
  const node = main.activity._children[0];

  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }] });
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма');
  assert.equal(node.find('.lumen-hero__rate').length, 0, 'узла чипа рейтинга в разметке нет');
  assert.deepEqual(warnLog, []);
});

test('ответ деталей, доехавший после ухода с главной, ничего не рисует', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.advance(200);
  const node = main.activity._children[0];

  env.hero.unmount();
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }] });
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · ★ 7.2', 'мета осталась той, что была до ухода');
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
  assert.equal(focusListeners(main.activity).length, 0, 'слушатель снят вместе с героем');
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

  fireFocus(grid, card);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/w1280/b3.jpg');
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
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
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
  /* Task 43: рейтинг — последний элемент той же строки, отдельного чипа нет. */
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
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

/* Task 38: размер постера для размытого фона снижен с w500 до w92. Блюр
   фильтром снят (src/30_css.js, .lumen-hero__bg--blur), и мягкость даёт
   теперь апскейл картинки — значит и проверять надо именно крошечный
   размер. */
test('нет кадра — используется постер в w92, слой помечается для размытия', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/w92/p.jpg');
  env.images[0].onload();
  /* Task 52: метка стоит на СЛОЕ, который этот постер и показывает, а не на
     корне героя. */
  assert.equal(node.find('.lumen-hero__bg--a').hasClass('lumen-hero__bg--blur'), true);
  assert.equal(node.hasClass('lumen-hero--blur'), false, 'метка на корне героя больше не ставится');
});

/* Task 52. Пользователь на Philips 50PUS8057 (2026-09-21): «при листании
   картинка сначала нормально центрировалась, а потом съехала».

   Разбор: наезд scale(1.1), которым герой прячет края растянутого из w92
   постера, стоял правилом по КОРНЮ героя (.lumen-hero--blur) и доставался
   ОБОИМ слоям кадра сразу. На переходе «фильм без backdrop → фильм с
   backdrop» класс снимался с корня в тот же миг, когда новый кадр вставал в
   свой слой, — и настоящая картинка появлялась уже уменьшенной на 10 %
   относительно того, что было на экране мгновение назад.

   Тест закрывает обе ветки swapFrame: с кроссфейдом (кадр приезжает в
   ДРУГОЙ слой) и без него (кадр подменяется в том же самом). */
test('Task 52: метка размытия живёт на слое кадра, а не на корне героя', () => {
  for (const heavy of [true, false]) {
    const env = makeEnv({ fxHeavy: () => heavy });
    const main = makeMain();
    /* Первая карточка — без backdrop: герой соберёт кадр из постера и
       пометит слой для наезда. Вторая — с настоящим кадром. */
    main.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
    env.hero.mount(main.activity);
    const node = main.activity._children[0];
    const a = node.find('.lumen-hero__bg--a');
    const b = node.find('.lumen-hero__bg--b');
    const label = heavy ? 'с кроссфейдом' : 'без кроссфейда';

    main.card1.addClass('focus');
    fireFocus(main.activity, main.card1);
    env.advance(400);
    env.images[env.images.length - 1].onload();
    assert.equal(a.hasClass('lumen-hero__bg--blur'), true, label + ': слой с постером не помечен');
    assert.equal(a.hasClass('is-active'), true, label + ': помечен не тот слой, что на экране');
    assert.equal(node.hasClass('lumen-hero--blur'), false, label + ': метка вернулась на корень героя');

    /* Настоящий кадр: на слое, который его показывает, метки быть не должно.
       А вот с УХОДЯЩЕГО слоя её не снимают: при кроссфейде он ещё
       непрозрачен (переход opacity .6s, src/30_css.js), а наезд снимается
       мгновенно и без перехода — зритель увидел бы, как размытый постер
       скачком ужался на 10 %, то есть ровно ту жалобу, которую Task 52 и
       лечит, только на уходящем слое. Правильность от этого не страдает:
       приходящему слою метку каждый раз выставляет toggleClass. */
    main.card1.removeClass('focus');
    main.card2.addClass('focus');
    fireFocus(main.activity, main.card2);
    env.advance(400);
    env.images[env.images.length - 1].onload();
    const arrived = heavy ? b : a;
    assert.equal(arrived.hasClass('lumen-hero__bg--blur'), false, label + ': метка осталась на слое с настоящим кадром');
    if (heavy) assert.equal(a.hasClass('lumen-hero__bg--blur'), true, label + ': метку сняли с уходящего слоя — он ужмётся на 10 % посреди кроссфейда');
    /* И кадр действительно сменился — иначе проверка выше ничего не стоит. */
    const shown = heavy ? b : a;
    assert.equal(shown.attr('src'), 'https://img/t/p/w1280/b2.jpg', label + ': кадр второй карточки не приехал');
  }
});

/* Task 39: предзагрузчик кадра помечается decoding='async' — декодирование
   крупного JPEG уходит с главного потока. Атрибут ставится ДО src. */
test('Task 39: предзагрузчик кадра героя просит асинхронное декодирование', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images[0].decoding, 'async');
  assert.ok(env.images[0].src, 'адрес присвоен — то есть decoding стоял раньше него');
});

/* Task 47: перед показом кадра ждём img.decode() — промис резолвится, когда
   картинку можно вставить без синхронного декодирования (Chrome 64+,
   docs/research/2026-09-21-webview-perf.md §4). Заглушка Image с decode
   заменяет ту, что ставит makeEnv, и складывает картинки в тот же массив. */
function stubDecode(env, opts) {
  const images = env.images;
  const mode = opts || {};
  globalThis.Image = function () {
    const self = this;
    self.onload = null;
    self.onerror = null;
    self.src = '';
    /* Признак «байты пришли» — тот же, что читает loadFrame. У свежей
       картинки его нет: complete у HTMLImageElement без src тоже false. */
    self.complete = false;
    self.naturalWidth = 0;
    self.decoded = null;
    self.decode = function () {
      if (mode.throws) throw new Error('decode not supported');
      if (mode.notPromise) return undefined;
      return new Promise((res, rej) => { self.decoded = { resolve: res, reject: rej }; });
    };
    images.push(self);
  };
}

/* Микротаски: decode().then(...) срабатывает не в тот же тик, что resolve. */
const tick = () => Promise.resolve().then(() => {});

/* Байты кадра доехали: ровно то состояние, в котором браузер зовёт onload. */
function arrive(img) { img.complete = true; img.naturalWidth = 1280; }

function focusedFrame(opts) {
  const env = makeEnv();
  stubDecode(env, opts);
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  return { env: env, main: main, node: node, bg: node.find('.lumen-hero__bg--a'), img: env.images[0] };
}

/* Перевести фокус на вторую карточку и дождаться её показа: новый show()
   поднимает поколение, снимает предзагрузку прежней карточки и заводит
   свой Image. Возвращается этот новый Image. */
function focusSecond(f) {
  f.main.card1.removeClass('focus');
  f.main.card2.addClass('focus');
  fireFocus(f.main.activity, f.main.card2);
  f.env.advance(400);
  return f.env.images[f.env.images.length - 1];
}

test('Task 47: кадр показывается после резолва decode(), а не в onload', async () => {
  const f = focusedFrame();
  assert.equal(typeof f.img.decoded.resolve, 'function', 'decode() вызван сразу после src');
  arrive(f.img);
  f.img.onload();
  await tick();
  assert.equal(f.bg.attr('src'), undefined, 'onload кадр не показывает: он ещё не декодирован');

  f.img.decoded.resolve();
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.equal(f.bg.hasClass('is-active'), true);
});

/* Фикс-раунд Task 47. Реджект decode() здесь НЕ означает смену src: у
   каждого вызова loadFrame свой new Image и src присваивается один раз.
   Значит реджект — это битые данные, упавший запрос или движок, который
   отвергает decode() без причины. Что делать, решает единственный
   проверяемый признак: доехали ли байты (complete && naturalWidth). */
test('Task 47: реджект decode() с загруженными байтами кадр показывает', async () => {
  const f = focusedFrame();
  arrive(f.img);
  f.img.decoded.reject(new Error('decode failed'));
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(warnLog, []);
});

test('Task 47: реджект decode() без байт оставляет предыдущий кадр, а не пустоту', async () => {
  const f = focusedFrame();
  arrive(f.img);
  f.img.decoded.resolve();
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'первый кадр на экране');

  const second = focusSecond(f);
  second.decoded.reject(new Error('broken image'));
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'старый кадр не затёрт пустым');
  assert.equal(f.bg.hasClass('is-active'), true);
  assert.equal(f.node.find('.lumen-hero__bg--b').attr('src'), undefined, 'второй слой не поднимали');
  assert.deepEqual(warnLog, []);
});

/* Замер координатора на стенде 2026-09-21: в скрытой вкладке
   (document.visibilityState === 'hidden') decode() не резолвится и не
   реджектится вовсе — Chromium не растеризует картинки, пока их некуда
   рисовать, а WebView телевизора уходит в hidden на скринсейвере и при
   переключении приложения. Страховка — тот же страховочный таймаут
   предзагрузки: байты есть — показываем, декодирует браузер при отрисовке. */
test('Task 47: повисший decode() — кадр показывает страховочный таймаут по байтам', () => {
  const f = focusedFrame();
  arrive(f.img);
  f.env.advance(8000);
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(warnLog, []);
});

test('Task 47: таймаут без байт кадр не показывает', () => {
  const f = focusedFrame();
  f.env.advance(8000);
  assert.equal(f.bg.attr('src'), undefined);
});

/* Фикс-раунд Task 47. Промис decode() отменить нечем: он доезжает до
   finish() уже после show() следующей карточки. Гард поколения не пускает
   его к чужому кадру — а уборка (снятие страховочного таймера) обязана
   стоять ЗА гардом, иначе устаревший вызов гасит таймер актуального. */
test('Task 47: устаревший decode() не показывает свой кадр и не гасит таймер актуального', async () => {
  const f = focusedFrame();
  arrive(f.img);
  const second = focusSecond(f);
  arrive(second);

  f.img.decoded.resolve();
  await tick();
  assert.equal(f.bg.attr('src'), undefined, 'кадр карточки, с которой фокус уже ушёл, не показан');

  /* Страховочный таймаут второй карточки обязан пережить чужой finish. */
  f.env.advance(8000);
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b2.jpg', 'таймер актуального кадра снесён устаревшим вызовом');
  assert.deepEqual(warnLog, []);
});

/* decode() на некоторых движках существует, но бросает синхронно или
   возвращает не промис — тогда путь прежний, через onload. */
test('Task 47: синхронный бросок decode() откатывает показ на onload', () => {
  const f = focusedFrame({ throws: true });
  arrive(f.img);
  f.img.onload();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(warnLog, []);
});

test('Task 47: decode() вернул не промис — показ по onload', () => {
  const f = focusedFrame({ notPromise: true });
  arrive(f.img);
  f.img.onload();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.deepEqual(warnLog, []);
});

/* Движок без decode (WebView до Chrome 64) — прежний путь через onload. */
test('Task 47: без decode() кадр показывается по onload', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(typeof env.images[0].decode, 'undefined', 'заглушка без decode');
  env.images[0].onload();
  assert.equal(node.find('.lumen-hero__bg--a').attr('src'), 'https://img/t/p/w1280/b1.jpg');
});

/* ====================================================================== */
/* Task 64: <img> с приоритетом, подложка LQIP                            */
/* ====================================================================== */

/* Слои кадра стали <img>: у фона нет ни decoding, ни fetchpriority, ни
   decode(), ни load/error, и запрос за картинкой уходит только после
   раскладки (docs/research/2026-09-21-webview-perf.md §4, «Герой — только
   <img>»). */
test('Task 64: слои кадра — img с decoding=async и высоким приоритетом', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  for (const cls of ['.lumen-hero__bg--a', '.lumen-hero__bg--b']) {
    const layer = node.find(cls);
    assert.equal(layer.attr('decoding'), 'async', cls + ': нет подсказки на асинхронное декодирование');
    assert.equal(layer.attr('fetchpriority'), 'high', cls + ': кадр героя — самая крупная картинка экрана, приоритет обязан быть высоким');
  }
  const lqip = node.find('.lumen-hero__lqip');
  assert.equal(lqip.attr('decoding'), 'async', 'подложка LQIP декодируется асинхронно');
  /* Приоритета у подложки нет намеренно: высокий приоритет у двух картинок
     разом отнял бы его у той, ради которой он и заведён. */
  assert.equal(lqip.attr('fetchpriority'), undefined);
  /* Нижней вуали-плашки в разметке больше нет — её заменила маска кадра. */
  assert.equal(node.find('.lumen-hero__veil--b'), EMPTY, 'нижняя вуаль осталась отдельным узлом');
  assert.equal(node.find('.lumen-hero__veil--l').hasClass('lumen-hero__veil'), true, 'левая вуаль на месте');
});

test('Task 64: предзагрузчик кадра просит высокий приоритет — запрос делает он', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images[0].fetchPriority, 'high');
});

/* Подложка LQIP: тот же backdrop в w300 (0.05 Мпикс против 0.92 у w1280,
   ресёрч §1.5/§4). Показывается СРАЗУ, не дожидаясь ни байтов, ни decode()
   основного кадра, — в этом весь её смысл. */
test('Task 64: подложка w300 встаёт сразу, до байтов и decode() основного кадра', () => {
  const f = focusedFrame();
  const lqip = f.node.find('.lumen-hero__lqip');
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b1.jpg', 'подложка не того размера или не поставлена');
  assert.equal(lqip.hasClass('is-active'), true, 'подложка обязана быть видна сразу');
  assert.equal(f.bg.attr('src'), undefined, 'основной кадр ещё не показан — тем ценнее подложка');
});

/* Подложка держится ровно до первого показанного кадра: дальше она лежит под
   непрозрачной картинкой и стоит только памяти — 202 800 байт растра
   (300 × 169 × 4). Освобождение отложено на 900 мс: кадр проявляется
   переходом opacity до 600 мс, и снять подложку в тот же миг значило бы
   показать сквозь полупрозрачный кадр голый фон. */
test('Task 64: показанный кадр освобождает подложку — но не раньше конца кроссфейда', async () => {
  const f = focusedFrame();
  const lqip = f.node.find('.lumen-hero__lqip');
  arrive(f.img);
  f.img.onload();
  f.img.decoded.resolve();
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'кадр не показан — проверять нечего');
  f.env.advance(600);
  assert.equal(lqip.hasClass('is-active'), true, 'подложку сняли посреди кроссфейда — сквозь кадр будет видно фон');
  f.env.advance(400);
  assert.equal(lqip.hasClass('is-active'), false, 'подложка осталась висеть после показа кадра');
  assert.equal(lqip.attr('src'), undefined, 'растр подложки продолжает держаться за элемент');
});

/* Следующая карточка подложку не заводит заново: под приходящим кадром лежит
   непрозрачный предыдущий, и подложку из-под него всё равно не видно —
   тянуть и декодировать w300 на каждый шаг фокуса незачем. */
test('Task 64: со второй карточки подложка больше не грузится', async () => {
  const f = focusedFrame();
  const lqip = f.node.find('.lumen-hero__lqip');
  arrive(f.img);
  f.img.onload();
  f.img.decoded.resolve();
  await tick();
  f.env.advance(1000);
  const img2 = focusSecond(f);
  arrive(img2);
  img2.onload();
  img2.decoded.resolve();
  await tick();
  assert.equal(lqip.attr('src'), undefined, 'подложку подняли на второй карточке');
  assert.equal(lqip.hasClass('is-active'), false);
  assert.equal(f.node.find('.lumen-hero__bg--b').attr('src'), 'https://img/t/p/w1280/b2.jpg', 'второй кадр не приехал — проверять нечего');
});

/* Ревью Task 64: с гашением кадра в сжатом состоянии слой атмосферы стал
   невидимым (правило .lumen-hero--compact .lumen-fx в src/30_css.js), и
   рисовать в него незачем. Предикат paused, который герой отдаёт LC.fx,
   обязан это учитывать: когда все слои на паузе, цикл частиц уходит с rAF на
   таймер раз в 500 мс (src/52_fx.js, schedule/IDLE_MS). Момент важный — это
   ровно шаг фокуса по рядам. */
test('Task 64 (ревью): в сжатом состоянии частицы на паузе, возврат их будит', () => {
  const mounts = [];
  const env = makeEnv({
    themes: {
      forMovie: () => ({ id: 'snow', preset: 'snow' }),
      particleColor: () => '#FFFFFF',
      classNames: () => 'lumen-theme--snow'
    },
    fx: { mount: (host, preset, opts) => { mounts.push(opts); return { destroy() {} }; }, unmount() {} }
  });
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.requests[0].ok({ overview: 'о первом' });
  assert.equal(mounts.length, 1, 'слой атмосферы не смонтирован — проверять нечего');
  const paused = mounts[0].paused;
  assert.equal(paused(), false, 'первый ряд: кадр на экране, частицы обязаны идти');

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  assert.equal(paused(), true, 'фокус во втором ряду: кадр погашен, а частицы всё ещё рисуются');

  main.card2.removeClass('focus');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  assert.equal(paused(), false, 'возврат в первый ряд частицы не разбудил');
});

/* Мини-герой сетки сжат с самого начала — там частицы стоят сразу. */
test('Task 64 (ревью): у всегда сжатого героя частицы стоят с монтирования', () => {
  const mounts = [];
  const env = makeEnv({
    themes: {
      forMovie: () => ({ id: 'snow', preset: 'snow' }),
      particleColor: () => '#FFFFFF',
      classNames: () => 'lumen-theme--snow'
    },
    fx: { mount: (host, preset, opts) => { mounts.push(opts); return { destroy() {} }; }, unmount() {} }
  });
  const main = makeMain();
  const grid = new FakeEl(['lumen-grid'], [new FakeEl(['activity__body'])]);
  env.hero.mount(grid, { hostClass: 'lumen-grid--hero', compact: true });
  main.card1.addClass('focus');
  fireFocus(grid, main.card1);
  env.advance(400);
  env.requests[0].ok({ overview: 'о первом' });
  assert.equal(mounts.length, 1);
  assert.equal(mounts[0].paused(), true, 'у постоянно сжатого героя частицы обязаны стоять');
});

/* Кадр не приехал вовсе — подложка обязана остаться: пустой герой хуже
   размытого. */
test('Task 64: неудачная загрузка кадра подложку не снимает', () => {
  const f = focusedFrame();
  const lqip = f.node.find('.lumen-hero__lqip');
  f.img.onerror();
  f.env.advance(2000);
  assert.equal(lqip.hasClass('is-active'), true, 'подложка снята, а показывать вместо неё нечего');
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b1.jpg');
});

/* Снятие героя обязано погасить и этот таймер — живых подписок после
   unmount у героя не остаётся. */
test('Task 64: unmount снимает отложенное освобождение подложки', async () => {
  const f = focusedFrame();
  arrive(f.img);
  f.img.onload();
  f.img.decoded.resolve();
  await tick();
  f.env.hero.unmount();
  assert.equal(f.env.timers.every((t) => t.done), true, 'после снятия героя остался живой таймер');
  f.env.advance(2000);
  assert.deepEqual(warnLog, []);
});

/* Кадра у фильма нет — герой собирает его из постера в w92 (Task 38). Это
   мельче w300, и отдельная подложка там только держала бы лишний растр. */
test('Task 64: у фильма без кадра подложки нет — постер и так грузится в w92', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  fireFocus(main.activity, main.card1);
  env.advance(400);
  const lqip = node.find('.lumen-hero__lqip');
  assert.equal(lqip.attr('src'), undefined, 'подложка для постера не нужна');
  assert.equal(lqip.hasClass('is-active'), false);
  assert.equal(env.images[0].src, 'https://img/t/p/w92/p.jpg');
});

/* Один и тот же кадр подложку второй раз не ставит: смена src у <img>
   заставила бы браузер заново проверять ресурс на ровном месте. Случай не
   выдуманный — соседние карточки ряда сериала и его же фильма нередко
   приходят с одним backdrop. */
test('Task 64: другой фильм с тем же backdrop подложку не переставляет', () => {
  const env = makeEnv();
  const main = makeMain();
  /* Разные id (иначе герой не стал бы обновляться вовсе), один кадр. */
  main.card2.card_data.backdrop_path = '/b1.jpg';
  env.hero.mount(main.activity);
  const node = main.activity._children[0];
  const lqip = node.find('.lumen-hero__lqip');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.images[0].onload();
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b1.jpg');
  const sets = [];
  const origAttr = lqip.attr;
  lqip.attr = function (name, val) {
    if (arguments.length === 2) sets.push(name + '=' + val);
    return origAttr.apply(this, arguments);
  };
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  assert.equal(env.images.length, 1, 'и сам кадр второй раз не грузится — адрес тот же');
  assert.deepEqual(sets, [], 'подложку переставили тем же адресом: ' + sets.join(','));
  assert.equal(lqip.hasClass('is-active'), true, 'подложка осталась на экране');
});

/* Task 39: размер кадра и логотипа считается по физическим пикселям, но
   «размытый» постер Task 38 остаётся крошечным при любом DPR — его размер
   выбран не под экран, а ради самого апскейла. */
test('Task 39: DPR 2 не поднимает логотип выше потолка, w92 размытого фона не трогает', () => {
  const env = makeEnv();
  globalThis.window.devicePixelRatio = 2;
  const main = makeMain();
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images[0].src, 'https://img/t/p/original/b1.jpg',
    '1920 CSS × DPR 2 = 3840 физических — кадр в original');
  env.images[0].onload();

  /* Логотип приходит с деталями: рамка при DPR 2 — 1900 физических пикселей,
     но потолок логотипа w780 (ревью Task 39, п.4). */
  env.requests[0].ok({ id: 11, images: { logos: [{ file_path: '/l.png', aspect_ratio: 4, iso_639_1: 'ru' }] } });
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("https://img/t/p/w780/l.png")');

  const noFrame = makeEnv();
  globalThis.window.devicePixelRatio = 2;
  const main2 = makeMain();
  main2.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
  main2.card1.addClass('focus');
  noFrame.hero.mount(main2.activity);
  fireFocus(main2.activity, main2.card1);
  noFrame.advance(400);
  assert.equal(noFrame.images[0].src, 'https://img/t/p/w92/p.jpg', 'размытый фон крошечный при любом DPR');
});

/* Task 37: в корне активности фокус получают не только карточки (кнопки
   шапки, пункты меню), и событие может прийти с целью без card_data или без
   классов вовсе. */
test('чужая цель события фокуса не роняет и не грузит', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const bare = new FakeEl(['card', 'focus']);
  fireFocus(main.activity, bare);
  fireFocus(main.activity, null);
  fireFocus(main.activity, main.line0);
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
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  /* Ответ деталей доехал раньше подмены текста. */
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное' });
  assert.equal(node.hasClass('lumen-hero--pending'), false);

  env.advance(200);
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2', 'подмена текста пишет последнюю модель');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'скелетон не возвращается');
  assert.deepEqual(warnLog, []);
});

test('ошибка деталей гасит скелетон и переживает отложенную подмену текста', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  env.requests[0].err({ code: 500 });
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'ждать больше нечего — скелетона нет');
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'остаётся то, что дала карточка ряда');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · ★ 7.2');
  assert.deepEqual(warnLog, []);
});

test('пустой ответ деталей равносилен ошибке — скелетон не горит вечно', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
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

/* Task 37: запоминается УЗЕЛ карточки, а не её прямоугольник — замер
   раскладки ушёл в момент открытия карточки (LC.transition.open). Ловушка в
   makeCard роняет тест, если герой позовёт getBoundingClientRect: здесь она и
   проверяет, что горячий путь фокуса раскладку не читает. */
test('lastFocus: фокус запоминает id, адрес уже отрисованного постера и узел карточки', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  assert.deepEqual(env.hero.lastFocus(), {
    id: 11,
    poster: 'https://img/t/p/w300/p1.jpg',
    node: main.card1
  });
  /* Прямоугольник узла умеет снять только слой перехода, и здесь это видно:
     обращение к нему из героя уронило бы тест ещё на строке выше. */
  assert.throws(() => main.card1.getBoundingClientRect(), /layout read in hot path/);
});

/* Повторное событие фокуса на той же карточке шлёт сама Lampa, когда
   возвращает фокус на место. Источник перехода при этом обязан обновиться
   (постер мог догрузиться на смену заглушки ./img/img_load.svg), а таймеры —
   нет: их проверяют тесты акцента и трейлера ниже. */
/* Task 37 (ревью): фокус Lampa восстанавливает синхронно внутри
   activity.start() — ДО события 'activity':start, по которому мы монтируем
   героя. Своего 'hover:focus' мы в этот заход не увидим, поэтому источник
   перехода обязан завести сам mount: иначе «главная → OK → Назад → OK на той
   же карточке» открывалось бы без перехода. */
test('lastFocus: карточка была в фокусе ещё до монтирования — источник заведён без события', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.addClass('focus');

  env.hero.mount(main.activity);
  assert.deepEqual(env.hero.lastFocus(), {
    id: 11,
    poster: 'https://img/t/p/w300/p1.jpg',
    node: main.card1
  }, 'ни одного события фокуса не посылали');

  /* Гард повторной обработки при этом не взведён: первое настоящее событие
     обязано пройти полный путь и завести таймеры. */
  fireFocus(main.activity, main.card1);
  env.advance(3100);
  assert.deepEqual(warnLog, []);
});

test('lastFocus: повторный фокус той же карточки подхватывает догруженный постер', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.find('.card__img').attr('src', './img/img_load.svg');
  fireFocus(main.activity, main.card1);
  assert.equal(env.hero.lastFocus().poster, './img/img_load.svg');

  main.card1.find('.card__img').attr('src', 'https://img/t/p/w300/p1.jpg');
  fireFocus(main.activity, main.card1);
  assert.equal(env.hero.lastFocus().poster, 'https://img/t/p/w300/p1.jpg', 'в переход пойдёт постер, а не заглушка');
  assert.equal(env.hero.lastFocus().node, main.card1);
});

test('lastFocus: обновляется сразу, не дожидаясь смены героя', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(50);
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  assert.equal(env.hero.lastFocus().id, 22, 'до истечения 350 мс герой ещё первый, а источник — уже второй');
  assert.equal(env.images.length, 0);
});

test('lastFocus: карточка без постера источником не становится', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  const bare = new FakeEl(['card', 'focus']);
  bare.card_data = { id: 33, title: 'Голый' };
  main.line0._children.push(bare);
  bare._parentEl = main.line0;
  fireFocus(main.activity, bare);
  assert.equal(env.hero.lastFocus(), null);
});

/* ---------------------------------------------------------------------- */
/* Task 27 (довесок): крупная версия постера для перехода.                  */
/* ---------------------------------------------------------------------- */

test('bigPoster: адрес того же постера в w500', () => {
  assert.equal(H.bigPoster('https://img/t/p/w300/p1.jpg'), 'https://img/t/p/w500/p1.jpg');
  assert.equal(H.bigPoster('http://imagetmdb.com/t/p/w200/x.jpg'), 'http://imagetmdb.com/t/p/w500/x.jpg');
});

test('bigPoster: постер уже не мельче — грузить нечего', () => {
  assert.equal(H.bigPoster('https://img/t/p/w500/p1.jpg'), null);
  assert.equal(H.bigPoster('https://img/t/p/w780/p1.jpg'), null);
  assert.equal(H.bigPoster('https://img/t/p/w1280/p1.jpg'), null);
});

test('bigPoster: чужой адрес и мусор — null', () => {
  assert.equal(H.bigPoster('https://kinopoisk/covers/p1.jpg'), null);
  assert.equal(H.bigPoster(''), null);
  assert.equal(H.bigPoster(null), null);
});

/* Предзагрузка включается настройкой перехода: в остальных тестах LC.pref
   не задан, и лишних картинок они не видят. */
const transitionEnv = () => makeEnv({ pref: (name, def) => def });

test('крупный постер грузится после покоя фокуса и попадает в источник перехода', () => {
  const env = transitionEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  assert.equal(env.images.length, 0, 'до покоя фокуса ничего не грузится');
  env.advance(350);
  /* Первой идёт предзагрузка кадра героя, крупный постер — вторая картинка. */
  const big = env.images.filter((i) => i.src.indexOf('/t/p/w500/p1.jpg') !== -1);
  assert.equal(big.length, 1, 'крупный постер запрошен ровно один раз');
  assert.equal(env.hero.lastFocus().big, undefined, 'пока не загрузился — источник прежний');
  big[0].onload();
  assert.equal(env.hero.lastFocus().big, 'https://img/t/p/w500/p1.jpg');
});

test('быстрое листание крупный постер не грузит', () => {
  const env = transitionEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(100);
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  const big = env.images.filter((i) => i.src.indexOf('/t/p/w500/') !== -1);
  assert.equal(big.length, 1, 'грузится только постер карточки, на которой остановились');
  assert.ok(big[0].src.indexOf('p2.jpg') !== -1);
});

test('неудача загрузки крупного постера оставляет переход на прежнем постере', () => {
  const env = transitionEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  const big = env.images.filter((i) => i.src.indexOf('/t/p/w500/') !== -1)[0];
  big.onerror();
  assert.equal(env.hero.lastFocus().big, undefined);
  assert.equal(env.hero.lastFocus().poster, 'https://img/t/p/w300/p1.jpg');
});

test('снятие героя гасит незавершённую загрузку крупного постера', () => {
  const env = transitionEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  const big = env.images.filter((i) => i.src.indexOf('/t/p/w500/') !== -1)[0];
  env.hero.unmount();
  assert.equal(big.onload, null, 'обработчики сняты — сеть в снятый герой не вернётся');
  assert.equal(big.onerror, null);
});

test('lastFocus: снятие героя обнуляет источник', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.hero.unmount();
  assert.equal(env.hero.lastFocus(), null);
});

function accentEnv() {
  const calls = [];
  /* Task 35: второй аргумент applyFor («фильм открыт карточкой») герой
     главной передавать НЕ имеет права — он и заказывает полную пересборку
     таблицы стилей, ради снятия которой с этого пути задача и делалась
     (src/57_color.js). Поэтому он тоже попадает в журнал. */
  const deep = [];
  const env = makeEnv({
    accent: {
      applyFor: (card, full) => {
        calls.push(card && card.id);
        deep.push(full);
      }
    }
  });
  env.calls = calls;
  env.deep = deep;
  return env;
}

test('акцент: считается только после трёх секунд покоя фокуса', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(2900);
  assert.deepEqual(env.calls, [], 'до 3 с — ни одного расчёта');
  env.advance(200);
  assert.deepEqual(env.calls, [11]);
  assert.deepEqual(env.deep, [undefined], 'с главной — без полной пересборки CSS');
});

test('акцент: быстрый проход по ряду не даёт ни одного расчёта', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  for (let i = 0; i < 10; i++) {
    const card = i % 2 ? main.card2 : main.card1;
    card.addClass('focus');
    fireFocus(main.activity, card);
    env.advance(200);
  }
  assert.deepEqual(env.calls, [], 'фокус нигде не стоял 3 с');
});

test('акцент: считается по карточке, на которой остановились, а не по покинутой', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(1000);
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(3100);
  assert.deepEqual(env.calls, [22]);
});

/* Task 37: гард от повторной обработки той же карточки проверяется ПО
   ТАЙМЕРУ, а не по числу вызовов: перезапуск отсчёта акцента сдвинул бы
   расчёт на новые 3 с, и при потоке повторных событий (а прежний
   MutationObserver ловил любую мутацию класса в активности, включая классы
   самого героя) акцент не наступал бы вовсе. */
test('акцент: повторное событие на той же карточке не перезапускает отсчёт', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);

  env.advance(2000);
  fireFocus(main.activity, main.card1);
  fireFocus(main.activity, main.card1);
  assert.deepEqual(env.calls, [], 'три секунды ещё не прошли');

  env.advance(1100);
  assert.deepEqual(env.calls, [11], 'акцент наступил в свой срок, отсчёт не сдвинулся');
});

test('акцент: перевод фокуса на другую карточку отсчёт перезапускает', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);

  env.advance(2000);
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);

  env.advance(1100);
  assert.deepEqual(env.calls, [], 'с момента смены карточки прошло 1,1 с — рано');
  env.advance(1950);
  assert.deepEqual(env.calls, [22], 'три секунды отсчитаны заново и по новой карточке');
});

test('акцент: снятие героя гасит отложенный расчёт', () => {
  const env = accentEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.hero.unmount();
  env.advance(5000);
  assert.deepEqual(env.calls, []);
});

/* ====================================================================== */
/* Task 28 (фаза 3): автотрейлер в герое.                                 */
/*                                                                        */
/* Плеер тот же, что у карточки (LC.trailer.player, src/55_trailer.js) —   */
/* здесь он подменяется журналом: проверяется не YouTube, а жизненный цикл */
/* вокруг него: 8 с покоя фокуса до старта, отмена на листании, снятие     */
/* вместе с героем и запрет в lite/off.                                    */
/* ====================================================================== */

function trailerEnv(extra, pref) {
  const players = [];
  const env = makeEnv(Object.assign({
    pref: pref || ((name, def) => def),
    trailer: {
      mode: () => 'on',
      pickTrailer: (list) => {
        if (!list || !list.length) return null;
        return list[0] && list[0].key ? list[0] : null;
      },
      player: (host, key, onStart, onEnd) => {
        const p = { host: host, key: key, onStart: onStart, onEnd: onEnd, destroys: 0 };
        players.push(p);
        p.destroy = () => { p.destroys++; p.onEnd(); };
        return p;
      }
    }
  }, extra || {}));
  env.players = players;
  return env;
}

/* Ролики карточки: первый запрос идёт на языке интерфейса. */
const VIDEOS_RU = { results: [{ key: 'ruKey', name: 'Трейлер', iso_639_1: 'ru' }] };

/* Последний ушедший запрос роликов: в один тик виртуального времени вместе
   с ним успевают уйти кадр и детали карточки. */
function lastVideos(env) {
  const list = env.requests.filter((r) => r.url.indexOf('/videos') >= 0);
  return list[list.length - 1];
}

function focusOn(main, card) {
  card.addClass('focus');
  fireFocus(main.activity, card);
}

test('трейлер героя: старт после 8 с покоя фокуса, ролик в своём слое, класс на узле', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  focusOn(main, main.card1);
  env.advance(400);
  /* Кадр и детали ушли сразу, ролик ждёт свои 8 с. */
  const before = env.requests.length;
  env.advance(7000);
  assert.equal(env.requests.length, before, 'до восьмой секунды роликов не спрашиваем');

  env.advance(1200);
  const req = lastVideos(env);
  assert.equal(req.url, 'movie/11/videos');
  assert.deepEqual(req.params, { langs: 'ru' });
  assert.equal(req.opts.life, 10080, 'ролики кэшируются на неделю');

  req.ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
  assert.equal(env.players[0].key, 'ruKey');
  assert.equal(env.players[0].host.hasClass('lumen-hero__trailer'), true, 'плеер живёт в своём слое героя');
  assert.equal(node.hasClass('lumen-hero--trailer'), false, 'до фактического старта класса нет');

  env.players[0].onStart();
  assert.equal(node.hasClass('lumen-hero--trailer'), true);

  env.players[0].onEnd();
  assert.equal(node.hasClass('lumen-hero--trailer'), false, 'ролик кончился — герой вернулся к кадру');
  assert.deepEqual(warnLog, []);
});

test('трейлер героя: при листании не стартует вовсе', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const start = env.requests.length;
  for (let i = 0; i < 12; i++) {
    const card = i % 2 ? main.card2 : main.card1;
    focusOn(main, card);
    env.advance(600);
  }
  const videoRequests = env.requests.slice(start).filter((r) => r.url.indexOf('/videos') >= 0);
  assert.deepEqual(videoRequests, [], 'фокус нигде не стоял 8 с — ни одного запроса роликов');
  assert.equal(env.players.length, 0);
});

/* Task 37: возврат фокуса на ту же карточку (Lampa шлёт событие повторно,
   когда восстанавливает фокус) идущий ролик обрывать не должен. */
test('трейлер героя: повторное событие на той же карточке ролик не гасит', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();

  fireFocus(main.activity, main.card1);
  assert.equal(env.players[0].destroys, 0, 'ролик играет дальше');
  assert.equal(node.hasClass('lumen-hero--trailer'), true);
});

/* Ряд перестроился, и та же карточка приехала НОВЫМ узлом: гард focusEl тут
   не срабатывает (узел другой), и защищать ролик с кадром обязаны сравнения
   по самой карточке — state.trailerCard и state.shownId. */
test('трейлер героя: та же карточка на новом узле ролик не гасит и кадр не перезагружает', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();
  const frames = env.images.filter((i) => i.src.indexOf('/t/p/original/') !== -1).length;
  const requests = env.requests.length;

  /* Перерисованный ряд отдаёт новый узел с теми же данными карточки. */
  const again = makeCard(11, 'Первый', { poster: 'https://img/t/p/w300/p1.jpg', rect: { left: 100, top: 200, width: 180, height: 270 } });
  again.card_data = main.card1.card_data;
  main.line0._children.push(again);
  again._parentEl = main.line0;

  fireFocus(main.activity, again);
  env.advance(9000);
  assert.equal(env.players[0].destroys, 0, 'ролик играет дальше');
  assert.equal(env.images.filter((i) => i.src.indexOf('/t/p/original/') !== -1).length, frames, 'кадр героя заново не грузится');
  assert.equal(env.requests.length, requests, 'ни деталей, ни роликов заново не спрашиваем');
  assert.equal(env.hero.lastFocus().node, again, 'а источник перехода переехал на новый узел');
  /* Единственное, что действительно повторяется, — предзагрузка крупного
     постера для перехода: она привязана к записи источника, а та переехала на
     новый узел. Картинка та же и уже в кэше браузера, сеть не тратится. */
  assert.equal(env.images.filter((i) => i.src.indexOf('/t/p/w500/p1.jpg') !== -1).length, 2);
});

test('трейлер героя: перевод фокуса снимает играющий ролик и его запрос', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  focusOn(main, main.card1);
  env.advance(9000);
  const req = lastVideos(env);
  req.ok(VIDEOS_RU);
  env.players[0].onStart();
  assert.equal(node.hasClass('lumen-hero--trailer'), true);

  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  assert.equal(env.players[0].destroys, 1, 'ролик снят сразу, а не через задержку');
  assert.equal(node.hasClass('lumen-hero--trailer'), false);
});

test('трейлер героя: снятие героя гасит таймер, запрос и ролик', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  focusOn(main, main.card1);
  env.advance(9000);
  const req = lastVideos(env);
  req.ok(VIDEOS_RU);
  env.players[0].onStart();

  env.hero.unmount();
  assert.equal(env.players[0].destroys, 1, 'плеер уничтожен вместе с героем');

  /* Ответ, доехавший после снятия, второго плеера не создаёт. */
  req.ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);

  /* И отложенный старт после снятия тоже никуда не уходит. */
  const env2 = trailerEnv();
  const main2 = makeMain();
  env2.hero.mount(main2.activity);
  focusOn(main2, main2.card1);
  env2.hero.unmount();
  env2.advance(9000);
  assert.deepEqual(env2.requests.filter((r) => r.url.indexOf('/videos') >= 0), []);
  assert.deepEqual(warnLog, []);
});

test('трейлер героя: в lite и off не стартует вовсе', () => {
  for (const mode of ['lite', 'off']) {
    const env = trailerEnv({ motionMode: () => mode });
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(9000);
    assert.deepEqual(env.requests.filter((r) => r.url.indexOf('/videos') >= 0), [], mode + ': запросов роликов нет');
    assert.equal(env.players.length, 0);
  }
});

/* Task 40: автотрейлер — тяжёлый эффект (iframe YouTube поверх экрана),
   поэтому он подчинён и тумблеру, не только режиму анимаций. */
test('трейлер героя: при выключенных тяжёлых эффектах не стартует', () => {
  const env = trailerEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  assert.deepEqual(env.requests.filter((r) => r.url.indexOf('/videos') >= 0), [], 'запросов роликов нет');
  assert.equal(env.players.length, 0);
});

test('трейлер героя: выключенная настройка — ни таймера, ни запроса; включение действует со следующего покоя', () => {
  let on = false;
  const env = trailerEnv({}, (name, def) => (name === 'lumen_hero_trailer' ? on : def));
  const main = makeMain();
  env.hero.mount(main.activity);

  focusOn(main, main.card1);
  env.advance(9000);
  assert.deepEqual(env.requests.filter((r) => r.url.indexOf('/videos') >= 0), []);

  on = true;
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(9000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 1);
});

test('трейлер героя: выключение настройки на лету снимает играющий ролик', () => {
  let on = true;
  const env = trailerEnv({}, (name, def) => (name === 'lumen_hero_trailer' ? on : def));
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = main.activity._children[0];

  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();

  on = false;
  env.hero.applyTrailer();
  assert.equal(env.players[0].destroys, 1);
  assert.equal(node.hasClass('lumen-hero--trailer'), false);
});

test('трейлер героя: на языке интерфейса роликов нет — запасной запрос на английском', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok({ results: [] });

  const second = lastVideos(env);
  assert.equal(second.url, 'movie/11/videos');
  assert.deepEqual(second.params, { langs: 'en' });

  second.ok({ results: [{ key: 'enKey', name: 'Trailer', iso_639_1: 'en' }] });
  assert.equal(env.players.length, 1);
  assert.equal(env.players[0].key, 'enKey');
});

test('трейлер героя: роликов нет совсем — тишина без третьего запроса и без плеера', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok({ results: [] });
  lastVideos(env).ok({ results: [] });
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 2);
  assert.equal(env.players.length, 0);
  assert.deepEqual(warnLog, []);
});

test('трейлер героя: режим анимаций упал до lite на лету — играющий ролик снимается', () => {
  let motion = 'full';
  const env = trailerEnv({ motionMode: () => motion });
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();

  motion = 'lite';
  env.hero.applyMotion();
  assert.equal(env.players[0].destroys, 1);
});

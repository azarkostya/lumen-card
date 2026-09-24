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
/* Task 68: LC.focus — общий механизм подписки на фокус (src/11_focus.js):
   герой вешает свой обработчик и на 'hover:focus' (пульт), и на
   'hover:hover' (мышь). */
const FOCUS = load('11_focus.js');

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
  const LC = Object.assign({ util: UTIL, focus: FOCUS, cardinfo: CARDINFO, motionMode: function () { return 'full'; } }, extra || {});
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
     по площади просил бы 8.23em и съел бы мету: выше бюджета раскладки его
     не пускает верхний кламп. */
  assert.deepEqual(H.logoBox(1.5), { w: 9.75, h: 6.5 });
  /* Логотип-баннер 20:1 по площади получил бы 2.25em — нижний кламп поднимает
     его до 3.0em, и тогда в бюджет уже не влезает ШИРИНА: она и решает. */
  const banner = H.logoBox(20);
  assert.equal(banner.w, 37.84, 'ширина упирается в рамку: ' + JSON.stringify(banner));
  assert.equal(banner.h, 1.89);

  for (const ratio of [0.8, 1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 12, 20]) {
    const full = H.logoBox(ratio);
    assert.ok(full.h <= 6.5, ratio + ':1 — высота ' + full.h + 'em выше бюджета TEXT_LOGO');
    assert.ok(full.w <= 37.84, ratio + ':1 — ширина ' + full.w + 'em шире рамки');
  }
});

/* Правка 2026-09-23 (разбор композиции, п.1.2): логотип увеличен в 1.25
   раза по линейному размеру. Тест сторожит не сам множитель, а то, ради
   чего он выбран единым для площади и обоих клампов: диапазон пропорций,
   в котором работает равная площадь, обязан остаться прежним. Границы
   диапазона — LOGO_AREA/LOGO_H_MAX² и LOGO_AREA/LOGO_H_MIN²; до правки это
   было 2.40:1 и 11.28:1. */
test('правка 2026-09-23: рост логотипа не сузил диапазон равной площади', () => {
  /* Внутри диапазона площадь одна у всех — берём оба его края с запасом
     внутрь и середину. */
  const areas = [2.45, 4, 6, 11].map((r) => {
    const b = H.logoBox(r);
    return b.w * b.h;
  });
  for (const area of areas) {
    assert.ok(Math.abs(area - areas[0]) / areas[0] < 0.01,
      'площади внутри диапазона разошлись: ' + JSON.stringify(areas));
  }
  /* И сам рост — ровно 1.25 по линейному размеру, а не «примерно». Считаем
     по логотипу из середины диапазона: до правки 6:1 давал 19.75 × 3.29. */
  const wide = H.logoBox(6);
  assert.ok(Math.abs(wide.h / 3.29 - 1.25) < 0.01, 'рост по высоте ' + (wide.h / 3.29).toFixed(3) + ' вместо 1.25');
  assert.ok(Math.abs(wide.w / 19.75 - 1.25) < 0.01, 'рост по ширине ' + (wide.w / 19.75).toFixed(3) + ' вместо 1.25');
});

/* Task 36: прежний тест «сжатое состояние — то же самое, умноженное на 0.65»
   удалён вместе со вторым аргументом logoBox. Уменьшение логотипа при
   листании делает теперь CSS (transform: scale, правило
   .lumen-hero--compact .lumen-hero__logo), потому что пара width/height
   анимировалась раскладкой. Здесь проверяем контракт: размер от состояния
   кадра не зависит вовсе. */
test('logoBox: размер не зависит от состояния кадра — сжатие делает CSS', () => {
  assert.deepEqual(H.logoBox(6, true), H.logoBox(6), 'второго аргумента у logoBox больше нет');
  assert.deepEqual(H.logoBox(6), { w: 24.69, h: 4.11 });
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
  /* Волна 3 (ТВ 2026-09-24): «или делать меньше текст» — в мете героя не
     больше ДВУХ жанров (карточка фильма по-прежнему показывает три —
     LC.cardinfo.genres не тронут). */
  assert.deepEqual(m.meta, ['2026', '2:25', 'фантастика, боевик'], 'не больше двух жанров');
  assert.equal(m.overview, 'полное описание');
  assert.equal(m.logo, '/ru.png');
  assert.equal(m.pending, false);
  assert.equal(m.status, '');
});

/* Волна 3 (ТВ 2026-09-24): «карточка героя на стартовой и карточка ниже
   почти одинаковые — текст и обложка одинаковые». backdrop_path у TMDB —
   чаще всего тот же ключевой арт, что и постер. Кадр героя — первый кадр
   из images.backdrops без надписей (iso_639_1 пустой), не равный
   backdrop_path, шириной от 1280 и с пропорцией 16:9 (±0.05); нет такого —
   backdrop_path. Новых запросов нет: images уже едут в ответе деталей. */
/* Голоса TMDB у кадра (ревью волны 3, п.3 — правило у следующего теста).
   Здесь у всех кадров они одинаковые: проверяются прежние условия отбора. */
const VOTES = { vote_average: 5.3, vote_count: 4 };

test('heroBackdrop: второй кадр без надписей, широкий и 16:9, а не ключевой арт', () => {
  const key = Object.assign({ file_path: '/key.jpg', iso_639_1: null, width: 3840, height: 2160, aspect_ratio: 1.778 }, VOTES);
  const text = Object.assign({ file_path: '/text.jpg', iso_639_1: 'en', width: 3840, height: 2160, aspect_ratio: 1.778 }, VOTES);
  const small = Object.assign({ file_path: '/small.jpg', iso_639_1: null, width: 1000, height: 562, aspect_ratio: 1.779 }, VOTES);
  const wide = Object.assign({ file_path: '/wide.jpg', iso_639_1: null, width: 2560, height: 1080, aspect_ratio: 2.37 }, VOTES);
  const good = Object.assign({ file_path: '/good.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES);
  const later = Object.assign({ file_path: '/later.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES);
  assert.equal(H.heroBackdrop({ backdrops: [key, text, small, wide, good, later] }, '/key.jpg'), '/good.jpg',
    'первый подходящий по порядку TMDB');
  /* Нечего выбрать — ключевой арт: пустой герой хуже совпадения с постером. */
  assert.equal(H.heroBackdrop(null, '/key.jpg'), '/key.jpg');
  assert.equal(H.heroBackdrop({}, '/key.jpg'), '/key.jpg');
  assert.equal(H.heroBackdrop({ backdrops: [key, text, small, wide] }, '/key.jpg'), '/key.jpg', 'подходят только ключевой арт и отбракованные');
  /* Пропорция — из aspect_ratio, без него из width/height; размера нет вовсе
     — кадр не берём (урезанный ответ прокси). */
  assert.equal(H.heroBackdrop({ backdrops: [Object.assign({ file_path: '/wh.jpg', iso_639_1: null, width: 1280, height: 720 }, VOTES)] }, '/key.jpg'), '/wh.jpg');
  assert.equal(H.heroBackdrop({ backdrops: [Object.assign({ file_path: '/nosize.jpg', iso_639_1: null }, VOTES)] }, '/key.jpg'), '/key.jpg');
  assert.equal(H.heroBackdrop({ backdrops: [Object.assign({ file_path: '/near.jpg', iso_639_1: null, width: 1280, aspect_ratio: 1.72 }, VOTES)] }, '/key.jpg'), '/key.jpg', '1.72 — уже не 16:9');
  /* Без backdrop_path — первый подходящий, а нет его — пусто. */
  assert.equal(H.heroBackdrop({ backdrops: [good] }, ''), '/good.jpg');
  assert.equal(H.heroBackdrop(null, ''), '');
});

/* Ревью волны 3, п.3: выборка 40 фильмов — у пяти выбранный кадр без
   голосов вовсе, у «Суперполицейских 3» и NAZA — с оценкой 0.166 (TMDB так
   помечает отвергнутые кадры), у After Impact — почти чёрный. Кадр героя —
   кандидат только с голосами (vote_count ≥ 1) и с оценкой не ниже
   половины оценки ключевого арта (vote_average ≥ 0.5 × ключевого), если у
   ключевого голоса есть; нет подходящего — ключевой backdrop_path. */
test('heroBackdrop: кандидат — только с голосами и не хуже половины оценки ключевого арта', () => {
  const frame = (path, avg, count) => ({ file_path: path, iso_639_1: null, width: 3840, height: 2160, aspect_ratio: 1.778, vote_average: avg, vote_count: count });
  const key = frame('/key.jpg', 5.3, 7);
  assert.equal(H.heroBackdrop({ backdrops: [key, frame('/novote.jpg', 0, 0)] }, '/key.jpg'), '/key.jpg', 'кадр без голосов — не кандидат');
  assert.equal(H.heroBackdrop({ backdrops: [key, { file_path: '/bare.jpg', iso_639_1: null, width: 1920, height: 1080 }] }, '/key.jpg'), '/key.jpg',
    'у кадра нет полей голосов (урезанный ответ) — не кандидат');
  assert.equal(H.heroBackdrop({ backdrops: [key, frame('/rejected.jpg', 0.166, 1)] }, '/key.jpg'), '/key.jpg', 'оценка 0.166 при ключевом 5.3 — не кандидат');
  assert.equal(H.heroBackdrop({ backdrops: [key, frame('/half.jpg', 2.65, 1)] }, '/key.jpg'), '/half.jpg', 'ровно половина оценки ключевого — кандидат');
  assert.equal(H.heroBackdrop({ backdrops: [key, frame('/low.jpg', 2.6, 3), frame('/ok.jpg', 3.2, 2)] }, '/key.jpg'), '/ok.jpg',
    'ниже половины пропускаем, берём следующий подходящий');
  /* У ключевого голосов нет (или его нет среди кадров — backdrop_path бывает
     с языком вне include_image_language) — планки по оценке нет, голоса у
     кандидата всё равно нужны. */
  assert.equal(H.heroBackdrop({ backdrops: [frame('/key.jpg', 0, 0), frame('/any.jpg', 0.166, 1)] }, '/key.jpg'), '/any.jpg', 'ключевой без голосов — планки по оценке нет');
  assert.equal(H.heroBackdrop({ backdrops: [frame('/key.jpg', 6, 0), frame('/any.jpg', 1, 1)] }, '/key.jpg'), '/any.jpg', 'оценка ключевого без голосов — не планка');
  assert.equal(H.heroBackdrop({ backdrops: [frame('/any.jpg', 1, 1)] }, '/key.jpg'), '/any.jpg', 'ключевого нет среди кадров — планки по оценке нет');
  assert.equal(H.heroBackdrop({ backdrops: [frame('/key.jpg', 0, 0), frame('/novote.jpg', 0, 0)] }, '/key.jpg'), '/key.jpg', 'без голосов не берём и тогда');
});

test('heroModel: кадр героя из деталей — heroBackdrop, до деталей и без них — backdrop_path', () => {
  const card = { id: 8, title: 'Фильм', backdrop_path: '/key.jpg', poster_path: '/p.jpg' };
  assert.equal(H.heroModel(card, null, WORDS).backdrop, '/key.jpg', 'до ответа деталей — из данных ряда');
  const images = { backdrops: [
    Object.assign({ file_path: '/key.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES),
    Object.assign({ file_path: '/other.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES)
  ] };
  assert.equal(H.heroModel(card, { backdrop_path: '/key.jpg', images: images }, WORDS).backdrop, '/other.jpg');
  assert.equal(H.heroModel(card, { backdrop_path: '/key.jpg' }, WORDS).backdrop, '/key.jpg', 'без images — ключевой арт');
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
          /* Ревью фикс-раунда, Ф2 п.2: как настоящая Lampa — get$c ничего
             не возвращает (vendor/lampa/app.min.js:19693-19737, экспорт
             :20860), то есть запрос деталей отменить нечем. Прежняя заглушка
             отдавала { clear }, и тесты парковки проходили на поведении,
             которого у Lampa нет. */
          get(url, params, ok, err, opts) {
            const req = { url: url, params: params, ok: ok, err: err, opts: opts };
            requests.push(req);
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
   внутри: адрес уже отрисованного постера — заглушка кадра героя (волна 3,
   holdFrame в src/48_hero.js). */
function makeCard(id, title, opts) {
  const img = new FakeEl(['card__img']);
  img.attr('src', opts.poster);
  const card = new FakeEl(['card', 'selector'], [new FakeEl(['card__view'], [img])]);
  /* Task 37: замер раскладки ушёл с горячего пути фокуса (до волны 2 — в
     момент открытия карточки, LC.transition.open; переход удалён). Герой не
     имеет права звать getBoundingClientRect вовсе — здесь это ловушка;
     прямоугольник лежит рядом только для правдоподобия фейка. */
  card._rect = opts.rect;
  card.getBoundingClientRect = () => { throw new Error('layout read in hot path'); };
  return card;
}

/* Волна 3 (ТВ 2026-09-24): кадр героя выбирается по ответу деталей
   (startFrame в src/48_hero.js) — до ответа show() кадр не грузит, а ждёт
   его до FRAME_WAIT. Тестам, которым нужна загрузка самого кадра, а не
   состав деталей, хватает пустого ответа последнего запроса деталей: кадр
   тогда — backdrop_path из данных ряда, ровно как до волны 3. */
function answerDetails(env, json) {
  const list = env.requests.filter((r) => /^(movie|tv)\/[^/]+$/.test(r.url));
  assert.ok(list.length, 'запроса деталей нет');
  list[list.length - 1].ok(json || {});
}

/* Волна 3 (ТВ 2026-09-24): у героя два узла в корне — неподвижный слой
   кадра .lumen-hero-stage (первым ребёнком: кадры, подложка, ролик,
   затемнение) и .lumen-hero (текст и частицы) за ним. heroOf находит узел
   героя в корне, stageOf — слой кадра рядом с ним. */
function heroOf(root) {
  return root._children.find((c) => c.hasClass('lumen-hero')) || EMPTY;
}
function stageOf(hero) {
  const parent = hero && hero._parentEl;
  return (parent && parent._children.find((c) => c.hasClass('lumen-hero-stage'))) || EMPTY;
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

/* Task 68: тот же слушатель, но по мышиному событию — Lampa в режиме
   navigation_type == 'mouse' шлёт наведённому элементу 'hover:hover', а не
   'hover:focus' (vendor/lampa/app.min.js:46360-46364, слушатели mouseenter/
   mouseleave вешаются на :46374-46381). */
function hoverListeners(root) {
  return (root._listeners || []).filter((l) => l.type === 'hover:hover' && l.capture);
}

function fireFocus(root, target) {
  const list = focusListeners(root);
  assert.equal(list.length, 1, 'на корне обязан жить ровно один capture-слушатель фокуса');
  list[0].fn({ target: target });
}

function fireHover(root, target) {
  const list = hoverListeners(root);
  assert.equal(list.length, 1, 'на корне обязан жить ровно один capture-слушатель мышиного фокуса');
  list[0].fn({ target: target });
}

test('mount: слой кадра первым ребёнком активности, герой — вторым, класс .lumen-main, один слушатель фокуса', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(env.hero.active(), true);
  /* Волна 3: порядок узлов — порядок отрисовки. Кадр под текстом героя,
     текст под рядами (.activity__body идёт следом). */
  assert.equal(main.activity._children[0].hasClass('lumen-hero-stage'), true, 'слой кадра — первый ребёнок');
  assert.equal(main.activity._children[1].hasClass('lumen-hero'), true, 'герой — сразу за слоем кадра');
  assert.equal(main.activity._children[2].hasClass('activity__body'), true, 'ряды — после героя');
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
  answerDetails(env);
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
  answerDetails(env);
  assert.equal(env.images.length, 1, 'и он рабочий: фокус дошёл до героя');
});

/* ====================================================================== */
/* Task 68: герой отзывается и на мышь                                    */
/* ====================================================================== */

/* Живая жалоба: «картинки всё ещё меняются только на первый фильм в
   подборке». Причина — Lampa в мышином режиме шлёт наведённой карточке
   'hover:hover' и только ставит ей класс focus (vendor/lampa/
   app.min.js:46360-46364), а герой слушал одно 'hover:focus'. Теперь
   подписку ставит LC.focus.capture, и оба события ведут в один обработчик. */
test('Task 68: на корне живут ОБА capture-слушателя фокуса, и это один обработчик', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  assert.equal(focusListeners(main.activity).length, 1, 'пультовое событие');
  assert.equal(hoverListeners(main.activity).length, 1, 'мышиное событие');
  assert.equal(focusListeners(main.activity)[0].fn, hoverListeners(main.activity)[0].fn,
    'обработчик один — гарды DELAY/pending/gen у обеих веток общие');
});

test('Task 68: наведение мышью меняет кадр героя так же, как шаг пультом', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  fireHover(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  assert.equal(env.images[0].src, 'https://img/t/p/w1280/b1.jpg', 'первая карточка — её кадр');

  fireHover(main.activity, main.card2);
  env.advance(400);
  answerDetails(env);
  assert.equal(env.images[1].src, 'https://img/t/p/w1280/b2.jpg', 'мышь на второй — кадр сменился');
  assert.deepEqual(warnLog, []);
});

/* Пультом и мышью — одинаковые гарды. DELAY: кадр не грузится раньше 350 мс;
   повтор на том же узле не заводит ни второго кадра, ни второго запроса. */
test('Task 68: мышиная ветка держит те же гарды — задержка и повтор на том же узле', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  fireHover(main.activity, main.card1);
  env.advance(100);
  assert.equal(env.requests.length, 0, 'до DELAY ни деталей, ни кадра');
  env.advance(400);
  answerDetails(env);
  assert.equal(env.images.length, 1);

  fireHover(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.images.length, 1, 'тот же узел — ни второго кадра, ни перезапуска');
  assert.equal(env.requests.length, 1, 'тот же узел — ни второго запроса деталей');
});

/* Задвоения быть не может: одно действие пользователя даёт ровно одно из
   двух событий. Но даже если бы оба пришли подряд (возврат фокуса Lampa
   поверх наведения), гард state.focusEl не даёт второго кадра. */
test('Task 68: пультовое и мышиное событие на одном узле не задваивают показ', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  fireFocus(main.activity, main.card1);
  fireHover(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.requests.length, 1, 'показ ровно один');
  answerDetails(env);
  assert.equal(env.images.length, 1, 'кадр ровно один');
});

test('Task 68: unmount снимает ОБА слушателя — мышиный не остаётся висеть', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  env.hero.unmount();
  assert.equal(focusListeners(main.activity).length, 0);
  assert.equal(hoverListeners(main.activity).length, 0, 'мышиная подписка тоже снята');
  assert.deepEqual(main.activity._listeners, [], 'на корне не осталось ни одной нашей подписки');
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
  assert.equal(env.requests.length, 1);
  assert.equal(env.requests[0].url, 'movie/22');
  /* Волна 3: кадр выбирается по ответу деталей. */
  answerDetails(env);
  assert.equal(env.images.length, 1, 'ровно одна предзагрузка кадра');
  assert.equal(env.images[0].src, 'https://img/t/p/w1280/b2.jpg', 'кадр карточки, на которой фокус остановился');
});

test('повторный фокус той же карточки не грузит кадр заново', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
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
  const node = heroOf(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  /* Текст подменяется не сразу: старый уходит за 180 мс (раскадровка 23а). */
  env.advance(200);

  /* Правка 2026-09-22: место названия пустует, пока не известен исход
     логотипа — деталей ещё нет, а логотип приходит только с ними. Всё
     остальное содержимое кадра при этом уже на экране. */
  assert.equal(node.find('.lumen-hero__title').text(), '');
  assert.equal(node.find('.lumen-hero__descr').text(), 'о первом');
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'скелетон меты до ответа деталей');
  /* Волна 3: кадр выбирается по ответу деталей — до него кадр не грузится. */
  assert.equal(frameLoads(env).length, 0, 'кадр до ответа деталей не грузится');

  /* Ответ деталей дорисовывает мету, жанры и снимает скелетон — и по нему
     же выбирается кадр (кадров в ответе нет — берётся кадр ряда). */
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное', images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru' }] } });
  assert.equal(node.hasClass('lumen-hero--pending'), false);
  /* Task 43: рейтинг — последний элемент той же строки, отдельного чипа нет. */
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');

  frameImg(env, '/b1.jpg').onload();
  const a = stageOf(node).find('.lumen-hero__bg--a');
  const b = stageOf(node).find('.lumen-hero__bg--b');
  assert.equal(a.hasClass('is-active'), true, 'первый кадр проявлён');
  assert.equal(b.hasClass('is-active'), false);
  assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  /* Task 71: логотип встаёт не по ответу деталей, а по загрузке своей
     картинки. Правка 2026-09-22: пока она едет, место названия пустое —
     текстового заголовка, который потом подменяется логотипом, на экране
     не бывает. */
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'класс обязан ждать картинку логотипа');
  assert.equal(node.find('.lumen-hero__title').text(), '', 'текст названия не имеет права мелькнуть до логотипа');
  const logoPreload = env.images.find((i) => i.src === 'https://img/t/p/w780/l.png');
  assert.ok(logoPreload, 'логотип не предзагружается');
  logoPreload.onload();
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("https://img/t/p/w780/l.png")');
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип есть — текстовый заголовок скрыт CSS');
  assert.equal(node.find('.lumen-hero__title').text(), '');
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
  const node = heroOf(main.activity);
  const a = stageOf(node).find('.lumen-hero__bg--a');
  const b = stageOf(node).find('.lumen-hero__bg--b');

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  env.images[0].onload();
  assert.equal(a.hasClass('is-active'), true);
  assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg');
  assert.equal(b.hasClass('is-active'), false, 'второй слой не поднимался');

  /* Вторая карточка: кадр обязан приехать в ТОТ ЖЕ слой. */
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  answerDetails(env);
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
  const node = heroOf(main.activity);
  const logo = node.find('.lumen-hero__logo');

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.advance(200);
  env.requests[0].ok({ images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(node.hasClass('lumen-hero--compact'), false, 'первый ряд — полное состояние');
  assert.equal(logo.css('width'), '15.93em');
  assert.equal(logo.css('height'), '6.37em');

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--compact'), true, 'второй ряд — сжатое состояние');
  env.requests[1].ok({ images: { logos: [{ file_path: '/l2.png', iso_639_1: 'ru', aspect_ratio: 2.5 }] } });
  assert.equal(logo.css('width'), '15.93em', 'инлайн-размер переход не трогает — мельче логотип делает CSS');
  assert.equal(logo.css('height'), '6.37em');
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
  const node = heroOf(main.activity);

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
  const node = heroOf(main.activity);

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

test('unmount: узел, класс хоста, слушатель, таймер и предзагрузка снимаются, ответ деталей отсекается', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.equal(env.requests.length, 1);
  /* Волна 3: кадр выбирается по ответу деталей — он пошёл грузиться. */
  answerDetails(env);
  assert.equal(env.images.length, 1);

  /* Вторая карточка: её запрос деталей ещё летит, кадр ждёт его ответа
     (frameWait), а кадр первой ещё грузится. Предзагрузку кадра и ожидание
     unmount гасит; запрос деталей отменить нечем (Lampa get ничего не
     возвращает) — его ответ обязан пройти мимо снятого героя без следа. */
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(400);
  assert.equal(env.requests.length, 2);
  env.hero.unmount();
  assert.equal(env.hero.active(), false);
  assert.equal(focusListeners(main.activity).length, 0, 'слушатель фокуса снят');
  env.requests[1].ok({ runtime: 100, backdrop_path: '/late.jpg' });
  env.advance(2000);
  assert.equal(env.images.length, 1, 'поздний ответ деталей или ожидание кадра завели загрузку в снятом герое');
  assert.deepEqual(warnLog, []);
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
  const node = heroOf(main.activity);

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
  const node = heroOf(main.activity);

  env.hero.unmount();
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }] });
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · ★ 7.2', 'мета осталась той, что была до ухода');
  assert.deepEqual(warnLog, []);
});

/* Правка 2026-09-23 (долг фазы 2, п.4): уход в чужую активность героя не
   снимает, а паркует — узлы и кадр остаются до возврата. Снимает его
   unmount (на 'destroy' своей активности, смене настройки, выключении). */
test('detach: герой остаётся, пока активность его, и паркуется при уходе в чужую', () => {
  const env = makeEnv();
  const main = makeMain();
  const other = makeMain();
  env.hero.mount(main.activity);

  env.hero.detach(main.activity);
  assert.equal(env.hero.active(), true, 'та же активность — герой на месте');
  assert.equal(env.hero.parked(), false);

  env.hero.detach(other.activity);
  assert.equal(env.hero.active(), true, 'уход вглубь героя не снимает');
  assert.equal(env.hero.parked(), true);
  assert.equal(env.hero.owns(main.activity), true, 'снять его на destroy главной по-прежнему можно');

  env.hero.unmount();
  assert.equal(env.hero.active(), false);
  assert.equal(focusListeners(main.activity).length, 0, 'слушатель снят вместе с героем');
});

/* Долг фазы 2, п.4 (docs/plans/2026-09-15-lumen-phase2-main.md:372): «герой
   пересобирается на каждом возврате из карточки». Путь «главная → OK на
   карточке → Назад» рантайм видит как detach(корень карточки) и затем
   mount(тот же корень главной) — src/90_runtime.js, ветка 'start'. */
test('возврат из карточки: тот же узел героя, ни нового запроса деталей, ни новой загрузки кадра', () => {
  const env = makeEnv();
  const main = makeMain();
  const card = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  env.images[0].onload();
  const shownSrc = stageOf(node).find('.lumen-hero__bg--a').attr('src');
  assert.ok(shownSrc, 'предусловие: кадр показан');
  const images = env.images.length;
  const requests = env.requests.length;

  env.hero.detach(card.activity);
  assert.equal(env.hero.parked(), true);
  assert.equal(env.bodyClasses.indexOf('lumen-main-on'), -1, 'под карточкой штатный фон Lampa снова работает');
  assert.equal(env.Lampa.Background.change, env.bgOrig, 'обёртка Background.change снята');
  env.advance(20000);
  assert.equal(env.images.length, images, 'пока открыта карточка, герой ничего не грузит');
  assert.equal(env.requests.length, requests);

  /* Назад: Lampa вернула фокус на ту же карточку сама (класс focus стоит) и
     шлёт 'start' главной с тем же render(). */
  env.hero.mount(main.activity);
  assert.equal(env.hero.parked(), false);
  assert.equal(heroOf(main.activity), node, 'узел героя тот же — не пересобран');
  assert.equal(main.activity._children.filter((c) => c.hasClass('lumen-hero')).length, 1, 'второго героя не появилось');
  assert.equal(stageOf(node).find('.lumen-hero__bg--a').attr('src'), shownSrc, 'кадр на месте');
  env.advance(1000);
  assert.equal(env.images.length, images, 'кадр заново не грузится');
  assert.equal(env.requests.length, requests, 'детали заново не спрашиваются');
  assert.ok(env.bodyClasses.indexOf('lumen-main-on') !== -1, 'метка главной вернулась');
  assert.equal(focusListeners(main.activity).length, 1, 'слушатель фокуса один, как и был');
  assert.deepEqual(warnLog, []);
});

/* OK нажали раньше, чем герой успел сменить карточку (350 мс) или дождаться
   деталей: park обрывает загрузку, и на возврате герой показывает то, что в
   фокусе, — в те же узлы. */
test('возврат из карточки: оборванная сменой экрана загрузка доводится заново', () => {
  const env = makeEnv();
  const main = makeMain();
  const card = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.requests[0].ok({ id: 11 });
  env.images[0].onload();

  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(100);
  env.hero.detach(card.activity);
  env.advance(1000);
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 0, 'под карточкой смена героя не доезжает');

  env.hero.mount(main.activity);
  assert.equal(heroOf(main.activity), node, 'узлы те же');
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 1, 'на возврате — детали карточки под фокусом');
  assert.deepEqual(warnLog, []);
});

/* Ревью фикс-раунда, Ф2 п.2. Тот же сценарий, но оборван именно запрос
   деталей: он дольше потолка ожидания логотипа (600 мс), кадр уже на экране,
   таймер фокуса давно отработал — других следов загрузки в state нет.
   Ушли на два уровня (карточка → другая карточка): Lampa сняла слайд
   главной из DOM, и ответ, доехавший в это время, isMounted() отбросил бы
   молча. Прежняя заглушка get отдавала { clear }, и state.net был не пуст —
   у настоящей Lampa он всегда undefined, и этот путь не ловился. */
test('Ф2 п.2: оборванный запрос деталей на возврате доводится заново, а не оставляет скелетон', () => {
  const env = makeEnv();
  const main = makeMain();
  const card = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  /* Подмена текста (180 мс), за ней потолок ожидания логотипа (600 мс) —
     оба отработали: деталей всё ещё нет. Волна 3: кадр, не дождавшись
     деталей за FRAME_WAIT (900 мс), взят по данным ряда и показан; через
     секунду снята и подложка LQIP. */
  env.advance(200);
  env.advance(700);
  env.images[0].onload();
  env.advance(1000);
  /* Живы только отсчёты акцента (3 с) и автотрейлера (8 с) от фокуса —
     park гасит их сам, и stale они не ставят. Ни таймера фокуса, ни
     предзагрузки кадра, ни потолка логотипа: в пути только детали. */
  assert.deepEqual(env.timers.filter((t) => !t.done).map((t) => t.ms).sort(), [3000, 8000], 'предусловие: кроме запроса деталей, в пути ничего');
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'предусловие: деталей ещё нет');
  assert.equal(env.requests.filter((r) => r.url === 'movie/11').length, 1);

  env.hero.detach(card.activity);
  globalThis.document.body.contains = () => false;
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  globalThis.document.body.contains = () => true;

  env.hero.mount(main.activity);
  const again = env.requests.filter((r) => r.url === 'movie/11');
  assert.equal(again.length, 2, 'на возврате детали не запрошены заново — скелетон описания так и горит');
  again[1].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  env.advance(400);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'скелетон не снят');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
  assert.deepEqual(warnLog, []);
});

/* Ф2 п.2, первое следствие: ушли на один уровень — слайд главной в DOM, и
   ответ деталей, доехавший под карточку, прежде отрабатывал в скрытом
   герое: перерисовка, атмосфера (канвас после уборки LC.fx.sweep()), догрузка
   кадра w1280. Теперь он только помечает героя, а показ — на возврате. */
test('Ф2 п.2: ответ деталей, доехавший в запаркованного героя, в скрытом экране не отрабатывает', () => {
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
  const card = makeMain();
  /* Кадра в данных ряда нет — его даст ответ деталей (второй loadFrame). */
  main.card1.card_data = { id: 11, title: 'Первый', poster_path: '/p1.jpg', release_date: '2024-01-01', vote_average: 7.2 };
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.advance(200);
  env.advance(700);
  /* Волна 3: деталей нет за FRAME_WAIT — кадр по данным ряда (постер). */
  env.images[0].onload();
  const images = env.images.length;

  env.hero.detach(card.activity);
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }], backdrop_path: '/b1.jpg' });
  assert.equal(mounts.length, 0, 'под карточкой смонтирован слой атмосферы');
  assert.equal(env.images.length, images, 'под карточкой герой тянет кадр из деталей');
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'скрытый герой перерисован');

  env.hero.mount(main.activity);
  const again = env.requests.filter((r) => r.url === 'movie/11');
  assert.equal(again.length, 2, 'на возврате — детали заново (из кэша Lampa)');
  again[1].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }], backdrop_path: '/b1.jpg' });
  assert.equal(mounts.length, 1, 'на возврате атмосфера поставлена');
  assert.deepEqual(warnLog, []);
});

/* Контрольное ревью 84c7b27..de0e2c8, п.4. Фокус ушёл с карточки на
   не-карточку того же ряда — плитку «Ещё» (.card-more, её hover:focus Lampa
   записывает в last ряда, app.min.js:52780-52783) — и OK на ней открыл
   категорию, пока детали героя были в пути. Ответ доехал на парковке
   (stale), а на возврате items_line.toggle вернул фокус на ту же плитку:
   .card.focus в корне нет, и resume выходил, не показывая героя заново —
   скелетон описания горел до смены фокуса на карточку. */
function staleWithoutCardFocus(t, viaMount) {
  const env = makeEnv();
  const main = makeMain();
  const other = makeMain();
  if (viaMount) main.card1.addClass('focus');
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  if (!viaMount) focusOn(main, main.card1);
  env.advance(400);
  env.advance(200);
  env.advance(700);
  /* Волна 3: деталей нет за FRAME_WAIT — кадр по данным ряда. */
  env.images[0].onload();
  assert.equal(node.hasClass('lumen-hero--pending'), true, 'предусловие: деталей ещё нет');

  /* Фокус на плитке «Ещё»: класс focus уходит с карточки, событие фокуса
     герой не-карточке не отдаёт. */
  main.card1.removeClass('focus');
  env.hero.detach(other.activity);
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });

  env.hero.mount(main.activity);
  const again = env.requests.filter((r) => r.url === 'movie/11');
  assert.equal(again.length, 2, 'на возврате без карточки в фокусе детали не доведены — скелетон горит');
  again[1].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  env.advance(400);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'скелетон не снят');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
  assert.deepEqual(warnLog, []);
}

test('ревью п.4: ответ деталей на парковке, на возврате фокус не на карточке — скелетон снимается', (t) => {
  staleWithoutCardFocus(t, false);
});

test('ревью п.4: то же для героя, показанного при монтировании (фокуса-события не было)', (t) => {
  staleWithoutCardFocus(t, true);
});

/* Контрольное ревью пятого раунда, п.6. Фильм A загружен полностью; фокус
   ушёл на B быстрее DELAY (в пути только таймер фокуса B), потом на плитку
   «Ещё» — OK — Назад. park() ставил stale и за один таймер фокуса, и
   resume без карточки в фокусе заново показывал A: скелетон описания
   вспыхивал, детали A спрашивались повторно. Оборвана была загрузка не
   показанного фильма, а только отсчёт до чужого. */
test('пятый раунд п.6: в пути только таймер фокуса другой карточки — возврат без карточки в фокусе A не перерисовывает', () => {
  const env = makeEnv();
  const main = makeMain();
  const other = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  env.images[0].onload();
  env.advance(1000);
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'предусловие: A показан полностью');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');

  /* A -> B быстрее DELAY, затем плитка «Ещё»: карточки в фокусе нет. */
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(100);
  main.card2.removeClass('focus');
  env.hero.detach(other.activity);
  env.advance(1000);

  env.hero.mount(main.activity);
  assert.equal(env.requests.filter((r) => r.url === 'movie/11').length, 1, 'на возврате A показан заново — детали спрошены повторно');
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 0, 'на возврате показан B, которого нет в фокусе');
  assert.equal(node.hasClass('lumen-hero--pending'), false, 'на возврате вспыхнул скелетон A');
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2', 'описание A пропало');
  assert.deepEqual(warnLog, []);
});

/* Контрольное ревью шестого раунда, п.1. Тот же сценарий, что выше, но после
   возврата пользователь уходит с плитки «Ещё» влево на B. park() гасил таймер
   фокуса B, но оставлял state.focusEl = B: гард «фокус не сменился» в
   onFocus съедал событие, и герой так и висел на A, хотя в фокусе B. */
test('шестой раунд п.1: таймер B оборван парковкой — после возврата фокус на B показывает B', () => {
  const env = makeEnv();
  const main = makeMain();
  const other = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.requests[0].ok({ id: 11, runtime: 100, genres: [{ name: 'драма' }] });
  env.images[0].onload();
  env.advance(1000);

  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(100);
  main.card2.removeClass('focus');
  env.hero.detach(other.activity);
  env.advance(1000);
  env.hero.mount(main.activity);
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 0, 'предусловие: B ещё не показывали');

  /* С плитки «Ещё» влево — снова на B. */
  focusOn(main, main.card2);
  env.advance(400);
  const b = env.requests.filter((r) => r.url === 'movie/22');
  assert.equal(b.length, 1, 'фокус на B не запросил его деталей — герой висит на A');
  b[0].ok({ id: 22, runtime: 90, genres: [{ name: 'комедия' }] });
  env.advance(1000);
  assert.equal(node.find('.lumen-hero__meta').text(), '2025 · 1:30 · комедия · ★ 6.4', 'описание героя не от B');
  assert.deepEqual(warnLog, []);
});

/* Ф2 п.1. «Полный» режим, атмосфера, тот же фильм под фокусом: главная
   → OK → Назад. Канвас героя снимает уборка LC.fx.sweep() на 'start'
   карточки; resume обязан поставить его заново — иначе частицы пропадают до
   следующей смены фильма в фокусе. */
test('Ф2 п.1: возврат из карточки ставит атмосферу заново, если фильм тот же', () => {
  const mounts = [];
  const unmounts = [];
  const env = makeEnv({
    themes: {
      forMovie: () => ({ id: 'snow', preset: 'snow' }),
      particleColor: () => '#FFFFFF',
      classNames: () => 'lumen-theme--snow'
    },
    fx: { mount: (host, preset, opts) => { mounts.push(opts); return { destroy() {} }; }, unmount: (host) => { unmounts.push(host); } }
  });
  const main = makeMain();
  const card = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(400);
  env.requests[0].ok({ id: 11, overview: 'о первом' });
  env.images[0].onload();
  assert.equal(mounts.length, 1, 'предусловие: слой атмосферы стоит');
  const requests = env.requests.length;

  env.hero.detach(card.activity);
  /* Здесь рантайм зовёт LC.fx.sweep(): канвас героя снят. */
  env.hero.mount(main.activity);
  assert.equal(mounts.length, 2, 'после возврата слой атмосферы не поставлен заново');
  assert.equal(mounts[1].paused(), false, 'вернувшийся слой стоит на паузе');
  assert.equal(env.requests.length, requests, 'ради атмосферы детали заново не спрашиваются');
  assert.deepEqual(warnLog, []);
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
  const node = heroOf(grid);
  assert.equal(node.hasClass('lumen-hero'), true);
  assert.equal(node.hasClass('lumen-hero--compact'), true);
  assert.equal(grid.hasClass('lumen-grid--hero'), true);
  assert.equal(grid.hasClass('lumen-rows-up'), true, 'сжатый всегда — значит и место отдано сразу');

  fireFocus(grid, card);
  env.advance(400);
  answerDetails(env);
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
  const node = heroOf(main.activity);
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
  const node = heroOf(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  /* Task 71: вывод текста отложен на SWAP_MS и в 'off' — но анимации ухода
     текста здесь по-прежнему нет, только отсрочка. */
  assert.equal(node.find('.lumen-hero__text').hasClass('is-swapping'), false);
  env.advance(200);
  /* Правка 2026-09-22: название ждёт исхода логотипа — деталей ещё нет. */
  assert.equal(node.find('.lumen-hero__title').text(), '');
  assert.equal(env.images.length, 0, 'ни одной предзагрузки кадра');
  /* Task 29: живой таймер расчёта акцента — трёхсекундный; он от режима
     анимаций не зависит (цвет кнопок — не движение). Таймаута загрузки кадра
     при этом нет: кадр в 'off' не запрашивается вовсе. Правка 2026-09-22:
     рядом с ним ждёт потолок вывода названия (600 мс). */
  assert.deepEqual(env.timers.filter((t) => !t.done).map((t) => t.ms), [3000, 600], 'ни одного таймаута загрузки');

  /* Текст при этом живой: детали запрашиваются и дорисовываются. */
  assert.equal(env.requests.length, 1);
  env.requests[0].ok({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное' });
  /* Логотипа у фильма нет — ждать нечего, название встаёт тем же ответом. */
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');
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
    answerDetails(env);
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
  const node = heroOf(main.activity);

  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  assert.equal(env.images[0].src, 'https://img/t/p/w92/p.jpg');
  env.images[0].onload();
  /* Task 52: метка стоит на СЛОЕ, который этот постер и показывает, а не на
     корне героя. */
  assert.equal(stageOf(node).find('.lumen-hero__bg--a').hasClass('lumen-hero__bg--blur'), true);
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
    const node = heroOf(main.activity);
    const a = stageOf(node).find('.lumen-hero__bg--a');
    const b = stageOf(node).find('.lumen-hero__bg--b');
    const label = heavy ? 'с кроссфейдом' : 'без кроссфейда';

    main.card1.addClass('focus');
    fireFocus(main.activity, main.card1);
    env.advance(400);
    answerDetails(env);
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
    answerDetails(env);
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
  answerDetails(env);
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
  const node = heroOf(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  /* Волна 3: кадр выбирается по ответу деталей (answerDetails). */
  answerDetails(env);
  return { env: env, main: main, node: node, bg: stageOf(node).find('.lumen-hero__bg--a'), img: env.images[0] };
}

/* Перевести фокус на вторую карточку и дождаться её показа: новый show()
   поднимает поколение, снимает предзагрузку прежней карточки и заводит
   свой Image. Возвращается этот новый Image. */
function focusSecond(f) {
  f.main.card1.removeClass('focus');
  f.main.card2.addClass('focus');
  fireFocus(f.main.activity, f.main.card2);
  f.env.advance(400);
  answerDetails(f.env);
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

/* Волна 3 (ТВ 2026-09-24): прежде здесь на экране оставался кадр прошлого
   фильма — «пустой герой хуже устаревшего кадра». Теперь кадр чужого
   фильма под новым текстом не остаётся: неудача кадра сразу ставит
   заглушку holdFrame — постер нового фильма из ряда. Пустоты по-прежнему
   нет, и битый кадр по-прежнему ни в один слой не попадает. */
test('Task 47: реджект decode() без байт — битый кадр в слой не идёт и пустоты нет (волна 3: постер нового фильма из ряда)', async () => {
  const f = focusedFrame();
  arrive(f.img);
  f.img.decoded.resolve();
  await tick();
  assert.equal(f.bg.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'первый кадр на экране');

  const second = focusSecond(f);
  second.decoded.reject(new Error('broken image'));
  await tick();
  const stage = stageOf(f.node);
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w300/p2.jpg', 'на экране не постер нового фильма');
  for (const cls of ['.lumen-hero__bg--a', '.lumen-hero__bg--b']) {
    assert.notEqual(stage.find(cls).attr('src'), 'https://img/t/p/w1280/b2.jpg', cls + ': битый кадр поставлен в слой');
  }
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
  const node = heroOf(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  assert.equal(typeof env.images[0].decode, 'undefined', 'заглушка без decode');
  env.images[0].onload();
  assert.equal(stageOf(node).find('.lumen-hero__bg--a').attr('src'), 'https://img/t/p/w1280/b1.jpg');
});

/* ====================================================================== */
/* Task 64: <img> с приоритетом, подложка LQIP                            */
/* ====================================================================== */

/* Слои кадра стали <img>: у фона нет ни decoding, ни fetchpriority, ни
   decode(), ни load/error, и запрос за картинкой уходит только после
   раскладки (docs/research/2026-09-21-webview-perf.md §4, «Герой — только
   <img>»). */
/* Волна 3 (ТВ 2026-09-24, решение координатора): чипы профилей настроения
   из героя убраны — меньше текста в кадре; подборки остаются в хабе и
   меню. Слота под них в текстовом блоке больше нет, и LC.moods при живом
   кадре чипов на главной не ставит (test/moods.test.mjs). */
test('волна 3: в тексте героя нет места под чипы настроения', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  assert.ok(node.find('.lumen-hero__text').length, 'текстовый блок героя не найден');
  assert.equal(node.find('.lumen-hero__moods'), EMPTY, 'слот чипов настроения остался в тексте героя');
});

/* Волна 3: кадр героя ≠ постер. Кадр выбирает heroBackdrop по images из
   ответа деталей, поэтому show() ждёт детали — но не дольше FRAME_WAIT
   (900 мс): дальше кадр по backdrop_path из данных ряда. Детали из кэша
   Lampa приходят синхронно, и ожидания там нет вовсе. */
const W3_IMAGES = { backdrops: [
  Object.assign({ file_path: '/b1.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES),
  Object.assign({ file_path: '/scene.jpg', iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES)
] };

function frameLoads(env) {
  return env.images.filter((i) => /\/w1280\//.test(i.src)).map((i) => i.src.replace('https://img/t/p/w1280', ''));
}

test('волна 3: кадр героя — выбранный по деталям, ключевой арт не грузится вовсе', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  assert.deepEqual(frameLoads(env), [], 'кадр грузится до ответа деталей — это был бы ключевой арт');
  env.requests[0].ok({ id: 11, backdrop_path: '/b1.jpg', images: W3_IMAGES });
  assert.deepEqual(frameLoads(env), ['/scene.jpg'], 'кадр героя — второй кадр без надписей');
  env.images.find((i) => /scene/.test(i.src)).onload();
  assert.equal(stageOf(heroOf(main.activity)).find('.lumen-hero__bg--a').attr('src'), 'https://img/t/p/w1280/scene.jpg');
  assert.deepEqual(warnLog, []);
});

test('волна 3: детали не пришли за 900 мс — кадр по backdrop_path, поздние детали кадр не меняют', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  env.advance(850);
  assert.deepEqual(frameLoads(env), [], 'ждём детали до 900 мс после показа');
  env.advance(100);
  assert.deepEqual(frameLoads(env), ['/b1.jpg'], 'детали не пришли — кадр по данным ряда');
  env.images.find((i) => /b1\.jpg/.test(i.src)).onload();
  /* Поздний ответ дорисовывает текст, а кадр не трогает: вторая смена кадра
     на той же карточке была бы ровно той подменой, от которой уходим. */
  env.requests[0].ok({ id: 11, backdrop_path: '/b1.jpg', runtime: 90, images: W3_IMAGES });
  assert.deepEqual(frameLoads(env), ['/b1.jpg'], 'поздние детали догрузили второй кадр');
  assert.equal(stageOf(heroOf(main.activity)).find('.lumen-hero__bg--a').attr('src'), 'https://img/t/p/w1280/b1.jpg');
});

test('волна 3: детали из кэша (синхронно) — кадр сразу, без ожидания', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const tmdb = env.Lampa.Api.sources.tmdb;
  const get = tmdb.get;
  tmdb.get = (url, params, ok, err, opts) => ok({ id: 11, backdrop_path: '/b1.jpg', images: W3_IMAGES });
  try {
    fireFocus(main.activity, main.card1);
    env.advance(400);
  } finally {
    tmdb.get = get;
  }
  assert.deepEqual(frameLoads(env), ['/scene.jpg']);
});

/* Волна 3 (ТВ 2026-09-24, фото 2): текст нового фильма, а под ним кадр
   прошлого — кадр не доехал или не загрузился. Кадр ЧУЖОГО фильма под
   новым текстом не держится дольше HOLD_MS (250 мс от вывода текста;
   текст выходит через SWAP_MS = 180 мс после показа или сразу, если
   детали пришли): вместо него встаёт постер новой карточки из ряда — он
   уже в кэше браузера (Lampa нарисовала его в ряду), растягивается
   апскейлом без filter и помечается метой размытия; постера в ряду ещё
   нет — нейтральный фон страницы. */
function shownFrame(env, main) {
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  frameImg(env, '/b1.jpg').onload();
  const stage = stageOf(heroOf(main.activity));
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w1280/b1.jpg', 'предусловие: кадр первого фильма на экране');
  return stage;
}

test('волна 3: кадр прошлого фильма под новым текстом не дольше 250 мс — заглушка из постера ряда', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const active = () => stage.find('.lumen-hero__bg.is-active');

  fireFocus(main.activity, main.card2);
  env.advance(350);
  assert.equal(detailsOf(env, 22) && true, true, 'второй фильм показан — детали спрошены');
  env.advance(180);
  assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о втором', 'текст второго фильма выведен');
  env.advance(249);
  assert.equal(active().attr('src'), 'https://img/t/p/w1280/b1.jpg', 'раньше 250 мс заглушку не ставим');
  env.advance(2);
  assert.equal(active().attr('src'), 'https://img/t/p/w300/p2.jpg', 'через 250 мс под текстом второго фильма — его постер из ряда');
  assert.equal(active().hasClass('lumen-hero__bg--blur'), true, 'постер помечен как размытый слой');
  assert.equal(env.images.filter((i) => /p2\.jpg/.test(i.src)).length, 0, 'постер из ряда не грузится заново — он уже в кэше');

  detailsOf(env, 22).ok({ id: 22 });
  frameImg(env, '/b2.jpg').onload();
  assert.equal(active().attr('src'), 'https://img/t/p/w1280/b2.jpg', 'кадр второго фильма сменил заглушку');
  assert.equal(active().hasClass('lumen-hero__bg--blur'), false);
  assert.deepEqual(warnLog, []);
});

test('волна 3: постера в ряду ещё нет — вместо кадра прошлого фильма нейтральный фон', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  main.card2.find('.card__img').attr('src', './img/img_load.svg');
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(180);
  env.advance(251);
  assert.equal(stage.find('.lumen-hero__bg.is-active'), EMPTY, 'кадр прошлого фильма остался на экране');
  detailsOf(env, 22).ok({ id: 22 });
  frameImg(env, '/b2.jpg').onload();
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w1280/b2.jpg');
});

test('волна 3: кадр нового фильма не загрузился — кадр прошлого не остаётся и до 250 мс', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  detailsOf(env, 22).ok({ id: 22 });
  frameImg(env, '/b2.jpg').onerror();
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w300/p2.jpg', 'после ошибки кадра — сразу постер нового фильма');
});

/* Отсчёт — от вывода текста, а не от показа: кадр, доехавший через 300 мс
   после показа (120 мс после текста), встаёт без заглушки, одной сменой. */
test('волна 3: кадр нового фильма успел за 250 мс от вывода текста — заглушки нет, смена одна', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const seen = [];
  const a = stage.find('.lumen-hero__bg--a');
  const orig = a.attr;
  a.attr = function (name, val) {
    if (name === 'src' && arguments.length === 2) seen.push(val);
    return orig.apply(this, arguments);
  };

  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(200);
  assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о втором', 'текст второго фильма выведен');
  detailsOf(env, 22).ok({ id: 22 });
  env.advance(100);
  frameImg(env, '/b2.jpg').onload();
  env.advance(1000);
  assert.deepEqual(seen, ['https://img/t/p/w1280/b2.jpg'], 'между кадрами двух фильмов мелькнула заглушка');
});

/* Кадр первого фильма не доехал, а его подложка LQIP (w300) уже на экране —
   это тоже кадр чужого фильма под новым текстом. */
test('волна 3: на экране только подложка прошлого фильма — через 250 мс нет и её', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  main.card2.find('.card__img').attr('src', './img/img_load.svg');
  env.hero.mount(main.activity);
  const stage = stageOf(heroOf(main.activity));
  const lqip = stage.find('.lumen-hero__lqip');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b1.jpg', 'предусловие: подложка первого фильма');

  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(180);
  env.advance(251);
  assert.equal(lqip.hasClass('is-active'), false, 'подложка прошлого фильма осталась под текстом нового');
  assert.equal(lqip.attr('src'), undefined);
  detailsOf(env, 22).ok({ id: 22 });
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b2.jpg', 'подложка нового фильма не встала');
  assert.equal(lqip.hasClass('is-active'), true);
});

test('волна 3: подложка нового фильма встала раньше 250 мс — заглушка её не прячет', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  const stage = stageOf(heroOf(main.activity));
  const lqip = stage.find('.lumen-hero__lqip');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  detailsOf(env, 22).ok({ id: 22 });
  env.advance(300);
  assert.equal(lqip.attr('src'), 'https://img/t/p/w300/b2.jpg');
  assert.equal(lqip.hasClass('is-active'), true);
  assert.equal(stage.find('.lumen-hero__bg.is-active'), EMPTY, 'поверх подложки нового фильма встала заглушка');
});

/* Ревью волны 3, п.1: отсчёт заглушки заводит вывод текста показа, а фокус
   к этому мигу может уже стоять на другой карточке — при листании шагом
   550 мс он уходит через 20 мс после вывода текста. Прежде отсчёт это не
   замечал: через 250 мс на весь экран вставал постер карточки, с которой
   фокус уже ушёл (живьём — постер «Бегущей» через 244 мс после ухода фокуса
   на «Обсессию», шесть растянутых постеров на шести шагах). Бриф: «фон при
   листании не мигает». Теперь уход фокуса отсчёт снимает, а заглушка
   встаёт у той карточки, где фокус остановился. */
function addCard(main, id) {
  const card = makeCard(id, 'Фильм ' + id, { poster: 'https://img/t/p/w300/p' + id + '.jpg', rect: { left: 0, top: 0, width: 1, height: 1 } });
  card.card_data = { id: id, title: 'Фильм ' + id, backdrop_path: '/b' + id + '.jpg', poster_path: '/p' + id + '.jpg', overview: 'о фильме ' + id, release_date: '2024-01-01', vote_average: 7 };
  main.line0.append(card);
  return card;
}

/* Все замены src в слоях кадра по порядку: заглушка, мелькнувшая на один
   тик и тут же сменённая, в итоговом состоянии слоя не видна. */
function layerLog(env, stage) {
  const seen = [];
  for (const cls of ['.lumen-hero__bg--a', '.lumen-hero__bg--b']) {
    const layer = stage.find(cls);
    const orig = layer.attr;
    layer.attr = function (name, val) {
      if (name === 'src' && arguments.length === 2) seen.push(val);
      return orig.apply(this, arguments);
    };
  }
  return seen;
}

for (const input of ['пульт', 'мышь']) {
  test('ревью волны 3, п.1 (' + input + '): фокус ушёл раньше 250 мс — постер покинутой карточки не встаёт, встаёт постер той, где фокус остановился', () => {
    const env = makeEnv({ fxHeavy: () => false });
    const main = makeMain();
    const card3 = addCard(main, 33);
    env.hero.mount(main.activity);
    const stage = shownFrame(env, main);
    const seen = layerLog(env, stage);
    const move = input === 'мышь' ? fireHover : fireFocus;
    const active = () => stage.find('.lumen-hero__bg.is-active');

    move(main.activity, main.card2);
    env.advance(350);
    env.advance(180);
    assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о втором', 'предусловие: текст второго фильма выведен');
    env.advance(100);
    move(main.activity, card3);
    env.advance(200);
    assert.equal(active().attr('src'), 'https://img/t/p/w1280/b1.jpg', 'фокус ушёл — под текстом второго фильма его постер не ставим');
    assert.deepEqual(seen, [], 'слой кадра менялся, пока фокус шёл дальше');

    env.advance(150);
    env.advance(180);
    assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о фильме 33', 'предусловие: текст третьего фильма выведен');
    env.advance(249);
    assert.deepEqual(seen, [], 'раньше 250 мс от текста заглушку не ставим');
    env.advance(2);
    assert.deepEqual(seen, ['https://img/t/p/w300/p33.jpg'], 'фокус остановился — постер той карточки, на которой он стоит, и только он');
    assert.deepEqual(warnLog, []);
  });
}

/* Возврат фокуса на показанную карточку (быстрее DELAY, show() не
   повторяется): снятый уходом отсчёт заводится заново — иначе кадр
   прошлого фильма стоял бы под её текстом, пока не доедет свой. Отсчёт —
   с начала, от возврата: и когда прежний истёк бы, пока фокус был в
   стороне (200 мс), и когда он ещё шёл бы (50 мс). */
for (const away of [50, 200]) {
  test('ревью волны 3, п.1: фокус вернулся на показанную карточку через ' + away + ' мс — через 250 мс её постер, не раньше', () => {
    const env = makeEnv({ fxHeavy: () => false });
    const main = makeMain();
    env.hero.mount(main.activity);
    const stage = shownFrame(env, main);
    const seen = layerLog(env, stage);

    fireFocus(main.activity, main.card2);
    env.advance(350);
    env.advance(180);
    env.advance(100);
    fireFocus(main.activity, main.card1);
    env.advance(away);
    assert.deepEqual(seen, [], 'фокус на другой карточке — заглушки нет');
    fireFocus(main.activity, main.card2);
    env.advance(249);
    assert.deepEqual(seen, [], 'фокус вернулся — отсчёт с начала, раньше 250 мс заглушки нет');
    env.advance(2);
    assert.deepEqual(seen, ['https://img/t/p/w300/p2.jpg'], 'фокус постоял на показанной карточке 250 мс — её постер');
    assert.deepEqual(warnLog, []);
  });
}

/* Фокус ушёл ещё до вывода текста (в SWAP_MS после show()): вывод отсчёт
   не заводит, и 250 мс считаются от возврата фокуса, а не от вывода. */
test('ревью волны 3, п.1: фокус ушёл до вывода текста и вернулся — отсчёт от возврата', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  const card3 = addCard(main, 33);
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const seen = layerLog(env, stage);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(100);
  fireFocus(main.activity, card3);
  env.advance(80);
  assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о втором', 'предусловие: текст выведен при фокусе на другой карточке');
  env.advance(100);
  fireFocus(main.activity, main.card2);
  env.advance(249);
  assert.deepEqual(seen, [], 'заглушка раньше 250 мс от возврата фокуса');
  env.advance(2);
  assert.deepEqual(seen, ['https://img/t/p/w300/p2.jpg']);
  assert.deepEqual(warnLog, []);
});

/* Тот же уход фокуса, но кадр показанной карточки не загрузился вовсе:
   заглушка по ошибке кадра — тоже только при фокусе на этой карточке. */
test('ревью волны 3, п.1: кадр показанной карточки упал, когда фокус уже на другой, — заглушки нет до возврата фокуса', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  const card3 = addCard(main, 33);
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const seen = layerLog(env, stage);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  detailsOf(env, 22).ok({ id: 22 });
  fireFocus(main.activity, card3);
  frameImg(env, '/b2.jpg').onerror();
  env.advance(300);
  assert.deepEqual(seen, [], 'ошибка кадра, фокус на другой карточке — слой кадра не меняется');
  fireFocus(main.activity, main.card2);
  env.advance(251);
  assert.deepEqual(seen, ['https://img/t/p/w300/p2.jpg'], 'фокус вернулся — постер показанной карточки');
  assert.deepEqual(warnLog, []);
});

/* Отложенная заглушка — такая же оборванная работа показанного фильма, как
   живой отсчёт: кадр A упал, пока фокус стоял на B, фокус ушёл с B на
   не-карточку (плитка «Ещё») быстрее DELAY, и OK увёл с главной. На
   возврате без карточки в фокусе resume показывает A заново (state.stale),
   иначе кадр прошлого фильма так и стоял бы под текстом A. */
test('ревью волны 3, п.1: отложенная уходом фокуса заглушка переживает парковку — на возврате A показан заново', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  const other = makeMain();
  const card3 = addCard(main, 33);
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const active = () => stage.find('.lumen-hero__bg.is-active');

  fireFocus(main.activity, main.card2);
  env.advance(350);
  detailsOf(env, 22).ok({ id: 22 });
  env.advance(180);
  fireFocus(main.activity, card3);
  frameImg(env, '/b2.jpg').onerror();
  env.advance(100);
  assert.equal(active().attr('src'), 'https://img/t/p/w1280/b1.jpg', 'предусловие: заглушка отложена, на экране кадр прошлого фильма');
  env.hero.detach(other.activity);

  env.hero.mount(main.activity);
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 2, 'на возврате A не показан заново');
  env.advance(180);
  env.advance(251);
  assert.equal(active(), EMPTY, 'под текстом A остался кадр прошлого фильма');
  assert.deepEqual(warnLog, []);
});

/* Обратная сторона: кадр показанного фильма встал, пока фокус стоял на
   другой карточке, — заглушка больше не нужна, и парковка не должна
   считать её оборванной работой (повторный показ A на возврате вспыхнул
   бы текстом и спросил детали второй раз). */
test('ревью волны 3, п.1: кадр встал при фокусе на другой карточке — парковка A заново не показывает', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  const other = makeMain();
  const card3 = addCard(main, 33);
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);

  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(100);
  fireFocus(main.activity, card3);
  env.advance(100);
  detailsOf(env, 22).ok({ id: 22 });
  frameImg(env, '/b2.jpg').onload();
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w1280/b2.jpg', 'предусловие: кадр A на экране');
  env.hero.detach(other.activity);

  env.hero.mount(main.activity);
  assert.equal(env.requests.filter((r) => r.url === 'movie/22').length, 1, 'A показан заново, хотя его загрузка не оборвана');
  assert.deepEqual(warnLog, []);
});

/* Ревью волны 3, п.2: кадр, доехавший сразу после 250 мс, давал короткую
   вспышку постера (живьём — 26 мс при возврате из карточки): байты уже
   пришли, а decode() ещё шёл. Байты доехали (complete && naturalWidth —
   тот же признак, что у страховочного таймаута) — заглушку откладываем
   ещё на 150 мс; не доехали — она встаёт через 250 мс, как прежде. */
async function decodingSecond(env) {
  stubDecode(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  const first = frameImg(env, '/b1.jpg');
  arrive(first);
  first.decoded.resolve();
  await tick();
  const stage = stageOf(heroOf(main.activity));
  assert.equal(stage.find('.lumen-hero__bg.is-active').attr('src'), 'https://img/t/p/w1280/b1.jpg', 'предусловие: кадр первого фильма на экране');
  const seen = layerLog(env, stage);
  fireFocus(main.activity, main.card2);
  env.advance(350);
  /* Детали пришли — текст выведен, отсчёт 250 мс заведён, кадр грузится. */
  detailsOf(env, 22).ok({ id: 22 });
  assert.equal(heroOf(main.activity).find('.lumen-hero__descr').text(), 'о втором', 'предусловие: текст второго фильма выведен');
  return { seen: seen, img: frameImg(env, '/b2.jpg') };
}

test('ревью волны 3, п.2: байты кадра доехали, идёт decode — заглушку не ставим, кадр встаёт одной сменой', async () => {
  const env = makeEnv({ fxHeavy: () => false });
  const s = await decodingSecond(env);
  arrive(s.img);
  env.advance(251);
  assert.deepEqual(s.seen, [], 'байты кадра доехали, а на экран встал постер');
  env.advance(100);
  s.img.decoded.resolve();
  await tick();
  env.advance(1000);
  assert.deepEqual(s.seen, ['https://img/t/p/w1280/b2.jpg'], 'между кадрами двух фильмов мелькнул постер');
  assert.deepEqual(warnLog, []);
});

test('ревью волны 3, п.2: decode не кончился и за 150 мс сверх отсчёта — заглушка, не раньше', async () => {
  const env = makeEnv({ fxHeavy: () => false });
  const s = await decodingSecond(env);
  arrive(s.img);
  /* Шагами: таймер, заведённый внутри сработавшего, фейк отсчитывает от
     конца шага advance. */
  env.advance(251);
  env.advance(147);
  assert.deepEqual(s.seen, [], 'заглушка раньше 250 + 150 мс');
  env.advance(3);
  assert.deepEqual(s.seen, ['https://img/t/p/w300/p2.jpg'], 'отсрочка одна: дальше — постер нового фильма');
  s.img.decoded.resolve();
  await tick();
  assert.deepEqual(s.seen, ['https://img/t/p/w300/p2.jpg', 'https://img/t/p/w1280/b2.jpg'], 'кадр сменил заглушку');
  assert.deepEqual(warnLog, []);
});

/* Байтов нет: загрузка ещё идёт — или уже кончилась ошибкой (complete без
   naturalWidth), а onerror до героя ещё не дошёл. */
for (const how of ['едут', 'ошибка']) {
  test('ревью волны 3, п.2: байты кадра не доехали (' + how + ') — заглушка через 250 мс, как прежде', async () => {
    const env = makeEnv({ fxHeavy: () => false });
    const s = await decodingSecond(env);
    if (how === 'ошибка') s.img.complete = true;
    env.advance(249);
    assert.deepEqual(s.seen, []);
    env.advance(2);
    assert.deepEqual(s.seen, ['https://img/t/p/w300/p2.jpg'], 'без байтов кадра отсрочки нет');
    assert.deepEqual(warnLog, []);
  });
}

/* Сценарий ревью живьём: детали задержаны на 700 мс, шесть шагов по
   550 мс. Ни кадр, ни детали не успевают ни на одном шаге, и прежде на
   каждом шаге через 230 мс после ухода фокуса вставал постер покинутой
   карточки. Теперь слой кадра за всё листание не меняется ни разу, а
   после остановки — постер через 250 мс от текста и кадр, когда доедут
   детали. */
test('ревью волны 3, п.1: листание шагом 550 мс при деталях через 700 мс — ни одной заглушки, пока фокус идёт', () => {
  const env = makeEnv({ fxHeavy: () => false });
  const main = makeMain();
  const cards = [33, 44, 55, 66, 77, 88].map((id) => addCard(main, id));
  env.hero.mount(main.activity);
  const stage = shownFrame(env, main);
  const seen = layerLog(env, stage);
  const born = new Map();
  function run(ms) {
    for (let t = 0; t < ms; t += 10) {
      env.advance(10);
      for (const r of env.requests) {
        if (!/^movie\/\d+$/.test(r.url) || r.answered) continue;
        if (!born.has(r)) born.set(r, env.now);
        if (env.now - born.get(r) >= 700) {
          r.answered = true;
          r.ok({ id: Number(r.url.split('/')[1]) });
        }
      }
    }
  }

  for (const card of cards) {
    fireFocus(main.activity, card);
    run(550);
  }
  assert.deepEqual(seen, [], 'за листание слой кадра менялся: ' + seen.join(', '));
  run(250);
  assert.deepEqual(seen, ['https://img/t/p/w300/p88.jpg'], 'фокус остановился — постер последней карточки');
  run(300);
  frameImg(env, '/b88.jpg').onload();
  assert.deepEqual(seen, ['https://img/t/p/w300/p88.jpg', 'https://img/t/p/w1280/b88.jpg'], 'детали доехали — кадр последней карточки');
  assert.deepEqual(warnLog, []);
});

test('Task 64: слои кадра — img с decoding=async и высоким приоритетом', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const stage = stageOf(heroOf(main.activity));
  for (const cls of ['.lumen-hero__bg--a', '.lumen-hero__bg--b']) {
    const layer = stage.find(cls);
    assert.equal(layer.attr('decoding'), 'async', cls + ': нет подсказки на асинхронное декодирование');
    assert.equal(layer.attr('fetchpriority'), 'high', cls + ': кадр героя — самая крупная картинка экрана, приоритет обязан быть высоким');
  }
  const lqip = stage.find('.lumen-hero__lqip');
  assert.equal(lqip.attr('decoding'), 'async', 'подложка LQIP декодируется асинхронно');
  /* Приоритета у подложки нет намеренно: высокий приоритет у двух картинок
     разом отнял бы его у той, ради которой он и заведён. */
  assert.equal(lqip.attr('fetchpriority'), undefined);
});

/* Волна 3 (ТВ 2026-09-24, фото 15/16/17): кадр героя — во весь экран и
   неподвижен, затемнение — три градиента без кромок. Всё это живёт в
   отдельном слое .lumen-hero-stage: кадры, подложка, ролик, затемнение и
   пол сжатого состояния, строго в этом порядке (порядок узлов — порядок
   отрисовки). В самом .lumen-hero остаются частицы и текст; вуалей нет
   нигде. */
test('волна 3: кадр, подложка, ролик и затемнение — в неподвижном слое кадра, вуалей нет', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const hero = heroOf(main.activity);
  const stage = stageOf(hero);
  assert.ok(stage.length, 'слоя кадра в корне нет');
  const kids = stage._children.map((c) => c._class.join(' '));
  assert.deepEqual(kids, [
    'lumen-hero__lqip',
    'lumen-hero__bg lumen-hero__bg--a',
    'lumen-hero__bg lumen-hero__bg--b',
    'lumen-hero__trailer',
    'lumen-hero__scrim',
    'lumen-hero__scrim lumen-hero__scrim--l',
    'lumen-hero__floor'
  ], 'состав и порядок слоя кадра');
  for (const cls of ['.lumen-hero__bg', '.lumen-hero__lqip', '.lumen-hero__trailer', '.lumen-hero__scrim', '.lumen-hero__floor']) {
    assert.equal(hero.find(cls), EMPTY, cls + ' остался в узле героя — он сжимается вместе с текстом');
  }
  assert.equal(hero.find('.lumen-hero__veil'), EMPTY, 'вуаль в узле героя');
  assert.equal(stage.find('.lumen-hero__veil'), EMPTY, 'вуаль в слое кадра');
  assert.ok(hero.find('.lumen-fx').length && hero.find('.lumen-hero__text').length, 'частицы и текст — в узле героя');
  /* Класс режима анимаций у слоя свой — переходы кадра заведены под ним. */
  assert.equal(stage.hasClass('lumen-motion-full'), true, 'у слоя кадра нет класса режима');
  env.hero.unmount();
  assert.equal(main.activity._children.some((c) => c.hasClass('lumen-hero-stage') || c.hasClass('lumen-hero')), false,
    'unmount оставил в корне узлы героя');
});

test('Task 64: предзагрузчик кадра просит высокий приоритет — запрос делает он', () => {
  const env = makeEnv();
  const main = makeMain();
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  assert.equal(env.images[0].fetchPriority, 'high');
});

/* Подложка LQIP: тот же backdrop в w300 (0.05 Мпикс против 0.92 у w1280,
   ресёрч §1.5/§4). Показывается СРАЗУ, не дожидаясь ни байтов, ни decode()
   основного кадра, — в этом весь её смысл. */
test('Task 64: подложка w300 встаёт сразу, до байтов и decode() основного кадра', () => {
  const f = focusedFrame();
  const lqip = stageOf(f.node).find('.lumen-hero__lqip');
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
  const lqip = stageOf(f.node).find('.lumen-hero__lqip');
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
  const lqip = stageOf(f.node).find('.lumen-hero__lqip');
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
  assert.equal(stageOf(f.node).find('.lumen-hero__bg--b').attr('src'), 'https://img/t/p/w1280/b2.jpg', 'второй кадр не приехал — проверять нечего');
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
  const lqip = stageOf(f.node).find('.lumen-hero__lqip');
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
  const node = heroOf(main.activity);
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
  const lqip = stageOf(node).find('.lumen-hero__lqip');
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
  const node = heroOf(main.activity);
  const lqip = stageOf(node).find('.lumen-hero__lqip');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(400);
  answerDetails(env);
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
  answerDetails(env);
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
  const node = heroOf(main.activity);

  fireFocus(main.activity, main.card1);
  env.advance(400);
  /* Логотип приходит с деталями: рамка при DPR 2 — 1900 физических пикселей,
     но потолок логотипа w780 (ревью Task 39, п.4).
     Task 71: адрес у него запрашивает предзагрузчик, и фоном он встаёт
     после того, как картинка доехала. Волна 3: по этому же ответу
     выбирается и кадр. */
  env.requests[0].ok({ id: 11, images: { logos: [{ file_path: '/l.png', aspect_ratio: 4, iso_639_1: 'ru' }] } });
  const frame = env.images.find((i) => i.src.slice(-7) === '/b1.jpg');
  assert.equal(frame.src, 'https://img/t/p/original/b1.jpg',
    '1920 CSS × DPR 2 = 3840 физических — кадр в original');
  frame.onload();
  const preload = env.images.find((i) => i.src.slice(-6) === '/l.png');
  assert.equal(preload.src, 'https://img/t/p/w780/l.png');
  preload.onload();
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("https://img/t/p/w780/l.png")');

  const noFrame = makeEnv();
  globalThis.window.devicePixelRatio = 2;
  const main2 = makeMain();
  main2.card1.card_data = { id: 44, title: 'Без кадра', poster_path: '/p.jpg', release_date: '2021-01-01' };
  main2.card1.addClass('focus');
  noFrame.hero.mount(main2.activity);
  fireFocus(main2.activity, main2.card1);
  noFrame.advance(400);
  answerDetails(noFrame);
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
  const node = heroOf(main.activity);

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
  const node = heroOf(main.activity);

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
  const node = heroOf(main.activity);

  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  env.requests[0].ok(null);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--pending'), false);
});

/* ====================================================================== */
/* Task 29/37: горячий путь фокуса и отложенный акцент                    */
/* ====================================================================== */

/* Ревью волны 2, п.11: запись карточки под фокусом (LC.hero.lastFocus)
   держала источник перехода «постер → кадр»; переход удалён в волне 2, и
   запись осталась без потребителя — снята вместе с API. Ловушка в makeCard
   (getBoundingClientRect) остаётся: горячий путь фокуса раскладку не
   читает — Task 37, замер ушёл из обработки каждого нажатия стрелки. */
test('фокус: горячий путь раскладку не читает; мёртвой записи карточки под фокусом нет', () => {
  const env = makeEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(50);
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(1000);
  assert.deepEqual(warnLog, [], 'обращение к getBoundingClientRect из героя роняет обработчик фокуса в warn');
  assert.equal(env.hero.lastFocus, undefined, 'LC.hero.lastFocus без потребителя');
  assert.equal(H.lastFocus, undefined);
});

/* Task 37 (ревью): фокус Lampa восстанавливает синхронно внутри
   activity.start() — ДО события 'activity':start, по которому мы монтируем
   героя (разбор у showFocused). Героя mount показывает сам, но гард
   повторной обработки (state.focusEl) не взводит: первое настоящее событие
   фокуса на той же карточке обязано пройти полный путь и завести таймеры —
   здесь это видно по отсчёту автотрейлера. */
test('фокус: карточка была в фокусе до монтирования — первое событие на ней проходит полный путь', () => {
  const env = trailerEnv();
  const main = makeMain();
  main.card1.addClass('focus');
  env.hero.mount(main.activity);
  env.advance(9000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 0,
    'mount показывает героя, но отсчёта ролика без события фокуса не заводит');

  fireFocus(main.activity, main.card1);
  env.advance(9000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 1,
    'событие съел гард «фокус не сменился» — mount взвёл его сам');
  assert.deepEqual(warnLog, []);
});

/* ---------------------------------------------------------------------- */
/* Волна 2 (ТВ 2026-09-24, D3): крупная версия постера w500 грузилась ради   */
/* перехода «постер → кадр». Переход удалён — лишней картинки на покое       */
/* фокуса больше нет, даже при настройках по умолчанию.                      */
/* ---------------------------------------------------------------------- */

test('D3: покой фокуса не грузит крупный постер w500 — перехода, которому он был нужен, нет', () => {
  const env = makeEnv({ pref: (name, def) => def });
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(1000);
  const big = env.images.filter((i) => i.src.indexOf('/t/p/w500/') !== -1);
  assert.deepEqual(big.map((i) => i.src), [], 'крупный постер запрошен');
  assert.equal(H.bigPoster, undefined, 'чистая функция адреса w500 осталась без потребителя');
  assert.deepEqual(warnLog, []);
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
  const node = heroOf(main.activity);

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
  /* Волна 3: слой ролика — в неподвижном слое кадра, а не в сжимающемся
     узле героя. */
  assert.equal(env.players[0].host._parentEl, stageOf(node), 'ролик обязан лежать в слое кадра');
  assert.equal(node.hasClass('lumen-hero--trailer'), false, 'до фактического старта класса нет');

  env.players[0].onStart();
  assert.equal(node.hasClass('lumen-hero--trailer'), true);
  assert.equal(stageOf(node).hasClass('lumen-hero-stage--trailer'), true, 'кадр под роликом не приглушён');

  env.players[0].onEnd();
  assert.equal(node.hasClass('lumen-hero--trailer'), false, 'ролик кончился — герой вернулся к кадру');
  assert.equal(stageOf(node).hasClass('lumen-hero-stage--trailer'), false, 'кадр остался приглушённым после ролика');
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

/* Правка 2026-09-23: уход в карточку снимает играющий ролик героя, возврат
   заводит отсчёт автотрейлера заново — как новая остановка фокуса. */
test('трейлер героя: уход в карточку гасит ролик, возврат заводит отсчёт заново', () => {
  const env = trailerEnv();
  const main = makeMain();
  const card = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();

  env.hero.detach(card.activity);
  assert.equal(env.players[0].destroys, 1, 'ролик не играет под карточкой');
  const videos = env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length;
  env.advance(20000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, videos, 'и не заводится снова, пока карточка открыта');

  env.hero.mount(main.activity);
  env.advance(9000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, videos + 1, 'на главной — отсчёт заново');
});

/* Task 37: возврат фокуса на ту же карточку (Lampa шлёт событие повторно,
   когда восстанавливает фокус) идущий ролик обрывать не должен. */
test('трейлер героя: повторное событие на той же карточке ролик не гасит', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);

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
  /* Волна 2 (D3): предзагрузки крупного постера для перехода больше нет —
     повторять на новом узле нечего. */
  assert.equal(env.images.filter((i) => i.src.indexOf('/t/p/w500/') !== -1).length, 0);
});

test('трейлер героя: перевод фокуса снимает играющий ролик и его запрос', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);

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

/* Проверка на ТВ 2026-09-24: трейлер — контент, а не украшение. На
   телевизоре (lite, тумблер тяжёлых эффектов выключен по умолчанию) он не
   запускался вовсе. Теперь его нет только в «Выкл». */
test('трейлер героя: в off не стартует вовсе', () => {
  const env = trailerEnv({ motionMode: () => 'off' });
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  assert.deepEqual(env.requests.filter((r) => r.url.indexOf('/videos') >= 0), [], 'off: запросов роликов нет');
  assert.equal(env.players.length, 0);
});

test('трейлер героя: в lite стартует, как и в full', () => {
  const env = trailerEnv({ motionMode: () => 'lite', fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  const req = lastVideos(env);
  assert.ok(req, 'lite: ролики спрашиваются');
  req.ok(VIDEOS_RU);
  assert.equal(env.players.length, 1, 'lite: плеер создан');
});

test('трейлер героя: без тяжёлых эффектов стартует — тумблер отвечает только за украшения', () => {
  const env = trailerEnv({ fxHeavy: () => false });
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  const req = lastVideos(env);
  assert.ok(req, 'ролики спрашиваются');
  req.ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
});

test('трейлер героя: состояние для HUD — «plan» на остановке фокуса, «none», если роликов нет ни на одном языке', () => {
  const env = trailerEnv();
  const notes = [];
  env.LC.trailer.note = (st) => notes.push(st);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  assert.deepEqual(notes, ['plan']);
  env.advance(9000);
  lastVideos(env).ok({ results: [] });
  assert.deepEqual(notes, ['plan'], 'после пустого ответа на языке интерфейса ещё спрашиваем английский');
  lastVideos(env).ok({ results: [] });
  assert.deepEqual(notes, ['plan', 'none']);
});

/* Ревью «Волны 1», п.3: HUD tr залипал на «plan» — план, снятый до
   создания плеера, не закрывал никто. Закрывается своим номером (второй
   аргумент note, src/55_trailer.js): устаревший номер модуль трейлера
   пропускает сам. */
function noteLog(env) {
  const notes = [];
  let seq = 0;
  env.LC.trailer.note = (st, ticket) => { notes.push(ticket === undefined ? st : st + '#' + ticket); return st === 'plan' ? ++seq : 0; };
  return notes;
}

test('трейлер героя: HUD — запрос роликов упал на последнем языке -> «err req»', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).err();
  assert.deepEqual(notes, ['plan'], 'на языке интерфейса упал — ещё спрашиваем английский');
  lastVideos(env).err();
  assert.deepEqual(notes, ['plan', 'err req#1']);
});

test('трейлер героя: HUD — фокус ушёл до создания плеера -> «stop» своего плана; после плеера план не пишем', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(2000);
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  assert.deepEqual(notes, ['plan', 'stop#1', 'plan'], 'снят таймер — план закрыт');

  env.advance(9000);
  main.card2.removeClass('focus');
  focusOn(main, main.card1);
  assert.deepEqual(notes.slice(3), ['stop#2', 'plan'], 'снят ожидающий ответа запрос — тоже');

  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
  env.hero.unmount();
  assert.deepEqual(notes.slice(5), [], 'плеер создан — его статус пишет сам плеер, план не трогаем');
});

test('трейлер героя: HUD — к старту открыт плеер Lampa -> «stop» своего плана', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const player = lampaPlayer(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  player.open = true;
  env.advance(9000);
  assert.deepEqual(notes, ['plan', 'stop#1']);
});

/* Ревью волны 1b, п.5: редкие пути, где план закрывал никто, — HUD
   оставался на «plan» (или на «api» плеера, упавшего при создании). */
test('трейлер героя: HUD — герой выпал из документа к старту или к ответу роликов -> «stop» своего плана', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  globalThis.document.body.contains = () => false;
  env.advance(9000);
  assert.deepEqual(notes, ['plan', 'stop#1'], 'таймер 8 с: узла героя в документе нет');

  globalThis.document.body.contains = () => true;
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(9000);
  globalThis.document.body.contains = () => false;
  lastVideos(env).ok(VIDEOS_RU);
  assert.deepEqual(notes.slice(2), ['plan', 'stop#2'], 'ответ роликов: узла героя в документе нет');
  assert.equal(env.players.length, 0);
  globalThis.document.body.contains = () => true;
});

test('трейлер героя: HUD — нет API роликов или запрос бросил -> план закрыт («stop» / «err req»)', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  const tmdb = env.Lampa.Api.sources.tmdb;
  env.advance(1000);
  delete env.Lampa.Api.sources.tmdb;
  env.advance(8000);
  assert.deepEqual(notes, ['plan', 'stop#1'], 'API роликов нет');

  env.Lampa.Api.sources.tmdb = {
    get(url) {
      if (url.indexOf('/videos') >= 0) throw new Error('boom');
      return tmdb.get.apply(tmdb, arguments);
    }
  };
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  const warned = warnLog.length;
  env.advance(9000);
  assert.deepEqual(notes.slice(2), ['plan', 'err req#2'], 'запрос бросил');
  assert.deepEqual(warnLog.slice(warned).map((w) => w.msg), ['hero: trailer request failed']);
  warnLog.length = warned;
  env.Lampa.Api.sources.tmdb = tmdb;
});

test('трейлер героя: HUD — нет плеера, нет слоя ролика или плеер бросил при создании -> «stop»', () => {
  const env = trailerEnv();
  const notes = noteLog(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  const player = env.LC.trailer.player;

  focusOn(main, main.card1);
  env.advance(9000);
  env.LC.trailer.player = undefined;
  lastVideos(env).ok(VIDEOS_RU);
  assert.deepEqual(notes, ['plan', 'stop#1'], 'LC.trailer.player нет');

  env.LC.trailer.player = player;
  const stage = stageOf(heroOf(main.activity));
  const slot = stage.find('.lumen-hero__trailer');
  slot.remove();
  main.card1.removeClass('focus');
  focusOn(main, main.card2);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  assert.deepEqual(notes.slice(2), ['plan', 'stop#2'], 'слоя ролика нет');
  stage.append(slot);

  /* Плеер бросил уже после того, как план ему отдан: номер плана к этому
     мигу устарел (плеер заводит свой, src/55_trailer.js), поэтому «stop»
     пишется без номера — владельцем мог стать только этот плеер. */
  env.LC.trailer.player = () => { throw new Error('boom'); };
  main.card2.removeClass('focus');
  focusOn(main, main.card1);
  env.advance(9000);
  const warned = warnLog.length;
  lastVideos(env).ok(VIDEOS_RU);
  assert.deepEqual(notes.slice(4), ['plan', 'stop'], 'плеер бросил при создании');
  assert.deepEqual(warnLog.slice(warned).map((w) => w.msg), ['hero: trailer start failed']);
  warnLog.length = warned;
});

test('trailerAllowed: запрещают только настройка, «Выкл» и выключенный фоновый трейлер', () => {
  const h = H;
  assert.equal(h.trailerAllowed(true, 'full', 'on'), true);
  assert.equal(h.trailerAllowed(true, 'lite', 'on'), true, 'lite — можно');
  assert.equal(h.trailerAllowed(false, 'full', 'on'), false, 'настройка выключена');
  assert.equal(h.trailerAllowed(true, 'off', 'on'), false, 'режим «Выкл»');
  assert.equal(h.trailerAllowed(true, 'full', 'off'), false, 'фоновый трейлер выключен (или auto на Tizen/webOS)');
  assert.equal(h.trailerAllowed(true, 'lite', 'on', false), true, 'четвёртого параметра (тумблера) больше нет');
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
  const node = heroOf(main.activity);

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

/* Проверка на ТВ 2026-09-24: lite ролик больше не снимает — снимает «Выкл». */
test('трейлер героя: режим анимаций на лету — lite ролик оставляет, «Выкл» снимает', () => {
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
  assert.equal(env.players[0].destroys, 0, 'lite: ролик играет дальше');

  motion = 'off';
  env.hero.applyMotion();
  assert.equal(env.players[0].destroys, 1, 'off: ролик снят');
});

/* Ревью «Волны 1», п.1: плеер Lampa — не активность (app.min.js:30624-30632),
   главная под ним остаётся activity--active. Долгое OK → «Трейлер» на
   главной: через 8 с покоя YouTube героя стартовал под плеером Lampa —
   два ролика на 2 ГБ ТВ. Заглушка — как Lampa: Player.opened() и
   listener с follow/remove (Subscribe, :31205). */
function lampaPlayer(env) {
  const subs = {};
  const p = {
    open: false,
    subs: subs,
    opened: () => p.open,
    listener: {
      follow(name, fn) { (subs[name] = subs[name] || []).push(fn); },
      remove(name, fn) { const l = subs[name] || []; const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); },
      send(name, data) { (subs[name] || []).slice().forEach((fn) => fn(data)); }
    }
  };
  env.Lampa.Player = p;
  return p;
}

test('трейлер героя: под открытым плеером Lampa ролики не спрашиваются и плеер героя не создаётся', () => {
  const env = trailerEnv();
  const player = lampaPlayer(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  player.open = true;
  env.advance(9000);
  assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 0, 'к 8-й секунде плеер открыт — не спрашиваем');
  assert.equal(env.players.length, 0);
});

test('трейлер героя: ответ роликов доехал, когда открыт плеер Lampa или настройки/список/поиск — плеер героя не создаётся', () => {
  const env = trailerEnv();
  const player = lampaPlayer(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  player.open = true;
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 0, 'плеер Lampa');

  player.open = false;
  /* Ревью волны 1b, п.2: поиск из шапки открывается поверх главной
     (search--open, app.min.js:41514) — ролик под ним никто не увидит. */
  for (const cls of ['settings--open', 'selectbox--open', 'search--open']) {
    env.bodyClasses.push(cls);
    main.card1.removeClass('focus');
    focusOn(main, main.card2);
    main.card2.removeClass('focus');
    focusOn(main, main.card1);
    env.advance(9000);
    assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 1, cls + ': запрос роликов не уходит');
    assert.equal(env.players.length, 0, cls);
    env.bodyClasses.splice(env.bodyClasses.indexOf(cls), 1);
  }
});

test('трейлер героя: событие start плеера Lampa снимает играющий ролик; после снятия героя подписки нет', () => {
  const env = trailerEnv();
  const player = lampaPlayer(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();
  assert.equal(node.hasClass('lumen-hero--trailer'), true);

  player.listener.send('start', { url: 'https://www.youtube.com/watch?v=x' });
  assert.equal(env.players[0].destroys, 1, 'ролик героя снят стартом плеера Lampa');
  assert.equal(node.hasClass('lumen-hero--trailer'), false);

  env.hero.unmount();
  assert.equal((player.subs.start || []).length, 0, 'unmount снимает подписку');
});

/* Ревью волны 1b, п.6: подписка на Player.listener живёт, пока смонтирован
   герой, и она ОДНА — сколько бы раз главную ни парковали, ни будили, ни
   монтировали повторно в тот же корень и ни пересобирали в новый. Вторая
   подписка — второй cancelTrailer на каждый старт плеера и утечка
   замыкания на весь сеанс. */
test('трейлер героя: подписка на старт плеера Lampa одна — mount/park/resume, повторный mount и смена корня', () => {
  const env = trailerEnv();
  const player = lampaPlayer(env);
  const main = makeMain();
  const other = makeMain();
  const card = makeMain();
  const subs = () => (player.subs.start || []).length;

  env.hero.mount(main.activity);
  assert.equal(subs(), 1);
  for (let i = 0; i < 3; i++) {
    env.hero.detach(card.activity);
    assert.equal(env.hero.parked(), true);
    assert.equal(subs(), 1, 'парковка подписку не снимает и не множит (круг ' + i + ')');
    env.hero.mount(main.activity);
    assert.equal(env.hero.parked(), false);
    assert.equal(subs(), 1, 'возврат (resume) второй подписки не вешает (круг ' + i + ')');
    env.hero.mount(main.activity);
    assert.equal(subs(), 1, 'повторный mount того же корня (круг ' + i + ')');
  }

  /* Новая главная — другой корень: старый герой снимается, новый
     подписывается заново; и так же с запаркованного. */
  env.hero.mount(other.activity);
  assert.equal(subs(), 1, 'смена корня');
  const hook = player.subs.start[0];
  env.hero.detach(card.activity);
  env.hero.mount(main.activity);
  assert.equal(subs(), 1, 'смена корня из парковки');
  assert.notEqual(player.subs.start[0], hook, 'подписка прежнего героя снята, а не оставлена вместо новой');

  /* Старт плеера доходит ровно до одного обработчика и снимает ролик. */
  focusOn(main, main.card1);
  env.advance(9000);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();
  player.listener.send('start', {});
  assert.equal(env.players[0].destroys, 1);

  env.hero.unmount();
  assert.equal(subs(), 0, 'unmount');
  env.hero.unmount();
  assert.equal(subs(), 0, 'повторный unmount');
  env.hero.mount(other.activity);
  assert.equal(subs(), 1, 'mount после unmount');
  env.hero.unmount();
  assert.equal(subs(), 0);
  assert.deepEqual(warnLog, []);
});

/* Ревью волны 1b, п.1: старт ролика, отменённый тем, что открыто поверх
   главной, на этой карточке не возвращался. Меню карточки по долгому OK —
   Lampa.Select (selectbox--open); закрываясь, Lampa возвращает фокус на ту
   же карточку тем же событием на том же узле (Controller.toggle ->
   toggle контроллера экрана -> collectionFocus, app.min.js:46297-46315 и
   :46474-46490), а его гард «фокус не сменился» в onFocus съедал: отсчёт
   больше не заводился. */
const videoCount = (env) => env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length;

test('трейлер героя: список выбора открыт к 8-й секунде — закрыли, фокус вернулся, через 8 с ролики спрашиваются', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(7900);
  env.bodyClasses.push('selectbox--open');
  env.advance(200);
  assert.equal(videoCount(env), 0, 'под открытым списком старт отменён');

  env.bodyClasses.splice(env.bodyClasses.indexOf('selectbox--open'), 1);
  fireFocus(main.activity, main.card1);
  env.advance(7900);
  assert.equal(videoCount(env), 0, 'отсчёт заново — полные 8 с от возврата фокуса');
  env.advance(200);
  assert.equal(videoCount(env), 1, 'возврат фокуса на ту же карточку не завёл отсчёт');
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
  assert.deepEqual(warnLog, []);
});

test('трейлер героя: ответ роликов доехал под открытым поиском — закрыли, фокус вернулся, отсчёт заново', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(8100);
  env.bodyClasses.push('search--open');
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 0, 'под поиском плеер героя не создаётся');

  env.bodyClasses.splice(env.bodyClasses.indexOf('search--open'), 1);
  fireFocus(main.activity, main.card1);
  env.advance(8100);
  assert.equal(videoCount(env), 2, 'возврат фокуса на ту же карточку не завёл отсчёт');
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
});

test('трейлер героя: старт плеера Lampa снял ролик — плеер закрыт, фокус вернулся, отсчёт заново', () => {
  const env = trailerEnv();
  const player = lampaPlayer(env);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(8100);
  lastVideos(env).ok(VIDEOS_RU);
  env.players[0].onStart();

  player.open = true;
  player.listener.send('start', {});
  assert.equal(env.players[0].destroys, 1);
  player.open = false;
  fireFocus(main.activity, main.card1);
  env.advance(8100);
  assert.equal(videoCount(env), 2, 'после плеера Lampa отсчёт на той же карточке не заводился');

  /* Ответ роликов доехал под открытым плеером — то же самое. */
  player.open = true;
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 1, 'под плеером Lampa плеер героя не создаётся');
  player.open = false;
  fireFocus(main.activity, main.card1);
  env.advance(8100);
  assert.equal(videoCount(env), 3);
  assert.deepEqual(warnLog, []);
});

/* Ревью раунда хвостов, п.2: «Расширения» (Lampa.Extensions.show,
   app.min.js:36488-36510) ставят body.ambience--enable, а под ним Lampa
   прячет .wrap целиком (app.css:397-398) — главной не видно. Набор
   LC.util.overlayOpen() этого класса не знает (и знать не должен:
   ambience--enable ставит и сам поиск, а трейлер меню карточки сверяет
   набор с тем, что было при запросе), — и на 8-й секунде уходил запрос
   роликов, создавался плеер (HUD «play»), YouTube декодировал ролик
   впустую. То же SearchInput: он тоже ставит ambience--enable, а его узел
   .search-box лежит в body, только пока тот открыт (app.min.js:
   40001-40054). */
test('трейлер героя: под «Расширениями» и SearchInput ролик не стартует — ни запроса к 8-й секунде, ни плеера к ответу', () => {
  const env = trailerEnv();
  const nodes = [];
  globalThis.document.querySelector = (sel) => (nodes.indexOf(sel) !== -1 ? {} : null);
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.bodyClasses.push('ambience--enable');
  env.advance(9000);
  assert.equal(videoCount(env), 0, '«Расширения»: запрос роликов ушёл');
  assert.equal(env.players.length, 0);
  env.bodyClasses.splice(env.bodyClasses.indexOf('ambience--enable'), 1);

  /* Закрыли — фокус вернулся на ту же карточку, отсчёт заново; к его
     концу открыт SearchInput (узел без класса — на случай, если класс
     уже снят кем-то другим). */
  fireFocus(main.activity, main.card1);
  nodes.push('.search-box');
  env.advance(9000);
  assert.equal(videoCount(env), 0, 'SearchInput: запрос роликов ушёл');
  nodes.length = 0;

  /* Ответ роликов доехал под «Расширениями» — плеер героя не создаётся,
     а после закрытия отсчёт на той же карточке заводится заново. */
  fireFocus(main.activity, main.card1);
  env.advance(8100);
  assert.equal(videoCount(env), 1);
  env.bodyClasses.push('ambience--enable');
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 0, 'под «Расширениями» плеер героя создан');
  env.bodyClasses.splice(env.bodyClasses.indexOf('ambience--enable'), 1);
  fireFocus(main.activity, main.card1);
  env.advance(8100);
  assert.equal(videoCount(env), 2, 'после «Расширений» отсчёт на той же карточке не заводился');
  lastVideos(env).ok(VIDEOS_RU);
  assert.equal(env.players.length, 1);
  assert.deepEqual(warnLog, []);
});

/* Сторож: без оверлея повторное событие на той же карточке по-прежнему
   ничего не перезапускает — ни идущий ролик, ни отсчёт. */
test('трейлер героя: без оверлея повторный фокус той же карточки отсчёт не перезапускает', () => {
  const env = trailerEnv();
  const main = makeMain();
  env.hero.mount(main.activity);
  focusOn(main, main.card1);
  env.advance(5000);
  fireFocus(main.activity, main.card1);
  env.advance(3100);
  assert.equal(videoCount(env), 1, 'отсчёт идёт от первого фокуса, а не от повторного события');
});

/* ====================================================================== */
/* Task 71: логотип названия — без подмены на ходу                        */
/*                                                                        */
/* Отзыв пользователя 2026-09-21, п.2: «названия подгружают на ходу       */
/* „постеры“ названия», и уточнение — «в самой первой версии всё работало  */
/* идеально». Механика показа логотипа не менялась ни разу (сверка по      */
/* истории cfe0047 → HEAD): изменился РЕЖИМ движения. В full первый       */
/* write() откладывается на SWAP_MS под анимацию ухода текста, и детали из */
/* кэша Lampa успевают приехать — видимый вывод один, сразу с логотипом.   */
/* В lite write() был мгновенным: сперва текст, потом второй write() с     */
/* логотипом. Это и есть «на ходу».                                        */
/* ====================================================================== */

/* Карточка под фокусом в заданном режиме движения: показ запущен, кадр
   запрошен, текст (теперь во всех режимах отложенный на SWAP_MS) ещё не
   записан. */
function heroIn(mode) {
  const env = makeEnv();
  env.LC.motionMode = () => mode;
  const main = makeMain();
  env.hero.mount(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  return { env: env, main: main, node: heroOf(main.activity) };
}

const LOGO_RU = { images: { logos: [{ file_path: '/l.png', iso_639_1: 'ru' }] } };
const LOGO_URL = 'https://img/t/p/w780/l.png';
/* Предзагрузчики логотипа среди всех созданных Image: по адресу, а не по
   порядку — кадр героя запрашивается и до логотипа (в момент показа
   карточки), и после него (второй заход loadFrame, когда backdrop пришёл в
   деталях), так что «последний Image» логотипом не является. */
const logoLoads = (env) => env.images.filter((i) => i.src === LOGO_URL);
const logoLoader = (env) => logoLoads(env)[logoLoads(env).length - 1];

test('Task 71: в «Лёгких» детали из кэша успевают к первому выводу — текста без логотипа не видно', () => {
  const { env, node } = heroIn('lite');
  /* До Task 71 write() в lite отрабатывал мгновенно, и здесь уже стоял бы
     заголовок без логотипа — тот самый «постер названия на ходу». */
  assert.equal(node.find('.lumen-hero__title').text(), '', 'вывод текста обязан быть отложен на SWAP_MS');
  /* Ответ деталей из кэша Lampa приходит синхронно, до конца отсрочки, и
     выводит уже полную модель — это и есть единственный видимый вывод. */
  env.requests[0].ok(Object.assign({ runtime: 100, genres: [{ name: 'драма' }], overview: 'полное' }, LOGO_RU));
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2');
  /* Отложенный вывод снят самой записью: второго прохода по узлам нет, и
     модель без деталей на экран уже не попадёт. */
  env.advance(200);
  assert.equal(node.find('.lumen-hero__meta').text(), '2024 · 1:40 · драма · ★ 7.2', 'отложенный вывод вернул модель без деталей');
  assert.equal(node.find('.lumen-hero__descr').text(), 'полное');
  assert.equal(logoLoader(env).src, LOGO_URL, 'логотип не запрошен');
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'логотип пришёл — текстовый заголовок прячет CSS');
  assert.deepEqual(warnLog, []);
});

/* Правка 2026-09-22: до неё этот тест и описывал сам дефект — «сперва
   текст, логотип после загрузки». Теперь вывод один: пока детали и картинка
   логотипа в пути, место названия пустое, и текстом оно не мелькает. */
test('Task 71 (правка 2026-09-22): детали приехали позже отсрочки — название ждёт логотип', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  assert.equal(node.find('.lumen-hero__title').text(), '', 'деталей нет — исход логотипа неизвестен, текст не выводим');
  assert.equal(node.hasClass('lumen-hero--logo'), false);

  env.requests[0].ok(LOGO_RU);
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'класс обязан ждать саму картинку логотипа');
  assert.equal(node.find('.lumen-hero__title').text(), '', 'картинка ещё едет — текста быть не должно');
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);
  assert.equal(node.find('.lumen-hero__title').text(), '', 'единственный вывод названия — логотипом');
  assert.equal(node.find('.lumen-hero__logo').css('background-image'), 'url("' + LOGO_URL + '")');
});

/* Ревью 2026-09-22 (М5): неудача запоминается в два шага. Первый провал —
   в том числе по страховочному таймауту, а его даёт и живое, но медленное
   соединение — больше не хоронит логотип фильма до перезахода: за ним
   сходят ещё раз. Второй провал окончателен, бесконечных попыток на
   каждый фокус как не было, так и нет. */
test('Task 71: логотип не загрузился — остаётся текст, повтор ровно один', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  logoLoader(env).onerror();
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'битый логотип не имеет права прятать заголовок');
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');

  /* Та же картинка у следующей карточки: одна повторная попытка. */
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(200);
  env.requests[1].ok(LOGO_RU);
  assert.equal(logoLoads(env).length, 2, 'повторной попытки за логотипом не было');
  logoLoader(env).onerror();
  assert.equal(node.hasClass('lumen-hero--logo'), false);

  /* А третьей попытки нет: после второго провала картинка помечена
     окончательно. */
  main.card2.removeClass('focus');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  env.advance(200);
  env.requests[2].ok(LOGO_RU);
  assert.equal(logoLoads(env).length, 2, 'за логотипом ушёл третий запрос — кэш неудач не работает');
  assert.equal(node.hasClass('lumen-hero--logo'), false);
  assert.deepEqual(warnLog, []);
});

/* Повтор — ровно повтор, а не «пока не выйдет»: удачная вторая попытка
   ставит логотип и снимает пометку, третьего запроса за той же картинкой
   уже не будет. */
test('Task 71 (ревью М5): вторая попытка удалась — логотип встал, дальше он известен', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  logoLoader(env).onerror();
  assert.equal(node.hasClass('lumen-hero--logo'), false);

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(200);
  env.requests[1].ok(LOGO_RU);
  assert.equal(logoLoads(env).length, 2, 'повторной попытки за логотипом не было');
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'удачный повтор обязан поставить логотип');

  main.card2.removeClass('focus');
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  env.requests[2].ok(LOGO_RU);
  env.advance(200);
  assert.equal(logoLoads(env).length, 2, 'лишняя предзагрузка: логотип уже известен');
  assert.equal(node.hasClass('lumen-hero--logo'), true);
  assert.deepEqual(warnLog, []);
});

test('Task 71: уже загруженный логотип ставится сразу, без второй предзагрузки', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.requests[1].ok(LOGO_RU);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'известный логотип обязан встать сразу');
  assert.equal(logoLoads(env).length, 1, 'лишняя предзагрузка: логотип уже известен');
});

test('Task 71: карточка сменилась до прихода логотипа — старый load ничего не рисует', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  const stale = logoLoader(env);
  /* Колбэк, который движок уже держит в очереди: снять обработчик с самого
     загрузчика мало, поэтому проверяем обе страховки сразу. */
  const staleOnload = stale.onload;

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.advance(200);
  /* Правка 2026-09-22: название второй карточки тоже ждёт своего логотипа,
     поэтому «уже другая карточка» проверяется по мете и описанию. */
  assert.equal(node.find('.lumen-hero__descr').text(), 'о втором', 'подготовка: на экране уже другая карточка');
  assert.equal(node.find('.lumen-hero__title').text(), '');
  assert.equal(stale.onload, null, 'предзагрузка ушедшей карточки обязана быть отвязана');

  staleOnload();
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'логотип ушедшей карточки встал поверх новой');
});

test('Task 71: таймаут загрузки без байтов логотип не показывает', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  env.advance(8000);
  assert.equal(node.hasClass('lumen-hero--logo'), false, 'логотип, который не доехал, прятать заголовок не имеет права');
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');
});

test('Task 71: настройка выключена — логотип не запрашивается вовсе', () => {
  const env = makeEnv({ pref: (name, def) => (name === 'lumen_hero_logo' ? false : def) });
  env.LC.motionMode = () => 'lite';
  const main = makeMain();
  env.hero.mount(main.activity);
  const node = heroOf(main.activity);
  main.card1.addClass('focus');
  fireFocus(main.activity, main.card1);
  env.advance(350);
  env.advance(200);
  /* Правка 2026-09-22: при выключенной настройке ждать нечего — название
     выводится текстом сразу, ещё до ответа деталей. */
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'выключенный логотип не имеет права задерживать название');
  env.requests[0].ok(LOGO_RU);
  assert.equal(logoLoads(env).length, 0, 'за выключенным логотипом ушёл запрос');
  assert.equal(node.hasClass('lumen-hero--logo'), false);
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'без логотипа обязан остаться текстовый заголовок');
});

test('Task 71: у предзагрузчика логотипа приоритет ниже кадра', () => {
  const { env } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  /* Волна 3: кадр выбирается по тому же ответу деталей, что принёс логотип. */
  assert.equal(frameImg(env, '/b1.jpg').fetchPriority, 'high', 'кадр героя грузится первым по приоритету');
  assert.equal(logoLoader(env).fetchPriority, undefined, 'логотипу высокий приоритет не положен');
  assert.equal(logoLoader(env).decoding, 'async');
});

test('Task 71: в полном режиме отсрочка та же, и текст по-прежнему уходит анимацией', () => {
  const { env, node } = heroIn('full');
  assert.equal(node.find('.lumen-hero__text').hasClass('is-swapping'), true, 'в full текст обязан уходить анимацией');
  assert.equal(node.find('.lumen-hero__title').text(), '');
  env.requests[0].ok(LOGO_RU);
  env.advance(200);
  /* Правка 2026-09-22: логотип известен из деталей, но ещё едет — название
     пустует, а кадр появления текстового блока идёт как прежде. */
  assert.equal(node.find('.lumen-hero__title').text(), '');
  assert.equal(node.find('.lumen-hero__text').hasClass('is-in'), true);
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);
  assert.equal(node.find('.lumen-hero__title').text(), '');
});

/* ====================================================================== */
/* Правка 2026-09-22: вывод названия один — текстом ИЛИ логотипом          */
/*                                                                        */
/* Отзыв пользователя: «все равно переключение названий есть, выглядит не  */
/* оч». Замер на живой Lampa до правки — текст был виден 45-110 мс в       */
/* полном режиме движения и 45-374 мс в лёгком, ровно столько, сколько     */
/* ехала картинка логотипа. Ожидание ограничено потолком TITLE_WAIT.       */
/* ====================================================================== */

test('Название: логотипа у фильма нет — текст выводится сразу, ожидания не остаётся', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  assert.equal(node.find('.lumen-hero__title').text(), '', 'деталей нет — исход логотипа неизвестен');

  /* Детали без images.logos: ждать больше нечего. */
  env.requests[0].ok({ runtime: 100, overview: 'полное' });
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый');
  assert.deepEqual(env.timers.filter((t) => !t.done && t.ms === 600).map((t) => t.ms), [], 'потолок ожидания обязан быть снят');
  assert.deepEqual(warnLog, []);
});

test('Название: логотип доехал раньше потолка — текста на экране не было ни разу', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  assert.equal(node.find('.lumen-hero__title').text(), '');

  /* 500 мс — меньше потолка 600: логотип успел. */
  env.advance(500);
  assert.equal(node.find('.lumen-hero__title').text(), '', 'потолок сработал раньше времени');
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);

  /* И потолок, снятый удачей логотипа, текст уже не выведет. */
  env.advance(600);
  assert.equal(node.find('.lumen-hero__title').text(), '', 'потолок после удачи логотипа дописал текст под логотип');
  assert.deepEqual(warnLog, []);
});

test('Название: логотип не доехал за потолок — выводится текст', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  assert.equal(node.find('.lumen-hero__title').text(), '');

  env.advance(600);
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'дольше потолка название пустым не держим');
  assert.equal(node.hasClass('lumen-hero--logo'), false);

  /* Опоздавший логотип всё-таки встаёт — текст под ним прячет CSS. */
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);
  assert.deepEqual(warnLog, []);
});

test('Название: логотип не загрузился — текст выводится сразу, не дожидаясь потолка', () => {
  const { env, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  logoLoader(env).onerror();
  assert.equal(node.find('.lumen-hero__title').text(), 'Первый', 'исход известен — ждать потолка незачем');
  assert.equal(node.hasClass('lumen-hero--logo'), false);
  assert.deepEqual(warnLog, []);
});

test('Название: фокус ушёл во время ожидания — потолок прошлой карточки ничего не выводит', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  assert.equal(node.find('.lumen-hero__title').text(), '');

  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  /* 400 мс: потолок ПЕРВОЙ карточки (заведён на 200-й мс) свой срок прошёл,
     потолок второй (заведён на 550-й) — ещё нет. */
  env.advance(400);
  assert.equal(node.find('.lumen-hero__descr').text(), 'о втором', 'подготовка: на экране вторая карточка');
  assert.equal(node.find('.lumen-hero__title').text(), '', 'название ушедшей карточки вывелось поверх новой');
  assert.deepEqual(warnLog, []);
});

test('Название: знакомый фильм показывается мгновенно — ожидания нет', () => {
  const { env, main, node } = heroIn('lite');
  env.advance(200);
  env.requests[0].ok(LOGO_RU);
  logoLoader(env).onload();
  assert.equal(node.hasClass('lumen-hero--logo'), true);

  /* Вторая карточка с тем же логотипом: исход уже известен (logoSeen). */
  main.card1.removeClass('focus');
  main.card2.addClass('focus');
  fireFocus(main.activity, main.card2);
  env.advance(350);
  env.requests[1].ok(LOGO_RU);
  env.advance(200);
  assert.equal(node.hasClass('lumen-hero--logo'), true, 'известный логотип обязан встать сразу');
  assert.deepEqual(env.timers.filter((t) => !t.done && t.ms === 600).map((t) => t.ms), [], 'знакомому логотипу ожидание не нужно');
  assert.deepEqual(warnLog, []);
});

/* ====================================================================== */
/* Правка 2026-09-23: логотип названия в карточке фильма берёт у героя    */
/* рамку (cardLogoBox) и ожидание с потолком (waitLogo).                   */
/* ====================================================================== */

test('cardLogoBox: тот же видимый размер, что у героя, в em заголовка карточки', () => {
  /* Рамка героя в em его текста (×1.1 к базовому), рамка карточки — в em
     заголовка (3.33 базовых): один и тот же логотип обязан выйти одного
     размера в пикселях на обоих экранах. */
  for (const r of [3.3, 4.59, 7.96]) {
    const hero = H.logoBox(r);
    const card = H.cardLogoBox(r);
    assert.ok(Math.abs(card.h * 3.33 - hero.h * 1.1) < 0.02, r + ': высота разошлась — ' + JSON.stringify([hero, card]));
    assert.ok(Math.abs(card.w * 3.33 - hero.w * 1.1) < 0.05, r + ': ширина разошлась');
  }
});

test('cardLogoBox: потолок — высота двухуровневого названия, пропорция при упоре сохраняется', () => {
  /* Двухуровневое название: ведущая строка 1.26 + вторая .63 × 1.17. */
  const TWO_LEVEL = 1.26 + 0.63 * 1.17;
  for (const r of [1, 1.46, 2.12, 2.7]) {
    const b = H.cardLogoBox(r);
    assert.ok(b.h <= 2 + 1e-9, r + ': логотип выше потолка — ' + b.h);
    assert.ok(Math.abs(b.w / b.h - r) < 0.02, r + ': рамка не по пропорции — ' + JSON.stringify(b));
  }
  assert.equal(H.cardLogoBox(1).h, 2);
  assert.ok(Math.abs(2 - TWO_LEVEL) < 0.01, 'потолок разошёлся с высотой двухуровневого названия');
  assert.equal(H.cardLogoBox(0), null, 'пропорции нет — размер отдаётся CSS');
  assert.equal(H.cardLogoBox(NaN), null);
});

test('waitLogo: логотип доехал раньше потолка — решение «логотип», одно', () => {
  const env = makeEnv();
  const got = [];
  env.hero.waitLogo('/w1.png', 'https://img/w1.png', (show) => got.push(show));
  assert.deepEqual(got, [], 'до загрузки решения нет');
  const img = env.images[env.images.length - 1];
  assert.equal(img.src, 'https://img/w1.png');
  env.advance(200);
  img.onload();
  env.advance(1000);
  assert.deepEqual(got, [true], 'решение одно и это логотип');
});

test('waitLogo: потолок TITLE_WAIT — текст, поздний логотип решения не меняет, но запоминается', () => {
  const env = makeEnv();
  const got = [];
  env.hero.waitLogo('/w2.png', 'https://img/w2.png', (show) => got.push(show));
  const img = env.images[env.images.length - 1];
  env.advance(env.hero.TITLE_WAIT - 1);
  assert.deepEqual(got, []);
  env.advance(1);
  assert.deepEqual(got, [false], 'потолок истёк — текст');
  img.onload();
  assert.deepEqual(got, [false], 'поздний логотип подменил текст');
  /* Исход записан: следующее открытие решается сразу, без загрузки. */
  const again = [];
  const before = env.images.length;
  env.hero.waitLogo('/w2.png', 'https://img/w2.png', (show) => again.push(show));
  assert.deepEqual(again, [true], 'известный логотип не решён синхронно');
  assert.equal(env.images.length, before, 'известный логотип загружается второй раз');
});

test('waitLogo: ошибка — текст сразу, не дожидаясь потолка; вторая ошибка — больше не просим', () => {
  const env = makeEnv();
  const got = [];
  env.hero.waitLogo('/w3.png', 'https://img/w3.png', (show) => got.push(show));
  env.images[env.images.length - 1].onerror();
  assert.deepEqual(got, [false]);
  /* Первая неудача — 'retry' (ревью 2026-09-22, М5): вторая попытка идёт. */
  const second = [];
  env.hero.waitLogo('/w3.png', 'https://img/w3.png', (show) => second.push(show));
  env.images[env.images.length - 1].onerror();
  assert.deepEqual(second, [false]);
  const before = env.images.length;
  const third = [];
  env.hero.waitLogo('/w3.png', 'https://img/w3.png', (show) => third.push(show));
  assert.deepEqual(third, [false], 'дважды неудавшийся логотип не решён синхронно');
  assert.equal(env.images.length, before, 'дважды неудавшийся логотип запрошен снова');
});

test('waitLogo: cancel снимает и потолок, и загрузку — решения не будет вовсе', () => {
  const env = makeEnv();
  const got = [];
  const h = env.hero.waitLogo('/w4.png', 'https://img/w4.png', (show) => got.push(show));
  const img = env.images[env.images.length - 1];
  h.cancel();
  env.advance(10000);
  assert.equal(img.onload, null, 'обработчик загрузки остался');
  assert.deepEqual(got, []);
});

test('waitLogo: нет адреса или пути — текст синхронно, без загрузки', () => {
  const env = makeEnv();
  const got = [];
  const before = env.images.length;
  env.hero.waitLogo('', 'https://img/x.png', (show) => got.push(show));
  env.hero.waitLogo('/x.png', '', (show) => got.push(show));
  assert.deepEqual(got, [false, false]);
  assert.equal(env.images.length, before);
});

/* Правка 2026-09-23: адрес логотипа у карточки и у героя — один. Исход
   загрузки кэшируется по ПУТИ, и «уже доехал» обязано значить «лежит в кэше
   браузера ровно по этому адресу» — иначе известный логотип ставился бы в
   рамку карточки картинкой, которой в кэше ещё нет. */
test('logoUrl: карточка получает ровно тот адрес, который грузит герой', () => {
  const f = heroIn('full');
  f.env.requests[f.env.requests.length - 1].ok(Object.assign({ id: 1 }, LOGO_RU));
  f.env.advance(200);
  assert.ok(logoLoads(f.env).length >= 1, 'герой логотип не запросил');
  assert.equal(f.env.hero.logoUrl('/l.png'), LOGO_URL);
  assert.equal(f.env.hero.logoUrl(''), '');
  /* Герой логотип загрузил — у карточки решение синхронное и без загрузки. */
  logoLoader(f.env).onload();
  const before = f.env.images.length;
  const got = [];
  f.env.hero.waitLogo('/l.png', f.env.hero.logoUrl('/l.png'), (show) => got.push(show));
  assert.deepEqual(got, [true]);
  assert.equal(f.env.images.length, before, 'логотип, виденный в герое, грузится второй раз');
});

/* ====================================================================== */
/* Правка 2026-09-23: «Что показывает кадр главной» — «Только кадры».     */
/* Механика слайдшоу общая с карточкой: LC.backdrops.pickBackdrops +       */
/* LC.slideshow.create в режиме opts.show; показ — loadFrame героя.        */
/* ====================================================================== */

const SLIDESHOW = load('51_slideshow.js');
const BACKDROPS_REAL = load('50_backdrops.js');

function slidesEnv(opts) {
  opts = opts || {};
  const media = { value: opts.media || 'frames' };
  /* Значение «Интервала смены кадров» — тест может сменить его на лету. */
  const interval = { ms: 14000 };
  const intervals = [];
  const origSet = globalThis.setInterval;
  const origClear = globalThis.clearInterval;
  globalThis.setInterval = (fn, ms) => { intervals.push({ fn: fn, ms: ms, cleared: false }); return intervals.length; };
  globalThis.clearInterval = (id) => { const t = intervals[id - 1]; if (t) t.cleared = true; };
  const env = trailerEnv({
    slideshow: SLIDESHOW,
    backdrops: { pickBackdrops: BACKDROPS_REAL.pickBackdrops, intervalMs: () => interval.ms },
    motionMode: () => opts.motion || 'lite',
    fxHeavy: () => !!opts.heavy
  }, (name, def) => (name === 'lumen_hero_media' ? media.value : def));
  /* Контроллер слайдшоу спрашивает «слой ещё в документе». */
  globalThis.document.documentElement.contains = () => true;
  env.media = media;
  env.interval = interval;
  env.intervals = intervals;
  env.live = () => intervals.filter((t) => !t.cleared);
  env.restore = () => { globalThis.setInterval = origSet; globalThis.clearInterval = origClear; };
  return env;
}

const FRAMES = (id, main) => ({
  id: id,
  backdrop_path: main,
  images: {
    logos: [],
    backdrops: [
      { file_path: main, iso_639_1: null, width: 1920 },
      { file_path: '/f2.jpg', iso_639_1: null, width: 1920 },
      { file_path: '/f3.jpg', iso_639_1: null, width: 1920 },
      { file_path: '/text.jpg', iso_639_1: 'en', width: 1920 }
    ]
  }
});

/* Предзагрузчик кадра по адресу: рядом с ним в полном режиме живёт и
   предзагрузка крупного постера (слой перехода), и порядок не гарантирован. */
function frameImg(env, path) {
  const list = env.images.filter((i) => i.src === 'https://img/t/p/w1280' + path);
  return list[list.length - 1];
}

function detailsOf(env, id) {
  const list = env.requests.filter((r) => r.url === 'movie/' + id);
  return list[list.length - 1];
}

test('«Только кадры»: кадры фильма сменяются по интервалу, мгновенно, трейлер не запускается', () => {
  const env = slidesEnv();
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    const node = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    assert.equal(stageOf(node).find('.lumen-hero__bg--a').attr('src'), 'https://img/t/p/w1280/b1.jpg');
    assert.equal(env.live().length, 1, 'смена кадров заведена по деталям, без лишнего запроса');
    assert.equal(env.live()[0].ms, 14000);

    const before = env.images.length;
    env.live()[0].fn();
    assert.equal(env.images.length, before + 1, 'предзагружается только следующий кадр');
    assert.equal(env.images[before].src, 'https://img/t/p/w1280/f2.jpg');
    env.images[before].onload();
    const a = stageOf(node).find('.lumen-hero__bg--a');
    const b = stageOf(node).find('.lumen-hero__bg--b');
    assert.equal(a.attr('src'), 'https://img/t/p/w1280/f2.jpg', 'без тяжёлых эффектов — один слой, смена без кроссфейда');
    assert.equal(b.attr('src'), undefined, 'второй слой пуст: в памяти не больше двух кадров');

    env.live()[0].fn();
    env.images[env.images.length - 1].onload();
    env.live()[0].fn();
    env.images[env.images.length - 1].onload();
    assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'кадр с текстом пропущен, круг замкнулся');

    env.advance(20000);
    assert.equal(env.requests.filter((r) => r.url.indexOf('/videos') >= 0).length, 0, 'трейлер в этом режиме не спрашивается');
    assert.equal(env.players.length, 0);
    assert.deepEqual(warnLog, []);
  } finally { env.restore(); }
});

/* Волна 3: кадр героя — не ключевой арт, и смена кадров начинается с
   выбранного кадра, а сам ключевой арт в ротацию героя не идёт — иначе
   через интервал на экране снова стоял бы постер ряда. У карточки фильма
   ротация прежняя (src/50_backdrops.js не тронут). */
test('волна 3: смена кадров героя начинается с выбранного кадра, ключевого арта в ней нет', () => {
  const env = slidesEnv();
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    const sized = (p) => Object.assign({ file_path: p, iso_639_1: null, width: 1920, height: 1080, aspect_ratio: 1.778 }, VOTES);
    detailsOf(env, 11).ok({ id: 11, backdrop_path: '/b1.jpg', images: { logos: [], backdrops: [sized('/b1.jpg'), sized('/f2.jpg'), sized('/f3.jpg')] } });
    frameImg(env, '/f2.jpg').onload();
    assert.equal(env.live().length, 1, 'смена кадров не заведена');
    const shown = [];
    for (let i = 0; i < 4; i++) {
      env.live()[0].fn();
      const img = env.images[env.images.length - 1];
      shown.push(img.src.replace('https://img/t/p/w1280', ''));
      img.onload();
    }
    assert.deepEqual(shown, ['/f3.jpg', '/f2.jpg', '/f3.jpg', '/f2.jpg'], 'по кругу — только кадры без ключевого арта');
    assert.deepEqual(warnLog, []);
  } finally { env.restore(); }
});

test('«Только кадры»: фокус в рядах — пауза, смена карточки снимает таймер прошлой', () => {
  const env = slidesEnv();
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    const node = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    const first = env.live()[0];

    /* Вторая карточка — во втором ряду: герой сжат. */
    main.card1.removeClass('focus');
    focusOn(main, main.card2);
    assert.equal(node.hasClass('lumen-hero--compact'), true);
    assert.equal(first.cleared, true, 'сжатие ставит паузу сразу');
    env.advance(400);
    detailsOf(env, 22).ok(FRAMES(22, '/b2.jpg'));
    assert.equal(env.live().length, 0, 'слайдшоу новой карточки заводится на паузе');

    /* Назад в первый ряд: пауза снята, кадры — уже этой карточки. */
    main.card2.removeClass('focus');
    focusOn(main, main.card1);
    assert.equal(node.hasClass('lumen-hero--compact'), false);
    env.advance(400);
    /* Кадр второй карточки так и не доехал — на экране всё ещё /b1.jpg, и
       нового запроса кадра нет. */
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    assert.equal(env.live().length, 1, 'ровно один таймер — висящих от прошлых карточек нет');

    env.hero.unmount();
    assert.equal(env.live().length, 0, 'уход с главной снимает смену кадров');
  } finally { env.restore(); }
});

/* Долг фазы 2, п.4 вместе с настройкой «Только кадры» (cca3dec): после
   возврата из карточки смена кадров продолжается с того кадра, на котором
   ушли, а не начинается с главного. */
test('«Только кадры»: уход в карточку ставит смену на паузу, возврат продолжает её', () => {
  const env = slidesEnv();
  try {
    const main = makeMain();
    const card = makeMain();
    env.hero.mount(main.activity);
    const node = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    env.live()[0].fn();
    env.images[env.images.length - 1].onload();
    const a = stageOf(node).find('.lumen-hero__bg--a');
    assert.equal(a.attr('src'), 'https://img/t/p/w1280/f2.jpg', 'предусловие: показан второй кадр');

    env.hero.detach(card.activity);
    assert.equal(env.live().length, 0, 'под карточкой таймер смены кадров снят');

    env.hero.mount(main.activity);
    assert.equal(env.live().length, 1, 'на возврате смена продолжается');
    assert.equal(a.attr('src'), 'https://img/t/p/w1280/f2.jpg', 'кадр тот же, на котором ушли');
    const before = env.images.length;
    env.live()[0].fn();
    assert.equal(env.images[before].src, 'https://img/t/p/w1280/f3.jpg', 'следующий — третий кадр, а не снова второй');
    assert.equal(env.requests.filter((r) => r.url === 'movie/11').length, 1, 'детали заново не спрашивались');
    assert.deepEqual(warnLog, []);
  } finally { env.restore(); }
});

/* Проверка на ТВ 2026-09-24: «Кадры и трейлер» (по умолчанию) = кадры и
   трейлер. Кадры сменяются, пока ролик не играет: старт ролика ставит смену
   на паузу, его конец (или отказ) — продолжает. На телевизоре ролик может
   не стартовать вовсе, и тогда главная хотя бы не стоит на одном кадре. */
test('«Кадры и трейлер» (по умолчанию) в lite: кадры сменяются, ролик ставит смену на паузу, конец ролика её продолжает', () => {
  const env = slidesEnv({ media: 'trailer', motion: 'lite', heavy: false });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    const node = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    assert.equal(env.live().length, 1, 'смена кадров заведена и в режиме с трейлером');

    env.advance(8200);
    const req = lastVideos(env);
    assert.ok(req, 'трейлер спрашивается через 8 с');
    req.ok(VIDEOS_RU);
    assert.equal(env.players.length, 1);
    assert.equal(env.live().length, 1, 'пока ролик не пошёл — кадры меняются');

    env.players[0].onStart();
    assert.equal(node.hasClass('lumen-hero--trailer'), true);
    assert.equal(env.live().length, 0, 'ролик играет — смена кадров на паузе');

    env.players[0].onEnd();
    assert.equal(node.hasClass('lumen-hero--trailer'), false);
    assert.equal(env.live().length, 1, 'ролик кончился — смена кадров продолжается');
    assert.deepEqual(warnLog, []);
  } finally { env.restore(); }
});

/* Ревью «Волны 1», п.5: «Интервал смены кадров … Применяется сразу» — а
   ветка настройки трогала только карточку, и герой держал старый ритм до
   следующей карточки. applyInterval перезаводит таймер идущей смены;
   стоящую на паузе (ролик, сжатие, парковка) не будит — её resume и так
   прочтёт интервал заново. */
test('«Интервал смены кадров» на лету: идущая смена кадров героя сразу переходит на новый ритм', () => {
  const env = slidesEnv();
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    assert.equal(env.live()[0].ms, 14000);

    env.interval.ms = 8000;
    env.hero.applyInterval();
    assert.equal(env.live().length, 1, 'таймер один — старый снят');
    assert.equal(env.live()[0].ms, 8000);
    assert.deepEqual(warnLog, []);
  } finally { env.restore(); }
});

test('«Интервал смены кадров» на лету под играющим роликом: смену не будит, после ролика — новый ритм', () => {
  const env = slidesEnv({ media: 'trailer', motion: 'lite' });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    env.advance(8200);
    lastVideos(env).ok(VIDEOS_RU);
    env.players[0].onStart();
    assert.equal(env.live().length, 0);

    env.interval.ms = 20000;
    env.hero.applyInterval();
    assert.equal(env.live().length, 0, 'ролик играет — кадры стоят');

    env.players[0].onEnd();
    assert.equal(env.live().length, 1);
    assert.equal(env.live()[0].ms, 20000);
  } finally { env.restore(); }
});

test('«Кадры и трейлер»: конец ролика в сжатом состоянии не снимает паузу сжатия', () => {
  const env = slidesEnv({ media: 'trailer', motion: 'lite' });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    env.advance(8200);
    lastVideos(env).ok(VIDEOS_RU);
    env.players[0].onStart();
    assert.equal(env.live().length, 0);

    /* Тот же фильм во втором ряду: перевод фокуса на него ролик не снимает
       (trailerCard тот же), но героя сжимает. Ролик доигрывает там. */
    main.card2.card_data = main.card1.card_data;
    main.card1.removeClass('focus');
    focusOn(main, main.card2);
    assert.equal(env.players[0].destroys, 0, 'предусловие: ролик жив');
    env.players[0].onEnd();
    assert.equal(env.live().length, 0, 'сжато — кадры по-прежнему стоят');
    main.card2.removeClass('focus');
    focusOn(main, main.card1);
    assert.equal(env.live().length, 1, 'развернули — смена пошла');
  } finally { env.restore(); }
});

test('«Кадры и трейлер»: возврат из сжатого состояния при играющем ролике паузу не снимает', () => {
  const env = slidesEnv({ media: 'trailer', motion: 'lite' });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    env.advance(8200);
    lastVideos(env).ok(VIDEOS_RU);
    env.players[0].onStart();
    main.card2.card_data = main.card1.card_data;
    main.card1.removeClass('focus');
    focusOn(main, main.card2);
    main.card2.removeClass('focus');
    focusOn(main, main.card1);
    assert.equal(env.players[0].destroys, 0, 'предусловие: ролик жив');
    assert.equal(env.live().length, 0, 'ролик ещё играет — кадры стоят');
  } finally { env.restore(); }
});

test('«Только кадры» с тяжёлыми эффектами: ушедший слой отпускает кадр после кроссфейда', () => {
  const env = slidesEnv({ motion: 'full', heavy: true });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    const node = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    env.live()[0].fn();
    frameImg(env, '/f2.jpg').onload();
    const a = stageOf(node).find('.lumen-hero__bg--a');
    const b = stageOf(node).find('.lumen-hero__bg--b');
    assert.equal(b.attr('src'), 'https://img/t/p/w1280/f2.jpg');
    assert.equal(a.attr('src'), 'https://img/t/p/w1280/b1.jpg', 'на время кроссфейда оба слоя с кадром');
    env.advance(700);
    assert.equal(a.attr('src'), undefined, 'после кроссфейда ушедший слой пуст');
    assert.equal(b.hasClass('is-active'), true);
  } finally { env.restore(); }
});

test('«Что показывает кадр главной» на лету: «Только кадры» снимает ролик, кадры продолжают идти', () => {
  const env = slidesEnv({ media: 'trailer' });
  try {
    const main = makeMain();
    env.hero.mount(main.activity);
    const hero = heroOf(main.activity);
    focusOn(main, main.card1);
    env.advance(400);
    detailsOf(env, 11).ok(FRAMES(11, '/b1.jpg'));
    frameImg(env, '/b1.jpg').onload();
    assert.equal(env.live().length, 1, 'кадры идут и в режиме с трейлером');
    env.advance(8200);
    lastVideos(env).ok(VIDEOS_RU);
    env.players[0].onStart();
    assert.equal(env.live().length, 0, 'ролик играет — пауза');

    const requests = env.requests.length;
    env.media.value = 'frames';
    env.hero.applyMedia();
    assert.equal(env.players[0].destroys, 1, '«Только кадры» снимает играющий ролик');
    assert.equal(hero.hasClass('lumen-hero--trailer'), false);
    assert.equal(env.live().length, 1, 'смена кадров продолжается сразу');
    assert.equal(env.requests.length, requests, 'без нового запроса деталей');
  } finally { env.restore(); }
});

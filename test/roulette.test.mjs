import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 23 (фаза 3): рулетка «Что посмотреть» — две отдельные (фильмы и
   сериалы), выбор подборок чипами, фильтры «не смотрел» и «есть 90 минут» /
   «серия до 30 минут».

   Здесь — чистая часть (пул кандидатов, фильтры, выбор, план барабана,
   разбор сохранённого набора подборок и проверка длительности по деталям) и
   те куски рантайма, что можно спросить без DOM: список подборок для медиа и
   чтение настроек. Основной сценарий (экран, фокус, прокрутка чипов)
   проверяется живьём; Task 34 добавил в конец файла отдельный минимальный
   стенд (фейковые $/Lampa.Scroll/Controller, ручной планировщик setTimeout,
   заглушка Image) — только для поведения фона результата рулетки, самого
   уязвимого места из живой жалобы пользователя. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const SRC = readFileSync(new URL('../src/56_roulette.js', import.meta.url), 'utf8');
const UTIL = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');
/* Task 68: LC.focus — общий механизм подписки на фокус (src/11_focus.js):
   watchFocus/railChip слушают и пульт, и мышь. */
const FOCUS = readFileSync(new URL('../src/11_focus.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', UTIL)(LC, module);
  new Function('LC', 'module', FOCUS)(LC, module);
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

const R = fresh().api;

const movie = (id, extra) => Object.assign({ id, title: 'Фильм ' + id, release_date: '2020-01-01' }, extra || {});
const show = (id, extra) => Object.assign({ id, name: 'Сериал ' + id, first_air_date: '2020-01-01' }, extra || {});

/* ====================================================================== */
/* Пул кандидатов                                                         */
/* ====================================================================== */

test('buildPool: фильмы отделяются от сериалов по полям названия и даты', () => {
  const mixed = [movie(1), show(2), movie(3), show(4)];
  assert.deepEqual(R.buildPool(mixed, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.buildPool(mixed, 'tv').map((c) => c.id), [2, 4]);
});

test('buildPool: media_type сильнее догадки по полям', () => {
  const odd = [{ id: 7, title: 'Док', media_type: 'tv' }, { id: 8, name: 'Странное', media_type: 'movie' }];
  assert.deepEqual(R.buildPool(odd, 'tv').map((c) => c.id), [7]);
  assert.deepEqual(R.buildPool(odd, 'movie').map((c) => c.id), [8]);
});

test('buildPool: дубли по id снимаются, мусор пропускается', () => {
  const list = [movie(1), movie(1), null, { title: 'без id' }, movie(2)];
  assert.deepEqual(R.buildPool(list, 'movie').map((c) => c.id), [1, 2]);
  assert.deepEqual(R.buildPool(null, 'movie'), []);
});

test('buildPool: карточки без постера не годятся — барабану нечего показать', () => {
  const list = [movie(1, { poster_path: '/a.jpg' }), movie(2, { poster_path: '' }), movie(3)];
  const pool = R.buildPool(list, 'movie', true);
  assert.deepEqual(pool.map((c) => c.id), [1], 'с требованием постера остаётся только первый');
  assert.equal(R.buildPool(list, 'movie').length, 3, 'без требования — все');
});

/* ====================================================================== */
/* Фильтры                                                               */
/* ====================================================================== */

const ctx = {
  isSeen: (id) => id === 2,
  runtime: (id) => ({ 1: 80, 2: 120, 3: null, 4: 140 }[id])
};

test('applyFilters: «не смотрел» убирает просмотренное', () => {
  const pool = [movie(1), movie(2), movie(3)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true }, ctx, 'movie').map((c) => c.id), [1, 3]);
  assert.deepEqual(R.applyFilters(pool, {}, ctx, 'movie').map((c) => c.id), [1, 2, 3]);
});

test('applyFilters: «есть 90 минут» — короткие и те, чья длительность ещё неизвестна', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, ctx, 'movie').map((c) => c.id), [1, 3],
    'неизвестная длительность (3) остаётся — её проверят после выбора');
});

test('applyFilters: у сериалов порог другой — серия до 30 минут', () => {
  const tvCtx = { isSeen: () => false, runtime: (id) => ({ 10: 25, 11: 45, 12: null }[id]) };
  const pool = [show(10), show(11), show(12)];
  assert.deepEqual(R.applyFilters(pool, { short: true }, tvCtx, 'tv').map((c) => c.id), [10, 12]);
});

test('applyFilters: оба фильтра вместе; пустой результат — пустой массив', () => {
  const pool = [movie(1), movie(2), movie(4)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, ctx, 'movie').map((c) => c.id), [1]);
  assert.deepEqual(R.applyFilters([], { unseen: true }, ctx, 'movie'), []);
  assert.deepEqual(R.applyFilters(null, {}, ctx, 'movie'), []);
});

test('applyFilters: без ctx фильтры ничего не выбрасывают — данных для отказа нет', () => {
  const pool = [movie(1), movie(2)];
  assert.deepEqual(R.applyFilters(pool, { unseen: true, short: true }, null, 'movie').map((c) => c.id), [1, 2]);
});

test('shortLimit: 90 минут фильму, 30 — серии', () => {
  assert.equal(R.shortLimit('movie'), 90);
  assert.equal(R.shortLimit('tv'), 30);
});

test('fitsShort: проверка выбранного по деталям — фильм по runtime, сериал по длине серии', () => {
  assert.equal(R.fitsShort({ runtime: 88 }, 'movie'), true);
  assert.equal(R.fitsShort({ runtime: 140 }, 'movie'), false);
  assert.equal(R.fitsShort({ episode_run_time: [22, 25] }, 'tv'), true);
  assert.equal(R.fitsShort({ episode_run_time: [52] }, 'tv'), false);
  assert.equal(R.fitsShort({ episode_run_time: [] }, 'tv'), true, 'нечего проверить — кандидат остаётся');
  assert.equal(R.fitsShort(null, 'movie'), true, 'деталей нет — не отказываем');
  assert.equal(R.fitsShort({ runtime: 0 }, 'movie'), true, 'ноль у TMDB означает «неизвестно»');
});

/* ====================================================================== */
/* Выбор и барабан                                                        */
/* ====================================================================== */

test('pick: равномерный выбор из пула', () => {
  const pool = [movie(1), movie(2), movie(3), movie(4)];
  assert.equal(R.pick(pool, () => 0).id, 1);
  assert.equal(R.pick(pool, () => 0.999).id, 4);
  assert.equal(R.pick(pool, () => 0.5).id, 3);
  assert.equal(R.pick([], Math.random), null);
  assert.equal(R.pick(null, Math.random), null);
});

test('pick: за много бросков достаются все элементы пула', () => {
  const pool = [movie(1), movie(2), movie(3)];
  const seen = new Set();
  let seed = 3;
  const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 200; i++) seen.add(R.pick(pool, rnd).id);
  assert.equal(seen.size, 3);
});

test('spinPlan: разгон, вращение, торможение — 3100 мс ± 50, последний шаг на результате', () => {
  const plan = R.spinPlan(10);
  assert.ok(plan.length > 10, 'шагов должно быть больше, чем позиций ленты: ' + plan.length);
  const total = plan.reduce((sum, s) => sum + s.delay, 0);
  assert.ok(Math.abs(total - 3100) <= 50, 'длительность спина: ' + total);
  assert.equal(plan[plan.length - 1].index, 9, 'последний шаг — выбранный кадр (конец ленты)');
  for (const step of plan) {
    assert.ok(step.index >= 0 && step.index < 10, 'индекс вне ленты: ' + step.index);
    assert.ok(step.delay > 0);
  }
});

test('spinPlan: барабан ускоряется, потом тормозит', () => {
  const plan = R.spinPlan(12);
  const first = plan[0].delay;
  const middle = plan[Math.floor(plan.length / 2)].delay;
  const last = plan[plan.length - 1].delay;
  assert.ok(middle < first, 'в середине шаги чаще, чем в начале');
  assert.ok(last > middle, 'к концу барабан замедляется');
});

test('spinPlan: короткая лента и вырожденные значения', () => {
  assert.deepEqual(R.spinPlan(0), []);
  assert.deepEqual(R.spinPlan(1), [{ index: 0, delay: 0 }], 'один кандидат — крутить нечего');
  const plan = R.spinPlan(2);
  assert.equal(plan[plan.length - 1].index, 1);
});

/* ====================================================================== */
/* Task 72: барабан крутится и в «Лёгких»                                 */
/*                                                                        */
/* Отзыв пользователя 2026-09-21, п.4: «рулетка не выглядит как рулетка».  */
/* Режим движения у него «Лёгкие» (он выбрал его сам), а там барабан не    */
/* крутился вовсе — результат появлялся сразу за нажатием. Полсотни смен   */
/* картинки за 3 секунды на слабом ТВ действительно дороги, восемь — нет.  */
/* ====================================================================== */

/* Задержки лёгкого барабана: в коде они лежат одним массивом, здесь —
   литералом, чтобы тест ловил и подмену самих чисел. */
const LITE_DELAYS = [120, 140, 170, 210, 260, 330, 420, 550];

test('Task 72: spinPlan(n, "lite") — восемь шагов с замедлением, 2.2 с, последний на результате', () => {
  const plan = R.spinPlan(10, 'lite');
  assert.equal(plan.length, 8, 'шагов в «Лёгких» ровно восемь: ' + plan.length);
  assert.deepEqual(plan.map((s) => s.delay), LITE_DELAYS);
  assert.equal(plan.reduce((sum, s) => sum + s.delay, 0), 2200, 'суммарно 2.2 с');
  assert.equal(plan[plan.length - 1].index, 9, 'последний шаг — выбранный кадр (конец ленты)');
  for (const step of plan) assert.ok(step.index >= 0 && step.index < 10, 'индекс вне ленты: ' + step.index);
  /* Каждый следующий шаг длиннее предыдущего: барабан именно тормозит, а
     не мигает восемь раз с одинаковой паузой. */
  for (let i = 1; i < plan.length; i++) {
    assert.ok(plan[i].delay > plan[i - 1].delay, 'шаг ' + i + ' не длиннее предыдущего');
  }
});

test('Task 72: spinPlan(n, "off") — спина нет вовсе', () => {
  assert.deepEqual(R.spinPlan(10, 'off'), [], 'при выключенных анимациях барабан не крутится');
  assert.deepEqual(R.spinPlan(1, 'off'), []);
  assert.deepEqual(R.spinPlan(0, 'off'), []);
});

test('Task 72: лента короче восьми — шагов не больше, чем позиций, и торможение в конце', () => {
  for (const n of [2, 3, 5, 7]) {
    const plan = R.spinPlan(n, 'lite');
    assert.equal(plan.length, n, 'лента из ' + n + ': шагов ' + plan.length);
    assert.equal(plan[plan.length - 1].index, n - 1, 'последний шаг — выбранный кадр (лента из ' + n + ')');
    /* Берётся ХВОСТ таблицы задержек: барабан обязан заканчиваться самым
       медленным шагом, иначе короткая лента останавливается рывком. */
    assert.deepEqual(plan.map((s) => s.delay), LITE_DELAYS.slice(LITE_DELAYS.length - n));
  }
  assert.deepEqual(R.spinPlan(1, 'lite'), [{ index: 0, delay: 0 }], 'один кандидат — крутить нечего');
  assert.deepEqual(R.spinPlan(0, 'lite'), []);
});

/* Ревью 2026-09-22 (М4): «шагов столько, сколько позиций» мало — надо,
   чтобы каждый шаг ещё и МЕНЯЛ кадр. Прежняя посадка правила индекс
   последнего шага, и на ленте из двух позиций план выходил [1, 1]:
   результат виден с первого кадра, а барабан стоит на нём 970 мс. */
test('Task 72 (ревью М4): соседние шаги барабана всегда показывают разные кадры', () => {
  for (const mode of ['lite', 'full']) {
    for (const n of [2, 3, 5, 7, 8, 10, 25]) {
      const plan = R.spinPlan(n, mode);
      assert.equal(plan[plan.length - 1].index, n - 1, mode + ', лента из ' + n + ': барабан сел не на выбранный кадр');
      for (let i = 1; i < plan.length; i++) {
        assert.notEqual(plan[i].index, plan[i - 1].index,
          mode + ', лента из ' + n + ': шаги ' + (i - 1) + ' и ' + i + ' показывают один кадр (' + plan[i].index + ')');
      }
      /* И ход по кругу без разрывов: следующий кадр — ровно соседний. */
      for (let i = 1; i < plan.length; i++) {
        assert.equal(plan[i].index, (plan[i - 1].index + 1) % n,
          mode + ', лента из ' + n + ': барабан прыгнул через кадр на шаге ' + i);
      }
    }
  }
});

test('Task 72: без режима и в "full" план прежний — полный барабан', () => {
  assert.deepEqual(R.spinPlan(10, 'full'), R.spinPlan(10), 'вызов без режима обязан остаться полным барабаном');
  assert.ok(R.spinPlan(10, 'full').length > 8, 'полный барабан длиннее лёгкого');
});

/* ====================================================================== */
/* Подборки и сохранённый выбор                                           */
/* ====================================================================== */

const manifest = {
  home: ['trend', 'marvel'],
  collections: [
    { id: 'trend', title: 'В тренде', group: 'top', sources: { movie: { type: 'discover' }, tv: { type: 'discover' } } },
    { id: 'marvel', title: 'Marvel', group: 'franchise', sources: { movie: { type: 'collection', id: 1 } } },
    { id: 'hbo', title: 'HBO', group: 'studio', sources: { tv: { type: 'discover' } } },
    { id: 'kp', title: 'Кинопоиск', group: 'kp', sources: { movie: { type: 'kp', collection: 'TOP' } } }
  ]
};

test('collectionsFor: только подборки с источником нужного медиа, подборки главной первыми', () => {
  const movies = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(movies.map((c) => c.id), ['trend', 'marvel', 'kp']);
  const tv = R.collectionsFor(manifest, 'tv');
  assert.deepEqual(tv.map((c) => c.id), ['trend', 'hbo']);
  assert.deepEqual(R.collectionsFor(null, 'movie'), []);
});

test('chipList: на экране не весь каталог, но отмеченное видно всегда', () => {
  const list = [];
  for (let i = 0; i < 30; i++) list.push({ id: 'c' + i, title: 'c' + i });
  const shown = R.chipList(list, [], 14);
  assert.equal(shown.length, 14, 'предел соблюдён');
  assert.deepEqual(shown.map((c) => c.id), list.slice(0, 14).map((c) => c.id));

  const withPicked = R.chipList(list, ['c25'], 14);
  assert.equal(withPicked.length, 15, 'отмеченная подборка добавлена сверх предела');
  assert.equal(withPicked[withPicked.length - 1].id, 'c25');

  const already = R.chipList(list, ['c2'], 14);
  assert.equal(already.length, 14, 'отмеченная внутри предела второй раз не добавляется');
  assert.deepEqual(R.chipList([], ['c1'], 14), []);
  assert.deepEqual(R.chipList(null, [], 14), []);
});

test('parseIds / joinIds: сохранённый набор подборок — строка через запятую', () => {
  assert.deepEqual(R.parseIds('trend,marvel'), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(' trend , , marvel '), ['trend', 'marvel']);
  assert.deepEqual(R.parseIds(''), []);
  assert.deepEqual(R.parseIds(null), []);
  assert.equal(R.joinIds(['trend', 'marvel']), 'trend,marvel');
  assert.equal(R.joinIds([]), '');
});

test('sourcesFor: пустой выбор — подборки главной, иначе выбранные, не больше предела', () => {
  const all = R.collectionsFor(manifest, 'movie');
  assert.deepEqual(R.sourcesFor(all, [], manifest).map((c) => c.id), ['trend', 'marvel'],
    '«Все» означает набор главной, а не полторы сотни запросов');
  assert.deepEqual(R.sourcesFor(all, ['kp'], manifest).map((c) => c.id), ['kp']);
  assert.deepEqual(R.sourcesFor(all, ['нет-такой'], manifest).map((c) => c.id), ['trend', 'marvel'],
    'неизвестные id — как будто выбора нет');
  const many = [];
  for (let i = 0; i < 12; i++) many.push({ id: 'c' + i, title: 'c' + i, sources: { movie: {} } });
  assert.equal(R.sourcesFor(many, many.map((c) => c.id), manifest).length, R.MAX_SOURCES);
});

/* ====================================================================== */
/* Настройки                                                              */
/* ====================================================================== */

test('unseenDefault: настройка lumen_roulette_unseen включена по умолчанию', () => {
  const on = fresh({ pref: (name, def) => def });
  assert.equal(on.api.unseenDefault(), true);
  const off = fresh({ pref: (name, def) => (name === 'lumen_roulette_unseen' ? false : def) });
  assert.equal(off.api.unseenDefault(), false);
});

test('storageKey: у фильмов и сериалов свои наборы подборок', () => {
  assert.equal(R.storageKey('movie'), 'lumen_roulette_movie');
  assert.equal(R.storageKey('tv'), 'lumen_roulette_tv');
});

test('normalizeMedia: чужое значение — фильмы', () => {
  assert.equal(R.normalizeMedia('tv'), 'tv');
  assert.equal(R.normalizeMedia('movie'), 'movie');
  assert.equal(R.normalizeMedia('мусор'), 'movie');
  assert.equal(R.normalizeMedia(undefined), 'movie');
});

/* ====================================================================== */
/* Прокрутка экрана (Task 32)                                             */
/* ====================================================================== */

/* ВНИМАНИЕ: это проверка ИСХОДНИКА, а не поведения. Компонент
   lumen_roulette в этом файле не поднимается (см. шапку: здесь только
   чистая логика, DOM-заглушек нет), а заводить ради двух вызовов целый
   фейковый DOM с событиями и десяток заглушек Lampa дороже пользы.
   Поэтому читаем текст src/56_roulette.js и убеждаемся, что обе половины
   штатного контракта прокрутки на месте; как экран листается на самом
   деле, проверяет координатор живьём на телевизоре. Поведенческие тесты
   тех же вызовов есть у хаба и сетки (test/hub.test.mjs). */

/* Кусок исходника от заголовка до строки, на которой он кончается. */
function section(from, to) {
  const start = SRC.indexOf(from);
  assert.notEqual(start, -1, 'в src/56_roulette.js не найдено: ' + from);
  const end = SRC.indexOf(to, start);
  assert.notEqual(end, -1, 'в src/56_roulette.js не найдено: ' + to);
  return SRC.slice(start, end);
}

test('исходник: create рулетки задаёт области прокрутки высоту экрана (scroll.minus)', () => {
  const create = section('this.create = function () {', 'this.render = function (js)');
  assert.ok(create.indexOf('scroll.minus();') !== -1,
    'без minus() контейнер прокрутки растянут по содержимому и экран не листается');
});

test('исходник: watchFocus рулетки подкручивает скролл к фокусу', () => {
  const watch = section('function watchFocus(node) {', 'Шапка, чипы, фильтры');
  assert.ok(watch.indexOf('keepVisible(node[0]);') !== -1,
    'через watchFocus проходят все .selector рулетки — подкрутка ставится там');
  const keep = section('function keepVisible(el) {', 'function watchFocus(node)');
  assert.ok(keep.indexOf('scroll.update(el, true)') !== -1,
    'подкрутка — штатным scroll.update, с выравниванием по центру');
});

/* ====================================================================== */
/* Фон результата рулетки (Task 34)                                       */
/* ====================================================================== */

/* Поднимаем настоящий RouletteComponent на минимальном стенде — тот же
   приём, что в test/hub.test.mjs (свой $/El, фейковый Lampa.Scroll и
   Controller), плюс то, что нужно именно здесь: ручной планировщик
   setTimeout/clearTimeout (тест сам решает, когда сработает шаг барабана —
   приём из test/util.test.mjs, test/hero.test.mjs) и заглушка window.Image
   (showResult предзагружает кадр через неё, Task 34). this.start() тоже
   нужен (перезапуск предзагрузки после stop()/start()) — Navigator и
   Lampa.Activity не заводим: navMove() внутри this.start() не зовётся из
   наших тестов, а Lampa.Activity.active() — в try/catch, без него просто
   тихо не отфильтрует активность.

   openRoulette34(cards, t) подменяет globalThis.window/Lampa/$/Image/
   setTimeout/clearTimeout и возвращает их через t.after(...) — так финал
   каждого теста восстанавливает окружение, даже если тест упал по assert
   (в отличие от «один раз в конце файла»): без этого первый же тест,
   дописанный в конец файла ПОСЛЕ этого блока, унаследовал бы подменённый
   setTimeout и завис бы на реальной сети. */

function El(classes) {
  this._class = classes || [];
  this._children = [];
  this._ev = {};
  this._css = {};
  this.length = 1;
  this[0] = this;
}
El.prototype.addClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { if (c && self._class.indexOf(c) < 0) self._class.push(c); });
  return this;
};
El.prototype.removeClass = function (list) {
  var self = this;
  ('' + list).split(/\s+/).forEach(function (c) { var i = self._class.indexOf(c); if (i >= 0) self._class.splice(i, 1); });
  return this;
};
El.prototype.hasClass = function (c) { return this._class.indexOf(c) >= 0; };
/* Task 44: показ результата снимает прямоугольник барабана
   (getBoundingClientRect) — узлом служит сам El, потому что конструктор
   ставит this[0] = this. По умолчанию прямоугольник нулевой: переход на
   таком не начинается, и тесты, которым он не нужен, ничего не настраивают. */
El.prototype.getBoundingClientRect = function () {
  return this._rect || { left: 0, top: 0, width: 0, height: 0 };
};
El.prototype.append = function (child) { this._children.push(child); return this; };
El.prototype.empty = function () { this._children = []; return this; };
El.prototype.remove = function () { return this; };
El.prototype.css = function (name, val) {
  if (arguments.length < 2) return this._css[name];
  this._css[name] = val;
  return this;
};
/* Пятый раунд, п.2: text() как у jQuery — без аргумента геттер (текст узла
   и потомков подряд), с аргументом сеттер, заменяющий содержимое. Без него
   paintPreview (счётчик выборки) на стенде всегда падал внутрь try/catch, и
   класс is-stack не ставился никогда — показ выборки был невидим тестам. */
El.prototype.text = function (val) {
  if (arguments.length) {
    this._text = '' + val;
    this._children = [];
    return this;
  }
  var out = this._text || '';
  for (var i = 0; i < this._children.length; i++) out += this._children[i].text();
  return out;
};
El.prototype.on = function (name, fn) { (this._ev[name] = this._ev[name] || []).push(fn); return this; };
El.prototype.show = function () { return this; };
El.prototype.hide = function () { return this; };
El.prototype.all = function (sel) {
  var cls = sel.replace(/^\./, '');
  var out = [];
  (function walk(node) {
    for (var i = 0; i < node._children.length; i++) {
      var c = node._children[i];
      if (c.hasClass(cls)) out.push(c);
      walk(c);
    }
  })(this);
  return out;
};
/* Обход коллекции. ВАЖНО: find() этой заглушки отдаёт ОДИН узел (первый
   совпавший), поэтому each() пробегает ровно по нему. Для путей, которые
   проходят здешние тесты, этого хватает — setMedia дальше только метит
   вкладку классом is-on, а проверяют тесты не его. Полноценная коллекция
   потребовала бы переписать find(), и делать это ради одной метки дороже,
   чем польза. */
El.prototype.each = function (fn) { fn.call(this, 0, this); return this; };
var EMPTY_EL = new El([]);
EMPTY_EL.length = 0;
El.prototype.find = function (sel) {
  var found = this.all(sel);
  return found.length ? found[0] : EMPTY_EL;
};

function classesOf(html) {
  var m = /class="([^"]*)"/.exec('' + html);
  return m ? m[1].split(/\s+/).filter(Boolean) : [];
}

function make$() {
  return function (arg) {
    if (arg instanceof El) return arg;
    if (typeof arg === 'string' && arg.charAt(0) === '<') {
      var tags = arg.match(/<div[^>]*>/g) || [];
      var root = new El(classesOf(tags[0]));
      for (var i = 1; i < tags.length; i++) root.append(new El(classesOf(tags[i])));
      return root;
    }
    return EMPTY_EL;
  };
}

function fire(node, name) {
  var list = (node && node._ev && node._ev[name]) || [];
  for (var i = 0; i < list.length; i++) list[i]();
}

var scrolls = [];
function ElScroll(params) {
  var body = new El([]);
  this.params = params || {};
  this.updates = [];
  this.resets = 0;
  this.append = function (el) { body.append(el); };
  this.render = function () { return body; };
  this.minus = function () { };
  this.update = function (el) { this.updates.push(el); };
  this.reset = function () { this.resets++; };
  this.destroy = function () { };
  scrolls.push(this);
}

/* Заглушка Image: конструктор просто копится в createdImages, onload/onerror
   зовёт тест сам — ни настоящей сети, ни настоящей декодировки картинки в
   node нет и не будет. */
var createdImages = [];
function FakeImage() {
  this.onload = null;
  this.onerror = null;
  this._src = '';
  createdImages.push(this);
}
Object.defineProperty(FakeImage.prototype, 'src', {
  get: function () { return this._src; },
  set: function (v) { this._src = v; }
});

/* Ручной планировщик: setTimeout только копит колбэки, flushTimers()
   прогоняет их по одному (в порядке постановки) — так шаги барабана
   (spinPlan: полсотни в полном режиме, восемь в «Лёгких») проходят без
   настоящей паузы в 2-3 с. */
var timers = [];
var nextTimerId = 1;
function resetTimers() { timers = []; nextTimerId = 1; }
function fakeSetTimeout(fn, ms) {
  var id = nextTimerId++;
  timers.push({ id: id, fn: fn, ms: ms, cancelled: false });
  return id;
}
function fakeClearTimeout(id) {
  for (var i = 0; i < timers.length; i++) {
    if (timers[i].id === id) timers[i].cancelled = true;
  }
}
function flushTimers() {
  var guard = 0;
  while (timers.length && guard < 2000) {
    var t = timers.shift();
    guard++;
    if (!t.cancelled) t.fn();
  }
}

var MANIFEST34 = {
  version: 1,
  home: ['col-a'],
  collections: [
    { id: 'col-a', title: 'Подборка', sources: { movie: { type: 'discover', params: {} } } }
  ]
};

var poolCards34 = [];
/* Ф2 п.5: счётчик запросов пула — тест паузы проверяет, что скрытый экран
   в сеть не ходит. Сбрасывается в openRoulette34. */
var fetchCalls34 = 0;
/* Пятый раунд, п.1: сколько раз рулетка собирала выборку (в MANIFEST34 одна
   подборка — один запрос первой страницы на сбор) и сколько раз спросила
   каталог. Сбрасываются в openRoulette34. */
var poolSets34 = 0;
var manifestCalls34 = 0;
/* Контрольное ревью 84c7b27..de0e2c8: по умолчанию сеть отвечает
   синхронно (кэш), но настоящие LC.manifest.load (12-часовой кэш устарел —
   идёт XHR, src/42_manifest.js) и LC.sources.fetch отвечают позже.
   hold34.manifest / hold34.pool включают это поведение: колбэки копятся в
   heldManifest34 / heldPool34, и тест отпускает их сам (releaseHeld).
   Всё сбрасывается в openRoulette34. */
var hold34 = {};
var heldManifest34 = [];
var heldPool34 = [];
/* Журнал self.activity.loader(...): последнее значение — состояние
   индикатора загрузки активности. */
var loaderLog34 = [];
/* Пятый раунд, п.3: заглушка отвечает так же, как настоящий LC.sources.fetch
   (fetchAll, src/43_sources.js:461-500): поколение alive() снимается в
   момент вызова, и ответ подписчику отбрасывается, если к ответу alive()
   отдаёт другое значение (notifySubs: sub.alive() !== sub.gen); clear()
   снимает подписку — её ответ не придёт вовсе. deliveredPool34 — сколько
   ответов пула дошло до рулетки. */
var deliveredPool34 = 0;
function fetchStub34(item, page, ok, err, alive) {
  fetchCalls34++;
  if (page === 1) poolSets34++;
  var gen = alive ? alive() : 0;
  var cleared = false;
  var answer = function () {
    if (cleared) return;
    if (alive && alive() !== gen) return;
    deliveredPool34++;
    ok({ results: page === 1 ? poolCards34 : [] });
  };
  if (hold34.pool) heldPool34.push(answer);
  else answer();
  return { clear: function () { cleared = true; } };
}
function manifestStub34(cb) {
  manifestCalls34++;
  if (hold34.manifest) heldManifest34.push(function () { cb(MANIFEST34); });
  else cb(MANIFEST34);
}
function releaseHeld(list) {
  var calls = list.splice(0, list.length);
  for (var i = 0; i < calls.length; i++) calls[i]();
}

function backdropUrl(card) {
  return 'https://img/w1280' + card.backdrop_path;
}

/* Снимок настоящих globalThis.window/Lampa/$/Image/setTimeout/clearTimeout,
   сделанный ДО первой подмены (на момент загрузки этого файла ни один из
   них ещё не тронут — window/Lampa/$/Image в node их просто нет, отсюда
   undefined, и это тоже правильное значение для отката). restoreGlobals34()
   возвращает все шесть к этому снимку; openRoulette34 регистрирует её через
   t.after(...) на каждый тест отдельно. */
var REAL_GLOBALS34 = {
  window: globalThis.window,
  Lampa: globalThis.Lampa,
  $: globalThis.$,
  Image: globalThis.Image,
  setTimeout: globalThis.setTimeout,
  clearTimeout: globalThis.clearTimeout
};
function restoreGlobals34() {
  globalThis.window = REAL_GLOBALS34.window;
  globalThis.Lampa = REAL_GLOBALS34.Lampa;
  globalThis.$ = REAL_GLOBALS34.$;
  globalThis.Image = REAL_GLOBALS34.Image;
  globalThis.setTimeout = REAL_GLOBALS34.setTimeout;
  globalThis.clearTimeout = REAL_GLOBALS34.clearTimeout;
}

/* Поднимает lumen_roulette на минимальном стенде и возвращает {comp, root,
   bg}. cards — пул кандидатов, который отдаст LC.sources.fetch (одна
   подборка, одна страница с результатами — этого достаточно: pick() из
   единственного кандидата детерминирован независимо от Math.random).
   t — TestContext вызвавшего теста: им регистрируется восстановление
   глобалов после теста, что бы в нём ни случилось. */
/* Task 39: dpr — третий аргумент, потому что от него зависит размер и
   постера в барабане, и кадра под результатом. */
/* Task 44: слой перехода — заглушка с журналом. По умолчанию reveal
   отвечает false («переход не пошёл, рисуй сразу»): так ведут себя и режим
   «Движение: выкл», и любой стенд, где переходы не проигрываются, — и
   старые тесты фона от этого не зависят вовсе. Тест, которому нужен сам
   переход, ставит transitionStub.on = true и зовёт fireReveal(). */
var transitionStub = null;
var activeAct34 = null;
var collected = [];
var focused = [];
function resetCollection() { collected = []; focused = []; }
function resetTransition() {
  transitionStub = {
    on: false,
    reveals: [],
    stops: 0,
    api: {
      reveal: function (source, opts) {
        transitionStub.reveals.push({ source: source, opts: opts });
        return transitionStub.on;
      },
      stop: function () { transitionStub.stops++; }
    }
  };
}
/* Конец разгона удержанного слоя: рулетка отдала колбэк, зовём его сами. */
function fireReveal() {
  var last = transitionStub.reveals[transitionStub.reveals.length - 1];
  last.opts.then();
}

function openRoulette34(cards, t, dpr, motion, object, hold) {
  hold34 = hold || {};
  heldManifest34 = [];
  heldPool34 = [];
  loaderLog34 = [];
  resetTimers();
  resetTransition();
  resetCollection();
  createdImages.length = 0;
  scrolls.length = 0;
  poolCards34 = cards;
  fetchCalls34 = 0;
  poolSets34 = 0;
  manifestCalls34 = 0;
  deliveredPool34 = 0;
  t.after(restoreGlobals34);

  var components = {};
  var controllers = {};
  var Lampa = {
    Scroll: ElScroll,
    Component: { add: function (name, fn) { components[name] = fn; } },
    /* Ревью Task 44 (п.1, п.6): область обхода фокуса — это то, что
       последним ушло в collectionSet. Заглушка ведёт журнал, иначе промах
       «флаг сменили, коллекцию не переустановили» тестом не виден. */
    Controller: {
      /* Правка 2026-09-23 (п.5.2): обработчики контроллера теперь
         проверяются — вниз с ленты подборок обязан доводить до «Крутить». */
      add: function (name, handlers) { controllers[name] = handlers; },
      toggle: function () { },
      collectionSet: function (node) { collected.push(node); },
      collectionFocus: function (node, box) { focused.push({ node: node, box: box }); }
    },
    Menu: { addButton: function () { return new El([]); } },
    /* Пятый раунд, п.5: как у настоящей Lampa, Activity.active() — вершина
       истории (active$3, vendor/lampa/app.min.js:45889-45891). По умолчанию
       это сама рулетка; тест «Назад» подменяет activeAct34 предыдущим
       экраном — так делает backward() до destroy() рулетки. */
    Activity: { active: function () { return activeAct34; } }
  };
  /* Task 44: высота окна нужна так же, как ширина, — барабан задан в vh. */
  globalThis.window = { Lampa: Lampa, innerWidth: 1920, innerHeight: 1080, devicePixelRatio: dpr || 1 };
  globalThis.Lampa = Lampa;
  globalThis.$ = make$();
  globalThis.Image = FakeImage;
  globalThis.setTimeout = fakeSetTimeout;
  globalThis.clearTimeout = fakeClearTimeout;

  var built = fresh({
    lang: function (k) { return k; },
    langCode: function () { return 'ru'; },
    pref: function (name, def) { return def; },
    motionMode: function () { return motion || 'full'; },
    hub: { titleOf: function (item) { return (item && item.title) || ''; } },
    cardinfo: { imageUrl: function (path, size) { return path ? 'https://img/' + size + path : ''; } },
    rows: { viewedIds: function () { return []; } },
    manifest: { load: manifestStub34 },
    sources: { fetch: fetchStub34 },
    transition: transitionStub.api
  });
  built.api.install();

  var Comp = components.lumen_roulette;
  var comp = new Comp(object || {});
  comp.activity = { loader: function (on) { loaderLog34.push(!!on); } };
  activeAct34 = { component: 'lumen_roulette', activity: comp.activity };
  comp.create();
  var screen = comp.render();
  var reel = screen.find('.lumen-roulette__reel');
  /* Барабан на экране 1920×1080: 28.67vh — это 310 × 464 px. */
  reel._rect = { left: 805, top: 250, width: 310, height: 464 };
  return {
    api: built.api,
    comp: comp,
    screen: screen,
    /* Последняя установленная область обхода фокуса и последний фокус. */
    lastCollection: function () { return collected[collected.length - 1]; },
    lastFocus: function () { return focused[focused.length - 1]; },
    resultNode: function () { return screen.find('.lumen-roulette__result')[0]; },
    root: screen.find('.lumen-roulette'),
    controller: function () { return controllers.content; },
    /* Горит ли индикатор загрузки активности (последний вызов loader). */
    loading: function () { return loaderLog34.length ? loaderLog34[loaderLog34.length - 1] : false; },
    chips: function () { return screen.find('.lumen-roulette__chipbox').all('.lumen-roulette__chip'); },
    /* Пятый раунд, п.2: выборка на экране — класс is-stack на сцене и число
       под барабаном (их ставит paintPreview). */
    stacked: function () { return screen.find('.lumen-roulette__stage').hasClass('is-stack'); },
    count: function () { return screen.find('.lumen-roulette__count-value').text(); },
    reel: reel,
    bg: screen.find('.lumen-roulette__bg'),
    transition: transitionStub
  };
}

/* Нажимает «Крутить» и сразу прогоняет барабан до конца (все его шаги —
   через ручной планировщик). После возврата showResult уже вызван, но
   предзагрузка кадра (если backdrop_path есть) ещё не завершена — её
   отдельно резолвит тест через createdImages. */
function spinAndFlush(env) {
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  flushTimers();
}

test('spin(): фон прошлого результата снимается до прокрутки барабана, не после', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  createdImages[createdImages.length - 1].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'первый результат показал свой фон');

  /* Второе «Крутить»: пул уже в кэше (loadPool отдаёт его синхронно), но
     сама прокрутка барабана идёт через таймеры — до flushTimers() фон
     обязан быть уже снят, а не всё ещё держать кадр фильма A. */
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(env.bg.css('background-image'), '', 'фон снят сразу — до прокрутки, а не после её конца');
  flushTimers();
});

test('showResult: карточка без backdrop_path оставляет фон пустым, а не прошлым кадром', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const B = { id: 2, title: 'Фильм B', release_date: '2020-01-01', poster_path: '/b-p.jpg', backdrop_path: '' };
  /* Оба кандидата — в пуле с самого начала. loadPool кэширует пул по ключу
     «медиа + набор подборок»: без смены чипов второе «Крутить» сеть не
     перезапрашивает, оно просто выбирает элемент из уже загруженного —
     поэтому подмена poolCards34 ПОСЛЕ первого спина на выбор второго не
     влияет никак (ровно так уже один раз ошибочно было устроено здесь: B
     в пул не попадал, и тест был зелёным по факту, что B вообще не
     выбирался). Чтобы вторым спином гарантированно достался B, здесь
     подменяется Math.random — тем же приёмом, что и в тесте про поздний
     onload ниже. */
  const env = openRoulette34([A, B], t);
  const realRandom = Math.random;
  try {
    Math.random = function () { return 0; };
    spinAndFlush(env);
    createdImages[0].onload();
    assert.notEqual(env.bg.css('background-image'), '', 'подготовка: у фильма A фон есть');

    Math.random = function () { return 0.9; };
    spinAndFlush(env);
    assert.equal(env.bg.css('background-image'), '', 'у фильма B backdrop_path пуст — фон пустой, а не фон фильма A');
    assert.equal(createdImages.length, 1, 'у B нет кадра — prepareFrame на пустой backdrop_path новую предзагрузку не запускает');
  } finally {
    Math.random = realRandom;
  }
});

test('showResult: фон появляется только после onload картинки, до этого пусто', (t) => {
  const C = { id: 3, title: 'Фильм C', release_date: '2020-01-01', poster_path: '/c-p.jpg', backdrop_path: '/c-b.jpg' };
  const env = openRoulette34([C], t);
  spinAndFlush(env);
  assert.equal(env.bg.css('background-image'), '', 'до onload фон ещё не поставлен');
  assert.equal(createdImages.length, 1, 'предзагрузка кадра запущена — Image создан');
  assert.equal(createdImages[0].src, backdropUrl(C));
  createdImages[0].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(C) + '")');
});

test('showResult: поздний onload от прошлого запроса чужой кадр не ставит', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const C = { id: 3, title: 'Фильм C', release_date: '2020-01-01', poster_path: '/c-p.jpg', backdrop_path: '/c-b.jpg' };
  /* Оба кандидата — в одном и том же пуле с самого начала (см. предыдущий
     тест — почему не через смену poolCards34). Math.random подменяется,
     чтобы первый спин детерминированно достался A, а второй — C. */
  const env = openRoulette34([A, C], t);
  const realRandom = Math.random;
  try {
    Math.random = function () { return 0; };
    spinAndFlush(env);
    const staleOnload = createdImages[0].onload;
    assert.equal(typeof staleOnload, 'function');

    /* Второй спин запускается, НО НЕ прогоняется до конца — это и есть то
       самое временнóе окно, ради которого заведён cancelResultLoader:
       барабан ещё крутится, showResult(C) ещё не было. */
    Math.random = function () { return 0.9; };
    fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');

    /* Первая защита: cancelResultLoader() отработал СИНХРОННО, первой же
       строкой spin() (через clearResult()), поэтому у ИСТИНСКОГО объекта
       Image A обработчик уже снят. Ответь сеть сейчас по-настоящему — она
       не попала бы никуда, потому что вызывать нечего. */
    assert.equal(createdImages[0].onload, null,
      'onload у объекта Image A снят ДО конца прокрутки, а не только после showResult(C)');

    /* Вторая, независимая защита — на случай, если бы отмена почему-то не
       сработала: staleOnload — СОХРАНЁННАЯ ссылка на исходную функцию,
       вызов в обход отменённого свойства img.onload. clearResult() в
       начале spin() уже сбросила result в null (пока крутится барабан,
       подтверждённого результата нет — см. её комментарий в
       src/56_roulette.js), поэтому проверка result !== card внутри
       замыкания (null !== A) блокирует запись и тут: даже синтетический
       обход отменённого обработчика чужой кадр не ставит. */
    staleOnload();
    assert.equal(env.bg.css('background-image'), '',
      'синтетический вызов снятого обработчика — заблокирован проверкой result !== card (result уже null)');

    flushTimers();
    createdImages[createdImages.length - 1].onload();
    assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(C) + '")', 'актуальный onload по-прежнему работает');
  } finally {
    Math.random = realRandom;
  }
});

test('stop() → start(): фон, не успевший загрузиться до ухода с экрана, поднимается заново', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  assert.equal(createdImages.length, 1, 'подготовка: предзагрузка кадра A запущена');

  /* «Смотреть» → openCard → Lampa снимает слайд и зовёт stop(): bump()
     поднимает gen и cancelResultLoader() гасит недогруженную картинку —
     onload у неё пропадает, не долетев. */
  env.comp.stop();
  assert.equal(createdImages[0].onload, null, 'stop() погасил недогруженную предзагрузку');
  assert.equal(env.bg.css('background-image'), '', 'фон так и остался пустым — картинка не успела');

  /* «Назад»: Lampa возвращает слайд и зовёт start() — result (A) всё ещё
     на месте (его снимает только clearResult, а не bump/stop), а фон под
     ним не показан (resultBgShown=false) — предзагрузка перезапускается. */
  env.comp.start();
  assert.equal(createdImages.length, 2, 'start() запросил кадр A заново');
  assert.equal(createdImages[1].src, backdropUrl(A));
  createdImages[1].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'фон результата восстановился после stop()/start()');
});

test('stop() → start(): уже показанный фон повторно не перезагружается', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };
  const env = openRoulette34([A], t);
  spinAndFlush(env);
  createdImages[0].onload();
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'подготовка: фон A уже показан до ухода с экрана');

  env.comp.stop();
  env.comp.start();
  assert.equal(createdImages.length, 1, 'фон уже был показан (resultBgShown) — новой предзагрузки start() не запускает');
  assert.equal(env.bg.css('background-image'), 'url("' + backdropUrl(A) + '")', 'фон остался тем же');
});

/* Task 39/44: размеры считаются по физическим пикселям. Барабан —
   .lumen-roulette__reel шириной 28.67vh (310 px на экране высотой 1080, 620
   при DPR 2), кадр результата растянут на весь экран. */
test('Task 39: постер барабана и кадр результата — по физическим пикселям', (t) => {
  const A = { id: 1, title: 'Фильм A', release_date: '2020-01-01', poster_path: '/a-p.jpg', backdrop_path: '/a-b.jpg' };

  const one = openRoulette34([A], t);
  spinAndFlush(one);
  assert.ok(('' + one.root.find('.lumen-roulette__frame').css('background-image')).indexOf('/w342/a-p.jpg') !== -1,
    'барабан на экране высотой 1080 — w342');
  assert.equal(createdImages[createdImages.length - 1].src, 'https://img/w1280/a-b.jpg', 'кадр на экране 1920 — w1280');

  const two = openRoulette34([A], t, 2);
  spinAndFlush(two);
  assert.ok(('' + two.root.find('.lumen-roulette__frame').css('background-image')).indexOf('/w780/a-p.jpg') !== -1,
    'барабан при DPR 2 — w780');
  /* Ревью Task 39 (п.1) и бэклог с ТВ (п. Б1): у кадра результата потолок
     w1280, а не original — original у TMDB обычно 3840×2160, то есть 31.6 МБ
     распакованного растра на слой, который висит до «Ещё раз». */
  assert.equal(createdImages[createdImages.length - 1].src, 'https://img/w1280/a-b.jpg', 'кадр при DPR 2 — по-прежнему w1280');
});

/* ====================================================================== */
/* Task 44: спокойный экран и переход в кадр                              */
/* ====================================================================== */

const R44 = { id: 5, title: 'Фильм Р', release_date: '2021-01-01', poster_path: '/r-p.jpg', backdrop_path: '/r-b.jpg' };
const NOFRAME44 = { id: 6, title: 'Фильм Б', release_date: '2021-01-01', poster_path: '/b-p.jpg', backdrop_path: '' };

/* Лента подборок — одна строка с собственной ГОРИЗОНТАЛЬНОЙ прокруткой
   Lampa, а не «куча в несколько рядов» переносом. */
test('Task 44: чипы подборок живут в горизонтальной прокрутке', (t) => {
  const env = openRoulette34([R44], t);
  const horiz = scrolls.filter((s) => s.params.horizontal);
  assert.equal(horiz.length, 1, 'горизонтальная прокрутка ровно одна');
  assert.equal(horiz[0].params.over, true, 'без over лента не обрезается и вылезает за экран');
  assert.equal(horiz[0].params.nopadding, true, 'штатные поля ленты добавились бы к полям корня');
  assert.ok(env.root.find('.lumen-roulette__chipbox').length, 'обёртки ленты нет в разметке');
  /* Именно из ленты: чипы фильтров носят тот же класс, но живут в шапке. */
  const chips = env.root.find('.lumen-roulette__chipbox').all('.lumen-roulette__chip');
  assert.ok(chips.length > 1, 'чипов подборок не нашлось: ' + chips.length);

  /* Фокус на чипе подводит ленту по горизонтали — иначе чип остаётся за
     обрезанной кромкой и на экране не появляется вовсе. */
  fire(chips[1], 'hover:focus');
  assert.equal(horiz[0].updates.length, 1, 'лента за фокусом чипа не поехала');
  assert.equal(horiz[0].updates[0], chips[1][0]);
});

/* Task 68: мышь шлёт наведённому узлу 'hover:hover', а не 'hover:focus'
   (vendor/lampa/app.min.js:46360-46364) — подписку на оба ставит общий
   LC.focus.on (src/11_focus.js). У рулетки через него идут оба места:
   watchFocus (вертикальная прокрутка экрана и lastFocus) и railChip
   (горизонтальная лента чипов подборок). */
test('Task 68: мышиный hover:hover ведёт ленту чипов так же, как пультовый', (t) => {
  const env = openRoulette34([R44], t);
  const horiz = scrolls.filter((s) => s.params.horizontal);
  const chips = env.root.find('.lumen-roulette__chipbox').all('.lumen-roulette__chip');
  fire(chips[1], 'hover:hover');
  assert.equal(horiz[0].updates.length, 1, 'мышью лента чипов тоже едет');
  assert.equal(horiz[0].updates[0], chips[1][0]);
});

test('Task 68: мышиный hover:hover подкручивает и сам экран рулетки (watchFocus)', (t) => {
  const env = openRoulette34([R44], t);
  const vert = scrolls.filter((s) => !s.params.horizontal);
  assert.equal(vert.length, 1, 'вертикальная прокрутка ровно одна');
  const spin = env.root.find('.lumen-roulette__spin');
  vert[0].updates.length = 0;
  fire(spin, 'hover:hover');
  assert.equal(vert[0].updates.length, 1, 'мышью экран за фокусом тоже едет');
  assert.equal(vert[0].updates[0], spin[0]);

  /* Одно действие — один проход: обработчик у обоих событий общий. */
  vert[0].updates.length = 0;
  fire(spin, 'hover:focus');
  assert.equal(vert[0].updates.length, 1, 'пультом — ровно один вызов, не два');
});

/* Правка 2026-09-23 (разбор композиции, п.5.2). Вниз с ленты подборок фокус
   не уходил никуда: между чипами и «Крутить» лежит барабан, и по геометрии
   кнопка соседом не считается (замер на стенде 960×540@2 — 300 px пустоты,
   Navigator.canmove('down') отвечает false). Экран читался тупиком: подборки
   отмечены, а до единственного действия добраться нечем, кроме «назад». */
test('правка 2026-09-23: вниз с подборок фокус доводится до «Крутить»', (t) => {
  const env = openRoulette34([R44], t);
  /* Контроллер регистрируется на старте экрана, а не при сборке разметки. */
  env.comp.start();
  const ctrl = env.controller();
  assert.ok(ctrl && typeof ctrl.down === 'function', 'контроллер экрана не зарегистрирован');

  /* Navigator в этом окружении нет вовсе — ровно тот случай, когда
     штатное движение вниз невозможно. */
  ctrl.down();
  const last = env.lastFocus();
  assert.ok(last && last.node === env.root.find('.lumen-roulette__spin')[0], 'фокус не дошёл до кнопки');

  /* Стоя уже на кнопке, вниз не делает ничего — иначе каждое нажатие
     пересобирало бы коллекцию на пустом месте. */
  env.root.find('.lumen-roulette__spin').addClass('focus');
  const before = env.lastFocus();
  ctrl.down();
  assert.equal(env.lastFocus(), before, 'на кнопке вниз пересобирает коллекцию впустую');
});

/* Спокойный экран: до результата кадра нет ни в фоне, ни в режиме. */
test('Task 44: до «Крутить» экран спокойный — ни кадра, ни карточки результата', (t) => {
  const env = openRoulette34([R44], t);
  assert.equal(env.bg.css('background-image'), undefined, 'кадр стоит ещё до результата');
  assert.equal(env.screen.hasClass('is-kadr'), false);
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), false);
  assert.equal(env.transition.reveals.length, 0, 'перехода до «Крутить» быть не может');
});

/* Кадр запрашивается, ПОКА КРУТИТСЯ БАРАБАН, а не после его остановки:
   spinPlan даёт около трёх секунд в полном режиме (и 2.2 в «Лёгких»), и к
   остановке w1280 обычно уже в кэше. */
test('Task 44: кадр предзагружается ещё до остановки барабана', (t) => {
  const env = openRoulette34([R44], t);
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(createdImages.length, 1, 'предзагрузка кадра не стартовала вместе с барабаном');
  assert.equal(createdImages[0].src, 'https://img/w1280/r-b.jpg');
  assert.equal(env.transition.reveals.length, 0, 'перехода на крутящемся барабане быть не должно');
  flushTimers();
});

test('Task 44: результат открывается кадром — reveal по прямоугольнику барабана', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();

  assert.equal(env.transition.reveals.length, 1, 'перехода не было');
  const source = env.transition.reveals[0].source;
  assert.deepEqual(source.rect, { left: 805, top: 250, width: 310, height: 464 },
    'источник перехода — не прямоугольник барабана');
  assert.equal(source.big, 'https://img/w1280/r-b.jpg', 'разворачивается кадр w1280');
  assert.ok(('' + source.poster).indexOf('/w342/r-p.jpg') !== -1, 'постер барабана — запасная картинка: ' + source.poster);

  /* Пока слой разгоняется, экран ещё спокойный: результат покажет колбэк. */
  assert.equal(env.screen.hasClass('is-kadr'), false, 'кадр отдан фону раньше времени');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), false);

  fireReveal();
  assert.equal(env.bg.css('background-image'), 'url("https://img/w1280/r-b.jpg")');
  assert.equal(env.screen.hasClass('is-kadr'), true, 'экран не перешёл в режим кадра');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true);
  assert.ok(env.root.all('.lumen-roulette__btn').length === 3, 'на карточке результата не три кнопки');
  /* Карточка результата лежит ВНУТРИ прокрутки, у .scroll__body Lampa свой
     контекст наложения — поверх удержанного слоя её не показать. Поэтому
     кадр передан фону, а слой снят: обе вещи в одном кадре отрисовки. */
  /* Одно снятие — от clearResult в начале спина (он снимает и режим кадра,
     и слой, если тот остался), второе — вот это. */
  assert.equal(env.transition.stops, 2, 'удержанный слой не снят — карточка осталась под ним');
});

test('Task 44: «Ещё раз» снимает кадр и возвращает спокойный экран', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  fireReveal();
  assert.equal(env.screen.hasClass('is-kadr'), true, 'подготовка: экран в режиме кадра');

  const again = env.root.all('.lumen-roulette__btn')[1];
  fire(again, 'hover:enter');
  assert.equal(env.screen.hasClass('is-kadr'), false, 'режим кадра не снят');
  assert.equal(env.bg.css('background-image'), '', 'кадр остался фоном');
  assert.equal(env.transition.stops, 3, '«Ещё раз» обязано снимать слой и тогда, когда он ещё разгоняется');
  flushTimers();
});

/* Переход не пошёл (кадр не успел загрузиться, «Движение: выкл», барабана
   нет на экране) — результат рисуется сразу, без него. */
test('Task 44: перехода нет — результат всё равно показан', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = false;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  assert.equal(env.transition.reveals.length, 1, 'попытка перехода была');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат не показан');
  assert.equal(env.screen.hasClass('is-kadr'), true, 'кадр есть — экран обязан быть в режиме кадра');
  assert.equal(env.bg.css('background-image'), 'url("https://img/w1280/r-b.jpg")');
});

test('Task 44: кадр не успел загрузиться — перехода нет, результат в потоке', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  spinAndFlush(env);
  assert.equal(env.transition.reveals.length, 0, 'на недогруженной картинке переход показал бы пустой прямоугольник');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат ждать сеть не должен');
  assert.equal(env.screen.hasClass('is-kadr'), false);

  /* Долетел позже — кадр встаёт фоном без перехода: момент для него прошёл. */
  createdImages[0].onload();
  assert.equal(env.bg.css('background-image'), 'url("https://img/w1280/r-b.jpg")');
  assert.equal(env.screen.hasClass('is-kadr'), true);
  assert.equal(env.transition.reveals.length, 0, 'опоздавший кадр перехода не запускает');
});

test('Task 44: у фильма нет кадра вовсе — ни перехода, ни режима кадра', (t) => {
  const env = openRoulette34([NOFRAME44], t);
  env.transition.on = true;
  spinAndFlush(env);
  assert.equal(createdImages.length, 0, 'предзагружать нечего');
  assert.equal(env.transition.reveals.length, 0);
  assert.equal(env.screen.hasClass('is-kadr'), false);
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат обязан быть показан');
});

/* Барабана может не быть на экране вовсе (ушли с активности) — источник
   перехода тогда нулевой, и переход просто не заводится. */
test('Task 44: нулевой прямоугольник барабана — перехода нет', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  env.reel._rect = { left: 0, top: 0, width: 0, height: 0 };
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  assert.equal(env.transition.reveals.length, 0, 'на нулевом прямоугольнике переход не заводится');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true);
  assert.equal(env.screen.hasClass('is-kadr'), true, 'кадр есть — он и должен встать фоном');
});

/* Под фильтры ничего не подошло: режим кадра НЕ включается — менять чипы
   придётся на спокойном экране. */
test('Task 44: пустой результат оставляет спокойный экран', (t) => {
  const env = openRoulette34([], t);
  spinAndFlush(env);
  assert.equal(env.screen.hasClass('is-kadr'), false);
  assert.ok(env.root.all('.lumen-roulette__empty').length, 'сообщения о пустом результате нет');
});

/* Уход с экрана, пока слой ещё разгоняется: снять его больше некому. */
test('Task 44: destroy снимает удержанный слой перехода', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  const before = env.transition.stops;
  env.comp.destroy();
  assert.equal(env.transition.stops, before + 1);
});

/* ====================================================================== */
/* Фикс-раунд Task 44 по ревью                                            */
/* ====================================================================== */

/* П.1. Сужение области обхода фокуса (scope) применяется только в момент
   recollect(), поэтому смены флага kadr мало. Проверяется именно ОБЛАСТЬ —
   последний аргумент collectionSet, — а не флаг: промах был ровно в том,
   что флаг менялся, а коллекция оставалась прежней.
   В «Лёгких» кадр приходит после результата всегда: предзагрузка кадра
   разрешается здесь вручную (createdImages[0].onload), а до тех пор
   барабан успевает докрутиться и showResult отработать. Task 72: барабан
   в «Лёгких» теперь крутится — восемь шагов, — и spinAndFlush прогоняет их
   ручным планировщиком; на исход этого теста длина плана не влияет. */
test('Ревью Task 44: кадр долетел позже результата — коллекция сужается до карточки', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite');
  env.transition.on = true;
  spinAndFlush(env);
  assert.equal(env.transition.reveals.length, 0, 'в «Лёгких» кадр к остановке барабана прийти не успевает');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат показан сразу');
  assert.equal(env.lastCollection(), env.root[0], 'пока кадра нет, обход идёт по всему спокойному экрану');

  createdImages[0].onload();
  assert.equal(env.screen.hasClass('is-kadr'), true, 'кадр долетел — экран перешёл в режим кадра');
  assert.equal(env.lastCollection(), env.resultNode(),
    'область обхода осталась на спокойном экране: «вверх» уведёт фокус на невидимый барабан');
});

/* Тот же промах на обычном пути (кадр успел к остановке барабана) не
   воспроизводится, но область обхода обязана быть сужена и там. */
test('Ревью Task 44: обычный путь через переход тоже оставляет обход на карточке', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  fireReveal();
  assert.equal(env.lastCollection(), env.resultNode());
});

/* П.6. «Ещё раз» нажимают с кнопки, которую clearResult() тут же удаляет
   вместе со всем resultBox. Коллекция обязана вернуться на спокойный экран
   СРАЗУ, а не через три секунды барабана. */
test('Ревью Task 44: «Ещё раз» сразу возвращает обход на спокойный экран', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  fireReveal();
  assert.equal(env.lastCollection(), env.resultNode(), 'подготовка: обход на карточке результата');

  fire(env.root.all('.lumen-roulette__btn')[1], 'hover:enter');
  assert.equal(env.lastCollection(), env.root[0], 'обход остался на опустевшей карточке результата');
  assert.equal(env.lastFocus().node, env.root.find('.lumen-roulette__spin')[0], 'фокус не переехал на «Крутить»');
  flushTimers();
});

/* П.2. Удержанный слой снимает не только наш колбэк: старт любой не-full
   активности зовёт LC.transition.stop() (src/90_runtime.js). Колбэк тогда
   не придёт никогда, а result уже выставлен — экран возвращался с кадром во
   весь экран и ПУСТОЙ карточкой результата, то есть без единого узла в
   обходе фокуса. */
test('Ревью Task 44: слой сняли снаружи — возврат на экран дорисовывает результат', (t) => {
  const env = openRoulette34([R44], t);
  env.transition.on = true;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  createdImages[0].onload();
  flushTimers();
  assert.equal(env.transition.reveals.length, 1, 'подготовка: переход пошёл');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), false,
    'подготовка: карточку рисует колбэк, он ещё не пришёл');

  /* Ушли в левое меню: слой снят снаружи, колбэк не придёт. */
  env.comp.stop();
  assert.equal(env.screen.hasClass('is-kadr'), false, 'режима кадра без карточки быть не должно');

  env.comp.start();
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true,
    'результат остался невидимым — выбранный фильм потерян');
  assert.equal(createdImages.length, 2, 'кадр перезапрошен');
  createdImages[1].onload();
  assert.equal(env.screen.hasClass('is-kadr'), true);
  assert.equal(env.lastCollection(), env.resultNode(), 'на экране нет ни одного узла для фокуса');
});

/* П.7. Набор чипов сменился — лента обязана вернуться в начало. */
test('Ревью Task 44: смена «Фильмы/Сериалы» отматывает ленту чипов в начало', (t) => {
  const env = openRoulette34([R44], t);
  const rail = scrolls.filter((s) => s.params.horizontal)[0];
  const before = rail.resets;
  fire(env.root.all('.lumen-roulette__tab')[1], 'hover:enter');
  assert.ok(rail.resets > before, 'лента осталась сдвинутой от прошлого набора подборок');
});

/* ====================================================================== */
/* Task 72: барабан в «Лёгких» — живой путь через компонент               */
/* ====================================================================== */

/* Прогоняет отложенные колбэки по одному и возвращает их задержки в
   порядке срабатывания. Это тот же flushTimers(), только с журналом: по
   задержкам видно, какой именно план отработал (у лёгкого барабана они
   уникальны — LITE_DELAYS выше). */
function drainDelays() {
  const out = [];
  let guard = 0;
  while (timers.length && guard < 2000) {
    const t = timers.shift();
    guard++;
    if (t.cancelled) continue;
    out.push(t.ms);
    t.fn();
  }
  return out;
}

test('Task 72: в «Лёгких» результат приходит после восьми шагов барабана, а не сразу', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite');
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  /* Пул отдаётся заглушкой синхронно, и до Task 72 результат был бы уже на
     экране: в «Лёгких» runReel показывал его сразу за prepareFrame. */
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), false,
    'результат показан до того, как барабан успел крутнуться');
  const delays = drainDelays();
  for (const ms of LITE_DELAYS) {
    assert.ok(delays.indexOf(ms) !== -1, 'шага на ' + ms + ' мс в прогоне нет: ' + delays.join(','));
  }
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат так и не показан');
  /* Task 44 не сломан: кадр результата запрошен до начала спина (барабан
     дарит сети свои 2.2 с), а когда кадр долетает — экран переходит в режим
     кадра, обход сужается до карточки результата и фокус встаёт на её
     кнопку, а не остаётся на невидимом барабане. */
  assert.equal(createdImages.length, 1, 'кадр результата обязан запрашиваться до барабана');
  createdImages[0].onload();
  assert.equal(env.screen.hasClass('is-kadr'), true, 'кадр долетел — экран обязан перейти в режим кадра');
  assert.equal(env.lastCollection(), env.resultNode(), 'обход не сужен до карточки результата');
  assert.equal(env.lastFocus().node, env.root.find('.lumen-roulette__btn')[0], 'фокус после результата ушёл мимо кнопки');
});

test('Task 72: при выключенных анимациях барабана по-прежнему нет', (t) => {
  const env = openRoulette34([R44], t, 1, 'off');
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true,
    'в режиме «Выключены» результат обязан появляться сразу');
  const delays = drainDelays();
  for (const ms of LITE_DELAYS) {
    assert.equal(delays.indexOf(ms), -1, 'в режиме «Выключены» отработал шаг барабана на ' + ms + ' мс');
  }
});


/* ====================================================================== */
/* Правка 2026-09-23 (разбор композиции, п.5.1): выборка в барабане до     */
/* вращения — стопка постеров и счётчик.                                   */
/* ====================================================================== */

test('правка 2026-09-23: выборка показывается отложенно, и таймер гасится вместе с остальным', () => {
  /* Пауза обязана быть и обязана быть заметно больше героевой: там ждала
     одна картинка, здесь — до пяти подборок по две страницы. */
  const delay = Number(/var PREVIEW_DELAY = (\d+);/.exec(SRC)[1]);
  assert.ok(delay >= 500 && delay <= 1200, 'пауза перед показом выборки ' + delay + ' мс — вне разумного');

  /* Показ поднимается отовсюду, где выборка меняется. Без любого из этих
     мест центр экрана снова молчит на действие. */
  for (const anchor of ['buildFilters', 'setMedia', 'clearResult']) {
    assert.ok(SRC.indexOf(anchor) !== -1, 'функция ' + anchor + ' пропала');
  }
  const calls = (SRC.match(/schedulePreview\(\)/g) || []).length;
  assert.ok(calls >= 7, 'показ выборки поднимается всего из ' + calls + ' мест — какое-то действие осталось без отклика');

  /* Отложенный показ — такой же отменяемый хвост, как запросы и таймер
     барабана: bump() обязан его гасить, иначе ответ для прошлого набора
     дорисует стопку поверх нового. */
  const slice = (name) => {
    const at = SRC.indexOf('function ' + name + '() {');
    assert.notEqual(at, -1, 'функция ' + name + ' не найдена');
    return SRC.slice(at, at + 900);
  };
  assert.ok(slice('bump').indexOf('clearPreviewTimer()') !== -1, 'bump() не гасит таймер показа выборки');

  /* Во время вращения и в режиме кадра показ не поднимается: барабан занят
     своими кадрами, а спокойный экран погашен. */
  const sched = slice('schedulePreview');
  assert.ok(sched.indexOf('spinning || kadr') !== -1, 'показ выборки не проверяет вращение и режим кадра');
  assert.ok(sched.indexOf('gen !== captured') !== -1, 'у отложенного показа нет сторожа поколения');

  /* Стопка и счётчик не фокусируемы — требование разбора: фокус
     по-прежнему на «Крутить». */
  const build = SRC.slice(SRC.indexOf("var peek1 = $("), SRC.indexOf("var spinBtn = $("));
  assert.equal(/selector/.test(build), false, 'узлы стопки и счётчика не должны быть фокусируемыми: ' + build);
});

/* Ревью фикс-раунда, Ф2 п.5. Открыли карточку прямо с рулетки: Lampa
   зовёт у текущей активности только pause(), а stop() — у той, что под ней
   (limit() в vendor/lampa/app.min.js:45771-45775, push$3 — :45836-45841).
   Отложенный показ выборки должен гаснуть уже на pause(): иначе через
   PREVIEW_DELAY рулетка шлёт запросы пула и рисует стопку в скрытом экране. */
test('Ф2 п.5: pause() гасит отложенный показ выборки', (t) => {
  /* Контроль: без pause() тот же заход за PREVIEW_DELAY идёт в сеть — иначе
     ноль запросов ниже ничего бы не доказывал. */
  const probe = openRoulette34([R44, R44], t, 1, 'lite');
  probe.comp.start();
  drainDelays();
  assert.ok(fetchCalls34 > 0, 'показ выборки не запросил пул и без паузы — тест ничего не проверяет');
  assert.equal(probe.stacked(), true, 'показ выборки без паузы не поставил стопку — тест ничего не проверяет');

  const env = openRoulette34([R44, R44], t, 1, 'lite');
  env.comp.start();
  env.comp.pause();
  drainDelays();
  assert.equal(fetchCalls34, 0, 'экран, ушедший под карточку, запросил пул для показа выборки');
  assert.equal(env.stacked(), false, 'стопка нарисована на экране, ушедшем под карточку');

  /* Возврат: показ, погашенный на pause(), поднимается заново — иначе
     барабан пустая коробка до первого действия. И экран остаётся рабочим:
     «Крутить» по-прежнему доводит до результата. */
  env.comp.start();
  drainDelays();
  assert.ok(fetchCalls34 > 0, 'на возврате показ выборки не поднят заново');
  assert.equal(env.stacked(), true, 'на возврате выборка не на экране');
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  drainDelays();
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'после pause()/start() рулетка не крутится');
});

/* Контрольное ревью 84c7b27..de0e2c8, п.1. Каталог идёт в сеть (кэш 12 ч
   устарел), рулетку открыли и тут же ушли через меню: Activity.push зовёт
   pause() у текущей, а pause() -> bump() поднимал общий gen, и ответ
   каталога в create() отсекался навсегда — build() не звался, start() каталог
   не перезапрашивал, индикатор загрузки висел. Ответ каталога гасит только
   destroy(). */
function spinToResult(env) {
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  for (let i = 0; i < 5; i++) {
    releaseHeld(heldPool34);
    drainDelays();
  }
  return env.root.find('.lumen-roulette__result').hasClass('is-live');
}

test('ревью п.1: каталог пришёл, пока рулетка на паузе, — на возврате чипы есть, загрузка снята', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  env.comp.start();
  assert.equal(env.loading(), true, 'предпосылка: пока каталог в пути, индикатор загрузки горит');
  assert.equal(env.chips().length, 0, 'предпосылка: чипов до каталога нет');
  env.comp.pause();
  releaseHeld(heldManifest34);
  drainDelays();
  assert.equal(fetchCalls34, 0, 'экран на паузе пошёл в сеть за выборкой');
  assert.equal(env.stacked(), false, 'экран на паузе нарисовал выборку');
  env.comp.start();
  assert.ok(env.chips().length > 1, 'на возврате ленты подборок нет — каталог потерян');
  assert.equal(env.loading(), false, 'индикатор загрузки висит после возврата');
  drainDelays();
  assert.ok(fetchCalls34 > 0, 'на возврате выборка не показана');
  /* Пятый раунд, п.2: не только запрос, но и сама выборка на экране. */
  assert.equal(env.stacked(), true, 'на возврате стопки выборки на сцене нет');
  assert.equal(env.count(), '1', 'счётчик выборки не показан');
  assert.equal(spinToResult(env), true, 'после возврата рулетка не крутится');
});

test('ревью п.1: каталог пришёл уже после возврата — чипы строятся, загрузка снята', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  env.comp.start();
  env.comp.pause();
  env.comp.start();
  assert.equal(env.loading(), true, 'каталог ещё в пути — индикатор должен гореть');
  /* Пятый раунд, п.1: start() на возврате видит запрос в пути и второй не
     шлёт (сторож manifestWait в requestManifest). */
  assert.equal(manifestCalls34, 1, 'возврат до ответа каталога спросил каталог повторно');
  releaseHeld(heldManifest34);
  assert.ok(env.chips().length > 1, 'поздний ответ каталога отброшен — ленты подборок нет');
  assert.equal(env.loading(), false, 'индикатор загрузки висит');
  assert.equal(spinToResult(env), true, 'рулетка не крутится');
});

/* Пятый раунд, п.1: сторож двойного запроса каталога. Сколько бы раз
   пользователь ни уходил и ни возвращался до ответа, запрос один, и выборка
   по его ответу собирается один раз. */
test('пятый раунд п.1: start/pause/start/pause/start до ответа — один запрос каталога и один сбор выборки', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  env.comp.start();
  env.comp.pause();
  env.comp.start();
  env.comp.pause();
  env.comp.start();
  assert.equal(manifestCalls34, 1, 'каталог запрошен ' + manifestCalls34 + ' раз');
  assert.equal(heldManifest34.length, 1, 'в пути больше одного ответа каталога');
  releaseHeld(heldManifest34);
  drainDelays();
  assert.equal(poolSets34, 1, 'выборка собрана ' + poolSets34 + ' раз');
  assert.ok(env.chips().length > 1, 'лента подборок не построена');
  assert.equal(env.loading(), false, 'индикатор загрузки висит');
});

/* Пятый раунд, п.2: ветка start() с !stage.hasClass('is-stack'). Выборка
   уже на экране — ушли и вернулись: показ заново не поднимается (ни
   отложенного таймера PREVIEW_DELAY, ни сбора выборки), стопка стоит. */
test('пятый раунд п.2: выборка уже на экране — возврат не поднимает показ заново', (t) => {
  const delay = Number(/var PREVIEW_DELAY = (\d+);/.exec(SRC)[1]);
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' });
  env.comp.start();
  assert.ok(drainDelays().indexOf(delay) !== -1, 'предпосылка: первый заход показывает выборку отложенно');
  assert.equal(env.stacked(), true, 'предпосылка: выборка на экране');
  assert.equal(poolSets34, 1);
  env.comp.pause();
  env.comp.start();
  const delays = drainDelays();
  assert.equal(delays.indexOf(delay), -1, 'возврат поднял отложенный показ выборки, уже стоящей на экране');
  assert.equal(poolSets34, 1, 'возврат собрал выборку заново');
  assert.equal(env.stacked(), true, 'стопка пропала после возврата');
});

/* Пятый раунд, п.3: сама заглушка обязана вести себя как настоящий
   LC.sources.fetch — иначе тесты рулетки проверяют мир, которого нет. */
test('пятый раунд п.3: заглушка пула отбрасывает ответ по alive() и после clear(), как настоящий fetch', (t) => {
  openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { pool: true });
  const got = [];
  /* Рулетка отдаёт alive(captured) — булево gen === captured: true при
     вызове, false после bump(). Настоящий fetch сравнивает значение с
     снятым при вызове, поэтому смена true -> false — это смерть. */
  let live = true;
  fetchStub34({ id: 'x' }, 1, () => got.push('bumped'), null, () => live);
  let gen = 1;
  fetchStub34({ id: 'x' }, 1, () => got.push('gen-changed'), null, () => gen);
  fetchStub34({ id: 'x' }, 1, () => got.push('same-gen'), null, () => 7);
  const handle = fetchStub34({ id: 'x' }, 1, () => got.push('cleared'), null, () => 7);
  handle.clear();
  fetchStub34({ id: 'x' }, 1, () => got.push('no-alive'));
  live = false;
  gen = 2;
  releaseHeld(heldPool34);
  assert.deepEqual(got, ['same-gen', 'no-alive'], 'заглушка отдала ответ мёртвому или снятому подписчику');
});

/* Прогоняет только отложенные колбэки с задержкой ms (один проход) — в
   отличие от drainDelays(), не трогает дедлайн сборщика пула
   (POOL_TIMEOUT), который закрыл бы пул пустым раньше ответа сети. */
function fireDelay(ms) {
  const due = timers.filter((x) => x.ms === ms && !x.cancelled);
  timers = timers.filter((x) => due.indexOf(x) < 0);
  due.forEach((x) => x.fn());
  return due.length;
}

/* Пятый раунд, п.4. Показ выборки уже ушёл в сеть (loadPool из
   schedulePreview), пул ещё не собран — пользователь жмёт «Крутить».
   spin() снимал только таймер показа, а loadPool видел пустой пул и слал
   второй полный набор запросов. Теперь «Крутить» присоединяется к сбору
   в полёте. */
test('пятый раунд п.4: «Крутить» во время показа выборки ждёт сбор в полёте, а не шлёт второй', (t) => {
  const delay = Number(/var PREVIEW_DELAY = (\d+);/.exec(SRC)[1]);
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { pool: true });
  env.comp.start();
  assert.equal(fireDelay(delay), 1, 'предпосылка: показ выборки поднят');
  assert.equal(poolSets34, 1, 'предпосылка: показ выборки пошёл в сеть');
  const sent = fetchCalls34;
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(poolSets34, 1, '«Крутить» послал второй набор запросов пула');
  assert.equal(fetchCalls34, sent, '«Крутить» послал лишние запросы пула');
  assert.equal(env.loading(), true, 'пул в пути — индикатор загрузки должен гореть');
  releaseHeld(heldPool34);
  drainDelays();
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'вращение не дошло до результата');
  assert.ok(createdImages.some((img) => img.src === backdropUrl(R44)), 'выпал не тот фильм');
  assert.equal(env.stacked(), false, 'показ выборки дорисовал стопку поверх вращения');
  assert.equal(env.loading(), false, 'индикатор загрузки висит');
  assert.equal(poolSets34, 1, 'после ответа пул собирался ещё раз');
});

/* Пятый раунд, п.5. «Назад» из рулетки, пока каталог в пути: backward()
   снимает рулетку с вершины истории и сразу стартует предыдущий экран, а
   destroy() рулетки зовёт только через 200 мс (vendor/lampa/app.min.js:
   45933-45950); pause() не зовётся, started остаётся true. Ответ каталога в
   это окно не должен забирать коллекцию Navigator у предыдущего экрана. */
test('пятый раунд п.5: ответ каталога в окне 200 мс после «Назад» не забирает коллекцию у предыдущего экрана', (t) => {
  /* Контроль: без «Назад» ответ каталога переустанавливает коллекцию
     рулетки — иначе тишина ниже ничего не доказывает. */
  const probe = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  probe.comp.start();
  const before = collected.length;
  releaseHeld(heldManifest34);
  assert.ok(collected.length > before, 'предпосылка: ответ каталога на активной рулетке ставит коллекцию');

  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  env.comp.start();
  /* backward(): вершина истории — предыдущий экран, он уже стартовал. */
  activeAct34 = { component: 'main', activity: { loader: function () { } } };
  const mark = collected.length;
  const markFocus = focused.length;
  releaseHeld(heldManifest34);
  assert.equal(collected.length, mark, 'ответ каталога забрал коллекцию Navigator у предыдущего экрана');
  assert.equal(focused.length, markFocus, 'ответ каталога перевёл фокус на уходящую рулетку');
  /* Через 200 мс Lampa уничтожает рулетку — в сеть она не идёт. */
  env.comp.destroy();
  drainDelays();
  assert.equal(fetchCalls34, 0, 'уходящая рулетка пошла в сеть за выборкой');
});

test('ревью п.1: ответ каталога после destroy() экран не строит', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { manifest: true });
  env.comp.start();
  env.comp.destroy();
  releaseHeld(heldManifest34);
  drainDelays();
  assert.equal(env.chips().length, 0, 'уничтоженный экран построил ленту подборок');
  assert.equal(fetchCalls34, 0, 'уничтоженный экран пошёл в сеть');
});

/* Контрольное ревью, п.2. «Крутить», пока пул не собран: spin() зажигает
   индикатор загрузки, а снимает его только колбэк loadPool — его отсекает
   pause() -> bump(). Ушли через меню и вернулись — индикатор висел. */
test('ревью п.2: уход во время первого вращения не оставляет индикатор загрузки', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { pool: true });
  env.comp.start();
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(env.loading(), true, 'предпосылка: пул в пути — индикатор горит');
  env.comp.pause();
  releaseHeld(heldPool34);
  /* Пятый раунд, п.3: у настоящего LC.sources.fetch ответы, пришедшие после
     pause() (bump: gen поднят, дескрипторы сняты), до рулетки не доходят. */
  assert.equal(deliveredPool34, 0, 'ответ пула, запрошенного до pause(), дошёл до рулетки');
  env.comp.start();
  assert.equal(env.loading(), false, 'индикатор загрузки висит после возврата');
  assert.equal(spinToResult(env), true, 'после возврата «Крутить» не доводит до результата');
  assert.equal(env.loading(), false, 'индикатор не снят после результата');
});

/* Контрольное ревью шестого раунда, п.2. Тот же индикатор, но отсекает
   колбэк loadPool не уход с экрана, а смена «Фильмы/Сериалы»: setMedia ->
   bump(). Экран остаётся на месте, start() не зовётся, и индикатор,
   зажжённый в spin(), висел над рулеткой до следующего «Крутить». */
test('шестой раунд п.2: смена «Фильмы/Сериалы», пока «Крутить» ждёт пул, снимает индикатор загрузки', (t) => {
  /* У подборки стенда есть и сериальный источник — иначе после смены медиа
     крутить было бы нечего. */
  MANIFEST34.collections[0].sources.tv = { type: 'discover', params: {} };
  t.after(() => { delete MANIFEST34.collections[0].sources.tv; });
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' }, { pool: true });
  env.comp.start();
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  assert.equal(env.loading(), true, 'предпосылка: пул в пути — индикатор горит');
  fire(env.root.all('.lumen-roulette__tab')[1], 'hover:enter');
  assert.equal(env.loading(), false, 'после смены медиа индикатор загрузки висит');
  releaseHeld(heldPool34);
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), false, 'ответ пула фильмов дорисовал результат после смены медиа');
  assert.equal(spinToResult(env), true, 'после смены медиа «Крутить» не доводит до результата');
  assert.equal(env.loading(), false, 'индикатор не снят после результата');
});

test('правка 2026-09-23: подпись счётчика выборки есть во всех трёх языках', () => {
  const settings = readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8');
  const LC = {};
  new Function('LC', 'module', settings)(LC, { exports: null, lumen: true });
  const pack = LC.STRINGS.lumen_roulette_pick;
  assert.ok(pack, 'нет строки lumen_roulette_pick');
  for (const lang of ['ru', 'en', 'uk']) {
    assert.ok(pack[lang] && ('' + pack[lang]).trim(), 'пустой перевод ' + lang);
  }
  /* Подпись — без счётного слова: склонение числительного в трёх языках
     стоило бы таблицы окончаний ради одной строки (разбор просил
     «217 фильмов в выборке»). */
  assert.equal(/фильм|film|movie/i.test(pack.ru + pack.en + pack.uk), false,
    'в подписи появилось счётное слово — вернётся вопрос о склонении: ' + JSON.stringify(pack));
});

/* Правка 2026-09-23 (разбор композиции, п.5.3): подсказки под «Крутить» нет —
   ни на спокойном экране, ни после результата. Разбор разрешил её убрать,
   когда управление собрано слева (п.5.2) и барабан показывает выборку со
   счётчиком (п.5.1); обоснование — у бывшего правила в src/30_css.js. */
test('правка 2026-09-23: подсказки под «Крутить» нет ни до вращения, ни после', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite');
  assert.equal(env.root.find('.lumen-roulette__hint').length, 0, 'узел подсказки снова в разметке');
  fire(env.root.find('.lumen-roulette__spin'), 'hover:enter');
  drainDelays();
  assert.equal(env.root.find('.lumen-roulette__result').hasClass('is-live'), true, 'результат так и не показан');
  assert.equal(env.root.find('.lumen-roulette__hint').length, 0, 'подсказка появилась после результата');
  const settings = readFileSync(new URL('../src/80_settings.js', import.meta.url), 'utf8');
  const LC = {};
  new Function('LC', 'module', settings)(LC, { exports: null, lumen: true });
  assert.equal(LC.STRINGS.lumen_roulette_hint, undefined, 'строка подсказки осталась в словаре без узла');
});

/* Правка 2026-09-23, долг Task 23: вход из сетки подборки открывает рулетку
   с этой подборкой уже отмеченной (object.preselect), а сохранённый выбор
   чипов при этом не перетирается. */
test('правка 2026-09-23: open(media, preselect) передаёт подборку в активность', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite');
  const pushes = [];
  globalThis.Lampa.Activity = { push: function (p) { pushes.push(p); } };
  env.api.open('tv', 'col-a');
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].component, 'lumen_roulette');
  assert.equal(pushes[0].media, 'tv');
  assert.equal(pushes[0].preselect, 'col-a');
  env.api.open('movie');
  assert.equal('preselect' in pushes[1], false, 'без подборки preselect не передаётся вовсе');
});

test('правка 2026-09-23: рулетка с preselect открывается с отмеченной подборкой, а не «Все подборки»', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie', preselect: 'col-a' });
  /* Лента: «Все подборки» и единственная подборка каталога col-a. */
  const chips = env.root.all('lumen-roulette__chips')[0].all('lumen-roulette__chip');
  assert.equal(chips.length, 2);
  assert.equal(chips[0].hasClass('lumen-chip--on'), false, '«Все подборки» отмечены при preselect');
  assert.equal(chips[1].hasClass('lumen-chip--on'), true, 'подборка из preselect не отмечена');
});

test('правка 2026-09-23: без preselect и без сохранённого выбора отмечены «Все подборки»', (t) => {
  const env = openRoulette34([R44], t, 1, 'lite', { media: 'movie' });
  const chips = env.root.all('lumen-roulette__chips')[0].all('lumen-roulette__chip');
  assert.equal(chips.length, 2);
  assert.equal(chips[0].hasClass('lumen-chip--on'), true);
  assert.equal(chips[1].hasClass('lumen-chip--on'), false);
});

test('правка 2026-09-23: pinFirst ставит подборку из preselect первой, остальное не трогает', () => {
  const R = fresh({}).api;
  const list = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(R.pinFirst(list, 'c').map((x) => x.id), ['c', 'a', 'b']);
  assert.deepEqual(R.pinFirst(list, 'a').map((x) => x.id), ['a', 'b', 'c']);
  assert.equal(R.pinFirst(list, 'zzz'), list, 'нет такой — список как есть');
  assert.equal(R.pinFirst(list, ''), list);
  assert.deepEqual(R.pinFirst(null, 'a'), []);
  /* Отмеченная за пределом ленты подборка (chipList кладёт её в конец) с
     preselect оказывается первой. */
  const cat = [];
  for (let i = 0; i < R.CHIP_LIMIT + 5; i++) cat.push({ id: 'c' + i });
  const last = 'c' + (R.CHIP_LIMIT + 3);
  const shown = R.chipList(cat, [last], R.CHIP_LIMIT);
  assert.equal(shown[shown.length - 1].id, last, 'предпосылка: chipList держит её в конце');
  assert.equal(R.pinFirst(shown, last)[0].id, last);
});

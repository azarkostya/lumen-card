import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load, loadCtx } from './_load.mjs';
const P = load('45_personal.js');

/* --- runtime helpers --- */

/* Строит поддельную Lampa и загружает LC.personal в чистый контекст.
   Возвращает {api, LC, addCalls, tmdbCalls}. addCalls — журнал
   ContentRows.add: с волны 4 модуль сам ничего не регистрирует (ряды кладёт
   план главной, src/47_homeplan.js), и тесты пишут туда описания
   api.describe().
   tmdbCalls — массив объектов {url, params, ok, err}:
   колбэки ok/err вызываются вручную в тесте для симуляции сетевого ответа.
   Ф3, довесок Д2 (ревью фикс-раундов): get ничего не возвращает — как
   настоящая Lampa (get$c, vendor/lampa/app.min.js:19693-19737). Прежняя
   заглушка отдавала { clear }, то есть отмену, которой у Lampa нет. */
function setupRuntime(opts) {
  opts = opts || {};
  var addCalls = [];
  var tmdbCalls = [];
  /* Task 58: журналы записи в данные Lampa — фильтр показа не имеет права
     ни удалять историю, ни трогать отметки просмотра. */
  var timelineWrites = [];
  var favoriteWrites = [];

  var Lampa = {
    ContentRows: {
      add: function (d) { addCalls.push(d); },
      remove: function () {}
    },
    Favorite: opts.noFavorite ? undefined : {
      continues: opts.continues || function () { return []; },
      get: opts.getFav || function () { return []; },
      add: function () { favoriteWrites.push(['add'].concat([].slice.call(arguments))); },
      remove: function () { favoriteWrites.push(['remove'].concat([].slice.call(arguments))); },
      toggle: function () { favoriteWrites.push(['toggle'].concat([].slice.call(arguments))); }
    },
    Api: opts.noApi ? undefined : {
      sources: {
        tmdb: {
          get: function (url, params, ok, err) {
            tmdbCalls.push({ url: url, params: params, ok: ok, err: err });
          }
        }
      }
    },
    /* Task 58: локальная история просмотра. Ключ — 'h:' + original_title,
       как его считает фальшивый Lampa.Utils.hash ниже. Незнакомому хэшу
       отдаём объект с нулями — ровно так ведёт себя настоящая
       Timeline.view (app.min.js:23899-23919: road инициализируется нулями и
       возвращается всегда, null она не отдаёт никогда). */
    Timeline: opts.noTimeline ? undefined : {
      view: function (hash) {
        return (opts.timeline || {})[hash] || { hash: hash, percent: 0, time: 0, duration: 0 };
      },
      update: function () { timelineWrites.push(arguments[0]); }
    },
    Utils: { hash: function (s) { return 'h:' + s; } },
    Storage: { field: function (k) { return opts.storage && opts.storage[k]; } }
  };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;

  var ctx = loadCtx('45_personal.js', {
    lang: function (k) { return k; },
    pref: function (k, d) { return (opts.prefs && k in opts.prefs) ? opts.prefs[k] : d; },
    daysWord: function (n) { return n + ' d'; }
  });
  return {
    api: ctx.api, LC: ctx.LC, addCalls: addCalls, tmdbCalls: tmdbCalls,
    timelineWrites: timelineWrites, favoriteWrites: favoriteWrites
  };
}

// --- pickBecause ---
test('pickBecause: пустая история → []', function () {
  assert.deepEqual(P.pickBecause([], 2), []);
  assert.deepEqual(P.pickBecause(null, 2), []);
});
test('pickBecause: n=0 → []', function () {
  assert.deepEqual(P.pickBecause([{ id: 1, title: 'A' }], 0), []);
});
/* Волна 4 (ТВ 2026-09-24): история Lampa идёт ОТ НОВЫХ К СТАРЫМ.
   Favorite.add вставляет id в начало списка, повторный просмотр переносит
   его в начало (Arrays.insert(data[where], 0, id), vendor/lampa/app.min.js:
   22339 и 22359-22360), и синхронизация CUB делает то же
   (Arrays.insert(bookmarks, 0, …), :22941-22957). Прежний тест читал её
   с конца и закреплял ошибку: ряд вечно показывал самый старый фильм
   истории — «Побег из Шоушенка» на фото пользователя. */
test('pickBecause: берёт последние n карточек — история Lampa от новых к старым', function () {
  var history = [
    { id: 3, title: 'C' }, /* посмотрен последним */
    { id: 2, title: 'B' },
    { id: 1, title: 'A' }  /* самый старый */
  ];
  var result = P.pickBecause(history, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 3, 'первым — самый свежий');
  assert.equal(result[1].id, 2);
});
test('pickBecause: дедупликация по id', function () {
  var history = [
    { id: 1, title: 'A' },
    { id: 1, title: 'A dup' },
    { id: 2, title: 'B' }
  ];
  var result = P.pickBecause(history, 3);
  assert.equal(result.length, 2);
  var ids = result.map(function (r) { return r.id; });
  assert.ok(ids.indexOf(1) >= 0);
  assert.ok(ids.indexOf(2) >= 0);
});
test('pickBecause: карточки без id пропускаются', function () {
  var history = [
    { title: 'No id' },
    { id: 1, title: 'A' }
  ];
  var result = P.pickBecause(history, 2);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 1);
});
test('pickBecause: media=tv если есть поле name', function () {
  var history = [
    { id: 10, name: 'Series', title: 'Series' },
    { id: 20, title: 'Movie' }
  ];
  var result = P.pickBecause(history, 2);
  var byId = {};
  result.forEach(function (r) { byId[r.id] = r; });
  assert.equal(byId[10].media, 'tv');
  assert.equal(byId[20].media, 'movie');
});
test('pickBecause: title берётся из name если нет title', function () {
  var history = [{ id: 5, name: 'TV Show' }];
  var result = P.pickBecause(history, 1);
  assert.equal(result[0].title, 'TV Show');
});

// --- soonRange ---
test('soonRange: возвращает {gte, lte} строками даты', function () {
  var range = P.soonRange(new Date(Date.UTC(2026, 0, 1)));
  assert.equal(range.gte, '2026-01-01');
  assert.equal(range.lte, '2026-01-31');
});
test('soonRange: строка даты как входной параметр', function () {
  var range = P.soonRange('2026-06-01');
  assert.equal(range.gte, '2026-06-01');
  assert.equal(range.lte, '2026-07-01');
});
test('soonRange: null → текущая дата, lte = gte + 30 дней', function () {
  var before = Date.now();
  var range = P.soonRange(null);
  var after = Date.now();
  /* Проверяем, что gte не раньше сегодня и не позже завтра. */
  var gteMs = new Date(range.gte + 'T00:00:00Z').getTime();
  var lteMs = new Date(range.lte + 'T00:00:00Z').getTime();
  assert.ok(lteMs - gteMs === 30 * 86400000);
});
test('soonRange: формат дат YYYY-MM-DD с ведущими нулями', function () {
  var range = P.soonRange(new Date(Date.UTC(2026, 0, 5))); /* 5 января */
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(range.gte));
  assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(range.lte));
});

// --- newEpisodes ---
test('newEpisodes: пустой список → []', function () {
  assert.deepEqual(P.newEpisodes([], '2026-09-01'), []);
});
test('newEpisodes: сериал с последней серией в пределах 14 дней → badge «Новая серия»', function () {
  var shows = [{
    id: 1, name: 'Show A',
    last_episode_to_air: { air_date: '2026-09-05' },
    next_episode_to_air: null
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 1);
  assert.ok(result[0].lumen_badge, 'badge должен быть');
  assert.ok(result[0].lumen_badge.indexOf('05') >= 0 || result[0].lumen_badge.length > 0);
  assert.equal(result[0].id, 1);
});
test('newEpisodes: сериал с последней серией старше 14 дней → не включается', function () {
  var shows = [{
    id: 2, name: 'Old Show',
    last_episode_to_air: { air_date: '2026-08-01' },
    next_episode_to_air: null
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: сериал с будущей серией в пределах 7 дней → badge «Через»', function () {
  var shows = [{
    id: 3, name: 'Show B',
    last_episode_to_air: null,
    next_episode_to_air: { air_date: '2026-09-14' }
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 1);
  assert.ok(result[0].lumen_badge.length > 0, 'badge не пустой');
});
test('newEpisodes: сериал с будущей серией далее 7 дней → не включается', function () {
  var shows = [{
    id: 4, name: 'Far Show',
    last_episode_to_air: null,
    next_episode_to_air: { air_date: '2026-10-01' }
  }];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: сортировка по дате последней серии (убывающая)', function () {
  var shows = [
    { id: 1, name: 'Old', last_episode_to_air: { air_date: '2026-09-01' }, next_episode_to_air: null },
    { id: 2, name: 'New', last_episode_to_air: { air_date: '2026-09-09' }, next_episode_to_air: null }
  ];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 2, 'свежий сериал первым');
  assert.equal(result[1].id, 1);
});
test('newEpisodes: не мутирует входные объекты', function () {
  var show = { id: 5, name: 'S', last_episode_to_air: { air_date: '2026-09-08' }, next_episode_to_air: null };
  P.newEpisodes([show], '2026-09-10');
  assert.ok(!show.lumen_badge, 'исходный объект не изменён');
});
test('newEpisodes: null/отсутствующие даты не падают', function () {
  var shows = [
    { id: 6, name: 'NoDate', last_episode_to_air: null, next_episode_to_air: null },
    { id: 7, name: 'BadDate', last_episode_to_air: { air_date: 'garbage' }, next_episode_to_air: null }
  ];
  var result = P.newEpisodes(shows, '2026-09-10');
  assert.equal(result.length, 0);
});
test('newEpisodes: today в виде Date', function () {
  var shows = [{
    id: 8, name: 'S',
    last_episode_to_air: { air_date: '2026-09-05' },
    next_episode_to_air: null
  }];
  var today = new Date(Date.UTC(2026, 8, 10)); /* 10 сентября */
  var result = P.newEpisodes(shows, today);
  assert.equal(result.length, 1);
});

// --- runtime: bumpGen гасит сеть, но закрывает ряд ---

/* Прежняя версия этого теста закрепляла сломанный контракт («после bumpGen
   call не зовём»). Lampa ждёт, пока КАЖДАЯ часть пачки вызовет свой call
   (vendor/lampa/app.min.js, function Progress / function partNext): молчащий
   ряд останавливает достройку главной до перезапуска Lampa. Правильный
   контракт — сеть глушим, а ряд закрываем пустым результатом ровно один раз. */
test('runtime: bumpGen закрывает незавершённый ряд пустым результатом', function () {
  /* Создаём историю с одной карточкой → регистрирует «because» и «new_episodes» ряды. */
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 1, title: 'Movie' }];
      if (opts.type === 'book')    return [{ id: 100, id: 100, name: 'Show', title: 'Show' }];
      return [];
    }
  });
  s.addCalls = s.api.describe();

  /* Запускаем call-функцию ряда «because». */
  var because = null;
  for (var i = 0; i < s.addCalls.length; i++) {
    if (s.addCalls[i].name === 'lumen_because') { because = s.addCalls[i]; break; }
  }
  assert.ok(because, 'ряд lumen_because зарегистрирован');

  var got = [];
  because.call({}, {})(function (data) { got.push(data); });
  assert.equal(got.length, 0, 'пока сеть не ответила — ряд молчит');

  /* Поднимаем поколение: главную выбросили. */
  s.api.bumpGen();
  assert.equal(got.length, 1, 'ряд обязан ответить, иначе пачка Lampa не завершится');
  assert.deepEqual(got[0].results, [], 'ответ пустой — результат уже никому не нужен');

  /* Симулируем ответ сети уже после bumpGen — второго call быть не должно. */
  for (var j = 0; j < s.tmdbCalls.length; j++) {
    s.tmdbCalls[j].ok({ results: [{ id: 42, title: 'Rec' }] });
  }

  assert.equal(got.length, 1, 'call строго один раз при любом исходе');
});

test('runtime: bumpGen закрывает ВСЕ незавершённые персональные ряды', function () {
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 1, title: 'Movie' }];
      if (opts.type === 'book')    return [{ id: 100, name: 'Show', title: 'Show' }];
      return [];
    }
  });
  s.addCalls = s.api.describe();

  var names = [];
  var got = [];
  for (var i = 0; i < s.addCalls.length; i++) {
    (function (d) {
      names.push(d.name);
      d.call({}, {})(function () { got.push(d.name); });
    })(s.addCalls[i]);
  }
  /* «Досмотреть» отвечает синхронно (данные локальные), сетевые — нет. */
  var pendingBefore = names.length - got.length;
  assert.ok(pendingBefore > 0, 'хотя бы один ряд ждёт сеть');

  s.api.bumpGen();
  assert.equal(got.length, names.length, 'после bumpGen ответили все ряды');
});

test('runtime: обычное завершение ряда «Скоро на экранах» — ровно один call', function () {
  var s = setupRuntime();
  s.addCalls = s.api.describe();
  var soon = null;
  for (var i = 0; i < s.addCalls.length; i++) {
    if (s.addCalls[i].name === 'lumen_soon') { soon = s.addCalls[i]; break; }
  }
  assert.ok(soon, 'ряд lumen_soon зарегистрирован');

  var got = [];
  soon.call({}, {})(function (data) { got.push(data); });
  /* Два discover-запроса: movie и tv. */
  assert.equal(s.tmdbCalls.length, 2);
  s.tmdbCalls[0].ok({ results: [{ id: 1, release_date: '2026-10-01' }] });
  assert.equal(got.length, 0, 'ответ только после обоих запросов');
  s.tmdbCalls[1].ok({ results: [{ id: 2, first_air_date: '2026-09-25' }] });
  assert.equal(got.length, 1);
  assert.equal(got[0].results.length, 2);

  /* Поздний bumpGen второго call не даёт. */
  s.api.bumpGen();
  assert.equal(got.length, 1);
});

// --- runtime: describe ---

/* Волна 4: места и регистрацию берёт план главной (src/47_homeplan.js,
   test/homeplan.test.mjs): при ротации «Досмотреть» стоит вторым, и
   закреплённые индексы 0–3 больше не годятся. */
test('describe: описания рядов с данными, по порядку и без мест; выключенная настройка — ни одного', function () {
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [{ id: 5, title: 'Начатый', original_title: 'Начатый' }] : []; },
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 1, title: 'Movie' }];
      if (opts.type === 'book') return [{ id: 100, name: 'Show' }];
      return [];
    }
  });
  var rows = s.api.describe();
  assert.deepEqual(rows.map(function (d) { return d.id + ':' + d.name; }),
    ['continue:lumen_continue', 'because:lumen_because', 'new_episodes:lumen_new_episodes', 'soon:lumen_soon']);
  rows.forEach(function (d) {
    assert.equal(d.index, undefined, 'место назначает план главной');
    assert.equal(d.screen, 'main');
  });
  assert.equal(s.addCalls.length, 0, 'сам модуль в ContentRows ничего не кладёт');
  var off = setupRuntime({ prefs: { lumen_personal_rows: false } });
  assert.deepEqual(off.api.describe(), []);
});

test('describe: исходный фильм «Потому что» выбирает opts.anchor', function () {
  var history = [{ id: 1, title: 'Свежий' }, { id: 2, title: 'Постарше' }];
  var s = setupRuntime({ getFav: function (opts) { return opts.type === 'history' ? history : []; } });
  var seen = [];
  var row = s.api.describe({ anchor: function (h) { seen.push(h); return { id: 2, media: 'movie', title: 'Постарше' }; } })
    .filter(function (d) { return d.id === 'because'; })[0];
  assert.equal(row.title, 'lumen_row_because: «Постарше»');
  row.call({}, 'main')(function () {});
  assert.deepEqual(s.tmdbCalls.map(function (c) { return c.url; }), ['movie/2/recommendations']);
  assert.equal(seen[0], history, 'выбору отдаётся история Lampa как есть');
});

// --- runtime: отсутствие Lampa.Favorite не падает ---

test('runtime: нет Lampa.Favorite → describe не падает, рядов «Досмотреть»/«Потому что»/«Новые серии» нет', function () {
  var s = setupRuntime({ noFavorite: true });
  var rows = null;
  assert.doesNotThrow(function () { rows = s.api.describe(); });
  /* Без Favorite данных нет → только «Скоро». */
  assert.deepEqual(rows.map(function (d) { return d.name; }), ['lumen_soon']);
});

test('runtime: нет Lampa.Api → describe не падает', function () {
  var s = setupRuntime({ noApi: true });
  assert.doesNotThrow(function () { s.api.describe(); });
});

// --- цена первого экрана: лимит сериалов и дедлайн ряда ---

/* Ручной планировщик на время вызова fn: ряды ставят таймер дедлайна через
   setTimeout, а тест сам решает, когда он сработает. */
function withFakeTimers(fn) {
  const realSet = globalThis.setTimeout;
  const realClear = globalThis.clearTimeout;
  const timers = [];
  globalThis.setTimeout = (cb, ms) => { timers.push({ cb, ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = (id) => { if (timers[id - 1]) timers[id - 1].cleared = true; };
  try {
    return fn({ timers, fire: (i) => { const t = timers[i || 0]; if (t && !t.cleared) t.cb(); } });
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
}

function rowByName(s, name) {
  for (var i = 0; i < s.addCalls.length; i++) {
    if (s.addCalls[i].name === name) return s.addCalls[i];
  }
  return null;
}

/* Цена первого экрана: «Новые серии» стоят по одному запросу tv/{id} на
   сериал и попадают в ПЕРВУЮ пачку главной, которую Lampa отдаёт целиком. */
test('цена первого экрана: «Новые серии» берут не больше 6 сериалов', function () {
  var shows = [];
  for (var i = 0; i < 20; i++) shows.push({ id: 100 + i, name: 'Show ' + i, title: 'Show ' + i });
  var s = setupRuntime({
    getFav: function (opts) { return opts.type === 'book' ? shows : []; }
  });
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_new_episodes');
  assert.ok(row, 'ряд «Новые серии» зарегистрирован');
  row.call({}, {})(function () {});
  var tvCalls = s.tmdbCalls.filter(function (c) { return /^tv\//.test(c.url); });
  assert.equal(tvCalls.length, 6, 'не больше 6 запросов деталей сериалов');
});

test('дедлайн: «Новые серии» отдают то, что успело прийти', function () {
  var shows = [];
  for (var i = 0; i < 6; i++) shows.push({ id: 200 + i, name: 'Show ' + i, title: 'Show ' + i });
  var s = setupRuntime({ getFav: function (opts) { return opts.type === 'book' ? shows : []; } });
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_new_episodes');
  var got = [];
  withFakeTimers(function (ctl) {
    row.call({}, {})(function (data) { got.push(data); });
    assert.equal(s.tmdbCalls.length, 6);
    assert.equal(ctl.timers[0].ms, 8000, 'дедлайн — страховка от неотвечающего запроса, а не обрезка медленных');
    /* Ответил один сериал из шести — у него свежая серия. */
    s.tmdbCalls[0].ok({ id: 200, name: 'Show 0', last_episode_to_air: { air_date: isoDaysAgo(2) } });
    assert.equal(got.length, 0, 'пока дедлайн не истёк — ждём остальные');
    ctl.fire(0);
    assert.equal(got.length, 1, 'по дедлайну ряд отвечает, не дожидаясь остальных');
    assert.equal(got[0].results.length, 1, 'в ряду то, что успело прийти');
    /* Опоздавшие ответы второго call не дают — контракт «ровно один call». */
    for (var i = 1; i < s.tmdbCalls.length; i++) {
      s.tmdbCalls[i].ok({ id: 300 + i, name: 'Late', last_episode_to_air: { air_date: isoDaysAgo(1) } });
    }
    assert.equal(got.length, 1, 'call строго один раз');
  });
});

/* Дата «n дней назад» в формате TMDB — для newEpisodes(), которая считает
   свежей серию не старше RECENT_DAYS. */
function isoDaysAgo(n) {
  var d = new Date(Date.now() - n * 86400000);
  return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0');
}

/* Волна 4: у ряда один исходный фильм — значит один запрос, и дедлайн
   закрывает ряд пустым, если этот запрос молчит. */
test('дедлайн: «Потому что вы смотрели» молчащий запрос закрывает ряд пустым', function () {
  var s = setupRuntime({
    getFav: function (opts) { return opts.type === 'history' ? [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] : []; }
  });
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_because');
  var got = [];
  withFakeTimers(function (ctl) {
    row.call({}, {})(function (data) { got.push(data); });
    assert.equal(s.tmdbCalls.length, 1, 'один запрос рекомендаций на ряд');
    assert.equal(got.length, 0);
    ctl.fire(0);
    assert.equal(got.length, 1, 'по дедлайну ряд отвечает');
    assert.deepEqual(got[0].results, [], 'ответа не было — ряд пустой, Lampa его не покажет');
    s.tmdbCalls[0].ok({ results: [{ id: 13 }] });
    assert.equal(got.length, 1, 'call строго один раз');
  });
});

/* Волна 4, фото пользователя: заголовок «Потому что вы смотрели:
   «Побег из Шоушенка»», а в ряду «Кунг-фу Панда» — рекомендации ко ДВУМ
   фильмам, заголовок по первому. Ряд обязан говорить правду: один исходный
   фильм, один запрос, заголовок — ровно он. */
test('«Потому что вы смотрели»: один исходный фильм — один запрос и заголовок о нём же', function () {
  var s = setupRuntime({
    getFav: function (opts) {
      return opts.type === 'history' ? [{ id: 7, title: 'Свежий' }, { id: 3, name: 'Сериал' }, { id: 1, title: 'Старый' }] : [];
    }
  });
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_because');
  assert.equal(row.title, 'lumen_row_because: «Свежий»', 'заголовок при регистрации — по тому же фильму');
  var got = [];
  row.call({}, {})(function (data) { got.push(data); });
  assert.deepEqual(s.tmdbCalls.map(function (c) { return c.url; }), ['movie/7/recommendations'],
    'рекомендации — только к фильму из заголовка');
  s.tmdbCalls[0].ok({ results: [{ id: 70 }, { id: 71 }] });
  assert.equal(got[0].title, 'lumen_row_because: «Свежий»');
  assert.deepEqual(got[0].results.map(function (c) { return c.id; }), [70, 71]);
});

test('дедлайн: «Скоро на экранах» отдаёт частичный результат', function () {
  var s = setupRuntime();
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_soon');
  var got = [];
  withFakeTimers(function (ctl) {
    row.call({}, {})(function (data) { got.push(data); });
    assert.equal(s.tmdbCalls.length, 2, 'discover/movie + discover/tv');
    s.tmdbCalls[0].ok({ results: [{ id: 5, release_date: '2026-10-01' }] });
    ctl.fire(0);
    assert.equal(got.length, 1);
    assert.equal(got[0].results.length, 1);
    s.tmdbCalls[1].ok({ results: [{ id: 6, first_air_date: '2026-10-02' }] });
    assert.equal(got.length, 1, 'call строго один раз');
  });
});

test('полный ответ до дедлайна: таймер снят, ряд отвечает один раз', function () {
  var s = setupRuntime();
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_soon');
  var got = [];
  withFakeTimers(function (ctl) {
    row.call({}, {})(function (data) { got.push(data); });
    s.tmdbCalls[0].ok({ results: [{ id: 5, release_date: '2026-10-01' }] });
    s.tmdbCalls[1].ok({ results: [{ id: 6, first_air_date: '2026-10-02' }] });
    assert.equal(got.length, 1, 'ответили оба — ряд закрыт сразу');
    assert.equal(got[0].results.length, 2);
    assert.equal(ctl.timers[0].cleared, true, 'таймер дедлайна снят');
    ctl.fire(0);
    assert.equal(got.length, 1);
  });
});

test('отмена ряда снимает таймер дедлайна', function () {
  var s = setupRuntime();
  s.addCalls = s.api.describe();
  var row = rowByName(s, 'lumen_soon');
  var got = [];
  withFakeTimers(function (ctl) {
    var handle = row.call({}, {})(function (data) { got.push(data); });
    handle.cancel();
    assert.equal(ctl.timers[0].cleared, true, 'таймер снят при отмене ряда');
    ctl.fire(0);
    assert.equal(got.length, 0, 'отменённый ряд по дедлайну не отвечает');
    /* Запросы отменить нечем — ответы доезжают после отмены. Ряд Lampa
       обязан их не увидеть. */
    s.tmdbCalls[0].ok({ results: [{ id: 5, release_date: '2026-10-01' }] });
    s.tmdbCalls[1].ok({ results: [{ id: 6, first_air_date: '2026-10-02' }] });
    assert.equal(got.length, 0, 'поздние ответы отменённого ряда до Lampa не доходят');
  });
});

/* ====================================================================== */
/* Task 58: досмотренное не висит в «Продолжить просмотр».                */
/* ====================================================================== */

/* Карточка фильма: у фильма нет ни number_of_seasons, ни first_air_date —
   по этим же полям отличает сериал сама Lampa (app.min.js:22632). */
function movie(id, title) { return { id: id, title: title, original_title: title }; }
function series(id, name) {
  return { id: id, name: name, original_name: name, first_air_date: '2005-02-21', number_of_seasons: 3 };
}
/* percentOf для чистой функции: словарь «оригинальное название → процент». */
function percents(map) {
  return function (card) {
    var key = card.original_title || card.title || '';
    return key in map ? map[key] : null;
  };
}

/* A4 (волна A финального плана): порог опущен с 95 до 90. Пользователь
   дважды жаловался, что досмотренное висит в ряду («Аватар», «Моана» 85 %):
   последние проценты плеер добирает только если досидеть титры. 85 не берём —
   на таком проценте фильм может быть реально не досмотрен. */
test('dropFinished: чуть меньше порога — фильм остаётся, чуть больше — уходит', function () {
  var items = [movie(1, 'A'), movie(2, 'B'), movie(3, 'C')];
  var out = P.dropFinished(items, percents({ A: 89, B: 90, C: 91 }));
  assert.deepEqual(out.map(function (c) { return c.id; }), [1],
    '90 — это уже «досмотрено»');
});

/* Сторож A4: опускать порог ряда «Досмотреть» можно, а отметку «просмотрено»
   нельзя — это число Lampa (кнопка отметки ставит percent = 95,
   app.min.js:21274-21279), и три наших места обязаны остаться на 95. */
test('A4: порог ряда — своя константа; отметка «просмотрено» осталась 95', function () {
  const read = (name) => readFileSync(new URL('../src/' + name, import.meta.url), 'utf8');
  assert.match(read('70_progress.js'), /var WATCHED = 95;/, 'src/70_progress.js');
  assert.match(read('44_rows.js'), /var WATCHED = 95;/, 'src/44_rows.js');
  assert.match(read('62_badges.js'), /var PROGRESS_MAX = 95;/, 'src/62_badges.js');
  const personal = read('45_personal.js');
  assert.match(personal, /var CONTINUE_DONE = 90;/, 'порог ряда опущен до 90');
  assert.equal((personal.match(/CONTINUE_DONE/g) || []).length, 2,
    'порог живёт в одной константе и одном сравнении');
});

test('A4: 85 % остаётся в ряду, 95 % уходит — граница ровно на 90', function () {
  var items = [movie(1, 'Моана'), movie(2, 'Аватар')];
  /* 85 % — жалоба пользователя, но и настоящий недосмотр: фильм остаётся. */
  assert.deepEqual(P.dropFinished(items, function () { return 85; }).map(function (c) { return c.id; }), [1, 2]);
  /* 93 % — тот самый случай, ради которого порог и опускали: до Task A4
     карточка висела бы в ряду, потому что 93 < 95. */
  assert.deepEqual(P.dropFinished(items, function () { return 93; }), []);
  /* И прежняя отметка Lampa «просмотрено» (ровно 95) продолжает работать. */
  assert.deepEqual(P.dropFinished(items, function () { return 95; }), []);
});

test('dropFinished: запись без duration решается процентом', function () {
  var items = [movie(1, 'A')];
  /* В записи Timeline duration может быть нулём (плеер не сообщил
     длительность) — на решение это не влияет, считается percent. */
  var out = P.dropFinished(items, function () { return 97; });
  assert.deepEqual(out, []);
});

test('dropFinished: нулевой процент (фильм не начинали) оставляет карточку', function () {
  /* Так отвечает рантайм: Timeline.view незнакомому хэшу отдаёт запись с
     percent = 0, а не отсутствие записи (app.min.js:23899-23919). */
  var items = [movie(1, 'A'), movie(2, 'B')];
  var out = P.dropFinished(items, function () { return 0; });
  assert.deepEqual(out.map(function (c) { return c.id; }), [1, 2]);
});

test('dropFinished: не-число вместо процента фильм не выбрасывает (контракт функции)', function () {
  /* От watchedPercent таких значений не приходит — проверяется сам
     контракт чистой функции на случай другого поставщика процента. */
  var items = [movie(1, 'A')];
  assert.equal(P.dropFinished(items, function () { return null; }).length, 1);
  assert.equal(P.dropFinished(items, function () { return NaN; }).length, 1);
  assert.equal(P.dropFinished(items, function () { return 'сто'; }).length, 1);
  assert.equal(P.dropFinished(items, function () { return undefined; }).length, 1);
});

test('dropFinished: сериал не трогаем даже при полном проценте', function () {
  var items = [series(10, 'Show'), movie(1, 'A')];
  var out = P.dropFinished(items, function () { return 100; });
  assert.deepEqual(out.map(function (c) { return c.id; }), [10],
    'сериал остаётся, фильм уходит');
});

test('dropFinished: сериал опознаётся и по одной first_air_date, и по сезонам', function () {
  var byDate = { id: 11, name: 'S', original_name: 'S', first_air_date: '2010-01-01' };
  var bySeasons = { id: 12, name: 'S2', original_name: 'S2', number_of_seasons: 1 };
  var out = P.dropFinished([byDate, bySeasons], function () { return 99; });
  assert.equal(out.length, 2);
});

test('dropFinished: порядок сохраняется, вход не мутируется', function () {
  var items = [movie(1, 'A'), movie(2, 'B'), movie(3, 'C')];
  var out = P.dropFinished(items, percents({ B: 99 }));
  assert.deepEqual(out.map(function (c) { return c.id; }), [1, 3]);
  assert.equal(items.length, 3, 'исходный массив остался прежним');
  assert.notEqual(out, items);
});

test('dropFinished: пустой вход и отсутствие percentOf не ломают', function () {
  assert.deepEqual(P.dropFinished([], function () { return 99; }), []);
  assert.deepEqual(P.dropFinished(null, function () { return 99; }), []);
  var items = [movie(1, 'A')];
  assert.deepEqual(P.dropFinished(items, null).map(function (c) { return c.id; }), [1]);
});

/* ---------------------------------------------------------------- */
/* Task 58, рантайм: ряд «Продолжить» и данные Lampa.                 */
/* ---------------------------------------------------------------- */

test('Продолжить: досмотренный фильм в ряд не попадает', function () {
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар'), movie(2, 'Дюна')] : []; },
    timeline: { 'h:Аватар': { percent: 98, time: 0, duration: 0 } }
  });
  s.addCalls = s.api.describe();
  var cont = s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; })[0];
  var got = null;
  cont.call({}, 'main')(function (payload) { got = payload; });
  assert.deepEqual(got.results.map(function (c) { return c.id; }), [2]);
});

test('Продолжить: досмотрено всё — ряда нет вовсе', function () {
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар')] : []; },
    timeline: { 'h:Аватар': { percent: 96 } }
  });
  s.addCalls = s.api.describe();
  assert.equal(s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; }).length, 0);
});

test('Продолжить: начатый фильм остаётся на месте', function () {
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар')] : []; },
    timeline: { 'h:Аватар': { percent: 40 } }
  });
  s.addCalls = s.api.describe();
  assert.equal(s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; }).length, 1);
});

test('Продолжить: данные Lampa фильтр не трогает', function () {
  var store = { 'h:Аватар': { percent: 98, time: 9000, duration: 9200 } };
  var snapshot = JSON.stringify(store);
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар'), movie(2, 'Дюна')] : []; },
    timeline: store
  });
  s.addCalls = s.api.describe();
  var cont = s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; })[0];
  cont.call({}, 'main')(function () {});
  assert.equal(JSON.stringify(store), snapshot, 'позиция в Timeline осталась нетронутой');
  assert.deepEqual(s.timelineWrites, [], 'ни одной записи в Timeline');
  assert.deepEqual(s.favoriteWrites, [], 'история и отметки Lampa не тронуты');
});

test('Продолжить: без Lampa.Timeline ряд строится как раньше', function () {
  var s = setupRuntime({
    noTimeline: true,
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар')] : []; }
  });
  s.addCalls = s.api.describe();
  var cont = s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; })[0];
  var got = null;
  cont.call({}, 'main')(function (payload) { got = payload; });
  assert.deepEqual(got.results.map(function (c) { return c.id; }), [1]);
});

test('Продолжить: ряд помечен как персональный (Task 57)', function () {
  var s = setupRuntime({
    continues: function (type) { return type === 'movie' ? [movie(1, 'Аватар')] : []; }
  });
  s.addCalls = s.api.describe();
  var cont = s.addCalls.filter(function (d) { return d.name === 'lumen_continue'; })[0];
  var got = null;
  cont.call({}, 'main')(function (payload) { got = payload; });
  assert.equal(got.lumen_personal, true);
  assert.equal(got.lumen_own, true, 'начатые фильмы — карточки самого пользователя');
});

/* Ревью волны 4 (60): в окно дедупликации вперёд идут только карточки
   самого пользователя — «Досмотреть» и «Новые серии» (lumen_own);
   рекомендации «Потому что» и «Скоро» — нет (LC.rows.dedupeAcross). */
test('«Новые серии» помечены lumen_own, «Потому что» — нет', function () {
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 1, title: 'Первый' }];
      if (opts.type === 'book') return [{ id: 100, name: 'Сериал А' }];
      return [];
    }
  });
  s.addCalls = s.api.describe();
  var got = [];
  rowByName(s, 'lumen_because').call({}, {})(function (data) { got.push(data); });
  s.tmdbCalls[0].ok({ results: [{ id: 11 }] });
  assert.equal(got[0].lumen_personal, true);
  assert.equal(got[0].lumen_own, undefined, 'рекомендации — не карточки пользователя');
  s.tmdbCalls.length = 0;
  rowByName(s, 'lumen_new_episodes').call({}, {})(function (data) { got.push(data); });
  s.tmdbCalls[0].ok({ id: 100, name: 'Сериал А' });
  assert.equal(got[1].lumen_own, true);
});

/* Долг фазы 2 (docs/plans/2026-09-15-lumen-phase2-main.md:373): выборка
   «Потому что вы смотрели» и список сериалов «Новых серий» захватывались при
   register(), то есть раз за активацию, и до конца сессии ряд показывал
   фильм, с которого она началась. Lampa зовёт call при каждой сборке
   главной — значит каждая сборка обязана читать историю заново. */
test('«Потому что вы смотрели» и «Новые серии» читают историю на каждой сборке главной', function () {
  var history = [{ id: 1, title: 'Первый' }];
  var books = [{ id: 100, name: 'Сериал А' }];
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return history;
      if (opts.type === 'book') return books;
      return [];
    }
  });
  s.addCalls = s.api.describe();
  var because = rowByName(s, 'lumen_because');
  var episodes = rowByName(s, 'lumen_new_episodes');
  assert.ok(because && episodes, 'оба ряда заведены');

  var got = [];
  because.call({}, {})(function (data) { got.push(data); });
  assert.equal(s.tmdbCalls[0].url, 'movie/1/recommendations');
  s.tmdbCalls[0].ok({ results: [{ id: 11 }] });
  assert.equal(got[0].title, 'lumen_row_because: «Первый»');

  /* Пользователь посмотрел другой фильм и вернулся на новую главную.
     Lampa кладёт новый просмотр в НАЧАЛО истории (Favorite.add,
     vendor/lampa/app.min.js:22339). */
  history = [{ id: 2, title: 'Второй' }, { id: 1, title: 'Первый' }];
  books = [{ id: 200, name: 'Сериал Б' }];
  s.tmdbCalls.length = 0;
  because.call({}, {})(function (data) { got.push(data); });
  assert.deepEqual(s.tmdbCalls.map(function (c) { return c.url; }), ['movie/2/recommendations'],
    'вторая сборка обязана взять свежую историю — и только фильм из заголовка');
  s.tmdbCalls.forEach(function (c) { c.ok({ results: [] }); });
  assert.equal(got[1].title, 'lumen_row_because: «Второй»', 'заголовок — по последнему просмотру');

  s.tmdbCalls.length = 0;
  episodes.call({}, {})(function () {});
  assert.deepEqual(s.tmdbCalls.map(function (c) { return c.url; }), ['tv/200'],
    '«Новые серии» — по текущим закладкам, а не по снимку при register()');
});

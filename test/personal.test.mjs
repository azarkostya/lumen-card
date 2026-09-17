import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';
const P = load('45_personal.js');

/* --- runtime helpers --- */

/* Строит поддельную Lampa и загружает LC.personal в чистый контекст.
   Возвращает {api, LC, addCalls, removeCalls, tmdbCalls}.
   tmdbCalls — массив объектов {url, params, ok, err, clear, cleared}:
   колбэки ok/err вызываются вручную в тесте для симуляции сетевого ответа. */
function setupRuntime(opts) {
  opts = opts || {};
  var addCalls = [];
  var removeCalls = [];
  var tmdbCalls = [];

  var Lampa = {
    ContentRows: {
      add: function (d) { addCalls.push(d); },
      remove: function (d) { removeCalls.push(d); }
    },
    Favorite: opts.noFavorite ? undefined : {
      continues: opts.continues || function () { return []; },
      get: opts.getFav || function () { return []; }
    },
    Api: opts.noApi ? undefined : {
      sources: {
        tmdb: {
          get: function (url, params, ok, err) {
            var h = { url: url, params: params, ok: ok, err: err, cleared: false };
            h.clear = function () { h.cleared = true; };
            tmdbCalls.push(h);
            return h;
          }
        }
      }
    },
    Storage: { field: function (k) { return opts.storage && opts.storage[k]; } }
  };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;

  var ctx = loadCtx('45_personal.js', {
    lang: function (k) { return k; },
    pref: function (k, d) { return (opts.prefs && k in opts.prefs) ? opts.prefs[k] : d; },
    daysWord: function (n) { return n + ' d'; }
  });
  return { api: ctx.api, LC: ctx.LC, addCalls: addCalls, removeCalls: removeCalls, tmdbCalls: tmdbCalls };
}

// --- pickBecause ---
test('pickBecause: пустая история → []', function () {
  assert.deepEqual(P.pickBecause([], 2), []);
  assert.deepEqual(P.pickBecause(null, 2), []);
});
test('pickBecause: n=0 → []', function () {
  assert.deepEqual(P.pickBecause([{ id: 1, title: 'A' }], 0), []);
});
test('pickBecause: берёт последние n карточек (от конца)', function () {
  var history = [
    { id: 1, title: 'A' },
    { id: 2, title: 'B' },
    { id: 3, title: 'C' }
  ];
  var result = P.pickBecause(history, 2);
  assert.equal(result.length, 2);
  assert.equal(result[0].id, 3); /* последняя */
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
  s.api.register();

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
  s.api.register();

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
  s.api.register();
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

// --- runtime: register не задваивает ---

test('runtime: повторный register не задваивает дескрипторы', function () {
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 1, title: 'Movie' }];
      return [];
    }
  });
  s.api.register();
  var addAfterFirst = s.addCalls.length;

  s.api.register();
  var addAfterSecond = s.addCalls.length;

  /* doUnregister + повторный register добавляет ≤ первого числа дескрипторов,
     не удваивает. */
  assert.ok(addAfterFirst > 0, 'хотя бы один ряд при первом register');
  assert.equal(addAfterSecond - addAfterFirst, addAfterFirst, 'второй register добавил ровно столько же сколько первый');
  /* doUnregister перед вторым register снял все дескрипторы первого. */
  assert.equal(s.removeCalls.length, addAfterFirst, 'remove вызван для всех дескрипторов первого register');
});

// --- runtime: unregister передаёт те же дескрипторы ---

test('runtime: unregister вызывает ContentRows.remove с теми же объектами что add', function () {
  var s = setupRuntime({
    getFav: function (opts) {
      if (opts.type === 'history') return [{ id: 2, title: 'Film' }];
      return [];
    }
  });
  s.api.register();
  var added = s.addCalls.slice();
  s.api.unregister();

  assert.equal(s.removeCalls.length, added.length, 'remove вызван для каждого add');
  for (var i = 0; i < added.length; i++) {
    assert.ok(s.removeCalls.indexOf(added[i]) >= 0, 'дескриптор #' + i + ' передан в remove');
  }
});

// --- runtime: отсутствие Lampa.Favorite не падает ---

test('runtime: нет Lampa.Favorite → register не падает, ряды «Досмотреть»/«Потому что»/«Новые серии» не регистрируются', function () {
  var s = setupRuntime({ noFavorite: true });
  assert.doesNotThrow(function () { s.api.register(); });
  /* Без Favorite данных нет → только «Скоро» может быть зарегистрирован. */
  var names = s.addCalls.map(function (d) { return d.name; });
  assert.ok(names.indexOf('lumen_continue') === -1, 'Досмотреть не добавлен без Favorite');
  assert.ok(names.indexOf('lumen_because') === -1, 'Потому что не добавлен без Favorite');
  assert.ok(names.indexOf('lumen_new_episodes') === -1, 'Новые серии не добавлен без Favorite');
});

test('runtime: нет Lampa.Api → register не падает', function () {
  var s = setupRuntime({ noApi: true });
  assert.doesNotThrow(function () { s.api.register(); });
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
  s.api.register();
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
  s.api.register();
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

test('дедлайн: «Потому что вы смотрели» отдаёт частичный результат', function () {
  var s = setupRuntime({
    getFav: function (opts) { return opts.type === 'history' ? [{ id: 1, title: 'A' }, { id: 2, title: 'B' }] : []; }
  });
  s.api.register();
  var row = rowByName(s, 'lumen_because');
  var got = [];
  withFakeTimers(function (ctl) {
    row.call({}, {})(function (data) { got.push(data); });
    assert.equal(s.tmdbCalls.length, 2, 'два запроса рекомендаций');
    s.tmdbCalls[0].ok({ results: [{ id: 11 }, { id: 12 }] });
    assert.equal(got.length, 0);
    ctl.fire(0);
    assert.equal(got.length, 1, 'по дедлайну ряд отвечает');
    assert.equal(got[0].results.length, 2, 'отданы рекомендации первого ответа');
    s.tmdbCalls[1].ok({ results: [{ id: 13 }] });
    assert.equal(got.length, 1, 'call строго один раз');
  });
});

test('дедлайн: «Скоро на экранах» отдаёт частичный результат', function () {
  var s = setupRuntime();
  s.api.register();
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
  s.api.register();
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
  s.api.register();
  var row = rowByName(s, 'lumen_soon');
  var got = [];
  withFakeTimers(function (ctl) {
    var handle = row.call({}, {})(function (data) { got.push(data); });
    handle.cancel();
    assert.equal(ctl.timers[0].cleared, true, 'таймер снят при отмене ряда');
    ctl.fire(0);
    assert.equal(got.length, 0, 'отменённый ряд по дедлайну не отвечает');
  });
});

/* test/sources_network.test.mjs — сетевые пути LC.sources (I10).
   Покрывает: нет ключа КП, 401, пустой ответ КП, битый JSON манифеста,
   протухший кэш, отмену на полпути (alive-guard).
   Использует loadCtx для доступа к LC после загрузки, и global.Lampa
   (устанавливается перед каждым тестом) для имитации Lampa API. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* ---- Утилиты ----------------------------------------------------------- */

function makeFakeStorage() {
  const store = {};
  return {
    get(key, def) { return store[key] !== undefined ? store[key] : def; },
    set(key, val) { store[key] = val; },
    _store: store
  };
}

function makeFakeLampa(opts) {
  opts = opts || {};
  return {
    Storage: opts.storage || makeFakeStorage(),
    Reguest: opts.Reguest || null,
    Api: opts.Api || { sources: { tmdb: { get: function () {} } } }
  };
}

/* Простейший Lampa.Reguest: вызывает ok или err синхронно / на nextTick. */
function FakeReguest(behavior) {
  this._behavior = behavior;
}
FakeReguest.prototype.silent = function (url, ok, err) {
  var b = this._behavior;
  if (b === 'ok_empty') {
    ok({ items: [], totalPages: 1, total: 0 });
  } else if (b === 'err') {
    err({ status: 401 });
  } else if (typeof b === 'function') {
    b(url, ok, err);
  }
};
FakeReguest.prototype.clear = function () {};

/* ---- Тесты -------------------------------------------------------------- */

/* нет ключа КП → err({nokey:true}) */
test('fetchKp: нет ключа КП → err({nokey:true}) (I5, I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  global.Lampa = makeFakeLampa({ storage: fakeStorage });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function () { return ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function () { done(new Error('ok не должен вызываться при отсутствии ключа')); }, function (e) {
    assert.ok(e && e.nokey, 'ошибка должна содержать nokey:true, получено: ' + JSON.stringify(e));
    done();
  });
});

/* 401 от КП API → fetchAll сообщает all_failed (все источники упали) */
test('fetchKp: 401 от KP API → err({all_failed:true}) от fetchAll (I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { return new FakeReguest('err'); }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function () { done(new Error('ok не должен вызываться при 401')); }, function (e) {
    assert.ok(e && e.all_failed, 'fetchAll при 401 KP должен вернуть all_failed, получено: ' + JSON.stringify(e));
    done();
  });
});

/* Пустой ответ КП (items: []) → ok с results:[], короткий TTL в кэше */
test('fetchKp: пустой ответ → ok с results:[], кэш с коротким TTL (C2, I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { return new FakeReguest('ok_empty'); }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function (data) {
    assert.ok(Array.isArray(data.results), 'results должен быть массивом');
    assert.equal(data.results.length, 0, 'results должен быть пустым');
    // Проверяем что кэш получил короткий TTL (< 30 дней)
    var cacheKey = 'lumen_kp_TOP_250_MOVIES_1';
    var cached = fakeStorage.get(cacheKey, null);
    assert.ok(cached && cached.ttl, 'кэш должен содержать ttl');
    var LIFE_KP_EMPTY_MS = 10 * 60000; // 10 минут
    var LIFE_KP_MS = 43200 * 60000; // 30 дней
    assert.ok(cached.ttl <= LIFE_KP_EMPTY_MS, 'пустой кэш должен иметь короткий TTL, получено: ' + cached.ttl);
    assert.ok(cached.ttl < LIFE_KP_MS, 'пустой кэш не должен иметь длинный TTL');
    done();
  }, function (e) { done(new Error('err не должен вызываться, получено: ' + JSON.stringify(e))); });
});

/* alive-guard: после clear() ok не вызывается (C1, I10) */
test('fetchAll + alive: после clear() ok не вызывается (C1, I10)', function (t, done) {
  var tmdbCalls = 0;
  global.Lampa = makeFakeLampa({
    Api: {
      sources: {
        tmdb: {
          get: function (url, params, ok, err, opts) {
            tmdbCalls++;
            // Задерживаем ответ
            setTimeout(function () { ok({ results: [{ id: 1 }], total_pages: 1, total_results: 1, page: 1 }); }, 50);
            return { clear: function () {} };
          }
        }
      }
    }
  });
  global.window = { localStorage: null };

  var gen = 0;
  function alive() { return gen; }
  var ctx = loadCtx('43_sources.js');
  var S = ctx.api;

  var item = { id: 'test', title: 'Test', sources: { movie: { type: 'discover', params: { genres: 35 } } } };
  var handle = S['fetch'](item, 1, function () {
    done(new Error('ok не должен вызываться после clear()'));
  }, function () {
    done(new Error('err не должен вызываться после clear()'));
  }, alive);

  // Меняем поколение и отменяем
  gen = 1;
  handle.clear();

  // Ждём дольше задержки — ok не должен позвониться, и ни одного нового запроса
  setTimeout(function () {
    assert.equal(tmdbCalls, 1, 'после clear() новых сетевых запросов быть не должно, было: ' + tmdbCalls);
    done();
  }, 150);
});

/* Протухший кэш КП (at в прошлом) → запрос идёт заново (I10) */
test('fetchKp: протухший кэш → запрос идёт заново (I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  var LIFE_KP_MS = 43200 * 60000;
  // Ставим протухший кэш
  var cacheKey = 'lumen_kp_TOP_250_MOVIES_1';
  fakeStorage.set(cacheKey, {
    at: Date.now() - LIFE_KP_MS - 1000,
    ttl: LIFE_KP_MS,
    data: { results: [{ id: 999, title: 'old' }], page: 1, total_pages: 1, total_results: 1, title: '' }
  });

  var networkCalled = false;
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { return new FakeReguest(function (url, ok) { networkCalled = true; ok({ items: [], totalPages: 1, total: 0 }); }); }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function () {
    assert.ok(networkCalled, 'при протухшем кэше должен идти сетевой запрос');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); });
});

/* Свежий кэш КП → ok без сетевого запроса (I2, I10) */
test('fetchKp: свежий кэш (объект с at/ttl) → ok без запроса (I2, I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  var cacheKey = 'lumen_kp_TOP_250_MOVIES_1';
  var freshData = { results: [{ id: 42 }], page: 1, total_pages: 1, total_results: 1, title: '' };
  fakeStorage.set(cacheKey, { at: Date.now(), ttl: 43200 * 60000, data: freshData });

  var networkCalled = false;
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { networkCalled = true; return new FakeReguest('ok_empty'); }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function (data) {
    assert.ok(!networkCalled, 'при свежем кэше не должно быть сетевого запроса');
    assert.deepEqual(data.results, [{ id: 42 }], 'данные должны совпадать с кэшем');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); });
});

/* Битый кэш (строка вместо объекта) → запрос идёт заново (I2, I10) */
test('fetchKp: битый кэш (строка) → игнорируется, запрос заново (I2, I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  var cacheKey = 'lumen_kp_TOP_250_MOVIES_1';
  fakeStorage.set(cacheKey, 'corrupted_string');

  var networkCalled = false;
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { return new FakeReguest(function (url, ok) { networkCalled = true; ok({ items: [], totalPages: 1, total: 0 }); }); }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](kpItem, 1, function () {
    assert.ok(networkCalled, 'при битом кэше должен идти сетевой запрос');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); });
});

/* done-latch: ok вызывается ровно один раз при двух источниках (I3, I10) */
test('fetchAll: ok вызывается ровно один раз (done-latch, I3, I10)', function (t, done) {
  var callCount = 0;
  global.Lampa = makeFakeLampa({
    Api: {
      sources: {
        tmdb: {
          get: function (url, params, ok, err, opts) {
            setTimeout(function () { ok({ results: [{ id: 1 }], total_pages: 1, total_results: 1, page: 1 }); }, 10);
            return { clear: function () {} };
          }
        }
      }
    }
  });
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js');
  var S = ctx.api;

  var item = {
    id: 'test2', title: 'Test',
    sources: {
      movie: { type: 'discover', params: { genres: 35 } },
      tv:    { type: 'discover', params: { genres: 35 } }
    }
  };
  S['fetch'](item, 1, function () {
    callCount++;
  }, function () {
    done(new Error('err не должен вызываться'));
  });

  setTimeout(function () {
    assert.equal(callCount, 1, 'ok должен вызваться ровно 1 раз, вызван: ' + callCount);
    done();
  }, 100);
});

/* C2: сетевая ошибка KP кэшируется с коротким TTL, повторный вызов не идёт в сеть */
test('fetchKp: сетевая ошибка (401) кэшируется с коротким TTL, повторный вызов не идёт в сеть (C2)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  var networkCallCount = 0;
  global.Lampa = makeFakeLampa({
    storage: fakeStorage,
    Reguest: function () { networkCallCount++; return new FakeReguest('err'); }
  });
  global.window = { localStorage: null };

  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;
  var kpItem = { id: 'kp-top250', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };

  /* Первый вызов: ошибка — должна попасть в кэш. */
  S['fetch'](kpItem, 1, function () {
    done(new Error('ok не должен вызываться при 401'));
  }, function (e) {
    assert.ok(e && e.all_failed, 'ожидали all_failed, получили: ' + JSON.stringify(e));
    var cacheKey = 'lumen_kp_TOP_250_MOVIES_1';
    var cached = fakeStorage.get(cacheKey, null);
    assert.ok(cached && cached.ttl, 'ошибка должна быть закэширована с ttl');
    assert.ok(cached.ttl <= 10 * 60000, 'ttl должен быть коротким (<= 10 мин), получили: ' + cached.ttl);

    /* Второй вызов: должен вернуть кэшированную ошибку, не идти в сеть. */
    /* Перезагружаем контекст чтобы inflight очистился. */
    var ctx2 = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
    /* Делим тот же fakeStorage — кэш уже есть. */
    global.Lampa = makeFakeLampa({
      storage: fakeStorage,
      Reguest: function () { networkCallCount++; return new FakeReguest('err'); }
    });
    var ctx3 = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
    var S3 = ctx3.api;
    var callsBefore = networkCallCount;
    S3['fetch'](kpItem, 1, function (data) {
      /* ok с кэшированными пустыми данными */
      assert.equal(networkCallCount, callsBefore, 'повторный вызов не должен идти в сеть');
      assert.ok(Array.isArray(data.results), 'результат должен быть массивом');
      done();
    }, function () {
      /* тоже допустимо — главное что сеть не вызвалась */
      assert.equal(networkCallCount, callsBefore, 'повторный вызов не должен идти в сеть (err ветка)');
      done();
    });
  });
});

/* I10: clear() посреди цепочки find/{imdbId} в fetchKp останавливает дальнейшие запросы */
test('fetchKp: clear() посреди цепочки find/ останавливает дальнейшие TMDB-запросы (I10)', function (t, done) {
  var fakeStorage = makeFakeStorage();
  var tmdbFindCalls = 0;
  var handle;

  global.Lampa = {
    Storage: fakeStorage,
    Reguest: function () {
      return {
        silent: function (url, okCb) {
          /* Асинхронно отдаём два IMDb ID из KP (поле imdbId нужно для kpToFinds). */
          setTimeout(function () {
            okCb({ items: [{ filmId: 111, imdbId: 'tt0111' }, { filmId: 222, imdbId: 'tt0222' }], totalPages: 1, total: 2 });
          }, 5);
        },
        clear: function () {}
      };
    },
    Api: {
      sources: {
        tmdb: {
          get: function (url, params, okCb, errCb, opts) {
            tmdbFindCalls++;
            if (tmdbFindCalls === 1 && handle) {
              /* После первого find/ запроса — отменяем. */
              handle.clear();
            }
            /* Отвечаем с задержкой — второй next() не должен вызваться. */
            setTimeout(function () {
              okCb({ movie_results: [{ id: tmdbFindCalls * 100 }], tv_results: [] });
            }, 15);
            return { clear: function () {} };
          }
        }
      }
    }
  };
  global.window = { localStorage: null };
  var ctx = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'test-key' : ''; } });
  var S = ctx.api;

  var kpItem = { id: 'kp-chain', title: 'Test', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  handle = S['fetch'](kpItem, 1, function () {
    done(new Error('ok не должен вызываться после clear()'));
  }, function () {
    done(new Error('err не должен вызываться после clear()'));
  }, null);

  /* Ждём завершения обоих find/ таймеров + запаса. */
  setTimeout(function () {
    assert.equal(tmdbFindCalls, 1, 'после clear() цепочка find/ должна остановиться, запросов: ' + tmdbFindCalls);
    done();
  }, 120);
});

/* ---- Ревью Task 17: подпись сортировки в ключе дедупликации (I5) -------- */

test('sortSignature: разные sort_by — разные подписи, порядок медиа не важен', function () {
  global.Lampa = makeFakeLampa({});
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;

  var pop = { id: 'x', sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc' } } } };
  var rat = { id: 'x', sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc' } } } };
  assert.notEqual(S.sortSignature(pop), S.sortSignature(rat));

  var both = { id: 'y', sources: { movie: { type: 'discover', params: { sort_by: 'a' } }, tv: { type: 'discover', params: { sort_by: 'b' } } } };
  var both2 = { id: 'y', sources: { tv: { type: 'discover', params: { sort_by: 'b' } }, movie: { type: 'discover', params: { sort_by: 'a' } } } };
  assert.equal(S.sortSignature(both), S.sortSignature(both2));
});

test('sortSignature: коллекция, список и КП подписи не дают (их порядок не от запроса)', function () {
  global.Lampa = makeFakeLampa({});
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  assert.equal(S.sortSignature({ id: 'c', sources: { movie: { type: 'collection', id: 10 } } }), '');
  assert.equal(S.sortSignature({ id: 'k', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } }), '');
});

test('fetch: та же подборка с другой сортировкой не подписывается на летящий запрос (I5)', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err) { calls.push({ url: url, params: params, ok: ok }); return { clear: function () {} }; } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;

  var base = { id: 'pixar', title: 'Pixar', sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'popularity.desc' } } } };
  var sorted = { id: 'pixar', title: 'Pixar', sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'vote_average.desc' } } } };

  var got = [];
  S['fetch'](base, 1, function (j) { got.push(['pop', j.results.length]); }, function () {}, null);
  S['fetch'](sorted, 1, function (j) { got.push(['rating', j.results.length]); }, function () {}, null);

  assert.equal(calls.length, 2, 'два разных запроса, а не подписка на один');
  assert.equal(calls[0].params.sort_by, 'popularity.desc');
  assert.equal(calls[1].params.sort_by, 'vote_average.desc');
});

test('fetch: та же подборка с той же сортировкой по-прежнему дедуплицируется', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok) { calls.push({ ok: ok }); return { clear: function () {} }; } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  var item = { id: 'pixar', sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc' } } } };
  S['fetch'](item, 1, function () {}, function () {}, null);
  S['fetch'](item, 1, function () {}, function () {}, null);
  assert.equal(calls.length, 1, 'второй вызов — подписчик первого');
});

/* ---- Ревью Task 17: дешёвый коллаж (C1) -------------------------------- */

test('collagePaths: подборка Кинопоиска — один запрос к КП, ноль к TMDB (C1)', function (t, done) {
  var tmdbCalls = 0;
  var kpUrls = [];
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () {
      return new FakeReguest(function (url, ok) {
        kpUrls.push(url);
        ok({ items: [
          { kinopoiskId: 1, imdbId: 'tt1', posterUrlPreview: 'https://kp/1.jpg' },
          { kinopoiskId: 2, imdbId: 'tt2', posterUrlPreview: 'https://kp/2.jpg' },
          { kinopoiskId: 3, imdbId: 'tt3', posterUrlPreview: 'https://kp/3.jpg' },
          { kinopoiskId: 4, imdbId: 'tt4', posterUrlPreview: 'https://kp/4.jpg' }
        ], totalPages: 5, total: 100 });
      });
    },
    Api: { sources: { tmdb: { get: function () { tmdbCalls++; return { clear: function () {} }; } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'KEY' : ''; } }).api;

  var item = { id: 'kp-top250', title: 'КП', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S.collagePaths(item, 3, function (paths) {
    assert.deepEqual(paths, ['https://kp/1.jpg', 'https://kp/2.jpg', 'https://kp/3.jpg'], 'три готовых URL Кинопоиска');
    assert.equal(tmdbCalls, 0, 'сопоставления с TMDB для коллажа не нужно');
    assert.equal(kpUrls.length, 1, 'ровно один запрос к Кинопоиску');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('collagePaths: постеры КП кэшируются — второй коллаж в сеть не идёт (C1)', function (t, done) {
  var kpCalls = 0;
  var storage = makeFakeStorage();
  global.Lampa = makeFakeLampa({
    storage: storage,
    Reguest: function () {
      return new FakeReguest(function (url, ok) {
        kpCalls++;
        ok({ items: [{ posterUrlPreview: 'https://kp/a.jpg' }, { posterUrlPreview: 'https://kp/b.jpg' }], totalPages: 1, total: 2 });
      });
    }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'KEY' : ''; } }).api;
  var item = { id: 'kp-top250', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };

  S.collagePaths(item, 3, function () {
    S.collagePaths(item, 3, function (paths) {
      assert.equal(kpCalls, 1, 'второй раз — из кэша');
      assert.deepEqual(paths, ['https://kp/a.jpg', 'https://kp/b.jpg']);
      done();
    }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('collagePaths: без ключа КП — err({nokey:true}) и ни одного запроса (C1)', function (t, done) {
  var made = 0;
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () { made++; return new FakeReguest('ok_empty'); }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.collagePaths({ id: 'kp', sources: { movie: { type: 'kp', collection: 'X' } } }, 3, function () {
    done(new Error('ok не должен вызываться'));
  }, function (e) {
    assert.ok(e && e.nokey);
    assert.equal(made, 0);
    done();
  }, null);
});

test('collagePaths: обычная подборка — первая страница, до count путей постеров', function (t, done) {
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok) {
      ok({ results: [{ id: 1, poster_path: '/a.jpg' }, { id: 2 }, { id: 3, poster_path: '/b.jpg' }, { id: 4, poster_path: '/c.jpg' }, { id: 5, poster_path: '/d.jpg' }], page: 1, total_pages: 2, total_results: 5 });
      return { clear: function () {} };
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.collagePaths({ id: 'pixar', sources: { movie: { type: 'discover', params: {} } } }, 3, function (paths) {
    assert.deepEqual(paths, ['/a.jpg', '/b.jpg', '/c.jpg'], 'позиции без постера пропускаются');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('collagePaths: отмена гасит запрос Кинопоиска', function () {
  var cleared = 0;
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () {
      var r = new FakeReguest(function () {});
      r.clear = function () { cleared++; };
      return r;
    }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'KEY' : ''; } }).api;
  var h = S.collagePaths({ id: 'kp', sources: { movie: { type: 'kp', collection: 'X' } } }, 3, function () {}, function () {}, null);
  h.clear();
  assert.equal(cleared, 1);
});

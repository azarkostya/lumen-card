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

/* ---- Ревью Task 17: дешёвая картинка плитки (C1) ----------------------- */
/* Task 41: коллаж из трёх постеров заменён одним кадром, и вместо
   collagePaths(item, count, …) источники отдают bannerPath(item, …) — одну
   строку. Проверки те же по смыслу: подборка Кинопоиска стоит один запрос к
   КП и ноль к TMDB, кэш работает, отмена гасит запрос. */

test('bannerPath: подборка Кинопоиска — один запрос к КП, ноль к TMDB (C1)', function (t, done) {
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
  S.bannerPath(item, function (path) {
    /* Кадров в ответе films/collections нет — приходит первый постер КП. */
    assert.equal(path, 'https://kp/1.jpg', 'готовый URL Кинопоиска');
    assert.equal(tmdbCalls, 0, 'сопоставления с TMDB для плитки не нужно');
    assert.equal(kpUrls.length, 1, 'ровно один запрос к Кинопоиску');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('bannerPath: картинка КП кэшируется — вторая плитка в сеть не идёт (C1)', function (t, done) {
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

  S.bannerPath(item, function () {
    S.bannerPath(item, function (path) {
      assert.equal(kpCalls, 1, 'второй раз — из кэша');
      assert.equal(path, 'https://kp/a.jpg');
      done();
    }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('bannerPath: без ключа КП — err({nokey:true}) и ни одного запроса (C1)', function (t, done) {
  var made = 0;
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () { made++; return new FakeReguest('ok_empty'); }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.bannerPath({ id: 'kp', sources: { movie: { type: 'kp', collection: 'X' } } }, function () {
    done(new Error('ok не должен вызываться'));
  }, function (e) {
    assert.ok(e && e.nokey);
    assert.equal(made, 0);
    done();
  }, null);
});

/* Task 41: плитка показывает КАДР, а не постер — берётся backdrop_path
   первой карточки первой страницы, у которой он есть. */
test('bannerPath: обычная подборка — кадр первой карточки с backdrop_path', function (t, done) {
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok) {
      ok({ results: [{ id: 1, poster_path: '/a.jpg' }, { id: 2, poster_path: '/b.jpg', backdrop_path: '/bd2.jpg' }, { id: 3, backdrop_path: '/bd3.jpg' }], page: 1, total_pages: 2, total_results: 3 });
      return { clear: function () {} };
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.bannerPath({ id: 'pixar', sources: { movie: { type: 'discover', params: {} } } }, function (path) {
    assert.equal(path, '/bd2.jpg', 'карточка без кадра пропускается, постеры не мешают');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('bannerPath: ни одного кадра на странице — фолбэк на постер', function (t, done) {
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok) {
      ok({ results: [{ id: 1 }, { id: 2, poster_path: '/p2.jpg' }, { id: 3, poster_path: '/p3.jpg' }], page: 1, total_pages: 1, total_results: 3 });
      return { clear: function () {} };
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.bannerPath({ id: 'pixar', sources: { movie: { type: 'discover', params: {} } } }, function (path) {
    assert.equal(path, '/p2.jpg', 'первый постер страницы — плитка обрежет его по object-position');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('bannerPath: пустая страница — пустая строка, без ошибки', function (t, done) {
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok) {
      ok({ results: [], page: 1, total_pages: 1, total_results: 0 });
      return { clear: function () {} };
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.bannerPath({ id: 'pixar', sources: { movie: { type: 'discover', params: {} } } }, function (path) {
    assert.equal(path, '');
    done();
  }, function (e) { done(new Error('err: ' + JSON.stringify(e))); }, null);
});

test('bannerPath: отмена гасит запрос Кинопоиска', function () {
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
  var h = S.bannerPath({ id: 'kp', sources: { movie: { type: 'kp', collection: 'X' } } }, function () {}, function () {}, null);
  h.clear();
  assert.equal(cleared, 1);
});

/* Important 3 (fix-раунд итогового ревью фазы 2): дескриптор подписки
   действителен только для СВОЕЙ записи в inflight.
   Владелец запроса всегда получал mySubId = 1, а clear() не проверял
   идентичность записи. Запись уходит из inflight при завершении, но
   дескриптор у вызывающего живёт дальше (хаб и сетка чистят все свои
   дескрипторы разом — при смене чипа, stop() и destroy()). Если к этому
   моменту создана НОВАЯ запись с тем же ключом, поздний clear() старого
   дескриптора удалял живого подписчика и звал старый cancelRequest с
   delete inflight[key] — новый запрос завершался в пустоту: плитка
   навсегда без картинки, сетка с вечным лоадером. */
test('fetchAll: поздний clear() завершённого дескриптора не убивает новый запрос с тем же ключом (Important 3)', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err) {
      var h = { url: url, ok: ok, err: err, cleared: false };
      h.clear = function () { h.cleared = true; };
      calls.push(h);
      return h;
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  var item = { id: 'dup', title: 'Dup', sources: { movie: { type: 'discover', params: {} } } };

  /* Первый запрос завершается — его запись уходит из inflight. */
  var first = 0;
  var h1 = S['fetch'](item, 1, function () { first++; }, function () {}, null);
  calls[0].ok({ results: [{ id: 1 }], page: 1, total_pages: 1, total_results: 1 });
  assert.equal(first, 1, 'первый подписчик получил ответ');

  /* Новый запрос по тому же ключу. */
  var second = 0;
  var h2 = S['fetch'](item, 1, function () { second++; }, function () {}, null);
  assert.equal(calls.length, 2, 'второй запрос действительно ушёл в сеть');

  /* Поздняя уборка старого дескриптора не должна трогать новый запрос. */
  h1.clear();
  assert.equal(calls[1].cleared, false, 'чужой сетевой запрос не отменён');

  calls[1].ok({ results: [{ id: 2 }], page: 1, total_pages: 1, total_results: 1 });
  assert.equal(second, 1, 'новый подписчик обязан получить свой ответ');

  /* Свой clear() по-прежнему работает. */
  h2.clear();
});

test('fetchAll: clear() второго подписчика не гасит запрос, пока жив первый (Important 3)', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err) {
      var h = { url: url, ok: ok, err: err, cleared: false };
      h.clear = function () { h.cleared = true; };
      calls.push(h);
      return h;
    } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  var item = { id: 'shared', title: 'Shared', sources: { movie: { type: 'discover', params: {} } } };

  var a = 0, b = 0;
  var hA = S['fetch'](item, 1, function () { a++; }, function () {}, null);
  var hB = S['fetch'](item, 1, function () { b++; }, function () {}, null);
  assert.equal(calls.length, 1, 'второй вызов подписался на летящий запрос');

  hB.clear();
  assert.equal(calls[0].cleared, false, 'первый подписчик ещё ждёт');
  calls[0].ok({ results: [{ id: 1 }], page: 1, total_pages: 1, total_results: 1 });
  assert.equal(a, 1);
  assert.equal(b, 0, 'отписавшийся ответа не получает');

  /* Повторный clear() отписавшегося ничего не ломает. */
  hB.clear();
  hA.clear();
});

/* Дедлайн подборки: movie ответил, tv молчит — по истечении FETCH_TIMEOUT
   подписчик получает частичный результат (partial:true), а опоздавший ответ
   второго ok не даёт. Таймеры — ручные: тест сам решает, когда дедлайн. */
test('fetchAll: дедлайн отдаёт частичный результат, помеченный partial', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err) {
      var h = { url: url, ok: ok, err: err, cleared: false };
      h.clear = function () { h.cleared = true; };
      calls.push(h);
      return h;
    } } } }
  });
  global.window = { localStorage: null };

  var realSet = globalThis.setTimeout;
  var realClear = globalThis.clearTimeout;
  var timers = [];
  globalThis.setTimeout = function (cb, ms) { timers.push({ cb: cb, ms: ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = function (id) { if (timers[id - 1]) timers[id - 1].cleared = true; };

  try {
    var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
    var item = {
      id: 'both', title: 'Both',
      sources: { movie: { type: 'discover', params: {} }, tv: { type: 'discover', params: {} } }
    };
    var got = [];
    S['fetch'](item, 1, function (r) { got.push(r); }, function () { got.push('err'); }, null);
    assert.equal(calls.length, 2, 'два источника — два запроса');
    assert.equal(timers.length, 1, 'поставлен один дедлайн на всю подборку');
    assert.equal(timers[0].ms, 15000, 'дедлайн — FETCH_TIMEOUT');

    calls[0].ok({ results: [{ id: 1 }], page: 1, total_pages: 1, total_results: 1 });
    assert.equal(got.length, 0, 'ответил один источник из двух — ещё ждём');

    timers[0].cb();
    assert.equal(got.length, 1, 'по дедлайну подписчик получил результат');
    assert.equal(got[0].partial, true, 'результат помечен как частичный');
    assert.equal(got[0].results.length, 1, 'в нём то, что успело прийти');

    calls[1].ok({ results: [{ id: 2 }], page: 1, total_pages: 1, total_results: 1 });
    assert.equal(got.length, 1, 'опоздавший ответ второго ok не даёт');
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
});

test('fetchAll: оба источника ответили до дедлайна — таймер снят, partial нет', function () {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err) {
      var h = { url: url, ok: ok, err: err, cleared: false };
      h.clear = function () { h.cleared = true; };
      calls.push(h);
      return h;
    } } } }
  });
  global.window = { localStorage: null };

  var realSet = globalThis.setTimeout;
  var realClear = globalThis.clearTimeout;
  var timers = [];
  globalThis.setTimeout = function (cb, ms) { timers.push({ cb: cb, ms: ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = function (id) { if (timers[id - 1]) timers[id - 1].cleared = true; };

  try {
    var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
    var item = {
      id: 'both2', title: 'Both2',
      sources: { movie: { type: 'discover', params: {} }, tv: { type: 'discover', params: {} } }
    };
    var got = [];
    S['fetch'](item, 1, function (r) { got.push(r); }, function () { got.push('err'); }, null);
    calls[0].ok({ results: [{ id: 1 }], page: 1, total_pages: 1, total_results: 1 });
    calls[1].ok({ results: [{ id: 2 }], page: 1, total_pages: 1, total_results: 1 });
    assert.equal(got.length, 1);
    assert.equal(got[0].partial, undefined, 'полный результат не помечается partial');
    assert.equal(got[0].results.length, 2);
    assert.equal(timers[0].cleared, true, 'дедлайн снят');
    timers[0].cb();
    assert.equal(got.length, 1, 'снятый дедлайн второго ok не даёт');
  } finally {
    globalThis.setTimeout = realSet;
    globalThis.clearTimeout = realClear;
  }
});

/* ====================================================================== */
/* Task 74: источник постера карточки — сетевые пути.                     */
/* ====================================================================== */

/* Поднимает LC.sources с записывающей заглушкой Lampa.Api.sources.tmdb.get
   и заданным режимом настройки. Таймеры подменены: дедлайн подмены — 6 с,
   и без подмены каждый такой тест держал бы прогон шесть секунд. */
function setupPosters(mode) {
  var calls = [];
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function (url, params, ok, err, cache) {
      calls.push({ url: url, params: params, ok: ok, err: err, cache: cache });
    } } } }
  });
  global.window = { localStorage: null };
  var realSet = globalThis.setTimeout;
  var realClear = globalThis.clearTimeout;
  var timers = [];
  globalThis.setTimeout = function (cb, ms) { timers.push({ cb: cb, ms: ms, cleared: false }); return timers.length; };
  globalThis.clearTimeout = function (id) { if (timers[id - 1]) timers[id - 1].cleared = true; };
  var S = loadCtx('43_sources.js', {
    pref: function () { return ''; },
    postersMode: function () { return mode; }
  }).api;
  return {
    S: S, calls: calls, timers: timers,
    restore: function () { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
  };
}

var ITEM_MOVIE = { id: 'row', title: 'Ряд', sources: { movie: { type: 'discover', params: { genres: 35 } } } };

test('Task 74: режим по умолчанию — ни одного запроса, ответ синхронный', function () {
  var s = setupPosters('lampa');
  try {
    var cards = [{ id: 1, title: 'A', poster_path: '/a.jpg' }];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, null);
    assert.deepEqual(done, [0], 'done обязан быть позван ровно один раз и синхронно');
    assert.equal(s.calls.length, 0, 'режим по умолчанию не стоит ни одного запроса');
    assert.equal(s.timers.length, 0, 'и ни одного таймера');
    assert.equal(cards[0].poster_path, '/a.jpg');
  } finally { s.restore(); }
});

test('Task 74: пустой список карточек — запросов нет ни в одном режиме', function () {
  for (var i = 0; i < 2; i++) {
    var s = setupPosters(i ? 'clean' : 'original');
    try {
      var done = [];
      s.S.posters(ITEM_MOVIE, [], function (n) { done.push(n); }, null);
      assert.deepEqual(done, [0]);
      assert.equal(s.calls.length, 0);
    } finally { s.restore(); }
  }
});

test('Task 74: «оригинал» — один запрос на медиа, язык через langs, сопоставление по id', function () {
  var s = setupPosters('original');
  try {
    var cards = [
      { id: 1, title: 'A', poster_path: '/ru1.jpg' },
      { id: 2, title: 'B', poster_path: '/ru2.jpg' }
    ];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, null);

    assert.equal(s.calls.length, 1, 'у подборки одно медиа — один запрос');
    assert.equal(s.calls[0].url, 'discover/movie');
    /* Язык Lampa подставляет сама из Storage, а переопределяет его ключ
       langs (app.min.js:19656-19663). Свой language в адресе оказался бы
       вторым, поэтому его тут быть не должно. */
    assert.equal(s.calls[0].params.langs, 'en');
    assert.equal(s.calls[0].params.genres, 35, 'параметры подборки сохранены');
    assert.equal(s.calls[0].params.page, 1);
    assert.equal(s.calls[0].url.indexOf('language'), -1);
    assert.equal(s.calls[0].cache.life, 720, 'кэш тот же, что у самой подборки');

    s.calls[0].ok({ results: [{ id: 1, title: 'A', poster_path: '/en1.jpg' }, { id: 3, title: 'C', poster_path: '/en3.jpg' }] });
    assert.deepEqual(done, [1], 'подменена одна карточка — та, что нашлась в английском списке');
    assert.equal(cards[0].poster_path, '/en1.jpg');
    assert.equal(cards[1].poster_path, '/ru2.jpg', 'карточки без пары остаются с постером Lampa');
  } finally { s.restore(); }
});

/* Ф3 п.1 (ревью фикс-раундов): сетка подборки зовёт подмену на каждой
   странице, а английский список всегда просился первой — со второй
   страницы сопоставлять было не с чем, и одна сетка показывала два набора
   обложек. */
test('Постеры: «английские» на странице 2 спрашивают страницу 2', function () {
  var s = setupPosters('original');
  try {
    var item = { id: 'mix', title: 'Смесь', sources: {
      movie: { type: 'discover', params: { genres: 35 } },
      tv: { type: 'discover', params: { networks: 213 } }
    } };
    var cards = [{ id: 21, title: 'A', poster_path: '/ru21.jpg' }, { id: 22, name: 'B', poster_path: '/ru22.jpg' }];
    var done = [];
    s.S.posters(item, cards, function (n) { done.push(n); }, null, 2);
    assert.equal(s.calls.length, 2);
    assert.equal(s.calls[0].params.page, 2, 'фильмы — та же страница, что пришла в сетку');
    assert.equal(s.calls[1].params.page, 2, 'сериалы — тоже');
    s.calls[0].ok({ results: [{ id: 21, title: 'A', poster_path: '/en21.jpg' }] });
    s.calls[1].ok({ results: [{ id: 22, name: 'B', poster_path: '/en22.jpg' }] });
    assert.deepEqual(done, [2]);
    assert.equal(cards[0].poster_path, '/en21.jpg');
    assert.equal(cards[1].poster_path, '/en22.jpg');
  } finally { s.restore(); }
});

test('Task 74: «оригинал» — источник Кинопоиска пропускается, списка на другом языке у него нет', function () {
  var s = setupPosters('original');
  try {
    var kp = { id: 'kp', title: 'КП', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
    var done = [];
    s.S.posters(kp, [{ id: 1, title: 'A', poster_path: '/ru.jpg' }], function (n) { done.push(n); }, null);
    assert.deepEqual(done, [0]);
    assert.equal(s.calls.length, 0);
  } finally { s.restore(); }
});

test('Task 74: «оригинал» у ряда без подборки (адвент) — запросов нет, ответ один', function () {
  var s = setupPosters('original');
  try {
    var done = [];
    s.S.posters(null, [{ id: 1, title: 'A', poster_path: '/ru.jpg' }], function (n) { done.push(n); }, null);
    assert.deepEqual(done, [0]);
    assert.equal(s.calls.length, 0);
  } finally { s.restore(); }
});

test('Task 74: «без надписей» — запрос на карточку, только постеры без языка, кэш 30 дней', function () {
  var s = setupPosters('clean');
  try {
    var cards = [
      { id: 7, title: 'Фильм', poster_path: '/ru.jpg' },
      { id: 8, name: 'Сериал', poster_path: '/ru-tv.jpg' }
    ];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, null);

    assert.equal(s.calls.length, 2, 'по запросу на карточку');
    assert.equal(s.calls[0].url, 'movie/7/images');
    assert.equal(s.calls[1].url, 'tv/8/images', 'медиа-тип берётся из самой карточки');
    /* include_image_language=null отдаёт ТОЛЬКО постеры без языка и
       отменяет фильтр по языку, который Lampa дописывает сама (замер
       2026-09-23: 147 постеров и 17.5 КБ на фильм против 259 и 20.2 КБ у
       набора ru,null). Параметр уходит через filter — так Lampa кладёт в
       адрес произвольные ключи (app.min.js:19675-19678). */
    assert.deepEqual(s.calls[0].params, { filter: { include_image_language: 'null' } });
    assert.equal(s.calls[0].cache.life, 43200, 'кэш на 30 дней: состав постеров меняется раз в месяцы');

    s.calls[0].ok({ posters: [{ file_path: '/clean.jpg', iso_639_1: null, aspect_ratio: 0.667 }] });
    assert.deepEqual(done, [], 'пока не ответили все — ряд не отпускаем');
    s.calls[1].ok({ posters: [{ file_path: '/bad.jpg', iso_639_1: null, aspect_ratio: 0.486 }] });

    assert.deepEqual(done, [1]);
    assert.equal(cards[0].poster_path, '/clean.jpg');
    assert.equal(cards[1].poster_path, '/ru-tv.jpg', 'постер негодной пропорции не подставляется');
    assert.equal(s.timers[0].cleared, true, 'все ответили — дедлайн снят');
  } finally { s.restore(); }
});

test('Task 74: «без надписей» — ошибки запросов ряд не задерживают', function () {
  var s = setupPosters('clean');
  try {
    var cards = [{ id: 1, title: 'A', poster_path: '/a.jpg' }, { id: 2, title: 'B', poster_path: '/b.jpg' }];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, null);
    s.calls[0].err({ status: 404 });
    s.calls[1].ok({ posters: [{ file_path: '/c.jpg', iso_639_1: null, aspect_ratio: 0.667 }] });
    assert.deepEqual(done, [1]);
    assert.equal(cards[0].poster_path, '/a.jpg');
    assert.equal(cards[1].poster_path, '/c.jpg');
  } finally { s.restore(); }
});

/* Контракт ряда: ровно ОДИН ответ при любом исходе (шапка src/44_rows.js).
   Молчащий запрос закрывает дедлайн, и то, что не успело, остаётся с
   постером Lampa; поздний ответ второго ничего не добавляет. */
test('Task 74: молчащий запрос закрывает дедлайн, done зовётся ровно один раз', function () {
  var s = setupPosters('clean');
  try {
    var cards = [{ id: 1, title: 'A', poster_path: '/a.jpg' }, { id: 2, title: 'B', poster_path: '/b.jpg' }];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, null);
    s.calls[0].ok({ posters: [{ file_path: '/c.jpg', iso_639_1: null, aspect_ratio: 0.667 }] });
    assert.deepEqual(done, [], 'второй ещё молчит');
    assert.equal(s.timers[0].ms, 6000, 'дедлайн подмены — 6 секунд');
    s.timers[0].cb();
    assert.deepEqual(done, [1], 'дедлайн отпустил ряд с тем, что успело прийти');
    s.calls[1].ok({ posters: [{ file_path: '/late.jpg', iso_639_1: null, aspect_ratio: 0.667 }] });
    assert.deepEqual(done, [1], 'поздний ответ второго done не дублирует');
  } finally { s.restore(); }
});

/* alive-guard: поколение сменилось (ушли с главной) — поздний ответ уже
   ничего не пишет в карточки. */
test('Task 74: сменилось поколение — поздний ответ карточку не трогает', function () {
  var s = setupPosters('clean');
  try {
    var gen = 0;
    var cards = [{ id: 1, title: 'A', poster_path: '/a.jpg' }];
    var done = [];
    s.S.posters(ITEM_MOVIE, cards, function (n) { done.push(n); }, function () { return gen; });
    gen++;
    s.calls[0].ok({ posters: [{ file_path: '/c.jpg', iso_639_1: null, aspect_ratio: 0.667 }] });
    assert.equal(cards[0].poster_path, '/a.jpg');
    assert.deepEqual(done, [0], 'ответ Lampa всё равно один — контракт ряда важнее');
  } finally { s.restore(); }
});

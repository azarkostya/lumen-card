/* test/sources_network.test.mjs — сетевые пути LC.sources (I10).
   Покрывает: нет ключа КП, 401, пустой ответ КП, битый JSON манифеста,
   протухший кэш, отмену на полпути (alive-guard).
   Использует loadCtx для доступа к LC после загрузки, и global.Lampa
   (устанавливается перед каждым тестом) для имитации Lampa API. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* Заглушки Lampa.Api.sources.tmdb.get здесь ничего не возвращают — как
   настоящая Lampa (get$c, vendor/lampa/app.min.js:19693-19737). Ф3,
   довесок Д2 (ревью фикс-раундов): прежние отдавали { clear }, то есть
   отмену, которой у Lampa нет; отменяемый дескриптор есть только у
   Lampa.Reguest (Кинопоиск). */

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
    Api: { sources: { tmdb: { get: function (url, params, ok, err) { calls.push({ url: url, params: params, ok: ok }); } } } }
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
    Api: { sources: { tmdb: { get: function (url, params, ok) { calls.push({ ok: ok }); } } } }
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
    Api: { sources: { tmdb: { get: function () { tmdbCalls++; } } } }
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
/* Постеры: источник постера карточки — сетевые пути.                     */
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

test('Постеры: режим по умолчанию — ни одного запроса, ответ синхронный', function () {
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

test('Постеры: пустой список карточек — запросов нет ни в одном режиме', function () {
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

test('Постеры: «английские» — один запрос на медиа, язык через langs, сопоставление по id', function () {
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

test('Постеры: «английские» — источник Кинопоиска пропускается, списка на другом языке у него нет', function () {
  var s = setupPosters('original');
  try {
    var kp = { id: 'kp', title: 'КП', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
    var done = [];
    s.S.posters(kp, [{ id: 1, title: 'A', poster_path: '/ru.jpg' }], function (n) { done.push(n); }, null);
    assert.deepEqual(done, [0]);
    assert.equal(s.calls.length, 0);
  } finally { s.restore(); }
});

test('Постеры: «английские» у ряда без подборки (адвент) — запросов нет, ответ один', function () {
  var s = setupPosters('original');
  try {
    var done = [];
    s.S.posters(null, [{ id: 1, title: 'A', poster_path: '/ru.jpg' }], function (n) { done.push(n); }, null);
    assert.deepEqual(done, [0]);
    assert.equal(s.calls.length, 0);
  } finally { s.restore(); }
});

test('Постеры: «без надписей» — запрос на карточку, только постеры без языка, кэш 30 дней', function () {
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

test('Постеры: «без надписей» — ошибки запросов ряд не задерживают', function () {
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
test('Постеры: молчащий запрос закрывает дедлайн, done зовётся ровно один раз', function () {
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
test('Постеры: сменилось поколение — поздний ответ карточку не трогает', function () {
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

/* Правка 2026-09-25: кадр из каталога (cover) — сразу и без запроса; у
   подборки Кинопоиска он не заслоняет ошибку «нет ключа». */
test('bannerPath: cover из каталога — сразу, ни одного запроса к TMDB', function () {
  var calls = 0;
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function () { calls++; } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  var got = null;
  var h = S.bannerPath({ id: 'xmas-comedy', cover: '/c.jpg', sources: { movie: { type: 'discover', params: {} } } }, function (path) {
    got = path;
  }, function (e) { throw new Error('err: ' + JSON.stringify(e)); }, null);
  assert.equal(got, '/c.jpg', 'ответ синхронный');
  assert.equal(calls, 0, 'первая страница подборки для плитки не нужна');
  assert.equal(typeof h.clear, 'function');
  h.clear();
});

/* Ревью каталога (65): cover приходит и из внешнего каталога
   (LC.MANIFEST_URL), а тест формата стоит только на встроенном. Не путь
   TMDB — не берётся: плитка идёт обычным путём, первой страницей подборки. */
test('bannerPath: cover не в формате пути TMDB — обычный запрос, а не чужой адрес', async function () {
  var bad = ['https://evil.example/x.jpg', '//evil.example/x.jpg', '/../x.jpg', '/a b.jpg',
    '/x.gif', 'x.jpg', '/x.jpg?y=1', '/x.jpg"', ' /x.jpg', '/x.jpg\n'];
  for (var i = 0; i < bad.length; i++) {
    var calls = 0;
    global.Lampa = makeFakeLampa({
      Api: { sources: { tmdb: { get: function (url, params, ok) {
        calls++;
        ok({ results: [{ id: 1, backdrop_path: '/bd.jpg' }], page: 1, total_pages: 1, total_results: 1 });
      } } } }
    });
    global.window = { localStorage: null };
    var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
    var item = { id: 'bad-cover-' + i, cover: bad[i], sources: { movie: { type: 'discover', params: {} } } };
    var path = await new Promise(function (resolve, reject) {
      S.bannerPath(item, resolve, function (e) { reject(new Error('err: ' + JSON.stringify(e))); }, null);
    });
    assert.equal(path, '/bd.jpg', 'cover ' + JSON.stringify(bad[i]) + ' не должен уйти в плитку');
    assert.equal(calls, 1, 'cover ' + JSON.stringify(bad[i]) + ' — кадр обычным запросом');
  }
});

test('bannerPath: cover .png тоже путь TMDB — сразу, без запроса', function () {
  var calls = 0;
  global.Lampa = makeFakeLampa({
    Api: { sources: { tmdb: { get: function () { calls++; } } } }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  var got = null;
  S.bannerPath({ id: 'png', cover: '/Ab_9-z.png', sources: { movie: { type: 'discover', params: {} } } }, function (path) {
    got = path;
  }, function (e) { throw new Error('err: ' + JSON.stringify(e)); }, null);
  assert.equal(got, '/Ab_9-z.png');
  assert.equal(calls, 0);
});

test('bannerPath: cover у подборки Кинопоиска не отменяет err({nokey:true})', function (t, done) {
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () { return new FakeReguest('ok_empty'); }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function () { return ''; } }).api;
  S.bannerPath({ id: 'kp', cover: '/c.jpg', sources: { movie: { type: 'kp', collection: 'X' } } }, function () {
    done(new Error('ok не должен вызываться'));
  }, function (e) {
    assert.ok(e && e.nokey);
    done();
  }, null);
});

/* Полное ревью, S3: коллекция КП из каталога уходила в адрес запроса и в
   ключ localStorage как есть. Только формат КП ([A-Z0-9_]) и
   encodeURIComponent. */
test('S3: fetchKp и kpPosters — коллекция не по формату в сеть не идёт', function () {
  var urls = [];
  global.Lampa = makeFakeLampa({
    storage: makeFakeStorage(),
    Reguest: function () {
      return new FakeReguest(function (url, ok) { urls.push(url); ok({ items: [], totalPages: 1, total: 0 }); });
    }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'KEY' : ''; } }).api;
  var errs = [];
  var bad = { id: 'kp-x', title: 'x', sources: { movie: { type: 'kp', collection: 'TOP&api_key=1' } } };
  S['fetch'](bad, 1, function () { errs.push('ok'); }, function (e) { errs.push(e); });
  S.bannerPath(bad, function () { errs.push('ok'); }, function (e) { errs.push(e); }, null);
  assert.equal(urls.length, 0, 'запрос по кривой коллекции ушёл: ' + urls.join(' '));
  assert.equal(errs.length, 2);
  assert.ok(errs.indexOf('ok') < 0);
  var good = { id: 'kp-top', title: 'x', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };
  S['fetch'](good, 2, function () {}, function () {});
  assert.equal(urls.length, 1);
  assert.ok(urls[0].indexOf('collections?type=TOP_250_MOVIES&page=2') > 0, urls[0]);
});

/* ====================================================================== */
/* Наборы: коллекция + also/movies (правка 2026-09-27).                    */
/* ====================================================================== */

function setupSet(mode) {
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
    postersMode: function () { return mode || 'lampa'; }
  }).api;
  return {
    S: S, calls: calls, timers: timers,
    restore: function () { globalThis.setTimeout = realSet; globalThis.clearTimeout = realClear; }
  };
}

var SPIDER = { id: 'spiderman-mcu', title: 'Человек-паук', sources: { movie: { type: 'collection', id: 531241, also: [556], movies: [2661] } } };

test('наборы: fetch — запрос на коллекцию и на фильм, склейка по дате, кэш неделя', function () {
  var s = setupSet();
  try {
    var got = [];
    s.S['fetch'](SPIDER, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    assert.deepEqual(s.calls.map(function (c) { return c.url; }), ['collection/531241', 'collection/556', 'movie/2661']);
    s.calls.forEach(function (c) { assert.equal(c.cache.life, 10080); });
    s.calls[1].ok({ parts: [{ id: 557, title: 'Человек-паук', release_date: '2002-05-01' }, { id: 558, title: 'Человек-паук 2', release_date: '2004-06-25' }] });
    s.calls[0].ok({ parts: [{ id: 315635, title: 'Возвращение домой', release_date: '2017-07-05' }] });
    assert.equal(got.length, 0, 'ответили не все — ждём');
    s.calls[2].ok({ id: 2661, title: 'Бэтмен', release_date: '1966-07-30', genres: [{ id: 28 }] });
    assert.equal(got.length, 1);
    assert.deepEqual(got[0].results.map(function (c) { return c.id; }), [2661, 557, 558, 315635], 'по дате выхода, как одна коллекция');
    assert.equal(got[0].title, 'Человек-паук');
    assert.equal(got[0].total_pages, 1, 'одна страница — сетка дальше не просит');
    assert.equal(got[0].partial, undefined);
  } finally { s.restore(); }
});

test('наборы: одна часть упала — остальное приходит; упали все — ошибка подборки', function () {
  var s = setupSet();
  try {
    var got = [];
    s.S['fetch'](SPIDER, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    s.calls[0].ok({ parts: [{ id: 315635, title: 'Возвращение домой', release_date: '2017-07-05' }] });
    s.calls[1].err();
    s.calls[2].err();
    assert.equal(got.length, 1);
    assert.deepEqual(got[0].results.map(function (c) { return c.id; }), [315635]);

    var item2 = { id: 'set-2', title: 'x', sources: { movie: { type: 'collection', id: 1, movies: [2] } } };
    var got2 = [];
    s.S['fetch'](item2, 1, function (r) { got2.push(r); }, function (e) { got2.push({ err: e }); }, null);
    s.calls[3].err();
    s.calls[4].err();
    assert.equal(got2.length, 1);
    assert.ok(got2[0].err && got2[0].err.all_failed, 'ни одного ответа — подборка отвечает ошибкой, а не пустым списком');
  } finally { s.restore(); }
});

test('наборы: молчащая часть — свой дедлайн раньше общего, пришедшее не теряется', function () {
  var s = setupSet();
  try {
    var got = [];
    s.S['fetch'](SPIDER, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    var mine = s.timers.filter(function (t) { return t.ms === 12000; });
    var all = s.timers.filter(function (t) { return t.ms === 15000; });
    assert.equal(mine.length, 1, 'дедлайн набора');
    assert.equal(all.length, 1, 'дедлайн подборки');
    s.calls[0].ok({ parts: [{ id: 315635, title: 'Возвращение домой', release_date: '2017-07-05' }] });
    mine[0].cb();
    assert.equal(got.length, 1);
    assert.deepEqual(got[0].results.map(function (c) { return c.id; }), [315635]);
    s.calls[1].ok({ parts: [{ id: 557, title: 'Человек-паук', release_date: '2002-05-01' }] });
    assert.equal(got.length, 1, 'опоздавшая часть второго ответа не даёт');
  } finally { s.restore(); }
});

test('наборы: отмена — поздние ответы частей подписчику не доходят', function () {
  var s = setupSet();
  try {
    var got = [];
    var h = s.S['fetch'](SPIDER, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    h.clear();
    s.calls.forEach(function (c) { c.ok({ parts: [] }); });
    assert.equal(got.length, 0);
  } finally { s.restore(); }
});

/* SEC4-2: удалённый каталог (lumen_manifest_url или подменённый GitHub
   Pages) с also и movies по 24 у movie и у tv давал 98 запросов TMDB разом
   на одну плитку. Теперь — не больше 20 на источник, не больше 4 в полёте
   на источник, повторы — один раз. */
function idsFrom(n, base) { var a = []; for (var i = 0; i < n; i++) a.push(base + i); return a; }
function inFlight(calls) { return calls.filter(function (c) { return !c.done; }).length; }
function answer(c, json) { c.done = true; if (json === null) c.err(); else c.ok(json); }

test('наборы: не больше 4 запросов набора одновременно; следующий — по ответу или ошибке (SEC4-2)', function () {
  var s = setupSet();
  try {
    var got = [];
    var item = { id: 'big', title: 'Big', sources: { movie: { type: 'collection', id: 1, also: idsFrom(6, 100), movies: idsFrom(8, 1000) } } };
    s.S['fetch'](item, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    assert.equal(s.calls.length, 4, 'в полёте сразу — четыре');
    assert.deepEqual(s.calls.map(function (c) { return c.url; }), ['collection/1', 'collection/100', 'collection/101', 'collection/102']);
    answer(s.calls[1], { parts: [{ id: 5, title: 'a', release_date: '2001-01-01' }] });
    assert.equal(s.calls.length, 5, 'ответ — уходит следующий');
    answer(s.calls[0], null);
    assert.equal(s.calls.length, 6, 'ошибка — тоже уходит следующий');
    s.calls[1].err();
    s.calls[0].ok({ parts: [] });
    assert.equal(s.calls.length, 6, 'второй колбэк того же запроса — не новый слот');
    var max = 0;
    var guard = 0;
    while (inFlight(s.calls) && guard++ < 100) {
      max = Math.max(max, inFlight(s.calls));
      var c = s.calls.filter(function (x) { return !x.done; })[0];
      answer(c, c.url.indexOf('movie/') === 0 ? { id: Number(c.url.slice(6)), title: 'm', release_date: '1990-01-01', genres: [] } : { parts: [] });
    }
    assert.equal(max, 4, 'одновременно — не больше четырёх');
    assert.equal(s.calls.length, 15, 'все 15 запросов ушли');
    assert.equal(got.length, 1);
    assert.equal(got[0].results.length, 9, 'коллекция 100 и восемь фильмов');
  } finally { s.restore(); }
});

test('наборы: синхронный ответ (кэш Lampa) — очередь не рвётся и не переполняется (SEC4-2)', function () {
  var s = setupSet();
  try {
    var urls = [];
    global.Lampa.Api.sources.tmdb.get = function (url, params, ok) {
      urls.push(url);
      ok(url.indexOf('movie/') === 0 ? { id: Number(url.slice(6)), title: 'm', release_date: '1990-01-01', genres: [] } : { parts: [] });
    };
    var got = [];
    var item = { id: 'big', title: 'Big', sources: { movie: { type: 'collection', id: 1, also: idsFrom(6, 100), movies: idsFrom(8, 1000) } } };
    s.S['fetch'](item, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    assert.equal(urls.length, 15);
    assert.equal(got.length, 1);
    assert.equal(got[0].results.length, 8);
  } finally { s.restore(); }
});

test('наборы: каталог 24 + 24 у movie и у tv — не 98 запросов, а не больше 20 на источник и 4 в полёте (SEC4-2)', function () {
  var s = setupSet('original');
  try {
    var item = { id: 'evil', title: 'Evil', sources: {
      movie: { type: 'collection', id: 1, also: idsFrom(24, 100), movies: idsFrom(24, 1000) },
      tv: { type: 'collection', id: 2, also: idsFrom(24, 200), movies: idsFrom(24, 2000) }
    } };
    s.S['fetch'](item, 1, function () {}, function () {}, null);
    assert.equal(s.calls.length, 8, 'по четыре на источник');
    var max = 0;
    var guard = 0;
    while (inFlight(s.calls) && guard++ < 500) {
      max = Math.max(max, inFlight(s.calls));
      answer(s.calls.filter(function (x) { return !x.done; })[0], { parts: [] });
    }
    assert.equal(max, 8);
    assert.equal(s.calls.length, 40, 'по 20 на источник');
    var seen = {};
    s.calls.forEach(function (c) { seen[c.url] = 1; });
    assert.equal(Object.keys(seen).length, 40);
    s.calls.length = 0;
    s.S.posters(item, [{ id: 1, poster_path: '/x.jpg' }], function () {}, null, 1);
    assert.equal(s.calls.length, 40, '«Английские постеры» — тоже не больше 20 на источник');
  } finally { s.restore(); }
});

test('наборы: повторы id не множат запросы (SEC4-2)', function () {
  var s = setupSet();
  try {
    var same = new Array(24).fill(7);
    s.S['fetch']({ id: 'dup', title: 'D', sources: { movie: { type: 'collection', id: 7, also: same, movies: same } } }, 1, function () {}, function () {}, null);
    assert.deepEqual(s.calls.map(function (c) { return c.url; }), ['collection/7', 'movie/7']);
  } finally { s.restore(); }
});

test('наборы: подборку закрыли — очередь набора новых запросов не шлёт (SEC4-2)', function () {
  var s = setupSet();
  try {
    var got = [];
    var item = { id: 'big', title: 'Big', sources: { movie: { type: 'collection', id: 1, movies: idsFrom(10, 1000) } } };
    var h = s.S['fetch'](item, 1, function (r) { got.push(r); }, function (e) { got.push({ err: e }); }, null);
    assert.equal(s.calls.length, 4);
    h.clear();
    s.calls.slice().forEach(function (c) { answer(c, { id: 1, title: 'm', genres: [] }); });
    assert.equal(s.calls.length, 4, 'после отмены — ни одного нового запроса');
    assert.equal(got.length, 0);
  } finally { s.restore(); }
});

test('наборы: обычная коллекция без добавок — прежний единственный запрос', function () {
  var s = setupSet();
  try {
    var got = [];
    s.S['fetch']({ id: 'dune', title: 'Дюна', sources: { movie: { type: 'collection', id: 726871 } } }, 1, function (r) { got.push(r); }, function () {}, null);
    assert.deepEqual(s.calls.map(function (c) { return c.url; }), ['collection/726871']);
    assert.equal(s.timers.filter(function (t) { return t.ms === 12000; }).length, 0, 'своего дедлайна у одиночной коллекции нет');
  } finally { s.restore(); }
});

test('наборы: «английские» постеры спрашивают каждую часть набора, фильм — по id', function () {
  var s = setupSet('original');
  try {
    var cards = [
      { id: 557, title: 'Человек-паук', poster_path: '/ru557.jpg' },
      { id: 2661, title: 'Бэтмен', poster_path: '/ru2661.jpg' },
      { id: 315635, title: 'Возвращение домой', poster_path: '/ru315635.jpg' }
    ];
    var done = [];
    s.S.posters(SPIDER, cards, function (n) { done.push(n); }, null, 1);
    assert.deepEqual(s.calls.map(function (c) { return c.url; }), ['collection/531241', 'collection/556', 'movie/2661']);
    s.calls.forEach(function (c) { assert.equal(c.params.langs, 'en'); });
    s.calls[0].ok({ parts: [{ id: 315635, title: 'Homecoming', poster_path: '/en315635.jpg' }] });
    s.calls[1].ok({ parts: [{ id: 557, title: 'Spider-Man', poster_path: '/en557.jpg' }] });
    s.calls[2].ok({ id: 2661, title: 'Batman', poster_path: '/en2661.jpg' });
    assert.deepEqual(done, [3]);
    assert.deepEqual(cards.map(function (c) { return c.poster_path; }), ['/en557.jpg', '/en2661.jpg', '/en315635.jpg']);
  } finally { s.restore(); }
});

/* Жалоба 2026-09-27, замер на стенде: неудача запроса постеров Кинопоиска не
   кэшировалась, а хаб перезапрашивает кадр упавшей плитки на каждом шаге
   фокуса (loadBanner, src/46_hub.js) — с отвергнутым ключом один заход в хаб
   дал 102 запроса. Неудача помнится LIFE_KP_EMPTY (10 минут), как у fetchKp. */
test('bannerPath: неудача Кинопоиска помнится 10 минут — плитка не спрашивает на каждом шаге фокуса', function (t, done) {
  var kpCalls = 0;
  var storage = makeFakeStorage();
  global.Lampa = makeFakeLampa({
    storage: storage,
    Reguest: function () {
      return new FakeReguest(function (url, ok, err) { kpCalls++; err({ status: 402 }); });
    }
  });
  global.window = { localStorage: null };
  var S = loadCtx('43_sources.js', { pref: function (k) { return k === 'lumen_kp_key' ? 'KEY' : ''; } }).api;
  var item = { id: 'kp-top250', sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } } };

  S.bannerPath(item, function () { done(new Error('первый раз — ошибка, а не ok')); }, function (e) {
    assert.ok(e && e.kp_failed, JSON.stringify(e));
    assert.equal(kpCalls, 1);
    var rec = storage.get('lumen_kpp_TOP_250_MOVIES', null);
    assert.ok(rec && Array.isArray(rec.data) && rec.data.length === 0, 'пустая запись-отметка неудачи');
    assert.ok(rec.ttl > 0 && rec.ttl <= 10 * 60000, 'короткий срок: ' + rec.ttl);
    S.bannerPath(item, function (path) {
      assert.equal(path, '', 'плитка без кадра');
      assert.equal(kpCalls, 1, 'повторный шаг фокуса в сеть не идёт');
      rec.at = Date.now() - 11 * 60000;
      S.bannerPath(item, function () { done(new Error('через 10 минут — снова запрос и снова ошибка')); }, function () {
        assert.equal(kpCalls, 2, 'через 10 минут — новый запрос');
        done();
      }, null);
    }, function (e2) { done(new Error('второй раз — из кэша, получено err: ' + JSON.stringify(e2))); }, null);
  }, null);
});

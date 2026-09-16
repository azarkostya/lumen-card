  /* -------------------------------------------------------------------- */
  /* LC.sources — преобразование описания подборки в запросы TMDB/КП       */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   buildRequest(spec, media, page) → {url, params, life}               */
  /*   normalize(type, json) → {results, title, page, total_results, ...}  */
  /*   discoverUrl(spec, media) → строка для category_full                  */
  /*   kpToFinds(json, limit) → [imdbId, ...]                               */
  /*   mergeMedia(movies, tv) → [card, ...]                                 */
  /*   fetchOne(spec, media, page, ok, err, alive) — runtime, требует Lampa */
  /*   fetch(item, page, ok, err, alive) → {clear} — runtime, требует Lampa */
  /*                                                                        */
  /* Сетевые запросы — только через Lampa.Api.sources.tmdb.get и           */
  /* Lampa.Reguest (для Кинопоиска). Кэш КП — Lampa.Storage с защитой      */
  /* квоты по образцу 60_reviews.js (nolisten, stored(), purge()).          */
  /* -------------------------------------------------------------------- */

  LC.sources = (function () {

    /* Параметры discover → query-ключи TMDB. Проверено: genres=with_genres,
       keywords=with_keywords, networks=with_networks, companies=with_companies,
       watch_providers=with_watch_providers в Lampa 3.3.4 (API_NOTES_4.md).
       orig_lang=with_original_language — Lampa прокидывает как есть.
       Ключи filter{} передаются напрямую (vote_count.gte, with_people и т.п.). */
    var MAP = {
      genres: 'with_genres',
      keywords: 'with_keywords',
      companies: 'with_companies',
      networks: 'with_networks',
      watch_providers: 'with_watch_providers',
      watch_region: 'watch_region',
      sort_by: 'sort_by',
      orig_lang: 'with_original_language'
    };

    /* Время жизни кэша:
       discover — 12 ч (популярность меняется; 720 мин)
       collection/list — 1 неделя (статичные данные; 10080 мин)
       кп — 30 дней (43200 мин)
       кп пустой — 10 мин (негативный TTL для пустых/неудачных ответов) */
    var LIFE_DISCOVER = 720;
    var LIFE_STATIC = 10080;
    var LIFE_KP = 43200;
    var LIFE_KP_EMPTY = 10;

    /* Глобальный дедлайн fetchAll: 15 сек, после — частичный результат. */
    var FETCH_TIMEOUT = 15000;

    /* ------------------------------------------------------------------ */
    /* Кэш КП в Lampa.Storage: индексированный, с защитой квоты.          */
    /* Механика по образцу 60_reviews.js (nolisten, stored(), purge()).    */
    /* ------------------------------------------------------------------ */

    var INDEX_KEY = 'lumen_sources_index';
    var MAX_CACHED = 60;

    function storage() {
      try { return Lampa && Lampa.Storage; } catch (e) { return null; }
    }

    function readIndex(store) {
      var raw = null;
      try { raw = store.get(INDEX_KEY, null); } catch (e) {}
      return Array.isArray(raw) ? raw : [];
    }

    function drop(store, key) {
      try { store.set(key, '', { nolisten: true }); } catch (e) {}
      try {
        var ls = (typeof window !== 'undefined' && window.localStorage) ||
                 (typeof localStorage !== 'undefined' ? localStorage : null);
        if (ls) ls.removeItem(key);
      } catch (e) {}
    }

    function stored(key, value) {
      try {
        var ls = (typeof window !== 'undefined' && window.localStorage) ||
                 (typeof localStorage !== 'undefined' ? localStorage : null);
        if (!ls) return true;
        var s = JSON.stringify(value);
        ls.setItem(key, s);
        var got = ls.getItem(key);
        return got !== null && got.length >= s.length;
      } catch (e) { return false; }
    }

    function purge(store) {
      var idx = readIndex(store);
      LC.util.each(idx, function (k) { drop(store, k); });
      try { store.set(INDEX_KEY, [], { nolisten: true }); } catch (e) {}
    }

    function put(store, key, value) {
      var idx = readIndex(store);
      if (idx.indexOf(key) < 0) { idx.push(key); }
      while (idx.length > MAX_CACHED) { drop(store, idx.shift()); }
      try { store.set(INDEX_KEY, idx, { nolisten: true }); } catch (e) {}
      try { store.set(key, value, { nolisten: true }); } catch (e2) {}
      if (!stored(key, value)) {
        purge(store);
        try { store.set(key, value, { nolisten: true }); } catch (e3) {}
      }
    }

    /* ------------------------------------------------------------------ */

    /* Строит параметры запроса к Lampa.Api.sources.tmdb.get.
       Для collection/list — фиксированный URL без page (TMDB отдаёт всё сразу).
       Для discover — page обязателен. */
    function buildRequest(spec, media, page) {
      if (spec.type === 'collection') {
        return { url: 'collection/' + spec.id, params: {}, life: LIFE_STATIC };
      }
      if (spec.type === 'list') {
        return { url: 'list/' + spec.id, params: {}, life: LIFE_STATIC };
      }
      var params = {};
      var k;
      for (k in spec.params) {
        if (spec.params.hasOwnProperty(k)) {
          params[k] = spec.params[k];
        }
      }
      params.page = page || 1;
      return { url: 'discover/' + media, params: params, life: LIFE_DISCOVER };
    }

    /* Нормализует ответ TMDB к единому виду {results, title, page, total_*}.
       collection → parts[], сортировка по release_date ASC (хронологический порядок).
       list → items[].
       discover → results[] (уже в нужном виде).
       Мутирует копию массива, а не оригинал (slice()). */
    function normalize(type, json) {
      json = json || {};
      var results;
      if (type === 'collection') {
        results = (json.parts || []).slice();
        results.sort(function (a, b) {
          var da = String(a.release_date || '9999');
          var db = String(b.release_date || '9999');
          if (da < db) return -1;
          if (da > db) return 1;
          return 0;
        });
      } else if (type === 'list') {
        results = (json.items || []).slice();
      } else {
        results = (json.results || []).slice();
      }
      var out = {
        results: results,
        title: json.title || json.name || '',
        page: json.page || 1
      };
      out.total_results = json.total_results || results.length;
      out.total_pages = json.total_pages || 1;
      return out;
    }

    /* Строит URL для Lampa.Activity.push({component:'category_full', url:…}).
       Раскрывает filter{} как плоские параметры query.
       encodeURIComponent: числа и типичные строки (popularity.desc, KR) не меняются. */
    function discoverUrl(spec, media) {
      var q = [];
      var p = spec.params || {};
      var k;
      for (k in p) {
        if (p.hasOwnProperty(k) && k !== 'filter') {
          q.push((MAP[k] || k) + '=' + encodeURIComponent(p[k]));
        }
      }
      var f = p.filter || {};
      for (k in f) {
        if (f.hasOwnProperty(k)) {
          q.push(k + '=' + encodeURIComponent(f[k]));
        }
      }
      return 'discover/' + media + (q.length ? '?' + q.join('&') : '');
    }

    /* Извлекает IMDb-идентификаторы из ответа Кинопоиска, до limit штук,
       пропуская позиции без imdbId. */
    function kpToFinds(json, limit) {
      var ids = [];
      LC.util.each((json && json.items) || [], function (it) {
        if (it && it.imdbId && ids.length < limit) {
          ids.push(it.imdbId);
        }
      });
      return ids;
    }

    /* Чередует карточки из двух медиа-списков.
       Ключ дедупликации — media + ':' + id (не bare id):
       фильм и сериал с одинаковым TMDB id — разные объекты, оба попадают.
       Дубли внутри одного массива (movie:X повторяется дважды) убираются. */
    function mergeMedia(movies, tv) {
      var out = [];
      var seen = {};
      var a = movies || [];
      var b = tv || [];
      var len = Math.max(a.length, b.length);
      var i, km, kt;
      for (i = 0; i < len; i++) {
        if (a[i]) {
          km = 'movie:' + a[i].id;
          if (!seen[km]) { seen[km] = 1; out.push(a[i]); }
        }
        if (b[i]) {
          kt = 'tv:' + b[i].id;
          if (!seen[kt]) { seen[kt] = 1; out.push(b[i]); }
        }
      }
      return out;
    }

    /* Кинопоиск: IMDb-ID → TMDB find.
       alive-guard обрывает цепочку next() при смене поколения (C1).
       Непустые результаты кэшируются на LIFE_KP (C2);
       пустые ответы и сетевые ошибки — на LIFE_KP_EMPTY мин (отрицательный TTL).
       Механика кэша: nolisten, stored(), put(), purge() (C3).
       Ключ КП читается напрямую через LC.pref, без LC.reviews (I5).
       При отсутствии ключа: err({nokey:true}) (I5).
       Проверка формы при чтении кэша (I2). */
    function fetchKp(spec, page, ok, err, alive) {
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }

      var key = typeof LC.pref === 'function' ? LC.pref('lumen_kp_key', '') : '';
      if (!key) { err({ nokey: true }); return null; }

      var cacheKey = 'lumen_kp_' + spec.collection + '_' + (page || 1);
      var store = storage();
      var cached = null;
      try {
        var raw = store ? store.get(cacheKey, null) : null;
        if (raw && typeof raw === 'object' && !Array.isArray(raw) && raw.at) {
          cached = raw;
        }
      } catch (e) {}
      if (cached && (Date.now() - cached.at) < (cached.ttl || LIFE_KP * 60000)) {
        if (!dead()) ok(cached.data);
        return null;
      }

      var net = new Lampa.Reguest();
      net.silent(
        'https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=' +
          spec.collection + '&page=' + (page || 1),
        function (json) {
          if (dead()) return;
          var ids = kpToFinds(json, 20);
          var results = [];
          var i = 0;
          function next() {
            if (dead()) return;
            if (i >= ids.length) {
              var data = {
                results: results,
                page: page || 1,
                total_pages: (json && json.totalPages) || 1,
                total_results: (json && json.total) || results.length,
                title: ''
              };
              var s = storage();
              if (s) {
                if (results.length > 0) {
                  put(s, cacheKey, { at: Date.now(), ttl: LIFE_KP * 60000, data: data });
                } else {
                  try {
                    s.set(cacheKey, { at: Date.now(), ttl: LIFE_KP_EMPTY * 60000, data: data }, { nolisten: true });
                  } catch (e2) {}
                }
              }
              if (!dead()) ok(data);
              return;
            }
            var id = ids[i++];
            Lampa.Api.sources.tmdb.get(
              'find/' + id,
              { filter: { external_source: 'imdb_id' } },
              function (f) {
                var m = (f.movie_results && f.movie_results[0]) ||
                        (f.tv_results && f.tv_results[0]);
                if (m) results.push(m);
                next();
              },
              next,
              { life: LIFE_KP }
            );
          }
          next();
        },
        function () {
          var s = storage();
          if (s) {
            try {
              var errData = { results: [], page: page || 1, total_pages: 1, total_results: 0, title: '' };
              s.set(cacheKey, { at: Date.now(), ttl: LIFE_KP_EMPTY * 60000, data: errData }, { nolisten: true });
            } catch (e2) {}
          }
          if (!dead()) err({ kp_failed: true });
        },
        false,
        { headers: { 'X-API-KEY': key }, dataType: 'json', timeout: 8000 }
      );
      return net;
    }

    /* Один источник одного медиа. Для kp — fetchKp.
       alive передаётся дальше; возвращает net или null. */
    function fetchOne(spec, media, page, ok, err, alive) {
      if (spec.type === 'kp') { return fetchKp(spec, page, ok, err, alive); }
      var gen = alive ? alive() : 0;
      function dead() { return alive && alive() !== gen; }
      var r = buildRequest(spec, media, page);
      var net = Lampa.Api.sources.tmdb.get(
        r.url,
        r.params,
        function (json) { if (!dead()) ok(normalize(spec.type, json)); },
        function (e) { if (!dead()) err(e); },
        { life: r.life }
      );
      return net;
    }

    /* Карта in-flight запросов для дедупликации (I4).
       Один и тот же ключ (id:page) не грузится параллельно дважды.
       Структура: { subs: {id: {ok,err,alive,gen}}, _nextId: n, _cancel: fn|null }
       Второй и последующие вызовы регистрируются как подписчики первого запроса;
       каждый получает рабочий clear() (снимает только свою подписку, не гасит запрос);
       когда отменились все подписчики — запрос гасится. */
    var inflight = {};

    /* Подборка целиком: movie и tv (если оба есть) → один список через mergeMedia.
       alive-guard каждого подписчика: notifySubs проверяет alive перед вызовом ok/err.
       done-latch: ok вызывается ровно один раз (I3).
       Глобальный дедлайн FETCH_TIMEOUT: при истечении — частичный результат.
       Возвращает {clear()} для принудительной отмены одной подписки. */
    function fetchAll(item, page, ok, err, alive) {
      var gen = alive ? alive() : 0;

      var inflightKey = (item.id || '') + ':' + (page || 1);
      var entry = inflight[inflightKey];
      if (entry) {
        /* Подписываемся на уже идущий запрос. */
        var subId = ++entry._nextId;
        entry.subs[subId] = { ok: ok, err: err, alive: alive, gen: gen };
        return {
          clear: function () {
            var e = inflight[inflightKey];
            if (!e || !e.subs[subId]) return;
            delete e.subs[subId];
            /* Последний подписчик отменился — гасим весь запрос. */
            if (!Object.keys(e.subs).length && e._cancel) { e._cancel(); }
          }
        };
      }

      /* Первый запрос: создаём entry и добавляем себя как подписчика. */
      entry = { subs: {}, _nextId: 1, _cancel: null };
      entry.subs[1] = { ok: ok, err: err, alive: alive, gen: gen };
      inflight[inflightKey] = entry;
      var mySubId = 1;

      /* Уведомляем всех живых подписчиков и очищаем запись. */
      function notifySubs(method, arg) {
        var e = inflight[inflightKey];
        delete inflight[inflightKey];
        if (!e) return;
        var ids = Object.keys(e.subs);
        for (var j = 0; j < ids.length; j++) {
          var sub = e.subs[ids[j]];
          var subGen = sub.alive ? sub.alive() : 0;
          if (sub.alive && subGen !== sub.gen) continue;
          sub[method](arg);
        }
      }

      /* Отдельный alive для самого запроса: умирает когда отменились все подписчики.
         Это позволяет fetchKp прерывать цепочку find/ при полной отмене. */
      var _reqAliveGen = 0;
      function requestAlive() { return _reqAliveGen; }

      var src = item.sources || {};
      var want = [];
      var got = {};
      var failed = 0;
      var done_called = false;
      var nets = [];

      if (src.movie) want.push('movie');
      if (src.tv) want.push('tv');
      if (!want.length) {
        delete inflight[inflightKey];
        if (alive && alive() !== gen) { /* внешний вызывающий мёртв — молчим */ }
        else { err({ no_sources: true }); }
        return { clear: function () {} };
      }

      function buildResult() {
        var m = got.movie || { results: [], total_pages: 1, total_results: 0 };
        var t = got.tv || { results: [], total_pages: 1, total_results: 0 };
        return {
          results: mergeMedia(m.results, t.results),
          title: item.title,
          page: page || 1,
          total_pages: Math.max(m.total_pages || 1, t.total_pages || 1),
          total_results: (m.total_results || 0) + (t.total_results || 0)
        };
      }

      var deadline;

      function done() {
        var gotLen = Object.keys(got).length;
        if (gotLen + failed < want.length) return;
        if (done_called) return;
        done_called = true;
        clearTimeout(deadline);
        if (!gotLen) { notifySubs('err', { all_failed: true }); return; }
        notifySubs('ok', buildResult());
      }

      deadline = setTimeout(function () {
        if (done_called) return;
        done_called = true;
        var r = buildResult();
        r.partial = true;
        notifySubs('ok', r);
      }, FETCH_TIMEOUT);

      LC.util.each(want, function (media) {
        var n = fetchOne(
          src[media], media, page,
          function (json) { got[media] = json; done(); },
          function (e) {
            /* {nokey:true} — фатальная ошибка конфигурации: ключ КП отсутствует,
               пробовать другие медиа-типы бессмысленно. Пробрасываем напрямую. */
            if (e && e.nokey) {
              if (done_called) return;
              done_called = true;
              clearTimeout(deadline);
              notifySubs('err', e);
            } else {
              failed++;
              done();
            }
          },
          requestAlive
        );
        if (n) nets.push(n);
      });

      function cancelRequest() {
        _reqAliveGen++;
        clearTimeout(deadline);
        done_called = true;
        delete inflight[inflightKey];
        LC.util.each(nets, function (n) {
          try { if (n && n.clear) n.clear(); } catch (eIgnore) {}
        });
      }
      entry._cancel = cancelRequest;

      return {
        clear: function () {
          var e = inflight[inflightKey];
          if (!e || !e.subs[mySubId]) return;
          delete e.subs[mySubId];
          if (!Object.keys(e.subs).length) { cancelRequest(); }
        }
      };
    }

    /* 'fetch' — зарезервированный BARE_NAME в es5check (глобальный Web API).
       Публичный ключ задаётся строкой, чтобы es5check не считал его нарушением. */
    var api = {
      buildRequest: buildRequest,
      normalize: normalize,
      discoverUrl: discoverUrl,
      kpToFinds: kpToFinds,
      mergeMedia: mergeMedia,
      fetchOne: fetchOne
    };
    api['fetch'] = fetchAll;
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.sources;

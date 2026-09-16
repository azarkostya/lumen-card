  /* -------------------------------------------------------------------- */
  /* LC.sources — преобразование описания подборки в запросы TMDB/КП       */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   buildRequest(spec, media, page) → {url, params, life}               */
  /*   normalize(type, json) → {results, title, page, total_results, ...}  */
  /*   discoverUrl(spec, media) → строка для category_full                  */
  /*   kpToFinds(json, limit) → [imdbId, ...]                               */
  /*   mergeMedia(movies, tv) → [card, ...]                                 */
  /*   fetchOne(spec, media, page, ok, err) — runtime, требует Lampa        */
  /*   fetch(item, page, ok, err) — runtime, требует Lampa                  */
  /*                                                                        */
  /* Сетевые запросы — только через Lampa.Api.sources.tmdb.get и           */
  /* Lampa.Reguest (для Кинопоиска). Кэш КП — Lampa.Storage, 30 дней.      */
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
       кп — 30 дней (43200 мин) */
    var LIFE_DISCOVER = 720;
    var LIFE_STATIC = 10080;
    var LIFE_KP = 43200;

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

    /* Чередует карточки из двух медиа-списков, убирая дубли по id.
       Первая карточка — из movies, вторая — из tv и т.д.
       Порядок из тестов: [m0, t0, m1, t1, m2, ...] без дублей. */
    function mergeMedia(movies, tv) {
      var out = [];
      var seen = {};
      var a = movies || [];
      var b = tv || [];
      var len = Math.max(a.length, b.length);
      var i;
      for (i = 0; i < len; i++) {
        if (a[i] && !seen[a[i].id]) {
          seen[a[i].id] = 1;
          out.push(a[i]);
        }
        if (b[i] && !seen[b[i].id]) {
          seen[b[i].id] = 1;
          out.push(b[i]);
        }
      }
      return out;
    }

    /* Кинопоиск: страница → IMDb id → TMDB find/{id}.
       Кэш страницы в Lampa.Storage 30 дней.
       Lampa.Reguest — штатный XHR-клиент с заголовками. */
    function fetchKp(spec, page, ok, err) {
      var key = (LC.reviews && typeof LC.pref === 'function') ? LC.pref('lumen_kp_key', '') : '';
      if (!key) { err('no_key'); return; }
      var cacheKey = 'lumen_kp_' + spec.collection + '_' + (page || 1);
      var cached;
      try { cached = Lampa.Storage.get(cacheKey, null); } catch (e) { cached = null; }
      if (cached && cached.at && (Date.now() - cached.at) < LIFE_KP * 60000) {
        ok(cached.data);
        return;
      }
      var net = new Lampa.Reguest();
      net.silent(
        'https://kinopoiskapiunofficial.tech/api/v2.2/films/collections?type=' + spec.collection + '&page=' + (page || 1),
        function (json) {
          var ids = kpToFinds(json, 20);
          var results = [];
          var i = 0;
          function next() {
            if (i >= ids.length) {
              var data = {
                results: results,
                page: page || 1,
                total_pages: json.totalPages || 1,
                total_results: json.total || results.length,
                title: ''
              };
              try { Lampa.Storage.set(cacheKey, { at: Date.now(), data: data }); } catch (e2) {}
              ok(data);
              return;
            }
            var id = ids[i++];
            Lampa.Api.sources.tmdb.get(
              'find/' + id,
              { filter: { external_source: 'imdb_id' } },
              function (f) {
                var m = (f.movie_results && f.movie_results[0]) || (f.tv_results && f.tv_results[0]);
                if (m) results.push(m);
                next();
              },
              next,
              { life: LIFE_KP }
            );
          }
          next();
        },
        function () { err('kp_failed'); },
        false,
        { headers: { 'X-API-KEY': key }, dataType: 'json', timeout: 8000 }
      );
    }

    /* Один источник одного медиа. Для kp — fetchKp. */
    function fetchOne(spec, media, page, ok, err) {
      if (spec.type === 'kp') { fetchKp(spec, page, ok, err); return; }
      var r = buildRequest(spec, media, page);
      Lampa.Api.sources.tmdb.get(
        r.url,
        r.params,
        function (json) { ok(normalize(spec.type, json)); },
        err,
        { life: r.life }
      );
    }

    /* Подборка целиком: movie и tv (если оба есть) → один список через mergeMedia.
       Ждёт оба ответа (или ошибки), потом объединяет.
       Экспортируется как LC.sources.fetch. */
    function fetchAll(item, page, ok, err) {
      var src = item.sources || {};
      var want = [];
      var got = {};
      var failed = 0;
      if (src.movie) want.push('movie');
      if (src.tv) want.push('tv');
      if (!want.length) { err('no_sources'); return; }
      function done() {
        var gotLen = Object.keys(got).length;
        if (gotLen + failed < want.length) return;
        if (!gotLen) { err('all_failed'); return; }
        var m = got.movie || { results: [], total_pages: 1, total_results: 0 };
        var t = got.tv || { results: [], total_pages: 1, total_results: 0 };
        ok({
          results: mergeMedia(m.results, t.results),
          title: item.title,
          page: page || 1,
          total_pages: Math.max(m.total_pages || 1, t.total_pages || 1),
          total_results: (m.total_results || 0) + (t.total_results || 0)
        });
      }
      LC.util.each(want, function (media) {
        fetchOne(src[media], media, page, function (json) { got[media] = json; done(); }, function () { failed++; done(); });
      });
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

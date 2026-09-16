  /* -------------------------------------------------------------------- */
  /* LC.manifest — встроенный манифест подборок + загрузка с хостинга       */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   DEFAULT — встроенный манифест (объект)                               */
  /*   validate(m) → {ok, reason}                                           */
  /*   orderForMonth(list, month) → list (сезонные наверх)                  */
  /*   isFresh(rec) → bool (кэш свежий < 12 ч)                              */
  /*   load(cb) — загружает манифест; вызывает cb(manifest)                 */
  /*   get() → текущий (или DEFAULT) манифест                               */
  /*                                                                       */
  /* TMDB-идентификаторы проверены живыми запросами (Lampa 3.3.4):          */
  /* коллекции, companies, networks, keyword IDs — из API_NOTES_4.md.       */
  /* Кинопоиск: 12 типов коллекций (kinopoiskapiunofficial.tech).           */
  /* -------------------------------------------------------------------- */

  LC.manifest = (function () {

    /* ---- Встроенный манифест ------------------------------------------ */
    var DEFAULT = {
      version: 1,

      /* 10 групп — фиксированный набор (поправки контроллера Task 14) */
      groups: [
        { id: 'franchise', title: 'Franchises' },
        { id: 'studio',    title: 'Studios' },
        { id: 'service',   title: 'Services' },
        { id: 'theme',     title: 'Themes' },
        { id: 'country',   title: 'Countries' },
        { id: 'era',       title: 'Eras' },
        { id: 'people',    title: 'People' },
        { id: 'top',       title: 'Top' },
        { id: 'kp',        title: 'Kinopoisk' },
        { id: 'mood',      title: 'Mood' }
      ],

      /* 7 чипов хаба (поправки контроллера Task 14: hubGroups) */
      hubGroups: [
        { id: 'franchises', title: 'Franchises',           groups: ['franchise'] },
        { id: 'studios',    title: 'Studios & Services',   groups: ['studio', 'service'] },
        { id: 'themes',     title: 'Themes',               groups: ['theme'] },
        { id: 'countries',  title: 'Countries',            groups: ['country'] },
        { id: 'eras',       title: 'Eras',                 groups: ['era'] },
        { id: 'people',     title: 'People',               groups: ['people'] },
        { id: 'tops',       title: 'Top & Kinopoisk',      groups: ['top', 'kp'] }
      ],

      /* 4 чипа настроения (ровно 4, поправки Task 19) */
      moods: [
        { id: 'friday',  title: 'Friday Evening',  sources: { movie: { type: 'discover', params: { genres: '28|12|35', sort_by: 'popularity.desc', filter: { 'vote_average.gte': 6.5, 'with_runtime.lte': 130 } } } } },
        { id: 'family',  title: 'Family Viewing',  sources: { movie: { type: 'discover', params: { genres: '10751|16', sort_by: 'popularity.desc', filter: { certification_country: 'US', 'certification.lte': 'PG' } } } } },
        { id: 'scary',   title: 'Scary at Night',  sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } } },
        { id: 'short',   title: '90 Minutes',      sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'with_runtime.lte': 90, 'vote_count.gte': 200 } } } } }
      ],

      /* Подборки на главной по умолчанию */
      home: [
        'continue', 'because', 'new-episodes', 'soon',
        'star-wars', 'xmas-comedy', 'netflix-comedy', 'apple-tv',
        'kdrama', 'anime', 'kp-top250'
      ],

      /* ---- 62 подборки ------------------------------------------------ */
      collections: [

        /* === FRANCHISE (8 подборок) === */
        {
          id: 'star-wars', title: 'Star Wars', group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'collection', id: 10 },
            tv:    { type: 'discover',   params: { keywords: 379196, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'harry-potter', title: 'Harry Potter', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 1241 } }
        },
        {
          id: 'lotr', title: 'Lord of the Rings', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 119 } }
        },
        {
          id: 'hobbit', title: 'The Hobbit', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 121938 } }
        },
        {
          id: 'john-wick', title: 'John Wick', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 404609 } }
        },
        {
          id: 'mission-impossible', title: 'Mission: Impossible', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 87359 } }
        },
        {
          id: 'matrix', title: 'The Matrix', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 2344 } }
        },
        {
          id: 'terminator', title: 'Terminator', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 528 } }
        },

        /* === STUDIO (6 подборок) === */
        {
          id: 'pixar', title: 'Pixar', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'ghibli', title: 'Studio Ghibli', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 10342, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'marvel', title: 'Marvel Studios', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'a24', title: 'A24', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 41077, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'dc', title: 'DC Studios', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 128064, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'lucasfilm', title: 'Lucasfilm', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 1, sort_by: 'popularity.desc' } } }
        },

        /* === SERVICE (6 подборок) === */
        {
          id: 'netflix-comedy', title: 'Netflix Comedy', group: 'service', badge: 'NETFLIX',
          sources: {
            tv:    { type: 'discover', params: { genres: 35, networks: 213, sort_by: 'popularity.desc' } },
            movie: { type: 'discover', params: { genres: 35, watch_providers: 8, watch_region: 'US', sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'apple-tv', title: 'Apple TV+', group: 'service', badge: 'APPLE TV+',
          sources: { tv: { type: 'discover', params: { networks: 2552, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'hbo-series', title: 'HBO', group: 'service', badge: 'HBO',
          sources: { tv: { type: 'discover', params: { networks: 49, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'disney-series', title: 'Disney+', group: 'service', badge: 'DISNEY+',
          sources: { tv: { type: 'discover', params: { networks: 2739, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'amazon-series', title: 'Amazon Prime', group: 'service', badge: 'PRIME',
          sources: { tv: { type: 'discover', params: { networks: 1024, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'netflix-series', title: 'Netflix Series', group: 'service', badge: 'NETFLIX',
          sources: { tv: { type: 'discover', params: { networks: 213, sort_by: 'popularity.desc' } } }
        },

        /* === THEME (7 подборок) === */
        {
          id: 'xmas-comedy', title: 'Christmas Comedies', group: 'theme', icon: 'star', season: [12, 1],
          sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'halloween', title: 'Halloween', group: 'theme', icon: 'star', season: [9, 10, 11],
          sources: { movie: { type: 'discover', params: { genres: 27, keywords: 3335, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'comedy', title: 'Comedies', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 35, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'superhero', title: 'Superheroes', group: 'theme',
          sources: {
            movie: { type: 'discover', params: { genres: '28|12', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { genres: '10759|10765', sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'horror-top', title: 'Horror', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'documentary', title: 'Documentary', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 99, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'thriller', title: 'Thrillers', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 53, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },

        /* === COUNTRY (7 подборок) === */
        {
          id: 'kdrama', title: 'K-Drama', group: 'country',
          sources: { tv: { type: 'discover', params: { genres: 18, sort_by: 'popularity.desc', filter: { with_origin_country: 'KR' } } } }
        },
        {
          id: 'anime', title: 'Anime', group: 'country',
          sources: { tv: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
        },
        {
          id: 'turkish', title: 'Turkish Series', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'TR' } } } }
        },
        {
          id: 'french', title: 'French Cinema', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'FR', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'british', title: 'British TV', group: 'country',
          sources: {
            tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB' } } },
            movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'bollywood', title: 'Bollywood', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'IN', 'vote_count.gte': 50 } } } }
        },
        {
          id: 'spanish', title: 'Spanish Series', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'ES' } } } }
        },

        /* === ERA (5 подборок) === */
        {
          id: 'best-70s', title: 'Best of 1970s', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1970-01-01', 'primary_release_date.lte': '1979-12-31', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'best-80s', title: 'Best of 1980s', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1980-01-01', 'primary_release_date.lte': '1989-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-90s', title: 'Best of 1990s', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-2000s', title: 'Best of 2000s', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-2010s', title: 'Best of 2010s', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', 'vote_count.gte': 500 } } } }
        },

        /* === PEOPLE (8 подборок) === */
        {
          id: 'nolan', title: 'Christopher Nolan', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 525 } } } }
        },
        {
          id: 'tarantino', title: 'Quentin Tarantino', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 138 } } } }
        },
        {
          id: 'dicaprio', title: 'Leonardo DiCaprio', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6193 } } } }
        },
        {
          id: 'spielberg', title: 'Steven Spielberg', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 488 } } } }
        },
        {
          id: 'fincher', title: 'David Fincher', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 7467 } } } }
        },
        {
          id: 'scorsese', title: 'Martin Scorsese', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1032 } } } }
        },
        {
          id: 'villeneuve', title: 'Denis Villeneuve', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 137427 } } } }
        },
        {
          id: 'miyazaki', title: 'Hayao Miyazaki', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 608 } } } }
        },

        /* === TOP (3 подборки) === */
        {
          id: 'top-grossing', title: 'Top Grossing', group: 'top',
          sources: { movie: { type: 'list', id: 10 } }
        },
        {
          id: 'top-rated', title: 'Top Rated', group: 'top',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 1000, 'vote_average.gte': 8 } } } }
        },
        {
          id: 'popular-all', title: 'Popular Now', group: 'top',
          sources: {
            movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
          }
        },

        /* === KP (12 типов Кинопоиска) === */
        {
          id: 'kp-top250', title: 'KP Top-250 Movies', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } }
        },
        {
          id: 'kp-top250-tv', title: 'KP Top-250 Series', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_250_TV_SHOWS' } }
        },
        {
          id: 'kp-popular-all', title: 'KP Popular', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_POPULAR_ALL' } }
        },
        {
          id: 'kp-popular-series', title: 'KP Popular Series', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'POPULAR_SERIES' } }
        },
        {
          id: 'kp-family', title: 'KP Family', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'FAMILY' } }
        },
        {
          id: 'kp-animation', title: 'KP Animation', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'KIDS_ANIMATION_THEME' } }
        },
        {
          id: 'kp-comics', title: 'KP Comics', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'COMICS_THEME' } }
        },
        {
          id: 'kp-vampire', title: 'KP Vampire', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'VAMPIRE_THEME' } }
        },
        {
          id: 'kp-zombie', title: 'KP Zombie', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'ZOMBIE_THEME' } }
        },
        {
          id: 'kp-love', title: 'KP Love', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'LOVE_THEME' } }
        },
        {
          id: 'kp-catastrophe', title: 'KP Catastrophe', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'CATASTROPHE_THEME' } }
        },
        {
          id: 'kp-oscars', title: 'KP Oscar Winners', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'OSKAR_WINNERS_2021' } }
        }

      ] /* /collections */
    };

    /* ---- Вспомогательные чистые функции -------------------------------- */

    /* Возвращает {ok, reason}.
       Проверяет: не null, есть version, collections — массив без дублей id,
       у каждой подборки есть sources (movie или tv), есть groups и home. */
    function validate(m) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) {
        return { ok: false, reason: 'not_object' };
      }
      if (!m.version) return { ok: false, reason: 'no_version' };
      if (!Array.isArray(m.collections)) return { ok: false, reason: 'no_collections' };
      var seen = {};
      var i, c;
      for (i = 0; i < m.collections.length; i++) {
        c = m.collections[i];
        if (!c || !c.id) return { ok: false, reason: 'collection_no_id' };
        if (seen[c.id]) return { ok: false, reason: 'duplicate_id: ' + c.id };
        seen[c.id] = 1;
        if (!c.sources || (!c.sources.movie && !c.sources.tv)) {
          return { ok: false, reason: 'no_sources: ' + c.id };
        }
      }
      return { ok: true };
    }

    /* Поднимает подборки с season-массивом, содержащим month, наверх,
       сохраняя исходный порядок внутри каждой группы (стабильная сортировка). */
    function orderForMonth(list, month) {
      var seasonal = [];
      var rest = [];
      var i;
      for (i = 0; i < list.length; i++) {
        var c = list[i];
        var inSeason = false;
        if (c.season && month) {
          for (var j = 0; j < c.season.length; j++) {
            if (c.season[j] === month) { inSeason = true; break; }
          }
        }
        if (inSeason) { seasonal.push(c); } else { rest.push(c); }
      }
      return seasonal.concat(rest);
    }

    /* Кэш свежий, если не прошло 12 часов (43200 * 1000 мс). */
    function isFresh(rec) {
      if (!rec || !rec.at) return false;
      return (Date.now() - rec.at) < 12 * 3600000;
    }

    /* Текущий загруженный манифест (null до первого load). */
    var current = null;

    /* Загружает манифест с хостинга; при ошибке или отсутствии URL → DEFAULT.
       Кэш 12 часов в Lampa.Storage ('lumen_manifest').
       Lampa.Reguest — штатный XHR (аналогично fetchKp в 43_sources.js). */
    function load(cb) {
      var url = '';
      try {
        if (typeof LC.pref === 'function') url = LC.pref('lumen_manifest_url', '') || '';
      } catch (e) {}
      try {
        if (!url && typeof LC.MANIFEST_URL === 'string') url = LC.MANIFEST_URL || '';
      } catch (e) {}
      if (!url) { current = DEFAULT; cb(DEFAULT); return; }
      var cached = null;
      try { cached = Lampa.Storage.get('lumen_manifest', null); } catch (e) {}
      if (isFresh(cached) && cached && validate(cached.data).ok) {
        current = cached.data;
        cb(current);
        return;
      }
      var sep = url.indexOf('?') >= 0 ? '&' : '?';
      var reqUrl = url + sep + 't=' + Math.floor(Date.now() / 3600000);
      var net = new Lampa.Reguest();
      net.silent(
        reqUrl,
        function (json) {
          if (validate(json).ok) {
            try { Lampa.Storage.set('lumen_manifest', { at: Date.now(), data: json }); } catch (e) {}
            current = json;
            cb(json);
          } else {
            current = (cached && cached.data) || DEFAULT;
            cb(current);
          }
        },
        function () {
          current = (cached && cached.data) || DEFAULT;
          cb(current);
        },
        false,
        { dataType: 'json', timeout: 8000 }
      );
    }

    /* Возвращает текущий манифест. До load() — DEFAULT. */
    function get() {
      return current || DEFAULT;
    }

    return {
      DEFAULT: DEFAULT,
      validate: validate,
      orderForMonth: orderForMonth,
      isFresh: isFresh,
      load: load,
      get: get
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.manifest;

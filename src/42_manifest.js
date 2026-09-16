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
  /* TMDB id основных franchise/collection проверены живыми запросами       */
  /* (API_NOTES_4.md). Идентификаторы companies, networks, keywords взяты   */
  /* из официальной документации TMDB и требуют проверки перед первым       */
  /* деплоем. Кинопоиск: 12 типов коллекций (kinopoiskapiunofficial.tech).  */
  /* -------------------------------------------------------------------- */

  LC.manifest = (function () {

    /* ---- Встроенный манифест ------------------------------------------ */
    var DEFAULT = {
      version: 1,

      /* 10 групп — фиксированный набор (поправки контроллера Task 14).
         title — русский по умолчанию; i18n содержит en/uk. */
      groups: [
        { id: 'franchise', title: 'Франшизы',    i18n: { en: 'Franchises',  uk: 'Франшизи' } },
        { id: 'studio',    title: 'Студии',       i18n: { en: 'Studios',     uk: 'Студії' } },
        { id: 'service',   title: 'Сервисы',      i18n: { en: 'Services',    uk: 'Сервіси' } },
        { id: 'theme',     title: 'Темы',         i18n: { en: 'Themes',      uk: 'Теми' } },
        { id: 'country',   title: 'Страны',       i18n: { en: 'Countries',   uk: 'Країни' } },
        { id: 'era',       title: 'Эпохи',        i18n: { en: 'Eras',        uk: 'Епохи' } },
        { id: 'people',    title: 'Режиссёры',    i18n: { en: 'People',      uk: 'Режисери' } },
        { id: 'top',       title: 'Топ',          i18n: { en: 'Top',         uk: 'Топ' } },
        { id: 'kp',        title: 'Кинопоиск',   i18n: { en: 'Kinopoisk',   uk: 'Кінопошук' } },
        { id: 'mood',      title: 'Настроение',   i18n: { en: 'Mood',        uk: 'Настрій' } }
      ],

      /* 7 чипов хаба (поправки контроллера Task 14: hubGroups).
         title — русский; i18n содержит en/uk. */
      hubGroups: [
        { id: 'franchises', title: 'Франшизы',          i18n: { en: 'Franchises',        uk: 'Франшизи' },         groups: ['franchise'] },
        { id: 'studios',    title: 'Студии и сервисы',  i18n: { en: 'Studios & Services', uk: 'Студії та сервіси' }, groups: ['studio', 'service'] },
        { id: 'themes',     title: 'Темы',              i18n: { en: 'Themes',             uk: 'Теми' },              groups: ['theme'] },
        { id: 'countries',  title: 'Страны',            i18n: { en: 'Countries',          uk: 'Країни' },            groups: ['country'] },
        { id: 'eras',       title: 'Эпохи',             i18n: { en: 'Eras',               uk: 'Епохи' },             groups: ['era'] },
        { id: 'people',     title: 'Режиссёры',         i18n: { en: 'People',             uk: 'Режисери' },          groups: ['people'] },
        { id: 'tops',       title: 'Топ и Кинопоиск',  i18n: { en: 'Top & Kinopoisk',    uk: 'Топ та Кінопошук' }, groups: ['top', 'kp'] }
      ],

      /* 4 чипа настроения (ровно 4, поправки Task 19).
         title — русский; i18n содержит en/uk. */
      moods: [
        { id: 'friday', title: 'Пятничный вечер',  i18n: { en: 'Friday Evening',  uk: 'П\'ятничний вечір' },  sources: { movie: { type: 'discover', params: { genres: '28|12|35', sort_by: 'popularity.desc', filter: { 'vote_average.gte': 6.5, 'with_runtime.lte': 130 } } } } },
        { id: 'family', title: 'Семейный просмотр', i18n: { en: 'Family Viewing',  uk: 'Сімейний перегляд' }, sources: { movie: { type: 'discover', params: { genres: '10751|16', sort_by: 'popularity.desc', filter: { certification_country: 'US', 'certification.lte': 'PG' } } } } },
        { id: 'scary',  title: 'Страшное на ночь',  i18n: { en: 'Scary at Night',  uk: 'Страшне вночі' },    sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } } },
        { id: 'short',  title: '90 минут',           i18n: { en: '90 Minutes',      uk: '90 хвилин' },         sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'with_runtime.lte': 90, 'vote_count.gte': 200 } } } } }
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
          id: 'star-wars', title: 'Звёздные войны', group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'collection', id: 10 },
            tv:    { type: 'discover',   params: { keywords: 379196, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'harry-potter', title: 'Гарри Поттер', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 1241 } }
        },
        {
          id: 'lotr', title: 'Властелин колец', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 119 } }
        },
        {
          id: 'hobbit', title: 'Хоббит', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 121938 } }
        },
        {
          id: 'john-wick', title: 'Джон Уик', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 404609 } }
        },
        {
          id: 'mission-impossible', title: 'Миссия невыполнима', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 87359 } }
        },
        {
          id: 'matrix', title: 'Матрица', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 2344 } }
        },
        {
          id: 'terminator', title: 'Терминатор', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 528 } }
        },

        /* === STUDIO (6 подборок) === */
        {
          id: 'pixar', title: 'Pixar', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 3, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'ghibli', title: 'Студия Гибли', group: 'studio',
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
          id: 'netflix-comedy', title: 'Netflix: Комедии', group: 'service', badge: 'NETFLIX',
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
          id: 'netflix-series', title: 'Netflix: Сериалы', group: 'service', badge: 'NETFLIX',
          sources: { tv: { type: 'discover', params: { networks: 213, sort_by: 'popularity.desc' } } }
        },

        /* === THEME (7 подборок) === */
        {
          id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1],
          sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'halloween', title: 'Хэллоуин', group: 'theme', icon: 'star', season: [9, 10, 11],
          sources: { movie: { type: 'discover', params: { genres: 27, keywords: 3335, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'comedy', title: 'Комедии', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 35, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'superhero', title: 'Супергерои', group: 'theme',
          sources: {
            movie: { type: 'discover', params: { genres: '28|12', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { genres: '10759|10765', sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'horror-top', title: 'Хоррор', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'documentary', title: 'Документальное', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 99, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'thriller', title: 'Триллеры', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 53, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },

        /* === COUNTRY (7 подборок) === */
        {
          id: 'kdrama', title: 'Корейские дорамы', group: 'country',
          sources: { tv: { type: 'discover', params: { genres: 18, sort_by: 'popularity.desc', filter: { with_origin_country: 'KR' } } } }
        },
        {
          id: 'anime', title: 'Аниме', group: 'country',
          sources: { tv: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
        },
        {
          id: 'turkish', title: 'Турецкие сериалы', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'TR' } } } }
        },
        {
          id: 'french', title: 'Французское кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'FR', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'british', title: 'Британское ТВ', group: 'country',
          sources: {
            tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB' } } },
            movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'GB', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'bollywood', title: 'Болливуд', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'IN', 'vote_count.gte': 50 } } } }
        },
        {
          id: 'spanish', title: 'Испанские сериалы', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'ES' } } } }
        },

        /* === ERA (5 подборок) === */
        {
          id: 'best-70s', title: 'Лучшее из 70-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1970-01-01', 'primary_release_date.lte': '1979-12-31', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'best-80s', title: 'Лучшее из 80-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1980-01-01', 'primary_release_date.lte': '1989-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-90s', title: 'Лучшее из 90-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1990-01-01', 'primary_release_date.lte': '1999-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-2000s', title: 'Лучшее из 2000-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2000-01-01', 'primary_release_date.lte': '2009-12-31', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'best-2010s', title: 'Лучшее из 2010-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2010-01-01', 'primary_release_date.lte': '2019-12-31', 'vote_count.gte': 500 } } } }
        },

        /* === PEOPLE (8 подборок) === */
        {
          id: 'nolan', title: 'Кристофер Нолан', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 525 } } } }
        },
        {
          id: 'tarantino', title: 'Квентин Тарантино', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 138 } } } }
        },
        {
          id: 'dicaprio', title: 'Леонардо ДиКаприо', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6193 } } } }
        },
        {
          id: 'spielberg', title: 'Стивен Спилберг', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 488 } } } }
        },
        {
          id: 'fincher', title: 'Дэвид Финчер', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 7467 } } } }
        },
        {
          id: 'scorsese', title: 'Мартин Скорсезе', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1032 } } } }
        },
        {
          id: 'villeneuve', title: 'Дени Вильнёв', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 137427 } } } }
        },
        {
          id: 'miyazaki', title: 'Хаяо Миядзаки', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 608 } } } }
        },

        /* === TOP (3 подборки) === */
        {
          id: 'top-grossing', title: 'Кассовые хиты', group: 'top',
          sources: { movie: { type: 'list', id: 10 } }
        },
        {
          id: 'top-rated', title: 'Высокий рейтинг', group: 'top',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 1000, 'vote_average.gte': 8 } } } }
        },
        {
          id: 'popular-all', title: 'Популярное сейчас', group: 'top',
          sources: {
            movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
          }
        },

        /* === KP (12 типов Кинопоиска) === */
        {
          id: 'kp-top250', title: 'КП Топ-250 фильмов', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_250_MOVIES' } }
        },
        {
          id: 'kp-top250-tv', title: 'КП Топ-250 сериалов', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_250_TV_SHOWS' } }
        },
        {
          id: 'kp-popular-all', title: 'КП Популярное', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'TOP_POPULAR_ALL' } }
        },
        {
          id: 'kp-popular-series', title: 'КП Популярные сериалы', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'POPULAR_SERIES' } }
        },
        {
          id: 'kp-family', title: 'КП Семейные', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'FAMILY' } }
        },
        {
          id: 'kp-animation', title: 'КП Анимация', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'KIDS_ANIMATION_THEME' } }
        },
        {
          id: 'kp-comics', title: 'КП Комиксы', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'COMICS_THEME' } }
        },
        {
          id: 'kp-vampire', title: 'КП Вампиры', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'VAMPIRE_THEME' } }
        },
        {
          id: 'kp-zombie', title: 'КП Зомби', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'ZOMBIE_THEME' } }
        },
        {
          id: 'kp-love', title: 'КП Романтика', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'LOVE_THEME' } }
        },
        {
          id: 'kp-catastrophe', title: 'КП Катастрофы', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'CATASTROPHE_THEME' } }
        },
        {
          id: 'kp-oscars', title: 'КП Лауреаты Оскара', group: 'kp', badge: 'KINOPOISK',
          sources: { movie: { type: 'kp', collection: 'OSKAR_WINNERS_2021' } }
        }

      ] /* /collections */
    };

    /* ---- Вспомогательные чистые функции -------------------------------- */

    /* Возвращает {ok, reason}.
       Проверяет: не null, есть version; collections — массив без дублей id,
       у каждой подборки есть id, title (строка непустая) и sources (movie или tv);
       groups — непустой массив; home — массив (может быть пустым). */
    function validate(m) {
      if (!m || typeof m !== 'object' || Array.isArray(m)) {
        return { ok: false, reason: 'not_object' };
      }
      if (!m.version) return { ok: false, reason: 'no_version' };
      if (!Array.isArray(m.collections)) return { ok: false, reason: 'no_collections' };
      if (!Array.isArray(m.groups) || m.groups.length === 0) return { ok: false, reason: 'no_groups' };
      if (!Array.isArray(m.home)) return { ok: false, reason: 'no_home' };
      var seen = {};
      var i, c;
      for (i = 0; i < m.collections.length; i++) {
        c = m.collections[i];
        if (!c || !c.id) return { ok: false, reason: 'collection_no_id' };
        if (typeof c.title !== 'string' || !c.title) {
          return { ok: false, reason: 'collection_no_title: ' + c.id };
        }
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

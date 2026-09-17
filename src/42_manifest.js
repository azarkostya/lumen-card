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
  /* Все идентификаторы TMDB проверены живыми запросами — см. API_NOTES_4. */
  /* НЕ подтверждены и НЕ включены: col 8783 (Ice Age — чужая коллекция),  */
  /* col 398 (Kingsman — ошибка), col 576734 (ОС), col 654159 (Веном).     */
  /* Правильные: Ice Age 8354, Kingsman 391860, ОС 531242, Веном 558216.    */
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

      /* ---- 150 подборок ------------------------------------------------ */
      collections: [

        /* === FRANCHISE (34 подборки) === */

        /* Существующие (8) */
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

        /* Новые (26), проверены live — API_NOTES_4.md */
        {
          id: 'avengers', title: 'Мстители', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 86311 } }
        },
        {
          id: 'xmen', title: 'Люди Икс', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 748 } }
        },
        {
          id: 'dark-knight', title: 'Тёмный рыцарь', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 263 } }
        },
        {
          id: 'james-bond', title: 'Джеймс Бонд', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 645 } }
        },
        {
          id: 'fast-furious', title: 'Форсаж', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 9485 } }
        },
        {
          id: 'alien', title: 'Чужой', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 8091 } }
        },
        {
          id: 'predator', title: 'Хищник', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 399 } }
        },
        {
          id: 'jurassic-park', title: 'Парк Юрского периода', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 328 } }
        },
        {
          id: 'indiana-jones', title: 'Индиана Джонс', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 84 } }
        },
        {
          id: 'back-to-future', title: 'Назад в будущее', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 264 } }
        },
        {
          id: 'rocky', title: 'Рокки', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 1575 } }
        },
        {
          id: 'die-hard', title: 'Крепкий орешек', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 1570 } }
        },
        {
          id: 'pirates-caribbean', title: 'Пираты Карибского моря', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 295 } }
        },
        {
          id: 'transformers', title: 'Трансформеры', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 8650 } }
        },
        {
          id: 'twilight', title: 'Сумерки. Сага', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 33514 } }
        },
        {
          id: 'hunger-games', title: 'Голодные игры', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 131635 } }
        },
        {
          id: 'dune', title: 'Дюна', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 726871 } }
        },
        {
          id: 'shrek', title: 'Шрек', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 2150 } }
        },
        {
          id: 'toy-story', title: 'История игрушек', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 10194 } }
        },
        {
          id: 'despicable-me', title: 'Гадкий я', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 86066 } }
        },
        {
          id: 'spiderman-mcu', title: 'Человек-паук', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 531241 } }
        },
        {
          id: 'madagascar', title: 'Мадагаскар', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 14740 } }
        },
        {
          id: 'ice-age', title: 'Ледниковый период', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 8354 } }
        },
        {
          id: 'kingsman', title: 'Kingsman', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 391860 } }
        },
        {
          id: 'suicide-squad', title: 'Отряд самоубийц', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 531242 } }
        },
        {
          id: 'venom', title: 'Веном', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 558216 } }
        },

        /* === STUDIO (16 подборок) === */

        /* Существующие (6) */
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

        /* Новые (10), companies проверены live */
        {
          id: 'warner-bros', title: 'Warner Bros.', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 174, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'universal', title: 'Universal Pictures', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 33, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'paramount', title: 'Paramount Pictures', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 4, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'sony-pictures', title: 'Sony Pictures', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 5, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'dreamworks', title: 'DreamWorks Animation', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 521, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'illumination', title: 'Illumination', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 6704, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'blumhouse', title: 'Blumhouse', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 3172, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'legendary', title: 'Legendary Pictures', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 923, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'fox', title: '20th Century Studios', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 25, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'miramax', title: 'Miramax', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 14, sort_by: 'popularity.desc' } } }
        },

        /* === SERVICE (8 подборок) === */

        /* Существующие (6) */
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

        /* Новые (2), networks проверены live */
        {
          id: 'hulu', title: 'Hulu', group: 'service', badge: 'HULU',
          sources: { tv: { type: 'discover', params: { networks: 453, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'paramount-plus', title: 'Paramount+', group: 'service', badge: 'PARAMOUNT+',
          sources: { tv: { type: 'discover', params: { networks: 4330, sort_by: 'popularity.desc' } } }
        },

        /* === THEME (30 подборок) === */

        /* Существующие (7) */
        {
          id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1],
          sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
        },
        /* Task 21 (фаза 3): рождественское кино без привязки к жанру — тот
           же keyword 207317, что у «Рождественских комедий», но без
           genres: 35. Отдельная подборка нужна адвент-календарю: его пул
           собирается из этих двух, и одними комедиями 24 дня не закрыть. */
        {
          id: 'christmas', title: 'Рождественское кино', group: 'theme', icon: 'star', season: [12, 1],
          sources: { movie: { type: 'discover', params: { keywords: 207317, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
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

        /* Новые (23), keywords и genres проверены live */
        {
          id: 'space', title: 'Космос', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 9882, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'post-apocalyptic', title: 'Постапокалипсис', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 359337, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'zombie', title: 'Зомби', group: 'theme',
          sources: {
            movie: { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
            tv:    { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'vampire', title: 'Вампиры', group: 'theme',
          sources: {
            movie: { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
            tv:    { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'spy', title: 'Шпионы', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 470, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'heist', title: 'Ограбления', group: 'theme',
          sources: {
            movie: { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'survival', title: 'Выживание', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 10349, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'sport', title: 'Спорт', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 333328, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'biopic', title: 'Байопики', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 360939, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'noir', title: 'Нуар', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 9807, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'slasher', title: 'Слэшеры', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 12339, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'road-movie', title: 'Роуд-муви', group: 'theme',
          sources: { movie: { type: 'discover', params: { keywords: 167043, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'romcom', title: 'Романтические комедии', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: '35|10749', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'psycho-thriller', title: 'Психологические триллеры', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: '9648|53', sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'anime-movies', title: 'Аниме-фильмы', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
        },
        {
          id: 'fantasy', title: 'Фэнтези', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 14, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'scifi', title: 'Научная фантастика', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'western', title: 'Вестерны', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 37, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'new-year', title: 'Новогоднее', group: 'theme', icon: 'star', season: [12, 1],
          sources: { movie: { type: 'discover', params: { keywords: 252123, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'war-movies', title: 'Военные фильмы', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 10752, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'musical', title: 'Мюзиклы', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 10402, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'crime', title: 'Криминал', group: 'theme',
          sources: { movie: { type: 'discover', params: { genres: 80, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },

        /* === COUNTRY (14 подборок) === */

        /* Существующие (7) */
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

        /* Новые (7), страны проверены live */
        {
          id: 'japan-movies', title: 'Японское кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'JP', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'italy', title: 'Итальянское кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'IT', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'russia', title: 'Российское кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'RU', 'vote_count.gte': 50 } } } }
        },
        {
          id: 'nordic', title: 'Скандинавские сериалы', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'SE' } } } }
        },
        {
          id: 'norway', title: 'Норвежские сериалы', group: 'country',
          sources: { tv: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'NO' } } } }
        },
        {
          id: 'germany', title: 'Немецкое кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { with_origin_country: 'DE', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'australia', title: 'Австралийское кино', group: 'country',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_origin_country: 'AU', 'vote_count.gte': 50 } } } }
        },

        /* === ERA (9 подборок) === */

        /* Существующие (5) */
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

        /* Новые (4) — аналогичные запросы, проверять не нужно */
        {
          id: 'best-50s', title: 'Лучшее из 50-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1950-01-01', 'primary_release_date.lte': '1959-12-31', 'vote_count.gte': 200 } } } }
        },
        {
          id: 'best-60s', title: 'Лучшее из 60-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '1960-01-01', 'primary_release_date.lte': '1969-12-31', 'vote_count.gte': 200 } } } }
        },
        {
          id: 'best-2020s', title: 'Лучшее из 2020-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.gte': '2020-01-01', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'best-classics', title: 'Классика до 50-х', group: 'era',
          sources: { movie: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'primary_release_date.lte': '1949-12-31', 'vote_count.gte': 100 } } } }
        },

        /* === PEOPLE (21 подборка) === */

        /* Существующие (8) */
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

        /* Новые (13), person ID проверены live */
        {
          id: 'ridley-scott', title: 'Ридли Скотт', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 578 } } } }
        },
        {
          id: 'cameron', title: 'Джеймс Кэмерон', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 2710 } } } }
        },
        {
          id: 'del-toro', title: 'Гильермо дель Торо', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 10828 } } } }
        },
        {
          id: 'wes-anderson', title: 'Уэс Андерсон', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5655 } } } }
        },
        {
          id: 'coen-brothers', title: 'Братья Коэн', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: '1223|1224' } } } }
        },
        {
          id: 'tom-hanks', title: 'Том Хэнкс', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 31 } } } }
        },
        {
          id: 'keanu-reeves', title: 'Киану Ривз', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6384 } } } }
        },
        {
          id: 'denzel', title: 'Дензел Вашингтон', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5292 } } } }
        },
        {
          id: 'brad-pitt', title: 'Брэд Питт', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 287 } } } }
        },
        {
          id: 'scarlett', title: 'Скарлетт Йоханссон', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1245 } } } }
        },
        {
          id: 'kubrick', title: 'Стэнли Кубрик', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 240 } } } }
        },
        {
          id: 'de-niro', title: 'Роберт Де Ниро', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 380 } } } }
        },
        {
          id: 'tom-cruise', title: 'Том Круз', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 500 } } } }
        },

        /* === TOP (4 подборки) === */

        /* Существующие (3) */
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

        /* Новая (1), discover/tv проверен live */
        {
          id: 'top-tv', title: 'Лучшие сериалы', group: 'top',
          sources: { tv: { type: 'discover', params: { sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200, 'vote_average.gte': 8 } } } }
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

      ], /* /collections */

      /* Task 21 (фаза 3): правила тематических атмосфер. Порядок значим —
         побеждает ПЕРВОЕ правило, чьё ключевое слово нашлось у фильма
         (src/53_themes.js, matchTheme), поэтому праздники стоят раньше
         общих тем: «рождественский хоррор» получает снег, а не летучих
         мышей. keywords сравниваются по вхождению в название ключевого
         слова TMDB без учёта регистра.

         requireGenre требует И слово, И жанр из списка genres: слово
         «halloween» у комедии — это шутка про праздник, а не хоррор.
         months — сезон темы: он не участвует в подборе (фильм про Рождество
         остаётся рождественским в июле), но в режиме настройки «Только
         сезонные» показываются лишь темы со своим месяцем и лишь в него.

         accent — цвет темы, пока карточка открыта. У halloween это
         #E07B2C по экспорту дизайна (поправки контроллера к Task 21), а не
         #E58A2E из первой редакции плана.

         Каталог с хостинга может этот список заменить целиком — правила
         обновляются без переустановки плагина. */
      themes: [
        { id: 'halloween', preset: 'bats', accent: '#E07B2C', keywords: ['halloween', 'haunted house', 'slasher', 'witch', 'trick or treat'], genres: [27], months: [10], requireGenre: true },
        { id: 'christmas', preset: 'snow', accent: '#E8C170', keywords: ['christmas', 'santa claus', 'new year', 'christmas eve'], months: [12, 1] },
        { id: 'space', preset: 'stars', accent: '#8FB8D9', keywords: ['space', 'alien', 'spaceship', 'astronaut', 'outer space'] },
        { id: 'noir', preset: 'rain', accent: '#9AA7B5', keywords: ['film noir', 'detective', 'private detective', 'neo-noir'] },
        { id: 'desert', preset: 'sand', accent: '#E8B87A', keywords: ['desert', 'sand', 'dune'] },
        { id: 'ocean', preset: 'bubbles', accent: '#7FB7C9', keywords: ['ocean', 'underwater', 'shark', 'submarine', 'sea'] },
        { id: 'sakura', preset: 'petals', accent: '#E6A3B8', keywords: ['cherry blossom', 'anime', 'romance'], genres: [16], requireGenre: true },
        { id: 'war', preset: 'embers', accent: '#C97B4A', keywords: ['war', 'world war ii', 'explosion', 'battle'] },
        { id: 'zombie', preset: 'glitch', accent: '#9FCF8A', keywords: ['zombie', 'undead', 'zombie apocalypse'] }
      ]
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
      /* Task 21 (фаза 3): правила тем — необязательное поле (каталог без
         них просто не даёт атмосфер), но если оно есть, то обязано быть
         массивом: LC.themes.matchTheme перебирает его напрямую. */
      if (typeof m.themes !== 'undefined' && !Array.isArray(m.themes)) {
        return { ok: false, reason: 'themes_not_array' };
      }
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

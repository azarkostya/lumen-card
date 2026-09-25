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
  /* (Правка 2026-09-25: «Веном» и «Отряд самоубийц» из каталога сняты —   */
  /* вторая вошла во «Вселенную DC», первая открывается кнопкой «Франшиза» */
  /* в карточке любого фильма коллекции 558216.)                           */
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

      /* ---- 165 подборок ------------------------------------------------ */
      /* cover (необязательное, правка 2026-09-25) — путь кадра TMDB для
         плитки хаба. Без него кадр берётся из первой страницы подборки
         (LC.sources.bannerPath: backdrop_path первой карточки), и у
         подборок с общим лидером кадр один и тот же: на скрине пользователя
         «Рождественские комедии» и «Рождественское кино» (одно ключевое
         слово, одна сортировка) обе показывали «Вам письмо». Живой прогон
         всех 138 TMDB-подборок каталога 2026-09-25 нашёл 17 таких групп на
         40 плиток: «История игрушек 5» у Pixar, Тома Хэнкса и Киану Ривза,
         «Человек-паук: Новый день» у Marvel Studios, Sony, «Супергероев»,
         «Научной фантастики» и «Популярного сейчас», «Начало» у «Шпионов»,
         «Ограблений» и ДиКаприо и т. д.
         Кадр в cover — всегда НЕ основной backdrop_path своего фильма
         (другой кадр без текста, iso_639_1 = null, от 1280 px, не из списка
         ambient): основной кадр — ровно то, что плитка без cover берёт из
         выдачи, так что совпасть с живой плиткой cover не может, как бы ни
         менялась популярность. cover задан у всех тем (тема абстрактна,
         лидер её выдачи — случайный фильм: «Чудаки» у «Документального»,
         «Мстители» у «Супергероев») и у одной-двух плиток каждой группы
         совпадений; «владелец» кадра (Pixar — «История игрушек 5», Гибли —
         «Ходячий замок», Нолан — «Одиссея») остаётся живым. Плитка с cover
         не делает запроса вовсе. Подборке Кинопоиска cover не задаётся:
         без ключа плитка обязана сказать «нужен ключ». */
      collections: [

        /* === FRANCHISE (34 подборки) === */

        /* Существующие (8) */
        /* Сериальная половина франшиз — по СТУДИЯМ, а не по ключевому слову
           (правка 2026-09-23; данные TMDB сняты со стенда в тот же день).

           «Звёздные войны». Прежний источник — discover/tv по ключевому слову
           «star wars» (379196) — отдавал два сериала: «Видения. Девятый
           джедай» и подкаст (его убрал 8c60da8). Остальные сериалы этим
           словом не помечены, и общего ключевого слова у них нет вовсе:
           по ключевым словам 27 сериалов франшизы «space opera» (161176)
           стоит у 10, «star wars» — у одного; у «Оби-Вана Кеноби», «Бракованной
           партии», «Книги Бобы Фетта» и «Сказаний» нет ни того, ни другого.
           Общее у всех одно — студия Lucasfilm (company 1): discover/tv по
           ней отдаёт 45 позиций, и среди них все сериалы франшизы, включая
           ещё не вышедшие («Мол. Повелитель теней», 2026) — то есть новые
           сериалы попадут в подборку сами.
           Лишнее у Lucasfilm трёх видов, и каждое снято признаком из данных:
           - «Maniac Mansion» (1990, комедия) и документальные / новостные
             выпуски о франшизе (Disney Gallery ×2, LIGHT & MAGIC, This Week!
             in Star Wars, Science of Star Wars, Making Star Wars, The
             Mandalorian and Grogu | A Special Look) — условие жанра
             10765|16 («фантастика и фэнтези» ИЛИ «анимация»): у всех
             сериалов франшизы есть хотя бы один из двух (у «Приключений
             юных джедаев» — только анимация), у этих — ни одного;
           - «Уиллоу» (2022) — Lucasfilm без соавторов и с жанром 10765; снят
             ключевым словом «high fantasy» (211227), которого нет ни у
             одного сериала франшизы;
           - «Хроники молодого Индианы Джонса» (1992) — ключевым словом
             «treasure hunter» (215470), тоже не встречающимся у них.
           Итог запроса (стенд, 2026-09-23): 35 позиций, все — «Звёздные
           войны». Цена: если TMDB однажды пометит новый сериал франшизы
           словом «high fantasy» или «treasure hunter», он из подборки
           выпадет; если Lucasfilm снимет не-франшизный сериал с жанром
           фантастики, он в неё попадёт. Ручной список id такой цены не
           имеет, зато устаревает с каждым новым сериалом — выбран запрос.

           Фильмы «Звёздных войн» — тем же способом (решение координатора по
           ревью фикс-раундов, Ф3): коллекция TMDB 10 — это только сага, 9
           эпизодов, а «Изгой-один» (330459) и «Хан Соло» (348350) ни в какую
           коллекцию не входят (belongs_to_collection: null). Объединять
           коллекцию с явными id механизм источников не умеет, а запрос
           умеет всё: Lucasfilm (1) И «фантастика» (878), без
           документального (99), телефильмов (10770), комедий (35) и
           семейного (10751), от 200 голосов, по дате выхода. Итог
           (2026-09-23, ru-RU и en-US одинаково): 13 фильмов, все —
           «Звёздные войны»: девять эпизодов, «Изгой-один», «Хан Соло» и
           ещё два, которых в коллекции не было, — «Войны клонов» (12180,
           2008) и «Мандалорец и Грогу» (1228710, 2026). Что снято
           признаками: «Праздничный спецвыпуск» и оба фильма об эвоках —
           телефильмы, «Говард-утка» и «Робоцып» — комедии, LEGO — семейные,
           документальные спецвыпуски — 99. Порог голосов отсекает
           единственное чужое, что остаётся без него, — «Captain EO»
           (1500440, 55 голосов), а заодно анонсы без даты и голосов:
           новый фильм франшизы войдёт, когда наберёт 200 голосов. Цена та
           же, что у сериалов: фантастика Lucasfilm вне франшизы с 200
           голосами попала бы в подборку.

           «Гарри Поттер» и «Властелин колец». Та же дыра — сериалов не было
           вовсе. Ключевых слов франшизы у сериалов нет (у «Гарри Поттера»
           HBO и у «Колец власти» из общих слов только «based on novel or
           book»), а по одной студии в выдачу идёт чужое (Heyday Films —
           «Паддингтон» и «Захват», New Line — «Сумеречная зона» и «Тёмные
           начала»). Точный запрос — ПЕРЕСЕЧЕНИЕ двух студий (запятая в
           with_companies у TMDB — «и»): Heyday Films (437, продюсер всех
           фильмов) и HBO (3268) — ровно «Гарри Поттер» (224377, 2026);
           New Line Cinema (12, студия трилогии) и Amazon Studios (20580) —
           ровно «Кольца власти» (84773). Новые сезоны живут под тем же id,
           новый сериал тех же двух студий попадёт сам. */
        {
          id: 'star-wars', title: 'Звёздные войны', group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'discover',   params: { companies: 1, genres: 878, sort_by: 'primary_release_date.asc', filter: { without_genres: '99,10770,35,10751', 'vote_count.gte': 200 } } },
            tv:    { type: 'discover',   params: { companies: 1, genres: '10765|16', sort_by: 'popularity.desc', filter: { without_keywords: '211227,215470' } } }
          }
        },
        {
          id: 'harry-potter', title: 'Гарри Поттер', group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'collection', id: 1241 },
            tv:    { type: 'discover',   params: { companies: '437,3268', sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'lotr', title: 'Властелин колец', group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'collection', id: 119 },
            tv:    { type: 'discover',   params: { companies: '12,20580', sort_by: 'popularity.desc' } }
          }
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

        /* Правка 2026-09-25 (жалоба пользователя: «зачем мне „Веном“ и
           „Отряд самоубийц“, но нет ни Marvel, ни DC»). Живые запросы TMDB
           через прокси Lampa, ru-RU, 2026-09-25.

           «Киновселенная Marvel» — ключевое слово TMDB «marvel cinematic
           universe (mcu)» (180547), а не студия. Студия Marvel Studios (420)
           тянет чужой канон: «Человек-паук 3» Рэйми, «Призрачного гонщика»
           (2007), «Фантастическую четвёрку» (2007), «Карателя: Территория
           войны» и десятки мультфильмов direct-to-video; «Веном» и Fox-овские
           «Люди Икс» в MCU не входят и под словом 180547 не стоят. Под словом —
           80 фильмов, из них лишние трёх видов, и каждый снят признаком:
           документальные «Общий сбор» / «Создание вселенной» — жанр 99;
           короткометражки «Я есть Грут» — анимация 16; короткометражки
           One-Shot и «Команда Тора» (10-15 минут, 600-950 голосов, по голосам
           не отсекаются) — with_runtime.gte 40. Остаётся 42 фильма по дате
           выхода: «Железный человек» (2008) … «Дэдпул и Росомаха»,
           «Громовержцы*», «Фантастическая четвёрка: Первые шаги»,
           «Человек-паук: Новый день», «Мстители: Доктор Дум»; спецвыпуски
           Disney+ «Ночной оборотень» и «Праздничный спецвыпуск Стражей» — это
           канон, они проходят (53 и 44 минуты). Анонсы без хронометража
           («Люди Икс» 2028, «Чёрная пантера 3») не проходят — войдут, когда
           TMDB проставит длительность.
           Сериалы — то же слово без документального (99) и новостного (10763,
           веб-выпуски WHIH Newsfront): 32 позиции — «Локи», «ВандаВижн»,
           «Сорвиголова: Рождённый заново», «Что, если…?», сериалы Netflix
           2015-2018 (TMDB числит их в MCU), подкаст отсекает talkOnly. */
        {
          id: 'mcu', title: 'Киновселенная Marvel', i18n: { en: 'Marvel Cinematic Universe', uk: 'Кіновсесвіт Marvel' }, group: 'franchise', icon: 'film',
          sources: {
            movie: { type: 'discover', params: { keywords: 180547, sort_by: 'primary_release_date.asc', filter: { without_genres: '99,16', 'with_runtime.gte': 40 } } },
            tv:    { type: 'discover', params: { keywords: 180547, sort_by: 'popularity.desc', filter: { without_genres: '99,10763' } } }
          }
        },
        {
          id: 'avengers', title: 'Мстители', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 86311 } }
        },
        {
          id: 'xmen', title: 'Люди Икс', group: 'franchise', icon: 'film',
          sources: { movie: { type: 'collection', id: 748 } }
        },
        /* «Вселенная DC» — все игровые фильмы и сериалы по комиксам DC, не
           только DCEU. Ключевые слова DCEU (229266) и DCU (312528) дают 18
           фильмов 2013-2026 и не знают ни Нолана, ни «Джокера», ни «Бэтмена»
           (2022) — а их зритель ищет под словом «DC» первыми. Поэтому запрос
           по студиям ИЛИ (черта в with_companies): DC Comics (429), DC
           Entertainment (9993), DC Films (128064), DC Studios (184898).
           Без анимации (16 — у DC её десятки: LEGO, direct-to-video,
           «Юные титаны»), документального (99) и телефильмов (10770), от 300
           голосов, по дате: 30 фильмов — «Бэтмен: Начало», «Тёмный рыцарь»,
           «Хранители», «Зелёный Фонарь», «Человек из стали», оба «Отряда
           самоубийц», «Чудо-женщина», «Аквамен», «Шазам!», «Джокер»,
           «Бэтмен» (2022), «Флэш», «Синий Жук», «Супермен» (2025),
           «Супергёрл» (2026). Цена: ранние фильмы без студии DC в титрах TMDB
           («Бэтмен» 1989, «Супермен» 1978, «Константин», «Джокер: Безумие на
           двоих») сюда не попадают; «РЭД» (Summit по комиксу DC) — попадает.
           Сериалы — те же студии кроме DC Films (сериалов у неё нет) без
           детского (10762) и семейного (10751), от 50 голосов: «Фонари»,
           «Флэш», «Стрела», «Тайны Смолвиля», «Люцифер», «Пингвин»,
           «Миротворец», «Песочный человек», «Харли Квинн» — 39 позиций.
           Кадр плитки задан (cover): первым по дате идёт «Бэтмен: Начало», и
           его кадр совпал бы с плиткой «Тёмный рыцарь» в той же вкладке. */
        {
          id: 'dc-universe', title: 'Вселенная DC', i18n: { en: 'DC Universe', uk: 'Всесвіт DC' }, group: 'franchise', icon: 'film', cover: '/pcDc2WJAYGJTTvRSEIpRZwM3Ola.jpg',
          sources: {
            movie: { type: 'discover', params: { companies: '429|9993|128064|184898', sort_by: 'primary_release_date.asc', filter: { without_genres: '16,99,10770', 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { companies: '429|9993|184898', sort_by: 'popularity.desc', filter: { without_genres: '99,10762,10751', 'vote_count.gte': 50 } } }
          }
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
          id: 'marvel', title: 'Marvel Studios', group: 'studio', cover: '/9wXPKruA6bWYk2co5ix6fH59Qr8.jpg',
          /* Правка 2026-09-23: сериалов у подборки не было вовсе, хотя
             студия та же — discover/tv по Marvel Studios (420) отдаёт 35
             позиций: «Локи», «Ванда/Вижн», «Сорвиголова: Рождённый заново»,
             «Люди Икс '97» и т. д. Документальные выпуски о студии
             (Marvel Studios Legends, Assembled, Voices Rising) сняты жанром
             99 — у игровых и мультсериалов его нет (стенд, данные TMDB). */
          sources: {
            movie: { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc' } },
            tv:    { type: 'discover', params: { companies: 420, sort_by: 'popularity.desc', filter: { without_genres: '99' } } }
          }
        },
        {
          id: 'a24', title: 'A24', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 41077, sort_by: 'popularity.desc' } } }
        },
        /* Правка 2026-09-25: company 128064 на TMDB — «DC Films» (метка
           2016-2022: «Отряд самоубийц», «Аквамен», «Джокер»), а сама DC
           Studios — отдельная запись 184898 («Супермен» 2025, «Супергёрл»,
           «Пингвин», «Миротворец», «Фонари»). Подборка под именем DC Studios
           показывала только прежнюю метку — теперь обе (черта — ИЛИ), и у
           студии появились сериалы (от 10 голосов — без анонсов без даты:
           «Absolute Batman», «Starfire!»). */
        {
          id: 'dc', title: 'DC Studios', group: 'studio',
          sources: {
            movie: { type: 'discover', params: { companies: '128064|184898', sort_by: 'popularity.desc' } },
            tv:    { type: 'discover', params: { companies: 184898, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 10 } } }
          }
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
          id: 'universal', title: 'Universal Pictures', group: 'studio', cover: '/kJMLPj5enrZti8udTVeULlM70mz.jpg',
          sources: { movie: { type: 'discover', params: { companies: 33, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'paramount', title: 'Paramount Pictures', group: 'studio',
          sources: { movie: { type: 'discover', params: { companies: 4, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'sony-pictures', title: 'Sony Pictures', group: 'studio', cover: '/rz3TAyd5kmiJmozp3GUbYeB5Kep.jpg',
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
          id: 'netflix-series', title: 'Netflix: Сериалы', group: 'service', badge: 'NETFLIX', cover: '/8zbAoryWbtH0DKdev8abFAjdufy.jpg',
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

        /* === THEME (47 подборок) === */

        /* Существующие (7) */
        {
          id: 'xmas-comedy', title: 'Рождественские комедии', group: 'theme', icon: 'star', season: [12, 1], cover: '/vaVaNrscmsG8CUKYxiwZGFNqGJo.jpg',
          sources: { movie: { type: 'discover', params: { genres: 35, keywords: 207317, sort_by: 'popularity.desc' } } }
        },
        /* Task 21 (фаза 3): рождественское кино без привязки к жанру — тот
           же keyword 207317, что у «Рождественских комедий», но без
           genres: 35. Отдельная подборка нужна адвент-календарю: его пул
           собирается из этих двух, и одними комедиями 24 дня не закрыть. */
        {
          id: 'christmas', title: 'Рождественское кино', group: 'theme', icon: 'star', season: [12, 1], cover: '/y8Mabq84N0d5fm83CWb9Zkltkwr.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 207317, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'halloween', title: 'Хэллоуин', group: 'theme', icon: 'star', season: [9, 10, 11], cover: '/aRka9neADW1M0Zf9lF8kW2jEgXe.jpg',
          sources: { movie: { type: 'discover', params: { genres: 27, keywords: 3335, sort_by: 'popularity.desc' } } }
        },
        {
          id: 'comedy', title: 'Комедии', group: 'theme', cover: '/ubiu5Y7nP187ZFWUzjPj7Hgw6Go.jpg',
          sources: { movie: { type: 'discover', params: { genres: 35, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'superhero', title: 'Супергерои', group: 'theme', cover: '/IYUD7rAIXzBM91TT3Z5fILUS7n.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 9715, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { keywords: 9715, sort_by: 'popularity.desc', filter: { without_genres: '10762,10751', 'vote_count.gte': 200 } } }
          }
        },
        {
          id: 'horror-top', title: 'Хоррор', group: 'theme', cover: '/mmd1HnuvAzFc4iuVJcnBrhDNEKr.jpg',
          sources: { movie: { type: 'discover', params: { genres: 27, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'documentary', title: 'Документальное', group: 'theme', cover: '/e5NzCG9eoWTDABPIGeB362ztV9R.jpg',
          sources: { movie: { type: 'discover', params: { genres: 99, sort_by: 'popularity.desc', filter: { without_genres: '35', 'vote_count.gte': 100 } } } }
        },
        {
          id: 'thriller', title: 'Триллеры', group: 'theme', cover: '/lDJx0ZKbfYbGoe8mwWmVKSQr0ub.jpg',
          sources: { movie: { type: 'discover', params: { genres: 53, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },

        /* Новые (23), keywords и genres проверены live.
           Правка 2026-09-25 — живые запросы TMDB (прокси Lampa, ru-RU),
           первые 20 позиций каждой:
           - «Супергерои» были жанрами 28|12 (боевик ИЛИ приключения) —
             «Обитель зла», «Хитрый Койот», «Моана», «История игрушек 5»;
             у сериалов 10759|10765 — «Ричер», «Морская полиция», «Игра
             престолов». Теперь ключевое слово «superhero» (9715).
           - «Романтические комедии» были '35|10749' (комедия ИЛИ
             романтика) — «Моана», «Миньоны и монстры». Теперь '35,10749'
             (И): «Больше чем секс», «Вам письмо», «Предложение», «Амели».
           - «Психологические триллеры» были '9648|53' (любой детектив или
             триллер) — теперь ключевое слово «psychological thriller»
             (12565): «Паразиты», «Психо», «Остров проклятых», «Мементо».
           - «Спорт» (333328) давал 17 фильмов, первым — хоррор «Тот
             самый»; теперь «sports» | «sports drama» | «sport» И драма, без
             документального и анимации (иначе первыми «Тачки»): «F1»,
             «Ford против Ferrari», «Крид», «Рокки», «Малышка на миллион».
           - «Байопики» (360939) — 7 фильмов; + «biography» (5565): 410.
           - «Постапокалипсис» (359337) — 14 фильмов; + «post-apocalyptic
             future» (4458): «Безумный Макс», «Я — легенда», «Тихое место»,
             и сериалы: «Укрытие», «Ходячие мертвецы», «Одни из нас».
           - «Мюзиклы» были жанром 10402 «Музыка» — «Майкл», «Одержимость»,
             «Богемская рапсодия» (это байопики, они и ушли в «Байопики»).
             Теперь ключевое слово «musical» (4344): «Ла-Ла Ленд», «Злая»,
             «Король Лев», «Холодное сердце», «Величайший шоумен».
           - «Новогоднее» (252123) — 8 фильмов, первым «Крёстный отец 2»
             (сцена в Новый год); ключевое слово «канун Нового года» (613)
             приносит «Форреста Гампа». Праздник по-русски — это русское
             кино: Рождество, Новый год или канун И язык оригинала ru, без
             ужасов и триллеров, от 40 голосов — 11 фильмов: «Ирония
             судьбы», «Ёлки» 1-5, «Двенадцать месяцев», «Серебряные коньки»,
             «Зигзаг удачи». Мало, но без мусора; «Рождественское кино»
             остаётся для голливудского.
           - «Документальное»: без комедии (35) — первыми шли «Чудаки». */
        {
          id: 'space', title: 'Космос', group: 'theme', cover: '/vCkC4lHpJZNVUGzdWAF09UKK8by.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 9882, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'post-apocalyptic', title: 'Постапокалипсис', group: 'theme', cover: '/aTLq0TMKdsmIy1ZyFM1LfPs326d.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '4458|359337', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
            tv:    { type: 'discover', params: { keywords: '4458|359337', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
          }
        },
        {
          id: 'zombie', title: 'Зомби', group: 'theme', cover: '/qFKb25O9ROiGYt3GwtuXG5Lb2J.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
            tv:    { type: 'discover', params: { keywords: 12377, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'vampire', title: 'Вампиры', group: 'theme', cover: '/gmCqIGV0xcK7G47lj6OyVPcRelk.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } },
            tv:    { type: 'discover', params: { keywords: 3133, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'spy', title: 'Шпионы', group: 'theme', cover: '/mXFmGlMCgTIOyHaGmQG1Hb6Rv2m.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 470, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'heist', title: 'Ограбления', group: 'theme', cover: '/4CHlGJ9lUN97SsdUpMCA8pvvp1F.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { keywords: 10051, sort_by: 'popularity.desc' } }
          }
        },
        {
          id: 'survival', title: 'Выживание', group: 'theme', cover: '/bdO24JwOiv1r0WV7VPyM1ZnI4Q.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 10349, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'sport', title: 'Спортивные драмы', group: 'theme', cover: '/n3UanIvmnBlH531pykuzNs4LbH6.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '6075|294708|333328', genres: 18, sort_by: 'popularity.desc', filter: { without_genres: '99,16', 'vote_count.gte': 200 } } } }
        },
        {
          id: 'biopic', title: 'Байопики', group: 'theme', cover: '/9441r6izIG2t46C2W1XoKYVN1o.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '5565|360939', sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 200 } } } }
        },
        {
          id: 'noir', title: 'Нуар', group: 'theme', cover: '/qlndzxlcXQj9scIwnN1hnQg9Uyg.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 9807, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'slasher', title: 'Слэшеры', group: 'theme', cover: '/vh7np635kDIcfO6x2Y9ElgLJsuI.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 12339, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'road-movie', title: 'Роуд-муви', group: 'theme', cover: '/lWXcaHFLmGrI9hl8uCCfIRiK4A4.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 167043, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } } }
        },
        {
          id: 'romcom', title: 'Романтические комедии', group: 'theme', cover: '/i8aIbji5vcPoHwcLBZYQSniGkAI.jpg',
          sources: { movie: { type: 'discover', params: { genres: '35,10749', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'psycho-thriller', title: 'Психологические триллеры', group: 'theme', cover: '/lavdyiJWciCJvyLG37ZOs6HJijg.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 12565, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'anime-movies', title: 'Аниме-фильмы', group: 'theme', cover: '/jkwVCMIkN3j284EPIDIGnskTd69.jpg',
          sources: { movie: { type: 'discover', params: { genres: 16, orig_lang: 'ja', sort_by: 'popularity.desc' } } }
        },
        {
          id: 'fantasy', title: 'Фэнтези', group: 'theme', cover: '/amjiPGOiJVUCgddTgl4dVRauKgV.jpg',
          sources: { movie: { type: 'discover', params: { genres: 14, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'scifi', title: 'Научная фантастика', group: 'theme', cover: '/qr7dUqleMRd0VgollazbmyP9XjI.jpg',
          sources: { movie: { type: 'discover', params: { genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'western', title: 'Вестерны', group: 'theme', cover: '/26SUDI2iKhZTIKcU4ZzezTH1G15.jpg',
          sources: { movie: { type: 'discover', params: { genres: 37, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        {
          id: 'new-year', title: 'Новогоднее', group: 'theme', icon: 'star', season: [12, 1], cover: '/mTEYBOOnOJ6p5w9xsfMh39t7iPV.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '207317|252123|613', orig_lang: 'ru', sort_by: 'popularity.desc', filter: { without_genres: '27,53', 'vote_count.gte': 40 } } } }
        },
        {
          id: 'war-movies', title: 'Военные фильмы', group: 'theme', cover: '/pNHv41t8Im8wlwgdzMK9I8WpuBZ.jpg',
          sources: { movie: { type: 'discover', params: { genres: 10752, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 200 } } } }
        },
        /* Сезонные подборки к 9 мая и к 14 февраля (идеи пользователя,
           docs/design/ux-ideas.md:34 — «к 9 мая — военные фильмы, к 14
           февраля — романтика»; план фазы 3, Task 21, их не перенёс, отказа
           нигде нет). Окно — месяц праздника целиком, как у остальных
           сезонных: сезон задаётся месяцами, а не датами (orderForMonth),
           и праздник попадает в него вместе с неделями до него.

           «Кино о войне» — только художественное: жанр «военный» (10752)
           вместе с ключевым словом «Вторая мировая война» (1956), без
           документального (99). Ключевое слово привязывает подборку к дате,
           а жанр отсекает то, что им помечено мимо темы: одно ключевое слово
           без жанра приносило «Звуки музыки», «Другие» и «Король говорит!»
           (живой запрос TMDB 2026-09-23). Сортировка по популярности, а не
           по оценке, — чтобы не повторять круглый год живущие «Военные
           фильмы» выше (тот же жанр, но по оценке и без привязки к войне).
           Название нейтральное — описывает, что в подборке, и только.

           «Кино о любви» — романтика И драма (10749,18 — запятая у TMDB
           означает «и»), без документального, анимации и ужасов: «Титаник»,
           «Дневник памяти», «Гордость и предубеждение», «Вечное сияние
           чистого разума». Жанр «романтика» в одиночку тянул сюда
           «Практическую магию» (первая в выдаче), «Русалочку», «Красавицу
           и чудовище» и «Злую: Часть 2» — «и драма» их отсекает. Первая
           «Злая» остаётся (8-я на первой странице): у неё на TMDB стоит и
           драма. Ф3 п.6 (ревью фикс-раундов): убрать её можно было бы
           только запретом фэнтези (14), а он выбрасывает из первых 40 ещё
           «Сумерки», «Эдварда руки-ножницы», «Знакомьтесь, Джо Блэк» и
           «Бойфренда из будущего» — это как раз кино о любви; запрета нет
           (живые запросы 2026-09-23, первые две страницы). А «Романтические
           комедии» (romcom выше, комедия ИЛИ романтика) и так живут круглый
           год. */
        {
          id: 'war-may', title: 'Кино о войне', i18n: { en: 'War Films', uk: 'Кіно про війну' }, group: 'theme', icon: 'star', season: [5], cover: '/1uKHoFWyYJn060dpIXUCU7Wbc15.jpg',
          sources: { movie: { type: 'discover', params: { genres: 10752, keywords: 1956, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'love-feb', title: 'Кино о любви', i18n: { en: 'Love Stories', uk: 'Кіно про кохання' }, group: 'theme', icon: 'star', season: [2], cover: '/xnHVX37XZEp33hhCbYlQFq7ux1J.jpg',
          sources: { movie: { type: 'discover', params: { genres: '10749,18', sort_by: 'popularity.desc', filter: { without_genres: '99,16,27', 'vote_count.gte': 500 } } } }
        },
        {
          id: 'musical', title: 'Мюзиклы', group: 'theme', cover: '/zpq404Sk7qQ7N4x3xOeNgp74GtU.jpg',
          sources: { movie: { type: 'discover', params: { keywords: 4344, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } } }
        },
        {
          id: 'crime', title: 'Криминал', group: 'theme', cover: '/9pGM43a9VmXxwIxmhJoiDkcB2hT.jpg',
          sources: { movie: { type: 'discover', params: { genres: 80, sort_by: 'vote_average.desc', filter: { 'vote_count.gte': 300 } } } }
        },

        /* Правка 2026-09-25: 15 новых тем — чего не хватало против разделов
           Netflix, Apple TV и Кинопоиска («Боевики», «Мультфильмы», «По
           реальным событиям», «Про маньяков», «Про мафию», «Про тюрьму»,
           «Катастрофы» — последние у нас были только подборками КП, которые
           без ключа не открываются). Каждая проверена живым запросом (прокси
           Lampa, ru-RU, 2026-09-25), первые 20 позиций:
           - Боевики (жанр 28): «Человек-паук: Новый день», «Одиссея»,
             «Мстители: Финал», «Тёмный рыцарь», «Начало».
           - Мультфильмы (16 И 10751 — семейная анимация): «История
             игрушек 5», «Зверополис 2», «Дикий робот», «Головоломка»,
             «Тайна Коко», «Король Лев», «В поисках Немо».
           - Мультфильмы для взрослых («adult animation» 161919): сериалы —
             «Симпсоны», «Гриффины», «Рик и Морти», «Южный парк»,
             «Футурама», «Конь БоДжек», «Аркейн», «Любовь, смерть и
             роботы»; фильмы без аниме (210024 — оно живёт в «Аниме-фильмах»):
             «Полный расколбас», «Мечты робота», «Мемуары улитки», «Бэтмен:
             Убийственная шутка».
           - По реальным событиям (9672, без документального и ужасов —
             «Заклятие» TMDB тоже считает реальным): «Игра в имитацию»,
             «Оппенгеймер», «Волк с Уолл-стрит», «Список Шиндлера», «1+1»;
             сериалы: «Монстр», «Корона», «Нарко», «Чернобыль».
           - Путешествия во времени («time travel» 4379 | «time loop»
             10854): «Интерстеллар», «Терминатор», «Назад в будущее»,
             «Грань будущего», «День сурка», «Довод»; сериалы без детских —
             «Доктор Кто», «Тьма», «Локи», «Чужестранка».
           - Роботы и ИИ (310 | 14544 | 803 И фантастика): «Бегущий по
             лезвию 2049», «Матрица», «ВАЛЛ·И», «Я, робот», «Из машины».
           - Антиутопии (4565): «Матрица», «Бегущий в лабиринте», «Голодные
             игры», «Шоу Трумана»; сериалы — «Укрытие», «Чёрное зеркало»,
             «Рассказ служанки».
           - Катастрофы (10617 | 5096, без анимации): «Гренландия 2»,
             «2012», «Разлом Сан-Андреас», «Армагеддон», «Послезавтра».
           - Маньяки («serial killer» 10714): «Семь», «Зодиак»,
             «Американский психопат», «Молчание ягнят»; сериалы — «Декстер»,
             «Ганнибал», «Охотник за разумом», «Настоящий детектив».
           - Детективы (whodunit 12570 | «murder mystery» 207046, без
             ужасов — иначе «Крик» и «Проклятие монахини»): «Достать ножи»,
             «Смерть на Ниле», «Окно во двор»; сериалы — «Пуаро», «Шерлок»,
             «Убийства в одном здании».
           - Мафия и гангстеры (10391 | 3149 | 10291 И криминал — без него
             «365 дней»): «Крёстный отец», «Отступники», «Славные парни»,
             «Лицо со шрамом»; сериалы без аниме — «Клан Сопрано», «Острые
             козырьки», «Подпольная империя».
           - Тюрьма и побег (378 | 9777 И драма, без фэнтези, комедий и
             анимации — иначе «Шрек 2» и «Фантастические твари»): «Побег из
             Шоушенка», «Большой побег», «Побег из Алькатраса»; сериалы —
             «Побег», «Тюрьма OZ», «Визави».
           - Боевые искусства (779 | 780, без анимации): «Убить Билла»,
             «Джон Уик», «Матрица», «Шан-Чи», «Каратэ-пацан».
           - Инопланетяне (9951 | 14909 И фантастика, без супергероев 9715 —
             иначе первыми «Мстители» и «Человек из стали»): «Чужой»,
             «Прибытие», «Хищник», «Тихое место», «День независимости».
           - По мотивам игр (41645): «Мортал Комбат 2», «Соник», «Супер
             Марио», «Пять ночей с Фредди»; сериалы от 500 голосов — «Одни
             из нас», «Аркейн», «Фоллаут», «Halo».
           Проверены и не взяты (шум в первых 20): «Месть» (9748 — «Железный
           человек 2», «Зверополис»), «Динозавры» (12616 — «Щенячий патруль»),
           «Школа и взросление» (10683 | 6270 — «Человек-паук», «Крик»).
           В резерве, чистые: «Киберпанк» (12190), «Гигантские монстры»
           (161791 | 11100), «Суд и адвокаты» (33519 | 214780 | 222517). */
        {
          id: 'action', title: 'Боевики', i18n: { en: 'Action', uk: 'Бойовики' }, group: 'theme', cover: '/3IzR3VhZAyhxVnuRRUHFLkfK4hT.jpg',
          sources: { movie: { type: 'discover', params: { genres: 28, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'animation', title: 'Мультфильмы', i18n: { en: 'Animated Films', uk: 'Мультфільми' }, group: 'theme', cover: '/pDMndR1yj7WHZmLTwzLxMu16xxD.jpg',
          sources: { movie: { type: 'discover', params: { genres: '16,10751', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'adult-animation', title: 'Мультфильмы для взрослых', i18n: { en: 'Adult Animation', uk: 'Мультфільми для дорослих' }, group: 'theme', cover: '/iFOkrSrJRwE27PwbyQeYLlMJXzw.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 161919, sort_by: 'popularity.desc', filter: { without_keywords: '210024', 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { keywords: 161919, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'true-story', title: 'По реальным событиям', i18n: { en: 'Based on a True Story', uk: 'За реальними подіями' }, group: 'theme', cover: '/dc8Sr1mCiyGXsdVcah3Ot9ff4w9.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 9672, sort_by: 'popularity.desc', filter: { without_genres: '99,27', 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { keywords: 9672, sort_by: 'popularity.desc', filter: { without_genres: '99', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'time-travel', title: 'Путешествия во времени', i18n: { en: 'Time Travel', uk: 'Подорожі в часі' }, group: 'theme', cover: '/50mCQ4lhJFED6ugaSQsn78cC83f.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '4379|10854', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
            tv:    { type: 'discover', params: { keywords: '4379|10854', sort_by: 'popularity.desc', filter: { without_genres: '10762', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'robots', title: 'Роботы и ИИ', i18n: { en: 'Robots & AI', uk: 'Роботи та ШІ' }, group: 'theme', cover: '/jFxxqdEQ9TkXQSytO7qM8wlwXL1.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '310|14544|803', genres: 878, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } } }
        },
        {
          id: 'dystopia', title: 'Антиутопии', i18n: { en: 'Dystopias', uk: 'Антиутопії' }, group: 'theme', cover: '/gDLCap8mcJ32mNIZWTJyk2KyMLW.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 4565, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 200 } } },
            tv:    { type: 'discover', params: { keywords: 4565, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'disaster', title: 'Катастрофы', i18n: { en: 'Disaster Films', uk: 'Катастрофи' }, group: 'theme', cover: '/jCvkDqWWBrgxf9R3DrtJ6GpqXse.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '10617|5096', sort_by: 'popularity.desc', filter: { without_genres: '99,16', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'serial-killers', title: 'Маньяки', i18n: { en: 'Serial Killers', uk: 'Маніяки' }, group: 'theme', cover: '/p1PLSI5Nw2krGxD7X4ulul1tDAk.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 10714, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { keywords: 10714, sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'whodunit', title: 'Детективы', i18n: { en: 'Whodunits', uk: 'Детективи' }, group: 'theme', cover: '/fkdMSS93pFBzNW9OByNpi8i2UYg.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '12570|207046', sort_by: 'popularity.desc', filter: { without_genres: '27', 'vote_count.gte': 200 } } },
            tv:    { type: 'discover', params: { keywords: '12570|207046', sort_by: 'popularity.desc', filter: { 'vote_count.gte': 50 } } }
          }
        },
        {
          id: 'mafia', title: 'Мафия и гангстеры', i18n: { en: 'Mafia & Gangsters', uk: 'Мафія та гангстери' }, group: 'theme', cover: '/ejdD20cdHNFAYAN2DlqPToXKyzx.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '10391|3149|10291', genres: 80, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { keywords: '10391|3149|10291', genres: 80, sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 50 } } }
          }
        },
        {
          id: 'prison', title: 'Тюрьма и побег', i18n: { en: 'Prison & Escape', uk: 'В\'язниця та втеча' }, group: 'theme', cover: '/zfbjgQE1uSd9wiPTX4VzsLi0rGG.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '378|9777', genres: 18, sort_by: 'popularity.desc', filter: { without_genres: '16,35,10751,14', 'vote_count.gte': 300 } } },
            tv:    { type: 'discover', params: { keywords: '378|9777', sort_by: 'popularity.desc', filter: { without_genres: '16,35', 'vote_count.gte': 100 } } }
          }
        },
        {
          id: 'martial-arts', title: 'Боевые искусства', i18n: { en: 'Martial Arts', uk: 'Бойові мистецтва' }, group: 'theme', cover: '/ylZ06kRUF2JKkrCG2E3qn5D9w8L.jpg',
          sources: { movie: { type: 'discover', params: { keywords: '779|780', sort_by: 'popularity.desc', filter: { without_genres: '16', 'vote_count.gte': 300 } } } }
        },
        {
          id: 'aliens', title: 'Инопланетяне', i18n: { en: 'Aliens', uk: 'Прибульці' }, group: 'theme', cover: '/2GzzMdmjWHxk4NG3MX36fEAE8He.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: '9951|14909', genres: 878, sort_by: 'popularity.desc', filter: { without_genres: '16,10751,35', without_keywords: '9715', 'vote_count.gte': 500 } } },
            tv:    { type: 'discover', params: { keywords: '9951|14909', sort_by: 'popularity.desc', filter: { without_genres: '16,10762', without_keywords: '9715', 'vote_count.gte': 200 } } }
          }
        },
        {
          id: 'video-games', title: 'По мотивам игр', i18n: { en: 'Based on Video Games', uk: 'За мотивами ігор' }, group: 'theme', cover: '/q8eejQcg1bAqImEV8jh8RtBD4uH.jpg',
          sources: {
            movie: { type: 'discover', params: { keywords: 41645, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 100 } } },
            tv:    { type: 'discover', params: { keywords: 41645, sort_by: 'popularity.desc', filter: { 'vote_count.gte': 500 } } }
          }
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
          id: 'british', title: 'Британское ТВ', group: 'country', cover: '/hmLTIRtVyTHShJl2Wb8LHmvUgJm.jpg',
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
          id: 'scorsese', title: 'Мартин Скорсезе', group: 'people', cover: '/6aoyUbvu0419XLKLIMoH0TkEicH.jpg',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 1032 } } } }
        },
        {
          id: 'villeneuve', title: 'Дени Вильнёв', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 137427 } } } }
        },
        {
          id: 'miyazaki', title: 'Хаяо Миядзаки', group: 'people', cover: '/95ozIP0A2fKaAXxwDxUEVn74Iux.jpg',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 608 } } } }
        },

        /* Новые (13), person ID проверены live */
        {
          id: 'ridley-scott', title: 'Ридли Скотт', group: 'people', cover: '/hND7xAaxxBgaIspp9iMsaEXOSTz.jpg',
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
          id: 'tom-hanks', title: 'Том Хэнкс', group: 'people', cover: '/ghgfzbEV7kbpbi1O8eIILKVXEA8.jpg',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 31 } } } }
        },
        {
          id: 'keanu-reeves', title: 'Киану Ривз', group: 'people', cover: '/26OvB15pqk3eiKJG8LrXDVzO7Mw.jpg',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 6384 } } } }
        },
        {
          id: 'denzel', title: 'Дензел Вашингтон', group: 'people',
          sources: { movie: { type: 'discover', params: { sort_by: 'popularity.desc', filter: { with_people: 5292 } } } }
        },
        {
          id: 'brad-pitt', title: 'Брэд Питт', group: 'people', cover: '/hZkgoQYus5vegHoetLkCJzb17zJ.jpg',
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
      ],
      /* Task 22 (фаза 3): курируемые кадры ambient-режима. Собраны живьём
         запросом images к TMDB по списку из плана (41 фильм и сериал, топ-2
         кадра без текста и логотипов на каждый — iso_639_1 === null), скрипт
         сбора лежит в scripts/ambient-pick.mjs. Все 82 кадра — 3840 px:
         ширины меньше 4K в отобранном списке не встретилось вовсе, поэтому
         запасная ветка «топ-1 кадр от 1920» ни разу не сработала.
         width здесь — для будущего пополнения списка (кадр уже /тем более/
         годится в original), сам плагин размер выбирает по экрану
         (LC.ambient.sizeFor). */
      ambient: [
        { media: 'movie', id: 438631, title: 'Дюна', path: '/zRKQW58MBEY078AxkHxEJzUskCl.jpg', width: 3840 },
        { media: 'movie', id: 438631, title: 'Дюна', path: '/jYEW5xZkZk2WTrdbMGAPFuBqbDc.jpg', width: 3840 },
        { media: 'movie', id: 693134, title: 'Дюна: Часть вторая', path: '/eZ239CUp1d6OryZEBPnO2n87gMG.jpg', width: 3840 },
        { media: 'movie', id: 693134, title: 'Дюна: Часть вторая', path: '/xOMo8BRK7PfcJv9JCnx7s5hj0PX.jpg', width: 3840 },
        { media: 'movie', id: 335984, title: 'Бегущий по лезвию 2049', path: '/gNdLJU9TxrpGx4dkZidjys3fyy0.jpg', width: 3840 },
        { media: 'movie', id: 335984, title: 'Бегущий по лезвию 2049', path: '/mVr0UiqyltcfqxbAUcLl9zWL8ah.jpg', width: 3840 },
        { media: 'movie', id: 157336, title: 'Интерстеллар', path: '/8sNiAPPYU14PUepFNeSNGUTiHW.jpg', width: 3840 },
        { media: 'movie', id: 157336, title: 'Интерстеллар', path: '/vgnoBSVzWAV9sNQUORaDGvDp7wx.jpg', width: 3840 },
        { media: 'movie', id: 872585, title: 'Оппенгеймер', path: '/7CENyUim29IEsaJhUxIGymCRvPu.jpg', width: 3840 },
        { media: 'movie', id: 872585, title: 'Оппенгеймер', path: '/neeNHeXjMF5fXoCJRsOmkNGC7q.jpg', width: 3840 },
        { media: 'movie', id: 76600, title: 'Аватар: Путь воды', path: '/kJsPVzdyBrYHLomuNv5SJDXUQ2f.jpg', width: 3840 },
        { media: 'movie', id: 76600, title: 'Аватар: Путь воды', path: '/8rpDcsfLJypbO6vREc0547VKqEv.jpg', width: 3840 },
        { media: 'tv', id: 82856, title: 'Мандалорец', path: '/9zcbqSxdsRMZWHYtyCd1nXPr2xq.jpg', width: 3840 },
        { media: 'tv', id: 82856, title: 'Мандалорец', path: '/7dxnNNo8BI5Aguzf9N3OHRTI2g5.jpg', width: 3840 },
        { media: 'movie', id: 120, title: 'Властелин колец: Братство Кольца', path: '/x2RS3uTcsJJ9IfjNPcgDmukoEcQ.jpg', width: 3840 },
        { media: 'movie', id: 120, title: 'Властелин колец: Братство Кольца', path: '/ua5EHfleb44L5hfHPs2BPqRAove.jpg', width: 3840 },
        { media: 'movie', id: 76341, title: 'Безумный Макс: Дорога ярости', path: '/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg', width: 3840 },
        { media: 'movie', id: 76341, title: 'Безумный Макс: Дорога ярости', path: '/uT895WNwm0aIJRtGizcQhrejWUo.jpg', width: 3840 },
        { media: 'movie', id: 27205, title: 'Начало', path: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg', width: 3840 },
        { media: 'movie', id: 27205, title: 'Начало', path: '/28kKbSUvUz6P5RE1AuMJMO7IMfK.jpg', width: 3840 },
        { media: 'movie', id: 49047, title: 'Гравитация', path: '/a2n6bKD7qhCPCAEALgsAhWOAQcc.jpg', width: 3840 },
        { media: 'movie', id: 49047, title: 'Гравитация', path: '/NPQyzyVb0ezZJlrp5sN4YKkOvq.jpg', width: 3840 },
        { media: 'movie', id: 286217, title: 'Марсианин', path: '/lzMS0CI3FLQYC5EgJoWeIaEt0lm.jpg', width: 3840 },
        { media: 'movie', id: 286217, title: 'Марсианин', path: '/9pubUbDX3eKB6ZuKxbFgv4cBZrz.jpg', width: 3840 },
        { media: 'movie', id: 475557, title: 'Джокер', path: '/rlay2M5QYvi6igbGcFjq8jxeusY.jpg', width: 3840 },
        { media: 'movie', id: 475557, title: 'Джокер', path: '/hw1CwteUFGjcWXwjGhKk8UJpWeA.jpg', width: 3840 },
        { media: 'movie', id: 530915, title: '1917', path: '/2lBOQK06tltt8SQaswgb8d657Mv.jpg', width: 3840 },
        { media: 'movie', id: 530915, title: '1917', path: '/2WgieNR1tGHlpJUsolbVzbUbE1O.jpg', width: 3840 },
        { media: 'movie', id: 374720, title: 'Дюнкерк', path: '/ddIkmH3TpR6XSc47jj0BrGK5Rbz.jpg', width: 3840 },
        { media: 'movie', id: 374720, title: 'Дюнкерк', path: '/2bG3HXcUze0GyGAKnJSDF6gllzk.jpg', width: 3840 },
        { media: 'movie', id: 603, title: 'Матрица', path: '/tlm8UkiQsitc8rSuIAscQDCnP8d.jpg', width: 3840 },
        { media: 'movie', id: 603, title: 'Матрица', path: '/oMsxZEvz9a708d49b6UdZK1KAo5.jpg', width: 3840 },
        { media: 'movie', id: 155, title: 'Тёмный рыцарь', path: '/9FE5eD92WfVCiivM9Pq9GVSrlWk.jpg', width: 3840 },
        { media: 'movie', id: 155, title: 'Тёмный рыцарь', path: '/4ORaDgLekcxzHmJPeSncyOgZImR.jpg', width: 3840 },
        { media: 'movie', id: 603692, title: 'Джон Уик 4', path: '/7I6VUdPj6tQECNHdviJkUHD2u89.jpg', width: 3840 },
        { media: 'movie', id: 603692, title: 'Джон Уик 4', path: '/i8dshLvq4LE3s0v8PrkDdUyb1ae.jpg', width: 3840 },
        { media: 'movie', id: 361743, title: 'Топ Ган: Мэверик', path: '/AaV1YIdWKnjAIAOe8UUKBFm327v.jpg', width: 3840 },
        { media: 'movie', id: 361743, title: 'Топ Ган: Мэверик', path: '/5AcP07WJl1VZbnloLZrMVgYjR2s.jpg', width: 3840 },
        { media: 'movie', id: 399055, title: 'Форма воды', path: '/abirSHwWgKajV3hXhaIR5lcCIXe.jpg', width: 3840 },
        { media: 'movie', id: 399055, title: 'Форма воды', path: '/rgyhSn3mINvkuy9iswZK0VLqQO3.jpg', width: 3840 },
        { media: 'movie', id: 313369, title: 'Ла-Ла Ленд', path: '/nlPCdZlHtRNcF6C9hzUH4ebmV1w.jpg', width: 3840 },
        { media: 'movie', id: 313369, title: 'Ла-Ла Ленд', path: '/2wmDyHz4gvF6m51IQZJnJzlLsnz.jpg', width: 3840 },
        { media: 'movie', id: 496243, title: 'Паразиты', path: '/hiKmpZMGZsrkA3cdce8a7Dpos1j.jpg', width: 3840 },
        { media: 'movie', id: 496243, title: 'Паразиты', path: '/cI1RBfqXbWaITTjcKGYLhd9F083.jpg', width: 3840 },
        { media: 'movie', id: 64690, title: 'Драйв', path: '/hoyAALgfmjMEK7O1wZ4r8wT91RP.jpg', width: 3840 },
        { media: 'movie', id: 64690, title: 'Драйв', path: '/oeEiUwvqHxWT0XqD3YlViaiJOVD.jpg', width: 3840 },
        { media: 'movie', id: 329865, title: 'Прибытие', path: '/8MUZz7oPXQftFTslZpRP3CVMOoq.jpg', width: 3840 },
        { media: 'movie', id: 329865, title: 'Прибытие', path: '/r8FD6CC3GgjWaGVkZh00AcedfpA.jpg', width: 3840 },
        { media: 'movie', id: 194662, title: 'Бёрдмэн', path: '/5tDErYQ8Ne1N6dNAlxg8yYNUwRA.jpg', width: 3840 },
        { media: 'movie', id: 194662, title: 'Бёрдмэн', path: '/2y6jZRoM6arYpNXC2GZAjUV4bmW.jpg', width: 3840 },
        { media: 'movie', id: 120467, title: 'Отель «Гранд Будапешт»', path: '/9udCLTxTFl28RxnK8Q05E154ZGa.jpg', width: 3840 },
        { media: 'movie', id: 120467, title: 'Отель «Гранд Будапешт»', path: '/xHDynIimfsgj0ZOs0j5ma8v1vmM.jpg', width: 3840 },
        { media: 'movie', id: 466272, title: 'Однажды в Голливуде', path: '/xwgBHC2FgoIrQitl8jZwXXdsR9u.jpg', width: 3840 },
        { media: 'movie', id: 466272, title: 'Однажды в Голливуде', path: '/oRiUKwDpcqDdoLwPoA4FIRh3hqY.jpg', width: 3840 },
        { media: 'movie', id: 118340, title: 'Стражи Галактики', path: '/uLtVbjvS1O7gXL8lUOwsFOH4man.jpg', width: 3840 },
        { media: 'movie', id: 118340, title: 'Стражи Галактики', path: '/47S8qCA5EoUVyKGDwWKDTwsJFpY.jpg', width: 3840 },
        { media: 'movie', id: 324857, title: 'Человек-паук: Через вселенные', path: '/qGQf2OHIkoh89K8XeKQzhxczf96.jpg', width: 3840 },
        { media: 'movie', id: 324857, title: 'Человек-паук: Через вселенные', path: '/hlCq6Qh9GVtuNcGZF4mQYluaZix.jpg', width: 3840 },
        { media: 'movie', id: 129, title: 'Унесённые призраками', path: '/6oaL4DP75yABrd5EbC4H2zq5ghc.jpg', width: 3840 },
        { media: 'movie', id: 129, title: 'Унесённые призраками', path: '/zSWkLXXj26IQ3pFDH1rnXDQZxAu.jpg', width: 3840 },
        { media: 'movie', id: 372058, title: 'Твоё имя', path: '/mMtUybQ6hL24FXo0F3Z4j2KG7kZ.jpg', width: 3840 },
        { media: 'movie', id: 372058, title: 'Твоё имя', path: '/qeUIKwUfDnNWFA1WwTvTRF1FaYF.jpg', width: 3840 },
        { media: 'movie', id: 346698, title: 'Барби', path: '/1esAE8sLJRWWFsLLeh5r3g2WanI.jpg', width: 3840 },
        { media: 'movie', id: 346698, title: 'Барби', path: '/3N5QNUqS76GFYNoEayfkkJyAyTN.jpg', width: 3840 },
        { media: 'movie', id: 545611, title: 'Всё везде и сразу', path: '/ss0Os3uWJfQAENILHZUdX8Tt1OC.jpg', width: 3840 },
        { media: 'movie', id: 545611, title: 'Всё везде и сразу', path: '/tt79dbOPd9Z9ykEOpvckttgYXwH.jpg', width: 3840 },
        { media: 'movie', id: 466420, title: 'Убийцы цветочной луны', path: '/acvE3RWjDLgvbL2RtcyzkrsAyNV.jpg', width: 3840 },
        { media: 'movie', id: 466420, title: 'Убийцы цветочной луны', path: '/fnxQUdLAjmSRCdudbYClkSnrxVf.jpg', width: 3840 },
        { media: 'movie', id: 792307, title: 'Бедные-несчастные', path: '/zh6IdheEYinU4TPtorWsjx6qPQE.jpg', width: 3840 },
        { media: 'movie', id: 792307, title: 'Бедные-несчастные', path: '/h0oBqUpax591vOacpBsDJ8cynjk.jpg', width: 3840 },
        { media: 'tv', id: 106379, title: 'Фоллаут', path: '/coaPCIqQBPUZsOnJcWZxhaORcDT.jpg', width: 3840 },
        { media: 'tv', id: 106379, title: 'Фоллаут', path: '/cIgHBLTMbcIkS0yvIrUUVVKLdOz.jpg', width: 3840 },
        { media: 'tv', id: 95396, title: 'Разделение', path: '/ixgFmf1X59PUZam2qbAfskx2gQr.jpg', width: 3840 },
        { media: 'tv', id: 95396, title: 'Разделение', path: '/9xDCTGhEWpz206PCiimRGmK67rV.jpg', width: 3840 },
        { media: 'tv', id: 83867, title: 'Андор', path: '/quCeAmVQHfsdcYkicbxZWVauCVb.jpg', width: 3840 },
        { media: 'tv', id: 83867, title: 'Андор', path: '/AmUhBqsxcenA75T9hV49G6ouO9c.jpg', width: 3840 },
        { media: 'tv', id: 93405, title: 'Игра в кальмара', path: '/2meX1nMdScFOoV4370rqHWKmXhY.jpg', width: 3840 },
        { media: 'tv', id: 93405, title: 'Игра в кальмара', path: '/xYTnihl7qffiLSZ6yLMSpBkPdXC.jpg', width: 3840 },
        { media: 'tv', id: 100088, title: 'Одни из нас', path: '/lY2DhbA7Hy44fAKddr06UrXWWaQ.jpg', width: 3840 },
        { media: 'tv', id: 100088, title: 'Одни из нас', path: '/uDgy6hyPd82kOHh6I95FLtLnj6p.jpg', width: 3840 },
        { media: 'movie', id: 37165, title: 'Шоу Трумана', path: '/rmiG2uwcNoGFmBKMoa1pIcf514L.jpg', width: 3840 },
        { media: 'movie', id: 37165, title: 'Шоу Трумана', path: '/aCHn2TXYJfzPXQKA6r9mKPbMlUB.jpg', width: 3840 }
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
      /* Task 22 (фаза 3): кадры заставки — тоже необязательное поле (каталог
         без них означает «показывать нечего», и заставка просто не
         запускается), но если оно есть, то обязано быть массивом:
         LC.ambient.normalizeFrames перебирает его напрямую. */
      if (typeof m.ambient !== 'undefined' && !Array.isArray(m.ambient)) {
        return { ok: false, reason: 'ambient_not_array' };
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

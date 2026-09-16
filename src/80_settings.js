  /* -------------------------------------------------------------------- */
  /* Локализация и раздел «Lumen Card» в настройках Lampa.                 */
  /*                                                                       */
  /* Task 10: чистая логика (нормализация значений, режим по платформе,    */
  /* таблица пунктов раздела) живёт в соседнем src/81_prefs.js — здесь     */
  /* словарь строк, сборка параметров для Lampa.SettingsApi и ОДНА точка   */
  /* применения на настройку (applyPrefChange). Сами применения — в        */
  /* 90_runtime.js (LC.apply*Pref).                                        */
  /* -------------------------------------------------------------------- */

  LC.STRINGS = {
    lumen_card_title: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
    /* Ревью фазы 1 (M2): единственное, что плагин говорит пользователю ВНЕ
       раздела настроек. Показывается через Lampa.Noty, когда штатный шаблон
       карточки не проходит assert — то есть сборка Lampa не поддерживается и
       оформления не будет вовсе. Раньше строка была зашита литералом в
       src/90_runtime.js и всегда по-русски, в том числе в en/uk интерфейсе.
       LC.lang читает словарь сам, если Lampa.Lang не поднялся. */
    lumen_card_unsupported: {
      ru: 'Lumen Card: версия Lampa не поддерживается',
      en: 'Lumen Card: this Lampa version is not supported',
      uk: 'Lumen Card: версія Lampa не підтримується'
    },
    /* Task 10 (экран 09): главный выключатель первым пунктом раздела.
       Карточку на экране плагин при выключении раздевает сразу (снимает свои
       узлы, стили и классы), но заново её рисует уже Lampa — при следующем
       открытии: настройки Lampa лежат активностью ПОВЕРХ карточки и при
       возврате не шлют ни 'full', ни complite (находка ревью Task 8). */
    lumen_card_enabled_name: { ru: 'Включить Lumen Card', en: 'Enable Lumen Card', uk: 'Увімкнути Lumen Card' },
    lumen_card_enabled_descr: {
      ru: 'Выключите — вернётся штатная карточка Lampa. Открытая карточка перерисуется при следующем открытии.',
      en: 'Turn off to get the stock Lampa card back. An open card is redrawn the next time you open it.',
      uk: 'Вимкніть — повернеться штатна картка Lampa. Відкрита картка перемалюється при наступному відкритті.'
    },
    /* Заголовки групп раздела (штатный параметр Lampa type:'title'). */
    lumen_card_group_look: { ru: 'Оформление', en: 'Appearance', uk: 'Оформлення' },
    lumen_card_group_backdrop: { ru: 'Фон карточки', en: 'Card background', uk: 'Фон картки' },
    lumen_card_group_blocks: { ru: 'Блоки карточки', en: 'Card blocks', uk: 'Блоки картки' },
    lumen_card_group_path: { ru: 'Меню и экраны плеера', en: 'Menus and player screens', uk: 'Меню та екрани плеєра' },
    lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
    lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
    lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
    lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
    lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },
    lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
    lumen_card_fonts_descr: {
      ru: 'Unbounded / Golos Text / JetBrains Mono. Требуется интернет. Выключите, если шрифты не грузятся.',
      en: 'Unbounded / Golos Text / JetBrains Mono. Requires internet access.',
      uk: 'Unbounded / Golos Text / JetBrains Mono. Потрібен інтернет.'
    },
    lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },
    lumen_card_cast_name: { ru: 'Показывать актёров', en: 'Show cast', uk: 'Показувати акторів' },
    lumen_card_motion: { ru: 'Анимации', en: 'Animations', uk: 'Анімації' },
    lumen_card_motion_descr: {
      ru: '«Авто» — лёгкие анимации на Tizen/webOS, полные на остальных. «Выкл» отключает и появление блоков, и наезд на кадр.',
      en: '"Auto" means light animations on Tizen/webOS and full ones elsewhere. "Off" disables both block reveal and the Ken Burns zoom.',
      uk: '«Авто» — легкі анімації на Tizen/webOS, повні на інших. «Викл» вимикає і появу блоків, і наїзд на кадр.'
    },
    lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
    lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
    lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    /* Task 8: строка ушла из блока прогресса на кнопку «Смотреть» —
       «Продолжить S2 E3» (экран 05). В самой строке прогресса подписи
       «ПРОДОЛЖИТЬ» больше нет: по design-spec §6 там таймкод и процент. */
    lumen_card_continue: { ru: 'Продолжить', en: 'Continue', uk: 'Продовжити' },
    lumen_card_cast: { ru: 'В ролях', en: 'Cast', uk: 'У ролях' },
    lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
    lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' },
    lumen_card_director: { ru: 'реж.', en: 'dir.', uk: 'реж.' },
    lumen_card_status_soon: { ru: 'Анонс', en: 'Announced', uk: 'Анонс' },
    lumen_card_reactions: { ru: 'РЕАКЦИЙ', en: 'REACTIONS', uk: 'РЕАКЦІЙ' },
    lumen_card_season: { ru: 'Сезон', en: 'Season', uk: 'Сезон' },
    lumen_card_ep_watched: { ru: 'просмотрена', en: 'watched', uk: 'переглянута' },
    lumen_card_ep_watching: { ru: 'смотрите', en: 'watching', uk: 'дивитесь' },
    lumen_card_ep_left: { ru: 'осталось', en: 'left', uk: 'залишилось' },
    lumen_card_ep_soon: { ru: 'не вышла', en: 'not aired', uk: 'не вийшла' },
    /* Task 5d (design-spec §10, экран 07): подписи таблицы «ПОДРОБНО». Сам
       заголовок — уже верхним регистром, как на экране (letter-spacing .14em
       без text-transform). «Режиссёр» здесь полным словом: сокращение «реж.»
       (lumen_card_director) принадлежит мета-строке шапки, где место дорого. */
    lumen_card_facts: { ru: 'ПОДРОБНО', en: 'DETAILS', uk: 'ДОКЛАДНО' },
    lumen_card_fact_original: { ru: 'Оригинал', en: 'Original', uk: 'Оригінал' },
    lumen_card_fact_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
    lumen_card_fact_country: { ru: 'Страна', en: 'Country', uk: 'Країна' },
    lumen_card_fact_director: { ru: 'Режиссёр', en: 'Director', uk: 'Режисер' },
    lumen_card_fact_creator: { ru: 'Создатель', en: 'Creator', uk: 'Творець' },
    lumen_card_fact_genre: { ru: 'Жанр', en: 'Genre', uk: 'Жанр' },
    lumen_card_fact_time: { ru: 'Время', en: 'Runtime', uk: 'Час' },
    /* Ревью Task 5c (п.4): строки чипа следующей серии и названия месяцев —
       здесь, а не хардкодом в LC.cardinfo (он остаётся чистым и получает их
       параметром от LC.header). Месяцы — список через запятую: родительный
       падеж для чипа («17 декабря») и короткая форма для серии («17 дек»). */
    lumen_card_next_episode: { ru: 'Следующая серия', en: 'Next episode', uk: 'Наступна серія' },
    lumen_card_today: { ru: 'сегодня', en: 'today', uk: 'сьогодні' },
    lumen_card_tomorrow: { ru: 'завтра', en: 'tomorrow', uk: 'завтра' },
    lumen_card_in_days: { ru: 'через', en: 'in', uk: 'через' },
    lumen_card_months_gen: {
      ru: 'января,февраля,марта,апреля,мая,июня,июля,августа,сентября,октября,ноября,декабря',
      en: 'January,February,March,April,May,June,July,August,September,October,November,December',
      uk: 'січня,лютого,березня,квітня,травня,червня,липня,серпня,вересня,жовтня,листопада,грудня'
    },
    lumen_card_months_short: {
      ru: 'янв,фев,мар,апр,мая,июн,июл,авг,сен,окт,ноя,дек',
      en: 'Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec',
      uk: 'січ,лют,бер,кві,тра,чер,лип,сер,вер,жов,лис,гру'
    },
    lumen_card_slideshow_name: { ru: 'Слайдшоу кадров', en: 'Backdrop slideshow', uk: 'Слайдшоу кадрів' },
    lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
    lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' },
    lumen_card_menus: { ru: 'Оформление меню и окон', en: 'Menus and dialogs style', uk: 'Оформлення меню і вікон' },
    lumen_card_menus_all: { ru: 'Все меню и окна', en: 'All menus and dialogs', uk: 'Усі меню і вікна' },
    lumen_card_menus_path: { ru: 'Только путь до плеера', en: 'Player path only', uk: 'Лише шлях до плеєра' },
    lumen_card_menus_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    lumen_card_torrents_name: { ru: 'Оформление экрана торрентов', en: 'Torrents screen style', uk: 'Оформлення екрана торентів' },
    lumen_card_torrents_descr: {
      ru: 'Список раздач, окна подключения и ошибок, списки файлов и предзагрузка — в стиле карточки.',
      en: 'Torrent list, connection and error dialogs, file lists and preloading in the card style.',
      uk: 'Список роздач, вікна підключення та помилок, списки файлів і передзавантаження — у стилі картки.'
    },
    /* Task 7 (экран 02): фоновый трейлер. «Авто» — включён в браузере и на
       Android, выключен на Tizen/webOS (там iframe YouTube поверх карточки
       стоит дороже, чем выигрыш — та же логика экономии, что у lumen_motion). */
    lumen_card_trailer: { ru: 'Трейлер в фоне', en: 'Background trailer', uk: 'Трейлер у фоні' },
    lumen_card_trailer_descr: {
      ru: 'Трейлер с YouTube без звука через 3 с после открытия карточки. «Авто» — выключено на Tizen/webOS.',
      en: 'Muted YouTube trailer 3 s after the card opens. "Auto" is off on Tizen/webOS.',
      uk: 'Трейлер з YouTube без звуку через 3 с після відкриття картки. «Авто» — вимкнено на Tizen/webOS.'
    },
    lumen_card_trailer_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    lumen_card_trailer_on: { ru: 'Вкл', en: 'On', uk: 'Увімк' },
    lumen_card_trailer_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    /* Подпись кнопки остановки и метка-чип поверх кадра (экран 02). */
    lumen_card_stop: { ru: 'Стоп', en: 'Stop', uk: 'Стоп' },
    lumen_card_trailer_badge: { ru: 'ТРЕЙЛЕР · БЕЗ ЗВУКА', en: 'TRAILER · MUTED', uk: 'ТРЕЙЛЕР · БЕЗ ЗВУКУ' },
    /* Task 9 (экраны 07/08/13): отзывы Кинопоиска. Метка источника и метки
       тона заданы верхним регистром прямо в строке — как «ПОДРОБНО» и
       «ТРЕЙЛЕР · БЕЗ ЗВУКА»: на экране это letter-spacing без
       text-transform, а в языках с иным регистром перевод сам решает. */
    lumen_card_reviews_name: { ru: 'Отзывы Кинопоиска', en: 'Kinopoisk reviews', uk: 'Відгуки Кінопошуку' },
    lumen_card_reviews_descr: {
      ru: 'Ряд отзывов зрителей в блоке описания. Нужен ключ API — строка ниже.',
      en: 'A row of viewer reviews in the description block. Requires the API key below.',
      uk: 'Ряд відгуків глядачів у блоці опису. Потрібен ключ API — рядок нижче.'
    },
    lumen_card_kp_key: { ru: 'Ключ Kinopoisk API', en: 'Kinopoisk API key', uk: 'Ключ Kinopoisk API' },
    /* Экран 09: «нужен для отзывов и рейтинга КП» — с ключом плагин заполняет
       ещё и чип рейтинга Кинопоиска, если Lampa его не дала (Task 10). */
    lumen_card_kp_key_descr: {
      ru: 'Нужен для отзывов и рейтинга КП. Бесплатно на kinopoiskapiunofficial.tech, 500 запросов/день',
      en: 'Needed for reviews and the KP rating. Free at kinopoiskapiunofficial.tech, 500 requests a day',
      uk: 'Потрібен для відгуків і рейтингу КП. Безкоштовно на kinopoiskapiunofficial.tech, 500 запитів на день'
    },
    lumen_card_reviews_title: { ru: 'Отзывы зрителей', en: 'Viewer reviews', uk: 'Відгуки глядачів' },
    lumen_card_reviews_src: { ru: 'КИНОПОИСК', en: 'KINOPOISK', uk: 'КІНОПОШУК' },
    lumen_card_review_good: { ru: 'ПОЗИТИВНЫЙ', en: 'POSITIVE', uk: 'ПОЗИТИВНИЙ' },
    lumen_card_review_mid: { ru: 'НЕЙТРАЛЬНЫЙ', en: 'NEUTRAL', uk: 'НЕЙТРАЛЬНИЙ' },
    lumen_card_review_bad: { ru: 'НЕГАТИВНЫЙ', en: 'NEGATIVE', uk: 'НЕГАТИВНИЙ' },
    lumen_card_review_useful: { ru: 'полезно', en: 'helpful', uk: 'корисно' },
    lumen_card_anon: { ru: 'Аноним', en: 'Anonymous', uk: 'Анонім' },
    /* Экран 13, панель 2: ключа нет — показываем путь до настройки, а не пустоту. */
    lumen_card_reviews_nokey_title: { ru: 'Ключ API не задан', en: 'API key is not set', uk: 'Ключ API не задано' },
    lumen_card_reviews_nokey_text: {
      ru: 'Рейтинг Кинопоиска и отзывы недоступны без ключа.',
      en: 'Kinopoisk rating and reviews are unavailable without a key.',
      uk: 'Рейтинг Кінопошуку та відгуки недоступні без ключа.'
    },
    lumen_card_reviews_nokey_path: {
      ru: 'Настройки → Lumen Card → Ключ Kinopoisk API',
      en: 'Settings → Lumen Card → Kinopoisk API key',
      uk: 'Налаштування → Lumen Card → Ключ Kinopoisk API'
    },
    /* Task 14 (фаза 2): URL внешнего манифеста подборок.
       Пусто — используется встроенный DEFAULT (62 подборки).
       Хостинговый манифест кэшируется 12 ч в Lampa.Storage. */
    lumen_manifest_url: {
      ru: 'URL манифеста подборок',
      en: 'Collections manifest URL',
      uk: 'URL маніфесту підбірок'
    },
    lumen_manifest_url_descr: {
      ru: 'Внешний JSON-манифест подборок. Пусто — встроенный список (62 подборки). Кэш 12 ч.',
      en: 'External JSON manifest for collections. Empty — built-in list (62 collections). Cached 12 h.',
      uk: 'Зовнішній JSON-маніфест підбірок. Порожньо — вбудований список (62 підбірки). Кеш 12 год.'
    },

    /* Task 15 (фаза 2): настройки рядов подборок на главной. */
    lumen_group_home: {
      ru: 'Ряды на главной',
      en: 'Home rows',
      uk: 'Ряди на головній'
    },
    lumen_hide_watched_name: {
      ru: 'Скрывать досмотренное',
      en: 'Hide watched',
      uk: 'Приховувати переглянуте'
    },
    lumen_hide_watched_descr: {
      ru: 'Убирает из рядов подборок фильмы и сериалы, которые вы уже смотрели.',
      en: 'Removes already-watched movies and shows from collection rows.',
      uk: 'Забирає з рядів підбірок фільми та серіали, які ви вже переглянули.'
    },
    lumen_rows_limit_name: {
      ru: 'Количество рядов',
      en: 'Number of rows',
      uk: 'Кількість рядів'
    },
    /* Суффикс для значений select lumen_rows_limit: '10 рядов', '15 рядов', '25 рядов'. */
    lumen_rows_limit_suffix: {
      ru: 'рядов',
      en: 'rows',
      uk: 'рядів'
    },

    /* Task 16 (фаза 2): персональные ряды на главной. */
    lumen_row_continue: {
      ru: 'Досмотреть',
      en: 'Continue watching',
      uk: 'Досивитися'
    },
    /* «Потому что вы смотрели» — базовая часть заголовка. Название фильма
       добавляется кодом: «Потому что вы смотрели «Дюна»». */
    lumen_row_because: {
      ru: 'Потому что вы смотрели',
      en: 'Because you watched',
      uk: 'Тому що ви дивилися'
    },
    lumen_row_new_episodes: {
      ru: 'Новые серии ваших сериалов',
      en: 'New episodes of your shows',
      uk: 'Нові серії ваших серіалів'
    },
    lumen_row_soon: {
      ru: 'Скоро на экранах',
      en: 'Coming soon',
      uk: 'Незабаром на екранах'
    },
    /* Бейдж на карточке сериала с новой серией. Дата добавляется кодом: «Новая серия · 12 сен». */
    lumen_badge_new_episode: {
      ru: 'Новая серия',
      en: 'New episode',
      uk: 'Нова серія'
    },
    /* «Через» — первая часть «Через 3 дня». Число и склонение добавляются кодом. */
    lumen_badge_coming_in: {
      ru: 'Через',
      en: 'In',
      uk: 'Через'
    },
    lumen_personal_rows_name: {
      ru: 'Персональные ряды',
      en: 'Personal rows',
      uk: 'Персональні ряди'
    },
    lumen_personal_rows_descr: {
      ru: 'Показывать «Досмотреть», «Потому что вы смотрели», «Новые серии» и «Скоро на экранах».',
      en: 'Show "Continue watching", "Because you watched", "New episodes" and "Coming soon" rows.',
      uk: 'Показувати «Досивитися», «Тому що ви дивилися», «Нові серії» та «Незабаром».'
    }
  };

  function langCode() {
    var code = 'ru';
    try {
      if (window.Lampa && Lampa.Storage) {
        code = Lampa.Storage.get('language', 'ru') || 'ru';
      }
    } catch (e) { }
    return ('' + code).toLowerCase().slice(0, 2);
  }

  function isSlavic() {
    var c = langCode();
    return c === 'ru' || c === 'uk' || c === 'be' || c === 'bg';
  }

  LC.seasonsWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['сезон', 'сезона', 'сезонов']);
    return n === 1 ? 'season' : 'seasons';
  };

  LC.episodesWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['серия', 'серии', 'серий']);
    return n === 1 ? 'episode' : 'episodes';
  };

  /* Ревью Task 5c (п.4): склонение дней для чипа «через N дней» — той же
     веткой isSlavic, что и сезоны/серии. */
  LC.daysWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['день', 'дня', 'дней']);
    return n === 1 ? 'day' : 'days';
  };

  /* Task 9: «318 отзывов» в заголовке ряда (экран 07) — та же ветка isSlavic,
     что у сезонов/серий/дней. Число берётся из поля total ответа Кинопоиска,
     а не из длины показанного списка (показываем максимум 12). */
  LC.reviewsWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['отзыв', 'отзыва', 'отзывов']);
    return n === 1 ? 'review' : 'reviews';
  };

  LC.lang = function (key) {
    try {
      if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
        var out = Lampa.Lang.translate(key);
        if (out && out !== key) return out;
      }
    } catch (e) { }
    var pack = LC.STRINGS[key];
    if (!pack) return key;
    return pack[langCode()] || pack.ru || key;
  };

  var ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="2" y="4" width="20" height="16" rx="3"/><path d="M2 15h20"/><circle cx="7" cy="9" r="2"/></svg>';

  /* -------------------------------------------------------------------- */
  /* Одна точка применения на настройку.                                   */
  /*                                                                       */
  /* Ключевой факт (ревью Task 8): настройки Lampa — активность ПОВЕРХ      */
  /* карточки, и возврат из них не шлёт ни 'full', ни complite. Значит      */
  /* каждая настройка обязана применяться на лету сама — иначе на открытой  */
  /* карточке останутся старые классы, узлы и CSS-переменные.               */
  /*                                                                       */
  /* Lampa в Storage.set сначала шлёт listener 'change' (его ловит          */
  /* LC.followStorage), а потом вызывает onChange параметра — применить     */
  /* дважды нельзя. Долг ревью Task 9 (п.1): прежний признак «подписка      */
  /* удалась» (LC.storageFollowed) эту задачу решал неверно. Subscribe.send */
  /* вендора оборачивает ВЕСЬ цикл подписчиков в один try/catch             */
  /* (app.min.js ~2252): стоит чужому подписчику на 'change' бросить        */
  /* исключение раньше нашего — рассылка обрывается, наш обработчик события */
  /* не получает, а onChange молчал, считая, что «подписка же есть». Итог:  */
  /* настройка применялась только после перезахода в Lampa.                 */
  /*                                                                       */
  /* Поэтому признак теперь пофактовый: пометку ставит сам обработчик       */
  /* события, и только если применение прошло. onChange её снимает и        */
  /* пропускает ровно одно, СВОЁ, уже обработанное событие.                 */
  /* -------------------------------------------------------------------- */

  var pref_handled = '';

  /* Возвращает true, если имя — наше и настройка применена. */
  function applyPrefChange(name) {
    /* Ревью Task 10 (п.7): метка живёт ровно до следующего применения. Если
       параметр записали в Storage мимо SettingsApi (чужой код, наш же вызов),
       onChange для него не придёт и метка дожила бы до следующего нашего
       события. Двойного применения это не давало, но так честнее. */
    pref_handled = '';
    if (!name) return false;
    if (name === 'lumen_enabled') { LC.applyEnabledPref(); return true; }
    if (name === 'lumen_motion') { LC.applyMotionMode(); return true; }
    if (name === 'lumen_slideshow' || name === 'lumen_slide_interval') { LC.applySlideshowPref(); return true; }
    if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
    if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
    if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }
    if (name === 'lumen_reviews' || name === 'lumen_kp_key') { LC.applyReviewsPref(); return true; }
    /* Task 15 (фаза 2): изменение настроек рядов на главной.
       lumen_hide_watched применяется при следующем вызове call() каждого ряда. */
    if (name === 'lumen_hide_watched') { return true; }
    /* lumen_rows_limit применяется немедленно через перерегистрацию рядов (I5-fix). */
    if (name === 'lumen_rows_limit') {
      try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
      return true;
    }
    /* Task 16 (фаза 2): персональные ряды включены/выключены —
       перерегистрируем ряды (unregister снимает старые, register строит новые). */
    if (name === 'lumen_personal_rows') {
      try { if (LC.applyPersonalPref) LC.applyPersonalPref(); } catch (eP) {}
      return true;
    }
    /* Task 14 (фаза 2): URL манифеста изменён — сбрасываем кэш Storage, чтобы
       при следующей загрузке главной пришёл свежий манифест. */
    if (name === 'lumen_manifest_url') {
      try { if (window.Lampa && Lampa.Storage) Lampa.Storage.set('lumen_manifest', null); } catch (e) {}
      return true;
    }
    if (name.indexOf(PLUGIN + '_') !== 0) return false;
    /* Ревью Task 8 (п.3/ревью 2 п.4): от этих двух настроек таблица стилей не
       зависит вовсе — классы, узлы и CSS-переменную подписи кнопки ставит
       рендер. Гонять пересборку всего CSS впустую незачем. */
    if (name === PLUGIN + '_fonts') { LC.injectFonts(); LC.injectCss(); return true; }
    if (name === PLUGIN + '_progress') { LC.applyProgressPref(); return true; }
    if (name === PLUGIN + '_cast') { LC.applyCastPref(); return true; }
    LC.injectCss();
    return true;
  }

  function onChangeFor(name) {
    return function () {
      if (pref_handled === name) { pref_handled = ''; return; }
      applyPrefChange(name);
    };
  }

  /* {sand:'Песок', …} для параметра select: подпись значения — либо
     vprefix + значение из словаря, либо «значение + слово» (интервал: «14 с»). */
  function valuesOf(entry) {
    var out = {};
    for (var i = 0; i < entry.values.length; i++) {
      var v = entry.values[i];
      out[v] = entry.vprefix ? LC.lang(entry.vprefix + v) : v + ' ' + LC.lang(entry.vsuffix);
    }
    return out;
  }

  function addPrefParam(entry) {
    var param = { name: entry.name, type: entry.type };
    var field = { name: LC.lang(entry.label) };
    if (entry.descr) field.description = LC.lang(entry.descr);
    /* Заголовок группы ничего не хранит и не имеет обработчика. */
    if (entry.type === 'title') {
      Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field });
      return;
    }
    param['default'] = entry['default'];
    if (entry.type === 'select') param.values = valuesOf(entry);
    if (entry.type === 'input') param.values = '';
    Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field, onChange: onChangeFor(entry.name) });
  }

  LC.addSettings = function () {
    /* Ревью фазы 1, второй круг (Minor 4): свой гард, как у LC.followStorage.
       Снаружи повтор прикрывает inited в LC.init, но полагаться на единственную
       внешнюю защиту нельзя — повторная регистрация продублировала бы весь
       раздел «Lumen Card» в настройках Lampa. */
    if (LC.settingsAdded) return;
    try {
      if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return;

      Lampa.SettingsApi.addComponent({
        component: PLUGIN,
        icon: ICON,
        name: LC.lang('lumen_card_title')
      });

      /* Порядок пунктов и группы — LC.prefs.LIST (src/81_prefs.js, экран 09). */
      for (var i = 0; i < LC.prefs.LIST.length; i++) addPrefParam(LC.prefs.LIST[i]);
      LC.settingsAdded = true;
    } catch (e) {
      warn('settings failed', e);
    }
  };

  LC.followStorage = function () {
    /* Ревью фазы 1 (I3): признак проверяется и НА ВХОДЕ, а не только ставится в
       конце. Вторая подписка на 'change' означала бы двойное применение каждой
       настройки: Lampa рассылает событие всем подписчикам, а pref_handled гасит
       ровно одно повторение. Обязательная точка защиты стоит в LC.init, эта —
       чтобы функция была идемпотентна сама по себе, как все остальные подписки
       плагина (followToggle, followActivityLifecycle, LC.followTimeline). */
    if (LC.storageFollowed) return;
    try {
      if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
      Lampa.Storage.listener.follow('change', function (e) {
        if (!e || !e.name) return;
        /* Свой try/catch обязателен в обе стороны: (1) исключение отсюда
           оборвало бы рассылку ОСТАЛЬНЫМ подписчикам Lampa (один try/catch на
           весь цикл, см. выше); (2) не пометив событие обработанным, мы
           оставляем onChange запасным путём — настройка всё равно применится. */
        try {
          if (applyPrefChange(e.name)) pref_handled = e.name;
        } catch (err) {
          warn('storage change failed: ' + e.name, err);
        }
      });
      LC.storageFollowed = true;
    } catch (err) {
      warn('storage listener failed', err);
    }
  };

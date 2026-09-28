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
    /* Заголовки групп (штатный параметр Lampa type:'title'). 1.0.2: два
       экрана — главный раздел (Внешний вид · Главная · Карточка фильма ·
       Движение) и «Дополнительно…» (Оформление · Карточка и главная ·
       Пульт и окна · Для разработчика); раскладка — LC.prefs.LIST
       (src/81_prefs.js). */
    lumen_group_look: { ru: 'Внешний вид', en: 'Look', uk: 'Зовнішній вигляд' },
    lumen_group_card: { ru: 'Карточка фильма', en: 'Film card', uk: 'Картка фільму' },
    lumen_group_style: { ru: 'Оформление', en: 'Appearance', uk: 'Оформлення' },
    lumen_group_screens: { ru: 'Карточка и главная', en: 'Card and home', uk: 'Картка й головна' },
    lumen_group_remote: { ru: 'Пульт и окна', en: 'Remote and dialogs', uk: 'Пульт і вікна' },
    lumen_group_dev: { ru: 'Для разработчика', en: 'For developers', uk: 'Для розробника' },
    lumen_more_name: { ru: 'Дополнительно…', en: 'More…', uk: 'Додатково…' },
    lumen_more_descr: {
      ru: 'Оформление, карточка и главная, пульт, для разработчика.',
      en: 'Appearance, card and home, remote, for developers.',
      uk: 'Оформлення, картка й головна, пульт, для розробника.'
    },
    /* Task 62b, 1.0.2: готовый стиль — select «Стиль» (lumen_style) вместо
       двух кнопок. «Свой» — значение, которое ставит сам плагин, когда
       пункты набора правили вручную (syncStyle ниже), поэтому описание его
       и объясняет. Что именно поменял выбор, говорит уведомление
       (applyPreset) — названиями пунктов; короткие имена стилей ниже — его
       начало: «Стиль Apple TV · Тема, Акцентный цвет, Шрифт». */
    lumen_style_name: { ru: 'Стиль', en: 'Style', uk: 'Стиль' },
    lumen_style_descr: {
      ru: 'Готовое оформление одним выбором: Lumen — тёплое, Apple TV — чёрное, плоское и нейтральное. Меняет тему, цвета, шрифт, метки и логотипы. «Свой» — пункты меняли вручную.',
      en: 'A ready-made look in one choice: Lumen is warm, Apple TV is black, flat and neutral. It sets the theme, colours, font, badges and logos. "Custom" means items were changed by hand.',
      uk: 'Готове оформлення одним вибором: Lumen — тепле, Apple TV — чорне, пласке й нейтральне. Змінює тему, кольори, шрифт, мітки й логотипи. «Свій» — пункти змінювали вручну.'
    },
    lumen_style_lumen: { ru: 'Lumen', en: 'Lumen', uk: 'Lumen' },
    lumen_style_appletv: { ru: 'Apple TV', en: 'Apple TV', uk: 'Apple TV' },
    lumen_style_custom: { ru: 'Свой', en: 'Custom', uk: 'Свій' },
    lumen_preset_appletv_short: { ru: 'Стиль Apple TV', en: 'Apple TV style', uk: 'Стиль Apple TV' },
    lumen_preset_lumen_short: { ru: 'Стиль Lumen', en: 'Lumen style', uk: 'Стиль Lumen' },
    lumen_preset_same: { ru: 'уже применён', en: 'already applied', uk: 'вже застосовано' },
    lumen_group_motion: { ru: 'Движение', en: 'Motion', uk: 'Рух' },
    lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
    /* Task 30: описание было единственным, чего не хватало самому первому
       пункту группы. Цвет виден сразу, но не очевидно, ГДЕ именно он
       появляется и что настройка действует на лету. */
    lumen_card_accent_descr: {
      ru: 'Цвет кнопок, фокуса и полос прогресса.',
      en: 'The colour of buttons, focus and progress bars.',
      uk: 'Колір кнопок, фокуса та смуг прогресу.'
    },
    lumen_card_accent_sand: { ru: 'Песок', en: 'Sand', uk: 'Пісок' },
    lumen_card_accent_ice: { ru: 'Лёд', en: 'Ice', uk: 'Лід' },
    lumen_card_accent_wine: { ru: 'Вино', en: 'Wine', uk: 'Вино' },
    lumen_card_accent_mint: { ru: 'Мята', en: 'Mint', uk: 'М\'ята' },
    /* Фаза 3: пять новых акцентов. Названия — предметные, как у первых
       четырёх: на пульте по ним понятно, какой будет цвет. */
    lumen_card_accent_copper: { ru: 'Медь', en: 'Copper', uk: 'Мідь' },
    lumen_card_accent_garnet: { ru: 'Гранат', en: 'Garnet', uk: 'Гранат' },
    lumen_card_accent_emerald: { ru: 'Изумруд', en: 'Emerald', uk: 'Смарагд' },
    lumen_card_accent_lavender: { ru: 'Лаванда', en: 'Lavender', uk: 'Лаванда' },
    lumen_card_accent_graphite: { ru: 'Графит', en: 'Graphite', uk: 'Графіт' },
    /* Task 24 (фаза 3): акцент от постера открытого фильма. Task 35 (фаза 4):
       включён по умолчанию (значение — в src/81_prefs.js). */
    /* 1.0.2: подпись — словами автора («Цвет фона от кадра»); описание
       говорит, откуда цвет на самом деле (постер, src/57_color.js), и что
       остаётся без него. */
    lumen_accent_auto_name: {
      ru: 'Цвет фона от кадра',
      en: 'Background colour from the film',
      uk: 'Колір тла від кадру'
    },
    lumen_accent_auto_descr: {
      ru: 'Фон главной и карточки подкрашивается в цвет постера фильма. Выключите — останется «Акцентный цвет».',
      en: 'The home and card background takes on the colour of the film poster. Turn it off to keep the "Accent color".',
      uk: 'Тло головної та картки підфарбовується в колір постера фільму. Вимкніть — лишиться «Акцентний колір».'
    },
    /* Task 62a (фаза 5): докуда доходит цвет, взятый с постера. «Полная» —
       как было с Task 35. «Только фон» снимает единственное место, где
       подкраска заходит на управление, — подложку карточки под фокусом;
       сам фокус при этом никуда не девается, постер по-прежнему растёт. */
    lumen_accent_scope_name: {
      ru: 'Где виден цвет кадра',
      en: 'Where the film colour shows',
      uk: 'Де видно колір кадру'
    },
    lumen_accent_scope_descr: {
      ru: '«Только фон» — карточка под фокусом остаётся нейтральной. Действует, когда включён «Цвет фона от кадра».',
      en: '"Background only" keeps the focused card neutral. Works while "Background colour from the film" is on.',
      uk: '«Лише тло» — картка під фокусом лишається нейтральною. Діє, коли ввімкнено «Колір тла від кадру».'
    },
    lumen_accent_scope_full: { ru: 'Везде', en: 'Everywhere', uk: 'Скрізь' },
    lumen_accent_scope_veil: { ru: 'Только фон', en: 'Background only', uk: 'Лише тло' },
    /* Task 29 (фаза 3): уведомление автодетекта слабого ТВ. Строки
       «Перехода от постера» удалены вместе с переходом (волна 2, ТВ
       2026-09-24). */
    /* Task 21, раунд holB, 1.0.2: частицы — только праздничные (автотемы
       по словам выключены, LC.fxAutoThemes в src/53_themes.js), видны и в
       «Лёгких». Пункт назван по тому, что человек увидит, а значений два:
       прежние «Все» и «Только сезонные» различались лишь сценой
       праздничного фильма вне праздника. Даты — окна праздников
       (forMovie, src/53_themes.js). */
    lumen_fx_name: { ru: 'Праздничные эффекты', en: 'Holiday effects', uk: 'Святкові ефекти' },
    lumen_fx_descr: {
      ru: 'На Новый год (1 декабря — 7 января) — снег и гирлянда, в неделю до Хэллоуина — угли и летучие мыши. На главной и в карточках праздничных фильмов.',
      en: 'For New Year (1 December – 7 January) snow and a garland, in the week before Halloween embers and bats. On the home screen and on holiday films.',
      uk: 'На Новий рік (1 грудня — 7 січня) — сніг і гірлянда, тиждень до Гелловіну — жаринки й кажани. На головній і в картках святкових фільмів.'
    },
    /* Task 22/56: заставка из кадров. Описание называет штатную заставку
       Lampa: человек, у которого пропало её видео, должен по нему понять,
       почему. Двух заставок разом не бывает (canStart, src/54_ambient.js). */
    lumen_ambient_name: { ru: 'Заставка из кадров', en: 'Frame screensaver', uk: 'Заставка з кадрів' },
    lumen_ambient_descr: {
      ru: 'Вместо заставки Lampa — кадры из фильмов с названием и часами. Работает, когда заставка самой Lampa выключена в её настройках.',
      en: 'Film stills with the title and a clock instead of the Lampa screensaver. Works while the Lampa screensaver itself is off in its settings.',
      uk: 'Замість заставки Lampa — кадри з фільмів із назвою та годинником. Працює, коли заставку самої Lampa вимкнено в її налаштуваннях.'
    },
    lumen_ambient_source_name: {
      ru: 'Заставка: какие кадры',
      en: 'Screensaver: which stills',
      uk: 'Заставка: які кадри'
    },
    lumen_ambient_source_descr: {
      ru: '«Известные фильмы» — отобранные кадры из каталога плагина. «Кадры открытого фильма» — кадры карточки, оставшейся на экране.',
      en: '"Famous films" are curated stills from the plugin catalog. "Stills of the open film" are the frames of the card left on screen.',
      uk: '«Відомі фільми» — дібрані кадри з каталогу плагіна. «Кадри відкритого фільму» — кадри картки, що лишилася на екрані.'
    },
    lumen_ambient_source_curated: { ru: 'Известные фильмы', en: 'Famous films', uk: 'Відомі фільми' },
    lumen_ambient_source_current: { ru: 'Кадры открытого фильма', en: 'Stills of the open film', uk: 'Кадри відкритого фільму' },
    lumen_ambient_delay_name: {
      ru: 'Заставка: через сколько',
      en: 'Screensaver: start after',
      uk: 'Заставка: через скільки'
    },
    lumen_ambient_delay_descr: {
      ru: 'Сколько пульт должен молчать, прежде чем включится заставка.',
      en: 'How long the remote has to stay idle before the screensaver starts.',
      uk: 'Скільки пульт має мовчати, перш ніж увімкнеться заставка.'
    },
    /* Суффикс значений select lumen_ambient_delay: «3 мин». */
    lumen_ambient_minutes: { ru: 'мин', en: 'min', uk: 'хв' },
    /* Task 23 (фаза 3): рулетка «Что посмотреть» — пункт левого меню Lampa,
       экран выбора подборок и фильтров, барабан и результат. Рулеток две
       (фильмы и сериалы), поэтому подписи фильтра длительности разные. */
    lumen_roulette_title: { ru: 'Что посмотреть', en: 'What to watch', uk: 'Що подивитися' },
    lumen_roulette_movies: { ru: 'Фильмы', en: 'Movies', uk: 'Фільми' },
    lumen_roulette_series: { ru: 'Сериалы', en: 'Series', uk: 'Серіали' },
    lumen_roulette_all: { ru: 'Все подборки', en: 'All collections', uk: 'Усі підбірки' },
    lumen_roulette_spin: { ru: 'Крутить', en: 'Spin', uk: 'Крутити' },
    lumen_roulette_again: { ru: 'Ещё раз', en: 'Again', uk: 'Ще раз' },
    lumen_roulette_watch: { ru: 'Смотреть', en: 'Watch', uk: 'Дивитися' },
    lumen_roulette_book: { ru: 'В закладки', en: 'Bookmark', uk: 'У закладки' },
    lumen_roulette_booked: { ru: 'Добавлено в закладки', en: 'Added to bookmarks', uk: 'Додано в закладки' },
    /* Полное ревью, D3: фильм уже в закладках — «В закладки» его не убирает. */
    lumen_roulette_booked_already: { ru: 'Уже в закладках', en: 'Already in bookmarks', uk: 'Вже в закладках' },
    lumen_roulette_unseen: { ru: 'Не смотрел', en: 'Not watched', uk: 'Не дивився' },
    lumen_roulette_short_movie: { ru: 'Есть 90 минут', en: '90 minutes to spare', uk: 'Є 90 хвилин' },
    lumen_roulette_short_tv: { ru: 'Серия до 30 минут', en: 'Episode under 30 min', uk: 'Серія до 30 хвилин' },
    /* Правка 2026-09-23 (разбор композиции, п.5.1): подпись под счётчиком
       выборки. Разбор просил «217 фильмов в выборке», но такая строка тянет
       за собой склонение числительного в трёх языках (фильм / фильма /
       фильмов), а из этого получается либо таблица окончаний ради одной
       подписи, либо неверная форма на каждом втором числе. Схема «крупное
       число плюс подпись под ним» — та же, что у чипов карточки, — даёт тот
       же смысл без счётного слова. */
    lumen_roulette_pick: {
      ru: 'в выборке',
      en: 'in the pick',
      uk: 'у вибірці'
    },
    /* Вид «как Apple TV»: подпись полки под барабаном (src/56_roulette.js). */
    lumen_roulette_more: { ru: 'Ещё в выборке', en: 'More in the pick', uk: 'Ще у вибірці' },
    lumen_roulette_empty: {
      ru: 'Под фильтры ничего не подошло',
      en: 'Nothing matches the filters',
      uk: 'Під фільтри нічого не підійшло'
    },
    /* Дизайн-проход 2026-09-26: что делать с пустой выборкой — строка под
       сообщением (в барабане стандартного вида, описанием колонки в виде
       «как Apple TV»). */
    lumen_roulette_empty_hint: {
      ru: 'Снимите фильтр или отметьте другие подборки',
      en: 'Turn a filter off or pick other collections',
      uk: 'Зніміть фільтр або позначте інші підбірки'
    },
    /* Пункт меню карточки (src/63_cardmenu.js) — рулетка по жанрам этого
       фильма; названо словами пользователя. %s в подписи чипа — название
       фильма: «Как «Матрица»» обходит склонение названия. */
    lumen_roulette_similar: { ru: 'Что посмотреть похожее', en: 'What to watch like this', uk: 'Що подивитися схоже' },
    lumen_roulette_like: { ru: 'Как «%s»', en: 'Like “%s”', uk: 'Як «%s»' },
    lumen_fx_seasonal: { ru: 'Новый год и Хэллоуин', en: 'New Year and Halloween', uk: 'Новий рік і Гелловін' },
    lumen_fx_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    /* Task 21: метка сезонной подборки в хабе и заголовок ряда адвента. */
    lumen_season_badge: { ru: 'Сезон', en: 'In season', uk: 'Сезон' },
    lumen_advent_title: { ru: 'Адвент-календарь', en: 'Advent calendar', uk: 'Адвент-календар' },
    lumen_advent_day: { ru: 'День', en: 'Day', uk: 'День' },
    lumen_advent_today: { ru: 'Сегодня', en: 'Today', uk: 'Сьогодні' },
    /* Раунд holB: адвент под СНГ — 31 окошко (src/44_rows.js). Заголовок
       ряда: «… · до Нового года 16 дней», 31-го — «… · новогодняя ночь».
       {d} — день декабря: подпись закрытого окошка и его уведомление по OK. */
    lumen_advent_left: { ru: 'до Нового года', en: 'to New Year', uk: 'до Нового року' },
    lumen_advent_eve: { ru: 'новогодняя ночь', en: 'New Year\'s Eve', uk: 'новорічна ніч' },
    lumen_advent_final: { ru: 'Новогодняя ночь', en: 'New Year\'s Eve', uk: 'Новорічна ніч' },
    lumen_advent_date: { ru: '{d} декабря', en: 'December {d}', uk: '{d} грудня' },
    lumen_advent_locked: { ru: 'Окошко откроется {d} декабря', en: 'This window opens on December {d}', uk: 'Віконце відкриється {d} грудня' },
    lumen_motion_auto_noty: {
      ru: 'Lumen Card: включены лёгкие анимации — устройство не успевает рисовать полные',
      en: 'Lumen Card: light animations enabled — this device cannot keep up with the full ones',
      uk: 'Lumen Card: увімкнено легкі анімації — пристрій не встигає малювати повні'
    },
    /* Фаза 3: тема — цвет тёмного фона и подложек. */
    lumen_theme_name: { ru: 'Тема', en: 'Theme', uk: 'Тема' },
    lumen_theme_descr: {
      ru: 'Цвет тёмного фона. «Глубокая чёрная» — для OLED-экранов.',
      en: 'The colour of the dark background. "Deep black" is for OLED screens.',
      uk: 'Колір темного тла. «Глибока чорна» — для OLED-екранів.'
    },
    lumen_theme_warm: { ru: 'Тёплая тёмная', en: 'Warm dark', uk: 'Тепла темна' },
    lumen_theme_black: { ru: 'Глубокая чёрная', en: 'Deep black', uk: 'Глибока чорна' },
    /* Фаза 3: плотность подложек — прозрачность и размытие карт. */
    lumen_solid_name: { ru: 'Без прозрачности', en: 'No transparency', uk: 'Без прозорості' },
    lumen_solid_descr: {
      ru: 'Кнопки и подложки без просвечивания и размытия. Включите, если картинка мылит или тормозит.',
      en: 'Buttons and panels without show-through and blur. Turn on if the picture looks smeared or stutters.',
      uk: 'Кнопки й підкладки без просвічування та розмиття. Увімкніть, якщо картинка мулиться або гальмує.'
    },
    /* Task 73 (фаза 6): плоский вид. A5: в сетке подборки и в хабе он
       снимает только подложки ПОД картинкой (сторож набора правил — в
       test/css.test.mjs), поэтому описание перечисляет лишь экраны, где
       перемена видна: карточка, отзывы, серии, путь TorrServer и «Что
       посмотреть». */
    lumen_flat_name: { ru: 'Плоский вид', en: 'Flat look', uk: 'Плаский вигляд' },
    lumen_flat_descr: {
      ru: 'Содержимое лежит прямо на фоне, без коробок и рамок: карточка, отзывы, серии, экраны торрентов. «Что посмотреть» — в виде Apple TV.',
      en: 'Content sits right on the background, without boxes and frames: the card, reviews, episodes, torrent screens. "What to watch" gets the Apple TV layout.',
      uk: 'Вміст лежить просто на тлі, без коробок і рамок: картка, відгуки, серії, екрани торентів. «Що подивитися» — у вигляді Apple TV.'
    },
    /* Фаза 3: масштаб интерфейса плагина. Оговорка про потолок: ряд в
       фокусе обязан целиком помещаться под кадром (rowScaleCap в
       src/30_css.js), и с «Кадром над рядами» в значении «Крупный» большие
       значения масштаба карточку ряда могут не менять. Описание называет
       именно эту настройку (сторож «оговорка про потолок масштаба…» в
       test/css.test.mjs), а не заставку — та на потолок не влияет. */
    lumen_scale_name: { ru: 'Масштаб интерфейса', en: 'Interface scale', uk: 'Масштаб інтерфейсу' },
    lumen_scale_descr: {
      ru: 'Размер текста и блоков на экранах плагина. Ряды главной растут, только пока помещаются под кадром: при «Кадр над рядами» — «Крупный» большие значения могут их не менять.',
      en: 'The size of text and blocks on the plugin screens. Home rows grow only while they fit under the hero: with "Hero over the rows" set to "Large", the bigger values may not change them.',
      uk: 'Розмір тексту та блоків на екранах плагіна. Ряди головної ростуть, лише доки вміщуються під кадром: при «Кадр над рядами» — «Великий» більші значення можуть їх не змінювати.'
    },
    lumen_scale_small: { ru: 'Мельче', en: 'Smaller', uk: 'Дрібніше' },
    lumen_scale_normal: { ru: 'Обычный', en: 'Normal', uk: 'Звичайний' },
    lumen_scale_large: { ru: 'Крупнее', en: 'Larger', uk: 'Більше' },
    lumen_scale_huge: { ru: 'Ещё крупнее', en: 'Largest', uk: 'Ще більше' },
    /* Правка 2026-09-23: логотип названия в шапке карточки (renderLogo,
       src/85_header.js). Описание называет и цену — английский логотип
       вместо русского названия, — иначе непонятно, зачем такой выключатель
       вообще нужен. */
    lumen_card_logo_name: { ru: 'Логотип в карточке', en: 'Logo on the card', uk: 'Логотип у картці' },
    lumen_card_logo_descr: {
      ru: 'Название фильма — его логотипом, а не текстом. Если логотипа на вашем языке нет, берётся английский.',
      en: 'The film title as its logo instead of text. If there is no logo in your language, the English one is used.',
      uk: 'Назва фільму — його логотипом, а не текстом. Якщо логотипа вашою мовою немає, береться англійський.'
    },
    lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },
    /* Task 30: одним переключателем гасятся три места сразу (строка прогресса
       в карточке, подпись кнопки «Смотреть» и надписи в карточках серий) —
       это и сказано, иначе выключатель выглядит уже, чем он есть. */
    lumen_card_progress_descr: {
      ru: 'Полоса просмотра в карточке, «Продолжить S2 E3» на кнопке «Смотреть» и отметки просмотра у серий.',
      en: 'The progress bar on the card, "Continue S2 E3" on the Watch button and watched marks on episodes.',
      uk: 'Смуга перегляду в картці, «Продовжити S2 E3» на кнопці «Дивитися» та позначки перегляду в серій.'
    },
    /* Выбор гарнитуры. Имена шрифтов — собственные, но идут через
       LC.STRINGS, как все строки интерфейса. 1.0.2: «Как в Lampa»
       (значение 'system') — бывший выключатель «Фирменные шрифты». Описание
       говорит, откуда берётся шрифт и что будет, если он не загрузился
       (LC.fontsState, src/30_css.js). */
    lumen_card_font_name: { ru: 'Шрифт', en: 'Font', uk: 'Шрифт' },
    lumen_card_font_descr: {
      ru: 'Шрифт экранов плагина. Грузится из интернета (Google Fonts); если не загрузился — вид не изменится.',
      en: 'The font of the plugin screens. It loads from the internet (Google Fonts); if it fails to load, nothing changes.',
      uk: 'Шрифт екранів плагіна. Вантажиться з інтернету (Google Fonts); якщо не завантажився — вигляд не зміниться.'
    },
    lumen_card_font_system: { ru: 'Как в Lampa', en: 'As in Lampa', uk: 'Як у Lampa' },
    lumen_card_font_golos: { ru: 'Golos Text', en: 'Golos Text', uk: 'Golos Text' },
    lumen_card_font_onest: { ru: 'Onest', en: 'Onest', uk: 'Onest' },
    lumen_card_font_manrope: { ru: 'Manrope', en: 'Manrope', uk: 'Manrope' },
    lumen_card_font_inter: { ru: 'Inter', en: 'Inter', uk: 'Inter' },
    lumen_card_font_plex: { ru: 'IBM Plex Sans', en: 'IBM Plex Sans', uk: 'IBM Plex Sans' },
    lumen_card_motion: { ru: 'Анимации', en: 'Animations', uk: 'Анімації' },
    lumen_card_motion_descr: {
      ru: '«Авто» подбирает режим под устройство. «Лёгкие» — без плавных переходов, для слабых телевизоров. «Выкл» — без движения: кадры не сменяются, трейлеров нет.',
      en: '"Auto" picks the mode for the device. "Light" drops smooth transitions, for weak TVs. "Off" stops all motion: stills do not change and no trailers play.',
      uk: '«Авто» добирає режим під пристрій. «Легкі» — без плавних переходів, для слабких телевізорів. «Викл» — без руху: кадри не змінюються, трейлерів немає.'
    },
    lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
    lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
    lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    /* Task 40 (фаза 4): «украшения» — плавная смена кадров, наезд на кадр
       и зум заставки (LC.fxHeavy). Название говорит, что человек увидит;
       сами кадры и трейлеры от пункта не зависят. */
    lumen_fx_heavy_name: {
      ru: 'Плавная смена кадров и наезд',
      en: 'Smooth still changes and zoom',
      uk: 'Плавна зміна кадрів і наїзд'
    },
    lumen_fx_heavy_descr: {
      ru: 'Кадры сменяются плавно, а камера медленно наезжает. Только при полных анимациях; на телевизоре по умолчанию выключено.',
      en: 'Stills change smoothly and the camera slowly zooms in. Only with full animations; off by default on a TV.',
      uk: 'Кадри змінюються плавно, а камера повільно наїжджає. Лише за повних анімацій; на телевізорі за замовчуванням вимкнено.'
    },
    /* Task 31 (фаза 4): строка замеров в углу экрана (src/69_hud.js) — для
       проверки на телевизоре без adb. 1.0.2: пункт в группе «Для
       разработчика», поэтому слово «Отладка:» из названия ушло. */
    lumen_debug_hud_name: { ru: 'Показать FPS', en: 'Show FPS', uk: 'Показати FPS' },
    lumen_debug_hud_descr: {
      ru: 'Строка с частотой кадров и замерами в углу экрана — для проверки на телевизоре.',
      en: 'A line with the frame rate and measurements in the screen corner — for testing on a TV.',
      uk: 'Рядок із частотою кадрів і замірами в кутку екрана — для перевірки на телевізорі.'
    },
    /* Волна производительности: самотест на ТВ (src/69_bench.js). Строки
       экрана таблицы и отказа — здесь же: их видит только тот, кто нажал
       эту кнопку. */
    lumen_debug_bench_name: { ru: 'Тест производительности', en: 'Performance test', uk: 'Тест продуктивності' },
    lumen_debug_bench_descr: {
      ru: 'Около минуты гоняет главную в восьми режимах и показывает таблицу — сфотографируйте её. Запускайте с главной; любая кнопка прерывает тест, настройки не меняются.',
      en: 'Runs the home screen through eight modes for about a minute and shows a table — take a photo of it. Start from the home screen; any key stops the test, settings stay as they are.',
      uk: 'Близько хвилини ганяє головну у восьми режимах і показує таблицю — сфотографуйте її. Запускайте з головної; будь-яка кнопка перериває тест, налаштування не змінюються.'
    },
    lumen_rowmem_name: { ru: 'Сон дальних рядов', en: 'Sleep for far rows', uk: 'Сон дальніх рядів' },
    lumen_rowmem_descr: {
      ru: 'Ряды главной далеко от фокуса перестают рисоваться — меньше памяти в долгом сеансе. Выключите, если при прокрутке видите пустые полосы.',
      en: 'Home rows far from focus stop being drawn — less memory in a long session. Turn it off if you see empty strips while scrolling.',
      uk: 'Ряди головної далеко від фокуса перестають малюватися — менше пам’яті в довгому сеансі. Вимкніть, якщо під час гортання бачите порожні смуги.'
    },
    lumen_rowmem_bytes_name: {
      ru: 'Отпускать постеры дальних рядов',
      en: 'Release posters of far rows',
      uk: 'Відпускати постери дальніх рядів'
    },
    lumen_rowmem_bytes_descr: {
      ru: 'Спящие ряды ещё и выгружают постеры, а у фокуса загружают снова: памяти меньше, запросов больше. Только вместе со «Сном дальних рядов».',
      en: 'Sleeping rows also unload their posters and load them again near focus: less memory, more requests. Only together with "Sleep for far rows".',
      uk: 'Сплячі ряди ще й вивантажують постери, а біля фокуса завантажують знову: пам’яті менше, запитів більше. Лише разом зі «Сном дальніх рядів».'
    },
    lumen_netmem_name: {
      ru: 'Отпускать запросы экранов',
      en: 'Release screen requests',
      uk: 'Відпускати запити екранів'
    },
    lumen_netmem_descr: {
      ru: 'Закрытые карточки и подборки не остаются в памяти после ответа сервера. Действует со следующего запуска Lampa.',
      en: 'Closed cards and collections do not stay in memory after the server answers. Takes effect on the next Lampa start.',
      uk: 'Закриті картки й підбірки не лишаються в пам’яті після відповіді сервера. Діє з наступного запуску Lampa.'
    },
    lumen_prefill_name: { ru: 'Достройка рядов', en: 'Build rows ahead', uk: 'Добудова рядів' },
    lumen_prefill_descr: {
      ru: 'Пока пульт молчит, карточки рядов главной дорисовываются заранее — прокрутка потом не подтормаживает.',
      en: 'While the remote is idle, home row cards are built in advance so scrolling does not stutter later.',
      uk: 'Поки пульт мовчить, картки рядів головної домальовуються заздалегідь — гортання потім не гальмує.'
    },
    lumen_bench_need_home: {
      ru: 'Тест производительности запускается с главной: откройте главную и нажмите кнопку снова',
      en: 'The performance test runs from the home screen: open it and press the button again',
      uk: 'Тест продуктивності запускається з головної: відкрийте головну й натисніть кнопку знову'
    },
    lumen_bench_running: { ru: 'тест · любая кнопка — стоп', en: 'test · any key stops', uk: 'тест · будь-яка кнопка — стоп' },
    lumen_bench_stopped: { ru: 'прервано', en: 'stopped', uk: 'перервано' },
    lumen_bench_back: { ru: 'Назад — закрыть', en: 'Back — close', uk: 'Назад — закрити' },
    /* Task 8: строка ушла из блока прогресса на кнопку «Смотреть» —
       «Продолжить S2 E3» (экран 05). В самой строке прогресса подписи
       «ПРОДОЛЖИТЬ» больше нет: по design-spec §6 там таймкод и процент. */
    lumen_card_continue: { ru: 'Продолжить', en: 'Continue', uk: 'Продовжити' },
    lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
    lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' },
    lumen_card_status_soon: { ru: 'Анонс', en: 'Announced', uk: 'Анонс' },
    lumen_card_reactions: { ru: 'РЕАКЦИЙ', en: 'REACTIONS', uk: 'РЕАКЦІЙ' },
    lumen_card_season: { ru: 'Сезон', en: 'Season', uk: 'Сезон' },
    lumen_card_ep_watched: { ru: 'просмотрена', en: 'watched', uk: 'переглянута' },
    lumen_card_ep_watching: { ru: 'смотрите', en: 'watching', uk: 'дивитесь' },
    lumen_card_ep_left: { ru: 'осталось', en: 'left', uk: 'залишилось' },
    lumen_card_ep_soon: { ru: 'не вышла', en: 'not aired', uk: 'не вийшла' },
    /* Task 5d (design-spec §10, экран 07): подписи таблицы «ПОДРОБНО». Сам
       заголовок — уже верхним регистром, как на экране (letter-spacing .14em
       без text-transform).

       Task 59 (фаза 5): подписей «Страна», «Режиссёр», «Жанр» и «Время»
       здесь больше нет — эти четыре строки ушли из таблицы, потому что
       слово в слово повторяли мета-строку шапки (интервью 2026-09-21).
       «Бюджет» — новая: Lampa показывала его в своём блоке подробностей
       (app.min.js:38018), а мы этот блок скрываем (src/30_css.js), и до
       Task 59 бюджет не показывался нигде. */
    lumen_card_facts: { ru: 'ПОДРОБНО', en: 'DETAILS', uk: 'ДОКЛАДНО' },
    /* Фикс-раунд Task 59: подсказка под поджатым описанием. Видна только
       там, где текст действительно обрезан — при нарисованных отзывах
       (.lumen-descr-row--reviews, src/30_css.js). */
    lumen_card_descr_more: { ru: 'OK — весь текст', en: 'OK — full text', uk: 'OK — увесь текст' },
    lumen_card_fact_original: { ru: 'Оригинал', en: 'Original', uk: 'Оригінал' },
    lumen_card_fact_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
    lumen_card_fact_creator: { ru: 'Создатель', en: 'Creator', uk: 'Творець' },
    lumen_card_fact_budget: { ru: 'Бюджет', en: 'Budget', uk: 'Бюджет' },
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
    lumen_card_slideshow_name: { ru: 'Смена кадров', en: 'Changing stills', uk: 'Зміна кадрів' },
    /* Task 30: описания фона карточки. Оба пункта до финала фазы 3 стояли без
       подсказок — название говорит, что это, но не что будет, если выключить. */
    lumen_card_slideshow_descr: {
      ru: 'Кадры фильма за текстом карточки сменяют друг друга. Выключите — останется один.',
      en: 'The film stills behind the card text replace one another. Turn it off to keep one.',
      uk: 'Кадри фільму за текстом картки змінюють один одного. Вимкніть — лишиться один.'
    },
    lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
    lumen_card_slide_interval_descr: {
      ru: 'Сколько секунд держится один кадр — в карточке и на главной.',
      en: 'How many seconds one still stays — on the card and on the home screen.',
      uk: 'Скільки секунд тримається один кадр — у картці та на головній.'
    },
    lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' },
    lumen_card_menus: { ru: 'Оформление меню и окон', en: 'Menus and dialogs style', uk: 'Оформлення меню і вікон' },
    /* Task 30: что именно попадает под каждое из трёх значений. Разметку и
       тексты самих окон плагин не трогает — только стиль (src/64_menus.js). */
    lumen_card_menus_descr: {
      ru: '«Только путь до плеера» — окна выбора озвучки, качества, серии и раздачи; «Все меню и окна» — и остальные окна Lampa. Меняется только вид.',
      en: '"Player path only" covers the voice-over, quality, episode and torrent dialogs; "All menus and dialogs" adds the other Lampa dialogs. Only the look changes.',
      uk: '«Лише шлях до плеєра» — вікна вибору озвучення, якості, серії та роздачі; «Усі меню і вікна» — і решта вікон Lampa. Змінюється лише вигляд.'
    },
    lumen_card_menus_all: { ru: 'Все меню и окна', en: 'All menus and dialogs', uk: 'Усі меню і вікна' },
    lumen_card_menus_path: { ru: 'Только путь до плеера', en: 'Player path only', uk: 'Лише шлях до плеєра' },
    lumen_card_menus_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    lumen_card_torrents_name: { ru: 'Оформление торрентов', en: 'Torrents style', uk: 'Оформлення торентів' },
    lumen_card_torrents_descr: {
      ru: 'Список раздач, окна подключения и ошибок, списки файлов и предзагрузка — в стиле карточки.',
      en: 'Torrent list, connection and error dialogs, file lists and preloading in the card style.',
      uk: 'Список роздач, вікна підключення та помилок, списки файлів і передзавантаження — у стилі картки.'
    },
    /* Task 7 (экран 02): фоновый трейлер карточки. «Авто» — включён в
       браузере и на Android, выключен на Tizen/webOS (там iframe YouTube
       поверх карточки стоит дороже выигрыша). */
    lumen_card_trailer: { ru: 'Трейлер в карточке', en: 'Trailer on the card', uk: 'Трейлер у картці' },
    lumen_card_trailer_descr: {
      ru: 'Трейлер без звука через 3 секунды после открытия карточки. «Авто» — выключен на Tizen и webOS.',
      en: 'A muted trailer 3 seconds after the card opens. "Auto" is off on Tizen and webOS.',
      uk: 'Трейлер без звуку через 3 секунди після відкриття картки. «Авто» — вимкнено на Tizen і webOS.'
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
      ru: 'Отзывы зрителей в карточке фильма. Нужен ключ API — строка ниже.',
      en: 'Viewer reviews on the film card. Needs the API key below.',
      uk: 'Відгуки глядачів у картці фільму. Потрібен ключ API — рядок нижче.'
    },
    lumen_card_kp_key: { ru: 'Ключ Kinopoisk API', en: 'Kinopoisk API key', uk: 'Ключ Kinopoisk API' },
    /* Плейсхолдеры текстовых полей: пустое поле Lampa показывает именно их
       (см. addPrefParam ниже). «Не задан» — про ключ, «Каталог плагина» — про
       адрес каталога: пустая строка там означает адрес по умолчанию, и так это
       и читается в разделе. */
    lumen_pref_unset: { ru: 'Не задан', en: 'Not set', uk: 'Не задано' },
    lumen_pref_default_catalog: { ru: 'Каталог плагина', en: 'Plugin catalog', uk: 'Каталог плагіна' },
    /* Экран 09: «нужен для отзывов и рейтинга КП» — с ключом плагин заполняет
       ещё и чип рейтинга Кинопоиска, если Lampa его не дала (Task 10). */
    lumen_card_kp_key_descr: {
      ru: 'Нужен для отзывов и рейтинга КП. Бесплатно на kinopoiskapiunofficial.tech, 500 запросов/день',
      en: 'Needed for reviews and the KP rating. Free at kinopoiskapiunofficial.tech, 500 requests a day',
      uk: 'Потрібен для відгуків і рейтингу КП. Безкоштовно на kinopoiskapiunofficial.tech, 500 запитів на день'
    },
    lumen_card_reviews_title: { ru: 'Отзывы зрителей', en: 'Viewer reviews', uk: 'Відгуки глядачів' },
    /* Жалоба 2026-09-25 («вычурно, особенно цвет текста»): метка источника
       и тон отзыва — обычным регистром. Капс цветом кричал громче заголовка
       отзыва; тон теперь несёт полоса слева, а подпись лишь поясняет её. */
    lumen_card_reviews_src: { ru: 'Кинопоиск', en: 'Kinopoisk', uk: 'Кінопошук' },
    lumen_card_review_good: { ru: 'Позитивный', en: 'Positive', uk: 'Позитивний' },
    lumen_card_review_mid: { ru: 'Нейтральный', en: 'Neutral', uk: 'Нейтральний' },
    lumen_card_review_bad: { ru: 'Негативный', en: 'Negative', uk: 'Негативний' },
    lumen_card_review_useful: { ru: 'полезно', en: 'helpful', uk: 'корисно' },
    /* Task 28 (фаза 3): отзывы без спойлеров. Режим показа (настройка
       lumen_reviews_mode) переключается в шапке ряда; 1.0.2: пункта в
       разделе больше нет, значение читается как раньше. */
    /* Подпись переключателя в шапке ряда отзывов: это действие, а не
       состояние, — «Показывать текст» с галочкой, когда он включён. */
    lumen_reviews_mode_toggle: { ru: 'Показывать текст', en: 'Show text', uk: 'Показувати текст' },
    /* Метка на карточке отзыва, в котором нашёлся скрытый кусок. */
    lumen_reviews_spoiler: { ru: 'Есть спойлер', en: 'Has spoilers', uk: 'Є спойлер' },
    /* Кнопка в окне отзыва: раскрывает замазанные куски и прячет обратно. */
    lumen_reviews_reveal: { ru: 'Показать спойлеры', en: 'Reveal spoilers', uk: 'Показати спойлери' },
    lumen_reviews_hide: { ru: 'Скрыть спойлеры', en: 'Hide spoilers', uk: 'Сховати спойлери' },
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
    /* Жалоба 2026-09-27: состояние ряда отзывов вместо тишины
       (src/60_reviews.js, STATES). Короткая строка встаёт в шапку ряда после
       «Кинопоиск ·», пояснение (_note) — под шапкой, только у сбоев. */
    /* 2026-09-28: ключа нет вовсе — строка состояния есть всегда, и после
       «Скрыть» на большой подсказке (src/60_reviews.js, paintNoKey). Ревью
       1.0.2: только строкой шапки, без пояснения — путь до пункта даёт
       большая подсказка, пока её не скрыли. */
    lumen_reviews_st_nokey: { ru: 'ключ API не задан', en: 'API key not set', uk: 'ключ API не задано' },
    lumen_reviews_st_key: { ru: 'ключ API не принят', en: 'API key rejected', uk: 'ключ API не прийнято' },
    lumen_reviews_st_key_note: {
      ru: 'Кинопоиск ответил «нет доступа»: в ключе опечатка, лишний символ или ключ отозван. Проверьте его:',
      en: 'Kinopoisk answered "no access": the key has a typo or an extra character, or it was revoked. Check it:',
      uk: 'Кінопошук відповів «немає доступу»: у ключі помилка, зайвий символ або ключ відкликано. Перевірте його:'
    },
    lumen_reviews_st_quota: { ru: 'лимит ключа исчерпан', en: 'key limit reached', uk: 'ліміт ключа вичерпано' },
    lumen_reviews_st_quota_note: {
      ru: 'Лимит запросов ключа исчерпан. Отзывы вернутся, когда лимит обновится (у бесплатного ключа — 500 запросов в сутки).',
      en: 'The key has run out of requests. Reviews will come back once the limit renews (a free key gets 500 requests a day).',
      uk: 'Ліміт запитів ключа вичерпано. Відгуки повернуться, коли ліміт оновиться (у безкоштовного ключа — 500 запитів на добу).'
    },
    lumen_reviews_st_busy: { ru: 'слишком много запросов', en: 'too many requests', uk: 'забагато запитів' },
    lumen_reviews_st_busy_note: {
      ru: 'Кинопоиск ограничивает частоту запросов. Откройте карточку ещё раз через минуту.',
      en: 'Kinopoisk limits how often it can be asked. Open the card again in a minute.',
      uk: 'Кінопошук обмежує частоту запитів. Відкрийте картку ще раз за хвилину.'
    },
    lumen_reviews_st_net: { ru: 'сервер не ответил', en: 'no response', uk: 'сервер не відповів' },
    lumen_reviews_st_net_note: {
      ru: 'Нет ответа от kinopoiskapiunofficial.tech — проверьте интернет. Отзывы загрузятся при следующем открытии карточки.',
      en: 'No response from kinopoiskapiunofficial.tech — check the connection. Reviews will load the next time the card is opened.',
      uk: 'Немає відповіді від kinopoiskapiunofficial.tech — перевірте інтернет. Відгуки завантажаться під час наступного відкриття картки.'
    },
    lumen_reviews_st_empty: { ru: 'отзывов пока нет', en: 'no reviews yet', uk: 'відгуків поки немає' },
    lumen_reviews_st_notfound: { ru: 'фильм не найден', en: 'title not found', uk: 'фільм не знайдено' },
    lumen_reviews_st_noid: { ru: 'нет IMDb ID для поиска', en: 'no IMDb ID to look up', uk: 'немає IMDb ID для пошуку' },
    /* Task 14/20 (фаза 2): адрес каталога подборок.
       Пусто — адрес по умолчанию LC.MANIFEST_URL (GitHub Pages плагина);
       ответ кэшируется на 12 ч, при недоступности сети берётся встроенный
       каталог (LC.manifest.DEFAULT, 147 подборок). */
    lumen_manifest_url: {
      ru: 'Свой каталог подборок',
      en: 'Custom collections catalog',
      uk: 'Свій каталог підбірок'
    },
    lumen_manifest_url_descr: {
      ru: 'Адрес своего каталога подборок (файл JSON). Пусто — каталог плагина из интернета; без сети — встроенный список.',
      en: 'The address of your own collections catalog (a JSON file). Empty — the plugin catalog from the internet; offline — the built-in list.',
      uk: 'Адреса свого каталогу підбірок (файл JSON). Порожньо — каталог плагіна з інтернету; без мережі — вбудований список.'
    },

    /* Task 20: кнопка «Скрыть» на подсказке «Ключ API не задан» (карточка
       и сетка подборки Кинопоиска) — пишет lumen_kp_hint = 'false'. 1.0.2:
       переключателя в разделе больше нет. */
    lumen_kp_hint_hide: {
      ru: 'Скрыть',
      en: 'Hide',
      uk: 'Сховати'
    },

    /* A6 (волна A финального плана): «Метаданные» (Темп, Страх, Экшн…) и
       «Настроения» (проценты) на карточке фильма — блоки САМОЙ Lampa. Мы
       их не рисуем и не можем починить: строки title_metadata/title_moods/
       title_meta_* лежат в vendor/lampa/app.min.js:49246-49258, рендер —
       MetadataChart (:38200) и MetadataTags (:38272), данные приходит взять
       Api.sources.cub.metadataGet и только для фильма
       (`params.method == 'movie'`, :20160-20166). «Метаданные» появляются
       при data.metadata.status == 'completed' (:38842), «Настроения» — ещё
       и только при языке интерфейса ru/uk/be (:38848). Штатного выключателя
       у Lampa нет, поэтому пункт наш.
       Описание обязано сказать ровно это: блоки чужие и данные приходят от
       аккаунта CUB. Иначе выключатель читается как «выключить нашу
       функцию», и человек будет искать, почему она не вернулась на
       сериале или на английском языке — там её и не было. */
    lumen_hide_meta_name: {
      ru: 'Скрывать блоки анализа Lampa',
      en: 'Hide the Lampa analysis blocks',
      uk: 'Ховати блоки аналізу Lampa'
    },
    lumen_hide_meta_descr: {
      ru: 'Убирает с карточки ряды «Метаданные» и «Настроения» — это блоки самой Lampa. Действует со следующего открытия карточки.',
      en: 'Removes the "Metadata" and "Moods" rows from the card — these are Lampa own blocks. Takes effect the next time you open a card.',
      uk: 'Прибирає з картки ряди «Метадані» та «Настрої» — це блоки самої Lampa. Діє з наступного відкриття картки.'
    },

    /* Task 15/20 (фаза 2): группа настроек главной. 1.0.2: в главном
       разделе — кадр, плитки и ряды; раскладка главной (чипы, личные ряды,
       начало, повторы, досмотренное) — во втором экране, в «Карточке и
       главной». */
    lumen_group_home: {
      ru: 'Главная',
      en: 'Home screen',
      uk: 'Головна'
    },
    /* Task 19/20: чипы профилей настроения на главной (с волны 3 — только без кадра над рядами). */
    lumen_moods_name: { ru: 'Чипы настроения', en: 'Mood chips', uk: 'Чипи настрою' },
    /* Волна 3 (ТВ 2026-09-24): чипы на главной — только при выключенном
       кадре (src/49_moods.js), и описание называет это условие. */
    lumen_moods_descr: {
      ru: 'Строка быстрых подборок над рядами главной, когда «Кадр над рядами» выключен.',
      en: 'A row of quick picks above the home rows when "Hero over the rows" is off.',
      uk: 'Рядок швидких підбірок над рядами головної, коли «Кадр над рядами» вимкнено.'
    },
    /* Task 20: кнопка-параметр — экран выбора подборок для главной. */
    lumen_home_rows_name: {
      ru: 'Какие подборки показывать',
      en: 'Which collections to show',
      uk: 'Які підбірки показувати'
    },
    lumen_home_rows_descr: {
      ru: 'Отметьте подборки для главной. Если не отмечено ничего — показывается набор по умолчанию.',
      en: 'Tick the collections for the home screen. With nothing ticked the default set is shown.',
      uk: 'Позначте підбірки для головної. Якщо не позначено нічого — показується набір за замовчуванням.'
    },
    /* Заголовок экрана выбора рядов (Lampa.Select). */
    lumen_home_rows_select: {
      ru: 'Ряды подборок на главной',
      en: 'Collection rows on home',
      uk: 'Ряди підбірок на головній'
    },
    /* Сверка 2026-09-26: метка сезонной подборки (поле season каталога) в
       окне «Какие подборки показывать» — строкой под названием. */
    lumen_rows_seasonal: { ru: 'Сезонная', en: 'Seasonal', uk: 'Сезонна' },
    /* 1.0.2: кнопка «Франшиза» и ряд «Смотреть по порядку» — одним
       выключателем (lumen_franchise). */
    lumen_franchise_name: { ru: 'Франшизы', en: 'Franchises', uk: 'Франшизи' },
    lumen_franchise_descr: {
      ru: 'Кнопка «Франшиза» и ряд «Смотреть по порядку» у фильмов из серии.',
      en: 'The "Franchise" button and the "Watch in order" row for films in a series.',
      uk: 'Кнопка «Франшиза» і ряд «Дивитися по порядку» у фільмів із серії.'
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
      ru: 'Сколько рядов подборок',
      en: 'How many collection rows',
      uk: 'Скільки рядів підбірок'
    },
    /* Task 30: каждый ряд — отдельный запрос к каталогу при построении
       главной, и на слабом телевизоре это заметно (src/44_rows.js). */
    lumen_rows_limit_descr: {
      ru: 'Меньше рядов — главная открывается быстрее. Персональные ряды не в счёт.',
      en: 'Fewer rows — the home screen opens faster. Personal rows are not counted.',
      uk: 'Менше рядів — головна відкривається швидше. Персональні ряди не враховуються.'
    },
    /* Суффикс для значений select lumen_rows_limit: '10 рядов', '15 рядов', '25 рядов'. */
    lumen_rows_limit_suffix: {
      ru: 'рядов',
      en: 'rows',
      uk: 'рядів'
    },
    /* Task 57 (фаза 5): дедупликация фильмов между рядами главной. */
    lumen_rows_dedupe_name: { ru: 'Не повторять фильмы', en: 'No repeated films', uk: 'Не повторювати фільми' },
    lumen_rows_dedupe_descr: {
      ru: 'Фильм показывается только в первом ряду, где встретился. Опустевший от этого ряд скрывается; выбранные вами и личные ряды остаются.',
      en: 'A film is shown only in the first row it appears in. A row this empties is hidden; rows you picked and personal rows stay.',
      uk: 'Фільм показується лише в першому ряду, де трапився. Ряд, що від цього спорожнів, ховається; обрані вами й особисті ряди лишаються.'
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
    /* Task 25 (фаза 3): метки на постерах рядов. «Скоро» дополняется датой
       кодом («Скоро · 17 дек»), «Продолжить» берётся из lumen_card_continue —
       это та же подпись, что на кнопке карточки, и второй строки ей не надо. */
    lumen_badge_soon: { ru: 'Скоро', en: 'Soon', uk: 'Скоро' },
    /* Сверка 2026-09-26: метка карточки ряда «Досмотреть» — остаток минутами
       вместо процента (src/62_badges.js); {n} — целые минуты. */
    lumen_badge_left: { ru: 'Осталось {n} мин', en: '{n} min left', uk: 'Залишилось {n} хв' },
    lumen_badge_new: { ru: 'Новинка', en: 'New', uk: 'Новинка' },
    /* Task 25: обратный отсчёт в мета-строке карточки. «Премьера через 31
       день · 17 дек» собирается из premiere + lumen_card_in_days + числа со
       склонением (LC.daysWord) + короткой даты; «завтра» — из
       lumen_card_tomorrow. Сегодняшняя премьера — отдельной строкой: в
       русском порядок слов там другой. */
    lumen_badge_premiere: { ru: 'Премьера', en: 'Premiere', uk: 'Прем\'єра' },
    lumen_badge_premiere_today: {
      ru: 'Сегодня премьера',
      en: 'Premiere today',
      uk: 'Сьогодні прем\'єра'
    },
    /* Правка пользователя 2026-09-17 (п.2): размер героя на главной — доли
       ЭКРАНА (HERO_VH в src/30_css.js). «Выключен» — героя нет, ряды на весь
       экран, над ними чипы настроения (src/49_moods.js). */
    lumen_hero_size_name: { ru: 'Кадр над рядами', en: 'Hero over the rows', uk: 'Кадр над рядами' },
    lumen_hero_size_descr: {
      ru: 'Какую часть экрана занимает большой кадр с описанием фильма. «Выключен» — ряды на весь экран, над ними чипы настроения.',
      en: 'How much of the screen the large hero with the film description takes. "Off" gives the rows the whole screen, with mood chips above them.',
      uk: 'Яку частину екрана займає великий кадр з описом фільму. «Вимкнено» — ряди на весь екран, над ними чипи настрою.'
    },
    lumen_hero_size_large: { ru: 'Крупный', en: 'Large', uk: 'Великий' },
    lumen_hero_size_medium: { ru: 'Средний', en: 'Medium', uk: 'Середній' },
    lumen_hero_size_compact: { ru: 'Компактный', en: 'Compact', uk: 'Компактний' },
    lumen_hero_size_off: { ru: 'Выключен', en: 'Off', uk: 'Вимкнено' },
    /* Правка 2026-09-23 (просьба пользователя), 1.0.2: что показывает кадр
       главной. Кадры сменяются в обоих значениях; в «Кадры и трейлер»
       через 8 секунд покоя фокуса их сменяет беззвучный трейлер
       (TRAILER_DELAY в src/48_hero.js — равенство держит
       test/prefs.test.mjs). Выключатель «Автотрейлер в кадре главной»
       слит сюда: «Только кадры» — без трейлера. */
    lumen_hero_media_name: { ru: 'Что в кадре', en: 'What the hero shows', uk: 'Що в кадрі' },
    lumen_hero_media_trailer: { ru: 'Кадры и трейлер', en: 'Stills and trailer', uk: 'Кадри і трейлер' },
    lumen_hero_media_frames: { ru: 'Только кадры', en: 'Stills only', uk: 'Лише кадри' },
    lumen_hero_media_descr: {
      ru: 'Кадры фильма сменяют друг друга. Если фокус простоял на карточке 8 секунд, включается трейлер без звука; «Только кадры» — без трейлера.',
      en: 'The film stills replace one another. If focus rests on a card for 8 seconds, a muted trailer starts; "Stills only" means no trailer.',
      uk: 'Кадри фільму змінюють один одного. Якщо фокус простояв на картці 8 секунд, вмикається трейлер без звуку; «Лише кадри» — без трейлера.'
    },
    /* Task 71 (фаза 6): логотип названия в кадре главной. Название пункта
       не «логотип фильма», а «логотип названия»: с дивана человек видит
       именно надпись — фирменно набранное название вместо обычного
       заголовка. Описание говорит, что бывает, когда логотипа нет или он не
       загрузился (остаётся обычный заголовок), — иначе пункт выглядел бы
       сломанным на половине фильмов. */
    lumen_hero_logo_name: { ru: 'Логотип в кадре', en: 'Logo in the hero', uk: 'Логотип у кадрі' },
    lumen_hero_logo_descr: {
      ru: 'Название в кадре над рядами — логотипом фильма. Пока логотип грузится или если его нет, стоит обычный заголовок.',
      en: 'The title in the hero above the rows as the film logo. While it loads, or if there is none, the plain title stays.',
      uk: 'Назва в кадрі над рядами — логотипом фільму. Доки логотип вантажиться або якщо його немає, стоїть звичайний заголовок.'
    },
    /* Правка 2026-09-26: размер плиток рядов главной и сеток подборок. Что
       обещает описание, держит тест «Размер плиток в рядах…»
       (test/css.test.mjs): с крупным кадром на «обычном» и «крупнее»
       размере интерфейса Lampa плитки уже самые крупные из помещающихся, и
       «Крупнее» их не меняет. */
    lumen_tile_size_name: { ru: 'Размер плиток', en: 'Tile size', uk: 'Розмір плиток' },
    lumen_tile_size_descr: {
      ru: 'Размер постеров в рядах главной и в подборках. С крупным кадром над рядами «Крупнее» может ничего не менять — плитки уже самые крупные из помещающихся.',
      en: 'The size of posters in the home rows and in collections. With a large hero above the rows "Larger" may change nothing — the tiles are already the largest that fit.',
      uk: 'Розмір постерів у рядах головної та в підбірках. З великим кадром над рядами «Більші» можуть нічого не змінити — плитки вже найбільші з тих, що вміщуються.'
    },
    lumen_tile_size_small: { ru: 'Мельче', en: 'Smaller', uk: 'Дрібніші' },
    lumen_tile_size_normal: { ru: 'Обычные', en: 'Normal', uk: 'Звичайні' },
    lumen_tile_size_large: { ru: 'Крупнее', en: 'Larger', uk: 'Більші' },
    /* Task 62a (фаза 5): видов метки стало три. Название осталось прежним —
       настройка про то же самое, — а описание теперь объясняет выбор между
       плашкой и подписью: с дивана «На постере / В подписи» без пояснения
       читается как загадка. */
    lumen_badges_name: { ru: 'Метки на постерах', en: 'Poster badges', uk: 'Мітки на постерах' },
    /* Финальная проверка, B9: в виде «В подписи» рейтинг у карточки с
       меткой в ряду главной не дописывается (src/62_badges.js, decorate), и
       описание рядом с годом его не обещает. */
    lumen_badges_descr: {
      ru: '«Скоро», «Новинка», процент просмотра и новые серии. «На постере» — плашкой поверх обложки, «В подписи» — строкой под ней.',
      en: '"Soon", "New", the watched percentage and new episodes. "On the poster" puts a plate over the artwork, "In the caption" a line under it.',
      uk: '«Скоро», «Новинка», відсоток перегляду та нові серії. «На постері» — плашкою поверх обкладинки, «У підписі» — рядком під нею.'
    },
    /* Постеры карточек (lumen_posters). Описание обязано назвать цену до
       выбора: «Без надписей» — запрос на каждую карточку (живые замеры
       2026-09-23: 20 на ряд из одного списка, около 150 на набор главной),
       «Английские» — запрос на половину подборки (originalPosters,
       src/43_sources.js). Кэш на месяц держится на настройке Lampa
       «Кэширование запросов» (request_caching). Ф3: режим 'original'
       подписан «Английские» — он даёт английскую обложку, а не обложку на
       языке оригинала; ключ значения прежний. */
    lumen_posters_name: { ru: 'Постеры карточек', en: 'Card posters', uk: 'Постери карток' },
    lumen_posters_descr: {
      ru: 'Откуда берётся обложка рядов и подборок. «Английские» и «Без надписей» ищут другую — это лишние запросы, у «Без надписей» по запросу на карточку. Если в настройках Lampa включено «Кэширование запросов», ответы хранятся месяц.',
      en: 'Where row and collection artwork comes from. "English" and "No lettering" look for other artwork at an extra cost — "No lettering" asks once per card. With "Request caching" on in Lampa settings answers stay in the cache for a month.',
      uk: 'Звідки береться обкладинка рядів і підбірок. «Англійські» та «Без написів» шукають іншу — це зайві запити, у «Без написів» по запиту на картку. Якщо в налаштуваннях Lampa ввімкнено «Кешування запитів», відповіді зберігаються місяць.'
    },
    lumen_posters_lampa: { ru: 'Как в Lampa', en: 'As in Lampa', uk: 'Як у Lampa' },
    lumen_posters_original: { ru: 'Английские', en: 'English', uk: 'Англійські' },
    lumen_posters_clean: { ru: 'Без надписей', en: 'No lettering', uk: 'Без написів' },
    lumen_badges_poster: { ru: 'На постере', en: 'On the poster', uk: 'На постері' },
    lumen_badges_caption: { ru: 'В подписи', en: 'In the caption', uk: 'У підписі' },
    lumen_badges_off: { ru: 'Не показывать', en: 'Do not show', uk: 'Не показувати' },
    /* Task 26 (фаза 3): контекстное меню карточки по удержанию OK.
       Настройка — не про вид, а про удобство, поэтому включена по
       умолчанию: сам факт удержания OK — штатный жест Lampa, мы лишь
       дописываем в её меню свои пункты. */
    lumen_context_menu_name: {
      ru: 'Меню по удержанию OK',
      en: 'Menu on holding OK',
      uk: 'Меню за утриманням OK'
    },
    lumen_context_menu_descr: {
      ru: 'Удержание OK на постере открывает меню Lampa с пунктами «Трейлер», «Похожие», «Вся франшиза», отметкой просмотра и «Скрыть из рекомендаций».',
      en: 'Holding OK on a poster opens the Lampa menu with "Trailer", "Similar", "Whole franchise", the watched mark and "Hide from recommendations".',
      uk: 'Утримання OK на постері відкриває меню Lampa з пунктами «Трейлер», «Схожі», «Вся франшиза», позначкою перегляду та «Сховати з рекомендацій».'
    },
    /* Task 27 (фаза 3), 1.0.2: мини-карта рядов и быстрое листание — одним
       выключателем (lumen_remote_boost). Кратность листания в описании —
       от FAST_EXTRA в src/64_nav.js (сторож в test/prefs.test.mjs). */
    lumen_remote_boost_name: { ru: 'Ускорители пульта', en: 'Remote shortcuts', uk: 'Прискорювачі пульта' },
    lumen_remote_boost_descr: {
      ru: 'Удержание «вверх»/«вниз» на главной показывает список рядов, «влево»/«вправо» листает вдвое быстрее, кнопки каналов прыгают на десять карточек.',
      en: 'Holding up/down on the home screen shows the list of rows, left/right scrolls twice as fast, the channel buttons jump ten cards.',
      uk: 'Утримання «вгору»/«вниз» на головній показує список рядів, «вліво»/«вправо» гортає удвічі швидше, кнопки каналів стрибають на десять карток.'
    },
    /* Шапка панели мини-карты: «РЯДЫ · 3 ИЗ 9» (design-spec-main §0.16). */
    lumen_minimap_rows: { ru: 'РЯДЫ', en: 'ROWS', uk: 'РЯДИ' },
    lumen_minimap_of: { ru: 'ИЗ', en: 'OF', uk: 'З' },
    /* Подпись ряда, у которого в разметке Lampa нет заголовка. */
    lumen_minimap_row: { ru: 'Ряд', en: 'Row', uk: 'Ряд' },

    /* Заголовок-разделитель наших пунктов внутри штатного меню. */
    lumen_menu_section: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
    lumen_menu_trailer: { ru: 'Трейлер', en: 'Trailer', uk: 'Трейлер' },
    lumen_menu_franchise: { ru: 'Вся франшиза', en: 'Whole franchise', uk: 'Вся франшиза' },
    lumen_menu_similar: { ru: 'Похожие', en: 'Similar', uk: 'Схожі' },
    lumen_menu_watched: { ru: 'Отметить просмотренным', en: 'Mark as watched', uk: 'Позначити переглянутим' },
    lumen_menu_unwatched: { ru: 'Снять отметку о просмотре', en: 'Remove watched mark', uk: 'Зняти позначку перегляду' },
    lumen_menu_hide: { ru: 'Скрыть из рекомендаций', en: 'Hide from recommendations', uk: 'Сховати з рекомендацій' },
    lumen_menu_unhide: { ru: 'Вернуть в рекомендации', en: 'Return to recommendations', uk: 'Повернути в рекомендації' },
    lumen_menu_no_trailer: {
      ru: 'Трейлер не найден',
      en: 'No trailer found',
      uk: 'Трейлер не знайдено'
    },
    /* Ревью волны 1b, п.3: ответ роликов пришёл позже 8 с (src/63_cardmenu.js,
       verdict 'late') — ролик мог и найтись, «не найден» было бы неправдой. */
    lumen_menu_trailer_late: {
      ru: 'Трейлер не успел загрузиться — попробуйте ещё раз',
      en: 'The trailer took too long to load — try again',
      uk: 'Трейлер не встиг завантажитися — спробуйте ще раз'
    },
    lumen_menu_marked: {
      ru: 'Отмечено просмотренным',
      en: 'Marked as watched',
      uk: 'Позначено переглянутим'
    },
    lumen_menu_unmarked: {
      ru: 'Отметка о просмотре снята',
      en: 'Watched mark removed',
      uk: 'Позначку перегляду знято'
    },
    lumen_menu_hidden: {
      ru: 'Скрыто — исчезнет из рядов при следующем обновлении',
      en: 'Hidden — it will leave the rows on the next refresh',
      uk: 'Сховано — зникне з рядів при наступному оновленні'
    },
    lumen_menu_unhidden: {
      ru: 'Возвращено в рекомендации',
      en: 'Returned to recommendations',
      uk: 'Повернено в рекомендації'
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
    },
    /* Волна 4 (ТВ 2026-09-24): начало главной — ротация рядов по эпохам
       (src/47_homeplan.js) или прежняя история сверху. */
    lumen_home_start_name: { ru: 'Начало главной', en: 'Top of the home screen', uk: 'Початок головної' },
    lumen_home_start_rotate: { ru: 'Подборки по очереди', en: 'Rotating collections', uk: 'Підбірки по черзі' },
    lumen_home_start_history: { ru: 'Сначала «Досмотреть»', en: '"Continue watching" first', uk: 'Спочатку «Досивитися»' },
    lumen_home_start_descr: {
      ru: 'Первые ряды меняются при каждом запуске Lampa и раз в несколько часов, «Досмотреть» стоит вторым. «Сначала «Досмотреть»» — ваша история сверху.',
      en: 'The top rows change every time Lampa starts and every few hours, with "Continue watching" second. "Continue watching" first keeps your history on top.',
      uk: 'Перші ряди змінюються під час кожного запуску Lampa і раз на кілька годин, «Досивитися» стоїть другим. «Спочатку «Досивитися»» — ваша історія вгорі.'
    },

    /* Task 19 (фаза 2): чипы профилей настроения на главной.
       Названия чипов берутся из манифеста (mood.title / mood.i18n),
       здесь — только служебные строки интерфейса. */
    lumen_moods_no_sources: {
      ru: 'Нет источника',
      en: 'No source',
      uk: 'Немає джерела'
    },

    /* Task 17 (фаза 2): хаб подборок, сетка подборки, кнопка «Франшиза».
       Названия самих подборок и групп берутся из манифеста (там свой i18n),
       здесь — только строки интерфейса. */
    lumen_hub_title: { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' },
    /* Решение пользователя 2026-09-26: группа профилей настроения в хабе
       (последний чип) и подпись её плиток, если группы mood нет в каталоге. */
    lumen_hub_moods: { ru: 'Настроение', en: 'Mood', uk: 'Настрій' },
    /* Решение пользователя 2026-09-26: вкладка подборок в штатном поиске
       Lampa (src/46_search.js) и заголовок её строки результатов. */
    lumen_search_source: { ru: 'Подборки', en: 'Collections', uk: 'Підбірки' },
    /* Финальная проверка, L4: карточка из кэша поиска Lampa, а подборки в
       каталоге уже нет. */
    lumen_search_gone: { ru: 'Подборка больше недоступна', en: 'This collection is no longer available', uk: 'Підбірка більше недоступна' },
    /* Подпись кнопки поиска в шапке хаба (design-spec-main §0.8) — верхним
       регистром, как остальные метки-капсы плагина. Task 27 сделал её
       рабочей: кнопка открывает штатную клавиатуру Lampa. */
    lumen_hub_search: { ru: 'ПОИСК ПО ПОДБОРКАМ', en: 'SEARCH COLLECTIONS', uk: 'ПОШУК ПО ПІДБІРКАХ' },
    /* Правка 2026-09-23 (долг Task 23): вход в рулетку из шапки хаба и из
       сетки подборки. В шапке — тем же капсом, что у поиска рядом, и тем же
       именем, что у пункта левого меню и у заголовка самой рулетки, — одна
       цель, одно имя. В сетке — действием: там рулетка открывается уже с
       этой подборкой, и подпись обязана это сказать. */
    lumen_hub_roulette: { ru: 'ЧТО ПОСМОТРЕТЬ', en: 'WHAT TO WATCH', uk: 'ЩО ПОДИВИТИСЯ' },
    lumen_grid_roulette: { ru: 'Крутить по этой подборке', en: 'Spin this collection', uk: 'Крутити цю підбірку' },
    /* Заголовок штатной клавиатуры и списка найденного (Task 27 Step 4). */
    lumen_hub_search_title: { ru: 'Название подборки', en: 'Collection name', uk: 'Назва підбірки' },
    lumen_hub_search_results: { ru: 'Найденные подборки', en: 'Collections found', uk: 'Знайдені підбірки' },
    lumen_hub_search_empty: {
      ru: 'Подборки с таким названием нет',
      en: 'No collection with that name',
      uk: 'Підбірки з такою назвою немає'
    },
    lumen_hub_empty: { ru: 'Здесь пока пусто', en: 'Nothing here yet', uk: 'Тут поки порожньо' },
    /* Плитка и сетка подборки Кинопоиска без ключа API (риск фазы 2). */
    lumen_hub_nokey: { ru: 'НУЖЕН КЛЮЧ', en: 'KEY REQUIRED', uk: 'ПОТРІБЕН КЛЮЧ' },
    lumen_hub_nokey_text: {
      ru: 'Подборки Кинопоиска недоступны без ключа API. Настройки → Lumen Card → Ключ Kinopoisk API',
      en: 'Kinopoisk collections are unavailable without an API key. Settings → Lumen Card → Kinopoisk API key',
      uk: 'Підбірки Кінопошуку недоступні без ключа API. Налаштування → Lumen Card → Ключ Kinopoisk API'
    },
    lumen_grid_back: { ru: 'Назад', en: 'Back', uk: 'Назад' },
    /* «Всего 124 · По популярности» — подпись под заголовком сетки. */
    lumen_grid_total: { ru: 'Всего', en: 'Total', uk: 'Усього' },
    lumen_sort_popular: { ru: 'По популярности', en: 'By popularity', uk: 'За популярністю' },
    lumen_sort_rating: { ru: 'По рейтингу', en: 'By rating', uk: 'За рейтингом' },
    lumen_sort_new: { ru: 'Новые', en: 'Newest', uk: 'Нові' },
    /* Подпись кнопки в карточке фильма, входящего в коллекцию TMDB. */
    lumen_card_franchise: { ru: 'Франшиза', en: 'Franchise', uk: 'Франшиза' },
    /* Task 28 (фаза 3): ряд «Смотреть по порядку» в блоке описания карточки
       (src/66_franchise.js). Чип порядка «По рейтингу» берётся из
       lumen_sort_rating — той же строки, что у сортировки сетки подборки,
       а пометка «Скоро» у невышедшей части — из lumen_badge_soon. */
    lumen_fr_title: { ru: 'Смотреть по порядку', en: 'Watch in order', uk: 'Дивитися по порядку' },
    lumen_fr_order_release: { ru: 'По годам', en: 'By year', uk: 'За роками' },
    /* «№ 3 из 9» — слово между номером и общим числом частей. */
    lumen_fr_of: { ru: 'из', en: 'of', uk: 'з' },
    lumen_fr_here: { ru: 'Вы здесь', en: 'You are here', uk: 'Ви тут' },
    lumen_fr_next: { ru: 'Дальше', en: 'Up next', uk: 'Далі' },
    lumen_fr_watched: { ru: 'Просмотрено', en: 'Watched', uk: 'Переглянуто' },
    /* Task 18: статус сериала в герое — «Выходит · 17 дек» (поправка
       контроллера к экрану 19: текстом, без чипа обратного отсчёта —
       тот остаётся в карточке, фаза 1 Task 5c). Дата собирается из
       lumen_card_months_short, тем же словарём, что чип серии. */
    lumen_hero_airing: { ru: 'Выходит', en: 'Airing', uk: 'Виходить' }
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

  /* Task 17: код языка нужен и вне этого модуля — заголовки групп и чипов
     хаба лежат в манифесте с собственным i18n (LC.hub.titleOf), а не в
     LC.STRINGS. Отдельная копия langCode() в 46_hub.js была бы вторым
     источником правды о языке интерфейса. */
  LC.langCode = langCode;

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

  /* Task 17: «62 подборки» в шапке хаба (design-spec-main §0.8) — та же
     ветка isSlavic, что у сезонов/серий/дней/отзывов. */
  LC.collectionsWord = function (n) {
    if (isSlavic()) return LC.util.plural(n, ['подборка', 'подборки', 'подборок']);
    return n === 1 ? 'collection' : 'collections';
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
    /* 1.0.2: новый пункт из слитых тронули — старые ключи больше не
       решают (releaseMerged); пункт готового стиля тронули — «Стиль»
       показывает то, что стоит на самом деле (syncStyle). Обе записи — с
       nolisten, собственных событий не поднимают. */
    releaseMerged(name);
    if (LC.prefs.PRESET_KEYS.indexOf(name) !== -1) syncStyle();
    if (name === 'lumen_enabled') { LC.applyEnabledPref(); return true; }
    /* Task 35: подкраска фона от постера живёт в своём <style> и гаснет при
       полностью выключенном движении. Смена режима таблицу стилей не
       пересобирает, поэтому узел надо снять (или вернуть) отдельной строкой —
       иначе фон остался бы подкрашенным до следующего события. */
    /* Проверка на ТВ 2026-09-24: ротацию кадров открытой карточки гасит и
       возвращает режим «Выкл» (slideshowEnabled, src/50_backdrops.js), а
       читается он контроллером на resume() — его и дёргает
       LC.applySlideshowPref. Выключенный плагин не трогает ничего (Task 10). */
    if (name === 'lumen_motion') {
      LC.applyMotionMode();
      if (LC.enabled()) LC.applySlideshowPref();
      try { if (LC.accent && LC.accent.repaint) LC.accent.repaint(); } catch (eAccentMotion) { warn('accent repaint failed', eAccentMotion); }
      return true;
    }
    /* Task 40 (фаза 4): тумблер тяжёлых эффектов. LC.applyMotionMode
       переставляет класс lumen-fx-heavy на body (от него зависят Ken Burns,
       зум заставки и плавная смена кадров в карточке и на главной) и
       пересчитывает слой частиц. Проверка на ТВ 2026-09-24: сама смена
       кадров и трейлеры от тумблера больше не зависят — их гасит только
       режим «Выкл» (ветка lumen_motion выше). */
    if (name === 'lumen_fx_heavy') {
      LC.applyMotionMode();
      return true;
    }
    /* Task 31 (фаза 4): HUD отладки — sync() сам решает, показать узел или
       снять его, по свежему значению настройки. onChangeFor (ниже) зовёт
       applyPrefChange без своего try/catch — исключение ушло бы в вендора
       Lampa, поэтому createElement/appendChild/removeChild внутри sync()
       защищены здесь же, как и остальные ветки этой функции. */
    if (name === 'lumen_debug_hud') {
      try { if (LC.hud) LC.hud.sync(); } catch (eHud) {}
      return true;
    }
    if (name === 'lumen_slideshow') { LC.applySlideshowPref(); return true; }
    /* Ревью «Волны 1», п.5: интервал общий у карточки и кадра главной
       (LC.backdrops.intervalMs), и «Применяется сразу» в описании — про оба. */
    if (name === 'lumen_slide_interval') {
      LC.applySlideshowPref();
      try { if (LC.hero && LC.hero.applyInterval) LC.hero.applyInterval(); } catch (eHeroInt) {}
      return true;
    }
    if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
    if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
    if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }
    /* Правка пользователя 2026-09-16 (п.6): гарнитура меняется на лету, как
       акцент: подменяется <link> на Google Fonts (адрес зависит от пары) и
       пересобирается CSS — стеки font-family зашиты в текст стилей. Имя без
       префикса PLUGIN, поэтому ветка стоит здесь, до проверки префикса. */
    /* 1.0.2: строка пункта в открытом разделе набрана выбранной
       гарнитурой (fontPreview) — её перекрашиваем вместе с таблицей. */
    if (name === 'lumen_font') { LC.injectFonts(); LC.injectCss(); refreshFontPreview(); return true; }
    /* 1.0.2: «Стиль» — select вместо двух кнопок. Выбранный Lumen или
       Apple TV пишет набор (applyPreset — с nolisten, одним применением);
       «Свой» ничего не пишет: значение просто возвращается к тому, что
       стоит на самом деле (syncStyle). */
    if (name === 'lumen_style') {
      var style = LC.pref('lumen_style', 'lumen');
      if (style === 'lumen' || style === 'appletv') applyPreset(style);
      else syncStyle();
      return true;
    }
    /* Фаза 3: тема, плотность подложек и масштаб живут целиком в таблице
       стилей — ни классов, ни узлов, ни пересборки экрана им не нужно.
       Пересборка CSS применяет их на любом открытом экране плагина сразу
       (LC.injectCss заодно пересобирает CSS экранов пути до плеера). Имена
       без префикса PLUGIN, поэтому ветка стоит до проверки префикса. */
    /* Task 62a (фаза 5): область подкраски. Правило подложки фокуса либо
       попадает в таблицу, либо нет, — значит достаточно пересобрать её.
       Узел подкраски переписывать отдельно не нужно: последней строкой
       LC.injectCss зовёт LC.accent.restyle(), а тот берёт текст у
       LC.accentFocusCss — пустой в режиме 'veil', и узел снимается целиком
       (src/57_color.js, writeAccentStyle). */
    /* Task 73 (фаза 6): плоский вид — тоже целиком таблица стилей, и
       карточки, и экранов пути до плеера (LC.injectCss пересобирает обе). */
    /* Правка 2026-09-26: размер плиток рядов и сеток — ширина карточки ряда
       и число колонок сетки, тоже целиком таблица стилей. */
    if (name === 'lumen_theme' || name === 'lumen_solid' || name === 'lumen_scale' ||
        name === 'lumen_accent_scope' || name === 'lumen_flat' || name === 'lumen_tile_size') { LC.injectCss(); return true; }
    /* A6: «Скрывать блоки анализа Lampa» читается в момент ПОСТРОЕНИЯ
       карточки: ряды Lampa не создаются вовсе (src/90_runtime.js,
       dropMetaData). Ни прятать их правилом, ни снимать узел со сцены
       нельзя — оба пути ломают навигацию, разбор и замеры там же. На уже
       открытом экране применять нечего, поэтому ветка пустая; своя она
       потому, что иначе имя ушло бы дальше как чужое. */
    if (name === 'lumen_hide_meta') return true;
    /* Правка 2026-09-23: логотип названия в карточке. Уже открытые карточки
       перерисовываются сразу (LC.header.applyLogoPref): выключение
       возвращает текст, включение ставит логотип тем же путём, что и при
       открытии, — с ожиданием и потолком. Таблицу стилей не трогает. */
    if (name === 'lumen_card_logo') {
      try { if (LC.header && LC.header.applyLogoPref) LC.header.applyLogoPref(); } catch (eCardLogo) {}
      return true;
    }
    /* Task 24 (фаза 3): акцент от постера. Выключили — цвет из настроек
       возвращается сразу; включили — считается по фильму открытой карточки.
       Пересобирает CSS сам, поэтому отдельного injectCss здесь нет. */
    if (name === 'lumen_accent_auto') {
      try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccent) {}
      /* Task 62a (найдено живой проверкой фикс-раунда): при «Только фон» от
         этой настройки зависит СОСТАВ таблицы — подложка фокуса карточки
         есть при выключенной подкраске и снята при включённой
         (LC.accentScope, src/81_prefs.js). LC.applyAccentPref пересобирает
         таблицу только когда меняется ЦВЕТ, поэтому здесь её надо
         пересобрать явно: без этого выключение и обратное включение
         подкраски оставляли подложку в том виде, в каком она была при
         прошлой сборке. Повторной работы это не стоит — LC.injectCss не
         переписывает узел, если текст таблицы не изменился. */
      if (LC.pref('lumen_accent_scope', 'full') === 'veil') LC.injectCss();
      return true;
    }
    /* Task 28 (фаза 3): режим показа отзывов меняет переключатель в шапке
       ряда (1.0.2: пункта в разделе нет) — запись приходит сюда, и ряд
       открытой карточки перерисовывается по той же дороге, что при смене
       ключа API. */
    if (name === 'lumen_reviews' || name === 'lumen_kp_key' || name === 'lumen_reviews_mode') { LC.applyReviewsPref(); return true; }
    /* Сверка 2026-09-26: кнопка «Франшиза» и ряд «Смотреть по порядку» —
       перерисовка открытой карточки одной точкой (src/90_runtime.js);
       таблица стилей от них не зависит. 1.0.2: в разделе они — один пункт
       «Франшизы» (lumen_franchise); старые ключи остаются ветками. */
    if (name === 'lumen_franchise' || name === 'lumen_franchise_button' || name === 'lumen_franchise_row') {
      try { if (LC.applyFranchisePref) LC.applyFranchisePref(); } catch (eFr) {}
      return true;
    }
    /* Task 20: подсказка «Ключ API не задан» — перерисовать ряд отзывов
       открытой карточки (там же, где её рисует LC.reviews) и снять/вернуть
       подсказку в открытой сетке подборки Кинопоиска. 1.0.2: пункта в
       разделе нет, значение пишет кнопка «Скрыть» на экране. */
    if (name === 'lumen_kp_hint') {
      LC.applyReviewsPref();
      try { if (LC.applyKpHintPref) LC.applyKpHintPref(); } catch (eHint) {}
      return true;
    }
    /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами — это и
       новая таблица стилей (высота кадра и сдвиг области рядов считаются из
       одной величины), и жизнь самого узла героя: «Выключен» его снимает, а
       любое другое значение — возвращает на открытую главную. */
    if (name === 'lumen_hero_size') {
      try { if (LC.applyHeroSizePref) LC.applyHeroSizePref(); } catch (eHeroSize) {}
      return true;
    }
    /* Task 28 (фаза 3): автотрейлер в кадре главной. Выключение снимает
       играющий ролик сразу; включение ничего не запускает — ролик появится со
       следующей остановки фокуса (src/48_hero.js, applyTrailer). */
    if (name === 'lumen_hero_trailer') {
      try { if (LC.hero && LC.hero.applyTrailer) LC.hero.applyTrailer(); } catch (eHeroTr) {}
      return true;
    }
    /* Правка 2026-09-23: что показывает кадр главной. «Только кадры» снимает
       ролик, смена кадров продолжается; «Кадры и трейлер» смену не трогает,
       ролик — со следующей остановки фокуса (src/48_hero.js, applyMedia). */
    if (name === 'lumen_hero_media') {
      try { if (LC.hero && LC.hero.applyMedia) LC.hero.applyMedia(); } catch (eHeroMedia) {}
      return true;
    }
    /* Task 71 (фаза 6): логотип названия в кадре главной. Перерисовка героя
       той же моделью: выключение возвращает текстовый заголовок на открытой
       главной сразу, включение показывает логотип, как только его картинка
       доедет (src/48_hero.js, applyLogoPref). */
    if (name === 'lumen_hero_logo') {
      try { if (LC.hero && LC.hero.applyLogoPref) LC.hero.applyLogoPref(); } catch (eHeroLogo) {}
      return true;
    }
    /* Task 25 (фаза 3): метки на постерах — наблюдатель ставится и снимается
       на лету вместе с уже нарисованными метками открытой главной. */
    if (name === 'lumen_badges') {
      try { if (LC.applyBadgesPref) LC.applyBadgesPref(); } catch (eBadges) {}
      return true;
    }
    /* Task 26 (фаза 3): пункты в меню карточки — две подписки, которые
       ставятся и снимаются на лету; экран перерисовывать не нужно. */
    if (name === 'lumen_context_menu') {
      try { if (LC.applyCardmenuPref) LC.applyCardmenuPref(); } catch (eCardmenu) {}
      return true;
    }
    /* Task 27 (фаза 3): мини-карта и ускорение листания. Обе настройки —
       одни и те же две подписки на клавиатуру Lampa: выключили обе — подписок
       нет вовсе, включили любую — они возвращаются (LC.applyNavPref).
       1.0.2: в разделе они — один пункт «Ускорители пульта». */
    if (name === 'lumen_remote_boost' || name === 'lumen_minimap' || name === 'lumen_fastscroll') {
      try { if (LC.applyNavPref) LC.applyNavPref(); } catch (eNav) {}
      return true;
    }
    /* Task 19/20: чипы профилей настроения — монтируются и снимаются на лету. */
    if (name === 'lumen_moods') {
      try { if (LC.applyMoodsPref) LC.applyMoodsPref(); } catch (eMoods) {}
      return true;
    }
    /* Task 15/20 (фаза 2), Task 57 (фаза 5): состав, число, фильтр рядов
       главной и дедупликация между рядами. Все меняют НАБОР карточек в
       рядах, поэтому применяются одинаково:
       ряды перерегистрируются, открытая главная пересобирается
       (LC.applyRowsPref, src/90_runtime.js). */
    /* Постеры: источник постера меняет не набор карточек, а их обложки, но
       применяется тем же способом — ряды собираются заново. Иначе человек,
       который выбирает режим ради сравнения на своём экране, увидел бы
       разницу только после выхода с главной и возврата, то есть сравнивал
       бы по памяти. */
    if (name === 'lumen_hide_watched' || name === 'lumen_rows_limit' || name === 'lumen_home_rows' ||
        name === 'lumen_rows_dedupe' || name === 'lumen_posters') {
      try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
      return true;
    }
    /* Task 16 (фаза 2): персональные ряды включены/выключены; волна 4 — и
       «Начало главной». Обе меняют только раскладку главной: план
       перерегистрирует ряды без перезагрузки каталога, главная
       пересобирается (LC.applyPersonalPref, src/90_runtime.js). */
    if (name === 'lumen_personal_rows' || name === 'lumen_home_start') {
      try { if (LC.applyPersonalPref) LC.applyPersonalPref(); } catch (eP) {}
      return true;
    }
    /* Task 14/20 (фаза 2): адрес каталога изменён — кэш прежнего каталога
       больше не годится, сбрасываем его и тут же перезагружаем каталог с
       нового адреса (LC.applyRowsPref → LC.manifest.load → register). */
    if (name === 'lumen_manifest_url') {
      try { if (window.Lampa && Lampa.Storage) Lampa.Storage.set('lumen_manifest', null); } catch (e) {}
      try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eUrl) {}
      return true;
    }
    /* Кнопки-параметры своего значения не хранят — работу делает нажатие
       (onButtonFor): самотест и переход во второй экран. Ветка нужна ради
       контракта «у каждого пункта раздела своя ветка» (его держит тест). */
    if (name === 'lumen_debug_bench' || name === 'lumen_more') return true;
    /* 1.0.2: бывшие «консольные» выключатели, теперь в «Для разработчика».
       Их модули читают значение на каждом шаге (src/58_rowmem.js,
       src/58_prefill.js), а обёртки lumen_netmem ставятся при включении
       плагина — со следующего запуска, как и сказано в описании. Применять
       на лету нечего. */
    if (name === 'lumen_rowmem' || name === 'lumen_rowmem_bytes' || name === 'lumen_netmem' || name === 'lumen_prefill') return true;
    /* Task 23 (фаза 3): фильтр «не смотрел» читается при входе в рулетку
       (src/56_roulette.js), поэтому применять на лету нечего — на открытом
       экране его состоянием управляет чип. 1.0.2: пункта в разделе нет,
       ветка осталась, чтобы имя не ушло дальше как чужое. */
    if (name === 'lumen_roulette_unseen') return true;
    /* Task 21 (фаза 3): атмосферы — слой частиц на открытой карточке и в
       кадре главной. Выключение снимает его немедленно (иначе он дожил бы
       до следующего экрана), включение — пересчитывает тему по данным
       того, что открыто сейчас. */
    if (name === 'lumen_fx') {
      try { if (LC.applyFxPref) LC.applyFxPref(); } catch (eFx) {}
      return true;
    }
    /* Task 22 (фаза 3): ambient-режим. Все три пункта применяет одна точка:
       выключение снимает подписки, таймер и открытый слой немедленно,
       включение подписывается заново, а смена задержки и источника
       перезаводит ожидание покоя (src/54_ambient.js, apply). */
    if (name === 'lumen_ambient' || name === 'lumen_ambient_source' || name === 'lumen_ambient_delay') {
      try { if (LC.applyAmbientPref) LC.applyAmbientPref(); } catch (eAmb) {}
      return true;
    }
    /* Ревью волны A (важное 1): «Размер интерфейса» — настройка САМОЙ Lampa,
       но от неё зависит текст нашей таблицы. Lampa меняет кегль body
       (app.min.js:31629-31639), а вместе с ним и цену em, из которой оба
       порога раскладки считают отношение сторон (screenEm, src/30_css.js).
       Без пересборки пороги оставались бы от прежнего размера до следующей
       правки любой нашей настройки.
       Возвращаем false, а не true: пометка pref_handled гасит запасной путь
       onChange, а он заведён только на НАШИ пункты — чужое имя через него
       не приходит, и гасить нечего. */
    if (name === 'interface_size') { LC.injectCss(); return false; }
    if (name.indexOf(PLUGIN + '_') !== 0) return false;
    /* Ревью Task 8 (п.3/ревью 2 п.4): от этих двух настроек таблица стилей не
       зависит вовсе — классы, узлы и CSS-переменную подписи кнопки ставит
       рендер. Гонять пересборку всего CSS впустую незачем. */
    if (name === PLUGIN + '_fonts') { LC.injectFonts(); LC.injectCss(); return true; }
    if (name === PLUGIN + '_progress') { LC.applyProgressPref(); return true; }
    LC.injectCss();
    return true;
  }

  function onChangeFor(name) {
    return function () {
      if (pref_handled === name) { pref_handled = ''; return; }
      applyPrefChange(name);
    };
  }

  /* -------------------------------------------------------------------- */
  /* Task 20: экран выбора рядов подборок для главной.                     */
  /*                                                                       */
  /* Multi-select в SettingsApi нет, поэтому пункт «Какие подборки         */
  /* показывать» — параметр type:'button': Lampa зовёт его onChange по     */
  /* нажатию (без                                                          */
  /* значения, app.min.js ~47543), и мы открываем Lampa.Select с           */
  /* чекбоксами. Чекбокс селектбокс НЕ закрывает (app.min.js ~7036),       */
  /* поэтому выбор сохраняется на каждом onCheck — «Назад» в любой момент  */
  /* оставляет уже записанный набор. Сама запись в Storage поднимает        */
  /* listener 'change' → applyPrefChange('lumen_home_rows') → ряды         */
  /* перерегистрируются и главная перестраивается (LC.applyRowsPref).       */
  /* -------------------------------------------------------------------- */
  function openHomeRows() {
    try {
      if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return;
      if (!LC.rows || typeof LC.rows.rowChoices !== 'function') return;
      if (!LC.manifest || typeof LC.manifest.get !== 'function') return;

      var manifest = LC.manifest.get();
      var choices = LC.rows.rowChoices(manifest, LC.rows.storedIds());
      var lang = langCode();

      /* Заголовки групп каталога: id → подпись на языке интерфейса. */
      var groupTitle = {};
      var groups = (manifest && manifest.groups) || [];
      for (var g = 0; g < groups.length; g++) {
        groupTitle[groups[g].id] = (LC.hub && typeof LC.hub.titleOf === 'function')
          ? LC.hub.titleOf(groups[g], lang)
          : (groups[g].title || groups[g].id);
      }

      /* Полное ревью, S1: Lampa.Select вставляет заголовок пункта и
         разделителя в разметку сырым (Template.get → $(tpl) и
         '<span>' + title + '</span>', app.min.js bind$4 ~7000), а названия
         приходят из каталога — он может быть внешним. Экранируются все. */
      var esc = LC.util.esc;
      var items = [];
      var lastGroup = null;
      for (var i = 0; i < choices.length; i++) {
        var c = choices[i];
        /* Отмеченные идут первыми (LC.rows.rowChoices), и разделять их по
           группам незачем — группы начинаются там, где пошли неотмеченные. */
        if (!c.checked && c.group !== lastGroup) {
          lastGroup = c.group;
          items.push({ title: esc(groupTitle[c.group] || c.group), separator: true });
        }
        var item = { title: esc(c.title), lumen_id: c.id, checkbox: true, checked: c.checked };
        /* Сверка 2026-09-26: сезонная подборка стоит на главной только в
           свой сезон — метка объясняет, почему отмеченной её сейчас нет.
           subtitle Lampa вставляет так же сыро, как заголовок (шаблон
           selectbox_item), — экранируется тем же esc. */
        if (c.seasonal) item.subtitle = esc(LC.lang('lumen_rows_seasonal'));
        items.push(item);
      }

      function save() {
        var ids = [];
        for (var k = 0; k < items.length; k++) {
          if (items[k].checkbox && items[k].checked) ids.push(items[k].lumen_id);
        }
        /* Пустая строка в Storage не сохраняется (план 0.2), да и пустая
           главная никому не нужна: снятые все галочки = набор каталога. */
        try { Lampa.Storage.set('lumen_home_rows', ids.join(',')); } catch (e) { }
      }

      Lampa.Select.show({
        title: LC.lang('lumen_home_rows_select'),
        items: items,
        onCheck: save,
        onBack: function () {
          try { if (Lampa.Controller && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle('settings_component'); } catch (e) { }
        }
      });
    } catch (err) {
      warn('home rows select failed', err);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Task 62b (фаза 5), 1.0.2: готовый стиль — select «Стиль».              */
  /*                                                                        */
  /* Выбор выставляет НАБОР ЗНАЧЕНИЙ существующих пунктов — каждое своим    */
  /* Lampa.Storage.set, потому что правка localStorage мимо Lampa разошлась */
  /* бы с её кэшем значений (readed, app.min.js:48472).                     */
  /*                                                                        */
  /* Ревью Task 62 (пункт 5): запись идёт с nolisten — третьим аргументом   */
  /* Storage.set (app.min.js:48472-48504: при нём listener 'change' не      */
  /* рассылается, а localStorage и readed обновляются как обычно). Иначе    */
  /* каждая из записей поднимала бы своё событие и свою ветку               */
  /* applyPrefChange, то есть до пяти полных пересборок таблицы стилей      */
  /* подряд на одно нажатие (замер до правки, стенд 960×540@2: ровно 5      */
  /* вызовов LC.injectCss, медиана семи прогонов 33.5 мс при разбросе       */
  /* 23-48 мс — и это Chrome на десктопе). Применение вместо этого делает   */
  /* LC.applyPresetChanges (src/90_runtime.js) один раз на весь набор.      */
  /*                                                                        */
  /* Пишутся только РАЗЛИЧИЯ: повторный выбор тогда ничего не делает, а     */
  /* список изменённого есть что показать в подтверждении. Булево значение  */
  /* пишется строкой, как хранит его сама Lampa ('true'/'false'): JS-false  */
  /* она в localStorage запишет, но до конца сессии будет отдавать из       */
  /* памяти сам JS-false, а его LC.pref не отличит от «значения нет».       */
  /*                                                                        */
  /* 1.0.2: значение «Стиля» не врёт. Любая правка пункта набора (ветка     */
  /* applyPrefChange) и сам выбор сверяют набор с обоими стилями            */
  /* (LC.prefs.styleOf) и пишут в lumen_style то, что стоит на самом деле:  */
  /* 'lumen', 'appletv' или 'custom' («Свой»).                              */
  /* -------------------------------------------------------------------- */

  /* Значение пункта, как его видит плагин: сохранённое либо дефолт пункта,
     с той же нормализацией, что при чтении (строки 'true'/'false' у
     переключателей, старое значение меток). Сырой Storage тут не годится:
     у пункта, которого не трогали, ключа нет вовсе, и «уже как надо»
     не отличалось бы от «не записано». */
  function presetCurrent(key) {
    var entry = LC.prefs.find(key);
    var def = entry ? entry['default'] : '';
    if (typeof def === 'function') def = def();
    var raw = Lampa.Storage.get(key, def);
    if (key === 'lumen_badges') return LC.prefs.badgesMode(raw);
    if (typeof def === 'boolean') return LC.prefs.boolOf(raw, def);
    return raw;
  }

  /* Ревью Task 62 (пункт 4): подпись пункта в ОТКРЫТОМ разделе настроек
     после нашей записи с nolisten сама не обновится. Публичный
     Lampa.Params.update(elem) перечитывает значение из Storage и пишет его
     в .settings-param__value (app.min.js:47640-47678, экспорт Params на
     :47957-47967 и :55954). Второй и третий аргументы нужны только ветке
     data-children, которой у наших пунктов нет.
     Раздел закрыт или пункт на другом экране — узла не найдётся, и функция
     промолчит: открытый позже экран Lampa нарисует по Storage сама. */
  function refreshParamRow(key) {
    try {
      if (typeof $ !== 'function') return;
      if (!Lampa.Params || typeof Lampa.Params.update !== 'function') return;
      var elem = $('.settings-param[data-name="' + key + '"]');
      if (elem && elem.length) Lampa.Params.update(elem);
    } catch (e) {
      warn('preset row refresh failed', e);
    }
  }

  /* 1.0.2: «Стиль» показывает то, что стоит на самом деле. Совпадает с
     сохранённым — не пишем ничего (у нового профиля ключа нет, и
     Storage.get отдаёт дефолт 'lumen' — ровно то, что и стоит). */
  function syncStyle() {
    try {
      if (!window.Lampa || !Lampa.Storage) return;
      if (typeof Lampa.Storage.set !== 'function' || typeof Lampa.Storage.get !== 'function') return;
      var now = LC.prefs.styleOf(presetCurrent);
      if (Lampa.Storage.get('lumen_style', 'lumen') === now) return;
      Lampa.Storage.set('lumen_style', now, true);
      refreshParamRow('lumen_style');
    } catch (e) {
      warn('style sync failed', e);
    }
  }

  /* 1.0.2: слитые пункты (LC.prefs.MERGED). Человек тронул новый пункт —
     старые ключи получают его значение (LC.prefs.mergedOn): выключил —
     'false', включил — 'true'. Дальше решает только новый пункт, а откат
     на 1.0.1, которая читает одни старые ключи, видит тот же выбор (ревью
     1.0.2: прежняя запись 'true' включала там выключенное). Пока новый
     пункт не тронут — места чтения дочитывают старый, и частичный выбор
     (выключенная кнопка «Франшиза» при включённом ряде) не теряется молча.
     Пишется только расхождение; ключа нет — это «включено», как у 1.0.1. */
  function releaseMerged(name) {
    try {
      if (!Object.prototype.hasOwnProperty.call(LC.prefs.MERGED, name)) return;
      if (!window.Lampa || !Lampa.Storage) return;
      if (typeof Lampa.Storage.set !== 'function' || typeof Lampa.Storage.get !== 'function') return;
      var on = LC.prefs.mergedOn(name, presetCurrent(name));
      var old = LC.prefs.MERGED[name];
      for (var i = 0; i < old.length; i++) {
        if (LC.prefs.boolOf(Lampa.Storage.get(old[i], ''), true) !== on) Lampa.Storage.set(old[i], on ? 'true' : 'false', true);
      }
    } catch (e) {
      warn('merged release failed', e);
    }
  }

  /* 1.0.2: строка «Шрифт» набрана выбранной гарнитурой — превью прямо в
     разделе (onRender у addParam, app.min.js addParams). Стек отдаёт
     LC.fontStack (src/30_css.js): пусто при «Как в Lampa» и у выключенного
     плагина — строка наследует шрифт Lampa. Грузится одна выбранная
     гарнитура, поэтому превью — у строки, а не у каждого варианта в окне
     выбора. */
  function fontPreview(item) {
    try {
      if (!item || typeof item.css !== 'function') return;
      item.css('font-family', typeof LC.fontStack === 'function' ? LC.fontStack() : '');
    } catch (e) {
      warn('font preview failed', e);
    }
  }

  function refreshFontPreview() {
    try {
      if (typeof $ !== 'function') return;
      var elem = $('.settings-param[data-name="lumen_font"]');
      if (elem && elem.length) fontPreview(elem);
    } catch (e) {
      warn('font preview refresh failed', e);
    }
  }

  function applyPreset(id) {
    try {
      if (!window.Lampa || !Lampa.Storage) return;
      if (typeof Lampa.Storage.set !== 'function' || typeof Lampa.Storage.get !== 'function') return;
      var values = LC.prefs.presetValues(id);
      var keys = LC.prefs.PRESET_KEYS;
      var changed = [];
      var written = [];
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (!Object.prototype.hasOwnProperty.call(values, key)) continue;
        var want = values[key];
        if (presetCurrent(key) === want) continue;
        Lampa.Storage.set(key, typeof want === 'boolean' ? (want ? 'true' : 'false') : want, true);
        releaseMerged(key);
        written.push(key);
        refreshParamRow(key);
        var entry = LC.prefs.find(key);
        if (entry) changed.push(LC.lang(entry.label));
      }
      /* Одно применение на весь набор вместо ветки на каждую запись. */
      if (written.length && LC.applyPresetChanges) LC.applyPresetChanges(written);
      if (written.indexOf('lumen_font') !== -1) refreshFontPreview();
      syncStyle();
      /* Подтверждение — перечнем того, что изменилось, названиями самих
         пунктов раздела: так видно, куда идти, если что-то не понравилось.
         Показывается и когда менять было нечего: молчащий выбор выглядит
         сломанным. */
      var head = LC.lang(id === 'appletv' ? 'lumen_preset_appletv_short' : 'lumen_preset_lumen_short');
      var text = head + ' · ' + (changed.length ? changed.join(', ') : LC.lang('lumen_preset_same'));
      if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(text);
    } catch (err) {
      warn('preset failed', err);
    }
  }

  /* -------------------------------------------------------------------- */
  /* 1.0.2: второй экран раздела — «Дополнительно…».                        */
  /*                                                                        */
  /* Это такой же экран параметров Lampa (Component$2), как «Lumen Card»,   */
  /* только без своей папки в списке настроек: addComponent мы для него не  */
  /* зовём (Main.update, app.min.js:8598-8610, показал бы его рядом с       */
  /* «Lumen Card»). Экрану нужны лишь шаблон settings_<имя> (Template.get в */
  /* Component$2) — его кладём сами тем же '<div></div>', что кладёт        */
  /* addComponent, — и параметры (SettingsApi.getParam).                    */
  /*                                                                        */
  /* Открывает его Lampa.Settings.create (create$b, app.min.js:10358):      */
  /* экран встаёт на место нашего, контроллер — тот же settings_component.  */
  /* «Назад» без onBack увело бы в общий список настроек Lampa             */
  /* (Component$2.back → Controller.toggle('settings')), поэтому onBack     */
  /* заново открывает «Lumen Card» с фокусом на «Дополнительно…»            */
  /* (last_index — индекс среди .selector экрана, заголовки групп не        */
  /* .selector).                                                            */
  /* -------------------------------------------------------------------- */
  /* Имя второго экрана. Функция, а не переменная: модуль грузится и в
     тестах без 00_head.js, где PLUGIN не определён. */
  function moreComponent() {
    return PLUGIN + '_more';
  }

  function moreIndex() {
    var at = 0;
    for (var i = 0; i < LC.prefs.LIST.length; i++) {
      var e = LC.prefs.LIST[i];
      if (e.section === 'more') continue;
      if (e.name === 'lumen_more') return at;
      if (e.type !== 'title') at++;
    }
    return 0;
  }

  /* Стенд 960×540@2: last_index ставит фокус на «Дополнительно…», но лента
     экрана к строке не едет — фокус при сборке экрана до его обработчика
     прокрутки (updateScroll в Component$2, app.min.js:8420) не доходит, и
     строка под фокусом остаётся ниже кромки (top 2412 px при окне 540).
     Повторный фокус той же строки штатным Controller.collectionFocus уже
     собранного экрана ленту к ней прокручивает (top 423). */
  function backFromMore() {
    try {
      Lampa.Settings.create(PLUGIN, { last_index: moreIndex() });
      if (typeof $ !== 'function' || !Lampa.Controller || typeof Lampa.Controller.collectionFocus !== 'function') return;
      var row = $('.settings-param[data-name="lumen_more"]');
      if (row && row.length && row.hasClass('focus')) Lampa.Controller.collectionFocus(row[0], row.parent());
    } catch (e) {
      warn('settings back failed', e);
    }
  }

  function openMore() {
    try {
      if (!window.Lampa || !Lampa.Settings || typeof Lampa.Settings.create !== 'function') return;
      Lampa.Settings.create(moreComponent(), { onBack: backFromMore });
    } catch (err) {
      warn('settings more failed', err);
    }
  }

  /* Ревью 1.0.2: Lampa.Settings.update() пересоздаёт открытый экран
     заново — create$b(last, { last_index }) (update$f, app.min.js:10377-
     10383) без нашего onBack, и «Назад» со второго экрана уводил в общий
     список настроек Lampa. Зовёт update и сама Lampa: истёкший код
     удалённой настройки CUB (app.min.js:55759), выход из аккаунта. Событие
     'open' (create$b) несёт тот самый объект params, что держит экран, а
     onBack Lampa читает в момент нажатия (Component$2.back,
     app.min.js:8535), — достаточно дописать его в событии. Свой onBack
     (openMore, чужой вызов) не трогаем. */
  function moreOpened(e) {
    try {
      if (e && e.name === moreComponent() && e.params && !e.params.onBack) e.params.onBack = backFromMore;
    } catch (err) {
      warn('settings more back failed', err);
    }
  }

  /* Подписка живёт, пока плагин включён: activate/deactivate
     (src/90_runtime.js). Снять и поставить заново — повтор не заводит
     второй подписки. */
  LC.followMoreBack = function (on) {
    try {
      var listener = window.Lampa && Lampa.Settings && Lampa.Settings.listener;
      if (!listener || typeof listener.follow !== 'function' || typeof listener.remove !== 'function') return;
      listener.remove('open', moreOpened);
      if (on) listener.follow('open', moreOpened);
    } catch (err) {
      warn('settings more follow failed', err);
    }
  };

  /* Обработчик нажатия для параметров type:'button'. */
  function onButtonFor(name) {
    return function () {
      if (name === 'lumen_home_rows') openHomeRows();
      else if (name === 'lumen_more') openMore();
      else if (name === 'lumen_debug_bench') {
        try { if (LC.bench) LC.bench.start(); } catch (e) { warn('bench start failed', e); }
      }
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
    var component = entry.section === 'more' ? moreComponent() : PLUGIN;
    var param = { name: entry.name, type: entry.type };
    var field = { name: LC.lang(entry.label) };
    if (entry.descr) field.description = LC.lang(entry.descr);
    /* Заголовок группы ничего не хранит и не имеет обработчика. */
    if (entry.type === 'title') {
      Lampa.SettingsApi.addParam({ component: component, param: param, field: field });
      return;
    }
    /* Кнопка-параметр ничего не хранит: Lampa зовёт её onChange по нажатию. */
    if (entry.type === 'button') {
      Lampa.SettingsApi.addParam({ component: component, param: param, field: field, onChange: onButtonFor(entry.name) });
      return;
    }
    /* Task 40: значение по умолчанию может быть ФУНКЦИЕЙ — так у пункта
       lumen_fx_heavy оно считается по платформе (src/81_prefs.js). Вызов
       здесь, а не при сборке LIST: модуль настроек не имеет права трогать
       Lampa при загрузке, а к моменту addSettings платформа уже известна. */
    param['default'] = typeof entry['default'] === 'function' ? entry['default']() : entry['default'];
    if (entry.type === 'select') param.values = valuesOf(entry);
    if (entry.type === 'input') {
      param.values = '';
      /* Живая находка финала фазы 3: пустое текстовое поле Lampa показывает
         не пустоту, а ПЛЕЙСХОЛДЕР (update$3, app.min.js: «if (!val && plr)
         val = plr;»), и берёт его из param.placeholder, вставляя в разметку
         как есть. Без этого поля в разделе стояло слово «undefined» —
         буквально оно, видимое пользователю. */
      param.placeholder = LC.lang(entry.placeholder);
    }
    var data = { component: component, param: param, field: field, onChange: onChangeFor(entry.name) };
    if (entry.name === 'lumen_font') data.onRender = fontPreview;
    Lampa.SettingsApi.addParam(data);
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
      /* Второй экран — без папки в списке настроек (см. openMore). Свой
         try: без шаблона не откроется только он, главный раздел — да. */
      try {
        if (Lampa.Template && typeof Lampa.Template.add === 'function') Lampa.Template.add('settings_' + moreComponent(), '<div></div>');
      } catch (eTpl) {
        warn('settings more template failed', eTpl);
      }

      /* Порядок пунктов, группы и экраны — LC.prefs.LIST (src/81_prefs.js). */
      for (var i = 0; i < LC.prefs.LIST.length; i++) addPrefParam(LC.prefs.LIST[i]);
      LC.settingsAdded = true;
      /* Сохранённый «Стиль» мог устареть (миграция 1.0.2 перевела шрифт,
         пункты правили в прежних версиях) — сверяем один раз при старте. */
      syncStyle();
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

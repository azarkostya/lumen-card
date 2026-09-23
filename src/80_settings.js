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
    /* Заголовки групп раздела (штатный параметр Lampa type:'title').
       Task 30 (финал фазы 3): к пяти прежним группам добавлены три —
       движение, навигация и рулетка; раскладка целиком — в LC.prefs.LIST
       (src/81_prefs.js). */
    lumen_card_group_look: { ru: 'Оформление', en: 'Appearance', uk: 'Оформлення' },
    /* Task 62b (фаза 5): готовый стиль — две кнопки, каждая выставляет набор
       значений пунктов «Оформления». Название группы говорит именно про
       стиль целиком, чтобы не путалось с пунктами под ней. */
    lumen_group_preset: { ru: 'Готовый стиль', en: 'Ready-made style', uk: 'Готовий стиль' },
    /* Ревью Task 62: описание перечисляет ВСЕ пункты, которые кнопка
       выставляет, включая те два, что в стиле Apple TV совпадают со
       значениями по умолчанию (кадр над рядами и акцент от постера): они
       тоже переписываются, и человек, поставивший «Кадр над рядами →
       Выключен», обязан узнать об этом до нажатия, а не после.
       Task 73: пунктов стало восемь — добавился «Плоский вид», которым
       стиль доходит до карточки, сетки и пути TorrServer.
       Ревью 2026-09-22 (п.4): девять — при сборке Task 73 из набора выпал
       «Логотип названия в кадре», хотя план фазы 6 оговаривал его прямо
       (в обоих стилях логотип включён).
       A6: десять — добавился пункт «Скрывать блоки анализа Lampa»: курс
       стиля Apple TV на «ничего лишнего» доходит и до чужих блоков на
       карточке, а стиль Lumen возвращает их выключенным пунктом. Число в
       тексте обоих описаний и длину PRESET_KEYS сверяет
       test/prefs.test.mjs. */
    lumen_preset_appletv_name: { ru: 'Применить стиль Apple TV', en: 'Apply the Apple TV style', uk: 'Застосувати стиль Apple TV' },
    lumen_preset_appletv_descr: {
      ru: 'Нейтральный стиль вместо тёплого. Выставляет десять пунктов «Оформления» разом: тема «Глубокая чёрная», акцент «Графит», шрифт Inter, метки «В подписи», цвет постера «Только фон», плоский вид включён, блоки анализа Lampa скрыты, кадр над рядами «Крупный», логотип названия в кадре включён, акцент от постера включён. Последние три — значения по умолчанию плагина: если вы меняли их руками, кнопка вернёт их обратно. Ключ API, масштаб, анимации, заставку, состав рядов и настройки самой Lampa не трогает. После кнопки любой пункт правится по отдельности.',
      en: 'A neutral style instead of the warm one. It sets ten items of "Appearance" at once: the "Deep black" theme, the "Graphite" accent, the Inter font, badges "In the caption", poster colour "Background only", flat look on, the Lampa analysis blocks hidden, hero "Large", the title logo in the hero on, accent from poster on. The last three are the plugin defaults: if you changed them by hand, the button changes them back. The API key, scale, animations, screensaver, row selection and Lampa own settings stay untouched. After the button every item can be adjusted one by one.',
      uk: 'Нейтральний стиль замість теплого. Виставляє десять пунктів «Оформлення» разом: тема «Глибока чорна», акцент «Графіт», шрифт Inter, мітки «У підписі», колір постера «Лише тло», плаский вигляд увімкнено, блоки аналізу Lampa сховано, кадр над рядами «Великий», логотип назви в кадрі увімкнено, акцент від постера увімкнено. Останні три — значення за замовчуванням плагіна: якщо ви змінювали їх руками, кнопка поверне їх назад. Ключ API, масштаб, анімації, заставку, склад рядів і налаштування самої Lampa не чіпає. Після кнопки кожен пункт правиться окремо.'
    },
    lumen_preset_lumen_name: { ru: 'Вернуть стиль Lumen', en: 'Restore the Lumen style', uk: 'Повернути стиль Lumen' },
    lumen_preset_lumen_descr: {
      ru: 'Возвращает те же десять пунктов к значениям по умолчанию плагина: тёплая тёмная тема, песочный акцент, шрифт Golos Text, метки «На постере», полная подкраска от постера, плоский вид выключен, блоки анализа Lampa показаны, кадр над рядами «Крупный», логотип названия в кадре включён, акцент от постера включён. Настройки вне оформления остаются вашими.',
      en: 'Returns the same ten items to the plugin defaults: warm dark theme, sand accent, the Golos Text font, badges "On the poster", full poster tinting, flat look off, the Lampa analysis blocks shown, hero "Large", the title logo in the hero on, accent from poster on. Everything outside the look stays yours.',
      uk: 'Повертає ті самі десять пунктів до значень за замовчуванням плагіна: тепла темна тема, піщаний акцент, шрифт Golos Text, мітки «На постері», повне підфарбування від постера, плаский вигляд вимкнено, блоки аналізу Lampa показано, кадр над рядами «Великий», логотип назви в кадрі увімкнено, акцент від постера увімкнено. Налаштування поза оформленням лишаються вашими.'
    },
    /* Короткие имена стилей для подтверждения Lampa.Noty: «Стиль Apple TV ·
       Тема, Акцентный цвет, Шрифт». Отдельно от подписей кнопок — те
       написаны глаголом («Применить…»), и в уведомлении читались бы как
       команда, а не как отчёт о сделанном. */
    lumen_preset_appletv_short: { ru: 'Стиль Apple TV', en: 'Apple TV style', uk: 'Стиль Apple TV' },
    lumen_preset_lumen_short: { ru: 'Стиль Lumen', en: 'Lumen style', uk: 'Стиль Lumen' },
    lumen_preset_same: { ru: 'уже применён', en: 'already applied', uk: 'вже застосовано' },
    lumen_group_motion: { ru: 'Движение и эффекты', en: 'Motion and effects', uk: 'Рух і ефекти' },
    lumen_card_group_backdrop: { ru: 'Фон карточки', en: 'Card background', uk: 'Фон картки' },
    lumen_card_group_blocks: { ru: 'Блоки карточки', en: 'Card blocks', uk: 'Блоки картки' },
    lumen_group_nav: { ru: 'Навигация и пульт', en: 'Navigation and remote', uk: 'Навігація та пульт' },
    lumen_group_roulette: { ru: 'Рулетка «Что посмотреть»', en: 'The "What to watch" roulette', uk: 'Рулетка «Що подивитися»' },
    lumen_card_group_path: { ru: 'Меню и экраны плеера', en: 'Menus and player screens', uk: 'Меню та екрани плеєра' },
    lumen_card_accent: { ru: 'Акцентный цвет', en: 'Accent color', uk: 'Акцентний колір' },
    /* Task 30: описание было единственным, чего не хватало самому первому
       пункту группы. Цвет виден сразу, но не очевидно, ГДЕ именно он
       появляется и что настройка действует на лету. */
    lumen_card_accent_descr: {
      ru: 'Цвет кнопок, колец фокуса, полос прогресса и подсветок на экранах плагина. Применяется сразу.',
      en: 'The colour of buttons, focus rings, progress bars and highlights on the plugin screens. Applied immediately.',
      uk: 'Колір кнопок, кілець фокуса, смуг прогресу та підсвічувань на екранах плагіна. Застосовується одразу.'
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
    /* Ревью Task 62 (М8): описание приведено к факту. Кольца вокруг карточки
       нет с Task 42 (акцент переехал подложкой под постер, src/30_css.js,
       AR.cardFocus), а чипы настроения от акцента не зависят с Task 43 — их
       фокус стал инверсией P.text/P.bg. Обещать их было ложью тем заметнее,
       что рядом встал новый пункт про ОБЛАСТЬ подкраски. */
    lumen_accent_auto_name: { ru: 'Акцент от постера', en: 'Accent from poster', uk: 'Акцент від постера' },
    lumen_accent_auto_descr: {
      ru: 'В открытой карточке цвет кнопок, колец фокуса и подсветок берётся из постера фильма. На главной от постера под фокусом меняются фон страницы, вуаль кадра и подложка карточки под фокусом — когда фокус постоял на карточке 3 секунды; при быстром листании ничего не считается. Тёмный цвет плагин высветляет, чтобы подписи читались; если постер не отдаёт пиксели, остаётся акцент, выбранный выше.',
      en: 'Inside an open film card the colour of buttons, focus rings and highlights is taken from the poster. On the home screen the poster under focus changes the page background, the hero veil and the plate under the focused card — once focus has rested on a card for 3 seconds; fast browsing computes nothing. A dark colour is lightened so that labels stay readable; if the poster does not give up its pixels, the accent chosen above stays in place.',
      uk: 'У відкритій картці колір кнопок, кілець фокуса та підсвічувань береться з постера фільму. На головній від постера під фокусом змінюються тло сторінки, вуаль кадру та підкладка картки під фокусом — коли фокус постояв на картці 3 секунди; при швидкому гортанні нічого не рахується. Темний колір плагін висвітлює, щоб підписи читалися; якщо постер не віддає пікселі, залишається акцент, вибраний вище.'
    },
    /* Task 62a (фаза 5): докуда доходит цвет, взятый с постера. «Полная» —
       как было с Task 35. «Только фон» снимает единственное место, где
       подкраска заходит на управление, — подложку карточки под фокусом;
       сам фокус при этом никуда не девается, постер по-прежнему растёт. */
    lumen_accent_scope_name: { ru: 'Где виден цвет постера', en: 'Where the poster colour shows', uk: 'Де видно колір постера' },
    lumen_accent_scope_descr: {
      ru: '«Полная» — цветом постера подкрашиваются и фон с вуалью кадра, и подложка карточки под фокусом. «Только фон» оставляет цвет в фоне, а карточка под фокусом остаётся нейтральной и просто увеличивается. Действует при включённом «Акценте от постера». Применяется сразу.',
      en: '"Everywhere" tints both the background with the hero veil and the plate under the focused card. "Background only" keeps the colour in the background, while the focused card stays neutral and simply grows. Works with "Accent from poster" on. Applied immediately.',
      uk: '«Повна» — кольором постера підфарбовуються і тло з вуаллю кадру, і підкладка картки під фокусом. «Лише тло» лишає колір у тлі, а картка під фокусом залишається нейтральною і просто збільшується. Діє за увімкненого «Акценту від постера». Застосовується одразу.'
    },
    lumen_accent_scope_full: { ru: 'Полная', en: 'Everywhere', uk: 'Повна' },
    lumen_accent_scope_veil: { ru: 'Только фон', en: 'Background only', uk: 'Лише тло' },
    /* Task 29 (фаза 3): переход «постер → кадр» и уведомление автодетекта
       слабого ТВ. */
    lumen_transition_name: { ru: 'Переход от постера', en: 'Poster transition', uk: 'Перехід від постера' },
    lumen_transition_descr: {
      ru: 'При открытии карточки постер, на котором стоял фокус, разворачивается во весь экран и растворяется в кадре фильма. Работает только при полных анимациях; открытие карточки не задерживает.',
      en: 'When a card opens, the poster that had focus expands to full screen and dissolves into the film still. Works only with full animations and never delays the card.',
      uk: 'Під час відкриття картки постер, на якому стояв фокус, розгортається на весь екран і розчиняється в кадрі фільму. Працює лише за повних анімацій і не затримує відкриття картки.'
    },
    /* Task 21 (фаза 3): тематические атмосферы. Описание честно называет
       цену: это самая тяжёлая часть плагина, и на слабом телевизоре она не
       включается вовсе — вместе с полными анимациями. */
    lumen_fx_name: { ru: 'Атмосферы', en: 'Atmospheres', uk: 'Атмосфери' },
    lumen_fx_descr: {
      ru: 'Лёгкий слой поверх кадра под тему фильма: снег у рождественского кино, летучие мыши у хоррора на Хэллоуин, звёзды у фантастики, дождь у нуара. Тема определяется по ключевым словам фильма. «Только сезонные» показывает лишь праздничные темы и лишь в свой месяц. Не запускается при лёгких и выключенных анимациях, а значит и на слабых телевизорах; под играющим трейлером встаёт на паузу.',
      en: 'A light layer over the still matching the film: snow for Christmas films, bats for Halloween horror, stars for science fiction, rain for noir. The theme is chosen by the film keywords. "Seasonal only" shows holiday themes and only in their month. It never starts with light or disabled animations, and therefore not on weak TVs; it pauses while a trailer is playing.',
      uk: 'Легкий шар поверх кадру під тему фільму: сніг для різдвяного кіно, кажани для горору на Гелловін, зорі для фантастики, дощ для нуару. Тема визначається за ключовими словами фільму. «Лише сезонні» показує тільки святкові теми і лише в їхній місяць. Не запускається за легких і вимкнених анімацій, а отже й на слабких телевізорах; під час трейлера стає на паузу.'
    },
    /* Task 22 (фаза 3): ambient-режим — кадры вместо статичного экрана
       после нескольких минут без пульта. Заголовок группы и три пункта. */
    lumen_group_ambient: { ru: 'Экранная заставка', en: 'Screensaver', uk: 'Екранна заставка' },
    /* Task 56 (фаза 5): описание прямо называет штатную заставку Lampa.
       Прежний текст говорил только про кадры — и человек, у которого
       пропало видео Lampa, по нему не понимал, из-за чего (интервью
       2026-09-21). Про выключенную штатную сказано, потому что это
       единственное состояние, в котором наша работает (canStart,
       src/54_ambient.js). Путь до тумблера Lampa не цитируется: украинской
       локали у неё в сборке нет (в app.min.js только ru и en), и точный
       перевод пунктов для uk мы не знаем. */
    lumen_ambient_name: { ru: 'Заставка из кадров', en: 'Frame screensaver', uk: 'Заставка з кадрів' },
    lumen_ambient_descr: {
      ru: 'Заменяет заставку Lampa: вместо её видео экран сменяется кадрами из фильмов в полный размер, с названием и часами. Работает, только когда собственная заставка Lampa выключена в её настройках — двух заставок разом не бывает. Любое нажатие возвращает экран мгновенно, и первое нажатие фокус не двигает. Не включается при играющем трейлере, открытом плеере, меню и в неактивной вкладке, а при выключенных анимациях не работает вовсе. Применяется сразу.',
      en: 'Replaces the Lampa screensaver: instead of its video the screen turns into full-size film stills with the title and a clock. Works only while the Lampa screensaver itself is off in its own settings — there are never two screensavers at once. Any key brings the screen back at once, and that first press does not move focus. It never starts while a trailer is playing, while the player or a menu is open, or in a background tab, and it does not work at all with animations off. Applied immediately.',
      uk: 'Замінює заставку Lampa: замість її відео екран змінюється кадрами з фільмів на весь розмір, з назвою та годинником. Працює, лише коли власну заставку Lampa вимкнено в її налаштуваннях — двох заставок водночас не буває. Будь-яке натискання миттєво повертає екран, і перше натискання не рухає фокус. Не вмикається під час трейлера, з відкритим плеєром чи меню та в неактивній вкладці, а з вимкненими анімаціями не працює зовсім. Застосовується одразу.'
    },
    lumen_ambient_source_name: { ru: 'Какие кадры', en: 'Which stills', uk: 'Які кадри' },
    lumen_ambient_source_descr: {
      ru: '«Известные фильмы» — отобранный список кадров из каталога плагина, он обновляется вместе с ним. «Кадры открытого фильма» показывает кадры той карточки, что осталась на экране, и падает на отобранный список, если карточки нет.',
      en: '"Famous films" is a curated list of stills from the plugin catalog, updated together with it. "Stills of the open film" shows the frames of the card left on screen and falls back to the curated list when there is no card.',
      uk: '«Відомі фільми» — дібраний список кадрів з каталогу плагіна, він оновлюється разом із ним. «Кадри відкритого фільму» показує кадри тієї картки, що лишилася на екрані, і падає на дібраний список, якщо картки немає.'
    },
    lumen_ambient_source_curated: { ru: 'Известные фильмы', en: 'Famous films', uk: 'Відомі фільми' },
    lumen_ambient_source_current: { ru: 'Кадры открытого фильма', en: 'Stills of the open film', uk: 'Кадри відкритого фільму' },
    lumen_ambient_delay_name: { ru: 'Через сколько включать', en: 'Idle time before start', uk: 'Через скільки вмикати' },
    lumen_ambient_delay_descr: {
      ru: 'Сколько пульт должен молчать, прежде чем включится заставка. Отсчёт начинается заново от любого нажатия. Применяется сразу.',
      en: 'How long the remote has to stay silent before the screensaver starts. Any key press restarts the countdown. Applied immediately.',
      uk: 'Скільки пульт має мовчати, перш ніж увімкнеться заставка. Відлік починається знову від будь-якого натискання. Застосовується одразу.'
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
    lumen_roulette_empty: {
      ru: 'Под фильтры ничего не подошло',
      en: 'Nothing matches the filters',
      uk: 'Під фільтри нічого не підійшло'
    },
    /* Настройка: с чего начинается фильтр «не смотрел» в рулетке. */
    lumen_roulette_unseen_name: { ru: 'Рулетка: только непросмотренное', en: 'Roulette: unwatched only', uk: 'Рулетка: лише непереглянуте' },
    lumen_roulette_unseen_descr: {
      ru: 'С чего начинается фильтр «Не смотрел» при входе в рулетку. Просмотренным считается то, что отмечено в Lampa или досмотрено до конца. Сам фильтр в рулетке можно снять и включить чипом.',
      en: 'The starting state of the "Not watched" filter when the roulette opens. Watched means marked in Lampa or played to the end. The filter itself can be toggled by a chip on the roulette screen.',
      uk: 'З чого починається фільтр «Не дивився» під час входу в рулетку. Переглянутим вважається те, що позначено в Lampa або додивлено до кінця. Сам фільтр у рулетці можна зняти й увімкнути чипом.'
    },
    lumen_fx_all: { ru: 'Все', en: 'All', uk: 'Усі' },
    lumen_fx_seasonal: { ru: 'Только сезонные', en: 'Seasonal only', uk: 'Лише сезонні' },
    lumen_fx_off: { ru: 'Выключены', en: 'Off', uk: 'Вимкнені' },
    /* Task 21: метка сезонной подборки в хабе и заголовок ряда адвента. */
    lumen_season_badge: { ru: 'Сезон', en: 'In season', uk: 'Сезон' },
    lumen_advent_title: { ru: 'Адвент-календарь', en: 'Advent calendar', uk: 'Адвент-календар' },
    lumen_advent_day: { ru: 'День', en: 'Day', uk: 'День' },
    lumen_advent_today: { ru: 'Сегодня', en: 'Today', uk: 'Сьогодні' },
    lumen_motion_auto_noty: {
      ru: 'Lumen Card: включены лёгкие анимации — устройство не успевает рисовать полные',
      en: 'Lumen Card: light animations enabled — this device cannot keep up with the full ones',
      uk: 'Lumen Card: увімкнено легкі анімації — пристрій не встигає малювати повні'
    },
    /* Фаза 3: тема — цвет тёмного фона и подложек. */
    lumen_theme_name: { ru: 'Тема', en: 'Theme', uk: 'Тема' },
    lumen_theme_descr: {
      ru: 'Цвет тёмного фона. «Глубокая чёрная» — настоящий чёрный без тёплого оттенка, для OLED-экранов. Применяется сразу.',
      en: 'The colour of the dark background. "Deep black" is true black without the warm tint, for OLED screens. Applied immediately.',
      uk: 'Колір темного тла. «Глибока чорна» — справжній чорний без теплого відтінку, для OLED-екранів. Застосовується одразу.'
    },
    lumen_theme_warm: { ru: 'Тёплая тёмная', en: 'Warm dark', uk: 'Тепла темна' },
    lumen_theme_black: { ru: 'Глубокая чёрная', en: 'Deep black', uk: 'Глибока чорна' },
    /* Фаза 3: плотность подложек — прозрачность и размытие карт. */
    lumen_solid_name: { ru: 'Плотные подложки', en: 'Solid panels', uk: 'Щільні підкладки' },
    lumen_solid_descr: {
      ru: 'Кнопки, чипы и подложки текста становятся сплошными, без просвечивающего кадра и размытия. Включите, если на телевизоре картинка мылит или подтормаживает.',
      en: 'Buttons, chips and text panels become opaque, with no show-through backdrop and no blur. Turn on if the picture looks smeared or stutters on your TV.',
      uk: 'Кнопки, чипи та підкладки тексту стають суцільними, без просвічування кадру і розмиття. Увімкніть, якщо на телевізорі картинка мулиться або підгальмовує.'
    },
    /* Task 73 (фаза 6): плоский вид. Описание перечисляет ровно те экраны,
       где вид меняется, — карточка, сетка подборки, хаб и путь TorrServer:
       на главной раскладка та же в обоих видах, и обещать там перемену
       нельзя.
       A5 (волна A финального плана): в сетке и хабе обещание было больше
       факта. Плоский вид добавляет там ровно три правила (src/30_css.js,
       конец блока flat): .lumen-grid .lumen-gcard .card__view и .card__img
       теряют background-color, .lumen-hub__tiles .lumen-tile — свой фон. Все
       три лежат ПОД картинкой: постер сетки (.card__img, absolute на весь
       .card__view) и кадр плитки хаба (.lumen-tile__img, object-fit:cover,
       opacity 0 до класса --filled) закрывают их целиком. Замер на стенде
       960×540@2, хаб «Подборки»: у плитки фон rgb(16,16,18) в обычном виде и
       rgba(0,0,0,0) в плоском — и это единственное отличие, видимое только у
       плиток без пришедшего кадра (в момент замера 25 из 34). Поэтому
       описание теперь говорит про подложку, а не про «вид», — обещать
       перемену раскладки там нечем. */
    lumen_flat_name: { ru: 'Плоский вид', en: 'Flat look', uk: 'Плаский вигляд' },
    lumen_flat_descr: {
      ru: 'Содержимое лежит прямо на фоне, а не в коробках: в карточке панель «Подробно» становится строкой фактов под описанием, счётчики разделов теряют плашки, отзывы — рамки и подложки, а у плиток серий кадр встаёт сверху во всю ширину, название и подпись уходят под него (ряд серий из-за этого чуть выше); на пути TorrServer раздачи и файлы разделяются тонкими линиями вместо карточек. В сетке подборки и в хабе меняется немногое: снимается только подложка под плиткой, а её видно, пока не пришёл постер или кадр, и у карточек без картинки. Фокус и размер текста не меняются. Применяется сразу.',
      en: 'Content sits on the background instead of inside boxes: on the card the "Details" panel becomes a line of facts under the description, section counters lose their plates, reviews lose frames and panels, and on episode tiles the still moves to the top across the full width with the name and caption below it (which makes the episode row a little taller); on the TorrServer path releases and files are separated by thin lines instead of cards. In the collection grid and the hub little changes: only the plate under a tile is removed, and it is visible only until the poster or still arrives, and on items without an image. Focus and text size stay as they are. Applied immediately.',
      uk: 'Вміст лежить прямо на тлі, а не в коробках: у картці панель «Докладно» стає рядком фактів під описом, лічильники розділів втрачають плашки, відгуки — рамки й підкладки, а в плиток серій кадр стає зверху на всю ширину, назва та підпис ідуть під нього (через це ряд серій трохи вищий); на шляху TorrServer роздачі та файли розділяються тонкими лініями замість карток. У сітці підбірки та в хабі змінюється небагато: знімається лише підкладка під плиткою, а її видно, доки не прийшов постер або кадр, і в карток без зображення. Фокус і розмір тексту не змінюються. Застосовується одразу.'
    },
    /* Фаза 3: масштаб интерфейса плагина.

       Оговорка про потолок. При «Размере интерфейса: крупнее» Lampa
       увеличивает карточку ряда дважды — кегль body ×1.05
       (vendor/lampa/app.min.js:31630-31634) и правило
       body.size--bigger .card{font-size:1.14em} поверх него
       (vendor/lampa/css/app.css:3525-3528), итого ×1.197 внутри карточки.
       Наш масштаб умножается на это сверху, и при настройке «Кадр над
       рядами» в значении «Крупный» (lumen_hero_size = 'large') произведение
       перестаёт помещаться в высоту экрана: подпись первого
       ряда уезжает за кромку. Поэтому масштаб карточек рядов главной
       ограничен сверху бюджетом высоты (rowScaleCap в src/30_css.js), и на
       этой одной комбинации «Крупнее» и «Ещё крупнее» дают ту же карточку,
       что «Обычный», — потолок 1.00 (замеры и все 36 клеток — в тесте
       «потолок масштаба карточки ряда» в test/css.test.mjs). До правки
       2026-09-23 (разбор композиции, п.1.5: кнопка «Ещё» ушла из шапки ряда
       и освободила .57em высоты) потолок был .96 и прихватывал ещё и
       «Обычный». Настройка
       названа в описании ЕЁ ЖЕ именем из этого словаря
       (lumen_hero_size_name/lumen_hero_size_large), а не «заставкой»:
       «Заставка из кадров» (lumen_ambient_name) — другой пункт, и по
       умолчанию он выключен; отослав туда, описание отправило бы искать
       объяснение там, где его нет. Имена сторожит тест «оговорка про
       потолок масштаба называет ту настройку, которая его и вызывает»
       (test/css.test.mjs). Остальные
       экраны плагина потолка не знают, и описание про это говорит ровно то
       же самое: молчать о том, что настройка местами упёрлась в потолок,
       значит выдавать ограничение за поломку. */
    lumen_scale_name: { ru: 'Масштаб интерфейса', en: 'Interface scale', uk: 'Масштаб інтерфейсу' },
    lumen_scale_descr: {
      ru: 'Размер текста и блоков на экранах плагина: карточка, главная, подборки. Применяется сразу. Одно исключение: если в самой Lampa выбран «Размер интерфейса: крупнее», она уже увеличила карточки рядов главной, и при настройке «Кадр над рядами» в значении «Крупный» наш масштаб там упирается в высоту экрана — «Обычный», «Крупнее» и «Ещё крупнее» дают одинаковые ряды, иначе подпись первого ряда не поместилась бы. При меньшем кадре и на других размерах интерфейса ограничения нет, и на остальных экранах плагина масштаб действует целиком.',
      en: 'The size of text and blocks on the plugin screens: card, home and collections. Applied immediately. One exception: if Lampa\'s own "Interface size" is set to larger, it has already enlarged the home row cards, and with "Hero over the rows" set to "Large" our scale there runs into the screen height — "Normal", "Larger" and "Largest" give identical rows, otherwise the first row caption would not fit. With a smaller frame and on the other interface sizes there is no cap, and on the other plugin screens the scale applies in full.',
      uk: 'Розмір тексту та блоків на екранах плагіна: картка, головна, підбірки. Застосовується одразу. Один виняток: якщо в самій Lampa вибрано «Розмір інтерфейсу: більше», вона вже збільшила картки рядів головної, і з налаштуванням «Кадр над рядами» у значенні «Великий» наш масштаб там упирається у висоту екрана — «Звичайний», «Більше» і «Ще більше» дають однакові ряди, інакше підпис першого ряду не помістився б. З меншим кадром і на інших розмірах інтерфейсу обмеження немає, а на решті екранів плагіна масштаб діє повністю.'
    },
    lumen_scale_small: { ru: 'Мельче', en: 'Smaller', uk: 'Дрібніше' },
    lumen_scale_normal: { ru: 'Обычный', en: 'Normal', uk: 'Звичайний' },
    lumen_scale_large: { ru: 'Крупнее', en: 'Larger', uk: 'Більше' },
    lumen_scale_huge: { ru: 'Ещё крупнее', en: 'Largest', uk: 'Ще більше' },
    lumen_card_fonts_name: { ru: 'Фирменные шрифты', en: 'Custom fonts', uk: 'Фірмові шрифти' },
    lumen_card_fonts_descr: {
      ru: 'Шрифты с Google Fonts. Требуется интернет. Выключите, если шрифты не грузятся.',
      en: 'Fonts from Google Fonts. Requires internet access.',
      uk: 'Шрифти з Google Fonts. Потрібен інтернет.'
    },
    /* Правка 2026-09-23: логотип названия в шапке карточки (renderLogo,
       src/85_header.js). Описание называет и цену — английский логотип
       вместо русского названия, — иначе непонятно, зачем такой выключатель
       вообще нужен. */
    lumen_card_logo_name: { ru: 'Логотип названия в карточке', en: 'Title logo on the card', uk: 'Логотип назви в картці' },
    lumen_card_logo_descr: {
      ru: 'Вместо набранного названия — логотип фильма, как в кадре главной. Если логотипа на языке интерфейса нет, берётся английский. Выключите, чтобы в карточке всегда было название текстом. Применяется сразу.',
      en: 'The film logo instead of the typed title, as in the home hero. If there is no logo in the interface language, the English one is used. Turn off to always see the title as text on the card. Applied immediately.',
      uk: 'Замість набраної назви — логотип фільму, як у кадрі головної. Якщо логотипа мовою інтерфейсу немає, береться англійський. Вимкніть, щоб у картці завжди була назва текстом. Застосовується одразу.'
    },
    lumen_card_progress_name: { ru: 'Показывать «Продолжить»', en: 'Show "Continue"', uk: 'Показувати «Продовжити»' },
    /* Task 30: одним переключателем гасятся три места сразу (строка прогресса
       в карточке, подпись кнопки «Смотреть» и надписи в карточках серий) —
       это и сказано, иначе выключатель выглядит уже, чем он есть. */
    lumen_card_progress_descr: {
      ru: 'Полоса с таймкодом и процентом в карточке того, что вы не досмотрели, подпись «Продолжить S2 E3» на кнопке «Смотреть» и отметки просмотра в карточках серий. Применяется сразу.',
      en: 'The bar with the timecode and percentage on a card you have not finished, the "Continue S2 E3" label on the Watch button and the watched marks on episode cards. Applied immediately.',
      uk: 'Смуга з таймкодом і відсотком у картці того, що ви не додивилися, підпис «Продовжити S2 E3» на кнопці «Дивитися» та позначки перегляду в картках серій. Застосовується одразу.'
    },
    /* Выбор гарнитуры. Имена шрифтов — собственные, во всех трёх языках
       пишутся одинаково, но идут через LC.STRINGS, как все строки
       интерфейса. Task 43: гарнитура одна на весь плагин — прежде за каждым
       из этих имён стояла ПАРА «текстовая + моноширинная», и описание
       обещало «текст и цифры», потому что у заголовков была своя. */
    lumen_card_font_name: { ru: 'Шрифт', en: 'Font', uk: 'Шрифт' },
    lumen_card_font_descr: {
      ru: 'Шрифт интерфейса: им набрано всё — заголовки, текст и цифры. Действует только при включённых фирменных шрифтах. Применяется сразу.',
      en: 'The interface font: headings, text and figures all use it. Works only with custom fonts on. Applied immediately.',
      uk: 'Шрифт інтерфейсу: ним набрано все — заголовки, текст і цифри. Діє лише з увімкненими фірмовими шрифтами. Застосовується одразу.'
    },
    lumen_card_font_golos: { ru: 'Golos Text', en: 'Golos Text', uk: 'Golos Text' },
    lumen_card_font_onest: { ru: 'Onest', en: 'Onest', uk: 'Onest' },
    lumen_card_font_manrope: { ru: 'Manrope', en: 'Manrope', uk: 'Manrope' },
    lumen_card_font_inter: { ru: 'Inter', en: 'Inter', uk: 'Inter' },
    lumen_card_font_plex: { ru: 'IBM Plex Sans', en: 'IBM Plex Sans', uk: 'IBM Plex Sans' },
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
    /* Task 40 (фаза 4): тумблер тяжёлых эффектов. Название говорит, что
       именно выключается, а описание перечисляет всё до единого — иначе с
       дивана не понять, куда делись частицы и наезд на кадр. */
    lumen_fx_heavy_name: { ru: 'Тяжёлые эффекты', en: 'Heavy effects', uk: 'Важкі ефекти' },
    lumen_fx_heavy_descr: {
      ru: 'Частицы, наезд на кадр, зум заставки, смена кадров в карточке, плавная смена кадра на главной и автотрейлер. На телевизоре выключены по умолчанию: они стоят кадров. Работают только при полных анимациях.',
      en: 'Particles, Ken Burns zoom, screensaver zoom, backdrop slideshow, the crossfade on the home screen and the auto trailer. Off by default on a TV: they cost frames. Work only with full animations.',
      uk: 'Частинки, наїзд на кадр, зум заставки, зміна кадрів у картці, плавна зміна кадру на головній та автотрейлер. На телевізорі вимкнені за замовчуванням: вони коштують кадрів. Працюють лише за повних анімацій.'
    },
    /* Task 31 (фаза 4): HUD отладки — FPS, долгие задачи, разрешение и
       режим анимаций в углу экрана телевизора, без adb. Нужен только для
       калибровки порогов автодетекта (LC.perf, src/68_perf.js) на реальном
       железе, поэтому и название честно называет его «Отладкой». */
    lumen_debug_hud_name: { ru: 'Отладка: показать FPS', en: 'Debug: show FPS', uk: 'Налагодження: показати FPS' },
    lumen_debug_hud_descr: {
      ru: 'Счётчик кадров, длинные задачи, разрешение и режим анимаций в углу экрана. Для проверки на телевизоре.',
      en: 'Frame counter, long tasks, resolution and animation mode in the screen corner. For testing on a TV.',
      uk: 'Лічильник кадрів, довгі задачі, роздільність та режим анімацій у кутку екрана. Для перевірки на телевізорі.'
    },
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
    lumen_card_slideshow_name: { ru: 'Слайдшоу кадров', en: 'Backdrop slideshow', uk: 'Слайдшоу кадрів' },
    /* Task 30: описания фона карточки. Оба пункта до финала фазы 3 стояли без
       подсказок — название говорит, что это, но не что будет, если выключить. */
    lumen_card_slideshow_descr: {
      ru: 'Кадры из фильма за текстом карточки сменяют друг друга. Выключите — останется один, первый кадр. Слайдшоу встаёт на паузу под трейлером и на карточке, оставленной позади. Применяется сразу.',
      en: 'The film stills behind the card text replace one another. Turn it off and only the first still stays. The slideshow pauses under a trailer and on a card left behind. Applied immediately.',
      uk: 'Кадри з фільму за текстом картки змінюють один одного. Вимкніть — залишиться один, перший кадр. Слайдшоу стає на паузу під трейлером і на картці, залишеній позаду. Застосовується одразу.'
    },
    lumen_card_slide_interval: { ru: 'Интервал смены кадров', en: 'Frame interval', uk: 'Інтервал зміни кадрів' },
    lumen_card_slide_interval_descr: {
      ru: 'Сколько секунд держится на экране один кадр фона карточки — и кадр главной, если там выбрано «Несколько кадров». В карточке действует только при включённом слайдшоу. Применяется сразу.',
      en: 'How many seconds a single card background still stays on screen — and the home hero still when it is set to "Several frames". On the card it works only with the slideshow on. Applied immediately.',
      uk: 'Скільки секунд тримається на екрані один кадр тла картки — і кадр головної, якщо там обрано «Кілька кадрів». У картці діє лише з увімкненим слайдшоу. Застосовується одразу.'
    },
    lumen_card_seconds: { ru: 'с', en: 's', uk: 'с' },
    lumen_card_menus: { ru: 'Оформление меню и окон', en: 'Menus and dialogs style', uk: 'Оформлення меню і вікон' },
    /* Task 30: что именно попадает под каждое из трёх значений. Разметку и
       тексты самих окон плагин не трогает — только стиль (src/64_menus.js). */
    lumen_card_menus_descr: {
      ru: '«Только путь до плеера» — окна выбора озвучки, качества, серии и раздачи. «Все меню и окна» — ещё и прочие списки и диалоги Lampa. Меняется только вид: пункты, порядок и поведение окон остаются штатными. Применяется сразу.',
      en: '"Player path only" covers the dialogs for voice-over, quality, episode and torrent choice. "All menus and dialogs" adds the rest of Lampa lists and dialogs. Only the look changes: items, order and behaviour stay stock. Applied immediately.',
      uk: '«Лише шлях до плеєра» — вікна вибору озвучення, якості, серії та роздачі. «Усі меню і вікна» — ще й інші списки та діалоги Lampa. Змінюється лише вигляд: пункти, порядок і поведінка вікон лишаються штатними. Застосовується одразу.'
    },
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
       стоит дороже, чем выигрыш — та же логика экономии, что у lumen_motion).

       Task 61 (фаза 5): в названии добавлено «карточки». Пунктов про трейлер
       в разделе два, и этот идёт раньше по списку (группа «Фон карточки»
       против «Главной»); пользователь, искавший выключатель автотрейлера в
       кадре главной, до второго не дошёл (интервью 2026-09-21). */
    lumen_card_trailer: { ru: 'Трейлер в фоне карточки', en: 'Background trailer on the card', uk: 'Трейлер у фоні картки' },
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
    lumen_card_reviews_src: { ru: 'КИНОПОИСК', en: 'KINOPOISK', uk: 'КІНОПОШУК' },
    lumen_card_review_good: { ru: 'ПОЗИТИВНЫЙ', en: 'POSITIVE', uk: 'ПОЗИТИВНИЙ' },
    lumen_card_review_mid: { ru: 'НЕЙТРАЛЬНЫЙ', en: 'NEUTRAL', uk: 'НЕЙТРАЛЬНИЙ' },
    lumen_card_review_bad: { ru: 'НЕГАТИВНЫЙ', en: 'NEGATIVE', uk: 'НЕГАТИВНИЙ' },
    lumen_card_review_useful: { ru: 'полезно', en: 'helpful', uk: 'корисно' },
    /* Task 28 (фаза 3): отзывы без спойлеров. Режим показа — настройка
       lumen_reviews_mode, переключатель того же режима стоит в шапке ряда
       (одно значение, две точки входа). */
    lumen_reviews_mode_name: { ru: 'Текст отзывов в ряду', en: 'Review text in the row', uk: 'Текст відгуків у ряду' },
    lumen_reviews_mode_descr: {
      ru: '«Только заголовки» — в ряду видны автор, оценка и заголовок, а текст открывается по OK: случайный спойлер не попадётся на глаза. «С выдержкой» показывает начало отзыва прямо в ряду. Спойлерные куски скрыты в обоих режимах и раскрываются кнопкой в окне отзыва. Применяется сразу.',
      en: '"Headlines only" shows the author, tone and title in the row and opens the text on OK, so a stray spoiler never catches your eye. "With excerpt" shows the beginning of the review in the row. Spoiler fragments stay hidden in both modes and are revealed by a button in the review window. Applied immediately.',
      uk: '«Лише заголовки» — у ряду видно автора, оцінку і заголовок, а текст відкривається по OK: випадковий спойлер не трапиться на очі. «З уривком» показує початок відгуку просто в ряду. Спойлерні шматки приховані в обох режимах і розкриваються кнопкою у вікні відгуку. Застосовується одразу.'
    },
    lumen_reviews_mode_headlines: { ru: 'Только заголовки', en: 'Headlines only', uk: 'Лише заголовки' },
    lumen_reviews_mode_full: { ru: 'С выдержкой', en: 'With excerpt', uk: 'З уривком' },
    /* Подпись переключателя в шапке ряда отзывов: это действие, а не
       состояние, — «Показывать текст» с подсветкой, когда он включён. */
    lumen_reviews_mode_toggle: { ru: 'Показывать текст', en: 'Show text', uk: 'Показувати текст' },
    /* Метка на карточке отзыва, в котором нашёлся скрытый кусок. */
    lumen_reviews_spoiler: { ru: 'ЕСТЬ СПОЙЛЕР', en: 'HAS SPOILER', uk: 'Є СПОЙЛЕР' },
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
      ru: 'Адрес JSON-каталога. Пусто — каталог плагина из интернета, он обновляется сам (кэш 12 ч). Без сети работает встроенный список.',
      en: 'JSON catalog address. Empty — the plugin catalog from the internet, updated automatically (12 h cache). Offline the built-in list is used.',
      uk: 'Адреса JSON-каталогу. Порожньо — каталог плагіна з інтернету, оновлюється сам (кеш 12 год). Без мережі працює вбудований список.'
    },

    /* Task 20 (фаза 2): подсказка «Ключ API не задан» — переключатель рядом
       с полем ключа. Саму подсказку можно убрать кнопкой «Скрыть» на экране
       (карточка и сетка подборки Кинопоиска), вернуть — отсюда. */
    lumen_kp_hint_name: {
      ru: 'Подсказка про ключ',
      en: 'API key hint',
      uk: 'Підказка про ключ'
    },
    lumen_kp_hint_descr: {
      ru: 'Напоминание «Ключ API не задан» в карточке и в подборках Кинопоиска. Его можно убрать кнопкой «Скрыть» прямо на экране.',
      en: 'The "API key is not set" reminder in the card and in Kinopoisk collections. It can also be dismissed with the "Hide" button on screen.',
      uk: 'Нагадування «Ключ API не задано» у картці та в підбірках Кінопошуку. Його можна прибрати кнопкою «Сховати» просто на екрані.'
    },
    /* Подпись кнопки, которая убирает подсказку навсегда (до включения
       переключателя выше). */
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
      ru: 'Убирает с карточки ряды «Метаданные» (Темп, Страх, Экшн…) и «Настроения» (проценты). Это блоки самой Lampa, не плагина: данные для них приходят от аккаунта CUB и только для фильмов, «Настроения» — ещё и только при языке интерфейса ru/uk/be. Ничего не удаляется: ряд просто не строится на экране, выключите — вернётся. Применяется при следующем открытии карточки.',
      en: 'Removes the "Metadata" (Pace, Fear, Action…) and "Moods" (percentages) rows from the card. These are Lampa own blocks, not the plugin: their data comes from the CUB account and only for movies, and "Moods" only with the ru/uk/be interface language. Nothing is deleted: the row simply is not put on screen, turn it off and it comes back. Applied the next time you open a card.',
      uk: 'Прибирає з картки ряди «Метадані» (Темп, Страх, Екшн…) і «Настрої» (відсотки). Це блоки самої Lampa, а не плагіна: дані для них приходять від акаунта CUB і лише для фільмів, «Настрої» — ще й лише за мови інтерфейсу ru/uk/be. Нічого не видаляється: ряд просто не будується на екрані, вимкніть — повернеться. Застосовується при наступному відкритті картки.'
    },

    /* Task 15/20 (фаза 2): группа настроек главной. Task 57 (фаза 5)
       разделил её надвое: всё про ряды подборок ушло в lumen_group_rows —
       десятым пунктом группа перестала помещаться на экран ТВ целиком
       (предел в девять строк держит тест в test/prefs.test.mjs). */
    lumen_group_home: {
      ru: 'Главная',
      en: 'Home screen',
      uk: 'Головна'
    },
    lumen_group_rows: {
      ru: 'Ряды подборок',
      en: 'Collection rows',
      uk: 'Ряди підбірок'
    },
    /* Task 19/20: чипы профилей настроения под текстом героя на главной. */
    lumen_moods_name: {
      ru: 'Профили настроения',
      en: 'Mood profiles',
      uk: 'Профілі настрою'
    },
    lumen_moods_descr: {
      ru: 'Строка быстрых подборок под описанием на главной: «Вечер пятницы», «Семейный просмотр», «Страшное на ночь», «Есть 90 минут».',
      en: 'A row of quick picks under the hero text: "Friday night", "Family time", "Scary at night", "90 minutes to spare".',
      uk: 'Рядок швидких підбірок під описом на головній: «Вечір п\'ятниці», «Сімейний перегляд», «Страшне на ніч», «Є 90 хвилин».'
    },
    /* Task 20: кнопка-параметр — экран выбора подборок для главной. */
    lumen_home_rows_name: {
      ru: 'Какие ряды показывать',
      en: 'Which rows to show',
      uk: 'Які ряди показувати'
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
    /* Task 30: цена каждого ряда — отдельный запрос к TMDB при построении
       главной, и на слабом телевизоре это заметно (src/44_rows.js). */
    lumen_rows_limit_descr: {
      ru: 'Сколько рядов подборок строится на главной. Каждый ряд — отдельный запрос к каталогу, поэтому на слабом телевизоре меньшее число заметно ускоряет появление главной. Персональные ряды в это число не входят.',
      en: 'How many collection rows the home screen builds. Each row is a separate catalog request, so on a weak TV a smaller number noticeably speeds the home screen up. Personal rows are not counted here.',
      uk: 'Скільки рядів підбірок будується на головній. Кожен ряд — окремий запит до каталогу, тому на слабкому телевізорі менше число помітно пришвидшує появу головної. Персональні ряди в це число не входять.'
    },
    /* Суффикс для значений select lumen_rows_limit: '10 рядов', '15 рядов', '25 рядов'. */
    lumen_rows_limit_suffix: {
      ru: 'рядов',
      en: 'rows',
      uk: 'рядів'
    },
    /* Task 57 (фаза 5): дедупликация фильмов между рядами главной. */
    lumen_rows_dedupe_name: {
      ru: 'Не повторять фильмы в рядах',
      en: 'No repeats across rows',
      uk: 'Не повторювати фільми в рядах'
    },
    lumen_rows_dedupe_descr: {
      ru: 'Фильм показывается в первом ряду, где встретился, а из рядов ниже выпадает — чтобы одна и та же новинка не стояла и в «Сейчас смотрят», и в «В тренде». Ряд, который от этого укоротился и в котором осталось меньше четырёх карточек — или меньше половины прежнего, и они не заполняют ширину экрана, — не показывается вовсе; ряды, выбранные вами вручную, и личные ряды остаются на месте.',
      en: 'A movie is shown in the first row it appears in and drops out of the rows below, so the same new release does not sit in "Now playing" and "Trending" at once. A row this shortens is hidden if it is left with fewer than four movies — or with less than half of them and not enough to fill the screen; rows you picked yourself and personal rows always stay.',
      uk: 'Фільм показується в першому ряду, де трапився, а з рядів нижче зникає — щоб та сама новинка не стояла і в «Зараз дивляться», і в «У тренді». Ряд, який від цього вкоротився і в якому лишилося менше чотирьох карток — або менше половини колишніх, і вони не заповнюють ширину екрана, — не показується зовсім; ряди, обрані вами вручну, і особисті ряди лишаються на місці.'
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
    /* Правка пользователя 2026-09-17 (п.2): размер героя на главной. Высота
       кадра задана долями ЭКРАНА и от его сторон не зависит: в старте
       66.67 / 56 / 45 % высоты (HERO_VH в src/30_css.js), а после подъёма
       рядов нижняя кромка кадра стоит на 50 / 42 / 34 % (ROWS_TOP_VH там
       же). «Выключен» — героя нет вовсе, ряды занимают экран
       целиком. Правка 2026-09-17 (второй круг): чипы настроения переехали в
       собственный узел и остаются на главной при любом размере, включая
       выключенный, — подсказка об их пропаже больше не нужна.
       Правка 2026-09-23 (долг Minor из фикс-раунда фазы 3,
       docs/plans/2026-09-15-lumen-phase3-features.md:251): «Выключен» молча
       гасил и переход «постер → кадр» — прямоугольник и постер фокусной
       карточки слою перехода даёт герой (LC.hero.lastFocus,
       src/67_transition.js open()), и без героя их брать неоткуда. Описание
       теперь говорит это прямо, называя переход его собственным именем из
       этого словаря (lumen_transition_name — «Переход от постера»), чтобы
       было ясно, какой пункт перестаёт работать. */
    lumen_hero_size_name: { ru: 'Кадр над рядами', en: 'Hero over the rows', uk: 'Кадр над рядами' },
    lumen_hero_size_descr: {
      ru: 'Какую часть экрана занимает большой кадр с описанием. «Выключен» — ряды на весь экран, чипы настроения остаются, но вместе с кадром отключается и «Переход от постера»: без кадра ему неоткуда взять постер. Применяется сразу.',
      en: 'How much of the screen the large hero frame takes. "Off" gives the rows the whole screen and keeps the mood chips, but also turns off "Poster transition": without the hero it has no poster to start from. Applied immediately.',
      uk: 'Яку частину екрана займає великий кадр з описом. «Вимкнено» — ряди на весь екран, чипи настрою залишаються, але разом із кадром вимикається і «Перехід від постера»: без кадру йому нізвідки взяти постер. Застосовується одразу.'
    },
    lumen_hero_size_large: { ru: 'Крупный', en: 'Large', uk: 'Великий' },
    lumen_hero_size_medium: { ru: 'Средний', en: 'Medium', uk: 'Середній' },
    lumen_hero_size_compact: { ru: 'Компактный', en: 'Compact', uk: 'Компактний' },
    lumen_hero_size_off: { ru: 'Выключен', en: 'Off', uk: 'Вимкнено' },
    /* Task 28 (фаза 3): автотрейлер в кадре главной.

       Task 61 (фаза 5): название и описание переписаны под жалобу «заебись,
       но надо отключаемым» (интервью 2026-09-21). Выключатель существовал с
       Task 28 — его не нашли, поэтому:
         · «Автотрейлер» вместо «Трейлер» — человек ищет не трейлер, а то,
           что включается БЕЗ СПРОСА; заодно название перестало быть похожим
           на «Трейлер в фоне карточки» из группы выше;
         · описание начинается с того, что происходит, и сразу говорит про
           выключение — с дивана читают первую строку, а не третью;
         · «8 секунд» — TRAILER_DELAY в src/48_hero.js:57 (равенство держит
           test/prefs.test.mjs, он читает константу из исходника).
       Условия запуска перечислены по trailerAllowed (src/48_hero.js:305-311):
       настройка, полные анимации, тумблер тяжёлых эффектов и режим трейлера
       карточки не 'off'. Тяжёлых эффектов в прежнем тексте не было — а без
       них ролика нет, и на телевизоре этот тумблер выключен по умолчанию
       (fxHeavyDefault, src/81_prefs.js). «Переход на другую карточку», а не
       «любое движение»: возврат фокуса на ту же карточку ролик не снимает —
       гард state.trailerCard !== card (src/48_hero.js:1302). */
    /* Правка 2026-09-23, просьба пользователя: «постеры меняются в карточке,
       но не на главной, там всегда статика… может сделай тумблер, типо либо
       несколько постеров или постер и трейлер». Название — вопрос, на
       который отвечают значения: с дивана «Кадр и трейлер / Несколько
       кадров» читается без описания. Описание говорит, чем отличается каждый
       вариант и когда смены нет (фокус в рядах, анимации выключены). */
    lumen_hero_media_name: { ru: 'Что показывает кадр главной', en: 'What the home hero shows', uk: 'Що показує кадр головної' },
    lumen_hero_media_trailer: { ru: 'Кадр и трейлер', en: 'Frame and trailer', uk: 'Кадр і трейлер' },
    lumen_hero_media_frames: { ru: 'Несколько кадров', en: 'Several frames', uk: 'Кілька кадрів' },
    lumen_hero_media_descr: {
      ru: '«Кадр и трейлер» — один кадр фильма; если фокус постоял на карточке, его сменяет беззвучный трейлер (пункт «Автотрейлер в кадре главной»). «Несколько кадров» — кадры фильма сменяют друг друга, как в карточке, с тем же «Интервалом смены кадров»; трейлер не запускается. Пока фокус в рядах ниже первого, кадры не меняются; с выключенными анимациями кадр один. Применяется сразу.',
      en: '"Frame and trailer" shows one still of the film; if focus rests on a card, a muted trailer replaces it (see "Auto-trailer in the home hero"). "Several frames" cycles through the film’s stills like the card does, at the same "Frame interval"; no trailer is started. While focus is in the rows below the first one the stills do not change; with animations off there is a single still. Applied immediately.',
      uk: '«Кадр і трейлер» — один кадр фільму; якщо фокус постояв на картці, його змінює беззвучний трейлер (пункт «Автотрейлер у кадрі головної»). «Кілька кадрів» — кадри фільму змінюють один одного, як у картці, з тим самим «Інтервалом зміни кадрів»; трейлер не запускається. Поки фокус у рядах нижче першого, кадри не змінюються; з вимкненими анімаціями кадр один. Застосовується одразу.'
    },
    lumen_hero_trailer_name: { ru: 'Автотрейлер в кадре главной', en: 'Auto-trailer in the home hero', uk: 'Автотрейлер у кадрі головної' },
    lumen_hero_trailer_descr: {
      ru: 'Кадр над рядами сам сменяется беззвучным трейлером с YouTube, если фокус постоял на карточке 8 секунд. Выключите, если это мешает. Переход на другую карточку ролик снимает, при листании он не запускается вовсе. Нужны полные анимации, включённые тяжёлые эффекты и не выключенный «Трейлер в фоне карточки». Применяется сразу.',
      en: 'The hero frame above the rows turns into a muted YouTube trailer by itself once focus has rested on a card for 8 seconds. Turn it off if it gets in the way. Moving to another card removes the clip, and it never starts while you are browsing. Needs full animations, heavy effects on and "Background trailer on the card" not set to Off. Applied immediately.',
      uk: 'Кадр над рядами сам змінюється беззвучним трейлером з YouTube, якщо фокус постояв на картці 8 секунд. Вимкніть, якщо це заважає. Перехід на іншу картку ролик знімає, під час гортання він не запускається взагалі. Потрібні повні анімації, увімкнені важкі ефекти і не вимкнений «Трейлер у фоні картки». Застосовується одразу.'
    },
    /* Task 71 (фаза 6): логотип названия в кадре главной. Название пункта
       не «логотип фильма», а «логотип названия»: с дивана человек видит
       именно надпись — фирменно набранное название вместо обычного
       заголовка. Описание говорит, что бывает, когда логотипа нет или он не
       загрузился (остаётся обычный заголовок), — иначе пункт выглядел бы
       сломанным на половине фильмов. */
    lumen_hero_logo_name: { ru: 'Логотип названия в кадре', en: 'Title logo in the hero', uk: 'Логотип назви в кадрі' },
    lumen_hero_logo_descr: {
      ru: 'Название фильма в кадре над рядами показывается его фирменной надписью с TMDB, а не обычным заголовком. Надпись появляется, только когда картинка загрузилась: пока её нет — и если её нет вовсе — стоит обычный заголовок. Выключите, чтобы название всегда было набрано текстом. Применяется сразу.',
      en: 'The title in the hero above the rows is shown as the film’s own logo from TMDB instead of plain text. The logo appears only once its image has loaded: until then — and if there is none — the plain title stays. Turn it off to always keep the title as text. Applied immediately.',
      uk: 'Назва фільму в кадрі над рядами показується його фірмовим написом з TMDB, а не звичайним заголовком. Напис з’являється лише тоді, коли картинка завантажилась: доки її немає — і якщо її немає взагалі — лишається звичайний заголовок. Вимкніть, щоб назва завжди була набрана текстом. Застосовується одразу.'
    },
    /* Task 62a (фаза 5): видов метки стало три. Название осталось прежним —
       настройка про то же самое, — а описание теперь объясняет выбор между
       плашкой и подписью: с дивана «На постере / В подписи» без пояснения
       читается как загадка. */
    lumen_badges_name: { ru: 'Метки на постерах', en: 'Poster badges', uk: 'Мітки на постерах' },
    lumen_badges_descr: {
      ru: '«Скоро», «Новинка», процент просмотра и новые серии в рядах главной и подборок. «На постере» — плашкой поверх обложки; «В подписи» — строкой под ней, рядом с годом и рейтингом: обложка остаётся чистой. Применяется сразу.',
      en: '"Soon", "New", the watched percentage and new episodes in home and collection rows. "On the poster" draws a plate over the artwork; "In the caption" puts the same words under it, next to the year and the rating, leaving the artwork clean. Applied immediately.',
      uk: '«Скоро», «Новинка», відсоток перегляду та нові серії в рядах головної та підбірок. «На постері» — плашкою поверх обкладинки; «У підписі» — рядком під нею, поряд із роком і рейтингом: обкладинка лишається чистою. Застосовується одразу.'
    },
    /* Постеры карточек (настройка lumen_posters). Описание обязано назвать
       цену прямо — человеку с телевизором это важнее красоты формулировки.
       Числа сняты живыми запросами 2026-09-23 (прокси Lampa, первые
       страницы подборок главной по умолчанию): «Без надписей» — запрос на
       карточку, у ряда из одного списка 20, у «Netflix: Комедии» 39, у
       «Звёздных войн» 33, на весь набор главной 152 без подборки
       Кинопоиска (у неё без ключа нет карточек, с ключом — до 20). У
       «Английских» — запрос на половину подборки (фильмы, сериалы), не на
       ряд (originalPosters, src/43_sources.js). Кэш на месяц держится на
       настройке Lampa «Кэширование запросов» (request_caching,
       vendor/lampa/app.min.js:33533) — выключена она, кэша нет.
       Ф3 (ревью фикс-раундов, решение координатора): режим 'original'
       называется «Английские» — он даёт английскую обложку, а не обложку
       на языке оригинала (у аниме и дорам это разные вещи). Ключ значения
       не менялся: он уже сохранён у пользователя, меняется только
       подпись. */
    lumen_posters_name: { ru: 'Постеры карточек', en: 'Card posters', uk: 'Постери карток' },
    lumen_posters_descr: {
      ru: 'Откуда берётся обложка в рядах главной и в сетках подборок. «Как в Lampa» — та, что приходит с карточкой: ни одного лишнего запроса. «Английские» — тот же список, запрошенный на английском: это английская обложка, а не обложка на языке оригинала — у аниме и дорам тоже английская, если она есть на TMDB; цена — запрос на каждую половину подборки, фильмы и сериалы отдельно, то есть один-два на ряд и на страницу сетки; подборки Кинопоиска остаются с обложками Lampa. «Без надписей» — постер, на котором нет текста ни на каком языке: по запросу на каждую карточку — двадцать на ряд из одного списка, до сорока у рядов с фильмами и сериалами, около 150 на набор главной по умолчанию. Эти ответы кладутся в кэш на месяц, если в настройках Lampa (раздел «Остальное») включено «Кэширование запросов»: тогда платят только первое открытие и новые фильмы, а выключено — платит каждое открытие. Обложка непривычной пропорции не подставляется — остаётся та, что в Lampa. Применяется сразу: главная собирается заново.',
      en: 'Where the artwork in home rows and collection grids comes from. "As in Lampa" is the one that arrives with the card: not a single extra request. "English" is the same list requested in English: an English poster, not one in the original language — anime and K-dramas get the English one too, when TMDB has it; the cost is one request per half of a collection, movies and series separately, that is one or two per row and per grid page; Kinopoisk collections keep the Lampa artwork. "No lettering" is a poster with no text in any language: one request per card — twenty per single-list row, up to forty for rows with both movies and series, about 150 for the default home set. These answers are cached for a month if "Request Caching" is on in Lampa settings (the "Other" section): then only the first opening and new films pay; if it is off, every opening pays. Artwork with an unusual aspect ratio is not substituted — the Lampa one stays. Applied immediately: the home screen is rebuilt.',
      uk: 'Звідки береться обкладинка в рядах головної та в сітках підбірок. «Як у Lampa» — та, що приходить із карткою: жодного зайвого запиту. «Англійські» — той самий список, запитаний англійською: це англійська обкладинка, а не обкладинка мовою оригіналу — в аніме й дорам теж англійська, якщо вона є на TMDB; ціна — запит на кожну половину підбірки, фільми й серіали окремо, тобто один-два на ряд і на сторінку сітки; підбірки Кінопошуку лишаються з обкладинками Lampa. «Без написів» — постер, на якому немає тексту жодною мовою: по запиту на кожну картку — двадцять на ряд з одного списку, до сорока в рядах із фільмами й серіалами, близько 150 на набір головної за замовчуванням. Ці відповіді кладуться в кеш на місяць, якщо в налаштуваннях Lampa (розділ «Інше») увімкнено «Кешування запитів»: тоді платять лише перше відкриття та нові фільми, а вимкнено — платить кожне відкриття. Обкладинка незвичної пропорції не підставляється — лишається та, що в Lampa. Застосовується одразу: головна збирається наново.'
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
      ru: 'Удержание OK на постере открывает штатное меню Lampa, а плагин дописывает в него «Трейлер», «Похожие», «Вся франшиза», отметку просмотра и «Скрыть из рекомендаций». Обычное нажатие по-прежнему открывает карточку. Применяется сразу.',
      en: 'Holding OK on a poster opens the stock Lampa menu, and the plugin appends "Trailer", "Similar", "Whole franchise", the watched mark and "Hide from recommendations". A normal press still opens the card. Applied immediately.',
      uk: 'Утримання OK на постері відкриває штатне меню Lampa, а плагін дописує до нього «Трейлер», «Схожі», «Вся франшиза», позначку перегляду та «Сховати з рекомендацій». Звичайне натискання, як і раніше, відкриває картку. Застосовується одразу.'
    },
    /* Task 27 (фаза 3): мини-карта рядов и ускорители навигации. */
    lumen_minimap_name: { ru: 'Мини-карта рядов', en: 'Rows minimap', uk: 'Міні-карта рядів' },
    lumen_minimap_descr: {
      ru: 'Удержание «вверх» или «вниз» на главной показывает справа список рядов с подсветкой того, в котором вы сейчас. Нажатия не перехватывает. Применяется сразу.',
      en: 'Holding "up" or "down" on the home screen shows a list of rows on the right with the current one highlighted. It never intercepts key presses. Applied immediately.',
      uk: 'Утримання «вгору» або «вниз» на головній показує праворуч список рядів із підсвіткою того, у якому ви зараз. Натискання не перехоплює. Застосовується одразу.'
    },
    lumen_fastscroll_name: { ru: 'Быстрое листание', en: 'Fast scrolling', uk: 'Швидке гортання' },
    lumen_fastscroll_descr: {
      ru: 'Удержание «влево» или «вправо» разгоняет листание ряда втрое, а кнопки каналов на пульте прыгают сразу на десять карточек. Позиция в ряду показывается внизу экрана. Применяется сразу.',
      en: 'Holding "left" or "right" scrolls a row three times faster, and the channel buttons on the remote jump ten cards at once. The position in the row is shown at the bottom. Applied immediately.',
      uk: 'Утримання «вліво» або «вправо» пришвидшує гортання ряду втричі, а кнопки каналів на пульті стрибають одразу на десять карток. Позиція в ряду показується внизу екрана. Застосовується одразу.'
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
    if (name === 'lumen_enabled') { LC.applyEnabledPref(); return true; }
    /* Task 35: подкраска фона от постера живёт в своём <style> и гаснет при
       полностью выключенном движении. Смена режима таблицу стилей не
       пересобирает, поэтому узел надо снять (или вернуть) отдельной строкой —
       иначе фон остался бы подкрашенным до следующего события. */
    if (name === 'lumen_motion') {
      LC.applyMotionMode();
      try { if (LC.accent && LC.accent.repaint) LC.accent.repaint(); } catch (eAccentMotion) { warn('accent repaint failed', eAccentMotion); }
      return true;
    }
    /* Task 40 (фаза 4): тумблер тяжёлых эффектов. Применяется двумя точками.
       LC.applyMotionMode переставляет класс lumen-fx-heavy на body (от него
       зависят Ken Burns и зум заставки), перечитывает автотрейлер героя и
       пересчитывает слой частиц. Слайдшоу кадров карточки живёт своим
       контроллером и класс не читает — его гасит и возвращает
       LC.applySlideshowPref (его enabled() спрашивает LC.fxHeavy). */
    if (name === 'lumen_fx_heavy') {
      LC.applyMotionMode();
      LC.applySlideshowPref();
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
    if (name === 'lumen_slideshow' || name === 'lumen_slide_interval') { LC.applySlideshowPref(); return true; }
    if (name === 'lumen_menus') { LC.applyMenusPref(); return true; }
    if (name === 'lumen_torrents') { LC.applyTorrentsPref(); return true; }
    if (name === 'lumen_trailer') { LC.applyTrailerPref(); return true; }
    /* Правка пользователя 2026-09-16 (п.6): гарнитура меняется на лету, как
       акцент: подменяется <link> на Google Fonts (адрес зависит от пары) и
       пересобирается CSS — стеки font-family зашиты в текст стилей. Имя без
       префикса PLUGIN, поэтому ветка стоит здесь, до проверки префикса. */
    if (name === 'lumen_font') { LC.injectFonts(); LC.injectCss(); return true; }
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
    if (name === 'lumen_theme' || name === 'lumen_solid' || name === 'lumen_scale' ||
        name === 'lumen_accent_scope' || name === 'lumen_flat') { LC.injectCss(); return true; }
    /* A6: «Скрывать блоки анализа Lampa» читается в момент ПОСТРОЕНИЯ
       карточки: ряды Lampa не создаются вовсе (src/90_runtime.js,
       dropMetaData). Ни прятать их правилом, ни снимать узел со сцены
       нельзя — оба пути ломают навигацию, разбор и замеры там же. На уже
       открытом экране применять нечего, поэтому ветка пустая; своя она
       потому, что иначе имя ушло бы дальше как чужое (как у
       lumen_transition). */
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
    /* Task 28 (фаза 3): режим показа отзывов меняется и в настройках, и
       переключателем в шапке ряда — обе точки пишут одно значение, и обе
       приходят сюда: ряд открытой карточки перерисовывается по той же
       дороге, что при смене ключа API. */
    if (name === 'lumen_reviews' || name === 'lumen_kp_key' || name === 'lumen_reviews_mode') { LC.applyReviewsPref(); return true; }
    /* Task 20: подсказка «Ключ API не задан» — перерисовать ряд отзывов
       открытой карточки (там же, где её рисует LC.reviews) и снять/вернуть
       подсказку в открытой сетке подборки Кинопоиска. */
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
    /* Правка 2026-09-23: что показывает кадр главной. «Несколько кадров»
       снимает ролик и сразу заводит смену кадров по уже загруженным деталям,
       «Кадр и трейлер» снимает смену кадров (src/48_hero.js, applyMedia). */
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
       нет вовсе, включили любую — они возвращаются (LC.applyNavPref). */
    if (name === 'lumen_minimap' || name === 'lumen_fastscroll') {
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
    /* Task 74: источник постера меняет не набор карточек, а их обложки, но
       применяется тем же способом — ряды собираются заново. Иначе человек,
       который выбирает режим ради сравнения на своём экране, увидел бы
       разницу только после выхода с главной и возврата, то есть сравнивал
       бы по памяти. */
    if (name === 'lumen_hide_watched' || name === 'lumen_rows_limit' || name === 'lumen_home_rows' ||
        name === 'lumen_rows_dedupe' || name === 'lumen_posters') {
      try { if (LC.applyRowsPref) LC.applyRowsPref(); } catch (eRows) {}
      return true;
    }
    /* Task 16 (фаза 2): персональные ряды включены/выключены —
       перерегистрируем ряды (unregister снимает старые, register строит новые). */
    if (name === 'lumen_personal_rows') {
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
    /* Task 29 (фаза 3): переход «постер → кадр» читается в момент открытия
       карточки (src/67_transition.js), поэтому применять на лету нечего —
       ни стилей, ни узлов он на экране не держит. Ветка нужна, чтобы имя без
       префикса lumen_card_ не ушло дальше как чужое. */
    if (name === 'lumen_transition') return true;
    /* Task 62b (фаза 5): кнопки готового стиля своего значения не хранят, и
       применять при записи им нечего — работу делает LC.applyPresetChanges
       сразу после записей (applyPreset ниже). Ветка нужна ради контракта
       «у каждого пункта раздела своя ветка» (его держит тест): до общего
       фильтра по префиксу эти имена и так не дошли бы — PLUGIN это
       'lumen_card', а 'lumen_preset_appletv'.indexOf('lumen_card_') !== 0,
       то есть фильтр вернул бы false, а не пересборку CSS (поправка
       ревью, М1). */
    if (name === 'lumen_preset_appletv' || name === 'lumen_preset_lumen') return true;
    /* Task 23 (фаза 3): фильтр «не смотрел» читается при входе в рулетку
       (src/56_roulette.js), поэтому применять на лету нечего — на открытом
       экране его состоянием управляет чип. Ветка нужна, чтобы имя не ушло
       дальше как чужое. */
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
  /* Multi-select в SettingsApi нет, поэтому пункт «Какие ряды показывать» */
  /* — параметр type:'button': Lampa зовёт его onChange по нажатию (без    */
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

      var items = [];
      var lastGroup = null;
      for (var i = 0; i < choices.length; i++) {
        var c = choices[i];
        /* Отмеченные идут первыми (LC.rows.rowChoices), и разделять их по
           группам незачем — группы начинаются там, где пошли неотмеченные. */
        if (!c.checked && c.group !== lastGroup) {
          lastGroup = c.group;
          items.push({ title: groupTitle[c.group] || c.group, separator: true });
        }
        items.push({ title: c.title, lumen_id: c.id, checkbox: true, checked: c.checked });
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
  /* Task 62b (фаза 5): готовый стиль.                                     */
  /*                                                                        */
  /* Кнопка выставляет НАБОР ЗНАЧЕНИЙ существующих пунктов — каждое своим   */
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
  /* Пишутся только РАЗЛИЧИЯ: повторное нажатие тогда ничего не делает, а   */
  /* список изменённого есть что показать в подтверждении. Булево значение  */
  /* пишется строкой, как хранит его сама Lampa ('true'/'false'): JS-false  */
  /* она в localStorage запишет, но до конца сессии будет отдавать из       */
  /* памяти сам JS-false, а его LC.pref не отличит от «значения нет».       */
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
     после нашей записи сама не обновится — у type:'button' Lampa зовёт
     только onChange, без update$3 (app.min.js:47543-47548). Публичный
     Lampa.Params.update(elem) делает ровно это: перечитывает значение из
     Storage и пишет его в .settings-param__value (app.min.js:47640-47678,
     экспорт Params на :47957-47967 и :55954). Второй и третий аргументы
     нужны только ветке data-children, которой у наших пунктов нет.
     Раздел закрыт — узла не найдётся, и функция промолчит. */
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
        written.push(key);
        refreshParamRow(key);
        var entry = LC.prefs.find(key);
        if (entry) changed.push(LC.lang(entry.label));
      }
      /* Одно применение на весь набор вместо ветки на каждую запись. */
      if (written.length && LC.applyPresetChanges) LC.applyPresetChanges(written);
      /* Подтверждение — перечнем того, что изменилось, названиями самих
         пунктов раздела: так видно, куда идти, если что-то не понравилось.
         Показывается и когда менять было нечего: молчащая кнопка выглядит
         сломанной. */
      var head = LC.lang(id === 'appletv' ? 'lumen_preset_appletv_short' : 'lumen_preset_lumen_short');
      var text = head + ' · ' + (changed.length ? changed.join(', ') : LC.lang('lumen_preset_same'));
      if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(text);
    } catch (err) {
      warn('preset failed', err);
    }
  }

  /* Обработчик нажатия для параметров type:'button'. */
  function onButtonFor(name) {
    return function () {
      if (name === 'lumen_home_rows') openHomeRows();
      else if (name === 'lumen_preset_appletv') applyPreset('appletv');
      else if (name === 'lumen_preset_lumen') applyPreset('lumen');
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
    /* Кнопка-параметр ничего не хранит: Lampa зовёт её onChange по нажатию. */
    if (entry.type === 'button') {
      Lampa.SettingsApi.addParam({ component: PLUGIN, param: param, field: field, onChange: onButtonFor(entry.name) });
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
         не пустоту, а ПЛЕЙСХОЛДЕР (update$3, app.min.js: `if (!val && plr)
         val = plr;`), и берёт его из param.placeholder, вставляя в разметку
         как есть. Без этого поля в разделе стояло слово «undefined» —
         буквально оно, видимое пользователю. */
      param.placeholder = LC.lang(entry.placeholder);
    }
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

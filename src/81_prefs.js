  /* -------------------------------------------------------------------- */
  /* Task 10: чистая логика настроек.                                      */
  /*                                                                       */
  /* Вынесено из 80_settings.js по поправке контроллера: тот перевалил за   */
  /* 300 строк (словарь LC.STRINGS растёт с каждой задачей). Здесь —        */
  /* нормализация значений, выбор режима по платформе и таблица пунктов     */
  /* раздела (порядок, типы, значения по умолчанию). Ни window, ни Lampa,   */
  /* ни DOM модуль при загрузке не трогает: LC.pref читает Storage только   */
  /* по вызову. Регистрация в Lampa.SettingsApi и словарь остались в        */
  /* 80_settings.js, применение настроек — в 90_runtime.js.                 */
  /*                                                                       */
  /* Имена LC.pref / LC.motionModeFor / LC.motionMode сохранены — переезд   */
  /* поведения не меняет. В бандле 81 идёт после 80, а 30_css.js/           */
  /* 60_reviews.js и прочие зовут LC.pref только в рантайме.                */
  /* -------------------------------------------------------------------- */

  LC.prefs = (function () {

    /* Переключатели Lampa хранятся строками 'true'/'false' (план 0.2:
       Storage.set(name, false) с JS-false не сохраняется вовсе), а старые
       профили могут держать 1/0. Незнакомое значение — значение по
       умолчанию, а не «ложь»: битый Storage не должен молча выключать
       настройку, которая по замыслу включена. */
    function boolOf(value, def) {
      if (typeof value === 'undefined' || value === null || value === '') return def;
      if (value === 'true' || value === true || value === 1 || value === '1') return true;
      if (value === 'false' || value === false || value === 0 || value === '0') return false;
      return def;
    }

    /* Task 62a (фаза 5): вид меток на постерах. Пункт был ПЕРЕКЛЮЧАТЕЛЕМ
       (Task 25), и сохранённое значение у тех, кто его трогал, — строка
       'true'/'false' (то же самое, что читает boolOf выше). Значений стало
       три, поэтому старое читается как новое:
         'true'  -> 'poster'  — плашка на постере, прежнее «включено»;
         'false' -> 'off'     — прежнее «выключено»;
         ключа нет/мусор -> 'poster' — значение по умолчанию пункта.
       Функция чистая: её же зовут и одноразовая миграция (LC.migratePrefs
       ниже, она переписывает значение через Lampa.Storage.set), и само
       чтение (LC.badgesMode). Один разбор на оба пути — иначе «что сейчас
       показывать» и «что записать» однажды разойдутся. */
    function badgesMode(value) {
      if (value === 'poster' || value === 'caption' || value === 'off') return value;
      if (value === 'true' || value === true || value === 1 || value === '1') return 'poster';
      if (value === 'false' || value === false || value === 0 || value === '0') return 'off';
      return 'poster';
    }

    /* stored — сырое значение параметра lumen_motion ('auto'|'full'|'lite'|'off'),
       platform — {tizen:bool, webos:bool, android:bool, weak:bool}, auto —
       вердикт автодетекта ('lite' | 'full' | null, src/68_perf.js). Не 'auto'
       -> как есть; 'auto' на tizen/webos -> 'lite', иначе решает вердикт
       замеров. Любое незнакомое значение stored (undefined/null/''/мусор —
       старый профиль без ключа или битое значение в Storage) считается как
       'auto', а не возвращается как есть.

       Task 29 (фаза 3): вердикт умеет только ПОНИЖАТЬ. 'full' от автодетекта
       означает «понижать не за что», а не «поднять выше платформенного lite»:
       на Tizen/webOS полные анимации остаются выключенными, даже если замеры
       там вышли быстрыми (там их и не делают — LC.perf.shouldMeasure).

       Task 40 (фаза 4): platform.weak — «железо заведомо слабое» по числу
       ядер и объёму памяти (LC.perf.weakHardware). Такому устройству 'auto'
       отдаёт 'lite' сразу, не дожидаясь трёх замеров: они придут только
       после трёх тяжёлых экранов, которые на нём и тормозят. Четырёхъядерный
       ТВ под это правило НЕ попадает — там решает замер. */
    function motionModeFor(stored, platform, auto) {
      if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
      if (stored !== 'auto') return stored;
      platform = platform || {};
      if (platform.tizen || platform.webos || platform.weak) return 'lite';
      if (auto === 'lite') return 'lite';
      return 'full';
    }

    /* Task 40: значение по умолчанию у тумблера тяжёлых эффектов —
       ПЛАТФОРМЕННОЕ. На телевизоре (Android TV, Tizen, webOS) частицы,
       Ken Burns, зум заставки, слайдшоу кадров, кроссфейд двух полноэкранных
       слоёв героя и автотрейлер стоят кадров, и включать их без спроса
       нельзя; в браузере на компьютере они бесплатны и остаются.
       Значение — именно default параметра, а не гейт: включив тумблер руками,
       владелец телевизора получает всё, как и раньше. */
    function fxHeavyDefault(platform) {
      platform = platform || {};
      return !(platform.android || platform.tizen || platform.webos);
    }

    /* Раздел «Lumen Card», версия 1.0.2. Автор 2026-09-27: «в настройках
       куча мусора; хочу шарить плагин другим людям — привести к нормальному
       виду». Было 53 пункта в одиннадцати группах одного длинного списка,
       стало два экрана (структура согласована с автором):

         главный (компонент PLUGIN) — 18 строк: выключатель, четыре группы
           по 3–5 пунктов и кнопка «Дополнительно…». То, что меняют чаще;
         «Дополнительно…» (компонент PLUGIN + '_more', у пунктов
           section: 'more') — всё остальное; «Для разработчика» — в самом
           низу, туда же переехали четыре бывших «консольных» выключателя.

       Порядок LIST — порядок на экране: сначала главный раздел (MAIN),
       потом второй (MORE). Заголовок группы — штатный параметр Lampa
       type:'title' (addParams, <div class="settings-param-title">), он
       ничего не хранит и не имеет onChange.

       Слиты (старые ключи остаются в Storage; LC.migratePrefs переводит
       однозначные случаи, а места чтения дочитывают старый ключ там, где
       выбор был частичным, — MERGED ниже):
         «Фирменные шрифты» (lumen_card_fonts) → значение 'system' у
           «Шрифта» (lumen_font);
         «Автотрейлер в кадре главной» (lumen_hero_trailer) → значение
           'frames' у «Что в кадре» (lumen_hero_media);
         кнопка «Франшиза» + ряд «Смотреть по порядку» → «Франшизы»
           (lumen_franchise);
         «Мини-карта рядов» + «Быстрое листание» → «Ускорители пульта»
           (lumen_remote_boost);
         две кнопки готового стиля → select «Стиль» (lumen_style).
       Убраны из раздела, но читаются как раньше: lumen_reviews_mode
       (переключатель «Показывать текст» есть в самом ряду отзывов),
       lumen_kp_hint (подсказку убирает кнопка «Скрыть» на экране),
       lumen_roulette_unseen (чип «Не смотрел» на экране рулетки).

       У каждого пункта есть label и descr — ключи LC.STRINGS
       (80_settings.js). Описание — одна-две короткие фразы для человека с
       пультом: что будет, без внутренних терминов (сторожит
       test/prefs.test.mjs). Настройки применяются сразу; где это не так,
       описание говорит, когда. У select значения перечислены ключами,
       подпись значения — vprefix + значение (или «значение + vsuffix»:
       «14 с»).

       Имена ключей НЕ переименовываются: профили пользователей живут с
       ними. Отсюда и смесь префиксов — часть ключей с lumen_card_, часть
       без; LC.followStorage разбирает их отдельными ветками. */
    var MAIN = [
      { name: 'lumen_enabled', type: 'trigger', 'default': true, label: 'lumen_card_enabled_name', descr: 'lumen_card_enabled_descr' },

      { name: 'lumen_group_look', type: 'title', label: 'lumen_group_look' },
      /* 1.0.2: готовый стиль — select вместо двух кнопок (Task 62b). Его
         значение не врёт: пункты набора правятся и по одному, и тогда оно
         само становится 'custom' («Свой»), а совпав с набором — его именем
         (styleOf ниже, syncStyle в 80_settings.js). Выбор Lumen или Apple TV
         пишет набор (applyPreset), «Свой» не пишет ничего. */
      { name: 'lumen_style', type: 'select', values: ['lumen', 'appletv', 'custom'], vprefix: 'lumen_style_', 'default': 'lumen', label: 'lumen_style_name', descr: 'lumen_style_descr' },
      /* Task 24/35: цвет фона от постера открытого фильма — перед
         «Акцентным цветом»: выключенный, он оставляет именно его
         (src/57_color.js). Включён по умолчанию. */
      { name: 'lumen_accent_auto', type: 'trigger', 'default': true, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },
      /* Фаза 3: девять акцентов по цветовому кругу, графит последним
         (палитра и замеры контраста — ACCENTS в src/30_css.js). */
      { name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent', descr: 'lumen_card_accent_descr' },
      /* Пять гарнитур с Google Fonts (CSP плагина другого источника не
         пропустит), набор — FONT_SETS в src/30_css.js. 1.0.2: 'system' —
         «Как в Lampa», бывший выключатель «Фирменные шрифты». Строка пункта
         набрана выбранной гарнитурой (onRender, src/80_settings.js). */
      { name: 'lumen_font', type: 'select', values: ['system', 'golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },
      /* Фаза 3: коэффициент на корнях экранов плагина (SCALES в
         src/30_css.js). */
      { name: 'lumen_scale', type: 'select', values: ['small', 'normal', 'large', 'huge'], vprefix: 'lumen_scale_', 'default': 'normal', label: 'lumen_scale_name', descr: 'lumen_scale_descr' },

      { name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },
      /* Размер кадра — первым: от него зависит, сколько экрана достанется
         всему остальному (HERO_SIZES в src/30_css.js). */
      { name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },
      /* Кадры с автотрейлером (дефолт) или только кадры (heroMedia,
         src/48_hero.js). 1.0.2: выключатель автотрейлера слит сюда. */
      { name: 'lumen_hero_media', type: 'select', values: ['trailer', 'frames'], vprefix: 'lumen_hero_media_', 'default': 'trailer', label: 'lumen_hero_media_name', descr: 'lumen_hero_media_descr' },
      /* Правка 2026-09-26: ширина постера ряда и колонки сетки (TILES,
         GCARD_COLS_TILE в src/30_css.js); текст — за «Масштабом». */
      { name: 'lumen_tile_size', type: 'select', values: ['small', 'normal', 'large'], vprefix: 'lumen_tile_size_', 'default': 'normal', label: 'lumen_tile_size_name', descr: 'lumen_tile_size_descr' },
      /* Решение пользователя 2026-09-26: по умолчанию 10 рядов (было 15);
         сохранённое значение не трогается. */
      { name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '10', label: 'lumen_rows_limit_name', descr: 'lumen_rows_limit_descr' },
      /* Кнопка-параметр: multi-select в SettingsApi нет, состав выбирается
         на экране Lampa.Select с чекбоксами (openHomeRows,
         src/80_settings.js). Значение — строка id через запятую в
         lumen_home_rows, его читает план главной (src/47_homeplan.js). */
      { name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },

      { name: 'lumen_group_card', type: 'title', label: 'lumen_group_card' },
      { name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
      /* placeholder обязателен у type:'input': пустое поле Lampa показывает
         им, а без него в разделе стояло слово «undefined» (addPrefParam). */
      { name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr', placeholder: 'lumen_pref_unset' },
      /* 1.0.2: кнопка «Франшиза» (src/46_hub.js) и ряд «Смотреть по
         порядку» (src/66_franchise.js) — одним выключателем. Выключенный
         ряд коллекцию не запрашивает. */
      { name: 'lumen_franchise', type: 'trigger', 'default': true, label: 'lumen_franchise_name', descr: 'lumen_franchise_descr' },

      { name: 'lumen_group_motion', type: 'title', label: 'lumen_group_motion' },
      { name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },
      /* Раунд holB: частицы — только праздничные (автотемы по словам
         выключены флагом LC.fxAutoThemes, src/53_themes.js), поэтому
         прежние «Все» и «Только сезонные» различались лишь сценой
         праздничного фильма вне праздника. 1.0.2: два значения; сохранённое
         'all' LC.migratePrefs переводит в 'seasonal', а модуль тем по-прежнему
         его понимает. */
      { name: 'lumen_fx', type: 'select', values: ['seasonal', 'off'], vprefix: 'lumen_fx_', 'default': 'seasonal', label: 'lumen_fx_name', descr: 'lumen_fx_descr' },
      /* Task 56: ВЫКЛЮЧЕНА по умолчанию — заставку Lampa (видео Aerial через
         5 минут) без спроса не заменяем. Тумблер хранит строку, поэтому
         включавшие и выключавшие смены дефолта не заметят. */
      { name: 'lumen_ambient', type: 'trigger', 'default': false, label: 'lumen_ambient_name', descr: 'lumen_ambient_descr' },

      /* 1.0.2: кнопка на второй экран (openMore, src/80_settings.js). */
      { name: 'lumen_more', type: 'button', label: 'lumen_more_name', descr: 'lumen_more_descr' }
    ];

    var MORE = [
      { name: 'lumen_group_style', type: 'title', label: 'lumen_group_style' },
      /* Тема и плотность подложек — два пункта, а не список из трёх: тема —
         про цвет тёмного (тёплый или чёрный для OLED), плотность — про
         просвечивание (на части ТВ мылит и тормозит); нужны все четыре
         сочетания. */
      { name: 'lumen_theme', type: 'select', values: ['warm', 'black'], vprefix: 'lumen_theme_', 'default': 'warm', label: 'lumen_theme_name', descr: 'lumen_theme_descr' },
      { name: 'lumen_solid', type: 'trigger', 'default': false, label: 'lumen_solid_name', descr: 'lumen_solid_descr' },
      /* Task 73: содержимое на фоне, а не в коробках — на всех экранах
         разом (flatRules в src/30_css.js, экраны пути — src/65_torrents.js).
         В стиле Apple TV включён. */
      { name: 'lumen_flat', type: 'trigger', 'default': false, label: 'lumen_flat_name', descr: 'lumen_flat_descr' },
      /* Task 62a: докуда доходит цвет постера. 'veil' — только фон, подложка
         фокуса нейтральна (так у Apple TV). Без «Цвета фона от кадра» не
         действует (LC.accentScope ниже). */
      { name: 'lumen_accent_scope', type: 'select', values: ['full', 'veil'], vprefix: 'lumen_accent_scope_', 'default': 'full', label: 'lumen_accent_scope_name', descr: 'lumen_accent_scope_descr' },
      /* Логотип названия в шапке карточки (renderLogo, src/85_header.js) и
         в кадре главной (logoAllowed, src/48_hero.js) — два пункта: у
         карточки своя цена (английский логотип прячет русское название). */
      { name: 'lumen_card_logo', type: 'trigger', 'default': true, label: 'lumen_card_logo_name', descr: 'lumen_card_logo_descr' },
      { name: 'lumen_hero_logo', type: 'trigger', 'default': true, label: 'lumen_hero_logo_name', descr: 'lumen_hero_logo_descr' },
      /* Task 62a: три вида метки; старое значение переключателя читается
         как новое (badgesMode ниже, LC.migratePrefs). */
      { name: 'lumen_badges', type: 'select', values: ['poster', 'caption', 'off'], vprefix: 'lumen_badges_', 'default': 'poster', label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
      /* Дефолт 'lampa' — ни одного лишнего запроса у того, кто пункт не
         трогал (src/43_sources.js). */
      { name: 'lumen_posters', type: 'select', values: ['lampa', 'original', 'clean'], vprefix: 'lumen_posters_', 'default': 'lampa', label: 'lumen_posters_name', descr: 'lumen_posters_descr' },

      { name: 'lumen_group_screens', type: 'title', label: 'lumen_group_screens' },
      /* Task 40: «украшения» — плавная смена кадров, наезд, зум заставки;
         только при полных анимациях (LC.fxHeavy). Дефолт — ФУНКЦИЯ
         платформы: addPrefParam (src/80_settings.js) зовёт её при
         регистрации раздела, когда Lampa.Platform уже поднята. */
      { name: 'lumen_fx_heavy', type: 'trigger', 'default': function () { return fxHeavyDefault(LC.platformInfo()); }, label: 'lumen_fx_heavy_name', descr: 'lumen_fx_heavy_descr' },
      { name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name', descr: 'lumen_card_slideshow_descr' },
      { name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval', descr: 'lumen_card_slide_interval_descr' },
      { name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },
      { name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name', descr: 'lumen_card_progress_descr' },
      /* A6: «Метаданные» и «Настроения» — блоки САМОЙ Lampa (данные от CUB,
         только для фильма). Читает один dropMetaData (src/90_runtime.js) на
         построении карточки — отсюда «со следующего открытия». По умолчанию
         выключен: чужие данные молча не прячем; в стиле Apple TV включён. В
         таблице стилей правила скрытия быть не должно (сторож в
         test/css.test.mjs). */
      { name: 'lumen_hide_meta', type: 'trigger', 'default': false, label: 'lumen_hide_meta_name', descr: 'lumen_hide_meta_descr' },
      /* Волна 3: чипы на главной — только без кадра над рядами
         (src/49_moods.js). */
      { name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
      { name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },
      /* Волна 4: первые ряды крутятся по эпохам (src/47_homeplan.js);
         'history' — прежний порядок, личные ряды сверху. */
      { name: 'lumen_home_start', type: 'select', values: ['rotate', 'history'], vprefix: 'lumen_home_start_', 'default': 'rotate', label: 'lumen_home_start_name', descr: 'lumen_home_start_descr' },
      /* Task 57: фильм из ряда выше в нижних не повторяется. */
      { name: 'lumen_rows_dedupe', type: 'trigger', 'default': true, label: 'lumen_rows_dedupe_name', descr: 'lumen_rows_dedupe_descr' },
      { name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },

      { name: 'lumen_group_remote', type: 'title', label: 'lumen_group_remote' },
      /* Task 26: удержание OK — штатный жест Lampa, мы лишь дописываем в
         её меню свои пункты. */
      { name: 'lumen_context_menu', type: 'trigger', 'default': true, label: 'lumen_context_menu_name', descr: 'lumen_context_menu_descr' },
      /* 1.0.2: мини-карта рядов и быстрое листание (src/64_nav.js) — одним
         выключателем; обычное нажатие не меняет ни то, ни другое. */
      { name: 'lumen_remote_boost', type: 'trigger', 'default': true, label: 'lumen_remote_boost_name', descr: 'lumen_remote_boost_descr' },
      { name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus', descr: 'lumen_card_menus_descr' },
      { name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' },
      /* Task 22: сам выключатель заставки — в главном разделе («Движение»),
         здесь то, что настраивают один раз. */
      { name: 'lumen_ambient_source', type: 'select', values: ['curated', 'current'], vprefix: 'lumen_ambient_source_', 'default': 'curated', label: 'lumen_ambient_source_name', descr: 'lumen_ambient_source_descr' },
      { name: 'lumen_ambient_delay', type: 'select', values: ['3', '5', '10'], vsuffix: 'lumen_ambient_minutes', 'default': '3', label: 'lumen_ambient_delay_name', descr: 'lumen_ambient_delay_descr' },

      /* «Для разработчика» — последней группой второго экрана, в самом
         низу: замеры, свой каталог и выключатели оптимизаций памяти и
         прокрутки. Четыре последних до 1.0.2 включались только из консоли
         (Lampa.Storage.set); значения по умолчанию прежние, и читают их те
         же места (src/58_rowmem.js, src/58_netmem.js, src/58_prefill.js) —
         на каждом шаге, кроме lumen_netmem: его обёртки ставятся при
         включении плагина, выключение действует со следующего запуска. */
      { name: 'lumen_group_dev', type: 'title', label: 'lumen_group_dev' },
      /* Task 31: строка замеров в углу экрана (src/69_hud.js). */
      { name: 'lumen_debug_hud', type: 'trigger', 'default': false, label: 'lumen_debug_hud_name', descr: 'lumen_debug_hud_descr' },
      /* Волна производительности: самотест (src/69_bench.js); кнопка. */
      { name: 'lumen_debug_bench', type: 'button', label: 'lumen_debug_bench_name', descr: 'lumen_debug_bench_descr' },
      /* Пусто — LC.MANIFEST_URL (src/00_head.js). */
      { name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr', placeholder: 'lumen_pref_default_catalog' },
      { name: 'lumen_rowmem', type: 'trigger', 'default': true, label: 'lumen_rowmem_name', descr: 'lumen_rowmem_descr' },
      /* По умолчанию ВЫКЛЮЧЕНО до проверки на ТВ (bytesOn,
         src/58_rowmem.js). */
      { name: 'lumen_rowmem_bytes', type: 'trigger', 'default': false, label: 'lumen_rowmem_bytes_name', descr: 'lumen_rowmem_bytes_descr' },
      { name: 'lumen_netmem', type: 'trigger', 'default': true, label: 'lumen_netmem_name', descr: 'lumen_netmem_descr' },
      { name: 'lumen_prefill', type: 'trigger', 'default': true, label: 'lumen_prefill_name', descr: 'lumen_prefill_descr' }
    ];

    var m;
    for (m = 0; m < MORE.length; m++) MORE[m].section = 'more';
    var LIST = MAIN.concat(MORE);

    /* 1.0.2: слитые пункты — новый ключ и старые, которые он заменил.
       Старый ключ, сохранённый выключенным, дочитывается местом чтения
       (lumen_franchise И lumen_franchise_row и т. д.), пока человек не
       тронет новый пункт: тогда старые получают его значение (mergedOn
       ниже; releaseMerged, src/80_settings.js), и дальше решает новый
       пункт. Однозначные случаи LC.migratePrefs переводит сразу. */
    var MERGED = {
      lumen_font: ['lumen_card_fonts'],
      lumen_hero_media: ['lumen_hero_trailer'],
      lumen_franchise: ['lumen_franchise_button', 'lumen_franchise_row'],
      lumen_remote_boost: ['lumen_minimap', 'lumen_fastscroll']
    };

    /* Ревью 1.0.2: значение старых ключей, которое отвечает значению нового
       пункта. 1.0.1 читает только старые ключи, поэтому откат на неё
       обязан видеть тот же выбор: «Шрифт: Как в Lampa» — фирменные шрифты
       выключены, «Только кадры» — автотрейлер выключен, выключенные
       «Франшизы» и «Ускорители пульта» — обе части выключены. */
    function mergedOn(name, value) {
      if (name === 'lumen_font') return value !== 'system';
      if (name === 'lumen_hero_media') return value !== 'frames';
      return boolOf(value, true);
    }

    function find(name) {
      if (!name) return null;
      for (var i = 0; i < LIST.length; i++) if (LIST[i].name === name) return LIST[i];
      return null;
    }

    /* Task 62b (фаза 5): готовый стиль — НАБОР ЗНАЧЕНИЙ существующих
       пунктов, а не режим CSS (решение пользователя 2026-09-21: «сделать
       пункт в меню „как apple tv“»). Отсюда и главное свойство: после
       кнопки любой пункт правится по одному и правка переживает перезапуск —
       ничего «поверх» настроек не стоит.

       Какие пункты входят: только те, что отвечают за ВИД. Ключ Кинопоиска,
       масштаб, движение, заставка, ряды и адрес каталога сюда не входят
       по прямому запрету плана фазы 5 («Что НЕ делать») — это выбор
       пользователя, к оформлению отношения не имеющий. Настройки самой
       Lampa (background, glass_style, poster_size, interface_size) плагин
       не трогает тем более: они не его.
       «Плотные подложки» (lumen_solid) в наборе нет намеренно: пункт
       решает не вопрос вкуса, а вопрос железа — на телевизоре, где
       полупрозрачность мылит, его включают один раз и навсегда, и стиль
       не вправе его переключать.

       Три ключа — lumen_hero_size, lumen_accent_auto и lumen_hero_logo — в
       стиле Apple TV совпадают со значениями по умолчанию, и всё же входят
       в набор: стиль обязан быть ПОЛНЫМ состоянием, а не разницей. Иначе
       человек с «Кадром над рядами → Выключен» получил бы «стиль Apple TV»
       без кадра, а нажатие «Вернуть стиль Lumen» не вернуло бы его. Первые
       два стоят и в согласованной таблице задачи (task62-detail.md, строки
       «lumen_accent_auto ... true / true» и «lumen_hero_size ... large /
       large»); третий пропустили при сборке Task 73 (ревью 2026-09-22,
       п.4), хотя план фазы 6 оговаривал его тем же порядком: «в пресете
       Apple TV логотип включён (Apple всегда показывает title treatment), в
       Lumen — тоже; отличия нет»
       (docs/plans/2026-09-22-lumen-phase6-tv-feedback.md, строка 150).
       1.0.2: вместо двух кнопок — select «Стиль» (lumen_style); что
       изменилось, перечисляет уведомление после выбора (applyPreset,
       src/80_settings.js) — названиями самих пунктов. */
    /* A6: десятым в наборе — «Скрывать блоки анализа Lampa». Курс стиля
       Apple TV на «ничего лишнего» доходит и до чужих блоков на карточке;
       стиль Lumen возвращает их значением по умолчанию пункта (выключено). */
    var PRESET_KEYS = ['lumen_theme', 'lumen_card_accent', 'lumen_font', 'lumen_accent_auto',
      'lumen_accent_scope', 'lumen_hero_size', 'lumen_hero_logo', 'lumen_badges', 'lumen_flat',
      'lumen_hide_meta'];

    /* Отличия стиля Apple TV от стиля Lumen. Чего здесь нет — берётся из
       значения по умолчанию пункта, то есть совпадает со стилем Lumen; в
       наборе такие ключи всё равно остаются, чтобы кнопка возвращала их из
       любого ручного значения (выключенную подкраску, компактный кадр).
       Палитра: пользователь просил «уйти чуть в нейтральную для
       разделения» — graphite на чёрной теме против тёплого песка Lumen. */
    var PRESET_APPLETV = {
      lumen_theme: 'black',
      lumen_card_accent: 'graphite',
      lumen_font: 'inter',
      lumen_badges: 'caption',
      lumen_accent_scope: 'veil',
      /* Task 73: до него стиль менял только палитру, шрифт и место меток —
         то есть на всех экранах, кроме главной, пользователь видел прежнюю
         раскладку и написал «менялся только дизайн стартовой». Плоский вид
         — ровно то, чем карточка Apple TV отличается от нашей: содержимое
         лежит на фоне, а не в коробках. */
      lumen_flat: true,
      /* A6: «Метаданные» и «Настроения» — чужие блоки на карточке фильма
         (разбор со ссылками — у пункта в LIST выше). В стиле Lumen они
         остаются: чужие данные молча не прячем. */
      lumen_hide_meta: true
    };

    /* Полный набор значений стиля: {ключ: значение} по PRESET_KEYS.
       Стиль 'lumen' — ЗНАЧЕНИЯ ПО УМОЛЧАНИЮ из самой таблицы LIST, а не
       вторая копия тех же литералов рядом: два списка одних и тех же чисел
       однажды разойдутся, и «Вернуть стиль Lumen» перестал бы возвращать к
       тому, что видит новый пользователь.
       Незнакомый стиль — пустой набор: половина значений хуже, чем ничего. */
    function presetValues(id) {
      var out = {};
      if (id !== 'lumen' && id !== 'appletv') return out;
      for (var i = 0; i < PRESET_KEYS.length; i++) {
        var key = PRESET_KEYS[i];
        var entry = find(key);
        if (!entry) continue;
        var value = entry['default'];
        /* Дефолт пункта может быть функцией (платформенный, Task 40) —
           в наборе стиля обязано лежать уже её значение. */
        if (typeof value === 'function') value = value();
        if (id === 'appletv' && Object.prototype.hasOwnProperty.call(PRESET_APPLETV, key)) value = PRESET_APPLETV[key];
        out[key] = value;
      }
      return out;
    }

    /* 1.0.2: какой стиль стоит СЕЙЧАС — по фактическим значениям пунктов
       набора. read(key) отдаёт значение так, как его видит плагин (с
       дефолтом пункта и нормализацией, presetCurrent в src/80_settings.js).
       Совпало со стилем целиком — его имя, иначе 'custom' («Свой»): после
       ручной правки select «Стиль» не показывает стиль, которого уже нет. */
    function styleOf(read) {
      var ids = ['lumen', 'appletv'];
      for (var i = 0; i < ids.length; i++) {
        var want = presetValues(ids[i]);
        var same = true;
        for (var k = 0; k < PRESET_KEYS.length && same; k++) {
          if (read(PRESET_KEYS[k]) !== want[PRESET_KEYS[k]]) same = false;
        }
        if (same) return ids[i];
      }
      return 'custom';
    }

    /* Сырое значение Storage (или подмены) → то, что отдаёт LC.pref: пусто
       — дефолт, булев дефолт — булево через boolOf. */
    function normalize(value, def) {
      if (typeof value === 'undefined' || value === null || value === '') return def;
      if (typeof def === 'boolean') return boolOf(value, def);
      return value;
    }

    /* Волна производительности: подмены настроек ТОЛЬКО в памяти — для
       самотеста (src/69_bench.js), который гоняет главную по режимам
       анимаций. LC.pref спрашивает их первой строкой; Storage при этом не
       читается и не пишется, и выдернутое посреди теста питание оставляет
       пользователю его собственные настройки. Карта копируется: правка
       переданного объекта подмену не меняет. */
    var overrides = null;

    function override(map) {
      overrides = null;
      if (!map) return;
      overrides = {};
      for (var key in map) {
        if (Object.prototype.hasOwnProperty.call(map, key)) overrides[key] = map[key];
      }
    }

    function clearOverride() {
      overrides = null;
    }

    function overridden(name) {
      return !!overrides && Object.prototype.hasOwnProperty.call(overrides, name);
    }

    function overrideOf(name) {
      return overrides ? overrides[name] : undefined;
    }

    return {
      LIST: LIST, find: find, boolOf: boolOf, badgesMode: badgesMode,
      motionModeFor: motionModeFor, fxHeavyDefault: fxHeavyDefault,
      PRESET_KEYS: PRESET_KEYS, presetValues: presetValues, styleOf: styleOf, MERGED: MERGED, mergedOn: mergedOn,
      normalize: normalize, override: override, clearOverride: clearOverride,
      overridden: overridden, overrideOf: overrideOf
    };
  })();

  /* Task 40: платформа одним объектом — его ждут motionModeFor (tizen/webos/
     weak) и fxHeavyDefault (android/tizen/webos). До Task 40 tizen и webos
     собирались прямо в LC.motionMode; теперь сборка одна, а не три копии в
     трёх местах. Lampa.Platform.is отвечает и до init (app.min.js ставит
     Platform одним из первых), но вне Lampa (тесты, чужая страница) функции
     может не быть — тогда все признаки ложны, то есть «обычный браузер». */
  LC.platformInfo = function () {
    var platform = { tizen: false, webos: false, android: false, weak: false };
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
        platform.tizen = !!Lampa.Platform.is('tizen');
        platform.webos = !!Lampa.Platform.is('webos');
        platform.android = !!Lampa.Platform.is('android');
      }
    } catch (e) { }
    try {
      if (LC.perf && typeof LC.perf.weakHardware === 'function') platform.weak = !!LC.perf.weakHardware();
    } catch (e2) { }
    return platform;
  };

  /* Читает настройку плагина из Lampa.Storage с нормализацией булевых. */
  LC.pref = function (name, def) {
    if (LC.prefs.overridden(name)) return LC.prefs.normalize(LC.prefs.overrideOf(name), def);
    var value;
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
        value = Lampa.Storage.get(name, def);
      }
    } catch (e) {
      warn('storage read failed: ' + name, e);
    }
    return LC.prefs.normalize(value, def);
  };

  /* Task 10: главный выключатель. Выключенный плагин возвращает штатный
     шаблон карточки и снимает всё своё оформление (LC.applyEnabledPref,
     90_runtime.js), поэтому его читают и рантайм, и генератор CSS. */
  LC.enabled = function () {
    return LC.pref('lumen_enabled', true);
  };

  /* Task 62a: вид меток — ОДНА точка чтения на весь плагин (её зовут
     src/62_badges.js, src/30_css.js и src/90_runtime.js). Дефолт вызова стоит
     здесь же, рядом с дефолтом пункта, — расхождение этих двух чисел и было
     дефектом Task 60, и сверяет их тест test/prefs.test.mjs по собранному
     файлу. */
  LC.badgesMode = function () {
    return LC.prefs.badgesMode(LC.pref('lumen_badges', 'poster'));
  };

  /* Постеры: источник постера карточки — ОДНА точка чтения на весь плагин
     (её зовёт src/43_sources.js). Дефолт вызова стоит рядом с дефолтом
     пункта и сверяется с ним тестом по собранному файлу — расхождение этих
     двух значений было дефектом Task 60.
     Незнакомое значение (битый Storage, ручная правка) — 'lampa': режим
     без единого лишнего запроса, самый безопасный из трёх. */
  LC.postersMode = function () {
    var value = LC.pref('lumen_posters', 'lampa');
    return value === 'original' || value === 'clean' ? value : 'lampa';
  };

  /* Task 62a: область подкраски от постера — 'full' или 'veil'. Читается при
     сборке таблицы стилей и при записи узла подкраски (src/30_css.js).

     Ревью Task 62: при ВЫКЛЮЧЕННОЙ подкраске настройка не действует вовсе.
     Пункт отвечает на вопрос «докуда доходит цвет ПОСТЕРА», а подложка
     фокуса при выключенном lumen_accent_auto красится статическим акцентом
     из настроек — постер к ней отношения не имеет, и снимать её было бы не
     за что. Без этой ветки «Акцент от постера → выкл» плюс «Только фон»
     убирали подложку совсем, хотя описание пункта (все три языка) и README
     обещают «Действует при включённом „Акценте от постера“». */
  LC.accentScope = function () {
    if (!LC.pref('lumen_accent_auto', true)) return 'full';
    return LC.pref('lumen_accent_scope', 'full') === 'veil' ? 'veil' : 'full';
  };

  /* Task 62a: одноразовый перевод сохранённых значений на новые типы.
     Пишем через Lampa.Storage.set, а не правкой localStorage: у Lampa на
     записи висит её собственный listener 'change' (на него подписан и
     плагин — LC.followStorage), а Storage.set вдобавок держит свой кэш
     значений. Правка в обход обоих оставила бы Lampa с прежним значением
     в памяти до перезапуска.
     Зовётся из LC.init ДО подписки на 'change' — значит собственное событие
     мы не ловим и лишнего применения настройки не делаем.

     1.0.2 — слитые и сокращённые пункты (LC.prefs.MERGED):
       «Фирменные шрифты» выкл ............ lumen_font = 'system';
       «Автотрейлер в кадре главной» выкл . lumen_hero_media = 'frames';
       «Атмосферы» = 'all' ................ lumen_fx = 'seasonal';
       кнопка «Франшиза» И ряд выкл ....... lumen_franchise = 'false';
       мини-карта И быстрое листание выкл . lumen_remote_boost = 'false'.
     Старые ключи миграция НЕ трогает (ревью 1.0.2): 1.0.1 читает только их,
     и откат на неё обязан оставить выключенное выключенным. Места чтения
     дочитывают старый ключ рядом с новым (частичный выбор — выключена одна
     из двух частей — переводить не во что, и он остаётся в силе, пока
     человек не тронет новый пункт), а тронутый новый пункт пишет своё
     значение и в старые ключи (releaseMerged, src/80_settings.js). Шаг
     пишет, только если новый пункт ещё не переведён, поэтому повторный
     запуск ничего не пишет: миграция идемпотентна без отдельной метки
     версии. Булевы — строками: JS-false Lampa отдаёт из памяти как false,
     а LC.pref не отличит его от «нет значения» (boolOf выше).
     Каждый шаг — в своём try: сбой одного не отменяет остальные.

     После 1.0.2 — кэш снятых подборок Кинопоиска (KP_CACHE ниже). */
  LC.migratePrefs = function () {
    if (!window.Lampa || !Lampa.Storage || typeof Lampa.Storage.set !== 'function') return;
    if (typeof Lampa.Storage.get !== 'function') return;

    function get(name) {
      return Lampa.Storage.get(name, '');
    }
    /* Выключен ЯВНО: ключ есть и хранит «ложь». Нет ключа — не выключен. */
    function off(name) {
      return LC.prefs.boolOf(get(name), true) === false;
    }
    function step(fn) {
      try { fn(); } catch (e) { warn('prefs migrate failed', e); }
    }

    step(function () {
      var badges = get('lumen_badges');
      /* Пустое значение — ключа в Storage нет вовсе (пользователь пункт не
         трогал). Мигрировать нечего: пункт отдаст свой default. */
      if (badges === '' || badges === null || typeof badges === 'undefined') return;
      if (badges === 'poster' || badges === 'caption' || badges === 'off') return;
      Lampa.Storage.set('lumen_badges', LC.prefs.badgesMode(badges));
    });
    step(function () {
      if (off('lumen_card_fonts') && get('lumen_font') !== 'system') Lampa.Storage.set('lumen_font', 'system');
    });
    step(function () {
      if (off('lumen_hero_trailer') && get('lumen_hero_media') !== 'frames') Lampa.Storage.set('lumen_hero_media', 'frames');
    });
    step(function () {
      if (get('lumen_fx') === 'all') Lampa.Storage.set('lumen_fx', 'seasonal');
    });
    step(function () {
      if (off('lumen_franchise_button') && off('lumen_franchise_row') && !off('lumen_franchise')) Lampa.Storage.set('lumen_franchise', 'false');
    });
    step(function () {
      if (off('lumen_minimap') && off('lumen_fastscroll') && !off('lumen_remote_boost')) Lampa.Storage.set('lumen_remote_boost', 'false');
    });
    step(dropKpCache);
  };

  /* После 1.0.2: подборки Кинопоиска сняты (src/42_manifest.js, RETIRED), а
     их кэш остался в localStorage и занимает квоту, нужную отзывам:
     страницы lumen_kp_<КОЛЛЕКЦИЯ>_<страница> и постеры плиток
     lumen_kpp_<КОЛЛЕКЦИЯ> — до 60 записей по индексу lumen_sources_index,
     плюс отметки неудач на 10 минут, которые в индекс не попадали (их
     находит перебор localStorage). Коллекция КП в имени — заглавными
     ([A-Z0-9_], как TOP_250_MOVIES), поэтому ключ API lumen_kp_key и
     lumen_kp_hint под шаблон не подпадают, откуда бы имя ни пришло — из
     индекса или из перебора.
     Удаление — как у кэшей плагина (drop в src/60_reviews.js): значение
     обнуляется через Lampa.Storage.set (её кэш readed в памяти), а сам ключ
     убирается из localStorage. lumen_home_rows не переписывается: id
     снятых подборок из него и так отбрасывает LC.rows.knownIds, а запись
     сломала бы откат на 1.0.2. Повторный запуск ничего не пишет: индекса и
     ключей под шаблон уже нет. */
  var KP_CACHE = /^lumen_kpp?_[A-Z0-9_]+$/;
  var KP_INDEX = 'lumen_sources_index';

  function dropKpCache() {
    var ls = null;
    try { ls = window.localStorage || null; } catch (e) { ls = null; }
    var keys = [];
    function add(k) {
      if (typeof k === 'string' && KP_CACHE.test(k) && keys.indexOf(k) === -1) keys.push(k);
    }
    var index = Lampa.Storage.get(KP_INDEX, '');
    var i;
    if (Array.isArray(index)) for (i = 0; i < index.length; i++) add(index[i]);
    if (ls) {
      try {
        for (i = 0; i < ls.length; i++) add(ls.key(i));
      } catch (eKeys) { warn('prefs migrate: kp cache scan failed', eKeys); }
    }
    if (index !== '' && index !== null && typeof index !== 'undefined') keys.push(KP_INDEX);
    for (i = 0; i < keys.length; i++) {
      try { Lampa.Storage.set(keys[i], '', true); } catch (eSet) { }
      try { if (ls) ls.removeItem(keys[i]); } catch (eRemove) { }
    }
  }

  LC.motionModeFor = LC.prefs.motionModeFor;

  /* Настройка своя — LC.pref с дефолтом пункта из LIST (правка 2026-09-23,
     долг фазы 1, п.5: здесь стоял Lampa.Storage.field). */
  LC.motionMode = function () {
    var stored = LC.pref('lumen_motion', 'auto');
    var platform = LC.platformInfo();
    /* Task 29: вердикт автодетекта слабого ТВ. Модуль 68_perf.js держит его
       рядом с собой (Storage читается один раз за сессию), поэтому вызов на
       каждой сборке CSS не стоит ничего. Модуля может не быть только в
       тестах, где 81_prefs.js грузится в одиночку. */
    var auto = null;
    try {
      if (LC.perf && typeof LC.perf.mode === 'function') auto = LC.perf.mode();
    } catch (e3) { }
    return LC.prefs.motionModeFor(stored, platform, auto);
  };

  /* Task 40: можно ли сейчас показывать тяжёлые «украшения» — частицы,
     Ken Burns на кадре, зум заставки и кроссфейд кадров (двух полноэкранных
     слоёв) в карточке и в герое.

     Проверка на ТВ 2026-09-24: смена кадров и трейлеры (карточки и героя) —
     контент, а не украшение, и отсюда не спрашиваются: их гасит только
     режим «Выкл». До этой правки тумблер гасил и их, и на телевизоре
     (lite, тумблер выключен по умолчанию) кадры стояли, а трейлер не
     запускался.

     Два условия. Режим анимаций обязан быть полным: в 'lite' и 'off'
     украшений нет и не было, и тумблер их туда не возвращает. И сам тумблер
     обязан быть включён — по умолчанию на телевизоре он выключен
     (LC.prefs.fxHeavyDefault).

     Читается в рантайме на каждом вызове: и режим, и тумблер меняют прямо
     во время сеанса, а класс lumen-fx-heavy на body переставляет
     LC.applyMotionMode (src/90_runtime.js). */
  LC.fxHeavy = function () {
    try {
      if (LC.motionMode() !== 'full') return false;
      return !!LC.pref('lumen_fx_heavy', LC.prefs.fxHeavyDefault(LC.platformInfo()));
    } catch (e) {
      return false;
    }
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefs;

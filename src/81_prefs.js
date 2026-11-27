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
       после трёх тяжёлых экранов, которые на нём и тормозят.

       1.1: слабая приставка — это и четырёхъядерный ТВ с 2 ГБ (правило —
       LC.perf.weakInfo), и для неё 'auto' по умолчанию 'lite', а 'full' —
       только когда auto === 'full'. Для слабой приставки LC.perf.mode()
       отдаёт вердикт её собственной, более строгой лестницы (замеры
       открытия карточки), а не общий: общий 'full' («медиана трёх первых
       экранов ниже 250 мс») на таком железе полных не оправдывает. */
    function motionModeFor(stored, platform, auto) {
      if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
      if (stored !== 'auto') return stored;
      platform = platform || {};
      if (platform.tizen || platform.webos) return 'lite';
      if (platform.weak) return auto === 'full' ? 'full' : 'lite';
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

    /* v1.4 «Слабый ТВ»: платформенный дефолт — тем же приёмом, что
       fxHeavyDefault: функция в 'default' пункта LIST и тот же вызов у места
       чтения (сверку держит test/prefs.test.mjs, Task 60). Это значение
       пункта по умолчанию, а не гейт: выбор, сделанный руками, хранится в
       Storage и побеждает.
       heroMediaDefault — на слабой приставке (platform.weak,
       LC.perf.weakInfo) кадр главной по умолчанию «Только кадры»: iframe
       YouTube поверх героя там стоит дороже, чем показывает.
       lumen_rowmem_bytes платформенного дефолта больше не имеет (ревью
       1.4): выгрузка постеров меняет поведение Lampa — при сбоях сети
       ImageMirror.broken может сменить зеркало картинок, — поэтому она
       по желанию и выключена на всех ТВ. */
    function heroMediaDefault(platform) {
      return platform && platform.weak ? 'frames' : 'trailer';
    }

    /* LIST определяет только порядок и местоположение в меню Lampa.
       Заголовки и кнопки экранов значения не хранят. Существующие имена,
       значения и дефолты сохраняют связь с профилем и обработчиками.
       Описание — короткий ответ, что меняется и на каком экране. */

    var MAIN = [
      { name: 'lumen_enabled', type: 'trigger', 'default': true, label: 'lumen_card_enabled_name', descr: 'lumen_card_enabled_descr' },
      { name: 'lumen_look', type: 'button', label: 'lumen_look_name', descr: 'lumen_look_descr' },
      { name: 'lumen_home_section', type: 'button', label: 'lumen_home_section_name', descr: 'lumen_home_section_descr' },
      { name: 'lumen_film_section', type: 'button', label: 'lumen_film_section_name', descr: 'lumen_film_section_descr' },
      { name: 'lumen_watch_section', type: 'button', label: 'lumen_watch_section_name', descr: 'lumen_watch_section_descr' },
      { name: 'lumen_torrserver', type: 'button', label: 'lumen_torrserver_name', descr: 'lumen_torrserver_descr' },
      { name: 'lumen_weak', type: 'button', label: 'lumen_weak_name', descr: 'lumen_weak_descr' },
      { name: 'lumen_remote_section', type: 'button', label: 'lumen_remote_section_name', descr: 'lumen_remote_section_descr' },
      { name: 'lumen_more', type: 'button', label: 'lumen_more_name', descr: 'lumen_more_descr' },
      { name: 'lumen_whatsnew_show', type: 'button', label: 'lumen_whatsnew_show_name', descr: 'lumen_whatsnew_show_descr' }
    ];

    /* «Стиль» применяет набор параметров разом. Значение «Свой»
       отображается при ручной правке набора (styleOf, syncStyle). */

    var LOOK = [
      { name: 'lumen_group_style', type: 'title', label: 'lumen_group_style' },
      { name: 'lumen_style', type: 'select', values: ['lumen', 'appletv', 'custom'], vprefix: 'lumen_style_', 'default': 'lumen', label: 'lumen_style_name', descr: 'lumen_style_descr' },
      { name: 'lumen_flat', type: 'trigger', 'default': false, label: 'lumen_flat_name', descr: 'lumen_flat_descr' },
      { name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus', descr: 'lumen_card_menus_descr' },
      { name: 'lumen_group_color', type: 'title', label: 'lumen_group_color' },
      { name: 'lumen_theme', type: 'select', values: ['warm', 'black'], vprefix: 'lumen_theme_', 'default': 'warm', label: 'lumen_theme_name', descr: 'lumen_theme_descr' },
      { name: 'lumen_solid', type: 'trigger', 'default': false, label: 'lumen_solid_name', descr: 'lumen_solid_descr' },
      { name: 'lumen_accent_auto', type: 'trigger', 'default': true, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },
      { name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent', descr: 'lumen_card_accent_descr' },
      { name: 'lumen_accent_scope', type: 'select', values: ['full', 'veil'], vprefix: 'lumen_accent_scope_', 'default': 'full', label: 'lumen_accent_scope_name', descr: 'lumen_accent_scope_descr' },
      { name: 'lumen_group_text_tiles', type: 'title', label: 'lumen_group_text_tiles' },
      { name: 'lumen_font', type: 'select', values: ['system', 'golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },
      { name: 'lumen_scale', type: 'select', values: ['small', 'normal', 'large', 'huge'], vprefix: 'lumen_scale_', 'default': 'normal', label: 'lumen_scale_name', descr: 'lumen_scale_descr' },
      { name: 'lumen_tile_size', type: 'select', values: ['small', 'normal', 'large'], vprefix: 'lumen_tile_size_', 'default': 'normal', label: 'lumen_tile_size_name', descr: 'lumen_tile_size_descr' },
      { name: 'lumen_group_posters', type: 'title', label: 'lumen_group_posters' },
      { name: 'lumen_posters', type: 'select', values: ['lampa', 'original', 'clean'], vprefix: 'lumen_posters_', 'default': 'lampa', label: 'lumen_posters_name', descr: 'lumen_posters_descr' },
      { name: 'lumen_badges', type: 'select', values: ['poster', 'caption', 'off'], vprefix: 'lumen_badges_', 'default': 'poster', label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
      { name: 'lumen_hero_logo', type: 'trigger', 'default': true, label: 'lumen_hero_logo_name', descr: 'lumen_hero_logo_descr' },
      { name: 'lumen_group_holidays', type: 'title', label: 'lumen_group_holidays' },
      { name: 'lumen_fx', type: 'select', values: ['seasonal', 'off'], vprefix: 'lumen_fx_', 'default': 'seasonal', label: 'lumen_fx_name', descr: 'lumen_fx_descr' },
      { name: 'lumen_fx_snow', type: 'trigger', 'default': true, label: 'lumen_fx_snow_name', descr: 'lumen_fx_snow_descr' },
      { name: 'lumen_fx_garland_apple', type: 'select', values: ['rosa', 'velvet', 'velvet2', 'velvet3', 'cold', 'cold2'], vprefix: 'lumen_fx_garland_', 'default': 'rosa', label: 'lumen_fx_garland_apple_name', descr: 'lumen_fx_garland_apple_descr' },
      { name: 'lumen_fx_garland_static', type: 'trigger', 'default': false, label: 'lumen_fx_garland_static_name', descr: 'lumen_fx_garland_static_descr' },
      { name: 'lumen_group_screensaver', type: 'title', label: 'lumen_group_screensaver' },
      { name: 'lumen_ambient', type: 'trigger', 'default': false, label: 'lumen_ambient_name', descr: 'lumen_ambient_descr' },
      { name: 'lumen_ambient_source', type: 'select', values: ['curated', 'current'], vprefix: 'lumen_ambient_source_', 'default': 'curated', label: 'lumen_ambient_source_name', descr: 'lumen_ambient_source_descr' },
      { name: 'lumen_ambient_delay', type: 'select', values: ['3', '5', '10'], vsuffix: 'lumen_ambient_minutes', 'default': '3', label: 'lumen_ambient_delay_name', descr: 'lumen_ambient_delay_descr' }
    ];

    var HOME = [
      { name: 'lumen_group_hero', type: 'title', label: 'lumen_group_hero' },
      { name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },
      { name: 'lumen_hero_media', type: 'select', values: ['trailer', 'frames'], vprefix: 'lumen_hero_media_', 'default': function () { return heroMediaDefault(LC.platformInfo()); }, label: 'lumen_hero_media_name', descr: 'lumen_hero_media_descr' },
      { name: 'lumen_group_rows', type: 'title', label: 'lumen_group_rows' },
      { name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },
      { name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '10', label: 'lumen_rows_limit_name', descr: 'lumen_rows_limit_descr' },
      { name: 'lumen_home_start', type: 'select', values: ['rotate', 'history'], vprefix: 'lumen_home_start_', 'default': 'rotate', label: 'lumen_home_start_name', descr: 'lumen_home_start_descr' },
      { name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
      { name: 'lumen_rows_dedupe', type: 'trigger', 'default': true, label: 'lumen_rows_dedupe_name', descr: 'lumen_rows_dedupe_descr' },
      { name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },
      { name: 'lumen_kids', type: 'trigger', 'default': false, label: 'lumen_kids_name', descr: 'lumen_kids_descr' }
    ];

    var FILM = [
      { name: 'lumen_group_film', type: 'title', label: 'lumen_group_film' },
      { name: 'lumen_franchise', type: 'trigger', 'default': true, label: 'lumen_franchise_name', descr: 'lumen_franchise_descr' },
      { name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
      { name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr', placeholder: 'lumen_pref_unset' },
      { name: 'lumen_hide_meta', type: 'trigger', 'default': false, label: 'lumen_hide_meta_name', descr: 'lumen_hide_meta_descr' },
      { name: 'lumen_group_film_media', type: 'title', label: 'lumen_group_film_media' },
      { name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name', descr: 'lumen_card_slideshow_descr' },
      { name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval', descr: 'lumen_card_slide_interval_descr' },
      { name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' }
    ];

    var WATCH = [
      { name: 'lumen_group_continue', type: 'title', label: 'lumen_group_continue' },
      { name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },
      { name: 'lumen_cw_days', type: 'select', values: ['off', '14', '30', '90'], vprefix: 'lumen_cw_days_', 'default': '30', label: 'lumen_cw_days_name', descr: 'lumen_cw_days_descr' },
      { name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name', descr: 'lumen_card_progress_descr' },
      { name: 'lumen_group_resume', type: 'title', label: 'lumen_group_resume' },
      { name: 'lumen_resume', type: 'trigger', 'default': true, label: 'lumen_resume_name', descr: 'lumen_resume_descr' },
      { name: 'lumen_watch_ask', type: 'trigger', 'default': true, label: 'lumen_watch_ask_name', descr: 'lumen_watch_ask_descr' },
      { name: 'lumen_resume_ttl', type: 'select', values: ['2', '6', '12', '24'], vsuffix: 'lumen_resume_ttl_suffix', 'default': '6', label: 'lumen_resume_ttl_name', descr: 'lumen_resume_ttl_descr' }
    ];

    /* 1.4: «TorrServer…» — путь до плеера через TorrServer. */
    var TS = [
      /* 1.4: восемь пунктов — две группы (не больше семи строк в группе):
         экраны раздач и поиск, затем сам сервер. */
      { name: 'lumen_group_ts_view', type: 'title', label: 'lumen_group_ts_view' },
      { name: 'lumen_pins_enabled', type: 'trigger', 'default': true, label: 'lumen_pins_name', descr: 'lumen_pins_descr' },
      { name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' },
      /* 1.4: файлы сериала — фокус на серии после досмотренной
         (src/65_torrents.js). Навигация внутри оформления пути, поэтому
         включён; без «Оформления торрентов» не действует. */
      { name: 'lumen_ts_resume_focus', type: 'trigger', 'default': false, label: 'lumen_ts_resume_focus_name', descr: 'lumen_ts_resume_focus_descr' },
      /* «Запасной парсер» (src/66_parserfb.js) — основной Jackett не
         ответил или ничего не нашёл: поиск по второму адресу Lampa. */
      { name: 'lumen_parser_fallback', type: 'trigger', 'default': false, label: 'lumen_parser_fallback_name', descr: 'lumen_parser_fallback_descr' },
      { name: 'lumen_group_ts_server', type: 'title', label: 'lumen_group_ts_server' },
      /* 1.3: «Автоочистка TorrServer» (src/66_tsclean.js). По умолчанию
         ВЫКЛЮЧЕНА: плагин без спроса чужих раздач не удаляет. */
      { name: 'lumen_tsclean', type: 'trigger', 'default': false, label: 'lumen_tsclean_name', descr: 'lumen_tsclean_descr' },
      /* Срок (по умолчанию сутки — прежнее правило) и проход по кнопке. */
      { name: 'lumen_tsclean_days', type: 'select', values: ['1', '3', '7'], vprefix: 'lumen_tsclean_days_', 'default': '1', label: 'lumen_tsclean_days_name', descr: 'lumen_tsclean_days_descr' },
      { name: 'lumen_tsclean_now', type: 'button', label: 'lumen_tsclean_now_name', descr: 'lumen_tsclean_now_descr' },
      /* Точка «TorrServer не отвечает» на карточке (src/66_tshealth.js). */
      { name: 'lumen_ts_health', type: 'trigger', 'default': false, label: 'lumen_ts_health_name', descr: 'lumen_ts_health_descr' },
      /* 1.4: «Автовыбор TorrServer» (src/66_tsauto.js). По умолчанию
         ВЫКЛЮЧЕН: пишет настройку Lampa torrserver_use_link. */
      { name: 'lumen_ts_auto', type: 'trigger', 'default': false, label: 'lumen_ts_auto_name', descr: 'lumen_ts_auto_descr' }
    ];

    var WEAK = [
      { name: 'lumen_group_motion', type: 'title', label: 'lumen_group_motion' },
      { name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },
      { name: 'lumen_fx_heavy', type: 'trigger', 'default': function () { return fxHeavyDefault(LC.platformInfo()); }, label: 'lumen_fx_heavy_name', descr: 'lumen_fx_heavy_descr' },
      { name: 'lumen_group_memory', type: 'title', label: 'lumen_group_memory' },
      { name: 'lumen_rowmem', type: 'trigger', 'default': true, label: 'lumen_rowmem_name', descr: 'lumen_rowmem_descr' },
      { name: 'lumen_rowmem_bytes', type: 'trigger', 'default': false, label: 'lumen_rowmem_bytes_name', descr: 'lumen_rowmem_bytes_descr' },
      { name: 'lumen_netmem', type: 'trigger', 'default': true, label: 'lumen_netmem_name', descr: 'lumen_netmem_descr' },
      { name: 'lumen_prefill', type: 'trigger', 'default': true, label: 'lumen_prefill_name', descr: 'lumen_prefill_descr' }
    ];

    var REMOTE = [
      { name: 'lumen_group_remote', type: 'title', label: 'lumen_group_remote' },
      { name: 'lumen_context_menu', type: 'trigger', 'default': true, label: 'lumen_context_menu_name', descr: 'lumen_context_menu_descr' },
      { name: 'lumen_remote_boost', type: 'trigger', 'default': true, label: 'lumen_remote_boost_name', descr: 'lumen_remote_boost_descr' },
      { name: 'lumen_group_head', type: 'title', label: 'lumen_group_head' },
      { name: 'lumen_hide_shots', type: 'trigger', 'default': false, label: 'lumen_hide_shots_name', descr: 'lumen_hide_shots_descr' },
      { name: 'lumen_hide_head_icons', type: 'trigger', 'default': false, label: 'lumen_hide_head_icons_name', descr: 'lumen_hide_head_icons_descr' },
      { name: 'lumen_group_windows', type: 'title', label: 'lumen_group_windows' },
      { name: 'lumen_whatsnew', type: 'trigger', 'default': true, label: 'lumen_whatsnew_name', descr: 'lumen_whatsnew_descr' }
    ];

    var MORE = [
      { name: 'lumen_group_dev', type: 'title', label: 'lumen_group_dev' },
      { name: 'lumen_dev_date', type: 'select', values: ['off', '1201', '1205', '1224', '1231', '0101'], vprefix: 'lumen_dev_date_', 'default': 'off', label: 'lumen_dev_date_name', descr: 'lumen_dev_date_descr' },
      { name: 'lumen_debug_hud', type: 'trigger', 'default': false, label: 'lumen_debug_hud_name', descr: 'lumen_debug_hud_descr' },
      { name: 'lumen_debug_bench', type: 'button', label: 'lumen_debug_bench_name', descr: 'lumen_debug_bench_descr' },
      { name: 'lumen_region_unblock', type: 'trigger', 'default': false, label: 'lumen_region_unblock_name', descr: 'lumen_region_unblock_descr' },
      { name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr', placeholder: 'lumen_pref_default_catalog' }
    ];

    /* Компонент экрана — PLUGIN + '_' + section. Стабильные имена
       look, torrserver, weak и more продолжают открывать тот же компонент. */
    var SECTIONS = {
      look: 'lumen_look',
      home: 'lumen_home_section',
      film: 'lumen_film_section',
      watch: 'lumen_watch_section',
      torrserver: 'lumen_torrserver',
      weak: 'lumen_weak',
      remote: 'lumen_remote_section',
      more: 'lumen_more'
    };

    function mark(list, section) {
      for (var j = 0; j < list.length; j++) list[j].section = section;
      return list;
    }

    var LIST = MAIN.concat(mark(LOOK, 'look'), mark(HOME, 'home'), mark(FILM, 'film'),
      mark(WATCH, 'watch'), mark(TS, 'torrserver'), mark(WEAK, 'weak'), mark(REMOTE, 'remote'), mark(MORE, 'more'));

    /* 1.0.2: слитые пункты — новый ключ и старые, которые он заменил.
       Старый ключ, сохранённый выключенным, дочитывается местом чтения
       (lumen_franchise И lumen_franchise_row и т. д.), пока человек не
       тронет новый пункт: тогда старые получают его значение (mergedOn
       ниже; releaseMerged, src/80_settings.js), и дальше решает новый
       пункт. Однозначные случаи LC.migratePrefs переводит сразу.

       1.4 (аудит 1.3.1, пункт про наследие 1.0.1): ветки чтения старых
       ключей ОСТАВЛЕНЫ. Окончательной миграции «у всех» не бывает:
       частичный выбор (выключена кнопка «Франшиза», ряд — нет; выключена
       одна из двух частей «Ускорителей пульта») перевести не во что — он
       живёт в старом ключе, пока человек не тронет новый пункт, и снятие
       веток молча включило бы выключенное. Плюс откат на 1.0.1 читает
       только старые ключи. Сколько профилей ещё держат частичный выбор,
       узнать неоткуда (у плагина нет телеметрии), поэтому удаление — не
       раньше, чем будет решено отдать эти профили на значения по
       умолчанию.

       1.4: «Логотип названия» (lumen_hero_logo) — одна строка на оба
       логотипа. Карточка по-прежнему читает только lumen_card_logo
       (src/85_header.js): прежний раздельный выбор остаётся в силе, пока
       пункт не тронут, а правка пишет то же значение и в старый ключ. */
    var MERGED = {
      lumen_font: ['lumen_card_fonts'],
      lumen_hero_media: ['lumen_hero_trailer'],
      lumen_franchise: ['lumen_franchise_button', 'lumen_franchise_row'],
      lumen_remote_boost: ['lumen_minimap', 'lumen_fastscroll'],
      lumen_hero_logo: ['lumen_card_logo'],
      /* 1.4: «Серия в «Досмотреть»» убрана из раздела — правка «Меток на
         постерах» пишет и её ключ (src/62_badges.js читает его). */
      lumen_badges: ['lumen_next_ep_badge']
    };

    /* Ревью 1.0.2: значение старых ключей, которое отвечает значению нового
       пункта. 1.0.1 читает только старые ключи, поэтому откат на неё
       обязан видеть тот же выбор: «Шрифт: Как в Lampa» — фирменные шрифты
       выключены, «Только кадры» — автотрейлер выключен, выключенные
       «Франшизы» и «Ускорители пульта» — обе части выключены. */
    function mergedOn(name, value) {
      if (name === 'lumen_font') return value !== 'system';
      if (name === 'lumen_hero_media') return value !== 'frames';
      if (name === 'lumen_badges') return badgesMode(value) !== 'off';
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
      heroMediaDefault: heroMediaDefault,
      PRESET_KEYS: PRESET_KEYS, presetValues: presetValues, styleOf: styleOf, MERGED: MERGED, mergedOn: mergedOn,
      SECTIONS: SECTIONS,
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

  /* 1.1: режим анимаций с причиной — строкой для HUD (src/69_hud.js):
       «set:lite» — выбран руками, «Авто» не участвует;
       «auto:lite (webos)» / «auto:lite (tizen)» — платформа;
       «auto:lite (weak 4c/n/a tvbox, cards 2/5)» — слабая приставка и
         ход её лестницы, прочие причины — LC.perf.why (src/68_perf.js). */
  LC.motionWhy = function () {
    var mode = LC.motionMode();
    var stored = LC.pref('lumen_motion', 'auto');
    if (stored === 'full' || stored === 'lite' || stored === 'off') return 'set:' + mode;
    var platform = LC.platformInfo();
    var reason = platform.tizen ? 'tizen' : (platform.webos ? 'webos' : '');
    if (!reason) {
      try {
        if (LC.perf && typeof LC.perf.why === 'function') reason = LC.perf.why();
      } catch (e) { }
    }
    return 'auto:' + mode + (reason ? ' (' + reason + ')' : '');
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

  /* 1.4: пункт, который в текущем режиме ничего не меняет, — ключ строки
     причины (LC.STRINGS) или ''. Строку раздела помечает «не действует»
     src/80_settings.js (markIdle). Условия — те же, что у мест чтения:
       lumen_accent_scope — LC.accentScope выше: без «Цвета фона от кадра»
         всегда 'full'; в плоском виде цвета кадра нет вовсе (как у
         lumen_accent_auto ниже);
       lumen_accent_auto — плоский вид (стиль Apple TV): theme() и palette()
         в src/30_css.js цвет кадра не читают; в режиме «Выкл» подкраски нет
         вовсе (motionOn, src/57_color.js);
       lumen_fx_heavy — LC.fxHeavy выше: только при полных анимациях;
       lumen_moods — чипы встают только без кадра над рядами
         (src/49_moods.js, LC.moods.mount по узлу героя);
       lumen_ts_resume_focus — фокус ставит наш экран раздач
         (src/65_torrents.js): при выключенном lumen_torrents его нет;
       lumen_ts_auto — выбирать не из чего без второго адреса Lampa
         (torrserver_url_two, src/66_tsauto.js). */
  LC.prefIdle = function (name) {
    try {
      if (name === 'lumen_accent_scope') {
        if (LC.pref('lumen_flat', false)) return 'lumen_idle_flat';
        return LC.pref('lumen_accent_auto', true) ? '' : 'lumen_idle_need_auto';
      }
      if (name === 'lumen_ts_resume_focus') return LC.pref('lumen_torrents', true) ? '' : 'lumen_idle_need_torrents';
      if (name === 'lumen_ts_auto') {
        var two = window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function' ? Lampa.Storage.get('torrserver_url_two', '') : '';
        return two && String(two).replace(/^\s+|\s+$/g, '') ? '' : 'lumen_idle_need_ts_two';
      }
      if (name === 'lumen_accent_auto') {
        if (LC.pref('lumen_flat', false)) return 'lumen_idle_flat';
        return LC.motionMode() === 'off' ? 'lumen_idle_motion_off' : '';
      }
      if (name === 'lumen_fx_garland_static') {
        if (LC.pref('lumen_fx', 'seasonal') === 'off') return 'lumen_idle_garland_fx_off';
        return LC.motionMode() === 'off' ? '' : 'lumen_idle_garland_motion';
      }
      if (name === 'lumen_fx_snow') return LC.pref('lumen_fx', 'seasonal') === 'off' ? 'lumen_idle_garland_fx_off' : '';
      if (name === 'lumen_fx_heavy') return LC.motionMode() === 'full' ? '' : 'lumen_idle_need_full';
      if (name === 'lumen_moods') return LC.pref('lumen_hero_size', 'large') === 'off' ? '' : 'lumen_idle_need_no_hero';
    } catch (e) { }
    return '';
  };

  /* Какие пункты зависят от какого: правка ключа слева перерисовывает
     пометку у пунктов справа, если они на открытом экране. */
  LC.prefIdleDeps = {
    lumen_accent_auto: ['lumen_accent_scope'],
    lumen_flat: ['lumen_accent_auto', 'lumen_accent_scope'],
    lumen_torrents: ['lumen_ts_resume_focus'],
    lumen_style: ['lumen_accent_auto', 'lumen_accent_scope'],
    lumen_motion: ['lumen_accent_auto', 'lumen_fx_heavy', 'lumen_fx_garland_static'],
    lumen_fx: ['lumen_fx_snow', 'lumen_fx_garland_static'],
    lumen_hero_size: ['lumen_moods'],
    /* Адрес Lampa, не наш пункт: правку им мы не слышим — пометка
       обновляется при следующем открытии экрана. Строка здесь, чтобы у
       пункта была пометка вовсе (idleCapable, src/80_settings.js). */
    torrserver_url_two: ['lumen_ts_auto']
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefs;

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

    /* stored — сырое значение параметра lumen_motion ('auto'|'full'|'lite'|'off'),
       platform — {tizen:bool, webos:bool}, auto — вердикт автодетекта
       ('lite' | 'full' | null, src/68_perf.js). Не 'auto' -> как есть;
       'auto' на tizen/webos -> 'lite', иначе решает вердикт замеров. Любое
       незнакомое значение stored (undefined/null/''/мусор — старый профиль без
       ключа или битое значение в Storage) считается как 'auto', а не
       возвращается как есть.

       Task 29 (фаза 3): вердикт умеет только ПОНИЖАТЬ. 'full' от автодетекта
       означает «понижать не за что», а не «поднять выше платформенного lite»:
       на Tizen/webOS полные анимации остаются выключенными, даже если замеры
       там вышли быстрыми (там их и не делают — LC.perf.shouldMeasure). */
    function motionModeFor(stored, platform, auto) {
      if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
      if (stored !== 'auto') return stored;
      platform = platform || {};
      if (platform.tizen || platform.webos) return 'lite';
      if (auto === 'lite') return 'lite';
      return 'full';
    }

    /* Раздел «Lumen Card» целиком, в порядке экрана 09 дизайна:
       Включить · Акцент · Анимации · Слайдшоу кадров · Интервал смены кадра ·
       Трейлер в фоне · Актёры в карточке · Отзывы Кинопоиска · Ключ Kinopoisk API.

       Настроек, которых на экране 09 нет (шрифты, «Продолжить», оформление
       меню, экраны TorrServer), дизайн не отменяет — они разложены по
       группам так, чтобы относительный порядок экранных пунктов не менялся.
       Заголовок группы — штатный параметр Lampa type:'title' (app.min.js,
       addParams: <div class="settings-param-title">), он ничего не хранит и
       не имеет onChange.

       Имена ключей НЕ переименовываются (таблица плана с lumen_accent/
       lumen_fonts/lumen_cast устарела — решение контроллера): профили
       пользователей уже живут с этими именами. Отсюда и смесь префиксов:
       часть ключей с lumen_card_, часть без — LC.followStorage разбирает их
       отдельными ветками.

       label/descr — ключи LC.STRINGS (80_settings.js). У select значения
       перечислены ключами, подпись каждого собирается как vprefix + значение
       (или «значение + vsuffix» у интервала: «14 с»). */
    var LIST = [
      { name: 'lumen_enabled', type: 'trigger', 'default': true, label: 'lumen_card_enabled_name', descr: 'lumen_card_enabled_descr' },

      { name: 'lumen_group_look', type: 'title', label: 'lumen_card_group_look' },
      /* Фаза 3: девять акцентов вместо четырёх (палитра и замеры контраста —
         ACCENTS в src/30_css.js). Порядок — по цветовому кругу: тёплые, потом
         зелёные и холодные, нейтральный графит последним. Значение по
         умолчанию не менялось. */
      { name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent' },
      /* Task 24 (фаза 3): акцент от постера открытого фильма — сразу под
         выбором акцента: он тот же выбор, только его делает фильм. Выключен
         по умолчанию, и при выключении карточка возвращается к цвету из
         пункта выше (src/57_color.js). */
      { name: 'lumen_accent_auto', type: 'trigger', 'default': false, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },
      /* Фаза 3: тема и плотность подложек — ДВА пункта, а не один список из
         трёх вариантов. Они отвечают на разные вопросы: тема — про цвет
         тёмного (тёплый или настоящий чёрный для OLED), плотность — про то,
         просвечивает ли кадр сквозь карты (на части ТВ полупрозрачность мылит
         и тормозит). Слитый список отнял бы у владельца OLED плотные подложки,
         а у владельца слабого ТВ — чёрный фон: комбинации нужны все четыре. */
      { name: 'lumen_theme', type: 'select', values: ['warm', 'black'], vprefix: 'lumen_theme_', 'default': 'warm', label: 'lumen_theme_name', descr: 'lumen_theme_descr' },
      { name: 'lumen_solid', type: 'trigger', 'default': false, label: 'lumen_solid_name', descr: 'lumen_solid_descr' },
      /* Фаза 3: масштаб интерфейса плагина — коэффициент на корнях (SCALES в
         src/30_css.js). На ТВ с трёх метров то, что в браузере выглядит
         нормально, часто мелко. */
      { name: 'lumen_scale', type: 'select', values: ['small', 'normal', 'large', 'huge'], vprefix: 'lumen_scale_', 'default': 'normal', label: 'lumen_scale_name', descr: 'lumen_scale_descr' },
      { name: 'lumen_card_fonts', type: 'trigger', 'default': true, label: 'lumen_card_fonts_name', descr: 'lumen_card_fonts_descr' },
      /* Правка пользователя 2026-09-16 (п.6): выбор гарнитуры — сразу за
         выключателем шрифтов: при выключенных шрифтах он не действует, и
         рядом это очевиднее всего. Пять пар «текст + моно», все с Google
         Fonts (CSP плагина другого источника не пропустит), набор — в
         FONT_SETS (src/30_css.js). */
      { name: 'lumen_font', type: 'select', values: ['golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },
      { name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },
      /* Task 29 (фаза 3): переход «постер → кадр» при открытии карточки.
         Место — сразу под режимом анимаций: переход ему подчиняется (в
         «Лёгких» и «Выкл» его нет вовсе), и выключать его отдельно имеет
         смысл только тому, кто полные анимации оставил. */
      { name: 'lumen_transition', type: 'trigger', 'default': true, label: 'lumen_transition_name', descr: 'lumen_transition_descr' },

      { name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
      { name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name' },
      { name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval' },
      { name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

      { name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },
      { name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name' },
      /* Правка пользователя 2026-09-16 (п.1): пункт «Показывать актёров» убран
         вместе с блоком, которым он управлял, — кружки инициалов дублировали
         ряд актёров, который Lampa рисует ниже по экрану. */
      { name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
      { name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr' },
      /* Task 20 (решение координатора): подсказка «Ключ API не задан» в
         карточке и в сетке подборки Кинопоиска убирается кнопкой «Скрыть»
         прямо на экране, а возвращается этим переключателем — рядом с самим
         полем ключа, где её и ищут. */
      { name: 'lumen_kp_hint', type: 'trigger', 'default': true, label: 'lumen_kp_hint_name', descr: 'lumen_kp_hint_descr' },

      { name: 'lumen_group_path', type: 'title', label: 'lumen_card_group_path' },
      { name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus' },
      { name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' },

      /* Task 20 (фаза 2): всё про главную и подборки — одной группой и в
         порядке экрана сверху вниз: чипы настроения и персональные ряды
         (верх главной), затем состав и число рядов подборок, фильтр
         досмотренного и, последним, адрес каталога — настройка «на один раз».
         Каждый пункт применяется на лету (src/80_settings.js,
         applyPrefChange): возврат из настроек Lampa экран не перерисовывает. */
      { name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },
      /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами — первым
         пунктом группы: это самое крупное решение про вид главной, и от него
         зависит, сколько экрана достанется всему остальному. Доли экрана — в
         HERO_SIZES (src/30_css.js). */
      { name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },
      { name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
      { name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },
      /* Кнопка-параметр: multi-select в SettingsApi нет, поэтому состав рядов
         выбирается на экране Lampa.Select с чекбоксами (src/80_settings.js,
         openHomeRows). Значение хранится строкой id через запятую в
         lumen_home_rows — его читает LC.rows.register. */
      { name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },
      { name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '15', label: 'lumen_rows_limit_name' },
      /* Task 25 (фаза 3): метки на постерах рядов («Скоро», «Новинка»,
         «Продолжить», новые серии). Место в группе — рядом с составом рядов:
         речь о том же экране. Применение на лету — LC.applyBadgesPref. */
      { name: 'lumen_badges', type: 'trigger', 'default': true, label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
      /* Task 26 (фаза 3): пункты плагина в меню карточки по удержанию OK.
         Место — рядом с метками: речь о тех же постерах рядов и сеток.
         Включено по умолчанию — жест штатный, меню штатное, мы лишь
         дописываем пункты. Применение на лету — LC.applyCardmenuPref. */
      { name: 'lumen_context_menu', type: 'trigger', 'default': true, label: 'lumen_context_menu_name', descr: 'lumen_context_menu_descr' },
      /* Task 27 (фаза 3): навигационные ускорители. Обе настройки — про то
         же движение по рядам главной и сеток, поэтому стоят здесь же.
         Включены по умолчанию: мини-карта только показывает, ускорение
         работает лишь при удержании, то есть обычная навигация ни на шаг не
         меняется. Применение на лету — LC.applyNavPref. */
      { name: 'lumen_minimap', type: 'trigger', 'default': true, label: 'lumen_minimap_name', descr: 'lumen_minimap_descr' },
      { name: 'lumen_fastscroll', type: 'trigger', 'default': true, label: 'lumen_fastscroll_name', descr: 'lumen_fastscroll_descr' },
      { name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },
      /* Тип input: Lampa рисует текстовое поле (как lumen_kp_key). Пусто —
         адрес по умолчанию из LC.MANIFEST_URL (src/00_head.js). */
      { name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr' }
    ];

    function find(name) {
      if (!name) return null;
      for (var i = 0; i < LIST.length; i++) if (LIST[i].name === name) return LIST[i];
      return null;
    }

    return { LIST: LIST, find: find, boolOf: boolOf, motionModeFor: motionModeFor };
  })();

  /* Читает настройку плагина из Lampa.Storage с нормализацией булевых. */
  LC.pref = function (name, def) {
    var value;
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') {
        value = Lampa.Storage.get(name, def);
      }
    } catch (e) {
      warn('storage read failed: ' + name, e);
    }
    if (typeof value === 'undefined' || value === null || value === '') return def;
    if (typeof def === 'boolean') return LC.prefs.boolOf(value, def);
    return value;
  };

  /* Task 10: главный выключатель. Выключенный плагин возвращает штатный
     шаблон карточки и снимает всё своё оформление (LC.applyEnabledPref,
     90_runtime.js), поэтому его читают и рантайм, и генератор CSS. */
  LC.enabled = function () {
    return LC.pref('lumen_enabled', true);
  };

  LC.motionModeFor = LC.prefs.motionModeFor;

  LC.motionMode = function () {
    var stored = 'auto';
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') stored = Lampa.Storage.field('lumen_motion');
    } catch (e) { }
    var platform = { tizen: false, webos: false };
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
        platform.tizen = !!Lampa.Platform.is('tizen');
        platform.webos = !!Lampa.Platform.is('webos');
      }
    } catch (e2) { }
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

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefs;

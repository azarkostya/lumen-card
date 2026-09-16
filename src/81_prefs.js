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
       platform — {tizen:bool, webos:bool}. Не 'auto' -> как есть; 'auto' на
       tizen/webos -> 'lite', иначе 'full'. Любое незнакомое значение
       (undefined/null/''/мусор — старый профиль без ключа или битое значение в
       Storage) считается как 'auto', а не возвращается как есть. */
    function motionModeFor(stored, platform) {
      if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
      if (stored !== 'auto') return stored;
      platform = platform || {};
      if (platform.tizen || platform.webos) return 'lite';
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
      { name: 'lumen_card_accent', type: 'select', values: ['sand', 'ice', 'wine', 'mint'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent' },
      { name: 'lumen_card_fonts', type: 'trigger', 'default': true, label: 'lumen_card_fonts_name', descr: 'lumen_card_fonts_descr' },
      { name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },

      { name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
      { name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name' },
      { name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval' },
      { name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

      { name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },
      { name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name' },
      { name: 'lumen_card_cast', type: 'trigger', 'default': true, label: 'lumen_card_cast_name' },
      { name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
      { name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr' },

      { name: 'lumen_group_path', type: 'title', label: 'lumen_card_group_path' },
      { name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus' },
      { name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' },

      /* Task 14 (фаза 2): URL внешнего манифеста подборок. Пусто → встроенный.
         Тип input: Lampa рисует текстовое поле (как lumen_kp_key). */
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
    return LC.prefs.motionModeFor(stored, platform);
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.prefs;

  /* -------------------------------------------------------------------- */
  /* Настройки и локализация.                                             */
  /* -------------------------------------------------------------------- */

  LC.STRINGS = {
    lumen_card_title: { ru: 'Lumen Card', en: 'Lumen Card', uk: 'Lumen Card' },
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
    lumen_card_motion_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    lumen_card_motion_full: { ru: 'Полные', en: 'Full', uk: 'Повні' },
    lumen_card_motion_lite: { ru: 'Лёгкие', en: 'Light', uk: 'Легкі' },
    lumen_card_motion_off: { ru: 'Выкл', en: 'Off', uk: 'Викл' },
    lumen_card_continue: { ru: 'ПРОДОЛЖИТЬ', en: 'CONTINUE', uk: 'ПРОДОВЖИТИ' },
    lumen_card_cast: { ru: 'В ролях', en: 'Cast', uk: 'У ролях' },
    lumen_card_serial: { ru: 'СЕРИАЛ', en: 'SERIES', uk: 'СЕРІАЛ' },
    lumen_card_min: { ru: 'мин', en: 'min', uk: 'хв' }
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
    if (typeof def === 'boolean') {
      if (value === 'true' || value === true || value === 1 || value === '1') return true;
      if (value === 'false' || value === false || value === 0 || value === '0') return false;
      return def;
    }
    return value;
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

  LC.addSettings = function () {
    try {
      if (!window.Lampa || !Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function') return;

      Lampa.SettingsApi.addComponent({
        component: PLUGIN,
        icon: ICON,
        name: LC.lang('lumen_card_title')
      });

      var accentValues = {
        sand: LC.lang('lumen_card_accent_sand'),
        ice: LC.lang('lumen_card_accent_ice'),
        wine: LC.lang('lumen_card_accent_wine'),
        mint: LC.lang('lumen_card_accent_mint')
      };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_accent', type: 'select', values: accentValues, 'default': 'sand' },
        field: { name: LC.lang('lumen_card_accent') },
        onChange: function () { LC.injectCss(); }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_fonts', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_fonts_name'), description: LC.lang('lumen_card_fonts_descr') },
        onChange: function () { LC.injectFonts(); LC.injectCss(); }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_progress', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_progress_name') }
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_cast', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_cast_name') }
      });

      var motionValues = {
        auto: LC.lang('lumen_card_motion_auto'),
        full: LC.lang('lumen_card_motion_full'),
        lite: LC.lang('lumen_card_motion_lite'),
        off: LC.lang('lumen_card_motion_off')
      };

      /* Имя параметра — 'lumen_motion' (без префикса lumen_card_): так задано планом Task 4
         (Lampa.Storage.field('lumen_motion') в LC.motionMode). LC.followStorage ниже подписан
         на него отдельной веткой, вне общего префиксного фильтра PLUGIN + '_'. */
      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_motion', type: 'select', values: motionValues, 'default': 'auto' },
        field: { name: LC.lang('lumen_card_motion') },
        onChange: function () { LC.applyMotionMode(); }
      });
    } catch (e) {
      warn('settings failed', e);
    }
  };

  LC.followStorage = function () {
    try {
      if (!window.Lampa || !Lampa.Storage || !Lampa.Storage.listener) return;
      Lampa.Storage.listener.follow('change', function (e) {
        if (!e || !e.name) return;
        if (e.name === 'lumen_motion') { LC.applyMotionMode(); return; }
        if (e.name.indexOf(PLUGIN + '_') !== 0) return;
        if (e.name === PLUGIN + '_fonts') LC.injectFonts();
        LC.injectCss();
      });
    } catch (err) {
      warn('storage listener failed', err);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Task 4: режим анимаций. Чистая логика выбора — тестируется отдельно   */
  /* от Lampa (test/settings.test.mjs); применение класса на DOM карточки  */
  /* живёт в 90_runtime.js (LC.applyMotionMode ссылается сюда извне).      */
  /* -------------------------------------------------------------------- */

  /* stored — сырое значение параметра lumen_motion ('auto'|'full'|'lite'|'off'),
     platform — {tizen:bool, webos:bool}. Не 'auto' -> как есть; 'auto' на tizen/webos -> 'lite',
     иначе 'full'. Любое незнакомое значение (undefined/null/''/мусор — например, старый профиль
     без этого ключа или битое значение в Storage) считается как 'auto', а не возвращается как есть. */
  LC.motionModeFor = function (stored, platform) {
    if (stored !== 'full' && stored !== 'lite' && stored !== 'off') stored = 'auto';
    if (stored !== 'auto') return stored;
    platform = platform || {};
    if (platform.tizen || platform.webos) return 'lite';
    return 'full';
  };

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
    return LC.motionModeFor(stored, platform);
  };

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.motionModeFor;

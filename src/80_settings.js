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
    lumen_card_trailer_badge: { ru: 'ТРЕЙЛЕР · БЕЗ ЗВУКА', en: 'TRAILER · MUTED', uk: 'ТРЕЙЛЕР · БЕЗ ЗВУКУ' }
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

  /* Lampa в Storage.set сначала шлёт listener 'change' (его ловит
     LC.followStorage ниже), а потом вызывает onChange параметра — без этой
     обёртки каждое изменение из меню применялось бы дважды (2× buildCss и
     css() пути, два toggle). onChange остаётся запасным путём, если подписка
     на Storage не удалась (LC.storageFollowed не выставлен). */
  function onlyWithoutStorage(fn) {
    return function () {
      if (!LC.storageFollowed) fn();
    };
  }

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
        onChange: onlyWithoutStorage(function () { LC.injectCss(); })
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_fonts', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_fonts_name'), description: LC.lang('lumen_card_fonts_descr') },
        onChange: onlyWithoutStorage(function () { LC.injectFonts(); LC.injectCss(); })
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: PLUGIN + '_progress', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_progress_name') },
        onChange: onlyWithoutStorage(function () { LC.applyProgressPref(); })
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
        onChange: onlyWithoutStorage(function () { LC.applyMotionMode(); })
      });

      /* Task 6: имена без префикса PLUGIN, как у lumen_motion выше —
         LC.followStorage подписан на них отдельной веткой, вне общего
         префиксного фильтра PLUGIN + '_'. onChange у обоих — одна и та же
         LC.applySlideshowPref (90_runtime.js): и выключение, и смена
         интервала на уже открытой карточке идут через pause()+resume()
         контроллера слайдшоу. */
      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_slideshow', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_slideshow_name') },
        onChange: onlyWithoutStorage(function () { LC.applySlideshowPref(); })
      });

      var seconds = LC.lang('lumen_card_seconds');
      var intervalValues = { '8': '8 ' + seconds, '14': '14 ' + seconds, '20': '20 ' + seconds };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_slide_interval', type: 'select', values: intervalValues, 'default': '14' },
        field: { name: LC.lang('lumen_card_slide_interval') },
        onChange: onlyWithoutStorage(function () { LC.applySlideshowPref(); })
      });

      /* Task 31: имена без префикса PLUGIN, как у lumen_motion — отдельные
         ветки в LC.followStorage. Применение — LC.applyMenusPref/
         LC.applyTorrentsPref (90_runtime.js), без перезагрузки. */
      var menusValues = {
        all: LC.lang('lumen_card_menus_all'),
        path: LC.lang('lumen_card_menus_path'),
        off: LC.lang('lumen_card_menus_off')
      };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_menus', type: 'select', values: menusValues, 'default': 'all' },
        field: { name: LC.lang('lumen_card_menus') },
        onChange: onlyWithoutStorage(function () { LC.applyMenusPref(); })
      });

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_torrents', type: 'trigger', 'default': true },
        field: { name: LC.lang('lumen_card_torrents_name') },
        onChange: onlyWithoutStorage(function () { LC.applyTorrentsPref(); })
      });

      /* Task 7: имя без префикса PLUGIN, как у lumen_motion/lumen_slideshow —
         отдельная ветка в LC.followStorage. Выключение на открытой карточке
         снимает уже играющий трейлер (LC.applyTrailerPref в 90_runtime.js);
         включение на лету трейлер не запускает — он стартует при следующем
         открытии карточки (отсчёт 3 с идёт от complite). */
      var trailerValues = {
        auto: LC.lang('lumen_card_trailer_auto'),
        on: LC.lang('lumen_card_trailer_on'),
        off: LC.lang('lumen_card_trailer_off')
      };

      Lampa.SettingsApi.addParam({
        component: PLUGIN,
        param: { name: 'lumen_trailer', type: 'select', values: trailerValues, 'default': 'auto' },
        field: { name: LC.lang('lumen_card_trailer'), description: LC.lang('lumen_card_trailer_descr') },
        onChange: onlyWithoutStorage(function () { LC.applyTrailerPref(); })
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
        if (e.name === 'lumen_slideshow' || e.name === 'lumen_slide_interval') { LC.applySlideshowPref(); return; }
        if (e.name === 'lumen_menus') { LC.applyMenusPref(); return; }
        if (e.name === 'lumen_torrents') { LC.applyTorrentsPref(); return; }
        if (e.name === 'lumen_trailer') { LC.applyTrailerPref(); return; }
        if (e.name.indexOf(PLUGIN + '_') !== 0) return;
        if (e.name === PLUGIN + '_fonts') LC.injectFonts();
        /* Ревью Task 8 (п.3): классы и CSS-переменную подписи кнопки ставит
           рендер, а не таблица стилей — одного injectCss() здесь мало. */
        if (e.name === PLUGIN + '_progress') LC.applyProgressPref();
        LC.injectCss();
      });
      LC.storageFollowed = true;
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

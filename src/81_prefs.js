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

    /* Раздел «Lumen Card» целиком, в порядке экрана 09 дизайна:
       Включить · Акцент · Анимации · Слайдшоу кадров · Интервал смены кадра ·
       Трейлер в фоне · Актёры в карточке · Отзывы Кинопоиска · Ключ Kinopoisk API.

       Настроек, которых на экране 09 нет (шрифты, «Продолжить», оформление
       меню, экраны TorrServer), дизайн не отменяет — они разложены по
       группам так, чтобы относительный порядок экранных пунктов не менялся.
       Заголовок группы — штатный параметр Lampa type:'title' (app.min.js,
       addParams: <div class="settings-param-title">), он ничего не хранит и
       не имеет onChange.

       Task 30 (финал фазы 3), поправка Task 57 (фаза 5): пунктов сейчас 40
       (плюс десять строк-заголовков), и раскладка по десяти группам —
       единственное, что делает их обозримыми с дивана. Группа отвечает на
       вопрос «про что это»:
         Оформление ........ как плагин выглядит (цвет, тема, размер, шрифт)
         Движение .......... что и как двигается (анимации, переход, атмосферы)
         Фон карточки ...... что показывает кадр за текстом карточки
         Блоки карточки .... какие блоки в ней есть и что им нужно
         Главная ........... верх главной: кадр, трейлер, чипы, личные ряды
         Ряды подборок ..... состав, число и вид рядов плюс адрес каталога
         Навигация ......... что делают кнопки пульта
         Рулетка ........... с чем открывается экран «Что посмотреть»
         Заставка .......... что происходит, когда пульт отложили
         Меню и плеер ...... оформление штатных окон на пути к плееру
       Внутри группы — не больше девяти пунктов: столько строк раздела видно
       на экране ТВ без прокрутки. Порядок групп — от того, что меняют чаще,
       к тому, что настраивают один раз.

       У КАЖДОГО пункта есть и label, и descr: пульт в руках, экран в трёх
       метрах, и название без пояснения оставляет человека гадать, что
       случится (проверяется test/prefs.test.mjs). В описании — что делает
       настройка и когда применяется.

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
      { name: 'lumen_card_accent', type: 'select', values: ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'], vprefix: 'lumen_card_accent_', 'default': 'sand', label: 'lumen_card_accent', descr: 'lumen_card_accent_descr' },
      /* Task 24 (фаза 3): акцент от постера открытого фильма — сразу под
         выбором акцента: он тот же выбор, только его делает фильм. При
         выключении карточка возвращается к цвету из пункта выше
         (src/57_color.js).
         Task 35 (фаза 4): включён по умолчанию. На телевизоре это
         единственная видимая связь подложки рядов с кадром — выключенной её
         просто не находят, — а цена смены цвета снижена до одного маленького
         <style id="lumen-accent"> вместо пересборки всей таблицы. */
      { name: 'lumen_accent_auto', type: 'trigger', 'default': true, label: 'lumen_accent_auto_name', descr: 'lumen_accent_auto_descr' },
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
      /* Выбор гарнитуры — сразу за выключателем шрифтов: при выключенных
         шрифтах он не действует, и рядом это очевиднее всего. Пять
         гарнитур, все с Google Fonts (CSP плагина другого источника не
         пропустит), набор — в FONT_SETS (src/30_css.js). Task 43: за каждым
         ключом стоит одна гарнитура, прежде была пара «текст + моно». */
      { name: 'lumen_font', type: 'select', values: ['golos', 'onest', 'manrope', 'inter', 'plex'], vprefix: 'lumen_card_font_', 'default': 'golos', label: 'lumen_card_font_name', descr: 'lumen_card_font_descr' },

      /* Task 30 (финал фазы 3): движение — своя группа, а не хвост
         «Оформления». Три пункта связаны одной зависимостью: и переход, и
         атмосферы живут ТОЛЬКО при полных анимациях, и рядом с режимом
         анимаций это видно сразу — иначе человек выключает анимации и не
         понимает, куда делись снег и разворот постера. */
      { name: 'lumen_group_motion', type: 'title', label: 'lumen_group_motion' },
      { name: 'lumen_motion', type: 'select', values: ['auto', 'full', 'lite', 'off'], vprefix: 'lumen_card_motion_', 'default': 'auto', label: 'lumen_card_motion', descr: 'lumen_card_motion_descr' },
      /* Task 40 (фаза 4): тяжёлые «украшения» одним тумблером — сразу под
         режимом анимаций, которому они подчинены (при lite/off их нет вовсе,
         см. LC.fxHeavy). Значение по умолчанию считается по платформе, а не
         зашито: 'default' здесь ФУНКЦИЯ, и addPrefParam (src/80_settings.js)
         зовёт её в момент регистрации раздела, когда Lampa.Platform уже
         поднята. */
      { name: 'lumen_fx_heavy', type: 'trigger', 'default': function () { return fxHeavyDefault(LC.platformInfo()); }, label: 'lumen_fx_heavy_name', descr: 'lumen_fx_heavy_descr' },
      /* Task 31 (фаза 4): HUD отладки (src/69_hud.js) — калибровка порогов
         автодетекта на реальном ТВ пользователя. Место — сразу под режимом
         анимаций, который и калибруется: выключен по умолчанию, включать
         его имеет смысл только для настройки, а не для постоянного показа. */
      { name: 'lumen_debug_hud', type: 'trigger', 'default': false, label: 'lumen_debug_hud_name', descr: 'lumen_debug_hud_descr' },
      /* Task 29 (фаза 3): переход «постер → кадр» при открытии карточки.
         Место — сразу под режимом анимаций: переход ему подчиняется (в
         «Лёгких» и «Выкл» его нет вовсе), и выключать его отдельно имеет
         смысл только тому, кто полные анимации оставил. */
      { name: 'lumen_transition', type: 'trigger', 'default': true, label: 'lumen_transition_name', descr: 'lumen_transition_descr' },
      /* Task 21 (фаза 3): тематические атмосферы — слой частиц над кадром
         карточки и кадром главной. Место — за переходом, последним пунктом
         группы: это самое заметное движение из трёх.

         По умолчанию «Только сезонные», а не «Все»: вид карточки без спроса
         менять нельзя, и снег на «Один дома» в декабре читается как
         оформление, а песчаная дымка на «Дюне» в июне — как сюрприз.
         Порядок значений — от самого скромного к самому заметному
         наоборот: сперва «Все», потом «Только сезонные», потом «Выкл»,
         как в плане. */
      { name: 'lumen_fx', type: 'select', values: ['all', 'seasonal', 'off'], vprefix: 'lumen_fx_', 'default': 'seasonal', label: 'lumen_fx_name', descr: 'lumen_fx_descr' },

      { name: 'lumen_group_backdrop', type: 'title', label: 'lumen_card_group_backdrop' },
      { name: 'lumen_slideshow', type: 'trigger', 'default': true, label: 'lumen_card_slideshow_name', descr: 'lumen_card_slideshow_descr' },
      { name: 'lumen_slide_interval', type: 'select', values: ['8', '14', '20'], vsuffix: 'lumen_card_seconds', 'default': '14', label: 'lumen_card_slide_interval', descr: 'lumen_card_slide_interval_descr' },
      { name: 'lumen_trailer', type: 'select', values: ['auto', 'on', 'off'], vprefix: 'lumen_card_trailer_', 'default': 'auto', label: 'lumen_card_trailer', descr: 'lumen_card_trailer_descr' },

      { name: 'lumen_group_blocks', type: 'title', label: 'lumen_card_group_blocks' },
      { name: 'lumen_card_progress', type: 'trigger', 'default': true, label: 'lumen_card_progress_name', descr: 'lumen_card_progress_descr' },
      /* Правка пользователя 2026-09-16 (п.1): пункт «Показывать актёров» убран
         вместе с блоком, которым он управлял, — кружки инициалов дублировали
         ряд актёров, который Lampa рисует ниже по экрану. */
      { name: 'lumen_reviews', type: 'trigger', 'default': true, label: 'lumen_card_reviews_name', descr: 'lumen_card_reviews_descr' },
      /* Task 28 (фаза 3): текст отзыва в ряду или только заголовок. Место —
         сразу под самим выключателем отзывов: настройка про их вид. По
         умолчанию «Только заголовки» — так спойлер не попадётся на глаза
         случайно, а весь текст всё равно в одном нажатии OK. */
      { name: 'lumen_reviews_mode', type: 'select', values: ['headlines', 'full'], vprefix: 'lumen_reviews_mode_', 'default': 'headlines', label: 'lumen_reviews_mode_name', descr: 'lumen_reviews_mode_descr' },
      /* placeholder — обязателен у type:'input': пустое поле Lampa показывает
         им, а без него в разделе стояло слово «undefined» (см. addPrefParam в
         src/80_settings.js). */
      { name: 'lumen_kp_key', type: 'input', 'default': '', label: 'lumen_card_kp_key', descr: 'lumen_card_kp_key_descr', placeholder: 'lumen_pref_unset' },
      /* Task 20 (решение координатора): подсказка «Ключ API не задан» в
         карточке и в сетке подборки Кинопоиска убирается кнопкой «Скрыть»
         прямо на экране, а возвращается этим переключателем — рядом с самим
         полем ключа, где её и ищут. */
      { name: 'lumen_kp_hint', type: 'trigger', 'default': true, label: 'lumen_kp_hint_name', descr: 'lumen_kp_hint_descr' },

      /* Task 20 (фаза 2), поправка Task 57 (фаза 5): в «Главной» остался
         верх экрана в порядке сверху вниз — кадр, трейлер в нём, чипы
         настроения и персональные ряды; всё про ряды подборок уехало в
         следующую группу. Каждый пункт применяется на лету
         (src/80_settings.js, applyPrefChange): возврат из настроек Lampa
         экран не перерисовывает. */
      { name: 'lumen_group_home', type: 'title', label: 'lumen_group_home' },
      /* Правка пользователя 2026-09-17 (п.2): размер кадра над рядами — первым
         пунктом группы: это самое крупное решение про вид главной, и от него
         зависит, сколько экрана достанется всему остальному. Доли экрана — в
         HERO_SIZES (src/30_css.js). */
      { name: 'lumen_hero_size', type: 'select', values: ['large', 'medium', 'compact', 'off'], vprefix: 'lumen_hero_size_', 'default': 'large', label: 'lumen_hero_size_name', descr: 'lumen_hero_size_descr' },
      /* Task 28 (фаза 3): автотрейлер в кадре главной. Место — сразу под
         размером кадра: настройка про то же самое место экрана. Включён по
         умолчанию, но сам по себе ничего не делает, пока фокус не постоит на
         карточке 8 секунд; в лёгких анимациях и на Tizen/webOS его нет вовсе
         (src/48_hero.js, trailerAllowed).

         Task 61 (фаза 5): пункт остаётся вторым в группе — выше него только
         размер кадра, то есть это самая заметная строка после заголовка
         «Главная», и обе настройки про одну и ту же часть экрана. Менялись
         не место, а название и описание (src/80_settings.js): выключатель
         искали и не нашли, потому что «Трейлер в кадре главной» с трёх
         метров не отличался от «Трейлера в фоне» из группы выше. */
      { name: 'lumen_hero_trailer', type: 'trigger', 'default': true, label: 'lumen_hero_trailer_name', descr: 'lumen_hero_trailer_descr' },
      { name: 'lumen_moods', type: 'trigger', 'default': true, label: 'lumen_moods_name', descr: 'lumen_moods_descr' },
      { name: 'lumen_personal_rows', type: 'trigger', 'default': true, label: 'lumen_personal_rows_name', descr: 'lumen_personal_rows_descr' },

      /* Task 57 (фаза 5): всё про ряды подборок — своим заголовком. До него
         эти пункты стояли в «Главной», и с новой настройкой дедупликации
         группа выросла бы до десяти строк, то есть перестала бы помещаться
         на экран ТВ целиком (предел девяти строк — test/prefs.test.mjs).
         Порядок внутри прежний: состав → число → дедупликация → метки →
         фильтр досмотренного → адрес каталога. */
      { name: 'lumen_group_rows', type: 'title', label: 'lumen_group_rows' },
      /* Кнопка-параметр: multi-select в SettingsApi нет, поэтому состав рядов
         выбирается на экране Lampa.Select с чекбоксами (src/80_settings.js,
         openHomeRows). Значение хранится строкой id через запятую в
         lumen_home_rows — его читает LC.rows.register. */
      { name: 'lumen_home_rows', type: 'button', label: 'lumen_home_rows_name', descr: 'lumen_home_rows_descr' },
      { name: 'lumen_rows_limit', type: 'select', values: ['10', '15', '25'], vsuffix: 'lumen_rows_limit_suffix', 'default': '15', label: 'lumen_rows_limit_name', descr: 'lumen_rows_limit_descr' },
      /* Task 57 (фаза 5): фильм, показанный в ряду выше, из нижних рядов
         выпадает. Место — сразу под числом рядов: обе настройки про то,
         сколько всего окажется на главной. Включено по умолчанию — это
         прямая жалоба пользователя (интервью 2026-09-21), а выключатель
         нужен тому, кто хочет видеть ряды ровно такими, какими их отдаёт
         каталог. */
      { name: 'lumen_rows_dedupe', type: 'trigger', 'default': true, label: 'lumen_rows_dedupe_name', descr: 'lumen_rows_dedupe_descr' },
      /* Task 25 (фаза 3): метки на постерах рядов («Скоро», «Новинка»,
         «Продолжить», новые серии). Место в группе — рядом с составом рядов:
         речь о том же экране. Применение на лету — LC.applyBadgesPref. */
      { name: 'lumen_badges', type: 'trigger', 'default': true, label: 'lumen_badges_name', descr: 'lumen_badges_descr' },
      { name: 'lumen_hide_watched', type: 'trigger', 'default': false, label: 'lumen_hide_watched_name', descr: 'lumen_hide_watched_descr' },
      /* Тип input: Lampa рисует текстовое поле (как lumen_kp_key). Пусто —
         адрес по умолчанию из LC.MANIFEST_URL (src/00_head.js). Последним в
         группе: этот адрес задают один раз и больше к нему не возвращаются. */
      { name: 'lumen_manifest_url', type: 'input', 'default': '', label: 'lumen_manifest_url', descr: 'lumen_manifest_url_descr', placeholder: 'lumen_pref_default_catalog' },

      /* Task 30 (финал фазы 3): всё, что меняет поведение ПУЛЬТА, — своей
         группой. До неё три пункта стояли в «Главной», хотя работают они и в
         сетках подборок, и в поиске Lampa: удержание OK, удержание стрелок и
         кнопки каналов — это про пульт, а не про экран.

         Все три включены по умолчанию: ни один не меняет того, что делает
         обычное нажатие. Меню по удержанию OK — штатный жест Lampa, мы лишь
         дописываем пункты; мини-карта только показывает; ускорение работает
         лишь при удержании. */
      { name: 'lumen_group_nav', type: 'title', label: 'lumen_group_nav' },
      { name: 'lumen_context_menu', type: 'trigger', 'default': true, label: 'lumen_context_menu_name', descr: 'lumen_context_menu_descr' },
      { name: 'lumen_minimap', type: 'trigger', 'default': true, label: 'lumen_minimap_name', descr: 'lumen_minimap_descr' },
      { name: 'lumen_fastscroll', type: 'trigger', 'default': true, label: 'lumen_fastscroll_name', descr: 'lumen_fastscroll_descr' },

      /* Task 23 (фаза 3): рулетка «Что посмотреть». В разделе настроек у неё
         один пункт — с каким фильтром она открывается; всё остальное (медиа,
         подборки, «есть 90 минут») выбирается на самом экране рулетки и
         хранится рядом с ним. Заголовок над единственным пунктом нужен:
         рулетка открывается из ЛЕВОГО МЕНЮ Lampa, и без него непонятно, к
         какому экрану относится «только непросмотренное». */
      { name: 'lumen_group_roulette', type: 'title', label: 'lumen_group_roulette' },
      { name: 'lumen_roulette_unseen', type: 'trigger', 'default': true, label: 'lumen_roulette_unseen_name', descr: 'lumen_roulette_unseen_descr' },

      /* Task 22 (фаза 3): ambient-режим. Своя группа: заставка — не про вид
         карточки, а про то, что происходит с экраном, когда пульт отложили.
         Место ближе к концу раздела: её настраивают один раз.

         Включена по умолчанию: на телевизоре статичный кадр висит часами, и
         это ровно та работа, ради которой заставку и заводят. Скромность
         здесь в другом — в источнике (отобранные кадры, а не то, что
         осталось на экране) и в трёх минутах покоя, за которые успевает
         закончиться любая пауза в навигации. */
      { name: 'lumen_group_ambient', type: 'title', label: 'lumen_group_ambient' },
      { name: 'lumen_ambient', type: 'trigger', 'default': true, label: 'lumen_ambient_name', descr: 'lumen_ambient_descr' },
      { name: 'lumen_ambient_source', type: 'select', values: ['curated', 'current'], vprefix: 'lumen_ambient_source_', 'default': 'curated', label: 'lumen_ambient_source_name', descr: 'lumen_ambient_source_descr' },
      { name: 'lumen_ambient_delay', type: 'select', values: ['3', '5', '10'], vsuffix: 'lumen_ambient_minutes', 'default': '3', label: 'lumen_ambient_delay_name', descr: 'lumen_ambient_delay_descr' },

      /* Оформление штатных окон Lampa на пути к плееру — последней группой:
         это единственная часть плагина, которая живёт вне его собственных
         экранов, и трогают её реже всего. */
      { name: 'lumen_group_path', type: 'title', label: 'lumen_card_group_path' },
      { name: 'lumen_menus', type: 'select', values: ['all', 'path', 'off'], vprefix: 'lumen_card_menus_', 'default': 'all', label: 'lumen_card_menus', descr: 'lumen_card_menus_descr' },
      { name: 'lumen_torrents', type: 'trigger', 'default': true, label: 'lumen_card_torrents_name', descr: 'lumen_card_torrents_descr' }
    ];

    function find(name) {
      if (!name) return null;
      for (var i = 0; i < LIST.length; i++) if (LIST[i].name === name) return LIST[i];
      return null;
    }

    return { LIST: LIST, find: find, boolOf: boolOf, motionModeFor: motionModeFor, fxHeavyDefault: fxHeavyDefault };
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
     Ken Burns на кадре, зум заставки, слайдшоу кадров карточки, кроссфейд
     двух полноэкранных слоёв героя и автотрейлер.

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

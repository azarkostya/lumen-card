  /* -------------------------------------------------------------------- */
  /* Task 29 (фаза 3): автоопределение слабого телевизора.                 */
  /*                                                                       */
  /* Что меряем. Первый кадр тяжёлого экрана — момент, когда Lampa и      */
  /* плагин уже построили DOM, а браузер пересчитал раскладку и нарисовал  */
  /* его. Замер — это время от точки вызова track() до ВТОРОГО             */
  /* requestAnimationFrame. Первый кадр наступает, когда поток освободился */
  /* от всей синхронной работы (нашей и вендорской); второй — когда        */
  /* устройство реально показало предыдущий кадр. Разница и есть «сколько  */
  /* у этого железа занимает первый кадр тяжёлого экрана»: она вбирает и   */
  /* разбор нашего CSS, и вёрстку, и композицию теней — то есть ровно то,  */
  /* что мы и гасим в режиме lite.                                         */
  /*                                                                       */
  /* Task 40 (фаза 4): точек вызова три, а не одна. Раньше мерилось только */
  /* открытие карточки ('full':complite), и до третьей открытой карточки   */
  /* главная и хаб работали в полном режиме, хотя именно они тяжелее:      */
  /* главная — это кадр героя во весь экран плюс ряды постеров, хаб —      */
  /* десятки плиток с кадрами подборок. Теперь замер начинают и монтирование */
  /* героя на главной (src/48_hero.js), и сборка экрана подборок           */
  /* (src/46_hub.js). Гейты и цена при этом прежние: тот же счётчик на три */
  /* замера за запуск, тот же shouldMeasure перед каждым.                  */
  /*                                                                       */
  /* Почему не FPS прокрутки: чтобы честно померить частоту кадров, нужно  */
  /* крутить кадры несколько секунд подряд — то есть самим нагружать       */
  /* слабый ТВ ради того, чтобы узнать, что он слабый. Здесь же мы не      */
  /* добавляем ни одного лишнего кадра: измеряется работа, которую         */
  /* устройство и так делает, открывая экран.                              */
  /*                                                                       */
  /* Цена: три замера за запуск (первые три тяжёлых экрана), по два        */
  /* отложенных кадра на замер, ноль таймеров, ноль сетевых запросов.      */
  /* Результат лежит в Storage 'lumen_motion_auto' — {mode, good}.         */
  /* Записанный вердикт измерение не отменяет: каждый запуск меряет заново,*/
  /* потому что первые экраны — самые холодные, и один их вердикт не имеет */
  /* права стать вечным (ревью фазы 3, Important 3).                       */
  /*                                                                       */
  /* Task 40: до всякого замера есть ещё одно правило — weakHardware():    */
  /* двухъядерная android-приставка получает 'lite' сразу.                 */
  /*                                                                       */
  /* Приоритет пользователя. Меряем ТОЛЬКО когда режим анимаций стоит на   */
  /* «Авто»: выбранные руками full/lite/off измерение не трогает никогда   */
  /* (LC.prefs.motionModeFor: не 'auto' — возвращается как есть).          */
  /* Понижение применяется сразу, повышение — лишь после GOOD_RUNS хороших */
  /* запусков подряд: один удачный вечер не должен возвращать полные       */
  /* анимации телевизору, который их не тянет.                             */
  /* -------------------------------------------------------------------- */

  LC.perf = (function () {

    /* Вердикт автодетекта. Имя из плана Task 29 Step 2. */
    var KEY = 'lumen_motion_auto';
    /* «Уведомление о понижении уже показывали» — один раз за все запуски. */
    var NOTY_KEY = 'lumen_motion_noty';

    /* Пороги плана (раздел 0 фазы 3): 400 мс — слабый, меньше 250 — точно
       тянет, между ними режим не меняем. Середина оставлена намеренно:
       вердикт на границе шумит от запуска к запуску, а каждое переключение
       режима пользователь видит. */
    var SLOW_MS = 400;
    var FAST_MS = 250;
    /* Три замера: медиана из трёх переживает один случайный тяжёлый кадр
       (сборка мусора, первый разбор шрифта), а четвёртый и пятый замер уже
       ничего не добавили бы к решению «слабый или нет». */
    var SAMPLES = 3;
    /* Пять запусков подряд с хорошим вердиктом — тогда снимаем записанный
       lite. Счётчик живёт в том же Storage-значении (good). */
    var GOOD_RUNS = 5;
    /* Найдено живой проверкой (2026-09-17, фоновая вкладка браузера):
       requestAnimationFrame в скрытом документе не вызывается вовсе, и пара
       кадров замера доезжает только тогда, когда страницу снова показали, —
       давая «замер» в десятки секунд и ложный вердикт «слабый ТВ». Такой
       результат отбрасывается: устройство здесь ни при чём, экран просто не
       рисовали. Предел с большим запасом к порогу SLOW_MS — настоящий ТВ
       столько на первый кадр не тратит даже в худшем случае. */
    var MAX_SAMPLE = 5000;
    /* Ревью Task 40 (п.5): сколько замеров за запуск разрешено взять с
       ГЛАВНОЙ. Её точка замера — монтирование героя (src/48_hero.js), а оно
       случается на каждом 'activity':start компонента main, то есть и на
       каждом возврате из карточки (src/90_runtime.js). Без ограничения
       обычный обход «главная → карточка → назад → карточка → назад» дал бы
       выборку из двух замеров главной и одного карточки, медиана легла бы на
       главную — а она легче: ряды Lampa к этому моменту ещё не построены,
       они догружаются после start пачками (см. шапку src/44_rows.js). То
       есть расширение автодетекта сработало бы наоборот, в пользу «тянет».

       Единица, а не «требовать хотя бы один не-main»: главная — первый
       экран запуска, и её замер нужен как раз ради быстрого вердикта до
       первой открытой карточки, а требование чужого источника отложило бы
       вердикт до неё же. Остальные два замера берут любые экраны, включая
       хаб, поэтому вердикт по-прежнему выносится и тому, кто ходит только
       главная ↔ карточка. */
    var MAIN_LIMIT = 1;

    /* Замеры ТЕКУЩЕЙ сессии (window.lumen_card.perf.samples() в живой
       проверке). Между запусками не хранятся: между ними хранится вердикт. */
    var samples = [];
    /* Сколько замеров уже взято с главной (см. MAIN_LIMIT). */
    var fromMain = 0;
    /* Идентификатор отложенного кадра — ровно один на модуль: второй замер
       не начинается, пока не кончился первый. */
    var frame = 0;
    /* Вердикт этой сессии вынесен (или измерять нечего) — track() выходит
       первой строкой и больше не трогает ни Storage, ни кадры. */
    var done = false;
    /* Прочитанный вердикт. Storage.get у Lampa читает свой кэш в памяти, но
       LC.motionMode зовётся на каждой сборке CSS, поэтому значение держим
       рядом; запись обновляет и его. undefined — «ещё не читали». */
    var cached;
    /* Волна производительности: самотест (src/69_bench.js) гоняет главную
       с подменёнными режимами, и первый кадр экрана в это время — замер
       теста, а не устройства. Пока held, shouldMeasure отвечает «нет». */
    var held = false;

    /* ------------------------------------------------------------------ */
    /* Чистая часть                                                        */
    /* ------------------------------------------------------------------ */

    function median(list) {
      var sorted = list.slice().sort(function (a, b) { return a - b; });
      return sorted[Math.floor(sorted.length / 2)];
    }

    /* Вердикт по замерам: 'lite' (понизить), 'full' (тянет), null (не
       менять — данных мало или значение в серой зоне). */
    function decide(list) {
      if (!list || list.length < SAMPLES) return null;
      var m = median(list);
      if (m >= SLOW_MS) return 'lite';
      if (m < FAST_MS) return 'full';
      return null;
    }

    /* Сохранённое значение к виду {mode, good}. Терпит всё, что могло
       оказаться в Storage: строку 'lite' (как писал бы ранний профиль),
       объект, JSON-строку (Lampa кладёт объекты сериализованными) и мусор. */
    function normalize(raw) {
      var value = raw;
      if (typeof value === 'string') {
        if (value === 'lite' || value === 'full') return { mode: value, good: 0 };
        try { value = JSON.parse(value); } catch (e) { return { mode: null, good: 0 }; }
      }
      if (!value || typeof value !== 'object') return { mode: null, good: 0 };
      var mode = (value.mode === 'lite' || value.mode === 'full') ? value.mode : null;
      var good = Number(value.good);
      if (!(good > 0)) good = 0;
      return { mode: mode, good: Math.floor(good) };
    }

    /* Сохранённое значение + вердикт запуска -> новое сохранённое значение.
       Понижение записывается сразу; хорошие замеры при записанном lite
       копятся в good и снимают его только на GOOD_RUNS-м. */
    function merge(stored, decision) {
      var cur = normalize(stored);
      if (decision === 'lite') return { mode: 'lite', good: 0 };
      if (decision !== 'full') return cur;
      if (cur.mode !== 'lite') return { mode: 'full', good: 0 };
      var good = cur.good + 1;
      if (good >= GOOD_RUNS) return { mode: 'full', good: 0 };
      return { mode: 'lite', good: good };
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage) return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    function readStored() {
      if (typeof cached !== 'undefined') return cached;
      var st = storage();
      /* Без Storage не кэшируем: Lampa могла ещё не подняться, а один
         преждевременный промах запомнился бы на всю сессию. */
      if (!st) return normalize(null);
      var value = normalize(null);
      try { value = normalize(st.get(KEY, '')); } catch (e) { warn('perf: storage read failed', e); }
      cached = value;
      return value;
    }

    function writeStored(value) {
      cached = value;
      var st = storage();
      if (!st) return;
      try { st.set(KEY, value); } catch (e) { warn('perf: storage write failed', e); }
    }

    /* Вердикт для LC.motionMode (src/81_prefs.js). */
    function mode() {
      return readStored().mode;
    }

    function now() {
      try {
        if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
      } catch (e) { }
      return Date.now();
    }

    function raf(fn) {
      try {
        if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
      } catch (e) { }
      return 0;
    }

    /* Страница скрыта (вкладка в фоне, экран погашен). document.hidden есть
       и в браузерах ТВ; там, где его нет, считаем страницу видимой. */
    function hidden() {
      try {
        return typeof document !== 'undefined' && !!document.hidden;
      } catch (e) {
        return false;
      }
    }

    function unraf(id) {
      try {
        if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
      } catch (e) { }
    }

    /* Сырое значение пункта «Анимации»: выбранное руками измерение не
       трогает. Читается общим LC.pref с дефолтом пункта, как и в
       LC.motionMode (правка 2026-09-23: здесь стоял Storage.field). */
    function motionRaw() {
      try {
        return LC.pref('lumen_motion', 'auto');
      } catch (e) { }
      return 'auto';
    }

    function platformIs(name) {
      try {
        if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') return !!Lampa.Platform.is(name);
      } catch (e) { }
      return false;
    }

    function tvPlatform() {
      return platformIs('tizen') || platformIs('webos');
    }

    /* Task 40: «железо заведомо слабое» — вердикт без единого замера.
       Замер честнее, но он приходит только после трёх тяжёлых экранов, и
       все три на таком устройстве успевают подтормозить. Порог намеренно
       низкий:
       - hardwareConcurrency <= 2 — двухъядерная приставка;
       - deviceMemory <= 1 — гигабайт оперативной памяти и меньше.
       Четырёхъядерный ТВ пользователя (Philips 50PUS8057, MediaTek) под
       правило по спецификации НЕ попадает — там решает замер. Именно «по
       спецификации»: hardwareConcurrency в Android WebView на части прошивок
       отражает не физические ядра, а доступные потоку, поэтому фактическое
       число надо увидеть на самом телевизоре — его показывает HUD отладки
       (src/69_hud.js).

       deviceMemory отсутствует у большинства движков (свойство есть только
       в Chromium) — тогда признак не учитывается вовсе, а не считается
       нулём. То же с hardwareConcurrency: Number(undefined) даёт NaN, и
       сравнение cores > 0 отсекает его первым.

       Правило работает только на android: Tizen/webOS и так получают 'lite'
       от платформы (LC.prefs.motionModeFor), а в браузере на компьютере
       двухъядерность ничего не говорит о том, потянет ли он анимации. */
    function weakHardware() {
      if (!platformIs('android')) return false;
      try {
        /* navigator берётся с window, как и всё остальное окружение этого
           модуля: так его подменяют тесты, а в браузере window.navigator —
           тот же самый объект. */
        var nav = window.navigator;
        if (!nav) return false;
        var cores = Number(nav.hardwareConcurrency);
        if (cores > 0 && cores <= 2) return true;
        var mem = nav.deviceMemory;
        if (typeof mem !== 'undefined' && mem !== null) {
          var gb = Number(mem);
          if (gb > 0 && gb <= 1) return true;
        }
      } catch (e) { }
      return false;
    }

    /* ------------------------------------------------------------------ */
    /* Замер                                                               */
    /* ------------------------------------------------------------------ */

    /* source — экран, с которого пришёл замер: 'main' (главная), 'hub'
       (экран подборок) или 'card' (открытая карточка). */
    function shouldMeasure(source) {
      if (held) return false;
      try {
        if (!LC.enabled()) return false;
      } catch (e) {
        return false;
      }
      /* Ревью Task 40 (п.5): с главной берём не больше MAIN_LIMIT замеров. */
      if (source === 'main' && fromMain >= MAIN_LIMIT) return false;
      var raw = motionRaw();
      /* Всё, что не три явных значения, LC.prefs.motionModeFor считает за
         'auto' — здесь та же трактовка, иначе профиль с пустым ключом
         («Авто» никогда не переключали) не измерялся бы вовсе. */
      if (raw === 'full' || raw === 'lite' || raw === 'off') return false;
      /* На Tizen/webOS «Авто» и так даёт lite (LC.prefs.motionModeFor), а
         повышать по замеру мы не умеем — мерить там нечего. */
      if (tvPlatform()) return false;
      /* Записанный вердикт измерение НЕ отменяет — ни 'lite', ни 'full'
         (ревью фазы 3, Important 3). Раньше 'full' был терминальным: получив
         «тянет» на трёх первых карточках запуска — самых холодных, с ещё
         пустым кэшем постеров и неразобранным шрифтом, — плагин больше
         никогда не мерил это устройство, хотя дальше на нём мог появиться и
         тяжёлый экран, и просевшее железо. Цена отказа от терминальности —
         три замера на запуск: по два отложенных кадра каждый, ноль таймеров
         и ноль сетевых запросов; асимметрия при этом сохраняется прежняя
         (понижение сразу, повышение через GOOD_RUNS хороших запусков). */
      /* Экран не рисуется — мерить нечего: кадры не придут до возвращения
         страницы, и замер вышел бы про время в фоне, а не про железо. */
      if (hidden()) return false;
      return true;
    }

    /* Понижение показываем один раз за все запуски: это объяснение, а не
       напоминание. Повышение молчит — вернувшиеся анимации видно и так. */
    function notyOnce() {
      var st = storage();
      var shown = '';
      try {
        if (st) shown = st.get(NOTY_KEY, '');
      } catch (e) { }
      /* Признак пишем сами и только строкой 'true' (ниже), поэтому и читаем
         его прямо: LC.prefs.boolOf здесь ни к чему — он нужен там, где
         значение мог оставить переключатель Lampa или старый профиль. */
      if (shown === 'true' || shown === true) return;
      try {
        if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') {
          Lampa.Noty.show(typeof LC.lang === 'function' ? LC.lang('lumen_motion_auto_noty') : 'Lumen Card');
        }
      } catch (eN) {
        warn('perf: noty failed', eN);
      }
      /* Строка 'true', а не булево: Storage.set(name, false) у Lampa не
         сохраняется вовсе (план 0.2), и переключатели пишут строки. */
      try { if (st) st.set(NOTY_KEY, 'true'); } catch (eS) { }
    }

    function commit() {
      var prev = readStored();
      var next = merge(prev, decide(samples));
      if (next.mode === prev.mode && next.good === prev.good) return;
      writeStored(next);
      /* Изменился ли РЕАЛЬНЫЙ режим: и null, и 'full' дают полные анимации,
         поэтому важен только переход через 'lite'. Накопление good в
         сохранённом значении экран не трогает. */
      var was = prev.mode === 'lite';
      var is = next.mode === 'lite';
      if (was === is) return;
      if (is) notyOnce();
      try {
        if (typeof LC.applyMotionMode === 'function') LC.applyMotionMode();
      } catch (e) {
        warn('perf: apply failed', e);
      }
    }

    /* Точки вызова — 'full':complite (src/90_runtime.js), монтирование
       героя на главной (src/48_hero.js) и сборка экрана подборок
       (src/46_hub.js). Замер начинается в момент вызова и заканчивается на
       втором кадре; висящих ресурсов после него не остаётся (кадры
       одноразовые, таймеров нет). Второй вызов, пока первый не доехал,
       выходит первой же строкой (frame), поэтому экраны, которые сменяют
       друг друга быстро, замеры не путают. */
    function track(source) {
      if (done || frame) return;
      /* Незнакомое значение (и вызов без аргумента) считается замером
         карточки — это исходная и единственная точка до Task 40. */
      var src = (source === 'main' || source === 'hub') ? source : 'card';
      /* Найдено живой проверкой (2026-09-17): гейты перечитываются на КАЖДОМ
         замере, а не запоминаются первым отказом. Режим анимаций
         переключают прямо во время сеанса, и «сейчас выбран full вручную» не
         означает «мерить больше никогда»: запомнив отказ, плагин не делал ни
         одного замера до перезагрузки Lampa. Проверки дешёвые — чтение двух
         значений Storage и признака платформы. */
      if (!shouldMeasure(src)) return;
      var started = now();
      frame = raf(function () {
        frame = raf(function () {
          frame = 0;
          var ms = now() - started;
          /* Кадры доехали после возвращения страницы из фона — это не замер
             устройства (см. MAX_SAMPLE). Значение отбрасывается, а место под
             замер остаётся: следующая карточка попробует снова. */
          if (ms > MAX_SAMPLE) return;
          samples.push(ms);
          if (src === 'main') fromMain++;
          if (samples.length < SAMPLES) return;
          done = true;
          try { commit(); } catch (e) { warn('perf: commit failed', e); }
        });
      });
    }

    /* Снять отложенный кадр (выключение плагина, уборка). Уже собранные
       замеры остаются: они честные. */
    function stop() {
      if (!frame) return;
      unraf(frame);
      frame = 0;
    }

    /* Самотест: hold(true) снимает висящий замер и выключает новые до
       hold(false). Собранные замеры остаются — они честные. */
    function hold(on) {
      held = !!on;
      if (held) stop();
    }

    return {
      decide: decide,
      merge: merge,
      normalize: normalize,
      mode: mode,
      /* Task 40: «слабое железо без замеров» — читает LC.platformInfo
         (src/81_prefs.js) и отдаёт признак в motionModeFor. */
      weakHardware: weakHardware,
      track: track,
      stop: stop,
      hold: hold,
      samples: function () { return samples.slice(); }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.perf;

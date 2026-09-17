  /* -------------------------------------------------------------------- */
  /* Task 29 (фаза 3): автоопределение слабого телевизора.                 */
  /*                                                                       */
  /* Что меряем. Открытие карточки — самый тяжёлый момент плагина: Lampa   */
  /* строит DOM полной карточки, мы дорисовываем шапку, таблицу, ряд       */
  /* отзывов и слой фона, браузер пересчитывает раскладку и рисует первый  */
  /* кадр нового экрана. Замер — это время от события 'full':complite до   */
  /* ВТОРОГО requestAnimationFrame. Первый кадр наступает, когда поток     */
  /* освободился от всей синхронной работы (нашей и вендорской); второй —  */
  /* когда устройство реально показало предыдущий кадр. Разница и есть     */
  /* «сколько у этого железа занимает первый кадр тяжёлого экрана»: она    */
  /* вбирает и разбор нашего CSS, и вёрстку, и композицию blur/теней —     */
  /* то есть ровно то, что мы и гасим в режиме lite.                       */
  /*                                                                       */
  /* Почему не FPS прокрутки: чтобы честно померить частоту кадров, нужно  */
  /* крутить кадры несколько секунд подряд — то есть самим нагружать       */
  /* слабый ТВ ради того, чтобы узнать, что он слабый. Здесь же мы не      */
  /* добавляем ни одного лишнего кадра: измеряется работа, которую         */
  /* устройство и так делает при открытии карточки.                        */
  /*                                                                       */
  /* Цена: три замера за запуск (первые три карточки), по два отложенных   */
  /* кадра на замер, ноль таймеров, ноль сетевых запросов. Результат       */
  /* лежит в Storage 'lumen_motion_auto' — {mode, good}; при записанном    */
  /* 'full' следующие запуски не меряют вовсе.                             */
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

    /* Замеры ТЕКУЩЕЙ сессии (window.lumen_card.perf.samples() в живой
       проверке). Между запусками не хранятся: между ними хранится вердикт. */
    var samples = [];
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
       трогает. Читается через Storage.field — как в LC.motionMode. */
    function motionRaw() {
      try {
        var st = storage();
        if (st && typeof st.field === 'function') return st.field('lumen_motion');
      } catch (e) { }
      return 'auto';
    }

    function tvPlatform() {
      try {
        if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.is === 'function') {
          return !!Lampa.Platform.is('tizen') || !!Lampa.Platform.is('webos');
        }
      } catch (e) { }
      return false;
    }

    /* ------------------------------------------------------------------ */
    /* Замер                                                               */
    /* ------------------------------------------------------------------ */

    function shouldMeasure() {
      try {
        if (!LC.enabled()) return false;
      } catch (e) {
        return false;
      }
      var raw = motionRaw();
      /* Всё, что не три явных значения, LC.prefs.motionModeFor считает за
         'auto' — здесь та же трактовка, иначе профиль с пустым ключом
         («Авто» никогда не переключали) не измерялся бы вовсе. */
      if (raw === 'full' || raw === 'lite' || raw === 'off') return false;
      /* На Tizen/webOS «Авто» и так даёт lite (LC.prefs.motionModeFor), а
         повышать по замеру мы не умеем — мерить там нечего. */
      if (tvPlatform()) return false;
      /* Устройство уже показало, что тянет: больше не тратимся. Из 'lite'
         выход есть (GOOD_RUNS хороших запусков), поэтому там меряем. */
      if (readStored().mode === 'full') return false;
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

    /* Точка вызова — 'full':complite (src/90_runtime.js). Замер начинается
       в момент вызова и заканчивается на втором кадре; висящих ресурсов
       после него не остаётся (кадры одноразовые, таймеров нет). */
    function track() {
      if (done || frame) return;
      /* Найдено живой проверкой (2026-09-17): гейты перечитываются на КАЖДОЙ
         карточке, а не запоминаются первым отказом. Режим анимаций
         переключают прямо во время сеанса, и «сейчас выбран full вручную» не
         означает «мерить больше никогда»: запомнив отказ, плагин не делал ни
         одного замера до перезагрузки Lampa. Проверки дешёвые — чтение двух
         значений Storage и признака платформы. */
      if (!shouldMeasure()) return;
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

    return {
      decide: decide,
      merge: merge,
      normalize: normalize,
      mode: mode,
      track: track,
      stop: stop,
      samples: function () { return samples.slice(); }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.perf;

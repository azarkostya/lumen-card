  /* -------------------------------------------------------------------- */
  /* 1.2: окно «Что нового» после обновления плагина.                      */
  /*                                                                       */
  /* Один раз после первого запуска новой версии — короткий список того,   */
  /* что изменилось, для зрителя. Решения пользователя (план 1.2, 29.09):  */
  /* при первой установке ничего не показываем; не успели показать за      */
  /* первую минуту (человек сразу ушёл в плеер) — пропускаем насовсем;     */
  /* выключатель — «Дополнительно… → Пульт и окна».                        */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   parseVersion('x.y.z') → [x, y, z] | null                            */
  /*   compare(a, b) → -1 | 0 | 1 (разбор по числам: 1.10.0 > 1.9.0)       */
  /*   pick(seen, version) → версия, чьи заметки показать, | null          */
  /*   decide(seen, version, installed) → { show, write }                  */
  /*   notesFor(version, lang) → [строки] | null                           */
  /*   NOTES — тексты: версия → { ru: [...], en: [...], uk: [...] }        */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   detect() — в LC.init до activate(): решает, ждёт ли окно, и пишет   */
  /*              ключ версии;                                             */
  /*   schedule(ready) — после activate(): проверка готовности главной     */
  /*              через 4 с, затем раз в 5 с, всего 12 раз;                */
  /*   cancel() — снять таймер и забыть ожидающее окно (deactivate);       */
  /*   open(version) — показать окно (живая проверка зовёт напрямую);      */
  /*   pending() → версия ожидающего окна | null;                          */
  /*   _timers — хук тестов (подменяемые setTimeout/clearTimeout).         */
  /*                                                                       */
  /* Сеть модуль не трогает: тексты встроены, ключ — в Lampa.Storage.      */
  /* -------------------------------------------------------------------- */

  LC.whatsnew = (function () {

    /* Версия, которую запускали последней. Инвариант: после detect() ключ
       всегда равен LC.VERSION — и после обновления, и после отката, и на
       версии без заметок. Вернувшись с отката на новую версию, человек
       увидит окно ещё раз — это дешевле, чем хранить историю версий. */
    var KEY = 'lumen_seen_version';

    /* Признаки «плагин уже стоял»: у первой установки и у обновления с
       1.1.0 ключа версии нет одинаково. План главной пишет эпоху при
       первом же построении (src/47_homeplan.js, apply), кэш каталога —
       при первой загрузке (src/42_manifest.js, load). Оба пишутся только
       из activate(), поэтому detect() обязан идти раньше него. */
    var INSTALLED_KEYS = ['lumen_home_epoch', 'lumen_manifest'];

    var FIRST_DELAY = 4000;
    var RETRY_DELAY = 5000;
    var TRIES = 12;

    /* ТЕКСТЫ ДЛЯ ВЫПУСКА. Ключ — версия плагина (LC.VERSION), значение —
       3–5 коротких фраз на трёх языках, для зрителя, без внутренних
       терминов (сторож — test/whatsnew.test.mjs). Выпуск минорной версии
       (x.y.0) обязан добавить запись — тот же тест сверяет её с
       LC.VERSION. Патч-версии запись не нужна: окно покажет заметки
       самой новой версии, которую человек ещё не видел (pick ниже).
       Путь к выключателю дописывать не нужно — окно добавляет его само
       из строк раздела настроек (hintText). */
    var NOTES = {
      /* ЧЕРНОВИК 1.3 (новее LC.VERSION — окно его не покажет, пока номер
         не поднят): пока только «Вернуться к просмотру»; остальные пункты
         выпуска допишет координатор, всего не больше пяти. */
      '1.3.0': {
        ru: [
          'Если Lampa перезапустилась, пока шла серия или фильм, при следующем запуске она предложит вернуться к просмотру с того же места.',
          'Серии из приложения TorrServe: окно предложит открыть ту же раздачу снова, серию и место выберете там.',
          'Досмотрели серию до конца — окно предложит следующую.',
          'Прерванный фильм стоит первым в «Досмотреть» с меткой «Вернуться», вернуться к нему можно и из меню по удержанию OK.'
        ],
        en: [
          'If Lampa restarted while an episode or film was playing, it will offer to resume from the same spot next time it starts.',
          'Episodes from the TorrServe app: the window offers to open the same torrent again, and you pick the episode and spot there.',
          'Finished an episode — the window offers the next one.',
          'The interrupted title comes first in "Continue watching" with a "Resume" label, and you can also resume it from the hold-OK menu.'
        ],
        uk: [
          'Якщо Lampa перезапустилася, поки йшла серія чи фільм, під час наступного запуску вона запропонує повернутися до перегляду з того ж місця.',
          'Серії із застосунку TorrServe: вікно запропонує відкрити ту саму роздачу знову, серію й місце оберете там.',
          'Додивилися серію до кінця — вікно запропонує наступну.',
          'Перерваний фільм стоїть першим у «Досивитися» з міткою «Повернутися», повернутися до нього можна й з меню за утриманням OK.'
        ]
      },
      '1.2.0': {
        ru: [
          'На главной — ряд «Вышло в цифре»: фильмы, которые только что стали доступны в хорошем качестве.',
          'Детский режим в настройках: на главной и в подборках — только мультфильмы и семейное кино.',
          'Подборка «Братья Коэн» теперь целиком — вместе с фильмами, которые Итан снял сам.',
          'Такое окно будет появляться один раз после каждого обновления.'
        ],
        en: [
          'A new "New on digital" row on the home screen: films that have just become available in good quality.',
          'Kids mode in the settings: only cartoons and family films on the home screen and in collections.',
          'The "Coen Brothers" collection is now complete, including the films Ethan made on his own.',
          'This window will appear once after every update.'
        ],
        uk: [
          'На головній — ряд «Вийшло в цифрі»: фільми, які щойно стали доступні в добрій якості.',
          'Дитячий режим у налаштуваннях: на головній і в підбірках — лише мультфільми та сімейне кіно.',
          'Підбірка «Брати Коен» тепер повна — разом із фільмами, які Ітан зняв сам.',
          'Таке вікно з’являтиметься один раз після кожного оновлення.'
        ]
      }
    };

    function parseVersion(v) {
      var m = /^(\d+)\.(\d+)\.(\d+)$/.exec(typeof v === 'string' ? v : '');
      return m ? [+m[1], +m[2], +m[3]] : null;
    }

    /* Разбор по числам: строковое сравнение поставило бы 1.10.0 ниже 1.9.0.
       Неразборчивая версия меньше любой разборчивой. */
    function compare(a, b) {
      var pa = parseVersion(a);
      var pb = parseVersion(b);
      if (!pa || !pb) return pa ? 1 : (pb ? -1 : 0);
      for (var i = 0; i < 3; i++) {
        if (pa[i] !== pb[i]) return pa[i] < pb[i] ? -1 : 1;
      }
      return 0;
    }

    /* Самая новая версия с заметками в полуинтервале (seen; version].
       Так патч 1.2.1 у того, кто пришёл с 1.1.0, покажет заметки 1.2.0, а у
       того, кто их уже видел на 1.2.0, — ничего; откат (seen > version) и
       повторный запуск (seen === version) не дают ничего. seen === null —
       версия неизвестна (обновление с 1.1.0 и старше): подходит любая
       запись не новее текущей. */
    function pick(seen, version) {
      if (!parseVersion(version)) return null;
      var best = null;
      for (var key in NOTES) {
        if (!Object.prototype.hasOwnProperty.call(NOTES, key) || !parseVersion(key)) continue;
        if (compare(key, version) > 0) continue;
        if (seen !== null && compare(key, seen) <= 0) continue;
        if (best === null || compare(key, best) > 0) best = key;
      }
      return best;
    }

    /* seen — значение ключа (пусто — ключа нет), installed — есть ли
       признаки прежней установки. show — версия заметок или null, write —
       что записать в ключ (null — ничего: там уже текущая версия).
       Ключа нет и плагин не стоял — первая установка, окна нет (решение
       пользователя 2.1). Ключ есть, но не разбирается (правили руками) —
       окна нет: неизвестно, что человек уже видел. */
    function decide(seen, version, installed) {
      var out = { show: null, write: null };
      if (!parseVersion(version)) return out;
      var raw = (seen === null || typeof seen === 'undefined') ? '' : '' + seen;
      if (raw !== version) out.write = version;
      if (raw === '') {
        if (installed) out.show = pick(null, version);
      } else if (parseVersion(raw)) {
        out.show = pick(raw, version);
      }
      return out;
    }

    function notesFor(version, lang) {
      var pack = Object.prototype.hasOwnProperty.call(NOTES, version) ? NOTES[version] : null;
      if (!pack) return null;
      var list = pack[lang] || pack.ru;
      return list && list.length ? list.slice() : null;
    }

    /* ---------------------------- рантайм ---------------------------- */

    var _pending = null;
    var _timer = null;
    var _tries = 0;
    var _ready = null;

    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      return setTimeout(fn, ms);
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      clearTimeout(id);
    }

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    function enabled() {
      return !!LC.pref('lumen_whatsnew', true);
    }

    /* Синхронно, до activate(): после него план главной уже записал бы
       эпоху, и первая установка стала бы неотличима от обновления.
       Выключенный пункт тоже пишет ключ — включив его позже, человек не
       получит заметок давно прошедшего обновления. Своя запись — без
       события 'change' (nolisten), как служебные ключи плана главной. */
    function detect() {
      _pending = null;
      var st = storage();
      if (!st) return null;
      try {
        var installed = false;
        for (var i = 0; i < INSTALLED_KEYS.length; i++) {
          if (st.get(INSTALLED_KEYS[i], '')) installed = true;
        }
        var d = decide(st.get(KEY, ''), LC.VERSION, installed);
        if (d.write && typeof st.set === 'function') st.set(KEY, d.write, true);
        if (d.show && enabled()) _pending = d.show;
      } catch (e) {
        _pending = null;
        warn('whatsnew detect failed', e);
      }
      return _pending;
    }

    function stopTimer() {
      clearT(_timer);
      _timer = null;
    }

    /* ready() — «главная на экране, ничего поверх, фокус на её рядах»
       (homeReady, src/90_runtime.js). Первая проверка — через 4 с: главная
       успевает построиться, а окно не выскакивает под первым же нажатием.
       Не готово — повтор раз в 5 с, всего 12 проверок (около минуты), а
       потом окно пропускается до следующего обновления (решение 2.3). */
    function schedule(ready) {
      stopTimer();
      if (!_pending) return;
      _ready = typeof ready === 'function' ? ready : null;
      _tries = 0;
      _timer = setT(tick, FIRST_DELAY);
    }

    function tick() {
      _timer = null;
      if (!_pending) return;
      if (!enabled()) { _pending = null; return; }
      /* 1.3: окно «Вернуться к просмотру» (src/71_resume.js) ждёт показа
         или открыто — уступаем, и попытку не тратим: два окна разом не
         открываются, а минута «Что нового» не сгорает, пока человек
         решает, возвращаться ли к серии. */
      var resume = false;
      try { resume = !!(LC.resume && typeof LC.resume.busy === 'function' && LC.resume.busy()); } catch (eResume) { resume = false; }
      if (resume) { _timer = setT(tick, RETRY_DELAY); return; }
      var ok = false;
      try { ok = !!(_ready && _ready()); } catch (e) { ok = false; }
      if (ok) {
        var version = _pending;
        _pending = null;
        open(version);
        return;
      }
      _tries++;
      if (_tries >= TRIES) { _pending = null; return; }
      _timer = setT(tick, RETRY_DELAY);
    }

    function cancel() {
      stopTimer();
      _pending = null;
    }

    function lang() {
      try { if (typeof LC.langCode === 'function') return LC.langCode(); } catch (e) { }
      return 'ru';
    }

    /* «Выключить это окно: Настройки → Lumen Card → Дополнительно… → Пульт
       и окна → «Что нового после обновления»» — из тех же строк, что сам
       раздел: переименуют группу или пункт — подсказка не разойдётся. */
    function hintText() {
      var q = lang() === 'en' ? ['"', '"'] : ['«', '»'];
      return LC.lang('lumen_whatsnew_off') + ' → ' + [LC.lang('lumen_card_title'), LC.lang('lumen_more_name'),
        LC.lang('lumen_group_remote'), q[0] + LC.lang('lumen_whatsnew_name') + q[1]].join(' → ');
    }

    /* Окно — штатный Lampa.Modal: «OK» — его кнопка (единственный .selector
       окна, фокус встаёт на неё сам, app.min.js toggle$4), «Назад» и клик
       мимо окна приходят в onBack. Фокус Modal.close сам не возвращает:
       имя контроллера снимается ДО открытия (на главной это 'items_line' —
       ряд с его последней карточкой) и включается обратно на закрытии, как
       у окон отзыва и описания (src/60_reviews.js, src/85_header.js).
       Заголовок идёт в шаблон 'modal' строкой (open$5 → Template.get), в
       нём нет «<&${» — сторожит тест; пункты — только текстом (esc). */
    function open(version) {
      try {
        if (!window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return false;
        var items = notesFor(version, lang());
        if (!items) return false;
        var back = 'content';
        try {
          var cur = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
          if (cur && cur.name) back = cur.name;
        } catch (e) { }
        var html = '<div class="lumen-whatsnew"><ul class="lumen-whatsnew__list">';
        for (var i = 0; i < items.length; i++) html += '<li class="lumen-whatsnew__item">' + LC.util.esc(items[i]) + '</li>';
        html += '</ul><div class="lumen-whatsnew__hint">' + LC.util.esc(hintText()) + '</div></div>';
        var closed = false;
        var close = function () {
          if (closed) return;
          closed = true;
          try { Lampa.Modal.close(); } catch (e2) { }
          try { if (Lampa.Controller && typeof Lampa.Controller.toggle === 'function') Lampa.Controller.toggle(back); } catch (e3) { }
        };
        Lampa.Modal.open({
          title: LC.lang('lumen_whatsnew_title') + ' ' + version,
          html: $(html),
          size: 'medium',
          buttons: [{ name: LC.lang('lumen_whatsnew_ok'), onSelect: close }],
          onBack: close
        });
        return true;
      } catch (err) {
        warn('whatsnew open failed', err);
        return false;
      }
    }

    var api = {
      KEY: KEY,
      NOTES: NOTES,
      FIRST_DELAY: FIRST_DELAY,
      RETRY_DELAY: RETRY_DELAY,
      TRIES: TRIES,
      parseVersion: parseVersion,
      compare: compare,
      pick: pick,
      decide: decide,
      notesFor: notesFor,
      hintText: hintText,
      detect: detect,
      schedule: schedule,
      cancel: cancel,
      open: open,
      pending: function () { return _pending; },
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.whatsnew;

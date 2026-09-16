/* -------------------------------------------------------------------- */
  /* LC.moods — чипы профиля настроения на главной (Task 19).             */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   moodTitle(mood, lang) — строка названия настроения                  */
  /*   mount(root) — вставить блок чипов в текст героя текущей главной     */
  /*   mountCurrent() — то же для уже открытой главной (Task 20)           */
  /*   unmount() — снять блок                                               */
  /*   detach(render) — снять, если блок не принадлежит этой активности    */
  /*   owns(render) — принадлежит ли блок этой активности                  */
  /*   active() — смонтирован ли блок                                      */
  /*   install() — гейт настройки: поставить чипы на открытую главную      */
  /*   uninstall() — гейт настройки: снять чипы                            */
  /*                                                                       */
  /* Событий Lampa модуль не слушает: монтирует и снимает чипы единственная */
  /* подписка плагина — LC.onActivityEvent в src/90_runtime.js, сразу      */
  /* после LC.hero.mount (чипы живут внутри узла героя).                    */
  /*                                                                       */
  /* Архитектура:                                                           */
  /*   Блок .lumen-moods монтируется ВНУТРЬ .lumen-hero__text (после       */
  /*   .lumen-hero__chips). Чипы имеют класс .selector, поэтому            */
  /*   пространственный Navigator Lampa (window.Navigator) находит их      */
  /*   геометрически: "вниз" из шапки и "вверх" из первого ряда            */
  /*   приходят на чипы без явного перехвата чужих контроллеров.           */
  /*   pointer-events: auto на .lumen-moods снимает ограничение            */
  /*   pointer-events: none с родителя .lumen-hero.                        */
  /*                                                                       */
  /* Навигация:                                                             */
  /*   Чипы — обычные .selector узлы внутри корня активной активности.    */
  /*   Navigator обходит их пространственно: стрелками влево/вправо        */
  /*   переходим между чипами, вверх — к шапке, вниз — к рядам.           */
  /*   После mount вызываем recollect(root) — обновляем снимок Navigator,  */
  /*   чтобы новые .selector узлы сразу попали в коллекцию.               */
  /*   Нажатие OK на чипе: Lampa диспатчит hover:enter на узле;            */
  /*   обработчик вызывает Lampa.Activity.push.                            */
  /* -------------------------------------------------------------------- */

  LC.moods = (function () {

    /* Сторож поколения: поднимается при mount/unmount.
       Любой отложенный колбэк сверяет захваченный gen с текущим. */
    var gen = 0;

    /* Единственный смонтированный блок: null или {root, node} */
    var state = null;

    function warn() {
      try { if (window.warn) window.warn.apply(window, arguments); } catch (e) {}
    }

    /* Возвращает локализованный заголовок настроения.
       mood.title — русская версия по умолчанию.
       Порядок: i18n[lang] → (если lang==='ru') mood.title → i18n.en → mood.title. */
    function moodTitle(mood, lang) {
      if (!mood) return '';
      if (mood.i18n && lang && mood.i18n[lang]) return mood.i18n[lang];
      /* Русский язык — это и есть mood.title; i18n.ru не заводится. */
      if (lang === 'ru') return mood.title || '';
      if (mood.i18n && mood.i18n.en) return mood.i18n.en;
      return mood.title || '';
    }

    /* URL-объект для Lampa.Activity.push при выборе настроения.
       Тип — 'movie' (все 4 настроения в манифесте имеют только movie-источник). */
    function moodActivityObj(mood) {
      var spec = mood.sources && mood.sources.movie;
      var media = spec ? 'movie' : 'tv';
      if (!spec) spec = mood.sources && mood.sources.tv;
      if (!spec) return null;
      var title = moodTitle(mood, '');
      if (spec.type === 'discover') {
        return {
          url: LC.sources.discoverUrl(spec, media),
          title: title,
          component: 'category_full',
          source: 'tmdb',
          page: 1
        };
      }
      return null;
    }

    /* Строит DOM-узел одного чипа с классом .selector —
       пространственный Navigator видит его геометрически.
       hover:enter на чипе: Lampa диспатчит событие при нажатии OK;
       слушаем в target-фазе (паттерн из 46_hub.js строки 847, 919, 998). */
    function buildChip(mood) {
      /* Язык интерфейса — через LC.langCode (src/80_settings.js), единый
         источник для заголовков из манифеста (его же зовёт хаб). Прежняя
         ветка искала Lampa.Lang.code(), которого в Lampa 3.3.4 нет: lang
         оставался пустым, и moodTitle отдавал английские названия при
         русском интерфейсе (видно живьём, Task 20). */
      var lang = typeof LC.langCode === 'function' ? LC.langCode() : 'ru';
      var title = moodTitle(mood, lang);
      var node = $('<div class="lumen-mood-chip selector"></div>');
      node.text(title);
      node[0].lumen_mood = mood;
      node.on('hover:enter', function () {
        var m = this.lumen_mood;
        if (!m) return;
        var obj = moodActivityObj(m);
        if (!obj) return;
        try { Lampa.Activity.push(obj); } catch (e) { warn('moods: push failed', e); }
      });
      return node;
    }

    /* Список настроений из манифеста. get() — публичный метод модуля
       (src/42_manifest.js): отдаёт загруженный каталог, а до первой
       загрузки — встроенный DEFAULT. Прежде здесь звалась current(),
       которой в публичном API нет (это приватная переменная модуля):
       ветка всегда была ложной, и чипы игнорировали каталог
       пользователя. */
    function moods() {
      try {
        if (LC.manifest && LC.manifest.get) {
          var m = LC.manifest.get();
          if (m && m.moods && m.moods.length) return m.moods;
        }
        if (LC.manifest && LC.manifest.DEFAULT && LC.manifest.DEFAULT.moods) {
          return LC.manifest.DEFAULT.moods;
        }
      } catch (e) {
        warn('moods: manifest read failed', e);
      }
      return [];
    }

    /* Строит узел блока чипов (.lumen-moods). */
    function buildNode(moodList) {
      var wrap = $('<div class="lumen-moods"></div>');
      for (var i = 0; i < moodList.length; i++) {
        wrap.append(buildChip(moodList[i]));
      }
      return wrap;
    }

    /* Обновляет снимок Navigator после добавления новых .selector узлов.
       Вызываем только когда наш корень лежит в активной активности
       (.activity--active), — иначе рискуем переключить Navigator на
       скрытый экран (паттерн из recollect в 55_trailer.js). */
    function recollect(root) {
      try {
        if (!window.Lampa || !Lampa.Controller) return;
        if (typeof Lampa.Controller.collectionSet !== 'function') return;
        /* Проверяем что root виден: он должен лежать внутри .activity--active. */
        var inActive = root.closest('.activity--active').length > 0;
        if (!inActive) return;
        var focused = root.find('.focus');
        Lampa.Controller.collectionSet(root[0]);
        if (typeof Lampa.Controller.collectionFocus === 'function') {
          Lampa.Controller.collectionFocus(focused && focused.length ? focused : false, root[0]);
        }
      } catch (e) {
        warn('moods: recollect failed', e);
      }
    }

    /* Монтирует блок чипов в .lumen-hero__text внутри root.
       Идемпотентен: если root тот же — повторный вызов ничего не делает. */
    function mount(root) {
      try {
        if (!root || !root.length) return;
        /* Task 20: выключенные в настройках чипы не монтируются вовсе —
           проверка стоит здесь, а не у вызывающих: точек монтирования три
           (событие 'start', mountCurrent, LC.applyMoodsPref). */
        if (!enabled()) { unmount(); return; }
        /* Тот же корень — повторное событие 'start' при возврате на главную:
           блок уже на месте, не пересобираем. */
        if (state && state.root && state.root[0] === root[0]) return;
        unmount();
        var moodList = moods();
        if (!moodList.length) return;
        /* Ищем текстовый блок героя — он лежит в том же root. */
        var text = root.find('.lumen-hero__text');
        if (!text.length) return;
        var node = buildNode(moodList);
        /* Добавляем после блока рейтинга/статуса (.lumen-hero__chips). */
        var chips = text.find('.lumen-hero__chips');
        if (chips.length) {
          chips.after(node);
        } else {
          text.append(node);
        }
        gen++;
        state = { root: root, node: node };
        /* Пересобрать снимок Navigator: новые .selector чипы должны
           войти в коллекцию немедленно, а не ждать следующего toggle. */
        recollect(root);
      } catch (e) {
        warn('moods: mount failed', e);
      }
    }

    /* Снимает блок и все его подписки. Идемпотентна. */
    function unmount() {
      if (!state) return;
      var s = state;
      state = null;
      gen++;
      try { s.node.remove(); } catch (eN) {}
    }

    /* Принадлежит ли смонтированный блок этой активности. */
    function ownedBy(render) {
      if (!state) return false;
      if (!render || !render.length) return false;
      if (state.root && state.root[0] === render[0]) return true;
      try {
        var act = state.root && state.root.closest ? state.root.closest('.activity') : null;
        if (act && act.length && act[0] === render[0]) return true;
      } catch (e) {}
      return false;
    }

    /* Снимает блок, если он не принадлежит стартующей активности.
       Симметрично LC.hero.detach — вызывается при каждом 'start'. */
    function detach(render) {
      if (!state) return;
      if (!render || !render.length) { unmount(); return; }
      if (ownedBy(render)) return;
      unmount();
    }

    /* Публичная проверка принадлежности — симметрично LC.hero.owns.
       Нужна рантайму на 'destroy': снимать блок можно ТОЛЬКО если он всё
       ещё принадлежит умирающей активности. */
    function owns(render) {
      return ownedBy(render);
    }

    function active() {
      return !!state;
    }

    /* Task 20: настройка «Профили настроения» (lumen_moods, по умолчанию
       включена). Читается на каждом монтировании — возврат из настроек Lampa
       экран не перерисовывает, применяет чипы LC.applyMoodsPref. */
    function enabled() {
      try { return LC.pref ? !!LC.pref('lumen_moods', true) : true; } catch (e) { return true; }
    }

    /* Task 20: смонтировать чипы на УЖЕ открытую главную — настройку
       включили из настроек Lampa, лежащих поверх неё, и события 'start'
       при возврате не будет (находка ревью Task 8, фаза 1). */
    function mountCurrent() {
      try {
        /* Lampa модулю приходит извне (как и остальным вызовам здесь), окно
           не трогаем: на тестовом стенде его нет. */
        if (!Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main') return;
        if (!act.activity || typeof act.activity.render !== 'function') return;
        mount(act.activity.render());
      } catch (e) {
        warn('moods: mountCurrent failed', e);
      }
    }

    /* Important 2 (fix-раунд итогового ревью фазы 2): своей подписки на
       'activity' модуль НЕ заводит. Подписка на плагин ровно одна —
       LC.onActivityEvent в src/90_runtime.js; она же монтирует чипы сразу
       после LC.hero.mount (чипы живут ВНУТРИ .lumen-hero__text, так что
       порядок обязателен) и снимает их через detach/owns.
       Причина: Subscribe.send вендора оборачивает весь цикл подписчиков
       одним try/catch — исключение у более раннего подписчика оборвало бы
       рассылку всем следующим, и наши чипы жили бы только по везению в
       порядке подписки.

       install/uninstall остались гейтом настройки: плагин включили —
       ставим чипы на уже открытую главную (возврат из настроек Lampa
       события 'start' не шлёт, ровно как у LC.hero.mountCurrent() в
       activate()); выключили — снимаем. */
    function install() {
      mountCurrent();
    }

    function uninstall() {
      unmount();
    }

    return {
      moodTitle: moodTitle,
      mount: mount,
      mountCurrent: mountCurrent,
      unmount: unmount,
      detach: detach,
      owns: owns,
      active: active,
      install: install,
      uninstall: uninstall
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.moods;

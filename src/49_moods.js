/* -------------------------------------------------------------------- */
  /* LC.moods — чипы профиля настроения на главной (Task 19).             */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   moodTitle(mood, lang) — строка названия настроения                  */
  /*   mount(root) — вставить блок чипов в корень главной                  */
  /*   mountCurrent() — то же для уже открытой главной (Task 20)           */
  /*   unmount() — снять блок                                               */
  /*   detach(render) — снять, если блок не принадлежит этой активности    */
  /*   owns(render) — принадлежит ли блок этой активности                  */
  /*   active() — смонтирован ли блок                                      */
  /*   install() — гейт настройки: поставить чипы на открытую главную      */
  /*   uninstall() — гейт настройки: снять чипы                            */
  /*                                                                       */
  /* Событий Lampa модуль не слушает: монтирует и снимает чипы единственная */
  /* подписка плагина — LC.onActivityEvent в src/90_runtime.js.             */
  /*                                                                       */
  /* Архитектура:                                                           */
  /*   Волна 3 (проверка на ТВ 2026-09-24, решение координатора): при      */
  /*   ЖИВОМ кадре героя чипов на главной нет. С Task 36 они лежали в       */
  /*   слоте .lumen-hero__moods текста героя; пользователь просил меньше   */
  /*   текста в кадре, а подборки и так есть в хабе и меню. Своим узлом    */
  /*   рядом с кадром их тоже не ставим: полоса легла бы на ряды, а        */
  /*   опускать ряды под неё запрещено (подпись первого ряда обязана       */
  /*   остаться на экране телевизора).                                     */
  /*   Кадра нет («Кадр над рядами: выключен») — как было: блок            */
  /*   .lumen-moods монтируется собственным узлом в корень активности      */
  /*   главной, последним её ребёнком, и класс .lumen-moods-on на корне    */
  /*   опускает под него ряды (src/30_css.js). Чипы имеют класс            */
  /*   .selector, поэтому пространственный Navigator Lampa                 */
  /*   (window.Navigator) находит их геометрически, без перехвата чужих    */
  /*   контроллеров. Замер живьём (фаза 3): шаг «вверх» с ПЕРВОГО ряда     */
  /*   чипам не достаётся — контроллер items_line отдаёт фокус шапке Lampa */
  /*   сам; так было и когда блок лежал внутри героя, и когда он стоял     */
  /*   отдельным узлом, — переезды этого не меняли.                        */
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

    /* Наполняет чипами свой узел .lumen-moods. */
    function fillChips(wrap, moodList) {
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
        /* Проверяем что root виден — общим правилом «на экране»
           (LC.util.onScreen, src/10_util.js). root здесь — сама активность
           главной (e.object.activity.render(), у неё класс activity), поэтому
           closest('.activity') находит её же, и ответ прежний: «на экране»,
           только если на ней стоит activity--active. */
        if (!LC.util.onScreen(root)) return;
        var focused = root.find('.focus');
        Lampa.Controller.collectionSet(root[0]);
        if (typeof Lampa.Controller.collectionFocus === 'function') {
          Lampa.Controller.collectionFocus(focused && focused.length ? focused : false, root[0]);
        }
      } catch (e) {
        warn('moods: recollect failed', e);
      }
    }

    /* Монтирует блок чипов в корень активности главной.
       Идемпотентен: если root тот же — повторный вызов ничего не делает. */
    function mount(root) {
      try {
        if (!root || !root.length) return;
        /* Task 20: выключенные в настройках чипы не монтируются вовсе —
           проверка стоит здесь, а не у вызывающих: точек монтирования три
           (событие 'start', mountCurrent, LC.applyMoodsPref). */
        if (!enabled()) { unmount(); return; }
        /* Волна 3: живой кадр героя в корне — чипов на главной нет (разбор в
           шапке модуля). Смотрим на сам узел героя, а не на запомненное
           состояние: ревью Task 36 (находка К1) — смена «Размера кадра» на
           ЖИВОЙ главной ставит или снимает героя, не трогая активность, и
           корень при этом тот же самый. Порядок вызовов держит рантайм:
           чипы монтируются ПОСЛЕ героя (src/90_runtime.js). */
        if (root.children('.lumen-hero').length) { unmount(); return; }
        /* Тот же корень — повторное событие 'start' при возврате на главную:
           блок уже на месте. */
        if (state && state.root && state.root[0] === root[0]) return;
        unmount();
        var moodList = moods();
        if (!moodList.length) return;
        /* Свой узел последним ребёнком корня активности, чтобы чипы
           рисовались поверх всего; класс .lumen-moods-on на корне опускает
           под их полосу ряды (правила .lumen-moods-on:not(.lumen-main) в
           src/30_css.js). */
        var node = $('<div class="lumen-moods"></div>');
        fillChips(node, moodList);
        root.append(node);
        root.addClass('lumen-moods-on');
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
      /* Признак раскладки уходит вместе с узлом: иначе без чипов ряды
         остались бы опущенными под несуществующую полосу. */
      try { s.root.removeClass('lumen-moods-on'); } catch (eC) {}
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
       LC.onActivityEvent в src/90_runtime.js; она же монтирует чипы после
       героя и снимает их через detach/owns. Порядок относительно
       LC.hero.mount важен (волна 3): mount смотрит, стоит ли в корне узел
       героя, — при живом кадре чипов нет.
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

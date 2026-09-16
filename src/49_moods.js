/* -------------------------------------------------------------------- */
  /* LC.moods — чипы профиля настроения на главной (Task 19).             */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   moodTitle(mood, lang) → строка названия настроения                  */
  /*   mount(root) — вставить блок чипов в текст героя текущей главной     */
  /*   unmount() — снять блок, контроллер и все подписки                   */
  /*   detach(render) — снять, если блок не принадлежит этой активности    */
  /*   active() → смонтирован ли блок                                      */
  /*   install() — подписаться на события активности Lampa                  */
  /*   uninstall() — снять подписки и unmount                              */
  /*                                                                       */
  /* Архитектура:                                                           */
  /*   Блок .lumen-moods монтируется ВНУТРЬ .lumen-hero__text (после       */
  /*   .lumen-hero__chips). Это позволяет использовать позиционирование    */
  /*   самого текстового блока героя без дублирования CSS.                 */
  /*   pointer-events: auto на .lumen-moods снимает ограничение            */
  /*   pointer-events: none с родителя .lumen-hero.                        */
  /*                                                                       */
  /* Навигация (минимально допустимый вариант из плана, §Task 19):         */
  /*   Чипы доступны из шапки: head → down → lumen_moods → down → content. */
  /*   Переход head→lumen_moods: при монтировании перехватываем текущий    */
  /*   обработчик head.down; при unmount восстанавливаем.                  */
  /*   Переход content→lumen_moods (вверх из первого ряда) — не            */
  /*   реализуется без правки штатного контроллера Lampa; путь записан в   */
  /*   acceptance ниже.                                                    */
  /*                                                                       */
  /* Acceptance (Task 19):                                                  */
  /*   - Выбранный путь навигации: head → down → lumen_moods → down →      */
  /*     content. Переход из первого ряда вверх → head (штатно), затем    */
  /*     head → down → чипы.                                               */
  /*   - Перехват head.down: сохраняем исходный обработчик и ставим свой;  */
  /*     unmount восстанавливает оригинал.                                  */
  /*   - Переход content→lumen_moods не реализован (нет штатной точки      */
  /*     перехвата без патча Lampa).                                        */
  /* -------------------------------------------------------------------- */

  LC.moods = (function () {

    /* Сторож поколения: поднимается при mount/unmount.
       Любой отложенный колбэк сверяет захваченный gen с текущим. */
    var gen = 0;

    /* Единственный смонтированный блок: null или {root, node, ctrl} */
    var state = null;

    /* Исходный обработчик down у контроллера head — восстанавливаем при unmount. */
    var origHeadDown = null;
    var headPatched = false;

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

    /* Строит DOM-узел одного чипа. */
    function buildChip(mood) {
      var lang = typeof LC.lang === 'function' ? LC.lang._lang || '' : '';
      try {
        if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.code === 'function') lang = Lampa.Lang.code();
      } catch (e) {}
      var title = moodTitle(mood, lang);
      var node = $('<div class="lumen-mood-chip selector"></div>');
      node.text(title);
      node[0].lumen_mood = mood;
      return node;
    }

    /* Список настроений из манифеста. */
    function moods() {
      try {
        if (LC.manifest && LC.manifest.current) {
          var m = LC.manifest.current();
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

    /* URL для Lampa.Activity.push при выборе настроения.
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

    /* Строит узел блока чипов (.lumen-moods). */
    function buildNode(moodList) {
      var wrap = $('<div class="lumen-moods"></div>');
      for (var i = 0; i < moodList.length; i++) {
        var chip = buildChip(moodList[i]);
        wrap.append(chip);
      }
      return wrap;
    }

    /* Возвращает массив чипов (узлов .selector) внутри state.node. */
    function chipNodes() {
      if (!state || !state.node) return [];
      return state.node.find('.lumen-mood-chip').toArray();
    }

    /* Возвращает индекс сфокусированного чипа или -1. */
    function focusedIndex() {
      var chips = chipNodes();
      for (var i = 0; i < chips.length; i++) {
        if ($(chips[i]).hasClass('focus')) return i;
      }
      return -1;
    }

    /* Устанавливает фокус на чип по индексу. */
    function focusChip(idx) {
      var chips = chipNodes();
      if (!chips.length) return;
      if (idx < 0) idx = 0;
      if (idx >= chips.length) idx = chips.length - 1;
      for (var i = 0; i < chips.length; i++) $(chips[i]).removeClass('focus');
      $(chips[idx]).addClass('focus');
    }

    /* Регистрирует контроллер lumen_moods.
       toggle: устанавливает фокус на первый (или последний выбранный) чип.
       left/right: листание между чипами.
       up: переход к head.
       down: переход к content (ряды).
       back: переход к head. */
    function registerController() {
      try {
        Lampa.Controller.add('lumen_moods', {
          toggle: function () {
            var idx = focusedIndex();
            focusChip(idx < 0 ? 0 : idx);
          },
          left: function () {
            var idx = focusedIndex();
            if (idx > 0) focusChip(idx - 1);
          },
          right: function () {
            var idx = focusedIndex();
            var chips = chipNodes();
            if (idx < chips.length - 1) focusChip(idx + 1);
          },
          up: function () {
            Lampa.Controller.toggle('head');
          },
          down: function () {
            Lampa.Controller.toggle('content');
          },
          back: function () {
            Lampa.Controller.toggle('head');
          },
          enter: function () {
            var idx = focusedIndex();
            var chips = chipNodes();
            if (idx < 0 || idx >= chips.length) return;
            var mood = chips[idx].lumen_mood;
            if (!mood) return;
            var obj = moodActivityObj(mood);
            if (!obj) return;
            try { Lampa.Activity.push(obj); } catch (e) { warn('moods: push failed', e); }
          }
        });
      } catch (e) {
        warn('moods: controller add failed', e);
      }
    }

    /* Перехватывает down у контроллера head, чтобы head → down → lumen_moods.
       Сохраняет оригинал и восстанавливает при unmount. */
    function patchHead() {
      try {
        if (headPatched) return;
        var ctrl = Lampa.Controller.get ? Lampa.Controller.get('head') : null;
        if (!ctrl) return;
        origHeadDown = ctrl.down || null;
        ctrl.down = function () {
          /* Переходим в чипы только если блок смонтирован. */
          if (state && state.node && state.node[0] && document.body && document.body.contains(state.node[0])) {
            try { Lampa.Controller.toggle('lumen_moods'); } catch (e) {}
          } else if (origHeadDown) {
            origHeadDown.call(this);
          } else {
            try { Lampa.Controller.toggle('content'); } catch (e) {}
          }
        };
        headPatched = true;
      } catch (e) {
        warn('moods: patch head failed', e);
      }
    }

    /* Снимает перехват down у контроллера head. */
    function unpatchHead() {
      try {
        if (!headPatched) return;
        var ctrl = Lampa.Controller.get ? Lampa.Controller.get('head') : null;
        if (ctrl) {
          if (origHeadDown) {
            ctrl.down = origHeadDown;
          } else {
            delete ctrl.down;
          }
        }
        origHeadDown = null;
        headPatched = false;
      } catch (e) {
        warn('moods: unpatch head failed', e);
      }
    }

    /* Монтирует блок чипов в .lumen-hero__text внутри root.
       Идемпотентен: если root тот же — повторный вызов ничего не делает. */
    function mount(root) {
      try {
        if (!root || !root.length) return;
        /* Тот же корень — повторное событие 'start' главной при возврате:
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
        registerController();
        patchHead();
        /* Обработчик enter для чипов через Lampa-паттерн hover:enter. */
        node.on('click', '.lumen-mood-chip', function () {
          var mood = this.lumen_mood;
          if (!mood) return;
          var obj = moodActivityObj(mood);
          if (!obj) return;
          try { Lampa.Activity.push(obj); } catch (e) { warn('moods: click push failed', e); }
        });
      } catch (e) {
        warn('moods: mount failed', e);
      }
    }

    /* Снимает блок, перехват head.down и контроллер. Идемпотентна. */
    function unmount() {
      if (!state) return;
      var s = state;
      state = null;
      gen++;
      try { s.node.remove(); } catch (eN) {}
      unpatchHead();
      /* Контроллер удалить нельзя (Lampa API нет remove), но он безвреден
         без смонтированного блока — toggle на отсутствующие узлы ничего не делает. */
    }

    /* Снимает блок, если он не принадлежит стартующей активности.
       Симметрично LC.hero.detach — вызывается при каждом 'start'. */
    function detach(render) {
      if (!state) return;
      if (!render || !render.length) { unmount(); return; }
      if (state.root && state.root[0] === render[0]) return;
      try {
        var act = state.root && state.root.closest ? state.root.closest('.activity') : null;
        if (act && act.length && act[0] === render[0]) return;
      } catch (e) {}
      unmount();
    }

    function active() {
      return !!state;
    }

    /* Подписчик событий Lampa Activity: монтирует/снимает блок чипов.
       Хранится как замыкание, чтобы uninstall мог снять именно эту функцию. */
    var _listener = null;

    function install() {
      if (_listener) return;
      _listener = function (e) {
        try {
          if (!e) return;
          if (e.type === 'start') {
            var startRender = null;
            try {
              if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                startRender = e.object.activity.render();
              }
            } catch (eR) {}
            detach(startRender);
            if (e.component === 'main' && startRender && startRender.length) {
              mount(startRender);
            }
          } else if (e.type === 'destroy') {
            var deadRender = null;
            try {
              if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                deadRender = e.object.activity.render();
              }
            } catch (eD) {}
            if (state && deadRender && state.root && state.root[0] === deadRender[0]) {
              unmount();
            }
          }
        } catch (eEv) {
          warn('moods: event handler failed', eEv);
        }
      };
      try {
        Lampa.Listener.follow('activity', _listener);
      } catch (e) {
        warn('moods: follow failed', e);
        _listener = null;
      }
    }

    function uninstall() {
      if (_listener) {
        try { Lampa.Listener.remove('activity', _listener); } catch (e) {}
        _listener = null;
      }
      unmount();
    }

    return {
      moodTitle: moodTitle,
      mount: mount,
      unmount: unmount,
      detach: detach,
      active: active,
      install: install,
      uninstall: uninstall
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.moods;

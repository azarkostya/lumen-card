  /* -------------------------------------------------------------------- */
  /* Поиск корня карточки в событии 'full' (build/complite).                */
  /* -------------------------------------------------------------------- */

  function findRoot(e) {
    var root = null;
    try {
      if (e.item && typeof e.item.render === 'function') {
        var html = e.item.render();
        if (html && html.hasClass && html.hasClass('full-start-new')) root = html;
      }
    } catch (err) { }
    if ((!root || !root.length) && e.body && e.body.find) {
      try { root = e.body.find('.full-start-new.lumen-card').eq(0); } catch (err2) { }
    }
    return root;
  }

  /* -------------------------------------------------------------------- */
  /* Раскладка.                                                            */
  /* -------------------------------------------------------------------- */

  function isWideLayout() {
    var width = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    if (width && width <= 480) return false;
    var tv = false;
    try {
      if (window.Lampa && Lampa.Platform && typeof Lampa.Platform.screen === 'function') tv = !!Lampa.Platform.screen('tv');
    } catch (e) { }
    return tv || width > 480;
  }

  /* -------------------------------------------------------------------- */
  /* Task 4: режим анимаций и компактная шапка.                            */
  /* -------------------------------------------------------------------- */

  var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';

  function activeCardRoot() {
    try { return $('.activity--active .lumen-card'); } catch (e) { return null; }
  }

  /* Task 6 (fix, обзор координатора п.2, корень проблемы): .lumen-backdrop
     лежит вне .lumen-card (сосед в e.body, не потомок — см. 50_backdrops.js/
     ensureLayer) — раньше LC.applyMotionMode трогал только .lumen-card,
     а класс режима на самом слое фона синхронизировал исключительно
     syncMotionClass() внутри apply()/loadBackdrop(), один раз за карточку.
     Из-за этого переключение lumen_motion full->lite/off на уже открытой
     карточке не снимало lumen-motion-full со слоя — Ken Burns (src/
     51_slideshow.js, setActive: layer.hasClass('lumen-motion-full')) играл
     бы до следующего apply() (то есть до закрытия и повторного открытия
     карточки). */
  function activeBackdropLayer() {
    try { return $('.activity--active .lumen-backdrop'); } catch (e) { return null; }
  }

  function applyMotionMode(root) {
    if (!root || !root.length) return;
    try {
      root.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
    } catch (e) {
      warn('motion mode failed', e);
    }
  }

  /* Вызывается извне (LC.followStorage / onChange параметра lumen_motion), когда режим
     меняется на уже открытой карточке — находит активный корень (и слой фона) сама. */
  LC.applyMotionMode = function () {
    applyMotionMode(activeCardRoot());
    applyMotionMode(activeBackdropLayer());
  };

  var toggle_followed = false;

  /* Одна подписка на переключение контроллера за всё время жизни плагина (не на карточку):
     спуск с кнопок на ряд описания/серий сжимает шапку, подъём обратно на кнопки — возвращает.
     Task 7 добавит сюда же остановку трейлера. */
  function followToggle() {
    if (toggle_followed) return;
    toggle_followed = true;
    try {
      if (!window.Lampa || !Lampa.Controller || !Lampa.Controller.listener) return;
      Lampa.Controller.listener.follow('toggle', function (e) {
        try {
          if (!e || !e.name) return;
          var root = activeCardRoot();
          if (!root || !root.length) return;
          if (e.name === 'full_descr' || e.name === 'items_line') root.addClass('lumen-compact');
          else if (e.name === 'full_start') root.removeClass('lumen-compact');
        } catch (err) {
          warn('controller toggle failed', err);
        }
      });
    } catch (e2) {
      warn('controller listener failed', e2);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Task 5b (правки координатора, п.4): хук закрытия карточки.             */
  /* -------------------------------------------------------------------- */

  /* Активность открытой карточки — {object, body, slideshow} с события
     'full' complite. Одно значение, не стек: если вторая карточка
     открылась раньше, чем destroy первой дошёл до слушателя, LC.active уже
     указывает на вторую — destroy первой тогда просто пропускается (её
     слой всё равно самоочистится через isMounted() в 50_backdrops.js, это
     лишь более раннее/явное закрытие для типичного случая). slideshow —
     контроллер {pause,resume,destroy} из LC.backdrops.apply() (Task 6). */
  LC.active = null;

  var activity_followed = false;

  /* Достаёт .lumen-backdrop из e.object.activity.render() той активности,
     о которой пришло событие (любой 'full', не обязательно LC.active).

     Проверено живьём: e.object.activity.render() возвращает ВНЕШНИЙ
     .activity-контейнер (class="activity layer--width…"), а не e.body из
     события 'full' — .lumen-backdrop лежит на уровень глубже, внутри
     .activity__body (прямой потомок .activity), поэтому
     .children('.lumen-backdrop') здесь мимо (нашёл это именно так:
     .children дал 0, .find — 1). Ищем через find() (любая глубина); тело,
     в которое LC.backdrops.apply()/ensureLayer() когда-то сделал
     body.prepend(layer), — это layer.parent(), так что
     LC.backdrops.cancel(layer.parent()) снова найдёт слой через свой
     body.children(...). Возвращает layer (length может быть 0) или null,
     если у e.object вообще нет activity.render(). */
  function layerOf(object) {
    try {
      if (!object || !object.activity || typeof object.activity.render !== 'function') return null;
      var rendered = object.activity.render();
      return rendered && rendered.find ? rendered.find('.lumen-backdrop') : null;
    } catch (e) {
      return null;
    }
  }

  /* Ревью (fix, Important 1): контроллер s жив — вернуть как есть. Мёртв
     (уничтожен isLayerMounted()-страховкой в src/51_slideshow.js — Lampa
     ActivitySlide.stop() тихо убрал DOM 2+ уровня назад в истории, БЕЗ
     единого события Listener — план 0.2/находка Task 6) или отсутствует —
     пересобрать через LC.backdrops.revive(layer) (см. обоснование выбора
     в комментарии над revive() — src/50_backdrops.js).

     Раньше это было только во второй ветке ниже ('start' карточки, которая
     уже НЕ LC.active). Реальный частый сценарий этого не покрывал: A ->
     actor -> список (actor/список — не 'full', 'full':complite для них не
     шлётся, LC.active всё это время остаётся {object:A, ...}) -> A сама
     уходит на 2+ уровня в историю -> ActivitySlide.stop() -> тик
     isLayerMounted() уничтожает контроллер A -> backward() до A -> 'start'
     для A, но e.object === LC.active.object (LC.active так и не менялся!)
     -> ПЕРВАЯ ветка ('archive'|'start' своей активности) звала resume() на
     уже мёртвом контроллере без проверки — молчаливый застой. Теперь обе
     ветки (своя активность и "восстановленная" чужая) проходят через один
     и тот же помощник. */
  function liveSlideshow(layer, s) {
    if (!layer || !layer.length) return s;
    var dead = !s || (typeof s.isAlive === 'function' && !s.isAlive());
    if (!dead) return s;
    return LC.backdrops.revive(layer) || s;
  }

  /* Единственный обработчик подписки 'activity' за всё время жизни
     плагина (правки координатора к Task 6: вторую подписку не заводить).
     Вынесен в именованную LC.onActivityEvent — LC.init() только подписывает
     её (followActivityLifecycle ниже), а test/runtime.test.mjs вызывает её
     напрямую с фейковыми e/Lampa/$, без реальной Lampa.

     Реальные события Lampa 3.3.4 при push/backward (проверено исходником
     vendor/lampa/app.min.js — функции push$3/backward()/start$4 — и живым
     логом Lampa.Listener.follow('activity', …) до/после вызовов):
       - Activity.push(новая карточка) — уход вглубь — НЕ шлёт вообще
         никакого события для карточки, которую оставляют позади (ни
         archive, ни pause/stop). Она просто продолжает жить в стеке.
       - Activity.push тому, кто открывается, шлёт init -> create -> start
         (e.component — реальное имя компонента, у карточки — 'full';
         проверено логом).
       - backward() шлёт destroy для покидаемой активности и, для той,
         К КОТОРОЙ ВОЗВРАЩАЮТСЯ, — start$4() уже шлёт start, а следом сама
         backward() шлёт ЕЩЁ и archive (тот же e.object). То есть archive
         в этой сборке означает «снова на экране», а не «ушли в фон» —
         обратное плановому предположению archive->pause.
     Отсюда следствия (решение координатора по live-check п.4 и fix-раунду):
       1) «Пауза при уходе вглубь» через эту подписку недостижима (push
          ничего не шлёт для оставленной активности) — реализована не
          здесь, а проверкой isLayerForeground() в каждом тике таймера
          слайдшоу (src/51_slideshow.js, tryFrom): если слой сейчас не в
          .activity.activity--active, тик молча пропускается, таймер не
          трогаем — как заново на экране, тик снова меняет кадр.
       2) 'start' и 'archive' СВОЕЙ активности (LC.active уже указывает на
          неё) — оба означают «видна снова» -> resume() (resume() дважды
          безопасен).
       3) Возврат backward() на карточку, которая уже не LC.active (за это
          время открылась и была complite-нута другая) — LC.active так и
          не восстанавливается событием 'full' (Lampa не шлёт complite
          повторно на backward, только 'activity':start/archive). Поэтому
          на 'start' ЛЮБОЙ 'full'-активности, если это не текущая
          LC.active, ищем в её DOM уже готовый слой .lumen-backdrop
          (значит, карточка уже строилась раньше) и восстанавливаем
          LC.active по нему — контроллер слайдшоу достаём из
          layer.data('lumenSlideshow') (положен туда LC.backdrops.apply()),
          а не храним отдельно, поэтому найти его можно в любой момент.
       4) Осиротевшие карточки (fix, Important): в цепочке A -> B -> C
          (LC.active уже C) 'destroy' карточки A или B (Lampa шлёт его при
          вытеснении по лимиту истории maxsave, не только на backward())
          не совпадает ни с одной веткой выше — но если у A/B уже есть
          .lumen-backdrop, её таймер иначе тикал бы до СЛЕДУЮЩЕГО своего
          интервала, когда isLayerMounted() сам заметит пропавший DOM
          (secondhand self-heal, уже был в fix #1). Здесь — немедленно:
          destroy ЛЮБОЙ (не только LC.active) активности с готовым слоем ->
          LC.backdrops.cancel(layer.parent()) сразу же. */
  LC.onActivityEvent = function (e) {
    try {
      if (!e) return;

      if (LC.active && e.object === LC.active.object) {
        if (e.type === 'destroy') {
          LC.backdrops.cancel(LC.active.body);
          LC.active = null;
        } else if (e.type === 'archive' || e.type === 'start') {
          /* Ревью (fix, Important 1): та же самая liveSlideshow() — своя
             активность тоже может дойти сюда с уже мёртвым контроллером
             (A -> не-full активности -> A сама ActivitySlide.stop()'нута,
             LC.active всё это время не менялся, см. комментарий над
             liveSlideshow()). */
          LC.active.slideshow = liveSlideshow(layerOf(e.object), LC.active.slideshow);
          if (LC.active.slideshow) LC.active.slideshow.resume();
        }
        return;
      }

      if (e.type === 'destroy') {
        var orphanLayer = layerOf(e.object);
        if (orphanLayer && orphanLayer.length) LC.backdrops.cancel(orphanLayer.parent());
        return;
      }

      /* e.object !== LC.active.object (или LC.active вовсе null): для
         свежей, ещё не построенной карточки слоя нет — layerOf() вернёт
         пустой/null, ветка тихо no-op (нормальный путь на самый первый
         'start' любого push, ДО того как 'full' complite впервые выставит
         LC.active). Для карточки, к которой вернулись через backward(),
         слой уже есть — восстанавливаем LC.active (liveSlideshow() —
         оживит контроллер при необходимости, см. комментарий над ней). */
      if (e.type === 'start' && e.component === 'full') {
        var layer = layerOf(e.object);
        if (layer && layer.length) {
          var slideshow = liveSlideshow(layer, layer.data('lumenSlideshow'));
          LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow };
          if (slideshow) slideshow.resume();
        }
      }
    } catch (err) {
      warn('activity listener failed', err);
    }
  };

  function followActivityLifecycle() {
    if (activity_followed) return;
    activity_followed = true;
    try {
      if (!window.Lampa || !Lampa.Listener) return;
      Lampa.Listener.follow('activity', LC.onActivityEvent);
    } catch (e2) {
      warn('activity listener failed', e2);
    }
  }

  /* Task 6: lumen_slideshow/lumen_slide_interval меняются на уже открытой
     карточке через LC.followStorage (80_settings.js). pause()+resume() —
     единственные операции на контроллере (план: LC.active.slideshow =
     {pause,resume,destroy}), поэтому оба случая идут через них: выключили
     — pause() без resume() (остановка на текущем кадре); включили или
     сменили интервал — resume() читает slideIntervalMs()/lumen_slideshow
     заново и either запускает ротацию, либо (если всё ещё выключено)
     остаётся no-op. */
  LC.applySlideshowPref = function () {
    try {
      if (!LC.active || !LC.active.slideshow) return;
      LC.active.slideshow.pause();
      if (LC.pref('lumen_slideshow', true)) LC.active.slideshow.resume();
    } catch (e) {
      warn('slideshow pref failed', e);
    }
  };

  /* Task 31: плагин активен — LC.init дошёл до оформления (широкая
     раскладка, шаблон поддерживается). Пока false, смена lumen_menus/
     lumen_torrents не должна ставить наши классы ни на body, ни на экраны. */
  var ui_active = false;

  LC.applyMenusPref = function () {
    if (!ui_active) return;
    try {
      LC.menus.mode(Lampa.Storage.field('lumen_menus'));
    } catch (e) {
      warn('menus pref failed', e);
    }
  };

  /* LC.torrents появится в Task 32; до этого настройка просто сохраняется.
     LC.pref нормализует строки 'true'/'false' из Storage. */
  LC.applyTorrentsPref = function () {
    if (!ui_active) return;
    try {
      if (LC.torrents && typeof LC.torrents.toggle === 'function') LC.torrents.toggle(LC.pref('lumen_torrents', true));
    } catch (e) {
      warn('torrents pref failed', e);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Инициализация.                                                        */
  /* -------------------------------------------------------------------- */

  var original_template = '';

  function saveOriginalTemplate() {
    try {
      if (Lampa.Template && typeof Lampa.Template.all === 'function') {
        var all = Lampa.Template.all();
        if (all && all.full_start_new) {
          original_template = all.full_start_new;
          return;
        }
      }
    } catch (e) { }
    try {
      /* Сигнатура: Template.get(name, vars, like_static) -> строка */
      original_template = Lampa.Template.get('full_start_new', {}, true) || '';
    } catch (e2) {
      warn('cannot save original template', e2);
    }
  }

  function restoreOriginalTemplate() {
    try {
      if (original_template) Lampa.Template.add('full_start_new', original_template);
    } catch (e) {
      warn('cannot restore original template', e);
    }
  }

  LC.init = function () {
    try {
      if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;

      try { if (Lampa.Lang && typeof Lampa.Lang.add === 'function') Lampa.Lang.add(LC.STRINGS); } catch (e) { }

      LC.addSettings();
      LC.followStorage();

      if (!isWideLayout()) return;

      saveOriginalTemplate();

      /* Task 5/5a Step 1: build() вернул null ИЛИ ours не проходит assert
         (не хватает обязательных классов/языковых ключей из REQUIRED) ->
         версия Lampa не поддерживается, штатный шаблон не подменяем. */
      var tpl = LC.template.build(original_template);
      var check = tpl ? LC.template.assert(original_template, tpl) : null;
      if (!tpl || !check.ok) {
        warn('template not supported' + (check ? ': missing ' + check.missingInOurs.join(', ') : ' (build failed)'));
        try {
          if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show('Lumen Card: версия Lampa не поддерживается');
        } catch (e3) { }
        return;
      }
      Lampa.Template.add('full_start_new', tpl);

      LC.injectFonts();
      LC.injectCss();

      ui_active = true;
      try {
        LC.menus.mode(Lampa.Storage.field('lumen_menus'));
        LC.menus.install();
      } catch (e4) {
        warn('menus init failed', e4);
      }

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            LC.header.decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            var root = findRoot(e);
            LC.header.decorate(root, e.data);
            var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
            LC.active = { object: e.object, body: e.body, slideshow: slideshow };
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });

      followToggle();
      followActivityLifecycle();
    } catch (e) {
      warn('init failed', e);
      restoreOriginalTemplate();
    }
  };

  /* Безопасный старт. Если Lampa ещё не загрузилась — подождём. */
  LC.boot = function (attempt) {
    attempt = attempt || 0;
    if (typeof window.Lampa === 'undefined') {
      if (attempt > 40) return;
      setTimeout(function () { LC.boot(attempt + 1); }, 250);
      return;
    }
    if (window.appready) LC.init();
    else {
      Lampa.Listener.follow('app', function (e) {
        if (e.type === 'ready') LC.init();
      });
    }
  };

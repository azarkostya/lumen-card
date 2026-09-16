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

  /* Task 5d: узел ряда описания. На 'build' с name === 'description' Lampa
     даёт e.item — экземпляр под-компонента, его render() возвращает корень
     ряда (items_line, внутри .items-line__body -> .full-descr). На 'complite'
     (запасной путь, если build прошёл мимо — например, ряд достроился лениво)
     e.item нет вовсе: тогда ищем .full-descr в корне компонента и берём её
     родителя — разметка ряда внутри одна и та же, а e.body ограничивает поиск
     текущей карточкой, не задевая карточки из истории Lampa. */
  function findDescrRow(e) {
    try {
      if (e.item && typeof e.item.render === 'function') {
        var html = e.item.render();
        if (html && html.length) return html;
      }
    } catch (err) { }
    if (e.body && e.body.find) {
      try {
        var found = e.body.find('.full-descr');
        if (found && found.length) {
          /* Живьём (Task 5d): parent() у .full-descr — это .items-line__body, а
             render() на 'build' отдаёт .items-line уровнем выше. Оба пути обязаны
             указывать на ОДИН узел, иначе класс .lumen-descr-row оказывается на
             двух вложенных сразу (проверено: rowsWithClass 2). */
          var line = found.closest('.items-line');
          return line && line.length ? line : found.parent();
        }
      } catch (err2) { }
    }
    return null;
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

  /* Task 32: экраны пути TorrServer (src/65_torrents.js) лежат вне карточки —
     Select, Modal, media-loading; режим движения для них читается с body. */
  function bodyRoot() {
    try { return $('body'); } catch (e) { return null; }
  }

  /* Вызывается извне (LC.followStorage / onChange параметра lumen_motion), когда режим
     меняется на уже открытой карточке — находит активный корень (и слой фона) сама.
     На body — только пока плагин активен (ui_active, см. ниже). */
  LC.applyMotionMode = function () {
    applyMotionMode(activeCardRoot());
    applyMotionMode(activeBackdropLayer());
    if (ui_active) applyMotionMode(bodyRoot());
  };

  var toggle_followed = false;

  /* Task 7 (находка живой проверки): «фокус ушёл с full_start» НЕЛЬЗЯ
     понимать как «пришёл toggle с именем != full_start».

     Замер в живой Lampa 3.3.4 — события Controller.listener 'toggle', мс
     от 'full':complite: content -201, content -200, content +3,
     full_start +4, content +5. То есть при открытии карточки Lampa встаёт
     на 'full_start' и ТУТ ЖЕ возвращается на 'content' (toggle$2 шлёт имя
     НОВОГО контроллера, инверсии нет — проверено исходником, app.min.js
     ~46296). С признаком «любое имя != full_start» трейлер гас на этом
     же +5 мс: stopActive() снимал таймер 3 с, и плеер не появлялся вовсе —
     ни iframe, ни запроса iframe_api (симптом: LC.active.trailer === null
     при том, что schedule() вернул контроллер).

     Поэтому уходом считаем переключение, которое (1) случилось ПОСЛЕ того,
     как карточка реально получила фокус, и (2) ведёт не на 'content'.
     'content' — контроллер каталога/рядов активности: если пользователь
     действительно ушёл в каталог, карточка уничтожается или архивируется,
     и трейлер снимает LC.backdrops.cancel через слой (layer.data
     'lumenTrailer') — ни одной настоящей остановки это исключение не
     теряет. На каждой новой карточке признак сбрасывается в complite —
     иначе фокус, оставшийся от ПРЕДЫДУЩЕЙ карточки, погасил бы трейлер
     следующей. */
  var focus_on_card = false;

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
          /* Task 7: фокус ушёл с кнопок карточки (вниз по карточке, в меню,
             в открывшееся окно) — фоновый трейлер снимаем. Вторую подписку
             на 'toggle' не заводим, это та же самая (поправки координатора).
             Про признак focus_on_card — см. комментарий у его объявления. */
          if (e.name === 'full_start') focus_on_card = true;
          else if (focus_on_card && e.name !== 'content') {
            focus_on_card = false;
            LC.trailer.stopActive();
          }
        } catch (err) {
          warn('controller toggle failed', err);
        }
      });
    } catch (e2) {
      warn('controller listener failed', e2);
    }
  }

  var timeline_followed = false;

  /* Task 5c: одна подписка на Lampa.Timeline за всё время жизни плагина —
     запись просмотра серии обновилась (плеер, синхронизация CUB) ->
     перерисовать карточку этой серии (LC.header.refreshEpisode ищет узлы по
     data-hash в DOM: без таймеров и без ссылок на карточки). */
  LC.followTimeline = function () {
    if (timeline_followed) return;
    timeline_followed = true;
    try {
      if (!window.Lampa || !Lampa.Timeline || !Lampa.Timeline.listener) return;
      Lampa.Timeline.listener.follow('update', function (e) {
        try {
          if (e && e.data) LC.header.refreshEpisode(e.data.hash);
          /* Task 8: та же подписка обновляет строку «Продолжить» и подпись
             кнопки «Смотреть» — второй слушатель Timeline не заводится
             (поправки координатора). Хэш записи здесь не нужен: карточка
             сама решает, какую серию продолжать, по всем своим данным.
             Ревью Task 8 (п.2): синхронизация CUB шлёт update пачками, поэтому
             перерисовка коалесцируется (см. scheduleProgressRefresh). */
          LC.header.scheduleProgressRefresh();
        } catch (err) {
          warn('timeline listener failed', err);
        }
      });
    } catch (e2) {
      warn('timeline listener failed', e2);
    }
  };

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
          /* Ревью 2 Task 9 (п.4): вместе со слоем снимаем и незавершённый
             запрос отзывов — иначе его колбэки жили бы до таймаута 8 с уже
             после закрытия карточки. */
          try { LC.reviews.cancel(LC.active.body); } catch (eRv) { warn('reviews cancel failed', eRv); }
          LC.active = null;
        } else if (e.type === 'archive' || e.type === 'start') {
          /* Ревью (fix, Important 1): та же самая liveSlideshow() — своя
             активность тоже может дойти сюда с уже мёртвым контроллером
             (A -> не-full активности -> A сама ActivitySlide.stop()'нута,
             LC.active всё это время не менялся, см. комментарий над
             liveSlideshow()). */
          var ownLayer = layerOf(e.object);
          LC.active.slideshow = liveSlideshow(ownLayer, LC.active.slideshow);
          if (LC.active.slideshow) LC.active.slideshow.resume();
          /* Ревью: симметрично ветке восстановления чужой активности ниже —
             после revive() трейлер уже погашен и снят со слоя, поэтому поле
             не должно продолжать указывать на мёртвый контроллер. */
          if (ownLayer && ownLayer.length) LC.active.trailer = ownLayer.data('lumenTrailer') || null;
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
          /* Task 7 (ревью): поле trailer обязано восстанавливаться вместе с
             LC.active — иначе у вернувшейся карточки его бы не было вовсе и
             stopActive() не смог бы снять «залипший» режим трейлера.
             LC.backdrops.revive() гасит трейлер и снимает ссылку, поэтому в
             сценарии оживления здесь закономерно окажется null. */
          /* Ревью Task 9 (Minor 10): данные карточки тоже восстанавливаются со
             слоя — без них LC.applyReviewsPref на вернувшейся из истории
             карточке не смог бы перерисовать ряд отзывов после ввода ключа
             (complite для неё Lampa повторно не шлёт). */
          LC.active = { object: e.object, body: layer.parent(), slideshow: slideshow, trailer: layer.data('lumenTrailer') || null, data: layer.data('lumenData') || null };
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

  /* Task 7: lumen_trailer сменили на уже открытой карточке. Выключение
     снимает играющий ролик немедленно; включение трейлер не запускает —
     он стартует при следующем открытии карточки (отсчёт 3 с идёт от
     complite, переигрывать его задним числом незачем). */
  LC.applyTrailerPref = function () {
    try {
      if (LC.trailer.mode() === 'off') LC.trailer.stopActive();
    } catch (e) {
      warn('trailer pref failed', e);
    }
  };

  /* Ревью Task 8 (п.3): lumen_card_progress переключили на уже открытой
     карточке. Настройки Lampa — активность ПОВЕРХ карточки, и при возврате она
     не шлёт ни 'full', ни complite: без этого на карточке так и остались бы
     строка «Продолжить», класс lumen-progress-on и подпись кнопки (или
     наоборот — не появились бы). renderProgress перечитывает LC.pref сам,
     поэтому достаточно перерисовки; ждать дебаунса тут незачем — реакция на
     действие пользователя должна быть мгновенной. */
  LC.applyProgressPref = function () {
    try {
      LC.header.refreshProgress();
    } catch (e) {
      warn('progress pref failed', e);
    }
  };

  /* Task 9: lumen_reviews/lumen_kp_key переключили на уже открытой карточке.
     Возврат из настроек Lampa карточку не перестраивает (та же причина, что у
     applyProgressPref), поэтому ряд отзывов перерисовывается здесь: данные
     лежат в LC.active.data (кладутся в complite). Выключение снимает блок даже
     без данных — ему хватает самого узла ряда; включение без данных (карточка
     из истории, для которой complite не приходил) молча ждёт следующего
     открытия, как включение трейлера. */
  LC.applyReviewsPref = function () {
    try {
      var row = $('.activity--active .lumen-descr-row');
      if (!row || !row.length) return;
      if (!LC.pref('lumen_reviews', true)) { LC.reviews.clearRow(row); return; }
      if (LC.active && LC.active.data) LC.reviews.render(row, LC.active.data);
    } catch (e) {
      warn('reviews pref failed', e);
    }
  };

  /* Task 10: lumen_card_cast переключили на уже открытой карточке — причина та
     же, что у applyProgressPref: настройки Lampa лежат активностью ПОВЕРХ
     карточки и при возврате не шлют ни 'full', ни complite. Данные для
     перерисовки хранит сам renderCast (85_header.js). */
  LC.applyCastPref = function () {
    try {
      LC.header.refreshCast();
    } catch (e) {
      warn('cast pref failed', e);
    }
  };

  /* Task 10 (экран 09, «Ключ Kinopoisk API — нужен для отзывов и рейтинга КП»):
     рейтинг Кинопоиска на чип .rate--kp. Значение приносит src/60_reviews.js —
     из своего кэша или из того же ответа films?imdbId, которым он ищет id для
     отзывов: отдельных запросов ради рейтинга не делаем.

     Заполняем ТОЛЬКО скрытый чип: если Lampa уже показала свой kp_rating
     (CUB или парсер-сервер), её значение приоритетнее нашего. Разметку чипа не
     трогаем — пишем в первый div, ровно как это делает сама Lampa
     (app.min.js ~37878: .rate--kp .removeClass('hide').find('> div').eq(0)). */
  LC.applyKpRate = function (rate) {
    try {
      var num = parseFloat(rate);
      if (!num || num <= 0) return;
      var chip = $('.activity--active .lumen-card .rate--kp');
      if (!chip || !chip.length || !chip.hasClass('hide')) return;
      chip.children().eq(0).text(num > 10 ? 10 : num);
      chip.removeClass('hide');
    } catch (e) {
      warn('kp rate failed', e);
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

  /* LC.torrents — src/65_torrents.js (Task 32): <style id="lumen-torrents-css">
     и класс lumen-torrents-on на body. LC.pref нормализует строки 'true'/'false'
     из Storage. Зовётся и из LC.injectCss — пересборка при смене акцента. */
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
  /* Task 10: наш шаблон, собранный один раз в LC.init — включение плагина из
     настроек не должно собирать его заново. Пустая строка означает «оформлять
     нечего»: узкая раскладка или неподдерживаемая версия Lampa. */
  var our_template = '';
  /* Оформление сейчас применено. Держим флагом, а не чтением Storage: Lampa
     шлёт 'change' на КАЖДУЮ запись, и повторное событие с тем же значением не
     должно ни пересобирать CSS, ни повторно раздевать карточку. */
  var activated = false;

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

  /* -------------------------------------------------------------------- */
  /* Task 10: главный выключатель lumen_enabled.                           */
  /*                                                                       */
  /* Всё, что делает activate(), обязано иметь зеркало в deactivate() —     */
  /* иначе выключенный плагин оставит за собой шаблон, стили, классы или    */
  /* узлы. Перезагрузка Lampa не требуется ни в ту, ни в другую сторону.    */
  /* -------------------------------------------------------------------- */

  /* Узлы, которые плагин дорисовывает в чужую разметку: первые два живут в
     .lumen-card, последние два — в ряду описания (он отдельный items-line вне
     карточки, план 0.2). Ищем в активной активности: карточки из истории
     Lampa держит в DOM, и чужую трогать незачем. */
  var STRIP_NODES = ['.lumen-progress', '.lumen-episodes', '.lumen-facts', '.lumen-reviews'];

  /* Плагин выключили на ОТКРЫТОЙ карточке. Саму карточку не трогаем — её
     перерисует Lampa при следующем открытии, уже штатным шаблоном; снимаем
     только своё: дорисованные узлы, класс и CSS-переменную подписи кнопки
     «Смотреть», слой фона со слайдшоу и трейлером, незавершённый запрос
     отзывов. */
  function stripActiveCard() {
    var i;
    for (i = 0; i < STRIP_NODES.length; i++) {
      try {
        $('.activity--active ' + STRIP_NODES[i]).remove();
      } catch (e) {
        warn('strip failed: ' + STRIP_NODES[i], e);
      }
    }
    try {
      var row = $('.activity--active .lumen-descr-row');
      if (row && row.length) row.removeClass('lumen-descr-row lumen-descr-row--reviews');
    } catch (e1) {
      warn('strip descr row failed', e1);
    }
    try {
      var root = $('.activity--active .lumen-card');
      if (root && root.length) {
        root.removeClass('lumen-continue');
        var node = root[0];
        if (node && node.style && typeof node.style.removeProperty === 'function') node.style.removeProperty('--lumen-play-label');
      }
    } catch (e2) {
      warn('strip play label failed', e2);
    }
    try {
      if (LC.active) {
        /* cancel() снимает и слайдшоу, и трейлер: оба контроллера лежат на слое
           фона (см. stopSlideshow в 50_backdrops.js). */
        LC.backdrops.cancel(LC.active.body);
        LC.reviews.cancel(LC.active.body);
      }
    } catch (e3) {
      warn('strip active card failed', e3);
    }
    LC.active = null;
  }

  function activate() {
    if (activated) return;
    activated = true;
    Lampa.Template.add('full_start_new', our_template);
    LC.injectFonts();
    LC.injectCss();
    ui_active = true;
    applyMotionMode(bodyRoot());
    try {
      LC.menus.mode(Lampa.Storage.field('lumen_menus'));
      LC.menus.install();
    } catch (e4) {
      warn('menus init failed', e4);
    }
    try {
      if (LC.torrents && typeof LC.torrents.install === 'function') LC.torrents.install();
    } catch (e5) {
      warn('torrents init failed', e5);
    }
    LC.applyTorrentsPref();
  }

  function deactivate() {
    if (!activated) return;
    activated = false;
    /* Порядок обратный activate(): сперва шаблон (следующее открытие карточки
       уже штатное), затем стили и классы, последней — живая карточка. */
    restoreOriginalTemplate();
    ui_active = false;
    LC.removeCss();
    /* useFonts() в 30_css.js учитывает lumen_enabled, поэтому этот вызов
       снимает <link> Google Fonts — отдельной функции снятия не нужно. */
    LC.injectFonts();
    try {
      if (LC.torrents && typeof LC.torrents.toggle === 'function') LC.torrents.toggle(false);
    } catch (e) {
      warn('torrents off failed', e);
    }
    /* 'off' снимает классы lumen-menus-* с body и маркеры с уже открытых
       Select/Modal, а заодно запрещает ставить их новым (src/64_menus.js). */
    try {
      LC.menus.mode('off');
    } catch (e2) {
      warn('menus off failed', e2);
    }
    try {
      var body = bodyRoot();
      if (body && body.length) body.removeClass(MOTION_CLASSES);
    } catch (e3) {
      warn('motion class off failed', e3);
    }
    stripActiveCard();
  }

  LC.applyEnabledPref = function () {
    try {
      /* Оформлять нечего: LC.init не дошёл до шаблона (узкая раскладка либо
         версия Lampa не поддерживается). */
      if (!our_template) return;
      if (LC.enabled()) activate();
      else deactivate();
    } catch (e) {
      warn('enabled pref failed', e);
    }
  };

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
      our_template = tpl;

      /* Подписки заводятся всегда, даже при выключенном плагине: включение из
         настроек не должно требовать перезагрузки Lampa. Пока оформление не
         активировано, обработчик выходит первой же строкой — иначе выключенный
         плагин продолжал бы дорисовывать блоки и строить фон. */
      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e || !activated) return;
          if (e.type === 'build' && e.name === 'start') {
            LC.header.decorate(findRoot(e), e.data);
          } else if (e.type === 'build' && e.name === 'description') {
            /* Task 5d: таблица «ПОДРОБНО» в теле ряда описания (design-spec §10).
               Task 9: ряд отзывов Кинопоиска — сосед таблицы в том же
               .full-descr (свой тип ряда в Lampa создать нельзя, план 0.2);
               узел ряда ищется один раз на оба рендера. */
            var descrRow = findDescrRow(e);
            LC.header.descr(descrRow, e.data);
            LC.reviews.render(descrRow, e.data);
          } else if (e.type === 'complite') {
            var root = findRoot(e);
            LC.header.decorate(root, e.data);
            /* Вторая, страховочная точка: вставка идемпотентна (старый блок
               снимается), а ряд описания к complite уже построен — так таблица
               появится, даже если 'build' для него до нас не дошёл. Для отзывов
               это тем более важно: запрос уходит отсюда, если 'build' прошёл
               мимо, а повторный вызов с теми же данными в сеть не идёт. */
            var doneRow = findDescrRow(e);
            LC.header.descr(doneRow, e.data);
            LC.reviews.render(doneRow, e.data);
            var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
            /* Task 9: данные карточки нужны LC.applyReviewsPref — настройки
               Lampa открываются ПОВЕРХ карточки и при возврате не шлют ни
               'full', ни complite, а перерисовать ряд отзывов после ввода
               ключа больше неоткуда. */
            LC.active = { object: e.object, body: e.body, slideshow: slideshow, data: e.data };
            /* Ревью Task 9 (Minor 10): дубль данных на слое фона — тем же
               приёмом, что контроллеры слайдшоу и трейлера. Карточка, к которой
               вернулись backward'ом, восстанавливает LC.active из слоя
               (LC.onActivityEvent), и без этой строки у неё не было бы data. */
            try {
              var bgLayer = e.body && e.body.children ? e.body.children('.lumen-backdrop') : null;
              if (bgLayer && bgLayer.length) bgLayer.data('lumenData', e.data);
            } catch (eData) { warn('reviews data on layer failed', eData); }
            /* Task 7: фоновый трейлер — отсчёт 3 с от complite. Контроллер
               хранится и в LC.active.trailer (остановка по toggle/OK), и на
               слое фона (остановка через LC.backdrops.cancel). bind() вешает
               один capture-слушатель на корень карточки. Новая карточка —
               фокуса на ней ещё не было (см. focus_on_card выше). */
            focus_on_card = false;
            LC.trailer.bind(root);
            LC.active.trailer = LC.trailer.schedule(root, e.body, e.data);
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });

      followToggle();
      followActivityLifecycle();
      LC.followTimeline();

      /* Оформление — последним шагом: к этому моменту шаблон собран и все
         подписки заведены. Выключенный плагин просто ждёт включения из
         настроек (LC.applyEnabledPref). */
      if (LC.enabled()) activate();
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

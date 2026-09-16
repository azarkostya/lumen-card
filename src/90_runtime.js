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
    /* Task 17: хаб и сетка — свои активности, класс режима они ставят себе
       сами при create/start; на уже открытом экране его меняет эта же точка
       (ревью Task 17: смена режима не доезжала до открытого хаба). */
    try { applyMotionMode($('.activity--active .lumen-hub')); } catch (eHub) {}
    try { applyMotionMode($('.activity--active .lumen-grid')); } catch (eGrid) {}
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
          /* Ревью Task 10 (п.4): выключенный плагин не ставит своих классов и
             не трогает трейлер — без CSS этого не видно, но состояние он
             оставлять не должен. */
          if (!activated) return;
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
          /* Ревью Task 10 (п.4): иначе запись просмотра возвращала бы на
             карточки класс lumen-continue и переменную --lumen-play-label уже
             после выключения плагина. */
          if (!activated) return;
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

  /* Task 11: все ресурсы открытой карточки освобождаются одной точкой.
     Вход один — 'destroy' своей активности (LC.onActivityEvent ниже):
     отдельного интервала-стража document.body.contains здесь намеренно НЕТ
     (поправка контроллера), его роль выполняют проверки isMounted() /
     isLayerMounted() в колбэках и тиках самих ресурсов.

     Что освобождается:
       1) LC.backdrops.cancel(body) — слой фона целиком: незавершённая
          предзагрузка кадра (Image + таймаут 8 с), контроллер слайдшоу
          (setInterval ротации и таймер остывания кадра), контроллер трейлера
          (таймер старта 3 с, таймаут 6 с, сторож 1 с, iframe) и отложенная
          уборка кадра после revive();
       2) LC.reviews.cancel(body) — незавершённый запрос отзывов (таймаут 8 с);
       3) слайдшоу и трейлер ПО ПРЯМОЙ ССЫЛКЕ — страховка на случай, когда слоя
          в теле активности может не оказаться (тело пересобрано, слой снят
          отдельно): cancel(body) ищет слой через
          body.children('.lumen-backdrop') и до контроллеров тогда не
          доберётся. Оба destroy идемпотентны — после успешного cancel() это
          no-op. Незавершённая предзагрузка первого кадра (50_backdrops.js,
          Image + таймаут 8 с) и отложенная уборка кадра после revive() в этом
          крайнем случае истекают сами, и вреда от этого нет: finish() всё
          равно сверяет lumenGen и isMounted, поэтому ничего не рисует.

     LC.active обнуляется ПЕРВЫМ делом. Это и идемпотентность (повторный
     'destroy' либо наложившееся выключение плагина освобождать уже нечего), и
     гарантия, что колбэк, доехавший во время самой уборки, карточку в LC.active
     не найдёт. Каждое освобождение — в своём try/catch: ошибка одного ресурса
     не должна оставить остальные висеть. */
  LC.destroyActive = function () {
    var active = LC.active;
    if (!active) return;
    LC.active = null;
    try {
      LC.backdrops.cancel(active.body);
    } catch (e) {
      warn('destroy active: backdrop failed', e);
    }
    try {
      LC.reviews.cancel(active.body);
    } catch (e2) {
      warn('destroy active: reviews failed', e2);
    }
    try {
      if (active.slideshow && typeof active.slideshow.destroy === 'function') active.slideshow.destroy();
    } catch (e3) {
      warn('destroy active: slideshow failed', e3);
    }
    try {
      if (active.trailer && typeof active.trailer.destroy === 'function') active.trailer.destroy();
    } catch (e4) {
      warn('destroy active: trailer failed', e4);
    }
  };

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
      /* Ревью Task 10 (п.1): выключенный плагин не воскрешает свой фон.
         LC.backdrops.cancel гасит таймеры, но слой .lumen-backdrop остаётся в
         DOM вместе с lumenUrls/lumenOpts — и возврат «назад» на карточку из
         истории (activity:start) через liveSlideshow() -> revive() -> resume()
         снова запускал бы ротацию и загрузку кадров при выключенном плагине.
         Гейт тот же, что у подписки 'full'. */
      if (!activated) return;

      /* Task 15 (C1-fix): уход с главной поднимает поколение _homeGen в LC.rows,
         делая alive() в makeCall вернуть false для всех текущих запросов рядов.
         Используем существующую подписку — вторая не заводится. */
      if ((e.type === 'archive' || e.type === 'destroy') && e.component === 'main') {
        try { if (LC.rows && LC.rows.bumpGen) LC.rows.bumpGen(); } catch (eBump) {}
        /* Task 16: то же поколение поднимает LC.personal — вторая подписка не нужна. */
        try { if (LC.personal && LC.personal.bumpGen) LC.personal.bumpGen(); } catch (eBumpP) {}
      }

      if (LC.active && e.object === LC.active.object) {
        if (e.type === 'destroy') {
          /* Task 11: слой фона, незавершённый запрос отзывов (его колбэки иначе
             жили бы до таймаута 8 с уже после закрытия карточки — ревью 2
             Task 9, п.4), слайдшоу и трейлер — одной точкой, см.
             LC.destroyActive выше. */
          LC.destroyActive();
        } else if (e.type === 'archive' || e.type === 'start') {
          /* Ревью (fix, Important 1): та же самая liveSlideshow() — своя
             активность тоже может дойти сюда с уже мёртвым контроллером
             (A -> не-full активности -> A сама ActivitySlide.stop()'нута,
             LC.active всё это время не менялся, см. комментарий над
             liveSlideshow()). */
          var ownLayer = layerOf(e.object);
          LC.active.slideshow = liveSlideshow(ownLayer, LC.active.slideshow);
          /* Ревью фазы 1, второй круг (Important 2): тот же гейт, что в
             LC.applySlideshowPref. Пользователь мог уйти вглубь и вернуться
             БЫСТРЕЕ, чем тикнул сторож трейлера (WATCH_MS 1 с) — тогда ролик
             ещё играет, и ротация подняла бы кадры прямо под живым iframe.
             Когда ролик закончится, слайдшоу вернёт его же cleanup(). */
          if (LC.active.slideshow && !LC.trailer.isLive(ownLayer)) LC.active.slideshow.resume();
          /* Ревью: симметрично ветке восстановления чужой активности ниже —
             после revive() трейлер уже погашен и снят со слоя, поэтому поле
             не должно продолжать указывать на мёртвый контроллер. */
          if (ownLayer && ownLayer.length) LC.active.trailer = ownLayer.data('lumenTrailer') || null;
        }
        return;
      }

      if (e.type === 'destroy') {
        var orphanLayer = layerOf(e.object);
        if (orphanLayer && orphanLayer.length) {
          /* Ревью фазы 1 (I2): осиротевшая карточка освобождается ТАК ЖЕ, как
             своя в LC.destroyActive, — не только фон. Lampa шлёт destroy чужой
             активности при вытеснении по лимиту истории maxsave, то есть это
             регулярный путь, а не экзотика; незавершённый запрос отзывов иначе
             живёт до таймаута 8 с и держит замыканием holder/row уже
             уничтоженной карточки (инвариант 0.3 п.5). Тела активности
             достаточно: cancel() ищет состояние по body.find('.full-descr'). */
          var orphanBody = orphanLayer.parent();
          /* Каждое освобождение — в своём try/catch, тот же инвариант, что у
             LC.destroyActive: ошибка одного ресурса не должна оставить
             остальные висеть. Ветка вытеснения по лимиту истории maxsave —
             регулярный путь, и падение снятия фона вернуло бы ровно тот дефект,
             который здесь и чинится, — висящий до таймаута 8 с запрос отзывов. */
          try {
            LC.backdrops.cancel(orphanBody);
          } catch (eBg) {
            warn('destroy orphan: backdrop failed', eBg);
          }
          try {
            LC.reviews.cancel(orphanBody);
          } catch (eRv) {
            warn('destroy orphan: reviews failed', eRv);
          }
        }
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
          /* Долг Task 11 (сверка с планом): ресурсы ПОКИДАЕМОЙ карточки
             освобождаются здесь, до переключения LC.active.

             Порядок событий Lampa при backward() снят живьём:
             start:full(A) -> archive:full(A) -> destroy:full(B). То есть
             destroy покидаемой B приходит ПОСЛЕ того, как start(A) уже
             переставил LC.active на A: ветка «своей активности» на нём не
             срабатывает, а ветка осиротевших слоя не находит — Lampa к тому
             моменту успевает вычистить B.activity.render() (проверено:
             layerOf() пуст). Раньше ресурсы B снимал только self-heal —
             трейлер сторожем за 1 с, а слайдшоу лишь СЛЕДУЮЩИМ тиком
             ротации, то есть до 8-20 с (по настройке lumen_slide_interval)
             закрытая карточка крутила таймер и тянула фоновые кадры: на ТВ
             это лишние CPU и сеть.

             Почему именно здесь и почему это безопасно:
               - сюда попадает ТОЛЬКО чужая активность (своя ушла в первую
                 ветку выше — там возврат к той же карточке оживляет
                 слайдшоу через liveSlideshow/revive, и это поведение Task 6
                 трогать нельзя);
               - и только та, у которой УЖЕ есть слой, то есть возврат к
                 ранее построенной карточке (backward). Свежий push вглубь
                 сюда не доходит: у новой карточки слоя ещё нет, а покидаемая
                 остаётся жить в истории — её ротация лишь паузится тиком по
                 .activity--active;
               - если пользователь вернётся к освобождённой карточке,
                 liveSlideshow() увидит мёртвый контроллер и пересоберёт
                 ротацию через LC.backdrops.revive() — данные кадров (urls/
                 opts) лежат на самом слое и уничтожение их не трогает. */
          if (LC.active && LC.active.object !== e.object) LC.destroyActive();
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
          /* Тот же гейт (Important 2): к карточке могли вернуться раньше, чем
             сторож трейлера её погасил. Если liveSlideshow() выше прошёл через
             revive(), тот уже снял и трейлер, и класс со слоя — значит isLive
             здесь честно вернёт false и ротация поднимется, как и раньше. */
          if (slideshow && !LC.trailer.isLive(layer)) slideshow.resume();
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

  var full_followed = false;

  /* Ревью фазы 1, третий круг: последняя подписка без собственного флага.
     Её гардом служил inited в LC.init, но он сбрасывается в catch (Important 3),
     поэтому исключение МЕЖДУ этой подпиской и концом init делало второй
     'app':ready заводящим ВТОРУЮ подписку: двойные decorate/descr/
     reviews.render/backdrops.apply на каждой карточке и LC.active, переписанный
     дважды — на ТВ это мерцание фона и дублирующийся сетевой запрос отзывов на
     каждое открытие. Сегодня не воспроизводится (весь код после подписки — в
     своих try/catch), но инвариант не должен держаться на аудите будущих
     правок: флаг здесь, как у followToggle и followActivityLifecycle.

     Подписка заводится всегда, даже при выключенном плагине: включение из
     настроек не должно требовать перезагрузки Lampa. Пока оформление не
     активировано, обработчик выходит первой же строкой — иначе выключенный
     плагин продолжал бы дорисовывать блоки и строить фон. */
  function followFull() {
    if (full_followed) return;
    full_followed = true;
    try {
      if (!window.Lampa || !Lampa.Listener) return;
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
               (LC.onActivityEvent), и без этой строки у неё не было бы data.
               Ревью фазы 1, третий круг: проверка та же, что в гейте слайдшоу
               (Minor 6) — у DOM-узла children это HTMLCollection, и вызов её как
               функции бросал бы TypeError. Он гасился try/catch ниже, поэтому
               симптом был тихий: карточка теряла lumenData на слое, и после
               возврата из истории ряд отзывов перерисовать было бы нечем. */
            try {
              var bgLayer = e.body && typeof e.body.children === 'function' ? e.body.children('.lumen-backdrop') : null;
              if (bgLayer && bgLayer.length) bgLayer.data('lumenData', e.data);
            } catch (eData) { warn('reviews data on layer failed', eData); }
            /* Task 7: фоновый трейлер — отсчёт 3 с от complite. Контроллер
               хранится и в LC.active.trailer (остановка по toggle/OK), и на
               слое фона (остановка через LC.backdrops.cancel). bind() вешает
               один capture-слушатель на корень карточки. Новая карточка —
               фокуса на ней ещё не было (см. focus_on_card выше). */
            focus_on_card = false;
            LC.trailer.bind(root);
            /* Task 18: показ штатной кнопки «Трейлер» — ДО schedule и вне
               зависимости от него: кнопка живёт и при lumen_trailer=off, и на
               Tizen/webOS, где фоновый ролик выключен режимом auto. Класс на
               корне, разметку кнопок не трогаем (см. reveal в 55_trailer.js).
               Как и «Франшиза», вставка идёт до activity.toggle(): порядок
               complite у Lampa синхронный, контроллер full_start соберёт
               кнопку сам — она и так уже есть в разметке, меняется лишь её
               видимость. */
            LC.trailer.reveal(root, e.data);
            LC.active.trailer = LC.trailer.schedule(root, e.body, e.data);
            /* Task 17: кнопка «Франшиза» — собственный .selector рядом с
               рядом кнопок (разметка кнопок Lampa не трогается, см. шапку
               src/46_hub.js). Вставляется здесь, до activity.toggle():
               порядок complite у Lampa синхронный (Listener.send('full') ->
               emit('groupButtons') -> activity.toggle()), поэтому контроллер
               full_start соберёт кнопку в коллекцию сам — пересобирать её
               вручную, как у «Стоп», не нужно. */
            LC.hub.franchise(root, (e.data && e.data.movie) || {});
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });
    } catch (e3) {
      warn('full listener failed', e3);
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
      /* Ревью фазы 1 (M1): под играющим роликом кадры не поднимаем — иначе
         смена настройки слайдшоу во время трейлера запускала бы загрузку кадра
         w1280 и кроссфейд в фон работающего iframe. Паузу при этом ставим
         всегда: «выключили слайдшоу» обязано сработать и под роликом. Ничего не
         теряется и при включении — когда ролик закончится, cleanup() трейлера
         сам позовёт resume(), а тот перечитает lumen_slideshow заново.

         Признак «ролик РЕАЛЬНО играет» — LC.trailer.isLive: одна точка на всех
         потребителей, см. шапку src/55_trailer.js. Живости контроллера здесь
         НЕДОСТАТОЧНО: schedule() отдаёт живой контроллер сразу, а ролик
         стартует лишь через 3 с и может не стартовать вовсе (таймаут 6 с) —
         гейт по живости заморозил бы кадры на всё это окно, а при неудавшемся
         ролике cleanup() их бы не вернул (paused у него остался бы false).
         Слой берётся из тела активности тем же путём, что и везде в плагине
         (body.children('.lumen-backdrop') — так его ищут и LC.backdrops.cancel,
         и LC.trailer.schedule), без глобального .activity--active. Проверяем
         именно typeof ... === 'function' (Minor 6): у DOM-узла children — это
         HTMLCollection, и вызов бросил бы TypeError, съев вместе с собой и
         resume(), то есть ротация после смены настройки не вернулась бы вовсе. */
      var body = LC.active.body;
      var layer = body && typeof body.children === 'function' ? body.children('.lumen-backdrop') : null;
      if (LC.trailer.isLive(layer)) return;
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

  /* Правка пользователя 2026-09-16 (п.1): LC.applyCastPref убрана вместе с
     настройкой lumen_card_cast и блоком «В ролях» — управлять больше нечем. */

  /* Task 10 (экран 09, «Ключ Kinopoisk API — нужен для отзывов и рейтинга КП»):
     рейтинг Кинопоиска на чип .rate--kp. Значение приносит src/60_reviews.js —
     из своего кэша или из того же ответа films?imdbId, которым он ищет id для
     отзывов: отдельных запросов ради рейтинга не делаем.

     Заполняем ТОЛЬКО скрытый чип: если Lampa уже показала свой kp_rating
     (CUB или парсер-сервер), её значение приоритетнее нашего. Разметку чипа не
     трогаем — пишем в первый div, ровно как это делает сама Lampa
     (app.min.js ~37878: .rate--kp .removeClass('hide').find('> div').eq(0)). */
  LC.applyKpRate = function (rate, row) {
    try {
      var num = parseFloat(rate);
      if (!num || num <= 0) return;
      var chip = null;
      /* Ревью Task 10 (п.2): row — ряд описания той карточки, которая рейтинг и
         запрашивала. Ищем чип внутри ЕЁ активности, а не по глобальному
         .activity--active: сетевой ответ мог долететь, когда пользователь уже
         открыл другую карточку (при Activity.push A -> B Lampa для A не шлёт ни
         destroy, ни archive — план 0.2). */
      if (row && row.length && typeof row.closest === 'function') {
        var act = row.closest('.activity');
        if (act && act.length && typeof act.find === 'function') chip = act.find('.lumen-card .rate--kp');
      }
      /* Ревью (п.6): глобальный селектор — ТОЛЬКО когда row не передан (прямой
         вызов LC.applyKpRate). Если row есть, а чипа в его активности нет,
         значит карточка уже перестроена или ушла: писать в чужую активность
         нельзя — именно от этого и защищались в п.2. */
      if (!chip && !row) chip = $('.activity--active .lumen-card .rate--kp');
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
  var STRIP_NODES = ['.lumen-progress', '.lumen-episodes', '.lumen-facts', '.lumen-reviews', '.lumen-franchise'];

  /* Плагин выключили. Сами карточки не трогаем — их перерисует Lampa при
     следующем открытии, уже штатным шаблоном; снимаем только своё:
     дорисованные узлы, класс и CSS-переменную подписи кнопки «Смотреть», слои
     фона со слайдшоу и трейлером, незавершённый запрос отзывов.

     Ревью Task 10 (п.3): обходим ВЕСЬ документ, а не .activity--active. Lampa
     держит карточки из истории живым DOM, и возврат «назад» их НЕ
     перестраивает — раздень мы только активную, пользователь вернулся бы на
     карточку с нашим шаблоном и узлами, но уже без CSS. */
  function stripAllCards() {
    var i, k, j;
    for (i = 0; i < STRIP_NODES.length; i++) {
      try {
        $(STRIP_NODES[i]).remove();
      } catch (e) {
        warn('strip failed: ' + STRIP_NODES[i], e);
      }
    }
    try {
      /* Ревью (п.1): незавершённый запрос отзывов снимаем по ВСЕМ рядам, а не
         только у LC.active. Карточка A могла отправить запрос (таймаут 8 с) и
         уйти в историю через Activity.push — для неё Lampa не шлёт ни destroy,
         ни archive, LC.reviews.cancel для неё не звался бы, и доехавший ответ
         вернул бы .lumen-reviews и класс lumen-descr-row--reviews на уже
         раздетую карточку (а «назад» её не перестраивает).

         Ревью фазы 1 (M5) — что здесь происходит на самом деле. Сам узел
         .lumen-reviews к этому моменту УЖЕ снят циклом STRIP_NODES выше, так
         что clearBlock() внутри clearRow удалять нечего. Ценность обхода
         целиком в сетевой части: dropNet() снимает колбэки незавершённого
         запроса, а state.gen++ делает доехавший ответ неактуальным для
         generation guard в render() — без этого paintList вернул бы и блок, и
         класс lumen-descr-row--reviews обратно на уже раздетый ряд.
         Порядок же обязателен по чисто механической причине: ряды набираются
         селектором .lumen-descr-row, а следующая строка этот класс снимает —
         после неё набор оказался бы пустым. */
      var rows = $('.lumen-descr-row');
      for (i = 0; i < rows.length; i++) {
        try {
          LC.reviews.clearRow(rows.eq(i));
        } catch (inner) {
          warn('strip reviews row failed', inner);
        }
      }
    } catch (eRv) {
      warn('strip reviews failed', eRv);
    }
    try {
      $('.lumen-descr-row').removeClass('lumen-descr-row lumen-descr-row--reviews');
    } catch (e1) {
      warn('strip descr row failed', e1);
    }
    try {
      var cards = $('.lumen-card');
      /* Ревью (п.5): класс режима движения и сжатая шапка снимаются и с самих
         карточек — с body их снимает deactivate(), но на .lumen-card они
         ставятся отдельно (applyMotionMode / followToggle). */
      cards.removeClass('lumen-continue lumen-compact lumen-card--franchise ' + MOTION_CLASSES);
      for (j = 0; j < cards.length; j++) {
        var node = cards[j];
        if (node && node.style && typeof node.style.removeProperty === 'function') node.style.removeProperty('--lumen-play-label');
      }
    } catch (e2) {
      warn('strip play label failed', e2);
    }
    try {
      /* cancel() снимает и слайдшоу, и трейлер: оба контроллера лежат на слое
         фона (см. stopSlideshow в 50_backdrops.js). Обходим ВСЕ слои, а не
         только активной карточки: cancel() ждёт тело активности, а слой лежит
         в нём (layer.parent()). */
      var layers = $('.lumen-backdrop');
      for (k = 0; k < layers.length; k++) {
        try {
          LC.backdrops.cancel(layers.eq(k).parent());
        } catch (inner) {
          warn('strip backdrop failed', inner);
        }
      }
    } catch (e3) {
      warn('strip backdrops failed', e3);
    }
    LC.active = null;
  }

  function activate() {
    if (activated) return;
    activated = true;
    /* Task 11 (Step 2): шаблон — единственное, без чего оформлять нечем. Если
       Lampa его не приняла, откатываемся целиком: возвращаем оригинал и
       остаёмся выключенными, вместо того чтобы считать себя активными без
       своего шаблона — иначе подписка 'full' начала бы дорисовывать блоки в
       штатную карточку, у которой наших классов нет. */
    try {
      Lampa.Template.add('full_start_new', our_template);
    } catch (eTpl) {
      activated = false;
      warn('template add failed', eTpl);
      restoreOriginalTemplate();
      return;
    }
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
    /* Task 15 (I4-fix): ряды регистрируются только через manifest.load —
       и при первой активации (нет гонки с async-загрузкой манифеста),
       и при реактивации (load отдаёт кэш синхронно).
       register() сам снимает предыдущие ряды через ContentRows.remove (C2-fix). */
    try {
      if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
        LC.manifest.load(function (m) {
          if (activated && LC.rows && LC.rows.register) LC.rows.register(m);
        });
      }
    } catch (eRows2) {
      warn('rows register failed', eRows2);
    }
    /* Task 16: персональные ряды регистрируются синхронно — данные берутся
       из Lampa.Favorite (локально) без async-загрузки манифеста. */
    try {
      if (LC.personal && LC.personal.register) LC.personal.register();
    } catch (ePersonal) {
      warn('personal rows register failed', ePersonal);
    }
    /* Task 17: компоненты хаба и сетки + пункт меню «Подборки». install()
       идемпотентен: компоненты регистрируются один раз, пункт меню — только
       если его ещё нет. */
    try {
      if (LC.hub && LC.hub.install) LC.hub.install();
    } catch (eHub) {
      warn('hub install failed', eHub);
    }
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
    stripAllCards();
    /* Task 15: сброс флага регистрации рядов — следующий activate() заново
       зарегистрирует ряды через LC.rows.register (может понадобиться, если
       плагин выключили и снова включили). */
    try { if (LC.rows && LC.rows.unregister) LC.rows.unregister(); } catch (eRows) {}
    /* Task 16: снять персональные ряды. */
    try { if (LC.personal && LC.personal.unregister) LC.personal.unregister(); } catch (ePersonalOff) {}
    /* Task 17: убрать пункт меню «Подборки». */
    try { if (LC.hub && LC.hub.uninstall) LC.hub.uninstall(); } catch (eHubOff) {}
  }

  /* Task 15 (I5-fix): перерегистрация рядов при смене lumen_rows_limit.
     Вызывается из applyPrefChange в 80_settings.js.
     manifest.load использует кэш (синхронно), поэтому задержки нет. */
  LC.applyRowsPref = function () {
    if (!activated) return;
    try {
      if (LC.rows && LC.rows.register && LC.manifest && LC.manifest.load) {
        LC.manifest.load(function (m) {
          if (activated && LC.rows && LC.rows.register) LC.rows.register(m);
        });
      }
    } catch (e) {
      warn('rows pref failed', e);
    }
  };

  /* Task 16: перерегистрация персональных рядов при смене lumen_personal_rows.
     Снимает все персональные ряды и строит новые (с учётом текущего значения
     настройки — если выключена, register() вернётся сразу без регистрации). */
  LC.applyPersonalPref = function () {
    if (!activated) return;
    try {
      if (LC.personal && LC.personal.unregister) LC.personal.unregister();
      if (LC.personal && LC.personal.register) LC.personal.register();
    } catch (e) {
      warn('personal pref failed', e);
    }
  };

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

  /* Ревью фазы 1 (I3): init идемпотентен целиком. Каждый его шаг защищён своим
     флагом ОТДЕЛЬНО — followFull, followToggle, followActivityLifecycle,
     LC.followTimeline, LC.addSettings, LC.followStorage, menus.install,
     torrents.install, — и флаг ниже не единственная их защита, а только
     верхняя. Так и задумано: inited сбрасывается в catch (Important 3), то есть
     после падения init заходит повторно, и каждая подписка обязана сама
     пережить этот повтор. Раньше своей защиты не имели подписка на 'full',
     LC.addSettings и LC.followStorage: второй вызов заводил вторую подписку
     Listener 'full' (двойной рендер каждой карточки),
     вторую подписку Storage 'change' и повторно регистрировал пункты раздела —
     и каждая настройка применялась бы ДВАЖДЫ: обработчик события применяет и
     лишь потом ставит pref_handled, а onChange съедает ровно одно повторение.
     В vendor 3.3.4 сценарий сегодня не воспроизводится — startApp() закрыт
     своим гардом (if (window.appready || window.app_time_launch) return), — но
     LC.boot подписку на 'app' не снимает, а src/00_head.js страхует только от
     повторной ЗАГРУЗКИ скрипта, не от повторного вызова init.
     Флаг ставится ПОСЛЕ проверки Lampa: вызов, на котором Lampa ещё не готова,
     не сделал ничего и повтору мешать не должен. */
  var inited = false;

  LC.init = function () {
    if (inited) return;
    try {
      if (!window.Lampa || !Lampa.Template || !Lampa.Listener) return;
      inited = true;

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
          if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang('lumen_card_unsupported'));
        } catch (e3) { }
        return;
      }
      our_template = tpl;

      followFull();
      followToggle();
      followActivityLifecycle();
      LC.followTimeline();

      /* Оформление — последним шагом: к этому моменту шаблон собран и все
         подписки заведены. Выключенный плагин просто ждёт включения из
         настроек (LC.applyEnabledPref). */
      if (LC.enabled()) activate();
    } catch (e) {
      /* Ревью фазы 1, второй круг (Important 3): флаг поднимается ДО
         LC.addSettings/saveOriginalTemplate/LC.template.build, поэтому без
         сброса любое исключение делало состояние необратимым — второй
         'app':ready уже ничего не собрал бы, и пользователь остался бы без
         оформления до перезапуска Lampa. Идемпотентность от сброса не страдает:
         успешный проход сюда не заходит и флаг сохраняет. */
      inited = false;
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

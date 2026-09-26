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

  /* A6 (волна A финального плана): ряды анализа Lampa на карточке фильма —
     «Метаданные» (Темп, Страх, Экшн…) и «Настроения» (проценты). Это ряды
     САМОЙ Lampa: компонент карточки кладёт их в this.rows именами
     'metadata_chart' и 'metadata_tags' (vendor/lampa/app.min.js:38843 и
     :38849), а собирают их MetadataChart (:38200) и MetadataTags (:38272)
     из data.metadata, которую приносит Api.sources.cub.metadataGet — только
     для фильма (`params.method == 'movie'`, :20160-20166). «Метаданные»
     появляются при data.metadata.status == 'completed' (:38842),
     «Настроения» ещё и только при языке интерфейса ru/uk/be (:38848).
     Пункта настроек у Lampa для них нет; есть только флаг сборки
     lampa_settings.disable_features.metadata (:34364), который трогать
     нельзя — это настройка самой Lampa, а не наша.

     Поэтому ряды не прячутся и не снимаются со сцены, а НЕ СОЗДАЮТСЯ: на
     событии 'full' типа 'start' (:38833-38840 — оно уходит РОВНО перед
     проверкой на :38842) мы убираем data.metadata, и Lampa просто не кладёт
     эти два ряда в свой список. Для неё это штатное состояние: ровно так
     выглядит любой сериал, не-русский язык интерфейса и не досчитанный
     анализ.

     Два других пути отвергнуты живой проверкой на стенде 960×540@2
     («Начало», ru, анализ completed):
       - правило display:none на узле ряда: шаг «вниз» уводил фокус ВНУТРЬ
         скрытого ряда (сфокусированная плитка «Темп 4.8/10», rect 0×0,
         offsetParent null), и дальше навигация вставала. Controller.
         collectionSet отбирает узлы по offsetParent только при третьем
         аргументе visible_only (:46453-46456), а карточка зовёт его одним
         (:39126);
       - снятие узла на 'build': ряд уходил с экрана, но оставался в
         this.items, и шаг «вниз» отдавал управление его компоненту —
         контроллер становился 'items_line' при пустом наборе, и фокус
         пропадал совсем (замер: ни одного узла с классом focus).

     Данные Lampa не остаются изменёнными: снятое возвращается на
     'complite' (:38965) — он уходит из того же синхронного блока сразу
     после build (:38961), то есть после единственного чтения на :38842.
     Гейт `watch` у обоих событий один и тот же (:38822), так что пары
     «сняли — вернули» без половины не бывает.

     Цена — настройка действует со СЛЕДУЮЩЕГО открытия карточки (так и
     сказано в её описании): на уже построенную карточку 'full' второй раз
     не приходит, а настройки Lampa лежат активностью ПОВЕРХ неё и при
     возврате не шлют ни 'full', ни complite (находка ревью Task 8 фазы 1). */
  var META_STASH = 'lumen_metadata';

  function dropMetaData(e) {
    try {
      if (!LC.pref('lumen_hide_meta', false)) return false;
      if (!e || !e.data || !e.data.metadata) return false;
      e.data[META_STASH] = e.data.metadata;
      e.data.metadata = null;
      return true;
    } catch (err) {
      warn('meta drop failed', err);
      return false;
    }
  }

  function restoreMetaData(e) {
    try {
      if (!e || !e.data || !e.data[META_STASH]) return false;
      e.data.metadata = e.data[META_STASH];
      e.data[META_STASH] = null;
      return true;
    } catch (err) {
      warn('meta restore failed', err);
      return false;
    }
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

  /* «Карточка на экране» — общее правило LC.util.onScreen (src/10_util.js),
     здесь в виде селектора того же правила. */
  function activeCardRoot() {
    try { return $(LC.util.ON_SCREEN_SEL + ' .lumen-card'); } catch (e) { return null; }
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
    try { return $(LC.util.ON_SCREEN_SEL + ' .lumen-backdrop'); } catch (e) { return null; }
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

  /* Task 40: тяжёлые эффекты одним классом на body. Класс именно на body, а
     не на корнях экранов: от него зависят и наезд на кадр карточки
     (.lumen-backdrop лежит вне .lumen-card), и зум заставки (её слой —
     сосед всего приложения), и кроссфейд кадра героя. Ставится там же, где
     класс режима анимаций, и теми же двумя точками: активацией плагина и
     LC.applyMotionMode. */
  function applyFxHeavy() {
    var body = bodyRoot();
    if (!body || !body.length) return;
    try {
      body.toggleClass('lumen-fx-heavy', !!(typeof LC.fxHeavy === 'function' && LC.fxHeavy()));
    } catch (e) {
      warn('fx heavy class failed', e);
    }
  }

  /* Волна 2 (ТВ 2026-09-24, D1): метка «на экране карточка фильма». По ней
     таблица стилей гасит штатный фон Lampa (body.lumen-card-on .background,
     src/30_css.js) — размытый постер, который проступал при открытии
     карточки. Ставится на старте экрана 'full', снимается стартом любого
     другого экрана и выключением плагина (deactivate). */
  var CARD_ON = 'lumen-card-on';
  function markCardBody(on) {
    var body = bodyRoot();
    if (!body || !body.length) return;
    try {
      body.toggleClass(CARD_ON, !!on);
    } catch (e) {
      warn('card body mark failed', e);
    }
  }

  /* Вызывается извне (LC.followStorage / onChange параметра lumen_motion), когда режим
     меняется на уже открытой карточке — находит активный корень (и слой фона) сама.
     На body — только пока плагин активен (ui_active, см. ниже). */
  LC.applyMotionMode = function () {
    applyMotionMode(activeCardRoot());
    applyMotionMode(activeBackdropLayer());
    if (ui_active) {
      applyMotionMode(bodyRoot());
      /* Task 40: класс тяжёлых эффектов зависит и от режима анимаций
         (LC.fxHeavy гасит их в lite/off), поэтому переставляется здесь же. */
      applyFxHeavy();
    }
    /* Task 17: хаб и сетка — свои активности, класс режима они ставят себе
       сами при create/start; на уже открытом экране его меняет эта же точка
       (ревью Task 17: смена режима не доезжала до открытого хаба). */
    try { applyMotionMode($(LC.util.ON_SCREEN_SEL + ' .lumen-hub')); } catch (eHub) {}
    try { applyMotionMode($(LC.util.ON_SCREEN_SEL + ' .lumen-grid')); } catch (eGrid) {}
    /* Task 18: герой главной — свой узел вне .lumen-card; класс режима ему
       ставит сам LC.hero при монтировании, на уже открытом экране его
       перечитывает эта же точка (в lite/off герой обязан обходиться без
       кроссфейда кадра и подъёма текста). */
    try { if (LC.hero && LC.hero.applyMotion) LC.hero.applyMotion(); } catch (eHero) {}
    /* Task 21 (найдено живой проверкой 2026-09-17): режим анимаций
       переключают на ОТКРЫТОЙ карточке, и слой частиц обязан уйти вместе с
       полными анимациями — иначе «Лёгкие» гасили бы всё, кроме самой
       тяжёлой части плагина, до следующего открытия карточки. Обратный
       переход на «Полные» так же возвращает атмосферу на место:
       LC.applyFxPref пересчитывает тему по данным того, что открыто. */
    try { if (LC.applyFxPref) LC.applyFxPref(); } catch (eFx) {}
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
          /* Ревью раунда хвостов, п.6: и герою главной — оверлей, открытый
             посреди отсчёта его ролика, перезапускает отсчёт
             (LC.hero.onToggle, src/48_hero.js). До проверки карточки: на
             главной её нет. */
          if (LC.hero && typeof LC.hero.onToggle === 'function') LC.hero.onToggle();
          /* Следующий раунд, п.10: выход из настроек в шапку или в ряды —
             возврат фокуса в прежний ряд главной, если его взвела смена
             «Кадра над рядами» (src/47_homerow.js). */
          if (LC.homeRow && typeof LC.homeRow.onToggle === 'function') LC.homeRow.onToggle(e.name);
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
     перерисовать карточку этой серии (LC.header.refreshEpisode обходит ряды
     серий, которые сейчас есть в DOM: без таймеров и без ссылок на карточки). */
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
  /* Атмосфера карточки, к которой вернулись из истории: LC.fx.sweep() на
     'start' любой другой активности снимает канвас со всего, что не на
     экране (src/52_fx.js), а при возврате Lampa complite не шлёт — слой
     ставится заново по данным карточки. Порядок тот же, что на complite:
     акцент, затем атмосфера. */
  function reapplyFx(active) {
    try {
      if (active) LC.applyFxFor(active.body, (active.data && active.data.movie) || null);
    } catch (eFx) {
      warn('fx reapply failed', eFx);
    }
  }

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
    /* Task 28: незавершённый запрос коллекции ряда «Смотреть по порядку» —
       такой же ресурс карточки, как запрос отзывов, и снимается рядом с ним. */
    try {
      LC.franchise.cancel(active.body);
    } catch (eFr) {
      warn('destroy active: franchise failed', eFr);
    }
    /* Task 21: слой частиц — такой же ресурс карточки, как слайдшоу: свой
       кадровый цикл он держит ровно до тех пор, пока смонтирован хотя бы
       один слой (src/52_fx.js). Снимаем явно, не дожидаясь самопроверки по
       выпавшему из документа канвасу. */
    try {
      var fxLayer = fxLayerOf(active.body);
      if (fxLayer && LC.fx) LC.fx.unmount(fxLayer.find('.lumen-fx'));
    } catch (eFxOff) {
      warn('destroy active: fx failed', eFxOff);
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

      /* Task 15 (C1-fix) + fix-раунд итогового ревью фазы 2: главную ВЫБРОСИЛИ
         — поднимаем поколение _homeGen в LC.rows, делая alive() в makeCall
         вернуть false для всех текущих запросов рядов.
         Только 'destroy' (вытеснение по лимиту истории maxsave или закрытие).
         'archive' сюда НЕ входит: по разбору выше backward() шлёт start+archive
         той активности, к которой ВЕРНУЛИСЬ, то есть archive главной означает
         «снова на экране». Гашение по archive убивало недогруженные ряды при
         каждом возврате из карточки: мёртвый ряд не звал свой call, пачка
         Lampa (parts_limit=6) не завершалась, и главная переставала
         достраиваться до перезапуска Lampa (проверено живьём).
         Используем существующую подписку — вторая не заводится. */
      if (e.type === 'destroy' && e.component === 'main') {
        try { if (LC.rows && LC.rows.bumpGen) LC.rows.bumpGen(); } catch (eBump) {}
        /* Task 16: то же поколение поднимает LC.personal — вторая подписка не нужна. */
        try { if (LC.personal && LC.personal.bumpGen) LC.personal.bumpGen(); } catch (eBumpP) {}
      }

      /* Task 18: герой главной. Смонтирован ровно один (модуль сам снимает
         предыдущего), и паркуется он на 'start' ЛЮБОЙ чужой активности
         (правка 2026-09-23: не снимается — узлы и кадр ждут возврата, разбор
         у park в src/48_hero.js), а снимается на 'destroy' своей —
         Lampa для покидаемой активности событий не шлёт вовсе (раздел 0
         плана), так что уход вглубь виден только по старту той, куда ушли.
         detach() паркует героя лишь тогда, когда его корень лежит ВНЕ
         стартующей активности: героя, смонтированного в её же корень (сейчас
         так монтируется только главная), событие не трогает. */
      if (e.type === 'start') {
        /* Task 20: вернулись на экран, который ждал пересборки под новую
           настройку (состав рядов главной, подсказка про ключ). Замена
           откладывается на таймер — см. LC.refreshComponent. */
        try { if (LC.refreshPending) LC.refreshPending(e.component); } catch (eRefresh) {}
        markCardBody(e.component === 'full');
        /* Волна 2 (ТВ 2026-09-24, D3): перехода «постер → кадр» при открытии
           карточки больше нет — пользователь просил убрать эффект открытия.
           Старт любого экрана, включая карточку, только снимает слой, если
           он остался: удержанный слой экрана рулетки (LC.transition.reveal,
           src/56_roulette.js) не должен пережить свой экран. */
        try {
          if (LC.transition) LC.transition.stop();
        } catch (eTrans) {
          warn('transition start failed', eTrans);
        }
        var startRender = null;
        try {
          if (e.object && e.object.activity && typeof e.object.activity.render === 'function') startRender = e.object.activity.render();
        } catch (eRender) {}
        /* Ревью H4: герой главной возвращается с парковки («Назад» из
           карточки) — подкраску его фильма вернёт accentBack ниже. */
        var heroBack = false;
        try {
          if (LC.hero) {
            heroBack = e.component === 'main' && typeof LC.hero.parked === 'function' && LC.hero.parked();
            LC.hero.detach(startRender);
            if (e.component === 'main' && startRender && startRender.length) LC.hero.mount(startRender);
          }
        } catch (eHeroStart) {
          warn('hero start failed', eHeroStart);
        }
        /* Task 19 (fix-раунд итогового ревью фазы 2): чипы настроения
           монтируются ИЗ ЭТОЙ ЖЕ точки. Своей подписки на 'activity' модуль
           не заводит: Subscribe.send вендора оборачивает весь цикл
           подписчиков одним try/catch, и исключение у более раннего
           подписчика оборвало бы рассылку нашему.
           Волна 3 (ТВ 2026-09-24): порядок — строго после героя. Чипы живут
           на главной только без кадра, и LC.moods.mount решает это по узлу
           героя в корне (src/49_moods.js). */
        try {
          if (LC.moods) {
            LC.moods.detach(startRender);
            if (e.component === 'main' && startRender && startRender.length) LC.moods.mount(startRender);
          }
        } catch (eMoodsStart) {
          warn('moods start failed', eMoodsStart);
        }
        /* Task 25: метки на постерах рядов. Наблюдатель живёт ровно столько
           же, сколько герой, и по той же причине: уход с главной виден только
           по 'start' той активности, куда ушли. detach() снимает его, если
           корень лежит ВНЕ стартующей активности. */
        try {
          if (LC.badges) {
            LC.badges.detach(startRender);
            if (e.component === 'main' && startRender && startRender.length) LC.badges.mount(startRender);
          }
        } catch (eBadgesStart) {
          warn('badges start failed', eBadgesStart);
        }
        /* Task 27 (дефект фазы 3, найден живьём в Task 22/23): панель
           мини-карты рядов и индикатор позиции принадлежат экрану, на котором
           их показали. Сам модуль снимал панель только через 0.8 с после
           отпускания клавиши — успей человек за это время нажать OK, карточка
           открывалась ПОД ней. Здесь панель уходит в тот же момент, что
           меняется экран, и корень стартующей активности для этого не нужен:
           узлы лежат в body, а не в ней. */
        try {
          if (LC.nav && LC.nav.detach) LC.nav.detach();
        } catch (eNavStart) {
          warn('nav detach failed', eNavStart);
        }
        /* Ревью фазы 3 (Critical 1): слои частиц карточек, оставшихся в
           истории. Lampa не шлёт покидаемой активности никаких событий (см.
           большой комментарий ниже), а её DOM живёт дальше — без этой уборки
           уход вглубь «карточка -> актёр -> другой фильм -> франшиза»
           оставлял бы канвас каждой карточки в памяти до вытеснения по
           лимиту истории (на FHD порядка 8 МБ на слой, на 4K вдвое больше).
           Момент выбран потому, что Lampa проставляет .activity--active
           стартующей активности и снимает со всех остальных ДО отправки
           этого события (vendor/lampa/app.min.js, start$4) — классы уже
           верны, и слой стартующей карточки sweep() не тронет.
           Снятый слой возвращается, когда к экрану вернулись: у героя
           главной — resume() (src/48_hero.js), у карточки — reapplyFx()
           ниже, на её собственном 'start'. */
        try {
          if (LC.fx && LC.fx.sweep) LC.fx.sweep();
        } catch (eFxSweep) {
          warn('fx sweep failed', eFxSweep);
        }
        /* Task 24: акцент от постера живёт ровно столько, сколько открытая
           карточка. Ушли с неё на главную, в сетку или в хаб — цвет из
           настроек возвращается, а незавершённый расчёт по постеру
           отменяется (src/57_color.js). Карточку эта ветка не трогает: для
           неё акцент ставит 'full' complite, а для вернувшейся из истории —
           восстановление LC.active ниже. */
        try {
          /* Task 21: тем же вызовом уходит и акцент тематической атмосферы —
             он принадлежит открытой карточке ровно так же, как постерный
             (одна пересборка CSS на оба, src/57_color.js). */
          if (LC.accent && e.component !== 'full') LC.accent.destroy();
          /* Ревью H4: destroy снял акцент ушедшей карточки, а вместе с ним и
             подкраску главной — resume героя её не ставит, и главная после
             «Назад» оставалась без подкраски до следующего перевода фокуса.
             Первый старт главной (героя не было на парковке) — как прежде:
             подкраска ждёт покоя фокуса (src/48_hero.js, scheduleAccent). */
          if (heroBack && typeof LC.hero.accentBack === 'function') LC.hero.accentBack();
        } catch (eAccentStart) {
          warn('accent start failed', eAccentStart);
        }
      } else if (e.type === 'destroy') {
        /* Активность вытеснили из истории (лимит maxsave) или закрыли: если
           герой всё ещё её — он уходит вместе с DOM, а наблюдатель и
           незавершённые запросы обязаны уйти явно. Проверка owns()
           обязательна: к этому моменту герой может принадлежать уже другому
           экрану, и снимать чужого мы права не имеем. */
        var deadRender = null;
        try {
          if (e.object && e.object.activity && typeof e.object.activity.render === 'function') deadRender = e.object.activity.render();
        } catch (eDeadRender) {}
        try {
          if (LC.hero && LC.hero.active()) {
            if (LC.hero.owns(deadRender)) LC.hero.unmount();
          }
        } catch (eHeroKill) {
          warn('hero destroy failed', eHeroKill);
        }
        /* Чипы настроения уходят вместе со своей активностью — та же
           проверка owns(): блок мог уже переехать на другой экран. */
        try {
          if (LC.moods && LC.moods.active() && LC.moods.owns(deadRender)) LC.moods.unmount();
        } catch (eMoodsKill) {
          warn('moods destroy failed', eMoodsKill);
        }
        /* Наблюдатель меток уходит вместе со своей активностью — та же
           проверка owns(): он мог уже переехать на другой экран. */
        try {
          if (LC.badges && LC.badges.active() && LC.badges.owns(deadRender)) LC.badges.unmount();
        } catch (eBadgesKill) {
          warn('badges destroy failed', eBadgesKill);
        }
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
          /* Task 24: к этой карточке вернулись (LC.active всё это время
             указывал на неё, поэтому ветка восстановления ниже не
             отрабатывает) — возвращаем и акцент её фильма. Цвет уже в кэше
             LC.color, повторного расчёта по постеру не будет. */
          try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccentOwn) {}
          /* Ф3, довесок Д1 (ревью фикс-раундов): вернулись из не-карточки
             (актёр, сетка) — её старт снял канвас атмосферы этой карточки
             уборкой LC.fx.sweep() выше, а complite Lampa повторно не шлёт.
             Тот же механизм, что у героя главной (593a479). Только на
             'start': archive — не возврат, слой он не терял. */
          if (e.type === 'start') reapplyFx(LC.active);
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
          try {
            LC.franchise.cancel(orphanBody);
          } catch (eFrOrphan) {
            warn('destroy orphan: franchise failed', eFrOrphan);
          }
          /* Ревью фазы 3 (Critical 1): слой частиц осиротевшей карточки —
             такой же её ресурс, как запрос отзывов, и снимается здесь, как в
             LC.destroyActive. Рассчитывать на одну самопроверку по выпавшему
             из документа канвасу нельзя: она сработает только в тике, а тик
             к этому моменту может стоять (все слои на паузе — см. шапку
             src/52_fx.js). Слой частиц лежит внутри слоя фона, поэтому ищем
             его от orphanLayer, а не от тела активности. */
          try {
            if (LC.fx) LC.fx.unmount(orphanLayer.find('.lumen-fx'));
          } catch (eFxOrphan) {
            warn('destroy orphan: fx failed', eFxOrphan);
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
          /* Task 24: карточке, к которой вернулись, Lampa complite повторно
             не шлёт — акцент её фильма возвращаем отсюда, по данным со слоя
             (цвет уже в кэше LC.color, повторного расчёта не будет). */
          try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccentBack) {}
          /* Ф3, довесок Д1: то же для карточки, к которой вернулись из
             другой карточки, — её канвас атмосферы снимала уборка на старте
             той. */
          reapplyFx(LC.active);
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
          if (e.type === 'start') {
            /* A6: ряды анализа Lampa не создаются вовсе — разбор, замеры и
               отвергнутые пути у dropMetaData выше. Событие уходит РОВНО
               перед проверкой data.metadata (app.min.js:38833-38842). */
            dropMetaData(e);
          } else if (e.type === 'build' && e.name === 'start') {
            var startRoot = findRoot(e);
            LC.header.decorate(startRoot, e.data);
            /* ↑ с дальней плитки серии — на кнопки, а не в шапку Lampa
               (разбор у bindStart, src/85_header.js). e.item — сам модуль
               Start: только здесь он и приходит, у complite его нет. */
            LC.header.bindStart(e.item, startRoot);
          } else if (e.type === 'build' && e.name === 'description') {
            /* Task 5d: таблица «ПОДРОБНО» в теле ряда описания (design-spec §10).
               Task 9: ряд отзывов Кинопоиска — сосед таблицы в том же
               .full-descr (свой тип ряда в Lampa создать нельзя, план 0.2);
               узел ряда ищется один раз на оба рендера. */
            var descrRow = findDescrRow(e);
            LC.header.descr(descrRow, e.data);
            LC.reviews.render(descrRow, e.data);
            /* Task 28: ряд «Смотреть по порядку» — третий сосед в том же
               .full-descr (таблица «ПОДРОБНО», отзывы, франшиза). */
            LC.franchise.render(descrRow, e.data);
            /* Волна 2: второй экран карточки — обычная прокрутка за фокусом
               пульта (разбор у bindDescr, src/85_header.js). Модуль ряда и
               Scroll карточки приходят только здесь — e.item и e.link, у
               complite их нет. */
            LC.header.bindDescr(e.item, descrRow, e.link);
          } else if (e.type === 'complite') {
            /* A6: данные Lampa не остаются изменёнными — снятое возвращается
               здесь же, после единственного чтения на app.min.js:38842. */
            restoreMetaData(e);
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
            /* Task 28: та же страховочная точка, что у отзывов — рендер
               идемпотентен по подписи, второго запроса коллекции не будет. */
            LC.franchise.render(doneRow, e.data);
            var slideshow = LC.backdrops.apply(root, e.body, (e.data && e.data.movie) || {});
            applyMotionMode(root);
            /* Task 9: данные карточки нужны LC.applyReviewsPref — настройки
               Lampa открываются ПОВЕРХ карточки и при возврате не шлют ни
               'full', ни complite, а перерисовать ряд отзывов после ввода
               ключа больше неоткуда. */
            LC.active = { object: e.object, body: e.body, slideshow: slideshow, data: e.data };
            /* Task 24: акцент от постера этого фильма (настройка
               lumen_accent_auto). Выключена — вызов ничего не делает и ни
               одной картинки не грузит (src/57_color.js). */
            /* Task 35: второй аргумент — «фильм открыт карточкой». На ней
               акцент виден весь (кнопки, кольца фокуса, подсветки), поэтому
               здесь заказывается полная пересборка стилей; на главной её нет,
               там подкраска фона пишется в свой узел (src/57_color.js). */
            try { if (LC.accent) LC.accent.applyFor((e.data && e.data.movie) || null, true); } catch (eAccent) {}
            /* Task 21: тематическая атмосфера — по ключевым словам фильма.
               В режимах анимаций lite/off и при настройке «Выключены» вызов
               не создаёт ни канваса, ни кадрового цикла (src/52_fx.js). */
            try { LC.applyFxFor(e.body, (e.data && e.data.movie) || null); } catch (eFx) { warn('fx apply failed', eFx); }
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
            /* Task 29: замер «сколько у этого железа занимает первый кадр
               тяжёлого экрана» — отсюда и до второго requestAnimationFrame.
               Точка вызова последняя в обработчике намеренно: замер обязан
               включать всю нашу работу по карточке, а не её начало. Первые
               три карточки после старта, дальше модуль молчит; при режиме
               анимаций, выбранном руками, не меряет вовсе (src/68_perf.js). */
            try { if (LC.perf) LC.perf.track('card'); } catch (ePerf) {}
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
         стартует лишь через 3 с и может не стартовать вовсе (таймауты 20 с
         на загрузку плеера и 12 с от его готовности, src/55_trailer.js) —
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
      var row = $(LC.util.ON_SCREEN_SEL + ' .lumen-descr-row');
      if (!row || !row.length) return;
      if (!LC.pref('lumen_reviews', true)) { LC.reviews.clearRow(row); return; }
      if (LC.active && LC.active.data) LC.reviews.render(row, LC.active.data);
    } catch (e) {
      warn('reviews pref failed', e);
    }
  };

  /* Сверка 2026-09-26: выключатели кнопки «Франшиза» (lumen_franchise_button)
     и ряда «Смотреть по порядку» (lumen_franchise_row) переключили на уже
     открытой карточке — настройки Lampa лежат поверх неё, и возврат её не
     перестраивает (та же причина, что у applyReviewsPref). Кнопка —
     на каждой нашей карточке в DOM, по фильму, запомненному на корне
     (LC.hub.franchise); ряд выключенным снимается на всех рядах описания, а
     включённым рисуется на открытой карточке по LC.active.data. */
  LC.applyFranchisePref = function () {
    var i;
    try {
      var cards = $('.lumen-card');
      for (i = 0; i < cards.length; i++) {
        if (typeof cards[i].lumen_fr_movie !== 'undefined') LC.hub.franchise(cards.eq(i), cards[i].lumen_fr_movie || {});
      }
    } catch (e) {
      warn('franchise button pref failed', e);
    }
    try {
      if (!LC.pref('lumen_franchise_row', true)) {
        var rows = $('.lumen-descr-row');
        for (i = 0; i < rows.length; i++) LC.franchise.render(rows.eq(i), LC.active && LC.active.data);
        return;
      }
      var row = $(LC.util.ON_SCREEN_SEL + ' .lumen-descr-row');
      if (row && row.length && LC.active && LC.active.data) LC.franchise.render(row, LC.active.data);
    } catch (e2) {
      warn('franchise row pref failed', e2);
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
      if (!chip && !row) chip = $(LC.util.ON_SCREEN_SEL + ' .lumen-card .rate--kp');
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
      LC.menus.mode(LC.pref('lumen_menus', 'all'));
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
  /* .lumen-franchise — КНОПКА «Франшиза» в ряду кнопок (Task 17),
     .lumen-fr — ряд «Смотреть по порядку» в блоке описания (Task 28): разные
     узлы, снимаются оба. */
  var STRIP_NODES = ['.lumen-progress', '.lumen-episodes', '.lumen-facts', '.lumen-reviews', '.lumen-franchise', '.lumen-fr'];

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
        /* Task 28: у ряда франшизы та же сетевая часть — снять колбэки
           незавершённого запроса коллекции и поднять поколение, чтобы
           доехавший ответ не вернул блок на уже раздетую карточку. */
        try {
          LC.franchise.clearRow(rows.eq(i));
        } catch (innerFr) {
          warn('strip franchise row failed', innerFr);
        }
      }
    } catch (eRv) {
      warn('strip reviews failed', eRv);
    }
    try {
      $('.lumen-descr-row').removeClass('lumen-descr-row lumen-descr-row--reviews lumen-descr-row--franchise');
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
    /* Task 31 (фаза 4): HUD отладки — читает свою настройку сам, как и все
       LC.apply*Pref; здесь только точка старта при активации плагина. */
    try { if (LC.hud) LC.hud.sync(); } catch (eHudOn) {}
    ui_active = true;
    applyMotionMode(bodyRoot());
    /* Task 40: класс тяжёлых эффектов — рядом с классом режима. */
    applyFxHeavy();
    try {
      LC.menus.mode(LC.pref('lumen_menus', 'all'));
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
    /* Волна 4 (ТВ 2026-09-24): все ряды главной — личные и подборки —
       регистрирует один план (src/47_homeplan.js), строго по возрастанию
       места; прежде личные регистрировались здесь, подборки — в колбэке
       каталога, и порядок главной зависел от того, кто успел первым.
       Сразу — личные ряды (данные локальны) и подборки прошлого каталога,
       если он уже был загружен; start отмечает, что первое построение
       главной после активации впереди (шаг эпохи). */
    try {
      if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ start: true });
    } catch (eHome) {
      warn('home plan failed', eHome);
    }
    /* Task 15 (I4-fix): подборки — через manifest.load: и при первой
       активации (нет гонки с async-загрузкой манифеста), и при реактивации
       (load отдаёт кэш синхронно). apply снимает прежний набор сам. */
    try {
      if (LC.manifest && LC.manifest.load) {
        LC.manifest.load(function (m) {
          if (!activated) return;
          try {
            if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ manifest: m });
          } catch (eHomeRows) {
            warn('home plan failed', eHomeRows);
          }
          /* Ряды зарегистрированы — здесь и только здесь видно, успели мы к
             первому экрану или он построился без нас (см. repairHomeRows). */
          repairHomeRows();
        });
      }
    } catch (eRows2) {
      warn('rows register failed', eRows2);
    }
    /* Task 57: дедупликация фильмов между рядами главной. Подменяет
       Lampa.Api.main — ставить её надо один раз на активацию, а не на
       каждую перерегистрацию рядов: свою настройку обёртка читает сама в
       момент построения главной (src/44_rows.js, installDedupe). */
    try {
      if (LC.rows && LC.rows.installDedupe) LC.rows.installDedupe();
    } catch (eDedupe) {
      warn('rows dedupe install failed', eDedupe);
    }
    /* Правка 2026-09-23 (разбор композиции, п.4.2): «Режиссер» и «Актеры» —
       одна лента. Подменяет Lampa.Api.full, поэтому ставится один раз на
       активацию, рядом с обёрткой главной (src/85_header.js, installPeople). */
    try {
      if (LC.header && LC.header.installPeople) LC.header.installPeople();
    } catch (ePeople) {
      warn('people merge install failed', ePeople);
    }
    /* Task 17: компоненты хаба и сетки + пункт меню «Подборки». install()
       идемпотентен: компоненты регистрируются один раз, пункт меню — только
       если его ещё нет. */
    try {
      if (LC.hub && LC.hub.install) LC.hub.install();
    } catch (eHub) {
      warn('hub install failed', eHub);
    }
    /* Task 18: плагин включили из настроек, а под ними открыта главная —
       возврат из настроек Lampa событием 'activity' не сопровождает (находка
       ревью Task 8), поэтому героя на неё ставим отсюда. Если открыто что-то
       другое, mountCurrent() ничего не делает. */
    try {
      if (LC.hero && LC.hero.mountCurrent) LC.hero.mountCurrent();
    } catch (eHero) {
      warn('hero mount failed', eHero);
    }
    /* Следующий раунд, п.10: ряд главной, из которого ушли в шапку, — для
       возврата фокуса после смены «Кадра над рядами» (src/47_homerow.js).
       Слушатель один на body, пока плагин включён. */
    try {
      if (LC.homeRow && LC.homeRow.install) LC.homeRow.install();
    } catch (eHomeRow) {
      warn('home row install failed', eHomeRow);
    }
    /* Task 19: чипы профилей настроения — подписываются на события Activity
       и сами монтируются/снимаются при переходах на главную и с неё. */
    try {
      if (LC.moods && LC.moods.install) LC.moods.install();
    } catch (eMoods) {
      warn('moods install failed', eMoods);
    }
    /* Task 25: метки на постерах уже открытой главной — по той же причине,
       что герой и чипы: возврат из настроек Lampa события 'start' не шлёт. */
    try {
      if (LC.badges && LC.badges.install) LC.badges.install();
    } catch (eBadges) {
      warn('badges install failed', eBadges);
    }
    /* Task 26: пункты плагина в меню карточки по удержанию OK. Две подписки
       (capture-слушатель 'hover:long' на document и preshow у Lampa.Select),
       ставятся один раз на всё время работы плагина. */
    try {
      if (LC.cardmenu && LC.cardmenu.install) LC.cardmenu.install();
    } catch (eCardmenu) {
      warn('cardmenu install failed', eCardmenu);
    }
    /* Task 27: ускорители навигации — две подписки на клавиатуру Lampa.
       apply() ставит их, только если включена хотя бы одна из двух настроек
       (мини-карта, быстрое листание). */
    try {
      if (LC.nav && LC.nav.apply) LC.nav.apply();
    } catch (eNav) {
      warn('nav install failed', eNav);
    }
    /* Task 23: компонент рулетки и пункт меню «Что посмотреть». install()
       идемпотентен: компонент регистрируется один раз, пункт меню — только
       если его ещё нет. */
    try {
      if (LC.roulette && LC.roulette.install) LC.roulette.install();
    } catch (eRoulette) {
      warn('roulette install failed', eRoulette);
    }
    /* Task 22: ambient-режим — три слушателя document и таймер покоя.
       apply() сам проверяет настройку: выключенная заставка не подписывается
       вовсе (src/54_ambient.js). */
    try {
      if (LC.ambient && LC.ambient.apply) LC.ambient.apply();
    } catch (eAmbient) {
      warn('ambient install failed', eAmbient);
    }
  }

  function deactivate() {
    if (!activated) return;
    activated = false;
    /* Task 24: акцент от постера снимается первым — до LC.removeCss. Его
       сброс при выключенном плагине таблицу стилей не пересобирает
       (src/57_color.js), так что порядок важен только ради отмены
       незавершённого расчёта по постеру. */
    try { if (LC.accent) LC.accent.destroy(); } catch (eAccentOff) {}
    /* Task 29: выключенный плагин не имеет права держать ни отложенного
       кадра замера, ни слоя перехода поверх экрана. Обе уборки идемпотентны
       и при отсутствии живых ресурсов не делают ничего. */
    try { if (LC.perf) LC.perf.stop(); } catch (ePerfOff) {}
    /* Task 31 (фаза 4): выключенный плагин не имеет права держать ни узел
       HUD, ни его кадровый цикл, ни PerformanceObserver. */
    try { if (LC.hud) LC.hud.stop(); } catch (eHudOff) {}
    /* Task 21: выключенный плагин не имеет права держать ни одного
       кадрового цикла. unmountAll снимает все слои частиц разом — и с
       карточки, и с кадра главной, — после чего следующий кадр не
       заказывается вовсе. */
    try { if (LC.fx) LC.fx.unmountAll(); } catch (eFxOff) {}
    try { if (LC.transition) LC.transition.stop(); } catch (eTransOff) {}
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
      /* Task 40: класс тяжёлых эффектов снимается вместе с классом режима —
         выключенный плагин не оставляет на body ни одной своей метки.
         Волна 2 (D1): метка карточки lumen-card-on — туда же. */
      if (body && body.length) body.removeClass(MOTION_CLASSES).removeClass('lumen-fx-heavy').removeClass(CARD_ON);
    } catch (e3) {
      warn('motion class off failed', e3);
    }
    stripAllCards();
    /* Task 15, волна 4: снять все ряды главной — и подборки, и личные;
       следующий activate() зарегистрирует их заново через план главной. */
    try { if (LC.homeplan && LC.homeplan.unregister) LC.homeplan.unregister(); } catch (eRows) {}
    /* Task 57: выключенный плагин не имеет права держать свою обёртку над
       Lampa.Api.main — главная должна строиться ровно как без плагина. */
    try { if (LC.rows && LC.rows.uninstallDedupe) LC.rows.uninstallDedupe(); } catch (eDedupeOff) {}
    /* Выключенный плагин не имеет права держать свою обёртку над
       Lampa.Api.full — карточка строится ровно как без плагина. */
    try { if (LC.header && LC.header.uninstallPeople) LC.header.uninstallPeople(); } catch (ePeopleOff) {}
    /* Одна попытка достройки главной на активацию: следующее включение
       плагина получит свою (см. repairHomeRows). */
    home_repaired = false;
    /* Task 17: убрать пункт меню «Подборки». */
    try { if (LC.hub && LC.hub.uninstall) LC.hub.uninstall(); } catch (eHubOff) {}
    /* Task 18: снять героя целиком — узел, класс корня, наблюдатель,
       незавершённые предзагрузку кадра и запрос деталей. */
    try { if (LC.hero && LC.hero.unmount) LC.hero.unmount(); } catch (eHeroOff) {}
    /* Следующий раунд, п.10: слушатель фокуса и взведённый возврат ряда. */
    try { if (LC.homeRow && LC.homeRow.uninstall) LC.homeRow.uninstall(); } catch (eHomeRowOff) {}
    /* Task 19: снять чипы настроения и отписаться от событий Activity. */
    try { if (LC.moods && LC.moods.uninstall) LC.moods.uninstall(); } catch (eMoodsOff) {}
    /* Task 25: снять наблюдатель меток и сами метки с открытой главной. */
    try { if (LC.badges && LC.badges.uninstall) LC.badges.uninstall(); } catch (eBadgesOff) {}
    /* Task 26: снять обе подписки меню карточки — выключенный плагин своих
       пунктов в штатное меню не дописывает. */
    try { if (LC.cardmenu && LC.cardmenu.uninstall) LC.cardmenu.uninstall(); } catch (eCardmenuOff) {}
    /* Task 27: снять подписки на клавиатуру, панель мини-карты, индикатор
       позиции и все четыре таймера модуля. */
    try { if (LC.nav && LC.nav.uninstall) LC.nav.uninstall(); } catch (eNavOff) {}
    /* Task 23: убрать пункт меню «Что посмотреть». */
    try { if (LC.roulette && LC.roulette.uninstall) LC.roulette.uninstall(); } catch (eRouletteOff) {}
    /* Task 22: выключенный плагин не имеет права держать ни слушателей
       document, ни таймера покоя, ни открытого слоя заставки с его
       предзагрузкой кадра. */
    try { if (LC.ambient && LC.ambient.uninstall) LC.ambient.uninstall(); } catch (eAmbientOff) {}
  }

  /* -------------------------------------------------------------------- */
  /* Task 20: пересборка экрана под изменившуюся настройку.                */
  /*                                                                       */
  /* Ряды главной живут в Lampa.ContentRows: перерегистрация меняет то,    */
  /* что Lampa построит В СЛЕДУЮЩИЙ раз, а уже нарисованный экран остаётся */
  /* прежним. Инвариант проекта («возврат из настроек Lampa экран не       */
  /* перерисовывает — применяет настройка сама») требует пересобрать его    */
  /* самим: Lampa.Activity.replace() уничтожает текущую активность и        */
  /* поднимает её заново с тем же object (app.min.js ~46133).              */
  /*                                                                       */
  /* Пока пользователь в настройках, активна активность настроек — заменять */
  /* её нельзя. Поэтому компонент запоминается и пересобирается на 'start'  */
  /* при возврате (LC.onActivityEvent). Замена откладывается на таймер: она */
  /* приходит ИЗ обработчика события Lampa, а replace() внутри рассылки     */
  /* того же события рвал бы цикл подписчиков.                             */
  /* -------------------------------------------------------------------- */

  var pending_refresh = null;

  function activeComponentName() {
    try {
      if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
      var act = Lampa.Activity.active();
      return (act && act.component) || null;
    } catch (e) {
      return null;
    }
  }

  function replaceSoon(component) {
    setTimeout(function () {
      try {
        if (!activated) return;
        /* Слой проверяется ЗДЕСЬ, а не только при постановке таймера: за
           эти миллисекунды пользователь успевает открыть селектбокс (и,
           наоборот, закрыть настройки). Не закрылось — откладываем через
           тот же pending_refresh. */
        if (layerOpen()) {
          pending_refresh = component;
          followSettingsClose();
          return;
        }
        if (activeComponentName() !== component) return;
        if (!Lampa.Activity || typeof Lampa.Activity.replace !== 'function') return;
        /* Волна 4: пересборка главной из-за настройки эпоху ротации рядов не
           двигает (src/47_homeplan.js, hold) — иначе смена «Количества
           рядов» перетасовала бы главную под руками. Api.main Lampa зовёт
           внутри replace() синхронно (push$3 → create → onCreate,
           app.min.js:45836-45841, 37068), поэтому метки на время вызова
           хватает. */
        var home = component === 'main' && LC.homeplan && typeof LC.homeplan.hold === 'function';
        if (home) LC.homeplan.hold(true);
        try {
          Lampa.Activity.replace();
        } finally {
          if (home) LC.homeplan.hold(false);
        }
      } catch (e) {
        warn('activity replace failed', e);
      }
    }, 0);
  }

  /* Настройки Lampa 3.3.4 — НЕ активность, а слой поверх текущей (её
     Activity.active() всё это время остаётся главной). Пересобрать экран под
     открытыми настройками нельзя: замена активности закрывает слой и уводит
     фокус из раздела, где пользователь как раз крутит переключатели (видно
     живьём). Поэтому пока слой открыт — только запоминаем. */
  var settings_close_followed = false;

  /* Имя активного контроллера — узкий признак: он покрывает сами настройки,
     но НЕ селектбокс поверх них (там контроллер называется 'select') и не
     клавиатуру ввода. Поэтому это лишь одно из слагаемых layerOpen(). */
  function settingsOpen() {
    try {
      var cur = window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
      var name = cur && cur.name;
      return name === 'settings' || name === 'settings_component';
    } catch (e) {
      return false;
    }
  }

  /* Открыт ли ПОВЕРХ активности какой-нибудь слой. Признак берём тот же,
     что сама Lampa в Controller.toContent() (vendor/lampa/app.min.js):
     классы settings--open / selectbox--open на body плюс присутствие .modal.
     Это важно именно для type:'select' и 'input': Lampa пишет Storage ДО
     возврата контроллера (у нашего экрана состава рядов, src/80_settings.js,
     — на каждую галочку), так что onChange прилетает, пока список открыт.
     Пересборка в этот момент делает Controller.toggle('content') внутри
     ActivitySlide.start(), и пульт перестаёт управлять открытым списком. */
  function layerOpen() {
    try {
      var body = bodyRoot();
      if (body && body.length && typeof body.hasClass === 'function') {
        if (body.hasClass('settings--open')) return true;
        if (body.hasClass('selectbox--open')) return true;
      }
    } catch (eBody) {}
    try {
      if (window.Lampa && Lampa.Select && typeof Lampa.Select.opened === 'function' && Lampa.Select.opened()) return true;
    } catch (eSelect) {}
    try {
      var modal = $('.modal');
      if (modal && modal.length) return true;
    } catch (eModal) {}
    if (menuFocused()) return true;
    return settingsOpen();
  }

  /* Фокус в левом меню Lampa. Слоя над активностью меню не создаёт — это
     сайдбар, — но пересборка под ним всё равно выдёргивает фокус: внутри
     ActivitySlide.start() Lampa зовёт Controller.toggle('content'), и пульт
     уходит из меню на ряды. Для пользователя это то же самое, что дёрнуть
     экран под руками, поэтому меню считается слоем наравне с настройками. */
  function menuFocused() {
    try {
      var cur = window.Lampa && Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
      return !!(cur && cur.name === 'menu');
    } catch (e) {
      return false;
    }
  }

  /* Слой настроек закрылся — Lampa шлёт своё событие 'close' (app.min.js
     ~10332). Событий активности при этом нет вовсе, поэтому отложенная
     пересборка держится на этой подписке. */
  function followSettingsClose() {
    if (settings_close_followed) return;
    try {
      if (!window.Lampa || !Lampa.Settings || !Lampa.Settings.listener || typeof Lampa.Settings.listener.follow !== 'function') return;
      Lampa.Settings.listener.follow('close', function () {
        try {
          if (!pending_refresh) return;
          var component = pending_refresh;
          pending_refresh = null;
          replaceSoon(component);
        } catch (e) {
          warn('settings close refresh failed', e);
        }
      });
      settings_close_followed = true;
    } catch (err) {
      warn('settings close follow failed', err);
    }
  }

  /* Пересобрать экран компонента: сейчас, если он открыт, иначе — когда на
     него вернутся (или когда закроется слой настроек). Второй вызов до
     пересборки просто заменяет запомненный компонент: пересборка всё равно
     одна. */
  LC.refreshComponent = function (component) {
    if (!activated || !component) return;
    if (layerOpen()) {
      pending_refresh = component;
      followSettingsClose();
      return;
    }
    if (activeComponentName() === component) {
      pending_refresh = null;
      replaceSoon(component);
      return;
    }
    pending_refresh = component;
  };

  /* -------------------------------------------------------------------- */
  /* Гонка первого экрана с загрузкой плагина.                             */
  /*                                                                       */
  /* Главную Lampa поднимает по setTimeout(last, 500) из Activity.init     */
  /* (app.min.js:45641; last — 46039), а плагин приезжает по сети с        */
  /* хостинга: кто успел, тот и решает, попадут ли НАШИ ряды в первый      */
  /* экран. Проигрыш стоит дорого — человек видит главную вообще без рядов */
  /* подборок и без персональных рядов, и так до следующего захода на неё. */
  /* Беда не новая (она с Task 15, когда ряды впервые появились), Task 57  */
  /* её только обнажил: у рядов, в отличие от героя, чипов и меток, нет    */
  /* доклейки к уже нарисованному экрану — ContentRows меняет только то,   */
  /* что Lampa построит В СЛЕДУЮЩИЙ раз.                                   */
  /*                                                                       */
  /* Чиним ОДИН раз за активацию и только по подтверждённому факту, а не   */
  /* по подозрению: главная сейчас на экране И ни одна наша call-функция   */
  /* ещё не вызывалась (LC.rows.served(), см. src/44_rows.js). Второе      */
  /* условие и снимает ложное срабатывание: если Lampa успела построить    */
  /* главную между нашей регистрацией и этой проверкой, served() уже true. */
  /* Главной на экране нет — чинить нечего, следующая построится с нами.   */
  /*                                                                       */
  /* Пересборка идёт через LC.refreshComponent: там и откладывание на      */
  /* открытый слой (настройки, селектбокс, модалка, фокус в меню), и       */
  /* проверка, что компонент всё ещё тот самый, и таймер, чтобы не звать   */
  /* Activity.replace() из обработчика события Lampa.                      */
  /* -------------------------------------------------------------------- */

  var home_repaired = false;

  function repairHomeRows() {
    if (home_repaired) return;
    /* Флаг поднимается ДО проверок: одна попытка на активацию, чем бы она
       ни кончилась. deactivate() его сбрасывает — выключенный и снова
       включённый плагин имеет право на свою попытку, но и она будет одна. */
    home_repaired = true;
    try {
      if (!LC.rows || typeof LC.rows.served !== 'function') return;
      if (LC.rows.served()) return;
      if (activeComponentName() !== 'main') return;
      LC.refreshComponent('main');
    } catch (e) {
      warn('home repair failed', e);
    }
  }

  /* Вызывается из LC.onActivityEvent на 'start': вернулись на экран, который
     ждал пересборки. */
  LC.refreshPending = function (component) {
    if (!component || pending_refresh !== component) return;
    pending_refresh = null;
    replaceSoon(component);
  };

  /* Task 15 (I5-fix) + Task 20: состав, число и фильтр рядов главной.
     Вызывается из applyPrefChange в 80_settings.js.
     manifest.load использует кэш (синхронно), поэтому задержки нет; при
     смене адреса каталога кэш уже сброшен и load идёт в сеть. */
  LC.applyRowsPref = function () {
    if (!activated) return;
    try {
      if (LC.manifest && LC.manifest.load) {
        LC.manifest.load(function (m) {
          if (!activated) return;
          if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply({ manifest: m });
          /* Ряды перерегистрированы — теперь пересобрать главную, иначе
             пользователь увидит новый состав только со следующего захода. */
          LC.refreshComponent('main');
        });
      }
    } catch (e) {
      warn('rows pref failed', e);
    }
  };

  /* Task 19/20: чипы профилей настроения включили или выключили. */
  LC.applyMoodsPref = function () {
    if (!activated) return;
    try {
      if (!LC.moods) return;
      if (LC.pref('lumen_moods', true)) {
        if (LC.moods.install) LC.moods.install();
        if (LC.moods.mountCurrent) LC.moods.mountCurrent();
      } else if (LC.moods.unmount) {
        LC.moods.unmount();
      }
    } catch (e) {
      warn('moods pref failed', e);
    }
  };

  /* Правка пользователя 2026-09-17 (п.2): сменили размер кадра над рядами.
     Пересобирать активность не нужно — высота кадра и сдвиг области рядов
     живут в таблице стилей, её достаточно пересобрать. Узел героя — другое
     дело: «Выключен» его снимает (заодно уходит и класс .lumen-main, то есть
     ряды возвращаются к штатному размеру Lampa), а возврат к любому размеру
     ставит его обратно на уже открытую главную.
     Task 36 (ревью, находка К1): чипы настроения от героя ЗАВИСЯТ. С волны 3
     (ТВ 2026-09-24) — так: при живом кадре чипов на главной нет, без кадра
     они монтируются своим узлом в корень активности (src/49_moods.js).
     Значит смена размера их ставит или снимает: «Выключен» — появляются,
     возврат к любому размеру — уходят.
     Отсюда два требования, и оба обязательны:
       - чипы монтируются ПОСЛЕ работы с героем, а не до неё: до неё DOM ещё
         в старом состоянии, и LC.moods увидел бы не того героя;
       - в обеих ветках, включая «Выключен»: раньше ветка выключения уходила
         в return раньше монтирования.
     Само решение принимает LC.moods.mount по узлу героя в корне, поэтому
     лишний вызов здесь остаётся no-op, как и был. */
  LC.applyHeroSizePref = function () {
    if (!activated) return;
    try {
      armRowBack();
      LC.injectCss();
      remountHero();
      if (captionBadges()) remountBadges();
    } catch (e) {
      warn('hero size pref failed', e);
    }
  };

  /* Следующий раунд, п.10 (полное ревью c644bfd, D4): смена «Кадра над
     рядами» на открытой главной — фокус после выхода из настроек вернётся
     в ряд, из которого пользователь поднялся в шапку (src/47_homerow.js).
     Взводится до пересборки: снимок ряда не зависит от того, что сделают
     таблица стилей и герой. */
  function armRowBack() {
    try {
      if (LC.homeRow && typeof LC.homeRow.arm === 'function') LC.homeRow.arm();
    } catch (e) {
      warn('home row arm failed', e);
    }
  }

  /* Волна «хвосты героя», п.G (ревью подложки): в виде меток «в подписи»
     место метки на главной зависит от кадра — при живом кадре строки
     «год · ★» нет, и метку рисует постер (src/62_badges.js,
     captionHidden). Смена размера кадра на живой главной это решение
     меняет, а нарисованные метки остаются на прежних местах: из
     «Компактного» или «Выключенного» в «Крупный» метки в подписи пропадали
     вместе со строкой. Поэтому после героя (и чипов) метки перерисовываются
     — только в этом виде: «на постере» у метки одно место. */
  function captionBadges() {
    try { return LC.badgesMode() === 'caption'; } catch (e) { return false; }
  }

  /* Ревью Task 62: тело без пересборки CSS — его зовут и смена самого
     размера кадра (выше, сразу после своей пересборки), и применение
     готового стиля (LC.applyPresetChanges ниже), где пересборка одна на
     весь набор значений. Порядок внутри прежний: сперва герой, потом чипы —
     они ищут своё место в уже обновлённом DOM (находка К1 ревью Task 36). */
  function remountHero() {
    if (LC.hero) {
      if (LC.pref('lumen_hero_size', 'large') === 'off') {
        if (LC.hero.unmount) LC.hero.unmount();
      } else if (LC.hero.mountCurrent) {
        LC.hero.mountCurrent();
      }
    }
    if (LC.moods && LC.moods.mountCurrent) LC.moods.mountCurrent();
  }

  /* Task 25: метки на постерах включили или выключили. Пересобирать экран не
     нужно: метки — узлы внутри уже нарисованных карточек, их можно снять
     (uninstall) и поставить (install) прямо на живой главной.
     Task 42: от этой же настройки зависят правила таблицы стилей, скрывающие
     штатную плашку рейтинга .card__vote на постерах — главной, а с Task 43 и
     сетки подборки. Пока метки включены, рейтинг стоит в подписи
     (LC.badges.decorate); выключены — писать его некому, и плашку надо
     вернуть. Подписи УЖЕ нарисованных карточек при этом не переписываются
     (strip снимает метки и полосы, но не правит .card__age): до следующей
     отрисовки экрана рейтинг виден дважды. Отсюда пересборка CSS:
     applyPrefChange для 'lumen_badges' выходит сразу после этого вызова и
     сама LC.injectCss не зовёт (src/80_settings.js). */
  /* Task 62a (фаза 5): видов метки стало три, и между двумя ПОКАЗАННЫМИ
     («на постере» ↔ «в подписи») наблюдатель не меняется — меняется место
     уже нарисованных меток. Поэтому сначала uninstall (он снимает метки с
     живого экрана и сбрасывает флаг lumen_badged на карточках), и только
     потом install: без этого на экране остались бы плашки прошлого вида. */
  LC.applyBadgesPref = function () {
    if (!activated) return;
    try {
      remountBadges();
      LC.injectCss();
    } catch (e) {
      warn('badges pref failed', e);
    }
  };

  /* Ревью Task 62: тело без пересборки CSS — по той же причине, что у
     remountHero выше.
     Ревью Task 62 (М4): сетка подборки метки себе ставит сама при
     построении (src/46_hub.js зовёт LC.badges.decorate), и наблюдателя на
     ней нет — install/uninstall до неё не достают. Пока видов было два,
     смена настройки на открытой сетке просто оставляла метки до следующего
     входа; с видом «в подписи» разница стала заметной (на постере плашка, в
     подписи пусто), поэтому открытую сетку перерисовываем отдельно. */
  function remountBadges() {
    if (!LC.badges) return;
    LC.badges.uninstall();
    if (LC.badgesMode() !== 'off') LC.badges.install();
    redrawGridBadges();
  }

  function redrawGridBadges() {
    try {
      if (!LC.badges || typeof LC.badges.redraw !== 'function') return;
      if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
      var act = Lampa.Activity.active();
      if (!act || act.component !== 'lumen_grid') return;
      if (!act.activity || typeof act.activity.render !== 'function') return;
      LC.badges.redraw(act.activity.render());
    } catch (e) {
      warn('badges grid redraw failed', e);
    }
  }

  /* Ревью Task 62 (пункт 5): применение НАБОРА значений — одним проходом.
     Кнопка готового стиля пишет до семи настроек разом, и если каждую
     применять штатной веткой, таблица стилей пересобирается до пяти раз
     подряд: замер на стенде (Chrome, 960×540@2, 2026-09-21) — 5 вызовов
     LC.injectCss на нажатие, медиана семи прогонов 33.5 мс с форсированным
     recalc при разбросе 23-48. Текст таблицы около 100 КБ, и на WebView
     телевизора, где меряли 21 fps, это заметная заморозка ровно в момент
     нажатия. Поэтому значения пишутся с nolisten (третий аргумент
     Lampa.Storage.set, vendor/lampa/app.min.js:48472-48504 — при нём
     listener 'change' не рассылается, а localStorage и кэш readed
     обновляются как обычно), а применение идёт здесь, один раз.

     Порядок важен: шрифт (<link>) → таблица стилей → узлы, которые от неё
     зависят. Герой после пересборки — высоту кадра он берёт из свежих
     правил; метки после героя — они живут внутри карточек рядов. Акцент
     последним: LC.applyAccentPref пересобирает таблицу САМ и только когда
     цвет действительно меняется (src/57_color.js). */
  LC.applyPresetChanges = function (keys) {
    if (!activated) return;
    try {
      if (!keys || !keys.length) return;
      var changed = {};
      for (var i = 0; i < keys.length; i++) changed[keys[i]] = true;
      if (changed.lumen_hero_size) armRowBack();
      if (changed.lumen_font) LC.injectFonts();
      LC.injectCss();
      if (changed.lumen_hero_size) remountHero();
      /* П.G: смена размера кадра в виде «в подписи» — тоже (разбор у
         captionBadges); один раз, даже если сменились оба значения. */
      if (changed.lumen_badges || (changed.lumen_hero_size && captionBadges())) remountBadges();
      /* Только сама подкраска: её включение считает цвет по фильму открытой
         карточки, а выключение возвращает акцент из настроек. Область
         подкраски (lumen_accent_scope) отдельной точки не просит — правило
         подложки фокуса живёт в таблице, а узел подкраски переписала та же
         пересборка выше (LC.injectCss зовёт LC.accent.restyle). */
      if (changed.lumen_accent_auto) {
        try { if (LC.applyAccentPref) LC.applyAccentPref(); } catch (eAccent) { warn('preset accent failed', eAccent); }
      }
    } catch (e) {
      warn('preset changes failed', e);
    }
  };

  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): тематическая атмосфера карточки.                    */
  /*                                                                       */
  /* Тема выбирается по ключевым словам фильма (LC.themes), класс темы      */
  /* ставится на слой фона (.lumen-backdrop — сосед карточки, там же лежит  */
  /* и узел .lumen-fx), частицы монтируются в этот узел.                    */
  /*                                                                       */
  /* Слой фона взят так же, как везде в плагине: body.children(…). Проверка */
  /* typeof … === 'function' обязательна — у DOM-узла children это          */
  /* HTMLCollection, и вызов её как функции бросал бы TypeError.           */
  /* -------------------------------------------------------------------- */

  function fxLayerOf(body) {
    if (!body || typeof body.children !== 'function') return null;
    var layer = body.children('.lumen-backdrop');
    if (!layer || !layer.length) return null;
    return layer;
  }

  /* Ставит (или снимает) атмосферу на слое фона карточки. Идемпотентна:
     повторный complite и возврат из истории не удваивают ни канвас, ни
     класс темы. movie — e.data.movie. */
  var CARD_FX_SAFE = { left: 0, top: 0.4, right: 0.57, bottom: 0.93, floor: 0.15, feather: 0.08 };

  LC.applyFxFor = function (body, movie) {
    var layer = fxLayerOf(body);
    if (!layer) return null;
    var node = layer.find('.lumen-fx');
    /* Прежняя атмосфера уходит всегда — даже если новой не будет: иначе
       снег с «Один дома» остался бы на следующей карточке. */
    try { if (LC.fx) LC.fx.unmount(node); } catch (eOff) { warn('fx unmount failed', eOff); }
    /* LC.themes/LC.fx нет только в тестах, где 90_runtime.js грузится без
       соседей: в бандле оба модуля идут раньше. */
    if (!LC.themes || !LC.fx) return null;
    try { layer.removeClass(LC.themes.classNames()); } catch (eCls) { warn('fx class failed', eCls); }

    var theme = null;
    try { theme = LC.themes.forMovie(movie || null); } catch (eTheme) { warn('fx theme failed', eTheme); }
    if (!theme) {
      try { if (LC.accent) LC.accent.setTheme(null); } catch (eAcc) {}
      return null;
    }
    layer.addClass('lumen-theme--' + theme.id);
    /* Акцент темы — запасной для акцента от постера (приоритет плана:
       постер -> тема -> настройка разрешает src/57_color.js сам). */
    try { if (LC.accent) LC.accent.setTheme(theme.accent); } catch (eAcc2) {}
    try {
      return LC.fx.mount(node, theme.preset, {
        color: LC.themes.particleColor(theme),
        /* Волна «праздники крупнее»: зона текста карточки — мета, название
           (логотип), оценки и ряд кнопок в левой части от 0.4 до 0.92
           высоты экрана (замер на стенде: мета 0.44, низ кнопок 0.87,
           правый край «Франшизы» 0.55 ширины). Частицы в ней гаснут до
           15 % — сцена не спорит с текстом, но и не обрывается краем. */
        safe: CARD_FX_SAFE,
        /* Под играющим роликом частицы встают на паузу: поверх видео они и
           не видны, и стоят дороже всего (композитор и так занят кадрами). */
        paused: function () {
          try { return LC.trailer.isLive(layer); } catch (ePause) { return false; }
        }
      });
    } catch (eMount) {
      warn('fx mount failed', eMount);
      return null;
    }
  };

  /* Настройка «Атмосферы» переключена на лету. Настройки Lampa лежат
     активностью ПОВЕРХ карточки и при возврате не шлют ни 'full', ни
     complite, поэтому слой пересобирается здесь: выключили — он уходит
     сразу, включили — тема считается по данным открытой карточки. */
  LC.applyFxPref = function () {
    if (!activated) return;
    try {
      if (!LC.active) {
        /* Карточки нет — но частицы могли остаться в кадре главной
           (src/48_hero.js). Их пересобирает сам герой. */
        if (LC.hero && typeof LC.hero.applyFx === 'function') LC.hero.applyFx();
        return;
      }
      LC.applyFxFor(LC.active.body, (LC.active.data && LC.active.data.movie) || null);
    } catch (e) {
      warn('fx pref failed', e);
    }
  };

  /* Task 26: пункты плагина в меню карточки включили или выключили. Экран
     трогать не нужно — меню собирается заново при каждом удержании OK,
     так что достаточно поставить или снять подписки. */
  LC.applyCardmenuPref = function () {
    if (!activated) return;
    try {
      if (!LC.cardmenu) return;
      if (LC.pref('lumen_context_menu', true)) LC.cardmenu.install();
      else LC.cardmenu.uninstall();
    } catch (e) {
      warn('cardmenu pref failed', e);
    }
  };

  /* Task 27: мини-карта и ускорение листания. LC.nav.apply() сам решает,
     нужны ли подписки на клавиатуру: обе настройки выключены — модуль
     снимает их вместе с панелью и индикатором. */
  LC.applyNavPref = function () {
    if (!activated) return;
    try {
      if (LC.nav && LC.nav.apply) LC.nav.apply();
    } catch (e) {
      warn('nav pref failed', e);
    }
  };

  /* Task 22: заставка из кадров. LC.ambient.apply() сам решает, нужны ли
     подписки: выключенная настройка снимает и слушателей, и таймер покоя, и
     уже открытый слой, включённая — подписывается заново; смена задержки или
     источника просто перезаводит ожидание покоя. */
  LC.applyAmbientPref = function () {
    if (!activated) return;
    try {
      if (LC.ambient && LC.ambient.apply) LC.ambient.apply();
    } catch (e) {
      warn('ambient pref failed', e);
    }
  };

  /* Task 20: подсказку «Ключ API не задан» убрали кнопкой «Скрыть» или
     вернули настройкой. В карточке её перерисовывает LC.applyReviewsPref,
     здесь — открытая сетка подборки Кинопоиска: текст подсказки рисуется
     при загрузке страницы, поэтому сетку пересобираем целиком. */
  LC.applyKpHintPref = function () {
    if (!activated) return;
    if (activeComponentName() !== 'lumen_grid') return;
    LC.refreshComponent('lumen_grid');
  };

  /* Task 16: персональные ряды включили или выключили; волна 4 — и «Начало
     главной» (lumen_home_start). План главной перерегистрирует все её ряды
     (выключенные личные ряды описаний не дают, src/45_personal.js). */
  LC.applyPersonalPref = function () {
    if (!activated) return;
    try {
      if (LC.homeplan && LC.homeplan.apply) LC.homeplan.apply();
      /* Task 20: как и у рядов подборок — пересобрать главную, иначе ряды
         появятся или исчезнут только при следующем её открытии. */
      LC.refreshComponent('main');
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

      /* Task 62a: перевод сохранённых значений на новые типы настроек —
         ДО регистрации раздела и ДО подписки на Storage 'change'. До
         регистрации: раздел рисует пункт по значению из Storage, и старое
         'true' в списке из трёх значений не выбрало бы ни одного. До
         подписки: запись поднимает то самое событие, и своей же миграции
         мы бы ответили лишним применением настройки. */
      LC.migratePrefs();

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

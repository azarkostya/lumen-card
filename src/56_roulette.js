  /* -------------------------------------------------------------------- */
  /* Task 23 (фаза 3): рулетка «Что посмотреть».                           */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   buildPool(results, media, needPoster) → кандидаты одного медиа      */
  /*   applyFilters(pool, {unseen, short}, ctx, media) → отфильтрованные   */
  /*   shortLimit(media) / fitsShort(details, media)                       */
  /*   pick(pool, rnd) → один кандидат или null                            */
  /*   spinPlan(total) → шаги барабана [{index, delay}]                    */
  /*   collectionsFor(manifest, media) / sourcesFor(list, ids, manifest)   */
  /*   parseIds(text) / joinIds(ids) / storageKey(media)                    */
  /*   normalizeMedia(value) / MAX_SOURCES                                  */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   unseenDefault() → значение настройки lumen_roulette_unseen          */
  /*   install() / uninstall() — компонент lumen_roulette и пункт меню     */
  /*   open(media) — открыть рулетку                                        */
  /*   menuNode() — узел пункта меню (для тестов и проверок)               */
  /*                                                                       */
  /* Рулеток две — фильмы и сериалы: у них разные подборки, разный фильтр  */
  /* длительности («есть 90 минут» против «серия до 30 минут») и разный    */
  /* сохранённый набор чипов (storageKey). Экран при этом один: тумблер в  */
  /* шапке переключает медиа, не перезагружая активность.                  */
  /*                                                                       */
  /* Данные — только уже готовые LC.manifest и LC.sources.fetch: рулетка   */
  /* не знает ни про TMDB, ни про Кинопоиск и не заводит своего кэша.      */
  /* Единственный собственный запрос — детали ВЫБРАННОГО фильма, и только  */
  /* когда включён фильтр длительности: у карточек из discover поля        */
  /* runtime нет вовсе, поэтому неизвестная длительность кандидата не      */
  /* отсеивает (иначе пул схлопнулся бы в ноль), а проверяется после       */
  /* выбора — с перевыбором до PICK_TRIES раз.                             */
  /*                                                                       */
  /* «Не смотрел» считается ТЕМ ЖЕ LC.rows.viewedIds (src/44_rows.js), что */
  /* и фильтр досмотренного на главной: Favorite 'viewed' плюс Timeline с  */
  /* процентом от 95. Второго источника правды о просмотренном в проекте   */
  /* нет и не заводится.                                                   */
  /*                                                                       */
  /* Отмена запросов: у компонента своё поколение gen (как у хаба,         */
  /* src/46_hub.js). bump() поднимает его, гасит дескрипторы LC.sources,   */
  /* запрос деталей, таймер барабана и предзагрузку фона результата. Зовут */
  /* его смена медиа, stop() и destroy() — то есть каждый уход с экрана.   */
  /* Смена набора чипов bump() НЕ зовёт — только сбрасывает poolKey, чтобы */
  /* следующий спин перезапросил пул; уже идущие запросы она не гасит.     */
  /* -------------------------------------------------------------------- */

  LC.roulette = (function () {

    /* Сколько подборок разом уходит в сеть. Каждая стоит до двух страниц,
       то есть до MAX_SOURCES × 2 запросов; больше пяти — это уже заметная
       пауза на ТВ, а кандидатов и с пяти набирается под сотню. */
    var MAX_SOURCES = 5;
    /* Страниц на подборку. Две — как в плане: одна даёт 20 кандидатов, и
       рулетка из двадцати начинает повторяться. */
    var PAGES = 2;
    /* Дедлайн сбора пула: подборки отвечают с разной скоростью, и ждать
       самую медленную дольше — значит держать пользователя у пустого
       барабана. Что успело прийти, то и крутим. */
    var POOL_TIMEOUT = 8000;
    /* Попыток перевыбора, когда выбранный не прошёл проверку длительности
       по деталям (план Task 23 Step 2). */
    var PICK_TRIES = 5;
    /* Позиций в ленте барабана. Последняя — выбранный фильм, остальные —
       случайные кандидаты: их постеры мелькают, пока барабан крутится. */
    var REEL_SIZE = 10;
    /* Чипов подборок на экране (не считая «Все подборки»). Каталог отдаёт
       их полторы сотни, и все они на экран ТВ не помещаются — см. chipList. */
    var CHIP_LIMIT = 14;
    /* Task 39: ширина барабана в em Lampa — то же число, что у
       .lumen-roulette__reel в src/30_css.js (width:9.2em). По ней
       выбирается размер постера, который в барабане показан. */
    var REEL_EM = 9.2;

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Медиа карточки: media_type, если TMDB его прислал, иначе по полям
       названия и даты (у сериала name/first_air_date). */
    function cardMedia(card) {
      if (card && card.media_type) return card.media_type === 'tv' ? 'tv' : 'movie';
      return (card && (card.name || card.first_air_date)) ? 'tv' : 'movie';
    }

    function normalizeMedia(value) {
      return value === 'tv' ? 'tv' : 'movie';
    }

    /* Кандидаты одного медиа без дублей. needPoster — требовать постер:
       барабану нечего показать без картинки, а карточки без постера
       попадаются у Кинопоиска и у свежих премьер. */
    function buildPool(results, media, needPoster) {
      var out = [];
      if (!results || !results.length) return out;
      var want = normalizeMedia(media);
      var seen = {};
      for (var i = 0; i < results.length; i++) {
        var card = results[i];
        if (!card || card.id == null) continue;
        if (cardMedia(card) !== want) continue;
        if (needPoster && !card.poster_path) continue;
        if (seen[card.id]) continue;
        seen[card.id] = 1;
        out.push(card);
      }
      return out;
    }

    /* Порог фильтра длительности: полтора часа фильму, полчаса серии. */
    function shortLimit(media) {
      return normalizeMedia(media) === 'tv' ? 30 : 90;
    }

    /* Фильтры пула. ctx даёт то, что знает окружение: isSeen(id) — история
       просмотра, runtime(id) — длительность, если она уже известна. Ни
       одного запроса здесь нет: неизвестная длительность (null) кандидата
       НЕ отсеивает — её проверяют после выбора (см. fitsShort). */
    function applyFilters(pool, opts, ctx, media) {
      var out = [];
      if (!pool || !pool.length) return out;
      opts = opts || {};
      var limit = shortLimit(media);
      for (var i = 0; i < pool.length; i++) {
        var card = pool[i];
        if (opts.unseen && ctx && typeof ctx.isSeen === 'function' && ctx.isSeen(card.id)) continue;
        if (opts.short && ctx && typeof ctx.runtime === 'function') {
          var minutes = ctx.runtime(card.id);
          if (minutes != null && Number(minutes) > limit) continue;
        }
        out.push(card);
      }
      return out;
    }

    /* Проходит ли ВЫБРАННЫЙ кандидат фильтр длительности по деталям TMDB.
       Ноль и пустой список — «неизвестно»: отказывать за отсутствие данных
       нельзя, иначе фильтр выбрасывал бы половину каталога. */
    function fitsShort(details, media) {
      if (!details) return true;
      var limit = shortLimit(media);
      if (normalizeMedia(media) === 'tv') {
        var list = details.episode_run_time;
        if (!list || !list.length) return true;
        var min = Number(list[0]) || 0;
        for (var i = 1; i < list.length; i++) {
          var v = Number(list[i]) || 0;
          if (v && (!min || v < min)) min = v;
        }
        if (!min) return true;
        return min <= limit;
      }
      var runtime = Number(details.runtime) || 0;
      if (!runtime) return true;
      return runtime <= limit;
    }

    /* Равномерный выбор. rnd отдаётся параметром — тесты проверяют края. */
    function pick(pool, rnd) {
      if (!pool || !pool.length) return null;
      var random = typeof rnd === 'function' ? rnd : Math.random;
      var i = Math.floor(random() * pool.length);
      if (i < 0) i = 0;
      if (i >= pool.length) i = pool.length - 1;
      return pool[i];
    }

    /* План барабана: разгон (шаги редеют), вращение, торможение (шаги
       растягиваются). Индексы идут по ленте по кругу, последний шаг —
       её последняя позиция, где лежит выбранный фильм. Общая длительность
       около 3100 мс: короче — не успеваешь понять, что это барабан, длиннее
       — уже ожидание. */
    function spinPlan(total) {
      var plan = [];
      var n = Number(total) || 0;
      if (n <= 0) return plan;
      if (n === 1) return [{ index: 0, delay: 0 }];

      var FAST = 40;
      var index = 0;
      var i;
      /* Разгон: 400 мс, шаг сокращается со 100 до FAST. */
      var accel = [100, 90, 75, 60, 50, FAST];
      for (i = 0; i < accel.length; i++) {
        index = (index + 1) % n;
        plan.push({ index: index, delay: accel[i] });
      }
      /* Вращение: 1800 мс ровным шагом. */
      var spins = Math.round(1800 / FAST);
      for (i = 0; i < spins; i++) {
        index = (index + 1) % n;
        plan.push({ index: index, delay: FAST });
      }
      /* Торможение: 885 мс, шаг растёт до 295 — последние кадры видно. */
      var brake = [50, 60, 80, 100, 130, 170, 295];
      for (i = 0; i < brake.length; i++) {
        index = (index + 1) % n;
        plan.push({ index: index, delay: brake[i] });
      }
      /* Последний кадр — выбранный фильм. Индекс правим, а не досыпаем шаг:
         сумма длительностей уже набрана. */
      plan[plan.length - 1].index = n - 1;
      return plan;
    }

    /* Подборки каталога, у которых есть источник нужного медиа. Подборки
       главной идут первыми: с них начинают, и докручивать ленту чипов до
       «В тренде» никто не должен. */
    function collectionsFor(manifest, media) {
      var out = [];
      if (!manifest || !Array.isArray(manifest.collections)) return out;
      var want = normalizeMedia(media);
      var home = {};
      var homeList = manifest.home || [];
      var i;
      for (i = 0; i < homeList.length; i++) home[homeList[i]] = i + 1;
      var first = [];
      var rest = [];
      for (i = 0; i < manifest.collections.length; i++) {
        var c = manifest.collections[i];
        if (!c || !c.sources || !c.sources[want]) continue;
        if (home[c.id]) first.push(c);
        else rest.push(c);
      }
      first.sort(function (a, b) { return home[a.id] - home[b.id]; });
      return first.concat(rest);
    }

    function parseIds(text) {
      var out = [];
      if (!text) return out;
      var parts = ('' + text).split(',');
      for (var i = 0; i < parts.length; i++) {
        var id = parts[i].replace(/^\s+|\s+$/g, '');
        if (id) out.push(id);
      }
      return out;
    }

    function joinIds(ids) {
      return (ids && ids.length) ? ids.join(',') : '';
    }

    /* Из чего собирать пул: выбранные чипами подборки, а если не выбрано
       ничего («Все») — набор главной. Полторы сотни подборок разом никто не
       грузит: предел MAX_SOURCES. */
    function sourcesFor(list, ids, manifest) {
      var out = [];
      if (!list || !list.length) return out;
      var picked = {};
      var i;
      for (i = 0; ids && i < ids.length; i++) picked[ids[i]] = 1;
      for (i = 0; i < list.length && out.length < MAX_SOURCES; i++) {
        if (picked[list[i].id]) out.push(list[i]);
      }
      if (out.length) return out;
      /* Ничего не выбрано или выбраны неизвестные id — набор главной. */
      var home = (manifest && manifest.home) || [];
      var byId = {};
      for (i = 0; i < list.length; i++) byId[list[i].id] = list[i];
      for (i = 0; i < home.length && out.length < MAX_SOURCES; i++) {
        if (byId[home[i]]) out.push(byId[home[i]]);
      }
      if (out.length) return out;
      /* У каталога без home (или без единой подборки этого медиа в нём)
         берём первые по порядку — рулетка обязана уметь крутиться всегда. */
      for (i = 0; i < list.length && out.length < MAX_SOURCES; i++) out.push(list[i]);
      return out;
    }

    function storageKey(media) {
      return 'lumen_roulette_' + normalizeMedia(media);
    }

    /* Чипы подборок на экране: «Все подборки» рисуется отдельно, а сюда
       попадают первые CHIP_LIMIT из каталога (подборки главной идут первыми
       — collectionsFor) плюс всё, что пользователь отметил раньше, даже если
       оно лежит в самом хвосте каталога.

       Живая проверка 2026-09-17 показала, зачем предел: полный каталог дал
       134 чипа, они заняли весь экран сплошной простынёй, а барабан с
       кнопкой «Крутить» уехали за нижнюю кромку. */
    function chipList(list, chosen, limit) {
      var out = [];
      if (!list || !list.length) return out;
      var max = Number(limit) || CHIP_LIMIT;
      var picked = {};
      var i;
      for (i = 0; chosen && i < chosen.length; i++) picked[chosen[i]] = 1;
      var taken = {};
      for (i = 0; i < list.length && out.length < max; i++) {
        taken[list[i].id] = 1;
        out.push(list[i]);
      }
      /* Отмеченные, не попавшие в предел, — в конец: снять галочку с того,
         чего не видно, иначе было бы нечем. */
      for (i = 0; i < list.length; i++) {
        if (picked[list[i].id] && !taken[list[i].id]) out.push(list[i]);
      }
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function esc(text) {
      return LC.util.esc('' + (text == null ? '' : text));
    }

    function unseenDefault() {
      try {
        if (typeof LC.pref === 'function') return !!LC.pref('lumen_roulette_unseen', true);
      } catch (e) { }
      return true;
    }

    function storedIds(media) {
      try {
        if (window.Lampa && Lampa.Storage) return parseIds(Lampa.Storage.get(storageKey(media), ''));
      } catch (e) { }
      return [];
    }

    function saveIds(media, ids) {
      try {
        if (window.Lampa && Lampa.Storage) Lampa.Storage.set(storageKey(media), joinIds(ids));
      } catch (e) {
        warn('roulette: save ids failed', e);
      }
    }

    function lang() {
      try {
        if (typeof LC.langCode === 'function') return LC.langCode();
      } catch (e) { }
      return 'ru';
    }

    function titleOf(item) {
      try {
        if (LC.hub && typeof LC.hub.titleOf === 'function') return LC.hub.titleOf(item, lang());
      } catch (e) { }
      return (item && item.title) || (item && item.id) || '';
    }

    function imageUrl(path, size) {
      try {
        if (!path) return '';
        var tmdb = null;
        var img = null;
        if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
          tmdb = function (url) { return Lampa.TMDB.image(url); };
        }
        if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
          img = function (p, s) { return Lampa.Api.img(p, s); };
        }
        return LC.cardinfo.imageUrl(path, size, tmdb, img);
      } catch (e) {
        return '';
      }
    }

    function motionClass(node) {
      try { node.addClass('lumen-motion-' + LC.motionMode()); } catch (e) { }
    }

    function navMove(dir) {
      try {
        if (window.Navigator && typeof Navigator.canmove === 'function' && Navigator.canmove(dir)) {
          Navigator.move(dir);
          return true;
        }
      } catch (e) {
        warn('roulette: navigator failed', e);
      }
      return false;
    }

    /* Год и рейтинг результата — та же мета, что у карточек сетки. */
    function cardMeta(card) {
      var parts = [];
      var date = (card && (card.release_date || card.first_air_date)) || '';
      if (date) parts.push(('' + date).slice(0, 4));
      var vote = Number(card && card.vote_average) || 0;
      if (vote > 0) parts.push(vote.toFixed(1));
      return parts.join(' · ');
    }

    function cardTitle(card) {
      return (card && (card.title || card.name)) || '';
    }

    /* ------------------------------------------------------------------ */
    /* Компонент lumen_roulette                                            */
    /* ------------------------------------------------------------------ */

    function RouletteComponent(object) {
      var self = this;
      var media = normalizeMedia(object && object.media);
      var scroll = new Lampa.Scroll({ mask: true, over: true, step: 250 });
      var root = $('<div class="lumen-roulette"></div>');
      var bg = $('<div class="lumen-roulette__bg"></div>');
      var head = $('<div class="lumen-roulette__head"></div>');
      var chipsRow = $('<div class="lumen-roulette__chips"></div>');
      var filtersRow = $('<div class="lumen-roulette__filters"></div>');
      var stage = $('<div class="lumen-roulette__stage"></div>');
      var reelBox = $('<div class="lumen-roulette__reel"><div class="lumen-roulette__frame"></div></div>');
      var spinBtn = $('<div class="lumen-roulette__spin selector">' + esc(LC.lang('lumen_roulette_spin')) + '</div>');
      var resultBox = $('<div class="lumen-roulette__result"></div>');
      var hint = $('<div class="lumen-roulette__hint">' + esc(LC.lang('lumen_roulette_hint')) + '</div>');

      var gen = 0;
      var handles = [];
      var detailsNet = null;
      var spinTimer = 0;
      var manifest = null;
      var collections = [];
      var chosen = storedIds(media);
      var pool = [];
      var poolKey = '';
      var seen = {};
      var runtimes = {};
      var reel = [];
      var spinning = false;
      var result = null;
      var resultLoader = null;
      /* Показан ли фон ТЕКУЩЕГО result — не «есть ли у карточки backdrop»,
         а «долетела ли уже картинка». this.start() смотрит сюда, чтобы
         решить, поднимать ли предзагрузку заново после stop()/start()
         (Task 34). */
      var resultBgShown = false;
      var lastFocus = null;
      var started = false;
      var filters = { unseen: unseenDefault(), short: false };

      /* Стартовый выбор из object.preselect: «крутить по этой подборке». */
      if (object && object.preselect) chosen = [object.preselect];

      function alive(captured) {
        return function () { return gen === captured; };
      }

      function clearHandles() {
        for (var i = 0; i < handles.length; i++) {
          try { if (handles[i] && handles[i].clear) handles[i].clear(); } catch (e) { }
        }
        handles = [];
        try { if (detailsNet && detailsNet.clear) detailsNet.clear(); } catch (e2) { }
        detailsNet = null;
      }

      function stopSpin() {
        if (spinTimer) {
          clearTimeout(spinTimer);
          spinTimer = 0;
        }
        spinning = false;
        try { spinBtn.removeClass('is-busy'); } catch (e) { }
      }

      /* Task 34: гасит предзагрузку кадра результата — тот же приём, что у
         героя и бэкдропов (cancelPending в src/48_hero.js, src/50_backdrops.js):
         onload/onerror снимаются, чтобы сеть, ответившая позже, не трогала
         уже неактуальный экран. Зовут её из clearResult() (перед новой
         прокруткой и при смене «Фильмы/Сериалы») и из bump() — на случай
         stop()/destroy(), где clearResult() не вызывается. */
      function cancelResultLoader() {
        if (resultLoader) {
          resultLoader.onload = null;
          resultLoader.onerror = null;
          resultLoader = null;
        }
      }

      /* Всё, что было запрошено и запущено для прежнего состояния экрана,
         становится неактуальным разом. */
      function bump() {
        gen++;
        clearHandles();
        stopSpin();
        cancelResultLoader();
      }

      function focusTarget() {
        if (lastFocus && root[0] && root[0].contains && root[0].contains(lastFocus)) return lastFocus;
        return spinBtn[0] || null;
      }

      function recollect(prefer) {
        try {
          Lampa.Controller.collectionSet(root[0]);
          Lampa.Controller.collectionFocus(prefer || focusTarget() || false, root[0]);
        } catch (e) {
          warn('roulette: collection failed', e);
        }
      }

      /* Task 32: экран едет за фокусом — вторая половина штатного контракта
         Lampa (эталон: app.min.js:53107, card.onFocus -> scroll.update).
         Без неё фокус уходит вниз по чипам подборок, а экран стоит на месте.
         tocenter = true: getElementPosition (app.min.js:32046) и с
         центрированием берёт Math.min(0, ...), поэтому всё, что умещается в
         верхнюю половину области, встаёт в начало списка. Кнопка «Крутить»
         лежит ниже этой границы (её верх ≈ 469 px при области 993 px —
         барабан 13.8em, src/30_css.js), и возврат на неё подтягивает экран
         примерно на 70 px: иначе с чипов подборок, стоящих ниже, экран
         наверх сам бы не поехал. Узел передаём как есть: scroll.update
         принимает и jQuery, и DOM (app.min.js:32049). */
      function keepVisible(el) {
        try { scroll.update(el, true); } catch (e) { warn('roulette: scroll.update failed', e); }
      }

      /* Через watchFocus проходят все .selector рулетки, поэтому подкрутка
         к фокусу ставится здесь одной строкой. */
      function watchFocus(node) {
        node.on('hover:focus', function () {
          keepVisible(node[0]);
          lastFocus = node[0];
        });
        return node;
      }

      /* ---------------------------------------------------------------- */
      /* Шапка, чипы, фильтры                                              */
      /* ---------------------------------------------------------------- */

      function buildHead() {
        head.empty();
        head.append($('<div class="lumen-roulette__title">' + esc(LC.lang('lumen_roulette_title')) + '</div>'));
        var tabs = $('<div class="lumen-roulette__media"></div>');
        var pairs = [['movie', 'lumen_roulette_movies'], ['tv', 'lumen_roulette_series']];
        for (var i = 0; i < pairs.length; i++) {
          (function (value, key) {
            var tab = watchFocus($('<div class="lumen-roulette__tab selector">' + esc(LC.lang(key)) + '</div>'));
            if (media === value) tab.addClass('is-on');
            tab.on('hover:enter', function () { setMedia(value, tab[0]); });
            tabs.append(tab);
          })(pairs[i][0], pairs[i][1]);
        }
        head.append(tabs);
      }

      /* Смена медиа без перезагрузки активности (план Task 23 Step 2):
         у фильмов и сериалов свои подборки, свой фильтр длительности и свой
         сохранённый набор чипов, поэтому пересобирается всё, кроме шапки. */
      function setMedia(value, focusNode) {
        if (media === value) return;
        bump();
        media = value;
        chosen = storedIds(media);
        filters.short = false;
        pool = [];
        poolKey = '';
        result = null;
        head.find('.lumen-roulette__tab').removeClass('is-on');
        head.find('.lumen-roulette__tab').each(function (index, node) {
          if ((index === 0 && value === 'movie') || (index === 1 && value === 'tv')) $(node).addClass('is-on');
        });
        buildChips();
        buildFilters();
        clearResult();
        recollect(focusNode || null);
      }

      function chipNode(text, on) {
        var node = watchFocus($('<div class="lumen-chip lumen-roulette__chip selector">' + esc(text) + '</div>'));
        if (on) node.addClass('lumen-chip--on');
        return node;
      }

      function buildChips() {
        chipsRow.empty();
        collections = collectionsFor(manifest, media);
        var all = chipNode(LC.lang('lumen_roulette_all'), !chosen.length);
        all.on('hover:enter', function () {
          if (!chosen.length) return;
          chosen = [];
          saveIds(media, chosen);
          poolKey = '';
          buildChips();
          recollect(chipsRow.find('.lumen-roulette__chip')[0]);
        });
        chipsRow.append(all);
        var shown = chipList(collections, chosen, CHIP_LIMIT);
        for (var i = 0; i < shown.length; i++) {
          (function (item) {
            var node = chipNode(titleOf(item), chosen.indexOf(item.id) >= 0);
            node.on('hover:enter', function () {
              var at = chosen.indexOf(item.id);
              if (at >= 0) chosen.splice(at, 1);
              else chosen.push(item.id);
              saveIds(media, chosen);
              poolKey = '';
              node.toggleClass('lumen-chip--on', at < 0);
              chipsRow.find('.lumen-roulette__chip').eq(0).toggleClass('lumen-chip--on', !chosen.length);
            });
            chipsRow.append(node);
          })(shown[i]);
        }
      }

      function buildFilters() {
        filtersRow.empty();
        var unseen = chipNode(LC.lang('lumen_roulette_unseen'), filters.unseen);
        unseen.on('hover:enter', function () {
          filters.unseen = !filters.unseen;
          unseen.toggleClass('lumen-chip--on', filters.unseen);
        });
        filtersRow.append(unseen);
        var shortKey = media === 'tv' ? 'lumen_roulette_short_tv' : 'lumen_roulette_short_movie';
        var short = chipNode(LC.lang(shortKey), filters.short);
        short.on('hover:enter', function () {
          filters.short = !filters.short;
          short.toggleClass('lumen-chip--on', filters.short);
        });
        filtersRow.append(short);
      }

      /* ---------------------------------------------------------------- */
      /* Пул кандидатов                                                    */
      /* ---------------------------------------------------------------- */

      /* Ключ состояния пула: медиа плюс набор подборок. Фильтры в него не
         входят — они применяются к уже загруженному пулу на месте. */
      function keyOf() {
        return media + '|' + joinIds(chosen);
      }

      function seenIndex(cards) {
        var map = {};
        try {
          if (LC.rows && typeof LC.rows.viewedIds === 'function') {
            var ids = LC.rows.viewedIds(cards);
            for (var i = 0; i < ids.length; i++) map[ids[i]] = 1;
          }
        } catch (e) {
          warn('roulette: viewed failed', e);
        }
        return map;
      }

      function context() {
        return {
          isSeen: function (id) { return !!seen[id]; },
          runtime: function (id) {
            var value = runtimes[media + ':' + id];
            return value == null ? null : value;
          }
        };
      }

      function filtered() {
        return applyFilters(pool, filters, context(), media);
      }

      /* Собирает пул из выбранных подборок (по PAGES страниц на каждую) и
         зовёт done(). Ответ каждой подборки идёт через общий сборщик: пул
         закрывается либо когда ответили все, либо по дедлайну — тем, что
         успело прийти. */
      function loadPool(done) {
        var key = keyOf();
        if (pool.length && poolKey === key) { done(); return; }
        var list = sourcesFor(collectionsFor(manifest, media), chosen, manifest);
        if (!list.length) { pool = []; poolKey = key; done(); return; }

        var captured = gen;
        var cards = [];
        var gate = LC.util.gate(list.length * PAGES, POOL_TIMEOUT, function () {
          if (gen !== captured) return;
          pool = buildPool(cards, media, true);
          poolKey = key;
          seen = seenIndex(cards);
          done();
        });

        LC.util.each(list, function (item) {
          for (var page = 1; page <= PAGES; page++) {
            var handle = LC.sources['fetch'](item, page, function (json) {
              var results = (json && json.results) || [];
              for (var i = 0; i < results.length; i++) cards.push(results[i]);
              gate.tick();
            }, function () {
              gate.tick();
            }, alive(captured));
            if (handle) handles.push(handle);
          }
        });
      }

      /* ---------------------------------------------------------------- */
      /* Барабан и результат                                               */
      /* ---------------------------------------------------------------- */

      function paintFrame(card) {
        /* Task 39: размер — по ФАКТИЧЕСКОЙ ширине барабана, а не зашитым
           w342. Барабан — .lumen-roulette__reel шириной REEL_EM
           (src/30_css.js), то есть 210 физических пикселей на экране 1920 и
           420 на вдвое более плотном; размер выбирает LC.util.posterSize. */
        var url = imageUrl(card && card.poster_path, LC.util.posterSize(LC.util.emPx(REEL_EM)));
        var frame = reelBox.find('.lumen-roulette__frame');
        if (url) frame.css('background-image', 'url("' + url + '")');
        frame.addClass('is-step');
        /* Класс снимается на следующем шаге — своего таймера «щелчку»
           барабана не нужно. */
        reelBox.addClass('is-live');
      }

      function clearResult() {
        /* Task 34: гасит и предзагрузку фона прошлого результата — иначе
           при повторном «Крутить» (gen не меняется, bump() тут не зовут)
           долетевший onload того результата подставил бы его кадр поверх
           только что очищенного фона, пока крутится барабан. result тоже
           сбрасывается: пока крутится барабан, подтверждённого результата
           нет — это же не даёт this.start() при случайном stop()/start()
           посреди прокрутки (пользователь ушёл с экрана, пока крутится
           барабан) поднимать фон для карточки, которую resultBox уже не
           показывает (см. loadResultBg и this.start ниже). */
        cancelResultLoader();
        result = null;
        resultBgShown = false;
        resultBox.empty();
        resultBox.removeClass('is-live');
        try { bg.css('background-image', ''); } catch (e) { }
        hint.show();
      }

      function showEmpty() {
        resultBox.empty();
        resultBox.addClass('is-live');
        resultBox.append($('<div class="lumen-roulette__empty">' + esc(LC.lang('lumen_roulette_empty')) + '</div>'));
        hint.hide();
        recollect(spinBtn[0]);
      }

      function actionNode(key, handler) {
        var node = watchFocus($('<div class="lumen-roulette__btn selector">' + esc(LC.lang(key)) + '</div>'));
        node.on('hover:enter', handler);
        return node;
      }

      /* Task 34: предзагрузка фона результата — тот же приём, что у героя и
         бэкдропов (loadFrame в src/48_hero.js, src/50_backdrops.js): кадр
         ставится только ЗАГРУЖЕННЫМ (присвоение background-image сразу
         заставляет слабый ТВ декодировать w1280 уже на экране — заметный
         фриз), onload и onerror гасятся сами собой через локальный guard
         done — двойного срабатывания нет, а resultLoader освобождается сам,
         не дожидаясь следующего cancelResultLoader(). От чужого кадра
         защищают ДВЕ независимые вещи: cancelResultLoader() (см. bump/
         clearResult) снимает onload/onerror СИНХРОННО, до того как
         управление вернётся к сети — настоящий поздний ответ сети для
         отменённой загрузки просто не попадёт никуда; а gen/result ниже —
         вторая, отдельно работающая защита на случай вызова В ОБХОД
         cancelResultLoader (например, руками, как в тесте): clearResult()
         в начале spin() уже сбросила result в null (пока крутится барабан,
         подтверждённого результата нет), а card этого замыкания никогда не
         null — так что result !== card остаётся истиной все то время, пока
         барабан крутится, и не только после showResult() нового результата.
         Обе защиты проверены раздельно в test/roulette.test.mjs (тест
         «поздний onload…»).

         Таймаута на зависший запрос (как LOAD_TIMEOUT у героя/бэкдропов)
         здесь нет: без onload/onerror resultLoader держится до следующего
         clearResult()/bump() (следующее «Крутить», смена медиа или уход с
         экрана) — для одной карточки на весь экран это не копится, в
         отличие от героя, где кадр перезапрашивается на каждый фокус. */
      function loadResultBg(card) {
        /* Task 39: фон результата — .lumen-roulette__bg, он растянут на весь
           экран (src/30_css.js), поэтому размер тот же, что у кадра карточки
           и заставки: по физической ширине экрана. */
        var backdrop = imageUrl(card.backdrop_path, LC.util.frameSize(LC.util.screenPx()));
        if (!backdrop) return;
        var img = new Image();
        /* Task 39: декодирование вне главного потока (см. src/48_hero.js,
           loadFrame). */
        img.decoding = 'async';
        var captured = gen;
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          img.onload = null;
          img.onerror = null;
          if (resultLoader === img) resultLoader = null;
          if (!ok || gen !== captured || result !== card) return;
          try { bg.css('background-image', 'url("' + backdrop + '")'); } catch (e) { }
          resultBgShown = true;
        }
        img.onload = function () { finish(true); };
        img.onerror = function () { finish(false); };
        resultLoader = img;
        img.src = backdrop;
      }

      function showResult(card) {
        result = card;
        cancelResultLoader();
        resultBgShown = false;
        /* Task 34: фон снимается безусловно, до попытки поставить новый —
           страховка showResult() САМОЙ ЗА СЕБЯ, а не первая линия обороны.
           При единственном сегодняшнем пути сюда (из spin()) она уже
           избыточна: clearResult() в начале spin() и очистила фон, и
           сбросила result в null, а cancelResultLoader() успевает снять
           onload/onerror синхронно раньше, чем сеть вообще может ответить —
           см. loadResultBg выше и тесты test/roulette.test.mjs («поздний
           onload…», мутацией проверено: без этой строки все тесты файла
           остаются зелёными). Строка остаётся ради контракта самой функции
           — на случай будущего вызова showResult() в обход spin()/
           clearResult(), которого сейчас в коде нет. */
        try { bg.css('background-image', ''); } catch (e) { }
        loadResultBg(card);
        resultBox.empty();
        resultBox.addClass('is-live');
        resultBox.append($('<div class="lumen-roulette__rtitle">' + esc(cardTitle(card)) + '</div>'));
        resultBox.append($('<div class="lumen-roulette__rmeta">' + esc(cardMeta(card)) + '</div>'));
        var actions = $('<div class="lumen-roulette__actions"></div>');
        actions.append(actionNode('lumen_roulette_watch', function () { openCard(card); }));
        actions.append(actionNode('lumen_roulette_again', function () { spin(); }));
        actions.append(actionNode('lumen_roulette_book', function () { book(card); }));
        resultBox.append(actions);
        hint.hide();
        recollect(actions.find('.lumen-roulette__btn')[0]);
      }

      function openCard(card) {
        try {
          Lampa.Activity.push({
            url: '',
            component: 'full',
            id: card.id,
            method: cardMedia(card),
            card: card,
            source: 'tmdb'
          });
        } catch (e) {
          warn('roulette: open card failed', e);
        }
      }

      function book(card) {
        try {
          Lampa.Favorite.toggle('book', card);
          if (Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang('lumen_roulette_booked'));
        } catch (e) {
          warn('roulette: book failed', e);
        }
      }

      /* Прокрутка барабана по плану. Один таймер: следующий шаг ставится
         только из предыдущего, поэтому остановить ленту можно в любой
         момент (stopSpin) и висящих вызовов не остаётся. */
      function runReel(card, list) {
        reel = list;
        var plan = spinPlan(reel.length);
        var mode = 'full';
        try { mode = LC.motionMode(); } catch (e) { }
        if (mode !== 'full' || plan.length < 2) {
          /* Лёгкие анимации: барабан не крутим вовсе — на слабом ТВ полсотни
             смен картинки стоят дороже самой рулетки. */
          paintFrame(card);
          stopSpin();
          showResult(card);
          return;
        }
        var captured = gen;
        var step = 0;
        function next() {
          spinTimer = 0;
          if (gen !== captured) return;
          if (step >= plan.length) {
            stopSpin();
            showResult(card);
            return;
          }
          var item = plan[step++];
          paintFrame(reel[item.index]);
          spinTimer = setTimeout(next, item.delay);
        }
        next();
      }

      /* Детали выбранного — единственный собственный запрос рулетки, и он
         идёт только при включённом фильтре длительности. */
      function verify(card, tries, done) {
        if (!filters.short) { done(card); return; }
        var cached = runtimes[media + ':' + card.id];
        if (cached != null) {
          if (Number(cached) <= shortLimit(media)) { done(card); return; }
          retry(tries, done, card);
          return;
        }
        var captured = gen;
        try {
          detailsNet = Lampa.Api.sources.tmdb.get(
            media + '/' + card.id,
            { langs: 'ru,en' },
            function (details) {
              if (gen !== captured) return;
              detailsNet = null;
              var minutes = null;
              if (details) {
                if (normalizeMedia(media) === 'tv') {
                  var list = details.episode_run_time || [];
                  minutes = list.length ? Number(list[0]) || null : null;
                } else {
                  minutes = Number(details.runtime) || null;
                }
              }
              if (minutes != null) runtimes[media + ':' + card.id] = minutes;
              if (fitsShort(details, media)) { done(card); return; }
              retry(tries, done, card);
            },
            function () {
              if (gen !== captured) return;
              detailsNet = null;
              /* Детали не пришли — кандидат остаётся: отказывать из-за сети
                 нечестно, а рулетка обязана чем-то ответить. */
              done(card);
            },
            { life: 10080 }
          );
        } catch (e) {
          warn('roulette: details failed', e);
          done(card);
        }
      }

      /* Перевыбор после провала фильтра длительности. Исчерпали попытки —
         показываем последнего выбранного: пустой экран хуже длинного фильма. */
      function retry(tries, done, last) {
        if (tries + 1 >= PICK_TRIES) { done(last); return; }
        var list = filtered();
        var next = pick(list, Math.random);
        if (!next) { done(last); return; }
        verify(next, tries + 1, done);
      }

      function spin() {
        if (spinning) return;
        spinning = true;
        /* Task 34: прошлый результат и его фон снимаются здесь, до начала
           прокрутки барабана — единственный вызов clearResult() раньше был
           в setMedia (смена «Фильмы/Сериалы»), и всё время вращения ленты
           на экране висел кадр ПРОШЛОГО результата. */
        clearResult();
        try { spinBtn.addClass('is-busy'); } catch (e) { }
        var captured = gen;
        try { self.activity.loader(!pool.length); } catch (e) { }
        loadPool(function () {
          if (gen !== captured) return;
          try { self.activity.loader(false); } catch (e2) { }
          var list = filtered();
          var card = pick(list, Math.random);
          if (!card) {
            stopSpin();
            showEmpty();
            return;
          }
          verify(card, 0, function (final) {
            if (gen !== captured) return;
            var strip = [];
            var i;
            for (i = 0; i < REEL_SIZE - 1; i++) {
              var random = pick(list, Math.random);
              strip.push(random || final);
            }
            strip.push(final);
            runReel(final, strip);
          });
        });
      }

      /* ---------------------------------------------------------------- */
      /* Жизненный цикл                                                    */
      /* ---------------------------------------------------------------- */

      function build(m) {
        manifest = m;
        buildHead();
        buildChips();
        buildFilters();
        try { self.activity.loader(false); } catch (e) { }
        if (started) recollect(null);
      }

      this.create = function () {
        motionClass(root);
        root.append(bg);
        root.append(head);
        stage.append(reelBox);
        stage.append(spinBtn);
        stage.append(hint);
        stage.append(resultBox);
        root.append(stage);
        /* Барабан и кнопка «Крутить» — выше чипов: это главное на экране, и
           докручиваться до них через ленту подборок никто не должен (живая
           проверка 2026-09-17: при чипах сверху кнопка уезжала за кромку). */
        root.append(filtersRow);
        root.append(chipsRow);
        watchFocus(spinBtn);
        spinBtn.on('hover:enter', function () { spin(); });
        scroll.append(root);
        /* Task 32: без minus() контейнер прокрутки растягивается по
           содержимому (класс layer--wheight ставит именно он, app.min.js:
           32232, а высоту по нему считает Layer.update -> frameUpdate,
           app.min.js:31684-31695) — диапазон прокрутки нулевой, и чипы
           подборок под барабаном уходят за нижнюю кромку: фокус на них
           встаёт, а увидеть их нельзя. Подробный разбор — в
           HubComponent.create (src/46_hub.js). */
        scroll.minus();
        try { self.activity.loader(true); } catch (e) { }
        var captured = gen;
        LC.manifest.load(function (m) {
          if (gen !== captured) return;
          build(m);
        });
      };

      this.render = function (js) {
        return js ? scroll.render(true) : scroll.render();
      };

      this.start = function () {
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) { }
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        /* Task 34: возврат с просмотра — this.stop() уже прошёл, bump()
           погасил gen и недогруженную предзагрузку (resultLoader на этот
           момент всегда null). Если результат остался (result — не спин
           был прерван, см. clearResult), а фон под ним так и не успел
           показаться (resultBgShown всё ещё false) — поднимаем предзагрузку
           заново тем же loadResultBg. Если фон уже был показан, трогать
           нечего: комментарий у this.stop про «start() вернёт его вместе с
           выбором» держится и для фона тоже, а не только для resultBox. */
        if (result && !resultBgShown && !resultLoader) loadResultBg(result);
        motionClass(root);
        Lampa.Controller.add('content', {
          toggle: function () {
            Lampa.Controller.collectionSet(root[0]);
            Lampa.Controller.collectionFocus(focusTarget() || false, root[0]);
          },
          left: function () {
            if (!navMove('left')) Lampa.Controller.toggle('menu');
          },
          right: function () { navMove('right'); },
          up: function () {
            if (navMove('up')) return;
            Lampa.Controller.toggle('head');
          },
          down: function () { navMove('down'); },
          back: function () { Lampa.Activity.backward(); }
        });
        Lampa.Controller.toggle('content');
      };

      this.pause = function () { };

      /* Уход вглубь (открыли карточку результата): Lampa снимает слайд из
         DOM и зовёт stop(). Гасим запросы и барабан — дорисовывать ленту в
         снятый с экрана DOM нечего, а сеть в этот момент нужна карточке.
         Сам экран остаётся целым: start() вернёт его вместе с выбором. */
      this.stop = function () {
        started = false;
        bump();
      };

      this.destroy = function () {
        bump();
        pool = [];
        reel = [];
        result = null;
        lastFocus = null;
        try { scroll.destroy(); } catch (e) { }
        try { root.remove(); } catch (e2) { }
      };
    }

    /* ------------------------------------------------------------------ */
    /* Регистрация компонента и пункт меню                                 */
    /* ------------------------------------------------------------------ */

    var component_added = false;
    var menu_node = null;

    function open(media) {
      try {
        Lampa.Activity.push({
          url: '',
          title: LC.lang('lumen_roulette_title'),
          component: 'lumen_roulette',
          media: normalizeMedia(media),
          page: 1
        });
      } catch (e) {
        warn('roulette: open failed', e);
      }
    }

    function addComponent() {
      if (component_added) return;
      if (!window.Lampa || !Lampa.Component || typeof Lampa.Component.add !== 'function') return;
      Lampa.Component.add('lumen_roulette', RouletteComponent);
      component_added = true;
    }

    /* Пункт меню один: перед добавлением проверяется и своя ссылка, и DOM
       (другой экземпляр плагина мог добавить свой пункт до нас) — тот же
       порядок, что у пункта «Подборки» (src/46_hub.js). */
    function addMenu() {
      try {
        if (menu_node && menu_node.length && menu_node.closest('body').length) return;
        if ($('.lumen-menu-roulette').length) return;
        if (!Lampa.Menu || typeof Lampa.Menu.addButton !== 'function') return;
        var node = Lampa.Menu.addButton(LC.icons.get('star'), LC.lang('lumen_roulette_title'), function () {
          open('movie');
        });
        if (node && node.addClass) node.addClass('lumen-menu-roulette');
        menu_node = node;
      } catch (e) {
        warn('roulette: menu button failed', e);
      }
    }

    function install() {
      try {
        addComponent();
        addMenu();
      } catch (e) {
        warn('roulette: install failed', e);
      }
    }

    /* Плагин выключили: пункт меню снимаем. Зарегистрированный компонент
       остаётся в реестре Lampa (Component.add обратной операции не имеет),
       но попасть в него больше неоткуда. */
    function uninstall() {
      try {
        if (menu_node && menu_node.remove) menu_node.remove();
      } catch (e) {
        warn('roulette: menu remove failed', e);
      }
      menu_node = null;
      try { $('.lumen-menu-roulette').remove(); } catch (e2) { }
    }

    function menuNode() {
      return menu_node;
    }

    return {
      MAX_SOURCES: MAX_SOURCES,
      CHIP_LIMIT: CHIP_LIMIT,
      buildPool: buildPool,
      applyFilters: applyFilters,
      shortLimit: shortLimit,
      fitsShort: fitsShort,
      pick: pick,
      spinPlan: spinPlan,
      collectionsFor: collectionsFor,
      chipList: chipList,
      sourcesFor: sourcesFor,
      parseIds: parseIds,
      joinIds: joinIds,
      storageKey: storageKey,
      normalizeMedia: normalizeMedia,
      unseenDefault: unseenDefault,
      install: install,
      uninstall: uninstall,
      open: open,
      menuNode: menuNode
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.roulette;

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
  /* Task 44: у экрана два состояния. ДО РЕЗУЛЬТАТА он спокойный — шапка,  */
  /* одна горизонтальная лента чипов подборок (своя Lampa.Scroll), барабан */
  /* по центру, кнопка «Крутить» под ним и подсказка; фона нет вовсе.      */
  /* ПОСЛЕ РЕЗУЛЬТАТА экран переходит в режим кадра: прямоугольник         */
  /* барабана разворачивается в полноэкранный кадр выпавшего фильма        */
  /* (LC.transition.reveal), кадр остаётся фоном, спокойный экран гаснет,  */
  /* а карточка результата встаёт внизу слева под вуалью. «Ещё раз»        */
  /* возвращает спокойный экран (clearResult → leaveKadr) и крутит снова.  */
  /* Кадр предзагружается заранее — в spin(), пока крутится барабан.       */
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
    /* Правка 2026-09-23 (разбор композиции, п.5.1): пауза перед тем, как
       показать выборку в барабане. Это ТА ЖЕ мысль, что у задержки смены
       героя на главной (DELAY в src/48_hero.js): отмечая подборки, человек
       щёлкает чипы подряд, и запрашивать пул на каждое нажатие значит
       выбросить в сеть до десяти запросов на каждый промежуточный набор.
       700 мс — вдвое больше героевых 350: там ждала одна картинка, здесь —
       до пяти подборок по две страницы. Промежуточные наборы гасятся
       таймером, до сети доходит только тот, на котором человек остановился.
       Постеры выборки, о которых спрашивал разбор, в памяти НЕ лежат:
       манифест хранит у подборки только id, title, icon и источник, а
       карточки приходят из LC.sources. Зато этот же пул нужен «Крутить», и
       loadPool кеширует его по poolKey — то есть запрос не добавляется, а
       переезжает раньше, и вращение после него стартует уже без сети. */
    var PREVIEW_DELAY = 700;
    /* Постеров в стопке барабана: передний плюс два выглядывающих. Разбор
       просил «3–4»; четвёртый в коробку 2:3 уже не выглядывает — его край
       закрывает третий. */
    var STACK_SIZE = 3;
    /* Ширина барабана в долях ВЫСОТЫ экрана — то же число, что у
       .lumen-roulette__reel в src/30_css.js (width:28.67vh). По ней
       выбирается размер постера, который в барабане показан.
       Task 44: было 9.2em. Барабан переехал с em на vh, потому что em
       умножают две настройки разом («Размер интерфейса» Lampa и масштаб
       интерфейса плагина, вместе до ×1.26), и на крупных он переставал
       помещаться на экране; разбор арифметики — в комментарии к самому
       правилу. */
    var REEL_VH = 28.67;

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

    /* Task 72: лёгкий барабан — восемь смен картинки с нарастающей паузой,
       суммарно 2.2 с. Числа подобраны так, чтобы каждый следующий кадр
       держался дольше предыдущего: на слабом ТВ смена картинки сама по себе
       занимает часть кадра, и равномерное мигание читалось бы как рывки, а
       не как останавливающийся барабан. Последний шаг — полсекунды: на нём
       уже виден результат. */
    var LITE_DELAYS = [120, 140, 170, 210, 260, 330, 420, 550];

    /* План барабана: разгон (шаги редеют), вращение, торможение (шаги
       растягиваются). Индексы идут по ленте по кругу, последний шаг —
       её последняя позиция, где лежит выбранный фильм. Общая длительность
       около 3100 мс: короче — не успеваешь понять, что это барабан, длиннее
       — уже ожидание.

       Task 72: режим движения решает, какой барабан. 'off' — плана нет
       вовсе (это единственный режим, где показ обязан быть мгновенным);
       'lite' — восемь шагов по LITE_DELAYS; всё остальное, включая вызов
       без режима, — полный барабан, как было.

       Почему в 'lite' барабан вернулся: до Task 72 его там не было вовсе, и
       отзыв пользователя 2026-09-21 («рулетка не выглядит как рулетка»)
       пришёл именно из «Лёгких» — режим он выбрал сам, и это его основной
       режим. Прежний довод в этом месте — «на слабом ТВ полсотни смен
       стоят дороже рулетки» — верен ровно для полного барабана: там 50
       шагов подряд, половина из них через 40 мс. Восемь смен за 2.2 с —
       другая величина: рулетку крутят раз в сеанс по нажатию, а не на
       каждом шаге фокуса, и между шагами здесь не 40 мс, а 120 и больше.
       Крупнее w342 кадр барабана при этом не запрашивается ни в одном
       режиме — размер считает paintFrame по ширине самого барабана. */
    /* Посадка барабана на выбранный фильм: последний шаг обязан показать
       последнюю позицию ленты. Индексы СДВИГАЮТСЯ все разом на одну и ту
       же величину, а не правится один последний.
       Ревью 2026-09-22 (М4): правка последнего индекса вырождала короткую
       ленту. spinPlan(2,'lite') давал шаги 1 и 0, после правки — 1 и 1:
       оба кадра одинаковые, результат виден с первого же, и 970 мс
       барабан стоит на нём впустую. На проде лента короче трёх
       недостижима (REEL_SIZE = 10), но и в длинной правка рвала ход: у
       'lite' с десятью позициями шаги шли 1..8, а последний прыгал на 9.
       Сдвиг сохраняет и то и другое — ход по кругу без разрывов и разные
       соседние кадры при любом n > 1. */
    function land(plan, n) {
      if (!plan.length) return plan;
      var shift = (n - 1 - plan[plan.length - 1].index % n + n) % n;
      if (shift) {
        for (var i = 0; i < plan.length; i++) plan[i].index = (plan[i].index + shift) % n;
      }
      return plan;
    }

    function spinPlan(total, mode) {
      var plan = [];
      var n = Number(total) || 0;
      if (mode === 'off') return plan;
      if (n <= 0) return plan;
      if (n === 1) return [{ index: 0, delay: 0 }];

      var index = 0;
      var i;
      if (mode === 'lite') {
        /* Лента короче восьми — шагов столько, сколько позиций: больше
           показывать нечего, картинки пошли бы по второму кругу. Берётся
           ХВОСТ таблицы, чтобы барабан и тогда заканчивался самым медленным
           шагом. */
        var delays = n < LITE_DELAYS.length ? LITE_DELAYS.slice(LITE_DELAYS.length - n) : LITE_DELAYS;
        for (i = 0; i < delays.length; i++) {
          index = (index + 1) % n;
          plan.push({ index: index, delay: delays[i] });
        }
        return land(plan, n);
      }

      var FAST = 40;
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
      /* Последний кадр — выбранный фильм. Индексы двигаем, а не досыпаем
         шаг: сумма длительностей уже набрана (см. land выше). */
      return land(plan, n);
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
      /* Task 44: лента чипов подборок — ОДНА строка с собственной
         горизонтальной прокруткой. Штатный Scroll Lampa двигает её своим
         transform (app.min.js:32003) и обрезает лишнее классом scroll--over,
         поэтому ни обрезка, ни инерция тут не наши. nopadding — потому что
         поля ленты задаёт корень рулетки, а штатные 1.5em
         (.scroll--horizontal .scroll__content, app.css:2795-2797) добавили бы
         к ним вторые. */
      var chipsScroll = new Lampa.Scroll({ horizontal: true, over: true, nopadding: true, step: 250 });
      /* Обёртка вокруг всей активности: кадр результата обязан лечь на весь
         экран, а корень рулетки лежит внутри прокрутки и начинается ниже
         шапки Lampa — дотянуться до верхней кромки оттуда нечем. Разбор — в
         комментарии блока .lumen-roulette-screen (src/30_css.js). */
      var screen = $('<div class="lumen-roulette-screen"></div>');
      var root = $('<div class="lumen-roulette"></div>');
      var bg = $('<div class="lumen-roulette__bg"></div>');
      var veilL = $('<div class="lumen-roulette__veil lumen-roulette__veil--l"></div>');
      var veilB = $('<div class="lumen-roulette__veil lumen-roulette__veil--b"></div>');
      var head = $('<div class="lumen-roulette__head"></div>');
      var chipsBox = $('<div class="lumen-roulette__chipbox"></div>');
      var chipsRow = $('<div class="lumen-roulette__chips"></div>');
      var filtersRow = $('<div class="lumen-roulette__filters"></div>');
      var stage = $('<div class="lumen-roulette__stage"></div>');
      var reelBox = $('<div class="lumen-roulette__reel"><div class="lumen-roulette__frame"></div></div>');
      /* Задние постеры стопки и счётчик выборки (правка 2026-09-23, п.5.1).
         Оба узла заводятся всегда, показывает их класс is-stack на сцене —
         так в разметке не появляется и не исчезает ничего, что пришлось бы
         пересобирать при каждой смене подборок. */
      var peek1 = $('<div class="lumen-roulette__peek lumen-roulette__peek--1"></div>');
      var peek2 = $('<div class="lumen-roulette__peek lumen-roulette__peek--2"></div>');
      var countBox = $('<div class="lumen-roulette__count">' +
        '<div class="lumen-roulette__count-value"></div>' +
        '<div class="lumen-roulette__count-label"></div>' +
        '</div>');
      var spinBtn = $('<div class="lumen-roulette__spin selector">' + esc(LC.lang('lumen_roulette_spin')) + '</div>');
      var resultBox = $('<div class="lumen-roulette__result"></div>');

      var gen = 0;
      var handles = [];
      var detailsNet = null;
      var spinTimer = 0;
      var previewTimer = 0;
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
      /* Task 44: кадр выпавшего фильма — адрес и состояние предзагрузки
         {card, url, ready}. Заводится в spin(), когда карточка уже выбрана,
         а барабан ещё крутится (spinPlan даёт около 3100 мс в полном режиме
         и 2200 в «Лёгких», Task 72): к его остановке w1280 обычно уже в
         кэше браузера, и переход «барабан → кадр» стартует, не дожидаясь
         сети. */
      var frame = null;
      /* Экран в режиме кадра: спокойный экран погашен, карточка результата
         стоит внизу слева, обход фокуса сведён к её кнопкам. */
      var kadr = false;
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
         прокруткой и при смене «Фильмы/Сериалы»), из bump() — на случай
         stop()/destroy(), где clearResult() не вызывается, — и из
         prepareFrame(), которая заводит следующую предзагрузку. */
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
        /* Правка 2026-09-23: отложенный показ выборки — такой же
           отменяемый хвост, как запросы и таймер барабана. */
        clearPreviewTimer();
      }

      /* Task 44: в режиме кадра обход фокуса сведён к карточке результата.
         Спокойный экран под кадром погашен прозрачностью, но место в потоке
         он сохраняет, а Navigator ходит по прямоугольникам узлов .selector и
         на прозрачность не смотрит — без сужения области стрелка вверх
         уводила бы фокус на невидимый чип подборки. Сужается именно область
         коллекции, а не класс selector у каждого узла: класс пришлось бы
         снимать и возвращать у узлов, которые перестраиваются сами
         (buildChips), и рассинхрон был бы вопросом времени. */
      function scope() {
        return (kadr ? resultBox[0] : root[0]) || null;
      }

      function focusTarget() {
        var box = scope();
        if (lastFocus && box && box.contains && box.contains(lastFocus)) return lastFocus;
        if (kadr) return resultBox.find('.lumen-roulette__btn')[0] || null;
        return spinBtn[0] || null;
      }

      function recollect(prefer) {
        try {
          var box = scope();
          Lampa.Controller.collectionSet(box);
          Lampa.Controller.collectionFocus(prefer || focusTarget() || false, box);
        } catch (e) {
          warn('roulette: collection failed', e);
        }
      }

      /* Task 32: экран едет за фокусом — вторая половина штатного контракта
         Lampa (эталон: app.min.js:53107, card.onFocus -> scroll.update).
         tocenter = true: getElementPosition (app.min.js:32047) и с
         центрированием берёт Math.min(0, ...), поэтому всё, что умещается в
         верхнюю половину области, встаёт в начало списка. Узел передаём как
         есть: scroll.update принимает и jQuery, и DOM (app.min.js:32049).
         Task 44: спокойный экран теперь помещается целиком (барабан считан
         от высоты экрана, см. REEL_VH), так что прокручивать обычно нечего —
         вызов остаётся ради крупных настроек кегля, где содержимое всё же
         перерастает область. */
      function keepVisible(el) {
        try { scroll.update(el, true); } catch (e) { warn('roulette: scroll.update failed', e); }
      }

      /* Через watchFocus проходят все .selector рулетки, поэтому подкрутка
         к фокусу ставится здесь одной строкой. */
      /* Task 68: подписка — общий LC.focus.on (src/11_focus.js): пульт шлёт
         'hover:focus', мышь — 'hover:hover' (vendor/lampa/app.min.js:46360-
         46364), а подкрутка к фокусу нужна в обоих режимах одинаково. */
      function watchFocus(node) {
        return LC.focus.on(node, function () {
          keepVisible(node[0]);
          lastFocus = node[0];
        });
      }

      /* Task 44: чип подборки живёт в собственной горизонтальной прокрутке,
         и подвести к нему надо ещё и её — иначе фокус уходит за обрезанную
         кромку ленты и чип на экране не появляется вовсе. Отдельным
         обработчиком, а не внутри watchFocus: через него проходят и чипы
         фильтров, и кнопки, а они в ленте не лежат. */
      function railChip(node) {
        return LC.focus.on(node, function () {
          try { chipsScroll.update(node[0], true); } catch (e) { warn('roulette: chips scroll failed', e); }
        });
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
        /* Task 44: сегмент фильтров — в той же строке, прижатый вправо
           (margin-left:auto, src/30_css.js). Отдельной строкой он отбирал у
           барабана 2.98em высоты, а барабан на экране 540 px и без того
           помещается впритык. Узел кладётся сюда, а наполняет его
           buildFilters — её зовут и без перестройки шапки (смена медиа). */
        head.append(filtersRow);
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
        clearPreview();
        schedulePreview();
        recollect(focusNode || null);
      }

      function chipNode(text, on) {
        var node = watchFocus($('<div class="lumen-chip lumen-roulette__chip selector">' + esc(text) + '</div>'));
        if (on) node.addClass('lumen-chip--on');
        return node;
      }

      function buildChips() {
        chipsRow.empty();
        /* Ревью Task 44 (п.7): набор чипов меняется — лента обязана вернуться
           в начало. Сдвиг остаётся на .scroll__body от прошлого набора, а он
           мог быть длиннее: после смены «Фильмы/Сериалы» слева осталась бы
           пустота до первого касания чипа (смена медиа возвращает фокус на
           таб, значит railChip не сработает). */
        try { chipsScroll.reset(); } catch (eR) { warn('roulette: chips reset failed', eR); }
        collections = collectionsFor(manifest, media);
        var all = chipNode(LC.lang('lumen_roulette_all'), !chosen.length);
        all.on('hover:enter', function () {
          if (!chosen.length) return;
          chosen = [];
          saveIds(media, chosen);
          poolKey = '';
          buildChips();
          schedulePreview();
          recollect(chipsRow.find('.lumen-roulette__chip')[0]);
        });
        chipsRow.append(railChip(all));
        var shown = chipList(collections, chosen, CHIP_LIMIT);
        for (var i = 0; i < shown.length; i++) {
          (function (item) {
            var node = railChip(chipNode(titleOf(item), chosen.indexOf(item.id) >= 0));
            node.on('hover:enter', function () {
              var at = chosen.indexOf(item.id);
              if (at >= 0) chosen.splice(at, 1);
              else chosen.push(item.id);
              saveIds(media, chosen);
              poolKey = '';
              node.toggleClass('lumen-chip--on', at < 0);
              chipsRow.find('.lumen-roulette__chip').eq(0).toggleClass('lumen-chip--on', !chosen.length);
              schedulePreview();
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
          schedulePreview();
        });
        filtersRow.append(unseen);
        var shortKey = media === 'tv' ? 'lumen_roulette_short_tv' : 'lumen_roulette_short_movie';
        var short = chipNode(LC.lang(shortKey), filters.short);
        short.on('hover:enter', function () {
          filters.short = !filters.short;
          short.toggleClass('lumen-chip--on', filters.short);
          schedulePreview();
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
      /* Выборка в барабане до вращения (правка 2026-09-23, п.5.1)          */
      /* ---------------------------------------------------------------- */

      function clearPreviewTimer() {
        if (previewTimer) {
          clearTimeout(previewTimer);
          previewTimer = 0;
        }
      }

      /* Снять стопку и счётчик: барабан возвращается к пустой коробке. */
      function clearPreview() {
        clearPreviewTimer();
        try {
          stage.removeClass('is-stack');
          peek1.addClass('is-off');
          peek2.addClass('is-off');
        } catch (e) {
          warn('roulette: preview clear failed', e);
        }
      }

      /* Один постер стопки. Размер — по фактической ширине барабана, тем же
         путём, что paintFrame: оба слоя показывают одну и ту же коробку. */
      function paintPeek(node, card) {
        var url = card ? imageUrl(card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))) : '';
        if (!url) {
          node.addClass('is-off');
          return;
        }
        node.css('background-image', 'url("' + url + '")');
        node.removeClass('is-off');
      }

      /* Показать выборку: передний постер в самом барабане, два задних — по
         сторонам, число под ними. Пустая выборка тоже показывается — нулём:
         «0 в выборке» отвечает на вопрос «почему не крутится» лучше, чем
         пустая коробка. */
      function paintPreview() {
        var list = filtered();
        try {
          countBox.find('.lumen-roulette__count-value').text(String(list.length));
          countBox.find('.lumen-roulette__count-label').text(LC.lang('lumen_roulette_pick'));
          var head0 = list[0] || null;
          var url = head0 ? imageUrl(head0.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))) : '';
          var frameNode = reelBox.find('.lumen-roulette__frame');
          if (url) frameNode.css('background-image', 'url("' + url + '")');
          else frameNode.css('background-image', 'none');
          paintPeek(peek1, list[1] || null);
          paintPeek(peek2, list[2] || null);
          stage.addClass('is-stack');
        } catch (e) {
          warn('roulette: preview paint failed', e);
        }
      }

      /* Отложенный показ выборки. Зовётся отовсюду, где выборка меняется:
         из build (первый заход), смены «Фильмы/Сериалы», чипов подборок,
         фильтров и возврата с карточки результата. Фильтры сети не просят
         вовсе — loadPool отдаёт уже собранный пул по кешу, и отклик там
         мгновенный. Во время вращения превью не поднимается: барабан занят,
         и подменять его кадры нечем. */
      function schedulePreview() {
        clearPreviewTimer();
        if (spinning || kadr) return;
        var captured = gen;
        previewTimer = setTimeout(function () {
          previewTimer = 0;
          if (gen !== captured || spinning || kadr) return;
          loadPool(function () {
            if (gen !== captured || spinning || kadr) return;
            paintPreview();
          });
        }, PREVIEW_DELAY);
      }

      /* ---------------------------------------------------------------- */
      /* Барабан и результат                                               */
      /* ---------------------------------------------------------------- */

      function paintFrame(card) {
        /* Task 39/44: размер — по ФАКТИЧЕСКОЙ ширине барабана, а не зашитым
           w342. Барабан — .lumen-roulette__reel шириной REEL_VH процентов
           высоты экрана (src/30_css.js), то есть 310 физических пикселей и
           на 1920×1080 при DPR 1, и на 960×540 при DPR 2 (оба множителя
           учитывает LC.util.vhPx); размер выбирает LC.util.posterSize. */
        var url = imageUrl(card && card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH)));
        var frameNode = reelBox.find('.lumen-roulette__frame');
        if (url) frameNode.css('background-image', 'url("' + url + '")');
        frameNode.addClass('is-step');
        /* Класс снимается на следующем шаге — своего таймера «щелчку»
           барабана не нужно. */
        reelBox.addClass('is-live');
      }

      /* Task 44: адрес кадра результата. Потолок w1280 (scrimSize), а не
         frameSize: на 1080p frameSize уходит в original, а это у TMDB
         обычно 3840×2160 — 31.6 МБ распакованного растра против 3.7 у
         w1280. Кадр висит на экране до «Ещё раз», то есть дольше любого
         другого полноэкранного слоя плагина, и платить за него памятью
         столько нельзя (бэклог с телевизора, п. Б1). */
      function frameUrl(card) {
        return imageUrl(card && card.backdrop_path, LC.util.scrimSize(LC.util.screenPx()));
      }

      /* Нарисована ли карточка результата. Ревью Task 44 (п.2): режим кадра
         без неё — это экран, на котором нет ни одного узла в обходе фокуса
         (scope() сужается до пустого resultBox), и выйти с него можно только
         «назад». Поэтому кадр и режим кадра разведены: фон ставится всегда,
         режим — только когда карточке есть что показать. */
      function resultShown() {
        return resultBox.hasClass('is-live');
      }

      /* Ставит кадр фоном и, если карточка результата уже нарисована,
         переводит экран в режим кадра. Зовут её из двух мест: из колбэка
         перехода (кадр уже накрыл экран удержанным слоем) и из
         предзагрузки, если та ответила ПОЗЖЕ показа результата, — во втором
         случае перехода уже не будет, момент для него прошёл.

         Ревью Task 44 (п.2): бывает и третий заход — this.start() поднимает
         предзагрузку заново после ухода с экрана. Удержанный слой в этот
         момент мог быть снят снаружи (src/90_runtime.js:480-484: старт любой
         не-full активности зовёт LC.transition.stop()), и тогда колбэк,
         который рисует карточку, не придёт уже никогда: call() внутри
         reveal сверяет state !== live. Экран оставался бы с полноэкранным
         кадром и пустой карточкой. Карточку в этом случае дорисовывает сам
         this.start(); проверка resultShown() — вторая страховка. */
      function showKadr(url) {
        try { bg.css('background-image', 'url("' + url + '")'); } catch (e) { }
        resultBgShown = true;
        if (resultShown()) enterKadr();
      }

      function enterKadr() {
        if (kadr) return;
        kadr = true;
        /* Экран в режиме кадра не листается, а карточка результата стоит
           абсолютом от нижней кромки корня — прокрутка, оставшаяся с
           спокойного экрана, увела бы её вниз вместе с ним. */
        try { scroll.reset(); } catch (e) { }
        screen.addClass('is-kadr');
        /* Ревью Task 44 (п.1): сужение области обхода (scope) применяется
           только в момент recollect(), поэтому смены флага мало. На пути
           «кадр долетел ПОЗЖЕ результата» карточка собрала коллекцию ещё
           при kadr === false, то есть со всем спокойным экраном внутри, и
           переустановить её больше некому. Путь этот не краевой: кадр
           результата — w1280, и к остановке барабана он успевает не всегда.
           Task 72: в «Лёгких» барабан крутится 2.2 с против 3.1 в полном
           режиме, то есть времени у сети там ещё меньше.
           На обычном пути коллекция ставится дважды подряд — сперва из
           paintResult, потом отсюда. Это осознанно: развилка «звать или не
           звать» обошлась бы дороже одного лишнего collectionSet на нажатие
           пульта. */
        recollect(null);
      }

      function leaveKadr() {
        kadr = false;
        screen.removeClass('is-kadr');
        /* Удержанный слой перехода снимает только stop() (src/67_transition.js).
           Здесь он в норме уже снят — его снимает сам колбэк, отдав кадр
           фону, — но «Ещё раз» обязано работать и когда до колбэка дело не
           дошло: пользователь успел нажать, пока слой ещё разгонялся. */
        try { if (LC.transition && LC.transition.stop) LC.transition.stop(); } catch (e) { }
      }

      /* Task 44: предзагрузка кадра. Приём тот же, что у героя и бэкдропов
         (loadFrame в src/48_hero.js, src/50_backdrops.js): кадр ставится
         только ЗАГРУЖЕННЫМ — присвоение background-image сразу заставляет
         слабый ТВ декодировать w1280 уже на экране (заметный фриз), а
         переход «барабан → кадр» на недогруженной картинке показал бы пустой
         прямоугольник. onload и onerror гасятся сами собой через локальный
         guard done — двойного срабатывания нет, а resultLoader освобождается
         сам, не дожидаясь следующего cancelResultLoader().

         От чужого кадра защищают ДВЕ независимые вещи: cancelResultLoader()
         (см. bump/clearResult) снимает onload/onerror СИНХРОННО, до того как
         управление вернётся к сети — настоящий поздний ответ для отменённой
         загрузки просто не попадёт никуда; а сверка frame !== live ниже —
         вторая, отдельно работающая защита на случай вызова В ОБХОД
         cancelResultLoader (например, руками, как в тесте): clearResult() в
         начале spin() уже завела новый frame (или сбросила его в null),
         поэтому ссылка замыкания перестаёт быть текущей сразу, а не только
         после показа нового результата.

         Таймаута на зависший запрос (как LOAD_TIMEOUT у героя/бэкдропов)
         здесь нет: без onload/onerror resultLoader держится до следующего
         clearResult()/bump() (следующее «Крутить», смена медиа или уход с
         экрана) — для одной карточки на весь экран это не копится, в
         отличие от героя, где кадр перезапрашивается на каждый фокус. */
      function prepareFrame(card) {
        cancelResultLoader();
        frame = { card: card, url: frameUrl(card), ready: false };
        if (!frame.url) return;
        var live = frame;
        var captured = gen;
        var img = new Image();
        /* Task 39: декодирование вне главного потока (см. src/48_hero.js,
           loadFrame). */
        img.decoding = 'async';
        var done = false;
        function finish(ok) {
          if (done) return;
          done = true;
          img.onload = null;
          img.onerror = null;
          if (resultLoader === img) resultLoader = null;
          if (!ok || gen !== captured || frame !== live) return;
          live.ready = true;
          /* Кадр долетел уже после того, как результат показан без него
             (медленная сеть, барабан кончился раньше) — ставим фоном сразу,
             без перехода. */
          if (result === live.card) showKadr(live.url);
        }
        img.onload = function () { finish(true); };
        img.onerror = function () { finish(false); };
        resultLoader = img;
        img.src = frame.url;
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
           показывает (см. prepareFrame и this.start ниже). */
        cancelResultLoader();
        frame = null;
        result = null;
        resultBgShown = false;
        resultBox.empty();
        resultBox.removeClass('is-live');
        leaveKadr();
        try { bg.css('background-image', ''); } catch (e) { }
        /* «Ещё раз» и возврат с карточки результата возвращают спокойный
           экран — значит и выборку в барабане. Пул к этому моменту уже
           собран, loadPool отдаст его по кешу без сети. */
        schedulePreview();
      }

      /* Под фильтры ничего не подошло. В режим кадра экран при этом НЕ
         переводится: менять чипы придётся на спокойном экране, и прятать его
         тут нечего. */
      function showEmpty() {
        resultBox.empty();
        resultBox.addClass('is-live');
        resultBox.append($('<div class="lumen-roulette__empty">' + esc(LC.lang('lumen_roulette_empty')) + '</div>'));
        recollect(spinBtn[0]);
      }

      function actionNode(key, handler) {
        var node = watchFocus($('<div class="lumen-roulette__btn selector">' + esc(LC.lang(key)) + '</div>'));
        node.on('hover:enter', handler);
        return node;
      }

      /* Прямоугольник барабана в координатах окна — источник перехода.
         Снимается ровно один раз, на показ результата: getBoundingClientRect
         заставляет браузер посчитать раскладку немедленно, и на шагах
         барабана такому замеру делать нечего. Узла может не быть в
         документе вовсе (ушли с экрана) — тогда null, и перехода не будет. */
      function reelRect() {
        try {
          var node = reelBox[0];
          if (!node || typeof node.getBoundingClientRect !== 'function') return null;
          var r = node.getBoundingClientRect();
          if (!r || !(r.width > 0) || !(r.height > 0)) return null;
          return { left: r.left, top: r.top, width: r.width, height: r.height };
        } catch (e) {
          return null;
        }
      }

      /* Содержимое карточки результата. Отдельно от showResult, потому что
         зовут её из двух мест: сразу (перехода нет или он не начался) и из
         колбэка перехода, когда слой уже накрыл экран. */
      function paintResult(card) {
        resultBox.empty();
        resultBox.addClass('is-live');
        resultBox.append($('<div class="lumen-roulette__rtitle">' + esc(cardTitle(card)) + '</div>'));
        resultBox.append($('<div class="lumen-roulette__rmeta">' + esc(cardMeta(card)) + '</div>'));
        var actions = $('<div class="lumen-roulette__actions"></div>');
        actions.append(actionNode('lumen_roulette_watch', function () { openCard(card); }));
        actions.append(actionNode('lumen_roulette_again', function () { spin(); }));
        actions.append(actionNode('lumen_roulette_book', function () { book(card); }));
        resultBox.append(actions);
        recollect(actions.find('.lumen-roulette__btn')[0]);
      }

      /* Task 44: результат открывается КАДРОМ. Прямоугольник барабана
         разворачивается в полноэкранный кадр выпавшего фильма тем же слоем,
         которым открывается карточка из ряда (LC.transition.reveal), и слой
         держится, пока мы не отдадим кадр фону под ним.

         Почему слой снимается прямо в колбэке, а не живёт до «Ещё раз», как
         предполагал план: карточка результата лежит внутри прокрутки Lampa,
         у .scroll__body стоит will-change:transform (app.css:2762-2769) —
         это собственный контекст наложения, и ни один z-index изнутри не
         поднимется выше слоя в <body> (у него z-index 90). Показать карточку
         ПОВЕРХ удержанного слоя нельзя в принципе. Поэтому кадр передаётся
         фону экрана (та же картинка, уже в кэше браузера), карточка рисуется
         под ним, и слой снимается — всё тремя вызовами в одном кадре
         отрисовки, так что на экране ничего не меняется.

         Перехода нет (кадр не успел загрузиться, «Движение: выкл», барабана
         нет на экране) — результат просто рисуется сразу. */
      function showResult(card) {
        var captured = gen;
        result = card;
        var live = frame && frame.card === card && frame.ready ? frame : null;
        var rect = live ? reelRect() : null;
        if (live) {
          /* Имя не started: компонентный started (жив ли экран) объявлен
             выше и читается build()/this.start()/this.stop() — тень над ним
             была бы миной для следующей правки (ревью Task 44, п.8). */
          var revealed = false;
          try {
            revealed = !!(rect && LC.transition && typeof LC.transition.reveal === 'function' && LC.transition.reveal({
              rect: rect,
              poster: imageUrl(card.poster_path, LC.util.posterSize(LC.util.vhPx(REEL_VH))),
              big: live.url
            }, {
              /* Карточка рисуется ДО кадра, а не после: режим кадра теперь
                 включается только при нарисованной карточке (см. showKadr).
                 Оба вызова синхронны и идут в одном кадре отрисовки, так
                 что порядок виден только коду. */
              then: function () {
                if (gen !== captured || result !== card) return;
                paintResult(card);
                showKadr(live.url);
                try { LC.transition.stop(); } catch (eStop) { }
              }
            }));
          } catch (e) {
            warn('roulette: reveal failed', e);
          }
          if (revealed) return;
        }
        paintResult(card);
        if (live) showKadr(live.url);
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
        var mode = 'full';
        try { mode = LC.motionMode(); } catch (e) { }
        var plan = spinPlan(reel.length, mode);
        if (plan.length < 2) {
          /* Крутить нечем: либо анимации выключены совсем ('off'), либо в
             ленте один кандидат. Показываем результат сразу. */
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
        /* Ревью Task 44 (п.6): «Ещё раз» нажимают С КНОПКИ карточки
           результата, а clearResult() только что опустошил resultBox вместе
           с ней — коллекция Lampa указывала бы на пустой узел, а
           Navigator.focused на снятый с DOM элемент, и все три секунды
           барабана «вправо», «вниз» и OK были бы мертвы. Возвращаем обход на
           спокойный экран сразу, а фокус — на «Крутить». */
        recollect(spinBtn[0]);
        /* Барабан занят — стопка и счётчик уходят: их место занимают кадры
           вращения (правка 2026-09-23, п.5.1). */
        clearPreview();
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
            /* Task 44: кадр запрашивается ЗДЕСЬ, а не в showResult — фильм
               уже выбран, а барабан ещё не начал крутиться и подарит сети
               время спина (spinPlan: 3.1 с в полном режиме, 2.2 в «Лёгких»
               после Task 72). К его остановке w1280 обычно в кэше, и
               переход «барабан → кадр» стартует без паузы. */
            prepareFrame(final);
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
        /* Правка 2026-09-23 (п.5.1): выборка показывается сразу при заходе,
           а не только после первого касания чипа — иначе центр экрана до
           первого действия по-прежнему пустая коробка. */
        schedulePreview();
        if (started) recollect(null);
      }

      this.create = function () {
        motionClass(root);
        /* Task 44: порядок сверху вниз — шапка (заголовок, медиа, фильтры),
           лента подборок, сцена с барабаном. Барабан стоит ПОД лентой, а не
           над ней, как было до Task 44: спокойный экран помещается целиком
           (см. REEL_VH), докручиваться до кнопки больше не нужно, а лента
           над барабаном читается как «чем крутим» перед «крутить». */
        root.append(head);
        chipsScroll.append(chipsRow);
        chipsBox.append(chipsScroll.render());
        root.append(chipsBox);
        /* Задние постеры стопки идут в разметке ПЕРЕД барабаном: они лежат
           под ним, и порядок документа — вторая половина решения вместе с
           z-index самого барабана (правка 2026-09-23, п.5.1). */
        stage.append(peek2);
        stage.append(peek1);
        stage.append(reelBox);
        stage.append(countBox);
        stage.append(spinBtn);
        /* Правка 2026-09-23 (разбор композиции, п.5.3): подсказки «Отметьте
           подборки и нажмите «Крутить»» под кнопкой больше нет — разбор и
           обоснование у бывшего правила .lumen-roulette__hint в
           src/30_css.js. */
        root.append(stage);
        /* Карточка результата — ребёнок корня, а не сцены: в режиме кадра она
           встаёт абсолютом от его нижней кромки (src/30_css.js). */
        root.append(resultBox);
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
        /* Кадр и вуали — вне прокрутки, прямыми детьми обёртки: у
           .scroll__body Lampa стоит will-change:transform (app.css:2762-2769),
           то есть он создаёт свой контекст наложения, и всё, что лежит
           внутри прокрутки, начинается ниже шапки Lampa. Разметка идёт в том
           же порядке, в каком рисуется: кадр, вуали, содержимое. */
        screen.append(bg);
        screen.append(veilL);
        screen.append(veilB);
        screen.append(scroll.render());
        try { self.activity.loader(true); } catch (e) { }
        var captured = gen;
        LC.manifest.load(function (m) {
          if (gen !== captured) return;
          build(m);
        });
      };

      this.render = function (js) {
        return js ? screen[0] : screen;
      };

      this.start = function () {
        var act = null;
        try { act = Lampa.Activity.active(); } catch (eAct) { }
        if (act && act.activity && act.activity !== this.activity) return;
        started = true;
        /* Task 34: возврат с просмотра — this.stop() уже прошёл, bump()
           погасил gen и недогруженную предзагрузку (resultLoader на этот
           момент всегда null). Если результат остался (result — не спин
           был прерван, см. clearResult), а кадр под ним так и не успел
           показаться (resultBgShown всё ещё false) — поднимаем предзагрузку
           заново тем же prepareFrame. Если кадр уже был показан, трогать
           нечего: комментарий у this.stop про «start() вернёт его вместе с
           выбором» держится и для кадра тоже, а не только для resultBox.
           Task 44: перехода при этом не будет — он показывает выпадение
           фильма, а тут пользователь возвращается к уже выпавшему; кадр
           просто встаёт фоном, как только долетит (см. prepareFrame).

           Ревью Task 44 (п.2): результат мог остаться НЕнарисованным. Слой
           перехода держится до своего колбэка, а снаружи его снимает старт
           любой не-full активности (src/90_runtime.js:480-484) — ушли в
           левое меню в те 960 мс, что слой разгоняется, и колбэк не придёт
           уже никогда (call() внутри reveal сверяет state !== live). result
           при этом выставлен с самого начала showResult. Дорисовываем
           карточку здесь: иначе экран вернулся бы с выбранным фильмом,
           которого не видно. */
        if (result && !resultShown()) paintResult(result);
        if (result && !resultBgShown && !resultLoader) prepareFrame(result);
        motionClass(root);
        Lampa.Controller.add('content', {
          toggle: function () {
            var box = scope();
            Lampa.Controller.collectionSet(box);
            Lampa.Controller.collectionFocus(focusTarget() || false, box);
          },
          left: function () {
            if (!navMove('left')) Lampa.Controller.toggle('menu');
          },
          right: function () { navMove('right'); },
          up: function () {
            if (navMove('up')) return;
            Lampa.Controller.toggle('head');
          },
          /* Правка 2026-09-23 (разбор композиции, п.5.2): вниз с ленты
             подборок фокус не уходил НИКУДА. Замер на стенде 960×540@2:
             стоя на любом чипе подборки, Navigator.canmove('down') отвечает
             false — «Крутить» лежит ниже барабана, между ними 300 px
             пустоты, и по геометрии соседом кнопка не считается. Экран
             из-за этого читался как тупик: подборки отметил, а до
             единственного действия экрана добраться нечем, кроме «назад».
             Дефект жил здесь до перестановки фильтров (проверено на том же
             стенде со старым правым положением фильтров) — то есть это не
             её следствие, но чинится он в том же пункте: правка раскладки
             обязана отвечать, куда уходит фокус.
             Кнопка — единственный разумный адрес: ниже неё на экране
             только подсказка, и та не фокусируемая. */
          down: function () {
            if (navMove('down')) return;
            if (kadr || !spinBtn.length || spinBtn.hasClass('focus')) return;
            recollect(spinBtn[0]);
          },
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
        frame = null;
        lastFocus = null;
        /* Task 44: удержанный слой перехода снимает только stop(), и если
           уходят с экрана, пока он разгоняется (нажали «назад» сразу после
           «Крутить»), убрать его больше некому. Внутри leaveKadr — там же,
           где снимается сам режим кадра. */
        leaveKadr();
        try { chipsScroll.destroy(); } catch (eC) { }
        try { scroll.destroy(); } catch (e) { }
        try { screen.remove(); } catch (e2) { }
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

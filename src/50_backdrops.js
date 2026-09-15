  /* -------------------------------------------------------------------- */
  /* Фон карточки (Task 5b: перенесено из 90_runtime.js без изменения      */
  /* поведения для режима 'backdrop'; добавлены режимы 'poster' и          */
  /* 'procedural' по LC.cardinfo.bgMode). Публично — LC.backdrops.apply     */
  /* (root, body, movie) и LC.backdrops.cancel(body); apply вызывает        */
  /* Listener 'full' в 90_runtime.js на complite (там же, где раньше был    */
  /* applyBackdrop), cancel — 'activity' destroy (правки координатора,      */
  /* п.4). Task 6: LC.backdrops.pickBackdrops (чистая функция отбора        */
  /* кадров); сам контроллер слайдшоу — в src/51_slideshow.js (LC.slideshow,*/
  /* рефакторинг, решение координатора: Task 7 будет ставить его на паузу   */
  /* извне). apply() считает urls (pickBackdrops + LC.cardinfo.imageUrl) и  */
  /* вызывает LC.slideshow.create(layer, urls, opts) — возвращённый         */
  /* контроллер {pause,resume,destroy} 90_runtime.js хранит в                */
  /* LC.active.slideshow и дёргает pause/resume из той же подписки          */
  /* 'activity' (archive/start), cancel(body) вызывает destroy(). URL       */
  /* любых картинок — только через LC.cardinfo.imageUrl (план 0.2           */
  /* «Картинки», прокси TMDB, без двойного слэша). */
  /* -------------------------------------------------------------------- */

  function tmdbImageFn() {
    if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.image === 'function') {
      return function (url) { return Lampa.TMDB.image(url); };
    }
    return null;
  }

  function apiImgFn() {
    if (window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
      return function (path, size) { return Lampa.Api.img(path, size); };
    }
    return null;
  }

  /* Ревью Task 5b (правки координатора, п.1): путь кадра — из
     LC.cardinfo.backdropPath (backdrop_path либо первый чистый элемент
     images.backdrops[]), той же функции, что определяет bgMode — раньше
     это были два независимых источника правды, и режим 'backdrop' с кадром
     только в альбоме отдавал пустой URL. */
  function backdropUrl(movie) {
    var url = '';
    try {
      var path = LC.cardinfo.backdropPath(movie);
      if (path) url = LC.cardinfo.imageUrl(path, 'w1280', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('image url failed', e);
    }
    if (!url && movie.background_image) url = movie.background_image;
    return url;
  }

  /* Task 5b Step 3: постер для размытого фона — 'w500', то же качество,
     которое родная Poster.onCreate (app.min.js) грузит в .full--poster
     (card.img = Api.img(poster_path, ...).replace(/\/w\d+/, '/w500')) —
     сам постер-<img> плагин не трогает, эта функция только про фон. */
  function posterUrl(movie) {
    try {
      if (movie.poster_path) return LC.cardinfo.imageUrl(movie.poster_path, 'w500', tmdbImageFn(), apiImgFn());
    } catch (e) {
      warn('poster url failed', e);
    }
    return '';
  }

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  /* .lumen-backdrop лежит в e.body — сосед карточки (.lumen-card вложена
     глубже, внутри .scroll__body), обычный потомковый селектор вида
     .lumen-card.lumen-motion-lite … .lumen-backdrop тут не сработает
     (план 1.1: ALLOWED_ROOTS в css.test.mjs держит .lumen-backdrop как
     самостоятельный корень отдельно от .lumen-card). Поэтому режим
     анимаций зеркалится прямо на сам слой фона — CSS для .lumen-bg--blur
     читает класс lumen-motion-* на .lumen-backdrop (design-spec §12/доп.
     к Task 5b: в lite/off — без filter:blur, только затемнение). */
  function syncMotionClass(layer) {
    try {
      layer.removeClass('lumen-motion-full lumen-motion-lite lumen-motion-off').addClass('lumen-motion-' + LC.motionMode());
    } catch (e) { }
  }

  /* Task 5b Step 5 (утечки): перед любой мутацией DOM после асинхронного
     ответа (Image().onload/onerror/таймер) — проверяем, что узел ещё в
     документе. Карточку могли закрыть до ответа: Lampa убирает весь
     .activity__body (а с ним и .lumen-backdrop) при destroy активности. */
  function isMounted(node) {
    try { return !!(node && document.documentElement && document.documentElement.contains(node)); } catch (e) { return false; }
  }

  /* Task 6: .lumen-bg__slides — контейнер для дополнительных кадров
     слайдшоу (первый кадр остаётся .lumen-backdrop__img — грузится он
     один раз в loadBackdrop(), см. ниже). Вставлен ДО вуалей в разметке,
     поэтому и он сам, и все кадры, которые в него добавит слайдшоу,
     всегда рисуются под вуалями (план: «вуали слоя остаются поверх
     кадров») — без явного z-index, просто по порядку в DOM. */
  function ensureLayer(body) {
    var layer = body.children('.lumen-backdrop');
    if (!layer.length) {
      layer = $('<div class="lumen-backdrop">' +
        '<div class="lumen-backdrop__img"></div>' +
        '<div class="lumen-bg__slides"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
        '<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
        '</div>');
      body.prepend(layer);
    }
    return layer;
  }

  /* Task 6: тот же layer (то же e.body) может получить apply() ещё раз
     (смена карточки без полного размонтирования слоя — тот же сценарий,
     ради которого уже существуют lumenGen/lumenPending) — сбрасываем и
     кадры предыдущего слайдшоу: .lumen-backdrop__img теряет
     lumen-bg__img/is-active (иначе на нём ещё секунду доиграл бы Ken
     Burns предыдущей карточки), .lumen-bg__slides опустошается. */
  function clearLayer(layer) {
    layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2 lumen-bg--blur');
    layer.find('.lumen-backdrop__img').removeClass('lumen-bg__img is-active');
    layer.find('.lumen-bg__slides').empty();
  }

  /* Ревью Task 5b (правки координатора, п.2/4): у каждого слоя — счётчик
     поколения (layer.data('lumenGen')) и ссылка на незавершённую загрузку
     (layer.data('lumenPending') = {timer, loader}). Без этого повторный
     apply() на том же e.body (смена карточки без полного размонтирования
     слоя, либо будущий слайдшоу Task 6) мог получить кадр от уже
     неактуального вызова, если тот ответит позже нового — новый фон
     перезаписывался бы устаревшим. cancelPending() гасит и обработчики
     (onload/onerror = null — сама сеть их больше не вызовет), и таймер;
     gen — запасная сеть НА СЛУЧАЙ, если что-то всё же успело выполниться
     до отмены (см. finish() ниже). */
  function cancelPending(layer) {
    var pending = layer.data('lumenPending');
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    if (pending.loader) { pending.loader.onload = null; pending.loader.onerror = null; }
    layer.removeData('lumenPending');
  }

  function nextGen(layer) {
    var gen = (layer.data('lumenGen') || 0) + 1;
    layer.data('lumenGen', gen);
    return gen;
  }

  /* Task 5b Step 3/4: нет кадра — ни в режиме 'poster'/'procedural', ни
     когда кадр из режима 'backdrop' не загрузился/завис (design-spec §12,
     дополнение к Task 5b: размытый постер, blur(40px)=1.75em, opacity:.8
     поверх диагонального градиента — сам градиент в CSS у .lumen-bg--blur).
     Постера тоже нет — старые процедурные градиенты v1, без изменений. */
  function showNoFrame(layer, movie) {
    var img = layer.find('.lumen-backdrop__img');
    var url = posterUrl(movie);
    if (url) {
      img.css('background-image', 'url("' + encodeURI(url) + '")');
      syncMotionClass(layer);
      layer.addClass('lumen-bg--blur').addClass('loaded');
    } else {
      img.css('background-image', '');
      layer.addClass(procClass(movie)).addClass('loaded');
    }
  }

  /* Task 5b Step 3: предзагрузка кадра как в v1 (Image().onload/onerror),
     плюс таймаут 8с (экран 13 design-spec §12 не даёт точного числа
     зависания — восьмисекундный таймаут свой). Любая ветка завершения
     (onload/onerror/таймер) проходит через finish(), которая гасит все
     остальные пути и таймер — второй мутации после первой не будет.
     Ревью Task 5b (правки координатора, п.3): весь блок ПОСЛЕ проверки
     isMounted — в одном try/catch (как было в v1): encodeURI может бросить
     URIError на «сломанном» URL, showNoFrame тоже может исключить —
     раньше try/catch стоял только вокруг успешной ветки.
     Task 6 (refactor): пятый параметр controller — контроллер слайдшоу
     этого apply() (LC.slideshow.create(), src/51_slideshow.js), уже создан
     и ждёт на layer.data('lumenSlideshow') к моменту, когда сеть ответит.
     Первый кадр слайдшоу — именно этот, уже загружаемый здесь,
     .lumen-backdrop__img (план: «не грузить его дважды») —
     controller.activate() только помечает узел классами и решает,
     отбирать ли ещё кадры/заводить ли таймер, новой загрузки не делает. */
  function loadBackdrop(layer, movie, gen, controller) {
    var url = backdropUrl(movie);
    var img = layer.find('.lumen-backdrop__img');

    if (!url) { showNoFrame(layer, movie); return; }

    img.css('background-image', '');
    var node = layer[0];
    var done = false;
    var timer = null;
    var loader = new Image();

    function finish(ok) {
      if (done) return;
      done = true;
      if (timer) { clearTimeout(timer); timer = null; }
      loader.onload = null;
      loader.onerror = null;
      layer.removeData('lumenPending');
      /* Устарела: более новый apply() уже поменял поколение слоя (запасная
         сеть — cancelPending() выше по стеку уже обнулил onload/onerror,
         это на случай, если finish() всё же был вызван до отмены). */
      if (layer.data('lumenGen') !== gen) return;
      if (!isMounted(node)) return;
      try {
        if (ok) {
          /* encodeURI страхует от "/\/) в URL, которые сломали бы строку url("...") */
          img.css('background-image', 'url("' + encodeURI(url) + '")');
          layer.addClass('loaded');
          /* Task 6: syncMotionClass раньше вызывался только из showNoFrame
             (poster/procedural/таймаут) — успешный кадр 'backdrop' класс
             lumen-motion-* на layer не получал вовсе, а Ken Burns (Task 4,
             30_css.js) заведён именно на .lumen-backdrop.lumen-motion-full
             .lumen-bg__img.is-active. Без этой строки наезд не включался
             бы никогда. */
          syncMotionClass(layer);
          controller.activate();
        } else {
          showNoFrame(layer, movie);
        }
      } catch (e) {
        warn('backdrop apply failed', e);
      }
    }

    loader.onload = function () { finish(true); };
    loader.onerror = function () { finish(false); };
    timer = setTimeout(function () { finish(false); }, 8000);
    loader.src = url;

    layer.data('lumenPending', { timer: timer, loader: loader });
  }

  /* Task 5b Step 2: сам <img class="full--poster"> заполняет родная
     Lampa (Poster.onCreate в app.min.js: card.img из poster_path, w500,
     добавляет .loaded на .full-start-new__poster сама) — плагин его не
     трогает вовсе, только раскрывает узел через CSS (.lumen-card--poster,
     v1-правило .full-start-new__left{display:none} переопределяется там
     большей специфичностью + !important) и добавляет подпись-атрибуцию
     источника (design-spec §11: текст «TMDB» снизу-слева плейсхолдера). */
  function ensurePosterLabel(root) {
    var poster = root.find('.full-start-new__poster');
    if (!poster.length) return;
    if (!poster.children('.lumen-poster-tmdb').length) {
      poster.append('<div class="lumen-poster-tmdb">TMDB</div>');
    }
  }

  /* Task 6 (refactor): apply() считает urls (pickBackdrops + LC.cardinfo.
     imageUrl) и передаёт их в LC.slideshow.create(layer, urls, opts) —
     возвращённый контроллер {pause,resume,destroy} 90_runtime.js кладёт в
     LC.active.slideshow сразу (синхронно, до ответа сети: сам контроллер
     создаётся здесь же, ниже, ДО loadBackdrop()/showNoFrame();
     pause/resume/destroy на нём безопасны в любой момент — до activate()
     (ещё грузится первый кадр или режим не 'backdrop') это просто no-op,
     см. src/51_slideshow.js). urls считается ДЛЯ ЛЮБОГО режима (даже
     poster/procedural, где слайдшоу не активируется вовсе) — так
     LC.active.slideshow всегда валидный объект, а не undefined. На ранних
     return (нет body) и в catch — undefined, вызывающая сторона это уже
     проверяет через `if (LC.active.slideshow)`. */
  function apply(root, body, movie) {
    try {
      if (!body || !body.length) return;
      movie = movie || {};

      var mode = LC.cardinfo.bgMode(movie);

      if (root && root.length) {
        root.toggleClass('lumen-card--poster', mode === 'poster');
        if (mode === 'poster') ensurePosterLabel(root);
      }

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

      var layer = ensureLayer(body);
      /* Отменяем незавершённую загрузку ПРЕДЫДУЩЕГО apply() на этом же
         слое ДО того, как начнём новую (правки координатора, п.2), и
         останавливаем слайдшоу предыдущего вызова той же логикой (Task 6). */
      cancelPending(layer);
      stopSlideshow(layer);
      clearLayer(layer);
      var gen = nextGen(layer);

      var main = LC.cardinfo.backdropPath(movie);
      var max = LC.slideshow.maxFramesFor(LC.motionMode());
      var paths = pickBackdrops(movie.images, main, max);
      var urls = LC.util.map(paths, function (p) { return LC.cardinfo.imageUrl(p, 'w1280', tmdbImageFn(), apiImgFn()); });
      var slideshowOpts = { enabled: slideshowEnabled, intervalMs: slideIntervalMs };

      var controller = LC.slideshow.create(layer, urls, slideshowOpts);
      layer.data('lumenSlideshow', controller);
      /* Task 6 (fix, находка "мёртвое слайдшоу"): urls/opts сохраняются на
         слое отдельно от контроллера — если Lampa позже "оживит" этот же
         layer без нового apply() (см. revive() ниже и комментарий в
         90_runtime.js), их можно достать и пересобрать ротацию, не имея
         под рукой movie ещё раз. */
      layer.data('lumenUrls', urls);
      layer.data('lumenOpts', slideshowOpts);

      if (mode === 'backdrop') loadBackdrop(layer, movie, gen, controller);
      else showNoFrame(layer, movie);

      return controller;
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  /* Ревью Task 5b (правки координатора, п.4): хук закрытия карточки —
     90_runtime.js вызывает это на 'activity' destroy СВОЕЙ активности
     (LC.active), до того как Lampa уберёт DOM сама. Идемпотентен: повторный
     вызов на уже отменённом/отсутствующем слое ничего не делает.
     Task 6: тем же вызовом останавливаем и слайдшоу (иначе его
     setInterval пережил бы закрытие карточки — план 0.3, инвариант 5). */
  function cancel(body) {
    try {
      if (!body || !body.length) return;
      var layer = body.children('.lumen-backdrop');
      if (!layer.length) return;
      cancelPending(layer);
      stopSlideshow(layer);
    } catch (e) {
      warn('backdrop cancel failed', e);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Task 6: слайдшоу кадров.                                              */
  /* -------------------------------------------------------------------- */

  /* Шаг 1/2 (TDD): images — movie.images (может быть undefined), main —
     LC.cardinfo.backdropPath(movie) (главный кадр, всегда первым и без
     дублей), max — сколько кадров всего вернуть. Кадры с текстом/логотипом
     (iso_639_1 непустой) отбрасываются; из оставшихся сперва идут широкие
     (>= 1280 по width), затем по убыванию vote_average — так у "узких"
     дублей меньше шансов попасть в max. Правки координатора: тест ниже
     ожидает ['/main', '/c', '/a'] для эталонных данных (у /d ширина 800 —
     он в конце очереди и в max=3 не попадает) — логика функции не менялась
     относительно черновика Step 2, поправлено только ожидание теста. */
  function pickBackdrops(images, main, max) {
    var list = (images && images.backdrops) ? images.backdrops : [];
    var clean = LC.util.filter(list, function (b) { return b && b.file_path && !b.iso_639_1 && b.file_path !== main; });
    clean.sort(function (x, y) {
      var wx = (x.width || 0) >= 1280 ? 1 : 0, wy = (y.width || 0) >= 1280 ? 1 : 0;
      if (wx !== wy) return wy - wx;
      return (y.vote_average || 0) - (x.vote_average || 0);
    });
    var r = main ? [main] : [];
    LC.util.each(clean, function (b) { if (r.length < max) r.push(b.file_path); });
    return r;
  }

  /* Настройки Task 6 (src/80_settings.js): имена без префикса PLUGIN,
     как lumen_motion. lumen_slideshow — вкл/выкл по умолчанию вкл;
     lumen_slide_interval — '8'|'14'|'20' (секунды), по умолчанию '14'. */
  function slideshowEnabled() {
    return !!LC.pref('lumen_slideshow', true);
  }

  function slideIntervalMs() {
    var n = parseInt(LC.pref('lumen_slide_interval', '14'), 10);
    if (n !== 8 && n !== 14 && n !== 20) n = 14;
    return n * 1000;
  }

  /* Task 6, Ревью (симметрично stopSlideshow ниже): достаёт и уничтожает
     контроллер слайдшоу, привязанный к слою через layer.data
     ('lumenSlideshow') — общая точка входа и для apply() (гасит слайдшоу
     ПРЕДЫДУЩЕГО вызова на том же layer) и для cancel() (закрытие карточки). */
  function stopSlideshow(layer) {
    var s = layer.data('lumenSlideshow');
    if (s) { try { s.destroy(); } catch (e) { } }
    layer.removeData('lumenSlideshow');
  }

  /* Task 6 (fix, находка "мёртвое слайдшоу", решение координатора): Lampa
     умеет тихо "убить" карточку, которая ушла на 2+ уровня в историю
     (ActivitySlide.stop() -> this.slide.remove(), БЕЗ единого события
     Listener) — наша страховка isLayerMounted() корректно ловит это на
     следующем тике и вызывает controller.destroy(). Но когда пользователь
     потом возвращается backward()-ом, Lampa у такой карточки переиспользует
     ТОТ ЖЕ DOM/ActivitySlide (start$4: is_stopped -> slides.append(render()))
     БЕЗ нового 'full':complite — то есть без нового apply(). 90_runtime.js
     (LC.onActivityEvent) находит слой, видит контроллер !isAlive() и зовёт
     сюда revive() вместо resume().

     Выбор между двумя вариантами из сообщения координатора:
       (A) повторить apply() целиком (тот же путь, что 'full':complite) —
           отклонено: на 'activity':'start' нет доступа к movie (это
           отдельное событие, e.object — запись стека активностей, а не
           объект/данные карточки; e.data.movie есть только в событии
           'full'). Кроме того, apply() -> clearLayer() снимает is-active
           с .lumen-backdrop__img (opacity:0 по CSS) ДО того, как новый
           controller.activate() отработает — гарантированная вспышка фона
           в пустоту на время нового цикла загрузки, даже с generation guard
           (тот спасает только от ДВОЙНОГО контроллера/лишней сетевой
           загрузки, не от самого сброса классов).
       (B) (выбрано) лёгкий LC.slideshow.create(layer, urls, opts) с urls/
           opts, сохранёнными в layer.data ещё исходным apply() — без
           повторного обращения к movie, без промежуточного opacity:0.
           Видимый сейчас кадр (может быть НЕ .lumen-backdrop__img, если
           ротация к моменту "убийства" успела провернуться дальше) остаётся
           на экране: его background-image переносится на
           .lumen-backdrop__img (канонический "нулевой" кадр нового
           контроллера — activate() его не перезагружает, просто помечает
           классами), .lumen-bg__slides очищается (не плодим дубликаты
           поверх кадров старого, уже мёртвого контроллера). Дальше
           ротация просто продолжает идти по тому же пулу urls — какой
           именно кадр окажется "следующим", пользователю не важно и не
           заметно.
     Отдельный generation guard (lumenGen) здесь не нужен: проверка
     isAlive() и создание нового контроллера происходят синхронно в одном
     вызове LC.onActivityEvent, без асинхронного окна для гонки (в отличие
     от варианта A, где новый apply() снова ждёт сеть). */
  function revive(layer) {
    try {
      var urls = layer.data('lumenUrls');
      if (!urls || !urls.length) return null;
      var opts = layer.data('lumenOpts');

      var img0 = layer.find('.lumen-backdrop__img');
      var activeFrame = layer.find('.lumen-bg__img.is-active');
      var activeBg = activeFrame.length ? activeFrame.css('background-image') : img0.css('background-image');
      if (activeBg) img0.css('background-image', activeBg);
      img0.addClass('lumen-bg__img is-active');
      layer.find('.lumen-bg__slides').empty();

      var controller = LC.slideshow.create(layer, urls, opts);
      layer.data('lumenSlideshow', controller);
      controller.activate();
      return controller;
    } catch (e) {
      warn('slideshow revive failed', e);
      return null;
    }
  }

  LC.backdrops = { apply: apply, cancel: cancel, pickBackdrops: pickBackdrops, revive: revive };

  /* В браузере "module" не определён — ветка не выполняется. Экспорт нужен
     только test/backdrops.test.mjs (Step 1, TDD pickBackdrops) через общий
     test/_load.mjs — остальные тесты этого файла грузят модуль своим
     загрузчиком (DOM-заглушки) и обращаются к LC.backdrops напрямую, им
     module.exports не требуется. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.backdrops;

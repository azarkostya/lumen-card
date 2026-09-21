  /* -------------------------------------------------------------------- */
  /* LC.hero — герой над рядами главной (Task 18).                        */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   pickLogo(logos, lang) → file_path логотипа или null                  */
  /*   mediaOf(card) → 'movie' | 'tv'                                       */
  /*   heroModel(card, details, words) → модель героя или null              */
  /*   shouldUpdate(prevId, nextId, elapsedMs, delay) → boolean             */
  /*   sizeFor(width) / logoSizeFor(width) → размер картинки TMDB           */
  /*   logoBox(ratio) → {w, h} логотипа в em или null                      */
  /*   detailsRequest(media, id, lang) → {url, params, life}                */
  /*   mount(root, opts) — вставить героя в корень экрана                   */
  /*   mountCurrent() — смонтировать, если сейчас открыта главная           */
  /*   detach(render) — снять, если герой не принадлежит этой активности    */
  /*   owns(render) → принадлежит ли герой этой активности                  */
  /*   unmount() — снять целиком (узел, класс, слушатель, запросы)          */
  /*   applyMotion() — перечитать режим анимаций на открытом герое          */
  /*   active() → смонтирован ли герой                                      */
  /*   bigPoster(url) → адрес того же постера в w500 или null               */
  /*   lastFocus() → {id, poster, node, big?} последней карточки под фокусом */
  /*                                                                       */
  /* Как работает смена героя (сториборд 23г, ограничение брифа 1):         */
  /*   - фокус карточки ловит ОДИН нативный слушатель 'hover:focus' в фазе  */
  /*     ЗАХВАТА на корне активности (Task 37, подробности у listenFocus);  */
  /*     данные карточки лежат в нативном свойстве узла el.card_data;       */
  /*   - показ откладывается на DELAY (350 мс) и отменяется, если фокус     */
  /*     ушёл раньше: при быстром листании грузится ровно один кадр;        */
  /*   - тот же id под фокусом не грузит ни кадра, ни деталей.              */
  /*                                                                       */
  /* Сторож поколения: модульный счётчик gen поднимается на каждом mount,   */
  /* unmount и show. Любой отложенный колбэк (таймер показа, onload кадра,  */
  /* ответ деталей) сверяет захваченное значение и в снятый или уже         */
  /* сменившийся DOM не пишет. unmount() снимает слушатель фокуса,          */
  /* все таймеры, предзагрузку кадра и незавершённый запрос деталей —       */
  /* герой на слабом ТВ не оставляет после себя ни одной живой подписки.    */
  /* -------------------------------------------------------------------- */

  LC.hero = (function () {

    /* Задержка перед сменой героя — раскадровка 23г брифа главной. */
    var DELAY = 350;
    /* Правка пользователя 2026-09-17 (третий круг), дословно: «обязательно
       условие, что если очень быстро меняется, то не надо, только когда на
       карточке останавливаются больше на 3 сек, а то это будет ужас».
       Акцент и подкраска фона (src/57_color.js) — вторая, СВОЯ задержка: у
       кадра героя цена смены — кроссфейд уже загруженной картинки, у цвета —
       расчёт по постеру и пересборка всей таблицы стилей. Поэтому 3 с покоя
       фокуса, а не 350 мс: при листании стрелкой не должно уходить ни одного
       расчёта (проверяется счётчиком LC.color.requests()). */
    var ACCENT_DELAY = 3000;
    /* Task 28: автотрейлер в герое. Восемь секунд покоя фокуса — цифра плана
       фазы 3 (раздел 0, решения пользователя: «трейлер в герое главной
       запускается сам через 8 с покоя фокуса»). Это ТРЕТЬЯ задержка героя, и
       самая длинная намеренно: кадр меняется через 350 мс, акцент — через 3 с,
       а ролик — вещь, которая начинает шуметь картинкой на весь экран, и при
       листании рядов не должен запускаться ни разу. */
    var TRAILER_DELAY = 8000;
    /* Ролики фильма меняются редко — та же неделя, что у штатного
       Lampa.Api.sources.tmdb.videos (docs/research/API_NOTES_2.md §2). */
    var VIDEOS_LIFE = 10080;
    /* Уход старого текста перед подменой (раскадровка 23а: 180 мс). */
    var SWAP_MS = 180;
    /* Предзагрузка кадра не может висеть вечно: тот же таймаут, что у фона
       карточки (src/50_backdrops.js). */
    var LOAD_TIMEOUT = 8000;
    /* Детали (описание, жанры, длительность, логотипы) кэшируются сутки —
       по этим полям фильм за день не меняется, а запрос идёт через прокси
       пользователя. */
    var DETAILS_LIFE = 1440;
    /* Task 27 (довесок): ширина крупной версии постера, которую герой
       предзагружает для слоя перехода (см. bigPoster). */
    var BIG_POSTER = 500;
    /* Кегль содержимого кадра — копия TEXT_ZOOM из src/30_css.js
       (.lumen-hero__text{font-size:1.1em}). Дублируется как литерал по той же
       причине, что WATCHED в других модулях: одно число, ради которого не
       стоит заводить зависимость между модулями. */
    var TEXT_ZOOM = 1.1;
    /* Рамка логотипа в em ЕГО СОБСТВЕННОГО контекста — 37.84em, ровно как
       width у .lumen-hero__logo (src/30_css.js) и как LOGO_W_MAX ниже,
       дальше которого logoBox ширину не пускает. В em Lampa это в TEXT_ZOOM
       раз больше: логотип лежит внутри .lumen-hero__text, а у того свой
       font-size (находка ревью Task 39, п.2 — раньше здесь считалось 37.84
       em Lampa, то есть рамка выходила на 10 % уже фактической).

       Масштаб интерфейса плагина (lumen_scale) сюда НЕ входит: правило
       SCALE_ROOTS и правило .lumen-hero .lumen-hero__text имеют одинаковую
       специфичность, и второе, стоящее в файле ниже, его перебивает —
       см. комментарий у LC.uiScale в src/30_css.js. Поэтому размер логотипа
       считается с явным масштабом 1. */
    var LOGO_EM = 37.84;

    /* Размер логотипа в кадре (правка пользователя 2026-09-17, четвёртый
       круг, дословно: «нет какого-то единого размера»).

       Третий круг выровнял логотипы по ВЫСОТЕ рамки, и высота у всех стала
       одна. Визуально это не равенство: у двухстрочного логотипа («Хитрый
       койот», «Южный парк») на ту же высоту приходятся ДВЕ строки букв —
       буквы вдвое мельче, чем у однострочного широкого («Одиссея»,
       «Колония»). Равным должен быть видимый размер, а он держится на
       ПЛОЩАДИ: то же название, разложенное в две строки, теряет вдвое по
       ширине и приобретает вдвое по высоте, площадь у него та же.

       Отсюда формула: высота h = sqrt(LOGO_AREA / пропорция), то есть
       площадь w × h = LOGO_AREA у всех логотипов одна. Клампы по краям:
       - LOGO_H_MAX — потолок высоты. Его задаёт бюджет раскладки: TEXT_LOGO
         в src/30_css.js равен LOGO_H_MAX + .4em отступа, и из этого бюджета
         считаются пороги «показывать описание» и «показывать кадр». Выше
         поднимать нельзя — мета-строка уйдёт под верхнюю кромку блока
         (проверяется тестом css.test.mjs «бюджет высоты под логотип»).
       - LOGO_H_MIN — пол высоты: логотип-баннер 12:1 и длиннее по площади
         просил бы полтора em и читался бы полоской.
       - LOGO_W_MAX — та же рамка 37.84em, что и width у .lumen-hero__logo в
         CSS. В пикселях экрана 1920 это 950 (em внутри .lumen-hero__text
         дороже базового в TEXT_ZOOM раз), а не 700, как утверждала эта
         строка до ревью Task 39. Шире
         текстового блока логотип не рисуем ни при каких пропорциях. Ширина
         сильнее пола высоты: упёрлись в рамку — высоту отдаём.
       Task 36: сжатого варианта размера здесь больше нет. Логотип уменьшается
       в CSS через transform: scale (константа LOGO_COMPACT в src/30_css.js),
       потому что width/height анимировались раскладкой; инлайну достаточно
       одного набора чисел на оба состояния. */
    var LOGO_AREA = 65;
    var LOGO_H_MAX = 5.2;
    var LOGO_H_MIN = 2.4;
    var LOGO_W_MAX = 37.84;

    var MOTION_CLASSES = 'lumen-motion-full lumen-motion-lite lumen-motion-off';

    /* ------------------------------------------------------------------ */
    /* Чистые функции (без DOM, Lampa и window).                           */
    /* ------------------------------------------------------------------ */

    /* Логотип фильма из images.logos: язык интерфейса, затем английский,
       затем первый безъязыкий (такие логотипы обычно и есть «оригинальные»).
       Нет ни одного — null, и тогда рисуется текстовый заголовок
       (ограничение брифа 2, поправка контроллера: без панели-фолбэка). */
    function pickLogoItem(logos, lang) {
      lang = lang || 'ru';
      var own = null;
      var en = null;
      var neutral = null;
      for (var i = 0; logos && i < logos.length; i++) {
        var item = logos[i];
        if (!item || !item.file_path) continue;
        var code = item.iso_639_1 || '';
        if (code === lang) { if (!own) own = item; }
        else if (code === 'en') { if (!en) en = item; }
        else if (!code) { if (!neutral) neutral = item; }
      }
      return own || en || neutral || null;
    }

    function pickLogo(logos, lang) {
      var item = pickLogoItem(logos, lang);
      return item ? item.file_path : null;
    }

    /* Пропорция логотипа (ширина/высота). TMDB отдаёт её готовой в
       aspect_ratio; width/height в том же объекте — запасной путь на случай
       урезанного ответа прокси. 0 — пропорция неизвестна, и тогда размер
       остаётся за рамкой по умолчанию из CSS. */
    function logoRatioOf(item) {
      if (!item) return 0;
      var ratio = Number(item.aspect_ratio) || 0;
      if (ratio > 0) return ratio;
      var w = Number(item.width) || 0;
      var h = Number(item.height) || 0;
      return (w > 0 && h > 0) ? w / h : 0;
    }

    function round2(n) {
      return Math.round(n * 100) / 100;
    }

    /* Размер логотипа под его пропорцию: равная площадь вместо равной
       высоты (см. комментарий к LOGO_AREA выше). Один набор чисел на оба
       состояния кадра — сжатое даёт CSS масштабом. Пропорции нет — null:
       размер отдаём CSS. */
    function logoBox(ratio) {
      var r = Number(ratio) || 0;
      if (!(r > 0)) return null;
      var h = Math.sqrt(LOGO_AREA / r);
      if (h > LOGO_H_MAX) h = LOGO_H_MAX;
      if (h < LOGO_H_MIN) h = LOGO_H_MIN;
      var w = h * r;
      if (w > LOGO_W_MAX) {
        w = LOGO_W_MAX;
        h = w / r;
      }
      return { w: round2(w), h: round2(h) };
    }

    /* Тип карточки для запроса деталей. media_type приходит из discover с
       двумя медиа; без него признак — name (у сериалов TMDB заголовок в
       name, у фильмов — в title). Та же формула, что в LC.hub.cardMedia. */
    function mediaOf(card) {
      if (card && card.media_type) return card.media_type;
      return (card && card.name) ? 'tv' : 'movie';
    }

    function yearOf(card) {
      var date = '' + ((card && (card.release_date || card.first_air_date)) || '');
      return date ? date.slice(0, 4) : '';
    }

    /* Модель героя: card — это el.card_data ряда (есть сразу), details —
       ответ movie/{id}|tv/{id} с images (приходит позже, может не прийти
       вовсе). words — строки интерфейса (собирает runtime из LC.STRINGS),
       модуль остаётся чистым и языка не знает.

       pending=true означает «деталей ещё нет» — рантайм по нему показывает
       скелетон описания (ограничение брифа 3). */
    function heroModel(card, details, words) {
      if (!card) return null;
      words = words || {};
      details = details || null;

      var media = mediaOf(card);
      var meta = [];
      var year = yearOf(card);
      if (year) meta.push(year);

      if (details) {
        if (media === 'tv') {
          var seasons = Number(details.number_of_seasons) || 0;
          if (seasons > 0) {
            meta.push(seasons + ' ' + (words.seasonsWord ? words.seasonsWord(seasons) : ''));
          }
        } else {
          var runtime = LC.util.fmtRuntime(Number(details.runtime) || 0, words.min || '');
          if (runtime) meta.push(runtime);
        }
        var genres = LC.cardinfo.genres(details.genres, words.cap);
        if (genres.length) meta.push(genres.join(', '));
      }

      /* Статус сериала — текстом «Выходит · 17 дек» (поправка контроллера к
         Task 18: чип обратного отсчёта остаётся в карточке, фаза 1 Task 5c). */
      var status = '';
      var next = details && details.next_episode_to_air;
      if (next && next.air_date) {
        var when = LC.cardinfo.shortDate(next.air_date, words.months);
        if (when) status = (words.airing || '') + ' · ' + when;
      }

      var vote = Number(card.vote_average) || 0;
      var logoItem = details ? pickLogoItem(details.images && details.images.logos, words.lang) : null;

      return {
        id: card.id,
        media: media,
        title: card.title || card.name || '',
        backdrop: (details && details.backdrop_path) || card.backdrop_path || '',
        poster: card.poster_path || (details && details.poster_path) || '',
        logo: logoItem ? logoItem.file_path : null,
        /* Пропорция нужна рантайму, чтобы дать логотипу размер по площади
           (logoBox): двухстрочный логотип получает больше высоты, широкий
           однострочный — больше ширины. */
        logoRatio: logoRatioOf(logoItem),
        meta: meta,
        overview: (details && details.overview) || card.overview || '',
        /* Порог 1, а не 0: он тот же, что у подписи карточки ряда
           (src/62_badges.js, rate) — иначе фильм с оценкой 0.04 показывал бы
           в кадре «★ 0.0», а в ряду под ним ничего. Сравнение с 1 заодно
           отсекает NaN. */
        rating: vote >= 1 ? vote.toFixed(1) : '',
        status: status,
        pending: !details
      };
    }

    /* Пора ли менять героя: тот же фильм под фокусом или пауза фокуса
       короче задержки — нет (бриф, ограничение 1: фон при быстром листании
       не мигает). */
    function shouldUpdate(prevId, nextId, elapsedMs, delay) {
      if (nextId == null) return false;
      if (prevId === nextId) return false;
      return (elapsedMs || 0) >= (delay || 0);
    }

    /* Task 27 (довесок): адрес того же постера покрупнее — для слоя перехода
       «постер → кадр» (src/67_transition.js).

       Ряды Lampa рисуют постеры в w300 (app.min.js ~52500), а переход
       растягивает картинку почти на весь экран: на FHD это увеличение в
       шесть раз по ширине, и в полноэкранном состоянии постер видно мыльным.
       w500 — следующий размер TMDB после w300 (500×750 против 300×450 —
       снято живьём 2026-09-17): линейного разрешения в полтора с лишним
       раза больше, а грузится по-прежнему одна картинка на карточку, на
       которой остановились.

       Меняется ровно сегмент размера в пути TMDB (/t/p/wNNN/). Адрес не
       оттуда (Кинопоиск, локальная картинка) или постер уже не мельче —
       null: грузить нечего. */
    /* Task 28: можно ли сейчас заводить фоновый ролик в герое.
         pref    — настройка lumen_hero_trailer,
         motion  — режим анимаций (LC.motionMode),
         trailer — режим фонового трейлера карточки (LC.trailer.mode: на
                   Tizen/webOS 'auto' даёт 'off'),
         heavy   — тумблер тяжёлых эффектов (LC.fxHeavy, Task 40).
       В lite/off ролика нет вовсе: там и кадр-то герой не обновляет (см.
       loadFrame), а iframe YouTube поверх экрана — самая дорогая вещь,
       которую плагин умеет включать. По той же причине его нет и при
       выключенных тяжёлых эффектах. */
    function trailerAllowed(pref, motion, trailer, heavy) {
      if (pref === false) return false;
      if (motion !== 'full') return false;
      if (heavy === false) return false;
      return trailer !== 'off';
    }

    function bigPoster(url) {
      var src = '' + (url || '');
      var m = /\/t\/p\/w(\d+)\//.exec(src);
      if (!m) return null;
      if ((parseInt(m[1], 10) || 0) >= BIG_POSTER) return null;
      return src.replace(m[0], '/t/p/w' + BIG_POSTER + '/');
    }

    /* Task 39: аргумент — ширина в ФИЗИЧЕСКИХ пикселях (LC.util.screenPx),
       а не CSS-ширина окна. До Task 39 сюда приходил innerWidth, и на
       Android TV, который отдаёт 960 CSS px при DPR 2, кадр героя выбирался
       как для 960-пиксельного экрана, хотя панель рисует 1920.
       Кадр героя занимает экран целиком, поэтому размер общий с фоном
       карточки и заставкой — LC.util.frameSize. */
    function sizeFor(width) {
      return LC.util.frameSize(width);
    }

    /* Аргумент — ширина САМОГО ЛОГОТИПА в физических пикселях, а не экрана:
       логотип рисуется в рамке LOGO_EM × TEXT_ZOOM (41.62 em Lampa — 950 px
       на экране 1920, 1900 при DPR 2). Допуск тот же FIT, что у постеров и
       кадров (LC.util.posterSize).

       w780 — ПОТОЛОК, выше не поднимаемся ни при каком DPR (ревью Task 39,
       п.4): следующая ступень у логотипов — сразу original, а это исходный
       PNG с альфой, у TMDB нередко 2000 px и шире, то есть мегабайты в
       памяти после декодирования — ровно та цена, которую Task 40 с другой
       стороны и гасит.

       Оговорка про сами размеры: в logo_sizes у TMDB перечислены
       w45/w92/w154/w185/w300/w500/original — w780 там НЕТ. Живьём он
       работает (плагин ходит через общий путь /t/p/<size>/, и сервер
       картинок отдаёт по любому размеру из общего набора), и на нём стоит
       весь герой со времён Task 18, но это недокументированное поведение:
       если TMDB его прекратит, здесь нужно будет опуститься на w500. */
    function logoSizeFor(width) {
      return (Number(width) || 0) * 0.85 > 500 ? 'w780' : 'w500';
    }

    /* Языки логотипов: язык интерфейса + английский + безъязыкие. */
    function imageLanguages(lang) {
      lang = lang || 'ru';
      return lang === 'en' ? 'en,null' : lang + ',en,null';
    }

    /* Запрос деталей. Язык ответа НЕ задаём (в отличие от буквы плана с
       langs:'ru-RU'): Lampa подставляет язык интерфейса пользователя сама —
       проверено живьём, ответ tv/76479 без langs пришёл по-русски при
       русском интерфейсе. Навязывать ru пользователю с английской Lampa
       герой не должен. */
    function detailsRequest(media, id, lang) {
      return {
        url: media + '/' + id,
        /* Task 21 (фаза 3): к логотипам добавлены ключевые слова — по ним
           выбирается тематическая атмосфера кадра (LC.themes.matchTheme).
           Отдельного запроса они не стоят: append_to_response довешивает их
           к тому же ответу, который герой и так забирает раз на карточку. */
        params: { filter: { append_to_response: 'images,keywords', include_image_language: imageLanguages(lang) } },
        life: DETAILS_LIFE
      };
    }

    /* ------------------------------------------------------------------ */
    /* Runtime: DOM, Lampa, сеть.                                          */
    /* ------------------------------------------------------------------ */

    /* Единственный смонтированный герой за всё время жизни плагина: mount()
       любого нового корня сначала снимает предыдущего. Отсюда и «ровно один
       слушатель фокуса» — второго просто некуда положить. */
    var state = null;

    /* Сторож поколения: поднимается на mount, unmount и каждом show. */
    var gen = 0;

    /* Task 28: у автотрейлера сторож СВОЙ. Общий gen для него не годится:
       он поднимается на каждом show(), то есть уже через 350 мс покоя фокуса,
       — восьмисекундный тик по нему не пережил бы даже собственную карточку
       (та же причина, по которой своего поколения нет у акцента). tgen растёт
       ровно там, где ролик снимается: в cancelTrailer. */
    var tgen = 0;

    /* Task 29: последняя карточка под фокусом — {id, poster, node}. Её читает
       слой перехода «постер → кадр» (src/67_transition.js) в момент, когда
       Lampa открывает полную карточку. Живёт вне state: запись обновляется
       на каждом переводе фокуса и обнуляется вместе с героем. */
    var last = null;

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

    /* URL картинки — только через прокси TMDB Lampa (план 0.2), тем же
       путём, что фон карточки и плитки хаба. */
    function imageUrl(path, size) {
      try {
        return LC.cardinfo.imageUrl(path, size, tmdbImageFn(), apiImgFn());
      } catch (e) {
        return '';
      }
    }

    /* Task 39: ширина экрана в ФИЗИЧЕСКИХ пикселях — общий хелпер плагина
       (он же учитывает devicePixelRatio и его потолок). */
    function screenWidth() {
      return LC.util.screenPx();
    }

    function langCode() {
      try {
        if (typeof LC.langCode === 'function') return LC.langCode();
      } catch (e) {}
      return 'ru';
    }

    /* Строки героя из LC.STRINGS + склонение сезонов; capitalize — штатная
       функция Lampa (имена жанров TMDB приходят строчными). */
    function words() {
      var months = [];
      try { months = ('' + LC.lang('lumen_card_months_short')).split(','); } catch (e) {}
      var cap = null;
      try {
        if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
          cap = function (s) { return Lampa.Utils.capitalizeFirstLetter(s); };
        }
      } catch (eCap) {}
      return {
        min: LC.lang('lumen_card_min'),
        airing: LC.lang('lumen_hero_airing'),
        months: months,
        seasonsWord: LC.seasonsWord,
        cap: cap,
        lang: langCode()
      };
    }

    /* Разметка героя. Логотип рисуется фоном (background-image, contain) —
       у него нет ни приоритета загрузки, ни decode(), и он мелкий.
       Два слоя кадра с разными модификаторами (--a/--b) вместо двух
       одинаковых классов: кроссфейд обращается к конкретному слою, а не к
       набору из двух узлов.

       Task 64: слои кадра — <img>, а не div с background-image. У фона нет
       ни decoding, ни fetchpriority, ни load/error, ни decode(), и запрос
       уходит позже — после раскладки (docs/research/2026-09-21-webview-perf.md
       §4, «Герой — только <img>»). Кадрирование, которое до Task 64 давали
       background-size:cover и background-position:center 30 %, теперь на
       object-fit/object-position в src/30_css.js — те же значения.
       fetchpriority высокий: кадр героя — самая крупная картинка экрана и
       единственная, которую видно сразу. Атрибут появился в Chrome 101 и на
       движках постарше просто игнорируется (ресёрч §0: у легаси-WebView
       Philips его может не быть).

       .lumen-hero__lqip — тот же backdrop в w300 (0.05 Мпикс), слой под
       обоими кадрами: он приезжает первым и закрывает пустоту, пока грузится
       w1280 (ресёрч §4, LQIP). filter:blur на нём не используется — размытие
       фильтром на этом железе дорого (§«Что НЕ делать»), мягкость даёт сам
       апскейл w300 на весь кадр, как у постера в w92 выше.

       Нижней вуали-плашки (.lumen-hero__veil--b) здесь больше нет: её
       заменила градиентная МАСКА самих слоёв кадра (src/30_css.js), то есть
       кадр растворяется в фоне страницы вместо того, чтобы закрашиваться
       отдельным полноэкранным узлом. Левая вуаль осталась плашкой: двух
       масок разных направлений на одном элементе без mask-composite не
       собрать, а mask-composite в WebView телевизора не проверен. */
    function buildNode() {
      var node = $('<div class="lumen-hero">' +
        '<img class="lumen-hero__lqip" decoding="async" alt="">' +
        '<img class="lumen-hero__bg lumen-hero__bg--a" decoding="async" fetchpriority="high" alt="">' +
        '<img class="lumen-hero__bg lumen-hero__bg--b" decoding="async" fetchpriority="high" alt="">' +
        /* Task 28: слой автотрейлера — между кадром и вуалью, как
           .lumen-bg__trailer в слое фона карточки: вуаль обязана лежать
           поверх ролика, иначе текст героя на нём не прочитать. Нижнюю
           границу ролика Task 64 растворяет той же маской, что и кадр. */
        '<div class="lumen-hero__trailer"></div>' +
        '<div class="lumen-hero__veil lumen-hero__veil--l"></div>' +
        /* Task 21: слой тематической атмосферы — ПОСЛЕ вуалей, как в слое
           фона карточки: частицы должны быть видны поверх затемнения.
           Текст героя лежит в соседнем .lumen-hero__text, который идёт
           ниже по DOM, поэтому частицы его не закрывают. */
        '<div class="lumen-fx"></div>' +
        '</div>');
      var text = $('<div class="lumen-hero__text">' +
        '<div class="lumen-hero__meta"></div>' +
        /* Task 25: общий класс .lumen-skeleton — от него плашки получают
           пульсацию в режиме полных анимаций и остаются статичными в
           lite/off (одно правило на все скелетоны плагина, src/30_css.js). */
        '<div class="lumen-hero__sk lumen-hero__sk--meta lumen-skeleton"></div>' +
        '<div class="lumen-hero__logo"></div>' +
        '<div class="lumen-hero__title"></div>' +
        '<div class="lumen-hero__descr"></div>' +
        '<div class="lumen-hero__sk lumen-hero__sk--descr lumen-skeleton"></div>' +
        '<div class="lumen-hero__sk lumen-hero__sk--short lumen-skeleton"></div>' +
        '<div class="lumen-hero__chips">' +
        '<div class="lumen-hero__status"></div>' +
        '</div>' +
        /* Task 36: место под чипы профилей настроения — последним элементом
           текстового блока. Сам блок наполняет LC.moods (src/49_moods.js):
           нашёл этот узел — кладёт чипы сюда, не нашёл (герой выключен) —
           монтирует свою полосу в корень активности. Пустым узел остаётся,
           когда настройка «Профили настроения» выключена, и тогда его
           снимает правило :empty в src/30_css.js — иначе его отступ сверху
           отодвинул бы текст от низа кадра на ровном месте. */
        '<div class="lumen-hero__moods"></div>' +
        '</div>');
      node.append(text);
      return node;
    }

    /* Герой ещё в документе и его корень не выброшен Lampa. */
    function isMounted() {
      try {
        var el = state && state.node && state.node[0];
        return !!(el && document.body && document.body.contains && document.body.contains(el));
      } catch (e) {
        /* В тестовом окружении document.body нет — считаем смонтированным,
           пока state жив: живой сторож здесь — gen, а не DOM. */
        return !!state;
      }
    }

    function applyMotion() {
      try {
        if (!state) return;
        state.node.removeClass(MOTION_CLASSES).addClass('lumen-motion-' + LC.motionMode());
        /* Task 28: режим мог упасть до lite/off (настройка или автодетект
           слабого ТВ) — играющий ролик обязан уйти вместе с полными
           анимациями. */
        applyTrailer();
      } catch (e) {
        warn('hero: motion failed', e);
      }
    }

    function motionMode() {
      try { return LC.motionMode(); } catch (e) { return 'full'; }
    }

    /* ------------------------------------------------------------------ */
    /* Отмена всего, что может доехать позже.                              */
    /* ------------------------------------------------------------------ */

    function stopTimer(name) {
      if (!state || !state[name]) return;
      try { clearTimeout(state[name]); } catch (e) {}
      state[name] = null;
    }

    /* Гасит предзагрузку кадра и запрос деталей текущего показа. Обработчики
       снимаются (onload/onerror = null) — сеть их больше не вызовет; gen
       остаётся запасной сетью на случай, если колбэк уже в очереди. */
    function cancelPending() {
      if (!state) return;
      stopTimer('loadTimer');
      stopTimer('swapTimer');
      if (state.loader) {
        state.loader.onload = null;
        state.loader.onerror = null;
        state.loader = null;
      }
      if (state.net) {
        try { if (state.net.clear) state.net.clear(); } catch (e) {}
        state.net = null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Task 28: автотрейлер в герое.                                       */
    /*                                                                      */
    /* Плеер — общий с карточкой (LC.trailer.player, src/55_trailer.js): та  */
    /* же беззвучная вставка YouTube с таймаутом ожидания старта и          */
    /* единственным onEnd на все исходы. Здесь — только жизненный цикл       */
    /* вокруг него, и он весь держится на трёх точках:                       */
    /*   - завести таймер (scheduleTrailer) может только onFocus;            */
    /*   - снять всё (cancelTrailer) обязаны onFocus, show(), unmount(),     */
    /*     applyMotion() и applyTrailer();                                   */
    /*   - ничего не пережившего эти точки не остаётся: таймер, запрос       */
    /*     роликов и сам плеер лежат в state и снимаются вместе с ним.       */
    /*                                                                       */
    /* Отдельного сторожа «герой ещё на экране» (как в карточке) здесь нет   */
    /* намеренно: уход с главной Lampa сообщает событием 'activity':start    */
    /* чужой активности, по которому рантайм зовёт LC.hero.detach ->         */
    /* unmount (src/90_runtime.js). В карточке такого события нет вовсе —    */
    /* оттуда и сторож.                                                       */
    /* ------------------------------------------------------------------ */

    function trailerPref() {
      try { return LC.pref ? LC.pref('lumen_hero_trailer', true) !== false : true; } catch (e) { return true; }
    }

    function trailerMode() {
      try {
        if (LC.trailer && typeof LC.trailer.mode === 'function') return LC.trailer.mode();
      } catch (e) { }
      return 'on';
    }

    /* Task 40: тумблер тяжёлых эффектов. Модуля настроек может не быть
       (тесты героя грузят 48_hero.js в одиночку) — тогда ограничения нет,
       как и до Task 40. */
    function fxHeavy() {
      try {
        if (typeof LC.fxHeavy === 'function') return LC.fxHeavy();
      } catch (e) { }
      return true;
    }

    function trailerReady() {
      return trailerAllowed(trailerPref(), motionMode(), trailerMode(), fxHeavy());
    }

    /* ------------------------------------------------------------------ */
    /* Task 21 (фаза 3): тематическая атмосфера кадра главной.             */
    /*                                                                     */
    /* Тема берётся по ключевым словам ДЕТАЛЕЙ фильма (они приезжают тем   */
    /* же запросом, что логотипы), поэтому частицы появляются не раньше,   */
    /* чем фокус постоял на карточке и детали пришли: при быстром листании */
    /* ряда не монтируется ни одного канваса.                              */
    /*                                                                     */
    /* Акцент интерфейса тема здесь НЕ трогает (в отличие от карточки):    */
    /* на главной фокус переходит с фильма на фильм каждые несколько       */
    /* секунд, и перекрашивать весь экран под каждый — мельтешение. Цвет   */
    /* кадра главной остаётся за акцентом от постера (Task 24).            */
    /* ------------------------------------------------------------------ */

    function fxHost() {
      if (!state || !state.node) return null;
      var node = state.node.find('.lumen-fx');
      return node && node.length ? node : null;
    }

    /* Снимает частицы и класс темы. Идемпотентна: на снятом герое и на
       слое без канваса не делает ничего. */
    function clearFx() {
      var host = fxHost();
      if (host) {
        try { if (LC.fx) LC.fx.unmount(host); } catch (e) { warn('hero: fx unmount failed', e); }
      }
      /* LC.themes может не быть только в тестах, где 48_hero.js грузится в
         одиночку: в бандле 53 идёт раньше 48 и модуль есть всегда. */
      if (state && state.node && LC.themes) {
        try { state.node.removeClass(LC.themes.classNames()); } catch (e2) { warn('hero: fx class failed', e2); }
      }
    }

    /* Ставит атмосферу по деталям фильма под фокусом. Зовётся после
       загрузки деталей и при смене настройки «Атмосферы» на лету. */
    function applyFx() {
      if (!state) return;
      clearFx();
      if (!state.details || !LC.themes || !LC.fx) return;
      var theme = null;
      try { theme = LC.themes.forMovie(state.details); } catch (e) { warn('hero: fx theme failed', e); }
      if (!theme) return;
      try { state.node.addClass('lumen-theme--' + theme.id); } catch (e2) { }
      var host = fxHost();
      if (!host) return;
      try {
        LC.fx.mount(host, theme.preset, {
          color: LC.themes.particleColor(theme),
          /* Под играющим автотрейлером частицы стоят: ролик занимает весь
             кадр героя, и рисовать поверх него — двойная работа впустую.
             Ревью Task 64: то же в сжатом состоянии. С Task 64 кадр при
             уходе фокуса в ряды гаснет полностью, слой атмосферы гаснет
             вместе с ним (src/30_css.js), и рисовать в невидимый канвас
             незачем — а это ровно момент шага фокуса по рядам, самый
             занятый на слабом ТВ. Предикат зовётся каждый кадр цикла, и
             когда все слои на паузе, цикл уходит с rAF на таймер раз в
             500 мс (src/52_fx.js, schedule/IDLE_MS). */
          paused: function () { return !!(state && (state.trailer || state.compact)); }
        });
      } catch (e3) {
        warn('hero: fx mount failed', e3);
      }
    }

    /* Снимает всё, что связано с роликом: отложенный старт, незавершённый
       запрос роликов и сам плеер. Идемпотентна — плеер уничтожается через
       свой destroy(), а тот всегда проходит через единственный onEnd. */
    function cancelTrailer() {
      if (!state) return;
      tgen++;
      stopTimer('trailerTimer');
      if (state.trailerNet) {
        try { if (state.trailerNet.clear) state.trailerNet.clear(); } catch (e) { }
        state.trailerNet = null;
      }
      state.trailerCard = null;
      if (state.trailer) {
        var control = state.trailer;
        state.trailer = null;
        try { if (control.destroy) control.destroy(); } catch (e2) {
          warn('hero: trailer destroy failed', e2);
        }
      }
      try { state.node.removeClass('lumen-hero--trailer'); } catch (e3) { }
    }

    /* Запрос роликов. Языков два, как у штатной Lampa (tmdb.js videos,
       API_NOTES_2 §2): сначала язык интерфейса, и только если на нём ничего
       не нашлось — английский. Оба ответа кэшируются Lampa на неделю. */
    function loadTrailer(card, captured) {
      var media = mediaOf(card);
      var lang = langCode();

      function ask(code, next) {
        try {
          if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
          state.trailerNet = Lampa.Api.sources.tmdb.get(
            media + '/' + card.id + '/videos',
            { langs: code },
            function (json) {
              if (tgen !== captured || !state || !isMounted()) return;
              state.trailerNet = null;
              var video = null;
              try {
                if (LC.trailer && typeof LC.trailer.pickTrailer === 'function') video = LC.trailer.pickTrailer(json && json.results);
              } catch (ePick) {
                warn('hero: trailer pick failed', ePick);
              }
              if (video && video.key) { startTrailer(video.key, captured); return; }
              if (next) ask(next, '');
            },
            function () {
              if (tgen !== captured || !state) return;
              state.trailerNet = null;
              if (next) ask(next, '');
            },
            { life: VIDEOS_LIFE }
          );
        } catch (e) {
          warn('hero: trailer request failed', e);
        }
      }

      ask(lang, lang === 'en' ? '' : 'en');
    }

    function startTrailer(key, captured) {
      try {
        if (tgen !== captured || !state || !isMounted()) return;
        if (!trailerReady()) return;
        if (!LC.trailer || typeof LC.trailer.player !== 'function') return;
        var host = state.node.find('.lumen-hero__trailer');
        if (!host || !host.length) return;
        /* Класс ставится по ФАКТУ старта (onStart плеера), а не по его
           созданию: ролик может не заиграть вовсе (нет сети, YouTube
           недоступен), и тогда герой обязан остаться как был. */
        state.trailer = LC.trailer.player(host, key, function () {
          if (tgen !== captured || !state) return;
          try { state.node.addClass('lumen-hero--trailer'); } catch (e) { }
        }, function () {
          if (tgen !== captured || !state) return;
          state.trailer = null;
          try { state.node.removeClass('lumen-hero--trailer'); } catch (e2) { }
        });
      } catch (err) {
        warn('hero: trailer start failed', err);
      }
    }

    /* Отложенный старт для карточки, на которой остановился фокус. Сторож
       тот же, что у акцента: state.pending меняется на каждом фокусе, поэтому
       тик, доехавший после перевода фокуса, выходит первой же строкой. */
    function scheduleTrailer(card) {
      if (!trailerReady()) return;
      var captured = tgen;
      state.trailerTimer = setTimeout(function () {
        if (!state || tgen !== captured) return;
        state.trailerTimer = null;
        if (state.pending !== card) return;
        if (!isMounted()) return;
        /* Настройку и режим анимаций перечитываем в момент старта: за восемь
           секунд их могли поменять. */
        if (!trailerReady()) return;
        loadTrailer(card, captured);
      }, TRAILER_DELAY);
    }

    /* Настройка lumen_hero_trailer переключена на лету: выключение снимает
       играющий ролик, включение ничего не запускает — ролик появится со
       следующей остановки фокуса. Ту же функцию зовёт applyMotion. */
    function applyTrailer() {
      if (!state) return;
      if (trailerReady()) return;
      cancelTrailer();
    }

    /* ------------------------------------------------------------------ */
    /* Отрисовка.                                                          */
    /* ------------------------------------------------------------------ */

    /* Ширина и высота логотипа под его пропорцию. Инлайном, потому что
       пропорция приходит из ответа TMDB, а в таблице стилей её знать
       неоткуда.

       Task 36: от состояния кадра размер больше не зависит — сжатое и
       компактное дают масштаб через transform в CSS, а он раскладку не
       трогает. Значит и пересчитывать инлайн при setCompact не нужно: одна
       пара чисел живёт всё время, пока показана эта карточка.

       Пропорции нет — обе величины стираем, и размер остаётся за рамкой по
       умолчанию из CSS. Пустым style="" узел при этом не становится: фоновая
       картинка на нём есть всегда (ловушка плана 0.2). */
    function applyLogoBox() {
      if (!state || !state.model) return;
      var model = state.model;
      var box = model.logo ? logoBox(model.logoRatio) : null;
      var logo = state.node.find('.lumen-hero__logo');
      logo.css('width', box ? box.w + 'em' : '');
      logo.css('height', box ? box.h + 'em' : '');
    }

    /* Записывает модель в узлы. swap=true — смена карточки (текст уходит и
       возвращается), иначе это дорисовка деталей той же карточки: она
       обязана быть без анимации, иначе герой дёргался бы дважды на каждую
       карточку. В режимах lite/off подмена мгновенная в обоих случаях.

       Найдено живьём (первый круг Task 18): write() обязана брать модель из
       state.model, а не из замыкания. Ответ деталей из кэша Lampa приходит
       СИНХРОННО, ещё до того как сработает отложенная на 180 мс подмена
       текста, — и та возвращала на экран модель без деталей: мета съезжала
       обратно на голый год, а скелетон загорался навсегда. */
    function render(model, swap) {
      if (!state || !model) return;
      var node = state.node;
      state.model = model;

      function write() {
        if (!state || !state.model) return;
        var current = state.model;
        var text = node.find('.lumen-hero__text');
        /* Task 43: рейтинг идёт последним элементом той же строки —
           «2026 · 1:40 · драма · ★ 8.1». Отдельного чипа под него больше нет:
           одна строка muted спокойнее, чем строка плюс плашка, и это ровно
           та же склейка, что в подписи карточки ряда — «2017 · ★ 6.4»
           (src/62_badges.js, decorate).
           Склейка живёт здесь, а не в heroModel: модель собирает мету по
           частям и дополняет её, когда приходят детали (сезоны, жанры), а
           оценка известна сразу из карточки ряда — приклей её в модели, и
           она оказалась бы в середине строки, между годом и жанрами. */
        var metaLine = current.rating ? current.meta.concat(['★ ' + current.rating]) : current.meta;
        node.find('.lumen-hero__meta').text(metaLine.join(' · '));
        node.find('.lumen-hero__title').text(current.title);
        node.find('.lumen-hero__descr').text(current.overview);
        node.find('.lumen-hero__status').text(current.status);
        node.toggleClass('lumen-hero--status', !!current.status);
        node.toggleClass('lumen-hero--pending', !!current.pending);
        /* Скелетон описания нужен, только если описания нет вовсе: в данных
           ряда overview обычно уже есть, и плашки поверх готового текста
           были бы ложным «грузится» (ограничение брифа 3). */
        node.toggleClass('lumen-hero--nodescr', !current.overview);

        /* Второй аргумент emPx — масштаб интерфейса плагина. Здесь он ровно
           1: lumen_scale до текста героя не доходит (см. LOGO_EM выше). */
        var logoUrl = current.logo ? imageUrl(current.logo, logoSizeFor(LC.util.emPx(LOGO_EM * TEXT_ZOOM, 1))) : '';
        var logo = node.find('.lumen-hero__logo');
        /* Пустая строка в background-image оставила бы style="" на узле —
           ловушка из плана 0.2 (пустой атрибут меняет outerHTML). Значение
           'none' валидно и атрибут пустым не делает. */
        logo.css('background-image', logoUrl ? 'url("' + encodeURI(logoUrl) + '")' : 'none');
        node.toggleClass('lumen-hero--logo', !!logoUrl);
        applyLogoBox();

        text.removeClass('is-swapping');
        if (motionMode() === 'full') text.addClass('is-in');
      }

      if (!swap || motionMode() !== 'full') {
        write();
        return;
      }

      var text = node.find('.lumen-hero__text');
      text.removeClass('is-in').addClass('is-swapping');
      var captured = gen;
      stopTimer('swapTimer');
      state.swapTimer = setTimeout(function () {
        if (gen !== captured || !state) return;
        state.swapTimer = null;
        write();
      }, SWAP_MS);
    }

    /* Кроссфейд кадра: новый URL грузится в скрытый слой, и только после
       onload слои меняются местами. Пока кадр не пришёл, на экране остаётся
       предыдущий — «фон не мигает» (ограничение брифа 1).

       Task 40: при выключенных тяжёлых эффектах второй полноэкранный слой не
       используется вовсе — кадр подменяется в том, что уже показан. Кроссфейд
       героя это две картинки во весь экран одновременно: пока идёт переход
       (transition:opacity .6s у .lumen-hero__bg, src/30_css.js), композитор
       держит оба слоя, а фокус на главной переезжает каждые несколько секунд.
       Правило transition в таблице стилей тоже стоит под body.lumen-fx-heavy,
       поэтому подмена здесь мгновенная, без полупрозрачности.

       Task 64: слой — <img>, поэтому кадр ставится атрибутом src, а не
       background-image. Второго сетевого запроса это не добавляет: тот же
       адрес только что дотянул предзагрузчик из loadFrame, и <img> берёт его
       из кэша ресурсов. Порядок тот же, что и был: src ставится ТОЛЬКО
       здесь, то есть уже после того, как байты доехали (а при живом decode()
       — и после декодирования), поэтому смена src не показывает пустой
       слой. */
    function swapFrame(url, blur) {
      if (!state) return;
      var node = state.node;
      var a = node.find('.lumen-hero__bg--a');
      var b = node.find('.lumen-hero__bg--b');
      var activeIsA = a.hasClass('is-active');
      if (!fxHeavy()) {
        /* Слой, который уже на экране; на первом кадре карточки активного
           ещё нет — тогда это всегда --a, и --b остаётся пустым навсегда. */
        var only = activeIsA ? a : (b.hasClass('is-active') ? b : a);
        only.attr('src', url);
        only.addClass('is-active');
        only.toggleClass('lumen-hero__bg--blur', !!blur);
        state.frameUrl = url;
        return;
      }
      var next = activeIsA ? b : a;
      var prev = activeIsA ? a : b;
      next.attr('src', url);
      next.addClass('is-active');
      prev.removeClass('is-active');
      /* Метку получает ТОЛЬКО приходящий слой, и только он. С уходящего её
         не снимают намеренно: в этот момент он ещё непрозрачен — переход
         opacity .6s только начинается (src/30_css.js, .lumen-hero__bg под
         body.lumen-fx-heavy), — а наезд снялся бы мгновенно и без перехода,
         и зритель первые сотни миллисекунд видел бы размытый постер,
         скачком ужавшийся на 10 %. Это ровно та жалоба, которую Task 52
         лечит, только перенесённая на уходящий слой. Состояние от этого не
         портится: когда этот слой станет приходящим, toggleClass выставит
         ему метку заново — по его собственному кадру. */
      next.toggleClass('lumen-hero__bg--blur', !!blur);
      state.frameUrl = url;
    }

    /* Task 64: подложку LQIP держат до первого ПОКАЗАННОГО кадра — дальше
       она лежит под непрозрачной картинкой и стоит только памяти.
       Освобождение отложено: кадр проявляется переходом opacity (до 600 мс у
       кроссфейда с тяжёлыми эффектами), и снять подложку в тот же миг
       значило бы показать сквозь полупрозрачный кадр голый фон. 900 мс —
       этот максимум плюс запас.
       Отсюда и честная форма утверждения о памяти: 202 800 байт подложки
       живут от начала её загрузки до 900 мс ПОСЛЕ показа кадра, то есть всё
       время, пока едет w1280, плюс эти 900 мс. Если кадр не доехал вовсе
       (onerror, таймаут без байтов), эта функция не зовётся и подложка
       остаётся на экране до следующего показанного кадра или до unmount —
       так и задумано: пустой герой хуже размытого.
       removeAttr, а не src = '': пустой src в старых движках это запрос к
       адресу самой страницы. */
    var LQIP_FREE = 900;
    function releaseLqip() {
      if (!state || !state.lqipUrl) return;
      var captured = gen;
      stopTimer('lqipTimer');
      state.lqipTimer = setTimeout(function () {
        if (gen !== captured || !state) return;
        state.lqipTimer = null;
        state.lqipUrl = '';
        try {
          var lqip = state.node.find('.lumen-hero__lqip');
          lqip.removeClass('is-active');
          lqip.removeAttr('src');
        } catch (e) {}
      }, LQIP_FREE);
    }

    /* Предзагрузка кадра фокусной карточки. Кадра нет — берём постер и
       помечаем слой для размытия (экран 22 брифа: композиция не меняется).
       Тот же URL повторно не грузится.

       Режим анимаций 'off' кадр НЕ обновляет вовсе (таблица рисков плана:
       «в режиме motion off герой не обновляет кадр, только текст»). Гейт
       стоит до new Image(): в 'off' дорога не плавность смены слоёв (её и
       так гасит CSS), а сама загрузка и декодирование большого кадра —
       w1280/original на каждую остановку фокуса, поверх кадра, который
       параллельно тянет сама Lampa через Background.change. Пользователь
       слабого ТВ выбирает 'off' именно ради этого. */
    function loadFrame(model, captured) {
      if (!state) return;
      if (motionMode() === 'off') return;
      var blur = false;
      var path = model.backdrop;
      if (!path) { path = model.poster; blur = true; }
      if (!path) return;

      /* Task 38: у «размытого» варианта размер намеренно крошечный. Блюр
         фильтром снят (src/30_css.js, .lumen-hero__bg--blur), и мягкость теперь
         даёт сам апскейл: w92 — 92 px по ширине, растянутые cover на весь
         кадр героя, то есть больше чем в двадцать раз. Заодно это самый
         дешёвый кадр, который герой вообще грузит. */
      var url = imageUrl(path, blur ? 'w92' : sizeFor(screenWidth()));
      if (!url || url === state.frameUrl) return;

      /* Task 64: LQIP — тот же backdrop в w300. Слой под кадрами, показ без
         ожидания: у кадра 16:9 это 300 × 169, то есть 0.05 Мпикс и 202 800
         байт растра (naturalWidth × naturalHeight × 4, прочитано на живом
         стенде 2026-09-21 на кадре /1CIaRYKf3zg2Xyce1CSfCMg2Vfw.jpg; высота
         зависит от пропорции кадра, TMDB масштабирует по ширине). Доезжает
         и декодируется он заметно раньше w1280 — у того 1280 × 720 и
         3 686 400 байт.
         Условие показа — «на экране ещё нет НИ ОДНОГО кадра»: state.frameUrl
         заполняется в swapFrame, то есть в момент показа. Обычно это ровно
         один раз, на первой карточке под фокусом. Но если фокус успел уйти
         раньше, чем доехал w1280, подложка переедет на новую карточку вместе
         с кадром — и это правильнее, чем держать под пустым экраном кадр
         фильма, с которого фокус уже ушёл; лишний запрос w300 ограничен той
         же задержкой DELAY, что и сам кадр (при листании без остановок не
         уходит ни одного).
         После первого показанного кадра подложка не обновляется вовсе: под
         приходящим кадром лежит непрозрачный предыдущий (фон при смене
         карточки не мигает — ограничение брифа 1), и подложки из-под него не
         видно.
         Варианту «кадра нет, собираем из постера» подложка не нужна вовсе:
         постер и так берётся в w92, что мельче w300. */
      if (!blur && !state.frameUrl) {
        var small = imageUrl(path, 'w300');
        if (small) {
          var lqip = state.node.find('.lumen-hero__lqip');
          lqip.attr('src', small);
          lqip.addClass('is-active');
          state.lqipUrl = small;
        }
      }

      var loader = new Image();
      /* Task 39: просим WebView не декодировать кадр синхронно на главном
         потоке (свойство decoding, Chrome 65+; движки постарше его просто
         игнорируют). Ставится ДО src: подсказка читается в момент, когда
         загрузка начинается. Так же помечены все остальные предзагрузчики
         плагина — фон карточки, слайдшоу, рулетка. */
      loader.decoding = 'async';
      /* Task 64: тот же высокий приоритет, что и у слоя кадра в разметке —
         запрос делает именно этот предзагрузчик, поэтому подсказка нужна
         здесь. Свойство fetchPriority есть с Chrome 101; на движках постарше
         присваивание просто создаёт неиспользуемое поле объекта и ничего не
         меняет. */
      loader.fetchPriority = 'high';
      var done = false;
      /* Task 47: decode() есть с Chrome 64 (ресёрч §4); на движках постарше
         остаётся прежний путь через onload. */
      var decoding = typeof loader.decode === 'function';

      /* Байты кадра доехали? Единственный признак, которому можно верить,
         когда decode() отвергнут или не доехал вовсе: complete значит
         «загрузка завершилась», naturalWidth > 0 — «завершилась картинкой,
         а не ошибкой». */
      function loaded() {
        return !!(loader.complete && loader.naturalWidth);
      }

      /* Уборка стоит ЗА гардом поколения намеренно: stopTimer работает по
         текущему state, а промис decode() отменить нечем — он доезжает сюда
         уже после show() следующей карточки, и снятый здесь loadTimer был бы
         таймером её кадра, а не нашего. Свой таймер устаревшего вызова к
         этому моменту уже снят cancelPending() из show(). */
      function finish(ok) {
        if (done) return;
        done = true;
        loader.onload = null;
        loader.onerror = null;
        if (gen !== captured || !state || !isMounted()) return;
        stopTimer('loadTimer');
        state.loader = null;
        /* Кадр не пришёл — на экране остаётся предыдущий: пустой герой
           хуже устаревшего кадра, а следующий фокус всё равно его сменит. */
        if (!ok) return;
        try {
          swapFrame(url, blur);
        } catch (e) {
          warn('hero: frame failed', e);
        }
        releaseLqip();
      }

      function shown() { finish(true); }

      loader.onload = function () { if (!decoding) shown(); };
      loader.onerror = function () { finish(false); };
      state.loader = loader;
      /* Страховочный таймаут. Решает по тому же признаку, что и неудачный
         decode(): байты есть — показываем (декодирует браузер при
         отрисовке), нет — оставляем предыдущий кадр. Через него же
         показывается кадр, когда decode() не резолвится вовсе: в скрытой
         вкладке Chromium картинки не растеризует, и промис висит без
         исхода (замер координатора на стенде 2026-09-21; WebView телевизора
         уходит в hidden на скринсейвере и при переключении приложения). */
      state.loadTimer = setTimeout(function () { finish(loaded()); }, LOAD_TIMEOUT);
      loader.src = url;
      /* Task 47: onload значит «байты пришли», а не «картинку можно
         показать»: декодирование в этот момент ещё впереди и на слабом ТВ
         происходит внутри растеризации, тайл за тайлом (at-raster decode,
         ресёрч §1.4 — это и видно как чёрные полосы на кадре). decode()
         резолвится, когда кадр уже декодирован и вставляется без
         синхронной работы.
         Реджект здесь НЕ бывает сменой src (частый случай в каруселях,
         ресёрч §4): у каждого вызова свой new Image, а src присваивается
         ровно один раз, выше. Значит остаются битые данные, упавший запрос
         и движок, отвергающий decode() без причины, — и решает единственный
         проверяемый признак, доехали ли байты. */
      if (decoding) {
        try {
          var decoded = loader.decode();
          if (decoded && typeof decoded.then === 'function') decoded.then(shown, function () { finish(loaded()); });
          else decoding = false;
        } catch (e) {
          /* decode() бросил синхронно — остаёмся на onload. */
          decoding = false;
        }
      }
    }

    /* Детали карточки: описание целиком, длительность/сезоны, жанры,
       логотипы, анонс серии. Один запрос на карточку, кэш сутки. */
    function loadDetails(card, captured) {
      try {
        if (!window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb) return;
        var req = detailsRequest(mediaOf(card), card.id, langCode());
        state.net = Lampa.Api.sources.tmdb.get(
          req.url,
          req.params,
          function (json) {
            if (gen !== captured || !state || !isMounted()) return;
            state.net = null;
            state.details = json || null;
            var model = heroModel(card, state.details, words());
            /* Пустой ответ — тот же исход, что и ошибка: ждать больше нечего,
               скелетон гасим (иначе он горел бы до следующей карточки). */
            if (!state.details) model.pending = false;
            render(model, false);
            /* Task 21: атмосфера считается по ключевым словам из этого же
               ответа. В lite/off и при настройке «Выключены» вызов не
               создаёт ни канваса, ни кадрового цикла (src/52_fx.js). */
            applyFx();
            /* Кадра не было в данных ряда, но он есть в деталях — только
               тогда грузим второй раз: лишний большой кадр на ТВ дорог. */
            if (!state.frameUrl && model.backdrop) loadFrame(model, captured);
          },
          function () {
            if (gen !== captured || !state || !isMounted()) return;
            state.net = null;
            /* Деталей не будет — снимаем скелетон, оставляя то, что дала
               карточка ряда (заголовок, год, краткое описание). Флаг гасим в
               самой модели, а не классом на узле: отложенная подмена текста
               (swapTimer) перерисовала бы её и вернула скелетон. */
            var fallback = heroModel(card, null, words());
            fallback.pending = false;
            render(fallback, false);
          },
          { life: req.life }
        );
      } catch (e) {
        warn('hero: details failed', e);
      }
    }

    /* Показать героя для карточки. Вызывается только из отложенного тика
       обработчика фокуса (или из mount для уже сфокусированной карточки). */
    function show(card) {
      if (!state || !card) return;
      try {
        var captured = ++gen;
        cancelPending();
        state.shownId = card.id;
        state.details = null;
        state.model = null;
        /* Task 21: атмосфера прошлой карточки уходит сразу — иначе снег с
           рождественского фильма висел бы над кадром следующего, пока не
           придут его детали. */
        clearFx();
        var model = heroModel(card, null, words());
        render(model, true);
        loadFrame(model, captured);
        loadDetails(card, captured);
      } catch (e) {
        warn('hero: show failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Слушатель фокуса.                                                   */
    /* ------------------------------------------------------------------ */

    /* Позиция ряда карточки среди рядов главной. Считается по самой
       карточке, а не подпиской Lampa.Listener('line'): вторая подписка жила
       бы параллельно слушателю фокуса и давала бы второй источник правды о том,
       какой ряд сейчас в фокусе. -1 — ряд не найден (мини-герой сетки). */
    function rowIndex(el) {
      try {
        var line = $(el).closest('.items-line');
        if (!line || !line.length) return -1;
        return line.index();
      } catch (e) {
        return -1;
      }
    }

    /* Сжатое состояние: кадр уезжает вверх до половины экрана
       (design-spec-main §0.2, раскадровка 23б), а освободившуюся высоту
       забирают ряды — они поднимаются под самый кадр.

       Правка пользователя 2026-09-17 (второй круг): класс на корне
       активности (.lumen-rows-up) — это и есть та передача места. Раньше
       сжимался только кадр, и под ним оставалась пустая полоса в половину
       экрана. Второго признака «фокус ниже первого ряда» не заводим: и кадр,
       и ряды переключает одна эта функция, а слушателей прокрутки у нас
       по-прежнему нет.

       Task 36: кроме двух классов функция не делает ничего. Всю геометрию
       обоих состояний задаёт таблица стилей, и переключение класса не
       читает и не пишет ни одного размера — потому переход и состоит теперь
       из одних transform (кадр, текст, логотип, область рядов) и одного
       opacity (чипы настроения), без единого свойства раскладки. */
    function setCompact(on) {
      if (!state) return;
      /* Ревью Task 64: то же состояние нужно и слою атмосферы — читать класс
         с узла на каждом кадре цикла частиц дороже, чем держать флаг. */
      state.compact = !!on;
      state.node.toggleClass('lumen-hero--compact', on);
      try { state.root.toggleClass('lumen-rows-up', on); } catch (e) {}
    }

    /* Фокус ниже первого ряда — герой сжат. Мини-герой сетки сжат всегда. */
    function updateCompact(el) {
      if (!state || state.fixedCompact) return;
      var index = rowIndex(el);
      if (index < 0) return;
      setCompact(index > 0);
    }

    /* Адрес УЖЕ отрисованного постера карточки: он лежит в кэше браузера, и
       слой перехода показывается без загрузки. */
    function posterOf(el) {
      try {
        return $(el).find('.card__img').attr('src') || '';
      } catch (e) {
        return '';
      }
    }

    /* Task 29: карточка, с которой уходят в полную карточку.

       Task 37: здесь запоминается САМ УЗЕЛ, а не его прямоугольник. Прежний
       вариант звал el.getBoundingClientRect() на каждом переводе фокуса —
       то есть заставлял браузер считать раскладку прямо посреди обработки
       нажатия стрелки, на каждое нажатие. Прямоугольник нужен ровно одному
       потребителю и ровно один раз — слою перехода в момент открытия
       карточки, и снимает его теперь LC.transition.open (src/67_transition.js).
       Узел к тому моменту может быть уже оторван от документа (ряд
       перестроился) — у оторванного узла все размеры нулевые, и переход на
       таком прямоугольнике просто не показывается. */
    function rememberFocus(el, card) {
      var poster = posterOf(el);
      if (!poster) { last = null; cancelBigPoster(); return; }
      last = { id: card.id, poster: poster, node: el };
      scheduleBigPoster(card.id, poster);
    }

    /* Task 37: повторное событие фокуса на ТОЙ ЖЕ карточке. Таймеры оно
       трогать не должно (иначе идущий ролик гас бы на ровном месте), но
       источник перехода обновить обязано: в шаблоне карточки Lampa
       (app.min.js:2510) у <img class="card__img"> стоит заглушка
       ./img/img_load.svg, а настоящий постер подставляется позже, при
       появлении карточки на экране (onVisible, app.min.js:20938). Вернулись
       на карточку, которая на первом фокусе ещё не догрузила постер, — и в
       переход ушла бы заглушка. */
    function refreshFocusSource(el, card) {
      var poster = posterOf(el);
      if (!poster) return;
      if (last && String(last.id) === String(card.id) && last.poster === poster) return;
      rememberFocus(el, card);
    }

    /* Показался бы вообще переход «постер → кадр», ради которого грузится
       крупная версия. Обе проверки — те же, что делает сам LC.transition
       перед показом слоя. */
    function bigPosterWanted() {
      try {
        if (LC.motionMode && LC.motionMode() !== 'full') return false;
        return LC.pref ? LC.pref('lumen_transition', true) !== false : false;
      } catch (e) {
        return false;
      }
    }

    /* Гасит незавершённую предзагрузку крупного постера. Обработчики
       снимаются — сеть в снятый или сменившийся герой не вернётся; саму
       картинку браузер при этом спокойно дотянет в кэш, и на следующем
       фокусе той же карточки она окажется готовой мгновенно. Тот же приём,
       что у предзагрузки кадра (cancelPending). */
    function cancelBigPoster() {
      if (!state) return;
      stopTimer('bigTimer');
      if (state.bigLoader) {
        state.bigLoader.onload = null;
        state.bigLoader.onerror = null;
        state.bigLoader = null;
      }
    }

    /* Task 27 (довесок): крупная версия постера для слоя перехода.

       Запрос откладывается на ту же задержку, что и смена героя: при быстром
       листании ряда ни одной лишней картинки не уходит — грузится постер той
       карточки, на которой остановились. Готовый адрес кладётся в last.big,
       откуда его берёт LC.transition; не успела загрузиться или упала —
       переход идёт на прежнем w300, как и раньше, и ничего не ждёт. */
    function scheduleBigPoster(id, poster) {
      cancelBigPoster();
      /* Крупный постер нужен ровно одному потребителю — слою перехода. Его
         нет (настройка выключена) или он всё равно не покажется (режим
         анимаций не 'full', src/67_transition.js) — сеть не тратим. */
      if (!bigPosterWanted()) return;
      var url = bigPoster(poster);
      if (!url) return;
      state.bigTimer = setTimeout(function () {
        if (!state) return;
        state.bigTimer = null;
        if (!last || String(last.id) !== String(id)) return;
        var img = new Image();
        /* Task 39: декодирование вне главного потока (см. loadFrame). */
        img.decoding = 'async';
        state.bigLoader = img;
        img.onload = function () {
          if (!state || state.bigLoader !== img) return;
          state.bigLoader = null;
          if (last && String(last.id) === String(id)) last.big = url;
        };
        img.onerror = function () {
          if (!state || state.bigLoader !== img) return;
          state.bigLoader = null;
        };
        img.src = url;
      }, DELAY);
    }

    /* Правка пользователя 2026-09-17 (третий круг): акцент и подкраска фона
       берутся с карточки, на которой ОСТАНОВИЛИСЬ, — отдельным таймером на
       ACCENT_DELAY. Сторож тот же, что у смены героя: state.pending меняется
       на каждом фокусе, поэтому отложенный тик, доехавший после перевода
       фокуса, выходит первой же строкой и ни одного расчёта не запускает.
       Своего поколения (gen) здесь нет намеренно: gen поднимается на каждом
       show(), то есть уже через 350 мс покоя, — трёхсекундный тик по нему
       не пережил бы даже собственную карточку. */
    function scheduleAccent(card) {
      stopTimer('accentTimer');
      state.accentTimer = setTimeout(function () {
        if (!state) return;
        state.accentTimer = null;
        if (state.pending !== card) return;
        if (!isMounted()) return;
        try {
          if (LC.accent && typeof LC.accent.applyFor === 'function') LC.accent.applyFor(card);
        } catch (e) {
          warn('hero: accent failed', e);
        }
      }, ACCENT_DELAY);
    }

    function onFocus(el) {
      if (!state) return;
      var card = el.card_data;
      if (!card || card.id == null) return;

      /* Task 37: фокус не сменился — обновляем только источник перехода и
         уходим. Ни один таймер (350 мс кадр, 3 с акцент, 8 с ролик) не
         перезапускается: событие на той же карточке шлёт сама Lampa, когда
         возвращает фокус на место. Цепочка: Controller.collectionFocus зовёт
         SpatialNavigator.focus на прежнем элементе (app.min.js:46481), тот
         шлёт своё событие 'focus' (vender/navigator/navigator.js:657-684),
         мост Navigator.follow('focus') переводит его в Controller.focus
         (app.min.js:56069-56071), и уже он шлёт 'hover:focus' (:46438).
         Ролик, начавший играть, от такого возврата обрываться не должен. */
      if (state.focusEl === el) { refreshFocusSource(el, card); return; }
      state.focusEl = el;

      updateCompact(el);
      rememberFocus(el, card);

      state.focusAt = Date.now();
      state.pending = card;
      stopTimer('timer');
      /* Акцент ждёт свои 3 с независимо от того, меняется герой или нет:
         вернулись на ту же карточку — цвет у неё уже стоит, и applyFor на
         том же постере возьмёт его из кэша, не пересобирая стилей. */
      scheduleAccent(card);
      /* Task 28: любой перевод фокуса снимает играющий ролик и заводит отсчёт
         заново. Сравнение с trailerCard оставлено и после Task 37: гард выше
         ловит повторное событие на ТОМ ЖЕ УЗЛЕ, а этот — ту же карточку на
         другом узле (ряд перестроился, карточка приехала заново). Иначе
         идущий ролик гас бы на ровном месте. */
      if (state.trailerCard !== card) {
        cancelTrailer();
        state.trailerCard = card;
        scheduleTrailer(card);
      }
      /* Тот же фильм под фокусом (возврат на ту же карточку, перерисовка
         ряда) — ни кадра, ни запроса. */
      if (state.shownId === card.id) return;

      var captured = gen;
      state.timer = setTimeout(function () {
        if (gen !== captured || !state) return;
        state.timer = null;
        if (!isMounted()) return;
        if (state.pending !== card) return;
        if (!shouldUpdate(state.shownId, card.id, Date.now() - state.focusAt, DELAY)) return;
        show(card);
      }, DELAY);
    }

    /* Цель события — сама карточка, поэтому проверяем её собственные классы,
       а не ищем карточку среди предков: 'hover:focus' Lampa шлёт ровно на тот
       элемент, на который переводит фокус (Utils.trigger(target,
       'hover:focus'), app.min.js:46438). В корне активности фокус получают и
       не-карточки (кнопки шапки, пункты меню) — они отсеиваются здесь. */
    function onFocusEvent(e) {
      if (!state) return;
      try {
        var el = e && e.target;
        if (!el || !el.classList || !el.classList.contains('card')) return;
        onFocus(el);
      } catch (err) {
        warn('hero: focus listener failed', err);
      }
    }

    /* Task 37: фокус ловится нативным слушателем в фазе ЗАХВАТА на корне
       активности.

       Почему захват. Событие 'hover:focus' создаётся Lampa как
       initEvent(name, false, true) (Utils.trigger, app.min.js:4497-4500),
       второй аргумент — bubbles, то есть событие НЕ всплывает:
       ни $(root).on('hover:focus', '.card', …), ни слушатель на фазе
       всплытия его не увидят — замер на живой Lampa 2026-09-18 дал ноль
       срабатываний у делегированного jQuery-обработчика и срабатывание у
       нативного в захвате. Вниз по дереву, к цели, событие проходит всегда.
       Тот же приём и по той же причине — у меню карточки ('hover:long',
       src/63_cardmenu.js).

       Почему не MutationObserver, как было раньше. Наблюдатель стоял на
       attributeFilter ['class'] + subtree, то есть на КАЖДУЮ мутацию класса
       во всей активности. Одно нажатие стрелки на ТВ даёт их десятки:
       Controller.focus (app.min.js:46437-46446) снимает класс focus со ВСЕЙ
       коллекции навигации, обходя её в цикле, и ставит его на цель
       (removeClass(['focus']) + toggleClass, :46441-46442, сам обход —
       :46422-46429; мутаций столько же, сколько элементов в коллекции, то
       есть десятки). Сверх того колбэк срабатывал на любой наш собственный
       класс, поставленный внутри того же корня (узел героя лежит в нём),
       снова находил карточку с классом focus и повторял весь onFocus — а
       значит и перезапускал таймеры акцента и трейлера. Слушатель события
       даёт ровно один вызов на один перевод фокуса.

       Побочное улучшение: те мутации класса стоят под if
       (Platform.screen('tv')) (app.min.js:46440), то есть НЕ на ТВ их не было
       вовсе — прежний наблюдатель фокус там не ловил в принципе, и герой на
       десктопе жил только тем, что показывал showFocused. Слушатель события
       работает на всех платформах одинаково. */
    function listenFocus(root) {
      try {
        var node = root && root[0];
        if (!node || typeof node.addEventListener !== 'function') return;
        state.focusHandler = onFocusEvent;
        node.addEventListener('hover:focus', state.focusHandler, true);
      } catch (e) {
        warn('hero: listen failed', e);
      }
    }

    /* Снятие слушателя. Ссылка на обработчик и корень берутся из снимаемого
       состояния: unmount обнуляет state ДО уборки, а removeEventListener
       обязан получить ту же функцию и ту же фазу, что и подписка. */
    function unlistenFocus(s) {
      if (!s || !s.focusHandler) return;
      try {
        var node = s.root && s.root[0];
        if (node && typeof node.removeEventListener === 'function') {
          node.removeEventListener('hover:focus', s.focusHandler, true);
        }
      } catch (e) {
        warn('hero: unlisten failed', e);
      }
      s.focusHandler = null;
    }

    /* Карточка, которая уже в фокусе на момент монтирования (возврат из
       карточки на главную — Lampa восстанавливает фокус сама, и события
       'hover:focus' при этом не будет: класс focus на карточке уже стоит). */
    function showFocused(root) {
      try {
        var el = root.find('.card.focus');
        if (el && el.length && el[0] && el[0].card_data) {
          updateCompact(el[0]);
          /* Task 37 (ревью): источник перехода «постер → кадр» заводится
             ЗДЕСЬ, а не ждёт события. Фокус Lampa восстанавливает синхронно
             внутри activity.start() — Controller.toggle('content') зовёт
             toggle контроллера с collectionFocus (app.min.js:45441), и это
             происходит ДО Listener.send('activity','start')
             (app.min.js:46027), в обработчике которого мы только монтируем
             героя и вешаем слушатель. Событие 'hover:focus' к тому моменту
             уже прошло мимо, а слою перехода (src/67_transition.js) источник
             нужен сразу: без этой строки «главная → OK → Назад → OK на той
             же карточке» открывалось бы без перехода. Раньше дыру случайно
             закрывал MutationObserver — он ловил классы, которые ставит наш
             же show(), и повторял onFocus. state.focusEl тут намеренно НЕ
             ставится: первое настоящее событие фокуса должно пройти полный
             путь и завести таймеры. */
          rememberFocus(el[0], el[0].card_data);
          show(el[0].card_data);
        }
      } catch (e) {}
    }

    /* ------------------------------------------------------------------ */
    /* Монтирование и снятие.                                              */
    /* ------------------------------------------------------------------ */

    /* root — корень экрана. Сейчас это активность главной
       (e.object.activity.render()); opts оставляют модуль пригодным и для
       другого экрана (экран франшизы, Task 25):
         hostClass — класс корня, которым CSS сдвигает содержимое под героя
                     (по умолчанию 'lumen-main');
         compact   — герой сжат всегда и индекс ряда не смотрит. */
    /* Правка пользователя 2026-09-17 (п.2): «Герой: выключен». Герой не
       монтируется вовсе — ни узла, ни слушателя фокуса, ни запросов деталей, а
       без класса .lumen-main на активности к рядам не применяются и наши
       правила размера: главная выглядит штатной Lampa, ряды занимают экран
       целиком. Чипы профилей настроения (src/49_moods.js) при этом остаются
       на экране, но уже НЕ «независимо от героя», как было до Task 36: при
       живом кадре их место — слот .lumen-hero__moods внутри него, и без
       кадра LC.moods монтирует их собственным узлом в корень активности.
       Раскладка опускает под их полосу ряды. Смена настройки на живой
       главной перемонтирует и то и другое — порядок держит
       LC.applyHeroSizePref (src/90_runtime.js). */
    function sizeOff() {
      try { return LC.pref ? LC.pref('lumen_hero_size', 'large') === 'off' : false; } catch (e) { return false; }
    }

    /* ------------------------------------------------------------------ */
    /* Task 49: штатный фон Lampa под нашей главной.                       */
    /* ------------------------------------------------------------------ */

    /* Фон Lampa — .background с тремя канвасами внутри (её разметка,
       vendor/lampa/app.min.js:31225). Промоутятся по CSS все четыре узла:
       fixed на весь экран + will-change:opacity (vendor/lampa/css/
       app.css:2320-2344); рисуемых поверхностей при этом три — у корня
       своего содержимого нет, это пустой div. Замер координатора на стенде
       2026-09-21 (960×540@2): полноэкранных слоёв на главной было 9, стало
       5. Оценка их цены — 8.29 МБ на полноэкранный слой при бюджете 96 МБ
       на устройстве с памятью меньше 2000 МиБ
       (docs/research/2026-09-21-webview-perf.md §1.1); это именно оценка,
       не замер. На нашей главной фона не видно — сверху кадр героя, ниже
       заливка P.bg. Гасит его правило body.lumen-main-on .background
       (src/30_css.js).

       Второе, и это измеримая часть задачи, — загрузка. В card.onFocus
       каждого ряда Lampa зовёт
       Background.change(Utils.cardImgBackground(card_data))
       (vendor/lampa/app.min.js:52722), а cardImgBackground отдаёт кадр
       w1280, если включена настройка «Фон», background_type равен 'poster'
       и окно шире 790 (там же:4298-4308; иначе — постер размером из
       настройки poster_size, по умолчанию w300 — Api.img без размера,
       :19739-19745 и :47719 — либо пустая строка). Через секунду после
       остановки фокуса change грузит его
       (load, :31484-31514) и читает пиксели канвасом — Color.get(img) на
       :31496, внутри getImageData (:5210) — на главном потоке. Всё это ради
       картинки, которой на экране не будет.

       Настройка Lampa «Фон» (Storage 'background') не трогается намеренно:
       это выбор пользователя на все остальные экраны, а мы лишь не рисуем
       фон на своём. */
    var BODY_ON = 'lumen-main-on';
    /* Корень нашей главной. Тот же класс — значение hostClass по умолчанию в
       mount: метка на body ставится только под ним. */
    var MAIN_HOST = 'lumen-main';
    /* Оригинал Background.change и наша обёртка — пока она стоит. Оба
       модульные, а не в state: state обнуляется первой строкой unmount, а
       снимать обёртку надо после. */
    var bgOrig = null;
    var bgWrap = null;

    function bodyClasses() {
      try {
        var body = document && document.body;
        return body && body.classList ? body.classList : null;
      } catch (e) {
        return null;
      }
    }

    function markBody(on) {
      var list = bodyClasses();
      if (!list) return;
      try {
        if (on) list.add(BODY_ON);
        else list.remove(BODY_ON);
      } catch (e) {
        warn('hero: body mark failed', e);
      }
    }

    /* change — обычное свойство объекта-литерала Lampa.Background
       (vendor/lampa/app.min.js:31563-31570: {render, change, update, init,
       immediately, theme}), ни Object.freeze, ни defineProperty на нём нет
       (в app.min.js нет ни одного Object.freeze), и зовут его отовсюду
       именно через объект — значит подмена свойства перехватывает все
       вызовы. Внутри обёртки проверяется метка на body, а не сам факт
       монтирования: если чужой плагин переопределит change поверх нашей
       обёртки и оставит её в своей цепочке, она обязана пропускать вызовы
       после ухода с главной. */
    function guardBackground() {
      try {
        var B = window.Lampa && Lampa.Background;
        if (!B || typeof B.change !== 'function') return;
        if (bgWrap && B.change === bgWrap) return;
        var orig = B.change;
        bgOrig = orig;
        bgWrap = function () {
          var list = bodyClasses();
          if (list && list.contains(BODY_ON)) return;
          return orig.apply(this, arguments);
        };
        B.change = bgWrap;
      } catch (e) {
        warn('hero: background guard failed', e);
      }
    }

    /* Возвращаем оригинал ТОЛЬКО если в свойстве всё ещё наша обёртка: иначе
       поверх нас встал кто-то ещё, и запись туда нашего оригинала стёрла бы
       чужую работу. Ссылки обнуляем в любом случае — второй попытки не
       будет. */
    function unguardBackground() {
      try {
        if (!bgWrap) return;
        var B = window.Lampa && Lampa.Background;
        if (B && B.change === bgWrap) B.change = bgOrig;
      } catch (e) {
        warn('hero: background unguard failed', e);
      }
      bgOrig = null;
      bgWrap = null;
    }

    function mount(root, opts) {
      try {
        if (!root || !root.length) return;
        if (sizeOff()) { unmount(); return; }
        /* Тот же корень — героя не пересобираем. На пути «карточка → назад»
           этот гард НЕ срабатывает: уход вглубь виден рантайму как 'start'
           чужой активности, и detach() уже снял героя — на возврате он
           строится заново (кадр при этом моргает; вынесено долгом фазы 3).
           Гард закрывает другое: повторный mount() того же корня без
           промежуточного detach — activate() -> mountCurrent() и следом
           событие 'start' той же главной, либо два 'start' подряд. Без него
           на один экран вешался бы второй слушатель фокуса. */
        if (state && state.root && state.root[0] === root[0]) return;
        unmount();
        opts = opts || {};

        var node = buildNode();
        root.prepend(node);
        var hostClass = opts.hostClass || MAIN_HOST;
        root.addClass(hostClass);

        gen++;
        state = {
          root: root,
          node: node,
          hostClass: hostClass,
          /* Task 37: слушатель 'hover:focus' на корне и узел карточки, для
             которой фокус уже обработан (гард от повторного события). */
          focusHandler: null,
          focusEl: null,
          timer: null,
          swapTimer: null,
          loadTimer: null,
          accentTimer: null,
          loader: null,
          net: null,
          shownId: null,
          details: null,
          model: null,
          pending: null,
          focusAt: 0,
          frameUrl: '',
          /* Task 64: адрес кадра-подложки (w300), чтобы тот же не ставился
             дважды. */
          lqipUrl: '',
          /* Task 64: отложенное освобождение подложки, см. releaseLqip. */
          lqipTimer: null,
          /* Task 28: отложенный старт ролика, его запрос, сам плеер и
             карточка, которой он принадлежит. */
          trailerTimer: null,
          trailerNet: null,
          trailer: null,
          trailerCard: null,
          fixedCompact: !!opts.compact,
          /* Ревью Task 64: сжат ли герой сейчас — для предиката паузы
             частиц (см. applyFx). Мини-герой сетки сжат с самого начала. */
          compact: !!opts.compact
        };
        if (opts.compact) setCompact(true);
        /* Task 49: метка — только под нашей главной, и это не формальность.
           hostClass у другого экрана (франшиза, см. комментарий к mount
           выше) означает и другой корень CSS: правило .lumen-main
           {background-color} на него не действует, а фон Lampa мы бы уже
           погасили — экран остался бы на чёрном.
           Метка ставится раньше обёртки: та читает её при каждом вызове, а
           первый может прийти уже из showFocused ниже. */
        if (hostClass === MAIN_HOST) {
          markBody(true);
          guardBackground();
        }
        applyMotion();
        listenFocus(root);
        showFocused(root);
        /* Task 40: замер первого кадра ГЛАВНОЙ. Точка последняя в mount()
           намеренно — как и у карточки в src/90_runtime.js: замер обязан
           включать всю нашу работу по экрану, а не её начало. Сам модуль
           решает, мерить ли (режим «Авто», не Tizen/webOS, не больше трёх
           замеров за запуск — src/68_perf.js); в тестах героя LC.perf нет
           вовсе, поэтому вызов защищён проверкой и try/catch. */
        try { if (LC.perf && LC.perf.track) LC.perf.track('main'); } catch (ePerf) {}
      } catch (e) {
        warn('hero: mount failed', e);
      }
    }

    /* Смонтировать героя, если сейчас открыта главная. Нужен включению
       плагина из настроек: возврата из настроек в главную Lampa событием
       'activity' не сопровождает, и без этой точки герой появился бы
       только после перехода куда-нибудь и обратно. */
    function mountCurrent() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main') return;
        if (!act.activity || typeof act.activity.render !== 'function') return;
        mount(act.activity.render());
      } catch (e) {
        warn('hero: mountCurrent failed', e);
      }
    }

    /* Снять героя целиком: узел, класс корня, слушатель фокуса, все таймеры,
       предзагрузка кадра и незавершённый запрос деталей. Идемпотентна. */
    function unmount() {
      if (!state) return;
      /* Task 28: ролик снимается ПЕРВЫМ — пока state ещё жив: его плеер,
         запрос роликов и отложенный старт живут именно там, а cancelTrailer
         на пустом state не делает ничего. */
      cancelTrailer();
      /* Task 49: метка снимается ПЕРВОЙ — пока она стоит, обёртка глушит
         Background.change, а фон за пределами главной обязан работать сразу
         же, даже если вернуть оригинал не выйдет (чужое переопределение). */
      markBody(false);
      unguardBackground();
      var s = state;
      state = null;
      /* Task 29: карточки под фокусом больше нет — переход «постер → кадр»
         остаётся без источника и не показывается. */
      last = null;
      gen++;
      unlistenFocus(s);
      var timers = ['timer', 'swapTimer', 'loadTimer', 'accentTimer', 'bigTimer', 'trailerTimer', 'lqipTimer'];
      for (var i = 0; i < timers.length; i++) {
        try { if (s[timers[i]]) clearTimeout(s[timers[i]]); } catch (eT) {}
      }
      if (s.loader) {
        s.loader.onload = null;
        s.loader.onerror = null;
      }
      /* Task 27 (довесок): предзагрузка крупного постера — такой же
         незавершённый запрос, как кадр героя, и снимается так же. */
      if (s.bigLoader) {
        s.bigLoader.onload = null;
        s.bigLoader.onerror = null;
      }
      try { if (s.net && s.net.clear) s.net.clear(); } catch (eN) {}
      /* Task 21: слой частиц снимается ДО удаления узла героя — свой
         кадровый цикл движок держит, пока смонтирован хоть один слой
         (src/52_fx.js). Самопроверка по выпавшему канвасу сняла бы его и
         так, но лишний кадр после ухода с главной нам не нужен. */
      try {
        var fxGone = s.node.find('.lumen-fx');
        if (LC.fx && fxGone && fxGone.length) LC.fx.unmount(fxGone);
      } catch (eFx) { warn('hero: fx unmount failed', eFx); }
      try { s.node.remove(); } catch (eR) {}
      /* Класс подъёма рядов снимается вместе с хостовым: без героя область
         прокрутки обязана вернуться к штатной раскладке Lampa. */
      try { s.root.removeClass(s.hostClass).removeClass('lumen-rows-up'); } catch (eC) {}
    }

    /* Герой принадлежит этой активности? Для главной его корень — сама
       активность; корень внутри неё (если героя смонтируют в чужой узел
       экрана) тоже считается своим — отсюда проверка closest('.activity'). */
    function ownedBy(render) {
      if (!state || !state.root || !state.root.length) return false;
      if (!render || !render.length) return false;
      if (state.root[0] === render[0]) return true;
      try {
        var act = state.root.closest('.activity');
        return !!(act && act.length && act[0] === render[0]);
      } catch (e) {
        return false;
      }
    }

    /* Вызывается на 'activity':start ЛЮБОЙ активности. Ушли с экрана, где
       живёт герой (вглубь в карточку, в меню, в другой компонент) — снимаем
       его вместе со слушателем: Lampa для покидаемой активности событий не
       шлёт вовсе (раздел 0 плана), и это единственный момент, когда об уходе
       можно узнать. */
    function detach(render) {
      if (!state) return;
      if (ownedBy(render)) return;
      unmount();
    }

    function active() {
      return !!state;
    }

    /* Публичная проверка принадлежности: рантайму она нужна на 'destroy',
       где снимать героя можно ТОЛЬКО если он всё ещё принадлежит умирающей
       активности, а не экрану, открытому поверх неё. */
    function owns(render) {
      return ownedBy(render);
    }

    return {
      pickLogo: pickLogo,
      bigPoster: bigPoster,
      mediaOf: mediaOf,
      heroModel: heroModel,
      shouldUpdate: shouldUpdate,
      sizeFor: sizeFor,
      logoSizeFor: logoSizeFor,
      logoBox: logoBox,
      detailsRequest: detailsRequest,
      /* Task 28: правило «можно ли сейчас заводить фоновый ролик в герое» —
         наружу ради теста, применяет его сам модуль (trailerReady). */
      trailerAllowed: trailerAllowed,
      /* Настройка lumen_hero_trailer переключена на лету (src/80_settings.js,
         applyPrefChange): выключение снимает играющий ролик. */
      applyTrailer: applyTrailer,
      /* Task 21: настройка «Атмосферы» переключена на лету (src/80_settings.js,
         applyPrefChange -> LC.applyFxPref). Выключение снимает слой частиц с
         кадра главной, включение считает тему по уже загруженным деталям. */
      applyFx: applyFx,
      mount: mount,
      mountCurrent: mountCurrent,
      detach: detach,
      owns: owns,
      unmount: unmount,
      applyMotion: applyMotion,
      active: active,
      /* Task 29: последняя карточка под фокусом для слоя перехода
         (src/67_transition.js). null — фокуса на ряду не было или герой снят. */
      lastFocus: function () { return last; },
      /* Task 26: детали фильма, которые герой уже загрузил для карточки под
         фокусом (кэш Lampa на сутки). Контекстное меню берёт отсюда
         belongs_to_collection и своего запроса ради одного пункта не делает.
         null — герой снят, детали ещё не пришли или под фокусом другой
         фильм. */
      details: function (id) {
        if (!state || !state.details) return null;
        return state.details.id === id ? state.details : null;
      }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.hero;

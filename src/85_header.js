  /* -------------------------------------------------------------------- */
  /* Отрисовка шапки карточки (Task 5a, рефакторинг). Выделено из            */
  /* 90_runtime.js — тот вырос и смешивал данные карточки, обёртки Lampa,   */
  /* фон, восемь render* шапки, decorate/findRoot, раскладку, motion,       */
  /* toggle, init/boot. Чистая логика данных (isSerial/genres/pgText и      */
  /* остальные хелперы cardinfo) — в 35_cardinfo.js с тестами; здесь только */
  /* сборка DOM+Lampa вокруг неё. Публично наружу — только LC.header.decorate, */
  /* её вызывает Listener 'full' в 90_runtime.js на build/complite.          */
  /* -------------------------------------------------------------------- */

  var isSerial = LC.cardinfo.isSerial;

  function capitalize(str) {
    str = '' + (str || '');
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.capitalizeFirstLetter === 'function') {
        return Lampa.Utils.capitalizeFirstLetter(str);
      }
    } catch (e) { }
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  function getGenres(movie) {
    return LC.cardinfo.genres(movie && movie.genres, capitalize);
  }

  function getPG(movie, root) {
    var parsed = '';
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parsePG === 'function') parsed = Lampa.TMDB.parsePG(movie);
    } catch (e) { }
    var domText = '';
    if (root) {
      try {
        var node = root.find('.full-start__pg');
        if (node.length) domText = node.text();
      } catch (e2) { }
    }
    return LC.cardinfo.pgText(parsed, domText);
  }

  /* Task 5a Step 4: чип «РЕАКЦИЙ» показывается, только если пользователь не
     выключил блок реакций Lampa (та же настройка, что скрывает штатный
     .full-start-new__reactions/.button--reaction — 0.2 «Реакции CUB»). */
  /* Storage.field, а не LC.pref: card_interfice_reactions — тумблер самой
     Lampa с дефолтом true (app.min.js:47927); сама она читает его так же
     (app.min.js:37402). В LC.prefs.LIST этого ключа нет. */
  function reactionsEnabled() {
    try {
      if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.field === 'function') {
        return !!Lampa.Storage.field('card_interfice_reactions');
      }
    } catch (e) { }
    return false;
  }

  function bigNumber(n) {
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.bigNumberToShort === 'function') return Lampa.Utils.bigNumberToShort(n);
    } catch (e) { }
    return '' + n;
  }

  /* -------------------------------------------------------------------- */
  /* Прогресс: обёртки над Lampa.Timeline.view / Lampa.Utils.hash,          */
  /* передаются параметрами в чистые LC.progress.movieProgress/serialProgress. */
  /* -------------------------------------------------------------------- */

  function timelineView(hash) {
    try {
      if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.view === 'function') return Lampa.Timeline.view(hash);
    } catch (e) { }
    return null;
  }

  function utilsHash(str) {
    try {
      if (window.Lampa && Lampa.Utils && typeof Lampa.Utils.hash === 'function') return Lampa.Utils.hash(str);
    } catch (e) { }
    return 0;
  }

  /* -------------------------------------------------------------------- */
  /* Отрисовка карточки.                                                   */
  /* -------------------------------------------------------------------- */

  /* Task 5a Step 3b.2/3b.4: мета-строка — год · страна · хронометраж/сезоны ·
     жанры · 18+ (у сериала в конце строки студия/сеть, а создателя показывает
     таблица «ПОДРОБНО»). Правка 2026-09-23: режиссёра в строке больше нет,
     разбор — у самого места, где он стоял.
     Инлайн-чип качества/«СЕРИАЛ» из v1 убран — лишний узел, дизайну не
     соответствует (design-spec-card.md §2); раздельные чипы качества теперь
     в ленте рейтингов (renderQualityChips). */
  function renderMeta(root, movie) {
    var parts = [];
    var serial = isSerial(movie);

    var release = (movie.release_date || movie.first_air_date || '') + '';
    var year = release ? release.slice(0, 4) : '';
    if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');

    /* Штатный .full-start-new__head заполняется Lampa (start.js) ДО complite
       форматом «2024, США» — cardinfo.country сам отрезает год и падает на
       словарь ISO/английское имя, если head пуст (план 0.2, Task 5 3b.2). */
    var headText = root.find('.full-start-new__head').text();
    var countryText = LC.cardinfo.country(headText, movie.production_countries,
      typeof LC.langCode === 'function' ? LC.langCode() : 'ru');
    if (countryText) parts.push('<span>' + LC.util.esc(countryText) + '</span>');

    if (serial) {
      var counts = [];
      if (movie.number_of_seasons) counts.push(movie.number_of_seasons + ' ' + LC.seasonsWord(movie.number_of_seasons));
      if (movie.number_of_episodes) counts.push(movie.number_of_episodes + ' ' + LC.episodesWord(movie.number_of_episodes));
      if (counts.length) parts.push('<span>' + LC.util.esc(counts.join(', ')) + '</span>');
    } else if (movie.runtime > 0) {
      parts.push('<span>' + LC.util.esc(LC.util.fmtRuntime(movie.runtime, LC.lang('lumen_card_min'))) + '</span>');
    }

    var genres = getGenres(movie);
    if (genres.length) parts.push('<span>' + LC.util.esc(genres.join(', ')) + '</span>');

    var pg = getPG(movie, root);
    if (pg) parts.push('<span>' + LC.util.esc(pg) + '</span>');

    /* Task 5c Step 2: у сериала в конце строки — студия/сеть («· Amazon Prime»,
       экран 05).
       Правка 2026-09-23 (решение координатора по п.2.2 разбора): у фильма
       здесь стоял режиссёр — «· реж. Ирвин Кершнер», — и он же дублировался
       ниже по странице отдельной карточкой с портретом (лента людей Lampa).
       Мета-строка отвечает на «что это»; всё, у чего есть свой блок с
       портретом, живёт там. Замер на стенде 960×540@2 («Звёздные войны:
       Эпизод 5», интерфейс «обычный»): строка была 510.3 CSS px из 960
       (53.2 % ширины), стала 369.7 (38.5 %) — минус 140.6 px, и заголовок
       больше не делит горизонталь со служебной строкой.
       Цена названа разбором и принята: режиссёр перестаёт быть виден без
       прокрутки. */
    if (serial) {
      var studio = LC.cardinfo.network(movie);
      if (studio) parts.push('<span>' + LC.util.esc(studio) + '</span>');
    }

    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i) html.push('<span class="lumen-meta__sep">·</span>');
      html.push(parts[i]);
    }

    root.find('.lumen-meta').html(html.join(''));
    root.addClass('lumen--meta');
  }

  /* Правка пользователя 2026-09-16 (п.2): строки оригинального названия в
     шапке больше нет — вместе с её узлом убран и рисовавший её код.
     Оригинальное название показывает строка «Оригинал» таблицы «ПОДРОБНО»
     (LC.cardinfo.facts), создателя сериала — строка «Создатель» там же. */

  /* Task 5a Step 3/3b: заголовок целиком — .lumen-title--long при длине > 18
     символов (класс переключает line-clamp 1 -> 2 в CSS, см. design-spec §3). */
  function renderTitleClass(root, movie) {
    var node = root.find('.full-start-new__title');
    if (!node.length) return;
    var title = movie.title || movie.name || '';
    node.removeClass('lumen-title--long lumen-title--split');

    /* Правка 2026-09-23 (разбор композиции, п.2.1): название с разделителем
       выводится двумя уровнями — ведущая часть прежним кеглем, вторая
       мельче и приглушённо (CSS .lumen-title--split). Разбор правила и
       замер доли таких названий — у LC.cardinfo.titleParts.
       Текст заголовка ставит сама Lampa из шаблона; здесь он переписывается
       разметкой, поэтому обе части экранируются. Если разделителя нет, а
       разметка осталась от прошлой карточки в этом же узле, текст
       возвращается на место — узел карточки Lampa переживает смену тайтла
       в истории. */
    var parts = LC.cardinfo.titleParts(title);
    if (parts) {
      node.addClass('lumen-title--split');
      node.html(
        '<div class="lumen-title__lead">' + LC.util.esc(parts.lead) + '</div>' +
        '<div class="lumen-title__sub">' + LC.util.esc(parts.sub) + '</div>'
      );
      return;
    }
    if (node.find('.lumen-title__lead').length) node.text(title);

    var cls = LC.cardinfo.titleClass(title);
    if (cls) node.addClass(cls);
  }

  /* -------------------------------------------------------------------- */
  /* Логотип названия в карточке (правка 2026-09-23; долг Task 24,          */
  /* docs/plans/2026-09-15-lumen-phase3-features.md:159 — «логотип в самой  */
  /* карточке не сделан вовсе»; идея — docs/design/ux-ideas.md:40).         */
  /* -------------------------------------------------------------------- */

  /* Когда логотип, а когда двухуровневый текст (4d090c2). Это
     альтернативы, и выбор один: ЕСТЬ логотип — логотип, НЕТ — текст (с
     двумя уровнями, если у названия есть свой разделитель, иначе фолбэк
     кеглем ниже). Логотип выбирается тем же правилом, что в кадре главной
     (LC.hero.pickLogoItem: язык интерфейса, затем английский, затем
     безъязыкий):
       - название фильма на главной и в карточке, открытой с неё, обязано
         быть ОДНИМ И ТЕМ ЖЕ: переход «постер → кадр» ведёт взгляд прямо с
         героя в шапку карточки, и смена логотипа на текст по дороге
         читалась бы как два разных фильма;
       - логотип — это название в том виде, в каком его нарисовала студия;
         двухуровневый текст придуман ровно для случая, когда рисованного
         названия нет, а набранное длинное (п.2.1 разбора композиции).
     Цена, названная честно: у фильма, чей логотип только английский,
     русского названия в шапке не видно. Для того, кому это важно, —
     настройка «Логотип названия в карточке» (lumen_card_logo): выключена —
     всегда текст.

     Название выводится ОДИН раз (правило Task 71 и 375c38c): пока исход
     логотипа неизвестен, заголовок скрыт, а место под логотип уже занято
     рамкой по его пропорции (LC.hero.cardLogoBox, как applyLogoBox у
     героя) — картинка встаёт в готовую рамку без сдвига соседей. Ожидание
     и потолок — общие с героем: LC.hero.waitLogo (TITLE_WAIT = 600 мс,
     кэш исходов logoSeen, одна и та же предзагрузка). Не доехал за
     потолок — текст, и до конца показа этой карточки он не подменяется.

     Данные: images.logos уже лежат в ответе Api.full — Lampa просит
     images вместе с деталями (vendor/lampa/app.min.js:20071, языки
     include_image_language = язык TMDB, en, null). Своего запроса к TMDB
     логотип не добавляет, только загрузку самой картинки.

     Таймеры: потолок (600 мс) и страховка загрузки (8 с) живут внутри
     waitLogo и кончаются сами; отменяются на перерисовке карточки под
     другой логотип и при смене настройки. Сторож el.lumen_logo !== st не
     даёт позднему решению тронуть узел, который уже показывает другое. */
  function cardLogoAllowed() {
    try { return LC.pref ? LC.pref('lumen_card_logo', true) !== false : true; } catch (e) { return true; }
  }

  function logoLang() {
    try {
      if (typeof LC.langCode === 'function') return LC.langCode();
    } catch (e) { }
    return 'ru';
  }

  function setTitleMode(root, mode) {
    root.removeClass('lumen-logo-wait lumen-logo-on');
    if (mode === 'wait') root.addClass('lumen-logo-wait');
    else if (mode === 'logo') root.addClass('lumen-logo-on');
  }

  function renderLogo(root, movie) {
    var el = root[0];
    if (!el) return;
    var title = root.find('.full-start-new__title');
    if (!title.length) return;
    /* Узел логотипа — из нашего шаблона (src/40_template.js). Нет его —
       шаблон чужой, и название остаётся текстом, как было. */
    var holder = root.find('.lumen-logo');
    if (!holder.length) return;
    /* Данные запоминаются на узле: смена настройки перерисовывает уже
       открытые карточки (applyLogoPref), а decorate к ним второй раз не
       придёт. */
    el.lumen_logo_movie = movie;

    var hero = LC.hero;
    var item = null;
    if (cardLogoAllowed() && hero && typeof hero.pickLogoItem === 'function') {
      item = hero.pickLogoItem(movie && movie.images && movie.images.logos, logoLang());
    }
    var path = item ? item.file_path : '';
    var prev = el.lumen_logo;
    /* decorate приходит дважды — на build и на complite — с одними и теми же
       данными: второй проход не должен ни перезапускать ожидание, ни
       мигать заголовком. */
    if (prev && prev.path === path) return;
    if (prev && prev.handle) prev.handle.cancel();
    var st = { path: path, handle: null };
    el.lumen_logo = st;

    if (!path) {
      holder.css('background-image', 'none');
      setTitleMode(root, 'text');
      return;
    }
    var box = hero.cardLogoBox(hero.logoRatioOf(item));
    holder.css('width', box ? box.w + 'em' : '');
    holder.css('height', box ? box.h + 'em' : '');
    /* Адрес — тот же, что у героя (LC.hero.logoUrl, разбор там): логотип,
       уже виденный на главной, встаёт из кэша браузера без второй
       загрузки. */
    var url = hero.logoUrl(path);
    setTitleMode(root, 'wait');
    var handle = hero.waitLogo(path, url, function (show) {
      if (el.lumen_logo !== st) return;
      st.handle = null;
      if (show) {
        holder.css('background-image', 'url("' + encodeURI(url) + '")');
        setTitleMode(root, 'logo');
      } else {
        holder.css('background-image', 'none');
        setTitleMode(root, 'text');
      }
    });
    /* Известный исход решается синхронно — тогда держать handle незачем. */
    if (el.lumen_logo === st && root.hasClass('lumen-logo-wait')) st.handle = handle;
  }

  /* Настройку «Логотип названия в карточке» переключили: уже открытые
     карточки перерисовываются сразу — выключение возвращает текст,
     включение ставит логотип (из кэша сразу, иначе после его загрузки с
     тем же потолком). */
  function applyLogoPref() {
    $('.lumen-card').each(function () {
      var el = this;
      if (!el.lumen_logo_movie) return;
      if (el.lumen_logo && el.lumen_logo.handle) el.lumen_logo.handle.cancel();
      el.lumen_logo = null;
      try { renderLogo($(el), el.lumen_logo_movie); } catch (e) { warn('logo pref failed', e); }
    });
  }

  /* Task 5a Step 3: статус -> точка/подпись (кегль дизайна, только точка
     красится — текст всегда нейтральный, кроме 'soon', где подписи Lampa
     нет вовсе и мы её подставляем сами: «Анонс»). */
  function renderStatus(root, movie) {
    var node = root.find('.full-start__status');
    if (!node.length) return;

    node.removeClass('lumen-status--good lumen-status--accent lumen-status--muted lumen-status--soon');

    var kind = LC.cardinfo.statusKind(movie.status);
    node.addClass('lumen-status--' + kind);

    if (kind === 'soon') node.text(LC.lang('lumen_card_status_soon'));
  }

  /* Task 5a Step 3/3b: чип «РЕАКЦИЙ» — счётчик fire (CUB), скрыт без данных
     и при выключенном card_interfice_reactions (0.2 «Реакции CUB»). */
  function renderReactionsChip(root, data) {
    var chip = root.find('.lumen-reactions-chip');
    if (!chip.length) return;

    chip.addClass('hide');
    var count = LC.cardinfo.reactionsCount(data && data.reactions && data.reactions.result);
    if (!count || !reactionsEnabled()) return;

    chip.find('.lumen-reactions-chip__value').text(bigNumber(count));
    chip.find('.lumen-reactions-chip__label').text(LC.lang('lumen_card_reactions'));
    chip.removeClass('hide');
  }

  /* Task 5a Step 3/4: раздельные чипы качества (4K/HDR/BD) вместо одного
     составного tag--quality (design-spec §5c). Держатель .lumen-tags после
     правки 2026-09-16 (п.1) лежит в ленте рейтингов, а не в боковой колонке —
     сам рендер от этого не зависит, он ищет держатель по классу. Штатный узел
     tag--quality остаётся в разметке (Lampa пишет в него), но всегда скрыт —
     видимые чипы рисуем сами по cardinfo.qualityChips. */
  function renderQualityChips(root, movie) {
    var holder = root.find('.lumen-tags');
    if (!holder.length) return;

    holder.find('.lumen-quality-chip').remove();
    if (isSerial(movie)) return;

    var chips = LC.cardinfo.qualityChips(movie.release_quality || movie.quality);
    var html = [];
    for (var i = 0; i < chips.length; i++) html.push('<div class="lumen-quality-chip">' + LC.util.esc(chips[i]) + '</div>');
    if (html.length) holder.append(html.join(''));
  }

  /* Task 8: подпись «Продолжить S2 E3» на кнопке «Смотреть» (экран 05).
     Текст кнопки не трогаем ничем — её outerHTML хэширует Lampa (план 0.2,
     «Кнопки и хэш приоритета»): подпись выводит CSS (.lumen-card.lumen-continue
     … .button--play:after{content:var(--lumen-play-label)}), а сама строка
     приходит переменной на корне карточки. В строке CSS кавычка и обратный
     слэш обязаны быть экранированы — иначе название серии вида «Он сказал
     "да"» оборвёт значение на первой же кавычке и правило станет невалидным.
     Перевод строки в значении тоже недопустим — заменяем пробелом. Ревью
     Task 8 (п.6): в CSS «newline» — это не только CR/LF, но и form feed
     (U+000C), он тоже обрывает строковый литерал. */
  function cssString(text) {
    return '"' + ('' + text).replace(/[\\"]/g, '\\$&').replace(/[\r\n\f]+/g, ' ') + '"';
  }

  /* Пустая подпись — снимаем и класс, и переменную (а с ней и пустой
     атрибут style="", тем же clearInlineStyleIfEmpty, что у дорожки серий).
     style.setProperty у движка без CSS-переменных просто ничего не делает —
     кнопка остаётся со штатным текстом, ради этого span и скрывается только
     под @supports (--a:0). */
  function setPlayLabel(root, text) {
    var node = root[0];
    if (!node || !node.style || typeof node.style.setProperty !== 'function') return;
    if (text) {
      node.style.setProperty('--lumen-play-label', cssString(text));
      root.addClass('lumen-continue');
      return;
    }
    root.removeClass('lumen-continue');
    if (typeof node.style.removeProperty === 'function') node.style.removeProperty('--lumen-play-label');
    clearInlineStyleIfEmpty(root);
  }

  /* Task 8 (design-spec §6, экраны 01/05): «Продолжить» — одна подпись над
     полосой, а не «ПРОДОЛЖИТЬ» слева и время справа, как было в v1.
     Фильм: «01:12 / 02:46 · 43 %». Сериал: «S2 E3 «Голова» · 18:40 / 58:12 ·
     32 %» (левая часть — чистая LC.progress.label, она же знает про серию, к
     которой только предстоит перейти: «S2 E4 «Гуль» · 61 мин»). Разделитель
     «·» между подписью и таймкодом ставится текстом: узлов в шаблоне два
     (__label/__time), а строка дизайна одна, и псевдоэлемент с :not(:empty)
     на движках ТВ надёжным не будет.
     episodes — e.data.episodes.episodes (серии последнего сезона): из них
     берутся название и длительность серии, без них подпись остаётся «S2 E3». */
  function renderProgress(root, movie, episodes) {
    /* Данные для перерисовки по событию Timeline (refreshProgress ниже):
       в самом событии есть только хэш записи, а карточек в DOM у Lampa
       несколько — история держит и прошлые. */
    if (root[0]) root[0].lumenProgress = { movie: movie, episodes: episodes || null };

    var on = LC.pref(PLUGIN + '_progress', true);
    /* Класс-выключатель для надписей сжатой шапки (экран 06): они живут в
       карточках серий, которые рисует renderEpisodes, и гасятся тем же
       переключателем lumen_card_progress, что строка и подпись кнопки. */
    root.toggleClass('lumen-progress-on', on);

    var row = root.find('.lumen-progress');
    if (row.length) row.addClass('hide');

    var found = null;
    if (on) {
      /* Ревью 2 (п.5): «вышла ли серия» строка пересчитывает на каждой
         перерисовке, а состояние карточки в ряду — только по событию Timeline с
         её хэшем либо при пересборке ряда. На границе суток строка может
         опередить ряд на один тик (для строки серия уже вышла, карточка ещё
         «не вышла»); расхождение снимает ближайшая перерисовка ряда. */
      found = isSerial(movie)
        ? LC.progress.serialProgress(movie, timelineView, utilsHash, episodes, new Date())
        : LC.progress.movieProgress(movie, timelineView, utilsHash);
    }
    if (!found || !found.view) {
      setPlayLabel(root, '');
      return;
    }

    /* Подпись кнопки — только у сериала: на экране 01 фильм с прогрессом
       43 % оставляет штатное «Смотреть», серия же меняет смысл кнопки. */
    setPlayLabel(root, found.season ? LC.lang('lumen_card_continue') + ' S' + found.season + ' E' + found.episode : '');
    if (!row.length) return;

    var percent = Math.max(0, Math.min(100, Math.round(found.view.percent || 0)));
    var caption = LC.progress.label(found, episodes, { min: LC.lang('lumen_card_min') });

    var time = '';
    if (found.view.duration > 0) time = LC.util.fmtTime(found.view.time) + ' / ' + LC.util.fmtTime(found.view.duration);
    else if (found.view.time > 0) time = LC.util.fmtTime(found.view.time);
    if (percent > 0) time = time ? time + ' · ' + percent + ' %' : percent + ' %';

    if (!caption && !time) return;

    row.find('.lumen-progress__label').text(caption);
    row.find('.lumen-progress__time').text(caption && time ? '· ' + time : time);
    var fill = row.find('.lumen-progress__bar > div');
    fill.css('width', percent ? percent + '%' : '');
    clearInlineStyleIfEmpty(fill);
    row.removeClass('hide');
  }

  /* Task 8: запись Lampa.Timeline обновилась (плеер, синхронизация CUB) —
     строка и подпись кнопки пересобираются по сохранённым данным карточки.
     Подписка одна на всё время жизни плагина и общая с рядом серий
     (LC.followTimeline в 90_runtime.js) — второй не заводим. */
  function refreshProgress() {
    $('.lumen-card').each(function () {
      var info = this.lumenProgress;
      if (info) renderProgress($(this), info.movie, info.episodes);
    });
  }

  /* Ревью Task 8 (п.2): события Timeline приходят не только от плеера — при
     синхронизации CUB Account прогоняет update по всему changelog, а сокет шлёт
     их на каждое сообщение. Перерисовка обходит ВСЕ карточки в DOM (Lampa
     держит историю), и у карточки, чей последний сезон не тронут, работает
     scanAll: 10 сезонов × 30 серий = 300 пар hash()+view(). Пачка из 200
     записей превратилась бы в десятки тысяч синхронных вызовов — заметный фриз
     на Android TV. Поэтому события коалесцируются: первое ставит таймер,
     остальные схлопываются в него, перерисовка одна. Настройку и первичную
     отрисовку это не задерживает — они зовут refreshProgress напрямую.
     Ревью 2 (п.3): единственный таймер проекта без парного clearTimeout, и это
     осознанно — окно 300 мс, замыкание держит только модульные функции (ни
     карточки, ни данных), а сама перерисовка ищет карточки в живом DOM и на
     закрытой попросту никого не находит. */
  var PROGRESS_DEBOUNCE = 300;
  var progress_timer = null;

  function scheduleProgressRefresh() {
    if (progress_timer) return;
    progress_timer = setTimeout(function () {
      progress_timer = null;
      try {
        refreshProgress();
      } catch (e) {
        warn('progress refresh failed', e);
      }
    }, PROGRESS_DEBOUNCE);
  }

  /* Правка пользователя 2026-09-16 (п.1): блок «В ролях» (кружки с инициалами
     в боковой колонке) убран вместе с самой колонкой — он дублировал ряд
     актёров, который Lampa рисует ниже по экрану, и вместо фотографий
     показывал инициалы. Вместе с блоком ушли его отрисовка, перерисовка по
     настройке и сама настройка «Показывать актёров». */

  /* -------------------------------------------------------------------- */
  /* Task 5c: сериал — статус в ленте рейтингов, чип следующей серии, ряд   */
  /* серий последнего сезона (design-spec §5e/§8/§9, экраны 05/06).         */
  /* -------------------------------------------------------------------- */

  /* Step 2 (design-spec §8, экран 05): у сериала статус стоит в ленте рейтингов
     перед чипом следующей серии, и вид карты вместо пилюли ему задаёт класс
     режима .lumen-card--serial.
     Правка 2026-09-16 (п.1): после удаления боковой колонки статус лежит в
     ленте уже в самом шаблоне, ровно перед чипом, — перестановка ниже стала
     страховкой (чужой плагин или будущая версия Lampa могут вставить узел в
     другое место) и на открытии карточки не срабатывает. У фильма статус в
     ленте гасит CSS: «Выпущенный» пользователю не нужен. */
  function renderSerialMode(root, movie) {
    var serial = isSerial(movie);
    root.toggleClass('lumen-card--serial', serial);
    if (!serial) return;
    var status = root.find('.full-start__status');
    var chip = root.find('.lumen-next-chip');
    if (status.length && chip.length && status.next()[0] !== chip[0]) chip.before(status);
    if (status.length) statusLevels(status);
  }

  /* Правка 2026-09-23 (разбор композиции, п.2.3, решение координатора):
     чип статуса приводится к той же внутренней схеме, что рейтинг и
     реакции, — ведущее значение крупно, приглушённая подпись под ним.
     Текст статуса Lampa кладёт в узел ПРОСТЫМ ТЕКСТОМ, поэтому разметку
     строим здесь: сам текст переезжает в .lumen-status__value, а под ним
     появляются два пустых узла подписи. Заполняет их renderNextChip —
     полную строку («Следующая серия — 8 октября, через 15 дней») в
     __label и короткую дату («8 окт») в __short для сжатой шапки; пустые
     узлы скрыты CSS, и у сериала без следующей серии чип остаётся
     одноуровневым.
     Разметка строится заново, если её нет: renderStatus выше пишет в тот
     же узел text() (подпись «Анонс» у запланированного сериала) и наши
     узлы этим затирает. Порядок вызовов в decorate — renderStatus,
     renderSerialMode, renderNextChip — и он тут единственная зависимость. */
  function statusLevels(status) {
    var value = status.find('.lumen-status__value');
    if (value.length) return value;
    var current = status.text();
    status.html(
      '<div class="lumen-status__value"></div>' +
      '<div class="lumen-status__label"></div>' +
      '<div class="lumen-status__short"></div>'
    );
    value = status.find('.lumen-status__value');
    value.text(current);
    return value;
  }

  /* Строки дат — из LC.STRINGS (ru/en/uk), склонение дней — LC.daysWord:
     LC.cardinfo про Lampa и язык интерфейса не знает и получает их параметром
     (ревью п.4). */
  function dateWords() {
    return {
      next: LC.lang('lumen_card_next_episode'),
      today: LC.lang('lumen_card_today'),
      tomorrow: LC.lang('lumen_card_tomorrow'),
      inDays: LC.lang('lumen_card_in_days'),
      months: ('' + LC.lang('lumen_card_months_gen')).split(','),
      daysWord: LC.daysWord
    };
  }

  function monthsShort() {
    return ('' + LC.lang('lumen_card_months_short')).split(',');
  }

  /* Task 25 (фаза 3): строки обратного отсчёта фильма — отдельный набор от
     dateWords(): у серии это «Следующая серия — 17 дек, через 31 день», у
     премьеры «Премьера через 31 день · 17 дек». Месяцы короткие: чип стоит в
     одной ленте с рейтингами, места на «17 декабря» там нет. */
  function countdownWords() {
    return {
      premiere: LC.lang('lumen_badge_premiere'),
      today: LC.lang('lumen_badge_premiere_today'),
      tomorrow: LC.lang('lumen_card_tomorrow'),
      inDays: LC.lang('lumen_card_in_days'),
      months: monthsShort(),
      daysWord: LC.daysWord
    };
  }

  /* Step 2 (design-spec §5e): «Следующая серия — 17 декабря, через 31 день»;
     без next_episode_to_air или с датой в прошлом чип скрыт.

     Task 25 (фаза 3): тот же чип показывает обратный отсчёт до премьеры
     ФИЛЬМА с датой в будущем. Узел один и тот же намеренно: у сериала и у
     фильма это одно и то же место ленты, одна и та же карта с часами, и
     одновременно они не встречаются — сериал идёт веткой серии, фильм
     веткой премьеры. */
  function renderNextChip(root, movie) {
    var chip = root.find('.lumen-next-chip');
    if (!chip.length) return;
    chip.addClass('hide');

    var serial = isSerial(movie);
    var text = '';
    var when = '';
    var label = '';
    if (serial) {
      var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
      if (!next) return;
      text = next.text;
      label = next.when || next.text;
      when = LC.cardinfo.shortDate(movie.next_episode_to_air.air_date, monthsShort());
    } else {
      var soon = LC.badges.countdown(movie.release_date, new Date(), countdownWords());
      if (!soon) return;
      text = soon;
      label = soon;
      when = LC.cardinfo.shortDate(movie.release_date, monthsShort());
    }
    chip.find('.lumen-next-chip__text').text(text);

    /* Task 8 (экран 06): в сжатой шапке чип сливается со статусом в одну карту
       «Выходит · 17 дек» — длинной строке там места нет. Короткая дата живёт
       собственным узлом: в шаблоне его нет (шаблон Task 8 не трогает), поэтому
       дописывается один раз при первом показе чипа. Класс на корне нужен
       стилям: срезать правый край карты статуса можно только когда чип рядом
       действительно виден, а :has() план запрещает. */
    var short = chip.find('.lumen-next-chip__short');
    if (!short.length) {
      chip.append('<div class="lumen-next-chip__short"></div>');
      short = chip.find('.lumen-next-chip__short');
    }
    /* Ревью Task 8 (п.7): нераспознанная дата дала бы голое «· ». */
    short.text(when ? '· ' + when : '');

    chip.removeClass('hide');
    /* Ревью Task 8 (п.4): класс срезает левый край чипа под карту статуса — но
       .full-start__status Lampa показывает только при непустом movie.status.
       Без статуса срезать нечего, иначе чип «· 17 дек» остался бы в сжатой
       шапке без левой границы, скругления и точки-маркера.
       Task 25: у ФИЛЬМА карты статуса в ленте нет вовсе — её гасит CSS
       (.full-start__status виден только под .lumen-card--serial), поэтому
       чипу премьеры срезать нечего и класс ему не ставится. */
    if (!serial) return;
    /* Правка 2026-09-23 (п.2.3): у сериала строка следующей серии — это
       ПОДПИСЬ чипа статуса, а не отдельный чип. Прежде они стояли рядом
       двумя картами и склеивались радиусами только в сжатой шапке
       («Выходит · 17 дек»); теперь это один двухуровневый чип, как рейтинг
       и реакции. Замер на стенде 960×540@2 («Закон и порядок»,
       интерфейс «обычный»): статус 73.3 px и чип 291.6 px стояли рядом,
       занимая 372.9 px строки с зазором.
       Полный текст никуда не девается — он и есть подпись. */
    var status = root.find('.full-start__status');
    if (!status.length || status.hasClass('hide')) return;
    statusLevels(status);
    status.find('.lumen-status__label').text(label);
    status.find('.lumen-status__short').text(when || '');
    chip.addClass('hide');
  }

  var EPISODE_STATES = 'lumen-episode--watched lumen-episode--watching lumen-episode--aired lumen-episode--soon';

  /* Ревью п.3: у ежедневных шоу и аниме в сезоне бывает 100+ серий — грузить
     столько кадров сразу нельзя. URL лежит в data-still, background-image
     получают только карточки в окне ±6 от точки интереса (первая и текущая
     серия при отрисовке, фокусная — при листании). */
  var STILL_WINDOW = 6;

  /* Task 39: ширина плитки серии в em Lampa — .lumen-card .lumen-episode
     {width:…em} из src/30_css.js.
     Task 67: число больше не дублируется здесь литералом — и ширина, и
     правый зазор приходят из LC.episodeEm, единственного их источника. */
  function episodeEm() {
    return LC.episodeEm;
  }

  /* Task 67: шаг плитки в ряду — ширина плюс зазор. По нему считается и
     размер окна узлов, и распорка дорожки на месте снятых плиток. */
  function episodeStepEm() {
    var m = episodeEm();
    return m.width + m.gap;
  }

  /* Task 67: половина окна узлов ряда серий, в плитках. Строить ряд целиком
     нельзя: у «Дораэмона» (TMDB 65733) Lampa отдаёт 132 серии одного сезона,
     и сборка 132 плиток внутри full:complite на стенде 960×540@2 занимает
     11.1 мс (медиана пяти прогонов, замер координатора 2026-09-22), а на
     синтетическом сезоне из 1464 серий — 123 мс; на 4×A55 телевизора это и
     есть провал до 2 fps из раздела 0 плана фазы 6.

     Размер окна — плиток в ширину экрана плюс запас в окно кадров
     (STILL_WINDOW) с каждой стороны. Запас нужен затем же, зачем он у
     кадров: окно едет за фокусом не на каждый шаг, а когда до его края
     остаётся меньше STILL_WINDOW плиток, — значит за видимой частью ряда
     всегда лежит ещё не меньше экрана готовых плиток, и пустоты у края
     пользователь не увидит.

     Обе мерки в физических пикселях (LC.util): emPx и screenPx считают DPR
     одним и тем же способом, поэтому их отношение — это честное число
     плиток в ширину экрана. Ряд начинается не от левого края экрана, а с
     отступом карточки, так что счёт получается с запасом в свою сторону. */
  function episodeHalf() {
    var step = LC.util.emPx(episodeStepEm());
    var visible = step > 0 ? Math.ceil(LC.util.screenPx() / step) : 0;
    if (!(visible > 0)) visible = 1;
    return visible + STILL_WINDOW;
  }

  /* Task 39: размер кадра серии по фактической ширине плитки. 14.9em — это
     340 физических пикселей на экране 1920 при размерах интерфейса по
     умолчанию (оба множителя учитывает LC.util.emPx), и w300 закрывает их с апскейлом
     меньше чем в 1.14 раза. Выше w300 не поднимаемся ни при каком DPR: у
     кадров серий следующая ступень TMDB — сразу original, то есть полный
     кадр (обычно 1920×1080), а still лежит фоном ПОД текстом с opacity .28
     (.lumen-episode__still), и ряд держит в памяти окно ±2×STILL_WINDOW
     таких плиток. На узком экране (плитка меньше ~218 физических пикселей)
     берётся w185.
     Task 68: 0.85 здесь — СВОЙ допуск этой пары ступеней, не общий с
     LC.util.posterSize (у постеров он теперь единица, FIT_POSTER в
     src/10_util.js). Смысл разный: у постера за границей допуска стоит
     следующая ступень, а здесь — original, то есть 8.3 МБ растра на плитку
     вместо 0.20, и потолок держит не резкость, а память. Цену потолка
     называем честно: замер на стенде 2026-09-22 даёт 275-428 физических
     пикселей по 24 клеткам (2 целевых экрана × 3 размера интерфейса × 4
     масштаба плагина), то есть при «крупнее» + «огромный» кадр серии
     растягивается в 1.43 раза (428 / 300). Это самый растянутый постерный
     элемент плагина после кадра героя, и убрать растяжение нечем: между
     w300 и original ступеней у still_sizes TMDB нет. */
  function stillSize() {
    return LC.util.emPx(episodeEm().width) * 0.85 > 185 ? 'w300' : 'w185';
  }

  /* Ревью п.6: кадр ставится через .css, а не в атрибут style: esc() кодирует
     апостроф как &#39;, который в атрибуте декодируется обратно и рвёт url('…').
     Внутри url("…") экранируются только " и \. */
  function applyStill(node) {
    var url = node.attr('data-still');
    if (!url) return;
    node[0].lumenStill = true;
    node.find('.lumen-episode__still').css('background-image', 'url("' + ('' + url).replace(/["\\]/g, '\\$&') + '")');
  }

  /* Task 67: nodes — места сезона, а не список узлов: за окном стоит null,
     и кадр там ставить некуда. Когда плитка попадёт в окно, кадр ей поставит
     mountWindow тем же applyStill. */
  function loadStills(nodes, center) {
    var from = Math.max(0, center - STILL_WINDOW);
    var to = Math.min(nodes.length - 1, center + STILL_WINDOW);
    for (var i = from; i <= to; i++) {
      if (nodes[i] && !nodes[i][0].lumenStill) applyStill(nodes[i]);
    }
  }

  /* Долг ревью Task 5c (п.1): кадры только ставились и никогда не снимались —
     после прохода фокусом по сезону в памяти оказывались ВСЕ его картинки, то
     есть ровно то, ради чего окно и заводилось (у ежедневных шоу и аниме это
     100+ кадров). Держим их в пределах ±2×STILL_WINDOW от точки интереса:
     ближнее окно (±STILL_WINDOW) нарисовано, следующее — запас на возврат
     фокуса назад без повторной загрузки. Снимаем и background-image, и флаг:
     иначе loadStills сочтёт карточку уже загруженной и кадр не вернётся.
     Пустой атрибут style="" убираем тем же приёмом, что у дорожки (setShift).
     Task 67: обходим только окно узлов (scan*): за его краем nodes[i] — null,
     и обход всего сезона (у «Дораэмона» 132 места, у длинного аниме — за
     тысячу) на каждый шаг фокуса был бы работой вхолостую. */
  function dropStills(nodes, center, scanFrom, scanTo) {
    var from = center - STILL_WINDOW * 2;
    var to = center + STILL_WINDOW * 2;
    var last = scanTo < nodes.length - 1 ? scanTo : nodes.length - 1;
    for (var i = scanFrom > 0 ? scanFrom : 0; i <= last; i++) {
      if ((i >= from && i <= to) || !nodes[i] || !nodes[i][0].lumenStill) continue;
      nodes[i][0].lumenStill = false;
      var still = nodes[i].find('.lumen-episode__still');
      still.css('background-image', '');
      clearInlineStyleIfEmpty(still);
    }
  }

  /* Внутренность карточки серии по состоянию (design-spec §9): номер, бейдж
     (галочка у просмотренной, «32 %» у начатой; в фокусе вместо него кружок
     play — экран 06), название, подпись, полоса у начатой. Узел кадра пустой —
     картинку вешает applyStill, когда серия попадает в окно загрузки. */
  function episodeInner(ep, st, months, hasStill, view) {
    var esc = LC.util.esc;
    var min = LC.lang('lumen_card_min');
    var runtime = ep.runtime > 0 ? ep.runtime + ' ' + min : '';
    var caption = runtime;
    var badge = '';
    var state = '';
    var timecode = '';

    if (st.state === 'watched') {
      caption = (runtime ? runtime + ' · ' : '') + LC.lang('lumen_card_ep_watched');
      badge = '<div class="lumen-episode__check"></div>';
    } else if (st.state === 'watching') {
      caption = LC.lang('lumen_card_ep_watching') + (st.leftMin ? ' · ' + LC.lang('lumen_card_ep_left') + ' ' + st.leftMin + ' ' + min : '');
      badge = '<div class="lumen-episode__percent">' + st.percent + ' %</div>';
      /* Task 8 (экран 06, сжатая шапка): у начатой серии номер дополняется
         состоянием — «E3 · СМОТРИТЕ», а подпись «смотрите · осталось 39 мин»
         уступает место таймкоду «18:40 / 58:12 · 32 %». Оба узла рисуются
         всегда; показывает их CSS (.lumen-progress-on.lumen-compact
         .lumen-episode.focus), поэтому ни фокус, ни режим шапки не требуют
         перерисовки ряда. Таймкод обновляется вместе с процентом (подпись
         lumenSign в paintEpisode): секунды между соседними update таймлайна
         карточку не пересобирают — ровно как решено ревью Task 5c (п.8). */
      state = '<div class="lumen-episode__state">· ' + esc(LC.lang('lumen_card_ep_watching')) + '</div>';
      var played = view && view.time > 0 ? LC.util.fmtTime(view.time) : '';
      var total = view && view.duration > 0 ? LC.util.fmtTime(view.duration) : '';
      var stamp = played && total ? played + ' / ' + total : played;
      timecode = '<div class="lumen-episode__timecode">' + esc(stamp ? stamp + ' · ' + st.percent + ' %' : st.percent + ' %') + '</div>';
    } else if (st.state === 'soon') {
      var date = LC.cardinfo.shortDate(ep.air_date, months);
      caption = (date ? date + ' · ' : '') + LC.lang('lumen_card_ep_soon');
    }

    return '' +
      (hasStill ? '<div class="lumen-episode__still"></div>' : '') +
      '<div class="lumen-episode__top">' +
      '<div class="lumen-episode__num">E' + esc(ep.episode_number) + '</div>' + state + badge +
      '<div class="lumen-episode__play"></div>' +
      '</div>' +
      '<div class="lumen-episode__bottom">' +
      '<div class="lumen-episode__name">' + esc(ep.name || '') + '</div>' +
      (caption ? '<div class="lumen-episode__caption">' + esc(caption) + '</div>' : '') + timecode +
      (st.state === 'watching' ? '<div class="lumen-episode__bar"><div style="width:' + st.percent + '%"></div></div>' : '') +
      '</div>';
  }

  /* Класс состояния + внутренность; возвращает состояние. Сам узел не
     пересоздаётся — фокус Navigator и класс .focus переживают перерисовку.
     Ревью п.8: если состояние, процент и остаток те же, innerHTML не трогаем
     вовсе (Lampa шлёт update таймлайна каждые несколько секунд проигрывания).
     Ревью Task 8 (п.5): view.time в подпись СОЗНАТЕЛЬНО не входит, поэтому
     таймкод сжатой шапки («18:40 / 58:12») догоняет реальное время только со
     сменой целого процента — у 58-минутной серии это раз в ~35 с. Размен в
     пользу тишины: время в подписи означало бы полную пересборку innerHTML
     карточки на каждое событие таймлайна, а их присылает пачками ещё и
     синхронизация CUB (см. коалесценцию в scheduleProgressRefresh). */
  function paintEpisode(node, ep, hash, now, months) {
    var view = hash ? timelineView(hash) : null;
    var st = LC.progress.episodeState(view, ep.air_date, now, ep.runtime);
    var sign = st.state + '|' + (st.percent || '') + '|' + (st.leftMin || '');
    if (node[0].lumenSign === sign) return st;

    node[0].lumenSign = sign;
    node.removeClass(EPISODE_STATES).addClass('lumen-episode--' + st.state).html(episodeInner(ep, st, months, !!node.attr('data-still'), view));
    if (node[0].lumenStill) applyStill(node);
    return st;
  }

  /* Ревью п.1: .css(transform, '') убирает свойство, но оставляет пустой
     атрибут style="" — снимаем его целиком (clearInlineStyleIfEmpty, тот же
     приём, что в 50_backdrops.js). */
  function setShift(track, px) {
    if (!track.length) return;
    track[0].lumenShift = px;
    var value = px ? 'translate3d(' + (-px) + 'px,0,0)' : '';
    track.css({ '-webkit-transform': value, transform: value });
    clearInlineStyleIfEmpty(track);
  }

  /* Step 3: ряд серий последнего сезона из e.data.episodes.episodes[] (Lampa
     кладёт туда весь последний сезон, включая не вышедшие серии). Нет
     episodes или это фильм — ряд скрыт. Хэш серии для Lampa.Timeline —
     формула плана 0.2 (как у Timeline.watchedEpisode и online_mod); он
     считается один раз на серию и хранится в описании её места в сезоне
     (info.eps), откуда его берут и paintEpisode, и refreshEpisode.
     Ревью п.7: decorate зовётся дважды (build и complite) с одним и тем же
     e.data — повторную сборку того же списка пропускаем. */
  /* Долг ревью Task 5c (п.2): «тот же список» — это та же ссылка И та же
     сигнатура. Lampa дописывает вышедшую серию и правит её поля прямо в том же
     массиве e.data.episodes.episodes[], поэтому сверки по ссылке не хватало:
     ряд оставался старым.
     Ревью Task 5d (Minor 3): в подпись входят длина списка, сезон и номер
     первой серии, номер и дата выхода последней — то есть ровно смена сезона,
     дописанная в конец серия и уточнённая дата её выхода. Правку В СЕРЕДИНЕ
     списка (переименовали третью серию, сдвинули её дату) подпись НЕ ловит —
     это осознанный размен: обход всего массива на каждый decorate (а он
     приходит и на build, и на complite, и на каждый update таймлайна) дороже,
     чем редкий неперерисованный заголовок серии. Состояния просмотра при этом
     обновляются отдельно — через refreshEpisode по хэшу. */
  function episodesSign(list) {
    if (!list || !list.length) return '';
    var first = list[0] || {};
    var last = list[list.length - 1] || {};
    return [list.length, first.season_number, first.episode_number, last.episode_number, last.air_date].join('|');
  }

  /* Task 67: одна плитка ряда. Всё, что нужно для её сборки, лежит в eps[pos]
     (серия, её место в исходном массиве Lampa и хэш Timeline) — узел можно
     построить и при первой отрисовке, и позже, когда серия въедет в окно.
     Атрибутов data-hash/data-index на плитке больше нет: они были мостом от
     узла к данным для refreshEpisode, а тот теперь ходит по местам сезона
     (info.eps) и в DOM за ними не лазает. В разметке остаётся только
     data-still — его читает applyStill. */
  function makeEpisode(info, pos, now, months) {
    var item = info.eps[pos];
    var node = $('<div class="lumen-episode selector"></div>');
    if (item.still) node.attr('data-still', item.still);
    node[0].lumenPos = pos;
    paintEpisode(node, item.ep, item.hash, now, months);
    return node;
  }

  /* Task 67: распорка дорожки — место снятых плиток слева и справа от окна,
     в шагах плитки (ширина + зазор из LC.episodeEm). Без неё ряд, собранный
     окном, был бы короче сезона: сдвиг к фокусной плитке (scrollToEpisode
     считает его по offsetLeft и scrollWidth дорожки) и её положение на
     экране поехали бы, как только окно уедет от начала.
     Padding, а не пустые узлы-распорки: два числа на самой дорожке дешевле
     двух лишних элементов, а offsetLeft плиток padding-left учитывает —
     дорожка и есть их offsetParent (position:absolute, src/30_css.js). */
  function setSpacer(track, before, after) {
    if (!track.length) return;
    var step = episodeStepEm();
    track.css({
      'padding-left': before > 0 ? (Math.round(before * step * 100) / 100) + 'em' : '',
      'padding-right': after > 0 ? (Math.round(after * step * 100) / 100) + 'em' : ''
    });
    clearInlineStyleIfEmpty(track);
  }

  /* Task 67: привести окно узлов к [from..to]. Плитки вне нового окна
     снимаются, недостающие достраиваются: справа append, слева prepend в
     обратном порядке — в дорожке они всегда лежат по возрастанию места в
     сезоне, иначе Navigator (он ходит по геометрии) пошёл бы не туда.
     Возвращает true, если DOM ряда изменился. */
  function mountWindow(info, from, to) {
    var nodes = info.nodes;
    var now = new Date();
    var months = monthsShort();
    var changed = false;
    var i;

    for (i = info.from; i <= info.to; i++) {
      if (i >= from && i <= to) continue;
      if (!nodes[i]) continue;
      nodes[i].remove();
      nodes[i] = null;
      changed = true;
    }
    for (i = from > info.to + 1 ? from : info.to + 1; i <= to; i++) {
      if (nodes[i]) continue;
      nodes[i] = makeEpisode(info, i, now, months);
      info.track.append(nodes[i]);
      changed = true;
    }
    for (i = to < info.from - 1 ? to : info.from - 1; i >= from; i--) {
      if (nodes[i]) continue;
      nodes[i] = makeEpisode(info, i, now, months);
      info.track.prepend(nodes[i]);
      changed = true;
    }

    info.from = from;
    info.to = to;
    setSpacer(info.track, from, info.eps.length - 1 - to);
    return changed;
  }

  /* Task 67: окно едет за фокусом. Не на каждый шаг: пока до края окна
     остаётся не меньше STILL_WINDOW плиток, трогать DOM незачем — за видимой
     частью ряда и так лежит готовый запас. Когда запас кончается, окно
     перестраивается вокруг фокуса и упирается в границы сезона. */
  function slideWindow(info, center) {
    var last = info.eps.length - 1;
    var half = info.half;
    var needLeft = info.from > 0 && center - info.from < STILL_WINDOW;
    var needRight = info.to < last && info.to - center < STILL_WINDOW;
    if (!needLeft && !needRight) return false;

    var from = center - half;
    var to = center + half;
    if (to > last) to = last;
    from = to - half * 2;
    if (from < 0) from = 0;
    to = from + half * 2;
    if (to > last) to = last;
    if (from === info.from && to === info.to) return false;
    return mountWindow(info, from, to);
  }

  /* Task 67: Navigator ходит по СНИМКУ .selector'ов — Controller.collectionSet
     отдаёт ему Array.from(html.querySelectorAll('.selector'))
     (vendor/lampa/app.min.js:46448-46466), а Navigator.setCollection этот
     список запоминает (vendor/lampa/vender/navigator/navigator.js:568-573).
     Значит после сдвига окна снимок обязан быть пересобран: досозданные
     плитки в него сами не попадут, а снятые остались бы в нём мёртвыми
     (снятие поштучно недоступно — Navigator в window.Lampa не экспортирован,
     vendor/lampa/app.min.js:55947-56010). Тот же урок, что у рулетки после
     Task 44 (src/56_roulette.js, recollect).

     Фокус возвращается явно: collectionSet зовёт clearSelects(), то есть
     снимает класс focus со всей прежней коллекции (app.min.js:46395-46398,
     46462), а Navigator.setCollection — unfocus(). Проверки перед пересбором
     те же, что у кнопки «Стоп» трейлера (src/55_trailer.js, recollect):
     имени контроллера мало — карточка, оставленная в истории Lampa, остаётся
     живым DOM, и collectionSet по ней увёл бы навигацию с видимого экрана. */
  function recollectEpisodes(root, focused) {
    try {
      if (!window.Lampa || !Lampa.Controller) return;
      if (typeof Lampa.Controller.collectionSet !== 'function') return;
      if (!LC.util.onScreen(root)) return;
      var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
      if (!enabled || enabled.name !== 'full_start') return;
      Lampa.Controller.collectionSet(root);
      if (typeof Lampa.Controller.collectionFocus === 'function') {
        Lampa.Controller.collectionFocus(focused || false, root);
      }
    } catch (e) {
      warn('episodes collection failed', e);
    }
  }

  /* Ревью 2026-09-22 (М3): пересборка ряда снимает из DOM все прежние
     плитки, а снимок .selector'ов у Navigator их помнит (см. комментарий
     recollectEpisodes выше) — пульт ходил бы по мёртвым узлам ровно так
     же, как ходил бы после сдвига окна без пересбора. Дефект жил здесь со
     времён Task 5, но функция пересбора появилась только в Task 67.
     Зовём её ТОЛЬКО если ряд уже был построен: на первой сборке карточки
     (decorate приходит дважды — на 'build' и на 'complite') коллекцию
     собирает сама Lampa, и лезть в неё раньше неё незачем.
     Фокус сохраняем, если он был ВНЕ ряда серий: его узел пересборку
     пережил. Если фокус стоял на плитке серии, узла больше нет, и
     collectionFocus(false) уводит на первый .selector карточки — это
     всё равно лучше, чем фокус на узле вне документа. */
  function renderEpisodes(root, data) {
    var row = root.find('.lumen-episodes');
    var had = row.length ? !!row[0].lumenEpisodes : false;
    var keep = null;
    if (had) {
      var cur = root.find('.selector.focus');
      if (cur.length && !cur.hasClass('lumen-episode')) keep = cur[0];
    }
    if (buildEpisodes(root, data) && had) recollectEpisodes(root, keep);
  }

  /* Возвращает true, если DOM ряда тронут (ряд пересобран или опустошён). */
  function buildEpisodes(root, data) {
    var row = root.find('.lumen-episodes');
    if (!row.length) return false;

    var movie = (data && data.movie) || {};
    var list = data && data.episodes && data.episodes.episodes;
    var sign = episodesSign(list);
    var previous = row[0].lumenEpisodes;
    if (previous && list && previous.list === list && previous.sign === sign) return false;

    var track = row.find('.lumen-episodes__track');
    row.addClass('hide');
    track.empty();
    setShift(track, 0);
    setSpacer(track, 0, 0);
    row[0].lumenEpisodes = null;

    if (!isSerial(movie) || !list || !list.length) return true;

    var season = parseInt(data.episodes.season_number, 10) || parseInt(list[0] && list[0].season_number, 10) || 0;
    var key = movie.original_name || movie.original_title || '';
    /* Task 39: размер кадра один на весь ряд — ни ширина окна, ни DPR за
       время отрисовки не меняются, а серий в сезоне бывает больше сотни. */
    var stillW = stillSize();
    var eps = [];

    /* Task 67: сперва — только описания плиток (серия, её место в массиве
       Lampa, хэш Timeline, адрес кадра). Это весь сезон, но без DOM: узлы
       строит уже mountWindow, и только для окна. */
    for (var i = 0; i < list.length; i++) {
      var ep = list[i];
      if (!ep || !(ep.episode_number > 0)) continue;
      var hash = key && season ? '' + utilsHash([season, season > 10 ? ':' : '', ep.episode_number, key].join('')) : '';
      if (hash === '0') hash = '';
      eps.push({
        ep: ep,
        index: i,
        hash: hash,
        still: LC.cardinfo.imageUrl(ep.still_path, stillW, tmdbImageFn(), apiImgFn())
      });
    }
    if (!eps.length) return true;

    var nodes = [];
    for (i = 0; i < eps.length; i++) nodes.push(null);

    /* Ряд объявляется построенным только после того, как окно собрано:
       упади сборка на полпути, повторный decorate с тем же списком обязан
       собрать ряд заново, а не вернуться по сигнатуре к скрытому ряду. */
    var info = { list: list, eps: eps, nodes: nodes, sign: sign, track: track, half: episodeHalf(), from: 0, to: -1 };
    mountWindow(info, 0, Math.min(eps.length - 1, info.half * 2));
    row[0].lumenEpisodes = info;

    /* Видно с самого начала ряда; если сериал уже смотрят — ещё и вокруг той
       серии. Task 67: «ту серию» ищем среди построенных: за окном кадры всё
       равно некуда ставить, а перебор Timeline по всему сезону стоил бы
       ровно того времени, ради которого окно и заведено. */
    loadStills(nodes, 0);
    for (i = info.from; i <= info.to; i++) {
      if (nodes[i] && nodes[i].hasClass('lumen-episode--watching')) { loadStills(nodes, i); break; }
    }

    row.find('.lumen-episodes__title').text(season ? LC.lang('lumen_card_season') + ' ' + season : (data.episodes.name || ''));
    row.find('.lumen-episodes__count').text(eps.length + ' ' + LC.episodesWord(eps.length));
    row.removeClass('hide');
    /* Правило кромки — сразу на первой отрисовке: до первого шага фокуса ряд
       стоит на сдвиге 0, и правая кромка режет плитку уже тогда. Зовётся
       ПОСЛЕ removeClass('hide'): у скрытого ряда offsetLeft плиток нулевой,
       и срезанной оказалась бы каждая. */
    markClipped(info, track, viewWidth(row.find('.lumen-episodes__viewport')[0]));
    scheduleClip(root);
    return true;
  }

  /* Правило кромки (разбор композиции 2026-09-22, п.6; находка волны A —
     «Железный трон» у правой кромки превращался в «Же»). Ряд серий уходит
     за правый край экрана по замыслу, и кромка режет плитку посередине — а
     вместе с плиткой и название серии.

     Замер на стенде 960×540@2 («Игра престолов», интерфейс «обычный»):
     видимая часть ряда 593.1 px, шаг плитки 178 px (169.9 ширины + 8.1
     зазора), четвёртая плитка видна на 59.1 px из 169.9, и в этих 59
     пикселях лежало начало названия.

     Подогнать шаг под ширину, как это сделано у ленты людей, здесь нельзя:
     там шаг подбирался так, чтобы кромка приходилась на портрет следующей
     карточки, а тут «портрет» и есть вся плитка — текст лежит на кадре. И
     сама ширина не постоянна: она зависит от размера интерфейса Lampa, от
     масштаба плагина и от ширины окна, а плиток в ряду целое число.
     Поэтому правило применяется прямо: срезанная плитка показывает только
     КАДР, весь её текст скрыт (CSS .lumen-episode--cut, src/30_css.js).
     Кромка режет изображение — это читается как «листай дальше», — и не
     режет ни одной буквы.

     Все чтения раскладки идут подряд, до единой записи классов: правка
     класса между двумя offsetLeft заставила бы движок пересчитывать
     раскладку на каждой плитке окна. Видимую ширину ряда функция не
     считает сама, а получает готовой: у scrollToEpisode она уже есть, и
     второй getBoundingClientRect на том же шаге фокуса был бы лишним
     пересчётом раскладки (сторож этого — тест Task 67 про повторный
     hover:focus). */
  function viewWidth(viewport) {
    if (!viewport) return 0;
    var screen = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    return screen - viewport.getBoundingClientRect().left;
  }

  function markRow(root) {
    var row = root.find('.lumen-episodes');
    if (!row.length || !row[0].lumenEpisodes) return;
    markClipped(row[0].lumenEpisodes, row.find('.lumen-episodes__track'), viewWidth(row.find('.lumen-episodes__viewport')[0]));
  }

  /* Первая сборка карточки идёт ДО вставки её узла в документ: замер на
     стенде 960×540@2 — offsetLeft у всех плиток 0 и left у viewport 0, то
     есть мерить нечего и срезанной не оказывается ни одна. Поэтому пометка
     ставится дважды: сразу (карточка, пересобранная на живом экране, уже в
     документе) и следующей задачей таймера, когда узел вставлен. Ждать
     фокуса нельзя: до первого нажатия ряд уже виден, и именно этот кадр
     пользователь и снимал на скриншот. */
  function scheduleClip(root) {
    setTimeout(function () {
      try {
        markRow(root);
      } catch (e) {
        warn('episodes clip failed', e);
      }
    }, 0);
  }

  function markClipped(info, track, view) {
    if (!info || !track.length || !(view > 0)) return;

    var shift = track[0].lumenShift || 0;
    var nodes = info.nodes;
    var marks = [];
    var i;
    for (i = info.from; i <= info.to; i++) {
      var node = nodes[i];
      if (!node || !node.length) continue;
      var left = node[0].offsetLeft;
      /* Полпикселя допуска: ширина и зазор заданы в em, и на дробном кегле
         правый край плитки садится на кромку с ошибкой округления. */
      marks.push([node, left < shift - 0.5 || left + node[0].offsetWidth > shift + view + 0.5]);
    }
    for (i = 0; i < marks.length; i++) {
      if (marks[i][1]) marks[i][0].addClass('lumen-episode--cut');
      else marks[i][0].removeClass('lumen-episode--cut');
    }
  }

  /* Step 3: длинный ряд — сдвиг дорожки к фокусной карточке. Контроллер Lampa
     не трогаем: Navigator сам выбирает соседа по геометрии, мы только держим
     его на экране с запасом в полкарточки с обеих сторон и подгружаем кадры
     вокруг него. Видимая часть ряда — от левого края ряда до правого края
     экрана (дизайн: ряд уходит за край). */
  function scrollToEpisode(root, node) {
    var row = root.find('.lumen-episodes');
    var viewport = root.find('.lumen-episodes__viewport')[0];
    var track = row.find('.lumen-episodes__track');
    if (!viewport || !track.length || !node) return;

    var info = row.length ? row[0].lumenEpisodes : null;
    if (info && typeof node.lumenPos === 'number') {
      /* Task 67: сперва узлы (окно едет за фокусом и пересобирает снимок
         Navigator), потом кадры — иначе кадр ставить было бы некуда, — и
         только потом геометрия: offsetLeft плитки читается уже с новой
         распоркой дорожки. */
      if (slideWindow(info, node.lumenPos)) recollectEpisodes(root, node);
      loadStills(info.nodes, node.lumenPos);
      dropStills(info.nodes, node.lumenPos, info.from, info.to);
    }

    var view = viewWidth(viewport);
    if (view <= 0) return;

    var current = track[0].lumenShift || 0;
    var shift = current;
    var left = node.offsetLeft;
    var width = node.offsetWidth;
    var reserve = Math.round(width / 2);

    if (left - reserve < shift) shift = left - reserve;
    else if (left + width + reserve > shift + view) shift = left + width + reserve - view;
    shift = Math.max(0, Math.min(shift, track[0].scrollWidth - view));

    if (shift !== current) setShift(track, shift);
    /* Правило кромки: после сдвига срезанные плитки — другие. Зовём и когда
       сдвиг не изменился: окно могло переехать выше по этой же функции, и
       в ряду появились новые узлы. */
    markClipped(info, track, view);
  }

  /* Step 4: фокус и OK на карточках серий. Lampa шлёт события фокуса и
     hover:enter через Utils.trigger — Event с bubbles:false, поэтому jQuery-делегирование
     .on(event, selector) их не видит (API_NOTES_4 A2). Не всплывающее событие
     всё равно проходит фазу перехвата от document до цели: слушатель в capture
     на корне карточки ловит фокус и серий, и кнопок, не трогая сами кнопки
     (их outerHTML — хэш приоритета). Вешается один раз на корень (флаг —
     свойство узла, в разметку не попадает) и уходит вместе с узлом карточки:
     внешних ссылок на обработчики нет. */
  function bindEpisodes(root) {
    var el = root[0];
    if (!el || typeof el.addEventListener !== 'function' || el.lumenEpisodesBound) return;
    el.lumenEpisodesBound = true;

    /* Task 68: LC.focus.capture — обработчик на ОБА события фокуса
       (src/11_focus.js). Мышь шлёт 'hover:hover', не 'hover:focus'
       (vendor/lampa/app.min.js:46360-46364), а на фокусе плитки висят и
       окно ряда (slideWindow), и догрузка кадров: мышью без этого ряд не
       едет и дальше окна серий просто нет. */
    LC.focus.capture(el, function (e) {
      try {
        var node = $(e.target).closest('.lumen-episode', el);
        if (node.length) {
          root.addClass('lumen-compact');
          /* Task 67: защёлка от самовызова. Пересбор коллекции после сдвига
             окна возвращает фокус через Controller.collectionFocus, а тот
             шлёт узлу то же событие фокуса (Navigator.follow('focus') ->
             Controller.focus -> Utils.trigger, vendor/lampa/app.min.js:56069
             и 46434-46446) — то есть приходит обратно сюда. Бесконечным
             такой заход не был бы (окно уже на месте, второй раз оно не
             поедет), но весь путь прошёл бы заново, а в нём — чтение
             getBoundingClientRect и offsetLeft, то есть лишний пересчёт
             раскладки на каждом сдвиге окна. */
          if (el.lumenEpisodesBusy) return;
          el.lumenEpisodesBusy = true;
          try {
            scrollToEpisode(root, node[0]);
          } finally {
            el.lumenEpisodesBusy = false;
          }
        } else if ($(e.target).closest('.full-start-new__buttons', el).length) {
          root.removeClass('lumen-compact');
        }
      } catch (err) {
        warn('episode focus failed', err);
      }
    });

    /* OK на серии -> выбор источника той же кнопкой «Смотреть» (серию
       пользователь выбирает уже в TorrServer). */
    el.addEventListener('hover:enter', function (e) {
      try {
        if (!$(e.target).closest('.lumen-episode', el).length) return;
        /* Ревью п.5: «Смотреть» скрыта (read_only, нет источников) — делать нечего. */
        root.find('.full-start-new__buttons').find('.button--play').not('.hide').eq(0).trigger('hover:enter');
      } catch (err) {
        warn('episode enter failed', err);
      }
    }, true);
  }

  /* ↑ с плитки серии правее кнопок (долг фазы 1, план фазы 1 Task 12,
     п.2; замер 2026-09-23 на стенде 960×540@2, «Дораэмон» 65733). Navigator
     Lampa берёт цель «вверх» только из прямой полосы над плиткой:
     straightOnly = true выбрасывает косые направления, а в прямую полосу
     узел попадает, если его центр лежит над плиткой или он перекрывает
     её левую половину (vendor/lampa/vender/navigator/navigator.js:65, 338-
     392, 948-951). Кнопки карточки кончаются на x = 449, а плитки идут
     шагом 178 px от x = 40 — у четвёртой плитки (x 574…744) и дальше над
     ней нет ни одной кнопки. canmove('up') отдаёт false, контроллер
     full_start шлёт 'up' (app.min.js:37937-37939), список модулей карточки
     на первом модуле уводит фокус в шапку Lampa (app.min.js:35157-35165) —
     туда пульт и попадал. Окно Task 67 здесь ни при чём: мешает не число
     плиток, а то, что ряд шире ряда кнопок.

     Кнопки двигать нельзя (их outerHTML — хэш приоритета, план 0.2), и
     цель, которой Navigator не видит, даёт только сам контроллер. Его
     объект Start собирает заново на каждом toggle и перед Controller.add
     отдаёт модулям событием 'controller' (app.min.js:37918-37943) — это
     штатная точка расширения Emit, ею же пользуется, например, модуль
     Explorer (app.min.js:39610-39616). Обёртка трогает только ↑ и только
     когда фокус на плитке серии ЭТОЙ карточки, а Navigator наверх идти не
     может; иначе работает прежний up Lampa без изменений. Цель — кнопка,
     ближайшая к плитке по горизонтали (для плитки правее всех кнопок это
     последняя видимая), при равенстве — первая по порядку. Фокус ставится
     тем же Controller.collectionFocus, которым Lampa входит в коллекцию:
     узлу приходит обычный hover:focus, Start запоминает его как last, а
     capture-слушатель bindEpisodes снимает сжатие шапки. */
  function upTarget(root) {
    var nav = window.Navigator;
    if (!nav || typeof nav.getFocusedElement !== 'function' || typeof nav.canmove !== 'function') return null;
    var from = nav.getFocusedElement();
    if (!from || !$(from).hasClass('lumen-episode')) return null;
    if ($(from).closest('.full-start-new')[0] !== root[0]) return null;
    if (nav.canmove('up')) return null;

    var box = root.find('.full-start-new__buttons')[0];
    if (!box || typeof box.querySelectorAll !== 'function') return null;
    var list = box.querySelectorAll('.selector');
    var src = from.getBoundingClientRect();
    var mid = src.left + src.width / 2;
    var best = null;
    var bestGap = 0;
    for (var i = 0; i < list.length; i++) {
      var el = list[i];
      if ($(el).hasClass('hide') || !el.offsetParent) continue;
      var r = el.getBoundingClientRect();
      if (!(r.width > 0)) continue;
      var gap = mid < r.left ? r.left - mid : (mid > r.left + r.width ? mid - r.left - r.width : 0);
      if (!best || gap < bestGap) {
        best = el;
        bestGap = gap;
      }
    }
    return best;
  }

  function bindStart(item, root) {
    if (!item || typeof item.use !== 'function' || !root || !root.length || item.lumenUpBound) return;
    item.lumenUpBound = true;
    item.use({
      onController: function (controller) {
        var up = controller && controller.up;
        if (typeof up !== 'function') return;
        controller.up = function () {
          try {
            var target = upTarget(root);
            if (target && window.Lampa && Lampa.Controller && typeof Lampa.Controller.collectionFocus === 'function') {
              Lampa.Controller.collectionFocus(target, root);
              if (window.Navigator.getFocusedElement() === target) return;
            }
          } catch (e) {
            warn('episode up failed', e);
          }
          return up.apply(this, arguments);
        };
      }
    });
  }

  /* Запись Lampa.Timeline обновилась (плеер, синхронизация) — перерисовать
     карточку серии с этим хэшем во всех карточках в DOM (история Lampa держит
     и прошлые). Подписка — в 90_runtime.js, одна на всё время жизни плагина.
     Task 67: узлы есть только в окне, поэтому и обход идёт по окну. Серию за
     его краем перерисовывать нечего и не на чем — своё состояние она получит
     в тот момент, когда окно до неё доедет: mountWindow строит плитку через
     paintEpisode, а тот читает Lampa.Timeline заново. */
  function refreshEpisode(hash) {
    hash = '' + (hash || '');
    if (!/^\d+$/.test(hash)) return;
    var now = new Date();
    var months = monthsShort();
    $('.lumen-card .lumen-episodes').each(function () {
      var info = this.lumenEpisodes;
      if (!info) return;
      for (var i = info.from; i <= info.to; i++) {
        var node = info.nodes[i];
        if (!node || info.eps[i].hash !== hash) continue;
        paintEpisode(node, info.eps[i].ep, hash, now, months);
      }
    });
  }

  /* -------------------------------------------------------------------- */
  /* Task 5d: таблица «ПОДРОБНО» в ряду описания (design-spec §10, экран 07). */
  /* -------------------------------------------------------------------- */

  /* Подписи, месяцы и склонения — из LC.STRINGS (ru/en/uk), как у чипа
     следующей серии: LC.cardinfo.facts остаётся чистым и получает их
     параметром, про Lampa и язык интерфейса не знает. */
  function factWords() {
    return {
      original: LC.lang('lumen_card_fact_original'),
      premiere: LC.lang('lumen_card_fact_premiere'),
      creator: LC.lang('lumen_card_fact_creator'),
      budget: LC.lang('lumen_card_fact_budget'),
      months: ('' + LC.lang('lumen_card_months_gen')).split(',')
    };
  }

  /* Подпись данных таблицы: всё, из чего LC.cardinfo.facts собирает строки, но
     без самой сборки — числа и короткие строки, уже лежащие в e.data.movie.
     lang — любая строка интерфейса: меняется вместе с языком.

     Task 59 (фаза 5): из подписи ушли жанры, страны, хронометраж, число
     сезонов/серий и режиссёр — ни одно из этих полей в таблицу больше не
     попадает, и держать их здесь значило бы пересобирать блок на данных,
     которые его не меняют. Осталось ровно то, что facts() читает:
     идентификатор, название и оригинал (их сравнение решает строку
     «Оригинал»), дата премьеры, первый создатель сериала и бюджет фильма. */
  function factsSign(data, lang) {
    var movie = (data && data.movie) || {};
    return [movie.id, movie.title || movie.name, movie.original_title || movie.original_name,
      movie.release_date || movie.first_air_date,
      (movie.created_by && movie.created_by.length && movie.created_by[0] && movie.created_by[0].name) || '',
      movie.budget || 0, lang].join('|');
  }

  /* Ряд описания строит сама Lampa (компонент 'description', в её исходнике
     класс назван Descriptiopn): items_line -> .items-line__body -> .full-descr
     -> .full-descr__left (текст, детали, теги). Мы дописываем в .full-descr
     вторую колонку .lumen-facts — БЕЗ .selector: контроллер full_descr
     собирает .selector внутри ряда, и лишний фокусируемый узел изменил бы
     навигацию пультом (инвариант плана 0.3 п.2).

     Идемпотентно: повторный build, возврат на карточку backward'ом и запасной
     вызов на complite не должны дублировать блок — старый узел снимается
     перед вставкой. Сам .full-descr — та же точка вставки для отзывов
     Кинопоиска (Task 9): блок отзывов встанет соседом, эту разметку не трогая.

     Ревью Task 5d (Minor 5): блок живёт ровно столько, сколько узел ряда —
     своего таймера, слушателя и ссылок наружу у него нет, снимать его при
     закрытии карточки не нужно. Выключения оформления «на лету» у карточки
     нет вовсе: ui_active (90_runtime.js) выставляется один раз в LC.init и не
     гасится, а смена настроек пересобирает <style id="lumen-card-css">, а не
     удаляет его (LC.injectCss) — сценария «CSS снят, а .lumen-facts остался
     нестилизованным» на карточке не существует. Отдельный toggle(false) есть
     только у экранов торрентов, и у них свой <style>. */
  /* Фикс-раунд Task 59: полный текст описания по OK.

     Task 59 убрал описание из шапки, оставив «полное внизу». Но полным оно
     остаётся не всегда: как только нарисованы отзывы Кинопоиска, ряд
     получает класс .lumen-descr-row--reviews (src/60_reviews.js), а CSS
     поджимает текст до восьми строк с маской низа (src/30_css.js) — иначе
     карточки отзывов уезжают за нижний край экрана, потому что ВНУТРИ ряда
     описания Lampa не прокручивает (Descriptiopn.toggle делает только
     Navigator.move, app.min.js:38154-38160). Без раскрытия конец описания в
     этом случае недостижим вовсе.

     Раскрытие сделано модалом, а не снятием clamp'а при фокусе: выросший на
     70vh блок сдвинул бы вниз и теги, и карточки отзывов — ровно та беда,
     ради которой clamp и вводили.

     Узел .full-descr__text уже .selector — его делает сама Lampa
     (шаблон full_descr, app.min.js:2520), так что новых фокусируемых узлов
     не появляется и навигация пультом не меняется. Внутри модала .selector
     нет ни одного, и тогда стрелки листают его содержимое штатным Scroll
     (roll(), app.min.js:32485-32495) — длинный текст дочитывается целиком.

     Слушатель — в фазе перехвата на .full-descr: события Lampa идут через
     Utils.trigger с bubbles:false и делегированием их не поймать
     (API_NOTES_4 A2); тот же приём, что у ряда серий (bindEpisodes) и у
     кнопки раскрытия спойлеров (src/60_reviews.js). Вешается один раз на
     узел (флаг — свойство DOM-узла) и уходит вместе с рядом. */
  function openDescrModal(text, title, node) {
    try {
      if (!text || !window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return;
      /* Имя контроллера снимается ПЕРЕД открытием и возвращается на закрытии
         вместе с фокусом на сам текст — иначе Controller.toggle('full_descr')
         пересобирает коллекцию ряда и ставит фокус на свой последний элемент
         (находка Task 9, src/60_reviews.js openModal). */
      var back = 'full_descr';
      try {
        var enabled = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (enabled && enabled.name) back = enabled.name;
      } catch (e) { }

      var html = $('<div class="lumen-descr-modal"></div>');
      html.html('<div class="lumen-descr-modal__text">' + LC.util.esc(text) + '</div>');

      Lampa.Modal.open({
        title: title || '',
        html: html,
        size: 'medium',
        onBack: function () {
          try { Lampa.Modal.close(); } catch (e2) { }
          try { Lampa.Controller.toggle(back); } catch (e3) { }
          try {
            if (node && node.length && typeof Lampa.Controller.collectionFocus === 'function') {
              Lampa.Controller.collectionFocus(node, node.closest('.items-line'));
            }
          } catch (e4) { }
        }
      });
    } catch (err) {
      warn('descr modal failed', err);
    }
  }

  function bindDescrText(holder, movie) {
    var el = holder[0];
    if (!el || typeof el.addEventListener !== 'function') return;
    /* Текст и название перечитываются на каждой отрисовке ряда: узел
       .full-descr переживает смену карточки только в истории Lampa, но
       подписка должна остаться одна. */
    el.lumenDescrText = movie || null;
    if (el.lumenDescrBound) return;
    el.lumenDescrBound = true;

    el.addEventListener('hover:enter', function (event) {
      try {
        var node = $(event.target).closest('.full-descr__text', el);
        if (!node || !node.length) return;
        var card = el.lumenDescrText || {};
        openDescrModal(card.overview, card.title || card.name || '', node);
      } catch (err) {
        warn('descr enter failed', err);
      }
    }, true);
  }

  /* Подсказка «OK — весь текст» рядом с описанием. Свой узел, а не
     псевдоэлемент: строка пользовательская и обязана идти через LC.STRINGS
     во всех трёх языках. .selector ему не дают — фокусируемым остаётся сам
     текст, и число шагов пульта по ряду не меняется. Показывает подсказку
     CSS и только там, где текст действительно поджат
     (.lumen-descr-row--reviews). */
  function ensureDescrHint(holder, movie) {
    var left = holder.find('.full-descr__left');
    if (!left.length) return;
    var existing = left.find('.lumen-descr-more');
    if (!(movie && movie.overview)) {
      if (existing.length) existing.remove();
      return;
    }
    if (existing.length) return;
    left.append($('<div class="lumen-descr-more">' + LC.util.esc(LC.lang('lumen_card_descr_more')) + '</div>'));
  }

  function renderDescrRow(row, data) {
    if (!row || !row.length) return;
    var holder = row.find('.full-descr');
    if (!holder.length) return;

    row.addClass('lumen-descr-row');

    var card = (data && data.movie) || null;
    try { bindDescrText(holder, card); } catch (eBind) { warn('descr bind failed', eBind); }
    try { ensureDescrHint(holder, card); } catch (eHint) { warn('descr hint failed', eHint); }

    /* Ревью Task 5d (Minor 4): decorate ряда приходит дважды на открытие
       (build description и страховочный complite) с одним и тем же e.data —
       второй раз пропускаем целиком, до сборки словаря строк и пересчёта
       фактов, как renderEpisodes пропускает повторную сборку того же списка.
       Подпись дешёвая (без обхода жанров и съёмочной группы) и включает
       LC.lang: смена языка интерфейса перерисует таблицу. */
    var sign = factsSign(data, LC.lang('lumen_card_facts'));
    var previous = holder[0].lumenFacts;
    if (previous && previous.sign === sign && (!previous.count || holder.find('.lumen-facts').length)) return;

    holder.find('.lumen-facts').remove();
    holder[0].lumenFacts = { sign: sign, count: 0 };

    var list = LC.cardinfo.facts((data && data.movie) || null, factWords());
    if (!list.length) return;
    holder[0].lumenFacts = { sign: sign, count: list.length };

    var esc = LC.util.esc;
    var cells = [];
    for (var i = 0; i < list.length; i++) {
      cells.push('<div class="lumen-facts__label">' + esc(list[i].label) + '</div>');
      cells.push('<div class="lumen-facts__value">' + esc(list[i].value) + '</div>');
    }

    var block = $('<div class="lumen-facts"></div>');
    block.html('<div class="lumen-facts__title">' + esc(LC.lang('lumen_card_facts')) + '</div>' +
      '<div class="lumen-facts__grid">' + cells.join('') + '</div>');
    holder.append(block);
  }

  function decorate(root, data) {
    if (!root || !root.length) return;
    if (!root.hasClass('lumen-card')) return;

    var movie = (data && data.movie) || {};

    try { renderTitleClass(root, movie); } catch (e) { warn('title failed', e); }
    try { renderLogo(root, movie); } catch (e) { warn('logo failed', e); }
    try { renderMeta(root, movie); } catch (e) { warn('meta failed', e); }
    try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
    try { renderSerialMode(root, movie); } catch (e) { warn('serial mode failed', e); }
    try { renderNextChip(root, movie); } catch (e) { warn('next episode chip failed', e); }
    try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
    try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
    try { renderProgress(root, movie, (data && data.episodes && data.episodes.episodes) || null); } catch (e) { warn('progress failed', e); }
    try { renderEpisodes(root, data); } catch (e) { warn('episodes failed', e); }
    try { bindEpisodes(root); } catch (e) { warn('episodes bind failed', e); }
  }

  /* -------------------------------------------------------------------- */
  /* Одна лента людей вместо двух секций (разбор композиции, п.4.2).        */
  /* -------------------------------------------------------------------- */

  /* Lampa строит карточку из двух рядов-«persons»: сперва режиссёры
     (crew, отфильтрованные по job === 'Director', заголовок title_producer),
     следом актёры (cast, заголовок title_actors) —
     vendor/lampa/app.min.js:1419112-1419230. Обе секции рисуют одно и то же:
     портрет, имя, подпись роли (Line$2: role = character || job ||
     title_actor, app.min.js у шаблона full_person). Разница только в том,
     что в первой секции карточка одна: замер на стенде 960×540@2
     («Звёздные войны: Эпизод 5», интерфейс «обычный») — секция 156 CSS px
     высотой при ширине карточки 262, то есть 72.7 % строки пусто.

     Правка сводит их в одну ленту: режиссёры уходят в начало cast, и
     Lampa строит один ряд вместо двух. Ряд «Режиссер» не скрывается
     стилями и не разбирается в DOM — он просто не создаётся, потому что
     crew после правки не содержит ни одного Director.

     Точка вмешательства — обёртка над Lampa.Api.full, тот же приём, что у
     дедупликации рядов главной (src/44_rows.js, installDedupe). Раньше
     нельзя: rows компонент собирает прямо в колбэке Api.full. Позже тоже:
     событие 'complite' Lampa шлёт уже после build первых рядов
     (app.min.js:1422663-1422700), и ряд режиссёра к тому моменту построен.

     Подпись роли берётся из словаря самой Lampa (title_producer —
     «Режиссер»/«Producer»), своих строк правка не заводит: роль
     одного-двух человек в ленте не стоит третьего словаря. Запись crew
     копируется, а не правится на месте: тот же объект Lampa отдаёт экрану
     персоны по OK (router.call('actor', item)).

     Цена названа разбором: режиссёр перестаёт выделяться. Частично
     компенсируется тем, что он стоит первым и подпись у него смысловая, а
     не имя персонажа. У фильма с несколькими режиссёрами в начале ленты
     будет две-три карточки подряд с одинаковой подписью — это и есть тот
     случай, о котором разбор предупреждает. */
  var _fullOriginal = null;
  var _fullWrapped = null;
  var _peopleActive = false;

  function mergePeople(data) {
    if (!data || !data.persons) return data;
    var persons = data.persons;
    var cast = persons.cast;
    var crew = persons.crew;
    /* Нет актёров — сливать не с чем, и отдельная секция режиссёра
       остаётся единственным местом, где он вообще виден. */
    if (!cast || !cast.length || !crew || !crew.length) return data;

    var role = '';
    try {
      if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') role = Lampa.Lang.translate('title_producer');
    } catch (e) { }

    var directors = [];
    var rest = [];
    for (var i = 0; i < crew.length; i++) {
      var member = crew[i];
      if (member && member.job === 'Director') directors.push(member);
      else rest.push(member);
    }
    if (!directors.length) return data;

    var head = [];
    for (var j = 0; j < directors.length; j++) {
      var one = directors[j];
      var copy = {};
      for (var key in one) {
        if (Object.prototype.hasOwnProperty.call(one, key)) copy[key] = one[key];
      }
      copy.character = role || copy.job || '';
      head.push(copy);
    }

    persons.crew = rest;
    persons.cast = head.concat(cast);
    return data;
  }

  /* Идемпотентна в обе стороны: второй вызов ничего не переносит (в crew
     больше нет Director), а повторная установка не оборачивает саму себя. */
  function installPeople() {
    _peopleActive = true;
    if (_fullWrapped) return;
    try {
      if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.full !== 'function') return;
    } catch (e) { return; }
    _fullOriginal = Lampa.Api.full;
    _fullWrapped = function (object, oncomplite, onerror) {
      if (!_peopleActive) return _fullOriginal(object, oncomplite, onerror);
      return _fullOriginal(object, function (data) {
        try {
          mergePeople(data);
        } catch (e) {
          warn('people merge failed', e);
        }
        oncomplite(data);
      }, onerror);
    };
    try {
      Lampa.Api.full = _fullWrapped;
    } catch (eSet) {
      _fullWrapped = null;
      _fullOriginal = null;
    }
  }

  /* Снятие — как у обёртки главной: чужую подмену поверх нашей не срываем,
     свою гасим флагом, ссылки сохраняем (разбор — в src/44_rows.js,
     uninstallDedupe). */
  function uninstallPeople() {
    _peopleActive = false;
    if (!_fullWrapped) return;
    try {
      if (window.Lampa && Lampa.Api && Lampa.Api.full === _fullWrapped) {
        Lampa.Api.full = _fullOriginal;
        _fullWrapped = null;
        _fullOriginal = null;
      }
    } catch (e) { }
  }

  LC.header = {
    decorate: decorate,
    applyLogoPref: applyLogoPref,
    mergePeople: mergePeople,
    installPeople: installPeople,
    uninstallPeople: uninstallPeople,
    descr: renderDescrRow,
    refreshEpisode: refreshEpisode,
    bindStart: bindStart,
    refreshProgress: refreshProgress,
    scheduleProgressRefresh: scheduleProgressRefresh
  };

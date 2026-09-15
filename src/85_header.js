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
     жанры · 18+ · «реж. Имя» (у сериала режиссёр не показывается — там вместо
     него в строке оригинального названия стоит создатель, см. renderOriginal).
     Инлайн-чип качества/«СЕРИАЛ» из v1 убран — лишний узел, дизайну не
     соответствует (design-spec-card.md §2); раздельные чипы качества теперь
     в боковой колонке (renderQualityChips). */
  function renderMeta(root, movie, data) {
    var parts = [];
    var serial = isSerial(movie);

    var release = (movie.release_date || movie.first_air_date || '') + '';
    var year = release ? release.slice(0, 4) : '';
    if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');

    /* Штатный .full-start-new__head заполняется Lampa (start.js) ДО complite
       форматом «2024, США» — cardinfo.country сам отрезает год и падает на
       словарь ISO/английское имя, если head пуст (план 0.2, Task 5 3b.2). */
    var headText = root.find('.full-start-new__head').text();
    var countryText = LC.cardinfo.country(headText, movie.production_countries);
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
       экран 05), у фильма — режиссёр. */
    if (serial) {
      var studio = LC.cardinfo.network(movie);
      if (studio) parts.push('<span>' + LC.util.esc(studio) + '</span>');
    } else {
      var director = LC.cardinfo.director(data && data.persons && data.persons.crew);
      if (director) parts.push('<span>' + LC.util.esc(LC.lang('lumen_card_director')) + ' ' + LC.util.esc(director) + '</span>');
    }

    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i) html.push('<span class="lumen-meta__sep">·</span>');
      html.push(parts[i]);
    }

    root.find('.lumen-meta').html(html.join(''));
    root.addClass('lumen--meta');
  }

  /* Task 5a Step 3b.4: у сериала вместо режиссёра — created_by[0].name рядом
     с оригинальным названием («Fallout · Джонатан Нолан», экран 05). */
  function renderOriginal(root, movie) {
    var title = movie.title || movie.name || '';
    var original = movie.original_title || movie.original_name || '';
    var node = root.find('.lumen-original');
    if (!node.length) return;

    var text = (!original || original === title) ? '' : original;

    if (isSerial(movie)) {
      var creator = LC.cardinfo.creator(movie);
      if (creator) text = text ? (text + ' · ' + creator) : creator;
    }

    node.text(text);
  }

  /* Task 5a Step 3/3b: заголовок целиком — .lumen-title--long при длине > 18
     символов (класс переключает line-clamp 1 -> 2 в CSS, см. design-spec §3). */
  function renderTitleClass(root, movie) {
    var node = root.find('.full-start-new__title');
    if (!node.length) return;
    var title = movie.title || movie.name || '';
    node.removeClass('lumen-title--long');
    var cls = LC.cardinfo.titleClass(title);
    if (cls) node.addClass(cls);
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

  /* Task 5a Step 3/4: раздельные чипы качества (4K/HDR/BD) в боковой колонке
     вместо одного составного tag--quality (design-spec §5c). Штатный узел
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

  function renderProgress(root, movie) {
    var row = root.find('.lumen-progress');
    if (!row.length) return;

    row.addClass('hide');
    if (!LC.pref(PLUGIN + '_progress', true)) return;

    var found = isSerial(movie)
      ? LC.progress.serialProgress(movie, timelineView, utilsHash)
      : LC.progress.movieProgress(movie, timelineView, utilsHash);
    if (!found || !found.view || !(found.view.percent > 0)) return;

    var percent = Math.max(0, Math.min(100, Math.round(found.view.percent)));
    var label = LC.lang('lumen_card_continue');
    if (found.season) label += ' · S' + found.season + ' E' + found.episode;

    var time = '';
    if (found.view.duration > 0) time = LC.util.fmtTime(found.view.time) + ' / ' + LC.util.fmtTime(found.view.duration);
    else if (found.view.time > 0) time = LC.util.fmtTime(found.view.time);
    else time = percent + '%';

    row.find('.lumen-progress__label').text(label);
    row.find('.lumen-progress__time').text(time);
    row.find('.lumen-progress__bar > div').css('width', percent + '%');
    row.removeClass('hide');
  }

  function renderCast(root, data) {
    var block = root.find('.lumen-cast');
    if (!block.length) return;

    block.addClass('hide');
    block.find('.lumen-cast__row').empty();

    if (!LC.pref(PLUGIN + '_cast', true)) return;

    var cast = data && data.persons && data.persons.cast;
    if (!cast || !cast.length) return;

    var html = [];
    var limit = Math.min(5, cast.length);
    for (var i = 0; i < limit; i++) {
      html.push('<div class="lumen-cast__item">' + LC.util.esc(LC.util.initials(cast[i] && cast[i].name)) + '</div>');
    }
    if (cast.length > limit) {
      html.push('<div class="lumen-cast__item lumen-cast__more">+' + (cast.length - limit) + '</div>');
    }

    block.find('.lumen-cast__label').text(LC.lang('lumen_card_cast'));
    block.find('.lumen-cast__row').html(html.join(''));
    block.removeClass('hide');
  }

  /* -------------------------------------------------------------------- */
  /* Task 5c: сериал — статус в ленте рейтингов, чип следующей серии, ряд   */
  /* серий последнего сезона (design-spec §5e/§8/§9, экраны 05/06).         */
  /* -------------------------------------------------------------------- */

  /* Step 2 (design-spec §8, экран 05): у сериала статус стоит в ленте
     рейтингов перед чипом следующей серии, правая колонка — только качество.
     Узел статуса один, копию разметки не заводим: для сериала переносим этот
     же узел в ленту, остальное (вид карты вместо пилюли, скрытый каст) задаёт
     класс режима .lumen-card--serial. Корень каждой карточки строится из
     шаблона заново, поэтому у фильма статус всегда на месте в .lumen-side. */
  function renderSerialMode(root, movie) {
    var serial = isSerial(movie);
    root.toggleClass('lumen-card--serial', serial);
    if (!serial) return;
    var status = root.find('.full-start__status');
    var chip = root.find('.lumen-next-chip');
    if (status.length && chip.length && status.next()[0] !== chip[0]) chip.before(status);
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

  /* Step 2 (design-spec §5e): «Следующая серия — 17 декабря, через 31 день»;
     без next_episode_to_air или с датой в прошлом чип скрыт. */
  function renderNextChip(root, movie) {
    var chip = root.find('.lumen-next-chip');
    if (!chip.length) return;
    chip.addClass('hide');
    if (!isSerial(movie)) return;
    var next = LC.cardinfo.nextEpisode(movie.next_episode_to_air, new Date(), dateWords());
    if (!next) return;
    chip.find('.lumen-next-chip__text').text(next.text);
    chip.removeClass('hide');
  }

  var EPISODE_STATES = 'lumen-episode--watched lumen-episode--watching lumen-episode--aired lumen-episode--soon';

  /* Ревью п.3: у ежедневных шоу и аниме в сезоне бывает 100+ серий — грузить
     столько кадров сразу нельзя. URL лежит в data-still, background-image
     получают только карточки в окне ±6 от точки интереса (первая и текущая
     серия при отрисовке, фокусная — при листании). */
  var STILL_WINDOW = 6;

  /* Ревью п.6: кадр ставится через .css, а не в атрибут style: esc() кодирует
     апостроф как &#39;, который в атрибуте декодируется обратно и рвёт url('…').
     Внутри url("…") экранируются только " и \. */
  function applyStill(node) {
    var url = node.attr('data-still');
    if (!url) return;
    node[0].lumenStill = true;
    node.find('.lumen-episode__still').css('background-image', 'url("' + ('' + url).replace(/["\\]/g, '\\$&') + '")');
  }

  function loadStills(nodes, center) {
    var from = Math.max(0, center - STILL_WINDOW);
    var to = Math.min(nodes.length - 1, center + STILL_WINDOW);
    for (var i = from; i <= to; i++) {
      if (!nodes[i][0].lumenStill) applyStill(nodes[i]);
    }
  }

  /* Внутренность карточки серии по состоянию (design-spec §9): номер, бейдж
     (галочка у просмотренной, «32 %» у начатой; в фокусе вместо него кружок
     play — экран 06), название, подпись, полоса у начатой. Узел кадра пустой —
     картинку вешает applyStill, когда серия попадает в окно загрузки. */
  function episodeInner(ep, st, months, hasStill) {
    var esc = LC.util.esc;
    var min = LC.lang('lumen_card_min');
    var runtime = ep.runtime > 0 ? ep.runtime + ' ' + min : '';
    var caption = runtime;
    var badge = '';

    if (st.state === 'watched') {
      caption = (runtime ? runtime + ' · ' : '') + LC.lang('lumen_card_ep_watched');
      badge = '<div class="lumen-episode__check"></div>';
    } else if (st.state === 'watching') {
      caption = LC.lang('lumen_card_ep_watching') + (st.leftMin ? ' · ' + LC.lang('lumen_card_ep_left') + ' ' + st.leftMin + ' ' + min : '');
      badge = '<div class="lumen-episode__percent">' + st.percent + ' %</div>';
    } else if (st.state === 'soon') {
      var date = LC.cardinfo.shortDate(ep.air_date, months);
      caption = (date ? date + ' · ' : '') + LC.lang('lumen_card_ep_soon');
    }

    return '' +
      (hasStill ? '<div class="lumen-episode__still"></div>' : '') +
      '<div class="lumen-episode__top">' +
      '<div class="lumen-episode__num">E' + esc(ep.episode_number) + '</div>' + badge +
      '<div class="lumen-episode__play"></div>' +
      '</div>' +
      '<div class="lumen-episode__bottom">' +
      '<div class="lumen-episode__name">' + esc(ep.name || '') + '</div>' +
      (caption ? '<div class="lumen-episode__caption">' + esc(caption) + '</div>' : '') +
      (st.state === 'watching' ? '<div class="lumen-episode__bar"><div style="width:' + st.percent + '%"></div></div>' : '') +
      '</div>';
  }

  /* Класс состояния + внутренность; возвращает состояние. Сам узел не
     пересоздаётся — фокус Navigator и класс .focus переживают перерисовку.
     Ревью п.8: если состояние, процент и остаток те же, innerHTML не трогаем
     вовсе (Lampa шлёт update таймлайна каждые несколько секунд проигрывания). */
  function paintEpisode(node, ep, hash, now, months) {
    var view = hash ? timelineView(hash) : null;
    var st = LC.progress.episodeState(view, ep.air_date, now, ep.runtime);
    var sign = st.state + '|' + (st.percent || '') + '|' + (st.leftMin || '');
    if (node[0].lumenSign === sign) return st;

    node[0].lumenSign = sign;
    node.removeClass(EPISODE_STATES).addClass('lumen-episode--' + st.state).html(episodeInner(ep, st, months, !!node.attr('data-still')));
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
     формула плана 0.2 (как у Timeline.watchedEpisode и online_mod); он же
     пишется в data-hash, по нему refreshEpisode находит карточку.
     Ревью п.7: decorate зовётся дважды (build и complite) с одним и тем же
     e.data — повторную сборку того же списка пропускаем. */
  function renderEpisodes(root, data) {
    var row = root.find('.lumen-episodes');
    if (!row.length) return;

    var movie = (data && data.movie) || {};
    var list = data && data.episodes && data.episodes.episodes;
    var previous = row[0].lumenEpisodes;
    if (previous && list && previous.list === list) return;

    var track = row.find('.lumen-episodes__track');
    row.addClass('hide');
    track.empty();
    setShift(track, 0);
    row[0].lumenEpisodes = null;

    if (!isSerial(movie) || !list || !list.length) return;

    var season = parseInt(data.episodes.season_number, 10) || parseInt(list[0] && list[0].season_number, 10) || 0;
    var key = movie.original_name || movie.original_title || '';
    var months = monthsShort();
    var now = new Date();
    var nodes = [];
    var current = -1;

    for (var i = 0; i < list.length; i++) {
      var ep = list[i];
      if (!ep || !(ep.episode_number > 0)) continue;
      var hash = key && season ? '' + utilsHash([season, season > 10 ? ':' : '', ep.episode_number, key].join('')) : '';
      if (hash === '0') hash = '';
      var still = LC.cardinfo.imageUrl(ep.still_path, 'w300', tmdbImageFn(), apiImgFn());
      var node = $('<div class="lumen-episode selector"></div>');
      node.attr('data-index', i);
      if (hash) node.attr('data-hash', hash);
      if (still) node.attr('data-still', still);
      node[0].lumenPos = nodes.length;
      var st = paintEpisode(node, ep, hash, now, months);
      if (current < 0 && st.state === 'watching') current = nodes.length;
      track.append(node);
      nodes.push(node);
    }
    if (!nodes.length) return;

    row[0].lumenEpisodes = { list: list, nodes: nodes };
    /* Видно с самого начала ряда; если сериал уже смотрят — ещё и вокруг той серии. */
    loadStills(nodes, 0);
    if (current > 0) loadStills(nodes, current);

    row.find('.lumen-episodes__title').text(season ? LC.lang('lumen_card_season') + ' ' + season : (data.episodes.name || ''));
    row.find('.lumen-episodes__count').text(nodes.length + ' ' + LC.episodesWord(nodes.length));
    row.removeClass('hide');
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
    if (info && typeof node.lumenPos === 'number') loadStills(info.nodes, node.lumenPos);

    var screen = window.innerWidth || (document.documentElement && document.documentElement.clientWidth) || 0;
    var view = screen - viewport.getBoundingClientRect().left;
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
  }

  /* Step 4: фокус и OK на карточках серий. Lampa шлёт hover:focus/hover:enter
     через Utils.trigger — Event с bubbles:false, поэтому jQuery-делегирование
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

    el.addEventListener('hover:focus', function (e) {
      try {
        var node = $(e.target).closest('.lumen-episode', el);
        if (node.length) {
          root.addClass('lumen-compact');
          scrollToEpisode(root, node[0]);
        } else if ($(e.target).closest('.full-start-new__buttons', el).length) {
          root.removeClass('lumen-compact');
        }
      } catch (err) {
        warn('episode focus failed', err);
      }
    }, true);

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

  /* Запись Lampa.Timeline обновилась (плеер, синхронизация) — перерисовать
     карточку серии с этим хэшем во всех карточках в DOM (история Lampa держит
     и прошлые). Подписка — в 90_runtime.js, одна на всё время жизни плагина. */
  function refreshEpisode(hash) {
    hash = '' + (hash || '');
    if (!/^\d+$/.test(hash)) return;
    var now = new Date();
    var months = monthsShort();
    $('.lumen-card .lumen-episodes').each(function () {
      var info = this.lumenEpisodes;
      if (!info) return;
      for (var i = 0; i < info.nodes.length; i++) {
        var node = info.nodes[i];
        if (node.attr('data-hash') !== hash) continue;
        var ep = info.list[parseInt(node.attr('data-index'), 10)];
        if (ep) paintEpisode(node, ep, hash, now, months);
      }
    });
  }

  function decorate(root, data) {
    if (!root || !root.length) return;
    if (!root.hasClass('lumen-card')) return;

    var movie = (data && data.movie) || {};

    try { renderTitleClass(root, movie); } catch (e) { warn('title failed', e); }
    try { renderMeta(root, movie, data); } catch (e) { warn('meta failed', e); }
    try { renderOriginal(root, movie); } catch (e) { warn('original failed', e); }
    try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
    try { renderSerialMode(root, movie); } catch (e) { warn('serial mode failed', e); }
    try { renderNextChip(root, movie); } catch (e) { warn('next episode chip failed', e); }
    try { renderReactionsChip(root, data); } catch (e) { warn('reactions chip failed', e); }
    try { renderQualityChips(root, movie); } catch (e) { warn('quality chips failed', e); }
    try { renderProgress(root, movie); } catch (e) { warn('progress failed', e); }
    try { renderCast(root, data); } catch (e) { warn('cast failed', e); }
    try { renderEpisodes(root, data); } catch (e) { warn('episodes failed', e); }
    try { bindEpisodes(root); } catch (e) { warn('episodes bind failed', e); }
  }

  LC.header = { decorate: decorate, refreshEpisode: refreshEpisode };

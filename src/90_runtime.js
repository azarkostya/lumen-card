  /* -------------------------------------------------------------------- */
  /* Данные карточки.                                                      */
  /* -------------------------------------------------------------------- */

  function isSerial(movie) {
    return !!(movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes || movie.name);
  }

  function getCountries(movie) {
    var out = [];
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parseCountries === 'function') {
        out = Lampa.TMDB.parseCountries(movie) || [];
      }
    } catch (e) {
      warn('parseCountries failed', e);
    }
    if (out && out.length) return out;
    out = [];
    try {
      var i;
      if (movie.production_countries && movie.production_countries.length) {
        for (i = 0; i < movie.production_countries.length; i++) {
          out.push(movie.production_countries[i].name || movie.production_countries[i].iso_3166_1);
        }
      } else if (movie.origin_country && movie.origin_country.length) {
        for (i = 0; i < movie.origin_country.length; i++) out.push(movie.origin_country[i]);
      }
    } catch (e2) { }
    return out;
  }

  function getPG(movie, root) {
    var pg = '';
    try {
      if (window.Lampa && Lampa.TMDB && typeof Lampa.TMDB.parsePG === 'function') pg = Lampa.TMDB.parsePG(movie);
    } catch (e) { }
    if (!pg && root) {
      try {
        var node = root.find('.full-start__pg');
        if (node.length) pg = node.text();
      } catch (e2) { }
    }
    return pg ? ('' + pg) : '';
  }

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
    var out = [];
    try {
      if (movie.genres && movie.genres.length) {
        for (var i = 0; i < movie.genres.length && i < 3; i++) {
          if (movie.genres[i] && movie.genres[i].name) out.push(capitalize(movie.genres[i].name));
        }
      }
    } catch (e) { }
    return out;
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
  /* Бэкдроп.                                                              */
  /* -------------------------------------------------------------------- */

  function backdropUrl(movie) {
    var url = '';
    try {
      if (movie.backdrop_path && window.Lampa && Lampa.Api && typeof Lampa.Api.img === 'function') {
        url = Lampa.Api.img(movie.backdrop_path, 'w1280') || '';
      }
    } catch (e) {
      warn('Api.img failed', e);
    }
    if (!url && movie.background_image) url = movie.background_image;
    return url;
  }

  function procClass(movie) {
    var id = parseInt(movie && movie.id, 10);
    if (isNaN(id)) id = 0;
    return 'lumen-backdrop--proc' + (Math.abs(id) % 3);
  }

  function applyBackdrop(body, movie) {
    try {
      if (!body || !body.length) return;

      /* Родной фон Lampa убираем — у нас свой, на всю ширину. */
      body.find('.full-start__background').addClass('lumen-off');

      var layer = body.children('.lumen-backdrop');
      if (!layer.length) {
        layer = $('<div class="lumen-backdrop">' +
          '<div class="lumen-backdrop__img"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--l"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--b"></div>' +
          '<div class="lumen-backdrop__veil lumen-backdrop__veil--t"></div>' +
          '</div>');
        body.prepend(layer);
      }

      layer.removeClass('lumen-backdrop--proc0 lumen-backdrop--proc1 lumen-backdrop--proc2');

      var url = backdropUrl(movie);
      var img = layer.find('.lumen-backdrop__img');

      if (url) {
        img.css('background-image', '');
        var loader = new Image();
        loader.onload = function () {
          try {
            img.css('background-image', 'url("' + url + '")');
            layer.addClass('loaded');
          } catch (e) { }
        };
        loader.onerror = function () {
          try {
            img.css('background-image', '');
            layer.addClass(procClass(movie)).addClass('loaded');
          } catch (e) { }
        };
        loader.src = url;
      } else {
        img.css('background-image', '');
        layer.addClass(procClass(movie)).addClass('loaded');
      }
    } catch (e) {
      warn('backdrop failed', e);
    }
  }

  /* -------------------------------------------------------------------- */
  /* Отрисовка карточки.                                                   */
  /* -------------------------------------------------------------------- */

  function renderMeta(root, movie) {
    var parts = [];
    var serial = isSerial(movie);

    var release = (movie.release_date || movie.first_air_date || '') + '';
    var year = release ? release.slice(0, 4) : '';
    if (year) parts.push('<span>' + LC.util.esc(year) + '</span>');

    var countries = getCountries(movie);
    if (countries.length) parts.push('<span>' + LC.util.esc(countries.slice(0, 2).join(' · ')) + '</span>');

    if (serial) {
      var counts = [];
      if (movie.number_of_seasons) counts.push(movie.number_of_seasons + ' ' + seasonsWord(movie.number_of_seasons));
      if (movie.number_of_episodes) counts.push(movie.number_of_episodes + ' ' + episodesWord(movie.number_of_episodes));
      if (counts.length) parts.push('<span>' + LC.util.esc(counts.join(' · ')) + '</span>');
    } else if (movie.runtime > 0) {
      parts.push('<span>' + LC.util.esc(LC.util.fmtRuntime(movie.runtime, LC.lang('lumen_card_min'))) + '</span>');
    }

    var quality = !movie.first_air_date ? (movie.release_quality || movie.quality) : '';
    if (quality) parts.push('<span class="lumen-meta__chip">' + LC.util.esc(('' + quality).toUpperCase()) + '</span>');
    else if (serial) parts.push('<span class="lumen-meta__chip">' + LC.util.esc(LC.lang('lumen_card_serial')) + '</span>');

    var genres = getGenres(movie);
    if (genres.length) parts.push('<span>' + LC.util.esc(genres.join(', ')) + '</span>');

    var pg = getPG(movie, root);
    if (pg) parts.push('<span>' + LC.util.esc(pg) + '</span>');

    var html = [];
    for (var i = 0; i < parts.length; i++) {
      if (i) html.push('<span class="lumen-meta__sep">·</span>');
      html.push(parts[i]);
    }

    root.find('.lumen-meta').html(html.join(''));
    root.addClass('lumen--meta');
  }

  function renderOriginal(root, movie) {
    var title = movie.title || movie.name || '';
    var original = movie.original_title || movie.original_name || '';
    var node = root.find('.lumen-original');
    if (!node.length) return;
    if (!original || original === title) node.text('');
    else node.text(original);
  }

  function renderStatus(root, movie) {
    var node = root.find('.full-start__status');
    if (!node.length) return;

    /* Переносим статус из строки рейтингов в правую колонку. */
    var holder = root.find('.lumen-side__status');
    if (holder.length && !holder.find('.full-start__status').length) holder.append(node);

    node.removeClass('lumen-status--good lumen-status--accent lumen-status--muted');

    var status = ('' + (movie.status || '')).toLowerCase();
    var cls = 'lumen-status--muted';
    if (status.indexOf('return') >= 0 || status.indexOf('production') >= 0 || status.indexOf('progress') >= 0 || status.indexOf('planned') >= 0) cls = 'lumen-status--accent';
    else if (status.indexOf('released') >= 0) cls = 'lumen-status--good';
    node.addClass(cls);
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

  function decorate(root, data) {
    if (!root || !root.length) return;
    if (!root.hasClass('lumen-card')) return;

    var movie = (data && data.movie) || {};

    try { renderMeta(root, movie); } catch (e) { warn('meta failed', e); }
    try { renderOriginal(root, movie); } catch (e) { warn('original failed', e); }
    try { renderStatus(root, movie); } catch (e) { warn('status failed', e); }
    try { renderProgress(root, movie); } catch (e) { warn('progress failed', e); }
    try { renderCast(root, data); } catch (e) { warn('cast failed', e); }
  }

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

      try {
        Lampa.Template.add('full_start_new', LC.buildTemplate());
      } catch (e) {
        warn('template add failed', e);
        restoreOriginalTemplate();
        return;
      }

      LC.injectFonts();
      LC.injectCss();

      Lampa.Listener.follow('full', function (e) {
        try {
          if (!e) return;
          if (e.type === 'build' && e.name === 'start') {
            decorate(findRoot(e), e.data);
          } else if (e.type === 'complite') {
            decorate(findRoot(e), e.data);
            applyBackdrop(e.body, (e.data && e.data.movie) || {});
          }
        } catch (err) {
          warn('listener failed', err);
        }
      });
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

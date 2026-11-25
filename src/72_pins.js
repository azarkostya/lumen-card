  /* Закрепления хранятся на устройстве. Путь запуска остаётся штатным. */
  LC.pins = (function () {
    var KEY = 'lumen_pins';
    var CAP = 60;
    var saved = null;
    var pending = null;

    function enabled() {
      return (!LC.enabled || LC.enabled()) && (!LC.pref || !!LC.pref('lumen_pins_enabled', true));
    }

    function keyOf(card, season) {
      if (!card || !/^[a-z0-9_-]{1,40}$/i.test(String(card.id || ''))) return '';
      var tv = card.name || card.original_name || card.first_air_date;
      var n = parseInt(season, 10);
      return (tv ? 'tv:' : 'movie:') + card.id + (tv && n > 0 ? ':s' + n : '');
    }

    function seasonOf(element) {
      var season = parseInt(element.season || element.Season, 10) || 0;
      var title = String(element.Title || element.title || '');
      var re = /(?:^|[^a-z0-9])(?:s(?:eason[ ._-]*)?|сезон[ ._-]*)(\d{1,3})(?=e\d|[^a-z0-9]|$)/gi;
      var m;
      while ((m = re.exec(title))) {
        var n = Number(m[1]);
        if (season && season !== n) return 0;
        season = n;
      }
      return season;
    }

    function slim(uri) {
      if (!/^magnet:\?/i.test(uri)) return '';
      var parts = uri.slice(8).split('&');
      var xt = '';
      var dn = '';
      var trackers = [];
      for (var i = 0; i < parts.length; i++) {
        var part = parts[i];
        if (!xt && /^xt=urn(?::|%3a)btih(?::|%3a)(?:[a-f0-9]{40}|[a-z2-7]{32})$/i.test(part)) {
          xt = part.replace(/%3a/gi, ':');
        } else if (!dn && /^dn=.+/i.test(part) && part.length <= 512) {
          dn = part;
        } else if (trackers.length < 5 && /^tr=.+/i.test(part) && part.length <= 768 && trackers.indexOf(part) < 0) {
          trackers.push(part);
        }
      }
      return xt ? 'magnet:?' + [xt].concat(dn ? [dn] : [], trackers).join('&') : '';
    }

    function load() {
      if (saved) return saved;
      var map;
      try {
        map = Lampa.Storage.get(KEY, {});
        if (typeof map === 'string') map = JSON.parse(map);
      } catch (e) {}
      saved = map && typeof map === 'object' && !Array.isArray(map) ? map : {};
      return saved;
    }

    function save(map) {
      Lampa.Storage.set(KEY, map, true);
      saved = map;
    }

    function hashOf(value) {
      return LC.tsclean && LC.tsclean.hashOf ? LC.tsclean.hashOf(value) : '';
    }

    function itemLink(e) {
      var link = String(e.Link || '');
      return { magnet: slim(String(e.MagnetUri || link)), link: /^https?:\/\//i.test(link) && link.length <= 4096 ? link : '' };
    }

    function label(value) {
      return String(value || '').replace(/<[^>]*>/g, '').replace(/(?:https?:\/\/|magnet:\?)[^\s]+/gi, '').trim().slice(0, 220);
    }

    function put(card, element, at) {
      if (!enabled() || !element) return false;
      var key = keyOf(card, seasonOf(element));
      var media = itemLink(element);
      if (!key || !(media.magnet || media.link)) return false;
      var map = load();
      var keys = Object.keys(map).filter(function (k) { return k !== key; });
      keys.sort(function (a, b) { return Number(map[b].at) - Number(map[a].at); });
      var next = {};
      for (var i = 0; i < Math.min(keys.length, CAP - 1); i++) next[keys[i]] = map[keys[i]];
      var title = label(element.title || element.Title);
      var tags = LC.torrents && LC.torrents.releaseTags ? LC.torrents.releaseTags(title, element.ffprobe) : {};
      var stamp = at || Date.now();
      next[key] = {
        key: key, at: stamp, seen: stamp, magnet: media.magnet, link: media.magnet ? '' : media.link,
        hash: hashOf(media.magnet) || hashOf(element.hash), title: title, quality: tags.res || '',
        size: Number(element.size) || 0, seeds: Number(element.Seeders || element.seeders) || 0
      };
      save(next);
      return true;
    }

    function get(card, season) {
      if (!enabled()) return null;
      var base = keyOf(card);
      if (!base) return null;
      var map = load();
      var preferred = keyOf(card, season || card.number_of_seasons);
      if (map[preferred] || map[base]) return map[preferred] || map[base];
      if (season || base.indexOf('tv:') !== 0) return null;
      var newest = null;
      var keys = Object.keys(map);
      for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.indexOf(base + ':s') === 0 && (!newest || newest.at < map[key].at)) newest = map[key];
      }
      return newest;
    }

    function drop(key) {
      var map = load();
      if (!Object.prototype.hasOwnProperty.call(map, key)) return false;
      var next = {};
      Object.keys(map).forEach(function (k) { if (k !== key) next[k] = map[k]; });
      save(next);
      return true;
    }

    function protectedHashes() {
      var out = {};
      var map = load();
      Object.keys(map).forEach(function (key) {
        if (map[key].hash) out[map[key].hash] = true;
      });
      return out;
    }

    function esc(value) { return LC.util.esc(String(value || '')); }

    function subtitle(pin) {
      var pieces = [pin.title, pin.quality];
      if (pin.size > 0 && Lampa.Utils && Lampa.Utils.bytesToSize) pieces.push(Lampa.Utils.bytesToSize(pin.size));
      if (pin.seeds > 0) pieces.push(LC.lang('lumen_pins_was_seeding') + ' ' + pin.seeds);
      var date = new Date(pin.seen || pin.at);
      pieces.push(LC.util.pad2(date.getDate()) + '.' + LC.util.pad2(date.getMonth() + 1));
      return esc(pieces.filter(Boolean).join(' · '));
    }

    function activity() {
      return Lampa.Activity && Lampa.Activity.active ? Lampa.Activity.active() : null;
    }

    function watchFailure(fallback) {
      var listener = Lampa.Modal && Lampa.Modal.listener;
      if (!listener || !listener.follow || !listener.remove) return function () {};
      var owner = activity();
      var modal = null;
      var timer = 0;
      function cleanup() {
        clearTimeout(timer);
        listener.remove('preshow', show);
        listener.remove('update', update);
        listener.remove('close', close);
        if (pending === cleanup) pending = null;
      }
      function show(e) {
        if (modal) { cleanup(); return; }
        var params = e && e.active;
        if (params && params.html && params.html.hasClass && params.html.hasClass('modal-loading')) modal = params;
        else cleanup();
      }
      function close(e) { if (e && e.active === modal) cleanup(); }
      function update(e) {
        if (!modal || !e || e.active !== modal || !e.new_html || !e.new_html.hasClass) return;
        var html = e.new_html;
        if (!html.hasClass('error') && !html.hasClass('torrent-error')) {
          cleanup();
          return;
        }
        /* Штатное окно «нет хэша» выводит исходную ссылку. Не даём
           показать адрес закрепления, там может быть ключ парсера. */
        if (html.addClass) html.addClass('hide');
        cleanup();
        setTimeout(function () {
          if (activity() !== owner) return;
          try {
            if (modal.onBack) modal.onBack();
            if (activity() !== owner) return;
            if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(LC.lang('lumen_pins_fallback'));
            fallback();
          } catch (err) { warn('pin fallback failed'); }
        }, 0);
      }
      listener.follow('preshow', show);
      listener.follow('update', update);
      listener.follow('close', close);
      timer = setTimeout(cleanup, 95000);
      pending = cleanup;
      return function () { if (!modal) cleanup(); };
    }

    function open(card, season, fallback) {
      if (pending) pending();
      var pin = get(card, season);
      if (pin && LC.resume && LC.resume.openTorrent) {
        var finish = watchFailure(fallback);
        try {
          if (LC.resume.openTorrent(pin, card)) { finish(); return true; }
        } catch (err) { warn('pin open failed'); }
        if (pending) pending();
      }
      fallback();
      return false;
    }

    function isMine(pin, element) {
      if (!pin) return false;
      var media = itemLink(element);
      var hash = hashOf(media.magnet) || hashOf(element.hash);
      if (pin.hash && hash) return pin.hash === hash;
      return !!(pin.magnet && pin.magnet === media.magnet || pin.link && pin.link === media.link);
    }

    function refreshSnapshot(pin, element) {
      var seeds = Number(element.Seeders || element.seeders) || 0;
      var now = Date.now();
      if (seeds === pin.seeds && now - (pin.seen || pin.at) < 86400000) return;
      var map = load();
      var next = {};
      Object.keys(map).forEach(function (key) { next[key] = map[key]; });
      var copy = {};
      Object.keys(pin).forEach(function (key) { copy[key] = pin[key]; });
      copy.seeds = seeds;
      copy.seen = now;
      next[pin.key] = copy;
      save(next);
    }

    function onTorrent(e) {
      if (!enabled() || !e || !e.element || (e.type !== 'onlong' && e.type !== 'render')) return;
      var active = activity();
      var card = active && (active.movie || active.card);
      if (!card) return;
      var season = seasonOf(e.element);
      var pin = get(card, season);
      var mine = isMine(pin, e.element);
      var box = e.item && e.item.find('.torrent-item__ffprobe');
      function repaint(key) {
        if (!box || !box.length) return;
        box.find('.lumen-pin-tag').remove();
        if (key) {
          var chip = $('<div class="lumen-ttag lumen-pin-tag"></div>').text(LC.lang('lumen_pins_mine'));
          box.removeClass('hide').append(chip.attr('data-lumen-pin', key));
        } else if (!box[0].children.length) box.addClass('hide');
      }
      if (e.type === 'render') {
        if (mine) {
          repaint(pin.key);
          refreshSnapshot(pin, e.element);
        }
        return;
      }
      var media = itemLink(e.element);
      /* Lampa отмечает открытие раздачи через Torrent.opened. Уже
         закреплённую строку можно открепить и после снятия отметки. */
      if (!e.menu || !mine && (!e.element.viewed || !(media.magnet || media.link))) return;
      var back = Lampa.Controller.enabled().name;
      e.menu.push({
        title: LC.lang(mine ? 'lumen_pins_unpin' : 'lumen_pins_pin'),
        onSelect: function () {
          try {
            var key = keyOf(card, season);
            var changed = mine ? drop(pin.key) : put(card, e.element);
            if (changed) {
              if (!mine && active.activity && active.activity.render) {
                var chips = active.activity.render().find('.lumen-pin-tag[data-lumen-pin="' + key + '"]');
                chips.each(function () {
                  var parent = $(this).parent();
                  $(this).remove();
                  if (parent.length && !parent[0].children.length) parent.addClass('hide');
                });
              }
              repaint(mine ? '' : key);
              if (LC.header && LC.header.refreshPins) LC.header.refreshPins();
            }
          } catch (err) { warn('pin update failed'); }
          Lampa.Controller.toggle(back);
        }
      });
    }

    return { keyOf: keyOf, seasonOf: seasonOf, slim: slim, put: put, get: get, drop: drop,
      protectedHashes: protectedHashes, subtitle: subtitle, open: open, onTorrent: onTorrent };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.pins;

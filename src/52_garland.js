
  /* Гирлянда использует один набор декодированных картинок для текущего экрана. */
  LC.garland = (function () {
    var ROOT = 'assets/newyear/v1/';
    var TIMEOUT = 8000;
    var pack = null;
    var view = null;
    var failed = {};

    function base() {
      return LC.assetUrl(ROOT);
    }

    function staticOn() {
      return LC.pref('lumen_fx_garland_static', false);
    }

    function allowed() {
      if (!LC.enabled() || LC.pref('lumen_fx', 'seasonal') === 'off') return false;
      var theme = LC.themes.forHome();
      return !!theme && theme.id === 'newyear' && (LC.motionMode() !== 'off' || staticOn());
    }

    function nodeOf(host) {
      return host && (host.nodeType ? host : host[0]);
    }

    function load(path, changed) {
      var asset = { status: 'pending', img: null, cancel: function () {} };
      if (failed[path]) {
        asset.status = 'failed';
        return asset;
      }
      var img = new Image();
      asset.img = img;
      img.alt = '';
      var timer = setTimeout(function () { finish(false); }, TIMEOUT);
      function clear() {
        clearTimeout(timer);
        img.onload = img.onerror = null;
      }
      function finish(ok) {
        clear();
        asset.status = ok ? 'ready' : 'failed';
        if (!ok) {
          failed[path] = true;
          img.src = '';
          asset.img = null;
        }
        changed();
      }
      asset.cancel = function () {
        if (asset.status !== 'pending') return;
        clear();
        img.src = '';
        asset.img = null;
      };
      img.onload = function () { finish(true); };
      img.onerror = function () { finish(false); };
      img.src = base() + path;
      return asset;
    }

    function setBulbs(host, on) {
      if (LC.fx && LC.fx.bulbs) LC.fx.bulbs(host, on);
    }

    function glowPath() {
      if (LC.motionMode() !== 'full') return '';
      var weak = LC.perf && LC.perf.weakInfo && LC.perf.weakInfo();
      if (weak && LC.pref('lumen_motion', 'auto') !== 'full') return '';
      var small = window.innerWidth <= 960 && window.innerHeight <= 540;
      return (weak || small ? 'half/' : '') + 'garland-' + pack.style;
    }

    function stopGlow(current) {
      if (current.timer !== null) clearInterval(current.timer);
      current.timer = null;
      if (current.glow) {
        for (var i = 0; i < current.glow.length; i++) {
          var asset = current.glow[i];
          asset.cancel();
          if (asset.img && asset.img.parentNode) asset.img.parentNode.removeChild(asset.img);
        }
        current.glow = null;
      }
      if (current.node) current.node.className = current.baseClass;
    }

    function syncGlow(current) {
      var prefix = glowPath();
      if (current.glowPath === prefix) return;
      stopGlow(current);
      current.glowPath = prefix;
      if (!prefix) return;
      var node = current.node;
      function reveal() {
        if (view !== current) return;
        if (a.status === 'failed' || b.status === 'failed') {
          a.cancel();
          b.cancel();
          current.glow = null;
          return;
        }
        if (a.status !== 'ready' || b.status !== 'ready') return;
        a.img.className = 'lumen-garland__a';
        b.img.className = 'lumen-garland__b';
        node.appendChild(a.img);
        node.appendChild(b.img);
        var className = current.baseClass + ' has-glow';
        var phase = false;
        node.className = className;
        current.timer = setInterval(function () {
          if (document.hidden || (LC.covered && LC.covered()) || (current.paused && current.paused())) return;
          phase = !phase;
          node.className = className + (phase ? ' is-b' : '');
        }, 2400);
      }
      var a = load(prefix + '-a.webp', reveal);
      var b = load(prefix + '-b.webp', reveal);
      current.glow = [a, b];
      reveal();
    }

    function paint() {
      if (!view || view.node || !ready(view.card)) return;
      var node = document.createElement('div');
      node.className = 'lumen-garland lumen-garland--' + (pack.style === 'warm' ? 'warm' : 'cold');
      node.setAttribute('aria-hidden', 'true');
      if (!view.card && pack.orn) {
        pack.orn.img.className = 'lumen-garland__orn';
        node.appendChild(pack.orn.img);
      }
      pack.strip.img.className = 'lumen-garland__strip';
      node.appendChild(pack.strip.img);
      view.host.insertBefore(node, view.host.firstChild);
      view.node = node;
      view.baseClass = node.className;
      setBulbs(view.host, true);
      syncGlow(view);
    }

    function ready(card) {
      return !!pack && pack.strip.status === 'ready' && (card || !pack.orn || pack.orn.status === 'ready');
    }

    function discard() {
      if (!pack) return;
      pack.strip.cancel();
      if (pack.orn) pack.orn.cancel();
      pack = null;
    }

    function preload() {
      if (!allowed()) {
        unmount();
        discard();
        return false;
      }
      var style = 'warm';
      if (LC.pref('lumen_flat', false)) {
        style = LC.pref('lumen_fx_garland_apple', 'cold') === 'cold2' ? 'cold2' : 'cold';
      }
      if (pack && pack.style === style) return true;
      unmount();
      discard();
      pack = {
        style: style,
        strip: load('garland-' + style + '-still.webp', paint),
        orn: style === 'warm' ? load('ornaments-warm.webp', paint) : null
      };
      return true;
    }

    function mount(layer, opts) {
      var host = nodeOf(layer);
      var card = !!(opts && opts.card);
      var paused = opts && opts.paused;
      if (!host || !preload()) return;
      if (view && view.host === host && view.card === card) {
        view.paused = paused;
        if (view.node) {
          setBulbs(host, true);
          syncGlow(view);
        }
        return true;
      }
      unmount();
      view = { host: host, card: card, node: null, paused: paused, glow: null, glowPath: '', timer: null };
      paint();
      return true;
    }

    function unmount(layer) {
      if (!view || (layer && nodeOf(layer) !== view.host)) return;
      stopGlow(view);
      if (view.node) {
        if (view.node.parentNode) view.node.parentNode.removeChild(view.node);
        setBulbs(view.host, false);
      }
      view = null;
    }

    function release() {
      unmount();
      discard();
    }

    return { base: base, allowed: allowed, staticOn: staticOn, preload: preload, ready: ready, mount: mount, unmount: unmount, release: release };
  }());

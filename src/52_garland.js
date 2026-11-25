
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
      return host && (host.nodeType || host.insertBefore ? host : host[0]);
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

    function paint() {
      if (!view || view.node || !ready()) return;
      var node = document.createElement('div');
      node.className = 'lumen-garland lumen-garland--' + pack.style;
      node.setAttribute('aria-hidden', 'true');
      if (pack.orn) {
        pack.orn.img.className = 'lumen-garland__orn';
        node.appendChild(pack.orn.img);
      }
      pack.strip.img.className = 'lumen-garland__strip';
      node.appendChild(pack.strip.img);
      view.host.insertBefore(node, view.host.firstChild);
      view.node = node;
      setBulbs(view.host, true);
    }

    function ready() {
      return !!pack && pack.strip.status === 'ready' && (!pack.orn || pack.orn.status === 'ready');
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
      var style = LC.pref('lumen_flat', false) ? 'cold' : 'warm';
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

    function mount(layer) {
      var host = nodeOf(layer);
      if (!host || !preload()) return;
      if (view && view.host === host) {
        if (view.node) setBulbs(host, true);
        return true;
      }
      unmount();
      view = { host: host, node: null };
      paint();
      return true;
    }

    function unmount(layer) {
      if (!view || (layer && nodeOf(layer) !== view.host)) return;
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

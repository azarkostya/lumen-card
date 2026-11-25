
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

const source = readFileSync(new URL('../src/52_garland.js', import.meta.url), 'utf8');
function fixture() {
  const requests = [];
  const timers = new Map();
  const flags = [];
  const settings = {};
  let timer = 0;
  function node() {
    return {
      className: '', children: [], parentNode: null,
      setAttribute() {},
      appendChild(child) { this.insertBefore(child, null); },
      insertBefore(child, next) {
        if (child.parentNode) child.parentNode.removeChild(child);
        this.children.splice(next ? this.children.indexOf(next) : this.children.length, 0, child);
        child.parentNode = this;
      },
      removeChild(child) { this.children.splice(this.children.indexOf(child), 1); child.parentNode = null; },
      get firstChild() { return this.children[0] || null; }
    };
  }
  function Image() {
    const img = node();
    Object.defineProperty(img, 'src', { set(url) { if (url) requests.push({ img, url }); } });
    return img;
  }
  const document = { createElement: node, hidden: false };
  const window = { innerWidth: 1920, innerHeight: 1080 };
  const LC = {
    enabled: () => settings.enabled !== false,
    pref: (key, fallback) => settings[key] ?? fallback,
    motionMode: () => settings.mode || 'lite',
    themes: { forHome: () => settings.summer ? null : { id: 'newyear' } },
    assetUrl: (path) => 'https://example.test/beta/' + path,
    fx: { bulbs: (host, on) => flags.push([host, on]) },
    covered: () => settings.covered,
    perf: { weakInfo: () => settings.weak }
  };
  const schedule = (fn, ms) => { timers.set(++timer, { fn, ms }); return timer; };
  const cancel = (id) => timers.delete(id);
  vm.runInNewContext(source, { LC, document, window, Image, setTimeout: schedule, clearTimeout: cancel,
    setInterval: schedule, clearInterval: cancel });
  function finish(index, ok = true) { const { img } = requests[index]; (ok ? img.onload : img.onerror)(); }
  function tick(ms) { [...timers.values()].filter(t => t.ms === ms).forEach(t => t.fn()); }
  return { garland: LC.garland, host: node(), node, settings, requests, finish, flags, tick, timers, document, window };
}

test('Новогодний узел ждёт обе картинки, встаёт перед канвасом и переживает повторный mount', () => {
  const f = fixture();
  const canvas = f.node();
  f.host.appendChild(canvas);
  f.garland.preload();
  f.garland.mount(f.host);
  assert.deepEqual(f.requests.map(r => r.url.split('/').pop()), ['garland-warm-still.webp', 'ornaments-warm.webp']);
  f.finish(0);
  assert.equal(f.host.firstChild, canvas);
  f.finish(1);
  const picture = f.host.firstChild;
  assert.match(picture.className, /lumen-garland--warm/);
  assert.equal(picture.children[0].className, 'lumen-garland__orn');
  assert.equal(f.host.children[1], canvas);
  assert.deepEqual(f.flags.at(-1), [f.host, true]);
  f.garland.mount(f.host);
  assert.equal(f.host.firstChild, picture);
  assert.equal(f.host.children.length, 2);
  f.garland.unmount(f.host);
  assert.equal(f.host.firstChild, canvas);
  assert.deepEqual(f.flags.at(-1), [f.host, false]);
});

test('Вне сезона и при выключенных эффектах запросов нет, Apple загружает одну полосу', () => {
  const f = fixture();
  f.settings.summer = true;
  f.garland.preload();
  f.garland.mount(f.host);
  f.settings.summer = false;
  f.settings.lumen_fx = 'off';
  f.garland.preload();
  assert.equal(f.requests.length, 0);
  f.settings.lumen_fx = 'seasonal';
  f.settings.lumen_flat = true;
  f.garland.mount(f.host);
  assert.equal(f.requests.length, 1);
  assert.match(f.requests[0].url, /garland-cold-still\.webp$/);
  f.finish(0);
  assert.equal(f.host.firstChild.children.length, 1);
});

test('Сетевая ошибка или таймаут оставляют канвас и не повторяют запрос', () => {
  for (const timeout of [false, true]) {
    const f = fixture();
    f.garland.mount(f.host);
    if (timeout) f.tick(8000);
    else { f.finish(0, false); f.finish(1); }
    f.garland.mount(f.host);
    assert.equal(f.host.firstChild, null);
    assert.equal(f.requests.length, 2);
    assert.equal(f.flags.some(([, on]) => on), false);
  }
});

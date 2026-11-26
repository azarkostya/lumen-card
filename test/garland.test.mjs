
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
      nodeType: 1, className: '', children: [], parentNode: null,
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

test('Новогодняя полоса появляется сразу, дождётся украшений и переживает повторный mount', () => {
  const f = fixture();
  const canvas = f.node();
  f.host.appendChild(canvas);
  f.garland.preload();
  f.garland.mount(f.host);
  assert.deepEqual(f.requests.map(r => r.url.split('/').pop()), ['garland-warm-still.webp', 'ornaments-warm.webp']);
  assert.equal(f.host.firstChild, canvas);
  assert.deepEqual(f.flags.at(-1), [f.host, true], 'ожидание полосы гасит запасной провод');
  f.finish(0);
  const picture = f.host.firstChild;
  assert.equal(picture.children.length, 1);
  f.finish(1);
  assert.equal(f.host.firstChild, picture);
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

test('QA-01: jQuery-хост остаётся в герое вместе с гирляндой и канвасом', () => {
  const f = fixture();
  const hero = f.node();
  const canvas = f.node();
  hero.appendChild(f.host);
  f.host.appendChild(canvas);
  const wrapper = {
    0: f.host,
    length: 1,
    insertBefore() { hero.removeChild(f.host); }
  };

  f.garland.mount(wrapper);
  f.finish(0);
  f.finish(1);

  assert.equal(hero.firstChild, f.host, 'jQuery insertBefore не должен отсоединять слой');
  assert.match(f.host.firstChild.className, /lumen-garland--warm/);
  assert.equal(canvas.parentNode, f.host);
  assert.equal(f.host.children[1], canvas);
  assert.deepEqual(f.flags.at(-1), [f.host, true], 'FX получает DOM-узел слоя');
  f.garland.unmount(wrapper);
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
    assert.deepEqual(f.flags.at(-1), [f.host, false], 'только после отказа возвращается запасной провод');
  }
});

test('При выключенных анимациях нужна явная настройка статичной гирлянды', () => {
  const f = fixture();
  f.settings.mode = 'off';
  assert.equal(f.garland.allowed(), false);
  f.garland.mount(f.host);
  assert.equal(f.requests.length, 0);
  f.settings.lumen_fx_garland_static = true;
  assert.equal(f.garland.allowed(), true);
  f.garland.mount(f.host);
  f.finish(0);
  f.finish(1);
  assert.ok(f.host.firstChild);
  f.settings.lumen_fx = 'off';
  f.garland.preload();
  assert.equal(f.host.firstChild, null);
});

test('На карточке готовой полосы достаточно, а на главную возвращаются игрушки', () => {
  const f = fixture();
  const card = f.node();
  f.garland.mount(f.host);
  f.finish(0);
  f.garland.mount(card, { card: true });
  assert.equal(f.host.firstChild, null);
  assert.equal(card.firstChild.children.length, 1);
  f.finish(1);
  f.garland.mount(f.host);
  assert.equal(card.firstChild, null);
  assert.equal(f.host.firstChild.children.length, 2);
  assert.equal(f.requests.length, 2);
});

test('Полный режим меняет фазы только на видимом экране и отменяет таймер при снятии', () => {
  const f = fixture();
  let paused = false;
  f.settings.mode = 'full';
  f.garland.mount(f.host, { paused: () => paused });
  f.finish(0);
  f.finish(1);
  assert.match(f.requests[2].url, /garland-warm-a\.webp$/);
  assert.match(f.requests[3].url, /garland-warm-b\.webp$/);
  f.finish(2);
  f.finish(3);
  const picture = f.host.firstChild;
  assert.equal(picture.children.length, 4);
  f.tick(2400);
  assert.match(picture.className, /is-b/);
  for (const key of ['paused', 'hidden', 'covered']) {
    if (key === 'paused') paused = true;
    if (key === 'hidden') f.document.hidden = true;
    if (key === 'covered') f.settings.covered = true;
    f.tick(2400);
    assert.match(picture.className, /is-b/);
    paused = f.document.hidden = f.settings.covered = false;
  }
  f.tick(2400);
  assert.doesNotMatch(picture.className, /is-b/);
  f.garland.unmount(f.host);
  assert.equal(f.timers.size, 0);
});

test('Слабая приставка в Авто остаётся на статике, ручные Полные и 960×540 берут half', () => {
  for (const small of [false, true]) {
    const f = fixture();
    f.settings.mode = 'full';
    if (small) { f.window.innerWidth = 960; f.window.innerHeight = 540; }
    else f.settings.weak = true;
    f.garland.mount(f.host);
    f.finish(0);
    f.finish(1);
    if (!small) {
      assert.equal(f.requests.length, 2);
      f.settings.lumen_motion = 'full';
      f.garland.unmount(f.host);
      f.garland.mount(f.host);
    }
    assert.match(f.requests[2].url, /half\/garland-warm-a\.webp$/);
  }
});

test('Струна заменяет Подвесы в Apple TV и оставляет Ретро в Lumen', () => {
  const f = fixture();
  f.settings.lumen_flat = true;
  f.garland.mount(f.host);
  f.finish(0);
  const first = f.host.firstChild;
  f.settings.lumen_fx_garland_apple = 'cold2';
  f.garland.mount(f.host);
  assert.equal(f.host.firstChild, null);
  assert.match(f.requests[1].url, /garland-cold2-still\.webp$/);
  f.finish(1);
  assert.notEqual(f.host.firstChild, first);
  assert.match(f.host.firstChild.className, /lumen-garland--cold/);
  assert.equal(f.host.firstChild.children.length, 1);
  f.settings.lumen_flat = false;
  f.garland.mount(f.host);
  assert.match(f.requests[2].url, /garland-warm-still\.webp$/);
});

test('На открытой карточке смена режима переставляет только накладки', () => {
  const f = fixture();
  f.settings.mode = 'full';
  f.garland.mount(f.host, { card: true });
  f.finish(0);
  f.finish(1);
  f.finish(2);
  f.finish(3);
  const picture = f.host.firstChild;
  assert.equal(picture.children.length, 3);
  f.settings.mode = 'lite';
  f.garland.mount(f.host, { card: true });
  assert.equal(f.host.firstChild, picture);
  assert.equal(picture.children.length, 1);
  assert.equal(f.timers.size, 0);
  f.settings.mode = 'full';
  f.garland.mount(f.host, { card: true });
  f.finish(4);
  f.finish(5);
  assert.equal(picture.children.length, 3);
  assert.equal(f.timers.size, 1);
});

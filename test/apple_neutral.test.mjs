import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

/* Стиль Apple TV нейтральный: чёрный, серые, белый; акцент — только из
   настроек, системный красный #FF453A — для негатива. Тёплые утечки,
   найденные аудитом 2026-10-20, закрыты только для Apple TV — Lumen
   остаётся байт-в-байт (снимок ниже). */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const FRAME = '#FF7A00';
const FRAME_TOKENS = { color: FRAME, light: '#FFE7CC', glow: 'rgba(255,122,0,0.35)', onac: '#1A0B00' };
const TINT = '#2A1A10';
const ROWS = '#30200F';
const V2 = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^31_v2_.*\.js$/.test(f)).sort();

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function build(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    const files = ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js'].concat(V2, ['30_css.js', '65_torrents.js']);
    for (const name of files) loadInto(LC, module, name);
    LC.accent = { current: () => FRAME_TOKENS, tint: () => TINT, rowsTint: () => ROWS };
    LC.color = { rowsTint: () => ROWS };
    return {
      LC,
      css: LC.buildCss(),
      accentCss: LC.accentCss(),
      focusCss: LC.accentFocusCss(),
      tokens: LC.tokens(),
      stage: LC.stageTone({ r: 200, g: 120, b: 40 }),
      torrents: module.exports.css()
    };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

function digest(o) {
  const h = createHash('sha256');
  for (const k of ['css', 'accentCss', 'focusCss', 'torrents']) h.update(k + '\0' + o[k] + '\0');
  h.update(JSON.stringify(o.tokens) + JSON.stringify(o.stage));
  return h.digest('hex');
}

const LUMEN_SAMPLES = {
  warm: {},
  black_solid: { lumen_theme: 'black', lumen_solid: true, lumen_card_accent: 'wine' }
};

/* Снимок Lumen на beta 2693abc (до правок Apple TV). Если Lumen меняют
   намеренно — пересчитать: LC_PRINT_SNAPSHOT=1 node test/apple_neutral.test.mjs */
const LUMEN_SNAPSHOT = {
  warm: '5882b689fdbc485428756107a58c9da5a8b21d2c57edcc75219a04029d459c77',
  black_solid: '4e83d014a45e5d8ef17c0d341be24e6e68d58d01ddd64c79e7ac788271c75d8a'
};

if (process.env.LC_PRINT_SNAPSHOT) {
  for (const [name, prefs] of Object.entries(LUMEN_SAMPLES)) console.log(name, digest(build(prefs)));
}

const APPLE_PREFS = { lumen_flat: 'true', lumen_theme: 'black', lumen_card_accent: 'graphite', lumen_accent_scope: 'veil' };

function rgbOf(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].join(',');
}

test('Lumen: таблица, токены, путь TorrServer и тон подборок — байт-в-байт как до правок Apple TV', () => {
  for (const [name, prefs] of Object.entries(LUMEN_SAMPLES)) {
    assert.equal(digest(build(prefs)), LUMEN_SNAPSHOT[name], name);
  }
});

test('Apple TV: фон и фон рядов не подкрашиваются кадром (palette), тон подборок — фон темы', () => {
  const lumen = build({});
  const apple = build(APPLE_PREFS);
  assert.ok(lumen.css.includes(rgbOf(TINT)) && lumen.css.includes(rgbOf(ROWS)), 'Lumen подкрашивает фон');
  assert.ok(!apple.css.includes(rgbOf(TINT)), 'Apple TV: фон с подкраской кадра');
  assert.ok(!apple.css.includes(rgbOf(ROWS)), 'Apple TV: фон рядов с подкраской кадра');
  assert.ok(!apple.css.toUpperCase().includes(TINT) && !apple.css.toUpperCase().includes(ROWS));
  assert.equal(apple.tokens.bg, '#000000');
  assert.equal(lumen.stage.tone, ROWS);
  assert.equal(apple.stage.tone, '#000000');
});

test('Apple TV: процедурные фоны без кадра (proc0/1/2) — нейтральный тёмный градиент последним правилом, Lumen — «закат»', () => {
  const lumen = build({});
  const apple = build(APPLE_PREFS);
  const NEUTRAL = 'background:linear-gradient(180deg,#0B0B0D 0%,#1D1D21 55%,#0B0B0D 100%)';
  for (const i of [0, 1, 2]) {
    const sel = '.lumen-backdrop--proc' + i + ' .lumen-backdrop__img';
    /* Последнее правило с этим селектором побеждает (вес один). */
    const at = apple.css.lastIndexOf(sel);
    const open = apple.css.indexOf('{', at);
    assert.equal(apple.css.slice(open + 1, apple.css.indexOf('}', open)), NEUTRAL, sel);
    const lt = lumen.css.lastIndexOf(sel);
    assert.ok(lumen.css.slice(lt, lumen.css.indexOf('}', lt)).indexOf('radial-gradient') >= 0, 'Lumen: ' + sel);
  }
  assert.ok(lumen.css.includes('#D9622B 60%,#E8B87A 78%'));
  assert.ok(!lumen.css.includes(NEUTRAL));
});

test('Apple TV: штатные жёлтые метки Lampa (качество, «Просмотрено», tag--quality) — нейтральные и видимые', () => {
  const lumen = build({});
  const apple = build(APPLE_PREFS);
  const rules = [
    'html body .card__quality{background:rgba(28,28,30,.85);color:#FFFFFF}',
    'html body .card__marker--viewed::before{background-color:rgba(235,235,245,.6)}',
    'html body .full-start__tag.tag--quality{background:rgba(255,255,255,.16);color:#FFFFFF}'
  ];
  for (const rule of rules) {
    assert.ok(apple.css.includes(rule), rule);
    assert.ok(!lumen.css.includes(rule), 'Lumen: ' + rule);
  }
  assert.ok(!/html body \.card__quality\{[^}]*display:none/.test(apple.css));
});

test('Apple TV: без сохранённого акцента (или с неизвестным) — графит, Lumen — песок', () => {
  const graphite = '#BDB8B2';
  const sand = '#E8B87A';
  const read = (prefs) => {
    const o = build(prefs);
    o.LC.accent = null;
    globalThis.window = { Lampa: { Storage: { get: (n, d) => (n in prefs ? prefs[n] : d), field: (n) => prefs[n] } }, innerWidth: 960 };
    globalThis.Lampa = globalThis.window.Lampa;
    try { return o.LC.tokens().accent; } finally { delete globalThis.window; delete globalThis.Lampa; }
  };
  assert.equal(read({ lumen_flat: 'true', lumen_theme: 'black' }), graphite);
  assert.equal(read({ lumen_flat: 'true', lumen_theme: 'black', lumen_card_accent: 'nope' }), graphite);
  assert.equal(read({}), sand);
  assert.equal(read({ lumen_card_accent: 'nope' }), sand);
});

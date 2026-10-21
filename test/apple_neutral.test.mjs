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

/* Снимок Lumen после слияния окон и поиска v2, обрезки ленты поиска (21.10.2026) и 1.4: QA U4/U6/U10, U13 экрана раздач, метки раздач (правки Apple TV его не меняют). Если Lumen меняют
   намеренно — пересчитать: LC_PRINT_SNAPSHOT=1 node test/apple_neutral.test.mjs */
const LUMEN_SNAPSHOT = {
  warm: 'cddb67c6db5eb1bcb3385f18f83cc400b0974f4a49689321fe32e126a99f1d38',
  black_solid: '4d7251c3ca13b25d073f17401ba6dcb13359b17d544512352bc9918800f5944a'
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

test('Apple TV: меню карточки (удержание OK) — отметка выбранного пункта белая, Lumen без правила', () => {
  const M = 'body.selectbox--open .selectbox.lumen-cardmenu ';
  const rule = M + '.selectbox-item.selected:not(.nomark)::after,' + M + '.selectbox-item.picked::after{color:#FFFFFF !important;border-color:#FFFFFF !important}';
  assert.ok(build(APPLE_PREFS).css.includes(rule));
  assert.ok(!build({}).css.includes(rule));
});

test('Apple TV: фокус кнопок карточки, чипов и строк «Торрентов» — заливка, подпись и тень с !important (тема «Neon»)', () => {
  const apple = build(APPLE_PREFS).css;
  const lumen = build({}).css;
  const decl = (css, sel) => {
    const at = css.indexOf(sel + '{');
    assert.ok(at >= 0, sel);
    return css.slice(at + sel.length + 1, css.indexOf('}', at));
  };
  const btn = '.lumen-card .full-start-new__buttons .full-start__button.focus,.lumen-card .lumen-stop.focus,.lumen-card .lumen-franchise.focus,.lumen-hub__search.focus,.lumen-hub__roulette.focus';
  const b = decl(apple, btn);
  assert.match(b, /background-color:#FFFFFF !important/);
  assert.match(b, /;color:#000000 !important/);
  assert.match(b, /;box-shadow:0 \.44em \.96em rgba\(0,0,0,\.5\) !important/);
  assert.match(b, /;transform:scale\(1\.04\)(;|$)/, 'масштаб без !important — его гасят «Лёгкие»');
  const S = 'body.lumen-torrents-on .activity.lumen-torrents ';
  const F = 'body.lumen-torrents-on .modal .torrent-files.torrent-files ';
  const rows = [
    S + '.torrent-filter .simple-button.focus',
    S + '.torrent-list .torrent-item.focus',
    S + '.watched-history.focus',
    F + '.torrent-serial.focus,' + F + '.torrent-file.focus'
  ];
  /* Правило фокуса с заливкой (у строки в Apple TV есть и отдельное —
     скругление и линия). */
  const fillRule = (css, head) => {
    for (let at = css.indexOf(head); at >= 0; at = css.indexOf(head, at + 1)) {
      const body = css.slice(css.indexOf('{', at) + 1, css.indexOf('}', at));
      if (body.indexOf('background-color:') >= 0) return body;
    }
    return null;
  };
  for (const head of rows) {
    const body = fillRule(apple, head);
    assert.ok(body, head);
    assert.match(body, /background-color:#FFFFFF !important/, head);
    assert.match(body, /;color:#000000 !important/, head);
    assert.match(body, /;box-shadow:none !important/, head);
    assert.equal(fillRule(lumen, head).indexOf('!important'), -1, 'Lumen без !important: ' + head);
  }
});

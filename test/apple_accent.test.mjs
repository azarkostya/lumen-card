import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

/* Стиль Apple TV: акцент не берётся из кадра/постера (LC.accent.current —
   переопределение карточки и героя главной, акцент сезонной темы). В Apple
   TV таблица красит акцентом только цвет из настроек (графит пресета), цвет
   кадра остаётся на фоне. В Lumen — как прежде, акцент кадра работает.
   Заодно: путь TorrServer в Apple TV — без акцента и свечения, «спайс» —
   системный красный, полосы прогресса — белые. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const FRAME = '#FF7A00';
const FRAME_TOKENS = { color: FRAME, light: '#FFE7CC', glow: 'rgba(255,122,0,0.35)', onac: '#1A0B00' };
const V2 = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^31_v2_.*\.js$/.test(f)).sort();

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function build(storage, override) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    const files = ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js'].concat(V2, ['30_css.js', '65_torrents.js']);
    for (const name of files) loadInto(LC, module, name);
    LC.accent = { current: () => override, tint: () => null, rowsTint: () => null };
    return {
      css: LC.buildCss(),
      accentCss: LC.accentCss(),
      focusCss: LC.accentFocusCss(),
      tokens: LC.tokens(),
      torrents: module.exports.css()
    };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

const APPLE_PREFS = { lumen_flat: 'true', lumen_theme: 'black', lumen_card_accent: 'graphite', lumen_accent_scope: 'veil' };
const lumen = build({}, FRAME_TOKENS);
const apple = build(APPLE_PREFS, FRAME_TOKENS);
/* Apple TV со своим выбором акцента и с подсветкой «кнопки и фон». */
const appleWine = build({ lumen_flat: 'true', lumen_theme: 'black', lumen_card_accent: 'wine', lumen_accent_scope: 'all' }, FRAME_TOKENS);

function has(text, needle) {
  return text.toUpperCase().indexOf(needle.toUpperCase()) >= 0;
}

test('Lumen: акцент кадра по-прежнему красит таблицу и токены', () => {
  assert.ok(has(lumen.css, FRAME), 'в Lumen нет цвета кадра');
  assert.ok(has(lumen.css, '255,122,0'), 'в Lumen нет rgb цвета кадра');
  assert.equal(lumen.tokens.accent, FRAME);
  assert.ok(has(lumen.torrents, FRAME));
});

test('Apple TV: цвета кадра нет ни в таблице, ни в узлах подкраски, ни в пути TorrServer', () => {
  for (const [name, text] of Object.entries({ css: apple.css, accentCss: apple.accentCss, focusCss: apple.focusCss, torrents: apple.torrents })) {
    assert.ok(!has(text, FRAME), name + ': найден ' + FRAME);
    assert.ok(!has(text, '255,122,0'), name + ': найден rgb кадра');
  }
  for (const text of [appleWine.css, appleWine.accentCss, appleWine.focusCss, appleWine.torrents]) {
    assert.ok(!has(text, FRAME) && !has(text, '255,122,0'));
  }
});

test('Apple TV: LC.tokens() — акцент из настроек (графит), а не из кадра', () => {
  assert.equal(apple.tokens.accent, '#BDB8B2');
  assert.equal(apple.tokens.acglow, 'rgba(189,184,178,0.30)');
  assert.equal(apple.tokens.onac, '#131211');
  assert.equal(appleWine.tokens.accent, '#C46A8F');
  /* «Кнопки и фон» в Apple TV: подложка фокуса — акцентом настроек. */
  assert.ok(has(appleWine.focusCss, 'rgba(196,106,143,0.35)'));
});

test('Apple TV: путь TorrServer — белый/серый без свечения', () => {
  const css = apple.css;
  const H = 'html body.lumen-torrents-on ';
  assert.ok(css.includes(H + '.modal-loading:before{background:none}'));
  assert.ok(css.includes(H + '.modal-loading:after{background-color:#FFFFFF}'));
  assert.ok(css.includes(H + '.media-loading__mark-fill .media-loading__title{color:#FFFFFF;text-shadow:none}'));
  assert.ok(css.includes(H + '.media-loading__mark-fill .media-loading__logo{-webkit-filter:none;filter:none}'));
  assert.ok(css.includes(H + '.media-loading__peers:before{background-color:rgba(235,235,245,.64)}'));
  assert.ok(css.includes(H + '.torrent-item__viewed{background-color:#FFFFFF;color:#000000}'));
  assert.ok(css.includes(H + '.lumen-torrents .watched-history__icon{border-color:rgba(235,235,245,.64);background-color:transparent;color:rgba(235,235,245,.64)}'));
  assert.ok(css.includes(H + '.lumen-torrents .torrent-filter .filter--filter > div:not(.hide){background-color:#FFFFFF}'));
  assert.ok(css.includes(H + '.torrnet-folder-name.focus{color:#FFFFFF}'));
  assert.ok(css.includes(H + '.torrent-serial__progress{background-color:#FFFFFF;-webkit-box-shadow:none;box-shadow:none}'));
  assert.ok(css.includes(H + '.torrent-checklist__progress-bar > div{background-color:#FFFFFF}'));
  assert.ok(css.includes(H + '.torrent-checklist__footer .simple-button.focus{-webkit-box-shadow:none;box-shadow:none}'));
  /* Без масок спиннер — кольцо: белое, не залитый квадрат. */
  assert.ok(/@supports not [^{]+\{html body\.lumen-torrents-on \.modal-loading:after\{background-color:transparent;border-color:#FFFFFF\}\}/.test(css));
  /* Lumen этих правил не получает. */
  assert.ok(!lumen.css.includes(H));
});

test('Apple TV: «спайс» — системный красный в ошибке и негативном отзыве, «скоро» — тихим цветом', () => {
  /* Правила дописаны в конец таблицы (src/31_v2_apple_accent.js) и
     побеждают порядком; Lumen остаётся на «спайсе». */
  const last = (css, sel) => {
    const at = Math.max(css.lastIndexOf(sel + '{'), css.lastIndexOf(sel + ','));
    const open = css.indexOf('{', at);
    return css.slice(open + 1, css.indexOf('}', open));
  };
  for (const sel of ['.lumen-descr-row .lumen-review--bad .lumen-review__tone', '.lumen-descr-row .lumen-review--bad.focus .lumen-review__tone', '.lumen-review-modal--bad .lumen-review-modal__tone']) {
    assert.equal(last(apple.css, sel), 'background:#FF453A', sel);
    assert.equal(last(lumen.css, sel), 'background:#D9622B', sel);
  }
  assert.equal(last(apple.css, '.lumen-descr-row .lumen-fr-card__flag--soon'), 'color:' + apple.tokens.soft);
  assert.equal(last(lumen.css, '.lumen-descr-row .lumen-fr-card__flag--soon'), 'color:#D9622B');
  /* Круг ошибки в Modal: правило тяжелее правила пути (html …). */
  assert.ok(apple.css.includes('html body.lumen-menus-all .modal .error__ico,html .modal.lumen-modal .error__ico{background:#FF453A}'));
  assert.ok(!lumen.css.includes('.error__ico{background:#FF453A}'));
});

test('Apple TV: полосы прогресса — белые (последнее правило), Lumen — акцентом', () => {
  for (const sel of ['.lumen-card .lumen-progress__bar > div', '.lumen-grid .lumen-gcard__bar > div', '.lumen-main .lumen-badge-bar > div']) {
    const tail = apple.css.slice(apple.css.lastIndexOf(sel));
    assert.match(tail.slice(0, tail.indexOf('}')), /\{background:#FFFFFF$/, sel);
    const lt = lumen.css.indexOf(sel + '{');
    assert.match(lumen.css.slice(lt, lumen.css.indexOf('}', lt)), new RegExp('background:' + FRAME + '$'), sel);
    assert.equal(lumen.css.indexOf(sel + '{'), lumen.css.lastIndexOf(sel), sel + ': в Lumen лишнее правило');
  }
});

test('Смена стиля Lumen → Apple TV → Lumen на одном LC: пересборка берёт акцент по стилю', () => {
  const storage = {};
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    for (const name of ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js'].concat(V2, ['30_css.js'])) loadInto(LC, module, name);
    LC.accent = { current: () => FRAME_TOKENS, tint: () => null, rowsTint: () => null };
    assert.ok(has(LC.buildCss(), FRAME));
    Object.assign(storage, APPLE_PREFS);
    assert.ok(!has(LC.buildCss(), FRAME));
    assert.equal(LC.tokens().accent, '#BDB8B2');
    storage.lumen_flat = 'false';
    assert.ok(has(LC.buildCss(), FRAME));
    assert.equal(LC.tokens().accent, FRAME);
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

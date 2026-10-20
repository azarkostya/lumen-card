import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* v2 «Единый стиль»: штатные Select (.selectbox — списки, «Выход») и Modal
   (.modal — подтверждения) Lampa — src/31_v2_dialogs.js; устойчивость к
   теме CUB «Neon» у них, у меню карточки (экран 40) и левого меню (42). */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function build(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa: Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    for (const f of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '30_css.js', '31_v2_settings_menu.js', '31_v2_torrents_menu.js', '31_v2_dialogs.js']) loadInto(LC, module, f);
    return { css: LC.buildCss(), P: LC.tokens() };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

function rules(cssText) {
  const out = [];
  for (const line of cssText.split('\n')) {
    if (!line || /^@-?(webkit-)?keyframes/.test(line)) continue;
    let body = line;
    const media = /^@(media|supports)/.test(line) ? line.slice(0, line.indexOf('{')) : null;
    if (media) body = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
    for (const piece of body.split('}')) {
      const open = piece.indexOf('{');
      if (open === -1) continue;
      out.push({ media, selectors: piece.slice(0, open).split(',').map((s) => s.trim()), decl: piece.slice(open + 1) });
    }
  }
  return out;
}
function eff(cssText, sel) {
  return rules(cssText).filter((r) => r.selectors.indexOf(sel) !== -1).map((r) => r.decl).join(';');
}
function prop(decl, name) {
  const re = new RegExp('(?:^|;)' + name + ':([^;]*)', 'g');
  let m; let last = null;
  while ((m = re.exec(decl))) last = m[1];
  return last;
}
const bare = (v) => (v || '').replace(/\s*!important$/, '');
function rgbOf(c) {
  c = c.trim();
  if (c[0] === '#') return { rgb: [1, 3, 5].map((i) => parseInt(c.substr(i, 2), 16)), a: 1 };
  const p = /rgba?\(([^)]*)\)/.exec(c)[1].split(',').map(Number);
  return { rgb: p.slice(0, 3), a: p.length > 3 ? p[3] : 1 };
}
function over(fg, bg) {
  const f = rgbOf(fg); const b = rgbOf(bg).rgb;
  return f.rgb.map((v, i) => v * f.a + b[i] * (1 - f.a));
}
const hex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
function lum(rgb) {
  const k = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}
function contrast(fg, bg) {
  const a = lum(over(fg, bg)); const b = lum(rgbOf(bg).rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
/* Оранжевый: тон 15–50°, насыщенность HSL > .6. */
function orange(c) {
  const [r, g, b] = rgbOf(c).rgb.map((v) => v / 255);
  const max = Math.max(r, g, b); const min = Math.min(r, g, b); const l = (max + min) / 2;
  if (max === min) return false;
  const s = (max - min) / (1 - Math.abs(2 * l - 1));
  let h;
  if (max === r) h = 60 * (((g - b) / (max - min)) % 6);
  else if (max === g) h = 60 * ((b - r) / (max - min) + 2);
  else h = 60 * ((r - g) / (max - min) + 4);
  if (h < 0) h += 360;
  return s > 0.6 && h >= 15 && h <= 50;
}

/* Специфичность [id, класс/атрибут/псевдокласс, тип/псевдоэлемент];
   :not(x) считается по аргументу. */
function spec(sel) {
  let a = 0; let b = 0; let c = 0;
  sel = sel.replace(/:not\(([^)]*)\)/g, (m, x) => { const s = spec(x); a += s[0]; b += s[1]; c += s[2]; return ' '; });
  sel = sel.replace(/::?(before|after|first-letter|first-line)\b/g, () => { c++; return ' '; });
  sel = sel.replace(/\[[^\]]*\]/g, () => { b++; return ' '; });
  sel = sel.replace(/#[\w-]+/g, () => { a++; return ' '; });
  sel = sel.replace(/\.[\w-]+/g, () => { b++; return ' '; });
  sel = sel.replace(/:[\w-]+/g, () => { b++; return ' '; });
  c += (sel.match(/[a-zA-Z][\w-]*/g) || []).length;
  return [a, b, c];
}
const cmp = (x, y) => (x[0] - y[0]) || (x[1] - y[1]) || (x[2] - y[2]);

/* Тема CUB «Neon» (cub.best/extensions/212) — её правила для этих узлов,
   копия CSS темы. */
const NEON = {
  item: '.selectbox-item.focus',
  itemBefore: '.selectbox-item.focus::before',
  menu: '.menu__item.focus',
  menuAfter: '.menu__item.focus::after',
  menuFill: '.menu__item.focus .menu__ico path[fill]',
  menuStroke: '.menu__item.focus .menu__ico [stroke]',
  glow: '.simple-button.focus'
};
/* Путь TorrServer (src/65_torrents.js) — оба режима. */
const PATH = {
  item: ['body.lumen-menus-all .selectbox .selectbox-item', '.selectbox.lumen-select .selectbox-item'],
  focus: ['body.lumen-menus-all .selectbox .selectbox-item.focus', '.selectbox.lumen-select .selectbox-item.focus'],
  content: ['body.lumen-menus-all .selectbox .selectbox__content', '.selectbox.lumen-select .selectbox__content'],
  modal: ['body.lumen-menus-all .modal .modal__content', '.modal.lumen-modal .modal__content']
};

const G = 'html body .selectbox:not(.lumen-cardmenu) ';
const G0 = '.selectbox:not(.lumen-cardmenu) ';
const M = 'html body .modal.modal ';
const CM = 'body.selectbox--open .selectbox.lumen-cardmenu ';

const STYLES = {
  lumen: {},
  black: { lumen_theme: 'black' },
  apple: { lumen_flat: 'true', lumen_theme: 'black' }
};

for (const [name, storage] of Object.entries(STYLES)) {
  const { css, P } = build(storage);
  const apple = !!storage.lumen_flat;
  const FILL = apple ? '#FFFFFF' : P.text;
  const PANEL = apple ? '#1C1C1E' : P.panel;
  const ours = rules(css).filter((r) => r.selectors.some((s) => s.indexOf(G) === 0 || s.indexOf(G0) === 0 || s.indexOf('body .modal') === 0 || s.indexOf(M) === 0));

  test('v2 окна (' + name + '): Select — панель темы без размытия, фокус — заливка с !important', () => {
    const panel = eff(css, G + '.selectbox__content');
    assert.equal(prop(panel, 'background'), PANEL);
    assert.equal(prop(panel, 'backdrop-filter'), 'none');
    assert.equal(prop(eff(css, G + '.selectbox__layer'), 'backdrop-filter'), 'none');
    const f = eff(css, G + '.selectbox-item.focus');
    assert.equal(prop(f, 'background'), FILL + ' !important');
    assert.equal(prop(f, 'color'), P.bg + ' !important');
    assert.ok(contrast(P.bg, FILL) >= 4.5);
    assert.equal(prop(eff(css, G + '.selectbox-item.focus::before'), 'content'), 'none !important', '::before темы не снят');
    const sub = bare(prop(eff(css, G + '.selectbox-item.focus .selectbox-item__subtitle'), 'color'));
    assert.ok(contrast(sub, FILL) >= 4.5, 'описание на заливке: ' + contrast(sub, FILL).toFixed(2));
    const muted = prop(eff(css, G + '.selectbox-item__subtitle'), 'color');
    assert.equal(prop(eff(css, G + '.selectbox-item__subtitle'), 'opacity'), '1', 'штатная .7 Lampa снята');
    assert.ok(contrast(muted, PANEL) >= 4.5, 'описание на панели: ' + contrast(muted, PANEL).toFixed(2));
    assert.ok(contrast(prop(eff(css, G + '.selectbox-item'), 'color'), PANEL) >= 7, 'пункт на панели');
    assert.ok(contrast(prop(eff(css, G + '.settings-param-title > span'), 'color'), PANEL) >= 4.5, 'секция');
    assert.equal(prop(eff(css, G0 + '.selectbox__title'), 'font-weight'), '700', 'Light 300 запрещён');
    assert.equal(prop(eff(css, G0 + '.selectbox-item'), 'border-radius'), '.526em', 'скругление как у меню карточки');
  });

  test('v2 окна (' + name + '): Modal — панель темы, кнопка в фокусе — заливка, без свечения', () => {
    const c = eff(css, M + '.modal__content');
    assert.equal(prop(c, 'background-color'), PANEL);
    assert.equal(prop(c, 'backdrop-filter'), 'none');
    assert.equal(prop(eff(css, 'body .modal'), 'backdrop-filter'), 'none');
    const btn = eff(css, M + '.modal__button');
    const face = hex(over(prop(btn, 'background'), PANEL));
    assert.ok(contrast(prop(btn, 'color'), face) >= 4.5, 'кнопка: ' + contrast(prop(btn, 'color'), face).toFixed(2));
    const f = eff(css, M + '.modal__button.focus');
    assert.equal(prop(f, 'background'), FILL + ' !important');
    assert.equal(prop(f, 'color'), P.bg + ' !important');
    assert.equal(prop(f, 'box-shadow'), 'none !important', 'свечение .simple-button.focus темы');
    assert.ok(contrast(prop(eff(css, M + '.about'), 'color'), PANEL) >= 4.5, 'текст окна');
    assert.ok(contrast(prop(eff(css, M + '.modal__title'), 'color'), PANEL) >= 7);
    assert.equal(prop(eff(css, 'body .modal .modal__title'), 'font-weight'), '700');
    assert.equal(prop(eff(css, 'body .modal .about'), 'font-weight'), '500');
  });

  test('v2 окна (' + name + '): без размытия и без оранжевого, акцента темы нет', () => {
    const k = P.accent;
    for (const r of ours) {
      assert.equal(/blur\(/.test(r.decl), false, r.selectors[0]);
      for (const col of r.decl.match(/#[0-9A-Fa-f]{6}\b|rgba?\([^)]*\)/g) || []) {
        assert.equal(orange(col), false, r.selectors[0] + ': ' + col);
        if (k) assert.notEqual(col.toLowerCase(), k.toLowerCase(), r.selectors[0] + ': акцент');
      }
    }
    for (const sel of [CM + '.selectbox-item.focus', 'body .menu .menu__item.focus']) {
      assert.equal(orange(bare(prop(eff(css, sel), 'background'))), false, sel);
    }
  });

  test('v2 окна (' + name + '): тема «Neon» не перебивает фокус Select, меню карточки, левого меню и кнопок', () => {
    const pairs = [
      [G + '.selectbox-item.focus', NEON.item, ['background', 'color']],
      [CM + '.selectbox-item.focus', NEON.item, ['background', 'color']],
      ['body .menu .menu__item.focus', NEON.menu, ['background', 'color']],
      [M + '.modal__button.focus', NEON.glow, ['box-shadow']]
    ];
    for (const [sel, neon, props] of pairs) {
      assert.ok(cmp(spec(sel), spec(neon)) > 0, sel + ' легче ' + neon);
      const d = eff(css, sel);
      for (const p of props) assert.ok(/!important$/.test(prop(d, p) || ''), sel + ': ' + p + ' без !important');
    }
    for (const sel of [G + '.selectbox-item.focus::before', CM + '.selectbox-item.focus::before']) {
      assert.ok(cmp(spec(sel), spec(NEON.itemBefore)) > 0, sel);
      assert.equal(prop(eff(css, sel), 'display'), 'none !important', sel);
    }
    /* Левое меню: кольцо ::after снято; иконка — цветом подписи, не #fff. */
    const after = 'body .menu:not(.editable) .menu__item.focus:not(.traverse):after';
    assert.ok(cmp(spec(after), spec(NEON.menuAfter)) > 0);
    assert.equal(prop(eff(css, after), 'content'), 'none !important');
    assert.equal(prop(eff(css, 'body .menu .menu__item.focus:after'), 'box-shadow'), 'none !important', 'в режиме правки — без кольца');
    const fill = 'body .menu .menu__item.focus .menu__ico path[fill]:not([fill="none"])';
    const stroke = 'body .menu .menu__item.focus .menu__ico [stroke]:not([stroke="none"])';
    assert.ok(cmp(spec(fill), spec(NEON.menuFill)) > 0);
    assert.ok(cmp(spec(stroke), spec(NEON.menuStroke)) > 0);
    assert.equal(prop(eff(css, fill), 'fill'), P.bg + ' !important');
    assert.equal(prop(eff(css, stroke), 'stroke'), P.bg + ' !important');
    assert.equal(prop(eff(css, 'body .menu .menu__item.focus .menu__ico [fill="none"]'), 'fill'), 'none !important');
    /* Меню карточки: описание и замок на заливке — тоже с !important. */
    for (const sel of [CM + '.selectbox-item.focus .selectbox-item__subtitle', CM + '.selectbox-item.focus .selectbox-item__lock']) {
      assert.ok(/!important$/.test(prop(eff(css, sel), 'color')), sel);
    }
  });
}

test('v2 окна: каскад — меню карточки не задето, путь TorrServer держит раскладку, цвета — наши', () => {
  const { css } = build({ lumen_flat: 'true' });
  for (const r of rules(css)) {
    for (const s of r.selectors) {
      if (s.indexOf(G) === 0 || s.indexOf(G0) === 0) assert.equal(/lumen-cardmenu/.test(s.replace(':not(.lumen-cardmenu)', '')), false, s);
    }
  }
  for (const p of PATH.item) assert.ok(cmp(spec(G0 + '.selectbox-item'), spec(p)) <= 0, 'раскладка пути: ' + p);
  for (const p of PATH.item) assert.ok(cmp(spec(G + '.selectbox-item'), spec(p)) > 0, 'цвет пункта: ' + p);
  for (const p of PATH.focus) assert.ok(cmp(spec(G + '.selectbox-item.focus'), spec(p)) > 0, p);
  for (const p of PATH.content) assert.ok(cmp(spec(G + '.selectbox__content'), spec(p)) > 0, p);
  for (const p of PATH.modal) assert.ok(cmp(spec(M + '.modal__content'), spec(p)) > 0, p);
  /* Меню карточки по-прежнему тяжелее любых общих правил. */
  assert.ok(cmp(spec(CM + '.selectbox-item.focus'), spec(G + '.selectbox-item.focus')) > 0);
});

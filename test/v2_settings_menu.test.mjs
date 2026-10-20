import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* v2 «Единый стиль», экраны 41 (Настройки) и 42 (левое меню Lampa):
   src/31_v2_settings_menu.js. Таблица собирается тем же путём, что в
   сборке: модуль регистрируется в LC.v2css, LC.buildCss зовёт его build. */

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
    for (const f of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '30_css.js', '31_v2_settings_menu.js']) loadInto(LC, module, f);
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
/* Все объявления правил с селектором sel подряд, в порядке таблицы. */
function eff(cssText, sel, media) {
  return rules(cssText).filter((r) => r.selectors.indexOf(sel) !== -1 && (media === undefined || r.media === media)).map((r) => r.decl).join(';');
}
function prop(decl, name) {
  const re = new RegExp('(?:^|;)' + name + ':([^;]*)', 'g');
  let m; let last = null;
  while ((m = re.exec(decl))) last = m[1];
  return last;
}
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
function lum(rgb) {
  const k = rgb.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2];
}
function contrast(fg, bg) {
  const a = lum(over(fg, bg)); const b = lum(rgbOf(bg).rgb);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const STYLES = {
  lumen: {},
  black: { lumen_theme: 'black' },
  apple: { lumen_flat: 'true', lumen_theme: 'black' }
};

for (const [name, storage] of Object.entries(STYLES)) {
  const { css, P } = build(storage);
  const apple = !!storage.lumen_flat;

  test('v2, экран 41 (' + name + '): панель цвета темы, без «стекла», 720 px на FHD', () => {
    const panel = eff(css, 'body .settings .settings__content');
    assert.equal(prop(panel, 'background'), apple ? '#1C1C1E' : P.panel);
    assert.equal(prop(panel, 'backdrop-filter'), 'none', 'размытие на ТВ дорого');
    assert.equal(prop(eff(css, 'body .settings .settings__content', '@media screen and (min-width:768px)'), 'width'), '31.56em');
    assert.ok(Math.abs(31.56 * 22.811 - 720) < 1);
    assert.ok(/rgba\([\d,]+,\.55\)/.test(prop(eff(css, 'body.settings--open .settings__layer'), 'background')), 'затемнение .55 под панелью');
    assert.equal(/transition/.test(panel), false, 'фон панели не анимируется');
  });

  test('v2, экран 41 (' + name + '): фокус — заливка, описание на ней 70 % чернил (≥ 4.5:1), у пунктов Lampa и плагина', () => {
    const fill = apple ? '#FFFFFF' : P.text;
    /* QA v2 (P2): заливка и цвет — с !important, иначе тема CUB «Neon»
       (background:transparent !important; color:#fff !important) их снимает. */
    const imp = (v) => (v || '').replace(/\s*!important$/, '');
    for (const sel of ['body .settings .settings-param.focus', 'body .settings .settings-folder.focus', 'body .settings .settings-param[data-name^="lumen_"].focus']) {
      const d = eff(css, sel);
      assert.equal(prop(d, 'background'), fill + ' !important', sel);
      assert.equal(prop(d, 'color'), P.bg + ' !important', sel);
    }
    for (const sel of ['body .settings .settings-param.focus .settings-param__descr', 'body .settings .settings-param[data-name^="lumen_"].focus .settings-param__descr']) {
      const d = eff(css, sel);
      assert.equal(imp(prop(d, 'color')), 'rgba(0,0,0,.7)', sel);
      assert.equal(prop(d, 'opacity'), '1', sel);
      assert.ok(contrast('rgba(0,0,0,.7)', fill) >= 4.5, 'описание на заливке: ' + contrast('rgba(0,0,0,.7)', fill).toFixed(2));
    }
    /* Было #353535 на #262829 — 1.2:1. Заливка против панели — видна. */
    const panel = apple ? '#1C1C1E' : P.panel;
    assert.ok(contrast(fill, panel) >= 10, 'фокус корня на панели: ' + contrast(fill, panel).toFixed(2));
  });

  /* QA v2 (P2, основная Lampa с темой CUB «Neon»): тема рисует пункту в
     фокусе ::before с отступами 1em, кольцом и белой вуалью .2 — кольцо уже
     пункта, буквы и значение уходили под него («ерез», «Д»), текст P.bg
     оставался на сером. Правила темы — копия её CSS (cub.best/extensions/212). */
  test('v2, экран 41 (' + name + '): тема CUB «Neon» не перебивает фокус пункта', () => {
    const NEON = [
      '.settings-folder.focus,.settings-param.focus,.selectbox-item.focus{background:transparent !important;color:#fff !important}',
      ".settings-folder.focus::before,.settings-param.focus::before,.selectbox-item.focus::before{content:'';position:absolute;top:0;left:1em;right:1em;bottom:0;box-shadow:inset 0 0 1.5em,0 0 1.5em;outline:.2em solid;border-radius:.5em;background:rgba(255,255,255,0.2)}",
      '.settings-folder.focus .settings-folder__icon,.settings-param.focus .settings-folder__icon{-webkit-filter:unset !important;filter:unset !important}'
    ];
    /* Специфичность: у темы 2 класса, у нас body + .settings + 2 класса —
       при !important с обеих сторон побеждаем мы. */
    assert.ok(/background\s*:\s*transparent\s*!important/.test(NEON[0]));
    for (const sel of ['body .settings .settings-param.focus', 'body .settings .settings-folder.focus']) {
      const d = eff(css, sel);
      assert.ok(/!important$/.test(prop(d, 'background')), sel + ': заливка без !important');
      assert.ok(/!important$/.test(prop(d, 'color')), sel + ': цвет без !important');
    }
    for (const sel of ['body .settings .settings-param.focus:before', 'body .settings .settings-folder.focus:before']) {
      const d = eff(css, sel);
      assert.equal(prop(d, 'content'), 'none !important', sel + ': чужой ::before не снят');
      assert.equal(prop(d, 'display'), 'none !important', sel);
    }
    const ico = eff(css, 'body .settings .settings-param.focus .settings-folder__icon');
    assert.equal(prop(ico, 'filter'), 'invert(1) !important', 'иконка корня на светлой заливке инвертируется и под темой');
    for (const sel of ['body .settings .settings-param.focus .settings-param__value', 'body .settings .settings-param.focus .settings-param__descr']) {
      assert.ok(/!important$/.test(prop(eff(css, sel), 'color')), sel + ': цвет без !important — тема перекрасит в #fff на белом');
    }
  });

  test('v2, экран 41 (' + name + '): заголовок секции и описания — ≥ 4.5:1 на панели, заголовок светлее описания', () => {
    const panel = apple ? '#1C1C1E' : P.panel;
    const section = prop(eff(css, 'body .settings .settings-param-title > span'), 'color');
    const descr = prop(eff(css, 'body .settings .settings-param__descr'), 'color');
    const value = prop(eff(css, 'body .settings .settings-param__value'), 'color');
    assert.ok(contrast(section, panel) >= 4.5, 'секция ' + section + ': ' + contrast(section, panel).toFixed(2));
    assert.ok(contrast(descr, panel) >= 4.5, 'описание ' + descr + ': ' + contrast(descr, panel).toFixed(2));
    assert.ok(contrast(value, panel) >= 4.5, 'значение ' + value + ': ' + contrast(value, panel).toFixed(2));
    assert.ok(contrast(section, panel) > contrast(descr, panel), 'секция светлее описаний');
    assert.equal(prop(eff(css, 'body .settings .settings-param__descr'), 'opacity'), '1', 'полупрозрачность Lampa (.5) снята');
  });

  test('v2, экран 41 (' + name + '): значение — справа в строке имени, описание — второй строкой', () => {
    const row = eff(css, 'body .settings .settings-param');
    assert.equal(prop(row, 'display'), 'flex');
    assert.equal(prop(row, 'flex-wrap'), 'wrap', 'длинное значение уходит на свою строку, а не режется');
    assert.equal(prop(eff(css, 'body .settings .settings-param > *'), 'flex-basis'), '100%', 'описание — во всю ширину');
    assert.equal(prop(eff(css, 'body .settings .settings-param__name'), 'flex'), '1 1 auto');
    assert.equal(prop(eff(css, 'body .settings .settings-param__value'), 'text-align'), 'right');
    assert.equal(prop(eff(css, 'body .settings .settings__title'), 'font-weight'), '700', 'Light запрещён');
  });

  test('v2, экран 42 (' + name + '): левое меню — заливка фокуса, без белой плашки и черт, ширина и сдвиг совпадают', () => {
    const fill = apple ? '#FFFFFF' : P.text;
    const focus = eff(css, 'body .menu .menu__item.focus');
    /* С !important — тема CUB «Neon» ставит пункту transparent/#fff !important. */
    assert.equal(prop(focus, 'background'), fill + ' !important');
    assert.equal(prop(focus, 'color'), P.bg + ' !important');
    assert.equal(prop(eff(css, 'body .menu .menu__item.focus .menu__ico'), 'color'), P.bg, 'иконка — цветом подписи');
    assert.equal(prop(eff(css, 'body .menu .menu__split'), 'border-top'), '0');
    const left = eff(css, 'body:not(.light--version):not(.menu--always) .wrap__left');
    const shift = eff(css, 'body.menu--open:not(.light--version):not(.menu--always) .wrap__left');
    assert.equal(prop(left, 'width'), '21.04em');
    assert.equal(prop(left, 'margin-left'), '-21.04em');
    assert.equal(prop(shift, 'transform'), 'translate3d(21.04em,0,0)', 'меню выезжает ровно на свою ширину');
    assert.equal(prop(eff(css, 'body .menu .menu__text'), 'font-weight'), '500', 'Light (300) Lampa запрещён');
    const under = eff(css, 'body.menu--open:not(.light--version):not(.menu--always) .wrap__left:before');
    if (apple) assert.ok(/linear-gradient\(90deg,#000 0%/.test(under) && /width:100vw/.test(under), 'Apple TV — затемнение без коробки: ' + under);
    else assert.equal(prop(under, 'background'), P.panel, 'Lumen — панель цвета темы');
  });
}

test('v2, экраны 41–42: гарнитура плагина на панели и в меню; «Как в Lampa» — без font-family', () => {
  const on = build({}).css;
  assert.ok(/font-family:/.test(eff(on, 'body .settings .settings__content')));
  assert.ok(/font-family:/.test(eff(on, 'body .menu .menu__item')));
  const off = build({ lumen_font: 'system' }).css;
  assert.equal(/font-family:/.test(eff(off, 'body .settings .settings__content')), false);
  assert.equal(/font-family:/.test(eff(off, 'body .menu .menu__item')), false);
});

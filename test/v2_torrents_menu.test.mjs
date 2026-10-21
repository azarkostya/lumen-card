import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

/* v2 «Единый стиль», экраны 39 (Торренты) и 40 (меню по удержанию OK):
   CSS-модуль src/31_v2_torrents_menu.js через точку подключения LC.v2css
   (src/30_css.js), разбивка названия раздачи (src/65_torrents.js), якорь
   панели меню (src/63_cardmenu.js) и подпись секции «Ещё». */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function cssWith(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    for (const name of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '31_v2_torrents_menu.js', '30_css.js']) loadInto(LC, module, name);
    return LC.buildCss();
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

const lumen = cssWith({});
const apple = cssWith({ lumen_flat: 'true', lumen_theme: 'black' });

/* Первое правило, где селектор стоит целиком (сам по себе или в списке). */
function rule(css, selectorPart) {
  let at = -1;
  for (let i = css.indexOf(selectorPart); i >= 0; i = css.indexOf(selectorPart, i + 1)) {
    const next = css.charAt(i + selectorPart.length);
    if (next === '{' || next === ',') { at = i; break; }
  }
  assert.ok(at >= 0, 'нет правила ' + selectorPart);
  return css.slice(at, css.indexOf('}', at) + 1);
}

test('39: экран раздач — фон темы, постер и описание скрыты, шапка компактная', () => {
  assert.match(lumen, /body\.lumen-torrents-on \.activity\.lumen-torrents\{background-color:#0B0908;/);
  assert.match(rule(lumen, '.explorer-card__descr'), /display:none !important/);
  assert.match(rule(lumen, 'body.lumen-torrents-on .activity.lumen-torrents .explorer-card__title'), /font-size:2\.455em/);
});

test('39: «16+» после меты с отступом .5em, а не поверх рейтинга', () => {
  assert.match(rule(lumen, 'body.lumen-torrents-on .activity.lumen-torrents .explorer-card__head-age'), /margin:0 0 0 \.5em/);
  assert.match(lumen, /explorer-card__head-age\{-webkit-order:4;order:4\}/);
  assert.match(apple, /explorer-card__head-age\{-webkit-order:3;order:3;margin:0 \.45em 0 \.55em\}/);
});

test('39: строки раздач — Lumen на подложке r14, Apple TV разделены линией; фокус — заливка без кольца', () => {
  const row = 'body.lumen-torrents-on .activity.lumen-torrents .torrent-list .torrent-item';
  assert.match(rule(lumen, row), /border-radius:\.614em;background-color:#221A13/);
  assert.match(rule(apple, row), /background-color:transparent/);
  assert.match(apple, new RegExp(row.replace(/\./g, '\\.') + '\\{border-bottom:\\.044em solid rgba\\(255,255,255,\\.14\\)\\}'));
  assert.ok(lumen.includes(row + '.focus{background-color:#F3EDE4;color:#0B0908'));
  /* Apple TV: заливка и подпись с !important — тема CUB «Neon». */
  assert.ok(apple.includes(row + '.focus{background-color:#FFFFFF !important;color:#000000 !important'));
  assert.match(lumen, /\.torrent-item\.focus::after\{display:none\}/);
});

test('39: вторичный текст ≥ 4.5:1 — P.soft/P.muted в Lumen, secondary .8/.64 в Apple TV', () => {
  const a = 'body.lumen-torrents-on .activity.lumen-torrents .torrent-list .torrent-item .lumen-tt-a';
  assert.match(rule(lumen, a), /color:#DCD3C8/);
  assert.match(rule(apple, a), /color:rgba\(235,235,245,\.8\)/);
  assert.match(rule(lumen, 'body.lumen-torrents-on .activity.lumen-torrents .torrent-list .torrent-item .lumen-tt-b'), /font-weight:700/);
});

test('39: правила экрана тяжелее правил пути TorrServer (их <style> стоит позже)', () => {
  /* body.lumen-torrents-on .torrent-item.focus — (0,3,1) у src/65_torrents.js. */
  assert.match(lumen, /body\.lumen-torrents-on \.activity\.lumen-torrents \.torrent-list \.torrent-item\.focus\{/);
  assert.match(lumen, /body\.lumen-torrents-on \.modal \.torrent-files\.torrent-files \.torrent-serial\.focus/);
});

test('39·F: прогресс файлов — 12 px акцентом (L), 10 px белым (A) на 4K', () => {
  assert.match(rule(lumen, 'body.lumen-torrents-on .modal .torrent-files.torrent-files .torrent-serial .time-line'), /height:\.263em/);
  assert.match(rule(apple, 'body.lumen-torrents-on .modal .torrent-files.torrent-files .torrent-serial .time-line > div'), /background-color:#FFFFFF/);
});

test('40: меню карточки — плавающая панель без размытия, r 36@4K, поля 60 px FHD', () => {
  const sel = 'body.selectbox--open .selectbox.lumen-cardmenu .selectbox__content';
  const a = rule(apple, sel);
  assert.match(a, /background:rgba\(28,28,30,\.92\)/);
  assert.match(a, /backdrop-filter:none/);
  assert.match(a, /border-radius:\.79em/);
  assert.match(a, /bottom:3\.125vw/);
  assert.match(a, /height:auto !important/);
  assert.match(rule(lumen, sel), /background:#231C16/);
  assert.match(lumen, /lumen-cardmenu--anchored \.selectbox__content\{left:var\(--lc-anchor-x\);right:auto\}/);
  assert.match(rule(lumen, 'body.selectbox--open .selectbox.lumen-cardmenu .selectbox__head'), /display:none/);
});

test('40: секции обычным регистром, чекбокс с видимой рамкой, замок мелкий, конец списка растворяется', () => {
  const M = 'body.selectbox--open .selectbox.lumen-cardmenu ';
  assert.match(rule(lumen, M + '.settings-param-title'), /text-transform:none/);
  assert.match(rule(lumen, M + '.selectbox-item__checkbox'), /border:\.11em solid #A89A8A/);
  assert.match(rule(apple, M + '.selectbox-item__checkbox'), /rgba\(235,235,245,\.6\);border-radius:50%/);
  assert.match(rule(lumen, M + '.selectbox-item__lock > svg'), /width:\.877em !important/);
  assert.match(rule(lumen, M + '.selectbox__body'), /mask-image:linear-gradient/);
});

test('40: секция плагина в меню — «Ещё», слова «Lumen Card» нет', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '80_settings.js');
  const s = LC.STRINGS.lumen_menu_section;
  assert.deepEqual([s.ru, s.en, s.uk], ['Ещё', 'More', 'Ще']);
});

test('39: важная часть названия — после последнего « / » или последний пункт в [ ]', () => {
  const LC = { menus: { MARK_SELECT: 'lumen-select', MARK_MODAL: 'lumen-modal' }, icons: { NO_MASK: '@supports x' } };
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '65_torrents.js');
  const split = module.exports.splitTitle;
  assert.deepEqual(split('Отступники / The Departed / 2006 / ДБ, СТ / BDRip (1080p) | Дубляж'),
    ['Отступники / The Departed / 2006 / ДБ, СТ / ', 'BDRip (1080p) | Дубляж']);
  assert.deepEqual(split('Отступники / The Departed (Мартин Скорсезе / Martin Scorsese) [2006, США, драма, BDRip-AVC] Dub + AVO'),
    ['Отступники / The Departed (Мартин Скорсезе / Martin Scorsese) [2006, США, драма, ', 'BDRip-AVC] Dub + AVO']);
  assert.equal(split('The Departed 2006 1080p'), null);
  assert.equal(split(''), null);
});

test('40: якорь панели — справа от постера, не влезает — слева, иначе без якоря', () => {
  const M = load('63_cardmenu.js');
  /* Окно 960 CSS px: панель 300, поле 30, зазор 15. */
  assert.equal(M.platterX({ left: 40, right: 150 }, 960), 165);
  assert.equal(M.platterX({ left: 700, right: 810 }, 960), 385);
  assert.equal(M.platterX({ left: 200, right: 760 }, 960), null);
  assert.equal(M.platterX(null, 960), null);
});

test('39: render раздачи — название делится на две части, подписи сидов/пиров сняты, размер с запятой', () => {
  const LC = { menus: { MARK_SELECT: 'lumen-select', MARK_MODAL: 'lumen-modal' }, icons: { NO_MASK: '@supports x' } };
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '65_torrents.js');
  const node = (text) => ({
    nodeType: 1, attrs: {}, childNodes: text == null ? [] : [{ nodeType: 3, data: text }],
    get textContent() { return this.childNodes.map((c) => (c.nodeType === 3 ? c.data : c.textContent)).join(''); },
    set textContent(v) { this.childNodes = v ? [{ nodeType: 3, data: v }] : []; },
    getAttribute(n) { return this.attrs[n] || null; },
    setAttribute(n, v) { this.attrs[n] = v; },
    appendChild(c) { this.childNodes.push(c); return c; },
    removeChild(c) { this.childNodes.splice(this.childNodes.indexOf(c), 1); return c; }
  });
  const title = node('Отступники / The Departed / 2006 / BDRip (1080p) | Дубляж');
  const seeds = node('Раздают: '); seeds.childNodes.push(Object.assign(node('148'), { tag: 'span' }));
  const grabs = node('Качают: '); grabs.childNodes.push(Object.assign(node('9'), { tag: 'span' }));
  const size = node('19.52 ГБ');
  const map = { '.torrent-item__title': [title], '.torrent-item__seeds, .torrent-item__grabs': [seeds, grabs], '.torrent-item__size': [size] };
  const item = { find: (sel) => map[sel] || [] };
  const follows = {};
  globalThis.document = {
    body: { classList: { contains: (c) => c === 'lumen-torrents-on' } },
    createElement: () => node(null)
  };
  globalThis.Lampa = {
    Listener: { follow: (name, cb) => { follows[name] = cb; } },
    Storage: { get: () => 'ru' },
    Activity: { active: () => null }
  };
  globalThis.window = { Lampa: globalThis.Lampa };
  try {
    module.exports.install();
    follows.torrent({ type: 'render', item });
    follows.torrent({ type: 'render', item });
    assert.equal(title.childNodes.length, 2, 'делится один раз');
    assert.equal(title.childNodes[0].className, 'lumen-tt-a');
    assert.equal(title.childNodes[1].className, 'lumen-tt-b');
    assert.equal(title.childNodes[1].textContent, 'BDRip (1080p) | Дубляж');
    assert.equal(seeds.textContent, '148');
    assert.equal(grabs.textContent, '9');
    assert.equal(size.textContent, '19,52 ГБ');
  } finally {
    delete globalThis.document;
    delete globalThis.Lampa;
    delete globalThis.window;
  }
});

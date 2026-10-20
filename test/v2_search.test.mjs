import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* v2 «Единый стиль», экран 38 — штатный поиск Lampa (src/31_v2_search.js).
   Таблица собирается тем же приёмом, что в css.test.mjs: модули в один LC,
   Storage — заглушкой. */
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
    for (const f of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '30_css.js', '31_v2_search.js']) loadInto(LC, module, f);
    return { css: LC.buildCss(), LC };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

const APPLE = { lumen_theme: 'black', lumen_flat: 'true', lumen_badges: 'caption', lumen_font: 'inter' };

function rules(css, needle) {
  return css.split('\n').filter((r) => r.indexOf(needle) !== -1);
}

test('v2 экран 38: модуль зарегистрирован в LC.v2css', () => {
  const { LC } = build({});
  const part = LC.v2css.filter((p) => p.id === 'search');
  assert.equal(part.length, 1);
  assert.equal(part[0].order, 38);
});

test('v2 экран 38: все правила — только под открытым поиском', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    const text = css.split('\n').filter((r) => /search--open/.test(r));
    assert.ok(text.length > 20, 'правил поиска: ' + text.length);
    /* Каждое правило модуля (кроме @supports-обёрток) начинается с body.…search--open. */
    for (const r of text) {
      const head = r.charAt(0) === '@' ? r.slice(r.indexOf('{') + 1) : r;
      assert.match(head, /^body(\.[\w-]+)*\.search--open[ .]/, r.slice(0, 120));
    }
  }
});

test('v2 экран 38: фон темы, колонка 864 px от кромки 3.51em, результаты от 1000 px', () => {
  const { css } = build({});
  assert.ok(rules(css, 'body.search--open .background{display:none}').length === 1);
  /* Фон — цвет темы без подкраски от постера. */
  assert.ok(rules(css, 'body.search--open .search{background:#0B0908;').length === 1);
  assert.ok(rules(build(APPLE).css, 'body.search--open .search{background:#000000;').length === 1);
  assert.ok(rules(css, '.search__body{padding:2.63em 0 2.63em 3.51em}').length === 1);
  assert.ok(rules(css, 'float:left;clear:left;width:37.88em').length === 1);
  /* 43.84em (1000 px) − 3.51 кромка − 1.5 поле ряда Lampa. */
  assert.ok(rules(css, '.search__results{margin-left:38.83em}').length === 1);
});

test('v2 экран 38: клавиатура — оформление без смены раскладки, фокус по экрану 33', () => {
  const L = build({}).css;
  const A = build(APPLE).css;
  /* Lumen: заливка P.text, без масштаба. */
  const fl = rules(L, '.simple-keyboard .hg-button.focus,');
  assert.equal(fl.length, 1);
  assert.match(fl[0], /background:#F3EDE4;color:#/);
  assert.equal(rules(L, '.hg-button.focus{position:relative').length, 0);
  /* Apple TV: белая плитка ×1.12 с тенью, в lite/off без масштаба. */
  assert.match(rules(A, '.simple-keyboard .hg-button.focus,')[0], /background:#FFFFFF/);
  assert.match(rules(A, '.hg-button.focus{position:relative')[0], /scale\(1\.12\).*box-shadow:0 \.44em \.96em/);
  assert.ok(rules(A, 'body.lumen-motion-lite.search--open .search .simple-keyboard .hg-button.focus').length === 1);
  /* Служебные клавиши — маской; разметку и data-skbtn модуль не трогает. */
  for (const k of ['{BKSP}', '{LANG}', '{SPACE}']) assert.ok(L.indexOf('[data-skbtn="' + k + '"]:after{') !== -1, k);
  assert.equal(/hg-row\{[^}]*(flex-wrap|order)/.test(L), false);
});

test('v2 экран 38: рейтинг с постера убирается по настройке меток', () => {
  assert.equal(rules(build({ lumen_badges: 'caption' }).css, '.search__results .card__vote{display:none}').length, 1);
  assert.equal(rules(build({ lumen_badges: 'poster' }).css, '.search__results .card__vote{display:none}').length, 1);
  assert.equal(rules(build({ lumen_badges: 'off' }).css, '.search__results .card__vote{display:none}').length, 0);
});

test('v2 экран 38: подписи в одну строку с многоточием, постер 9.52em', () => {
  const { css } = build({});
  assert.match(rules(css, '.search__results .card__title{')[0], /white-space:nowrap;overflow:hidden.*text-overflow:ellipsis/);
  assert.match(rules(css, '.search__results .card__age{')[0], /white-space:nowrap;overflow:hidden.*text-overflow:ellipsis/);
  assert.ok(rules(css, '.search__results .card{width:9.52em').length === 1);
});

/* Фейковый узел: querySelector по одному классу и textContent. */
function node(cls, text, kids) {
  return {
    className: cls, textContent: text || '', kids: kids || [],
    querySelector(sel) { const c = sel.slice(1); return this.kids.find((k) => k.className === c) || null; },
    querySelectorAll(sel) { const c = sel.split(' ').pop().slice(1); const out = []; (function walk(n) { for (const k of n.kids) { if (k.className === c) out.push(k); walk(k); } })(this); return out; }
  };
}

test('LC.v2search.rateCard: «2021» → «2021 · ★ 7.8», один раз; без оценки — как было', () => {
  const { LC } = build({});
  const age = node('card__age', '2021');
  const card = node('card', '', [node('card__vote', '7.8'), age]);
  assert.equal(LC.v2search.rateCard(card), true);
  assert.equal(age.textContent, '2021 · ★ 7.8');
  assert.equal(LC.v2search.rateCard(card), false);
  assert.equal(age.textContent, '2021 · ★ 7.8');

  const age2 = node('card__age', '2026');
  assert.equal(LC.v2search.rateCard(node('card', '', [age2])), false);
  assert.equal(age2.textContent, '2026');
  const age3 = node('card__age', '');
  assert.equal(LC.v2search.rateCard(node('card', '', [node('card__vote', '6'), age3])), true);
  assert.equal(age3.textContent, '★ 6.0');
  const age4 = node('card__age', '1999');
  assert.equal(LC.v2search.rateCard(node('card', '', [node('card__vote', '0.0'), age4])), false);
  assert.equal(age4.textContent, '1999');
});

test('LC.v2search.scan: обходит карточки результатов', () => {
  const { LC } = build({});
  const root = node('main-search', '', [node('search__results', '', [
    node('card', '', [node('card__vote', '8.1'), node('card__age', '2024')]),
    node('card', '', [node('card__age', '2026')])
  ])]);
  assert.equal(LC.v2search.scan(root), 1);
});

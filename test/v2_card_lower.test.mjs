import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* v2 «Единый стиль», экран 36 (src/31_v2_card_lower.js): CSS рядов ниже
   первого экрана карточки и метки рядов по событию full/build. Загрузчик —
   как в test/css.test.mjs: несколько src/*.js в один LC, модуль экрана —
   до 30_css.js, как в сборке. */
globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function withStorage(storage, fn) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def), field: (name) => storage[name] } };
  globalThis.window = { Lampa: Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    loadInto(LC, module, '10_util.js');
    loadInto(LC, module, '20_icons.js');
    loadInto(LC, module, '31_v2_card_lower.js');
    loadInto(LC, module, '80_settings.js');
    loadInto(LC, module, '81_prefs.js');
    loadInto(LC, module, '30_css.js');
    return fn(LC);
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

const lumen = withStorage({}, (LC) => LC.buildCss());
const apple = withStorage({ lumen_flat: 'true' }, (LC) => LC.buildCss());

/* Тело ПОСЛЕДНЕГО правила с ровно этим селектором (оно и берёт верх
   порядком; селектор может стоять в группе). */
function rule(css, selector) {
  let found = null;
  for (const line of css.split('\n')) {
    let body = line;
    if (/^@(media|supports)/.test(line)) body = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
    for (const piece of body.split('}')) {
      const open = piece.indexOf('{');
      if (open === -1) continue;
      const sels = piece.slice(0, open).split(',').map((s) => s.trim());
      if (sels.indexOf(selector) !== -1) found = piece.slice(open + 1);
    }
  }
  return found;
}

const L = 'body .items-line.lumen-lower';

test('36: модуль зарегистрирован в LC.v2css и попадает в таблицу', () => {
  withStorage({}, (LC) => {
    const part = (LC.v2css || []).filter((p) => p.id === 'card-lower')[0];
    assert.ok(part, 'card-lower в LC.v2css');
    assert.equal(part.order, 36);
  });
  assert.ok(lumen.indexOf('.lumen-lower') !== -1);
});

test('36: кромка рядов 3.51em (80 px FHD) — шапка и лента', () => {
  for (const css of [lumen, apple]) {
    assert.match(rule(css, L + ' .items-line__head'), /padding-left:3\.51em/);
    assert.match(rule(css, L + ' .scroll--horizontal .scroll__content'), /padding-left:3\.51em/);
  }
});

test('36: заголовок ряда — L 30/700, A 38/600 −0.01em', () => {
  assert.match(rule(lumen, L + ' .items-line__title'), /font-weight:700;font-size:1\.32em/);
  const a = rule(apple, L + ' .items-line__title');
  assert.match(a, /font-weight:600;font-size:1\.67em/);
  assert.match(a, /letter-spacing:-\.01em/);
});

test('36: постеры рядов — одна ширина 201 px (8.81em), фокус v2', () => {
  for (const css of [lumen, apple]) assert.match(rule(css, L + '.lumen-lower--cards .card'), /width:8\.81em/);
  assert.match(rule(lumen, L + '.lumen-lower--cards .card.focus .card__view'), /scale\(1\.1\).*outline:\.13em solid/);
  const a = rule(apple, L + '.lumen-lower--cards .card.focus .card__view');
  assert.match(a, /scale\(1\.14\)/);
  assert.match(a, /outline:0/);
});

test('36: актёры — круг 110 px (4.82em), имя и роль под портретом, без плашки', () => {
  const P = L + '.lumen-lower--persons';
  for (const css of [lumen, apple]) {
    const photo = rule(css, P + ' .full-person__photo');
    assert.match(photo, /width:4\.82em;height:4\.82em/);
    assert.match(photo, /border-radius:50%/);
    assert.match(rule(css, P + ' .full-person'), /flex-direction:column/);
    assert.match(rule(css, P + ' .full-person.focus'), /background:none/);
  }
});

test('36: две колонки — «Комментарии» | «Актеры» по 50 %', () => {
  const body = rule(lumen, L + '.lumen-lower--left');
  assert.match(body, /display:inline-block/);
  assert.match(body, /width:50%/);
  assert.equal(body, rule(lumen, L + '.lumen-lower--right'));
});

test('36: «Комментарии» без пунктира; «Написать» — плитка (L) или чип (A)', () => {
  const D = L + '.lumen-lower--discuss';
  for (const css of [lumen, apple]) assert.match(rule(css, D + ' .full-review-add'), /border:0/);
  assert.match(rule(lumen, D + ' .full-review-add'), /width:6\.58em;height:5\.26em/);
  assert.match(rule(apple, D + ' .full-review-add'), /height:2\.28em;padding:0 1\.05em;border-radius:1\.14em/);
  assert.match(rule(apple, D + ' .full-review'), /background:none/);
});

test('36: счётчики разделов — текст без плашек; L «Подробно» в мягкой панели', () => {
  for (const css of [lumen, apple]) {
    assert.match(rule(css, '.lumen-descr-row .tag-count:not(.focus) .tag-count__count'), /background-color:transparent/);
  }
  assert.match(rule(lumen, '.lumen-descr-row .lumen-facts'), /border-radius:\.7em/);
  assert.match(rule(apple, '.lumen-descr-row .lumen-facts__grid'), /border-top:/);
});

test('36: без ключа панель отзывов не рисуется, строка — в шапке «Комментариев»', () => {
  assert.match(rule(lumen, 'body .lumen-lower-kp .lumen-descr-row .lumen-reviews[data-lumen-state="nokey"]'), /display:none/);
  withStorage({}, (LC) => {
    assert.equal(LC.cardLower.quietKey, true);
    assert.equal(LC.cardLower.needsKeyLine(), true);
    assert.match(LC.STRINGS.lumen_lower_kp_line.ru, /нужен ключ/);
  });
  withStorage({ lumen_kp_key: 'abc' }, (LC) => assert.equal(LC.cardLower.needsKeyLine(), false));
  withStorage({ lumen_reviews: false }, (LC) => assert.equal(LC.cardLower.needsKeyLine(), false));
});

test('36: сторона ряда в паре берётся из списка рядов компонента', () => {
  withStorage({}, (LC) => {
    const d = {}; const p = {}; const r = {};
    const rows = ['start', 'description', ['discuss', d], ['persons', p], ['cards', r]];
    assert.equal(LC.cardLower.sideOf(rows, d, 'discuss'), 'left');
    assert.equal(LC.cardLower.sideOf(rows, p, 'persons'), 'right');
    assert.equal(LC.cardLower.sideOf(rows, r, 'cards'), '');
    /* Комментариев нет — Lampa ставит ряд в конец, после людей. */
    const rows2 = ['start', 'description', ['persons', p], ['discuss', d], ['cards', r]];
    assert.equal(LC.cardLower.sideOf(rows2, p, 'persons'), 'left');
    assert.equal(LC.cardLower.sideOf(rows2, d, 'discuss'), 'right');
    /* Между ними другой ряд — пары нет. */
    const rows3 = ['start', 'description', ['discuss', d], ['episodes', {}], ['persons', p]];
    assert.equal(LC.cardLower.sideOf(rows3, d, 'discuss'), '');
    assert.equal(LC.cardLower.sideOf(rows3, p, 'persons'), '');
  });
});

test('36: селекторы модуля — под корнями плагина (body / .lumen-descr-row)', () => {
  withStorage({ lumen_flat: 'true' }, (LC) => {
    const part = LC.v2css.filter((p) => p.id === 'card-lower')[0];
    for (const flat of [false, true]) {
      const out = part.build({ P: LC.tokens(), APPLE: flat, V2: { rImg: 0.46, scalePosterL: 1.1, scalePosterA: 1.14, shadowL: 's', shadowA: 's', fillA: '#FFFFFF', blockA: 'b', durL: 220, durA: 240 }, motion: 'full' });
      for (const line of out.split('\n')) {
        const body = /^@supports/.test(line) ? line.slice(line.indexOf('{') + 1) : line;
        for (const sel of body.split('{')[0].split(',')) {
          const s = sel.trim();
          assert.ok(s.indexOf('body ') === 0 || s.indexOf('.lumen-descr-row ') === 0, 'корень: ' + s);
        }
      }
    }
  });
});

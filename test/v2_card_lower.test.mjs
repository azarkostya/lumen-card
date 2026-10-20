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

/* QA v2 (P2-2): Lampa ограничивает прокрутку лентой + двумя ЛЕВЫМИ полями
   (maxOffset) — поля ленты в колонке обязаны быть равны, иначе лента
   уезжает дальше нужного и «Написать» срезается левой кромкой. */
test('36: колонки — поля ленты симметричны, разницу до макета даёт ширина прокрутки', () => {
  for (const css of [lumen, apple]) {
    const left = rule(css, L + '.lumen-lower--left .scroll--horizontal .scroll__content');
    assert.equal(left, null, 'у левой колонки своих полей ленты нет — общие 3.51em с обеих сторон');
    assert.match(rule(css, L + ' .scroll--horizontal .scroll__content'), /padding-left:3\.51em;padding-right:3\.51em/);
    assert.match(rule(css, L + '.lumen-lower--right .scroll--horizontal .scroll__content'), /padding-left:1\.75em;padding-right:1\.75em/);
    assert.match(rule(css, L + '.lumen-lower--left .scroll--horizontal'), /margin-right:-1\.76em/);
    assert.match(rule(css, L + '.lumen-lower--right .scroll--horizontal'), /margin-right:1\.76em/);
  }
});

/* QA v2 (P2-2): → с последнего комментария — в «Актеры», ← с первого
   актёра — обратно; внутри ряда — как было (Navigator). */
test('36: пульт между колонками — → с края левой и ← с края правой уходят в соседа', () => {
  withStorage({}, (LC) => {
    let can = false;
    const moved = [];
    globalThis.window.Navigator = { canmove: () => can, move: (d) => moved.push(d) };
    function lineItem() {
      const mods = [];
      return { mods, use: (m) => mods.push(m), emit(name, c) { mods.forEach((m) => m['on' + name] && m['on' + name].call(this, c)); } };
    }
    function ctl(log) {
      return {
        right: () => log.push('right'), left: () => log.push('left'),
        down: () => log.push('down'), up: () => log.push('up')
      };
    }
    const leftItem = lineItem();
    LC.cardLower.bindPair(leftItem, 'left');
    LC.cardLower.bindPair(leftItem, 'left');
    assert.equal(leftItem.mods.length, 1, 'модуль ставится один раз');
    let log = [];
    let c = ctl(log);
    leftItem.emit('Controller', c);
    can = true; c.right();
    can = false; c.right();
    c.left();
    assert.deepEqual(log, ['right', 'down', 'left'], 'левая: внутри ряда штатно, с края → вниз (в «Актеры»), ← не тронут');

    const rightItem = lineItem();
    LC.cardLower.bindPair(rightItem, 'right');
    log = [];
    c = ctl(log);
    rightItem.emit('Controller', c);
    can = true; c.left();
    can = false; c.left();
    c.right();
    assert.deepEqual(log, ['left', 'up', 'right'], 'правая: с края ← вверх (в «Комментарии»), → не тронут');

    /* Без Navigator и без item.use — не исключение, штатный шаг. */
    delete globalThis.window.Navigator;
    log = [];
    c = ctl(log);
    const third = lineItem();
    LC.cardLower.bindPair(third, 'left');
    third.emit('Controller', c);
    c.right();
    assert.deepEqual(log, ['right']);
    LC.cardLower.bindPair({}, 'left');
    LC.cardLower.bindPair(null, 'left');
  });
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
      const out = part.build({ P: LC.tokens(), APPLE: flat, V2: { rImg: 0.46, scalePosterL: 1.1, scalePosterA: 1.14, shadowL: 's', shadowA: 's', fillA: '#FFFFFF', blockA: 'b', durL: 220, durA: 240 } });
      for (const line of out.split('\n')) {
        const body = /^@supports/.test(line) ? line.slice(line.indexOf('{') + 1) : line;
        for (const sel of body.split('{')[0].split(',')) {
          const s = sel.trim();
          assert.ok(s.indexOf('body ') === 0 || s.indexOf('body.lumen-motion-full ') === 0 || s.indexOf('.lumen-descr-row ') === 0, 'корень: ' + s);
        }
      }
    }
  });
});

/* Ревью v2 (п.1): ключ Кинопоиска ввели или стёрли в настройках поверх
   открытой карточки — 'full' повторно не приходит, строку «нужен ключ» и
   класс на теле активности перечитывает LC.cardLower.refresh(body). */
test('36: refresh — строка о ключе и класс тела следуют за ключом без переоткрытия', async () => {
  const { FakeEl } = await import('./_fakedom.mjs');
  const storage = {};
  globalThis.$ = (x) => x;
  try { withStorage(storage, (LC) => {
    const title = new FakeEl(['items-line__title']);
    const head = new FakeEl(['items-line__head'], [title]);
    const line = new FakeEl(['items-line', 'lumen-lower', 'lumen-lower--discuss'], [head]);
    const body = new FakeEl(['activity__body'], [line]);
    const item = { render: () => line };
    LC.cardLower.tag({ type: 'build', name: 'discuss', item: item, body: body, link: { rows: [] }, data: {} });
    assert.equal(head.find('.lumen-lower__kp').length, 1, 'без ключа строка в шапке');
    assert.ok(body.hasClass('lumen-lower-kp'));

    storage.lumen_kp_key = 'abc';
    LC.cardLower.refresh(body);
    assert.equal(head.find('.lumen-lower__kp').length, 0, 'ключ ввели — строка снята');
    assert.ok(!body.hasClass('lumen-lower-kp'), 'ключ ввели — класс снят');

    storage.lumen_kp_key = '';
    LC.cardLower.refresh(body);
    LC.cardLower.refresh(body);
    assert.equal(head.find('.lumen-lower__kp').length, 1, 'ключ стёрли — строка вернулась, одна');
    assert.ok(body.hasClass('lumen-lower-kp'));

    storage.lumen_reviews = false;
    LC.cardLower.refresh(body);
    assert.equal(head.find('.lumen-lower__kp').length, 0, 'отзывы выключены — строки нет');
    assert.ok(!body.hasClass('lumen-lower-kp'));

    /* Пустое тело и мусор — не исключение. */
    LC.cardLower.refresh(null);
    LC.cardLower.refresh({ length: 0 });
  }); } finally { delete globalThis.$; }
});

/* Ревью v2 (п.2): смена lumen_motion таблицу стилей не пересобирает —
   переход масштаба гейтится классом body.lumen-motion-full, а не режимом
   на момент сборки. */
test('36: переходы постеров и портретов — только под body.lumen-motion-full', () => {
  for (const motion of ['full', 'lite', 'off']) {
    const css = withStorage({ lumen_motion: motion }, (LC) => LC.buildCss());
    const cards = rule(css, 'body.lumen-motion-full .items-line.lumen-lower.lumen-lower--cards .card__view');
    const photo = rule(css, 'body.lumen-motion-full .items-line.lumen-lower.lumen-lower--persons .full-person__photo');
    assert.match(cards, /transition:transform \d+ms ease-out/, motion);
    assert.match(photo, /transition:transform \d+ms ease-out/, motion);
    assert.doesNotMatch(rule(css, L + '.lumen-lower--cards .card__view'), /transition/, motion);
    assert.doesNotMatch(rule(css, L + '.lumen-lower--persons .full-person__photo'), /transition/, motion);
  }
});

test('v2: модули экранов не читают режим анимаций при сборке таблицы', () => {
  const files = ['30_css.js', '31_v2_card_lower.js', '31_v2_episodes.js', '31_v2_roulette.js', '31_v2_search.js', '31_v2_settings_menu.js', '31_v2_torrents_menu.js'];
  for (const f of files) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');
    assert.doesNotMatch(src, /ctx\.motion|motion:\s*LC\.motionMode/, f);
  }
});

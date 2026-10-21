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

/* QA main (08-search-empty-field-stale-results): на пустой запрос Lampa
   вызывает recall('') и строит ряды прошлого поиска заново — при пустом
   поле они скрыты вместе со счётчиками вкладок. */
test('v2 экран 38: пустое поле — ряды результатов и счётчики вкладок скрыты', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    /* Ряды: прочие — целиком, первый — пустой рамкой под подсказку. */
    const r = rules(css, '.search__input:not(.filled) ~ .search__results .items-line + .items-line,');
    assert.equal(r.length, 1);
    assert.ok(r[0].indexOf('body.search--open .search .search__input:not(.filled) ~ .search__results .items-line > *') !== -1);
    assert.ok(r[0].indexOf('body.search--open .search .search__input:not(.filled) ~ .search__sources .search-source__count') !== -1);
    assert.ok(/\{display:none\}$/.test(r[0]), r[0]);
    /* «Начните вводить…» и «Ничего не найдено» (.search-looking) не трогаем. */
    assert.equal(/not\(\.filled\)[^{]*search-looking/.test(r[0]), false);
  }
});

/* Пульт поиска: «вправо» с крайней клавиши — в результаты (QA v2 P3-10),
   «вниз» с вкладок при пустом запросе — никуда (ряды скрыты). */
function searchEnv(opts) {
  const { LC } = build({});
  const cls = (list) => ({ list: new Set(list), contains(c) { return this.list.has(c); } });
  const input = { classList: cls(opts.filled ? ['search__input', 'filled'] : ['search__input']) };
  const root = {
    querySelector(sel) {
      if (sel === '.search__input') return input;
      if (sel === '.search__results .items-line') return opts.rows === false ? null : {};
      return null;
    },
    querySelectorAll() { return []; }
  };
  const log = [];
  const ctls = {};
  const state = { name: '' };
  const follows = {};
  const Lampa = {
    Search: { render: () => root, listener: { follow: (n, f) => { follows[n] = f; }, remove: (n) => { delete follows[n]; } } },
    Controller: {
      enabled: () => ({ name: state.name, controller: ctls[state.name] }),
      toggle: (n) => { state.name = n; LC.v2search.onToggle(n); }
    }
  };
  const sources = {
    toggle() {
      log.push('sources.toggle');
      ctls.search_sources = { down() { log.push('sources.down'); } };
      Lampa.Controller.toggle('search_sources');
    }
  };
  const bodyCls = cls(opts.settingsInput ? ['search--open', 'keyboard-input--visible'] : ['search--open']);
  globalThis.window = { Lampa: Lampa, Navigator: { canmove: (d) => !!(opts.canmove && opts.canmove[d]) } };
  globalThis.Lampa = Lampa;
  globalThis.document = { body: { classList: bodyCls } };
  LC.v2search.install();
  follows.sources({ sources: sources });
  return {
    LC, log, ctls, state, input, follows,
    keyboard() {
      ctls.keybord = { right() { log.push('keybord.right'); }, down() { log.push('keybord.down'); } };
      Lampa.Controller.toggle('keybord');
      return ctls.keybord;
    },
    done() { LC.v2search.uninstall(); delete globalThis.window; delete globalThis.Lampa; delete globalThis.document; }
  };
}

test('LC.v2search.onToggle: «вправо» с крайней клавиши при запросе и рядах — во вкладки и их «вниз» в ряды', () => {
  const env = searchEnv({ filled: true });
  try {
    env.keyboard().right();
    assert.deepEqual(env.log, ['sources.toggle', 'sources.down']);
    assert.equal(env.state.name, 'search_sources');
  } finally { env.done(); }
});

test('LC.v2search.onToggle: «вправо» внутри клавиатуры, при пустом запросе или без рядов — штатный', () => {
  for (const o of [{ filled: true, canmove: { right: true } }, { filled: false }, { filled: true, rows: false }]) {
    const env = searchEnv(o);
    try {
      env.keyboard().right();
      assert.deepEqual(env.log, ['keybord.right'], JSON.stringify(o));
    } finally { env.done(); }
  }
});

test('LC.v2search.onToggle: «вниз» с вкладок — в ряды только при непустом запросе; обёртка одна на контроллер', () => {
  const env = searchEnv({ filled: false });
  try {
    env.ctls.search_sources = { down() { env.log.push('sources.down'); } };
    env.LC.v2search.onToggle('search_sources');
    env.LC.v2search.onToggle('search_sources');
    env.state.name = 'search_sources';
    env.LC.v2search.onToggle('search_sources');
    env.ctls.search_sources.down();
    assert.deepEqual(env.log, [], 'пустой запрос — ряды скрыты, фокус туда не идёт');
    env.input.classList.list.add('filled');
    env.ctls.search_sources.down();
    assert.deepEqual(env.log, ['sources.down']);
  } finally { env.done(); }
});

test('LC.v2search.onToggle: клавиатура ввода настроек и закрытый поиск не трогаются', () => {
  const env = searchEnv({ filled: true, settingsInput: true });
  try {
    const kb = env.keyboard();
    assert.equal(kb.lumenSearchBound, undefined);
    kb.right();
    assert.deepEqual(env.log, ['keybord.right']);
  } finally { env.done(); }
  const env2 = searchEnv({ filled: true });
  try {
    env2.follows.close();
    const kb = env2.keyboard();
    kb.right();
    assert.deepEqual(env2.log, ['keybord.right'], 'после close вкладок нет — штатный «вправо»');
  } finally { env2.done(); }
});

/* QA main: в фокусе растёт только картинка — подпись кегля и места не меняет. */
test('v2 экран 38: фокус результата масштабирует .card__view, а не всю карточку с подписью', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    const card = rules(css, 'body.search--open .search .search__results .card.focus{');
    assert.equal(card.length, 1);
    assert.equal(/transform/.test(card[0]), false, card[0]);
    const view = rules(css, 'body.search--open .search .search__results .card.focus .card__view{');
    assert.equal(view.length, 1);
    assert.ok(/transform:scale\(1\.\d+\)/.test(view[0]), view[0]);
    assert.equal(rules(css, '.search__results .card{-webkit-transition').length, 0, 'переход — у картинки');
    assert.equal(rules(css, 'body.lumen-motion-full.search--open .search .search__results .card__view{').length, 1);
    /* Подпись в фокусе ничем не масштабируется. */
    assert.equal(css.split('\n').some((r) => /search__results \.card\.focus \.card__(title|age)[^{]*\{[^}]*(transform|font-size)/.test(r)), false);
  }
});

test('v2 экран 38: плашки «TV» и качества на постерах результатов сняты (QA v2 P3-10)', () => {
  for (const st of [{}, APPLE, { lumen_badges: 'off' }]) {
    const { css } = build(st);
    assert.equal(rules(css, 'body.search--open .search .search__results .card__type,body.search--open .search .search__results .card__quality{display:none}').length, 1);
  }
});

/* Ревью [75]: анимация фокуса Lampa (animation-card-focus / -trigger-enter,
   кадры на transform) перебивала масштаб .card__view — снята, как на главной. */
test('v2 экран 38: штатная анимация фокуса карточки в результатах снята', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    const r = rules(css, 'body.search--open .search .search__results .card.focus .card__view,body.search--open .search .search__results .card.hover .card__view,');
    assert.equal(r.length, 1);
    assert.ok(r[0].indexOf('.search__results .card.animate-trigger-enter .card__view') !== -1, r[0]);
    assert.match(r[0], /\{-webkit-animation:none !important;animation:none !important\}$/);
  }
});

/* Ревью [perf]: слой will-change:transform Lampa на каждой карточке снят. */
test('v2 экран 38: карточки результатов без will-change:transform', () => {
  for (const st of [{}, APPLE]) {
    assert.equal(rules(build(st).css, 'body.search--open .search .search__results .card{will-change:auto}').length, 1);
  }
});

/* Ревью [65]: пустое поле — справа не пустота, а штатная подсказка Lampa
   (ряды прошлого поиска recall('') заменяют её «Начните вводить…» и скрыты). */
test('v2 экран 38: пустое поле — подсказка «Начните вводить…» в рамке первого скрытого ряда', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    const pre = 'body.search--open .search .search__input:not(.filled) ~ .search__results .items-line:first-child';
    assert.equal(rules(css, pre + '{padding:9.18em 0 0 1.5em}').length, 1);
    const txt = rules(css, pre + ':after{');
    assert.equal(txt.length, 1);
    assert.match(txt[0], /content:"Начните вводить текст для поиска\.";display:block;max-width:20em;.*font-size:1\.67em/);
    const icon = rules(css, pre + ':before{');
    assert.equal(icon.length, 1);
    assert.match(icon[0], /^@supports .*width:2\.45em;height:2\.45em;margin-bottom:0\.62em/);
    /* Первый ряд сам не скрыт — иначе пропала бы и подсказка. */
    assert.equal(css.split('\n').some((x) => /\.search__results \.items-line(:first-child)?[,{][^}]*display:none/.test(x.replace(/\.items-line \+ \.items-line,|\.items-line > \*,/g, ''))), false);
  }
});

test('v2 экран 38: подсказка пустого поиска — перевод Lampa, кавычки экранированы', () => {
  const LCx = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => d, field: () => undefined }, Lang: { translate: (k) => (k === 'search_start_typing' ? 'Type "here"' : k) } };
  globalThis.window = { Lampa: Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    for (const f of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '30_css.js', '31_v2_search.js']) loadInto(LCx, module, f);
    const css = LCx.buildCss();
    assert.ok(css.indexOf('.items-line:first-child:after{content:"Type \\"here\\"";') !== -1);
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

/* Ревью [60]: один источник. Модель — порядок Lampa (app.min.js):
   Controller.toggle(name) ставит активный, зовёт его toggle(), потом шлёт
   'toggle'; Sources.toggle(from_search) при одном источнике внутри своей
   toggle() входит в ряды (Results.toggle → Controller.toggle('search_results'))
   — событие рядов приходит раньше события вкладок, обёртка «вниз» вкладок не
   участвует. Вкладки при одном источнике спрятаны (.hide). */
function lampaModel(opts) {
  const { LC } = build({});
  const cls = (list) => ({ list: new Set(list), contains(c) { return this.list.has(c); } });
  const input = { classList: cls(opts.filled ? ['search__input', 'filled'] : ['search__input']) };
  const root = {
    querySelector(sel) {
      if (sel === '.search__input') return input;
      if (sel === '.search__results .items-line') return opts.rows ? {} : null;
      if (sel === '.search__history .search-history-key') return opts.history ? {} : null;
      return null;
    },
    querySelectorAll() { return []; }
  };
  const controlls = {};
  let active = null, activeName = '';
  const follows = {};
  const Controller = {
    add(n, c) { controlls[n] = c; },
    enabled: () => ({ name: activeName, controller: active }),
    toggle(n) {
      if (!controlls[n]) return;
      active = controlls[n]; activeName = n;
      if (active.toggle) active.toggle();
      LC.v2search.onToggle(n);
    }
  };
  const Lampa = { Controller, Search: { render: () => root, listener: { follow: (n, f) => { follows[n] = f; }, remove: (n) => { delete follows[n]; } } } };
  const results = { any: () => !!opts.rows, toggle() { Controller.add('search_results', { invisible: true, toggle() { } }); Controller.toggle('search_results'); } };
  const tabs = { classList: cls(['scroll', 'hide']) };
  const keyboard = { toggle() { Controller.add('keybord', { down() { if (opts.history) history.toggle(); else sources.toggle(); }, right() { } }); Controller.toggle('keybord'); } };
  const sources = {
    tabs: () => tabs,
    toggle(fromSearch) {
      Controller.add('search_sources', {
        toggle() { if (fromSearch && results.any()) results.toggle(); },
        up() { if (opts.history) history.toggle(); else keyboard.toggle(); },
        down() { if (results.any()) results.toggle(); }
      });
      Controller.toggle('search_sources');
    }
  };
  const history = { toggle() { Controller.add('search_history', { toggle() { }, down() { sources.toggle(true); } }); Controller.toggle('search_history'); } };
  globalThis.window = { Lampa: Lampa, Navigator: { canmove: () => false } };
  globalThis.Lampa = Lampa;
  globalThis.document = { body: { classList: cls(['search--open']) } };
  LC.v2search.install();
  follows.sources({ sources: sources });
  return {
    name: () => activeName, keyboard, history, controller: () => active,
    done() { LC.v2search.uninstall(); delete globalThis.window; delete globalThis.Lampa; delete globalThis.document; }
  };
}

test('LC.v2search.onToggle: один источник, «вниз» с недавних при пустом запросе — фокус остаётся в недавних', () => {
  const env = lampaModel({ filled: false, rows: true, history: true });
  try {
    env.history.toggle();
    env.controller().down();
    assert.equal(env.name(), 'search_history');
  } finally { env.done(); }
  const env2 = lampaModel({ filled: true, rows: true, history: true });
  try {
    env2.history.toggle();
    env2.controller().down();
    assert.equal(env2.name(), 'search_results', 'запрос есть — штатно в ряды');
  } finally { env2.done(); }
});

test('LC.v2search.onToggle: один источник без недавних — «вниз» с клавиатуры не оставляет фокус на скрытой вкладке', () => {
  const env = lampaModel({ filled: false, rows: true, history: false });
  try {
    env.keyboard.toggle();
    env.controller().down();
    assert.equal(env.name(), 'keybord');
  } finally { env.done(); }
  const env2 = lampaModel({ filled: true, rows: true, history: false });
  try {
    env2.keyboard.toggle();
    env2.controller().down();
    assert.equal(env2.name(), 'search_results');
  } finally { env2.done(); }
  const env3 = lampaModel({ filled: true, rows: false, history: false });
  try {
    env3.keyboard.toggle();
    env3.controller().down();
    assert.equal(env3.name(), 'keybord', 'рядов нет — назад');
  } finally { env3.done(); }
});

/* Ревью [perf]: наблюдатель поиска разбирает только добавленные элементы
   внутри .search__results; свои записи (текст в .card__age) и узлы вне
   результатов не трогают карточки. */
function el(cls, kids, text) {
  const n = {
    nodeType: 1, parentNode: null, textContent: text || '', kids: kids || [],
    className: cls, classList: { contains: (c) => cls.split(' ').indexOf(c) !== -1 },
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; },
    querySelectorAll(sel) { const c = sel.slice(1); const out = []; (function walk(x) { for (const k of x.kids) { if (k.classList.contains(c)) out.push(k); walk(k); } })(this); return out; }
  };
  for (const k of n.kids) k.parentNode = n;
  return n;
}

test('LC.v2search.onMutations: только добавленные элементы в результатах, свои записи пропускаются', () => {
  const { LC } = build({});
  const age = el('card__age', [], '2021');
  const card = el('card selector', [el('card__view'), age]);
  const line = el('items-line', [card]);
  const res = el('search__results', [line]);
  const otherCard = el('card', [el('card__vote', [], '9.0'), el('card__age', [], '2000')]);
  const keypad = el('search__keypad', [otherCard]);
  const root = el('search', [res, keypad]);
  /* Плашка оценки пришла позже карточки — оценивается её карточка. */
  const vote = el('card__vote', [], '7.8');
  vote.parentNode = card; card.kids.push(vote);
  assert.equal(LC.v2search.onMutations([{ addedNodes: [vote] }], root), 1);
  assert.equal(age.textContent, '2021 · ★ 7.8');
  /* Своя запись — текстовый узел: ничего. */
  assert.equal(LC.v2search.onMutations([{ addedNodes: [{ nodeType: 3, parentNode: age }] }], root), 0);
  /* Вне результатов — не трогаем, даже карточку. */
  assert.equal(LC.v2search.onMutations([{ addedNodes: [otherCard] }], root), 0);
  assert.equal(otherCard.kids[1].textContent, '2000');
  /* Новый ряд — карточки в нём. */
  const a2 = el('card__age', [], '2024');
  const line2 = el('items-line', [el('card', [el('card__vote', [], '8.1'), a2]), el('card', [el('card__age', [], '2026')])]);
  line2.parentNode = res; res.kids.push(line2);
  assert.equal(LC.v2search.onMutations([{ addedNodes: [line2] }, { addedNodes: [] }], root), 1);
  assert.equal(a2.textContent, '2024 · ★ 8.1');
});

/* Ревью [15]: значки состояния — в правом верхнем углу, как на главной. */
test('v2 экран 38: значки .card__icons результатов — мельче, в правом верхнем углу', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    assert.equal(rules(css, 'body.search--open .search .search__results .card__icons{top:.3em;left:auto;right:.3em;').length, 1);
    assert.equal(rules(css, 'body.search--open .search .search__results .card__icon{width:1.25em;height:1.25em}').length, 1);
  }
});

/* QA на ТВ 21.10.2026: прокрученная лента результатов рисовалась поверх
   клавиатуры — колонка результатов режется слева. */
test('v2 поиск: колонка результатов обрезана слева (лента не заезжает на клавиатуру)', () => {
  const src = readFileSync(new URL('../src/31_v2_search.js', import.meta.url), 'utf8');
  assert.match(src, /RES \+ '\{-webkit-clip-path:inset\(-20em -20em -20em 1em\);clip-path:inset\(-20em -20em -20em 1em\)\}'/);
});

/* QA U6 (P3-11): вторая строка под «ничего не найдено» — только при
   заполненном поле (пустой результат), тихим цветом. */
test('v2 экран 38: пустой результат — подсказка про раскладку второй строкой', () => {
  for (const st of [{}, APPLE]) {
    const { css } = build(st);
    const r = rules(css, 'body.search--open .search .search__input.filled ~ .search__results .search-looking__text:after{');
    assert.equal(r.length, 1);
    assert.match(r[0], /content:"Проверьте раскладку или попробуйте английское название";display:block/);
  }
});

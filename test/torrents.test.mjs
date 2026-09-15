import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 32: CSS экранов пути TorrServer (src/65_torrents.js).
   css() читает LC.tokens (30_css.js) и LC.icons (20_icons.js), поэтому
   модуль грузится не test/_load.mjs (свежий LC на файл), а вместе с
   зависимостями в один LC — как в бандле (10 -> 20 -> 64 -> 80 -> 30 -> 65). */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function freshLC() {
  const LC = {};
  const module = { exports: null, lumen: true };
  for (const f of ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '30_css.js', '65_torrents.js']) loadInto(LC, module, f);
  return { LC, t: module.exports };
}

const { LC: baseLC, t } = freshLC();
const rules = () => t.css().split('\n').filter(Boolean);

/* Разбор одной строки css(): список {selectors[], decl} (для @supports —
   все правила внутри блока), либо null для комментария/@keyframes. */
function parse(rule) {
  if (rule.indexOf('/*') === 0) return null;
  if (/^@(-webkit-)?keyframes lumen-/.test(rule)) return null;
  let body = rule;
  if (rule.indexOf('@supports not (') === 0) body = rule.slice(rule.indexOf('{') + 1, -1);
  const out = [];
  for (const piece of body.split('}').filter(Boolean)) {
    const i = piece.indexOf('{');
    assert.ok(i > 0, 'битое правило: ' + rule);
    out.push({ selectors: piece.slice(0, i).split(','), decl: piece.slice(i + 1) });
  }
  return out;
}

const MOTION = '(\\.lumen-motion-(full|lite|off))?';
const ALLOWED = [
  new RegExp('^body' + MOTION + '\\.lumen-menus-all \\.(selectbox|modal)[ .:]'),
  new RegExp('^(body\\.lumen-motion-(full|lite|off) )?\\.selectbox\\.lumen-select[ .:]'),
  new RegExp('^(body\\.lumen-motion-(full|lite|off) )?\\.modal\\.lumen-modal([ .:]|$)'),
  new RegExp('^body\\.lumen-menus-all \\.modal$'),
  new RegExp('^body\\.lumen-torrents-on' + MOTION + ' ')
];

test('scoped: два префикса из одного селектора', () => {
  assert.equal(t.scoped('.selectbox .selectbox-item.focus'), 'body.lumen-menus-all .selectbox .selectbox-item.focus,.selectbox.lumen-select .selectbox-item.focus');
  assert.equal(t.scoped('.modal .torrent-checklist'), 'body.lumen-menus-all .modal .torrent-checklist,.modal.lumen-modal .torrent-checklist');
  // маркеры совпадают с теми, что ставит LC.menus (64_menus.js)
  assert.equal(baseLC.menus.MARK_SELECT, 'lumen-select');
  assert.equal(baseLC.menus.MARK_MODAL, 'lumen-modal');
  // чужие классы с тем же началом не превращаются в маркер
  assert.equal(t.scoped('.modal-loading'), 'body.lumen-menus-all .modal-loading,.modal-loading');
});

test('каждое правило заскоуплено (и внутри @supports)', () => {
  for (const r of rules()) {
    assert.match(r, /^(body\.lumen-menus-all|body\.lumen-motion-|\.selectbox\.lumen-select|\.modal\.lumen-modal|body\.lumen-torrents-on|@supports not \(|@(-webkit-)?keyframes lumen-|\/\*)/, r);
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) for (const s of p.selectors) assert.ok(ALLOWED.some((re) => re.test(s)), 'не заскоуплен: ' + s + '\n  в ' + r);
  }
});

test('правила Select/Modal всегда парой через scoped(): режим all + маркер режима path', () => {
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      for (const s of p.selectors) {
        if (!/\.(selectbox|modal)(?![\w-])/.test(s)) continue;
        const m = /^body((?:\.lumen-motion-(?:full|lite|off))?)\.lumen-menus-all (\.(selectbox|modal)(?![\w-]).*)$/.exec(s);
        if (!m) {
          // вторая половина пары — ищем её первую половину
          const pm = /^(?:body\.(lumen-motion-(?:full|lite|off)) )?\.(selectbox|modal)\.lumen-(?:select|modal)(.*)$/.exec(s);
          assert.ok(pm, 'Select/Modal без маркера: ' + s);
          const first = 'body' + (pm[1] ? '.' + pm[1] : '') + '.lumen-menus-all .' + pm[2] + pm[3];
          assert.ok(p.selectors.indexOf(first) !== -1, 'нет пары режима all для ' + s);
          continue;
        }
        const mark = m[3] === 'selectbox' ? 'lumen-select' : 'lumen-modal';
        const second = (m[1] ? 'body' + m[1].replace(/^\./, '.') + ' ' : '') + m[2].replace(/^\.(selectbox|modal)/, '.$1.' + mark);
        assert.ok(p.selectors.indexOf(second) !== -1, 'нет пары режима path для ' + s + ' (ожидалось ' + second + ')');
      }
    }
  }
});

test('нет inset и :has', () => {
  for (const r of rules()) {
    assert.ok(!/inset\s*:/.test(r), r);
    assert.ok(r.indexOf(':has(') === -1, r);
  }
});

test('покрыты все экраны пути', () => {
  const css = t.css();
  const classes = [
    // 33/35 Select
    '.selectbox__title', '.selectbox-item.focus', '.selectbox-item__subtitle', '.selectbox-item__checkbox', '.selectbox-item.selected'
  ];
  for (const c of classes) assert.ok(css.indexOf(c) !== -1, c);
});

test('внутри панели ничего не скрыто', () => {
  for (const r of rules()) if (/\.selectbox/.test(r)) assert.ok(!/display:none/.test(r), r);
});

test('Select: иконки чужих плагинов не трогаются — нет правил на svg внутри __icon, кроме штатного спрайта без атрибутов', () => {
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) for (const s of p.selectors) {
      if (s.indexOf('.selectbox-item__icon ') === -1 && !/\.selectbox-item__icon>/.test(s)) continue;
      assert.match(s, /\.selectbox-item__icon > svg:not\(\[viewBox\]\):not\(\[class\]\):not\(\[width\]\)$/, s);
    }
  }
});

test('акцент берётся из LC.tokens и пересобирается при смене настройки', () => {
  const storage = { lumen_card_accent: 'ice' };
  const Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def) } };
  globalThis.window = { Lampa };
  globalThis.Lampa = Lampa;
  try {
    const ice = t.css();
    assert.ok(ice.indexOf('#7FB7C9') !== -1, 'нет акцента ice');
    assert.ok(ice.indexOf('#E8B87A') === -1, 'остался акцент sand');
    storage.lumen_card_accent = 'mint';
    assert.ok(t.css().indexOf('#9FCF8A') !== -1, 'css() не пересобрался под mint');
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

/* ---------------------------------------------------------------- */
/* toggle / install на фейковом документе                            */
/* ---------------------------------------------------------------- */

function fakeDocument() {
  const byId = {};
  const head = {
    children: [],
    appendChild(el) { el.parentNode = head; head.children.push(el); if (el.id) byId[el.id] = el; return el; },
    removeChild(el) { const i = head.children.indexOf(el); if (i !== -1) head.children.splice(i, 1); if (byId[el.id] === el) delete byId[el.id]; el.parentNode = null; return el; }
  };
  return {
    head,
    getElementById: (id) => byId[id] || null,
    getElementsByTagName: (n) => (n === 'head' ? [head] : []),
    createElement: (tag) => ({ tagName: tag, id: '', innerHTML: '', parentNode: null })
  };
}

function withDom(fn) {
  const doc = fakeDocument();
  const body = new FakeEl(['body-mock']);
  globalThis.document = doc;
  globalThis.$ = (sel) => (sel === 'body' ? body : EMPTY);
  try { return fn(doc, body); } finally { delete globalThis.document; delete globalThis.$; }
}

test('toggle(true) дважды — один <style id="lumen-torrents-css"> и класс на body; toggle(false) — ничего не остаётся', () => {
  const { t: m } = freshLC();
  withDom((doc, body) => {
    m.toggle(true);
    m.toggle(true);
    assert.equal(doc.head.children.length, 1);
    const el = doc.getElementById('lumen-torrents-css');
    assert.ok(el, 'нет <style>');
    assert.equal(el.tagName, 'style');
    assert.equal(el.innerHTML, m.css());
    assert.equal(body.hasClass('lumen-torrents-on'), true);
    m.toggle(false);
    assert.equal(doc.getElementById('lumen-torrents-css'), null);
    assert.equal(doc.head.children.length, 0);
    assert.equal(body.hasClass('lumen-torrents-on'), false);
    m.toggle(false);
    assert.equal(doc.head.children.length, 0);
  });
});

test('install: маркер lumen-torrents на корне активности torrents при start, идемпотентно', () => {
  const { t: m } = freshLC();
  const follows = [];
  const current = new FakeEl(['activity']);
  globalThis.Lampa = {
    Listener: { follow: (name, cb) => follows.push({ name, cb }) },
    Activity: { active: () => ({ component: 'torrents', activity: { render: () => current } }) }
  };
  try {
    m.install();
    m.install();
    assert.equal(follows.length, 1);
    assert.equal(follows[0].name, 'activity');
    // уже открытый экран «Торренты» помечается сразу (включение настройки без перезагрузки)
    assert.equal(current.hasClass('lumen-torrents'), true);

    const root = new FakeEl(['activity']);
    const other = new FakeEl(['activity']);
    follows[0].cb({ type: 'start', component: 'torrents', object: { activity: { render: () => root } } });
    follows[0].cb({ type: 'start', component: 'full', object: { activity: { render: () => other } } });
    follows[0].cb({ type: 'create', component: 'torrents', object: { activity: { render: () => other } } });
    follows[0].cb(null);
    follows[0].cb({ type: 'start', component: 'torrents', object: {} });
    assert.equal(root.hasClass('lumen-torrents'), true);
    assert.equal(other.hasClass('lumen-torrents'), false);
  } finally {
    delete globalThis.Lampa;
  }
});

test('LC.injectCss пересобирает CSS пути через LC.applyTorrentsPref (смена акцента без перезагрузки)', () => {
  const { LC } = freshLC();
  let calls = 0;
  LC.applyTorrentsPref = () => { calls++; };
  withDom(() => {
    LC.injectCss();
  });
  assert.equal(calls, 1);
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeEl, EMPTY } from './_fakedom.mjs';

/* Task 32: CSS экранов пути TorrServer (src/65_torrents.js).
   css() читает LC.tokens (30_css.js), LC.icons (20_icons.js) и маркеры
   LC.menus (64_menus.js), поэтому модуль грузится не test/_load.mjs (свежий
   LC на файл), а вместе с зависимостями в один LC. В бандле порядок — по
   имени файла (10 -> 20 -> 30 -> … -> 64 -> 65 -> 80); здесь 80_settings
   грузится раньше 30/65: LC.pref им нужен только при вызове, не при загрузке. */

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
    '.selectbox__title', '.selectbox-item.focus', '.selectbox-item__subtitle', '.selectbox-item__checkbox', '.selectbox-item.selected',
    // 34 Торренты
    '.explorer__left', '.explorer-card__title', '.explorer-card__descr', '.torrent-filter', '.filter--search', '.filter--filter > div:not(.hide)',
    '.torrent-item', '.torrent-item.focus', '.torrent-item__title', '.torrent-item__details', '.torrent-item__size', '.torrent-item__ffprobe',
    '.torrent-item__viewed', '.watched-history', '.empty__title', '.empty-filter',
    // 36–37 окна TorrServer
    '.modal .modal__content', '.modal .modal__title', '.modal-loading', '.torrent-install__title', '.torrent-install__link',
    '.torrent-checklist__progress-bar', '.torrent-checklist__list > li.wait', '.torrent-checklist__list > li.wait.check', '.torrent-checklist__footer .simple-button.focus',
    '.torrent-error code', '.modal .error__ico', '.modal .error__title',
    // 38–39 файлы
    '.torrent-file', '.torrent-file.focus', '.torrent-file__size', '.torrent-file .time-line', '.torrent-serial', '.torrent-serial__episode', '.torrent-serial__line',
    '.torrent-serial__progress', '.torrnet-folder-name',
    // 40 предзагрузка
    '.media-loading__shade', '.media-loading__title', '.media-loading__mark-fill', '.media-loading__status', '.media-loading__percent', '.media-loading__peers'
  ];
  for (const c of classes) assert.ok(css.indexOf(c) !== -1, c);
});

test('чек-лист: три состояния шагов — будущий smoke, текущий text крупнее, пройденный muted + зачёркнут', () => {
  const k = baseLC.tokens();
  const decl = (sel) => {
    for (const r of rules()) {
      const parsed = parse(r);
      if (!parsed) continue;
      for (const p of parsed) if (p.selectors.some((s) => s === 'body.lumen-torrents-on ' + sel)) return p.decl;
    }
    return '';
  };
  assert.match(decl('.torrent-checklist__list > li'), new RegExp('color:' + k.smoke));
  assert.match(decl('.torrent-checklist__list > li.wait'), new RegExp('color:' + k.text + '.*font-size:\\.964em|font-size:\\.964em.*color:' + k.text));
  assert.match(decl('.torrent-checklist__list > li.wait.check'), /text-decoration:line-through/);
  assert.match(decl('.torrent-checklist__list > li.wait.check'), new RegExp('color:' + k.muted));
});

test('пульсы спиннера и предзагрузки — только в lumen-motion-full', () => {
  for (const r of rules()) {
    if (!/animation:lumen-/.test(r)) continue;
    const parsed = parse(r);
    for (const p of parsed) for (const s of p.selectors) assert.match(s, /lumen-motion-full/, s);
  }
  assert.ok(rules().some((r) => /\.modal-loading/.test(r) && /animation:lumen-/.test(r)), 'нет пульса спиннера');
  assert.ok(rules().some((r) => /\.media-loading__mark/.test(r) && /animation:lumen-/.test(r)), 'нет пульса предзагрузки');
  // штатный mediaLoadingPulse Lampa играет всегда — в lite/off его гасим
  for (const mode of ['lite', 'off']) {
    assert.ok(rules().some((r) => r.indexOf('lumen-motion-' + mode + ' .media-loading__mark') !== -1 && r.indexOf('animation:none !important') !== -1), mode + ': пульс предзагрузки не погашен');
  }
});

/* Классы-ловушки (план 0.2): общие компоненты Lampa оформляются только внутри скоупа пути. */
test('классы-ловушки: .explorer/.torrent-filter/.empty/.watched-history — только в активности «Торренты», .simple-button/.time-line/.error — только под уникальным родителем', () => {
  const ACT = /^body\.lumen-torrents-on(\.lumen-motion-(full|lite|off))? \.lumen-torrents /;
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) for (const s of p.selectors) {
      if (/\.(explorer|torrent-filter|empty|watched-history)(?![\w])/.test(s)) assert.match(s, ACT, s);
      if (/\.simple-button(?![\w-])/.test(s)) assert.ok(ACT.test(s) || s.indexOf('.torrent-checklist__footer ') !== -1, s);
      if (/\.time-line(?![\w-])/.test(s)) assert.ok(/\.torrent-(file|serial) /.test(s), s);
      if (/\.error(?![\w-])/.test(s)) assert.ok(/\.modal(?![\w-])/.test(s), s);
      if (/\.torrent-install(?![\w-])/.test(s)) assert.ok(/div\.torrent-install|\.torrent-install__left img/.test(s), 'корень .torrent-install совпадает с <img> внутри: ' + s);
    }
  }
});

/* Анимации Lampa (body.advanced--animation): keyframes на .simple-button.focus и
   .torrent-item.focus/.animate-trigger-enter перебивают обычный transform —
   наш transform только с !important, в lite/off анимации Lampa гасятся. */
test('движение: transform на анимируемых Lampa элементах — с !important; lite/off гасят анимации', () => {
  const all = rules();
  for (const r of all) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      const animated = p.selectors.some((s) => /\.simple-button[.\w-]*\.focus|\.torrent-item\.(focus|animate-trigger-enter)/.test(s));
      if (animated && /(^|;)transform:(?!none)/.test(p.decl)) assert.match(p.decl, /(^|;)transform:[^;]*!important/, r);
    }
  }
  for (const mode of ['lite', 'off']) {
    for (const cls of ['.simple-button', '.torrent-item', '.explorer-card__head-img']) {
      const ok = all.some((r) => r.indexOf('lumen-motion-' + mode) !== -1 && r.indexOf(cls) !== -1 && r.indexOf('animation:none !important') !== -1);
      assert.ok(ok, mode + ': нет animation:none !important для ' + cls);
    }
  }
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
    /* writes — сколько раз в <style> записан текст (переразбор стилей). */
    createElement: (tag) => {
      const el = { tagName: tag, id: '', parentNode: null, writes: 0, _html: '' };
      Object.defineProperty(el, 'innerHTML', { get() { return this._html; }, set(v) { this._html = v; this.writes++; } });
      return el;
    }
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

/* ---------------- правки ревью качества ---------------- */

test('маски: data-URI один раз на иконку, repeat/position/size — одним правилом на все селекторы с масками', () => {
  const css = t.css();
  const uris = css.match(/url\("data:image\/svg\+xml[^)]*\)/g) || [];
  const unique = new Set(uris);
  // -webkit-mask-image и mask-image — по одному url на иконку
  assert.equal(uris.length, unique.size * 2, 'data-URI повторяется');
  assert.equal(unique.size, 6, 'check, star, chevronR, search, close, torrent');
  assert.equal((css.match(/(^|[;{])mask-repeat:/g) || []).length, 1);
  const maskSel = [];
  const repeatSel = [];
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      if (/(^|;)mask-image:url/.test(p.decl)) maskSel.push(...p.selectors);
      if (/(^|;)mask-repeat:/.test(p.decl)) repeatSel.push(...p.selectors);
    }
  }
  assert.ok(maskSel.length > 0);
  for (const s of maskSel) assert.ok(repeatSel.indexOf(s) !== -1, 'без repeat/position/size: ' + s);
});

test('toggle(true) с тем же текстом не переписывает <style>; смена акцента — переписывает один раз', () => {
  const { t: m } = freshLC();
  const storage = { lumen_card_accent: 'sand' };
  const Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def) } };
  globalThis.window = { Lampa };
  globalThis.Lampa = Lampa;
  try {
    withDom((doc) => {
      m.toggle(true);
      m.toggle(true);
      m.toggle(true);
      assert.equal(doc.getElementById('lumen-torrents-css').writes, 1);
      storage.lumen_card_accent = 'ice';
      m.toggle(true);
      assert.equal(doc.getElementById('lumen-torrents-css').writes, 2);
      m.toggle(false);
      m.toggle(true);
      assert.equal(doc.getElementById('lumen-torrents-css').writes, 1, 'новый <style> после выключения пишется');
    });
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

test('LC.injectCss с тем же текстом не переписывает CSS карточки', () => {
  const { LC } = freshLC();
  LC.applyTorrentsPref = () => { };
  withDom((doc) => {
    LC.injectCss();
    LC.injectCss();
    assert.equal(doc.getElementById('lumen-card-css').writes, 1);
  });
});

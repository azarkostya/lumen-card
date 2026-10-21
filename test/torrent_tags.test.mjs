import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* 1.4: метки раздачи (releaseTags), фокус на следующей серии в файлах
   TorrServer (resumeIndex) — src/65_torrents.js; «Скрыть Shots» и «Скрыть
   лишние значки шапки» (LC.headHide) — src/85_header.js; U13 — раскладка
   экрана раздач, src/31_v2_torrents_menu.js. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function torrents() {
  const LC = {};
  const module = { exports: null, lumen: true };
  for (const f of ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js', '30_css.js', '65_torrents.js']) loadInto(LC, module, f);
  return module.exports;
}

const T = torrents();
const NONE = { res: '', hdr: false, dv: false, dub: false, noRu: false };

/* [название, ожидаемые поля поверх NONE] */
const TABLE = [
  ['Дюна: Часть вторая / Dune: Part Two (2024) WEB-DL 2160p | HDR10, DV | Дубляж', { res: '4K', hdr: true, dv: true, dub: true }],
  ['Dune.Part.Two.2024.2160p.UHD.BluRay.REMUX.DV.HDR10.HEVC.TrueHD.Atmos-FGT', { res: '4K', hdr: true, dv: true }],
  ['Оппенгеймер / Oppenheimer (2023) UHD BDRemux | HDR10+ | D, A', { res: '4K', hdr: true, dub: true }],
  ['Бэтмен / The Batman (2022) BDRip 1080p | Dub', { res: '1080p', dub: true }],
  ['Бэтмен / The Batman (2022) BDRip 720p | MVO', { res: '720p' }],
  ['Бэтмен / The Batman (2022) BDRip 720p | AVO (Гоблин)', { res: '720p' }],
  ['Бэтмен / The Batman (2022) WEB-DLRip | Line', {}],
  ['The Batman 2022 1080p WEB-DL ENG', { res: '1080p', noRu: true }],
  ['Дюна / Dune (2021) BDRip 1080p | Original', { res: '1080p', noRu: true }],
  ['Дюна / Dune (2021) BDRip 1080p | Оригинал', { res: '1080p', noRu: true }],
  ['Дюна / Dune (2021) BDRip 1080p | Rus, Eng', { res: '1080p' }],
  ['Дюна / Dune (2021) BDRip 1080p | D, Eng', { res: '1080p', dub: true }],
  ['Дюна / Dune (2021) BDRip 1080p | MVO, Eng', { res: '1080p' }],
  ['Дюна / Dune (2021) BDRip 1080p | P, Eng + Sub', { res: '1080p' }],
  ['Дюна / Dune (2021) WEB-DL 1080p | Профессиональный многоголосый | Eng', { res: '1080p' }],
  ['Дюна / Dune (2021) 1080p | Дублированный, Eng', { res: '1080p', dub: true }],
  ['Дюна / Dune (2021) 1080p | Ukr, Eng', { res: '1080p' }],
  /* Без языка — без метки «нет русской»: сомнение. */
  ['The.Batman.2022.1080p.WEB-DL.DDP5.1.Atmos.x264', { res: '1080p' }],
  /* Буквы и слова, похожие на метки, меток не дают. */
  ['The.D.Train.2015.DVDRip', {}],
  ['Оригинальная версия / Original Cut (2010) HDRip', {}],
  ['Kingdom.S01.WEB-DL.1080i', { res: '1080p' }]
];

test('1.4: releaseTags — таблица русских и английских релизов', () => {
  for (const [title, want] of TABLE) {
    assert.deepEqual(T.releaseTags(title), Object.assign({}, NONE, want), title);
  }
});

test('1.4: releaseTags — дорожки ffprobe решают «нет русской», найденная озвучка её гасит', () => {
  const eng = [{ codec_type: 'video' }, { codec_type: 'audio', tags: { language: 'eng' } }];
  const rus = eng.concat([{ codec_type: 'audio', tags: { language: 'rus' } }]);
  const und = [{ codec_type: 'audio', tags: { language: 'und' } }];
  assert.equal(T.releaseTags('Dune 2021 1080p', eng).noRu, true);
  assert.equal(T.releaseTags('Dune 2021 1080p | Eng', rus).noRu, false);
  assert.equal(T.releaseTags('Dune 2021 1080p | Eng', und).noRu, false, 'язык дорожки неизвестен');
  assert.equal(T.releaseTags('Dune 2021 1080p | Eng', eng, ['LostFilm']).noRu, false, 'студия озвучки');
  assert.equal(T.releaseTags('Dune 2021 1080p | Eng', null, ['LostFilm']).noRu, false);
});

test('1.4: метки — серые чипы штатной строки медиачипов, без значка Lampa', () => {
  const css = T.css();
  assert.ok(css.indexOf('body.lumen-torrents-on .torrent-item__ffprobe > div.lumen-ttag::before{content:none;display:none}') >= 0);
  const src = readFileSync(new URL('../src/65_torrents.js', import.meta.url), 'utf8');
  assert.ok(src.indexOf("chip.className = 'lumen-ttag'") >= 0);
  assert.ok(!/TorrServer'\)|in_torrserver|lumen_tt_ts/.test(src), 'метки «уже в TorrServer» нет (решение владельца)');
});

test('1.4: resumeIndex — фокус на первой недосмотренной серии после досмотренной', () => {
  const r = (list) => T.resumeIndex(list.map((p, i) => ({ episode: i + 1, percent: p })));
  assert.equal(r([100, 100, 0, 0]), 2);
  assert.equal(r([100, 96, 0, 0]), 2);
  assert.equal(r([100, 100, 40, 0]), -1, 'последняя начатая — Lampa уже на ней');
  assert.equal(r([0, 0, 0]), -1, 'нет таймкодов — как было');
  assert.equal(r([100, 100, 100]), -1, 'дальше досмотренной ничего');
  assert.equal(r([100, 0, 100, 0]), 3, 'после ПОСЛЕДНЕЙ просмотренной');
  assert.equal(T.resumeIndex([{ episode: 0, percent: 100 }, { episode: 0, percent: 0 }]), -1, 'не сериал');
  assert.equal(T.resumeIndex([{ episode: 1, percent: 100 }]), -1);
  assert.equal(T.resumeIndex([{ episode: 1, percent: 100 }, { episode: 0, percent: 0 }, { episode: 2, percent: 0 }]), 2, 'файл без серии пропускается');
});

/* Ревью 1.4: все три меняют поведение Lampa — по умолчанию выключены. */
test('1.4: «Фокус на следующей серии», «Скрыть Shots» и «Скрыть лишние значки шапки» — выключены', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  for (const f of ['10_util.js', '80_settings.js', '81_prefs.js']) loadInto(LC, module, f);
  const find = (n) => LC.prefs.find(n);
  assert.equal(find('lumen_ts_resume_focus')['default'], false);
  assert.equal(find('lumen_hide_shots')['default'], false);
  assert.equal(find('lumen_hide_head_icons')['default'], false);
  for (const k of ['lumen_ts_resume_focus', 'lumen_hide_shots', 'lumen_hide_head_icons']) {
    assert.equal(find(k).type, 'trigger');
    for (const lang of ['ru', 'en', 'uk']) {
      assert.ok(LC.STRINGS[find(k).label][lang], k + ' ' + lang);
      assert.ok(LC.STRINGS[find(k).descr][lang], k + ' descr ' + lang);
    }
  }
  for (const k of ['lumen_tt_dub', 'lumen_tt_noru']) for (const lang of ['ru', 'en', 'uk']) assert.ok(LC.STRINGS[k][lang], k + ' ' + lang);
});

function header() {
  const LC = {};
  const module = { exports: null, lumen: true };
  for (const f of ['10_util.js', '35_cardinfo.js', '80_settings.js', '81_prefs.js', '85_header.js']) loadInto(LC, module, f);
  return LC;
}

test('1.4: LC.headHide — правила только под классами body, значки шапки по коду Lampa', () => {
  const LC = header();
  const css = LC.headHide.css();
  assert.equal(css.length, 2);
  for (const rule of css) {
    assert.ok(/\{display:none !important\}$/.test(rule), rule);
    for (const sel of rule.slice(0, rule.indexOf('{')).split(',')) assert.ok(/^body\.lumen-hide-(shots|headicons) /.test(sel), sel);
  }
  assert.ok(css[0].indexOf('.full-start-new__buttons [class*="shots"]') >= 0);
  assert.ok(css[0].indexOf('.head .head__actions [class*="shots"]') >= 0);
  assert.deepEqual(LC.headHide.HEAD_EXTRA, ['notice--icon', 'open--notice', 'open--broadcast', 'open--feed', 'open--premium']);
  for (const keep of ['open--search', 'open--settings', 'open--profile', 'full--screen']) assert.ok(css[1].indexOf(keep) < 0, keep);
});

test('1.4: LC.headHide.apply — классы по настройкам, false снимает оба', () => {
  const LC = header();
  const classes = new Set();
  const storage = {};
  globalThis.document = { body: { classList: { add: (c) => classes.add(c), remove: (c) => classes.delete(c) } } };
  globalThis.window = { Lampa: { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } } };
  globalThis.Lampa = globalThis.window.Lampa;
  try {
    LC.headHide.apply();
    assert.deepEqual([...classes], [], 'по умолчанию ничего не скрыто');
    storage.lumen_hide_shots = 'true';
    LC.headHide.apply();
    assert.deepEqual([...classes], ['lumen-hide-shots']);
    storage.lumen_hide_head_icons = 'true';
    LC.headHide.apply();
    assert.deepEqual([...classes].sort(), ['lumen-hide-headicons', 'lumen-hide-shots']);
    LC.headHide.apply(false);
    assert.deepEqual([...classes], []);
  } finally {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

/* QA ТВ 21.10.2026: пункт Shots в окне «Источник» строится из кнопок
   карточки — при «Скрыть Shots» он убирается на preshow. */
test('1.4: «Скрыть Shots» убирает пункт Shots из окна «Источник» (preshow), остальное не трогает', () => {
  const LC = header();
  let handler = null;
  const on = new Set();
  globalThis.document = { body: { classList: { add: (c) => on.add(c), remove: (c) => on.delete(c), contains: (c) => on.has(c) } } };
  const storage = { lumen_hide_shots: 'true' };
  globalThis.window = { Lampa: { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] }, Select: { listener: { follow: (n, fn) => { assert.equal(n, 'preshow'); handler = fn; } } } } };
  globalThis.Lampa = globalThis.window.Lampa;
  try {
    LC.headHide.apply();
    LC.headHide.apply();
    assert.equal(typeof handler, 'function', 'подписка на preshow');
    const shotsBtn = { hasClass: (c) => c === 'shots-view-button' };
    const items = () => [
      { title: 'Торренты', icon: '<svg><use xlink:href="#sprite-torrent"></use></svg>' },
      { title: 'Shots', icon: '<svg><use xlink:href="#sprite-shots"></use></svg>', btn: shotsBtn },
      { title: 'Трейлеры', icon: '<svg><use xlink:href="#sprite-trailer"></use></svg>' },
      { title: 'Добавить источник', add_source: true }
    ];
    const e = { active: { items: items() } };
    handler(e);
    assert.deepEqual(e.active.items.map((i) => i.title), ['Торренты', 'Трейлеры', 'Добавить источник']);
    assert.equal(LC.headHide.isShotsItem({ btn: shotsBtn }), true, 'и по кнопке без иконки');
    storage.lumen_hide_shots = 'false';
    LC.headHide.apply();
    const e2 = { active: { items: items() } };
    handler(e2);
    assert.equal(e2.active.items.length, 4, 'выключено — список как у Lampa');
  } finally {
    delete globalThis.document;
    delete globalThis.window;
    delete globalThis.Lampa;
  }
});

test('U13: экран раздач — кадр под шапкой, прокрутка раздач по высоте колонки', () => {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => d, field: () => undefined } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  let css;
  try {
    for (const f of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '31_v2_torrents_menu.js', '30_css.js']) loadInto(LC, module, f);
    css = LC.buildCss();
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
  const S = 'body.lumen-torrents-on .activity.lumen-torrents ';
  assert.ok(css.indexOf(S + '.lumen-tframe{position:absolute;top:-4em;left:0;right:0;height:20.66em;') >= 0, 'кадр поднят под шапку');
  assert.ok(/body\.lumen-torrents-on \.activity\.lumen-torrents\{[^}]*box-shadow:0 -4em 0 0 #/.test(css), 'полосу без задника закрывает фон темы');
  assert.ok(css.indexOf(S + '.explorer{height:-webkit-calc(100vh - 4em);height:calc(100vh - 4em)}') >= 0);
  assert.ok(css.indexOf(S + '.explorer__files-body > .scroll{position:absolute;top:0;left:0;right:0;bottom:0;height:auto !important}') >= 0);
  assert.ok(css.indexOf(S + '.explorer__files-body{position:relative;') >= 0);
});

/* Живой путь: подписка 'torrent' (render) ставит чипы в строку медиачипов,
   то, что Lampa уже нарисовала, не повторяет; 'torrent_file' переводит
   фокус следующим тиком. */
function fakeNode(className, text) {
  const node = {
    className, textContent: text || '', children: [], attrs: {},
    classList: { remove: (c) => { node.className = node.className.split(' ').filter((x) => x !== c).join(' '); } },
    getAttribute: (n) => node.attrs[n] || null,
    setAttribute: (n, v) => { node.attrs[n] = v; },
    appendChild: (ch) => { node.children.push(ch); }
  };
  return node;
}

function livePath(prefs) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const handlers = {};
  const storage = Object.assign({}, prefs);
  const calls = [];
  const timers = [];
  const focused = { el: null };
  const Lampa = {
    Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] },
    Listener: { follow: (name, fn) => { handlers[name] = fn; } },
    Controller: { enabled: () => ({ name: 'modal' }), collectionFocus: (t, r) => calls.push([t, r]) },
    Modal: { scroll: () => ({ render: () => 'modal-scroll' }) }
  };
  globalThis.window = { Lampa };
  globalThis.Lampa = Lampa;
  globalThis.document = {
    body: { classList: { contains: (c) => c === 'lumen-torrents-on' } },
    createElement: () => fakeNode(''),
    querySelector: () => focused.el
  };
  const realSet = globalThis.setTimeout;
  globalThis.setTimeout = (fn) => { timers.push(fn); return timers.length; };
  for (const f of ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js', '30_css.js', '65_torrents.js']) loadInto(LC, module, f);
  module.exports.install();
  const restore = () => {
    globalThis.setTimeout = realSet;
    delete globalThis.window; delete globalThis.Lampa; delete globalThis.document;
  };
  return { handlers, calls, timers, focused, restore };
}

function torrentItem(box) {
  return { find: (sel) => (sel === '.torrent-item__ffprobe' ? [box] : []) };
}

test('1.4: метки в строке раздачи — без повтора того, что показала Lampa', () => {
  const env = livePath({});
  try {
    const box = fakeNode('torrent-item__ffprobe hide');
    box.children.push(fakeNode('m-resolution', 'FHD'), fakeNode('m-audio', 'RUS - Дубляж'));
    env.handlers.torrent({ type: 'render', item: torrentItem(box), element: { Title: 'Дюна / Dune (2021) BDRip 1080p HDR10 | Дубляж' } });
    assert.deepEqual(box.children.slice(2).map((c) => [c.className, c.textContent]), [['lumen-ttag', 'HDR']]);
    const box2 = fakeNode('torrent-item__ffprobe hide');
    env.handlers.torrent({ type: 'render', item: torrentItem(box2), element: { Title: 'The Batman 2022 2160p WEB-DL DV | Eng' } });
    assert.deepEqual(box2.children.map((c) => c.textContent), ['4K', 'DV', 'Нет русской дорожки']);
    assert.equal(box2.className, 'torrent-item__ffprobe', 'строка медиачипов показана');
    env.handlers.torrent({ type: 'render', item: torrentItem(box2), element: { Title: 'The Batman 2022 2160p WEB-DL DV | Eng' } });
    assert.equal(box2.children.length, 3, 'повторный render не дублирует');
  } finally {
    env.restore();
  }
});

function fileEvents(env, percents) {
  env.handlers.torrent_file({ type: 'list_open', items: [] });
  const nodes = [];
  percents.forEach((p, i) => {
    const node = { id: 'ep' + (i + 1) };
    nodes.push(node);
    env.handlers.torrent_file({ type: 'render', item: { 0: node, find: () => [] }, element: { episode: i + 1, timeline: { percent: p } } });
  });
  return nodes;
}

test('1.4: файлы сериала — фокус на следующей серии, только пока человек не двигал фокус', () => {
  const env = livePath({ lumen_ts_resume_focus: true });
  try {
    const nodes = fileEvents(env, [100, 100, 0, 0]);
    assert.equal(env.timers.length, 1, 'один отложенный перевод на список');
    env.focused.el = nodes[1];
    env.timers.shift()();
    assert.deepEqual(env.calls, [[nodes[2], 'modal-scroll']]);
    const again = fileEvents(env, [100, 100, 0, 0]);
    env.focused.el = again[0];
    env.timers.shift()();
    assert.equal(env.calls.length, 1, 'фокус уже сдвинули — не трогаем');
  } finally {
    env.restore();
  }
});

test('1.4: «Фокус на следующей серии» выключен — список как у Lampa', () => {
  const env = livePath({ lumen_ts_resume_focus: 'false' });
  try {
    fileEvents(env, [100, 100, 0]);
    assert.equal(env.timers.length, 0);
    assert.equal(env.calls.length, 0);
  } finally {
    env.restore();
  }
});

test('1.4: «Фокус на следующей серии» не трогали — список как у Lampa (opt-in)', () => {
  const env = livePath({});
  try {
    fileEvents(env, [100, 100, 0]);
    assert.equal(env.timers.length, 0);
    assert.equal(env.calls.length, 0);
  } finally {
    env.restore();
  }
});

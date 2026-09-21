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
  for (const f of ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js', '30_css.js', '65_torrents.js']) loadInto(LC, module, f);
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

/* Task 43: гарнитура у экранов пути та же, что у карточки (LC.tokens
   .fontBody), а набор весов грузится один на весь плагин (LC.fontsUrl).
   Проверка весов в css.test.mjs смотрит только на LC.buildCss — эти 35
   объявлений в неё не попадают вовсе, а недостающий вес браузер
   синтезирует сам, и на 1080p псевдожирность выглядит грязно. */
test('Task 43: все веса CSS экранов пути есть в наборе Google Fonts', () => {
  const url = baseLC.fontsUrl();
  const have = /:wght@([\d;]+)/.exec(url)[1].split(';');
  const used = new Set((t.css().match(/font-weight:\d+/g) || []).map((m) => m.slice('font-weight:'.length)));
  assert.ok(used.size, 'в таблице экранов пути не нашлось ни одного font-weight');
  for (const w of used) {
    assert.ok(have.indexOf(w) !== -1, 'вес ' + w + ' стоит в стилях, но его нет в наборе ' + have.join(';'));
  }
});

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
    /* Task 26: разделитель групп меню (штатный separator:true) — он же
       отделяет наши пункты в меню карточки. */
    '.selectbox .settings-param-title',
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

/* -------------------------------------------------------------------- */
/* Task 53: меню (Select/Modal) — отступы, инверсия фокуса, без размытия  */
/* подложки.                                                             */
/* -------------------------------------------------------------------- */

/* Тело первого правила, у которого хотя бы один селектор равен sel
   (селекторы в css() уже развёрнуты парой «режим all + маркер режима path»,
   поэтому достаточно проверить любую половину пары). */
function declOf(sel) {
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) if (p.selectors.indexOf(sel) !== -1) return p.decl;
  }
  return null;
}

test('Task 53: пункт меню — паддинг .7em 1.4em и will-change:auto', () => {
  const decl = declOf('.selectbox.lumen-select .selectbox-item');
  assert.ok(decl, 'правило пункта меню не найдено');
  assert.match(decl, /(^|;)padding:\.7em 1\.4em(;|$)/, 'текст должен стоять в 1.4em от кромки: ' + decl);
  /* Lampa обещает движение каждому пункту (will-change:transform,
     vendor/lampa/css/app.css:7154) — у нас двигается только тот, что в
     фокусе, и только в режиме «Полные». */
  assert.match(decl, /(^|;)will-change:auto(;|$)/, decl);

  /* Производные от базового паддинга: квадрат чекбокса и галочка выбранного
     пункта встают на ту же кромку 1.4em, а поле под текст растёт на их
     ширину с прежним зазором — иначе они наедут на текст. */
  assert.match(declOf('.selectbox.lumen-select .selectbox-item--checkbox'), /padding-left:3\.242em;padding-right:1\.4em/);
  assert.match(declOf('.selectbox.lumen-select .selectbox-item__checkbox'), /(^|;)left:1\.4em(;|$)/);
  assert.match(declOf('.selectbox.lumen-select .selectbox-item.selected:not(.nomark)'), /(^|;)padding-right:3\.329em(;|$)/);
  assert.match(declOf('.selectbox.lumen-select .selectbox-item.selected:not(.nomark)::after'), /(^|;)right:1\.4em(;|$)/);

  /* Ревью Task 53: подпись группы (штатный separator:true, у нас — меню по
     удержанию OK, src/63_cardmenu.js:411, :483) стоит по одной линии с
     текстом пунктов. Считать приходится в разных кеглях: у пункта em базовый,
     у подписи — свой, .745 базового, поэтому одно и то же расстояние
     записывается разными числами. Lampa обе величины держит равными
     (padding 1.5em 2em у пункта и у подписи — app.css:7151-7155 и :2546-2548). */
  const item = declOf('.selectbox.lumen-select .selectbox-item');
  const title = declOf('.selectbox.lumen-select .settings-param-title');
  assert.ok(title, 'правило подписи группы не найдено');
  /* Сокращённая запись в четыре значения; «0» без единицы тоже считается. */
  const sides = (prop, decl) => {
    const m = new RegExp('(?:^|;)' + prop + ':([^;}]+)').exec(decl);
    assert.ok(m, prop + ' не найден в ' + decl);
    const v = m[1].trim().split(/\s+/).map(parseFloat);
    assert.equal(v.length, 4, prop + ' записан не четырьмя значениями: ' + m[1]);
    return { top: v[0], right: v[1], bottom: v[2], left: v[3] };
  };
  const pad = (decl) => {
    const m = /(?:^|;)padding:([^;}]+)/.exec(decl);
    const v = m[1].trim().split(/\s+/).map(parseFloat);
    return { y: v[0], x: v.length > 1 ? v[1] : v[0] };
  };
  const TITLE_EM = parseFloat(/font-size:([\d.]+)em/.exec(title)[1]);
  const itemLeft = sides('margin', item).left + pad(item).x;
  const titleLeft = sides('margin', title).left * TITLE_EM;
  assert.ok(Math.abs(itemLeft - titleLeft) < 0.01,
    'подпись группы разъехалась со списком: текст пункта в ' + itemLeft.toFixed(3) + 'em от кромки, подпись — в ' + titleLeft.toFixed(3) + 'em');
  const itemRight = sides('margin', item).right + pad(item).x;
  const titleRight = sides('margin', title).right * TITLE_EM;
  assert.ok(Math.abs(itemRight - titleRight) < 0.01,
    'правая кромка подписи разъехалась: пункт ' + itemRight.toFixed(3) + 'em, подпись ' + titleRight.toFixed(3) + 'em');
});

/* Ревью Task 53. Lampa под body.glass--style вешает filter:invert(1) на
   квадрат чекбокса в фокусе (vendor/lampa/css/app.css:16073-16081) — под
   свой белый фокус, где инверсия и задумана. У нас заливка фокуса тоже
   светлая, и инвертированный тёмный квадрат на ней пропадает: filter мы не
   объявляли, а значит правило Lampa действовало беспрепятственно. */
test('Ревью Task 53: filter Lampa не съедает чекбокс на инверсии фокуса', () => {
  const decl = declOf('.selectbox.lumen-select .selectbox-item.focus .selectbox-item__checkbox');
  assert.ok(decl, 'правило чекбокса в фокусе не найдено');
  assert.match(decl, /-webkit-filter:none;filter:none/, 'filter:none парой с префиксом: ' + decl);
});

test('Task 53: фокус пункта — инверсия, и всё внутри фокуса согласовано с ней', () => {
  const k = baseLC.tokens();
  assert.equal(declOf('.selectbox.lumen-select .selectbox-item.focus').indexOf('background-color:' + k.text + ';color:' + k.bg), 0,
    'фокус обязан быть инверсией k.text/k.bg');
  /* Подпись, рамка и заливка чекбокса, галочка выбранного пункта — всё, что
     стояло на k.onac (тексте на акценте), переезжает на k.bg. */
  for (const sel of [
    '.selectbox.lumen-select .selectbox-item.focus .selectbox-item__subtitle',
    '.selectbox.lumen-select .selectbox-item.focus .selectbox-item__checkbox',
    '.selectbox.lumen-select .selectbox-item--checked.focus .selectbox-item__checkbox',
    '.selectbox.lumen-select .selectbox-item.selected.focus:not(.nomark)::after'
  ]) {
    const decl = declOf(sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf(k.bg) !== -1, sel + ': цвет не согласован с инверсией: ' + decl);
    assert.equal(decl.indexOf(k.onac), -1, sel + ': остался цвет текста на акценте: ' + decl);
  }
  /* Ни одного правила фокуса в блоке selectbox, где на светлой заливке
     остался бы акцент или цвет текста на нём. Исключение — заливка самого
     квадрата чекбокса: она k.bg, и галочка на ней рисуется акцентом
     (правило .selectbox-item--checked .selectbox-item__checkbox::after). */
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      const own = p.selectors.some((s) => /\.selectbox(\.lumen-select)? .*\.selectbox-item[^ ]*\.focus/.test(s));
      if (!own) continue;
      if (p.selectors.some((s) => s.indexOf('__checkbox::after') !== -1)) continue;
      assert.equal(p.decl.indexOf(k.onac), -1, 'цвет текста на акценте внутри инверсии: ' + p.selectors.join(',') + ' -> ' + p.decl);
      assert.equal(p.decl.indexOf(k.accent), -1, 'акцент внутри инверсии: ' + p.selectors.join(',') + ' -> ' + p.decl);
    }
  }
});

/* Замер на живой Lampa 3.3.4 (localhost:8766, 2026-09-21): заливка фокуса
   стоит во всех трёх режимах движения и в обоих режимах меню. Тест
   закрывает единственный способ её потерять — правило режима, которое
   перекрыло бы background у того же элемента: правил с заливкой на
   .selectbox-item.focus ровно одно, значит спорить с ним нечему, какой бы
   класс lumen-motion-* ни стоял на body. */
test('Task 53: во всех трёх режимах движения у .selectbox-item.focus есть непрозрачная заливка', () => {
  /* Селектор действует в режиме mode, если он либо не упоминает режим вовсе,
     либо упоминает именно этот. */
  const appliesIn = (sel, mode) => !/lumen-motion-/.test(sel) || sel.indexOf('lumen-motion-' + mode) !== -1;
  /* Селектор попадает в фокусный пункт меню: либо прямо .selectbox-item.focus,
     либо базовое правило .selectbox-item (фокусный пункт — тоже пункт). */
  const hitsFocusItem = (sel) => /\.selectbox-item(\.focus)?$/.test(sel);

  for (const mode of ['full', 'lite', 'off']) {
    const fills = [];
    for (const r of rules()) {
      const parsed = parse(r);
      if (!parsed) continue;
      for (const p of parsed) {
        if (!p.selectors.some((s) => appliesIn(s, mode) && hitsFocusItem(s))) continue;
        for (const m of p.decl.matchAll(/(?:^|;)background(?:-color)?:([^;]+)/g)) fills.push(m[1]);
      }
    }
    assert.equal(fills.length, 1, mode + ': заливок на фокусном пункте должно быть ровно одна, нашлось ' + fills.length + ' — ' + fills.join(' | '));
    assert.match(fills[0], /^#[0-9A-Fa-f]{6}$/, mode + ': заливка обязана быть непрозрачной: ' + fills[0]);
  }
});

test('Task 53: подложки Select и Modal — без backdrop-filter, парой с -webkit-', () => {
  /* Lampa под body.glass--style вешает на .selectbox__content, .modal__content
     и ещё шесть узлов одним правилом background-color rgba(70,70,70,.3) плюс
     blur(1.6em) — vendor/lampa/css/app.css:16047-16059. Наши панели
     непрозрачны, размытие под ними не видно, а WebView читает ради него
     пиксели под элементом каждый кадр. */
  for (const sel of ['.selectbox.lumen-select .selectbox__content', '.modal.lumen-modal .modal__content']) {
    const decl = declOf(sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.match(decl, /-webkit-backdrop-filter:none;backdrop-filter:none/, sel + ': ' + decl);
  }
});

/* Task 54: фокус кнопок пути — та же инверсия, что у кнопок карточки
   (k.text заливкой, k.bg подписью). Раздача, файл и серия сюда НЕ входят:
   у раздачи под текстом идёт своя тёмная карта с медиачипами, у серии —
   превью 200×112, и сплошная светлая заливка их перекрыла бы. У них фокус
   держится рамкой, подложкой и цветом текста. */
test('Task 54: фокус кнопок экранов пути — инверсия, без акцентной заливки и рамки', () => {
  const k = baseLC.tokens();
  const BTN = [
    'body.lumen-torrents-on .lumen-torrents .torrent-filter .simple-button.focus',
    'body.lumen-torrents-on .lumen-torrents .empty__footer .simple-button.focus',
    'body.lumen-torrents-on .lumen-torrents .empty-filter__buttons .simple-button.focus',
    'body.lumen-torrents-on .torrent-checklist__footer .simple-button.focus'
  ];
  for (const sel of BTN) {
    const own = [];
    for (const r of rules()) {
      const parsed = parse(r);
      if (!parsed) continue;
      for (const p of parsed) if (p.selectors.indexOf(sel) !== -1) own.push(p.decl);
    }
    assert.ok(own.length, 'правил на ' + sel + ' не нашлось вовсе');
    assert.ok(own.some((d) => d.indexOf('background-color:' + k.text + ';color:' + k.bg) !== -1),
      sel + ': фокус не инверсия — ' + own.join(' || '));
    for (const d of own) {
      assert.equal(new RegExp('background(-color)?:' + k.accent).test(d), false, sel + ': мёртвая акцентная заливка — ' + d);
      assert.equal(new RegExp('border-color:(' + k.accent + '|' + k.ring + ')').test(d), false, sel + ': мёртвая акцентная рамка — ' + d);
    }
  }
  /* Подписи внутри чипа («Поиск: …», «Сортировать: …», точка «фильтр
     применён») красились цветом текста на акценте — на светлой заливке его
     не видно, поэтому они переезжают на k.bg вместе с самой заливкой. */
  for (const sel of [
    'body.lumen-torrents-on .lumen-torrents .torrent-filter .filter--search.focus > div',
    'body.lumen-torrents-on .lumen-torrents .torrent-filter .filter--sort.focus > div',
    'body.lumen-torrents-on .lumen-torrents .torrent-filter .filter--filter.focus > div:not(.hide)'
  ]) {
    const decl = declOf(sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf(k.bg) !== -1, sel + ': цвет не согласован с инверсией: ' + decl);
    assert.equal(decl.indexOf(k.onac), -1, sel + ': остался цвет текста на акценте: ' + decl);
  }
});

/* Task 50c: та же проверка, что у таблицы карточки (test/css.test.mjs) —
   экраны пути листаются тем же D-pad, и каждый шаг фокуса перерисовывает
   слой по площади, расширенной радиусом размытия во все стороны. Шкала em
   здесь местами своя: .torrent-filter .simple-button живёт на font-size
   .877em, кнопка чек-листа — на 1.052em, поэтому смещения у них не .2em, а
   .23em и .19em — это те же ~4.6 px, что и на главной. Проверяется только
   нулевой радиус: он от шкалы не зависит.
   Правила фокуса без тени (.explorer-card__head-img.focus::after — кольцо
   постера, .torrnet-folder-name.focus — цвет подписи папки) проверке не
   мешают: у них box-shadow нет вовсе. */
test('Task 50c: ни одной тени с размытием ни на одном правиле фокуса экранов пути', () => {
  const shadows = [];
  for (const r of rules()) {
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      if (!p.selectors.some((s) => /\.focus\b/.test(s))) continue;
      for (const m of p.decl.matchAll(/box-shadow:([^;}]+)/g)) shadows.push(p.selectors.join(',') + ' -> ' + m[1]);
    }
  }
  /* Пять правил с тенью — чипы фильтра, раздача, «Продолжить», кнопка
     чек-листа, файл/серия; каждое удвоено префиксом. */
  assert.ok(shadows.length >= 10, 'теней на правилах фокуса нашлось подозрительно мало — проверка почти пустая: ' + shadows.length);
  assert.deepEqual(shadows.filter((s) => !/-> 0 [\d.]+em 0 /.test(s)), [],
    'тень с ненулевым размытием на шаге фокуса');
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

/* Долг ревью Task 9 (п.3): движок без CSS-масок (старые webOS/Tizen) рисует
   вместо маски пустой закрашенный прямоугольник — на экранах пути это были бы
   цветные кубики вместо галочек, звёзд и спиннера. Инвариант: КАЖДЫЙ селектор,
   которому выдана mask-image:url(...), обязан быть погашен внутри
   @supports not (...mask-image...) — либо display:none, либо (там, где узел
   несёт собственное оформление, как спиннер-кольцо) background-color:transparent.

   Раньше это держалось только на глазах ревьюера: маску легко добавить и
   забыть фолбэк, ни один тест этого не ловил. */
test('маски: у каждого селектора с mask-image есть фолбэк в @supports not — display:none или background-color:transparent', () => {
  const masked = [];
  const fallback = {};

  for (const r of rules()) {
    if (r.indexOf('/*') === 0) continue;
    const isFallback = r.indexOf('@supports not (') === 0;
    const parsed = parse(r);
    if (!parsed) continue;
    for (const p of parsed) {
      for (const s of p.selectors) {
        if (isFallback) {
          fallback[s] = (fallback[s] || '') + ';' + p.decl;
        } else if (/(^|;)mask-image:url/.test(p.decl)) {
          masked.push(s);
        }
      }
    }
  }

  assert.ok(masked.length > 0, 'в CSS пути не нашлось ни одной маски — проверка потеряла смысл');
  for (const s of masked) {
    const decl = fallback[s];
    assert.ok(decl, 'маска без фолбэка @supports not: ' + s);
    assert.ok(/(^|;)display:none/.test(decl) || /(^|;)background-color:transparent/.test(decl),
      'фолбэк не гасит закрашенный прямоугольник: ' + s + '\n  ' + decl);
  }
});

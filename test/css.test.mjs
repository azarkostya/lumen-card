import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* LC.buildCss() читает LC.pref (Storage 'proxy_tmdb' и т.п.) и PLUGIN — обе
   вещи объявлены в 00_head.js, но test/_load.mjs грузит модули по одному в
   свежий LC, а 00_head.js вдобавок сам переопределяет параметр LC своим
   var LC = {} (не для переиспользования вне общей IIFE). Поэтому здесь —
   свой мини-загрузчик: несколько src/*.js в ОДИН общий LC/module, в порядке
   зависимостей (10 util -> 20 icons -> 80 settings -> 30 css), плюс минимальные
   заглушки window/Lampa/PLUGIN/warn вместо DOM (buildCss сам не трогает DOM —
   этим занимается LC.injectCss, здесь не вызывается). */
globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function buildCss() {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '10_util.js');
  loadInto(LC, module, '20_icons.js');
  loadInto(LC, module, '80_settings.js');
  loadInto(LC, module, '81_prefs.js');
  loadInto(LC, module, '30_css.js');
  return LC.buildCss();
}

const css = buildCss();

/* Task 32: LC.tokens() — палитра, текущий акцент и стеки шрифтов наружу для
   src/65_torrents.js (палитра не дублируется). Storage подменяется через
   window.Lampa только на время вызова. */
function tokensWith(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def) } };
  globalThis.window = { Lampa: Lampa };
  globalThis.Lampa = Lampa;
  try {
    loadInto(LC, module, '10_util.js');
    loadInto(LC, module, '20_icons.js');
    loadInto(LC, module, '80_settings.js');
    loadInto(LC, module, '81_prefs.js');
    loadInto(LC, module, '30_css.js');
    return LC.tokens();
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

/* Правка 2026-09-16 (п.6): CSS и адрес <link> шрифтов зависят от настройки
   lumen_font — собираем их с подменённым Storage тем же приёмом, что tokens.

   Storage.field, а не только get: настройки самой Lampa плагин читает именно
   им (Storage.field отдаёт значение из кэша в памяти), и от одной из них —
   'interface_size' — зависят оба порога раскладки (screenEm, src/30_css.js).
   Ключ тот же самый, поэтому вторая заглушка смотрит в тот же объект. */
function withStorage(storage, fn, innerWidth) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = {
    Storage: {
      get: (name, def) => (name in storage ? storage[name] : def),
      field: (name) => storage[name]
    }
  };
  /* Ширина окна — та, на которой модели раскладки ниже считают экран
     (960 CSS px, WebView телевизора пользователя). От неё зависит пол
     кегля Lampa 10.6 px: на «мельче» при 960 px он включается, и таблица
     стилей считает пороги по 90.57 em экрана, а не по 93.52 (screenEm,
     src/30_css.js). Модель обязана видеть ту же ширину, иначе она проверяла
     бы таблицу, собранную для другого окна.
     Третий аргумент — другая ширина окна: правило кромки главной
     проверяется и на окнах браузера ПК (1280…2560 CSS px). */
  globalThis.window = { Lampa: Lampa, innerWidth: innerWidth || 960 };
  globalThis.Lampa = Lampa;
  try {
    loadInto(LC, module, '10_util.js');
    loadInto(LC, module, '20_icons.js');
    loadInto(LC, module, '80_settings.js');
    loadInto(LC, module, '81_prefs.js');
    loadInto(LC, module, '30_css.js');
    return fn(LC);
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

test('LC.tokens: палитра карточки, акцент по настройке, onac/ring/acglow, шрифты', () => {
  const t = tokensWith({});
  assert.equal(t.panel, '#1C1613');
  assert.equal(t.line, '#2C231D');
  assert.equal(t.text, '#F3EDE4');
  assert.equal(t.muted, '#A89A8A');
  assert.equal(t.smoke, '#7A6A5A');
  assert.equal(t.spice, '#D9622B');
  assert.equal(t.accent, '#E8B87A');
  assert.equal(t.accentRgb, '232,184,122');
  assert.equal(t.onac, '#1A120A');
  assert.equal(t.ring, '#FFF2DC');
  assert.equal(t.acglow, 'rgba(232,184,122,0.35)');
  // экраны пути (экспорт «Lumen Torrents»): панель в фокусе/тёмная/приподнятая, rgb текста и фона для rgba()
  assert.equal(t.panelHi, '#221A13');
  assert.equal(t.panelLo, '#17120F');
  assert.equal(t.raised, '#241C17');
  assert.equal(t.textRgb, '243,237,228');
  assert.equal(t.bgRgb, '11,9,8');
  assert.match(t.fontBody, /^"Golos Text"/);
  /* Task 43: гарнитура одна — прежних fontDisplay/fontMono больше нет. */
  assert.equal('fontDisplay' in t, false);
  assert.equal('fontMono' in t, false);

  const ice = tokensWith({ lumen_card_accent: 'ice', lumen_card_fonts: 'false' });
  assert.equal(ice.accent, '#7FB7C9');
  assert.equal(ice.onac, '#08171C');
  assert.equal(ice.ring, '#E9F7FB');
  assert.equal(ice.fontBody, 'inherit');

  assert.equal(tokensWith({ lumen_card_accent: 'nope' }).accent, '#E8B87A');
});

test('buildCss: нет литерала .0625em (остаток базы 16, должен быть .04em)', () => {
  assert.equal(css.indexOf('.0625em'), -1);
});

test('buildCss: нет inset (запрещено планом)', () => {
  assert.equal(/inset\s*:/.test(css), false);
});

test('buildCss: нет :has() (запрещено планом)', () => {
  assert.equal(css.indexOf(':has('), -1);
});

test('buildCss: .lumen-title--long содержит display:-webkit-box и -webkit-box-orient:vertical', () => {
  const m = /\.lumen-card \.full-start-new__title\.lumen-title--long\{([^}]*)\}/.exec(css);
  assert.ok(m, 'правило .lumen-title--long не найдено');
  assert.ok(m[1].indexOf('display:-webkit-box') !== -1, 'нет display:-webkit-box');
  assert.ok(m[1].indexOf('-webkit-box-orient:vertical') !== -1, 'нет -webkit-box-orient:vertical');
  assert.ok(m[1].indexOf('overflow:hidden') !== -1, 'нет overflow:hidden');
  /* Правка 2026-09-23 (разбор композиции, п.2.1): фолбэк для названий без
     разделителя — кегль на ступень ниже (Title 1 76 px -> Title 2 57 px),
     чтобы две строки дочитывались, а не обрывались многоточием. */
  assert.ok(m[1].indexOf('font-size:2.5em') !== -1, 'фолбэк не опустил кегль на ступень: ' + m[1]);
  assert.ok(m[1].indexOf('line-height:1.16') !== -1, 'со ступенью не взят её межстрочный: ' + m[1]);
  /* «На ступень ниже ТЕКУЩЕЙ»: в узкой ветке текущая уже Title 2, и фолбэк
     обязан брать Title 3 — иначе на целевом экране 960×540@2 он не делает
     ничего (замер: обе ветки давали 2.5em и 66.2 px на две строки). */
  const narrowLong = ruleBodiesWithMedia(css).find((r) => r.media && /max-width:\d+px/.test(r.media) &&
    r.selectors.some((s) => s === '.lumen-card .full-start-new__title.lumen-title--long'));
  assert.ok(narrowLong && narrowLong.decl.indexOf('font-size:2.11em') !== -1, 'в узкой ветке фолбэк не опустил кегль: ' + (narrowLong && narrowLong.decl));
  assert.ok(narrowLong.decl.indexOf('line-height:1.17') !== -1, 'со ступенью не взят её межстрочный: ' + narrowLong.decl);
});

/* Правка 2026-09-23 (разбор композиции, п.2.1): название с разделителем —
   два уровня вместо двух строк с обрезкой. */
test('правка 2026-09-23: двухуровневое название — свой кегль у второго уровня, кламп у каждого', () => {
  const split = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__title.lumen-title--split');
  assert.ok(split && /display:block/.test(split), 'контейнер остался -webkit-box — кламп Lampa схлопнет уровни: ' + split);
  const lead = findDecl(css, (sel) => sel === '.lumen-card .lumen-title__lead');
  const sub = findDecl(css, (sel) => sel === '.lumen-card .lumen-title__sub');
  for (const [name, decl] of [['ведущий', lead], ['второй', sub]]) {
    assert.ok(decl, 'правила «' + name + ' уровень» нет');
    assert.ok(/display:-webkit-box/.test(decl) && /-webkit-box-orient:vertical/.test(decl) && /overflow:hidden/.test(decl) && /-webkit-line-clamp:2/.test(decl),
      name + ' уровень обрезается не своим многоточием: ' + decl);
  }
  /* Второй уровень мельче и приглушён — иначе это не второй уровень. */
  const size = /(?:^|;)font-size:([\d.]+)em/.exec(sub);
  assert.ok(size && parseFloat(size[1]) < 1, 'второй уровень не мельче ведущего: ' + sub);
  assert.equal(/(?:^|;)font-size:/.test(lead), false, 'ведущему уровню задан свой кегль — он обязан брать его у заголовка: ' + lead);
  const P = tokensWith({});
  assert.ok(new RegExp('color:' + P.muted + '($|;)').test(sub), 'второй уровень не приглушён: ' + sub);
});

/* Допустимые корни селекторов в шапке карточки: .lumen-card (и составной
   .full-start-new.lumen-card), .lumen-backdrop (и его дети/варианты —
   .lumen-backdrop__*, .lumen-backdrop--proc*), .full-start__background
   (только составной .full-start__background.lumen-off — выключение штатного
   фона Lampa), body. — фактически в текущем CSS не встречается, но остаётся
   в списке разрешённых на будущее (по требованию ревью). */
/* Task 5d: ряд описания (компонент 'description') лежит ВНЕ .lumen-card —
   это отдельный items-line ниже шапки, поэтому его правила не могут начинаться
   с корня карточки. Свой корень .lumen-descr-row (класс вешает LC.header на
   узел ряда) держит их так же строго в скоупе плагина: без нашего класса ни
   одно правило на чужой ряд не подействует. */
/* Task 9: модал отзыва (экран 08) живёт в .modal Lampa — вне карточки и вне
   ряда описания, поэтому у него собственный корень .lumen-review-modal (класс
   ставит сам блок, без нашего DOM ни одно правило не сработает). */
/* Task 17: хаб подборок и сетка подборки — отдельные активности Lampa,
   целиком построенные плагином (компоненты lumen_hub / lumen_grid). Чужой
   разметки внутри них нет, а снаружи ни одно правило не действует: корень
   ставит сам компонент. */
/* Task 25: .lumen-skeleton — общая плашка загрузки. Класс ставит сам плагин
   (герой, ряд отзывов, кадр плитки хаба), без нашего DOM его не бывает, а
   правило нарочно одно на все три корня: пульсация должна быть одинаковой и
   гаситься в lite/off одним местом. */
/* Правка 2026-09-17 (второй круг): чипы настроения переехали из блока героя
   в собственный узел корня активности, поэтому у них появились свои корни —
   .lumen-moods (и признак раскладки .lumen-moods-on на том же корне) и
   .lumen-mood-chip. Оба класса создаёт плагин, чужой разметки под ними нет. */
/* Правка 2026-09-23 (разбор композиции, п.4.1): .lumen-scrim — затемнение
   под содержимым карточки. Класс ставит сам плагин на вертикальную ленту
   содержимого (src/50_backdrops.js), без нашего DOM его не бывает, а само
   правило — один background-image, чужой разметке он ничего не меняет. */
const ALLOWED_ROOTS = ['.lumen-scrim', '.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-descr-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton', '.lumen-overlay', '.lumen-minimap', '.lumen-jump', '.lumen-ambient', '.lumen-roulette', '.lumen-menu-roulette', '.lumen-hud', '.full-start__background', '.full-start-new', 'body'];

/* Ревью Task 5a (замечание, зафиксировано в Task 5b): проверка была по
   sel.indexOf(root) === 0 без учёта границы селектора — так
   '.full-start-new__buttons …' ложно проходил как начинающийся с
   '.full-start-new', хотя это ДРУГОЙ класс Lampa (используется на любом
   экране с .full-start-new, не только внутри нашей .lumen-card — реальный
   риск протечки стилей мимо скоупа). После корня обязана идти граница:
   пробел, '.', ',', ':', '>', '{' или конец строки.
   Исключение — собственные BEM-неймспейсы плагина (.lumen-backdrop):
   '.lumen-backdrop__img'/'--proc0' и т.п. — ОДИН класс целиком, без точки
   между корнем и модификатором, но это className плагин создаёт сам (его
   не бывает без нашего DOM) — поэтому '_'/'-' сразу после корня для них
   тоже безопасная граница, в отличие от чужих классов Lampa. */
var OWN_NAMESPACE_ROOTS = ['.lumen-scrim', '.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-descr-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton', '.lumen-overlay', '.lumen-minimap', '.lumen-jump', '.lumen-ambient', '.lumen-roulette', '.lumen-menu-roulette'];

function startsWithRoot(sel, root) {
  if (sel.indexOf(root) !== 0) return false;
  var next = sel.charAt(root.length);
  if (next === '' || /[\s.,:>{]/.test(next)) return true;
  if (OWN_NAMESPACE_ROOTS.indexOf(root) !== -1 && (next === '_' || next === '-')) return true;
  return false;
}

function ruleSelectors(cssText) {
  /* Извлекает селекторы всех правил верхнего уровня, разворачивая один уровень
     @media/@supports (в файле они не вложены глубже). @keyframes пропускаются —
     это не селекторы элементов. */
  const out = [];
  const rules = cssText.split('\n');
  for (const line of rules) {
    if (!line) continue;
    if (/^@-?(webkit-)?keyframes/.test(line)) continue;
    let body = line;
    if (/^@(media|supports)/.test(line)) {
      const firstBrace = line.indexOf('{');
      body = line.slice(firstBrace + 1);
    }
    const selPart = body.split('{')[0];
    for (const sel of selPart.split(',')) out.push(sel.trim());
  }
  return out.filter(Boolean);
}

/* Ревью Task 5b (правки координатора, п.5): как ruleSelectors, но с телом
   правила — нужно тестам, которые ищут правило ПО МНОЖЕСТВУ его селекторов
   (после разбивки запятой через .some()), а не регуляркой по точному тексту
   всей строки (порядок lumen-motion-lite/off, пробелы между селекторами —
   деталь реализации, не часть контракта). */
/* Ревью 2026-09-21: раньше от строки @media/@supports бралось всё между
   ПЕРВОЙ '{' и ПОСЛЕДНЕЙ '}', поэтому из блока с несколькими правилами
   подряд учитывался селектор только первого, а объявления всех правил
   склеивались в одну строку. Проверки, которые обещают «любое правило, где
   бы его ни написали», для второго и дальше правила не работали. Разбор
   теперь такой же, как у таблицы экранов пути (test/torrents.test.mjs):
   блок режется по закрывающей скобке каждого правила. */
function ruleBodies(cssText) {
  const out = [];
  const lines = cssText.split('\n');
  for (const line of lines) {
    if (!line) continue;
    if (/^@-?(webkit-)?keyframes/.test(line)) continue;
    let body = line;
    if (/^@(media|supports)/.test(line)) body = line.slice(line.indexOf('{') + 1, line.lastIndexOf('}'));
    for (const piece of body.split('}')) {
      const open = piece.indexOf('{');
      if (open === -1) continue;
      const selectors = piece.slice(0, open).split(',').map((s) => s.trim()).filter(Boolean);
      if (!selectors.length) continue;
      out.push({ selectors, decl: piece.slice(open + 1) });
    }
  }
  return out;
}

/* Разбор обязан видеть КАЖДОЕ правило внутри at-rule, а не только первое —
   иначе проверки ниже тихо теряют часть таблицы. Сверяется с прямым счётом
   открывающих скобок: у каждого правила ровно одна, у @media/@supports —
   своя лишняя, у @keyframes разбор не идёт вовсе. */
test('ruleBodies: внутри @media/@supports разбирается каждое правило, а не первое', () => {
  const demo = '@supports (x:1){.a{color:red}.b,.c{color:blue}}';
  assert.deepEqual(ruleBodies(demo), [
    { selectors: ['.a'], decl: 'color:red' },
    { selectors: ['.b', '.c'], decl: 'color:blue' }
  ]);

  let expected = 0;
  for (const line of css.split('\n')) {
    if (!line || /^@-?(webkit-)?keyframes/.test(line)) continue;
    const braces = (line.match(/\{/g) || []).length;
    expected += /^@(media|supports)/.test(line) ? braces - 1 : braces;
  }
  assert.equal(ruleBodies(css).length, expected, 'часть правил таблицы не попала в разбор');
});

/* Тело первого правила, у которого ХОТЯ БЫ ОДИН селектор (после разбивки
   запятой) проходит matchSelector — или null, если такого правила нет. */
/* Медиазапросов по отношению сторон два: первый прячет описание героя,
   второй отдаёт экран рядам целиком. Тесты ниже ищут именно второй.
   Task 36 делал признаком второго возврат текстового блока героя в поток —
   кадр там превращался в полосу чипов настроения под шапкой. Волна 3
   (ТВ 2026-09-24) чипы из героя убрала, и за порогом герой снова уходит
   целиком: признак — .lumen-main .lumen-hero{display:none}. */
function heroOffMedia(cssText) {
  return cssText.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 &&
    l.indexOf('.lumen-main .lumen-hero{display:none}') !== -1);
}

function findDecl(cssText, matchSelector) {
  const rule = ruleBodies(cssText).find((r) => r.selectors.some(matchSelector));
  return rule ? rule.decl : null;
}

/* Волна 3 (ТВ 2026-09-24): разбор градиентов затемнения кадра героя.
   gradients(decl, prop) — слои linear-gradient из БЕСпрефиксного
   объявления prop ('background' или 'mask-image'): [{angle, stops}], стоп —
   {a, rgb, pos, unit}. Сплошной цвет (#RRGGBB, #000) — прозрачность 1. Скобки
   считаются, поэтому rgba(...) внутри стопов и несколько слоёв через запятую
   разбираются честно. rgb — [r, g, b] стопа (ревью раунда хвостов, п.7:
   цвет затемнения больше не один на все слои), null у #RGB. */
function gradients(declText, prop) {
  const re = new RegExp('(?:^|;)' + prop + ':([^;]*)', 'g');
  let value = null;
  let m;
  while ((m = re.exec(declText))) if (m[1].indexOf('-webkit-') !== 0) value = m[1];
  if (value === null) return [];
  const out = [];
  let at = 0;
  const head = 'linear-gradient(';
  while ((at = value.indexOf(head, at)) !== -1) {
    let depth = 0;
    let end = at + head.length - 1;
    for (; end < value.length; end++) {
      if (value[end] === '(') depth++;
      else if (value[end] === ')' && --depth === 0) break;
    }
    const body = value.slice(at + head.length, end);
    const parts = [];
    let d = 0;
    let from = 0;
    for (let k = 0; k < body.length; k++) {
      if (body[k] === '(') d++;
      else if (body[k] === ')') d--;
      else if (body[k] === ',' && !d) { parts.push(body.slice(from, k)); from = k + 1; }
    }
    parts.push(body.slice(from));
    const angle = parts.shift().trim();
    out.push({
      angle: angle,
      stops: parts.map((p) => {
        const t = p.trim();
        const pos = /\s(-?[\d.]+)(%|em|vh)?$/.exec(t);
        const rgba = /^rgba\(([^,]+),([^,]+),([^,]+),\s*([\d.]+)\)/.exec(t);
        const six = /^#([0-9A-Fa-f]{6})\b/.exec(t);
        return {
          a: rgba ? parseFloat(rgba[4]) : (/^#[0-9A-Fa-f]{3,6}\b/.test(t) ? 1 : NaN),
          rgb: rgba ? [rgba[1], rgba[2], rgba[3]].map(Number) : (six ? [0, 2, 4].map((i) => parseInt(six[1].slice(i, i + 2), 16)) : null),
          pos: pos ? parseFloat(pos[1]) : NaN,
          unit: pos ? (pos[2] || '') : ''
        };
      })
    });
    at = end;
  }
  return out;
}

/* Прозрачность градиента в точке p (в единицах его стопов): линейно между
   соседними стопами, за крайними — значение крайнего. */
function gradAt(stops, p) {
  if (p <= stops[0].pos) return stops[0].a;
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i].pos) {
      const a = stops[i - 1];
      const b = stops[i];
      return b.pos === a.pos ? b.a : a.a + (b.a - a.a) * (p - a.pos) / (b.pos - a.pos);
    }
  }
  return stops[stops.length - 1].a;
}

test('buildCss: все правила шапки ограничены допустимыми корнями', () => {
  const selectors = ruleSelectors(css);
  assert.ok(selectors.length > 20, 'подозрительно мало селекторов извлечено: ' + selectors.length);
  const offenders = selectors.filter((sel) => !ALLOWED_ROOTS.some((root) => startsWithRoot(sel, root)));
  assert.deepEqual(offenders, []);
});

test('startsWithRoot: граница селектора обязательна для чужих классов Lampa', () => {
  assert.equal(startsWithRoot('.full-start-new__buttons .full-start__button', '.full-start-new'), false);
  assert.equal(startsWithRoot('.full-start-newXYZ', '.full-start-new'), false);
  assert.equal(startsWithRoot('.full-start-new .x', '.full-start-new'), true);
  assert.equal(startsWithRoot('.full-start-new.lumen-card', '.full-start-new'), true);
  assert.equal(startsWithRoot('.full-start-new,.lumen-card', '.full-start-new'), true);
  assert.equal(startsWithRoot('.full-start-new', '.full-start-new'), true);
});

test('startsWithRoot: BEM-продолжение (__mod/--mod) разрешено только для собственных .lumen-* корней', () => {
  assert.equal(startsWithRoot('.lumen-backdrop__img', '.lumen-backdrop'), true);
  assert.equal(startsWithRoot('.lumen-backdrop--proc0 .lumen-backdrop__img', '.lumen-backdrop'), true);
  assert.equal(startsWithRoot('.lumen-cardish', '.lumen-card'), false);
});

test('buildCss: правило кнопок .active присутствует (design-spec §7b, только для button--subscribe)', () => {
  assert.ok(css.indexOf('.full-start__button.active') !== -1);
});

test('30_css.js: цвет «спайс» не захардкожен как rgb-литерал в исходнике (используется hexToRgb(C.spice))', () => {
  /* Сам вычисленный '217,98,43' законно попадает в СГЕНЕРИРОВАННЫЙ css (это и
     есть #D9622B в rgb) — проверяем исходник, а не результат buildCss(). */
  const src = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  assert.equal(src.indexOf('217,98,43'), -1, 'rgb spice должен собираться через hexToRgb(C.spice), не как литерал в источнике');
  assert.ok(src.indexOf('SPICE_RGB') !== -1, 'ожидался общий helper SPICE_RGB');
});

/* -------------------------------------------------------------------- */
/* Task 5b: постер 2:3 (.lumen-card--poster, design-spec §11) и           */
/* размытый фон без кадра (.lumen-bg--blur, design-spec §12).             */
/* -------------------------------------------------------------------- */

test('buildCss: .lumen-card--poster переопределяет v1-правило .full-start-new__left большей специфичностью + !important', () => {
  const v1 = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__left');
  assert.ok(v1, 'v1-правило (скрытие по умолчанию) не найдено');
  assert.ok(/display\s*:\s*none\s*!important/.test(v1), 'v1-правило должно прятать .full-start-new__left');

  const poster = findDecl(css, (sel) => sel.indexOf('.lumen-card--poster') !== -1 && sel.indexOf('.full-start-new__left') !== -1);
  assert.ok(poster, 'правило .lumen-card--poster .full-start-new__left не найдено');
  assert.ok(/display\s*:\s*block\s*!important/.test(poster), 'в режиме постера узел должен быть виден (!important — иначе не перебьёт v1)');
});

test('buildCss: .lumen-card--poster .full-start-new__poster оформлен как плейсхолдер §11 (radius/border/shadow)', () => {
  const decl = findDecl(css, (sel) => sel.indexOf('.lumen-card--poster') !== -1 && sel.indexOf('.full-start-new__poster') !== -1);
  assert.ok(decl, 'правило постера-плейсхолдера не найдено');
  assert.ok(decl.indexOf('border-radius') !== -1);
  assert.ok(decl.indexOf('box-shadow') !== -1);
});

/* Task 38: раньше здесь проверялось наличие filter:blur(1.75em) у
   .lumen-bg--blur в полном режиме. Фильтр снят со всех режимов сразу —
   размытие даёт апскейл постера (w92 в src/50_backdrops.js), — поэтому тест
   перевёрнут: правило осталось (по нему идёт scale, прячущий края), но
   фильтра в нём быть не должно. */
test('buildCss: .lumen-bg--blur в lumen-motion-full — scale без filter (размытие даёт сам постер)', () => {
  const decl = findDecl(css, (sel) => sel.indexOf('.lumen-backdrop') === 0 && sel.indexOf('lumen-motion-full') !== -1 && sel.indexOf('lumen-bg--blur') !== -1);
  assert.ok(decl, 'правило .lumen-bg--blur для lumen-motion-full не найдено');
  assert.ok(decl.indexOf('scale(1.1)') !== -1, 'наезд остаётся: он прячет края растянутого постера');
  assert.equal(decl.indexOf('filter'), -1, 'filter:blur дорог для WebView — размытие даёт апскейл w92');
});

/* Task 38: раньше здесь проверялось, что lite/off не задают filter — то есть
   что блюр остался только в full. Блюра нет ни в одном режиме, и вместе с ним
   ушло правило lite/off: оно гасило один лишь transform, а после снятия
   фильтра гасить стало нечего. Тест поэтому зеркален героевскому — под
   .lumen-bg--blur не должно остаться ни одного правила вне lumen-motion-full. */
test('buildCss: .lumen-bg--blur — вне lumen-motion-full правил нет вовсе', () => {
  /* Два правила без класса режима исключены намеренно: они не про движение, а
     про сам вид фона в любом режиме — диагональный градиент подложки и
     кадрирование с затемнением самого постера (opacity:.8). */
  const offenders = ruleSelectors(css).filter((sel) => sel.indexOf('lumen-bg--blur') !== -1 &&
    sel.indexOf('lumen-motion-full') === -1 && sel !== '.lumen-backdrop.lumen-bg--blur' &&
    sel !== '.lumen-backdrop.lumen-bg--blur .lumen-backdrop__img');
  assert.deepEqual(offenders, [],
    'блюра нет ни в одном режиме — размытие даёт апскейл w92; правилам режима под .lumen-bg--blur гасить нечего');
});

/* -------------------------------------------------------------------- */
/* Task 6: слайдшоу кадров — .lumen-bg__img/.is-active (кроссфейд) и      */
/* наезд Ken Burns (Task 4) поверх них, теперь на верном корне            */
/* .lumen-backdrop (слой фона — сосед .lumen-card, не потомок).           */
/* -------------------------------------------------------------------- */

test('buildCss: .lumen-bg__img — базовое правило внутри .lumen-backdrop, без перехода и без inset', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__img');
  assert.ok(decl, 'правило .lumen-backdrop .lumen-bg__img не найдено');
  assert.ok(/opacity\s*:\s*0\b/.test(decl), 'кадр должен быть по умолчанию прозрачным');
  /* Проверка на ТВ 2026-09-24: кадры карточки меняются и в lite, но там
     смена резкая — без двух полноэкранных слоёв на время перехода. */
  assert.equal(/transition/.test(decl), false, 'базовое правило без перехода: ' + decl);
  assert.equal(/inset\s*:/.test(decl), false);
});

test('ТВ 09-24: кроссфейд кадров карточки — только в full при тяжёлых эффектах, в lite смена резкая', () => {
  const heavy = findDecl(css, (sel) => sel === 'body.lumen-fx-heavy .lumen-backdrop.lumen-motion-full .lumen-bg__img');
  assert.ok(heavy, 'правило кроссфейда под body.lumen-fx-heavy не найдено');
  assert.ok(heavy.indexOf('transition:opacity 1.2s ease-in-out') !== -1, 'ожидался transition:opacity 1.2s ease-in-out (design screen 12): ' + heavy);
  /* Любое правило, дающее кадру переход, обязано требовать и тумблер, и
     полный режим: в lite (класс lumen-motion-lite на слое, lumen-fx-heavy
     на body в lite не бывает — LC.fxHeavy) перехода нет. */
  const offenders = ruleBodies(css).filter((r) => /transition/.test(r.decl) &&
    r.selectors.some((s) => s.indexOf('lumen-bg__img') !== -1 &&
      !(s.indexOf('body.lumen-fx-heavy ') === 0 && s.indexOf('.lumen-motion-full') !== -1)));
  assert.deepEqual(offenders, [], 'переход кадра без тумблера/полного режима');
});

test('buildCss: .lumen-bg__img.is-active — opacity:1', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__img.is-active');
  assert.ok(decl, 'правило .lumen-backdrop .lumen-bg__img.is-active не найдено');
  assert.ok(/opacity\s*:\s*1\b/.test(decl));
});

/* -------------------------------------------------------------------- */
/* Task 5c: сериал — статус в ленте, чип следующей серии, ряд серий.     */
/* -------------------------------------------------------------------- */

test('buildCss: штатный tag--episode скрыт, вместо него .lumen-next-chip с иконкой часов маской', () => {
  const tag = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__rate-line .tag--episode');
  assert.ok(tag && /display\s*:\s*none\s*!important/.test(tag), 'tag--episode должен быть скрыт');
  const chip = findDecl(css, (sel) => sel === '.lumen-card .lumen-next-chip');
  assert.ok(chip, 'правило .lumen-next-chip не найдено');
  assert.ok(chip.indexOf('font-size:1.01em') !== -1, 'Task 63: текст чипа — минимум tvOS, 23 px = 1.01em');
  const icon = findDecl(css, (sel) => sel === '.lumen-card .lumen-next-chip:before');
  assert.ok(icon && icon.indexOf('mask-image') !== -1, 'иконка часов — маской');
});

test('buildCss: у сериала статус — карта в ленте рейтингов', () => {
  const status = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status');
  assert.ok(status, 'правило статуса в ленте для .lumen-card--serial не найдено');
  assert.ok(status.indexOf('display:flex') !== -1, 'у сериала статус виден');
  /* Правка 2026-09-23 (разбор композиции, п.2.3): чип статуса приведён к
     той же схеме и той же геометрии, что рейтинг и реакции — иначе ряд
     чипов «выглядит несобранным». Сторож сверяет их прямо между собой. */
  const rate = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate');
  for (const prop of ['border-radius', 'padding', 'background']) {
    const one = new RegExp('(?:^|;)' + prop + ':([^;]+)');
    assert.equal(one.exec(status)[1], one.exec(rate)[1], prop + ' у статуса и рейтинга разный');
  }
  assert.ok(/flex-direction:column/.test(status), 'статус остался одноуровневым: ' + status);
  const value = findDecl(css, (sel) => sel === '.lumen-card .lumen-status__value');
  const rateValue = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate > div:first-child');
  assert.equal(/font-size:([\d.]+em)/.exec(value)[1], /font-size:([\d.]+em)/.exec(rateValue)[1], 'ведущее значение статуса другого кегля');
  const label = findDecl(css, (sel) => sel === '.lumen-card .lumen-status__label');
  const rateLabel = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate > div:last-child');
  assert.equal(/font-size:([\d.]+em)/.exec(label)[1], /font-size:([\d.]+em)/.exec(rateLabel)[1], 'подпись статуса другого кегля');
  /* Пустая подпись (сериал без следующей серии) не имеет права добавлять
     чипу высоту. */
  const empty = findDecl(css, (sel) => sel === '.lumen-card .lumen-status__label:empty');
  assert.ok(empty && /display:none/.test(empty), 'пустая подпись статуса не скрыта');
});

/* -------------------------------------------------------------------- */
/* Правка 2026-09-16, п.1: боковой колонки нет.                          */
/* -------------------------------------------------------------------- */

test('правка 2026-09-16 (п.1): ни одного правила .lumen-side / .lumen-cast не осталось', () => {
  assert.equal(css.indexOf('lumen-side'), -1, 'боковая колонка убрана вместе со всеми своими правилами');
  assert.equal(css.indexOf('lumen-cast'), -1, 'блок «В ролях» убран вместе со всеми своими правилами');
});

test('правка 2026-09-16 (п.1): .lumen-content — одна колонка, без grid и без фолбэка @supports', () => {
  const content = findDecl(css, (sel) => sel === '.lumen-card .lumen-content');
  assert.ok(content, 'правило .lumen-content не найдено');
  assert.equal(/display\s*:\s*(-ms-)?grid/.test(content), false, 'вторая колонка исчезла — сетка больше не нужна');
  assert.equal(/column-gap/.test(content), false, 'зазор между колонками больше не нужен');
  const inBlock = findDecl(css, (sel) => sel === '.lumen-card .lumen-content > .lumen-in');
  assert.ok(inBlock && inBlock.indexOf('max-width:52em') !== -1, 'ширина главной колонки сохранена');
  assert.equal(/grid-column/.test(inBlock), false, 'привязки к колонке сетки не осталось');
});

test('правка 2026-09-16 (п.1): у фильма статус в ленте скрыт, у сериала — показан', () => {
  const rules = ruleBodies(css);
  const hide = rules.find((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__rate-line .full-start__status'));
  assert.ok(hide && /display\s*:\s*none/.test(hide.decl), 'базовое правило обязано гасить статус (у фильма «Выпущенный» бесполезен)');

  const hideAt = rules.indexOf(hide);
  const showAt = rules.findIndex((r) => r.selectors.some((s) => s === '.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status'));
  assert.ok(showAt > hideAt, 'правило сериала объявлено позже — иначе одинаковый вес решил бы порядок не в его пользу');
});

test('правка 2026-09-16 (п.1): чипы качества — в ленте рейтингов, прижаты влево', () => {
  const tags = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__rate-line .lumen-tags');
  assert.ok(tags, 'правило держателя чипов в ленте не найдено');
  assert.equal(/justify-content\s*:\s*flex-end/.test(tags), false, 'в ленте чипы идут слева направо, а не к правому краю');
  assert.ok(tags.indexOf('align-items:center') !== -1, 'лента тянет детей по высоте — чипы центрируются');
  const chip = findDecl(css, (sel) => sel === '.lumen-card .lumen-quality-chip');
  assert.ok(chip, 'правило чипа качества не найдено');
  assert.ok(chip.indexOf('margin:0 .23em .23em 0') !== -1, 'зазор чипа — справа, а не слева (8 px в кегле 1.01em после Task 63)');
});

test('buildCss: карточка серии 14.9em×8.38em (кадр 16:9), flex без grid, дорожка absolute', () => {
  const card = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  assert.ok(card, 'правило .lumen-episode не найдено');
  assert.ok(card.indexOf('width:14.9em') !== -1 && card.indexOf('height:8.38em') !== -1);
  assert.ok(card.indexOf('display:flex') !== -1);
  const track = findDecl(css, (sel) => sel === '.lumen-card .lumen-episodes__track');
  assert.ok(track && track.indexOf('position:absolute') !== -1, 'дорожка должна быть absolute (не раздувает колонку)');
  const rules = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('lumen-episode') !== -1));
  assert.ok(rules.length > 10);
  assert.equal(rules.filter((r) => /display\s*:\s*(-ms-)?grid/.test(r.decl)).length, 0, 'у ряда серий нет grid');
});

/* Правка 2026-09-23 (разбор композиции, п.3.1): плитка серии — это КАДР, и
   его пропорция считается из ширины, а не пишется на глаз. Сторож меряет
   обе стороны прямо в таблице: разъедется любая — сойдётся или не сойдётся
   отношение. Допуск полпроцента — плата за округление высоты до сотых
   (14.9 ÷ (16/9) = 8.3812…). */
test('правка 2026-09-23: кадр серии — 16:9, и в обоих видах один', () => {
  const num = (decl, prop) => {
    const m = new RegExp('(?:^|;)' + prop + ':([0-9.]+)em').exec(decl);
    assert.ok(m, 'в правиле нет «' + prop + '»: ' + decl);
    return parseFloat(m[1]);
  };
  const tile = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  const ratio = num(tile, 'width') / num(tile, 'height');
  assert.ok(Math.abs(ratio - 16 / 9) < 16 / 9 * 0.005, 'плитка серии не 16:9: ' + ratio.toFixed(3));
  /* Дорожка ряда растянута по высоте viewport (height:100%) — их высоты
     обязаны совпадать, иначе плитки вылезут за него. */
  assert.equal(num(findDecl(css, (sel) => sel === '.lumen-card .lumen-episodes__viewport'), 'height'), num(tile, 'height'));
  /* Кадр занимает плитку целиком и не приглушён: на opacity .28 он был
     фактурой под текстом, а не кадром. */
  const still = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__still');
  assert.ok(/top:0/.test(still) && /right:0/.test(still) && /bottom:0/.test(still) && /left:0/.test(still), 'кадр не во всю плитку: ' + still);
  assert.ok(/(^|;)opacity:1/.test(still), 'кадр остался приглушённым: ' + still);
  /* Плоский вид больше не разводит кадр и подпись по вертикали: у него нет
     ни своей высоты плитки, ни своей высоты кадра. */
  for (const sel of ['.lumen-card .lumen-episode', '.lumen-card .lumen-episodes__viewport', '.lumen-card .lumen-episode__still', '.lumen-card .lumen-episode__top']) {
    const own = ruleBodies(flatCss).filter((r) => r.selectors.some((s) => s === sel)).slice(1);
    for (const r of own) assert.ok(!/(^|;)height:/.test(r.decl), 'плоский вид задаёт свою высоту у «' + sel + '»: ' + r.decl);
  }
});

/* Правило кромки (разбор композиции, п.6): плитку, которую режет правая
   кромка экрана, кромка имеет право резать как ИЗОБРАЖЕНИЕ — но ни одной
   буквы в ней остаться не должно. Класс ставит LC.header (markClipped), а
   таблица прячет весь текст и снимает затемнения: без текста они темнили бы
   кадр ни за чем. */
test('правка 2026-09-23: срезанная кромкой плитка серии показывает только кадр', () => {
  const bands = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode--cut .lumen-episode__top' || sel === '.lumen-card .lumen-episode--cut .lumen-episode__bottom');
  assert.ok(bands && /background:none/.test(bands), 'у срезанной плитки остались затемнения: ' + bands);
  const kids = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode--cut .lumen-episode__top > *' || sel === '.lumen-card .lumen-episode--cut .lumen-episode__bottom > *');
  assert.ok(kids && /display:none/.test(kids), 'текст срезанной плитки не скрыт: ' + kids);
  /* Правило обязано стоять ПОСЛЕ правил самих строк: у .__top/.__bottom
     затемнения объявлены шорткатом background, и порядком они снимаются. */
  const top = css.indexOf('.lumen-card .lumen-episode__top{');
  const bottom = css.indexOf('.lumen-card .lumen-episode__bottom{');
  const own = css.indexOf('.lumen-card .lumen-episode--cut .lumen-episode__top');
  assert.ok(own > top && own > bottom, 'правило срезанной плитки идёт раньше правил строк');
  /* Сам кадр не трогается: срезанная плитка — это именно кадр. */
  for (const r of ruleBodies(css)) {
    for (const sel of r.selectors) {
      if (sel.indexOf('--cut') === -1) continue;
      assert.equal(sel.indexOf('__still'), -1, 'правило срезанной плитки трогает кадр: ' + sel);
    }
  }
});

/* Подпись и номер лежат ПОВЕРХ кадра, и их полосы затемнения не имеют
   права сойтись: между ними обязан остаться виден сам кадр. Сторож считает
   высоты полос из таблицы — так же, как прежний сторож Task 73 считал
   высоту подписи под кадром. */
test('правка 2026-09-23: затемнения верхней строки и подписи не съедают кадр целиком', () => {
  const num = (decl, prop, fallback) => {
    const m = new RegExp('(?:^|;)' + prop + ':([0-9.]+)em').exec(decl);
    if (!m && fallback !== undefined) return fallback;
    assert.ok(m, 'в правиле нет «' + prop + '»: ' + decl);
    return parseFloat(m[1]);
  };
  const pad = (decl) => {
    const m = /(?:^|;)padding:([0-9.]+)em [0-9.]+em(?: ([0-9.]+)em)?/.exec(decl);
    assert.ok(m, 'в правиле нет паддинга: ' + decl);
    return parseFloat(m[1]) + parseFloat(m[2] === undefined ? m[1] : m[2]);
  };
  const tile = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  const height = num(tile, 'height') - num(tile, 'border') * 2;

  const top = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__top');
  const topBand = pad(top) + num(top, 'min-height');

  const bottom = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__bottom');
  const nameDecl = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__name');
  const name = num(nameDecl, 'font-size') * parseFloat(/line-height:([0-9.]+)/.exec(nameDecl)[1]);
  const capDecl = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__caption');
  const caption = num(capDecl, 'margin-top') + num(capDecl, 'font-size') * parseFloat(/line-height:([0-9.]+)/.exec(capDecl)[1]);
  const barDecl = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__bar');
  const bar = num(barDecl, 'margin-top') + num(barDecl, 'height');
  const bottomBand = pad(bottom) + name + caption + bar;

  assert.ok(topBand + bottomBand < height, 'затемнения сошлись: ' + (topBand + bottomBand).toFixed(3) + 'em при высоте ' + height.toFixed(3) + 'em');
  /* И не впритык: полоса чистого кадра меньше строки подписи означала бы,
     что кадр виден формально. */
  assert.ok(height - topBand - bottomBand > name, 'чистого кадра осталось меньше строки: ' + (height - topBand - bottomBand).toFixed(3) + 'em');
  /* Оба затемнения — линейные градиенты с префиксной парой, без blur. */
  for (const decl of [top, bottom]) {
    assert.ok(/(^|;)background:-webkit-linear-gradient\(/.test(decl) && /;background:linear-gradient\(/.test(decl), 'затемнение не линейным градиентом или без префиксной пары: ' + decl);
    assert.ok(!/blur/.test(decl), 'в затемнении размытие: ' + decl);
  }
});

test('buildCss: все четыре состояния серии и фокус со scale 1.03 оформлены', () => {
  for (const state of ['watched', 'watching', 'soon']) {
    assert.ok(findDecl(css, (sel) => sel === '.lumen-card .lumen-episode--' + state), 'нет правила состояния ' + state);
  }
  const focus = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode.focus');
  assert.ok(focus && focus.indexOf('scale(1.03)') !== -1);
  /* Правка 2026-09-23 (п.3.1): паддинга у плитки больше нет — кадр обязан
     касаться краёв, отступы текста живут в .__top/.__bottom. Рамка осталась
     признаком фокуса: .04 -> .13em. */
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  assert.ok(base.indexOf('padding:') === -1, 'у плитки снова появился паддинг — кадр не дойдёт до краёв: ' + base);
  assert.ok(base.indexOf('border:.04em') !== -1);
  assert.ok(focus.indexOf('padding:') === -1 && focus.indexOf('border:.13em') !== -1);
});

test('buildCss: переходы ряда серий — только в lumen-motion-full, в lite/off фокус без transform', () => {
  const withTransition = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('lumen-episode') !== -1) && /transition\s*:/.test(r.decl));
  assert.ok(withTransition.length >= 2, 'ожидались переходы карточки и дорожки');
  // ревью п.10: фон карточки — градиент, background-color на нём не анимируется
  for (const r of withTransition) assert.equal(r.decl.indexOf('background-color'), -1, 'лишний transition background-color: ' + r.selectors.join(','));
  for (const r of withTransition) {
    assert.ok(r.selectors.every((s) => s.indexOf('lumen-motion-full') !== -1), 'transition вне lumen-motion-full: ' + r.selectors.join(','));
  }
  const lite = findDecl(css, (sel) => sel.indexOf('lumen-motion-lite') !== -1 && sel.indexOf('.lumen-episode.focus') !== -1);
  const off = findDecl(css, (sel) => sel.indexOf('lumen-motion-off') !== -1 && sel.indexOf('.lumen-episode.focus') !== -1);
  assert.ok(lite && /transform\s*:\s*none/.test(lite));
  assert.ok(off && /transform\s*:\s*none/.test(off));
});

test('buildCss: без CSS-масок иконки чипа и карточки серии скрыты', () => {
  const line = css.split('\n').find((l) => l.indexOf('@supports not ((-webkit-mask-image:none)') === 0 && l.indexOf('lumen-episode__check') !== -1);
  assert.ok(line, 'фолбэк без масок для ряда серий не найден');
  assert.ok(line.indexOf('.lumen-next-chip:before') !== -1);
});

/* -------------------------------------------------------------------- */
/* Task 5d: таблица «ПОДРОБНО» и оформление описания в ряду (design-spec  */
/* §10, экран 07). Корень — .lumen-descr-row: ряд описания лежит вне      */
/* .lumen-card, класс на его узел вешает LC.header.descr.                 */
/* -------------------------------------------------------------------- */

test('buildCss: .lumen-facts — сетка «лейбл/значение» auto 1fr с flex-фолбэком (grid не поддержан на webOS 3)', () => {
  const grid = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__grid');
  assert.ok(grid, 'правило сетки .lumen-facts__grid не найдено');
  assert.ok(grid.indexOf('display:flex') !== -1, 'нет flex-фолбэка перед display:grid');
  assert.ok(grid.indexOf('display:grid') !== -1, 'нет display:grid');
  assert.ok(grid.indexOf('grid-template-columns:auto 1fr') !== -1, '§10: grid-template-columns:auto 1fr');
});

/* Правка пользователя 2026-09-16 (отступление от §10, зафиксировано в
   docs/design/design-spec-card.md): ряд описания лежит поверх кадра, и на
   светлом бэкдропе подписи цветом smoke не читались (2.06:1 к пикселю кадра).
   Подписи подняты до muted, кегль — до 20px, у блока своя подложка. */
test('правка 2026-09-16: лейбл и значение таблицы — не мельче 20px (.88em), лейбл muted, значение 500 и text', () => {
  const label = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__label');
  const value = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__value');
  assert.ok(label && value, 'правила лейбла/значения не найдены');

  const size = (decl) => parseFloat(/font-size:([\d.]+)em/.exec(decl)[1]);
  assert.ok(size(label) >= 0.877, 'лейбл не мельче 20px (.877em), сейчас ' + size(label) + 'em');
  assert.ok(size(value) >= 0.877, 'значение не мельче 20px (.877em), сейчас ' + size(value) + 'em');

  assert.ok(label.indexOf('#7A6A5A') === -1, 'лейбл больше не smoke — на светлом кадре не читался');
  assert.ok(label.indexOf('#A89A8A') !== -1, 'лейбл — muted');
  assert.ok(value.indexOf('font-weight:500') !== -1, 'значение — 500');
  assert.ok(value.indexOf('#F3EDE4') !== -1, 'значение — text');
});

test('правка 2026-09-16: заголовок «ПОДРОБНО» — разрядка, muted, не мельче минимума tvOS', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__title');
  assert.ok(title, 'правило заголовка таблицы не найдено');
  assert.ok(parseFloat(/font-size:([\d.]+)em/.exec(title)[1]) >= 1.01, 'Task 63: заголовок не мельче 23 px = 1.01em');
  /* Разрядка ужата в той же пропорции, в какой вырос кегль (.14 × .79 / 1.01):
     на экране это те же 2.5 физических px между буквами. */
  assert.ok(title.indexOf('letter-spacing:.11em') !== -1);
  assert.ok(title.indexOf('#7A6A5A') === -1, 'заголовок больше не smoke');
  assert.ok(title.indexOf('#A89A8A') !== -1, 'заголовок — muted');
});

test('правка 2026-09-16: у .lumen-facts своя подложка, рамка и радиус', () => {
  const panel = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts');
  assert.ok(panel, 'правило .lumen-facts не найдено');
  assert.ok(/background:rgba\(11,9,8,\.85\)/.test(panel), 'нет собственной подложки блока: ' + panel);
  assert.ok(panel.indexOf('border:.04em solid #2C231D') !== -1, 'нет тонкой рамки line');
  assert.ok(panel.indexOf('border-radius:.61em') !== -1, 'радиус как у соседних блоков');
  assert.ok(/(^|;)padding:/.test(panel), 'нет внутренних отступов — текст упрётся в рамку');
  assert.ok(panel.indexOf('box-sizing:border-box') !== -1, 'паддинг не должен раздувать min-width 450px');
  /* Блюр на ТВ дорог — подложка строго плоская. */
  assert.ok(panel.indexOf('backdrop-filter') === -1, 'backdrop-filter запрещён (дорог для ТВ)');
});

/* -------------------------------------------------------------------- */
/* Правка 2026-09-16, п.3: «полоса» под рядом описания.                  */
/*                                                                       */
/* Сплошная вуаль по всей ширине ряда читалась на тёмном кадре как лишняя */
/* горизонтальная полоса поперёк экрана (верхняя кромка + градиент на     */
/* первом em). Вместо неё — локальные подложки СТРОГО по границам своих   */
/* блоков: у самого ряда фона нет вовсе, поэтому и границы поперёк экрана */
/* взяться неоткуда, а над светлым кадром каждый текстовый блок лежит на  */
/* своей плотной карте.                                                   */
/* -------------------------------------------------------------------- */

test('правка 2026-09-16 (п.3): у ряда описания нет собственного фона — полосе взяться неоткуда', () => {
  const row = findDecl(css, (sel) => sel === '.lumen-descr-row');
  assert.equal(row, null, 'у .lumen-descr-row не должно быть правила с фоном: ' + row);
  const anyRowBg = ruleBodies(css).filter((r) => r.selectors.some((s) => s === '.lumen-descr-row') && /background/.test(r.decl));
  assert.equal(anyRowBg.length, 0, 'ни одно правило не красит ряд целиком');
});

test('правка 2026-09-16 (п.3): подложка описания — по границам текста, плоская, того же цвета, что страница', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(text, 'правило .full-descr__text не найдено');
  assert.ok(/background:rgba\(11,9,8,\.85\)/.test(text), 'у текста описания должна быть своя подложка цвета страницы');
  /* Радиус считается в em СОБСТВЕННОГО кегля узла (1.05em базового), поэтому
     число другое, а размер тот же ~14px, что у .lumen-facts. */
  assert.ok(text.indexOf('border-radius:.48em') !== -1, 'радиус как у таблицы «ПОДРОБНО» (.48em в кегле 1.27em после Task 63)');
  assert.ok(/(^|;)padding:/.test(text), 'без внутренних отступов текст упрётся в край подложки');
  assert.ok(text.indexOf('box-sizing:border-box') !== -1, 'паддинг не должен раздувать колонку описания');
  assert.equal(/linear-gradient/.test(text), false, 'никаких градиентных кромок — именно они читались полосой');
  assert.ok(text.indexOf('backdrop-filter') === -1, 'backdrop-filter запрещён (дорог для ТВ)');
});

test('правка 2026-09-16 (п.3): заголовок ряда отзывов — своя подложка по содержимому, а не во всю ширину', () => {
  const head = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__head');
  assert.ok(head, 'правило .lumen-reviews__head не найдено');
  assert.ok(/background:rgba\(11,9,8,\.85\)/.test(head), 'заголовок ряда отзывов лежит поверх кадра — ему нужна своя подложка');
  assert.ok(head.indexOf('display:inline-flex') !== -1, 'подложка обязана обтягивать содержимое, а не тянуться на всю ширину');
});

/* -------------------------------------------------------------------- */
/* Правка 2026-09-16, пп. 4-5: таблица «ПОДРОБНО» и отступ ряда.          */
/* -------------------------------------------------------------------- */

test('правка 2026-09-16 (п.5): боковой отступ ряда описания равен отступу шапки', () => {
  const card = findDecl(css, (sel) => sel === '.full-start-new.lumen-card');
  assert.ok(card && card.indexOf('padding:0 3.51em 2.63em') !== -1, 'Task 63: safe area шапки — 80 px по бокам (3.51em) и 60 снизу (2.63em)');
  const descr = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr');
  assert.ok(descr, 'правило .full-descr не найдено');
  assert.ok(descr.indexOf('padding-left:3.51em') !== -1, 'левый край ряда не совпадает с шапкой');
  assert.ok(descr.indexOf('padding-right:3.51em') !== -1, 'правый край ряда не совпадает с шапкой');
});

test('правка 2026-09-16 (п.4): колонка описания 980px, таблица занимает остаток справа, верх — по одной линии', () => {
  const wrap = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr');
  assert.ok(/align-items\s*:\s*flex-start/.test(wrap), 'верх таблицы и верх описания — на одной линии');

  const left = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__left');
  assert.ok(left, 'правило .full-descr__left не найдено');
  assert.ok(left.indexOf('flex:1 1 42.96em') !== -1, '§10: колонка описания 980px = 42.96em');
  assert.ok(left.indexOf('max-width:42.96em') !== -1, 'колонка описания не должна разрастаться шире 980px');
  assert.ok(left.indexOf('margin-right:3.51em') !== -1, '§10: зазор до таблицы 80px = 3.51em');

  const panel = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts');
  assert.ok(panel.indexOf('flex:1 1 19.73em') !== -1, 'таблица добирает остаток строки, не оставляя пустоты справа');
  assert.ok(panel.indexOf('min-width:19.73em') !== -1, '§10: панель не уже 450px = 19.73em');
  assert.equal(/flex-shrink\s*:\s*0/.test(panel), false, 'на узком экране таблица обязана сжиматься, а не выталкивать описание');
});

/* Ревью (п.2): соседи таблицы в том же ряду лежат на той же вуали поверх
   кадра — заголовок ряда отзывов страдал ровно тем же, чем подписи таблицы. */
/* Правка 2026-09-23 (разбор композиции, п.4.4): пунктирная рамка плитки
   «добавить комментарий» — единственная пунктирная линия во всём
   интерфейсе, и при самой низкой важности она тянула взгляд сильнее
   карточек серий и портретов. Узел штатный (Lampa, .full-review-add,
   app.css:4856-4867), поэтому правка чисто в нашей таблице: сплошная
   подложка и та же линия, что у карточки отзыва рядом. */
test('правка 2026-09-23: плитка «добавить комментарий» — того же вида, что карточки рядом', () => {
  const P = tokensWith({});
  const add = findDecl(css, (sel) => sel === '.lumen-card .full-review-add');
  assert.ok(add, 'правила плитки нет — пунктир Lampa остался единственной пунктирной линией интерфейса');
  assert.equal(/dashed/.test(add), false, 'пунктир вернулся: ' + add);
  assert.ok(add.indexOf('border:.04em solid ' + P.line) !== -1, 'линия не та же, что у карточки отзыва: ' + add);
  assert.ok(add.indexOf('background:' + P.panel) !== -1, 'подложка не сплошная: ' + add);
  const review = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review');
  const radius = (decl) => /border-radius:([\d.]+em)/.exec(decl)[1];
  assert.equal(radius(add), radius(review), 'скругление разошлось с карточкой отзыва');
  /* Кольцо фокуса у Lampa нарисовано на ::after — наше правило его не
     трогает, иначе фокус на плитке пропал бы вовсе. */
  assert.equal(/:after|::after/.test(add), false, 'правило залезло в псевдоэлемент кольца фокуса: ' + add);
});

test('ревью п.2: подписи блока отзывов не smoke; счётчик отзывов не мельче 20px', () => {
  const total = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__total');
  assert.ok(total, 'правило .lumen-reviews__total не найдено');
  assert.ok(total.indexOf('#7A6A5A') === -1, 'счётчик отзывов больше не smoke');
  assert.ok(total.indexOf('#A89A8A') !== -1, 'счётчик отзывов — muted');
  assert.ok(parseFloat(/font-size:([\d.]+)em/.exec(total)[1]) >= 0.877, 'счётчик отзывов не мельче 20px');

  const ico = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__ico');
  assert.ok(ico.indexOf('background-color:#A89A8A') !== -1, 'иконка ряда отзывов — muted');

  /* Мета отзыва и модала лежат на своих непрозрачных фонах, и правка
     2026-09-16 поднимала там только цвет. Task 63 поднял и кегль — до
     минимума tvOS, — а высоту карточки пересчитал под новое содержимое
     (13.3em, замер пробником на стенде). Здесь проверяется цвет. */
  for (const sel of ['.lumen-descr-row .lumen-review__meta', '.lumen-review-modal__meta', '.lumen-review-modal__src']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf('#7A6A5A') === -1, sel + ' — больше не smoke');
    assert.ok(decl.indexOf('#A89A8A') !== -1, sel + ' — muted');
  }
});

test('buildCss: полное описание в ряду — Body tvOS 29px/1.24 (1.27em), колонка 980px, таблица справа', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(text, 'правило .full-descr__text не найдено');
  assert.ok(text.indexOf('font-size:1.27em') !== -1, 'Task 63: описание — Body tvOS, 29 px = 1.27em');
  assert.ok(text.indexOf('line-height:1.24') !== -1, 'Task 63: межстрочный Body tvOS — 36/29 = 1.24');
  /* Колонка те же 980 px, но em здесь СОБСТВЕННОГО кегля узла: 42.96 × 1.05
     базовых при прежнем кегле и 35.56 × 1.27 при нынешнем — 45.1 базовых в
     обоих случаях. */
  assert.ok(text.indexOf('max-width:35.56em') !== -1, 'колонка описания 980px в кегле 1.27em = 35.56em');

  const wrap = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr');
  assert.ok(wrap && wrap.indexOf('display:flex') !== -1, 'ряд описания — flex (описание слева, таблица справа)');
});

/* Ревью Task 5d (Important 1): маска снимается совсем, а предел высоты
   поднимается до 70vh, но НЕ до none — иначе на очень длинном overview ряд
   перерастает вьюпорт, а Lampa внутри ряда не прокручивает (проверено живьём:
   теги уезжают за нижний край и остаются недостижимыми). */
test('buildCss: описание без выцветания, с мягким пределом высоты вместо штатного 41vh', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(decl, 'правило .full-descr__text не найдено');
  assert.ok(/max-height\s*:\s*70vh/.test(decl), 'ожидался мягкий предел 70vh');
  assert.equal(/max-height\s*:\s*none/.test(decl), false, 'без предела теги под текстом становятся недостижимыми');
  assert.ok(decl.indexOf('-webkit-mask-image:none') !== -1, 'нужна префиксная запись — на движках ТВ работает именно она');
  assert.ok(/[^-]mask-image\s*:\s*none/.test(decl), 'нужна и беспрефиксная mask-image:none');
});

test('buildCss: штатный заголовок ряда «Подробно» скрыт дочерним комбинатором (__head, не __title)', () => {
  const head = findDecl(css, (sel) => sel === '.lumen-descr-row > .items-line__head');
  assert.ok(head && /display\s*:\s*none/.test(head), 'нет правила скрытия .lumen-descr-row > .items-line__head');
  assert.equal(findDecl(css, (sel) => sel === '.lumen-descr-row .items-line__head'), null,
    'потомковый селектор задел бы вложенный items_line будущего блока отзывов (Task 9)');
  /* Фаза 3 добавила кегль заголовка ряда на главной (.lumen-main
     .items-line__title) — здесь речь про ряд описания в карточке: у него
     __title не скрывают, иначе от __head осталась бы пустая полоса. */
  assert.equal(findDecl(css, (sel) => sel.indexOf('.items-line__title') !== -1 && sel.indexOf('.lumen-descr-row') !== -1), null,
    'скрывать __title нельзя — у __head остаются свои отступы, получилась бы пустая полоса');
});

/* Ревью Task 5d (M2): после снятия display:-ms-grid раскладка на движках без
   grid держится ровно на порядке деклараций — display:flex должен идти ДО
   display:grid в том же правиле (последнее валидное значение выигрывает). */
test('buildCss: у сетки таблицы display:flex объявлен раньше display:grid', () => {
  for (const sel of ['.lumen-descr-row .lumen-facts__grid']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    const flex = decl.indexOf('display:flex');
    const grid = decl.indexOf('display:grid');
    assert.ok(flex !== -1, 'нет flex-фолбэка: ' + sel);
    assert.ok(grid !== -1, 'нет display:grid: ' + sel);
    assert.ok(flex < grid, 'flex должен объявляться до grid: ' + sel);
  }
});

test('buildCss: у сетки таблицы есть старые grid-row-gap/grid-column-gap (Chrome 57-65: webOS 4, Tizen 3/4)', () => {
  const grid = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__grid');
  assert.ok(grid, 'правило сетки не найдено');
  /* Значения ритма — предмет вкусовых правок (правка 2026-09-16 сжала row-gap
     под больший кегль), поэтому тест проверяет ПРИНЦИП: у каждой современной
     записи есть старая с тем же значением, иначе на Chrome 57-65 таблица
     поедет вплотную. */
  const rowGap = /(^|;)row-gap:([\d.]+em)/.exec(grid);
  const colGap = /(^|;)column-gap:([\d.]+em)/.exec(grid);
  assert.ok(rowGap && colGap, 'нет современных row-gap/column-gap');
  assert.ok(grid.indexOf('grid-row-gap:' + rowGap[2]) !== -1, 'нет старого grid-row-gap со значением ' + rowGap[2]);
  assert.ok(grid.indexOf('grid-column-gap:' + colGap[2]) !== -1, 'нет старого grid-column-gap со значением ' + colGap[2]);
  assert.equal(grid.indexOf('-webkit-column-gap'), -1, '-webkit-column-gap — это multicol, в grid не работает');
});

/* Ревью Task 5d (Minor 2): display:-ms-grid включает старую реализацию грида
   (IE/Edge <= 15), и без явных -ms-grid-columns все ячейки ложатся в клетку
   1x1 внахлёст — хуже, чем честный flex-фолбэк. Либо дорожки заданы, либо
   -ms-grid не объявляется вовсе. */
test('buildCss: нет display:-ms-grid без -ms-grid-columns', () => {
  const offenders = ruleBodies(css)
    .filter((r) => /display\s*:\s*-ms-grid/.test(r.decl) && !/-ms-grid-columns/.test(r.decl))
    .map((r) => r.selectors.join(','));
  assert.deepEqual(offenders, []);
});

/* -------------------------------------------------------------------- */
/* Task 9: ряд отзывов Кинопоиска (экран 07), подсказка без ключа (экран  */
/* 13, панель 2) и модал отзыва (экран 08). Корень ряда — .lumen-descr-row */
/* (блок лежит в том же .full-descr, что и таблица «ПОДРОБНО»), корень     */
/* модала — собственный .lumen-review-modal: окно Lampa живёт вне ряда.    */
/* -------------------------------------------------------------------- */

test('buildCss: блок отзывов занимает всю ширину ряда описания (flex-basis:100%, .full-descr — flex с wrap)', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews');
  assert.ok(decl, 'правило .lumen-reviews не найдено');
  assert.ok(decl.indexOf('width:100%') !== -1);
  assert.ok(decl.indexOf('flex-basis:100%') !== -1, 'иначе блок встал бы третьей колонкой рядом с таблицей');
});

/* Замер живьём: ряд описания въезжает в экран прокруткой ленты рядов, но
   ВНУТРИ ряда Lampa не прокручивает (Task 5d). С рядом отзывов описание должно
   быть поджато, иначе карточки получают .focus ниже нижнего края экрана. */
/* Ревью Task 9: обрезка по строкам, а не по пикселям — max-height резал
   последнюю строку пополам и без многоточия (Task 5d такую обрезку снимал
   намеренно). Маска низа возвращается ТОЛЬКО когда ряд отзывов нарисован. */
test('buildCss: описание клампится девятью строками, а ряд отзывов добавляет мягкую маску низа', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row.lumen-descr-row--reviews .full-descr__text');
  assert.ok(decl, 'правило обрезки описания при отзывах не найдено');
  assert.ok(/mask-image\s*:\s*linear-gradient/.test(decl), 'мягкий низ вместо резаной строки');
  assert.ok(decl.indexOf('-webkit-mask-image') !== -1, 'нужна и префиксная запись — на движках ТВ работает она');

  /* Правка 2026-09-23 (правило кромки): сам кламп переехал в БАЗОВОЕ правило
     описания — кромка резала последнюю строку и в ряду без отзывов тоже
     (замер на стенде 960×540@2: блок 339.2…572.6 при кромке 540). Здесь
     осталась только мягкая маска низа. */
  const base = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(base.indexOf('-webkit-line-clamp:9') !== -1, 'ожидался кламп на 9 строк у всякого описания');
  assert.ok(base.indexOf('display:-webkit-box') !== -1 && base.indexOf('-webkit-box-orient:vertical') !== -1, 'без этих двух свойств кламп не работает');
  assert.ok(/max-height\s*:\s*70vh/.test(base), 'базовый предел Task 5d не тронут');
  assert.ok(base.indexOf('-webkit-mask-image:none') !== -1, 'без отзывов описание по-прежнему не выцветает');
  assert.equal(decl.indexOf('-webkit-line-clamp'), -1, 'кламп не должен дублироваться в ветке с отзывами');
  /* Правка 2026-09-23: нижний отступ плашки — прозрачная РАМКА, а не
     padding-bottom. overflow:hidden режет по padding-box, и в нижний паддинг
     просачивалась строка, следующая за клампом (замер: 8.9 px читаемого
     текста под многоточием). Рамка лежит снаружи padding-box, и обрезка
     проходит ровно по последней строке. */
  assert.ok(/border-bottom:\.62em solid transparent/.test(base), 'нижний отступ описания обязан быть рамкой: ' + base);
  assert.ok(/padding:\.62em \.83em 0/.test(base), 'padding-bottom обязан быть нулевым — иначе в него просочится строка: ' + base);
});

test('buildCss: карточка отзыва 480 px шириной (21.04em), flex, не сжимается', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review');
  assert.ok(decl, 'правило .lumen-review не найдено');
  assert.ok(decl.indexOf('width:21.04em') !== -1, 'ширина 480px = 21.04em');
  /* Фикс-раунд Task 63: высота считается по содержимому, а не по макету
     экрана 07 — кегли внутри поднялись до минимума tvOS. Замер пробником на
     стенде 960×540@2: естественная высота 13.28em, при прежних 11.4em flex
     сжимал заголовок (1.31 → 0.92em) и текст (5.0 → 3.51em). */
  assert.ok(decl.indexOf('height:13.3em') !== -1, 'высота под содержимое = 13.3em');
  assert.ok(decl.indexOf('flex:none') !== -1, 'карточки в ряду не сжимаются');
  assert.ok(decl.indexOf('border-radius:.61em') !== -1, 'радиус 14px = .61em');
  assert.ok(decl.indexOf('box-sizing:border-box') !== -1, 'рамка в фокусе растёт внутрь — размер карточки не скачет');
});

test('buildCss: тон отзыва — полоса 4px цветами токенов (good / muted / spice), не своими hex', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review__tone');
  assert.ok(base, 'правило полосы тона не найдено');
  assert.ok(base.indexOf('width:.18em') !== -1, 'полоса 4px = .18em');
  assert.ok(base.indexOf('#A89A8A') !== -1, 'нейтральный — muted');
  const good = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review--good .lumen-review__tone');
  const bad = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review--bad .lumen-review__tone');
  assert.ok(good && good.indexOf('#8FBF7A') !== -1, 'позитивный — good');
  assert.ok(bad && bad.indexOf('#D9622B') !== -1, 'негативный — spice');
});

test('buildCss: текст отзыва — ровно 4 строки клампом, минимум tvOS (1.01em) muted', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review__text');
  assert.ok(decl, 'правило текста отзыва не найдено');
  assert.ok(decl.indexOf('-webkit-line-clamp:4') !== -1, 'экран 07: четыре строки');
  assert.ok(decl.indexOf('display:-webkit-box') !== -1 && decl.indexOf('-webkit-box-orient:vertical') !== -1, 'кламп без этих двух свойств не работает');
  assert.ok(decl.indexOf('font-size:1.01em') !== -1, 'Task 63: текст отзыва — 23 px = 1.01em');
  assert.ok(decl.indexOf('#A89A8A') !== -1);
});

test('buildCss: фокус карточки отзыва — рамка accent и scale(1.03); в lite/off scale нет', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review.focus');
  assert.ok(focus, 'правило фокуса карточки отзыва не найдено');
  assert.ok(focus.indexOf('scale(1.03)') !== -1);
  assert.ok(focus.indexOf('border:.13em solid #E8B87A') !== -1, 'рамка акцентом');

  /* Класс режима движения стоит на body (LC.init), а не на ряду: ряд описания
     лежит вне .lumen-card, и правило с корнем карточки сюда не дотянулось бы. */
  const lite = findDecl(css, (sel) => sel === 'body.lumen-motion-lite .lumen-descr-row .lumen-review.focus');
  const off = findDecl(css, (sel) => sel === 'body.lumen-motion-off .lumen-descr-row .lumen-review.focus');
  assert.ok(lite && /transform\s*:\s*none/.test(lite), 'в lite пружины нет');
  assert.ok(off && /transform\s*:\s*none/.test(off), 'в off пружины нет');

  const withTransition = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('.lumen-review') !== -1 && s.indexOf('modal') === -1) && /transition\s*:/.test(r.decl));
  for (const r of withTransition) {
    assert.ok(r.selectors.every((s) => s.indexOf('lumen-motion-full') !== -1), 'переход вне lumen-motion-full: ' + r.selectors.join(','));
  }
});

test('buildCss: заголовок ряда — название 32px (1.40em), «КИНОПОИСК» акцентом 1.01em', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__title');
  assert.ok(title && title.indexOf('font-size:1.40em') !== -1, 'название 32px = 1.40em');
  const src = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__src');
  assert.ok(src, 'правило метки источника не найдено');
  assert.ok(src.indexOf('font-size:1.01em') !== -1 && src.indexOf('letter-spacing:.11em') !== -1);
  assert.ok(src.indexOf('#E8B87A') !== -1, 'метка источника — акцентом (экран 07)');
  const total = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__total');
  /* Цвет и кегль счётчика подняты правкой читаемости 2026-09-16 (заголовок ряда
     лежит на вуали поверх кадра) — детали в тесте «ревью п.2» ниже. */
  assert.ok(total && total.indexOf('#A89A8A') !== -1, '«· 318 отзывов» — muted');
});

test('buildCss: подсказка без ключа (экран 13) — плашка пути на прозрачном акценте', () => {
  const path = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__hint-path');
  assert.ok(path, 'правило плашки пути не найдено');
  assert.ok(path.indexOf('rgba(232,184,122,.1)') !== -1, 'фон — акцент 10 %');
  assert.ok(path.indexOf('rgba(232,184,122,.4)') !== -1, 'рамка — акцент 40 %');
  assert.ok(path.indexOf('font-size:1.01em') !== -1, 'Task 63: текст плашки — 23 px = 1.01em');
  const hint = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__hint');
  assert.ok(hint && hint.indexOf('border-radius:.61em') !== -1);
});

test('buildCss: модал отзыва (экран 08) — свой корень, полоса тона, текст с прокруткой', () => {
  const root = findDecl(css, (sel) => sel === '.lumen-review-modal');
  assert.ok(root, 'правило .lumen-review-modal не найдено');
  assert.ok(root.indexOf('display:flex') !== -1);
  assert.ok(root.indexOf('border-radius:.61em') !== -1);
  const tone = findDecl(css, (sel) => sel === '.lumen-review-modal--bad .lumen-review-modal__tone');
  assert.ok(tone && tone.indexOf('#D9622B') !== -1, 'тон модала — те же токены, что у карточки');
  const text = findDecl(css, (sel) => sel === '.lumen-review-modal__text');
  assert.ok(text, 'правило текста модала не найдено');
  assert.ok(text.indexOf('font-size:1.01em') !== -1, 'Task 63: текст окна — 23 px = 1.01em');
  assert.ok(text.indexOf('overflow:auto') !== -1 && text.indexOf('max-height:50vh') !== -1, 'длинный отзыв прокручивается внутри окна');
  const title = findDecl(css, (sel) => sel === '.lumen-review-modal__title');
  assert.ok(title && title.indexOf('font-size:1.58em') !== -1, 'заголовок 36px = 1.58em');
});

test('buildCss: без CSS-масок иконки отзывов скрыты (пустых квадратов не рисуем)', () => {
  const line = css.split('\n').find((l) => l.indexOf('@supports not ((-webkit-mask-image:none)') === 0 && l.indexOf('lumen-reviews__ico') !== -1);
  assert.ok(line, 'фолбэк без масок для отзывов не найден');
  assert.ok(line.indexOf('lumen-review__likes:before') !== -1);
  assert.ok(line.indexOf('lumen-review-modal__likes:before') !== -1);
});

test('buildCss: наезд Ken Burns — на корне .lumen-backdrop (не .lumen-card: слой фона лежит вне карточки)', () => {
  const offender = findDecl(css, (sel) => sel.indexOf('.lumen-card') === 0 && sel.indexOf('lumen-bg__img') !== -1);
  assert.equal(offender, null, '.lumen-bg__img не должен встречаться в правилах с корнем .lumen-card — такой потомковый селектор никогда не совпадёт с реальным DOM (.lumen-backdrop — сосед .lumen-card, не предок .lumen-bg__img)');

  /* Task 40: селектор начинается с body.lumen-fx-heavy — наезд подчинён
     тумблеру тяжёлых эффектов, — но корень слоя остался прежним. */
  const decl = findDecl(css, (sel) => sel.indexOf('body.lumen-fx-heavy ') === 0 && sel.indexOf('.lumen-backdrop.lumen-motion-full') !== -1 && sel.indexOf('lumen-bg__img') !== -1 && sel.indexOf('is-active') !== -1);
  assert.ok(decl, 'правило наезда (body.lumen-fx-heavy .lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active) не найдено');
  assert.ok(decl.indexOf('lumen-kb') !== -1, 'ожидалась ссылка на @keyframes lumen-kb (14s, 1.00 -> 1.08)');
});

/* -------------------------------------------------------------------- */
/* Task 7: фоновый трейлер (экран 02). Слой ролика живёт в .lumen-backdrop */
/* (сосед .lumen-card), кнопка «Стоп» и метка — внутри .lumen-card.       */
/* -------------------------------------------------------------------- */

test('buildCss: .lumen-bg__trailer — слой ролика внутри .lumen-backdrop, ±10% по вертикали, без inset, проявление 1s', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__trailer');
  assert.ok(decl, 'правило .lumen-backdrop .lumen-bg__trailer не найдено');
  assert.ok(decl.indexOf('top:-10%') !== -1 && decl.indexOf('bottom:-10%') !== -1, 'кадр 16:9 растягивается за края по вертикали');
  assert.ok(decl.indexOf('left:0') !== -1 && decl.indexOf('right:0') !== -1);
  assert.equal(/inset\s*:/.test(decl), false, 'inset запрещён планом — только top/bottom/left/right');
  assert.ok(/opacity\s*:\s*0\b/.test(decl), 'до старта слой прозрачен');
  assert.ok(decl.indexOf('transition:opacity 1s') !== -1, 'проявление 1 с (design-spec §12, старт трейлера)');
});

test('buildCss: .lumen-bg__trailer.is-live — opacity:1, iframe не перехватывает пульт', () => {
  const live = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__trailer.is-live');
  assert.ok(live && /opacity\s*:\s*1\b/.test(live));
  const frame = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__trailer iframe');
  assert.ok(frame, 'правило для iframe не найдено');
  assert.ok(frame.indexOf('width:100%') !== -1 && frame.indexOf('height:100%') !== -1);
  assert.ok(frame.indexOf('pointer-events:none') !== -1, 'iframe не должен ловить фокус/клики');
});

test('buildCss: пока играет ролик, вуали слоя приглушаются (переход 1 с задан на самой вуали)', () => {
  const dim = findDecl(css, (sel) => sel === '.lumen-backdrop.lumen-trailer-live .lumen-backdrop__veil');
  assert.ok(dim, 'правило приглушения вуалей не найдено');
  assert.ok(/opacity\s*:\s*\.45/.test(dim));
  const base = findDecl(css, (sel) => sel === '.lumen-backdrop__veil');
  assert.ok(base && base.indexOf('transition:opacity 1s') !== -1, 'без transition на вуали приглушение было бы мгновенным');
});

test('buildCss: кнопка «Стоп» скрыта вне режима трейлера и показывается при .lumen-trailer-on', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-stop');
  assert.ok(base, 'правило .lumen-card .lumen-stop не найдено');
  assert.ok(/display\s*:\s*none/.test(base), 'по умолчанию кнопка скрыта');
  assert.ok(base.indexOf('height:3.16em') !== -1, 'высота 72px = 3.16em (design-spec §7a)');
  assert.ok(base.indexOf('border-radius:.79em') !== -1, 'радиус 18px = .79em');

  const on = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .lumen-stop');
  assert.ok(on, 'правило показа кнопки в режиме трейлера не найдено');
  assert.ok(on.indexOf('display:flex') !== -1);
  const flex = on.indexOf('display:-webkit-box');
  assert.ok(flex !== -1 && flex < on.indexOf('display:flex'), 'сначала старый -webkit-box, потом flex');
});

test('buildCss: кнопка «Стоп» в режиме трейлера выровнена с рядом кнопок по вертикали', () => {
  /* В flex(.lumen-actions, align-items:center) центр content-box = center_line + (MT − MB)/2.
     Кнопки ряда (MT=0, MB=0.6em) → offset −0.3em от центра ряда.
     Ряд .full-start-new__buttons (MT=1.40em, MB=0) → center_actions+0.7em.
     Итого центр кнопок = center_actions+0.4em.
     «Стоп»: MT=1.40em, MB=0.6em → (1.40−0.6)/2=0.4em ✓.
     MB=0.6em задан явно — Chrome-CSSOM при одном MT-longhand обнуляет MB каскада. */
  const buttonsRow = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__buttons');
  assert.ok(buttonsRow, '.full-start-new__buttons не найден');
  const mtMatch = buttonsRow.match(/margin-top:([\d.]+em)/);
  const mt = mtMatch ? mtMatch[1] : null;
  assert.ok(mt, 'у .full-start-new__buttons должен быть margin-top');
  /* кнопки ряда имеют margin-bottom:.6em */
  const btnRule = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__buttons .full-start__button');
  const mbMatch = btnRule && btnRule.match(/margin:[^;]*?([\d.]+em) 0/);
  const mb = mbMatch ? mbMatch[1] : '.6em';

  const on = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .lumen-stop');
  assert.ok(on, 'правило режима трейлера для «Стоп» не найдено');
  assert.ok(on.indexOf('margin-top:' + mt) !== -1,
    'в режиме трейлера margin-top «Стоп» должен совпадать с margin-top ряда (' + mt + ')');
  assert.ok(on.indexOf('margin-bottom:' + mb) !== -1,
    'в режиме трейлера margin-bottom «Стоп» (' + mb + ') должен быть задан явно — иначе Chrome-CSSOM обнуляет его через longhand-нормализацию');
});

test('buildCss: иконка «Стоп» — CSS-маска (иконка из общего набора, не свой svg)', () => {
  const ico = findDecl(css, (sel) => sel === '.lumen-card .lumen-stop__ico');
  assert.ok(ico, 'правило иконки кнопки не найдено');
  assert.ok(ico.indexOf('mask-image') !== -1);
  assert.ok(ico.indexOf('background-color:currentColor') !== -1, 'цвет иконки следует за цветом кнопки (в фокусе — тёмный)');
});

test('buildCss: фокус кнопки «Стоп» — как у кнопок карточки; в lite/off пружины нет', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-card .lumen-stop.focus');
  assert.ok(focus, 'правило фокуса кнопки не найдено');
  assert.ok(focus.indexOf('scale(1.06)') !== -1);
  const lite = findDecl(css, (sel) => sel.indexOf('lumen-motion-lite') !== -1 && sel.indexOf('.lumen-stop.focus') !== -1);
  const off = findDecl(css, (sel) => sel.indexOf('lumen-motion-off') !== -1 && sel.indexOf('.lumen-stop.focus') !== -1);
  assert.ok(lite && /transform\s*:\s*none\s*!important/.test(lite), 'lite гасит пружину (нативная анимация Lampa требует !important)');
  assert.ok(off && /transform\s*:\s*none\s*!important/.test(off));
});

test('buildCss: метка «ТРЕЙЛЕР · БЕЗ ЗВУКА» — правый верхний угол, иконка маской, видна только в режиме трейлера', () => {
  const badge = findDecl(css, (sel) => sel === '.lumen-card .lumen-trailer-badge');
  assert.ok(badge, 'правило метки не найдено');
  assert.ok(/display\s*:\s*none/.test(badge), 'вне режима трейлера метки нет');
  assert.ok(badge.indexOf('position:absolute') !== -1);
  assert.ok(badge.indexOf('right:3.51em') !== -1, 'Task 63: right по safe area tvOS — 80 px = 3.51em');
  assert.ok(badge.indexOf('top:4.91em') !== -1, 'top 112px = 4.91em');

  const on = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .lumen-trailer-badge');
  assert.ok(on && on.indexOf('display:flex') !== -1);
  const ico = findDecl(css, (sel) => sel === '.lumen-card .lumen-trailer-badge:before');
  assert.ok(ico && ico.indexOf('mask-image') !== -1, 'иконка «без звука» — маской');
});

test('buildCss: режим трейлера сжимает шапку — заголовок 42px, рейтинги и серии убраны', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .full-start-new__title');
  assert.ok(title && title.indexOf('font-size:1.84em') !== -1, 'заголовок экрана 02: 42px ÷ 22.811 = 1.84em');
  assert.ok(title.indexOf('opacity:.92') !== -1, 'на экране 02 заголовок слегка приглушён (opacity .92)');

  const hidden = ruleBodies(css).find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-trailer-on .full-start-new__rate-line'));
  assert.ok(hidden, 'правило скрытия блоков в режиме трейлера не найдено');
  assert.ok(/display\s*:\s*none\s*!important/.test(hidden.decl));
  assert.ok(hidden.selectors.indexOf('.lumen-card.lumen-trailer-on .lumen-episodes') !== -1,
    'в режиме трейлера должен скрываться ряд серий');
});

/* Task 59 (фаза 5): описание из шапки убрано вместе с узлом — правил для
   него в собранном CSS остаться не должно, иначе это мёртвые правила. */
test('Task 59: правил описания в шапке в CSS нет — блок убран из шаблона', () => {
  const orphans = ruleBodies(css).filter((r) => r.selectors.some((s) => /(^|[\s.])lumen-descr(?![-\w])/.test(s)));
  assert.deepEqual(orphans.map((r) => r.selectors.join(',')), [],
    'остались правила для убранного .lumen-descr');
});

/* Фикс-раунд Task 59: при нарисованных отзывах описание поджато восемью
   строками, а прокрутки внутри ряда у Lampa нет — значит подсказка про
   раскрытие обязана быть видна ровно в этом состоянии и нигде больше. */
test('Фикс Task 59: подсказка про полный текст видна там, где описание поджато', () => {
  /* Правка 2026-09-23 (правило кромки): описание клампится всегда, поэтому и
     подсказка стоит в базовом правиле. Отдельной ветки для отзывов больше
     нет — она означала бы, что в ряду без отзывов про обрезанный хвост
     человеку сказать нечем. */
  const base = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-descr-more');
  assert.ok(base && /display\s*:\s*block/.test(base), 'подсказка обязана показываться у всякого описания');
  assert.equal(findDecl(css, (sel) => sel === '.lumen-descr-row.lumen-descr-row--reviews .lumen-descr-more'), null,
    'ветка подсказки для отзывов больше не нужна — базовая её покрывает');
  const clamp = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(clamp && clamp.indexOf('-webkit-line-clamp:9') !== -1,
    'подсказка привязана к тому же состоянию, что и обрезка текста');
});

/* Правка 2026-09-23 (разбор композиции, пп.4.3 и 6): шаг ленты людей
   фиксирован так, чтобы правая кромка экрана приходилась на ПОРТРЕТ
   карточки, а не на имя. Тест считает геометрию ленты по тем же числам
   Lampa, что и правило, и требует, чтобы кромка попала в портрет при всех
   трёх размерах интерфейса. */
test('правка 2026-09-23: правая кромка приходится на портрет, а не на имя актёра', () => {
  const W = 960;
  /* Из vendor/lampa/css/app.css, сверено построчно: отступ ленты
     (.scroll--horizontal .scroll__content, 2795-2797), зазор между
     карточками (.mapping--line > * + *, 14603-14605), кегль карточки и
     портрет (.full-person / .full-person__photo, 4650-4697). */
  const ZOOM = 1.1;
  const LEFT = 1.5;
  const GAP = 1 * ZOOM;
  const PHOTO = 7 * ZOOM;
  for (const iface of ['small', 'normal', 'bigger']) {
    const built = withStorage({ interface_size: iface }, (LC) => LC.buildCss());
    const rule = findDecl(built, (sel) => sel === 'body .items-line .full-person');
    assert.ok(rule, iface + ': правила ширины карточки человека нет');
    /* Ширина задана в кегле самой карточки — переводим в базовые em. */
    const widthEm = parseFloat(/width:([0-9.]+)em/.exec(rule)[1]) * ZOOM;
    const EM = lampaEm(W, iface);
    const step = (widthEm + GAP) * EM;
    const left = LEFT * EM;
    /* Сколько карточек влезает целиком и где начинается следующая. */
    const n = Math.floor((W - left) / step);
    const nextLeft = left + n * step;
    assert.ok(nextLeft <= W, iface + ': за кромкой не остаётся ни одной карточки — подглядывать нечем');
    assert.ok(W <= nextLeft + PHOTO * EM,
      iface + ': кромка ' + W + ' приходится не на портрет (он ' + nextLeft.toFixed(1) +
      '…' + (nextLeft + PHOTO * EM).toFixed(1) + '), а значит на текст');
    /* И сама карточка не должна выродиться: имени нужно место. */
    assert.ok(widthEm > PHOTO + GAP + 6, iface + ': карточка ' + widthEm.toFixed(2) + 'em — имени не останется места');
  }

  /* Имя и роль обрезаются по СВОЕМУ правилу — многоточием, а не кромкой. */
  const name = findDecl(css, (sel) => sel === 'body .items-line .full-person__name' ||
    sel === 'body .items-line .full-person__role');
  assert.ok(name && /text-overflow:ellipsis/.test(name), 'имя обязано обрезаться многоточием: ' + name);
  assert.ok(/white-space:nowrap/.test(name), 'без nowrap многоточия не будет: ' + name);
  const body = findDecl(css, (sel) => sel === 'body .items-line .full-person__body');
  assert.ok(body && /min-width:0/.test(body), 'без min-width:0 flex-элемент не даст себя сжать: ' + body);
});

/* Правило кромки на карточке (правка 2026-09-23): «текст либо целиком, либо
   не показан» обязано держаться при ЛЮБОЙ высоте шапки. Прежние девять
   строк описания (и три у сериала) были подобраны под один замер старта
   описания и держались на совпадении высот: двухуровневое название
   (4d090c2) подняло старт на 12 px, и под кромку въехали счётчики разделов
   Lampa; на телевизоре (DPR 2, шапка 74vh) кромка резала вторую строку
   описания при любом клампе. Теперь шапка занимает весь первый экран, и
   ряд описания начинается не выше кромки.

   Сторож проверяет устойчивость, а не одно число: для каждой конфигурации
   (три размера интерфейса × обычный и плоский вид × DPR 1 и 2, то есть
   компактная ветка и ветка телевизора × фильм и сериал) он собирает
   таблицу, находит по каскаду min-height и нижний паддинг корня карточки
   и min-height тела шапки и прогоняет НАБОР высот содержимого шапки — от
   пустой до выше экрана, включая замеренные на стенде. Для каждой высоты
   верх ряда описания обязан быть не выше кромки. Вернись правило
   к подобранному числу — какая-то из высот его обойдёт. */
function cardRootRules(built, classes, screenW, screenH) {
  const out = [];
  const all = ruleBodiesWithMedia(built);
  for (let i = 0; i < all.length; i++) {
    const rule = all[i];
    for (const sel of rule.selectors) {
      if (/\s/.test(sel)) continue;
      const c = compound(sel);
      if (!c || !compoundMatches(c, classes) || c.need.indexOf('lumen-card') === -1) continue;
      if (!mediaApplies(rule.media, screenW, screenH)) continue;
      out.push({ order: i, spec: classCount(sel), decl: rule.decl, sel: sel });
      break;
    }
  }
  return out;
}

test('правило кромки: ряд описания не выше кромки при любой высоте шапки карточки', () => {
  const W = 960;
  const H = 540;
  const lampa = lampaCss();
  /* Верх карточки в первом экране: шапка Lampa (.wrap__content padding-top,
     app.css:1033-1037) плюс паддинг прокрутки (.scroll--mask
     .scroll__content, app.css:2787-2789). */
  const topEm = lampaDecl(lampa, '.wrap__content', 'padding-top') +
    lampaDecl(lampa, '.scroll--mask .scroll__content', 'padding');
  /* Высоты содержимого шапки, CSS px. Замеренные на стенде 960×540
     (2026-09-23): 221.1 — фильм с логотипом при DPR 1 (старт описания 325.2,
     счётчики под кромкой); 223 — тот же фильм с двухуровневым названием;
     235.1 — он же до 4d090c2 (название двумя строками, старт 339.2);
     381.9 — сериал с логотипом при DPR 1 (кромка резала описание);
     427.1 — сериал с логотипом на «крупнее» при DPR 2: шапка переросла
     74vh. Остальные — сетка от пустой шапки до шапки выше экрана. */
  const heads = [0, 120, 221.1, 223, 235.1, 300, 381.9, 399.6, 427.1, 470, 540, 720];
  const VH = H / 100;
  let checked = 0;
  for (const iface of ['small', 'normal', 'bigger']) {
    const EM = lampaEm(W, iface);
    for (const flat of [false, true]) {
      for (const dpr of [1, 2]) {
        const built = withStorage({ interface_size: iface, lumen_flat: flat }, (LC) => {
          window.devicePixelRatio = dpr;
          return LC.buildCss();
        });
        for (const serial of [false, true]) {
          const classes = ['full-start-new', 'lumen-card'].concat(serial ? ['lumen-card--serial'] : []);
          const label = iface + (flat ? '/плоский' : '') + '/DPR ' + dpr + (serial ? '/сериал' : '/фильм');
          const root = cardRootRules(built, classes, W, H);
          const minH = cascade(root, 'min-height');
          assert.ok(minH, label + ': у корня карточки нет min-height — ряд описания пойдёт сразу за шапкой');
          const cardMin = lengthPx(minH.value, EM, VH);
          const pad = cascade(root, 'padding');
          const padBottom = lengthPx(pad.value.split(/\s+/)[2] || pad.value.split(/\s+/)[0], EM, VH);
          const body = cascade(matchingRules(built, classes, ['full-start-new__body'], W, H), 'min-height');
          const bodyMin = body ? lengthPx(body.value, EM, VH) : 0;
          for (const head of heads) {
            const cardH = Math.max(cardMin, Math.max(bodyMin, head) + padBottom);
            const descrTop = topEm * EM + cardH;
            assert.ok(descrTop >= H - 0.5,
              label + ', шапка ' + head + ' px: ряд описания начинается на ' + descrTop.toFixed(1) +
              ' при кромке ' + H + ' — кромка режет его текст');
            checked++;
          }
        }
      }
    }
  }
  assert.equal(checked, 3 * 2 * 2 * 2 * heads.length);

  /* Сериал больше не получает своего клампа: размен «синопсис против ряда
     серий» жил только в первом экране, а описание туда не входит. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-card--serial ~ .lumen-descr-row .full-descr__text'), null,
    'у сериала снова свой кламп — он был подобран под высоту шапки');
});

/* Правка 2026-09-23 (разбор композиции, п.5.1): стопка постеров и счётчик
   выборки в барабане рулетки. До неё центр экрана был пустой чёрной
   коробкой на 43 % высоты, и переключение подборок не меняло его вовсе. */
test('правка 2026-09-23: стопка и счётчик выборки рулетки показываются одним классом сцены', () => {
  const peek = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__peek');
  assert.ok(peek, 'правила задних постеров стопки нет');
  assert.ok(/display:none/.test(peek), 'задние постеры обязаны быть скрыты по умолчанию: ' + peek);
  /* Коробка у задних та же, что у барабана, — стопка это один постер,
     сдвинутый трижды, а не три разных размера. */
  /* У барабана правил два — коробка и свой слой; берём оба. */
  const reel = declAll(css, '.lumen-roulette .lumen-roulette__reel');
  const reelW = /width:([0-9.]+)vh/.exec(reel);
  assert.ok(reelW, 'у барабана пропала ширина: ' + reel);
  assert.ok(peek.indexOf('width:' + reelW[1] + 'vh') !== -1, 'задние постеры разъехались с барабаном по ширине: ' + peek);

  /* Барабану нужен свой слой, иначе порядок документа — единственное, что
     держит задние постеры под ним. */
  assert.ok(/z-index:1/.test(reel), 'барабан обязан лежать поверх стопки своим слоем: ' + reel);

  /* Показывает стопку и счётчик один класс сцены — чтобы «есть выборка» и
     «есть счётчик» не могли разойтись. */
  const on = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__stage.is-stack .lumen-roulette__peek');
  assert.ok(on && /display:block/.test(on), 'класс сцены не показывает задние постеры');
  const count = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__stage.is-stack .lumen-roulette__count');
  assert.ok(count && /display:block/.test(count), 'класс сцены не показывает счётчик');

  /* Число крупнее подписи — «ведущее значение плюс приглушённая подпись»,
     та же схема, что у чипов карточки. */
  const value = parseFloat(/font-size:([0-9.]+)em/.exec(decl(css, '.lumen-roulette .lumen-roulette__count-value'))[1]);
  const label = parseFloat(/font-size:([0-9.]+)em/.exec(decl(css, '.lumen-roulette .lumen-roulette__count-label'))[1]);
  assert.ok(value > label * 1.3, 'число счётчика ' + value + 'em не ведёт над подписью ' + label + 'em');
});

test('Фикс Task 59: у окна полного описания свой корень и кегль текста описания', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-descr-modal__text');
  assert.ok(text && text.indexOf('font-size:1.27em') !== -1, 'кегль тот же, что у описания в ряду (Body tvOS после Task 63)');
  /* Прокрутку длинного текста берёт на себя Scroll модала Lampa — своей
     высоты и overflow окну не задаём, иначе внутри него появился бы второй
     скролл, которым пульт не управляет. */
  assert.equal(/max-height|overflow/.test(text), false, text);
});

/* Task 59: счётчики разделов («Жанр 3 · Производство 2 · Теги 17») —
   .tag-count.selector внутри .full-descr__tags (Descriptiopn.tag,
   app.min.js:38124-38149). Скрыть их нельзя: «Производство» зовёт
   router.call('company', …) (38036-38040), «Теги» — discover с
   with_keywords (38059-38066), и обе подборки из интерфейса больше ниоткуда
   не открываются. Тест держит это решение: правило, гасящее их под нашими
   корнями, — регрессия, а не улучшение. */
test('Task 59: счётчики разделов Lampa не скрыты — через них открываются подборки', () => {
  const killed = ruleBodies(css).filter((r) => r.selectors.some((s) => /tag-count|full-descr__tags/.test(s))
    && /display\s*:\s*none|visibility\s*:\s*hidden/.test(r.decl));
  assert.deepEqual(killed.map((r) => r.selectors.join(',')), []);
});

/* Задержек stagger ровно столько, сколько блоков .lumen-in в шаблоне
   (src/40_template.js) — лишняя была бы правилом, которое ни к чему не
   применяется. */
test('Task 59: задержек появления столько же, сколько блоков шапки', () => {
  const delays = ruleBodies(css).filter((r) => r.selectors.some((s) => /\.lumen-card\.lumen-motion-full \.lumen-in:nth-child\(\d\)/.test(s)));
  assert.equal(delays.length, 5);
});

/* -------------------------------------------------------------------- */
/* Task 8: «Продолжить» — строка прогресса (design-spec §6, экраны 01/05), */
/* подпись кнопки переменной и надписи сжатой шапки (экран 06).           */
/* -------------------------------------------------------------------- */

test('buildCss: строка прогресса — одна подпись над полосой (flex-wrap, полоса 100 %, 760px = 33.32em)', () => {
  const row = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress');
  assert.ok(row, 'правило .lumen-progress не найдено');
  assert.ok(row.indexOf('width:33.32em') !== -1, '§6: ширина 760px = 33.32em');
  assert.ok(row.indexOf('flex-wrap:wrap') !== -1, 'подпись и полоса — разные строки одного flex-контейнера');
  assert.ok(row.indexOf('letter-spacing:.04em') !== -1);

  const bar = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__bar');
  assert.ok(bar, 'правило полосы не найдено');
  assert.ok(bar.indexOf('flex:0 0 100%') !== -1, 'полоса обязана переноситься под подпись, а не делить с ней строку');
  assert.ok(bar.indexOf('height:.18em') !== -1 && bar.indexOf('border-radius:.09em') !== -1, '§6: 4px/2px');
  assert.ok(bar.indexOf('margin:.44em 0 0') !== -1, 'зазор до полосы 10px = .44em');
});

test('buildCss: подпись и таймкод — минимум tvOS (1.01em) muted, пустой узел убран :empty', () => {
  const label = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__label');
  const time = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__time');
  assert.ok(label && time, 'правила подписи/таймкода не найдены');
  for (const decl of [label, time]) {
    assert.ok(decl.indexOf('font-size:1.01em') !== -1, 'Task 63: 23 px = 1.01em');
    assert.ok(decl.indexOf('#A89A8A') !== -1, '§6: цвет muted, а не text');
  }
  const empty = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__label:empty');
  assert.ok(empty && /display\s*:\s*none/.test(empty), 'у фильма подписи нет — пустой узел не должен занимать место');
});

test('buildCss: подпись кнопки — :after с var(--lumen-play-label), :before не занят', () => {
  const after = findDecl(css, (sel) => sel.indexOf('.lumen-card.lumen-continue') === 0 && sel.indexOf('.button--play:after') !== -1);
  assert.ok(after, 'правило подписи кнопки не найдено');
  assert.ok(after.indexOf('content:var(--lumen-play-label)') !== -1, 'текст кнопки нельзя писать в разметку — только переменной');
  assert.equal(findDecl(css, (sel) => sel.indexOf('.lumen-continue') !== -1 && sel.indexOf('.button--play:before') !== -1), null,
    ':before у кнопки занят маской иконки (Task 3)');
});

test('buildCss: штатный span кнопки скрыт только при поддержке CSS-переменных', () => {
  const rule = ruleBodies(css).find((r) => r.selectors.some((s) => s.indexOf('.lumen-continue') !== -1 && s.indexOf('.button--play span') !== -1));
  assert.ok(rule, 'правило скрытия span не найдено');
  assert.ok(/display\s*:\s*none/.test(rule.decl));
  const line = css.split('\n').find((l) => l.indexOf('.button--play span') !== -1 && l.indexOf('.lumen-continue') !== -1);
  assert.ok(line.indexOf('@supports (--') === 0,
    'без @supports на старом WebView кнопка осталась бы вовсе без подписи: :after там не работает');
});

/* ====================================================================== */
/* Task 18: штатная кнопка «Трейлер». Разметка кнопки не трогается (её     */
/* outerHTML хэширует Lampa), поэтому весь показ — на этих правилах.       */
/* ====================================================================== */

test('buildCss: Task 18 — пул .buttons--container раскрывается только под классом корня, и только для .view--trailer', () => {
  const rules = ruleBodies(css);

  const shown = rules.find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container'));
  assert.ok(shown, 'правила показа пула нет');
  assert.ok(/display\s*:\s*flex\s*!important/.test(shown.decl),
    '.hide у пула объявлен через display:none !important — перебить его можно только своим !important');

  const btn = rules.find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-card--trailer .full-start-new__buttons > .buttons--container > .view--trailer'));
  assert.ok(btn && /display\s*:\s*flex/.test(btn.decl), 'кнопка трейлера должна показываться');

  const hidden = rules.find((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__buttons > .buttons--container > .full-start__button'));
  assert.ok(hidden && /display\s*:\s*none/.test(hidden.decl),
    'остальные кнопки пула (торренты, .view--online_mod чужих плагинов) обязаны остаться скрытыми: их путь к пользователю — меню «Смотреть»');
});

test('buildCss: Task 18 — кнопка «Трейлер» вторая в ряду и с подписью (экран 01)', () => {
  const rules = ruleBodies(css);

  const pool = rules.find((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__buttons > .buttons--container'));
  assert.ok(pool && /(^|;)order\s*:\s*1/.test(pool.decl), 'пул в разметке последний — вторым местом он становится через order');
  const icons = rules.find((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__buttons > .button--book'));
  assert.ok(icons && /(^|;)order\s*:\s*2/.test(icons.decl), 'иконочные кнопки уезжают за «Трейлер»');
  for (const cls of ['.button--reaction', '.button--subscribe', '.button--options']) {
    assert.ok(icons.selectors.some((s) => s.indexOf(cls) !== -1), cls + ': тоже должна уехать за «Трейлер»');
  }

  const span = rules.find((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__buttons .view--trailer span'));
  assert.ok(span && /display\s*:\s*block/.test(span.decl),
    'по дизайну «Трейлер» — кнопка с подписью, как «Смотреть», а не иконочный квадрат');
});

test('buildCss: Task 18 — показ кнопки не завязан на режим фонового ролика', () => {
  // lumen_trailer управляет ТОЛЬКО фоном; полноценный просмотр по кнопке —
  // осознанное действие пользователя и обязан работать при lumen_trailer=off.
  const wrong = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('.buttons--container') !== -1 && s.indexOf('lumen-trailer-on') !== -1));
  assert.equal(wrong.length, 0, 'кнопка не должна зависеть от того, играет ли фоновый ролик');
});

test('buildCss: в режиме трейлера подписи на кнопке нет и строка прогресса скрыта (экран 02)', () => {
  const after = ruleBodies(css).find((r) => r.selectors.some((s) => s.indexOf('.button--play:after') !== -1));
  assert.ok(after.selectors.every((s) => s.indexOf(':not(.lumen-trailer-on)') !== -1),
    'на экране 02 кнопка называется «Смотреть» — подпись обязана отключаться');

  const hidden = ruleBodies(css).find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-trailer-on .full-start-new__rate-line'));
  assert.ok(hidden.selectors.indexOf('.lumen-card.lumen-trailer-on .lumen-progress') !== -1,
    'строки прогресса на экране 02 нет');
});

test('buildCss: надписи сжатой шапки (экран 06) видны только при фокусе на серии и включённой настройке', () => {
  for (const node of ['state', 'timecode']) {
    const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode__' + node);
    assert.ok(base && /display\s*:\s*none/.test(base), 'узел .lumen-episode__' + node + ' должен быть скрыт по умолчанию');
  }
  const shown = ruleBodies(css).find((r) => r.selectors.some((s) => s.indexOf('.lumen-episode__timecode') !== -1 && s.indexOf('.lumen-compact') !== -1));
  assert.ok(shown, 'правило показа надписей в сжатой шапке не найдено');
  assert.ok(shown.selectors.every((s) => s.indexOf('.lumen-progress-on') !== -1 && s.indexOf('.lumen-episode.focus') !== -1),
    'надписи гасятся выключателем lumen_card_progress и показываются только у фокусной серии');

  const caption = findDecl(css, (sel) => sel.indexOf('.lumen-compact') !== -1 && sel.indexOf('.lumen-episode__caption') !== -1);
  assert.ok(caption && /display\s*:\s*none/.test(caption), 'таймкод заменяет подпись «смотрите · осталось N мин», а не дополняет её');
});

test('buildCss: в сжатой шапке статус и чип серии — одна карта «Выходит · 17 дек»', () => {
  const short = findDecl(css, (sel) => sel === '.lumen-card .lumen-next-chip__short');
  assert.ok(short && /display\s*:\s*none/.test(short), 'короткая дата вне сжатой шапки скрыта');
  const shortOn = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-next-chip__short');
  const longOff = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-next-chip__text');
  assert.ok(shortOn && shortOn.indexOf('display:block') !== -1);
  assert.ok(longOff && /display\s*:\s*none/.test(longOff), 'длинная строка в сжатой шапке не помещается');

  /* Правка 2026-09-23 (п.2.3): склеивать нечего — у сериала статус и
     следующая серия это ОДИН двухуровневый чип, и в сжатой шапке меняется
     только подпись. Вместе со склейкой ушёл класс .lumen-card--nextchip:
     он существовал ровно ради срезки радиусов. */
  assert.equal(css.indexOf('lumen-card--nextchip'), -1, 'класс склейки остался в таблице');
  const labelOff = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-status__label');
  const shortStatus = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-status__short:not(:empty)');
  assert.ok(labelOff && /display:none/.test(labelOff), 'полная подпись в сжатой шапке не помещается');
  assert.ok(shortStatus && /display:block/.test(shortStatus), 'короткая дата в сжатой шапке не показывается');
});

/* -------------------------------------------------------------------- */
/* Task 38: backdrop-filter в плагине нет вовсе.                          */
/*                                                                       */
/* Раньше (ревью фазы 1, I1) блюр подложек гасился только в режимах       */
/* «Лёгкие»/«Выкл», и здесь стоял тест, требовавший от каждого правила с  */
/* backdrop-filter:blur пары под lumen-motion-lite и lumen-motion-off.    */
/* Теперь гасить нечего: свойство убрано из палитры целиком. Причина не в */
/* движении, а в самом свойстве — backdrop-filter читает пиксели ПОД      */
/* элементом и пересобирается композитором покадрово, пока фон живой      */
/* (кроссфейд кадров 1.2 с, Ken Burns, играющий iframe трейлера), а фон   */
/* под карточкой живой в любом режиме, кроме 'off'.                       */
/*                                                                       */
/* Компенсация читаемости, которая раньше шла в паре с гашением, стала    */
/* постоянной: «Стоп» и метка «ТРЕЙЛЕР · БЕЗ ЗВУКА» показываются только   */
/* при lumen-trailer-on, то есть всегда поверх живого кадра YouTube, где  */
/* вуали слоя вдобавок приглушены до opacity .45                          */
/* (.lumen-backdrop.lumen-trailer-live). На светлой сцене ролика белый    */
/* текст на прозрачной подложке терялся: замеренный контраст #F3EDE4 к    */
/* подложке поверх белого кадра был 3.1:1 у «Стоп» и 4.8:1 у метки против */
/* целевых 7:1 проекта. Поэтому у обоих узлов заливка обязана быть        */
/* плотной в БАЗОВОМ правиле, без оглядки на режим.                       */
/* -------------------------------------------------------------------- */

/* Альфа собственной заливки правила: background:rgba(r,g,b,a) -> a. */
function fillAlpha(decl) {
  const m = /(?:^|;)background:rgba\([^)]*?,\s*([\d.]+)\s*\)/.exec(decl);
  return m ? parseFloat(m[1]) : null;
}

test('Task 38: backdrop-filter отсутствует во всех режимах и при любых настройках', () => {
  /* Обе сборки: настройки по умолчанию и «Плотные подложки». Блюр выводился
     именно в первой — в плотной палитра отдавала пустую строку, и тест,
     проверяющий только её, ничего бы не поймал. */
  const variants = [
    ['по умолчанию', css],
    ['плотные подложки', withStorage({ lumen_solid: true }, (LC) => LC.buildCss())]
  ];
  for (const [name, text] of variants) {
    assert.equal(text.indexOf('backdrop-filter'), -1,
      name + ': backdrop-filter читает пиксели под элементом каждый кадр — на WebView ТВ запрещён');
  }
});

/* -------------------------------------------------------------------- */
/* Task 38: дорогие эффекты убраны с горячих путей. Целевое железо —      */
/* Philips 50PUS8057 (4 ядра MediaTek, Android TV 11, WebView рисует     */
/* 1080p); внешний ресёрч docs/research/2026-09-18-android-tv-animations */
/* .md запрещает на нём анимированные тени, большие радиусы размытия,    */
/* filter:blur на живых узлах и маски на движущихся слоях.               */
/* Проверки идут по ВСЕМУ тексту таблицы, а не по списку селекторов:     */
/* любое новое правило обязано соблюдать те же границы.                  */
/* -------------------------------------------------------------------- */

/* Ревью фикс-раунда (находка без номера): у гирлянды темы и у постера в
   режиме «Постер» стояли background-size и box-shadow без -webkit- пары,
   хотя весь остальной файл пишет их парами. Сторож — по всей таблице, кроме
   кадров @keyframes (у них своя копия @-webkit-keyframes). */
test('префиксные пары: background-size, box-shadow, transform, transition, mask-image — везде с -webkit-', () => {
  const bad = [];
  for (const line of css.split('\n')) {
    if (/keyframes/.test(line)) continue;
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(line))) {
      for (const p of ['background-size', 'box-shadow', 'transform', 'transition', 'mask-image']) {
        if (new RegExp('(^|;)' + p + ':').test(m[2]) && !new RegExp('-webkit-' + p + ':').test(m[2])) bad.push(p + ' @ ' + m[1].trim());
      }
    }
  }
  assert.deepEqual(bad, []);
});

/* Ревью фикс-раунда (п.8): затемнение под содержимым карточки начинается
   там, где кончается кадр её шапки, — число одно, и в таблице оно обязано
   совпасть в обоих местах. */
test('ревью п.8: затемнение карточки стартует на высоте кадра её шапки', () => {
  const body = decl(css, '.lumen-card .full-start-new__body');
  const scrim = decl(css, '.lumen-scrim');
  const bodyVh = parseFloat(/(?:^|;)min-height:([\d.]+)vh/.exec(body)[1]);
  const from = parseFloat(/[^-]background-image:linear-gradient\(180deg,rgba\([^)]*\) 0,rgba\([^)]*\) ([\d.]+)vh/.exec(scrim)[1]);
  assert.equal(from, bodyVh, 'затемнение и кадр шапки разъехались: ' + from + 'vh против ' + bodyVh + 'vh');
  const src = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/\b74vh\b/.test(src), false, 'литерал 74vh снова в коде таблицы — второй источник правды');
});

test('Task 38: box-shadow нигде не входит в transition', () => {
  const offenders = css.split('\n').filter((line) => /transition[^;{}]*box-shadow/.test(line));
  assert.deepEqual(offenders.map((l) => l.slice(0, l.indexOf('{'))), [],
    'каждый кадр анимации тени — перерисовка растра элемента; тень должна появляться вместе с классом .focus');
});

test('Task 38: ни одного box-shadow с размытием больше .8em', () => {
  /* Второе число тени — смещение, третье — радиус размытия: «0 .35em .7em».
     Нулевой радиус пишется без единицы («0 .2em 0», Task 50) — такая запись
     проверке радиуса не подлежит, но форму ниже проходить обязана. */
  const offenders = [];
  for (const m of css.matchAll(/box-shadow:\s*0\s+([\d.]+)em\s+([\d.]+)em/g)) {
    if (parseFloat(m[2]) > 0.8) offenders.push(m[0]);
  }
  assert.deepEqual(offenders, [], 'радиус тени WebView считает по площади вокруг элемента, а таких элементов на экране десятки');
  /* Заодно: другой формы записи тени в таблице быть не должно — иначе
     проверка выше молча пропустила бы её. Форма закрыта до конца, вплоть до
     цвета: четвёртое число (spread) растит площадь перерисовки ровно так же,
     как радиус, а проверка выше его не видит. */
  const shapes = [...css.matchAll(/box-shadow:[^;}]+/g)].map((m) => m[0]);
  const unknown = shapes.filter((s) => !/^(-webkit-)?box-shadow:0 [\d.]+em ([\d.]+em|0) (rgba?\(|#)/.test(s));
  assert.deepEqual(unknown, [], 'тень записана не в форме «0 <смещение>em <радиус> <цвет>» — проверка радиуса её не увидит');
});

test('Task 38: filter:blur отсутствует', () => {
  /* Размытие фона и героя даёт теперь апскейл постера (w92), а не фильтр.
     Ловится любая запись, включая одинокий -webkit-filter: на движках ТВ
     работает как раз он, и пропустить его было бы хуже всего. */
  const offenders = css.split('\n').filter((line) => /filter:\s*blur\(/.test(line));
  assert.deepEqual(offenders.map((l) => l.slice(0, l.indexOf('{'))), [],
    'filter:blur заставляет WebView держать отдельный буфер на весь слой');
});

/* Task 41: коллажа из трёх повёрнутых постеров больше нет — на плитке один
   кадр. Тень осталась только у самой плитки в фокусе (правило ниже), а
   вращения на экране не осталось вовсе: повёрнутый элемент WebView
   растрирует отдельно, вместе с тенью по всему её радиусу. */
test('Task 41: внутри плитки хаба ни теней, ни поворотов', () => {
  for (const sel of ['.lumen-hub .lumen-tile__media', '.lumen-hub .lumen-tile__img']) {
    const decl = findDecl(css, (s2) => s2 === sel);
    assert.ok(decl, 'правило ' + sel + ' не найдено');
    assert.equal(decl.indexOf('box-shadow'), -1, sel + ': тень внутри плитки: ' + decl);
  }
  const rotated = css.split('\n').filter((line) => /^\.lumen-hub /.test(line) && /rotate\(/.test(line));
  assert.deepEqual(rotated, [], 'в хабе не должно остаться повёрнутых элементов');
});

test('Task 38: «Стоп» и метка трейлера плотные без блюра (белый текст поверх светлой сцены ролика)', () => {
  for (const sel of ['.lumen-card .lumen-stop', '.lumen-card .lumen-trailer-badge']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило ' + sel + ' не найдено');
    const alpha = fillAlpha(decl);
    assert.ok(alpha !== null, sel + ': ожидалась заливка rgba() из палитры');
    assert.ok(alpha >= 0.88,
      sel + ': заливка ' + alpha + ' слишком прозрачна для белого текста поверх светлого кадра (нужно >= .88)');
  }
});

/* Вес селектора: для наших правил (цепочки классов) достаточно посчитать
   классы — id и теги в этом CSS не используются. */
function classWeight(sel) {
  return (sel.match(/\.[A-Za-z0-9_-]+/g) || []).length;
}

/* Фокус «Стоп» красится акцентом, и уплотнённая подложка не должна его
   перебить. Держится это НЕ текстом объявления, а весом правила: у уплотнения
   3 класса — ровно как у v1-правила .lumen-card .lumen-stop.focus, — и
   объявлено оно позже, то есть по порядку выиграло бы. Спасает только то, что
   у правила режима с .focus класса четыре. Поэтому сравниваем именно веса:
   перенос уплотнения на четырёхклассовый селектор или !important тест поймает
   (проверка «в объявлении есть background:#RRGGBB» этого не ловила). */
/* Task 38: плотная заливка «Стопа» переехала из правил режима в базовое
   правило (палитра отдаёт .9 всегда), поэтому спорят теперь два правила —
   базовое и фокусное, а не «уплотнение режима» и фокус. Проверка та же по
   смыслу: акцент в фокусе обязан выигрывать весом, а не порядком строк. */
test('Task 38: акцент фокуса «Стоп» держится специфичностью, а не порядком правил', () => {
  assert.equal(classWeight('.lumen-card .lumen-stop.focus'), 3, 'счётчик весов сам по себе исправен');

  const baseSel = '.lumen-card .lumen-stop';
  const focusSel = baseSel + '.focus';
  const base = findDecl(css, (s) => s === baseSel);
  const focus = findDecl(css, (s) => s === focusSel);

  assert.ok(base, 'базовое правило «Стоп» не найдено');
  assert.ok(focus, 'правило фокуса «Стоп» не найдено');
  assert.ok(/(^|;)background:/.test(focus), 'фокус обязан объявлять свою заливку: ' + focus);
  assert.ok(classWeight(focusSel) > classWeight(baseSel),
    'вес фокуса (' + classWeight(focusSel) + ') обязан быть больше веса базового правила (' + classWeight(baseSel) + ')');
  assert.equal(/background:[^;]*!important/.test(base), false,
    'базовая заливка с !important перебила бы акцент фокуса независимо от весов');

  /* Правила режимов у «Стопа» остались только для гашения пружины — своей
     заливки они больше не задают, и перекрашивать фокус им нечем. */
  for (const mode of ['lite', 'off']) {
    const modeSel = '.lumen-card.lumen-motion-' + mode + ' .lumen-stop';
    const decl = findDecl(css, (s) => s === modeSel);
    assert.equal(decl, null, modeSel + ': правило уплотнения должно было уйти вместе с блюром');
  }
});

test('buildCss: в режиме трейлера ряд кнопок и «Стоп» встают в одну строку', () => {
  /* Ревью: правило висит на собственном классе .lumen-actions, а не на
     nth-child(6) — порядок блоков шаблона не часть контракта стилей. */
  const row = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .lumen-actions');
  assert.ok(row, 'правило строки кнопок в режиме трейлера не найдено');
  assert.equal(findDecl(css, (sel) => sel.indexOf('.lumen-trailer-on') !== -1 && sel.indexOf('nth-child') !== -1), null,
    'режим трейлера не должен зависеть от порядкового номера блока');
  assert.ok(row.indexOf('display:flex') !== -1);
  assert.ok(row.indexOf('align-items:center') !== -1);
});

/* ---------------------------------------------------------------------- */
/* Task 17: кнопка «Франшиза», хаб подборок, сетка подборки.               */
/* ---------------------------------------------------------------------- */

test('Task 17: кнопка «Франшиза» скрыта, пока корень карточки не помечен классом', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-franchise');
  assert.ok(base, 'базовое правило кнопки не найдено');
  assert.ok(base.indexOf('display:none') !== -1, 'без класса корня кнопки на экране быть не должно');
  const on = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--franchise .lumen-franchise');
  assert.ok(on, 'правило показа кнопки не найдено');
  assert.ok(on.indexOf('display:flex') !== -1);
});

test('Task 17: кнопка «Франшиза» выровнена по ряду кнопок теми же отступами, что «Стоп»', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-franchise');
  /* Ряд кнопок: margin-top 1.40em; кнопки внутри: margin-bottom .6em.
     Тот же расчёт, что у .lumen-stop (см. комментарий в src/30_css.js). */
  assert.ok(/margin:1\.40em [^;]*\.6em/.test(base), 'ожидались MT 1.40em и MB .6em: ' + base);
  assert.ok(base.indexOf('height:3.16em') !== -1, 'высота кнопки карточки — 72px ÷ 22.811');
});

test('Task 17: строка кнопок с «Франшизой» — flex, реакции и ряд серий занимают всю ширину', () => {
  const row = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--franchise .lumen-actions');
  assert.ok(row, 'правило раскладки не найдено');
  assert.ok(row.indexOf('display:flex') !== -1);
  assert.ok(row.indexOf('flex-wrap:wrap') !== -1);
  const full = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--franchise .full-start-new__reactions');
  assert.ok(full, 'правило переноса реакций не найдено');
  assert.ok(full.indexOf('flex-basis:100%') !== -1);
});

test('Task 17: иконка кнопки «Франшиза» — CSS-маска из общего набора, без масок скрыта', () => {
  const ico = findDecl(css, (sel) => sel === '.lumen-card .lumen-franchise__ico');
  assert.ok(ico, 'правило иконки не найдено');
  assert.ok(ico.indexOf('mask-image:url("data:image/svg+xml') !== -1, 'иконка обязана быть маской, а не своим svg');
  assert.ok(css.indexOf('@supports not ((-webkit-mask-image:none) or (mask-image:none)){.lumen-card .lumen-franchise__ico{display:none}}') !== -1,
    'без поддержки масок пустой квадрат не рисуем');
});

test('Task 17: фокус кнопки «Франшиза» — инверсия; в lite/off пружины нет и заливку никто не перекрашивает', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-card .lumen-franchise.focus');
  assert.ok(focus, 'правило фокуса не найдено');
  assert.ok(focus.indexOf('transform:scale(1.06)') !== -1);
  const lite = findDecl(css, (sel) => sel === '.lumen-card.lumen-motion-lite .lumen-franchise.focus');
  assert.ok(lite, 'правило lite не найдено');
  assert.ok(/transform:none !important/.test(lite), 'нативная анимация Lampa перебивается только !important');
  /* Task 54: заливка отсюда ушла. Правило режима идёт после правила фокуса и
     специфичностью выше — любое background здесь перекрыло бы инверсию, и
     фокус выглядел бы по-разному в разных режимах движения. */
  assert.equal(/(^|;)background(-color)?:/.test(lite), false, 'правило режима не должно трогать заливку: ' + lite);
});

test('Task 17: хаб — safe area tvOS с обеих сторон, плитки по 4 в ряд', () => {
  const root = findDecl(css, (sel) => sel === '.lumen-hub');
  assert.ok(root, 'корень хаба не найден');
  assert.ok(/padding:2\.63em 3\.51em/.test(root), 'Task 63: safe area tvOS — 60 px сверху (2.63em) и 80 по бокам (3.51em): ' + root);
  const tile = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile');
  assert.ok(tile, 'правило плитки не найдено');
  assert.ok(tile.indexOf('width:calc((100% - 2.64em) / 4)') !== -1, 'ширина = (100% − 3×.88em) / 4: ' + tile);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile:nth-child(4n)'), 'у последней плитки ряда нет правого отступа');
  const ratio = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile:before');
  assert.ok(ratio && ratio.indexOf('padding-top:56.25%') !== -1, 'пропорция 16:9 распоркой, без aspect-ratio');
});

test('Task 17: сетка — ровно 6 карточек в ряд на штатной карточке Lampa', () => {
  const grid = findDecl(css, (sel) => sel === '.lumen-grid');
  assert.ok(grid && /padding:2\.63em 3\.51em/.test(grid), 'safe area tvOS: 60 px сверху, 80 по бокам');
  const card = findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard');
  assert.ok(card, 'правило карточки сетки не найдено');
  assert.ok(card.indexOf('width:calc((100% - 4.4em) / 6)') !== -1, 'ширина = (100% − 5×.88em) / 6: ' + card);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard:nth-child(6n)'), 'у шестой карточки ряда нет правого отступа');
  /* Пропорцию 2:3 и позиционирование даёт штатный .card__view Lampa —
     свой распорки больше нет; наши правила только перекрашивают. */
  const view = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard .card__view');
  assert.ok(view && view.indexOf('border-radius:.31em') !== -1, 'радиус постера по design-spec §0.4');
});

/* Task 43: проверка фокуса карточки сетки переехала в блок Task 43 внизу —
   кольца там больше нет, и вместе с ним ушло то, что проверял этот тест. */

test('Task 17: полоса продолжения просмотра на карточке сетки', () => {
  const bar = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard__bar');
  assert.ok(bar, 'полоса прогресса не найдена');
  assert.ok(bar.indexOf('position:absolute') !== -1);
  const fill = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard__bar > div');
  assert.ok(fill && fill.indexOf('background:') !== -1, 'заливка полосы — акцент');
});

test('Task 17: иконка пункта меню — того же кегля, что у штатных пунктов', () => {
  const ico = findDecl(css, (sel) => sel === '.lumen-menu-hub .lumen-ico');
  assert.ok(ico, 'правило иконки пункта меню не найдено');
  assert.ok(ico.indexOf('width:1.5em') !== -1, 'штатные иконки меню Lampa — 1.5em: ' + ico);
});

/* Task 41: чип стал сегмент-контролом — тот же паттерн на хаб и сетку, но
   без рамки: в покое это просто ряд названий, выбранное лежит на подложке,
   фокус даёт инверсию. */
test('Task 41: чип — сегмент-контрол без рамки, выбранный виден без фокуса', () => {
  const chip = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip');
  assert.ok(chip, 'правило чипа не найдено');
  assert.equal(/(^|;)border:/.test(chip), false, 'рамки в покое быть не должно: ' + chip);
  /* Task 63: кегль чипа поднят до минимума tvOS, а коробка ужата в той же
     пропорции — высота pill'а на экране осталась прежней (2.2 × .92 = 2.02
     базовых em и 2.0 × 1.01 = 2.02). */
  assert.ok(chip.indexOf('height:2.0em') !== -1, 'высота pill: ' + chip);
  assert.ok(chip.indexOf('border-radius:1em') !== -1, 'радиус = половине высоты: ' + chip);
  assert.ok(chip.indexOf('background:transparent') !== -1, 'в покое — только текст: ' + chip);

  const on = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip.lumen-chip--on');
  assert.ok(on && on.indexOf('background:rgba(') !== -1, 'выбранный чип — светлая подложка: ' + on);

  const focus = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip.focus');
  assert.ok(focus, 'правило фокуса чипа не найдено');
  assert.ok(focus.indexOf('transform:scale(1.05)') !== -1, 'фокус — то же семейство, что у плитки: ' + focus);
  assert.ok(focus.indexOf('background:#') !== -1 && focus.indexOf('color:#') !== -1, 'фокус — инверсия цветов: ' + focus);

  /* Счётчик подборок с чипа убран вместе с узлом .lumen-chip__count. */
  assert.equal(css.indexOf('lumen-chip__count'), -1, 'правило снятого счётчика осталось в таблице');
});

/* Task 41: плитка хаба — баннер без рамки, название в одну строку, фокус
   только увеличением и тенью. */
test('Task 41: плитка хаба — баннер без рамки, заголовок в одну строку', () => {
  const tile = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile');
  assert.ok(tile, 'правило плитки не найдено');
  assert.equal(/(^|;)border:/.test(tile), false, 'рамки у плитки быть не должно: ' + tile);
  assert.ok(tile.indexOf('border-radius:.6em') !== -1, 'радиус плитки: ' + tile);

  const img = findDecl(css, (sel) => sel === '.lumen-hub .lumen-tile__img');
  assert.ok(img, 'правило кадра плитки не найдено');
  assert.ok(img.indexOf('object-fit:cover') !== -1, 'кадр обрезается по плитке: ' + img);
  assert.ok(img.indexOf('object-position:center 30%') !== -1, 'лица выше середины кадра: ' + img);
  assert.ok(img.indexOf('opacity:0') !== -1, 'до загрузки кадра не видно: ' + img);
  const filled = findDecl(css, (sel) => sel === '.lumen-hub .lumen-tile--filled .lumen-tile__img');
  assert.ok(filled && filled.indexOf('opacity:1') !== -1, 'загруженный кадр проявляется: ' + filled);

  const title = findDecl(css, (sel) => sel === '.lumen-hub .lumen-tile__title');
  assert.ok(title, 'правило заголовка плитки не найдено');
  assert.ok(title.indexOf('white-space:nowrap') !== -1 && title.indexOf('text-overflow:ellipsis') !== -1,
    'заголовок — одна строка с обрезкой: ' + title);

  const focus = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile.focus');
  assert.ok(focus, 'правило фокуса плитки не найдено');
  assert.equal(/border-color:/.test(focus), false, 'кольца фокуса на баннере быть не должно: ' + focus);
  assert.ok(focus.indexOf('transform:scale(1.05)') !== -1, 'фокус — увеличение: ' + focus);
  assert.ok(focus.indexOf('box-shadow') !== -1, 'и подложка (Task 50b — без размытия): ' + focus);
});

/* Task 54. Фокус кнопки или строки списка — инверсия: цвет текста темы
   становится заливкой, фон страницы — подписью. Так уже показывают фокус
   кнопки карточки (Task 43), чипы хаба, сетки, настроения и рулетки; теперь
   так же — все остальные кнопки плагина. Карточки с постером или превью
   (.lumen-fr-card, .lumen-review, .lumen-gcard, .lumen-tile) в список не
   входят: сплошная светлая заливка под картинкой ничего не покажет, у них
   фокус держится рамкой, увеличением и подложкой.
   Вторая половина проверки — про мёртвые правила: если фокус больше не
   красится акцентом, ни одного правила с акцентной заливкой или акцентной
   рамкой на том же селекторе остаться не должно (ошибка, которую ловили в
   Task 42/43 у кольца карточки и у чипа настроения). */
test('Task 54: фокус кнопок и строк списка — инверсия, и ни одного акцентного правила на тех же селекторах', () => {
  const k = tokensWith({});
  const INVERTED = [
    /* карточка фильма */
    '.lumen-card .full-start-new__buttons .full-start__button.focus',
    '.lumen-card .lumen-stop.focus',
    '.lumen-card .lumen-episode.focus',
    '.lumen-card .lumen-franchise.focus',
    /* ряд описания: отзывы и «Смотреть по порядку» */
    '.lumen-descr-row .lumen-reviews__hint-hide.focus',
    '.lumen-descr-row .lumen-reviews__mode.focus',
    '.lumen-review-modal__reveal.focus',
    '.lumen-descr-row .lumen-fr__mode.focus',
    /* хаб, сетка, чипы настроения */
    '.lumen-hub__search.focus',
    '.lumen-hub .lumen-chip.focus',
    '.lumen-grid .lumen-chip.focus',
    '.lumen-grid .lumen-grid__back.focus',
    '.lumen-mood-chip.focus',
    /* рулетка */
    '.lumen-roulette .lumen-roulette__tab.focus',
    '.lumen-roulette .lumen-roulette__chip.focus',
    '.lumen-roulette .lumen-roulette__btn.focus'
  ];
  const bodies = ruleBodies(css);
  for (const sel of INVERTED) {
    const own = bodies.filter((r) => r.selectors.indexOf(sel) !== -1);
    assert.ok(own.length, 'правил на ' + sel + ' не нашлось вовсе');
    assert.ok(own.some((r) => r.decl.indexOf('background:' + k.text + ';color:' + k.bg) !== -1),
      sel + ': фокус не инверсия — ' + own.map((r) => r.decl).join(' || '));
    for (const r of own) {
      assert.equal(new RegExp('background(-color)?:' + k.accent).test(r.decl), false,
        sel + ': мёртвая акцентная заливка — ' + r.decl);
      assert.equal(new RegExp('border-color:(' + k.accent + '|' + k.ring + ')').test(r.decl), false,
        sel + ': мёртвая акцентная рамка — ' + r.decl);
    }
  }
});

/* Ревью Task 54, находка 1. Инверсия меняет цвет карты под текстом, но
   наследование цвета от .lumen-episode.focus проигрывает ЛЮБОМУ явному
   объявлению у потомка, какой бы специфичности ни было правило родителя. У
   карточки серии такие объявления есть у пяти узлов (номер, подпись,
   «СМОТРИТЕ», таймкод и — у не вышедшей серии — само название), и стоит
   забыть один, как он останется приглушённым на светлой заливке.
   Проверка поэтому не по списку узлов: она находит в таблице ВСЕ правила,
   которые красят потомка .lumen-episode вне фокуса, и требует на тот же узел
   правило фокуса более высокой специфичности. Узлы, которые в фокусе скрыты
   (__check, __percent), из проверки исключаются по самому CSS, а не по
   списку. Второй половиной сверяется контраст того, что в фокусе получилось:
   заливка фокуса — P.text, значит цвет подписи обязан читаться на ней. */
test('Ревью Task 54: под инверсией фокуса у карточки серии не остаётся приглушённого текста', () => {
  /* Два вида селекторов: общее правило узла (.lumen-card .lumen-episode__num)
     и правило состояния карты (.lumen-card .lumen-episode--soon
     .lumen-episode__name, .lumen-card .lumen-episode.focus …). Правила
     сжатой шапки (.lumen-card.lumen-progress-on.lumen-compact …) сюда не
     попадают намеренно: они про display, а не про цвет, и их display:none у
     подписи действует только в сжатом состоянии. */
  const CHILD = /^\.lumen-card (\.lumen-episode(--[\w-]+)?(\.focus)? )?\.lumen-episode__[\w-]+$/;
  const child = (sel) => sel.slice(sel.lastIndexOf(' ') + 1);
  const classes = (sel) => (sel.match(/\./g) || []).length;

  for (const theme of ['warm', 'black']) {
    const table = withStorage({ lumen_theme: theme }, (LC) => LC.buildCss());
    const P = withStorage({ lumen_theme: theme }, (LC) => LC.tokens());
    const plain = [];
    const focused = [];
    const hidden = new Set();
    for (const r of ruleBodies(table)) {
      for (const sel of r.selectors) {
        if (!CHILD.test(sel)) continue;
        const isFocus = sel.indexOf('.focus') !== -1;
        if (isFocus && /(^|;)display:none/.test(r.decl)) hidden.add(child(sel));
        const color = /(^|;)color:(#[0-9A-Fa-f]{6})/.exec(r.decl);
        if (!color) continue;
        (isFocus ? focused : plain).push({ child: child(sel), n: classes(sel), color: color[2], sel });
      }
    }
    assert.ok(plain.length >= 4, theme + ': правил с цветом у потомков карточки серии нашлось подозрительно мало — ' + plain.length);
    /* Правка 2026-09-23 (п.3.1): номер серии и метка «СМОТРИТЕ» лежат на
       КАДРЕ, а не на заливке инверсии — кадр в фокусе больше не гаснет.
       Инверсия их не касается намеренно: тёмный текст на тёмном кадре
       исчез бы. Взамен сторож требует, чтобы вне фокуса они были светлыми
       (P.text) или акцентными — приглушённого текста на кадре быть не
       должно так же, как и на заливке. Всё остальное (название, подпись,
       таймкод) лежит на .__bottom, которому фокус подменяет градиент
       сплошным P.text, и там инверсия обязательна. */
    const OVER_STILL = ['.lumen-episode__num', '.lumen-episode__state'];
    for (const p of plain) {
      if (hidden.has(p.child)) continue;
      if (OVER_STILL.indexOf(p.child) !== -1) {
        assert.ok(p.color === P.text || p.color === P.accent,
          theme + ': ' + p.sel + ' красит узел над кадром приглушённым ' + p.color);
        continue;
      }
      assert.ok(focused.some((f) => f.child === p.child && f.n > p.n),
        theme + ': ' + p.sel + ' красит узел вне фокуса (' + p.color + '), а правила фокуса выше специфичностью на него нет — под инверсией цвет останется прежним');
    }
    for (const f of focused) {
      if (OVER_STILL.indexOf(f.child) !== -1) continue;
      const ratio = contrast(f.color, P.text);
      assert.ok(ratio >= 4.5, theme + ': ' + f.sel + ' — ' + f.color + ' на заливке фокуса ' + P.text + ' даёт ' + ratio.toFixed(2) + ':1');
    }
  }
});

/* Ревью Task 54, находка 2. Отметка «режим включён» у чипов стояла на
   акценте (правило --on, два класса), а правило фокуса — на трёх, и под
   фокусом акцентный цвет текста терялся. Волоска border-color rgba(A,.5) на
   .04em на светлой заливке не видно: контраст самого акцента на P.text —
   1.56. У отзывов переключатель одиночный, и «вкл/выкл» нужно читать ровно
   под пультом, поэтому у отмеченного состояния под фокусом свой признак. */
test('Ревью Task 54: отметка «режим включён» читается и под фокусом', () => {
  const P = tokensWith({});
  assert.ok(contrast(P.accent, P.text) < 3, 'акцент на заливке фокуса и правда не читается: ' + contrast(P.accent, P.text).toFixed(2));
  for (const chip of ['.lumen-descr-row .lumen-reviews__mode', '.lumen-descr-row .lumen-fr__mode']) {
    const decl = findDecl(css, (sel) => sel === chip + '--on.focus');
    assert.ok(decl, chip + ': у отмеченного состояния под фокусом нет своего правила');
    const mark = /(^|;)outline:[\d.]+em solid (#[0-9A-Fa-f]{6})/.exec(decl);
    assert.ok(mark, chip + ': признак отметки не найден — ' + decl);
    assert.ok(contrast(mark[2], P.text) >= 4.5, chip + ': признак ' + mark[2] + ' на заливке фокуса — ' + contrast(mark[2], P.text).toFixed(2) + ':1');
    /* Кольцо внутрь: рамка сдвинула бы содержимое чипа, outline лежит поверх. */
    assert.ok(/outline-offset:-[\d.]+em/.test(decl), chip + ': кольцо обязано быть внутренним — ' + decl);
    assert.equal(decl.indexOf(P.accent), -1, chip + ': акцент на светлой заливке не читается — ' + decl);
  }
});

test('Task 17: на слабых ТВ пружины фокуса в хабе и сетке нет', () => {
  for (const mode of ['lite', 'off']) {
    const tile = findDecl(css, (sel) => sel === '.lumen-hub.lumen-motion-' + mode + ' .lumen-tile.focus');
    assert.ok(tile, 'нет правила плиток для ' + mode);
    /* Task 41: без увеличения фокус на баннере держится контуром — иначе в
       этих режимах он не виден вовсе (тень на тёмном фоне не читается). */
    assert.ok(tile.indexOf('outline:') !== -1, mode + ': фокус плитки остался без признака: ' + tile);
    assert.ok(findDecl(css, (sel) => sel === '.lumen-grid.lumen-motion-' + mode + ' .lumen-gcard.focus'), 'нет правила карточек для ' + mode);
  }
});

/* ====================================================================== */
/* Настройка «Шрифт»: пять гарнитур, все с Google Fonts (CSP плагина      */
/* другого источника не пропустит).                                       */
/*                                                                        */
/* Task 43: за каждым ключом стоит ОДНА гарнитура, а не пара «текстовая + */
/* моноширинная», и заголовочной Unbounded поверх них больше нет. Ключи    */
/* при этом прежние: они уже записаны в Storage у тех, кто менял шрифт.    */
/* ====================================================================== */

const FONT_FACES = {
  golos: 'Golos Text',
  onest: 'Onest',
  manrope: 'Manrope',
  inter: 'Inter',
  plex: 'IBM Plex Sans'
};

test('настройка «Шрифт»: каждая гарнитура доезжает до LC.tokens', () => {
  for (const key of Object.keys(FONT_FACES)) {
    const t = withStorage({ lumen_font: key }, (LC) => LC.tokens());
    assert.ok(t.fontBody.indexOf('"' + FONT_FACES[key] + '"') === 0, key + ': выбранная гарнитура первой в стеке, было ' + t.fontBody);
    assert.ok(/sans-serif$/.test(t.fontBody), key + ': у стека обязан быть системный фолбэк');
  }
});

test('настройка «Шрифт»: незнакомое значение — как Golos Text; при выключенных шрифтах настройка не действует', () => {
  const junk = withStorage({ lumen_font: 'nope' }, (LC) => LC.tokens());
  assert.equal(junk.fontBody, withStorage({}, (LC) => LC.tokens()).fontBody);
  /* Ключ исчезнувшего набора из старого профиля — тот же случай: набора нет,
     падать нельзя, берётся значение по умолчанию. */
  assert.equal(withStorage({ lumen_font: 'mono' }, (LC) => LC.tokens()).fontBody, junk.fontBody);

  const off = withStorage({ lumen_font: 'inter', lumen_card_fonts: 'false' }, (LC) => LC.tokens());
  assert.equal(off.fontBody, 'inherit', 'шрифты выключены — системный стек, выбор гарнитуры не действует');
});

test('настройка «Шрифт»: адрес <link> собирается под выбранную гарнитуру и только с Google Fonts', () => {
  for (const key of Object.keys(FONT_FACES)) {
    const url = withStorage({ lumen_font: key }, (LC) => LC.fontsUrl());
    assert.ok(url.indexOf('https://fonts.googleapis.com/css2?') === 0, key + ': единственный разрешённый CSP источник, было ' + url);
    assert.ok(url.indexOf('family=' + FONT_FACES[key].replace(/ /g, '+') + ':') !== -1, key + ': нет выбранной гарнитуры');
    assert.ok(url.indexOf('display=swap') !== -1, key + ': нет display=swap');
    /* Чужие гарнитуры не грузятся — иначе каждая смена тянула бы все пять. */
    for (const other of Object.keys(FONT_FACES)) {
      if (FONT_FACES[other] === FONT_FACES[key]) continue;
      assert.equal(url.indexOf('family=' + FONT_FACES[other].replace(/ /g, '+') + ':'), -1,
        key + ': в наборе оказалась лишняя гарнитура ' + FONT_FACES[other]);
    }
  }
});

test('настройка «Шрифт»: выбранная гарнитура попадает в текст стилей карточки', () => {
  const inter = withStorage({ lumen_font: 'inter' }, (LC) => LC.buildCss());
  const descr = findDecl(inter, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(descr.indexOf('"Inter"') !== -1, 'описание рисуется выбранной гарнитурой');
  assert.equal(inter.indexOf('Golos Text'), -1, 'прежняя гарнитура не должна оставаться в стилях');
});

/* Task 43: моноширинного не осталось нигде — ни на метках, ни на цифрах.
   Колонок, которые надо выравнивать по разряду, в плагине нет: таймкод и
   проценты стоят в строке текста, а не друг под другом. */
test('Task 43: и метки, и цифры набраны одной гарнитурой', () => {
  for (const sel of [
    '.lumen-card .lumen-meta',
    '.lumen-card .lumen-quality-chip',
    '.lumen-card .lumen-trailer-badge',
    '.lumen-descr-row .lumen-facts__title',
    '.lumen-descr-row .lumen-reviews__src',
    '.lumen-card .full-start__rate',
    '.lumen-card .lumen-progress',
    '.lumen-card .lumen-episode__timecode',
    '.lumen-descr-row .lumen-reviews__total'
  ]) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf('"Golos Text"') !== -1, sel + ' — основная гарнитура: ' + decl);
  }
});

/* -------------------------------------------------------------------- */
/* Task 18: герой главной (design-spec-main §0.2, экраны 15–19).          */
/* -------------------------------------------------------------------- */

test('Task 36: герой — две трети экрана, сжатие сдвигом на 16.67vh', () => {
  const hero = findDecl(css, (sel) => sel === '.lumen-hero');
  assert.ok(hero, 'корень героя не найден');
  /* Пользователь на живом телевизоре (2026-09-18): «картинка очень
     маленькая, надо намного больше, половина экрана, если не больше».
     Крупный размер — 66.67vh в старте и 50vh в сжатом. Высота у кадра ОДНА
     на оба состояния: меняется только сдвиг, поэтому переход не трогает
     раскладку. */
  assert.ok(hero.indexOf('height:66.67vh') !== -1, 'кадр занимает две трети экрана: ' + hero);
  assert.ok(hero.indexOf('position:absolute') !== -1, 'герой не участвует в потоке рядов');
  assert.ok(hero.indexOf('top:-4em') !== -1, 'кадр доходит до верхней кромки под шапкой Lampa (4em)');
  assert.ok(hero.indexOf('pointer-events:none') !== -1, 'герой не перехватывает указатель — он не фокусируется');
  assert.ok(hero.indexOf('transform:translateY(0)') !== -1, 'без стартового значения первый переход прыгнул бы: ' + hero);
  assert.equal(/inset\s*:/.test(hero), false, 'inset запрещён планом');
  assert.equal(/height\s*:\s*calc/.test(hero), false, 'высота кадра больше не считается от высоты ряда: ' + hero);

  const compact = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact');
  assert.ok(compact && compact.indexOf('transform:translateY(-16.67vh)') !== -1, 'сжатие — сдвиг 66.67 → 50vh: ' + compact);
  assert.ok(compact.indexOf('-webkit-transform:translateY(-16.67vh)') !== -1, 'старым webkit-движкам нужен префикс');
  assert.equal(/height|margin|bottom|width/.test(compact), false, 'в сжатом состоянии не меняется ни одно свойство раскладки: ' + compact);
});

/* Task 36: аудит фазы 4 нашёл пять одновременных layout-анимаций на переходе
   «первый ряд ↔ остальные». Внешний ресёрч по Android TV
   (docs/research/2026-09-18-android-tv-animations.md) однозначен: в анимациях
   допустимы только transform и opacity. Тест закрывает весь герой, область
   рядов, текст, логотип и чипы разом — новое правило с transition на height
   или bottom мимо него не пройдёт. */
test('Task 36: в переходах героя и рядов — только transform и opacity', () => {
  const banned = /\b(height|margin-top|margin|bottom|width|font-size|top|left|right|padding)\b/;
  const watched = (sel) => /\.lumen-hero|\.lumen-main|\.lumen-moods|\.lumen-mood-chip/.test(sel);
  for (const rule of ruleBodies(css)) {
    if (!rule.selectors.some(watched)) continue;
    const hit = /transition:([^;}]*)/.exec(rule.decl);
    if (!hit) continue;
    assert.equal(banned.test(hit[1]), false, rule.selectors.join(',') + ' анимирует раскладку: ' + hit[1]);
  }
});

/* Правка пользователя 2026-09-17 (второй круг, главное): «когда начинаем
   листать список фильмов, ряды должны быть подняты». Сжатие кадра и подъём
   рядов — одно движение: класс .lumen-rows-up ставит LC.hero там же, где
   .lumen-hero--compact. */
test('правка: сжатый герой отдаёт высоту рядам — пустой зоны под кадром нет', () => {
  /* Task 36: место рядам передаётся не ростом области, а снятием стартового
     сдвига. Раскладка области при этом не меняется вовсе — margin-top и
     height живут только в базовом правиле. */
  const rows = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  /* Task 51: сдвиг старта убавлен с 8vh до 5.5vh — в старте подпись первого
     ряда уходила за кромку экрана на 46 px, теперь стоит ровно на ней
     (замеры — в тесте «Task 51: подпись первого ряда…» ниже). */
  assert.ok(rows.indexOf('transform:translateY(5.5vh)') !== -1, 'в старте ряды не опущены: ' + rows);
  const up = findDecl(css, (sel) => sel === '.lumen-main.lumen-rows-up .scroll.layer--wheight');
  assert.ok(up, 'правила поднятых рядов нет');
  /* Task 46: рядом с translateY стоит translateZ(0) — признак собственного
     слоя (см. отдельный тест ниже). Свойство по-прежнему ровно одно. */
  assert.equal(up, '-webkit-transform:translateY(0) translateZ(0);transform:translateY(0) translateZ(0)', 'подъём рядов — только transform: ' + up);

  /* Переход плавный только в full: класс режима стоит на герое, а он —
     сосед .activity__body, отсюда соседний комбинатор. Кривая и время те же,
     что у кадра, иначе в середине перехода появилась бы щель. */
  const move = findDecl(css, (sel) => sel === '.lumen-main .lumen-hero.lumen-motion-full ~ .activity__body .scroll.layer--wheight');
  assert.ok(move, 'перехода области рядов нет');
  assert.ok(move.indexOf('transition:transform .42s cubic-bezier(.2,.8,.2,1)') !== -1, 'кривая и время не совпадают с кадром: ' + move);
  const heroMotion = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full');
  assert.ok(heroMotion.indexOf('transition:transform .42s cubic-bezier(.2,.8,.2,1)') !== -1, 'кадр анимируется иначе: ' + heroMotion);
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-rows-up') !== -1 && sel.indexOf('motion') !== -1).length, 0,
    'в lite/off подъём обязан быть мгновенным — своего перехода у правила нет');

  /* На низком окне кадра нет, и поднимать нечего: правило подъёма обязано
     быть перебито там же, где обычное (иначе оно выиграло бы по
     специфичности — три класса против двух). */
  const low = heroOffMedia(css);
  assert.ok(low.indexOf('.lumen-main .scroll.layer--wheight,.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:0') !== -1, 'подъём не отменён на низком окне: ' + low);
  assert.ok(/\.lumen-rows-up \.scroll\.layer--wheight\{margin-top:0[^}]*transform:none/.test(low), 'стартовый сдвиг на низком окне не снят: ' + low);
});

/* Task 46. Пользователь на Philips 50PUS8057 2026-09-18: «когда листаешь,
   остаётся шлейф некрасивый» — под нижней кромкой кадра героя оставались
   куски того, что было на этом месте до перехода.

   Движущихся элемента в переходе ровно два: кадр героя и область рядов.
   Blink заводит им composited-слой на время анимации transform и сливает его
   обратно по её окончании; артефакт лежит как раз в освобождённой полосе,
   то есть похож на пропущенную инвалидацию на этой границе. Постоянный слой
   (translateZ(0)) границу убирает.

   Тест сторожит две вещи сразу: признак слоя есть у обоих элементов в обоих
   состояниях — и НЕ появился больше нигде. Второе важнее первого: следующая
   задача, раздав translateZ или will-change ещё паре узлов, переполнит
   бюджет слоёв слабого ТВ (10-15 по docs/research/2026-09-18-android-tv-
   animations.md §3, по 8 МБ GPU-памяти на полноэкранный слой). */
test('Task 46: у обоих движущихся элементов свой слой, и больше ни у кого', () => {
  const layered = [
    '.lumen-hero',
    '.lumen-hero.lumen-hero--compact',
    '.lumen-main .scroll.layer--wheight',
    '.lumen-main.lumen-rows-up .scroll.layer--wheight'
  ];
  for (const sel of layered) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило ' + sel + ' не найдено');
    assert.ok(decl.indexOf('transform:translateY') !== -1, sel + ': геометрия по-прежнему translateY: ' + decl);
    assert.ok(/[^-]transform:translateY\([^)]*\) translateZ\(0\)/.test(decl), sel + ': нет признака собственного слоя: ' + decl);
    assert.ok(/-webkit-transform:translateY\([^)]*\) translateZ\(0\)/.test(decl), sel + ': старым webkit-движкам нужен префикс: ' + decl);
  }

  /* backface-visibility — известный приём против остаточных артефактов и
     мерцания при 3D-трансформациях на Android WebView. Достаточно базового
     правила каждого элемента: свойство наследуемым не является, но и не
     сбрасывается правилом состояния, которое трогает только transform. */
  for (const sel of ['.lumen-hero', '.lumen-main .scroll.layer--wheight']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl.indexOf('-webkit-backface-visibility:hidden') !== -1, sel + ': нужна префиксная запись: ' + decl);
    assert.ok(/[^-]backface-visibility:hidden/.test(decl), sel + ': нужна и беспрефиксная: ' + decl);
  }

  /* Слоёв ровно два, а не четыре: правила состояний — те же два элемента. */
  const withLayer = ruleBodies(css).filter((r) => /translateZ\(0\)/.test(r.decl));
  assert.deepEqual(withLayer.map((r) => r.selectors.join(',')).sort(), layered.slice().sort(),
    'принудительный слой появился у постороннего узла');

  /* will-change ВЫДАЁТ слой ровно в одном месте — на слое перехода между
     экранами (.lumen-overlay__img): он живёт столько же, сколько сам узел
     перехода, и постоянным слоем не становится. Второе правило (Task 48)
     слой, наоборот, СНИМАЕТ — will-change:auto поверх .card Lampa. */
  const willChange = ruleBodies(css).filter((r) => /will-change/.test(r.decl));
  assert.deepEqual(willChange.map((r) => r.selectors.join(',')), ['.lumen-main .card', '.lumen-overlay .lumen-overlay__img'],
    'will-change расползся по новым правилам: ' + willChange.map((r) => r.selectors.join(',')).join(' | '));
  assert.ok(willChange.every((r) => r.selectors[0] === '.lumen-overlay .lumen-overlay__img' || /will-change:auto/.test(r.decl)),
    'кроме слоя перехода, will-change разрешён только со значением auto');
});

/* Task 48. Три composited-слоя на КАЖДУЮ карточку выдаёт сама Lampa:
   .card{will-change:transform} (vendor/lampa/css/app.css:3095-3101),
   .card__title{transform:translateZ(0)} (там же:3155-3168) и
   .card__age{transform:translateZ(0)} (там же:3170-3176). Замеры
   координатора на стенде 2026-09-21 (960×540@2, раздел «Что известно
   точно» в docs/plans/2026-09-21-lumen-phase5-tv-fix.md): до правки — 138
   узлов-кандидатов в слои, после — 53. Бюджет tile memory Chromium на
   Android с памятью меньше 2000 МиБ — 96 МБ
   (docs/research/2026-09-21-webview-perf.md §1.1), и слои считаются
   байтами, а не штуками (§2.1). */
test('Task 48: слои, которые Lampa выдаёт карточкам, на главной сняты', () => {
  const rules = ruleBodies(css);
  const cards = rules.filter((r) => r.selectors.join(',') === '.lumen-main .card');
  assert.ok(cards.some((r) => r.decl.indexOf('will-change:auto') !== -1),
    'слой карточки не снят: ' + cards.map((r) => r.decl).join(' | '));

  const labelsAt = rules.findIndex((r) => r.selectors.join(',') === '.lumen-main .card__title,.lumen-main .card__age');
  assert.ok(labelsAt !== -1, 'нет правила, снимающего translateZ(0) с подписей карточки');
  const labels = rules[labelsAt].decl;
  assert.ok(/[^-]transform:none/.test(labels), 'нужна беспрефиксная запись: ' + labels);
  assert.ok(labels.indexOf('-webkit-transform:none') !== -1, 'старым webkit-движкам нужен префикс: ' + labels);

  /* Правило обязано стоять ПОСЛЕ любого нашего правила с transform на тех же
     узлах: специфичность у них одинаковая, решает порядок. */
  const before = rules.filter((r, i) => i > labelsAt
    && /transform:/.test(r.decl)
    && r.selectors.some((s) => /card__title|card__age/.test(s)));
  assert.deepEqual(before.map((r) => r.selectors.join(',')), [],
    'наше правило с transform на подписи стоит ПОСЛЕ снятия слоя и перебьёт его');
});

/* Task 49. Штатный фон Lampa — один узел .background с тремя канвасами
   внутри (vendor/lampa/app.min.js:31225: <div class="background"> с
   .background__one/two/fade). Сам .background — position:fixed на весь
   экран с will-change:opacity (vendor/lampa/css/app.css:2320-2331), у трёх
   канвасов внутри то же самое (там же:2332-2344): четыре промоутнутых
   полноэкранных слоя, из них рисуемых поверхностей три — у корня в правиле
   только opacity, transition и will-change, своего содержимого нет. Замер
   координатора на стенде 2026-09-21 (960×540@2): полноэкранных слоёв на
   главной было 9, стало 5. Цена слоя — оценка, а не замер: 8.29 МБ на
   полноэкранный при бюджете tile memory 96 МБ
   (docs/research/2026-09-21-webview-perf.md §1.1). Под нашей главной фона
   не видно вовсе — верхние 2/3 экрана закрывает кадр героя, остальное
   залито P.bg (.lumen-main{background-color}). Гасим корень: display:none
   на предке убирает из дерева блоков и потомков, поэтому трёх отдельных
   правил на канвасы не нужно; сама Lampa гасит фон так же —
   body.light--version .background{display:none} (app.css:15959-15961). */
test('Task 49: под нашей главной штатный фон Lampa не рисуется', () => {
  const decl = findDecl(css, (sel) => sel === 'body.lumen-main-on:not(.ambience--enable) .background');
  assert.ok(decl, 'нет правила, гасящего фон Lampa под главной плагина');
  assert.equal(decl, 'display:none', 'гасим целиком и ничем больше: ' + decl);
  /* Волна 2 (ТВ 2026-09-24, D1): под карточкой фильма — тоже. Размытый
     постер Lampa (Color.blur + fadeTo 700 мс, app.min.js:38989) проступал
     при открытии карточки, пока наш кадр не ложился сверху, — «картинка
     расползается» на фото 5/7/11. Метку lumen-card-on ставит рантайм на
     старте экрана 'full' (src/90_runtime.js). */
  const card = findDecl(css, (sel) => sel === 'body.lumen-card-on:not(.ambience--enable) .background');
  assert.ok(card, 'нет правила, гасящего фон Lampa под карточкой плагина');
  assert.equal(card, 'display:none', 'гасим целиком и ничем больше: ' + card);
  /* Ревью волны 2, п.9: поиск, SearchInput и «Расширения» ставят на body
     ambience--enable — Lampa прячет .wrap и .head (app.css:397-402), а
     .search прозрачный: под ними виден только её фон, размытый постер.
     Погашенный фон давал вместо него плоскую заливку body. Ни одно наше
     правило, гасящее .background, не должно действовать при
     ambience--enable. */
  const hiding = ruleBodies(css).filter((r) => /display:none/.test(r.decl) &&
    r.selectors.some((s) => /(^|\s)\.background$/.test(s)));
  assert.ok(hiding.length > 0, 'правила, гасящие фон, не найдены');
  for (const r of hiding) {
    for (const s of r.selectors) {
      if (!/(^|\s)\.background$/.test(s)) continue;
      assert.ok(/:not\(\.ambience--enable\)/.test(s), 'фон гасится и под поиском/«Расширениями»: ' + s);
    }
  }
  /* Отдельных правил на канвасы быть не должно — это мёртвые правила:
     потомков погашенного предка браузер не рисует. */
  const extra = ruleBodies(css).filter((r) => r.selectors.some((s) => /\.background__/.test(s)));
  assert.deepEqual(extra.map((r) => r.selectors.join(',')), [],
    'канвасы внутри .background гасить отдельно нечем — правило станет мёртвым');
});

/* Волна 2 (ТВ 2026-09-24, D2): кадр карточки встаёт сразу, без проявления
   0.5 с. Вместе с размытым фоном Lampa под ним проявление и было тем
   «эффектом открытия», который пользователь просил убрать. Смена кадров
   слайдшоу — отдельное правило на .lumen-bg__img, его это не касается. */
test('D2: слой кадра карточки без transition проявления', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-backdrop');
  assert.ok(decl, 'нет базового правила .lumen-backdrop');
  assert.ok(!/transition/.test(decl), 'кадр карточки проявляется анимацией: ' + decl);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-backdrop.loaded'), 'opacity:1');
});

/* Task 50. Акцент под постером в фокусе был тенью с размытием .7em — это
   16 физических px на растре 1080p, и перерисовывать их приходилось дважды
   на каждый шаг: у уходящей карточки и у приходящей. box-shadow — свойство
   стадии Paint (docs/research/2026-09-18-android-tv-animations.md:10);
   порог «радиус > 20 px» (там же:20) наши 16 px не перешагивают, да и
   относится он к анимации, а наша тень статична — решение принято по
   замеру 21 fps на Philips 50PUS8057 («Что известно точно» в
   docs/plans/2026-09-21-lumen-phase5-tv-fix.md). Заменена плоской
   подложкой: смещение остаётся, радиус — ноль, перерисовывается ровно
   прямоугольник.
   Правило одно на два места: строку строит accentRules (src/30_css.js), а
   берут её и общая таблица, и отдельный узел подкраски <style
   id="lumen-accent"> (LC.accentCss, его переписывает LC.accent при смене
   доминанты — src/57_color.js:676-722). Тест сверяет их посимвольно: узел
   стоит ПОСЛЕ таблицы и при равной специфичности побеждает, так что
   разъехавшаяся форма означала бы разный фокус до и после подкраски. */
test('Task 50: подложка фокуса карточки без размытия, и узел подкраски совпадает с таблицей', () => {
  const rule = ruleBodies(css).find((r) => r.selectors.join(',') === '.lumen-main .card.focus .card__view'
    && r.decl.indexOf('box-shadow') !== -1);
  assert.ok(rule, 'правило подложки фокуса не найдено');
  assert.ok(rule.decl.indexOf('box-shadow:0 .2em 0 ') !== -1, 'размытие обязано быть нулевым: ' + rule.decl);
  assert.ok(rule.decl.indexOf('-webkit-box-shadow:0 .2em 0 ') !== -1, 'старым webkit-движкам нужен префикс: ' + rule.decl);

  /* Task 60 (ревью): правило фокуса переехало из горячего узла подкраски в
     свой, 'lumen-accent-focus' — на шагах перехода цвета оно не меняется, и
     переписывать его шестнадцать раз значило бы каждый раз заставлять
     движок заново оценивать самый дорогой селектор набора. Сверка с общей
     таблицей от этого не меняется: текст по-прежнему один (accentRules). */
  const accentRule = withStorage({}, (LC) => LC.accentFocusCss());
  assert.ok(accentRule.indexOf('.lumen-main .card.focus .card__view{') === 0,
    'узел подсветки перестал нести правило фокуса карточки: ' + accentRule);
  assert.ok(withStorage({}, (LC) => LC.accentCss()).indexOf('.card.focus') === -1,
    'правило фокуса осталось в горячем узле подкраски');
  assert.ok(css.split('\n').indexOf(accentRule) !== -1,
    'узел подкраски и общая таблица разошлись формой правила: ' + accentRule);
});

/* Task 50b/50c. Тот же шаг D-pad-фокуса на остальных экранах плагина.
   Сначала проверка покрывала три корня — главную, сетку подборки
   (.lumen-grid, увеличение там стоит на всей .lumen-gcard, то есть площадь
   перерисовки ещё больше) и плитки хаба; замер координатора на стенде после
   Task 50b нашёл ещё тринадцать размытых теней на фокусе в других корнях
   (карточка фильма, ряд отзывов, ряд франшизы, рулетка, путь TorrServer).
   Список корней убран совсем: проверяются ВСЕ правила таблицы, у которых в
   селекторе стоит .focus или .hover. Новое правило с размытой тенью на шаге
   фокуса обязано упереться в этот тест, где бы его ни написали.
   Экраны пути TorrServer живут в отдельной таблице (src/65_torrents.js) —
   у них своя копия этой проверки в test/torrents.test.mjs. */
test('Task 50c: ни одной тени с размытием ни на одном правиле фокуса', () => {
  const shadows = [];
  for (const r of ruleBodies(css)) {
    if (!r.selectors.some((s) => /\.focus\b|\.hover\b/.test(s))) continue;
    for (const m of r.decl.matchAll(/box-shadow:([^;}]+)/g)) shadows.push(r.selectors.join(',') + ' -> ' + m[1]);
  }
  /* Одиннадцать правил с тенью — кнопка карточки, «Стоп», серия, отзыв,
     постер части франшизы, «Вся франшиза», плитка хаба, карточка сетки,
     «Крутить» и кнопка рулетки, карточка главной; каждое удвоено префиксом. */
  assert.ok(shadows.length >= 20, 'теней на правилах фокуса нашлось подозрительно мало — проверка почти пустая: ' + shadows.length);
  assert.deepEqual(shadows.filter((s) => !/-> 0 [\d.]+em 0 /.test(s)), [],
    'тень с ненулевым размытием на шаге фокуса');
});

/* Правка пользователя 2026-09-17 (второй круг, п.1): «а может текст вниз
   спустить, чтобы не перекрывало картинку?» */
test('правка: текст героя прижат к низу кадра и стоит по safe area', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__text');
  assert.ok(text.indexOf('-webkit-box-pack:end') !== -1, 'содержимое не прижато к нижней кромке: ' + text);
  assert.ok(text.indexOf('overflow:hidden') !== -1, 'блок обязан срезать лишнее сам: ' + text);
  /* Кегль содержимого: +10 % (просьба пользователя «больше текст на 10 %»).
     Собственные отступы блока в em делятся на его же кегль — em у left/top
     считается от font-size самого элемента, и без деления текст уехал бы
     вправо от safe area (замер живьём: 71 px вместо 64 px). Отступ снизу
     теперь в vh и делению не подлежит: доля экрана к кеглю не привязана. */
  const num = (decl, name, unit) => parseFloat(new RegExp(name + ':([0-9.]+)' + unit).exec(decl)[1]);
  const zoom = num(text, 'font-size', 'em');
  assert.equal(zoom, 1.1, 'кегль текста героя не поднят: ' + text);
  /* Ревью фикс-раунда (п.3): рамка блока — от левой кромки кадра до правой
     и от безопасной зоны до низа кадра, а содержимое стоит на отступах.
     Safe area слева — padding-left; отступ снизу — padding-bottom в vh.
     Волна 3: запаса рамки за левую кромку (под подушку-вуаль) больше нет —
     left:0. */
  const padL = parseFloat(/(^|;)padding:0 0 [0-9.]+vh ([0-9.]+)em/.exec(text)[2]);
  assert.ok(/(^|;)left:0;/.test(text), 'рамка блока заходит за кромку кадра — вуали в блоке больше нет: ' + text);
  assert.ok(Math.abs(padL * zoom - 3.51) < 0.02, 'Task 63: safe area слева — 80 px tvOS = 3.51em: ' + text);
  assert.ok(/(^|;)right:0;/.test(text) && /(^|;)bottom:0;/.test(text), 'рамка блока обязана доходить до правой и нижней кромки кадра: ' + text);
  /* Ширина содержимого — 36em своего кегля (волна 3: было 46; правый край
     текста обязан остаться там, где левое затемнение ещё плотное): справа
     отступ «кадр минус левый отступ минус 36em». */
  const padR = parseFloat(/[^-]padding-right:calc\(100% - ([0-9.]+)em\)/.exec(text)[1]);
  assert.ok(Math.abs(padR - (padL + 36)) < 0.01, 'ширина содержимого текста героя уехала от 36em: ' + text);
  assert.ok((padR * zoom * 960 / 84.17) / 960 <= 0.52, 'правый край текста дальше 52 % ширины — левое затемнение там уже не держит мету: ' + padR);
  /* Сверху — безопасная зона под шапкой Lampa: без неё высокое содержимое
     налезало на заголовок активности и иконки (находка пользователя). */
  assert.ok(Math.abs(num(text, 'top', 'em') * zoom - 4.4) < 0.02, 'нет безопасной зоны под шапкой Lampa: ' + text);
  /* Крупный кадр: низ текста на 66.67 − 12.5 = 54.17vh, то есть на 1.33vh
     выше заголовка первого ряда в старте (он стоит на 55.5vh).
     Task 51: было 10vh при сдвиге рядов 8vh — отступ считается ОТ ВЕРХА
     ПЕРВОГО РЯДА (textBottomVh в src/30_css.js), и убавленный на 2.5vh сдвиг
     ровно на столько же поднял текст. Зазор между ними — прежние 1.33vh. */
  assert.equal(parseFloat(/(^|;)padding:0 0 ([0-9.]+)vh/.exec(text)[2]), 12.5, 'отступ текста снизу считается от верха первого ряда: ' + text);
  /* Сжатое состояние — только transform: ни кегль, ни отступы не меняются,
     поэтому блок физически не может съехать вбок на переходе.
     Ревью Task 36 (В1): в сдвиг входит высота полосы чипов — она гаснет
     через visibility и место в потоке сохраняет, так что без добавки низ
     ВИДИМОГО содержимого встал бы на 88 px выше расчётного. */
  /* Task 51: сдвиг сжатия вырос с 6.6 до 9.1vh ровно на те же 2.5vh, на
     которые убавлен ROWS_SHIFT_VH, — и это не совпадение, а тождество:
     textShiftVh = heroShiftVh − ROWS_SHIFT_VH + TEXT_AIR_VH − TEXT_EDGE_VH
     (src/30_css.js). Низ текста в СЖАТОМ состоянии остался ровно там же, где
     был (46.6vh от верха экрана при крупном кадре): подняв текст в старте,
     правка на столько же удлинила его путь вниз. */
  /* Ревью фикс-раунда (п.2) добавлял полосу чипов в сдвиг под
     .lumen-moods-on. Волна 3 чипы из героя убрала: сдвиг один — чистые vh,
     и правила под .lumen-moods-on у текста героя больше нет. */
  const bare = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__text');
  assert.ok(/[^-]transform:translateY\(9\.1vh\) scale\(0\.95\)/.test(bare), 'сжатие текста: ' + bare);
  assert.ok(bare.indexOf('-webkit-transform:translateY(9.1vh) scale(0.95)') !== -1, 'префиксная пара: ' + bare);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-moods-on .lumen-hero.lumen-hero--compact .lumen-hero__text'), null,
    'сдвиг на полосу чипов остался — чипов в герое нет');
  /* Точка масштаба — левый нижний угол СОДЕРЖИМОГО: от рамки это
     padding-left вправо и padding-bottom вверх. */
  assert.ok(text.indexOf('transform-origin:' + padL + 'em calc(100% - 12.5vh)') !== -1,
    'без origin у левого нижнего угла содержимого scale увёл бы текст от safe area: ' + text);
  assert.ok(text.indexOf('-webkit-transform-origin:' + padL + 'em -webkit-calc(100% - 12.5vh)') !== -1, 'префиксная пара origin: ' + text);

  /* Та же вертикаль у заголовка ряда — пользователь сверяет их по линии. */
  const head = findDecl(css, (sel) => sel === '.lumen-main .items-line__head');
  assert.ok(head.indexOf('padding-left:3.51em') !== -1, 'заголовок ряда не выровнен по safe area: ' + head);
  const content = findDecl(css, (sel) => sel === '.lumen-main .items-line .scroll__content');
  assert.ok(content.indexOf('padding-left:3.51em') !== -1, 'лента карточек не выровнена по safe area: ' + content);

  /* Волна 3 (ТВ 2026-09-24, решение координатора): чипов настроения в
     герое нет — ни слота в его тексте, ни своего места под корнем главной
     (при живом кадре LC.moods их не ставит, src/49_moods.js). Правила полосы
     остались только для главной БЕЗ кадра — под .lumen-moods-on:not(.lumen-main). */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .lumen-moods'), null, 'при живом кадре отдельного места под полосу чипов не отмеряется');
  assert.deepEqual(ruleSelectors(css).filter((sel) => sel.indexOf('lumen-hero__moods') !== -1), [], 'в тексте героя остались правила чипов');
  assert.deepEqual(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-moods-on') !== -1 && sel.indexOf(':not(.lumen-main)') === -1), [],
    'правила полосы чипов для главной с кадром — мёртвые: там чипов нет');
});

/* Замер пользователя на живой вкладке 1153×798 (фаза 3): полоса чипов висела
   ровно на стыке кадра и рядов и заходила на обе стороны («а почему это
   съехало???»). С тех пор раскладка проверяется целиком, а не по правилам
   поодиночке.

   Task 36: считать стало проще — все величины выражены в долях экрана и в em,
   поэтому тест переводит их в пиксели ЖИВОГО телевизора (1920×1080, база
   кегля Lampa 1920/84.17 = 22.811) и сверяет расстояния между блоками.

   Волна 3 (ТВ 2026-09-24): полосы чипов в тексте героя нет, и низ видимого
   содержимого в сжатом состоянии — низ самого блока (до волны полоса гасла
   visibility и место сохраняла, ревью Task 36, находка В1). */
test('раскладка героя: кадр, текст и ряды не пересекаются ни при одном размере', () => {
  const EM = 1920 / 84.17;
  const VH = 1080 / 100;
  const AIR = 1.5;          // ROWS_AIR: воздух над заголовком первого ряда
  const LAMPA_PAD = 2.5;    // .scroll--mask .scroll__content{padding:2.5em 0}

  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
    const decl = (name) => ruleBodies(built).find(only(name)).decl;
    const label = size;

    const heroH = parseFloat(/height:([0-9.]+)vh/.exec(decl('.lumen-hero'))[1]) * VH;
    const heroShift = parseFloat(/transform:translateY\(-([0-9.]+)vh\)/.exec(decl('.lumen-hero.lumen-hero--compact'))[1]) * VH;
    const textDecl = decl('.lumen-hero .lumen-hero__text');
    /* Отступ содержимого снизу — padding-bottom рамки блока: рамка доходит
       до низа кадра (ревью фикс-раунда п.3). */
    const textBottom = parseFloat(/(^|;)padding:0 0 ([0-9.]+)vh/.exec(textDecl)[2]) * VH;
    /* Волна 3: полосы чипов настроения в тексте героя нет — сжатие одно,
       без добавки на полосу, и низ видимого содержимого — низ блока. */
    const compactText = decl('.lumen-hero.lumen-hero--compact .lumen-hero__text');
    const shiftParts = /[^-]transform:translateY\(([0-9.]+)vh\) scale\(([0-9.]+)\)/.exec(compactText);
    const textShift = parseFloat(shiftParts[1]) * VH;
    const rowsDecl = decl('.lumen-main .scroll.layer--wheight');
    const rowsMargin = /margin-top:calc\(([0-9.]+)vh - ([0-9.]+)em\)/.exec(rowsDecl);
    const rowsHeight = /height:calc\(([0-9.]+)vh \+ ([0-9.]+)em\) !important/.exec(rowsDecl);
    const rowsShift = parseFloat(/transform:translateY\(([0-9.]+)vh\)/.exec(rowsDecl)[1]) * VH;

    /* Верх области = шапка Lampa (4em) + её отступ; заголовок ряда стоит на
       LAMPA_PAD ниже верха области — этот отступ Lampa держит сама. */
    const areaTop = 4 * EM + (parseFloat(rowsMargin[1]) * VH - parseFloat(rowsMargin[2]) * EM);
    const rowHeadUp = areaTop + LAMPA_PAD * EM;          // сжатое состояние
    const rowHeadDown = rowHeadUp + rowsShift;            // стартовое состояние
    const heroEdgeDown = heroH;                           // низ кадра в старте
    const heroEdgeUp = heroH - heroShift;                 // низ кадра в сжатом
    const textEdgeDown = heroH - textBottom;              // низ текста в старте
    const textEdgeUp = textEdgeDown - heroShift + textShift;

    /* Низ области ровно на кромке экрана: отступ и высота согласованы. */
    const areaBottom = areaTop + (parseFloat(rowsHeight[1]) * VH + parseFloat(rowsHeight[2]) * EM);
    assert.ok(Math.abs(areaBottom - 1080) < 1, label + ': низ области рядов ' + areaBottom + ' вместо кромки экрана');

    /* Воздух над заголовком ряда в СЖАТОМ состоянии — ровно ROWS_AIR: там
       кадр и ряд стоят вплотную друг к другу, и этот зазор пользователь
       мерил глазом («слишком близко к границе»). */
    assert.ok(Math.abs((rowHeadUp - heroEdgeUp) - AIR * EM) < 1,
      label + ': воздух над заголовком ряда в сжатом ' + (rowHeadUp - heroEdgeUp));

    /* В СТАРТЕ ряд выглядывает снизу и заходит под нижнюю часть кадра — это
       задумано (там вуаль уже вышла в сплошной фон). Проверяем, что заходит
       он не выше, чем на ROWS_SHIFT_VH, и что низ текста остаётся ВЫШЕ
       заголовка ряда: иначе название фильма легло бы на «Сейчас смотрят». */
    assert.ok(rowHeadDown > textEdgeDown, label + ': текст налезает на заголовок ряда (' + textEdgeDown + ' против ' + rowHeadDown + ')');
    assert.ok(rowHeadDown - textEdgeDown > 10, label + ': текст лип к заголовку ряда (' + (rowHeadDown - textEdgeDown) + ' px)');
    assert.ok(rowHeadDown - heroEdgeDown < AIR * EM, label + ': в старте между кромкой кадра и рядом зияет пустота (' + (rowHeadDown - heroEdgeDown) + ' px)');

    /* В сжатом состоянии зазор от низа текста до кромки кадра — TEXT_EDGE_VH
       (3.4vh = 37 px при 1080): его пользователь видит как «текст над кромкой
       кадра». До волны 3 здесь считался низ ВИДИМОГО содержимого отдельно от
       низа блока — полоса чипов гасла visibility и место сохраняла (ревью
       Task 36, находка В1); чипов в герое больше нет, и это одно и то же. */
    assert.ok(textEdgeUp < heroEdgeUp, label + ': текст в сжатом свисает с кромки кадра (' + textEdgeUp + ' против ' + heroEdgeUp + ')');
    assert.ok(Math.abs((heroEdgeUp - textEdgeUp) - 3.4 * VH) < 0.5,
      label + ': зазор от текста до кромки кадра ' + (heroEdgeUp - textEdgeUp).toFixed(1) + ' px вместо 36.7');

    /* И ряд в поднятом состоянии помещается в экран целиком — вместе с
       подписями под постером.

       Фикс-раунд Task 51: цепочку высот считает rowLayout() — единственная
       модель ряда в тестах. Прежде здесь стояла её копия из литералов
       (ROW_BLOCK), и три числа из четырёх в ней давно не существовали в
       CSS: зазор .7em вместо 1.5, карточка 11.4em вместо 9.52, межстрочный
       заголовка 1.46 вместо 1. Assert мерил фикцию и не заметил ни одной из
       трёх правок. Сначала сверяем, что обе модели считают верх первого ряда
       одинаково, — иначе «помещается» означало бы «помещается по другой
       раскладке». */
    const rowBox = rowLayout(built, 1920, 1080, { moods: false, more: true });
    assert.ok(Math.abs(rowBox.rowTopUp - rowHeadUp) < 1,
      label + ': модель ряда ставит его верх на ' + rowBox.rowTopUp.toFixed(1) + ', раскладка героя — на ' + rowHeadUp.toFixed(1));
    assert.ok(rowBox.textBottomUp <= 1080,
      label + ': ряд в поднятом не помещается в FHD, низ подписи ' + rowBox.textBottomUp.toFixed(1) + ' px');
  }
});
/* --- Task 51: подписи рядов обязаны остаться на экране телевизора ---

   Пользователь на Philips 50PUS8057 (2026-09-21): «на главной названия
   фильмов не видны вообще». Замер координатора на стенде в режиме WebView
   960×540@2 подтвердил: в ПОДНЯТОМ состоянии (фокус стоит в ряду, область
   рядов не сдвинута) низ подписи приходился на 543 CSS px при кромке 540.

   Тест повторяет цепочку высот от верха экрана до низа подписи, и слагаемые
   берёт ИЗ РАЗОБРАННОГО CSS — нашего собранного и штатного
   vendor/lampa/css/app.css, — а не из литералов. Литералами остаются
   размеры стенда (960×540) и кромки, ради которых тест и написан. Иначе он
   проверял бы не раскладку, а собственную копию её чисел: ровно так мимо
   прежнего теста «раскладка героя» (выше) прошли и 543 px, и зазор
   заголовка, выросший с .7em до 1.4em.

   ВАЖНО ПРО ЖИВЫЕ ЗАМЕРЫ. На стенде координатора анимации не
   проигрываются (скрытая панель браузера: playState у анимации «running»,
   но кадры не идут). Штатная анимация входа Lampa animation-activity
   держит .activity__body на первом своём кадре — translate3d(0, 14%, 0), —
   и вся область рядов оказывается на 14 % своей высоты ниже расчётного
   места: 39 px при высоте 281. Два круга фикс-раунда 2026-09-21 ушли на
   то, чтобы опознать эти 39 px, тем более что они почти совпали с
   MOODS_BAR (3.43em ≈ 39.1) и увели разбор в чипы настроения. Живой замер
   раскладки делать ТОЛЬКО после getAnimations().forEach((a) => a.finish()).
   Контрольный замер координатора после finish(): верх области 259, шапка
   ряда 287, низ подписи 518 при кромке 540 — модель даёт 518.5.
   Task 63: кегли подписей подняты до минимума tvOS, и у карточки под
   фокусом подпись уезжает вниз — замер того же ряда после правки: низ
   подписи 520.8 у карточки без фокуса и 524.8 у фокусной (сдвиг .35em
   кегля подписи = 4.0 CSS px), модель даёт 525.0.

   Два состояния и два разных требования к ним:
   • ПОДНЯТОЕ (.lumen-rows-up, translateY(0)) — фокус в ряду, карточка
     увеличена, и подпись под ней пользователь читает. Здесь на экране
     обязана быть вся подпись целиком.
   • СТАРТОВОЕ (область опущена на ROWS_SHIFT_VH) — фокус на герое, ряд
     виден снизу постерами. Подписи там уходят за кромку, и требование
     мягче: целиком виден ПОСТЕР. Это размен, а не приём: кадр героя
     занимает две трети экрана по прямому требованию пользователя
     («половина экрана, если не больше»), и на подписи в старте высоты
     экрана после этого не хватает. */
/* Файл читается один раз: модель раскладки зовёт его на каждую клетку, а
   клеток у правила кромки — тысяча с лишним. */
let lampaCssText = null;
function lampaCss() {
  if (lampaCssText === null) lampaCssText = readFileSync(new URL('../vendor/lampa/css/app.css', import.meta.url), 'utf8');
  return lampaCssText;
}

/* Число из объявления внутри правила штатной таблицы Lampa: сначала тело
   правила по его селектору, потом свойство внутри тела. Так номер строки в
   комментарии остаётся проверяемым, а тест не ломается от переносов. */
function lampaDecl(cssText, selector, prop) {
  const at = cssText.indexOf('\n' + selector + ' {');
  assert.notEqual(at, -1, 'правило ' + selector + ' в vendor/lampa/css/app.css не найдено');
  const body = cssText.slice(at, cssText.indexOf('}', at));
  const found = new RegExp('\\n\\s*' + prop + ':\\s*([0-9.]+)').exec(body);
  assert.ok(found, prop + ' у ' + selector + ' не найден: ' + body);
  return parseFloat(found[1]);
}

function decl(cssText, selector) {
  const value = findDecl(cssText, (sel) => sel === selector);
  assert.ok(value !== null, 'правило ' + selector + ' в собранном CSS не найдено');
  return value;
}

/* Все правила с таким селектором, склеенные в одно тело: ширину карточки и
   снятие её слоя buildCss пишет двумя отдельными правилами (.lumen-main
   .card{width} и .lumen-main .card{will-change:auto}). */
function declAll(cssText, selector) {
  return ruleBodies(cssText).filter((r) => r.selectors.some((sel) => sel === selector)).map((r) => r.decl).join(';');
}

function num(body, prop) {
  const found = new RegExp('(?:^|;)' + prop + ':([0-9.]+)').exec(body);
  assert.ok(found, prop + ' не найден в «' + body + '»');
  return parseFloat(found[1]);
}

/* Правила собранного CSS ВМЕСТЕ с их медиазапросом и в порядке файла.
   ruleBodies выше медиазапрос отбрасывает и берёт из строки одно правило —
   для раскладки не годится ни то, ни другое: часть правил области рядов
   живёт только за порогом отношения сторон, а в одной строке медиаблока их
   несколько. */
/* Последний разбор запоминается: модель раскладки спрашивает одну и ту же
   таблицу по нескольку раз на клетку. Результат только читают. */
let rulesCache = { text: null, out: null };
function ruleBodiesWithMedia(cssText) {
  if (rulesCache.text === cssText) return rulesCache.out;
  const out = [];
  rulesCache = { text: cssText, out: out };
  for (const line of cssText.split('\n')) {
    if (!line || /^@-?(webkit-)?keyframes/.test(line)) continue;
    let media = null;
    let body = line;
    if (/^@(media|supports)/.test(line)) {
      media = line.slice(0, line.indexOf('{'));
      body = line.slice(line.indexOf('{') + 1);
    }
    const re = /([^{}]+)\{([^{}]*)\}/g;
    let m;
    while ((m = re.exec(body))) {
      out.push({ media: media, selectors: m[1].split(',').map((s) => s.trim()).filter(Boolean), decl: m[2] });
    }
  }
  return out;
}

/* Действует ли медиазапрос на окне screenW×screenH. Семейств условий в
   таблице два: min-aspect-ratio (пороги низкого окна и узкой колонки) и
   max-width (компактная ветка вёрстки — её порог делится на
   devicePixelRatio, см. правило заголовка карточки в src/30_css.js). Оба
   разбираются здесь, любое третье — повод упасть, а не тихо посчитать
   правило применимым; что семейств по-прежнему два, держит тест
   «медиазапросы таблицы — из известного набора» ниже.
   Ревью Task 63: до фикс-раунда здесь стояло «ровно одно семейство», и это
   было неправдой — max-width жил в таблице с самого начала. */
function mediaApplies(media, screenW, screenH) {
  if (!media) return true;
  /* Правка 2026-09-23 (правило кромки): у правила зазора между рядами
     условий ДВА — интервал отношений сторон. Разбираем оба и требуем, чтобы
     подошли все: «первое совпавшее» здесь дало бы правилу действовать за
     верхней границей интервала, и модель посчитала бы зазор расчётным там,
     где браузер оставит штатный. */
  let known = false;
  const min = /\(min-aspect-ratio:(\d+)\/(\d+)\)/.exec(media);
  if (min) {
    known = true;
    if (!(screenW / screenH >= parseInt(min[1], 10) / parseInt(min[2], 10))) return false;
  }
  const max = /\(max-aspect-ratio:(\d+)\/(\d+)\)/.exec(media);
  if (max) {
    known = true;
    if (!(screenW / screenH <= parseInt(max[1], 10) / parseInt(max[2], 10))) return false;
  }
  const width = /\(max-width:(\d+)px\)/.exec(media);
  if (width) {
    known = true;
    if (!(screenW <= parseInt(width[1], 10))) return false;
  }
  if (!known) assert.fail('незнакомое условие медиазапроса в раскладке: ' + media);
  return true;
}

/* Компаунд селектора — набор классов, которые узел обязан иметь, и набор,
   которых иметь не должен (:not(.x) — единственная псевдоформа в наших
   селекторах раскладки). Всё сложнее этого — псевдоэлемент, атрибут,
   комбинатор — не компаунд вовсе: такой селектор моделировать нечем, и
   функция отдаёт null, чтобы вызывающий решил, пропустить его или упасть. */
function compound(text) {
  const nots = [];
  const rest = String(text).replace(/:not\(\.([A-Za-z0-9_-]+)\)/g, function (all, cls) { nots.push(cls); return ''; });
  if (/[:[>+~]/.test(rest)) return null;
  return { need: rest.split('.').filter(Boolean), deny: nots };
}

function compoundMatches(c, have) {
  for (let i = 0; i < c.need.length; i++) if (have.indexOf(c.need[i]) === -1) return false;
  for (let j = 0; j < c.deny.length; j++) if (have.indexOf(c.deny[j]) !== -1) return false;
  return true;
}

/* Специфичность в том единственном разряде, который здесь меняется, — число
   классов; :not() своей специфичности не добавляет, но её добавляет то, что
   внутри него (CSS Selectors 3, §9). Элементных и id-частей в этих
   селекторах нет, проверено compound() выше. */
function classCount(sel) {
  return (sel.match(/\.[A-Za-z0-9_-]+/g) || []).length;
}

/* Правила, применимые к узлу с классами leafClasses, лежащему внутри узла с
   классами rootClasses, на окне screenW×screenH — с их специфичностью и
   порядком. Селектор ровно из двух компаундов: так записаны все правила
   области рядов. */
function matchingRules(built, rootClasses, leafClasses, screenW, screenH) {
  const out = [];
  const all = ruleBodiesWithMedia(built);
  for (let i = 0; i < all.length; i++) {
    const rule = all[i];
    for (let s = 0; s < rule.selectors.length; s++) {
      const sel = rule.selectors[s];
      const parts = sel.split(/\s+/);
      if (parts.length !== 2) continue;
      const leaf = compound(parts[1]);
      if (!leaf || !compoundMatches(leaf, leafClasses)) continue;
      /* До сюда доходят только правила, которые метят в НАШ узел: если их
         селектор корня сложнее классов, модель молча посчитала бы раскладку
         не по той ветке — лучше упасть. */
      const rootPart = compound(parts[0]);
      assert.ok(rootPart, 'селектор раскладки сложнее классов и :not(): ' + sel);
      if (!compoundMatches(rootPart, rootClasses)) continue;
      /* Условие блока проверяется ПОСЛЕ селектора: тогда незнакомое условие
         роняет тест только там, где правило и вправду метит в раскладку, а
         не на чужом @supports из другой части таблицы. */
      if (!mediaApplies(rule.media, screenW, screenH)) continue;
      out.push({ order: i, spec: classCount(sel), decl: rule.decl, sel: sel });
      break;
    }
  }
  return out;
}

/* Последнее объявление свойства в теле правила: префиксные копии
   (-webkit-transform, -webkit-calc) идут первыми и перекрываются обычной
   формой, как в браузере. */
function declProp(decl, prop) {
  const re = new RegExp('(?:^|;)' + prop + ':([^;]*)', 'g');
  let m;
  let last = null;
  while ((m = re.exec(decl))) last = m[1];
  return last;
}

/* Победитель каскада по свойству: !important бьёт обычное, дальше решает
   специфичность, при равенстве — порядок в файле. */
function cascade(rules, prop) {
  let best = null;
  for (let i = 0; i < rules.length; i++) {
    const value = declProp(rules[i].decl, prop);
    if (value === null) continue;
    const weight = (/!important/.test(value) ? 1e6 : 0) + rules[i].spec * 1000 + rules[i].order;
    if (!best || weight > best.weight) best = { weight: weight, value: value.replace('!important', '').trim(), sel: rules[i].sel };
  }
  return best;
}

/* Множители кегля настройки Lampa «Размер интерфейса» — те же, что в
   src/10_util.js (LAMPA_SIZES) и в app.min.js:31630-31634. Тест держит свою
   копию намеренно: он проверяет плагин по первоисточнику, а не по тому же
   объекту, из которого плагин считает. Расхождение ловит отдельный сторож
   ниже («таблица множителей — та же, что у Lampa»). */
const LAMPA_SIZES = { small: 0.9, normal: 1, bigger: 1.05 };

/* Кегль body Lampa в CSS px при ширине окна W — вместе с полом 10.6 px
   (app.min.js:31629-31640: Math.max(innerWidth / 84.17 * sz, 10.6)).
   Долг раздела D плана lumen-final: без пола модель на «мельче» при 960 px
   брала 10.26 вместо фактических 10.6 и мерила таблицу, собранную по
   завышенной на 3.3 % ширине экрана в em. */
function lampaEm(W, iface) {
  return Math.max(W / 84.17 * LAMPA_SIZES[iface || 'normal'], 10.6);
}

/* Второй множитель того же «Размера интерфейса», и он бьёт только по .card:
   app.css:3525-3528 поднимает ей кегль ещё на 14 % на «крупнее». Разбор и
   первоисточник — у LAMPA_CARD_SIZES в src/10_util.js. */
const LAMPA_CARD_SIZES = { small: 1, normal: 1, bigger: 1.14 };

test('таблица множителей — та же, что у Lampa', () => {
  /* Три копии одного факта: у самой Lampa (первоисточник), у плагина
     (LC.util.lampaSizeK, из неё считаются оба порога раскладки) и у модели
     инварианта выше. Сторож сверяет все три разом: разойдись плагин с
     Lampa — пороги включались бы не там, где кончается место (ревью волны
     A, важное 1); разойдись модель с плагином — она перестала бы ловить
     это расхождение. */
  const lampa = readFileSync(new URL('../vendor/lampa/app.min.js', import.meta.url), 'utf8');
  const sz = /function size\(\)[\s\S]{0,400}?var sz = \{([\s\S]*?)\};/.exec(lampa);
  assert.ok(sz, 'таблица sz в функции size() у Lampa не найдена');
  const parse = (body) => {
    const out = {};
    const re = /([a-z]+)\s*:\s*([0-9.]+)/g;
    let m;
    while ((m = re.exec(body))) out[m[1]] = parseFloat(m[2]);
    return out;
  };
  assert.deepEqual(parse(sz[1]), LAMPA_SIZES, 'у Lampa другие множители, чем у модели');

  const util = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');
  const ours = /var LAMPA_SIZES = \{([^}]*)\}/.exec(util);
  assert.ok(ours, 'таблица LAMPA_SIZES в src/10_util.js не найдена');
  assert.deepEqual(parse(ours[1]), LAMPA_SIZES, 'у плагина другие множители, чем у Lampa');

  /* Второй множитель — кегль .card на «крупнее». Первоисточник здесь не
     app.min.js, а штатная таблица стилей, и сторож читает её по тому же
     правилу: селектор, потом свойство внутри правила. */
  const lampaStyles = readFileSync(new URL('../vendor/lampa/css/app.css', import.meta.url), 'utf8');
  const cardSize = /body\.size--bigger \.card \{\s*font-size:\s*([0-9.]+)em/.exec(lampaStyles);
  assert.ok(cardSize, 'правило body.size--bigger .card в app.css не найдено');
  assert.equal(parseFloat(cardSize[1]), LAMPA_CARD_SIZES.bigger, 'у Lampa другой кегль карточки на «крупнее»');
  assert.ok(!/body\.size--(small|normal) \.card \{/.test(lampaStyles),
    'у Lampa завелось такое же правило для других размеров — таблица обязана вырасти');
  const oursCard = /var LAMPA_CARD_SIZES = \{([^}]*)\}/.exec(util);
  assert.ok(oursCard, 'таблица LAMPA_CARD_SIZES в src/10_util.js не найдена');
  assert.deepEqual(parse(oursCard[1]), { bigger: LAMPA_CARD_SIZES.bigger },
    'у плагина другой кегль карточки на «крупнее», чем у Lampa');

  /* И второй копии таблицы в плагине нет: пороги обязаны считать через
     LC.util.lampaSizeK, а не через собственные литералы. */
  const cssSrc = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  assert.ok(!/bigger\s*:\s*1\.05/.test(cssSrc), 'в src/30_css.js завелась вторая копия таблицы множителей');
  assert.ok(/LC\.util\.screenBaseEm\(\)/.test(cssSrc), 'src/30_css.js перестал спрашивать ширину экрана у LC.util');
  /* Пол кегля 10.6 px живёт в одном месте — baseEm в src/10_util.js;
     второй копии формулы в таблице стилей быть не должно. */
  assert.ok(!/\b10\.6\b/.test(cssSrc.replace(/\/\*[\s\S]*?\*\//g, '')), 'в src/30_css.js завелась вторая копия пола кегля');
});

/* Длина в CSS px: '0', '3.43em', 'calc(50vh - 5em)', 'calc(50vh + 1em)'. */
function lengthPx(value, EM, VH) {
  assert.ok(value !== null && value !== undefined, 'длины нет вовсе');
  const calc = /^calc\((.+)\)$/.exec(String(value).trim());
  const expr = calc ? calc[1] : String(value).trim();
  let total = 0;
  const re = /([+-]?)\s*([0-9.]+)(vh|em|px)?/g;
  let m;
  let seen = 0;
  while ((m = re.exec(expr))) {
    const sign = m[1] === '-' ? -1 : 1;
    const n = parseFloat(m[2]);
    total += sign * n * (m[3] === 'vh' ? VH : m[3] === 'em' ? EM : 1);
    seen++;
  }
  assert.ok(seen > 0, 'длину не разобрать: ' + value);
  return total;
}

/* Низ подписи и низ постера ПЕРВОГО ряда главной, CSS px от верха экрана.

   opts.moods — включены ли «Профили настроения» (настройка по умолчанию
   включена, и класс .lumen-moods-on стоит тогда на корне главной);
   opts.more — есть ли в шапке ряда штатная кнопка «Ещё». Lampa дописывает
   её при results.length >= 20 || data.more (vendor/lampa/app.min.js:
   52696-52702), то есть на рядах TMDB — всегда: страница выдачи там ровно
   из 20 карточек.

   Правило области рядов выбирается КАСКАДОМ по фактическому набору классов
   корня, а не по имени селектора: часть правил раскладки живёт внутри
   медиазапроса и на телевизоре 16:9 не действует, а часть отличается одним
   классом, и «найти правило по точному селектору» означало бы решить за
   браузер, какое из них победит. */
function rowLayout(built, screenW, screenH, opts) {
  const options = opts || {};
  const lampa = lampaCss();
  /* База кегля Lampa: font-size корня = ширина окна / 84.17 × k, где k —
     множитель настройки «Размер интерфейса» (app.min.js:31629-31639,
     таблица — LC.util.lampaSizeK). На стенде 960 px это 11.41 CSS px при
     «обычном», 10.27 при «мельче» и 11.98 при «крупнее».
     Ревью волны A (важное 1): множителя здесь не было вовсе, и модель
     считала «крупнее» по кеглю «обычного» — низ подписи выходил на 5 %
     меньше фактического, а тест при этом оставался зелёным. */
  const EM = lampaEm(screenW, options.interface);
  /* Кегль ВНУТРИ .card. Lampa поднимает его ещё на 14 % на «крупнее» и
     только там (app.css:3525-3528, @media min-width:767px — ширина окна в
     CSS px, на стенде 960). Шапка ряда и зазор под ней лежат снаружи
     карточки и считаются базовым EM; всё, что ниже постера, — этим. */
  const CARD_EM = EM * LAMPA_CARD_SIZES[options.interface || 'normal'];
  const VH = screenH / 100;

  const rootUp = ['lumen-main', 'lumen-rows-up'];
  if (options.moods) rootUp.push('lumen-moods-on');
  const rootDown = rootUp.filter((c) => c !== 'lumen-rows-up');
  const area = ['scroll', 'layer--wheight'];

  const upRules = matchingRules(built, rootUp, area, screenW, screenH);
  const downRules = matchingRules(built, rootDown, area, screenW, screenH);
  assert.ok(upRules.length, 'ни одно правило не досталось области рядов');

  /* Шапка Lampa (.activitys начинается на столько ниже верха экрана) —
     LAMPA_HEAD. В таблице она стоит ровно в одном месте: высота области за
     порогом низкого окна, height:calc(100vh - <LAMPA_HEAD>em). */
  const head = parseFloat(/height:calc\(100vh - ([0-9.]+)em\) !important/.exec(heroOffMedia(built))[1]);

  const areaTopUp = head * EM + lengthPx(cascade(upRules, 'margin-top').value, EM, VH);
  /* За порогом, где кадра героя нет (heroOffMedia), у области transform:none
     в обоих состояниях — сдвига нет. Правка 2026-09-23 (правило кромки на
     ПК): модель гоняется и на таких окнах. */
  const shiftOf = (rules) => {
    const value = cascade(rules, 'transform').value;
    if (value === 'none') return 0;
    return lengthPx(/translateY\(([^)]*)\)/.exec(value)[1], EM, VH);
  };
  const shiftUp = shiftOf(upRules);
  const shiftDown = shiftOf(downRules);
  const areaTopDown = head * EM + lengthPx(cascade(downRules, 'margin-top').value, EM, VH);

  /* Отступ, который Lampa держит над фокусным рядом сама. Маску мы с области
     сняли (mask-image:none), но класс .scroll--mask на ней остался, и padding
     вместе с ним — заголовок первого ряда стоит на эту величину ниже верха
     области (vendor/lampa/css/app.css:2787-2789). */
  const lampaPad = lampaDecl(lampa, '.scroll--mask .scroll__content', 'padding') * EM;
  const rowTopUp = areaTopUp + shiftUp + lampaPad;
  const rowTopDown = areaTopDown + shiftDown + lampaPad;

  /* Шапка ряда — flex с align-items:center (app.css:2822-2840), её высота
     равна самому высокому ребёнку. Их двое: заголовок и кнопка «Ещё».
     Своей line-height нет ни у .items-line__title (app.css:2841-2844 —
     только font-size и font-weight), ни у нас, значит работает межстрочный
     body (app.css:207-208, line-height:1). */
  const lineH = lampaDecl(lampa, 'body', 'line-height');
  const titleH = num(decl(built, '.lumen-main .items-line__title'), 'font-size') * lineH * EM;
  let headH = titleH;
  if (options.more) {
    /* Кнопка «Ещё»: собственного кегля у неё нет ни у Lampa
       (app.css:2859-2866 — margin-left, padding, фон и скругление), ни у нас,
       если мы его не задали; высота — padding сверху и снизу плюс строка.

       Правка 2026-09-23 (разбор композиции, п.1.5): кнопку в шапке ряда мы
       прячем целиком, и в высоту шапки она больше не входит НИ В ОДНОМ
       ряду. Модель читает это из самой таблицы, а не из своего допущения:
       увидела display:none — считает шапку по заголовку. Вернут кнопку —
       вернётся и её высота, переписывать модель не придётся. */
    const ours = declAll(built, '.lumen-main .items-line__more');
    if (!/display:none/.test(ours)) {
      const moreFont = /font-size:/.test(ours) ? num(ours, 'font-size') : 1;
      const morePad = /padding:/.test(ours)
        ? parseFloat(/(?:^|;)padding:([0-9.]+)em/.exec(ours)[1])
        : lampaDecl(lampa, '.items-line__more', 'padding');
      headH = Math.max(headH, (morePad * 2 + lineH) * moreFont * EM);
    }
  }
  /* Зазор под шапкой. margin-bottom стоит на .items-line__head, у него
     собственный кегль 1em, поэтому em здесь базовые. */
  /* Ревью фикс-раунда (п.7): у узкой колонки зазор свой и живёт в
     медиазапросе — берём каскадом, как ширину карточки и кегли подписей. */
  const gap = parseFloat(cascade(matchingRules(built, rootUp, ['items-line__head'], screenW, screenH), 'margin-bottom').value) * EM;

  /* Постер: ширину задаём мы, высоту — штатный padding-bottom:150 % у
     .card__view (app.css:3135-3139), то есть 3:2 от ШИРИНЫ карточки. */
  /* Ревью фикс-раунда (п.4): за порогом, где блок ряда перестаёт
     помещаться, ширина карточки — calc(Nvh − Mem), и у варианта с
     профилями настроения правило своё (.lumen-moods-on.lumen-main). Поэтому
     корень — фактический набор классов, а длина считается с vh окна. */
  const cardW = lengthPx(cascade(matchingRules(built, rootUp, ['card'], screenW, screenH), 'width').value, CARD_EM, VH);
  const posterH = cardW * (lampaDecl(lampa, '.card__view', 'padding-bottom') / 100);
  const posterBottomUp = rowTopUp + headH + gap + posterH;
  const posterBottomDown = rowTopDown + headH + gap + posterH;

  /* Подпись. margin-bottom у .card__view базовый (кегль .card — 1em), а вот
     margin-top у .card__age считается от ЕГО собственного кегля — em здесь
     дешевле базового, а не дороже.
     Task 63: кегли подписей берутся КАСКАДОМ, а не первым правилом с таким
     селектором: за порогом узкой колонки у обеих подписей есть второе
     правило внутри медиазапроса (там они возвращаются к минимуму tvOS без
     масштаба интерфейса), и «первое правило» означало бы считать раскладку
     не по тому кеглю, который получит экран. */
  const viewGap = num(declAll(built, '.lumen-main .card__view'), 'margin-bottom') * CARD_EM;
  const titleRules = matchingRules(built, ['lumen-main'], ['card__title'], screenW, screenH);
  const ageRules = matchingRules(built, ['lumen-main'], ['card__age'], screenW, screenH);
  const titleFont = parseFloat(cascade(titleRules, 'font-size').value);
  const cardTitleH = titleFont * parseFloat(cascade(titleRules, 'line-height').value) * CARD_EM;
  const ageFont = parseFloat(cascade(ageRules, 'font-size').value);
  const ageGap = parseFloat(cascade(ageRules, 'margin-top').value) * ageFont * CARD_EM;
  const ageH = ageFont * parseFloat(cascade(ageRules, 'line-height').value) * CARD_EM;
  /* Task 63: у карточки ПОД ФОКУСОМ подпись уезжает вниз, и читают её именно
     там — значит низ подписи меряется вместе с этим сдвигом. Правило живёт
     под body.lumen-motion-full (класс режима движения стоит на body), то
     есть в модель входит худший случай — полные анимации. transform стоит на
     самой подписи, поэтому его em считаются в её кегле. */
  const focusRule = findDecl(built, (sel) => sel === 'body.lumen-motion-full .lumen-main .card.focus .card__age');
  assert.ok(focusRule, 'нет правила сдвига подписи под фокусом');
  const focusShift = parseFloat(/[^-]transform:translateY\(([0-9.]+)em\)/.exec(focusRule)[1]) * ageFont * CARD_EM;
  const tail = viewGap + cardTitleH + ageGap + ageH + focusShift;

  /* Правка 2026-09-23 (правило кромки): зазор между рядами берётся
     КАСКАДОМ по фактическому экрану — внутри интервала отношений сторон,
     где заголовок следующего ряда попадал на кромку, он подменяется
     расчётным (src/30_css.js, правило .lumen-main .items-line). Высота
     шапки того ряда — та же, что у первого. */
  const rowGap = lengthPx(cascade(matchingRules(built, rootUp, ['items-line'], screenW, screenH), 'padding-bottom').value, EM, VH);
  const rowBottomUp = posterBottomUp + tail - focusShift + rowGap;

  return {
    rowTopUp: rowTopUp,
    rowGap: rowGap,
    /* Отступ Lampa над фокусным рядом в px: подписи ПРЕДЫДУЩЕГО ряда стоят
       на (lampaPad − rowGap) ниже верха области, то есть внутри неё, если
       зазор меньше отступа. */
    lampaPad: lampaPad,
    /* Низ ряда в потоке и низ шапки СЛЕДУЮЩЕГО ряда — из них и считается,
       режет ли его кромка экрана. */
    rowBottomUp: rowBottomUp,
    nextHeadBottomUp: rowBottomUp + headH,
    cardW: cardW / CARD_EM,
    /* Низ подписи В ПОТОКЕ — без сдвига фокуса: transform раскладку не
       меняет, и следующий ряд встаёт именно от этой линии. */
    flowBottomUp: posterBottomUp + tail - focusShift,
    textBottomUp: posterBottomUp + tail,
    textBottomDown: posterBottomDown + tail,
    posterBottomUp: posterBottomUp,
    posterBottomDown: posterBottomDown
  };
}

test('Task 51: подпись первого ряда в СЖАТОМ состоянии помещается в экран телевизора при любом масштабе', () => {
  /* Стенд координатора: Philips 50PUS8057/60 отдаёт WebView 960×540 при
     devicePixelRatio 2 (растр 1920×1080). Раскладка считается в CSS px этого
     окна — именно в них сделан замер «543 при кромке 540» до Task 51. */
  const W = 960;
  const H = 540;

  /* ДЛЯ КАКОГО СОСТОЯНИЯ СФОРМУЛИРОВАН ИНВАРИАНТ (уточнение 2026-09-23).

     Только для СЖАТОГО: кадр героя поджат, ряды подняты, на корне активности
     стоит .lumen-rows-up. Его включает LC.hero.setCompact, когда фокус
     уходит НИЖЕ первого ряда (src/48_hero.js, updateCompact: index > 0), и
     ряды при этом поднимаются ровно на высоту одного ряда — фокусный ряд
     встаёт туда, где в модели стоит первый. Поэтому textBottomUp меряет
     именно тот ряд, в котором сейчас фокус, и читают подпись именно там.

     В состоянии ПОКОЯ (фокус в первом ряду или выше, кадр героя во всю свою
     долю экрана) подпись первого ряда стоит НИЖЕ кромки — на стенде 550.5 px
     при кромке 540, и это не дефект, а размен: кадру отдано две трети
     высоты по решению пользователя, а ряд под ним «подглядывает». Что размен
     задуман, а не случаен, видно по правилу рядом: posterBottomDown ≤ H —
     постер обязан быть виден ЦЕЛИКОМ в обоих состояниях, срезается только
     подпись под ним. Проверяется ниже в этом же тесте.

     Прежнее имя теста («помещается в экран») состояния не называло, и
     замер в покое однажды прочитали как нарушение инварианта. Теперь
     состояние стоит и в имени, и в каждом сообщении об ошибке. */

  /* Запас 8 px: подпись стоит на дробных координатах (кегли получаются
     умножением на масштаб интерфейса и округляются до сотых), и у ТВ свой
     оверскан. Ровно 540 значило бы «последняя строка касается кромки». */
  const TEXT_LIMIT = 532;

  /* Кнопка «Ещё» в шапке ряда: Lampa дописывает её при
     results.length >= 20 || data.more (vendor/lampa/app.min.js:52696-52702),
     а страница выдачи TMDB — ровно 20 карточек, то есть на рядах главной
     она была всегда и шапка мерилась по ней (1.8em против 1.23em у
     заголовка, app.css:2859-2866). С правки 2026-09-23 (разбор композиции,
     п.1.5) она скрыта, и обе ветки перебора совпали; оба прогона оставлены,
     чтобы возвращение кнопки сразу же поймал этот тест, а не экран. */
  const box = (scale, more, size, iface) => {
    const storage = { lumen_scale: scale };
    if (size) storage.lumen_hero_size = size;
    if (iface) storage.interface_size = iface;
    return rowLayout(withStorage(storage, (LC) => LC.buildCss()), W, H,
      { more: more, interface: iface });
  };

  /* Размер кадра героя двигает всю цепочку: от него зависит ROWS_TOP_VH, то
     есть сколько экрана достаётся рядам. Инвариант обязан держаться на всех
     трёх размерах, а не только на крупном по умолчанию.
     Ревью волны A (важное 1): третьим измерением добавлен «Размер
     интерфейса» самой Lampa. Множителей у него ДВА: кегль body (×1.05 на
     «крупнее») и кегль .card поверх него (ещё ×1.14, app.css:3525-3528), и
     до правки модель не знала ни про один. Живая сверка на стенде
     960×540@2 после getAnimations().finish(): «крупнее», штатный масштаб,
     крупный кадр, поднятое состояние — низ подписи 525.75 px, расчёт
     525.87; «обычный» при тех же прочих — 514.38 против расчётных 514.5. */

  /* Исключений в таблице больше нет: все 72 клетки обязаны уложиться.
     Раньше их было три — «крупнее» с крупным кадром при масштабе от
     штатного и выше (537.5, 555.9 и 574.1 px при пределе 532). Узкая
     колонка там была уже включена, кегли подписей уже сброшены к TV_MIN, и
     другого запаса в цепочке не оставалось. Закрыл их потолок масштаба
     карточки ряда (rowScaleCap в src/30_css.js): выбранный масштаб
     ограничивается сверху тем же бюджетом высоты, из которого считается
     порог узкой колонки. Цена ограничения — отдельным тестом ниже
     («потолок масштаба карточки ряда»). */
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const size of ['large', 'medium', 'compact']) {
      for (const scale of ['small', 'normal', 'large', 'huge']) {
        for (const more of [true, false]) {
          const got = box(scale, more, size, iface);
          const label = iface + '/' + size + '/' + scale + (more ? ' с кнопкой «Ещё»' : '');
          assert.ok(got.textBottomUp <= TEXT_LIMIT,
            label + ': низ подписи в СЖАТОМ состоянии (.lumen-rows-up, фокус ниже первого ряда) ' +
            got.textBottomUp.toFixed(1) + ' px при пределе ' + TEXT_LIMIT);
        }
      }
    }
  }

  /* Три клетки, которые дефицит давали раньше, называются поимённо: если
     потолок однажды перестанет их закрывать, падать должен тест с понятным
     именем клетки, а не безымянная ячейка общего прогона выше. */
  assert.ok(box('normal', true, 'large', 'bigger').textBottomUp <= TEXT_LIMIT,
    'bigger/large/normal снова за пределом');
  assert.ok(box('large', true, 'large', 'bigger').textBottomUp <= TEXT_LIMIT,
    'bigger/large/large снова за пределом');
  assert.ok(box('huge', true, 'large', 'bigger').textBottomUp <= TEXT_LIMIT,
    'bigger/large/huge снова за пределом');

  /* Соседи по обеим осям — те клетки, которые до потолка помещались впритык
     (531.2, 530.9 и 530.8 при пределе 532): именно им ограничение не имело
     права ничего испортить. */
  assert.ok(box('huge', true, 'large', 'normal').textBottomUp <= TEXT_LIMIT,
    'normal/large/huge перестал помещаться — дефицит расползается по размерам интерфейса');
  assert.ok(box('huge', true, 'medium', 'bigger').textBottomUp <= TEXT_LIMIT,
    'bigger/medium/huge перестал помещаться — дефицит расползается по размерам кадра');
  assert.ok(box('small', true, 'large', 'bigger').textBottomUp <= TEXT_LIMIT,
    'bigger/large/small перестал помещаться — дефицит расползается по масштабам');

  for (const scale of ['small', 'normal', 'large', 'huge']) {
    for (const more of [true, false]) {
      const got = box(scale, more);
      const label = scale + (more ? ' с кнопкой «Ещё»' : '');
      assert.ok(got.textBottomUp <= TEXT_LIMIT,
        label + ': низ подписи в СЖАТОМ состоянии (.lumen-rows-up) ' + got.textBottomUp.toFixed(1) +
        ' px при пределе ' + TEXT_LIMIT);
      /* В ПОКОЕ подпись за кромкой — это размен, а не дефект: кадр героя
         занимает две трети экрана по требованию пользователя, и ряд под ним
         «подглядывает». Проверяем ровно то, что размен задуман: подпись
         уходит за кромку, а ПОСТЕР обязан быть виден целиком — срезанный
         постер выглядит поломкой, срезанная подпись читается как
         продолжение. Обе половины утверждения проверяются вместе, чтобы
         «подглядывание» нельзя было втихую превратить в срез постера. */
      assert.ok(got.posterBottomDown <= H,
        label + ': в состоянии ПОКОЯ постер срезан кромкой — низ ' + got.posterBottomDown.toFixed(1) + ' px');
    }
    assert.equal(box(scale, false).textBottomUp, box(scale, true).textBottomUp,
      scale + ': ряды с кнопкой «Ещё» и без снова разной высоты — кнопку в шапке кто-то вернул (п.1.5 разбора)');
  }

  /* Контрольные числа модели на стенде 960×540@2 (штатный масштаб, крупный
     кадр, «обычный» размер интерфейса Lampa).

     518.5 — низ подписи в СЖАТОМ состоянии при полных анимациях, то есть с
     учётом сдвига подписи под фокусом (CARD_FOCUS_SHIFT, .35em = 4.03 px);
     в режиме движения «лёгкий», который стоит у пользователя, сдвига нет, и
     то же место даёт 514.5. Живая сверка 2026-09-23 после
     getAnimations().forEach((a) => a.finish()) — в комментарии к тесту
     «модель раскладки сходится с живым замером» ниже.
     До правки п.1.5 (кнопка «Ещё» в шапке ряда) здесь было 525.0 — разница
     ровно в высоте кнопки, 6.5 px.
     287 — верх шапки первого ряда, от правки не изменился. */
  assert.ok(Math.abs(box('normal', true).textBottomUp - 518.5) < 1,
    'штатный масштаб, сжатое состояние: ' + box('normal', true).textBottomUp.toFixed(1) + ' вместо расчётных 518.5');
  assert.ok(Math.abs(box('normal', true).flowBottomUp - 514.5) < 1,
    'штатный масштаб, сжатое состояние без сдвига фокуса (режим движения «лёгкий»): ' +
    box('normal', true).flowBottomUp.toFixed(1) + ' вместо расчётных 514.5');
  assert.ok(Math.abs(box('normal', true).rowTopUp - 287) < 1,
    'верх шапки первого ряда: ' + box('normal', true).rowTopUp.toFixed(1) + ' вместо замеренных 287');

  /* «Подглядывание» ряда в состоянии ПОКОЯ — вывод отдельной проверкой,
     потому что оно НЕ универсально, и это выяснилось здесь же: на мелком
     масштабе карточки ряд помещается в экран целиком (525.7 px при кромке
     540), а на штатном и выше подпись уходит за кромку (548.2 / 558.6 /
     569.0). То есть «подглядывание» — не отдельное решение, а следствие
     двух чисел: доли кадра героя (две трети, решение пользователя) и
     выбранного масштаба карточки. Инвариант формулировался не для этого
     состояния, и требовать от покоя чего-либо, кроме целого постера,
     нельзя. */
  assert.ok(box('small', true).textBottomDown <= H,
    'мелкий масштаб, покой: ряд перестал помещаться целиком (' + box('small', true).textBottomDown.toFixed(1) + ' px)');
  for (const scale of ['normal', 'large', 'huge']) {
    assert.ok(box(scale, true).textBottomDown > H,
      scale + ', покой: подпись вдруг помещается в экран (' + box(scale, true).textBottomDown.toFixed(1) +
      ' px) — либо ряды поднялись, либо кадр героя потерял свою долю');
  }
});

/* Уточнение 2026-09-23: модель раскладки и живой замер на стенде — про одно
   и то же, и расхождения между ними нет. Проверял координатор: живьём в
   сжатом состоянии низ подписи 521.2 px, а «модель для той же клетки» —
   514.5, откуда взялась разница в 6.7 px.

   Разобрано по слагаемым (стенд 960×540@2, база кегля 11.4055, режим
   движения «лёгкий», кадр героя крупный, «обычный» размер интерфейса):

     верх шапки ряда      287.42   (модель 287.11)
     шапка ряда           +20.50   кнопка «Ещё» — она была выше заголовка
     зазор под шапкой     +17.11
     постер               +162.86  (ширина карточки 108.58 × 1.5)
     отступ под постером  +5.70
     название             +13.25
     отступ над метой     +2.88
     мета                 +11.52
     ----------------------------
     низ подписи          521.24   (замер getBoundingClientRect: 521.19)

   То есть замер 521.2 сделан на ряду С кнопкой «Ещё» (а её тогда имел
   каждый ряд TMDB), а число 514.5 модель давала для ряда БЕЗ кнопки: 20.50
   против 14.00 в шапке — ровно 6.5 px из 6.7, остальные 0.2 — округление
   em до сотых (round2) в самой таблице стилей. Ни модель, ни замер не
   врали; сравнивались разные клетки.

   Вторая пара чисел из того же разбора — 525.0 против 521.2 — это режим
   движения: модель считает худший случай, полные анимации, где подпись под
   фокусом уезжает вниз на CARD_FOCUS_SHIFT (.35em = 4.03 px); у
   пользователя режим «лёгкий», там сдвига нет. Поэтому живой замер в lite
   сверяется с flowBottomUp, а не с textBottomUp.

   После правки п.1.5 кнопки в шапке нет ни у одного ряда, и обе ветки
   сошлись: 518.5 в full, 514.5 в lite. Живая сверка 2026-09-23 на том же
   стенде после правки — 514.2 в сжатом состоянии и 544.1 в покое (постер
   при этом кончается на 510.8, то есть целиком на экране). */
test('уточнение 2026-09-23: модель раскладки сходится с живым замером на стенде', () => {
  const W = 960;
  const H = 540;
  const built = withStorage({ lumen_scale: 'normal', lumen_hero_size: 'large', interface_size: 'normal' },
    (LC) => LC.buildCss());
  const got = rowLayout(built, W, H, { more: true, interface: 'normal' });
  /* Живые замеры на стенде 2026-09-23 (после getAnimations().finish(),
     режим движения «лёгкий» — как у пользователя). Допуск 1 px: живьём
     координаты дробные, модель считает по округлённым до сотых em. */
  assert.ok(Math.abs(got.flowBottomUp - 514.2) < 1,
    'сжатое состояние, режим «лёгкий»: модель ' + got.flowBottomUp.toFixed(1) + ' против живых 514.2');
  /* Покой минус сжатое — одна и та же величина в обоих режимах движения
     (сдвиг фокуса входит в оба конца и сокращается). Живьём 544.1 − 514.2 =
     29.8, модель 548.2 − 518.5 = 29.7. */
  assert.ok(Math.abs(got.textBottomDown - got.textBottomUp - 29.8) < 1,
    'разница между покоем и сжатым состоянием: ' + (got.textBottomDown - got.textBottomUp).toFixed(1) +
    ' вместо живых 29.8');
  /* И сам покой: живьём низ подписи 544.1 при кромке 540, постер 510.8 —
     подпись за кромкой, постер целиком на экране. */
  assert.ok(Math.abs(got.textBottomDown - got.textBottomUp - (548.2 - 518.5)) < 0.5,
    'покой и сжатое разъехались с расчётом');
  /* И сдвиг подписи под фокусом — ровно та величина, на которую модель
     худшего случая отличается от замера в «лёгком» режиме. */
  const shift = got.textBottomUp - got.flowBottomUp;
  assert.ok(Math.abs(shift - 4.03) < 0.2,
    'сдвиг подписи под фокусом ' + shift.toFixed(2) + ' px — модель полных анимаций разошлась с CARD_FOCUS_SHIFT');
});

/* Потолок масштаба карточки ряда (rowScaleCap в src/30_css.js). «Размер
   интерфейса: крупнее» у самой Lampa увеличивает карточку ДВАЖДЫ — кегль
   body ×1.05 (vendor/lampa/app.min.js:31630-31634) и правило
   body.size--bigger .card{font-size:1.14em} поверх него
   (vendor/lampa/css/app.css:3525-3528), — и наш масштаб умножается на это
   сверху. С крупным кадром произведение в высоту экрана не помещается, и
   потолок его режет. Тест сторожит обе половины решения: режет ТОЛЬКО вниз
   и ТОЛЬКО там, где место кончилось.

   Эффективный масштаб читается из базового правила ширины карточки:
   buildCss пишет туда round2(9.52 × rowScale), то есть деление на ширину
   седьмой колонки возвращает сам масштаб с точностью округления. */
/* Правило кромки главной (src/30_css.js, правило .lumen-main .items-line).

   Решение пользователя 2026-09-23: «мне не нравится, когда есть этот
   выступ, все знают, что внизу есть что-то» — от следующего ряда в сжатом
   состоянии не видно ничего. Первая редакция правила (5601edb) требовала
   меньшего — «заголовок следующего ряда либо целиком на экране, либо за
   кромкой» — и была откалибрована под телевизор: на стенде 1840×960, DPR 1
   заголовок следующего ряда стоял целиком над кромкой (931.3…958.2).

   Здесь проверяются обе кромки области рядов в СЖАТОМ состоянии:
   - снизу: следующий ряд начинается не выше кромки экрана (низ фокусного
     ряда вместе с зазором ≥ H);
   - сверху: подписи ПРЕДЫДУЩЕГО ряда не заходят в область. Lampa ставит
     фокусный ряд на свой отступ (2.5em) ниже верха области, и подписи
     предыдущего стоят на (отступ − зазор) внутри неё. Замер на стенде
     1600×900, DPR 1 до правки: зазор 42.6 px при отступе 47.5 — подписи
     предыдущего ряда 417.2…436.4 при верхе области 431.0, то есть 5.4 px
     внутри.

   Окна: телевизор пользователя (960×540 CSS px при DPR 2) и окна браузера
   ПК — 16:9 и 16:10 от 1280 до 2560 CSS px (DPR на главной не влияет:
   ни одно правило главной не зависит от него, порог по DPR есть только у
   компактной ветки карточки — narrowWindowPx), окно пользователя 1840×960
   и окна 21:9, где кадра героя нет вовсе (своя ветка правила). В каждом —
   72 клетки: 3 размера интерфейса Lampa × 3 размера кадра × 4 масштаба ×
   профили настроения вкл/выкл (от них зависит верх области за порогом
   «кадра нет»). */
const EDGE_WINDOWS = [
  [960, 540],
  [1280, 720], [1366, 768], [1600, 900], [1920, 1080], [2560, 1440],
  [1280, 800], [1440, 900], [1680, 1050], [1920, 1200], [2560, 1600],
  [1840, 960], [1920, 969],
  [2560, 1080], [3440, 1440]
];

function edgeViolations(W, H) {
  const bad = [];
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const size of ['large', 'medium', 'compact']) {
      for (const scale of ['small', 'normal', 'large', 'huge']) {
        const built = withStorage(
          { lumen_scale: scale, lumen_hero_size: size, interface_size: iface }, (LC) => LC.buildCss(), W);
        for (const moods of [true, false]) {
          const got = rowLayout(built, W, H, { interface: iface, moods: moods });
          const label = W + '×' + H + ' ' + iface + '/' + size + '/' + scale + (moods ? '/чипы' : '');
          /* Допуск полпикселя: границы интервалов пишутся в тысячных
             отношения сторон, зазор — в em с округлением до сотых. */
          if (got.rowBottomUp < H - 0.5) {
            bad.push(label + ': следующий ряд начинается на ' + got.rowBottomUp.toFixed(1) + ' при кромке ' + H);
          }
          /* Ревью фикс-раунда (п.4): и подпись ФОКУСНОГО ряда — целиком на
             экране, с воздухом ROW_EDGE_AIR (.7em) до кромки. Прежняя редакция
             проверяла только следующий ряд, и на окнах шире 16:9 подпись
             уходила за кромку при зелёном тесте. textBottomUp — худший случай,
             полные анимации со сдвигом подписи под фокусом. */
          const limit = H - 0.7 * lampaEm(W, iface);
          if (got.textBottomUp > limit + 0.5) {
            bad.push(label + ': низ подписи фокусного ряда ' + got.textBottomUp.toFixed(1) + ' при пределе ' + limit.toFixed(1));
          }
          if (got.rowGap < got.lampaPad - 0.5) {
            bad.push(label + ': подписи предыдущего ряда на ' + (got.lampaPad - got.rowGap).toFixed(1) +
              ' px внутри области (зазор ' + got.rowGap.toFixed(1) + ', отступ Lampa ' + got.lampaPad.toFixed(1) + ')');
          }
        }
      }
    }
  }
  return bad;
}

test('правило кромки: на телевизоре от следующего ряда в сжатом состоянии не видно ничего (72 клетки)', () => {
  assert.deepEqual(edgeViolations(960, 540), []);
});

test('правило кромки: то же на окнах браузера ПК — 16:9, 16:10, окно пользователя и 21:9', () => {
  const bad = [];
  for (const [W, H] of EDGE_WINDOWS.slice(1)) bad.push(...edgeViolations(W, H));
  assert.deepEqual(bad, []);
});

/* Та же правка со стороны цены и формы: расчётный зазор пишется там, где
   ряд короче места под ним, и нигде больше. */
test('правило кромки: расчётный зазор — ровно до границы, где он опускается до штатного', () => {
  const built = withStorage({ lumen_scale: 'normal', lumen_hero_size: 'large', interface_size: 'normal' },
    (LC) => LC.buildCss(), 1840);
  const lines = built.split(String.fromCharCode(10)).filter((l) =>
    l.indexOf('@media') === 0 && l.indexOf('.lumen-main .items-line{padding-bottom') !== -1);
  const heroOff = parseInt(/min-aspect-ratio:(\d+)\/100/.exec(heroOffMedia(built))[1], 10) / 100;
  const wide = lines.find((l) => l.indexOf('min-aspect-ratio') === -1);
  assert.ok(wide, 'у широкой раскладки правило кромки обязано быть без нижней границы: ' + lines.join(' | '));
  /* Все границы интервалов — не дальше порога, за которым кадра нет: там у
     области другая геометрия, и формулу героя ставить туда нельзя (до
     правки 2026-09-23 интервал компактного кадра доходил до 2.72:1 при
     пороге 2.20). */
  for (const l of lines) {
    const min = /min-aspect-ratio:(\d+)\/100/.exec(l);
    const max = /max-aspect-ratio:(\d+)\/1000/.exec(l);
    assert.ok(max, 'граница правила кромки — в тысячных: ' + l);
    const lo = min ? parseInt(min[1], 10) / 100 : 0;
    const hi = parseInt(max[1], 10) / 1000;
    const heroFormula = l.indexOf('100vh') === -1;
    assert.ok(heroFormula ? hi <= heroOff + 1e-9 : lo >= heroOff - 1e-9,
      'правило кромки заходит не в свою раскладку (порог «кадра нет» ' + heroOff + '): ' + l);
    /* На самой границе расчётный зазор равен штатному (ROW_GAP = отступ
       Lampa, 2.5em) с точностью до шага в тысячную отношения сторон. */
    const H = Math.round(1840 / hi);
    const at = rowLayout(built, 1840, H, { interface: 'normal', moods: !heroFormula && l.indexOf('lumen-moods-on') !== -1 });
    assert.ok(Math.abs(at.rowGap - 2.5 * lampaEm(1840, 'normal')) < 1,
      'на границе ' + hi + ' зазор ' + at.rowGap.toFixed(1) + ' px вместо штатных 2.5em: ' + l);
  }
  /* И сама граница: у окна пользователя (1840×960, 1.917:1) расчётный зазор
     включён — именно там выглядывал заголовок следующего ряда. */
  const user = rowLayout(built, 1840, 960, { interface: 'normal' });
  assert.ok(Math.abs(user.rowBottomUp - 960) < 1,
    '1840×960: фокусный ряд кончается на ' + user.rowBottomUp.toFixed(1) + ' вместо кромки 960');
});

/* Телевизор: что поменялось на нём. Клетка пользователя (крупный кадр,
   штатный масштаб, «обычный» размер) лежит ЗА границей расчётного зазора —
   ряд там длиннее места под ним, — и зазор равен штатному ROW_GAP: 28.5 px
   (2.5em при кегле 11.4055) вместо прежних расчётных 26. Следующий ряд
   начинается на 543.0 вместо 540.0, то есть уже за кромкой, а не на ней;
   низ подписи фокусного ряда (инвариант Task 51) от зазора не зависит. */
test('правило кромки: клетка телевизора пользователя — следующий ряд за кромкой, подпись на месте', () => {
  const built = withStorage({ lumen_scale: 'normal', lumen_hero_size: 'large', interface_size: 'normal' },
    (LC) => LC.buildCss());
  const got = rowLayout(built, 960, 540, { interface: 'normal' });
  assert.ok(Math.abs(got.rowGap - 2.5 * lampaEm(960, 'normal')) < 0.1,
    'зазор ' + got.rowGap.toFixed(1) + ' вместо штатных 2.5em');
  assert.ok(Math.abs(got.rowBottomUp - 543.0) < 1, 'следующий ряд начинается на ' + got.rowBottomUp.toFixed(1));
  assert.ok(Math.abs(got.flowBottomUp - 514.5) < 1, 'низ подписи в потоке ' + got.flowBottomUp.toFixed(1));
});

test('Фикс-раунд волны A: потолок масштаба карточки ряда режет только вниз и только по нужде', () => {
  const W = 960;
  const H = 540;
  const TEXT_LIMIT = 532;
  const WIDE_EM = 9.52;
  /* Своя копия таблицы масштабов — как и LAMPA_SIZES выше: тест проверяет
     плагин по внешнему числу, а не по тому же объекту, из которого плагин
     считает. */
  const SCALE_OF = { small: 0.9, normal: 1, large: 1.1, huge: 1.2 };
  const built = (scale, size, iface) => withStorage(
    { lumen_scale: scale, lumen_hero_size: size, interface_size: iface }, (LC) => LC.buildCss());
  const rowScale = (scale, size, iface) =>
    parseFloat(/(?:^|;)width:([0-9.]+)em/.exec(findDecl(built(scale, size, iface), (sel) => sel === '.lumen-main .card'))[1]) / WIDE_EM;
  const bottom = (scale, size, iface) =>
    rowLayout(built(scale, size, iface), W, H, { more: true, interface: iface }).textBottomUp;

  /* Цена одной сотой масштаба В ПИКСЕЛЯХ — замером по двум настоящим
     сборкам, а не формулой: «крупнее» со средним кадром, узкая колонка на
     обоих концах (8.88em и 9.68em), разница масштаба ровно .1. */
  const step = (bottom('huge', 'medium', 'bigger') - bottom('large', 'medium', 'bigger')) / 10;
  assert.ok(step > 1 && step < 3, 'цена сотой масштаба ' + step.toFixed(2) + ' px — замер перестал быть похож на правду');

  for (const iface of ['small', 'normal', 'bigger']) {
    for (const size of ['large', 'medium', 'compact']) {
      for (const scale of ['small', 'normal', 'large', 'huge']) {
        const label = iface + '/' + size + '/' + scale;
        const got = rowScale(scale, size, iface);
        const want = SCALE_OF[scale];

        /* Только вниз: потолок не вправе выдать больше выбранного. */
        assert.ok(got <= want + 0.001, label + ': масштаб карточки ' + got.toFixed(3) + ' БОЛЬШЕ выбранного ' + want);
        /* И не ниже самого мелкого значения самой настройки — подменять
           выбор пользователя тем, чего в списке нет, потолку не разрешено. */
        assert.ok(got >= SCALE_OF.small - 0.001, label + ': масштаб карточки ' + got.toFixed(3) + ' ниже самого мелкого в настройке');

        if (got > want - 0.001) continue;

        /* Раз потолок сработал — он обязан оправдаться бюджетом: на этой
           клетке подпись стоит почти у предела, то есть следующая сотая
           масштаба туда уже не влезала. Допуск — ДВЕ сотых, а не одна:
           предел этого теста (532 px) и кромка минус запас ROW_EDGE_AIR,
           из которой считает сам потолок (531.6 px), — разные числа, и
           разницу между ними записывать потолку в «лишнее» нечестно. */
        const slack = TEXT_LIMIT - bottom(scale, size, iface);
        assert.ok(slack >= 0, label + ': потолок сработал, а подпись всё равно за пределом');
        assert.ok(slack < 2 * step, label + ': потолок отобрал лишнего — под подписью осталось ' +
          slack.toFixed(1) + ' px при цене сотой ' + step.toFixed(2) + ' px');
      }
    }
  }

  /* Где потолок НЕ нужен — там его и нет: два размера интерфейса из трёх
     целиком, а на «крупнее» — оба кадра мельче крупного.
     Правка 2026-09-23 (разбор композиции, п.1.5): ограниченных клеток стало
     ДВЕ вместо трёх. Кнопка «Ещё» ушла из шапки ряда, шапка стала ниже на
     .57em (6.5 CSS px на стенде 960×540), и клетка «крупнее / крупный кадр /
     штатный масштаб» уложилась в бюджет сама — потолку там больше нечего
     резать. 34 клетки из 36 отдают ровно выбранный масштаб. */
  let capped = 0;
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const size of ['large', 'medium', 'compact']) {
      for (const scale of ['small', 'normal', 'large', 'huge']) {
        if (rowScale(scale, size, iface) < SCALE_OF[scale] - 0.001) capped++;
        else assert.ok(Math.abs(rowScale(scale, size, iface) - SCALE_OF[scale]) < 0.001,
          iface + '/' + size + '/' + scale + ': масштаб карточки разошёлся с выбранным без ограничения');
      }
    }
  }
  assert.equal(capped, 2, 'ограничено клеток: ' + capped + ' — после правки п.1.5 их ровно две (крупный кадр на «крупнее», масштаб «крупный» и «огромный»)');

  /* Цена ограничения названа числом, а не «где-то около»: на обеих клетках
     потолок один и тот же — 1.00, то есть «крупный» и «огромный» дают там
     ту же карточку, что «штатный». Это и есть то, что пользователю сказано
     в описании настройки (src/80_settings.js).
     До правки 2026-09-23 (п.1.5) потолок был .96 и захватывал заодно
     «штатный»: 6.5 CSS px высоты держала кнопка «Ещё» в шапке ряда. */
  for (const scale of ['normal', 'large', 'huge']) {
    assert.ok(Math.abs(rowScale(scale, 'large', 'bigger') - 1) < 0.001,
      'bigger/large/' + scale + ': потолок ' + rowScale(scale, 'large', 'bigger').toFixed(3) + ' вместо 1.00');
  }
  assert.ok(Math.abs(rowScale('small', 'large', 'bigger') - 0.9) < 0.001,
    'bigger/large/small: мелкий масштаб ниже потолка и обязан остаться нетронутым');
});

/* Фикс-раунд финального ревью (важное 1): оговорка про потолок в описании
   масштаба отсылала к «заставке» — то есть к «Заставке из кадров»
   (lumen_ambient), которая к потолку отношения не имеет и по умолчанию
   выключена вовсе. Пойдя по этому адресу, человек ничего похожего не нашёл
   бы и решил, что объяснение выдумано.

   Сторож проверяет обе половины: что потолок и вправду висит на размере
   кадра над рядами, а не на заставке, и что описание зовёт настройку ЕЁ ЖЕ
   именем из словаря — по одному разу на каждый из трёх языков. Имена берутся
   из LC.STRINGS, а не пишутся здесь литералами: переименуют настройку —
   тест упадёт вместе с разошедшимся описанием. */
test('Фикс-раунд финального ревью: оговорка про потолок масштаба называет ту настройку, которая его и вызывает', () => {
  const WIDE_EM = 9.52;
  const cardEm = (extra) => withStorage(
    Object.assign({ lumen_scale: 'huge', interface_size: 'bigger' }, extra),
    (LC) => parseFloat(/(?:^|;)width:([0-9.]+)em/
      .exec(findDecl(LC.buildCss(), (sel) => sel === '.lumen-main .card'))[1]));

  /* Причина потолка — размер КАДРА НАД РЯДАМИ: на «крупнее» с крупным кадром
     карточка выходит уже выбранного масштаба, со средним и компактным —
     ровно выбранная. */
  const capped = cardEm({ lumen_hero_size: 'large' });
  assert.ok(capped < WIDE_EM * 1.2 - 0.001,
    'крупный кадр перестал упираться в потолок — оговорке в описании больше нечего объяснять');
  for (const size of ['medium', 'compact']) {
    assert.ok(Math.abs(cardEm({ lumen_hero_size: size }) - WIDE_EM * 1.2) < 0.02,
      size + ': потолок дотянулся и до этого кадра — оговорка обязана назвать и его');
  }
  /* А заставка из кадров ширину карточки ряда не двигает ни включённой, ни
     выключенной: сославшись на неё, описание отправляло бы не по адресу. */
  for (const on of [true, false]) {
    assert.equal(cardEm({ lumen_hero_size: 'large', lumen_ambient: on }), capped,
      'заставка из кадров (' + on + ') меняет ширину карточки ряда');
  }

  const S = withStorage({}, (LC) => LC.STRINGS);
  const descr = S.lumen_scale_descr;
  /* Кавычки те же, что в самих строках: русская и украинская «ёлочка»,
     английские прямые. */
  const quote = { ru: ['«', '»'], uk: ['«', '»'], en: ['"', '"'] };
  /* След заставки в любом виде — и её имя целиком, и корень слова: en
     «backdrop» в этом проекте означает фон карточки, а не кадр над рядами. */
  const forbidden = { ru: ['аставк'], uk: ['аставк'], en: ['backdrop'] };
  for (const lang of ['ru', 'en', 'uk']) {
    const text = descr[lang];
    assert.ok(text, lang + ': описания нет вовсе');
    const q = quote[lang];
    for (const key of ['lumen_hero_size_name', 'lumen_hero_size_large']) {
      const name = S[key][lang];
      assert.ok(text.indexOf(q[0] + name + q[1]) !== -1,
        lang + ': в оговорке нет настройки ' + q[0] + name + q[1] + ' (' + key + '): ' + text);
    }
    assert.equal(text.indexOf(S.lumen_ambient_name[lang]), -1,
      lang + ': оговорка снова отсылает к заставке из кадров: ' + text);
    for (const bad of forbidden[lang]) {
      assert.equal(text.toLowerCase().indexOf(bad), -1,
        lang + ': в оговорке снова след заставки («' + bad + '»): ' + text);
    }
  }
});

/* «Крупнее» и «огромный» сами по себе в экран не помещаются: блок ряда
   растёт вместе с масштабом интерфейса, а место под него задано долями
   ЭКРАНА (комментарий к HERO_VH в src/30_css.js). Лечит это медиазапрос,
   переводящий карточку на 8-ю колонку сетки Apple (8.07em против 9.52em у
   седьмой, docs/research/2026-09-21-tv-design-specs.md §1); порог считается
   из той же цепочки высот, по которой считает весь тест выше. */
test('Task 51: узкая колонка включается порогом из цепочки высот, а не на глаз', () => {
  const W = 960;
  /* Ревью волны A (важное 1): порог считается из ширины экрана в em, а её
     задаёт не только окно, но и «Размер интерфейса» Lampa — 90.57em на
     «мельче» (при 960 px действует пол кегля 10.6), 84.17 на «обычном»,
     80.16 на «крупнее» (screenEm, src/30_css.js). Поэтому проверка гоняется по обеим осям сразу: до
     правки порог был один и тот же на все три размера, то есть на двух из
     них включался не там, где кончается место. */
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const scale of ['small', 'normal', 'large', 'huge']) {
      const built = withStorage({ lumen_scale: scale, interface_size: iface }, (LC) => LC.buildCss());
      const label = iface + '/' + scale;
      const EM = lampaEm(W, iface);
      /* Узкая колонка — ширина в em; полосы подгонки под окно (ревью
         фикс-раунда, п.4) — calc с vh, их сторожит проход ниже. */
      const narrowRules = ruleBodiesWithMedia(built).filter((r) => r.media &&
        r.selectors.some((sel) => sel === '.lumen-main .card') && /(?:^|;)width:[0-9.]+em/.test(r.decl));
      assert.equal(narrowRules.length, 1, label + ': медиазапрос узкой колонки обязан быть ровно один');

      /* Ширина за порогом — восьмая колонка той же сетки: отношение к базовой
         обязано быть 8.07/9.52 при любом масштабе интерфейса. */
      const narrow = parseFloat(/(?:^|;)width:([0-9.]+)em/.exec(narrowRules[0].decl)[1]);
      const wide = lengthPx(cascade(matchingRules(built, ['lumen-main'], ['card'], 100, 100), 'width').value, 1, 0);
      assert.ok(narrow < wide, label + ': за порогом карточка обязана быть УЖЕ базовой (' + narrow + ' против ' + wide + ')');
      assert.ok(Math.abs(narrow / wide - 8.07 / 9.52) < 0.005,
        label + ': за порогом не восьмая колонка сетки — ' + narrow + 'em при базовых ' + wide + 'em');

      /* Порог согласован с раскладкой: ЧУТЬ ВЫШЕ него (окно ещё не такое
         приплюснутое, правило не сработало) широкая карточка обязана
         помещаться, но уже впритык — низ подписи не дальше 1.5em от кромки.
         Это и значит «порог посчитан из цепочки, а не назначен». */
      const ratio = parseInt(/min-aspect-ratio:(\d+)\/100/.exec(narrowRules[0].media)[1], 10) / 100;
      const at = (aspect) => {
        const height = Math.round(W / aspect);
        return { height: height, box: rowLayout(built, W, height, { more: true, interface: iface }) };
      };
      const before = at(ratio - 0.01);
      const slack = before.height - before.box.textBottomUp;
      assert.ok(slack >= 0, label + ': до порога ' + ratio + ' широкая карточка уже не помещается (срез ' + (-slack).toFixed(1) + ' px)');
      assert.ok(slack <= 1.5 * EM, label + ': порог ' + ratio + ' запаздывает — до него ещё ' + slack.toFixed(1) + ' px запаса');
      /* А за порогом помещается узкая — иначе правило меняло бы ширину впустую. */
      const after = at(ratio + 0.02);
      assert.ok(after.height - after.box.textBottomUp >= 0,
        label + ': за порогом ' + ratio + ' узкая колонка тоже не помещается');
      /* Ревью фикс-раунда (п.4): «+0.02 за порогом» — это одна точка. Подпись
         обязана держаться на ВСЁМ диапазоне дальше — через порог «кадра нет»
         и за ним, с профилями настроения и без, — с воздухом ROW_EDGE_AIR до
         кромки. Шаг .01 отношения сторон, до 3.6 (32:9). */
      for (let aspect = ratio + 0.01; aspect <= 3.6; aspect += 0.01) {
        const height = Math.round(W / aspect);
        for (const moods of [false, true]) {
          const box = rowLayout(built, W, height, { interface: iface, moods: moods });
          assert.ok(box.textBottomUp <= height - 0.7 * EM + 0.5, label + (moods ? '/чипы' : '') + ': при ' + aspect.toFixed(2) +
            ':1 низ подписи ' + box.textBottomUp.toFixed(1) + ' при пределе ' + (height - 0.7 * EM).toFixed(1));
          /* Подгонка только режет: карточка не шире выбранной колонки. */
          assert.ok(box.cardW <= narrow + 0.02, label + ': при ' + aspect.toFixed(2) + ':1 карточка ' + box.cardW.toFixed(2) +
            'em шире узкой колонки ' + narrow + 'em');
        }
      }
    }
  }

  /* На штатном масштабе телевизор 16:9 порога не достигает — там широкая
     карточка помещается сама (525.0 при пределе 532), и сужать её значило бы
     отобрать у постера 25 px без причины. */
  const normal = withStorage({ lumen_scale: 'normal' }, (LC) => LC.buildCss());
  const media = ruleBodiesWithMedia(normal).find((r) => r.media &&
    r.selectors.some((sel) => sel === '.lumen-main .card') && /(?:^|;)width:[0-9.]+em/.test(r.decl));
  assert.ok(1920 / 1080 < parseInt(/min-aspect-ratio:(\d+)\/100/.exec(media.media)[1], 10) / 100,
    'на штатном масштабе узкая колонка не должна включаться на 16:9: ' + media.media);
});

/* Правило, которым раскладка опускает ряды под полосу чипов настроения,
   жило ТОЛЬКО внутри медиазапроса min-aspect-ratio (ветка «окно
   приплюснуто, кадра нет»), где герой превращался в полосу чипов. Волна 3
   (ТВ 2026-09-24): чипов в герое нет, и при смонтированном герое (корень с
   .lumen-main) LC.moods их не ставит вовсе — правил под
   .lumen-moods-on.lumen-main не должно быть нигде, ни в медиазапросе, ни вне
   его: выедь такое правило наружу, раскладка главной поехала бы вниз на
   MOODS_BAR. Сам .lumen-hero — position:absolute с overflow:hidden, места в
   потоке не занимает. */
test('Task 51 + волна 3: правил полосы чипов для главной с героем нет нигде', () => {
  const built = withStorage({ lumen_scale: 'normal' }, (LC) => LC.buildCss());
  const moodsMain = ruleBodiesWithMedia(built).filter((r) =>
    r.selectors.some((sel) => sel.indexOf('.lumen-moods-on.lumen-main') === 0));
  assert.deepEqual(moodsMain.map((r) => (r.media || '') + ' ' + r.selectors.join(',')), [], 'правило чипов для главной с героем');
  const hero = decl(built, '.lumen-hero');
  assert.ok(hero.indexOf('position:absolute') !== -1 && hero.indexOf('overflow:hidden') !== -1,
    'кадр героя обязан оставаться вне потока — иначе его содержимое начнёт двигать ряды: ' + hero);
});


/* -------------------------------------------------------------------- */
/* Волна 3 (проверка на ТВ 2026-09-24): кадр героя на весь экран.         */
/*                                                                        */
/* Жалобы пользователя по фото с телевизора: тёмная подушка под текстом   */
/* обрывается вертикальной границей на 614 px из 960 (фото 15/16 — «ведите */
/* до конца»), кадр 16:9 в блоке 66.67vh режет головы, а в сжатом          */
/* состоянии ещё и уезжает вверх (фото 17). Решение: кадр — в неподвижном  */
/* слое .lumen-hero-stage на весь экран, затемнение — три градиента того   */
/* же слоя без единой кромки. Высота .lumen-hero, текст и ряды — прежние.  */
/* -------------------------------------------------------------------- */

/* Слой кадра стоит от верхней кромки экрана до нижней и в покое, и при
   фокусе в рядах. Модель — та же, что у раскладки героя выше: .activitys
   начинается на 4em ниже верха экрана, слой поднят на -4em и высотой в
   экран; правил сжатого состояния, которые двигали бы его или его кадры,
   нет ни одного. */
test('волна 3: слой кадра неподвижен и стоит 0…540 CSS px и в покое, и в сжатом состоянии', () => {
  const W = 960;
  const H = 540;
  const EM = W / 84.17;
  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const stage = decl(built, '.lumen-hero-stage');
    assert.ok(stage, size + ': правила слоя кадра нет');
    for (const need of ['position:absolute', 'left:0', 'right:0', 'overflow:hidden', 'pointer-events:none']) {
      assert.ok(new RegExp('(?:^|;)' + need + '(;|$)').test(stage), size + ': у слоя кадра нет ' + need + ': ' + stage);
    }
    assert.equal(/transform|transition|will-change/.test(stage), false, size + ': слой кадра двигается или заводит себе слой композитора: ' + stage);
    const topEm = parseFloat(/(?:^|;)top:(-?[\d.]+)em/.exec(stage)[1]);
    const heightVh = parseFloat(/(?:^|;)height:([\d.]+)vh/.exec(stage)[1]);
    /* Ничто не трогает слой и его картинки в сжатом состоянии: ни класс
       сжатия героя, ни подъём рядов. Единственное правило состояния в слое —
       прозрачность пола (он и должен появиться под поднятыми рядами). */
    const stateful = ruleBodies(built).filter((r) => r.selectors.some((s) => /lumen-hero-stage|lumen-hero__(bg|lqip|trailer|scrim|floor)/.test(s) &&
      /lumen-hero--compact|lumen-rows-up/.test(s)));
    assert.deepEqual(stateful.map((r) => r.selectors.join(',') + '{' + r.decl + '}'), ['.lumen-main.lumen-rows-up .lumen-hero__floor{opacity:1}'],
      size + ': в сжатом состоянии слой кадра обязан стоять на месте');
    for (const state of ['покой', 'сжатое']) {
      const top = 4 * EM + topEm * EM;
      const bottom = top + heightVh * H / 100;
      assert.ok(Math.abs(top) < 0.01 && Math.abs(bottom - H) < 0.01, size + ', ' + state + ': слой кадра ' + top.toFixed(1) + '…' + bottom.toFixed(1) + ' вместо 0…540');
    }
    /* Кадры и подложка — во весь слой, обрезка cover с точкой 25 %. */
    const img = decl(built, '.lumen-hero-stage .lumen-hero__bg');
    for (const need of ['top:0', 'left:0', 'width:100%', 'height:100%', 'object-fit:cover', 'object-position:center 25%']) {
      assert.ok(new RegExp('(?:^|;)' + need + '(;|$)').test(img), size + ': у кадра нет ' + need + ': ' + img);
    }
  }
  /* Сам герой — прежний: высота две трети экрана, сжатие — его сдвиг. */
  assert.ok(decl(css, '.lumen-hero').indexOf('height:66.67vh') !== -1, 'высота блока героя (HERO_VH) не меняется');
  /* Слой кадра — СОСЕД героя: правил вида «.lumen-hero .lumen-hero__bg» —
     кадров внутри сжимающегося блока — не осталось. */
  assert.deepEqual(ruleSelectors(css).filter((s) => /\.lumen-hero[ .][^,]*lumen-hero__(bg|lqip|trailer)/.test(s) && s.indexOf('lumen-hero-stage') === -1), [],
    'кадры героя всё ещё лежат в сжимающемся блоке');
});

/* Левое затемнение — подушка под текстом — уходит в ноль ровно у ПРАВОЙ
   кромки экрана: ни полки полной плотности с обрывом (прежняя вуаль: .94 до
   64 % ширины и ноль к 78 %), ни ступени. Наклон кривой ограничен: .025 на
   1 % ширины — у прежней вуали было .067, это и была видимая граница. */
test('волна 3: левое затемнение уходит в ноль у правой кромки экрана — полки с обрывом нет', () => {
  const rule = decl(css, '.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l');
  assert.ok(rule, 'левого затемнения в слое кадра нет');
  const layers = gradients(rule, 'background');
  assert.equal(layers.length, 1, 'у левого затемнения один градиент: ' + rule);
  assert.equal(layers[0].angle, '90deg', 'левое затемнение идёт слева направо: ' + rule);
  const stops = layers[0].stops;
  assert.ok(stops.every((s) => s.unit === '%'), 'стопы — в процентах ширины: ' + rule);
  assert.equal(stops[0].pos, 0);
  assert.ok(stops[0].a >= 0.9, 'у левой кромки подушка плотная: ' + stops[0].a);
  const last = stops[stops.length - 1];
  assert.equal(last.pos, 100, 'затемнение обязано доходить до правой кромки: последний стоп на ' + last.pos + ' %');
  assert.equal(last.a, 0, 'у правой кромки затемнения нет');
  assert.equal(stops.slice(0, -1).filter((s) => s.a === 0).length, 0, 'затемнение кончается раньше правой кромки');
  const slopes = [];
  for (let i = 1; i < stops.length; i++) {
    const a = stops[i - 1];
    const b = stops[i];
    assert.ok(b.a <= a.a, 'плотность растёт на ' + b.pos + ' %: ' + rule);
    const slope = (a.a - b.a) / (b.pos - a.pos);
    assert.ok(slope <= 0.025, 'обрыв между ' + a.pos + ' и ' + b.pos + ' %: ' + slope.toFixed(3) + ' на 1 % ширины');
    slopes.push(slope);
  }
  /* Ревью волны 3, п.4 списка: «без видимой полки». Градиент кусочно-
     линейный, и на глаз видна не плотность, а излом — резкая смена наклона
     в стопе. Излом не резче, чем у кривой волны 3 в её колене (52 %:
     .0036 → .0183 на 1 % ширины, разница .0147).
     Ревью правок волны 3, п.4: в ОБЕ стороны. Сторож считал только рост
     наклона, а резкое выполаживание — та же видимая граница: кривая,
     круто падающая и вдруг почти плоская, даёт полку у правой кромки
     (так, стоп .05 вместо .09 на 91 % — наклон .0233 → .0056 — проходил). */
  for (let i = 1; i < slopes.length; i++) {
    assert.ok(Math.abs(slopes[i] - slopes[i - 1]) <= 0.015, 'излом в стопе ' + stops[i].pos + ' %: наклон ' + slopes[i - 1].toFixed(4) + ' → ' + slopes[i].toFixed(4));
  }
  assert.ok(rule.indexOf('-webkit-linear-gradient(left,') !== -1, 'старым webkit-движкам нужен префиксный градиент: ' + rule);
  /* По высоте затемнение ограничивает маска — фон несёт одно направление,
     маска другое; mask-composite в WebView телевизора не проверен. */
  const mask = ruleBodies(css).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l' &&
    r.decl.indexOf('mask-image') !== -1);
  assert.ok(mask, 'у левого затемнения нет вертикальной маски');
  const m = gradients(mask.decl, 'mask-image');
  assert.equal(m.length, 1);
  assert.equal(m[0].angle, '180deg', 'маска идёт сверху вниз: ' + mask.decl);
  assert.equal(m[0].stops[m[0].stops.length - 1].a, 1, 'ниже маски затемнение полное: ' + mask.decl);
  assert.ok(mask.decl.indexOf('-webkit-mask-image:-webkit-linear-gradient(top,') !== -1, 'нужна префиксная маска: ' + mask.decl);
  assert.equal(/mask-composite/.test(mask.decl), false);
  /* Вуалей героя больше нет нигде — ни правил, ни их наследства. */
  assert.deepEqual(ruleSelectors(css).filter((s) => s.indexOf('lumen-hero__veil') !== -1), [], 'в таблице остались вуали героя');
});

/* Низ кадра в покое растворяется ровно так же, как до волны 3: стопы
   затемнения — это стопы прежней маски кадра (.10 картинки на 6 % высоты
   блока героя от его низа, .42 на 16 %, .78 на 28 %, сплошной кадр с 40 %),
   пересчитанные в проценты экрана. Ниже блока героя — сплошной фон: кадра
   там не было и раньше. Масок на самих картинках больше нет. Верхняя
   полоса под шапкой Lampa — числа прежней верхней вуали. */
test('волна 3: в покое низ кадра растворяется на стопах прежней маски, верх — под шапкой Lampa', () => {
  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const heroVh = parseFloat(/height:([\d.]+)vh/.exec(decl(built, '.lumen-hero'))[1]);
    const rule = (ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__scrim' && r.decl.indexOf('background') !== -1) || {}).decl;
    assert.ok(rule, size + ': затемнения слоя кадра нет');
    const layers = gradients(rule, 'background');
    assert.equal(layers.length, 2, size + ': у затемнения два слоя — верх и низ: ' + rule);
    const top = layers.find((l) => l.angle === '180deg');
    const bottom = layers.find((l) => l.angle === '0deg');
    assert.ok(top && bottom, size + ': направления слоёв затемнения: ' + rule);
    assert.deepEqual(top.stops.map((s) => [s.a, s.pos, s.unit]), [[0.5, 0, ''], [0.5, 3.96, 'em'], [0, 9, 'em']],
      size + ': полоса под шапкой Lampa разошлась с прежней верхней вуалью');
    const solid = 100 - heroVh;
    const expected = [[1, 0], [1, solid], [0.9, solid + 0.06 * heroVh], [0.58, solid + 0.16 * heroVh], [0.22, solid + 0.28 * heroVh], [0, solid + 0.4 * heroVh]];
    assert.equal(bottom.stops.length, expected.length, size + ': число стопов низа: ' + rule);
    bottom.stops.forEach((s, i) => {
      assert.equal(s.a, expected[i][0], size + ': стоп ' + i + ' низа: ' + JSON.stringify(s));
      assert.ok(Math.abs(s.pos - expected[i][1]) < 0.02, size + ': стоп ' + i + ' низа на ' + s.pos + ' % вместо ' + expected[i][1].toFixed(2));
    });
    assert.ok(rule.indexOf('-webkit-linear-gradient(top,') !== -1 && rule.indexOf('-webkit-linear-gradient(bottom,') !== -1,
      size + ': старым webkit-движкам нужны префиксные градиенты: ' + rule);
  }
  assert.deepEqual(ruleBodies(css).filter((r) => r.selectors.some((s) => /lumen-hero__(bg|lqip|trailer)/.test(s)) && /mask/.test(r.decl))
    .map((r) => r.selectors.join(',')), [], 'маска на картинках кадра осталась — затемнение теперь в слое');
});

/* Пол сжатого состояния: кадр больше не уезжает вверх, и под поднятыми
   рядами его закрывает сплошной фон. Сплошная часть обязана накрыть верх
   области рядов — там её верхний градиент-заливка (:after) начинается
   сплошным цветом, и без пола его кромка легла бы на кадр. Верх области
   отмерен в em (margin-top: calc(Xvh − Yem) плюс шапка Lampa 4em), поэтому
   и бокс пола начинается calc'ом: проверяем на окнах от 4:3 до 2.9:1 и при
   всех трёх «Размерах интерфейса» Lampa. Затухание над сплошной частью —
   монотонное, без ступеней. Переход — только в полном режиме; в lite пол
   встаёт сразу. */
test('волна 3: пол сжатого состояния накрывает верх поднятых рядов без кромки', () => {
  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const rule = ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__floor' && r.decl.indexOf('background') !== -1);
    assert.ok(rule, size + ': у пола нет градиента');
    const layers = gradients(rule.decl, 'background');
    assert.equal(layers.length, 1);
    assert.equal(layers[0].angle, '180deg', size + ': пол отмерен сверху своего бокса');
    const stops = layers[0].stops;
    assert.ok(stops.every((s) => s.unit === 'vh'), size + ': затухание пола — в долях экрана: ' + rule.decl);
    assert.equal(stops[0].a, 0, size + ': пол начинается прозрачностью');
    assert.equal(stops[stops.length - 1].a, 1, size + ': пол кончается сплошным фоном');
    for (let i = 1; i < stops.length; i++) {
      assert.ok(stops[i].a >= stops[i - 1].a, size + ': ступень в затухании пола: ' + rule.decl);
      assert.ok((stops[i].a - stops[i - 1].a) / (stops[i].pos - stops[i - 1].pos) <= 0.12, size + ': обрыв в затухании пола: ' + rule.decl);
    }
    const box = ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__floor' && /(?:^|;)top:calc/.test(r.decl));
    assert.ok(box, size + ': у пола нет своего верха');
    const top = /(?:^|;)top:calc\(([\d.]+)vh - ([\d.]+)em\)/.exec(box.decl);
    assert.ok(top && box.decl.indexOf('top:-webkit-calc(') !== -1, size + ': верх пола: ' + box.decl);
    const rows = decl(built, '.lumen-main .scroll.layer--wheight');
    const mt = /margin-top:calc\(([\d.]+)vh - ([\d.]+)em\)/.exec(rows);
    const solidVh = stops[stops.length - 1].pos;
    for (const [w, h] of [[1024, 768], [1920, 1200], [1920, 1080], [960, 540], [2560, 1080], [2900, 1000]]) {
      for (const k of [0.9, 1, 1.05]) {
        const em = Math.max(w / 84.17 * k, 10.6);
        const areaTop = 4 * em + parseFloat(mt[1]) * h / 100 - parseFloat(mt[2]) * em;
        const solidFrom = parseFloat(top[1]) * h / 100 - parseFloat(top[2]) * em + solidVh * h / 100;
        assert.ok(solidFrom <= areaTop - 0.25 * em, size + ', ' + w + '×' + h + ', кегль ×' + k + ': верх поднятых рядов на ' +
          areaTop.toFixed(1) + ' px, а сплошной пол — только с ' + solidFrom.toFixed(1));
      }
    }
  }
  assert.equal(decl(css, '.lumen-hero-stage .lumen-hero__floor'), 'position:absolute;top:0;left:0;right:0;bottom:0');
  const hidden = ruleBodies(css).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__floor' && /(?:^|;)opacity:0(;|$)/.test(r.decl));
  assert.ok(hidden, 'в покое пол не спрятан');
  assert.equal(findDecl(css, (s) => s === '.lumen-main.lumen-rows-up .lumen-hero__floor'), 'opacity:1');
  const soft = findDecl(css, (s) => s === '.lumen-hero-stage.lumen-motion-full .lumen-hero__floor');
  assert.ok(soft && soft.indexOf('transition:opacity .42s cubic-bezier(.2,.8,.2,1)') !== -1, 'пол проявляется той же кривой, что едут текст и ряды: ' + soft);
  /* В lite у слоя кадра нет ни одного перехода: всё, что анимирует его
     детей, стоит под классом полного режима. */
  const lite = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('lumen-hero-stage') !== -1) &&
    /transition|animation/.test(r.decl) && !r.selectors.every((s) => s.indexOf('lumen-motion-full') !== -1));
  assert.deepEqual(lite.map((r) => r.selectors.join(',')), [], 'у слоя кадра переход вне полного режима');
});

/* Ролик — 16:9-бокс, накрывающий слой кадра целиком (cover): max(100vw,
   177.78vh) × max(56.25vw, 100vh) по центру экрана. На экране 16:9 это
   ровно экран. Маски у ролика нет, и сам бокс за экран не выходит.
   Ревью волны 3, п.5: iframe ролика — с запасом ±10 % со всех краёв
   бокса, обрезанным его overflow. Без запаса при паузе и буферизации
   заголовок YouTube ложился под шапку Lampa, а у ролика 2.39:1 были видны
   чёрные полосы: YouTube вписывает ролик по ширине, и запас только по
   высоте полос не убирает. */
test('волна 3: ролик героя — 16:9-бокс, накрывающий слой кадра, без маски; iframe с запасом ±10 % со всех краёв', () => {
  const box = decl(css, '.lumen-hero-stage .lumen-hero__trailer');
  assert.ok(box, 'правила слоя ролика в слое кадра нет');
  assert.equal(/-10%/.test(box), false, 'запас попал на бокс ролика — слой вырос за экран: ' + box);
  assert.equal(/mask/.test(box), false, 'у ролика снова своя маска: ' + box);
  assert.ok(/(?:^|;)overflow:hidden/.test(box), 'бокс ролика обязан обрезать запас iframe: ' + box);
  const frame = decl(css, '.lumen-hero-stage .lumen-hero__trailer iframe');
  for (const need of ['position:absolute', 'top:-10%', 'left:-10%', 'width:120%', 'height:120%', 'border:0', 'pointer-events:none']) {
    assert.ok(new RegExp('(?:^|;)' + need + '(;|$)').test(frame), 'у iframe ролика нет ' + need + ': ' + frame);
  }
  assert.equal(/mask/.test(frame), false, 'у iframe ролика маска: ' + frame);
  const num = (re) => parseFloat(re.exec(box)[1]);
  const w = num(/(?:^|;)width:([\d.]+)vw/);
  const h = num(/(?:^|;)height:([\d.]+)vw/);
  const minW = num(/min-width:([\d.]+)vh/);
  const minH = num(/min-height:([\d.]+)vh/);
  assert.ok(/(?:^|;)top:50%/.test(box) && /(?:^|;)left:50%/.test(box) && /[^-]transform:translate\(-50%,-50%\)/.test(box), 'бокс ролика не по центру экрана: ' + box);
  for (const [W, H] of [[960, 540], [1920, 1200], [2560, 1080], [1280, 1024]]) {
    const bw = Math.max(w * W / 100, minW * H / 100);
    const bh = Math.max(h * W / 100, minH * H / 100);
    assert.ok(Math.abs(bw / bh - 16 / 9) < 0.01, W + '×' + H + ': бокс ролика не 16:9 — ' + bw.toFixed(1) + '×' + bh.toFixed(1));
    assert.ok(bw >= W - 0.5 && bh >= H - 0.5, W + '×' + H + ': ролик не накрывает экран — ' + bw.toFixed(1) + '×' + bh.toFixed(1));
    /* Верх iframe (там заголовок YouTube при паузе и буферизации) — выше
       кромки экрана на запас и на то, что бокс срезал сверху. */
    const above = 0.1 * bh + (bh - H) / 2;
    assert.ok(above >= 0.1 * H - 0.5, W + '×' + H + ': верх iframe всего на ' + above.toFixed(1) + ' px выше кромки');
    /* Ролик 2.39:1: iframe 16:9 (1.2 бокса), YouTube вписывает ролик по
       ширине. Чёрная полоса сверху, оставшаяся на экране (на 960×540 — 29
       px, без запаса было 69), не выходит ниже полосы шапки Lampa (верхнее
       затемнение .5, 3.96em): там она приглушена, но видна — шапка
       прозрачна (ревью правок волны 3, п.3). */
    const ih = 1.2 * bh;
    const band = (ih - 1.2 * bw / 2.39) / 2 - above;
    const head = 3.96 * lampaEm(W, 'normal');
    assert.ok(band <= head, W + '×' + H + ': полоса ролика 2.39:1 на ' + band.toFixed(1) + ' px ниже кромки — ниже шапки (' + head.toFixed(1) + ')');
  }
  assert.ok(box.indexOf('opacity:0') !== -1, 'до старта ролика слой невидим');
  assert.equal(/inset\s*:/.test(box), false, 'inset запрещён планом');
  assert.equal(findDecl(css, (s) => s === '.lumen-hero-stage .lumen-hero__trailer.is-live'), 'opacity:1');
  const fade = findDecl(css, (s) => s === '.lumen-hero-stage.lumen-motion-full .lumen-hero__trailer');
  assert.ok(fade && fade.indexOf('transition:opacity 1s ease') !== -1, 'в полном режиме ролик проявляется за 1 с: ' + fade);
  const dim = findDecl(css, (s) => s === '.lumen-hero-stage.lumen-hero-stage--trailer .lumen-hero__bg.is-active');
  assert.ok(dim && dim.indexOf('opacity:.25') !== -1, 'под играющим роликом кадр приглушается: ' + dim);
  assert.ok(findDecl(css, (s) => s === '.lumen-hero.lumen-hero--trailer .lumen-hero__descr').indexOf('display:none') !== -1, 'под роликом описание уходит');
});

/* Правка пользователя 2026-09-17 (п.2): четыре размера героя. Task 36: доли
   экрана заданы прямо, поэтому одинаковы на любом разрешении и при любом
   масштабе интерфейса. */
test('Task 36: размер героя — настройка, доли экрана 66.67 / 56 / 45 % в старте', () => {
  const sizes = (value) => {
    const built = withStorage(value ? { lumen_hero_size: value } : {}, (LC) => LC.buildCss());
    const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
    const hero = ruleBodies(built).find(only('.lumen-hero')).decl;
    const compact = ruleBodies(built).find(only('.lumen-hero.lumen-hero--compact')).decl;
    const full = parseFloat(/height:([\d.]+)vh/.exec(hero)[1]);
    const shift = parseFloat(/transform:translateY\(-([\d.]+)vh\)/.exec(compact)[1]);
    return [full, Math.round((full - shift) * 100) / 100];
  };
  /* Пользователь на живом телевизоре: «половина экрана, если не больше».
     Крупный — две трети в старте и ровно половина при листании; средний и
     компактный — те же две трети от меньшей базы. */
  assert.deepEqual(sizes('large'), [66.67, 50]);
  assert.deepEqual(sizes('medium'), [56, 42]);
  assert.deepEqual(sizes('compact'), [45, 34]);
  assert.deepEqual(sizes(null), [66.67, 50], 'по умолчанию — крупный (правка второго круга)');
  assert.deepEqual(sizes('мусор'), [66.67, 50], 'незнакомое значение — значение по умолчанию, а не «выключено»');
  /* Масштаб интерфейса долю экрана не трогает: это доля ЭКРАНА, а не текста. */
  for (const scale of ['small', 'huge']) {
    const built = withStorage({ lumen_scale: scale }, (LC) => LC.buildCss());
    const hero = ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero').decl;
    assert.ok(hero.indexOf('height:66.67vh') !== -1, scale + ': масштаб интерфейса изменил долю экрана под кадр');
  }
});

/* Правка пользователя 2026-09-17 (п.1): уехавший вверх ряд не оставляет от
   себя подписей с годом поперёк экрана.
   Task 38: до этой задачи хвост гасила маска — наши стопы поверх штатной
   .scroll--mask Lampa. Маску сняли целиком (внутри узла ездит .scroll__body,
   и маска на родителе заставляет WebView пересобирать буфер на каждый кадр
   листания), а хвост закрывает статический градиент-оверлей. Тест поэтому
   требует ровно обратного прежнему: mask-image:none на самом узле и
   градиент на его :after. */
test('Task 38: маска области рядов снята, хвост уехавшего ряда закрывает статический градиент', () => {
  const rows = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  assert.ok(rows.indexOf('overflow:hidden') !== -1, 'нет обрезки области рядов: ' + rows);
  /* Гасится и НАША маска, и штатная Lampa: селектор специфичнее .scroll--mask,
     иначе покадровый проход композитора остался бы с её стопами. */
  assert.ok(rows.indexOf('-webkit-mask-image:none') !== -1, 'нужна префиксная запись — на движках ТВ работает именно она: ' + rows);
  assert.ok(/[^-]mask-image\s*:\s*none/.test(rows), 'нужна и беспрефиксная mask-image:none: ' + rows);
  assert.equal(/mask-image\s*:\s*(-webkit-)?linear-gradient/.test(rows), false, 'маски-градиента на движущейся области быть не должно: ' + rows);
  assert.ok(rows.indexOf('position:relative') !== -1, 'без точки отсчёта градиент-оверлей уехал бы к чужому предку: ' + rows);

  /* Оверлей: высота ровно 2.5em (отступ, который Lampa держит над фокусным
     рядом) и полная прозрачность ровно на 2.5em — раньше срезало бы
     фокусный ряд, позже хвост остался бы читаемым. */
  const rulesFade = ruleBodies(css).filter((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-main .scroll.layer--wheight:after');
  assert.equal(rulesFade.length, 2, 'ожидались два правила оверлея: геометрия и цвет из accentRules');
  const geom = rulesFade.map((r) => r.decl).join(';');
  assert.ok(geom.indexOf('height:2.5em') !== -1, 'высота оверлея обязана совпадать с отступом Lampa: ' + geom);
  assert.ok(geom.indexOf('pointer-events:none') !== -1, 'оверлей не должен ловить фокус: ' + geom);
  assert.ok(geom.indexOf('opacity:0') !== -1, 'в стартовом состоянии оверлей погашен — под ним кадр героя: ' + geom);
  assert.ok(/background:linear-gradient\(to bottom,#[0-9A-Fa-f]{6} 0,#[0-9A-Fa-f]{6} 2em,rgba\([\d, ]+,0\) 2\.5em\)/.test(geom),
    'нет градиента цвета страницы с полной прозрачностью на 2.5em: ' + geom);
  assert.ok(geom.indexOf('-webkit-linear-gradient(top,') !== -1, 'старым webkit-движкам нужен префиксный градиент: ' + geom);

  const up = findDecl(css, (sel) => sel === '.lumen-main.lumen-rows-up .scroll.layer--wheight:after');
  assert.ok(up && up.indexOf('opacity:1') !== -1, 'оверлей проявляется вместе с подъёмом рядов: ' + up);

  /* Нижнее затухание, которое раньше давала штатная маска Lampa (92→100 %),
     теперь отдельный неподвижный оверлей на самой активности. */
  const bottom = ruleBodies(css).filter((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-main:after');
  assert.equal(bottom.length, 2, 'ожидались два правила нижнего оверлея: геометрия и цвет из accentRules');
  const bDecl = bottom.map((r) => r.decl).join(';');
  assert.ok(bDecl.indexOf('bottom:0') !== -1 && bDecl.indexOf('height:2.5em') !== -1, 'нижний оверлей стоит на кромке экрана: ' + bDecl);
  assert.ok(bDecl.indexOf('pointer-events:none') !== -1, 'нижний оверлей не должен ловить фокус: ' + bDecl);
  assert.ok(bDecl.indexOf('-webkit-linear-gradient(bottom,') !== -1, 'нужен и префиксный градиент: ' + bDecl);

  const low = heroOffMedia(css);
  assert.ok(low.indexOf('overflow:hidden') !== -1, 'на низком окне область тоже обрезана: ' + low);
});

test('Task 36: кромка сжатого кадра и заголовок первого ряда сходятся при любом размере', () => {
  /* Верх области = 4em (шапка Lampa) + margin-top, заголовок первого ряда —
     ещё на 2.5em ниже (отступ, который Lampa держит над фокусным рядом
     сама). Кромка сжатого кадра = ROWS_TOP_VH. Между ними обязан быть ровно
     ROWS_AIR: больше — под кадром зияет полоса, меньше — заголовок ряда
     лип бы к кромке картинки.

     Считается это уже не в em (как до Task 36), а в смеси vh и em, поэтому
     сравниваются отдельно доли экрана и отдельно добавки в em. */
  const AIR = 1.5;
  const LAMPA_PAD = 2.5;
  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    /* Правило масштаба перечисляет корни списком, и .lumen-hero есть среди
       них — здесь нужно правило, где этот корень единственный. */
    const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
    const hero = ruleBodies(built).find(only('.lumen-hero')).decl;
    const compact = ruleBodies(built).find(only('.lumen-hero.lumen-hero--compact')).decl;
    const rows = ruleBodies(built).filter(only('.lumen-main .scroll.layer--wheight'))[0].decl;

    const heroVh = parseFloat(/height:([\d.]+)vh/.exec(hero)[1]);
    const shiftVh = parseFloat(/transform:translateY\(-([\d.]+)vh\)/.exec(compact)[1]);
    const marginVh = parseFloat(/margin-top:calc\(([\d.]+)vh - [\d.]+em\)/.exec(rows)[1]);
    const marginEm = parseFloat(/margin-top:calc\([\d.]+vh - ([\d.]+)em\)/.exec(rows)[1]);
    const heightVh = parseFloat(/height:calc\(([\d.]+)vh \+ [\d.]+em\) !important/.exec(rows)[1]);
    const heightEm = parseFloat(/height:calc\([\d.]+vh \+ ([\d.]+)em\) !important/.exec(rows)[1]);

    /* Доля экрана: заголовок ряда и кромка сжатого кадра стоят на одной. */
    assert.equal(marginVh, heroVh - shiftVh, size + ': ряды считаются не от кромки сжатого кадра');
    /* Добавка в em: 4em шапки и 2.5em отступа Lampa минус воздух. */
    assert.ok(Math.abs(marginEm - (4 + LAMPA_PAD - AIR)) < 0.01,
      size + ': воздух над заголовком ряда ' + (4 + LAMPA_PAD - marginEm) + 'em вместо ' + AIR);
    /* Отступ и высота согласованы: низ области ровно на кромке экрана. */
    assert.equal(Math.round((marginVh + heightVh) * 100) / 100, 100, size + ': низ области рядов не на кромке экрана');
    assert.ok(Math.abs((heightEm - marginEm) + 4) < 0.01, size + ': высота области разошлась с отступом (' + heightEm + '/' + marginEm + ')');
  }
});

test('фаза 3: у совсем низкого окна ряды занимают экран целиком, кадра нет', () => {
  /* Правка второго круга: порог считается не от того, влезет ли ряд, а от
     того, влезет ли СОДЕРЖИМОЕ кадра (безопасная зона под шапкой Lampa,
     логотип, полоса статуса, отступ снизу). Иначе герою доставался огрызок,
     в котором текст налезал на шапку и сам на себя — находка пользователя.
     Task 36: доступная тексту высота выросла (две трети экрана вместо
     «экран минус ряд»), и порог отодвинулся с 2.2:1 до 2.62:1.
     Task 43: строки рейтинга в кадре больше нет — её место заняла полоса
     статуса, которая ниже (TEXT_STATUS 1.98 вместо TEXT_RATE 2.62). Бюджет
     содержимого упал, и порог отодвинулся ещё: 2.58:1 -> 2.68:1, то есть
     кадр держится в окне на 28 px ниже прежнего (716 px против 744 при
     ширине 1920).
     Task 51: высота, которая достаётся тексту, — это ROWS_TOP_VH +
     ROWS_SHIFT_VH − TEXT_AIR_VH (textRatio в src/30_css.js), и убавленный
     сдвиг рядов (8 → 5.5vh) уменьшил её с 56.67 до 54.17vh. Бюджет
     содержимого при этом не менялся, поэтому порог поехал ровно в той же
     пропорции: 2.68:1 -> 2.56:1. Порог стал МЯГЧЕ — кадр держится в окне до
     750 px высоты при ширине 1920 (было 716) и пропадает позже. */
  const line = heroOffMedia(css);
  assert.ok(line, 'нет страховки для низкого окна');
  /* Task 63: бюджет содержимого кадра вырос вместе с кеглями меты и полосы
     статуса (TEXT_META 1.06 → 1.43, TEXT_STATUS 1.98 → 2.07), и порог поехал
     в той же пропорции: 2.56:1 → 2.49:1. Порог стал СТРОЖЕ ровно настолько,
     насколько крупнее стал текст.
     Правка 2026-09-23 (разбор композиции, п.1.2): потолок высоты логотипа
     поднят (TEXT_LOGO 5.6 → 6.9), мета взамен ужата, но со своим новым
     отступом стала чуть выше (TEXT_META 1.43 → 1.48), и порог ушёл с 2.49:1
     на 2.31:1 — СТРОЖЕ ещё на одну ступень. Проверка, что запас остался:
     телевизор пользователя это 16:9 = 1.78:1, до порога 30 %, а пол
     HERO_MIN_RATIO (2.2:1) правку ещё не перебивает — значит порогом
     по-прежнему правит бюджет, а не константа.
     Волна 3 (ТВ 2026-09-24): полосы чипов настроения в тексте героя больше
     нет (решение координатора), бюджет содержимого похудел на её 3.88em, и
     порог ушёл с 2.31:1 на 2.87:1 — МЯГЧЕ: кадр держится в окне до 669 px
     высоты при ширине 1920. Телевизор 16:9 это не трогает вовсе. */
  assert.ok(line.indexOf('min-aspect-ratio:287/100') !== -1, 'порог при крупном кадре — 2.87:1: ' + line);
  assert.ok(line.indexOf('margin-top:0') !== -1, 'за порогом ряды не сдвигаются');
  /* Task 36 превращал героя за порогом в полосу чипов под шапкой. Волна 3:
     чипов в герое нет, и за порогом он снова уходит целиком — ни слоя кадра
     (кадр, ролик, затемнение), ни текста; рядам не нужно опускаться ни под
     какую полосу. */
  assert.ok(line.indexOf('.lumen-main .lumen-hero{display:none}') !== -1, 'герой за порогом не скрыт: ' + line);
  assert.ok(line.indexOf('.lumen-main .lumen-hero-stage,') !== -1, 'слой кадра за порогом не скрыт: ' + line);
  assert.equal(/lumen-hero__moods|lumen-moods-on/.test(line), false, 'за порогом остались правила полосы чипов: ' + line);
  assert.equal(/position:static/.test(line), false, 'текст героя за порогом снова возвращается в поток: ' + line);

  /* Порог описания — отдельный и более мягкий: кадру хватает высоты на
     минимум, но не на две строки описания. Правка четвёртого круга подняла
     бюджет логотипа (TEXT_LOGO 4.8 → 5.6em: высоту логотипа теперь считает
     герой по пропорции, и бюджет держит самый высокий из возможных), и порог
     сдвинулся с 1.82:1 на 1.79:1 — телевизор 16:9 (1.78:1) с описанием, как
     и был. */
  const descr = css.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 && l.indexOf('lumen-hero__descr') !== -1);
  /* Task 36: тексту досталось больше высоты (две трети экрана вместо «экран
     минус ряд»), и порог описания отодвинулся с 1.79:1 до 2.08:1 — теперь
     описание видно и на 21:9-мониторе.
     Task 43: бюджет полосы под описанием похудел с 2.62 до 1.98em (там
     теперь статус сериала, а не чип рейтинга), и порог отодвинулся до
     2.14:1.
     Task 51: та же пропорция 54.17/56.67, что и у порога кадра выше:
     2.14:1 -> 2.05:1. Это самый низкий из двух порогов, и приближается он к
     16:9 телевизора (1.78:1) — поэтому здесь же стоит и нижняя граница, о
     которой договорились до правки: ниже 1.90:1 порог показа описания
     опускаться не должен, иначе описание в кадре начнёт пропадать от любой
     мелочи в бюджете содержимого.
     Task 63: кегли меты и полосы статуса подняты до tvOS (бюджеты 1.06 →
     1.43 и 1.98 → 2.07), бюджет вырос на .48em — порог сдвинулся с 2.05:1
     до 2.00:1 и остался выше и 16:9, и собственного пола 1.90.
     Правка 2026-09-23 (разбор композиции, п.1.2): выросший потолок логотипа
     (TEXT_LOGO 5.6 → 6.9) уронил РАСЧЁТНЫЙ порог до 1.88:1, и с этой правки
     описание держит уже не бюджет, а пол DESCR_MIN_RATIO — 1.90:1. Это и
     есть та проектная граница, ради которой пол заводился, и дальше
     поднимать потолок логотипа нельзя: следующий шаг не будет виден в
     числе порога вообще, потому что пол его закроет молча.
     Почему на целевом экране это безопасно: расчёт консервативен — он
     меряет логотип по ПОТОЛКУ, а живой замер на стенде 960×540@2 давал
     блоку 242.3 CSS px при худшем содержимом 212.9, то есть 29 px запаса.
     Волна 3 (ТВ 2026-09-24): полоса чипов настроения ушла из текста героя
     и из бюджета (MOODS_IN_EM, 3.88em), и расчётный порог отодвинулся с
     1.88:1 до 2.24:1 — теперь его держит снова бюджет, а не пол. Телевизор
     пользователя (1.78:1) по-прежнему с описанием. */
  assert.ok(descr.indexOf('min-aspect-ratio:224/100') !== -1, 'порог описания: ' + descr);
  assert.ok(1920 / 1080 < 1.90, 'порог описания обязан оставаться выше 16:9');
  assert.ok(parseInt(/min-aspect-ratio:(\d+)\/100/.exec(descr)[1], 10) >= 190, 'порог описания опустился к 16:9: ' + descr);
});


/* Регресс, найденный пользователем на выложенной сборке: в обычном окне
   1168×800 кадра не было вовсе — вместо него полоса чипов под шапкой и сразу
   ряд. Решение «рисовать кадр или нет» ничем не было покрыто, хотя уже дважды
   давало неожиданное поведение (сначала огрызок с наложением, потом пропажа
   кадра). Тест закрывает само решение: для каждого размера кадра и каждого
   масштаба интерфейса проверяем, что даёт порог на типовых и на экстремальных
   окнах. */
test('решение «рисовать кадр»: в обычных окнах кадр есть всегда, ветка «без кадра» — только для приплюснутых', () => {
  const ratioOf = (built) => {
    const line = heroOffMedia(built);
    return parseInt(/min-aspect-ratio:(\d+)\/100/.exec(line)[1], 10) / 100;
  };
  /* Окна, в которых кадр обязан быть: телевизор, ноутбук и окно браузера
     пользователя (1168×800 = 1.46:1). */
  const normal = [[1920, 1080], [1280, 720], [1168, 800], [1440, 900], [1600, 900]];
  /* Окна, в которых кадра быть не должно: высоты не хватает даже на минимум.
     Task 43: прежнее 1280×480 (2.67:1) отсюда убрано — бюджет содержимого
     стал ниже на .64em (рейтинг ушёл из кадра), и в таком окне минимум
     теперь помещается. Взято окно ещё площе. */
  const flat = [[1150, 230], [1280, 400], [1280, 440]];
  for (const size of ['large', 'medium', 'compact', null]) {
    for (const scale of ['small', 'normal', 'large', 'huge']) {
      const store = { lumen_scale: scale };
      if (size) store.lumen_hero_size = size;
      const threshold = ratioOf(withStorage(store, (LC) => LC.buildCss()));
      const label = (size || 'по умолчанию') + '/' + scale;
      /* Пол порога: ниже 2.2:1 он не опускается — em Lampa считается от
         ШИРИНЫ, и у мелкого кадра вычисленный бюджет давал 1.79, то есть
         кадр исчезал бы в обычном окне. */
      assert.ok(threshold >= 2.2, label + ': порог «кадра нет» опустился до ' + threshold + ':1');
      for (const [w, h] of normal) {
        assert.ok(w / h < threshold, label + ': кадр пропал в окне ' + w + '×' + h);
      }
      for (const [w, h] of flat) {
        assert.ok(w / h >= threshold, label + ': приплюснутое окно ' + w + '×' + h + ' всё ещё рисует кадр');
      }
    }
  }
});

/* Task 36: медиазапросов, возвращавших мету и описание в СЖАТОМ состоянии,
   больше нет, и тест на них удалён. Причина: блок текста теперь одинаков в
   обоих состояниях (кадр не меняет высоту, блок только едет), решать по
   высоте там нечего — мету с описанием на листании прячет базовое правило,
   по дизайну. Проверка базового правила осталась. */
test('сжатое состояние: описание уходит по дизайну, мета остаётся', () => {
  /* Описание — две строки, в сжатом кадре они читаются дольше остановки
     фокуса; прячется базовым правилом, без порогов. */
  const descrSelectors = ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-hero--compact .lumen-hero__descr') !== -1);
  assert.ok(descrSelectors.length, 'описание в сжатом ничем не скрыто');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__descr').indexOf('display:none') !== -1);
  /* Мета-строку пользователь просил видеть при листании ещё в фазе 3. До
     Task 36 её прятали и возвращали медиазапросом там, где хватало высоты
     сжатого кадра; теперь блок текста одинаков в обоих состояниях, считать
     нечего — мета просто остаётся. */
  assert.equal(ruleSelectors(css).filter((sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__meta').length, 0,
    'мета снова спрятана в сжатом — пользователь просил её видеть при листании');
  /* Правка 2026-09-23 (правило кромки на ПК): с max-aspect-ratio теперь
     начинается правило зазора между рядами — у широкого интервала нижней
     границы нет. К бюджету кадра оно отношения не имеет и отсюда
     исключается по своему телу. */
  assert.equal(css.split('\n').filter((l) => l.indexOf('@media screen and (max-aspect-ratio:') === 0 &&
    l.indexOf('{.lumen-main .items-line{padding-bottom:') === -1).length, 0,
    'порогов по max-aspect-ratio не осталось: бюджет сжатого состояния совпал с полным');
  /* При самом маленьком размере кадра мета не показывается вовсе — и там это
     не про состояние, а про размер: бюджета на неё нет ни в одном из двух. */
  /* Считаются только верхнеуровневые правила. Ревью 2026-09-21 починило
     разбор at-rule (ruleBodies выше), и стало видно ещё одно правило с той
     же метой — в @media (min-aspect-ratio:220/100), где на сверхшироком окне
     уходит ВЕСЬ текст кадра (логотип, заголовок, описание, мета, чипы). Оно
     есть при любом размере кадра и к этой настройке отношения не имеет: там
     решает пропорция окна, а не выбранная высота героя. */
  const topLevel = (table) => ruleBodies(table.split('\n').filter((l) => l.indexOf('@') !== 0).join('\n'));
  const compactSize = withStorage({ lumen_hero_size: 'compact' }, (LC) => LC.buildCss());
  const metaOff = topLevel(compactSize).filter((r) => r.selectors.indexOf('.lumen-hero .lumen-hero__meta') !== -1 && r.decl.indexOf('display:none') !== -1);
  assert.equal(metaOff.length, 1, 'при компактном размере кадра мета обязана уходить целиком');
  /* И только при нём: у крупного и среднего такого правила нет. */
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const hidden = topLevel(built).filter((r) => r.selectors.indexOf('.lumen-hero .lumen-hero__meta') !== -1 && r.decl.indexOf('display:none') !== -1);
    assert.deepEqual(hidden, [], size + ': мета спрятана целиком, хотя высоты на неё хватает');
  }
});

/* Второй порог — мягкая деградация: описание уходит раньше, чем кадр, и
   только там, где на него не хватает высоты. */
test('решение «показывать описание»: порог мягче порога кадра и срабатывает по бюджету', () => {
  const descrLine = (built) => built.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 &&
    l.indexOf('lumen-hero__descr') !== -1 && l !== heroOffMedia(built));
  const descrRatio = (built) => parseInt(/min-aspect-ratio:(\d+)\/100/.exec(descrLine(built))[1], 10) / 100;
  const heroRatio = (built) => parseInt(/min-aspect-ratio:(\d+)\/100/.exec(heroOffMedia(built))[1], 10) / 100;
  /* Компактный кадр в этой паре не участвует: описания в нём нет ни в каком
     окне, и медиазапроса описания там нет вовсе (проверка ниже). */
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    assert.ok(descrRatio(built) <= heroRatio(built), size + ': описание обязано уходить не позже кадра');
  }
  /* Телевизор пользователя — 16:9. Описание в кадре обязано на нём
     оставаться при КАЖДОМ размере кадра, где оно вообще предусмотрено, а не
     только при крупном: порог считается из долей экрана, и любая правка
     раскладки его двигает. Фикс-раунд Task 51: убавленный ROWS_SHIFT_VH
     уронил порог среднего кадра с 1.84 до 1.75, то есть НИЖЕ 1.78 — описание
     на телевизоре пропадало, и ни один тест этого не ловил, потому что
     проверялся один размер из трёх. */
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    assert.ok(1920 / 1080 < descrRatio(built), size + ': описание пропало на телевизоре 16:9, порог ' + descrRatio(built));
    /* И в окне пользователя (1153×798) тоже. */
    assert.ok(1153 / 798 < descrRatio(built), size + ': описание пропало в окне 1153×798');
  }
  /* Пол порога — 1.90:1: ниже него он подходит к 16:9 вплотную, и описание
     начнёт пропадать от любой мелочи в бюджете содержимого. */
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    assert.ok(descrRatio(built) >= 1.9, size + ': порог описания опустился к 16:9 — ' + descrRatio(built));
  }
  /* В компактном кадре описания нет вовсе — и это решает РАЗМЕР, а не окно:
     порогом такое не выразить, у него есть пол. Гасит базовое правило, то же
     самое, которым при компактном кадре убрана мета, — а медиазапроса
     описания там нет вовсе, иначе он дублировал бы базовое правило. */
  const base = (built) => ruleBodiesWithMedia(built).filter((r) => !r.media &&
    r.selectors.indexOf('.lumen-hero .lumen-hero__descr') !== -1 && r.decl.indexOf('display:none') !== -1);
  const compact = withStorage({ lumen_hero_size: 'compact' }, (LC) => LC.buildCss());
  assert.equal(base(compact).length, 1, 'в компактном кадре описанию места нет — ждём базовое правило');
  assert.equal(descrLine(compact), undefined, 'при компактном кадре медиазапрос описания дублирует базовое правило');
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    assert.deepEqual(base(built), [], size + ': описание погашено базовым правилом, хотя высоты на него хватает');
  }
});

test('Task 18: кроссфейд кадра 600 мс только в полном режиме анимаций', () => {
  /* Волна 3: слои кадра — в неподвижном слое .lumen-hero-stage, и класс
     режима анимаций стоит на нём самом. */
  const bg = findDecl(css, (sel) => sel === '.lumen-hero-stage .lumen-hero__bg');
  assert.ok(bg && bg.indexOf('opacity:0') !== -1, 'неактивный слой прозрачен');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero-stage .lumen-hero__bg.is-active').indexOf('opacity:1') !== -1);

  /* Task 40: кроссфейд подчинён и тумблеру тяжёлых эффектов — два
     полноэкранных слоя одновременно на слабом ТВ стоят кадров. */
  const full = findDecl(css, (sel) => sel === 'body.lumen-fx-heavy .lumen-hero-stage.lumen-motion-full .lumen-hero__bg');
  assert.ok(full && full.indexOf('transition:opacity .6s ease-in-out') !== -1, 'кроссфейд 600 мс: ' + full);
  /* Task 64: переход в full-режиме без тяжёлых эффектов появился, но двух
     полноэкранных картинок разом он не даёт. Смена кадра при выключенном
     тумблере идёт в одном слое (src/48_hero.js, swapFrame), его opacity не
     меняется, и transition там не проигрывается вовсе.
     Task 70: гашение кадра в сжатом состоянии отменено решением
     пользователя, и этот переход остался при двух случаях — первое
     появление кадра (0 → 1) и приглушение до .25 под играющим роликом
     (.lumen-hero-stage--trailer). */
  const soft = findDecl(css, (sel) => sel === '.lumen-hero-stage.lumen-motion-full .lumen-hero__bg');
  assert.ok(soft && soft.indexOf('transition:opacity .35s ease') !== -1,
    'появление кадра без тяжёлых эффектов обязано быть плавным: ' + soft);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-hero-stage.lumen-motion-lite .lumen-hero__bg'), null, 'в lite перехода нет вовсе — гасить нечего');
});

/* Task 70. Отзыв пользователя 2026-09-21, п.1: «всё, что ниже первой ленты,
   не загружает постер с героем». Кадр загружался и там — его гасило правило
   Task 64 (tv-design-specs §1, «при уходе фокуса вниз фон убирается
   полностью»). Решение пользователя 2026-09-21 — вернуть поведение до
   Task 64: кадр в сжатом состоянии остаётся видимым и только уезжает вверх
   (translateY у .lumen-hero--compact). Вуаль возвращается вместе с ним: её
   гашение было нужно только потому, что гас кадр.
   Волна 3 (ТВ 2026-09-24): кадр не гаснет и не уезжает — он в неподвижном
   слое .lumen-hero-stage, а под поднятыми рядами его закрывает пол
   (тест «пол сжатого состояния» выше). Вуалей больше нет.

   Слой атмосферы — исключение, и оно измерено: частицы над сжатым кадром
   стоили 120 из 120 кадров за 2 секунды шага фокуса (замер Task 64),
   поэтому .lumen-fx в сжатом состоянии по-прежнему гаснет и встаёт на
   паузу. Ревью 2026-09-22 (п.5): замер относится к ПОЛНОМУ режиму с
   включёнными тяжёлыми эффектами — на слабом ТВ слоя частиц нет вовсе
   (LC.fx.mount отдаёт null вне 'full', src/52_fx.js allowedNow, а тумблер
   тяжёлых эффектов на android/tizen/webos выключен по умолчанию). */
test('Task 70: фокус ушёл в ряды — кадр остаётся видимым, гаснут только частицы', () => {
  /* Ни одного правила, которое гасило бы в сжатом состоянии кадр, подложку
     или ролик: ни по классу сжатия героя, ни по подъёму рядов. */
  const dimmed = ruleBodies(css).filter((r) => r.selectors.some((sel) => /lumen-hero__(bg|lqip|trailer)/.test(sel) &&
    /lumen-hero--compact|lumen-rows-up/.test(sel)));
  assert.deepEqual(dimmed.map((r) => r.selectors.join(',')), [], 'кадр, подложка и ролик в сжатом состоянии больше не гасятся');
  /* Сжатое состояние по-прежнему только сдвигает кадр — и ни одного
     свойства раскладки (сторож у правила .lumen-hero--compact выше). */
  const compact = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact');
  assert.equal(/opacity/.test(compact), false, 'сам кадр в сжатом состоянии не гасится: ' + compact);
  /* Приглушение кадра под играющим роликом (Task 28) правилом Task 64 не
     перебивалось и остаётся ровно таким, каким было. */
  const underTrailer = findDecl(css, (sel) => sel === '.lumen-hero-stage.lumen-hero-stage--trailer .lumen-hero__bg.is-active');
  assert.ok(underTrailer && underTrailer.indexOf('opacity:.25') !== -1, 'кадр под роликом: ' + underTrailer);
  /* Слой атмосферы гаснет и на паузе: цена частиц на шаге фокуса измерена
     (120 → 0 кадров за 2 с), возвращать их не за что. Сам кадровый цикл
     останавливает предикат paused в src/48_hero.js. */
  const fx = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-fx');
  assert.equal(fx, 'opacity:0', 'частицы над сжатым кадром обязаны гаснуть: ' + fx);
  const fxTrans = ruleBodies(css).find((r) => r.selectors.indexOf('.lumen-hero.lumen-motion-full .lumen-fx') !== -1);
  assert.ok(fxTrans && fxTrans.decl.indexOf('transition:opacity .35s ease') !== -1, 'слой атмосферы обязан гаснуть плавно');
  /* У затемнения переход один — у пола, который появляется под
     поднятыми рядами (и тот только в полном режиме). Верхнее и левое
     затемнение не меняются ни при сжатии, ни на смене карточки. */
  const scrimTrans = ruleBodies(css).filter((r) => r.selectors.some((sel) => sel.indexOf('.lumen-hero__scrim') !== -1) && /transition/.test(r.decl));
  assert.deepEqual(scrimTrans.map((r) => r.selectors.join(',')), [], 'у затемнения кадра переход, которому нечего проигрывать');
  /* Текст героя в сжатом состоянии не гасится — он только поджимается. */
  const text = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__text');
  assert.ok(text && text.indexOf('opacity:0') === -1, 'текст героя гаснуть не должен: ' + text);
});

/* Волна 3: модель затемнения кадра героя на экране W×H (CSS px): верх и
   низ покоя (.lumen-hero__scrim), левое (scrim--l, умноженное на свою
   маску) и пол (только в сжатом состоянии). Слой кадра стоит от верха
   экрана (0…H), поэтому y — прямо координата экрана. em — кегль Lampa в
   CSS px (lampaEm; по умолчанию — «обычный» размер интерфейса без пола).
   Ревью раунда хвостов, п.7: до него все слои были одного цвета (фон
   страницы), и модель считала одну плотность 1 − Π(1 − a). Теперь у слоёв
   свои цвета (тень подкраски, фон страницы на кромке сплошной части), и
   модель — цвет пикселя (heroPixel ниже). gradPm — градиент в точке p так,
   как его интерполирует браузер: прозрачность и цвет, умноженный на неё
   (premultiplied), линейно между соседними стопами; {a, pm: [r·a, g·a,
   b·a]}. */
function gradPm(stops, p) {
  const pmOf = (s) => (s.rgb || [0, 0, 0]).map((c) => c * s.a);
  if (p <= stops[0].pos) return { a: stops[0].a, pm: pmOf(stops[0]) };
  for (let i = 1; i < stops.length; i++) {
    if (p <= stops[i].pos) {
      const s0 = stops[i - 1];
      const s1 = stops[i];
      const f = s1.pos === s0.pos ? 1 : (p - s0.pos) / (s1.pos - s0.pos);
      const p0 = pmOf(s0);
      const p1 = pmOf(s1);
      return { a: s0.a + (s1.a - s0.a) * f, pm: p0.map((v, k) => v + (p1[k] - v) * f) };
    }
  }
  const last = stops[stops.length - 1];
  return { a: last.a, pm: pmOf(last) };
}

/* Порядок слоёв затемнения — порядок узлов в разметке слоя кадра
   (buildStage, src/48_hero.js): что позже, то рисуется поверх. */
const HERO_SRC = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
function stageScrimOrder() {
  const stage = /function buildStage\(\) \{([\s\S]*?)\n    \}/.exec(HERO_SRC);
  assert.ok(stage, 'buildStage в src/48_hero.js не найдена');
  return (stage[1].match(/class="([^"]+)"/g) || []).map((m) => m.slice(7, -1))
    .filter((c) => /lumen-hero__(scrim|floor)/.test(c))
    .map((c) => (c.indexOf('--l') !== -1 ? 'left' : (c.indexOf('floor') !== -1 ? 'floor' : 'scrim')));
}

/* Цвет пикселя экрана поверх кадра frame ([r, g, b]) — слои затемнения со
   своими цветами в порядке разметки. Внутри .lumen-hero__scrim два фона, и
   первый в списке (верх, 180deg) рисуется поверх второго (низ, 0deg).
   Смешение — src-over в sRGB, как у браузера: c = pm + c·(1 − a); маска
   левого затемнения умножает и pm, и a. Возвращает [r, g, b] без
   округления. */
function heroPixel(built, W, H, em) {
  const EM = em || W / 84.17;
  const only = (sel, has) => (ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === sel && r.decl.indexOf(has) !== -1) || {}).decl;
  const scrim = gradients(only('.lumen-hero-stage .lumen-hero__scrim', 'background'), 'background');
  const top = scrim.find((l) => l.angle === '180deg').stops.map((s) => Object.assign({}, s, { pos: s.unit === 'em' ? s.pos * EM : s.pos }));
  const bottom = scrim.find((l) => l.angle === '0deg').stops;
  const left = gradients(only('.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l', 'background'), 'background')[0].stops;
  const mask = gradients(only('.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l', 'mask-image'), 'mask-image')[0].stops;
  const floor = gradients(only('.lumen-hero-stage .lumen-hero__floor', 'background'), 'background')[0].stops;
  const box = /(?:^|;)top:calc\(([\d.]+)vh - ([\d.]+)em\)/.exec(only('.lumen-hero-stage .lumen-hero__floor', 'top:calc'));
  const floorTop = parseFloat(box[1]) * H / 100 - parseFloat(box[2]) * EM;
  const order = stageScrimOrder();
  const pixelAt = function (x, y, compact, frame) {
    let c = frame.slice();
    const over = (g, k) => {
      const m = k === undefined ? 1 : k;
      c = c.map((v, i) => g.pm[i] * m + v * (1 - g.a * m));
    };
    for (const layer of order) {
      if (layer === 'left') over(gradPm(left, x / W * 100), gradAt(mask, y / H * 100));
      else if (layer === 'scrim') {
        over(gradPm(bottom, (H - y) / H * 100));
        over(gradPm(top, y));
      } else if (compact && y >= floorTop) over(gradPm(floor, (y - floorTop) / H * 100));
    }
    return c;
  };
  /* Где низ покоя и пол становятся сплошными — нужно проверке фона рядов. */
  pixelAt.restSolid = H - bottom.filter((s) => s.a >= 1).reduce((m, s) => Math.max(m, s.pos), 0) * H / 100;
  pixelAt.floorSolid = floorTop + floor.filter((s) => s.a >= 1).reduce((m, s) => Math.min(m, s.pos), Infinity) * H / 100;
  return pixelAt;
}

/* Ревью раунда хвостов, п.7: самый светлый фон, какой может выдать
   подкраска (LC.color.tint, src/57_color.js) для темы. tint берёт у
   доминанты постера только оттенок и насыщенность (её режет до TINT_S), а
   светлоту и долю тона задаёт сам, — поэтому перебор оттенка и
   насыщенности источника покрывает всё, что он может отдать, и промежуточные
   цвета перехода тоже (они идут через тот же tint). Сторож — P.muted темы
   с порогом 4.5, как в palette() (src/30_css.js). */
const COLOR = (() => {
  const LC = {};
  const module = { exports: null, lumen: true };
  loadInto(LC, module, '57_color.js');
  return module.exports;
})();
const LIGHTEST = {};
function lightestTint(theme) {
  if (LIGHTEST[theme]) return LIGHTEST[theme];
  const P = tokensWith({ lumen_theme: theme });
  let best = null;
  for (let h = 0; h < 360; h += 0.5) {
    for (let s = 0.01; s <= 0.3; s += 0.01) {
      const out = COLOR.tint(COLOR.hslToRgb({ h: h, s: s, l: 0.5 }), P.bg, P.muted, 4.5);
      if (out && (!best || luminance(out) > luminance(best))) best = out;
    }
  }
  LIGHTEST[theme] = best;
  return best;
}

/* Сборка таблицы и палитры с подкраской tint (hex; null — без неё): LC.accent
   подменяется тем, что palette() у него спрашивает. */
function withTint(storage, tint, fn) {
  return withStorage(storage, (LC) => {
    if (tint) LC.accent = { tint: () => tint };
    return fn(LC);
  });
}

/* Волна 3: строки текста героя на экране W×H — по правилам таблицы, снизу
   вверх от низа содержимого, как раскладывает их box-pack:end. Кегли,
   межстрочные и отступы — из самих правил (в кегле блока), статус — по
   бюджету TEXT_STATUS (его сверку с геометрией держит тест Task 43).
   Чипов настроения в тексте героя нет (волна 3). Сжатое состояние:
   описание скрыто, блок сдвинут своим transform
   (translateY и scale с точкой в левом нижнем углу содержимого) и вместе с
   героем уехал вверх на heroShift. Возвращает строки {what, top, bottom,
   left, right} и высоту строки названия текстом. opts.em — кегль Lampa,
   как у heroPixel. */
function heroTextLines(built, W, H, opts) {
  const EM = opts.em || W / 84.17;
  const VH = H / 100;
  const pick = (sel, re) => {
    const body = ruleBodies(built).filter((r) => r.selectors.indexOf(sel) !== -1).map((r) => r.decl).join(';');
    const m = re.exec(body);
    assert.ok(m, sel + ': не разобрать ' + re + ' в «' + body + '»');
    return parseFloat(m[1]);
  };
  const topLevel = ruleBodies(built.split('\n').filter((l) => l.indexOf('@') !== 0).join('\n'));
  const hidden = (sel) => topLevel.some((r) => r.selectors.indexOf(sel) !== -1 && /(?:^|;)display:none/.test(r.decl));
  const heroH = pick('.lumen-hero', /(?:^|;)height:([\d.]+)vh/) * VH;
  const heroShift = pick('.lumen-hero.lumen-hero--compact', /[^-]transform:translateY\(-([\d.]+)vh\)/) * VH;
  const T = '.lumen-hero .lumen-hero__text';
  const TE = pick(T, /(?:^|;)font-size:([\d.]+)em/) * EM;
  const padBottom = pick(T, /(?:^|;)padding:0 0 ([\d.]+)vh/) * VH;
  const left = pick(T, /(?:^|;)padding:0 0 [\d.]+vh ([\d.]+)em/) * TE;
  const right = pick(T, /[^-]padding-right:calc\(100% - ([\d.]+)em\)/) * TE;
  const M = '.lumen-hero .lumen-hero__meta';
  const mFont = pick(M, /(?:^|;)font-size:([\d.]+)em/);
  const metaLine = mFont * pick(M, /line-height:([\d.]+)/) * TE;
  const metaGap = mFont * pick(M, /margin-top:([\d.]+)em/) * TE;
  const D = '.lumen-hero .lumen-hero__descr';
  const dFont = pick(D, /(?:^|;)font-size:([\d.]+)em/);
  const dLine = dFont * pick(D, /line-height:([\d.]+)/) * TE;
  const dGap = dFont * pick(D, /margin-top:([\d.]+)em/) * TE;
  const dRight = Math.min(right, left + dFont * pick(D, /max-width:([\d.]+)em/) * TE);
  const Ti = '.lumen-hero .lumen-hero__title';
  const tFont = pick(Ti, /(?:^|;)font-size:([\d.]+)em/);
  const titleBox = tFont * pick(Ti, /(?:^|;)height:([\d.]+)em/) * TE;
  const titleLine = tFont * pick(Ti, /line-height:([\d.]+)/) * TE;
  const small = hidden(M);
  const bottom = heroH - padBottom;
  const lines = [];
  let y = bottom;
  if (opts.status) y -= 2.07 * TE;
  if (!opts.compact && !small && !hidden(D)) {
    for (let i = 1; i >= 0; i--) {
      lines.push({ what: 'описание, строка ' + (i + 1), top: y - dLine, bottom: y, left: left, right: dRight });
      y -= dLine;
    }
    y -= dGap;
  }
  if (!small) {
    lines.push({ what: 'мета', top: y - metaLine, bottom: y, left: left, right: right });
    y -= metaLine + metaGap;
  }
  lines.push({ what: 'название', top: y - titleBox, bottom: y - titleBox + titleLine, left: left, right: right });
  if (!opts.compact) return lines;
  /* Сжатое: translateY(A vh) scale(s) с точкой в (left, bottom), и весь
     герой поднят на heroShift. */
  const tf = ruleBodies(built).find((r) => r.selectors.indexOf('.lumen-hero.lumen-hero--compact .lumen-hero__text') !== -1).decl;
  const sh = /[^-]transform:translateY\(([\d.]+)vh\) scale\(([\d.]+)\)/.exec(tf);
  assert.ok(sh, 'сжатие текста не разобрать: ' + tf);
  const shift = parseFloat(sh[1]) * VH;
  const s = parseFloat(sh[2]);
  const map = (v) => bottom + shift - (bottom - v) * s - heroShift;
  const mapX = (v) => left + (v - left) * s;
  return lines.map((l) => ({ what: l.what, top: map(l.top), bottom: map(l.bottom), left: mapX(l.left), right: mapX(l.right) }));
}

/* Волна 3 (ТВ 2026-09-24): мета и описание героя читаются на САМОМ СВЕТЛОМ
   кадре — белом (у 60 разобранных кадров TMDB 90-й перцентиль яркости в
   полосе меты — 0.995, замер правки 2026-09-23) — при каждом размере кадра,
   в покое и в сжатом, у фильма и у сериала со статусом: P.muted не ниже
   4.5:1 по WCAG 2.1 в каждой точке строки, от safe area до правого края
   (мета — до края блока, описание — до своего max-width). Название
   текстом (фильм без логотипа) — крупный текст, порог 3:1. Логотип в
   проверку не входит: WCAG 2.1 (1.4.11) освобождает логотипы.
   Затемнение неподвижно, а текст в сжатом состоянии уезжает вверх вместе
   с героем, — поэтому состояний два. И на тёмном кадре мету не
   переосветлили.
   Ревью волны 3, п.3 (п.4 списка): и при каждом «Размере интерфейса»
   Lampa — блок текста в em её кегля, и на «крупнее» его правый край
   уходит с 51.2 до 53.8 % ширины экрана, туда, где левое затемнение уже
   спадает (было 4.42–4.53:1 в худшей точке меты).
   Ревью раунда хвостов, п.7: и при подкраске фона — она включена по
   умолчанию, а затемнение красилось ею же: с фоном #1E1D1B…#251B16 худшая
   точка меты падала до 3.9:1 на «крупнее». Проверка идёт на чистом фоне
   темы и на САМОМ СВЕТЛОМ фоне, какой может выдать подкраска
   (lightestTint), — в обеих темах; цвет каждого слоя затемнения берётся из
   таблицы (heroPixel). */
test('волна 3: мета и описание героя читаются на белом кадре — при любом размере кадра и интерфейса, в покое и в сжатом, с подкраской', () => {
  const W = 960;
  const H = 540;
  const hex = (rgb) => '#' + rgb.map((v) => ('0' + Math.round(v).toString(16)).slice(-2).toUpperCase()).join('');
  const WHITE = [255, 255, 255];
  /* Самый светлый фон подкраски не выдуман: он светлее обоих цветов,
     на которых ревью волны 3 намерило 3.9–4.2:1. */
  const warmTint = lightestTint('warm');
  for (const seen of ['#1E1D1B', '#251B16']) {
    assert.ok(luminance(warmTint) >= luminance(seen), 'перебор подкраски не нашёл фона светлее ' + seen + ': ' + warmTint);
  }
  const variants = [
    { theme: 'warm', tint: null },
    { theme: 'warm', tint: warmTint },
    { theme: 'black', tint: lightestTint('black') }
  ];
  const worst = {};
  for (const variant of variants) {
    const P = withTint({ lumen_theme: variant.theme }, variant.tint, (LC) => LC.tokens());
    assert.equal(P.bg, variant.tint || (variant.theme === 'warm' ? '#0B0908' : '#000000'), 'палитра не взяла подкраску');
    const name = variant.theme + (variant.tint ? ', подкраска ' + variant.tint : ', без подкраски');
    worst[name] = {};
    for (const iface of ['small', 'normal', 'bigger']) {
      const EM = lampaEm(W, iface);
      let worstMeta = 99;
      for (const size of ['large', 'medium', 'compact']) {
        const built = withTint({ lumen_hero_size: size, interface_size: iface, lumen_theme: variant.theme }, variant.tint, (LC) => LC.buildCss());
        const pixelAt = heroPixel(built, W, H, EM);
        for (const compact of [false, true]) {
          for (const v of [{ name: 'фильм', status: false }, { name: 'сериал со статусом', status: true }]) {
            const lines = heroTextLines(built, W, H, { status: v.status, compact: compact, em: EM });
            const label = name + ', ' + iface + ', ' + size + ', ' + (compact ? 'сжатое' : 'покой') + ', ' + v.name;
            for (const line of lines) {
              const big = line.what === 'название';
              for (const fy of [0.2, 0.5, 0.8]) {
                const y = line.top + (line.bottom - line.top) * fy;
                for (let fx = 0; fx <= 1; fx += 0.25) {
                  const x = line.left + (line.right - line.left) * fx;
                  const got = contrast(big ? P.text : P.muted, hex(pixelAt(x, y, compact, WHITE)));
                  if (!big) worstMeta = Math.min(worstMeta, got);
                  assert.ok(got >= (big ? 3 : 4.5), label + ': ' + line.what + ' в точке (' + x.toFixed(0) + ', ' + y.toFixed(0) + ') на белом кадре ' + got.toFixed(2) + ':1');
                }
              }
            }
          }
        }
      }
      worst[name][iface] = worstMeta;
    }
  }
  /* Запас меты не выдуман: у левого затемнения на правом краю блока .84, и
     худшая точка — там же. Порог держится, но не с двойным запасом; с
     самой светлой подкраской — впритык. */
  const plain = worst['warm, без подкраски'];
  const tinted = worst['warm, подкраска ' + warmTint];
  assert.ok(plain.small < 6, 'худшая точка меты подозрительно хороша — модель не видит правого края: ' + JSON.stringify(worst));
  assert.ok(tinted.bigger < 5, 'с самой светлой подкраской запас меты подозрительно велик: ' + JSON.stringify(worst));
  /* На чёрном кадре то же затемнение мету не гасит. */
  const P = tokensWith({});
  const pixelAt = heroPixel(css, W, H);
  const meta = heroTextLines(css, W, H, { status: false, compact: false }).find((l) => l.what === 'мета');
  assert.ok(contrast(P.muted, hex(pixelAt(meta.right, meta.top, false, [0, 0, 0]))) >= 4.5, 'мета на чёрном кадре');
  /* Заголовок первого ряда в покое лежит на кадре (58.66…62.5 % высоты
     экрана, левая треть) — он под левым затемнением и низом покоя. */
  for (const tint of [null, warmTint]) {
    const built = tint ? withTint({}, tint, (LC) => LC.buildCss()) : css;
    const at = heroPixel(built, W, H);
    for (const y of [316.8, 337.3]) {
      const got = contrast(P.text, hex(at(0.16 * W, y, false, WHITE)));
      assert.ok(got >= 4.5, 'заголовок первого ряда на белом кадре при y=' + y + (tint ? ', подкраска ' + tint : '') + ': ' + got.toFixed(2) + ':1');
    }
  }
});

/* Ревью раунда хвостов, п.7: затемнения героя красятся ТЕНЬЮ подкраски —
   она темнее фона страницы, — а фон под рядами остаётся подкраской как
   есть. Там, где низ покоя (ниже HERO_VH) и пол сжатого состояния
   сплошные, на экране ровно P.bg при любом кадре: левое затемнение под
   рядами его не темнит. И ступеньки на стыке нет: по вертикали цвет
   меняется без скачков — к кромке сплошной части затемнение приходит уже
   цветом фона рядов. */
test('п.7 раунда хвостов: фон под рядами — подкраска как есть, стык затемнения с ним без ступеньки', () => {
  const W = 960;
  const H = 540;
  const frames = { 'белый кадр': [255, 255, 255], 'чёрный кадр': [0, 0, 0] };
  for (const theme of ['warm', 'black']) {
    const tint = lightestTint(theme);
    const bg = [1, 3, 5].map((i) => parseInt(tint.slice(i, i + 2), 16));
    for (const iface of ['small', 'normal', 'bigger']) {
      const EM = lampaEm(W, iface);
      for (const size of ['large', 'medium', 'compact']) {
        const built = withTint({ lumen_hero_size: size, interface_size: iface, lumen_theme: theme }, tint, (LC) => LC.buildCss());
        const pixelAt = heroPixel(built, W, H, EM);
        const label = theme + ' ' + tint + ', ' + iface + ', ' + size;
        for (const fname of Object.keys(frames)) {
          const frame = frames[fname];
          for (const x of [0, 0.2 * W, 0.4 * W, 0.6 * W, W - 1]) {
            for (const [state, compact, from] of [['покой', false, pixelAt.restSolid], ['сжатое', true, pixelAt.floorSolid]]) {
              for (let y = Math.ceil(from); y < H; y += 2) {
                const got = pixelAt(x, y, compact, frame);
                assert.ok(got.every((v, i) => Math.abs(v - bg[i]) < 0.5), label + ', ' + state + ', ' + fname + ': фон под рядами в (' + x.toFixed(0) + ', ' + y + ') — ' +
                  got.map((v) => v.toFixed(1)).join(',') + ' вместо ' + tint);
              }
            }
            for (const compact of [false, true]) {
              let prev = pixelAt(x, 0, compact, frame);
              for (let y = 0.5; y < H; y += 0.5) {
                const cur = pixelAt(x, y, compact, frame);
                const jump = Math.max.apply(null, cur.map((v, i) => Math.abs(v - prev[i])));
                assert.ok(jump <= 3, label + ', ' + (compact ? 'сжатое' : 'покой') + ', ' + fname + ': скачок цвета ' + jump.toFixed(1) + ' на полпикселя в (' + x.toFixed(0) + ', ' + y + ')');
                prev = cur;
              }
            }
          }
        }
        /* Кадр цвета фона рядов у правой кромки (левого затемнения там
           нет), ниже полосы шапки: низ и пол, подходя к сплошной части, не
           рисуют на нём полосы темнее фона — цвет стопа идёт к фону вместе
           с плотностью, и темнее фона он не больше чем на четверть разницы
           фона и тени (у стопов одной тенью — почти на всю разницу). */
        const leftDecl = ruleBodies(built).find((r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l' &&
          r.decl.indexOf('background') !== -1).decl;
        const shade = gradients(leftDecl, 'background')[0].stops[0].rgb;
        assert.ok(shade.every((v, i) => v <= bg[i]) && shade.some((v, i) => v < bg[i]), label + ': тень ' + shade.join(',') + ' не темнее фона ' + bg.join(','));
        for (const compact of [false, true]) {
          for (let y = 9 * EM; y < H; y += 1) {
            const got = pixelAt(W - 1, y, compact, bg);
            got.forEach((v, i) => {
              assert.ok(v >= bg[i] - (bg[i] - shade[i]) / 4 - 0.5, label + ', ' + (compact ? 'сжатое' : 'покой') + ': над рядами полоса темнее фона в y=' + y.toFixed(1) +
                ' — ' + got.map((c) => c.toFixed(1)).join(',') + ' при фоне ' + bg.join(','));
            });
          }
        }
      }
    }
  }
});

test('Task 36/64 + волна 3: кадр кадрируется по лицам (center 25%), а не по самому верху', () => {
  /* Пользователь на живом телевизоре 2026-09-18: «лица на постере не видны,
     просто края картинки». У постеров TMDB верхняя треть — почти всегда небо
     или потолок, и при cover с center top в высокий блок героя попадало
     именно оно. 30 % — линия глаз в типовой композиции кадра.
     Task 64: слои кадра стали <img>, поэтому то же кадрирование задают
     object-fit/object-position, а не background-size/background-position.
     Волна 3: кадр — во весь экран (слой .lumen-hero-stage), и у кадра 16:9 на
     экране 16:9 резать нечего; в окне другой пропорции срез по высоте
     уходит в основном вниз — точка 25 %. */
  const bg = findDecl(css, (sel) => sel === '.lumen-hero-stage .lumen-hero__bg');
  assert.ok(bg.indexOf('object-position:center 25%') !== -1, 'кадрирование героя: ' + bg);
  assert.ok(bg.indexOf('object-fit:cover') !== -1, 'кадр обязан обрезаться, а не растягиваться: ' + bg);
  assert.equal(/background-position/.test(bg), false, 'кадрирование фоном осталось у <img>-слоя: ' + bg);
  /* Подложка LQIP кадрируется ровно так же — иначе на кроссфейде картинка
     сдвинется. */
  const lqip = ruleBodies(css).find((r) => r.selectors.indexOf('.lumen-hero-stage .lumen-hero__lqip') !== -1 && r.decl.indexOf('object-fit') !== -1);
  assert.ok(lqip && lqip.decl.indexOf('object-position:center 25%') !== -1, 'подложка LQIP кадрируется иначе, чем кадр');
});

/* Task 38: раньше тест требовал filter:blur(1.75em) у героя в полном режиме.
   Фильтр снят: размытие даёт сам постер, который герой грузит в w92 и
   растягивает cover (src/48_hero.js, loadFrame). От правила остался наезд,
   прячущий края растянутой картинки, — и он по-прежнему только в full.
   Task 52: наезд переехал с КОРНЯ героя на сам слой кадра. Слоёв два, и
   правило по корню давало scale(1.1) обоим сразу; на переходе «фильм без
   backdrop (размытый постер) → фильм с кадром» класс снимался мгновенно, и
   приехавшая картинка скачком уменьшалась на 10 % (пользователь 2026-09-21:
   «при листании картинка сначала нормально центрировалась, а потом
   съехала»). */
test('Task 52: наезд размытого кадра — на слое кадра, а не на корне героя', () => {
  const blur = findDecl(css, (sel) => sel === '.lumen-hero-stage.lumen-motion-full .lumen-hero__bg--blur');
  assert.ok(blur, 'правило размытого слоя (экран 22) не найдено');
  assert.ok(blur.indexOf('scale(1.1)') !== -1, 'наезд прячет края растянутого постера: ' + blur);
  assert.equal(blur.indexOf('filter'), -1, 'filter:blur на живом слое героя запрещён: ' + blur);
  /* Старого селектора по корню не осталось вовсе — мёртвое правило здесь
     было бы ровно тем дефектом, который Task 52 и чинит. */
  assert.deepEqual(ruleSelectors(css).filter((sel) => sel.indexOf('lumen-hero--blur') !== -1), [],
    'правило по корню героя осталось в таблице стилей');
  const offenders = ruleSelectors(css).filter((sel) => sel.indexOf('lumen-hero__bg--blur') !== -1 && sel.indexOf('lumen-motion-full') === -1);
  assert.deepEqual(offenders, [], 'наезд героя вне режима full — лишнее движение на слабом ТВ');
});

test('Task 36: подмена текста — только opacity, сдвиг сжатия она не сбрасывает', () => {
  /* До Task 36 подмена двигала блок на .53em своим transform. Теперь на том
     же свойстве живёт сжатие (translateY + scale), и подмена обязана его не
     трогать: иначе текст прыгал бы к низу кадра на каждой карточке. */
  /* Ревью фикс-раунда (п.3): гаснут дети блока, а не сам блок — у блока на
     transform живёт сжатие. Волна 3 убрала из блока подушку-вуаль, и
     исключать из детей больше некого. */
  const swap = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping > *');
  assert.equal(swap, 'opacity:0', 'старый текст обязан только гаснуть: ' + swap);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping'), null,
    'гаснет весь блок — вместе с ним гаснет подушка под текстом');
  const inCls = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-in > :not(.lumen-skeleton)');
  assert.ok(inCls && inCls.indexOf('lumen-hero-in .42s') !== -1, 'новый проявляется 420 мс');
  const block = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text');
  assert.equal(/opacity/.test(block), false, 'переход opacity у самого блока: ' + block);
  const kids = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text > *');
  assert.ok(kids && /[^-]transition:opacity \.18s ease/.test(kids), 'дети блока гаснут за 180 мс: ' + kids);
  const frames = css.split('\n').filter((l) => l.indexOf('keyframes lumen-hero-in') !== -1);
  assert.equal(frames.length, 2, 'кадры подмены и их webkit-копия');
  for (const line of frames) assert.equal(/transform/.test(line), false, 'в кадрах подмены остался transform: ' + line);

  const calm = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-lite .lumen-hero__text');
  const calmOff = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-off .lumen-hero__text');
  assert.equal(calm, calmOff, 'lite и off гасят анимацию одним правилом');
  assert.ok(calm, 'правило lite/off не найдено');
  assert.ok(/animation:none/.test(calm) && /transition:none/.test(calm) && calm.indexOf('opacity:1') !== -1, 'в lite/off текст виден сразу: ' + calm);
  /* transform:none здесь был бы ошибкой: правило специфичнее сжатия и в
     lite/off текст стоял бы на месте, когда кадр уже уехал вверх. */
  assert.equal(/transform:none/.test(calm), false, 'в lite/off сжатие текста обязано остаться, снимается только его плавность: ' + calm);
});

/* Контрольное ревью 84c7b27..de0e2c8, п.3. Правило проявления детей текста
   (.lumen-hero__text.is-in > …) по специфичности перебивает пульс
   .lumen-skeleton, а is-in висит до следующей смены карточки — в режиме
   «Полный» плашки героя до ответа деталей стояли неподвижно. Проявление
   обязано обходить скелетоны; сами плашки героя носят .lumen-skeleton. */
test('ревью п.3: проявление текста героя не отнимает пульс у скелетонов', () => {
  const heroSrc = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const plates = heroSrc.match(/class="lumen-hero__sk [^"]*"/g) || [];
  assert.ok(plates.length >= 3, 'плашки скелетона героя не найдены в разметке');
  for (const p of plates) assert.ok(p.indexOf('lumen-skeleton') !== -1, 'плашка без общего класса скелетона: ' + p);

  const appear = ruleBodies(css).filter((r) => /animation:lumen-hero-in/.test(r.decl));
  assert.ok(appear.length > 0, 'правило проявления текста героя не найдено');
  for (const r of appear) {
    for (const sel of r.selectors) {
      assert.ok(sel.indexOf(':not(.lumen-skeleton)') !== -1, 'проявление перебивает пульс скелетона: ' + sel);
    }
  }
  const pulse = findDecl(css, (sel) => sel === '.lumen-skeleton');
  assert.ok(pulse && /animation:lumen-sk 1\.4s/.test(pulse), 'пульс скелетона пропал: ' + pulse);
});

test('Task 18: логотип фильма с текстовым фолбэком, описание в две строки, скелетон до ответа деталей', () => {
  const logo = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__logo');
  /* Правка четвёртого круга: размер конкретного логотипа считает герой
     (LC.hero.logoBox, src/48_hero.js) по его пропорции из TMDB и пишет
     инлайном — в таблице стилей пропорцию знать неоткуда. Здесь остаётся
     рамка ПО УМОЛЧАНИЮ: её получают логотипы, у которых в ответе нет ни
     aspect_ratio, ни width/height. Она та же, что была в третьем круге:
     37.84 × 4.4em, то есть 8.6:1 — всё, что не длиннее, упирается в высоту,
     а не в ширину. */
  assert.ok(logo && logo.indexOf('width:37.84em') !== -1, 'рамка логотипа: ' + logo);
  assert.ok(logo.indexOf('height:4.4em') !== -1, 'высота рамки по умолчанию: ' + logo);
  const frame = 37.84 / 4.4;
  assert.ok(frame >= 8.5, 'рамка обязана быть шире самых длинных логотипов (8.02:1), иначе высота у них проседает');
  assert.ok(logo.indexOf('background-size:contain') !== -1, 'логотип обязан вписываться с сохранением пропорций');
  assert.ok(logo.indexOf('display:none') !== -1, 'без логотипа узел скрыт');
  /* Task 36: логотип едет масштабом, а не парой width/height — пропорция при
     этом не может порваться по построению, а раскладка блока не меняется ни
     на одном кадре перехода. */
  const logoMotion = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text > .lumen-hero__logo');
  assert.ok(logoMotion && /[^-]transition:opacity \.18s ease,transform \.42s/.test(logoMotion), 'логотип едет масштабом: ' + logoMotion);
  assert.ok(logo.indexOf('transform-origin:left bottom') !== -1, 'без origin у левого нижнего угла логотип уехал бы от safe area: ' + logo);

  /* Текстовый фолбэк (фильм без логотипа) занимает место логотипа — 4.4em,
     середину диапазона его высот (2.4…5.2em). Кегль и число строк внутри
     этой коробки проверяет блок Task 43 внизу. */
  const title = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__title');
  assert.ok(title.indexOf('height:1.29em') !== -1, 'фолбэк обязан занимать фиксированную высоту: ' + title);

  /* В сжатом состоянии логотип мельче в .65 раза — и это масштаб, а не
     вторая пара размеров: пропорция при нём совпадает всегда. */
  const logoSmall = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__logo');
  assert.equal(logoSmall, '-webkit-transform:scale(0.65);transform:scale(0.65)', 'сжатый логотип: ' + logoSmall);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--logo .lumen-hero__title').indexOf('display:none') !== -1, 'есть логотип — заголовка нет');

  const descr = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__descr');
  assert.ok(descr && descr.indexOf('-webkit-line-clamp:2') !== -1, 'описание — две строки (§0.2)');
  /* Волна 3 (ТВ 2026-09-24): меньше текста в кадре — описание 30em своего
     кегля (1.15em блока), то есть 34.5em блока и 432.8 CSS px на 960, правый
     край на 49.3 % ширины (было 36.02em — шире нового блока в 36em). Плашка
     скелетона первой строки — той же ширины. */
  assert.ok(descr.indexOf('max-width:30em') !== -1, 'ширина описания героя: ' + descr);
  const skDescr = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr');
  assert.ok(skDescr.indexOf('width:34.5em') !== -1, 'скелетон описания шире самого описания: ' + skDescr);

  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta'), 'скелетон меты, пока грузятся детали');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr'), 'скелетон описания — только когда описания нет вовсе');
});

/* Правка четвёртого круга: высота логотипа перестала быть постоянной — её
   считает герой по пропорции. Бюджет раскладки (TEXT_LOGO, из него считаются
   пороги «показывать описание» и «показывать кадр») обязан покрывать САМЫЙ
   ВЫСОКИЙ из возможных логотипов, иначе высокий логотип выдавил бы мету под
   верхнюю кромку текстового блока. Константы живут в разных файлах, поэтому
   связь проверяется по исходникам.
   Task 36: бюджет один на оба состояния — сжатое даёт масштаб, а transform
   раскладку не трогает, и места логотип занимает столько же. Прежний
   TEXT_LOGO_SMALL удалён вместе с веткой compact в logoBox. */
test('раскладка: бюджет высоты под логотип покрывает самый высокий логотип героя', () => {
  const heroSrc = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const cssSrc = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  const constOf = (src, name) => {
    const hit = new RegExp('var ' + name + ' = ([0-9.]+);').exec(src);
    assert.ok(hit, 'константа ' + name + ' не найдена');
    return Number(hit[1]);
  };
  /* margin-top логотипа — .4em, он входит в бюджет вместе с высотой.
     Сравнение через округление до сотых: 5.2 + 0.4 в двоичной дроби даёт
     5.600000000000001 и «больше либо равно» на голых числах не проходит. */
  const MARGIN = 0.4;
  const em = (n) => Math.round(n * 100);
  const hMax = constOf(heroSrc, 'LOGO_H_MAX');
  assert.ok(em(constOf(cssSrc, 'TEXT_LOGO')) >= em(hMax + MARGIN), 'TEXT_LOGO меньше самого высокого логотипа');
  assert.equal(/var LOGO_COMPACT/.test(heroSrc), false, 'масштаб сжатого логотипа живёт только в CSS (Task 36)');
  /* Рамка по умолчанию и предел ширины у героя — одна и та же величина:
     разъехавшись, они дали бы логотипы шире текстового блока. */
  const logo = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__logo');
  assert.ok(logo.indexOf('width:' + constOf(heroSrc, 'LOGO_W_MAX') + 'em') !== -1, 'рамка по умолчанию и LOGO_W_MAX разошлись: ' + logo);
});

test('Task 18: сдвигается область прокрутки рядов, а не её содержимое', () => {
  /* padding-top у .scroll__body Lampa съедает первой же прокруткой: она
     выравнивает фокусный ряд по верху области. Сдвигать надо саму область. */
  const rows = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  assert.ok(rows, 'правило области прокрутки главной не найдено');
  /* Task 36: отступ отмеряется от кромки СЖАТОГО кадра (50vh при крупном
     размере) минус 4em шапки Lampa и 2.5em её собственного отступа над
     фокусным рядом, плюс 1.5em воздуха: 4 + 2.5 − 1.5 = 5em. Высота — до
     кромки экрана: 50vh + (2.5 − 1.5) em. */
  assert.ok(/margin-top:calc\(50vh - 5em\)/.test(rows), 'область начинается под кромкой сжатого кадра: ' + rows);
  assert.ok(/margin-top:-webkit-calc\(50vh - 5em\)/.test(rows), 'старым webkit-движкам нужен префиксный calc');
  assert.ok(/height:calc\(50vh \+ 1em\) !important/.test(rows), 'высота области — до кромки экрана; height Lampa задаёт инлайном');
  assert.ok(/height:-webkit-calc\(50vh \+ 1em\) !important/.test(rows), 'старым webkit-движкам нужен префиксный calc');
  assert.equal(findDecl(css, (sel) => sel.indexOf('.scroll__body') !== -1 && sel.indexOf('.lumen-main') === 0), null, 'содержимое скролла отступами не двигаем');

  /* Под .lumen-main живут ещё правила размера карточек рядов (фаза 3) — они
     задевают ряды намеренно. Горизонтальные скроллы самих рядов
     (.scroll--horizontal) под правило области по-прежнему не попадают. */
  /* Task 25: метки на постерах — тоже часть карточки ряда, но своим классом
     (.lumen-badge внутри штатного .card__view), поэтому в фильтр по '.card'
     они не попадают и перечислены отдельно. */
  /* Правка 2026-09-17 (второй круг): под .lumen-main добавилась полоса чипов
     настроения — её место зависит от размера кадра (прижата к его низу),
     поэтому правило и стоит под корнем главной. */
  /* Правка 2026-09-17 (третий круг): у самого корня главной появился фон —
     он подкрашивается оттенком постера (правило `.lumen-main` без потомков и
     его переход в полном режиме анимаций). */
  /* Task 38: добавился нижний градиент-оверлей на самой активности
     (.lumen-main:after) — им заменено нижнее затухание штатной маски Lampa,
     снятой с движущейся области рядов. */
  const offenders = ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-main') === 0 &&
    sel !== '.lumen-main' && sel !== '.lumen-main:after' &&
    sel.indexOf('layer--wheight') === -1 &&
    sel.indexOf('.lumen-badge') === -1 && sel.indexOf('.lumen-moods') === -1 && sel.indexOf('.lumen-mood-chip') === -1 &&
    sel.indexOf('.lumen-hero-stage') === -1 && sel.indexOf('.lumen-hero__floor') === -1 &&
    sel.indexOf('.card') === -1 && sel.indexOf('.items-line') === -1 && sel.indexOf('.items-cards') === -1);
  /* Волна 3: под .lumen-main — ещё слой кадра героя: пол под поднятыми
     рядами (.lumen-rows-up стоит на корне) и его выключение в плоском окне. */
  assert.deepEqual(offenders, [], 'под .lumen-main только фон корня, область прокрутки, карточки рядов, метки, чипы настроения, слой кадра героя и сами ряды');
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-main .scroll--horizontal') === 0).length, 0,
    'горизонтальные скроллы рядов не трогаем');
});

/* Долг фазы 2: ряды главной шли штатной карточкой Lampa 290×563, из-за чего
   герой был виден на ~36 % экрана вместо 58 % дизайна. */
/* Правка пользователя 2026-09-17 (третий круг): «фон определялся от
   картинки». Фон корня главной — тот же P.bg, что у всех подложек, поэтому
   подкраска доходит до него без отдельного механизма. */
test('правка: у корня главной есть фон; перехода у него нет ни в одном режиме (волна perf)', () => {
  const main = findDecl(css, (sel) => sel === '.lumen-main');
  assert.equal(main, 'background-color:#0B0908', 'фон корня — цвет темы: ' + main);
  /* Волна производительности: фон корня целиком закрыт сценой (кадр героя
     во весь экран, ряды поверх), и CSS-переход background-color у него
     только гонял анимацию невидимого полноэкранного узла на каждом шаге
     пути подкраски. Путь по-прежнему ведёт LC.accent шагами (200 мс). */
  assert.equal(ruleSelectors(css).filter((sel) => /lumen-motion-(full|lite|off) \.lumen-main$/.test(sel)).length, 0,
    'правило перехода у корня главной вернулось');
});

test('Task 51: карточка ряда главной — 217×325 (7 колонок tvOS), подписи §0.4', () => {
  /* Пользователь на живом телевизоре 2026-09-18: «картинка очень маленькая».
     Прежние дизайнерские 230×345 выросли до 260×390 (Task 36) — место под них
     дал отказ от требования «ряд помещается в экран целиком».
     Task 51: 217×325. Обе ширины — колонки одной и той же сетки Apple
     (HIG Layout → Grids: 6 колонок по 260 px, 7 по 217 при зазоре 40 px,
     docs/research/2026-09-21-tv-design-specs.md §1), и выбор между ними
     сделала арифметика, а не вкус: при 260 px подпись под постером не
     помещалась в экран даже в поднятом состоянии (замер координатора на
     стенде 960×540: низ подписи 543 при кромке 540). */
  const card = findDecl(css, (sel) => sel === '.lumen-main .card');
  assert.equal(card, 'width:9.52em', '217 px FHD; высоту даёт штатный padding-bottom:150 % у .card__view');
  const title = findDecl(css, (sel) => sel === '.lumen-main .card__title');
  assert.ok(title.indexOf('font-size:1.01em') !== -1, 'Task 63: название — минимум tvOS, 23 px: ' + title);
  assert.ok(title.indexOf('white-space:nowrap') !== -1, 'одна строка: вторая отнимает у героя столько же экрана');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .card__age').indexOf('font-size:1.01em') !== -1, 'Task 63: мета — минимум tvOS, 23 px');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .items-line__title').indexOf('font-size:1.23em') !== -1, 'заголовок ряда 28 px (§0.3)');
  /* Task 51: зазор между карточками — 40 физ. px той же сетки Apple. Штатный
     зазор Lampa вдвое уже (.mapping--line > * + *{margin-left:1em},
     vendor/lampa/css/app.css:14603-14605).
     Ревью Task 63: селектор был .items-cards, а этот класс вешает только
     депрекейтед InteractionLine (app.min.js:52663); ряды главной строит
     Base$1 (app.min.js:35220-35244) с mapping: 'line', и правило не
     применялось вовсе — замер на стенде показывал штатный 1em. Тест теперь
     держит и селектор, и то, что он метит в класс, который РЕАЛЬНО есть на
     теле скролла ряда. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .items-line .mapping--line > * + *'), 'margin-left:1.75em', 'зазор между карточками ряда');
  assert.equal(css.indexOf('.items-cards'), -1, 'вернулся селектор по депрекейтед-классу InteractionLine');
  const lampaJs = readFileSync(new URL('../vendor/lampa/app.min.js', import.meta.url), 'utf8');
  const lineAt = lampaJs.indexOf("_this.html = Template.js('items_line'");
  assert.notEqual(lineAt, -1, 'компонент ряда в app.min.js не найден');
  assert.ok(/mapping: 'line'/.test(lampaJs.slice(lineAt - 1200, lineAt)),
    'ряд главной перестал строиться с mapping: line — селектор зазора надо пересматривать');
});

/* Task 42: карточка ряда без рамки и штатных бейджей. Фокус показывают
   увеличение постера и акцентная подложка под ним, а не кольцо. */
test('Task 42: фокус карточки ряда — увеличение и подложка вместо кольца', () => {
  /* Штатное кольцо Lampa (.card.focus .card__view::after, app.css:3466 —
     content:"" и border .3em #fff) снимается целиком, вместе с вариантом
     для мыши. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .card.focus .card__view:after'), 'display:none', 'кольцо фокуса снято');
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .card.hover .card__view:after'), 'display:none', 'и его вариант для мыши');

  /* Увеличение — на самом постере, а не на .card: подпись под ним стоит на
     месте (transform-origin у нижней кромки). */
  const view = findDecl(css, (sel) => sel === '.lumen-main .card__view');
  assert.ok(view.indexOf('transform:scale(1)') !== -1, 'есть от чего стартовать переходу: ' + view);
  assert.ok(view.indexOf('transform-origin:center bottom') !== -1, 'растёт вверх, подпись не едет: ' + view);
  const decls = ruleBodies(css).filter((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1).map((r) => r.decl);
  const scaled = decls.join(' ');
  assert.ok(scaled.indexOf('transform:scale(1.1)') !== -1, 'увеличение в фокусе: ' + scaled);
  assert.ok(scaled.indexOf('-webkit-transform:scale(1.1)') !== -1, 'старым webkit-движкам нужен префикс: ' + scaled);
  /* Акцентная подложка — на том же узле (AR.cardFocus, src/30_css.js),
     кольца больше нет. Размытия у неё нет вовсе (Task 50) — форму и
     единственность держит отдельный тест ниже. */
  assert.ok(scaled.indexOf('box-shadow:0 .2em 0 rgba(232,184,122,0.35)') !== -1, 'подложка цветом акцента: ' + scaled);

  /* Анимация фокуса Lampa (animation-card-focus, app.css:15779 — прыжок на
     -1em) спорила бы с нашим scale на том же узле. */
  assert.ok(scaled.indexOf('animation:none !important') !== -1, 'штатная анимация фокуса погашена: ' + scaled);
  assert.ok(scaled.indexOf('-webkit-animation:none !important') !== -1, 'и в префиксном виде: ' + scaled);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .card.hover .card__view').indexOf('animation:none !important') !== -1, 'у мыши тоже');

  /* Переход — только transform: тень статична, анимировать её ресёрч
     запрещает (docs/research/2026-09-18-android-tv-animations.md). */
  const move = findDecl(css, (sel) => sel === 'body.lumen-motion-full .lumen-main .card__view');
  assert.equal(move, '-webkit-transition:-webkit-transform .18s ease-out;transition:transform .18s ease-out', 'переход только по transform: ' + move);
  assert.equal(ruleSelectors(css).filter((sel) => /lumen-motion-(lite|off) .*card__view/.test(sel)).length, 0, 'в lite/off перехода нет вовсе');

  /* Качество и тип дизайн главной не показывает — всегда. Рейтинг —
     отдельным правилом (тест ниже), он зависит от настройки меток. */
  for (const part of ['card__quality', 'card__type']) {
    assert.equal(findDecl(css, (sel) => sel === '.lumen-main .' + part), 'display:none', part);
  }

  /* Ряд приглушён целиком, в фокусе название светлеет. */
  const title = findDecl(css, (sel) => sel === '.lumen-main .card__title');
  assert.ok(title.indexOf('color:#A89A8A') !== -1, 'название вне фокуса — muted: ' + title);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .card.focus .card__title'), 'color:#F3EDE4');

  /* Выросший постер официально заезжает в зону заголовка ряда, а его
     подложка — в margin-bottom своего .card__view. Слой — на .card (она
     position:relative у Lampa, app.css:3095), тем же числом, что у плитки
     хаба и карточки сетки. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .card.focus'), 'z-index:3');
});

/* Task 42 (фикс-раунд): замер на живом телевизоре 1920×1080 показал, что
   постер в фокусе накрывает нижние 9 px строки заголовка собственного ряда —
   срезает низ букв. Зазор под заголовком обязан быть не меньше того, на
   сколько постер вырастает вверх. */
test('Task 42: зазор под заголовком ряда перекрывает рост постера на любом масштабе', () => {
  /* Ревью фикс-раунда (п.7): рост постера — в кегле .card, который Lampa
     на «крупнее» поднимает в 1.14 раза (LAMPA_CARD_SIZES, app.css:3525-3528),
     а зазор — в базовом. Прежняя редакция теста множителя не знала и
     проверяла только «обычный» размер интерфейса. Теперь — все три размера,
     все масштабы и три окна: телевизор (там на «крупнее» узкая колонка), окно
     16:10 (там широкая) и окно пользователя 1840×960. Ширина карточки и
     зазор берутся каскадом по фактическому окну — у узкой колонки они свои. */
  for (const [W, H] of [[960, 540], [1280, 800], [1840, 960]]) for (const iface of ['small', 'normal', 'bigger']) for (const key of ['small', 'normal', 'large', 'huge']) {
    const text = withStorage({ lumen_scale: key, interface_size: iface }, (LC) => LC.buildCss(), W);
    const k = LAMPA_CARD_SIZES[iface];
    const widthVal = cascade(matchingRules(text, ['lumen-main', 'lumen-rows-up'], ['card'], W, H), 'width').value;
    /* Ширина в кегле карточки; в базовые em — умножением на k. calc с vh
       (полоса подгонки под окно, ревью п.4) переводится в em окна. */
    const EMb = lampaEm(W, iface);
    const width = lengthPx(widthVal, EMb * k, H / 100) / EMb;
    /* Высота постера — от его ширины: .card__view{padding-bottom:150%}
       (app.css:3135-3139). Рост вверх — от transform-origin:center bottom.
       Фикс-раунд Task 51: масштаб фокуса читается ИЗ СОБРАННОГО CSS, а не
       стоит здесь числом. Литерал 0.08 пережил повышение ROW_FOCUS до 1.10 и
       продолжал проходить — то есть сторожил не то соотношение, о котором
       написано в комментарии к ROW_FOCUS (src/30_css.js). */
    const focusRule = ruleBodies(text).filter((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1)
      .map((r) => r.decl).join(';');
    const focus = parseFloat(/(?:^|;)transform:scale\(([\d.]+)\)/.exec(focusRule)[1]);
    assert.ok(focus > 1, key + ': масштаб фокуса не найден в «' + focusRule + '»');
    const grow = width * 1.5 * (focus - 1);
    const gap = parseFloat(cascade(matchingRules(text, ['lumen-main', 'lumen-rows-up'], ['items-line__head'], W, H), 'margin-bottom').value);
    assert.ok(gap >= grow, W + '×' + H + ' ' + iface + '/' + key + ': зазор ' + gap + 'em меньше роста постера ' + grow.toFixed(4) +
      'em базовых (масштаб фокуса ' + focus + ', кегль карточки ×' + k + ')');
  }
});

/* Task 42 (фикс-раунд): настройка «Метки на постерах» (lumen_badges) про
   рейтинг ничего не обещает, а рейтинг в подпись дописывает LC.badges. Значит
   при выключенных метках штатная плашка Lampa обязана вернуться на постер —
   иначе рейтинга не остаётся нигде. */
test('Task 42: штатная плашка рейтинга скрыта только вместе с метками', () => {
  const on = withStorage({ lumen_badges: 'true' }, (LC) => LC.buildCss());
  assert.equal(findDecl(on, (sel) => sel === '.lumen-main .card__vote'), 'display:none', 'метки включены — рейтинг в подписи');
  const off = withStorage({ lumen_badges: 'false' }, (LC) => LC.buildCss());
  assert.equal(findDecl(off, (sel) => sel === '.lumen-main .card__vote'), null, 'метки выключены — плашка Lampa возвращается');
  /* Качество и тип от настройки меток не зависят. */
  assert.equal(findDecl(off, (sel) => sel === '.lumen-main .card__quality'), 'display:none');
  assert.equal(findDecl(off, (sel) => sel === '.lumen-main .card__type'), 'display:none');
});

/* A3 (волна A финального плана): на постере ряда было ТРИ сообщения об одном
   прогрессе — наша плашка «49 %», наша полоса у нижней кромки и штатная
   панель .card-watched («Просмотрено 47 м.» + собственная полоса внутри),
   которую компонент Lampa Watched (app.min.js:21870) показывает через 500 мс
   после фокуса. Оставляем полосу и один текст: панель Lampa рендерится кеглем
   9.12 CSS px (ниже TV_MIN = 11.52) и обрезана всегда — строке доступно
   69.3 px при нужных 83.2 («Просмотрено 47 м.»), 91 («Просмотрено 1:23:45»)
   и 81 (строка серии). Замеры — на стенде 960×540@2. */
test('A3: штатная панель «Просмотрено …» на постере главной скрыта — и от настройки меток не зависит', () => {
  const sel = '.lumen-main .card.focus .card-watched';
  assert.equal(findDecl(css, (s) => s === sel), 'display:none', 'панель Lampa осталась на постере');
  for (const mode of ['poster', 'caption', 'off']) {
    const text = withStorage({ lumen_badges: mode }, (LC) => LC.buildCss());
    assert.equal(findDecl(text, (s) => s === sel), 'display:none', 'вид меток «' + mode + '»');
  }
  /* Специфичность обязана перебивать .card.focus .card-watched (0,3,0,
     vendor/lampa/css/app.css:3671), а не надеяться на порядок подключения. */
  assert.ok(sel.split('.').length - 1 > '.card.focus .card-watched'.split('.').length - 1,
    'селектор не специфичнее штатного: ' + sel);
  /* В сетке подборки и в хабе карточка собирается из шаблона 'card' без
     компонента Watched (src/46_hub.js, cardNode) — прятать там нечего. */
  assert.equal(ruleSelectors(css).filter((s) => s.indexOf('.card-watched') !== -1 && s.indexOf('.lumen-main') !== 0).length, 0,
    'правило .card-watched вышло за пределы главной');
});

/* -------------------------------------------------------------------- */
/* Task 62a (фаза 5): метка в подписи под постером.                      */
/* -------------------------------------------------------------------- */

test('Task 62a: caption — плашка рейтинга по-прежнему скрыта, метка подписи оформлена', () => {
  const cap = withStorage({ lumen_badges: 'caption' }, (LC) => LC.buildCss());
  /* Рейтинг в подписи пишет LC.badges.decorate, а он работает в обоих
     показанных режимах — значит и плашку Lampa прячем в обоих. */
  assert.equal(findDecl(cap, (sel) => sel === '.lumen-main .card__vote'), 'display:none');
  const badge = findDecl(cap, (sel) => sel === '.lumen-main .card__age .lumen-badge-cap');
  assert.ok(badge, 'правила метки в подписи нет');
  assert.equal(/font-size/.test(badge), false, 'кегль метке не задаётся — он общий с подписью: ' + badge);

  /* Старое значение переключателя читается как прежний вид: профиль, где
     метки были включены, после смены типа настройки выглядит так же. */
  const legacy = withStorage({ lumen_badges: 'true' }, (LC) => LC.buildCss());
  assert.ok(ruleSelectors(legacy).indexOf('.lumen-main .lumen-badge') !== -1,
    'сохранённое «true» обязано читаться как плашка на постере');
});

/* Подпись карточки ряда узкая (ширина карточки), и вторая её строка сдвинула
   бы вниз весь блок ряда — то есть инвариант Task 51. Метка в подписи длиннее
   года с рейтингом, поэтому строка обязана обрезаться многоточием. */
test('Task 62a: подпись карточки ряда не переносится на вторую строку', () => {
  const age = findDecl(css, (sel) => sel === '.lumen-main .card__age');
  assert.ok(age.indexOf('white-space:nowrap') !== -1, 'подпись переносится: ' + age);
  assert.ok(age.indexOf('overflow:hidden') !== -1, age);
  assert.ok(age.indexOf('text-overflow:ellipsis') !== -1, age);
  assert.ok(age.indexOf('-o-text-overflow:ellipsis') !== -1, 'старым движкам Opera/Presto нужен префикс: ' + age);
});

/* -------------------------------------------------------------------- */
/* Task 62a (фаза 5): область подкраски от постера.                      */
/*                                                                        */
/* У Apple TV цвет кадра живёт только в фоне, а элементы управления        */
/* остаются нейтральными (docs/research/2026-09-21-tv-design-specs.md §1). */
/* Значение 'veil' снимает подложку фокуса карточки — единственное место,  */
/* где подкраска доходит до управления, — оставляя вуали и градиенты.      */
/* -------------------------------------------------------------------- */

test('Task 62a: veil снимает подложку фокуса карточки и в таблице, и в узле подкраски', () => {
  const veil = withStorage({ lumen_accent_scope: 'veil' }, (LC) => LC.buildCss());
  const rule = ruleBodies(veil).find((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1
    && r.decl.indexOf('box-shadow') !== -1);
  assert.equal(rule, undefined, 'подложка фокуса осталась в таблице: ' + (rule && rule.decl));
  assert.equal(withStorage({ lumen_accent_scope: 'veil' }, (LC) => LC.accentFocusCss()), '',
    'узел подсветки обязан сниматься целиком, а не оставаться пустым');

  /* Затемнение кадра героя (с волны 3 — вместо вуали), фон рядов и
     градиенты кромок подкрашиваются по-прежнему — именно в них у Apple и
     живёт цвет кадра. */
  const hot = withStorage({ lumen_accent_scope: 'veil' }, (LC) => LC.accentCss());
  assert.ok(hot.indexOf('.lumen-main{background-color:') !== -1, hot);
  assert.ok(hot.indexOf('.lumen-hero__scrim--l') !== -1, hot);
  assert.ok(hot.indexOf('.lumen-main:after') !== -1, hot);
});

/* Ревью Task 62: «Только фон» не действует при ВЫКЛЮЧЕННОЙ подкраске.
   Пункт про то, докуда доходит цвет ПОСТЕРА, а подложка фокуса без
   подкраски красится статическим акцентом из настроек — снимать её было бы
   не за что, и описание пункта (все три языка) прямо обещает «Действует при
   включённом „Акценте от постера“». */
test('Task 62a: выключенная подкраска оставляет подложку фокуса даже при «только фон»', () => {
  const off = withStorage({ lumen_accent_auto: 'false', lumen_accent_scope: 'veil' }, (LC) => LC.buildCss());
  assert.ok(ruleBodies(off).some((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1
    && r.decl.indexOf('box-shadow') !== -1), 'подложка фокуса снята без подкраски, которой её снимать');
  assert.ok(withStorage({ lumen_accent_auto: 'false', lumen_accent_scope: 'veil' }, (LC) => LC.accentFocusCss())
    .indexOf('.lumen-main .card.focus .card__view{') === 0);

  /* А с включённой подкраской — снимается, как и задумано. */
  const on = withStorage({ lumen_accent_auto: 'true', lumen_accent_scope: 'veil' }, (LC) => LC.buildCss());
  assert.equal(ruleBodies(on).find((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1
    && r.decl.indexOf('box-shadow') !== -1), undefined);
});

test('Task 62a: full — всё как было, включая масштаб фокуса в обоих режимах', () => {
  const full = withStorage({ lumen_accent_scope: 'full' }, (LC) => LC.buildCss());
  assert.ok(ruleBodies(full).some((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1
    && r.decl.indexOf('box-shadow') !== -1), 'подложка фокуса пропала при полной подкраске');
  /* Сам жест фокуса (увеличение постера) от области подкраски не зависит:
     иначе в режиме veil карточка под фокусом не отличалась бы ничем. */
  for (const scope of ['full', 'veil']) {
    const built = withStorage({ lumen_accent_scope: scope }, (LC) => LC.buildCss());
    const grow = ruleBodies(built).filter((r) => r.selectors.indexOf('.lumen-main .card.focus .card__view') !== -1)
      .map((r) => r.decl).join(';');
    assert.ok(/transform:scale\(1\.1\)/.test(grow), scope + ': масштаб фокуса потерялся — ' + grow);
  }
});

/* Task 36: масштаб интерфейса по-прежнему растит карточки рядов, но область
   прокрутки за ними больше не тянется — её место задано долями ЭКРАНА. Это
   сознательная плата за переход без перекладки раскладки: при «крупнее» и
   «огромном» ряд подрезается снизу сильнее (см. комментарий к HERO_VH в
   src/30_css.js). Тест закрывает обе половины этого решения. */
test('Task 36: масштаб растит карточки рядов, но не область прокрутки', () => {
  const pairs = [['small', '8.57em'], ['normal', '9.52em'], ['large', '10.47em'], ['huge', '11.42em']];
  for (const pair of pairs) {
    const scaled = withStorage({ lumen_scale: pair[0] }, (LC) => LC.buildCss());
    assert.equal(findDecl(scaled, (sel) => sel === '.lumen-main .card'), 'width:' + pair[1], pair[0] + ': ширина карточки ряда');
    const rows = findDecl(scaled, (sel) => sel === '.lumen-main .scroll.layer--wheight');
    assert.ok(rows.indexOf('height:calc(50vh + 1em) !important') !== -1, pair[0] + ': высота области поехала за масштабом — ' + rows);
    assert.ok(rows.indexOf('margin-top:calc(50vh - 5em)') !== -1, pair[0] + ': отступ области поехал за масштабом — ' + rows);
  }
});

/* ====================================================================== */
/* Фаза 3: расширенные настройки оформления — акценты, тема, плотность     */
/* подложек, масштаб интерфейса.                                          */
/* ====================================================================== */

/* Контраст по WCAG 2.1: относительная яркость каналов sRGB и отношение
   (L1 + .05) / (L2 + .05). Нужен ровно для проверки «тёмный текст на заливке
   акцентом читается на ТВ», поэтому считается здесь, а не тянется
   зависимостью. */
function channel(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function luminance(hex) {
  const h = hex.replace('#', '');
  return 0.2126 * channel(parseInt(h.slice(0, 2), 16)) +
    0.7152 * channel(parseInt(h.slice(2, 4), 16)) +
    0.0722 * channel(parseInt(h.slice(4, 6), 16));
}
function contrast(a, b) {
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

test('contrast: формула совпадает с известными значениями WCAG', () => {
  assert.equal(contrast('#FFFFFF', '#000000').toFixed(0), '21');
  assert.equal(contrast('#777777', '#FFFFFF').toFixed(1), '4.5');
});

/* Правка 2026-09-23 (разбор композиции, п.2.3, решение координатора, плюс
   добор по читаемости плитки реакций). Три проверки в одной: оранжевое
   пятно стоит на числе ОЦЕНКИ, чип реакций сведён к той же серой схеме, и
   всё, что лежит на кадре, читается по WCAG 2.1 даже на белом кадре. */
/* Решение пользователя 2026-09-23 поверх этой правки: «надо поменять цвет
   тмдб на нормальный, ибо выбивается». Оранжевого в ленте чипов нет вовсе —
   число оценки стоит цветом ведущих значений соседей (P.text). */
test('правка 2026-09-23: оценка и реакции нейтральные, чипы читаются на светлом кадре', () => {
  const P = tokensWith({});
  const rateValue = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate > div:first-child');
  const rateLabel = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate > div:last-child');
  const reactValue = findDecl(css, (sel) => sel === '.lumen-card .lumen-reactions-chip__value');
  const reactLabel = findDecl(css, (sel) => sel === '.lumen-card .lumen-reactions-chip__label');
  assert.ok(new RegExp('color:' + P.text + '($|;)').test(rateValue), 'число оценки не тем цветом, что у соседей: ' + rateValue);
  const statusValue = findDecl(css, (sel) => sel === '.lumen-card .lumen-status__value');
  assert.equal(/color:([^;]+)/.exec(rateValue)[1], /color:([^;]+)/.exec(statusValue)[1], 'ведущие значения чипов разного цвета');
  assert.ok(new RegExp('color:' + P.text + '($|;)').test(reactValue), 'число реакций осталось акцентным: ' + reactValue);
  assert.ok(new RegExp('color:' + P.muted + '($|;)').test(reactLabel), 'подпись реакций осталась акцентной: ' + reactLabel);
  assert.equal(/opacity:/.test(reactLabel), false, 'подпись реакций гасится прозрачностью — контраст так не считается: ' + reactLabel);
  /* Реакции и рейтинг — один чип по подложке и по цветам подписи. */
  const chip = findDecl(css, (sel) => sel === '.lumen-card .lumen-reactions-chip');
  const rate = findDecl(css, (sel) => sel === '.lumen-card .full-start__rate');
  for (const prop of ['background', 'background-color', 'border-radius', 'padding']) {
    const one = new RegExp('(?:^|;)' + prop + ':([^;]+)');
    const a = one.exec(chip), b = one.exec(rate);
    assert.equal(a && a[1], b && b[1], prop + ' у реакций и рейтинга разный');
  }
  assert.equal(/(?:^|;)background[^;]*SPICE|D9622B/.test(chip), false, 'оранжевая заливка у реакций осталась: ' + chip);
  assert.equal(/font-size:([\d.]+)em/.exec(reactLabel)[1], /font-size:([\d.]+)em/.exec(rateLabel)[1], 'подписи чипов разного кегля');

  /* Чипы лежат на кадре: под светлой плёнкой обязан быть свой тёмный слой,
     иначе на белом кадре и подложка, и светлый текст на ней исчезают. */
  const under = /background-color:rgba\((\d+),\s*(\d+),\s*(\d+),\s*\.(\d+)\)/.exec(rate);
  assert.ok(under, 'у чипа нет тёмного слоя под плёнкой: ' + rate);
  const alpha = parseFloat('0.' + under[4]);
  const over = (top, a, bottom) => top.map((v, i) => Math.round(v * a + bottom[i] * (1 - a)));
  const hex = (rgb) => '#' + rgb.map((v) => ('0' + v.toString(16)).slice(-2).toUpperCase()).join('');
  const bg = [parseInt(under[1], 10), parseInt(under[2], 10), parseInt(under[3], 10)];
  const film = [243, 237, 228];
  /* Худший случай — белый кадр: сперва тёмный слой, потом плёнка .12. */
  const onWhite = hex(over(film, 0.12, over(bg, alpha, [255, 255, 255])));
  assert.ok(contrast(P.text, onWhite) >= 4.5, 'на белом кадре текст чипа даёт ' + contrast(P.text, onWhite).toFixed(2) + ':1');
  assert.ok(contrast(P.muted, onWhite) >= 4.5, 'на белом кадре подпись чипа даёт ' + contrast(P.muted, onWhite).toFixed(2) + ':1');
  /* Число оценки стоит цветом P.text — проверено строкой выше, порог мелкого текста. */
  /* И на тёмном кадре подписи по-прежнему хватает порога мелкого текста. */
  const onDark = hex(over(film, 0.12, over(bg, alpha, [11, 9, 8])));
  assert.ok(contrast(P.muted, onDark) >= 4.5, 'на тёмном кадре подпись чипа даёт ' + contrast(P.muted, onDark).toFixed(2) + ':1');
  assert.ok(contrast(P.text, onDark) >= 4.5, 'на тёмном кадре число чипа даёт ' + contrast(P.text, onDark).toFixed(2) + ':1');
  /* Оранжевого в ленте чипов нет ни в одном правиле. */
  const rateLine = ruleBodies(css).filter((r) => r.selectors.some((sel) => /full-start__rate|lumen-reactions-chip|lumen-status__|lumen-next-chip/.test(sel)));
  assert.deepEqual(rateLine.filter((r) => r.decl.indexOf(P.spice) !== -1 || r.decl.indexOf(P.spice.toLowerCase()) !== -1).map((r) => r.selectors.join(',')), []);
});

/* Правка 2026-09-23 (разбор композиции, п.1.4): часы, иконки и заголовок
   активности в шапке Lampa белые и лежат прямо на кадре — на белом кадре
   1.00:1. Их держит верхняя полоса затемнения (.5 до 3.96em, ноль к 9em).
   До волны 3 это была отдельная вуаль, которая уезжала вместе с кадром в
   сжатом состоянии, и её приходилось сдвигать навстречу (ревью фикс-раунда,
   п.1). Теперь полоса — в неподвижном слое кадра: у кромки экрана она
   стоит всегда, и часы (низ глифов на 2.7em, 22.8 CSS px полужирным —
   крупный текст, порог 3:1) читаются в обоих состояниях при любом размере
   кадра. */
test('волна 3: полоса под шапкой Lampa неподвижна — часы читаются и в покое, и в сжатом', () => {
  const W = 960;
  const H = 540;
  const EM = W / 84.17;
  const hex = (rgb) => '#' + rgb.map((v) => ('0' + Math.round(v).toString(16)).slice(-2).toUpperCase()).join('');
  /* Ревью раунда хвостов, п.7: полоса красится тенью подкраски — и с
     самой светлой подкраской тоже. */
  for (const tint of [null, lightestTint('warm')]) {
    for (const size of ['large', 'medium', 'compact']) {
      const built = withTint({ lumen_hero_size: size }, tint, (LC) => LC.buildCss());
      const pixelAt = heroPixel(built, W, H);
      for (const compact of [false, true]) {
        for (const x of [0.56 * W, 0.9 * W, 0.98 * W]) {
          for (const y of [10.3, 20, 2.7 * EM]) {
            const got = contrast('#FFFFFF', hex(pixelAt(x, y, compact, [255, 255, 255])));
            assert.ok(got >= 3, size + (compact ? ', сжатое' : ', покой') + (tint ? ', подкраска ' + tint : '') + ': часы шапки на белом кадре в (' +
              x.toFixed(0) + ', ' + y.toFixed(1) + ') — ' + got.toFixed(2) + ':1');
          }
        }
      }
    }
  }
  /* И встречного сдвига, который держал прежнюю вуаль у кромки, больше
     нет — держать нечего. */
  assert.deepEqual(ruleSelectors(css).filter((s) => s.indexOf('lumen-hero__veil--t') !== -1), [], 'верхняя вуаль героя осталась в таблице');
});

/* Правка 2026-09-23 (разбор композиции, п.5.2): фильтры рулетки больше не
   прижаты к правому краю. Замер на стенде 960×540@2: от центра «Сериалы» до
   центра «Не смотрел» фокус проходил 401.4 CSS px (пустоты между сегментами
   317), после правки — 96.3 (пустоты 17.7). Барабан при этом не тронут:
   разбор предлагал забрать у него 90 px под три строки управления, но он в
   44a079a только что получил стопку постеров и счётчик. */
test('правка 2026-09-23: управление рулетки собрано слева, барабан не тронут', () => {
  const filters = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__filters');
  assert.ok(filters, 'правила сегмента фильтров нет');
  assert.equal(/margin-left:auto/.test(filters), false, 'фильтры по-прежнему прижаты вправо: ' + filters);
  assert.ok(/margin-left:[\d.]+em/.test(filters), 'между сегментами нет собственного зазора: ' + filters);
  /* Шапка осталась ОДНОЙ строкой: лишняя строка сверху — это высота,
     отнятая у барабана. */
  const head = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__head');
  assert.ok(/display:flex/.test(head), head);
  assert.equal(/flex-wrap:wrap/.test(head), false, 'шапка получила право переноса — строк станет больше: ' + head);
  const reel = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__reel');
  assert.ok(/height:43vh/.test(reel), 'барабан изменил высоту: ' + reel);
});

const ACCENT_KEYS = ['sand', 'copper', 'wine', 'garnet', 'mint', 'emerald', 'ice', 'lavender', 'graphite'];

test('фаза 3: девять акцентов, у каждого своя четвёрка токенов', () => {
  const seen = {};
  for (const key of ACCENT_KEYS) {
    const t = withStorage({ lumen_card_accent: key }, (LC) => LC.tokens());
    assert.match(t.accent, /^#[0-9A-F]{6}$/, key + ': цвет акцента');
    assert.match(t.ring, /^#[0-9A-F]{6}$/, key + ': кольцо фокуса');
    assert.match(t.onac, /^#[0-9A-F]{6}$/, key + ': текст на акценте');
    assert.match(t.acglow, /^rgba\(/, key + ': свечение');
    assert.equal(seen[t.accent], undefined, 'акценты не повторяются: ' + key);
    seen[t.accent] = key;
  }
  assert.equal(Object.keys(seen).length, 9);
  /* Значение по умолчанию не менялось: без выбора — прежний «песок». */
  assert.equal(withStorage({}, (LC) => LC.tokens()).accent, '#E8B87A');
});

test('фаза 3: текст на заливке акцентом читается — не ниже 4.5:1, у восьми из девяти выше 7:1', () => {
  const low = [];
  for (const key of ACCENT_KEYS) {
    const t = withStorage({ lumen_card_accent: key }, (LC) => LC.tokens());
    const ratio = contrast(t.onac, t.accent);
    assert.ok(ratio >= 4.5, key + ': контраст onac/accent ' + ratio.toFixed(2) + ' ниже порога 4.5:1');
    if (ratio < 7) low.push(key);
    /* Акцент служит и текстом (метка «КИНОПОИСК», статус героя) на фоне
       страницы — он обязан читаться и там. */
    assert.ok(contrast(t.accent, t.bg) >= 4.5, key + ': акцент на фоне страницы ' + contrast(t.accent, t.bg).toFixed(2));
  }
  /* «Вино» — значение из экспорта дизайна (5.27): оно уже стоит в профилях
     тех, кто его выбрал, и менять его задним числом нельзя. Остальные восемь
     держат целевые 7:1. */
  assert.deepEqual(low, ['wine']);
});

test('фаза 3: смена акцента меняет всю четвёрку разом, включая новые акценты', () => {
  /* Task 43 снял акцент с фокуса кнопок карточки, Task 54 — с фокуса
     остальных кнопок и строк списка (везде инверсия). Последний узел, где
     четвёрка стоит вся разом, — «Крутить» в рулетке: заливка и текст на ней
     в базовом правиле, светлое кольцо и свечение — в правиле фокуса. */
  const emerald = withStorage({ lumen_card_accent: 'emerald' }, (LC) => LC.buildCss());
  const spin = findDecl(emerald, (sel) => sel === '.lumen-roulette .lumen-roulette__spin');
  assert.ok(spin.indexOf('background:#7ACCA0') !== -1, 'заливка «Крутить» — цвет изумруда: ' + spin);
  assert.ok(spin.indexOf('color:#06170F') !== -1, 'текст на заливке — тёмный тон изумруда: ' + spin);
  const spinFocus = findDecl(emerald, (sel) => sel === '.lumen-roulette .lumen-roulette__spin.focus');
  assert.ok(spinFocus.indexOf('border-color:#E4FBEE') !== -1, 'кольцо фокуса — светлый тон изумруда: ' + spinFocus);
  assert.ok(spinFocus.indexOf('rgba(122,204,160,0.35)') !== -1, 'свечение — тот же цвет: ' + spinFocus);
  const focus = findDecl(emerald, (sel) => sel === '.lumen-card .full-start-new__buttons .full-start__button.focus');
  assert.ok(focus.indexOf('rgba(122,204,160,0.35)') !== -1, 'ореол кнопки — тот же цвет: ' + focus);

  /* Графит — «акцент без цвета»: свечение слабее прочих, иначе нейтральный
     ореол читается как белая вспышка. */
  assert.equal(withStorage({ lumen_card_accent: 'graphite' }, (LC) => LC.tokens()).acglow, 'rgba(189,184,178,0.30)');
});

test('фаза 3: тема «глубокая чёрная» — настоящий чёрный фон и нейтральные подложки', () => {
  const t = withStorage({ lumen_theme: 'black' }, (LC) => LC.tokens());
  assert.equal(t.bg, '#000000', 'OLED: пиксель выключен');
  assert.equal(t.bgRgb, '0,0,0');
  assert.notEqual(t.panel, '#1C1613');
  assert.notEqual(t.line, '#2C231D');
  /* Не зависят от темы: спайс, зелёный «хороший» и сам акцент. */
  assert.equal(t.spice, '#D9622B');
  assert.equal(t.accent, '#E8B87A');

  const black = withStorage({ lumen_theme: 'black' }, (LC) => LC.buildCss());
  for (const warm of ['#0B0908', '#1C1613', '#2C231D', '#A89A8A', '#7A6A5A', 'rgba(11,9,8', 'rgba(28,22,19']) {
    assert.equal(black.indexOf(warm), -1, 'тёплый цвет ' + warm + ' остался в чёрной теме');
  }
  /* Вуали поверх кадра — того же цвета, что страница: иначе на краю виден
     тёплый ореол поверх чёрного фона. */
  const veil = findDecl(black, (sel) => sel === '.lumen-backdrop__veil--b');
  assert.ok(veil.indexOf('rgba(0,0,0,0.98)') !== -1, 'нижняя вуаль собрана из цвета фона темы: ' + veil);
});

test('фаза 3: тема по умолчанию — прежний тёплый тёмный вид, до последнего литерала', () => {
  assert.equal(withStorage({ lumen_theme: 'warm' }, (LC) => LC.buildCss()), css, 'явный «warm» = значение по умолчанию');
  assert.equal(withStorage({ lumen_theme: 'nope' }, (LC) => LC.buildCss()), css, 'мусор в Storage — тема по умолчанию, а не пустая палитра');
  const t = withStorage({}, (LC) => LC.tokens());
  assert.equal(t.bg, '#0B0908');
  assert.equal(t.panel, '#1C1613');
});

/* Task 38: проверка «по умолчанию размытие на месте» отсюда убрана — блюра
   подложек больше нет ни при какой настройке, его отсутствие теперь стережёт
   отдельный тест выше. Настройка осталась про другое: плотность карт. */
test('фаза 3: «Плотные подложки» — сплошные карты', () => {
  const solid = withStorage({ lumen_solid: 'true' }, (LC) => LC.buildCss());

  for (const sel of ['.lumen-card .full-start-new__buttons .full-start__button',
    '.lumen-card .full-start__rate',
    '.lumen-descr-row .full-descr__text',
    '.lumen-card .lumen-stop',
    '.lumen-card .lumen-trailer-badge']) {
    const decl = findDecl(solid, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(/background:#[0-9A-F]{6}/.test(decl), 'заливка обязана быть сплошной: ' + sel + ' -> ' + decl);
  }

  /* Выключено — прежний вид: полупрозрачные карты .78/.82 и размытие. */
  assert.equal(withStorage({ lumen_solid: 'false' }, (LC) => LC.buildCss()), css);
});

/* Task 38: прежде «Стоп» уплотнялся до .9 отдельным правилом режима, и тест
   следил, чтобы с плотными подложками оно не возвращало прозрачность. Правил
   режима больше нет — плотность задаёт палитра, — поэтому проверка переехала
   на базовое правило: .9 по умолчанию и сплошной цвет при плотных подложках. */
test('фаза 3: плотность «Стопа» задаёт палитра, и плотные подложки делают его сплошным', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-stop');
  assert.ok(base.indexOf('background:rgba(11,9,8,.9)') !== -1, 'по умолчанию подложка .9: ' + base);
  const solid = withStorage({ lumen_solid: 'true' }, (LC) => LC.buildCss());
  /* Проверяется именно заливка: бордюр у «Стопа» остаётся полупрозрачным и в
     плотном режиме — он рисует кромку карты, а не её подложку. */
  const dense = findDecl(solid, (sel) => sel === '.lumen-card .lumen-stop');
  assert.ok(dense && /(^|;)background:#[0-9A-F]{6}/.test(dense), 'с плотными подложками «Стоп» сплошной: ' + dense);
});

/* Герой в списке представлен текстовым блоком, а не корнем: высота самого
   .lumen-hero считается от экрана и от высоты ряда, и лишний кегль умножил бы
   те же em второй раз (живьём: «мельче» — кадр накрывал ряд на 35 px). */
const SCALE_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-descr-modal', '.lumen-hero .lumen-hero__text', '.lumen-hub', '.lumen-grid', '.lumen-minimap', '.lumen-jump', '.lumen-ambient', '.lumen-roulette'];

test('фаза 3: масштаб — один коэффициент на корнях плагина', () => {
  for (const pair of [['small', '0.9'], ['large', '1.1'], ['huge', '1.2']]) {
    const scaled = withStorage({ lumen_scale: pair[0] }, (LC) => LC.buildCss());
    const rule = ruleBodies(scaled).find((r) => r.decl === 'font-size:' + pair[1] + 'em');
    assert.ok(rule, pair[0] + ': правила масштаба нет');
    assert.deepEqual(rule.selectors, SCALE_ROOTS, pair[0] + ': список корней');
  }
});

test('фаза 3: «обычный» масштаб не добавляет ни одного правила', () => {
  assert.equal(withStorage({ lumen_scale: 'normal' }, (LC) => LC.buildCss()), css);
  assert.equal(withStorage({ lumen_scale: 'nope' }, (LC) => LC.buildCss()), css, 'мусор в Storage — обычный масштаб');
  const offenders = ruleBodies(css).filter((r) => r.decl.indexOf('font-size:') === 0 && r.selectors.length === SCALE_ROOTS.length);
  assert.deepEqual(offenders, [], 'по умолчанию правила масштаба быть не должно');
});

test('фаза 3: масштаб не трогает доли экрана и чужую разметку', () => {
  const scaled = withStorage({ lumen_scale: 'huge' }, (LC) => LC.buildCss());
  const rule = ruleBodies(scaled).find((r) => r.decl === 'font-size:1.2em');
  assert.equal(rule.decl.indexOf('vh'), -1, 'высота героя и область рядов считаются от экрана, а не от кегля');
  /* Область рядов главной и экраны пути до плеера в списке корней не
     участвуют: там разметка Lampa, а не наша. */
  for (const sel of rule.selectors) {
    /* Ряды главной рисует Lampa, и общий кегль на них не вешается: их размер
       задают отдельные правила (.lumen-main .card и соседние), иначе
       коэффициент растянул бы заодно чужую разметку активности. */
    assert.equal(sel.indexOf('.lumen-main'), -1, 'активность главной общим кеглем не растягиваем: ' + sel);
    assert.equal(sel.indexOf('body'), -1, 'кегль body принадлежит Lampa: ' + sel);
    assert.notEqual(sel, '.lumen-hero', 'кегль корня героя удвоил бы коэффициент в его собственной высоте');
  }
  /* Task 36: высота героя от масштаба не зависит вовсе — это доля ЭКРАНА, а
     не доля текста. Раньше она считалась от высоты ряда и потому ехала за
     масштабом; теперь ряд подрезается снизу, а кадр остаётся тем же. */
  const heroOnly = (r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero';
  const heroHuge = ruleBodies(scaled).find(heroOnly).decl;
  assert.ok(heroHuge.indexOf('height:66.67vh') !== -1, 'высота героя при «ещё крупнее»: ' + heroHuge);
});

/* ====================================================================== */
/* Task 28 (фаза 3): ряд франшизы, спойлеры отзывов, слой трейлера героя. */
/* ====================================================================== */

/* Task 28: слой автотрейлера героя — с волны 3 его геометрию, проявление по
   is-live и приглушение кадра под роликом держит тест «волна 3: ролик
   героя — 16:9-бокс…» выше, место в слое кадра — test/hero.test.mjs. */

test('Task 28: спойлер замазан без blur и раскрывается классом на корне окна', () => {
  const hidden = findDecl(css, (s) => s === '.lumen-review-modal .lumen-spoiler');
  assert.ok(hidden, 'правила замазки нет');
  assert.ok(hidden.indexOf('color:transparent') !== -1, 'буквы не читаются: ' + hidden);
  assert.equal(hidden.indexOf('blur'), -1, 'blur дорог для ТВ и не работает без фильтров');
  const open = findDecl(css, (s) => s === '.lumen-review-modal--open .lumen-spoiler');
  assert.ok(open.indexOf('color:') !== -1 && open.indexOf('transparent') === -1, 'раскрытый спойлер читается: ' + open);
});

test('Task 28: ряд «Смотреть по порядку» — целая строка в .full-descr со своим корнем', () => {
  const row = findDecl(css, (s) => s === '.lumen-descr-row .lumen-fr');
  assert.ok(row.indexOf('width:100%') !== -1 && row.indexOf('flex-basis:100%') !== -1, 'блок встаёт целой строкой: ' + row);
  const card = findDecl(css, (s) => s === '.lumen-descr-row .lumen-fr-card');
  assert.ok(card.indexOf('flex:none') !== -1, 'карточки частей не сжимаются: ' + card);
  const watched = findDecl(css, (s) => s === '.lumen-descr-row .lumen-fr-card--watched .lumen-fr-card__poster');
  assert.ok(watched.indexOf('opacity:.45') !== -1, 'просмотренная часть приглушена: ' + watched);
  const here = findDecl(css, (s) => s === '.lumen-descr-row .lumen-fr-card__flag--current');
  assert.ok(here.indexOf('background:') !== -1, 'пометка «Вы здесь» — акцентная плашка: ' + here);
});

/* Task 21 (фаза 3): слой тематической атмосферы и оверлеи тем. */
test('buildCss: .lumen-fx — слой частиц в карточке и в кадре главной, кликов не перехватывает, без inset', () => {
  const rule = css.split('\n').filter((l) => l.indexOf('.lumen-backdrop .lumen-fx,') === 0)[0];
  assert.ok(rule, 'нет базового правила слоя частиц');
  const decl = rule.split('{')[1];
  assert.ok(decl.indexOf('pointer-events:none') !== -1, 'слой не должен ловить фокус и клики');
  assert.ok(decl.indexOf('position:absolute') !== -1);
  assert.ok(decl.indexOf('overflow:hidden') !== -1, 'частицы не вылезают за кадр');
  assert.equal(/inset\s*:/.test(decl), false, 'inset запрещён планом');
  assert.ok(rule.indexOf('.lumen-hero .lumen-fx') !== -1, 'тот же слой в кадре главной');
});

test('buildCss: канвас частиц растянут по слою и приглушён — текст карточки важнее', () => {
  const rule = css.split('\n').filter((l) => l.indexOf('.lumen-backdrop .lumen-fx__canvas') === 0)[0];
  assert.ok(rule, 'нет правила канваса');
  const decl = rule.split('{')[1];
  assert.ok(/opacity:\.\d+/.test(decl), 'канвас полупрозрачен');
  assert.ok(decl.indexOf('width:100%') !== -1 && decl.indexOf('height:100%') !== -1);
});

test('buildCss: гирлянда «рождества» — десять огоньков по дуге, без SVG-фильтров', () => {
  const rule = css.split('\n').filter((l) => l.indexOf('.lumen-backdrop.lumen-theme--christmas') === 0)[0];
  assert.ok(rule, 'нет оверлея рождества');
  assert.equal((rule.match(/radial-gradient/g) || []).length, 10, 'десять огоньков');
  assert.equal(rule.indexOf('filter'), -1, 'SVG-фильтры на ТВ запрещены поправками контроллера');
  assert.ok(rule.indexOf('background-repeat:no-repeat') !== -1);
});

test('buildCss: «Хэллоуин» — тыквенное зарево снизу', () => {
  const rule = css.split('\n').filter((l) => l.indexOf('.lumen-backdrop.lumen-theme--halloween') === 0)[0];
  assert.ok(rule, 'нет оверлея Хэллоуина');
  assert.ok(rule.indexOf('linear-gradient(0deg') !== -1, 'градиент снизу вверх');
  assert.ok(rule.indexOf('224,123,44') !== -1, 'акцент темы из экспорта дизайна (#E07B2C)');
});

/* ====================================================================== */
/* Task 40: тяжёлые эффекты под классом body.lumen-fx-heavy.              */
/* ====================================================================== */

test('Task 40: наезд заставки идёт только при включённых тяжёлых эффектах', () => {
  const zoom = findDecl(css, (sel) => sel === 'body.lumen-fx-heavy.lumen-motion-full .lumen-ambient .lumen-ambient__img.is-active');
  assert.ok(zoom && zoom.indexOf('lumen-amb-zoom') !== -1, 'правило наезда заставки под body.lumen-fx-heavy не найдено');
  /* Кроссфейд кадров заставке оставлен: он случается раз в несколько минут,
     а сама заставка тумблеру не подчинена — у неё свой выключатель. */
  const img = findDecl(css, (sel) => sel === '.lumen-ambient .lumen-ambient__img');
  assert.ok(img && img.indexOf('transition:opacity 2s ease-in-out') !== -1, 'кроссфейд заставки остался: ' + img);
});

test('Task 40: ни один тяжёлый эффект не остался без класса lumen-fx-heavy', () => {
  /* Каждое из трёх правил обязано начинаться с body.lumen-fx-heavy: наезд на
     кадр карточки, зум заставки и кроссфейд кадра героя. */
  for (const marker of ['lumen-kb', 'lumen-amb-zoom', 'transition:opacity .6s ease-in-out']) {
    const rules = ruleBodies(css).filter((r) => r.decl.indexOf(marker) !== -1);
    assert.ok(rules.length, 'правило не найдено: ' + marker);
    for (const r of rules) {
      for (const sel of r.selectors) {
        assert.ok(sel.indexOf('body.lumen-fx-heavy') === 0, marker + ': селектор без класса тяжёлых эффектов — ' + sel);
      }
    }
  }
});

/* ====================================================================== */
/* Task 43: единая типографика — один шрифт, без моно и без рамок.        */
/*                                                                        */
/* Пользователь на Philips 50PUS8057 (2026-09-18): интерфейс выглядит     */
/* «колхозно», ориентир — Apple TV+ и Netflix. Там на экране живёт ОДНА   */
/* гарнитура, а элементы отделены друг от друга заливкой и воздухом, а не */
/* тонкими рамками. Отсюда проверки ниже: гарнитура одна, рамок у чипов   */
/* и кнопок нет, фокус показывает инверсия.                               */
/* ====================================================================== */

test('Task 43: в таблице стилей одна гарнитура — ни Unbounded, ни моноширинных', () => {
  assert.equal(css.indexOf('Unbounded'), -1, 'заголовочная гарнитура снята');
  assert.equal(css.indexOf('JetBrains'), -1, 'моноширинной пары больше нет');
  assert.equal(css.indexOf('Plex Mono'), -1, 'моноширинной пары больше нет');
  assert.equal(css.indexOf('Arial Black'), -1, 'фолбэк заголовочной гарнитуры снят вместе с ней');

  /* Единственное исключение — отладочный HUD (src/69_hud.js): он показывает
     кадры в секунду колонкой цифр, выключен по умолчанию и на ТВ его никто
     не видит. Его моно — литерал в собственном правиле, не из набора. */
  for (const r of ruleBodies(css).filter((x) => x.decl.indexOf('Consolas') !== -1)) {
    for (const sel of r.selectors) {
      assert.ok(sel.indexOf('.lumen-hud') === 0, 'моноширинный вне HUD: ' + sel);
    }
  }
});

test('Task 43: адрес Google Fonts — ровно одна гарнитура и все веса, что стоят в стилях', () => {
  for (const key of ['golos', 'onest', 'manrope', 'inter', 'plex']) {
    const url = withStorage({ lumen_font: key }, (LC) => LC.fontsUrl());
    assert.equal(url.split('family=').length - 1, 1, key + ': в наборе больше одной гарнитуры — ' + url);
    assert.ok(url.indexOf('https://fonts.googleapis.com/css2?') === 0, key + ': единственный разрешённый CSP источник');
    assert.ok(url.indexOf('display=swap') !== -1, key + ': нет display=swap');

    /* Вес, которого нет в наборе, браузер синтезирует сам — на ТВ такая
       псевдожирность выглядит грязно. Поэтому набор весов обязан покрывать
       ВСЕ font-weight собранной таблицы, а не заданный руками список. */
    const built = withStorage({ lumen_font: key }, (LC) => LC.buildCss());
    const have = (/:wght@([\d;]+)/.exec(url) || [null, ''])[1].split(';');
    const used = new Set((built.match(/font-weight:\d+/g) || []).map((m) => m.slice('font-weight:'.length)));
    for (const w of used) {
      assert.ok(have.indexOf(w) !== -1, key + ': вес ' + w + ' стоит в стилях, но его нет в наборе ' + have.join(';'));
    }
  }
});

test('Task 43: у чипов, рейтингов, статусов и кнопок нет рамок', () => {
  const noBorder = [
    '.lumen-hub .lumen-chip',
    '.lumen-card .full-start__rate',
    '.lumen-card .lumen-next-chip',
    '.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status',
    '.lumen-card .lumen-quality-chip',
    '.lumen-card .full-start-new__buttons .full-start__button',
    '.lumen-hero .lumen-hero__status',
    '.lumen-roulette .lumen-roulette__chip',
    '.lumen-roulette .lumen-roulette__tab',
    '.lumen-card .lumen-reactions-chip',
    '.lumen-mood-chip',
    '.lumen-hub__search'
  ];
  for (const sel of noBorder) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(!/(^|;)border:\.\d+em solid/.test(decl), sel + ' — рамка осталась: ' + decl);
  }

  /* Фикс-раунд Task 43: снятая рамка оставляет за собой и объявления
     ОТДЕЛЬНЫХ сторон. Два таких стояли в склейке «статус + чип серии»: край
     резали у элементов, у которых рамки уже нет ни в одном состоянии, —
     склейку держат радиусы. Обнулять сторону имеет смысл только там, где
     рамка есть; сейчас таких мест в плагине нет вовсе. */
  for (const r of ruleBodies(css)) {
    const dead = /(^|;)border-(left|right|top|bottom):0/.exec(r.decl);
    assert.equal(dead, null, r.selectors.join(',') + ' режет край рамки, которой нет: ' + r.decl);
  }

  /* Снятая рамка не должна оставлять за собой border-color/border-width —
     это мёртвые объявления: красить нечего. */
  for (const sel of ['.lumen-roulette .lumen-roulette__chip.lumen-chip--on',
    '.lumen-roulette .lumen-roulette__tab.is-on',
    '.lumen-card .full-start-new__buttons .full-start__button.active',
    '.lumen-card .full-start-new__buttons .full-start__button.focus']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf('border-color') === -1 && decl.indexOf('border-width') === -1,
      sel + ' — мёртвое объявление рамки: ' + decl);
  }
});

test('Task 43: фокус кнопки карточки — инверсия (текст становится фоном)', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__buttons .full-start__button.focus');
  assert.ok(focus.indexOf('background:#F3EDE4') !== -1, 'заливка — цвет текста: ' + focus);
  assert.ok(focus.indexOf('color:#0B0908') !== -1, 'подпись — цвет фона страницы: ' + focus);
  /* Инверсия обязана остаться читаемой в обеих темах: это те же два цвета,
     что несут весь текст плагина, только поменянные местами. */
  for (const theme of ['warm', 'black']) {
    const t = withStorage({ lumen_theme: theme }, (LC) => LC.tokens());
    assert.ok(contrast(t.text, t.bg) >= 4.5, theme + ': инверсия нечитаема');
  }
});

/* Фикс-раунд Task 43: Lampa инвертирует свой белый loader.svg на кнопке в
   фокусе (vendor/lampa/css/app.css:4047 — .full-start__button.loading.focus
   :before{filter:invert(1)}). Пока фокус заливался акцентом, наш filter:none
   держал спиннер белым; теперь фон фокуса — P.text, и белое на белом это
   пустая кнопка на всё время ожидания. */
test('Task 43: спиннер кнопки в фокусе не остаётся белым на светлом фоне', () => {
  for (const r of ruleBodies(css)) {
    if (r.selectors.some((s) => s.indexOf('.full-start__button') !== -1 && s.indexOf('loading') !== -1)) {
      assert.equal(/filter:\s*none/.test(r.decl), false,
        'штатная инверсия спиннера погашена: ' + r.selectors.join(',') + '{' + r.decl + '}');
    }
  }
});

test('Task 43: рейтинг героя — в строке меты, отдельного чипа нет', () => {
  assert.equal(css.indexOf('lumen-hero__rate'), -1, 'узел чипа рейтинга снят вместе с его правилами');

  const meta = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__meta');
  assert.ok(meta, 'правило меты не найдено');
  assert.equal(meta.indexOf('letter-spacing'), -1, 'разрядка была нужна моноширинному, её больше нет: ' + meta);
  /* Правка 2026-09-23 (разбор композиции, п.1.1): мета переехала ПОД
     название и ужата с 1.15em до .96em своего контекста — это 1.056em
     базовых, 24.1 физического px на растре 1920×1080. Прежние 1.27em
     базовых совпадали с кеглем заголовка ряда (14.4 против 14.0 CSS px на
     стенде 960×540@2), и мета читалась как заголовок секции. */
  assert.ok(meta.indexOf('font-size:.96em') !== -1, 'мета — .96em своего контекста = 1.056em базовых = 24 физических px: ' + meta);
  assert.ok(meta.indexOf('margin-top:.3em') !== -1, 'зазор «название → мета» — .3 кегля самой меты: ' + meta);
  assert.ok(meta.indexOf('#A89A8A') !== -1, 'мета — muted: ' + meta);
});

/* Правка 2026-09-23 (разбор композиции, п.1.1): порядок узлов внутри
   .lumen-hero__text. Проверяется по разметке buildNode, а не по CSS: место
   элемента в блоке задаёт именно она, и никаким order/flex-direction мы его
   не переставляем. */
test('правка 2026-09-23: в кадре героя название идёт ПЕРЕД мета-строкой', () => {
  const src = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const at = (cls) => src.indexOf('<div class="lumen-hero__' + cls + '">');
  for (const cls of ['logo', 'title', 'meta', 'descr']) {
    assert.ok(at(cls) > 0, 'узел .lumen-hero__' + cls + ' не найден в разметке');
  }
  assert.ok(at('logo') < at('title'), 'логотип обязан стоять перед текстовым фолбэком названия');
  assert.ok(at('title') < at('meta'), 'название обязано стоять перед мета-строкой');
  assert.ok(at('meta') < at('descr'), 'мета обязана стоять перед описанием');
  /* Скелетон меты — плашка ПОД самой метой (её дополняют жанры и
     длительность, когда доедут детали), значит и в разметке он следом. */
  assert.ok(at('meta') < src.indexOf('lumen-hero__sk--meta'), 'скелетон меты оторвался от меты');
});

test('Task 43: заголовки — один вес 700 и один кегль на состояние', () => {
  assert.equal(css.indexOf('font-weight:800'), -1, 'вес 800 снят везде');

  const cardTitle = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__title');
  /* Task 63: Title 1 tvOS — 76 px (3.33em) при межстрочном 96/76 = 1.26 и
     нулевом трекинге: у Apple трекинг на ТВ положительный или нулевой, и
     прежние −.02em шли против системной шкалы (docs/research/
     2026-09-21-tv-design-specs.md §1). */
  assert.ok(cardTitle.indexOf('font-size:3.33em') !== -1, 'название карточки — Title 1 tvOS, 76px: ' + cardTitle);
  assert.ok(cardTitle.indexOf('font-weight:700') !== -1, cardTitle);
  assert.ok(cardTitle.indexOf('line-height:1.26') !== -1, cardTitle);
  assert.ok(cardTitle.indexOf('letter-spacing:0') !== -1, cardTitle);

  /* Фолбэк героя занимает место логотипа (4.4em его контекста) и теперь
     это ОДНА строка крупным кеглем, а не две мелким. */
  const heroTitle = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__title');
  assert.ok(heroTitle.indexOf('font-size:3.4em') !== -1, heroTitle);
  assert.ok(heroTitle.indexOf('font-weight:700') !== -1, heroTitle);
  assert.ok(heroTitle.indexOf('-webkit-line-clamp:1') !== -1, 'одна строка: ' + heroTitle);
  /* Числа берём из самого правила: сравнение двух литералов не заметило бы
     правки кегля или межстрочного. */
  const num = (decl, prop) => parseFloat(new RegExp(prop + ':([\\d.]+)em').exec(decl)[1]);
  const size = num(heroTitle, 'font-size');
  const lh = parseFloat(/line-height:([\d.]+)/.exec(heroTitle)[1]);
  const box = num(heroTitle, 'height');
  assert.ok(Math.abs(size * box - 4.4) < 0.05, 'коробка фолбэка (' + (size * box).toFixed(2) + 'em) обязана совпадать с рамкой логотипа 4.4em');
  assert.ok(lh < box, 'строка (' + lh + 'em) обязана помещаться в коробку (' + box + 'em)');

  /* Сжатое состояние: коробка равна ровно одной строке — и обязана быть
     ВЫШЕ межстрочного, иначе overflow:hidden срежет хвосты «у», «р», «щ».
     Межстрочное 1.08 меньше глифового бокса почти любой гарнитуры. */
  const small = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__title');
  const smallBox = num(small, 'height');
  assert.ok(smallBox > lh, 'сжатая коробка (' + smallBox + 'em) не выше строки (' + lh + 'em) — срежет выносные элементы');
  assert.ok(smallBox <= box, 'сжатая коробка не должна быть выше обычной: ' + small);
});

/* Фикс-раунд Task 43: кнопка поиска в шапке хаба была описана дважды —
   pill без рамки из Task 41 и коробка с акцентным фокусом из Task 17. Второй
   блок выигрывал и специфичностью (.lumen-hub .lumen-hub__search), и
   порядком, поэтому на экране жила именно коробка, а комментарий у pill'а
   обещал «ни одной коробки». Дубля быть не должно ни одного. */
test('Task 43: кнопка поиска хаба описана ровно одним набором правил', () => {
  const seen = [];
  for (const r of ruleBodies(css)) {
    for (const sel of r.selectors) {
      if (sel.indexOf('lumen-hub__search') !== -1) seen.push(sel);
    }
  }
  assert.deepEqual(seen.slice().sort(), [
    '.lumen-hub.lumen-motion-lite .lumen-hub__search.focus',
    '.lumen-hub.lumen-motion-off .lumen-hub__search',
    '.lumen-hub.lumen-motion-off .lumen-hub__search.focus',
    '.lumen-hub__search',
    '.lumen-hub__search .lumen-ico',
    '.lumen-hub__search.focus'
  ].sort(), 'лишние или пропавшие правила кнопки поиска: ' + seen.join(' | '));

  const focus = findDecl(css, (sel) => sel === '.lumen-hub__search.focus');
  assert.ok(focus.indexOf('background:#F3EDE4') !== -1 && focus.indexOf('color:#0B0908') !== -1,
    'фокус кнопки поиска — инверсия, как у чипов: ' + focus);
});

/* Фикс-раунд Task 43: чипы настроения лежат последним элементом текстового
   блока героя (src/48_hero.js) — на том же экране, с которого пришла
   претензия «колхозно», под метой и статусом, у которых рамки сняты. */
test('Task 43: чип настроения — тот же язык, что у чипов хаба', () => {
  const chip = findDecl(css, (sel) => sel === '.lumen-mood-chip');
  assert.ok(chip.indexOf('border-color') === -1, 'мёртвый переход рамки: ' + chip);

  const focus = findDecl(css, (sel) => sel === '.lumen-mood-chip.focus');
  assert.ok(focus.indexOf('background:#F3EDE4') !== -1 && focus.indexOf('color:#0B0908') !== -1,
    'фокус чипа настроения — инверсия: ' + focus);
  assert.ok(focus.indexOf('border') === -1, 'мёртвая рамка в фокусе: ' + focus);
});

/* ---------------------------------------------------------------------- */
/* Task 43 (находка на стенде): в сетке подборки фокус остался белой       */
/* рамкой, хотя на главной он уже увеличение постера и акцентная подложка  */
/* (Task 42). Приводим к одному языку.                                     */
/* ---------------------------------------------------------------------- */

/* Фикс-раунд Task 43: бюджет высоты текстового блока героя содержал
   слагаемое под строку рейтинга, которой больше нет — её место занимает
   полоса со статусом сериала. Слагаемое обязано считаться по фактической
   геометрии .lumen-hero__status, иначе герой прячет описание и кадр раньше,
   чем нужно (пороги медиазапросов считаются из него же). */
test('Task 43: бюджет под полосу статуса совпадает с её геометрией', () => {
  const status = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__status');
  const n = (prop) => parseFloat(new RegExp(prop + ':([\\d.]+)em').exec(status)[1]);
  const zoom = n('font-size');
  const padY = parseFloat(/padding:([\d.]+)em/.exec(status)[1]);
  const line = parseFloat(/line-height:([\d.]+)/.exec(status)[1]);
  const mt = n('margin-top');
  /* Отступ сверху стоит на самом статусе, а не на полосе: полоса живёт в
     разметке всегда, и её margin отодвигал бы текст от низа кадра у каждого
     фильма без статуса. Значит и он считается в кегле статуса. */
  const need = Math.round((line + 2 * padY + mt) * zoom * 100) / 100;
  assert.equal(need, 2.07, 'геометрия полосы статуса разошлась с бюджетом TEXT_STATUS');
});

test('Task 43: у карточки сетки подборки нет кольца фокуса — увеличение и подложка, как на главной', () => {
  const ring = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard.focus .card__view:after');
  assert.ok(ring, 'штатное кольцо Lampa обязано быть погашено явным правилом');
  assert.ok(ring.indexOf('display:none') !== -1, 'кольцо снимается: ' + ring);
  assert.equal(ring.indexOf('border-color'), -1, 'мёртвая рамка на погашенном псевдоэлементе: ' + ring);

  /* Правил на этот селектор два — подложка и гашение штатных анимаций ниже,
     поэтому ищем по самому объявлению, а не по первому совпадению.
     Task 50b: число то же, что на главной, и размытия у него нет. */
  const view = ruleBodies(css).find((r) => r.selectors.indexOf('.lumen-grid .lumen-gcard.focus .card__view') !== -1 &&
    r.decl.indexOf('box-shadow') !== -1);
  assert.ok(view && /box-shadow:0 \.2em 0 rgba\(232,184,122,0\.35\)/.test(view.decl),
    'подложка переехала на сам постер тем же числом, что на главной: ' + (view && view.decl));

  const focus = findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard.focus');
  assert.ok(focus.indexOf('scale(1.08)') !== -1, 'увеличение то же, что у карточки ряда: ' + focus);
  assert.ok(focus.indexOf('z-index:3') !== -1, 'выросшая карточка обязана лежать поверх соседей: ' + focus);

  /* Фикс-раунд: карточка сетки — штатная разметка Lampa (src/46_hub.js,
     cardNode), значит на неё действуют обе анимации .card__view, что мы
     погасили на главной: подброс фокуса и отскок нажатия. Без гашения они
     играют поверх нашего увеличения. */
  const anim = ruleBodies(css).filter((r) => /animation:\s*none !important/.test(r.decl) &&
    r.selectors.some((s) => s.indexOf('.lumen-grid') === 0));
  assert.ok(anim.length, 'штатные анимации карточки сетки не погашены');
  const selectors = anim.reduce((acc, r) => acc.concat(r.selectors), []);
  for (const state of ['.lumen-gcard.focus .card__view', '.lumen-gcard.hover .card__view']) {
    assert.ok(selectors.some((s) => s.indexOf(state) !== -1), 'не погашено состояние ' + state + ': ' + selectors.join(','));
  }

  /* Вторая половина «языка Task 42»: штатных плашек на постере нет.
     Рейтинг при этом не пропадает — его переносит в подпись
     LC.badges.decorate, и прячем .card__vote ровно при включённых метках. */
  const hidden = findDecl(css, (sel) => sel === '.lumen-grid .card__quality');
  assert.ok(hidden && hidden.indexOf('display:none') !== -1, 'плашки качества/типа на постере сетки остались');
  assert.ok(ruleSelectors(css).indexOf('.lumen-grid .card__type') !== -1, 'плашка типа «TV» на постере сетки осталась');
  assert.ok(ruleSelectors(css).indexOf('.lumen-grid .card__vote') !== -1, 'плашка рейтинга на постере сетки осталась');
  const noBadges = withStorage({ lumen_badges: 'false' }, (LC) => LC.buildCss());
  assert.equal(ruleSelectors(noBadges).indexOf('.lumen-grid .card__vote'), -1,
    'метки выключены — подписи с рейтингом нет, плашка обязана вернуться');

  /* Та же арифметика, что чинили в Task 42: карточка растёт от своего
     центра, значит вверх уходит половина прироста, и зазор до предыдущего
     ряда обязан его вместить. Ширина карточки считается от ШИРИНЫ ЭКРАНА
     (calc), поэтому в em она тем больше, чем МЕЛЬЧЕ масштаб интерфейса, —
     худший случай здесь «Мельче» (0.9). */
  const card = findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard');
  assert.ok(/margin:0 \.88em 1\.4em 0/.test(card), 'зазор между рядами сетки: ' + card);
  const worstW = (84.17 / 0.9 - 2 * 2.81 - 4.4) / 6;   /* em ширины карточки */
  const worstH = 1.5 * worstW + 0.5 + 0.96 * 1.15 + 0.88 + 0.25; /* постер 150 % + подпись + год */
  assert.ok(worstH * (1.08 - 1) / 2 <= 1.4, 'выросшая карточка срежет ряд выше: нужно ' +
    (worstH * 0.04).toFixed(2) + 'em, есть 1.4em');
});

/* ====================================================================== */
/* Task 44: рулетка — спокойный экран и переход в кадр                     */
/* ====================================================================== */

/* Барабан обязан помещаться на экране ЦЕЛИКОМ. Область, которая ему
   остаётся, — не весь экран: сверху шапка Lampa (.wrap__content
   {padding-top:4em}, vendor/lampa/css/app.css:1037) и поле маски прокрутки
   (.scroll--mask .scroll__content{padding:2.5em 0}, там же:2787-2789), снизу
   ещё одно такое же поле.
   Числа ниже — не арифметика, а ЗАМЕРЫ раскладки на стенде 960×540 при
   DPR 2 по всем восьми сочетаниям «Размера интерфейса» Lampa и масштаба
   интерфейса плагина (ревью Task 44, п.3: построчная сумма em забыла
   собственное поле корня и разошлась с раскладкой на трёх верхних
   ступенях). Барабан поэтому задан долей ВЫСОТЫ экрана: em умножают обе
   настройки, доля экрана — ни одна. */
test('Task 44: барабан — доля высоты экрана в пропорции постера 2:3', () => {
  const reel = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__reel');
  assert.ok(reel, 'правило барабана не найдено');
  const h = parseFloat(/(^|;)height:([\d.]+)vh/.exec(reel)[2]);
  const w = parseFloat(/(^|;)width:([\d.]+)vh/.exec(reel)[2]);
  assert.ok(Math.abs(w / h - 2 / 3) < 0.005, 'барабан не в пропорции постера: ' + w + '×' + h);
  /* Ревью фикс-раунда (п.5): прежняя таблица (351 / 379 / 417 px) была
     снята до счётчика выборки под барабаном (44a079a, +2.14em) и мерила
     экран, которого уже не было. Переснято на стенде 960×540@2 со стопкой и
     счётчиком — от верха корня до низа кнопки «Крутить», при барабане 43vh
     (232.2 px) — по всем двенадцати сочетаниям размера интерфейса Lampa и
     масштаба плагина. area — область корня (высота .scroll минус два поля
     маски), content — содержимое. До правки «крупнее» + «огромный» давал
     448.1 при области 434.6.
     Высота барабана теперь — min(43vh, потолок из правила); обвязка =
     замер минус 232.2 px и от высоты барабана не зависит. */
  const SCREEN = 540;
  const REEL_PX = 232.2;
  const AREA = { small: 446.7, normal: 439.7, bigger: 434.6 };
  const MEASURED = {
    small: { small: 375.5, normal: 391.4, large: 407.4, huge: 423.3 },
    normal: { small: 386.4, normal: 403.5, large: 420.7, huge: 437.8 },
    bigger: { small: 394.2, normal: 412.2, large: 430.2, huge: 448.1 }
  };
  const SCALE = { small: 0.9, normal: 1, large: 1.1, huge: 1.2 };
  let clamped = 0;
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const scale of ['small', 'normal', 'large', 'huge']) {
      const built = withStorage({ lumen_scale: scale, interface_size: iface }, (LC) => LC.buildCss());
      const body = findDecl(built, (sel) => sel === '.lumen-roulette .lumen-roulette__reel');
      const cap = /[^-]max-height:calc\(100vh - ([\d.]+)em\)/.exec(body);
      assert.ok(cap, iface + '/' + scale + ': у барабана нет потолка высоты: ' + body);
      const capW = /[^-]max-width:calc\(66\.67vh - ([\d.]+)em\)/.exec(body);
      assert.ok(capW && Math.abs(parseFloat(capW[1]) - parseFloat(cap[1]) * 2 / 3) < 0.01, iface + '/' + scale + ': потолок ширины не держит 2:3: ' + body);
      const em = lampaEm(960, iface) * SCALE[scale];
      const reelH = Math.min(h / 100 * SCREEN, SCREEN - parseFloat(cap[1]) * em);
      if (reelH < h / 100 * SCREEN) clamped++;
      const need = MEASURED[iface][scale] - REEL_PX + reelH;
      assert.ok(need <= AREA[iface] + 0.5, iface + '/' + scale + ': экран не вмещает барабан — ' + need.toFixed(1) + ' px против ' + AREA[iface]);
      assert.ok(reelH >= 0.38 * SCREEN, iface + '/' + scale + ': потолок срезал барабан до ' + reelH.toFixed(1) + ' px');
    }
  }
  /* Потолок режет ровно там, где не помещалось, — а не везде. */
  assert.ok(clamped >= 1 && clamped <= 3, 'потолок барабана сработал в ' + clamped + ' сочетаниях из 12');
  assert.ok(h >= 40, 'барабан мельче 40vh — на трёх метрах постер перестаёт читаться: ' + h);
  /* Плановые 27em высоты (308 px при обычном кегле) в область не влезали —
     проверка, что доля экрана выбрана не «на глаз». */
  assert.ok(MEASURED.normal.normal - REEL_PX + 308 > AREA.normal,
    'план 27em внезапно помещается — числа замера разъехались');
});

test('Task 44: барабан и кнопка — столбиком по центру', () => {
  const stage = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__stage');
  assert.ok(stage.indexOf('flex-direction:column') !== -1, 'сцена не столбик: ' + stage);
  assert.ok(stage.indexOf('-webkit-box-orient:vertical') !== -1, 'нет префиксной пары к flex-direction: ' + stage);
  assert.ok(stage.indexOf('align-items:center') !== -1, 'содержимое не по центру: ' + stage);

  const spin = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__spin');
  assert.ok(/(^|;)margin:\.88em 0 0/.test(spin), '«Крутить» не под барабаном, а сбоку от него: ' + spin);
  const spinH = parseFloat(/height:([\d.]+)em/.exec(spin)[1]);
  const spinR = parseFloat(/border-radius:([\d.]+)em/.exec(spin)[1]);
  assert.ok(Math.abs(spinR - spinH / 2) < 0.01, 'кнопка не пилюля: радиус ' + spinR + ' при высоте ' + spinH);

  /* Правка 2026-09-23 (разбор композиции, п.5.3): подсказки под кнопкой
     нет — ни правила, ни узла (test/roulette.test.mjs). */
  assert.equal(css.indexOf('lumen-roulette__hint'), -1, 'правило подсказки под «Крутить» вернулось');

  for (const sel of ['.lumen-roulette .lumen-roulette__btn']) {
    const btn = findDecl(css, (s) => s === sel);
    const bh = parseFloat(/height:([\d.]+)em/.exec(btn)[1]);
    const br = parseFloat(/border-radius:([\d.]+)em/.exec(btn)[1]);
    assert.ok(Math.abs(br - bh / 2) < 0.01, sel + ': кнопка результата не пилюля: ' + btn);
  }
});

test('Task 44: чипы подборок — одна строка без переноса', () => {
  const chips = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__chips');
  assert.ok(chips, 'правило ленты чипов не найдено');
  assert.ok(chips.indexOf('flex-wrap:nowrap') !== -1, 'лента переносится на второй ряд: ' + chips);
  assert.ok(chips.indexOf('-webkit-flex-wrap:nowrap') !== -1, 'нет префиксной пары: ' + chips);
  const chip = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__chip');
  assert.ok(chip.indexOf('flex-shrink:0') !== -1, 'чип ужимается в ленте: ' + chip);
  assert.ok(/(^|;)margin:0 \.50em 0 0/.test(chip), 'у чипа осталось нижнее поле от переноса: ' + chip);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__chipbox'),
    'обёртки горизонтальной прокрутки нет');
});

/* До результата экран спокойный: кадра нет вовсе. Раньше кадр прошлого
   результата лежал под всем содержимым на opacity .22. */
test('Task 44: до результата кадра на экране нет', () => {
  const bg = findDecl(css, (sel) => sel === '.lumen-roulette-screen .lumen-roulette__bg');
  assert.ok(bg, 'правило кадра не найдено');
  assert.ok(/(^|;)opacity:0(;|$)/.test(bg), 'кадр виден до результата: ' + bg);
  const on = findDecl(css, (sel) => sel === '.lumen-roulette-screen.is-kadr .lumen-roulette__bg');
  assert.ok(on && on.indexOf('opacity:1') !== -1, 'в режиме кадра он не проявляется: ' + on);
  /* Прежнего правила «кадр-подложка .22» не должно остаться нигде. */
  for (const r of ruleBodies(css)) {
    if (r.selectors.some((s) => s.indexOf('lumen-roulette__bg') !== -1)) {
      assert.equal(/opacity:\.22/.test(r.decl), false, 'кадр всё ещё подложка: ' + r.decl);
    }
  }
});

/* Кадр берётся из обёртки, а не из .lumen-roulette: корень рулетки лежит
   внутри прокрутки и начинается ниже шапки Lampa, до верхней кромки экрана
   ему не дотянуться. -4em — ровно поле .wrap__content (app.css:1037), и em
   тут кегль body: обёртка не входит в корни масштаба плагина. */
test('Task 44: кадр и вуаль накрывают и полосу шапки Lampa', () => {
  for (const sel of ['.lumen-roulette-screen .lumen-roulette__bg', '.lumen-roulette-screen .lumen-roulette__veil']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf('top:-4em') !== -1, sel + ': кадр начинается под шапкой Lampa: ' + decl);
    assert.ok(decl.indexOf('position:absolute') !== -1, sel + ': ' + decl);
    assert.ok(decl.indexOf('pointer-events:none') !== -1, sel + ': слой ловит нажатия: ' + decl);
  }
  const scaled = withStorage({ lumen_scale: 'huge' }, (LC) => LC.buildCss());
  const rule = ruleBodies(scaled).find((r) => r.decl === 'font-size:1.2em');
  assert.equal(rule.selectors.indexOf('.lumen-roulette-screen'), -1,
    'обёртке нельзя давать масштаб плагина: -4em перестанет совпадать с полем шапки');
  const screen = findDecl(css, (sel) => sel === '.lumen-roulette-screen');
  assert.ok(screen.indexOf('height:100%') !== -1 && screen.indexOf('overflow:hidden') !== -1, screen);
});

/* Task 64: у героя нижней вуали-плашки больше нет — её заменила маска самих
   слоёв кадра. У рулетки кадр остался фоном div, и вуаль там по-прежнему
   плашка; сверять с героем теперь можно только левую. Нижнюю проверяем по её
   собственным стопам — тем же пяти, с которых начинали обе.

   Правка 2026-09-23 (разбор композиции, п.1.4): левая вуаль ГЕРОЯ разошлась
   с рулеточной сознательно, и равенством их больше не сторожат. У героя она
   стала подушкой под текстом — плотность поднята до .97 и ограничена по
   вертикали собственной маской, потому что мета героя лежит на кадре и на
   белом кадре давала 1.18:1. У рулетки под вуалью кадра нет вовсе (экран
   рисуется ровным градиентом, п.5.4 того же разбора), поднимать там
   плотность не за чем — на этом экране нечего гасить. Общим остаётся
   направление и смысл, а не числа.
   Волна 3: у героя вместо вуали — левое затемнение неподвижного слоя кадра
   (.95 у кромки и ноль у ПРАВОЙ кромки экрана); с рулеточной вуалью оно
   по-прежнему не совпадает. */
test('Task 44/64: левая вуаль результата — плашка на прежних стопах, геройская ушла своим путём', () => {
  const heroL = findDecl(css, (sel) => sel === '.lumen-hero-stage .lumen-hero__scrim.lumen-hero__scrim--l');
  const roulL = findDecl(css, (sel) => sel === '.lumen-roulette-screen .lumen-roulette__veil--l');
  const roulB = findDecl(css, (sel) => sel === '.lumen-roulette-screen .lumen-roulette__veil--b');
  assert.ok(roulL.indexOf(',.85) 0%') !== -1 && roulL.indexOf(',.45) 30%') !== -1 && roulL.indexOf(',0) 65%') !== -1,
    'левая вуаль рулетки съехала со своих стопов: ' + roulL);
  assert.notEqual(roulL, heroL, 'вуали снова совпали — значит геройскую вернули к рулеточной плотности, и мета на белом кадре опять не читается');
  assert.ok(heroL.indexOf(',.95) 0%') !== -1, 'у героя плотность левого затемнения упала ниже расчётной по WCAG: ' + heroL);
  for (const need of [',.92) 10%', ',.6) 24%', ',.25) 42%', ',0) 62%']) {
    assert.ok(roulB.indexOf(need) !== -1, 'нет стопа ' + need + ': ' + roulB);
  }
  assert.ok(roulB.indexOf('-webkit-linear-gradient(bottom,') !== -1, 'старым webkit-движкам нужен префиксный градиент: ' + roulB);
});

test('Task 44: карточка результата — в потоке без кадра, внизу слева с кадром', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__result');
  assert.ok(/(^|;)display:none/.test(base), 'пустая карточка результата занимает место: ' + base);
  const live = findDecl(css, (sel) => sel === '.lumen-roulette .lumen-roulette__result.is-live');
  assert.ok(live && live.indexOf('display:block') !== -1, live);
  const kadr = findDecl(css, (sel) => sel === '.lumen-roulette-screen.is-kadr .lumen-roulette__result');
  assert.ok(kadr, 'правила карточки поверх кадра нет');
  assert.ok(kadr.indexOf('position:absolute') !== -1 && /(^|;)left:3\.51em/.test(kadr) && /(^|;)bottom:/.test(kadr),
    'карточка не прижата вниз слева: ' + kadr);
  /* Корень в режиме кадра обязан кончаться там же, где область прокрутки, —
     иначе «внизу» окажется ниже кромки экрана. */
  const root = findDecl(css, (sel) => sel === '.lumen-roulette-screen.is-kadr .lumen-roulette');
  assert.ok(root && root.indexOf('height:100%') !== -1 && root.indexOf('overflow:hidden') !== -1, root);
  const calm = findDecl(css, (sel) => sel === '.lumen-roulette-screen.is-kadr .lumen-roulette__head');
  assert.ok(calm && calm.indexOf('opacity:0') !== -1, 'спокойный экран не гасится под кадром: ' + calm);
  /* Гасится прозрачностью, а не display:none: место в потоке сохраняется, и
     возврат по «Ещё раз» не пересчитывает раскладку. */
  assert.equal(/display:none/.test(calm), false, calm);
});

/* Кадр обязан появиться В ТОМ ЖЕ кадре отрисовки, в котором снимается
   удержанный слой перехода (src/67_transition.js, reveal): проявляйся он
   плавно — между снятием слоя и приходом кадра мигнул бы спокойный экран. */
test('Task 44: смена состояния рулетки без переходов', () => {
  const offenders = [];
  for (const r of ruleBodies(css)) {
    if (!r.selectors.some((s) => s.indexOf('lumen-roulette-screen') !== -1)) continue;
    if (/transition/.test(r.decl)) offenders.push(r.selectors.join(',') + ' -> ' + r.decl);
  }
  assert.deepEqual(offenders, []);
  /* Прежний кроссфейд кадра-подложки снят вместе с самой подложкой. */
  const old = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('lumen-roulette__bg') !== -1)
    && /transition/.test(r.decl));
  assert.deepEqual(old.map((r) => r.decl), []);
});

test('Task 44: корень рулетки без собственного фона и без 100vh', () => {
  const root = findDecl(css, (sel) => sel === '.lumen-roulette');
  assert.ok(root, 'правило корня не найдено');
  assert.equal(/min-height:100vh/.test(root), false,
    'корень выше области прокрутки — низ экрана уезжает за кромку: ' + root);
  assert.ok(root.indexOf('min-height:100%') !== -1, root);
  /* Ревью Task 44 (п.3): нижнее поле корня перебирало область прокрутки на
     трёх верхних ступенях кегля (замеры на стенде: +6, +4 и +23 px), и
     диапазон прокрутки переставал быть нулевым — scroll.update(el, true) на
     каждом заходе фокуса дёргал экран вверх. Сокращений у padding быть не
     должно: поле снизу задаётся только двумя значениями. */
  const pad = /(^|;)padding:([^;}]+)/.exec(root);
  assert.ok(pad, 'у корня нет padding вовсе: ' + root);
  const parts = pad[2].trim().split(/\s+/);
  assert.equal(parts.length, 2, 'третье значение padding — это поле снизу: ' + pad[2]);
  assert.equal(parts[0], '0', 'сверху поле даёт маска прокрутки, своё было бы вторым: ' + pad[2]);
  assert.equal(/padding-bottom/.test(root), false, 'нижнее поле вернулось отдельным объявлением: ' + root);
});

/* -------------------------------------------------------------------- */
/* Task 63: типографика и поля по tvOS.                                  */
/*                                                                        */
/* Apple HIG Typography: шкала tvOS начинается с Caption 2 — 23 px при    */
/* «дефолте 29 и минимуме 23»; Amazon требует 28 px телу текста,          */
/* Microsoft — 30 основному и 24 второстепенному                          */
/* (docs/research/2026-09-21-tv-design-specs.md §1 и §2). 23 px — это     */
/* ФИЗИЧЕСКИЕ пиксели растра 1920×1080: на телевизоре пользователя        */
/* (Philips 50PUS8057, Android TV 11) WebView отдаёт CSS-окно 960×540     */
/* при devicePixelRatio 2. База Lampa (innerWidth / 84.17) на этом растре */
/* 22.811 px, значит порог в наших единицах — 1.01em.                     */
/* -------------------------------------------------------------------- */

const TV_MIN_EM = 1.01;

/* Узлы, которые лежат ВНУТРИ .lumen-hero__text (разметка buildNode,
   src/48_hero.js:479-500), — у их em свой множитель: у блока кегль
   TEXT_ZOOM, и .88em внутри него это .97em базовых, а не .88. Список
   явный, потому что по селектору вложенность не видна. */
const HERO_TEXT_KIDS = ['lumen-hero__meta', 'lumen-hero__logo', 'lumen-hero__title',
  'lumen-hero__descr', 'lumen-hero__sk', 'lumen-hero__chips', 'lumen-hero__status'];

/* Узлы, которым кегль задан, но СВОЕГО текста у них нет: всё, что читают,
   лежит в детях со своим font-size. Проверено по разметке:
   .lumen-progress — три узла .lumen-progress__label/__time/__bar
   (src/40_template.js:196-198), подписи 1.01em;
   .full-start__button — штатная кнопка Lampa: <svg> плюс <span>, которому
   наше правило даёт 1.05em (подпись «Продолжить S2 E3» — :after с тем же
   1.05em);
   .lumen-stop и .lumen-franchise — собственная иконка плюс <span>
   (src/55_trailer.js:349-352, src/46_hub.js:1650-1652), у span 1.05em;
   .lumen-hero__text — блок-контейнер, его font-size это множитель
   содержимого (TEXT_ZOOM). */
const TEXT_LESS_BOXES = ['.lumen-card .lumen-progress',
  '.lumen-card .full-start-new__buttons .full-start__button',
  '.lumen-card .lumen-stop', '.lumen-card .lumen-franchise',
  '.lumen-hero .lumen-hero__text', '.lumen-hero.lumen-hero--compact .lumen-hero__text'];

test('Task 63: ни один текст интерфейса не мельче минимума tvOS', () => {
  const zoom = parseFloat(/font-size:([\d.]+)em/.exec(decl(css, '.lumen-hero .lumen-hero__text'))[1]);
  assert.equal(zoom, 1.1, 'множитель блока героя изменился — пересчитать эффективные кегли');

  /* Самая мелкая ступень заголовка карточки — множитель для его уровней
     (.lumen-title__lead/__sub, у которых кегль задан долей). Берётся из
     таблицы, а не числом рядом: появится четвёртая ступень — сторож
     посчитает по ней. */
  const titleMin = Math.min.apply(null, ruleBodiesWithMedia(css)
    .filter((r) => r.selectors.some((s) => /full-start-new__title($|[.:])/.test(s)))
    .map((r) => declProp(r.decl, 'font-size'))
    .filter((v) => v !== null && /^[\d.]+em$/.test(v.trim()))
    .map((v) => parseFloat(v)));
  assert.ok(titleMin > 1 && titleMin < 4, 'ступени заголовка карточки не найдены: ' + titleMin);

  const small = [];
  let checked = 0;
  for (const rule of ruleBodiesWithMedia(css)) {
    const value = declProp(rule.decl, 'font-size');
    if (value === null) continue;
    for (const sel of rule.selectors) {
      /* HUD — служебный оверлей отладки (src/69_hud.js), его цифры читает
         не зритель с дивана, а разработчик вплотную к экрану; кегль ему
         задан сокращением font:, а не font-size, поэтому сюда он и не
         попадает — проверяем явно, чтобы исключение осталось осознанным. */
      if (sel.indexOf('lumen-hud') !== -1) continue;
      if (TEXT_LESS_BOXES.indexOf(sel) !== -1) continue;
      const found = /^([\d.]+)em$/.exec(value.trim());
      assert.ok(found, 'кегль задан не в em, и минимум по нему не посчитать: ' + sel + ' {' + value + '}');
      const inHero = HERO_TEXT_KIDS.some((cls) => sel.indexOf(cls) !== -1);
      /* Правка 2026-09-23 (п.2.1): второй уровень названия задан ОТНОСИТЕЛЬНО
         заголовка карточки — у того три ступени (обычная, узкий экран,
         сжатая шапка), и абсолютное число пришлось бы повторять в каждой.
         Считаем по САМОЙ МЕЛКОЙ ступени: она и даёт худший случай. */
      const inTitle = sel.indexOf('lumen-title__') !== -1;
      const effective = parseFloat(found[1]) * (inHero ? zoom : 1) * (inTitle ? titleMin : 1);
      checked++;
      if (effective < TV_MIN_EM - 0.005) small.push(sel + ': ' + effective.toFixed(3) + 'em = ' + (effective * 22.811).toFixed(1) + ' px');
    }
  }
  assert.ok(checked > 80, 'подозрительно мало кеглей проверено: ' + checked);
  assert.deepEqual(small, [], 'текст мельче минимума tvOS (23 px = 1.01em)');
});

test('Task 63: HUD — единственное исключение, и он служебный', () => {
  const hud = findDecl(css, (sel) => sel === '.lumen-hud');
  assert.ok(hud, 'правило HUD не найдено');
  assert.ok(/font:\.7em\//.test(hud), 'кегль HUD задан сокращением font: — ' + hud);
});

/* Task 68: строку HUD читают с фотографии экрана телевизора, поэтому
   перенос не имеет права резать числа. Замер на стенде 960×540@2 (переносы
   по Range.getClientRects посимвольно): при word-break:break-all величина
   «hw 12c/32gb» ложилась как «12c/» и «32gb» на разных строках. */
test('Task 68: HUD переносится по словам, а не по символам', () => {
  const hud = findDecl(css, (sel) => sel === '.lumen-hud');
  assert.ok(hud, 'правило HUD не найдено');
  assert.equal(hud.indexOf('word-break:break-all'), -1, 'посимвольный перенос вернулся — ' + hud);
  assert.ok(/overflow-wrap:break-word/.test(hud), 'рвётся только не помещающееся слово — ' + hud);
  assert.ok(/word-wrap:break-word/.test(hud), 'старое имя свойства для WebView Chrome/77 — ' + hud);
  assert.ok(/max-width:34em/.test(hud), 'ширина под выросшую строку — ' + hud);
});

test('Task 63: safe area — одна величина на всех экранах плагина', () => {
  /* 80 px по бокам и 60 сверху/снизу — Apple HIG Layout (pt = px на
     1920×1080), то есть 3.51em и 2.63em при базе 22.811. Прежние 2.81em
     (64 px) были нашим числом из design-spec §1. */
  assert.equal(css.indexOf('2.81em'), -1, 'в таблице остался прежний отступ 2.81em');

  const edges = [
    ['.full-start-new.lumen-card', 'padding:0 3.51em 2.63em'],
    ['.lumen-descr-row .full-descr', 'padding-left:3.51em'],
    ['.lumen-hub', 'padding:2.63em 3.51em'],
    ['.lumen-grid', 'padding:2.63em 3.51em'],
    ['.lumen-main .items-line__head', 'padding-left:3.51em'],
    ['.lumen-main .items-line .scroll__content', 'padding-left:3.51em'],
    ['.lumen-moods', 'left:3.51em'],
    ['.lumen-roulette', 'padding:0 3.51em'],
    ['.lumen-ambient .lumen-ambient__info', 'left:3.51em'],
    ['.lumen-minimap', 'right:3.51em'],
    ['.lumen-jump', 'bottom:2.63em']
  ];
  for (const [sel, want] of edges) {
    const body = findDecl(css, (s) => s === sel);
    assert.ok(body, 'правило не найдено: ' + sel);
    assert.ok(body.indexOf(want) !== -1, sel + ' стоит не по safe area: ' + body);
  }

  /* У текста героя отступ делится на его собственный кегль: em у left/right
     считается от font-size самого узла (TEXT_ZOOM), и без деления логотип
     не стоял бы на одной вертикали с заголовком ряда.
     Ревью фикс-раунда (п.3): содержимое стоит на padding-left, и safe area —
     сумма left и padding-left. Волна 3 сняла запас рамки за левую кромку
     (left:0): подушки-вуали в блоке больше нет. */
  const hero = decl(css, '.lumen-hero .lumen-hero__text');
  const zoom = parseFloat(/font-size:([\d.]+)em/.exec(hero)[1]);
  const heroLeft = parseFloat(/(^|;)left:(-?[\d.]+)(em)?(;|$)/.exec(hero)[2]);
  assert.equal(heroLeft, 0, 'рамка текстового блока снова заходит за кромку кадра: ' + hero);
  const heroPad = parseFloat(/(^|;)padding:0 0 [\d.]+vh ([\d.]+)em/.exec(hero)[2]);
  assert.ok(Math.abs((heroLeft + heroPad) * zoom - 3.51) < 0.02,
    'текст героя стоит не по safe area: ' + hero);
});

test('Task 63: подпись карточки под фокусом уезжает вниз — только в motion-full', () => {
  const rules = ruleBodies(css).filter((r) => r.selectors.some((s) => /card\.focus \.card__(title|age)$/.test(s)));
  const shift = rules.find((r) => /translateY/.test(r.decl));
  assert.ok(shift, 'правила сдвига подписи под фокусом нет');
  assert.ok(shift.selectors.every((s) => s.indexOf('body.lumen-motion-full ') === 0),
    'сдвиг обязан жить только в режиме полных анимаций: ' + shift.selectors.join(','));
  assert.ok(shift.decl.indexOf('-webkit-transform:translateY') !== -1, 'старым webkit-движкам нужен префикс: ' + shift.decl);
  const em = parseFloat(/[^-]transform:translateY\(([\d.]+)em\)/.exec(shift.decl)[1]);
  assert.ok(em > 0 && em <= 0.4, 'сдвиг вне разумного (8 физ. px при .35em): ' + em);

  /* Сдвиг едет тем же переходом, что и постер: жест обязан быть один. */
  const move = findDecl(css, (sel) => sel === 'body.lumen-motion-full .lumen-main .card__title');
  const poster = findDecl(css, (sel) => sel === 'body.lumen-motion-full .lumen-main .card__view');
  assert.ok(move && /transition:transform \.18s ease-out/.test(move), 'подпись едет без перехода: ' + move);
  assert.ok(poster && /transition:transform \.18s ease-out/.test(poster), 'постер сменил переход: ' + poster);

  /* box-shadow в списке переходов запрещён по всему плагину (Task 38). */
  assert.equal(/box-shadow/.test(move), false, 'тень в списке переходов подписи: ' + move);
});

/* Зазор между рядами. HIG Layout → Grids просит ≥ 100 px (4.39em), и Task 63
   его НЕ ставит — бюджет высоты экрана кончается раньше. Тест держит не
   красивое число, а сам размен: от следующего ряда обязано быть что-то
   видно, а зазор HIG обязан этого лишать — иначе отступление перестало бы
   иметь основание и его надо было бы снять. */
/* Правка 2026-09-23 (разбор композиции, п.1.5): кнопка «Ещё» в ШАПКЕ ряда
   скрыта. Разбор предлагал увести её последней плиткой в ленту — на стенде
   960×540@2 выяснилось, что такую плитку Lampa делает сама: при первой
   прокрутке ряда она дописывает в конец ленты .card-more.selector габаритом
   ровно в карточку (onScroll, vendor/lampa/app.min.js:19159-19176; замер:
   108.6×196.2 px при карточке 108.6×196.2), и фокус доезжает до неё по
   ряду. В шапке стоял дубль, до которого пультом было не добраться:
   «вверх» с крайней правой карточки уводит в шапку самой Lampa
   (проверено — фокус уходит на .head__action поиска).

   Своего узла в ряд Lampa мы при этом не вставляем — только гасим чужой,
   как уже гасим .card-watched и .card__vote. */
test('правка 2026-09-23: кнопка «Ещё» убрана из шапки ряда, шапку меряет заголовок', () => {
  const more = declAll(css, '.lumen-main .items-line__more');
  assert.ok(/display:none/.test(more), 'дубль «Ещё» в шапке ряда вернулся: ' + more);
  /* И высота шапки в модели раскладки теперь равна высоте заголовка — то
     самое место, где освободились 6.5 CSS px бюджета первого ряда. */
  const W = 960;
  const H = 540;
  const withMore = rowLayout(css, W, H, { more: true });
  const plain = rowLayout(css, W, H, { more: false });
  assert.equal(withMore.textBottomUp, plain.textBottomUp, 'ряды с кнопкой и без снова разной высоты');
  assert.ok(Math.abs(withMore.textBottomUp - 518.5) < 1,
    'низ подписи в сжатом состоянии ' + withMore.textBottomUp.toFixed(1) + ' вместо расчётных 518.5');
});

test('Task 63: зазор между рядами — нижняя граница равна отступу Lampa над фокусным рядом', () => {
  const W = 960;
  const H = 540;
  const EM = W / 84.17;
  const gap = num(decl(css, '.lumen-main .items-line'), 'padding-bottom');
  /* Прежняя редакция этого теста требовала обратного — чтобы от следующего
     ряда «что-то было видно» (ресёрч §3, «ряд обрезан встык — дефект»), и
     держала зазор 1.4em. Решение пользователя 2026-09-23 это отменило:
     «мне не нравится, когда есть этот выступ» (запись в
     docs/plans/2026-09-22-lumen-final.md, раздел «Решения пользователя»).
     Теперь базовый зазор — ровно отступ Lampa над фокусным рядом
     (.scroll--mask .scroll__content{padding:2.5em 0}, app.css), чтобы
     подписи уехавшего вверх ряда кончались не ниже верха области. */
  const lampa = lampaCss();
  assert.equal(gap, lampaDecl(lampa, '.scroll--mask .scroll__content', 'padding'),
    'базовый зазор между рядами разошёлся с отступом Lampa над фокусным рядом');
  const box = rowLayout(css, W, H, { more: true });
  assert.ok(box.flowBottomUp + gap * EM >= H, 'следующий ряд выглядывает снизу: начинается на ' +
    (box.flowBottomUp + gap * EM).toFixed(1));
});

/* Обрезка ряда. Пятый пункт Task 63 просил overflow:visible у контейнера
   ряда, чтобы выросший постер и подложка фокуса не резались. Проверка на
   стенде показала, что вешать нечего: Lampa строит горизонтальный скролл
   ряда без over/mask (new Scroll({horizontal:true, step}) в
   vendor/lampa/app.min.js:52616-52619, а классы scroll--over/scroll--mask
   ставятся только по params.over/params.mask, там же:31858-31859), и у всей
   цепочки .items-line → .items-line__body → .scroll--horizontal →
   .scroll__content → .scroll__body computed overflow: visible. Единственный
   обрезающий предок — НАША область рядов, и её overflow:hidden держит
   раскладку главной: без него ряды вылезли бы на кадр героя и за кромку
   экрана. Поэтому правило overflow здесь не появляется ни одно. */
test('Task 63: обрезку задаёт только область рядов — контейнерам ряда overflow не трогаем', () => {
  /* Правка 2026-09-23: проверяется КОНЕЦ селектора, а не вхождение в него.
     Запрет касается самого контейнера ряда; у правила кромки для ленты людей
     (body .items-line .full-person__body) overflow стоит на внутреннем узле
     карточки, и горизонтальной прокрутке ряда он не мешает — она живёт
     выше, на .scroll__body. */
  const ours = ruleBodies(css).filter((r) => /(^|;)overflow/.test(r.decl) &&
    r.selectors.some((s) => /(items-line|items-cards|scroll--horizontal)[\w-]*$/.test(s.trim())));
  assert.deepEqual(ours.map((r) => r.selectors.join(',')), [],
    'правило overflow на контейнере ряда — оно сломает горизонтальную прокрутку Lampa');

  const area = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  assert.ok(area && area.indexOf('overflow:hidden') !== -1, 'область рядов обязана обрезать ряды: ' + area);

  /* И в самой Lampa у ряда своего overflow нет — иначе наш «ничего не
     трогаем» опирался бы на догадку. */
  const lampa = lampaCss();
  for (const sel of ['.items-line', '.items-line__head']) {
    const at = lampa.indexOf('\n' + sel + ' {');
    assert.notEqual(at, -1, 'правило ' + sel + ' в app.css не найдено');
    assert.equal(/overflow/.test(lampa.slice(at, lampa.indexOf('}', at))), false, sel + ': у Lampa появился свой overflow');
  }
});

/* Шкала заголовка карточки — ступени tvOS, а не произвольные числа:
   Title 1 76 px (3.33em) в базовом правиле, Title 2 57 px (2.5em) на
   экране уже 1000 CSS px и Title 3 48 px (2.11em) в сжатой шапке
   (docs/research/2026-09-21-tv-design-specs.md §1). На телевизоре
   пользователя (WebView 960 CSS px при devicePixelRatio 2) работает
   средняя ступень — это проверено живым замером на стенде, и потому тест
   держит все три разом, а не одно базовое правило. */
test('Task 63: заголовок карточки — три ступени шкалы tvOS', () => {
  const base = decl(css, '.lumen-card .full-start-new__title');
  assert.ok(base.indexOf('font-size:3.33em') !== -1, 'базовый — Title 1, 76 px: ' + base);
  assert.ok(base.indexOf('line-height:1.26') !== -1, 'межстрочный Title 1 — 96/76: ' + base);
  assert.ok(base.indexOf('letter-spacing:0') !== -1, 'трекинг на ТВ — нулевой или положительный: ' + base);

  const narrow = ruleBodiesWithMedia(css).find((r) => r.media && /max-width:1000px/.test(r.media) &&
    r.selectors.some((s) => s === '.lumen-card .full-start-new__title'));
  assert.ok(narrow && narrow.decl.indexOf('font-size:2.5em') !== -1, 'узкий экран — Title 2, 57 px: ' + (narrow && narrow.decl));
  /* Фикс-раунд Task 63: со ступенью берётся и её межстрочный — Title 2 это
     66/57 = 1.16, Title 3 — 56/48 = 1.17; без этого обе мелкие ступени
     получали межстрочный Title 1 (1.26) и шапка была выше расчётной. */
  assert.ok(narrow.decl.indexOf('line-height:1.16') !== -1, 'межстрочный Title 2 — 66/57: ' + narrow.decl);

  const compact = decl(css, '.lumen-card.lumen-compact .full-start-new__title');
  assert.ok(compact.indexOf('font-size:2.11em') !== -1, 'сжатая шапка — Title 3, 48 px: ' + compact);
  assert.ok(compact.indexOf('line-height:1.17') !== -1, 'межстрочный Title 3 — 56/48: ' + compact);
});

/* Компактная ветка вёрстки включается по ФИЗИЧЕСКОМУ растру. Прежнее условие
   (max-width:1000px по CSS-ширине) срабатывало на телевизоре пользователя:
   WebView отдаёт 960 CSS px при devicePixelRatio 2, то есть 1920 физических.
   Цена была не в кегле заголовка — вторым правилом ветка обнуляет
   min-height:74vh у тела карточки, и шапка переставала быть прижатой к низу
   кадра (замер на стенде 960×540@2 до правки: min-height 0px, тело карточки
   74…296 при окне 540; после — 399.6px и 74…474). */
test('Task 63: порог компактной ветки делится на devicePixelRatio', () => {
  const threshold = (built) => parseInt(/@media screen and \(max-width:(\d+)px\)/.exec(built)[1], 10);
  /* В node window нет вовсе — это и есть «DPR 1» по умолчанию. */
  assert.equal(threshold(css), 1000, 'без window порог обязан остаться прежним');

  for (const [dpr, want] of [[1, 1000], [1.5, 667], [2, 500], [3, 333]]) {
    const built = withStorage({}, (LC) => {
      globalThis.window.devicePixelRatio = dpr;
      return LC.buildCss();
    });
    assert.equal(threshold(built), want, 'DPR ' + dpr + ': порог ' + threshold(built) + ' вместо ' + want);
  }

  /* Телевизор пользователя: 960 CSS px при DPR 2 — порог 500, ветка
     выключена, значит min-height:74vh у тела карточки действует. */
  const tv = withStorage({}, (LC) => {
    globalThis.window.devicePixelRatio = 2;
    return LC.buildCss();
  });
  assert.ok(960 > threshold(tv), 'на 960 CSS px при DPR 2 компактная ветка обязана быть выключена');
  const body = ruleBodiesWithMedia(tv).filter((r) => r.selectors.some((s) => s === '.lumen-card .full-start-new__body'));
  assert.ok(body.some((r) => !r.media && /min-height:74vh/.test(r.decl)), 'базовое правило тела карточки потеряло min-height');
  assert.ok(body.some((r) => r.media && /min-height:0/.test(r.decl)), 'компактная ветка перестала обнулять min-height');
});

/* Ревью Task 63: модель раскладки (mediaApplies выше) разбирает ровно два
   семейства медиаусловий, и это обязано оставаться правдой — иначе она молча
   посчитает раскладку не по тем правилам. Прежний страж ловил только
   max-aspect-ratio и мимо max-width прошёл. */
test('Task 63: медиазапросы таблицы — из известного набора', () => {
  const seen = new Set();
  for (const line of css.split('\n')) {
    if (line.indexOf('@media') !== 0) continue;
    const cond = line.slice(0, line.indexOf('{'));
    for (const feature of cond.match(/\(([a-z-]+):/g) || []) seen.add(feature.slice(1, -1));
    assert.ok(/^@media screen and \((min-aspect-ratio|max-aspect-ratio|max-width)/.test(cond), 'незнакомый медиазапрос: ' + cond);
  }
  /* Правка 2026-09-23: к набору добавился max-aspect-ratio — верхняя граница
     интервала, в котором зазор между рядами считается по кромке; у
     широкого интервала она единственное условие, отсюда и начало строки. */
  assert.deepEqual([...seen].sort(), ['max-aspect-ratio', 'max-width', 'min-aspect-ratio'],
    'набор медиаусловий таблицы изменился — проверить mediaApplies в этом файле');
});

/* ====================================================================== */
/* Task 73 (фаза 6): плоский вид — пресет «Как Apple TV» на остальные      */
/* экраны. Отзыв пользователя 2026-09-21 (п.3): «„Как в Apple TV“          */
/* выглядит хорошо, но менялся только дизайн стартовой».                   */
/* ====================================================================== */

const flatCss = withStorage({ lumen_flat: 'true' }, (LC) => LC.buildCss());

/* Последнее правило для данного селектора: плоский вид стоит в конце сборки
   и берёт верх порядком, а не специфичностью, — значит проверять надо
   именно последнее вхождение, а не первое (findDecl выше отдаёт первое). */
function lastDecl(cssText, sel) {
  const rules = ruleBodies(cssText).filter((r) => r.selectors.some((s) => s === sel));
  return rules.length ? rules[rules.length - 1].decl : null;
}

test('Task 73: выключенный плоский вид не добавляет в таблицу ни одного правила', () => {
  assert.equal(css.indexOf('lumen-facts__value + .lumen-facts__label'), -1, 'строка фактов появилась без настройки');
  assert.equal(css.indexOf('tag-count'), -1, 'счётчики разделов тронуты без настройки');
  /* Базовая панель «Подробно» на месте: подложка и рамка. */
  const facts = lastDecl(css, '.lumen-descr-row .lumen-facts');
  assert.ok(/background:#/.test(facts) || /background:rgba/.test(facts), 'подложка панели пропала в обычном виде: ' + facts);
  assert.ok(/border:\.04em solid/.test(facts), 'рамка панели пропала в обычном виде: ' + facts);
});

test('Task 73: карточка — панель «Подробно» становится строкой фактов под описанием', () => {
  const facts = lastDecl(flatCss, '.lumen-descr-row .lumen-facts');
  assert.ok(/background:none/.test(facts), 'подложка осталась: ' + facts);
  assert.ok(/border-color:transparent/.test(facts), 'рамка осталась: ' + facts);
  assert.ok(/flex-basis:100%/.test(facts), 'панель не встала своей строкой под описанием: ' + facts);
  /* Сетка «ярлык/значение» разворачивается в строку с разделителем «·»
     перед каждым ярлыком, кроме первого. */
  assert.ok(/display:block/.test(lastDecl(flatCss, '.lumen-descr-row .lumen-facts__grid')));
  assert.ok(/display:inline/.test(lastDecl(flatCss, '.lumen-descr-row .lumen-facts__label')));
  assert.ok(/display:inline/.test(lastDecl(flatCss, '.lumen-descr-row .lumen-facts__value')));
  const sep = lastDecl(flatCss, '.lumen-descr-row .lumen-facts__value + .lumen-facts__label:before');
  assert.ok(sep && sep.indexOf(String.raw`content:"\00B7"`) === 0, 'разделителя фактов нет: ' + sep);
});

/* Счётчики разделов («Жанр 5 · Производство 2 · Теги 14») — штатные
   .tag-count Lampa (vendor/lampa/css/app.css:2936). Их белая инверсия в
   фокусе (app.css:2973) обязана уцелеть: наша таблица подключается после
   app.css, и правило без :not(.focus) перебило бы её при равной
   специфичности. */
test('Task 73: счётчики разделов теряют плашки только вне фокуса', () => {
  for (const sel of ruleSelectors(flatCss).filter((s) => s.indexOf('tag-count') !== -1)) {
    assert.ok(sel.indexOf(':not(.focus)') !== -1, 'правило счётчика задевает фокус: ' + sel);
  }
  const chip = lastDecl(flatCss, '.lumen-descr-row .tag-count:not(.focus)');
  assert.ok(/background-color:transparent/.test(chip), 'плашка счётчика осталась: ' + chip);
  const count = lastDecl(flatCss, '.lumen-descr-row .tag-count:not(.focus) .tag-count__count');
  assert.ok(/background-color:transparent/.test(count), 'белый чип числа остался: ' + count);
});

/* Правка 2026-09-23 (разбор композиции, п.3.1). Прежде плоский вид держал у
   плитки серии СВОЮ раскладку — кадр полосой 3.95em сверху, подпись под ним,
   своя высота плитки 8.15em, свои цвета над кадром и под ним, свой паддинг у
   фокуса. Она и была источником «полоски 4:1» из разбора. Теперь раскладка
   одна на оба вида (кадр 16:9 во всю плитку, подпись поверх него на
   градиенте — сторожа у базовых правил выше), и плоскому виду осталось
   ровно то, чем он и является: нет рамки, меньше радиус, непрозрачный фон
   под плиткой без кадра. Сторож следит, чтобы раскладка не разъехалась
   обратно: у плитки серии и её потомков плоский вид не имеет права задавать
   ни геометрию, ни цвета текста. */
test('Task 73 + правка 2026-09-23: плоский вид правит у плитки серии только фон и рамку', () => {
  const GEOMETRY = /(?:^|;)(height|width|padding|margin|top|bottom|left|right|flex|-webkit-box-pack|-webkit-justify-content|justify-content|background-size|-webkit-background-size|color)\s*:/;
  const plain = ruleSelectors(css);
  let own = 0;
  for (const r of ruleBodies(flatCss)) {
    for (const sel of r.selectors) {
      if (sel.indexOf('lumen-episode') === -1) continue;
      /* Правила, которые есть и в обычной таблице, — общие; плоский вид
         дописывает свои в конец (сторож этого — отдельным тестом ниже). */
      if (plain.indexOf(sel) !== -1 && ruleBodies(css).some((p) => p.selectors.indexOf(sel) !== -1 && p.decl === r.decl)) continue;
      own++;
      assert.equal(sel, '.lumen-card .lumen-episode', 'плоский вид завёл своё правило у потомка плитки серии: ' + sel + '{' + r.decl + '}');
      assert.ok(!GEOMETRY.test(r.decl), 'плоский вид правит у плитки геометрию или цвет текста: ' + r.decl);
      assert.ok(/border-color:transparent/.test(r.decl), 'рамка плитки осталась: ' + r.decl);
      assert.ok(/border-radius:\.3em/.test(r.decl), 'радиус плоского вида потерян: ' + r.decl);
      /* Ревью 2026-09-22 (п.2): у серий без кадра сквозь плитку просвечивал
         бэкдроп карточки под вуалью, и контраст подписи менялся от фильма к
         фильму. Непрозрачный P.panel это закрывает. */
      const bg = /background-color:(#[0-9A-Fa-f]{6})/.exec(r.decl);
      assert.ok(bg, 'у плитки нет непрозрачного фона: ' + r.decl);
      assert.equal(bg[1], '#1C1613', 'фон плитки не P.panel: ' + bg[1]);
      /* background-color обязан стоять ПОСЛЕ шортката background, иначе тот
         его же и сбросит; а сам шорткат обязан быть — у базового правила фон
         задан градиентом (background-image), одним цветом он не снимается. */
      assert.ok(/(^|;)background:none/.test(r.decl), 'градиент базового правила не снят: ' + r.decl);
      assert.ok(r.decl.indexOf('background-color:') > r.decl.lastIndexOf('background:'), 'background-color сброшен шорткатом: ' + r.decl);
    }
  }
  assert.equal(own, 1, 'своих правил у ряда серий в плоском виде стало ' + own + ' вместо одного');
});

test('Task 73: отзывы — плоский список без карточек-подложек', () => {
  const review = lastDecl(flatCss, '.lumen-descr-row .lumen-review');
  assert.ok(/background:none/.test(review) && /border-color:transparent/.test(review), review);
  /* Полоса тона слева — единственный цветной признак — остаётся. */
  assert.equal(lastDecl(flatCss, '.lumen-descr-row .lumen-review__tone'), lastDecl(css, '.lumen-descr-row .lumen-review__tone'));
});

test('Task 73: сетка подборки и хаб — плитки без подложек', () => {
  assert.ok(/background-color:transparent/.test(lastDecl(flatCss, '.lumen-grid .lumen-gcard .card__view')));
  assert.ok(/background-color:transparent/.test(lastDecl(flatCss, '.lumen-grid .lumen-gcard .card__img')));
  assert.ok(/background:none/.test(lastDecl(flatCss, '.lumen-hub__tiles .lumen-tile')));
  /* Фокус обоих экранов не тронут: увеличение и подложка на месте. */
  assert.equal(lastDecl(flatCss, '.lumen-grid__items .lumen-gcard.focus'), lastDecl(css, '.lumen-grid__items .lumen-gcard.focus'));
  assert.equal(lastDecl(flatCss, '.lumen-hub__tiles .lumen-tile.focus'), lastDecl(css, '.lumen-hub__tiles .lumen-tile.focus'));
});

/* Плоский вид обязан быть ДОБАВКОЙ в конце таблицы: ни одно прежнее правило
   не исчезает и не переписывается на месте, а всё новое живёт в четырёх
   известных корнях. Рядов главной среди них нет — инвариант раскладки
   («низ подписи первого ряда ≤ 532») считается по тем же правилам, что и
   без настройки. */
test('Task 73: плоский вид только дописывает правила — и только карточке, сетке и хабу', () => {
  const key = (r) => r.selectors.join(',') + '{' + r.decl + '}';
  const base = ruleBodies(css).map(key);
  const flat = ruleBodies(flatCss).map(key);
  for (const rule of base) {
    assert.ok(flat.indexOf(rule) !== -1, 'правило обычного вида пропало при плоском: ' + rule.slice(0, 120));
  }
  const ROOTS = ['.lumen-descr-row ', '.lumen-card .lumen-episode', '.lumen-grid ', '.lumen-hub__tiles '];
  const added = ruleBodies(flatCss).filter((r) => base.indexOf(key(r)) === -1);
  assert.ok(added.length > 10, 'подозрительно мало правил у плоского вида: ' + added.length);
  for (const rule of added) {
    for (const sel of rule.selectors) {
      assert.ok(ROOTS.some((root) => sel.indexOf(root) === 0), 'плоский вид трогает чужой корень: ' + sel);
    }
  }
});

/* A6 (волна A финального плана): «Метаданные» и «Настроения» на карточке
   фильма — ряды САМОЙ Lampa (MetadataChart, vendor/lampa/app.min.js:38200 и
   MetadataTags, :38272; данные — Api.sources.cub.metadataGet, только для
   фильма, :20160-20166). Прятать их ПРАВИЛОМ нельзя: скрытый display:none
   ряд остаётся в наборе Navigator — Controller.collectionSet отбирает по
   offsetParent только при третьем аргументе visible_only (:46453-46456), а
   карточка зовёт его одним (:39126). Ряды вообще не создаются
   (src/90_runtime.js, dropMetaData), и правила в таблице стилей быть не
   должно — ни при какой настройке. */
test('A6: чужие блоки анализа не прячутся таблицей стилей — их снимает рантайм', () => {
  for (const value of [null, 'false', 'true']) {
    const text = value === null ? css : withStorage({ lumen_hide_meta: value }, (LC) => LC.buildCss());
    assert.equal(ruleSelectors(text).filter((s) => s.indexOf('lumen-lampa-meta') !== -1).length, 0,
      'правило скрытия вернулось в таблицу (lumen_hide_meta=' + value + ') — скрытый ряд ловит фокус');
  }
});

/* A5 (волна A финального плана): описание настройки обещало сетке и хабу
   перемену наравне с карточкой и путём TorrServer, а плоский вид снимает там
   ровно три подложки — и все три лежат ПОД картинкой, то есть видны только
   пока постер или кадр не пришёл. Описание приведено к факту
   (src/80_settings.js, lumen_flat_descr), и этот сторож держит факт: вырастет
   набор — тест упадёт, и описание придётся переписать вместе с ним. */
test('A5: в сетке и хабе плоский вид снимает ровно три подложки — и ничего больше', () => {
  const key = (r) => r.selectors.join(',') + '{' + r.decl + '}';
  const base = ruleBodies(css).map(key);
  const added = ruleBodies(flatCss).filter((r) => base.indexOf(key(r)) === -1);
  const outer = added.filter((r) => r.selectors.some((sel) => sel.indexOf('.lumen-grid ') === 0 || sel.indexOf('.lumen-hub__tiles ') === 0));
  assert.deepEqual(outer.map(key).sort(), [
    '.lumen-grid .lumen-gcard .card__img{background-color:transparent}',
    '.lumen-grid .lumen-gcard .card__view{background-color:transparent}',
    '.lumen-hub__tiles .lumen-tile{background:none}'
  ], 'набор правил сетки и хаба изменился — описание настройки обязано измениться вместе с ним');
});




/* Постеры: кадрирование постера карточки.

   Кадрирует постер сама Lampa — общим правилом img{object-fit:cover}
   (vendor/lampa/css/app.css:239-243); своего правила у .card__img нет
   (app.css:3103-3113), object-position в app.css не встречается ни разу,
   то есть точка привязки браузерная (50% 50%) и лишнее срезается поровну
   сверху и снизу. Ячейка ровно 2:3 — .card__view{padding-bottom:150%}
   (app.css:3135-3139). Требование пользователя — «не обрезана голова,
   лучше туловище, но не голова», и выполняет его center top: сверху не
   срезается ничего, весь срез уходит вниз.

   Замер на живых данных TMDB (160 фильмов, восемь разнородных рядов):
   постер ВЫШЕ 2:3 встречается у штатных постеров ряда 4 раза из 159, и
   самый вытянутый из них 0.663 — срез 0.6 % высоты, 1 px на карточке
   179 px. Поэтому правило действует всегда, а не только в режимах подмены
   постера: в дефолте оно двигает картинку меньше чем на пиксель. */
test('Постеры: постер ряда и сетки прижат к верху ячейки, широкие карточки Lampa исключены', () => {
  for (const root of ['.lumen-main .card', '.lumen-grid .lumen-gcard']) {
    const sel = root + ':not(.card--wide):not(.card--collection) .card__img';
    assert.equal(decl(css, sel), 'object-position:center top',
      'нет правила привязки постера к верху: ' + sel);
  }
  /* Без :not() правило накрыло бы и широкую карточку Lampa
     (.card--wide .card__view{padding-bottom:56%}, app.css:3493-3498):
     там в ячейку 16:9 кладётся вертикальный постер, срез по высоте огромный,
     и «верх» у него не значит ничего. */
  for (const r of ruleBodies(css)) {
    if (r.decl.indexOf('object-position') === -1) continue;
    for (const sel of r.selectors) {
      if (sel.indexOf('.card__img') === -1) continue;
      assert.ok(sel.indexOf(':not(.card--wide)') !== -1 && sel.indexOf(':not(.card--collection)') !== -1,
        'правило привязки постера не исключает широкую карточку Lampa: ' + sel);
    }
  }
});

/* Точка привязки одна на оба экрана: разойдясь, главная и сетка начали бы
   резать постер по-разному, а человек видит их подряд. */
test('Постеры: у постера ряда и постера сетки одна и та же точка привязки', () => {
  const main = decl(css, '.lumen-main .card:not(.card--wide):not(.card--collection) .card__img');
  const grid = decl(css, '.lumen-grid .lumen-gcard:not(.card--wide):not(.card--collection) .card__img');
  assert.equal(main, grid);
});

/* Ревью фикс-раунда (п.9): решение пользователя «не обрезана голова, лучше
   туловище, но не голова» (9480e0e) касается КАЖДОГО постера 2:3, а не только
   рядов и сетки. Постер фоном — в барабане рулетки, в стопке под ним и в
   ряду частей франшизы — кадрировался по центру. Точка привязки у всех одна
   — POSTER_ANCHOR. */
test('ревью п.9: постеры фоном — барабан, стопка, ряд франшизы — прижаты к верху, как в рядах', () => {
  const anchor = /object-position:([^;]+)/.exec(decl(css, '.lumen-main .card:not(.card--wide):not(.card--collection) .card__img'))[1];
  assert.equal(anchor, 'center top');
  for (const sel of ['.lumen-roulette .lumen-roulette__frame', '.lumen-roulette .lumen-roulette__peek', '.lumen-descr-row .lumen-fr-card__poster']) {
    const body = findDecl(css, (s) => s === sel);
    assert.ok(body, 'правило ' + sel + ' не найдено');
    assert.equal(/(?:^|;)background-position:([^;]+)/.exec(body)[1], anchor, sel + ': постер кадрируется не по верху: ' + body);
  }
});

/* Правка 2026-09-23: логотип названия в карточке сжимается вместе с
   заголовком — его рамка задана в em узла, а кегль узла в каждой ветке тот
   же, что у заголовка (разбор — CARD_TITLE_EM в src/48_hero.js). Разойдутся
   кегли — логотип в сжатой шапке или на узком окне останется крупным. */
test('логотип карточки: кегль узла совпадает с кеглем заголовка во всех ветках', () => {
  const fs = (decl) => (/(?:^|;)font-size:([\d.]+)em/.exec(decl || '') || [])[1];
  const pairs = [
    ['.lumen-card .full-start-new__title', '.lumen-card .lumen-logo'],
    ['.lumen-card.lumen-compact .full-start-new__title', '.lumen-card.lumen-compact .lumen-logo'],
    ['.lumen-card.lumen-trailer-on .full-start-new__title', '.lumen-card.lumen-trailer-on .lumen-logo']
  ];
  for (const [t, l] of pairs) {
    const title = fs(findDecl(css, (s) => s === t));
    const logo = fs(findDecl(css, (s) => s === l));
    assert.ok(title, 'нет кегля у ' + t);
    assert.equal(logo, title, l + ': кегль ' + logo + ' против ' + title + ' у заголовка');
  }
  const hero = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  assert.equal(/var CARD_TITLE_EM = ([\d.]+);/.exec(hero)[1], fs(findDecl(css, (s) => s === '.lumen-card .full-start-new__title')),
    'копия кегля заголовка в src/48_hero.js разошлась с таблицей стилей');
  /* Узкое окно: правило внутри медиазапроса. */
  const narrow = css.split('\n').find((l) => l.indexOf('@media screen and (max-width:') === 0 && l.indexOf('.lumen-card .full-start-new__title{font-size:') !== -1);
  assert.ok(narrow, 'ветки узкого окна нет');
  const nt = /\.lumen-card \.full-start-new__title\{font-size:([\d.]+)em/.exec(narrow)[1];
  const nl = /\.lumen-card \.lumen-logo\{font-size:([\d.]+)em/.exec(narrow);
  assert.ok(nl, 'логотип не сжимается на узком окне');
  assert.equal(nl[1], nt);
  /* Пока исход неизвестен и когда логотип показан, заголовок скрыт; иначе
     узла логотипа не видно вовсе. */
  assert.ok(/display:none/.test(findDecl(css, (s) => s === '.lumen-card .lumen-logo')));
  assert.ok(/display:none/.test(findDecl(css, (s) => s === '.lumen-card.lumen-logo-wait .full-start-new__title')));
  assert.ok(/display:block/.test(findDecl(css, (s) => s === '.lumen-card.lumen-logo-on .lumen-logo')));
});

/* Волна 2 (ТВ 2026-09-24, C): второй экран карточки снова обычный —
   постраничность 5da8ae6 откатана. Пользователь: «оно нормально не листает,
   а будто открываются новые страницы — всё же было нормально» (фото 28:
   блок отзывов один на весь экран). Сторож: ряд описания не растягивается на
   остаток экрана, блоки отзывов и «Смотреть по порядку» ничем не скрыты,
   классов страниц в таблице нет. Прокрутка к блоку в фокусе — у bindDescr
   (src/85_header.js). */
test('C: второй экран карточки — без страниц: нет min-height у ряда, отзывы и франшиза видны', () => {
  for (const iface of ['small', 'normal', 'bigger']) {
    for (const flat of [false, true]) {
      const got = withStorage({ interface_size: iface, lumen_flat: flat }, (LC) => LC.buildCss());
      const label = iface + (flat ? '/плоский' : '');
      const rows = ruleBodies(got).filter((r) => r.selectors.some((s) => s === '.lumen-descr-row .full-descr'));
      rows.forEach((r) => assert.ok(!/min-height/.test(r.decl), label + ': ряд описания растянут на экран: ' + r.decl));
      const hidden = ruleBodies(got).filter((r) => /display:none/.test(r.decl) &&
        r.selectors.some((s) => /\.full-descr\s*>\s*(\.lumen-reviews|\.lumen-fr|\*)/.test(s)));
      assert.deepEqual(hidden.map((r) => r.selectors.join(',')), [], label + ': блоки второго экрана скрыты');
      assert.ok(!/lumen-descr-row--sub|lumen-descr-page--on/.test(got), label + ': в таблице остались классы страниц');
    }
  }
});

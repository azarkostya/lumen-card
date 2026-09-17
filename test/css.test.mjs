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
   lumen_font — собираем их с подменённым Storage тем же приёмом, что tokens. */
function withStorage(storage, fn) {
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
  assert.match(t.fontDisplay, /^"Unbounded"/);
  assert.match(t.fontBody, /^"Golos Text"/);
  assert.match(t.fontMono, /^"JetBrains Mono"/);

  const ice = tokensWith({ lumen_card_accent: 'ice', lumen_card_fonts: 'false' });
  assert.equal(ice.accent, '#7FB7C9');
  assert.equal(ice.onac, '#08171C');
  assert.equal(ice.ring, '#E9F7FB');
  assert.equal(ice.fontBody, 'inherit');
  assert.ok(ice.fontDisplay.indexOf('Unbounded') === -1);

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
   (герой, ряд отзывов, коллаж плитки хаба), без нашего DOM его не бывает, а
   правило нарочно одно на все три корня: пульсация должна быть одинаковой и
   гаситься в lite/off одним местом. */
/* Правка 2026-09-17 (второй круг): чипы настроения переехали из блока героя
   в собственный узел корня активности, поэтому у них появились свои корни —
   .lumen-moods (и признак раскладки .lumen-moods-on на том же корне) и
   .lumen-mood-chip. Оба класса создаёт плагин, чужой разметки под ними нет. */
const ALLOWED_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton', '.full-start__background', '.full-start-new', 'body'];

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
var OWN_NAMESPACE_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton'];

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
function ruleBodies(cssText) {
  const out = [];
  const lines = cssText.split('\n');
  for (const line of lines) {
    if (!line) continue;
    if (/^@-?(webkit-)?keyframes/.test(line)) continue;
    let body = line;
    if (/^@(media|supports)/.test(line)) {
      const firstBrace = line.indexOf('{');
      body = line.slice(firstBrace + 1);
    }
    const open = body.indexOf('{');
    const close = body.lastIndexOf('}');
    if (open === -1 || close <= open) continue;
    const selectors = body.slice(0, open).split(',').map((s) => s.trim()).filter(Boolean);
    out.push({ selectors, decl: body.slice(open + 1, close) });
  }
  return out;
}

/* Тело первого правила, у которого ХОТЯ БЫ ОДИН селектор (после разбивки
   запятой) проходит matchSelector — или null, если такого правила нет. */
/* Медиазапросов по отношению сторон теперь два: первый прячет описание
   героя, второй (со страховкой .lumen-hero{display:none}) отдаёт экран рядам
   целиком. Тесты ниже ищут именно второй. */
function heroOffMedia(cssText) {
  return cssText.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 &&
    l.indexOf('.lumen-hero{display:none}') !== -1);
}

function findDecl(cssText, matchSelector) {
  const rule = ruleBodies(cssText).find((r) => r.selectors.some(matchSelector));
  return rule ? rule.decl : null;
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

test('buildCss: .lumen-bg--blur — размытый постер (blur 1.75em = design 40px÷22.811) только в lumen-motion-full', () => {
  const decl = findDecl(css, (sel) => sel.indexOf('.lumen-backdrop') === 0 && sel.indexOf('lumen-motion-full') !== -1 && sel.indexOf('lumen-bg--blur') !== -1);
  assert.ok(decl, 'правило блюра для lumen-motion-full не найдено');
  assert.ok(decl.indexOf('blur(1.75em)') !== -1, 'ожидался filter:blur(1.75em) (дополнение к Task 5b: 40px÷22.811)');
});

test('buildCss: .lumen-bg--blur в lumen-motion-lite/off — без filter (дорого на ТВ, только затемнение)', () => {
  const declLite = findDecl(css, (sel) => sel.indexOf('lumen-motion-lite') !== -1 && sel.indexOf('lumen-bg--blur') !== -1);
  const declOff = findDecl(css, (sel) => sel.indexOf('lumen-motion-off') !== -1 && sel.indexOf('lumen-bg--blur') !== -1);
  assert.ok(declLite, 'правило lumen-motion-lite для .lumen-bg--blur не найдено');
  assert.ok(declOff, 'правило lumen-motion-off для .lumen-bg--blur не найдено');
  assert.equal(declLite.indexOf('filter'), -1, 'lite не должен переопределять/задавать filter (блюр остаётся только в lumen-motion-full)');
  assert.equal(declOff.indexOf('filter'), -1, 'off не должен переопределять/задавать filter (блюр остаётся только в lumen-motion-full)');
});

/* -------------------------------------------------------------------- */
/* Task 6: слайдшоу кадров — .lumen-bg__img/.is-active (кроссфейд) и      */
/* наезд Ken Burns (Task 4) поверх них, теперь на верном корне            */
/* .lumen-backdrop (слой фона — сосед .lumen-card, не потомок).           */
/* -------------------------------------------------------------------- */

test('buildCss: .lumen-bg__img — базовое правило внутри .lumen-backdrop, кроссфейд opacity 1.2s ease-in-out, без inset', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-backdrop .lumen-bg__img');
  assert.ok(decl, 'правило .lumen-backdrop .lumen-bg__img не найдено');
  assert.ok(/opacity\s*:\s*0\b/.test(decl), 'кадр должен быть по умолчанию прозрачным');
  assert.ok(decl.indexOf('transition:opacity 1.2s ease-in-out') !== -1, 'ожидался transition:opacity 1.2s ease-in-out (design screen 12)');
  assert.equal(/inset\s*:/.test(decl), false);
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
  assert.ok(chip.indexOf('font-size:.79em') !== -1, 'текст чипа 18px = .79em');
  const icon = findDecl(css, (sel) => sel === '.lumen-card .lumen-next-chip:before');
  assert.ok(icon && icon.indexOf('mask-image') !== -1, 'иконка часов — маской');
});

test('buildCss: у сериала статус — карта в ленте рейтингов', () => {
  const status = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status');
  assert.ok(status, 'правило статуса в ленте для .lumen-card--serial не найдено');
  assert.ok(status.indexOf('border-radius:.67em') !== -1, 'радиус карты 12px, не пилюля');
  assert.ok(status.indexOf('display:flex') !== -1, 'у сериала статус виден');
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
  assert.ok(chip.indexOf('margin:0 .35em .35em 0') !== -1, 'зазор чипа — справа, а не слева');
});

test('buildCss: карточка серии 340×150 (14.9em×6.58em), flex без grid, дорожка absolute', () => {
  const card = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  assert.ok(card, 'правило .lumen-episode не найдено');
  assert.ok(card.indexOf('width:14.9em') !== -1 && card.indexOf('height:6.58em') !== -1);
  assert.ok(card.indexOf('display:flex') !== -1);
  const track = findDecl(css, (sel) => sel === '.lumen-card .lumen-episodes__track');
  assert.ok(track && track.indexOf('position:absolute') !== -1, 'дорожка должна быть absolute (не раздувает колонку)');
  const rules = ruleBodies(css).filter((r) => r.selectors.some((s) => s.indexOf('lumen-episode') !== -1));
  assert.ok(rules.length > 10);
  assert.equal(rules.filter((r) => /display\s*:\s*(-ms-)?grid/.test(r.decl)).length, 0, 'у ряда серий нет grid');
});

test('buildCss: все четыре состояния серии и фокус со scale 1.03 оформлены', () => {
  for (const state of ['watched', 'watching', 'soon']) {
    assert.ok(findDecl(css, (sel) => sel === '.lumen-card .lumen-episode--' + state), 'нет правила состояния ' + state);
  }
  const focus = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode.focus');
  assert.ok(focus && focus.indexOf('scale(1.03)') !== -1);
  // ревью п.10: рамка .04 -> .13em, паддинг .79 -> .70em — сумма .83em сохранена, содержимое не сдвигается
  const base = findDecl(css, (sel) => sel === '.lumen-card .lumen-episode');
  assert.ok(base.indexOf('padding:.79em') !== -1 && base.indexOf('border:.04em') !== -1);
  assert.ok(focus.indexOf('padding:.70em') !== -1 && focus.indexOf('border:.13em') !== -1);
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

test('правка 2026-09-16: заголовок «ПОДРОБНО» — mono, letter-spacing .14em, muted, не мельче 18px', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts__title');
  assert.ok(title, 'правило заголовка таблицы не найдено');
  assert.ok(parseFloat(/font-size:([\d.]+)em/.exec(title)[1]) >= 0.79, 'заголовок не мельче 18px = .79em');
  assert.ok(title.indexOf('letter-spacing:.14em') !== -1);
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
  assert.ok(text.indexOf('border-radius:.58em') !== -1, 'радиус как у таблицы «ПОДРОБНО»');
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
  assert.ok(card && card.indexOf('padding:0 2.81em 2.81em') !== -1, 'safe area шапки — 64px = 2.81em');
  const descr = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr');
  assert.ok(descr, 'правило .full-descr не найдено');
  assert.ok(descr.indexOf('padding-left:2.81em') !== -1, 'левый край ряда не совпадает с шапкой');
  assert.ok(descr.indexOf('padding-right:2.81em') !== -1, 'правый край ряда не совпадает с шапкой');
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
test('ревью п.2: подписи блока отзывов не smoke; счётчик отзывов не мельче 20px', () => {
  const total = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__total');
  assert.ok(total, 'правило .lumen-reviews__total не найдено');
  assert.ok(total.indexOf('#7A6A5A') === -1, 'счётчик отзывов больше не smoke');
  assert.ok(total.indexOf('#A89A8A') !== -1, 'счётчик отзывов — muted');
  assert.ok(parseFloat(/font-size:([\d.]+)em/.exec(total)[1]) >= 0.877, 'счётчик отзывов не мельче 20px');

  const ico = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__ico');
  assert.ok(ico.indexOf('background-color:#A89A8A') !== -1, 'иконка ряда отзывов — muted');

  /* Мета отзыва и модала лежат на своих непрозрачных фонах: там поднят только
     цвет, кегль оставлен (карточка фиксированной высоты 11.4em, экран 07). */
  for (const sel of ['.lumen-descr-row .lumen-review__meta', '.lumen-review-modal__meta', '.lumen-review-modal__src']) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf('#7A6A5A') === -1, sel + ' — больше не smoke');
    assert.ok(decl.indexOf('#A89A8A') !== -1, sel + ' — muted');
  }
});

test('buildCss: полное описание в ряду — 24px/1.45 (1.05em), колонка 980px (42.96em), таблица справа', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(text, 'правило .full-descr__text не найдено');
  assert.ok(text.indexOf('font-size:1.05em') !== -1, 'описание 24px = 1.05em');
  assert.ok(text.indexOf('line-height:1.45') !== -1);
  assert.ok(text.indexOf('max-width:42.96em') !== -1, 'колонка описания 980px = 42.96em');

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
test('buildCss: с рядом отзывов описание клампится восемью строками и получает мягкую маску низа', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row.lumen-descr-row--reviews .full-descr__text');
  assert.ok(decl, 'правило обрезки описания при отзывах не найдено');
  assert.ok(decl.indexOf('-webkit-line-clamp:8') !== -1, 'ожидался кламп на 8 строк');
  assert.ok(decl.indexOf('display:-webkit-box') !== -1 && decl.indexOf('-webkit-box-orient:vertical') !== -1, 'без этих двух свойств кламп не работает');
  assert.ok(/max-height\s*:\s*70vh/.test(decl), 'страховка для движков без клампа');
  assert.ok(/mask-image\s*:\s*linear-gradient/.test(decl), 'мягкий низ вместо резаной строки');
  assert.ok(decl.indexOf('-webkit-mask-image') !== -1, 'нужна и префиксная запись — на движках ТВ работает она');

  const base = findDecl(css, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(/max-height\s*:\s*70vh/.test(base), 'базовый предел Task 5d не тронут');
  assert.ok(base.indexOf('-webkit-mask-image:none') !== -1, 'без отзывов описание по-прежнему не выцветает');
});

test('buildCss: карточка отзыва 480×260 (21.04em×11.4em), flex, не сжимается', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review');
  assert.ok(decl, 'правило .lumen-review не найдено');
  assert.ok(decl.indexOf('width:21.04em') !== -1, 'ширина 480px = 21.04em');
  assert.ok(decl.indexOf('height:11.4em') !== -1, 'высота 260px = 11.4em');
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

test('buildCss: текст отзыва — ровно 4 строки клампом, 19px (.83em) muted', () => {
  const decl = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-review__text');
  assert.ok(decl, 'правило текста отзыва не найдено');
  assert.ok(decl.indexOf('-webkit-line-clamp:4') !== -1, 'экран 07: четыре строки');
  assert.ok(decl.indexOf('display:-webkit-box') !== -1 && decl.indexOf('-webkit-box-orient:vertical') !== -1, 'кламп без этих двух свойств не работает');
  assert.ok(decl.indexOf('font-size:.83em') !== -1, 'текст 19px = .83em');
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

test('buildCss: заголовок ряда — название 32px (1.40em) Unbounded, «КИНОПОИСК» акцентом mono .70em', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__title');
  assert.ok(title && title.indexOf('font-size:1.40em') !== -1, 'название 32px = 1.40em');
  const src = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-reviews__src');
  assert.ok(src, 'правило метки источника не найдено');
  assert.ok(src.indexOf('font-size:.70em') !== -1 && src.indexOf('letter-spacing:.16em') !== -1);
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
  assert.ok(path.indexOf('font-size:.79em') !== -1, 'текст 18px = .79em');
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
  assert.ok(text.indexOf('font-size:.96em') !== -1, 'текст 22px = .96em');
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

  const decl = findDecl(css, (sel) => sel.indexOf('.lumen-backdrop') === 0 && sel.indexOf('lumen-motion-full') !== -1 && sel.indexOf('lumen-bg__img') !== -1 && sel.indexOf('is-active') !== -1);
  assert.ok(decl, 'правило наезда (.lumen-backdrop.lumen-motion-full .lumen-bg__img.is-active) не найдено');
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
  assert.ok(badge.indexOf('right:2.81em') !== -1, 'right 64px = 2.81em (safe area экрана 02)');
  assert.ok(badge.indexOf('top:4.91em') !== -1, 'top 112px = 4.91em');

  const on = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .lumen-trailer-badge');
  assert.ok(on && on.indexOf('display:flex') !== -1);
  const ico = findDecl(css, (sel) => sel === '.lumen-card .lumen-trailer-badge:before');
  assert.ok(ico && ico.indexOf('mask-image') !== -1, 'иконка «без звука» — маской');
});

test('buildCss: режим трейлера сжимает шапку — заголовок 42px, описание/рейтинги/колонка/серии убраны', () => {
  const title = findDecl(css, (sel) => sel === '.lumen-card.lumen-trailer-on .full-start-new__title');
  assert.ok(title && title.indexOf('font-size:1.84em') !== -1, 'заголовок экрана 02: 42px ÷ 22.811 = 1.84em');
  assert.ok(title.indexOf('opacity:.92') !== -1, 'на экране 02 заголовок слегка приглушён (opacity .92)');

  const hidden = ruleBodies(css).find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-trailer-on .lumen-descr'));
  assert.ok(hidden, 'правило скрытия блоков в режиме трейлера не найдено');
  assert.ok(/display\s*:\s*none\s*!important/.test(hidden.decl));
  for (const sel of ['.lumen-card.lumen-trailer-on .full-start-new__rate-line',
    '.lumen-card.lumen-trailer-on .lumen-episodes']) {
    assert.ok(hidden.selectors.indexOf(sel) !== -1, 'в режиме трейлера должен скрываться ' + sel);
  }
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

test('buildCss: подпись и таймкод — 18px (.79em) muted, пустой узел убран :empty', () => {
  const label = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__label');
  const time = findDecl(css, (sel) => sel === '.lumen-card .lumen-progress__time');
  assert.ok(label && time, 'правила подписи/таймкода не найдены');
  for (const decl of [label, time]) {
    assert.ok(decl.indexOf('font-size:.79em') !== -1, '§6: 18px = .79em');
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

  const hidden = ruleBodies(css).find((r) => r.selectors.some((s) => s === '.lumen-card.lumen-trailer-on .lumen-descr'));
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

  const chip = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-next-chip');
  assert.ok(chip && chip.indexOf('border-left:0') !== -1 && chip.indexOf('border-top-left-radius:0') !== -1);
  const status = findDecl(css, (sel) => sel.indexOf('.lumen-card--nextchip') !== -1 && sel.indexOf('.full-start__status') !== -1);
  assert.ok(status, 'край статуса срезается только когда чип виден (класс .lumen-card--nextchip)');
  assert.ok(/margin-right\s*:\s*0\s*!important/.test(status), 'зазор .53em между картами Lampa ставит !important-ом');
  assert.ok(status.indexOf('border-right:0') !== -1);
});

/* -------------------------------------------------------------------- */
/* Ревью фазы 1 (I1): backdrop-filter — самый дорогой эффект карточки.    */
/*                                                                       */
/* Режимы «Лёгкие»/«Выкл» гасили только transition/transform/animation, а */
/* блюр подложки под каждой из 5-7 КНОПОК оставался — и пересобирался     */
/* композитором ПОКАДРОВО, потому что фон под ним живой (кроссфейд 1.2 с, */
/* Ken Burns, играющий iframe трейлера). Для кнопок это ровно те ТВ, куда */
/* «Авто» само ставит lite (Tizen/webOS, LC.motionModeFor).               */
/*                                                                       */
/* Проверка идёт от САМОГО CSS, а не от списка известных селекторов:      */
/* любое новое правило карточки с backdrop-filter:blur обязано завести    */
/* себе пару под lumen-motion-lite и lumen-motion-off, иначе тест упадёт. */
/* Но снять блюр — мало. У кнопок заливка действительно плотная (C.buttonBg */
/* .82, да ещё поверх нижней вуали .98 -> .60). А «Стоп» (.5) и метка       */
/* (.62) ПОЛУПРОЗРАЧНЫ и показываются ТОЛЬКО при lumen-trailer-on, то есть  */
/* всегда поверх живого кадра YouTube, где вуали слоя вдобавок приглушены   */
/* до opacity .45 (.lumen-backdrop.lumen-trailer-live). На светлой сцене    */
/* ролика белый текст на такой подложке теряется: замеренный контраст       */
/* #F3EDE4 к подложке поверх белого кадра — 3.1:1 у «Стоп» и 4.8:1 у метки, */
/* против целевых 7:1 проекта. Поэтому правило, снявшее блюр с прозрачной   */
/* подложки, ОБЯЗАНО компенсировать это плотной заливкой.                   */
/*                                                                         */
/* Адресат у компенсации не тот же, что у гашения блюра на кнопках: на      */
/* Tizen/webOS «Авто» даёт трейлеру 'off' (LC.trailer.modeFor), то есть     */
/* «Стоп» и метки там не бывает вовсе. Эти два узла страдают в другой       */
/* комбинации — трейлер включён ВРУЧНУЮ, а анимации стоят «Лёгкие»/«Выкл».  */
/*                                                                         */
/* Проверка идёт от самого CSS и по ВСЕМ нашим корням (Minor 7): блюр на    */
/* слое фона или под body-корнем тест не должен молча пропустить.           */
/* -------------------------------------------------------------------- */

/* Один источник с проверкой скоупа выше: списки не должны разъезжаться —
   иначе blur-правило под корнем, который есть в ALLOWED_ROOTS, но забыт
   здесь (так было с .full-start-new и .full-start__background), тест молча
   пропустит. */
function rootOf(sel) {
  for (const root of ALLOWED_ROOTS) if (startsWithRoot(sel, root)) return root;
  return null;
}

function blurRules(cssText) {
  const out = [];
  for (const rule of ruleBodies(cssText)) {
    if (rule.decl.indexOf('backdrop-filter:blur(') === -1) continue;
    for (const sel of rule.selectors) {
      const root = rootOf(sel);
      if (root) out.push({ sel, root, decl: rule.decl });
    }
  }
  return out;
}

/* Альфа собственной заливки правила: background:rgba(r,g,b,a) -> a. */
function fillAlpha(decl) {
  const m = /(?:^|;)background:rgba\([^)]*?,\s*([\d.]+)\s*\)/.exec(decl);
  return m ? parseFloat(m[1]) : null;
}

test('I1: blur гасится в lumen-motion-lite/off, а полупрозрачная подложка при этом уплотняется', () => {
  const blurred = blurRules(css);
  /* Кнопки карточки, кнопка «Стоп» и метка «ТРЕЙЛЕР · БЕЗ ЗВУКА». */
  assert.ok(blurred.length >= 3, 'ожидались правила блюра кнопок/«Стоп»/метки, найдено: ' + blurred.length);

  for (const { sel, root, decl } of blurred) {
    const base = fillAlpha(decl);
    for (const mode of ['lite', 'off']) {
      /* Гасящий селектор — тот же самый плюс класс режима на корне:
         специфичность строго выше исходного правила, поэтому порядок
         объявления в файле роли не играет и !important не нужен. */
      const want = root + '.lumen-motion-' + mode + sel.slice(root.length);
      const quench = findDecl(css, (s) => s === want);
      assert.ok(quench, 'нет правила, гасящего блюр: ' + want);
      assert.ok(/(^|;)backdrop-filter:none/.test(quench), want + ' обязан задавать backdrop-filter:none, а не «' + quench + '»');
      assert.ok(quench.indexOf('-webkit-backdrop-filter:none') !== -1,
        want + ': нужен и -webkit-префикс — на WebView ТВ работает именно он');

      /* Компенсация — только там, где подложка сама по себе прозрачная.
         Кнопкам (.82 плюс вуаль) она не нужна и только утяжелила бы вид. */
      if (base !== null && base < 0.8) {
        const dense = fillAlpha(quench);
        assert.ok(dense !== null,
          want + ': исходная заливка ' + base + ' — сняв блюр, правило обязано задать свою, иначе текст поплывёт на светлом кадре');
        assert.ok(dense >= 0.88,
          want + ': заливка ' + dense + ' слишком прозрачна для белого текста поверх светлого кадра (нужно >= .88)');
      }
    }
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
test('I1: акцент фокуса «Стоп» держится специфичностью, а не порядком правил', () => {
  assert.equal(classWeight('.lumen-card.lumen-motion-lite .lumen-stop.focus'), 4, 'счётчик весов сам по себе исправен');

  for (const mode of ['lite', 'off']) {
    const denseSel = '.lumen-card.lumen-motion-' + mode + ' .lumen-stop';
    const focusSel = denseSel + '.focus';
    const dense = findDecl(css, (s) => s === denseSel);
    const focus = findDecl(css, (s) => s === focusSel);

    assert.ok(dense, mode + ': правило уплотнения не найдено');
    assert.ok(focus, mode + ': правило фокуса «Стоп» не найдено');
    assert.ok(/(^|;)background:/.test(focus), mode + ': фокус обязан объявлять свою заливку: ' + focus);
    assert.ok(classWeight(focusSel) > classWeight(denseSel),
      mode + ': вес фокуса (' + classWeight(focusSel) + ') обязан быть больше веса уплотнения (' + classWeight(denseSel) + ')');
    assert.equal(/background:[^;]*!important/.test(dense), false,
      mode + ': уплотнение с !important перебило бы акцент фокуса независимо от весов');
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

test('Task 17: фокус кнопки «Франшиза» — акцент; в lite/off пружины нет', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-card .lumen-franchise.focus');
  assert.ok(focus, 'правило фокуса не найдено');
  assert.ok(focus.indexOf('transform:scale(1.06)') !== -1);
  const lite = findDecl(css, (sel) => sel === '.lumen-card.lumen-motion-lite .lumen-franchise.focus');
  assert.ok(lite, 'правило lite не найдено');
  assert.ok(/transform:none !important/.test(lite), 'нативная анимация Lampa перебивается только !important');
  assert.ok(/(^|;)background:/.test(lite), 'lite обязан вернуть акцентную заливку (как у «Стоп»)');
});

test('Task 17: хаб — safe area 2.81em с обеих сторон, плитки по 4 в ряд', () => {
  const root = findDecl(css, (sel) => sel === '.lumen-hub');
  assert.ok(root, 'корень хаба не найден');
  assert.ok(/padding:2\.81em 2\.81em/.test(root), 'safe area 64px ÷ 22.811 = 2.81em: ' + root);
  const tile = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile');
  assert.ok(tile, 'правило плитки не найдено');
  assert.ok(tile.indexOf('width:calc((100% - 2.64em) / 4)') !== -1, 'ширина = (100% − 3×.88em) / 4: ' + tile);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile:nth-child(4n)'), 'у последней плитки ряда нет правого отступа');
  const ratio = findDecl(css, (sel) => sel === '.lumen-hub__tiles .lumen-tile:before');
  assert.ok(ratio && ratio.indexOf('padding-top:56.25%') !== -1, 'пропорция 16:9 распоркой, без aspect-ratio');
});

test('Task 17: сетка — ровно 6 карточек в ряд на штатной карточке Lampa', () => {
  const grid = findDecl(css, (sel) => sel === '.lumen-grid');
  assert.ok(grid && /padding:2\.81em 2\.81em/.test(grid), 'safe area с обеих сторон');
  const card = findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard');
  assert.ok(card, 'правило карточки сетки не найдено');
  assert.ok(card.indexOf('width:calc((100% - 4.4em) / 6)') !== -1, 'ширина = (100% − 5×.88em) / 6: ' + card);
  assert.ok(findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard:nth-child(6n)'), 'у шестой карточки ряда нет правого отступа');
  /* Пропорцию 2:3 и позиционирование даёт штатный .card__view Lampa —
     свой распорки больше нет; наши правила только перекрашивают. */
  const view = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard .card__view');
  assert.ok(view && view.indexOf('border-radius:.31em') !== -1, 'радиус постера по design-spec §0.4');
});

test('Task 17: фокус карточки сетки поднимается над соседями и красит кольцо акцентом', () => {
  const focus = findDecl(css, (sel) => sel === '.lumen-grid__items .lumen-gcard.focus');
  assert.ok(focus, 'правило фокуса карточки не найдено');
  assert.ok(focus.indexOf('transform:scale(1.08)') !== -1);
  assert.ok(/z-index:\d/.test(focus), 'без z-index увеличенная карточка ныряет под соседнюю: ' + focus);
  const ring = findDecl(css, (sel) => sel === '.lumen-grid .lumen-gcard.focus .card__view:after');
  assert.ok(ring, 'кольцо фокуса не перекрашено — осталось бы белым штатным');
  assert.ok(ring.indexOf('box-shadow') !== -1);
});

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

test('Task 17: чип — один паттерн на хаб и сетку, выбранный виден без фокуса', () => {
  const chip = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip');
  assert.ok(chip, 'правило чипа не найдено');
  assert.ok(chip.indexOf('height:2.46em') !== -1, 'высота 56px ÷ 22.811');
  assert.ok(chip.indexOf('border-radius:.53em') !== -1, 'радиус 12px ÷ 22.811');
  const on = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip.lumen-chip--on');
  assert.ok(on, 'правило выбранного чипа не найдено');
  const focus = findDecl(css, (sel) => sel === '.lumen-hub .lumen-chip.focus');
  assert.ok(focus && focus.indexOf('transform:scale(1.06)') !== -1, 'фокус чипа — семейство «чип/плитка», scale 1.06');
});

test('Task 17: на слабых ТВ пружины фокуса в хабе и сетке нет', () => {
  for (const mode of ['lite', 'off']) {
    assert.ok(findDecl(css, (sel) => sel === '.lumen-hub.lumen-motion-' + mode + ' .lumen-tile.focus'), 'нет правила плиток для ' + mode);
    assert.ok(findDecl(css, (sel) => sel === '.lumen-grid.lumen-motion-' + mode + ' .lumen-gcard.focus'), 'нет правила карточек для ' + mode);
  }
});

/* ====================================================================== */
/* Правка 2026-09-16, п.6: настройка «Шрифт».                             */
/*                                                                        */
/* Пять пар «текстовая гарнитура + моноширинная к ней», все с Google Fonts */
/* (CSP плагина другого источника не пропустит). Заголовочная Unbounded    */
/* общая для всех пар — это фирменный знак карточки, а меняется именно то, */
/* что читают: текст и цифры.                                             */
/* ====================================================================== */

const FONT_PAIRS = {
  golos: ['Golos Text', 'JetBrains Mono'],
  onest: ['Onest', 'JetBrains Mono'],
  manrope: ['Manrope', 'JetBrains Mono'],
  inter: ['Inter', 'JetBrains Mono'],
  plex: ['IBM Plex Sans', 'IBM Plex Mono']
};

test('правка 2026-09-16 (п.6): каждая пара доезжает до LC.tokens', () => {
  for (const key of Object.keys(FONT_PAIRS)) {
    const t = withStorage({ lumen_font: key }, (LC) => LC.tokens());
    assert.ok(t.fontBody.indexOf('"' + FONT_PAIRS[key][0] + '"') === 0, key + ': текстовая гарнитура первой в стеке, было ' + t.fontBody);
    assert.ok(t.fontMono.indexOf('"' + FONT_PAIRS[key][1] + '"') === 0, key + ': моноширинная гарнитура пары, было ' + t.fontMono);
    assert.ok(t.fontDisplay.indexOf('"Unbounded"') === 0, key + ': заголовочная гарнитура общая для всех пар');
    assert.ok(/sans-serif$/.test(t.fontBody), key + ': у стека обязан быть системный фолбэк');
    assert.ok(/monospace$/.test(t.fontMono), key + ': у моно-стека обязан быть системный фолбэк');
  }
});

test('правка 2026-09-16 (п.6): незнакомое значение — как Golos Text; при выключенных шрифтах настройка не действует', () => {
  const junk = withStorage({ lumen_font: 'nope' }, (LC) => LC.tokens());
  assert.equal(junk.fontBody, withStorage({}, (LC) => LC.tokens()).fontBody);

  const off = withStorage({ lumen_font: 'inter', lumen_card_fonts: 'false' }, (LC) => LC.tokens());
  assert.equal(off.fontBody, 'inherit', 'шрифты выключены — системный стек, выбор гарнитуры не действует');
  assert.equal(off.fontMono.indexOf('Inter'), -1);
});

test('правка 2026-09-16 (п.6): адрес <link> собирается под выбранную пару и только с Google Fonts', () => {
  for (const key of Object.keys(FONT_PAIRS)) {
    const url = withStorage({ lumen_font: key }, (LC) => LC.fontsUrl());
    assert.ok(url.indexOf('https://fonts.googleapis.com/css2?') === 0, key + ': единственный разрешённый CSP источник, было ' + url);
    assert.ok(url.indexOf('family=Unbounded:') !== -1, key + ': заголовочная гарнитура всегда в наборе');
    assert.ok(url.indexOf('family=' + FONT_PAIRS[key][0].replace(/ /g, '+') + ':') !== -1, key + ': нет текстовой гарнитуры');
    assert.ok(url.indexOf('family=' + FONT_PAIRS[key][1].replace(/ /g, '+') + ':') !== -1, key + ': нет моноширинной гарнитуры');
    assert.ok(url.indexOf('display=swap') !== -1, key + ': нет display=swap');
    /* Чужие гарнитуры не грузятся — иначе каждая смена тянула бы все пять. */
    for (const other of Object.keys(FONT_PAIRS)) {
      if (FONT_PAIRS[other][0] === FONT_PAIRS[key][0] || FONT_PAIRS[other][0] === FONT_PAIRS[key][1]) continue;
      assert.equal(url.indexOf('family=' + FONT_PAIRS[other][0].replace(/ /g, '+') + ':'), -1,
        key + ': в наборе оказалась лишняя гарнитура ' + FONT_PAIRS[other][0]);
    }
  }
});

test('правка 2026-09-16 (п.6): выбранная гарнитура попадает в текст стилей карточки', () => {
  const inter = withStorage({ lumen_font: 'inter' }, (LC) => LC.buildCss());
  const descr = findDecl(inter, (sel) => sel === '.lumen-descr-row .full-descr__text');
  assert.ok(descr.indexOf('"Inter"') !== -1, 'описание рисуется выбранной гарнитурой');
  assert.equal(inter.indexOf('Golos Text'), -1, 'прежняя гарнитура не должна оставаться в стилях');
});

/* «Моноширинный даёт ощущение консоли» — поэтому он остаётся только там, где
   выравниваются цифры (таймкоды, проценты, счётчики), а метки и мета-строка
   переведены на основную гарнитуру. */
test('правка 2026-09-16 (п.6): моно ушёл из мета-строки и меток, но остался на цифрах', () => {
  const MONO = '"JetBrains Mono"';
  const body = [
    '.lumen-card .lumen-meta',
    '.lumen-card .lumen-quality-chip',
    '.lumen-card .lumen-trailer-badge',
    '.lumen-descr-row .lumen-facts__title',
    '.lumen-descr-row .lumen-reviews__src'
  ];
  for (const sel of body) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.equal(decl.indexOf(MONO), -1, sel + ' — не место моноширинному');
    assert.ok(decl.indexOf('"Golos Text"') !== -1, sel + ' — основная гарнитура');
  }

  const digits = [
    '.lumen-card .full-start__rate',
    '.lumen-card .lumen-progress',
    '.lumen-card .lumen-episode__timecode',
    '.lumen-descr-row .lumen-reviews__total'
  ];
  for (const sel of digits) {
    const decl = findDecl(css, (s) => s === sel);
    assert.ok(decl, 'правило не найдено: ' + sel);
    assert.ok(decl.indexOf(MONO) !== -1, sel + ' — цифры обязаны выравниваться');
  }
});

/* -------------------------------------------------------------------- */
/* Task 18: герой главной (design-spec-main §0.2, экраны 15–19).          */
/* -------------------------------------------------------------------- */

test('Task 18: герой — весь экран до первого ряда, сжатый .72 от него', () => {
  const hero = findDecl(css, (sel) => sel === '.lumen-hero');
  assert.ok(hero, 'корень героя не найден');
  /* Фаза 3 (находка пользователя на невысоком окне): высота героя — не доля
     экрана, а «весь экран минус ряд». Отдельные 58vh при низком окне
     накрывали первый ряд, и от карточек оставались одни подписи. */
  /* Правка пользователя 2026-09-17 (второй круг): по умолчанию снова
     КРУПНЫЙ размер — ровно один блок ряда (20.6em), плюс HERO_AIR (2.4em)
     воздуха над заголовком первого ряда: 20.6 + 2.4 = 23em. Ряды при этом
     не сдвинулись — воздух вычтен из кадра. */
  assert.ok(hero.indexOf('height:calc(100vh - 23em)') !== -1, 'кадр кончается на воздух выше ряда: ' + hero);
  assert.ok(hero.indexOf('height:-webkit-calc(100vh - 23em)') !== -1, 'старым webkit-движкам нужен префиксный calc');
  assert.ok(hero.indexOf('position:absolute') !== -1, 'герой не участвует в потоке рядов');
  assert.ok(hero.indexOf('top:-4em') !== -1, 'кадр доходит до верхней кромки под шапкой Lampa (4em)');
  assert.ok(hero.indexOf('pointer-events:none') !== -1, 'герой не перехватывает указатель — он не фокусируется');
  assert.equal(/inset\s*:/.test(hero), false, 'inset запрещён планом');

  /* Сжатый — та же доля 42/58 = .72 от полной высоты, а не фиксированные
     42vh: на низком окне они оказались бы БОЛЬШЕ полной высоты. */
  const compact = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact');
  assert.ok(compact && compact.indexOf('height:calc(72vh - 17.23em)') !== -1, 'фокус ниже первого ряда — .72 от полной плюс тот же воздух: ' + compact);
});

/* Правка пользователя 2026-09-17 (второй круг, главное): «когда начинаем
   листать список фильмов, ряды должны быть подняты». Сжатие кадра и подъём
   рядов — одно движение: класс .lumen-rows-up ставит LC.hero там же, где
   .lumen-hero--compact. */
test('правка: сжатый герой отдаёт высоту рядам — пустой зоны под кадром нет', () => {
  const up = findDecl(css, (sel) => sel === '.lumen-main.lumen-rows-up .scroll.layer--wheight');
  assert.ok(up, 'правила поднятых рядов нет');
  /* Область = отступ Lampa над фокусным рядом (2.5em) + сжатая высота ряда
     (14.83em) + освободившиеся 28vh; отступ сверху = 100vh − 4em − область. */
  assert.ok(up.indexOf('height:calc(28vh + 17.33em) !important') !== -1, 'область не выросла на высоту, отданную кадром: ' + up);
  assert.ok(up.indexOf('height:-webkit-calc(28vh + 17.33em) !important') !== -1, 'старым webkit-движкам нужен префиксный calc');
  assert.ok(up.indexOf('margin-top:calc(72vh - 21.33em)') !== -1, 'ряды не поднялись: ' + up);
  assert.ok(up.indexOf('margin-top:-webkit-calc(72vh - 21.33em)') !== -1, 'старым webkit-движкам нужен префиксный calc');

  /* Переход плавный только в full: класс режима стоит на герое, а он —
     сосед .activity__body, отсюда соседний комбинатор. Кривая и время те же,
     что у высоты кадра, иначе в середине перехода появилась бы щель. */
  const move = findDecl(css, (sel) => sel === '.lumen-main .lumen-hero.lumen-motion-full ~ .activity__body .scroll.layer--wheight');
  assert.ok(move, 'перехода области рядов нет');
  assert.ok(move.indexOf('transition:margin-top .42s cubic-bezier(.2,.8,.2,1),height .42s cubic-bezier(.2,.8,.2,1)') !== -1, 'кривая и время не совпадают с высотой кадра: ' + move);
  const heroMotion = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full');
  assert.ok(heroMotion.indexOf('height .42s cubic-bezier(.2,.8,.2,1)') !== -1, 'высота кадра анимируется иначе: ' + heroMotion);
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-rows-up') !== -1 && sel.indexOf('motion') !== -1).length, 0,
    'в lite/off подъём обязан быть мгновенным — своего перехода у правила нет');

  /* На низком окне герой скрыт вовсе, и поднимать нечего: правило подъёма
     обязано быть перебито там же, где обычное (иначе оно выиграло бы по
     специфичности — три класса против двух). */
  const low = heroOffMedia(css);
  assert.ok(low.indexOf('.lumen-main.lumen-rows-up .scroll.layer--wheight{margin-top:0') !== -1, 'подъём не отменён на низком окне: ' + low);
});

/* Правка пользователя 2026-09-17 (второй круг, п.1): «а может текст вниз
   спустить, чтобы не перекрывало картинку?» */
test('правка: текст героя прижат к низу кадра и стоит по safe area', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__text');
  assert.ok(text.indexOf('-webkit-box-pack:end') !== -1, 'содержимое не прижато к нижней кромке: ' + text);
  assert.ok(text.indexOf('overflow:hidden') !== -1, 'блок обязан срезать лишнее сам: ' + text);
  /* Кегль содержимого: +10 % в верхнем состоянии, +4 % в сжатом (просьба
     пользователя «больше текст на 10 % (попробуем)»). Собственные отступы
     блока при этом делятся на его же кегль — em у left/top/bottom считается
     от font-size самого элемента, и без деления текст уехал бы вправо от
     safe area (замер живьём: 71 px вместо 64 px). Проверяем произведение:
     оно обязано давать те же 2.81em / 4.4em / 1.6em базового кегля в ОБОИХ
     состояниях, иначе блок дёргался бы вбок на переходе. */
  const box = (decl) => {
    const num = (name) => parseFloat(new RegExp(name + ':([0-9.]+)em').exec(decl)[1]);
    const zoom = num('font-size');
    return { left: Math.round(num('left') * zoom * 100) / 100, top: Math.round(num('top') * zoom * 100) / 100, bottom: Math.round(num('bottom') * zoom * 100) / 100, zoom: zoom };
  };
  const full = box(text);
  assert.equal(full.zoom, 1.1, 'кегль текста героя не поднят: ' + text);
  assert.ok(Math.abs(full.left - 2.81) < 0.02, 'safe area слева (§0.1): ' + full.left);
  /* Сверху — безопасная зона под шапкой Lampa: без неё высокое содержимое
     налезало на заголовок активности и иконки (находка пользователя). */
  assert.ok(Math.abs(full.top - 4.4) < 0.02, 'нет безопасной зоны под шапкой Lampa: ' + full.top);
  assert.ok(Math.abs(full.bottom - 1.6) < 0.02, 'текст не прижат к низу кадра: ' + full.bottom);
  const small = box(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__text'));
  assert.equal(small.zoom, 1.04, 'кегль сжатого состояния');
  assert.ok(Math.abs(small.left - full.left) < 0.02 && Math.abs(small.top - full.top) < 0.02 && Math.abs(small.bottom - full.bottom) < 0.02,
    'на переходе блок съедет вбок: ' + JSON.stringify(small) + ' против ' + JSON.stringify(full));

  /* Та же вертикаль у заголовка ряда — пользователь сверяет их по линии. */
  const head = findDecl(css, (sel) => sel === '.lumen-main .items-line__head');
  assert.ok(head.indexOf('padding-left:2.81em') !== -1, 'заголовок ряда не выровнен по safe area: ' + head);
  const content = findDecl(css, (sel) => sel === '.lumen-main .items-line .scroll__content');
  assert.ok(content.indexOf('padding-left:2.81em') !== -1, 'лента карточек не выровнена по safe area: ' + content);

  /* Полоса чипов стоит внутри кадра, над его кромкой (20.6 ряда + 2.4
     воздуха + .8 зазора), а низ текста поднят над самой полосой. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .lumen-moods'), 'bottom:23.8em');
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main.lumen-rows-up .lumen-moods'), 'display:none');
});

/* Замер пользователя на живой вкладке 1153×798: чипы 474…510 при низе кадра
   483 и верхе области рядов 482 — полоса висела ровно на стыке и заходила на
   обе стороны («а почему это съехало???»). Теперь её высота честно участвует
   в раскладке: полоса стоит ВНУТРИ кадра над его кромкой, текст поднят над
   полосой, ряды под кадром. Тест считает все четыре величины в em от нижней
   кромки экрана (чем больше — тем выше) и проверяет, что интервалы не
   пересекаются ни при одном размере кадра и ни при одном масштабе. */
test('раскладка героя: кадр, полоса чипов, текст и ряды не пересекаются', () => {
  const num = (decl, name) => parseFloat(new RegExp(name + ':([0-9.]+)em').exec(decl)[1]);
  for (const size of ['large', 'medium', 'compact']) {
    for (const scale of ['small', 'normal', 'large', 'huge']) {
      const built = withStorage({ lumen_hero_size: size, lumen_scale: scale }, (LC) => LC.buildCss());
      const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
      const decl = (name) => ruleBodies(built).find(only(name)).decl;
      const label = size + '/' + scale;

      /* Высота кадра задана как 100vh − X: X и есть его нижняя кромка,
         считая от низа экрана. Верх первого ряда — это X минус воздух. */
      const heroBottom = parseFloat(/height:calc\(100vh - ([0-9.]+)em\)/.exec(decl('.lumen-hero'))[1]);
      const rowsArea = num(decl('.lumen-main .scroll.layer--wheight'), 'height');
      const rowTop = rowsArea - 2.5;
      /* Полоса чипов: её низ задан правилом, высота — чип с его кеглем плюс
         собственный нижний отступ. */
      const chip = decl('.lumen-mood-chip');
      const chipZoom = num(chip, 'font-size');
      const chipH = num(chip, 'height') * chipZoom;
      const chipGap = parseFloat(/margin:0 [0-9.]+em ([0-9.]+)em/.exec(chip)[1]) * chipZoom;
      const moodsBottom = num(decl('.lumen-main .lumen-moods'), 'bottom');
      const moodsTop = moodsBottom + chipH + chipGap;
      /* Низ текстового блока считается от низа КАДРА и в его собственном
         кегле — переводим в базовые em. */
      const textDecl = decl('.lumen-moods-on .lumen-hero .lumen-hero__text');
      const textZoom = num(decl('.lumen-hero .lumen-hero__text'), 'font-size');
      const textBottom = num(textDecl, 'bottom') * textZoom;

      /* Порядок снизу вверх: верх первого ряда → нижняя кромка кадра → низ
         полосы чипов → её верх. Каждая величина обязана быть строго больше
         предыдущей (больше — значит выше), иначе блоки наложатся. */
      assert.ok(heroBottom > rowTop, label + ': кадр заходит на область рядов (' + heroBottom + ' против ' + rowTop + ')');
      assert.ok(moodsBottom - heroBottom >= 0.5, label + ': полоса чипов свисает с кромки кадра (' + moodsBottom + ' против ' + heroBottom + ')');
      /* Текст обязан кончаться выше полосы: его низ считается от нижней
         кромки кадра, поэтому сравниваем с высотой полосы над той же
         кромкой. */
      assert.ok(textBottom >= moodsTop - heroBottom, label + ': текст налезает на полосу чипов (' + textBottom + ' против ' + (moodsTop - heroBottom) + ')');
      /* И воздух между кадром и заголовком ряда остаётся тем же. */
      assert.ok(Math.abs((heroBottom - rowTop) - 2.4) < 0.01, label + ': воздух над заголовком ряда ' + (heroBottom - rowTop));
    }
  }
});

/* Правка пользователя 2026-09-17 (второй круг, п.2): «условно с середины
   картинки сделаем полупрозрачный, в середине 70 %, до 0 % в конце». */
test('правка: кадр героя растворяется в фон с середины, а не обрывается', () => {
  const veil = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__veil--b');
  assert.ok(veil.indexOf(',.3) 50%') !== -1, 'на половине высоты картинка не на 70 %: ' + veil);
  assert.ok(veil.indexOf(',0) 88%') !== -1, 'затухание не доходит почти до верха кадра: ' + veil);
  assert.ok(veil.indexOf('-webkit-linear-gradient(bottom,') !== -1, 'старым webkit-движкам нужен префиксный градиент');
  /* Лишнего слоя ради затухания не завели: вуалей по-прежнему две. */
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-hero__veil--') !== -1).length, 2);
});

/* Правка пользователя 2026-09-17 (п.2): четыре размера героя. Доля экрана
   считается при 16:9 — там em Lampa (ширина / 84.17) пропорциональна высоте,
   поэтому доля одна и та же на 1920×1080 и 1280×720. */
test('правка: размер героя — настройка, доли экрана 51.4 / 40.1 / 27.9 %', () => {
  const EM_AT_1920 = 1920 / 84.17;
  const share = (value) => {
    const built = withStorage(value ? { lumen_hero_size: value } : {}, (LC) => LC.buildCss());
    const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
    const hero = ruleBodies(built).find(only('.lumen-hero')).decl;
    const cut = parseFloat(/height:calc\(100vh - ([\d.]+)em\)/.exec(hero)[1]);
    return Math.round((1080 - cut * EM_AT_1920) / 1080 * 1000) / 10;
  };
  /* Правка 2026-09-17 (второй круг, п.3): доли стали на HERO_AIR (2.4em =
     5.1 % экрана при 1920×1080) меньше прежних 56.5 / 45.2 / 33.0 — этот
     воздух отдан заголовку первого ряда, чтобы тот не лип к кромке кадра. */
  assert.equal(share('large'), 51.4);
  assert.equal(share('medium'), 40.1);
  assert.equal(share('compact'), 27.9);
  assert.equal(share(null), 51.4, 'по умолчанию — крупный (правка второго круга)');
  assert.equal(share('мусор'), 51.4, 'незнакомое значение — значение по умолчанию, а не «выключено»');
});

/* Правка пользователя 2026-09-17 (п.1): уехавший вверх ряд не оставляет от
   себя подписей с годом поперёк экрана. */
test('правка: хвостов уехавшего ряда не видно — маска гасит отступ Lampa над фокусным рядом', () => {
  const rows = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  assert.ok(rows.indexOf('overflow:hidden') !== -1, 'нет обрезки области рядов: ' + rows);
  /* Хвост лежит ВНУТРИ области — в 2.5em отступа, который Lampa держит над
     фокусным рядом, поэтому гасит его маска, а не обрезка. Полная
     непрозрачность обязана наступать ровно на 2.5em: раньше — срезало бы
     фокусный ряд, позже — хвост остался бы читаемым. */
  assert.ok(rows.indexOf('mask-image:linear-gradient(to bottom,rgba(255,255,255,0) 0,rgba(255,255,255,0) 2em,#fff 2.5em,') !== -1,
    'нет маски верхнего отступа: ' + rows);
  assert.ok(rows.indexOf('-webkit-mask-image:-webkit-linear-gradient(top,') !== -1, 'старым webkit-движкам нужен префиксный градиент');
  assert.ok(rows.indexOf('#fff 92%,rgba(255,255,255,0) 100%') !== -1, 'нижнее затухание Lampa сохранено');
  const low = heroOffMedia(css);
  assert.ok(low.indexOf('overflow:hidden') !== -1, 'на низком окне область тоже обрезана: ' + low);
});

test('фаза 3: герой и ряды сходятся в одной точке при любом масштабе', () => {
  /* Верх первого ряда = 4em (шапка Lampa) + margin-top + 2.5em (отступ,
     который Lampa держит над фокусным рядом). Низ героя = его height − 4em
     (герой поднят на top:-4em). Между ними обязан быть ровно воздух
     HERO_AIR (2.4em, правка второго круга п.3): больше — под кадром зияет
     полоса, меньше — заголовок ряда лип бы к кромке картинки.

     Правка второго круга (главное): то же самое проверяется и для СЖАТОГО
     состояния — там кадр 72vh − compactCut, а область рядов расширена на
     освободившиеся 28vh. Если эти две величины разойдутся, под сжатым
     кадром снова появится пустая зона. */
  const AIR = 2.4;
  for (const value of ['small', 'normal', 'large', 'huge']) {
    const built = withStorage({ lumen_scale: value }, (LC) => LC.buildCss());
    /* Правило масштаба перечисляет корни списком, и .lumen-hero есть среди
       них — здесь нужно правило, где этот корень единственный. */
    const only = (name) => (r) => r.selectors.length === 1 && r.selectors[0] === name;
    const hero = ruleBodies(built).find(only('.lumen-hero')).decl;
    const rows = ruleBodies(built).filter(only('.lumen-main .scroll.layer--wheight'))[0].decl;
    const heroCut = parseFloat(/height:calc\(100vh - ([\d.]+)em\)/.exec(hero)[1]);
    const rowsTop = parseFloat(/margin-top:calc\(100vh - ([\d.]+)em\)/.exec(rows)[1]);
    /* Верх героя совпадает с верхом экрана: он поднят на 4em внутри
       активности, а сама активность начинается на 4em ниже кромки. Значит
       низ героя = 100vh − heroCut, а верх первого ряда = 4em (активность) +
       (100vh − rowsTop) + 2.5em. Сравниваем добавки к 100vh. */
    const heroBottom = -heroCut;
    const rowTop = 6.5 - rowsTop;
    assert.ok(Math.abs(rowTop - heroBottom - AIR) < 0.01,
      value + ': низ героя ' + heroBottom + 'em против верха ряда ' + rowTop + 'em');

    /* Сжатое состояние: обе величины считаются от 72vh и 28vh, поэтому
       сравниваем добавки в em при совпадающих долях экрана. */
    const heroC = ruleBodies(built).find(only('.lumen-hero.lumen-hero--compact')).decl;
    const rowsC = ruleBodies(built).find(only('.lumen-main.lumen-rows-up .scroll.layer--wheight')).decl;
    const compactCut = parseFloat(/height:calc\(72vh - ([\d.]+)em\)/.exec(heroC)[1]);
    const compactArea = parseFloat(/height:calc\(28vh \+ ([\d.]+)em\) !important/.exec(rowsC)[1]);
    const compactTop = parseFloat(/margin-top:calc\(72vh - ([\d.]+)em\)/.exec(rowsC)[1]);
    /* Отступ сверху обязан быть согласован с высотой области: вместе они
       дают 100vh − 4em, то есть низ области ровно на кромке экрана. */
    assert.ok(Math.abs((compactTop - compactArea) - 4) < 0.01,
      value + ': сжатая область не упирается в кромку экрана (' + compactTop + '/' + compactArea + ')');
    /* Верх ряда в сжатом = 4em + (72vh − compactTop) + 2.5em. */
    const compactRowTop = 6.5 - compactTop;
    assert.ok(Math.abs(compactRowTop + compactCut - AIR) < 0.01,
      value + ': сжатый кадр ' + (-compactCut) + 'em против верха ряда ' + compactRowTop + 'em');
  }
});

test('фаза 3: у совсем низкого окна ряды занимают экран целиком, кадр героя не показывается', () => {
  /* Правка второго круга: порог считается не от того, влезет ли ряд, а от
     того, влезет ли СОДЕРЖИМОЕ кадра (безопасная зона под шапкой Lampa,
     логотип, строка рейтинга, отступ снизу). Иначе герою доставался огрызок,
     в котором текст налезал на шапку и сам на себя — находка пользователя.
     При крупном кадре и обычном масштабе это 2.2:1. */
  const line = heroOffMedia(css);
  assert.ok(line && line.indexOf('.lumen-hero{display:none}') !== -1, 'нет страховки для низкого окна: ' + line);
  assert.ok(line.indexOf('min-aspect-ratio:220/100') !== -1, 'порог при обычном масштабе и крупном кадре — 2.2:1: ' + line);
  assert.ok(line.indexOf('margin-top:0') !== -1, 'за порогом ряды не сдвигаются');
  /* За порогом чипы настроения ведут себя как при выключенном герое: полоса
     под шапкой, ряды опущены на её высоту. */
  assert.ok(line.indexOf('.lumen-moods-on.lumen-main .lumen-moods{top:.53em;bottom:auto}') !== -1, 'чипы остались привязаны к исчезнувшему кадру: ' + line);
  assert.ok(line.indexOf('.lumen-moods-on.lumen-main .scroll.layer--wheight') !== -1, 'ряды не опущены под полосу чипов: ' + line);
  /* И на листании чипы остаются: прятать их вместе с несуществующим кадром
     незачем — место, которое они освобождали, здесь уже у рядов. */
  assert.ok(line.indexOf('.lumen-moods-on.lumen-main.lumen-rows-up .lumen-moods{display:') !== -1, 'без кадра чипы пропадают при листании: ' + line);

  /* Порог описания — отдельный и более мягкий: кадру хватает высоты на
     минимум, но не на две строки описания. */
  const descr = css.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 && l.indexOf('lumen-hero__descr') !== -1);
  assert.ok(descr.indexOf('min-aspect-ratio:182/100') !== -1, 'порог описания: ' + descr);
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
  /* Окна, в которых кадра быть не должно: высоты не хватает даже на минимум. */
  const flat = [[1150, 230], [1280, 400], [1280, 480]];
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

/* Правка пользователя 2026-09-17 (третий круг): «в сжатом состоянии нет
   описания». Оно вернулось одной строкой вместе с мета-строкой — там, где
   сжатому кадру хватает высоты. */
test('сжатое состояние: описание в одну строку возвращается, когда помещается', () => {
  const compactMedia = (built) => built.split('\n').find((l) => l.indexOf('@media screen and (max-aspect-ratio:') === 0 && l.indexOf('lumen-hero--compact') !== -1);
  const ratioOf = (built) => parseInt(/max-aspect-ratio:(\d+)\/100/.exec(compactMedia(built))[1], 10) / 100;

  const large = withStorage({ lumen_hero_size: 'large' }, (LC) => LC.buildCss());
  const line = compactMedia(large);
  assert.ok(line.indexOf('.lumen-hero.lumen-hero--compact .lumen-hero__descr{display:-webkit-box;-webkit-line-clamp:1}') !== -1, 'описание в сжатом обязано быть в одну строку: ' + line);
  assert.ok(line.indexOf('.lumen-hero.lumen-hero--compact .lumen-hero__meta{display:block}') !== -1, 'мета-строка в сжатом: ' + line);

  /* Крупный кадр на телевизоре и в окне пользователя описание показывает. */
  for (const [w, h] of [[1920, 1080], [1280, 720], [1153, 798]]) {
    assert.ok(w / h <= ratioOf(large), 'крупный кадр ' + w + '×' + h + ': описание в сжатом пропало');
  }
  /* У мелких кадров высоты на него нет — и правило честно не срабатывает,
     вместо того чтобы срезать текст верхней кромкой. */
  assert.ok(1920 / 1080 > ratioOf(withStorage({ lumen_hero_size: 'medium' }, (LC) => LC.buildCss())), 'средний кадр на FHD описание в сжатом не вмещает');
  assert.ok(1920 / 1080 > ratioOf(withStorage({ lumen_hero_size: 'compact' }, (LC) => LC.buildCss())), 'компактный кадр на FHD описание в сжатом не вмещает');

  /* Базовое правило по-прежнему прячет описание в сжатом — медиазапрос
     только возвращает его там, где место есть. */
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__descr').indexOf('display:none') !== -1);
});

/* Второй порог — мягкая деградация: описание уходит раньше, чем кадр, и
   только там, где на него не хватает высоты. */
test('решение «показывать описание»: порог мягче порога кадра и срабатывает по бюджету', () => {
  const descrRatio = (built) => {
    const line = built.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 && l.indexOf('lumen-hero__descr') !== -1);
    return parseInt(/min-aspect-ratio:(\d+)\/100/.exec(line)[1], 10) / 100;
  };
  const heroRatio = (built) => parseInt(/min-aspect-ratio:(\d+)\/100/.exec(heroOffMedia(built))[1], 10) / 100;
  for (const size of ['large', 'medium', 'compact']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    assert.ok(descrRatio(built) <= heroRatio(built), size + ': описание обязано уходить не позже кадра');
  }
  /* Крупный кадр на 1920×1080 (1.78:1) описание показывает, мелкий — нет:
     у него на две строки высоты уже не остаётся. */
  assert.ok(1920 / 1080 < descrRatio(withStorage({ lumen_hero_size: 'large' }, (LC) => LC.buildCss())), 'крупный кадр на FHD обязан показывать описание');
  /* И в окне пользователя (1153×798) тоже. */
  assert.ok(1153 / 798 < descrRatio(withStorage({ lumen_hero_size: 'large' }, (LC) => LC.buildCss())), 'описание пропало в окне 1153×798');
  assert.ok(1920 / 1080 >= descrRatio(withStorage({ lumen_hero_size: 'compact' }, (LC) => LC.buildCss())), 'в компактном кадре описанию места нет');
});

test('Task 18: кроссфейд кадра 600 мс только в полном режиме анимаций', () => {
  const bg = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__bg');
  assert.ok(bg && bg.indexOf('opacity:0') !== -1, 'неактивный слой прозрачен');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__bg.is-active').indexOf('opacity:1') !== -1);

  const full = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__bg');
  assert.ok(full && full.indexOf('transition:opacity .6s ease-in-out') !== -1, 'кроссфейд 600 мс: ' + full);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-lite .lumen-hero__bg'), null, 'в lite перехода нет вовсе — гасить нечего');
});

test('Task 18: blur размытого постера — только в полном режиме (на слабых ТВ его нет)', () => {
  const blur = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full.lumen-hero--blur .lumen-hero__bg');
  assert.ok(blur && blur.indexOf('filter:blur(1.75em)') !== -1, 'кадра нет — размытый постер, как на экране 22');
  const offenders = ruleSelectors(css).filter((sel) => sel.indexOf('lumen-hero--blur') !== -1 && sel.indexOf('lumen-motion-full') === -1);
  assert.deepEqual(offenders, [], 'blur героя вне режима full — дорогая заливка на ТВ');
});

test('Task 18: подмена текста 180/420 мс в full, в lite/off — мгновенно и без анимаций', () => {
  const swap = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping');
  assert.ok(swap && swap.indexOf('opacity:0') !== -1 && swap.indexOf('translateY(.53em)') !== -1, 'старый текст уходит вниз на 12 px FHD');
  const inCls = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-in');
  assert.ok(inCls && inCls.indexOf('lumen-hero-in .42s') !== -1, 'новый поднимается 420 мс');

  const calm = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-lite .lumen-hero__text');
  const calmOff = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-off .lumen-hero__text');
  assert.equal(calm, calmOff, 'lite и off гасят анимацию одним правилом');
  assert.ok(calm, 'правило lite/off не найдено');
  assert.ok(/animation:none/.test(calm) && /transition:none/.test(calm) && calm.indexOf('opacity:1') !== -1, 'в lite/off текст виден сразу: ' + calm);
});

test('Task 18: логотип фильма с текстовым фолбэком, описание в две строки, скелетон до ответа деталей', () => {
  const logo = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__logo');
  /* Правка третьего круга: рамка логотипа расширена до 8.6:1 (37.84 × 4.4em).
     Логотипы TMDB приходят с любыми пропорциями — замер живьём на одном ряду
     дал от 1.48:1 до 8.02:1, и при прежней рамке 6.97:1 длинные упирались в
     ширину и теряли высоту, оказываясь в полтора раза мельче соседних. */
  assert.ok(logo && logo.indexOf('width:37.84em') !== -1, 'рамка логотипа: ' + logo);
  const frame = 37.84 / 4.4;
  assert.ok(frame >= 8.5, 'рамка обязана быть шире самых длинных логотипов (8.02:1), иначе высота у них проседает');
  assert.ok(logo.indexOf('background-size:contain') !== -1, 'логотип обязан вписываться с сохранением пропорций');
  assert.ok(logo.indexOf('display:none') !== -1, 'без логотипа узел скрыт');

  /* Текстовый фолбэк занимает по высоте ровно место логотипа: две строки по
     1.08 при кегле 2.04em — те же 4.4em. */
  const title = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__title');
  assert.ok(Math.abs(2.04 * 1.08 * 2 - 4.4) < 0.02, 'кегль фолбэка обязан давать высоту логотипа');
  assert.ok(title.indexOf('font-size:2.04em') !== -1 && title.indexOf('-webkit-line-clamp:2') !== -1, 'фолбэк: ' + title);
  assert.ok(title.indexOf('height:2.16em') !== -1, 'фолбэк обязан занимать фиксированную высоту: ' + title);

  /* В сжатом состоянии логотип мельче, но рамка та же 8.6:1 — высота
     остаётся одинаковой у всех фильмов и там. */
  const logoSmall = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__logo');
  assert.ok(logoSmall.indexOf('width:27.52em') !== -1 && logoSmall.indexOf('height:3.2em') !== -1, 'сжатый логотип: ' + logoSmall);
  assert.ok(Math.abs(27.52 / 3.2 - frame) < 0.05, 'пропорция рамки в обоих состояниях обязана совпадать');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--logo .lumen-hero__title').indexOf('display:none') !== -1, 'есть логотип — заголовка нет');

  const descr = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__descr');
  assert.ok(descr && descr.indexOf('-webkit-line-clamp:2') !== -1, 'описание — две строки (§0.2)');
  assert.ok(descr.indexOf('max-width:39.45em') !== -1, '900 px FHD');

  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--pending .lumen-hero__sk--meta'), 'скелетон меты, пока грузятся детали');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--pending.lumen-hero--nodescr .lumen-hero__sk--descr'), 'скелетон описания — только когда описания нет вовсе');
});

test('Task 18: сдвигается область прокрутки рядов, а не её содержимое', () => {
  /* padding-top у .scroll__body Lampa съедает первой же прокруткой: она
     выравнивает фокусный ряд по верху области. Сдвигать надо саму область. */
  const rows = findDecl(css, (sel) => sel === '.lumen-main .scroll.layer--wheight');
  assert.ok(rows, 'правило области прокрутки главной не найдено');
  /* Фаза 3: высота области считается от ряда (один ряд + отступ Lampa над
     фокусным рядом), а отступ сверху — остаток экрана. Долей экрана (22vh)
     высота больше не задаётся: та цифра была пределом для штатной карточки
     Lampa 290×563, а карточки рядов теперь дизайнерские 230×345. */
  /* Правка пользователя 2026-09-17 (п.2): числа считаются от размера героя
     по умолчанию («средний»): блок ряда 20.6em × 1.26 = 25.96em, плюс 2.5em
     отступа Lampa над фокусным рядом = 28.46em области и 32.46em сдвига. */
  assert.ok(/margin-top:calc\(100vh - 27\.1em\)/.test(rows), 'область начинается под героем: ' + rows);
  assert.ok(/margin-top:-webkit-calc\(100vh - 27\.1em\)/.test(rows), 'старым webkit-движкам нужен префиксный calc');
  assert.ok(/height:23\.1em !important/.test(rows), 'высота области — то, что не досталось герою; height Lampa задаёт инлайном');
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
  const offenders = ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-main') === 0 &&
    sel.indexOf('layer--wheight') === -1 &&
    sel.indexOf('.lumen-badge') === -1 && sel.indexOf('.lumen-moods') === -1 &&
    sel.indexOf('.card') === -1 && sel.indexOf('.items-line') === -1);
  assert.deepEqual(offenders, [], 'под .lumen-main только область прокрутки, карточки рядов, метки, чипы настроения и сами ряды');
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-main .scroll--horizontal') === 0).length, 0,
    'горизонтальные скроллы рядов не трогаем');
});

/* Долг фазы 2: ряды главной шли штатной карточкой Lampa 290×563, из-за чего
   герой был виден на ~36 % экрана вместо 58 % дизайна. */
test('фаза 3: карточка ряда главной — дизайнерские 230×345, подписи §0.4', () => {
  const card = findDecl(css, (sel) => sel === '.lumen-main .card');
  assert.equal(card, 'width:10.08em', '230 px FHD; высоту даёт штатный padding-bottom:150 % у .card__view');
  const title = findDecl(css, (sel) => sel === '.lumen-main .card__title');
  assert.ok(title.indexOf('font-size:0.96em') !== -1, 'название 22 px (§0.4): ' + title);
  assert.ok(title.indexOf('white-space:nowrap') !== -1, 'одна строка: вторая отнимает у героя столько же экрана');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .card__age').indexOf('font-size:0.88em') !== -1, 'мета 20 px (§0.4)');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .items-line__title').indexOf('font-size:1.23em') !== -1, 'заголовок ряда 28 px (§0.3)');

  /* Фокус — кольцо акцентом вместо белого штатного; scale не ставим: у Lampa
     на .card__view своя анимация фокуса. */
  const focus = findDecl(css, (sel) => sel === '.lumen-main .card.focus .card__view:after');
  assert.ok(focus.indexOf('border-width:.13em') !== -1, 'кольцо 3 px (§0.4): ' + focus);
  assert.ok(focus.indexOf('#FFF2DC') !== -1, 'кольцо — светлый тон акцента');
  assert.equal(/transform/.test(focus), false, 'своего transform на карточке ряда нет');
});

test('фаза 3: область рядов и карточки масштабируются одним коэффициентом', () => {
  /* Крупнее карточка — выше ряд, и области достаётся больше экрана: иначе
     первый же ряд не поместился бы и был бы обрезан нижней кромкой. */
  /* Правка второго круга: по умолчанию размер кадра «крупный» (множитель 1),
     поэтому область рядов — ровно блок ряда плюс отступ Lampa. */
  const pairs = [['small', '9.07em', '21.16em'], ['large', '11.09em', '25.04em'], ['huge', '12.1em', '26.98em']];
  for (const pair of pairs) {
    const scaled = withStorage({ lumen_scale: pair[0] }, (LC) => LC.buildCss());
    assert.equal(findDecl(scaled, (sel) => sel === '.lumen-main .card'), 'width:' + pair[1], pair[0] + ': ширина карточки ряда');
    const rows = findDecl(scaled, (sel) => sel === '.lumen-main .scroll.layer--wheight');
    assert.ok(rows.indexOf('height:' + pair[2] + ' !important') !== -1, pair[0] + ': высота области — ' + rows);
    /* Отступ сверху = экран − шапка Lampa (4em) − область. */
    const top = (parseFloat(pair[2]) + 4).toFixed(2).replace(/0$/, '');
    assert.ok(rows.indexOf('margin-top:calc(100vh - ' + top + 'em)') !== -1, pair[0] + ': отступ сверху ' + top + 'em — ' + rows);
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
  const emerald = withStorage({ lumen_card_accent: 'emerald' }, (LC) => LC.buildCss());
  const focus = findDecl(emerald, (sel) => sel === '.lumen-card .full-start-new__buttons .full-start__button.focus');
  assert.ok(focus.indexOf('#7ACCA0') !== -1, 'заливка кнопки в фокусе — цвет изумруда: ' + focus);
  assert.ok(focus.indexOf('#E4FBEE') !== -1, 'кольцо фокуса — светлый тон изумруда');
  assert.ok(focus.indexOf('rgba(122,204,160,0.35)') !== -1, 'свечение — тот же цвет');

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

test('фаза 3: «Плотные подложки» — сплошные карты и ни одного размытия', () => {
  const solid = withStorage({ lumen_solid: 'true' }, (LC) => LC.buildCss());
  assert.equal(/backdrop-filter\s*:\s*blur/.test(solid), false, 'размытие подложек не выводится вовсе');
  assert.ok(/backdrop-filter\s*:\s*blur/.test(css), 'по умолчанию размытие на месте');

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

test('фаза 3: плотные подложки вместе с «Лёгкими» анимациями не возвращают прозрачность', () => {
  /* В lite/off «Стоп» и метка уплотняются до .9 — с плотными подложками они
     уже сплошные, и правило режима не должно делать их снова прозрачными. */
  const solid = withStorage({ lumen_solid: 'true' }, (LC) => LC.buildCss());
  const lite = findDecl(solid, (sel) => sel === '.lumen-card.lumen-motion-lite .lumen-stop');
  assert.ok(lite && lite.indexOf('rgba(') === -1, 'подложка «Стопа» в lite осталась сплошной: ' + lite);
  const liteDefault = findDecl(css, (sel) => sel === '.lumen-card.lumen-motion-lite .lumen-stop');
  assert.ok(liteDefault.indexOf('rgba(11,9,8,.9)') !== -1, 'по умолчанию уплотнение до .9 на месте: ' + liteDefault);
});

/* Герой в списке представлен текстовым блоком, а не корнем: высота самого
   .lumen-hero считается от экрана и от высоты ряда, и лишний кегль умножил бы
   те же em второй раз (живьём: «мельче» — кадр накрывал ряд на 35 px). */
const SCALE_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-hero .lumen-hero__text', '.lumen-hub', '.lumen-grid'];

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
  /* Высота героя при этом всё равно зависит от масштаба — через высоту ряда,
     а не через кегль: ряд крупнее, значит герою остаётся меньше. */
  const heroOnly = (r) => r.selectors.length === 1 && r.selectors[0] === '.lumen-hero';
  const heroHuge = ruleBodies(scaled).find(heroOnly).decl;
  /* 30.84em ряда плюс 2.4em воздуха над заголовком (правка второго круга). */
  assert.ok(heroHuge.indexOf('height:calc(100vh - 26.88em)') !== -1, 'высота героя при «ещё крупнее»: ' + heroHuge);
});

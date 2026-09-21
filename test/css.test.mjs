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
const ALLOWED_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-descr-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton', '.lumen-overlay', '.lumen-minimap', '.lumen-jump', '.lumen-ambient', '.lumen-roulette', '.lumen-menu-roulette', '.lumen-hud', '.full-start__background', '.full-start-new', 'body'];

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
var OWN_NAMESPACE_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.lumen-descr-modal', '.lumen-hub', '.lumen-grid', '.lumen-menu-hub', '.lumen-hero', '.lumen-main', '.lumen-moods', '.lumen-mood-chip', '.lumen-skeleton', '.lumen-overlay', '.lumen-minimap', '.lumen-jump', '.lumen-ambient', '.lumen-roulette', '.lumen-menu-roulette'];

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
/* Медиазапросов по отношению сторон два: первый прячет описание героя,
   второй отдаёт экран рядам целиком. Тесты ниже ищут именно второй.
   Task 36: признаком второго стало не .lumen-hero{display:none}, а возврат
   текстового блока героя в поток (position:static) — кадр там превращается
   в полосу чипов настроения под шапкой, а не пропадает вместе с ними. */
function heroOffMedia(cssText) {
  return cssText.split('\n').find((l) => l.indexOf('@media screen and (min-aspect-ratio:') === 0 &&
    l.indexOf('.lumen-hero__text{position:static') !== -1);
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
  assert.ok(badge.indexOf('right:2.81em') !== -1, 'right 64px = 2.81em (safe area экрана 02)');
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
test('Фикс Task 59: подсказка про полный текст видна только там, где описание поджато', () => {
  const base = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-descr-more');
  assert.ok(base && /display\s*:\s*none/.test(base), 'в ряду без отзывов подсказки быть не должно');
  const withReviews = findDecl(css, (sel) => sel === '.lumen-descr-row.lumen-descr-row--reviews .lumen-descr-more');
  assert.ok(withReviews && /display\s*:\s*block/.test(withReviews), 'при отзывах подсказка обязана показываться');
  const clamp = findDecl(css, (sel) => sel === '.lumen-descr-row.lumen-descr-row--reviews .full-descr__text');
  assert.ok(clamp && clamp.indexOf('-webkit-line-clamp:8') !== -1,
    'подсказка привязана к тому же состоянию, что и обрезка текста');
});

test('Фикс Task 59: у окна полного описания свой корень и кегль текста описания', () => {
  const text = findDecl(css, (sel) => sel === '.lumen-descr-modal__text');
  assert.ok(text && text.indexOf('font-size:1.05em') !== -1, 'кегль тот же, что у описания в ряду');
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

  const chip = findDecl(css, (sel) => sel === '.lumen-card.lumen-compact .lumen-next-chip');
  /* Task 43: склейку держат радиусы и паддинги — рамок, края которых
     прежде срезались, нет ни у чипа, ни у статуса. */
  assert.ok(chip && chip.indexOf('border-top-left-radius:0') !== -1 && chip.indexOf('padding-left:0') !== -1, chip);
  const status = findDecl(css, (sel) => sel.indexOf('.lumen-card--nextchip') !== -1 && sel.indexOf('.full-start__status') !== -1);
  assert.ok(status, 'край статуса срезается только когда чип виден (класс .lumen-card--nextchip)');
  assert.ok(/margin-right\s*:\s*0\s*!important/.test(status), 'зазор .53em между картами Lampa ставит !important-ом');
  assert.ok(status.indexOf('border-top-right-radius:0') !== -1 && status.indexOf('border-bottom-right-radius:0') !== -1, status);
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
  assert.ok(chip.indexOf('height:2.2em') !== -1, 'высота pill: ' + chip);
  assert.ok(chip.indexOf('border-radius:1.1em') !== -1, 'радиус = половине высоты: ' + chip);
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
  const decl = findDecl(css, (sel) => sel === 'body.lumen-main-on .background');
  assert.ok(decl, 'нет правила, гасящего фон Lampa под главной плагина');
  assert.equal(decl, 'display:none', 'гасим целиком и ничем больше: ' + decl);
  /* Отдельных правил на канвасы быть не должно — это мёртвые правила:
     потомков погашенного предка браузер не рисует. */
  const extra = ruleBodies(css).filter((r) => r.selectors.some((s) => /\.background__/.test(s)));
  assert.deepEqual(extra.map((r) => r.selectors.join(',')), [],
    'канвасы внутри .background гасить отдельно нечем — правило станет мёртвым');
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

  const accentRule = withStorage({}, (LC) => LC.accentCss()).split('\n')
    .find((l) => l.indexOf('.lumen-main .card.focus .card__view{') === 0);
  assert.ok(accentRule, 'узел подкраски перестал нести правило фокуса карточки');
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
  assert.ok(Math.abs(num(text, 'left', 'em') * zoom - 2.81) < 0.02, 'safe area слева (§0.1): ' + text);
  /* Сверху — безопасная зона под шапкой Lampa: без неё высокое содержимое
     налезало на заголовок активности и иконки (находка пользователя). */
  assert.ok(Math.abs(num(text, 'top', 'em') * zoom - 4.4) < 0.02, 'нет безопасной зоны под шапкой Lampa: ' + text);
  /* Крупный кадр: низ текста на 66.67 − 12.5 = 54.17vh, то есть на 1.33vh
     выше заголовка первого ряда в старте (он стоит на 55.5vh).
     Task 51: было 10vh при сдвиге рядов 8vh — отступ считается ОТ ВЕРХА
     ПЕРВОГО РЯДА (textBottomVh в src/30_css.js), и убавленный на 2.5vh сдвиг
     ровно на столько же поднял текст. Зазор между ними — прежние 1.33vh. */
  assert.equal(num(text, 'bottom', 'vh'), 12.5, 'отступ текста снизу считается от верха первого ряда: ' + text);
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
  const small = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__text');
  assert.ok(small.indexOf('transform:translateY(calc(9.1vh + 3.88em)) scale(0.95)') !== -1, 'сжатие текста: ' + small);
  assert.ok(small.indexOf('-webkit-transform:translateY(-webkit-calc(9.1vh + 3.88em))') !== -1, 'старым webkit-движкам нужен префиксный calc: ' + small);
  assert.ok(small.indexOf('-webkit-transform:translateY(calc(9.1vh + 3.88em))') !== -1, 'после префиксного calc обязана идти обычная форма: ' + small);
  assert.ok(text.indexOf('transform-origin:left bottom') !== -1, 'без origin у левого нижнего угла scale увёл бы текст от safe area: ' + text);

  /* Та же вертикаль у заголовка ряда — пользователь сверяет их по линии. */
  const head = findDecl(css, (sel) => sel === '.lumen-main .items-line__head');
  assert.ok(head.indexOf('padding-left:2.81em') !== -1, 'заголовок ряда не выровнен по safe area: ' + head);
  const content = findDecl(css, (sel) => sel === '.lumen-main .items-line .scroll__content');
  assert.ok(content.indexOf('padding-left:2.81em') !== -1, 'лента карточек не выровнена по safe area: ' + content);

  /* Task 36: полоса чипов лежит ВНУТРИ текстового блока, последним его
     элементом, и своего absolute-места над кромкой кадра у неё больше нет —
     отсюда отсутствие bottom под корнем главной. */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .lumen-moods'), null, 'при живом кадре отдельного места под полосу чипов не отмеряется');
  const moods = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__moods');
  assert.ok(moods.indexOf('pointer-events:auto') !== -1, 'у героя pointer-events сняты — чипам их надо вернуть: ' + moods);
  assert.ok(moods.indexOf('margin-top:0.9em') !== -1, 'чипы отделены от содержимого выше: ' + moods);
  /* В сжатом чипы гаснут — вместе с opacity обязана уходить и visibility:
     opacity:0 сам по себе элемент из hit-testing не убирает, и погашенный
     чип остался бы под указателем. */
  const moodsC = findDecl(css, (sel) => sel === '.lumen-hero.lumen-hero--compact .lumen-hero__moods');
  assert.ok(moodsC.indexOf('opacity:0') !== -1 && moodsC.indexOf('visibility:hidden') !== -1, 'чипы на листании: ' + moodsC);
  /* Чип нажимаемый: 2.46em × .88 = 2.17em, то есть 49 px при 1920×1080. */
  assert.ok(2.46 * 0.88 * 22.811 > 40, 'чип обязан остаться нажимаемым');
});

/* Замер пользователя на живой вкладке 1153×798 (фаза 3): полоса чипов висела
   ровно на стыке кадра и рядов и заходила на обе стороны («а почему это
   съехало???»). С тех пор раскладка проверяется целиком, а не по правилам
   поодиночке.

   Task 36: считать стало проще — все величины выражены в долях экрана и в em,
   поэтому тест переводит их в пиксели ЖИВОГО телевизора (1920×1080, база
   кегля Lampa 1920/84.17 = 22.811) и сверяет расстояния между блоками.

   Полоса чипов лежит ВНУТРИ текстового блока, но её низ и низ блока — РАЗНЫЕ
   величины в сжатом состоянии: там полоса гаснет через visibility и место в
   потоке сохраняет (ревью Task 36, находка В1). Поэтому тест считает низ
   ВИДИМОГО содержимого отдельно — иначе 88 px пустоты между строкой рейтинга
   и кромкой кадра прошли бы мимо него, как прошли мимо живого замера. */
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
    const textBottom = parseFloat(/bottom:([0-9.]+)vh/.exec(textDecl)[1]) * VH;
    const compactText = decl('.lumen-hero.lumen-hero--compact .lumen-hero__text');
    const shiftParts = /[^-]transform:translateY\(calc\(([0-9.]+)vh \+ ([0-9.]+)em\)\)/.exec(compactText);
    const textShift = parseFloat(shiftParts[1]) * VH + parseFloat(shiftParts[2]) * EM;
    /* Высота полосы чипов — она же вторая половина сдвига: (MOODS_IN_GAP +
       MOODS_H) × TEXT_ZOOM, и в сжатом состоянии ровно на неё низ блока ниже
       низа видимого содержимого. */
    const moodsBand = parseFloat(shiftParts[2]) * EM;
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

    /* В сжатом состоянии проверяется низ ВИДИМОГО содержимого, а не низ
       блока: полоса чипов там погашена visibility и место в потоке занимает.
       Именно этот зазор пользователь видит как «текст над кромкой кадра», и
       он обязан быть тем же TEXT_EDGE_VH (3.4vh = 37 px при 1080), что и до
       переезда чипов внутрь блока. */
    const textVisibleUp = textEdgeUp - moodsBand;
    assert.ok(textVisibleUp < heroEdgeUp, label + ': текст в сжатом свисает с кромки кадра (' + textVisibleUp + ' против ' + heroEdgeUp + ')');
    assert.ok(Math.abs((heroEdgeUp - textVisibleUp) - 3.4 * VH) < 1,
      label + ': зазор от видимого текста до кромки кадра ' + (heroEdgeUp - textVisibleUp) + ' px вместо 36.7');
    /* А сам блок вместе с погашенной полосой может уходить за кромку — там
       его срежет overflow:hidden героя, и срезать нечего: полоса невидима. */
    assert.ok(textEdgeUp - textVisibleUp > 80, label + ': полоса чипов перестала занимать место — сдвиг больше не нужен');

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
function lampaCss() {
  return readFileSync(new URL('../vendor/lampa/css/app.css', import.meta.url), 'utf8');
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
function ruleBodiesWithMedia(cssText) {
  const out = [];
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

/* Действует ли медиазапрос на окне screenW×screenH. Условий в таблице
   ровно одно семейство — min-aspect-ratio (тест «порогов по
   max-aspect-ratio не осталось» ниже держит это числом), поэтому любое
   другое условие здесь — повод упасть, а не тихо посчитать правило
   применимым. */
function mediaApplies(media, screenW, screenH) {
  if (!media) return true;
  const found = /\(min-aspect-ratio:(\d+)\/(\d+)\)/.exec(media);
  assert.ok(found, 'незнакомое условие медиазапроса в раскладке: ' + media);
  return screenW / screenH >= parseInt(found[1], 10) / parseInt(found[2], 10);
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
  /* База кегля Lampa: font-size корня = ширина окна / 84.17 (правило единиц
     плагина, src/30_css.js). На стенде 960 px это 11.41 CSS px. */
  const EM = screenW / 84.17;
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
  const shiftUp = lengthPx(/translateY\(([^)]*)\)/.exec(cascade(upRules, 'transform').value)[1], EM, VH);
  const shiftDown = lengthPx(/translateY\(([^)]*)\)/.exec(cascade(downRules, 'transform').value)[1], EM, VH);
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
       если мы его не задали; высота — padding сверху и снизу плюс строка. */
    const ours = declAll(built, '.lumen-main .items-line__more');
    const moreFont = /font-size:/.test(ours) ? num(ours, 'font-size') : 1;
    const morePad = /padding:/.test(ours)
      ? parseFloat(/(?:^|;)padding:([0-9.]+)em/.exec(ours)[1])
      : lampaDecl(lampa, '.items-line__more', 'padding');
    headH = Math.max(headH, (morePad * 2 + lineH) * moreFont * EM);
  }
  /* Зазор под шапкой. margin-bottom стоит на .items-line__head, у него
     собственный кегль 1em, поэтому em здесь базовые. */
  const gap = num(decl(built, '.lumen-main .items-line__head'), 'margin-bottom') * EM;

  /* Постер: ширину задаём мы, высоту — штатный padding-bottom:150 % у
     .card__view (app.css:3135-3139), то есть 3:2 от ШИРИНЫ карточки. */
  const cardW = lengthPx(cascade(matchingRules(built, ['lumen-main'], ['card'], screenW, screenH), 'width').value, EM, 0);
  const posterH = cardW * (lampaDecl(lampa, '.card__view', 'padding-bottom') / 100);
  const posterBottomUp = rowTopUp + headH + gap + posterH;
  const posterBottomDown = rowTopDown + headH + gap + posterH;

  /* Подпись. margin-bottom у .card__view базовый (кегль .card — 1em), а вот
     margin-top у .card__age считается от ЕГО собственного кегля, который мы
     уменьшили до .88em, — em здесь дешевле базового, а не дороже. */
  const viewGap = num(declAll(built, '.lumen-main .card__view'), 'margin-bottom') * EM;
  const titleBody = decl(built, '.lumen-main .card__title');
  const cardTitleH = num(titleBody, 'font-size') * num(titleBody, 'line-height') * EM;
  const ageBody = decl(built, '.lumen-main .card__age');
  const ageFont = num(ageBody, 'font-size');
  const ageGap = num(ageBody, 'margin-top') * ageFont * EM;
  const ageH = ageFont * num(ageBody, 'line-height') * EM;
  const tail = viewGap + cardTitleH + ageGap + ageH;

  return {
    rowTopUp: rowTopUp,
    cardW: cardW / EM,
    textBottomUp: posterBottomUp + tail,
    textBottomDown: posterBottomDown + tail,
    posterBottomUp: posterBottomUp,
    posterBottomDown: posterBottomDown
  };
}

test('Task 51: подпись первого ряда помещается в экран телевизора при любом масштабе', () => {
  /* Стенд координатора: Philips 50PUS8057/60 отдаёт WebView 960×540 при
     devicePixelRatio 2 (растр 1920×1080). Раскладка считается в CSS px этого
     окна — именно в них сделан замер «543 при кромке 540» до Task 51. */
  const W = 960;
  const H = 540;
  /* Запас 8 px: подпись стоит на дробных координатах (кегли получаются
     умножением на масштаб интерфейса и округляются до сотых), и у ТВ свой
     оверскан. Ровно 540 значило бы «последняя строка касается кромки». */
  const TEXT_LIMIT = 532;

  /* Кнопка «Ещё» в шапке ряда — не краевой случай, а норма: Lampa дописывает
     её при results.length >= 20 || data.more (vendor/lampa/app.min.js:
     52696-52702), а страница выдачи TMDB — ровно 20 карточек. Она выше
     заголовка (padding .4em сверху и снизу плюс строка — 1.8em против 1.23em
     у заголовка, app.css:2859-2866), и шапка ряда меряется по ней. Худший
     случай — ряд С кнопкой, но инвариант обязан держаться в обоих. */
  const box = (scale, more, size) => rowLayout(
    withStorage(size ? { lumen_scale: scale, lumen_hero_size: size } : { lumen_scale: scale }, (LC) => LC.buildCss()), W, H, { more: more });

  /* Размер кадра героя двигает всю цепочку: от него зависит ROWS_TOP_VH, то
     есть сколько экрана достаётся рядам. Инвариант обязан держаться на всех
     трёх размерах, а не только на крупном по умолчанию. */
  for (const size of ['large', 'medium', 'compact']) {
    for (const scale of ['small', 'normal', 'large', 'huge']) {
      for (const more of [true, false]) {
        const got = box(scale, more, size);
        const label = size + '/' + scale + (more ? ' с кнопкой «Ещё»' : '');
        assert.ok(got.textBottomUp <= TEXT_LIMIT,
          label + ': низ подписи в поднятом состоянии ' + got.textBottomUp.toFixed(1) + ' px при пределе ' + TEXT_LIMIT);
      }
    }
  }

  for (const scale of ['small', 'normal', 'large', 'huge']) {
    for (const more of [true, false]) {
      const got = box(scale, more);
      const label = scale + (more ? ' с кнопкой «Ещё»' : '');
      assert.ok(got.textBottomUp <= TEXT_LIMIT,
        label + ': низ подписи в поднятом состоянии ' + got.textBottomUp.toFixed(1) + ' px при пределе ' + TEXT_LIMIT);
      /* В старте подпись за кромкой — это размен: кадр героя занимает две
         трети экрана по требованию пользователя. А вот постер обязан быть
         виден целиком: обрезанный по горизонтали постер выглядит поломкой. */
      assert.ok(got.posterBottomDown <= H,
        label + ': в стартовом состоянии постер срезан кромкой — низ ' + got.posterBottomDown.toFixed(1) + ' px');
    }
    assert.ok(box(scale, false).textBottomUp < box(scale, true).textBottomUp,
      scale + ': кнопка «Ещё» перестала добавлять высоту — шапку ряда меряет не тот элемент');
  }

  /* Контрольный замер координатора на стенде (после
     getAnimations().forEach((a) => a.finish()), см. шапку выше): штатный
     масштаб, ряд с кнопкой «Ещё», поднятое состояние — 518 при кромке 540.
     Число пинится точно, чтобы следующая правка раскладки не съела запас
     молча; до Task 51 тот же ряд без кнопки давал 543. */
  assert.ok(Math.abs(box('normal', true).textBottomUp - 518.5) < 1,
    'штатный масштаб с кнопкой «Ещё»: ' + box('normal', true).textBottomUp.toFixed(1) + ' вместо замеренных 518');
  assert.ok(Math.abs(box('normal', true).rowTopUp - 287) < 1,
    'верх шапки первого ряда: ' + box('normal', true).rowTopUp.toFixed(1) + ' вместо замеренных 287');
});

/* «Крупнее» и «огромный» сами по себе в экран не помещаются: блок ряда
   растёт вместе с масштабом интерфейса, а место под него задано долями
   ЭКРАНА (комментарий к HERO_VH в src/30_css.js). Лечит это медиазапрос,
   переводящий карточку на 8-ю колонку сетки Apple (8.07em против 9.52em у
   седьмой, docs/research/2026-09-21-tv-design-specs.md §1); порог считается
   из той же цепочки высот, по которой считает весь тест выше. */
test('Task 51: узкая колонка включается порогом из цепочки высот, а не на глаз', () => {
  const W = 960;
  for (const scale of ['small', 'normal', 'large', 'huge']) {
    const built = withStorage({ lumen_scale: scale }, (LC) => LC.buildCss());
    const narrowRules = ruleBodiesWithMedia(built).filter((r) => r.media &&
      r.selectors.some((sel) => sel === '.lumen-main .card') && /(?:^|;)width:/.test(r.decl));
    assert.equal(narrowRules.length, 1, scale + ': медиазапрос узкой колонки обязан быть ровно один');

    /* Ширина за порогом — восьмая колонка той же сетки: отношение к базовой
       обязано быть 8.07/9.52 при любом масштабе интерфейса. */
    const narrow = parseFloat(/(?:^|;)width:([0-9.]+)em/.exec(narrowRules[0].decl)[1]);
    const wide = lengthPx(cascade(matchingRules(built, ['lumen-main'], ['card'], 100, 100), 'width').value, 1, 0);
    assert.ok(narrow < wide, scale + ': за порогом карточка обязана быть УЖЕ базовой (' + narrow + ' против ' + wide + ')');
    assert.ok(Math.abs(narrow / wide - 8.07 / 9.52) < 0.005,
      scale + ': за порогом не восьмая колонка сетки — ' + narrow + 'em при базовых ' + wide + 'em');

    /* Порог согласован с раскладкой: ЧУТЬ ВЫШЕ него (окно ещё не такое
       приплюснутое, правило не сработало) широкая карточка обязана
       помещаться, но уже впритык — низ подписи не дальше 1.5em от кромки.
       Это и значит «порог посчитан из цепочки, а не назначен». */
    const ratio = parseInt(/min-aspect-ratio:(\d+)\/100/.exec(narrowRules[0].media)[1], 10) / 100;
    const at = (aspect) => {
      const height = Math.round(W / aspect);
      return { height: height, box: rowLayout(built, W, height, { more: true }) };
    };
    const before = at(ratio - 0.01);
    const slack = before.height - before.box.textBottomUp;
    assert.ok(slack >= 0, scale + ': до порога ' + ratio + ' широкая карточка уже не помещается (срез ' + (-slack).toFixed(1) + ' px)');
    assert.ok(slack <= 1.5 * (W / 84.17), scale + ': порог ' + ratio + ' запаздывает — до него ещё ' + slack.toFixed(1) + ' px запаса');
    /* А за порогом помещается узкая — иначе правило меняло бы ширину впустую. */
    const after = at(ratio + 0.02);
    assert.ok(after.height - after.box.textBottomUp >= 0,
      scale + ': за порогом ' + ratio + ' узкая колонка тоже не помещается');
  }

  /* На штатном масштабе телевизор 16:9 порога не достигает — там широкая
     карточка помещается сама (518.5 при пределе 532), и сужать её значило бы
     отобрать у постера 25 px без причины. */
  const normal = withStorage({ lumen_scale: 'normal' }, (LC) => LC.buildCss());
  const media = ruleBodiesWithMedia(normal).find((r) => r.media &&
    r.selectors.some((sel) => sel === '.lumen-main .card') && /(?:^|;)width:/.test(r.decl));
  assert.ok(1920 / 1080 < parseInt(/min-aspect-ratio:(\d+)\/100/.exec(media.media)[1], 10) / 100,
    'на штатном масштабе узкая колонка не должна включаться на 16:9: ' + media.media);
});

/* Правило, которым раскладка опускает ряды под полосу чипов настроения,
   живёт ТОЛЬКО внутри медиазапроса min-aspect-ratio (ветка «окно
   приплюснуто, кадра нет»). Вне его чипы раскладку рядов не трогают вовсе:
   на главной они лежат в слоте .lumen-hero__moods внутри .lumen-hero__text,
   а сам .lumen-hero — position:absolute с overflow:hidden (buildNode в
   src/48_hero.js, правило .lumen-hero в src/30_css.js), то есть места в
   потоке не занимают. Если правило однажды выедет из медиазапроса,
   раскладка главной поедет вниз на MOODS_BAR — тест это поймает. */
test('Task 51: правило чипов для главной живёт только за порогом отношения сторон', () => {
  const built = withStorage({ lumen_scale: 'normal' }, (LC) => LC.buildCss());
  const outside = ruleBodiesWithMedia(built).filter((r) => !r.media &&
    r.selectors.some((sel) => sel.indexOf('.lumen-moods-on.lumen-main') === 0));
  assert.deepEqual(outside, [], 'правило чипов для главной вышло из медиазапроса');
  const hero = decl(built, '.lumen-hero');
  assert.ok(hero.indexOf('position:absolute') !== -1 && hero.indexOf('overflow:hidden') !== -1,
    'кадр героя обязан оставаться вне потока — иначе его содержимое начнёт двигать ряды: ' + hero);
});


/* Правка пользователя 2026-09-17 (второй круг, п.2): «условно с середины
   картинки сделаем полупрозрачный, в середине 70 %, до 0 % в конце». */
/* Правка пользователя 2026-09-17 (третий круг): «фон хочется чтобы был
   больше прозрачного» — стопы ослаблены ещё раз, и нижний перестал быть
   сплошным. */
test('Task 36: кадр героя растворяется длинным градиентом, кромки глазом не найти', () => {
  const veil = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__veil--b');
  /* Пользователь 2026-09-18: «переход на фон подложки карточек более
     плавный». Пять стопов вместо трёх — затухание без места, на котором глаз
     находит границу вуали. Стоят они композитору столько же: градиент
     рисуется в слой один раз и при сжатии только едет вместе с кадром. */
  const stops = veil.match(/rgba\([^)]*\)\s[0-9]+%/g) || [];
  assert.ok(stops.length >= 8, 'нижняя вуаль обязана быть многостоповой: ' + veil);
  for (const need of [',.92) 10%', ',.6) 24%', ',.25) 42%', ',0) 62%']) {
    assert.ok(veil.indexOf(need) !== -1, 'нет стопа ' + need + ': ' + veil);
  }
  /* Нижний стоп сплошной намеренно: ниже кромки кадра картинки нет вовсе, и
     полупрозрачность там давала бы ступеньку на стыке с рядами. */
  assert.ok(/linear-gradient\((bottom|0deg),#/.test(veil), 'нижний стоп обязан быть сплошным: ' + veil);
  assert.ok(veil.indexOf('-webkit-linear-gradient(bottom,') !== -1, 'старым webkit-движкам нужен префиксный градиент');
  /* В старте заголовок первого ряда стоит на 58vh плюс воздух при кадре
     66.67vh — это около 8 % высоты кадра от его низа. Между стопами 0 % и
     10 % вуаль там держит примерно .93, и картинки под «Сейчас смотрят»
     практически не видно; ослабь второй стоп — и заголовок ляжет на кадр. */
  assert.ok(veil.indexOf(',.92) 10%') !== -1, 'на 10 % высоты кадра вуаль слабее .92 — заголовок ряда ляжет на картинку: ' + veil);
  const left = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__veil--l');
  assert.ok(left.indexOf(',.85) 0%') !== -1 && left.indexOf(',0) 65%') !== -1, 'левая вуаль: ' + left);
  /* Лишнего слоя ради затухания не завели: вуалей по-прежнему две. */
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-hero__veil--') !== -1).length, 2);
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
  assert.ok(line.indexOf('min-aspect-ratio:256/100') !== -1, 'порог при крупном кадре — 2.56:1: ' + line);
  assert.ok(line.indexOf('margin-top:0') !== -1, 'за порогом ряды не сдвигаются');
  /* Task 36: кадр за порогом не прячется целиком — чипы настроения живут
     ВНУТРИ его текстового блока, и display:none унёс бы их с экрана. Вместо
     этого герой превращается в полосу чипов под шапкой: кадр, вуали и весь
     остальной текст скрыты, текстовый блок возвращён в поток. */
  assert.ok(line.indexOf('.lumen-hero .lumen-hero__bg,.lumen-hero .lumen-hero__veil,') !== -1, 'кадр и вуали за порогом не скрыты: ' + line);
  assert.ok(line.indexOf('.lumen-hero .lumen-hero__logo,') !== -1, 'содержимое кадра за порогом не скрыто: ' + line);
  assert.ok(/\.lumen-hero[^{]*\.lumen-hero__moods\{[^}]*visibility:visible/.test(line), 'чипы за порогом пропадают: ' + line);
  assert.ok(line.indexOf('.lumen-moods-on.lumen-main .scroll.layer--wheight') !== -1, 'ряды не опущены под полосу чипов: ' + line);
  /* Сам кадр за порогом перестаёт быть кадром: ни высоты, ни сдвига. */
  assert.ok(line.indexOf('.lumen-main .lumen-hero,.lumen-main .lumen-hero.lumen-hero--compact{top:0;height:auto') !== -1, 'кадр за порогом сохранил высоту: ' + line);
  /* Ревью Task 36 (В2): сжатие снимается и с текстового блока, причём
     сжатым селектором тоже — у него на класс больше, а медиазапрос
     специфичности не добавляет. Без этого полоса чипов под шапкой уезжала бы
     вниз и мельчала при фокусе ниже первого ряда. */
  assert.ok(line.indexOf('.lumen-hero .lumen-hero__text,.lumen-hero.lumen-hero--compact .lumen-hero__text{position:static') !== -1,
    'сжатие текстового блока за порогом не снято: ' + line);

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
     мелочи в бюджете содержимого. */
  assert.ok(descr.indexOf('min-aspect-ratio:205/100') !== -1, 'порог описания: ' + descr);
  assert.ok(1920 / 1080 < 2.05, 'порог описания обязан оставаться выше 16:9');
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
  assert.equal(css.split('\n').filter((l) => l.indexOf('@media screen and (max-aspect-ratio:') === 0).length, 0,
    'порогов по max-aspect-ratio не осталось: бюджет сжатого состояния совпал с полным');
  /* При самом маленьком размере кадра мета не показывается вовсе — и там это
     не про состояние, а про размер: бюджета на неё нет ни в одном из двух. */
  const compactSize = withStorage({ lumen_hero_size: 'compact' }, (LC) => LC.buildCss());
  const metaOff = ruleBodies(compactSize).filter((r) => r.selectors.indexOf('.lumen-hero .lumen-hero__meta') !== -1 && r.decl.indexOf('display:none') !== -1);
  assert.equal(metaOff.length, 1, 'при компактном размере кадра мета обязана уходить целиком');
  /* И только при нём: у крупного и среднего такого правила нет. */
  for (const size of ['large', 'medium']) {
    const built = withStorage({ lumen_hero_size: size }, (LC) => LC.buildCss());
    const hidden = ruleBodies(built).filter((r) => r.selectors.indexOf('.lumen-hero .lumen-hero__meta') !== -1 && r.decl.indexOf('display:none') !== -1);
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
  const bg = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__bg');
  assert.ok(bg && bg.indexOf('opacity:0') !== -1, 'неактивный слой прозрачен');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__bg.is-active').indexOf('opacity:1') !== -1);

  /* Task 40: кроссфейд подчинён и тумблеру тяжёлых эффектов — два
     полноэкранных слоя одновременно на слабом ТВ стоят кадров. */
  const full = findDecl(css, (sel) => sel === 'body.lumen-fx-heavy .lumen-hero.lumen-motion-full .lumen-hero__bg');
  assert.ok(full && full.indexOf('transition:opacity .6s ease-in-out') !== -1, 'кроссфейд 600 мс: ' + full);
  assert.equal(findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__bg'), null,
    'без класса тяжёлых эффектов перехода нет вовсе');
  assert.equal(findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-lite .lumen-hero__bg'), null, 'в lite перехода нет вовсе — гасить нечего');
});

test('Task 36: кадр кадрируется по лицам (center 30%), а не по самому верху', () => {
  /* Пользователь на живом телевизоре 2026-09-18: «лица на постере не видны,
     просто края картинки». У постеров TMDB верхняя треть — почти всегда небо
     или потолок, и при cover с center top в высокий блок героя попадало
     именно оно. 30 % — линия глаз в типовой композиции кадра. */
  const bg = findDecl(css, (sel) => sel === '.lumen-hero .lumen-hero__bg');
  assert.ok(bg.indexOf('background-position:center 30%') !== -1, 'кадрирование героя: ' + bg);
  assert.equal(/background-position:center top/.test(bg), false, 'старое кадрирование по верху осталось: ' + bg);
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
  const blur = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__bg--blur');
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
  const swap = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-swapping');
  assert.equal(swap, 'opacity:0', 'старый текст обязан только гаснуть: ' + swap);
  const inCls = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__text.is-in');
  assert.ok(inCls && inCls.indexOf('lumen-hero-in .42s') !== -1, 'новый проявляется 420 мс');
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
  const logoMotion = findDecl(css, (sel) => sel === '.lumen-hero.lumen-motion-full .lumen-hero__logo');
  assert.ok(logoMotion && /transition:transform \.42s/.test(logoMotion), 'логотип едет масштабом: ' + logoMotion);
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
  assert.ok(descr.indexOf('max-width:39.45em') !== -1, '900 px FHD');

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
    sel.indexOf('.card') === -1 && sel.indexOf('.items-line') === -1 && sel.indexOf('.items-cards') === -1);
  assert.deepEqual(offenders, [], 'под .lumen-main только фон корня, область прокрутки, карточки рядов, метки, чипы настроения и сами ряды');
  assert.equal(ruleSelectors(css).filter((sel) => sel.indexOf('.lumen-main .scroll--horizontal') === 0).length, 0,
    'горизонтальные скроллы рядов не трогаем');
});

/* Долг фазы 2: ряды главной шли штатной карточкой Lampa 290×563, из-за чего
   герой был виден на ~36 % экрана вместо 58 % дизайна. */
/* Правка пользователя 2026-09-17 (третий круг): «фон определялся от
   картинки». Фон корня главной — тот же P.bg, что у всех подложек, поэтому
   подкраска доходит до него без отдельного механизма. */
test('правка: у корня главной есть фон, и он плавный только в полном режиме', () => {
  const main = findDecl(css, (sel) => sel === '.lumen-main');
  assert.equal(main, 'background-color:#0B0908', 'фон корня — цвет темы: ' + main);
  const smooth = findDecl(css, (sel) => sel === 'body.lumen-motion-full .lumen-main');
  assert.ok(/transition:background-color \.6s ease-in-out/.test(smooth), 'плавная смена цвета: ' + smooth);
  assert.ok(/-webkit-transition:background-color/.test(smooth), 'старым webkit-движкам нужен префикс: ' + smooth);
  /* В lite/off правила перехода нет вовсе — цвет меняется мгновенно. */
  assert.equal(ruleSelectors(css).filter((sel) => /lumen-motion-(lite|off) \.lumen-main$/.test(sel)).length, 0);
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
  assert.ok(title.indexOf('font-size:0.96em') !== -1, 'название 22 px (§0.4): ' + title);
  assert.ok(title.indexOf('white-space:nowrap') !== -1, 'одна строка: вторая отнимает у героя столько же экрана');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .card__age').indexOf('font-size:0.88em') !== -1, 'мета 20 px (§0.4)');
  assert.ok(findDecl(css, (sel) => sel === '.lumen-main .items-line__title').indexOf('font-size:1.23em') !== -1, 'заголовок ряда 28 px (§0.3)');
  /* Task 51: зазор между карточками — 40 физ. px той же сетки Apple. Штатный
     зазор Lampa вдвое уже (.mapping--line > * + *{margin-left:1em},
     vendor/lampa/css/app.css:14603-14605), и перебить его можно, не задевая
     чужие списки: классы .items-cards и .mapping--line Lampa вешает на ОДИН
     узел — тело горизонтального скролла ряда (app.min.js:52663). */
  assert.equal(findDecl(css, (sel) => sel === '.lumen-main .items-cards > * + *'), 'margin-left:1.75em', 'зазор между карточками ряда');
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
  const em = (decl, prop) => {
    const m = new RegExp('(?:^|;)' + prop + ':([\\d.]+)em(?:;|$)').exec(decl);
    assert.ok(m, prop + ' не найден в «' + decl + '»');
    return parseFloat(m[1]);
  };
  for (const key of ['small', 'normal', 'large', 'huge']) {
    const text = withStorage({ lumen_scale: key }, (LC) => LC.buildCss());
    const width = em(findDecl(text, (sel) => sel === '.lumen-main .card'), 'width');
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
    const gap = em(findDecl(text, (sel) => sel === '.lumen-main .items-line__head'), 'margin-bottom');
    assert.ok(gap >= grow, key + ': зазор ' + gap + 'em меньше роста постера ' + grow.toFixed(4) + 'em (масштаб фокуса ' + focus + ')');
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

test('Task 28: слой автотрейлера героя — под вуалями, ±10% по вертикали, проявление по is-live', () => {
  const decl = findDecl(css, (s) => s === '.lumen-hero .lumen-hero__trailer');
  assert.ok(decl, 'правила слоя трейлера героя нет вовсе');
  assert.ok(decl.indexOf('top:-10%') !== -1 && decl.indexOf('bottom:-10%') !== -1, 'запас прячет чёрные поля ролика: ' + decl);
  assert.ok(decl.indexOf('opacity:0') !== -1, 'до старта ролика слой невидим');
  assert.equal(/insets*:/.test(decl), false, 'inset запрещён планом');
  const live = findDecl(css, (s) => s === '.lumen-hero .lumen-hero__trailer.is-live');
  assert.ok(live.indexOf('opacity:1') !== -1);
  const frame = findDecl(css, (s) => s === '.lumen-hero.lumen-hero--trailer .lumen-hero__bg.is-active');
  assert.ok(frame.indexOf('opacity:.25') !== -1, 'под играющим роликом кадр гасится: ' + frame);
});

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
  assert.ok(meta.indexOf('font-size:1em') !== -1, 'мета — основной кегль: ' + meta);
  assert.ok(meta.indexOf('#A89A8A') !== -1, 'мета — muted: ' + meta);
});

test('Task 43: заголовки — один вес 700 и один кегль на состояние', () => {
  assert.equal(css.indexOf('font-weight:800'), -1, 'вес 800 снят везде');

  const cardTitle = findDecl(css, (sel) => sel === '.lumen-card .full-start-new__title');
  assert.ok(cardTitle.indexOf('font-size:3.2em') !== -1, 'название карточки 73px: ' + cardTitle);
  assert.ok(cardTitle.indexOf('font-weight:700') !== -1, cardTitle);
  assert.ok(cardTitle.indexOf('letter-spacing:-.02em') !== -1, cardTitle);

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
  assert.equal(need, 1.98, 'геометрия полосы статуса разошлась с бюджетом TEXT_STATUS');
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

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
  loadInto(LC, module, '30_css.js');
  return LC.buildCss();
}

const css = buildCss();

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
const ALLOWED_ROOTS = ['.lumen-card', '.lumen-backdrop', '.full-start__background', '.full-start-new', 'body'];

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
var OWN_NAMESPACE_ROOTS = ['.lumen-card', '.lumen-backdrop'];

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
  const v1 = /\.lumen-card \.full-start-new__left\{([^}]*)\}/.exec(css);
  assert.ok(v1, 'v1-правило (скрытие по умолчанию) не найдено');
  assert.ok(/display\s*:\s*none\s*!important/.test(v1[1]), 'v1-правило должно прятать .full-start-new__left');

  const poster = /\.lumen-card\.lumen-card--poster \.full-start-new__left\{([^}]*)\}/.exec(css);
  assert.ok(poster, 'правило .lumen-card--poster .full-start-new__left не найдено');
  assert.ok(/display\s*:\s*block\s*!important/.test(poster[1]), 'в режиме постера узел должен быть виден (!important — иначе не перебьёт v1)');
});

test('buildCss: .lumen-card--poster .full-start-new__poster оформлен как плейсхолдер §11 (radius/border/shadow)', () => {
  const m = /\.lumen-card\.lumen-card--poster \.full-start-new__poster\{([^}]*)\}/.exec(css);
  assert.ok(m, 'правило постера-плейсхолдера не найдено');
  assert.ok(m[1].indexOf('border-radius') !== -1);
  assert.ok(m[1].indexOf('box-shadow') !== -1);
});

test('buildCss: .lumen-bg--blur — размытый постер (blur 1.75em = design 40px÷22.811) только в lumen-motion-full', () => {
  const full = /\.lumen-backdrop\.lumen-motion-full\.lumen-bg--blur \.lumen-backdrop__img\{([^}]*)\}/.exec(css);
  assert.ok(full, 'правило блюра для lumen-motion-full не найдено');
  assert.ok(full[1].indexOf('blur(1.75em)') !== -1, 'ожидался filter:blur(1.75em) (дополнение к Task 5b: 40px÷22.811)');
});

test('buildCss: .lumen-bg--blur в lumen-motion-lite/off — без filter (дорого на ТВ, только затемнение)', () => {
  const m = /\.lumen-backdrop\.lumen-motion-lite\.lumen-bg--blur \.lumen-backdrop__img,\.lumen-backdrop\.lumen-motion-off\.lumen-bg--blur \.lumen-backdrop__img\{([^}]*)\}/.exec(css);
  assert.ok(m, 'правило lumen-motion-lite/off для .lumen-bg--blur не найдено');
  assert.equal(m[1].indexOf('filter'), -1, 'lite/off не должны переопределять/задавать filter (блюр остаётся только в lumen-motion-full)');
});

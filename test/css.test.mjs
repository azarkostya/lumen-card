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
const ALLOWED_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', '.full-start__background', '.full-start-new', 'body'];

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
var OWN_NAMESPACE_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal'];

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

test('buildCss: у сериала статус — карта в ленте рейтингов, каст в правой колонке скрыт', () => {
  const status = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--serial .full-start-new__rate-line .full-start__status');
  assert.ok(status, 'правило статуса в ленте для .lumen-card--serial не найдено');
  assert.ok(status.indexOf('border-radius:.67em') !== -1, 'радиус карты 12px, не пилюля');
  const cast = findDecl(css, (sel) => sel === '.lumen-card.lumen-card--serial .lumen-cast');
  assert.ok(cast && /display\s*:\s*none/.test(cast), 'каст сериала должен быть скрыт');
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

test('правка 2026-09-16: у .lumen-facts своя подложка, рамка и радиус; под рядом описания — локальная вуаль', () => {
  const panel = findDecl(css, (sel) => sel === '.lumen-descr-row .lumen-facts');
  assert.ok(panel, 'правило .lumen-facts не найдено');
  assert.ok(/background:rgba\(11,9,8,\.85\)/.test(panel), 'нет собственной подложки блока: ' + panel);
  assert.ok(panel.indexOf('border:.04em solid #2C231D') !== -1, 'нет тонкой рамки line');
  assert.ok(panel.indexOf('border-radius:.61em') !== -1, 'радиус как у соседних блоков');
  assert.ok(/(^|;)padding:/.test(panel), 'нет внутренних отступов — текст упрётся в рамку');
  assert.ok(panel.indexOf('box-sizing:border-box') !== -1, 'паддинг не должен раздувать min-width 450px');
  /* Блюр на ТВ дорог — подложка строго плоская. */
  assert.ok(panel.indexOf('backdrop-filter') === -1, 'backdrop-filter запрещён (дорог для ТВ)');

  const row = findDecl(css, (sel) => sel === '.lumen-descr-row');
  assert.ok(row && /background:rgba\(11,9,8,/.test(row), 'нет локальной вуали под рядом описания');
  /* Ревью (п.3): сплошная вуаль давала резкую кромку на светлом кадре —
     верхний край растушёван, но плоская заливка остаётся фолбэком. */
  assert.ok(/background:linear-gradient\(180deg,rgba\(11,9,8,0\)/.test(row), 'верхняя кромка вуали не растушёвана');
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
  assert.equal(findDecl(css, (sel) => sel.indexOf('.items-line__title') !== -1), null,
    'скрывать __title нельзя — у __head остаются свои отступы, получилась бы пустая полоса');
});

/* Ревью Task 5d (M2): после снятия display:-ms-grid раскладка на движках без
   grid держится ровно на порядке деклараций — display:flex должен идти ДО
   display:grid в том же правиле (последнее валидное значение выигрывает). */
test('buildCss: у обеих сеток display:flex объявлен раньше display:grid', () => {
  for (const sel of ['.lumen-card .lumen-content', '.lumen-descr-row .lumen-facts__grid']) {
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
    '.lumen-card.lumen-trailer-on .lumen-side',
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
/* блюр подложки под каждой из 5-7 кнопок оставался — и пересобирался     */
/* композитором ПОКАДРОВО, потому что фон под ним живой (кроссфейд 1.2 с, */
/* Ken Burns, играющий iframe трейлера). Ровно на тех ТВ, куда «Авто»     */
/* само ставит lite (Tizen/webOS, LC.motionModeFor).                      */
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
/* Проверка идёт от самого CSS и по ВСЕМ нашим корням (Minor 7): блюр на    */
/* слое фона или под body-корнем тест не должен молча пропустить.           */
/* -------------------------------------------------------------------- */

/* Тот же список корней, что у ALLOWED_ROOTS выше. */
const MOTION_ROOTS = ['.lumen-card', '.lumen-backdrop', '.lumen-descr-row', '.lumen-review-modal', 'body'];

function rootOf(sel) {
  for (const root of MOTION_ROOTS) if (startsWithRoot(sel, root)) return root;
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

/* Фокус «Стоп» красится акцентом, и уплотнённая подложка выше не должна его
   перебить: у неё 3 класса специфичности, ровно как у v1-правила
   .lumen-card .lumen-stop.focus, а объявлена она ПОЗЖЕ — то есть выиграла бы
   по порядку. Акцент возвращает правило режима с 4 классами. */
test('I1: уплотнённая подложка «Стоп» не перекрашивает кнопку в фокусе (акцент остаётся)', () => {
  for (const mode of ['lite', 'off']) {
    const focus = findDecl(css, (s) => s === '.lumen-card.lumen-motion-' + mode + ' .lumen-stop.focus');
    assert.ok(focus, 'правило фокуса «Стоп» для ' + mode + ' не найдено');
    assert.ok(/background:#[0-9A-Fa-f]{6}/.test(focus),
      mode + ': фокусная кнопка обязана заново объявить акцентную заливку, иначе её перебьёт уплотнение: ' + focus);
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

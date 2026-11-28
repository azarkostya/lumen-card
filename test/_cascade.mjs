import { readFileSync, readdirSync } from 'node:fs';

/* Каскад собранной таблицы для тестов: сборка LC.buildCss в нужном режиме,
   разбор на объявления и минимальный «вычисленный стиль» узла по цепочке
   предков — без браузера.

   Модель селекторов — та, на которой написана таблица: компаунды из тега,
   классов, id и :not(простой), комбинаторы «пробел» и «>», псевдоэлемент
   :before/:after у последнего звена. Атрибуты и прочие псевдоклассы узлу
   цепочки не задаются, и правило с ними к нему не применяется. Правила
   внутри @media/@supports вычисленный стиль не учитывает: условий экрана у
   модели нет (их держит cssDecls — wrap у каждого объявления). */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const FRAME_TOKENS = { color: '#FF7A00', light: '#FFE7CC', glow: 'rgba(255,122,0,0.35)', onac: '#1A0B00' };
const TINT = '#2A1A10';
const ROWS = '#30200F';
const V2 = readdirSync(new URL('../src/', import.meta.url)).filter((f) => /^31_v2_.*\.js$/.test(f)).sort();

/* Сборка таблицы с настройками storage и цветом кадра FRAME_TOKENS (тот же
   приём, что в test/apple_neutral.test.mjs): { LC, full, base, deep }. */
export function buildSheets(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (n, d) => (n in storage ? storage[n] : d), field: (n) => storage[n] } };
  globalThis.window = { Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    const files = ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js'].concat(V2, ['30_css.js', '65_torrents.js']);
    for (const name of files) new Function('LC', 'module', readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'))(LC, module);
    LC.accent = { current: () => FRAME_TOKENS, tint: () => TINT, rowsTint: () => ROWS };
    LC.color = { rowsTint: () => ROWS };
    return { LC, full: LC.buildCss(), base: LC.buildCss('base'), deep: LC.buildCss('deep'), accent: FRAME_TOKENS.color };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

/* Разбиение на верхнем уровне: «{…}» и «;» вне кавычек и скобок. */
function splitTop(text) {
  const out = [];
  let depth = 0, quote = '', paren = 0, start = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (paren) continue;
    else if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (!depth) { out.push(text.slice(start, i + 1).trim()); start = i + 1; } }
    else if (ch === ';' && !depth) { out.push(text.slice(start, i + 1).trim()); start = i + 1; }
  }
  if (text.slice(start).trim()) out.push(text.slice(start).trim());
  return out.filter(Boolean);
}
function declsOf(body) {
  const out = [];
  let quote = '', paren = 0, start = 0;
  for (let i = 0; i <= body.length; i++) {
    const ch = i < body.length ? body[i] : ';';
    if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = ''; continue; }
    if (ch === '"' || ch === "'") quote = ch;
    else if (ch === '(') paren++;
    else if (ch === ')') paren--;
    else if (ch === ';' && !paren) { const d = body.slice(start, i).trim(); if (d) out.push(d); start = i + 1; }
  }
  return out;
}

/* Список селекторов через запятую (запятые в скобках :not(…) не делят). */
export function selectorList(sel) {
  const out = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= sel.length; i++) {
    const ch = i < sel.length ? sel[i] : ',';
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && !depth) { const one = sel.slice(start, i).trim(); if (one) out.push(one); start = i + 1; }
  }
  return out;
}

/* Объявления таблицы по порядку: { wrap, sel, prop, value, important, key }.
   wrap — цепочка @media/@supports; «сырые» блоки (@keyframes, @font-face)
   идут с пустым sel. */
export function cssDecls(text, wrap = '') {
  const out = [];
  for (const block of splitTop(text)) {
    const open = block.indexOf('{');
    if (open < 0) { out.push({ wrap, sel: '', decl: block, key: wrap + '#' + block }); continue; }
    const pre = block.slice(0, open).trim();
    const body = block.slice(open + 1, -1);
    if (/^@(media|supports)/.test(pre)) { out.push(...cssDecls(body, wrap + pre + '>')); continue; }
    if (pre[0] === '@') { out.push({ wrap, sel: '', decl: block, key: wrap + '#' + block }); continue; }
    for (const decl of declsOf(body)) {
      const colon = decl.indexOf(':');
      const raw = decl.slice(colon + 1).trim();
      const important = /!\s*important\s*$/i.test(raw);
      out.push({
        wrap, sel: pre, decl,
        prop: decl.slice(0, colon).trim().toLowerCase(),
        value: raw.replace(/\s*!\s*important\s*$/i, ''),
        important,
        key: wrap + pre + '{' + decl
      });
    }
  }
  return out;
}

/* Специфичность [a, b, c]; :not(x) — по своему аргументу. */
export function specificity(sel) {
  let a = 0, b = 0, c = 0;
  let s = sel.replace(/:not\(((?:[^()]|\([^()]*\))*)\)/g, (m, inner) => {
    let best = [0, 0, 0];
    for (const x of selectorList(inner)) { const r = specificity(x); if (cmpSpec(r, best) > 0) best = r; }
    a += best[0]; b += best[1]; c += best[2];
    return ' ';
  });
  s = s.replace(/\[[^\]]*\]/g, () => { b++; return ' '; });
  s = s.replace(/::[-a-zA-Z]+|:(before|after|first-line|first-letter)\b/g, () => { c++; return ' '; });
  s = s.replace(/:[-a-zA-Z]+(\([^()]*\))?/g, () => { b++; return ' '; });
  s = s.replace(/#[-\w]+/g, () => { a++; return ' '; });
  s = s.replace(/\.[-\w]+/g, () => { b++; return ' '; });
  for (const r of s.split(/[\s>+~]+/)) if (/^[a-zA-Z]/.test(r)) c++;
  return [a, b, c];
}
export function cmpSpec(x, y) {
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
}

/* Звенья селектора: [{ comb, tag, ids, classes, not, pe, bad }] слева
   направо; comb — комбинатор ПЕРЕД звеном (' ' или '>'). */
export function parseSelector(one) {
  const steps = [];
  let depth = 0, buf = '', comb = ' ';
  for (let i = 0; i <= one.length; i++) {
    const ch = i < one.length ? one[i] : ' ';
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (!depth && (ch === ' ' || ch === '>' || ch === '+' || ch === '~')) {
      if (buf) { steps.push(parseCompound(buf, comb)); buf = ''; comb = ' '; }
      if (ch !== ' ') comb = ch;
      continue;
    }
    buf += ch;
  }
  return steps;
}
function parseCompound(text, comb) {
  const step = { comb, tag: null, ids: [], classes: [], not: [], pe: '', bad: false };
  let s = text.replace(/:not\(((?:[^()]|\([^()]*\))*)\)/g, (m, inner) => {
    step.not.push(selectorList(inner).map((x) => parseCompound(x, ' ')));
    return '';
  });
  s = s.replace(/::?(before|after)\b/g, (m, pe) => { step.pe = pe; return ''; });
  if (/[\[:]/.test(s)) step.bad = true;
  const tag = /^([a-zA-Z][-\w]*|\*)/.exec(s);
  if (tag) { if (tag[1] !== '*') step.tag = tag[1].toLowerCase(); s = s.slice(tag[0].length); }
  s.replace(/([.#])([-\w]+)/g, (m, kind, name) => { (kind === '.' ? step.classes : step.ids).push(name); return ''; });
  return step;
}

/* Узел цепочки: 'div.card.focus' → { tag, classes }. */
export function node(text) {
  const tag = /^[a-zA-Z][-\w]*/.exec(text);
  return { tag: tag ? tag[0].toLowerCase() : 'div', classes: (text.match(/\.[-\w]+/g) || []).map((c) => c.slice(1)) };
}
function matchCompound(el, step) {
  if (step.bad) return false;
  if (step.tag && step.tag !== el.tag) return false;
  if (step.ids.length) return false;
  for (const c of step.classes) if (el.classes.indexOf(c) === -1) return false;
  for (const alts of step.not) for (const alt of alts) if (matchCompound(el, alt)) return false;
  return true;
}
/* Совпадает ли селектор с последним узлом path (массив узлов от корня). */
export function matches(one, path, pe = '') {
  const steps = parseSelector(one);
  if (!steps.length || steps[steps.length - 1].pe !== pe) return false;
  for (let i = 0; i < steps.length - 1; i++) if (steps[i].pe) return false;
  function at(si, ni) {
    if (!matchCompound(path[ni], steps[si])) return false;
    if (si === 0) return true;
    const comb = steps[si].comb;
    if (comb === '>') return ni > 0 && at(si - 1, ni - 1);
    if (comb !== ' ') return false;
    for (let k = ni - 1; k >= 0; k--) if (at(si - 1, k)) return true;
    return false;
  }
  return at(steps.length - 1, path.length - 1);
}

/* Вычисленное значение свойства prop у последнего узла path (строки
   'div.card.focus' от корня) по таблице text: важность, специфичность,
   порядок. Только правила верхнего уровня (без @media). null — не задано. */
export function computed(text, path, prop, pe = '') {
  const els = path.map(node);
  let best = null;
  const list = Array.isArray(text) ? text : cssDecls(text);
  for (let i = 0; i < list.length; i++) {
    const d = list[i];
    if (!d.sel || d.wrap || d.prop !== prop) continue;
    for (const one of selectorList(d.sel)) {
      if (!matches(one, els, pe)) continue;
      const cand = { value: d.value, important: d.important, spec: specificity(one), order: i, sel: one };
      if (!best || (cand.important !== best.important ? cand.important : cmpSpec(cand.spec, best.spec) >= 0)) best = cand;
    }
  }
  return best;
}

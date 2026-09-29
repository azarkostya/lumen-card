// scripts/es5check.mjs — ES5-линт сборки на базе acorn: без аргумента —
// раскладка src/ и dist/lumen_card.js (см. main), с аргументом — один файл.
//
// Два независимых прохода:
//  1) acorn.parse(src, { ecmaVersion: 5 }) — если в файле есть синтаксис ES2015+
//     (стрелки, let/const, шаблоны, классы, spread, деструктуризация, дефолтные
//     параметры, короткие методы/свойства, вычисляемые ключи, ??, ?., **,
//     генераторы, catch {}, числовые разделители, флаг /u, import, висящая
//     запятая в вызове и т.п.) — парсер сам бросает SyntaxError.
//  2) Скан токенов (только name/keyword/punctuator — строки, шаблоны, регэкспы
//     и комментарии в сравнение не попадают, т.к. не запрошены через onComment
//     и отфильтрованы по типу) на использование запрещённых ES2015+ API при
//     полностью ES5-валидном синтаксисе (Object.assign, Promise и т.д.).
//
// CLI — тонкая обёртка над check(src): печатает находки и код возврата.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from './lib/acorn.mjs';
import { compose } from './lib/bundle.mjs';

/* ---------------------------------------------------------------------- */
/* Правила по последовательностям токенов.                                 */
/* ---------------------------------------------------------------------- */

function eq(str) {
  return function (text) { return text === str; };
}

function oneOf(list) {
  var set = {};
  for (var i = 0; i < list.length; i++) set[list[i]] = true;
  return function (text) { return Object.prototype.hasOwnProperty.call(set, text); };
}

function dotJoin(toks) {
  var s = '';
  for (var i = 0; i < toks.length; i++) s += toks[i].text;
  return s;
}

function spaceJoin(toks) {
  var arr = [];
  for (var i = 0; i < toks.length; i++) arr.push(toks[i].text);
  return arr.join(' ');
}

var SEQ_RULES = [
  { seq: [eq('Object'), eq('.'), oneOf(['values', 'entries', 'fromEntries', 'is', 'assign', 'getOwnPropertySymbols'])], format: dotJoin },
  { seq: [eq('Number'), eq('.'), oneOf(['isNaN', 'isFinite', 'isInteger', 'parseFloat', 'parseInt'])], format: dotJoin },
  { seq: [eq('Math'), eq('.'), oneOf(['trunc', 'sign', 'log2', 'log10', 'hypot', 'cbrt'])], format: dotJoin },
  { seq: [eq('Array'), eq('.'), oneOf(['from', 'of'])], format: dotJoin },
  { seq: [eq('new'), oneOf(['Map', 'Set', 'WeakMap', 'WeakSet', 'Proxy', 'URL', 'URLSearchParams'])], format: spaceJoin },
  { seq: [eq('.'), oneOf(['includes', 'startsWith', 'endsWith', 'repeat', 'padStart', 'padEnd', 'replaceAll', 'trimStart', 'trimEnd', 'fill', 'flat', 'flatMap', 'at', 'findIndex', 'findLast', 'findLastIndex', 'copyWithin', 'finally']), eq('(')], format: dotJoin },
  { seq: [eq('.'), eq('find'), eq('('), eq('function')], format: dotJoin }
];

/* BARE_NAMES: глобальные Web API, недоступные в ES5-средах (старые ТВ-браузеры).
   Запрет — на токен типа `name` (идентификатор) с этим значением, не предшествующий `.`
   (через точку доступ — не прямое использование глобала). Это ловит как вызов fetch(url),
   так и ключ объекта { fetch: fn } — последнее ложно-положительно для наших нужд.
   Обходной приём для ключей: api['fetch'] = fn (строковый токен, не name-токен). */
var BARE_NAMES = oneOf(['Promise', 'Symbol', 'Reflect', 'fetch', 'globalThis', 'requestIdleCallback']);

/* Типы токенов, которые не участвуют в сравнении: содержимое строк, шаблонов,
   регэкспов и чисел не должно матчиться как имя/пунктуация. Комментарии в
   поток токенов acorn и так не попадают (onComment не запрошен). */
var LITERAL_LABELS = { string: true, template: true, regexp: true, num: true, eof: true, privateId: true };

function normalizeTokens(tokens) {
  var out = [];
  for (var i = 0; i < tokens.length; i++) {
    var t = tokens[i];
    var label = t.type.label;
    if (LITERAL_LABELS[label]) continue;
    var isName = label === 'name';
    var text = isName ? t.value : (t.type.keyword || label);
    out.push({ text: text, line: t.loc.start.line, isName: isName });
  }
  return out;
}

function scanTokens(tokens) {
  var findings = [];
  var norm = normalizeTokens(tokens);

  for (var r = 0; r < SEQ_RULES.length; r++) {
    var rule = SEQ_RULES[r];
    var len = rule.seq.length;
    for (var p = 0; p + len <= norm.length; p++) {
      var ok = true;
      for (var k = 0; k < len; k++) {
        if (!rule.seq[k](norm[p + k].text)) { ok = false; break; }
      }
      if (ok) {
        var slice = norm.slice(p, p + len);
        findings.push({ rule: rule.format(slice), line: norm[p].line });
      }
    }
  }

  for (var n = 0; n < norm.length; n++) {
    if (norm[n].isName && BARE_NAMES(norm[n].text)) {
      if (n > 0 && norm[n - 1].text === '.') continue; // это свойство чужого объекта, не голое имя
      findings.push({ rule: norm[n].text, line: norm[n].line });
    }
  }

  return findings;
}

/* ---------------------------------------------------------------------- */
/* check(src) -> [{ rule, line, column? }]                                 */
/* column присутствует только у находок SyntaxError.                       */
/* ---------------------------------------------------------------------- */

function cleanMessage(msg) {
  return ('' + msg).replace(/\s*\(\d+:\d+\)\s*$/, '');
}

export function check(src) {
  var findings = [];
  var tokens = [];
  try {
    acorn.parse(src, { ecmaVersion: 5, sourceType: 'script', locations: true, onToken: tokens });
  } catch (e) {
    var line = (e && e.loc && e.loc.line) || 1;
    var column = (e && e.loc && (e.loc.column + 1)) || 1;
    findings.push({ rule: 'SyntaxError: ' + cleanMessage(e && e.message), line: line, column: column });
  }
  findings = findings.concat(scanTokens(tokens));
  return findings;
}

/* ---------------------------------------------------------------------- */
/* Координаты исходника: по маркеру "/* ---- NN_x.js ---- * /" (M4).       */
/* ---------------------------------------------------------------------- */

var MARKER_RE = /^\/\* ---- (\S+) ---- \*\/$/;

export function toSourceLocation(src, globalLine) {
  var lines = src.split('\n');
  var file = null;
  var start = 0;
  for (var i = 0; i < globalLine && i < lines.length; i++) {
    var m = MARKER_RE.exec(lines[i]);
    if (m) { file = m[1]; start = i + 1; }
  }
  if (!file) return { file: '(banner)', line: globalLine };
  return { file: file, line: globalLine - start };
}

/* ---------------------------------------------------------------------- */
/* CLI.                                                                     */
/* ---------------------------------------------------------------------- */

function report(src, findings) {
  for (var i = 0; i < findings.length; i++) {
    var f = findings[i];
    var loc = toSourceLocation(src, f.line);
    if (f.column !== undefined) {
      console.log('SyntaxError ' + loc.file + ':' + loc.line + ':' + f.column + ' ' + f.rule.replace(/^SyntaxError:\s*/, ''));
    } else {
      console.log(f.rule + ' at ' + loc.file + ':' + loc.line);
    }
  }
}

/* Без аргумента проверяются оба: раскладка src/ (с 1.1 dist сжат и номера
   его строк уже не совпадают со строками src/, поэтому точные координаты
   даёт раскладка) и сам dist/lumen_card.js — то, что уезжает на ТВ. Поток
   токенов у них один (самопроверка build.mjs), так что находки dist сверх
   находок раскладки значат несобранный dist. С аргументом — один файл;
   координаты по маркерам модулей (у сжатого файла строка — строка dist). */
function main() {
  var file = process.argv[2];
  var total = 0;
  if (file) {
    var one = readFileSync(file, 'utf8');
    var found = check(one);
    report(one, found);
    total = found.length;
  } else {
    var root = fileURLToPath(new URL('..', import.meta.url));
    var raw = compose(join(root, 'src')).raw;
    var inSrc = check(raw);
    report(raw, inSrc);
    var dist = readFileSync(join(root, 'dist', 'lumen_card.js'), 'utf8');
    var inDist = check(dist);
    if (inDist.length !== inSrc.length) {
      console.log('dist/lumen_card.js: ' + inDist.length + ' findings против ' + inSrc.length + ' в src/ — пересоберите (node scripts/build.mjs)');
      report(dist, inDist);
    }
    total = Math.max(inSrc.length, inDist.length);
  }

  if (total) {
    console.log('ES5 check: ' + total + ' findings');
    process.exit(1);
  } else {
    console.log('ES5 check: ok');
  }
}

var isMain = false;
try { isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]; } catch (e) { }
if (isMain) main();

// scripts/build.mjs — конкатенация src/*.js по имени в dist/lumen_card.js.
//
// Проверки перед записью:
//  - каждый файл src/*.js должен иметь префикс NN_ (число из двух цифр);
//  - обязаны присутствовать 00_head.js и 99_tail.js;
//  - верхнеуровневые имена (var/function на отступе ровно 2 пробела — это
//    уровень тела общей IIFE) не должны повторяться между разными файлами.
//
// Запись атомарная: пишем во временный dist/lumen_card.js.tmp, гоняем на нём
// node --check, и только при успехе переименовываем в dist/lumen_card.js —
// битая сборка никогда не перезатирает рабочий dist.
//
// node scripts/build.mjs --check — ничего не пишет, только сверяет то, что
// собралось бы, с уже лежащим dist/lumen_card.js (для CI/pre-commit).
//
// Сборка вычищает из dist комментарии и ведущие отступы: на слабом ТВ-браузере
// это ~150 КБ лишнего разбора (комментарии на кириллице — по два байта на
// символ). Исходники в src/ остаются как есть, меняется только выходной файл.
// Границы комментариев берутся у acorn (onComment), а не у регулярок: в коде
// есть строковые литералы с «/*» (заголовки CSS в 65_torrents.js), data-URI
// с «//» и регэкспы — регулярка порезала бы их.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from './lib/acorn.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const distFile = join(root, 'dist', 'lumen_card.js');
const checkOnly = process.argv.includes('--check');

const entries = readdirSync(srcDir);
const misnamed = entries.filter(f => f.endsWith('.js') && !/^\d\d_.*\.js$/.test(f));
if (misnamed.length) {
  console.error('Файлы в src/ без префикса NN_: ' + misnamed.join(', '));
  process.exit(1);
}

const files = entries.filter(f => /^\d\d_.*\.js$/.test(f)).sort();
if (!files.includes('00_head.js')) {
  console.error('В src/ отсутствует 00_head.js');
  process.exit(1);
}
if (!files.includes('99_tail.js')) {
  console.error('В src/ отсутствует 99_tail.js');
  process.exit(1);
}

// Дубли верхнеуровневых имён между файлами (общая IIFE — одна область видимости).
const TOPLEVEL_RE = /^ {2}(?:function|var)\s+([A-Za-z_$][\w$]*)/gm;
const owner = new Map();
for (const f of files) {
  const text = readFileSync(join(srcDir, f), 'utf8');
  let m;
  TOPLEVEL_RE.lastIndex = 0;
  while ((m = TOPLEVEL_RE.exec(text))) {
    const name = m[1];
    const prevFile = owner.get(name);
    if (prevFile && prevFile !== f) {
      console.error(`Duplicate top-level name "${name}" in ${prevFile} and ${f}`);
      process.exit(1);
    }
    owner.set(name, f);
  }
}

// В dist остаются только три вида комментариев: баннер первой строкой, шапка
// плагина из 00_head.js (открывается «/*!» — общая конвенция «не вырезать»)
// и маркеры файлов, по которым es5check восстанавливает координаты в src/.
const MARKER_TEXT_RE = /^ ---- \S+ ---- $/;

function keepComment(c) {
  if (!c.block) return c.start === 0;
  if (c.text.charAt(0) === '!') return true;
  return MARKER_TEXT_RE.test(c.text);
}

function parse(src, options) {
  return acorn.parse(src, Object.assign({ ecmaVersion: 5, sourceType: 'script', locations: true }, options));
}

// Вырезаем комментарии с конца, чтобы не пересчитывать смещения. Пустая строка
// вместо комментария годится не всегда: «a/*c*/b» склеилось бы в «ab», поэтому
// однострочный блочный заменяется пробелом, а многострочный — переводом строки
// (перевод строки внутри комментария влияет на расстановку «;» через ASI).
function stripComments(src) {
  const comments = [];
  parse(src, { onComment: (block, text, start, end) => comments.push({ block, text, start, end }) });
  let out = src;
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (keepComment(c)) continue;
    const text = src.slice(c.start, c.end);
    const repl = text.indexOf('\n') >= 0 ? '\n' : (c.block ? ' ' : '');
    out = out.slice(0, c.start) + repl + out.slice(c.end);
  }
  return out;
}

// Срез ведущих/хвостовых пробелов и пустых строк. Строки, которые пересекает
// многострочный токен (строковый литерал с продолжением) или уцелевший
// комментарий, не трогаем — там пробелы значимы. Хотя бы один перевод строки
// между соседними токенами всегда остаётся, так что ASI не меняется.
function squeeze(src) {
  const tokens = [];
  const spans = [];
  parse(src, { onToken: tokens, onComment: (block, text, start, end, startLoc, endLoc) => spans.push({ startLoc, endLoc }) });
  for (const t of tokens) spans.push({ startLoc: t.loc.start, endLoc: t.loc.end });
  const verbatim = new Set();
  for (const s of spans) {
    if (s.startLoc.line === s.endLoc.line) continue;
    for (let l = s.startLoc.line; l <= s.endLoc.line; l++) verbatim.add(l);
  }
  const lines = src.split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (verbatim.has(i + 1)) { out.push(lines[i]); continue; }
    const line = lines[i].replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
    if (line !== '') out.push(line);
  }
  return out.join('\n') + '\n';
}

// Версия для баннера — из LC.VERSION в 00_head.js (без даты: воспроизводимая сборка).
const headText = readFileSync(join(srcDir, '00_head.js'), 'utf8');
const versionMatch = headText.match(/LC\.VERSION\s*=\s*'([^']+)'/);
const version = versionMatch ? versionMatch[1] : '0.0.0';
const banner = `// Lumen Card for Lampa v${version}\n`;
const raw = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');

let out;
try {
  out = squeeze(stripComments(raw));
} catch (e) {
  // SyntaxError из acorn: собранный текст не разбирается, писать нечего.
  console.error('build failed: не удалось разобрать сборку — ' + (e && e.message ? e.message : e));
  process.exit(1);
}

if (checkOnly) {
  const current = existsSync(distFile) ? readFileSync(distFile, 'utf8') : null;
  if (current !== out) {
    console.error('dist is stale, run node scripts/build.mjs');
    process.exit(1);
  }
  console.log('dist is up to date');
  process.exit(0);
}

mkdirSync(join(root, 'dist'), { recursive: true });
// имя временного файла должно оканчиваться на .js, иначе node --check не
// определит формат модуля (ERR_UNKNOWN_FILE_EXTENSION для голого .tmp)
const tmp = join(root, 'dist', 'lumen_card.tmp.js');
try {
  writeFileSync(tmp, out);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
  renameSync(tmp, distFile);
  console.log(`built ${distFile} (${out.length} bytes из ${raw.length}, ${files.length} modules)`);
} catch (e) {
  console.error('build failed: ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
} finally {
  if (existsSync(tmp)) rmSync(tmp, { force: true });
}

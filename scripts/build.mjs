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
// Вырезанием занимается scripts/lib/strip.mjs — по разбору acorn, а не
// регулярками: в коде есть строковые литералы с «/*» (заголовки CSS в
// 65_torrents.js), data-URI с «//» и регэкспы. Нумерация строк при этом
// сохраняется (комментарий заменяется на столько же пустых строк), поэтому
// es5check по маркерам файлов показывает настоящие координаты в src/.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments, squeeze, keepComment } from './lib/strip.mjs';
import { toSourceLocation } from './es5check.mjs';

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

// Версия для баннера — из LC.VERSION в 00_head.js (без даты: воспроизводимая сборка).
const headText = readFileSync(join(srcDir, '00_head.js'), 'utf8');
const versionMatch = headText.match(/LC\.VERSION\s*=\s*'([^']+)'/);
const version = versionMatch ? versionMatch[1] : '0.0.0';
const banner = `// Lumen Card for Lampa v${version}\n`;
const raw = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');

// Белый список комментариев: маркеры своих же модулей и шапка плагина — только
// до начала второго модуля, чтобы «/*!» где-нибудь в середине кода сборку не
// пережил.
const names = new Set(files);
const secondMarker = files.length > 1 ? raw.indexOf(`/* ---- ${files[1]} ---- */`) : -1;
const headEnd = secondMarker < 0 ? raw.length : secondMarker;

let out;
try {
  out = squeeze(stripComments(raw, (c, s) => keepComment(c, s, { names, headEnd })));
} catch (e) {
  // SyntaxError из acorn (разбор идёт с ecmaVersion: 5, так что сюда попадает и
  // ES2015+ синтаксис — сборка бракует его, не дожидаясь es5check). Координату
  // acorn даёт в раскладке сборки, переводим её в файл src/.
  const line = e && e.loc && e.loc.line;
  const loc = line ? toSourceLocation(raw, line) : null;
  const where = loc ? ` ${loc.file}:${loc.line}:${(e.loc.column || 0) + 1}` : '';
  const msg = ('' + (e && e.message ? e.message : e)).replace(/\s*\(\d+:\d+\)\s*$/, '');
  console.error(`build failed:${where} — ${msg}`);
  process.exit(1);
}

if (checkOnly) {
  const current = existsSync(distFile) ? readFileSync(distFile, 'utf8') : null;
  if (current !== out) {
    console.error('dist is stale, run node scripts/build.mjs');
    process.exit(1);
  }
  console.log('dist is up to date');
  // Проверяем синхронность manifest.json с DEFAULT (I8).
  execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'manifest.mjs'), '--check'], { stdio: 'inherit' });
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
  // Синхронизируем manifest.json с LC.manifest.DEFAULT из 42_manifest.js (I7).
  execFileSync(process.execPath, [join(dirname(fileURLToPath(import.meta.url)), 'manifest.mjs')], { stdio: 'inherit' });
} catch (e) {
  console.error('build failed: ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
} finally {
  if (existsSync(tmp)) rmSync(tmp, { force: true });
}

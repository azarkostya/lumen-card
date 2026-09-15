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
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

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
const out = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');

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
  console.log(`built ${distFile} (${out.length} bytes, ${files.length} modules)`);
} catch (e) {
  console.error('build failed: ' + (e && e.message ? e.message : e));
  process.exitCode = 1;
} finally {
  if (existsSync(tmp)) rmSync(tmp, { force: true });
}

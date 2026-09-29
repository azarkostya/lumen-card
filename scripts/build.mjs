// scripts/build.mjs — сборка src/*.js по имени в dist/lumen_card.js.
//
// Проверки перед записью:
//  - каждый файл src/*.js должен иметь префикс NN_ (число из двух цифр);
//  - обязаны присутствовать 00_head.js и 99_tail.js;
//  - верхнеуровневые имена (var/function на отступе ровно 2 пробела — это
//    уровень тела общей IIFE) не должны повторяться между разными файлами.
//
// Сборка сжата (scripts/lib/minify.mjs): без комментариев, отступов, пустых
// строк и лишних пробелов между токенами; переводы строк между операторами
// остаются (ASI), имена и литералы не меняются. Исходники с комментариями —
// в src/. Самопроверка: поток токенов сжатой сборки обязан совпасть с
// потоком токенов раскладки src/ (scripts/lib/bundle.mjs) один в один,
// вместе с признаком «перед токеном был перевод строки»; иначе сборка падает.
//
// Метка сборки: первые 10 hex sha256 от dist/lumen_card.js вписываются в
// загрузчик lumen.js (var BUILD = '…'), и он просит сборку по адресу
// dist/lumen_card.js?v=<метка>. Новая сборка — новый адрес (обновление
// доезжает с первым же свежим lumen.js), та же сборка — тот же адрес (кэш
// браузера и кэш компиляции движка живут между запусками Lampa).
//
// Запись атомарная: пишем во временный dist/lumen_card.tmp.js, гоняем на нём
// node --check, и только при успехе переименовываем в dist/lumen_card.js —
// битая сборка никогда не перезатирает рабочий dist.
//
// node scripts/build.mjs --check — ничего не пишет, только сверяет то, что
// собралось бы, с dist/lumen_card.js, метку в lumen.js и manifest.json.
// node scripts/build.mjs --pretty — пишет ещё dist/lumen_card.pretty.js: без
// комментариев, но с нумерацией строк src/ (строка K модуля — K-я после
// маркера), для отладки на стенде. Файл в .gitignore, в выпуск не идёт.
import { readdirSync, readFileSync, writeFileSync, mkdirSync, renameSync, rmSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments, squeeze } from './lib/strip.mjs';
import { minify, tokenStream, firstMismatch } from './lib/minify.mjs';
import { compose } from './lib/bundle.mjs';
import { toSourceLocation } from './es5check.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const distFile = join(root, 'dist', 'lumen_card.js');
const loaderFile = join(root, 'lumen.js');

/* Метка сборки для адреса в lumen.js. */
export function buildStamp(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 10);
}

/* Загрузчик с вписанной меткой; null — в нём нет строки var BUILD = '…';. */
const BUILD_RE = /var BUILD = '[0-9a-f]*';/;
export function stampLoader(loader, stamp) {
  if (!BUILD_RE.test(loader)) return null;
  return loader.replace(BUILD_RE, "var BUILD = '" + stamp + "';");
}

function fail(msg) {
  console.error(msg);
  process.exit(1);
}

function main() {
  const checkOnly = process.argv.includes('--check');
  const pretty = process.argv.includes('--pretty');

  const entries = readdirSync(srcDir);
  const misnamed = entries.filter(f => f.endsWith('.js') && !/^\d\d_.*\.js$/.test(f));
  if (misnamed.length) fail('Файлы в src/ без префикса NN_: ' + misnamed.join(', '));

  const files = entries.filter(f => /^\d\d_.*\.js$/.test(f)).sort();
  if (!files.includes('00_head.js')) fail('В src/ отсутствует 00_head.js');
  if (!files.includes('99_tail.js')) fail('В src/ отсутствует 99_tail.js');

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
      if (prevFile && prevFile !== f) fail(`Duplicate top-level name "${name}" in ${prevFile} and ${f}`);
      owner.set(name, f);
    }
  }

  const { raw, keep } = compose(srcDir, files);

  let out;
  try {
    out = minify(raw, keep);
  } catch (e) {
    // SyntaxError из acorn (разбор идёт с ecmaVersion: 5, так что сюда попадает и
    // ES2015+ синтаксис, и бэктик — сборка бракует его, не дожидаясь es5check).
    // Координату acorn даёт в раскладке сборки, переводим её в файл src/.
    const line = e && e.loc && e.loc.line;
    const loc = line ? toSourceLocation(raw, line) : null;
    const where = loc ? ` ${loc.file}:${loc.line}:${(e.loc.column || 0) + 1}` : '';
    const msg = ('' + (e && e.message ? e.message : e)).replace(/\s*\(\d+:\d+\)\s*$/, '');
    fail(`build failed:${where} — ${msg}`);
  }

  // Самопроверка сжатия: те же токены в том же порядке, те же переводы строк.
  const diff = firstMismatch(tokenStream(raw), tokenStream(out));
  if (diff) fail('build failed: сжатие изменило код, токен #' + diff.index + ': «' + diff.before + '» → «' + diff.after + '»');

  const stamp = buildStamp(out);
  const loaderNow = readFileSync(loaderFile, 'utf8');
  const loader = stampLoader(loaderNow, stamp);
  if (loader === null) fail("build failed: в lumen.js нет строки var BUILD = '…'; — метку сборки некуда вписать");

  if (checkOnly) {
    const current = existsSync(distFile) ? readFileSync(distFile, 'utf8') : null;
    if (current !== out) fail('dist is stale, run node scripts/build.mjs');
    if (loaderNow !== loader) fail('lumen.js: метка сборки не совпадает с dist (нужна ' + stamp + '), run node scripts/build.mjs');
    console.log('dist is up to date (build ' + stamp + ')');
    // Проверяем синхронность manifest.json с DEFAULT (I8).
    execFileSync(process.execPath, [join(root, 'scripts', 'manifest.mjs'), '--check'], { stdio: 'inherit' });
    return;
  }

  mkdirSync(join(root, 'dist'), { recursive: true });
  // имя временного файла должно оканчиваться на .js, иначе node --check не
  // определит формат модуля (ERR_UNKNOWN_FILE_EXTENSION для голого .tmp)
  const tmp = join(root, 'dist', 'lumen_card.tmp.js');
  try {
    writeFileSync(tmp, out);
    execFileSync(process.execPath, ['--check', tmp], { stdio: 'inherit' });
    renameSync(tmp, distFile);
    if (loader !== loaderNow) writeFileSync(loaderFile, loader);
    console.log(`built ${distFile} (${Buffer.byteLength(out)} bytes из ${Buffer.byteLength(raw)}, ${files.length} modules, build ${stamp})`);
    if (pretty) {
      const prettyFile = join(root, 'dist', 'lumen_card.pretty.js');
      writeFileSync(prettyFile, squeeze(stripComments(raw, keep)));
      console.log('pretty: ' + prettyFile + ' (строки = src/, не коммитится)');
    }
    // Синхронизируем manifest.json с LC.manifest.DEFAULT из 42_manifest.js (I7).
    execFileSync(process.execPath, [join(root, 'scripts', 'manifest.mjs')], { stdio: 'inherit' });
  } catch (e) {
    console.error('build failed: ' + (e && e.message ? e.message : e));
    process.exitCode = 1;
  } finally {
    if (existsSync(tmp)) rmSync(tmp, { force: true });
  }
}

let isMain = false;
try { isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]; } catch (e) { }
if (isMain) main();

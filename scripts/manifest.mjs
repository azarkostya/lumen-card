// scripts/manifest.mjs — генерирует manifest.json из LC.manifest.DEFAULT в src/42_manifest.js.
// Вызывается из node scripts/build.mjs (после сборки dist).
// Обеспечивает синхронность файла manifest.json и встроенного DEFAULT.
//
// --check — только сверяет текущий manifest.json с DEFAULT, не перезаписывает.
//   Завершается exit(1) если рассинхронизировано.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checkOnly = process.argv.includes('--check');

const src = readFileSync(join(root, 'src', '42_manifest.js'), 'utf8');
const LC = {};
const mod = { exports: null, lumen: true };
new Function('LC', 'module', src)(LC, mod);
const manifest = mod.exports;
if (!manifest || !manifest.DEFAULT) {
  console.error('manifest.mjs: не удалось прочитать LC.manifest.DEFAULT из src/42_manifest.js');
  process.exit(1);
}
const generated = JSON.stringify(manifest.DEFAULT, null, 2) + '\n';
const manifestPath = join(root, 'manifest.json');

if (checkOnly) {
  const current = existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null;
  if (current !== generated) {
    console.error('manifest.json устарел, запустите node scripts/build.mjs');
    process.exit(1);
  }
  console.log('manifest.json актуален (' + manifest.DEFAULT.collections.length + ' подборок)');
  process.exit(0);
}

writeFileSync(manifestPath, generated);
console.log('manifest.json обновлён (' + manifest.DEFAULT.collections.length + ' подборок)');

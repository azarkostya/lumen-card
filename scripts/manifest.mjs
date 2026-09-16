// scripts/manifest.mjs — генерирует manifest.json из LC.manifest.DEFAULT в src/42_manifest.js.
// Вызывается из node scripts/build.mjs (после сборки dist).
// Обеспечивает синхронность файла manifest.json и встроенного DEFAULT.
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = readFileSync(join(root, 'src', '42_manifest.js'), 'utf8');
const LC = {};
const mod = { exports: null, lumen: true };
new Function('LC', 'module', src)(LC, mod);
const manifest = mod.exports;
if (!manifest || !manifest.DEFAULT) {
  console.error('manifest.mjs: не удалось прочитать LC.manifest.DEFAULT из src/42_manifest.js');
  process.exit(1);
}
const out = JSON.stringify(manifest.DEFAULT, null, 2) + '\n';
writeFileSync(join(root, 'manifest.json'), out);
console.log('manifest.json обновлён (' + manifest.DEFAULT.collections.length + ' подборок)');

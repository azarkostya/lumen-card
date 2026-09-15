// scripts/build.mjs — конкатенация src/*.js по имени, проверка синтаксиса
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const srcDir = join(root, 'src');
const files = readdirSync(srcDir).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const banner = `// Lumen Card for Lampa — build ${new Date().toISOString().slice(0,10)}\n`;
const out = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');
mkdirSync(join(root, 'dist'), { recursive: true });
const dist = join(root, 'dist', 'lumen_card.js');
writeFileSync(dist, out);
execFileSync(process.execPath, ['--check', dist], { stdio: 'inherit' });
console.log(`built ${dist} (${out.length} bytes, ${files.length} modules)`);

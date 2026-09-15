// scripts/chunks.mjs — режет файл плагина на выражения для javascript_tool (инжект в cf.lampa.mx)
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
const file = process.argv[2] || 'dist/lumen_card.js';
const src = readFileSync(file, 'utf8');
const SIZE = 20000;
rmSync('dist/chunks', { recursive: true, force: true }); mkdirSync('dist/chunks', { recursive: true });
let n = 0;
for (let i = 0; i < src.length; i += SIZE, n++) {
  writeFileSync(`dist/chunks/${String(n).padStart(2, '0')}.js`, `window.__lc += ${JSON.stringify(src.slice(i, i + SIZE))}; 'chunk ${n}'`);
}
console.log(`${n} chunks from ${file} (${src.length} chars)`);

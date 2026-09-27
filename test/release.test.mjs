import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localProblems } from '../scripts/release.mjs';

/* Релиз 1.0.0: номер версии живёт в одном месте — LC.VERSION в
   src/00_head.js; баннер dist берёт его при сборке, CHANGELOG.md обязан
   иметь раздел этой версии, запасной адрес загрузчика — стабильная ветка
   main. Те же проверки гоняет scripts/release.mjs перед выпуском. */
const read = (p) => { try { return readFileSync(new URL('../' + p, import.meta.url), 'utf8'); } catch (e) { return null; } };

test('релиз: версия 1.0.0 в LC.VERSION, баннере dist и CHANGELOG.md, загрузчик — на main', () => {
  const r = localProblems(read);
  assert.equal(r.version, '1.0.0');
  assert.deepEqual(r.problems, []);
});

test('релиз: проверка ловит несобранный dist, пропущенный раздел CHANGELOG и бету в загрузчике', () => {
  const files = {
    'src/00_head.js': "  LC.VERSION = '1.0.1';\n",
    'dist/lumen_card.js': '// Lumen Card for Lampa v1.0.0\n(function(){})();\n',
    'CHANGELOG.md': '# Журнал\n\n## 1.0.0 — 2026-09-27\n',
    'lumen.js': "var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/';\n"
  };
  const r = localProblems((p) => (p in files ? files[p] : null));
  assert.equal(r.version, '1.0.1');
  assert.equal(r.problems.length, 4, r.problems.join('\n'));
});

// scripts/lib/bundle.mjs — раскладка сборки: баннер + модули src/NN_*.js по
// имени, каждый после своего маркера «/* ---- NN_имя.js ---- */». Строка K
// модуля лежит здесь на K-й строке после маркера — по этой раскладке
// es5check и сама сборка переводят координату в файл src/. Её же сжимает
// scripts/build.mjs (dist/lumen_card.js), и её же, без комментариев, но с той
// же нумерацией строк, пишет build.mjs --pretty для отладки.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { keepComment } from './strip.mjs';

export function srcFiles(srcDir) {
  return readdirSync(srcDir).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
}

export function compose(srcDir, files) {
  files = files || srcFiles(srcDir);
  // Версия для баннера — из LC.VERSION в 00_head.js (без даты: воспроизводимая сборка).
  const head = files.includes('00_head.js') ? readFileSync(join(srcDir, '00_head.js'), 'utf8') : '';
  const m = head.match(/LC\.VERSION\s*=\s*'([^']+)'/);
  const version = m ? m[1] : '0.0.0';
  const banner = `// Lumen Card for Lampa v${version}\n`;
  const raw = banner + files.map(f => `\n/* ---- ${f} ---- */\n` + readFileSync(join(srcDir, f), 'utf8')).join('\n');
  // Белый список комментариев: маркеры своих же модулей и шапка плагина —
  // только до начала второго модуля, чтобы «/*!» где-нибудь в середине кода
  // сборку не пережил.
  const names = new Set(files);
  const second = files.length > 1 ? raw.indexOf(`/* ---- ${files[1]} ---- */`) : -1;
  const headEnd = second < 0 ? raw.length : second;
  const keep = (c, s) => keepComment(c, s, { names, headEnd });
  return { files, version, raw, keep };
}

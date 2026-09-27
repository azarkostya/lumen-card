// scripts/release.mjs — проверки выпуска версии. Ничего не пушит и ничего не
// пишет в репозиторий; код выхода 1 — есть расхождения.
//
//   node scripts/release.mjs                 локально: LC.VERSION в src/00_head.js —
//                                            x.y.z, баннер dist/lumen_card.js с той же
//                                            версией, раздел «## x.y.z» в CHANGELOG.md,
//                                            запасной адрес lumen.js — стабильная @main;
//   node scripts/release.mjs --purge         сбросить кэш jsDelivr (lumen.js, dist,
//                                            manifest.json) для ветки --ref;
//   node scripts/release.mjs --remote        сверить, что GitHub Pages и jsDelivr @ref
//                                            отдают ровно файлы коммита --sha (sha256)
//                                            и баннер с его версией.
//   --ref <ветка>  ветка jsDelivr, по умолчанию main (бета — feat/lumen-v2);
//   --sha <rev>    коммит, с которым сверяется хостинг, по умолчанию HEAD.
//
// Pages берёт файлы из той ветки, что выбрана в настройках репозитория
// (Settings → Pages); с релиза 1.0.0 это main. Порядок выпуска — CHANGELOG.md
// и docs/plans/2026-09-22-lumen-final.md, раздел «E. Релиз 1.0.0».
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'azarkostya/lumen-card';
const PAGES = 'https://azarkostya.github.io/lumen-card/';
const FILES = ['lumen.js', 'dist/lumen_card.js', 'manifest.json'];

/* Локальные проверки. read(path) → текст файла относительно корня или null. */
export function localProblems(read) {
  const out = [];
  const head = read('src/00_head.js') || '';
  const m = head.match(/LC\.VERSION\s*=\s*'([^']+)'/);
  const version = m ? m[1] : '';
  if (!/^\d+\.\d+\.\d+$/.test(version)) out.push('LC.VERSION в src/00_head.js не вида x.y.z: «' + version + '»');
  const dist = read('dist/lumen_card.js') || '';
  const banner = dist.slice(0, dist.indexOf('\n'));
  if (banner !== '// Lumen Card for Lampa v' + version) out.push('баннер dist «' + banner + '» не совпадает с LC.VERSION ' + version + ' — нужна сборка');
  const log = read('CHANGELOG.md') || '';
  if (!version || log.split('\n').every((l) => l.indexOf('## ' + version) !== 0)) out.push('в CHANGELOG.md нет раздела «## ' + version + '»');
  const loader = read('lumen.js') || '';
  if (loader.indexOf("gh/" + REPO + "@main/'") < 0) out.push('запасной адрес lumen.js — не стабильная ветка @main');
  if (loader.indexOf('@feat/') >= 0) out.push('в lumen.js остался адрес беты @feat/');
  return { version, problems: out };
}

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

async function main() {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const ref = arg('--ref', 'main');
  const rev = arg('--sha', 'HEAD');
  let failed = false;

  const local = localProblems((p) => { try { return readFileSync(join(root, p), 'utf8'); } catch (e) { return null; } });
  console.log('версия ' + (local.version || '?') + ', локальные проверки: ' + (local.problems.length ? 'ЕСТЬ РАСХОЖДЕНИЯ' : 'ok'));
  for (const p of local.problems) console.log('  - ' + p);
  failed = failed || local.problems.length > 0;

  if (process.argv.includes('--purge')) {
    for (const f of FILES) {
      const url = 'https://purge.jsdelivr.net/gh/' + REPO + '@' + ref + '/' + f;
      try {
        const r = await fetch(url);
        const body = await r.json().catch(() => ({}));
        console.log('purge ' + f + ' @' + ref + ': HTTP ' + r.status + ' ' + (body.status || ''));
        if (!r.ok) failed = true;
      } catch (e) { console.log('purge ' + f + ': ' + e.message); failed = true; }
    }
  }

  if (process.argv.includes('--remote')) {
    const full = execFileSync('git', ['rev-parse', rev], { cwd: root, encoding: 'utf8' }).trim();
    console.log('сверка хостинга с ' + full.slice(0, 7) + ' (jsDelivr @' + ref + ')');
    const bases = [['pages', PAGES, '?release=' + Date.now()], ['jsdelivr', 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + ref + '/', '']];
    for (const f of FILES) {
      const want = execFileSync('git', ['show', full + ':' + f], { cwd: root, maxBuffer: 64 << 20 });
      for (const [name, base, q] of bases) {
        let line;
        try {
          const r = await fetch(base + f + q, { cache: 'no-store' });
          const got = Buffer.from(await r.arrayBuffer());
          const same = r.ok && sha256(got) === sha256(want);
          const tag = f === 'dist/lumen_card.js' ? ' «' + got.toString('utf8', 0, 60).split('\n')[0] + '»' : '';
          line = (same ? 'ok  ' : 'DIFF') + ' ' + name + ' ' + f + ' HTTP ' + r.status + tag;
          if (!same) failed = true;
        } catch (e) { line = 'ERR  ' + name + ' ' + f + ': ' + e.message; failed = true; }
        console.log('  ' + line);
      }
    }
  }
  process.exit(failed ? 1 : 0);
}

let isMain = false;
try { isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]; } catch (e) { }
if (isMain) main();

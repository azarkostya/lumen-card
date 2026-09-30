// scripts/release.mjs — проверки выпуска версии. Ничего не пушит и ничего не
// пишет в репозиторий; код выхода 1 — есть расхождения.
//
//   node scripts/release.mjs                 локально: LC.VERSION в src/00_head.js —
//                                            x.y.z, баннер dist/lumen_card.js с той же
//                                            версией, раздел «## x.y.z» в CHANGELOG.md,
//                                            запасной адрес lumen.js — стабильная @main,
//                                            метка BUILD в lumen.js = хэш dist, VERSION в
//                                            нём = LC.VERSION; если тег v<VERSION> уже
//                                            есть (на origin, а до push — локально),
//                                            его сборка — ровно этот dist; origin
//                                            недоступен — предупреждение;
//   node scripts/release.mjs --purge         сбросить кэш jsDelivr (lumen.js, dist,
//                                            manifest.json) для ветки --ref;
//   node scripts/release.mjs --remote        сверить, что GitHub Pages и jsDelivr @ref
//                                            отдают ровно файлы коммита --sha (sha256)
//                                            и баннер с его версией — в том числе
//                                            сборку по тому адресу, что просит ТВ:
//                                            dist/lumen_card.js?v=<BUILD из lumen.js>, и
//                                            всё, что проверяет --tag;
//   node scripts/release.mjs --tag           тег v<VERSION> на origin указывает на --sha,
//                                            jsDelivr @v<VERSION> отдаёт сборку коммита
//                                            (и по адресу загрузчика с ?v=<BUILD>).
//                                            Гонять ПОСЛЕ push тега и ДО push main: Pages
//                                            отдаст новый lumen.js, и он сразу попросит
//                                            сборку по тегу (README, «Выпуск версии»);
//   --ref <ветка>  ветка jsDelivr, по умолчанию main (бета — feat/lumen-v2);
//   --sha <rev>    коммит, с которым сверяется хостинг, по умолчанию HEAD.
//
// Pages берёт файлы из той ветки, что выбрана в настройках репозитория
// (Settings → Pages); с релиза 1.0.0 это main. Порядок выпуска — README,
// раздел «Выпуск версии»: тег → --tag → ветки → --purge → --remote.
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildStamp } from './build.mjs';

const REPO = 'azarkostya/lumen-card';
const PAGES = 'https://azarkostya.github.io/lumen-card/';
/* Адрес сборки по тегу выпуска — тот, что загрузчик с Pages просит первым
   (lumen.js: CDN + VERSION + '/dist/lumen_card.js?v=' + BUILD). */
export function tagBuildUrl(version, build) {
  return 'https://cdn.jsdelivr.net/gh/' + REPO + '@v' + version + '/dist/lumen_card.js' + (build ? '?v=' + build : '');
}
/* Порядок значим для --purge: загрузчик — последним. lumen.js несёт метку
   сборки (?v=BUILD); сбрось его раньше dist — и ТВ между двумя сбросами
   попросит dist/lumen_card.js?v=<новая> и может получить из кэша jsDelivr
   старую сборку, которую браузер запомнит под новым адресом (max-age 7 дней). */
const FILES = ['dist/lumen_card.js', 'manifest.json', 'lumen.js'];

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

/* Метка сборки в загрузчике (var BUILD, вписывает scripts/build.mjs) обязана
   быть хэшем dist: иначе ТВ попросит сборку по чужому адресу. Отдельно от
   localProblems — у той фиксированный набор проверок (test/release.test.mjs). */
export function loaderBuild(loader) {
  const m = /var BUILD = '([0-9a-f]+)';/.exec(loader || '');
  return m ? m[1] : '';
}

export function loaderVersion(loader) {
  const m = /var VERSION = '([^']*)';/.exec(loader || '');
  return m ? m[1] : '';
}

export function stampProblems(read) {
  const loader = read('lumen.js');
  const build = loaderBuild(loader);
  const dist = read('dist/lumen_card.js');
  const out = [];
  if (!build) out.push("в lumen.js нет метки var BUILD = '…';");
  else if (dist === null || build !== buildStamp(dist)) out.push('метка BUILD в lumen.js (' + build + ') не хэш dist — нужна сборка');
  const m = (read('src/00_head.js') || '').match(/LC\.VERSION\s*=\s*'([^']+)'/);
  const version = loaderVersion(loader);
  if (!version || !m || version !== m[1]) out.push('VERSION в lumen.js («' + version + '») не LC.VERSION' + (m ? ' ' + m[1] : '') + ' — нужна сборка');
  return out;
}

/* Сборка тега v<версия> неизменна: jsDelivr отдаёт её с max-age на год
   (immutable), и загрузчик с Pages просит именно её. Новая сборка под
   старой версией ушла бы на ТВ старой — тег уже указывает на прежний dist.
   tagDist — dist/lumen_card.js из тега (null — тега нет). */
export function tagProblems(version, dist, tagDist) {
  if (tagDist === null || tagDist === undefined) return [];
  if (sha256(Buffer.from(tagDist)) === sha256(Buffer.from(dist || ''))) return [];
  return ['тег v' + version + ' уже есть, и его сборка не этот dist — подними LC.VERSION (сборку тега jsDelivr кэширует навсегда)'];
}

/* Коммит тега из вывода git ls-remote: у аннотированного тега строка
   «<объект тега> refs/tags/vX» и строка «<коммит> refs/tags/vX^{}» —
   нужен коммит; у лёгкого тега строка одна. '' — тега нет. */
export function remoteTagCommit(out, tag) {
  let at = '';
  for (const line of (out || '').split(/\r?\n/)) {
    const parts = line.split(/\s+/);
    if (parts[1] === tag + '^{}') return parts[0];
    if (parts[1] === tag) at = parts[0];
  }
  return at;
}

/* Сборка тега v<версия> для tagProblems. Главный — тег на origin: его
   jsDelivr разрешает через GitHub и отдаёт ТВ. Локальный тег — только если
   на origin тега нет (ещё не запушен) или origin недоступен. git(args) →
   stdout строкой или исключение. Коммита тега с origin локально нет —
   git fetch --no-tags origin refs/tags/vX: приносит объекты и FETCH_HEAD,
   ни тегов, ни веток не создаёт и не двигает. Возвращает { dist, problems,
   warnings }: dist — сборка тега (null — тега нет или сверять не с чем). */
export function tagDist(version, git) {
  const tag = 'refs/tags/v' + version;
  const out = { dist: null, problems: [], warnings: [] };
  const short = (c) => c.slice(0, 7);
  const why = (e) => String((e && (e.stderr || e.message)) || e).trim().split(/\r?\n/)[0];
  let local = '';
  try { local = String(git(['rev-parse', '-q', '--verify', tag + '^{commit}'])).trim(); } catch (e) { local = ''; }
  let remote = '';
  try {
    remote = remoteTagCommit(String(git(['ls-remote', 'origin', tag])), tag);
  } catch (e) {
    out.warnings.push('origin недоступен (' + why(e) + ') — тег v' + version + ' на origin НЕ проверен' +
      (local ? '; сверка только с локальным тегом ' + short(local) : '') + '; перед выпуском повтори с сетью');
  }
  let from = local;
  if (remote) {
    if (local && local !== remote) out.warnings.push('локальный тег v' + version + ' (' + short(local) + ') не тот, что на origin (' + short(remote) + ') — сверка с origin');
    from = remote;
    let have = true;
    try { git(['cat-file', '-e', remote + '^{commit}']); } catch (e) { have = false; }
    if (!have) {
      try { git(['fetch', '--no-tags', 'origin', tag]); } catch (e) {
        out.problems.push('тег v' + version + ' уже есть на origin (' + short(remote) + '), но его коммит не получить (' + why(e) + ') — сборку тега не сверить');
        return out;
      }
    }
  }
  if (!from) return out;
  try {
    out.dist = String(git(['show', from + ':dist/lumen_card.js']));
  } catch (e) {
    out.problems.push('тег v' + version + ' (' + short(from) + '): не прочитать dist/lumen_card.js (' + why(e) + ')');
  }
  return out;
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

  const readLocal = (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch (e) { return null; } };
  const local = localProblems(readLocal);
  local.problems = local.problems.concat(stampProblems(readLocal));
  let warnings = [];
  if (local.version) {
    // Без запроса пароля и не дольше 30 с: недоступный origin — предупреждение.
    const git = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 << 20, timeout: 30000,
      stdio: ['ignore', 'pipe', 'pipe'], env: Object.assign({}, process.env, { GIT_TERMINAL_PROMPT: '0' }) });
    const t = tagDist(local.version, git);
    warnings = t.warnings;
    local.problems = local.problems.concat(t.problems, tagProblems(local.version, readLocal('dist/lumen_card.js'), t.dist));
  }
  console.log('версия ' + (local.version || '?') + ', локальные проверки: ' + (local.problems.length ? 'ЕСТЬ РАСХОЖДЕНИЯ' : 'ok') +
    (warnings.length ? ' (есть предупреждения)' : ''));
  for (const p of local.problems) console.log('  - ' + p);
  for (const w of warnings) console.log('  ! ' + w);
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

  const remote = process.argv.includes('--remote');
  if (remote || process.argv.includes('--tag')) {
    const full = execFileSync('git', ['rev-parse', rev], { cwd: root, encoding: 'utf8' }).trim();
    const show = (f) => execFileSync('git', ['show', full + ':' + f], { cwd: root, maxBuffer: 64 << 20 });
    const lumen = show('lumen.js').toString('utf8');
    const version = loaderVersion(lumen);
    const build = loaderBuild(lumen);
    if (!version) {
      console.log('  (в lumen.js коммита нет VERSION — загрузчик до сборки по тегу)');
      if (!remote) failed = true;
    } else {
      // Тег на origin — тот же коммит: jsDelivr разрешает тег через GitHub.
      // Аннотированный тег ls-remote показывает дважды, «^{}» — его коммит.
      const tag = 'refs/tags/v' + version;
      let at = '';
      try {
        at = remoteTagCommit(execFileSync('git', ['ls-remote', 'origin', tag], { cwd: root, encoding: 'utf8' }), tag);
      } catch (e) { console.log('  ERR  git ls-remote: ' + e.message); }
      const tagOk = at === full;
      console.log('  ' + (tagOk ? 'ok  ' : 'DIFF') + ' тег v' + version + ' на origin: ' + (at ? at.slice(0, 7) : 'нет') + ' (нужен ' + full.slice(0, 7) + ')');
      if (!tagOk) failed = true;
      // Сборка по тегу — в том числе ровно тем адресом, что просит загрузчик с
      // Pages. Пока jsDelivr тег не разрешил, тут 404 — на ТВ это запасной
      // путь с Pages, но main до «ok» не пушить.
      const want = show('dist/lumen_card.js');
      for (const url of [tagBuildUrl(version, ''), tagBuildUrl(version, build)]) {
        let line;
        try {
          const r = await fetch(url, { cache: 'no-store' });
          const got = Buffer.from(await r.arrayBuffer());
          const same = r.ok && sha256(got) === sha256(want);
          line = (same ? 'ok  ' : 'DIFF') + ' jsdelivr @v' + version + ' ' + url.slice(url.indexOf('/dist/') + 1) + ' HTTP ' + r.status + ' «' + got.toString('utf8', 0, 60).split('\n')[0] + '»';
          if (!same) failed = true;
        } catch (e) { line = 'ERR  jsdelivr @v' + version + ': ' + e.message; failed = true; }
        console.log('  ' + line);
      }
    }
  }

  if (remote) {
    const full = execFileSync('git', ['rev-parse', rev], { cwd: root, encoding: 'utf8' }).trim();
    console.log('сверка хостинга с ' + full.slice(0, 7) + ' (jsDelivr @' + ref + ')');
    const bases = [['pages', PAGES, '?release=' + Date.now()], ['jsdelivr', 'https://cdn.jsdelivr.net/gh/' + REPO + '@' + ref + '/', '']];
    const show = (f) => execFileSync('git', ['show', full + ':' + f], { cwd: root, maxBuffer: 64 << 20 });
    // Сборка по адресу с меткой — ровно тот запрос, что делает загрузчик на
    // ТВ (без своего «?release=»: проверяется то, что лежит в кэше CDN под
    // этим адресом).
    const build = loaderBuild(show('lumen.js').toString('utf8'));
    const checks = FILES.map((f) => [f, bases]);
    if (build) checks.push(['dist/lumen_card.js', bases.map(([name, base]) => [name, base, '?v=' + build])]);
    else console.log('  (в lumen.js коммита нет метки BUILD — сборка до 1.1)');
    for (const [f, where] of checks) {
      const want = show(f);
      for (const [name, base, q] of where) {
        let line;
        try {
          const r = await fetch(base + f + q, { cache: 'no-store' });
          const got = Buffer.from(await r.arrayBuffer());
          const same = r.ok && sha256(got) === sha256(want);
          const tag = f === 'dist/lumen_card.js' ? ' «' + got.toString('utf8', 0, 60).split('\n')[0] + '»' : '';
          line = (same ? 'ok  ' : 'DIFF') + ' ' + name + ' ' + f + (q.indexOf('?v=') === 0 ? q : '') + ' HTTP ' + r.status + tag;
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

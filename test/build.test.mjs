import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as acorn from '../scripts/lib/acorn.mjs';
import { toSourceLocation } from '../scripts/es5check.mjs';
import { compose } from '../scripts/lib/bundle.mjs';
import { tokenStream, firstMismatch } from '../scripts/lib/minify.mjs';
import { buildStamp, stampLoader } from '../scripts/build.mjs';

/* Сборка сжимает dist/lumen_card.js: без комментариев, отступов, пустых
   строк и лишних пробелов (scripts/build.mjs). Здесь проверяется сам артефакт, который коммитится и
   уезжает на ТВ: комментариев нет, файл компилируется, строковые литералы не
   повреждены (в них есть «/*» заголовков CSS, data-URI с «//» и регэкспы —
   именно на них ломается вырезание регулярками).

   Модули из dist берутся срезом по маркерам «/* ---- NN_имя.js ---- * /» и
   грузятся в один LC, как в css.test.mjs/torrents.test.mjs, — так сравнение
   идёт с теми же модулями из src/. */

globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

const dist = readFileSync(new URL('../dist/lumen_card.js', import.meta.url), 'utf8');
const srcDir = new URL('../src/', import.meta.url);
const srcFiles = readdirSync(srcDir).filter(f => /^\d\d_.*\.js$/.test(f)).sort();
const readSrc = f => readFileSync(new URL(f, srcDir), 'utf8');

/* Порядок — как в бандле: 10 -> 20 -> 64 -> 80 -> 30 -> 65 (80_settings даёт
   LC.pref, он нужен 30/65 только при вызове, не при загрузке). */
const MODULES = ['10_util.js', '20_icons.js', '64_menus.js', '80_settings.js', '81_prefs.js', '30_css.js', '65_torrents.js'];

function sliceModule(name) {
  const marker = '/* ---- ' + name + ' ---- */';
  const from = dist.indexOf(marker);
  assert.ok(from >= 0, 'в dist нет маркера ' + name);
  const start = from + marker.length;
  const next = dist.indexOf('/* ---- ', start);
  return dist.slice(start, next < 0 ? dist.length : next);
}

function loadAll(read) {
  const LC = {};
  const module = { exports: null, lumen: true };
  for (const f of MODULES) new Function('LC', 'module', read(f))(LC, module);
  return LC;
}

const fromDist = loadAll(sliceModule);
const fromSrc = loadAll(f => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8'));

function comments(src) {
  const found = [];
  acorn.parse(src, {
    ecmaVersion: 5, sourceType: 'script', locations: true,
    onComment: (block, text, start, end) => found.push({ block, text, start, end })
  });
  return found;
}

test('в dist нет комментариев, кроме баннера, шапки плагина и маркеров файлов', () => {
  const MARKER_TEXT_RE = /^ ---- \S+ ---- $/;
  const extra = comments(dist).filter(c => {
    if (!c.block) return c.start !== 0;
    if (c.text.charAt(0) === '!') return false;
    return !MARKER_TEXT_RE.test(c.text);
  });
  assert.deepEqual(extra.map(c => c.text.slice(0, 60)), [], 'лишние комментарии в dist');
});

test('шапка плагина и маркеры файлов на месте', () => {
  const kept = comments(dist);
  const bang = kept.filter(c => c.block && c.text.charAt(0) === '!');
  const markers = kept.filter(c => c.block && /^ ---- \S+ ---- $/.test(c.text));
  assert.equal(bang.length, 1, 'ожидалась одна шапка /*!');
  assert.match(bang[0].text, /Lumen Card/);
  assert.equal(markers.length, srcFiles.length, 'маркеры должны быть у всех модулей src/');
  assert.ok(dist.startsWith('// Lumen Card for Lampa v'), 'баннер первой строкой');
});

/* С 1.1 dist сжат (scripts/lib/minify.mjs): строки src/ в нём больше не
   совпадают построчно. Вместо нумерации строк сверяется сам код: поток
   токенов dist — ровно поток токенов раскладки src/ (тип, дословный текст и
   «перед токеном был перевод строки», от которого зависит ASI). Ту же сверку
   build.mjs делает перед записью; здесь — на закоммиченном артефакте. */
test('код dist токен в токен совпадает с src/ (сжатие ничего не поменяло)', () => {
  const { raw } = compose(fileURLToPath(srcDir));
  assert.equal(firstMismatch(tokenStream(raw), tokenStream(dist)), null);
});

test('dist сжат: ни пустых строк, ни отступов, ни пробелов вокруг «=»', () => {
  const lines = dist.split('\n');
  assert.equal(lines[lines.length - 1], '', 'файл кончается переводом строки');
  const body = lines.slice(0, -1);
  assert.deepEqual(body.filter(l => l === ''), [], 'пустые строки');
  // Строки, начатые с пробела, бывают только внутри уцелевшей шапки «/*!».
  const indented = body.filter(l => /^[ \t]/.test(l) && !/^ \*/.test(l));
  assert.deepEqual(indented.slice(0, 5), [], 'строки с отступом');
  assert.ok(dist.indexOf("LC.VERSION='") >= 0, 'пробелы вокруг «=» не сжаты');
});

/* Координаты es5check: сжатый dist номера строк src/ не хранит, поэтому
   es5check без аргумента проверяет ещё и раскладку src/ (scripts/lib/bundle.mjs),
   где строка K модуля — K-я после маркера. */
test('es5check.toSourceLocation по раскладке src/ даёт координату в src', () => {
  const { raw } = compose(fileURLToPath(srcDir));
  const needle = 'LC.VERSION =';
  const rawLine = raw.split('\n').findIndex(l => l.indexOf(needle) >= 0) + 1;
  assert.ok(rawLine > 0, 'якорь ' + needle + ' не найден в раскладке');
  const loc = toSourceLocation(raw, rawLine);
  const srcLine = readSrc('00_head.js').split('\n').findIndex(l => l.indexOf(needle) >= 0) + 1;
  assert.deepEqual(loc, { file: '00_head.js', line: srcLine });
});

/* Метка сборки в загрузчике — sha256 содержимого dist, а не время: та же
   сборка — тот же адрес (кэш браузера и кэш компиляции V8 живут), новая —
   новый адрес. */
test('метка BUILD в lumen.js — первые 10 hex sha256 от dist', () => {
  const loader = readFileSync(new URL('../lumen.js', import.meta.url), 'utf8');
  const m = /var BUILD = '([0-9a-f]+)';/.exec(loader);
  assert.ok(m, 'в lumen.js нет строки var BUILD');
  assert.equal(m[1], buildStamp(dist));
  assert.equal(m[1].length, 10);
  assert.equal(loader.indexOf('Date.now'), -1, 'метка больше не зависит от времени');
});

test('stampLoader вписывает метку и отказывается от загрузчика без var BUILD', () => {
  assert.equal(stampLoader("a;\n  var BUILD = '0123456789';\nb;", 'abcdef0123'), "a;\n  var BUILD = 'abcdef0123';\nb;");
  assert.equal(stampLoader('var stamp = 1;', 'abcdef0123'), null);
});

/* build.mjs --check на копии репозитория (src/, scripts/, dist/, lumen.js,
   manifest.json): чистая копия проходит, подменённая метка в lumen.js и
   подменённый dist — ловятся. Сам репозиторий не трогается. */
test('build.mjs --check ловит рассинхрон lumen.js и dist', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'lumen-build-'));
  try {
    const repo = fileURLToPath(new URL('..', import.meta.url));
    for (const d of ['src', 'scripts', 'dist']) cpSync(join(repo, d), join(tmp, d), { recursive: true });
    for (const f of ['lumen.js', 'manifest.json']) cpSync(join(repo, f), join(tmp, f));
    const run = () => spawnSync(process.execPath, [join(tmp, 'scripts', 'build.mjs'), '--check'], { encoding: 'utf8' });

    let r = run();
    assert.equal(r.status, 0, 'чистая копия: ' + r.stderr);

    const loader = readFileSync(join(tmp, 'lumen.js'), 'utf8');
    writeFileSync(join(tmp, 'lumen.js'), stampLoader(loader, '0000000000'));
    r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /lumen\.js: метка сборки не совпадает/);

    writeFileSync(join(tmp, 'lumen.js'), loader);
    writeFileSync(join(tmp, 'dist', 'lumen_card.js'), dist.replace("LC.VERSION='", "LC.VERSION ='"));
    r = run();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /dist is stale/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('dist компилируется', () => {
  assert.doesNotThrow(() => new Function(dist));
});

test('CSS карточки из dist совпадает с CSS из src байт в байт', () => {
  const css = fromDist.buildCss();
  assert.ok(css.length > 1000, 'подозрительно короткий CSS: ' + css.length);
  assert.equal(css, fromSrc.buildCss());
});

test('CSS торрентов из dist совпадает с CSS из src байт в байт', () => {
  const css = fromDist.torrents.css();
  assert.ok(css.length > 1000, 'подозрительно короткий CSS: ' + css.length);
  assert.equal(css, fromSrc.torrents.css());
});

test('строковые литералы с «/*» и «//» внутри не порезаны', () => {
  assert.ok(fromDist.torrents.css().indexOf('/* Маски иконок') >= 0, 'заголовок-комментарий внутри CSS пропал');
  assert.ok(dist.indexOf('https://fonts.googleapis.com/css2?') >= 0, 'URL шрифтов пропал');
  assert.ok(dist.indexOf('data:image/svg+xml;charset=utf-8,') >= 0, 'префикс data-URI пропал');
  assert.ok(dist.indexOf('http://www.w3.org/2000/svg') >= 0, 'xmlns SVG пропал');
});

test('dist меньше суммы исходников', () => {
  const srcBytes = srcFiles.reduce((sum, f) => sum + Buffer.byteLength(readSrc(f), 'utf8'), 0);
  const distBytes = Buffer.byteLength(dist, 'utf8');
  assert.ok(distBytes < srcBytes, 'dist ' + distBytes + ' B, src ' + srcBytes + ' B');
});

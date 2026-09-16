import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as acorn from '../scripts/lib/acorn.mjs';
import { toSourceLocation } from '../scripts/es5check.mjs';

/* Сборка вычищает из dist/lumen_card.js комментарии и ведущие отступы
   (scripts/build.mjs). Здесь проверяется сам артефакт, который коммитится и
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

/* Нумерация строк — единственная «карта» между dist и src: комментарий
   заменяется на столько же пустых строк, сколько занимал, поэтому строка K
   модуля лежит в dist на K-й строке после своего маркера. На этом держится
   es5check.toSourceLocation, и об этом написано в README. */
test('строки dist совпадают со строками src (нумерация не разъехалась)', () => {
  const distLines = dist.split('\n');
  for (const f of srcFiles) {
    const at = distLines.indexOf('/* ---- ' + f + ' ---- */');
    assert.ok(at >= 0, 'маркер ' + f + ' должен занимать строку целиком');
    const srcLines = readSrc(f).split('\n');
    for (let i = 0; i < srcLines.length; i++) {
      const got = distLines[at + 1 + i];
      const want = srcLines[i];
      assert.ok(got !== undefined, f + ':' + (i + 1) + ' — в dist строк меньше, чем в src');
      // Строки, из которых что-то вырезано, сравнивать посимвольно нельзя;
      // пустой got — это строка, целиком занятая комментарием.
      if (/\/\/|\/\*|\*\//.test(want)) continue;
      assert.ok(got === '' || got === want.trim() || got === want,
        f + ':' + (i + 1) + ' — строка dist «' + got + '» не соответствует src «' + want + '»');
    }
  }
});

test('es5check.toSourceLocation по dist даёт координату в src', () => {
  const needle = 'LC.VERSION =';
  const distLine = dist.split('\n').findIndex(l => l.indexOf(needle) === 0) + 1;
  assert.ok(distLine > 0, 'якорь ' + needle + ' не найден в dist');
  const loc = toSourceLocation(dist, distLine);
  const srcLine = readSrc('00_head.js').split('\n').findIndex(l => l.indexOf(needle) >= 0) + 1;
  assert.deepEqual(loc, { file: '00_head.js', line: srcLine });
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

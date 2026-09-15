// scripts/lib/strip.mjs — вырезание комментариев и сжатие пробелов в сборке.
//
// Обе функции сохраняют нумерацию строк: комментарий заменяется ровно на
// столько переводов строки, сколько в нём было, пустые строки не удаляются.
// Поэтому строка N в dist — это строка N в раскладке сборки, и es5check по
// маркерам файлов восстанавливает координату в src/ без карты строк.
//
// Переводом строки в JS считаются \n, \r, \r\n, U+2028 и U+2029 — acorn
// учитывает все пять, поэтому одиночный '\n' тут нигде не зашит в условия.
import * as acorn from './acorn.mjs';

const LINE_BREAK = /\r\n?|\n|\u2028|\u2029/g;
const NEWLINE_CHAR = /[\n\r\u2028\u2029]/;
const EXOTIC_BREAK = /[\r\u2028\u2029]/;
const MARKER_TEXT_RE = /^ ---- (\S+) ---- $/;

function parse(src, options) {
  return acorn.parse(src, Object.assign({ ecmaVersion: 5, sourceType: 'script', locations: true }, options));
}

function lineBreaks(text) {
  return text.split(LINE_BREAK).length - 1;
}

export function atLineStart(src, pos) {
  return pos === 0 || NEWLINE_CHAR.test(src.charAt(pos - 1));
}

/* В dist остаются три вида комментариев: баннер первой строкой, шапка плагина
   («/*!», конвенция «не вырезать») и маркеры файлов сборки. Все — только с
   начала строки и только свои: такой же комментарий, написанный внутри
   модуля, сборку не переживает. opts.names — имена файлов src/, opts.headEnd
   — смещение, до которого шапка считается шапкой (начало второго модуля). */
export function keepComment(c, src, opts) {
  if (!c.block) return c.start === 0;
  if (!atLineStart(src, c.start)) return false;
  if (c.text.charAt(0) === '!') return c.start < (opts && opts.headEnd !== undefined ? opts.headEnd : 0);
  const m = MARKER_TEXT_RE.exec(c.text);
  return !!m && !!(opts && opts.names) && opts.names.has(m[1]);
}

/* keep(c, src) -> true, если комментарий остаётся как есть. */
export function stripComments(src, keep) {
  const comments = [];
  parse(src, { onComment: (block, text, start, end) => comments.push({ block, text, start, end }) });
  let out = src;
  for (let i = comments.length - 1; i >= 0; i--) {
    const c = comments[i];
    if (keep && keep(c, src)) continue;
    const text = src.slice(c.start, c.end);
    const breaks = lineBreaks(text);
    // Удалять «в ноль» нельзя: «typeof/*c*/x» склеилось бы в «typeofx», а
    // пропавший перевод строки поменял бы расстановку «;» (ASI).
    const repl = breaks ? '\n'.repeat(breaks) : (c.block ? ' ' : '');
    out = out.slice(0, c.start) + repl + out.slice(c.end);
  }
  return out;
}

/* Срез ведущих и хвостовых пробелов. Строки, которые пересекает многострочный
   токен (строковый литерал с продолжением) или уцелевший комментарий, остаются
   дословно — там пробелы значимы. Пустые строки сохраняются: нумерация строк
   не должна разъезжаться с раскладкой сборки. */
export function squeeze(src) {
  // CR, U+2028 и U+2029 разъезжаются с src.split('\n'): номера строк acorn и
  // индексы массива перестают совпадать, и verbatim-защита литералов уедет на
  // чужие строки. Такой файл отдаём нетронутым — потерять проценты размера
  // дешевле, чем молча испортить строковый литерал.
  if (EXOTIC_BREAK.test(src)) return src;
  const tokens = [];
  const spans = [];
  parse(src, { onToken: tokens, onComment: (block, text, start, end, startLoc, endLoc) => spans.push({ startLoc, endLoc }) });
  for (const t of tokens) spans.push({ startLoc: t.loc.start, endLoc: t.loc.end });
  const verbatim = new Set();
  for (const s of spans) {
    if (s.startLoc.line === s.endLoc.line) continue;
    for (let l = s.startLoc.line; l <= s.endLoc.line; l++) verbatim.add(l);
  }
  const lines = src.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (verbatim.has(i + 1)) continue;
    lines[i] = lines[i].replace(/^[ \t]+/, '').replace(/[ \t]+$/, '');
  }
  return lines.join('\n');
}

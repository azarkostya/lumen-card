// scripts/lib/minify.mjs — безопасное сжатие сборки: без комментариев и лишних
// пробелов, без переименований и перестановок.
//
// Сборка переписывается заново из потока токенов acorn (ecmaVersion: 5):
// каждый токен — дословный срез исходника (строки, регэкспы, числа не
// трогаются вообще), а между токенами ставится минимальный разделитель:
//  - «\n», если между ними в исходнике был хотя бы один перевод строки — в
//    пробелах или внутри комментария. От этого и только от этого зависит
//    расстановка «;» (ASI) и запретные позиции (return/throw/break/continue,
//    постфиксные ++/--), поэтому поведение кода не меняется. Несколько
//    переводов подряд схлопываются в один: пустые строки ASI не различает;
//  - « », если без пробела токены склеились бы в другие (два слова,
//    «a - -b» → «a--b», «a / /re/» → комментарий, «1 .x» → «1.x»);
//  - иначе ничего.
// Токенизатор — вендоренный acorn, тот же, что у es5check: он сам различает
// «/» деления и начало регэкспа по контексту разбора, обходит строки с
// экранированием и «//» внутри строк и регэкспов. Шаблонных строк ES5 не
// знает, поэтому бэктик в коде — ошибка разбора и, значит, ошибка сборки.
//
// Уцелевшие комментарии (баннер, шапка «/*!», маркеры модулей) решает
// keep(c, src) и пишет каждый на своей строке — все они стоят с начала
// строки, то есть перевод строки перед ними в исходнике и так был.
import * as acorn from './acorn.mjs';

const NEWLINE = /[\n\r\u2028\u2029]/;

function parse(src, options) {
  return acorn.parse(src, Object.assign({ ecmaVersion: 5, sourceType: 'script' }, options));
}

/* Символ слова: латиница, цифры, _ $, обратная косая (\uXXXX в имени) и всё
   не-ASCII — с запасом, лишний пробел дешевле склейки. */
function wordChar(ch) {
  return /[A-Za-z0-9_$\\]/.test(ch) || ch.charCodeAt(0) > 127;
}

/* Нужен ли пробел между текстом a (предыдущий токен) и b (следующий). */
export function needSpace(a, b, prevType) {
  const x = a.charAt(a.length - 1);
  const y = b.charAt(0);
  if (wordChar(x) && wordChar(y)) return true;
  // Регэксп, закрытый «/», поглотил бы следующее слово как флаги.
  if (prevType === 'regexp' && wordChar(y)) return true;
  // «1 .toString()» — без пробела точка ушла бы в число.
  if (prevType === 'num' && y === '.') return true;
  // «a + +b», «a - -b», «a / /re/», «a / *b» (не бывает, но с запасом),
  // «a < !--b» и «a-- >b» — HTML-комментарии в скрипте.
  const pair = x + y;
  return pair === '++' || pair === '--' || pair === '//' || pair === '/*' || pair === '<!' || pair === '->';
}

/* minify(src, keep) -> сжатый текст. keep(c, src) — как у strip.mjs:
   true — комментарий остаётся (с полями block, text, start, end). */
export function minify(src, keep) {
  const tokens = [];
  const comments = [];
  parse(src, {
    onToken: tokens,
    onComment: (block, text, start, end) => comments.push({ block, text, start, end })
  });
  // Куски собираются в массив, а последний выведенный — в last: проверка
  // «чем кончается вывод» по растущей строке обходилась бы квадратично.
  const out = [];
  let last = '';
  const put = (s) => { if (s) { out.push(s); last = s; } };
  let prev = null;
  let ci = 0;
  for (const t of tokens) {
    const kept = [];
    while (ci < comments.length && comments[ci].start < t.start) {
      const c = comments[ci++];
      if (keep && keep(c, src)) kept.push(c);
    }
    const gap = src.slice(prev ? prev.end : 0, t.start);
    const text = t.type.label === 'eof' ? '' : src.slice(t.start, t.end);
    if (kept.length) {
      // Уцелевший комментарий пишется своей строкой; если перед токеном
      // перевода строки не было, он добавился бы — и сдвинул бы ASI.
      if (prev && !NEWLINE.test(gap)) throw new Error('уцелевший комментарий не с начала строки: ' + kept[0].text.slice(0, 40));
      for (const c of kept) {
        if (last && last.charAt(last.length - 1) !== '\n') put('\n');
        put(src.slice(c.start, c.end) + '\n');
      }
    } else if (prev && NEWLINE.test(gap)) {
      put('\n');
    } else if (prev && text && needSpace(last, text, prev.type.label)) {
      put(' ');
    }
    put(text);
    prev = t;
  }
  if (last && last.charAt(last.length - 1) !== '\n') put('\n');
  return out.join('');
}

/* Поток значимых токенов для сверки «до/после»: тип и дословный текст, плюс
   признак «перед токеном был перевод строки» — он тоже часть смысла (ASI). */
export function tokenStream(src) {
  const tokens = [];
  parse(src, { onToken: tokens });
  const out = [];
  let prevEnd = 0;
  for (const t of tokens) {
    if (t.type.label === 'eof') break;
    // Перевод строки ищем только в промежутке между токенами (там пробелы и
    // комментарии), а не внутри самого токена.
    const nl = out.length > 0 && NEWLINE.test(src.slice(prevEnd, t.start)) ? '\n' : '';
    out.push(nl + t.type.label + ' ' + src.slice(t.start, t.end));
    prevEnd = t.end;
  }
  return out;
}

/* Первое расхождение двух потоков или null. */
export function firstMismatch(a, b) {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return { index: i, before: a[i], after: b[i] };
  }
  return null;
}

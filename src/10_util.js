/* ---------------------------------------------------------------------- */
/* Чистые хелперы форматирования и ES5-коллекции.                          */
/* Никаких обращений к window/Lampa/jQuery — модуль грузится и проверяется */
/* тестами (node --test) без браузера.                                     */
/* ---------------------------------------------------------------------- */

function esc(str) {
  if (str === null || typeof str === 'undefined') return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function pad2(n) {
  n = Math.floor(n);
  return n < 10 ? '0' + n : '' + n;
}

/* Русская/славянская плюрализация: [1, 2-4, 5+] */
function plural(n, forms) {
  n = Math.abs(n) % 100;
  var tail = n % 10;
  if (n > 10 && n < 20) return forms[2];
  if (tail > 1 && tail < 5) return forms[1];
  if (tail === 1) return forms[0];
  return forms[2];
}

/* Имя -> инициалы (максимум 2 буквы) */
function initials(name) {
  var clean = ('' + (name || '')).replace(/[^\S]+/g, ' ');
  clean = clean.replace(/^\s+|\s+$/g, '');
  if (!clean) return '?';
  var parts = clean.split(' ');
  var out = '';
  for (var i = 0; i < parts.length && out.length < 2; i++) {
    if (parts[i]) out += parts[i].charAt(0).toUpperCase();
  }
  return out || '?';
}

/* Секунды -> "01:12" (часы:минуты), если часов нет — "18:40" (минуты:секунды) */
function fmtTime(sec) {
  sec = Math.max(0, Math.round(Number(sec) || 0));
  var h = Math.floor(sec / 3600);
  var m = Math.floor((sec % 3600) / 60);
  var s = sec % 60;
  if (h > 0) return pad2(h) + ':' + pad2(m);
  return pad2(m) + ':' + pad2(s);
}

/* Минуты -> "2:46" (часы) или "48 <unit>". Единица измерения — параметром,
   чтобы модуль не зависел от Lang/перевода. */
function fmtRuntime(minutes, unit) {
  minutes = Math.max(0, Math.round(Number(minutes) || 0));
  if (!minutes) return '';
  var h = Math.floor(minutes / 60);
  var m = minutes % 60;
  if (h > 0) return h + ':' + pad2(m);
  return m + ' ' + unit;
}

function each(arr, fn) {
  if (!arr) return;
  for (var i = 0; i < arr.length; i++) fn(arr[i], i);
}

function map(arr, fn) {
  var out = [];
  if (!arr) return out;
  for (var i = 0; i < arr.length; i++) out.push(fn(arr[i], i));
  return out;
}

function filter(arr, fn) {
  var out = [];
  if (!arr) return out;
  for (var i = 0; i < arr.length; i++) {
    if (fn(arr[i], i)) out.push(arr[i]);
  }
  return out;
}

function find(arr, fn) {
  if (!arr) return null;
  for (var i = 0; i < arr.length; i++) {
    if (fn(arr[i], i)) return arr[i];
  }
  return null;
}

LC.util = {
  esc: esc,
  pad2: pad2,
  plural: plural,
  initials: initials,
  fmtTime: fmtTime,
  fmtRuntime: fmtRuntime,
  each: each,
  map: map,
  filter: filter,
  find: find
};

/* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
   ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
   чужой глобальный module.exports, если он есть у страницы (например, у
   Electron/NW.js-обёрток Lampa с nodeIntegration). */
if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.util;

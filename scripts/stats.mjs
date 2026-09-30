// scripts/stats.mjs — сколько раз jsDelivr отдал сборку dist/lumen_card.js, по
// версиям. Только публичный API статистики jsDelivr (data.jsdelivr.com), без
// ключей; ничего не пишет.
//
//   node scripts/stats.mjs                   за месяц: по версиям (7 дней и месяц) и по дням
//   node scripts/stats.mjs --period week     day | week | month | quarter | year | YYYY-MM
//
// Откуда цифры. Загрузчик с GitHub Pages берёт сборку с jsDelivr по тегу
// (lumen.js: …/lumen-card@v<версия>/dist/lumen_card.js?v=<метка>), так что
// хиты тега — это телевизоры и ПК со стабильной версией. Запросы:
//   GET /v1/stats/packages/gh/<repo>/versions?period=P — хиты пакета по
//       версиям (type «version» — теги, jsDelivr пишет их без «v»; «branch» —
//       ветки); у каждой есть links.files;
//   GET /v1/stats/packages/gh/<repo>@<версия>/files?period=P — хиты по файлам
//       версии, из них берётся /dist/lumen_card.js. Ветку со слэшем jsDelivr
//       режет по нему: запросы @feat/lumen-v2/… он считает версией «feat» с
//       файлом /lumen-v2/dist/lumen_card.js (а изредка — «feat/lumen-v2» и
//       «feat%2Flumen-v2»); такие строки сводятся в одну «feat/lumen-v2».
// Ответ — { total, dates: { 'YYYY-MM-DD': хиты } }; последние 1–2 дня
// jsDelivr ещё не посчитал.
import { fileURLToPath } from 'node:url';

export const REPO = 'azarkostya/lumen-card';
const API = 'https://data.jsdelivr.com/v1/stats/packages/gh/' + REPO;
const FILE = '/dist/lumen_card.js';

export const NOTE = [
  'Хит — один запрос сборки, дошедший до jsDelivr (не из кэша браузера). Сборку тега jsDelivr',
  'отдаёт «immutable» с max-age на год, а адрес меняется только с новой версией, поэтому одно',
  'устройство даёт около одного хита на версию — и ещё по хиту, когда браузер вытеснит файл',
  'из кэша (у ТВ кэш маленький, его забивают постеры) или Lampa переустановят. Это примерно',
  '«устройство × версия» (оценка сверху), а не люди: у человека бывает несколько устройств,',
  'устройство без обновлений в новых неделях не видно. main — устройства, где Lampa запустила',
  'плагин из своего кэша (Pages не ответил), и проверки выпуска; feat — бета. Проверки',
  'release.mjs --tag/--remote добавляют по 2 хита тегу. Последние 1–2 дня ещё не посчитаны.'
].join('\n');

/* Строка версии из ответа /versions: подпись, адрес файлов, хиты пакета. */
export function versionRows(list) {
  if (!Array.isArray(list)) return [];
  return list.filter((v) => v && v.version).map((v) => {
    const tag = v.type === 'version';
    const key = v.version;
    // links.files приходит уже с «?period=…» — период подставляется свой.
    const files = v.links && v.links.files ? v.links.files.replace(/\?.*$/, '') : API + '@' + encodeURIComponent(key) + '/files';
    return { key, label: tag ? 'v' + key : key, type: tag ? 'тег' : 'ветка', files, total: v.hits && v.hits.total || 0 };
  });
}

/* Хиты сборки из ответа /files: [{ sub, total, dates }] — sub это остаток
   имени ветки перед /dist/ ('' у тегов и веток без слэша). */
export function distHits(files) {
  if (!Array.isArray(files)) return [];
  return files.filter((f) => f && f.hits && typeof f.name === 'string' && f.name.slice(-FILE.length) === FILE)
    .map((f) => ({ sub: f.name.slice(0, -FILE.length), total: f.hits.total || 0, dates: f.hits.dates || {} }));
}

/* Строки отчёта из версий и их хитов сборки: [{ label, type, hits }], одна на
   подпись (куски одной ветки складываются по дням). */
export function mergeRows(parts) {
  const by = new Map();
  for (const { version, hits } of parts) {
    for (const h of hits) {
      const label = version.type === 'тег' ? version.label : decodeURIComponent(version.key) + h.sub;
      const row = by.get(label) || { label, type: version.type, hits: { total: 0, dates: {} } };
      row.hits.total += h.total;
      for (const d of Object.keys(h.dates)) row.hits.dates[d] = (row.hits.dates[d] || 0) + (h.dates[d] || 0);
      by.set(label, row);
    }
  }
  return [...by.values()];
}

/* Сумма за последние n дней ряда (даты по возрастанию). */
export function lastDays(dates, n) {
  const keys = Object.keys(dates || {}).sort();
  return keys.slice(-n).reduce((sum, k) => sum + (dates[k] || 0), 0);
}

/* rows — [{ label, type, hits: { total, dates } }] (mergeRows). Возвращает текст
   отчёта: таблица по версиям и таблица по дням (с первого дня, где был хоть
   один хит). Версии — по убыванию хитов за период, теги впереди веток. */
export function report(rows, period) {
  const live = rows.filter((r) => r.hits && r.hits.total > 0)
    .sort((a, b) => (a.type === b.type ? b.hits.total - a.hits.total : a.type === 'тег' ? -1 : 1));
  const out = ['jsDelivr, ' + REPO + ': загрузки ' + FILE.slice(1) + ' по версиям, период ' + period, '', NOTE, ''];
  if (!live.length) {
    out.push('Данных нет: за период jsDelivr не отдавал сборку ни одной версии (или ещё не посчитал —');
    out.push('статистика отстаёт на 1–2 дня; сборку по тегу берут загрузчики, выложенные после 1.2.0).');
    return out.join('\n');
  }
  const w = Math.max(8, ...live.map((r) => r.label.length));
  const pad = (s, n) => (s + ' '.repeat(n)).slice(0, n);
  const num = (x, n) => (' '.repeat(n) + x).slice(-n);
  out.push(pad('версия', w) + '  тип    7 дней  период');
  for (const r of live) out.push(pad(r.label, w) + '  ' + pad(r.type, 5) + num(lastDays(r.hits.dates, 7), 8) + num(r.hits.total, 8));
  const tags = live.filter((r) => r.type === 'тег');
  const all = tags.reduce((s, r) => s + r.hits.total, 0);
  out.push('', 'Итого по тегам за период: ' + all + ' (за 7 дней: ' + tags.reduce((s, r) => s + lastDays(r.hits.dates, 7), 0) + ')');

  const days = Object.keys(Object.assign({}, ...live.map((r) => r.hits.dates))).sort();
  const first = days.findIndex((d) => live.some((r) => r.hits.dates[d] > 0));
  const cols = live.map((r) => Math.max(6, r.label.length));
  out.push('', 'По дням:', pad('дата', 10) + live.map((r, i) => '  ' + num(r.label, cols[i])).join(''));
  for (const d of days.slice(first)) out.push(d + live.map((r, i) => '  ' + num(r.hits.dates[d] || 0, cols[i])).join(''));
  return out.join('\n');
}

async function getJson(url) {
  const r = await fetch(url, { headers: { accept: 'application/json' } });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url + (body && body.message ? ' — ' + body.message : ''));
  return body;
}

async function main() {
  const i = process.argv.indexOf('--period');
  const period = i > 0 && process.argv[i + 1] ? process.argv[i + 1] : 'month';
  const q = '?period=' + encodeURIComponent(period);
  try {
    const versions = versionRows(await getJson(API + '/versions' + q + '&limit=100'));
    const parts = [];
    // Файлы — только у версий, которые за период вообще что-то отдавали.
    for (const v of versions.filter((x) => x.total > 0)) {
      parts.push({ version: v, hits: distHits(await getJson(v.files + q)) });
    }
    console.log(report(mergeRows(parts), period));
  } catch (e) {
    console.error('stats: ' + (e && e.message ? e.message : e));
    // exitCode, а не exit(): на Windows exit() при недозакрытом сокете fetch
    // роняет node на assert в libuv.
    process.exitCode = 1;
  }
}

let isMain = false;
try { isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]; } catch (e) { }
if (isMain) main();

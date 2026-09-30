import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { versionRows, distHits, mergeRows, lastDays, report, NOTE } from '../scripts/stats.mjs';

/* scripts/stats.mjs — загрузки сборки с jsDelivr по версиям из публичного API
   data.jsdelivr.com. Здесь — только разбор ответов на фикстуре той же формы
   (без сети). */
const FIX = JSON.parse(readFileSync(new URL('./fixtures/jsdelivr_stats.json', import.meta.url), 'utf8'));

function rows() {
  const versions = versionRows(FIX.versions).filter((v) => v.total > 0);
  return mergeRows(versions.map((v) => ({ version: v, hits: distHits(FIX.files[v.key]) })));
}

test('stats: версии — теги с «v», ветки как есть; адрес файлов без чужого ?period', () => {
  const v = versionRows(FIX.versions);
  assert.deepEqual(v.map((x) => [x.label, x.type, x.total]), [
    ['feat', 'ветка', 77], ['v1.3.0', 'тег', 31], ['feat/lumen-v2', 'ветка', 1], ['v1.2.0', 'тег', 0]
  ]);
  assert.equal(v[1].files, 'https://data.jsdelivr.com/v1/stats/packages/gh/azarkostya/lumen-card@1.3.0/files');
  assert.deepEqual(versionRows(null), []);
  assert.deepEqual(versionRows({ status: 400 }), []);
});

test('stats: из файлов берётся только сборка; ветка со слэшем сводится в одну строку', () => {
  assert.deepEqual(distHits(FIX.files['1.3.0']).map((h) => [h.sub, h.total]), [['', 31]]);
  assert.deepEqual(distHits(FIX.files.feat).map((h) => [h.sub, h.total]), [['/lumen-v2', 40]], 'lumen.js не считается');
  assert.deepEqual(distHits([]), []);
  assert.deepEqual(distHits(undefined), []);
  const r = rows();
  assert.deepEqual(r.map((x) => [x.label, x.type, x.hits.total]), [['feat/lumen-v2', 'ветка', 41], ['v1.3.0', 'тег', 31]]);
  assert.equal(r[0].hits.dates['2026-09-27'], 12, 'куски ветки сложены по дням');
});

test('stats: 7 дней — сумма последних семи дат', () => {
  assert.equal(lastDays({ '2026-09-01': 5, '2026-09-03': 1, '2026-09-02': 2 }, 2), 3);
  assert.equal(lastDays({}, 7), 0);
});

test('stats: отчёт — пояснение, теги впереди, итог по тегам, по дням с первого хита', () => {
  const text = report(rows(), 'week');
  assert.ok(text.indexOf(NOTE) > 0);
  assert.match(NOTE, /устройство × версия/);
  assert.match(NOTE, /не люди/);
  const lines = text.split('\n');
  const head = lines.findIndex((l) => /^версия\s+тип\s+7 дней\s+период$/.test(l));
  assert.ok(head > 0, text);
  assert.match(lines[head + 1], /^v1\.3\.0\s+тег\s+31\s+31$/);
  assert.match(lines[head + 2], /^feat\/lumen-v2\s+ветка\s+41\s+41$/);
  assert.ok(text.indexOf('Итого по тегам за период: 31 (за 7 дней: 31)') >= 0);
  const days = lines.slice(lines.indexOf('По дням:') + 2);
  assert.match(days[0], /^2026-09-22\s+0\s+6$/, 'первая строка — первый день с хитами');
  assert.match(days[days.length - 1], /^2026-09-28\s+8\s+1$/);
});

test('stats: нет данных — понятное сообщение без таблиц', () => {
  const text = report([], 'month');
  assert.match(text, /Данных нет/);
  assert.equal(text.indexOf('По дням:'), -1);
  assert.match(report(mergeRows([{ version: versionRows(FIX.versions)[3], hits: [] }]), 'month'), /Данных нет/);
});

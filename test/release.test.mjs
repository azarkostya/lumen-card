import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { localProblems, behaviorPrefProblems, BEHAVIOR_PREFS, betaSoakWarning } from '../scripts/release.mjs';

/* Релиз 1.0.0: номер версии живёт в одном месте — LC.VERSION в
   src/00_head.js; баннер dist берёт его при сборке, CHANGELOG.md обязан
   иметь раздел этой версии, запасной адрес загрузчика — стабильная ветка
   main. Те же проверки гоняет scripts/release.mjs перед выпуском. */
const read = (p) => { try { return readFileSync(new URL('../' + p, import.meta.url), 'utf8'); } catch (e) { return null; } };

test('релиз: версия 1.4.0 в LC.VERSION, баннере dist и CHANGELOG.md, загрузчик — на main', () => {
  const r = localProblems(read);
  assert.equal(r.version, '1.4.0');
  assert.deepEqual(r.problems, []);
});

test('релиз: проверка ловит несобранный dist, пропущенный раздел CHANGELOG и бету в загрузчике', () => {
  const files = {
    'src/00_head.js': "  LC.VERSION = '1.0.1';\n",
    'dist/lumen_card.js': '// Lumen Card for Lampa v1.0.0\n(function(){})();\n',
    'CHANGELOG.md': '# Журнал\n\n## 1.0.0 — 2026-09-27\n',
    'lumen.js': "var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/';\n"
  };
  const r = localProblems((p) => (p in files ? files[p] : null));
  assert.equal(r.version, '1.0.1');
  assert.equal(r.problems.length, 4, r.problems.join('\n'));
});

/* Пункты, меняющие поведение Lampa, по умолчанию выключены (исключение —
   lumen_netmem, решение владельца): сверка в scripts/release.mjs. */
test('релиз: дефолты пунктов, меняющих поведение Lampa, совпадают со списком в release.mjs', () => {
  assert.deepEqual(behaviorPrefProblems(read), []);
  assert.equal(BEHAVIOR_PREFS.lumen_tsclean, false);
  assert.equal(BEHAVIOR_PREFS.lumen_netmem, true);
});

test('релиз: проверка дефолтов ловит включённый по умолчанию пункт, пропавший пункт и скрытие вне списка', () => {
  const src = "{ name: 'lumen_tsclean', type: 'trigger', 'default': true, label: 'a' },\n" +
    "{ name: 'lumen_ts_health', type: 'trigger', 'default': false, label: 'b' },\n" +
    "{ name: 'lumen_netmem', type: 'trigger', 'default': true, label: 'c' },\n" +
    "{ name: 'lumen_rowmem_bytes', type: 'trigger', 'default': false, label: 'd' },\n" +
    "{ name: 'lumen_ts_resume_focus', type: 'trigger', 'default': false, label: 'f' },\n" +
    "{ name: 'lumen_hide_other', type: 'trigger', 'default': true, label: 'e' },\n";
  const p = behaviorPrefProblems((f) => (f === 'src/81_prefs.js' ? src : null));
  assert.equal(p.length, 3, p.join('\n'));
  assert.match(p.join('\n'), /lumen_tsclean: default = true/);
  assert.match(p.join('\n'), /lumen_parser_fallback не найден/);
  assert.match(p.join('\n'), /lumen_hide_other/);
  assert.equal(behaviorPrefProblems(() => null).length, 1);
});

/* Ревью 1.4: пункт с дефолтом-функцией (платформенный, как у
   lumen_hero_media) литералом не сверить — проверка не должна молча
   пропускать его, а просит сверить вручную. */
test('релиз: дефолт-функция у пункта из BEHAVIOR_PREFS и у lumen_hide_* — ошибка «сверить вручную»', () => {
  const src = "{ name: 'lumen_tsclean', type: 'trigger', 'default': false, label: 'a' },\n" +
    "{ name: 'lumen_ts_health', type: 'trigger', 'default': false, label: 'b' },\n" +
    "{ name: 'lumen_parser_fallback', type: 'trigger', 'default': false, label: 'g' },\n" +
    "{ name: 'lumen_netmem', type: 'trigger', 'default': true, label: 'c' },\n" +
    "{ name: 'lumen_rowmem_bytes', type: 'trigger', 'default': function () { return rowmemBytesDefault(LC.platformInfo()); }, label: 'd' },\n" +
    "{ name: 'lumen_ts_resume_focus', type: 'trigger', 'default': false, label: 'f' },\n" +
    "{ name: 'lumen_hide_other', type: 'trigger', 'default': function () { return true; }, label: 'e' },\n";
  const p = behaviorPrefProblems((f) => (f === 'src/81_prefs.js' ? src : null));
  assert.equal(p.length, 2, p.join('\n'));
  assert.match(p[0], /lumen_rowmem_bytes: дефолт зависит от платформы — сверить вручную/);
  assert.match(p[1], /lumen_hide_other: дефолт зависит от платформы/);
});

test('релиз: бета держится ≥48 ч — моложе коммит даёт предупреждение', () => {
  const now = Date.parse('2026-10-21T12:00:00Z');
  assert.match(betaSoakWarning('2026-10-20T12:00:00Z', now), /моложе 48 ч \(24 ч\)/);
  assert.equal(betaSoakWarning('2026-10-19T12:00:00Z', now), '');
  assert.equal(betaSoakWarning('мусор', now), '');
});

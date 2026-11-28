import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSheets, cssDecls, selectorList, specificity, parseSelector, computed } from './_cascade.mjs';

/* v1.4 P0-1: таблица живёт в двух узлах — основном (lumen-card-css) и узле
   цвета (lumen-accent-deep) СРАЗУ после него (src/30_css.js, deepPlan).
   Объявление, переехавшее в узел цвета, обгоняет все объявления основного
   узла, а в единой таблице оно проигрывало более поздним той же
   специфичности на том же элементе. Проход «спор» обязан переносить такие
   поздние объявления вслед за ним. Здесь — сверка вычисленного вида узлов
   (основной, затем цвета) с единой таблицей. */

const CONFIGS = [
  { label: 'Lumen', storage: {} },
  { label: 'Lumen, чёрная тема и плотные подложки', storage: { lumen_theme: 'black', lumen_solid: true } },
  { label: 'Lumen, «только фон»', storage: { lumen_accent_scope: 'veil', lumen_card_accent: 'ice' } },
  { label: 'Lumen, метки в подписи', storage: { lumen_badges: 'caption' } },
  { label: 'Apple TV', storage: { lumen_flat: 'true' } }
];
const SHEETS = CONFIGS.map((cfg) => ({ ...cfg, ...buildSheets(cfg.storage) }));

/* Сборка 1.4 (ревью беты): метки «43 %», «Осталось 57 мин» и «Новая серия ·
   12 сен» на главной и в сетке — тёмная подложка и цвет текста темы
   (комментарий у правила .lumen-badge--progress), а в узлах вышли залиты
   акцентом: color и background общего правила .lumen-main .lumen-badge
   уехали в узел цвета, модификатор той же специфичности остался в
   основном, а «спор» сверял только общий класс последнего звена. */
test('узлы таблицы: метки «Продолжить» и рядов на постерах — тёмная подложка, как в единой таблице', () => {
  for (const s of SHEETS) {
    const full = cssDecls(s.full);
    const split = cssDecls(s.base + '\n' + s.deep);
    for (const root of ['div.lumen-main', 'div.lumen-grid']) {
      for (const kind of ['progress', 'progress.lumen-badge--left', 'custom', 'new', 'soon']) {
        const path = ['body', root, 'div.card', 'div.card__view', 'div.lumen-badge.lumen-badge--' + kind];
        for (const prop of ['color', 'background', 'border']) {
          const want = computed(full, path, prop);
          const got = computed(split, path, prop);
          const label = s.label + ', ' + root + ' .lumen-badge--' + kind + ' ' + prop;
          assert.equal(got && got.value, want && want.value, label + ': узлы дают ' + (got && got.sel) + ', единая таблица — ' + (want && want.sel));
        }
        const bg = computed(full, path, 'background');
        if (s.storage.lumen_flat) continue;
        assert.ok(bg, s.label + ': у метки ' + kind + ' нет фона');
        if (/^(progress|custom)/.test(kind)) assert.notEqual(bg.value, s.accent, s.label + ': метка ' + kind + ' — тёмная подложка, не акцент');
        else assert.equal(bg.value, s.accent, s.label + ': метка ' + kind + ' — акцентом (приглашение)');
      }
    }
  }
});

/* Класс дефекта целиком: ни одно объявление узла цвета не должно
   обгонять более позднее объявление основного узла, которое может стоять
   на том же элементе. «Тот же элемент» здесь — своя модель, шире прохода
   «спор»: равная специфичность и псевдоэлемент; последние звенья делят
   класс, id или тег (с модификатором БЭМ: X--mod стоит на элементе X) —
   или каждая пара их классов уже встречается вместе в одном звене таблицы
   (значит, на одном узле). Тег против одних классов не сводится: «> div»
   полос — безымянные внутренние узлы. Обёртки @media не различаются. */
const bem = (c) => (c.indexOf('--') > 0 ? c.slice(0, c.indexOf('--')) : c);
function family(prop) {
  const name = prop.replace(/^-(webkit|moz|ms|o)-/, '');
  return name.split('-')[0];
}
function tail(one) {
  const steps = parseSelector(one);
  const last = steps[steps.length - 1] || { tag: null, ids: [], classes: [], pe: '' };
  return { pe: last.pe, tag: last.tag, ids: last.ids, classes: last.classes, spec: specificity(one).join(',') };
}
function sameElement(a, b, together) {
  if (a.ids.length && b.ids.length && !a.ids.some((x) => b.ids.includes(x))) return false;
  if (a.tag && b.tag && a.tag !== b.tag) return false;
  const marksA = a.ids.length + a.classes.length + (a.tag ? 1 : 0);
  const marksB = b.ids.length + b.classes.length + (b.tag ? 1 : 0);
  if (!marksA || !marksB) return true;
  if ((a.tag && a.tag === b.tag) || a.ids.some((x) => b.ids.includes(x))) return true;
  if (!a.classes.length || !b.classes.length) return false;
  if (a.classes.some((x) => b.classes.some((y) => x === y || bem(x) === bem(y)))) return true;
  const kin = (x, y) => x === y || bem(x) === bem(y) || together.has(x + ' ' + y) || together.has(bem(x) + ' ' + bem(y));
  return a.classes.every((x) => b.classes.every((y) => kin(x, y)));
}

test('узлы таблицы: ни одно правило узла цвета не перебивает более позднее правило основного на том же элементе', () => {
  for (const s of SHEETS) {
    const F = cssDecls(s.full);
    const D = cssDecls(s.deep);
    const B = cssDecls(s.base);
    /* Позиции объявлений узла цвета в единой таблице (порядок сохранён —
       это сторожит test/color.test.mjs, checkSplit). */
    const deepAt = new Set();
    let p = 0;
    for (let i = 0; i < F.length && p < D.length; i++) if (F[i].key === D[p].key) { deepAt.add(i); p++; }
    assert.equal(p, D.length, s.label + ': узел цвета — подпоследовательность единой таблицы');
    assert.equal(F.length, B.length + D.length, s.label);
    /* Классы, стоящие вместе в одном звене любого селектора таблицы. */
    const together = new Set();
    for (const d of F) {
      if (!d.sel) continue;
      for (const one of selectorList(d.sel)) {
        for (const step of parseSelector(one)) {
          const cls = step.classes.concat(step.classes.map(bem));
          for (const x of cls) for (const y of cls) if (x !== y) together.add(x + ' ' + y);
        }
      }
    }
    const info = F.map((d) => (d.sel ? selectorList(d.sel).map((one) => ({ one, ...tail(one) })) : []));
    const byFamily = new Map();
    for (let j = 0; j < F.length; j++) {
      if (deepAt.has(j) || !F[j].sel) continue;
      const fam = family(F[j].prop);
      if (!byFamily.has(fam)) byFamily.set(fam, []);
      byFamily.get(fam).push(j);
    }
    const flips = [];
    for (const i of deepAt) {
      if (!F[i].sel) continue;
      for (const j of byFamily.get(family(F[i].prop)) || []) {
        if (j < i || F[j].important !== F[i].important) continue;
        for (const a of info[i]) {
          for (const b of info[j]) {
            if (a.spec !== b.spec || a.pe !== b.pe || !sameElement(a, b, together)) continue;
            flips.push(a.one + ' {' + F[i].decl + '} (узел цвета) перебивает ' + b.one + ' {' + F[j].decl + '}');
          }
        }
      }
    }
    assert.deepEqual([...new Set(flips)], [], s.label + ': каскад узлов перевёрнут');
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSheets, cssDecls, computed } from './_cascade.mjs';

/* Полоса прогресса у нижней кромки картинки и кольцо фокуса внутри кромки
   (LC.focusRingOverlayCss: рамка псевдоэлемента :after над картинкой,
   inset 0, рамка FOCUS_RING и волосяная линия FOCUS_HAIR внутрь).
   Ревью беты 1.4: в «Досмотреть» полоса .26em лежит по самой кромке
   постера, кольцо .27em закрывало её в фокусе целиком; то же у серии в
   карточке. В фокусе полоса обязана быть видна и не пересекаться с
   кольцом, без перехода геометрии; в покое её нижние углы повторяют
   скругление картинки (у кадра нет overflow, квадратные углы торчали за
   кромку). Оба стиля — Lumen и Apple TV — проверяются отдельно. */

const STYLES = [
  { label: 'Lumen', storage: {} },
  { label: 'Apple TV', storage: { lumen_flat: 'true' } }
];
const EPS = 1e-6;

function em(value, label) {
  const v = String(value).trim();
  if (v === '0') return 0;
  const m = /^(-?)(\d*\.?\d+)em$/.exec(v);
  assert.ok(m, label + ': ожидалась длина в em, а не ' + v);
  return (m[1] ? -1 : 1) * parseFloat(m[2]);
}
/* border-radius → { h: [tl, tr, br, bl], v: [...] } в em. */
function radii(value, label) {
  const expand = (list) => {
    const x = list.map((s) => em(s, label));
    if (x.length === 1) return [x[0], x[0], x[0], x[0]];
    if (x.length === 2) return [x[0], x[1], x[0], x[1]];
    if (x.length === 3) return [x[0], x[1], x[2], x[1]];
    return x;
  };
  const [hs, vs] = String(value).split('/');
  const h = expand(hs.trim().split(/\s+/));
  return { h, v: vs ? expand(vs.trim().split(/\s+/)) : h };
}
function val(decls, path, prop, pe) {
  const c = computed(decls, path, prop, pe);
  return c ? c.value : null;
}

/* Кольцо фокуса картинки path: накладка inset 0, рамка FOCUS_RING и
   волосяная линия внутрь; отдаёт, сколько от кромки оно занимает. */
function ringDepth(decls, path, numbers, label) {
  assert.equal(val(decls, path, 'content', 'after'), '""', label + ': кольца фокуса нет');
  for (const side of ['top', 'left', 'right', 'bottom']) assert.equal(val(decls, path, side, 'after'), '0', label + ': кольцо не по кромке (' + side + ')');
  const border = val(decls, path, 'border', 'after');
  assert.ok(border && em(border.split(/\s+/)[0], label) === numbers.ring, label + ': рамка кольца ' + border);
  const offset = em(val(decls, path, 'outline-offset', 'after'), label);
  return Math.max(numbers.ring, -offset);
}

/* Полоса path в фокусе: внутри кольца (снизу и по бокам) и со скруглёнными
   концами; bottomGap(decls) — зазор от нижней кромки картинки. */
function checkFocusBar(decls, bar, fill, depth, bottomGap, label) {
  const h = em(val(decls, bar, 'height'), label);
  assert.ok(h > 0, label + ': высота полосы');
  for (const side of ['left', 'right']) {
    const x = em(val(decls, bar, side), label);
    assert.ok(x >= depth - EPS, label + ': полоса под кольцом сбоку (' + side + ' ' + x + 'em при кольце ' + depth + 'em)');
  }
  const gap = bottomGap(decls, bar);
  assert.ok(gap >= depth - EPS, label + ': полоса под кольцом снизу (зазор ' + gap + 'em при кольце ' + depth + 'em)');
  for (const node of [bar, fill]) {
    const r = radii(val(decls, node, 'border-radius') || '0', label);
    for (const x of r.h.concat(r.v)) assert.ok(x >= h / 2 - EPS, label + ': концы полосы не скруглены (' + val(decls, node, 'border-radius') + ')');
  }
  for (const node of [bar, fill]) {
    for (const prop of ['transition', '-webkit-transition']) {
      const t = val(decls, node, prop);
      assert.ok(!t || t === 'none', label + ': у полосы переход геометрии: ' + t);
    }
  }
}

/* Полоса в покое у самой кромки — нижние углы повторяют радиус картинки:
   по горизонтали радиус картинки, по вертикали — высота полосы. */
function checkRestCorners(decls, bar, picture, bottomGap, label) {
  const left = em(val(decls, bar, 'left'), label);
  const gap = bottomGap(decls, bar);
  if (left > EPS || gap > EPS) return false;
  const h = em(val(decls, bar, 'height'), label);
  const R = radii(val(decls, picture, 'border-radius'), label + ' (картинка)').h[2];
  const r = radii(val(decls, bar, 'border-radius') || '0', label);
  assert.deepEqual(r.h.map((x) => +x.toFixed(4)), [0, 0, R, R], label + ': углы полосы по горизонтали — не радиус картинки ' + R + 'em');
  assert.deepEqual(r.v.map((x) => +x.toFixed(4)), [0, 0, h, h], label + ': углы полосы по вертикали — не высота полосы ' + h + 'em');
  return true;
}

for (const style of STYLES) {
  const sheets = buildSheets(style.storage);
  const decls = cssDecls(sheets.full);
  const numbers = sheets.LC.focusNumbers;

  test(style.label + ': «Досмотреть» — полоса прогресса видна в фокусе внутри кольца, в покое — по скруглению постера', () => {
    const row = ['body.lumen-motion-full', 'div.lumen-main', 'div.items-line', 'div.card'];
    const focus = ['body.lumen-motion-full', 'div.lumen-main', 'div.items-line', 'div.card.focus'];
    const depth = ringDepth(decls, focus.concat('div.card__view'), numbers, style.label + ', кольцо постера');
    assert.ok(depth > 0.3, 'кольцо с волосяной линией: ' + depth);
    const bottom = (d, bar) => em(val(d, bar, 'bottom'), style.label);
    for (const cls of ['div.lumen-badge-bar.lumen-badge-bar--continue', 'div.lumen-badge-bar']) {
      const label = style.label + ', ' + cls;
      const bar = focus.concat('div.card__view', cls);
      checkFocusBar(decls, bar, bar.concat('div'), depth, bottom, label + ' в фокусе');
      const rest = row.concat('div.card__view', cls);
      const edge = checkRestCorners(decls, rest, row.concat('div.card__view'), bottom, label + ' в покое');
      if (/continue/.test(cls)) assert.ok(edge, label + ': в покое полоса — по нижней кромке постера');
    }
  });

  test(style.label + ': серия в карточке — полоса прогресса видна в фокусе внутри кольца', () => {
    const tile = ['body', 'div.lumen-card.lumen-progress-on', 'div.lumen-episodes', 'div.lumen-episodes__viewport', 'div.lumen-episodes__track'];
    const focus = tile.concat('div.lumen-episode.lumen-episode--watching.focus');
    const rest = tile.concat('div.lumen-episode.lumen-episode--watching');
    const depth = ringDepth(decls, focus, numbers, style.label + ', кольцо серии');
    /* Полоса лежит в подписи под кадром (top:100%, left/right 0) и
       отрицательным top возвращается на кадр: зазор от нижней кромки
       кадра — −top − высота. */
    for (const p of [focus, rest]) {
      const bottomBox = p.concat('div.lumen-episode__bottom');
      assert.equal(val(decls, bottomBox, 'position'), 'absolute');
      assert.equal(val(decls, bottomBox, 'top'), '100%', style.label + ': подпись не под кадром');
      assert.equal(val(decls, bottomBox, 'left'), '0');
      assert.equal(val(decls, bottomBox, 'right'), '0');
    }
    const bottom = (d, bar) => -em(val(d, bar, 'top'), style.label) - em(val(d, bar, 'height'), style.label);
    const bar = focus.concat('div.lumen-episode__bottom', 'div.lumen-episode__bar');
    assert.equal(val(decls, bar, 'position'), 'absolute');
    checkFocusBar(decls, bar, bar.concat('div'), depth, bottom, style.label + ', серия в фокусе');
    const restBar = rest.concat('div.lumen-episode__bottom', 'div.lumen-episode__bar');
    const edge = checkRestCorners(decls, restBar, rest, bottom, style.label + ', серия в покое');
    assert.equal(edge, !style.storage.lumen_flat, style.label + ': полоса серии в покое — у кромки только в Lumen (в Apple TV — в треке с полями)');
  });
}

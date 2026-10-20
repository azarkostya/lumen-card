import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* v2 «Единый стиль», экран 37 — ряд серий (src/31_v2_episodes.js). Модуль
   регистрируется в LC.v2css и попадает в таблицу из LC.buildCss
   (src/30_css.js); загрузчик — тот же, что в css.test.mjs, плюс сам модуль. */
globalThis.PLUGIN = 'lumen_card';
globalThis.warn = function () { };

function loadInto(LC, module, name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  new Function('LC', 'module', src)(LC, module);
}

function build(storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def), field: (name) => storage[name] } };
  globalThis.window = { Lampa: Lampa, innerWidth: 960 };
  globalThis.Lampa = Lampa;
  try {
    for (const name of ['10_util.js', '20_icons.js', '80_settings.js', '81_prefs.js', '30_css.js', '31_v2_episodes.js']) loadInto(LC, module, name);
    return { LC, css: LC.buildCss() };
  } finally {
    delete globalThis.window;
    delete globalThis.Lampa;
  }
}

/* Последнее объявление свойства у правила с точно таким селектором (в
   списке селекторов через запятую) — то, что победит при равной
   специфичности. */
function last(css, sel, prop) {
  let found = null;
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const sels = m[1].split(',').map((x) => x.trim());
    if (sels.indexOf(sel) === -1) continue;
    const d = new RegExp('(?:^|;)' + prop.replace(/[-]/g, '\\-') + ':([^;]+)').exec(m[2]);
    if (d) found = d[1];
  }
  return found;
}

const lumen = build({});
const apple = build({ lumen_flat: 'true' });

test('v2 экран 37: метрика плитки 720 px (4K) и зазор 80 — общая для CSS и окна узлов', () => {
  assert.equal(lumen.LC.episodeEm.width, 15.79);
  assert.equal(lumen.LC.episodeEm.gap, 1.75);
  assert.equal(last(lumen.css, '.lumen-card .lumen-episode', 'width'), '15.79em');
  assert.equal(last(lumen.css, '.lumen-card .lumen-episode', 'height'), '8.88em', 'кадр 16:9');
});

test('v2 экран 37: подпись под кадром, «N. Название», длительность и в фокусе', () => {
  for (const { css } of [lumen, apple]) {
    assert.equal(last(css, '.lumen-card .lumen-episode__num', 'display'), 'none', '«E1» на кадре остался');
    assert.equal(last(css, '.lumen-card .lumen-episode__name:before', 'content'), 'attr(data-n) ".\\00a0"');
    assert.equal(last(css, '.lumen-card .lumen-episode__bottom', 'top'), '100%', 'подпись не под кадром');
    assert.equal(last(css, '.lumen-card .lumen-episode.focus .lumen-episode__caption', 'display'), 'block');
    assert.equal(last(css, '.lumen-card.lumen-progress-on.lumen-compact .lumen-episode.focus .lumen-episode__caption', 'display'), 'block', 'длительность пропадает в фокусе');
    assert.equal(last(css, '.lumen-card .lumen-episodes .lumen-episode--past:not(.focus)', 'opacity'), '0', 'плитка за левой кромкой видна');
  }
  /* Масштаб фокуса — и в «Лёгких» (экран 33): правило v2 стоит после
     правила «Лёгких», модуль его не перебивает. */
  assert.ok(/scale\(1\.08\)/.test(last(lumen.css, '.lumen-card .lumen-episodes .lumen-episode.focus', 'transform')));
  assert.ok(/scale\(1\.09\)/.test(last(apple.css, '.lumen-card .lumen-episodes .lumen-episode.focus', 'transform')));
});

test('v2 экран 37: прогресс — акцентом у кромки (L), белым в треке .28 (A)', () => {
  assert.equal(last(lumen.css, '.lumen-card .lumen-episode__bar', 'height'), '.26em');
  assert.equal(last(lumen.css, '.lumen-card .lumen-episode__bar', 'background'), 'none');
  assert.equal(last(apple.css, '.lumen-card .lumen-episode__bar', 'height'), '.22em');
  assert.equal(last(apple.css, '.lumen-card .lumen-episode__bar', 'background'), 'rgba(255,255,255,.28)');
  assert.equal(last(apple.css, '.lumen-card .lumen-episode__bar > div', 'background'), '#FFFFFF');
});

test('v2 экран 37: сезоны — выбранный с галочкой (L) или подчёркнут (A), фокус — заливка', () => {
  assert.ok(/mask-image/.test(lumen.css.slice(lumen.css.indexOf('.lumen-card .lumen-season--on:before{'))), 'галочки у выбранного чипа нет');
  assert.ok(last(lumen.css, '.lumen-card .lumen-season.focus', 'background'));
  assert.equal(last(apple.css, '.lumen-card .lumen-season.focus', 'background'), '#FFFFFF');
  assert.ok(/inset 0 -\.13em 0 #FFFFFF/.test(last(apple.css, '.lumen-card .lumen-season--on', 'box-shadow')));
  assert.equal(last(lumen.css, '.lumen-card .lumen-episodes--seasons .lumen-episodes__title', 'display'), 'none');
});

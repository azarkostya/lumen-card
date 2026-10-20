import test from 'node:test'; import assert from 'node:assert/strict';
import { load, loadCtx } from './_load.mjs';

/* v2 «Единый стиль», экран 43: LC.typo — правила кириллицы (src/31_v2_typo.js). */
const t = load('31_v2_typo.js');
const NB = ' ';

test('nbsp: разряды от 1000 и число с единицей не рвутся', () => {
  assert.equal(t.nbsp('20 000 лет назад'), '20' + NB + '000' + NB + 'лет назад');
  assert.equal(t.nbsp('1 234 567 зрителей'), '1' + NB + '234' + NB + '567 зрителей');
  assert.equal(t.nbsp('18,4 ГБ'), '18,4' + NB + 'ГБ');
  assert.equal(t.nbsp('67 мин'), '67' + NB + 'мин');
  assert.equal(t.nbsp('2 ч 28 мин'), '2' + NB + 'ч 28' + NB + 'мин');
  assert.equal(t.nbsp('в 3 минах'), 'в 3 минах', 'слово, начинающееся с единицы, не трогается');
  assert.equal(t.nbsp('2012 год'), '2012' + NB + 'год');
  assert.equal(t.nbsp(''), '');
  assert.equal(t.nbsp(null), '');
});

test('dash: « - » и « – » → « — »; дефис внутри слова остаётся', () => {
  assert.equal(t.dash('2012 - США'), '2012 — США');
  assert.equal(t.dash('Кобб – вор'), 'Кобб — вор');
  assert.equal(t.dash('Санта-Барбара'), 'Санта-Барбара');
});

test('ellipsis: «....» и «...» → «…», знаки перед ним срезаны', () => {
  assert.equal(t.ellipsis('годы....'), 'годы…');
  assert.equal(t.ellipsis('и так далее...'), 'и так далее…');
  assert.equal(t.ellipsis('годы, …'), 'годы…');
  assert.equal(t.ellipsis('годы……'), 'годы…');
  assert.equal(t.ellipsis('т. е. обычный текст.'), 'т. е. обычный текст.');
});

test('clip: по границе слова, без висячего дефиса и знаков перед «…»', () => {
  const s = 'Действие происходит в Санта-Барбаре в тридцатые годы';
  const out = t.clip(s, 30);
  assert.equal(out, 'Действие происходит в…');
  assert.ok(!/-…$/.test(out));
  assert.equal(t.clip('Короткий текст', 40), 'Короткий текст');
  assert.equal(t.clip('Один, два, три четыре', 10), 'Один, два…');
});

test('text: всё сразу', () => {
  assert.equal(t.text('Через 20 000 лет  - годы....'), 'Через 20' + NB + '000' + NB + 'лет — годы…');
});

test('bigNumber: «2 тыс.», «3,4 тыс.», «12 тыс.», «1,2 млн»; латинской K нет', () => {
  assert.equal(t.bigNumber(950), '950');
  assert.equal(t.bigNumber(2000), '2' + NB + 'тыс.');
  assert.equal(t.bigNumber(2040), '2' + NB + 'тыс.');
  assert.equal(t.bigNumber(3400), '3,4' + NB + 'тыс.');
  assert.equal(t.bigNumber(12345), '12' + NB + 'тыс.');
  assert.equal(t.bigNumber(999600), '1' + NB + 'млн');
  assert.equal(t.bigNumber(1234567), '1,2' + NB + 'млн');
  assert.equal(t.bigNumber('x'), '0');
  assert.equal(t.bigNumber(3400, { k: '%sK', m: '%sM', dec: '.' }), '3.4K');
});

test('bigNumber и films берут слова из LC.STRINGS текущего языка', () => {
  const STRINGS = {
    lumen_typo_thousand: { en: '%sK' }, lumen_typo_million: { en: '%sM' }, lumen_typo_decimal: { en: '.' },
    lumen_typo_films: { en: 'film|films' }
  };
  const { api } = loadCtx('31_v2_typo.js', { STRINGS, lang: (key) => STRINGS[key].en });
  assert.equal(api.bigNumber(3400), '3.4K');
  assert.equal(api.films(1), '1' + NB + 'film');
  assert.equal(api.films(5), '5' + NB + 'films');
});

test('films: склонение «фильм, фильма, фильмов»', () => {
  assert.equal(t.films(1), '1' + NB + 'фильм');
  assert.equal(t.films(3), '3' + NB + 'фильма');
  assert.equal(t.films(5), '5' + NB + 'фильмов');
  assert.equal(t.films(21), '21' + NB + 'фильм');
});

test('titleStep: до 14 знаков — 1, 15–28 — 2, длиннее — 3', () => {
  assert.equal(t.titleStep('Начало'), 1);
  assert.equal(t.titleStep('Городские дети'), 1);
  assert.equal(t.titleStep('Медленные лошади'), 2);
  assert.equal(t.titleStep('Гарри Поттер и Дары Смерти: Часть 2'), 3);
});

test('stripPrefix: «Голодные игры» — первый фильм сохраняет имя, у остальных префикс снят', () => {
  const out = t.stripPrefix([
    'Голодные игры',
    'Голодные игры: И вспыхнет пламя',
    'Голодные игры: Сойка-пересмешница. Часть 1',
    'Голодные игры: Сойка-пересмешница. Часть 2',
    'Голодные игры: Баллада о змеях и певчих птицах'
  ]);
  assert.deepEqual(out.map(x => x.t), [
    'Голодные игры', 'И вспыхнет пламя', 'Сойка-пересмешница. Часть 1', 'Сойка-пересмешница. Часть 2', 'Баллада о змеях и певчих птицах'
  ]);
});

test('stripPrefix: «Звёздные войны: Эпизод 5 — …» → название и «Эпизод V» второй строкой', () => {
  const out = t.stripPrefix([
    'Звёздные войны: Эпизод 4 — Новая надежда',
    'Звёздные войны: Эпизод 5 — Империя наносит ответный удар',
    'Звёздные войны: Эпизод VI – Возвращение джедая'
  ]);
  assert.deepEqual(out[1], { t: 'Империя наносит ответный удар', s: 'Эпизод V' });
  assert.deepEqual(out[2], { t: 'Возвращение джедая', s: 'Эпизод VI' });
});

test('stripPrefix: без общего префикса у всех, остаток в одно слово и одиночка — без изменений', () => {
  const mixed = ['Дюна', 'Дюна: Часть вторая', 'Начало'];
  assert.deepEqual(t.stripPrefix(mixed).map(x => x.t), mixed, 'префикс не у всех — ряд не трогаем');
  const short = ['Мстители', 'Мстители: Финал', 'Мстители: Война бесконечности'];
  assert.deepEqual(t.stripPrefix(short).map(x => x.t), ['Мстители', 'Мстители: Финал', 'Война бесконечности']);
  assert.deepEqual(t.stripPrefix(['Голодные игры: И вспыхнет пламя']).map(x => x.t), ['Голодные игры: И вспыхнет пламя']);
  assert.deepEqual(t.stripPrefix([]), []);
  assert.deepEqual(t.stripPrefix(null), []);
});

test('stripCards: пишет только .card__title и возвращает полное имя, если префикс пропал', () => {
  function card(title) {
    const titleNode = { textContent: title };
    return { card_data: { title }, querySelector: (sel) => (sel === '.card__title' ? titleNode : null), titleNode };
  }
  const a = card('Голодные игры'), b = card('Голодные игры: И вспыхнет пламя'), d = card('Голодные игры: Сойка-пересмешница. Часть 1');
  t.stripCards([a, b, d]);
  assert.equal(a.titleNode.textContent, 'Голодные игры');
  assert.equal(b.titleNode.textContent, 'И вспыхнет пламя');
  const c = card('Начало');
  t.stripCards([a, b, d, c]);
  assert.equal(b.titleNode.textContent, 'Голодные игры: И вспыхнет пламя');
});

/* CSS экранов 43/44/46 — модуль в точке LC.v2css (src/30_css.js). */
import { readFileSync } from 'node:fs';
function cssWith(storage) {
  globalThis.PLUGIN = 'lumen_card';
  globalThis.warn = function () { };
  const prev = globalThis.window; const prevLampa = globalThis.Lampa;
  globalThis.Lampa = { Storage: { get: (name, def) => (name in storage ? storage[name] : def), field: () => undefined } };
  globalThis.window = { Lampa: globalThis.Lampa };
  try {
    const LC = {}; const module = { exports: null, lumen: true };
    for (const f of ['10_util.js', '20_icons.js', '31_v2_typo.js', '80_settings.js', '81_prefs.js', '30_css.js']) {
      new Function('LC', 'module', readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8'))(LC, module);
    }
    return LC.buildCss();
  } finally {
    globalThis.window = prev; globalThis.Lampa = prevLampa;
  }
}

test('CSS 43/46: ступени названия, зазор логотипа, подъём ряда, fade «Лёгких», smoke → muted', () => {
  const css = cssWith({});
  assert.ok(css.includes('.lumen-hero .lumen-hero__title[data-lc-step="2"]{font-size:2.8em'), 'ступень 2');
  assert.ok(css.includes('.lumen-hero .lumen-hero__title[data-lc-step="3"]{font-size:2.3em'), 'ступень 3');
  assert.ok(/data-lc-step="3"\]\{[^}]*-webkit-line-clamp:2/.test(css), 'до двух строк');
  assert.ok(css.includes('.lumen-hero.lumen-hero--logo .lumen-hero__meta{margin-top:.9em}'));
  assert.ok(css.includes('.lumen-main .scroll.layer--wheight{top:-1.75em}'), 'ряд поднят на 40 px FHD');
  assert.ok(css.includes('.lumen-hero-stage.lumen-motion-lite .lumen-hero__bg--b{-webkit-transition:opacity .22s'), 'fade 220 мс только у слоя кадра');
  assert.ok(!/lumen-motion-lite \.lumen-hero__bg--[ab][^{]*\{[^}]*transition:(?!opacity|none)/.test(css), 'у слоёв кадра в «Лёгких» — только opacity');
  assert.ok(/\.lumen-descr-row \.lumen-fr-card__year\{color:#A89A8A\}/.test(css), 'год во франшизе — P.muted');
  assert.ok(css.includes('.lumen-main .card__title,.lumen-grid .lumen-gcard .card__title{font-weight:500}'));
  assert.ok(css.includes('letter-spacing:-.01em'), 'Golos: −1 % у крупного');
});

test('CSS 43: Apple TV — Inter с разрядкой −.02em у крупного', () => {
  const css = cssWith({ lumen_flat: true, lumen_style: 'appletv' });
  assert.ok(css.includes('.lumen-hero .lumen-hero__title{letter-spacing:-.02em}'));
});

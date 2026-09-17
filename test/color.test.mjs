import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 24: акцент интерфейса от постера фильма.

   Чистая часть (перевод цветовых пространств, контраст, доминанта, подбор
   четвёрки токенов) тестируется без браузера; рантайм (canvas, кэш,
   применение) — на заглушках Image/document/Lampa, как в test/badges.test.mjs. */

globalThis.PLUGIN = 'lumen_card';
let warnLog = [];
globalThis.warn = function (msg, err) { warnLog.push({ msg: msg, err: err }); };

const SRC = readFileSync(new URL('../src/57_color.js', import.meta.url), 'utf8');

/* Свежий экземпляр модуля. deps копируются в LC до выполнения src
   (pref/tokens/injectCss подменяются тестами рантайма). */
function fresh(deps) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const util = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');
  new Function('LC', 'module', util)(LC, { exports: null, lumen: false });
  const extra = deps || {};
  for (const k in extra) LC[k] = extra[k];
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC: LC };
}

const color = fresh().api;

/* Фон карточки по умолчанию (тёплая тёмная тема, C.bg в src/30_css.js). */
const BG = '#0B0908';

/* ---------------------------------------------------------------------- */
/* Цветовые пространства и контраст.                                       */
/* ---------------------------------------------------------------------- */

test('color: rgbToHsl -> hslToRgb возвращает исходный цвет', () => {
  const samples = [
    { r: 232, g: 184, b: 122 }, /* песок — акцент по умолчанию */
    { r: 127, g: 183, b: 201 }, /* лёд */
    { r: 0, g: 0, b: 0 },
    { r: 255, g: 255, b: 255 },
    { r: 17, g: 17, b: 17 },
    { r: 12, g: 90, b: 200 },
    { r: 200, g: 30, b: 30 },
    { r: 30, g: 200, b: 90 }
  ];
  for (const rgb of samples) {
    const back = color.hslToRgb(color.rgbToHsl(rgb));
    assert.deepEqual(back, rgb, JSON.stringify(rgb) + ' -> ' + JSON.stringify(back));
  }
});

test('color: rgbToHsl даёт оттенок в градусах, насыщенность и светлоту в долях', () => {
  const red = color.rgbToHsl({ r: 255, g: 0, b: 0 });
  assert.equal(Math.round(red.h), 0);
  assert.equal(red.s, 1);
  assert.equal(red.l, 0.5);

  const blue = color.rgbToHsl({ r: 0, g: 0, b: 255 });
  assert.equal(Math.round(blue.h), 240);

  /* Серый: оттенка нет, насыщенность ноль (доминанта такие пиксели выкидывает). */
  const grey = color.rgbToHsl({ r: 128, g: 128, b: 128 });
  assert.equal(grey.s, 0);
});

test('color: hex и parseHex — пара', () => {
  assert.equal(color.hex({ r: 232, g: 184, b: 122 }), '#E8B87A');
  assert.equal(color.hex({ r: 0, g: 0, b: 0 }), '#000000');
  assert.deepEqual(color.parseHex('#7FB7C9'), { r: 127, g: 183, b: 201 });
  assert.deepEqual(color.parseHex('7FB7C9'), { r: 127, g: 183, b: 201 });
});

test('color: contrast — формула WCAG 2.1, принимает и hex, и rgb', () => {
  assert.equal(color.contrast('#FFFFFF', '#000000').toFixed(0), '21');
  assert.equal(color.contrast('#777777', '#FFFFFF').toFixed(1), '4.5');
  assert.equal(color.contrast({ r: 255, g: 255, b: 255 }, '#000000').toFixed(0), '21');
  /* Порядок аргументов на результат не влияет. */
  assert.equal(color.contrast('#000000', '#FFFFFF').toFixed(0), '21');
});

test('color: девять акцентов плагина проходят собственную проверку контраста', () => {
  /* Значения — ACCENTS из src/30_css.js. Если модуль считает контраст иначе,
     чем тест CSS, авто-акцент жил бы по другим правилам читаемости, чем
     выбранный руками. */
  const pairs = [
    ['#E8B87A', '#1A120A'], ['#D0925F', '#1A0E06'], ['#C46A8F', '#1C0A12'],
    ['#E08592', '#1A070B'], ['#9FCF8A', '#0C1608'], ['#7ACCA0', '#06170F'],
    ['#7FB7C9', '#08171C'], ['#B3A3E8', '#130E22'], ['#BDB8B2', '#131211']
  ];
  for (const pair of pairs) {
    assert.ok(color.contrast(pair[1], pair[0]) >= 4.5, 'текст на акценте ' + pair[0]);
    assert.ok(color.contrast(pair[0], BG) >= 4.5, 'акцент на фоне ' + pair[0]);
  }
});

/* ---------------------------------------------------------------------- */
/* Доминанта постера.                                                      */
/* ---------------------------------------------------------------------- */

/* Собирает массив RGBA той же формы, что отдаёт canvas getImageData. */
function pixels(list) {
  const out = [];
  for (const item of list) {
    for (let i = 0; i < (item.n || 1); i++) out.push(item.r, item.g, item.b, item.a === undefined ? 255 : item.a);
  }
  return out;
}

test('color: dominant — 70 % серых пикселей не перебивают 30 % синих', () => {
  const data = pixels([
    { r: 120, g: 121, b: 122, n: 70 },
    { r: 40, g: 90, b: 200, n: 30 }
  ]);
  const rgb = color.dominant(data);
  assert.ok(rgb, 'доминанта найдена');
  assert.ok(rgb.b > rgb.r && rgb.b > rgb.g, 'цвет синий: ' + JSON.stringify(rgb));
});

test('color: dominant — отбрасывает почти чёрные, почти белые и прозрачные', () => {
  assert.equal(color.dominant(pixels([{ r: 8, g: 6, b: 10, n: 40 }])), null, 'почти чёрный');
  assert.equal(color.dominant(pixels([{ r: 250, g: 248, b: 252, n: 40 }])), null, 'почти белый');
  assert.equal(color.dominant(pixels([{ r: 120, g: 120, b: 122, n: 40 }])), null, 'почти серый');
  assert.equal(color.dominant(pixels([{ r: 40, g: 90, b: 200, n: 40, a: 0 }])), null, 'прозрачный');
  assert.equal(color.dominant([]), null, 'пустой массив');
  assert.equal(color.dominant(null), null, 'нет данных');
});

test('color: dominant — берёт преобладающий оттенок, а не среднее по всем', () => {
  /* Постер «оранжевый плакат с синей полосой»: усреднение всех цветных
     пикселей дало бы грязно-серый, поэтому цвета сначала раскладываются по
     оттенкам и побеждает самая весомая группа. */
  const data = pixels([
    { r: 220, g: 130, b: 40, n: 60 },
    { r: 210, g: 140, b: 50, n: 20 },
    { r: 30, g: 60, b: 210, n: 20 }
  ]);
  const rgb = color.dominant(data);
  assert.ok(rgb.r > rgb.b, 'оранжевый победил: ' + JSON.stringify(rgb));
  const hsl = color.rgbToHsl(rgb);
  assert.ok(hsl.h >= 20 && hsl.h <= 45, 'оттенок оранжевый: ' + hsl.h);
});

/* ---------------------------------------------------------------------- */
/* Подбор четвёрки токенов.                                                */
/* ---------------------------------------------------------------------- */

test('color: adjust держит насыщенность и светлоту в рамках акцента', () => {
  const dull = color.adjust({ h: 30, s: 0.05, l: 0.12 }, BG);
  assert.ok(dull.s >= 0.45 && dull.s <= 0.85, 'насыщенность: ' + dull.s);
  assert.ok(dull.l >= 0.55, 'светлота не ниже 0.55: ' + dull.l);
  assert.ok(dull.l <= 0.92, 'светлота не выше предела: ' + dull.l);

  const bright = color.adjust({ h: 30, s: 0.99, l: 0.95 }, BG);
  assert.ok(bright.s <= 0.85, 'слишком насыщенный зажат: ' + bright.s);
  assert.ok(bright.l <= 0.72 || bright.l <= 0.92, 'светлота в рамках: ' + bright.l);
});

test('color: adjust поднимает светлоту тёмным оттенкам, пока не станет читаемо', () => {
  /* Синий при l = 0.55 на почти чёрном фоне даёт контраст ~2.5:1 — ниже
     порога 4.5:1, поэтому светлота растёт шагами до первого читаемого
     значения, а не остаётся на нижней границе рамки. */
  const blue = color.adjust({ h: 240, s: 0.8, l: 0.4 }, BG);
  assert.ok(blue.l > 0.6, 'светлота поднята выше нижней границы: ' + blue.l);
  const rgb = color.hslToRgb(blue);
  assert.ok(color.contrast(rgb, BG) >= 4.5, 'акцент на фоне: ' + color.contrast(rgb, BG));
});

test('color: onAccent — тёмный тон того же оттенка', () => {
  const on = color.onAccent({ h: 35, s: 0.6, l: 0.6 });
  assert.equal(on.h, 35, 'оттенок сохранён');
  assert.ok(on.l <= 0.12, 'светлота: ' + on.l);
  const rgb = color.hslToRgb(on);
  assert.ok(Math.max(rgb.r, rgb.g, rgb.b) <= 60, 'тон тёмный: ' + JSON.stringify(rgb));
});

test('color: glow — rgba с прозрачностью .35', () => {
  assert.equal(color.glow({ r: 232, g: 184, b: 122 }), 'rgba(232,184,122,0.35)');
});

test('color: tokens — четвёрка того же вида, что у акцентов настроек', () => {
  const t = color.tokens({ r: 180, g: 90, b: 30 }, BG);
  assert.ok(t, 'токены посчитаны');
  assert.match(t.color, /^#[0-9A-F]{6}$/);
  assert.match(t.light, /^#[0-9A-F]{6}$/);
  assert.match(t.onac, /^#[0-9A-F]{6}$/);
  assert.match(t.glow, /^rgba\(\d+,\d+,\d+,0\.35\)$/);
});

test('color: tokens любого постера читаются — не ниже 4.5:1 в обе стороны', () => {
  /* Обход цветового круга с разной насыщенностью и светлотой: ни один
     результат не имеет права оказаться нечитаемым — иначе кнопки в фокусе
     сливались бы с фоном или подпись на них пропадала. */
  for (let h = 0; h < 360; h += 15) {
    for (const s of [0.15, 0.5, 0.95]) {
      for (const l of [0.08, 0.3, 0.55, 0.85]) {
        const rgb = color.hslToRgb({ h: h, s: s, l: l });
        const t = color.tokens(rgb, BG);
        assert.ok(t, 'токены для hsl(' + h + ',' + s + ',' + l + ')');
        const onText = color.contrast(t.onac, t.color);
        const onBg = color.contrast(t.color, BG);
        assert.ok(onText >= 4.5, 'текст на акценте hsl(' + h + ',' + s + ',' + l + '): ' + onText.toFixed(2));
        assert.ok(onBg >= 4.5, 'акцент на фоне hsl(' + h + ',' + s + ',' + l + '): ' + onBg.toFixed(2));
      }
    }
  }
});

test('color: tokens на чёрной теме считаются от её фона', () => {
  const t = color.tokens({ r: 40, g: 90, b: 200 }, '#000000');
  assert.ok(color.contrast(t.color, '#000000') >= 4.5);
});

test('color: tokens сохраняют оттенок постера', () => {
  const t = color.tokens({ r: 40, g: 90, b: 200 }, BG);
  const hsl = color.rgbToHsl(color.parseHex(t.color));
  assert.ok(Math.abs(hsl.h - 219) <= 6, 'оттенок исходного синего: ' + hsl.h);
});

test('color: tokens без цвета — null (фолбэк на акцент из настроек)', () => {
  assert.equal(color.tokens(null, BG), null);
});

/* ---------------------------------------------------------------------- */
/* Рантайм: canvas, кэш, отмена.                                           */
/* ---------------------------------------------------------------------- */

/* Заглушки Image/canvas. images — журнал созданных картинок: тест сам
   вызывает onload/onerror и решает, отдаёт ли getImageData пиксели. */
function fakeDom(opts) {
  const state = { images: [], drawn: 0, reads: 0 };
  const options = opts || {};
  function FakeImage() {
    const img = this;
    img.crossOrigin = '';
    img.onload = null;
    img.onerror = null;
    img.naturalWidth = 185;
    img.naturalHeight = 278;
    state.images.push(img);
    Object.defineProperty(img, 'src', {
      get: function () { return img._src || ''; },
      set: function (v) { img._src = v; }
    });
  }
  const document = {
    createElement: function (tag) {
      if (tag !== 'canvas') return {};
      return {
        width: 0,
        height: 0,
        getContext: function () {
          return {
            drawImage: function () { state.drawn++; },
            getImageData: function (x, y, w, h) {
              state.reads++;
              if (options.tainted) {
                const err = new Error('The canvas has been tainted by cross-origin data.');
                err.name = 'SecurityError';
                throw err;
              }
              return { data: options.data || pixels([{ r: 40, g: 90, b: 200, n: w * h }]) };
            }
          };
        }
      };
    }
  };
  /* Lampa.TMDB.image — единственное, что модуль берёт у Lampa: адрес
     маленькой копии постера (он уважает TMDB-прокси пользователя). */
  const Lampa = { TMDB: { image: function (path) { return 'https://image.tmdb.org/' + path; } } };
  const window = { document: document, Lampa: Lampa };
  return { state: state, globals: { window: window, document: document, Image: FakeImage, Lampa: Lampa } };
}

function withDom(dom, fn) {
  const saved = {};
  for (const k in dom.globals) { saved[k] = globalThis[k]; globalThis[k] = dom.globals[k]; }
  try { return fn(); } finally {
    for (const k in dom.globals) {
      if (saved[k] === undefined) delete globalThis[k]; else globalThis[k] = saved[k];
    }
  }
}

test('color: fromImage считает цвет по уменьшенной копии — 16×16, один getImageData', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let got = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/a.jpg', (rgb) => { got = rgb; });
    assert.equal(dom.state.images.length, 1, 'ровно одна картинка');
    assert.equal(dom.state.images[0].crossOrigin, 'anonymous', 'запрос с CORS — иначе пиксели закрыты');
    assert.equal(dom.state.images[0].src, 'https://image.tmdb.org/t/p/w185/a.jpg');
    dom.state.images[0].onload();
    assert.equal(dom.state.drawn, 1, 'один drawImage');
    assert.equal(dom.state.reads, 1, 'один getImageData — попиксельного обхода постера нет');
    assert.ok(got && got.b > got.r, 'синий постер: ' + JSON.stringify(got));
  });
});

test('color: fromImage — «испорченный» canvas отдаёт null, а не исключение', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    let got = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/b.jpg', (rgb) => { got = rgb; });
    dom.state.images[0].onload();
    assert.equal(got, null);
  });
});

test('color: fromImage — ошибка загрузки отдаёт null', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let got = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/c.jpg', (rgb) => { got = rgb; });
    dom.state.images[0].onerror();
    assert.equal(got, null);
  });
});

test('color: fromImage — второй запрос того же постера идёт из кэша, без новой картинки', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let first = null;
    api.fromImage('https://image.tmdb.org/t/p/w185/d.jpg', (rgb) => { first = rgb; });
    dom.state.images[0].onload();
    let second = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/d.jpg', (rgb) => { second = rgb; });
    assert.equal(dom.state.images.length, 1, 'вторая картинка не создавалась');
    assert.deepEqual(second, first, 'ответ тот же');
  });
});

test('color: кэш помнит и неудачу — по тому же постеру повторно не ходим', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/e.jpg', () => {});
    dom.state.images[0].onload();
    let second = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/e.jpg', (rgb) => { second = rgb; });
    assert.equal(dom.state.images.length, 1);
    assert.equal(second, null);
  });
});

test('color: кэш ограничен 50 записями и вытесняет самые старые', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    for (let i = 0; i < 60; i++) {
      api.fromImage('u' + i, () => {});
      dom.state.images[dom.state.images.length - 1].onload();
    }
    assert.equal(api.cacheSize(), 50, 'размер кэша');
    /* Самый старый вытеснен — за ним идём заново, свежий отдаётся из кэша. */
    const before = dom.state.images.length;
    api.fromImage('u59', () => {});
    assert.equal(dom.state.images.length, before, 'свежая запись на месте');
    api.fromImage('u0', () => {});
    assert.equal(dom.state.images.length, before + 1, 'старая запись вытеснена');
  });
});

test('color: cancel снимает обработчики и глушит поздний ответ', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let called = 0;
    const handle = api.fromImage('https://image.tmdb.org/t/p/w185/f.jpg', () => { called++; });
    handle.cancel();
    const img = dom.state.images[0];
    assert.equal(img.onload, null, 'обработчик загрузки снят');
    assert.equal(img.onerror, null, 'обработчик ошибки снят');
    assert.equal(api.pending(), 0, 'незавершённых картинок не осталось');
    assert.equal(called, 0, 'колбэк после отмены молчит');
  });
});

test('color: pending считает незавершённые картинки', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/g.jpg', () => {});
    assert.equal(api.pending(), 1);
    dom.state.images[0].onload();
    assert.equal(api.pending(), 0, 'после ответа картинка отпущена');
  });
});

/* ---------------------------------------------------------------------- */
/* LC.accent: переопределение акцента на время карточки.                   */
/* ---------------------------------------------------------------------- */

/* LC с подменёнными зависимостями CSS-модуля и Lampa.TMDB. */
function accentCtx(opts) {
  const options = opts || {};
  const state = { injects: 0 };
  const deps = {
    pref: function (name, def) {
      if (Object.prototype.hasOwnProperty.call(options.prefs || {}, name)) return options.prefs[name];
      return def;
    },
    enabled: function () { return options.enabled === undefined ? true : options.enabled; },
    /* Ревью фазы 3 (Important 2): акцент от постера считается и применяется
       только при полных анимациях — пересборка ~81 КБ стилей на каждую
       остановку фокуса на слабом ТВ дороже самого акцента. */
    motionMode: function () { return options.motion || 'full'; },
    tokens: function () { return { bg: options.bg || BG }; },
    injectCss: function () { state.injects++; }
  };
  const ctx = fresh(deps);
  return { api: ctx.api, LC: ctx.LC, state: state };
}

test('accent: выключенная настройка не трогает акцент и не грузит картинок', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: false } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(dom.state.images.length, 0, 'картинок нет');
    assert.equal(ctx.LC.accent.current(), null, 'переопределения нет');
    assert.equal(ctx.state.injects, 0, 'CSS не пересобирался');
  });
});

test('accent: включённая настройка считает акцент по постеру и пересобирает CSS', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(dom.state.images.length, 1);
    assert.equal(dom.state.images[0].src, 'https://image.tmdb.org/t/p/w185/a.jpg', 'маленькая копия постера');
    dom.state.images[0].onload();
    const t = ctx.LC.accent.current();
    assert.ok(t, 'акцент посчитан');
    assert.match(t.color, /^#[0-9A-F]{6}$/);
    assert.equal(ctx.state.injects, 1, 'CSS пересобран один раз');
  });
});

test('accent: постера нет — переопределение снимается', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.ok(ctx.LC.accent.current());
    ctx.LC.accent.applyFor({ });
    assert.equal(ctx.LC.accent.current(), null, 'акцент вернулся к выбранному в настройках');
    assert.equal(ctx.state.injects, 2, 'пересборка на применение и на сброс');
  });
});

test('accent: пиксели закрыты — акцент из настроек, повторной пересборки нет', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.equal(ctx.LC.accent.current(), null);
    assert.equal(ctx.state.injects, 0, 'акцент не менялся — CSS пересобирать незачем');
  });
});

/* Ревью фазы 3 (Important 2): у подкраски фона гейт по режиму анимаций был,
   а у расчёта и применения самого акцента — нет, хотя стоит он дороже всего
   остального: каждое применение пересобирает ~81 КБ стилей и заставляет
   браузер пересчитать стили всего документа. */
test('accent: в lite и off не считается и не применяется вовсе', () => {
  for (const mode of ['lite', 'off']) {
    const dom = fakeDom({});
    withDom(dom, () => {
      const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' }, motion: mode });
      ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
      assert.equal(dom.state.images.length, 0, mode + ': постер даже не грузится');
      assert.equal(ctx.LC.accent.current(), null, mode + ': акцент из настроек');
      assert.equal(ctx.state.injects, 0, mode + ': стили не пересобирались');
    });
  }
});

/* Ревью фазы 3 (Important 2): у каждой карточки своя доминанта, поэтому
   точная проверка «изменилось ли» почти всегда отвечала «да», и проход по
   ряду с остановками давал пересборку стилей на каждой карточке. Доминанта
   округляется до расчёта токенов — близкие постеры дают один и тот же
   акцент. */
test('accent: проход по ряду близких постеров не даёт ни одной лишней пересборки', () => {
  const opts = { data: pixels([{ r: 40, g: 90, b: 200, n: 256 }]) };
  const dom = fakeDom(opts);
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.equal(ctx.state.injects, 1, 'первая карточка ряда акцент, конечно, ставит');
    const first = ctx.LC.accent.current().color;

    /* Ещё четыре карточки, чьи постеры отличаются на единицы уровней. */
    const near = [
      { r: 44, g: 94, b: 204 },
      { r: 47, g: 88, b: 199 },
      { r: 41, g: 95, b: 207 },
      { r: 46, g: 91, b: 201 }
    ];
    for (let i = 0; i < near.length; i++) {
      opts.data = pixels([{ r: near[i].r, g: near[i].g, b: near[i].b, n: 256 }]);
      ctx.LC.accent.applyFor({ poster_path: '/near' + i + '.jpg' });
      dom.state.images[dom.state.images.length - 1].onload();
      assert.equal(ctx.LC.accent.current().color, first, 'цвет на глаз тот же');
      assert.equal(ctx.state.injects, 1, 'пересборки ~81 КБ стилей на каждую остановку фокуса больше нет');
    }

    /* Действительно другой постер акцент по-прежнему меняет. */
    opts.data = pixels([{ r: 200, g: 60, b: 40, n: 256 }]);
    ctx.LC.accent.applyFor({ poster_path: '/other.jpg' });
    dom.state.images[dom.state.images.length - 1].onload();
    assert.notEqual(ctx.LC.accent.current().color, first);
    assert.equal(ctx.state.injects, 2);
  });
});

test('accent: reset снимает переопределение и пересобирает CSS один раз', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    ctx.LC.accent.reset();
    assert.equal(ctx.LC.accent.current(), null);
    assert.equal(ctx.state.injects, 2);
    ctx.LC.accent.reset();
    assert.equal(ctx.state.injects, 2, 'повторный сброс вхолостую CSS не трогает');
  });
});

test('accent: destroy отменяет незавершённую картинку и снимает акцент', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    ctx.LC.accent.destroy();
    assert.equal(ctx.api.pending(), 0, 'незавершённых картинок не осталось');
    assert.equal(ctx.LC.accent.current(), null);
    /* Поздний ответ уже отменённой картинки акцент не поднимает. */
    const img = dom.state.images[0];
    assert.equal(img.onload, null);
    assert.equal(ctx.LC.accent.current(), null);
  });
});

test('accent: вторая карточка отменяет расчёт первой', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    ctx.LC.accent.applyFor({ poster_path: '/b.jpg' });
    assert.equal(ctx.api.pending(), 1, 'в работе только последняя');
    assert.equal(dom.state.images[0].onload, null, 'первая отменена');
  });
});

test('accent: выключенный плагин акцент не считает', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' }, enabled: false });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(dom.state.images.length, 0);
    assert.equal(ctx.LC.accent.current(), null);
  });
});

test('accent: applyPref после выключения настройки возвращает акцент настроек', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const prefs = { lumen_accent_auto: 'true' };
    const ctx = accentCtx({ prefs: prefs });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.ok(ctx.LC.accent.current());
    prefs.lumen_accent_auto = 'false';
    ctx.LC.applyAccentPref();
    assert.equal(ctx.LC.accent.current(), null, 'акцент снят сразу, без перезахода');
  });
});

test('accent: включение настройки на открытой карточке считает акцент её фильма', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const prefs = { lumen_accent_auto: 'false' };
    const ctx = accentCtx({ prefs: prefs });
    ctx.LC.active = { data: { movie: { poster_path: '/a.jpg' } } };
    ctx.LC.applyAccentPref();
    assert.equal(dom.state.images.length, 0, 'пока выключено — картинок нет');
    prefs.lumen_accent_auto = 'true';
    ctx.LC.applyAccentPref();
    assert.equal(dom.state.images.length, 1, 'после включения считаем по открытой карточке');
  });
});

/* ---------------------------------------------------------------------- */
/* Связка с таблицей стилей: акцент фильма подменяет акцент настроек.      */
/* ---------------------------------------------------------------------- */

/* Все модули, от которых зависит LC.buildCss, плюс наш — в один LC
   (тот же приём, что в test/css.test.mjs). */
function cssCtx(dom, storage) {
  const LC = {};
  const module = { exports: null, lumen: true };
  const load = (name) => new Function('LC', 'module', readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8'))(LC, module);
  const Lampa = {
    Storage: { get: (name, def) => (name in storage ? storage[name] : def) },
    TMDB: { image: (path) => 'https://image.tmdb.org/' + path }
  };
  /* Storage читается через глобальный Lampa (src/81_prefs.js), поэтому
     подменяются оба: и window.Lampa, и сам глобал (withDom вернёт их
     на место вместе с остальными заглушками). */
  dom.globals.window.Lampa = Lampa;
  dom.globals.Lampa = Lampa;
  globalThis.Lampa = Lampa;
  load('10_util.js');
  load('20_icons.js');
  load('80_settings.js');
  load('81_prefs.js');
  load('30_css.js');
  load('57_color.js');
  let injects = 0;
  LC.injectCss = function () { injects++; };
  return { LC: LC, injects: () => injects };
}

test('css: без переопределения акцент берётся из настроек', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_card_accent: 'ice' });
    assert.equal(ctx.LC.tokens().accent, '#7FB7C9');
  });
});

test('css: акцент фильма подменяет выбранный в настройках во всей таблице стилей', () => {
  const dom = fakeDom({ data: pixels([{ r: 200, g: 120, b: 40, n: 256 }]) });
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_card_accent: 'ice', lumen_accent_auto: 'true' });
    ctx.LC.accent.applyFor({ poster_path: '/dune.jpg' });
    dom.state.images[0].onload();

    const t = ctx.LC.tokens();
    assert.notEqual(t.accent, '#7FB7C9', 'акцент настроек вытеснен');
    const hsl = ctx.LC.color.rgbToHsl(ctx.LC.color.parseHex(t.accent));
    assert.ok(hsl.h >= 20 && hsl.h <= 45, 'оттенок постера сохранён: ' + hsl.h);
    /* Четвёрка меняется целиком — кольцо, свечение и текст на акценте тоже. */
    assert.notEqual(t.ring, '#E9F7FB');
    assert.notEqual(t.onac, '#08171C');
    assert.match(t.acglow, /^rgba\(/);

    /* Тот же цвет доезжает до правил: кнопка в фокусе заливается им. */
    const css = ctx.LC.buildCss();
    assert.ok(css.indexOf(t.accent) !== -1, 'цвет фильма есть в тексте стилей');
    assert.ok(css.indexOf('#7FB7C9') === -1, 'цвета из настроек в стилях не осталось');

    /* Ушли с карточки — вернулся акцент настроек. */
    ctx.LC.accent.reset();
    assert.equal(ctx.LC.tokens().accent, '#7FB7C9');
  });
});

test('color: акцент целится в 7:1 и держит его на всём круге оттенков', () => {
  /* Восемь из девяти акцентов настроек держат 7:1 — авто-акцент не должен
     быть заметно хуже. Проверяем, что двухпроходный подбор действительно
     добирает целевое значение, а не останавливается на 4.5. */
  let below = 0;
  for (let h = 0; h < 360; h += 15) {
    for (const s of [0.2, 0.6, 0.95]) {
      const rgb = color.hslToRgb({ h: h, s: s, l: 0.35 });
      const t = color.tokens(rgb, BG);
      const worst = Math.min(color.contrast(t.onac, t.color), color.contrast(t.color, BG));
      if (worst < 7) below++;
    }
  }
  assert.equal(below, 0, 'оттенков хуже 7:1: ' + below);
});

/* ====================================================================== */
/* Правка 2026-09-17 (третий круг): подкраска фона доминантой постера      */
/* ====================================================================== */

/* Тёплая тема плагина (THEMES.warm, src/30_css.js): фон и самый слабый
   текст на нём — подпись года под постером ряда. */
const WARM_BG = '#0B0908';
const WARM_MUTED = '#A89A8A';

test('tint: без доминанты красить нечем', () => {
  assert.equal(color.tint(null, WARM_BG, WARM_MUTED, 4.5), null);
});

test('tint: фон получает ОТТЕНОК постера, оставаясь тёмным', () => {
  const orange = color.tint({ r: 210, g: 130, b: 50 }, WARM_BG, WARM_MUTED, 4.5);
  const hsl = color.rgbToHsl(color.parseHex(orange));
  const src = color.rgbToHsl({ r: 210, g: 130, b: 50 });
  assert.ok(Math.abs(hsl.h - src.h) < 6, 'оттенок плаката сохранён: ' + hsl.h + ' против ' + src.h);
  assert.ok(hsl.l < 0.12, 'фон остался тёмным: ' + hsl.l);
  assert.ok(hsl.s <= 0.4, 'насыщенность прижата: ' + hsl.s);
});

test('tint: подкрашенный фон заметно отличается от базового — иначе правка бессмысленна', () => {
  const blue = color.tint({ r: 40, g: 90, b: 210 }, WARM_BG, WARM_MUTED, 4.5);
  assert.notEqual(blue, WARM_BG);
  const base = color.rgbToHsl(color.parseHex(WARM_BG));
  const out = color.rgbToHsl(color.parseHex(blue));
  assert.ok(Math.abs(out.h - base.h) > 60, 'оттенок ушёл от тёплого фона темы');
});

test('tint: подписи под постерами остаются читаемыми на любом оттенке круга', () => {
  for (let h = 0; h < 360; h += 15) {
    const rgb = color.hslToRgb({ h: h, s: 0.9, l: 0.55 });
    const out = color.tint(rgb, WARM_BG, WARM_MUTED, 4.5);
    const ratio = color.contrast(WARM_MUTED, out);
    assert.ok(ratio >= 4.5, 'оттенок ' + h + ': контраст подписи ' + ratio.toFixed(2));
  }
});

test('tint: недостижимый порог — возвращается чистый фон темы, а не цвет похуже', () => {
  /* Порог 21 не берёт даже сам фон темы: подмешивание уменьшается до нуля. */
  const out = color.tint({ r: 210, g: 130, b: 50 }, WARM_BG, WARM_MUTED, 21);
  assert.equal(out, WARM_BG.toUpperCase());
});

test('tint: серый постер фона почти не двигает', () => {
  const grey = color.tint({ r: 130, g: 130, b: 132 }, WARM_BG, WARM_MUTED, 4.5);
  const out = color.rgbToHsl(color.parseHex(grey));
  assert.ok(out.s < 0.12, 'без своего цвета плакат фон не красит: ' + out.s);
});

test('mixRgb: доля второго цвета — от нуля до единицы', () => {
  assert.deepEqual(color.mixRgb({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 0), { r: 0, g: 0, b: 0 });
  assert.deepEqual(color.mixRgb({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 1), { r: 100, g: 200, b: 50 });
  assert.deepEqual(color.mixRgb({ r: 0, g: 0, b: 0 }, { r: 100, g: 200, b: 50 }, 0.5), { r: 50, g: 100, b: 25 });
});

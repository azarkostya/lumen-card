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
  /* Task 35: подкраска фона пишется в свой <style id="lumen-accent">
     (writeAccentStyle, src/57_color.js), поэтому заглушке нужен минимальный
     <head>: создание узла, поиск по id и ПОРЯДОК детей — по нему проверяется,
     что наш узел стоит после основной таблицы плагина. */
  const head = {
    childNodes: [],
    lastChild: null,
    appendChild: function (node) {
      const at = head.childNodes.indexOf(node);
      if (at !== -1) head.childNodes.splice(at, 1);
      head.childNodes.push(node);
      node.parentNode = head;
      head.lastChild = node;
      return node;
    },
    removeChild: function (node) {
      const at = head.childNodes.indexOf(node);
      if (at !== -1) head.childNodes.splice(at, 1);
      node.parentNode = null;
      head.lastChild = head.childNodes.length ? head.childNodes[head.childNodes.length - 1] : null;
      return node;
    }
  };
  state.head = head;
  const document = {
    head: head,
    getElementById: function (id) {
      for (const node of head.childNodes) if (node.id === id) return node;
      return null;
    },
    createElement: function (tag) {
      if (tag !== 'canvas') {
        return { tagName: tag.toUpperCase(), id: '', type: '', textContent: '', innerHTML: '', parentNode: null };
      }
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
     маленькой копии постера. Task 35: свой прокси пользователя имитируется
     опцией proxy — тогда адрес идёт не на image.tmdb.org, и у fromImage
     появляется осмысленный запасной адрес. */
  const host = options.proxy || 'https://image.tmdb.org/';
  const Lampa = { TMDB: { image: function (path) { return host + path; } } };
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

/* Task 35: кэш помнит только удачу. Прежде в него ложился и отказ, и одна
   неудачная загрузка (сеть моргнула, прокси ответил 502) закрывала постеру
   дорогу к цвету до конца сеанса — с точки зрения пользователя навсегда. */
test('color: первый провал не кэшируется — за тем же постером идём заново', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/e.jpg', () => {});
    dom.state.images[0].onload();
    let second = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/e.jpg', (rgb) => { second = rgb; });
    assert.equal(dom.state.images.length, 2, 'вторая попытка создаёт новую картинку');
    dom.state.images[1].onload();
    assert.equal(second, null);
  });
});

/* Task 35 (ревью): у повторов есть потолок. Без него устойчивый отказ
   (прокси без CORS-заголовка, заблокированный TMDB, старый WebView) стоил бы
   запроса и чтения пикселей на КАЖДОЙ остановке фокуса — ровно тот профиль
   нагрузки, от которого уходит вся задача. */
test('color: после трёх провалов подряд постер отвечает из кэша, без сети', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    const url = 'https://image.tmdb.org/t/p/w185/dead.jpg';
    for (let i = 0; i < 3; i++) {
      api.fromImage(url, () => {});
      assert.equal(dom.state.images.length, i + 1, 'попытка ' + (i + 1) + ' идёт в сеть');
      dom.state.images[i].onload();
    }
    let answer = 'нет ответа';
    const handle = api.fromImage(url, (rgb) => { answer = rgb; });
    assert.equal(dom.state.images.length, 3, 'четвёртой попытки нет');
    assert.equal(answer, null, 'ответ из кэша — синхронный');
    assert.equal(handle, null, 'ручки отмены у кэшированного ответа не бывает');
    warnLog = [];
  });
});

/* Удачная попытка обнуляет счётчик: постер, который один раз не дался из-за
   моргнувшей сети, полноправен как любой другой. */
test('color: успех после провала сбрасывает счётчик неудач', () => {
  const opts = { tainted: true };
  const dom = fakeDom(opts);
  withDom(dom, () => {
    const api = fresh().api;
    const url = 'https://image.tmdb.org/t/p/w185/flaky.jpg';
    api.fromImage(url, () => {});
    dom.state.images[0].onload();
    opts.tainted = false;
    let got = null;
    api.fromImage(url, (rgb) => { got = rgb; });
    dom.state.images[1].onload();
    assert.ok(got, 'цвет посчитан');

    /* Дальше отвечает кэш — и это ответ с цветом, а не отказ. */
    let again = null;
    api.fromImage(url, (rgb) => { again = rgb; });
    assert.equal(dom.state.images.length, 2);
    assert.deepEqual(again, got);
    warnLog = [];
  });
});

/* Task 35: отказ загрузки больше не молчит — иначе на устройстве нельзя
   отличить «настройка выключена» от «CORS запретил». */
test('color: отказ загрузки и закрытые пиксели пишут в лог адрес постера', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    warnLog = [];
    api.fromImage('https://image.tmdb.org/t/p/w185/log.jpg', () => {});
    dom.state.images[0].onload();
    assert.equal(warnLog.length, 1, 'закрытые пиксели залогированы');
    assert.match(warnLog[0].msg, /log\.jpg/);

    warnLog = [];
    api.fromImage('https://image.tmdb.org/t/p/w185/err.jpg', () => {});
    dom.state.images[1].onerror();
    assert.equal(warnLog.length, 1, 'отказ загрузки залогирован');
    assert.match(warnLog[0].msg, /err\.jpg/);
    warnLog = [];
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
  const state = { injects: 0, rules: 0 };
  let LCref = null;
  const deps = {
    /* Task 35: правила подкраски строит src/30_css.js (LC.accentCss), здесь
       достаточно узнаваемого текста, который зависит от доминанты, — по нему
       видно и что узел переписан, и каким цветом. */
    accentCss: function () {
      state.rules++;
      const dom = LCref.accent.dominant();
      return '.lumen-main{background-color:' + (dom ? LCref.color.hex(dom) : '#000000') + '}';
    },
    pref: function (name, def) {
      if (Object.prototype.hasOwnProperty.call(options.prefs || {}, name)) return options.prefs[name];
      return def;
    },
    enabled: function () { return options.enabled === undefined ? true : options.enabled; },
    /* Task 35: гейт — «движение выключено целиком» ('off'), а не «полные
       анимации»: на ТВ автодетект держит lite, и прежний гейт гасил там
       подкраску навсегда. */
    motionMode: function () { return options.motion || 'full'; },
    tokens: function () { return { bg: options.bg || BG }; },
    /* Полная пересборка таблицы. Task 35: она сама зовёт LC.accent.restyle()
       последней строкой (src/30_css.js), и заглушка это повторяет — иначе
       тесты не увидели бы ни обновления узла подкраски, ни его переезда в
       конец <head>. */
    injectCss: function () {
      state.injects++;
      LCref.accent.restyle();
    }
  };
  const ctx = fresh(deps);
  LCref = ctx.LC;
  return { api: ctx.api, LC: ctx.LC, state: state };
}

/* Узел подкраски в <head> заглушки: null, когда его нет. */
function accentNode(dom) {
  for (const node of dom.state.head.childNodes) if (node.id === 'lumen-accent') return node;
  return null;
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

/* Task 35: на главной (без второго аргумента) применение — это ОДНА запись
   в свой <style>, а не пересборка всей таблицы плагина: доминанта меняется
   на каждой остановке фокуса, и переразбор ста килобайт стилей на слабом ТВ
   фризит ровно момент листания ряда. */
test('accent: на главной цвет пишется в свой <style>, а не пересобирает таблицу', () => {
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
    assert.equal(ctx.state.injects, 0, 'полной пересборки CSS нет');
    const node = accentNode(dom);
    assert.ok(node, 'узел подкраски создан');
    assert.match(node.textContent, /^\.lumen-main\{background-color:#[0-9A-F]{6}\}$/, node.textContent);
    assert.equal(node.tagName, 'STYLE');
  });
});

/* Открытая карточка — другое дело: там акцент виден весь (кнопки, кольца
   фокуса, подсветки в полусотне правил таблицы), и её собирает theme() в
   src/30_css.js. Второй аргумент applyFor и означает «фильм открыт». */
test('accent: в карточке акцент доезжает до всей таблицы — одна пересборка', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' }, true);
    dom.state.images[0].onload();
    assert.ok(ctx.LC.accent.current(), 'акцент посчитан');
    assert.equal(ctx.state.injects, 1, 'CSS пересобран один раз');
    assert.ok(accentNode(dom), 'узел подкраски тоже на месте');
  });
});

/* Цвет, поднятый на главной, в таблицу ещё не попал — и открытие той же
   карточки обязано это заметить, иначе фильм открылся бы с акцентом из
   настроек (applied в src/57_color.js). */
test('accent: карточка с уже посчитанным на главной цветом всё равно пересобирает таблицу', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    const onMain = ctx.LC.accent.current().color;
    assert.equal(ctx.state.injects, 0);

    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' }, true);
    assert.equal(dom.state.images.length, 1, 'второй картинки нет — цвет из кэша');
    assert.equal(ctx.LC.accent.current().color, onMain, 'цвет тот же');
    assert.equal(ctx.state.injects, 1, 'но таблица его ещё не знала');

    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' }, true);
    assert.equal(ctx.state.injects, 1, 'согласованную таблицу второй раз не пересобираем');
  });
});

test('accent: постера нет — переопределение снимается', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' }, true);
    dom.state.images[0].onload();
    assert.ok(ctx.LC.accent.current());
    ctx.LC.accent.applyFor({ }, true);
    assert.equal(ctx.LC.accent.current(), null, 'акцент вернулся к выбранному в настройках');
    assert.equal(ctx.state.injects, 2, 'пересборка на применение и на сброс');
    assert.equal(accentNode(dom), null, 'узел подкраски снят вместе с цветом');
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

/* Task 35: гейт режима анимаций смягчён. Ревью фазы 3 (Important 2) ставило
   здесь ровно 'full', потому что каждое применение пересобирало всю таблицу;
   теперь смена доминанты — одна запись в свой <style>, а на ТВ автодетект
   держит именно lite, и прежний гейт гасил подкраску навсегда. */
test('accent: в lite работает, при выключенном движении — нет', () => {
  const lite = fakeDom({});
  withDom(lite, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' }, motion: 'lite' });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(lite.state.images.length, 1, 'lite: постер считается');
    lite.state.images[0].onload();
    assert.ok(ctx.LC.accent.current(), 'lite: акцент посчитан');
    assert.ok(accentNode(lite), 'lite: подкраска написана');
    assert.equal(ctx.state.injects, 0, 'lite: таблица не пересобиралась');
  });

  const off = fakeDom({});
  withDom(off, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' }, motion: 'off' });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(off.state.images.length, 0, 'off: постер даже не грузится');
    assert.equal(ctx.LC.accent.current(), null, 'off: акцент из настроек');
    assert.equal(accentNode(off), null, 'off: узла подкраски нет');
    assert.equal(ctx.state.injects, 0, 'off: стили не пересобирались');
  });
});

/* Ревью фазы 3 (Important 2): у каждой карточки своя доминанта, поэтому
   точная проверка «изменилось ли» почти всегда отвечала «да», и проход по
   ряду с остановками перекрашивал экран на каждой карточке. Доминанта
   округляется до расчёта токенов — близкие постеры дают один и тот же
   акцент и один и тот же тон фона.
   Task 35: считаются записи в узел подкраски (state.rules), потому что
   пересборок таблицы на главной теперь нет вовсе. */
test('accent: проход по ряду близких постеров не даёт ни одной лишней перекраски', () => {
  const opts = { data: pixels([{ r: 40, g: 90, b: 200, n: 256 }]) };
  const dom = fakeDom(opts);
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.equal(ctx.state.rules, 1, 'первая карточка ряда цвет, конечно, ставит');
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
      assert.equal(ctx.state.rules, 1, 'перекраски на каждую остановку фокуса нет');
    }

    /* Действительно другой постер акцент по-прежнему меняет. */
    opts.data = pixels([{ r: 200, g: 60, b: 40, n: 256 }]);
    ctx.LC.accent.applyFor({ poster_path: '/other.jpg' });
    dom.state.images[dom.state.images.length - 1].onload();
    assert.notEqual(ctx.LC.accent.current().color, first);
    assert.equal(ctx.state.rules, 2);
    assert.equal(ctx.state.injects, 0, 'и ни одной пересборки таблицы за весь проход по ряду');
  });
});

test('accent: reset снимает переопределение и пересобирает CSS ровно тогда, когда таблица его знала', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    /* Цвет, поднятый на главной, в таблицу не попадал — возвращать ей
       нечего, и пересобирать её на уходе незачем. */
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    ctx.LC.accent.reset();
    assert.equal(ctx.LC.accent.current(), null);
    assert.equal(ctx.state.injects, 0, 'таблица и так стоит на акценте настроек');
    assert.equal(accentNode(dom), null, 'узел подкраски снят');

    /* А цвет открытой карточки в таблице был — его надо убрать оттуда. */
    ctx.LC.accent.applyFor({ poster_path: '/b.jpg' }, true);
    dom.state.images[dom.state.images.length - 1].onload();
    assert.equal(ctx.state.injects, 1);
    ctx.LC.accent.reset();
    assert.equal(ctx.state.injects, 2, 'сброс вернул акцент настроек во всю таблицу');
    ctx.LC.accent.reset();
    assert.equal(ctx.state.injects, 2, 'повторный сброс вхолостую CSS не трогает');
  });
});

/* Task 35, CORS-фолбэк. Lampa.TMDB.image уважает настройку proxy_tmdb
   пользователя (vendor/lampa/app.min.js:19314-19316), а чужой прокси не
   обязан отдавать Access-Control-Allow-Origin — для браузера с
   crossOrigin = 'anonymous' это ошибка загрузки, то есть у владельца прокси
   подкраска молча не работала бы никогда. */
test('accent: постер через прокси не загрузился — одна попытка прямым адресом TMDB', () => {
  const dom = fakeDom({ proxy: 'https://proxy.example/' });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    warnLog = [];
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(dom.state.images[0].src, 'https://proxy.example/t/p/w185/a.jpg', 'сначала — адрес пользователя');
    dom.state.images[0].onerror();

    assert.equal(dom.state.images.length, 2, 'вторая попытка сделана');
    assert.equal(dom.state.images[1].src, 'https://image.tmdb.org/t/p/w185/a.jpg', 'прямой адрес TMDB');
    assert.equal(dom.state.images[1].crossOrigin, 'anonymous', 'иначе пиксели снова были бы закрыты');
    assert.equal(ctx.api.pending(), 1, 'заявка та же, а не вторая');
    dom.state.images[1].onload();
    assert.ok(ctx.LC.accent.current(), 'со второй попытки цвет посчитан');
    assert.equal(ctx.api.pending(), 0);
    warnLog = [];
  });
});

test('accent: провалились обе попытки — акцент из настроек, третьей нет', () => {
  const dom = fakeDom({ proxy: 'https://proxy.example/' });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    warnLog = [];
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onerror();
    dom.state.images[1].onerror();
    assert.equal(dom.state.images.length, 2, 'третьей попытки нет');
    assert.equal(ctx.LC.accent.current(), null, 'остался акцент настроек');
    assert.equal(accentNode(dom), null, 'подкраски тоже нет');
    assert.equal(warnLog.length, 2, 'оба отказа в логе');
    assert.match(warnLog[0].msg, /proxy\.example/);
    assert.match(warnLog[1].msg, /image\.tmdb\.org/);
    warnLog = [];
  });
});

/* Прокси не настроен — адрес и так ведёт на image.tmdb.org, и вторая
   попытка запросила бы тот же самый файл. */
test('accent: без прокси второй попытки нет — адрес и так прямой', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    warnLog = [];
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onerror();
    assert.equal(dom.state.images.length, 1);
    assert.equal(ctx.LC.accent.current(), null);
    warnLog = [];
  });
});

/* Task 35 (ревью): выключенный плагин снимает свой CSS целиком (LC.removeCss),
   и узел подкраски обязан уйти вместе с ним — иначе подкрашенная подложка
   пережила бы выключение. deactivate зовёт destroy() до removeCss
   (src/90_runtime.js). */
test('accent: выключение плагина снимает узел подкраски', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const options = { prefs: { lumen_accent_auto: 'true' }, enabled: true };
    const ctx = accentCtx(options);
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.ok(accentNode(dom), 'подкраска стоит');

    options.enabled = false;
    ctx.LC.accent.destroy();
    assert.equal(accentNode(dom), null, 'узла нет');
    assert.equal(ctx.state.injects, 0, 'у выключенного плагина таблицу не пересобираем');
  });
});

/* Task 35 (ревью): смена режима движения таблицу стилей не пересобирает
   (src/80_settings.js зовёт только applyMotionMode), поэтому узел снимает и
   возвращает отдельная точка — repaint(). */
test('accent: выключенное движение снимает подкраску, возврат режима — возвращает', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const options = { prefs: { lumen_accent_auto: 'true' }, motion: 'lite' };
    const ctx = accentCtx(options);
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    assert.ok(accentNode(dom), 'в lite подкраска есть');

    options.motion = 'off';
    ctx.LC.accent.repaint();
    assert.equal(accentNode(dom), null, 'движение выключено — подкраски нет');

    options.motion = 'full';
    ctx.LC.accent.repaint();
    assert.ok(accentNode(dom), 'вернули движение — вернулась и подкраска');
    assert.equal(ctx.state.injects, 0, 'и всё это без пересборки таблицы');
  });
});

/* Task 35 (ревью): тот же текст в узел повторно не пишется — та же защита,
   что у card_css_text в LC.injectCss. restyle() зовётся на КАЖДОЙ полной
   пересборке (смена шрифта, плотности подложек), а фон при этом чаще всего
   прежний. */
test('accent: повторная пересборка с тем же цветом узел не переписывает', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'true' } });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    dom.state.images[0].onload();
    const node = accentNode(dom);
    let writes = 0;
    const text = node.textContent;
    Object.defineProperty(node, 'textContent', {
      get: () => text,
      set: () => { writes++; }
    });

    ctx.LC.accent.restyle();
    ctx.LC.accent.restyle();
    assert.equal(writes, 0, 'текст тот же — записи нет');
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
  /* Task 35: вставка здесь настоящая, а не заглушка-счётчик, — иначе не
     проверить ни порядок узлов в <head>, ни свежесть узла подкраски после
     полной пересборки. */
  const inject = LC.injectCss;
  LC.injectCss = function () { injects++; inject(); };
  return { LC: LC, injects: () => injects };
}

/* Идентификаторы узлов <head> заглушки по порядку. */
function headIds(dom) {
  return dom.state.head.childNodes.map((node) => node.id);
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

/* Task 35: узел подкраски создаётся раньше основной таблицы (первая
   остановка фокуса случается до первой пересборки), а победить при равной
   специфичности обязан он — значит после полной сборки он должен стоять
   ПОСЛЕ основного узла и нести свежий цвет. */
test('css: узел подкраски стоит в <head> после основной таблицы и не устаревает', () => {
  const dom = fakeDom({ data: pixels([{ r: 200, g: 120, b: 40, n: 256 }]) });
  withDom(dom, () => {
    const storage = { lumen_accent_auto: 'true', lumen_theme: 'warm' };
    const ctx = cssCtx(dom, storage);
    ctx.LC.accent.applyFor({ poster_path: '/dune.jpg' });
    dom.state.images[0].onload();
    assert.deepEqual(headIds(dom), ['lumen-accent'], 'подкраска появилась первой');
    const warmRules = accentNode(dom).textContent;
    assert.match(warmRules, /\.lumen-main\{background-color:#[0-9A-F]{6}\}/);
    assert.ok(warmRules.indexOf('.lumen-hero__veil--b') !== -1, 'низ вуали героя красится вместе с подложкой');

    ctx.LC.injectCss();
    assert.deepEqual(headIds(dom), ['lumen-card-css', 'lumen-accent'], 'наш узел переехал в конец');

    /* Цвет подкраски считается от фона темы, поэтому смена темы обязана
       переписать и наш узел — иначе он остался бы с цветом прежней. */
    storage.lumen_theme = 'black';
    ctx.LC.injectCss();
    assert.deepEqual(headIds(dom), ['lumen-card-css', 'lumen-accent'], 'порядок сохранён');
    assert.notEqual(accentNode(dom).textContent, warmRules, 'подкраска пересчитана от нового фона');
  });
});

/* Task 35 (ревью): на главной от постера красится не только фон. Кольцо
   фокуса вокруг карточки ряда и чип настроения в фокусе берут цвет из того
   же акцента, и если оставить их в общей таблице, фон поедет, а самая
   заметная деталь экрана застынет на цвете прошлой полной сборки. */
test('css: узел подкраски несёт и кольцо фокуса карточки, и чип настроения', () => {
  const dom = fakeDom({ data: pixels([{ r: 200, g: 120, b: 40, n: 256 }]) });
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_card_accent: 'ice', lumen_accent_auto: 'true' });
    ctx.LC.accent.applyFor({ poster_path: '/dune.jpg' });
    dom.state.images[0].onload();

    const rules = accentNode(dom).textContent;
    const t = ctx.LC.accent.current();
    assert.ok(rules.indexOf('.lumen-main .card.focus .card__view:after') !== -1, 'кольцо фокуса карточки ряда');
    assert.ok(rules.indexOf('.lumen-mood-chip.focus') !== -1, 'чип настроения в фокусе');
    assert.ok(rules.indexOf(t.light) !== -1, 'кольцо окрашено цветом фильма, а не настроек');
    assert.ok(rules.indexOf(t.color) !== -1, 'чип тоже');
    assert.ok(rules.indexOf('#7FB7C9') === -1, 'акцента настроек в узле нет');
  });
});

/* Правила узла — те же строки, что и в полной таблице: текст один (accentRules
   в src/30_css.js), поэтому две дороги не могут разъехаться. */
test('css: правила подкраски из узла есть и в полной таблице стилей', () => {
  const dom = fakeDom({ data: pixels([{ r: 200, g: 120, b: 40, n: 256 }]) });
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_accent_auto: 'true' });
    ctx.LC.accent.applyFor({ poster_path: '/dune.jpg' });
    dom.state.images[0].onload();
    const css = ctx.LC.buildCss();
    for (const rule of accentNode(dom).textContent.split('\n')) {
      assert.ok(css.indexOf(rule) !== -1, 'правило есть и в общей таблице: ' + rule.slice(0, 40));
    }
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

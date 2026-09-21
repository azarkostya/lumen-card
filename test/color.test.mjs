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
              /* Task 60: поломка чтения, не связанная с CORS, — состояние у
                 неё своё, потому что лечится она не заголовком прокси. */
              if (options.boom) throw new TypeError('getImageData is not a function');
              /* Task 60: очередь картинок с РАЗНЫМИ цветами — ею проверяется
                 переход между доминантами соседних постеров. Последняя
                 запись остаётся ответом на все следующие чтения. */
              if (options.datas && options.datas.length) {
                const at = Math.min(state.reads - 1, options.datas.length - 1);
                return { data: options.datas[at] };
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
  /* Task 60: плавный переход цвета ведёт setTimeout (шагами по
     TWEEN_STEP_MS), и таймаут загрузки постера — он же. Очередь ручная:
     ни один таймер не срабатывает сам, только через state.advance(мс), —
     поэтому после последнего теста node --test завершает процесс сам, а
     шаги перехода видно поимённо. Тот же приём, что в test/hero.test.mjs. */
  const timers = [];
  state.now = 0;
  state.timers = timers;
  /* Время идёт ДО ближайшего срока, а не сразу на всю дельту: шаг перехода
     ставит следующий таймер от текущего момента, и прыжок часами вперёд
     съел бы всю цепочку, оставив один шаг. */
  state.advance = function (ms) {
    const until = state.now + ms;
    for (let round = 0; round < 1000; round++) {
      let next = null;
      for (const t of timers) if (!t.done && t.at <= until && (!next || t.at < next.at)) next = t;
      if (!next) break;
      if (next.at > state.now) state.now = next.at;
      next.done = true;
      next.fn();
    }
    state.now = until;
  };
  const setTimeoutFake = function (fn, ms) {
    timers.push({ id: timers.length + 1, fn: fn, at: state.now + (ms || 0), done: false });
    return timers.length;
  };
  const clearTimeoutFake = function (id) { const t = timers[id - 1]; if (t) t.done = true; };
  return {
    state: state,
    globals: {
      window: window, document: document, Image: FakeImage, Lampa: Lampa,
      setTimeout: setTimeoutFake, clearTimeout: clearTimeoutFake
    }
  };
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
    /* Task 60 (ревью, G): motionRef — изменяемая ссылка для тестов, которые
       переключают режим ПОСЛЕ создания контекста (смена настройки на лету
       зовёт LC.accent.repaint, src/80_settings.js). */
    motionMode: function () {
      if (options.motionRef) return options.motionRef.mode;
      return options.motion || 'full';
    },
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

/* Task 60 (ревью): второй узел — подсветка карточки под фокусом. Она живёт
   отдельно от фона именно потому, что на шагах перехода цвета не меняется. */
function focusNode(dom) {
  for (const node of dom.state.head.childNodes) if (node.id === 'lumen-accent-focus') return node;
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
    assert.deepEqual(headIds(dom), ['lumen-accent', 'lumen-accent-focus'], 'подкраска появилась первой');
    const warmRules = accentNode(dom).textContent;
    assert.match(warmRules, /\.lumen-main\{background-color:#[0-9A-F]{6}\}/);
    /* Task 64: низ кадра героя больше не красится отдельным правилом — там
       градиент-МАСКА, то есть кадр растворяется в фоне .lumen-main, который
       этот же узел и красит первой строкой. Дублировать цвет негде, значит и
       разъехаться ему не с чем. */
    assert.ok(warmRules.indexOf('.lumen-hero__veil--b') === -1, 'низ кадра героя — маска, отдельного крашеного правила у него нет');
    assert.ok(warmRules.indexOf('.lumen-hero__veil--l') !== -1, 'левая вуаль героя красится вместе с подложкой');

    ctx.LC.injectCss();
    assert.deepEqual(headIds(dom), ['lumen-card-css', 'lumen-accent', 'lumen-accent-focus'], 'наши узлы переехали в конец');

    /* Цвет подкраски считается от фона темы, поэтому смена темы обязана
       переписать и наш узел — иначе он остался бы с цветом прежней. */
    storage.lumen_theme = 'black';
    ctx.LC.injectCss();
    assert.deepEqual(headIds(dom), ['lumen-card-css', 'lumen-accent', 'lumen-accent-focus'], 'порядок сохранён');
    assert.notEqual(accentNode(dom).textContent, warmRules, 'подкраска пересчитана от нового фона');
  });
});

/* Task 35 (ревью): на главной от постера красится не только фон. Подсветка
   карточки ряда в фокусе и чип настроения в фокусе берут цвет из того же
   акцента, и если оставить их в общей таблице, фон поедет, а самая заметная
   деталь экрана застынет на цвете прошлой полной сборки.
   Task 42: носитель акцента у карточки сменился с кольца (:after снят) на
   тень самого постера — ореол вокруг него. */
test('css: узел подкраски несёт подсветку карточки в фокусе и только её', () => {
  const dom = fakeDom({ data: pixels([{ r: 200, g: 120, b: 40, n: 256 }]) });
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_card_accent: 'ice', lumen_accent_auto: 'true' });
    ctx.LC.accent.applyFor({ poster_path: '/dune.jpg' });
    dom.state.images[0].onload();

    const rules = accentNode(dom).textContent;
    /* Task 60 (ревью): подсветка уехала в свой узел — в горячем её больше
       нет, а проверка «цвет фильма, а не настроек» переехала вместе с ней. */
    const focus = focusNode(dom).textContent;
    const t = ctx.LC.accent.current();
    assert.ok(focus.indexOf('.lumen-main .card.focus .card__view{') === 0, 'подсветка карточки ряда: ' + focus);
    assert.ok(rules.indexOf('.card.focus') === -1, 'в горячем узле подкраски правила фокуса нет');
    assert.ok(rules.indexOf('.card__view:after') === -1, 'кольца в узле подкраски больше нет');
    /* Task 43: чип настроения отсюда ушёл — его фокус стал инверсией
       P.text/P.bg и от доминанты постера не зависит. Держать его правило в
       узле подкраски значило бы переписывать на каждой остановке фокуса
       строку, которая от фокуса не меняется. */
    assert.ok(rules.indexOf('.lumen-mood-chip') === -1, 'чип настроения в узле подкраски больше не нужен');
    assert.ok(focus.indexOf(t.glow) !== -1, 'ореол окрашен цветом фильма, а не настроек');
    assert.ok(rules.indexOf('#7FB7C9') === -1, 'акцента настроек в узле нет');
    assert.ok(focus.indexOf('#7FB7C9') === -1, 'акцента настроек нет и в узле подсветки');
    void t.color;
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
    /* Task 60 (ревью): узла стало два, и сверяются оба — разъехаться с
       таблицей одинаково нельзя ни фону, ни подсветке. */
    const all = accentNode(dom).textContent.split('\n').concat(focusNode(dom).textContent.split('\n'));
    for (const rule of all) {
      assert.ok(css.indexOf(rule) !== -1, 'правило есть и в общей таблице: ' + rule.slice(0, 40));
    }
  });
});

/* Task 60 (ревью): ради чего узлы и разделили. Подсветка карточки под
   фокусом красится токенами, а они на шагах перехода не меняются — значит
   её узел за весь переход не переписывается ни разу. Пока правило лежало
   вместе с фоном, каждая перезапись заставляла движок заново оценивать
   '.lumen-main .card.focus .card__view', который из-за .card.focus трогает
   карточки всех видимых рядов. */
test('Task 60: за весь переход узел подсветки не переписывается ни разу', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = cssCtx(dom, { lumen_accent_auto: 'true' });
    ctx.LC.accent.applyFor({ poster_path: '/warm.jpg' });
    dom.state.images[0].onload();
    ctx.LC.accent.applyFor({ poster_path: '/cold.jpg' });
    dom.state.images[1].onload();

    const focus = focusNode(dom);
    let writes = 0;
    let text = focus.textContent;
    Object.defineProperty(focus, 'textContent', {
      get: () => text,
      set: (v) => { writes++; text = v; }
    });
    const before = accentNode(dom).textContent;
    dom.state.advance(1600);
    assert.notEqual(accentNode(dom).textContent, before, 'фон за переход перекрашен');
    assert.equal(writes, 0, 'узел подсветки за переход не тронут');
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

/* ====================================================================== */
/* Task 60: плавность подкраски — лерп между прежним и новым цветом.       */
/* ====================================================================== */

test('blend: концы отрезка — это сами цвета', () => {
  const a = { r: 210, g: 130, b: 50 };
  const b = { r: 40, g: 90, b: 210 };
  assert.deepEqual(color.blend(a, b, 0), a);
  assert.deepEqual(color.blend(a, b, 1), b);
  /* За пределами отрезка путь не продолжается. */
  assert.deepEqual(color.blend(a, b, -1), a);
  assert.deepEqual(color.blend(a, b, 5), b);
});

test('blend: середина близких оттенков — оттенок между ними, светлота посередине', () => {
  /* 20° и 50° — разница 30°, меньше порога дальнего перехода. */
  const a = color.hslToRgb({ h: 20, s: 0.7, l: 0.5 });
  const b = color.hslToRgb({ h: 50, s: 0.7, l: 0.5 });
  const mid = color.rgbToHsl(color.blend(a, b, 0.5));
  assert.ok(Math.abs(mid.h - 35) < 1.5, 'оттенок посередине: ' + mid.h);
  assert.ok(Math.abs(mid.s - 0.7) < 0.02, 'насыщенность близких тонов не проседает: ' + mid.s);
  assert.ok(Math.abs(mid.l - 0.5) < 0.02, 'светлота посередине: ' + mid.l);
});

test('blend: через 0°/360° идёт короткой дугой, а не через весь круг', () => {
  const a = color.hslToRgb({ h: 350, s: 0.7, l: 0.5 });
  const b = color.hslToRgb({ h: 10, s: 0.7, l: 0.5 });
  const mid = color.rgbToHsl(color.blend(a, b, 0.5));
  /* Короткая дуга 350 -> 10 проходит через 0, а не через 180. */
  const gap = Math.min(Math.abs(mid.h - 0), 360 - Math.abs(mid.h - 0));
  assert.ok(gap < 2, 'середина у нуля: ' + mid.h);
});

test('blend: дальний оттенок (Δh > 60°) идёт через приглушённый тон, а не по яркой дуге', () => {
  /* Тёплый -> холодный: 30° и 220°, разница 170°. По яркой дуге глаз
     прочитал бы проезд через чужие цвета — вместо этого тон глушится. */
  const a = color.hslToRgb({ h: 30, s: 0.8, l: 0.5 });
  const b = color.hslToRgb({ h: 220, s: 0.8, l: 0.5 });
  const mid = color.rgbToHsl(color.blend(a, b, 0.5));
  assert.ok(mid.s < 0.35, 'в середине дальнего перехода тон приглушён: ' + mid.s);
  /* Но концы остаются насыщенными — глушение только в пути. */
  assert.ok(color.rgbToHsl(color.blend(a, b, 0.02)).s > 0.7, 'у начала тон ещё свой');
  assert.ok(color.rgbToHsl(color.blend(a, b, 0.98)).s > 0.7, 'у конца тон уже свой');
});

test('blend: серый конец не тянет оттенок к нулю — берётся оттенок цветного', () => {
  const grey = { r: 120, g: 120, b: 120 };
  const blue = color.hslToRgb({ h: 220, s: 0.8, l: 0.5 });
  const mid = color.rgbToHsl(color.blend(grey, blue, 0.5));
  assert.ok(Math.abs(mid.h - 220) < 2, 'оттенок цветного конца: ' + mid.h);
});

/* ====================================================================== */
/* Task 60: «подкраска вообще не работает».                                */
/* ====================================================================== */

/* Найдено замером на живой Lampa 3.3.4 (localhost:8766, 2026-09-21, чистый
   localStorage): Lampa.Params.defaults['lumen_accent_auto'] === true и
   Lampa.Params.field('lumen_accent_auto') === true — то есть РАЗДЕЛ
   НАСТРОЕК показывает «Вкл», — а LC.pref('lumen_accent_auto', false), то
   есть ровно то, что читал auto(), возвращал false. Пока тумблер не
   переключали руками, в localStorage ключа нет, и ответ целиком решает
   дефолт, переданный вызовом. Task 35 поднял дефолт в LC.prefs.LIST до
   true, а вызов в модуле остался с false — подкраска была выключена у
   всех, кто не трогал переключатель. */
test('accent: дефолт настройки в модуле — тот же, что в LC.prefs.LIST', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    /* prefs пуст: заглушка pref отдаёт ровно тот дефолт, который передал
       вызывающий код, — как Lampa.Storage.get при отсутствующем ключе. */
    const ctx = accentCtx({ prefs: {} });
    ctx.LC.accent.applyFor({ poster_path: '/a.jpg' });
    assert.equal(dom.state.images.length, 1, 'постер запрошен — подкраска включена по умолчанию');
  });
});

/* ====================================================================== */
/* Task 60: «надо сделать это плавным очень, без резких смен тонов».       */
/* ====================================================================== */

/* Два постера с разными доминантами: тёплый оранжевый и холодный синий —
   самая заметная пара, ровно та, на которой видно «резкую смену тонов». */
const WARM_POSTER = pixels([{ r: 210, g: 130, b: 50, n: 256 }]);
const COLD_POSTER = pixels([{ r: 40, g: 90, b: 210, n: 256 }]);

/* Цвет фона из текста узла подкраски: заглушка accentCss пишет туда hex
   текущей доминанты (см. accentCtx выше). */
function paintedHex(dom) {
  const node = accentNode(dom);
  if (!node) return null;
  const m = /#[0-9A-F]{6}/.exec(node.textContent);
  return m ? m[0] : null;
}

function twoPosters(ctx, dom) {
  ctx.LC.accent.applyFor({ poster_path: '/warm.jpg' });
  dom.state.images[0].onload();
  const first = paintedHex(dom);
  ctx.LC.accent.applyFor({ poster_path: '/cold.jpg' });
  dom.state.images[1].onload();
  return first;
}

test('Task 60: на главной цвет не прыгает — он едет шагами и доезжает за 1.6 с', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    const first = twoPosters(ctx, dom);
    assert.ok(first, 'первый постер покрасил фон сразу — ехать было неоткуда');
    assert.equal(paintedHex(dom), first, 'в момент ответа цвет ещё прежний');

    const target = ctx.LC.color.hex(ctx.LC.accent.target());
    assert.notEqual(target, first, 'постеры действительно разного цвета');

    /* Середина пути: цвет уже не прежний и ещё не целевой. */
    dom.state.advance(800);
    const mid = paintedHex(dom);
    assert.notEqual(mid, first, 'через 0.8 с цвет сдвинулся');
    assert.notEqual(mid, target, 'и ещё не доехал');

    dom.state.advance(800);
    assert.equal(paintedHex(dom), target, 'за 1.6 с переход закончен');
    /* Шагов достаточно, чтобы глаз не читал ступеньки: за весь путь узел
       переписан больше десяти раз. */
    assert.ok(ctx.state.rules > 10, 'шагов перехода: ' + ctx.state.rules);
  });
});

test('Task 60: переход идёт через приглушённый тон — середина не ярче обоих концов', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    const from = ctx.LC.color.rgbToHsl(ctx.LC.accent.dominant());
    dom.state.advance(800);
    const mid = ctx.LC.color.rgbToHsl(ctx.LC.accent.dominant());
    dom.state.advance(800);
    const to = ctx.LC.color.rgbToHsl(ctx.LC.accent.dominant());
    assert.ok(mid.s < Math.min(from.s, to.s),
      'середина приглушена: ' + mid.s.toFixed(2) + ' против ' + from.s.toFixed(2) + ' и ' + to.s.toFixed(2));
  });
});

test('Task 60: новый постер посреди перехода уводит цвет с того места, где он сейчас', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER, WARM_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(400);
    const onTheWay = ctx.LC.accent.dominant();
    ctx.LC.accent.applyFor({ poster_path: '/warm2.jpg' });
    dom.state.images[2].onload();
    assert.deepEqual(ctx.LC.accent.dominant(), onTheWay, 'скачка в момент разворота нет');
    dom.state.advance(1600);
    assert.equal(ctx.LC.color.hex(ctx.LC.accent.dominant()), ctx.LC.color.hex(ctx.LC.accent.target()));
  });
});

/* В 'lite' и 'off' анимации выключены сознательно (автодетект слабого ТВ
   держит там ровно lite), поэтому цвет ставится сразу: шестнадцать
   перезаписей узла в секунду с половиной — ровно та работа, от которой
   этот режим и уводит. */
test('Task 60: в lite переход мгновенный — ни одного шага', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {}, motion: 'lite' });
    twoPosters(ctx, dom);
    assert.equal(ctx.LC.color.hex(ctx.LC.accent.dominant()), ctx.LC.color.hex(ctx.LC.accent.target()));
    assert.equal(dom.state.timers.filter((t) => !t.done).length, 0, 'висящих таймеров нет');
  });
});

/* Открытая карточка — другой случай: там каждый шаг стоил бы полной
   пересборки таблицы (deep), а экран и так только что сменился. */
test('Task 60: в карточке (deep) цвет ставится сразу, пересборка одна', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    ctx.LC.accent.applyFor({ poster_path: '/warm.jpg' }, true);
    dom.state.images[0].onload();
    ctx.LC.accent.applyFor({ poster_path: '/cold.jpg' }, true);
    dom.state.images[1].onload();
    assert.equal(ctx.LC.color.hex(ctx.LC.accent.dominant()), ctx.LC.color.hex(ctx.LC.accent.target()));
    assert.equal(ctx.state.injects, 2, 'по одной пересборке на карточку');
  });
});

test('Task 60: уход с карточки останавливает переход — поздних перекрасок нет', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(300);
    ctx.LC.accent.destroy();
    const after = ctx.state.rules;
    dom.state.advance(3000);
    assert.equal(ctx.state.rules, after, 'после destroy узел больше не переписывался');
    assert.equal(accentNode(dom), null, 'и сам узел снят');
  });
});

/* ====================================================================== */
/* Task 60: состояние подкраски — по факту, а не по догадке.               */
/* ====================================================================== */

/* На телевизоре консоли нет, и «подкраска не работает» до сих пор нельзя
   было отличить от «настройка выключена», «постер не догрузился» и «прокси
   отдал картинку без CORS». Состояние показывает HUD (src/69_hud.js), а
   считает его этот модуль — каждое по своему признаку. */
test('status: до первого расчёта — idle, адреса ещё нет', () => {
  const api = fresh().api;
  assert.deepEqual(api.status(), { state: 'idle', url: '' });
});

test('status: цвет получен — ok и адрес без ключей', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/a.jpg?api_key=secret&x=1', () => { });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'ok');
    assert.equal(api.status().url, 'image.tmdb.org/t/p/w185/a.jpg', 'хвост с ключом отрезан');
  });
});

test('status: пиксели закрыты — cors, и только на SecurityError', () => {
  const dom = fakeDom({ tainted: true });
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/b.jpg', () => { });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'cors');
  });
});

test('status: чужое исключение при чтении пикселей за CORS не выдают', () => {
  const dom = fakeDom({ boom: true });
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/b.jpg', () => { });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'error');
  });
});

test('status: картинка не загрузилась — load', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/c.jpg', () => { });
    dom.state.images[0].onerror();
    assert.equal(api.status().state, 'load');
  });
});

test('status: серый постер — цвета нет, но пиксели прочитаны (dim, а не cors)', () => {
  const dom = fakeDom({ data: pixels([{ r: 128, g: 128, b: 128, n: 256 }]) });
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/d.jpg', () => { });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'dim');
  });
});

/* Без таймаута повисшая картинка не давала вообще никакого ответа: колбэк
   не звался, pending не опускался, и состояние навсегда оставалось
   прежним — то есть на экране телевизора «подкраска молчит» выглядело бы
   ровно так же, как выключенная настройка. */
test('timer: картинка, которая не ответила, отпускается по таймауту', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let got = 'нет ответа';
    api.fromImage('https://image.tmdb.org/t/p/w185/e.jpg', (rgb) => { got = rgb; });
    assert.equal(api.pending(), 1);
    dom.state.advance(api.LOAD_MS);
    assert.equal(got, null, 'колбэк всё-таки ответил');
    assert.equal(api.pending(), 0, 'картинка отпущена');
    assert.equal(api.status().state, 'timer');
  });
});

test('timer: ответ в срок таймаут снимает — поздних отказов нет', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    let answers = 0;
    api.fromImage('https://image.tmdb.org/t/p/w185/f.jpg', () => { answers++; });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'ok');
    dom.state.advance(api.LOAD_MS * 3);
    assert.equal(answers, 1, 'колбэк ровно один раз');
    assert.equal(api.status().state, 'ok', 'состояние не перебито поздним таймером');
  });
});

test('accent: status — выключенная настройка отвечает off, а не молчанием', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: { lumen_accent_auto: 'false' } });
    assert.equal(ctx.LC.accent.status().state, 'off');
  });
});

test('accent: status — выключенное движение тоже off, а посчитанный цвет виден целиком', () => {
  const dom = fakeDom({ datas: [WARM_POSTER] });
  withDom(dom, () => {
    const off = accentCtx({ prefs: {}, motion: 'off' });
    assert.equal(off.LC.accent.status().state, 'off');

    const ctx = accentCtx({ prefs: {} });
    ctx.LC.accent.applyFor({ poster_path: '/warm.jpg' });
    dom.state.images[0].onload();
    const st = ctx.LC.accent.status();
    assert.equal(st.state, 'ok');
    assert.equal(st.color, ctx.LC.color.hex(ctx.LC.accent.dominant()), 'показан сам цвет');
    assert.equal(st.url, 'image.tmdb.org/t/p/w185/warm.jpg');
  });
});

/* CSS-переход у подложки рядов и шаг перехода в этом модуле — две половины
   одного механизма: шаги красят узел подкраски, а переход сглаживает
   ступеньку МЕЖДУ соседними шагами. Если он длиннее шага, фон отстаёт от
   пути и к концу перехода не доезжает; если короче — между шагами видна
   остановка. Утверждение проверяемо, поэтому и проверяется. */
test('Task 60: CSS-переход подложки рядов равен шагу перехода', () => {
  const css = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  const rule = /body\.lumen-motion-full \.lumen-main\{[^}]*?[^-]transition:background-color ([\d.]+)s/.exec(css);
  assert.ok(rule, 'правило перехода подложки рядов не найдено в src/30_css.js');
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    assert.equal(Math.round(parseFloat(rule[1]) * 1000), ctx.LC.accent.timing().step,
      'CSS-переход ' + rule[1] + 's против шага ' + ctx.LC.accent.timing().step + ' мс');
    /* И сам переход не короче полутора секунд — этого просил пользователь. */
    assert.ok(ctx.LC.accent.timing().total >= 1500, 'переход короче 1.5 с: ' + ctx.LC.accent.timing().total);
  });
});

/* ====================================================================== */
/* Task 60 (ревью): переход не имеет права пережить свой экран.            */
/* ====================================================================== */

/* E. Карточку открывают посреди перехода. LC.accent.destroy() рантайм при
   component === 'full' не зовёт намеренно (src/90_runtime.js) — он снял бы
   акцент самой карточки, — поэтому обрыв висит на уходе героя
   (LC.hero.unmount) и на этой функции. Без неё tweenStep тикал бы каждые
   100 мс, пока карточка строится: от 'start' до 'complite' на телевизоре
   это секунда и больше. */
test('Task 60: stopTween обрывает переход, и поздних перекрасок нет', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(300);
    const stopped = ctx.LC.accent.dominant();
    const rules = ctx.state.rules;
    ctx.LC.accent.stopTween();
    dom.state.advance(3000);
    assert.equal(ctx.state.rules, rules, 'после обрыва узел не переписывался');
    assert.deepEqual(ctx.LC.accent.dominant(), stopped, 'цвет остался там, где его застали');
    assert.equal(dom.state.timers.filter((t) => !t.done).length, 0, 'висящих таймеров нет');
  });
});

/* Оборванный переход обязан доигрываться: фокус ушёл на соседнюю карточку
   и вернулся — цель та же, и без этого цвет застрял бы на промежуточном
   шаге до следующей смены фильма (ранний выход в apply). */
test('Task 60: вернувшийся на ту же карточку фокус доигрывает оборванный путь', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(300);
    ctx.LC.accent.stopTween();
    const stopped = ctx.LC.accent.dominant();
    assert.notDeepEqual(stopped, ctx.LC.accent.target(), 'путь и правда оборван посередине');

    ctx.LC.accent.applyFor({ poster_path: '/cold.jpg' });
    assert.deepEqual(ctx.LC.accent.dominant(), stopped, 'в момент возврата скачка нет');
    dom.state.advance(1600);
    assert.equal(ctx.LC.color.hex(ctx.LC.accent.dominant()), ctx.LC.color.hex(ctx.LC.accent.target()),
      'путь доигран с того места, где его прервали');
  });
});

/* F. Тот же фильм открывают карточкой посреди перехода: токены и цель
   совпадают, и до правки функция возвращалась ДО обрыва — переход шёл
   поверх карточки, а основная таблица оставалась с промежуточным цветом
   (p.bg = LC.accent.tint(source), palette() в src/30_css.js). */
test('Task 60: открытие карточки посреди перехода обрывает его и пересобирает таблицу', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(300);
    assert.notDeepEqual(ctx.LC.accent.dominant(), ctx.LC.accent.target(), 'переход идёт');
    const injects = ctx.state.injects;

    /* Тот же постер, что был под фокусом, — цвет придёт из кэша синхронно. */
    ctx.LC.accent.applyFor({ poster_path: '/cold.jpg' }, true);
    assert.deepEqual(ctx.LC.accent.dominant(), ctx.LC.accent.target(), 'цвет доведён до цели сразу');
    assert.equal(ctx.state.injects, injects + 1, 'таблица пересобрана — в ней мог остаться цвет середины пути');
    const rules = ctx.state.rules;
    dom.state.advance(3000);
    assert.equal(ctx.state.rules, rules, 'на открытой карточке переход больше не тикает');
  });
});

/* Смена режима движения на 'off' — тот же случай: подкраски там нет вовсе,
   и доигрывать её переходу незачем (src/80_settings.js зовёт repaint). */
test('Task 60: перевод движения в off гасит переход, а не оставляет его тикать', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const motion = { mode: 'full' };
    const ctx = accentCtx({ prefs: {}, motionRef: motion });
    twoPosters(ctx, dom);
    dom.state.advance(300);
    motion.mode = 'off';
    ctx.LC.accent.repaint();
    const rules = ctx.state.rules;
    dom.state.advance(3000);
    assert.equal(ctx.state.rules, rules, 'после выключения движения узел не переписывался');
    assert.equal(dom.state.timers.filter((t) => !t.done).length, 0, 'висящих таймеров нет');
  });
});

/* Ревью B: антиподы — единственный случай, где короткой дуги нет вовсе
   (обе половины круга ровно по 180°). Ни одна из двух поправок не
   срабатывает: разница остаётся ±180 со СВОИМ знаком, поэтому путь туда и
   обратно проходит по одной и той же половине круга, и середина у них
   одна. То есть выбор стороны здесь детерминирован и симметричен —
   blend(a,b,t) === blend(b,a,1-t) по оттенку; зафиксировано тестом, чтобы
   следующая правка дуги не сломала это молча. */
test('blend: ровно 180° — сторона круга выбрана устойчиво и одинаково в обе стороны', () => {
  const a = color.hslToRgb({ h: 30, s: 0.8, l: 0.5 });
  const b = color.hslToRgb({ h: 210, s: 0.8, l: 0.5 });
  const mid = color.rgbToHsl(color.blend(a, b, 0.5));
  assert.ok(Math.abs(mid.h - 120) < 2, 'середина между 30 и 210: ' + mid.h);
  const back = color.rgbToHsl(color.blend(b, a, 0.5));
  assert.ok(Math.abs(back.h - mid.h) < 2, 'обратный путь идёт той же половиной круга: ' + back.h);
  /* На четверти пути — тоже зеркало: 30 + 45 против 210 - 45. */
  assert.ok(Math.abs(color.rgbToHsl(color.blend(a, b, 0.25)).h - 75) < 2);
  assert.ok(Math.abs(color.rgbToHsl(color.blend(b, a, 0.75)).h - 75) < 2);
  /* Концы при этом остаются концами в обе стороны. */
  assert.deepEqual(color.blend(a, b, 0), a);
  assert.deepEqual(color.blend(b, a, 0), b);
});

/* Ревью C: оба конца без своего оттенка. Тянуть оттенок неоткуда, и путь
   обязан остаться серым, а не заехать в красный (h = 0). */
test('blend: два серых конца — путь остаётся серым', () => {
  const dark = { r: 60, g: 60, b: 60 };
  const light = { r: 180, g: 180, b: 180 };
  const mid = color.blend(dark, light, 0.5);
  assert.ok(Math.abs(mid.r - mid.g) <= 1 && Math.abs(mid.g - mid.b) <= 1, 'середина серая: ' + JSON.stringify(mid));
  assert.ok(mid.r > 60 && mid.r < 180, 'светлота посередине: ' + mid.r);
});

/* Ревью D: шаг пути обязан быть СВОИМ объектом. Прежде blend на концах
   отдавал тот же объект, что ему передали, и после конца перехода
   нарисованный цвет и цель оказывались одной ссылкой. */
test('blend: концы отрезка — копии, а не те же объекты', () => {
  const a = { r: 210, g: 130, b: 50 };
  const b = { r: 40, g: 90, b: 210 };
  assert.notEqual(color.blend(a, b, 0), a, 'начало — копия');
  assert.notEqual(color.blend(a, b, 1), b, 'конец — копия');
  assert.deepEqual(color.blend(a, b, 0), a);
});

test('Task 60: после перехода нарисованный цвет и цель — разные объекты', () => {
  const dom = fakeDom({ datas: [WARM_POSTER, COLD_POSTER] });
  withDom(dom, () => {
    const ctx = accentCtx({ prefs: {} });
    twoPosters(ctx, dom);
    dom.state.advance(1600);
    assert.deepEqual(ctx.LC.accent.dominant(), ctx.LC.accent.target());
    assert.notEqual(ctx.LC.accent.dominant(), ctx.LC.accent.target(), 'одна ссылка на два значения — хрупкий инвариант');
  });
});

/* Ревью J: картинка ответила, но размеров у неё нет (битый файл, WebView
   отдал пустой кадр). Прежде выход был молчаливым, и HUD показывал бы
   состояние ПРЕДЫДУЩЕГО фильма — ровно та догадка вместо факта, против
   которой диагностика и сделана. */
test('status: пустая картинка — своё состояние, а не состояние прошлого фильма', () => {
  const dom = fakeDom({});
  withDom(dom, () => {
    const api = fresh().api;
    api.fromImage('https://image.tmdb.org/t/p/w185/good.jpg', () => { });
    dom.state.images[0].onload();
    assert.equal(api.status().state, 'ok');

    dom.state.images[1] = null;
    api.fromImage('https://image.tmdb.org/t/p/w185/blank.jpg', () => { });
    const img = dom.state.images[dom.state.images.length - 1];
    img.naturalWidth = 0;
    img.naturalHeight = 0;
    img.onload();
    assert.equal(api.status().state, 'blank');
    assert.equal(api.status().url, 'image.tmdb.org/t/p/w185/blank.jpg');
  });
});

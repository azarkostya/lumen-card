import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/* Task 31 (фаза 4): HUD отладки на экране ТВ.

   Модуль работает с НАТИВНЫМ DOM (document.createElement, body.appendChild/
   removeChild, querySelectorAll) и requestAnimationFrame — не с jQuery-like
   объектами, которые отдаёт test/_fakedom.mjs (тот собран под $() и сюда не
   подходит). Поэтому окружение здесь — свои минимальные заглушки, по образцу
   test/perf.test.mjs: requestAnimationFrame — ручная очередь без авто-вызова
   (кадр выполняется только по явному tick()), поэтому после последнего теста
   файла node --test завершается сам — в очереди не остаётся ни одного
   реального таймера. */

const SRC = readFileSync(new URL('../src/69_hud.js', import.meta.url), 'utf8');
/* LC.util — селектор общего правила «карточка на экране» (долг фазы 1,
   п.4), по нему eps() считает плитки активной карточки. */
const UTIL_SRC = readFileSync(new URL('../src/10_util.js', import.meta.url), 'utf8');

function fresh(extra) {
  const LC = Object.assign({}, extra || {});
  new Function('LC', 'module', UTIL_SRC)(LC, { exports: null, lumen: true });
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

/* ====================================================================== */
/* format: чистая функция, DOM не нужен.                                  */
/* ====================================================================== */

/* Task 68 (фаза 6): базовый набор полей строки. Все величины подаются
   готовыми — format() ничего не измеряет сам. */
const BASE = { fps: 58, avg: 55, p95: 19.2, P: 16.7, lat95: 3.1, loaf: { n: 2, ms: 140 }, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: { win: 3, total: 212 }, raf: [48, 3, 1, 0], eps: 25, layers: 5, hw: '4c/2gb' };

/* Волна производительности (жалоба с ТВ «всё ещё лагает всё», 2026-09-24):
   гистограмма с жёсткой границей 16 мс резала нормальные кадры — дельта
   rAF на 60 Гц гуляет 16,4–17,1 мс, и половина ровных кадров уезжала во
   вторую корзину. Теперь корзины — от медианы дельт P (≤1,5·P — кадр
   вовремя, ≤2,5·P — пропущен один, ≤3,5·P — два, дальше — больше), P
   пишется рядом, и в строке среднее fps за окно и p95 дельты. Плюс то, что
   на cr 153 уже есть: long-animation-frame и задержка колбэка rAF. */
test('волна perf: format — avg, p95, P у гистограммы, lat95 и loaf', () => {
  const { api } = fresh();
  const line = api.format(BASE);
  assert.ok(line.indexOf('58 fps · avg 55 · p95 19.2 · ') === 0, 'fps, среднее за окно и p95 — в начале строки: ' + line);
  assert.ok(line.indexOf(' · raf 48/3/1/0 P16.7 · ') !== -1, 'P рядом с корзинами: ' + line);
  assert.ok(line.indexOf(' · lat95 3.1 · ') !== -1, 'задержка колбэка rAF: ' + line);
  assert.ok(line.indexOf(' · loaf 2/140 · ') !== -1, 'long-animation-frame: число и сумма blockingDuration: ' + line);
});

test('волна perf: format — нет loaf и задержки rAF — «n/a», а не ноль', () => {
  const { api } = fresh();
  const line = api.format(Object.assign({}, BASE, { loaf: null, lat95: null }));
  assert.ok(line.indexOf(' · loaf n/a · ') !== -1, line);
  assert.ok(line.indexOf(' · lat95 n/a · ') !== -1, line);
});

/* Чистая часть окна: корзины от медианы, среднее, p95. */
test('волна perf: windowStats — корзины от медианы дельт, границы 1,5/2,5/3,5·P включительно', () => {
  const { api } = fresh();
  /* Девять дельт: медиана (пятая по порядку) — 16. Границы: 24 / 40 / 56. */
  const s = api.windowStats([16, 16, 16, 16, 16, 24, 40, 57, 100], []);
  assert.equal(s.P, 16);
  assert.deepEqual(s.raf, [6, 1, 0, 2], '16×5 и 24 — вовремя, 40 — минус один, 57 и 100 — больше трёх');
  assert.equal(s.avg, Math.round(9 * 1000 / 301), 'среднее fps — кадры на сумму дельт');
  assert.equal(s.p95, 100, 'p95 девяти значений — девятое');
  assert.equal(s.lat95, null, 'задержек нет — null');
  /* 60 Гц с дрожанием: ни один ровный кадр не уходит во вторую корзину —
     ровно то, что делала прежняя граница 16 мс. */
  const jitter = api.windowStats([16.4, 16.9, 16.6, 17.1, 16.5, 16.8], [0.4, 1.2, 0.8]);
  assert.deepEqual(jitter.raf, [6, 0, 0, 0]);
  assert.equal(jitter.lat95, 1.2);
  /* 30 Гц ровно: медиана 33 — тоже «вовремя», а не «всё во второй». */
  assert.deepEqual(api.windowStats([33.3, 33.4, 33.3, 33.4], []).raf, [4, 0, 0, 0]);
  assert.deepEqual(api.windowStats([], []), { raf: [0, 0, 0, 0], P: 0, avg: 0, p95: 0, lat95: null });
});

test('hud: format — строка содержит fps, «1920×1080@2», режим, «long 3/212», «layers 5», «hw»', () => {
  const { api } = fresh();
  const line = api.format(BASE);
  assert.ok(line.indexOf('58') !== -1, 'fps в строке: ' + line);
  assert.ok(line.indexOf('1920×1080@2') !== -1, 'разрешение и dpr: ' + line);
  assert.ok(line.indexOf('full') !== -1, 'режим анимаций: ' + line);
  assert.ok(line.indexOf('long 3/212') !== -1, 'длинные задачи за окно и всего: ' + line);
  assert.ok(line.indexOf('layers 5') !== -1, 'число полноэкранных слоёв: ' + line);
  assert.ok(line.indexOf('hw 4c/2gb') !== -1, 'ядра и память: ' + line);
});

/* Task 68: десять фото HUD с телевизора (2026-09-21) пришлось читать
   серией, вычитая нарастающий long между снимками. Величины обязаны
   читаться с ОДНОГО кадра: длинные задачи за последнее скользящее окно и
   всего, гистограмма rAF-дельт, размер ряда серий, мажор Chromium. */
test('hud: format — long за окно и всего, гистограмма rAF, eps, cr', () => {
  const { api } = fresh();
  const line = api.format(BASE);
  assert.ok(line.indexOf('raf 48/3/1/0') !== -1, 'гистограмма по четырём корзинам: ' + line);
  assert.ok(line.indexOf('eps 25') !== -1, 'число плиток серий: ' + line);
  assert.ok(line.indexOf('cr 77') !== -1, 'мажор Chromium: ' + line);
});

/* Отсутствие longtask обязано читаться как «нечем мерить», а не как
   «длинных задач нет»: в строке с нулём эти два случая неразличимы, и
   именно на этом сгорела серия снимков — счётчик стоял бы на нуле молча. */
test('hud: format — без поддержки longtask пишется «long n/a», а не ноль', () => {
  const { api } = fresh();
  const line = api.format(Object.assign({}, BASE, { long: null }));
  assert.ok(line.indexOf('long n/a') !== -1, 'нечем мерить: ' + line);
  assert.ok(line.indexOf('long 0') === -1, 'ноль не имеет права появиться: ' + line);
});

/* Ревью Task 40 (п.6): эти два числа нужны, чтобы подтвердить порог
   weakHardware на живом телевизоре — правило «два ядра» необратимо для
   сессии, а hardwareConcurrency в Android WebView не всегда равен числу
   физических ядер. */
test('hud: hardware — ядра и память, несообщённое пишется «n/a»', () => {
  assert.equal(env({ hardware: { hardwareConcurrency: 4, deviceMemory: 2 } }).api.hardware(), '4c/2gb');
  assert.equal(env({ hardware: { hardwareConcurrency: 2, deviceMemory: 1 } }).api.hardware(), '2c/1gb');
  /* Task 68: на телевизоре пользователя deviceMemory не отдан — в строке
     стояло «hw 4c/?», и «?» ничем не отличался от «поле сломалось». Теперь
     это то же «n/a», что у long: браузер не сообщил величину. */
  assert.equal(env({ hardware: { hardwareConcurrency: 8, deviceMemory: undefined } }).api.hardware(), '8c/n/a');
  assert.equal(env({ hardware: { hardwareConcurrency: 0, deviceMemory: 0 } }).api.hardware(), 'n/a/n/a',
    'ноль — это «не сообщили», а не «ноль ядер»');
});

/* Task 68: мажор Chromium — одно число вместо строки userAgent в полэкрана.
   По нему видно, какие API на устройстве вообще существуют (на 77-м нет ни
   long-animation-frame, ни content-visibility). */
test('hud: chrome — мажор из userAgent, без него «n/a»', () => {
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (Linux; Android 9; PHILIPS) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36' } }).api.chrome(), '77');
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (X11; CrOS) AppleWebKit/537.36 Chromium/112.0.0.0 Safari/537.36' } }).api.chrome(), '112',
    'Chromium без бренда Chrome тоже считается');
  assert.equal(env({ hardware: { userAgent: 'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/16.0 Safari/605.1.15' } }).api.chrome(), 'n/a');
});

/* ====================================================================== */
/* Жизненный цикл: нативный DOM + requestAnimationFrame под ручным         */
/* управлением.                                                            */
/* ====================================================================== */

/* Task 60: состояние подкраски, которое отдаёт LC.accent по умолчанию в
   этом окружении. Ожидания тестов, собирающие строку через format(), берут
   его же — иначе они сравнивали бы строку с подкраской и строку без неё. */
const ENV_TINT = { state: 'ok', color: '#8A4C50', url: 'image.tmdb.org/t/p/w185/a.jpg' };

function env(opts) {
  opts = opts || {};
  const bodyChildren = [];
  /* Селекторы, с которыми модуль ходил в querySelectorAll: разбор по
     последнему классу части (ниже) скоуп не различает, а Task 68 требует
     именно его — плитки считаются в АКТИВНОЙ активности. */
  const asked = [];
  const frames = [];
  let nextRaf = 1;
  const cancelled = [];
  let nowMs = 0;

  function makeNode(tag) {
    return { tagName: ('' + tag).toUpperCase(), className: '', textContent: '', parentNode: null };
  }

  const doc = {
    createElement: (tag) => makeNode(tag),
    body: {
      appendChild: (node) => { node.parentNode = doc.body; bodyChildren.push(node); },
      removeChild: (node) => {
        const i = bodyChildren.indexOf(node);
        if (i !== -1) bodyChildren.splice(i, 1);
        node.parentNode = null;
      }
    },
    /* Единственный querySelectorAll в модуле — внутри layers(), с составным
       селектором FULL (11 частей через запятую, одна из них с пробелом-
       потомком). Полноценного движка селекторов здесь нет: разбор по запятой
       плюс сравнение по ПОСЛЕДНЕМУ классу каждой части (для «.a .b» — по
       .b) — этого достаточно, чтобы честно посчитать плоский список узлов
       bodyChildren по любому из классов FULL, и заодно совпадает с
       '.lumen-hud' (одна часть без запятой и без пробела). */
    querySelectorAll: (sel) => {
      asked.push('' + sel);
      const parts = ('' + sel).split(',').map((p) => p.trim());
      return bodyChildren.filter((n) => {
        const classes = ('' + n.className).split(/\s+/).filter(Boolean);
        return parts.some((p) => {
          const last = p.split(/\s+/).pop();
          return last.charAt(0) === '.' && classes.indexOf(last.slice(1)) !== -1;
        });
      });
    }
  };

  const store = Object.assign({}, opts.store || {});
  /* Изменяемая ссылка (не снимок opts.enabled на момент env()): тест
     «выключенный плагин» переключает её между sync(), а замыкание enabled()
     обязано видеть текущее значение, а не то, что было при создании env(). */
  const enabledRef = { value: opts.enabled !== false };
  const win = {
    innerWidth: opts.width || 1920,
    innerHeight: opts.height || 1080,
    devicePixelRatio: opts.dpr || 2,
    /* Ручная очередь: кадр не выполняется сам, только через tick() —
       поэтому висящих реальных таймеров не остаётся и после последнего
       теста node --test завершает процесс сам. */
    requestAnimationFrame: (fn) => { const id = nextRaf++; frames.push({ id, fn }); return id; },
    cancelAnimationFrame: (id) => {
      cancelled.push(id);
      for (let i = 0; i < frames.length; i++) if (frames[i].id === id) { frames.splice(i, 1); return; }
    },
    /* Ревью Task 40 (п.6): HUD показывает ядра и память — по ним срабатывает
       LC.perf.weakHardware. opts.hardware кладётся как есть: отсутствующее
       свойство обязано остаться отсутствующим (deviceMemory есть не везде). */
    /* Task 68: userAgent по образцу телевизора пользователя (Philips
       50PUS8057, WebView Chrome/77) — из него HUD берёт поле «cr 77». */
    navigator: Object.assign({
      hardwareConcurrency: 4, deviceMemory: 2,
      userAgent: 'Mozilla/5.0 (Linux; Android 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/77.0.3865.90 Safari/537.36'
    }, opts.hardware || {})
  };

  /* opts.longtask поднимает фейковый PerformanceObserver с нужным
     supportedEntryTypes; без него window.PerformanceObserver не задан
     вовсе — окружение воспроизводит браузер без longtask (см. src/69_hud.js:
     проверка supportedEntryTypes перед подпиской). observers — журнал
     observe()/disconnect() по инстансам, obsCallbacks — их колбэки, чтобы
     дёргать longtask-записи руками. */
  const observers = [];
  const obsCallbacks = [];
  if (opts.longtask || opts.loaf) {
    win.PerformanceObserver = function (cb) {
      const rec = { cb, types: [] };
      obsCallbacks.push(rec);
      this.observe = (init) => {
        rec.types = (init && (init.entryTypes || [init.type])) || [];
        observers.push({ op: 'observe', init });
      };
      this.disconnect = () => { observers.push({ op: 'disconnect' }); };
    };
    const types = [];
    if (opts.longtask && opts.longtaskSupported !== false) types.push('longtask');
    if (opts.loaf) types.push('long-animation-frame');
    win.PerformanceObserver.supportedEntryTypes = types;
  }
  /* Волна perf: задержка колбэка rAF — performance.now() в момент вызова
     минус метка кадра. opts.lateBy — на сколько мс колбэк опаздывает. */
  if (typeof opts.lateBy === 'number') {
    win.performance = { now: () => nowMs + opts.lateBy };
  }

  globalThis.document = doc;
  globalThis.window = win;

  function pref(name, def) {
    return Object.prototype.hasOwnProperty.call(store, name) ? !!store[name] : def;
  }

  /* Task 60: HUD спрашивает состояние подкраски у LC.accent (src/57_color.js).
     opts.accent === null воспроизводит окружение, где модуля подкраски нет
     вовсе, — в тестах 69_hud.js грузится один. */
  const accentStatus = opts.accent === undefined
    ? ENV_TINT
    : opts.accent;
  const { api } = fresh({
    accent: accentStatus ? { status: () => accentStatus } : undefined,
    /* Проверка на ТВ 2026-09-24: состояние трейлера (поле tr). Без
       opts.trailer модуля нет вовсе — как у подкраски выше. */
    trailer: opts.trailer ? { status: () => opts.trailer } : undefined,
    /* Волна «Логотипы сразу»: предзагрузка соседей (поле pf). Без
       opts.prefetch модуля нет вовсе. */
    prefetch: opts.prefetch ? { stats: () => opts.prefetch } : undefined,
    pref, motionMode: () => opts.mode || 'full',
    /* LC.enabled() — гейт «выключенный плагин снял свой CSS, HUD поднимать
       нельзя» (sync(), src/69_hud.js). По умолчанию true, как у соседних
       тестов (test/fx.test.mjs и т.п.). */
    enabled: () => enabledRef.value
  });

  return {
    api, store, bodyChildren, cancelled, observers, asked,
    tick: (ms) => {
      const frame = frames.shift();
      if (!frame) return false;
      nowMs += ms || 0;
      frame.fn(nowMs);
      return true;
    },
    framesLeft: () => frames.length,
    setEnabled: (v) => { enabledRef.value = v; },
    /* Кладёт узел прямо в bodyChildren, минуя api — для layers()/FULL. */
    addLayer: (className) => { const n = makeNode('div'); n.className = className; doc.body.appendChild(n); return n; },
    /* Имитирует одну longtask-запись PerformanceObserver — на ВСЕ подписки
       разом, как это делает реальный браузер. */
    fireLongtask: (entries) => { obsCallbacks.forEach((r) => { if (r.types.indexOf('longtask') !== -1) r.cb({ getEntries: () => entries }); }); },
    fireLoaf: (entries) => { obsCallbacks.forEach((r) => { if (r.types.indexOf('long-animation-frame') !== -1) r.cb({ getEntries: () => entries }); }); }
  };
}

/* Полоса телеметрии: под строкой HUD — строка героя (зонд, ниже). Первая
   строка — прежняя, format() её и собирает. */
function line1(e) {
  return e.bodyChildren[0].textContent.split('\n')[0];
}

test('hud: выключен — узла нет, running() === false, ни один кадр не запрошен', () => {
  const e = env({ store: { lumen_debug_hud: false } });
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел не создан');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0, 'requestAnimationFrame ни разу не вызван');
});

test('hud: включён — ровно один узел .lumen-hud, повторный sync() не плодит второй, running() === true; после выключения настройки и sync() узел снят, running() === false и кадр отменён', () => {
  const e = env({ store: { lumen_debug_hud: true } });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'ровно один узел создан');
  assert.equal(e.bodyChildren[0].className, 'lumen-hud');
  assert.equal(e.api.running(), true);
  assert.equal(e.framesLeft(), 1, 'первый кадр запрошен');

  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'повторный sync() не плодит второй узел');
  assert.equal(e.api.running(), true);

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'узел снят при выключении настройки');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'висящий кадр отменён через cancelAnimationFrame');
});

test('hud: layers() — составной селектор FULL считает узлы по любому из классов (примитивный разбор запятых в тестовой заглушке)', () => {
  const e = env();
  assert.equal(e.api.layers(), 0, 'без слоёв — ноль');
  e.addLayer('lumen-fx');
  e.addLayer('lumen-ambient');
  assert.equal(e.api.layers(), 2, 'оба узла посчитаны через FULL');
});

/* Долг фазы 4: постоянные слои Task 46 (корень героя и область рядов
   главной, translateZ(0) в src/30_css.js) — тоже полноэкранные буферы, и
   счёт без них занижал цифру HUD на 2. */
test('hud: layers() считает и два постоянных слоя Task 46 — корень героя и область рядов', () => {
  const e = env();
  e.addLayer('lumen-hero lumen-hero--compact');
  assert.equal(e.api.layers(), 1, 'корень героя посчитан');
  const full = e.asked[e.asked.length - 1].split(',').map((p) => p.trim());
  assert.ok(full.indexOf('.lumen-hero') !== -1, 'корня героя нет в FULL: ' + full.join(','));
  assert.ok(full.indexOf('.lumen-main .scroll.layer--wheight') !== -1, 'области рядов нет в FULL: ' + full.join(','));
  /* Оба селектора — ровно те узлы, которым таблица стилей ставит translateZ(0). */
  const cssSrc = readFileSync(new URL('../src/30_css.js', import.meta.url), 'utf8');
  const ruleOf = (sel) => {
    const at = cssSrc.indexOf("css.push('" + sel + '{');
    return at === -1 ? '' : cssSrc.slice(at, cssSrc.indexOf('\n    css.push(', at + 1));
  };
  assert.ok(/translateZ\(0\)/.test(ruleOf('.lumen-hero')), 'у .lumen-hero больше нет translateZ(0) — пересмотреть FULL');
  assert.ok(/translateZ\(0\)/.test(ruleOf('.lumen-main .scroll.layer--wheight')),
    'у области рядов больше нет translateZ(0) — пересмотреть FULL');
});

/* Волна 3 (ТВ 2026-09-24): вуали героя сняты, их место заняло затемнение
   неподвижного слоя кадра — два узла .lumen-hero__scrim (второй с
   модификатором --l) и пол сжатого состояния .lumen-hero__floor. Сам слой
   .lumen-hero-stage — контейнер без transform и без своего рисунка, в счёт
   он не идёт. Разметку слоя берём из исходника героя (buildStage), чтобы
   сверка шла с тем, что реально строится. */
test('волна 3: FULL считает затемнение слоя кадра и пол, вуалей в нём нет', () => {
  const e = env();
  e.api.layers();
  const full = e.asked[e.asked.length - 1].split(',').map((p) => p.trim());
  assert.ok(full.indexOf('.lumen-hero__scrim') !== -1, 'затемнения кадра нет в FULL: ' + full.join(','));
  assert.ok(full.indexOf('.lumen-hero__floor') !== -1, 'пола сжатого состояния нет в FULL: ' + full.join(','));
  assert.equal(full.filter((p) => p.indexOf('veil') !== -1 && p.indexOf('lumen-hero') !== -1).length, 0,
    'в FULL остались вуали героя: ' + full.join(','));
  assert.equal(full.indexOf('.lumen-hero-stage'), -1, 'контейнер слоя кадра ничего не рисует — ему не место в FULL');

  const heroSrc = readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8');
  const stage = /function buildStage\(\) \{([\s\S]*?)\n    \}/.exec(heroSrc);
  assert.ok(stage, 'buildStage не найдена');
  const kids = (stage[1].match(/class="([^"]+)"/g) || []).map((m) => m.slice(7, -1)).filter((c) => c !== 'lumen-hero-stage');
  assert.equal(kids.length, 7, 'в слое кадра семь рисующих узлов: ' + kids.join(' | '));
  for (const cls of kids) e.addLayer(cls);
  assert.equal(e.api.layers(), 7, 'каждый узел слоя кадра посчитан ровно один раз');
});

/* Ревью фикс-раунда, Ф2 п.3. На экране карточки счёт по всему документу
   завышал цифру примерно на 9: под карточкой, в скрытой активности главной,
   живёт запаркованный герой (src/48_hero.js, park) и область рядов. Слои
   делятся по правилу LC.util.onScreen: показанная активность и узлы вне
   активностей — первое число, активности истории — второе. */
test('Ф2 п.3: layerCounts — слои видимого экрана и скрытых под ним активностей раздельно', () => {
  const e = env();
  const activity = (on) => ({ classList: { contains: (c) => on && c === 'activity--active' } });
  const shown = activity(true);
  const hidden = activity(false);
  const put = (cls, act) => { const n = e.addLayer(cls); n.closest = (sel) => (sel === '.activity' ? act : null); return n; };
  /* Карточка поверх главной: фон карточки на экране… */
  put('lumen-backdrop__img', shown);
  put('lumen-backdrop__veil lumen-backdrop__veil--l', shown);
  /* …а под ней запаркованный герой главной. */
  put('lumen-hero', hidden);
  put('lumen-hero__bg lumen-hero__bg--a', hidden);
  put('lumen-hero__lqip', hidden);
  put('lumen-hero__scrim lumen-hero__scrim--l', hidden);
  /* Слой перехода живёт в body, вне активностей, — он на экране. */
  put('lumen-overlay__img', null);

  assert.equal(e.api.layers(), 3, 'layers() — видимый экран, без скрытых активностей');
  assert.deepEqual(e.api.layerCounts(), { on: 3, off: 4 });
});

test('Ф2 п.3: строка HUD — «layers 3+4», и «+0», когда под экраном ничего', () => {
  const { api } = fresh();
  assert.ok(api.format(Object.assign({}, BASE, { layers: 3, hid: 4 })).indexOf(' · layers 3+4 · ') !== -1);
  assert.ok(api.format(Object.assign({}, BASE, { layers: 5, hid: 0 })).indexOf(' · layers 5+0 · ') !== -1);
});

/* ====================================================================== */
/* paint(): rAF-цикл. Первый кадр цикла — опорная точка (state.last ещё 0), */
/* в счётчик не идёт. Дальше окно в 1000мс набирается несколькими кадрами:  */
/* meньше 1000мс — текст не трогаем; наступил порог — fps = кадры * 1000 / */
/* фактический элапсед (не «сырое число кадров» — окно почти никогда не    */
/* ровно 1000мс). Второе окно проверяет, что счётчик кадров и опорное      */
/* время РЕАЛЬНО сбрасываются: без сброса fps во втором окне удвоился бы    */
/* (или собрался бы по чужой опоре) вместо повторения того же значения.    */
/* ====================================================================== */

test('hud: два окна подряд — fps считается по фактическому элапседу и не удваивается во втором окне', () => {
  const e = env({ store: { lumen_debug_hud: true }, width: 1920, height: 1080, dpr: 2, mode: 'full' });
  e.api.sync();

  assert.ok(e.tick(600), 'первый кадр — опорная точка, ничего не считает и не пишет');
  assert.equal(e.bodyChildren[0].textContent, '', 'текст ещё не написан');

  assert.ok(e.tick(600), 'второй кадр окна 1 — элапсед 600мс < 1000, текст не трогаем');
  assert.equal(e.bodyChildren[0].textContent, '');

  assert.ok(e.tick(600), 'третий кадр окна 1 — элапсед от опоры 1200мс >= 1000, отрисовка');
  /* Литерал, а не e.api.layers(): ожидание не должно вычисляться тем же
     кодом, который проверяется (без слоёв в этом env — 0). fps = round(2
     кадра * 1000 / 1200мс) = round(1.667) = 2. long — null: в этом env
     PerformanceObserver не заведён вовсе, мерить длинные задачи нечем.
     Гистограмма: обе дельты по 600мс — медиана и есть 600, обе «вовремя». */
  const win1 = e.api.format({ fps: 2, avg: 2, p95: 600, P: 600, lat95: null, loaf: null, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: null, raf: [2, 0, 0, 0], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(line1(e), win1, 'окно 1: 2 кадра за 1200мс');

  assert.ok(e.tick(600), 'первый кадр окна 2 — элапсед от новой опоры 600мс < 1000');
  assert.equal(line1(e), win1, 'текст ещё не тронут окном 2');

  assert.ok(e.tick(600), 'второй кадр окна 2 — снова 1200мс от опоры');
  /* Те же 2 кадра в fps, но гистограмма — за ПЯТЬ последних интервалов
     обновления, поэтому в ней уже 4 дельты: две из окна 1 плюс две свои. */
  const win2 = e.api.format({ fps: 2, avg: 2, p95: 600, P: 600, lat95: null, loaf: null, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: null, raf: [4, 0, 0, 0], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(line1(e), win2,
    'то же значение fps, что и в окне 1 — счётчик кадров и опорное время реально сброшены, а не растут дальше');
});

/* ====================================================================== */
/* Task 68: гистограмма rAF-дельт по корзинам ≤16 / ≤33 / ≤50 / >50 мс.    */
/* На устройстве rAF тикает (иначе HUD не обновлялся бы вовсе и серии фото */
/* с меняющимся fps не получилось бы), и именно по этим четырём числам с   */
/* одного снимка видно, редкие ли это провалы или ровная просадка.         */
/* ====================================================================== */

test('волна perf: гистограмма rAF в строке — корзины от медианы окна, P рядом', () => {
  const e = env({ store: { lumen_debug_hud: true }, width: 1920, height: 1080, dpr: 2, mode: 'lite' });
  e.api.sync();

  e.tick(100);              /* опорный кадр: дельты ещё нет */
  [16, 16, 16, 16, 24, 40, 57].forEach((ms) => e.tick(ms));
  /* Сумма дельт после опорного — 185мс, порога 1000 ещё нет. */
  assert.equal(e.bodyChildren[0].textContent, '', 'окно ещё не закрыто');
  e.tick(1000);             /* восьмая дельта и закрытие окна */

  /* Дельты по порядку: 16, 16, 16, 16, 24, 40, 57, 1000 — медиана (индекс
     floor(8/2) = 4) равна 24. Границы 36 / 60 / 84: 16×4 и 24 — вовремя,
     40 и 57 — минус один кадр, 1000 — больше трёх. */
  const expected = e.api.format({
    fps: Math.round(8 * 1000 / 1185), avg: Math.round(8 * 1000 / 1185), p95: 1000, P: 24, lat95: null, loaf: null,
    w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'lite',
    long: null, raf: [5, 2, 0, 1], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT
  });
  assert.equal(line1(e), expected);
});

test('волна perf: задержка колбэка rAF доезжает до строки как lat95', () => {
  const e = env({ store: { lumen_debug_hud: true }, lateBy: 4 });
  e.api.sync();
  e.tick(100);
  e.tick(600);
  e.tick(600);
  assert.ok(e.bodyChildren[0].textContent.indexOf(' · lat95 4 · ') !== -1, e.bodyChildren[0].textContent);
});

test('волна perf: long-animation-frame — подписка при поддержке, число и сумма blockingDuration за окно', () => {
  const e = env({ store: { lumen_debug_hud: true }, loaf: true });
  e.api.sync();
  assert.ok(e.observers.some((x) => x.op === 'observe' && x.init && x.init.type === 'long-animation-frame'),
    'подписки на long-animation-frame нет: ' + JSON.stringify(e.observers));
  e.fireLoaf([{ duration: 120, blockingDuration: 70 }, { duration: 90, blockingDuration: 40.4 }]);
  e.tick(100);
  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf(' · loaf 2/110 · ') !== -1, e.bodyChildren[0].textContent);
  /* Без поддержки типа — «n/a». */
  const none = env({ store: { lumen_debug_hud: true } });
  none.api.sync();
  none.tick(100);
  none.tick(1000);
  assert.ok(none.bodyChildren[0].textContent.indexOf(' · loaf n/a · ') !== -1, none.bodyChildren[0].textContent);
});

/* ====================================================================== */
/* Task 68: число плиток ряда серий. После Task 67 ряд строится окном, и   */
/* это ключевая величина: на телевизоре число плиток неизвестно, HUD его   */
/* не показывал. На главной карточки нет — поле обязано быть нулём.        */
/* ====================================================================== */

test('hud: eps() — считает узлы .lumen-episode активной карточки, на главной ноль', () => {
  const e = env();
  assert.equal(e.api.eps(), 0, 'карточки нет — ноль');
  e.addLayer('lumen-episode selector');
  e.addLayer('lumen-episode selector');
  e.addLayer('lumen-fx');
  assert.equal(e.api.eps(), 2, 'посчитаны только плитки серий');
  assert.equal(e.api.layers(), 1, 'плитки серий не попали в полноэкранные слои');
  /* Lampa держит предыдущие активности смонтированными и переносит класс
     .activity--active на текущую (vendor/lampa/app.min.js:46024-46026).
     Без скоупа счёт складывал бы ряды двух карточек: замер на стенде
     960×540@2 — переход «Дюна» → «Дораэмон» дал 50 плиток вместо 25. */
  assert.ok(e.asked.some((sel) => sel === '.activity--active .lumen-episode'),
    'запрос без скоупа активной активности: ' + e.asked.join(' | '));
});

/* ====================================================================== */
/* Task 68: строка перерисовывается не чаще раза в секунду — HUD не имеет  */
/* права сам стоить кадров на устройстве, где мы ловим просадки.           */
/* ====================================================================== */

test('hud: за окно в 1000мс textContent пишется ровно один раз, сколько бы кадров ни пришло', () => {
  const e = env({ store: { lumen_debug_hud: true } });
  e.api.sync();

  const node = e.bodyChildren[0];
  let writes = 0;
  let text = '';
  Object.defineProperty(node, 'textContent', {
    get: () => text,
    set: (v) => { writes++; text = v; }
  });

  /* Первый кадр — опорный (t = 100мс), дальше кадры каждые 100мс: окна
     закрываются на 1100мс и 2100мс. */
  for (let i = 0; i < 21; i++) e.tick(100);
  assert.equal(writes, 2, 'два закрытых окна — ровно две записи, а не двадцать одна');
});

/* ====================================================================== */
/* PerformanceObserver('longtask'): подписка только при поддержке,         */
/* накопление long по колбэку, снятие в stop().                            */
/* ====================================================================== */

test('hud: PerformanceObserver — подписывается только при supportedEntryTypes с longtask', () => {
  const supported = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: true });
  supported.api.sync();
  assert.ok(supported.observers.some((x) => x.op === 'observe'), 'longtask поддержан — observe() вызван');

  const unsupported = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: false });
  unsupported.api.sync();
  assert.equal(unsupported.observers.length, 0, 'longtask не в supportedEntryTypes — observe() не вызван вовсе');
});

test('hud: PerformanceObserver — накопленные longtask-записи доезжают до строки, disconnect() зовётся в stop()', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, width: 1920, height: 1080, dpr: 2, mode: 'full' });
  e.api.sync();

  e.fireLongtask([{}, {}]);
  e.fireLongtask([{}]);

  assert.ok(e.tick(600), 'опорный кадр');
  assert.ok(e.tick(600), 'элапсед 600мс — рано');
  assert.ok(e.tick(600), 'элапсед 1200мс — отрисовка');

  const expected = e.api.format({ fps: 2, avg: 2, p95: 600, P: 600, lat95: null, loaf: null, w: 1920, h: 1080, dpr: 2, cr: '77', mode: 'full', long: { win: 3, total: 3 }, raf: [2, 0, 0, 0], eps: 0, layers: 0, hw: '4c/2gb', tint: ENV_TINT });
  assert.equal(line1(e), expected, 'три накопленные longtask-записи видны в строке');

  e.store.lumen_debug_hud = false;
  e.api.sync();
  assert.ok(e.observers.some((x) => x.op === 'disconnect'), 'disconnect() вызван при stop()');
});

/* Task 68: десять фото с телевизора читались вычитанием нарастающего long
   между снимками — по одному снимку нельзя было сказать, сколько длинных
   задач было ПРЯМО СЕЙЧАС. Окно — пять последних закрытых интервалов
   строки, каждый не короче 1000мс; «всего» продолжает расти с момента
   включения HUD, как раньше. */
test('hud: long — окно из пяти интервалов уезжает, «всего» продолжает расти', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, width: 1920, height: 1080, dpr: 2, mode: 'lite' });
  e.api.sync();
  e.tick(100);                       /* опорный кадр */

  e.fireLongtask([{}, {}]);          /* две задачи в интервале 1 */
  e.tick(1000);                      /* интервал 1 закрыт */
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 2/2') !== -1, e.bodyChildren[0].textContent);

  e.fireLongtask([{}]);              /* одна задача в интервале 2 */
  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 3/3') !== -1,
    'окно ещё держит обе старые: ' + e.bodyChildren[0].textContent);

  /* Три пустых интервала: окно длиной пять держит интервалы 1–5, обе
     старые задачи ещё в нём. */
  e.tick(1000); e.tick(1000); e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 3/3') !== -1,
    'пять интервалов окна ещё накрывают первый: ' + e.bodyChildren[0].textContent);

  /* Шестой интервал вытесняет первый — вместе с его двумя задачами. */
  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 1/3') !== -1,
    'из окна ушёл интервал 1: ' + e.bodyChildren[0].textContent);

  e.tick(1000);
  assert.ok(e.bodyChildren[0].textContent.indexOf('long 0/3') !== -1,
    'окно пустое, «всего» не обнулилось: ' + e.bodyChildren[0].textContent);
});

/* Без PerformanceObserver (или без 'longtask' в supportedEntryTypes)
   счётчик стоял бы на нуле и был неотличим от «всё хорошо» — на
   устройстве, где консоли нет, это тихая ложь. */
test('hud: без поддержки longtask в строке «long n/a», а не «long 0»', () => {
  const e = env({ store: { lumen_debug_hud: true }, longtask: true, longtaskSupported: false });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  const line = e.bodyChildren[0].textContent;
  assert.ok(line.indexOf('long n/a') !== -1, line);
  assert.ok(line.indexOf('long 0') === -1, 'ноль не имеет права появиться: ' + line);
});

/* ====================================================================== */
/* Гейт LC.enabled(): выключенный плагин снимает свой CSS целиком           */
/* (LC.removeCss, src/90_runtime.js) — HUD не имеет права поднимать         */
/* нестилизованный узел поверх штатной карточки Lampa.                     */
/* ====================================================================== */

test('hud: выключенный плагин — sync() не поднимает HUD, даже если настройка включена; включение плагина поднимает его, а выключение сразу снимает', () => {
  const e = env({ store: { lumen_debug_hud: true }, enabled: false });

  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключен — узла нет, хотя настройка включена');
  assert.equal(e.api.running(), false);
  assert.equal(e.framesLeft(), 0);

  e.setEnabled(true);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 1, 'плагин включили — HUD поднимается');
  assert.equal(e.api.running(), true);

  e.setEnabled(false);
  e.api.sync();
  assert.equal(e.bodyChildren.length, 0, 'плагин выключили — HUD снят, хотя настройка осталась включённой');
  assert.equal(e.api.running(), false);
  assert.ok(e.cancelled.length > 0, 'rAF-цикл снят');
});

/* ====================================================================== */
/* Task 60: состояние подкраски в HUD.                                     */
/* ====================================================================== */

/* Пользователь пришёл с «подкраска вообще не работает», и на телевизоре
   отличить причину было нечем: консоли нет. HUD показывает состояние по
   факту и адрес, с которого читались пиксели, — по ним видно, чинить ли
   наш код или прокси без CORS-заголовка. */
test('hud: format — состояние подкраски с цветом и адресом', () => {
  const { api } = fresh();
  const base = BASE;
  const ok = api.format(Object.assign({}, base, {
    tint: { state: 'ok', color: '#8A4C50', url: 'image.tmdb.org/t/p/w185/a.jpg' }
  }));
  assert.ok(ok.indexOf('tint ok') !== -1, 'состояние: ' + ok);
  assert.ok(ok.indexOf('#8A4C50') !== -1, 'сам цвет: ' + ok);
  assert.ok(ok.indexOf('image.tmdb.org/t/p/w185/a.jpg') !== -1, 'адрес: ' + ok);

  const cors = api.format(Object.assign({}, base, {
    tint: { state: 'cors', color: '', url: 'proxy.example/t/p/w185/a.jpg' }
  }));
  assert.ok(cors.indexOf('tint cors') !== -1, cors);
  assert.ok(cors.indexOf('proxy.example/t/p/w185/a.jpg') !== -1, cors);

  const off = api.format(Object.assign({}, base, { tint: { state: 'off', color: '', url: '' } }));
  assert.ok(off.indexOf('tint off') !== -1, off);
  assert.ok(off.indexOf('undefined') === -1, 'пустых полей в строке нет: ' + off);
});

test('hud: состояние подкраски берётся у LC.accent и доезжает до узла', () => {
  const e = env({
    store: { lumen_debug_hud: true },
    accent: { state: 'timer', color: '', url: 'image.tmdb.org/t/p/w185/b.jpg' }
  });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf('tint timer') !== -1, e.bodyChildren[0].textContent);
  assert.ok(e.bodyChildren[0].textContent.indexOf('image.tmdb.org/t/p/w185/b.jpg') !== -1,
    e.bodyChildren[0].textContent);
});

/* ====================================================================== */
/* Проверка на ТВ 2026-09-24: состояние трейлера в HUD (поле tr).         */
/* «Трейлер не запускался» на телевизоре без консоли отличить было нечем: */
/* нет ролика у фильма, YouTube не поднялся, таймаут или ошибка плеера.   */
/* ====================================================================== */

test('hud: format — поле tr стоит перед подкраской, «tr n/a» без данных', () => {
  const { api } = fresh();
  const line = api.format(Object.assign({}, BASE, { tr: 'err 150', tint: { state: 'ok', color: '#8A4C50', url: 'x/y.jpg' } }));
  assert.ok(line.indexOf(' · tr err 150 · tint ok') !== -1, line);
  const none = api.format(BASE);
  assert.ok(none.indexOf(' · tr n/a · ') !== -1, none);
});

test('hud: состояние трейлера берётся у LC.trailer.status() и доезжает до узла', () => {
  const e = env({ store: { lumen_debug_hud: true }, trailer: 'timeout ready' });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf(' · tr timeout ready · ') !== -1, e.bodyChildren[0].textContent);
});

/* Модуля подкраски может не быть (69_hud.js грузится в тестах один) —
   HUD от этого не обязан падать или молчать. */
test('hud: без LC.accent строка всё равно собирается', () => {
  const e = env({ store: { lumen_debug_hud: true }, accent: null });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf('tint n/a') !== -1, e.bodyChildren[0].textContent);
});

/* ====================================================================== */
/* Волна «Логотипы сразу»: поле pf — предзагрузка соседей героя           */
/* (src/58_prefetch.js): запросов в пути, задач в очереди, деталей героя  */
/* из памяти. На ТВ без консоли по нему видно, работает ли она вовсе и не */
/* идут ли запросы при зажатой стрелке.                                   */
/* ====================================================================== */

test('hud: format — поле pf «в пути/в очереди/попадания» стоит перед tr, «pf n/a» без данных', () => {
  const { api } = fresh();
  const line = api.format(Object.assign({}, BASE, { pf: { fly: 2, queue: 5, hits: 17 }, tr: 'play' }));
  assert.ok(line.indexOf(' · hw 4c/2gb · pf 2/5/17 · font n/a · tr play · ') !== -1, line);
  const none = api.format(BASE);
  assert.ok(none.indexOf(' · pf n/a · font n/a · tr n/a · ') !== -1, none);
});

/* 1.0.1: «font ok|load|fail|off» — загрузился ли шрифт с Google Fonts
   (LC.fontsState, src/30_css.js). Без интернета «Шрифт» молча ничего не
   менял, и на телевизоре отличить это было нечем. Стоит между pf и tr. */
test('1.0.1: hud — поле font из LC.fontsState, между pf и tr', () => {
  const { api } = fresh();
  for (const st of ['ok', 'load', 'fail', 'off']) {
    const line = api.format(Object.assign({}, BASE, { pf: { fly: 0, queue: 0, hits: 0 }, font: st, tr: 'none' }));
    assert.ok(line.indexOf(' · pf 0/0/0 · font ' + st + ' · tr none · ') !== -1, line);
  }
});

test('hud: состояние предзагрузки берётся у LC.prefetch.stats() и доезжает до узла', () => {
  const e = env({ store: { lumen_debug_hud: true }, prefetch: { fly: 1, queue: 0, hits: 4 } });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf(' · pf 1/0/4 · ') !== -1, e.bodyChildren[0].textContent);
});

test('hud: без LC.prefetch — «pf n/a»', () => {
  const e = env({ store: { lumen_debug_hud: true } });
  e.api.sync();
  e.tick(600);
  e.tick(1800);
  assert.ok(e.bodyChildren[0].textContent.indexOf(' · pf n/a · ') !== -1, e.bodyChildren[0].textContent);
});

/* ====================================================================== */
/* Полоса телеметрии (исследование 2026-09-27, п.5.8): зонд героя —        */
/* T_title, T_frame, серый фон, pf h/m и сеть под нажатиями серии. Мерит   */
/* СНАРУЖИ героя: событие фокуса на корне, MutationObserver на узлах       */
/* героя, PerformanceObserver 'resource'. Окружение — свой маленький DOM:  */
/* узлы с классами, атрибутами и детьми, селекторы из одного класса.       */
/* ====================================================================== */

const FOCUS_SRC = readFileSync(new URL('../src/11_focus.js', import.meta.url), 'utf8');
/* Настоящий выбор названия героя (src/48_hero.js, heroTitle): зонд
   сравнивает текст с тем, что герой ПИШЕТ, а для чужого письма это не
   card.title. */
const HERO_TITLE = (function () {
  const m = { exports: null, lumen: true };
  new Function('LC', 'module', readFileSync(new URL('../src/48_hero.js', import.meta.url), 'utf8'))({}, m);
  return m.exports.heroTitle;
})();

/* Три фильма: у каждого свой ключевой арт, кадр из деталей, постер и
   логотип. Пути уникальны — по ним зонд и узнаёт «картинку этого фильма». */
const DUNE = { id: 1, title: 'Дюна', backdrop_path: '/dune-key.jpg', poster_path: '/dune-poster.jpg' };
const RIOT = { id: 2, title: 'Мятеж', backdrop_path: '/riot-key.jpg', poster_path: '/riot-poster.jpg' };
const THIRD = { id: 3, name: 'Сёгун', backdrop_path: '/shogun-key.jpg', poster_path: '/shogun-poster.jpg' };
const DETAILS = {
  1: { id: 1, backdrop_path: '/dune-key.jpg', images: { backdrops: [{ file_path: '/dune-clean.jpg' }], logos: [{ file_path: '/dune-logo.png' }] } },
  2: { id: 2, backdrop_path: '/riot-key.jpg', images: { backdrops: [{ file_path: '/riot-clean.jpg' }], logos: [{ file_path: '/riot-logo.png' }] } },
  3: { id: 3, backdrop_path: '/shogun-key.jpg', images: { backdrops: [], logos: [] } }
};
const IMG = 'https://imagetmdb.com/t/p/';

function heroEnv(opts) {
  opts = opts || {};
  let nowMs = 0;
  const counts = { mo: 0, po: 0, keyAdd: 0, keyRemove: 0 };
  function node(cls, kids) {
    const n = {
      className: cls || '', textContent: '', style: {}, attrs: {}, children: [], parentNode: null, _ev: {},
      classList: {
        contains: (c) => n.className.split(/\s+/).indexOf(c) !== -1
      },
      getAttribute: (k) => (Object.prototype.hasOwnProperty.call(n.attrs, k) ? n.attrs[k] : null),
      querySelector: (sel) => find(n, sel)[0] || null,
      querySelectorAll: (sel) => find(n, sel),
      addEventListener: (t, fn, cap) => { (n._ev[t] = n._ev[t] || []).push({ fn, cap }); },
      removeEventListener: (t, fn, cap) => { n._ev[t] = (n._ev[t] || []).filter((l) => !(l.fn === fn && l.cap === cap)); }
    };
    (kids || []).forEach((k) => { k.parentNode = n; n.children.push(k); });
    return n;
  }
  function find(root, sel) {
    const cls = ('' + sel).replace(/^\./, '');
    const out = [];
    (function walk(x) { x.children.forEach((c) => { if (c.classList.contains(cls)) out.push(c); walk(c); }); })(root);
    return out;
  }
  const title = node('lumen-hero__title');
  const logo = node('lumen-hero__logo');
  const hero = node('lumen-hero', [node('lumen-fx'), node('lumen-hero__text', [logo, title, node('lumen-hero__meta')])]);
  const lqip = node('lumen-hero__lqip');
  const bgA = node('lumen-hero__bg lumen-hero__bg--a');
  const bgB = node('lumen-hero__bg lumen-hero__bg--b');
  const stage = node('lumen-hero-stage', [lqip, bgA, bgB, node('lumen-hero__scrim')]);
  const root = node('activity__body', [stage, hero]);
  const docRoot = node('', [root]);

  /* MutationObserver: колбэк зовётся, только если мутировал узел, который
     зонд наблюдает (или его потомок при subtree), — так тест проверяет, что
     наблюдение стоит на нужных узлах. */
  const observers = [];
  const win = {
    performance: { now: () => nowMs },
    MutationObserver: function (cb) {
      counts.mo++;
      const rec = { cb, targets: [], off: false };
      observers.push(rec);
      this.observe = (t, o) => { rec.targets.push({ t, o }); };
      this.disconnect = () => { rec.off = true; rec.targets = []; };
    },
    addEventListener: (t, fn, cap) => { if (t === 'keydown') { counts.keyAdd++; (win._keys = win._keys || []).push({ fn, cap }); } },
    removeEventListener: (t, fn) => { if (t === 'keydown') { counts.keyRemove++; win._keys = (win._keys || []).filter((l) => l.fn !== fn); } }
  };
  const resource = [];
  if (opts.resource !== false) {
    win.PerformanceObserver = function (cb) {
      counts.po++;
      const rec = { cb, types: [], off: false };
      resource.push(rec);
      this.observe = (init) => { rec.types = init.entryTypes || [init.type]; };
      this.disconnect = () => { rec.off = true; };
    };
    win.PerformanceObserver.supportedEntryTypes = ['resource', 'longtask', 'long-animation-frame'];
  }
  const doc = {
    querySelector: (sel) => find(docRoot, sel)[0] || null,
    querySelectorAll: () => [],
    createElement: () => ({ className: '', textContent: '', style: {}, parentNode: null }),
    body: {
      children: [],
      appendChild: (n) => { n.parentNode = doc.body; doc.body.children.push(n); },
      removeChild: (n) => { doc.body.children.splice(doc.body.children.indexOf(n), 1); n.parentNode = null; }
    }
  };
  globalThis.window = win;
  globalThis.document = doc;

  const heroState = { details: null };
  const pf = { hits: 0 };
  const LC = {
    hero: { details: (id) => (heroState.details && heroState.details.id === id ? heroState.details : null), heroTitle: HERO_TITLE },
    prefetch: opts.prefetch === false ? undefined : { stats: () => ({ fly: 0, queue: 0, hits: pf.hits }) }
  };
  new Function('LC', 'module', UTIL_SRC)(LC, { exports: null, lumen: true });
  const fm = { exports: null, lumen: true };
  new Function('LC', 'module', FOCUS_SRC)(LC, fm);
  LC.focus = fm.exports;
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);

  function within(anc, n) { for (let x = n; x; x = x.parentNode) if (x === anc) return true; return false; }
  function mutate(n) {
    observers.forEach((r) => {
      if (r.off) return;
      if (r.targets.some((x) => x.t === n || (x.o.subtree && within(x.t, n)))) r.cb([]);
    });
  }
  function setClass(n, cls) { n.className = cls; mutate(n); }
  function card(data) { const c = node('card selector'); c.card_data = data; root.children.push(c); c.parentNode = root; return c; }

  /* Герой показывает Мятеж: его название, его кадр в слое --a. */
  title.textContent = RIOT.title;
  bgA.className = 'lumen-hero__bg lumen-hero__bg--a is-active';
  bgA.attrs.src = IMG + 'w1280' + '/riot-clean.jpg';
  heroState.details = DETAILS[2];

  return {
    api: module.exports, LC, counts, observers, resource, root, hero, title, logo, bgA, bgB, lqip, heroState, pf,
    at: (ms) => { nowMs = ms; },
    focus: (data, type) => {
      const c = card(data);
      const ev = { type: type || 'hover:focus', target: c };
      /* Захват на корне — как у настоящего события Lampa (оно не всплывает). */
      (root._ev[ev.type] || []).filter((l) => l.cap).forEach((l) => l.fn(ev));
    },
    showTitle: (text) => { title.textContent = text; mutate(title); },
    showLogo: (path) => { logo.style.backgroundImage = 'url("' + IMG + 'w780' + path + '")'; mutate(logo); hero.className = 'lumen-hero lumen-hero--logo'; mutate(hero); },
    hideLogo: () => { logo.style.backgroundImage = 'none'; mutate(logo); hero.className = 'lumen-hero'; mutate(hero); },
    frame: (layer, path, size) => { layer.attrs.src = IMG + (size || 'w1280') + path; mutate(layer); setClass(layer, layer.className.replace(/\s*is-active/g, '') + ' is-active'); },
    off: (layer) => setClass(layer, layer.className.replace(/\s*is-active/g, '')),
    press: (keyCode, ts) => (win._keys || []).forEach((l) => l.fn({ keyCode, timeStamp: ts })),
    entries: (list) => resource.forEach((r) => { if (!r.off && r.types.indexOf('resource') !== -1) r.cb({ getEntries: () => list }); }),
    rootListeners: () => Object.keys(root._ev).reduce((a, k) => a + root._ev[k].length, 0)
  };
}

test('телеметрия: heroStats — p50/p95 по ближайшему рангу, кадр только дождавшихся, серый, pf h/m', () => {
  const { api } = fresh();
  const shows = [
    { title: 900, frame: 1600, gray: false, hit: true },
    { title: 530, frame: -1, gray: true, hit: false },
    { title: 1480, frame: 2400, gray: true, hit: true },
    { title: 880, frame: 1200, gray: false, hit: null }
  ];
  const s = api.heroStats(shows, 3);
  assert.deepEqual(s.title, [880, 1480], 'p50 — второе из четырёх, p95 — четвёртое');
  assert.deepEqual(s.frame, [1600, 2400], 'показ без кадра (-1) в T_frame не идёт');
  assert.equal(s.frameN, 3);
  assert.equal(s.gray, 2);
  assert.deepEqual([s.pf, s.hit, s.miss], [true, 2, 1], 'null — предзагрузки не было: ни попадание, ни промах');
  assert.equal(s.net, 3);
  assert.equal(api.heroText(s), 'hero 4: T_title 880/1480 · T_frame 1600/2400 (3) · gray 2 · pf h/m 2/1 · net-in-burst 3');
  /* Без предзагрузки и без resource. */
  const none = api.heroStats([{ title: 700, frame: -1, gray: false, hit: null }], null);
  assert.equal(api.heroText(none), 'hero 1: T_title 700/700 · T_frame -/- (0) · gray 0 · net-in-burst n/a',
    'поле pf не пишется, когда предзагрузка не дала ни одного ответа');
  assert.equal(api.heroText(api.heroStats([], 0)), 'hero 0: T_title -/- · T_frame -/- (0) · gray 0 · net-in-burst 0');
});

test('телеметрия: T_title — текст названия этой карточки, T_frame — слой is-active с кадром ЭТОГО фильма, чужой кадр не считается', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: true });
  e.at(1000);
  e.focus(DUNE);
  /* Кадр ПРОШЛОГО фильма доехал после фокуса (загрузчик прошлого показа) —
     это не кадр Дюны. */
  e.at(1200);
  e.frame(e.bgB, '/riot-key.jpg');
  e.off(e.bgA);
  /* Название ещё не то. */
  e.at(1300);
  e.showTitle('Мятеж');
  assert.equal(p.summary().n, 0, 'чужое название — не показ');
  e.at(1530);
  e.showTitle('Дюна');
  let s = p.summary();
  assert.equal(s.n, 1);
  assert.deepEqual(s.title, [530, 530]);
  assert.equal(s.frame, null, 'кадра Дюны ещё нет');
  /* Детали пришли, кадр — чистый из деталей (не ключевой арт). */
  e.heroState.details = DETAILS[1];
  e.at(2600);
  e.frame(e.bgA, '/dune-clean.jpg');
  s = p.summary();
  assert.deepEqual(s.frame, [1600, 1600]);
  assert.equal(s.frameN, 1);
  assert.equal(s.gray, 0, 'под названием всё время был какой-то кадр');
  p.stop();
});

test('телеметрия: gray — погасли оба слоя кадра и подложка после вывода названия; подложка LQIP — не серый, но и не кадр', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(DUNE);
  e.at(500);
  e.showTitle('Дюна');
  /* Подложка этого фильма: слой кадра погас, LQIP горит, и её байты
     доехали (этап 2в, п.3) — не серый. */
  e.at(700);
  e.lqip.attrs.src = IMG + 'w300/dune-key.jpg';
  e.lqip.complete = true;
  e.lqip.naturalWidth = 300;
  e.lqip.className = 'lumen-hero__lqip is-active';
  e.off(e.bgA);
  assert.equal(p.summary().gray, 0);
  assert.equal(p.summary().frame, null, 'подложка — не кадр');
  /* Заглушка: погасла и подложка. */
  e.at(900);
  e.off(e.lqip);
  assert.equal(p.summary().gray, 1);
  e.at(1800);
  e.frame(e.bgA, '/dune-key.jpg');
  assert.deepEqual(p.summary().frame, [1800, 1800], 'ключевой арт из карточки — тоже кадр этого фильма');
  p.stop();
});

/* Этап 2в, п.3 (стенд этапа 2а: HUD — gray 0 из 10 серий, глазами — 10 из
   10). Герой ставит подложку на слой сразу, даже если её байты ещё едут
   (holdFrame → ownLqip), — класс горит, а глазами под текстом нейтральный
   фон. Такой миг — серый; байты, доехавшие потом, серый не отменяют. */
test('этап 2в, п.3: gray — подложка горит, но её байты ещё едут (complete/naturalWidth) — серый; доехали позже — серый остаётся', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(DUNE);
  e.at(500);
  e.showTitle('Дюна');
  e.at(750);
  e.lqip.attrs.src = IMG + 'w300/dune-clean.jpg';
  e.lqip.complete = false;
  e.lqip.naturalWidth = 0;
  e.lqip.className = 'lumen-hero__lqip is-active';
  e.off(e.bgA);
  assert.equal(p.summary().gray, 1, 'подложка без байтов — глазами нейтральный фон');
  /* Байты доехали, слой тот же — серый уже был. */
  e.lqip.complete = true;
  e.lqip.naturalWidth = 300;
  e.at(900);
  e.frame(e.bgB, '/dune-key.jpg');
  assert.equal(p.summary().gray, 1);
  assert.deepEqual(p.summary().frame, [900, 900]);
  /* Битая подложка (complete, но naturalWidth 0) — тоже не картинка. */
  const f = heroEnv();
  const q = f.api.probe({ keys: false });
  f.at(0);
  f.focus(DUNE);
  f.at(400);
  f.showTitle('Дюна');
  f.lqip.attrs.src = IMG + 'w300/dune-clean.jpg';
  f.lqip.complete = true;
  f.lqip.naturalWidth = 0;
  f.lqip.className = 'lumen-hero__lqip is-active';
  f.at(600);
  f.off(f.bgA);
  assert.equal(q.summary().gray, 1, 'битая подложка — серый');
  p.stop();
  q.stop();
});

test('телеметрия: логотип — считается только логотип ЭТОГО фильма (путь из его деталей), поздний логотип прошлого — нет', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(DUNE);
  /* Логотип Мятежа доехал уже после фокуса на Дюну: детали у героя — Мятежа. */
  e.at(150);
  e.showLogo('/riot-logo.png');
  assert.equal(p.summary().n, 0, 'логотип прошлого фильма — не название Дюны');
  e.hideLogo();
  e.showTitle('');
  e.heroState.details = DETAILS[1];
  e.at(820);
  e.showLogo('/dune-logo.png');
  assert.deepEqual(p.summary().title, [820, 820]);
  p.stop();
});

test('телеметрия: показ — только фокус, дождавшийся названия; повторное событие на той же карточке отсчёт не сбрасывает; вернулись раньше смены героя — не показ', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  /* Серия: Дюна, Сёгун — фокус ушёл раньше названия. */
  e.at(0);
  e.focus(DUNE);
  e.at(100);
  e.focus(THIRD);
  e.at(200);
  e.focus(DUNE);
  /* Lampa вернула фокус на ту же карточку (мышиное событие) — отсчёт от 200. */
  e.at(400);
  e.focus(DUNE, 'hover:hover');
  e.at(900);
  e.showTitle('Дюна');
  assert.deepEqual(p.summary().title, [700, 700], 'от ПОСЛЕДНЕГО перевода фокуса на карточку: 900 − 200');
  assert.equal(p.summary().n, 1, 'Сёгун названия не дождался — не показ');
  /* Ушли на Мятеж и вернулись, пока герой всё ещё показывает Дюну. */
  e.at(1000);
  e.focus(RIOT);
  e.at(1100);
  e.focus(DUNE);
  e.at(1500);
  e.showTitle('Дюна');
  assert.equal(p.summary().n, 1, 'герой не сменялся — ждать было нечего');
  /* Название у сериала — name. */
  e.at(2000);
  e.focus(THIRD);
  e.at(2700);
  e.showTitle('Сёгун');
  assert.equal(p.summary().n, 2);
  p.stop();
});

test('телеметрия: pf h/m — вырос ли счётчик hits предзагрузки между фокусом и названием; без модуля поля нет', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(DUNE);
  e.pf.hits = 5;
  e.at(500);
  e.showTitle('Дюна');
  e.at(1000);
  e.focus(RIOT);
  e.at(1600);
  e.showTitle('Мятеж');
  const s = p.summary();
  assert.deepEqual([s.hit, s.miss], [1, 1]);
  assert.ok(e.api.heroText(s).indexOf(' · pf h/m 1/1 · ') !== -1, e.api.heroText(s));
  p.stop();

  const bare = heroEnv({ prefetch: false });
  const q = bare.api.probe({ keys: false });
  bare.at(0);
  bare.focus(DUNE);
  bare.at(500);
  bare.showTitle('Дюна');
  assert.equal(bare.api.heroText(q.summary()).indexOf('pf'), -1, 'нет LC.prefetch — поле не выдумывается');
  q.stop();
});

test('телеметрия: net-in-burst — старты записей resource в [нажатие серии, +120 мс]; первое нажатие, скрипты и опоздавшие не считаются', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: true });
  e.at(4000);
  e.press(39, 1000);             /* первое — одиночное, не серия */
  e.press(39, 1400);             /* серия: прошлое 400 мс назад */
  e.press(13, 1500);             /* OK — не стрелка */
  e.press(39, 3000);             /* пауза 1600 мс — снова одиночное */
  e.entries([
    { startTime: 1050, initiatorType: 'img' },          /* под первым нажатием */
    { startTime: 1400, initiatorType: 'img' },          /* ровно в нажатие серии */
    { startTime: 1450, initiatorType: 'xmlhttprequest' },
    { startTime: 1480, initiatorType: 'script' },       /* не картинка и не API */
    { startTime: 1520, initiatorType: 'css' },          /* граница включительно */
    { startTime: 1521, initiatorType: 'img' },          /* уже после окна */
    { startTime: 1510, initiatorType: 'img' },          /* под OK — окно стрелки ещё идёт */
    { startTime: 3050, initiatorType: 'img' }
  ]);
  assert.equal(p.summary().net, 4, '1400, 1450, 1510, 1520');
  /* Самотест даёт нажатия сам. */
  const b = heroEnv();
  const q = b.api.probe({ keys: false });
  assert.equal(b.counts.keyAdd, 0, 'без opts.keys слушателя клавиш нет');
  q.key(100);
  q.key(500);
  b.entries([{ startTime: 560, initiatorType: 'img' }, { startTime: 130, initiatorType: 'img' }]);
  assert.equal(q.summary().net, 1);
  /* resource не поддержан — n/a, а не ноль. */
  const n = heroEnv({ resource: false });
  const r = n.api.probe({ keys: true });
  assert.equal(r.summary().net, null);
  assert.ok(n.api.heroText(r.summary()).indexOf('net-in-burst n/a') !== -1);
  p.stop(); q.stop(); r.stop();
});

test('телеметрия: окно — последние 20 показов; сеть считается с фокуса показа, вытесненного последним', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: true });
  let t = 0;
  for (let i = 0; i < 25; i++) {
    const film = i % 2 ? RIOT : DUNE;
    t += 5000;
    e.at(t);
    e.press(39, t - 300);
    e.press(39, t);
    e.focus(film);
    e.entries([{ startTime: t + 10, initiatorType: 'img' }]);
    e.at(t + 100 + i);
    e.showTitle(film.title);
  }
  const s = p.summary();
  assert.equal(s.n, 20);
  assert.deepEqual(s.title, [114, 123], 'в окне показы 5–24: 105…124 мс, p50 — десятое, p95 — девятнадцатое');
  assert.equal(s.net, 20, 'по запросу на показ окна; вытесненные ушли вместе со своими запросами');
  p.stop();
});

test('телеметрия: stop() снимает всё — наблюдатель, слушатели фокуса и клавиш, resource; после него зонд глух', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: true });
  assert.equal(e.rootListeners(), 2, 'захват на корне — оба события фокуса (LC.focus)');
  assert.equal(e.counts.keyAdd, 1);
  const mo = e.observers[0];
  assert.ok(mo.targets.some((x) => x.t === e.title && x.o.subtree && x.o.childList && x.o.characterData), 'название');
  assert.ok(mo.targets.some((x) => x.t === e.hero && x.o.attributeFilter.indexOf('class') !== -1), 'класс lumen-hero--logo');
  assert.ok(mo.targets.some((x) => x.t === e.logo && x.o.attributeFilter.indexOf('style') !== -1), 'картинка логотипа');
  for (const layer of [e.bgA, e.bgB, e.lqip]) {
    assert.ok(mo.targets.some((x) => x.t === layer && x.o.attributeFilter.indexOf('class') !== -1 && x.o.attributeFilter.indexOf('src') !== -1));
  }
  p.stop();
  assert.equal(e.rootListeners(), 0);
  assert.equal(e.counts.keyRemove, 1);
  assert.equal(mo.off, true);
  assert.equal(e.resource[0].off, true);
  e.at(0);
  e.focus(DUNE);
  e.at(500);
  e.showTitle('Дюна');
  assert.equal(p.summary().n, 0);
});

/* Ревью этапа 1: у фильма без перевода (movie/1556321, тайское название)
   герой пишет читаемый вариант — оригинальное латиницей или альтернативное
   из деталей; такие показы раньше в T_title не попадали вовсе. */
test('телеметрия: название чужим письмом — показ засчитывается по тому, что пишет герой (heroTitle), а не по card.title', () => {
  const THAI = { id: 7, title: 'ธี่หยด: สมิงเขาขวาง', original_title: 'ธี่หยด: สมิงเขาขวาง', backdrop_path: '/thai-key.jpg' };
  const THAI_D = { id: 7, backdrop_path: '/thai-key.jpg', images: { backdrops: [], logos: [] },
    alternative_titles: { titles: [{ iso_3166_1: 'TH', title: 'Saming Kao Kwang' }, { iso_3166_1: 'US', title: 'Saming the Werebeast' }] } };
  const LATIN = { id: 8, title: 'ปอบ', original_title: 'Pob' };
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(THAI);
  /* Детали пришли, герой пишет альтернативное название США. */
  e.heroState.details = THAI_D;
  e.at(640);
  e.showTitle('Saming the Werebeast');
  assert.deepEqual(p.summary().title, [640, 640]);
  /* Деталей ещё нет — оригинальное латиницей. */
  e.at(1000);
  e.focus(LATIN);
  e.at(1300);
  e.showTitle('Pob');
  assert.equal(p.summary().n, 2);
  assert.deepEqual(p.summary().title, [300, 640]);
  p.stop();
});

/* Этап 2в, п.3: читаемое название из деталей герой пишет и в данные
   карточки (card.lumen_title, d4d9d42). Детали зонду отдаёт
   LC.hero.details(id) строгим сравнением id — у карточки, чей id пришёл
   строкой, их для зонда нет, и без lumen_title показ в T_title не попадал. */
test('этап 2в, п.3: название — ещё и card.lumen_title: id строкой, деталей у зонда нет, герой пишет читаемое — показ засчитан', () => {
  const THAI = { id: '9', title: 'ธี่หยด: สมิงเขาขวาง', original_title: 'ธี่หยด: สมิงเขาขวาง', backdrop_path: '/thai9-key.jpg' };
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  e.at(0);
  e.focus(THAI);
  e.heroState.details = { id: 9, backdrop_path: '/thai9-key.jpg', images: { backdrops: [], logos: [] },
    alternative_titles: { titles: [{ iso_3166_1: 'US', title: 'Saming the Werebeast' }] } };
  THAI.lumen_title = 'Saming the Werebeast';
  e.at(700);
  e.showTitle('Saming the Werebeast');
  assert.equal(p.summary().n, 1, 'читаемое название из card.lumen_title не засчитано');
  assert.deepEqual(p.summary().title, [700, 700]);
  /* Чужое название (не то и не другое) — не показ. */
  e.at(1000);
  e.focus({ id: '10', title: 'ปอบ', lumen_title: 'Pob' });
  e.at(1200);
  e.showTitle('Saming the Werebeast');
  assert.equal(p.summary().n, 1, 'чужое название засчитано');
  p.stop();
});

test('телеметрия: главная смонтировалась заново — sync() переподписывается на нового героя', () => {
  const e = heroEnv();
  const p = e.api.probe({ keys: false });
  const old = e.observers[0];
  /* Прежний корень выброшен: героя в документе нет. */
  const docRoot = e.root.parentNode;
  docRoot.children.splice(docRoot.children.indexOf(e.root), 1);
  p.sync();
  assert.equal(old.off, true, 'наблюдатель старого героя снят');
  assert.equal(e.rootListeners(), 0, 'слушатель фокуса старого корня снят');
  docRoot.children.push(e.root);
  p.sync();
  assert.equal(e.rootListeners(), 2);
  assert.equal(e.observers.filter((r) => !r.off).length, 1);
  p.stop();
});

test('телеметрия в HUD: вторая строка — строка героя; выключенный HUD не ставит ни слушателя, ни наблюдателя', () => {
  const off = heroEnv();
  off.LC.pref = (k, d) => (k === 'lumen_debug_hud' ? false : d);
  off.LC.enabled = () => true;
  off.LC.motionMode = () => 'lite';
  window.requestAnimationFrame = () => 1;
  window.cancelAnimationFrame = () => {};
  off.api.sync();
  assert.deepEqual([off.counts.mo, off.counts.po, off.counts.keyAdd, off.rootListeners()], [0, 0, 0, 0],
    'выключенный HUD: ноль наблюдателей и слушателей');

  const e = heroEnv();
  const frames = [];
  window.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  window.cancelAnimationFrame = () => {};
  e.LC.pref = (k, d) => (k === 'lumen_debug_hud' ? true : d);
  e.LC.enabled = () => true;
  e.LC.motionMode = () => 'lite';
  e.api.sync();
  const nodeHud = document.body.children[0];
  assert.equal(nodeHud.style.whiteSpace, 'pre-line', 'перевод строки не сливается в пробел');
  assert.equal(e.counts.keyAdd, 1);
  assert.equal(e.rootListeners(), 2);
  e.at(0);
  e.focus(DUNE);
  e.at(640);
  e.showTitle('Дюна');
  frames.shift()(100);
  frames.shift()(1200);
  const lines = nodeHud.textContent.split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], 'hero 1: T_title 640/640 · T_frame -/- (0) · gray 0 · pf h/m 0/1 · net-in-burst 0');
  e.LC.pref = () => false;
  e.api.sync();
  assert.deepEqual([e.rootListeners(), e.counts.keyRemove], [0, 1], 'выключение HUD снимает зонд');
});

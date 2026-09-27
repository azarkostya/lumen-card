import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load } from './_load.mjs';

/* Волна производительности (жалоба с ТВ «всё ещё лагает всё», 2026-09-24):
   самодиагностика «Отладка: тест производительности» (src/69_bench.js).

   Консоли на телевизоре нет, и каждая серия фото HUD читалась гаданием:
   какой режим, что в этот момент делал экран. Тест сам гоняет главную по
   восьми стадиям — покой и листание в lite и в «Полном», по одному
   тяжёлому эффекту за раз — и рисует одну таблицу, которую можно
   сфотографировать целиком.

   Здесь — чистая часть (статистика, строки таблицы и их ширина) и рантайм
   в заглушках: подмены настроек только в памяти, Storage не трогается, и
   любой путь выхода — конец, клавиша, фон, смена активности, смена
   контроллера, ошибка — проходит одну и ту же уборку. */

const SRC = readFileSync(new URL('../src/69_bench.js', import.meta.url), 'utf8');
globalThis.warn = function () { };
/* Пресеты движка частиц — сверка, что стадия «+fx» меряет существующую
   сцену (src/52_fx.js). */
const FX_PRESETS = load('52_fx.js').presets;
/* Полоса телеметрии: строку героя стадии «stop scroll» таблица берёт у
   HUD (LC.hud.heroText) — формат один на HUD и самотест. */
const HUD = load('69_hud.js');

function fresh(LC) {
  LC = LC || {};
  const module = { exports: null, lumen: true };
  new Function('LC', 'module', SRC)(LC, module);
  return { api: module.exports, LC };
}

/* ====================================================================== */
/* Чистая часть                                                           */
/* ====================================================================== */

test('bench: summarize — fps, p50/p95, пропуски «−1» (>1,5·P) и «−2+» (>2,5·P), lat95', () => {
  const { api } = fresh();
  /* P = 16.7: граница «−1» — 25.05, «−2+» — 41.75. */
  const deltas = [16.7, 16.7, 16.6, 16.8, 16.7, 25, 26, 33.4, 41.7, 42, 100];
  const s = api.summarize(deltas, [0.5, 1, 4, 2], 16.7);
  assert.equal(s.frames, 11);
  assert.equal(s.miss1, 3, '26, 33.4 и 41.7; 25 — ещё вовремя (≤ 25.05): ' + JSON.stringify(s));
  assert.equal(s.miss2, 2, '42 и 100');
  const sum = deltas.reduce((a, b) => a + b, 0);
  assert.equal(s.fps, Math.round(11 * 1000 / sum * 10) / 10);
  assert.equal(s.p50, 25, 'медиана одиннадцати — шестое по порядку');
  assert.equal(s.p95, 100);
  assert.equal(s.lat95, 4);
  assert.deepEqual(api.summarize([], [], 16.7), { frames: 0, fps: 0, p50: 0, p95: 0, miss1: 0, miss2: 0, lat95: null });
});

test('bench: period — медиана дельт', () => {
  const { api } = fresh();
  assert.equal(api.period([16.6, 33.4, 16.7, 16.8, 16.7]), 16.7);
  assert.equal(api.period([]), 0);
});

test('bench: стадии — девять, в порядке ТЗ; тяжёлые эффекты только в «Полном»', () => {
  const { api } = fresh();
  assert.deepEqual(api.STAGES.map((s) => s.id), ['lite idle', 'full idle', '+fx', '+frames', '+tint', 'lite scroll', 'full scroll', 'all', 'stop scroll']);
  for (const s of api.STAGES) {
    if (s.heavy || s.fx || s.flip || s.tint) assert.equal(s.motion, 'full', s.id);
  }
  const all = api.STAGES[7];
  assert.ok(all.fx && all.flip && all.tint && all.scroll && all.heavy, 'восьмая — всё сразу');
  /* Подмены: трейлер выключен на всех стадиях, режим и тумблер — по стадии. */
  const o = api.overridesFor(api.STAGES[2]);
  assert.equal(o.lumen_motion, 'full');
  assert.equal(o.lumen_fx_heavy, true);
  assert.equal(o.lumen_trailer, 'off');
  assert.equal(o.lumen_hero_media, 'frames');
  assert.equal(api.overridesFor(api.STAGES[0]).lumen_fx_heavy, false);
  /* Полоса телеметрии: девятая — листание с остановками в «Лёгких», без
     тяжёлых эффектов; замер — вся последовательность 4 × (4 × 400 + 3000). */
  const stops = api.STAGES[8];
  assert.equal(stops.stops, true);
  assert.equal(stops.motion, 'lite');
  assert.ok(!stops.heavy && !stops.fx && !stops.flip && !stops.tint && !stops.scroll, JSON.stringify(stops));
  assert.equal(stops.ms, 18400);
});

/* Самый широкий случай: все девять строк с большими числами, долгий кадр с
   длинным адресом скрипта, строка героя с пятизначными мс, прерывание.
   Экран — 960 CSS px, моноширинный шрифт FONT_PX, символ — CHAR_EM его
   кегля, поля PAD_PX с обеих сторон. */
const WIDE_HERO = { n: 20, title: [12345, 12345], frame: [12345, 12345], frameN: 20, gray: 20, pf: true, hit: 20, miss: 20, net: 999 };

function wideResult(api) {
  /* Полоса gc3: сборок за замер — не больше одной на тик датчика (18,4 с
     / 0,5 с ≈ 37), совпавших кадров — не больше сборок. */
  const rows = api.STAGES.map((s, i) => Object.assign({
    n: i + 1, id: s.id, partial: i === 7, frames: 300, fps: 59.9, p50: 16.7, p95: 1234.5, miss1: 1234, miss2: 999,
    loafN: 123, loafMs: 98765, worst: { ms: 4321, host: 'very-long-cdn-hostname.example.com setTimeout handler with a long name' },
    lat95: 123.4, anim: 1234, fxMs: 12.34, gc: { n: 37, hit: 37, t: [] },
    top: { ms: 12345.6, block: 9876.5, js: 1234.4, rev: 2345.6, sl: 3456.7, forced: 456.7, other: 12345.6, gc: true,
      script: 'very-long-cdn-hostname.example.com someVeryLongFunctionName@1234567 DIV.onwebkitTransitionEnd' }
  }, s.stops ? { hero: WIDE_HERO } : {}));
  return {
    version: '0.2.0', cr: '153', hw: '4c/n/a', w: 960, h: 540, dpr: 2, P: 16.7, time: '21:05',
    reason: 'key', stoppedAt: 8, rows
  };
}

test('bench: таблица — каждая строка не шире экрана 960 CSS px', () => {
  const { api } = fresh({ lang: (k) => k, hud: HUD });
  assert.ok(api.MAX_COLS * api.FONT_PX * api.CHAR_EM + 2 * api.PAD_PX <= 960, 'геометрия экрана таблицы');
  const lines = api.table(wideResult(api));
  assert.ok(lines.length >= 12, 'шапка, заголовок, восемь строк, подвал: ' + lines.length);
  for (const line of lines) {
    assert.ok(line.length <= api.MAX_COLS, 'строка ' + line.length + ' > ' + api.MAX_COLS + ': «' + line + '»');
  }
});

test('bench: таблица — шапка cr · hw · 960×540@2 · P · время · версия, строки стадий, худший LoAF и прерывание', () => {
  const { api } = fresh({ lang: (k) => ({ lumen_bench_back: 'Назад — закрыть', lumen_bench_stopped: 'прервано' })[k] || k, hud: HUD });
  const r = wideResult(api);
  const lines = api.table(r);
  assert.equal(lines[0], 'cr 153 · hw 4c/n/a · 960×540@2 · P 16.7 · 21:05 · v0.2.0');
  const text = lines.join('\n');
  for (const s of api.STAGES) assert.ok(text.indexOf(s.id) !== -1, 'нет стадии ' + s.id);
  assert.ok(/all\*/.test(text), 'недомеренная стадия помечена звёздочкой');
  assert.ok(text.indexOf('very-long-cdn-hostname') !== -1, 'хост скрипта худшего долгого кадра');
  assert.ok(text.indexOf('прервано') !== -1, 'причина прерывания');
  /* Раунд «Листание»: вторая таблица съела строки экрана — причина
     прерывания и «Назад» делят одну строку. */
  assert.equal(lines[lines.length - 1], 'прервано: key · 8/9 · Назад — закрыть');
  const done = api.table(Object.assign({}, r, { reason: 'done' }));
  assert.equal(done[done.length - 1], 'Назад — закрыть');
  /* Без LoAF — «n/a», а не ноль. */
  const none = api.table(Object.assign({}, r, { reason: 'done', rows: [Object.assign({}, r.rows[0], { loafN: null, worst: null, lat95: null, fxMs: null, anim: -1 })] }));
  assert.ok(/\bn\/a\b/.test(none.join('\n')), none.join('\n'));
});

/* Раунд «Листание», п.5 исследования: «n/a» в подвале (у худшего кадра нет
   скрипта дольше 5 мс) не говорил, ЧЕМ занят кадр. Самый длинный кадр
   стадии (по duration) раскладывается по фазам LoAF:
     js    — скрипты задачи (начались до renderStart);
     r+ev  — renderStart → styleAndLayoutStart: колбэки rAF и события
             анимаций (сюда попадает transitionend Lampa);
     st+l  — styleAndLayoutStart → конец кадра: стиль, раскладка, отрисовка;
     frc   — из них принудительные (forcedStyleAndLayoutDuration скриптов);
     other — остаток задачи без скриптов: GC, декодирование, натив;
     script — самый долгий скрипт кадра: хост, функция@символ, вызвавший. */
test('bench: partsOf — фазы долгого кадра: js, r+ev, st+l, frc, other и главный скрипт', () => {
  const { api } = fresh();
  const p = api.partsOf({
    startTime: 1000, duration: 120, blockingDuration: 70, renderStart: 1060, styleAndLayoutStart: 1090,
    scripts: [
      { startTime: 1005, duration: 40, forcedStyleAndLayoutDuration: 6, sourceURL: 'https://cdn.example.org/app.min.js',
        sourceFunctionName: 'move', sourceCharPosition: 46253, invoker: 'TimerHandler:setTimeout' },
      { startTime: 1065, duration: 20, forcedStyleAndLayoutDuration: 3, sourceURL: '',
        sourceFunctionName: 'frameVisible', sourceCharPosition: 32024, invoker: 'DIV.onwebkitTransitionEnd' }
    ]
  });
  assert.equal(p.ms, 120);
  assert.equal(p.block, 70);
  assert.equal(p.js, 40, 'скрипты задачи — только те, что до renderStart');
  assert.equal(p.rev, 30, 'rAF и события анимаций — от renderStart до styleAndLayoutStart');
  assert.equal(p.sl, 30, 'стиль, раскладка, отрисовка — от styleAndLayoutStart до конца кадра');
  assert.equal(p.forced, 9, 'принудительные стиль и раскладка — по всем скриптам');
  assert.equal(p.other, 20, 'задача (60 мс) без её скриптов (40)');
  assert.equal(p.script, 'cdn.example.org move@46253 TimerHandler:setTimeout');
  /* Кадр без отрисовки (renderStart 0): весь — задача; без скриптов — всё
     в other, скрипта нет. */
  const bare = api.partsOf({ startTime: 0, duration: 80, blockingDuration: 30, renderStart: 0, styleAndLayoutStart: 0, scripts: [] });
  assert.deepEqual([bare.js, bare.rev, bare.sl, bare.forced, bare.other, bare.script], [0, 0, 0, 0, 80, '']);
  const inline = api.partsOf({ startTime: 0, duration: 60, renderStart: 50, styleAndLayoutStart: 55,
    scripts: [{ startTime: 1, duration: 30, sourceURL: '', sourceFunctionName: '', sourceCharPosition: -1, invoker: '' }] });
  assert.equal(inline.script, 'inline @', 'скрипт без адреса — inline, без функции и позиции');
});

/* SEC4-1: Chromium кладёт в invoker LoAF полный адрес — у обработчика
   картинки без id IMG[src="<адрес с запросом>"].onload, у classic-script
   адрес скрипта с запросом; Lampa дописывает к картинкам ?email=<почта
   CUB>, к скриптам плагинов — email=<base64>. Таблицу фотографируют и
   присылают: на экран и в JSON — без запроса и без логина-пароля. */
const MAIL_IMG = 'IMG[src="https://imagetmdb.com/t/p/w300/8rpDcsfLJypbO6vREc0547VKqEv.jpg?email=user.name%40gmail.com"].onload';
const MAIL_JS = 'https://bwa.to/rc/online.js?email=dXNlci5uYW1lQGdtYWlsLmNvbQ%3D%3D&logged=true';
function mailFrame(script) {
  return { startTime: 1000, duration: 180, blockingDuration: 130, renderStart: 1170, styleAndLayoutStart: 1172, scripts: [script] };
}
function noMail(text) {
  return text.indexOf('email') === -1 && text.indexOf('user.name') === -1 && text.indexOf('dXNlci5uYW1l') === -1 &&
    text.indexOf('logged') === -1 && text.indexOf('secret') === -1 && text.indexOf('?') === -1;
}

test('bench: partsOf — почта из запроса и логин-пароль из адреса не попадают в строку скрипта (SEC4-1)', () => {
  const { api } = fresh();
  const img = api.partsOf(mailFrame({ startTime: 1001, duration: 120, sourceURL: 'https://azarkostya.github.io/lumen-card/lumen_card.js?email=dXNlci5uYW1lQGdtYWlsLmNvbQ%3D%3D',
    sourceFunctionName: '', sourceCharPosition: 283456, invoker: MAIL_IMG, invokerType: 'event-listener' }));
  assert.ok(noMail(img.script), img.script);
  assert.equal(img.script, 'azarkostya.github.io @283456 IMG[src="https://imagetmdb.com/t/p/w300/8rpDcsfLJypbO6vREc0547VKqEv.jpg"].onload',
    'адрес картинки остаётся, отрезан только запрос');
  const js = api.partsOf(mailFrame({ startTime: 1001, duration: 120, sourceURL: MAIL_JS, sourceFunctionName: '', sourceCharPosition: 0,
    invoker: MAIL_JS, invokerType: 'classic-script' }));
  assert.ok(noMail(js.script), js.script);
  assert.equal(js.script, 'bwa.to @0 https://bwa.to/rc/online.js');
  const creds = api.partsOf(mailFrame({ startTime: 1001, duration: 120, sourceURL: 'https://user:secret@proxy.example.org/app.js',
    sourceFunctionName: 'f', sourceCharPosition: 7, invoker: 'IMG[src="http://user:secret@proxy.example.org/p.jpg"].onload' }));
  assert.ok(noMail(creds.script), creds.script);
  assert.equal(creds.script, 'proxy.example.org f@7 IMG[src="http://proxy.example.org/p.jpg"].onload');
  /* Селектор с id и прочие invoker без адреса — как были. */
  const plain = api.partsOf(mailFrame({ startTime: 1001, duration: 120, sourceURL: '', sourceFunctionName: 'frameVisible',
    sourceCharPosition: 1, invoker: 'DIV#main.onwebkitTransitionEnd' }));
  assert.equal(plain.script, 'inline frameVisible@1 DIV#main.onwebkitTransitionEnd');
});

test('bench: подвал «loaf max» и JSON — без почты из invoker (SEC4-1)', () => {
  const e = makeEnv({ loaf: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(1500);
  e.loaf([
    { startTime: 1e9, duration: 120, blockingDuration: 70, scripts: [{ duration: 60, sourceURL: 'https://u:secret@cdn.example.org/a.js?email=x',
      invoker: 'IMG[src="//i.co/a.jpg?email=u%40g"].onload' }] },
    { startTime: 1e9 + 200, duration: 300, blockingDuration: 10, scripts: [{ startTime: 1e9 + 201, duration: 90, sourceURL: MAIL_JS,
      sourceFunctionName: '', sourceCharPosition: 0, invoker: MAIL_JS }] }
  ]);
  e.advance(RUN);
  const row = e.api.last().rows[0];
  assert.ok(row.worst && noMail(row.worst.host), JSON.stringify(row.worst));
  assert.equal(row.worst.host, 'cdn.example.org IMG[src="//i.co/a.jpg"].onload', 'первая таблица — 48 символов, почта влезла бы');
  assert.ok(noMail(row.top.script), row.top.script);
  assert.ok(noMail(JSON.stringify(e.api.last())), 'JSON результата');
  assert.ok(e.api.table(e.api.last()).every(noMail), 'строки обеих таблиц');
});

test('bench: вторая таблица — самый длинный кадр каждой стадии по фазам; обе таблицы — на одном экране 960×540', () => {
  const { api } = fresh({ lang: (k) => ({ lumen_bench_back: 'Назад — закрыть', lumen_bench_stopped: 'прервано' })[k] || k, hud: HUD });
  const lines = api.table(wideResult(api));
  /* Экран: кегль FONT_PX, межстрочный LINE_EM, поля PAD_PX — 25 строк на
     540 CSS px (телевизор 960×540@2); полоса телеметрии: девятая стадия и
     строка героя, межстрочный 1.3. */
  assert.equal(api.MAX_LINES, Math.floor((540 - 2 * api.PAD_PX) / (api.FONT_PX * api.LINE_EM)));
  assert.equal(api.MAX_LINES, 25);
  assert.equal(lines.length, 25, 'самый длинный случай занимает экран целиком:\n' + lines.join('\n'));
  assert.ok(lines.length <= api.MAX_LINES, 'таблица длиннее экрана: ' + lines.length + ' строк\n' + lines.join('\n'));
  for (const line of lines) assert.ok(line.length <= api.MAX_COLS, 'строка шире экрана: «' + line + '»');
  const head = lines.findIndex((l) => /^\s*#\s+max\s+blk\s+js\s+r\+ev\s+st\+l\s+frc\s+other\s+script$/.test(l));
  assert.ok(head > 0, 'заголовка второй таблицы нет:\n' + lines.join('\n'));
  const rows = lines.slice(head + 1, head + 10);
  assert.equal(rows.length, 9);
  assert.ok(/^\s*9\s+12346\s/.test(rows[8]), 'у стадии stop scroll — своя строка фаз: «' + rows[8] + '»');
  const cells = rows[0].trim().split(/\s+/);
  assert.deepEqual(cells.slice(0, 8), ['1', '12346', '9877', '1234', '2346', '3457', '457', '12346'], rows[0]);
  assert.ok(rows[0].indexOf('very-long-cdn-hostname') !== -1, 'скрипта нет: ' + rows[0]);

  /* Стадия без долгих кадров — прочерк; LoAF не поддерживается вовсе —
     второй таблицы нет. */
  const r = wideResult(api);
  r.rows[1] = Object.assign({}, r.rows[1], { top: null, loafN: 0 });
  const quiet = api.table(r);
  const qHead = quiet.findIndex((l) => /^\s*#\s+max/.test(l));
  assert.ok(/^\s*2\s+-$/.test(quiet[qHead + 2]), 'стадия без долгих кадров: «' + quiet[qHead + 2] + '»');
  const none = api.table(Object.assign({}, r, { rows: r.rows.map((x) => Object.assign({}, x, { loafN: null, top: null, worst: null })) }));
  assert.equal(none.filter((l) => /^\s*#\s+max/.test(l)).length, 0, 'вторая таблица без LoAF');
});

/* ====================================================================== */
/* Рантайм в заглушках                                                    */
/* ====================================================================== */

function makeEnv(opts) {
  opts = opts || {};
  const log = [];
  const timers = [];
  let now = 0;
  const frames = [];
  let nextRaf = 1;
  const winListeners = {};
  const docListeners = {};
  const activity = [];
  const toggles = [];
  const controllers = {};
  const storageWrites = [];
  const noty = [];
  const body = [];

  function makeNode(tag) {
    return { tagName: tag.toUpperCase(), className: '', textContent: '', style: {}, parentNode: null };
  }
  const doc = {
    hidden: false,
    body: {
      appendChild: (n) => { n.parentNode = doc.body; body.push(n); },
      removeChild: (n) => { const i = body.indexOf(n); if (i !== -1) body.splice(i, 1); n.parentNode = null; },
      classList: { contains: () => false }
    },
    createElement: makeNode,
    querySelector: () => null,
    getAnimations: () => new Array(opts.anims || 3),
    addEventListener: (t, fn) => { (docListeners[t] = docListeners[t] || []).push(fn); },
    removeEventListener: (t, fn) => { docListeners[t] = (docListeners[t] || []).filter((f) => f !== fn); }
  };
  let focusIdx = 0;
  const cards = [{ id: 'c0' }, { id: 'c1' }, { id: 'c2' }, { id: 'c3' }, { id: 'c4' }, { id: 'c5' }, { id: 'c6' }, { id: 'c7' }];
  const hero = {
    parked: false, activeFlag: true, compactFlag: !!opts.compact,
    active: () => hero.activeFlag,
    parked_: null,
    compact: () => hero.compactFlag,
    focused: () => cards[focusIdx],
    benchHold: (on) => log.push('hero.benchHold ' + on),
    benchFlip: () => { log.push('hero.benchFlip'); if (opts.flipThrows) throw new Error('flip'); return true; },
    benchFx: (p) => log.push('hero.benchFx ' + p),
    benchRestore: () => log.push('hero.benchRestore'),
    applyMotion: () => log.push('hero.applyMotion'),
    applyFx: () => log.push('hero.applyFx')
  };
  hero.parked = () => !!opts.parked;
  const Lampa = {
    Controller: {
      toContent: () => log.push('toContent'),
      toggle: (name) => { toggles.push(name); log.push('toggle ' + name); (Lampa.Controller.listener._t || []).forEach((fn) => fn({ name })); },
      move: (dir) => {
        log.push('move ' + dir);
        if (dir === 'up') { hero.compactFlag = false; return; }
        const limit = opts.rowLength || cards.length;
        if (dir === 'right' && focusIdx < limit - 1) focusIdx++;
        if (dir === 'left' && focusIdx > 0) focusIdx--;
      },
      add: (name, c) => { controllers[name] = c; },
      enabled: () => ({ name: toggles[toggles.length - 1] || 'content' }),
      collectionSet: () => {},
      collectionFocus: (el) => { log.push('collectionFocus ' + (el && el.id)); focusIdx = cards.indexOf(el); },
      listener: {
        follow: (t, fn) => { Lampa.Controller.listener._t = (Lampa.Controller.listener._t || []).concat([fn]); log.push('follow toggle'); },
        remove: (t, fn) => { Lampa.Controller.listener._t = (Lampa.Controller.listener._t || []).filter((f) => f !== fn); log.push('remove toggle'); }
      }
    },
    Listener: {
      follow: (t, fn) => { activity.push(fn); log.push('follow activity'); },
      remove: (t, fn) => { const i = activity.indexOf(fn); if (i !== -1) activity.splice(i, 1); log.push('remove activity'); }
    },
    Noty: { show: (t) => noty.push(t) },
    Storage: { set: (k, v) => storageWrites.push([k, v]), get: (k, d) => d }
  };
  const win = {
    Lampa,
    innerWidth: 960, innerHeight: 540, devicePixelRatio: 2,
    performance: { now: () => now + (opts.late || 0) },
    requestAnimationFrame: (fn) => { const id = nextRaf++; frames.push({ id, fn }); return id; },
    cancelAnimationFrame: (id) => { const i = frames.findIndex((f) => f.id === id); if (i !== -1) frames.splice(i, 1); },
    addEventListener: (t, fn, cap) => { (winListeners[t] = winListeners[t] || []).push({ fn, cap }); },
    removeEventListener: (t, fn) => { winListeners[t] = (winListeners[t] || []).filter((l) => l.fn !== fn); }
  };
  /* Полоса gc3: FinalizationRegistry в заглушке. Минорная сборка (gc
     'minor') собирает только пробы датчика (held > 0 — объекты без ссылок,
     молодые), полная ('major') — всё зарегистрированное: метку датчик
     регистрирует, только когда отпускает. Колбэки одной сборки идут
     подряд, каждый на 0,01 мс позже — как в браузере. */
  const gcReg = [];
  if (opts.fr) {
    win.FinalizationRegistry = function (cb) { this.cb = cb; };
    win.FinalizationRegistry.prototype.register = function (target, held) { gcReg.push({ fr: this, held, done: false }); };
  }
  function collect(kind) {
    for (const x of gcReg.slice()) {
      if (!x.done && (kind === 'major' || x.held > 0)) { x.done = true; now += 0.01; x.fr.cb(x.held); }
    }
  }
  if (opts.loaf) {
    win.PerformanceObserver = function (cb) {
      win._loafCb = cb;
      this.observe = () => log.push('loaf observe');
      this.disconnect = () => log.push('loaf disconnect');
    };
    win.PerformanceObserver.supportedEntryTypes = ['long-animation-frame'];
  }
  globalThis.window = win;
  globalThis.document = doc;

  const overrides = [];
  const LC = {
    VERSION: '0.2.0',
    lang: (k) => k,
    prefs: {
      override: (map) => { overrides.push(Object.assign({}, map)); log.push('override ' + map.lumen_motion + (map.lumen_fx_heavy ? '+heavy' : '')); },
      clearOverride: () => log.push('clearOverride')
    },
    applyMotionMode: () => log.push('applyMotionMode'),
    hero,
    accent: {
      dominant: () => ({ r: 1, g: 2, b: 3 }),
      drive: (rgb) => log.push('accent.drive ' + JSON.stringify(rgb)),
      repaint: () => log.push('accent.repaint')
    },
    perf: { hold: (on) => log.push('perf.hold ' + on) },
    fx: { stats: () => ({ frames: 0, avgMs: 0 }) },
    hud: Object.assign({ chrome: () => '153', hardware: () => '4c/n/a' },
      opts.probe ? { probe: opts.probe, heroText: HUD.heroText } : {})
  };
  const { api } = fresh(LC);
  api._timers = {
    set: (fn, ms) => { timers.push({ fn, at: now + (ms || 0), done: false }); return timers.length; },
    clear: (id) => { if (timers[id - 1]) timers[id - 1].done = true; }
  };
  api._log = (t) => log.push('console ' + t.slice(0, 20));

  /* Время идёт кадрами по 16.7 мс: сначала таймеры, созревшие к этому
     моменту (по порядку сроков), потом кадр rAF. */
  function runTimersUntil(t) {
    for (let guard = 0; guard < 10000; guard++) {
      let next = null;
      for (const x of timers) if (!x.done && x.at <= t && (!next || x.at < next.at)) next = x;
      if (!next) return;
      next.done = true;
      now = next.at;
      next.fn();
    }
  }
  function advance(ms, opt) {
    const until = now + ms;
    const step = (opt && opt.noFrames) ? ms : 16.7;
    while (now < until - 1e-9) {
      const t = Math.min(until, now + step);
      runTimersUntil(t);
      now = t;
      if (!(opt && opt.noFrames)) {
        const pending = frames.splice(0, frames.length);
        for (const f of pending) f.fn(now);
      }
    }
  }
  return {
    api, LC, log, overrides, storageWrites, noty, body, toggles, controllers, doc, win, hero, cards,
    advance, timers, frames, gc: collect, gcReg, now: () => now,
    key: () => { const ls = (winListeners.keydown || []).slice(); let stopped = false; for (const l of ls) l.fn({ keyCode: 39, stopPropagation: () => { stopped = true; }, preventDefault() {} }); return { listeners: ls.length, stopped, capture: ls.every((l) => l.cap === true) }; },
    hide: () => { doc.hidden = true; (docListeners.visibilitychange || []).slice().forEach((fn) => fn({})); },
    activityStart: () => activity.slice().forEach((fn) => fn({ type: 'start', component: 'full' })),
    listeners: () => ({ key: (winListeners.keydown || []).length, vis: (docListeners.visibilitychange || []).length, act: activity.length, toggle: (Lampa.Controller.listener._t || []).length }),
    focusIdx: () => focusIdx,
    loaf: (entries) => win._loafCb({ getEntries: () => entries })
  };
}

/* Полный прогон: 8 стадий по 6 с и stop scroll (1 + 18,4 с), плюс выход
   из настроек. */
const LEAVE = 600;
const STAGE = 6000;
const STOP_STAGE = 1000 + 18400;
const RUN = 8 * STAGE + STOP_STAGE;

/* Уборка — одна на все пути выхода: подмены сняты, режим применён заново,
   принудительный канвас снят, смена кадров героя отпущена, цвет подкраски
   возвращён, автодетект снова мерит. */
function assertCleanup(e, label) {
  const at = e.log.lastIndexOf('clearOverride');
  assert.ok(at !== -1, label + ': подмены не сняты');
  const after = e.log.slice(at);
  for (const step of ['applyMotionMode', 'hero.benchFx null', 'hero.benchHold false', 'hero.benchRestore', 'hero.applyMotion', 'hero.applyFx', 'accent.repaint', 'perf.hold false']) {
    assert.ok(after.indexOf(step) !== -1, label + ': после снятия подмен нет «' + step + '»: ' + after.join(' | '));
  }
  assert.ok(after.indexOf('accent.drive {"r":1,"g":2,"b":3}') !== -1, label + ': цвет подкраски не возвращён');
  assert.equal(e.log.filter((x) => x.indexOf('override ') === 0 && e.log.indexOf(x) > at).length, 0, label + ': подмена после уборки');
  assert.deepEqual(e.listeners(), { key: 0, vis: 0, act: 0, toggle: 0 }, label + ': слушатели не сняты');
  assert.deepEqual(e.storageWrites, [], label + ': тест писал в Lampa.Storage');
  const screen = e.body.filter((n) => n.className === 'lumen-bench');
  assert.equal(screen.length, 1, label + ': таблица не показана');
  assert.equal(e.body.filter((n) => n.className === 'lumen-bench-tag').length, 0, label + ': метка прогона осталась');
  assert.ok(e.api.last(), label + ': last() пуст');
  assert.equal(e.api.running(), false, label + ': прогон не закрыт');
}

test('bench: полный прогон — восемь стадий, подмены только в памяти, одна уборка, таблица до «Назад»', () => {
  const e = makeEnv({ loaf: true });
  e.api.start();
  e.advance(LEAVE + 10);
  assert.ok(e.log.indexOf('toContent') !== -1, 'настройки закрыты');
  assert.ok(e.log.indexOf('perf.hold true') !== -1, 'автодетект не мерит на время теста');
  assert.ok(e.log.indexOf('hero.benchHold true') !== -1, 'смена кадров героя стоит на время теста');
  assert.equal(e.api.running(), true);
  e.advance(RUN + 100);

  assert.deepEqual(e.overrides.map((o) => o.lumen_motion), ['lite', 'full', 'full', 'full', 'full', 'lite', 'full', 'full', 'lite']);
  assert.deepEqual(e.overrides.map((o) => o.lumen_fx_heavy), [false, false, true, true, true, false, true, true, false]);
  assert.ok(e.overrides.every((o) => o.lumen_trailer === 'off' && o.lumen_hero_media === 'frames'), 'трейлер выключен подменой');
  /* Ревью ba6a3ac..6a1c364 (~60): праздничные темы рисуют сцены
     (winter/halloween — спрайты свечения, src/52_fx.js), и дороже всего на
     главной — они, а не прежний движок snow. Стадия «+fx» меряет winter. */
  assert.ok(e.log.indexOf('hero.benchFx winter') !== -1, 'частицы — сцена winter принудительно');
  assert.equal(e.log.indexOf('hero.benchFx snow'), -1, 'прежний движок snow — не то, что рисуют праздники');
  assert.equal(FX_PRESETS.winter && FX_PRESETS.winter.scene, true, 'winter — сцена движка частиц');
  assert.ok(e.log.indexOf('hero.benchFlip') !== -1, 'смена кадров на стадиях 4, 5, 8');
  assert.ok(e.log.some((x) => /^accent\.drive \{"r":(?!1,)\d+/.test(x)), 'подкраска меняется на стадиях +tint и all');
  assert.ok(e.log.indexOf('move right') !== -1 && e.log.indexOf('move left') !== -1, 'листание');
  assert.equal(e.focusIdx(), 0, 'листание вернуло фокус на исходную карточку');

  assertCleanup(e, 'конец');
  const r = e.api.last();
  assert.equal(r.reason, 'done');
  assert.equal(r.rows.length, 9);
  assert.equal(r.rows[8].hero, null, 'зонда нет (LC.hud без probe) — строка героя n/a');
  assert.ok(e.api.table(r).indexOf('9 hero: n/a') !== -1, e.api.table(r).join('\n'));
  assert.equal(r.rows[0].hero, undefined, 'у прочих стадий строки героя нет');
  assert.equal(r.rows[0].gc, null, 'нет FinalizationRegistry — датчик сборки молчит');
  assert.ok(r.rows[0].frames > 250, 'кадры считаются только в окне замера (5 с): ' + r.rows[0].frames);
  assert.ok(r.rows[0].frames < 320, 'прогрев в замер не идёт: ' + r.rows[0].frames);
  assert.equal(r.P, 16.7);
  assert.equal(r.rows[0].anim, 3, 'getAnimations().length');
  assert.ok(e.log.some((x) => x.indexOf('console [lumen-card] bench') === 0), 'JSON в консоль');

  /* Таблица висит до «Назад»: контроллер Lampa свой, back снимает экран и
     возвращает контент. */
  assert.equal(e.toggles[e.toggles.length - 1], 'lumen_bench');
  e.controllers.lumen_bench.back();
  assert.equal(e.body.filter((n) => n.className === 'lumen-bench').length, 0, 'экран таблицы снят');
  assert.equal(e.toggles[e.toggles.length - 1], 'content');
});

test('bench: любая клавиша прерывает — клавиша проглочена, набранное показано, уборка та же', () => {
  const e = makeEnv();
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(2 * STAGE + 2500);            /* середина замера третьей стадии */
  const k = e.key();
  assert.ok(k.listeners > 0 && k.capture, 'слушатель клавиш в фазе захвата');
  assert.ok(k.stopped, 'клавиша, прервавшая тест, не уходит в Lampa');
  assertCleanup(e, 'клавиша');
  const r = e.api.last();
  assert.equal(r.reason, 'key');
  assert.equal(r.rows.length, 3, 'две полные стадии и недомеренная третья');
  assert.equal(r.rows[2].partial, true);
  /* Ничего не тикает после уборки. */
  const before = e.log.length;
  e.advance(STAGE);
  assert.equal(e.log.length, before, 'после уборки тест ничего не делает: ' + e.log.slice(before).join(' | '));
});

test('bench: фон, смена активности, смена контроллера и ошибка — та же уборка', () => {
  const cases = [
    ['hidden', (e) => e.hide()],
    ['activity', (e) => e.activityStart()],
    ['toggle', (e) => e.win.Lampa.Controller.toggle('menu')]
  ];
  for (const [reason, act] of cases) {
    const e = makeEnv();
    e.api.start();
    e.advance(LEAVE + 10);
    e.advance(STAGE + 3000);
    act(e);
    assertCleanup(e, reason);
    assert.equal(e.api.last().reason, reason);
  }
  /* Ошибка внутри стадии: смена кадров героя бросила исключение. */
  const e = makeEnv({ flipThrows: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(4 * STAGE);
  assertCleanup(e, 'error');
  assert.equal(e.api.last().reason, 'error');
});

/* Живая проверка на стенде (2026-09-24): ряды главной ведёт СВОЙ контроллер
   Lampa 'items_line' (каждый ряд переключает его заново), а не 'content' —
   так же считает и src/64_nav.js (onCards). Переключение между ними —
   это всё ещё ряды главной, прерывать тест оно не имеет права. */
test('bench: переключение контроллера между content и items_line тест не прерывает', () => {
  const e = makeEnv();
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(STAGE);
  e.win.Lampa.Controller.toggle('items_line');
  e.win.Lampa.Controller.toggle('content');
  assert.equal(e.api.running(), true, 'тест прерван переключением рядов');
  e.win.Lampa.Controller.toggle('head');
  assert.equal(e.api.running(), false);
  assert.equal(e.api.last().reason, 'toggle');
});

test('bench: листание в коротком ряду возвращает фокус ровно на исходную карточку', () => {
  const e = makeEnv({ rowLength: 3 });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(RUN + 100);
  assert.equal(e.focusIdx(), 0);
  /* Влево из первой карточки Lampa открывает меню — тест туда не ходит. */
  const lefts = e.log.filter((x) => x === 'move left').length;
  const rights = e.log.filter((x) => x === 'move right').length;
  assert.ok(lefts <= rights, 'влево больше, чем вправо: ' + lefts + ' против ' + rights);
});

test('bench: фокус не в первом ряду — поднимается вверх до старта', () => {
  const e = makeEnv({ compact: true });
  e.api.start();
  e.advance(LEAVE + 10);
  assert.ok(e.log.indexOf('move up') !== -1, 'фокус не подняли');
  assert.equal(e.api.running(), true);
  e.advance(RUN + 100);
});

test('bench: не главная (герой запаркован) — тест не стартует, подмен и уборки нет, уведомление', () => {
  const e = makeEnv({ parked: true });
  e.api.start();
  e.advance(LEAVE + 10);
  assert.equal(e.api.running(), false);
  assert.equal(e.overrides.length, 0, 'подмены без прогона');
  assert.equal(e.log.indexOf('perf.hold true'), -1);
  assert.equal(e.noty.length, 1, 'уведомление, почему не стартовал');
  assert.deepEqual(e.storageWrites, []);
});

test('bench: long-animation-frame — число, сумма blockingDuration и хост скрипта худшего кадра', () => {
  const e = makeEnv({ loaf: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(1500);                         /* стадия 1, замер идёт */
  e.loaf([
    { startTime: 1e9, duration: 120, blockingDuration: 70, scripts: [{ duration: 60, sourceURL: 'https://cdn.example.org/app.min.js', invoker: 'TimerHandler:setTimeout' }] },
    { startTime: 1e9, duration: 90, blockingDuration: 30, scripts: [] }
  ]);
  e.advance(RUN);
  const row = e.api.last().rows[0];
  assert.equal(row.loafN, 2);
  assert.equal(row.loafMs, 100);
  assert.ok(row.worst && row.worst.host.indexOf('cdn.example.org') === 0, JSON.stringify(row.worst));
  assert.equal(e.api.last().rows[1].loafN, 0, 'чужая стадия не получила записей');
  /* Живая проверка 2026-09-24: долгий кадр без блокировки (blockingDuration
     0 — кадр долгий из-за отрисовки, а не задач) худшим не считается:
     строка «loaf max … 0 ms · n/a» в подвале была шумом. */
  const quiet = makeEnv({ loaf: true });
  quiet.api.start();
  quiet.advance(LEAVE + 10);
  quiet.advance(1500);
  quiet.loaf([{ startTime: 1e9, duration: 60, blockingDuration: 0, scripts: [] }]);
  quiet.advance(RUN);
  assert.equal(quiet.api.last().rows[0].loafN, 1);
  assert.equal(quiet.api.last().rows[0].worst, null);
  assert.equal(quiet.api.table(quiet.api.last()).filter((l) => l.indexOf('loaf max') === 0).length, 0);
  /* Раунд «Листание», п.5: в фазы раскладывается и такой кадр — самый
     длинный по duration, а не по блокировке. */
  assert.equal(quiet.api.last().rows[0].top.ms, 60);
  assert.equal(quiet.api.last().rows[0].top.other, 60);
});

/* Раунд «Листание», п.5: худший кадр для фаз — по duration (сколько кадр
   держал экран), худший для подвала — по blockingDuration, как прежде. */
test('bench: самый длинный кадр стадии — по duration, в строке стадии и в JSON', () => {
  const e = makeEnv({ loaf: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(1500);
  e.loaf([
    { startTime: 1e9, duration: 60, blockingDuration: 50, renderStart: 1e9 + 55, styleAndLayoutStart: 1e9 + 58,
      scripts: [{ startTime: 1e9 + 1, duration: 52, sourceURL: 'https://cdn.example.org/a.js', sourceFunctionName: 'a', sourceCharPosition: 1, invoker: 'TimerHandler:setTimeout' }] },
    { startTime: 1e9 + 100, duration: 150, blockingDuration: 10, renderStart: 1e9 + 120, styleAndLayoutStart: 1e9 + 200,
      scripts: [{ startTime: 1e9 + 125, duration: 70, sourceURL: 'https://cdn.example.org/app.min.js', sourceFunctionName: 'frameVisible', sourceCharPosition: 32024, invoker: 'DIV.onwebkitTransitionEnd' }] }
  ]);
  e.advance(RUN);
  const row = e.api.last().rows[0];
  assert.equal(row.worst.ms, 50, 'подвал — по блокировке');
  assert.equal(row.top.ms, 150, 'фазы — самого длинного кадра');
  assert.equal(row.top.rev, 80, 'transitionend Lampa — в r+ev');
  assert.equal(row.top.sl, 50);
  assert.equal(row.top.script, 'cdn.example.org frameVisible@32024 DIV.onwebkitTransitionEnd');
  assert.equal(e.api.last().rows[1].top, null, 'чужая стадия не получила кадра');
});

/* ====================================================================== */
/* Полоса телеметрии: стадия 9 «stop scroll» — листание с остановками и    */
/* ожидание героя (зонд LC.hud.probe, src/69_hud.js).                      */
/* ====================================================================== */

function fakeProbe(log) {
  const f = { made: [], keys: [], stops: 0 };
  f.make = (opts) => {
    f.made.push(opts);
    log.push('probe.make');
    return {
      sync() {},
      key: (t) => { f.keys.push(t); log.push('probe.key'); },
      stop: () => { f.stops++; log.push('probe.stop'); },
      summary: () => ({ n: 4, title: [880, 1480], frame: [1650, 2900], frameN: 3, gray: 1, pf: true, hit: 3, miss: 1, net: 0 }),
      shows: () => [{ id: 7, at: 1, title: 880, frame: 1650, gray: false, hit: true }]
    };
  };
  return f;
}

test('stop scroll: 4 группы по 5 шагов через 400 мс и остановка 3 с; у конца ряда — обратно, не левее исходной карточки', () => {
  let f = null;
  const e = makeEnv({ probe: (opts) => f.make(opts) });
  f = fakeProbe(e.log);
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(8 * STAGE + 1000 + 10);
  const at = e.log.lastIndexOf('probe.make');
  assert.ok(at !== -1, 'зонд не создан к началу замера девятой стадии');
  assert.deepEqual(f.made, [{ keys: false }], 'клавиш у теста нет — нажатия зонду даёт сам тест');
  e.advance(18400 + 100);
  const moves = e.log.slice(at).filter((x) => x.indexOf('move ') === 0).map((x) => (x === 'move right' ? 'R' : 'L')).join('');
  /* Ряд из 8 карточек, старт — первая: 5 вправо; 2 вправо, упёрлись —
     влево; влево до исходной, на ней — снова вправо; 5 вправо. */
  assert.equal(moves, 'RRRRR' + 'RRRLLL' + 'LLLLR' + 'RRRRR');
  assert.equal(f.keys.length, 20, 'одно нажатие на шаг, повтор у конца ряда — не нажатие');
  const gaps = f.keys.slice(1).map((t, i) => Math.round(t - f.keys[i]));
  assert.deepEqual(gaps, [400, 400, 400, 400, 3000, 400, 400, 400, 400, 3000, 400, 400, 400, 400, 3000, 400, 400, 400, 400]);
  assert.equal(f.stops, 1, 'зонд снят в конце стадии, уборка второй раз его не трогает');
  assert.ok(e.log.indexOf('probe.stop') < e.log.lastIndexOf('clearOverride'), 'зонд снят до уборки');
  const r = e.api.last();
  assert.equal(r.reason, 'done');
  assert.equal(r.rows.length, 9);
  const row = r.rows[8];
  assert.equal(row.id, 'stop scroll');
  assert.ok(row.frames > 1000, 'кадры считаются все 18,4 с замера: ' + row.frames);
  assert.deepEqual(row.hero.title, [880, 1480]);
  assert.equal(row.hero.shows.length, 1, 'сами показы — в JSON результата');
  assert.equal(e.focusIdx(), 0, 'уборка вернула фокус на исходную карточку');
  const lines = e.api.table(r);
  const i = lines.findIndex((l) => /^\s*9\s+stop scroll/.test(l));
  assert.ok(i > 0, lines.join('\n'));
  assert.equal(lines[i + 1], '9 hero 4: T_title 880/1480 · T_frame 1650/2900 (3) · gray 1 · pf h/m 3/1 · net-in-burst 0',
    'строка героя — сразу под строкой стадии');
  assert.ok(lines.length <= e.api.MAX_LINES, lines.length + ' строк');
});

test('stop scroll: прерывание посреди стадии — строка недомеренная, но со строкой героя; зонд снят той же уборкой', () => {
  let f = null;
  const e = makeEnv({ probe: (opts) => f.make(opts) });
  f = fakeProbe(e.log);
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(8 * STAGE + 1000 + 6000);
  e.key();
  assertCleanup(e, 'клавиша в stop scroll');
  assert.equal(f.stops, 1);
  const r = e.api.last();
  assert.equal(r.rows.length, 9);
  assert.equal(r.rows[8].partial, true);
  assert.deepEqual(r.rows[8].hero.frame, [1650, 2900]);
  assert.ok(e.api.table(r).some((l) => l.indexOf('9 hero 4: ') === 0));
});

test('stop scroll: ни один шаг не уходит левее исходной карточки даже в ряду из двух', () => {
  let f = null;
  const e = makeEnv({ rowLength: 2, probe: (opts) => f.make(opts) });
  f = fakeProbe(e.log);
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(8 * STAGE + 1000 + 10);
  const at = e.log.lastIndexOf('probe.make');
  let pos = 0;
  let min = 0;
  const seq = [];
  e.advance(18400 + 100);
  for (const x of e.log.slice(at)) {
    if (x === 'move right') { if (pos < 1) pos++; seq.push('R'); }
    if (x === 'move left') { pos--; seq.push('L'); }
    if (pos < min) min = pos;
  }
  assert.equal(min, 0, 'ушли левее исходной: ' + seq.join(''));
  assert.equal(f.keys.length, 20);
});

test('stop scroll: зонд снимается в конце СВОЕЙ стадии — следующая стадия его уже не видит', () => {
  let f = null;
  const e = makeEnv({ probe: (opts) => f.make(opts) });
  f = fakeProbe(e.log);
  /* Стадия после stop scroll — на случай, если порядок стадий изменится. */
  e.api.STAGES.push({ id: 'tail', motion: 'lite' });
  try {
    e.api.start();
    e.advance(LEAVE + 10);
    e.advance(RUN + STAGE + 100);
    const overrides = e.log.map((x, i) => [x, i]).filter((x) => x[0].indexOf('override ') === 0);
    assert.equal(overrides.length, 10);
    const stop = e.log.indexOf('probe.stop');
    assert.ok(stop !== -1 && stop < overrides[9][1], 'зонд жил и в следующей стадии');
    assert.equal(f.stops, 1);
  } finally {
    e.api.STAGES.pop();
  }
});

/* Полоса gc3 (2026-09-27): на ТВ LoAF отдаёт имя функции, переданной
   таймеру (sourceFunctionName), а у анонимной — пусто, и
   «TimerHandler:setTimeout azarkostya.github.io» в подвале не говорил,
   чей таймер. У самотеста — onBenchTimer (служебный), onBenchMove (шаг
   пульта), onBenchFrame (кадр замера), onBenchLeave/onBenchLaunch (выход
   из настроек и старт). */
test('bench: колбэки таймеров и rAF — именованные; шаг пульта отличим от служебного таймера', () => {
  const e = makeEnv({ loaf: true });
  e.api.start();
  assert.equal(e.timers[0].fn.name, 'onBenchLeave');
  e.advance(LEAVE + 10);
  assert.equal(e.timers[1].fn.name, 'onBenchLaunch');
  e.advance(RUN + 100);
  const names = new Set(e.timers.map((t) => t.fn.name));
  assert.deepEqual([...names].sort(), ['onBenchLaunch', 'onBenchLeave', 'onBenchMove', 'onBenchTimer'], [...names].join(','));
  /* Шаги листания — onBenchMove: столько же, сколько отложенных шагов. */
  const moves = e.timers.filter((t) => t.fn.name === 'onBenchMove').length;
  const steps = e.log.filter((x) => x === 'move right' || x === 'move left').length;
  assert.ok(moves > 20 && moves <= steps, moves + ' таймеров шага на ' + steps + ' нажатий');
  assert.equal(e.api.last().reason, 'done');
  const e2 = makeEnv();
  e2.api.start();
  e2.advance(LEAVE + 10);
  assert.ok(e2.frames.length > 0 && e2.frames.every((f) => f.fn.name === 'onBenchFrame'), 'кадр замера');
  e2.api.stop();
});

/* ====================================================================== */
/* Полоса gc3: датчик полной сборки мусора (onBenchGc)                     */
/* ====================================================================== */

test('bench: gcHits — пачке колбэков один кадр: самый длинный, чьё окно [начало, конец + GC_NEAR_MS] её содержит', () => {
  const { api } = fresh();
  const W = api.GC_NEAR_MS;
  assert.ok(W >= 17 && W <= 100, 'окно — несколько кадров: ' + W);
  const frames = [[1000, 120], [1300, 60], [1330, 200], [5000, 80]];
  assert.deepEqual(api.gcHits(frames, [1120 + W]), [true, false, false, false], 'на границе окна');
  assert.deepEqual(api.gcHits(frames, [1120 + W + 1]), [false, false, false, false], 'позже окна');
  assert.deepEqual(api.gcHits(frames, [999]), [false, false, false, false], 'раньше начала кадра');
  assert.deepEqual(api.gcHits(frames, [1340]), [false, false, true, false], 'в окне двух кадров — самый длинный');
  assert.deepEqual(api.gcHits(frames, [1010, 1100, 5050]), [true, false, false, true], 'две пачки в одном кадре — один кадр');
  assert.deepEqual(api.gcHits([], [1]), []);
});

test('bench: датчик сборки — полная сборка в замере: «gc», совпадение с длинным кадром: «lf» и «gc» у худшего кадра; минорная и прогрев — мимо', () => {
  const e = makeEnv({ loaf: true, fr: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(600);                          /* стадия 1, прогрев; тик — ветеран отпущен */
  e.gc('major');
  e.advance(1500);                         /* замер идёт */
  const t = e.now();
  e.loaf([{ startTime: t, duration: 150, blockingDuration: 0, renderStart: 0, styleAndLayoutStart: 0, scripts: [] }]);
  e.advance(155);
  e.gc('major');                           /* колбэк — через 5 мс после конца кадра */
  e.advance(200);
  e.gc('minor');
  e.advance(600);                          /* тик: отпущен следующий ветеран */
  e.gc('major');
  e.advance(RUN);
  const r = e.api.last();
  const row = r.rows[0];
  assert.equal(row.gc.n, 2, 'две полные сборки за замер: ' + JSON.stringify(row.gc));
  assert.equal(row.gc.hit, 1, 'с длинным кадром совпала одна');
  assert.equal(row.gc.t.length, 2);
  assert.ok(Math.abs(row.gc.t[0] - (t + 155)) < 1, 'время колбэка: ' + row.gc.t[0]);
  assert.equal(row.top.gc, true, 'самый длинный кадр стадии — сборка');
  assert.equal(r.rows[1].gc.n, 0, 'в другой стадии сборок не было');
  const lines = e.api.table(r);
  assert.ok(/\bgc\/lf$/.test(lines[1]), 'колонка gc/lf: «' + lines[1] + '»');
  assert.ok(/\s2\/1$/.test(lines[2]), 'строка стадии 1: «' + lines[2] + '»');
  assert.ok(/\s0\/0$/.test(lines[3]), 'строка стадии 2: «' + lines[3] + '»');
  const head = lines.findIndex((l) => /^\s*#\s+max/.test(l));
  assert.ok(/^\s*1\s+150\s+0\s+0\s+0\s+0\s+0\s+150\s+gc$/.test(lines[head + 1]), 'худший кадр помечен: «' + lines[head + 1] + '»');
});

test('bench: датчик сборки — своя метка отпускается, только пережив две сборки: до того полная сборка не видна', () => {
  const e = makeEnv({ loaf: true, fr: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(5 * STAGE + 1100);             /* стадия 6, замер */
  const released = () => e.gcReg.filter((x) => x.held < 0).length;
  assert.equal(released(), e.api.GC_POOL, 'ветераны отпущены все, и больше ничего: своим меткам сборок ещё не было');
  e.gc('major');                           /* ветераны */
  e.advance(1100);                         /* два тика: свои метки пережили одну сборку — держим */
  assert.equal(released(), e.api.GC_POOL, 'метка, пережившая одну сборку, не отпущена');
  e.gc('major');                           /* отпущенных нет — сборка не видна; метки пережили вторую */
  e.advance(600);                          /* тик: отпущена старая метка */
  assert.equal(released(), e.api.GC_POOL + 1);
  e.gc('minor');                           /* минорная старую метку не собирает */
  e.advance(200);
  e.gc('major');
  e.advance(RUN);
  const row = e.api.last().rows[5];
  assert.equal(row.id, 'lite scroll');
  assert.equal(row.gc.n, 2, 'ветераны и старая метка; сборка без отпущенных меток не видна: ' + JSON.stringify(row.gc));
  assert.equal(row.gc.hit, 0, 'длинных кадров не было');
});

test('bench: датчик сборки — таблица: «n/a» без FinalizationRegistry, «n/-» без LoAF', () => {
  const e = makeEnv({ fr: true });
  e.api.start();
  e.advance(LEAVE + 10);
  e.advance(1500);
  e.gc('major');
  e.advance(RUN);
  const r = e.api.last();
  assert.deepEqual([r.rows[0].gc.n, r.rows[0].gc.hit], [1, null]);
  const lines = e.api.table(r);
  assert.ok(/\s1\/-$/.test(lines[2]), '«' + lines[2] + '»');
  const none = e.api.table(Object.assign({}, r, { rows: r.rows.map((x) => Object.assign({}, x, { gc: null })) }));
  assert.ok(/\sn\/a$/.test(none[2]), '«' + none[2] + '»');
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { check } from '../scripts/es5check.mjs';

/* Короткий загрузчик lumen.js — адрес установки плагина по одной ссылке
   (README: https://azarkostya.github.io/lumen-card/lumen.js). Он ставит
   <script> сборки dist/lumen_card.js рядом с собой. Полное ревью c644bfd,
   S5: адрес, набранный руками с http:, тянул сборку по http: — со старого
   GitHub Pages и jsDelivr это редирект на https (лишний круг по сети на
   каждом запуске Lampa) или подмена по дороге. Для этих двух хостов
   загрузчик берёт https: сам; свой сервер (стенд, локальная сеть) — как
   был, адрес его. */
const SRC = readFileSync(new URL('../lumen.js', import.meta.url), 'utf8');
const VERSION = /var VERSION = '([^']+)';/.exec(SRC)[1];
/* После 1.2.0 загрузчик с GitHub Pages первым просит сборку с jsDelivr по тегу
   версии; остальные адреса — как раньше (сборка рядом с lumen.js). */
const CDN_BUILD = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@v' + VERSION + '/dist/lumen_card.js';

/* Загрузчик в поддельном окружении: document, window (признак запуска
   плагина) и таймеры, которые тест крутит сам. */
function run(src) {
  const added = [];
  const timers = [];
  const win = {};
  const doc = {
    currentScript: src === null ? null : { src: src },
    createElement: () => ({ src: '' }),
    head: { appendChild: (s) => added.push(s) }
  };
  const setT = (fn, ms) => { timers.push({ fn, ms, live: true }); return timers.length; };
  const clearT = (id) => { if (timers[id - 1]) timers[id - 1].live = false; };
  new Function('document', 'window', 'setTimeout', 'clearTimeout', SRC)(doc, win, setT, clearT);
  return { added, timers, win };
}

function load(src) {
  const { added } = run(src);
  assert.equal(added.length, 1, 'сборка подключается ровно одним <script>');
  return added[0].src.replace(/\?v=[0-9a-f]{10}$/, '');
}

test('ревью S5: http: у GitHub Pages и jsDelivr — сборка по https:', () => {
  assert.equal(load('http://azarkostya.github.io/lumen-card/lumen.js'), CDN_BUILD);
  assert.equal(load('http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js?x=1'),
    'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
});

test('ревью S5: https: и свой сервер — адрес не трогается; без currentScript — запасной jsDelivr', () => {
  assert.equal(load('https://azarkostya.github.io/lumen-card/lumen.js'), CDN_BUILD);
  assert.equal(load('http://localhost:8766/lumen.js'), 'http://localhost:8766/dist/lumen_card.js');
  assert.equal(load('http://192.168.1.5/github.io/lumen.js'), 'http://192.168.1.5/github.io/dist/lumen_card.js', 'чужой хост с github.io в пути');
  assert.equal(load(null), 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/dist/lumen_card.js');
});

/* Релиз 1.0.0: стабильная версия — ветка main (GitHub Pages переключён на
   неё), бета — jsDelivr с @feat/lumen-v2. Запасной адрес загрузчика без
   document.currentScript обязан вести в стабильную ветку, а не в бету;
   адрес беты, набранный с http:, по-прежнему уходит на https: в свою ветку. */
test('релиз 1.0.0: запасной адрес — стабильная ветка main, бета @feat/lumen-v2 — своя ветка', () => {
  assert.ok(SRC.indexOf('@feat/') === -1, 'в загрузчике не осталось адреса беты');
  assert.equal(load('http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/lumen.js'),
    'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/dist/lumen_card.js');
  assert.equal(load('https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js'),
    'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
});

/* Финальная проверка, SEC-2: запасной http:-путь (следующий раунд, п.7)
   снят. GitHub Pages и jsDelivr отвечают на http: редиректом 301 на
   https: (curl -sI, 2026-09-26) — вторая попытка по http: шла в тот же
   https: и ничем не помогала, а без HSTS давала лишний запрос открытым
   текстом. Ошибка <script> больше ничего не заводит. */
function loadWithErrors(src) {
  return run(src).added;
}

const bare = (s) => s.src.replace(/\?v=[0-9a-f]{10}$/, '');

test('SEC-2: http: у GitHub Pages и jsDelivr — по https:, без отката на http:', () => {
  const beta = loadWithErrors('http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js');
  assert.equal(beta.length, 1);
  assert.equal(bare(beta[0]), 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
  assert.equal(beta[0].onerror, undefined, 'у беты на ошибку <script> отката нет');
  // Pages: jsDelivr по тегу, запасной путь — тот же Pages, и тоже по https:.
  const pages = loadWithErrors('http://azarkostya.github.io/lumen-card/lumen.js');
  assert.equal(pages.length, 1);
  assert.equal(bare(pages[0]), CDN_BUILD);
  pages[0].onerror();
  assert.equal(pages.length, 2);
  assert.equal(bare(pages[1]), 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js');
  assert.equal(SRC.indexOf("'http:"), -1, 'в загрузчике не осталось адреса http:');
});

test('SEC-2: свой сервер и запасной jsDelivr — один <script>, без onerror', () => {
  for (const src of ['http://localhost:8766/lumen.js', null]) {
    const added = loadWithErrors(src);
    assert.equal(added.length, 1, 'лишняя попытка для ' + src);
    assert.equal(added[0].onerror, undefined);
  }
});

/* 1.1: метка в адресе сборки — хэш её содержимого (var BUILD, вписывает
   scripts/build.mjs), а не время. Адрес не зависит от часов: два запуска
   Lampa с одной сборкой просят один и тот же URL — кэш браузера и кэш
   компиляции V8 работают; сверку метки с dist держит test/build.test.mjs. */
test('1.1: адрес сборки — ?v=<метка BUILD>, одинаковый в любое время', () => {
  const build = /var BUILD = '([0-9a-f]{10})';/.exec(SRC);
  assert.ok(build, 'в загрузчике нет var BUILD');
  const realNow = Date.now;
  const urls = [];
  try {
    for (const t of [0, 599999, 600000, 86400000 * 7]) {
      Date.now = () => 1790000000000 + t;
      urls.push(loadWithErrors('https://azarkostya.github.io/lumen-card/lumen.js?logged=false&reset=0.5')[0].src);
    }
  } finally {
    Date.now = realNow;
  }
  assert.equal(urls[0], CDN_BUILD + '?v=' + build[1]);
  assert.deepEqual(urls, [urls[0], urls[0], urls[0], urls[0]]);
});

test('ревью S5: загрузчик — строгий ES5, комментарий о цене метки свежести — с настоящим размером сборки', () => {
  assert.deepEqual(check(SRC).map((f) => f.rule + ' @' + f.line), []);
  assert.ok(SRC.indexOf('150 КБ') === -1, 'в комментарии прежние «~150 КБ» — сборка давно в пять раз больше');
});

/* После 1.2.0: загрузчик с GitHub Pages берёт сборку с jsDelivr по тегу
   версии — у jsDelivr есть публичная статистика по версиям
   (scripts/stats.mjs), у Pages её нет. Запасной путь — та же сборка с Pages:
   один раз, по onerror, по onload без запущенного плагина и по таймауту.
   Второй старт плагина держит голова сборки (src/00_head.js). */
const PAGES_SRC = 'https://azarkostya.github.io/lumen-card/lumen.js?logged=false&reset=0.123&origin=bG9jYWxob3N0&email=dXNlckBleGFtcGxlLmNvbQ%3D%3D';
const BUILD = /var BUILD = '([0-9a-f]{10})';/.exec(SRC)[1];
const PAGES_BUILD = 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js?v=' + BUILD;
const WAIT = +/var WAIT = (\d+);/.exec(SRC)[1];

test('jsDelivr по тегу: с Pages сборка — @v<VERSION>/dist/lumen_card.js?v=<BUILD>, VERSION = LC.VERSION', () => {
  const head = readFileSync(new URL('../src/00_head.js', import.meta.url), 'utf8');
  assert.equal(VERSION, /LC\.VERSION = '([^']+)';/.exec(head)[1]);
  const { added, timers } = run(PAGES_SRC);
  assert.equal(added.length, 1);
  assert.equal(added[0].src, CDN_BUILD + '?v=' + BUILD);
  assert.equal(typeof added[0].onerror, 'function');
  assert.equal(typeof added[0].onload, 'function');
  assert.equal(timers.length, 1);
  assert.equal(timers[0].ms, WAIT);
  // Параметры, которые Lampa дописывает к адресу плагина, дальше не уходят.
  for (const p of ['logged', 'reset', 'origin', 'email']) assert.equal(added[0].src.indexOf(p + '='), -1, p);
  // Хост без учёта регистра — тот же Pages; чужой github.io (форк) — как раньше.
  assert.equal(load('https://AzarKostya.github.io/lumen-card/lumen.js'), CDN_BUILD);
  assert.equal(load('https://someone.github.io/lumen-card/lumen.js'), 'https://someone.github.io/lumen-card/dist/lumen_card.js');
});

test('jsDelivr по тегу: onerror (404 — тег ещё не разрешён) → один запасной <script> с Pages', () => {
  const { added, timers } = run(PAGES_SRC);
  added[0].onerror();
  assert.equal(added.length, 2);
  assert.equal(added[1].src, PAGES_BUILD);
  assert.equal(added[1].onerror, undefined, 'у запасного пути своего отката нет');
  assert.equal(timers[0].live, false, 'таймаут снят');
  added[0].onerror();
  timers[0].fn();
  assert.equal(added.length, 2, 'запасной путь — только один раз');
});

test('jsDelivr по тегу: таймаут → запасной путь; поздний onload jsDelivr ничего не добавляет', () => {
  const { added, timers, win } = run(PAGES_SRC);
  assert.ok(WAIT >= 8000 && WAIT <= 15000, 'порог ' + WAIT + ' мс');
  timers[0].fn();
  assert.equal(added.length, 2);
  assert.equal(added[1].src, PAGES_BUILD);
  win.lumen_card_plugin = true; // запасная сборка стартовала
  added[0].onload();            // jsDelivr всё-таки догрузился
  added[0].onerror();
  assert.equal(added.length, 2);
});

test('jsDelivr по тегу: onload с запущенным плагином снимает таймаут; без плагина — запасной путь', () => {
  let r = run(PAGES_SRC);
  r.win.lumen_card_plugin = true;
  r.added[0].onload();
  assert.equal(r.timers[0].live, false);
  assert.equal(r.added.length, 1);

  r = run(PAGES_SRC);
  r.added[0].onload(); // пришло что-то, но плагин не стартовал
  assert.equal(r.added.length, 2);
  assert.equal(r.added[1].src, PAGES_BUILD);
  assert.equal(r.timers[0].live, false);
});

test('jsDelivr по тегу: бета, свой сервер, IP, без currentScript — как раньше: один <script>, без таймера', () => {
  for (const [src, want] of [
    ['https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js', 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js'],
    ['http://127.0.0.1:8934/lumen.js?reset=1', 'http://127.0.0.1:8934/dist/lumen_card.js'],
    ['http://192.168.1.5:9000/lampa/lumen.js', 'http://192.168.1.5:9000/lampa/dist/lumen_card.js'],
    [null, 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/dist/lumen_card.js']
  ]) {
    const { added, timers } = run(src);
    assert.equal(added.length, 1, String(src));
    assert.equal(added[0].src, want + '?v=' + BUILD);
    assert.equal(added[0].onerror, undefined);
    assert.equal(added[0].onload, undefined);
    assert.equal(timers.length, 0, 'таймера нет: ' + src);
  }
});

/* Защита от второго старта: jsDelivr догрузился после запасного пути (или
   плагин стоит с двух адресов) — вторая копия сборки выходит на первой же
   проверке, ничего больше не трогая. */
test('двойной запуск: сборка при window.lumen_card_plugin выходит сразу', () => {
  const dist = readFileSync(new URL('../dist/lumen_card.js', import.meta.url), 'utf8');
  const touched = [];
  const win = new Proxy({ lumen_card_plugin: true }, {
    get: (t, k) => { touched.push('get ' + String(k)); return t[k]; },
    set: (t, k, v) => { touched.push('set ' + String(k)); t[k] = v; return true; }
  });
  new Function('window', 'document', 'Lampa', dist)(win, undefined, undefined);
  assert.deepEqual(touched, ['get lumen_card_plugin']);
});

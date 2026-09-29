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

function load(src) {
  const added = [];
  const doc = {
    currentScript: src === null ? null : { src: src },
    createElement: () => ({ src: '' }),
    head: { appendChild: (s) => added.push(s) }
  };
  new Function('document', SRC)(doc);
  assert.equal(added.length, 1, 'сборка подключается ровно одним <script>');
  return added[0].src.replace(/\?v=[0-9a-f]{10}$/, '');
}

test('ревью S5: http: у GitHub Pages и jsDelivr — сборка по https:', () => {
  assert.equal(load('http://azarkostya.github.io/lumen-card/lumen.js'), 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js');
  assert.equal(load('http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js?x=1'),
    'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
});

test('ревью S5: https: и свой сервер — адрес не трогается; без currentScript — запасной jsDelivr', () => {
  assert.equal(load('https://azarkostya.github.io/lumen-card/lumen.js'), 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js');
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
  const added = [];
  const doc = {
    currentScript: src === null ? null : { src: src },
    createElement: () => ({ src: '' }),
    head: { appendChild: (s) => added.push(s) }
  };
  new Function('document', SRC)(doc);
  return added;
}

const bare = (s) => s.src.replace(/\?v=[0-9a-f]{10}$/, '');

test('SEC-2: http: у GitHub Pages и jsDelivr — ровно один <script> по https:, без отката на http:', () => {
  for (const [src, want] of [
    ['http://azarkostya.github.io/lumen-card/lumen.js', 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js'],
    ['http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js', 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js']
  ]) {
    const added = loadWithErrors(src);
    assert.equal(added.length, 1);
    assert.equal(bare(added[0]), want);
    assert.equal(added[0].onerror, undefined, 'на ошибку <script> отката нет: ' + src);
  }
  assert.equal(SRC.indexOf("'http:"), -1, 'в загрузчике не осталось адреса http:');
});

test('SEC-2: https: набран руками, свой сервер, запасной jsDelivr — один <script>, без onerror', () => {
  for (const src of ['https://azarkostya.github.io/lumen-card/lumen.js', 'http://localhost:8766/lumen.js', null]) {
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
  assert.equal(urls[0], 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js?v=' + build[1]);
  assert.deepEqual(urls, [urls[0], urls[0], urls[0], urls[0]]);
});

test('ревью S5: загрузчик — строгий ES5, комментарий о цене метки свежести — с настоящим размером сборки', () => {
  assert.deepEqual(check(SRC).map((f) => f.rule + ' @' + f.line), []);
  assert.ok(SRC.indexOf('150 КБ') === -1, 'в комментарии прежние «~150 КБ» — сборка давно в пять раз больше');
});

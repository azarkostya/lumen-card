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
  return added[0].src.replace(/\?v=\d+$/, '');
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
  assert.equal(load(null), 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
});

/* Следующий раунд, п.7: https: для GitHub Pages и jsDelivr загрузчик
   ставит сам, а у старых ТВ с устаревшими корневыми сертификатами или
   сбитыми часами https: не открывается вовсе — плагин не грузился бы там,
   где адрес с http: работал. На ошибку <script> — одна попытка исходным
   http:-адресом; https:, набранный руками, и свой сервер запасного пути
   не получают (исходный адрес и так уже был испробован). */
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

const bare = (s) => s.src.replace(/\?v=\d+$/, '');

test('п.7: https: не открылся — одна попытка исходным http:, с той же меткой свежести', () => {
  const added = loadWithErrors('http://azarkostya.github.io/lumen-card/lumen.js');
  assert.equal(added.length, 1);
  assert.equal(bare(added[0]), 'https://azarkostya.github.io/lumen-card/dist/lumen_card.js');
  assert.equal(typeof added[0].onerror, 'function', 'у принудительного https: нет запасного пути');
  added[0].onerror();
  assert.equal(added.length, 2, 'ошибка https: не дала второй попытки');
  assert.equal(bare(added[1]), 'http://azarkostya.github.io/lumen-card/dist/lumen_card.js');
  assert.equal(added[1].src.split('?')[1], added[0].src.split('?')[1], 'метка свежести у запасного адреса другая');
  /* Попытка одна: ошибка запасного адреса третьей не заводит. */
  if (typeof added[1].onerror === 'function') added[1].onerror();
  added[0].onerror && added[0].onerror();
  assert.equal(added.length, 2, 'запасных попыток больше одной');

  const cdn = loadWithErrors('http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/lumen.js');
  cdn[0].onerror();
  assert.equal(bare(cdn[1]), 'http://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/dist/lumen_card.js');
});

test('п.7: https: набран руками, свой сервер, запасной jsDelivr — второй попытки нет', () => {
  for (const src of ['https://azarkostya.github.io/lumen-card/lumen.js', 'http://localhost:8766/lumen.js', null]) {
    const added = loadWithErrors(src);
    if (typeof added[0].onerror === 'function') added[0].onerror();
    assert.equal(added.length, 1, 'лишняя попытка для ' + src);
  }
});

test('ревью S5: загрузчик — строгий ES5, комментарий о цене метки свежести — с настоящим размером сборки', () => {
  assert.deepEqual(check(SRC).map((f) => f.rule + ' @' + f.line), []);
  assert.ok(SRC.indexOf('150 КБ') === -1, 'в комментарии прежние «~150 КБ» — сборка давно в пять раз больше');
});

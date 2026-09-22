/* Lumen Card для Lampa — короткий адрес установки.
   Подгружает сборку dist/lumen_card.js, лежащую рядом с этим файлом
   (GitHub Pages или jsDelivr). Строгий ES5. */
(function () {
  'use strict';
  var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/';
  var cur = document.currentScript;
  var src = (cur && cur.src) || '';
  var base = src ? src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') : FALLBACK;
  /* Метка свежести: jsDelivr отдаёт файл с max-age=604800 (7 дней), а
     Pages — с кэшем браузера; без параметра в адресе телевизор держал бы
     старую сборку неделю после любого push. Значение меняется раз в час,
     поэтому кэш всё же работает внутри часа, а новая сборка доезжает не
     позже чем через час (проверено 2026-09-22 по заголовку Cache-Control
     ответа cdn.jsdelivr.net). */
  var stamp = Math.floor(Date.now() / 3600000);
  var s = document.createElement('script');
  s.src = base + 'dist/lumen_card.js?v=' + stamp;
  (document.head || document.documentElement).appendChild(s);
})();

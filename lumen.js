/* Lumen Card для Lampa — короткий адрес установки.
   Подгружает сборку dist/lumen_card.js, лежащую рядом с этим файлом
   (GitHub Pages или jsDelivr). Строгий ES5. */
(function () {
  'use strict';
  var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/';
  var cur = document.currentScript;
  var src = (cur && cur.src) || '';
  var base = src ? src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') : FALLBACK;
  var s = document.createElement('script');
  s.src = base + 'dist/lumen_card.js';
  (document.head || document.documentElement).appendChild(s);
})();

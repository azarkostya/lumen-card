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
     Pages — с max-age=600; без параметра в адресе телевизор мог бы держать
     старую сборку до недели после push. Значение меняется раз в 10 минут
     (было — раз в час): внутри окна кэш работает, а новая сборка доезжает
     не позже чем через 10 минут после выкладки (Pages пересобирается 1–2
     минуты). Цена — сборка ~150 КБ скачивается заново не чаще раза в
     10 минут при запуске Lampa. */
  var stamp = Math.floor(Date.now() / 600000);
  var s = document.createElement('script');
  s.src = base + 'dist/lumen_card.js?v=' + stamp;
  (document.head || document.documentElement).appendChild(s);
})();

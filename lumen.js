/* Lumen Card для Lampa — короткий адрес установки.
   Подгружает сборку dist/lumen_card.js, лежащую рядом с этим файлом
   (GitHub Pages или jsDelivr). Строгий ES5. */
(function () {
  'use strict';
  var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@feat/lumen-v2/';
  var cur = document.currentScript;
  var src = (cur && cur.src) || '';
  var base = src ? src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') : FALLBACK;
  /* Адрес установки набрали с http: — GitHub Pages и jsDelivr сборку всё
     равно отдают по https: (http: у них — редирект, лишний круг по сети на
     каждом запуске Lampa, или подмена по дороге). Для этих двух хостов берём
     https: сразу; свой сервер (стенд, локальная сеть) — как был. */
  base = base.replace(/^http:(\/\/(?:[^\/?#]+\.github\.io|cdn\.jsdelivr\.net)\/)/i, 'https:$1');
  /* Метка свежести: jsDelivr отдаёт файл с max-age=604800 (7 дней), а
     Pages — с max-age=600; без параметра в адресе телевизор мог бы держать
     старую сборку до недели после push. Значение меняется раз в 10 минут
     (было — раз в час): внутри окна кэш работает, а новая сборка доезжает
     не позже чем через 10 минут после выкладки (Pages пересобирается 1–2
     минуты). Цена — сборка (~864 КБ, ~206 КБ в gzip) скачивается заново
     не чаще раза в 10 минут при запуске Lampa, и с новым адресом движок
     теряет кэш её компиляции — разбор и компиляция идут заново. */
  var stamp = Math.floor(Date.now() / 600000);
  var s = document.createElement('script');
  s.src = base + 'dist/lumen_card.js?v=' + stamp;
  (document.head || document.documentElement).appendChild(s);
})();

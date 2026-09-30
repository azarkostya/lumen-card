/* Lumen Card для Lampa — короткий адрес установки.
   Подгружает сборку dist/lumen_card.js, лежащую рядом с этим файлом
   (GitHub Pages или jsDelivr). Строгий ES5.
   Стабильная версия — ветка main (GitHub Pages с 1.0.0 берёт её); бета —
   ветка feat/lumen-v2 через jsDelivr. Запасной адрес (браузер без
   document.currentScript) — стабильная ветка. */
(function () {
  'use strict';
  var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/';
  /* Метка сборки: первые 10 hex sha256 от dist/lumen_card.js. Вписывает её
     scripts/build.mjs, руками не править (build.mjs --check ловит
     расхождение с dist). */
  var BUILD = 'c92d8c03aa';
  var cur = document.currentScript;
  var src = (cur && cur.src) || '';
  var base = src ? src.replace(/[?#].*$/, '').replace(/[^\/]*$/, '') : FALLBACK;
  /* Адрес установки набрали с http: — GitHub Pages и jsDelivr сборку всё
     равно отдают по https: (http: у них — редирект 301, лишний круг по сети
     на каждом запуске Lampa, или подмена по дороге). Для этих двух хостов
     берём https: сразу; свой сервер (стенд, локальная сеть) — как был.
     Финальная проверка, SEC-2: запасного http:-пути больше нет. Он обещал
     старому ТВ, у которого https: не открывается (сертификаты, часы), что
     «адрес с http: у него работал», но оба хоста отвечают на http: тем же
     301 на https: (curl -sI, 2026-09-26): попытка уходила в тот же https: и
     падала, а на пути без HSTS давала лишний запрос открытым текстом. */
  base = base.replace(/^http:(\/\/(?:[^\/?#]+\.github\.io|cdn\.jsdelivr\.net)\/)/i, 'https:$1');
  /* Адрес сборки — с меткой по её содержимому, а не по времени. jsDelivr
     отдаёт файл с max-age=604800 (7 дней), Pages — с max-age=600: без
     параметра телевизор мог бы держать старую сборку до недели. До 1.1
     метка менялась раз в 10 минут, и почти каждый запуск Lampa заново
     скачивал сборку (~1 МБ, ~240 КБ в gzip) и заново её разбирал и
     компилировал: новый адрес — нет ни кэша браузера, ни кэша компиляции
     движка. Теперь адрес меняется ровно тогда, когда меняется сборка:
     неизменная сборка берётся из кэша (после max-age — проверкой 304), а
     новая доезжает с первым свежим lumen.js. Сам lumen.js Lampa просит
     каждый раз с новым адресом (addPluginParams в app.min.js дописывает
     reset=Math.random()), так что кэш браузера его не держит: ТВ видит тот
     lumen.js, что отдаёт хостинг, — Pages после пересборки (1–2 минуты) и
     не позже срока своего кэша (max-age=600), jsDelivr @ветка — после
     сброса кэша (scripts/release.mjs --purge). */
  var s = document.createElement('script');
  s.src = base + 'dist/lumen_card.js?v=' + BUILD;
  (document.head || document.documentElement).appendChild(s);
})();

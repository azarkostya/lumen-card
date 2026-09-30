/* Lumen Card для Lampa — короткий адрес установки.
   Подгружает сборку dist/lumen_card.js: с GitHub Pages — с jsDelivr по
   тегу версии (запасной путь — рядом с этим файлом), с любого другого
   адреса — лежащую рядом с этим файлом. Строгий ES5.
   Стабильная версия — ветка main (GitHub Pages с 1.0.0 берёт её); бета —
   ветка feat/lumen-v2 через jsDelivr. Запасной адрес (браузер без
   document.currentScript) — стабильная ветка. */
(function () {
  'use strict';
  var FALLBACK = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@main/';
  var PAGES = 'https://azarkostya.github.io/lumen-card/';
  var CDN = 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@v';
  /* Сколько ждать сборку с jsDelivr до запасного пути (мс), см. README,
     раздел «Хосты». */
  var WAIT = 10000;
  /* Метка сборки: первые 10 hex sha256 от dist/lumen_card.js. Вписывает её
     scripts/build.mjs, руками не править (build.mjs --check ловит
     расхождение с dist). */
  var BUILD = '8960423f8a';
  /* Версия выпуска (LC.VERSION из src/00_head.js) — тег v<VERSION>, с
     которого Pages-загрузчик берёт сборку на jsDelivr. Тоже вписывает
     scripts/build.mjs; --check ловит расхождение. */
  var VERSION = '1.2.0';
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
  var head = document.head || document.documentElement;
  var local = base + 'dist/lumen_card.js?v=' + BUILD;
  function add(url, onload, onerror) {
    var s = document.createElement('script');
    if (onload) s.onload = onload;
    if (onerror) s.onerror = onerror;
    s.src = url;
    head.appendChild(s);
  }
  /* После 1.2.0: загрузчик с GitHub Pages берёт сборку с jsDelivr — по адресу
     ВЕРСИИ (тег v<VERSION>), запасной путь — та же сборка с Pages. Зачем:
     у Pages статистики нет, у jsDelivr — публичная, по версиям
     (node scripts/stats.mjs). Ни идентификаторов, ни новых хостов, ни
     «пингов»: только другой адрес той же сборки; параметры, которые Lampa
     дописывает к адресу плагина (logged, reset, origin, email), дальше
     lumen.js не уходят. Адрес по тегу, а не @main или @<sha>: lumen.js не
     знает своего коммита, а ветку jsDelivr держит до 12 часов и без
     --purge отдаёт старое; тег jsDelivr отдаёт с max-age на год
     (immutable) — сборка версии с него всегда та, что в коммите тега, а
     ?v=<метка> держит прежний инвариант «новая сборка — новый адрес» и для
     кэша браузера. Бета (jsDelivr по ветке), свой сервер, стенд, IP-адрес —
     как раньше, сборка из той же папки: им теги не нужны. */
  if (base.toLowerCase() !== PAGES) {
    add(local);
    return;
  }
  /* Запасной путь — один раз: на onerror (тег ещё не разрешён — jsDelivr
     отвечает 404 без кэша; хост недоступен), на onload без запущенного
     плагина (вместо сборки пришло что-то не то) и по таймауту WAIT, если
     jsDelivr «висит» (DPI режет соединение — ошибки сети браузер ждёт
     десятки секунд). Если jsDelivr догрузится после таймаута, второго
     старта нет: голова сборки (src/00_head.js) выходит сразу, когда
     window.lumen_card_plugin уже стоит. */
  var spare = false;
  var timer = 0;
  function fallback() {
    clearTimeout(timer);
    if (spare) return;
    spare = true;
    add(local);
  }
  timer = setTimeout(fallback, WAIT);
  add(CDN + VERSION + '/dist/lumen_card.js?v=' + BUILD, function () {
    if (window.lumen_card_plugin) clearTimeout(timer);
    else fallback();
  }, fallback);
})();

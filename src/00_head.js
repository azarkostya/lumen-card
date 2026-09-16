/*!
 * Lumen Card — плагин карточки фильма/сериала для Lampa. Строгий ES5.
 */
(function () {
  'use strict';
  if (typeof window !== 'undefined' && window.lumen_card_plugin) return;
  if (typeof window !== 'undefined') window.lumen_card_plugin = true;

  var LC = {};
  if (typeof window !== 'undefined') window.lumen_card = LC;
  LC.VERSION = '0.2.0';

  /* Адрес каталога подборок на хостинге (Task 20). Репозиторий отдаётся
     GitHub Pages с ветки feat/lumen-v2, корнем, поэтому manifest.json из
     корня репозитория доступен по этому адресу (проверено curl: 200,
     Content-Type application/json). Плагин тянет каталог отсюда сам,
     кэширует 12 ч в Lampa.Storage и падает на встроенный DEFAULT, если
     сети нет или ответ не проходит validate (src/42_manifest.js).
     Пользователь может подставить свой адрес настройкой lumen_manifest_url
     (src/81_prefs.js) — она имеет приоритет над этим значением. */
  LC.MANIFEST_URL = 'https://azarkostya.github.io/lumen-card/manifest.json';

  var PLUGIN = 'lumen_card';

  /* Тихий лог в консоль — ошибка в отрисовке не должна ронять плагин. */
  function warn(msg, err) {
    try { if (typeof window !== 'undefined' && window.console && console.log) console.log('[lumen-card] ' + msg, err || ''); } catch (e) { }
  }

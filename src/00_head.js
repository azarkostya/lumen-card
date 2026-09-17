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

  /* Экран накрыт непрозрачным слоем самого плагина — сейчас это заставка
     ambient (src/54_ambient.js), она и выставляет признак. Пока он поднят,
     всё, что рисует ПОД слоем, обязано стоять: частицы (src/52_fx.js) и
     ротация кадров карточки (src/51_slideshow.js) спрашивают признак и
     пропускают работу — план Task 22 Step 3: «пока слой активен, слайдшоу
     карточки и частицы на паузе». Признак живёт здесь, а не в самом
     ambient, по двум причинам: потребителям незачем знать, КТО накрыл
     экран, и в сборке 51/52 идут раньше 54 — зависимости на модуль,
     которого в их тестах нет, не возникает. */
  var covered = false;
  LC.covered = function () { return covered; };
  LC.setCovered = function (value) { covered = !!value; };

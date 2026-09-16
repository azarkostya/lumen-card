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

  /* URL хостинга манифеста подборок. Пусто — используется встроенный DEFAULT.
     Заполнится, когда появится хостинг; пользователь может переопределить
     через настройку lumen_manifest_url (src/80_settings.js). */
  LC.MANIFEST_URL = '';

  var PLUGIN = 'lumen_card';

  /* Тихий лог в консоль — ошибка в отрисовке не должна ронять плагин. */
  function warn(msg, err) {
    try { if (typeof window !== 'undefined' && window.console && console.log) console.log('[lumen-card] ' + msg, err || ''); } catch (e) { }
  }

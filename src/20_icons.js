  /* -------------------------------------------------------------------- */
  /* Единый набор иконок кнопок карточки: 24×24, stroke 1.8, round caps.   */
  /* Иконки подменяются ТОЛЬКО через CSS-маску (:before + mask-image) —    */
  /* outerHTML кнопок не меняется нигде (ни здесь, ни в шаблоне/рантайме): */
  /* от него зависит хэш приоритетной кнопки, см. план 0.2 «Кнопки и хэш   */
  /* приоритета». Модуль не трогает DOM и не знает о window/Lampa.        */
  /* -------------------------------------------------------------------- */

  LC.icons = (function () {
    var P = {
      // пути 1:1 из экрана 11 «Icons» файла design/Lumen Card for Lampa - FHD.dc.html
      play:     '<path d="M8 5l11 7-11 7V5z"/>',
      trailer:  '<path d="M3 7.5h18v11.5H3z"/><path d="M3 7.5L6.5 3h11L14 7.5"/><path d="M10 11.5l4.5 2.5-4.5 2.5v-5z"/>',
      bookmark: '<path d="M7 3h10v18l-5-4-5 4V3z"/>',
      torrent:  '<path d="M12 3v11"/><path d="M7.5 9.5L12 14l4.5-4.5"/><path d="M4 19h16"/>',
      reaction: '<path d="M7 10.5V20H4v-9.5h3z"/><path d="M7 10.5l4-6.5a2 2 0 013 2.4l-.8 4.1h5a2 2 0 011.95 2.45l-1.3 5.6A2 2 0 0116.9 20H7"/>',
      bell:     '<path d="M18 16v-5a6 6 0 10-12 0v5l-2 3h16l-2-3z"/><path d="M10 22h4"/>',
      more:     '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
      list:     '<path d="M9 6h11M9 12h11M9 18h7"/><circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none"/>',
      comment:  '<path d="M21 15a3 3 0 01-3 3H8l-5 4V6a3 3 0 013-3h12a3 3 0 013 3v9z"/>',
      star:     '<path d="M12 4l2.4 5 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8L12 4z"/>',
      clock:    '<circle cx="12" cy="12" r="8.4"/><path d="M12 7.6V12l3 2"/>',
      film:     '<path d="M3 4.5h18v15H3z"/><path d="M7.5 4.5v15M16.5 4.5v15M3 12h18"/>',
      chevronR: '<path d="M9 6l6 6-6 6"/>',
      close:    '<path d="M6 6l12 12M18 6L6 18"/>',
      // Task 32: экраны 34/35 файла design/Lumen Torrents for Lampa - FHD.dc.html
      search:   '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
      check:    '<path d="M4.5 12.5l5 5L20 6.5"/>'
    };
    var byButton = { 'button--play': 'play', 'button--book': 'bookmark', 'button--reaction': 'reaction', 'button--subscribe': 'bell', 'button--options': 'more', 'view--torrent': 'torrent', 'view--trailer': 'trailer' };
    function get(name) {
      var paint = (name === 'play' || name === 'more') ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return '<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" ' + paint + '>' + P[name] + '</svg>';
    }
    function names() { var r = []; for (var k in P) if (P.hasOwnProperty(k)) r.push(k); return r; }
    function forButton(cls) { return byButton[cls] || null; }
    // Отдельный svg для CSS-маски: цвет не важен (маска берёт альфу), currentColor в data-URI не работает — ставим #000
    function maskSvg(name) {
      var paint = (name === 'play' || name === 'more') ? 'fill="#000"' : 'fill="none" stroke="#000" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" ' + paint + '>' + P[name].replace(/currentColor/g, '#000') + '</svg>';
    }
    function maskUrl(name) {
      return 'url("data:image/svg+xml;charset=utf-8,' + encodeURIComponent(maskSvg(name)) + '")';
    }
    // Иконки кнопок заменяются ТОЛЬКО через CSS: outerHTML кнопок не меняется (хэш приоритета, см. план 0.2).
    // Селекторы по классу покрывают и клон .button--priority, и кнопки, вставленные другими плагинами позже.
    function css() {
      var rules = [], fallback = [], sel, k, name;
      var map = {};
      for (k in byButton) if (byButton.hasOwnProperty(k)) map['.' + k] = byButton[k];
      map['[class*="view--online"]'] = 'play'; // Online Mod и аналоги: .view--online_mod, .view--online
      for (sel in map) {
        if (!map.hasOwnProperty(sel)) continue;
        name = map[sel];
        var btn = '.lumen-card .full-start__button' + sel;
        rules.push(btn + ' > svg{display:none !important}');
        rules.push(btn + ':before{content:"";display:block;-webkit-flex-shrink:0;flex-shrink:0;width:1.625em;height:1.625em;background-color:currentColor;-webkit-mask-image:' + maskUrl(name) + ';mask-image:' + maskUrl(name) + ';-webkit-mask-repeat:no-repeat;mask-repeat:no-repeat;-webkit-mask-position:center;mask-position:center;-webkit-mask-size:contain;mask-size:contain}');
        // Фолбэк — ТЕМ ЖЕ селектором btn (та же специфичность, что у правил выше):
        // иначе при равном !important побеждает более специфичное основное правило
        // (.lumen-card .full-start__button.button--play > svg — 3 класса) и фолбэк
        // с общим селектором (.lumen-card .full-start__button > svg — 2 класса)
        // никогда не выигрывает каскад, оставаясь мёртвым кодом.
        fallback.push(btn + ' > svg{display:block !important}');
        fallback.push(btn + ':before{display:none !important}');
      }
      // Движок без поддержки CSS-масок (старые WebOS/Tizen): вместо пустого
      // закрашенного прямоугольника от :before показываем исходный svg кнопки.
      // !important на :before и совпадающий с основным правилом селектор на svg
      // гарантируют победу фолбэка независимо от порядка вставки CSS в документ.
      rules.push(NO_MASK + '{' + fallback.join('') + '}');
      return rules.join('\n');
    }
    /* Условие фолбэка «движок без CSS-масок» — общее с src/65_torrents.js. */
    var NO_MASK = '@supports not ((-webkit-mask-image:none) or (mask-image:none))';
    return { get: get, names: names, forButton: forButton, maskSvg: maskSvg, maskUrl: maskUrl, css: css, NO_MASK: NO_MASK };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.icons;

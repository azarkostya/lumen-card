  /* -------------------------------------------------------------------- */
  /* Прогресс просмотра.                                                   */
  /* view/hash — функции-обёртки, передаются параметрами (в рантайме это    */
  /* обёртки над Lampa.Timeline.view и Lampa.Utils.hash), поэтому модуль    */
  /* не зависит от window/Lampa и проверяется тестами без браузера.         */
  /* -------------------------------------------------------------------- */

  LC.progress = (function () {
    function movieProgress(movie, view, hash) {
      var key = movie.original_title || movie.original_name || movie.title || movie.name;
      if (!key) return null;
      var v = view(hash(key));
      if (v && v.percent > 0) return { view: v, season: 0, episode: 0 };
      return null;
    }

    function serialProgress(movie, view, hash) {
      var key = movie.original_name || movie.original_title || movie.name || movie.title;
      if (!key) return null;

      var maxSeason = parseInt(movie.number_of_seasons, 10) || 1;
      if (maxSeason > 10) maxSeason = 10;
      if (maxSeason < 1) maxSeason = 1;

      var best = null;
      for (var s = 1; s <= maxSeason; s++) {
        for (var ep = 1; ep <= 30; ep++) {
          var h = hash([s, s > 10 ? ':' : '', ep, key].join(''));
          var v = view(h);
          if (v && v.percent > 0) {
            if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
              best = { view: v, season: s, episode: ep };
            }
          }
        }
      }
      return best;
    }

    return {
      movieProgress: movieProgress,
      serialProgress: serialProgress
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;

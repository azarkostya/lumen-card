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

    /* Task 5c Step 1: состояние карточки серии в ряду сезона (design-spec §9,
       экран 05). view — Lampa.Timeline.view(хэш серии) или null; airDate —
       'YYYY-MM-DD'; runtimeMin — хронометраж серии, запасной источник «осталось
       N мин», если в записи Timeline нет duration. Просмотр важнее даты:
       ≥ 95 % — просмотрена, > 0 — смотрите. Не начатая — вышла (дата сегодня
       или в прошлом, по календарным дням) или нет (дата в будущем либо её нет
       вовсе: TMDB не даёт air_date только не объявленным сериям). */
    function episodeState(view, airDate, now, runtimeMin) {
      var percent = view ? Number(view.percent) || 0 : 0;
      if (percent >= 95) return { state: 'watched' };
      if (percent > 0) {
        var leftMin = null;
        if (view.duration > 0) leftMin = Math.max(1, Math.floor((view.duration - (view.time || 0)) / 60));
        else if (runtimeMin > 0) leftMin = Math.max(1, Math.round(runtimeMin * (100 - percent) / 100));
        /* Ревью (п.9): percent < 0.5 округлился бы в «0 %» — у начатой серии
           показываем минимум 1 %. */
        return { state: 'watching', percent: Math.max(1, Math.round(percent)), leftMin: leftMin };
      }
      var days = LC.util.daysUntil(airDate, now);
      return { state: days === null || days > 0 ? 'soon' : 'aired' };
    }

    return {
      movieProgress: movieProgress,
      serialProgress: serialProgress,
      episodeState: episodeState
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;

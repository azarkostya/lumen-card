  /* -------------------------------------------------------------------- */
  /* Прогресс просмотра.                                                   */
  /* view/hash — функции-обёртки, передаются параметрами (в рантайме это    */
  /* обёртки над Lampa.Timeline.view и Lampa.Utils.hash), поэтому модуль    */
  /* не зависит от window/Lampa и проверяется тестами без браузера.         */
  /* -------------------------------------------------------------------- */

  LC.progress = (function () {
    /* Task 8: порог «досмотрено». Тот же, что у episodeState ниже (Task 5c):
       карточка серии в ряду и строка «Продолжить» обязаны сходиться —
       серия, помеченная галочкой, продолжаться не может. */
    var WATCHED = 95;

    /* Хэш серии — формула плана 0.2 (Lampa.Timeline.watchedEpisode и online_mod):
       разделитель ':' только у сезонов больше 10, иначе S1E23 и S12E3 дали бы
       одну строку "123…". */
    function episodeHash(season, episode, key, hash) {
      return hash([season, season > 10 ? ':' : '', episode, key].join(''));
    }

    function percentOf(v) {
      return v ? Number(v.percent) || 0 : 0;
    }

    function movieProgress(movie, view, hash) {
      var key = movie.original_title || movie.original_name || movie.title || movie.name;
      if (!key) return null;
      var v = view(hash(key));
      if (v && v.percent > 0 && v.percent < WATCHED) return { view: v, season: 0, episode: 0 };
      return null;
    }

    /* Task 8: последний сезон (e.data.episodes.episodes — Lampa кладёт туда
       серии ТОЛЬКО последнего сезона, API_NOTES_3) важнее общего перебора:
       это тот самый сезон, чей ряд показан на карточке, и только там есть
       названия и длительности серий для подписи.
       Возвращает {found, touched}: touched — в этом сезоне есть хоть одна
       начатая или досмотренная серия. Сезон досмотрен до конца -> found null
       при touched true: продолжать нечего, и падать на прошлые сезоны не
       нужно (поправка Task 8: «иначе не показывать»). */
    /* Ревью Task 8 (п.1): в e.data.episodes.episodes лежит ВЕСЬ последний
       сезон, включая ещё не вышедшие серии (ряд рисует им состояние 'soon').
       Предлагать «Продолжить S2 E4» на серию, которой нет в природе, нельзя —
       рядом на той же карточке стоит чип «Следующая серия — 17 декабря», и это
       прямое противоречие на экране.

       Ревью 2 (п.1): проверять КАЖДУЮ серию по её собственной дате оказалось
       мало. У старых сериалов, аниме и доп. серий пробелы в air_date обычны, и
       серия без даты ПОСЕРЕДИНЕ вышедшего сезона выглядела как «не вышла» —
       «Продолжить» перескакивало через неё на следующую (спойлер: зритель не
       видел пропущенную серию вовсе). Поэтому граница эфира считается один раз
       на сезон: индекс ПОСЛЕДНЕЙ серии с датой не в будущем. Всё до неё
       включительно вышло — даже если у отдельных серий даты нет; всё после —
       ещё нет. Главный сценарий (Returning Series: хвост сезона анонсирован)
       работает как прежде, а дыра в данных больше не вызывает перескок.
       Дни календарные, через тот же LC.util.daysUntil, что у episodeState. */
    function lastAiredIndex(episodes, now) {
      var last = -1;
      for (var i = 0; i < episodes.length; i++) {
        var days = episodes[i] ? LC.util.daysUntil(episodes[i].air_date, now) : null;
        if (days !== null && days <= 0) last = i;
      }
      return last;
    }

    function fromEpisodes(key, episodes, view, hash, now) {
      var best = null, afterDone = null, done = false, touched = false;
      var airedTo = lastAiredIndex(episodes, now);
      for (var i = 0; i < episodes.length; i++) {
        var ep = episodes[i];
        if (!ep || !(ep.episode_number > 0)) continue;
        var season = parseInt(ep.season_number, 10) || 0;
        if (!season) continue;

        var v = view(episodeHash(season, ep.episode_number, key, hash));
        var percent = percentOf(v);

        if (percent >= WATCHED) {
          /* Досмотренная сбрасывает кандидата «следующая»: продолжать надо с
             серии ПОСЛЕ последней досмотренной, а не после первой. */
          done = true;
          touched = true;
          afterDone = null;
        } else if (percent > 0) {
          touched = true;
          if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
            best = { view: v, season: season, episode: ep.episode_number };
          }
        } else if (done && !afterDone && i <= airedTo) {
          afterDone = { view: v || { percent: 0 }, season: season, episode: ep.episode_number };
        }
      }
      return { found: best || afterDone, touched: touched };
    }

    /* Запасной путь, когда серий последнего сезона в данных нет (карточка ещё
       не догрузила e.data.episodes) или сезон не тронут вовсе: перебор ≤10
       сезонов × ≤30 серий, выбор по updated. Перейти к следующей серии здесь
       нельзя — без списка серий неизвестно, существует ли она. */
    function scanAll(key, movie, view, hash) {
      var maxSeason = parseInt(movie.number_of_seasons, 10) || 1;
      if (maxSeason > 10) maxSeason = 10;
      if (maxSeason < 1) maxSeason = 1;

      var best = null;
      for (var s = 1; s <= maxSeason; s++) {
        for (var ep = 1; ep <= 30; ep++) {
          var v = view(episodeHash(s, ep, key, hash));
          if (v && v.percent > 0 && v.percent < WATCHED) {
            if (!best || (v.updated || 0) >= (best.view.updated || 0)) {
              best = { view: v, season: s, episode: ep };
            }
          }
        }
      }
      return best;
    }

    /* episodes и now — необязательные: серии последнего сезона
       (e.data.episodes.episodes) и момент отсчёта для проверки «серия вышла»
       (Date или мс; по умолчанию текущий), как у episodeState. */
    function serialProgress(movie, view, hash, episodes, now) {
      var key = movie.original_name || movie.original_title || movie.name || movie.title;
      if (!key) return null;

      if (episodes && episodes.length) {
        var last = fromEpisodes(key, episodes, view, hash, now);
        if (last.found || last.touched) return last.found;
      }
      return scanAll(key, movie, view, hash);
    }

    function episodeOf(episodes, season, episode) {
      if (!episodes) return null;
      for (var i = 0; i < episodes.length; i++) {
        var ep = episodes[i];
        if (ep && (parseInt(ep.season_number, 10) || 0) === season && ep.episode_number === episode) return ep;
      }
      return null;
    }

    /* Task 8: подпись строки «Продолжить» слева от таймкода (design-spec §6,
       экран 05): «S2 E3 «Голова»». Название — из episodes, без них остаётся
       «S2 E3». У серии, к которой только предстоит перейти (percent 0, своего
       таймкода у неё нет), вместо него — длительность из episodes: «S2 E4
       «Гуль» · 61 мин», ровно как в подписи карточки серии в ряду.
       Фильм (season 0) подписи не имеет — по §6 у него в строке только
       таймкод и процент. Модуль остаётся чистым: единица измерения приходит
       словарём words, как у LC.cardinfo.nextEpisode. Экранирование — дело
       рендера (в CSS-строку подпись уходит через cssString, 85_header.js). */
    function label(found, episodes, words) {
      if (!found || !found.season) return '';
      var out = 'S' + found.season + ' E' + found.episode;
      var ep = episodeOf(episodes, found.season, found.episode);
      if (ep && ep.name) out += ' «' + ep.name + '»';
      if (!percentOf(found.view) && ep && ep.runtime > 0 && words && words.min) {
        out += ' · ' + ep.runtime + ' ' + words.min;
      }
      return out;
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
      if (percent >= WATCHED) return { state: 'watched' };
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
      episodeState: episodeState,
      label: label
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.progress;

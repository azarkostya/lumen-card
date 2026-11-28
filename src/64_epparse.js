  /* Разбор только явных диапазонов. Число сезона без номеров серий
     не даёт права считать раздачу полной. */
  LC.epparse = (function () {
    var SEASON_RANGES = [
      [/(?:^|[\s[(])(\d{1,2})\s*сезон\s*:\s*(\d{1,3})\s*-\s*(\d{1,3})\s+серии?\s+из\s+(\d{1,3})\s*(?=[\])])/gi, 0],
      [/(?:^|[\s[(])(\d{1,2})\s*сезон\s*\(\s*(\d{1,3})\s*-\s*(\d{1,3})\s+из\s+(\d{1,3})\s*\)/gi, 0],
      [/(?:^|[\s/[(])сезон\s*:?\s*(\d{1,2})\s*\/\s*серии\s*:?\s*(\d{1,3})\s*-\s*(\d{1,3})\s+из\s+(\d{1,3})(?!\d)/gi, 0],
      [/\(\s*(\d{1,2})\s*сезон\s*\)\s*\[\s*\+\s*(\d{1,3})\s*серия\s*\]/gi, 1],
      [/(?:^|[\s._/[(])s(\d{1,2})e(\d{1,3})(?:\s*-\s*e?(\d{1,3}))?(?![\w]|\s*-\s*(?:s|e)?\d)/gi, 0],
      [/(?:^|[\s._/[(])(\d{1,2})x(\d{1,3})(?:\s*-\s*(\d{1,3}))?(?![\w]|\s*-\s*\d)/gi, 0]
    ];
    var SEASON_SPAN = /(?:^|[\s._/[(])(\d{1,2})\s*-\s*(\d{1,2})x(\d{1,3})\s*-\s*(\d{1,3})(?:\s+из\s+(\d{1,3}))?(?![\w]|\s*-\s*\d)/gi;
    /* «(1-6 сезоны: 1-36 серии из 36)» — та же сквозная запись словами. */
    var SEASON_SPAN_WORDS = /(?:^|[\s/[(])(\d{1,2})\s*-\s*(\d{1,2})\s*сезон[а-я]*\s*:\s*(\d{1,3})\s*-\s*(\d{1,3})\s+сери[а-я]*\s+из\s+(\d{1,3})(?!\d)/gi;
    var EPISODES_ONLY = /[[(]\s*(\d{1,3})(?:\s*-\s*(\d{1,3}))?\s+из\s+(\d{1,3})\s*[\])]/gi;
    var SEASONS_ONLY = /\[\s*s(\d{1,2})(?:\s*-\s*s?(\d{1,2}))?\s*\]/gi;

    function result(seasons, first, last, total) {
      return { seasons: seasons, from: first, to: last, total: total, single: first > 0 && first === last, known: first > 0 };
    }

    function empty() {
      return result([], 0, 0, 0);
    }

    function seasonsBetween(start, end) {
      var seasons = [];
      for (var s = start; s <= end; s++) seasons.push(s);
      return seasons;
    }

    function parse(title) {
      if (typeof title !== 'string') return empty();
      title = title.replace(/[\u2010-\u2015\u2212]/g, '-');
      var found = null;
      var invalid = false;
      function add(seasons, first, last, total) {
        if (!first || last < first || (total !== null && total < last)) {
          invalid = true;
          return;
        }
        if (found && (found.seasons.join(',') !== seasons.join(',') || found.from !== first || found.to !== last ||
            (found.total && total && found.total !== total))) {
          invalid = true;
          return;
        }
        found = result(seasons, first, last, total || (found && found.total) || 0);
      }
      /* Сезоны и серии в сквозной записи — общие диапазоны, без
         соответствия «сезон → серии». Скрываем этот кусок от одиночного x. */
      function span(text, start, end, first, last, total) {
        if (!+start || +start >= +end) invalid = true;
        else add(seasonsBetween(+start, +end), +first, +last, total ? +total : null);
        return ' ';
      }
      title = title.replace(SEASON_SPAN, span);
      title = title.replace(SEASON_SPAN_WORDS, span);
      for (var i = 0; i < SEASON_RANGES.length; i++) {
        var rule = SEASON_RANGES[i];
        rule[0].lastIndex = 0;
        var m;
        while ((m = rule[0].exec(title))) {
          if (!+m[1]) { invalid = true; continue; }
          add([+m[1]], rule[1] ? 1 : +m[2], +(m[3] || m[2]), m[4] ? +m[4] : null);
        }
      }
      if (invalid) return empty();
      if (found) return found;
      EPISODES_ONLY.lastIndex = 0;
      while ((m = EPISODES_ONLY.exec(title))) add([], +m[1], +(m[2] || m[1]), +m[3]);
      if (invalid) return empty();
      if (found) return found;
      SEASONS_ONLY.lastIndex = 0;
      m = SEASONS_ONLY.exec(title);
      if (!m || SEASONS_ONLY.exec(title)) return empty();
      var start = +m[1];
      var end = +(m[2] || m[1]);
      if (!start || start > end) return empty();
      return result(seasonsBetween(start, end), 0, 0, 0);
    }

    /* Несколько сезонов со сквозным счётом серий: какая серия в каком
       сезоне, неизвестно. Даже полный набор («1-12 из 12») не ручается:
       «из 12» — счёт на дату раздачи. Вышла новая S2E7 — старый пакет
       её не содержит, а сквозные числа этого не выдают. Пакет остаётся
       подходящим по сезону (диапазон виден), но серия не подтверждена. */
    function verdict(parsed, target) {
      if (!parsed || !parsed.known || !target || !(target.season > 0) || !(target.episode > 0)) return 'unknown';
      if (parsed.seasons.length > 1) {
        return parsed.seasons.indexOf(Number(target.season)) === -1 ? 'other_season' : 'unknown';
      }
      if (parsed.seasons.length !== 1) return 'unknown';
      if (parsed.seasons.indexOf(Number(target.season)) === -1) return 'other_season';
      if (target.episode > parsed.to) return 'upto';
      if (target.episode >= parsed.from) return 'has';
      return 'unknown';
    }

    return { parse: parse, verdict: verdict };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.epparse;

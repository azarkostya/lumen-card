/* -------------------------------------------------------------------- */
  /* LC.personal — персональные ряды на главной:                            */
  /*   «Досмотреть», «Потому что вы смотрели «X»»,                          */
  /*   «Новые серии ваших сериалов», «Скоро на экранах»                     */
  /*                                                                       */
  /* Публичное API (чистые функции):                                        */
  /*   pickBecause(history, n) → [{id, media, title}]                       */
  /*   newEpisodes(shows, today) → [{…show, lumen_badge}]                    */
  /*   soonRange(today) → {gte, lte}                                        */
  /*                                                                       */
  /* Публичное API (runtime, требуют Lampa):                                */
  /*   bumpGen() — поднимает поколение главной; вызвать при уходе с главной */
  /*   register() — строит и регистрирует ряды через ContentRows.add        */
  /*   unregister() — снимает ряды через ContentRows.remove                  */
  /*                                                                       */
  /* Отмена запросов: сторож поколения _gen — тот же паттерн, что в        */
  /* LC.rows. bumpGen() поднимает _gen при уходе с главной; каждый          */
  /* in-flight колбэк проверяет alive() перед обновлением UI.              */
  /*                                                                       */
  /* Снятие рядов: _addedRows + ContentRows.remove — тот же паттерн,       */
  /* что в LC.rows. doUnregister() вызывается из register() и unregister(). */
  /*                                                                       */
  /* Цена запросов: «Потому что вы смотрели» — не более BECAUSE_LIMIT (2)  */
  /* исходных карточек; «Новые серии» — не более SHOWS_LIMIT (12) сериалов. */
  /* Кэш рекомендаций: life 1440 мин; деталей TV: life 720 мин.            */
  /* «Скоро» — discover/movie + discover/tv: life 360 мин.                 */
  /*                                                                       */
  /* Безопасность при отсутствии данных: каждый ряд проверяет наличие      */
  /* источника (Favorite, история) и не регистрируется, если данных нет.   */
  /* «Скоро» регистрируется всегда — данные пользователя не нужны.         */
  /* -------------------------------------------------------------------- */

  LC.personal = (function () {

    /* Порог «досмотрено» — тот же что в LC.rows (95%). */
    var WATCHED = 95;

    /* Максимум исходных карточек для «Потому что вы смотрели». */
    var BECAUSE_LIMIT = 2;

    /* Максимум сериалов для «Новые серии». */
    var SHOWS_LIMIT = 12;

    /* Окно «скоро» — 30 дней вперёд. */
    var SOON_DAYS = 30;

    /* Новая серия: вышла не более RECENT_DAYS назад. */
    var RECENT_DAYS = 14;

    /* Новая серия: следующая выйдет через не более UPCOMING_DAYS. */
    var UPCOMING_DAYS = 7;

    /* Поколение главной. bumpGen() поднимает его при уходе с главной. */
    var _gen = 0;

    /* Дескрипторы, переданные в ContentRows.add при последней register(). */
    var _addedRows = [];

    /* ------------------------------------------------------------------ */
    /* Чистые функции (без Lampa, без DOM).                               */
    /* ------------------------------------------------------------------ */

    /* Возвращает последние n уникальных карточек из history с известными id.
       history — массив карточек (объекты TMDB), читается от конца (свежие).
       Результат: [{id, media, title}], где media = 'movie' | 'tv'. */
    function pickBecause(history, n) {
      if (!history || !history.length || n <= 0) return [];
      var seen = {};
      var out = [];
      for (var i = history.length - 1; i >= 0 && out.length < n; i--) {
        var c = history[i];
        if (!c || c.id == null) continue;
        if (seen[c.id]) continue;
        seen[c.id] = 1;
        out.push({
          id: c.id,
          /* Сериал у Lampa имеет поле name, фильм — только title. */
          media: c.name ? 'tv' : 'movie',
          title: c.title || c.name || ''
        });
      }
      return out;
    }

    /* Форматирует Date в строку 'YYYY-MM-DD' (UTC-дата). */
    function dateFmt(d) {
      var y = d.getUTCFullYear();
      var m = d.getUTCMonth() + 1;
      var day = d.getUTCDate();
      return y + '-' + (m < 10 ? '0' + m : '' + m) + '-' + (day < 10 ? '0' + day : '' + day);
    }

    /* Возвращает {gte, lte} — диапазон дат для «Скоро»:
       gte = today, lte = today + SOON_DAYS.
       today — Date, строка 'YYYY-MM-DD' или null (текущая дата UTC). */
    function soonRange(today) {
      var d0;
      if (today instanceof Date) {
        d0 = today;
      } else if (today && typeof today === 'string') {
        var parts = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
        d0 = parts ? new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3])) : new Date();
      } else {
        d0 = new Date();
      }
      var d1 = new Date(d0.getTime() + SOON_DAYS * 86400000);
      return { gte: dateFmt(d0), lte: dateFmt(d1) };
    }

    /* Разбирает строку 'YYYY-MM-DD' в UTC-миллисекунды. NaN при ошибке. */
    function parseDate(s) {
      if (!s || typeof s !== 'string') return NaN;
      var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) return NaN;
      return Date.UTC(+m[1], +m[2] - 1, +m[3]);
    }

    /* Короткое обозначение даты «DD мес» для badge. Месяц берётся из
       LC.lang('lumen_card_months_short') — тот же словарь, что у чипа серии. */
    function shortDate(ms) {
      var d = new Date(ms);
      var day = d.getUTCDate();
      var monthIdx = d.getUTCMonth();
      var monthsRaw = '';
      try { monthsRaw = LC.lang ? LC.lang('lumen_card_months_short') : ''; } catch (e) {}
      var months = monthsRaw ? monthsRaw.split(',') : [];
      var mon = months[monthIdx] || (monthIdx + 1 < 10 ? '0' + (monthIdx + 1) : '' + (monthIdx + 1));
      return day + ' ' + mon;
    }

    /* Фильтрует список сериалов с деталями TMDB: оставляет те, у которых
       last_episode_to_air.air_date <= now и (now - air_date) <= RECENT_DAYS,
       или next_episode_to_air.air_date > now и (air_date - now) <= UPCOMING_DAYS.
       Добавляет поле lumen_badge («Новая серия · 12 сен» или «Через N дней»).
       today — Date, строка 'YYYY-MM-DD' или null (текущее время). */
    function newEpisodes(shows, today) {
      var nowMs;
      if (today instanceof Date) {
        nowMs = today.getTime();
      } else if (today && typeof today === 'string') {
        var parsed = parseDate(today);
        nowMs = isNaN(parsed) ? Date.now() : parsed;
      } else {
        nowMs = Date.now();
      }

      var out = [];
      for (var i = 0; i < shows.length; i++) {
        var s = shows[i];
        if (!s) continue;
        var lastAir = s.last_episode_to_air;
        var nextAir = s.next_episode_to_air;
        var lastMs = parseDate(lastAir && lastAir.air_date);
        var nextMs = parseDate(nextAir && nextAir.air_date);
        var badge = '';

        if (!isNaN(lastMs) && lastMs <= nowMs && (nowMs - lastMs) <= RECENT_DAYS * 86400000) {
          var badgeLabel = '';
          try { badgeLabel = LC.lang ? LC.lang('lumen_badge_new_episode') : 'New episode'; } catch (e) { badgeLabel = 'New episode'; }
          badge = badgeLabel + ' · ' + shortDate(lastMs);
        } else if (!isNaN(nextMs) && nextMs > nowMs && (nextMs - nowMs) <= UPCOMING_DAYS * 86400000) {
          var diffDays = Math.ceil((nextMs - nowMs) / 86400000);
          var inLabel = '';
          try { inLabel = LC.lang ? LC.lang('lumen_badge_coming_in') : 'In'; } catch (e) { inLabel = 'In'; }
          var daysLabel = '';
          try { daysLabel = LC.daysWord ? LC.daysWord(diffDays) : (diffDays === 1 ? 'day' : 'days'); } catch (e) { daysLabel = 'days'; }
          badge = inLabel + ' ' + diffDays + ' ' + daysLabel;
        }

        if (badge) {
          /* Копируем объект, чтобы не мутировать входные данные. */
          var copy = {};
          for (var k in s) {
            if (Object.prototype.hasOwnProperty.call(s, k)) copy[k] = s[k];
          }
          copy.lumen_badge = badge;
          out.push(copy);
        }
      }

      /* Сортировка: свежие вышедшие (by last_episode air_date DESC) первыми;
         у которых нет last_episode — в конец. */
      out.sort(function (a, b) {
        var aMs = parseDate(a.last_episode_to_air && a.last_episode_to_air.air_date);
        var bMs = parseDate(b.last_episode_to_air && b.last_episode_to_air.air_date);
        if (!isNaN(aMs) && !isNaN(bMs)) return bMs - aMs;
        if (!isNaN(aMs)) return -1;
        if (!isNaN(bMs)) return 1;
        return 0;
      });
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Поколение главной: сторож отмены in-flight запросов.               */
    /* ------------------------------------------------------------------ */

    /* Поднимает _gen, делая все текущие alive()-функции вернуть false.
       Вызывается из LC.onActivityEvent при archive/destroy component='main'. */
    function bumpGen() {
      _gen++;
    }

    /* ------------------------------------------------------------------ */
    /* Снятие рядов через ContentRows.remove.                             */
    /* ------------------------------------------------------------------ */

    function doUnregister() {
      if (!_addedRows.length) return;
      for (var i = 0; i < _addedRows.length; i++) {
        try {
          if (window.Lampa && Lampa.ContentRows &&
              typeof Lampa.ContentRows.remove === 'function') {
            Lampa.ContentRows.remove(_addedRows[i]);
          }
        } catch (e) {}
      }
      _addedRows = [];
    }

    /* ------------------------------------------------------------------ */
    /* Runtime-утилиты (требуют Lampa.Favorite).                          */
    /* ------------------------------------------------------------------ */

    /* Объединяет continues('movie') и continues('tv'), снимает дубли по id.
       Возвращает [] если Lampa.Favorite или continues недоступны. */
    function continuesList() {
      var out = [];
      var seen = {};
      try {
        if (!window.Lampa || !Lampa.Favorite) return out;
        var medias = ['movie', 'tv'];
        for (var m = 0; m < medias.length; m++) {
          var arr = [];
          try {
            if (typeof Lampa.Favorite.continues === 'function') {
              arr = Lampa.Favorite.continues(medias[m]);
            }
          } catch (e) {}
          if (!Array.isArray(arr)) continue;
          for (var j = 0; j < arr.length; j++) {
            var c = arr[j];
            if (!c || c.id == null || seen[c.id]) continue;
            seen[c.id] = 1;
            out.push(c);
          }
        }
      } catch (e) {}
      return out;
    }

    /* Возвращает историю просмотров из Lampa.Favorite. */
    function getHistory() {
      try {
        if (!window.Lampa || !Lampa.Favorite) return [];
        var h = Lampa.Favorite.get({ type: 'history' });
        return Array.isArray(h) ? h : [];
      } catch (e) { return []; }
    }

    /* Возвращает уникальные сериалы из закладок и истории, до limit штук.
       Сериал определяется по наличию поля name (отсутствует у фильмов). */
    function getShows(limit) {
      var out = [];
      var seen = {};
      try {
        if (!window.Lampa || !Lampa.Favorite) return out;
        var sources = ['book', 'history'];
        for (var s = 0; s < sources.length; s++) {
          var arr = [];
          try { arr = Lampa.Favorite.get({ type: sources[s] }); } catch (e) {}
          if (!Array.isArray(arr)) continue;
          for (var j = 0; j < arr.length; j++) {
            var c = arr[j];
            if (!c || c.id == null || !c.name) continue;
            if (seen[c.id]) continue;
            seen[c.id] = 1;
            out.push(c);
            if (out.length >= limit) return out;
          }
        }
      } catch (e) {}
      return out;
    }

    /* Добавляет дескриптор ряда в ContentRows и сохраняет для doUnregister(). */
    function addRow(descriptor) {
      try {
        if (!window.Lampa || !Lampa.ContentRows) return;
        Lampa.ContentRows.add(descriptor);
        _addedRows.push(descriptor);
      } catch (e) {}
    }

    /* ------------------------------------------------------------------ */
    /* Фабрики call-функций для каждого ряда.                             */
    /* ------------------------------------------------------------------ */

    /* «Досмотреть»: continuesList() вызывается при каждом call, без сети. */
    function makeContinueCall() {
      return function (params, screen) {
        return function (call) {
          var gen = _gen;
          function alive() { return _gen === gen; }
          if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }
          var items = continuesList();
          if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }
          call({ results: items, title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching' });
          return { cancel: function () {} };
        };
      };
    }

    /* «Потому что вы смотрели «X»»:
       для каждой карточки из picked запрашивает recommendations через Lampa.
       picked захвачен при register() — это последние BECAUSE_LIMIT карточек истории. */
    function makeBecauseCall(picked, rowTitle) {
      return function (params, screen) {
        return function (call) {
          var gen = _gen;
          function alive() { return _gen === gen; }
          if (!alive() || !picked || !picked.length) {
            call({ results: [] }); return { cancel: function () {} };
          }
          var results = [];
          var pending = picked.length;
          var cancelled = false;
          var handles = [];

          function done() {
            if (cancelled || !alive()) return;
            call({ results: results, title: rowTitle });
          }

          for (var i = 0; i < picked.length; i++) {
            (function (card) {
              var url = card.media + '/' + card.id + '/recommendations';
              var net = null;
              try {
                net = Lampa.Api.sources.tmdb.get(
                  url,
                  { langs: 'ru-RU', filter: { page: 1 } },
                  function (json) {
                    if (!alive()) return;
                    var arr = (json && json.results) ? json.results : [];
                    for (var k = 0; k < arr.length; k++) results.push(arr[k]);
                    pending--;
                    if (pending === 0) done();
                  },
                  function () {
                    if (!alive()) return;
                    pending--;
                    if (pending === 0) done();
                  },
                  { life: 1440 }
                );
              } catch (e) {
                pending--;
                if (pending === 0 && alive() && !cancelled) done();
              }
              if (net) handles.push(net);
            })(picked[i]);
          }

          return {
            cancel: function () {
              cancelled = true;
              for (var i = 0; i < handles.length; i++) {
                try {
                  if (handles[i]) {
                    if (typeof handles[i].clear === 'function') handles[i].clear();
                    else if (typeof handles[i].abort === 'function') handles[i].abort();
                  }
                } catch (e) {}
              }
            }
          };
        };
      };
    }

    /* «Новые серии ваших сериалов»:
       для каждого сериала из shows запрашивает детали tv/{id} через Lampa,
       затем фильтрует через newEpisodes(). */
    function makeNewEpisodesCall(shows) {
      return function (params, screen) {
        return function (call) {
          var gen = _gen;
          function alive() { return _gen === gen; }
          if (!alive() || !shows || !shows.length) {
            call({ results: [] }); return { cancel: function () {} };
          }
          var details = [];
          var pending = shows.length;
          var cancelled = false;
          var handles = [];

          function done() {
            if (cancelled || !alive()) return;
            var filtered = newEpisodes(details, null);
            call({ results: filtered, title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes' });
          }

          for (var i = 0; i < shows.length; i++) {
            (function (card) {
              var url = 'tv/' + card.id;
              var net = null;
              try {
                net = Lampa.Api.sources.tmdb.get(
                  url,
                  { langs: 'ru-RU' },
                  function (json) {
                    if (!alive()) return;
                    if (json && json.id != null) details.push(json);
                    pending--;
                    if (pending === 0) done();
                  },
                  function () {
                    if (!alive()) return;
                    pending--;
                    if (pending === 0) done();
                  },
                  { life: 720 }
                );
              } catch (e) {
                pending--;
                if (pending === 0 && alive() && !cancelled) done();
              }
              if (net) handles.push(net);
            })(shows[i]);
          }

          return {
            cancel: function () {
              cancelled = true;
              for (var i = 0; i < handles.length; i++) {
                try {
                  if (handles[i]) {
                    if (typeof handles[i].clear === 'function') handles[i].clear();
                    else if (typeof handles[i].abort === 'function') handles[i].abort();
                  }
                } catch (e) {}
              }
            }
          };
        };
      };
    }

    /* «Скоро на экранах»: discover/movie + discover/tv с диапазоном дат.
       Оба запроса выполняются параллельно; результаты объединяются и
       сортируются по дате выхода (ближайшие первыми). */
    function makeSoonCall() {
      return function (params, screen) {
        return function (call) {
          var gen = _gen;
          function alive() { return _gen === gen; }
          if (!alive()) { call({ results: [] }); return { cancel: function () {} }; }

          var range = soonRange(null);
          var movies = [];
          var tvShows = [];
          var pending = 2;
          var cancelled = false;
          var handles = [];

          function done() {
            if (cancelled || !alive()) return;
            /* Чередуем фильмы и сериалы, сортируем по дате выхода. */
            var all = movies.concat(tvShows);
            all.sort(function (a, b) {
              var da = a.release_date || a.first_air_date || '';
              var db = b.release_date || b.first_air_date || '';
              return da < db ? -1 : da > db ? 1 : 0;
            });
            call({ results: all, title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon' });
          }

          function fetchDiscover(media, resultArr) {
            var filterKey = media === 'movie' ? 'primary_release_date' : 'first_air_date';
            var f = {};
            f[filterKey + '.gte'] = range.gte;
            f[filterKey + '.lte'] = range.lte;
            var net = null;
            try {
              net = Lampa.Api.sources.tmdb.get(
                'discover/' + media,
                { filter: f, sort_by: 'popularity.desc', langs: 'ru-RU' },
                function (json) {
                  if (!alive()) return;
                  var arr = (json && json.results) ? json.results : [];
                  for (var k = 0; k < arr.length; k++) resultArr.push(arr[k]);
                  pending--;
                  if (pending === 0) done();
                },
                function () {
                  if (!alive()) return;
                  pending--;
                  if (pending === 0) done();
                },
                { life: 360 }
              );
            } catch (e) {
              pending--;
              if (pending === 0 && alive() && !cancelled) done();
            }
            return net;
          }

          handles.push(fetchDiscover('movie', movies));
          handles.push(fetchDiscover('tv', tvShows));

          return {
            cancel: function () {
              cancelled = true;
              for (var i = 0; i < handles.length; i++) {
                try {
                  if (handles[i]) {
                    if (typeof handles[i].clear === 'function') handles[i].clear();
                    else if (typeof handles[i].abort === 'function') handles[i].abort();
                  }
                } catch (e) {}
              }
            }
          };
        };
      };
    }

    /* ------------------------------------------------------------------ */
    /* register() — снимает старые ряды и строит новые.                   */
    /* ------------------------------------------------------------------ */

    /* Регистрирует персональные ряды на главной через ContentRows.add.
       Вызывается из activate() в 90_runtime.js после LC.rows.register().
       Не регистрирует ряд, если нужные данные пользователя отсутствуют.
       Пользовательская настройка lumen_personal_rows=false отключает всё. */
    function register() {
      doUnregister();

      /* Проверка настройки включения персональных рядов. */
      var enabled = true;
      try { enabled = LC.pref ? LC.pref('lumen_personal_rows', true) : true; } catch (e) {}
      if (!enabled) return;

      /* «Досмотреть» (index 0): только если continues() вернул хотя бы 1 карточку. */
      try {
        var cont = continuesList();
        if (cont && cont.length) {
          addRow({
            name: 'lumen_continue',
            title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching',
            screen: 'main',
            index: 0,
            call: makeContinueCall()
          });
        }
      } catch (e) {}

      /* «Потому что вы смотрели «X»» (index 1): только если в истории ≥1 карточки.
         Заголовок включает название последней просмотренной карточки (именительный
         падеж — автоматическое склонение произвольного названия фильма нереализуемо
         без словаря). */
      try {
        var history = getHistory();
        var picked = pickBecause(history, BECAUSE_LIMIT);
        if (picked && picked.length) {
          var becauseTitle = LC.lang ? LC.lang('lumen_row_because') : 'Because you watched';
          if (picked[0] && picked[0].title) {
            becauseTitle += ' «' + picked[0].title + '»';
          }
          addRow({
            name: 'lumen_because',
            title: becauseTitle,
            screen: 'main',
            index: 1,
            call: makeBecauseCall(picked, becauseTitle)
          });
        }
      } catch (e) {}

      /* «Новые серии ваших сериалов» (index 2): только если есть сериалы
         в истории или закладках. */
      try {
        var shows = getShows(SHOWS_LIMIT);
        if (shows && shows.length) {
          addRow({
            name: 'lumen_new_episodes',
            title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes of your shows',
            screen: 'main',
            index: 2,
            call: makeNewEpisodesCall(shows)
          });
        }
      } catch (e) {}

      /* «Скоро на экранах» (index 3): не зависит от данных пользователя. */
      try {
        addRow({
          name: 'lumen_soon',
          title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon',
          screen: 'main',
          index: 3,
          call: makeSoonCall()
        });
      } catch (e) {}
    }

    /* Снимает все зарегистрированные персональные ряды. */
    function unregister() {
      doUnregister();
    }

    return {
      pickBecause: pickBecause,
      newEpisodes: newEpisodes,
      soonRange: soonRange,
      bumpGen: bumpGen,
      register: register,
      unregister: unregister
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.personal;

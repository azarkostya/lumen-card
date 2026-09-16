  /* -------------------------------------------------------------------- */
  /* LC.rows — регистрация рядов подборок на главной (ContentRows)          */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   rowName(id) → 'lumen_' + id                                          */
  /*   filterWatched(results, viewedIds, hide) → results[]                  */
  /*   homeRows(manifest, storedIds, month, limit) → collection[]           */
  /*   viewedIds() → number[] — runtime: IDs просмотренных (>= 95%)        */
  /*   register(manifest) — runtime: регистрирует ряды через ContentRows    */
  /*   unregister() — runtime: сбрасывает флаг регистрации                  */
  /*                                                                       */
  /* Отмена запросов: каждый ряд получает screen._alive от Lampa в call(); */
  /* Lampa сама вызывает cancel() при уходе с главной — handle.clear()     */
  /* немедленно отменяет in-flight запрос через LC.sources.                 */
  /*                                                                       */
  /* Ленивая загрузка: Lampa вызывает call() только при появлении ряда     */
  /* во viewport (механизм ContentRows.add). Флаг loaded предотвращает     */
  /* повторный запрос при повторном показе уже загруженного ряда.          */
  /*                                                                       */
  /* Одна регистрация: флаг _registered снимается только через unregister()*/
  /* (или при деактивации плагина). Повторный вызов register() — no-op.    */
  /* -------------------------------------------------------------------- */

  LC.rows = (function () {

    /* Флаг: ряды уже зарегистрированы. Повторный вызов register() — no-op. */
    var _registered = false;

    /* ------------------------------------------------------------------ */
    /* Чистые функции (без обращения к DOM, Lampa, Storage).               */
    /* ------------------------------------------------------------------ */

    /* Префиксированное имя ряда для ContentRows (должно быть уникальным).
       Префикс 'lumen_' исключает коллизии со штатными именами Lampa. */
    function rowName(id) {
      return 'lumen_' + id;
    }

    /* Фильтрует результаты: убирает позиции, чей id входит в viewedIds,
       только если hide=true. Если hide=false — возвращает results без изменений.
       Безопасно при null/undefined results и viewedIds. */
    function filterWatched(results, viewedIds, hide) {
      if (!results || !results.length) return [];
      if (!hide) return results;
      var ids = viewedIds && viewedIds.length ? viewedIds : null;
      if (!ids) return results;
      var seen = {};
      var i;
      for (i = 0; i < ids.length; i++) {
        if (ids[i] != null) seen[ids[i]] = 1;
      }
      var out = [];
      for (i = 0; i < results.length; i++) {
        if (!seen[results[i].id]) out.push(results[i]);
      }
      return out;
    }

    /* Формирует упорядоченный список объектов подборок для главной.
       storedIds: массив id — пользовательский список (не null/пустой → заменяет manifest.home).
       month: 1-12 — текущий месяц для сезонного порядка (null → без сдвига).
       limit: максимальное число рядов (<=0 → пусто; undefined/null → без обрезки).
       Неизвестные id (не найдены в collections) пропускаются. */
    function homeRows(manifest, storedIds, month, limit) {
      if (!manifest || !Array.isArray(manifest.collections)) return [];
      if (typeof limit === 'number' && limit <= 0) return [];

      /* Индекс подборок по id для быстрого поиска */
      var byId = {};
      var i;
      for (i = 0; i < manifest.collections.length; i++) {
        byId[manifest.collections[i].id] = manifest.collections[i];
      }

      /* Список id для главной: пользовательский (непустой) или manifest.home */
      var ids = (storedIds && storedIds.length) ? storedIds : (manifest.home || []);

      /* Собираем объекты, пропуская неизвестные id */
      var list = [];
      for (i = 0; i < ids.length; i++) {
        var item = byId[ids[i]];
        if (item) list.push(item);
      }

      /* Сезонный порядок: подборки с season[], содержащим month, наверх.
         Реализован встроенно (не вызывает LC.manifest), чтобы homeRows
         оставалась чистой функцией без внешних зависимостей. */
      if (month) {
        var seasonal = [];
        var rest = [];
        for (i = 0; i < list.length; i++) {
          var inSeason = false;
          if (list[i].season) {
            for (var j = 0; j < list[i].season.length; j++) {
              if (list[i].season[j] === month) { inSeason = true; break; }
            }
          }
          if (inSeason) { seasonal.push(list[i]); } else { rest.push(list[i]); }
        }
        list = seasonal.concat(rest);
      }

      /* Лимит */
      if (typeof limit === 'number' && limit < list.length) {
        list = list.slice(0, limit);
      }

      return list;
    }

    /* ------------------------------------------------------------------ */
    /* Runtime: требуют Lampa.Favorite, Lampa.Timeline.                    */
    /* ------------------------------------------------------------------ */

    /* Собирает IDs просмотренных карточек:
       - type:'viewed' из Lampa.Favorite
       - фильмы/сериалы с прогрессом >= 95% (Lampa.Timeline.view)
       Используется внутри call() при формировании ответа ряда. */
    function viewedIds() {
      var ids = [];
      try {
        if (window.Lampa && Lampa.Favorite) {
          var viewed = Lampa.Favorite.get({ type: 'viewed' });
          if (Array.isArray(viewed)) {
            for (var i = 0; i < viewed.length; i++) {
              if (viewed[i] && viewed[i].id != null) ids.push(viewed[i].id);
            }
          }
        }
      } catch (e) {}
      return ids;
    }

    /* ------------------------------------------------------------------ */
    /* register(manifest) — регистрирует ряды через Lampa.ContentRows.add  */
    /* ------------------------------------------------------------------ */

    /* Регистрирует ряды подборок на главной.
       Одна регистрация за жизнь плагина: повторный вызов — no-op.
       Ряды берутся из homeRows с настройками lumen_home_rows / lumen_rows_limit.
       Каждый ряд передаёт screen._alive (alive-guard поколения) в LC.sources.fetch,
       чтобы при уходе с главной отменить in-flight запрос. */
    function register(manifest) {
      if (_registered) return;
      _registered = true;

      /* Настройки: пользовательский список id и лимит */
      var storedRaw = '';
      try { storedRaw = LC.pref ? (LC.pref('lumen_home_rows', '') || '') : ''; } catch (e) {}
      var storedIds = storedRaw ? storedRaw.split(',').map(function (s) { return s.trim(); }).filter(Boolean) : null;

      var limitRaw = 15;
      try { limitRaw = LC.pref ? (parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15) : 15; } catch (e) {}

      /* Текущий месяц для сезонного порядка */
      var month = new Date().getMonth() + 1;

      var rows = homeRows(manifest, storedIds, month, limitRaw);

      for (var i = 0; i < rows.length; i++) {
        registerRow(rows[i], i);
      }
    }

    /* Регистрирует один ряд через ContentRows.add.
       index — позиция в списке рядов плагина (к нему прибавляется 1,
       чтобы не занимать позицию 0, которую обычно используют штатные ряды).
       call-функция возвращается фабрикой, чтобы item захватывался замыканием
       правильно (ES5: var в цикле не создаёт отдельного scope). */
    function registerRow(item, index) {
      try {
        if (!window.Lampa || !Lampa.ContentRows) return;

        /* Заголовок ряда: title из манифеста, badge через «·» если задан */
        var rowTitle = item.title;
        if (item.badge) rowTitle += ' · ' + item.badge;

        Lampa.ContentRows.add({
          name: rowName(item.id),
          title: rowTitle,
          screen: 'main',
          index: index + 1,
          call: makeCall(item)
        });
      } catch (e) {}
    }

    /* Фабрика call-функции для одного элемента.
       Lampa передаёт (params, screen) и ждёт функцию(call).
       screen._alive — alive-guard поколения главной: загрузчик проверяет его
       перед каждым следующим запросом и перед колбэком. */
    function makeCall(item) {
      return function (params, screen) {
        return function (call) {
          /* screen._alive — живая функция поколения Lampa.
             Если главная ушла в архив, живые функции вернут другой gen. */
          var alive = screen && typeof screen._alive === 'function' ? screen._alive : null;

          var handle = LC.sources['fetch'](
            item,
            1,
            function (json) {
              /* Фильтр досмотренных применяется прямо перед отдачей в Lampa */
              var hide = false;
              try { hide = LC.pref ? !!LC.pref('lumen_hide_watched', false) : false; } catch (eIgnore) {}
              var filtered = filterWatched(json.results, viewedIds(), hide);
              /* Пустые результаты: передаём как есть — Lampa ContentRows
                 сама решает, рисовать ряд или нет.
                 Если живьём окажется что пустой ряд ломает главную —
                 в notes зафиксировать и переключить на call(false). */
              call({ results: filtered, title: item.title });
            },
            function () {
              /* Ошибка загрузки: пустой ряд */
              call({ results: [] });
            },
            alive
          );

          /* Lampa вызовет cancel() при уходе с главной */
          return {
            cancel: function () {
              if (handle && handle.clear) handle.clear();
            }
          };
        };
      };
    }

    /* Сбрасывает флаг регистрации. Вызывается при деактивации плагина,
       чтобы следующий activate() снова зарегистрировал ряды. */
    function unregister() {
      _registered = false;
    }

    return {
      rowName: rowName,
      filterWatched: filterWatched,
      homeRows: homeRows,
      viewedIds: viewedIds,
      register: register,
      unregister: unregister
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;

  /* -------------------------------------------------------------------- */
  /* LC.rows — регистрация рядов подборок на главной (ContentRows)          */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   rowName(id) → 'lumen_' + id                                          */
  /*   filterWatched(results, viewedIds, hide) → results[]                  */
  /*   homeRows(manifest, storedIds, month, limit) → collection[]           */
  /*   rowChoices(manifest, pickedIds) → [{id, title, group, checked}]       */
  /*   storedIds() → runtime: сохранённый состав рядов или null             */
  /*   viewedIds(results?) → number[]                                        */
  /*   bumpGen() — runtime: поднимает поколение главной                     */
  /*   register(manifest) — runtime: регистрирует ряды через ContentRows    */
  /*   unregister() — runtime: снимает ряды через ContentRows.remove        */
  /*                                                                       */
  /* Отмена запросов: главную ВЫБРОСИЛИ — Lampa.Listener шлёт             */
  /* 'activity':{type:'destroy', component:'main'} → LC.onActivityEvent()  */
  /* → bumpGen() поднимает _homeGen. Событие 'archive' сюда НЕ входит: в   */
  /* Lampa 3.3.4 backward() шлёт start+archive той активности, к которой   */
  /* ВЕРНУЛИСЬ, то есть archive означает «снова на экране» (подробный      */
  /* разбор с ссылками на vendor/lampa/app.min.js — в src/90_runtime.js у  */
  /* LC.onActivityEvent). Уход вглубь (push) покидаемой главной не шлёт    */
  /* вообще ничего, поэтому отменять её запросы при push нечем и незачем.  */
  /* makeCall захватывает gen при вызове inner-функции; alive() сравнивает  */
  /* текущий _homeGen с захваченным gen. LC.sources.fetch проверяет alive.  */
  /*                                                                       */
  /* Контракт call-функции ряда: ровно ОДИН вызов call(...) при любом      */
  /* исходе — успех, ошибка, мёртвое поколение. Lampa грузит ряды пачками  */
  /* по parts_limit=6 через Progress (vendor/lampa/app.min.js, partNext /  */
  /* Progress): пачка завершается, только когда КАЖДАЯ её часть позвала    */
  /* свой call. Молчащий ряд навсегда останавливает достройку главной, а   */
  /* двойной вызов сбивает счётчик Progress. Держит контракт makeResolver. */
  /*                                                                       */
  /* Снятие рядов (C2-fix): register() перед регистрацией вызывает         */
  /* ContentRows.remove для дескрипторов предыдущего набора (doUnregister). */
  /* unregister() делает то же самое — из deactivate() в 90_runtime.js.    */
  /*                                                                       */
  /* Порядок загрузки: ContentRows.call('main', …) зовёт row.call(params,   */
  /* screen) сразу для ВСЕХ зарегистрированных рядов и складывает          */
  /* полученные функции в общий список частей; исполняются они пачками по  */
  /* 6, следующая пачка — по докрутке главной, а не по видимости ряда.      */
  /* -------------------------------------------------------------------- */

  LC.rows = (function () {

    /* Task 39 (решение, чтобы следующий не искал): постеры карточек НАШИХ
       рядов плагин не трогает и подменять их src не будет.

       Карточку ряда рисует сама Lampa, и адрес постера она ставит в своей
       ленивой загрузке по событию 'visible': Api.img(data.poster_path) без
       второго аргумента (vendor/lampa/app.min.js:52353). Размер там берётся
       из ШТАТНОЙ настройки Lampa poster_size (img$1, app.min.js:19739-19745;
       варианты w200/w300/w500, по умолчанию w300 — app.min.js:47715-47719).
       То есть у пользователя уже есть штатная ручка «качество постеров», и
       она действует на все ряды сразу, включая наши.

       Подменять src после отрисовки ряда — значит второй сетевой запрос на
       каждую карточку и гонка с той же ленивой загрузкой Lampa, которая
       выставит свой адрес на следующем 'visible'. На целевом железе выигрыш
       при этом близок к нулю: карточка ряда — 9.52em (217 px на экране
       1920, ROW_CARD_W в src/30_css.js), а WebView Android TV не рисует выше
       1080p даже на 4K-панели. */

    /* Порог «досмотрено» — тот же, что в LC.progress (src/70_progress.js).
       Значение 95 дублируется намеренно: это единственная литеральная
       константа, не общий объект — экспорт/импорт создал бы зависимость
       между модулями, не нужную для такого малого порога. */
    var WATCHED = 95;

    /* Поколение главной. Поднимается bumpGen() при уходе с главной.
       makeCall захватывает текущее значение в момент вызова inner-функции. */
    var _homeGen = 0;

    /* Дескрипторы, переданные в ContentRows.add при последней регистрации.
       doUnregister() снимает их через ContentRows.remove и очищает массив. */
    var _addedRows = [];

    /* Ещё не ответившие call-функции рядов. Держит контракт «ровно один
       call при любом исходе»: makeResolver кладёт сюда резолвер, первый же
       вызов резолвера убирает его, а bumpGen() закрывает всё оставшееся
       пустым результатом — иначе пачка Lampa не завершится никогда. */
    var _waiting = [];

    /* Оборачивает call ряда в резолвер с защёлкой. */
    function makeResolver(call) {
      var done = false;
      function resolve(payload) {
        if (done) return;
        done = true;
        var i = _waiting.indexOf(resolve);
        if (i !== -1) _waiting.splice(i, 1);
        try { call(payload); } catch (e) {}
      }
      _waiting.push(resolve);
      return resolve;
    }

    /* Закрывает все незавершённые ряды пустым результатом. */
    function flushWaiting() {
      var pending = _waiting;
      _waiting = [];
      for (var i = 0; i < pending.length; i++) {
        pending[i]({ results: [] });
      }
    }

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
       Неизвестные id пропускаются. Дубликаты id в списке снимаются. */
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

      /* Собираем объекты, пропуская неизвестные и дублирующиеся id */
      var seenIds = {};
      var list = [];
      for (i = 0; i < ids.length; i++) {
        if (!seenIds[ids[i]]) {
          seenIds[ids[i]] = 1;
          var item = byId[ids[i]];
          if (item) list.push(item);
        }
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

    /* Task 20: список подборок каталога для экрана выбора рядов (кнопка
       «Какие ряды показывать» в настройках → Lampa.Select с чекбоксами,
       src/80_settings.js). Отмеченные идут первыми, в своём порядке, —
       иначе на пульте их пришлось бы искать среди полутора сотен строк.
       storedIds пуст → отмечен набор manifest.home, ровно тот, что главная
       и показывает. Неизвестные id из storedIds отбрасываются: каталог с
       хостинга мог измениться с прошлого выбора. */
    function rowChoices(manifest, pickedIds) {
      if (!manifest || !Array.isArray(manifest.collections)) return [];
      var picked = (pickedIds && pickedIds.length) ? pickedIds : (manifest.home || []);
      var checked = {};
      var i;
      for (i = 0; i < picked.length; i++) checked[picked[i]] = 1;

      var byId = {};
      for (i = 0; i < manifest.collections.length; i++) {
        byId[manifest.collections[i].id] = manifest.collections[i];
      }

      var head = [];
      var seen = {};
      for (i = 0; i < picked.length; i++) {
        var item = byId[picked[i]];
        if (!item || seen[item.id]) continue;
        seen[item.id] = 1;
        head.push({ id: item.id, title: item.title, group: item.group, checked: true });
      }

      var tail = [];
      for (i = 0; i < manifest.collections.length; i++) {
        var c = manifest.collections[i];
        if (seen[c.id]) continue;
        tail.push({ id: c.id, title: c.title, group: c.group, checked: !!checked[c.id] });
      }
      return head.concat(tail);
    }

    /* ------------------------------------------------------------------ */
    /* Runtime: требуют Lampa.Favorite / Lampa.Timeline / Lampa.Utils.     */
    /* ------------------------------------------------------------------ */

    /* Task 20: сохранённый состав рядов главной — массив id или null, если
       настройка пуста (тогда действует manifest.home). Читают и register(),
       и экран выбора рядов в настройках. */
    function storedIds() {
      var raw = '';
      try { raw = LC.pref ? (LC.pref('lumen_home_rows', '') || '') : ''; } catch (e) {}
      if (!raw) return null;
      var parts = ('' + raw).split(',');
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        var id = parts[i].replace(/^\s+|\s+$/g, '');
        if (id) out.push(id);
      }
      return out.length ? out : null;
    }

    /* Собирает IDs просмотренных карточек:
       - type:'viewed' из Lampa.Favorite
       - карточки из results с прогрессом >= 95% (Lampa.Timeline.view / Lampa.Utils.hash)
       results — опциональный массив карточек текущего ряда (для Timeline-проверки).
       Используется в makeCall при формировании ответа ряда. */
    function viewedIds(results) {
      var ids = {};
      try {
        if (window.Lampa && Lampa.Favorite) {
          var viewed = Lampa.Favorite.get({ type: 'viewed' });
          if (Array.isArray(viewed)) {
            for (var i = 0; i < viewed.length; i++) {
              if (viewed[i] && viewed[i].id != null) ids[viewed[i].id] = 1;
            }
          }
        }
      } catch (e) {}
      try {
        if (results && results.length &&
            window.Lampa && Lampa.Timeline &&
            typeof Lampa.Timeline.view === 'function' &&
            Lampa.Utils && typeof Lampa.Utils.hash === 'function') {
          for (var j = 0; j < results.length; j++) {
            var card = results[j];
            if (!card || card.id == null || ids[card.id]) continue;
            var key = card.original_title || card.original_name || card.title || card.name || '';
            if (!key) continue;
            var v = Lampa.Timeline.view(Lampa.Utils.hash(key));
            if (v && (Number(v.percent) || 0) >= WATCHED) ids[card.id] = 1;
          }
        }
      } catch (eT) {}
      return Object.keys(ids).map(function (k) {
        var n = parseInt(k, 10);
        return isNaN(n) ? k : n;
      });
    }

    /* ------------------------------------------------------------------ */
    /* Поколение главной (C1: отмена in-flight запросов при уходе).         */
    /* ------------------------------------------------------------------ */

    /* Вызывается из LC.onActivityEvent при destroy component==='main'.
       Поднимает _homeGen, делая все активные alive()-функции вернуть false,
       и тут же закрывает пустым результатом ряды, которые уже никогда не
       получат ответа: LC.sources.fetch мёртвого подписчика не уведомляет. */
    function bumpGen() {
      _homeGen++;
      flushWaiting();
    }

    /* ------------------------------------------------------------------ */
    /* Снятие зарегистрированных рядов (C2-fix: ContentRows.remove).        */
    /* ------------------------------------------------------------------ */

    /* Снимает все дескрипторы из ContentRows и очищает _addedRows.
       Вызывается из register() (перед новой регистрацией) и unregister(). */
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
    /* register(manifest) — регистрирует ряды через Lampa.ContentRows.add  */
    /* ------------------------------------------------------------------ */

    /* Регистрирует ряды подборок на главной.
       Перед регистрацией снимает ранее добавленные ряды (ContentRows.remove),
       чтобы не задваивать при повторном вызове (реактивация, смена лимита,
       поздний манифест). */
    function register(manifest) {
      /* Снять предыдущий набор рядов перед регистрацией нового */
      doUnregister();

      /* Настройки: пользовательский список id и лимит */
      var picked = storedIds();

      var limitRaw = 15;
      try { limitRaw = LC.pref ? (parseInt(LC.pref('lumen_rows_limit', '15'), 10) || 15) : 15; } catch (e) {}

      /* Текущий месяц для сезонного порядка */
      var month = new Date().getMonth() + 1;

      var rows = homeRows(manifest, picked, month, limitRaw);

      /* Task 21: ряд адвента идёт первым среди подборок — он и есть главный
         сезонный ряд декабря; остальные сдвигаются на одну позицию. */
      var shift = registerAdvent(manifest) ? 1 : 0;

      for (var i = 0; i < rows.length; i++) {
        registerRow(rows[i], i + shift);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Task 21 (фаза 3): адвент-календарь.                                 */
    /*                                                                     */
    /* В декабре над подборками встаёт ряд «Адвент-календарь · день N»: по */
    /* одному рождественскому фильму на каждый день с 1-го по сегодняшний  */
    /* (максимум 24). Раскладка детерминированная — 5 декабря показывает   */
    /* один и тот же фильм и утром, и вечером (LC.themes.adventDays).      */
    /*                                                                     */
    /* Пул — первые две страницы подборок 'xmas-comedy' и 'christmas'.     */
    /* Ряд не входит в лимит числа рядов: он живёт три недели в году и     */
    /* занимает место не подборки, а праздника.                            */
    /* ------------------------------------------------------------------ */

    var ADVENT_IDS = ['xmas-comedy', 'christmas'];
    var ADVENT_PAGES = 2;

    function adventWord(key, def) {
      try {
        if (typeof LC.lang === 'function') return LC.lang(key);
      } catch (e) { }
      return def;
    }

    /* Сегодняшняя дата через LC.themes: там же живёт хук _now, которым
       живая проверка подменяет декабрь, не трогая системные часы. */
    function adventToday() {
      try {
        if (LC.themes && typeof LC.themes.today === 'function') return LC.themes.today();
      } catch (e) { }
      return null;
    }

    /* Пары «подборка + страница» для пула. Неизвестные id (каталог с
       хостинга мог их не содержать) просто пропускаются. */
    function adventSpecs(manifest) {
      var out = [];
      if (!manifest || !Array.isArray(manifest.collections)) return out;
      var byId = {};
      var i;
      for (i = 0; i < manifest.collections.length; i++) byId[manifest.collections[i].id] = manifest.collections[i];
      for (var j = 0; j < ADVENT_IDS.length; j++) {
        var item = byId[ADVENT_IDS[j]];
        if (!item) continue;
        for (var page = 1; page <= ADVENT_PAGES; page++) out.push({ item: item, page: page });
      }
      return out;
    }

    /* Ответы подборок -> пул без дублей. Порядок фиксирован порядком
       ЗАПРОСОВ, а не порядком ответов: от него зависит, какой фильм
       достанется какому дню, и он обязан быть одинаковым при каждом
       заходе на главную. */
    function adventPool(slots) {
      var pool = [];
      var seen = {};
      for (var i = 0; i < slots.length; i++) {
        var list = slots[i] || [];
        for (var j = 0; j < list.length; j++) {
          var card = list[j];
          if (!card || card.id == null || seen[card.id]) continue;
          seen[card.id] = 1;
          pool.push(card);
        }
      }
      return pool;
    }

    function adventTitle(today) {
      var day = today.getDate();
      if (day > 24) day = 24;
      return adventWord('lumen_advent_title', 'Advent calendar') + ' · ' +
        adventWord('lumen_advent_day', 'Day').toLowerCase() + ' ' + day;
    }

    /* call-функция ряда: четыре запроса (две подборки по две страницы),
       общий пул, раскладка по дням. Контракт «ровно один call при любом
       исходе» держит makeResolver, как и у обычных рядов. */
    function makeAdventCall(manifest) {
      return function (params, screen) {
        return function (call) {
          var gen = _homeGen;
          function alive() { return _homeGen === gen; }
          var resolve = makeResolver(call);
          var specs = adventSpecs(manifest);
          var today = adventToday();
          if (!specs.length || !today) { resolve({ results: [] }); return { cancel: function () {} }; }

          var slots = [];
          var left = specs.length;
          var handles = [];
          var words = {
            day: adventWord('lumen_advent_day', 'Day'),
            today: adventWord('lumen_advent_today', 'Today')
          };

          function finish() {
            left--;
            if (left > 0) return;
            var days = [];
            try {
              days = LC.themes.adventDays(adventPool(slots), today, words);
            } catch (e) {
              days = [];
            }
            resolve({ results: days, title: adventTitle(today) });
          }

          /* Фабрика на итерацию: var в цикле ES5 не создаёт своей области,
             и без неё все четыре колбэка писали бы в последний слот. */
          function ask(index) {
            var spec = specs[index];
            return LC.sources['fetch'](
              spec.item,
              spec.page,
              function (json) { slots[index] = (json && json.results) || []; finish(); },
              function () { slots[index] = []; finish(); },
              alive
            );
          }

          for (var i = 0; i < specs.length; i++) handles.push(ask(i));

          return {
            cancel: function () {
              for (var k = 0; k < handles.length; k++) {
                try { if (handles[k] && handles[k].clear) handles[k].clear(); } catch (e) {}
              }
            }
          };
        };
      };
    }

    /* Регистрирует ряд адвента, если сейчас декабрь. Возвращает true —
       тогда подборки сдвигаются на одну позицию вниз. */
    function registerAdvent(manifest) {
      try {
        if (!window.Lampa || !Lampa.ContentRows) return false;
        if (!LC.themes || typeof LC.themes.adventDays !== 'function') return false;
        var today = adventToday();
        if (!today || today.getMonth() !== 11) return false;
        if (!adventSpecs(manifest).length) return false;
        var descriptor = {
          name: rowName('advent'),
          title: adventTitle(today),
          screen: 'main',
          index: ROWS_OFFSET,
          call: makeAdventCall(manifest)
        };
        Lampa.ContentRows.add(descriptor);
        _addedRows.push(descriptor);
        return true;
      } catch (e) {
        return false;
      }
    }

    /* Регистрирует один ряд через ContentRows.add и сохраняет дескриптор.
       index — позиция в списке рядов плагина (к нему прибавляется ROWS_OFFSET,
       чтобы оставить позиции 0–3 для персональных рядов LC.personal из 45_personal.js;
       позиции 0–3 — personal, 4+ — подборки манифеста).
       call-функция возвращается фабрикой makeCall — item захватывается замыканием
       правильно в ES5 (var в цикле не создаёт отдельного scope). */
    var ROWS_OFFSET = 4;
    function registerRow(item, index) {
      try {
        if (!window.Lampa || !Lampa.ContentRows) return;

        /* Заголовок ряда: title из манифеста, badge через «·» если задан */
        var rowTitle = item.title;
        if (item.badge) rowTitle += ' · ' + item.badge;

        var descriptor = {
          name: rowName(item.id),
          title: rowTitle,
          screen: 'main',
          index: index + ROWS_OFFSET,
          call: makeCall(item)
        };
        Lampa.ContentRows.add(descriptor);
        _addedRows.push(descriptor);
      } catch (e) {}
    }

    /* Фабрика call-функции для одного элемента.
       Lampa передаёт (params, screen) — screen это строка 'main', не объект.
       Функция(call) выполняет запрос через LC.sources.fetch с alive-guard.
       alive() сравнивает захваченный gen с текущим _homeGen: если bumpGen()
       был вызван при уходе с главной, alive() вернёт false и LC.sources.fetch
       не вызовет колбэки результата. */
    function makeCall(item) {
      return function (params, screen) {
        return function (call) {
          /* Захватываем поколение в момент начала загрузки ряда.
             bumpGen() при archive/destroy component='main' поднимет _homeGen,
             после чего alive() вернёт false для этого gen. */
          var gen = _homeGen;
          function alive() { return _homeGen === gen; }

          /* Ровно один ответ Lampa при любом исходе — см. шапку модуля. */
          var resolve = makeResolver(call);

          var handle = LC.sources['fetch'](
            item,
            1,
            function (json) {
              /* Фильтр досмотренных: Favorite + Timeline >= 95% */
              var hide = false;
              try { hide = LC.pref ? !!LC.pref('lumen_hide_watched', false) : false; } catch (eIgnore) {}
              var filtered = filterWatched(json.results, viewedIds(json.results), hide);
              resolve({ results: filtered, title: item.title });
            },
            function () {
              /* Ошибка загрузки: пустой ряд */
              resolve({ results: [] });
            },
            alive
          );

          return {
            cancel: function () {
              if (handle && handle.clear) handle.clear();
            }
          };
        };
      };
    }

    /* Снимает все зарегистрированные ряды через ContentRows.remove (C2-fix).
       Вызывается из deactivate() в src/90_runtime.js. */
    function unregister() {
      doUnregister();
    }

    return {
      rowName: rowName,
      filterWatched: filterWatched,
      homeRows: homeRows,
      rowChoices: rowChoices,
      storedIds: storedIds,
      viewedIds: viewedIds,
      bumpGen: bumpGen,
      /* Task 21: чистые части адвента наружу ради тестов — сам ряд
         регистрирует register() в декабре. */
      adventSpecs: adventSpecs,
      adventPool: adventPool,
      register: register,
      unregister: unregister
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;

  /* -------------------------------------------------------------------- */
  /* LC.rows — регистрация рядов подборок на главной (ContentRows)          */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   rowName(id) → 'lumen_' + id                                          */
  /*   filterWatched(results, viewedIds, hide) → results[]                  */
  /*   homeRows(manifest, storedIds, month, limit) → collection[]           */
  /*   rowChoices(manifest, pickedIds) → [{id, title, group, checked}]       */
  /*   dedupeAcross(rows, seen, min) → rows[] — окно «уже показанного»      */
  /*   storedIds() → runtime: сохранённый состав рядов или null             */
  /*   viewedIds(results?) → number[]                                        */
  /*   bumpGen() — runtime: поднимает поколение главной                     */
  /*   installDedupe() / uninstallDedupe() — обёртка над Lampa.Api.main     */
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

    /* ------------------------------------------------------------------ */
    /* Task 57: фильм не повторяется в рядах ниже по главной.              */
    /*                                                                     */
    /* Жалоба пользователя (docs/research/2026-09-21-user-interview.md):   */
    /* одни и те же фильмы в «В тренде» и «Сейчас смотрят».                */
    /*                                                                     */
    /* ГДЕ ПЕРЕХВАТЫВАЕМ. Ряды главной строит не плагин. Компонент главной */
    /* зовёт Api.main(object, build, empty) (app.min.js:37070), внутри —   */
    /* main() активного источника (app.min.js:34595 → main$2 у TMDB,       */
    /* app.min.js:19793). Там и штатные ряды Lampa («Сейчас смотрят»       */
    /* 19799, «В тренде за день» 19806, «за неделю» 19813), и наши:        */
    /* ContentRows.call('main', params, parts_data) вставляет call-функции */
    /* зарегистрированных рядов в тот же массив parts_data по их index     */
    /* (app.min.js:19877 у TMDB и 33962 у CUB; сама вставка — call$1,      */
    /* app.min.js:18083-18108, через Arrays.insert, app.min.js:2362).      */
    /* Дальше Api.partNext (app.min.js:34962) исполняет части пачками по   */
    /* parts_limit=6 через Progress, который складывает ответы ПО ИНДЕКСУ  */
    /* задачи (result[i] = data, app.min.js:33801), отбрасывает пустые     */
    /* ряды (app.min.js:34971-34973) и отдаёт массив в partLoaded, то есть */
    /* в build(data); build раскладывает его в том же порядке              */
    /* (data.forEach(createAndAppend), app.min.js:35211).                  */
    /*                                                                     */
    /* Значит Api.main — единственная точка, где ВСЕ ряды главной лежат    */
    /* списком карточек в порядке экрана и ещё не отрисованы. Чистить      */
    /* только свои ряды (ContentRows) жалобу не закрывает: «Сейчас         */
    /* смотрят» и «В тренде» — ряды самой Lampa. Поэтому installDedupe()   */
    /* подменяет Lampa.Api.main обёрткой: компонент читает .main с того же */
    /* объекта, что экспортирован как Lampa.Api (app.min.js:55986), и      */
    /* делает это в момент вызова — подмена действует без правки Lampa.    */
    /*                                                                     */
    /* ОКНО ДО ОБРЕЗКИ. Окно применяется к полному results ряда: то, что   */
    /* видно на экране, Lampa нарезает позже и уже из нашего списка        */
    /* (Items.onCreate: results.slice(0, view), app.min.js:19028). Порог   */
    /* длины ряда проверяется ПОСЛЕ окна, отдельным проходом, — иначе ряд  */
    /* схлопнулся бы до пары карточек незаметно для проверки.              */
    /* ------------------------------------------------------------------ */

    /* Ряд короче DEDUPE_MIN карточек не показывается вовсе: на экране
       телевизора помещается 7 постеров (ROW_CARD_W = 9.52em, седьмая
       колонка сетки Apple — src/30_css.js:331), и ряд, не занимающий даже
       половины ширины, читается как остаток, а не как подборка. Половина
       от семи — 3.5, вверх — 4. */
    var DEDUPE_MIN = 4;

    /* Ключ карточки для окна: пара «пространство id + id». Пространство —
       это source карточки, но с одним исключением: 'cub' и 'tmdb' — ОДНО
       пространство.

       Поле source проставляет сама Lampa. У TMDB — get$c: пишет json.source
       и зовёт Utils.addSource(json, 'tmdb') на results (app.min.js:19703,
       19730; addSource — 4787-4791, source$2 = 'tmdb' на 19455). У CUB — то
       же самое строкой 'cub' (get$7, app.min.js:33848, 33860; source$1 —
       33816).

       Почему cub и tmdb склеены: CUB — прокси TMDB. Адрес запроса он строит
       как 'tmdb.' + cub_domain + '/' + u по тем же эндпоинтам
       (app.min.js:33833), а его карточка full$1 берёт id карточки и идёт с
       ним ПРЯМО в TMDB: TMDB.get(method + '/' + id + '/credits')
       (app.min.js:34295), TMDB.get('tv/' + json.id + '/season/…')
       (34270). Id у карточки cub, стало быть, TMDB-шный. Без склейки на
       источнике 'cub' (частая настройка в сборках Lampa) одна и та же
       «Одиссея» получала бы cub:1234 в рядах Lampa и tmdb:1234 в наших
       (LC.sources всегда ходит через Lampa.Api.sources.tmdb.get,
       src/43_sources.js), и дедупликация не срабатывала бы вовсе.

       Пустой source — тоже 'tmdb': так приходят карточки НАШИХ подборок
       Кинопоиска, LC.sources.fetchKp берёт их из ответа find/{imdb_id}
       (src/43_sources.js), у которого нет поля results, поэтому addSource
       их не трогает, а id в них тоже TMDB-шный (карточку вернул TMDB).

       Любой другой source остаётся сам по себе: штатных источников в
       Lampa.Api.sources ровно два — tmdb и cub (app.min.js:34544-34546),
       остальное добавляют плагины, и про их id мы не знаем ничего. */
    function cardKey(card) {
      if (!card || card.id === null || card.id === undefined || card.id === '') return null;
      var ns = (!card.source || card.source === 'cub') ? 'tmdb' : '' + card.source;
      return ns + ':' + card.id;
    }

    /* Поверхностная копия ряда с новым составом. Ряд правится копией, а не
       на месте: объект ответа нам не принадлежит — чужой ряд это разобранный
       ответ сети, который Lampa тем же объектом кладёт в свой кэш запросов
       (cacheSet(params, send_data), app.min.js:33615 → Cache.rewriteData,
       33545), наш — объект, собранный LC.rows/LC.personal. Копия стоит один
       проход по массиву ссылок и снимает вопрос целиком. */
    function copyRow(row, results) {
      var copy = {};
      for (var k in row) {
        if (Object.prototype.hasOwnProperty.call(row, k)) copy[k] = row[k];
      }
      copy.results = results;
      return copy;
    }

    /* Сквозной проход по рядам одной пачки, сверху вниз.
       rows — ответы рядов [{results, title, …}] в порядке экрана;
       seen — окно «уже показанного», общее на весь заход на главную
              (мутируется: пачек у главной несколько, см. installDedupe);
       min  — порог длины ряда (DEDUPE_MIN в рантайме).
       Возвращает НОВЫЙ массив рядов; входные объекты не меняются.

       Два наших флага на ряду:
         lumen_personal — состав не трогаем вовсе, но карточки в окно
           кладём. Персональные ряды (src/45_personal.js) — «Продолжить»,
           «Потому что вы смотрели», «Новые серии», «Скоро на экранах» —
           стоят наверху главной и построены под конкретного человека: три
           первых собраны из его истории и закладок, последний хоть и не
           требует его данных (шапка 45_personal.js), но стоит на главной
           ровно один и заведомо дублирует штатное «Скоро» Lampa. Источником
           окна они быть обязаны: ради этого дедупликация и делалась — уже
           начатый фильм не должен стоять ещё и в «В тренде». Получателем —
           нет: выбросить сериал из «Новых серий» значило бы потерять метку
           «Новая серия · 12 сен», которой больше негде взяться.
         lumen_keep — состав чистим, но ряд не выбрасываем по порогу длины.
           Стоит на рядах, состав которых пользователь выбрал сам
           (настройка lumen_home_rows, см. register), и на ряде адвента:
           в первых числах декабря в нём меньше четырёх карточек по самому
           его устройству. */
    function dedupeAcross(rows, seen, min) {
      if (!rows || !rows.length) return [];
      seen = seen || {};
      if (typeof min !== 'number') min = DEDUPE_MIN;

      var kept = [];
      /* Параллельный массив: у какого из kept окно что-то забрало. Флагом на
         самом ряду это не делается — ряд уходит в Lampa как данные, и лишних
         полей в нём быть не должно. */
      var trimmed = [];
      var i, j;
      for (i = 0; i < rows.length; i++) {
        var row = rows[i];
        if (!row || !row.results || !row.results.length) continue;
        var personal = !!row.lumen_personal;
        var out = [];
        for (j = 0; j < row.results.length; j++) {
          var card = row.results[j];
          var key = cardKey(card);
          if (key && seen[key] && !personal) continue;
          out.push(card);
          if (key) seen[key] = 1;
        }
        if (!out.length) continue;
        kept.push(copyRow(row, out));
        trimmed.push(out.length < row.results.length);
      }

      /* Порог длины — отдельным проходом, после окна, и ТОЛЬКО к рядам, из
         которых окно что-то забрало. Короткий сам по себе ряд трогать
         нельзя: такими приходят наши подборки Кинопоиска (fetchKp добавляет
         карточку, только если у фильма нашёлся imdb_id, — у российского и
         редкого кино его часто нет, src/43_sources.js) и любой ряд при
         включённом «Скрывать досмотренное» (filterWatched в makeCall). Их
         длину сделали не мы, и обещание настройки — «ряд, от которого ПОСЛЕ
         ЭТОГО осталась пара карточек» (src/80_settings.js) — к ним не
         относится. Персональные ряды под порог не попадают автоматически:
         их состав окно не трогает, значит trimmed у них всегда false. */
      var full = [];
      for (i = 0; i < kept.length; i++) {
        var r = kept[i];
        if (!trimmed[i] || r.lumen_keep || r.results.length >= min) full.push(r);
      }
      /* Если порог съел пачку целиком — отдаём её как есть: пустой массив
         означал бы для Lampa главную без единого ряда (build([]) строит
         пустой экран и больше ничего не спрашивает), а это хуже коротких
         рядов, ради которых порог и заводился. */
      return full.length ? full : kept;
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
    /* Task 57, рантайм: обёртка над Lampa.Api.main.                       */
    /* ------------------------------------------------------------------ */

    /* Штатный Lampa.Api.main, снятый при установке обёртки, и сама обёртка
       (нужна, чтобы при снятии не сорвать чужую, вставшую поверх нашей). */
    var _mainOriginal = null;
    var _mainWrapped = null;
    /* Работает ли обёртка сейчас. Отдельный флаг от самой подмены: снять
       подмену получается не всегда (поверх могла встать чужая обёртка,
       см. uninstallDedupe), и тогда осиротевшая наша обязана стать
       сквозной. Без флага выключенный плагин продолжал бы чистить ряды —
       настройка lumen_rows_dedupe при выключении плагина остаётся true. */
    var _dedupeActive = false;

    function dedupeEnabled() {
      if (!_dedupeActive) return false;
      try { return LC.pref ? !!LC.pref('lumen_rows_dedupe', true) : true; } catch (e) { return true; }
    }

    /* Подменяет Lampa.Api.main обёрткой, которая пропускает ряды главной
       через dedupeAcross. Окно заводится на каждый вызов Api.main, то есть
       на каждый заход на главную, и живёт до конца экрана: следующие пачки
       приходят через функцию, которую Api.main вернул (её компонент держит
       как next и зовёт по докрутке — app.min.js:37070-37077).
       Настройка читается в момент вызова: выключил — следующая же главная
       строится штатно, перерегистрация не нужна. Идемпотентна: если наша
       обёртка уже в цепочке (в том числе осиротевшая под чужой), второй раз
       не подменяем — иначе получилось бы два окна подряд. */
    function installDedupe() {
      _dedupeActive = true;
      if (_mainWrapped) return;
      try {
        if (!window.Lampa || !Lampa.Api || typeof Lampa.Api.main !== 'function') return;
      } catch (e) { return; }
      _mainOriginal = Lampa.Api.main;
      _mainWrapped = function (params, oncomplite, onerror) {
        if (!dedupeEnabled()) return _mainOriginal(params, oncomplite, onerror);
        var seen = {};
        var next = _mainOriginal(params, function (data) {
          oncomplite(dedupeAcross(data, seen, DEDUPE_MIN));
        }, onerror);
        if (typeof next !== 'function') return next;
        return function (resolve, reject) {
          return next(function (more) {
            resolve(dedupeAcross(more, seen, DEDUPE_MIN));
          }, reject);
        };
      };
      try { Lampa.Api.main = _mainWrapped; } catch (eSet) { _mainWrapped = null; _mainOriginal = null; }
    }

    /* Возвращает штатный Api.main. Если поверх нашей обёртки встал кто-то
       ещё, чужую подмену не срываем — вместо этого гасим свою флагом
       _dedupeActive: осиротевшая обёртка остаётся в цепочке, но становится
       сквозной. Ссылки при этом СОХРАНЯЮТСЯ: потеряв _mainOriginal, мы
       потеряли бы и штатный main навсегда, а потеряв _mainWrapped —
       обернули бы при следующей активации чужую обёртку со своей старой
       внутри, то есть завели бы два окна. */
    function uninstallDedupe() {
      _dedupeActive = false;
      if (!_mainWrapped) return;
      try {
        if (window.Lampa && Lampa.Api && Lampa.Api.main === _mainWrapped) {
          Lampa.Api.main = _mainOriginal;
          _mainWrapped = null;
          _mainOriginal = null;
        }
      } catch (e) {}
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

      /* Task 57: явный признак «этот ряд выбрал пользователь» — непустая
         настройка lumen_home_rows. Такие ряды дедупликация чистит, но не
         выбрасывает, даже если после чистки они стали короткими: человек
         отметил их сам, и решать за него, что подборка «схлопнулась», мы
         не вправе. Набор по умолчанию (manifest.home) под правило не
         попадает — его никто не выбирал. */
      var pinned = !!(picked && picked.length);

      /* Task 21: ряд адвента идёт первым среди подборок — он и есть главный
         сезонный ряд декабря; остальные сдвигаются на одну позицию. */
      var shift = registerAdvent(manifest) ? 1 : 0;

      for (var i = 0; i < rows.length; i++) {
        registerRow(rows[i], i + shift, pinned);
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
            /* Task 57: ряд адвента короче порога по самому своему
               устройству — 5 декабря в нём ровно пять карточек, — поэтому
               из-под порога длины он выведен флагом. */
            resolve({ results: days, title: adventTitle(today), lumen_keep: true });
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
    function registerRow(item, index, pinned) {
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
          call: makeCall(item, pinned)
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
    function makeCall(item, pinned) {
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
              var payload = { results: filtered, title: item.title };
              /* Task 57: ряд из состава, выбранного пользователем вручную,
                 дедупликация не выбрасывает по длине (см. register). */
              if (pinned) payload.lumen_keep = true;
              resolve(payload);
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
      /* Task 57: чистая часть наружу ради тестов, обёртка — ради
         activate/deactivate в src/90_runtime.js. */
      dedupeAcross: dedupeAcross,
      installDedupe: installDedupe,
      uninstallDedupe: uninstallDedupe,
      /* Task 21: чистые части адвента наружу ради тестов — сам ряд
         регистрирует register() в декабре. */
      adventSpecs: adventSpecs,
      adventPool: adventPool,
      register: register,
      unregister: unregister
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.rows;

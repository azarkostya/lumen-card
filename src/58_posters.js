  /* -------------------------------------------------------------------- */
  /* Исследование «без лагов и без ожидания» (2026-09-27, полоса images):  */
  /* LC.posters — байты постеров рядов главной, которых Lampa ЕЩЁ НЕ       */
  /* СОЗДАЛА, заранее в кэш браузера.                                      */
  /*                                                                       */
  /* Почему постер ряда бывает пустым (серый img_load.svg Lampa). Адрес    */
  /* постера Lampa ставит в своей ленивой загрузке: карточка получает       */
  /* событие 'visible' из Layer.visible (vendor/lampa/app.min.js:31720-     */
  /* 31766, окно ±2 экрана), а Layer.visible зовётся только по концу       */
  /* прокрутки — webkitTransitionEnd ленты (scrollEnded, :31989). Сами      */
  /* карточки ряда создаются пачками по view (у наших рядов view = число   */
  /* видимых, src/44_rows.js withView), когда фокус переходит середину      */
  /* пачки (Items$2.onScroll, :19030); ряды — по одному на конец            */
  /* вертикальной прокрутки (Items$1.onPushLoaded, limit_view = 1 на ТВ,    */
  /* :35180). Стенд (ТВ-профиль, CPU ×10, +200 мс к ответу прокси):        */
  /* при зажатой стрелке первые карточки новой пачки появляются через      */
  /* 200-400 мс после создания, а src → load занимает 370-510 мс — 1-5 из  */
  /* 12 карточек въезжают пустыми, пустота до 470 мс.                       */
  /*                                                                       */
  /* Что делает модуль: на каждом переводе фокуса (без ожидания покоя —   */
  /* пустые постеры бывают именно при зажатой стрелке) берёт из самой      */
  /* Lampa данные ряда под фокусом и очереди рядов (компонент активности:  */
  /* items[i].data.results, items[i].items, items[i].view, active, loaded) */
  /* и грузит постеры: ряд под фокусом — от первой несозданной карточки до */
  /* AHEAD экранов вперёд от фокуса (когда в ряду уже шагали вправо);     */
  /* ряды ниже, ждущие в очереди Lampa и в заготовке LC.rows.ahead, — до   */
  /* ROWS рядов от фокуса, только после QUIET покоя (разбор у ROWS).       */
  /* Адрес — тем же Lampa.Api.img(poster_path), что у карточки (Card,     */
  /* :20877), то есть тот же ключ кэша и та же настройка poster_size.      */
  /*                                                                       */
  /* Как грузит: new Image() без crossOrigin — режим запроса тот же, что у  */
  /* <img> карточки, и ImageResource, пока жив объект, лежит в MemoryCache */
  /* рендерера: когда Lampa ставит src, картинка уже есть. decode() НЕ      */
  /* зовётся: растр постера (0.51 МБ у w300) держать заранее незачем, и    */
  /* удержать его всё равно нечем (декодированное живёт в discardable-      */
  /* памяти компоновщика и вытесняется по LRU). Одновременно в пути не     */
  /* больше SLOTS; fetchPriority 'low' — видимые постеры Lampa и кадр героя */
  /* (high) идут раньше. Держим KEEP последних объектов: около 3 МБ сжатых */
  /* байт (w300 — 33 КБ в среднем по 14 постерам прокси).                   */
  /*                                                                       */
  /* Внутренности Lampa — не публичный API: любое несовпадение формы       */
  /* (нет items/loaded/data) — тихий отказ, ни одного запроса.             */
  /* -------------------------------------------------------------------- */

  LC.posters = (function () {

    var SLOTS = 4;
    var KEEP = 96;
    /* Экранов ряда под фокусом вперёд от фокуса. */
    var AHEAD = 2;
    /* Рядов ниже фокуса, чьи постеры берём из очереди Lampa (loaded) и из
       заготовленной части рядов (LC.rows.ahead, src/44_rows.js).
       Раньше здесь был НОЛЬ — по замеру: с ROWS = 2 пустых при въезде
       14 из 116 и 15 из 44 (+200 мс к ответу прокси, при зажатой стрелке
       до 539 мс) против 0 из 108 и 5 из 36 без неё; при +400 мс — 43 из
       76 против 44 из 80. Причина была в данных: следующая часть (до 6
       рядов) приходила только у конца ленты (Api.main, end_ratio 2), и
       первый ряд из неё Lampa добавляла за шаг до показа — брать заранее
       было нечего, а запросы на каждом шаге делили канал с видимыми
       постерами. Этап 2б: часть заготавливается сразу после построения
       предыдущей (partAhead), а ряды ниже планируются только после QUIET
       покоя фокуса — при зажатой стрелке ни одного лишнего запроса (урок
       «хвост ряда при каждом шаге вниз»: задержка шага 184 → 248 мс).

       Когда окно открыто. Берём ROWS рядов ниже фокуса за вычетом тех,
       что уже в DOM. Через 0.7-0.9 с после шага ниже фокуса всегда 2-3 ряда
       (окно закрыто — так его и сочло мёртвым ревью этапа 2б, Р2), но
       план рядов ниже идёт через QUIET после шага, раньше конца прокрутки,
       на котором Lampa добавляет ряд, — и тогда ниже фокуса бывает один
       ряд, то есть окно берёт первый ряд очереди. Стенд (CPU×10, +400 мс
       / 10 Мбит, 8 × «вниз» по 700 мс, опрос каждые 100 мс): рядов ниже
       фокуса в момент нажатия 3, 2, 2, 3, 3, 3, 3, 3, минимум между
       нажатиями 2, 1, 1, 2, 2, 2, 2, 2 (один ряд — в 7 замерах из 49).
       В этих прогонах модуль грузит 8-24 постера рядов ниже (вправо не
       шагали — хвоста нет). Пустых постеров при въезде в тех же
       условиях, 9 пар прогонов через раз: ROWS = 2 — медиана 6.7 %,
       среднее 10.7; без рядов ниже (ROWS = 0, без таймера покоя) —
       медиана 29.7 %, среднее 32.3; окно лучше в 8 парах из 9. Мера
       шумная: одна и та же сборка даёт от 0 до 31 % (6 прогонов копии
       байт в байт), поэтому сравнивать — только парами одной серии.
       Прежние числа этапа 2б для ROWS = 0/2/3 (8/0/0, 25/48/0 и
       0/0/0 %) сняты разными сериями и между собой не сравнимы. */
    var ROWS = 2;
    /* Покой фокуса перед постерами рядов ниже: меньше шага пульта с
       остановками (700 мс на стенде), больше шага зажатой стрелки. */
    var QUIET = 300;
    /* Пачка Lampa по умолчанию (Base$1, :35239), если у ряда её нет. */
    var VIEW = 7;

    var queue = [];
    var busy = 0;
    var started = {};
    var startedN = 0;
    var kept = [];

    /* Постер карточки — как в Card.getPosterPath (:20877-20879) для
       обычной карточки: poster_path, иначе profile_path. У широких и
       «коллекций» Lampa берёт backdrop — такие ряды пропускаются. */
    function pathOf(item) {
      if (!item) return '';
      return item.poster_path || item.profile_path || '';
    }

    function styleOf(params) {
      var s = params && params.style;
      return s && s.name ? s.name : '';
    }

    function viewOf(params, fallback) {
      var v = params && params.items && params.items.view;
      return typeof v === 'number' && v > 0 ? v : fallback;
    }

    /* Чистая: список путей постеров по снимку компонента.
       lines — [{results, made, active, view, style}] рядов в DOM;
       at — индекс ряда под фокусом; pending — [{results, view, style}]
       рядов в очереди Lampa (по порядку). */
    function planPaths(lines, at, pending, ahead, rows) {
      var out = [];
      var seen = {};
      function add(item) {
        var p = pathOf(item);
        if (p && !seen[p]) {
          seen[p] = true;
          out.push(p);
        }
      }
      /* Хвост ряда — только когда в этом ряду уже шагали вправо (active >
         0). Ряд, в который только что спустились, хвоста не получает:
         при листании вниз это 9 лишних постеров на ряд, и на стенде
         (CPU ×10) такой вариант поднял задержку шага вниз с 184 до 248 мс
         (p50) — обработка каждой загрузки идёт главным потоком. До первой
         пачки Lampa (фокус на середине view) от первого шага вправо ещё
         три-четыре нажатия — запас на сеть есть. */
      var line = lines[at];
      if (line && line.results && !line.style && (line.active || 0) > 0) {
        var view = line.view > 0 ? line.view : VIEW;
        var upto = Math.min(line.results.length, (line.active || 0) + view * ahead + 1);
        for (var i = line.made || 0; i < upto; i++) add(line.results[i]);
      }
      var below = lines.length - 1 - at;
      var need = Math.max(0, rows - below);
      for (var k = 0; k < pending.length && k < need; k++) {
        var row = pending[k];
        if (!row || !row.results || row.style) continue;
        var v = row.view > 0 ? row.view : VIEW;
        for (var j = 0; j < row.results.length && j < v + 1; j++) add(row.results[j]);
      }
      return out;
    }

    /* Сколько карточек results ряд уже создал: items минус кнопка «Ещё»
       (MoreFirst кладёт её первой, More — последней, app.min.js:18949-
       19178) — как built() в src/58_prefill.js. Ревью rv6, RV6-5: с
       кнопкой в счёте хвост начинался на карточку дальше, и постер
       ближайшей несозданной не грузился. */
    function madeOf(it) {
      var items = it && it.items;
      if (!items || typeof items.length !== 'number') return 0;
      var n = items.length;
      if (it.more && typeof items.indexOf === 'function' && items.indexOf(it.more) >= 0) n--;
      return n;
    }

    /* Снимок активности Lampa: только если форма совпадает с Items$1
       (главная, ContentRows). */
    function snapshot() {
      var comp = null;
      try {
        var a = Lampa.Activity.active();
        comp = a && a.activity && a.activity.component;
      } catch (e) {
        return null;
      }
      if (!comp || !comp.items || !comp.items.length || typeof comp.items.length !== 'number') return null;
      var lines = [];
      for (var i = 0; i < comp.items.length; i++) {
        var it = comp.items[i];
        var d = it && it.data;
        lines.push({
          results: d && d.results && d.results.length ? d.results : null,
          made: madeOf(it),
          active: it && typeof it.active === 'number' ? it.active : 0,
          view: it && typeof it.view === 'number' ? it.view : viewOf(d && d.params, VIEW),
          style: styleOf(d && d.params)
        });
      }
      var pending = [];
      function queued(row) {
        pending.push({
          results: row && row.results && row.results.length ? row.results : null,
          view: viewOf(row && row.params, VIEW),
          style: styleOf(row && row.params)
        });
      }
      var loaded = comp.loaded;
      if (loaded && typeof loaded.length === 'number') {
        for (var k = 0; k < loaded.length; k++) {
          var part = loaded[k];
          if (!part || typeof part.length !== 'number') continue;
          for (var j = 0; j < part.length; j++) queued(part[j]);
        }
      }
      /* За очередью Lampa — заготовленная часть, которую она ещё не
         просила (src/44_rows.js, partAhead): по порядку экрана она идёт
         сразу за loaded. */
      var ahead = [];
      try {
        if (LC.rows && typeof LC.rows.ahead === 'function') ahead = LC.rows.ahead() || [];
      } catch (eAhead) {
        ahead = [];
      }
      for (var h = 0; h < ahead.length; h++) queued(ahead[h]);
      var at = typeof comp.active === 'number' ? comp.active : 0;
      if (at < 0) at = 0;
      if (at > lines.length - 1) at = lines.length - 1;
      return { lines: lines, at: at, pending: pending };
    }

    function urlOf(path) {
      try {
        return Lampa.Api.img(path) || '';
      } catch (e) {
        return '';
      }
    }

    function pump() {
      while (busy < SLOTS && queue.length) {
        var url = queue.shift();
        if (started[url]) continue;
        started[url] = true;
        startedN++;
        var img = new Image();
        try { img.fetchPriority = 'low'; } catch (e) { }
        busy++;
        img.onload = img.onerror = done(img);
        img.src = url;
        kept.push(img);
        while (kept.length > KEEP) kept.shift();
      }
      /* Память отметок «уже грузили»: браузер держит байты в HTTP-кэше и
         после вытеснения объекта из kept, повтор был бы попаданием в кэш,
         но запросом. Сбрасываем отметки целиком раз в 400 адресов. */
      if (startedN > 400) {
        started = {};
        startedN = 0;
        for (var i = 0; i < kept.length; i++) started[kept[i].src] = true;
      }
    }

    /* Освободившееся место отдаётся ТЕКУЩЕЙ очереди, чья бы загрузка ни
       закончилась (ревью rv6, RV6-6): после stop() очередь пуста, и pump
       ничего не начнёт, а после нового плана загрузка прошлого окна,
       доехав, будит его — иначе при занятых слотах новый план ждал бы
       следующего перевода фокуса. */
    function done(img) {
      return function () {
        img.onload = img.onerror = null;
        busy--;
        if (busy < 0) busy = 0;
        pump();
      };
    }

    /* Перевод фокуса на главной — план заново: новое окно важнее
       несостоявшегося старого. Сам план — следующей задачей, а не внутри
       обработки нажатия: на горячем пути фокуса только таймер (как у
       LC.prefetch), и серия нажатий в одной задаче даёт один план. */
    var planTimer = null;
    /* Ряды ниже — отдельным таймером покоя: каждый перевод фокуса его
       переставляет, так что при зажатой стрелке он не срабатывает. */
    var quietTimer = null;
    function around() {
      if (quietTimer) clearTimeout(quietTimer);
      quietTimer = setTimeout(function () {
        quietTimer = null;
        plan(ROWS);
      }, QUIET);
      if (planTimer) return;
      planTimer = setTimeout(function () {
        planTimer = null;
        plan(0);
      }, 0);
    }

    function plan(rows) {
      var snap = snapshot();
      if (!snap) return;
      var paths = planPaths(snap.lines, snap.at, snap.pending, AHEAD, rows);
      var list = [];
      for (var i = 0; i < paths.length; i++) {
        var url = urlOf(paths[i]);
        if (url && !started[url]) list.push(url);
      }
      queue = list;
      pump();
    }

    /* Уход с главной (park/unmount героя): очередь пуста, запросы в пути
       доедут сами (их места в SLOTS освободит done) — отменять их незачем,
       байты пригодятся на возврате. */
    function stop() {
      queue = [];
      if (planTimer) {
        clearTimeout(planTimer);
        planTimer = null;
      }
      if (quietTimer) {
        clearTimeout(quietTimer);
        quietTimer = null;
      }
    }

    function stats() {
      return { fly: busy, queue: queue.length, kept: kept.length };
    }

    return {
      ROWS: ROWS,
      QUIET: QUIET,
      planPaths: planPaths,
      around: around,
      stop: stop,
      stats: stats
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.posters;

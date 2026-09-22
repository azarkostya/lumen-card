/* -------------------------------------------------------------------- */
  /* LC.personal — персональные ряды на главной:                            */
  /*   «Досмотреть», «Потому что вы смотрели «X»»,                          */
  /*   «Новые серии ваших сериалов», «Скоро на экранах»                     */
  /*                                                                       */
  /* Публичное API (чистые функции):                                        */
  /*   pickBecause(history, n) → [{id, media, title}]                       */
  /*   newEpisodes(shows, today) → [{…show, lumen_badge}]                    */
  /*   soonRange(today) → {gte, lte}                                        */
  /*   dropFinished(items, percentOf) → items[] — без досмотренных фильмов  */
  /*                                                                       */
  /* Публичное API (runtime, требуют Lampa):                                */
  /*   bumpGen() — поднимает поколение главной; вызвать при уходе с главной */
  /*   register() — строит и регистрирует ряды через ContentRows.add        */
  /*   unregister() — снимает ряды через ContentRows.remove                  */
  /*                                                                       */
  /* Отмена запросов: сторож поколения _gen — тот же паттерн, что в        */
  /* LC.rows. bumpGen() поднимает _gen, когда главную ВЫБРОСИЛИ (событие   */
  /* 'activity':{type:'destroy', component:'main'}); каждый in-flight      */
  /* колбэк проверяет alive() перед обновлением UI.                        */
  /*                                                                       */
  /* Контракт call-функции ряда: ровно ОДИН вызов call(...) при любом      */
  /* исходе — тот же, что в LC.rows, и по той же причине (Lampa ждёт       */
  /* ответа каждой части пачки, см. шапку src/44_rows.js). Держит его      */
  /* makeResolver: поздние колбэки глохнут защёлкой, а bumpGen() закрывает */
  /* всё незавершённое пустым результатом.                                 */
  /*                                                                       */
  /* Снятие рядов: _addedRows + ContentRows.remove — тот же паттерн,       */
  /* что в LC.rows. doUnregister() вызывается из register() и unregister(). */
  /*                                                                       */
  /* Цена запросов: «Потому что вы смотрели» — не более BECAUSE_LIMIT (2)  */
  /* исходных карточек; «Новые серии» — не более SHOWS_LIMIT (6) сериалов. */
  /* Все сетевые ряды закрываются общим сборщиком LC.util.gate с дедлайном  */
  /* ROW_TIMEOUT: не дождавшись всех ответов, ряд отдаёт то, что успело     */
  /* прийти — страховка от запроса, который не ответит никогда. Цена        */
  /* первого экрана держится на SHOWS_LIMIT: ряды стоят в первой пачке      */
  /* главной, а её Lampa отдаёт целиком (parts_limit, шапка src/44_rows.js).*/
  /* Кэш рекомендаций: life 1440 мин; деталей TV: life 720 мин.            */
  /* «Скоро» — discover/movie + discover/tv: life 360 мин.                 */
  /*                                                                       */
  /* Безопасность при отсутствии данных: каждый ряд проверяет наличие      */
  /* источника (Favorite, история) и не регистрируется, если данных нет.   */
  /* «Скоро» регистрируется всегда — данные пользователя не нужны.         */
  /*                                                                       */
  /* Task 57: каждый ряд помечает свой ответ полем lumen_personal. Для     */
  /* дедупликации рядов главной (LC.rows.dedupeAcross) это значит «состав  */
  /* не трогать, но карточки в окно положить» — разбор там же.             */
  /* -------------------------------------------------------------------- */

  LC.personal = (function () {

    /* Максимум исходных карточек для «Потому что вы смотрели». */
    var BECAUSE_LIMIT = 2;

    /* Максимум сериалов для «Новые серии». Это ровно столько ПАРАЛЛЕЛЬНЫХ
       запросов tv/{id}, и все они попадают в первую пачку главной (ряд стоит
       на index 2, parts_limit у Lampa = 6), а пачку Lampa отдаёт целиком —
       поэтому первый кадр ждёт их все. Шесть — это ровно те сериалы, которые
       отбирает getShows: сперва закладки, потом история; ряду этого хватает
       («что новенького у того, что я смотрю»), а стоит он вдвое дешевле
       прежних двенадцати. */
    var SHOWS_LIMIT = 6;

    /* Дедлайн ряда: страховка от запроса, который не ответит никогда (ни ok,
       ни err). Без неё такой запрос держит call ряда, а Lampa ждёт ответа
       КАЖДОЙ части пачки — главная перестаёт достраиваться (та же беда, что
       чинил makeResolver). По дедлайну ряд отдаёт то, что успело прийти.

       Значение намеренно большое: дедлайн не должен срезать медленные, но
       живые ответы — ряд с половиной карточек не быстрее полного, потому что
       ждёт всё равно вся пачка. Живьём (модель канала 6 параллельных запросов
       по 3 с) дедлайн 2 с оставлял «Скоро на экранах» пустым, не выигрывая ни
       миллисекунды до первого кадра. Цену первого экрана снижает SHOWS_LIMIT,
       а не этот таймер. Порядок величины тот же, что у FETCH_TIMEOUT подборок
       (15 с), с поправкой на то, что ряды главной дешевле. */
    var ROW_TIMEOUT = 8000;

    /* Окно «скоро» — 30 дней вперёд. */
    var SOON_DAYS = 30;

    /* Новая серия: вышла не более RECENT_DAYS назад. */
    var RECENT_DAYS = 14;

    /* Новая серия: следующая выйдет через не более UPCOMING_DAYS. */
    var UPCOMING_DAYS = 7;

    /* ------------------------------------------------------------------ */
    /* Task 58: досмотренный фильм уходит из «Продолжить».                 */
    /*                                                                     */
    /* Жалоба пользователя (docs/research/2026-09-21-user-interview.md):   */
    /* «я посмотрел Аватара Аанга фильм и он у меня висит, вопрос зачем».  */
    /*                                                                     */
    /* ЧТО ДАЁТ LAMPA. Ряд «Продолжить» собирает наш makeContinueCall из   */
    /* Lampa.Favorite.continues('movie'|'tv') (app.min.js:22612-22635).    */
    /* continues берёт историю (Favorite type 'history') и вычитает из неё */
    /* карточки, отмеченные 'viewed' и 'thrown' (22623-22629). Обе отметки */
    /* ставятся ТОЛЬКО руками — через меню закладок карточки               */
    /* (app.min.js:37608-37612, Favorite.toggle). Автоматически Lampa      */
    /* пишет лишь в 'history', и пишет при ЗАПУСКЕ воспроизведения         */
    /* (Favorite.add('history', movie, 100) — app.min.js:40371 и 40754).   */
    /* Своей чистки по проценту просмотра у неё нет: ни одного вызова      */
    /* Favorite.add/toggle с 'viewed' в app.min.js не существует. Поэтому  */
    /* досмотренный фильм и висит в «Продолжить» вечно.                    */
    /*                                                                     */
    /* Процентом владеет Lampa.Timeline (app.min.js:24027): запись — это   */
    /* {percent, time, duration, profile, updated} по хэшу файла           */
    /* (view, app.min.js:23899-23944), хранится в Storage (update,         */
    /* 23850-23859). Хэш фильма — Utils.hash(card.original_title), тот же, */
    /* которым Timeline.watched считает «смотрел ли» (app.min.js:24000), и */
    /* тот же, по которому наша полоса прогресса на постере берёт процент  */
    /* (src/62_badges.js, progressOf).                                     */
    /*                                                                     */
    /* ПОРОГ. Финальные титры идут 5-10 минут, то есть 3-8 % хронометража  */
    /* фильма на 90-180 минут: «конец фильма» приходится на 92-97 % файла, */
    /* а ровно 100 % набирается, только если досидеть до конца титров.     */
    /*                                                                     */
    /* A4 (волна A финального плана): 95 → 90. Task 58 брал 95 за тем же   */
    /* числом, которым сама Lampa отмечает просмотр рукой (кнопка отметки  */
    /* ставит percent = 95 и time = duration * 0.95,                       */
    /* app.min.js:21274-21279). На практике этого не хватило: пользователь */
    /* дважды жаловался, что досмотренное висит в ряду — «Аватар» и        */
    /* «Моана» на 85 %. Плеер добирает последние проценты только если      */
    /* досидеть титры до конца, а пульт нажимают раньше.                   */
    /* Решение координатора — 90, и 85 не берём: на 85 % фильм может быть  */
    /* реально не досмотрен (длинные титры), а 90 % у фильма на 2:53 — это */
    /* 17 минут хвоста, из которых титры съедают 5-10.                     */
    /*                                                                     */
    /* Число теперь СВОЁ, не общее с WATCHED (95 в src/44_rows.js и        */
    /* src/70_progress.js) и не с PROGRESS_MAX (95 в src/62_badges.js).    */
    /* Так и задумано: «карточка ушла из ряда» и «Lampa считает фильм      */
    /* просмотренным» — разные утверждения, и второе принадлежит не нам.   */
    /* Видно это только на узкой полосе 90-95 %: там карточка из ряда уже  */
    /* выпала, а полоса «Продолжить» на её постере в других рядах ещё      */
    /* рисуется — и это честно, фильм действительно не досмотрен до конца. */
    /* Порог живёт ровно здесь, в одной константе, и больше нигде.         */
    /*                                                                     */
    /* СЕРИАЛЫ НЕ ТРОГАЕМ, и вот почему. «Досмотрен последний доступный    */
    /* эпизод» на наших данных не вычисляется. Favorite хранит карточку не */
    /* целиком, а по списку полей card_fields (app.min.js:3833) через      */
    /* Utils.clearCard (4624-4638); в списке есть number_of_seasons,       */
    /* number_of_episodes и next_episode_to_air, но НЕТ ни                 */
    /* last_episode_to_air, ни разбивки серий по сезонам. А хэш записи     */
    /* серии — hash([season, season > 10 ? ':' : '', episode,              */
    /* original_name].join('')) (watchedEpisode, app.min.js:24006-24010):  */
    /* чтобы проверить последнюю серию, надо знать И номер последнего      */
    /* сезона, И номер последней серии в нём. Перебором не нащупать:       */
    /* отсутствие записи в Timeline значит «не смотрел», а не «серии       */
    /* нет». Остаётся запрос tv/{id} — по одному на каждую карточку        */
    /* «Продолжить» (до 19 штук, app.min.js:22635) и в первой же пачке     */
    /* главной; ровно эту цену Task 16 уже срезал SHOWS_LIMIT'ом до шести. */
    /* Сериалы в «Продолжить» пользователь тем же интервью назвал          */
    /* удобными, так что платить за них первым экраном тем более незачем.  */
    /*                                                                     */
    /* ДАННЫЕ LAMPA НЕ ТРОГАЕМ. Это фильтр показа и только: ни Favorite,   */
    /* ни Timeline модуль не пишет. Фильм остаётся в истории, находится    */
    /* поиском, его позиция в Timeline на месте, а при повторном запуске   */
    /* плеер перезапишет percent своим текущим (road.percent =             */
    /* params.percent, app.min.js:23850) — и карточка вернётся в ряд сама. */
    /* Настройки поэтому нет: «показывать досмотренное в Продолжить» —     */
    /* это выключатель для состояния, которое никому не нужно, а ничего    */
    /* необратимого фильтр не делает.                                      */
    /* ------------------------------------------------------------------ */
    var CONTINUE_DONE = 90;

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

    /* Task 58: сериал или фильм. Ровно тот же признак, по которому делит
       карточки сама Lampa в continues: number_of_seasons или first_air_date
       (app.min.js:22631). */
    function isSeries(card) {
      return !!(card && (card.number_of_seasons || card.first_air_date));
    }

    /* Task 58: убирает из списка «Продолжить» досмотренные ФИЛЬМЫ.
       items — карточки Lampa.Favorite.continues;
       percentOf(card) → процент просмотра (в рантайме это watchedPercent
       поверх Lampa.Timeline.view; у незнакомого фильма он даёт 0, а null —
       только если Timeline недоступен или у карточки нет имени).
       Сериалы проходят насквозь — разбор в шапке блока выше. Вход не
       мутируется, порядок сохраняется. */
    function dropFinished(items, percentOf) {
      if (!items || !items.length) return [];
      if (typeof percentOf !== 'function') return items.slice();
      var out = [];
      for (var i = 0; i < items.length; i++) {
        var card = items[i];
        if (!card) continue;
        if (isSeries(card)) { out.push(card); continue; }
        var percent = Number(percentOf(card));
        /* Сравнение, а не отрицание: NaN (null, undefined, строка вместо
           числа) его не проходит, и карточка остаётся в ряду. В рантайме
           таких значений не бывает — это контракт чистой функции на случай
           другого поставщика процента. */
        if (percent >= CONTINUE_DONE) continue;
        out.push(card);
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

    /* Ещё не ответившие call-функции рядов (контракт «ровно один call»). */
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

    /* Поднимает _gen, делая все текущие alive()-функции вернуть false, и
       закрывает ряды, которые уже никогда не дождутся своих колбэков.
       Вызывается из LC.onActivityEvent при destroy component='main'. */
    function bumpGen() {
      _gen++;
      flushWaiting();
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

    /* Task 58: процент просмотра фильма из локальной истории Lampa.
       Ключ — original_title, а если его нет — title. Lampa для фильма берёт
       строго hash(card.original_title) (Timeline.watched, app.min.js:24000);
       наш запасной title — это ровно та же цепочка, по которой считает
       процент полоса на постере (src/62_badges.js, progressOf: её
       original_title || original_name || title || name у фильма сводится к
       этой паре, потому что original_name бывает только у сериала). То есть
       с Lampa мы расходимся лишь там, где у неё ключ был бы пустым.

       null — только когда Timeline или Utils недоступны либо имени нет
       вовсе. Самого числа тут не бывает null: Timeline.view ВСЕГДА
       возвращает объект, у которого percent инициализирован нулём
       (app.min.js:23899-23919), поэтому незнакомому фильму соответствует 0,
       а не отсутствие записи. */
    function watchedPercent(card) {
      try {
        if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return null;
        if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return null;
        var key = (card && (card.original_title || card.title)) || '';
        if (!key) return null;
        var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
        return view ? (Number(view.percent) || 0) : null;
      } catch (e) {
        return null;
      }
    }

    /* Объединяет continues('movie') и continues('tv'), снимает дубли по id,
       убирает досмотренные фильмы (Task 58: dropFinished — фильтр ПОКАЗА,
       данные Lampa он не трогает).
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
      return dropFinished(out, watchedPercent);
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
          /* Ровно один ответ Lampa при любом исходе — см. шапку модуля. */
          var resolve = makeResolver(call);
          if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }
          var items = continuesList();
          if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }
          resolve({ results: items, title: LC.lang ? LC.lang('lumen_row_continue') : 'Continue watching', lumen_personal: true });
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
          /* Ровно один ответ Lampa при любом исходе — см. шапку модуля. */
          var resolve = makeResolver(call);
          if (!alive() || !picked || !picked.length) {
            resolve({ results: [] }); return { cancel: function () {} };
          }
          var results = [];
          var cancelled = false;
          var handles = [];

          /* Ответы собирает общий сборщик с дедлайном (LC.util.gate):
             ряд закрывается либо когда ответили все, либо по ROW_TIMEOUT —
             тем, что успело прийти. */
          var gate = LC.util.gate(picked.length, ROW_TIMEOUT, function () {
            if (cancelled || !alive()) return;
            resolve({ results: results, title: rowTitle, lumen_personal: true });
          });

          for (var i = 0; i < picked.length; i++) {
            (function (card) {
              var url = card.media + '/' + card.id + '/recommendations';
              var net = null;
              try {
                net = Lampa.Api.sources.tmdb.get(
                  url,
                  { filter: { page: 1 } },
                  function (json) {
                    if (!alive()) return;
                    var arr = (json && json.results) ? json.results : [];
                    for (var k = 0; k < arr.length; k++) results.push(arr[k]);
                    gate.tick();
                  },
                  function () {
                    if (!alive()) return;
                    gate.tick();
                  },
                  { life: 1440 }
                );
              } catch (e) {
                gate.tick();
              }
              if (net) handles.push(net);
            })(picked[i]);
          }

          return {
            cancel: function () {
              cancelled = true;
              gate.cancel();
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
          /* Ровно один ответ Lampa при любом исходе — см. шапку модуля. */
          var resolve = makeResolver(call);
          if (!alive() || !shows || !shows.length) {
            resolve({ results: [] }); return { cancel: function () {} };
          }
          var details = [];
          var cancelled = false;
          var handles = [];

          /* Тот же сборщик с дедлайном, что и у остальных рядов: по истечении
             ROW_TIMEOUT ряд строится из тех деталей, что успели прийти. */
          var gate = LC.util.gate(shows.length, ROW_TIMEOUT, function () {
            if (cancelled || !alive()) return;
            var filtered = newEpisodes(details, null);
            resolve({ results: filtered, title: LC.lang ? LC.lang('lumen_row_new_episodes') : 'New episodes', lumen_personal: true });
          });

          for (var i = 0; i < shows.length; i++) {
            (function (card) {
              var url = 'tv/' + card.id;
              var net = null;
              try {
                net = Lampa.Api.sources.tmdb.get(
                  url,
                  {},
                  function (json) {
                    if (!alive()) return;
                    if (json && json.id != null) details.push(json);
                    gate.tick();
                  },
                  function () {
                    if (!alive()) return;
                    gate.tick();
                  },
                  { life: 720 }
                );
              } catch (e) {
                gate.tick();
              }
              if (net) handles.push(net);
            })(shows[i]);
          }

          return {
            cancel: function () {
              cancelled = true;
              gate.cancel();
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
          /* Ровно один ответ Lampa при любом исходе — см. шапку модуля. */
          var resolve = makeResolver(call);
          if (!alive()) { resolve({ results: [] }); return { cancel: function () {} }; }

          var range = soonRange(null);
          var movies = [];
          var tvShows = [];
          var cancelled = false;
          var handles = [];

          /* Тот же сборщик с дедлайном: если один из двух discover молчит,
             ряд соберётся из ответившего. */
          var gate = LC.util.gate(2, ROW_TIMEOUT, function () {
            if (cancelled || !alive()) return;
            /* Чередуем фильмы и сериалы, сортируем по дате выхода. */
            var all = movies.concat(tvShows);
            all.sort(function (a, b) {
              var da = a.release_date || a.first_air_date || '';
              var db = b.release_date || b.first_air_date || '';
              return da < db ? -1 : da > db ? 1 : 0;
            });
            resolve({ results: all, title: LC.lang ? LC.lang('lumen_row_soon') : 'Coming soon', lumen_personal: true });
          });

          function fetchDiscover(media, resultArr) {
            var filterKey = media === 'movie' ? 'primary_release_date' : 'first_air_date';
            var f = {};
            f[filterKey + '.gte'] = range.gte;
            f[filterKey + '.lte'] = range.lte;
            var net = null;
            try {
              net = Lampa.Api.sources.tmdb.get(
                'discover/' + media,
                { filter: f, sort_by: 'popularity.desc' },
                function (json) {
                  if (!alive()) return;
                  var arr = (json && json.results) ? json.results : [];
                  for (var k = 0; k < arr.length; k++) resultArr.push(arr[k]);
                  gate.tick();
                },
                function () {
                  if (!alive()) return;
                  gate.tick();
                },
                { life: 360 }
              );
            } catch (e) {
              gate.tick();
            }
            return net;
          }

          handles.push(fetchDiscover('movie', movies));
          handles.push(fetchDiscover('tv', tvShows));

          return {
            cancel: function () {
              cancelled = true;
              gate.cancel();
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

      /* «Потому что вы смотрели: «X»» (index 1): только если в истории ≥1 карточки.
         Заголовок строится как «<строка>: «<название>»». Двоеточие избавляет от
         необходимости склонять произвольное название фильма, что нереализуемо без
         словаря (например, «Оппенгеймер» → родительный «Оппенгеймера» неоднозначен
         для автоматики без морфологического анализатора). */
      try {
        var history = getHistory();
        var picked = pickBecause(history, BECAUSE_LIMIT);
        if (picked && picked.length) {
          var becauseTitle = LC.lang ? LC.lang('lumen_row_because') : 'Because you watched';
          if (picked[0] && picked[0].title) {
            becauseTitle += ': «' + picked[0].title + '»';
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
      /* Task 58: чистая часть фильтра «Продолжить» наружу ради тестов. */
      dropFinished: dropFinished,
      bumpGen: bumpGen,
      register: register,
      unregister: unregister
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.personal;

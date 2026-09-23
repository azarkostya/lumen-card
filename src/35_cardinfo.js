  /* -------------------------------------------------------------------- */
  /* Данные шапки карточки (Task 5a). Чистая логика без обращений к         */
  /* window/Lampa/jQuery — рантайм (90_runtime.js) только вставляет         */
  /* результат в DOM. Проверяется тестами (node --test) без браузера.       */
  /* -------------------------------------------------------------------- */

  LC.cardinfo = (function () {
    /* Task 5 Step 3b.2: словарь ISO -> русское название страны. */
    var COUNTRY_RU = {
      US: 'США',
      GB: 'Великобритания',
      RU: 'Россия',
      FR: 'Франция',
      DE: 'Германия',
      JP: 'Япония',
      KR: 'Южная Корея',
      CN: 'Китай',
      CA: 'Канада',
      AU: 'Австралия',
      IT: 'Италия',
      ES: 'Испания',
      IN: 'Индия'
    };

    function trim(str) {
      return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
    }

    /* headText — текст штатного .full-start-new__head, который start.js
       заполняет до события complite (формат '2024, США' или просто '2024').
       Отрезаем ведущий год с разделителем; если после этого ничего не
       осталось — фолбэк на production_countries[].iso_3166_1 по словарю,
       иначе английское имя страны из TMDB. */
    function country(headText, productionCountries) {
      var text = trim(headText).replace(/^\d{4}\s*,?\s*/, '');
      text = trim(text);
      if (text) return text;

      if (productionCountries && productionCountries.length) {
        var first = productionCountries[0] || {};
        var iso = first.iso_3166_1;
        if (iso && COUNTRY_RU[iso]) return COUNTRY_RU[iso];
        return first.name || iso || '';
      }
      return '';
    }

    /* Автор сериала: created_by[0].name. */
    function creator(movie) {
      if (movie && movie.created_by && movie.created_by.length && movie.created_by[0]) {
        return movie.created_by[0].name || '';
      }
      return '';
    }

    /* Task 5 Step 3b.1: длинное название (> 18 символов) переносится
       классом .lumen-title--long вместо однострочного обрезания. */
    function titleClass(title) {
      return trim(title).length > 18 ? 'lumen-title--long' : '';
    }

    /* Правка 2026-09-23 (разбор композиции, п.2.1): длинное название режется
       по своему разделителю, а не по ширине колонки. «Звёздные войны:
       Эпизод 5 - Империя наносит ответный удар» занимал две строки самым
       крупным кеглем карточки и ВСЁ РАВНО обрывался многоточием.

       Разделителем считается первое двоеточие или тире, окружённое
       пробелами (обычное, среднее или длинное). Режем по ПЕРВОМУ: впереди
       оказывается имя франшизы — то, по чему тайтл узнают, — а уточнение
       уходит во вторую строку. У примера выше это «Звёздные войны» и
       «Эпизод 5 - Империя наносит ответный удар».

       Порог тот же, что у titleClass: короткое название помещается в одну
       строку целиком, и разносить его по двум уровням значило бы добавить
       карточке высоты там, где проблемы нет.

       Доля названий с разделителем — замер по живым данным TMDB
       (2026-09-23, шесть списков — popular, top_rated и trending для кино и
       сериалов, по две страницы, язык ru-RU, 240 названий): разделитель
       есть у 35 из 240, это 14.6 %. Но правило работает не на всех, а на
       длинных: длиннее 26 символов оказались 39 названий (16.3 %), и среди
       НИХ разделитель есть у 20 — 51.3 %. То есть двухуровневый заголовок
       закрывает примерно половину проблемных случаев, и фолбэк для второй
       половины обязателен (кегль на ступень ниже, .lumen-title--long в
       src/30_css.js). Примеры без разделителя из той же выборки:
       «Закон и порядок. Специальный корпус», «Очень позднее шоу с Джеймсом
       Корденом» — точка и предлог разделителями не считаются: «Часть
       первая» после точки это продолжение названия, а не его второй
       уровень. */
    var TITLE_SPLIT = /^(.{2,}?)\s*(?::|\s[—–-]\s)\s*(.+)$/;

    function titleParts(title) {
      var t = trim(title);
      if (t.length <= 18) return null;
      var m = TITLE_SPLIT.exec(t);
      if (!m) return null;
      var lead = trim(m[1]);
      var sub = trim(m[2]);
      if (!lead || !sub) return null;
      return { lead: lead, sub: sub };
    }

    /* Task 5a Step 3: статус -> визуальный вид точки/подписи.
       'soon' покрывает Planned/In Production/Post Production (подпись
       «Анонс» выставляет рантайм, здесь только цветовой вид). */
    function statusKind(status) {
      var s = trim(status).toLowerCase();
      if (s === 'released') return 'good';
      if (s === 'returning series') return 'accent';
      if (s === 'planned' || s === 'in production' || s === 'post production') return 'soon';
      return 'muted';
    }

    /* Строка качества -> раздельные чипы (экран 01/03/10: "4K", "HDR", "BD").
       BDRip/BluRay схлопываются в 'BD', WEB-DL/WEBRip/WEBDL — в 'WEB'.
       Остальные токены — как есть, в верхнем регистре, без дублей. */
    function qualityChips(q) {
      q = trim(q);
      if (!q) return [];
      var raw = q.split(/[\s,\/]+/);
      var out = [];
      for (var i = 0; i < raw.length; i++) {
        var tok = raw[i];
        if (!tok) continue;
        var up = tok.toUpperCase();
        var mapped = up;
        if (up.indexOf('BDRIP') !== -1 || up.indexOf('BLURAY') !== -1 || up.indexOf('BLU-RAY') !== -1) mapped = 'BD';
        else if (up.indexOf('WEB-DL') !== -1 || up.indexOf('WEBDL') !== -1 || up.indexOf('WEBRIP') !== -1 || up === 'WEB') mapped = 'WEB';
        var exists = false;
        for (var j = 0; j < out.length; j++) { if (out[j] === mapped) { exists = true; break; } }
        if (!exists) out.push(mapped);
      }
      return out;
    }

    /* Счётчик реакции 'fire' (список e.data.reactions.result) или 0. */
    function reactionsCount(reactions) {
      if (!reactions || !reactions.length) return 0;
      for (var i = 0; i < reactions.length; i++) {
        if (reactions[i] && reactions[i].type === 'fire') return reactions[i].counter || 0;
      }
      return 0;
    }

    /* Ревью Task 5a (Task 5 Step 3b.3): URL картинок только через прокси
       TMDB Lampa — сам плагин image.tmdb.org руками не собирает (план 0.2).
       tmdbImage/apiImg — внешние функции (обычно Lampa.TMDB.image/Lampa.Api.img),
       передаются параметрами, чтобы модуль остался чистым (без window/Lampa).
       path нормализуется (без ведущего '/') перед вызовом ОБОИХ методов —
       так двойной слэш ('t/p/w1280//x.jpg', дефект приёмки v1) невозможен
       независимо от того, добавляет ли сам вызванный метод свой '/'.
       Основной путь — tmdbImage('t/p/' + size + '/' + path) (то, чем
       пользуется сама Lampa, живьём проверено — учитывает proxy_tmdb);
       apiImg(path, size) — фолбэк, если TMDB.image недоступен/бросил. */
    function imageUrl(path, size, tmdbImage, apiImg) {
      path = '' + (path || '');
      if (!path) return '';
      var clean = path.charAt(0) === '/' ? path.slice(1) : path;
      size = size || 'original';

      if (typeof tmdbImage === 'function') {
        try {
          var url = tmdbImage('t/p/' + size + '/' + clean);
          if (url) return url;
        } catch (e) { }
      }
      if (typeof apiImg === 'function') {
        try {
          var url2 = apiImg(clean, size);
          if (url2) return url2;
        } catch (e2) { }
      }
      return '';
    }

    /* Ревью Task 5a (рефакторинг LC.header): true, если карточка — сериал.
       Раньше жила в 90_runtime.js как локальная isSerial(movie), логика та же —
       чистая, без Lampa/DOM, просто переехала. */
    function isSerial(movie) {
      return !!(movie.first_air_date || movie.number_of_seasons || movie.number_of_episodes || movie.name);
    }

    /* До 3 жанров, каждый — через capitalizeFn (обычно Lampa.Utils.capitalize
       FirstLetter, внедряется параметром из LC.header — сам cardinfo Lampa не
       знает). Без capitalizeFn имена жанров возвращаются как есть. */
    function genres(rawGenres, capitalizeFn) {
      var out = [];
      var cap = typeof capitalizeFn === 'function' ? capitalizeFn : function (s) { return s; };
      try {
        if (rawGenres && rawGenres.length) {
          for (var i = 0; i < rawGenres.length && i < 3; i++) {
            if (rawGenres[i] && rawGenres[i].name) out.push(cap(rawGenres[i].name));
          }
        }
      } catch (e) { }
      return out;
    }

    /* Возрастной рейтинг: приоритет у распознанного Lampa.TMDB.parsePG (parsed),
       иначе текст штатного узла .full-start__pg (domText) — оба добывает
       LC.header (Lampa API + DOM), здесь только чистое слияние. */
    function pgText(parsed, domText) {
      var pg = parsed ? ('' + parsed) : '';
      if (!pg && domText) pg = '' + domText;
      return pg;
    }

    /* Ревью Task 5b (правки координатора, п.1): единая точка правды для
       «какой путь кадра использовать» — раньше bgMode и backdropUrl
       (50_backdrops.js) были рассинхронизированы: bgMode учитывал кадр из
       movie.images.backdrops[], а backdropUrl читал только backdrop_path,
       из-за чего режим 'backdrop' с кадром только в альбоме давал пустой
       URL (гибрид вне design-spec §11/§12: ни постера, ни настоящего
       кадра). Приоритет — backdrop_path, иначе первый элемент
       images.backdrops[] с непустым file_path и БЕЗ iso_639_1 (кадр без
       текста/логотипа), иначе ''. И bgMode, и LC.backdrops.backdropUrl
       вызывают именно эту функцию. */
    function backdropPath(movie) {
      movie = movie || {};
      if (movie.backdrop_path) return movie.backdrop_path;

      var backdrops = (movie.images && movie.images.backdrops) || [];
      for (var i = 0; i < backdrops.length; i++) {
        var b = backdrops[i];
        if (b && b.file_path && !b.iso_639_1) return b.file_path;
      }
      return '';
    }

    /* Task 5b Step 1: режим фона ДО попытки реальной загрузки картинки
       (onload/onerror/таймаут — уже забота LC.backdrops, не этой чистой
       функции). 'backdrop' — backdropPath(movie) непуст. 'poster' — кадров
       нет, но есть poster_path. 'procedural' — нет вообще ничего, тогда
       фон — старые процедурные градиенты v1. */
    function bgMode(movie) {
      movie = movie || {};
      if (backdropPath(movie)) return 'backdrop';
      if (movie.poster_path) return 'poster';
      return 'procedural';
    }

    /* Task 5c: 'YYYY-MM-DD' + список из 12 месяцев -> '17 декабря' / '17 дек'.
       Ревью п.4: сами названия месяцев (как и «сегодня»/«завтра»/«через» и
       склонение дней) живут в LC.STRINGS и приходят параметром — модуль
       остаётся чистым и не знает ни про Lampa, ни про язык интерфейса.
       Нет списка, пусто или мусор в дате -> ''. */
    function dayMonth(ymd, months) {
      if (!months || months.length !== 12) return '';
      var m = /^\d{4}-(\d{2})-(\d{2})/.exec('' + (ymd || ''));
      if (!m) return '';
      var month = parseInt(m[1], 10);
      var day = parseInt(m[2], 10);
      if (month < 1 || month > 12 || day < 1 || day > 31) return '';
      return day + ' ' + months[month - 1];
    }

    function shortDate(ymd, months) {
      return dayMonth(ymd, months);
    }

    /* Task 5c Step 1: чип «Следующая серия» (design-spec §5e, экран 05) по
       movie.next_episode_to_air. Дни — календарные (LC.util.daysUntil), так что
       серия «завтра» остаётся завтрашней и в 23:50. Сегодня/завтра — словом:
       «через 0 дней»/«через 1 день» звучат неестественно. words — строки и
       склонение из LC.STRINGS (собирает LC.header). Дата в прошлом, нет данных
       или нет строк -> null (чип скрыт). */
    function nextEpisode(nextToAir, now, words) {
      if (!nextToAir || !words) return null;
      var days = LC.util.daysUntil(nextToAir.air_date, now);
      var date = dayMonth(nextToAir.air_date, words.months);
      if (days === null || days < 0 || !date) return null;
      var when;
      if (days === 0) when = words.today;
      else if (days === 1) when = words.tomorrow;
      else when = date + ', ' + words.inDays + ' ' + days + ' ' + (words.daysWord ? words.daysWord(days) : '');
      return { date: date, days: days, text: words.next + ' — ' + when };
    }

    /* Task 5d Step 1 (design-spec §10, экран 07): «Премьера» — «29 февраля
       2024». Дату разбираем той же регуляркой, что dayMonth, а не через
       new Date(str): тот считает 'YYYY-MM-DD' полночью UTC, и западнее
       Гринвича вечером дата съезжала бы на день назад. Неполная дата (в TMDB
       попадаются '2024' и несуществующие месяцы) -> хотя бы год. */
    function premiere(ymd, months) {
      var m = /^(\d{4})/.exec('' + (ymd || ''));
      if (!m) return '';
      var day = dayMonth(ymd, months);
      return day ? day + ' ' + m[1] : m[1];
    }

    /* Task 59 (фаза 5): сумма в таблице «ПОДРОБНО» — «$ 190 000 000».
       Разряды разделяются пробелами вручную: toLocaleString на ТВ-движках
       отдаёт разное (или не отдаёт ничего), а формат с $ впереди повторяет
       тот, которым Lampa показывала бюджет в своём блоке подробностей
       (app.min.js:38018). Не число или ноль — пустая строка: такую строку
       add() в таблицу не пустит. */
    function money(value) {
      var n = Number(value);
      if (!(n > 0)) return '';
      var digits = '' + Math.floor(n);
      var out = '';
      for (var i = 0; i < digits.length; i++) {
        if (i > 0 && (digits.length - i) % 3 === 0) out += ' ';
        out += digits.charAt(i);
      }
      return '$ ' + out;
    }

    /* Task 5d Step 1, поправка Task 59 (фаза 5): строки таблицы «ПОДРОБНО» —
       [{label, value}]. Оригинал (только если отличается от названия),
       Премьера, Создатель (только сериал), Бюджет (только фильм). Пустые
       значения в таблицу не попадают — строки с пустым value просто нет.

       Task 59: страна, режиссёр фильма, жанр и хронометраж отсюда убраны —
       все четыре слово в слово стоят в мета-строке шапки (renderMeta,
       src/85_header.js), и именно их пользователь назвал дублями (интервью
       2026-09-21). Создатель сериала остался: в мете у сериала на его месте
       стоит студия или сеть (network), а не человек. Премьера осталась: в
       мете только год, здесь — полная дата.

       Как и nextEpisode, модуль остаётся чистым: подписи и названия месяцев
       приходят словарём words — его собирает LC.header из LC.STRINGS, здесь
       ни Lampa, ни языка интерфейса нет. Без words таблицу строить нечем -> [].

       Task 59: параметра persons у функции больше нет — режиссёр был
       единственным, что она из него брала.

       ВНИМАНИЕ (ревью Task 5d, M6): добавили сюда новое поле movie —
       обновите factsSign() в src/85_header.js. Она решает, пересобирать ли
       таблицу, по короткой подписи тех же данных; поле, которого в подписи
       нет, изменится молча, и таблица останется старой. */
    function facts(movie, words) {
      var out = [];
      if (!movie || !words) return out;

      function add(label, value) {
        if (label && value) out.push({ label: label, value: value });
      }

      var serial = isSerial(movie);
      var title = movie.title || movie.name || '';
      var original = movie.original_title || movie.original_name || '';

      add(words.original, original && original !== title ? original : '');
      add(words.premiere, premiere(movie.release_date || movie.first_air_date, words.months));

      /* Бюджет — только у фильма: в ответе TMDB по сериалу такого поля нет,
         оно всегда пусто. Lampa читает card.budget одинаково у фильма и у
         сериала (Descriptiopn.create один на оба, app.min.js:38012 и 38018),
         а пустое значение просто удаляет вместе со строкой (38072) — здесь
         тот же исход достигается тем, что add() не пускает пустое. Строку
         показываем вместо штатного блока подробностей, который скрыт нашим
         CSS (src/30_css.js, .full-descr__details). */
      if (serial) add(words.creator, creator(movie));
      else add(words.budget, money(movie.budget));

      return out;
    }

    /* Task 5c Step 2: студия/сеть сериала в мета-строке («Amazon Prime» на
       экране 05) — networks[0].name; у сериалов без сети — первая студия. */
    function network(movie) {
      if (!movie) return '';
      var list = movie.networks && movie.networks.length ? movie.networks : movie.production_companies;
      return (list && list.length && list[0] && list[0].name) || '';
    }

    return {
      country: country,
      creator: creator,
      network: network,
      facts: facts,
      nextEpisode: nextEpisode,
      shortDate: shortDate,
      titleClass: titleClass,
      titleParts: titleParts,
      statusKind: statusKind,
      qualityChips: qualityChips,
      reactionsCount: reactionsCount,
      imageUrl: imageUrl,
      isSerial: isSerial,
      genres: genres,
      pgText: pgText,
      bgMode: bgMode,
      backdropPath: backdropPath
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardinfo;

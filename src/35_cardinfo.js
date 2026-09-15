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

    /* Первый член съёмочной группы с job === 'Director'. */
    function director(crew) {
      if (!crew || !crew.length) return '';
      for (var i = 0; i < crew.length; i++) {
        if (crew[i] && crew[i].job === 'Director') return crew[i].name || '';
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

    return {
      country: country,
      director: director,
      creator: creator,
      titleClass: titleClass,
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

  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): тематические атмосферы — правила тем, сезонность,    */
  /* адвент-календарь.                                                     */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   matchTheme(rules, movie) → правило темы или null                     */
  /*   allowed(theme, mode, month) → показывать ли эту тему сейчас          */
  /*   seasonalIds(collections, month) → id подборок сезона                 */
  /*   adventDays(src, today, words, opened) → 31 окошко адвента (holB)     */
  /*   adventRecord(cards, today, old) → запись lumen_advent_open           */
  /*   monthOf(date) / month() → месяц 1..12 (month() — через хук _now)      */
  /*   current() → правила тем из манифеста                                 */
  /*   mode() → значение настройки lumen_fx: 'all' | 'seasonal' | 'off'     */
  /*   forMovie(movie) → тема, которую МОЖНО показать этому фильму сейчас   */
  /*   HOLIDAYS — Новый год и Хэллоуин по дате (раунд holB)                 */
  /*   holidayAt(date) → запись календаря или null; holiday() — на сегодня  */
  /*                                                                       */
  /* Здесь нет ни DOM, ни canvas, ни таймеров: движок частиц живёт в        */
  /* src/52_fx.js, а этот модуль только решает, какая тема кому положена.   */
  /* Единственная связь с окружением — current()/mode() (манифест и         */
  /* Storage) и хук _now: живая проверка адвента подменяет им дату, не      */
  /* трогая системные часы (план Task 21 Step 7).                          */
  /*                                                                       */
  /* Ключевые слова приходят из TMDB тремя формами: movie отдаёт            */
  /* keywords.results, tv — keywords.keywords, а кэш героя (src/48_hero.js) */
  /* может положить уже развёрнутый массив. Разбираем все три — иначе тема  */
  /* находилась бы только у фильмов.                                       */
  /* -------------------------------------------------------------------- */

  /* Раунд holB: автоматические темы частиц по ключевым словам фильма —
     космос, море, война, нуар, пустыня, сакура, зомби, Валентин —
     ВЫКЛЮЧЕНЫ. Пользователь, со скрином «Одиссеи» с лучами прожекторов и
     пузырями: «что это за дискотека? Такая тема только на тематических, а
     какая тут тематика? Давай оставим только Рождество и Хэллоуин, а
     оформление потом будем руками докидывать». Остаются праздничные:
     правила christmas и halloween каталога (HOLIDAY_RULES) и праздники по
     дате (HOLIDAYS). Вернуть прочие — LC.fxAutoThemes = true: правила в
     каталоге и движки частиц целы, тесты гоняют их при включённом флаге.
     Читается на каждом вызове forMovie. */
  LC.fxAutoThemes = false;

  LC.themes = (function () {

    /* Раунд holB: адвент под СНГ — весь декабрь, 31 окошко. Прежде он шёл до
       католического сочельника (24 плитки); у нас праздник — Новый год, и
       31-го смотрят «Иронию судьбы» (пользователь). */
    var ADVENT_DAYS = 31;
    var ADVENT_FINAL_ID = 43430;
    /* Утверждённый календарь с 1 по 31 декабря. Русские карточки сверены
       с TMDB 25.11.2026; посев хранит только поля списка. */
    var ADVENT_LIST = [
      508965, 5255, 1551025, 527435, 615665, 360920, 562, 833097, 1570488, 17979,
      1234811, 845781, 333348, 10719, 12193, 549053, 9279, 1581, 10147, 77762,
      508, 5825, 828613, 771, 772, 384682, 41977, 57809, 85317, 63258,
      ADVENT_FINAL_ID
    ];
    var ADVENT_SEED = {
      508965: { id: 508965, title: "Клаус", original_title: "Klaus", original_language: "en", release_date: "2019-11-08", poster_path: "/iQ4WqwaeYzL9Hiljji98AkwR8Ix.jpg", backdrop_path: "/cYQvXNPZLow73lhspVQ7CYlT3Mi.jpg", vote_average: 8.2 },
      5255: { id: 5255, title: "Полярный Экспресс", original_title: "The Polar Express", original_language: "en", release_date: "2004-11-10", poster_path: "/g4f3rVaFgVjFTSSng6FgkqBNwmM.jpg", backdrop_path: "/jtOvTVlkF8TlaOq94oNXRc9u2yp.jpg", vote_average: 6.7 },
      1551025: { id: 1551025, title: "Телохранительница", original_title: "Guarding Stars", original_language: "en", release_date: "2026-11-18", poster_path: "/1RQFu2dzuwIm03XSN3BDf3GOfWg.jpg", backdrop_path: "/qHvap0vpfTBIbv7cnR0OyBRqQHG.jpg", vote_average: 6.9 },
      527435: { id: 527435, title: "Рождественские Хроники", original_title: "The Christmas Chronicles", original_language: "en", release_date: "2018-11-22", poster_path: "/vsuaNfpWHM3dCJy3wLqJp2Xkyce.jpg", backdrop_path: "/zQVsXIPXU040BnFtBmzoOfYGcDu.jpg", vote_average: 7.2 },
      615665: { id: 615665, title: "Пара на праздники", original_title: "Holidate", original_language: "en", release_date: "2020-10-27", poster_path: "/aCdJsARgdVj2URgoXlpvjibSuv7.jpg", backdrop_path: "/8veOfB9RbSzFki0Rq3IQIGsFfhC.jpg", vote_average: 7 },
      360920: { id: 360920, title: "Гринч", original_title: "The Grinch", original_language: "en", release_date: "2018-11-08", poster_path: "/t1f5cF0QHTxT4I9PZmjCUF8EPSs.jpg", backdrop_path: "/5lWIYxYEqWi8j3ZloxXntw3ImBo.jpg", vote_average: 6.9 },
      562: { id: 562, title: "Крепкий орешек", original_title: "Die Hard", original_language: "en", release_date: "1988-07-15", poster_path: "/bIDUVu4QTAvNLEZqTml5vka8ElV.jpg", backdrop_path: "/bvk2AAH64lP2YZs02Q3jskfHT8j.jpg", vote_average: 7.8 },
      833097: { id: 833097, title: "Незабываемое Рождество", original_title: "Falling for Christmas", original_language: "en", release_date: "2022-11-10", poster_path: "/z7NyO0G82hVq0UoW2ODGM5s3MOW.jpg", backdrop_path: "/iVtpnbPE91vmi3LmcOXycEblwPA.jpg", vote_average: 6.2 },
      1570488: { id: 1570488, title: "Идеальное Рождество для собаки", original_title: "A Dog's Perfect Christmas", original_language: "en", release_date: "2026-11-04", poster_path: "/a80Mg04hjQh4l0MRvv7RB0qc17S.jpg", backdrop_path: "/hhQT0TySg3LXCE8BEPpfPJ5zJA2.jpg", vote_average: 7.1 },
      17979: { id: 17979, title: "Рождественская История", original_title: "A Christmas Carol", original_language: "en", release_date: "2009-11-04", poster_path: "/rgPEBq7GXtBJ3CB1ExbFgipiX4k.jpg", backdrop_path: "/uocpNfrP0Vvnf2UxykXuIR1HNUd.jpg", vote_average: 6.9 },
      1234811: { id: 1234811, title: "Наш маленький секрет", original_title: "Our Little Secret", original_language: "en", release_date: "2024-11-27", poster_path: "/AfVnkrNMfOcx0tDKAagT0icSHnj.jpg", backdrop_path: "/aJkOBOdbzUc788VDGJp3nEAlC3I.jpg", vote_average: 6.2 },
      845781: { id: 845781, title: "Миссия: Красный", original_title: "Red One", original_language: "en", release_date: "2024-10-31", poster_path: "/6T36kuDbXCGRistIewSwKyTmijt.jpg", backdrop_path: "/rOmUuQEZfPXglwFs5ELLLUDKodL.jpg", vote_average: 6.9 },
      333348: { id: 333348, title: "Любите Куперов", original_title: "Love the Coopers", original_language: "en", release_date: "2015-11-12", poster_path: "/vsjN3e0rZtgNQJ3G3uHWl5slRzt.jpg", backdrop_path: "/5DxFiNyWHCH58nffyCtzMfPjDLJ.jpg", vote_average: 6 },
      10719: { id: 10719, title: "Эльф", original_title: "Elf", original_language: "en", release_date: "2003-11-07", poster_path: "/13xe656nxTO8P6Vu9Q8NvZr0oLW.jpg", backdrop_path: "/5nhp41gx49vXjwXuDXJwQrRFsng.jpg", vote_average: 6.7 },
      12193: { id: 12193, title: "Четыре рождества", original_title: "Four Christmases", original_language: "en", release_date: "2008-11-26", poster_path: "/cJFKttK4Ho6ZT3qaAEQ8CQWk6j4.jpg", backdrop_path: "/6ZuYKN5wJKcuCw7o1WsbjYo68vz.jpg", vote_average: 5.8 },
      549053: { id: 549053, title: "Рождество на двоих", original_title: "Last Christmas", original_language: "en", release_date: "2019-11-07", poster_path: "/roKNRGo1yBh9JIGRorA950VZWOB.jpg", backdrop_path: "/qIjyBgsMDbpeEO3CJx7vxVn4KO8.jpg", vote_average: 7.2 },
      9279: { id: 9279, title: "Подарок на Рождество", original_title: "Jingle All the Way", original_language: "en", release_date: "1996-11-21", poster_path: "/pvtBqCJTfrAgGk6GY1InurtsUiX.jpg", backdrop_path: "/rnn6sGMGPpM8VfVmCMFxsjKvz7q.jpg", vote_average: 6.1 },
      1581: { id: 1581, title: "Отпуск по обмену", original_title: "The Holiday", original_language: "en", release_date: "2006-12-05", poster_path: "/s8nco4vYuVwWFvxXR3vyGmS5K7F.jpg", backdrop_path: "/9Ebn8atCcGk5OZrx4xmoTobAxoh.jpg", vote_average: 7.1 },
      10147: { id: 10147, title: "Плохой Санта", original_title: "Bad Santa", original_language: "en", release_date: "2003-11-26", poster_path: "/R5NT42mCvRKPhr90VAMb6U5hpI.jpg", backdrop_path: "/tbmNzJIc7R1MuEweCOThpTzglyx.jpg", vote_average: 6.6 },
      77762: { id: 77762, title: "Зима в Простоквашино", original_title: "Зима в Простоквашино", original_language: "ru", release_date: "1984-06-06", poster_path: "/pgi6rkXMfy1VHt719rLu45j7QgF.jpg", backdrop_path: "/tSFzbtykmAGOK0qjBF3sxaZfiMh.jpg", vote_average: 7.7 },
      508: { id: 508, title: "Реальная любовь", original_title: "Love Actually", original_language: "en", release_date: "2003-09-07", poster_path: "/bvgazyuurl8il9nYsXMU7aulWGL.jpg", backdrop_path: "/xUWf5xX0AnZgAnYXAMk03zTbsef.jpg", vote_average: 7.1 },
      5825: { id: 5825, title: "Рождественские каникулы", original_title: "National Lampoon's Christmas Vacation", original_language: "en", release_date: "1989-11-30", poster_path: "/pbCj0ASDSB7rhWmK4n4HLYCPZA2.jpg", backdrop_path: "/klH8ti8LUaEhktnjdHb1RW8Yq6w.jpg", vote_average: 7.2 },
      828613: { id: 828613, title: "Ирония судьбы в Голливуде", original_title: "About Fate", original_language: "en", release_date: "2022-09-08", poster_path: "/v1RPt1W0pt1sIM4Ifxlrm9QB3Yv.jpg", backdrop_path: "/30COvn7g7PP58wBkrnnh7Ws9bJS.jpg", vote_average: 7.5 },
      771: { id: 771, title: "Один дома", original_title: "Home Alone", original_language: "en", release_date: "1990-11-16", poster_path: "/e6TQfEJbaFqueq1CIvqfpse4yNF.jpg", backdrop_path: "/ih2xVgeMS8R5WUetYE8Mr9hVTlB.jpg", vote_average: 7.5 },
      772: { id: 772, title: "Один дома 2: Затерянный в Нью-Йорке", original_title: "Home Alone 2: Lost in New York", original_language: "en", release_date: "1992-11-15", poster_path: "/tOpSeLYsZLL4h1N9tHcqRm1Y5t2.jpg", backdrop_path: "/8fnYJPoXxwAN4valDLgz2whMGTH.jpg", vote_average: 6.8 },
      384682: { id: 384682, title: "Новогодний корпоратив", original_title: "Office Christmas Party", original_language: "en", release_date: "2016-11-25", poster_path: "/Be3cJSkUbD6WOaZfLuThH5MguC.jpg", backdrop_path: "/1uDvPjKthACQKeQBvkiJ3aSvtdh.jpg", vote_average: 5.7 },
      41977: { id: 41977, title: "Чародеи", original_title: "Чародеи", original_language: "ru", release_date: "1982-12-31", poster_path: "/1wC5WNWYKxosp9jcKPZvk9Q8HiW.jpg", backdrop_path: "/a7sOwNj0uXTPE8PY2seDlsT41LN.jpg", vote_average: 7 },
      57809: { id: 57809, title: "Ёлки", original_title: "Ёлки", original_language: "ru", release_date: "2010-12-12", poster_path: "/3e3lGXn5nvJ42IN5CxXDdCh8AJa.jpg", backdrop_path: "/iTV9vaIehH1XHsxit1AmBWFWOTk.jpg", vote_average: 6.4 },
      85317: { id: 85317, title: "Ёлки 2", original_title: "Ёлки 2", original_language: "ru", release_date: "2011-12-15", poster_path: "/GaTjRzfITdgkK2ARIQkE4mtoKo.jpg", backdrop_path: "/kJ2fIU3SPwZYSKMOkV6HjsVh9JD.jpg", vote_average: 6.6 },
      63258: { id: 63258, title: "Карнавальная ночь", original_title: "Карнавальная ночь", original_language: "ru", release_date: "1956-12-29", poster_path: "/yQ0Vk0FifhPr21K7oGqBSSkiXF9.jpg", backdrop_path: "/tbt8vxgw6Zkrzc1YvCKw4Rul8ef.jpg", vote_average: 7 },
      43430: { id: 43430, title: "Ирония судьбы, или С легким паром!", original_title: "Ирония судьбы, или С легким паром!", original_language: "ru", release_date: "1976-01-01", poster_path: "/oqAwCig5JzaX896QImeVZCXXcpG.jpg", backdrop_path: "/1kShjfoNZe0wTF16jvPaX8OOel1.jpg", vote_average: 7.3 }
    };

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Названия ключевых слов фильма одним массивом строк в нижнем регистре.
       Принимает {results:[…]} (movie), {keywords:[…]} (tv) и голый массив. */
    function keywordNames(source) {
      var list = null;
      if (Array.isArray(source)) list = source;
      else if (source && Array.isArray(source.results)) list = source.results;
      else if (source && Array.isArray(source.keywords)) list = source.keywords;
      if (!list) return [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var item = list[i];
        var name = item && typeof item === 'string' ? item : (item && item.name);
        if (name) out.push(('' + name).toLowerCase());
      }
      return out;
    }

    /* Идентификаторы жанров фильма. TMDB отдаёт их объектами в деталях
       (genres:[{id,name}]) и числами в списках (genre_ids:[28,12]). */
    function genreIds(movie) {
      var list = (movie && movie.genres) || (movie && movie.genre_ids) || [];
      if (!Array.isArray(list)) return [];
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var g = list[i];
        var id = (g && typeof g === 'object') ? g.id : g;
        if (id != null) out.push(Number(id));
      }
      return out;
    }

    function hasGenre(ids, want) {
      if (!want || !want.length) return true;
      for (var i = 0; i < want.length; i++) {
        for (var j = 0; j < ids.length; j++) {
          if (Number(want[i]) === ids[j]) return true;
        }
      }
      return false;
    }

    /* Буква или цифра — продолжение слова; всё остальное (пробел, дефис,
       апостроф, край строки) — его граница. */
    var WORD_CHAR = /[a-z0-9À-ɏЀ-ӿ]/;

    /* Слово (или фраза) want стоит в name целым: вокруг вхождения — границы
       слова. Все вхождения, а не первое: в «sandwich sand» первое «sand» —
       часть слова, второе — целое.
       Волна «хвосты героя», п.E (ревью perf): и во множественном числе —
       ключевые слова TMDB нередко «zombies», «explosions», «witches».
       Окончание — по правилу английского: -es после s/x/z/ch/sh, иначе -s;
       за окончанием — граница слова. «wares» поэтому не «war», а «award»
       отсекает левая граница, как и прежде. */
    function pluralOf(want) {
      return /(s|x|z|ch|sh)$/.test(want) ? 'es' : 's';
    }

    function hasWord(name, want) {
      var tail = pluralOf(want);
      var at = name.indexOf(want);
      while (at >= 0) {
        var before = at > 0 ? name.charAt(at - 1) : '';
        var end = at + want.length;
        var after = name.charAt(end);
        if (after && name.substr(end, tail.length) === tail) {
          var past = name.charAt(end + tail.length);
          if (!(past && WORD_CHAR.test(past))) after = '';
        }
        if (!(before && WORD_CHAR.test(before)) && !(after && WORD_CHAR.test(after))) return true;
        at = name.indexOf(want, at + 1);
      }
      return false;
    }

    /* Совпало хотя бы одно ключевое слово правила — целым словом или целой
       фразой, без учёта регистра: «Christmas Eve» ловится словом
       «christmas», «journey into outer space» — фразой «outer space».
       Волна производительности (2026-09-24): прежде хватало вхождения
       подстроки, и частицы — самая дорогая часть «Полного» режима —
       доставались фильмам не по теме: «war» ловился в «award» и «edward»,
       «sea» — в «seattle» и «research», «sand» — в «sandwich», «space» — в
       «workspace». */
    function hasKeyword(names, keywords) {
      if (!keywords || !keywords.length) return false;
      for (var i = 0; i < keywords.length; i++) {
        var want = ('' + keywords[i]).toLowerCase();
        if (!want) continue;
        for (var j = 0; j < names.length; j++) {
          if (hasWord(names[j], want)) return true;
        }
      }
      return false;
    }

    /* Первое подходящее правило по порядку массива либо null. requireGenre
       требует И слово, И жанр: слово «halloween» у комедии — это шутка про
       праздник, а не хоррор, и летучих мышей ей рисовать незачем. */
    function matchTheme(rules, movie) {
      if (!Array.isArray(rules) || !movie) return null;
      var names = keywordNames(movie.keywords);
      if (!names.length) return null;
      var ids = genreIds(movie);
      for (var i = 0; i < rules.length; i++) {
        var rule = rules[i];
        if (!rule || !rule.preset) continue;
        if (!hasKeyword(names, rule.keywords)) continue;
        if (rule.requireGenre && !hasGenre(ids, rule.genres)) continue;
        return rule;
      }
      return null;
    }

    /* Показывать ли тему при режиме настройки mode в месяце month.
       'off' — никогда; 'all' — всякую найденную; 'seasonal' — только тему со
       списком months и только в один из этих месяцев (декабрьский снег есть,
       августовского нет). */
    function allowed(theme, mode, month) {
      if (!theme || mode === 'off') return false;
      if (mode !== 'seasonal') return true;
      var months = theme.months;
      if (!Array.isArray(months) || !months.length) return false;
      for (var i = 0; i < months.length; i++) {
        if (Number(months[i]) === Number(month)) return true;
      }
      return false;
    }

    /* Идентификаторы подборок, у которых season включает month. Месяц 0,
       null или undefined — пустой список (сезонный порядок выключен). */
    function seasonalIds(collections, month) {
      var out = [];
      if (!Array.isArray(collections) || !month) return out;
      for (var i = 0; i < collections.length; i++) {
        var c = collections[i];
        if (!c || !Array.isArray(c.season)) continue;
        for (var j = 0; j < c.season.length; j++) {
          if (Number(c.season[j]) === Number(month)) { out.push(c.id); break; }
        }
      }
      return out;
    }

    /* Месяц даты как 1..12 (getMonth даёт 0..11). */
    function monthOf(date) {
      if (!date || typeof date.getMonth !== 'function') return 0;
      return date.getMonth() + 1;
    }

    /* ------------------------------------------------------------------ */
    /* Раунд holB: праздничные сцены — Новый год и Хэллоуин.               */
    /*                                                                     */
    /* Пользователь: праздничные частицы видны и в «Лёгких» (30 fps, пауза */
    /* при листании); после скрина «Одиссеи» с лучами и пузырями —         */
    /* «оставим только Рождество и Хэллоуин, а оформление потом будем      */
    /* руками докидывать». Сцена показывается:                             */
    /*  - на главной (кадр героя) в окно праздника — у ЛЮБОГО фильма под   */
    /*    фокусом: это оформление дня, а не фильма, и при листании она не  */
    /*    мигает (слой переживает смену фильма — keep в src/52_fx.js);      */
    /*  - у новогодних и рождественских фильмов и у хэллоуинских хорроров  */
    /*    — по ключевым словам (правила christmas и halloween каталога),   */
    /*    на главной и в карточке, как прежде.                             */
    /* Прочие темы по ключевым словам — за флагом LC.fxAutoThemes (в начале */
    /* модуля).                                                            */
    /*                                                                     */
    /* Окна — даты включительно, [месяц, день]. Новый год — сезон под СНГ, */
    /* с 1 декабря по 7 января (решение пользователя 2026-09-26), через    */
    /* границу года;                                                      */
    /* Хэллоуин — неделя до 31 октября и 1 ноября.                        */
    /* id праздника — и класс lumen-theme--<id> на кадре героя. У          */
    /* Хэллоуина он совпадает с темой фильма нарочно: дымка по низу и      */
    /* тыквенное зарево (src/30_css.js) — часть той же сцены.              */
    /* ------------------------------------------------------------------ */

    var HOLIDAYS = [
      { id: 'newyear', from: [12, 1], to: [1, 7], preset: 'winter', accent: '#E8C170' },
      { id: 'halloween', from: [10, 25], to: [11, 1], preset: 'halloween', accent: '#E07B2C' }
    ];

    /* Правила каталога, которые работают и при выключенных автотемах: это
       те же два праздника, но «по фильму». Значение — id праздника в
       HOLIDAYS: при «Только сезонные» сцена фильма живёт в его окне
       (forMovie), а не в месяцах months правила. */
    var HOLIDAY_RULES = { christmas: 'newyear', halloween: 'halloween' };

    /* Ключ даты «месяц·100 + день»: окна сравниваются числами. */
    function dayKey(date) {
      if (!date || typeof date.getMonth !== 'function' || typeof date.getDate !== 'function') return 0;
      return (date.getMonth() + 1) * 100 + date.getDate();
    }

    function inWindow(key, from, to) {
      var a = from[0] * 100 + from[1];
      var b = to[0] * 100 + to[1];
      /* Окно через границу года (1.12–7.01): «после начала ИЛИ до конца». */
      return a <= b ? (key >= a && key <= b) : (key >= a || key <= b);
    }

    function holidayAt(date) {
      var key = dayKey(date);
      if (!key) return null;
      for (var i = 0; i < HOLIDAYS.length; i++) {
        if (inWindow(key, HOLIDAYS[i].from, HOLIDAYS[i].to)) return HOLIDAYS[i];
      }
      return null;
    }

    /* Тема из записи календаря — в том же виде, что правило каталога:
       герой ставит класс lumen-theme--<id> и берёт цвет particleColor. */
    function themeOf(entry) {
      return { id: entry.id, preset: entry.preset, accent: entry.accent, holiday: true };
    }

    /* Правила тем, которые сейчас в игре: все — при LC.fxAutoThemes, иначе
       только праздничные (HOLIDAY_RULES). */
    function rulesNow() {
      var rules = current();
      if (LC.fxAutoThemes === true) return rules;
      var out = [];
      for (var i = 0; i < rules.length; i++) {
        if (rules[i] && HOLIDAY_RULES[rules[i].id]) out.push(rules[i]);
      }
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Раунд holB: адвент под СНГ.                                         */
    /*                                                                     */
    /* 31 окошко — все видны. Прошедшие и сегодняшнее открыты (фильм дня), */
    /* будущие закрыты: на месте постера дверца с датой и замком, фильма   */
    /* в карточке нет вовсе (ни id, ни постера) — кадр героя его не        */
    /* покажет, дедупликация главной не тронет, OK не откроет              */
    /* (src/44_rows.js). 31-е — «Ирония судьбы», особая плитка и закрытой. */
    /*                                                                     */
    /* Запись версии 2: игнорируем прежний автоподбор и прошлые годы. */
    function adventMap(opened, year) {
      if (!opened || opened.v !== 2 || Number(opened.y) !== year) return {};
      var d = opened.d;
      return d && typeof d === 'object' ? d : {};
    }

    function adventId(day, value) {
      if (!/^[1-9]\d{0,9}$/.test(String(value))) return null;
      var id = Number(value);
      if ((day === ADVENT_DAYS) !== (id === ADVENT_FINAL_ID)) return null;
      return ADVENT_LIST.indexOf(id) !== -1 ? id : null;
    }

    /* Копия карточки фильма с полями окошка. У неполного перевода
       недостающие поля (например постер) остаются из посева. */
    function adventCard(seed, translated, day, state, words, fresh) {
      var copy = {};
      for (var k in seed) {
        if (!Object.prototype.hasOwnProperty.call(seed, k)) continue;
        var value = translated && translated[k];
        copy[k] = value == null || value === '' ? seed[k] : value;
      }
      copy.id = seed.id;
      copy.source = 'tmdb';
      if (translated && !/\S/.test(translated.title || '')) copy.title = copy.original_title;
      if (!/\S/.test(copy.title || '')) copy.title = copy.original_title;
      var dayWord = (words && words.day) || 'День';
      var todayWord = (words && words.today) || 'Сегодня';
      copy.day = day;
      /* Метка сегодняшнего — одно «Сегодня»: «Сегодня · день 15» не
         помещалась в строку и рвалась надвое (стенд 960×540@2); число дня
         видно и так — соседи «День 14» и дверцы «16 декабря».
         Раунд C, C1: метка — в подписи под плиткой вместо «год · ★»
         (label, рисует src/44_rows.js, adventCreate), а не плашкой на
         постере (lumen_badge): плашка закрывала название фильма на самом
         постере — «Сегодня» на «Иронии судьбы», «День 29» на «Один дома»,
         «День 13» на «Маленьких женщинах» (e2e 2026-09-26). */
      copy.lumen_advent = { day: day, state: state, label: state === 'today' ? todayWord : dayWord + ' ' + day };
      if (fresh) copy.lumen_advent.fresh = true;
      if (day === ADVENT_DAYS) copy.lumen_advent.final = true;
      return copy;
    }

    /* Будущее окошко: дата и замок, без данных фильма. */
    function adventDoor(day, words) {
      var date = (words && words.date) || '{d}';
      var door = { day: day, title: date.replace('{d}', day), lumen_advent: { day: day, state: 'locked' } };
      if (day === ADVENT_DAYS) door.lumen_advent.final = true;
      return door;
    }

    /* 31 окошко в декабре, иначе пустой список. src.cards — переводы по id.
       Открытый фильм остаётся на своём дне при перестановке списка. */
    function adventDays(src, today, words, opened) {
      var out = [];
      if (!today || typeof today.getMonth !== 'function' || today.getMonth() !== 11) return out;
      var now = today.getDate();
      var map = adventMap(opened, today.getFullYear());
      var translations = src && src.cards;
      for (var day = 1; day <= ADVENT_DAYS; day++) {
        if (day > now) {
          out.push(adventDoor(day, words));
          continue;
        }
        var saved = adventId(day, map[day]);
        var id = saved || ADVENT_LIST[day - 1];
        var state = day === now ? 'today' : 'open';
        out.push(adventCard(ADVENT_SEED[id], translations && translations[id], day, state, words, state === 'today' && saved === null));
      }
      return out;
    }

    /* Сливаем запись текущего года: шаг часов назад не закрывает дни,
       которые уже успели открыть. */
    function adventRecord(cards, today, old) {
      var rec = { y: today && typeof today.getFullYear === 'function' ? today.getFullYear() : 0, v: 2, d: {} };
      var prev = adventMap(old, rec.y);
      for (var day = 1; day <= ADVENT_DAYS; day++) {
        var id = adventId(day, prev[day]);
        if (id !== null) rec.d[day] = id;
      }
      for (var i = 0; i < (cards || []).length; i++) {
        var c = cards[i];
        var info = c && c.lumen_advent;
        if (!info || (info.state !== 'open' && info.state !== 'today')) continue;
        var n = Number(info.day);
        if (n < 1 || n > ADVENT_DAYS || Math.floor(n) !== n) continue;
        var cardId = adventId(n, c.id);
        if (cardId !== null) rec.d[n] = cardId;
      }
      return rec;
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    /* Правила тем из манифеста (обновляются с хостинга без переустановки
       плагина — см. src/42_manifest.js).

       Найдено живой проверкой (2026-09-17): каталог с хостинга, собранный
       ДО этой задачи, поля themes не содержит вовсе, а кэшируется он на 12
       часов — и правил не было бы ни у кого, кто уже открывал плагин.
       Поэтому пустое (или отсутствующее) поле означает «каталог про темы
       не знает», и мы берём встроенный набор: правила тем — часть кода
       фичи, а не только данные. Каталог со СВОИМИ темами встроенные
       заменяет целиком, как и задумано. */
    function current() {
      try {
        var m = LC.manifest && typeof LC.manifest.get === 'function' ? LC.manifest.get() : null;
        if (m && Array.isArray(m.themes) && m.themes.length) return m.themes;
        var built = LC.manifest && LC.manifest.DEFAULT && LC.manifest.DEFAULT.themes;
        if (Array.isArray(built)) return built;
      } catch (e) {
        warn('themes: manifest failed', e);
      }
      return [];
    }

    /* Значение настройки «Атмосферы». Значения по умолчанию — 'seasonal':
       вид карточки без спроса менять нельзя, а праздничная тема раз в год
       воспринимается как оформление, а не как сюрприз. */
    function mode() {
      var value = 'seasonal';
      try {
        if (LC.pref) value = LC.pref('lumen_fx', 'seasonal');
      } catch (e) { }
      if (value !== 'all' && value !== 'seasonal' && value !== 'off') return 'seasonal';
      return value;
    }

    /* Раунд holB: главная ли на экране. Одна функция forMovie обслуживает и
       кадр героя (src/48_hero.js, applyFx), и карточку фильма
       (src/90_runtime.js, LC.applyFxFor), а праздник и сезон положены только
       главной. Признак — состояние героя: открытие карточки — это старт
       чужой активности, и герой паркуется ДО её complite (park по
       'activity':start); возврат снимает парковку ДО того, как герой
       ставит атмосферу заново (resume -> applyFx). Героя нет (главная без
       кадра, тесты модуля в одиночку) — значит и главной с кадром нет. */
    function onHome() {
      try {
        var hero = LC.hero;
        if (!hero || typeof hero.active !== 'function' || !hero.active()) return false;
        return !(typeof hero.parked === 'function' && hero.parked());
      } catch (e) {
        return false;
      }
    }

    /* Тема, которую можно показать фильму прямо сейчас, либо null. Одна
       точка на карточку и герой: оба зовут её и оба получают одинаковый
       ответ при одинаковых данных.
       Раунд holB: на главной первым — праздник дня (он общий для всей
       главной, и при листании сцена не сменяется на каждом фильме), потом
       тема фильма — из rulesNow(): при выключенных автотемах только
       новогодняя и хэллоуинская. Гейт по режиму анимаций здесь не решается:
       праздничные сцены LC.fx.mount запустит и в «Лёгких», прочие — только
       в «Полных» с «Тяжёлыми эффектами» (src/52_fx.js, allowedNow). */
    /* Новый год, шаг 1: праздник дня для кадра главной — без фильма. Тема
       зависит только от даты и настройки «Атмосферы», поэтому герой ставит
       сцену при сборке, не дожидаясь деталей TMDB (src/48_hero.js, applyFx),
       и не снимает её при листании. null — праздника сегодня нет или
       «Атмосферы» выключены. */
    function forHome() {
      if (mode() === 'off') return null;
      var holiday = holidayAt(api._now());
      return holiday ? themeOf(holiday) : null;
    }

    function forMovie(movie) {
      var current_mode = mode();
      if (current_mode === 'off') return null;
      var today = api._now();
      if (onHome()) {
        var holiday = forHome();
        if (holiday) return holiday;
      }
      var theme = matchTheme(rulesNow(), movie);
      /* Финальная проверка, B8 (logic-rows S1): при «Только сезонные»
         новогодняя и хэллоуинская сцена фильма — в окно своего праздника
         (Новый год 1.12–7.01, Хэллоуин 25.10–1.11, решение пользователя
         2026-09-26), а не весь январь и весь октябрь по months каталога.
         «Все» — как прежде, круглый год. */
      if (theme && current_mode === 'seasonal' && typeof HOLIDAY_RULES[theme.id] === 'string') {
        var span = holidayAt(today);
        return span && span.id === HOLIDAY_RULES[theme.id] ? theme : null;
      }
      if (!allowed(theme, current_mode, monthOf(today))) return null;
      return theme;
    }

    /* Пресеты, которым идёт светлый цвет вместо акцента темы: снег, звёзды,
       дождь и пузыри — это вода и свет, а не предмет, и золотой снег
       выглядел бы ошибкой. Остальные красятся акцентом своей темы.
       Зимняя сцена (winter) — тоже: белый у неё — цвет снега, а огни
       гирлянды и боке берут свою палитру (LIGHTS в src/52_fx.js). */
    var PALE = { snow: 1, stars: 1, rain: 1, bubbles: 1, winter: 1 };

    /* Цвет частиц темы. Одна точка на карточку и герой — иначе снег в кадре
       главной и снег в карточке могли бы разойтись по цвету. */
    function particleColor(theme) {
      if (!theme) return '#FFFFFF';
      if (PALE[theme.preset]) return '#FFFFFF';
      return theme.accent || '#FFFFFF';
    }

    /* Классы всех известных тем одной строкой — для removeClass перед тем,
       как поставить класс новой темы: список тем живёт в манифесте и может
       прийти с хостинга, поэтому зашивать его в рантайм нельзя. */
    function classNames() {
      /* Раунд holB: и классы праздников — иначе класс lumen-theme--newyear
         с кадра героя не снимался бы никогда. */
      var rules = current().concat(HOLIDAYS);
      var out = [];
      var seen = {};
      for (var i = 0; i < rules.length; i++) {
        var id = rules[i] && rules[i].id;
        if (!id || seen[id]) continue;
        seen[id] = 1;
        out.push('lumen-theme--' + id);
      }
      return out.join(' ');
    }

    /* Хук даты. Живая проверка адвента подменяет его
       (window.lumen_card.themes._now = function () { … }), поэтому month() и
       адвент читают время ЧЕРЕЗ api, а не через локальную ссылку: иначе
       подмена снаружи ничего бы не меняла. */
    function now() {
      return new Date();
    }

    var api = {
      matchTheme: matchTheme,
      allowed: allowed,
      seasonalIds: seasonalIds,
      adventDays: adventDays,
      adventRecord: adventRecord,
      ADVENT_LIST: ADVENT_LIST,
      ADVENT_SEED: ADVENT_SEED,
      ADVENT_DAYS: ADVENT_DAYS,
      ADVENT_FINAL_ID: ADVENT_FINAL_ID,
      monthOf: monthOf,
      month: function () { return monthOf(api._now()); },
      today: function () { return api._now(); },
      HOLIDAYS: HOLIDAYS,
      holidayAt: holidayAt,
      holiday: function () { return holidayAt(api._now()); },
      current: current,
      classNames: classNames,
      particleColor: particleColor,
      mode: mode,
      forMovie: forMovie,
      forHome: forHome,
      _now: now
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.themes;

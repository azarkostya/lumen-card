  /* -------------------------------------------------------------------- */
  /* Task 9: русские отзывы Кинопоиска (экраны 07 — ряд, 08 — модал,       */
  /* 13 — подсказка без ключа).                                            */
  /*                                                                       */
  /* Источник — kinopoiskapiunofficial.tech: CORS открыт (`*`, заголовок   */
  /* x-api-key разрешён — docs/research/API_NOTES_2.md §4), прокси не      */
  /* нужен, ключ вводит пользователь (Настройки -> Lumen Card).            */
  /*                                                                       */
  /* Чистая часть (normalize/cacheKey/isFresh) не знает про Lampa и DOM —  */
  /* грузится обычным test/_load.mjs. Кэш, загрузка и рендер читают        */
  /* window/Lampa/$ ТОЛЬКО по вызову, поэтому модуль целиком остаётся      */
  /* загружаемым в тестах без браузера.                                    */
  /*                                                                       */
  /* Блок встраивается в тело ряда описания (.full-descr) соседом таблицы  */
  /* «ПОДРОБНО» из Task 5d: своего типа ряда в Lampa создать нельзя (план  */
  /* 0.2), а контроллер full_descr собирает .selector внутри всего ряда.   */
  /* -------------------------------------------------------------------- */

  LC.reviews = (function () {

    var BASE = 'https://kinopoiskapiunofficial.tech/api/v2.2/films';
    var TTL = 24 * 3600 * 1000;
    /* Ревью (Important 5): «отзывов нет» кэшируется отдельным коротким сроком —
       иначе фильм без отзывов тратил бы два запроса на каждое открытие
       карточки при бесплатной квоте 500 запросов в день. */
    var EMPTY_TTL = 2 * 3600 * 1000;
    /* Поправки контроллера: кэш ограничен по числу фильмов, текст отзыва не
       длиннее 4000 символов — иначе несколько карточек переполняют
       localStorage на ТВ (квота ~5 МБ делится со всей Lampa).
       Ревью (Important 4): произведение пределов и есть верхняя оценка кэша в
       UTF-16 — 8 × 12 × 4000 ≈ 770 КБ вместо ~2 МБ при прежних 20 фильмах.
       Режем число фильмов, а не `full`: полный текст нужен модалу и после
       перезагрузки, иначе окно показывало бы обрезанный отзыв. */
    var MAX_FILMS = 8;
    var MAX_FULL = 4000;
    var MAX_EXCERPT = 300;
    var MAX_ITEMS = 12;
    var TIMEOUT_MS = 8000;
    var INDEX_KEY = 'lumen_rv_index';
    var ANON = 'Аноним';

    var esc = LC.util.esc;

    /* ------------------------------------------------------------------ */
    /* Чистая часть.                                                       */
    /* ------------------------------------------------------------------ */

    function cacheKey(imdbId) { return 'lumen_rv_' + imdbId; }

    function now(value) { return typeof value === 'number' ? value : Date.now(); }

    /* Срок жизни записи: сутки для найденных отзывов, EMPTY_TTL для «отзывов
       нет» (Important 5). Запись без списка считается пустой — так же ведёт
       себя и запись вида {at: …} из теста плана. */
    function ttlOf(rec) {
      return (rec && rec.list && rec.list.length) ? TTL : EMPTY_TTL;
    }

    function isFresh(rec, at) {
      return !!(rec && rec.at && (now(at) - rec.at) < ttlOf(rec));
    }

    /* Обрезка с многоточием: длина результата никогда не превышает limit
       (limit-1 символ + «…»). Режем ИСХОДНЫЙ текст и только потом
       экранируем — обратный порядок рвал бы html-сущность пополам
       (&amp; -> &am). */
    function cut(text, limit) {
      if (text.length <= limit) return text;
      return text.slice(0, limit - 1) + '…';
    }

    function trim(str) {
      return ('' + (str || '')).replace(/^\s+|\s+$/g, '');
    }

    /* Отпечаток ключа API для подписи рендера (ревью, Important 2): нужен
       ровно для того, чтобы ЛЮБАЯ смена ключа меняла подпись — включая
       исправление опечатки, когда «ключ был и остался». Сам ключ в подпись не
       кладём: она живёт в JS-объекте на DOM-узле, и хранить там секрет незачем.
       djb2 — самый дешёвый способ, криптостойкость здесь не требуется. */
    function keyStamp(key) {
      if (!key) return '0';
      var h = 5381;
      for (var i = 0; i < key.length; i++) h = ((h << 5) + h + key.charCodeAt(i)) | 0;
      return key.length + ':' + (h >>> 0);
    }

    /* Отзыв без своего заголовка: первое законченное предложение (10-80
       символов), иначе просто начало текста. */
    function firstSentence(text) {
      var m = text.match(/^(.{10,80}?[.!?])\s/);
      return m ? m[1] : text.slice(0, 60);
    }

    /* Экран 09 («Ключ Kinopoisk API — нужен для отзывов и рейтинга КП»):
       рейтинг приходит ТЕМ ЖЕ ответом films?imdbId, которым мы ищем
       kinopoiskId для отзывов, — отдельного запроса ради рейтинга не делаем.
       Поле приходит числом или строкой, у фильмов без оценок — null. */
    function kpRateOf(item) {
      var rate = parseFloat(item && item.ratingKinopoisk);
      if (!rate || rate <= 0) return 0;
      return rate > 10 ? 10 : rate;
    }

    /* Рейтинг ставит на чип .rate--kp рантайм (LC.applyKpRate, 90_runtime.js):
       он знает про DOM активной карточки, этот модуль — только про данные.
       Зовётся и на попадании в кэш, и на свежем ответе. */
    function reportRate(rate, onRate) {
      try {
        if (!(rate > 0)) return;
        /* onRate задаёт render(): он знает, какому ряду принадлежит ответ, и
           не даёт рейтингу уехать на чужую карточку (ревью Task 10, п.2).
           Прямой вызов load() без него (тесты, будущие точки) остаётся на
           общем LC.applyKpRate. */
        if (typeof onRate === 'function') { onRate(rate); return; }
        if (typeof LC.applyKpRate === 'function') LC.applyKpRate(rate);
      } catch (e) {
        warn('kp rate apply failed', e);
      }
    }

    /* resp — ответ /reviews. anon — как подписывать отзыв без автора (строка
       интерфейса приходит параметром: модуль остаётся чистым и не зависит от
       LC.lang, как LC.cardinfo от словаря words). */
    function normalize(resp, anon) {
      var items = (resp && resp.items) || [];
      var out = [];
      if (!items || typeof items.length !== 'number') return out;
      LC.util.each(items, function (it) {
        if (!it) return;
        var text = trim(('' + (it.description || '')).replace(/\s+/g, ' '));
        if (!text) return;
        var title = trim(('' + (it.title || '')).replace(/\s+/g, ' '));
        if (!title) title = firstSentence(text);
        var author = trim(it.author) || anon || ANON;
        var dm = ('' + (it.date || '')).match(/^(\d{4})-(\d{2})-(\d{2})/);
        out.push({
          tone: it.type === 'POSITIVE' ? 'good' : (it.type === 'NEGATIVE' ? 'bad' : 'mid'),
          author: esc(author),
          initials: esc(LC.util.initials(author)),
          title: esc(title),
          excerpt: esc(cut(text, MAX_EXCERPT)),
          full: esc(cut(text, MAX_FULL)),
          date: dm ? dm[3] + '.' + dm[2] + '.' + dm[1] : '',
          likes: parseInt(it.positiveRating, 10) || 0,
          dislikes: parseInt(it.negativeRating, 10) || 0
        });
      });
      return out;
    }

    /* ------------------------------------------------------------------ */
    /* Кэш в Lampa.Storage: ключ на фильм + общий индекс для вытеснения.    */
    /* ------------------------------------------------------------------ */

    function storage() {
      try {
        if (window.Lampa && Lampa.Storage && typeof Lampa.Storage.get === 'function') return Lampa.Storage;
      } catch (e) { }
      return null;
    }

    /* Ревью (Minor 7): проверки на .length мало — Storage.get при битом JSON
       возвращает исходную СТРОКУ, у неё length тоже число, и индекс молча
       перезаписался бы одной записью, а прежние фильмы остались бы сиротами в
       localStorage. Принимаем только настоящий массив. */
    function readIndex(store) {
      var index = store.get(INDEX_KEY, []);
      return Object.prototype.toString.call(index) === '[object Array]' ? index : [];
    }

    /* Ревью (Critical 1): Lampa.Storage.remove(field_name, value) — это НЕ
       удаление ключа, а удаление элемента из синхронизируемого с CUB массива
       (vendor/lampa/app.min.js: `if (workers[field_name]) workers[field_name]
       .remove(value)`). Для нашего ключа worker'а нет, вызов был тихим no-op,
       и вытесненная запись продолжала лежать в localStorage целиком — кэш рос
       без предела. Поэтому: всегда обнуляем значение через Storage (get
       отдаёт default на пустом значении — план 0.2), а сам ключ убираем из
       localStorage напрямую, чтобы освободить место. */
    function drop(store, id) {
      try { store.set(cacheKey(id), ''); } catch (e) { }
      try {
        if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(cacheKey(id));
      } catch (e2) { }
    }

    /* Квота кончилась — держать половину кэша бессмысленно: чистим все свои
       записи по индексу (плюс сам индекс) и пробуем жить дальше. */
    function purge(store) {
      try {
        LC.util.each(readIndex(store), function (it) { if (it && it.id) drop(store, it.id); });
        store.set(INDEX_KEY, []);
        try {
          if (typeof window !== 'undefined' && window.localStorage) window.localStorage.removeItem(INDEX_KEY);
        } catch (e2) { }
      } catch (e) {
        warn('reviews cache purge failed', e);
      }
    }

    /* Ревью 2 (п.2): на callerror полагаться нельзя. Lampa зовёт его ТОЛЬКО
       при e.name == 'QuotaExceededError' (app.min.js, Storage.set) — старые
       WebKit/Tizen бросают QUOTA_EXCEEDED_ERR, Firefox —
       NS_ERROR_DOM_QUOTA_REACHED, и там исключение глотается молча: значение
       остаётся в памяти Storage (readed) и в reserve/IndexedDB, а места в
       localStorage нет. Поэтому факт записи проверяем сами — по самому
       localStorage. Если его нет вовсе (экзотическая сборка), проверять
       нечего: доверяем Storage. */
    function stored(key, value) {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return true;
        var raw = window.localStorage.getItem(key);
        if (raw === null || raw === '') return false;
        var want;
        try { want = JSON.stringify(value); } catch (e) { return true; }
        /* Обрезанное или чужое значение — тоже «не сохранилось». */
        return raw.length === want.length;
      } catch (e2) {
        return true;
      }
    }

    /* Lampa.Storage.set(name, value, nolisten, callerror). nolisten = true:
       событие 'change' на каждую запись кэша подписчикам вендора не нужно
       (ревью 2, п.6). Возвращает признак успеха — вызывающая сторона обязана
       на него смотреть, иначе после отказа квоты остаётся рассинхрон индекса
       и записей (ревью 2, п.1). */
    function put(store, key, value) {
      var failed = false;
      try {
        store.set(key, value, true, function (err) {
          failed = true;
          warn('reviews cache quota', err);
        });
      } catch (e) {
        failed = true;
        warn('reviews cache quota', e);
      }
      if (!failed && !stored(key, value)) {
        failed = true;
        warn('reviews cache not stored: ' + key);
      }
      if (failed) purge(store);
      return !failed;
    }

    function cacheRead(imdbId, at) {
      try {
        var store = storage();
        if (!store || !imdbId) return null;
        var rec = store.get(cacheKey(imdbId), null);
        if (!isFresh(rec, at)) return null;
        /* Ревью (Minor 9): total уходит в разметку заголовка — из Storage он
           мог прийти чем угодно (битый JSON, ручная правка), поэтому приводим
           к числу здесь, у единственной точки чтения кэша. */
        rec.total = parseInt(rec.total, 10) || 0;
        /* Task 10: рейтинг КП лежит в той же записи — приводим к числу здесь,
           у единственной точки чтения кэша (как total выше). */
        rec.rate = parseFloat(rec.rate) || 0;
        return rec;
      } catch (e) {
        warn('reviews cache read failed', e);
        return null;
      }
    }

    function cacheWrite(imdbId, list, total, at, kp, rate) {
      try {
        var store = storage();
        if (!store || !imdbId) return;
        var stamp = now(at);

        var kept = [];
        LC.util.each(readIndex(store), function (it) {
          if (it && it.id && it.id !== imdbId) kept.push(it);
        });
        kept.push({ id: imdbId, at: stamp });
        /* Вытеснение по at: самые старые уходят первыми, индекс и записи
           остаются согласованными (в индексе ровно те фильмы, что лежат в
           Storage). */
        kept.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
        while (kept.length > MAX_FILMS) drop(store, kept.shift().id);

        /* Ревью (Minor 8): индекс пишется ПЕРВЫМ. Если упадёт запись фильма,
           в индексе окажется id без данных — cacheRead вернёт null и фильм
           просто перезапросится. Обратный порядок оставлял бы запись-сироту,
           которую уже некому вытеснить.
           Ревью 2 (п.1): но если не записался САМ ИНДЕКС, писать фильм нельзя.
           Отказ квоты на индексе запускает purge() — тот чистит записи и
           ставит индекс пустым, место освобождается, и следующая запись фильма
           прошла бы успешно: получился бы ключ, которого нет в индексе, —
           его не вытеснит цикл выше и не найдёт следующий purge(). */
        if (!put(store, INDEX_KEY, kept)) return;
        put(store, cacheKey(imdbId), { at: stamp, list: list, total: total, kp: kp || 0, rate: rate || 0 });
      } catch (e) {
        warn('reviews cache write failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Загрузка: Storage-кэш -> films?imdbId -> films/{id}/reviews.         */
    /* ------------------------------------------------------------------ */

    /* Сигнатура Reguest (API_NOTES_2 §3): silent(url, ok, err, post_data,
       params); headers уходят прямо в $.ajax. network.timeout(ms)
       сбрасывается на 30000 ПОСЛЕ каждого запроса, поэтому ставится перед
       каждым (и дублируется в params.timeout). */
    function request(net, url, key, ok, err) {
      net.timeout(TIMEOUT_MS);
      net.silent(url, ok, err, false, {
        headers: { 'X-API-KEY': key, 'accept': 'application/json' },
        dataType: 'json',
        timeout: TIMEOUT_MS
      });
    }

    /* cb(result): {list, total} — есть что показать; null — показывать
       нечего (нет id, ошибка сети, пустой ответ); {nokey:true} — ключ не
       задан (подсказка экрана 13). alive() — необязательный сторож
       актуальности (generation guard рендера): как только он вернёт false,
       цепочка обрывается молча — ни второго запроса, ни колбэка.
       Возвращает экземпляр Lampa.Reguest (или null, если запрос не
       понадобился): вызывающая сторона обязана звать net.clear() при смене
       карточки. Уточнение ревью 2 (п.3): clear() у Lampa только очищает
       список вызовов — колбэки больше не отрабатывают, но abort() нет, ответ
       всё равно долетит. Экономится разбор и рендер, а не квота Кинопоиска. */
    function load(imdbId, key, cb, alive, at, onRate) {
      function dead() {
        try { return typeof alive === 'function' && !alive(); } catch (e) { return false; }
      }
      try {
        if (!key) { cb({ nokey: true }); return null; }
        if (!imdbId) { cb(null); return null; }

        var rec = cacheRead(imdbId, at);
        if (rec) {
          /* Task 10: рейтинг КП — даже когда отзывов у фильма нет (отрицательный
             кэш): чип рейтинга от их наличия не зависит. */
          reportRate(rec.rate, onRate);
          cb(rec.list && rec.list.length ? { list: rec.list, total: rec.total || rec.list.length } : null);
          return null;
        }

        if (!window.Lampa || typeof Lampa.Reguest !== 'function') { cb(null); return null; }
        var net = new Lampa.Reguest();

        request(net, BASE + '?imdbId=' + encodeURIComponent(imdbId), key, function (found) {
          if (dead()) return;
          try {
            var item = found && found.items && found.items[0];
            var kp = item && item.kinopoiskId;
            /* Рейтинг ставим сразу, не дожидаясь второго запроса: к отзывам он
               отношения не имеет, а ответ уже на руках. */
            var rate = kpRateOf(item);
            reportRate(rate, onRate);
            if (!kp) { cb(null); return; }
            request(net, BASE + '/' + kp + '/reviews?page=1&order=USER_POSITIVE_RATING_DESC', key, function (resp) {
              if (dead()) return;
              try {
                /* Строки, попадающие в кэш (подпись «Аноним» у отзыва без
                   автора), остаются на языке момента записи — метки тона и
                   «полезно» этим не затронуты: они собираются из item.tone при
                   каждом рендере. Запись живёт максимум сутки, поэтому
                   нормализацию при чтении не городим (ревью, Minor 11). */
                var list = normalize(resp, anonWord()).slice(0, MAX_ITEMS);
                if (!list.length) {
                  /* Отрицательный кэш (Important 5): у фильма отзывов нет —
                     запоминаем это на EMPTY_TTL, чтобы не ходить в API двумя
                     запросами на каждое открытие карточки. */
                  cacheWrite(imdbId, [], 0, at, kp, rate);
                  cb(null);
                  return;
                }
                var total = parseInt(resp && resp.total, 10) || list.length;
                cacheWrite(imdbId, list, total, at, kp, rate);
                cb({ list: list, total: total });
              } catch (inner) {
                warn('reviews parse failed', inner);
                cb(null);
              }
            }, function () { if (!dead()) cb(null); });
          } catch (e) {
            warn('reviews search failed', e);
            cb(null);
          }
        }, function () { if (!dead()) cb(null); });

        return net;
      } catch (e2) {
        warn('reviews load failed', e2);
        cb(null);
        return null;
      }
    }

    /* ------------------------------------------------------------------ */
    /* Строки интерфейса.                                                  */
    /* ------------------------------------------------------------------ */

    function lang(key) {
      try {
        if (typeof LC.lang === 'function') return LC.lang(key);
      } catch (e) { }
      return key;
    }

    function anonWord() {
      var word = lang('lumen_card_anon');
      return word === 'lumen_card_anon' ? ANON : word;
    }

    function toneLabel(tone) {
      if (tone === 'good') return lang('lumen_card_review_good');
      if (tone === 'bad') return lang('lumen_card_review_bad');
      return lang('lumen_card_review_mid');
    }

    function totalWord(total) {
      try {
        if (typeof LC.reviewsWord === 'function') return LC.reviewsWord(total);
      } catch (e) { }
      return '';
    }

    /* ------------------------------------------------------------------ */
    /* Разметка (экран 07 — ряд карточек, экран 13 — подсказка).           */
    /* ------------------------------------------------------------------ */

    function headHtml(total) {
      return '<div class="lumen-reviews__head">' +
        '<span class="lumen-reviews__ico"></span>' +
        '<span class="lumen-reviews__title">' + esc(lang('lumen_card_reviews_title')) + '</span>' +
        '<span class="lumen-reviews__src">' + esc(lang('lumen_card_reviews_src')) + '</span>' +
        /* total приходит из ответа API или из кэша — в разметку только через
           esc (ревью, Minor 9), даже после parseInt в cacheRead. */
        '<span class="lumen-reviews__total">· ' + esc(String(total)) + ' ' + esc(totalWord(total)) + '</span>' +
        '</div>';
    }

    /* Все поля item уже экранированы normalize() — второй раз не экранируем
       (иначе «A &amp; B» превратилось бы в «A &amp;amp; B»). */
    function cardHtml(item, index) {
      var likes = item.likes ? '<span class="lumen-review__likes">' + item.likes + ' ' + esc(lang('lumen_card_review_useful')) + '</span>' : '';
      return '<div class="lumen-review selector lumen-review--' + item.tone + '" data-lumen-review="' + index + '">' +
        '<div class="lumen-review__tone"></div>' +
        '<div class="lumen-review__body">' +
        '<div class="lumen-review__top">' +
        '<div class="lumen-review__ava">' + item.initials + '</div>' +
        '<div class="lumen-review__who">' +
        '<div class="lumen-review__author">' + item.author + '</div>' +
        '<div class="lumen-review__meta">' +
        '<span class="lumen-review__date">' + item.date + '</span>' +
        '<span class="lumen-review__tag">' + esc(toneLabel(item.tone)) + '</span>' +
        likes +
        '</div>' +
        '</div>' +
        '</div>' +
        '<div class="lumen-review__title">' + item.title + '</div>' +
        '<div class="lumen-review__text">' + item.excerpt + '</div>' +
        '</div>' +
        '</div>';
    }

    function modalHtml(item) {
      return '<div class="lumen-review-modal__tone"></div>' +
        '<div class="lumen-review-modal__body">' +
        '<div class="lumen-review-modal__top">' +
        '<div class="lumen-review-modal__ava">' + item.initials + '</div>' +
        '<div class="lumen-review-modal__who">' +
        '<div class="lumen-review-modal__author">' + item.author + '</div>' +
        '<div class="lumen-review-modal__meta">' +
        '<span>' + item.date + '</span>' +
        '<span class="lumen-review-modal__tag">' + esc(toneLabel(item.tone)) + '</span>' +
        (item.likes ? '<span class="lumen-review-modal__likes">' + item.likes + ' ' + esc(lang('lumen_card_review_useful')) + '</span>' : '') +
        '</div>' +
        '</div>' +
        '<div class="lumen-review-modal__src">' + esc(lang('lumen_card_reviews_src')) + '</div>' +
        '</div>' +
        '<div class="lumen-review-modal__line"></div>' +
        '<div class="lumen-review-modal__title">' + item.title + '</div>' +
        '<div class="lumen-review-modal__text">' + item.full + '</div>' +
        '</div>';
    }

    /* Экран 13, панель 2: ключа нет — вместо пустоты показываем, где его
       взять (поправка контроллера). Ни одного .selector внутри: нажимать
       здесь нечего, а лишний фокусируемый узел изменил бы навигацию. */
    function hintHtml() {
      return '<div class="lumen-reviews__hint">' +
        '<div class="lumen-reviews__hint-ico"></div>' +
        '<div class="lumen-reviews__hint-title">' + esc(lang('lumen_card_reviews_nokey_title')) + '</div>' +
        '<div class="lumen-reviews__hint-text">' + esc(lang('lumen_card_reviews_nokey_text')) + '</div>' +
        '<div class="lumen-reviews__hint-path">' + esc(lang('lumen_card_reviews_nokey_path')) + '</div>' +
        '</div>';
    }

    /* ------------------------------------------------------------------ */
    /* Модал отзыва (экран 08).                                            */
    /* ------------------------------------------------------------------ */

    /* Имя контроллера снимается ПЕРЕД открытием: Lampa.Modal.open включает
       контроллер 'modal' и фокус сам не восстанавливает, а жёсткое 'content'
       из плана увело бы фокус из ряда описания в каталог (поправки
       координатора, план 0.2 «Модалки»). Маркер lumen-modal (оформление пути
       TorrServer, src/64_menus.js) наш модал не получает — он ставится только
       по .modal-loading/.torrent-install, поэтому оформляем своими классами. */
    /* card — узел карточки, с которой модал открыли. Возврат фокуса на неё
       обязателен явно: живая проверка показала, что Controller.toggle
       ('full_descr') пересобирает коллекцию ряда и ставит фокус на СВОЙ
       последний элемент (фокус уезжал на штатный .tag-count — теги жанров),
       а не на наш .selector. Приём тот же, что у кнопки «Стоп» в
       src/55_trailer.js: collectionFocus(узел, корень коллекции). */
    function openModal(item, card) {
      try {
        if (!item || !window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') return;
        var back = 'full_descr';
        try {
          var enabled = Lampa.Controller && typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
          if (enabled && enabled.name) back = enabled.name;
        } catch (e) { }

        var html = $('<div class="lumen-review-modal lumen-review-modal--' + item.tone + '"></div>');
        html.html(modalHtml(item));

        Lampa.Modal.open({
          title: '',
          html: html,
          size: 'medium',
          onBack: function () {
            try { Lampa.Modal.close(); } catch (e2) { }
            try { Lampa.Controller.toggle(back); } catch (e3) { }
            try {
              if (card && card.length && typeof Lampa.Controller.collectionFocus === 'function') {
                Lampa.Controller.collectionFocus(card, card.closest('.items-line'));
              }
            } catch (e4) { }
          }
        });
      } catch (err) {
        warn('reviews modal failed', err);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Рендер ряда.                                                        */
    /* ------------------------------------------------------------------ */

    function holderOf(row) {
      if (!row || !row.length || typeof row.find !== 'function') return null;
      var holder = row.find('.full-descr');
      return holder && holder.length ? holder : null;
    }

    function stateOf(holder) {
      var node = holder[0];
      if (!node.lumenReviews) node.lumenReviews = { sign: '', gen: 0, painted: false, net: null };
      return node.lumenReviews;
    }

    /* Узел ещё в документе и его активность сейчас на экране. Карточка,
       оставленная в истории Lampa, остаётся живым DOM (ревью, Important 3):
       её .selector нельзя отдавать в навигацию — пользователь в это время
       может стоять в ряду описания ДРУГОЙ карточки, и имени контроллера
       (full_descr у обеих) для различения не хватает. Проверка — штатная
       LC.slideshow.isLayerForeground, та же, что у кнопки «Стоп» трейлера. */
    function isForeground(node) {
      try {
        if (LC.slideshow && typeof LC.slideshow.isMounted === 'function' && !LC.slideshow.isMounted(node[0])) return false;
        if (LC.slideshow && typeof LC.slideshow.isLayerForeground === 'function') return !!LC.slideshow.isLayerForeground(node);
      } catch (e) { }
      return true;
    }

    function clearBlock(holder) {
      try {
        var old = holder.find('.lumen-reviews');
        if (old && old.length) old.remove();
      } catch (e) { }
    }

    /* Прокрутка ряда к карточке в фокусе: Lampa сама ряды внутри ряда
       описания не двигает (находка Task 5d), поэтому двигаем scrollLeft.
       Плавно — только в режиме полных анимаций, как везде в плагине. */
    function scrollToCard(block, card) {
      try {
        var row = block.find('.lumen-reviews__row');
        if (!row || !row.length || !card || !card.length) return;
        var box = row[0];
        var node = card[0];
        if (!box || !node || typeof node.offsetLeft !== 'number') return;
        var target = node.offsetLeft - (box.clientWidth - node.offsetWidth) / 2;
        var max = box.scrollWidth - box.clientWidth;
        if (target > max) target = max;
        if (target < 0) target = 0;
        var motion = 'full';
        try { motion = LC.motionMode(); } catch (e) { }
        if (motion === 'full' && typeof row.animate === 'function') row.stop().animate({ scrollLeft: target }, 250);
        else box.scrollLeft = target;
      } catch (err) {
        warn('reviews scroll failed', err);
      }
    }

    /* События Lampa (hover:focus/hover:enter) не всплывают — слушаем в фазе
       перехвата на корне блока, как bindEpisodes в 85_header.js и bind() в
       55_trailer.js. Один слушатель на блок, отдельной подписки на
       Controller.listener не заводим. */
    function bind(block, list) {
      try {
        var el = block[0];
        if (!el || typeof el.addEventListener !== 'function' || el.lumenReviewsBound) return;
        el.lumenReviewsBound = true;

        function cardOf(target) {
          try {
            var $card = $(target).closest('.lumen-review');
            return $card && $card.length ? $card : null;
          } catch (e) { return null; }
        }

        el.addEventListener('hover:focus', function (event) {
          try {
            var card = cardOf(event.target);
            if (card) scrollToCard(block, card);
          } catch (e) { warn('reviews focus failed', e); }
        }, true);

        el.addEventListener('hover:enter', function (event) {
          try {
            var card = cardOf(event.target);
            if (!card) return;
            var index = parseInt(card.attr('data-lumen-review'), 10);
            if (isNaN(index)) return;
            openModal(list[index], card);
          } catch (e) { warn('reviews enter failed', e); }
        }, true);
      } catch (err) {
        warn('reviews bind failed', err);
      }
    }

    /* Новые .selector внутри уже активного ряда описания — контроллер
       full_descr собрал коллекцию при входе и о них ещё не знает. Если
       активен другой контроллер (фокус на кнопках карточки), делать ничего
       не нужно: full_descr соберёт их сам при спуске вниз. */
    function appendSelectors(block) {
      try {
        if (!window.Lampa || !Lampa.Controller || typeof Lampa.Controller.collectionAppend !== 'function') return;
        var enabled = typeof Lampa.Controller.enabled === 'function' ? Lampa.Controller.enabled() : null;
        if (!enabled || enabled.name !== 'full_descr') return;
        /* Ревью (Important 3): имени контроллера мало — ответ, догнавший
           карточку, которую уже покинули, добавил бы её карточки в навигацию
           той карточки, что сейчас на экране. */
        if (!isForeground(block)) return;
        var nodes = block.find('.lumen-review');
        if (nodes && nodes.length) Lampa.Controller.collectionAppend(nodes);
      } catch (e) {
        warn('reviews collection failed', e);
      }
    }

    function paintList(holder, list, total) {
      var block = $('<div class="lumen-reviews"></div>');
      var cards = [];
      LC.util.each(list, function (item, i) { cards.push(cardHtml(item, i)); });
      block.html(headHtml(total) + '<div class="lumen-reviews__row">' + cards.join('') + '</div>');
      holder.append(block);
      bind(block, list);
      appendSelectors(block);
    }

    function paintHint(holder) {
      var block = $('<div class="lumen-reviews lumen-reviews--hint"></div>');
      block.html(hintHtml());
      holder.append(block);
    }

    /* row — узел ряда описания (items_line), тот же, что получает
       LC.header.descr. Идемпотентно: build 'description' и страховочный
       complite приходят с одними данными — второй раз рендер пропускается по
       подписи, повторного запроса в сеть не будет. Смена карточки, языка или
       настроек меняет подпись и поколение: ответ уже неактуального запроса
       молча отбрасывается (generation guard, как lumenGen в 50_backdrops.js). */
    function render(row, data) {
      try {
        var holder = holderOf(row);
        if (!holder) return;
        row.addClass('lumen-descr-row');

        var movie = (data && data.movie) || {};
        var imdb = movie.imdb_id || (movie.external_ids || {}).imdb_id || '';
        var key = trim(LC.pref('lumen_kp_key', ''));
        var on = LC.pref('lumen_reviews', true);
        /* Ревью (Important 2): в подписи — ОТПЕЧАТОК ключа, а не флаг «ключ
           есть». С флагом исправление опечатки в ключе подпись не меняло,
           рендер выходил по раннему return, и верный ключ применялся только со
           следующего открытия карточки. */
        var sign = [on ? '1' : '0', imdb, keyStamp(key), lang('lumen_card_reviews_title')].join('|');

        var state = stateOf(holder);
        if (state.sign === sign && (!state.painted || holder.find('.lumen-reviews').length)) return;

        state.sign = sign;
        state.gen++;
        state.painted = false;
        var gen = state.gen;
        /* Прошлый запрос этой карточки больше не нужен — снимаем колбэки
           (ревью 2, п.3: abort() у Lampa нет, ответ долетит, но разбирать и
           рисовать его никто не будет). */
        dropNet(state);
        clearBlock(holder);
        /* Пока ряда отзывов нет, описанию достаётся весь его предел (70vh,
           Task 5d); класс вернётся, только если карточки реально нарисованы. */
        row.removeClass('lumen-descr-row--reviews');

        if (!on) return;
        if (!key) { paintHint(holder); state.painted = true; return; }
        if (!imdb) return;

        state.net = load(imdb, key, function (res) {
          try {
            var current = stateOf(holder);
            if (current.gen !== gen) return;
            if (!res) return;
            if (res.nokey) { paintHint(holder); current.painted = true; return; }
            paintList(holder, res.list, res.total);
            /* Ряд карточек и длинное описание вместе перерастают экран, а
               Lampa внутри ряда описания не прокручивает (находка Task 5d) —
               класс поджимает описание, пока отзывы на месте. */
            row.addClass('lumen-descr-row--reviews');
            current.painted = true;
          } catch (e) {
            warn('reviews paint failed', e);
          }
        }, function () { return stateOf(holder).gen === gen; }, undefined, function (rate) {
          /* Ревью Task 10 (п.2): рейтинг принадлежит ИМЕННО этой карточке.
             Сторож alive() выше тут не спасает: при Activity.push A -> B Lampa
             для A не шлёт ни destroy, ни archive (план 0.2), поэтому ни
             поколение ряда A не растёт, ни LC.reviews.cancel для неё не
             зовётся — и рейтинг фильма A попал бы в чип уже открытой B. */
          if (stateOf(holder).gen !== gen) return;
          if (!isForeground(holder)) return;
          if (typeof LC.applyKpRate === 'function') LC.applyKpRate(rate, row);
        });
      } catch (err) {
        warn('reviews render failed', err);
      }
    }

    /* Снять незавершённый запрос ряда: колбэки Lampa после clear() не
       отрабатывают (abort()'а у неё нет — ревью 2, п.3). Общий хелпер для
       смены карточки, выключения настройки и закрытия карточки. */
    function dropNet(state) {
      if (!state) return;
      if (state.net && typeof state.net.clear === 'function') {
        try { state.net.clear(); } catch (e) { }
      }
      state.net = null;
    }

    /* Снять блок с ряда (выключили настройку на уже открытой карточке). */
    function clearRow(row) {
      try {
        var holder = holderOf(row);
        if (!holder) return;
        clearBlock(holder);
        row.removeClass('lumen-descr-row--reviews');
        var state = stateOf(holder);
        state.sign = '';
        state.painted = false;
        state.gen++;
        /* Ревью 2 (п.4): поднять поколение мало — сам запрос продолжал бы
           висеть до таймаута. */
        dropNet(state);
      } catch (e) {
        warn('reviews clear failed', e);
      }
    }

    /* Карточку закрыли: LC.onActivityEvent зовёт это на 'destroy' вместе с
       LC.backdrops.cancel (ревью 2, п.4). body — тело активности; состояние
       НЕ создаём, если рендера на этом узле ещё не было. */
    function cancel(body) {
      try {
        if (!body || typeof body.find !== 'function') return;
        var holder = body.find('.full-descr');
        if (!holder || !holder.length) return;
        var node = holder[0];
        if (node && node.lumenReviews) dropNet(node.lumenReviews);
      } catch (e) {
        warn('reviews cancel failed', e);
      }
    }

    return {
      TTL: TTL,
      cacheKey: cacheKey,
      isFresh: isFresh,
      normalize: normalize,
      kpRateOf: kpRateOf,
      cacheRead: cacheRead,
      cacheWrite: cacheWrite,
      load: load,
      render: render,
      clearRow: clearRow,
      cancel: cancel,
      openModal: openModal
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.reviews;

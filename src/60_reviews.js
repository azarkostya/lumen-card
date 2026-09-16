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
    /* Поправки контроллера: кэш не больше 20 фильмов, текст отзыва не
       длиннее 4000 символов — иначе несколько карточек переполняют
       localStorage на ТВ (квота 5 МБ делится со всей Lampa). */
    var MAX_FILMS = 20;
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

    function isFresh(rec, at) {
      return !!(rec && rec.at && (now(at) - rec.at) < TTL);
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

    /* Отзыв без своего заголовка: первое законченное предложение (10-80
       символов), иначе просто начало текста. */
    function firstSentence(text) {
      var m = text.match(/^(.{10,80}?[.!?])\s/);
      return m ? m[1] : text.slice(0, 60);
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

    function readIndex(store) {
      var index = store.get(INDEX_KEY, []);
      return (index && typeof index.length === 'number') ? index : [];
    }

    /* Lampa.Storage.remove есть не во всех сборках — запасной путь — пустая
       строка: Storage.get отдаёт default на пустом значении (план 0.2,
       «Булевы настройки»), то есть запись становится невидимой. */
    function drop(store, id) {
      try {
        if (typeof store.remove === 'function') { store.remove(cacheKey(id)); return; }
      } catch (e) { }
      store.set(cacheKey(id), '');
    }

    function cacheRead(imdbId, at) {
      try {
        var store = storage();
        if (!store || !imdbId) return null;
        var rec = store.get(cacheKey(imdbId), null);
        return isFresh(rec, at) ? rec : null;
      } catch (e) {
        warn('reviews cache read failed', e);
        return null;
      }
    }

    function cacheWrite(imdbId, list, total, at, kp) {
      try {
        var store = storage();
        if (!store || !imdbId) return;
        var stamp = now(at);
        store.set(cacheKey(imdbId), { at: stamp, list: list, total: total, kp: kp || 0 });

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
        store.set(INDEX_KEY, kept);
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
       цепочка обрывается молча — ни второго запроса, ни колбэка. */
    function load(imdbId, key, cb, alive, at) {
      function dead() {
        try { return typeof alive === 'function' && !alive(); } catch (e) { return false; }
      }
      try {
        if (!key) { cb({ nokey: true }); return; }
        if (!imdbId) { cb(null); return; }

        var rec = cacheRead(imdbId, at);
        if (rec) {
          cb(rec.list && rec.list.length ? { list: rec.list, total: rec.total || rec.list.length } : null);
          return;
        }

        if (!window.Lampa || typeof Lampa.Reguest !== 'function') { cb(null); return; }
        var net = new Lampa.Reguest();

        request(net, BASE + '?imdbId=' + encodeURIComponent(imdbId), key, function (found) {
          if (dead()) return;
          try {
            var kp = found && found.items && found.items[0] && found.items[0].kinopoiskId;
            if (!kp) { cb(null); return; }
            request(net, BASE + '/' + kp + '/reviews?page=1&order=USER_POSITIVE_RATING_DESC', key, function (resp) {
              if (dead()) return;
              try {
                var list = normalize(resp, anonWord()).slice(0, MAX_ITEMS);
                if (!list.length) { cb(null); return; }
                var total = parseInt(resp && resp.total, 10) || list.length;
                cacheWrite(imdbId, list, total, at, kp);
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
      } catch (e2) {
        warn('reviews load failed', e2);
        cb(null);
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
        '<span class="lumen-reviews__total">· ' + total + ' ' + esc(totalWord(total)) + '</span>' +
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
      if (!node.lumenReviews) node.lumenReviews = { sign: '', gen: 0, painted: false };
      return node.lumenReviews;
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
        var sign = [on ? '1' : '0', imdb, key ? '1' : '0', lang('lumen_card_reviews_title')].join('|');

        var state = stateOf(holder);
        if (state.sign === sign && (!state.painted || holder.find('.lumen-reviews').length)) return;

        state.sign = sign;
        state.gen++;
        state.painted = false;
        var gen = state.gen;
        clearBlock(holder);
        /* Пока ряда отзывов нет, описанию достаётся весь его предел (70vh,
           Task 5d); класс вернётся, только если карточки реально нарисованы. */
        row.removeClass('lumen-descr-row--reviews');

        if (!on) return;
        if (!key) { paintHint(holder); state.painted = true; return; }
        if (!imdb) return;

        load(imdb, key, function (res) {
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
        }, function () { return stateOf(holder).gen === gen; });
      } catch (err) {
        warn('reviews render failed', err);
      }
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
      } catch (e) {
        warn('reviews clear failed', e);
      }
    }

    return {
      TTL: TTL,
      cacheKey: cacheKey,
      isFresh: isFresh,
      normalize: normalize,
      cacheRead: cacheRead,
      cacheWrite: cacheWrite,
      load: load,
      render: render,
      clearRow: clearRow,
      openModal: openModal
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка module.lumen
     ставится только тестовым загрузчиком (test/_load.mjs) — так мы не затираем
     чужой глобальный module.exports, если он есть у страницы (например, у
     Electron/NW.js-обёрток Lampa с nodeIntegration). */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.reviews;

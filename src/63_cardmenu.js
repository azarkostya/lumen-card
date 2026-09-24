  /* -------------------------------------------------------------------- */
  /* Task 26 (фаза 3): контекстное меню карточки по удержанию OK.          */
  /*                                                                       */
  /* Разведка Step 1 (исходник vendor/lampa/app.min.js 3.3.4 + живая       */
  /* проверка). Точка расширения найдена, свой детектор удержания НЕ нужен: */
  /*                                                                       */
  /*  - Удержание OK у Lampa своё и единственное. Keypad.init (app.min.js   */
  /*    ~325400) на keydown заводит таймер 800 мс и по нему шлёт            */
  /*    listener 'longdown' и Controller.long(); Controller.long()          */
  /*    (~1702900) вызывает Utils.trigger(select_active, 'hover:long') на   */
  /*    элементе, где сейчас фокус. Мышь и тач идут туда же: bindEvents     */
  /*    (~1704330) вешает на каждый .selector таймер 800 мс от mousedown/   */
  /*    touchstart и правый клик — оба тоже шлют 'hover:long'. Поэтому      */
  /*    ПОРОГ УДЕРЖАНИЯ ЗДЕСЬ НЕ ЗАДАЁТСЯ: он штатный, 800 мс, и обычное    */
  /*    нажатие OK от удержания Lampa отделяет сама (флаг longpress гасит   */
  /*    enter после сработавшего long). Свой таймер удвоил бы работу и был  */
  /*    бы ещё одним источником утечек.                                     */
  /*  - Событие 'hover:long' создаётся как Utils.trigger -> initEvent(name, */
  /*    false, true), то есть НЕ всплывает. Делегировать его через          */
  /*    $(document).on нельзя, но фаза ЗАХВАТА для не всплывающих событий   */
  /*    работает: document.addEventListener('hover:long', h, true) видит    */
  /*    каждое такое событие и срабатывает РАНЬШЕ обработчика карточки.     */
  /*    Одна подписка на весь плагин — она и запоминает карточку.           */
  /*  - Штатное меню карточки строит CardMap.Menu (~910190): собирает       */
  /*    пункты модулей карточки (Plugins, Favorite) и зовёт Select.show     */
  /*    с title_action. Внутрикарточные хуки onMenuShow/emit('menu')        */
  /*    плагину недоступны (карточки создаёт сам Lampa), зато Select шлёт   */
  /*    ПУБЛИЧНОЕ событие preshow со ссылкой на объект параметров ДО        */
  /*    отрисовки списка (Select.show ~ 'listener.send(preshow)' перед      */
  /*    bind()). Дописываем пункты прямо в e.active.items — это и есть      */
  /*    «расширение штатного меню, не дубль»: закладки, «Нравится»,         */
  /*    «Смотреть позже» и «История» остаются штатными чекбоксами Lampa,    */
  /*    мы своих таких не добавляем.                                        */
  /*  - Возврат фокуса на исходную карточку делает сам Select: его onBack/  */
  /*    onBeforeClose штатного меню зовут Controller.toggle(enabled) с      */
  /*    именем контроллера, снятым до открытия. Мы его не трогаем.          */
  /*                                                                       */
  /* Наши сетки (lumen_grid, src/46_hub.js) рисуют карточки штатным         */
  /* шаблоном 'card', но это не объект Lampa.Card — штатного меню у них     */
  /* нет вовсе, и расширять нечего. Для них open() показывает своё меню     */
  /* тем же Lampa.Select: сначала те же четыре чекбокса закладок (той же    */
  /* парой Favorite.check/Favorite.toggle, что у Lampa), потом наши пункты. */
  /*                                                                       */
  /* Ресурсы: ни одного таймера (ожидание ответа роликов — сверка времени   */
  /* в колбэке, verdict). Живут ровно две подписки — capture-             */
  /* слушатель на document и preshow у Lampa.Select.listener, обе ставит    */
  /* install() один раз и снимает uninstall() (настройка lumen_context_menu */
  /* и выключение плагина). Запомненная карточка — одна переменная, она     */
  /* протухает сама через PENDING_MS и очищается при снятии.                */
  /* -------------------------------------------------------------------- */

  LC.cardmenu = (function () {

    /* Сколько запомненная по 'hover:long' карточка считается свежей. Меню
       Lampa открывает синхронно в том же обработчике, так что реально
       проходят единицы миллисекунд; полторы секунды — запас на медленный ТВ.
       Если Select открылся позже (чужое меню без удержания), карточка уже
       протухла и пункты не добавляются. */
    var PENDING_MS = 1500;

    /* Наши карточки в lumen_grid: у них своего штатного меню нет. */
    var OWN_CARD_CLASS = 'lumen-gcard';

    /* ------------------------------------------------------------------ */
    /* Чистая часть.                                                       */
    /* ------------------------------------------------------------------ */

    function mediaOf(card) {
      if (!card) return 'movie';
      return (card.name || card.first_air_date) ? 'tv' : 'movie';
    }

    /* Ключ прогресса просмотра — тот же, что считает LC.badges.progressOf и
       полоса сетки подборки (src/46_hub.js). У Lampa для фильма это
       Utils.hash(original_title) (Timeline.watched, app.min.js ~968700);
       остальные поля — запасные, когда оригинального названия в карточке
       ряда нет. */
    function watchKey(card) {
      if (!card) return '';
      return card.original_title || card.original_name || card.title || card.name || '';
    }

    /* Признак «это штатное меню карточки». Подпись — четыре чекбокса
       закладок, которые Lampa кладёт в него всегда (CardMap.Favorite.
       drawMenu): пункт where='book' с checkbox. Меню файла и раздачи
       TorrServer тоже носит заголовок title_action, но собрано из timeclear/
       timefull — по ним и отсекается. actionTitle — перевод title_action;
       пустая строка означает «язык ещё не поднялся, сверять нечем». */
    function isCardMenu(active, actionTitle) {
      if (!active || !active.items || typeof active.items.length !== 'number') return false;
      if (!active.items.length) return false;
      if (actionTitle && active.title !== actionTitle) return false;
      var book = false;
      var i;
      for (i = 0; i < active.items.length; i++) {
        var it = active.items[i];
        if (!it) continue;
        /* Наш пункт уже в списке — второй раз не дописываем. */
        if (it.lumen) return false;
        if (it.timeclear || it.timefull) return false;
        if (it.where === 'book' && it.checkbox) book = true;
      }
      return book;
    }

    /* Пункты, которых в штатном меню нет. ctx:
         words      — подписи (LC.STRINGS, собирает words() ниже),
         collection — belongs_to_collection из кэша деталей или null,
         watched    — фильм отмечен просмотренным (Lampa.Timeline),
         thrown     — карточка скрыта из рекомендаций (Lampa.Favorite).
       «Отметить просмотренным» только для фильмов: прогресс сериала Lampa
       держит по сериям (Timeline.watched перебирает s1e1..e24), и одной
       отметки на весь сериал у неё попросту нет — рисовать пункт, который
       Lampa не увидит, нельзя.
       Закладок здесь нет намеренно: их штатный чекбокс уже в этом же меню. */
    function extraItems(card, ctx) {
      if (!card || !ctx || !ctx.words) return [];
      var w = ctx.words;
      var out = [];
      out.push({ title: w.trailer, lumen: 'trailer' });
      if (ctx.collection && ctx.collection.id) {
        out.push({ title: w.franchise, subtitle: ctx.collection.name || '', lumen: 'franchise' });
      }
      out.push({ title: w.similar, lumen: 'similar' });
      if (mediaOf(card) === 'movie') {
        if (ctx.watched) out.push({ title: w.unwatched, lumen: 'unwatched' });
        else out.push({ title: w.watched, lumen: 'watched' });
      }
      if (ctx.thrown) out.push({ title: w.unhide, lumen: 'unhide' });
      else out.push({ title: w.hide, lumen: 'hide' });
      return out;
    }

    /* Параметры штатного Lampa.Api.sources.tmdb.videos: он сам запрашивает
       ролики на языке интерфейса и вторым запросом на английском, склеивает
       их в {results} и кэширует на неделю. Своей пары запросов с языками
       здесь поэтому нет — она была бы точной копией штатной. */
    function videosParams(card) {
      if (!card || !card.id) return null;
      return { method: mediaOf(card), id: card.id };
    }

    /* Штатная сетка «Похожие» Lampa. */
    function similarTarget(card) {
      if (!card || !card.id) return null;
      return {
        url: mediaOf(card) + '/' + card.id + '/similar',
        title: card.title || card.name || '',
        component: 'category_full',
        source: card.source || 'tmdb',
        page: 1
      };
    }

    /* ------------------------------------------------------------------ */
    /* Рантайм.                                                            */
    /* ------------------------------------------------------------------ */

    var installed = false;
    /* Последнее удержание: {el, card, at}. Одна переменная, живёт PENDING_MS. */
    var pending = null;
    var longHandler = null;
    var preshowHandler = null;

    function enabled() {
      try { return LC.pref ? !!LC.pref('lumen_context_menu', true) : true; } catch (e) { return true; }
    }

    function words() {
      return {
        section: LC.lang('lumen_menu_section'),
        trailer: LC.lang('lumen_menu_trailer'),
        franchise: LC.lang('lumen_menu_franchise'),
        similar: LC.lang('lumen_menu_similar'),
        watched: LC.lang('lumen_menu_watched'),
        unwatched: LC.lang('lumen_menu_unwatched'),
        hide: LC.lang('lumen_menu_hide'),
        unhide: LC.lang('lumen_menu_unhide')
      };
    }

    function noty(key) {
      try {
        if (window.Lampa && Lampa.Noty && typeof Lampa.Noty.show === 'function') Lampa.Noty.show(LC.lang(key));
      } catch (e) {
        warn('cardmenu: noty failed', e);
      }
    }

    function hashOf(key) {
      try {
        if (!key || !window.Lampa || !Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return 0;
        return Lampa.Utils.hash(key);
      } catch (e) {
        return 0;
      }
    }

    /* Просмотрен ли фильм: та же граница 95 %, что у LC.hub и плана. */
    function isWatched(card) {
      try {
        var hash = hashOf(watchKey(card));
        if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return false;
        var view = Lampa.Timeline.view(hash);
        return !!(view && Number(view.percent) >= 95);
      } catch (e) {
        return false;
      }
    }

    function isThrown(card) {
      try {
        if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.check !== 'function') return false;
        return !!(Lampa.Favorite.check(card) || {}).thrown;
      } catch (e) {
        return false;
      }
    }

    /* Коллекция фильма. Своих запросов ради одного пункта меню не делаем:
       берём то, что уже лежит — поле карточки (оно есть у карточек из
       коллекций и из деталей) или детали, загруженные героем главной под
       тем же фильмом (src/48_hero.js, кэш на сутки). Не нашли — пункта
       «Вся франшиза» в меню просто нет. */
    function collectionOf(card) {
      try {
        if (!card) return null;
        if (card.belongs_to_collection) return card.belongs_to_collection;
        if (LC.hero && typeof LC.hero.details === 'function') {
          var details = LC.hero.details(card.id);
          if (details && details.belongs_to_collection) return details.belongs_to_collection;
        }
      } catch (e) {
        warn('cardmenu: collection lookup failed', e);
      }
      return null;
    }

    function context(card) {
      return {
        words: words(),
        collection: collectionOf(card),
        watched: isWatched(card),
        thrown: isThrown(card)
      };
    }

    /* ------------------------------------------------------------------ */
    /* Действия пунктов.                                                   */
    /* ------------------------------------------------------------------ */

    /* Трейлер: роликов в данных карточки ряда нет (их догружает компонент
       full), поэтому спрашиваем штатным Lampa.Api.sources.tmdb.videos —
       он же кэширует ответ на неделю и сам добирает английские ролики, если
       на языке интерфейса их нет. Колбэк приходит всегда: Status считает и
       ошибки (app.min.js Status.error), так что своего сторожевого таймера
       не нужно. Проигрывание — тем же путём, каким его запускает сама Lampa
       из кнопки «Трейлер» (app.min.js ~1396600): на Android, если в
       настройках плеера выбран YouTube, Android.openYoutube(key), иначе
       Lampa.Player.play со ссылкой watch?v=. Lampa.YouTube в 3.3.4 для
       трейлеров не используется.

       Проверка на ТВ 2026-09-24: на телевизоре ответ роликов идёт секундами,
       и трейлер стартовал уже после ухода с экрана, поверх открытого плеера
       или второй раз. Колбэк теперь сверяет «билет» запроса (verdict ниже) и
       без него не играет и ничего не пишет. */
    function playTrailer(card) {
      var ticket = { seq: ++trailerReq, at: Date.now(), activity: currentActivity() };

      function play(video) {
        try {
          var item = {
            title: video.name || (card.title || card.name || ''),
            id: video.key,
            url: 'https://www.youtube.com/watch?v=' + video.key,
            youtube: true
          };
          var android = false;
          try { android = !!(window.Lampa && Lampa.Platform && Lampa.Platform.is('android')); } catch (ePlat) {}
          var launch = '';
          /* Storage.field, а не LC.pref: player_launch_trailers — настройка
             самой Lampa с её дефолтом 'inner' (app.min.js:47883-47886), и
             читает её сама Lampa так же (app.min.js:37262). */
          try { launch = (window.Lampa && Lampa.Storage && Lampa.Storage.field('player_launch_trailers')) || ''; } catch (eSt) {}
          if (android && launch === 'youtube' && Lampa.Android && typeof Lampa.Android.openYoutube === 'function') {
            Lampa.Android.openYoutube(item.id);
            return;
          }
          if (Lampa.Player && typeof Lampa.Player.play === 'function') {
            Lampa.Player.play(item);
            return;
          }
          noty('lumen_menu_no_trailer');
        } catch (e) {
          warn('cardmenu: trailer play failed', e);
          noty('lumen_menu_no_trailer');
        }
      }

      var params = videosParams(card);
      try {
        if (!params || !window.Lampa || !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb ||
            typeof Lampa.Api.sources.tmdb.videos !== 'function') {
          noty('lumen_menu_no_trailer');
          return;
        }
        Lampa.Api.sources.tmdb.videos(params, function (json) {
          var v = verdict(ticket);
          if (!v) return;
          /* Билет погашен: повторный колбэк того же запроса — уже чужой. */
          trailerReq++;
          if (v === 'late') { noty('lumen_menu_trailer_late'); return; }
          var picked = LC.trailer && LC.trailer.pickTrailer ? LC.trailer.pickTrailer(json && json.results) : null;
          if (picked && picked.key) play(picked);
          else noty('lumen_menu_no_trailer');
        });
      } catch (e) {
        warn('cardmenu: videos request failed', e);
        noty('lumen_menu_no_trailer');
      }
    }

    /* Номер последнего запроса трейлера из меню: новый выбор делает все
       прежние устаревшими. */
    var trailerReq = 0;
    /* Сколько ждать ответа роликов. Дольше — человек уже забыл, что просил,
       и внезапный плеер хуже, чем ничего. */
    var TRAILER_WAIT_MS = 8000;

    function currentActivity() {
      try {
        if (window.Lampa && Lampa.Activity && typeof Lampa.Activity.active === 'function') return Lampa.Activity.active();
      } catch (e) { }
      return null;
    }

    /* Что делать с ответом роликов. 'play' — ещё нужен: запрос последний,
       экран тот же (Activity.active() — запись стека, app.min.js:45889),
       плеер не открыт и поверх ничего нет, и ответ не старше
       TRAILER_WAIT_MS. «Плеер» и «поверх» — тот же LC.util.playerOpen/
       overlayOpen, что у автотрейлера героя (ревью волны 1b, п.4: свой
       набор здесь разошёлся с ним — поиск, список выбора, модальное окно и
       YouTube Lampa трейлер из меню пропускал), плюс левое меню (класс
       body menu--open, :9789): главную под ним видно, и ролик героя его не
       ждёт, но ответ, пришедший, когда человек уже в меню, — чужой.
       'late' — всё то же, но опоздал только ответ: человек так и ждёт на
       том же экране, и молчание выглядело бы как «кнопка не работает»
       (ревью «Волны 1», п.4) — говорим, что трейлер не успел загрузиться
       (своя строка, ревью волны 1b, п.3: «не найден» было бы неправдой).
       '' — ответ уже чужой (ушли, открыли плеер, оверлей или меню, новый
       выбор): ни играть, ни говорить. */
    function verdict(ticket) {
      if (ticket.seq !== trailerReq) return '';
      if (currentActivity() !== ticket.activity) return '';
      if (LC.util.playerOpen() || LC.util.overlayOpen()) return '';
      try {
        var list = document.body && document.body.classList;
        if (list && list.contains('menu--open')) return '';
      } catch (e) { }
      if (Date.now() - ticket.at > TRAILER_WAIT_MS) return 'late';
      return 'play';
    }

    function openFranchise(card) {
      try {
        var collection = collectionOf(card);
        if (!LC.hub || !LC.hub.franchiseItem || !LC.hub.openTarget) return;
        var item = LC.hub.franchiseItem(collection);
        if (!item) return;
        Lampa.Activity.push(LC.hub.openTarget(item));
      } catch (e) {
        warn('cardmenu: franchise failed', e);
      }
    }

    function openSimilar(card) {
      try {
        var target = similarTarget(card);
        if (target) Lampa.Activity.push(target);
      } catch (e) {
        warn('cardmenu: similar failed', e);
      }
    }

    /* Отметка просмотра — штатным Lampa.Timeline: он же пишет историю,
       обновляет полосы .time-line на всех слоях и рассылает state:changed,
       по которому Lampa перерисовывает значки карточек. */
    function setWatched(card, on) {
      try {
        var hash = hashOf(watchKey(card));
        if (!hash || !window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.update !== 'function') return;
        Lampa.Timeline.update({ hash: hash, percent: on ? 100 : 0, time: 0, duration: 0 });
        noty(on ? 'lumen_menu_marked' : 'lumen_menu_unmarked');
      } catch (e) {
        warn('cardmenu: watched failed', e);
      }
    }

    /* Скрытие — штатная метка 'thrown' (Lampa.Favorite). Карточку из уже
       нарисованного ряда не выдёргиваем: ряд штатный, а его состав Lampa
       считает при построении — Noty честно говорит, что исчезнет она при
       следующем обновлении. */
    function setThrown(card, on) {
      try {
        if (!window.Lampa || !Lampa.Favorite || typeof Lampa.Favorite.toggle !== 'function') return;
        if (isThrown(card) === on) return;
        Lampa.Favorite.toggle('thrown', card);
        noty(on ? 'lumen_menu_hidden' : 'lumen_menu_unhidden');
      } catch (e) {
        warn('cardmenu: thrown failed', e);
      }
    }

    function run(kind, card) {
      if (!kind || !card) return;
      if (kind === 'trailer') { playTrailer(card); return; }
      if (kind === 'franchise') { openFranchise(card); return; }
      if (kind === 'similar') { openSimilar(card); return; }
      if (kind === 'watched') { setWatched(card, true); return; }
      if (kind === 'unwatched') { setWatched(card, false); return; }
      if (kind === 'hide') { setThrown(card, true); return; }
      if (kind === 'unhide') { setThrown(card, false); return; }
    }

    /* ------------------------------------------------------------------ */
    /* Расширение штатного меню.                                           */
    /* ------------------------------------------------------------------ */

    /* Перевод штатного ключа Lampa. Пустой fallback означает «языка ещё
       нет»: сверять заголовок меню в этом случае нечем. */
    function translate(key, fallback) {
      try {
        if (window.Lampa && Lampa.Lang && typeof Lampa.Lang.translate === 'function') {
          var t = Lampa.Lang.translate(key);
          if (t && t !== key) return t;
        }
      } catch (e) {}
      return fallback || '';
    }

    function actionTitle() {
      return translate('title_action', '');
    }

    function fresh() {
      if (!pending) return null;
      if (Date.now() - pending.at > PENDING_MS) { pending = null; return null; }
      return pending;
    }

    /* Дописываем пункты в объект параметров ДО отрисовки списка. Штатные
       onSelect/onCheck меню не подменяются: у наших пунктов свой onSelect,
       и Select зовёт его вместо общего (app.min.js bind/goclose: element.
       onSelect, и только иначе active.onSelect). Закладки, «Нравится»,
       «Смотреть позже» и «История» остаются штатными чекбоксами Lampa. */
    function onPreshow(e) {
      try {
        if (!enabled()) return;
        var active = e && e.active;
        if (!active || active.lumen_own) return;
        if (!isCardMenu(active, actionTitle())) return;
        var hit = fresh();
        if (!hit || !hit.card) return;
        var card = hit.card;
        var items = extraItems(card, context(card));
        if (!items.length) return;
        active.items = active.items.concat([{ title: words().section, separator: true }]).concat(decorate(items, card, active));
      } catch (err) {
        warn('cardmenu: preshow failed', err);
      }
    }

    function decorate(items, card, active) {
      var out = [];
      for (var i = 0; i < items.length; i++) {
        out.push(bind(items[i], card, active));
      }
      return out;
    }

    /* Свой onSelect на каждом пункте. Возврат фокуса на исходную карточку
       Lampa делает двумя разными путями, и оба надо уважать: у меню новой
       карточки (CardMap.Menu) есть onBeforeClose — он зовёт Controller.
       toggle(enabled) ДО закрытия, сам по себе; у меню устаревшего
       Lampa.Card (им пользуются сторонние плагины) onBeforeClose нет, а
       контроллер возвращает общий active.onSelect — но его Select как раз и
       НЕ вызовет, раз у пункта есть свой. Поэтому во втором случае зовём
       его сами, и только потом делаем своё дело. */
    function bind(item, card, active) {
      item.onSelect = function (element, node) {
        try {
          if (active && !active.onBeforeClose && typeof active.onSelect === 'function') active.onSelect(element || item, node);
        } catch (e) {
          warn('cardmenu: native onSelect failed', e);
        }
        run(item.lumen, card);
      };
      return item;
    }

    /* ------------------------------------------------------------------ */
    /* Своё меню для карточек наших сеток.                                 */
    /* ------------------------------------------------------------------ */

    /* Четыре штатных чекбокса закладок — теми же Favorite.check/toggle, что
       кладёт в меню сама Lampa (CardMap.Favorite.drawMenu). Повторяем их
       здесь только потому, что у карточки нашей сетки штатного меню нет
       вовсе: расширять нечего. */
    function favoriteItems(card) {
      var out = [];
      var names = ['book', 'like', 'wath', 'history'];
      var status = {};
      try {
        if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.check === 'function') status = Lampa.Favorite.check(card) || {};
      } catch (e) {
        warn('cardmenu: favorite check failed', e);
      }
      for (var i = 0; i < names.length; i++) {
        out.push({
          title: translate('title_' + names[i], names[i]),
          where: names[i],
          checkbox: true,
          checked: !!status[names[i]]
        });
      }
      return out;
    }

    /* Меню для карточки нашей сетки. Возврат фокуса — как у Lampa: имя
       контроллера снимается ДО открытия и возвращается в onBack/onSelect. */
    function open(el, card) {
      try {
        if (!enabled() || !card) return;
        if (!window.Lampa || !Lampa.Select || typeof Lampa.Select.show !== 'function') return;
        var back = 'content';
        try { back = Lampa.Controller.enabled().name || 'content'; } catch (eCtrl) {}
        var extra = extraItems(card, context(card));
        var items = favoriteItems(card);
        if (extra.length) items = items.concat([{ title: words().section, separator: true }]).concat(decorate(extra, card));
        Lampa.Select.show({
          /* Метка «меню собрали мы» — onPreshow по ней не дописывает пункты
             второй раз. */
          lumen_own: true,
          title: actionTitle() || words().section,
          items: items,
          onCheck: function (a) {
            try {
              if (a && a.where && Lampa.Favorite && typeof Lampa.Favorite.toggle === 'function') Lampa.Favorite.toggle(a.where, card);
            } catch (eFav) {
              warn('cardmenu: favorite toggle failed', eFav);
            }
          },
          onBeforeClose: function () {
            try { Lampa.Controller.toggle(back); } catch (eBack) {}
            return true;
          },
          onBack: function () {
            try { Lampa.Controller.toggle(back); } catch (eBack2) {}
          }
        });
      } catch (e) {
        warn('cardmenu: open failed', e);
      }
    }

    /* ------------------------------------------------------------------ */
    /* Подписки.                                                           */
    /* ------------------------------------------------------------------ */

    /* Фаза захвата: 'hover:long' не всплывает (bubbles=false), но вниз по
       дереву событие проходит всегда и до обработчика самой карточки. */
    function onLong(e) {
      try {
        var el = e && e.target;
        if (!el || !el.card_data) { pending = null; return; }
        pending = { el: el, card: el.card_data, at: Date.now() };
        if (el.classList && el.classList.contains(OWN_CARD_CLASS)) open(el, el.card_data);
      } catch (err) {
        warn('cardmenu: long failed', err);
      }
    }

    function install() {
      if (installed) return;
      if (!enabled()) return;
      try {
        if (typeof document === 'undefined' || !document.addEventListener) return;
        if (!window.Lampa || !Lampa.Select || !Lampa.Select.listener) {
          warn('cardmenu: Lampa.Select.listener not found');
          return;
        }
        longHandler = onLong;
        preshowHandler = onPreshow;
        document.addEventListener('hover:long', longHandler, true);
        Lampa.Select.listener.follow('preshow', preshowHandler);
        installed = true;
      } catch (e) {
        warn('cardmenu: install failed', e);
      }
    }

    function uninstall() {
      if (!installed) return;
      installed = false;
      pending = null;
      try {
        if (longHandler) document.removeEventListener('hover:long', longHandler, true);
      } catch (e) {
        warn('cardmenu: remove listener failed', e);
      }
      try {
        if (preshowHandler && window.Lampa && Lampa.Select && Lampa.Select.listener && typeof Lampa.Select.listener.remove === 'function') {
          Lampa.Select.listener.remove('preshow', preshowHandler);
        }
      } catch (e2) {
        warn('cardmenu: unfollow failed', e2);
      }
      longHandler = null;
      preshowHandler = null;
    }

    function active() {
      return installed;
    }

    return {
      mediaOf: mediaOf,
      watchKey: watchKey,
      isCardMenu: isCardMenu,
      extraItems: extraItems,
      videosParams: videosParams,
      similarTarget: similarTarget,
      install: install,
      uninstall: uninstall,
      open: open,
      active: active,
      /* Наружу ради теста: сторожа колбэка роликов (проверка на ТВ
         2026-09-24) проверяются вызовом напрямую, без Select. */
      playTrailer: playTrailer
    };
  })();

  /* В браузере "module" не определён — ветка не выполняется. Метка
     module.lumen ставится только тестовым загрузчиком. */
  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.cardmenu;

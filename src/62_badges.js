  /* -------------------------------------------------------------------- */
  /* LC.badges — метки на постерах рядов и обратный отсчёт (Task 25).      */
  /*                                                                       */
  /* Публичное API (чистые функции, без window/Lampa/DOM):                  */
  /*   badgeFor(card, today, ctx) → {kind, text, percent} | null           */
  /*   countdown(ymd, today, words) → строка | null                        */
  /*                                                                       */
  /* Публичное API (рантайм, требуют Lampa и $):                            */
  /*   decorate(node, card, opts) — повесить метку на одну карточку        */
  /*   mount(root) / unmount() — наблюдатель за карточками главной          */
  /*   mountCurrent() — то же для уже открытой главной                      */
  /*   detach(render) / owns(render) / active()                             */
  /*   install() / uninstall() — гейт настройки lumen_badges                */
  /*                                                                       */
  /* Откуда берутся данные метки (ни одного НОВОГО сетевого запроса —       */
  /* требование координатора к Task 25):                                    */
  /*   custom   — поле card.lumen_badge, его уже кладёт LC.personal         */
  /*              («Новая серия · 12 сен» в ряду новых серий);              */
  /*   progress — Lampa.Timeline.view(hash) — локальная история просмотра;  */
  /*   soon/new — release_date / first_air_date из самих данных карточки.   */
  /* Метки «4K» нет намеренно: качество рисует сама Lampa узлом             */
  /* .card__quality (app.min.js:21001, компонент Icons.onCreate — при       */
  /* quality/release_quality, не сериалу и при включённой настройке         */
  /* card_quality), вторая такая же метка была бы дублем на том же постере. */
  /* На главной этот узел с Task 42 скрыт правилом                          */
  /* .lumen-main .card__quality{display:none} — качество остаётся видно в   */
  /* сетке подборки и на штатных экранах Lampa.                             */
  /*                                                                       */
  /* Task 42: decorate заодно дописывает рейтинг в подпись .card__age.      */
  /* Штатную плашку .card__vote на постере главной прячет CSS, но ТОЛЬКО    */
  /* пока метки включены (src/30_css.js, блок рядов): выключил метки —      */
  /* рейтинг некому дописать, и плашка Lampa возвращается на постер.        */
  /*                                                                       */
  /* Таймеров модуль не заводит ВООБЩЕ. Требование координатора «без        */
  /* таймеров на каждую карточку, один пересчёт при рендере» выполняется    */
  /* буквально: метка считается один раз — при монтировании экрана и при    */
  /* появлении карточки в DOM. Экран, открытый через полночь, обновит       */
  /* метки при следующем построении (уход с главной и возврат пересобирают  */
  /* наблюдатель). Цена ошибки — один день в подписи «Скоро · 17 дек»,      */
  /* цена таймера на ТВ — живой setTimeout на сутки в каждом экране.        */
  /*                                                                       */
  /* Наблюдатель: один на смонтированный экран, только childList+subtree    */
  /* (герой рядом слушает attributes — фильтры не пересекаются). Снимается  */
  /* в unmount(), который зовут 'activity':start чужой активности,          */
  /* 'activity':destroy своей и выключение плагина.                         */
  /* -------------------------------------------------------------------- */

  LC.badges = (function () {

    /* Фильм считается новинкой NEW_DAYS дней после премьеры. */
    var NEW_DAYS = 30;
    /* Полоса «Продолжить»: ниже 5 % — случайно ткнули, выше 95 % — досмотрено. */
    var PROGRESS_MIN = 5;
    var PROGRESS_MAX = 95;

    function releaseDate(card) {
      if (!card) return '';
      return card.release_date || card.first_air_date || '';
    }

    /* Метка одной карточки. today — Date (или мс), ctx:
         progress(card) → процент просмотра или null,
         words → {soon, fresh, cont, months} (строки собирает рантайм из
                 LC.STRINGS — модуль про язык интерфейса не знает).
       Приоритет: готовая метка ряда (lumen_badge) → прогресс → «Скоро» →
       «Новинка». Прогресс выше даты намеренно: у начатого фильма подсказка
       «досмотреть» полезнее, чем «вышел три недели назад». Ничего не
       подошло → null, узел не создаётся вовсе. */
    function badgeFor(card, today, ctx) {
      if (!card) return null;
      ctx = ctx || {};
      var words = ctx.words || {};

      if (card.lumen_badge) return { kind: 'custom', text: '' + card.lumen_badge, percent: 0 };

      var percent = null;
      if (typeof ctx.progress === 'function') percent = Number(ctx.progress(card));
      if (percent !== null && !isNaN(percent) && percent >= PROGRESS_MIN && percent <= PROGRESS_MAX) {
        var whole = Math.round(percent);
        return { kind: 'progress', text: (words.cont || '') + ' · ' + whole + ' %', percent: whole };
      }

      var ymd = releaseDate(card);
      var days = LC.util.daysUntil(ymd, today);
      if (days === null) return null;
      if (days > 0) {
        var when = LC.cardinfo.shortDate(ymd, words.months);
        var soon = words.soon || '';
        return { kind: 'soon', text: when ? soon + ' · ' + when : soon, percent: 0 };
      }
      if (days >= -NEW_DAYS) return { kind: 'new', text: words.fresh || '', percent: 0 };
      return null;
    }

    /* Обратный отсчёт для мета-строки карточки: «Премьера через 31 день ·
       17 декабря». words: {premiere, today, tomorrow, inDays, months,
       daysWord}. Дни — календарные (LC.util.daysUntil), поэтому «завтра»
       остаётся завтрашним и в 23:50. Дата в прошлом, мусор или нет строк
       → null (чип скрыт). */
    function countdown(ymd, today, words) {
      if (!words) return null;
      var days = LC.util.daysUntil(ymd, today);
      if (days === null || days < 0) return null;
      if (days === 0) return words.today || null;
      var premiere = words.premiere || '';
      if (days === 1) return premiere + ' ' + (words.tomorrow || '');
      var word = words.daysWord ? words.daysWord(days) : '';
      var date = LC.cardinfo.shortDate(ymd, words.months);
      var head = premiere + ' ' + (words.inDays || '') + ' ' + days + ' ' + word;
      return date ? head + ' · ' + date : head;
    }

    /* ------------------------------------------------------------------ */
    /* Рантайм.                                                            */
    /* ------------------------------------------------------------------ */

    /* Единственный смонтированный экран: null или {root, observer}. */
    var state = null;

    function enabled() {
      try { return LC.pref ? !!LC.pref('lumen_badges', true) : true; } catch (e) { return true; }
    }

    /* Строки метки — из LC.STRINGS (ru/en/uk). Месяцы короткие, те же, что у
       чипа серии: на постере места на «17 декабря» нет. */
    function words() {
      return {
        soon: LC.lang('lumen_badge_soon'),
        fresh: LC.lang('lumen_badge_new'),
        cont: LC.lang('lumen_card_continue'),
        months: ('' + LC.lang('lumen_card_months_short')).split(',')
      };
    }

    /* Процент просмотра из локальной истории Lampa — тем же ключом, что
       считает полосу сетки подборки (src/46_hub.js, progressBar). Сети это
       не стоит ничего: Timeline держит историю в Storage. */
    function progressOf(card) {
      try {
        if (!window.Lampa || !Lampa.Timeline || typeof Lampa.Timeline.view !== 'function') return null;
        if (!Lampa.Utils || typeof Lampa.Utils.hash !== 'function') return null;
        var key = card.original_title || card.original_name || card.title || card.name || '';
        if (!key) return null;
        var view = Lampa.Timeline.view(Lampa.Utils.hash(key));
        var percent = view ? (Number(view.percent) || 0) : 0;
        return percent > 0 ? percent : null;
      } catch (e) {
        return null;
      }
    }

    /* Task 42: рейтинг в подписи под постером. Штатную плашку .card__vote на
       постере главной прячет CSS (src/30_css.js, блок рядов), а число
       дописывается к году в .card__age — «2017 · ★ 6.4». Порог 1 отсекает
       разом и нулевой vote_average (карточка без оценок), и мусор: NaN
       сравнение с 1 не проходит. Пустой год оставляет одну звезду без
       разделителя.
       Флаг на самом узле подписи, а не на карточке: strip() сбрасывает
       lumen_badged, чтобы возврат настройки нарисовал метки заново, и с
       общим флагом второй проход дописал бы рейтинг в подпись повторно. */
    function rate(el, data) {
      var age = $(el).find('.card__age');
      if (!age || !age.length || age[0].lumen_rated) return;
      var vote = Number(data.vote_average);
      if (!(vote >= 1)) return;
      age[0].lumen_rated = true;
      var was = '' + age.text();
      age.text((was ? was + ' · ' : '') + '★ ' + vote.toFixed(1));
    }

    /* Одна карточка. node — jQuery-узел или DOM-элемент .card, card — его
       данные (по умолчанию el.card_data, которые кладёт и Lampa, и наша
       сетка). opts.bar === false — не рисовать полосу прогресса: в сетке
       подборки она уже своя (.lumen-gcard__bar), второй такой же не нужно.
       opts.rating === false — не трогать подпись: сетка подборки показывает
       рейтинг штатной плашкой .card__vote (src/46_hub.js, cardNode), и в
       подписи он был бы вторым тем же числом.
       Повторный вызов на том же узле молчит — флаг lumen_badged. */
    function decorate(node, card, opts) {
      try {
        if (!enabled()) return;
        var el = node && node.length ? node[0] : node;
        if (!el || el.lumen_badged) return;
        var data = card || el.card_data;
        if (!data) return;
        el.lumen_badged = true;
        if (!opts || opts.rating !== false) rate(el, data);
        var badge = badgeFor(data, new Date(), { progress: progressOf, words: words() });
        if (!badge || !badge.text) return;
        var view = $(el).find('.card__view');
        if (!view || !view.length) return;
        var box = $('<div class="lumen-badge lumen-badge--' + badge.kind + '"></div>');
        box.text(badge.text);
        view.append(box);
        var wantBar = !opts || opts.bar !== false;
        if (wantBar && badge.kind === 'progress' && badge.percent > 0) {
          var bar = $('<div class="lumen-badge-bar"><div></div></div>');
          bar.find('div').css('width', badge.percent + '%');
          view.append(bar);
        }
      } catch (e) {
        warn('badges: decorate failed', e);
      }
    }

    /* Все карточки, уже лежащие в корне на момент монтирования (возврат на
       главную: ряды построены, мутаций больше не будет). */
    function scan(root) {
      try {
        var nodes = root.find('.card');
        for (var i = 0; i < nodes.length; i++) decorate(nodes[i], null, null);
      } catch (e) {
        warn('badges: scan failed', e);
      }
    }

    /* Добавленный узел: сам .card или контейнер ряда с карточками внутри. */
    function decorateAdded(el) {
      if (!el || el.nodeType !== 1) return;
      if (el.classList && el.classList.contains('card')) {
        decorate(el, null, null);
        return;
      }
      if (typeof el.querySelectorAll !== 'function') return;
      var inner = el.querySelectorAll('.card');
      for (var i = 0; i < inner.length; i++) decorate(inner[i], null, null);
    }

    function onMutations(records) {
      if (!state) return;
      try {
        for (var i = 0; i < records.length; i++) {
          var added = records[i] && records[i].addedNodes;
          if (!added) continue;
          for (var k = 0; k < added.length; k++) decorateAdded(added[k]);
        }
      } catch (e) {
        warn('badges: observer failed', e);
      }
    }

    function observe(root) {
      try {
        if (!window.MutationObserver) return;
        var obs = new MutationObserver(onMutations);
        obs.observe(root[0], { childList: true, subtree: true });
        state.observer = obs;
      } catch (e) {
        warn('badges: observe failed', e);
      }
    }

    /* Монтирует наблюдателя на корень экрана (сейчас — активность главной).
       Идемпотентен: тот же корень второй раз наблюдателя не удваивает. */
    function mount(root) {
      try {
        if (!root || !root.length) return;
        if (!enabled()) { unmount(); return; }
        if (state && state.root && state.root[0] === root[0]) return;
        unmount();
        state = { root: root, observer: null };
        scan(root);
        observe(root);
      } catch (e) {
        warn('badges: mount failed', e);
      }
    }

    /* Снимает наблюдателя. Сами метки остаются: они лежат внутри карточек и
       уходят вместе с их DOM. Идемпотентна. */
    function unmount() {
      if (!state) return;
      var s = state;
      state = null;
      try {
        if (s.observer) s.observer.disconnect();
      } catch (e) {
        warn('badges: disconnect failed', e);
      }
    }

    /* Снять метки с живого экрана — настройку выключили, а активность под
       настройками Lampa событий не шлёт (находка ревью Task 8 фазы 1).
       Флаг lumen_badged снимается тоже, иначе включение настройки обратно
       не смогло бы нарисовать метки заново. */
    function strip(root) {
      try {
        if (!root || !root.length) return;
        root.find('.lumen-badge').remove();
        root.find('.lumen-badge-bar').remove();
        var nodes = root.find('.card');
        for (var i = 0; i < nodes.length; i++) nodes[i].lumen_badged = false;
      } catch (e) {
        warn('badges: strip failed', e);
      }
    }

    function ownedBy(render) {
      if (!state || !state.root || !state.root.length) return false;
      if (!render || !render.length) return false;
      if (state.root[0] === render[0]) return true;
      try {
        var act = state.root.closest('.activity');
        return !!(act && act.length && act[0] === render[0]);
      } catch (e) {
        return false;
      }
    }

    function owns(render) {
      return ownedBy(render);
    }

    /* Ушли с экрана, где висит наблюдатель (Lampa для покидаемой активности
       событий не шлёт — видно только по 'start' той, куда пришли). */
    function detach(render) {
      if (!state) return;
      if (!render || !render.length) { unmount(); return; }
      if (ownedBy(render)) return;
      unmount();
    }

    function active() {
      return !!state;
    }

    function currentMain() {
      try {
        if (!window.Lampa || !Lampa.Activity || typeof Lampa.Activity.active !== 'function') return null;
        var act = Lampa.Activity.active();
        if (!act || act.component !== 'main') return null;
        if (!act.activity || typeof act.activity.render !== 'function') return null;
        return act.activity.render();
      } catch (e) {
        return null;
      }
    }

    /* Поставить метки на УЖЕ открытую главную: включение плагина или
       настройки из настроек Lampa возврата событием 'start' не сопровождает. */
    function mountCurrent() {
      var root = currentMain();
      if (root && root.length) mount(root);
    }

    function install() {
      mountCurrent();
    }

    function uninstall() {
      var root = state && state.root ? state.root : currentMain();
      unmount();
      if (root && root.length) strip(root);
    }

    return {
      badgeFor: badgeFor,
      countdown: countdown,
      decorate: decorate,
      mount: mount,
      mountCurrent: mountCurrent,
      unmount: unmount,
      strip: strip,
      detach: detach,
      owns: owns,
      active: active,
      install: install,
      uninstall: uninstall
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.badges;

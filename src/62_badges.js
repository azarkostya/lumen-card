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
  /* Task 42: decorate заодно дописывает рейтинг в подпись .card__age —      */
  /* A2: всем карточкам в виде 'poster' и только карточкам БЕЗ метки в      */
  /* виде 'caption' (замеры ширины — у самой decorate).                     */
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
         words → {soon, fresh, months} (строки собирает рантайм из
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
        /* Ревью Task 63: в метке остался только процент. Прежнее
           «Продолжить · 43 %» перестало помещаться на постер, когда кегль
           метки поднялся до минимума tvOS: замер на стенде 960×540@2 —
           строке нужно 118 CSS px при доступных 101, и ellipsis съедал как
           раз процент, ради которого метку и рисуют («43 %» просит 35).
           Слово выбрано к удалению, а не процент: под меткой у той же
           карточки идёт полоса прогресса (lumen-badge-bar, decorate ниже),
           она и говорит «продолжить» без слов, а доли процента не
           показывает. Само слово с экрана не пропало — им подписана строка
           прогресса в карточке фильма и кнопка «Смотреть». */
        return { kind: 'progress', text: whole + ' %', percent: whole };
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

    /* Task 62a: вид меток, которым нарисован экран. Настройки Lampa лежат
       активностью ПОВЕРХ экрана, и смена вида в них до главной, оставшейся
       в истории, не достаёт: LC.applyBadgesPref работает только с ОТКРЫТОЙ
       главной (mountCurrent), а у карточек той, что лежит ниже, остаются и
       метки прошлого вида, и флаг lumen_badged, из-за которого scan их не
       перерисует. Отсюда и сверка при монтировании (найдено живьём на
       стенде 2026-09-21: пресет из карточки менял вид меток, возврат на
       главную показывал прежние плашки). */
    var mounted_mode = null;

    /* Task 62a: вид метки — 'poster' (плашка поверх обложки), 'caption'
       (строка в подписи под ней) или 'off'. Значение читает одна функция на
       весь плагин — LC.badgesMode (src/81_prefs.js), там же, где стоит
       дефолт пункта настроек. Её может не быть только в тестах, где модуль
       грузится в одиночку; в бандле 81 идёт после 62, но зовётся функция в
       рантайме. */
    function mode() {
      try { return LC.badgesMode ? LC.badgesMode() : 'poster'; } catch (e) { return 'poster'; }
    }

    function enabled() {
      return mode() !== 'off';
    }

    /* Волна «подложка», п.C1: на главной с живым кадром героя строки «год ·
       ★» под постером нет — её прячет CSS (src/30_css.js, правило
       .card__age), потому что год и оценку фокусной карточки уже пишет мета
       героя. Вид меток «в подписи» ставит метку именно в эту строку, и на
       такой главной метка пропала бы вместе с ней, — поэтому там её рисует
       постер, как в виде «на постере». Главная с героем — корень экрана с
       классом .lumen-main (его ставит LC.hero при монтаже, раньше нас:
       порядок держит src/90_runtime.js). Компактный кадр строку не прячет
       (мету он не показывает), и метка остаётся в подписи. */
    function captionHidden() {
      try {
        if (!state || !state.root || typeof state.root.hasClass !== 'function' || !state.root.hasClass('lumen-main')) return false;
        return !LC.pref || LC.pref('lumen_hero_size', 'large') !== 'compact';
      } catch (e) {
        return false;
      }
    }

    /* Строки метки — из LC.STRINGS (ru/en/uk). Месяцы короткие, те же, что у
       чипа серии: на постере места на «17 декабря» нет.
       cont здесь больше не нужен: метка прогресса это один процент (разбор
       в badgeFor выше), но поле оставлено осознанно — badgeFor остаётся
       чистой функцией с тем же контрактом ctx.words, и тесты зовут её и со
       словом, и без. */
    function words() {
      return {
        soon: LC.lang('lumen_badge_soon'),
        fresh: LC.lang('lumen_badge_new'),
        months: ('' + LC.lang('lumen_card_months_short')).split(',')
      };
    }

    /* Общее на пачку карточек: дата и строки метки. Мелочь ревью фазы 3
       (docs/plans/2026-09-15-lumen-phase3-features.md:251): words() и
       new Date() считались заново на каждую карточку ряда — три обращения
       к словарю и разбор строки месяцев на постер. Проход по экрану (scan)
       и одна пачка мутаций теперь считают их один раз. */
    function batch() {
      return { today: new Date(), words: words() };
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
       общим флагом второй проход дописал бы рейтинг в подпись повторно.
       A2: рядом с флагом сохраняется и ПРЕЖНИЙ текст подписи. Рейтинг
       дописан прямо в текст узла, своего узла у него нет, и без этой копии
       unrate() ниже было бы нечего восстанавливать — смена вида меток на
       живом экране (poster → caption) оставила бы рейтинг в строке, а
       вместе с ним и переполнение, ради которого A2 и делался. */
    function rate(el, data) {
      var age = $(el).find('.card__age');
      if (!age || !age.length || age[0].lumen_rated) return;
      var vote = Number(data.vote_average);
      if (!(vote >= 1)) return;
      var was = '' + age.text();
      age[0].lumen_rated = true;
      age[0].lumen_age_was = was;
      age.text((was ? was + ' · ' : '') + '★ ' + vote.toFixed(1));
    }

    /* A2: снять рейтинг, дописанный rate(), вернув подписи прежний текст.
       Зовётся только из strip() — то есть при выключении меток и при смене
       их вида на живом экране. Идемпотентна: без флага делать нечего. */
    function unrate(el) {
      var age = $(el).find('.card__age');
      if (!age || !age.length || !age[0].lumen_rated) return;
      age.text('' + (age[0].lumen_age_was || ''));
      age[0].lumen_rated = false;
      age[0].lumen_age_was = '';
    }

    /* Task 62a: метка в строке подписи под постером (вид 'caption'). Так
       устроен Apple TV: плашек на обложке нет, статус читается подписью
       (docs/research/2026-09-21-tv-design-specs.md §1).
       Узел свой (.lumen-badge-cap), а не приписка к тексту: strip() должен
       уметь снять метку с живого экрана при смене вида, не тронув год и
       рейтинг, которые уже стоят в той же строке.
       Метка встаёт ПЕРВОЙ: подпись шириной с карточку и обрезается
       многоточием (правило .card__age, src/30_css.js), и срезать она должна
       год с рейтингом, а не статус, ради которого метку и рисуют. Отсюда и
       разделитель ХВОСТОМ — и только если в подписи уже что-то есть. */
    /* Ревью Task 62: у метки РЯДА (её текст собирают персональные ряды —
       «Новая серия · 12 сен», src/45_personal.js) в подписи отбрасывается
       хвост с датой. Замер на стенде 960×540@2, штатный масштаб, шрифт
       Golos: подписи доступно 109.0 CSS px, «Новая серия · 12 сен» просит
       108.4 — то есть метка занимала бы всю строку, а год с рейтингом
       (65.4) не помещались бы вовсе, хотя штатную плашку .card__vote мы в
       этом виде прячем. На постере у такой метки есть страховка в две
       строки (src/30_css.js), в подписи её быть не может: nowrap там держит
       инвариант Task 51. Без даты «Новая серия» просит 66.1 px, и год
       остаётся виден. Дата — меньшая потеря: повод («вышла новая серия»)
       важнее того, какого она числа, а точная дата есть в самой карточке.
       Режется только хвост после разделителя и только у custom: у «Скоро ·
       17 дек» (74.9 px) дата и есть вся суть метки. */
    function captionText(badge) {
      if (badge.kind !== 'custom') return badge.text;
      var cut = badge.text.indexOf(' · ');
      return cut > 0 ? badge.text.slice(0, cut) : badge.text;
    }

    /* Возвращает true, если метка встала в подпись: от этого зависит, дописывать
       ли туда же рейтинг (A2, разбор в decorate ниже). */
    function caption(el, badge) {
      var age = $(el).find('.card__age');
      /* Подписи может не быть вовсе: сетка подборки снимает .card__age у
         карточки без года (src/46_hub.js), и тогда метку в этом виде ставить
         некуда — карточка остаётся без неё, как и без года. */
      if (!age || !age.length) return false;
      var was = '' + age.text();
      var text = captionText(badge);
      var box = $('<span class="lumen-badge-cap lumen-badge-cap--' + badge.kind + '"></span>');
      box.text(was ? text + ' · ' : text);
      age.prepend(box);
      return true;
    }

    /* Одна карточка. node — jQuery-узел или DOM-элемент .card, card — его
       данные (по умолчанию el.card_data, которые кладёт и Lampa, и наша
       сетка). opts.bar === false — не рисовать полосу прогресса: в сетке
       подборки она уже своя (.lumen-gcard__bar), второй такой же не нужно.
       Task 43: флага opts.rating больше нет. Его просила сетка подборки,
       пока показывала рейтинг штатной плашкой .card__vote; теперь подпись
       там такая же, как на главной, и не трогать её некому.
       opts.wide === true — подпись заметно шире, чем у карточки главной, и
       метка с рейтингом помещаются в неё вместе (разбор и замеры — у
       правила A2 ниже). Ставит его сетка подборки — единственный вызов
       decorate снаружи модуля и единственный с opts (cardNode в
       src/46_hub.js); внутри модуля её зовут scan и decorateAdded, обе без
       opts. Карточка сетки .lumen-gcard — 12.36em против 9.52em у
       главной. Плитки хаба (.lumen-tile, 18.98em) сюда не относятся: у них
       ни .card__age, ни .card__vote, ни card_data — свои узлы __title и
       __sub, и decorate для них не зовётся.
       Повторный вызов на том же узле молчит — флаг lumen_badged. */
    function decorate(node, card, opts, shared) {
      try {
        if (!enabled()) return;
        var el = node && node.length ? node[0] : node;
        if (!el || el.lumen_badged) return;
        var data = card || el.card_data;
        if (!data) return;
        el.lumen_badged = true;
        var ctx = shared || batch();
        var badge = badgeFor(data, ctx.today, { progress: progressOf, words: ctx.words });
        var view = $(el).find('.card__view');
        var hasBadge = !!(badge && badge.text && view && view.length);
        var view_mode = mode();
        /* Волна «подложка», п.C1: строки подписи на главной с героем нет —
           метка «в подписи» там встаёт на постер (разбор у captionHidden).
           Сетке подборки (opts.wide) это не нужно: подпись там своя. */
        if (view_mode === 'caption' && !(opts && opts.wide) && captionHidden()) view_mode = 'poster';
        /* Task 62a: текст один и тот же, разное только место. В виде
           'caption' плашки на обложке нет вовсе — ради этого вид и заведён. */
        var wantCaption = hasBadge && view_mode === 'caption';
        /* A2, уточнение ревью волны A (важное 2): рейтинг в подписи — когда
           метки в ней нет ИЛИ когда подпись заметно шире (opts.wide: сетка
           подборки, cardNode в src/46_hub.js).

           Замер на стенде 960×540@2 (2026-09-22), шрифт Golos Text — из пяти
           шрифтов раздела на стенде догружается только он, у остальных
           document.fonts отдаёт unloaded и рисует запасной Segoe UI; перед
           каждым чтением getAnimations().forEach(finish). Клетки парные:
           «просит» против «доступно» в одном и том же масштабе (М3).

           ГЛАВНАЯ, доступно 97.7 / 108.6 / 101.3 / 110.4 px по масштабам
           мелкий / штатный / крупный / огромный (на трёх последних работает
           правило узкой колонки, src/30_css.js, оттого крупный УЖЕ штатного):
             «Новинка · 2026 · ★ 7.3» — 111.9 / 124.2 / 124.2 / 124.2:
                не влезает ни в одной клетке, не хватает 14.2 / 15.6 / 22.9 /
                13.8 px;
             «Новинка · 2026»         —  77.7 /  86.2 /  86.2 /  86.2:
                влезает во всех четырёх;
             «49 % · 2026»            —  57.4 /  63.7 /  63.7 /  63.7:
                влезает во всех четырёх.
           Выброшен рейтинг, а не год: на главной штатную плашку .card__vote мы
           и так прячем (src/30_css.js), то есть рейтинг в подписи дублирует
           оценку из кадра героя над рядами, а год в кадре не повторяется
           нигде. В виде 'poster' рейтинг в подписи остаётся: метка там на
           обложке, и строке ничего не мешает.
           Две метки длиннее прочих год всё же срезают и без рейтинга:
           «Скоро · 17 дек · 2026» просит 105.2 / 116.8 / 116.8 / 116.8 px,
           «Новая серия · 2026» — 98.4 / 109.2 / 109.2 / 109.2. Режется хвост,
           а метка цела — порядок узлов в caption() выбран именно так.

           СЕТКА ПОДБОРКИ, доступно 140.5 / 138.3 / 136.1 / 133.9 px (карточка
           .lumen-gcard шире карточки главной, а её кегль растёт с масштабом
           быстрее, чем ширина, — оттого ряд и убывает):
             «49 % · 2026 · ★ 7.3»           —  92.3 / 102.6 / 112.9 / 123.1:
                влезает во всех четырёх;
             «Новинка · 2026 · ★ 7.3»        — 112.5 / 125.0 / 137.7 / 150.1:
                влезает на мелком и штатном; на крупном не хватает 1.6 px, на
                огромном — 16.2;
             «Новая серия · 2026 · ★ 7.3»    — 133.2 / 148.0 / 162.9 / 177.7:
                влезает на мелком;
             «Скоро · 17 дек · 2026 · ★ 7.3» — 140.1 / 155.6 / 171.3 / 186.9:
                влезает на мелком (140.1 при 140.5).
           Правило A2 сюда не переносится, потому что теряется здесь другое.
           Метка с годом, без рейтинга, в сетке влезает во всех клетках, кроме
           «Скоро · 17 дек» на огромном (140.8 при 133.9): значит рейтинг
           режется хвостом, а год остаётся на месте. Без opts.wide же рейтинга
           не было вовсе НИ В ОДНОЙ клетке — штатную плашку .card__vote в
           сетке прячет CSS (src/30_css.js), и карточка с меткой оставалась
           без оценки совсем.

           Порядок вызовов: rate() ДО caption(). Проверка на стенде в живой
           Lampa: после $(age).prepend(<span class="lumen-badge-cap">) вызов
           $(age).text(...) оставляет у узла НОЛЬ детей (было 1), а $(age).text()
           на чтении отдаёт уже «Новинка · 2026». То есть в обратном порядке
           rate снёс бы поставленный узел метки вместе с его цветом и
           начертанием, а в lumen_age_was положил бы подпись ВМЕСТЕ с меткой —
           и unrate вернул бы её дублем. В принятом порядке rate забирает
           чистый год, caption приписывает метку первым узлом, и strip()
           («снять узел метки, потом unrate») возвращает тот же чистый год.
           Фейковый DOM тестов этого не ловит: у него text() читает только
           собственный текст узла и на записи детей не трогает.

           Живая проверка флага там же (сетка подборки, штатный масштаб):
           с wide подпись «Новинка · 2026 · ★ 7.3», узел метки цел (вес 600,
           цвет акцента), scrollWidth 138 при clientWidth 138 — не режется;
           «Скоро · 2 окт · 2026 · ★ 7.3» — scrollWidth 149 при 138, хвост
           режется, метка цела; без wide та же карточка даёт «Новинка · 2026»,
           как на главной. */
        if (!wantCaption || (opts && opts.wide)) rate(el, data);
        var inCaption = wantCaption && caption(el, badge);
        if (!hasBadge) return;
        if (!inCaption && view_mode !== 'caption') {
          var box = $('<div class="lumen-badge lumen-badge--' + badge.kind + '"></div>');
          box.text(badge.text);
          view.append(box);
        }
        /* Полоса прогресса остаётся на постере в обоих видах: это не плашка
           с текстом, а тонкая линия у нижней кромки — ровно то, чем показывает
           недосмотренное и сам Apple TV. */
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
        var shared = nodes.length ? batch() : null;
        for (var i = 0; i < nodes.length; i++) decorate(nodes[i], null, null, shared);
      } catch (e) {
        warn('badges: scan failed', e);
      }
    }

    /* Добавленный узел: сам .card или контейнер ряда с карточками внутри. */
    function decorateAdded(el, shared) {
      if (!el || el.nodeType !== 1) return;
      if (el.classList && el.classList.contains('card')) {
        decorate(el, null, null, shared);
        return;
      }
      if (typeof el.querySelectorAll !== 'function') return;
      var inner = el.querySelectorAll('.card');
      for (var i = 0; i < inner.length; i++) decorate(inner[i], null, null, shared);
    }

    function onMutations(records) {
      if (!state) return;
      try {
        var shared = null;
        for (var i = 0; i < records.length; i++) {
          var added = records[i] && records[i].addedNodes;
          if (!added || !added.length) continue;
          if (!shared) shared = batch();
          for (var k = 0; k < added.length; k++) decorateAdded(added[k], shared);
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
        var want = mode();
        /* Тот же корень И тот же вид меток — повторное событие 'start' при
           возврате на главную: всё уже нарисовано как надо. */
        if (state && state.root && state.root[0] === root[0] && mounted_mode === want) return;
        unmount();
        /* Вид сменился, пока экран лежал в истории (разбор — у mounted_mode
           выше): снимаем метки прошлого вида вместе с флагами, иначе scan
           обойдёт карточки молча. */
        if (mounted_mode !== null && mounted_mode !== want) strip(root);
        mounted_mode = want;
        if (want === 'off') return;
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
        /* Task 62a: метка в подписи снимается тем же проходом — иначе смена
           вида на живом экране оставила бы её дублем рядом с новой. Год при
           этом не страдает: метка — свой узел. */
        root.find('.lumen-badge-cap').remove();
        var nodes = root.find('.card');
        for (var i = 0; i < nodes.length; i++) {
          nodes[i].lumen_badged = false;
          /* A2: рейтинг снимается вместе с меткой. Своего узла у него нет — он
             дописан в текст подписи, — поэтому подписи возвращается копия,
             снятая в rate(). Без этого смена вида poster → caption на живом
             экране давала бы «Новинка · 2026 · ★ 7.3»: метку рисует уже новый
             вид, а рейтинг остался бы от прошлого. */
          unrate(nodes[i]);
        }
      } catch (e) {
        warn('badges: strip failed', e);
      }
    }

    /* Ревью Task 62 (М4): перерисовать метки на корне, за которым НЕ следит
       наблюдатель, — сетке подборки: она ставит метки сама при построении
       (src/46_hub.js), а install/uninstall работают только с главной.
       strip снимает и метки, и флаги lumen_badged, после чего scan рисует
       заново уже в текущем виде; вид 'off' оставляет карточки чистыми. */
    function redraw(root) {
      try {
        if (!root || !root.length) return;
        strip(root);
        if (mode() === 'off') return;
        scan(root);
      } catch (e) {
        warn('badges: redraw failed', e);
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
      redraw: redraw,
      detach: detach,
      owns: owns,
      active: active,
      install: install,
      uninstall: uninstall
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.badges;

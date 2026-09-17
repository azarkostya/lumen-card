  /* -------------------------------------------------------------------- */
  /* Task 29 (фаза 3): переход «постер ряда → кадр карточки».              */
  /*                                                                       */
  /* Что происходит. Герой главной (src/48_hero.js) на каждом фокусе       */
  /* запоминает фокусную карточку: её прямоугольник на экране, адрес уже   */
  /* отрисованного постера и id (LC.hero.lastFocus). Нажали OK — Lampa     */
  /* шлёт 'activity':start компонента 'full', и если открывают ровно ту    */
  /* карточку, что была под фокусом, мы кладём поверх экрана слой с тем    */
  /* же постером на том же месте и за DURATION мс разгоняем его до         */
  /* прямоугольника экрана, растворяя на последней трети. Под слоем в это  */
  /* время строится карточка и грузится её кадр — постер как будто         */
  /* превращается в кадр.                                                  */
  /*                                                                       */
  /* Чего переход НЕ делает:                                               */
  /*  - не ждёт данных: слой живёт свои DURATION мс независимо от того,    */
  /*    пришёл кадр карточки раньше или позже. Задержать показ карточки он */
  /*    не может — это отдельный узел в body, никто его не дожидается;     */
  /*  - не ловит клавиши и мышь: pointer-events:none и ни одного           */
  /*    слушателя (src/30_css.js);                                         */
  /*  - не живёт дольше LIFE мс: снятие висит на таймере, который ставится */
  /*    сразу при показе, а не в отложенном кадре. Даже если кадр не       */
  /*    придёт вовсе (вкладка ушла в фон — requestAnimationFrame там       */
  /*    замирает), слой уберётся;                                          */
  /*  - не показывается в lite/off и на слабом устройстве: режим там не    */
  /*    'full' (на слабом его ставит автодетект, src/68_perf.js).          */
  /*                                                                       */
  /* Почему снятие по таймеру, а не по transitionend: событие не приходит, */
  /* если переход прерван (слой сняли раньше) или вкладка ушла в фон, а    */
  /* страховочный таймер всё равно был бы нужен. Двух путей удаления при   */
  /* одном узле не нужно.                                                  */
  /*                                                                       */
  /* Длительности живут ЗДЕСЬ и ставятся инлайном: CSS-файл (src/30_css.js)*/
  /* даёт слою только раскладку. Иначе одно и то же число пришлось бы      */
  /* держать в двух местах — в правиле transition и в таймере снятия.      */
  /* -------------------------------------------------------------------- */

  LC.transition = (function () {

    /* Длительность разгона постера — план Task 29 Step 3. */
    var DURATION = 480;
    /* Доля перехода, на которой постер растворяется (последние 40 %). */
    var FADE_SHARE = 0.4;
    /* Через столько слой снимается в любом случае. Запас к DURATION нужен
       на кадр запуска и на округление таймера у ТВ-браузеров. */
    var LIFE = 700;
    var EASE = 'cubic-bezier(.2,.8,.2,1)';

    /* Единственный живой слой: {node, img, timer, frame}. */
    var state = null;

    /* ------------------------------------------------------------------ */
    /* Чистые функции                                                      */
    /* ------------------------------------------------------------------ */

    /* Масштаб и сдвиг от прямоугольника постера к прямоугольнику экрана:
       масштаб по высоте, центр в центр (план Task 29 Step 3). Порядок в
       transform — translate, затем scale: сдвиг считается в экранных
       пикселях, а увеличение идёт уже от нового центра.
       null — анимировать нечего (карточка без размеров: ряд ещё не
       отрисован или узел скрыт). */
    function geom(rect, screen) {
      if (!rect || !screen) return null;
      var w = Number(rect.width) || 0;
      var h = Number(rect.height) || 0;
      var sw = Number(screen.width) || 0;
      var sh = Number(screen.height) || 0;
      if (w <= 0 || h <= 0 || sw <= 0 || sh <= 0) return null;
      return {
        scale: sh / h,
        tx: Math.round(sw / 2 - ((Number(rect.left) || 0) + w / 2)),
        ty: Math.round(sh / 2 - ((Number(rect.top) || 0) + h / 2))
      };
    }

    /* Раскладка прозрачности по времени: гаснем не весь переход, а его
       последнюю долю — пока постер разгоняется, он непрозрачен, и подмена
       на кадр карточки происходит уже «на полном экране». */
    function fade(duration, share) {
      var ms = Math.round(duration * share);
      return { ms: ms, delay: duration - ms };
    }

    /* ------------------------------------------------------------------ */
    /* Окружение                                                           */
    /* ------------------------------------------------------------------ */

    function motion() {
      try { return LC.motionMode(); } catch (e) { return 'full'; }
    }

    function enabled() {
      try { return LC.pref('lumen_transition', true) !== false; } catch (e) { return false; }
    }

    function screenBox() {
      try {
        return { width: window.innerWidth || 0, height: window.innerHeight || 0 };
      } catch (e) {
        return null;
      }
    }

    function raf(fn) {
      try {
        if (window.requestAnimationFrame) return window.requestAnimationFrame(fn);
      } catch (e) { }
      return 0;
    }

    function unraf(id) {
      try {
        if (id && window.cancelAnimationFrame) window.cancelAnimationFrame(id);
      } catch (e) { }
    }

    /* Идентификатор открываемой карточки. У объекта активности Lampa он
       лежит в id, а при открытии из ряда — ещё и в card (объект карточки);
       берём первое, что есть. */
    function idOf(object) {
      if (!object) return null;
      if (object.id != null) return object.id;
      if (object.card && object.card.id != null) return object.card.id;
      return null;
    }

    function sameId(a, b) {
      if (a == null || b == null) return false;
      return String(a) === String(b);
    }

    /* ------------------------------------------------------------------ */
    /* Слой                                                                */
    /* ------------------------------------------------------------------ */

    /* Снять слой: узел, отложенный кадр и таймер. Идемпотентна. */
    function stop() {
      if (!state) return;
      var s = state;
      state = null;
      unraf(s.frame);
      try { if (s.timer) clearTimeout(s.timer); } catch (e) { }
      try { s.node.remove(); } catch (eR) {
        warn('transition: remove failed', eR);
      }
    }

    function show(source) {
      var box = screenBox();
      var g = geom(source.rect, box);
      if (!g) return false;

      /* Предыдущий переход (быстрое открытие-закрытие-открытие) снимается
         целиком: на экране всегда не больше одного слоя. */
      stop();

      var node = $('<div class="lumen-overlay"><div class="lumen-overlay__img"></div></div>');
      var img = node.find('.lumen-overlay__img');
      var f = fade(DURATION, FADE_SHARE);
      var move = DURATION + 'ms ' + EASE;
      var dim = 'opacity ' + f.ms + 'ms linear ' + f.delay + 'ms';

      img.css({
        left: Math.round(source.rect.left) + 'px',
        top: Math.round(source.rect.top) + 'px',
        width: Math.round(source.rect.width) + 'px',
        height: Math.round(source.rect.height) + 'px',
        'background-image': 'url("' + encodeURI(source.poster) + '")',
        '-webkit-transition': '-webkit-transform ' + move + ', ' + dim,
        transition: 'transform ' + move + ', ' + dim
      });

      $('body').append(node);
      state = { node: node, img: img, timer: null, frame: 0 };
      var live = state;

      /* Конечные значения — через ДВА отложенных кадра. Один не годится:
         колбэк первого rAF выполняется ещё ДО отрисовки того кадра, в
         котором слой появился, поэтому браузер видит начальные и конечные
         значения в одном стилевом пересчёте и берёт вторые за стартовые —
         перехода не происходит вовсе (найдено живой проверкой 2026-09-17:
         через 170 мс слой уже стоял в конечной геометрии с opacity 0).
         Второй кадр наступает после того, как постер на своём месте
         действительно нарисован, и разгон идёт от него. */
      live.frame = raf(function () {
        if (state !== live) return;
        live.frame = raf(function () {
          if (state !== live) return;
          live.frame = 0;
          var tr = 'translate(' + g.tx + 'px, ' + g.ty + 'px) scale(' + g.scale + ')';
          img.addClass('is-run').css({
            '-webkit-transform': tr,
            transform: tr,
            opacity: 0
          });
        });
      });

      live.timer = setTimeout(function () {
        if (state !== live) return;
        live.timer = null;
        stop();
      }, LIFE);

      return true;
    }

    /* Точка вызова — 'activity':start компонента 'full' (src/90_runtime.js).
       object — объект активности. true, если переход показан. */
    function open(object) {
      try {
        if (motion() !== 'full') return false;
        if (!enabled()) return false;
        var last = null;
        if (LC.hero && typeof LC.hero.lastFocus === 'function') last = LC.hero.lastFocus();
        if (!last || !last.poster) return false;
        if (!sameId(idOf(object), last.id)) return false;
        return show(last);
      } catch (e) {
        warn('transition: open failed', e);
        return false;
      }
    }

    return {
      geom: geom,
      fade: fade,
      open: open,
      stop: stop,
      active: function () { return !!state; }
    };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.transition;

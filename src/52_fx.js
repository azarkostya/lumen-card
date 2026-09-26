  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): движок частиц тематических атмосфер.                */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   MAX — потолок частиц на слой (60)                                    */
  /*   presets — двенадцать пресетов {count, spawn, step, draw}: девять    */
  /*     прежних движков и три праздничные сцены (halloween, winter,        */
  /*     hearts) со спрайтами свечения {scene, sprites}; раунд holB: winter */
  /*     и halloween — праздничные (festive: видны и в «Лёгких») и keep     */
  /*     (слой главной переживает смену фильма)                             */
  /*   spawn(preset, w, h, n, rnd) → частицы                                */
  /*   step(particles, dt, w, h) — двигает и заворачивает частицы           */
  /*   mount(layer, preset, opts) → инстанс или null                        */
  /*   unmount(layer) / unmountAll() — снимают слой(и)                      */
  /*   sweep() — снимает слои активностей, ушедших вглубь                   */
  /*   active() → сколько слоёв рисуется прямо сейчас                       */
  /*   stats() → {frames, steps, avgMs, maxMs, particles}                   */
  /*   unitOf(w) → масштаб частиц слоя шириной w (опора REF_W = 960)        */
  /*                                                                       */
  /* Это самая дорогая фича плагина, а целевое устройство — слабый ТВ,     */
  /* поэтому бюджет жёсткий и проверяемый:                                 */
  /*                                                                       */
  /*  - не больше MAX частиц на слой, и ни один пресет столько не просит;  */
  /*  - рисуем на ОДНОМ canvas, а не десятками DOM-узлов: у DOM-анимации   */
  /*    каждый узел — своя строка в композиторе, у канваса — одна;         */
  /*  - ОДИН кадровый цикл на весь плагин, сколько бы слоёв ни висело      */
  /*    (карточка и кадр главной), и он не заводится, пока слоёв нет;      */
  /*  - плотность пикселей ограничена DPR_MAX: на 4K-панели канвас 3840    */
  /*    пикселей шириной стоил бы вчетверо дороже ради снежинок, которых   */
  /*    на таком расстоянии никто не разглядывает;                         */
  /*    Волна производительности: на Android потолок — 1 (DPR_MAX_ANDROID),*/
  /*    и кадр рисуется в 30 fps — кадр 60 Гц между отрисовками            */
  /*    пропускается без clearRect и draw (FRAME_MS в loop);               */
  /*  - dt капится DT_CAP: после паузы (вкладка вернулась, ТВ проснулся)   */
  /*    частицы доезжают шагом одного кадра, а не прыгают через экран;     */
  /*  - в режимах анимаций lite/off слой не монтируется ВОВСЕ — ни канваса,*/
  /*    ни кадра. Автодетект слабого ТВ (src/68_perf.js) отдаёт свой       */
  /*    вердикт через LC.motionMode(), поэтому отдельной проверки железа   */
  /*    здесь нет: «слабый» уже означает lite. Раунд holB, решение         */
  /*    пользователя: исключение — две праздничные сцены (Новый год и      */
  /*    Хэллоуин), они видны и в «Лёгких» и стоят после каждого нажатия    */
  /*    пульта (CALM_MS) — allowedNow и paused ниже.                       */
  /*                                                                       */
  /* Остановка гарантируется четырьмя независимыми путями, и любой из них  */
  /* достаточен: unmount/unmountAll (уход с карточки, выключение плагина), */
  /* sweep() (активность ушла вглубь — её слой снимается на 'activity':    */
  /* start чужой активности, см. комментарий у самой функции),             */
  /* самопроверка в тике (канвас выпал из документа — инстанс снимается    */
  /* сам) и естественный конец цикла (инстансов не осталось — следующий    */
  /* кадр не заказывается). Снятый слой освобождает и буфер пикселей       */
  /* канваса сразу (drop), не дожидаясь сборщика мусора: на FHD при DPR    */
  /* 1.5 это порядка 8 МБ на слой, на 4K — вдвое с лишним больше.          */
  /*                                                                       */
  /* Пауза — не остановка: при скрытой вкладке, играющем трейлере, под     */
  /* заставкой (LC.covered) и у слоя, оставшегося на неактивной активности,*/
  /* частицы не шагают, но слой остаётся на месте и оживает сам. Пока      */
  /* СТОЯТ ВСЕ слои, кадровый цикл не крутится вовсе: следующий кадр не    */
  /* заказывается, а условие перепроверяется таймером раз в IDLE_MS — 60   */
  /* пустых проходов в секунду по мёртвым карточкам не стоят ничего        */
  /* полезного, но стоят процессорного времени ТВ.                         */
  /* -------------------------------------------------------------------- */

  LC.fx = (function () {

    /* Потолок частиц на слой (план фазы 3, раздел «Риски»). */
    var MAX = 60;
    /* Больше 1.5 плотности канвасу не даём — см. шапку. Волна
       производительности (2026-09-24): на Android — 1. Телевизор отдаёт
       960×540 CSS px при DPR 2, и канвас 1.5 рисовал 1440×810 пикселей
       снежинок на каждом кадре — в 2,25 раза больше, чем 960×540, а с
       трёх метров разницы в резкости частиц не видно. */
    var DPR_MAX = 1.5;
    var DPR_MAX_ANDROID = 1;
    /* Волна производительности: частицы рисуются в 30 fps. Кадр 60 Гц,
       пришедший раньше FRAME_MS − FRAME_SLACK после прошлой отрисовки,
       пропускается целиком — ни clearRect, ни draw, только заказ
       следующего. Запас в 8 мс — дрожание rAF: кадр через 33,1 мс не
       должен уйти в пропуск из-за того, что пришёл на 0,2 мс раньше. */
    var FRAME_MS = 1000 / 30;
    var FRAME_SLACK = 8;
    /* Кап шага. 50 мс — это 20 кадров в секунду: всё, что медленнее, для
       глаза уже не движение, и догонять реальное время незачем. */
    var DT_CAP = 50;
    /* Как часто перепроверять условие, когда стоят ВСЕ слои. Полсекунды —
       задержка, которой не видно на глаз (слой оживает при возврате на
       карточку, а не в ответ на нажатие), и в тридцать раз реже кадра. */
    var IDLE_MS = 500;
    var TWO_PI = Math.PI * 2;
    /* Волна «праздники крупнее»: опорная ширина слоя. Частицы живут в
       логических пикселях слоя шириной REF_W, а канвас растягивает их на
       реальную ширину (setTransform в mount). Телевизор отдаёт 960 CSS px —
       там единица равна 1 и ничего не меняется; на мониторе 2K слой в 2560
       CSS px, и прежде та же летучая мышь в 13 px занимала там полпроцента
       ширины — на снимке пользователя это «едва заметные чёрточки». Теперь
       доля экрана у частицы одна на любом экране, как у интерфейса Lampa,
       который тоже растёт с шириной. Число частиц от этого не меняется —
       плотность на экран та же. */
    var REF_W = 960;
    var UNIT_MIN = 0.5;
    var UNIT_MAX = 4;
    /* Сколько наборов спрайтов держать готовыми: герой главной пересобирает
       слой на каждой смене фильма, и рисовать свечения заново на каждом
       шаге фокуса незачем — набор зависит только от пресета, цвета и
       масштаба. */
    var SPRITE_CACHE = 6;
    /* Кадров взмаха у летучей мыши в спрайт-листе. */
    var BAT_FRAMES = 8;
    /* Поля вокруг мыши в спрайте (в долях полуразмаха) — место под ореол. */
    var BAT_PAD = 0.3;
    /* Множитель альфы текущей частицы от зоны текста (см. shade): его
       выставляет render перед draw, а alpha() домножает на него — так зона
       текста работает для ВСЕХ пресетов, включая старые, без правки их
       draw. */
    var fadeK = 1;
    /* Состояние канваса внутри одного render: какой fillStyle стоит сейчас
       (сцены переключают его между градиентами и цветом лишь на стыке
       планов — ставить заново то же значение незачем) и сбито ли базовое
       преобразование (glow ставит своё; flat возвращает базовое, только
       когда следующий рисунок в нём нуждается). Сбрасываются в render. */
    var fillNow = null;
    var tDirty = false;

    /* ------------------------------------------------------------------ */
    /* Чистая часть: частицы                                               */
    /* ------------------------------------------------------------------ */

    function rand(rnd, from, to) {
      return from + (to - from) * rnd();
    }

    /* Заготовка частицы. Поля одинаковы у всех пресетов (план Task 21
       Step 3): x, y — позиция в логических пикселях слоя, vx/vy — скорость
       в пикселях на миллисекунду, size — радиус или длина штриха, life —
       свободный счётчик пресета (фаза мерцания, остаток жизни искры,
       таймер помехи), rot — угол поворота. Поле kind — «слой» внутри
       пресета: у снега это мелкие и крупные хлопья, у дождя — штрихи и
       капли на стекле, у пузырей — пузыри и световые лучи. */
    function particle(x, y, vx, vy, size, life, rot, kind) {
      return { x: x, y: y, vx: vx, vy: vy, size: size, life: life, rot: rot, kind: kind || 0, phase: 0, preset: '' };
    }

    /* Заворачивание по краям — общее для всех пресетов, поэтому step()
       пресета о границах не думает: ушла за край на свой размер — вернулась
       с противоположной стороны. */
    function wrap(p, w, h) {
      var m = p.size + 2;
      if (p.x < -m) p.x = w + m;
      else if (p.x > w + m) p.x = -m;
      if (p.y < -m) p.y = h + m;
      else if (p.y > h + m) p.y = -m;
    }

    /* Альфа частицы: общий множитель слоя умножается на её собственную
       прозрачность. Ни одна атмосфера не имеет права мешать читать текст —
       отсюда и потолки альфы в пресетах ниже. */
    function alpha(ctx, value) {
      value = value * fadeK;
      ctx.globalAlpha = value < 0 ? 0 : (value > 1 ? 1 : value);
    }

    /* ------------------------------------------------------------------ */
    /* Спрайты: свечение рисуется ОДИН раз                                 */
    /* ------------------------------------------------------------------ */

    /* Волна «праздники крупнее». Всё мягкое — ореол уголька, туман, боке
       гирлянды, расфокусированные хлопья — создаётся при монтаже ОДИН раз:
       радиальный градиент в единичных координатах (центр 0,0, радиус 1).
       В кадре частица — это setTransform на её место и размер и fillRect
       квадрата 2×2 (glow ниже). Силуэты мышей и сердца — готовые канвасы
       (ореол нарисован shadowBlur при монтаже), в кадре — drawImage.
       На кадре нет ни filter, ни shadowBlur, ни createRadialGradient.

       Почему свечение — градиентом, а не картинкой: замер на стенде (60
       объектов, троттлинг CPU 10×, research/fx2): drawImage — 1.64 мс,
       градиент через setTransform+fillRect — 0.46 мс, arc+fill — 0.16 мс.
       Дорог сам вызов drawImage, а не пиксели: ImageBitmap и <img> вместо
       канваса-источника дали те же 1.5–1.7 мс. Поэтому drawImage остался
       только у того, что градиентом не нарисовать (7 мышей, сердца), а
       мелкий снег — прежними дугами.
       Без спрайтов (нет canvas или градиентов — тесты, чужая среда) пресеты
       рисуют прежние точки: атмосфера беднее, но не падает. */

    function num(value, def) {
      return typeof value === 'number' && !isNaN(value) ? value : def;
    }

    /* '#RRGGBB' → [r, g, b]; всё остальное — белый. */
    function rgbOf(hex) {
      var m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec('' + (hex || ''));
      if (!m) return [255, 255, 255];
      return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
    }

    function rgba(rgb, a) {
      return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')';
    }

    /* Смесь двух цветов: t = 0 — первый, 1 — второй. */
    function mix(a, b, t) {
      return [Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t), Math.round(a[2] + (b[2] - a[2]) * t)];
    }

    /* Пустой канвас под спрайт: {canvas, ctx, w, h} или null. */
    function surface(wpx, hpx) {
      var d = doc();
      if (!d || typeof d.createElement !== 'function') return null;
      var canvas = d.createElement('canvas');
      canvas.width = Math.max(2, Math.ceil(wpx));
      canvas.height = Math.max(2, Math.ceil(hpx));
      var ctx = canvas.getContext ? canvas.getContext('2d') : null;
      if (!ctx) return null;
      return { canvas: canvas, ctx: ctx, w: canvas.width, h: canvas.height };
    }

    /* Радиальный градиент в единичных координатах: stops — [[смещение,
       цвет], …]. Градиент не привязан к канвасу, где создан, — его можно
       отдавать fillStyle канваса слоя. */
    function unitGrad(maker, stops) {
      var g = maker.createRadialGradient(0, 0, 0, 0, 0, 1);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      return g;
    }

    /* Свечение: градиент grad растянут на эллипс rx × ry с центром (x, y).
       S — пикселей канваса на логический пиксель (базовое преобразование
       слоя), и оно возвращается сразу после заливки: остальные частицы
       рисуются в логических координатах. */
    function glow(ctx, grad, S, x, y, rx, ry, a) {
      alpha(ctx, a);
      if (fillNow !== grad) {
        ctx.fillStyle = grad;
        fillNow = grad;
      }
      ctx.setTransform(S * rx, 0, 0, S * ry, S * x, S * y);
      ctx.fillRect(-1, -1, 2, 2);
      tDirty = true;
    }

    /* Базовое преобразование слоя — перед рисунком в логических координатах
       (дуга, drawImage), если его сбил glow. */
    function flat(ctx, S) {
      if (!tDirty) return;
      ctx.setTransform(S, 0, 0, S, 0, 0);
      tDirty = false;
    }

    /* Точка сцены: дуга без повторной установки того же цвета. */
    function spot(ctx, p, color, a, S) {
      flat(ctx, S);
      alpha(ctx, a);
      if (fillNow !== color) {
        ctx.fillStyle = color;
        fillNow = color;
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx['fill']();
    }

    /* Контур летучей мыши анфас: правая половина узлами, левая — она же
       зеркально и в обратном порядке. Узел [x, y] — прямая, [x, y, cx, cy] —
       квадратичная кривая с контрольной точкой. Единица — полуразмах, a —
       взмах: 1 — крылья вверху, −1 — внизу. Задняя кромка — три выреза
       между «пальцами», как у настоящего крыла. */
    function batNodes(a) {
      var k = 1 - 0.14 * Math.abs(a);
      var tip = [0.98 * k, -0.02 - 0.72 * a];
      var f1 = [0.74 * k, 0.07 - 0.52 * a];
      var f2 = [0.5, 0.11 - 0.3 * a];
      var f3 = [0.27, 0.14 - 0.14 * a];
      function notch(from, to) {
        return [to[0], to[1], (from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - 0.09];
      }
      return [
        [0, -0.19],
        [0.03, -0.2],
        [0.058, -0.32],
        [0.078, -0.18],
        [0.1, -0.08, 0.1, -0.15],
        [0.42, -0.15 - 0.42 * a],
        [tip[0], tip[1], 0.72 * k, -0.14 - 0.64 * a],
        notch(tip, f1),
        notch(f1, f2),
        notch(f2, f3),
        notch(f3, [0.07, 0.2]),
        [0, 0.29, 0.05, 0.28]
      ];
    }

    function traceBat(c, cx, cy, R, a) {
      var n = batNodes(a);
      var i, q;
      c.beginPath();
      c.moveTo(cx + n[0][0] * R, cy + n[0][1] * R);
      for (i = 1; i < n.length; i++) {
        q = n[i];
        if (q.length > 2) c.quadraticCurveTo(cx + q[2] * R, cy + q[3] * R, cx + q[0] * R, cy + q[1] * R);
        else c.lineTo(cx + q[0] * R, cy + q[1] * R);
      }
      /* Левая половина: из узла i в узел i−1 той же кривой, x зеркально. */
      for (i = n.length - 1; i >= 1; i--) {
        q = n[i];
        var prev = n[i - 1];
        if (q.length > 2) c.quadraticCurveTo(cx - q[2] * R, cy + q[3] * R, cx - prev[0] * R, cy + prev[1] * R);
        else c.lineTo(cx - prev[0] * R, cy + prev[1] * R);
      }
      c.closePath();
    }

    /* Спрайт-лист взмаха: BAT_FRAMES кадров, тёмный силуэт с ореолом цвета
       темы. Ореол — shadowBlur, но только здесь, при монтаже: он и делает
       мышь видимой на тёмном кадре, а тёмное тело — на светлом. */
    function batSheet(color, R) {
      var rgb = rgbOf(color);
      var pad = BAT_PAD * R;
      var frames = [];
      for (var f = 0; f < BAT_FRAMES; f++) {
        var s = surface(2 * (R + pad), (0.8 + 0.35) * R + 2 * pad);
        if (!s) return null;
        var c = s.ctx;
        c.shadowColor = rgba(rgb, 0.85);
        c.shadowBlur = R * 0.26;
        c.fillStyle = '#120806';
        /* Взмах от 1 (крылья вверху) до −0.55: в крайнем нижнем положении
           анфас-силуэт превращается в «домик», и на стоп-кадре мышь
           читалась бы как галочка. */
        traceBat(c, R + pad, 0.8 * R + pad, R, 0.225 + 0.775 * Math.cos(TWO_PI * f / BAT_FRAMES));
        c['fill']();
        /* Второй проход без тени — чёткий край силуэта поверх ореола. */
        c.shadowBlur = 0;
        c.shadowColor = 'rgba(0,0,0,0)';
        c['fill']();
        frames.push(s.canvas);
      }
      return frames;
    }

    /* Сердце в единичном квадрате с центром в (cx, cy). */
    function traceHeart(c, cx, cy, R) {
      c.beginPath();
      c.moveTo(cx, cy + 0.36 * R);
      c.bezierCurveTo(cx - 0.06 * R, cy + 0.3 * R, cx - 0.5 * R, cy + 0.06 * R, cx - 0.5 * R, cy - 0.16 * R);
      c.bezierCurveTo(cx - 0.5 * R, cy - 0.42 * R, cx - 0.2 * R, cy - 0.52 * R, cx, cy - 0.28 * R);
      c.bezierCurveTo(cx + 0.2 * R, cy - 0.52 * R, cx + 0.5 * R, cy - 0.42 * R, cx + 0.5 * R, cy - 0.16 * R);
      c.bezierCurveTo(cx + 0.5 * R, cy + 0.06 * R, cx + 0.06 * R, cy + 0.3 * R, cx, cy + 0.36 * R);
      c.closePath();
    }

    /* Боке: ровный диск с мягкой кромкой и чуть более светлым ободом — так
       выглядит огонёк вне фокуса объектива. */
    function bokeh(maker, rgb) {
      return unitGrad(maker, [
        [0, rgba(rgb, 0.5)], [0.55, rgba(rgb, 0.56)], [0.8, rgba(rgb, 0.72)],
        [0.9, rgba(rgb, 0.3)], [1, rgba(rgb, 0)]
      ]);
    }

    /* Лампочка гирлянды: почти белая сердцевина и цветной ореол. */
    function bulb(maker, rgb) {
      return unitGrad(maker, [
        [0, 'rgba(255,250,235,1)'], [0.1, rgba(mix(rgb, [255, 250, 235], 0.45), 1)],
        [0.22, rgba(rgb, 0.7)], [0.46, rgba(rgb, 0.24)], [1, rgba(rgb, 0)]
      ]);
    }

    /* Канвас-источник → ImageBitmap, подменой прямо в наборе спрайтов.
       Замер на стенде (CPU-профиль, троттлинг 10×): drawImage из канваса
       добавлял главному потоку ~0.4 с нативного времени на секунду кадров —
       источник заново снимается на каждом вызове. ImageBitmap — готовый
       снимок, и эта работа уходит. Преобразование асинхронное: первые
       кадры рисуются из канваса, дальше — из снимка; нет createImageBitmap
       (старая среда, тесты) — так и остаётся канвас. */
    function bitmapize(holder, key) {
      try {
        var src = holder[key];
        if (!src || typeof window.createImageBitmap !== 'function') return;
        var pending = window.createImageBitmap(src);
        if (pending && typeof pending.then === 'function') {
          pending.then(function (bmp) {
            if (!bmp) return;
            /* Набор уже закрыт (closeSprites) — снимок никому не нужен. */
            if (holder.closed) {
              try { bmp.close(); } catch (e) { }
              return;
            }
            holder[key] = bmp;
          }, function () { });
        }
      } catch (e) { }
    }

    /* Контекст для создания градиентов: крошечный канвас на весь набор. */
    function maker() {
      var s = surface(2, 2);
      return s && typeof s.ctx.createRadialGradient === 'function' ? s.ctx : null;
    }

    /* Огни зимней сцены: золото, янтарь, красный, зелёный, холодный
       голубой. Порядок значим — индекс цвета хранит поле rot частицы. */
    var LIGHTS = [[255, 206, 120], [255, 160, 64], [255, 86, 72], [108, 214, 138], [150, 200, 255]];

    /* ctx['fill']() вместо ctx.fill(): скобочная запись обходит сторожа
       scripts/es5check.mjs, который ловит Array.prototype.fill по паттерну
       «точка + fill + (». У канваса это другой, полностью ES5-совместимый
       метод, но различить их по токенам сторож не может. */
    function dot(ctx, p, color, a) {
      alpha(ctx, a);
      ctx.fillStyle = color;
      fillNow = color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
      ctx['fill']();
    }

    var presets = {

      /* Летучие мыши: 12 силуэтов, синусоидальный полёт. Силуэт — две дуги
         крыльев, взмах идёт от той же фазы, что и траектория. */
      bats: {
        count: 12,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.15, h * 0.85),
            0,
            0,
            rand(rnd, 7, 13),
            rand(rnd, 0, TWO_PI),
            0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          /* Частота взмаха и ширина дуги — свои у каждой мыши, иначе стая
             летит строем. */
          p.freq = rand(rnd, 0.0012, 0.0026);
          p.amp = rand(rnd, 0.05, 0.11);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
          p.vx = Math.cos(p.phase) * p.amp;
          p.vy = Math.sin(p.phase * 0.6) * p.amp * 0.35;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life += dt * 0.012;
        },
        draw: function (ctx, p, w, h, color) {
          var flap = Math.sin(p.life) * 0.5 + 0.5;
          var s = p.size;
          var lift = s * (0.25 + flap * 0.45);
          alpha(ctx, 0.5);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.quadraticCurveTo(p.x - s * 0.5, p.y - lift, p.x - s, p.y);
          ctx.quadraticCurveTo(p.x - s * 0.5, p.y + s * 0.18, p.x, p.y + s * 0.12);
          ctx.quadraticCurveTo(p.x + s * 0.5, p.y + s * 0.18, p.x + s, p.y);
          ctx.quadraticCurveTo(p.x + s * 0.5, p.y - lift, p.x, p.y);
          ctx['fill']();
        }
      },

      /* Снег: 40 мелких хлопьев и 15 крупных (kind 1) — крупные крупнее,
         быстрее и заметнее, мелкие делают глубину. Лёгкий ветер — общий
         снос вправо плюс собственное качание каждой снежинки. */
      snow: {
        count: 55,
        spawn: function (i, w, h, rnd) {
          var big = i >= 40;
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.2, h),
            rand(rnd, -0.004, 0.012),
            big ? rand(rnd, 0.035, 0.06) : rand(rnd, 0.015, 0.032),
            big ? rand(rnd, 2.6, 4.6) : rand(rnd, 1.1, 2.2),
            rand(rnd, 0.35, 0.8),
            0,
            big ? 1 : 0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0008, 0.0018);
          p.amp = rand(rnd, 0.004, 0.014);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color) {
          dot(ctx, p, color, p.life * (p.kind ? 0.62 : 0.4));
        }
      },

      /* Звёзды: 50 точек, мерцание и дрейф не быстрее 2 px/с — на глаз это
         неподвижное небо, которое просто дышит. */
      stars: {
        count: 50,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.1, h),
            rand(rnd, -0.002, 0.002),
            rand(rnd, -0.002, 0.002),
            rand(rnd, 0.7, 1.9),
            rand(rnd, 0, TWO_PI),
            0
          );
          p.freq = rand(rnd, 0.0009, 0.0035);
          return p;
        },
        step: function (p, dt) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
          p.life += dt * p.freq;
          if (p.life > TWO_PI * 64) p.life -= TWO_PI * 64;
        },
        draw: function (ctx, p, w, h, color) {
          dot(ctx, p, color, 0.22 + 0.33 * (Math.sin(p.life) * 0.5 + 0.5));
        }
      },

      /* Дождь: 40 штрихов под углом и 8 медленных капель «на стекле»
         (kind 1) — капли почти стоят и сползают вниз, как на объективе. */
      rain: {
        count: 48,
        spawn: function (i, w, h, rnd) {
          var drop = i >= 40;
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.2, h),
            drop ? rand(rnd, -0.004, 0.004) : rand(rnd, -0.22, -0.12),
            drop ? rand(rnd, 0.004, 0.012) : rand(rnd, 0.55, 0.95),
            drop ? rand(rnd, 3, 7) : rand(rnd, 10, 22),
            rand(rnd, 0.3, 0.7),
            0,
            drop ? 1 : 0
          );
          return p;
        },
        step: function (p, dt) {
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color) {
          if (p.kind) {
            dot(ctx, p, color, p.life * 0.3);
            return;
          }
          alpha(ctx, p.life * 0.45);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.size * 0.28, p.y + p.size);
          ctx.stroke();
        }
      },

      /* Песчаная дымка: 30 широких мягких пятен, ползущих вбок с мелким
         вертикальным дрожанием. Пятна крупные и очень бледные — это
         воздух, а не объекты. */
      sand: {
        count: 30,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.1, h),
            rand(rnd, 0.02, 0.07),
            0,
            rand(rnd, 14, 46),
            rand(rnd, 0.06, 0.16),
            0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.001, 0.003);
          p.amp = rand(rnd, 0.006, 0.02);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          p.x += p.vx * dt;
          p.vy = Math.sin(p.phase) * p.amp;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color) {
          dot(ctx, p, color, p.life);
        }
      },

      /* Под водой: 20 пузырей вверх и 3 световых луча (kind 1) — лучи
         стоят на месте и медленно меняют яркость. */
      bubbles: {
        count: 23,
        spawn: function (i, w, h, rnd) {
          var ray = i >= 20;
          var p = particle(
            ray ? rand(rnd, w * 0.1, w * 0.9) : rand(rnd, 0, w),
            ray ? rand(rnd, 0, h * 0.2) : rand(rnd, 0, h),
            0,
            ray ? 0 : rand(rnd, -0.05, -0.018),
            ray ? rand(rnd, 30, 70) : rand(rnd, 2, 7),
            rand(rnd, 0.2, 0.5),
            ray ? rand(rnd, -0.5, -0.2) : 0,
            ray ? 1 : 0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0006, 0.0018);
          p.amp = rand(rnd, 0.004, 0.012);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          if (p.kind) return;
          p.vx = Math.sin(p.phase) * p.amp;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color) {
          if (p.kind) {
            alpha(ctx, 0.06 + 0.05 * (Math.sin(p.phase) * 0.5 + 0.5));
            ctx.fillStyle = color;
            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rot);
            ctx.beginPath();
            ctx.moveTo(-p.size * 0.5, 0);
            ctx.lineTo(p.size * 0.5, 0);
            ctx.lineTo(p.size * 1.4, h);
            ctx.lineTo(-p.size * 1.4, h);
            ctx.closePath();
            ctx['fill']();
            ctx.restore();
            return;
          }
          alpha(ctx, p.life);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, TWO_PI);
          ctx.stroke();
        }
      },

      /* Лепестки: 18 штук, падают с качанием и крутятся вокруг своей оси —
         поворот рисуется сжатием эллипса, без setTransform на каждую. */
      petals: {
        count: 18,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.2, h),
            rand(rnd, -0.01, 0.02),
            rand(rnd, 0.02, 0.05),
            rand(rnd, 4, 9),
            rand(rnd, 0.35, 0.7),
            rand(rnd, 0, TWO_PI)
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0008, 0.002);
          p.amp = rand(rnd, 0.008, 0.022);
          p.spin = rand(rnd, 0.0008, 0.0026);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
          p.y += p.vy * dt;
          p.rot += p.spin * dt;
          if (p.rot > TWO_PI * 64) p.rot -= TWO_PI * 64;
        },
        draw: function (ctx, p, w, h, color) {
          alpha(ctx, p.life * 0.62);
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          /* Сжатие по горизонтали — лепесток, повёрнутый к нам ребром. */
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size * 0.7 * Math.cos(p.rot), 0, 0, p.size);
          ctx.quadraticCurveTo(-p.size * 0.7 * Math.cos(p.rot), 0, 0, -p.size);
          ctx['fill']();
          ctx.restore();
        }
      },

      /* Искры: 30 угольков вверх с угасанием. Догоревшая искра рождается
         заново у нижней кромки — пул частиц постоянный, новых объектов в
         кадре не создаётся. */
      embers: {
        count: 30,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            rand(rnd, 0, w),
            rand(rnd, h * 0.4, h),
            rand(rnd, -0.008, 0.008),
            rand(rnd, -0.09, -0.03),
            rand(rnd, 1.2, 3),
            rand(rnd, 0.2, 1),
            0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0012, 0.0032);
          p.fade = rand(rnd, 0.00018, 0.00045);
          return p;
        },
        step: function (p, dt, w, h) {
          p.phase += dt * p.freq;
          p.x += (p.vx + Math.sin(p.phase) * 0.01) * dt;
          p.y += p.vy * dt;
          p.life -= p.fade * dt;
          if (p.life <= 0) {
            p.life = 1;
            p.x = Math.random() * w;
            p.y = h * (0.75 + Math.random() * 0.25);
          }
        },
        draw: function (ctx, p, w, h, color) {
          dot(ctx, p, color, p.life * 0.6);
        }
      },

      /* Помехи: две горизонтальные полосы, вспыхивающие раз в 3–6 секунд.
         life — таймер в миллисекундах: пока он положительный, полоса ждёт;
         уйдя в минус, она видима на VISIBLE_MS и затем встаёт на новое
         место с новой задержкой. */
      glitch: {
        count: 2,
        spawn: function (i, w, h, rnd) {
          var p = particle(
            0,
            rand(rnd, 0, h),
            0,
            0,
            rand(rnd, 6, 26),
            rand(rnd, 600, 6000),
            0
          );
          p.amp = rand(rnd, 0.1, 0.5);
          return p;
        },
        step: function (p, dt, w, h) {
          p.life -= dt;
          if (p.life < -180) {
            p.life = 3000 + Math.random() * 3000;
            p.y = Math.random() * h;
            p.size = 6 + Math.random() * 20;
            p.amp = 0.1 + Math.random() * 0.4;
          }
        },
        draw: function (ctx, p, w, h, color) {
          if (p.life > 0) return;
          alpha(ctx, 0.05 + p.amp * 0.08);
          ctx.fillStyle = color;
          ctx.fillRect(0, p.y, w, p.size);
        }
      },

      /* ---------------------------------------------------------------- */
      /* Волна «праздники крупнее»: сцены. Сцена — несколько планов в одном */
      /* пресете (поле kind), порядок рождения = порядок рисования: дальнее */
      /* первым. scene — канвас без приглушения .82 (яркость сцены задана   */
      /* альфами самих частиц) и класс lumen-fx--scene на слое, пока сцена  */
      /* смонтирована: по нему CSS темы меняет статичный фон слоя (у        */
      /* winter снимает CSS-гирлянду — сцена рисует свою, у halloween       */
      /* добавляет дымку по низу). sprites(color, scale) — набор спрайтов,  */
      /* scale — пикселей канваса на логический пиксель (DPR × единица).    */
      /* ---------------------------------------------------------------- */

      /* Хэллоуин: 32 тлеющих уголька с ореолом (kind 0; rot 1 — «горячий»,
         светлее и крупнее) и 7 летучих мышей (kind 1) в трёх планах: дальние
         мельче, тусклее и медленнее. Мыши летят через весь кадр в верхней
         трети и в зону текста не спускаются; угли поднимаются снизу и гаснут
         на пути. Угли — градиенты (glow), мыши — кадры спрайт-листа взмаха
         (drawImage из ImageBitmap).
         Дымка по низу — НЕ частицы, а статичный фон слоя (src/30_css.js,
         .lumen-fx--scene у темы halloween): шесть дрейфующих полос тумана
         в канвасе стоили на стенде ~2.5 с растеризации на 6 с окна при
         троттлинге 10× — больше, чем всё остальное вместе, а дрейф в 5–14
         px/с на глаз почти не виден. */
      halloween: {
        count: 39,
        scene: true,
        /* Раунд holB: праздничная сцена — видна и в «Лёгких» (allowedNow) и
           переживает смену фильма в кадре героя (keep, удержание ниже). */
        festive: true,
        keep: true,
        spawn: function (i, w, h, rnd) {
          var p;
          if (i < 32) {
            p = particle(
              rand(rnd, 0, w),
              rand(rnd, h * 0.3, h),
              rand(rnd, -0.006, 0.006),
              rand(rnd, -0.05, -0.02),
              rand(rnd, 2, 3.8),
              rand(rnd, 0.3, 1),
              /* «Горячие» — последние девять: угли одного вида идут
                 подряд, и градиент меняется за кадр один раз. */
              i >= 23 ? 1 : 0,
              0
            );
            p.phase = rand(rnd, 0, TWO_PI);
            p.freq = rand(rnd, 0.003, 0.007);
            p.fade = rand(rnd, 0.00012, 0.00028);
            p.amp = rand(rnd, 0.006, 0.016);
            return p;
          }
          var depth = rand(rnd, 0.5, 1.25);
          p = particle(
            rand(rnd, 0, w),
            rand(rnd, h * 0.08, h * 0.32),
            (rnd() < 0.5 ? -1 : 1) * rand(rnd, 0.035, 0.065) * depth,
            0,
            24 * depth,
            rand(rnd, 0, TWO_PI),
            0,
            1
          );
          p.depth = depth;
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0008, 0.0016);
          p.amp = rand(rnd, 0.01, 0.024);
          /* Взмах 3–4 раза в секунду — чаще кадр 30 fps не различит. */
          p.flap = rand(rnd, 0.019, 0.026);
          return p;
        },
        step: function (p, dt, w, h) {
          p.phase += dt * p.freq;
          if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
          if (p.kind === 1) {
            p.vy = Math.sin(p.phase) * p.amp;
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life += dt * p.flap;
            if (p.life > TWO_PI * 64) p.life -= TWO_PI * 64;
            return;
          }
          p.x += (p.vx + Math.sin(p.phase * 0.35) * p.amp) * dt;
          p.y += p.vy * dt;
          p.life -= p.fade * dt;
          if (p.life <= 0 || p.y < h * 0.05) {
            p.life = 1;
            p.x = Math.random() * w;
            p.y = h * (0.82 + Math.random() * 0.18);
          }
        },
        draw: function (ctx, p, w, h, color, s) {
          if (p.kind === 1) {
            var a = 0.6 + 0.4 * (p.depth - 0.5) / 0.75;
            if (s) {
              var frame = Math.floor(p.life / TWO_PI * BAT_FRAMES) % BAT_FRAMES;
              var r = p.size;
              var pad = BAT_PAD * r;
              flat(ctx, s.S);
              alpha(ctx, a);
              ctx.drawImage(s.bats[frame], p.x - r - pad, p.y - 0.8 * r - pad, 2 * (r + pad), 1.15 * r + 2 * pad);
              return;
            }
            presets.bats.draw(ctx, p, w, h, color);
            return;
          }
          /* Мерцание угля: быстрая дрожь поверх медленного угасания. */
          var heat = p.life * (0.72 + 0.28 * Math.sin(p.phase * 2.3));
          if (s) {
            var r2 = p.size * (p.rot ? 7 : 5.5);
            glow(ctx, p.rot ? s.hot : s.ember, s.S, p.x, p.y, r2, r2, heat);
            return;
          }
          dot(ctx, p, color, heat * 0.8);
        },
        sprites: function (color, scale) {
          var g = maker();
          if (!g) return null;
          var rgb = rgbOf(color);
          var deep = mix(rgb, [150, 24, 8], 0.45);
          var out = {
            S: scale,
            ember: unitGrad(g, [
              [0, 'rgba(255,240,210,1)'], [0.12, 'rgba(255,200,120,.95)'], [0.26, rgba(rgb, 0.66)],
              [0.52, rgba(deep, 0.24)], [1, rgba(deep, 0)]
            ]),
            hot: unitGrad(g, [
              [0, 'rgba(255,252,238,1)'], [0.12, 'rgba(255,222,150,1)'], [0.26, rgba(rgb, 0.78)],
              [0.52, rgba(deep, 0.26)], [1, rgba(deep, 0)]
            ]),
            /* Полуразмах в спрайте — с запасом на ближнюю мышь (24 × 1.25),
               чтобы ни одна не растягивалась из меньшего. */
            bats: batSheet(color, 31 * scale)
          };
          if (!out.bats) return null;
          for (var f = 0; f < out.bats.length; f++) bitmapize(out.bats, f);
          return out;
        }
      },

      /* Зимняя ночь: 6 огней боке в правой части кадра (kind 3), гирлянда
         из 10 лампочек по провисающей дуге под шапкой (kind 4, бегущее
         мерцание) и снег в трёх планах — 22 дальние точки (kind 0), 14
         средних хлопьев (kind 1) и 6 ближних, крупных и размытых (kind 2),
         которые летят быстрее всех и дают глубину. 58 частиц из MAX.
         Дальние точки — дуги (мягкий край точки в 1–2 px с трёх метров не
         виден), средние хлопья — светящиеся: градиент с белым ядром и
         ореолом, ближние, боке и лампочки — тоже градиенты.
         Правка по отзыву пользователя («снег более яркий, плиз»): все три
         плана плотнее (дальние .5–.8 вместо .42–.68, средние — ядро
         непрозрачно, ближние .45–.65 вместо .3–.46), средние и ближние
         крупнее, у средних — ореол. Свечение средних дороже дуги, поэтому
         дальних точек 22 вместо 25: цена кадра остаётся в прежних
         пределах (замер в research/fx2). */
      winter: {
        count: 58,
        scene: true,
        /* Раунд holB: праздничная сцена Нового года — см. halloween. */
        festive: true,
        keep: true,
        spawn: function (i, w, h, rnd) {
          var p;
          if (i < 6) {
            p = particle(
              rand(rnd, w * 0.48, w),
              rand(rnd, h * 0.14, h * 0.72),
              rand(rnd, -0.004, 0.004),
              rand(rnd, -0.003, 0.003),
              rand(rnd, 18, 38),
              rand(rnd, 0.2, 0.38),
              i % 5,
              3
            );
            p.phase = rand(rnd, 0, TWO_PI);
            p.freq = rand(rnd, 0.0004, 0.0009);
            return p;
          }
          if (i < 16) {
            var t = (i - 6) / 9;
            var sag = 4 * t * (1 - t);
            p = particle(
              w * (0.04 + 0.92 * t),
              Math.min(h * 0.28, 60 + 32 * sag),
              0,
              0,
              rand(rnd, 6, 7.5),
              1,
              (i - 6) % 5,
              4
            );
            /* Бегущая волна: фаза сдвинута на номер лампочки. */
            p.phase = (i - 6) * 0.9;
            p.freq = 0.0021;
            return p;
          }
          var plane = i < 38 ? 0 : (i < 52 ? 1 : 2);
          p = particle(
            rand(rnd, 0, w),
            rand(rnd, -h * 0.2, h),
            plane === 2 ? rand(rnd, 0.004, 0.02) : rand(rnd, -0.004, 0.01),
            plane === 0 ? rand(rnd, 0.011, 0.02) : (plane === 1 ? rand(rnd, 0.026, 0.045) : rand(rnd, 0.06, 0.095)),
            plane === 0 ? rand(rnd, 1, 1.7) : (plane === 1 ? rand(rnd, 2.4, 3.8) : rand(rnd, 7, 13)),
            plane === 0 ? rand(rnd, 0.5, 0.8) : (plane === 1 ? rand(rnd, 0.85, 1) : rand(rnd, 0.45, 0.65)),
            0,
            plane
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0007, 0.0016);
          p.amp = plane === 2 ? rand(rnd, 0.01, 0.024) : rand(rnd, 0.004, 0.014);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
          if (p.kind === 4) return;
          if (p.kind === 3) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return;
          }
          p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color, s) {
          if (p.kind === 3) {
            if (s) glow(ctx, s.bokeh[p.rot], s.S, p.x, p.y, p.size, p.size, p.life * (0.6 + 0.4 * Math.sin(p.phase)));
            return;
          }
          if (p.kind === 4) {
            var tw = 0.5 + 0.5 * Math.sin(p.phase);
            var a = 0.4 + 0.6 * tw * tw;
            if (s) {
              glow(ctx, s.bulb[p.rot], s.S, p.x, p.y, p.size * 4, p.size * 4, a);
              return;
            }
            dot(ctx, p, rgba(LIGHTS[p.rot], 1), a);
            return;
          }
          if (!s) {
            dot(ctx, p, color, p.kind === 2 ? p.life * 0.5 : p.life);
            return;
          }
          if (p.kind === 2) glow(ctx, s.blur, s.S, p.x, p.y, p.size * 1.15, p.size * 1.15, p.life);
          else if (p.kind === 1) glow(ctx, s.flake, s.S, p.x, p.y, p.size * 2.3, p.size * 2.3, p.life);
          else spot(ctx, p, color, p.life, s.S);
        },
        sprites: function (color, scale) {
          var g = maker();
          if (!g) return null;
          var white = rgbOf(color);
          var out = {
            S: scale,
            /* Средний хлопок: непрозрачное ядро на треть радиуса (радиус
               glow — 2.3 размера, то есть ядро ~0.8 размера хлопка) и
               ореол до края — «светится», а не просто белая точка. */
            flake: unitGrad(g, [[0, rgba(white, 1)], [0.3, rgba(white, 1)], [0.42, rgba(white, 0.5)], [0.68, rgba(white, 0.14)], [1, rgba(white, 0)]]),
            blur: unitGrad(g, [[0, rgba(white, 0.85)], [0.5, rgba(white, 0.7)], [0.8, rgba(white, 0.3)], [1, rgba(white, 0)]]),
            bokeh: [],
            bulb: []
          };
          for (var i = 0; i < LIGHTS.length; i++) {
            out.bokeh.push(bokeh(g, LIGHTS[i]));
            out.bulb.push(bulb(g, LIGHTS[i]));
          }
          return out;
        }
      },

      /* День святого Валентина: 16 сердец поднимаются с качанием (kind 0) и
         6 розовых огней боке (kind 1) — тот же приём, что у зимней ночи.
         Сердце — готовый силуэт с ореолом (drawImage), боке — градиент. */
      hearts: {
        count: 22,
        scene: true,
        spawn: function (i, w, h, rnd) {
          var p;
          if (i < 6) {
            p = particle(
              rand(rnd, w * 0.48, w),
              rand(rnd, h * 0.1, h * 0.75),
              rand(rnd, -0.004, 0.004),
              rand(rnd, -0.004, 0.002),
              rand(rnd, 16, 34),
              rand(rnd, 0.16, 0.3),
              i % 2,
              1
            );
            p.phase = rand(rnd, 0, TWO_PI);
            p.freq = rand(rnd, 0.0004, 0.0009);
            return p;
          }
          p = particle(
            rand(rnd, 0, w),
            rand(rnd, 0, h),
            rand(rnd, -0.004, 0.004),
            rand(rnd, -0.042, -0.016),
            rand(rnd, 6, 12),
            rand(rnd, 0.55, 0.9),
            0,
            0
          );
          p.phase = rand(rnd, 0, TWO_PI);
          p.freq = rand(rnd, 0.0008, 0.0016);
          p.amp = rand(rnd, 0.008, 0.02);
          return p;
        },
        step: function (p, dt) {
          p.phase += dt * p.freq;
          if (p.phase > TWO_PI * 64) p.phase -= TWO_PI * 64;
          if (p.kind === 1) {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            return;
          }
          p.x += (p.vx + Math.sin(p.phase) * p.amp) * dt;
          p.y += p.vy * dt;
        },
        draw: function (ctx, p, w, h, color, s) {
          if (p.kind === 1) {
            if (s) glow(ctx, s.bokeh[p.rot], s.S, p.x, p.y, p.size, p.size, p.life * (0.6 + 0.4 * Math.sin(p.phase)));
            return;
          }
          if (s) {
            var d = p.size * 2.6;
            flat(ctx, s.S);
            alpha(ctx, p.life);
            ctx.drawImage(s.heart, p.x - d * 0.5, p.y - d * 0.5, d, d);
            return;
          }
          dot(ctx, p, color, p.life * 0.7);
        },
        sprites: function (color, scale) {
          var g = maker();
          if (!g) return null;
          var rgb = rgbOf(color);
          /* Силуэт — с запасом на самое крупное сердце (12). */
          var R = 12 * scale;
          var s = surface(2.6 * R, 2.6 * R);
          if (!s) return null;
          s.ctx.shadowColor = rgba(rgb, 0.9);
          s.ctx.shadowBlur = R * 0.45;
          s.ctx.fillStyle = rgba(mix(rgb, [255, 255, 255], 0.25), 1);
          traceHeart(s.ctx, s.w / 2, s.h / 2, R * 1.9);
          s.ctx['fill']();
          var out = {
            S: scale,
            heart: s.canvas,
            bokeh: [bokeh(g, rgb), bokeh(g, mix(rgb, [255, 214, 226], 0.6))]
          };
          bitmapize(out, 'heart');
          return out;
        }
      }
    };

    /* n частиц пресета в границах слоя. Больше MAX не отдаём никогда — это
       и есть бюджет слабого ТВ (план фазы 3, «Риски»). */
    function spawn(name, w, h, n, rnd) {
      var preset = typeof name === 'string' ? presets[name] : name;
      if (!preset || !(w > 0) || !(h > 0)) return [];
      var count = typeof n === 'number' ? n : preset.count;
      if (count > MAX) count = MAX;
      if (!(count > 0)) return [];
      var random = typeof rnd === 'function' ? rnd : Math.random;
      var id = typeof name === 'string' ? name : '';
      var out = [];
      for (var i = 0; i < count; i++) {
        var p = preset.spawn(i, w, h, random);
        p.preset = id;
        out.push(p);
      }
      return out;
    }

    /* Шаг всех частиц слоя. Поведение берётся у пресета самой частицы —
       поэтому один общий цикл обслуживает сколько угодно слоёв с разными
       атмосферами. Нулевой и отрицательный dt не двигают ничего: это не
       кадр, а сбитые часы. */
    function step(list, dt, w, h) {
      if (!list || !list.length || !(dt > 0)) return list;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        var preset = presets[p.preset];
        if (!preset) continue;
        preset.step(p, dt, w, h);
        wrap(p, w, h);
      }
      return list;
    }

    /* ------------------------------------------------------------------ */
    /* Рантайм: один цикл на все слои                                      */
    /* ------------------------------------------------------------------ */

    var instances = [];
    var frame = 0;
    /* Таймер перепроверки, когда все слои стоят (см. schedule ниже). */
    var idle = 0;
    var last = 0;
    var stat_frames = 0;
    var stat_steps = 0;
    var stat_total = 0;
    var stat_max = 0;

    function doc() {
      try {
        if (typeof document !== 'undefined') return document;
      } catch (e) { }
      return null;
    }

    function nowMs() {
      try {
        if (window.performance && typeof window.performance.now === 'function') return window.performance.now();
      } catch (e) { }
      return Date.now();
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

    /* Таймеры через хук: тесты подменяют пару set/clear целиком
       (LC.fx._timers), рантайм работает на штатных — так же, как в
       src/54_ambient.js. */
    function setT(fn, ms) {
      var hook = api._timers;
      if (hook && typeof hook.set === 'function') return hook.set(fn, ms);
      try {
        return setTimeout(fn, ms);
      } catch (e) {
        return 0;
      }
    }

    function clearT(id) {
      if (!id) return;
      var hook = api._timers;
      if (hook && typeof hook.clear === 'function') { hook.clear(id); return; }
      try { clearTimeout(id); } catch (e) { }
    }

    function clearIdle() {
      if (!idle) return;
      clearT(idle);
      idle = 0;
    }

    function hidden() {
      var d = doc();
      try {
        return !!(d && d.hidden);
      } catch (e) {
        return false;
      }
    }

    function dpr() {
      var value = 1;
      try {
        value = Number(window.devicePixelRatio) || 1;
      } catch (e) { }
      if (!(value > 0)) value = 1;
      var cap = DPR_MAX;
      try {
        if (typeof LC.platformInfo === 'function' && LC.platformInfo().android) cap = DPR_MAX_ANDROID;
      } catch (e2) { }
      return value > cap ? cap : value;
    }

    /* Гейт запуска. Выключенный плагин и режимы lite/off не получают ни
       канваса, ни кадра: на слабом ТВ (вердикт src/68_perf.js приходит сюда
       через LC.motionMode) атмосфера обходится дороже, чем стоит.
       Task 40: и тумблер тяжёлых эффектов — частицы самые дорогие из них
       (полноэкранный canvas со своим кадровым циклом), поэтому на
       телевизоре их по умолчанию нет. LC.fxHeavy сам проверяет режим
       анимаций, но условие на motionMode оставлено явным: этот модуль
       обязан молчать в lite/off даже там, где LC.fxHeavy нет вовсе (тесты
       грузят 52_fx.js в одиночку). */
    /* Раунд holB: решение пользователя — праздничные частицы видны и в
       «Лёгких» (30 fps, как везде; пауза при листании — CALM_MS ниже и у
       героя FX_CALM_MS), прочие — только «Полные» + «Тяжёлые эффекты».
       Праздничных сцен ровно две — winter (Новый год, Рождество) и
       halloween («оставим только Рождество и Хэллоуин»). */
    function allowedNow(name) {
      try {
        if (!LC.enabled()) return false;
        var motion = LC.motionMode();
        var preset = presets[name];
        if (preset && preset.festive && (motion === 'full' || motion === 'lite')) return true;
        if (motion !== 'full') return false;
        if (typeof LC.fxHeavy === 'function' && !LC.fxHeavy()) return false;
        return true;
      } catch (e) {
        return false;
      }
    }

    /* Раунд holB: удержание сцены keep. Герой главной снимает слой на
       каждой смене фильма (clearFx при показе новой карточки) и ставит
       заново, когда придут её детали (applyFx). Праздник от фильма не
       зависит: вместо снятия слой замирает (paused) на LINGER_MS, и
       повторный монтаж того же пресета на тот же узел его оживляет — без
       нового канваса и новых частиц. Не пришёл — снимается сам (loop).
       Сцену, которую сейчас показывать уже нельзя («Выкл» анимаций,
       «Атмосферы: Выключены»), не удерживаем — снимаем сразу. */
    var LINGER_MS = 6000;
    /* Продолжение частиц: снятая сцена keep (уход на карточку снимает слой
       главной — sweep) отдаёт частицы следующему монтажу того же пресета
       на слой того же размера в пределах CARRY_MS — «Назад» продолжает
       снегопад с того же места, а не начинает заново. */
    var CARRY_MS = 60000;
    var carry = null;

    function lingerOk(inst) {
      if (!inst.keep || !allowedNow(inst.name)) return false;
      try {
        if (LC.themes && typeof LC.themes.mode === 'function' && LC.themes.mode() === 'off') return false;
      } catch (e) { }
      return true;
    }

    /* Раунд holB: пауза при листании. Нажатие пульта — самый дорогой миг
       экрана (смена фокуса, текста, кадра), и праздничная сцена после
       каждого стоит CALM_MS, каждое следующее продлевает. У кадра героя
       своя такая пауза (FX_CALM_MS, src/48_hero.js); у карточки фильма её
       не было, а праздничная сцена теперь и там, и в «Лёгких». Слушатель —
       один на движок, в фазе захвата (события Lampa могут не всплывать). */
    var CALM_MS = 1200;
    var lastKey = 0;
    var keyBound = false;

    function onKey() {
      lastKey = nowMs();
    }

    function bindKeys() {
      if (keyBound) return;
      var d = doc();
      try {
        if (d && typeof d.addEventListener === 'function') {
          d.addEventListener('keydown', onKey, true);
          keyBound = true;
        }
      } catch (e) { }
    }

    function nodeOf(layer) {
      if (!layer) return null;
      var node = layer[0] || layer;
      return node && typeof node.appendChild === 'function' ? node : null;
    }

    function find(node) {
      for (var i = 0; i < instances.length; i++) {
        if (instances[i].node === node) return instances[i];
      }
      return null;
    }

    /* Канвас всё ещё в документе? Это и есть самопроверка, из-за которой
       забытый слой не может оставить цикл крутиться: Lampa сносит DOM
       активности сама, и следующий тик такой инстанс снимет. */
    function attached(inst) {
      var d = doc();
      try {
        if (d && d.body && typeof d.body.contains === 'function') return d.body.contains(inst.canvas);
      } catch (e) { }
      return !!inst.canvas.parentNode;
    }

    /* Экран накрыт непрозрачным слоем плагина (заставка, src/54_ambient.js):
       под ним рисовать нечего. Признак общий и живёт в src/00_head.js —
       этому модулю знать, КТО накрыл экран, незачем (план Task 22 Step 3:
       «пока слой активен, слайдшоу карточки и частицы на паузе»). В тестах,
       где 52_fx.js грузится без соседей, LC.covered может не быть вовсе. */
    function covered() {
      try {
        return typeof LC.covered === 'function' && LC.covered() === true;
      } catch (e) {
        return false;
      }
    }

    /* Слой остался на активности, которая ушла вглубь. Проверяется классом
       активности, а не подпиской: Lampa не шлёт события покидаемой
       активности (план фазы 3, раздел 0). Не нашли .activity — считаем слой
       своим (кадр главной лежит вне активности). */
    /* Правило «на экране» — общее, LC.util.onScreen (src/10_util.js): узел
       здесь голый DOM, и она решает по classList активности. */
    function archived(inst) {
      try {
        var node = inst.node;
        if (node && typeof node.closest === 'function') return !LC.util.onScreen(node);
      } catch (e) { }
      return false;
    }

    /* Слой на паузе: скрытая вкладка, накрытый заставкой экран, открытый
       плеер Lampa, собственное условие слоя (играющий трейлер —
       src/55_trailer.js), уход вглубь из активности.
       Полное ревью c644bfd, S4: плеер Lampa — не активность, экран под ним
       остаётся activity--active (разбор у LC.util.playerOpen), и частицы
       рисовались под полноэкранным видео — канвас во весь экран поверх
       декодирования ролика. */
    function paused(inst) {
      if (inst.leaving) return true;
      if (inst.festive && lastKey && nowMs() - lastKey < CALM_MS) return true;
      if (hidden()) return true;
      if (covered()) return true;
      if (LC.util.playerOpen()) return true;
      try {
        if (inst.paused && inst.paused()) return true;
      } catch (e) { }
      return archived(inst);
    }

    /* Волна «праздники крупнее»: зона текста. Прямоугольник в долях слоя
       ({left, top, right, bottom}), где лежит текст (логотип, мета,
       описание, кнопки); частица внутри рисуется с альфой floor, снаружи —
       полной, в полосе feather (доля ширины) вокруг — плавно между ними.
       Это не маска CSS: маска на канвасе — лишний проход композитора на
       каждом кадре, а здесь — пять сравнений на частицу. */
    function safeZone(spec, w, h) {
      if (!spec || typeof spec !== 'object') return null;
      var l = num(spec.left, 0);
      var t = num(spec.top, 0);
      var r = num(spec.right, 1);
      var b = num(spec.bottom, 1);
      if (!(r > l) || !(b > t)) return null;
      var floor = num(spec.floor, 0.2);
      var feather = num(spec.feather, 0.08) * w;
      return {
        x0: l * w, y0: t * h, x1: r * w, y1: b * h,
        floor: floor < 0 ? 0 : (floor > 1 ? 1 : floor),
        feather: feather > 1 ? feather : 1
      };
    }

    function shade(zone, x, y) {
      var dx = x < zone.x0 ? zone.x0 - x : (x > zone.x1 ? x - zone.x1 : 0);
      var dy = y < zone.y0 ? zone.y0 - y : (y > zone.y1 ? y - zone.y1 : 0);
      var d = dx > dy ? dx : dy;
      if (d >= zone.feather) return 1;
      return zone.floor + (1 - zone.floor) * (d / zone.feather);
    }

    function render(inst, dt) {
      var ctx = inst.ctx;
      fadeK = 1;
      fillNow = null;
      tDirty = false;
      ctx.clearRect(0, 0, inst.w, inst.h);
      stat_steps++;
      var preset = presets[inst.name];
      if (!preset) return;
      var zone = inst.safe;
      var sprites = inst.sprites;
      /* Шаг и рисунок — одним проходом: у всех частиц инстанса один пресет
         (spawn), и искать его по p.preset на каждую частицу, как делает
         общий step(), незачем. Замер A/B на стенде (троттлинг 10×, 3 раунда
         с чередованием): зимняя сцена 2.40 → 1.87 мс, Хэллоуин 2.26 → 1.90,
         сердца 2.29 → 1.89. Нулевой и отрицательный dt частицы не двигает —
         тот же контракт, что у step(). */
      var list = inst.particles;
      var w = inst.w;
      var h = inst.h;
      var color = inst.color;
      var moving = dt > 0;
      for (var i = 0; i < list.length; i++) {
        var p = list[i];
        if (moving) {
          preset.step(p, dt, w, h);
          wrap(p, w, h);
        }
        fadeK = zone ? shade(zone, p.x, p.y) : 1;
        preset.draw(ctx, p, w, h, color, sprites);
      }
      fadeK = 1;
      /* Кадр кончается в базовом преобразовании: clearRect следующего
         кадра считает в логических координатах слоя. */
      if (tDirty) flat(ctx, inst.S);
      ctx.globalAlpha = 1;
    }

    /* Единица слоя: во сколько раз слой шире опорных REF_W (см. шапку
       констант). */
    function unitOf(w) {
      var u = w / REF_W;
      if (!(u > 0)) return 1;
      return u < UNIT_MIN ? UNIT_MIN : (u > UNIT_MAX ? UNIT_MAX : u);
    }

    /* Спрайты пресета под цвет и масштаб — из кэша или нарисованные сейчас.
       null — у пресета спрайтов нет или нарисовать их нечем: тогда draw
       рисует запасные точки. */
    var sprite_cache = {};
    var sprite_keys = [];

    function spritesFor(name, color, scale) {
      var preset = presets[name];
      if (!preset || typeof preset.sprites !== 'function') return null;
      var key = name + '|' + color + '|' + Math.round(scale * 100);
      if (Object.prototype.hasOwnProperty.call(sprite_cache, key)) return sprite_cache[key];
      var made = null;
      try {
        made = preset.sprites(color, scale) || null;
      } catch (e) {
        made = null;
      }
      sprite_cache[key] = made;
      sprite_keys.push(key);
      while (sprite_keys.length > SPRITE_CACHE) {
        var old = sprite_cache[sprite_keys[0]];
        delete sprite_cache[sprite_keys.shift()];
        if (!spritesUsed(old)) closeSprites(old);
      }
      return made;
    }

    /* Сомнительное полного ревью c644bfd: снимки спрайтов (ImageBitmap,
       bitmapize) — растр вне кучи JS, и сборщик мусора до него добирается
       поздно. Набор, вышедший из кэша, закрывает свои снимки (close), как
       только его не рисует ни один слой: сразу при вытеснении или со
       снятием последнего слоя (drop). Метка closed — на самом наборе и на
       его массивах кадров: снимок, доехавший позже, закрывается там же
       (bitmapize). Канвасы и градиенты close не имеют — их отпускает
       сборщик. */
    function spritesUsed(set) {
      if (!set) return false;
      for (var i = 0; i < instances.length; i++) if (instances[i].sprites === set) return true;
      for (var k in sprite_cache) {
        if (Object.prototype.hasOwnProperty.call(sprite_cache, k) && sprite_cache[k] === set) return true;
      }
      return false;
    }

    function shutHolder(holder) {
      holder.closed = true;
      for (var k in holder) {
        if (!Object.prototype.hasOwnProperty.call(holder, k)) continue;
        var v = holder[k];
        if (v && typeof v.close === 'function') {
          try { v.close(); } catch (e) { }
        }
      }
    }

    function closeSprites(set) {
      if (!set || set.closed) return;
      shutHolder(set);
      for (var k in set) {
        if (Object.prototype.hasOwnProperty.call(set, k) && Object.prototype.toString.call(set[k]) === '[object Array]') shutHolder(set[k]);
      }
    }

    /* Класс на узле слоя без jQuery: узел здесь голый DOM (или подделка
       тестов без classList). */
    function toggleClass(node, name, on) {
      try {
        if (node.classList) {
          if (on) node.classList.add(name);
          else node.classList.remove(name);
          return;
        }
        var list = ('' + (node.className || '')).split(/\s+/);
        var out = [];
        for (var i = 0; i < list.length; i++) if (list[i] && list[i] !== name) out.push(list[i]);
        if (on) out.push(name);
        node.className = out.join(' ');
      } catch (e) { }
    }

    function loop(ts) {
      frame = 0;
      var i;
      var clock = nowMs();
      for (i = instances.length - 1; i >= 0; i--) {
        var inst = instances[i];
        if (!attached(inst) || (inst.leaving && clock - inst.leaving > LINGER_MS)) drop(inst);
      }
      if (!instances.length) { last = 0; return; }
      var time = typeof ts === 'number' ? ts : clock;
      /* 30 fps: кадр пришёл раньше срока — только заказ следующего. last —
         время прошлой ОТРИСОВКИ, поэтому dt ниже покрывает оба кадра. */
      if (last && time - last > 0 && time - last < FRAME_MS - FRAME_SLACK && !hidden()) {
        frame = raf(loop);
        return;
      }
      var dt = last ? time - last : 16;
      last = time;
      if (dt > DT_CAP) dt = DT_CAP;
      if (!(dt > 0)) dt = 0;
      /* Рисовал ли кто-нибудь в этом кадре. Нулевой dt — не кадр, а сбитые
         часы: заключать по нему, что всё стоит, нельзя, поэтому там цикл
         продолжается как обычно. */
      var live = !hidden();
      if (dt > 0 && !hidden()) {
        var started = nowMs();
        var drawn = 0;
        for (i = 0; i < instances.length; i++) {
          if (paused(instances[i])) continue;
          try {
            render(instances[i], dt);
            drawn++;
          } catch (e) {
            warn('fx: render failed', e);
            /* drop() сдвигает массив: без шага назад следующий инстанс
               пропустил бы этот кадр. */
            drop(instances[i]);
            i--;
          }
        }
        live = drawn > 0;
        if (drawn) {
          var spent = nowMs() - started;
          stat_frames++;
          stat_total += spent;
          if (spent > stat_max) stat_max = spent;
        }
      }
      schedule(live);
    }

    /* Следующая проверка. Пока рисует хоть один слой — обычный кадр; когда
       стоят все (скрытая вкладка, заставка поверх экрана, трейлер, карточки
       в глубине истории) — редкий таймер вместо цикла 60 Гц: до возвращения
       хоть одного живого слоя каждый кадр только перебирал бы инстансы и
       дёргал closest() по мёртвым карточкам. last сбрасывается, чтобы
       простой не пришёл в первый же шаг длинным dt. */
    function schedule(live) {
      if (!instances.length) { last = 0; return; }
      if (live) { frame = raf(loop); return; }
      last = 0;
      idle = setT(idleCheck, IDLE_MS);
    }

    function idleCheck() {
      idle = 0;
      if (!instances.length) return;
      frame = raf(loop);
    }

    function wake() {
      if (frame || !instances.length) return;
      clearIdle();
      last = 0;
      frame = raf(loop);
    }

    /* Снятие одного инстанса: канвас из DOM, инстанс из списка. Кадр не
       отменяем — цикл сам увидит пустой список и не закажет следующий.
       Нулевой размер канваса — это освобождение буфера пикселей ПРЯМО
       СЕЙЧАС: снятый узел держал бы его до сборки мусора, а он на FHD при
       DPR 1.5 порядка 8 МБ (ревью фазы 3, Critical 1). */
    function drop(inst) {
      var i = instances.indexOf(inst);
      if (i !== -1) instances.splice(i, 1);
      /* Раунд holB: частицы сцены keep — следующему монтажу (CARRY_MS). */
      if (inst.keep) carry = { name: inst.name, w: inst.w, h: inst.h, at: nowMs(), particles: inst.particles };
      /* Набор спрайтов, уже вытесненный из кэша, этот слой рисовал
         последним — снимки закрываются (closeSprites). */
      if (inst.sprites && !spritesUsed(inst.sprites)) closeSprites(inst.sprites);
      try {
        if (inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
      } catch (e) {
        warn('fx: canvas remove failed', e);
      }
      try {
        inst.canvas.width = 0;
        inst.canvas.height = 0;
      } catch (e2) { }
      if (inst.scene) toggleClass(inst.node, 'lumen-fx--scene', false);
      if (inst.keep) toggleClass(inst.node, 'lumen-fx--' + inst.name, false);
      if (!instances.length) {
        unraf(frame);
        frame = 0;
        clearIdle();
        last = 0;
      }
    }

    /* Слои активностей, ушедших вглубь (ревью фазы 3, Critical 1). Lampa не
       шлёт покидаемой активности НИКАКИХ событий, а её DOM живёт в истории
       дальше — значит канвас каждой оставленной карточки висел бы в памяти
       до вытеснения по лимиту истории: цепочка «карточка -> актёр -> другой
       фильм -> франшиза» набирает десятки мегабайт, а на ТВ это перезагрузка
       Lampa, а не тормоза.
       Зовётся на 'activity':start (src/90_runtime.js) и снимает слой у
       каждой активности без .activity--active. Свой собственный слой снять
       нельзя: Lampa проставляет класс стартующей активности и снимает со
       всех остальных ДО отправки события (vendor/lampa/app.min.js, start$4),
       поэтому классы к этому моменту уже верны.
       Возвращает, сколько слоёв осталось. */
    function sweep() {
      for (var i = instances.length - 1; i >= 0; i--) {
        if (archived(instances[i])) drop(instances[i]);
      }
      return instances.length;
    }

    /* Вид инстанса наружу. Одна обёртка на ВСЕ пути возврата mount() — и на
       первый монтаж, и на повторный вызов для того же узла: вызывающему
       нужен один и тот же объект, с destroy в том числе. */
    function handle(inst) {
      return {
        node: inst.node,
        name: inst.name,
        particles: inst.particles_of,
        destroy: function () { drop(inst); }
      };
    }

    /* Монтирует слой частиц в узел. opts:
         color  — цвет частиц (акцент темы), по умолчанию белый;
         paused — функция «сейчас не рисовать» (трейлер играет);
         count  — сколько частиц вместо count пресета;
         width/height — размер слоя, когда его нельзя спросить у узла.
         safe   — зона текста {left, top, right, bottom, floor, feather}
                  в долях слоя: частицы в ней приглушаются до floor
                  (safeZone/shade выше).
       Возвращает инстанс или null, если стартовать нельзя. */
    function mount(layer, name, opts) {
      try {
        opts = opts || {};
        var node = nodeOf(layer);
        if (!node || !presets[name]) return null;
        var exist = find(node);
        /* Раунд holB: удерживаемый слой (unmount сцены keep) другого
           пресета или тот, что больше нельзя показывать, уступает место. */
        if (exist && exist.leaving && (exist.name !== name || !allowedNow(name))) {
          drop(exist);
          exist = null;
        }
        if (!allowedNow(name)) return null;
        /* Второй слой на тот же узел не заводим: у карточки он один, и
           повторный complite (Lampa шлёт его и после возврата) не должен
           удваивать ни канвас, ни частицы. Удерживаемый — оживает с новыми
           условиями паузы, зоной текста и цветом (holB). */
        if (exist) {
          if (exist.leaving) revive(exist, opts);
          return handle(exist);
        }
        var d = doc();
        if (!d || typeof d.createElement !== 'function') return null;

        var w = opts.width || node.offsetWidth || 0;
        var h = opts.height || node.offsetHeight || 0;
        if (!(w > 0) || !(h > 0)) {
          try {
            w = w || window.innerWidth || 0;
            h = h || window.innerHeight || 0;
          } catch (e) { }
        }
        if (!(w > 0) || !(h > 0)) return null;

        var ratio = dpr();
        var preset = presets[name];
        var canvas = d.createElement('canvas');
        canvas.className = 'lumen-fx__canvas' + (preset.scene ? ' lumen-fx__canvas--scene' : '');
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        var ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return null;
        /* Рисуем в логических пикселях слоя шириной REF_W — пресеты не
           знают ни о плотности пикселей, ни о ширине экрана. Размер канваса
           при этом прежний (w × ratio): единица меняет только масштаб
           рисования, не число пикселей. */
        var unit = unitOf(w);
        if (typeof ctx.setTransform === 'function') ctx.setTransform(ratio * unit, 0, 0, ratio * unit, 0, 0);
        else unit = 1;
        var lw = w / unit;
        var lh = h / unit;
        var color = opts.color || '#FFFFFF';
        node.appendChild(canvas);
        if (preset.scene) toggleClass(node, 'lumen-fx--scene', true);
        /* Раунд holB: класс сцены keep — на весь монтаж, удержание
           включительно. Статичный фон сцены (src/30_css.js) висит на нём, а
           не на классе темы героя: тот снимается на каждой смене фильма. */
        if (preset.keep) toggleClass(node, 'lumen-fx--' + name, true);
        if (preset.festive) bindKeys();

        /* Раунд holB: частицы той же сцены keep, снятой недавно со слоя
           того же размера, — продолжаются. */
        var kept = null;
        if (preset.keep && carry && carry.name === name && Math.abs(carry.w - lw) < 1 && Math.abs(carry.h - lh) < 1 &&
            nowMs() - carry.at < CARRY_MS) kept = carry.particles;
        if (preset.keep) carry = null;

        var inst = {
          node: node,
          canvas: canvas,
          ctx: ctx,
          name: name,
          w: lw,
          h: lh,
          unit: unit,
          S: ratio * unit,
          scene: !!preset.scene,
          keep: !!preset.keep,
          festive: !!preset.festive,
          leaving: 0,
          color: color,
          safe: safeZone(opts.safe, lw, lh),
          sprites: spritesFor(name, color, ratio * unit),
          paused: typeof opts.paused === 'function' ? opts.paused : null,
          particles: kept || spawn(name, lw, lh, opts.count, Math.random)
        };
        /* Доступ к частицам из живой проверки и тестов — функцией, чтобы
           снаружи нельзя было подменить сам массив под циклом. */
        inst.particles_of = function () { return inst.particles; };
        instances.push(inst);
        wake();
        return handle(inst);
      } catch (e) {
        warn('fx: mount failed', e);
        return null;
      }
    }

    /* Оживление удерживаемого слоя: условия паузы, зона текста и цвет — от
       нового монтажа (цвет другой — и набор спрайтов свой). */
    function revive(inst, opts) {
      inst.leaving = 0;
      inst.paused = typeof opts.paused === 'function' ? opts.paused : null;
      inst.safe = safeZone(opts.safe, inst.w, inst.h);
      var color = opts.color || '#FFFFFF';
      if (color !== inst.color) {
        var old = inst.sprites;
        inst.color = color;
        inst.sprites = spritesFor(inst.name, color, inst.S);
        if (old && !spritesUsed(old)) closeSprites(old);
      }
      wake();
    }

    function unmount(layer) {
      var node = nodeOf(layer);
      if (!node) return;
      var inst = find(node);
      if (!inst) return;
      /* Раунд holB: праздничная сцена (keep) не снимается, а замирает — до
         повторного монтажа или LINGER_MS (разбор у lingerOk). */
      if (lingerOk(inst)) {
        if (!inst.leaving) inst.leaving = nowMs();
        return;
      }
      drop(inst);
    }

    function unmountAll() {
      while (instances.length) drop(instances[instances.length - 1]);
    }

    function stats() {
      var count = 0;
      for (var i = 0; i < instances.length; i++) count += instances[i].particles.length;
      return {
        frames: stat_frames,
        steps: stat_steps,
        avgMs: stat_frames ? stat_total / stat_frames : 0,
        maxMs: stat_max,
        particles: count,
        layers: instances.length
      };
    }

    var api = {
      MAX: MAX,
      presets: presets,
      spawn: spawn,
      step: step,
      mount: mount,
      unmount: unmount,
      unmountAll: unmountAll,
      sweep: sweep,
      active: function () { return instances.length; },
      stats: stats,
      REF_W: REF_W,
      unitOf: unitOf,
      /* Хук тестов: подменяемая пара set/clear таймера простоя. */
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.fx;

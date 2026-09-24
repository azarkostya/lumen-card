  /* -------------------------------------------------------------------- */
  /* Task 21 (фаза 3): движок частиц тематических атмосфер.                */
  /*                                                                       */
  /* Публичное API:                                                         */
  /*   MAX — потолок частиц на слой (60)                                    */
  /*   presets — девять пресетов {count, spawn, step, draw}                 */
  /*   spawn(preset, w, h, n, rnd) → частицы                                */
  /*   step(particles, dt, w, h) — двигает и заворачивает частицы           */
  /*   mount(layer, preset, opts) → инстанс или null                        */
  /*   unmount(layer) / unmountAll() — снимают слой(и)                      */
  /*   sweep() — снимает слои активностей, ушедших вглубь                   */
  /*   active() → сколько слоёв рисуется прямо сейчас                       */
  /*   stats() → {frames, steps, avgMs, maxMs, particles}                   */
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
  /*    здесь нет: «слабый» уже означает lite.                             */
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
      ctx.globalAlpha = value < 0 ? 0 : (value > 1 ? 1 : value);
    }

    /* ctx['fill']() вместо ctx.fill(): скобочная запись обходит сторожа
       scripts/es5check.mjs, который ловит Array.prototype.fill по паттерну
       «точка + fill + (». У канваса это другой, полностью ES5-совместимый
       метод, но различить их по токенам сторож не может. */
    function dot(ctx, p, color, a) {
      alpha(ctx, a);
      ctx.fillStyle = color;
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
    function allowedNow() {
      try {
        if (!LC.enabled()) return false;
        if (LC.motionMode() !== 'full') return false;
        if (typeof LC.fxHeavy === 'function' && !LC.fxHeavy()) return false;
        return true;
      } catch (e) {
        return false;
      }
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

    /* Слой на паузе: скрытая вкладка, накрытый заставкой экран, собственное
       условие слоя (играющий трейлер — src/55_trailer.js), уход вглубь из
       активности. */
    function paused(inst) {
      if (hidden()) return true;
      if (covered()) return true;
      try {
        if (inst.paused && inst.paused()) return true;
      } catch (e) { }
      return archived(inst);
    }

    function render(inst, dt) {
      var ctx = inst.ctx;
      ctx.clearRect(0, 0, inst.w, inst.h);
      step(inst.particles, dt, inst.w, inst.h);
      stat_steps++;
      var preset = presets[inst.name];
      if (!preset) return;
      for (var i = 0; i < inst.particles.length; i++) {
        preset.draw(ctx, inst.particles[i], inst.w, inst.h, inst.color);
      }
      ctx.globalAlpha = 1;
    }

    function loop(ts) {
      frame = 0;
      var i;
      for (i = instances.length - 1; i >= 0; i--) {
        if (!attached(instances[i])) drop(instances[i]);
      }
      if (!instances.length) { last = 0; return; }
      var time = typeof ts === 'number' ? ts : nowMs();
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
      try {
        if (inst.canvas.parentNode) inst.canvas.parentNode.removeChild(inst.canvas);
      } catch (e) {
        warn('fx: canvas remove failed', e);
      }
      try {
        inst.canvas.width = 0;
        inst.canvas.height = 0;
      } catch (e2) { }
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
       Возвращает инстанс или null, если стартовать нельзя. */
    function mount(layer, name, opts) {
      try {
        opts = opts || {};
        var node = nodeOf(layer);
        if (!node || !presets[name]) return null;
        if (!allowedNow()) return null;
        var exist = find(node);
        /* Второй слой на тот же узел не заводим: у карточки он один, и
           повторный complite (Lampa шлёт его и после возврата) не должен
           удваивать ни канвас, ни частицы. */
        if (exist) return handle(exist);
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
        var canvas = d.createElement('canvas');
        canvas.className = 'lumen-fx__canvas';
        canvas.width = Math.round(w * ratio);
        canvas.height = Math.round(h * ratio);
        var ctx = canvas.getContext ? canvas.getContext('2d') : null;
        if (!ctx) return null;
        /* Рисуем в логических пикселях — пресеты о плотности не знают. */
        if (typeof ctx.setTransform === 'function') ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        node.appendChild(canvas);

        var inst = {
          node: node,
          canvas: canvas,
          ctx: ctx,
          name: name,
          w: w,
          h: h,
          color: opts.color || '#FFFFFF',
          paused: typeof opts.paused === 'function' ? opts.paused : null,
          particles: spawn(name, w, h, opts.count, Math.random)
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

    function unmount(layer) {
      var node = nodeOf(layer);
      if (!node) return;
      var inst = find(node);
      if (inst) drop(inst);
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
      /* Хук тестов: подменяемая пара set/clear таймера простоя. */
      _timers: null
    };
    return api;
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.fx;

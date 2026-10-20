  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экраны 39 (Торренты) и 40 (меню по удержанию OK).  */
  /* -------------------------------------------------------------------- */

  /* docs/design/v2-unify/SPEC.txt, разделы 39 и 40; макеты 39-L/39-A,
     39-L·F/39-A·F, 40-L/40-A (v2-unify.dc.html). Только CSS поверх штатных
     классов Lampa и разметки, которую уже готовят src/65_torrents.js
     (метка активности lumen-torrents, кадр lumen-tframe, части названия
     lumen-tt-a/b) и src/63_cardmenu.js (метка панели lumen-cardmenu и якорь
     --lc-anchor-x).

     Специфичность. Правила пути TorrServer (src/65_torrents.js) живут в
     своём <style>, который стоит ПОСЛЕ основного, — при равном весе они
     выигрывают порядком. Поэтому каждое правило здесь на класс тяжелее:
       экран раздач  — body.lumen-torrents-on .activity.lumen-torrents …
       файлы (Modal) — body.lumen-torrents-on .modal .torrent-files.torrent-files …
                       (класс дважды — лишний вес без лишней разметки)
       меню карточки — body.selectbox--open .selectbox.lumen-cardmenu …
     Без пути TorrServer (lumen_torrents выключен) экран раздач не трогаем
     вовсе: метки body.lumen-torrents-on нет.

     Единицы — em от базового кегля Lampa (22.811 px при 1920): px макета FHD
     ÷ 22.811. Цвета — палитра темы (ctx.P) и для Apple TV системные
     «secondary» (235,235,245 с прозрачностью), как в макете 39-A/40-A.
     Фокус по экрану 33: строка, чип, пункт — заливка (P.text в Lumen,
     белая в Apple TV), подпись — P.bg; кольца-псевдоэлемента и подложки
     glow у строк больше нет. */

  LC.v2css = LC.v2css || [];

  LC.v2css.push({
    id: 'torrents-menu',
    order: 39,
    build: function (ctx) {
      var P = ctx.P;
      var A = ctx.APPLE;
      var k = LC.tokens ? LC.tokens() : {};
      var FILL = A ? ctx.V2.fillA : P.text;
      /* Вторичный текст: Lumen — P.soft/P.muted (≥ 4.5:1 на фоне и на
         подложке строки), Apple TV — secondary .8 / .64 (6.6:1 на чёрном). */
      var SOFT = A ? 'rgba(235,235,245,.8)' : P.soft;
      var MUTED = A ? 'rgba(235,235,245,.64)' : P.muted;
      /* Подпись на заливке фокуса: основная — P.bg, вторичная — тот же фон
         с прозрачностью .72 (макет: rgba(23,18,14,.72) / rgba(0,0,0,.7)). */
      var ON = P.bg;
      var ON_SUB = A ? ctx.V2.sub : 'rgba(' + P.bgRgb + ',.72)';
      var ROW_BG = A ? 'transparent' : P.panelHi;
      var LINE = A ? 'rgba(255,255,255,.14)' : P.line;
      var CHIP = A ? 'rgba(255,255,255,.16)' : 'rgba(' + P.textRgb + ',.12)';
      var r = [];

      /* ================= 39 · Торренты ================= */
      var S = 'body.lumen-torrents-on .activity.lumen-torrents ';
      function s(list) {
        var out = [];
        for (var i = 0; i < list.length; i++) out.push(S + list[i]);
        return out.join(',');
      }

      /* Фон темы вместо сине-серого градиента Lampa (.background под
         активностью): у экрана свой фон и кадр-вуаль сверху. */
      r.push('body.lumen-torrents-on .activity.lumen-torrents{background-color:' + P.bg + '}');
      r.push(s(['.lumen-tframe']) + '{position:absolute;top:0;left:0;right:0;height:16.66em;overflow:hidden;pointer-events:none;z-index:0}');
      r.push(s(['.lumen-tframe__img']) + '{position:absolute;top:0;left:0;right:0;bottom:0;background-position:50% 30%;background-repeat:no-repeat;-webkit-background-size:cover;background-size:cover;opacity:.55}');
      r.push(s(['.lumen-tframe::after']) + '{content:"";position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(90deg,rgba(' + P.bgRgb + ',.94) 0%,rgba(' + P.bgRgb + ',.6) 45%,rgba(' + P.bgRgb + ',.3) 100%),linear-gradient(0deg,' + P.bg + ' 0%,rgba(' + P.bgRgb + ',0) 55%)}');
      r.push(s(['.explorer']) + '{position:relative;z-index:1;-webkit-box-orient:vertical;-webkit-flex-direction:column;flex-direction:column}');

      /* Компактная шапка фильма: постер и описание скрыты, левая колонка
         становится строкой над фильтрами — название, мета, «16+». Узлы
         Lampa разложены по двум контейнерам (head-body и body), поэтому
         оба — display:contents, а порядок задаёт order. */
      r.push(s(['.explorer__left']) + '{width:auto;-webkit-flex-shrink:0;flex-shrink:0}');
      r.push(s(['.explorer__left .scroll', '.explorer__left .scroll__content', '.explorer__left .scroll__body']) + '{height:auto !important;overflow:visible;-webkit-transform:none !important;transform:none !important}');
      r.push(s(['.explorer__card']) + '{padding:.7em 3.507em 0 3.507em}');
      r.push(s(['.explorer-card']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap;-webkit-box-align:center;-webkit-align-items:center;align-items:center;line-height:1.3}');
      r.push(s(['.explorer-card__head', '.explorer-card__head-body', '.explorer-card__body']) + '{display:contents}');
      r.push(s(['.explorer-card__head-left', '.explorer-card__descr']) + '{display:none !important}');
      r.push(s(['.explorer-card__title']) + '{-webkit-box-ordinal-group:1;-webkit-order:0;order:0;width:100%;margin:0 0 .25em;font-family:' + (k.fontBody || 'inherit') + ';font-size:2.455em;font-weight:700;line-height:1.1;color:' + P.text + (A ? ';letter-spacing:-.02em' : '') + '}');
      r.push(s(['.explorer-card__title.small']) + '{font-size:1.9em}');
      var meta = ['.explorer-card__head-create', '.explorer-card__genres', '.explorer-card__head-rate'];
      r.push(s(meta) + '{margin:0;padding:0;font-family:' + (k.fontBody || 'inherit') + ';font-size:1.14em;font-weight:500;line-height:1.3;color:' + SOFT + ';letter-spacing:0}');
      r.push(s(['.explorer-card__genres:empty']) + '{display:none}');
      r.push(s(['.explorer-card__head-rate > span']) + '{font-size:1em;font-weight:500;color:inherit}');
      r.push(s(['.explorer-card__head-rate > svg']) + '{display:none !important}');
      /* Звезда рейтинга — символ, а не маска: одним цветом с метой. */
      r.push(s(['.explorer-card__head-rate:before']) + '{content:"\\2605";display:inline;width:auto;height:auto;margin:0 .3em 0 0;background:none !important;-webkit-mask-image:none !important;mask-image:none !important}');
      /* Плашка «16+» — после меты, с отступом .5em, а не поверх рейтинга. */
      r.push(s(['.explorer-card__head-age']) + '{margin:0 0 0 .5em;padding:0 .4em;border:.066em solid ' + MUTED + ';border-radius:.3em;font-size:.877em;font-weight:600;line-height:1.4;color:' + SOFT + '}');
      if (A) {
        /* Apple TV (39-A): «Драма · Триллер · 2022 · 1 сезон  16+  ★ 7.9». */
        r.push(s(['.explorer-card__genres']) + '{-webkit-order:1;order:1}');
        r.push(s(['.explorer-card__head-create']) + '{-webkit-order:2;order:2}');
        r.push(s(['.explorer-card__head-create:before']) + '{content:"\\00B7";margin:0 .45em}');
        r.push(s(['.explorer-card__head-age']) + '{-webkit-order:3;order:3;margin:0 .45em 0 .55em}');
        r.push(s(['.explorer-card__head-rate']) + '{-webkit-order:4;order:4;margin-left:.2em}');
      } else {
        /* Lumen (39-L): «2022 · Великобритания · Драма, Триллер · ★ 7.9  16+». */
        r.push(s(['.explorer-card__head-create']) + '{-webkit-order:1;order:1}');
        r.push(s(['.explorer-card__genres']) + '{-webkit-order:2;order:2}');
        r.push(s(['.explorer-card__genres:before']) + '{content:"\\00B7";margin:0 .45em}');
        r.push(s(['.explorer-card__head-rate']) + '{-webkit-order:3;order:3}');
        r.push(s(['.explorer-card__head-rate:before']) + '{content:"\\00B7\\00a0\\00a0\\2605";margin-left:.45em}');
        r.push(s(['.explorer-card__head-age']) + '{-webkit-order:4;order:4}');
      }

      /* Фильтры — чипы: 52 px, капсула, подложка, подпись тише значения. */
      r.push(s(['.explorer__files']) + '{width:auto;min-width:0;-webkit-box-flex:1;-webkit-flex:1 1 0%;flex:1 1 0%}');
      r.push(s(['.explorer__files-head']) + '{padding:.9em 3.507em .2em 3.507em}');
      var chips = ['.torrent-filter .simple-button', '.empty__footer .simple-button', '.empty-filter__buttons .simple-button'];
      var chipsFocus = [];
      for (var c = 0; c < chips.length; c++) chipsFocus.push(chips[c] + '.focus');
      r.push(s(chips) + '{height:2.28em;padding:0 1.052em;margin-right:.614em;border:0;border-radius:1.14em;background-color:' + CHIP + ';color:' + P.text + ';font-size:1.008em;font-weight:500;-webkit-box-shadow:none;box-shadow:none;-webkit-transform:none !important;transform:none !important}');
      r.push(s(['.torrent-filter .filter--search > div', '.torrent-filter .filter--sort > div']) + '{color:' + MUTED + ';border-left:0;font-weight:500}');
      r.push(s(chipsFocus) + '{background-color:' + FILL + ';color:' + ON + ';-webkit-box-shadow:none;box-shadow:none}');
      r.push(s(['.torrent-filter .filter--search.focus > div', '.torrent-filter .filter--sort.focus > div']) + '{color:' + ON_SUB + '}');
      r.push(s(['.torrent-filter__title']) + '{display:none}');

      /* Раздачи — строки. Lumen: мягкая подложка r14; Apple TV: без
         подложки, строки разделены линией. Колонки справа фиксированные,
         цифры табличные: размер · ↑ сиды · ↓ пиры · дата. */
      r.push(s(['.torrent-list']) + '{padding:.35em 3.507em 1.4em 3.507em}');
      var row = '.torrent-list .torrent-item';
      r.push(s([row]) + '{display:-ms-grid;display:grid;grid-template-columns:minmax(0,1fr) auto auto auto auto;grid-template-rows:auto auto auto;-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:' + (A ? '5.173em' : '4.822em') + ';-webkit-box-sizing:border-box;box-sizing:border-box;margin:0;padding:.75em ' + (A ? '1.052em' : '1.227em') + ';border:0;border-radius:' + (A ? '0' : '.614em') + ';background-color:' + ROW_BG + ';color:' + P.text + ';-webkit-box-shadow:none;box-shadow:none;font-variant-numeric:tabular-nums}');
      if (A) {
        r.push(s([row]) + '{border-bottom:.044em solid ' + LINE + '}');
        r.push(s([row + '.focus']) + '{border-radius:.614em;border-bottom-color:transparent}');
      } else {
        r.push(s([row + ' + .torrent-item']) + '{margin-top:.526em}');
      }
      r.push(s([row + '.focus']) + '{background-color:' + FILL + ';color:' + ON + ';border-color:transparent;padding:.75em ' + (A ? '1.052em' : '1.227em') + ';-webkit-box-shadow:none;box-shadow:none}');
      r.push(s([row + '.focus::after']) + '{display:none}');
      r.push(s([row + ' .torrent-item__title']) + '{grid-column:1;grid-row:1;-ms-grid-column:1;-ms-grid-row:1;padding:0 1.052em 0 0;font-size:1.008em;font-weight:500;line-height:1.35;color:' + P.text + ';display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}');
      r.push(s([row + ' .lumen-tt-a']) + '{color:' + SOFT + '}');
      r.push(s([row + ' .lumen-tt-b']) + '{font-weight:700;color:' + P.text + '}');
      r.push(s([row + '.focus .torrent-item__title', row + '.focus .lumen-tt-b']) + '{color:' + ON + '}');
      r.push(s([row + '.focus .lumen-tt-a']) + '{color:' + ON_SUB + '}');
      r.push(s([row + ' .torrent-item__ffprobe']) + '{grid-column:1;grid-row:2;-ms-grid-column:1;-ms-grid-row:2;padding:.3em 1.052em 0 0;min-width:0}');
      r.push(s([row + ' .torrent-item__ffprobe > div']) + '{margin:.2em .3em 0 0;font-size:.877em;color:' + SOFT + ';border-color:' + LINE + '}');
      r.push(s([row + '.focus .torrent-item__ffprobe > div']) + '{color:' + ON_SUB + ';border-color:' + ON_SUB + '}');
      /* Значки медиачипов Lampa — белые картинки: на светлой заливке фокуса
         их не видно, инвертируем. */
      r.push(s([row + '.focus .torrent-item__ffprobe > div::before']) + '{-webkit-filter:invert(1);filter:invert(1)}');
      /* Всё, что живёт в левой колонке, переносится внутри неё и в правые
         колонки не заходит: медиачипы — flex с переносом, трекер — обычный
         перенос строк (первая сборка ставила трекер отдельной колонкой —
         он наезжал на название и чипы, а размер уходил за край экрана). */
      r.push(s([row + ' .torrent-item__ffprobe']) + '{display:-webkit-box;display:-webkit-flex;display:flex;-webkit-flex-wrap:wrap;flex-wrap:wrap}');
      r.push(s([row + ' .torrent-item__ffprobe.hide']) + '{display:none}');
      r.push(s([row + ' .torrent-item__details']) + '{display:contents}');
      var cell = '{margin:0;padding:0 0 0 1.052em;font-size:1.008em;font-weight:500;line-height:1.3;color:' + MUTED + ';text-align:right;white-space:nowrap;grid-row:1 / 3;-ms-grid-row:1;-ms-grid-row-span:2;-webkit-align-self:center;align-self:center}';
      var cells = [];
      var names = ['date', 'tracker', 'bitrate', 'seeds', 'grabs', 'size'];
      for (var n = 0; n < names.length; n++) cells.push(row + ' .torrent-item__' + names[n]);
      r.push(s(cells) + cell);
      var befores = [];
      for (var b = 0; b < cells.length; b++) befores.push(cells[b] + ':before');
      r.push(s(befores) + '{content:none !important;display:none}');
      r.push(s([row + ' .torrent-item__size']) + '{grid-column:2;-ms-grid-column:2;min-width:4.6em;position:static;top:auto;right:auto;padding:0 0 0 1.052em;border-radius:0;background:none;font-size:1.096em;font-weight:600;color:' + P.text + '}');
      r.push(s([row + ' .torrent-item__seeds']) + '{grid-column:3;-ms-grid-column:3;color:' + P.text + '}');
      r.push(s([row + ' .torrent-item__seeds:before']) + '{content:"\\2191\\00a0" !important;display:inline !important;margin:0}');
      r.push(s([row + ' .torrent-item__grabs']) + '{grid-column:4;-ms-grid-column:4;padding-left:.45em}');
      r.push(s([row + ' .torrent-item__grabs:before']) + '{content:"\\00B7\\00a0\\00a0\\2193\\00a0" !important;display:inline !important;margin:0}');
      r.push(s([row + ' .torrent-item__date']) + '{grid-column:5;-ms-grid-column:5;min-width:6.4em;text-transform:lowercase}');
      /* Трекер и битрейт — нижней строкой, тихо: трекер под названием,
         битрейт под колонками чисел. */
      r.push(s([row + ' .torrent-item__tracker', row + ' .torrent-item__bitrate']) + '{grid-row:3;-ms-grid-row:3;-ms-grid-row-span:1;padding-top:.3em;font-size:.877em;-webkit-align-self:start;align-self:start}');
      r.push(s([row + ' .torrent-item__tracker']) + '{grid-column:1;-ms-grid-column:1;padding-left:0;padding-right:1.052em;text-align:left;white-space:normal}');
      r.push(s([row + ' .torrent-item__bitrate']) + '{grid-column:2 / 6;-ms-grid-column:2;-ms-grid-column-span:4}');
      var focusCells = [];
      for (var fc = 0; fc < names.length; fc++) focusCells.push(row + '.focus .torrent-item__' + names[fc]);
      r.push(s(focusCells) + '{color:' + ON_SUB + '}');
      r.push(s([row + '.focus .torrent-item__size', row + '.focus .torrent-item__seeds']) + '{color:' + ON + ';top:auto;right:auto}');
      /* «Просмотрено» — точка-галочка в начале строки, не на углу. */
      r.push(s([row + ' .torrent-item__viewed']) + '{top:.45em;left:.45em;width:1.1em;height:1.1em}');
      r.push(s([row + ' .torrent-item__viewed:before']) + '{width:.7em;height:.7em}');
      /* «Продолжить» / «Нет истории просмотра» — та же форма строки. */
      r.push(s(['.watched-history']) + '{margin:0 0 .526em;padding:.6em 1.227em;border:0;border-radius:.614em;background-color:' + (A ? CHIP : P.panelHi) + ';color:' + SOFT + ';-webkit-box-shadow:none;box-shadow:none}');
      r.push(s(['.watched-history.focus']) + '{background-color:' + FILL + ';color:' + ON + ';padding:.6em 1.227em;border:0;-webkit-box-shadow:none;box-shadow:none}');
      r.push(s(['.watched-history.focus::after']) + '{display:none}');
      r.push(s(['.watched-history.focus .watched-history__icon']) + '{border-color:' + ON + ';color:' + ON + ';background:none}');

      /* Файлы сезона (Modal поверх «Торрентов», 39-L·F/39-A·F): строка —
         номер серии, название файла с полосой просмотра, дата, размер.
         Превью кадра серии снято — строка как у раздач. */
      var F = 'body.lumen-torrents-on .modal .torrent-files.torrent-files ';
      function f(list) {
        var out = [];
        for (var i = 0; i < list.length; i++) out.push(F + list[i]);
        return out.join(',');
      }
      r.push(f(['.torrent-serial', '.torrent-file']) + '{margin:0;border:0;border-radius:' + (A ? '0' : '.614em') + ';background-color:' + ROW_BG + ';-webkit-box-shadow:none;box-shadow:none}');
      if (A) r.push(f(['.torrent-serial', '.torrent-file']) + '{border-bottom:.044em solid ' + LINE + '}');
      else r.push(f(['.torrent-serial + .torrent-serial', '.torrent-file + .torrent-file', '.torrent-serial + .torrent-file', '.torrent-file + .torrent-serial']) + '{margin-top:.526em}');
      r.push(f(['.torrent-serial.focus', '.torrent-file.focus']) + '{border-radius:.614em;border-color:transparent;background-color:' + FILL + ';color:' + ON + ';-webkit-box-shadow:none;box-shadow:none}');
      r.push(f(['.torrent-serial.focus::after', '.torrent-file.focus::after']) + '{display:none}');
      r.push(f(['.torrent-serial', '.torrent-serial.focus']) + '{-webkit-box-align:center;-webkit-align-items:center;align-items:center;min-height:4.56em;padding:.6em ' + (A ? '1.052em' : '1.227em') + '}');
      r.push(f(['.torrent-serial__img']) + '{display:none}');
      r.push(f(['.torrent-serial__episode']) + '{position:static;-webkit-box-ordinal-group:0;-webkit-order:-1;order:-1;-webkit-flex-shrink:0;flex-shrink:0;min-width:2.6em;margin:0 1.052em 0 0;padding:0;background:none;border-radius:0;font-size:1.096em;font-weight:600;color:inherit}');
      r.push(f(['.torrent-serial.focus .torrent-serial__episode']) + '{top:auto;left:auto}');
      r.push(f(['.torrent-serial__content']) + '{padding:0}');
      r.push(f(['.torrent-serial__title', '.torrent-file__title']) + '{font-size:1.008em;font-weight:500;color:' + SOFT + '}');
      r.push(f(['.torrent-serial__line', '.torrent-serial__exe', '.torrent-serial__size', '.torrent-file__size', '.torrent-file__title .exe']) + '{color:' + MUTED + ';background:none;border:0;font-size:1.008em}');
      r.push(f(['.torrent-serial.focus .torrent-serial__title', '.torrent-file.focus .torrent-file__title']) + '{color:' + ON + '}');
      r.push(f(['.torrent-serial.focus .torrent-serial__line', '.torrent-serial.focus .torrent-serial__exe', '.torrent-serial.focus .torrent-serial__size', '.torrent-file.focus .torrent-file__size', '.torrent-file.focus .torrent-file__title .exe']) + '{color:' + ON_SUB + '}');
      /* Прогресс просмотра: 12 px акцентом (L) · 10 px белым (A) на 4K. */
      var prog = A ? '.22em' : '.263em';
      var progFill = A ? '#FFFFFF' : (k.accent || P.text);
      r.push(f(['.torrent-serial .time-line', '.torrent-file .time-line']) + '{height:' + prog + ';border-radius:' + prog + ';background-color:' + (A ? 'rgba(255,255,255,.2)' : 'rgba(' + P.textRgb + ',.14)') + '}');
      r.push(f(['.torrent-serial .time-line > div', '.torrent-file .time-line > div']) + '{border-radius:' + prog + ';background-color:' + progFill + '}');
      r.push(f(['.torrent-serial.focus .time-line', '.torrent-file.focus .time-line']) + '{background-color:rgba(' + P.bgRgb + ',.18)}');
      r.push(f(['.torrent-serial.focus .time-line > div', '.torrent-file.focus .time-line > div']) + '{background-color:' + ON + '}');

      /* ================= 40 · Меню карточки (hold OK) ================= */
      /* Плавающая панель рядом с постером: ширина 600, поле 60, скругление
         18 px FHD (1200 / 120 / 36 на 4K); без размытия. Растёт вверх от
         нижнего поля и не заходит под шапку (верхнее поле 120 px FHD); при
         переполнении — прокрутка внутри, конец списка растворяется. */
      var M = 'body.selectbox--open .selectbox.lumen-cardmenu ';
      function m(list) {
        var out = [];
        for (var i = 0; i < list.length; i++) out.push(M + list[i]);
        return out.join(',');
      }
      var PLATTER = A ? 'rgba(28,28,30,.92)' : (P.panelHi === '#221A13' ? '#231C16' : P.panelHi);
      r.push(m(['.selectbox__layer']) + '{background:none;-webkit-backdrop-filter:none;backdrop-filter:none}');
      r.push(m(['.selectbox__content']) + '{top:auto !important;bottom:3.125vw;left:auto;right:3.125vw;width:31.25vw;height:auto !important;max-height:-webkit-calc(100vh - 9.375vw);max-height:calc(100vh - 9.375vw);padding:.877em .7em;-webkit-box-sizing:border-box;box-sizing:border-box;border:0;border-radius:.79em;background:' + PLATTER + ';-webkit-box-shadow:0 1.052em 2.104em rgba(0,0,0,.55);box-shadow:0 1.052em 2.104em rgba(0,0,0,.55);-webkit-backdrop-filter:none;backdrop-filter:none;-webkit-transform:none !important;transform:none !important;-webkit-transition:none;transition:none}');
      r.push('body.selectbox--open .selectbox.lumen-cardmenu.lumen-cardmenu--anchored .selectbox__content{left:var(--lc-anchor-x);right:auto}');
      r.push(m(['.selectbox__head']) + '{display:none}');
      r.push(m(['.selectbox__body']) + '{min-height:0;-webkit-box-flex:1;-webkit-flex:1 1 auto;flex:1 1 auto;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 .5em,#000 -webkit-calc(100% - 1em),transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 .5em,#000 calc(100% - 1em),transparent 100%)}');
      r.push(m(['.selectbox__body .scroll__body']) + '{padding-bottom:1.4em}');
      /* Своя маска прокрутки Lampa (scroll--mask: поле 28 px и растворение
         сверху) гасила «Избранное» на краю. Растворение — одно, у тела
         панели выше: сверху .5em, снизу 1em. */
      r.push(m(['.selectbox__body .scroll--mask']) + '{-webkit-mask-image:none;mask-image:none}');
      r.push(m(['.selectbox__body .scroll__content']) + '{padding-top:.5em}');
      /* Заголовки секций — обычным регистром: «Избранное», «Ещё». */
      r.push(m(['.settings-param-title']) + '{margin:.25em 0 0;padding:.26em .7em;border:0;background:none;font-size:1.008em;font-weight:600;line-height:1.3;letter-spacing:0;text-transform:none;color:' + MUTED + '}');
      r.push(m(['.settings-param-title > span']) + '{color:' + MUTED + ';text-transform:none;letter-spacing:0}');
      r.push(m(['.selectbox-item + .settings-param-title']) + '{margin-top:.35em;padding-top:.6em;border-top:.044em solid ' + (A ? 'rgba(255,255,255,.12)' : 'rgba(' + P.textRgb + ',.12)') + '}');
      /* Пункт: 56 px, r12, заливка в фокусе без масштаба. */
      r.push(m(['.selectbox-item']) + '{margin:0 0 .175em;padding:.55em .7em;min-height:2.455em;-webkit-box-sizing:border-box;box-sizing:border-box;border-radius:.526em;background:none;color:' + P.text + ';-webkit-transform:none !important;transform:none !important;-webkit-transition:none;transition:none}');
      r.push(m(['.selectbox-item__title']) + '{font-size:1.096em;font-weight:500;line-height:1.25}');
      r.push(m(['.selectbox-item__subtitle']) + '{color:' + MUTED + '}');
      /* Тема CUB «Neon»: .selectbox-item.focus{background:transparent
         !important;color:#fff !important} и ::before с кольцом и вуалью —
         заливка и цвета в фокусе с !important (селектор у нас тяжелее),
         ::before пункта снят (Lampa его пунктам Select не рисует). */
      r.push(m(['.selectbox-item.focus']) + '{background:' + FILL + ' !important;color:' + ON + ' !important}');
      r.push(m(['.selectbox-item.focus::before']) + '{content:none !important;display:none !important}');
      r.push(m(['.selectbox-item.focus .selectbox-item__subtitle']) + '{color:' + ON_SUB + ' !important;opacity:1}');
      /* Чекбокс слева, рамка видна: 28 px, 2.5 px P.muted (5.8:1) в Lumen,
         круг secondary .6 в Apple TV; отмеченный — заливка с галочкой. */
      var CHECK_ON = A ? '#FFFFFF' : (k.accent || P.text);
      r.push(m(['.selectbox-item--checkbox']) + '{padding-left:2.85em;padding-right:2.4em}');
      r.push(m(['.selectbox-item__checkbox']) + '{top:50%;left:.7em;right:auto;width:1.227em;height:1.227em;margin-top:-.614em;border:.11em solid ' + (A ? 'rgba(235,235,245,.6)' : P.muted) + ';border-radius:' + (A ? '50%' : '.307em') + ';background:none;-webkit-box-sizing:border-box;box-sizing:border-box;-webkit-filter:none;filter:none}');
      r.push(m(['.selectbox-item--checked .selectbox-item__checkbox']) + '{border-color:' + CHECK_ON + ';background-color:' + CHECK_ON + '}');
      r.push(m(['.selectbox-item--checked .selectbox-item__checkbox::after']) + '{color:' + (A ? '#000000' : (k.onac || P.bg)) + '}');
      r.push(m(['.selectbox-item.focus .selectbox-item__checkbox']) + '{border-color:' + ON + ' !important}');
      r.push(m(['.selectbox-item--checked.focus .selectbox-item__checkbox']) + '{background-color:' + ON + ' !important}');
      r.push(m(['.selectbox-item--checked.focus .selectbox-item__checkbox::after']) + '{color:' + FILL + ' !important}');
      /* Отметка выбранного пункта (галочка Lampa или маска пути TorrServer,
         src/65_torrents.js — акцентом): в Apple TV белая. !important —
         правила пути стоят в своём <style> после основного. */
      if (A) r.push(m(['.selectbox-item.selected:not(.nomark)::after', '.selectbox-item.picked::after']) + '{color:#FFFFFF !important;border-color:#FFFFFF !important}');
      /* Замок — мелкий (20 px FHD), тихим цветом, у правого края. */
      r.push(m(['.selectbox-item__lock']) + '{right:.7em;margin-top:-.44em;opacity:1;color:' + MUTED + '}');
      r.push(m(['.selectbox-item__lock > svg']) + '{width:.877em !important;height:.877em !important}');
      r.push(m(['.selectbox-item.focus .selectbox-item__lock']) + '{color:' + ON_SUB + ' !important}');

      /* ================= Apple TV: путь TorrServer без акцента ================= */
      /* Правила src/65_torrents.js красят спиннер, предзагрузку, отметки и
         полосы акцентом со свечением — в Apple TV там нейтральные белый и
         серый без ореола. Их <style> стоит ПОСЛЕ основного, поэтому здесь
         селектор на элемент тяжелее (html …). */
      if (A) {
        var H = 'html body.lumen-torrents-on ';
        var HA = H + '.lumen-torrents ';
        var NO_MASK = LC.icons && LC.icons.NO_MASK;
        var MODAL = (LC.menus && LC.menus.MARK_MODAL) || 'lumen-modal';
        /* Круг ошибки в Modal — системный красный вместо «спайса». */
        r.push('html body.lumen-menus-all .modal .error__ico,html .modal.' + MODAL + ' .error__ico{background:#FF453A}');
        /* Загрузка Modal: без радиального свечения, значок — белый. */
        r.push(H + '.modal-loading:before{background:none}');
        r.push(H + '.modal-loading:after{background-color:#FFFFFF}');
        if (NO_MASK) r.push(NO_MASK + '{' + H + '.modal-loading:after{background-color:transparent;border-color:#FFFFFF}}');
        /* Предзагрузка: яркая копия названия/логотипа — белая, без свечения;
           значок пиров — тихим цветом, как подпись пилюли. */
        r.push(H + '.media-loading__mark-fill .media-loading__title{color:#FFFFFF;text-shadow:none}');
        r.push(H + '.media-loading__mark-fill .media-loading__logo{-webkit-filter:none;filter:none}');
        r.push(H + '.media-loading__peers:before{background-color:' + MUTED + '}');
        if (NO_MASK) r.push(NO_MASK + '{' + H + '.media-loading__peers-icon{color:' + MUTED + '}}');
        /* «Просмотрено» — белый круг с чёрной галочкой; «Продолжить» —
           значок тихим цветом; точка «применён фильтр» — белая. */
        r.push(H + '.torrent-item__viewed{background-color:#FFFFFF;color:#000000}');
        r.push(HA + '.watched-history__icon{border-color:' + MUTED + ';background-color:transparent;color:' + MUTED + '}');
        r.push(HA + '.torrent-filter .filter--filter > div:not(.hide){background-color:#FFFFFF}');
        /* Файлы: папка в фокусе, полоска автостарта, прогресс проверки,
           кнопка «Далее» — белым, без подложки glow. */
        r.push(H + '.torrnet-folder-name.focus{color:#FFFFFF}');
        r.push(H + '.torrent-serial__progress{background-color:#FFFFFF;-webkit-box-shadow:none;box-shadow:none}');
        r.push(H + '.torrent-checklist__progress-bar > div{background-color:#FFFFFF}');
        r.push(H + '.torrent-checklist__footer .simple-button.focus{-webkit-box-shadow:none;box-shadow:none}');
      }

      return r.join('\n');
    }
  });

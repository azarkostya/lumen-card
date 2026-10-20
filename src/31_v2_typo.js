  /* -------------------------------------------------------------------- */
  /* v2 «Единый стиль», экраны 43, 44, 46: типографика и доводка главной.  */
  /*                                                                       */
  /* LC.typo — чистые текстовые правила (ни Lampa, ни DOM, кроме           */
  /* stripCards — она получает узлы и пишет только .card__title):          */
  /*   nbsp(s)         неразрывный пробел в числах от 1000 («20 000») и    */
  /*                   между числом и единицей («18,4 ГБ», «67 мин»);      */
  /*   dash(s)         « - » и « – » → « — »;                               */
  /*   ellipsis(s)     «....», «...», «……» → «…», знаки перед ним срезаны; */
  /*   clip(s, max)    обрезка по границе слова (слово с дефисом — одно    */
  /*                   слово, висячего «Сант-…» нет) с «…»;                */
  /*   text(s)         nbsp + dash + ellipsis + схлопнутые пробелы;        */
  /*   bigNumber(n, w) «2 тыс.», «3,4 тыс.», «1,2 млн» (en: «2K», «3.4K»); */
  /*                   слова — LC.STRINGS lumen_typo_* через LC.lang;      */
  /*   films(n)        «5 фильмов» (склонение — LC.util.plural);           */
  /*   titleStep(s)    ступень названия героя без логотипа: 1 — до 14      */
  /*                   знаков, 2 — 15–28, 3 — длиннее;                     */
  /*   stripPrefix(ts) общий префикс франшизы: [{ t, s, r }] той же длины — */
  /*                   t без префикса, s — «Эпизод V» / «Часть 1» (если    */
  /*                   были), r — остаток целиком; правило — у функции;    */
  /*   stripCards(els) то же для плиток ряда/сетки (.card с card_data).    */
  /*                                                                       */
  /* CSS экранов 43/44/46 — в LC.v2css (точка подключения в src/30_css.js). */
  /* -------------------------------------------------------------------- */

  LC.typo = (function () {
    var NB = ' ';

    /* Единицы, которые не отрываются от числа. Без флага u в ES5 \b с
       кириллицей не работает — конец слова проверяет отрицательный
       просмотр вперёд. */
    var UNIT_RE = new RegExp('(\\d) (?=(?:ГБ|МБ|КБ|ТБ|GB|MB|KB|TB|мин|сек|ч|час|часа|часов|тыс\\.|тис\\.|млн|млрд|лет|года|год|г\\.|%|₽|руб|серий|серии|серия|сезонов|сезона|сезон|фильмов|фильма|фильм)(?![A-Za-zА-Яа-яЁёІіЇїЄєҐґ]))', 'g');
    /* Группы разрядов: «20 000», «1 234 567». Слева — не цифра и не
       десятичный знак, справа — не цифра. */
    var GROUP_RE = /(^|[^\d.,])(\d{1,3})((?: \d{3})+)(?!\d)/g;

    function str(s) {
      return s === null || typeof s === 'undefined' ? '' : String(s);
    }

    function nbsp(s) {
      s = str(s);
      s = s.replace(GROUP_RE, function (m, pre, head, rest) {
        return pre + head + rest.replace(/ /g, NB);
      });
      return s.replace(UNIT_RE, '$1' + NB);
    }

    function dash(s) {
      return str(s).replace(/ [-–—] /g, ' — ');
    }

    function ellipsis(s) {
      s = str(s).replace(/(?:\.{2,}|…)(?:[.…]*)/g, '…');
      /* Пробел и знаки препинания перед многоточием («годы, …») — срезаны. */
      return s.replace(/[\s,;:.!?\-—–]+…/g, '…');
    }

    function text(s) {
      return ellipsis(dash(nbsp(str(s).replace(/[ \t]{2,}/g, ' '))));
    }

    /* Обрезка по границе слова. Разрыв — только на пробеле (обычном или
       неразрывном нельзя: он и поставлен, чтобы не рвать), поэтому слово с
       дефисом не режется посередине. Хвостовые знаки перед «…» срезаются. */
    function clip(s, max) {
      s = str(s);
      if (!max || s.length <= max) return s;
      var cut = s.slice(0, max + 1);
      var at = cut.lastIndexOf(' ');
      var head = at > max * 0.4 ? cut.slice(0, at) : s.slice(0, max);
      head = head.replace(/[\s,;:.!?\-—–…]+$/, '');
      return head + '…';
    }

    /* Слова чисел текущего языка: шаблоны «%s тыс.» / «%s млн» и десятичный
       знак. Словарь — LC.STRINGS (src/80_settings.js); без него (тесты
       модуля) — русские. */
    var RU_WORDS = { k: '%s' + NB + 'тыс.', m: '%s' + NB + 'млн', dec: ',' };
    function numWords() {
      try {
        if (typeof LC.lang === 'function' && LC.STRINGS && LC.STRINGS.lumen_typo_thousand) {
          return { k: LC.lang('lumen_typo_thousand'), m: LC.lang('lumen_typo_million'), dec: LC.lang('lumen_typo_decimal') };
        }
      } catch (e) { }
      return RU_WORDS;
    }

    function bigNumber(n, words) {
      n = Math.abs(Number(n) || 0);
      words = words || numWords();
      if (n < 1000) return String(Math.round(n));
      function fmt(v) {
        var r = v < 10 ? Math.round(v * 10) / 10 : Math.round(v);
        return String(r).replace('.', words.dec || ',');
      }
      var k = n / 1000;
      if (Math.round(k) < 1000) return words.k.replace('%s', fmt(k));
      return words.m.replace('%s', fmt(n / 1e6));
    }

    function films(n) {
      n = Number(n) || 0;
      var forms = ['фильм', 'фильма', 'фильмов'];
      try {
        if (typeof LC.lang === 'function' && LC.STRINGS && LC.STRINGS.lumen_typo_films) forms = LC.lang('lumen_typo_films').split('|');
      } catch (e) { }
      var word;
      if (forms.length < 3) word = n === 1 ? forms[0] : (forms[1] || forms[0]);
      else if (LC.util && typeof LC.util.plural === 'function') word = LC.util.plural(n, forms);
      else word = forms[2];
      return n + NB + word;
    }

    function titleStep(s) {
      var len = str(s).length;
      if (len <= 14) return 1;
      if (len <= 28) return 2;
      return 3;
    }

    var ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    var EPISODE_RE = /^((?:Эпизод|Епізод|Episode)\s+([IVX]+|\d{1,2}))\s*[—–:.\-]\s*(.+)$/i;
    var HEAD_RE = /^(.+?)\s*[:.]\s+(.+)$/;

    function words(s) {
      return str(s).replace(/^\s+|\s+$/g, '').split(/\s+/).length;
    }

    /* «Сойка-пересмешница. Часть 1» → «Сойка-пересмешница» / «Часть 1»:
       номер части — во вторую строку, иначе в узкой плитке он срезается
       многоточием, и две части читаются одинаково. */
    var PART_RE = /^(.+?)[.,:]?\s+((?:Часть|Частина|Part)\s+[IVX\d]+)$/i;

    function low(s) {
      return str(s).toLowerCase();
    }

    /* Общий префикс франшизы. Префикс — начало названия до первого «:» или
       «.» (самое частое в ряду, без учёта регистра: «Звёздные Войны» и
       «Звёздные войны» — одно). Снимается, если его несут не меньше
       половины названий ряда и хотя бы два — с подзаголовком (сетка
       «Звёздных войн» смешана с «Мандалорцем» и «Andor»: у них префикса
       нет, им и нечего снимать). Фильм, названный ровно префиксом, имя
       сохраняет. Остаток короче двух слов («Мстители: Финал» → «Финал») не
       подставляется — название остаётся целым. «Эпизод N — …» и «… Часть
       N» в остатке уходят во вторую строку: { t: «Империя наносит ответный
       удар», s: «Эпизод V» }. */
    function stripPrefix(titles) {
      var list = [];
      var i;
      for (i = 0; i < (titles ? titles.length : 0); i++) list.push(str(titles[i]));
      var out = [];
      for (i = 0; i < list.length; i++) out.push({ t: list[i], s: '' });
      if (list.length < 2) return out;
      var count = {};
      var best = '';
      for (i = 0; i < list.length; i++) {
        var m = HEAD_RE.exec(list[i]);
        if (!m) continue;
        var key = low(m[1]);
        count[key] = (count[key] || 0) + 1;
        if (!best || count[key] > count[best]) best = key;
      }
      if (!best || count[best] < 2) return out;
      var carriers = 0;
      for (i = 0; i < list.length; i++) {
        if (low(list[i]) === best || low(list[i].slice(0, best.length)) === best) carriers++;
      }
      if (carriers * 2 < list.length) return out;
      for (i = 0; i < list.length; i++) {
        var t = list[i];
        if (low(t) === best || low(t.slice(0, best.length)) !== best) continue;
        if (!/^\s*[:.]\s/.test(t.slice(best.length))) continue;
        var rest = t.slice(best.length).replace(/^\s*[:.]\s*/, '');
        var whole = rest;
        var sub = '';
        var ep = EPISODE_RE.exec(rest);
        if (ep && words(ep[3]) >= 2) {
          var num = /^\d+$/.test(ep[2]) ? (ROMAN[Number(ep[2])] || ep[2]) : ep[2].toUpperCase();
          sub = ep[1].replace(/\s+\S+$/, '') + ' ' + num;
          rest = ep[3];
        } else {
          var part = PART_RE.exec(rest);
          if (part) {
            sub = part[2];
            rest = part[1];
          }
        }
        if (words(rest) < 2 && !sub) continue;
        out[i] = { t: rest, s: sub, r: whole };
      }
      return out;
    }

    /* Плитки ряда или сетки: названия из card_data, запись — только в
       .card__title. Полное название остаётся у узла (lumen_title_full) и
       возвращается, если общий префикс у ряда пропал (догрузились чужие). */
    function stripCards(els) {
      try {
        var nodes = [];
        var titles = [];
        for (var i = 0; i < (els ? els.length : 0); i++) {
          var el = els[i] && els[i].length ? els[i][0] : els[i];
          var d = el && el.card_data;
          if (!d) continue;
          nodes.push(el);
          titles.push(d.lumen_title || d.title || d.name || '');
        }
        var res = stripPrefix(titles);
        for (var k = 0; k < nodes.length; k++) {
          /* В подписи плитки второй строки под часть нет (там «год · ★»):
             номер части остаётся в названии — «Сойка-пересмешница. Часть 1». */
          var want = res[k].r || res[k].t;
          var node = nodes[k].querySelector ? nodes[k].querySelector('.card__title') : null;
          if (!node) continue;
          if (node.textContent === want) continue;
          if (want === titles[k] && !nodes[k].lumen_title_full) continue;
          nodes[k].lumen_title_full = titles[k];
          node.textContent = want;
        }
      } catch (e) { }
    }

    return {
      nbsp: nbsp,
      dash: dash,
      ellipsis: ellipsis,
      clip: clip,
      text: text,
      bigNumber: bigNumber,
      films: films,
      titleStep: titleStep,
      stripPrefix: stripPrefix,
      stripCards: stripCards
    };
  })();

  /* CSS экранов 43 (шкала, цвета текста, название героя), 44 (франшизы и
     подборки) и 46 (доводка главной). Композиция главной и героя не
     меняется (огр. 8): размер кадра, его поведение, место ряда в фокусе. */
  LC.v2css = LC.v2css || [];
  LC.v2css.push({
    id: 'typo',
    order: 43,
    build: function (ctx) {
      var P = ctx.P;
      var APPLE = ctx.APPLE;
      var r2 = ctx.round2;
      var css = [];
      /* Разрядка крупного: Golos −.01em, Inter −.02em (от 80 px на 4K). */
      var trackT = APPLE ? '-.02em' : '-.01em';

      /* --- 43: название героя без логотипа, три ступени ---
         Кегли — в контексте текста героя (TEXT_ZOOM 1.1): 3.4 / 2.8 / 2.3em
         = 170 / 140 / 116 px на 4K. Ступени 2 и 3 — до двух строк; коробка не
         ниже места логотипа (4.4em контекста), поэтому блок с логотипом и без
         него стоит одинаково, а две строки растут вверх (содержимое прижато
         к низу), мета и описание не двигаются. max-width — 44em базовых. */
      css.push('.lumen-hero .lumen-hero__title{letter-spacing:' + trackT + '}');
      var steps = { 2: 2.8, 3: 2.3 };
      for (var k in steps) {
        if (!steps.hasOwnProperty(k)) continue;
        var fs = steps[k];
        css.push('.lumen-hero .lumen-hero__title[data-lc-step="' + k + '"]{font-size:' + fs + 'em;line-height:1.1;white-space:normal;' +
          'height:auto;min-height:' + r2(4.4 / fs) + 'em;max-height:2.2em;max-width:' + r2(44 / 1.1 / fs) + 'em;' +
          '-webkit-line-clamp:2;-webkit-box-pack:end}');
      }

      /* --- 46: логотип отделён от меты на .9em (было .3em, ~12 px) --- */
      css.push('.lumen-hero.lumen-hero--logo .lumen-hero__meta{margin-top:.9em}');

      /* --- 46: ряд поднят на 40 px FHD (80 на 4K) — подписи первого ряда
         кончаются над нижним полем 120 px (4K). Сдвиг — top у области рядов
         (position:relative у неё уже есть): раскладка, прокрутка Lampa и
         переход ленты не меняются. Текст героя едет вверх на те же 40 px
         (margin-bottom у абсолютного блока), иначе ряд лёг бы на описание;
         кадр героя, его размер и поведение — прежние. Только окна, где
         кадр есть (уже 2:1 — порог «кадра нет» не ниже 2.2:1). */
      var LIFT = 1.75;
      css.push('@media screen and (max-aspect-ratio:2/1){' +
        '.lumen-main .scroll.layer--wheight{top:-' + LIFT + 'em}' +
        '.lumen-hero .lumen-hero__text{margin-bottom:' + r2(LIFT / 1.1) + 'em}}');

      /* --- 46: смена кадра героя в «Лёгких» — fade 220 мс ---
         Те же два <img>-слоя, что у кроссфейда «Полных» (src/48_hero.js,
         swapFrame): анимируется только opacity верхнего слоя --b, нижний
         --a гаснет без перехода, когда верхний встал. Новых слоёв нет,
         цвет фона не анимируется. */
      css.push('.lumen-hero-stage.lumen-motion-lite .lumen-hero__bg--b{-webkit-transition:opacity .22s ease-out;transition:opacity .22s ease-out}');
      css.push('.lumen-hero-stage.lumen-motion-lite .lumen-hero__bg--a{-webkit-transition:opacity 0s linear .22s;transition:opacity 0s linear .22s}');
      css.push('.lumen-hero-stage.lumen-motion-lite .lumen-hero__bg--a.is-active{-webkit-transition:none;transition:none}');

      /* --- 43: P.smoke (3.3:1) в тексте → P.muted (≥4.5:1) --- */
      css.push('.lumen-card.lumen-card--poster .lumen-poster-tmdb{color:' + P.muted + '}');
      css.push('.lumen-card .lumen-episode--soon .lumen-episode__name{color:' + P.muted + '}');
      css.push('.lumen-descr-row .lumen-fr-card__year{color:' + P.muted + '}');
      /* «8 СЕРИЙ» — обычный регистр, 46/500 (4K). */
      css.push('.lumen-card .lumen-episodes__count{color:' + P.muted + ';text-transform:none;letter-spacing:0;font-weight:500}');

      /* --- 43: подписи под постерами 500, не 700 --- */
      css.push('.lumen-main .card__title,.lumen-grid .lumen-gcard .card__title{font-weight:500}');
      css.push('.lumen-descr-row .lumen-fr-card__name{font-weight:500}');

      /* --- 43/44: капс с разрядкой → обычный регистр 46/500 --- */
      css.push('.lumen-hub__search,.lumen-hub__roulette{font-weight:500;letter-spacing:0;text-transform:none}');
      css.push('.lumen-card .lumen-reactions-chip__label{letter-spacing:0;color:' + P.soft + '}');

      /* --- 43: разрядка крупных заголовков --- */
      css.push('.lumen-grid__title{letter-spacing:' + trackT + '}');
      if (APPLE) css.push('.lumen-main .items-line__title{font-weight:600;letter-spacing:-.01em}');

      return css.join('\n');
    }
  });

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.typo;

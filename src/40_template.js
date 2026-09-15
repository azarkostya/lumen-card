  /* -------------------------------------------------------------------- */
  /* Шаблон.                                                               */
  /* Разметка кнопок (.full-start-new__buttons и .buttons--container)      */
  /* здесь НЕ хранится: она вырезается дословно (innerOf) из настоящего     */
  /* оригинального шаблона Lampa, который рантайм сохраняет до подмены      */
  /* (saveOriginalTemplate() в 90_runtime.js, до Template.add). Раньше       */
  /* кнопки были ручной копией прямо в этом файле, и она расходилась с      */
  /* оригиналом побайтово (другое форматирование — без пробелов/переносов   */
  /* строк между тегами), из-за чего Lampa.Utils.hash(outerHTML) не совпадал */
  /* с оригиналом и сбивал сохранённую пользователем приоритетную кнопку     */
  /* (buttons.js хэширует именно outerHTML кнопки, см. план 0.2 «Кнопки и   */
  /* хэш приоритета»). Вырезка из живого оригинала переживёт и апдейт       */
  /* Lampa, и чужой плагин, подменивший шаблон раньше нас.                  */
  /* -------------------------------------------------------------------- */

  LC.template = (function () {
    function innerOf(html, cls) {
      if (typeof html !== 'string' || !cls) return null;
      var wordRe = new RegExp('(^|\\s)' + cls.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)');

      /* Индекс первой НЕэкранированной кавычками '>' начиная с pos, или -1
         (незакрытый тег). '>' внутри "…"/'…' (например, в data-x="1>2") не
         считается концом тега — без этого учёта строка вроде
         '<div class="x" data-y="1>2">' обрывалась бы на первом '>'. */
      function findTagClose(pos) {
        var i = pos, quote = null, c;
        for (; i < html.length; i++) {
          c = html.charAt(i);
          if (quote) { if (c === quote) quote = null; }
          else if (c === '"' || c === '\'') quote = c;
          else if (c === '>') return i;
        }
        return -1;
      }

      function classOf(tagText) {
        var m = /class\s*=\s*"([^"]*)"/i.exec(tagText) || /class\s*=\s*'([^']*)'/i.exec(tagText);
        return m ? m[1] : '';
      }

      /* Токен, начинающийся с html[i] === '<':
         - 'comment' — HTML-комментарий, пропускается целиком до '-->' (то,
           что внутри, тегом не считается — иначе закомментированный старый
           <div class="…">…</div> мог бы подменить собой настоящий блок);
         - 'open'/'close' — <div…>/</div>, граница имени тега проверена явно
           (символ сразу после "div" — пробел, '>' или '/'), чтобы 'divider'
           не приняло за div; у 'open' есть selfClosing (тег вида <div … />:
           последний непробельный символ перед '>' — '/') — такой тег сам
           закрывает себя и не требует парного </div>;
         - 'other' — любой другой тег (span, svg, use, br…), на глубину
           вложенности не влияет.
         null — незакрытый тег или незакрытый комментарий: выше по стеку это
         тоже даёт null (см. innerOf/цикл ниже). Регистр важен: '<DIV' тегом
         div не считается (это осознанно — Lampa/наш build() пишут div только
         строчными; тег становится 'other', что для div-поиска даёт null). */
      function readTag(i) {
        var e, tagText, body, selfClosing;
        if (html.slice(i, i + 4) === '<!--') {
          e = html.indexOf('-->', i + 4);
          return e === -1 ? null : { type: 'comment', next: e + 3 };
        }
        if (html.slice(i, i + 4) === '<div' && /[\s>\/]/.test(html.charAt(i + 4) || '>')) {
          e = findTagClose(i);
          if (e === -1) return null;
          tagText = html.slice(i, e + 1);
          body = tagText.slice(0, -1).replace(/\s+$/, '');
          selfClosing = body.charAt(body.length - 1) === '/';
          return { type: 'open', next: e + 1, cls: classOf(tagText), selfClosing: selfClosing };
        }
        if (html.slice(i, i + 5) === '</div' && /[\s>]/.test(html.charAt(i + 5) || '>')) {
          e = findTagClose(i);
          return e === -1 ? null : { type: 'close', next: e + 1 };
        }
        e = findTagClose(i);
        return e === -1 ? null : { type: 'other', next: e + 1 };
      }

      /* Фаза 1: ищем первый <div>, у которого в class есть токен cls целым словом.
         Если сам он самозакрывающийся (<div class="cls"/>), содержимого у него
         нет по определению — сразу пустая строка, парный </div> не ищем. */
      var pos = html.indexOf('<'), tok, contentStart = -1;
      while (pos !== -1) {
        tok = readTag(pos);
        if (!tok) return null;
        if (tok.type === 'open' && wordRe.test(tok.cls)) {
          if (tok.selfClosing) return '';
          contentStart = tok.next;
          break;
        }
        pos = html.indexOf('<', tok.next);
      }
      if (contentStart === -1) return null;

      /* Фаза 2: от конца открывающего тега считаем вложенность по всем
         <div…>/</div> (остальные теги и комментарии пропускаем как есть) —
         так парный </div> находится даже если внутри блока есть свои
         вложенные div. Самозакрывающийся <div … /> глубину не увеличивает —
         он не требует своего </div>, иначе он «съедал» бы чужой закрывающий
         тег дальше по документу. Срез — по индексам исходной строки,
         дословно, без trim/replace: комментарии и прочая разметка внутри
         блока остаются в вырезке как есть, они могут быть частью outerHTML
         кнопки. */
      var depth = 1;
      pos = html.indexOf('<', contentStart);
      while (pos !== -1) {
        tok = readTag(pos);
        if (!tok) return null;
        if (tok.type === 'open') {
          if (!tok.selfClosing) depth++;
        } else if (tok.type === 'close') {
          depth--;
          if (depth === 0) return html.slice(contentStart, pos);
        }
        pos = html.indexOf('<', tok.next);
      }
      return null; /* нет баланса — незакрытый div */
    }

    function build(original) {
      var buttons = innerOf(original, 'full-start-new__buttons');
      var pool = innerOf(original, 'buttons--container');
      if (buttons === null || pool === null) return null;
      if (buttons.indexOf('button--play') === -1) return null;

      /* Task 5a Step 2: шесть .lumen-in — соседние дети ОДНОГО .lumen-content
         (совпадает с .full-start-new__right), между ними нет посторонних
         узлов — на этом основан stagger-подбор Task 4 (nth-child(1..6)).
         .lumen-side идёт следом седьмым ребёнком, на нумерацию первых
         шести не влияет. Порядок блоков — по Task 5a: мета; заголовок +
         оригинал/режиссёр; описание; рейтинги + статус + чип реакций;
         прогресс; кнопки. */
      return '' +
        '<div class="full-start-new lumen-card">' +
        '<div class="full-start-new__body">' +
        '<div class="full-start-new__left">' +
        '<div class="full-start-new__poster">' +
        '<img class="full-start-new__img full--poster" />' +
        '</div>' +
        '</div>' +
        '<div class="full-start-new__right lumen-content">' +

        /* 1: мета (год · страна · хронометраж/сезоны · жанры · 18+ · реж.) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__head"></div>' +
        '<div class="lumen-meta"></div>' +
        '<div class="full-start__pg hide"></div>' +
        '</div>' +

        /* 2: заголовок + оригинальное название/режиссёр(создатель) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__title">{title}</div>' +
        '<div class="lumen-original">{original_title}</div>' +
        '<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
        '</div>' +

        /* 3: описание (2 строки, line-clamp в CSS) */
        '<div class="lumen-in lumen-descr">{descr}</div>' +

        /* 4: рейтинги + чип реакций (статус — в боковой колонке, design-spec §8 /
           экраны 01,10: пилюля стоит первой над чипами качества, а не в общей
           ленте — уточнение по ревью Task 5a, Step 2 плана был неточен) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__rate-line">' +
        '<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
        '<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
        '<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
        '<div class="full-start__tag tag--episode hide"><div></div></div>' +
        '<div class="lumen-reactions-chip hide"><div class="lumen-reactions-chip__value"></div><div class="lumen-reactions-chip__label"></div></div>' +
        '</div>' +
        '</div>' +

        /* 5: продолжить просмотр */
        '<div class="lumen-in lumen-progress hide">' +
        '<span class="lumen-progress__label"></span>' +
        '<div class="lumen-progress__bar"><div></div></div>' +
        '<span class="lumen-progress__time"></span>' +
        '</div>' +

        /* 6: кнопки (только LC.template.build — содержимое не трогать) */
        '<div class="lumen-in">' +
        '<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +
        /* Обёртка константна (только этот один div), хэшируется НЕ она —
           хэшируются кнопки внутри (innerOf вырезает только их, план 0.2). */
        '<div class="full-start-new__buttons">' + buttons + '</div>' +
        '</div>' +

        /* Боковая колонка: статус (первым, над чипами качества) + раздельные
           чипы качества + «В ролях». */
        '<div class="lumen-side">' +
        '<div class="full-start__status hide"></div>' +
        '<div class="lumen-tags">' +
        '<div class="full-start__tag tag--quality hide"><div></div></div>' +
        '</div>' +
        '<div class="lumen-cast hide">' +
        '<div class="lumen-cast__label"></div>' +
        '<div class="lumen-cast__row"></div>' +
        '</div>' +
        '</div>' +

        '</div>' +
        '<div class="lumen-keep">' +
        '<div class="full-start__tag tag--year hide"><div></div></div>' +
        '<div class="full-start__tag tag--time hide"><div></div></div>' +
        '<div class="full-start-new__details"></div>' +
        '<div class="is--serial hide"></div>' +
        '</div>' +
        '</div>' +
        /* Та же логика: обёртка константна, вырезаны и вставлены дословно
           только сами кнопки-альтернативы (торренты/трейлеры) внутри неё. */
        '<div class="hide buttons--container">' + pool + '</div>' +
        '</div>';
    }

    /* Task 5/5a Step 1: список классов/ключей, обязательных в НАШЕМ шаблоне —
       start.js обращается к ним независимо от того, есть ли они в текущем
       original (missingInOriginal — только информативно, на assert.ok не
       влияет). */
    var REQUIRED = ['full-start-new__title', 'full-start-new__head', 'full--tagline', 'full-start-new__details',
      'full-start-new__reactions', 'full-start-new__buttons', 'buttons--container', 'button--play', 'button--book',
      'button--reaction', 'button--subscribe', 'button--options', 'rate--tmdb', 'rate--imdb', 'rate--kp',
      'tag--year', 'tag--time', 'tag--quality', 'tag--episode', 'full-start__pg', 'full-start__status',
      'is--serial', 'full--poster', 'full-start-new__poster'];

    function assert(original, ours) {
      var missingInOriginal = [], missingInOurs = [];
      LC.util.each(REQUIRED, function (c) {
        if (original.indexOf(c) === -1) missingInOriginal.push(c);
        if (ours.indexOf(c) === -1) missingInOurs.push(c);
      });
      var keys = original.match(/#\{[a-z_]+\}/g) || [];
      LC.util.each(keys, function (k) { if (ours.indexOf(k) === -1) missingInOurs.push(k); });
      return { ok: missingInOurs.length === 0, missingInOurs: missingInOurs, missingInOriginal: missingInOriginal };
    }

    return { innerOf: innerOf, build: build, REQUIRED: REQUIRED, assert: assert };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.template;

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
      var openTagRe = /<div\b[^>]*>/gi;
      var m, start = -1, tagEnd = -1;
      while ((m = openTagRe.exec(html)) !== null) {
        var classMatch = /class\s*=\s*"([^"]*)"/i.exec(m[0]) || /class\s*=\s*'([^']*)'/i.exec(m[0]);
        if (classMatch && wordRe.test(classMatch[1])) {
          start = m.index;
          tagEnd = openTagRe.lastIndex;
          break;
        }
      }
      if (start === -1) return null;

      /* Вложенность считаем по всем <div…>/</div> от конца найденного
         открывающего тега — так парный </div> находится даже если внутри
         блока есть свои вложенные div. */
      var scanRe = /<div\b[^>]*>|<\/div\s*>/gi;
      scanRe.lastIndex = tagEnd;
      var depth = 1, sm;
      while ((sm = scanRe.exec(html)) !== null) {
        if (sm[0].charAt(1) === '/') {
          depth--;
          if (depth === 0) return html.slice(tagEnd, sm.index);
        } else {
          depth++;
        }
      }
      return null; /* нет баланса — незакрытый div */
    }

    function build(original) {
      var buttons = innerOf(original, 'full-start-new__buttons');
      var pool = innerOf(original, 'buttons--container');
      if (buttons === null || pool === null) return null;
      if (buttons.indexOf('button--play') === -1) return null;

      return '' +
        '<div class="full-start-new lumen-card">' +
        '<div class="full-start-new__body">' +
        '<div class="full-start-new__left">' +
        '<div class="full-start-new__poster">' +
        '<img class="full-start-new__img full--poster" />' +
        '</div>' +
        '</div>' +
        '<div class="full-start-new__right">' +
        '<div class="lumen-cols">' +
        '<div class="lumen-main">' +
        '<div class="full-start-new__head"></div>' +
        '<div class="lumen-meta"></div>' +
        '<div class="full-start-new__title">{title}</div>' +
        '<div class="lumen-original">{original_title}</div>' +
        '<div class="full-start-new__tagline full--tagline">{tagline}</div>' +
        '<div class="lumen-descr">{descr}</div>' +
        '<div class="full-start-new__rate-line">' +
        '<div class="full-start__rate rate--tmdb"><div>{rating}</div><div class="source--name">TMDB</div></div>' +
        '<div class="full-start__rate rate--imdb hide"><div></div><div>IMDB</div></div>' +
        '<div class="full-start__rate rate--kp hide"><div></div><div>KP</div></div>' +
        '<div class="full-start__pg hide"></div>' +
        '<div class="full-start__tag tag--episode hide"><div></div></div>' +
        '</div>' +
        '<div class="lumen-progress hide">' +
        '<span class="lumen-progress__label"></span>' +
        '<div class="lumen-progress__bar"><div></div></div>' +
        '<span class="lumen-progress__time"></span>' +
        '</div>' +
        '<div class="full-start-new__details"></div>' +
        '<div class="full-start-new__reactions"><div>#{reactions_none}</div></div>' +
        '<div class="full-start-new__buttons">' + buttons + '</div>' +
        '</div>' +
        '</div>' +
        '<div class="lumen-side">' +
        '<div class="lumen-side__status"><div class="full-start__status hide"></div></div>' +
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
        '<div class="is--serial hide"></div>' +
        '</div>' +
        '</div>' +
        '<div class="hide buttons--container">' + pool + '</div>' +
        '</div>';
    }

    return { innerOf: innerOf, build: build };
  })();

  if (typeof module !== 'undefined' && module && module.lumen) module.exports = LC.template;

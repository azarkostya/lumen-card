import test from 'node:test'; import assert from 'node:assert/strict';
import { loadCtx } from './_load.mjs';

/* Следующий раунд, п.10 (полное ревью c644bfd, D4): после смены «Кадра над
   рядами» фокус возвращается в прежний ряд главной (src/47_homerow.js).

   Модель Lampa здесь — ровно то, на что модуль опирается:
   - модуль рядов главной Items$1 (vendor/lampa/app.min.js:35145-35181):
     номер ряда active; «вверх» из ряда — active-- и фокус в ряд выше, из
     первого — шапка (active остаётся 0); «вниз» — active++;
   - память ряда Line (collectionFocus(last), :35287-35288): в ряд фокус
     приходит на ту карточку, с которой из него ушли;
   - шапка: «вниз» — Controller.toggle('content'), главная ставит фокус в
     ряд active (:10207-10209, :35096-35098);
   - фокус пульта — 'hover:focus' на карточке, мышь — 'hover:hover'
     (оба ловит слушатель в фазе захвата на body, LC.focus.capture). */

const warnLog = [];
globalThis.warn = function () { warnLog.push(Array.prototype.slice.call(arguments)); };

function Node(classes) {
  const own = classes || [];
  this.classList = { contains: (c) => own.indexOf(c) !== -1 };
  this.parentNode = null;
  this.children = [];
}
Node.prototype.append = function (child) {
  child.parentNode = this;
  this.children.push(child);
  return child;
};
/* Только то, что спрашивает модуль: порядок соседей одного контейнера. */
Node.prototype.compareDocumentPosition = function (other) {
  const p = this.parentNode;
  if (!p || !other || other.parentNode !== p) return 1;
  return p.children.indexOf(other) > p.children.indexOf(this) ? 4 : 2;
};
Node.prototype.contains = function (node) {
  for (let n = node; n; n = n.parentNode) if (n === this) return true;
  return false;
};

function makeMain(rows, perRow) {
  const body = new Node(['body']);
  body.listeners = [];
  body.addEventListener = (type, fn, capture) => body.listeners.push({ type, fn, capture });
  body.removeEventListener = (type, fn, capture) => {
    body.listeners = body.listeners.filter((l) => !(l.type === type && l.fn === fn && l.capture === capture));
  };
  const scroll = body.append(new Node(['scroll__body']));
  const lines = [];
  const cards = [];
  for (let r = 0; r < rows; r++) {
    const line = scroll.append(new Node(['items-line']));
    const inner = line.append(new Node(['items-line__body']));
    const row = [];
    for (let c = 0; c < perRow; c++) row.push(inner.append(new Node(['card', 'selector'])));
    lines.push(line);
    cards.push(row);
  }
  return { body, scroll, lines, cards };
}

function setup(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const main = makeMain(opts.rows || 5, 6);
  const st = { ctl: 'head', active: 0, last: main.cards.map((row) => row[0]), focused: null, comp: 'main', tv: opts.tv !== false, toggles: [], moves: [] };

  function fire(card, type) {
    const ev = { type: type || 'hover:focus', target: card };
    main.body.listeners.filter((l) => l.type === ev.type && l.capture).forEach((l) => l.fn(ev));
  }
  function focusRow(r) {
    st.active = r;
    st.ctl = 'items_line';
    st.focused = st.last[r];
    fire(st.focused);
    /* Как в Lampa: Controller.toggle сначала ставит фокус, потом рассылает
       'toggle' (общая подписка рантайма → LC.homeRow.onToggle). */
    if (H) H.onToggle('items_line');
  }
  let H = null;
  const Lampa = {
    Activity: { active: () => ({ component: st.comp }) },
    Platform: { screen: (need) => (need === 'tv' ? st.tv : false) },
    Controller: {
      enabled: () => ({ name: st.ctl }),
      toggle: (name) => {
        st.toggles.push(name);
        if (name === 'content') focusRow(st.active);
        else st.ctl = name;
      },
      move: (dir) => {
        st.moves.push(dir);
        if (dir === 'down' && st.active < main.lines.length - 1) focusRow(st.active + 1);
      }
    }
  };
  globalThis.Lampa = Lampa;
  globalThis.window = { Lampa: Lampa };
  globalThis.document = { body: main.body };
  H = loadCtx('47_homerow.js').api;

  /* Руки пользователя — пульт. */
  const user = {
    start: () => focusRow(0),
    down: () => { if (st.active < main.lines.length - 1) focusRow(st.active + 1); },
    up: () => {
      if (st.active > 0) focusRow(st.active - 1);
      else { st.ctl = 'head'; st.focused = null; H.onToggle('head'); }
    },
    right: () => {
      const row = main.cards[st.active];
      const next = row[row.indexOf(st.focused) + 1];
      if (!next) return;
      st.last[st.active] = next;
      st.focused = next;
      fire(next);
    },
    hover: (r, c) => fire(main.cards[r][c], 'hover:hover'),
    /* «Влево» с первой карточки ряда — меню Lampa (Line.left → onLeft →
       toggle('menu')), шапку не проходит. */
    menu: () => { st.ctl = 'menu'; st.focused = null; H.onToggle('menu'); }
  };
  /* Смена «Кадра над рядами» и выход из настроек «Назад» — в шапку. */
  function settingsBack() {
    H.arm();
    st.toggles.length = 0;
    st.moves.length = 0;
    H.onToggle('settings_component');
    H.onToggle('head');
  }
  return { H, st, main, user, settingsBack, fire };
}

const tick = () => new Promise((r) => setTimeout(r, 5));

test('п.10: подъём из третьего ряда в шапку, смена кадра, «Назад» — фокус в третьем ряду на прежней карточке', async () => {
  const { H, st, main, user, settingsBack } = setup();
  H.install();
  user.start();
  user.down(); user.down();
  user.right(); user.right();
  const was = st.focused;
  user.up(); user.up(); user.up();
  assert.equal(st.ctl, 'head', 'подготовка: пульт в шапке');
  assert.equal(st.active, 0, 'подготовка: Lampa сама довела номер ряда до первого');
  settingsBack();
  assert.deepEqual(st.toggles, [], 'возврат не через такт — из рассылки события Lampa');
  await tick();
  assert.deepEqual(st.toggles, ['content'], 'из шапки — тем же шагом, что «вниз» шапки');
  assert.deepEqual(st.moves, ['down', 'down'], 'в ряд — шагами пульта');
  assert.equal(st.active, 2, 'номер ряда у Lampa не тот');
  assert.equal(st.focused, was, 'не та карточка ряда');
  assert.equal(main.lines[2].contains(st.focused), true);
  assert.deepEqual(warnLog, []);
});

test('п.10: шаг по ряду во время подъёма делает источником этот ряд', async () => {
  const { H, st, user, settingsBack } = setup();
  H.install();
  user.start();
  user.down(); user.down(); user.down();
  user.up(); user.up();
  user.right();
  user.up(); user.up();
  settingsBack();
  await tick();
  assert.equal(st.active, 1, 'источник — ряд, в котором шагнули вправо');
});

test('п.10: наведение мышью источник не меняет', async () => {
  const { H, st, user, settingsBack } = setup();
  H.install();
  user.start();
  user.down(); user.down();
  user.hover(4, 3);
  user.up(); user.up(); user.up();
  settingsBack();
  await tick();
  assert.equal(st.active, 2);
});

test('п.10: без смены кадра выход из настроек фокус не трогает; select и settings_component не срабатывают', async () => {
  const { H, st, user } = setup();
  H.install();
  user.start();
  user.down(); user.down();
  user.up(); user.up(); user.up();
  st.toggles.length = 0;
  H.onToggle('head');
  await tick();
  assert.deepEqual(st.toggles, [], 'без смены «Кадра над рядами» фокус увели из шапки');
  H.arm();
  H.onToggle('select');
  H.onToggle('settings_component');
  await tick();
  assert.deepEqual(st.toggles, [], 'внутри настроек возврат сработал раньше выхода');
  H.onToggle('head');
  await tick();
  assert.equal(st.active, 2);
  /* Возврат одноразовый. */
  user.up(); user.up(); user.up();
  st.toggles.length = 0;
  H.onToggle('head');
  await tick();
  assert.deepEqual(st.toggles, [], 'второй выход в шапку снова увёл фокус');
});

test('п.10: «влево» из настроек (сразу в ряды) — тоже в прежний ряд', async () => {
  const { H, st, user } = setup();
  H.install();
  user.start();
  user.down(); user.down(); user.down();
  user.up(); user.up(); user.up(); user.up();
  H.arm();
  st.toggles.length = 0;
  /* Lampa: settings.left → Controller.toggle('content') → ряд active (первый). */
  st.active = 0;
  user.start();
  H.onToggle('content');
  await tick();
  assert.deepEqual(st.toggles, [], 'фокус уже в рядах — переключать контроллер незачем');
  assert.equal(st.active, 3);
});

test('п.10: не ТВ, не главная, главная пересобрана, источника нет — фокус остаётся, где его поставила Lampa', async () => {
  function climbed(opts) {
    const env = setup(opts);
    env.H.install();
    env.user.start();
    env.user.down(); env.user.down();
    env.user.up(); env.user.up(); env.user.up();
    return env;
  }
  const phone = climbed({ tv: false });
  phone.settingsBack();
  await tick();
  assert.deepEqual(phone.st.toggles, [], 'на телефоне главная фокус в ряды не ставит — и мы не ставим');

  const card = climbed();
  card.H.arm();
  card.st.comp = 'full';
  card.st.toggles.length = 0;
  card.H.onToggle('head');
  await tick();
  assert.deepEqual(card.st.toggles, [], 'фокус увели на чужом экране');

  const rebuilt = climbed();
  rebuilt.H.arm();
  rebuilt.main.lines[2].parentNode = null;
  rebuilt.st.toggles.length = 0;
  rebuilt.H.onToggle('head');
  await tick();
  assert.deepEqual(rebuilt.st.toggles, [], 'ряд-источник вне документа, а фокус увели');

  const fresh = setup();
  fresh.H.install();
  fresh.settingsBack();
  await tick();
  assert.deepEqual(fresh.st.toggles, [], 'в рядах не были — а фокус увели из шапки');
  assert.deepEqual(warnLog, []);
});

test('п.10: Lampa поставила фокус ниже источника — вверх модуль не ведёт', async () => {
  const { H, st, user, settingsBack } = setup();
  H.install();
  user.start();
  user.down();
  user.up(); user.up();
  /* Кто-то (не пульт) сдвинул номер ряда Lampa ниже. */
  st.active = 3;
  settingsBack();
  await tick();
  assert.deepEqual(st.moves, []);
  assert.equal(st.active, 3);
});

/* Ревью fa7d4fd..cd6c2e5 (~80): из рядов ушли не через шапку («влево» в
   меню, клик по шестерёнке мышью) — источником остаётся ряд, где стоял фокус,
   а не ряд, с которого когда-то начали подниматься. */
test('п.10: подъём с пятого ряда до второго, «влево» в меню, смена кадра — фокус во втором ряду, не в пятом', async () => {
  const { H, st, user } = setup({ rows: 6 });
  H.install();
  user.start();
  user.down(); user.down(); user.down(); user.down();
  user.up(); user.up(); user.up();
  assert.equal(st.active, 1, 'подготовка: фокус во втором ряду');
  user.menu();
  H.onToggle('settings');
  H.arm();
  st.toggles.length = 0;
  st.moves.length = 0;
  H.onToggle('settings_component');
  st.ctl = 'head';
  H.onToggle('head');
  await tick();
  assert.deepEqual(st.moves, [], 'фокус увели вниз — в ряд, с которого когда-то начали подъём');
  assert.equal(st.active, 1, 'фокус не во втором ряду');
});

test('п.10: install один раз, uninstall снимает слушатель и забывает источник', async () => {
  const { H, st, main, user, settingsBack } = setup();
  H.install();
  H.install();
  assert.deepEqual(main.body.listeners.map((l) => l.type + ':' + l.capture).sort(), ['hover:focus:true', 'hover:hover:true']);
  user.start();
  user.down(); user.down();
  user.up(); user.up(); user.up();
  H.uninstall();
  assert.deepEqual(main.body.listeners, []);
  settingsBack();
  await tick();
  assert.deepEqual(st.toggles, []);
});

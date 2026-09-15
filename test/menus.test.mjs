import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
import { FakeEl } from './_fakedom.mjs';

/* Task 31: маркеры меню и окон пути TorrServer (src/64_menus.js).
   kind()/isPathModal() — чистые; mode()/install() трогают $('body'),
   Lampa.Select/Modal — здесь всё фейковое: $ отдаёт заранее собранные
   FakeEl по селектору, listener повторяет Subscribe Lampa, а фейковый
   Select.show/close — порядок событий app.min.js:7078/7150
   (show: preshow; close: hide -> onBack -> close). */

/* warn() в бандле объявлен в 00_head.js; тестовый загрузчик его не даёт. */
var warnLog = [];
globalThis.warn = function (msg) { warnLog.push(msg); };

const m = load('64_menus.js');
const titles = { source: 'Источник', action: 'Действие' };

test('источник: title + пункты с btn', () => {
  assert.equal(m.kind({ title: 'Источник', items: [{ title: 'Торренты', btn: {} }] }, 'full', titles), 'source');
});
test('меню раздачи: флаги tomy/mark/unmark', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ tomy: true }, { mark: true }, { unmark: true }] }, 'torrents', titles), 'torrent');
});
test('меню файла: timeclear/timefull/player/link', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ timeclear: true }, { timefull: true }, { player: 'lampa' }, { link: true }] }, 'full', titles), 'file');
});
test('сортировка/фильтр: любой Select при активной активности torrents', () => {
  assert.equal(m.kind({ title: 'Сортировать', items: [{ title: 'По сидам' }] }, 'torrents', titles), 'filter');
});
test('чужой Select с тем же заголовком «Действие» → null', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ title: 'Удалить' }] }, 'main', titles), null);
  assert.equal(m.kind(null, 'main', titles), null);
});
test('kind: заголовок «Источник» без btn (чужой) → null; пустые items вне torrents → null', () => {
  assert.equal(m.kind({ title: 'Источник', items: [{ title: 'TMDB' }] }, 'settings', titles), null);
  assert.equal(m.kind({ title: 'Источник', items: [] }, 'full', titles), null);
  assert.equal(m.kind({ title: 'x' }, 'main', titles), null);
});
test('kind: пустая «Сортировать» на экране торрентов без раздач (items=0, живьём) → filter', () => {
  assert.equal(m.kind({ title: 'Сортировать', items: [] }, 'torrents', titles), 'filter');
  assert.equal(m.kind({ title: 'Сортировать' }, 'torrents', titles), 'filter');
});
test('kind: флаги файла/раздачи без заголовка «Действие» → null (трейлеры с player, плейлист с link)', () => {
  assert.equal(m.kind({ title: 'YouTube - Трейлеры', items: [{ title: 'Трейлер', player: 'youtube', url: 'x' }] }, 'full', titles), null);
  assert.equal(m.kind({ title: 'Плейлист', items: [{ title: '1', link: true, player: 'lampa' }] }, 'full', titles), null);
  assert.equal(m.kind({ title: 'Настройки', items: [{ mark: true }] }, 'full', titles), null);
});
test('kind: «Действие» только с player/link (без timeclear/timefull) → не file', () => {
  assert.equal(m.kind({ title: 'Действие', items: [{ player: 'lampa' }, { link: true }] }, 'full', titles), null);
});

/* ---------------------------------------------------------------- */

function modalWith(cls) {
  const inner = cls ? [new FakeEl([cls])] : [];
  return new FakeEl(['modal'], [new FakeEl(['modal__content'], [new FakeEl(['modal__body'], inner)])]);
}

test('isPathModal: .modal-loading / .torrent-install → true', () => {
  assert.equal(m.isPathModal(modalWith('modal-loading')), true);
  assert.equal(m.isPathModal(modalWith('torrent-install')), true);
});
test('isPathModal: иное/пусто → false', () => {
  assert.equal(m.isPathModal(modalWith('settings-param')), false);
  assert.equal(m.isPathModal(modalWith(null)), false);
  assert.equal(m.isPathModal(null), false);
  assert.equal(m.isPathModal({ length: 0 }), false);
});

/* ---------------------------------------------------------------- */

function makeListener() {
  return {
    cbs: {},
    follow(name, cb) { (this.cbs[name] = this.cbs[name] || []).push(cb); },
    send(name, e) { (this.cbs[name] || []).forEach((cb) => cb(e)); },
    count(name) { return (this.cbs[name] || []).length; }
  };
}

function setup(opts) {
  opts = opts || {};
  warnLog.length = 0;
  const env = {
    body: new FakeEl(['body-mock']),
    selectbox: new FakeEl(['selectbox']),
    modal: modalWith(opts.modalContent === undefined ? 'modal-loading' : opts.modalContent),
    component: opts.component || 'full',
    controller: opts.controller || 'content'
  };
  globalThis.$ = function (x) {
    if (x === 'body') return env.body;
    if (x === '.selectbox') return env.selectbox;
    if (x === '.modal') return env.modal;
    return x;
  };
  let active = null;
  const select = {
    listener: makeListener(),
    render: () => env.selectbox,
    /* app.min.js:7078 show$e: active = object; preshow; ...; fullshow; Controller.toggle('select') */
    show(object) {
      active = object;
      select.listener.send('preshow', { active: active });
      select.listener.send('fullshow', { active: active, html: env.selectbox });
      env.controller = 'select';
    },
    /* app.min.js:7150 close$a: hide$4 -> onBack -> close */
    close() {
      select.listener.send('hide', { active: active });
      if (active.onBack) active.onBack();
      select.listener.send('close', { active: active });
    }
  };
  globalThis.Lampa = {
    Lang: { translate: (k) => ({ settings_rest_source: 'Источник', title_action: 'Действие' })[k] || k },
    Activity: { active: () => ({ component: env.component }) },
    Controller: { enabled: () => ({ name: env.controller }), toggle: (name) => { env.controller = name; } },
    Select: select,
    Modal: { listener: makeListener(), render: () => env.modal }
  };
  env.m = load('64_menus.js');
  return env;
}

function menuClasses(el) { return el._class.filter((c) => c.indexOf('lumen-menus-') === 0); }
function kindOf(env) { return env.selectbox.attr('data-lumen-kind'); }

test('mode: all/path/off — ровно один класс или ни одного', () => {
  const env = setup();
  env.m.mode('all');
  assert.deepEqual(menuClasses(env.body), ['lumen-menus-all']);
  env.m.mode('path');
  assert.deepEqual(menuClasses(env.body), ['lumen-menus-path']);
  env.m.mode('off');
  assert.deepEqual(menuClasses(env.body), []);
});

test('mode: повторные вызовы не копят классы', () => {
  const env = setup();
  env.m.mode('path'); env.m.mode('path'); env.m.mode('all'); env.m.mode('all');
  assert.deepEqual(menuClasses(env.body), ['lumen-menus-all']);
});

test('mode: неизвестное значение (undefined/мусор) → как all (значение по умолчанию)', () => {
  const env = setup();
  assert.equal(env.m.mode(undefined), 'all');
  assert.deepEqual(menuClasses(env.body), ['lumen-menus-all']);
  env.m.mode('off');
  assert.equal(env.m.mode('garbage'), 'all');
  assert.deepEqual(menuClasses(env.body), ['lumen-menus-all']);
  assert.equal(env.m.mode('off'), 'off');
});

test('install: Select «Источник» → lumen-select + data-lumen-kind=source', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Select.show({ title: 'Источник', items: [{ title: 'Торренты', btn: {} }], onBack: () => Lampa.Controller.toggle('content') });
  assert.equal(env.selectbox.hasClass('lumen-select'), true);
  assert.equal(kindOf(env), 'source');
});

test('install: после close («Назад») маркер держится; следующий чужой preshow его снимает', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Select.show({ title: 'Действие', items: [{ tomy: true }], onBack: () => Lampa.Controller.toggle('content') });
  Lampa.Select.close();
  assert.equal(env.selectbox.hasClass('lumen-select'), true, 'маркер не снимается во время анимации закрытия');
  assert.equal(kindOf(env), 'torrent');
  Lampa.Select.show({ title: 'Размер интерфейса', items: [{ title: 'Маленький' }] });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(kindOf(env), undefined);
});

test('install: close не подписан (единственный источник истины — preshow)', () => {
  const env = setup();
  env.m.install();
  assert.equal(Lampa.Select.listener.count('close'), 0);
  assert.equal(Lampa.Select.listener.count('hide'), 0);
  assert.equal(Lampa.Modal.listener.count('close'), 0);
});

test('install: фильтр экрана торрентов из контроллера content → filter; вложенный и переоткрытие родителя из onBack → filter', () => {
  const env = setup({ component: 'torrents', controller: 'content' });
  env.m.mode('all');
  env.m.install();
  function showParent() {
    Lampa.Select.show({
      title: 'Фильтр', items: [{ title: 'Качество', items: [{ title: '4K' }] }],
      onBack: () => Lampa.Controller.toggle('content')
    });
  }
  showParent();
  assert.equal(kindOf(env), 'filter');
  assert.equal(env.controller, 'select');
  Lampa.Select.show({ title: 'Качество', items: [{ title: '4K' }], onBack: showParent });
  assert.equal(kindOf(env), 'filter', 'вложенный Select фильтра (контроллер select, корень уже filter)');
  Lampa.Select.close();
  assert.equal(kindOf(env), 'filter', 'родитель, переоткрытый из onBack вложенного');
  assert.equal(env.selectbox.hasClass('lumen-select'), true);
});

for (const ctrl of ['player_panel', 'player', 'menu', 'head', 'settings_component', 'explorer']) {
  test('install: Select из контроллера ' + ctrl + ' поверх активности torrents → без маркера', () => {
    const env = setup({ component: 'torrents', controller: ctrl });
    env.m.mode('all');
    env.m.install();
    Lampa.Select.listener.send('preshow', { active: { title: 'Настройки', items: [{ title: 'Скорость' }] } });
    assert.equal(env.selectbox.hasClass('lumen-select'), false);
    assert.equal(kindOf(env), undefined);
  });
}

/* Ревью 39cb1c0, п.1: мышь/тач (аэромышь) — hover:enter по кнопке фильтра не
   проверяет контроллер. Select фильтра узнаётся по полям пунктов Filter
   (app.min.js 42870–43046: sort у сортировки, stype/reset у фильтра;
   40180–40230: global_search/query у уточнения поиска). */
for (const [ctrl, items] of [
  ['explorer', [{ title: 'По сидам', sort: 'Seeders' }]],
  ['head', [{ title: 'Качество', stype: 'quality', items: [] }, { title: 'Сбросить', reset: true }]],
  ['menu', [{ title: 'Искать везде', global_search: true }, { title: 'Дюна', query: 'Дюна' }]]
]) {
  test('install: Select Filter кликом мышью при контроллере ' + ctrl + ' на torrents → filter', () => {
    const env = setup({ component: 'torrents', controller: ctrl });
    env.m.mode('all');
    env.m.install();
    Lampa.Select.listener.send('preshow', { active: { title: 'Сортировать', items: items } });
    assert.equal(kindOf(env), 'filter');
    assert.equal(env.selectbox.hasClass('lumen-select'), true);
  });
}

test('install: поля Filter вне экрана торрентов → без маркера', () => {
  const env = setup({ component: 'category', controller: 'content' });
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Сортировать', items: [{ title: 'А', sort: 'a' }] } });
  assert.equal(kindOf(env), undefined);
});

test('install: исключение в Activity.active/Controller.enabled не гасит source/file/torrent', () => {
  const env = setup({ component: 'torrents' });
  env.m.mode('all');
  env.m.install();
  Lampa.Activity.active = () => { throw new Error('boom'); };
  Lampa.Controller.enabled = () => { throw new Error('boom'); };
  Lampa.Select.listener.send('preshow', { active: { title: 'Источник', items: [{ btn: {} }] } });
  assert.equal(kindOf(env), 'source');
  Lampa.Select.listener.send('preshow', { active: { title: 'Действие', items: [{ timeclear: true }] } });
  assert.equal(kindOf(env), 'file');
  Lampa.Select.listener.send('preshow', { active: { title: 'Действие', items: [{ unmark: true }] } });
  assert.equal(kindOf(env), 'torrent');
  Lampa.Select.listener.send('preshow', { active: { title: 'Сортировать', items: [{ sort: 'x' }] } });
  assert.equal(kindOf(env), undefined, 'компонент не узнать — не фильтр');
});

test('install: контроллер select без маркера filter на корне (например, после Select источника) → не filter', () => {
  const env = setup({ component: 'torrents', controller: 'select' });
  env.m.mode('all');
  env.m.install();
  env.selectbox.attr('data-lumen-kind', 'source');
  Lampa.Select.listener.send('preshow', { active: { title: 'Плейлист', items: [{ title: '1' }] } });
  assert.equal(kindOf(env), undefined);
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
});

test('install: Select из настроек Lampa на экране торрентов → без маркера', () => {
  const env = setup({ component: 'torrents', controller: 'settings_component' });
  env.m.mode('all');
  env.m.install();
  Lampa.Select.show({ title: 'Выбрать', items: [{ title: 'Да', value: 'true' }] });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(kindOf(env), undefined);
});

test('install: Modal fullshow с .modal-loading → lumen-modal', () => {
  const env = setup();
  env.m.mode('path');
  env.m.install();
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.modal.hasClass('lumen-modal'), true);
});

test('install: Modal fullshow с .torrent-install → lumen-modal', () => {
  const env = setup({ modalContent: 'torrent-install' });
  env.m.mode('all');
  env.m.install();
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.modal.hasClass('lumen-modal'), true);
});

test('install: чужая модалка → без маркера', () => {
  const env = setup({ modalContent: 'about' });
  env.m.mode('all');
  env.m.install();
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.modal.hasClass('lumen-modal'), false);
});

test('install: режим off (и до первого mode, т.е. плагин не активирован) → маркеров нет', () => {
  const env = setup({ component: 'torrents' });
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Источник', items: [{ btn: {} }] } });
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(env.modal.hasClass('lumen-modal'), false);
  env.m.mode('off');
  Lampa.Select.listener.send('preshow', { active: { title: 'Действие', items: [{ timeclear: true }] } });
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(kindOf(env), undefined);
  assert.equal(env.modal.hasClass('lumen-modal'), false);
  assert.deepEqual(menuClasses(env.body), []);
});

test('mode(off) снимает уже поставленные маркеры с открытых корней', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Действие', items: [{ mark: true }] } });
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  env.m.mode('off');
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(kindOf(env), undefined);
  assert.equal(env.modal.hasClass('lumen-modal'), false);
});

test('install: повторный вызов не удваивает подписки', () => {
  const env = setup();
  env.m.install();
  env.m.install();
  assert.equal(Lampa.Select.listener.count('preshow'), 1);
  assert.equal(Lampa.Modal.listener.count('fullshow'), 1);
});

test('install: без Select.listener/Modal.listener и без Lang — предупреждения в лог, без исключений', () => {
  const env = setup();
  delete Lampa.Select.listener;
  delete Lampa.Modal.listener;
  delete Lampa.Lang;
  assert.doesNotThrow(() => env.m.install());
  assert.equal(warnLog.length, 3, 'titles + Select.listener + Modal.listener: ' + warnLog.join(' | '));
});

test('install: ошибка внутри колбэка не пробрасывается наружу', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Activity.active = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => Lampa.Select.listener.send('preshow', { active: { title: 'x', items: [{ title: 'y' }] } }));
  assert.doesNotThrow(() => Lampa.Modal.listener.send('fullshow', null));
});

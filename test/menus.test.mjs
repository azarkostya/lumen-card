import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
import { FakeEl } from './_fakedom.mjs';

/* Task 31: маркеры меню и окон пути TorrServer (src/64_menus.js).
   kind()/isPathModal() — чистые; mode()/install() трогают $('body'),
   Lampa.Select/Modal — здесь всё фейковое: $ отдаёт заранее собранные
   FakeEl по селектору, listener.follow складывает колбэки, send их зовёт
   (как Subscribe в Lampa). */

/* warn() в бандле объявлен в 00_head.js; тестовый загрузчик его не даёт. */
globalThis.warn = function () { };

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
  const env = {
    body: new FakeEl(['body-mock']),
    selectbox: new FakeEl(['selectbox']),
    modal: modalWith(opts.modalContent === undefined ? 'modal-loading' : opts.modalContent),
    component: opts.component || 'full',
    controller: opts.controller || 'content',
    selectOpened: false
  };
  globalThis.$ = function (x) {
    if (x === 'body') return env.body;
    if (x === '.selectbox') return env.selectbox;
    if (x === '.modal') return env.modal;
    return x;
  };
  globalThis.Lampa = {
    Lang: { translate: (k) => ({ settings_rest_source: 'Источник', title_action: 'Действие' })[k] || k },
    Activity: { active: () => ({ component: env.component }) },
    Controller: { enabled: () => ({ name: env.controller }) },
    Select: { listener: makeListener(), render: () => env.selectbox, opened: () => env.selectOpened },
    Modal: { listener: makeListener(), render: () => env.modal }
  };
  env.m = load('64_menus.js');
  return env;
}

function menuClasses(el) { return el._class.filter((c) => c.indexOf('lumen-menus-') === 0); }

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

test('install: preshow источника → lumen-select + data-lumen-kind=source; close → снят', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Источник', items: [{ title: 'Торренты', btn: {} }] } });
  assert.equal(env.selectbox.hasClass('lumen-select'), true);
  assert.equal(env.selectbox.attr('data-lumen-kind'), 'source');
  Lampa.Select.listener.send('close', { active: {} });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(env.selectbox.attr('data-lumen-kind'), undefined);
});

test('install: preshow чужого Select после меню пути → маркер снят, data-lumen-kind пуст', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Действие', items: [{ tomy: true }] } });
  assert.equal(env.selectbox.attr('data-lumen-kind'), 'torrent');
  Lampa.Select.listener.send('preshow', { active: { title: 'Размер интерфейса', items: [{ title: 'Маленький' }] } });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(env.selectbox.attr('data-lumen-kind'), undefined);
});

test('install: close, пока Select снова открыт из onBack (вложенный фильтр) → маркер остаётся', () => {
  const env = setup({ component: 'torrents' });
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Сортировать', items: [{ title: 'По сидам' }] } });
  env.selectOpened = true;
  Lampa.Select.listener.send('close', { active: {} });
  assert.equal(env.selectbox.hasClass('lumen-select'), true);
  assert.equal(env.selectbox.attr('data-lumen-kind'), 'filter');
});

test('install: Select из настроек Lampa на экране торрентов → без маркера', () => {
  const env = setup({ component: 'torrents', controller: 'settings_component' });
  env.m.mode('all');
  env.m.install();
  Lampa.Select.listener.send('preshow', { active: { title: 'Выбор', items: [{ title: 'Да', value: 'true' }] } });
  assert.equal(env.selectbox.hasClass('lumen-select'), false);
  assert.equal(env.selectbox.attr('data-lumen-kind'), undefined);
});

test('install: Modal fullshow с .modal-loading → lumen-modal; close → снят', () => {
  const env = setup();
  env.m.mode('path');
  env.m.install();
  Lampa.Modal.listener.send('fullshow', { active: {}, html: env.modal });
  assert.equal(env.modal.hasClass('lumen-modal'), true);
  Lampa.Modal.listener.send('close', { active: {} });
  assert.equal(env.modal.hasClass('lumen-modal'), false);
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
  assert.equal(env.selectbox.attr('data-lumen-kind'), undefined);
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
  assert.equal(env.selectbox.attr('data-lumen-kind'), undefined);
  assert.equal(env.modal.hasClass('lumen-modal'), false);
});

test('install: повторный вызов не удваивает подписки', () => {
  const env = setup();
  env.m.install();
  env.m.install();
  assert.equal(Lampa.Select.listener.count('preshow'), 1);
  assert.equal(Lampa.Select.listener.count('close'), 1);
  assert.equal(Lampa.Modal.listener.count('fullshow'), 1);
  assert.equal(Lampa.Modal.listener.count('close'), 1);
});

test('install: ошибка внутри колбэка не пробрасывается наружу', () => {
  const env = setup();
  env.m.mode('all');
  env.m.install();
  Lampa.Activity.active = () => { throw new Error('boom'); };
  assert.doesNotThrow(() => Lampa.Select.listener.send('preshow', { active: { title: 'x', items: [{ title: 'y' }] } }));
  assert.doesNotThrow(() => Lampa.Modal.listener.send('fullshow', null));
});

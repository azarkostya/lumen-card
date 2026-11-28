import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { load, loadCtx } from './_load.mjs';

/* Аудит 2026-11-28 (Codex, data-pins-season): сезон раздачи в «Моя раздача».
   Регулярка закрепов не узнавала «5 сезон» и «Сезон: 1» — на 24 названиях с
   ТВ сезон находился в 0 случаях, запись уходила под общий ключ tv:<id>, и
   закреп второго сезона затирал первый. */

const titles = JSON.parse(readFileSync(new URL('./fixtures/release_titles.json', import.meta.url), 'utf8'));
const affair = { id: 6789, original_name: 'The Affair', number_of_seasons: 5 };
const magnet = (c) => 'magnet:?xt=urn:btih:' + c.repeat(40);

function run(store = {}) {
  const card = { component: 'torrents', movie: affair };
  const Lampa = {
    Storage: { get: (k, d) => Object.hasOwn(store, k) ? store[k] : d, set: (k, v) => { store[k] = v; } },
    Activity: { active: () => card },
    Controller: { enabled: () => ({ name: 'content' }), toggle: () => {} }
  };
  globalThis.Lampa = globalThis.window = Lampa;
  globalThis.warn = () => {};
  const { api } = loadCtx('72_pins.js', {
    lang: (k) => k,
    pref: (k, d) => d,
    epparse: load('64_epparse.js'),
    tsclean: load('66_tsclean.js')
  });
  return { P: api, store };
}

/* Закрепить строку списка раздач так, как это делает зритель: удержать OK. */
function pinRow(P, Title, c) {
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { Title, MagnetUri: magnet(c), viewed: true }, menu });
  assert.equal(menu.length, 1, Title);
  assert.equal(menu[0].title, 'lumen_pins_pin', Title);
  menu[0].onSelect();
}

test('сезон закрепа: все 24 названия, снятые с ТВ, — тот же сезон, что у разбора серий', () => {
  const { P } = run();
  assert.equal(titles.tv.length, 24);
  for (const { title, expected } of titles.tv) {
    assert.equal(expected.seasons.length, 1, title);
    assert.equal(P.seasonOf({ Title: title }), expected.seasons[0], title);
  }
});

test('сезон закрепа: только однозначный номер, иначе сезон неизвестен', () => {
  const { P } = run();
  const of = (Title, extra) => P.seasonOf({ Title, ...extra });
  assert.equal(of('Show S02E05 1080p'), 2);
  assert.equal(of('Show S02'), 2);
  assert.equal(of('Show Season 3 WEB-DL'), 3);
  assert.equal(of('Война (2 сезон) WEB-DL 1080p'), 2);
  assert.equal(of('Война / War / Сезон: 2 / Серии: 1-8 из 8'), 2);
  assert.equal(of('Series 04x01-07'), 4);
  assert.equal(of('Show S01-S03 1080p'), 0);
  assert.equal(of('Show S01-03 1080p'), 0);
  assert.equal(of('Сериал [S01-02]'), 0);
  assert.equal(of('Сериал (1-3 сезон) WEB-DL'), 0);
  assert.equal(of('Сериал: 2 сезона WEB-DL'), 0, '«2 сезона» — число сезонов, а не номер');
  assert.equal(of('Series [S02E05] [S03E07]'), 0);
  assert.equal(of('Series (0 сезон: 1-5 серии из 5)'), 0);
  assert.equal(of('Show WEB-DL 1080p'), 0);
  for (const { title } of titles.acceptance) assert.equal(of(title), 0, title);
  /* Явные метаданные раздачи — первыми; противоречие с названием — неизвестно. */
  assert.equal(of('Show WEB-DL', { season: 4 }), 4);
  assert.equal(of('Show (4 сезон: 1-8 серии из 8)', { season: 4 }), 4);
  assert.equal(of('Show (3 сезон: 1-8 серии из 8)', { season: 4 }), 0);
});

test('закреп другого сезона с русским названием не затирает предыдущий', () => {
  const { P, store } = run();
  const season5 = titles.tv.find(({ expected }) => expected.seasons[0] === 5).title;
  const season1 = season5.replace('5 сезон', '1 сезон');
  pinRow(P, season1, 'a');
  pinRow(P, season5, 'b');
  assert.deepEqual(Object.keys(store.lumen_pins).sort(), ['tv:6789:s1', 'tv:6789:s5']);
  assert.equal(P.get(affair, 1).title, season1);
  assert.equal(P.get(affair, 5).title, season5);
  assert.equal(P.get(affair).title, season5, 'без сезона — последний сезон сериала');
  assert.deepEqual(P.protectedHashes(), { ['a'.repeat(40)]: true, ['b'.repeat(40)]: true });
});

test('неизвестный сезон — своя запись: не подменяет закреп сезона и сам им не подменяется', () => {
  const { P, store } = run();
  pinRow(P, 'Любовники (2 сезон: 1-10 серии из 10) / The Affair', 'a');
  pinRow(P, 'The Affair / Любовники WEB-DL 1080p', 'c');
  assert.deepEqual(Object.keys(store.lumen_pins).sort(), ['tv:6789', 'tv:6789:s2']);
  assert.equal(P.get(affair, 2).hash, 'a'.repeat(40), 'у сезона — его собственный закреп');
  assert.equal(P.get(affair, 3).hash, 'c'.repeat(40), 'у сезона без своего закрепа — общий');
  /* Строка с неизвестным сезоном сверяется с общей записью, а не с закрепом
     последнего сезона: отметка «Моя» и пункт «Открепить» — у неё. */
  pinRow(P, 'Любовники (5 сезон: 1-11 серии из 11) / The Affair', 'b');
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { Title: 'The Affair / Любовники WEB-DL 1080p', MagnetUri: magnet('c') }, menu });
  assert.equal(menu[0] && menu[0].title, 'lumen_pins_unpin');
  menu[0].onSelect();
  assert.deepEqual(Object.keys(store.lumen_pins).sort(), ['tv:6789:s2', 'tv:6789:s5']);
  assert.equal(P.get(affair, 3), null);
});

test('закрепы старого формата читаются: общий ключ с сезоном в названии отдан своему сезону', () => {
  /* До правки «5 сезон: …» ложился под tv:<id> без поля season. */
  const old = {
    'tv:6789': { key: 'tv:6789', at: 100, seen: 100, magnet: magnet('e'), link: '', hash: 'e'.repeat(40),
      title: 'Любовники (5 сезон: 1-11 серии из 11) / The Affair / 2019 / ПМ (Amedia) / WEB-DLRip', quality: '', size: 0, seeds: 0 },
    'tv:6789:s2': { key: 'tv:6789:s2', at: 50, seen: 50, magnet: magnet('d'), link: '', hash: 'd'.repeat(40),
      title: 'The Affair S02 1080p', quality: '', size: 0, seeds: 0 },
    'movie:7': { key: 'movie:7', at: 10, seen: 10, magnet: magnet('f'), link: '', hash: 'f'.repeat(40),
      title: 'Film', quality: '', size: 0, seeds: 0 }
  };
  const { P, store } = run({ lumen_pins: JSON.parse(JSON.stringify(old)) });
  assert.equal(P.get(affair, 5).hash, 'e'.repeat(40));
  assert.equal(P.get(affair, 2).hash, 'd'.repeat(40));
  assert.equal(P.get(affair, 1), null, 'закреп пятого сезона не выдаётся за первый');
  assert.equal(P.get(affair).hash, 'e'.repeat(40));
  assert.equal(P.get({ id: 7, title: 'Film' }).hash, 'f'.repeat(40));
  assert.deepEqual(store.lumen_pins, old, 'чтение карту не переписывает');
  /* Отметка «Моя» и открепление старой записи — с её строки списка. */
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { Title: old['tv:6789'].title, MagnetUri: magnet('e') }, menu });
  assert.equal(menu[0].title, 'lumen_pins_unpin');
  /* Новый закреп того же сезона заменяет старую запись, а не живёт рядом с ней. */
  pinRow(P, 'Любовники (5 сезон: 1-11 серии из 11) / The Affair / 2019 / ПМ (TVShows) / WEB-DL (1080p)', 'b');
  assert.deepEqual(Object.keys(store.lumen_pins).sort(), ['movie:7', 'tv:6789:s2', 'tv:6789:s5']);
  assert.equal(P.get(affair, 5).hash, 'b'.repeat(40));
  assert.equal(P.protectedHashes()['e'.repeat(40)], undefined);
});

test('закрепы старого формата: общий ключ без сезона остаётся общим', () => {
  const old = {
    'tv:6789': { key: 'tv:6789', at: 100, seen: 100, magnet: magnet('e'), link: '', hash: 'e'.repeat(40),
      title: 'The Affair Complete WEB-DL', quality: '', size: 0, seeds: 0 }
  };
  const { P, store } = run({ lumen_pins: old });
  assert.equal(P.get(affair, 4).hash, 'e'.repeat(40));
  pinRow(P, 'Любовники (4 сезон: 1-10 серии из 10) / The Affair', 'b');
  assert.deepEqual(Object.keys(store.lumen_pins).sort(), ['tv:6789', 'tv:6789:s4']);
  assert.equal(P.get(affair, 4).hash, 'b'.repeat(40));
  assert.equal(P.get(affair, 3).hash, 'e'.repeat(40));
});

/* Ревью фиксов 2026-11-28: бета до разбора сезонов через epparse клала
   многосезонный пакет под первый номер («tv:<id>:s1»). Сейчас сезон такой
   строки неизвестен (0), и закреп должен находиться перебором записей
   сезонов: отметка «Моя» в списке и «Открепить» по удержанию OK. */
test('старый закреп многосезонного пакета под «:s1» отмечается и открепляется', () => {
  const pack = 'The Affair S01-03 1080p';
  const store = {
    lumen_pins: {
      'tv:6789:s1': { key: 'tv:6789:s1', at: 1, seen: 1, season: 1, magnet: magnet('c'), link: '', hash: 'c'.repeat(40), title: pack, quality: '', size: 0, seeds: 0 }
    }
  };
  const { P } = run(store);
  assert.equal(P.seasonOf({ Title: pack }), 0, 'диапазон сезонов — сезон неизвестен');
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { Title: pack, MagnetUri: magnet('c'), viewed: true }, menu });
  assert.equal(menu.length, 1);
  assert.equal(menu[0].title, 'lumen_pins_unpin', 'старый закреп узнан');
  menu[0].onSelect();
  assert.deepEqual(Object.keys(store.lumen_pins), [], 'снята именно запись «:s1», дубля нет');
});

test('перебор сезонов не выдаёт чужую раздачу за свою', () => {
  const store = {
    lumen_pins: {
      'tv:6789:s1': { key: 'tv:6789:s1', at: 1, seen: 1, season: 1, magnet: magnet('c'), link: '', hash: 'c'.repeat(40), title: 'The Affair S01', quality: '', size: 0, seeds: 0 }
    }
  };
  const { P } = run(store);
  const menu = [];
  P.onTorrent({ type: 'onlong', element: { Title: 'The Affair S01-03 1080p', MagnetUri: magnet('d'), viewed: true }, menu });
  assert.equal(menu[0].title, 'lumen_pins_pin', 'другая раздача — «Закрепить»');
});

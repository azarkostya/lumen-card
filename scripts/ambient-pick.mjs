// scripts/ambient-pick.mjs — заготовка выборки кадров для ambient-режима
// (Task 22 Step 1). Сам по себе ничего не качает: ключа TMDB у репозитория
// нет, а Lampa ходит в TMDB через свой прокси. Поэтому скрипт печатает ТЕКСТ,
// который выполняется в консоли живой Lampa (или через javascript_tool), и
// собирает готовый JSON для LC.manifest.DEFAULT.ambient (src/42_manifest.js).
//
//   node scripts/ambient-pick.mjs           — печатает скрипт для вставки
//   node scripts/ambient-pick.mjs --list    — печатает только список тайтлов
//
// Как это использовалось 2026-09-17 (результат — 82 кадра в DEFAULT.ambient):
//   1) открыть живую Lampa, выполнить напечатанный скрипт (он кладёт прогресс
//      в window.__amb и опрашивается как window.__amb.done / .out);
//   2) дождаться done === total и забрать JSON.stringify(window.__amb.out);
//   3) вставить в DEFAULT.ambient и пересобрать (node scripts/build.mjs —
//      он же обновит manifest.json).
//
// Что отбирается: backdrops с iso_639_1 === null (кадр без текста и логотипов
// на картинке), топ-2 по vote_average среди 4K (width >= 3840); если 4K нет —
// один лучший от 1920. В прогоне 2026-09-17 все 41 позиции отдали 4K, и
// запасная ветка не понадобилась ни разу.

const TITLES = [
  ['movie', 438631, 'Дюна'],
  ['movie', 693134, 'Дюна: Часть вторая'],
  ['movie', 335984, 'Бегущий по лезвию 2049'],
  ['movie', 157336, 'Интерстеллар'],
  ['movie', 872585, 'Оппенгеймер'],
  ['movie', 76600, 'Аватар: Путь воды'],
  ['tv', 82856, 'Мандалорец'],
  ['movie', 120, 'Властелин колец: Братство Кольца'],
  ['movie', 76341, 'Безумный Макс: Дорога ярости'],
  ['movie', 27205, 'Начало'],
  ['movie', 49047, 'Гравитация'],
  ['movie', 286217, 'Марсианин'],
  ['movie', 475557, 'Джокер'],
  ['movie', 530915, '1917'],
  ['movie', 374720, 'Дюнкерк'],
  ['movie', 603, 'Матрица'],
  ['movie', 155, 'Тёмный рыцарь'],
  ['movie', 603692, 'Джон Уик 4'],
  ['movie', 361743, 'Топ Ган: Мэверик'],
  ['movie', 399055, 'Форма воды'],
  ['movie', 313369, 'Ла-Ла Ленд'],
  ['movie', 496243, 'Паразиты'],
  ['movie', 64690, 'Драйв'],
  ['movie', 329865, 'Прибытие'],
  ['movie', 194662, 'Бёрдмэн'],
  ['movie', 120467, 'Отель «Гранд Будапешт»'],
  ['movie', 466272, 'Однажды в Голливуде'],
  ['movie', 118340, 'Стражи Галактики'],
  ['movie', 324857, 'Человек-паук: Через вселенные'],
  ['movie', 129, 'Унесённые призраками'],
  ['movie', 372058, 'Твоё имя'],
  ['movie', 346698, 'Барби'],
  ['movie', 545611, 'Всё везде и сразу'],
  ['movie', 466420, 'Убийцы цветочной луны'],
  ['movie', 792307, 'Бедные-несчастные'],
  ['tv', 106379, 'Фоллаут'],
  ['tv', 95396, 'Разделение'],
  ['tv', 83867, 'Андор'],
  ['tv', 93405, 'Игра в кальмара'],
  ['tv', 100088, 'Одни из нас'],
  ['movie', 37165, 'Шоу Трумана']
];

/* Текст для вставки в живую Lampa. Запросы идут по одному (TMDB через прокси
   Lampa не любит десятки параллельных), прогресс виден в window.__amb. */
function browserScript() {
  return [
    'window.__amb = { done: 0, total: 0, out: [], errors: [] };',
    'var LIST = ' + JSON.stringify(TITLES) + ';',
    'window.__amb.total = LIST.length;',
    'var i = 0;',
    'function step() {',
    '  if (i >= LIST.length) return;',
    '  var item = LIST[i++];',
    "  Lampa.Api.sources.tmdb.get(item[0] + '/' + item[1] + '/images', { filter: { include_image_language: 'null' } }, function (json) {",
    '    try {',
    '      var b = (json && json.backdrops) || [];',
    '      var clean = b.filter(function (x) { return x && x.iso_639_1 === null && x.file_path; });',
    '      var big = clean.filter(function (x) { return x.width >= 3840; })',
    '        .sort(function (a, c) { return (c.vote_average || 0) - (a.vote_average || 0); }).slice(0, 2);',
    '      if (!big.length) big = clean.filter(function (x) { return x.width >= 1920; })',
    '        .sort(function (a, c) { return (c.vote_average || 0) - (a.vote_average || 0); }).slice(0, 1);',
    '      big.forEach(function (x) {',
    '        window.__amb.out.push({ media: item[0], id: item[1], title: item[2], path: x.file_path, width: x.width });',
    '      });',
    "    } catch (e) { window.__amb.errors.push(item[2] + ': ' + e.message); }",
    '    window.__amb.done++;',
    '    step();',
    '  }, function () {',
    "    window.__amb.errors.push(item[2] + ': request failed');",
    '    window.__amb.done++;',
    '    step();',
    '  });',
    '}',
    'step();',
    "'started ' + LIST.length;"
  ].join('\n');
}

if (process.argv.includes('--list')) {
  for (const [media, id, title] of TITLES) console.log(media + '\t' + id + '\t' + title);
} else {
  console.log('/* Выполнить в консоли живой Lampa, затем забрать JSON.stringify(window.__amb.out) */');
  console.log(browserScript());
}

export { TITLES, browserScript };

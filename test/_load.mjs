import { readFileSync } from 'node:fs';
export function load(name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const LC = {}; const module = { exports: null, lumen: true };
  if (name !== '10_util.js') LC.util = load('10_util.js');
  new Function('LC', 'module', src)(LC, module);
  return module.exports;
}
/* loadCtx — как load, но возвращает {api, LC}.
   Позволяет тестам обращаться к LC после загрузки:
   устанавливать LC.pref, LC.reviews и проверять внутренние флаги.
   init — объект с дополнительными свойствами, которые копируются в LC
   до выполнения src (например, {pref: () => ''}). */
export function loadCtx(name, init) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const LC = Object.assign({}, init || {});
  const module = { exports: null, lumen: true };
  if (name !== '10_util.js') LC.util = load('10_util.js');
  new Function('LC', 'module', src)(LC, module);
  return { api: module.exports, LC };
}

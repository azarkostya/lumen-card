import { readFileSync } from 'node:fs';
export function load(name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const LC = {}; const module = { exports: null, lumen: true };
  if (name !== '10_util.js') LC.util = load('10_util.js');
  if (name !== '10_util.js' && name !== '11_focus.js') LC.focus = load('11_focus.js');
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
  /* LC.focus — общий механизм подписки на фокус (src/11_focus.js). Даётся
     так же безусловно, как LC.util: в сборке модуль идёт раньше всех, кто им
     пользуется, и подменять его тестам незачем. */
  if (name !== '10_util.js' && name !== '11_focus.js') LC.focus = load('11_focus.js');
  new Function('LC', 'module', src)(LC, module);
  return { api: module.exports, LC };
}

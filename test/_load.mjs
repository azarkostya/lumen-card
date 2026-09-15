import { readFileSync } from 'node:fs';
export function load(name) {
  const src = readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
  const LC = {}; const module = { exports: null, lumen: true };
  if (name !== '10_util.js') LC.util = load('10_util.js');
  new Function('LC', 'module', src)(LC, module);
  return module.exports;
}

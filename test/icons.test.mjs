import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const icons = load('20_icons.js');
test('все иконки в одном формате', () => {
  for (const name of icons.names()) {
    const svg = icons.get(name);
    assert.match(svg, new RegExp('^<svg viewBox="0 0 24 24" width="1em" height="1em" class="lumen-ico lumen-ico--' + name + '" '));
    // единый стиль экрана 11: контурные — stroke 1.8 round; залитые только play и more
    if (name === 'play' || name === 'more') assert.match(svg, / fill="currentColor"/);
    else assert.match(svg, / fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/);
    assert.ok(svg.endsWith('</svg>'));
  }
});
test('map кнопок Lampa покрыт', () => {
  for (const cls of ['button--play','button--book','button--reaction','button--subscribe','button--options','view--torrent','view--trailer'])
    assert.ok(icons.forButton(cls), cls);
});
test('маска: валидный data-URI без сырых кавычек и решёток, без currentColor', () => {
  for (const name of icons.names()) {
    const url = icons.maskUrl(name);
    assert.match(url, /^url\("data:image\/svg\+xml;charset=utf-8,%3Csvg/);
    const payload = url.slice(url.indexOf(',') + 1, -2);
    assert.ok(!/["#<>]/.test(payload), name + ': неэкранированный символ');
    assert.ok(decodeURIComponent(payload).indexOf('currentColor') === -1, name);
  }
});
test('css: прячет исходный svg и рисует маску, DOM кнопок не трогает', () => {
  const css = icons.css();
  assert.match(css, /\.lumen-card \.full-start__button\.button--play > svg\{display:none !important\}/);
  assert.match(css, /\.lumen-card \.full-start__button\.view--torrent:before\{[^}]*-webkit-mask-image:url\(/);
  assert.match(css, /\[class\*="view--online"\]:before/);
  // все правила ограничены корнем плагина
  for (const rule of css.split('\n')) assert.ok(rule.indexOf('.lumen-card ') === 0, rule);
});
test('модуль не содержит DOM-мутаций кнопок', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/20_icons.js', import.meta.url), 'utf8');
  assert.ok(!/\.(prepend|append|remove|html|replaceWith)\(/.test(src));
});

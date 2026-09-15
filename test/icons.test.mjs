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
test('Task 32: иконки search и check из экспорта экранов 34/35 (сетка 24, контурные)', () => {
  const names = icons.names();
  assert.ok(names.indexOf('search') !== -1, 'нет search');
  assert.ok(names.indexOf('check') !== -1, 'нет check');
  assert.ok(icons.get('search').indexOf('<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>') !== -1);
  assert.ok(icons.get('check').indexOf('<path d="M4.5 12.5l5 5L20 6.5"/></svg>') !== -1);
  assert.match(icons.maskSvg('check'), / fill="none" stroke="#000" stroke-width="1.8"/);
  // новых кнопок карточки не появилось — иконки нужны только экранам пути
  assert.equal(icons.forButton('search'), null);
  assert.equal(icons.forButton('check'), null);
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
  // все правила ограничены корнем плагина: обычная строка начинается с ".lumen-card ",
  // либо это @supports-фолбэк — и тогда все селекторы ВНУТРИ него тоже ".lumen-card …"
  for (const rule of css.split('\n')) {
    if (rule.indexOf('.lumen-card ') === 0) continue;
    assert.ok(rule.indexOf('@supports not (') === 0, rule);
    const body = rule.slice(rule.indexOf('{') + 1, -1);
    const pieces = body.split('}').filter(Boolean);
    assert.ok(pieces.length > 0, rule);
    for (const piece of pieces) {
      const selector = piece.slice(0, piece.indexOf('{'));
      assert.ok(selector.indexOf('.lumen-card ') === 0, selector);
    }
  }
});
test('css: фолбэк без масок реально побеждает по каскаду — тот же селектор, что и основное правило, плюс !important', () => {
  // Проверяем не "текст правила существует", а то, что фолбэк способен выиграть каскад:
  // тот же селектор (та же специфичность), что у основного .../svg{display:none !important}
  // и .../:before{...} — иначе при равном !important побеждает более специфичное основное
  // правило, а фолбэк в @supports not(...) оказывается мёртвым кодом.
  const css = icons.css();
  const supportsIdx = css.indexOf('@supports not (');
  assert.ok(supportsIdx !== -1, 'фолбэк-блок @supports not не найден');
  const block = css.slice(supportsIdx);

  const buttonClasses = ['button--play', 'button--book', 'button--reaction', 'button--subscribe', 'button--options', 'view--torrent', 'view--trailer'];
  const selectors = buttonClasses.map(function (cls) { return '.' + cls; }).concat(['[class*="view--online"]']);

  for (const sel of selectors) {
    const btn = '.lumen-card .full-start__button' + sel;
    assert.ok(block.indexOf(btn + ' > svg{display:block !important}') !== -1, sel + ': нет фолбэка для svg с тем же селектором, что у основного правила');
    assert.ok(block.indexOf(btn + ':before{display:none !important}') !== -1, sel + ': нет фолбэка для :before с тем же селектором и !important');
  }
});
test('модуль не содержит DOM-мутаций кнопок', async () => {
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/20_icons.js', import.meta.url), 'utf8');
  assert.ok(!/\.(prepend|append|remove|html|replaceWith)\(/.test(src));
});

import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stampProblems, tagProblems, remoteTagCommit, tagBuildUrl, loaderVersion } from '../scripts/release.mjs';

/* После 1.2.0 загрузчик с GitHub Pages просит сборку с jsDelivr по тегу
   v<VERSION>. Отсюда три правила выпуска: VERSION в lumen.js = LC.VERSION;
   новая сборка — новая версия (сборку тега jsDelivr кэширует навсегда); тег
   пушится и проверяется (--tag) раньше ветки main, которую отдаёт Pages. */
const read = (p) => { try { return readFileSync(new URL('../' + p, import.meta.url), 'utf8'); } catch (e) { return null; } };

test('релиз по тегу: метка и версия в lumen.js репозитория сходятся с dist и LC.VERSION', () => {
  assert.deepEqual(stampProblems(read), []);
});

test('релиз по тегу: stampProblems ловит VERSION, отставшую от LC.VERSION, и загрузчик без VERSION', () => {
  const files = {
    'src/00_head.js': "  LC.VERSION = '1.3.0';\n",
    'dist/lumen_card.js': read('dist/lumen_card.js'),
    'lumen.js': read('lumen.js').replace(/var VERSION = '[^']*';/, "var VERSION = '1.2.0';")
  };
  const got = stampProblems((p) => (p in files ? files[p] : null));
  assert.equal(got.length, 1, got.join('\n'));
  assert.match(got[0], /VERSION в lumen\.js/);
  files['lumen.js'] = files['lumen.js'].replace(/\n.*var VERSION = '[^']*';/, '');
  assert.equal(loaderVersion(files['lumen.js']), '');
  assert.equal(stampProblems((p) => (p in files ? files[p] : null)).length, 1);
});

test('релиз по тегу: тег с другой сборкой — ошибка «подними LC.VERSION»; тот же dist или нет тега — ok', () => {
  assert.deepEqual(tagProblems('1.2.0', 'dist A', null), []);
  assert.deepEqual(tagProblems('1.2.0', 'dist A', 'dist A'), []);
  const p = tagProblems('1.2.0', 'dist B', 'dist A');
  assert.equal(p.length, 1);
  assert.match(p[0], /тег v1\.2\.0 уже есть.*подними LC\.VERSION/);
});

test('релиз по тегу: коммит тега из git ls-remote — лёгкий, аннотированный (^{}), нет тега', () => {
  const tag = 'refs/tags/v1.3.0';
  assert.equal(remoteTagCommit('aaa111\trefs/tags/v1.3.0\n', tag), 'aaa111');
  assert.equal(remoteTagCommit('bbb222\trefs/tags/v1.3.0\r\nccc333\trefs/tags/v1.3.0^{}\r\n', tag), 'ccc333');
  assert.equal(remoteTagCommit('ddd444\trefs/tags/v1.3.00\n', tag), '');
  assert.equal(remoteTagCommit('', tag), '');
});

/* --tag и --remote сверяют ровно тот адрес, который просит загрузчик: берём
   его из самого lumen.js, запущенного как с Pages. */
test('релиз по тегу: tagBuildUrl — тот же адрес, что первым просит загрузчик с Pages', () => {
  const SRC = read('lumen.js');
  const added = [];
  const doc = {
    currentScript: { src: 'https://azarkostya.github.io/lumen-card/lumen.js?reset=0.5' },
    createElement: () => ({ src: '' }),
    head: { appendChild: (s) => added.push(s) }
  };
  new Function('document', 'window', 'setTimeout', 'clearTimeout', SRC)(doc, {}, () => 1, () => { });
  const build = /var BUILD = '([0-9a-f]+)';/.exec(SRC)[1];
  assert.equal(added[0].src, tagBuildUrl(loaderVersion(SRC), build));
  assert.equal(tagBuildUrl('1.3.0', ''), 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@v1.3.0/dist/lumen_card.js');
});

/* Порядок в README: тег → проверка тега → ветки → сброс jsDelivr → сверка. */
test('релиз по тегу: README — тег пушится раньше main, --tag между ними, потом --purge и --remote', () => {
  const readme = read('README.md');
  const from = readme.indexOf('### Выпуск версии');
  const section = readme.slice(from, readme.indexOf('\n### ', from + 1));
  const at = (needle) => {
    const i = section.indexOf(needle);
    assert.ok(i >= 0, 'в разделе выпуска нет «' + needle + '»');
    return i;
  };
  const order = ['git push origin v<версия>', 'release.mjs --tag --sha', 'git push origin <sha>:main', 'release.mjs --purge', 'release.mjs --remote --sha'].map(at);
  assert.deepEqual(order, order.slice().sort((a, b) => a - b), 'порядок шагов: ' + order.join(', '));
});

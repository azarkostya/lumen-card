import test from 'node:test'; import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stampProblems, tagProblems, remoteTagCommit, tagBuildUrl, loaderVersion, tagDist } from '../scripts/release.mjs';

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

/* Ревью 1.3: «тег этой версии уже есть» — по origin, а не только по
   локальному тегу, и без молчаливого ok, когда сеть недоступна. git —
   подменный: репозиторий-фикстура в памяти, без сети. */
function fakeGit(o) {
  const calls = [];
  const objects = new Set(o.objects || []);
  const git = (args) => {
    calls.push(args.join(' '));
    const [cmd] = args;
    if (cmd === 'rev-parse') {
      if (o.local) return o.local + '\n';
      throw new Error('exit 1');
    }
    if (cmd === 'ls-remote') {
      if (o.offline) {
        const e = new Error('Command failed');
        e.stderr = "fatal: unable to access 'https://github.com/x.git/': Could not resolve host\nmore";
        throw e;
      }
      return o.remote ? 'tagobj\trefs/tags/v1.3.0\n' + o.remote + '\trefs/tags/v1.3.0^{}\n' : '';
    }
    if (cmd === 'cat-file') {
      if (objects.has(args[2].replace('^{commit}', ''))) return '';
      throw new Error('missing');
    }
    if (cmd === 'fetch') {
      if (o.fetchFails) throw new Error('fetch failed');
      objects.add(o.remote);
      return '';
    }
    if (cmd === 'show') {
      const c = args[1].split(':')[0];
      if (!objects.has(c)) throw new Error('bad object ' + c);
      return o.dists[c];
    }
    throw new Error('unexpected git ' + args.join(' '));
  };
  return { git, calls };
}

test('релиз по тегу: tagDist — тег на origin, коммит есть локально: сборка с origin, без fetch', () => {
  const f = fakeGit({ local: 'aaa1111', remote: 'aaa1111', objects: ['aaa1111'], dists: { aaa1111: 'dist A' } });
  const r = tagDist('1.3.0', f.git);
  assert.deepEqual(r, { dist: 'dist A', problems: [], warnings: [] });
  assert.ok(f.calls.includes('ls-remote origin refs/tags/v1.3.0'));
  assert.ok(!f.calls.some((c) => c.indexOf('fetch') === 0));
  assert.deepEqual(tagProblems('1.3.0', 'dist A', r.dist), []);
  assert.equal(tagProblems('1.3.0', 'dist B', r.dist).length, 1);
});

test('релиз по тегу: tagDist — тег только на origin: fetch без тегов и веток, сверка с его сборкой', () => {
  const f = fakeGit({ remote: 'bbb2222', objects: [], dists: { bbb2222: 'dist origin' } });
  const r = tagDist('1.3.0', f.git);
  assert.equal(r.dist, 'dist origin');
  assert.deepEqual([r.problems, r.warnings], [[], []]);
  const fetches = f.calls.filter((c) => c.indexOf('fetch') === 0);
  assert.deepEqual(fetches, ['fetch --no-tags origin refs/tags/v1.3.0'], 'ни локального тега, ни ветки — только объекты');
  assert.match(tagProblems('1.3.0', 'dist new', r.dist)[0], /подними LC\.VERSION/);
});

test('релиз по тегу: tagDist — локальный тег не тот, что на origin: предупреждение, сверка с origin', () => {
  const f = fakeGit({ local: 'ccc3333', remote: 'ddd4444', objects: ['ccc3333', 'ddd4444'], dists: { ccc3333: 'dist local', ddd4444: 'dist origin' } });
  const r = tagDist('1.3.0', f.git);
  assert.equal(r.dist, 'dist origin');
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /ccc3333.*ddd4444/);
});

test('релиз по тегу: tagDist — тега нет на origin: локальный (ещё не запушен) сверяется, нет нигде — ok', () => {
  let r = tagDist('1.3.0', fakeGit({ local: 'eee5555', objects: ['eee5555'], dists: { eee5555: 'dist local' } }).git);
  assert.deepEqual(r, { dist: 'dist local', problems: [], warnings: [] });
  r = tagDist('1.3.0', fakeGit({ objects: [], dists: {} }).git);
  assert.deepEqual(r, { dist: null, problems: [], warnings: [] });
});

test('релиз по тегу: tagDist — origin недоступен: явное предупреждение, а не молчаливый ok', () => {
  let r = tagDist('1.3.0', fakeGit({ offline: true, objects: [], dists: {} }).git);
  assert.equal(r.dist, null);
  assert.equal(r.warnings.length, 1);
  assert.match(r.warnings[0], /origin недоступен \(fatal: unable to access .*Could not resolve host\) — тег v1\.3\.0 на origin НЕ проверен/);
  assert.doesNotMatch(r.warnings[0], /more/, 'только первая строка ошибки git');
  r = tagDist('1.3.0', fakeGit({ offline: true, local: 'fff6666', objects: ['fff6666'], dists: { fff6666: 'dist local' } }).git);
  assert.equal(r.dist, 'dist local', 'локальный тег всё равно сверяется');
  assert.match(r.warnings[0], /сверка только с локальным тегом fff6666/);
});

test('релиз по тегу: tagDist — тег на origin есть, а коммит не получить: расхождение, не ok', () => {
  const r = tagDist('1.3.0', fakeGit({ remote: 'aba1234', fetchFails: true, objects: [], dists: {} }).git);
  assert.equal(r.dist, null);
  assert.equal(r.problems.length, 1);
  assert.match(r.problems[0], /тег v1\.3\.0 уже есть на origin \(aba1234\).*не сверить/);
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

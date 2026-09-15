import test from 'node:test'; import assert from 'node:assert/strict';
import { load } from './_load.mjs';
const u = load('10_util.js');
test('fmtTime: часы → HH:MM, иначе MM:SS', () => {
  assert.equal(u.fmtTime(4320), '01:12');
  assert.equal(u.fmtTime(1120), '18:40');
  assert.equal(u.fmtTime(0), '00:00');
  assert.equal(u.fmtTime(-5), '00:00');
});
test('fmtRuntime', () => { assert.equal(u.fmtRuntime(166, 'мин'), '2:46'); assert.equal(u.fmtRuntime(48, 'мин'), '48 мин'); assert.equal(u.fmtRuntime(0, 'мин'), ''); });
test('plural ru', () => { assert.equal(u.plural(1, ['сезон','сезона','сезонов']), 'сезон'); assert.equal(u.plural(3, ['сезон','сезона','сезонов']), 'сезона'); assert.equal(u.plural(11, ['сезон','сезона','сезонов']), 'сезонов'); assert.equal(u.plural(22, ['серия','серии','серий']), 'серии'); });
test('initials', () => { assert.equal(u.initials('Тимоти Шаламе'), 'ТШ'); assert.equal(u.initials('Zendaya'), 'Z'); assert.equal(u.initials(''), '?'); });
test('esc', () => assert.equal(u.esc('<a href="x">&'), '&lt;a href=&quot;x&quot;&gt;&amp;'));
test('esc: апостроф -> &#39;', () => assert.equal(u.esc("it's a 'test'"), 'it&#39;s a &#39;test&#39;'));
test('each/map/filter/find', () => {
  assert.deepEqual(u.map([1,2,3], x => x * 2), [2,4,6]);
  assert.deepEqual(u.filter([1,2,3], x => x > 1), [2,3]);
  assert.equal(u.find([1,2,3], x => x === 2), 2);
  assert.equal(u.find([1,2,3], x => x === 9), null);
  let n = 0; u.each(null, () => n++); assert.equal(n, 0);
});

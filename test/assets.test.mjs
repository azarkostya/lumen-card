
const fs = await import('node:fs');
const { createHash } = await import('node:crypto');
const { default: assert } = await import('node:assert/strict');
const { default: test } = await import('node:test');
const { runInNewContext } = await import('node:vm');
const root = new URL('../', import.meta.url);

const prefix = 'assets/newyear/v1/';
const assets = {
  'garland-warm-still.webp': [1920, 288, 70000],
  'ornaments-warm.webp': [480, 336, 40000],
  'snowflakes.webp': [256, 64, 12000]
};
for (const style of ['warm', 'cold', 'cold2', 'velvet', 'velvet2', 'velvet3']) {
  if (style !== 'warm') assets['garland-' + style + '-still.webp'] = [1920, 288, 60000];
  for (const group of ['a', 'b']) {
    const file = 'garland-' + style + '-' + group + '.webp';
    assets[file] = [1920, 288, style === 'warm' ? 50000 : 40000];
    assets['half/' + file] = [960, 144, 20000];
  }
}

function rasterSize(data) {
  assert.equal(data.toString('ascii', 0, 4), 'RIFF');
  assert.equal(data.toString('ascii', 8, 12), 'WEBP');
  const type = data.toString('ascii', 12, 16);
  if (type === 'VP8X') return [1 + data.readUIntLE(24, 3), 1 + data.readUIntLE(27, 3)];
  assert.equal(type, 'VP8L', 'для прозрачного файла нужен VP8X или VP8L');
  assert.equal(data[20], 0x2f);
  const packed = data.readUInt32LE(21);
  return [1 + (packed & 0x3fff), 1 + ((packed >>> 14) & 0x3fff)];
}

test('новогодние WebP лежат по релизным адресам, размеры и сетевой бюджет соблюдены', () => {
  for (const [file, [w, h, limit]] of Object.entries(assets)) {
    const data = fs.readFileSync(new URL(prefix + file, root));
    assert.deepEqual(rasterSize(data), [w, h], file);
    assert.ok(data.length <= limit, file + ' превышает лимит');
  }
});

/* В WebP зафиксированы координаты провода и шаров. Снимок покрывает
   три полосы и их A/B-фазы в обоих размерах: все поднимаются вместе. */
test('бархатные WebP составляют согласованный поднятый комплект', () => {
  const hash = createHash('sha256');
  for (const file of Object.keys(assets).filter(name => /garland-velvet/.test(name)).sort()) {
    hash.update(file + '\0');
    hash.update(fs.readFileSync(new URL(prefix + file, root)));
  }
  assert.equal(hash.digest('hex'), 'f7ec670c5b577921308efb7f3848895b3b88e6d237bddd3d91a9fee6f22936d0');
});

test('все новогодние файлы участвуют в выпуске до загрузчика', async () => {
  const { RELEASE_FILES } = await import('../scripts/release.mjs');
  assert.deepEqual(RELEASE_FILES.filter(file => file.startsWith(prefix)).sort(), Object.keys(assets).map(file => prefix + file).sort());
  assert.equal(RELEASE_FILES.at(-1), 'lumen.js');
});

test('ассеты загружаются с того же адреса, что и сборка', () => {
  const head = fs.readFileSync(new URL('src/00_head.js', root), 'utf8') + '\n})();';
  const pages = 'https://azarkostya.github.io/lumen-card/';
  const examples = [
    ['https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@beta/dist/lumen_card.js?v=abc', 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@beta/'],
    ['https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@v1.4.0/dist/lumen_card.js', 'https://cdn.jsdelivr.net/gh/azarkostya/lumen-card@v1.4.0/'],
    [pages + 'dist/lumen_card.js?x', pages],
    ['http://localhost:8767/dist/lumen_card.js', 'http://localhost:8767/'],
    ['https://example.test/lumen.js', pages],
    [null, pages]
  ];
  for (const [src, expected] of examples) {
    const context = { window: {}, document: { currentScript: src && { src } } };
    runInNewContext(head, context);
    assert.equal(context.window.lumen_card.assetUrl(prefix + 'snowflakes.webp'), expected + prefix + 'snowflakes.webp');
  }
});

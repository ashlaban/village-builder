// @suite extended
// VB-1908: the build panel as a yard (page/ui2build), in the new interface (solo, tiny, seed 7). Landed, the farm set to a cottage: the
// first view is the house (its size and its parts) and a tile for each outbuilding (an icon in a ring, one number, a mark), with no
// sentence before a tap: no text node longer than three words. A tap on a tile opens its card (what it takes, what it gives, its stages,
// Build), still without a sentence; the card's "i" opens its words; Build puts it in the plan, and its tile says so.
const { builtPage } = require('./lib/page');
const assert = require('assert'),
  fs = require('fs'),
  path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n';
const html = browserHTML(
  builtPage({ ui2: true }).replace(HOOK, 'window.__yardTest = { get st() { return st; } };\n' + HOOK),
);
assert(html.includes('window.__yardTest'), 'page hook exists');
// the sheet's text nodes of more than three words (a sentence), outside the button labels read by screen readers only
const LONG = () =>
  [...document.querySelectorAll('#u2Sheet *')]
    .flatMap((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent.trim()))
    .filter((t) => t.split(/\s+/).filter(Boolean).length > 3);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1366, height: 800 } }),
      errors = [];
    page.setDefaultTimeout(90000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text());
    });
    await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.route(/https:\/\/(cdn\.jsdelivr\.net|fonts\.)/, (r) =>
      /pixi(\.min)?\.js/.test(r.request().url())
        ? r.fulfill({ contentType: 'application/javascript', body: pixi })
        : r.fulfill({ contentType: 'text/css', body: '' }),
    );
    await page.goto('https://village.test/#ot7');
    await page.waitForFunction(() => document.querySelector('[data-scout]'));
    await page.evaluate(() => document.querySelector('[data-scout]').click());
    await page.waitForFunction(() => document.querySelector('[data-site="settle"]'));
    await page.evaluate(() => document.querySelector('[data-site="settle"]').click());
    await page.waitForFunction(() => document.querySelector('[data-site="begin"]'));
    await page.evaluate(() => document.querySelector('[data-site="begin"]').click());
    await page.evaluate(() => {
      const st = window.__yardTest.st,
        f = st.farmsteads[st.households[st.pawns[st.player.pawn].household].farmstead];
      f.camp = false; // a cottage, with its byre: the rungs as the state derives them (sim/ladder rungOf)
      f.booth = false;
      VB['sim/facilities'].seedOn(st, f, 'byre'); // VB-1911: a facility of the farm
      document.querySelector('[data-tab="build"]').click();
    });
    await page.waitForFunction(() => document.querySelector('#u2Sheet .u2-tiles'));
    const first = await page.evaluate(
      (long) => ({
        tiles: [...document.querySelectorAll('#u2Sheet .u2-tile')].map(
          (t) => `${t.dataset.what}:${t.className.split(' ')[1]}`,
        ),
        parts: [...document.querySelectorAll('#u2Sheet .u2-part')].map(
          (t) => `${t.dataset.what}:${t.className.split(' ')[1]}`,
        ),
        rings: document.querySelectorAll('#u2Sheet .u2-tile .u2-ring svg').length,
        numbers: document.querySelectorAll('#u2Sheet .u2-tile .u2-fact b').length,
        sizes: document.querySelectorAll('#u2Sheet .u2-sizes i.on').length,
        long: eval(long)(),
      }),
      `(${LONG})`,
    );
    assert.deepStrictEqual(
      first.tiles,
      ['storehouse:can', 'barn:can', 'byre:has'],
      'a tile for each outbuilding, as it stands',
    );
    assert.deepStrictEqual(
      first.parts,
      ['timber:can', 'foundation:can'],
      "the house's parts: the farmhouse and the foundation",
    );
    assert.strictEqual(first.rings, 3, 'each tile its icon in a ring');
    assert.strictEqual(first.numbers, 3, 'each tile one number');
    assert.strictEqual(first.sizes, 2, 'a cottage: the second size of three');
    assert.deepStrictEqual(first.long, [], 'no sentence in the first view');
    await page.evaluate(() => document.querySelector('#u2Sheet [data-hud="yard"][data-what="barn"]').click());
    await page.waitForFunction(() => document.querySelector('#u2Sheet .u2-ycard'));
    const card = await page.evaluate(
      (long) => ({
        chips: document.querySelectorAll('#u2Sheet .u2-ycard .u2-facts .u2-fact').length,
        stages: document.querySelectorAll('#u2Sheet .u2-ycard .u2-stages span').length,
        build: !!document.querySelector('#u2Sheet .u2-ycard [data-hud="upgrade"][data-what="barn"]'),
        long: eval(long)(),
      }),
      `(${LONG})`,
    );
    assert.deepStrictEqual(
      card,
      { chips: 4, stages: 3, build: true, long: [] },
      "the barn's card: gives, takes, stages, Build; no sentence",
    );
    await page.evaluate(() => document.querySelector('#u2Sheet .u2-ycard .u2-i').click());
    await page.waitForFunction(() => document.querySelector('#u2Sheet .u2-ycard .u2-pinfo'));
    const words = await page.evaluate((long) => eval(long)(), `(${LONG})`);
    assert(
      words.some((t) => /hay/i.test(t)) && words.some((t) => /stages/.test(t)),
      `the card's "i" opens its words: ${words}`,
    );
    await page.evaluate(() => document.querySelector('#u2Sheet .u2-ycard [data-hud="upgrade"]').click());
    await page.waitForFunction(() => document.querySelector('#u2Sheet .u2-tile.plan[data-what="barn"]'));
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(
      `browser-yard: tiles ${first.tiles.join(', ')}, parts ${first.parts.join(', ')}; the barn's card, its words, Build`,
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

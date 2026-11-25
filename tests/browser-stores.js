// VB-092: the Stores panel. A village's card opens it as a table of the village's households, their total and the village's own store;
// a household's Stores tab opens it for that household; a household's row selects its farm, as clicking the farm does.
const { builtPage } = require('./lib/page');
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
const rawHTML = builtPage().replace(HOOK, HOOK + ' window.__storesTest = { get st() { return st; }, get selFarm() { return selFarm; }, '
  + 'village(id) { selectVillage(id, false); }, farm(id) { selectFarm(id, false); } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__storesTest'), 'page hook exists');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } }), errors = [];
    page.setDefaultTimeout(60000);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.route(/https:\/\/(cdn\.jsdelivr\.net|fonts\.)/, (r) => /pixi(\.min)?\.js/.test(r.request().url())
      ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto('https://village.test/');
    await page.waitForFunction(() => !document.getElementById('landing').hidden); await page.click('#landNew');
    await page.click('[data-sc="founders"]'); await page.selectOption('#genSize', 't'); await page.fill('#genSeed', '7');
    await page.locator('#genForm').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
    await page.click('#chooseWatch'); await page.click('[data-speed="0"]');
    await page.waitForFunction(() => window.__storesTest.st);
    // the village's card: its button opens the panel, a row a household, the total and the village's store
    const want = await page.evaluate(() => {
      const st = window.__storesTest.st, v = st.villages.findIndex((x) => x.farmsteads.filter((f) => st.farmsteads[f].household !== null).length >= 2);
      window.__storesTest.village(v);
      return { v, n: st.villages[v].farmsteads.filter((f) => st.farmsteads[f].household !== null).length };
    });
    assert(want.v >= 0, 'a village of two households or more');
    await page.evaluate((v) => document.querySelector(`#tile [data-stores-village="${v}"]`).click(), want.v); // the card may show it folded
    await page.waitForFunction(() => !document.getElementById('drawer').hidden && document.querySelector('#drawerBody table.stores'));
    const shown = await page.evaluate(() => ({
      title: document.getElementById('drawerTitle').textContent,
      rows: document.querySelectorAll('#drawerBody tbody tr.household').length,
      total: document.querySelectorAll('#drawerBody tfoot tr.total').length,
      village: document.querySelectorAll('#drawerBody tfoot tr.village').length,
      heads: [...document.querySelectorAll('#drawerBody thead th')].map((t) => t.textContent),
    }));
    assert.strictEqual(shown.title, 'Stores');
    assert.deepStrictEqual([shown.rows, shown.total, shown.village], [want.n, 1, 1], `rows: ${JSON.stringify(shown)}`);
    assert(shown.heads.includes('Grain'), 'a grain column');
    // a household's row selects its farm
    const farm = await page.evaluate(() => +document.querySelector('#drawerBody [data-stores-farm]').dataset.storesFarm);
    await page.click('#drawerBody [data-stores-farm]');
    await page.waitForFunction((f) => window.__storesTest.selFarm === f && !document.getElementById('tile').hidden, farm);
    assert(await page.evaluate(() => document.getElementById('drawer').hidden), 'the card replaces the panel');
    // the household's Stores tab: its button opens the panel for that household alone
    const hh = await page.evaluate((f) => window.__storesTest.st.farmsteads[f].household, farm);
    await page.evaluate(() => document.getElementById('tabStores').click()); // the card's Stores tab
    await page.waitForSelector(`#tile [data-stores-household="${hh}"]`, { state: 'attached' });
    await page.evaluate((h) => document.querySelector(`#tile [data-stores-household="${h}"]`).click(), hh);
    await page.waitForFunction(() => !document.getElementById('drawer').hidden && document.querySelector('#drawerBody table.stores'));
    const one = await page.evaluate(() => ({
      rows: document.querySelectorAll('#drawerBody tbody tr.household').length,
      foot: document.querySelectorAll('#drawerBody tfoot tr').length,
      wider: !!document.querySelector('#drawerBody [data-stores-village]'),
    }));
    assert.deepStrictEqual(one, { rows: 1, foot: 0, wider: true }, 'a household: its row alone, and a way to its village');
    assert.deepStrictEqual(errors, [], 'no page errors');
    console.log(`browser-stores: village ${want.v}, ${want.n} households, columns ${shown.heads.slice(1).join(', ')}; a row selects its farm`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

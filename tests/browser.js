// Browser smoke test: loads index.html in real Chromium (Playwright), PixiJS served from node_modules in place of the CDN.
// Generates a Tiny Populous Villages map, skips a year, opens each panel, and fails on any console or page error. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('BROWSER FAIL:', m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({
    contentType: 'text/html', body: browserHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace('app.ticker.add((tk) => {', 'app.ticker.maxFPS = 12; app.ticker.add((tk) => {')),
  }));
  await page.goto('https://village.test/');
  await page.waitForFunction(() => !document.getElementById('genScreen').hidden, null, { timeout: 60000 });
  await page.evaluate(() => {
    document.getElementById('genScenario').value = 'populous'; document.getElementById('genSize').value = 't'; document.getElementById('genSeed').value = '7';
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  await page.click('#debugBtn');
  await page.click('[data-act="skip1"]');
  await page.waitForFunction(() => document.getElementById('dbgMsg').textContent.startsWith('Skipped'), null, { timeout: 90000 });
  await page.click('#debugBtn');
  for (const id of ['landBtn', 'settlersBtn', 'customsBtn', 'treeBtn', 'landBtn']) {
    await page.click('#' + id); await page.waitForTimeout(500);
    if (id === 'treeBtn') await page.click('#treeClose');
  }
  // the History tab (VB-099) of a village, a farm and a pawn, with each filter by kind
  await page.click('#settlersBtn'); await page.click('#settlers .village-block > summary'); await page.click('#settlers [data-village]');
  for (const next of [null, '#tileList [data-farm]', '#tileList [data-pawn]']) {
    if (next) { await page.click('#tabFacts'); await page.click(next); }
    await page.click('#tabHistory'); await page.waitForSelector('#historyList time');
    for (const kind of await page.$$('#historyKinds button')) await kind.click();
    await page.click('#historyKinds [data-history=""]');
  }
  await page.waitForTimeout(1000);
  await browser.close();
  if (errors.length) { console.log(`browser: ${errors.length} error(s)`); process.exit(1); }
  console.log('browser: no console or page errors (generate, skip a year, land on, settlers, customs, tree, land off, the History tab of a village, a farm and a pawn)');
})().catch((e) => { console.error(e); process.exit(1); });

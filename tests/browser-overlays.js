// @suite extended
// VB-1496: the map's overlays, driven by their registry (page/overlays): each on and off through the overlay button's list and by its key,
// one at a time (never two layers or two keys shown), 0 for none, [ and ] to step; the list stays open after a choice and shuts on Esc,
// on its button, on a press on the map and when the bell's list opens; on a phone it fits the screen. No console error.
// VB_SHOTS=DIR saves screenshots of the bar, shut and open, in the default and mural themes and on a phone (never into the repository).
const { builtPage } = require('./lib/page');
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null,\n  speed = 1,\n  selPawn = -1;';
const rawHTML = builtPage().replace(HOOK, HOOK + ' window.__ov = { list: () => OVERLAYS.map((o) => ({ id: o.id, key: o.key })), '
  + 'on: () => overlayOn && overlayOn.id, layers: () => OVERLAYS.filter((o) => o.layer.visible).map((o) => o.id), '
  + 'keys: () => OVERLAYS.filter((o) => !o.keyEl.hidden).map((o) => o.id), theme: (k) => setTheme(k), '
  // VB-1581: the tile card's lines on water (page/water) for the first tile of a kind
  + 'water: () => { const of = (f) => { for (let i = 0; i < w.N; i++) if (f(i)) return waterLines(i); return null; }; '
  + 'return { river: of((i) => w.river[i] > 0), lake: of((i) => w.fresh[i] === 1), sea: of((i) => w.ocean[i] === 1), '
  + 'far: of((i) => !w.water[i] && !w.fresh[i] && w.freshWalk[i] > 1 && w.freshWalk[i] < Infinity && w.waterDepth[i] < Infinity), '
  + 'peak: of((i) => !w.water[i] && !w.fresh[i] && w.waterDepth[i] === Infinity) }; } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__ov'), 'page hook exists');
const shots = process.env.VB_SHOTS;
async function open(browser, opts) {
  const page = await browser.newPage(opts), errors = [];
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
  await page.click('#choosePlay');
  await page.evaluate(() => document.querySelector('[data-speed="0"]').click()); // paused (on a phone the speeds are folded away)
  await page.evaluate(() => { const b = document.querySelector('#tile [data-panel-close], #tileClose'); if (b) b.click(); });
  return { page, errors };
}
const shot = async (page, name) => { if (shots) await page.screenshot({ path: path.join(shots, `overlays-${name}.png`) }); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  try {
    const { page, errors } = await open(browser, { viewport: { width: 1440, height: 900 } });
    const ov = await page.evaluate(() => window.__ov.list());
    assert(ov.length >= 3, `the registry holds the overlays: ${JSON.stringify(ov)}`);
    const state = () => page.evaluate(() => ({ on: window.__ov.on(), layers: window.__ov.layers(), keys: window.__ov.keys(),
      pressed: document.getElementById('overlayBtn').classList.contains('on'),
      checked: [...document.querySelectorAll('#overlayList [aria-checked="true"]')].map((b) => b.dataset.overlay),
      open: !document.getElementById('overlayPop').hidden }));
    const showing = async (id, how) => {
      const s = await state();
      if (id) assert.deepStrictEqual([s.on, s.layers, s.keys, s.checked, s.pressed], [id, [id], [id], [id], true], `${how}: ${id} alone shows: ${JSON.stringify(s)}`);
      else assert.deepStrictEqual([s.on, s.layers, s.keys, s.checked, s.pressed], [null, [], [], [], false], `${how}: none shows: ${JSON.stringify(s)}`);
      return s;
    };
    await showing(null, 'at the start');
    { // VB-1581: the tile card names the tile's source, or the nearest and the walk, and the well's band with its hours, never the metres
      const wl = await page.evaluate(() => window.__ov.water()), said = JSON.stringify(wl);
      assert(wl.river && wl.river.length === 1 && /^Fresh water: a (brook|stream|river)$/.test(wl.river[0]), `a river's tile names its water: ${said}`);
      assert.deepStrictEqual([wl.lake, wl.sea], [['Fresh water: a lake'], []], `a lake is fresh water, the sea none: ${said}`);
      assert(wl.far && /^Fresh water: a (lake|brook|stream|river), .+ away on foot$/.test(wl.far[0]) && /^A well here: (shallow|middling|deep), \d+ to \d+ hours of digging$/.test(wl.far[1]), `inland: the nearest, the walk and the well's band: ${said}`);
      assert(wl.peak && wl.peak.includes('No well can be dug here') && !/\d m\b|metre/.test(said), `no well is said, and no metres anywhere: ${said}`);
    }
    await shot(page, 'shut');
    // the list: a row each, built from the registry, its name and its key; a choice keeps it open; the row on again puts the overlay away
    await page.click('#overlayBtn');
    assert.strictEqual(await page.getAttribute('#overlayBtn', 'aria-expanded'), 'true');
    const rows = await page.$$eval('#overlayList [role="radio"]', (bs) => bs.map((b) => ({ id: b.dataset.overlay, kbd: b.querySelector('kbd') && b.querySelector('kbd').textContent, name: b.textContent })));
    assert.deepStrictEqual(rows.map((r) => r.id), ov.map((o) => o.id), 'a row for each overlay, in the registry\'s order');
    for (const [k, r] of rows.entries()) assert.strictEqual(r.kbd, ov[k].key.toUpperCase(), `the row of ${r.id} names its key`);
    for (const o of ov) {
      await page.click(`#overlayList [data-overlay="${o.id}"]`); await page.waitForTimeout(300);
      assert((await showing(o.id, 'through the list')).open, 'the list stays open after a choice');
      if (o === ov[0]) await shot(page, 'open');
    }
    await page.click(`#overlayList [data-overlay="${ov[ov.length - 1].id}"]`);
    assert((await showing(null, 'the row on again')).open);
    // the arrows move between the rows
    await page.focus(`#overlayList [data-overlay="${ov[0].id}"]`); await page.keyboard.press('ArrowDown');
    assert.strictEqual(await page.evaluate(() => document.activeElement.dataset.overlay), ov[1].id, 'ArrowDown moves to the next row');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    await showing(ov[0].id, 'Enter on a row');
    // mural: the list and the button styled as the bar's
    await page.evaluate(() => window.__ov.theme('mural')); await page.waitForTimeout(200); await shot(page, 'mural-open');
    await page.keyboard.press('Escape');
    assert(!(await state()).open && await page.locator('#landing').isHidden(), 'Esc shuts the list, and only the list');
    await shot(page, 'mural-shut');
    await page.evaluate(() => window.__ov.theme('glass'));
    await page.click('#overlayBtn'); await page.click('#overlayBtn'); assert(!(await state()).open, 'its button shuts the list');
    await page.click('#overlayBtn'); await page.mouse.click(500, 400); assert(!(await state()).open, 'a press on the map shuts the list');
    await page.click('#overlayBtn'); await page.click('#noticeBtn');
    assert(!(await state()).open && await page.locator('#noticePop').isVisible(), 'the bell\'s list and the overlays\' are never both open');
    await page.click('#overlayBtn'); assert(await page.locator('#noticePop').isHidden(), 'nor the other way round');
    await page.click('#overlayBtn');
    // by key, with the list shut: each overlay's letter or digit, again for none, 0 for none, [ and ] step and wrap
    await page.mouse.move(500, 400); await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('0'); await showing(null, '0');
    for (const o of ov) {
      await page.keyboard.press(o.key); await page.waitForTimeout(200); await showing(o.id, `key ${o.key}`);
      assert.strictEqual(await page.getAttribute(`#${o.id}Btn`, 'aria-keyshortcuts'), o.key);
    }
    await page.keyboard.press(ov[ov.length - 1].key); await showing(null, 'the key of the overlay on');
    await page.keyboard.press(ov[0].key); await page.keyboard.press('0'); await showing(null, '0');
    await page.keyboard.press(']'); await showing(ov[0].id, '] with none on');
    for (let k = 1; k <= ov.length; k++) { await page.keyboard.press(']'); await page.waitForTimeout(100); await showing(ov[k % ov.length].id, ']'); }
    await page.keyboard.press('['); await showing(ov[ov.length - 1].id, '[ wraps');
    await page.keyboard.press('['); await showing(ov[ov.length - 2].id, '[');
    await page.keyboard.press('0'); await showing(null, '0');
    // the speeds keep their digits
    await page.keyboard.press('2'); assert.strictEqual(await page.getAttribute('[data-speed="3"]', 'aria-pressed'), 'true', 'the digit 2 is still 3x');
    await page.evaluate(() => document.querySelector('[data-speed="0"]').click());
    assert.deepStrictEqual(errors, [], 'no console error');
    await page.close();
    // a phone: the list over the minimap fits the screen, rows 44px high
    const phone = await open(browser, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    await phone.page.click('#minimapBtn'); await phone.page.click('#overlayBtn');
    await phone.page.click(`#overlayList [data-overlay="${ov[0].id}"]`); await phone.page.waitForTimeout(300);
    const box = await phone.page.locator('#overlayPop').boundingBox(), row = await phone.page.locator(`#${ov[0].id}Btn`).boundingBox();
    assert(box.x >= 0 && box.x + box.width <= 390 && box.y >= 0, `the list fits a phone: ${JSON.stringify(box)}`);
    assert(row.height >= 44, `a row is 44px high on a phone: ${row.height}`);
    await shot(phone.page, 'phone-open');
    await phone.page.click('#overlayBtn'); await shot(phone.page, 'phone-shut');
    assert.deepStrictEqual(phone.errors, [], 'no console error on a phone');
    console.log(`overlays ok: ${ov.map((o) => `${o.id} (${o.key})`).join(', ')}; through the list, by key, [ and ], on a phone`);
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exit(1); });

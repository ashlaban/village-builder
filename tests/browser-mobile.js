// Mobile interaction regression: panels, folds, search, UI restoration and map gestures in real Chromium.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const rawHTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('let st = null, speed = 1, selPawn = -1;',
  'let st = null, speed = 1, selPawn = -1; window.__mobile = { get st() { return st; }, get speed() { return speed; }, '
  + 'get cam() { return { ...cam }; }, get selected() { return selPawn; }, card, selectPawn, '
  + 'village() { app.ticker.maxFPS = 12; stopIntro(); const i = st.villages[0].center; cam.x = w.hx[i]; cam.y = w.hy[i]; cam.z = zt = 0.8; vel.x = vel.y = 0; } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__mobile'), 'page hook exists');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    page.setDefaultTimeout(60000);
    const errors = [];
    page.on('console', (m) => { if (m.type() === 'error') console.error('PAGE:', m.text()); });
    page.on('pageerror', (e) => errors.push(e.stack));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: html }));
    await page.route(/https:\/\/(cdn\.jsdelivr\.net|fonts\.)/, (r) => /pixi(\.min)?\.js/.test(r.request().url())
      ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
    await page.goto('https://village.test/', { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.waitForFunction(() => !document.getElementById('landing').hidden); await page.click('#landNew');
    await page.selectOption('#genSize', 't'); await page.selectOption('#genScenario', 'founders'); await page.fill('#genSeed', '7');
    await page.click('#genGo');
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
    await page.click('#pauseBtn');
    await page.evaluate(() => window.__mobile.village());
    const fits = async (selector) => {
      const rect = await page.locator(selector).boundingBox(), size = page.viewportSize();
      assert(rect && rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= size.width + 1 && rect.y + rect.height <= size.height + 1,
        `${selector} fits ${size.width}×${size.height}: ${JSON.stringify(rect)}`);
    };
    const oneSheet = async () => assert(await page.locator('.sheet:visible').count() <= 1, 'one content panel at a time');
    const capture = async (name) => {
      if (!process.env.VB_SCREENSHOTS) return;
      fs.mkdirSync(process.env.VB_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.VB_SCREENSHOTS, name + '.png') });
    };
    assert((await page.locator('#clock').boundingBox()).y + (await page.locator('#clock').boundingBox()).height < 115, 'compact mobile header');
    await fits('.navigation'); await capture('mobile-map');
    // VB-338: no name in play; the speed picker opens over the notifications, its six icons in one row
    assert(await page.locator('#name').isHidden(), 'the archipelago name is not shown in play');
    await page.evaluate(() => { const t = document.createElement('button'); t.className = 'toast panel'; t.id = 'fakeToast';
      t.textContent = 'A notification long enough to run under the whole of the speed picker, as three at once do.';
      document.getElementById('toasts').append(t); });
    await page.click('#speedBtn'); await fits('#speedOptions');
    const covered = await page.locator('#speedOptions button').evaluateAll((bs) => bs.filter((b) => {
      const r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return !(hit && b.contains(hit));
    }).length);
    assert.strictEqual(covered, 0, 'every speed in the picker is on top of the notifications');
    const rows = await page.locator('#speedOptions button').evaluateAll((bs) => new Set(bs.map((b) => Math.round(b.getBoundingClientRect().y))).size);
    assert.strictEqual(rows, 1, 'the speeds lie in one row');
    await page.click('#speedBtn'); await page.evaluate(() => document.getElementById('fakeToast').remove());
    // VB-338: the dock's buttons are icons with their names under them; the panels' Close and fold are icons with accessible names
    const dock = await page.locator('.navigation button:visible').evaluateAll((bs) => bs.map((b) => [!!b.querySelector('svg'),
      b.querySelector('.nav-label') && b.querySelector('.nav-label').getBoundingClientRect().height > 0]));
    assert(dock.length >= 4 && dock.every(([icon, label]) => icon && label), `the dock's buttons have an icon and a label: ${JSON.stringify(dock)}`);
    const heads = await page.locator('[id$="Close"].icon-btn, .sheet-expand').evaluateAll((bs) => bs.filter((b) => !b.querySelector('svg')
      || !b.getAttribute('aria-label') || b.textContent.trim()).map((b) => b.id || b.dataset.sheet));
    assert.deepStrictEqual(heads, [], 'each Close and fold is an icon with an accessible name and no text');
    console.log('mobile: people'); await page.click('#settlersBtn'); await oneSheet();
    await page.locator('.village-block > summary').first().click(); console.log('mobile: village opened');
    await page.locator('.household-block > summary').first().click(); console.log('mobile: household opened');
    await page.locator('[data-fold^="supplies-"] > summary').first().click();
    await page.locator('[data-fold^="fields-"] > summary').first().click();
    await page.locator('[data-fold^="fields-"][open] .jobs').first().waitFor({ state: 'visible' });
    const key = await page.locator('.household-block').first().getAttribute('data-fold');
    await page.locator('#peopleContent').evaluate((el) => { el.scrollTop = 80; });
    const scroll = await page.locator('#peopleContent').evaluate((el) => el.scrollTop);
    await page.waitForTimeout(600);
    assert.strictEqual(await page.locator('#peopleContent').evaluate((el) => el.scrollTop), scroll, 'live refresh keeps scroll');
    assert(await page.locator(`[data-fold="${key}"]`).evaluate((el) => el.open), 'live refresh keeps household open');
    const animals = page.locator('.household-block[open] [data-fold^="animals-"]').first();
    await animals.locator('summary').click();
    await page.waitForFunction(() => /Hay \d+, \d+ spoilt/.test(
      document.querySelector('.household-block[open] [data-fold^="animals-"]').textContent));
    assert.match(await animals.textContent(), /Hay \d+, \d+ spoilt/, 'household shows cumulative hay spoilage');
    const name = await page.locator('.household-block button[data-pawn]').first().textContent();
    console.log('mobile: search'); await page.fill('#peopleSearch', 'no-such-person'); assert(await page.locator('#settlers').textContent().then((t) => t.includes('No matching')));
    await page.fill('#peopleSearch', name); assert(await page.locator('.household-block button[data-pawn]').count() > 0, 'search finds person');
    await page.fill('#peopleSearch', '');
    assert(await page.locator(`[data-fold="${key}"]`).evaluate((el) => el.open), 'clearing search restores folds');
    await page.locator('.household-block button[data-pawn]').first().click();
    await oneSheet(); assert(await page.locator('#tile').isVisible());
    assert(await page.locator('#peopleSheet').isHidden(), 'selecting a person clears the list');
    assert(await page.locator('#tileActivity').textContent(), 'current activity remains visible while collapsed');
    const selected = await page.evaluate(() => window.__mobile.selected);
    await page.click('#tile .sheet-expand'); await fits('#tile'); await capture('mobile-person');
    // Playing a pawn (VB-210): the played pawn's part of the card fits the phone and its buttons work
    console.log('mobile: play'); await page.click('#debugBtn'); await page.click('[data-act="play"]');
    await page.locator('#playBox [data-play="auto"]').waitFor({ state: 'visible' }); await fits('#actionSheet');
    const over = await page.locator('#playBox button').evaluateAll((bs) => bs.filter((b) => b.getBoundingClientRect().right > innerWidth + 1).length);
    assert.strictEqual(over, 0, 'the buttons of the played pawn fit the phone');
    await page.click('#playBox [data-play="auto"]');
    await page.waitForFunction(() => /off/.test(document.querySelector('#playBox [data-play="auto"]').textContent));
    assert.strictEqual(await page.evaluate(() => window.__mobile.st.player.auto), false, 'the switch turns the automatic behaviour off');
    await capture('mobile-play');
    await page.click('#debugBtn'); await page.click('[data-act="unplay"]');
    await page.waitForFunction(() => document.getElementById('actionsBtn').hidden); assert.strictEqual(await page.evaluate(() => window.__mobile.st.player), null, 'Stop playing leaves no pawn played');
    // The shared card used to discard every detail after the fourth line.
    await page.evaluate(() => window.__mobile.card('Full details', ['one', 'two', 'three', 'four', 'five', 'six']));
    assert.strictEqual(await page.locator('#tileRest').textContent(), 'fivesix');
    await page.evaluate((id) => window.__mobile.selectPawn(id), selected);
    await page.click('#speedBtn'); await page.click('[data-speed="3"]');
    const eye = await page.locator('#uiToggle').boundingBox();
    await page.click('#uiToggle');
    assert(await page.locator('#tile').isHidden()); assert(await page.locator('.navigation').isHidden()); assert(await page.locator('#clock').isHidden());
    assert.deepStrictEqual(await page.locator('#uiToggle').boundingBox(), eye, 'the eye stays in its place with the interface hidden');
    const time = await page.evaluate(() => window.__mobile.st.t);
    await page.waitForFunction((t) => window.__mobile.st.t > t, time);
    await page.click('#uiToggle'); assert(await page.locator('#tile').isVisible(), 'UI restores selected panel');
    assert.strictEqual(await page.evaluate(() => window.__mobile.selected), selected);
    assert.strictEqual(await page.evaluate(() => window.__mobile.speed), 3, 'UI toggle preserves speed');
    await page.click('#pauseBtn');
    console.log('mobile: customs'); await page.click('#customsBtn'); await oneSheet(); await fits('#drawer');
    assert(await page.locator('.custom-card').count() > 0, 'village customs shown as cards');
    if (await page.locator('#customVillage option').count() > 1) await page.selectOption('#customVillage', { index: 1 });
    await page.locator('#customComparison > summary').click();
    await page.locator('.cust tbody tr').first().waitFor({ state: 'visible' });
    await page.focus('#customTable');
    await page.locator('#customTable').evaluate((el) => { el.scrollLeft = 0; });
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.getElementById('customTable').scrollLeft > 0);
    await page.click('#drawer .sheet-expand');
    assert(await page.locator('#drawerBody').isHidden());
    assert.strictEqual(await page.getAttribute('#drawer .sheet-expand', 'aria-label'), 'Expand', 'a folded panel offers to expand');
    await page.click('#drawer .sheet-expand');
    assert(await page.locator('#drawerBody').isVisible());
    assert.strictEqual(await page.getAttribute('#drawer .sheet-expand', 'aria-label'), 'Collapse', 'an open panel offers to collapse');
    console.log('mobile: family'); await page.click('#treeBtn');
    assert(await page.locator('#tree').isVisible()); await fits('.tree-card');
    await page.locator('#treeSvg .tn').first().click();
    assert(await page.locator('#treeInfo h3').textContent());
    await page.keyboard.press('Escape'); assert(await page.locator('#tree').isHidden()); console.log('mobile: family closed');
    // VB-338: the map's bar under the minimap; shut, only the minimap's toggle stays; open, the minimap, the layers and the bell
    const onlyToggle = async () => await page.locator('#minimap').isHidden() && await page.locator('#landBtn').isHidden()
      && await page.locator('#noticeBtn').isHidden() && await page.locator('#minimapBtn').isVisible();
    assert(await onlyToggle(), 'a phone opens with the minimap shut, its toggle alone shown');
    await page.click('#minimapBtn'); assert(await page.locator('#minimap').isVisible()); await fits('#mapTools');
    assert(await page.locator('#mmBase').evaluate((c) => c.width > 0 && c.height > 0), 'the minimap has a painted canvas');
    assert.strictEqual(await page.locator('.map-bar button:visible').last().getAttribute('id'), 'minimapBtn', 'the toggle ends the bar');
    await page.click('#landBtn'); assert.strictEqual(await page.getAttribute('#landBtn', 'aria-pressed'), 'true');
    await page.click('#noticeBtn'); assert(await page.locator('#noticePop').isVisible()); await fits('#noticePop');
    assert(await page.locator('#noticeList input').count() > 0, 'the bell lists the kinds of notification');
    await page.keyboard.press('Escape'); assert(await page.locator('#noticePop').isHidden(), 'Esc shuts the list');
    assert(await page.locator('#landing').isHidden(), 'Esc that shuts the list does not open the main menu');
    console.log('mobile: minimap'); await page.click('#minimapBtn'); assert(await onlyToggle(), 'shut, the minimap toggle alone stays');
    await page.click('#menuBtn'); await page.click('#landNew'); await page.click('#genCancel'); await page.click('#landBack');
    assert(await page.locator('#genScreen').isHidden(), 'new-world screen can be cancelled');
    await page.keyboard.press('Escape'); assert(await page.locator('#landing').isVisible(), 'Esc with nothing open opens the main menu');
    assert(await page.locator('#name').isVisible(), 'the main menu names the open game'); await fits('#name');
    await page.keyboard.press('Escape'); assert(await page.locator('#landing').isHidden(), 'Esc on the main menu goes back to the game');
    // Real pointer events keep map dragging and pinch zoom independent of the UI.
    const before = await page.evaluate(() => window.__mobile.cam);
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 170, y: 240 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 230, y: 280 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.notStrictEqual((await page.evaluate(() => window.__mobile.cam)).x, before.x, 'drag pans the map');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 150, y: 260, id: 1 }, { x: 230, y: 260, id: 2 }] });
    const zoom = await page.evaluate(() => window.__mobile.cam.z);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: 260, id: 1 }, { x: 260, y: 260, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert((await page.evaluate(() => window.__mobile.cam.z)) > zoom, 'pinch zooms the map');
    console.log('mobile: gestures passed');
    for (const [width, height] of [[320, 568], [844, 390], [768, 1024], [1024, 768], [1440, 900]]) {
      console.log(`mobile: viewport ${width}×${height}`);
      await page.setViewportSize({ width, height });
      await fits('#clock'); await fits('.navigation');
      assert.strictEqual(await page.locator('#pauseBtn').isVisible(), width <= 1024, 'the phone pause button only on a phone');
      assert.strictEqual(await page.locator('#speedBtn').isVisible(), width <= 1024, 'the phone speed button only on a phone');
      // VB-338: Main menu ends the top bar, in the top-right corner; the map's tools fit, the minimap's toggle at their right end
      const [mb, ck] = [await page.locator('#menuBtn').boundingBox(), await page.locator('#clock').boundingBox()];
      assert(mb.x + mb.width >= ck.x + ck.width - 12 && mb.y < 80, `Main menu ends the top bar: ${JSON.stringify([mb, ck])}`);
      await fits('#mapTools');
      assert.strictEqual(await page.locator('.map-bar button:visible').last().getAttribute('id'), 'minimapBtn', 'the toggle ends the bar');
      // VB-338: the dock's panels rise from it (centred over it on a wide screen); the notifications start just under the top bar
      const rises = async (id) => {
        const [p, d] = [await page.locator(id).boundingBox(), await page.locator('.navigation').boundingBox()];
        assert(p.y + p.height <= d.y && (width <= 1024 || Math.abs(p.x + p.width / 2 - d.x - d.width / 2) <= 2),
          `${id} rises from the dock at ${width}: ${JSON.stringify([p, d])}`);
      };
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r()))); // the bar is measured in the frame after a resize
      const toastsTop = await page.evaluate(() => document.getElementById('toasts').getBoundingClientRect().top);
      assert(toastsTop > ck.y + ck.height && toastsTop < ck.y + ck.height + 24, `the notifications start under the top bar: ${toastsTop}`);
      await page.click('#settlersBtn'); await fits('#peopleSheet'); await rises('#peopleSheet'); await page.click('#peopleClose');
      await page.click('#customsBtn'); await fits('#drawer'); await rises('#drawer'); await page.click('#drawerClose');
      await page.click('#treeBtn'); await fits('.tree-card'); await page.click('#treeClose');
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.evaluate(() => window.__mobile.village()); await capture('mobile-map');
    await page.click('#settlersBtn'); await capture('mobile-people');
    await page.click('#customsBtn'); await capture('mobile-customs');
    await page.click('#uiToggle'); await capture('mobile-hidden'); await page.click('#uiToggle');
    assert.deepStrictEqual(errors, [], 'no console or page errors');
    console.log('browser-mobile: panels, folds, search, details, playing a pawn, hide/restore, running clock, customs, family, minimap, drag/pinch and responsive fit');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });

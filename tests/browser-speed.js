// VB-084: functional speed, clock, keyboard and focus checks; no presentation timing budget.
const assert = require('assert'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const rawHTML = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('let st = null, speed = 1, selPawn = -1;',
  'let st = null, speed = 1, selPawn = -1; window.__speedTest = { get st() { return st; }, get speed() { return speed; }, '
  + 'get rigs() { return rigs; }, between() { return { drawX, drawY, prevX, prevY, prevIn, prevN, drawBetween: drawingBetween() }; }, village() { app.ticker.maxFPS = 12; stopIntro(); const tile = st.villages[0].center; '
  + 'cam.x = w.hx[tile]; cam.y = w.hy[tile]; cam.z = zt = 0.8; vel.x = vel.y = 0; } };');
const html = browserHTML(rawHTML);
assert(html.includes('window.__speedTest'), 'page hook exists');
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
    await page.selectOption('#genScenario', 'populous'); await page.selectOption('#genSize', 't'); await page.fill('#genSeed', '7');
    await page.locator('#genForm').evaluate((form) => form.dispatchEvent(new Event('submit', { cancelable: true })));
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
    await page.click('[data-speed="0"]');
    await page.evaluate(() => window.__speedTest.village());
    let positionsChecked = 0;
    for (const speed of ['30', 'Infinity']) {
      await page.click(`[data-speed="${speed}"]`);
      assert.strictEqual(await page.getAttribute(`[data-speed="${speed}"]`, 'aria-pressed'), 'true');
      const before = await page.evaluate(() => window.__speedTest.st.t);
      await page.waitForFunction((t) => window.__speedTest.st.t > t, before);
      const sample = await page.evaluate(() => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('functional frame check timed out')), 30000), faults = [];
        let frames = 0, positions = 0;
        function frame() {
          try {
            const { st, rigs } = window.__speedTest;
            const shown = /Year (\d+), (\d\d):(\d\d)/.exec(document.getElementById('clockYear').textContent);
            const date = /^(Spring|Summer|Autumn|Winter), day (\d+)$/.exec(document.getElementById('clockDate').textContent);
            if (!shown || !date) faults.push('clock format');
            else {
              const season = Sim.SEASONS.indexOf(date[1].toLowerCase());
              if (+date[2] < 1 || +date[2] > Sim.SEASON_DAYS || +shown[2] >= 24 || +shown[3] >= 60) faults.push('clock range');
              const hours = (+shown[1] - 1) * Sim.YEAR + (season * Sim.SEASON_DAYS + +date[2] - 1) * Sim.DAY
                + +shown[2] + +shown[3] / 60, lag = st.t - hours;
              // Allow floating-point noise at midnight, while catching a stale day, season or year. The clock shows the time the pawns
              // are drawn at, at most a 6-minute step behind st.t while they are drawn between steps (VB-244), floored to 5 minutes.
              if (+shown[3] % 5 || lag < -1e-8 || lag > 0.1 + 1 / 12 + 1e-8) faults.push({ t: st.t, shown: hours });
            }
            // each visible pawn is drawn on the segment between its place before the last step and its own (VB-244), or where it is
            const d = window.__speedTest.between(), R = VB['sim/rules'], far = (R.SPEED * st.w.HW / R.TICKS / R.ROUTE.minStep) * 1.01 + 1e-6;
            for (const a of st.agents) {
              const rig = rigs[a.id], i = a.id;
              if (!rig.root.visible) continue;
              positions++;
              const x = rig.root.position.x, y = rig.root.position.y;
              if (x !== d.drawX[i] || y !== d.drawY[i]) faults.push('position not the drawn place');
              const seg = i < d.prevN && !d.prevIn[i] ? Math.hypot(a.x - d.prevX[i], a.y - d.prevY[i]) : Infinity;
              if (seg > far) { if (x !== a.x || y !== a.y) faults.push('position'); }
              else if (Math.hypot(x - d.prevX[i], y - d.prevY[i]) + Math.hypot(a.x - x, a.y - y) > seg + 1e-3) faults.push('position off its segment');
            }
            if (++frames < 8) return requestAnimationFrame(frame);
            clearTimeout(timeout); resolve({ faults, positions });
          } catch (e) { clearTimeout(timeout); reject(e); }
        }
        requestAnimationFrame(frame);
      }));
      assert.deepStrictEqual(sample.faults, [], 'full date, clock and visible pawn positions follow simulation');
      positionsChecked += sample.positions;
      if (speed === 'Infinity') await page.waitForFunction(() =>
        /Uncapped \(\d+×\)/.test(document.querySelector('[data-speed="Infinity"]').textContent));
      await page.click('[data-speed="0"]');
    }
    assert(positionsChecked > 0, 'the picture check covers visible pawns');
    assert.strictEqual(await page.isChecked('#backgroundRun'), false);
    await page.locator('body').click({ position: { x: 700, y: 650 } });
    await page.keyboard.press('5'); assert.strictEqual(await page.evaluate(() => window.__speedTest.speed === Infinity), true);
    await page.keyboard.press('Space'); assert.strictEqual(await page.evaluate(() => window.__speedTest.speed), 0);
    await page.keyboard.press('Space'); assert.strictEqual(await page.evaluate(() => window.__speedTest.speed === Infinity), true);
    await page.keyboard.press('4'); assert.strictEqual(await page.evaluate(() => window.__speedTest.speed), 30);
    await page.click('[data-speed="0"]');
    for (const modifier of ['ctrlKey', 'metaKey', 'altKey']) {
      await page.evaluate((modifier) => window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', [modifier]: true })), modifier);
      assert.strictEqual(await page.evaluate(() => window.__speedTest.speed), 0, 'modified keys belong to the browser');
    }
    await page.focus('#backgroundRun'); await page.keyboard.press('Space');
    assert.strictEqual(await page.isChecked('#backgroundRun'), true);
    assert.strictEqual(await page.evaluate(() => window.__speedTest.speed), 0, 'checkbox space does not resume the game');
    await page.uncheck('#backgroundRun'); await page.click('[data-speed="30"]');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    const t = await page.evaluate(() => window.__speedTest.st.t); await page.waitForTimeout(350);
    assert.strictEqual(await page.evaluate(() => window.__speedTest.st.t), t, 'blur pauses by default');
    await page.check('#backgroundRun');
    await page.waitForFunction((t) => window.__speedTest.st.t > t, t);
    await page.click('[data-speed="0"]'); const paused = await page.evaluate(() => window.__speedTest.st.t);
    await page.waitForTimeout(250); assert.strictEqual(await page.evaluate(() => window.__speedTest.st.t), paused);
    await page.uncheck('#backgroundRun'); await page.click('[data-speed="30"]');
    const returning = await page.evaluate(() => window.__speedTest.st.t);
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction((t) => window.__speedTest.st.t > t, returning);
    await page.click('[data-speed="Infinity"]'); await page.waitForTimeout(700);
    if (process.env.VB_SCREENSHOTS) {
      fs.mkdirSync(process.env.VB_SCREENSHOTS, { recursive: true });
      await page.screenshot({ path: path.join(process.env.VB_SCREENSHOTS, 'after-desktop.png') });
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(700);
    assert(await page.locator('#clock').evaluate((el) => el.getBoundingClientRect().right <= innerWidth), 'mobile controls fit');
    if (process.env.VB_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.VB_SCREENSHOTS, 'after-mobile.png') });
    assert.deepStrictEqual(errors, []);
    console.log('browser-speed: clock, sprites, keyboard, pause, background, focus resume and mobile fit; rendering budget deferred');
  } finally { await browser.close(); }
})().catch((e) => { console.error(e); process.exitCode = 1; });

// The start (VB-340) in real Chromium: New archipelago opens it in place of the form; each built scenario is chosen from its card and shown on
// the showcase island with its callouts inside the picture; pointing at an archetype lights its people and changes no element's size; each
// scenario is raised from the start into whom to play; a game that is open is kept aside and comes back with Back; one column on a narrow
// screen and no sideways scroll at 400 px. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('START FAIL:', m); };
const HOOK = 'let st = null, speed = 1, selPawn = -1;';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }),
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
    ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  if (!html.includes(HOOK)) throw new Error('hook not found');
  await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: browserHTML(html.replace(HOOK,
    HOOK + ' window.__start = { get st() { return st; }, get demo() { return demo; }, get choosing() { return !!choose; } };')) }));
  await page.goto('https://village.test/');
  await page.waitForFunction(() => !document.getElementById('landing').hidden);
  await page.click('#landNew');
  if (await page.locator('#genScreen').isHidden()) fail('New archipelago does not open the start');
  const cards = await page.$$eval('#startCards [data-sc]', (bs) => bs.map((b) => b.dataset.sc));
  if (cards.join() !== 'founders,heirs,populous') fail(`the start offers ${cards}, not the three built scenarios`);
  const shown = (sc) => page.waitForFunction((sc) => {
    const s = window.__start.st;
    return s && s.scenario === sc && window.__start.demo && document.querySelector('#startPins .pin') && document.querySelector('#startStories .story')
      && document.querySelector(`[data-sc="${sc}"][aria-pressed="true"]`);
  }, sc, { timeout: 60000 });
  // every element of the start, but the callouts (which follow the camera), with its size
  // (relative to the start's sheet, which the pointer may scroll)
  const sizes = () => page.$$eval('#genScreen *', (els) => {
    const o = document.getElementById('genForm').getBoundingClientRect();
    // the bar sticks to the screen; an element not laid out (0 by 0) sits at the screen's corner
    return els.filter((e) => !e.closest('#startPins') && !e.closest('.start-bar') && e.getClientRects().length).map((e) => {
      const r = e.getBoundingClientRect();
      return `${e.tagName}:${Math.round(r.width * 10)}x${Math.round(r.height * 10)}@${Math.round(r.x - o.x)},${Math.round(r.y - o.y)}`;
    });
  });
  for (const sc of ['founders', 'heirs', 'populous']) {
    await page.click(`[data-sc="${sc}"]`); await shown(sc); await page.waitForTimeout(1500);
    const pins = await page.evaluate(() => {
      const v = document.getElementById('startView').getBoundingClientRect();
      return [...document.querySelectorAll('#startPins .pin')].map((p) => {
        const m = p.querySelector('.mk').getBoundingClientRect(), b = p.querySelector('b').getBoundingClientRect();
        const inside = (r) => r.left >= v.left - 1 && r.right <= v.right + 1 && r.top >= v.top - 1 && r.bottom <= v.bottom + 1;
        return { text: p.textContent, mark: inside(m), words: inside(b) };
      });
    });
    if (pins.length < 3 || pins.length > 4) fail(`${sc}: ${pins.length} callouts`);
    for (const p of pins) if (!p.mark || !p.words) fail(`${sc}: the callout "${p.text}" is outside the picture`);
    const who = await page.evaluate(() => ({ cards: document.querySelectorAll('#startWho .fcard').length, pyr: !!document.querySelector('#startWho .pyr'),
      titles: document.querySelectorAll('#genScreen [title]').length, year: document.querySelectorAll('#startYear > div').length }));
    if (sc === 'populous' ? !who.pyr : !who.cards) fail(`${sc}: who starts is ${JSON.stringify(who)}`);
    if (who.titles) fail(`${sc}: ${who.titles} elements of the start keep words in a title`);
    if (who.year !== 4) fail(`${sc}: the year ahead has ${who.year} steps`);
    // pointing at each archetype lights its people and moves nothing
    const before = await sizes();
    for (const key of await page.$$eval('#startStories [data-story]', (bs) => bs.map((b) => b.dataset.story))) {
      await page.hover(`#startStories [data-story="${key}"]`); await page.waitForTimeout(50);
      const lit = await page.evaluate(() => document.querySelectorAll('#startWho img.pf.on').length
        + [...document.querySelectorAll('#startWho .pb i')].filter((i) => parseFloat(i.style.getPropertyValue('--on')) > 0).length);
      if (!lit) fail(`${sc}: pointing at ${key} lights no one`);
      const after = await sizes();
      const moved = after.filter((x, k) => x !== before[k]);
      if (after.length !== before.length || moved.length) fail(`${sc}: pointing at ${key} changes ${moved.length} elements, e.g. ${moved[0]}`);
    }
    await page.mouse.move(5, 5);
    if (await page.evaluate(() => window.__start.choosing)) fail(`${sc}: an archetype chose someone`);
  }
  // one column under 860 px; no sideways scroll at 400 px
  await page.setViewportSize({ width: 820, height: 900 }); await page.waitForTimeout(400);
  const cols = await page.evaluate(() => [document.getElementById('startView'), document.querySelector('.start-side')].map((e) => e.getBoundingClientRect().left));
  if (Math.abs(cols[0] - cols[1]) > 1) fail(`at 820 px the picture and who starts are not one column: ${cols}`);
  await page.setViewportSize({ width: 400, height: 844 }); await page.waitForTimeout(400);
  const wide = await page.evaluate(() => [document.documentElement.scrollWidth, document.getElementById('genScreen').scrollWidth, innerWidth]);
  if (wide[0] > wide[2] || wide[1] > wide[2]) fail(`the start scrolls sideways at 400 px: ${wide}`);
  await page.setViewportSize({ width: 1440, height: 900 });
  // each scenario raised from the start: whom to play follows; its Back returns to the start, the raised game kept aside
  await page.selectOption('#genSize', 't'); await page.fill('#genSeed', '7');
  for (const sc of ['founders', 'heirs', 'populous']) {
    if (await page.locator('#genScreen').isHidden()) await page.click('#chooseBack'); // whom to play's Back: the start
    await page.click(`[data-sc="${sc}"]`); await page.click('#genGo');
    await page.waitForFunction((sc) => document.getElementById('loader').classList.contains('done') && window.__start.st && !window.__start.demo
      && window.__start.st.scenario === sc && !document.getElementById('choose').hidden, sc, { timeout: 120000 });
    const game = await page.evaluate(() => { window.__game = window.__start.st; return window.__start.st.w.COLS; });
    if (game !== 120) fail(`${sc} raised on ${game} columns, not the tiny map`);
    await page.click('#chooseBack');
    await page.waitForFunction(() => !document.getElementById('genScreen').hidden && window.__start.demo && document.querySelector('#startPins .pin'));
    await page.click('#genCancel');
    await page.waitForFunction(() => !document.getElementById('landing').hidden);
    if (!(await page.evaluate(() => window.__start.st === window.__game && !window.__start.demo))) fail(`${sc}: Back from the start did not bring the game back`);
    await page.click('#landBack');
    if (await page.locator('#choose').isHidden()) fail(`${sc}: Back to game does not return to whom to play`);
  }
  // a game that is open is kept aside while the start shows its island, and Back to game returns to it
  await page.click('#chooseWatch'); await page.click('#menuBtn'); await page.click('#landNew');
  await page.waitForFunction(() => window.__start.demo && window.__start.st !== window.__game && document.querySelector('#startPins .pin'));
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.getElementById('landing').hidden);
  await page.click('#landBack');
  if (!(await page.evaluate(() => window.__start.st === window.__game && !window.__start.demo && document.getElementById('landing').hidden))) {
    fail('the open game did not come back from the start');
  }
  // Quick start, from the main menu: a tiny populous island, played at once as the scenario's suggested pawn, with nothing to choose
  await page.click('#menuBtn'); await page.click('#landQuick');
  await page.waitForFunction(() => !window.__start.demo && window.__start.st !== window.__game && document.getElementById('loader').classList.contains('done')
    && !document.getElementById('menuBtn').disabled, null, { timeout: 180000 });
  const quick = await page.evaluate(() => { const s = window.__start.st; return { scenario: s.scenario, played: !!s.player, cols: s.w.COLS,
    choose: !document.getElementById('choose').hidden, start: !document.getElementById('genScreen').hidden, bar: !document.getElementById('actBar').hidden }; });
  if (quick.scenario !== 'populous' || quick.cols !== 120 || !quick.played || quick.choose || quick.start || !quick.bar) fail(`quick start: ${JSON.stringify(quick)}`);
  await browser.close();
  if (errors.length) { console.log(`browser-start: ${errors.length} failure(s)`); process.exit(1); }
  console.log('browser-start: the three scenarios shown with their callouts inside the picture, archetypes a look that moves nothing, each raised, '
    + 'the open game kept aside and brought back');
})().catch((e) => { console.error(e); process.exit(1); });

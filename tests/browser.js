// Browser smoke test: loads index.html in real Chromium (Playwright), PixiJS served from node_modules in place of the CDN.
// Generates a Tiny Populous Villages map, skips a year, opens each panel, and fails on any console or page error. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('BROWSER FAIL:', m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  // Play as and Stop playing are the Debug panel's (VB-221): the played pawn is fixed but for it and for a death
  const playSelected = async () => { await page.click('#debugBtn'); await page.click('[data-act="play"]'); await page.waitForSelector('#playBox [data-play="auto"]'); };
  const stopPlaying = async () => { await page.click('#debugBtn'); await page.click('[data-act="unplay"]'); await page.click('#debugBtn'); };
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({
    contentType: 'text/html', body: browserHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace('app.ticker.add((tk) => {', 'app.ticker.maxFPS = 12; app.ticker.add((tk) => {')
      .replace('let st = null, speed = 1, selPawn = -1;', 'let st = null, speed = 1, selPawn = -1; window.__play = { get st() { return st; }, Sim, focusPawn };')),
  }));
  await page.goto('https://village.test/');
  await page.waitForFunction(() => !document.getElementById('landing').hidden, null, { timeout: 60000 });
  await page.evaluate(() => {
    document.getElementById('genScenario').value = 'populous'; document.getElementById('genSize').value = 't'; document.getElementById('genSeed').value = '7';
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  // a new game offers the scenario's suggestion, a holder (VB-210); taking it plays that pawn and opens its card
  await page.waitForSelector('#playOffer:not([hidden])');
  await page.click('#playOfferYes'); await page.waitForSelector('#playBox [data-play="auto"]');
  if (!(await page.evaluate(() => { const { st, Sim } = window.__play; return !!st.player && Sim.isHolder(st, st.player.pawn); }))) {
    fail('the suggestion is not a holder');
  }
  await stopPlaying();
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
  // Playing a pawn (VB-210): play as the scenario's suggestion, queue a job and see it carried out, walk to a tile clicked on the map, then
  // turn the automatic behaviour off and see the pawn idle in working hours.
  await page.click('[data-speed="0"]');
  const played = await page.evaluate(() => {
    const { st } = window.__play, hh = st.households.find((h) => !h.dissolved && h.holder !== null && st.pawns[h.holder].age >= 18);
    window.__play.focusPawn(hh.holder); return hh.holder;
  });
  await playSelected();
  if ((await page.evaluate(() => window.__play.st.player && window.__play.st.player.pawn)) !== played) fail('Play as did not inhabit the pawn');
  const workable = `#playBox button[data-play="do"]:not([disabled])[data-cmd*='"verb":"work"']`;
  await page.click('[data-speed="30"]');
  await page.waitForSelector(workable, { timeout: 120000 });
  await page.click('[data-speed="0"]');
  await page.waitForSelector(workable);
  const target = JSON.parse(await page.locator(workable).first().getAttribute('data-cmd')).target;
  await page.locator(workable).first().click();
  if (!(await page.evaluate((k) => window.__play.st.player.queue.some((c) => c.verb === 'work' && c.target === k), target))) fail('the job was not queued');
  await page.waitForSelector('#playBox .queue li');
  await page.click('[data-speed="30"]');
  await page.waitForFunction((k) => {
    const { st } = window.__play, a = st.agents[st.player.pawn];
    return !!a.job && a.job.key === k && a.phase === 'work';
  }, target, { timeout: 120000 });
  await page.click('[data-speed="0"]');
  // Walk here: with Follow on, the pawn stands at the middle of the view, on an open tile
  await page.click('#playBox [data-play="follow"]'); await page.waitForTimeout(600);
  await page.click('#playBox [data-play="walk"]');
  const box = await page.locator('canvas').first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => window.__play.st.player.queue.some((c) => c.verb === 'walkTo')))) fail('Walk here did not queue a walk');
  // the automatic behaviour off, the queue emptied: in working hours the pawn takes no work once its job in hand is done
  await page.click('#playBox [data-play="auto"]');
  while (await page.locator('#playBox [data-play="unqueue"]').count()) await page.locator('#playBox [data-play="unqueue"]').first().click();
  const idle = await page.evaluate(() => {
    const { st, Sim } = window.__play, id = st.player.pawn, a = st.agents[id], working = () => { const h = Sim.cal(st.t).hour; return h >= 7 && h < 17; };
    for (let n = 0; n < 2400 && (a.job || !working()); n++) Sim.advance(st, 0.1);
    let free = 0;
    for (let n = 0; n < 40 && working(); n++) { Sim.advance(st, 0.1); if (a.job) return `took ${a.job.kind} at ${Sim.cal(st.t).hour.toFixed(1)}`; free++; }
    return st.player.auto ? 'the switch is still on' : free >= 10 ? null : `only ${free} steps seen in working hours`;
  });
  if (idle) fail(`automatic behaviour off: ${idle}`);
  await page.waitForTimeout(600);
  if (!/off/.test(await page.locator('#playBox [data-play="auto"]').textContent())) fail('the switch does not show off');
  // the wishes for the moving round (VB-212): a wish is set from the panel, shown as pressed, and taken back
  const stay = '#playBox [data-play="wish"][data-kind="out"][data-value="false"]';
  await page.click(stay);
  if ((await page.evaluate(() => window.__play.st.player.wishes.out)) !== false) fail('the wish to stay was not set');
  if ((await page.locator(stay).getAttribute('aria-pressed')) !== 'true') fail('the wish to stay does not show as pressed');
  await page.click('#playBox [data-play="wish"][data-kind="out"][data-value="null"]');
  if ((await page.evaluate(() => window.__play.st.player.wishes.out)) !== null) fail('the wish to stay was not taken back');
  await stopPlaying();
  if (await page.evaluate(() => window.__play.st.player !== null)) fail('Stop playing left a pawn played');
  // skip to the next event (VB-234): offered while a pawn is played; the run goes ahead and the page pauses at a named stop
  // the button follows the page's next refresh, not the click
  await page.locator('#skipBtn').waitFor({ state: 'hidden', timeout: 5000 }).catch(() => fail('Skip is offered with no pawn played'));
  await playSelected();
  const skipT = await page.evaluate(() => window.__play.st.t);
  await page.click('#skipBtn');
  await page.waitForSelector('#skipNote', { timeout: 240000 });
  const skipped = await page.evaluate(() => {
    const { st, Sim } = window.__play, note = document.getElementById('skipNote');
    return { t: st.t, why: note.dataset.why, known: !!Sim.SKIP[note.dataset.why], text: note.textContent,
      paused: document.querySelector('[data-speed="0"]').getAttribute('aria-pressed'), pressed: document.getElementById('skipBtn').getAttribute('aria-pressed') };
  });
  if (!skipped.known || !/^Skip stopped, .+: .+/.test(skipped.text)) fail(`the skip did not stop at a named event: ${JSON.stringify(skipped)}`);
  if (skipped.paused !== 'true' || skipped.pressed !== 'false') fail(`the page is not paused after the skip: ${JSON.stringify(skipped)}`);
  if (!(skipped.t > skipT) || skipped.t - skipT > 1153) fail(`the skip ran from ${skipT} to ${skipped.t}`);
  await page.click('#skipNote');
  await stopPlaying();
  // succession (VB-213): the played holder is killed from the debug drawer; the page pauses and offers its successors, the heir first
  await playSelected();
  await page.click('[data-speed="1"]');
  await page.click('#debugBtn'); await page.click('[data-act="kill"]'); await page.click('#debugBtn');
  await page.waitForSelector('#succession:not([hidden]) button[data-succeed]');
  const offer = await page.evaluate((dead) => {
    const { st, Sim } = window.__play, list = Sim.successors(st, dead), first = document.querySelector('#succession button[data-succeed]');
    return { kept: st.player && st.player.pawn === dead, heir: list[0], shown: +first.dataset.succeed, text: first.textContent,
      paused: document.querySelector('[data-speed="0"]').getAttribute('aria-pressed') };
  }, played);
  if (!offer.kept) fail('the player did not keep its dead pawn until the choice');
  if (!offer.heir || offer.heir.why !== 'heir' || offer.shown !== offer.heir.id || !/heir/.test(offer.text)) fail(`the heir is not offered first: ${JSON.stringify(offer)}`);
  if (offer.paused !== 'true') fail('the page did not pause at the played pawn\'s death');
  await page.click('#succession button[data-succeed]');
  await page.waitForSelector('#playBox [data-play="auto"]');
  const after = await page.evaluate((dead) => {
    const { st, Sim } = window.__play;
    return { pawn: st.player.pawn, events: Sim.recordOf(st, { pawn: dead, life: true }).filter((e) => e.kind === 'player').map((e) => e.text), box: document.getElementById('succession').hidden };
  }, played);
  if (after.pawn !== offer.heir.id || !/went on as the heir/.test(after.events[after.events.length - 1])) fail(`the heir was not gone on as: ${JSON.stringify(after)}`);
  await page.waitForFunction(() => document.getElementById('succession').hidden);
  await stopPlaying();
  await page.waitForTimeout(1000);
  await browser.close();
  if (errors.length) { console.log(`browser: ${errors.length} error(s)`); process.exit(1); }
  console.log('browser: no console or page errors (generate, skip a year, land on, settlers, customs, tree, land off, the History tab of a village, a farm and a pawn; play a pawn: queue a job and see it worked, Walk here, a wish for the moving round, the automatic behaviour off and the pawn idle in working hours, a skip to the next event, its death and going on as its heir)');
})().catch((e) => { console.error(e); process.exit(1); });

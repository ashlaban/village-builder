// Browser smoke test: loads index.html in real Chromium (Playwright), PixiJS served from node_modules in place of the CDN.
// Generates a Tiny Populous Villages map, skips a year, opens each panel, and fails on any console or page error. Runs in verify only.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const errors = [], fail = (m) => { errors.push(m); console.error('BROWSER FAIL:', m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }),
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.setDefaultTimeout(60000);
  // Play as and Stop playing are the Debug panel's (VB-221): the played pawn is fixed but for it and for a death
  const playSelected = async () => {
    await page.click('#debugBtn'); await page.click('[data-act="play"]'); await page.waitForSelector('#playBox [data-play="auto"]'); };
  const stopPlaying = async () => { await page.click('#debugBtn'); await page.click('[data-act="unplay"]'); await page.click('#debugBtn'); };
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) =>
    /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({
    contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({
    contentType: 'text/html', body: browserHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
      .replace('app.ticker.add((tk) => {', 'app.ticker.maxFPS = 12; app.ticker.add((tk) => {')
      .replace('let st = null, speed = 1, selPawn = -1;', 'let st = null, speed = 1, selPawn = -1; window.__play = { get st() { return st; }, Sim, focusPawn, '
        + 'set st(v) { st = v; }, world: () => w, ticker: () => app.ticker, setSpeed: (v) => { speed = v; }, advance: (dt) => advanceSimulation(dt), '
        + 'place: () => { placePawns(); return { drawX, drawY, prevX, prevY, prevIn, prevN, stepShare, drawBetween: drawingBetween() }; } };')),
  }));
  await page.goto('https://village.test/');
  await page.waitForFunction(() => !document.getElementById('landing').hidden, null, { timeout: 60000 });
  await page.evaluate(() => {
    document.getElementById('genScenario').value = 'populous'; document.getElementById('genSize').value = 't'; document.getElementById('genSeed').value = '7';
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  });
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 90000 });
  await page.waitForTimeout(1000);
  // Whole steps, drawn between (VB-244): from the new game's state, a game day run by the page's own pacing (advanceSimulation) at two frame
  // rates ends in the state Sim.advance gives headless, here in node; and each frame draws every pawn on the segment between its two
  // last places (or where it is, indoors, come out or placed). The ticker is stopped meanwhile, so only the frames given here run.
  {
    const data = await page.evaluate(() => { window.__play.ticker().stop(); return JSON.stringify(window.__play.Sim.save(window.__play.st)); });
    const runs = [];
    for (const [fps, speed] of [[60, 30], [24, 10]]) {
      runs.push(await page.evaluate(([fps, speed, data]) => {
        const P = window.__play, { Sim } = P, home = P.st, R = VB['sim/rules'], w = P.world();
        const st = Sim.load(w, JSON.parse(data)), tick0 = st.tick, faults = [];
        const far = (R.SPEED * w.HW / R.TICKS / R.ROUTE.minStep) * 1.01 + 1e-6;
        P.st = st; P.setSpeed(speed);
        let frames = 0, between = 0;
        try {
          while (st.tick < tick0 + Sim.DAY * R.TICKS) {
            P.advance(1 / fps); frames++;
            const d = P.place();
            for (const a of st.agents) {
              if (st.pawns[a.id].died !== null) continue;
              const x = d.drawX[a.id], y = d.drawY[a.id], i = a.id;
              const ok = i < d.prevN && !d.prevIn[i] && !a.inside && Math.hypot(a.x - d.prevX[i], a.y - d.prevY[i]) <= far;
              if (!ok) { if (x !== a.x || y !== a.y) faults.push(`frame ${frames}: pawn ${i} not drawn where it is`); continue; }
              const seg = Math.hypot(a.x - d.prevX[i], a.y - d.prevY[i]);
              if (Math.hypot(x - d.prevX[i], y - d.prevY[i]) + Math.hypot(a.x - x,
                a.y - y) > seg + 1e-6) faults.push(`frame ${frames}: pawn ${i} off its segment`);
              else if (seg > 0 && d.stepShare > 0) between++;
            }
          }
        } finally { P.st = home; P.setSpeed(0); }
        const hs = Sim.load(w, JSON.parse(data)); Sim.advance(hs, (st.tick - tick0) / R.TICKS); // headless, as many whole steps
        return { fps, speed, frames, steps: st.tick - tick0, between, faults: faults.slice(0, 5), save: JSON.stringify(Sim.save(st)),
          headless: JSON.stringify(Sim.save(hs)) };
      }, [fps, speed, data]));
    }
    await page.evaluate(() => window.__play.ticker().start());
    // Headless in node too: the same but for a pawn's stride, whose last bits differ between node's V8 and Chromium's (a float of a Math
    // function; reported, not failed: the engines' arithmetic is not this task's, VB-244).
    const VB = require('../src/load.js'), { sha } = require('./lib/canon.js'), d0 = JSON.parse(data);
    const it = VB.gen.generate(d0.seed, { cols: d0.cols, rows: d0.rows }); let r; while (!(r = it.next()).done);
    const lines = [];
    for (const run of runs) {
      const same = run.save === run.headless;
      if (!same) fail(`the page at ${run.fps} frames a second, ${run.speed}x, ends ${run.steps} steps on in another state than Sim.advance headless`);
      if (run.faults.length) fail(`drawn between steps at ${run.fps} fps: ${run.faults.join('; ')}`);
      if (!run.between) fail(`at ${run.fps} fps no pawn was drawn between two places`);
      const st = VB.sim.load(r.value, JSON.parse(data));
      VB.sim.advance(st, run.steps / VB['sim/rules'].TICKS);
      const want = VB.sim.save(st), got = JSON.parse(run.save), fields = new Set();
      for (const k of Object.keys(want.state)) if (JSON.stringify(want.state[k]) !== JSON.stringify(got.state[k])) fields.add(k);
      if (fields.has('agents')) {
        want.state.agents.forEach((x, i) => {
          for (const f of Object.keys(x || {})) if (JSON.stringify(x[f]) !== JSON.stringify((got.state.agents[i] || {})[f])) fields.add('agents.' + f); });
      }
      lines.push(`${run.fps} fps ${run.speed}x: ${run.frames} frames, ${run.steps} steps, ${same ? 'the' : 'not the'} headless state (${sha(run.save)}), `
        + `${run.between} pawn-frames drawn between; node: ${fields.size ? 'differs in ' + [...fields].join(', ') : 'the same'}`);
    }
    console.log(`browser: whole steps: ${lines.join('; ')}`);
  }
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
  // the wish for a match (VB-274): played as a single adult, "not this year" and a partner are set from the panel
  const single = await page.evaluate(() => {
    const { st, Sim } = window.__play, p = st.living.map((i) => st.pawns[i]).find((q) => q.household !== null && Sim.spouseOf(st, q.id) === null && q.age >= 20
      && st.living.some((j) => st.pawns[j].sex !== q.sex && st.pawns[j].age >= 20 && Sim.spouseOf(st, j) === null));
    if (!p) return null;
    Sim.inhabit(st, p.id); return p.id;
  });
  if (single === null) fail('no single adult to wish a match for');
  const notYear = '#playBox [data-play="wish"][data-kind="match"][data-value="false"]';
  await page.waitForSelector(notYear);
  await page.click(notYear);
  if ((await page.evaluate(() => window.__play.st.player.wishes.match)) !== false) fail('the wish not to marry this year was not set');
  if ((await page.locator(notYear).getAttribute('aria-pressed')) !== 'true') fail('the wish not to marry does not show as pressed');
  const partner = '#playBox [data-play="wish"][data-kind="match"]:not([data-value="false"]):not([data-value="null"])';
  if (await page.locator(partner).count()) {
    await page.locator(partner).first().click();
    if (!Number.isInteger(await page.evaluate(() => window.__play.st.player.wishes.match))) fail('the wished partner was not set');
  }
  await page.click('#playBox [data-play="wish"][data-kind="match"][data-value="null"]');
  if ((await page.evaluate(() => window.__play.st.player.wishes.match)) !== null) fail('the wish for a match was not taken back');
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
      paused: document.querySelector('[data-speed="0"]').getAttribute('aria-pressed'),
        pressed: document.getElementById('skipBtn').getAttribute('aria-pressed') };
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
  if (!offer.heir || offer.heir.why !== 'heir' || offer.shown !== offer.heir.id ||
    !/heir/.test(offer.text)) fail(`the heir is not offered first: ${JSON.stringify(offer)}`);
  if (offer.paused !== 'true') fail('the page did not pause at the played pawn\'s death');
  await page.click('#succession button[data-succeed]');
  await page.waitForSelector('#playBox [data-play="auto"]');
  const after = await page.evaluate((dead) => {
    const { st, Sim } = window.__play;
    return { pawn: st.player.pawn, events: Sim.recordOf(st, { pawn: dead, life: true }).filter((e) => e.kind === 'player').map((e) => e.text),
      box: document.getElementById('succession').hidden };
  }, played);
  if (after.pawn !== offer.heir.id ||
    !/went on as the heir/.test(after.events[after.events.length - 1])) fail(`the heir was not gone on as: ${JSON.stringify(after)}`);
  await page.waitForFunction(() => document.getElementById('succession').hidden);
  await stopPlaying();
  // a marriage offer in the page (VB-273): the played pawn's match waits at the moving round; the panel asks, the answer No leaves both unmarried
  // and the refusal is in the pawn's History tab. The state is the same island at the round, made in the page as tests/offers.js makes it.
  {
    await page.evaluate(() => window.__play.setSpeed(0));
    const ids = await page.evaluate(() => {
      const P = window.__play, { Sim } = P, w = P.world();
      const make = () => { const s = Sim.seed(w, 7, 'populous'); s.naturalDeaths = false; for (const h of s.households) h.grain += 5000; return s; };
      const round = (s) => {
        const rs = new Set(Object.values(s.rng)); rs.forEach((r) => { r.fix = 0; });
        try { Sim.movingRound(s); } finally { rs.forEach((r) => { delete r.fix; }); } };
      const a = make(), mark = a.record.length; round(a);
      const wed = a.record.slice(mark).find((e) => typeof e === 'object' && !e.self && e.kind === 'married');
      const s = make(); Sim.inhabit(s, wed.pawn); P.st = s; P.focusPawn(wed.pawn); window.__round = () => round(s);
      return { man: wed.pawn, woman: wed.other };
    });
    await page.waitForTimeout(500); // a frame sees the world, then the round runs and the page is told of its offer
    ids.open = await page.evaluate(() => { window.__round(); return window.__play.st.offers.length; });
    if (ids.open !== 1) fail(`no offer waits for the played pawn: ${JSON.stringify(ids)}`);
    await page.waitForSelector('#toasts .toast', { timeout: 5000 }).catch(() => fail('no notice of the offer'));
    await page.click('#actionsBtn'); await page.waitForSelector('#playBox .offer [data-play="answer"][data-yes="false"]', { timeout: 5000 });
    const asked = await page.evaluate(() =>
      ({ text: document.querySelector('#playBox .offer').textContent,
      before: document.querySelector('#playBox .offer').compareDocumentPosition(document.querySelector('#playBox .queue, #playBox .hint')) }));
    if (!/would marry/.test(asked.text) || !(asked.before & 4) && !(asked.before & 2)) fail(`the question is not asked: ${JSON.stringify(asked)}`);
    await page.locator('#playBox .offer').scrollIntoViewIfNeeded();
      await page.evaluate(() => { document.querySelector('#playBox .offer').scrollIntoView({ block: 'start' }); });
    if (process.argv.includes('--shot')) await page.screenshot({ path: path.join(root, 'docs/img/vb273-offer.png') }); // re-take the committed picture
    await page.click('#playBox .offer [data-play="answer"][data-yes="false"]');
    await page.waitForSelector('#playBox .offer-end', { timeout: 5000 });
    const done = await page.evaluate((ids) => {
      const { st, Sim } = window.__play, R = VB['sim/records'];
      return { open: st.offers.length, spouses: [R.spouseOf(st, ids.man), R.spouseOf(st, ids.woman)],
        end: document.querySelector('#playBox .offer-end').textContent, ask: !!document.querySelector('#playBox .offer') };
    }, ids);
    if (done.open || done.ask || done.spouses.some((x) => x !== null) || !/refused/.test(done.end)) fail(`the answer No: ${JSON.stringify(done)}`);
    await page.click('#debugBtn'); await page.click('[data-act="unplay"]'); await page.click('#debugBtn');
    await page.evaluate((id) => window.__play.focusPawn(id), ids.man);
    await page.click('#tabHistory'); await page.waitForSelector('#historyList time');
    if (!/refused/.test(await page.locator('#historyList').textContent())) fail('the refusal is not in the History tab');
  }
  await page.waitForTimeout(1000);
  await browser.close();
  if (errors.length) { console.log(`browser: ${errors.length} error(s)`); process.exit(1); }
  console.log('browser: no console or page errors (generate, skip a year, land on, settlers, customs, tree, land off, the History tab of a village, a farm and a pawn; play a pawn: queue a job and see it worked, Walk here, a wish for the moving round, the automatic behaviour off and the pawn idle in working hours, a skip to the next event, its death and going on as its heir, a marriage offer answered No)');
})().catch((e) => { console.error(e); process.exit(1); });

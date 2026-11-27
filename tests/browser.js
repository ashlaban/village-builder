// Browser smoke test: loads index.html in real Chromium (Playwright), PixiJS served from node_modules in place of the CDN.
// Generates a Tiny Populous Villages map, skips a year, opens each panel, and fails on any console or page error. Runs in verify only.
const { builtPage } = require('./lib/page');
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
  const stopPlaying = async () => { await page.click('#debugBtn'); await page.click('[data-act="unplay"]'); await page.click('#drawerClose'); };
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) =>
    /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({
    contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({
    contentType: 'text/html', body: browserHTML(builtPage()
      .replace('app.ticker.add((tk) => {', 'app.ticker.maxFPS = 12; app.ticker.add((tk) => {')
      .replace('let st = null,\n  speed = 1,\n  selPawn = -1;', 'let st = null,\n  speed = 1,\n  selPawn = -1; window.__play = { get st() { return st; }, Sim, focusPawn, '
        + 'get speed() { return speed; }, get choose() { return choose; }, '
        + 'look: (i) => { stopIntro(); followPlayed = false; cam.x = w.hx[i]; cam.y = w.hy[i]; cam.z = zt = 1.5; vel.x = vel.y = 0; }, '
        + 'tool: () => tool && { kind: tool.kind, sites: tool.sites.slice() }, selectFarm, cam: () => ({ x: cam.x, y: cam.y }), gliding: () => !!intro, '
        + 'drawn: () => ({ farms: farmDrawn.map((a) => a.slice()), villages: villageDrawn.map((a) => a.slice()), rigs: rigs.slice() }), '
        + 'drawings: () => { const h = app.renderer.graphicsContext._gpuContextHash; let n = 0; for (const k in h) if (h[k]) n++; return n; }, render: () => app.render(), '
        + 'set st(v) { st = v; }, world: () => w, ticker: () => app.ticker, setSpeed: (v) => { speed = v; }, advance: (dt) => advanceSimulation(dt), '
        + 'place: () => { placePawns(); return { drawX, drawY, stepShare }; } };')),
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
        // each load on a world of its own, freshly generated, as Sim.load asks and the page's loader gives (VB-1654): the game's world
        // carries the fields its run made since (w.shut, made at the first day's sweep), which a save made before them does not reset
        const fresh = () => { const it = VB.gen.generate(w.seed, { cols: w.COLS, rows: w.ROWS, lat: w.lat }); let r; while (!(r = it.next()).done); return r.value; };
        const st = Sim.load(fresh(), JSON.parse(data)), tick0 = st.tick, faults = [], last = [];
        const far = (R.SPEED * w.HW / R.TICKS / VB['sim/routes'].ROUTE.minStep) * 1.01 + 1e-6;
        P.st = st; P.setSpeed(speed);
        let frames = 0, between = 0;
        try {
          while (st.tick < tick0 + Sim.DAY * R.TICKS) {
            P.advance(1 / fps); frames++;
            const d = P.place();
            for (const a of st.agents) {
              if (st.pawns[a.id].died !== null) continue;
              const x = d.drawX[a.id], y = d.drawY[a.id], i = a.id;
              // at work on a field it walks its rows (VB-472): drawn within the tile, from the tick its work began
              if ((a.leg && a.leg.kind === 'work') && a.job && Sim.KINDS[a.job.kind].field && !a.inside) {
                if (!(Math.hypot(x - st.w.hx[a.job.site], y - st.w.hy[a.job.site]) <= 19)) faults.push(`frame ${frames}: pawn ${i} off its field's rows`);
                continue;
              }
              const [ax, ay] = Sim.placeOf(st, a); // a walker's place from its leg (VB-473)
              // drawn where it is, or ahead along its leg by less than a step, and from one frame to the next never further than a step
              const dev = Math.hypot(x - ax, y - ay), jump = last[i] ? Math.hypot(x - last[i][0], y - last[i][1]) - far * (st.tick - last[i][2]) : 0;
              if (dev > far) faults.push(`frame ${frames}: pawn ${i} more than a step from where it is`);
              else if (jump > far) faults.push(`frame ${frames}: pawn ${i} jumped`);
              else if (dev > 0 && d.stepShare > 0) between++;
              last[i] = [x, y, st.tick];
            }
          }
        } finally { P.st = home; P.setSpeed(0); }
        const hs = Sim.load(fresh(), JSON.parse(data)); Sim.advance(hs, (st.tick - tick0) / R.TICKS); // headless, as many whole steps
        return { fps, speed, frames, steps: st.tick - tick0, between, faults: faults.slice(0, 5), save: JSON.stringify(Sim.save(st)),
          headless: JSON.stringify(Sim.save(hs)) };
      }, [fps, speed, data]));
    }
    await page.evaluate(() => window.__play.ticker().start());
    // Headless in node too: the same but for a pawn's stride, whose last bits differ between node's V8 and Chromium's (a float of a Math
    // function; reported, not failed: the engines' arithmetic is not this task's, VB-244).
    const VB = require('../src/load.js'), { sha } = require('./lib/canon.js'), d0 = JSON.parse(data);
    const fresh = () => { const it = VB.gen.generate(d0.seed, { cols: d0.cols, rows: d0.rows, lat: d0.lat }); let r; while (!(r = it.next()).done); return r.value; };
    const lines = [];
    for (const run of runs) {
      const same = run.save === run.headless;
      if (!same) fail(`the page at ${run.fps} frames a second, ${run.speed}x, ends ${run.steps} steps on in another state than Sim.advance headless`);
      if (run.faults.length) fail(`drawn between steps at ${run.fps} fps: ${run.faults.join('; ')}`);
      if (!run.between) fail(`at ${run.fps} fps no pawn was drawn between two places`);
      const st = VB.sim.load(fresh(), JSON.parse(data)); // a world of its own for each run, as in the page
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
  // Whom to play (VB-339): a new game opens the choosing mode, paused, on the scenario's suggestion, a holder (VB-210). A click on another
  // farm's house on the map chooses its household, a click on one of its grown people chooses them, and Play as plays that pawn, opens its
  // actions and gives the game back its speed.
  await page.waitForSelector('#choose:not([hidden])');
  const opened = await page.evaluate(() => { const { st, Sim, choose } = window.__play; return { sug: choose.sug, pawn: choose.pawn, played: st.player,
    holder: choose.sug >= 0 && Sim.isHolder(st, choose.sug), stories: document.querySelectorAll('#chooseStories .story').length }; });
  if (opened.played !== null) fail('a pawn is played before one is chosen');
  if (!opened.holder || opened.pawn !== opened.sug) fail(`the mode does not open on the suggestion, a holder: ${JSON.stringify(opened)}`);
  if (!opened.stories) fail('no story archetype is offered');
  const farm = await page.evaluate(() => {
    const { st, choose } = window.__play, sug = st.farmsteads[st.households[st.pawns[choose.sug].household].farmstead];
    const f = st.farmsteads.find((g) => g !== sug && g.household !== null && !st.households[g.household].dissolved
      && st.households[g.household].members.filter((m) => st.pawns[m].age >= 18).length >= 2);
    window.__play.look(f.house); return f.id;
  });
  await page.waitForTimeout(400);
  const view = await page.locator('canvas').first().boundingBox();
  await page.mouse.click(view.x + view.width / 2, view.y + view.height / 2); await page.waitForTimeout(200);
  if ((await page.evaluate(() => window.__play.choose.farm)) !== farm) fail('a click on a farm\'s house does not choose that farm');
  const people = await page.locator('#chooseCard .person:not([disabled])').count();
  if (people < 2) fail(`the chosen farm shows ${people} people who may be played`);
  const person = page.locator('#chooseCard .person:not([disabled])').nth(1), chosen = +(await person.getAttribute('data-p'));
  await person.click();
  if ((await page.evaluate(() => window.__play.choose.pawn)) !== chosen) fail('a click on a person does not choose them');
  if (!/Play as/.test(await page.locator('#choosePlay').textContent())) fail('the bar does not offer to play the chosen person');
  for (const part of ['Can', 'Ahead']) if (!(await page.locator('#chooseCard h3', { hasText: part }).count())) fail(`the person's details have no ${part}`);
  await page.click('#choosePlay'); await page.waitForSelector('#playBox [data-play="auto"]');
  const left = await page.evaluate(() => ({ pawn: window.__play.st.player && window.__play.st.player.pawn, speed: window.__play.speed,
    open: !document.getElementById('choose').hidden }));
  if (left.pawn !== chosen) fail(`Play as played ${left.pawn}, not the chosen ${chosen}`);
  if (left.open) fail('the mode stays open after Play as');
  if (left.speed !== 1) fail(`the game goes on at ${left.speed}, not the speed it had before (1)`);
  await stopPlaying();
  await page.click('#debugBtn');
  await page.click('[data-act="skip1"]');
  await page.waitForFunction(() => document.getElementById('dbgMsg').textContent.startsWith('Skipped'), null, { timeout: 90000 });
  await page.click('#drawerClose');
  // A rebuilt farm's drawings are freed (VB-441): after eight more rebuilds of the farms, each one drawn, the renderer holds about as many
  // Graphics contexts as after the first. Destroyed without their contexts, every fence and house of every rebuild stayed in its cache.
  {
    const rebuilt = async () => {
      await page.evaluate(() => { window.__play.st.visualDirty = true; });
      await page.waitForFunction(() => !window.__play.st.visualDirty);
      return page.evaluate(() => { window.__play.render(); return window.__play.drawings(); });
    };
    const first = await rebuilt();
    let last = first;
    for (let k = 0; k < 8; k++) last = await rebuilt();
    if (!(first > 10)) fail(`the renderer holds ${first} Graphics contexts after a rebuild: the check counts nothing`);
    if (last > first * 1.5 + 10) fail(`the renderer holds ${last} Graphics contexts after nine rebuilds of the farms, ${first} after one: the old ones are kept`);
  }
  // One farm, one village and one rig redrawn alone (VB-442): what they drew is taken down and drawn anew, and every other farm's, village's
  // and pawn's drawing is the very object it was.
  {
    await page.evaluate(() => {
      const P = window.__play, st = P.st;
      P.kept = P.drawn();
      st.farmDirty.add(1); st.villageDirty.add(0); st.rigDirty.add(2);
    });
    await page.waitForFunction(() => { const st = window.__play.st; return !st.farmDirty.size && !st.villageDirty.size && !st.rigDirty.size; });
    const bad = await page.evaluate(() => {
      const P = window.__play, was = P.kept, now = P.drawn(), out = [];
      const same = (a, b) => a.length === b.length && a.every((o, k) => o === b[k]);
      if (!was.farms[1].length || !was.farms[1].every((o) => o.destroyed)) out.push('farm 1\'s old drawings were not taken down');
      if (!now.farms[1].length || now.farms[1].some((o) => o.destroyed || !o.parent)) out.push('farm 1 was not drawn again');
      if (!was.villages[0].every((o) => o.destroyed) || now.villages[0].some((o) => o.destroyed)) out.push('village 0 was not redrawn');
      now.farms.forEach((a, id) => { if (id !== 1 && !same(a, was.farms[id])) out.push(`farm ${id} was redrawn with farm 1`); });
      now.villages.forEach((a, id) => { if (id !== 0 && !same(a, was.villages[id])) out.push(`village ${id} was redrawn with village 0`); });
      if (now.rigs[2] === was.rigs[2]) out.push('the rig of pawn 2 was not remade');
      now.rigs.forEach((r, id) => { if (id !== 2 && id < was.rigs.length && r !== was.rigs[id]) out.push(`the rig of pawn ${id} was remade with pawn 2's`); });
      delete P.kept;
      return out.slice(0, 5);
    });
    for (const m of bad) fail(m);
  }
  const landOverlay = async () => { await page.click('#overlayBtn'); await page.click('#landBtn'); await page.click('#overlayBtn'); }; // its list (VB-1496)
  for (const id of ['landBtn', 'settlersBtn', 'cultureBtn', 'treeBtn', 'landBtn']) {
    if (id === 'landBtn') await landOverlay(); else await page.click('#' + id);
    await page.waitForTimeout(500);
    if (id === 'treeBtn') await page.click('#treeClose');
  }
  // the History tab (VB-099) of a village, a farm and a pawn, with each filter by kind
  await page.click('#settlersBtn'); await page.click('#settlers .village-block > summary'); await page.click('#settlers [data-village]');
  for (const next of [null, '#tileList [data-farm]', '#tileList [data-pawn]']) {
    if (next) { await page.click('#tabFacts'); await page.click(next); }
    else { // the village's Customs tab (VB-396): the charter, and a phrase opened to its ways
      await page.click('#tabCustoms'); await page.waitForSelector('#tileCustoms .charter [data-phrase]');
      await page.click('#tileCustoms [data-phrase]'); await page.waitForSelector('#tileCustoms .stand .way');
      if (await page.locator('#tileCustoms .voice').count()) { await page.click('#tileCustoms .voice'); await page.waitForSelector('#tileCustoms .why'); }
    }
    await page.click('#tabHistory'); await page.waitForSelector('#historyList time');
    for (const kind of await page.$$('#historyKinds button')) await kind.click();
    await page.click('#historyKinds [data-history=""]');
  }
  // VB-1145: a glide lasts 1.1 s of frame time, and a frame counts for at most 50 ms (page/frame), so under 20 frames a second it
  // outlasts any wait by the clock: the camera is read once the glide has ended, not after a time
  const glided = () => page.waitForFunction(() => !window.__play.gliding(), null, { timeout: 60000 });
  // Playing a pawn (VB-210) through the action bar (VB-341): play as the scenario's suggestion; the dock's Actions shows the bar, its
  // Household list a kind of work, queued at once where it is open at one place, else in the tool mode, whose marked tile is clicked on the
  // map; the job is seen carried out. Then Walk here, from the Myself list: the tool takes an open tile clicked on the map.
  await page.click('[data-speed="0"]');
  const played = await page.evaluate(() => {
    // a holder of age whose farm has free land within a field's reach, for the plan panel's tile below (the first farms of a packed
    // village have none: VB-1027)
    const { st } = window.__play, F = VB['sim/fieldplans'], walk = VB['sim/walking'].walkable(st.w);
    const room = (h) => { const f = st.farmsteads[h.farmstead]; let n = 0;
      for (const t of VB['sim/hex'].bfs(st.w, f.house, 4, walk).dist.keys()) if (F.fieldWhy(st, f, h, t) === null) n++;
      return n >= 3; };
    const hh = st.households.find((h) => !h.dissolved && h.holder !== null && st.pawns[h.holder].age >= 18 && h.farmstead !== null
      && st.farmsteads[h.farmstead].household === h.id && room(h));
    window.__play.focusPawn(hh.holder); return hh.holder;
  });
  await playSelected();
  if ((await page.evaluate(() => window.__play.st.player && window.__play.st.player.pawn)) !== played) fail('Play as did not inhabit the pawn');
  // VB-1027: Play as leaves the camera on the played pawn's farm, wherever the pawn is; and opening the People sheet does not move it
  {
    await page.waitForTimeout(300); await glided();
    const at = () => page.evaluate(() => { const { st } = window.__play, w = window.__play.world(), c = window.__play.cam(),
      f = st.farmsteads[st.households[st.pawns[st.player.pawn].household].farmstead];
      return { off: Math.hypot(c.x - w.hx[f.house], c.y - w.hy[f.house]) / w.R, x: c.x, y: c.y }; });
    const a = await at(); // the glide's last frame may still settle: a move is more than a world unit
    if (!(a.off < 1)) fail(`Play as left the camera ${a.off.toFixed(1)} tiles from the played pawn's farm`);
    await page.click('#settlersBtn'); await page.waitForTimeout(1500); await glided();
    const b = await at();
    if (Math.hypot(b.x - a.x, b.y - a.y) > 1) fail(`opening the People sheet moved the camera: ${JSON.stringify(a)} to ${JSON.stringify(b)}`);
    await page.click('#debugBtn'); await page.click('[data-act="play"]'); await page.waitForSelector('#playBox [data-play="auto"]'); // the sheet as Play as left it
    await page.waitForTimeout(1500); await glided();
  }
  if (!(await page.locator('#actBar').isVisible())) fail('the action bar is not shown with the played pawn\'s sheet');
  for (const g of ['self', 'house', 'village']) {
    await page.click(`#actBar [data-group="${g}"]`);
    await page.waitForSelector('#actMenu:not([hidden]) .act-row, #actMenu:not([hidden]) .act-empty');
    if ((await page.locator(`#actBar [data-group="${g}"]`).getAttribute('aria-expanded')) !== 'true') fail(`the ${g} group does not show as open`);
  }
  if (await page.locator('#actionSheet').isVisible()) fail('a group\'s list and the sheet are open together');
  await page.click('#actBar [data-group="house"]');
  const workable = '#actMenu [data-bar="work"]:not([aria-disabled])';
  // VB-1593: the list is drawn again four times a second, so the row seen at 30x may be of an hour gone by the time the clock stands:
  // the row clicked is one the list still offers once it has been drawn from the stopped state
  for (let tries = 0; ; tries++) {
    await page.click('[data-speed="30"]');
    await page.waitForSelector(workable, { timeout: 120000 });
    await page.click('[data-speed="0"]');
    await page.waitForTimeout(1000);
    if (await page.locator(workable).count() || tries >= 5) break;
  }
  await page.waitForSelector(workable);
  const row = await page.locator(workable).first().evaluate((b) => ({ kind: b.dataset.kind, holder: b.dataset.holder }));
  await page.locator(workable).first().click();
  let target = null;
  const inTool = await page.evaluate(() => window.__play.tool());
  if (inTool) {
    if (inTool.kind !== 'work' || !inTool.sites.length || await page.locator('#actBanner').isHidden() || await page.locator('#actMenu').isVisible()) {
      fail(`the work's tool: ${JSON.stringify(inTool)}`); }
    // a tile no work of the kind is on is refused, and says why; then a marked one is queued, and the tool stays in hand until Done
    const box = await page.locator('canvas').first().boundingBox();
    await page.evaluate(() => window.__play.look(0)); // the map's corner, open sea
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(300);
    const said = await page.locator('#actBanner').textContent();
    if (!/(tap|click) a marked tile/.test(said) || await page.evaluate(() => window.__play.Sim.controlOf(window.__play.st, window.__play.st.player.pawn).queue.length)) fail(`a tile with no such work: ${said}`);
    await page.evaluate((i) => window.__play.look(i), inTool.sites[0]);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await page.waitForTimeout(300);
    target = await page.evaluate(() => { const q = window.__play.Sim.controlOf(window.__play.st, window.__play.st.player.pawn).queue.find((c) => c.verb === 'work'); return q ? q.target : null; });
    if (!target || !/Queued/.test(await page.locator('#actBanner').textContent())) fail('the marked tile did not queue the work');
    if (!(await page.evaluate(() => !!window.__play.tool()))) fail('the work\'s tool did not stay in hand');
    await page.click('#actBanner button[data-tool="end"]');
    if (await page.evaluate(() => !!window.__play.tool()) || await page.locator('#actBanner').isVisible()) fail('Done did not put the tool away');
  } else {
    target = await page.evaluate(() => { const q = window.__play.Sim.controlOf(window.__play.st, window.__play.st.player.pawn).queue.find((c) => c.verb === 'work'); return q ? q.target : null; });
    const said = await page.locator('#actMenu .act-msg').allTextContents();
    if (!/Queued/.test(said.join(''))) fail(`the list does not say the work was queued: ${said}`);
  }
  if (!target) fail(`the job was not queued: ${JSON.stringify(row)}`);
  console.log(`browser: the action bar queued ${row.kind} for its ${row.holder}${inTool ? `, in the tool mode, of ${inTool.sites.length} marked tiles` : ''}`);
  await page.click('#queueBtn'); await page.waitForSelector('#playBox .queue li');
  await page.click('[data-speed="30"]');
  await page.waitForFunction((k) => {
    const { st } = window.__play, a = st.agents[st.player.pawn];
    return !!a.job && a.job.key === k && (a.leg && a.leg.kind === 'work');
  }, target, { timeout: 120000 });
  await page.click('[data-speed="0"]');
  // Walk here: with Follow on, the pawn stands at the middle of the view, on an open tile; the tool closes the sheet, and the banner names it
  await page.click('#playBox [data-play="follow"]'); await page.waitForTimeout(600);
  await page.click('#actBar [data-group="self"]'); await page.click('#actMenu [data-bar="walk"]');
  if (!/Walk here/.test(await page.locator('#actBanner').textContent()) || await page.locator('#actionSheet').isVisible()) {
    fail('Walk here\'s tool is not shown'); }
  const box = await page.locator('canvas').first().boundingBox();
  if (!(await page.evaluate((p) => document.elementFromPoint(p.x, p.y).tagName === 'CANVAS', { x: box.x + box.width / 2, y: box.y + box.height / 2 }))) {
    fail('the action bar covers the middle of the view');
  }
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => window.__play.Sim.controlOf(window.__play.st, window.__play.st.player.pawn).queue.some((c) => c.verb === 'walkTo')))) fail('Walk here did not queue a walk');
  if (await page.evaluate(() => !!window.__play.tool())) fail('Walk here\'s tool stayed in hand after its walk was queued');
  // Speak ill of (VB-554): the Myself row opens one form, a party and a kind, with the line of what it risks; its button queues the lie
  await page.click('#actBar [data-group="self"]'); await page.click('#actMenu [data-view="slander"]');
  await page.waitForSelector('#actMenu #slanderKind');
  if (!(await page.locator('#actMenu [data-risk]').count())) fail('the Speak ill of form does not say what it risks');
  if (await page.locator('#actMenu #slanderWho option').count()) {
    await page.click('#actMenu [data-bar="slander"]'); await page.waitForTimeout(300);
    const said = (await page.locator('#actMenu .act-msg').allTextContents()).join('');
    if (!(await page.evaluate(() => window.__play.Sim.controlOf(window.__play.st, window.__play.st.player.pawn).queue.some((c) => c.verb === 'slander'))) && !said) fail('Speak ill of neither queued nor said why');
    console.log(`browser: Speak ill of: ${said || 'queued'}`);
  }
  await page.click('#actBar [data-group="self"]');
  await page.click('#queueBtn');
  // the automatic behaviour off, the queue emptied: in working hours the pawn takes no work once its job in hand is done
  await page.click('#playBox [data-play="auto"]');
  while (await page.locator('#playBox [data-play="unqueue"]').count()) await page.locator('#playBox [data-play="unqueue"]').first().click();
  const idle = await page.evaluate(() => {
    const { st, Sim } = window.__play, id = st.player.pawn, a = st.agents[id], working = () => { const h = Sim.cal(st.t).hour; return h >= 7 && h < 17; };
    for (let n = 0; n < 2400 && (a.job || !working()); n++) Sim.advance(st, 0.1);
    let free = 0;
    for (let n = 0; n < 40 && working(); n++) { Sim.advance(st, 0.1); if (a.job) return `took ${a.job.kind} at ${Sim.cal(st.t).hour.toFixed(1)}`; free++; }
    return Sim.controlOf(st, st.player.pawn).auto ? 'the switch is still on' : free >= 10 ? null : `only ${free} steps seen in working hours`;
  });
  if (idle) fail(`automatic behaviour off: ${idle}`);
  await page.waitForTimeout(600);
  if (!/off/.test(await page.locator('#playBox [data-play="auto"]').textContent())) fail('the switch does not show off');
  // the plan panel (VB-256): as head, the farm's Plan tab raises the hay target with its stepper, and its "Choose the tile" takes the next
  // field's tile from a click on the map: the house is refused with its reason, an open tile is named; the tab shows both
  {
    const hh = await page.evaluate((id) => {
      const { st } = window.__play, h = st.households.find((x) => !x.dissolved && x.holder === id);
      window.__play.selectFarm(h.farmstead); return h.id;
    }, played);
    await page.click('#tabPlan');
    const raise = '#tileHouse [data-plan="target"][data-store="hay"][aria-label^="Raise"]';
    await page.waitForSelector(raise);
    const view = () => page.evaluate((id) => window.__play.Sim.headView(window.__play.st, id), hh);
    const before = (await view()).targets.hay.now;
    await page.click(raise);
    const hay = (await view()).targets.hay, row = await page.locator('#tileHouse [data-target="hay"]').textContent();
    if (!(hay.chosen > before) || hay.now !== hay.chosen) fail(`the hay target was not raised: ${before} to ${JSON.stringify(hay)}`);
    if (!row.includes(`/ ${Math.round(hay.now * 100) / 100}`) || !/chosen/.test(row)) fail(`the Plan tab does not show the hay target chosen: ${row}`);
    // a made good's target (VB-865): ale raised by one barrel, then cleared back to the household's need
    await page.click('#tileHouse [data-plan="target"][data-store="ale"][aria-label^="Raise"]');
    const ale = (await view()).goods.ale;
    if (ale.chosen === null || ale.now !== ale.chosen || !/chosen/.test(await page.locator('#tileHouse [data-target="ale"]').textContent())) {
      fail(`the ale target was not set: ${JSON.stringify(ale)}`); }
    await page.click('#tileHouse [data-plan="target"][data-store="ale"][data-n="null"]');
    if ((await view()).goods.ale.chosen !== null || await page.locator('#tileHouse [data-plan="target"][data-store="ale"][data-n="null"]').count()) {
      fail('the ale target was not cleared'); }
    await page.click('#tileHouse [data-plan="tile"][data-what="field"]:not([data-clear])');
    if ((await page.evaluate(() => window.__play.tool()))?.kind !== 'plan') fail('Choose the tile did not put the plan\'s tool in hand: ' + await page.locator('#tileHouse .plan-msg').allTextContents());
    const box = await page.locator('canvas').first().boundingBox(), mid = [box.x + box.width / 2, box.y + box.height / 2];
    const spots = await page.evaluate((id) => {
      const { st } = window.__play, h = st.households[id], f = st.farmsteads[h.farmstead], F = VB['sim/fieldplans'];
      let open = -1;
      for (let t = 0; t < st.w.N && open < 0; t++) if (F.fieldWhy(st, f, h, t) === null) open = t;
      const sites = window.__play.tool().sites;
      return { house: f.house, open, sites, marked: sites.every((t) => F.fieldWhy(st, f, h, t) === null) };
    }, hh);
    // VB-894: the tiles that would take the field are marked, read at the tool's start, and every one is a tile the rule takes
    if (!spots.sites.length || !spots.marked || !spots.sites.includes(spots.open)) fail(`the tiles that would do are not marked: ${JSON.stringify(spots.sites)}`);
    spots.open = spots.sites[spots.sites.length >> 1]; // a marked tile is the one clicked
    if (process.argv.includes('--shot')) { // the marked tiles, the tool in hand
      await page.evaluate((i) => window.__play.look(i), spots.open); await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(root, 'docs/img/vb894-marks.png') });
    }
    await page.evaluate((i) => window.__play.look(i), spots.house);
    await page.mouse.click(...mid); await page.waitForTimeout(300);
    const refused = await page.locator('#actBanner').textContent();
    if (!/house stands there/.test(refused) || (await view()).tiles.field !== -1) fail(`the house was not refused with its reason: ${refused}`);
    if (spots.open < 0) fail('no tile will take a field');
    await page.evaluate((i) => window.__play.look(i), spots.open);
    // VB-1027: pointing at a tile with the tool in hand tells what it is, in the banner
    await page.mouse.move(mid[0] + 3, mid[1] + 3); await page.mouse.move(...mid); await page.waitForTimeout(200);
    const facts = await page.locator('#actBanner [data-facts]').allTextContents();
    if (!/fertility \d+.*from the house.*would do/.test(facts.join(''))) fail(`the tile pointed at is not told with the tool in hand: ${facts}`);
    await page.mouse.click(...mid); await page.waitForTimeout(300);
    const named = (await view()).tiles.field;
    await page.waitForSelector('#tabPlan[aria-selected="true"]', { timeout: 5000 }).catch(() => fail('the card did not come back to its Plan tab'));
    const shown = await page.locator('#tileHouse [data-tile="field"]').textContent();
    if (named !== spots.open || await page.evaluate(() => !!window.__play.tool())) fail(`the field's tile was not named: ${named}, not ${spots.open}`);
    if (!shown.includes(`tile ${spots.open}`) || !(await page.locator(`#tileHouse [data-tile="field"] [data-plan="fly"][data-tile="${spots.open}"]`).count()) || !(await page.locator('#tileHouse [data-target="hay"]').textContent()).includes('chosen')) {
      fail(`the Plan tab does not show both choices: ${shown}`); }
    if (process.argv.includes('--shot')) { // the tab from its top: the targets
      await page.evaluate(() => { document.getElementById('tileDetails').scrollTop = 0; });
      await page.screenshot({ path: path.join(root, 'docs/img/vb256-plan.png') });
    }
    console.log(`browser: the plan panel raised hay from ${before} to ${hay.now} winters and named tile ${named} for the next field`);
    // the day (VB-477): Today shows a row a member, each task a range by your reckoning; a call names its cost before it is made, and a
    // reorder is said to stand until the day is next allotted
    {
      await page.waitForSelector('#tileHouse .day-row', { timeout: 5000 }).catch(() => fail('the Plan tab shows no row of the day'));
      if (!/by your reckoning/.test(await page.locator('#tileHouse').textContent())) fail('the day does not say whose reckoning its ranges are');
      await page.locator('#tileHouse [data-plan="callAsk"]:not([data-key])').first().click();
      const cost = await page.locator('#tileHouse .day-cost').textContent().catch(() => '');
      if (!/A call costs:.*(walks home|is at home).*(carries)/.test(cost)) fail(`no cost named before the call: ${cost}`);
      // VB-1926: the call's kinds, each an icon and its label, the sentence one tap in
      if (!(await page.locator('#tileHouse .day-cost .day-kind summary svg, #tileHouse .day-cost .day-kind summary img').count()))
        fail('the call names its kind by no icon');
      await page.click('#tileHouse [data-plan="callNo"]');
      if (await page.locator('#tileHouse .day-cost').count()) fail('the cost stays after Leave at work');
      const down = page.locator('#tileHouse [data-plan="dayOrder"][aria-label^="Leave"]:not([disabled])');
      if (await down.count()) {
        await down.first().click();
        const ed = await page.evaluate((id) => window.__play.st.plans.households.get(id).day.edited, hh);
        if (!ed) fail('a reorder from the Plan tab did not change the day');
        await page.waitForSelector('#tileHouse .day-edited', { timeout: 5000 }).catch(() => fail('the day does not say the head changed it'));
      }
      console.log(`browser: the day in the Plan tab: ${await page.locator('#tileHouse .day-row').count()} rows; the call's cost: ${cost}`);
    }
    // VB-1027: with no tile that would do (a farm at its most meadows) the tile tool says why at once and does not go into hand; the
    // refusal goes when the tab is next opened; a project's row names its tile by the same link, which moves the camera to it
    {
      const msg = () => page.locator('#tileHouse .plan-msg').count();
      if (!(await msg())) fail('the tile named left no answer at the head of the Plan tab');
      const full = await page.evaluate((id) => {
        const { st } = window.__play, f = st.farmsteads[st.households[id].farmstead], had = f.meadows, max = VB['sim/meadows'].MAX || 6;
        f.meadows = Array.from({ length: max }, (_, k) => had[k] || had[0] || { tile: -1 }); // for the length of one click: the rule reads the count
        try { document.querySelector('#tileHouse [data-plan="tile"][data-what="meadow"]:not([data-clear])').click(); } finally { f.meadows = had; }
        return { tool: !!window.__play.tool(), text: (document.querySelector('#tileHouse .plan-msg.bad') || {}).textContent || '' };
      }, hh);
      if (full.tool || !/the most it keeps/.test(full.text)) fail(`a farm at its most meadows: the tile tool did not say why at once: ${JSON.stringify(full)}`);
      await page.click('#tabFacts'); await page.waitForTimeout(400);
      await page.click('#tabPlan'); await page.waitForSelector('#tileHouse [data-project]');
      if (await msg()) fail(`the refusal is still at the head of the Plan tab after it was closed: ${await page.locator('#tileHouse .plan-msg').textContent()}`);
      // VB-1593: the household may have a project under way, begun by its head's rule (the work the action bar queued above may be
      // its step): the card then offers "Give it up" in place of the three to begin, so it is given up first, by that button
      const under = await page.evaluate((id) => { const p = VB['sim/projects'].ownOf(window.__play.st, id); return p ? p.what : null; }, hh);
      if (under) {
        if (await page.locator('#tileHouse [data-plan="project"][data-what="field"]').count()) fail(`a ${under} under way, and the card offers to begin a field`);
        await page.click('#tileHouse [data-project] [data-plan="drop"]');
        if (await page.evaluate((id) => !!VB['sim/projects'].ownOf(window.__play.st, id), hh)) fail(`Give it up did not give up the ${under} under way`);
      }
      await page.click('#tileHouse [data-plan="project"][data-what="field"]');
      const at = await page.evaluate((id) => { const p = VB['sim/projects'].ownOf(window.__play.st, id); return p ? p.steps[p.open].place : -1; }, hh);
      const link = `#tileHouse [data-project] [data-plan="fly"][data-tile="${at}"]`;
      if (at < 0 || !(await page.locator(link).count())) fail(`the project's row does not name its tile ${at}: ${await page.locator('#tileHouse [data-project]').textContent()}`);
      else {
        if (!/after the one being made/.test(await page.locator('#tileHouse [data-tile="field"]').textContent())) fail('Next field does not say one is being made');
        await page.evaluate((i) => window.__play.look(i), spots.house);
        await page.click(link); await page.waitForTimeout(300); await glided();
        const near = await page.evaluate((i) => { const c = window.__play.cam(), w = window.__play.world(); return Math.hypot(c.x - w.hx[i], c.y - w.hy[i]) < w.R; }, at);
        if (!near) fail('Show on map did not bring the camera to the project\'s tile');
      }
      await page.click('#tileHouse [data-plan="drop"]'); // given up again: the tests below take the household without a project
      console.log(`browser: the tile tool refused at once ("${full.text}"), the refusal went with the tab, and the project's row shows tile ${at}`);
    }
    await page.evaluate((id) => window.__play.focusPawn(id), played); // the played pawn selected again, as the tests below take it
    await page.click('#tabFacts');
  }
  // the wishes for the moving round (VB-212): a wish is set from the panel, shown as pressed, and taken back
  await page.click('#actBar [data-group="self"]'); await page.click('#actMenu [data-view="round"]');
  const stay = '#actMenu [data-play="wish"][data-kind="out"][data-value="false"]';
  await page.click(stay);
  if ((await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).out)(window.__play))) !== false) fail('the wish to stay was not set');
  if ((await page.locator(stay).getAttribute('aria-pressed')) !== 'true') fail('the wish to stay does not show as pressed');
  await page.click('#actMenu [data-play="wish"][data-kind="out"][data-value="null"]');
  if ((await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).out)(window.__play))) !== null) fail('the wish to stay was not taken back');
  // the wish to settle new land (VB-392), shown with the others
  await page.click('#actMenu [data-play="wish"][data-kind="settle"][data-value="true"]');
  if ((await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).settle)(window.__play))) !== true) fail('the wish to settle was not set');
  await page.click('#actMenu [data-play="wish"][data-kind="settle"][data-value="null"]');
  // the wish for a match (VB-274): played as a single adult, "not this year" and a partner are set from the panel
  const single = await page.evaluate(() => {
    const { st, Sim } = window.__play, p = st.living.map((i) => st.pawns[i]).find((q) => q.household !== null && Sim.spouseOf(st, q.id) === null && q.age >= 20
      && st.living.some((j) => st.pawns[j].sex !== q.sex && st.pawns[j].age >= 20 && Sim.spouseOf(st, j) === null));
    if (!p) return null;
    Sim.inhabit(st, p.id); return p.id;
  });
  if (single === null) fail('no single adult to wish a match for');
  const notYear = '#actMenu [data-play="wish"][data-kind="match"][data-value="false"]';
  await page.waitForSelector(notYear);
  await page.click(notYear);
  if ((await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).match)(window.__play))) !== false) fail('the wish not to marry this year was not set');
  if ((await page.locator(notYear).getAttribute('aria-pressed')) !== 'true') fail('the wish not to marry does not show as pressed');
  const partner = '#actMenu [data-play="wish"][data-kind="match"]:not([data-value="false"]):not([data-value="null"])';
  if (await page.locator(partner).count()) {
    await page.locator(partner).first().click();
    if (!Number.isInteger(await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).match)(window.__play)))) fail('the wished partner was not set');
  }
  await page.click('#actMenu [data-play="wish"][data-kind="match"][data-value="null"]');
  if ((await page.evaluate(() => (({ st, Sim }) => Sim.wishesOf(st, st.player.pawn).match)(window.__play))) !== null) fail('the wish for a match was not taken back');
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
  // until my task ends (VB-477): the same skip, stopped at the end of the pawn's leg or task, or what concerns its household
  {
    await page.locator('#taskBtn').waitFor({ state: 'visible', timeout: 5000 }).catch(() => fail('Until my task ends is not offered'));
    const t0 = await page.evaluate(() => window.__play.st.t);
    await page.click('#taskBtn');
    await page.waitForSelector('#skipNote', { timeout: 240000 });
    const r = await page.evaluate(() => ({ t: window.__play.st.t, text: document.getElementById('skipNote').textContent,
      paused: document.querySelector('[data-speed="0"]').getAttribute('aria-pressed'),
      pressed: document.getElementById('taskBtn').getAttribute('aria-pressed') }));
    if (!/^Stopped, .+: .+/.test(r.text) || r.paused !== 'true' || r.pressed !== 'false' || !(r.t > t0)) fail(`until my task ends: ${JSON.stringify(r)}`);
    console.log(`browser: until my task ends ran ${(r.t - t0).toFixed(1)} h: ${r.text}`);
    await page.click('#skipNote');
  }
  await stopPlaying();
  // succession (VB-213, VB-1121): the played holder is killed from the debug drawer; the page pauses and shows its successor by the customs
  await playSelected();
  // the Agenda's support as a meter (VB-1105): a cause against the practice at a constructed meeting, the share it needs marked on it
  await page.evaluate(() => {
    const { st, Sim } = window.__play, p = st.pawns[st.player.pawn], c = st.cenv.settlements[Sim.settlementIdOf(st, p)];
    c.lastSupport = Array(200).fill(0.3);
    p.advocate = { dim: 0, opt: c.practice[0] === 1 ? 0 : 1, until: st.cenv.t + 3 };
  });
  await page.click('#agendaBtn');
  await page.waitForSelector('#agendaContent .agenda-meters [role="meter"]');
  const nm = await page.locator('#agendaContent .agenda-meters [role="meter"]').count();
  if (nm !== 2 || !(await page.locator('#agendaContent .agenda-meters b.head').count())) fail('the agenda shows no support meters with the needed share marked');
  await page.click('#drawerClose');
  await page.click('[data-speed="1"]');
  await page.click('#debugBtn'); await page.click('[data-act="kill"]'); await page.click('#drawerClose');
  await page.waitForSelector('#succession:not([hidden]) button[data-succeed]');
  const offer = await page.evaluate((dead) => {
    const { st, Sim } = window.__play, heir = Sim.successor(st, dead), first = document.querySelector('#succession button[data-succeed]');
    return { kept: st.player && st.player.pawn === dead, heir, n: document.querySelectorAll('#succession button[data-succeed]').length, shown: +first.dataset.succeed, text: first.textContent,
      paused: document.querySelector('[data-speed="0"]').getAttribute('aria-pressed') };
  }, played);
  if (!offer.kept) fail('the player did not keep its dead pawn until the choice');
  if (!offer.heir || offer.n !== 1 || offer.shown !== offer.heir.id || !/^Go on as /.test(offer.text))
    fail(`the successor is not the one shown: ${JSON.stringify(offer)}`);
  if (offer.paused !== 'true') fail('the page did not pause at the played pawn\'s death');
  await page.click('#succession button[data-succeed]');
  await page.waitForSelector('#playBox [data-play="auto"]');
  const after = await page.evaluate((dead) => {
    const { st, Sim } = window.__play;
    return { pawn: st.player.pawn, events: Sim.recordOf(st, { pawn: dead, life: true }).filter((e) => e.kind === 'player').map((e) => e.text),
      box: document.getElementById('succession').hidden };
  }, played);
  if (after.pawn !== offer.heir.id ||
    !/went on as its /.test(after.events[after.events.length - 1])) fail(`the successor was not gone on as: ${JSON.stringify(after)}`);
  await page.waitForFunction(() => document.getElementById('succession').hidden);
  await stopPlaying();
  // a marriage offer in the page (VB-273): the played pawn's match waits from its asking; the panel asks, the answer No leaves both unmarried
  // and the refusal is in the pawn's History tab. The state is the same island at the round, made in the page as tests/offers.js makes it.
  {
    await page.evaluate(() => window.__play.setSpeed(0));
    const ids = await page.evaluate(() => {
      const P = window.__play, { Sim } = P, w0 = P.world();
      // each state on a world fresh from the generator, as tests/offers.js makes them: a run writes its world (stones picked, trees felled)
      const fresh = () => { const it = VB.gen.generate(7, { cols: w0.COLS, rows: w0.ROWS }); let r; while (!(r = it.next()).done); return r.value; };
      let people = 7; // the seed of the island's people: the first at which a man of the round, when played, is asked (VB-342)
      const make = () => { const s = Sim.seed(fresh(), people, 'populous'); s.naturalDeaths = false; for (const h of s.households) h.grain.barley += 5000; return s; };
      const round = (s) => {
        const rs = new Set(Object.values(s.rng)); rs.forEach((r) => { r.fix = 0; });
        try { Sim.movingRound(s); } finally { rs.forEach((r) => { delete r.fix; }); } };
      // the year's askings, each on its pawn's word (VB-693: a match is asked by a spokesman and answered at the round, so the offer
      // waits for the played pawn from its asking); `waits`: the open offers the pawn has an answer to give in
      const ask = (s) => {
        const rs = new Set(Object.values(s.rng)); rs.forEach((r) => { r.fix = 0; });
        try { for (const e of [...s.asking]) if (s.pawns[e.pawn].alive) VB['sim/asking'].askFor(s, e.pawn); } finally { rs.forEach((r) => { delete r.fix; }); } };
      const waits = (s, id) => s.offers.filter((o) => o.answers.some((x) => x.by === id && x.yes === null));
      window.__waits = (id) => waits(window.__play.st, id).length;
      let wed;
      for (; !wed && people < 40; wed || people++) {
        const a = make(), mark = a.record.length; round(a);
        wed = a.record.slice(mark).filter((e) => typeof e === 'object' && !e.self && e.kind === 'married')
          .find((e) => { const probe = make(); Sim.inhabit(probe, e.pawn); ask(probe); const w = waits(probe, e.pawn);
            return w.length === 1 && w[0].basis === 'match' && w[0].gives.man === e.pawn; });
      }
      const s = make(); Sim.inhabit(s, wed.pawn); P.st = s; P.focusPawn(wed.pawn); window.__round = () => ask(s);
      const o = (() => { const probe = make(); Sim.inhabit(probe, wed.pawn); ask(probe); return waits(probe, wed.pawn)[0]; })();
      return { man: wed.pawn, woman: o.wants.woman };
    });
    await page.waitForTimeout(500); // a frame sees the world, then the askings are held and the page is told of its offer
    ids.open = await page.evaluate((id) => { window.__round(); return window.__waits(id); }, ids.man);
    if (ids.open !== 1) fail(`no offer waits for the played pawn: ${JSON.stringify(ids)}`);
    await page.waitForSelector('#toasts .toast', { timeout: 5000 }).catch(() => fail('no notice of the offer'));
    await page.click('#actionsBtn'); await page.click('#queueBtn');
    await page.waitForSelector('#playBox .offer [data-play="answer"][data-yes="false"]', { timeout: 5000 });
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
      return { open: window.__waits(ids.man), spouses: [R.spouseOf(st, ids.man), R.spouseOf(st, ids.woman)],
        end: document.querySelector('#playBox .offer-end').textContent, ask: !!document.querySelector('#playBox .offer') };
    }, ids);
    if (done.open || done.ask || done.spouses.some((x) => x !== null) || !/refused/.test(done.end)) fail(`the answer No: ${JSON.stringify(done)}`);
    await page.click('#debugBtn'); await page.click('[data-act="unplay"]'); await page.click('#drawerClose');
    await page.evaluate((id) => window.__play.focusPawn(id), ids.man);
    await page.click('#tabHistory'); await page.waitForSelector('#historyList time');
    if (!/refused/.test(await page.locator('#historyList').textContent())) fail('the refusal is not in the History tab');
  }
  await page.waitForTimeout(1000);
  await browser.close();
  if (errors.length) { console.log(`browser: ${errors.length} error(s)`); process.exit(1); }
  console.log('browser: no console or page errors (generate, skip a year, land on, settlers, culture, tree, land off, the History tab of a village, a farm and a pawn; play a pawn: queue a job and see it worked, Walk here, a wish for the moving round, the automatic behaviour off and the pawn idle in working hours, the plan panel as head, a skip to the next event, its death and going on as its heir, a marriage offer answered No)');
})().catch((e) => { console.error(e); process.exit(1); });

// Saves in the page (VB-214, VB-260), in real Chromium; verify only. On a tiny map with a played pawn: save to slots and to a file, reload and
// continue, a save of another build (refused; Delete it; Start a new game), Delete archipelago, a file round trip and a file of another
// build, the auto slot when the page is hidden, Main menu then Back to game, and no console errors.
// `node tests/browser-saves.js OUTDIR` also leaves screenshots (landing, saves overlay, generation screen; desktop and phone) in OUTDIR.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), zlib = require('zlib');
const { browserHTML } = require('./lib/browser');
const root = path.join(__dirname, '..'), out = process.argv[2] || null, tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'vb-saves-'));
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null, speed = 1, selPawn = -1;';
const OTHER = 'Made by another build of the game; it cannot be loaded';
const P7 = 'populous-7-120x85';
const errors = [], fail = (m) => { errors.push(m); console.error('BROWSER FAIL:', m); };
const check = (ok, m) => { if (!ok) fail(m); };
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(90000);
  page.on('console', (m) => { if (m.type() === 'error') fail('console.error: ' + m.text()); });
  page.on('pageerror', (e) => fail('page error: ' + (e.stack || e.message)));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: browserHTML(fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(HOOK, HOOK + ' window.__play = { get st() { return st; }, Sim, listSaves: () => listSaves(), saveTx: (...a) => saveTx(...a) };')) }));
  const shot = async (name) => { if (out) await page.screenshot({ path: path.join(out, name) }); };
  const done = () => page.waitForFunction(() => document.getElementById('loader').classList.contains('done') && !!window.__play.st
    && document.getElementById('genScreen').hidden && document.getElementById('landing').hidden
    && !document.body.classList.contains('demo'), null, { timeout: 90000 }); // a game, not the menu's showcase island (VB-307)
  const pause = () => page.evaluate(() => document.querySelector('[data-speed="0"]').click());
  const hash = () => page.evaluate(() => {
    const { st, Sim } = window.__play, t = JSON.stringify(Sim.save(st)); let h = 0;
    for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0;
    return `${h} t=${st.t} year=${Sim.cal(st.t).year} pawn=${st.player && st.player.pawn}`;
  });
  // The archipelago itself: its name and a checksum of every typed array of its world (the clock may have moved a little).
  const world = () => page.evaluate(() => {
    const w = window.__play.st.w; let h = 0;
    for (const k of Object.keys(w)) if (ArrayBuffer.isView(w[k])) for (let i = 0; i < w[k].length; i += 7) h = (h * 31 + w[k][i]) | 0;
    return `${w.name} ${w.seed} ${h}`;
  });
  // Polls a condition over the stored lines (waitForFunction does not wait for a promise's value).
  const until = async (f, arg) => { for (let i = 0; i < 400; i++) { if (await page.evaluate(f, arg)) return; await page.waitForTimeout(50); } throw new Error('timed out: ' + f); };
  const keys = async () => (await page.evaluate(() => window.__play.listSaves())).map((l) => l.key).sort();
  const landing = async () => { await page.waitForFunction(() => !!window.__play && !document.getElementById('landing').hidden); await page.waitForTimeout(300); };
  const savesOpen = async () => { await page.click('#landLoad'); await page.waitForSelector('#savesBody .save-files'); };
  const body = () => page.locator('#savesBody').innerText();
  const settle = (n) => page.waitForFunction((k) => document.querySelectorAll('#savesBody .save-arch:first-child [data-load]').length === k, n, { timeout: 8000 }).catch(async (e) => { console.error(await body()); throw e; });
  const reload = async (hashPart = '') => { await page.goto('about:blank'); await page.goto('https://village.test/' + hashPart); };
  const pickFile = async (f) => { const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#savesBody [data-file="load"]')]); await fc.setFiles(f); };

  // 1. Play a tiny populous map; save to slots 1 and 3 and to a file.
  await page.goto('https://village.test/#pt7'); await done(); await page.waitForTimeout(300);
  await pause();
  const h0 = await world();
  await page.click('#playOfferYes'); await pause();
  await page.evaluate(() => { const { st, Sim } = window.__play; Sim.advance(st, Sim.DAY * 30); });
  const h1 = await hash();
  check(/pawn=\d+/.test(h1), 'no played pawn: ' + h1);
  await page.click('#savesBtn'); await page.waitForSelector('#savesBody .save-files');
  await page.click('#savesBody [data-save="1"]'); await settle(1);
  await page.evaluate(() => { const { st, Sim } = window.__play; Sim.advance(st, Sim.DAY * 100); });
  await page.click('#savesBody [data-save="3"]'); await settle(2);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#savesBody [data-file="save"]')]);
  const file = path.join(tmp, dl.suggestedFilename()); await dl.saveAs(file);
  const h3 = await hash();
  check(h3 !== h1, 'the game did not advance between saves');
  check(fs.existsSync(file) && fs.statSync(file).size > 1000, 'the file is empty');
  check((await keys()).join() === `${P7}:1,${P7}:3`, 'slots after saving: ' + (await keys()));
  await shot('saves-game.png');
  await page.click('#savesClose');

  // 2. The page hidden writes the auto slot, once for one game time.
  const hide = () => page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  const auto = async () => { const l = (await page.evaluate(() => window.__play.listSaves())).find((x) => x.slot === 'auto'); return l ? l.savedAt : null; };
  check((await auto()) === null, 'an auto slot before the page was hidden');
  await hide(); await until(async () => (await window.__play.listSaves()).some((x) => x.slot === 'auto'));
  const a1 = await auto(), ta = await page.evaluate(() => window.__play.st.t);
  await page.waitForTimeout(50); await hide(); await page.waitForTimeout(500);
  check((await auto()) === a1, 'hidden twice at one game time wrote the auto slot twice (' + a1 + ' then ' + await auto() + ', t ' + ta + ' then ' + await page.evaluate(() => window.__play.st.t) + ')');
  await page.evaluate(() => { const { st, Sim } = window.__play; Sim.advance(st, Sim.DAY); });
  const h3b = await hash();
  await page.waitForTimeout(50); await hide();
  await until(async (a) => (await window.__play.listSaves()).find((x) => x.slot === 'auto').savedAt !== a, a1);
  check((await keys()).length === 3, 'slots after the auto save: ' + (await keys()));

  // 3. Main menu, then Back to game, leaves the state as it was.
  await page.click('#regen'); await landing(); await shot('landing-game.png');
  await page.click('#landBack'); await page.waitForFunction(() => document.getElementById('landing').hidden);
  check((await hash()) === h3b, 'Back to game changed the state');

  // 4. A second archipelago, and two saves made to look like another build's.
  await page.goto('about:blank'); await page.goto('https://village.test/#st11'); await done(); await pause();
  await page.click('#savesBtn'); await page.waitForSelector('#savesBody .save-files');
  await page.click('#savesBody [data-save="2"]'); await settle(1);
  const oldBuild = (key) => page.evaluate((k) => window.__play.saveTx('readwrite', (m) => { const q = m.get(k); q.onsuccess = () => m.put({ ...q.result, build: 'old0000000' }); }), key);
  await oldBuild(`${P7}:3`); await oldBuild(`${P7}:auto`);

  // 5. Reload: Load archipelago and Continue match; another build's save is refused, Delete it removes it, Start a new game regenerates.
  // With no game open the showcase island plays behind the menu (VB-307): it is no game to go back to or to save.
  await reload(); await landing();
  await page.waitForFunction(() => document.body.classList.contains('demo') && !!window.__play.st, null, { timeout: 30000 });
  const demoT = await page.evaluate(() => window.__play.st.t);
  await page.waitForFunction((t) => window.__play.st.t > t, demoT, { timeout: 10000 });
  check(await page.locator('#landBack').isHidden(), 'the showcase island is offered as a game to go back to');
  check(await page.locator('.hud.top').evaluate((e) => getComputedStyle(e).visibility) === 'hidden', 'the interface shows over the showcase island');
  await shot('landing.png');
  await savesOpen(); await shot('saves-landing.png');
  const text = await body();
  check(!text.includes('the game open now') && !(await page.locator('#savesBody [data-save]').count()), 'the showcase island can be saved: ' + text);
  check(await page.locator('#savesTitle').innerText() === 'Load archipelago' && await page.locator('#savesClose').innerText() === 'Back',
    'from the main menu the Saves overlay is not titled Load archipelago, with Back');
  check(text.includes(OTHER), 'no message for a save of another build: ' + text);
  await pause();
  await page.click(`#savesBody [data-load="${P7}:1"]`); await done(); await pause();
  check((await hash()) === h1, 'Continue after a reload: ' + (await hash()) + ' against ' + h1);
  await page.click('#regen'); await landing(); await savesOpen();
  await page.click(`#savesBody [data-del="${P7}:3"]`);
  await until(async (k) => !(await window.__play.listSaves()).some((x) => x.key === k), `${P7}:3`);
  check((await keys()).includes(`${P7}:auto`), 'Delete it removed another save: ' + (await keys()));
  await page.click(`#savesBody [data-new="${P7}:auto"]`); await done(); await pause();
  check((await world()) === h0, 'Start a new game did not generate the same archipelago: ' + (await world()) + ' against ' + h0);
  check((await keys()).includes(`${P7}:auto`), 'Start a new game deleted the save');

  // 6. Delete archipelago removes one archipelago's saves and no other's.
  await page.click('#regen'); await landing(); await savesOpen();
  await page.click('#savesBody [data-delarch="founders-11-120x85"]');
  await until(async () => !(await window.__play.listSaves()).some((x) => x.arch.startsWith('founders')));
  check((await keys()).join() === `${P7}:1,${P7}:auto`, 'Delete archipelago: ' + (await keys()));

  // 7. A file loads to the state it was saved from and takes no slot; a file of another build is refused.
  const before = await keys();
  await pickFile(file); await done(); await pause();
  check((await hash()) === h3, 'File round trip: ' + (await hash()) + ' against ' + h3);
  check((await keys()).join() === before.join(), 'A loaded file took a slot: ' + (await keys()));
  const d = JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); d.build = 'old0000000';
  const other = path.join(tmp, 'other.json'); fs.writeFileSync(other, JSON.stringify(d));
  await page.click('#regen'); await landing(); await savesOpen();
  await pickFile(other); await page.waitForSelector('#savesBody .save-msg');
  check((await page.locator('#savesBody .save-msg').innerText()).includes(OTHER), 'a file of another build: no message');
  await shot('saves-other-build.png');

  // Screenshots: the generation screen, and the phone.
  if (out) {
    await page.click('#savesClose'); await page.click('#landNew'); await page.waitForSelector('#genScreen:not([hidden])'); await shot('gen.png');
    await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await shot('gen-phone.png');
    await reload(); await landing(); await shot('landing-phone.png');
    await savesOpen(); await shot('saves-landing-phone.png');
    await reload('#pt7'); await done(); await pause();
    await page.evaluate(() => document.getElementById('savesBtn').click()); await page.waitForSelector('#savesBody .save-files'); await shot('saves-game-phone.png');
  }
  await browser.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  if (errors.length) { console.error(`browser-saves: ${errors.length} failure(s)`); process.exit(1); }
  console.log('browser-saves: ok (slots, reload, other build, delete, file, hidden, main menu)');
})().catch((e) => { console.error(e.stack || e); process.exit(1); });

// Saves in the page (VB-214), by hand: `node tests/browser-saves.js OUTDIR` plays a tiny map in real Chromium, saves to slots and a file,
// continues after a reload, deletes a save and an archipelago's saves, loads the file and a file of another build, and prints each result
// with screenshots in OUTDIR. It asserts nothing and is not in tests/run.js yet: VB-260 turns it into a test of verify.
const { chromium } = require('playwright'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..'), out = process.argv[2] || require('os').tmpdir();
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
const HOOK = 'let st = null, speed = 1, selPawn = -1;';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.VB_CHROMIUM || undefined }), page = await browser.newPage({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
  page.setDefaultTimeout(90000);
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push(e.stack || e.message));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.route('https://village.test/', (r) => r.fulfill({ contentType: 'text/html', body: fs.readFileSync(path.join(root, 'index.html'), 'utf8')
    .replace(HOOK, HOOK + ' window.__play = { get st() { return st; }, Sim, listSaves: () => listSaves(), saveTx: (...a) => saveTx(...a) };') }));
  const done = () => page.waitForFunction(() => document.getElementById('loader').classList.contains('done') && !!window.__play.st && document.getElementById('genScreen').hidden && document.getElementById('landing').hidden, null, { timeout: 90000 });
  const pause = () => page.evaluate(() => document.querySelector('[data-speed="0"]').click());
  const hash = () => page.evaluate(() => { const { st, Sim } = window.__play; const t = JSON.stringify(Sim.save(st)); let h = 0; for (let i = 0; i < t.length; i++) h = (h * 31 + t.charCodeAt(i)) | 0; return `${h} t=${st.t} pawn=${st.player && st.player.pawn}`; });
  const gen = async () => { await page.waitForFunction(() => !!window.__play && !document.getElementById('landing').hidden); await page.waitForTimeout(400); await page.screenshot({ path: out + '/landing.png' }); await page.click('#landLoad'); await page.waitForSelector('#savesBody .save-files'); return (await page.locator('#savesBody').innerText()).replace(/\n+/g, ' | '); };
  await page.goto('https://village.test/#pt7'); await done(); await page.waitForTimeout(300);
  await page.click('#playOfferYes'); await pause();
  await page.evaluate(() => { const { st, Sim } = window.__play; Sim.advance(st, Sim.DAY * 30); });
  const h1 = await hash();
  await page.click('#savesBtn'); await page.waitForSelector('#savesBody .save-files');
  await page.click('#savesBody [data-save="1"]'); await page.waitForSelector('#savesBody [data-load]');
  await page.evaluate(() => { const { st, Sim } = window.__play; Sim.advance(st, Sim.DAY * 100); });
  await page.click('#savesBody [data-save="3"]'); await page.waitForFunction(() => document.querySelectorAll('#savesBody [data-load]').length === 2);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#savesBody [data-file="save"]')]);
  const file = path.join(out, dl.suggestedFilename()); await dl.saveAs(file);
  const h3 = await hash();
  console.log('file:', dl.suggestedFilename(), fs.statSync(file).size, 'bytes');
  await page.screenshot({ path: out + '/menu2.png', });
  // a second archipelago, then one save made to look like another build's
  await page.goto('about:blank'); await page.goto('https://village.test/#st11'); await done(); await pause();
  await page.click('#savesBtn'); await page.waitForSelector('#savesBody .save-files');
  await page.click('#savesBody [data-save="2"]'); await page.waitForSelector('#savesBody [data-load]');
  await page.evaluate(() => window.__play.saveTx('readwrite', (m) => { const q = m.get('populous-7-120x85:3'); q.onsuccess = () => m.put({ ...q.result, build: 'old0000000' }); }));
  await page.goto('about:blank'); await page.goto('https://village.test/');
  console.log('gen:', await gen());
  await page.screenshot({ path: out + '/gen.png' });
  await pause();
  await page.click('#savesBody [data-load="populous-7-120x85:1"]'); await done();
  console.log('continue slot 1 same:', (await hash()) === h1);
  await page.click('#regen'); await gen();
  await page.click('#savesBody [data-del="populous-7-120x85:3"]'); await page.waitForTimeout(400);
  console.log('after Delete it:', (await page.evaluate(() => window.__play.listSaves())).map((l) => l.key).join(', '));
  await page.click('#savesBody [data-delarch="founders-11-120x85"]'); await page.waitForTimeout(400);
  console.log('after Delete archipelago:', (await page.evaluate(() => window.__play.listSaves())).map((l) => l.key).join(', '));
  await pause();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#savesBody [data-file="load"]')]);
  await fc.setFiles(file); await done();
  console.log('file round trip same:', (await hash()) === h3, '| slots after file load:', (await page.evaluate(() => window.__play.listSaves())).map((l) => l.key).join(', '));
  // a file of another build
  const zlib = require('zlib'), d = JSON.parse(zlib.gunzipSync(fs.readFileSync(file))); d.build = 'old0000000';
  fs.writeFileSync(out + '/other.json', JSON.stringify(d));
  await page.click('#regen'); await gen();
  const [fc2] = await Promise.all([page.waitForEvent('filechooser'), page.click('#savesBody [data-file="load"]')]);
  await fc2.setFiles(out + '/other.json'); await page.waitForSelector('#savesBody .save-msg');
  console.log('other-build file:', await page.locator('#savesBody .save-msg').innerText());
  await page.setViewportSize({ width: 390, height: 844 }); await page.waitForTimeout(300); await page.screenshot({ path: out + '/gen-phone.png' });
  console.log('errors:', errs.length, errs.slice(0, 3).join(' / '));
  await browser.close();
})();

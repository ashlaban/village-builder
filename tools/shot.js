// Screenshots of the built page (VB-004): any scenario, seed and map, advanced some years, with the Land overlay or other toggles on; the whole
// island and close-ups of the largest villages, or of a given point. Playwright on a scratch copy of index.html that exposes the state and the
// camera, as docs/stability/shots.js; PixiJS from node_modules.
//   node tools/shot.js --scenario populous --seed 7 --size t --years 10 --land --out /tmp/shots [--tag x] [--close 2] [--at X,Y,Z] [--html file]
// Sizes: t(iny), s(mall), m(edium), l(arge). Writes <tag>-island.jpg, <tag>-close<k>.jpg and <tag>-info.json (villages, their land).
const root = require('path').join(__dirname, '..'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require(root + '/node_modules/playwright');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scenario = opt('scenario', 'populous'), seed = opt('seed', '7'), size = opt('size', 't'), years = +opt('years', 0), tag = opt('tag', `${scenario}-${seed}-${size}-y${years}`);
const outDir = path.resolve(opt('out', '.')), closeN = +opt('close', 1), at = opt('at', null), land = args.includes('--land'), htmlPath = opt('html', path.join(root, 'index.html'));
const pixi = fs.readFileSync(root + '/node_modules/pixi.js/dist/pixi.min.js');
const html = fs.readFileSync(htmlPath, 'utf8').replace('let st = null, speed = 1, selPawn = -1;',
  'let st = null, speed = 1, selPawn = -1; window.__vb = { get st() { return st; }, cam: () => cam, Sim: () => Sim, '
  + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = z; zt = z; vel.x = vel.y = 0; } };');
if (!html.includes('window.__vb')) throw new Error('hook not found: the page script changed');
fs.mkdirSync(outDir, { recursive: true });
const page_ = path.join(os.tmpdir(), `vb-shot-${process.pid}.html`); fs.writeFileSync(page_, html);
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
    ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
  await page.goto('file://' + page_);
  await page.waitForFunction(() => !document.getElementById('genScreen').hidden, null, { timeout: 60000 });
  await page.evaluate(([sz, sd, sc]) => {
    document.getElementById('genScenario').value = sc; document.getElementById('genSize').value = sz; document.getElementById('genSeed').value = sd;
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  }, [size, seed, scenario]);
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 180000 });
  await page.click('[data-speed="0"]').catch(() => {});
  const t0 = Date.now();
  await page.evaluate(async (n) => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    for (let d = 0; d < n * Sim.YEAR_DAYS; d++) { Sim.advance(st, Sim.DAY); if (d % 12 === 11) await new Promise((r) => setTimeout(r, 0)); }
    st.visualDirty = true;
  }, years);
  console.error(`${tag}: advanced ${years} years in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (land) await page.click('#landBtn');
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => {
    const st = window.__vb.st, Sim = window.__vb.Sim(), held = Sim.holdings(st);
    return { W: st.w.W, H: st.w.H, t: st.t, pop: st.pawns.filter((p) => p.alive).length, claims: st.claims.size,
      villages: st.villages.map((v) => ({ id: v.id, name: v.name, x: st.w.hx[v.center], y: st.w.hy[v.center], farms: v.farmsteads.length,
        land: held.villages.get(v.id) || null })) };
  });
  fs.writeFileSync(path.join(outDir, `${tag}-info.json`), JSON.stringify(info, null, 1));
  const shoot = async (name, x, y, z) => {
    await page.evaluate(([x, y, z]) => window.__vb.view(x, y, z), [x, y, z]);
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => document.getElementById('lod').hidden, null, { timeout: 90000 }).catch(() => console.error('painting not finished for', name));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, name), type: 'jpeg', quality: 82 }); console.error('shot', path.join(outDir, name));
  };
  await shoot(`${tag}-island.jpg`, info.W / 2, info.H / 2, Math.min(1440 / info.W, 900 / info.H));
  if (at) { const [x, y, z] = at.split(',').map(Number); await shoot(`${tag}-at.jpg`, x, y, z || 0.6); }
  const big = [...info.villages].sort((a, b) => b.farms - a.farms || a.id - b.id);
  for (let k = 0; k < Math.min(closeN, big.length); k++) await shoot(`${tag}-close${k + 1}.jpg`, big[k].x, big[k].y, 0.6);
  await browser.close();
  fs.unlinkSync(page_);
})().catch((e) => { console.error(e); process.exit(1); });

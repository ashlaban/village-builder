// Before/after screenshots for the stability review: Playwright on a scratch copy of a built index.html (this one, or another checkout's) that
// exposes the state and camera, as docs/cities/shots.js; PixiJS from this checkout's node_modules. Advances the populous map a day at a time.
//   node docs/stability/shots.js --html index.html --tag after --seed 7 --size t --years 60 --out docs/img [--fx X --fy Y: the close-up's centre]
const root = require('path').join(__dirname, '../..'), { chromium } = require(root + '/node_modules/playwright'), fs = require('fs'), path = require('path'), os = require('os');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const htmlPath = opt('html'), tag = opt('tag', 'x'), seed = opt('seed', '7'), size = opt('size', 't'), years = +opt('years', 60), outDir = path.resolve(opt('out', '.'));
const pixi = fs.readFileSync(root + '/node_modules/pixi.js/dist/pixi.min.js');
const html = fs.readFileSync(htmlPath, 'utf8').replace('let st = null, speed = 1, selPawn = -1;',
  'let st = null, speed = 1, selPawn = -1; window.__vb = { get st() { return st; }, cam: () => cam, Sim: () => Sim, '
  + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = z; zt = z; vel.x = vel.y = 0; } };');
if (!html.includes('window.__vb')) throw new Error('hook not found');
const page_ = path.join(os.tmpdir(), `vb-shots-${tag}.html`); fs.writeFileSync(page_, html);
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('file://' + page_);
  await page.waitForFunction(() => !document.getElementById('genScreen').hidden, null, { timeout: 60000 });
  await page.evaluate(([sz, sd]) => {
    document.getElementById('genScenario').value = 'populous'; document.getElementById('genSize').value = sz; document.getElementById('genSeed').value = sd;
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  }, [size, seed]);
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
  await page.waitForTimeout(5000);
  const t0 = Date.now();
  await page.evaluate(async (n) => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    for (let d = 0; d < n * Sim.YEAR_DAYS; d++) { Sim.advance(st, Sim.DAY); if (d % 48 === 47) await new Promise((r) => setTimeout(r, 0)); }
    st.visualDirty = true;
  }, years);
  console.error(`${tag}: advanced ${years} years in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.click('[data-speed="0"]').catch(() => {});
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    return { W: st.w.W, H: st.w.H, pop: st.pawns.filter((p) => p.alive).length, villages: st.villages.map((v) => ({ name: v.name, x: st.w.hx[v.center], y: st.w.hy[v.center],
      farms: v.farmsteads.length, people: st.pawns.filter((p) => p.alive && p.household !== null && Sim.settlementIdOf(st, p) === v.id).length })) };
  });
  fs.writeFileSync(path.join(outDir, `${tag}-info.json`), JSON.stringify(info));
  const shoot = async (name, x, y, z, wait = 3000) => {
    await page.evaluate(([x, y, z]) => window.__vb.view(x, y, z), [x, y, z]);
    await page.waitForTimeout(wait);
    await page.waitForFunction(() => document.getElementById('lod').hidden, null, { timeout: 90000 }).catch(() => console.error('painting not finished for', name));
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, name), type: 'jpeg', quality: 82 }); console.error('shot', name);
  };
  await shoot(`${tag}-island.jpg`, info.W / 2, info.H / 2, Math.min(1440 / info.W, 900 / info.H), 6000);
  const fx = +opt('fx', 0), fy = +opt('fy', 0); // a close-up at a fixed map point when given, else the most populous village
  const big = [...info.villages].sort((a, b) => b.people - a.people)[0];
  await shoot(`${tag}-close.jpg`, fx || big.x, fy || big.y, 0.9, 6000);
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

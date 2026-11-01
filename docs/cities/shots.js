// Screenshots for the cities review (docs/review-cities.md): Playwright on a scratch copy of index.html that exposes the state and camera,
// PixiJS served from node_modules as in tests/browser.js. Not part of the game and not under test.
//   node docs/cities/shots.js --seed 7 --size t --years 40 --out docs/img
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '../..'), args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = opt('seed', '7'), size = opt('size', 't'), years = +opt('years', 40), outDir = path.resolve(opt('out', 'docs/img')), scenario = opt('scenario', 'populous');
const pixi = fs.readFileSync(path.join(root, 'node_modules/pixi.js/dist/pixi.min.js'));
// expose st and the camera to page.evaluate
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8').replace('let st = null, speed = 1, selPawn = -1;',
  'let st = null, speed = 1, selPawn = -1; window.__vb = { get st() { return st; }, cam: () => cam, Sim: () => Sim };');
const page_ = path.join(os.tmpdir(), 'vb-cities.html'); fs.writeFileSync(page_, html);
(async () => {
  const browser = await chromium.launch(), page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route(/^https?:\/\//, (r) => /pixi(\.min)?\.js/.test(r.request().url()) ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' }));
  await page.goto('file://' + page_);
  await page.waitForFunction(() => !document.getElementById('genScreen').hidden, null, { timeout: 60000 });
  await page.evaluate(([sc, sz, sd]) => {
    document.getElementById('genScenario').value = sc; document.getElementById('genSize').value = sz; document.getElementById('genSeed').value = sd;
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  }, [scenario, size, seed]);
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 120000 });
  await page.waitForTimeout(5000); // the intro flight
  // advance in the page, a day at a time as the debug skip does, then let it redraw
  const t0 = Date.now();
  await page.evaluate(async (n) => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    for (let d = 0; d < n * Sim.YEAR_DAYS; d++) { Sim.advance(st, Sim.DAY); if (d % 48 === 47) await new Promise((r) => setTimeout(r, 0)); }
    // stop at the start of winter after the last moving round: on to autumn day 12
    st.visualDirty = true;
  }, years);
  console.error(`advanced ${years} years in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  await page.click('[data-speed="0"]').catch(() => {});
  await page.waitForTimeout(4000);
  const info = await page.evaluate(() => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    return st.villages.map((v) => ({ id: v.id, name: v.name, x: st.w.hx[v.center], y: st.w.hy[v.center], farms: v.farmsteads.length, crowded: v.crowded,
      founded: !!v.founded, people: st.pawns.filter((p) => p.alive && p.household !== null && Sim.settlementIdOf(st, p) === v.id).length }));
  });
  fs.writeFileSync(path.join(os.tmpdir(), 'vb-cities-villages.json'), JSON.stringify(info));
  const shoot = async (name, x, y, z, wait = 3500) => {
    await page.evaluate(([x, y, z]) => { const c = window.__vb.cam(); c.x = x; c.y = y; c.z = z; }, [x, y, z]);
    await page.waitForTimeout(wait); await page.screenshot({ path: path.join(outDir, name), type: 'jpeg', quality: 82 }); console.error('shot', name);
  };
  // the whole island, then the largest crowded village close up, then the settlers panel
  const xs = info.map((v) => v.x), ys = info.map((v) => v.y), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const span = Math.max(Math.max(...xs) - Math.min(...xs), (Math.max(...ys) - Math.min(...ys)) * 1.6) + 600;
  await shoot(`cities-island-y${years}.jpg`, cx, cy, 1440 / span, 6000);
  const big = [...info].sort((a, b) => (b.crowded - a.crowded) || (b.people - a.people))[0];
  await shoot(`cities-crowded-y${years}.jpg`, big.x, big.y, 1.1, 6000);
  await page.click('#settlersBtn'); await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(outDir, `cities-settlers-y${years}.jpg`), type: 'jpeg', quality: 82 }); console.error('shot settlers');
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });

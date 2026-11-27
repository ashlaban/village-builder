// usage: node docs/mocks/roads/heat.js [--seed 3] [--farms 10] [--years 4] [--out DIR]
//   Where a village's people actually walk (thread "Redesign road layout for hex maps", Kim 27 Nov: "go into the path finder, I want
//   the actual paths"): one village grown by the simulation as tools/village-shot.js grows one, and in its last game year every walk
//   a pawn sets out on (sim/legs setOut: the route search's tiles, as the points the pawn walks through) drawn into a raster of the
//   village, one count per walk per cell it passes. Writes heat-<seed>.json and heat-<seed>-map.jpg; heat.py draws the heat map.
const root = require('path').join(__dirname, '..', '..', '..'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require(root + '/node_modules/playwright');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const seed = +opt('seed', 3), farms = +opt('farms', 10), years = +opt('years', 4), cols = 60, rows = 42;
const outDir = path.resolve(opt('out', path.join(__dirname, 'img', 'heat')));
const shot = fs.readFileSync(root + '/tools/village-shot.js', 'utf8');
const seedSrc = shot.slice(shot.indexOf('function seedVillage('), shot.indexOf('\n}\n', shot.indexOf('function seedVillage(')) + 2);
const pixi = fs.readFileSync(root + '/node_modules/pixi.js/dist/pixi.min.js');
const HOOKS = [
  ['let st = null,\n  speed = 1,\n  selPawn = -1;', 'let st = null,\n  speed = 1,\n  selPawn = -1; window.__vb = { get st() { return st; }, Sim: () => Sim, '
    + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = z; zt = z; vel.x = vel.y = 0; }, '
    + 'clearSky() { for (const c of clouds) { c.spr.destroy(); c.sh.destroy(); } clouds = []; } };'],
  ['const SIZES = { t: [120, 85],', `const SIZES = { x: [${cols}, ${rows}], t: [120, 85],`],
  ['Sim.seed(wd, seed, scenario, custom ? custom.places : null)', 'window.__seedVillage(wd, seed)'],
];
HOOKS.push([/a\.seg = 0;\s*begin\(st, a\);/, 'if (window.__walkLog) window.__walkLog(a.path, a); a.seg = 0; begin(st, a);']);
let html = require(root + '/tests/lib/page').builtPage();
for (const [from, to] of HOOKS) { if (typeof from === 'string' ? !html.includes(from) : !from.test(html)) throw new Error('hook not found: ' + String(from).slice(0, 40)); html = html.replace(from, () => to); }
const page_ = path.join(os.tmpdir(), `vb-heat-${process.pid}.html`);
fs.writeFileSync(page_, html);
fs.mkdirSync(outDir, { recursive: true });
(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
    page.on('pageerror', (e) => console.error('page error:', e.message));
    await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
      ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
    await page.addInitScript(`window.__seedVillage = (w, seed) => (${seedSrc})(w, seed, ${farms});`);
    await page.goto('file://' + page_);
    await page.waitForFunction(() => !document.getElementById('landing').hidden, null, { timeout: 60000 });
    await page.evaluate((sd) => {
      const size = document.getElementById('genSize'); size.add(new Option('Shot', 'x')); size.value = 'x';
      document.getElementById('genSeed').value = sd;
      document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
    }, String(seed));
    await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 180000 });
    await page.evaluate(() => { const b = document.getElementById('chooseWatch'); if (b) b.click(); });
    await page.evaluate(() => { const b = document.querySelector('[data-speed="0"]'); if (b) b.click(); });
    const data = await page.evaluate(async (years) => {
      const st = window.__vb.st, Sim = window.__vb.Sim(), w = st.w;
      const v = st.villages[0], fsx = v.farmsteads.map((id) => st.farmsteads[id]);
      const tiles = [v.center, ...fsx.flatMap((fm) => [fm.house, ...fm.fields.map((fd) => fd.tile)])];
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const t of tiles) { x0 = Math.min(x0, w.hx[t]); x1 = Math.max(x1, w.hx[t]); y0 = Math.min(y0, w.hy[t]); y1 = Math.max(y1, w.hy[t]); }
      const M = 3 * w.R; x0 = Math.floor(x0 - M); y0 = Math.floor(y0 - M); x1 = Math.ceil(x1 + M); y1 = Math.ceil(y1 + M);
      const S = 1, GW = Math.ceil((x1 - x0) / S), GH = Math.ceil((y1 - y0) / S), grid = new Float32Array(GW * GH), mark = new Int32Array(GW * GH);
      let walk = 0, walks = 0;
      const log = (pts) => { // each cell a walk passes counts once for that walk
        walk++; walks++;
        for (let k = 1; k < pts.length; k++) {
          const [ax, ay] = pts[k - 1], [bx, by] = pts[k], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / (S * 0.5)));
          for (let s = 0; s <= n; s++) {
            const gx = Math.floor((ax + ((bx - ax) * s) / n - x0) / S), gy = Math.floor((ay + ((by - ay) * s) / n - y0) / S);
            if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) continue;
            const c = gy * GW + gx;
            if (mark[c] !== walk) { mark[c] = walk; grid[c]++; }
          }
        }
      };
      const days = years * Sim.YEAR_DAYS, from = (years - 1) * Sim.YEAR_DAYS;
      for (let d = 0; d < days; d++) {
        if (d === from) window.__walkLog = log;
        Sim.advance(st, Sim.DAY);
        if (d % 12 === 11) await new Promise((r) => setTimeout(r, 0));
      }
      window.__walkLog = null;
      st.visualDirty = true;
      let bin = ''; const u8 = new Uint8Array(grid.buffer); for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode(...u8.subarray(i, i + 8192));
      return { cols: w.COLS, rows: w.ROWS, R: w.R, hx: Array.from(w.hx), hy: Array.from(w.hy), water: Array.from(w.water), river: Array.from(w.river),
        dev: Array.from(w.dev), worn: Array.from(w.worn), name: v.name, centre: v.center, well: v.well,
        houses: fsx.map((fm) => fm.house), fields: fsx.flatMap((fm) => fm.fields.map((fd) => fd.tile)),
        pop: st.pawns.filter((p) => p.alive).length, box: [x0, y0, x1, y1], S, GW, GH, grid: btoa(bin), walks };
    }, years);
    data.seed = seed; data.years = years;
    fs.writeFileSync(path.join(outDir, `heat-${seed}.json`), JSON.stringify(data));
    await page.evaluate(() => window.__vb.clearSky());
    await page.evaluate(() => document.getElementById('uiToggle').click());
    await page.addStyleTag({ content: '#uiToggle, #lod { visibility: hidden !important; }' });
    const hs = data.houses; let x = 0, y = 0; for (const h of hs) { x += data.hx[h]; y += data.hy[h]; }
    await page.evaluate(([x, y]) => window.__vb.view(x, y, 1.6), [x / hs.length, y / hs.length]);
    await page.waitForTimeout(3000);
    await page.waitForFunction(() => document.getElementById('lod').hidden, null, { timeout: 90000 }).catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, `heat-${seed}-map.jpg`), type: 'jpeg', quality: 88 });
    console.log(`${data.name}: ${data.houses.length} farms, ${data.pop} people; ${data.walks} walks in the last game year`);
  } finally { await browser.close(); fs.unlinkSync(page_); }
})().catch((e) => { console.error(e); process.exit(1); });

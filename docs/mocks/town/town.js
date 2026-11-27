// usage: node docs/mocks/town/town.js [--seed 5] [--cols 48] [--rows 34] [--scale 2] [--out DIR] [--labels]
//   A mock of a town as the map would show it (thread "Mock a town in the game", 27 November 2026): throwaway, not game code.
//   A real generated island, a village or two seeded as tools/village-shot.js seeds one, and a town placed by hand from plan.js:
//   its plots, church, market, quay, crafts, gardens, fields and roads, drawn by art.js in the manner of the farm art (page/farmart).
//   --labels   the whole island with each land tile's col,row written on it, to place a town by hand (writes labels.jpg)
//   --seed N   the island (default: plan.js's seed); --cols, --rows its size in tiles (default: plan.js's)
//   --scale S  device pixel ratio (default 2); --out DIR where the shots go (default: docs/mocks/town/img)
//   --only K   only the shot named K (see plan.js's shots)
//   --plan F   another plan (plan-hex.js: each hex a quarter of houses, as a farm is a hex of buildings)
//   --night    the shots at dusk as well (not yet)
// Writes <name>.jpg for each of plan.js's shots, desk (1440 by 900) and phone (390 by 844).
const root = require('path').join(__dirname, '..', '..', '..'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require(root + '/node_modules/playwright');
const args0 = process.argv.slice(2), planAt = args0.indexOf('--plan');
const plan = require(planAt >= 0 ? require('path').resolve(args0[planAt + 1]) : './plan.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, has = (k) =>
  args.includes('--' + k);
if (has('help')) { console.log(fs.readFileSync(__filename, 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n')); process.exit(0); }
const seed = +opt('seed', plan.seed), cols = +opt('cols', plan.cols), rows = +opt('rows', plan.rows), scale = +opt('scale', 2);
const outDir = path.resolve(opt('out', path.join(__dirname, 'img'))), only = opt('only', null);
const pixi = fs.readFileSync(root + '/node_modules/pixi.js/dist/pixi.min.js');
const artSrc = fs.readFileSync(path.join(__dirname, 'art.js'), 'utf8');
// Hooks into the page script: the state and camera, a map size of our own, our seeding in place of a scenario's, and the town's art
// spliced into the page's closure, where it can use the farm art's brushes (artKit, MP, logWall, turfRoof...) and the map's layers.
const HOOKS = [
  ['let st = null,\n  speed = 1,\n  selPawn = -1;', 'let st = null,\n  speed = 1,\n  selPawn = -1; window.__vb = { get st() { return st; }, Sim: () => Sim, '
    + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = z; zt = z; vel.x = vel.y = 0; }, '
    + 'clearSky() { for (const c of clouds) { c.spr.destroy(); c.sh.destroy(); } clouds = []; } }; '
    + 'window.__town = { draw: (P) => townDraw(P), labels: () => townLabels() };'],
  ['const SIZES = { t: [120, 85],', `const SIZES = { x: [${cols}, ${rows}], t: [120, 85],`],
  ['Sim.seed(wd, seed, scenario, custom ? custom.places : null)', 'window.__seedTown(wd, seed)'],
  ['})();\n</script>\n</body>', artSrc + '\n})();\n</script>\n</body>'],
];
let html = require(root + '/tests/lib/page').builtPage();
for (const [from, to] of HOOKS) {
  if (!html.includes(from)) throw new Error(`hook not found: the page script changed (${from.slice(0, 60)})`);
  html = html.replace(from, () => to);
}
fs.mkdirSync(outDir, { recursive: true });
const page_ = path.join(os.tmpdir(), `vb-town-${process.pid}.html`);
fs.writeFileSync(page_, html);

// In the page, before the land is painted: the villages of the plan, seeded as tools/village-shot.js seeds one, and the town's ground
// marked as built on (w.dev 1: no trees or stones are painted there) and its roads worn to lanes (w.worn 3, drawn by draw/paths).
function seedTown(w, seed, P) {
  const VB = window.VB, { settlementGenerator } = VB['sim/layout'], { populousHouseholds, drawSize } = VB['sim/people'];
  const { fromState, drawer } = VB['sim/rng'], S = fromState((seed * 2654435761) ^ 0x7177), rand = drawer(S);
  const T = ([c, r]) => r * w.COLS + c, gen = settlementGenerator(w, rand), sizes = [];
  const vs = P.labels ? [] : P.villages || [];
  if (!vs.length) { // a village on the best site of the largest island, as village-shot seeds one, so that the page has a state
    const { findSite } = VB['sim/layout'], comp = VB['sim/hex'].landComponents(w);
    let big = 0; for (let i = 0; i < w.N; i++) if (!w.water[i]) big = Math.max(big, comp.size[comp.id[i]]);
    const c = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] === big);
    vs.push({ at: [c % w.COLS, (c / w.COLS) | 0], farms: 2 });
  }
  for (const v of vs) {
    const t = T(v.at);
    if (w.water[t]) throw new Error(`village ${v.at} is on water`);
    for (const fid of gen.addVillage(t, v.farms).farmsteads) { sizes[fid] = drawSize(rand); if (sizes[fid] >= 7) gen.addField(fid); }
  }
  const { used, farmsteads, villages } = gen.finish();
  const R = { rand, pawns: [], unions: [], ...VB['sim/records'].nameKit(rand) };
  const st = VB['sim/scenarios'].makeState(w, S, R, populousHouseholds(R, farmsteads, sizes), farmsteads, villages, used, 'populous');
  VB['sim/society'].initCulture(st, null); VB['sim/heirs'].countDemand(st);
  for (const hh of st.households) hh.grain = { barley: 400 };
  VB['sim/herds'].populousHerds(st); VB['sim/meadows'].placeMeadows(st);
  VB['sim/territory'].seedOutland(st, true);
  VB['sim/scenarios'].startStreams(st, seed);
  VB['sim/carts'].seedCarts(st, true);
  if (!P.labels) for (const k of Object.keys(P.tiles || {})) for (const cr of P.tiles[k]) if (!w.water[T(cr)]) w.dev[T(cr)] = Math.max(w.dev[T(cr)], 1);
  if (!P.labels) for (const road of P.roads || []) for (const cr of road) { const t = T(cr); if (!w.water[t]) { w.worn[t] = 3; if (w.crossing) w.crossing[t] = 99; } }
  return st;
}

async function main() {
  const browser = await chromium.launch();
  try {
    let shots = has('labels') ? (opt('at', null) ? [{ name: 'labels-zoom', at: opt('at').split(',').slice(0, 2).map(Number), zoom: +opt('at').split(',')[2] }] : [{ name: 'labels', whole: true }]) : plan.shots.filter((s) => !only || s.name === only);
    for (const dev of has('labels') ? ['desk'] : ['desk', 'phone']) {
      const vp = dev === 'desk' ? { width: 1440, height: 900 } : { width: 390, height: 844 };
      const list = dev === 'phone' ? shots.filter((s) => !s.whole) : shots;
      const page = await browser.newPage({ viewport: vp, deviceScaleFactor: scale });
      page.on('pageerror', (e) => console.error('page error:', e.message));
      await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
        ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
      const P = { ...plan, labels: has('labels') };
      await page.addInitScript(`window.__seedTown = (w, seed) => (${seedTown.toString()})(w, seed, ${JSON.stringify(P)});`);
      await page.goto('file://' + page_);
      await page.waitForFunction(() => !document.getElementById('landing').hidden, null, { timeout: 60000 });
      await page.evaluate((sd) => {
        const size = document.getElementById('genSize'); size.add(new Option('Shot', 'x')); size.value = 'x';
        document.getElementById('genSeed').value = sd;
        document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
      }, String(seed));
      await page.waitForFunction(() => document.getElementById('loader').classList.contains('done') || window.__vb.st === null, null, { timeout: 180000 });
      await page.waitForTimeout(1500);
      await page.evaluate(() => { const b = document.getElementById('chooseWatch'); if (b) b.click(); });
      await page.evaluate(() => { const b = document.querySelector('[data-speed="0"]'); if (b) b.click(); });
      await page.evaluate(() => window.__vb.clearSky && window.__vb.clearSky());
      await page.evaluate(() => document.getElementById('uiToggle') && document.getElementById('uiToggle').click());
      await page.addStyleTag({ content: '#uiToggle, #lod { visibility: hidden !important; }' });
      const info = await page.evaluate((P) => window.__town.draw(P), P);
      for (const s of list) {
        const [x, y, z] = s.whole ? [info.W / 2, info.H / 2, Math.min(vp.width / info.W, vp.height / info.H)]
          : [s.at[0], s.at[1], dev === 'desk' ? s.zoom : s.zoomPhone || s.zoom];
        const [cx, cy] = s.whole ? [x, y] : await page.evaluate(([c, r, dx, dy]) => window.__town.at(c, r, dx, dy), [...s.at, s.dx || 0, s.dy || 0]);
        await page.evaluate(([x, y, z]) => window.__vb.view(x, y, z), [cx, cy, z]);
        await page.waitForTimeout(2500);
        await page.waitForFunction(() => document.getElementById('lod').hidden, null, { timeout: 90000 }).catch(() => console.error('painting not finished for', s.name));
        await page.waitForTimeout(800);
        const file = path.join(outDir, s.whole || has('labels') ? `${s.name}.jpg` : `${dev}-${s.name}.jpg`);
        await page.screenshot({ path: file, type: 'jpeg', quality: 88 });
        console.log(file);
      }
      await page.close();
    }
  } finally { await browser.close(); fs.unlinkSync(page_); }
}
main().catch((e) => { console.error(e); process.exit(1); });

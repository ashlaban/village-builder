// usage: node tools/village-shot.js [--seed 7] [--farms 8] [--cols 40] [--rows 28] [--years 0] [--out DIR]
//   screenshots of one generated village on a really tiny generated island, to judge how villages and roads look
//   the island is a real generated one, only small (the page's Tiny map is 120 by 85); the village stands on its best site, as the populous
//   scenario builds a village: houses, fields, fence, herds, meadows and the paths worn in by the years it has stood
//   writes <tag>-world.jpg (the whole island), <tag>-village.jpg (the village) and <tag>-info.json (its tiles) into DIR (default: the current directory)
//   --seed N      the seed of the island and the village (default 7); --seeds 1,7,11 shoots several, one set of files each
//   --farms N     farms asked for (default 8); a house whose fields find no room is not built
//   --cols N, --rows N   the island's size in tiles (default 40 by 28; under about 30 by 22 there is little land)
//   --years Y     game years to advance before the shots (default 0: as generated)
//   --zoom Z      the zoom of the village shot (default: fits the village; 2.6 is the closest the page goes)
//   --ui          keep the interface in the shots (hidden by default)
//   --clouds      keep the clouds (cleared by default: they hide the village on the whole-island shot)
//   --land        with the Land overlay on
//   --scale S     device pixel ratio (default 2: 2880 by 1800 pixels; 1 for a quick look)
//   --tag NAME    the files' prefix (default village-<seed>-<farms>f-y<years>)
//   --html FILE   another build of the page (default index.html: run python3 build.py first)
// The page is driven as tools/shot.js drives it: Playwright on a scratch copy of index.html, PixiJS from node_modules. The village is seeded as
// tests/lib/tiny.js seeds a state (the settlement generator, then the populous households, herds, meadows and outland), not by a scenario.
require('./help.js')(__filename);
const root = require('path').join(__dirname, '..'), fs = require('fs'), path = require('path'), os = require('os');
const { chromium } = require(root + '/node_modules/playwright');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; }, has = (k) =>
  args.includes('--' + k);
const seeds = String(opt('seeds', opt('seed', '7'))).split(',').map(Number), farms = +opt('farms', 8), cols = +opt('cols', 40), rows = +opt('rows', 28);
const years = +opt('years', 0), zoom = +opt('zoom', 0), scale = +opt('scale', 2), outDir = path.resolve(opt('out', '.'));
const htmlPath = opt('html', path.join(root, 'index.html'));
if (seeds.some((s) => !(s >= 0)) || !(farms >= 1) || !(cols >= 12) || !(rows >= 12)) {
  console.error('village-shot: bad options; see --help'); process.exit(2); }
const pixi = fs.readFileSync(root + '/node_modules/pixi.js/dist/pixi.min.js');
// Three hooks into the page script: the state and camera, a map size of our own, and our seeding in place of a scenario's.
const HOOKS = [
  ['let st = null,\n  speed = 1,\n  selPawn = -1;', 'let st = null,\n  speed = 1,\n  selPawn = -1; window.__vb = { get st() { return st; }, Sim: () => Sim, '
    + 'view(x, y, z) { stopIntro(); cam.x = x; cam.y = y; cam.z = z; zt = z; vel.x = vel.y = 0; }, '
    + 'clearSky() { for (const c of clouds) { c.spr.destroy(); c.sh.destroy(); } clouds = []; } };'],
  ['const SIZES = { t: [120, 85],', `const SIZES = { x: [${cols}, ${rows}], t: [120, 85],`],
  ['Sim.seed(wd, seed, scenario, custom ? custom.places : null)', 'window.__seedVillage(wd, seed)'],
];
let html = fs.readFileSync(htmlPath, 'utf8');
for (const [from, to] of HOOKS) {
  if (!html.includes(from)) throw new Error(`hook not found: the page script changed (${from})`);
  html = html.replace(from, to);
}
fs.mkdirSync(outDir, { recursive: true });
const page_ = path.join(os.tmpdir(), `vb-village-shot-${process.pid}.html`); fs.writeFileSync(page_, html);

// In the page: one village of `farms` farms on the best site of world w.
function seedVillage(w, seed, farms) {
  const VB = window.VB, { settlementGenerator, findSite } = VB['sim/layout'], { populousHouseholds, drawSize } = VB['sim/people'];
  const { fromState, drawer, splitStreams } = VB['sim/rng'], comp = VB['sim/hex'].landComponents(w);
  const S = fromState((seed * 2654435761) ^ 0x7177), rand = drawer(S), gen = settlementGenerator(w, rand), sizes = [];
  let big = 0; for (let i = 0; i < w.N; i++) if (!w.water[i]) big = Math.max(big, comp.size[comp.id[i]]);
  const centre = findSite(w, rand, comp, (i) => comp.size[comp.id[i]] === big); // on the largest island
  if (centre < 0) throw new Error('no village site on this island');
  for (const fid of gen.addVillage(centre, farms).farmsteads) { sizes[fid] = drawSize(rand); if (sizes[fid] >= 7) gen.addField(fid); }
  const { used, farmsteads, villages } = gen.finish();
  const R = { rand, pawns: [], unions: [], ...VB['sim/records'].nameKit(rand) };
  const st = VB['sim/scenarios'].makeState(w, S, R, populousHouseholds(R, farmsteads, sizes), farmsteads, villages, used, 'populous');
  VB['sim/society'].initCulture(st, null); VB['sim/heirs'].countDemand(st);
  for (const hh of st.households) hh.grain = { barley: 400 }; // enough for the years of a shot; nobody's balance is judged here
  VB['sim/herds'].populousHerds(st); VB['sim/meadows'].placeMeadows(st);
  VB['sim/territory'].seedOutland(st, true);
  splitStreams(st, seed);
  return st;
}

async function shootSeed(browser, seed) {
  const tag = opt('tag', null) ? opt('tag') + (seeds.length > 1 ? `-${seed}` : '') : `village-${seed}-${farms}f-y${years}`;
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.route(/^https?:\/\//, (r) => (/pixi(\.min)?\.js/.test(r.request().url())
    ? r.fulfill({ contentType: 'application/javascript', body: pixi }) : r.fulfill({ contentType: 'text/css', body: '' })));
  await page.addInitScript(`window.__seedVillage = (w, seed) => (${seedVillage.toString()})(w, seed, ${farms});`);
  await page.goto('file://' + page_);
  await page.waitForFunction(() => !document.getElementById('landing').hidden, null, { timeout: 60000 });
  await page.evaluate((sd) => {
    const size = document.getElementById('genSize'); size.add(new Option('Shot', 'x')); size.value = 'x';
    document.getElementById('genSeed').value = sd;
    document.getElementById('genForm').dispatchEvent(new Event('submit', { cancelable: true }));
  }, String(seed));
  await page.waitForFunction(() => document.getElementById('loader').classList.contains('done'), null, { timeout: 180000 });
  if (await page.evaluate(() => !window.__vb.st)) {
    console.error(`${tag}: no village fits this island; try another seed or a larger one`); await page.close(); return false; }
  await page.evaluate(() => { const b = document.getElementById('chooseWatch'); if (b) b.click(); }); // leave the choice of whom to play
  await page.evaluate(() => { const b = document.querySelector('[data-speed="0"]'); if (b) b.click(); });
  await page.evaluate(async (n) => {
    const st = window.__vb.st, Sim = window.__vb.Sim();
    for (let d = 0; d < n * Sim.YEAR_DAYS; d++) { Sim.advance(st, Sim.DAY); if (d % 12 === 11) await new Promise((r) => setTimeout(r, 0)); }
    st.visualDirty = true;
  }, years);
  if (has('land')) await page.evaluate(() => document.getElementById('landBtn').click());
  if (!has('clouds')) await page.evaluate(() => window.__vb.clearSky());
  if (!has('ui')) { await page.evaluate(() => document.getElementById('uiToggle').click()); await page.addStyleTag({ content: '#uiToggle, #lod { visibility: hidden !important; }' }); }
  const info = await page.evaluate(() => {
    const st = window.__vb.st, w = st.w, v = st.villages[0], fs = v.farmsteads.map((id) => st.farmsteads[id]);
    const tiles = [v.center, ...fs.flatMap((f) => [f.house, ...f.fields.map((fd) => fd.tile)])];
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const t of tiles) { x0 = Math.min(x0, w.hx[t]); x1 = Math.max(x1, w.hx[t]); y0 = Math.min(y0, w.hy[t]); y1 = Math.max(y1, w.hy[t]); }
    const worn = [0, 0, 0, 0]; for (let i = 0; i < w.N; i++) if (!w.water[i] && w.dev[i] < 2) worn[w.worn[i]]++;
    return { W: w.W, H: w.H, R: w.R, cols: w.COLS, rows: w.ROWS, name: v.name, centre: v.center, pop: st.pawns.filter((p) => p.alive).length,
      box: [x0, y0, x1, y1], worn: { trodden: worn[1], path: worn[2], lane: worn[3] },
      farms: fs.map((f) => ({ id: f.id, name: f.name, house: f.house, fields: f.fields.map((fd) => fd.tile) })) };
  });
  info.seed = seed; info.years = years;
  fs.writeFileSync(path.join(outDir, `${tag}-info.json`), JSON.stringify(info, null, 1));
  const shoot = async (name, x, y, z) => {
    await page.evaluate(([x, y, z]) => window.__vb.view(x, y, z), [x, y, z]);
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => document.getElementById('lod').hidden, null, { timeout: 90000 }).catch(() =>
      console.error('painting not finished for', name));
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(outDir, name), type: 'jpeg', quality: 86 }); console.log(path.join(outDir, name));
  };
  await shoot(`${tag}-world.jpg`, info.W / 2, info.H / 2, Math.min(1440 / info.W, 900 / info.H));
  const [x0, y0, x1, y1] = info.box, pad = 4 * info.R; // the houses and fields, and a little of the land round them
  const fit = Math.min(2.6, 1440 / (x1 - x0 + 2 * pad), 900 / (y1 - y0 + 2 * pad));
  await shoot(`${tag}-village.jpg`, (x0 + x1) / 2, (y0 + y1) / 2, zoom || fit);
  console.log(`${tag}: ${info.name}, ${info.farms.length} of ${farms} farms, ${info.pop} people, on ${info.cols} by ${info.rows} tiles; `
    + `worn tiles: ${info.worn.trodden} trodden, ${info.worn.path} path, ${info.worn.lane} lane`);
  await page.close();
  return true;
}
(async () => {
  const browser = await chromium.launch();
  let ok = true;
  try { for (const seed of seeds) ok = (await shootSeed(browser, seed)) && ok; } finally { await browser.close(); fs.unlinkSync(page_); }
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error(e); process.exit(1); });

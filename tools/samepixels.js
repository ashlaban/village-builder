// Is the map drawn as it was? Bakes the same chunks headless (on @napi-rs/canvas) with the working tree's code and with a base commit's (a
// temporary git worktree of it, as tools/same.js makes), and compares their hashes. The proof for a refactor of the bake, the marks, the
// rivers' or the paths' drawing, which tools/same.js, comparing the leaves of `w` and `st`, cannot give (VB-1489). Nothing is recorded.
// usage: node tools/samepixels.js [--base REF] [--seeds 7,42] [--map tiny|small|medium|large] [--years N] [--scenario founders]
//   defaults: base HEAD (so: the uncommitted work against the last commit), seeds 7 and 42, small, 2 years, founders
//   --base REF   the commit the work started from (`git merge-base HEAD origin/main`), a branch or a tag
// What each tree bakes, at each seed: on the generated world, the sea (bakeWater) and every chunk of the overview (level 2); a level 0
// chunk before a tile's cover is set by hand (gen/cover set), after it and after restore; then, seeded with the scenario at year 0 and
// after the years, the sea, the overview, and round each village the 3 by 3 level 0 chunks and its level 1 chunk. A chunk is drawn as
// the page's chunkJob draws it: bakeChunk, the rivers, the worn paths (drawChunk, and drawOver, hashed apart as `.way`), decorateChunk
// (with sprites of flat colour made here: the page's are page code). Prints `same: ...` and exits 0, or each chunk that differs and
// exits 1; a tree whose restored chunk is not the chunk before the cover was set says so (`stale`) and exits 1 too.
// A run takes about 10 seconds at the defaults (two seeds, two trees, side by side; most of it the generation and the years).
require('./help.js')(__filename);
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] }; // as tools/sim.js
const root = path.join(__dirname, '..');

// ---- the adapter: the drawing functions of one tree, wherever its modules keep them ----
// The one place the terrain split (VB-1490 to VB-1493) changes: draw/ modules are looked in first, then world/, then gen/ and the gen
// facade (ArchGen), so that the base and the working tree are each found without being told. A module is found by the function it
// exports and, where two share a name (rivers' and paths' drawChunk), by its key.
function modules(VB, re = /./) {
  const rank = (k) => (k.startsWith('draw/') ? 0 : k.startsWith('world/') ? 1 : k === 'gen' ? 3 : 2);
  return Object.keys(VB).filter((k) => /^(draw|world|gen)(\/|$)/.test(k) && re.test(k) && VB[k] && typeof VB[k] === 'object')
    .sort((a, b) => rank(a) - rank(b) || (a < b ? -1 : 1)).map((k) => VB[k]);
}
function find(VB, name, re) {
  const m = modules(VB, re).find((x) => name in x);
  if (!m) throw new Error(`no ${name}${re ? ` in a module matching ${re}` : ''}: tools/samepixels.js's adapter needs to learn where it went`);
  return m[name];
}
function drawing(VB) {
  const LV = find(VB, 'LV'), TEX = find(VB, 'TEX'), G = VB.gen, cover = modules(VB, /cover/).find((m) => m.set && m.keep && m.restore);
  const bakeWater = find(VB, 'bakeWater'), bakeChunk = find(VB, 'bakeChunk'), decorate = find(VB, 'decorateChunk');
  const rivers = find(VB, 'drawChunk', /rivers/), paths = find(VB, 'drawChunk', /paths/), over = find(VB, 'drawOver', /paths/);
  if (!cover) throw new Error('no cover module with set, keep and restore: tools/samepixels.js\'s adapter needs to learn where it went');
  return {
    LV, TEX, generate: find(VB, 'generate'), B: find(VB, 'B'),
    water: (w, ctx) => bakeWater(w, ctx),
    // as page/chunks chunkJob: the land, the rivers, the worn paths and their ways over fields, the marks
    *chunk(w, l, ctx, cx, cy, S, make) {
      const img = ctx.createImageData(TEX, TEX);
      yield* bakeChunk(w, l, cx, cy, img);
      ctx.putImageData(img, 0, 0);
      rivers(w, ctx, LV[l], cx, cy, l === 0);
      paths(w, ctx, LV[l], cx, cy, l);
      const way = over(w, LV[l], cx, cy, l, make);
      decorate(w, ctx, l, cx, cy, S);
      return way;
    },
    setCover: (w, i, b) => cover.set(G, w, i, b), keep: (w) => cover.keep(w), restore: (w, kept) => cover.restore(w, kept),
  };
}

// ---- baking and hashing ----
const canvasLib = () => require(path.join(root, 'node_modules', '@napi-rs', 'canvas'));
const hash = (canvas) => crypto.createHash('sha1').update(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data).digest('hex').slice(0, 16);
// Sprites of flat colour, one each, at the page's sizes (page/stookart landSprites: 3 texels a unit), so that which sprite and where shows.
function sprites() {
  const { createCanvas } = canvasLib(), S = { broad: [], pine: [], shrub: [] };
  const mk = (w, h, k, n) => {
    const c = createCanvas(w * 3, h * 3), g = c.getContext('2d');
    g.fillStyle = `rgb(${(40 + k * 23) % 256},${(90 + n * 37) % 256},${(60 + k * n * 11) % 256})`;
    g.beginPath(); g.ellipse(w * 1.5, h * 1.5, w * 1.4, h * 1.4, 0, 0, Math.PI * 2); g.fill();
    return c;
  };
  for (let v = 0; v < 10; v++) S.broad.push(mk(28, 30, 0, v));
  for (let v = 0; v < 8; v++) S.pine.push(mk(20, 34, 1, v));
  for (let v = 0; v < 4; v++) S.shrub.push(mk(12, 10, 2, v));
  return S;
}
// A painter on one tree: out[name] = hash. sea(label), chunk(label, l, cx, cy), overview(label), round(label, tiles).
function painter(VB, out = {}) {
  const D = drawing(VB), { createCanvas } = canvasLib(), S = sprites(), make = (w, h) => createCanvas(w, h);
  const P = {
    D, out,
    sea(w, label) { const c = createCanvas(w.CW, w.CH); D.water(w, c.getContext('2d')); return (out[`${label}/sea`] = hash(c)); },
    chunk(w, label, l, cx, cy) {
      const c = createCanvas(D.TEX, D.TEX), it = D.chunk(w, l, c.getContext('2d'), cx, cy, S, make); let r;
      while (!(r = it.next()).done);
      out[`${label}/l${l}/${cx},${cy}.way`] = r.value ? hash(r.value) : 'none';
      return (out[`${label}/l${l}/${cx},${cy}`] = hash(c));
    },
    overview(w, label) {
      const s = D.LV[2].size;
      for (let cy = 0; cy < Math.ceil(w.H / s); cy++) for (let cx = 0; cx < Math.ceil(w.W / s); cx++) P.chunk(w, label, 2, cx, cy);
    },
    // the level 0 chunks round each tile (3 by 3) and its level 1 chunk, each chunk once
    round(w, label, tiles) {
      const done = new Set(), one = (l, cx, cy) => {
        const s = D.LV[l].size, k = `${l} ${cx} ${cy}`;
        if (cx < 0 || cy < 0 || cx * s >= w.W || cy * s >= w.H || done.has(k)) return;
        done.add(k); P.chunk(w, label, l, cx, cy);
      };
      for (const t of tiles) {
        const x = w.hx[t], y = w.hy[t];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) one(0, Math.floor(x / D.LV[0].size) + dx, Math.floor(y / D.LV[0].size) + dy);
        one(1, Math.floor(x / D.LV[1].size), Math.floor(y / D.LV[1].size));
      }
    },
  };
  return P;
}

// A land tile near the map's middle given another cover by hand, its level 0 chunk baked before, after and once restored. Returns the
// tile, or -1 if no land tile took the cover.
function coverCase(P, w, label) {
  const { D } = P, mx = w.W / 2, my = w.H / 2, land = [];
  for (let i = 0; i < w.N; i++) if (!w.water[i]) land.push(i);
  land.sort((a, b) => Math.hypot(w.hx[a] - mx, w.hy[a] - my) - Math.hypot(w.hx[b] - mx, w.hy[b] - my) || a - b);
  const kept = D.keep(w);
  for (const i of land) {
    const b = w.biome[i] === D.B.FOREST ? D.B.MEADOW : D.B.FOREST, cx = Math.floor(w.hx[i] / D.LV[0].size), cy = Math.floor(w.hy[i] / D.LV[0].size);
    const before = P.chunk(w, `${label}/cover-before`, 0, cx, cy);
    if (!D.setCover(w, i, b)) continue;
    P.chunk(w, `${label}/cover-set`, 0, cx, cy);
    D.restore(w, kept);
    const after = P.chunk(w, `${label}/cover-restored`, 0, cx, cy);
    if (after !== before) P.out[`${label}/stale`] = `the level 0 chunk ${cx},${cy} restored is not the chunk before tile ${i}'s cover was set`;
    return i;
  }
  return -1;
}

// One tree at one seed, in a process of its own: { name: hash }.
function dump(tree, scenario, seed, map, years) {
  const VB = require(path.join(tree, 'src', 'load.js')), Sim = VB.sim, P = painter(VB), [cols, rows] = SIZES[map];
  const it = P.D.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done);
  const w = r.value, at = `s${seed}`;
  P.sea(w, `${at}/world`); P.overview(w, `${at}/world`);
  coverCase(P, w, `${at}/world`);
  const st = Sim.seed(w, seed, scenario), shoot = (label) => {
    P.sea(w, label); P.overview(w, label); P.round(w, label, st.villages.map((v) => v.center));
  };
  shoot(`${at}/year0`);
  if (years > 0) { Sim.advance(st, years * Sim.YEAR); shoot(`${at}/year${years}`); }
  return P.out;
}

// The names whose hashes differ, or that one side has and the other not; and each side's stale restores.
function compare(a, b) {
  const names = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !k.endsWith('/stale')).sort();
  return { differ: names.filter((k) => a[k] !== b[k]), stale: [...Object.entries(a).filter(([k]) => k.endsWith('/stale')).map(([k, v]) => `base ${k}: ${v}`),
    ...Object.entries(b).filter(([k]) => k.endsWith('/stale')).map(([k, v]) => `work ${k}: ${v}`)] };
}

const run = (args) => new Promise((resolve, reject) => {
  const p = cp.spawn(process.execPath, [__filename, '--dump', ...args], { stdio: ['ignore', 'pipe', 'pipe'] }); let out = '', err = '';
  p.stdout.on('data', (d) => { out += d; }); p.stderr.on('data', (d) => { err += d; });
  p.on('close', (code) => (code ? reject(new Error(`bake of ${args[0]} failed:\n${err.trim()}`)) : resolve(JSON.parse(out))));
});

async function main(argv) {
  const arg = (name, fallback) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : fallback; };
  const known = ['--base', '--seeds', '--map', '--years', '--scenario'];
  const stray = argv.filter((a, i) => a.startsWith('--') ? !known.includes(a) : !known.includes(argv[i - 1]));
  if (stray.length) throw new Error(`unknown option ${stray[0]} (--help lists them)`);
  const base = arg('--base', 'HEAD'), map = arg('--map', 'small'), years = Number(arg('--years', 2)), scenario = arg('--scenario', 'founders');
  const seeds = arg('--seeds', '7,42').split(',').map(Number);
  if (!SIZES[map] || !Number.isInteger(years) || years < 0 || seeds.some((s) => !Number.isInteger(s))) throw new Error('bad --map, --years or --seeds');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vb-samepixels-')), tree = path.join(tmp, 'base');
  const git = (...a) => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = git('rev-parse', '--short', `${base}^{commit}`);
  git('worktree', 'add', '--detach', tree, commit);
  const a = {}, b = {};
  try {
    const got = await Promise.all(seeds.flatMap((s) => [tree, root].map((t) => run([t, scenario, String(s), map, String(years)]))));
    got.forEach((h, k) => Object.assign(k % 2 ? b : a, h));
  } finally {
    git('worktree', 'remove', '--force', tree);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  const { differ, stale } = compare(a, b), what = `${Object.keys(b).length} images, ${scenario} at seeds ${seeds.join(', ')}, ${map}, years 0 and ${years}, against ${base} (${commit})`;
  for (const s of stale) console.log(`stale: ${s}`);
  if (!differ.length && !stale.length) { console.log(`same: the sea, the overview and the chunks round each village, ${what}`); return; }
  for (const k of differ) console.log(`${k}: ${a[k] || '(absent)'} → ${b[k] || '(absent)'}`);
  console.log(`differs: ${differ.length} of ${stale.length ? `, ${stale.length} stale restores` : ''}, ${what}`);
  process.exitCode = 1;
}

module.exports = { drawing, painter, coverCase, dump, compare, modules };
if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] === '--dump') process.stdout.write(JSON.stringify(dump(a[1], a[2], Number(a[3]), a[4], Number(a[5]))));
  else main(a).catch((e) => { console.error('samepixels: ' + e.message); process.exitCode = 2; });
}

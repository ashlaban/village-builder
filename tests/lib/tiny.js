// Tiny worlds for fast tests (VB-155): a world drawn as a text map, one character a tile, and a state with villages placed by hand through the
// real generators, so a rule is tested in milliseconds on land drawn for the case instead of a generated island run for years.
//   const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
//   const w = tinyWorld([
//     '..........',
//     '..FF....~~',
//     '.........~',
//   ]);
//   const st = tinyState(w, [{ at: [2, 1], farms: 2 }, { at: [8, 2], farms: 1 }], { seed: 7 });
// Rows run north to south, columns west to east; odd rows are shifted half a tile east, as the generator lays them (pointy-top, odd-r).
// Characters: . meadow, h heath, m marsh, F forest, P pine, ^ hills, M mountain, * snow, ~ sea, o lake, , beach.
const VB = require('../../src/load.js'), G = VB.gen, { B, mulberry32 } = G;
const CHARS = { '.': B.MEADOW, h: B.HEATH, m: B.MARSH, F: B.FOREST, P: B.PINE, '^': B.HILLS, M: B.MOUNTAIN, '*': B.SNOW, '~': B.SEA, o: B.LAKE, ',': B.BEACH };
const DIR_EVEN = [[1, 0], [0, -1], [-1, -1], [-1, 0], [-1, 1], [0, 1]], DIR_ODD = [[1, 0], [1, -1], [0, -1], [-1, 0], [0, 1], [1, 1]];

// rows: array of equal-length strings. opt.stones: stones on every meadow tile (0..255, default 0); opt.seed: for the fixed tile noise.
function tinyWorld(rows, opt = {}) {
  const ROWS = rows.length, COLS = rows[0].length, N = COLS * ROWS, R = 28, SQ3 = Math.sqrt(3), HW = SQ3 * R, AP = (SQ3 / 2) * R;
  if (rows.some((r) => r.length !== COLS)) throw new Error('tinyWorld: rows of different lengths');
  const W = Math.ceil(HW * (COLS + 0.5)), H = Math.ceil(1.5 * R * (ROWS - 1) + 2 * R), STEP = 16, CW = Math.ceil(W / STEP) + 2, CH = Math.ceil(H / STEP) + 2;
  const hx = new Float32Array(N), hy = new Float32Array(N), he = new Float32Array(N), hp = new Float32Array(N), hm = new Float32Array(N);
  const biome = new Uint8Array(N), water = new Uint8Array(N), ocean = new Uint8Array(N), hrnd = new Float32Array(N), nb = new Int32Array(N * 6);
  const trees = new Float32Array(N), treesMax = new Uint8Array(N), stones = new Uint8Array(N), landDist = new Int16Array(N);
  const rand = mulberry32(opt.seed ?? 1);
  for (let row = 0; row < ROWS; row++) for (let col = 0; col < COLS; col++) {
    const i = row * COLS + col, ch = rows[row][col], b = CHARS[ch];
    if (b === undefined) throw new Error(`tinyWorld: unknown tile '${ch}' at ${col}, ${row}`);
    hx[i] = HW * (col + 0.5 * (row & 1)) + AP; hy[i] = 1.5 * R * row + R;
    biome[i] = b; water[i] = b === B.SEA || b === B.LAKE ? 1 : 0; ocean[i] = b === B.SEA ? 1 : 0;
    he[i] = water[i] ? -0.1 : b === B.HILLS ? 0.5 : b === B.MOUNTAIN || b === B.SNOW ? 0.8 : 0.2; hp[i] = water[i] ? 0 : he[i];
    hm[i] = b === B.MARSH ? 0.8 : b === B.HEATH ? 0.25 : 0.5; hrnd[i] = rand();
    if (b === B.FOREST || b === B.PINE) trees[i] = treesMax[i] = b === B.PINE ? 80 : 60;
    if (b === B.MEADOW) stones[i] = opt.stones ?? 0;
    landDist[i] = water[i] ? 1 : 0;
    const dirs = row & 1 ? DIR_ODD : DIR_EVEN;
    for (let d = 0; d < 6; d++) {
      const c2 = col + dirs[d][0], r2 = row + dirs[d][1];
      nb[i * 6 + d] = c2 >= 0 && c2 < COLS && r2 >= 0 && r2 < ROWS ? r2 * COLS + c2 : -1;
    }
  }
  const land = N - water.reduce((s, x) => s + x, 0), CN = CW * CH;
  return {
    seed: opt.seed ?? 1, name: 'Tiny', R, COLS, ROWS, RR: 7, W, H, HW, AP, N, STEP, CW, CH, KS: W / 3264,
    elev: new Float32Array(CN), shade: new Float32Array(CN).fill(1), macro: new Float32Array(CN).fill(0.5), cdist: new Float32Array(CN), chex: new Int32Array(CN),
    csample: () => 0.5, hx, hy, he, hp, hm, biome, water, ocean, hrnd, nb, landDist,
    region: new Int32Array(N), regions: [{ cq: 0, cr: 0, tiles: N, land, label: 1 }],
    tr: new Float32Array(N), tg: new Float32Array(N), tb: new Float32Array(N), ang: new Float32Array(2 * N), trees, treesMax, stones,
    river: new Uint16Array(N), riverTo: new Int32Array(N).fill(-1), crossing: new Uint8Array(N), rivers: [],
  };
}
// The tile index at column col, row row.
const tileAt = (w, col, row) => row * w.COLS + col;

// A state on world w with villages at given tiles: [{at: [col, row], farms, sizes: [household sizes]}], built as the populous scenario builds
// its villages (houses round the green, each farm's fields one block beyond the yards), with its households, culture and owners.
// opt.seed (default 1); opt.fields: seed fields per farm as generated (default: as the generator places them); opt.customs: practice to set
// in every village, e.g. {dispute: 'kin'}. Nothing is advanced: st.t is the start of year 1.
function tinyState(w, villages, opt = {}) {
  const { settlementGenerator } = VB['sim/layout'], { populousHouseholds, drawSize } = VB['sim/people'];
  const { nameKit } = VB['sim/records'], { makeState } = VB['sim/scenarios'], { initCulture } = VB['sim/society'];
  const rand = mulberry32(((opt.seed ?? 1) * 2654435761) ^ 0x7177), gen = settlementGenerator(w, rand), sizes = [];
  for (const v of villages) {
    const c = Array.isArray(v.at) ? tileAt(w, v.at[0], v.at[1]) : v.at;
    const made = gen.addVillage(c, v.farms);
    made.farmsteads.forEach((fid, k) => { sizes[fid] = v.sizes ? v.sizes[k] : drawSize(rand); });
  }
  const { used, farmsteads, villages: vs } = gen.finish();
  const R = { rand, pawns: [], unions: [], ...nameKit(rand) };
  const households = populousHouseholds(R, farmsteads, sizes);
  const st = makeState(w, rand, R, households, farmsteads, vs, used, 'populous');
  initCulture(st, null); st.countDemand();
  if (opt.customs) for (const s of st.cenv.settlements) setPractice(st, s.id, opt.customs);
  return st;
}
// Sets village vid's practice of the given customs: {key: option key}.
function setPractice(st, vid, customs) {
  const C = VB.culture, s = st.cenv.settlements[vid];
  for (const [key, opt] of Object.entries(customs)) {
    const k = C.IDX[key], o = C.optIndex(key, opt);
    if (k === undefined || o < 0) throw new Error(`setPractice: no custom ${key}: ${opt}`);
    s.practice[k] = o;
  }
}
module.exports = { tinyWorld, tinyState, tileAt, setPractice, CHARS };

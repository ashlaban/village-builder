// Small deliberate village for contracts that do not depend on generated geography.
const { tinyWorld, tinyState } = require('./tiny.js');
const world = () => tinyWorld(Array(18).fill('.'.repeat(28)), { seed: 7 });
const state = () => tinyState(world(), [{ at: [7, 9], farms: 2, sizes: [6, 5] },
  { at: [21, 9], farms: 2, sizes: [5, 4] }], { seed: 7, herds: true });
// Small generated islands (VB-853), for the rules that need a scenario's own seeding or generated land, at a tenth of a second each: 36 by 26
// (as tests/page.js), and 48 by 34 for heirs, whose two debug villages need the room. A save names its size, so island(data.seed, data)
// generates the same world again. Each island is generated once per seed and size in a test process (VB-872), and every call hands out a
// fresh copy of it: its arrays copied, so that what a run changes (trees, stones, deposits left, anything it adds) stays in that copy; its
// one function (the colour sampler, which reads only the generator's own fields) shared.
// The probe islands keep the open island's cover (heath 0.3, meadow 0.54: COVER before the journey scale, VB-780): at the game's, half
// the land is forest and a 36 by 26 island holds some 30 meadow tiles, too few for the villages its tests seat. The terrain's costs and
// the speed are the game's. A size with `cover: null` is generated at the game's cover (the page's showcase island, tests/start.js).
const OPEN = { heath: 0.3, meadow: 0.54 };
const SMALL = { cols: 36, rows: 26 }, ROOMY = { cols: 48, rows: 34 }, made = new Map();
const copy = (v) => (ArrayBuffer.isView(v) ? v.slice() : typeof v === 'function' || v === null || typeof v !== 'object' ? v : structuredClone(v));
// generate() makes one anew, for a test of the generator's determinism, which a copy cannot show.
const generate = (seed = 7, size = SMALL) => {
  const cover = size.cover === undefined ? OPEN : size.cover;
  const it = require('../../src/load.js').gen.generate(seed, { cols: size.cols, rows: size.rows, ...(cover ? { cover } : {}) }); let r;
  while (!(r = it.next()).done);
  return r.value;
};
const island = (seed = 7, size = SMALL) => {
  const key = `${seed} ${size.cols} ${size.rows} ${size.cover === null ? 'game' : 'open'}`;
  if (!made.has(key)) made.set(key, generate(seed, size));
  return Object.fromEntries(Object.entries(made.get(key)).map(([k, v]) => [k, copy(v)]));
};
const scenario = (name, seed = 7) => require('../../src/load.js').sim.seed(island(seed, name === 'heirs' ? ROOMY : SMALL), seed, name);
module.exports = { world, state, island, generate, scenario, SMALL, ROOMY, OPEN };

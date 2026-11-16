// Small deliberate village for contracts that do not depend on generated geography.
const { tinyWorld, tinyState } = require('./tiny.js');
const world = () => tinyWorld(Array(18).fill('.'.repeat(28)), { seed: 7 });
const state = () => tinyState(world(), [{ at: [7, 9], farms: 2, sizes: [6, 5] },
  { at: [21, 9], farms: 2, sizes: [5, 4] }], { seed: 7, herds: true });
// Small generated islands (VB-853), for the rules that need a scenario's own seeding or generated land, at a tenth of a second each: 36 by 26
// (as tests/page.js), and 48 by 34 for heirs, whose two debug villages need the room. A save names its size, so island(data.seed, data)
// generates the same world again.
const SMALL = { cols: 36, rows: 26 }, ROOMY = { cols: 48, rows: 34 };
const island = (seed = 7, size = SMALL) => {
  const it = require('../../src/load.js').gen.generate(seed, { cols: size.cols, rows: size.rows }); let r;
  while (!(r = it.next()).done);
  return r.value;
};
const scenario = (name, seed = 7) => require('../../src/load.js').sim.seed(island(seed, name === 'heirs' ? ROOMY : SMALL), seed, name);
module.exports = { world, state, island, scenario, SMALL, ROOMY };

// Small deliberate village for contracts that do not depend on generated geography.
const { tinyWorld, tinyState } = require('./tiny.js');
const world = () => tinyWorld(Array(18).fill('.'.repeat(28)), { seed: 7 });
const state = () => tinyState(world(), [{ at: [7, 9], farms: 2, sizes: [6, 5] },
  { at: [21, 9], farms: 2, sizes: [5, 4] }], { seed: 7, herds: true });
module.exports = { world, state };

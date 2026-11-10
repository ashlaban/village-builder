// VB-088: the same terrain strip, farm layout and family demographics repeated at two and four villages.
const assert = require('assert'), VB = require('../src/load.js'), { tinyWorld } = require('./lib/tiny.js');
const { measure, growth, check, NAMES } = require('./lib/cost.js');

function villageWorld(n) {
  const strip = Array(28).fill('FFF' + '.'.repeat(25));
  const w = tinyWorld(strip.map((row) => row.repeat(n)), { seed: 7 }), rng = VB['sim/rng'];
  let stream = rng.fromState(7);
  const rand = () => rng.next(stream);
  // Fixed layout draws keep name-collision retries from changing the next village's geometry.
  const gen = VB['sim/layout'].settlementGenerator(w, () => 0.5);
  for (let i = 0; i < n; i++) {
    gen.addVillage(14 + 28 * i + 14 * w.COLS, 3);
  }
  const { used, farmsteads, villages } = gen.finish(), records = VB['sim/records'];
  const layout = (v, offset) => v.farmsteads.map((fid) => {
    const f = farmsteads[fid], local = (tile) => [tile % w.COLS - offset, Math.floor(tile / w.COLS)];
    return { house: local(f.house), fields: f.fields.map((field) => local(field.tile)) };
  });
  for (let i = 1; i < n; i++) assert.deepStrictEqual(layout(villages[i], i * 28), layout(villages[0], 0), 'repeated farm layout');
  const R = { pawns: [], unions: [], ...records.nameKit(rand) }, households = [];
  for (const village of villages) {
    stream = rng.fromState(7);
    for (const fid of village.farmsteads) {
      const f = farmsteads[fid], members = [];
      // A married couple with four children; three adult children exercise the island-wide marriage pairs.
      for (const [sex, age] of [['m', 46], ['f', 44], ['m', 24], ['f', 22], ['m', 18], ['f', 10]]) {
        members.push(records.person(R, { sex, age, ...(members.length >= 2 ? { father: members[0], mother: members[1] } : {}) }));
      }
      records.marry(R, members[0], members[1], 25);
      households.push(records.makeHousehold(R, households.length, f, members, members[0]));
    }
  }
  const st = VB['sim/scenarios'].makeState(w, stream, R, households, farmsteads, villages, used, 'populous');
  VB['sim/society'].initCulture(st, null); VB['sim/heirs'].countDemand(st);
  VB['sim/herds'].populousHerds(st); VB['sim/meadows'].placeMeadows(st); VB['sim/territory'].seedOutland(st, true);
  for (const hh of households) {
    hh.grain = VB['sim/fields'].yearlyRations(st, hh) + farmsteads[hh.farmstead].fields.length * st.ECON.seedPerField;
  }
  rng.splitStreams(st, 7);
  assert.strictEqual(villages.length, n);
  assert.strictEqual(households.length, n * 3);
  assert.strictEqual(st.pawns.length, n * 18);
  return st;
}

function main() {
  const early = measure(villageWorld(2)), late = measure(villageWorld(4));
  for (const name of NAMES) {
    // These small working sets fit in the cache; routes.js separately exercises the eviction counter.
    if (name === 'routeEvict') assert(early.work[name] === 0 && late.work[name] === 0, 'tiny caches should not evict');
    // The fold of the record waits for the year's turn (VB-199), which 30 days do not reach; tests/record.js exercises it.
    else if (name === 'recordFold') assert(early.work[name] === 0 && late.work[name] === 0, 'no year turns in 30 days');
    else assert(early.work[name] > 0 && late.work[name] > 0, `scaling must exercise ${name}`);
  }
  console.log(`scaling: 2/4 villages, 30 days and one round each; ${early.living.toFixed(3)}/${late.living.toFixed(3)} mean living`);
  check('scaling', growth(early, late, true), { update: process.argv.includes('--update') });
  console.log(`scaling: ${NAMES.length} counters pass (including known excesses); ${(early.ms + late.ms).toFixed(0)} ms simulation`);
}
if (require.main === module) main();
module.exports = { villageWorld };

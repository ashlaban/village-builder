// VB-1666: the shelter, the ladder's first rung, on the house tile for every household (Kim: one rule for every household). (A settler
// household moves into a finished cottage since VB-787: tests/sites.js.) Before that, a settler
// household (sim/settle settleFarm; heirs at seed 13 on the probe island, as tests/settle.js) begins its shelter on its own house tile, no
// booth of st.booths beside it; it sleeps under the open sky and its cottage waits until the shelter stands, then the cottage's stages are
// worked on that same tile. A save from before VB-1666, a farm's booth staked beside its house, loads and goes on: the booth is kept as
// its roof until its cottage is roofed (read as the shelter rung once raised).
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim,
  S = VB['sim/settle'];
const { bfs } = VB['sim/hex'],
  { checkState } = require('./lib/invariants.js'),
  { scenario } = require('./lib/probe.js'),
  { tinyWorld } = require('./lib/tiny.js');
const B = VB['sim/building'],
  { rungOf } = VB['sim/ladder'],
  { BOOTH } = VB['sim/rules'];
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const roll = (st, f) => {
  const rs = new Set(Object.values(st.rng));
  rs.forEach((r) => (r.fix = 0));
  try {
    f();
  } finally {
    rs.forEach((r) => delete r.fix);
  }
};

// ---- 2. a save from before VB-1666: a farm's booth staked beside the house, no shelter; kept as a booth until the cottage is roofed ----
{
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: false });
  st.naturalDeaths = false;
  const hh = st.households[0],
    f = st.farmsteads[0];
  delete f.shelter; // as before VB-1666: the booth staked beside the house by the verb, its first roof
  let tile = -1;
  for (let d = 0; d < 6 && tile < 0; d++) {
    const n = st.w.nb[f.house * 6 + d];
    if (n >= 0 && B.raiseBoothWhy(st, hh.holder, n) === null) tile = n;
  }
  B.raiseBooth(st, hh.holder, tile);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(tinyWorld(rows), saved),
    bf = back.farmsteads[0];
  assert.strictEqual(bf.shelter, undefined, 'loaded with no shelter');
  assert(B.roofless(back, back.households[0]) && rungOf(back, bf) === 'camp', 'roofless while its booth is staked');
  let raised = null;
  for (let i = 0; i < Sim.SEASON_DAYS * 24 && raised === null; i++) {
    Sim.advance(back, 1);
    if (back.booths.some((b) => b.tile === tile)) raised = back.t;
  }
  assert(raised !== null, 'the booth raised');
  assert(!B.roofless(back, back.households[0]) && rungOf(back, bf) === 'shelter', 'under the booth, read as the shelter rung');
  assert.strictEqual(bf.shelter, undefined, 'no shelter made for it');
  sound(back, 'an older save, its booth raised');
}
assert(BOOTH.hours > 0);
console.log(
  'shelter: an older save\'s booth kept',
);

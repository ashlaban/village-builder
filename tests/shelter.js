// VB-1638: the shelter, the ladder's first rung, on the house tile for every household (Kim: one rule for every household). A settler
// household (sim/settle settleFarm; heirs at seed 13 on the probe island, as tests/settle.js) begins its shelter on its own house tile, no
// booth of st.booths beside it; it sleeps under the open sky and its cottage waits until the shelter stands, then the cottage's stages are
// worked on that same tile. A save from before VB-1638, a farm's booth staked beside its house, loads and goes on: the booth is kept as
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

// ---- 1. a settler household: its shelter on its house tile, then its cottage there ----
{
  const st = scenario('heirs', 13);
  st.naturalDeaths = false;
  const v = st.villages[0];
  const inA = (p) =>
    p.alive && p.age >= 18 && p.age <= 45 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id) && Sim.spouseOf(st, p.id) === null;
  const m = st.pawns.find((p) => inA(p) && Sim.siblingsOf(st, p.id).some((q) => inA(st.pawns[q])));
  const sib = Sim.siblingsOf(st, m.id).map((q) => st.pawns[q]).find(inA);
  for (const [t] of bfs(st.w, v.center, 6, () => true).dist) st.used.add(t);
  for (const u of st.villages) VB['sim/territory'].reckonWood(st, u);
  st.demand = [m.id, sib.id];
  m.landWait = 2;
  sib.landWait = 2;
  m.stake = 300;
  const farms = st.farmsteads.length,
    booths = st.booths.length;
  roll(st, () => S.settleRound(st));
  const f = st.farmsteads[farms];
  assert(f, 'a farm settled');
  const hh = st.households[f.household];
  assert.strictEqual(f.booth, true, 'no cottage yet');
  assert.deepStrictEqual(f.shelter, { wood: 0, done: 0, built: null, cond: 1, condAt: st.t }, 'its shelter begun');
  assert.strictEqual(st.booths.length, booths, 'no booth of st.booths for it');
  assert(Sim.stakedBooths(st).includes(f.house), 'the page reads it being raised on the house tile');
  assert(B.roofless(st, hh), 'under the open sky until it stands');
  assert.strictEqual(rungOf(st, f), 'camp');
  assert.strictEqual(Sim.farmView(st, f.id).building.what, 'shelter');
  sound(st, 'settled');
  let stood = null,
    staged = false;
  for (let d = 0; d < Sim.SEASON_DAYS * 2 && !staged; d++) {
    for (let h = 0; h < 24; h++) {
      Sim.advance(st, 1);
      const stage = st.jobs.get(`booth:f${f.id}`);
      if (stage) {
        assert(stood !== null, `a cottage stage (${stage.kind}) posted before the shelter stands`);
        assert.strictEqual(stage.site, f.house, 'the cottage worked on the shelter\'s tile');
        staged = true;
      }
      if (stood === null && B.shelterStands(st, f)) stood = st.t;
    }
  }
  assert(stood !== null, 'the shelter stands');
  assert(!B.roofless(st, hh) && rungOf(st, f) === 'shelter', 'under the shelter: the rung a shelter');
  assert(staged, 'the cottage begun on the same tile');
  assert.strictEqual(st.booths.length, booths, 'still no booth of st.booths for it');
  sound(st, 'the shelter up, the cottage under way');
}

// ---- 2. a save from before VB-1638: a farm's booth staked beside the house, no shelter; kept as a booth until the cottage is roofed ----
{
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: false });
  st.naturalDeaths = false;
  const hh = st.households[0],
    f = st.farmsteads[0];
  delete f.shelter; // as before VB-1638: the booth staked beside the house by the verb, its first roof
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
  'shelter: a settler household raises its shelter on its house tile, no booth, and its cottage there after; an older save\'s booth kept',
);

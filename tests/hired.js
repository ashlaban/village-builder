// Hired hands (VB-319): a head still short of hands after its asks hires a landless adult of its village (st.demand) whose own day has the
// hours, for a wage of 3 rations a day of 8 work hours (whole rations, rounded up) paid at the day's end from its grain as an obligation of
// the kind `wage` through sim/stores; the hand takes the field work of the hirer on the basis `hired`. A household below its floor does
// not hire; one that cannot pay owes the wage, overdue like a loan.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState } = require('./lib/tiny.js');
const { eligible } = VB['sim/eligibility'], Jobs = VB['sim/jobs'], Hands = VB['sim/hands'], Obligations = VB['sim/obligations'];
const { age } = VB['sim/records'], { MATCH } = VB['sim/roles'], Stores = VB['sim/stores'], { floorOf } = VB['sim/hunger'];
const make = () => {
  const st = tinyState(tinyWorld(Array(20).fill('.'.repeat(36))),
    [{ at: [8, 10], farms: 2, sizes: [7, 4] }, { at: [28, 10], farms: 1, sizes: [4] }], { seed: 4 });
  Sim.advance(st, 3);
  const [A, B] = [st.households[0], st.households[1]], fB = st.farmsteads[B.farmstead];
  const { freeHands, dropJob } = VB['sim/agents'];
  const dropAll = (key) => { for (const j of [...(st.jobsBy.get(key) || [])]) { if (j.claims.length) freeHands(st, j, -1); dropJob(st, j); } };
  dropAll(`household:${A.id}`); dropAll(`village:${fB.village}`); dropAll(`household:${B.id}`);
  const fd = fB.fields[0];
  fd.stage = 'stubble';
  const j = Jobs.post(st, `plow:f${fB.id}.${fd.id}`, 'plow', { type: 'household', id: B.id }, fd.tile, { field: fd, farm: fB });
  VB['sim/day'].allot(st, A, Sim.cal(st.t));
  Hands.HANDS.asks = 0; // no ask goes first: the hire is what is left
  const adults = A.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge && id !== A.holder);
  st.demand = adults;
  return { st, A, B, j, dropAll };
};
// ---- the hire, the work, the wage ----
{
  const { st, A, B, j, dropAll } = make();
  const grain = (h) => Stores.grainOf(h);
  Stores.put(st, B, Stores.grainGood('barley'), 300, 'harvest');
  Hands.askFor(st, B, 6, Sim.cal(st.t));
  const hired = Object.entries(st.handsToday.by).filter(([, e]) => e[4]);
  assert.ok(hired.length >= 1 && hired.length <= Hands.HANDS.hires, `hired ${hired.length}`);
  const [id, e] = [+hired[0][0], hired[0][1]];
  assert.ok(st.demand.includes(id) && e[0] === B.id && e[1] >= Hands.HANDS.least && e[1] <= 6, JSON.stringify(e));
  assert.strictEqual(eligible(st, j, st.pawns[id]), 'hired', 'the hand takes the field work as hired');
  assert.strictEqual(eligible(st, { ...j, kind: 'cook' }, st.pawns[id]), null, 'and no cooking');
  const t0 = st.t;
  while (Hands.on(st, id) !== null && st.t < t0 + 12) {
    Sim.advance(st, 0.1);
    dropAll(`household:${A.id}`);
    A.waterDay = B.waterDay = Sim.cal(st.t).day;
  }
  const worked = e[2], want = Math.ceil((worked * 3) / 8 - 1e-9);
  assert.ok(worked > 0, 'the hand worked');
  assert.strictEqual(VB.count.wagesPaidHired, want, 'the wage is paid whole');
  assert.ok(Obligations.due(st, { kind: 'pawn', id }, 'creditor', 'wage').length === 0, 'paid, nothing owed');
}
// ---- below the floor: no hire ----
{
  const { st, B } = make();
  Stores.take(st, B, Stores.grainGood('barley'), Stores.grainOf(B), 'harvest');
  assert.ok(Stores.grainOf(B) < floorOf(st, B));
  const n = VB.count.handsHired;
  Hands.askFor(st, B, 6, Sim.cal(st.t));
  assert.strictEqual(VB.count.handsHired, n, 'a household below its floor does not hire');
}
console.log('hired ok');

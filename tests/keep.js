// The alderman's keep (VB-463): under the practice `keep`, days owed at the autumn meeting (source 'keep'), ended by a vacancy; or a share of
// each other household's surplus set aside and fetched at the moving round, booked with the reason `keep`.
const assert = require('assert');
const VB = require('../src/load.js');
const { tinyWorld, tinyState, setPractice } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { OFFICE } = VB['sim/rules'];
const Ob = VB['sim/obligations'], Keep = VB['sim/keep'], Culture = VB.culture;
const map = ['..............', '...FF.........', '...FF.........', '..............', '..........FF..', '..............', '.........^^...', '..............', '~.............', '~~............'];
function world(option) {
  const st = tinyState(tinyWorld(map), [{ at: [3, 5], farms: 3 }], { seed: 7 });
  setPractice(st, 0, { keep: option });
  for (const h of st.households) h.grain.barley += 5000;
  const v = st.villages[0];
  v.alderman = st.households[st.farmsteads[v.farmsteads[0]].household].holder;
  return { st, v, s: st.cenv.settlements[0] };
}
assert.deepStrictEqual(Culture.DIMS[Culture.IDX.keep].opts.map((o) => o[0]), ['days', 'share', 'nothing']);
assert.strictEqual(Culture.fromArchetype('oldNordic')[Culture.IDX.keep], 0, 'days by default');
{
  const { st, v, s } = world('days');
  const hhA = st.pawns[v.alderman].household;
  const owedTo = () => Ob.due(st, { kind: 'household', id: hhA }, 'creditor', 'days');
  Keep.meeting(st, s);
  assert.strictEqual(owedTo().length, v.farmsteads.length - 1, 'each other farm owes');
  assert(owedTo().every((o) => o.source === 'keep' && o.owes.days === OFFICE.keepDays));
  Keep.meeting(st, s);
  assert.strictEqual(owedTo().length, v.farmsteads.length - 1, 'not owed twice');
  v.alderman = null; // a vacancy ends the days left
  Keep.meeting(st, s);
  assert.strictEqual(owedTo().length, 0);
  checkState(st);
}
{
  const { st, s } = world('nothing');
  Keep.meeting(st, s);
  Keep.round(st, 0);
  assert.strictEqual(st.obligations, undefined, 'nothing is owed under nothing');
}
{
  const { st, v } = world('share');
  const hhA = st.pawns[v.alderman].household,
    other = st.households.find((h) => h.id !== hhA);
  const before = VB['sim/stores'].grainOf(other);
  Keep.round(st, 0);
  assert(VB['sim/stores'].grainOf(other) < before, 'a share is set aside');
  assert(JSON.stringify(other.totals || []).includes('keep') || (other.ledger || []).some((e) => e.kind === 'keep'), 'with the reason keep');
  assert(v.keep.grain > 0 && v.keep.payers === v.farmsteads.length - 1);
  checkState(st);
}
console.log('keep: ok');

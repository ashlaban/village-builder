// @suite fast
// A head's remembered yield (VB-767; sim/yields): the tally of rations by source booked with each food operation, closed at winter's
// planning day into a ring of FIELDS.memory years, expects (poor, mean, years), caution from the head's bias; nothing else changes.
const VB = require('../src/load.js');
const { FIELDS, YEAR, TICKS } = VB['sim/rules'];
const Y = VB['sim/yields'], Stores = VB['sim/stores'], Traits = VB['sim/traits'];
const { checkState } = require('./lib/invariants.js');
const probe = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('YIELDS FAIL:', m); } };
const st = probe.state();
const hh = st.households[st.farmsteads[st.villages[0].farmsteads[0]].household];
const sum = (s) => (hh.yields ? hh.yields.tally[s] : 0);
const f0 = sum('fields');
Stores.put(st, hh, 'grain/barley', 10, { kind: 'harvest', crop: 'barley' }, undefined);
Stores.record(st, hh, 'milk', 4, 'milk');
Stores.record(st, hh, 'meat', 3, 'meat');
Stores.put(st, hh, 'fish', 2, 'catch');
Stores.put(st, hh, 'grain/barley', 5, { kind: 'gift', from: 'a neighbour' });
Stores.put(st, hh, 'wood', 5, 'start'); // no food
Stores.record(st, hh, 'milk', -1, 'cooking'); // taken out: no yield
const T = hh.yields.tally;
check(sum('fields') - f0 === 10 && T.animals === 7 && T.fish === 2 && T.gifts === 5 && T.wild === 0 && T.deals === 0 && T.work === 0, `tally ${JSON.stringify(T)}`);
check(Y.expects(st, hh, 'fields').years === 0 && Y.expects(st, hh, 'fields').mean === 0, 'no years: nothing');
const year = [10, 4, 8, 6];
for (let i = 0; i < year.length; i++) { hh.yields.tally.fields = year[i]; Y.close(hh, i + 1); if (i === 0) { const e = Y.expects(st, hh, 'fields'); check(e.poor === 0 && e.mean === 5 && e.years === 1, `one year ${JSON.stringify(e)}`); } }
const e = Y.expects(st, hh, 'fields');
check(e.years === 4 && e.mean === 7 && e.poor === 6, `four years ${JSON.stringify(e)}`);
for (let i = 0; i < 12; i++) Y.close(hh, 10 + i);
check(hh.yields.ring.fields.length === FIELDS.memory && hh.yields.tally.fields === 0, 'ring held at memory');
check(checkState(st).length === 0, 'invariants ' + checkState(st).join('; '));
const plan = st.plans.households.get(hh.id), HB = Traits.HEAD.bias;
for (const [b, want] of [[1, 0.5], [1 + HB, 1], [1 - HB, 0], [1 + 2 * HB, 1]]) { plan.head.bias.fields = b; check(Math.abs(Y.caution(st, hh) - want) < 1e-9, `caution ${b}`); }
// the planning day after the harvest closes the tally once a year
const hh2 = st.households[st.farmsteads[st.villages[0].farmsteads[1]].household];
Stores.record(st, hh2, 'meat', 6, 'meat');
VB.sim.advance(st, YEAR);
check(hh2.yields.ring.animals.length >= 1 && hh2.yields.closed >= 1, `closed at winter ${JSON.stringify(hh2.yields)}`);
if (failed) process.exit(1); console.log('yields ok');

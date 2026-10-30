// Children of 7 to 13 take water, weeding, hauling and reaping at a reduced rate; under 7 they take nothing.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { bid } = VB['sim/jobs'], { workRate, CHILD } = VB['sim/rules'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('CHILDREN FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const P = Sim.ROLES.child.prio;
check(P.water === 6 && P.weed === 5 && P.haul === 4 && P.reap === 3 && Object.keys(P).filter((k) => P[k]).length === 4, 'child priorities are not water 6, weed 5, haul 4, reap 3');
for (const [a, r] of [[7, 0.3], [9, 0.5], [13, 0.9]]) check(Math.abs(workRate('child', a) - r) < 1e-9, `rate at ${a} is ${workRate('child', a)}, wanted ${r}`);
check(workRate('son', 15) === 1 && CHILD.from === 7, 'adults do not work at full rate');
const st = Sim.seed(world(7), 7, 'founders');
st.t += 100 * Sim.DAY; // some summer day
const hh = st.households[0], p = st.pawns[hh.members[0]], a = st.agents[p.id], c = Sim.cal(st.t);
p.role = 'child';
const job = (kind) => ({ id: 9999, kind, claim: null, owner: { type: 'household', id: hh.id }, site: st.farmsteads[hh.farmstead].house, posted: st.t - 5, farm: null });
const at = (years, kind) => { p.born = st.t - years * Sim.YEAR - 1; return bid(st, a, job(kind), c); };
check(at(9, 'water') > 0, 'a child of 9 does not bid for water');
check(at(9, 'weed') > 0, 'a child of 9 does not bid for weeding');
check(at(9, 'plow') < 0, 'a child of 9 bids for hoeing');
check(at(6, 'water') < 0 && at(6, 'weed') < 0, 'a child of 6 bids for a job');
console.log('children ok');
if (failed) process.exit(1);

// State invariants (tests/lib/invariants.js) hold after every game day of long runs; a hand-broken state is reported.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { checkState } = require('./lib/invariants.js');
const RUNS = [['founders', 7, 20], ['founders', 42, 20], ['heirs', 7, 20], ['heirs', 42, 20], ['populous', 7, 5]];
function seed(scenario, sd) {
  const it = G.generate(sd, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
  return Sim.seed(r.value, sd, scenario);
}
let failed = 0;
for (const [scenario, sd, years] of RUNS) {
  const st = seed(scenario, sd);
  for (let d = 0; d < years * Sim.YEAR_DAYS; d++) {
    Sim.advance(st, Sim.DAY);
    const bad = checkState(st);
    if (bad.length) { failed++; console.error(`INVARIANTS FAIL: ${scenario} seed ${sd}, day ${d + 1} (year ${Math.floor(d / Sim.YEAR_DAYS) + 1}):\n  ${bad.slice(0, 8).join('\n  ')}`); break; }
  }
}
const st = seed('founders', 7), hh = st.households.find((h) => h.members.length > 1);
hh.members.pop();
if (!checkState(st).some((m) => m.includes('in no household'))) { failed++; console.error('INVARIANTS FAIL: a pawn removed from its household is not reported'); }
if (failed) process.exit(1);
console.log(`invariants ok: ${RUNS.length} runs`);

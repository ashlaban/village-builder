// @suite integration
// The guardian of a minor heir: the widow in the heirs scenario's A4 farm, kept while the heir is a minor and cleared the day he is 18
// (VB-854: on the small heirs island, the ward's birth moved to bring his eighteenth birthday a few days on, where it took 14 years).
const VB = require('../src/load.js'), Sim = VB.sim, { YEAR, DAY } = VB['sim/rules'];
const { scenario } = require('./lib/probe.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('GUARDIAN FAIL:', m); } };
const st = scenario('heirs'); st.naturalDeaths = false;
const hh = st.households[2], name = (id) => st.pawns[id].given;
const hakan = hh.holder, signe = hh.members.find((m) => st.pawns[m].given === 'Signe');
check(name(hakan) === 'Håkan', `holder is ${name(hakan)}`);
Sim.killPawn(st, hakan, 'killed');
check(hh.guardian === signe, `guardian is ${hh.guardian === null || hh.guardian === undefined ? hh.guardian : name(hh.guardian)}, wanted Signe`);
const olof = st.pawns[hh.ward];
check(olof.given === 'Olof' && olof.age < 18, `ward is ${name(hh.ward)} (${olof.age}), wanted Olof, a minor`);
Sim.advance(st, 10 * DAY);
check(hh.guardian === signe, 'guardian should stay while the ward is a minor');
olof.born = st.t - 18 * YEAR + 3 * DAY; // eighteen in three days
Sim.advance(st, 2 * DAY);
check(hh.guardian === signe && olof.age < 18, 'guardian should stay until the ward is 18');
Sim.advance(st, 2 * DAY);
check(olof.age >= 18 && hh.guardian === null, `guardian ${hh.guardian} not cleared when the ward is ${olof.age}`);
check(hh.holder !== olof.id || Sim.recordOf(st, { pawn: olof.id, life: true }).some((e) => e.kind === 'inherited' && /Came of age/.test(e.text)),
  'a ward who holds the farm takes charge of it');
if (failed) process.exitCode = 1; else console.log('guardian ok');

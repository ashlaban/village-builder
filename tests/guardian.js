// The guardian of a minor heir: the widow in the heirs scenario's A4 farm, cleared once the heir is 18.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('GUARDIAN FAIL:', m); } };
const it = G.generate(7); let r; while (!(r = it.next()).done); const w = r.value;
const st = Sim.seed(w, 7, 'heirs'); st.naturalDeaths = false;
const hh = st.households[2], name = (id) => st.pawns[id].given;
const hakan = hh.holder, signe = hh.members.find((m) => st.pawns[m].given === 'Signe');
check(name(hakan) === 'Håkan', `holder is ${name(hakan)}`);
Sim.killPawn(st, hakan, 'killed');
check(hh.guardian === signe, `guardian is ${hh.guardian === null || hh.guardian === undefined ? hh.guardian : name(hh.guardian)}, wanted Signe`);
check(st.pawns[hh.ward].given === 'Olof', `ward is ${name(hh.ward)}, wanted Olof (5)`);
Sim.advance(st, Sim.YEAR * 2);
check(hh.guardian === signe, 'guardian should stay while the ward is a minor');
Sim.advance(st, Sim.YEAR * 12);
check(hh.guardian === null, `guardian ${hh.guardian} not cleared 14 years on`);
if (failed) process.exitCode = 1; else console.log('guardian ok');

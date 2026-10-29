const G = require('../src/gen.js'); global.ArchGen = G; global.Culture = require('../src/culture.js');
const Sim = require('../src/sim.js');
for (const seed of [7, 42]) {
  const it = G.generate(seed); let r; while (!(r = it.next()).done); const w = r.value;
  const st = Sim.seed(w, seed, 'founders'); st.naturalDeaths = false;
  const t0 = Date.now(); Sim.advance(st, Sim.YEAR * 3);
  console.log(`founders seed ${seed}: 3 years in ${Date.now() - t0} ms | ${st.households.map((h) => `${st.farmsteads[h.farmstead].name} grain ${Math.round(h.grain)} hungry ${h.hungryDays}`).join(' | ')} | marriages ${st.unions.length} | demand ${st.demand.length}`);
  console.log('   roles:', st.pawns.map((p) => `${p.given} ${p.role}`).join(', '));
  console.log('   meeting log:', st.meetingLog.slice(0, 3).map((e) => `y${e.year} ${e.text}`).join(' | '));
}

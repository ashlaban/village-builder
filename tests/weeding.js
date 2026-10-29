// Summer upkeep: growing fields post weeding jobs, and a tended field yields more than an untended one.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('WEEDING FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const E = Sim.ECON, K = Sim.KINDS.weed;
check(K && K.hours === 2 && E.weedEvery === 6 && Math.abs(E.weedCut - 0.08) < 1e-9 && Math.abs(E.weedCutMax - 0.4) < 1e-9, 'weed job is not 2 hours every 6 days with an 8% cut, at most 40%');
for (const role of Object.keys(Sim.ROLES)) check((Sim.ROLES[role].prio.weed || 0) === (Sim.ROLES[role].prio.sow || 0), `role ${role}: weed priority differs from sow`);

// the harvest of the first year with and without weeding (an untended run never finishes a weeding job)
const harvest = (tended) => {
  const keep = K.hours; if (!tended) K.hours = 1e9;
  try {
    const st = Sim.seed(world(7), 7, 'founders'); st.naturalDeaths = false;
    let posted = 0, miss = 0;
    for (let day = 0; day < Sim.YEAR_DAYS; day++) {
      Sim.advance(st, Sim.DAY);
      for (const j of st.jobs.values()) if (j.kind === 'weed') posted++;
      for (const f of st.farmsteads) for (const fd of f.fields) miss = Math.max(miss, fd.weedMiss);
    }
    const crop = st.households.reduce((s, h) => s + h.ledger.filter((e) => e.kind === 'harvest').reduce((a, e) => a + e.n, 0), 0);
    return { crop, posted, miss };
  } finally { K.hours = keep; }
};
const tended = harvest(true), untended = harvest(false);
check(tended.posted > 0, 'no weeding jobs were posted');
check(tended.crop > untended.crop, `tended crop ${tended.crop} is not more than untended ${untended.crop}`);
check(untended.crop >= tended.crop * 0.55, `untended crop ${untended.crop} is cut by more than 40% of ${tended.crop}`);
console.log(`weeding: tended ${tended.crop}, untended ${untended.crop}`);
if (failed) process.exit(1);
console.log('weeding ok');

// VB-196's acceptance measures, shared by current and baseline checkouts. No timing or probes in simulation code.
const path = require('path');
function summarize(st, from, yearHours) {
  const first = new Map(), during = st.unions.filter((u) => u.start >= from && u.start <= st.t);
  for (const u of st.unions) {
    if (u.start > st.t) continue;
    for (const id of [u.a, u.b]) if (!first.has(id) || u.start < first.get(id)) first.set(id, u.start);
  }
  const ages = [...first].filter(([, t]) => t >= from).map(([id, t]) => (t - st.pawns[id].born) / yearHours);
  const women = st.living.map((id) => st.pawns[id]).filter((p) => {
    const age = Math.floor((st.t - p.born) / yearHours);
    return p.sex === 'f' && age >= 45 && age <= 54;
  });
  const never = women.filter((p) => !first.has(p.id));
  return { marriagesPerYear: during.length / ((st.t - from) / yearHours),
    firstMarriageAge: ages.length ? ages.reduce((a, b) => a + b, 0) / ages.length : null,
    firstMarriages: ages.length, women45to54: women.length, neverMarried: never.length,
    neverShare: women.length ? never.length / women.length : null, neverMarriedIds: never.map((p) => p.id) };
}
function main(args) {
  const at = args.indexOf('--source');
  const root = at < 0 ? path.join(__dirname, '..') : path.resolve(args.splice(at, 2)[1]);
  const seeds = args.length ? args.map(Number) : [7, 42];
  if (seeds.some((s) => !Number.isSafeInteger(s))) throw new Error('seeds must be integers');
  const VB = require(path.join(root, 'src/load.js')), Sim = VB.sim;
  for (const seed of seeds) {
    const it = VB.gen.generate(seed, { cols: 180, rows: 130 }); let r;
    while (!(r = it.next()).done);
    const st = Sim.seed(r.value, seed, 'populous'), from = st.t;
    for (let y = 1; y <= 30; y++) {
      Sim.advance(st, Sim.YEAR);
      if (y % 5 === 0) console.error(`seed ${seed}: ${y}/30 years, ${st.living.length} living`);
    }
    console.log(JSON.stringify({ seed, source: root, years: 30, ...summarize(st, from, Sim.YEAR) }));
  }
}
if (require.main === module) main(process.argv.slice(2));
module.exports = { summarize };

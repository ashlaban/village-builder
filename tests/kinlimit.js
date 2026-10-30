// Starting marriage limit: founders start at "close" (first cousins or further); heirs and populous at "first".
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, C = VB.culture;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KINLIMIT FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
for (const [scenario, seed, want] of [['founders', 7, 'close'], ['founders', 42, 'close'], ['heirs', 7, 'first'], ['populous', 7, 'first']]) {
  const st = Sim.seed(world(seed), seed, scenario), env = st.cenv, k = C.IDX.kinLimit;
  const name = (i) => C.DIMS[k].opts[i][0];
  check(env.cultures.every((c) => name(c.customs ? c.customs[k] : c.practice[k]) === want), `${scenario} ${seed}: culture custom is not ${want}`);
  for (const s of env.settlements) check(name(s.practice[k]) === want, `${scenario} ${seed}: ${s.name} practice is not ${want}`);
}
if (failed) process.exit(1);
console.log('kinlimit ok');

// Starting marriage limit: founders start at "close" (first cousins or further); heirs and populous at "first". On the small islands (VB-854).
const VB = require('../src/load.js'), C = VB.culture;
const { scenario } = require('./lib/probe.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KINLIMIT FAIL:', m); } };
for (const [name, seed, want] of [['founders', 7, 'close'], ['founders', 42, 'close'], ['heirs', 7, 'first'], ['populous', 7, 'first']]) {
  const st = scenario(name, seed), env = st.cenv, k = C.IDX.kinLimit;
  const opt = (i) => C.DIMS[k].opts[i][0];
  check(env.cultures.every((c) => opt(c.customs ? c.customs[k] : c.practice[k]) === want), `${name} ${seed}: culture custom is not ${want}`);
  for (const s of env.settlements) check(opt(s.practice[k]) === want, `${name} ${seed}: ${s.name} practice is not ${want}`);
}
if (failed) process.exit(1);
console.log('kinlimit ok');

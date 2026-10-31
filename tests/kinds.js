// Job kinds (sim/kinds): every kind has its labels, hours and a type of work that some role ranks; carried kinds say where the load goes;
// each role's priority of a kind is its exception for the kind, else its rank of the kind's type.
const VB = require('../src/load.js'), Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KINDS FAIL:', m); } };
const types = new Set(Object.values(Sim.ROLES).flatMap((r) => Object.keys(r.work)));
for (const [k, K] of Object.entries(Sim.KINDS)) {
  for (const f of ['verb', 'go', 'name', 'label']) check(typeof K[f] === 'string' && K[f].length > 0, `${k} has no ${f}`);
  check(K.hours > 0, `${k} has no hours`);
  check(types.has(K.type), `${k}: no role ranks its type of work "${K.type}"`);
  if (K.carry) check(K.back && ['door', 'woodpile', 'barn'].includes(K.to) && K.deliver, `${k} carries ${K.carry} but lacks back, to or deliver`);
  else check(!K.deliver && !K.to, `${k} delivers but carries nothing`);
  check(!(K.inside && K.field), `${k} is both inside and on a field`);
  if (K.field) check(typeof K.spot === 'function', `${k} is field work without a spot on the field`);
}
for (const [role, r] of Object.entries(Sim.ROLES)) for (const [k, K] of Object.entries(Sim.KINDS)) {
  const want = r.except[k] ?? r.work[K.type] ?? 0;
  check(r.prio[k] === want, `${role} ranks ${k} ${r.prio[k]}, wanted ${want}`);
}
for (const [role, r] of Object.entries(Sim.ROLES)) for (const k of Object.keys(r.except)) check(Sim.KINDS[k], `${role} has an exception for unknown kind ${k}`);
// clearing and breaking new land are tilling, ranked as hoeing by every role
for (const r of Object.values(Sim.ROLES)) check(r.prio.clear === r.prio.plow && r.prio.break === r.prio.plow, `${r.title}: clearing or breaking ranks apart from hoeing`);
console.log(`kinds ok: ${Object.keys(Sim.KINDS).length} kinds in ${types.size} types of work`);
if (failed) process.exit(1);

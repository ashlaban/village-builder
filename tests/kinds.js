// @suite fast
// Job kinds (sim/kinds): every kind has its labels, hours and a type of work that some role ranks; carried kinds say where the load goes;
// each role's priority of a kind is its exception for the kind (a fetch kind's: the kind it fetches for, VB-611), else its rank of the kind's type.
const VB = require('../src/load.js'), Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('KINDS FAIL:', m); } };
const types = new Set(Object.values(Sim.ROLES).flatMap((r) => Object.keys(r.work)));
for (const [k, K] of Object.entries(Sim.KINDS)) {
  for (const f of ['verb', 'go', 'name', 'label']) check(typeof K[f] === 'string' && K[f].length > 0, `${k} has no ${f}`);
  check(K.hours > 0, `${k} has no hours`);
  check(types.has(K.type), `${k}: no role ranks its type of work "${K.type}"`);
  // VB-1820: what a load is, its words and its delivery are said by the kind's method, never by fields of the kind
  for (const f of ['carry', 'to', 'deliver', 'back', 'inside', 'stages']) check(K[f] === undefined, `${k} has the field ${f}`);
  const P = VB['sim/doing'].planOf(k), G = VB['sim/doing'].GOODS;
  for (const g of P.uses) {
    const s = P.goods[g] || {};
    check(typeof s.look === 'string' && typeof s.words === 'string' && s.words.length > 0, `${k} carries ${g} but its method says no look or no words`);
    if (!(G[g] && G[g].store)) check(typeof VB['sim/doing'].said(G[g] && G[g].kind ? G[g].kind : k, g)?.deliver === 'function', `${k} carries ${g} but nothing delivers it`);
  }
  check(!(K.methods.some((m) => m.steps.some((s) => s.inside)) && K.field), `${k} is both inside and on a field`);
  if (K.field) check(typeof K.spot === 'function', `${k} is field work without a spot on the field`);
}
// VB-1813: a kind with a load, a cart or a stack in the kind's record has methods, or is a misfit named here with its reason
const MISFIT = {};
for (const [k, K] of Object.entries(Sim.KINDS)) if (['load', 'carry', 'carted', 'stack'].some((f) => K[f] !== undefined)) check(K.methods || MISFIT[k], `${k} carries by its record and has no methods`);
for (const [role, r] of Object.entries(Sim.ROLES)) for (const [k, K] of Object.entries(Sim.KINDS)) {
  const brings = K.strays && K.strays.length ? K.strays[0].good ?? K.strays[0] : null; // a kind of strays: ranked as its good (VB-1821)
  const want = r.except[k] ?? r.except[brings] ?? r.work[K.type] ?? 0;
  check(r.prio[k] === want, `${role} ranks ${k} ${r.prio[k]}, wanted ${want}`);
}
for (const [role, r] of Object.entries(Sim.ROLES)) for (const k of Object.keys(r.except)) check(Sim.KINDS[k], `${role} has an exception for unknown kind ${k}`);
// clearing and breaking new land are tilling, ranked as hoeing by every role
for (const r of Object.values(Sim.ROLES)) check(r.prio.clear === r.prio.plow && r.prio.break === r.prio.plow, `${r.title}: clearing or breaking ranks apart from hoeing`);
console.log(`kinds ok: ${Object.keys(Sim.KINDS).length} kinds in ${types.size} types of work`);
if (failed) process.exit(1);

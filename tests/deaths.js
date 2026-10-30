// Causes of death: the base hazard names its cause by age; the texts come from CAUSES; a kill writes the event and the log.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { deathRoll, CAUSES } = VB['sim/deaths'], { YEAR } = VB['sim/rules'];
const rolls = (age) => { // the first cause a pawn of this age dies of at hunger 0, over many draws
  let s = 99; const st = { t: 0, rand: () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }, seen = new Set();
  for (let i = 0; i < 3e6 && !seen.size; i++) { const c = deathRoll(st, { born: -(age + 0.5) * YEAR, hunger: 0, health: 100 }); if (c) seen.add(c); }
  return [...seen];
};
for (const [age, cause] of [[0, 'infancy'], [5, 'childhood'], [30, 'illness'], [70, 'oldAge']]) {
  assert.deepStrictEqual(rolls(age), [cause], `cause at age ${age}`);
}
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders'), id = st.households[0].members[0];
Sim.killPawn(st, id, 'illness');
const e = st.pawns[id].events.find((x) => x.kind === 'died');
assert.strictEqual(e.text, CAUSES.illness.event); assert.strictEqual(e.cause, 'illness');
assert(st.events.some((x) => x.text.includes(CAUSES.illness.log)), 'the log names the cause');
for (const [k, c] of Object.entries(CAUSES)) assert(c.event && c.log, `${k} has both texts`);
console.log('deaths ok');

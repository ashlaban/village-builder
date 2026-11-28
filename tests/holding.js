// @suite integration
// The ways to a farm share one table of bars (sim/holding, VB-688): every bar has its check once the modules are loaded, each way reads only
// names of the table, a holder is barred as landed by every way that reads it, a minor as under 18, and goesWith takes the holder's spouse
// and minor children living with them, never a grown child.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], H = VB['sim/holding'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HOLDING FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'heirs');
for (const [name, , fn] of H.BARS) check(typeof fn === 'function', `bar ${name} has no check`);
const names = new Set(H.BARS.map((b) => b[0]));
for (const [way, bars] of Object.entries(H.WAYS)) for (const b of bars) check(names.has(b), `way ${way} reads unknown bar ${b}`);
const hh = st.households.find((h) => !h.dissolved && h.members.some((id) => st.pawns[id].age < 18));
check(hh, 'no household with a child');
for (const way of ['claim', 'plot', 'ask']) check(H.barredWhy(st, hh.holder, way) === 'holds a farm, or is married to its holder', `holder not landed by ${way}`);
const kid = hh.members.find((id) => st.pawns[id].age < 18);
check(H.barredWhy(st, kid, 'claim') === 'under 18', 'a minor may claim');
const sp = R.spouseOf(st, hh.holder);
const goes = H.goesWith(st, hh.holder);
check(goes[0] === hh.holder, 'the holder goes first');
if (sp !== null && st.pawns[sp].alive) check(goes.includes(sp), 'the spouse stays behind');
for (const c of R.childrenOf(st, hh.holder)) {
  const q = st.pawns[c];
  if (q.alive && q.household === hh.id && q.age < 18 && !R.isHolder(st, c)) check(goes.includes(c), `minor child ${c} stays behind`);
  if (q.age >= 18) check(!goes.includes(c), `grown child ${c} goes along`);
}
if (failed) process.exit(1);
console.log('holding ok: one table of bars, each way its list, the household that goes with a holder');

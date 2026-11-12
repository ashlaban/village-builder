// The cottage (VB-032): a cleared plot with a waiting couple gets foundation, walls and roof; the roof makes a farmstead and a household
// whose grain is the couple's stake, and the household sows its field the next spring. Owed shares are paid down from the debtor farm.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, X = VB['sim/expansion'];
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('COTTAGE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const st = Sim.seed(world(7), 7, 'heirs'), v = st.villages[0];
const adults = st.pawns.filter((p) => p.alive && p.age >= 18 && Sim.settlementIdOf(st, p) === 0 && !Sim.isHolder(st, p.id));
const m = adults.find((p) => p.sex === 'm'), f = adults.find((p) => p.sex === 'f');
if (!m || !f) { console.error('COTTAGE FAIL: no adults'); process.exit(1); }
st.unions.push({ id: st.unions.length, a: m.id, b: f.id, start: st.t, end: null, kind: 'marriage' });
st.demand = [m.id, f.id]; m.stake = 300; f.stake = 100;
X.startPlots(st);
const plot = X.livePlots(st, v)[0]; check(!!plot, 'a plot is started'); // its village's project plan (VB-123)
for (const tr of X.tilesOf(plot)) while (tr.i < tr.steps.length) X.finishStep(st, { plot, tr });
plot.hours[m.id] = 10; plot.to = m.id;
check(plot.open === 1 && X.cottageAt(plot) === 0, 'cottage waits at the foundation');
const farms = st.farmsteads.length, hhs = st.households.length;
// the walls wait for BUILD.timber loads at the site (VB-328): the plot's felled trees, or timber felled in the village's wood
const TIMBER = VB['sim/rules'].BUILD.timber, felled = plot.steps[2].wood;
for (const [i, kind, hours] of [[0, 'foundation', 30], [1, 'walls', 60], [2, 'roof', 30]]) {
  if (kind === 'walls' && felled < TIMBER) {
    check(!X.plotJobs(st).some((j) => j[3].cottage && j[3].plot === plot), `the walls wait for timber (${felled} loads at the site)`);
    plot.steps[2].wood = TIMBER + 6; // six trips' timber came (sim/building)
  }
  const jobs = X.plotJobs(st).filter((j) => j[3].cottage && j[3].plot === plot);
  check(jobs.length === 1 && jobs[0][1] === kind && jobs[0][3].hours === hours, `stage ${i} is a ${kind} job of ${hours} h`);
  check(st.farmsteads.length === farms, 'no farmstead before the roof');
  X.finishStep(st, { plot, cottage: true });
}
const rec = v.plots[v.plots.length - 1];
check(!X.livePlots(st, v).includes(plot) && rec.id === plot.plot && rec.holder === m.id, 'the plan is finished, the plot built and recorded');
check(st.farmsteads.length === farms + 1 && st.households.length === hhs + 1, 'ids are appended');
const fm = st.farmsteads[rec.farmstead], hh = st.households[fm.household];
// what the walls left (6 loads, or the felled tiles' more) is the new household's first wood, up to its winter goal; its old homes give the
// rest up to 16 (VB-328)
const left = Math.max(felled, TIMBER + 6) - TIMBER, want = Math.min(left, VB['sim/rules'].ECON.woodWinter);
check(plot.steps[2].wood === 0 && hh.wood >= want && hh.wood <= Math.max(want, 16), `the new household's first wood: ${hh.wood} (${left} left by the walls)`);
check(hh && hh.holder === m.id && hh.members.includes(m.id) && hh.members.includes(f.id), 'holder and spouse live in the new household');
check(m.household === hh.id && f.household === hh.id, 'both moved in');
check(hh.grain === 400 && !m.stake && !f.stake, `stake became grain (${hh.grain})`);
check(fm.fields.length === 1 && fm.village === v.id && st.farmsteads[fm.id] === fm, 'farmstead has the plot field');
check(Sim.recordOf(st, { pawn: m.id, life: true }).some((e) => /Moved/.test(e.text || '')), 'a moved event');
check(X.plotJobs(st).every((j) => !(j[3].cottage && j[3].plot === plot)), 'no more cottage jobs');
// owed shares are paid from grain above the debtor farm's reserve
const other = st.households.find((h) => !h.dissolved && h.id !== hh.id), p = st.pawns.find((q) => q.alive && q.household === hh.id && q.id === f.id);
p.owed = 50; p.owedFrom = other.id; other.grain = 1000;
VB['sim/cottage'].payOwed(st);
check(p.owed === 0 && hh.grain === 450 && other.grain === 950, `owed share paid (owed ${p.owed}, grain ${hh.grain}/${other.grain})`);
// the next spring: the household sows its field
let sown = false;
for (let d = 0; d < 400 * 24 && !sown; d += 24) { Sim.advance(st, 24); sown = fm.fields[0].stage !== 'stubble'; if (hh.dissolved) break; }
check(sown, `the new field was worked (stage ${fm.fields[0].stage})`);
if (failed) process.exit(1);
console.log('cottage ok');

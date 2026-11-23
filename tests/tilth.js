// Tilth (VB-717): a field's slow soil, built by dung and fading over decades, read in closed form. On a small constructed state.
const VB = require('../src/load.js'), F = VB['sim/fields'], { state } = require('./lib/probe.js');
const { YEAR } = VB['sim/rules'], { TILTH } = VB['sim/soil'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TILTH FAIL:', m); } };
const st = state(), f = st.farmsteads.find((x) => x.household !== null && x.fields.length >= 2), hh = st.households[f.household];
const [a, b] = f.fields, near = (x, y, e) => Math.abs(x - y) <= e;
check(f.fields.every((fd) => fd.tilth === 0 && fd.tilthAt === 0), 'a field does not start at tilth 0');
check(VB['sim/soil'].tilthOf(st, a) === 0, 'a field never dunged is not at 0');
// 2 loads a year, at each year's turn, for N years
const run = (years) => { a.tilth = 0; a.tilthAt = 0; for (let y = 0; y < years; y++) { st.t = y * YEAR; hh.manure = 2; VB['sim/soil'].manureDone(st, a, hh, 2); } st.t = years * YEAR; return VB['sim/soil'].tilthOf(st, a); };
const t100 = run(100), t40 = run(40);
check(near(t100, 0.117, 0.005), `100 years at 2 loads: ${t100}`);
check(near(t40, 0.067, 0.004), `40 years at 2 loads: ${t40}`);
a.tilth = 0.2; a.tilthAt = 0; st.t = 49 * YEAR;
check(near(VB['sim/soil'].tilthOf(st, a), 0.1, 0.01), `49 years unmanured: ${VB['sim/soil'].tilthOf(st, a)}`);
// the harvest, by tilth 0 and 0.1: the same but for the draw of the yield (0.9 to 1.1), so a mean of many
st.t = 10 * YEAR;
const reap = (fd, tilth) => { Object.assign(fd, { crop: 'barley', stage: 'ripe', tilth, tilthAt: st.t, soil: 1, fert: 1, weedMiss: 0, weedOpen: false }); F.reaped(st, fd, { day: 1 }); return fd.held; };
let s0 = 0, s1 = 0; for (let i = 0; i < 400; i++) { s0 += reap(a, 0); s1 += reap(b, 0.1); }
check(near(s1 / s0, 1.1, 0.03), `harvest ratio ${s1 / s0}`);
a.tilth = TILTH.max + 1; a.tilthAt = 0;
check(checkState(st).some((m) => /tilth/.test(m)), 'invariant misses a tilth above max');
// nothing daily: a day with no dung on any heap and no crop ripe reads no tilth
{ const q = state(), Sim = VB.sim; for (const h of q.households) h.manure = 0; for (const x of q.farmsteads) for (const fd of x.fields) fd.stage = 'stubble';
  const n = VB.count.tilthRead; Sim.advance(q, Sim.DAY); check(VB.count.tilthRead === n, 'tilth read on a day with no manuring or reaping'); }
if (failed) process.exit(1); console.log('tilth ok');

// Work hours and the dark part of the day (VB-105): WORK is 6-18, dark(c) is 22-4 at the equinoxes, 23-3 at midsummer, 21-5 at midwinter.
const VB = require('../src/load.js'), Sim = VB.sim;
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DAYLIGHT FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 0.1;
check(Sim.WORK[0] === 6 && Sim.WORK[1] === 18, 'WORK is 6-18');
for (const [name, doy, from, to] of [['equinox', 3, 22, 4], ['midsummer', 14, 23, 3], ['midwinter', 38, 21, 5]]) {
  const [a, b] = Sim.dark({ doy }); check(near(a, from) && near(b, to), `${name}: dark ${a.toFixed(2)}-${b.toFixed(2)}, expected ${from}-${to}`);
}
for (let doy = 0; doy < Sim.YEAR_DAYS; doy++) { const [a, b] = Sim.dark({ doy }), len = (b - a + 24) % 24; check(len >= 3.99 && len <= 8.01, `day ${doy}: dark lasts ${len}`); }
// nobody works in the dark: over a founders year, no pawn is out on a job while Sim.dark(c) says it is dark. A pawn may still
// carry a load home after 18:00 (deliveries are finished first), so the hours just after work are not checked.
const inDark = (h, [a, b]) => (a > b ? h >= a || h < b : h >= a && h < b);
const G = VB.gen, it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders'); let out = 0, hours = 0;
for (let h = 0; h < 2 * 24 * 12; h++) {
  Sim.advance(st, 1); const c = Sim.cal(st.t);
  if (inDark(c.hour, Sim.dark(c))) { hours++; if (st.agents.some((a) => !a.inside && st.pawns[a.id].alive && a.job)) out++; }
}
check(hours > 0 && out === 0, `${out} of ${hours} dark hours had a pawn out on a job`);
if (failed) process.exit(1);
console.log('daylight ok');

// Milk and butter (VB-135): a cow that calved this spring is in milk from turn-out to the byre; a daily milking job gives 0.5 rations a cow,
// less for the winter's lean days; 40% is churned to butter that keeps a year, the rest is drunk within the day; no milk in the byre.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], Y = VB['sim/byre'], F = VB['sim/hunger'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('MILK FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (doy, hour = 8) => ({ doy, day: doy, season: Math.floor(doy / 12), sday: doy % 12, hour });
const HD = Sim.HERD;

// --- founders seed 7: the first spring's calving puts cows in milk; none in the byre
let st = Sim.seed(world(7), 7, 'founders');
Sim.advance(st, 4 * Sim.DAY);
const withCattle = st.households.filter((h) => H.herdOf(st, h, 'cattle'));
const calved = withCattle.flatMap((h) => H.herdOf(st, h, 'cattle').head.filter((x) => x.calved === 1));
check(calved.length > 0, 'no cow calved in the first spring');
check(calved.every((x) => x.kind === 'cow'), 'something other than a cow calved');
const hh = withCattle.find((h) => H.milkCows(st, h, cal(10)) > 0);
check(hh, 'no household with a cow in milk in summer');
check(H.milkCows(st, hh, cal(40)) === 0 && H.milkCows(st, hh, cal(2)) === 0, 'cows in milk while the herds are in the byre');
check(H.milkCows(st, hh, cal(HD.stall[1])) > 0 && H.milkCows(st, hh, cal(HD.stall[0] - 1)) > 0, 'not in milk from turn-out to the byre');

// --- milking: the job is posted from 6:00 while out, gives 0.5 a cow, 40% as butter; the lean days of the winter cut it
const cows = H.milkCows(st, hh, cal(10));
check(Y.byreJobs(st, hh, cal(10, 5)).every((j) => j[1] !== 'milk'), 'milking posted before 6:00');
const job = Y.byreJobs(st, hh, cal(10)).find((j) => j[1] === 'milk');
check(job && Math.abs(job[2].hours - (HD.milkHours[0] + HD.milkHours[1] * cows)) < 1e-9, `milking hours ${job && job[2].hours} for ${cows} cows`);
hh.larder = []; Y.milkDone(st, hh, cal(10));
const milk = F.larderOf(hh, 'milk'), butter = F.larderOf(hh, 'butter');
check(Math.abs(milk + butter - cows * HD.milk) < 1e-9, `milk ${milk} + butter ${butter} for ${cows} cows`);
check(Math.abs(butter - cows * HD.milk * HD.butter) < 1e-9, `butter ${butter}, wanted ${HD.butter} of the milk`);
check(Y.byreJobs(st, hh, cal(10)).every((j) => j[1] !== 'milk'), 'milked twice in a day');
const lots = hh.larder.map((l) => (l.until - st.t) / Sim.DAY).sort((a, b) => a - b);
check(Math.abs(lots[0] - 1) < 1e-9 && Math.abs(lots[1] - HD.butterDays) < 1e-9, `milk keeps ${lots[0]} days, butter ${lots[1]}`);
for (const herd of H.herdsOf(st, hh)) herd.lean = 10;
hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(11));
check(Math.abs(F.larderOf(hh) - cows * HD.milk * (1 - 10 * HD.leanPer)) < 1e-9, `10 lean days: ${F.larderOf(hh)} rations`);
for (const herd of H.herdsOf(st, hh)) herd.lean = 100;
hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(12));
check(Math.abs(F.larderOf(hh) - cows * HD.milk * (1 - HD.leanMax)) < 1e-9, `100 lean days: ${F.larderOf(hh)} rations, wanted at most ${HD.leanMax} less`);

// --- a whole year: every day out of the byre is milked; fresh milk does not spoil (it is drunk), butter is in the larder in autumn
st = Sim.seed(world(7), 7, 'founders');
Sim.advance(st, 33 * Sim.DAY);
let fresh = 0, churned = 0, days = new Set(), inMilk = 0;
for (const h of st.households) for (const e of h.ledger) {
  if (e.kind === 'milk') { fresh += e.n; days.add(`${h.id}:${Math.floor(e.t / Sim.DAY)}`); }
  if (e.kind === 'butter') churned += e.n;
}
for (const h of st.households) if (H.milkCows(st, h, cal(10)) > 0) inMilk += H.milkCows(st, h, cal(10));
const outDays = HD.stall[0] - HD.stall[1], milked = days.size / Math.max(1, st.households.filter((h) => H.milkCows(st, h, cal(10)) > 0).length);
check(milked >= outDays - 2, `milked ${milked.toFixed(1)} of ${outDays} days out a household`);
check(Math.abs(churned / (fresh + churned) - HD.butter) < 1e-6, 'butter share');
// the meal drinks the day's milk first: across a summer midnight the milk goes and grain and rations fall by the rest of the need
const s2 = Sim.seed(world(7), 7, 'founders');
Sim.advance(s2, 15 * Sim.DAY + 20 - s2.t); // day 15 (summer), 20:00
const h2 = s2.households.find((h) => F.larderOf(h, 'milk') > 0);
check(h2, 'no household with milk in the larder on a summer evening');
if (h2) {
  const m0 = F.larderOf(h2, 'milk'), g0 = h2.grain + h2.rations, need = F.dailyNeed(s2, h2);
  Sim.advance(s2, 4.5);
  const used = g0 - (h2.grain + h2.rations);
  check(F.larderOf(h2, 'milk') < 1e-9, 'fresh milk left after the meal');
  check(Math.abs(used - (need - m0)) < 1e-6, `the meal took ${used.toFixed(2)} grain and rations, wanted ${(need - m0).toFixed(2)} (need less milk)`);
}
check(st.households.some((h) => F.larderOf(h, 'butter') > 1), 'no butter in any larder at the byre');
const bad = checkState(st); check(!bad.length, bad.slice(0, 3).join('; '));
const perCow = (fresh + churned) / Math.max(1, inMilk);
check(perCow > 0.8 * HD.milk * outDays && perCow <= HD.milk * outDays + 1e-6, `${perCow.toFixed(1)} rations a cow in milk, wanted about ${HD.milk * outDays}`);

console.log(`milk ok: founders 7, year 1: ${inMilk} cows in milk, ${milked.toFixed(0)} of ${outDays} days milked, ${(fresh + churned).toFixed(1)} rations ` +
  `(${churned.toFixed(1)} butter), ${perCow.toFixed(1)} a cow`);
if (failed) process.exit(1);

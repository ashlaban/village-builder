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
const cows = H.milkCows(st, hh, cal(10)), ewesNow = Y.milkEwes(st, hh, cal(10));
check(Y.byreJobs(st, hh, cal(10, 5)).every((j) => j[1] !== 'milk'), 'milking posted before 6:00');
const job = Y.byreJobs(st, hh, cal(10)).find((j) => j[1] === 'milk');
check(job && Math.abs(job[2].hours - (HD.milkHours[0] + HD.milkHours[1] * cows + HD.eweHours * ewesNow)) < 1e-9, `milking hours ${job && job[2].hours} for ${cows} cows`);
// herded yesterday and today (VB-136): the full milk
const herded = (day) => { for (const herd of H.herdsOf(st, hh)) herd.herded = day; };
herded(10);
hh.larder = []; Y.milkDone(st, hh, cal(10));
const milk = F.larderOf(hh, 'milk'), butter = F.larderOf(hh, 'butter');
check(Math.abs(milk + butter - cows * HD.milk - ewesNow * HD.eweMilk) < 1e-9, `milk ${milk} + butter ${butter} for ${cows} cows`);
check(Math.abs(butter - (cows * HD.milk + ewesNow * HD.eweMilk) * HD.butter) < 1e-9, `butter ${butter}, wanted ${HD.butter} of the milk`);
check(Y.byreJobs(st, hh, cal(10)).every((j) => j[1] !== 'milk'), 'milked twice in a day');
const lots = hh.larder.map((l) => (l.until - st.t) / Sim.DAY).sort((a, b) => a - b);
check(Math.abs(lots[0] - 1) < 1e-9 && Math.abs(lots[1] - HD.butterDays) < 1e-9, `milk keeps ${lots[0]} days, butter ${lots[1]}`);
for (const herd of H.herdsOf(st, hh)) herd.lean = 10;
herded(10); hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(11));
check(Math.abs(F.larderOf(hh) - (cows * HD.milk + ewesNow * HD.eweMilk) * (1 - 10 * HD.leanPer)) < 1e-9, `10 lean days: ${F.larderOf(hh)} rations`);
for (const herd of H.herdsOf(st, hh)) herd.lean = 100;
herded(11); hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(12));
check(Math.abs(F.larderOf(hh) - (cows * HD.milk + ewesNow * HD.eweMilk) * (1 - HD.leanMax)) < 1e-9, `100 lean days: ${F.larderOf(hh)} rations, wanted at most ${HD.leanMax} less`);
// VB-136: after a grazing day by the farm with no herder, half the milk; not after a day in the byre (the turn-out)
for (const herd of H.herdsOf(st, hh)) herd.lean = 0;
herded(5); hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(13));
check(Math.abs(F.larderOf(hh) - (cows * HD.milk + ewesNow * HD.eweMilk) * HD.herding.milk) < 1e-9, `unherded yesterday: ${F.larderOf(hh)} rations, wanted ${HD.herding.milk} of ${cows * HD.milk}`);
hh.larder = []; hh.milkDay = -1; Y.milkDone(st, hh, cal(HD.stall[1]));
check(Math.abs(F.larderOf(hh) - (cows * HD.milk + ewesNow * HD.eweMilk)) < 1e-9, `at the turn-out: ${F.larderOf(hh)} rations, wanted the full ${cows * HD.milk}`);

// --- a whole year: every day out of the byre is milked; fresh milk does not spoil (it is drunk), butter is in the larder in autumn
st = Sim.seed(world(7), 7, 'founders');
Sim.advance(st, 33 * Sim.DAY);
// milk and butter are yearly totals (VB-204): one movement of each a milking, so a total's count is its days milked
let fresh = 0, churned = 0, milkings = 0, inMilk = 0;
for (const h of st.households) for (const x of h.totals) {
  if (x.kind === 'milk') { fresh += x.n; milkings += x.count; }
  if (x.kind === 'butter') churned += x.n;
}
for (const h of st.households) if (H.milkCows(st, h, cal(10)) > 0) inMilk += H.milkCows(st, h, cal(10));
const outDays = HD.stall[0] - HD.stall[1], milked = milkings / Math.max(1, st.households.filter((h) => H.milkCows(st, h, cal(10)) > 0).length);
check(milked >= outDays - 2, `milked ${milked.toFixed(1)} of ${outDays} days out a household`);
check(Math.abs(churned / (fresh + churned) - HD.butter) < 1e-6, 'butter share');
// the meal drinks the day's milk first: across a summer midnight the milk goes and grain and meals fall by the rest of the need
const s2 = Sim.seed(world(7), 7, 'founders');
Sim.advance(s2, 15 * Sim.DAY + 20 - s2.t); // day 15 (summer), 20:00
const h2 = s2.households.find((h) => F.larderOf(h, 'milk') > 0);
check(h2, 'no household with milk in the larder on a summer evening');
if (h2) {
  const m0 = F.larderOf(h2, 'milk'), g0 = Sim.grainOf(h2) + h2.meals, need = F.dailyNeed(s2, h2), sp0 = h2.spoilt || 0, meals0 = h2.meals;
  Sim.advance(s2, 4.5);
  const used = g0 - (Sim.grainOf(h2) + h2.meals) - ((h2.spoilt || 0) - sp0); // grain that spoiled in store overnight is not eaten
  check(F.larderOf(h2, 'milk') < 1e-9, 'fresh milk left after the meal');
  // what meals do not cover is grain eaten uncooked, at 1 / ECON.uncooked a ration (VB-119, VB-327)
  const rest = need - m0, want = Math.min(meals0, rest) + Math.max(0, rest - meals0) / s2.ECON.uncooked;
  check(Math.abs(used - want) < 1e-6, `the meal took ${used.toFixed(2)} grain and meals, wanted ${want.toFixed(2)} (need less milk)`);
}
check(st.households.some((h) => F.larderOf(h, 'butter') > 1), 'no butter in any larder at the byre');
const bad = checkState(st); check(!bad.length, bad.slice(0, 3).join('; '));
// a cow gives half on the days after one unherded (VB-136): the founders, with no child of 8, herd on few days
// --- ewes' milk and wool (VB-144): a ewe that lambed this spring is in milk from turn-out to the end of summer; fleeces on summer day 1
const sh = st.households.find((h) => H.herdOf(st, h, 'sheep') && H.herdOf(st, h, 'sheep').lambed > 0);
check(sh, 'no household with a ewe that lambed');
let eweRations = 0, eweHouseholds = 0, fleeces = 0;
if (sh) {
  const herd = H.herdOf(st, sh, 'sheep'), n = Math.min(herd.lambed, herd.ewes);
  check(Y.milkEwes(st, sh, cal(HD.stall[1])) === n && Y.milkEwes(st, sh, cal(HD.eweEnd - 1)) === n, 'ewes not in milk from turn-out to the end of summer');
  check(Y.milkEwes(st, sh, cal(HD.eweEnd)) === 0 && Y.milkEwes(st, sh, cal(HD.stall[0] - 1)) === 0, 'ewes in milk after the end of summer');
  check(Y.milkEwes(st, sh, cal(2)) === 0 && Y.milkEwes(st, sh, cal(HD.stall[0])) === 0, 'ewes in milk in the byre');
  const s3 = JSON.parse(JSON.stringify(st)), h3 = s3.households[sh.id], g3 = H.herdOf(s3, h3, 'sheep');
  g3.lambed = 4; g3.ewes = Math.max(g3.ewes, 4);
  for (const hd of H.herdsOf(s3, h3)) { hd.herded = 10; if (hd.species === 'cattle') hd.head = []; }
  h3.larder = []; h3.milkDay = -1; Y.milkDone(s3, h3, cal(10));
  eweRations = F.larderOf(h3);
  check(Math.abs(eweRations - 4 * HD.eweMilk) < 1e-9, `4 ewes gave ${eweRations} rations, wanted ${4 * HD.eweMilk}`);
  h3.larder = []; h3.milkDay = -1; Y.milkDone(s3, h3, cal(HD.eweEnd + 1));
  check(F.larderOf(h3) === 0, 'ewes milked after the end of summer');
  // wool: shorn on summer day 1
  for (const h of s3.households) h.wool = 0;
  Y.shearing(s3);
  for (const h of s3.households) { const g = H.herdOf(s3, h, 'sheep'); fleeces += h.wool; check(h.wool === (g ? g.ewes + g.rams : 0), `household ${h.id}: ${h.wool} fleeces`); }
  check(fleeces > 0, 'no fleece');
}
{
  // a year run: no wool before summer day 1, wool after it; ewes' milk in the totals stops at the end of summer
  const s4 = Sim.seed(world(7), 7, 'founders');
  Sim.advance(s4, 11.5 * Sim.DAY);
  check(s4.households.every((h) => !h.wool), 'wool before summer day 1');
  Sim.advance(s4, 1 * Sim.DAY);
  check(s4.households.some((h) => h.wool > 0), 'no wool after summer day 1');
  const stillIn = (day) => s4.households.some((h) => Y.milkEwes(s4, h, cal(day)) > 0);
  check(stillIn(HD.eweEnd - 1) && !stillIn(HD.eweEnd), 'ewes in milk across the end of summer');
}
const perCow = (fresh + churned) / Math.max(1, inMilk);
check(perCow > 0.8 * HD.milk * HD.herding.milk * outDays && perCow <= HD.milk * outDays + 1e-6,
  `${perCow.toFixed(1)} rations a cow in milk, wanted from ${HD.milk * HD.herding.milk * outDays} to ${HD.milk * outDays}`);

console.log(`milk ok: founders 7, year 1: ${inMilk} cows in milk, ${milked.toFixed(0)} of ${outDays} days milked, ${(fresh + churned).toFixed(1)} rations ` +
  `(${churned.toFixed(1)} butter), ${perCow.toFixed(1)} a cow; ewes: 4 ewes give ${eweRations.toFixed(2)} a day to the end of summer, ${fleeces} fleeces on summer day 1`);
if (failed) process.exit(1);

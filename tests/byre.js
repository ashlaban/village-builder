// The byre and the autumn count (VB-134): short hay culls the least valuable first (ewes before cows, the bull, the ram and the oxen kept);
// a byre over 6 cattle is culled to fit; with no hay the household slaughters at once, and unfed animals die after 2 days; slaughter puts
// meat in the larder, salting makes it keep, unsalted meat spoils; the meal eats from the larder; a fed founders herd loses nothing to
// hunger over 3 years.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], Y = VB['sim/byre'], F = VB['sim/hunger'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('BYRE FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const fresh = () => Sim.seed(world(7), 7, 'founders');
const cal = (doy, day = doy) => ({ doy, day, season: Math.floor(doy / 12), sday: doy % 12, hour: 0 });
const culled = (st, hh) => H.herdsOf(st, hh).flatMap((hd) => hd.cull.map((e) => (e.sheep ? e.sheep : hd.head.find((h) => h.id === e.head).kind)));

// --- short hay: hay for the cattle but not the sheep; the 4 ewes go, then the oldest cow; the bull, the ram and the oxen stay
let st = fresh(), hh = st.households[0];
hh.hay = 120;
Y.autumnCount(st, hh);
let c = culled(st, hh).sort().join(',');
check(c === 'cow,ewe,ewe,ewe,ewe', `short hay: culled ${c}, wanted 4 ewes and a cow`);
const cows = H.herdOf(st, hh, 'cattle').head.filter((h) => h.kind === 'cow'), gone = H.herdOf(st, hh, 'cattle').cull[0];
check(gone && cows.every((h) => h.id === gone.head || h.born >= cows.find((q) => q.id === gone.head).born), 'short hay: not the oldest cow');
const kept = Y.animals(st, hh).reduce((s, a) => s + a.hay, 0) * Sim.HERD.stallDays * Sim.HERD.margin;
check(kept <= hh.hay, `short hay: the kept animals need ${kept.toFixed(1)}, more than the hay ${hh.hay}`);
check(!checkState(st).length, 'short hay: ' + checkState(st).slice(0, 3).join('; '));

// --- the byre's room: 8 cattle with plenty of hay; the two heifers go, nobody else
st = fresh(); hh = st.households[0];
const herd = H.herdOf(st, hh, 'cattle');
for (let k = 0; k < 3; k++) H.addHead(st, herd, 'f', st.t - 1.5 * Sim.YEAR, 'heifer');
hh.hay = 1000;
Y.autumnCount(st, hh);
c = culled(st, hh).filter((k) => k !== 'ewe').sort().join(',');
check(c === 'heifer,heifer', `byre: culled ${c}, wanted 2 heifers to bring 8 cattle to 6`);

// --- no hay in the byre: an emergency slaughter, lean; unslaughtered, an animal dies on the second unfed day
st = fresh(); hh = st.households[2];
hh.hay = 0;
const before = H.herdOf(st, hh, 'cattle').head.length;
Y.byreDay(st, cal(40));
check(H.herdOf(st, hh, 'cattle').cull.length === before && H.herdOf(st, hh, 'cattle').cull.every((e) => e.lean), 'no hay: not every animal marked lean for slaughter');
check(H.herdOf(st, hh, 'cattle').head.length === before, 'no hay: an animal died on the first unfed day');
Y.byreDay(st, cal(41));
check(H.herdOf(st, hh, 'cattle').head.length === before - 1, `no hay: ${before - H.herdOf(st, hh, 'cattle').head.length} died on the second unfed day, wanted 1`);
check(!checkState(st).length, 'no hay: ' + checkState(st).slice(0, 3).join('; '));

// --- slaughter, salting and spoiling
st = fresh(); hh = st.households[0];
const sheep = H.herdOf(st, hh, 'sheep'), entry = { id: 99, sheep: 'ewe', lean: false };
sheep.cull.push(entry);
Y.slaughterDone(st, sheep, entry, hh);
check(sheep.ewes === 3 && F.larderOf(hh, 'meat') === Sim.HERD.meat.ewe, `slaughter: ${sheep.ewes} ewes, ${F.larderOf(hh, 'meat')} meat`);
Y.saltDone(st, hh);
check(F.larderOf(hh, 'meat') === 0 && F.larderOf(hh, 'salt meat') === Sim.HERD.meat.ewe, 'salting: the meat is not salt meat');
F.addFood(st, hh, 'meat', 5, -1); // already past its day
Y.byreDay(st, cal(20));
check(F.larderOf(hh, 'meat') === 0 && F.larderOf(hh, 'salt meat') === Sim.HERD.meat.ewe, 'spoiling: old meat kept, or salt meat lost');

// --- the meal eats from the larder when grain runs out
st = fresh(); hh = st.households[3];
hh.grain = 0; hh.rations = 0; hh.larder = []; F.addFood(st, hh, 'salt meat', 10, 40);
const hungry = hh.hungryDays;
F.feedHousehold(st, hh);
check(hh.hungryDays === hungry && Math.abs(F.larderOf(hh) - (10 - F.dailyNeed(st, hh))) < 1e-9, `meal: larder ${F.larderOf(hh)}, hungry days ${hh.hungryDays - hungry}`);

// --- founders seed 7 over 3 years: no animal dies of hunger; slaughter happens and meat is salted
st = fresh();
let seenT = -Infinity, hunger = 0, counts = 0, slaughtered = 0, spoiled = 0;
const herdSize = () => st.herds.reduce((s, hd) => s + (hd.head ? hd.head.length : hd.ewes + hd.rams + hd.lambs), 0);
for (let d = 0; d < 3 * Sim.YEAR_DAYS; d++) {
  Sim.advance(st, Sim.DAY);
  for (const e of st.events) {
    if (e.t <= seenT) break;
    if (/Hunger in the byre/.test(e.text)) hunger++;
    if (/autumn count/.test(e.text)) counts++;
    if (/spoiled/.test(e.text)) spoiled++;
  }
  seenT = st.events.length ? st.events[0].t : seenT;
}
slaughtered = st.households.reduce((s, h) => s + F.larderOf(h, 'salt meat'), 0);
check(hunger === 0, `founders: ${hunger} animals died of hunger in the byre`);
check(counts >= 3, `founders: only ${counts} autumn counts culled anything in 3 years`);
check(!checkState(st).length, 'founders after 3 years: ' + checkState(st).slice(0, 3).join('; '));
if (failed) process.exit(1);
console.log(`byre ok: founders 7, 3 years: ${counts} counts with culls, ${spoiled} lots of meat spoiled, ${slaughtered.toFixed(1)} salt meat in larders, ` +
  `${herdSize()} animals`);

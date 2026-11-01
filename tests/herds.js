// Herds (VB-131): the founders' herds as Kim decided; calves and lambs each spring; no calf without a bull within reach; populous herds fit
// the byre and each village with cattle has its bull; a dissolved household's herds go to its people's new home; the state invariants hold.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, H = VB['sim/herds'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HERDS FAIL:', m); } };
const world = (seed, cols, rows) => { const it = G.generate(seed, { cols, rows }); let r; while (!(r = it.next()).done); return r.value; };
const kinds = (hd) => hd.head.map((h) => h.kind).sort().join(',');

// --- founders, seed 7: three farms with cattle, the first with the bull and oxen; two with sheep, the first with the ram; the lone farm none
let st = Sim.seed(world(7, 120, 85), 7, 'founders');
const hhs = st.households.filter((h) => !h.dissolved), loneOf = (h) => st.villages[st.farmsteads[h.farmstead].village].farmsteads.length < 2;
const cattle = hhs.map((h) => H.herdOf(st, h, 'cattle')), sheep = hhs.map((h) => H.herdOf(st, h, 'sheep'));
check(hhs.length === 4 && loneOf(hhs[3]), `founders: expected three village farms and a lone farm, got ${hhs.length}`);
check(cattle[0] && kinds(cattle[0]) === 'bull,cow,cow,ox,ox', `founders: first farm's cattle ${cattle[0] && kinds(cattle[0])}`);
check(cattle[1] && kinds(cattle[1]) === 'cow,cow' && cattle[2] && kinds(cattle[2]) === 'cow,cow', 'founders: second and third farms keep 2 cows each');
check(!cattle[3] && !sheep[3] && !sheep[2], 'founders: the lone farm keeps no animals, the third farm no sheep');
check(sheep[0] && sheep[0].ewes === 4 && sheep[0].rams === 1 && sheep[1] && sheep[1].ewes === 4 && sheep[1].rams === 0, 'founders: 4 ewes each, a ram at the first');
for (const h of hhs) {
  const want = Math.round(H.householdHay(st, h) * (Sim.HERD.stall[1] + Sim.HERD.stallDays) * Sim.HERD.startMargin);
  check(h.hay === want, `founders: household ${h.id} starts with ${h.hay} hay, wanted ${want}`);
}
check(!checkState(st).length, 'founders at the start: ' + checkState(st).slice(0, 3).join('; '));
// a year and spring day 3: calves and lambs. Cattle do not die over this winter, so the bull's yearly chance of dying (3%, which fell on it
// once the Disputed claims custom shifted the random draws) does not decide a test of calving.
const deathRate = Sim.HERD.death.cattle; Sim.HERD.death.cattle = 0;
Sim.advance(st, Sim.YEAR + Sim.HERD.springDay * Sim.DAY + 6);
Sim.HERD.death.cattle = deathRate;
const calves = st.herds.reduce((s, hd) => s + (hd.head ? hd.head.filter((h) => h.kind === 'calf').length : 0), 0);
const lambs = st.herds.reduce((s, hd) => s + (hd.lambs || 0), 0);
check(calves >= 2 && lambs >= 3, `founders year 2: ${calves} calves and ${lambs} lambs born`);
check(st.events.some((e) => /born this spring/.test(e.text)), 'founders year 2: no log line for the births');
check(!checkState(st).length, 'founders year 2: ' + checkState(st).slice(0, 3).join('; '));
const report = `founders seed 7, year 2: ${calves} calves, ${lambs} lambs; ` + hhs.filter((h) => h.herds.length).map((h) => H.describeHerds(st, h)).join(' / ');

// --- without a bull no cow calves
st = Sim.seed(world(7, 120, 85), 7, 'founders');
for (const hd of st.herds) if (hd.head) hd.head = hd.head.filter((h) => h.kind !== 'bull');
Sim.advance(st, Sim.YEAR + Sim.HERD.springDay * Sim.DAY + 6);
check(st.herds.every((hd) => !hd.head || !hd.head.some((h) => h.kind === 'calf')), 'no bull: a cow calved');

// --- a dissolved household's herds go to another, merged by species
const [from, to] = [st.households[1], st.households[0]], before = H.herdOf(st, to, 'cattle').head.length + H.herdOf(st, from, 'cattle').head.length;
H.passHerds(st, from, to.id);
check(H.herdOf(st, to, 'cattle').head.length === before && !from.herds.length && from.hay === 0, 'passHerds: the cattle did not all move');
check(!checkState(st).length, 'after passHerds: ' + checkState(st).slice(0, 3).join('; '));

// --- populous, tiny map: every herd fits the byre; a village with cattle has a bull, one with sheep a ram
st = Sim.seed(world(7, 120, 85), 7, 'populous');
for (const hd of st.herds) if (hd.head) check(H.byreRoom(hd) <= Sim.HERD.byre, `populous: herd ${hd.id} needs ${H.byreRoom(hd)} places in the byre`);
for (const v of st.villages) {
  const vh = st.herds.filter((hd) => st.farmsteads[st.households[hd.household].farmstead].village === v.id);
  if (vh.some((hd) => hd.head)) check(vh.some((hd) => hd.head && hd.head.some((h) => h.kind === 'bull')), `populous: village ${v.name} has cattle but no bull`);
  if (vh.some((hd) => hd.ewes)) check(vh.some((hd) => hd.rams > 0), `populous: village ${v.name} has sheep but no ram`);
}
const share = st.households.filter((h) => H.herdOf(st, h, 'cattle')).length / st.households.length;
check(share > 0.55 && share < 0.95, `populous: ${Math.round(share * 100)}% of farms keep cattle`);
check(!checkState(st).length, 'populous at the start: ' + checkState(st).slice(0, 3).join('; '));
Sim.advance(st, Sim.YEAR);
check(!checkState(st).length, 'populous after a year: ' + checkState(st).slice(0, 3).join('; '));

if (failed) process.exit(1);
console.log(`herds ok: ${report}`);

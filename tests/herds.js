// @suite integration
// Herds (VB-131): the founders' herds as Kim decided; calves and lambs each spring; no calf without a bull within reach; populous herds fit
// the byre and each village with cattle has its bull; a dissolved household's herds go to its people's new home; the state invariants hold.
// On the small islands of tests/lib/probe.js (VB-855).
const VB = require('../src/load.js'), Sim = VB.sim, { scenario } = require('./lib/probe.js'), H = VB['sim/herds'], HO = VB['sim/droving'], { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HERDS FAIL:', m); } };
const kinds = (hd) => hd.head.map((h) => h.kind).sort().join(',');

// --- founders, seed 7: three farms with cattle, the first with the bull and oxen; two with sheep, the first with the ram; the lone farm none
let st = scenario('founders', 7);
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
// once the Disputed claims custom shifted the random draws) does not decide a test of calving; nor does a newborn lamb's chance of dying
// (two of three ewes' three lambs died once the afternoon's allotment shifted the herds' draws, VB-1546); nor does a cow's chance of calving
// and a calf's of dying (one calf of five cows once VB-446's way out and VB-312's loans shifted the draws): every cow with a bull in reach calves
const deathRate = Sim.HERD.death.cattle, lambDeath = Sim.HERD.lambDeath, calve = Sim.HERD.calve, calfDeath = Sim.HERD.calfDeath;
Sim.HERD.death.cattle = 0; Sim.HERD.lambDeath = 0; Sim.HERD.calve = 1; Sim.HERD.calfDeath = 0;
Sim.advance(st, Sim.YEAR + Sim.HERD.springDay * Sim.DAY + 6);
Sim.HERD.death.cattle = deathRate; Sim.HERD.lambDeath = lambDeath; Sim.HERD.calve = calve; Sim.HERD.calfDeath = calfDeath;
const calves = st.herds.reduce((s, hd) => s + (hd.head ? hd.head.filter((h) => h.kind === 'calf').length : 0), 0);
const lambs = st.herds.reduce((s, hd) => s + (hd.lambs || 0), 0);
// lambs: 2 or 3 of the first farm's 3 ewes left by spring, by the draws (3 before VB-1525 shifted them; the second farm's ewes are gone in both)
check(calves >= 2 && lambs >= 2, `founders year 2: ${calves} calves and ${lambs} lambs born`);
check(Sim.villageLog(st, Infinity).some((e) => /born this spring/.test(e.text)), 'founders year 2: no log line for the births');
check(!checkState(st).length, 'founders year 2: ' + checkState(st).slice(0, 3).join('; '));
const report = `founders seed 7, year 2: ${calves} calves, ${lambs} lambs; ` + hhs.filter((h) => h.herds.length).map((h) => H.describeHerds(st, h)).join(' / ');

// --- without a bull no cow calves
st = scenario('founders', 7);
for (const hd of st.herds) if (hd.head) hd.head = hd.head.filter((h) => h.kind !== 'bull');
Sim.advance(st, Sim.YEAR + Sim.HERD.springDay * Sim.DAY + 6);
check(st.herds.every((hd) => !hd.head || !hd.head.some((h) => h.kind === 'calf')), 'no bull: a cow calved');

// --- a dissolved household's herds go to another: its own at once, standing at the old farm until led home (VB-674; tests/handover.js)
const [from, to] = [st.households[1], st.households[0]], before = H.herdOf(st, to, 'cattle').head.length + H.herdOf(st, from, 'cattle').head.length;
HO.passHerds(st, from, to.id);
const standing = (st.herdsAway || []).map((id) => st.herds[id]).filter((hd) => hd.household === to.id && hd.head);
check(H.herdOf(st, to, 'cattle').head.length + standing.reduce((n, hd) => n + hd.head.length, 0) === before && !from.herds.length && from.hay === 0, 'passHerds: the cattle did not all move');
check(!checkState(st).length, 'after passHerds: ' + checkState(st).slice(0, 3).join('; '));

// --- populous: every herd fits the byre; a village with cattle has a bull, one with sheep a ram
st = scenario('populous', 2); // the herds drawn at seeding move with every custom added (VB-711, VB-826, VB-555)
for (const hd of st.herds) if (hd.head) check(H.byreRoom(hd) <= Sim.HERD.byre, `populous: herd ${hd.id} needs ${H.byreRoom(hd)} places in the byre`);
for (const v of st.villages) {
  const vh = st.herds.filter((hd) => st.farmsteads[st.households[hd.household].farmstead].village === v.id);
  if (vh.some((hd) => hd.head)) check(vh.some((hd) => hd.head && hd.head.some((h) => h.kind === 'bull')), `populous: village ${v.name} has cattle but no bull`);
  if (vh.some((hd) => hd.ewes)) check(vh.some((hd) => hd.rams > 0), `populous: village ${v.name} has sheep but no ram`);
}
const share = st.households.filter((h) => H.herdOf(st, h, 'cattle')).length / st.households.length;
check(share > 0.55 && share < 0.95, `populous: ${Math.round(share * 100)}% of farms keep cattle`);
check(!checkState(st).length, 'populous at the start: ' + checkState(st).slice(0, 3).join('; '));
Sim.advance(st, (Sim.HERD.stall[0] + 2) * Sim.DAY); // into the byre season, past the autumn count (the spring's births are founders')
check(!checkState(st).length, 'populous in the byre: ' + checkState(st).slice(0, 3).join('; '));

// --- shares and a new household's start (VB-140): a cow and two ewes, when the old household keeps a cow and its winter hay
{
  const live = (s) => s.households.filter((h) => !h.dissolved);
  const s2 = scenario('founders', 7), old = live(s2)[1], nw = live(s2)[2];
  const oc = H.herdOf(s2, old, 'cattle'), os = H.herdOf(s2, old, 'sheep'), cows0 = oc.head.length, ewes0 = os.ewes;
  check(HO.startHerd(s2, old, nw) === 3, 'start: a cow and two ewes move');
  check(oc.head.length === cows0 - 1 && os.ewes === ewes0 - 2, 'start: the old household gives up one cow and two ewes');
  const away2 = s2.herdsAway.map((id) => s2.herds[id]).find((hd) => hd.household === nw.id && hd.head);
  check(away2 && away2.at === old.farmstead && away2.head.filter((h) => h.kind === 'cow').length === 1, 'start: the new household has a cow, at the old farm');
  check(old.hay >= H.winterNeed(s2, old), `start: the old household keeps its winter hay (${old.hay} of ${H.winterNeed(s2, old)})`);
  check(oc.head.some((h) => h.kind === 'cow'), 'start: a cow stays');
  check(!checkState(s2).length, 'start: ' + checkState(s2).slice(0, 3).join('; '));
  const s3 = scenario('founders', 7), o3 = live(s3)[1], n3 = live(s3)[2];
  o3.hay = 0; check(HO.startHerd(s3, o3, n3) === 0, 'start: no hay, no animals');
  const s4 = scenario('founders', 7), o4 = live(s4)[1], n4 = live(s4)[2];
  const paid = HO.payInAnimals(s4, o4, n4, 70);
  check(paid === 64, `share in animals: ${paid} of 70 rations paid`);
  check(!checkState(s4).length, 'share: ' + checkState(s4).slice(0, 3).join('; '));
  // an animal marked for slaughter that is given away leaves the cull list with it (found by tests/invariants.js, VB-342)
  const s5 = scenario('founders', 7), o5 = live(s5)[1], n5 = live(s5)[2], c5 = H.herdOf(s5, o5, 'cattle');
  const cow = c5.head.find((h) => h.kind === 'cow');
  c5.cull.push({ id: c5.cullSeq++, head: cow.id, lean: false });
  check(HO.startHerd(s5, o5, n5) > 0 && !c5.head.includes(cow) && !c5.cull.length, `start: the marked cow went and its mark with it (${c5.cull.length} left)`);
  check(!checkState(s5).length, 'start, a marked cow: ' + checkState(s5).slice(0, 3).join('; '));
}

// --- a crowded pasture lowers the milk (VB-709): founders seed 7, first farm (cattle and sheep), a cow in milk in summer
{
  const s = scenario('founders', 7), B = VB['sim/byre'], G = VB['sim/grazing'], Hd = VB['sim/herds'], HH = Sim.HERD.herding;
  Sim.advance(s, (Sim.HERD.springDay + 20) * Sim.DAY);
  const hh = s.households.find((h) => !h.dissolved && Hd.herdOf(s, h, 'cattle')), tile = hh.pasture ? hh.pasture.tile : s.farmsteads[hh.farmstead].house;
  hh.pasture = { tile, since: 0 };
  const milkOf = (pressure, herded) => {
    s.w.graze[tile] = pressure * (2 ** ((s.t - Sim.YEAR * Math.floor(s.t / Sim.YEAR)) / Sim.YEAR));
    const cal = VB['sim/rules'].cal(s.t);
    for (const id of hh.herds) { s.herds[id].herded = herded ? cal.day : -9; }
    hh.totals = []; hh.larder = [];
    const before = hh.larder.reduce((a, l) => a + l.n, 0);
    B.milkDone(s, hh, cal);
    return hh.larder.reduce((a, l) => a + l.n, 0) - before;
  };
  const lone = milkOf(0.5 * HH.downAt, true), two = milkOf(2 * HH.downAt, true), four = milkOf(4 * HH.downAt, true), huge = milkOf(40 * HH.downAt, true);
  const alone = milkOf(HH.downAt, true), unh = milkOf(4 * HH.downAt, false), unh0 = milkOf(0, false);
  check(lone > 0 && Math.abs(lone - alone) < 1e-9, `lone herd at a week's pressure: ${lone} against ${alone}`);
  check(two < alone && four < two, `crowded: ${alone}, ${two}, ${four}`);
  check(Math.abs(two / alone - (1 - HH.bite)) < 1e-5, `at twice a week's pressure the factor is ${two / alone}`);
  check(Math.abs(huge / alone - HH.floor) < 1e-5, `never under the floor: ${huge / alone}`);
  check(Math.abs(unh - unh0) < 1e-9 && Math.abs(unh / alone - HH.milk) < 1e-9, `unherded takes no bite: ${unh}, ${unh0}, ${alone}`);
}

// --- a herd standing beyond a day's walk of its household (VB-1709): populous small seed 7, a cow given at a farm 20 hours' walk away was
// taken up every morning and dropped at 14:00, and stood there for years. Its `drove` is not posted; at the frost the farm's household
// takes it in, as one with nobody; one within reach waits for its own; a herd whose last animal starved there leaves the list.
{
  const { tinyWorld, tinyState } = require('./lib/tiny.js'), K = HO.KIND;
  const w = tinyWorld(Array.from({ length: 7 }, () => '.'.repeat(170)));
  const s = tinyState(w, [{ at: [8, 3], farms: 2 }, { at: [160, 3], farms: 1 }], { seed: 3, herds: true });
  const hh = (v) => s.households.find((h) => !h.dissolved && h.farmstead !== null && s.farmsteads[h.farmstead].village === v);
  const near = s.households.filter((h) => !h.dissolved && h.farmstead !== null && s.farmsteads[h.farmstead].village === 0);
  const far = hh(1), [a, b] = near;
  for (const h of [a, b, far]) h.hay = 10000; // every one keeps its winter hay and has animals to give
  const give = (from, to) => { HO.payInAnimals(s, from, to, 1000, ['cow'], false); return (s.herdsAway || []).map((id) => s.herds[id]).find((hd) => hd.household === to.id && hd.at === from.farmstead); };
  const posted = (h) => { const keys = []; K.available(s, h, s.farmsteads[h.farmstead], null, (key) => keys.push(key)); return keys; };
  const there = give(far, a), close = give(b, a);
  check(there && close && there.head.length && close.head.length, 'far: a cow stands at the far farm and one at the near farm for the same household');
  if (there && close) {
    check(posted(a).includes(`drove:H${close.id}`) && !posted(a).includes(`drove:H${there.id}`), `far: posted ${posted(a).join(', ')}`);
    const keeps = H.herdOf(s, far, 'cattle').head.length, n = there.head.length;
    HO.frost(s);
    check(there.at === undefined && !(s.herdsAway || []).includes(there.id) && H.herdOf(s, far, 'cattle').head.length === keeps + n,
      'far: at the frost the far farm takes in the herd its owner cannot fetch');
    check(close.at !== undefined && close.household === a.id, 'far: the herd within reach still waits for its owner at the frost');
    check(!checkState(s).length, 'far, after the frost: ' + checkState(s).slice(0, 3).join('; '));
    // a herd left at a landing of its own farm (leaveAt) beyond a day's walk is not brought home by the frost: it waits for its drove
    const landing = 3 * 170 + 140, homeHerds = b.herds.length;
    HO.leaveAt(s, b, landing);
    const left = (s.herdsAway || []).map((id) => s.herds[id]).filter((hd) => hd.tile === landing);
    HO.frost(s);
    check(homeHerds > 0 && left.length === homeHerds && left.every((hd) => hd.at === b.farmstead && hd.tile === landing && hd.household === b.id) && !b.herds.length,
      `far: a herd left at its own farm's landing stays there at the frost (${left.length} of ${homeHerds})`);
    close.head = [];
    HO.emptied(s, close);
    check(close.at === undefined && !(s.herdsAway || []).includes(close.id) && close.household === null, 'far: an emptied herd leaves the list');
    check(!checkState(s).length, 'far, emptied: ' + checkState(s).slice(0, 3).join('; '));
  }
}

if (failed) process.exit(1);
console.log(`herds ok: ${report}`);

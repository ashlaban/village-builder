// The village overview (VB-162; sim/overview, Sim.villageSummary): food in store and its days of need, the latest harvest against a year's
// need, people by age band now and a year ago, households hungry in the window, the idle share of the hands' hours, and the warnings with
// the households they concern, each checked against a hand count on the probe's small village, its stores, logs and ages set by hand.
// The summary writes nothing; with no viewer, its estimate is the village's eldest holder's.
const VB = require('../src/load.js'), Sim = VB.sim;
const { DAY, YEAR, SEASON_DAYS, WORK, TICKS, ECON } = VB['sim/rules'];
const { OVERVIEW, villageSummary } = VB['sim/overview'];
const Stores = VB['sim/stores'], { fieldsWorkable } = VB['sim/fields'], { heirRanking } = VB['sim/heirs'], { toHarvest } = VB['sim/hunger'];
const probe = require('./lib/probe.js');
let failed = 0;
const check = (ok, m) => { if (!ok) { failed++; console.error('OVERVIEW FAIL:', m); } };
const near = (a, b) => Math.abs(a - b) < 1e-6;
const st = probe.state();
st.naturalDeaths = false;
// the clock: year 2, spring, day 3 of the season, 10:00 (the latest harvest is year 1's)
const T = YEAR + 3 * DAY + 10;
st.tick = Math.round(T * TICKS); st.t = st.tick / TICKS;
const v = st.villages[0], [h0, h1] = v.farmsteads.map((f) => st.households[st.farmsteads[f].household]);
check(h0.members.length === 6 && h1.members.length === 5 && h0.holder === 0 && h1.holder === 6, 'the probe village as expected');
// ages (years before T), and three of h1's dead half a year ago: so a year ago they were living
const AGES = { 0: 65.5, 1: 40.5, 2: 0.5, 3: 14.5, 4: 7.5, 5: 50.2, 6: 70.5, 7: 12.5, 8: 3.5, 9: 10.5, 10: 20.5 };
for (const [id, a] of Object.entries(AGES)) {
  const p = st.pawns[id];
  p.born = T - a * YEAR; p.age = Math.floor(a); p.retired = false;
}
for (const id of [8, 9, 10]) { const p = st.pawns[id]; p.alive = false; p.died = T - 0.5 * YEAR; }
// stores: h0 holds its grain, 8 meals and 20 in sheaves; h1 holds nothing; the village store nothing
for (const hh of [h0, h1]) { hh.flour = 0; hh.larder = []; hh.fresh = []; hh.ledger = []; }
h0.meals = 8; h0.unthreshed = [20];
h1.grain = {}; h1.meals = 0; h1.unthreshed = [];
v.grain = {}; v.ledger = [];
// the latest harvest: 60 in sheaves for h0 and 15 of grain for the village store in year 1's autumn; one of year 0's left out
h0.ledger.push({ t: 26 * DAY, kind: 'harvest', good: 'sheaves', n: 60 }, { t: 27 * DAY, kind: 'thresh', good: 'sheaves', n: -20 });
v.ledger.push({ t: 30 * DAY, kind: 'harvest', good: 'grain', n: 15 }, { t: -20 * DAY, kind: 'harvest', good: 'grain', n: 99 });
// hunger logs: h0 short on two days (two members, different days), h1 on one; a dead member's log is not read
for (const hh of [h0, h1]) for (const id of hh.members) st.pawns[id].hungerLog = Array(12).fill(0);
st.pawns[1].hungerLog[11] = 0.5; st.pawns[3].hungerLog[8] = 1; st.pawns[7].hungerLog[10] = 0.3; st.pawns[8].hungerLog.fill(1);
// work hours: h0 30 this season and 120 the season before; h1 50 the season before and none yet this one
h0.workHours = [2 * 4, 30, 120]; h1.workHours = [2 * 4 - 1, 50, 0];

const before = JSON.stringify(Sim.save(st));
const s = Sim.villageSummary(st, 0, 0);
check(JSON.stringify(Sim.save(st)) === before, 'the summary writes nothing');
check(villageSummary === Sim.villageSummary, 'one function: the Sim facade is sim/overview\'s');
// the viewer and its estimate
check(s.viewer && s.viewer.pawn === 0 && s.viewer.toHarvest === toHarvest(T) && s.viewer.days <= 21, `viewer ${JSON.stringify(s.viewer)}`);
check(Sim.villageSummary(st, 0).viewer.pawn === 6, 'with no viewer, the eldest living holder');
check(Sim.villageSummary(st, 0, 8).viewer.pawn === 6, 'a dead viewer: the eldest holder');
// people by band: now 0-14: 2, 3, 4, 7; 15-49: 1; 50+: 0, 5, 6. A year ago 0-14: 3, 4, 7, 8, 9; 15-49: 1, 5, 10; 50+: 0, 6
check(s.people === 8, `people ${s.people}`);
check(s.bands.now.join() === '4,1,3', `bands now ${s.bands.now}`);
check(s.bands.ago.join() === '5,3,2', `bands a year ago ${s.bands.ago}`);
// food: the households' (h0's grain less its seed, its meals and sheaves) and the village store's, against a day's need
const ad = ECON.ration.adult, ch = ECON.ration.child;
const food0 = Math.max(0, 180 - Stores.reserved(st, h0, 'grain')) + 8 + 20;
// h0: 0, 1, 3 and 5 eat as adults (14 on), 2 and 4 as children; h1: its holder and 7, a child
const need0 = [0, 1, 2, 3, 4, 5].reduce((n, id) => n + (AGES[id] >= 14 ? ad : ch), 0), need1 = ad + ch;
check(near(s.food.need, need0 + need1), `need ${s.food.need} against ${need0 + need1}`);
check(near(s.food.rations, food0) && s.food.store === 0, `food ${s.food.rations} against ${food0}`);
check(near(s.food.days, food0 / (need0 + need1)), `days of food ${s.food.days}`);
// the latest harvest: year 1's, 75 against a year's need
check(s.harvest.year === 1 && near(s.harvest.rations, 75), `harvest ${JSON.stringify(s.harvest)}`);
check(near(s.harvest.share, 75 / ((need0 + need1) * VB['sim/rules'].YEAR_DAYS)), `harvest share ${s.harvest.share}`);
// hungry: both households on some day; h0 on two (the warning's count), h1 on one
check(OVERVIEW.hungry === 2 && s.hungry.window === 12, `the window ${s.hungry.window}, warned at ${OVERVIEW.hungry}`);
check(s.hungry.households.join() === `${h0.id},${h1.id}`, `hungry ${s.hungry.households}`);
check(s.warnings.hunger.join() === `${h0.id}`, `hunger warning ${s.warnings.hunger}`);
// idle: 3.33 days into the season, h0's hands (1, 3, 5) had 3 x 12 x 12 hours and worked 30 + 120 x (12 - 3.33) / 12; h1 has no hands
const into = 3 + (10 - WORK[0]) / (WORK[1] - WORK[0]), part = (SEASON_DAYS - into) / SEASON_DAYS;
const worked = 30 + 120 * part + 50 * part, had = 3 * (WORK[1] - WORK[0]) * SEASON_DAYS;
check(near(s.idle.worked, worked) && near(s.idle.had, had) && near(s.idle.share, 1 - worked / had), `idle ${JSON.stringify(s.idle)}`);
// warnings that foretell: h1 holds no food at all; h1's three fields with no hands
check(s.warnings.food.join() === `${h1.id}` && s.food.short === false, `food warning ${s.warnings.food}, short ${s.food.short}`);
const short1 = st.farmsteads[h1.farmstead].fields.length > fieldsWorkable(st, h1, s.viewer.perHand);
check(short1 && s.warnings.hands.join() === `${h1.id}`, `hands warning ${s.warnings.hands}`);
// heirs: h0's holder (65) has children at home; h1's (70) has none living
check(heirRanking(st, h0).some((id) => st.pawns[id].alive && st.pawns[id].household === h0.id), 'h0 has an heir at home');
check(s.warnings.heir.join() === `${h1.id}`, `heir warning ${s.warnings.heir}`);
// a village store counts with the households, less its own seed
v.grain = { barley: 40 };
const s2 = Sim.villageSummary(st, 0, 0), store = Math.max(0, 40 - Stores.reserved(st, v, 'grain'));
check(near(s2.food.store, store) && near(s2.food.rations, food0 + store), `village store ${s2.food.store}`);
// who cannot marry (VB-1120), by hand: adults of marrying age are the men 0 and 6 (from 20) and the women 1 and 5 (from 18); of them 5 is
// unmarried (6's wife 7 is 12); h1 is a household of one adult
check(s.marry.adults.m === 2 && s.marry.adults.f === 2, `adults ${JSON.stringify(s.marry.adults)}`);
check(s.marry.single.m === 0 && s.marry.single.f === 1, `unmarried ${JSON.stringify(s.marry.single)}`);
check(s.marry.alone.join() === `${h1.id}`, `households of one adult ${s.marry.alone}`);
{
  const R = VB['sim/records'], isAdult = (p) => R.age(st, p) >= (p.sex === 'm' ? 20 : 18);
  const r = { f: 0, m: 0 };
  for (const id of VB['sim/matching'].poolFor(st, 0)) { const p = st.pawns[id]; if (isAdult(p) && R.spouseOf(st, id) === null) r[p.sex]++; }
  check(r.f === s.marry.reach.f && r.m === s.marry.reach.m && r.f >= 1, `reach ${JSON.stringify(s.marry.reach)} against the pool's ${JSON.stringify(r)}`);
  // 3 and 4 come of age, unmarried: the village's men outnumber its women two to one
  for (const id of [3, 4]) { const p = st.pawns[id]; p.born = T - 25 * YEAR; p.age = 25; }
  const s3 = Sim.villageSummary(st, 0, 0);
  check(s3.marry.single.m === 2 && s3.marry.single.f === 1, `unmarried now ${JSON.stringify(s3.marry.single)}`);
  const want = s3.marry.reach.m >= 2 * s3.marry.reach.f ? 'm' : null;
  check(s3.marry.by === want && (want ? s3.warnings.match.join() === `${h0.id}` : s3.warnings.match.length === 0), `warning ${JSON.stringify(s3.marry)} ${s3.warnings.match}`);
}
if (failed) process.exit(1);
console.log(`overview ok: ${s.people} people in bands ${s.bands.now} (a year ago ${s.bands.ago}), ${Math.round(s.food.days)} days of food, ` +
  `idle ${Math.round(100 * s.idle.share)}%, warnings ${Object.entries(s.warnings).map(([k, l]) => `${k} ${l.length}`).join(', ')}`);

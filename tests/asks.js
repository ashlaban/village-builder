// @suite integration
// VB-699: a head reads the asks. On a tiny world of two villages, one with pine in its wood: a household with no pit (beside the pit's,
// and one of the village with no pine) lacking the barrel of tar it keeps asks for it at its review (one a good, while open); the pit's head
// reads the asks after the harvest, once a year, of its own village and (from a skill of ASKS.hears) the villages its own gathers with,
// and its target on tar rises by what it reckons it can place (its lean, within its spare hands and a back load); the panel shows it;
// a met ask closes, a year-old one lapses; invariants hold and a save carries the asks.
const assert = require('assert');
const { targets: TG, season: SP } = require('./lib/season.js');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { YEAR, DAY, SEASON_DAYS, TICKS, cal } = VB['sim/rules'];
const P = VB['sim/plans'], Targets = VB['sim/targets'], Asks = VB['sim/asks'], T = VB['sim/tar'];
const rows = Array.from({ length: 14 }, (_, i) => (i < 2 ? 'P'.repeat(12) + '.'.repeat(36) : '.'.repeat(48)));
const st = tinyState(tinyWorld(rows), [{ at: [6, 8], farms: 2, sizes: [6, 5] }, { at: [40, 8], farms: 2, sizes: [6, 5] }], { seed: 4 });
const [A, B] = st.villages;
assert.ok(T.villageTar(st, A) && !T.villageTar(st, B), 'pine in the first village\'s wood only');
const maker = st.households.find((h) => st.farmsteads[h.farmstead].village === A.id);
const asker = st.households.find((h) => h !== maker && st.farmsteads[h.farmstead].village === A.id); // a neighbour with no pit
const far = st.households.find((h) => st.farmsteads[h.farmstead].village === B.id); // of the village with no pine
maker.tarPit = { tile: A.wood.find((t) => T.villageTar(st, A) && t >= 0), village: A.id, built: 0 }; // lint-allow: owner a test gives the pit
for (const h of st.households) h.tar = 0; // lint-allow: owner a test empties the stores
const sound = (label) => { Sim.refreshRoles(st); assert.deepStrictEqual(checkState(st).slice(0, 3), [], `${label}: invariants`); };
const review = (hh) => P.reviewed(st, st.plans.households.get(hh.id), cal(st.t));
const at = (t) => { st.t = t; st.tick = Math.round(t * TICKS); }; // lint-allow: owner a test sets the clock
const spring = (y) => at(y * YEAR + 5 * DAY + 10), autumn = (y) => at(y * YEAR + (2 * SEASON_DAYS + 20) * DAY + 10);

// the ask: a household that cannot make tar and keeps none asks for its barrel; once, while it is open; the maker asks for nothing
spring(0);
review(asker);
review(maker);
let L = st.asks.open.tar;
assert.strictEqual(L.length, 1, 'one ask for tar, none by the maker');
assert.deepStrictEqual([L[0].household, L[0].n, L[0].made], [asker.id, Targets.need(st, asker, 'tar'), st.t], 'its household, the lack, the hour');
review(asker);
assert.strictEqual(st.asks.open.tar.length, 1, 'an open ask is not asked again');
review(far);
assert.deepStrictEqual(st.asks.tally.tar, { asked: 2, met: 0, lapsed: 0 });
sound('asked');

// reading: not before the harvest; then once a year, of the villages its own gathers with (a head of skill ASKS.hears or more)
const plan = st.plans.households.get(maker.id), need = Targets.need(st, maker, 'tar');
assert.strictEqual(plan.placed, undefined, 'a spring review reads no asks');
const kept = st.villages.map((v) => v.gathering);
for (const v of st.villages) v.gathering = { chosen: 'asLastYear', hosting: v.id === A.id, prefs: [A.id], year: 1, host: A.id, by: null }; // lint-allow: owner a test settles the gathering
autumn(0);
plan.fit = { at: cal(st.t).year * 4 + cal(st.t).season, short: 0, week: 2 }; // lint-allow: owner its season judged to fit (VB-1778: a short one lowers the tar), so the target is the asks' alone
VB.resetCounts();
review(maker);
const skill = VB['sim/seasonal'].headSkill(st, maker.id), lean = plan.head.bias.hours;
assert.deepStrictEqual(Asks.heardFrom(st, maker, 1), [A.id, B.id], 'a skilled head hears of the district\'s asks');
assert.deepStrictEqual(Asks.heardFrom(st, maker, 0), [A.id], 'a poor head only of its own village\'s');
const heardOf = L.filter((a) => a.household === asker.id || skill >= Asks.ASKS.hears), heard = heardOf.length;
const most = Targets.bounds(st, maker, 'tar')[1] - need, asked = heardOf.reduce((n, a) => n + a.n, 0);
const want = Math.min(Math.floor(asked * lean + 1e-9), most, Asks.carried('tar'));
assert.strictEqual(VB.count.asksRead, 2, 'each ask passed');
assert.ok(want > 0, 'a head that heard of an ask reckons a barrel to place');
assert.deepStrictEqual([plan.placed.year, plan.placed.heard], [cal(st.t).year, heard], 'read this year');
assert.strictEqual(TG(plan).goods.tar, need + want, 'the target: the need and what it reckons it can place');
assert.strictEqual(Targets.target(st, maker, 'tar'), need + want, 'the maker reads it');
assert.strictEqual(P.headView(st, maker.id).goods.tar.placed, want, 'the panel shows the head\'s reckoning');
VB.resetCounts();
review(maker);
assert.strictEqual(VB.count.asksRead, 0, 'read once a year');
st.villages.forEach((v, i) => (v.gathering = kept[i])); // lint-allow: owner a test restores the gathering
sound('read');

// a save carries the asks and the reckoning
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(back.asks, st.asks, 'the asks saved');
assert.deepStrictEqual(back.plans.households.get(maker.id).placed, plan.placed, 'the reckoning saved');

// met: the asker holds its need at its next review; a new ask a year old lapses
asker.tar = Targets.need(st, asker, 'tar'); // lint-allow: owner a test fills the store
review(asker);
assert.deepStrictEqual([st.asks.open.tar.length, st.asks.tally.tar.met], [1, 1], 'met when it holds its need');
asker.tar = 0; // lint-allow: owner a test empties the store
review(asker);
assert.strictEqual(st.asks.open.tar.length, 2, 'asked again when it lacks');
at(st.t + YEAR);
review(asker);
assert.deepStrictEqual([st.asks.tally.tar.lapsed, st.asks.open.tar.length, st.asks.tally.tar.asked], [1, 2, 4], 'a year old: lapsed, and asked anew');
sound('lapsed');
console.log(`asks ok (skill ${skill.toFixed(2)}, placed ${want})`);

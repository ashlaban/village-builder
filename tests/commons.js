// VB-100: common fields worked by the village. A village of three farms whose store is empty may choose a common field at its meeting
// (VB-257, a routine only a meeting sets); its review makes the project plan: a free meadow tile within COMMONS.reach steps of the green,
// claimed by the village, cleared and broken by its adults (the kinds `clear` and `break`, owned by the village, taken on the `villager`
// basis), then hoed, sown with seed from the village store, reaped and hauled to the green, its grain into the village store. The priority
// of its tasks is the village's custom `commons`: the village duty's less 2, as it, or plus 2. Help a household was given leans its people
// towards the next higher option. On a small constructed state; the invariants hold, and a save keeps it.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, C = VB.culture;
const { tinyWorld, tinyState, setPractice } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Plans = VB['sim/plans'], Commons = VB['sim/commons'], Stores = VB['sim/stores'];
const { eligible } = VB['sim/eligibility'], { book } = VB['sim/relations'], { refreshInterests } = VB['sim/society'];
const { ROLES, DAY, YEAR, cal } = VB['sim/rules'], { COMMONS } = VB['sim/commons'];
const { hexSteps } = VB['sim/hex'];
const st = tinyState(tinyWorld(Array(16).fill('.'.repeat(24)), { seed: 3 }), [{ at: [11, 8], farms: 3, sizes: [6, 6, 5] }], { seed: 5 });
const v = st.villages[0], w = st.w, plan = Plans.planOf(st, 'village', v.id);
const bad = () => checkState(st);

// the custom: three options, `fair` in the old Nordic archetype; the priorities as Kim set them (the village duty's, VB-058)
assert.deepStrictEqual(C.DIMS[C.IDX.commons].opts.map((o) => o[0]), ['own', 'fair', 'first']);
assert.strictEqual(C.fromArchetype('oldNordic')[C.IDX.commons], C.optIndex('commons', 'fair'));
const prios = (opt) => {
  setPractice(st, v.id, { commons: opt });
  return Object.fromEntries(Object.keys(ROLES).map((r) => [r, Commons.commonPrio(st, { role: r }, { village: v.id })]));
};
assert.deepStrictEqual(prios('fair'), { farmer: 5, wife: 3, farmhand: 6, maid: 3, son: 6, daughter: 3, retired: 0, child: 0 });
assert.deepStrictEqual(prios('own'), { farmer: 3, wife: 1, farmhand: 4, maid: 1, son: 4, daughter: 1, retired: 0, child: 0 });
assert.deepStrictEqual(prios('first'), { farmer: 7, wife: 5, farmhand: 8, maid: 5, son: 8, daughter: 5, retired: 0, child: 0 });
setPractice(st, v.id, { commons: 'fair' });

// the condition: three occupied farms, an empty store, meadow near the green; the founders' first routines hold no common field
assert.strictEqual(Sim.grainOf(v), 0, 'the store is empty');
assert.ok(Commons.storeDays(st, v) < COMMONS.storeDays && Commons.wanted(st, v), 'the village would make a common field');
assert.ok(Plans.VILLAGE_ROUTINES.commons.available(st, v) && Plans.VILLAGE_ROUTINES.commons.meeting);
assert.ok(!plan.routines.includes('commons'), 'not among the founders\' routines: only a meeting sets it');
const tile = Commons.site(st, v);
// households that will have a surplus to give the store at the moving round (sim/help, fillStores): its seed comes from there
for (const id of v.farmsteads) st.households[st.farmsteads[id].household].grain.barley += 400;
assert.ok(tile >= 0 && hexSteps(w, v.center, tile) <= COMMONS.reach && !st.used.has(tile) && !w.dev[tile], 'a free meadow tile near the green');

// within two years: the meeting chooses it, the field is made, sown from the store, and its harvest reaches the store
let made = null, sown = null, harvest = 0, jobSeen = null, took = null;
const start = st.t;
while (st.t < start + 2 * YEAR && !harvest) {
  Sim.advance(st, DAY / 4);
  const p = Commons.underWay(st, v);
  if (p && !made) {
    made = st.t;
    assert.ok(plan.routines.includes('commons') && plan.routinesBy === 'meeting', 'begun as a routine its meeting chose');
    assert.ok(st.claims.get(p.steps[0].place).some((c) => c.by.type === 'village' && c.by.id === v.id), 'the tile is claimed by the village');
    assert.deepStrictEqual(p.steps.map((s) => s.kind), ['clear', 'break']);
  }
  for (const j of st.jobs.values())
    if (j.common && j.claims.length && !jobSeen) {
      jobSeen = j;
      assert.deepStrictEqual(j.owner, { type: 'village', id: v.id }, 'the village owns its tasks');
      took = j.claims.map((id) => [st.pawns[id].role, eligible(st, j, st.pawns[id])]);
    }
  const fd = Commons.fieldsOf(v)[0];
  if (fd && fd.sown !== null && !sown) sown = st.t;
  harvest = v.ledger.filter((e) => e.kind === 'harvest' && e.good === 'grain').reduce((n, e) => n + e.n, 0);
}
assert.ok(made, 'a common field is begun');
assert.ok(jobSeen && took.every(([, b]) => b === 'villager'), `its tasks taken by its adults as villagers: ${JSON.stringify(took)}`);
assert.ok(took.every(([r]) => r !== 'child' && r !== 'retired'), 'by adults');
const fd = Commons.fieldsOf(v)[0];
assert.ok(fd, 'the ground is broken: a common field');
assert.strictEqual(st.owner[fd.tile], -v.id - 1, 'the field is the village\'s');
assert.ok(sown, 'it is sown');
const seed = v.ledger.filter((e) => e.kind === 'seed').reduce((n, e) => n - e.n, 0);
assert.ok(seed > 0, 'its seed came from the village store');
assert.ok(harvest > 0, `its harvest reached the village store within two years (${((st.t - start) / YEAR).toFixed(2)} years)`);
assert.ok(Sim.villageLog(st).some((x) => /common field/.test(x.text)), 'the village\'s log tells it');
assert.deepStrictEqual(bad(), [], 'invariants');

// help received leans a person towards the next higher option, in proportion to the days of need owed, fading as goodwill fades
const [h1, h2] = v.farmsteads.map((id) => st.households[st.farmsteads[id].household]);
const k = C.OFF[C.IDX.commons] + C.optIndex('commons', 'first'), adult = st.pawns[h1.members.find((id) => st.pawns[id].age >= 16)];
// what h1's holder owed from the run is squared first (the run's history differs with the course of an illness, VB-1118)
for (const g of VB['sim/relations'].goodwillOf(st, h1.holder)) if (g.balance < 0) book(st, h1.holder, g.other, -g.balance);
refreshInterests(st);
const before = adult.interest[k];
assert.strictEqual(Commons.helpLean(st, adult, v.id), null, 'no help received: no lean');
// twenty days of need given, net of what the two holders owed each other before (an ale evening's share, VB-522)
book(st, h2.holder, h1.holder, 20 * VB['sim/hunger'].dailyNeed(st, h1) - VB['sim/relations'].balance(st, h2.holder, h1.holder));
const lean = Commons.helpLean(st, adult, v.id);
assert.strictEqual(lean.to, C.optIndex('commons', 'first'), 'towards the option above `fair`');
assert.ok(Math.abs(lean.w - COMMONS.pull * 20 / COMMONS.fullDays) < 1e-6, `in proportion to the days owed (${lean.w})`);
refreshInterests(st);
assert.ok(adult.interest[k] > before, 'its interest leans to `first`');
st.t += 5 * YEAR; // goodwill fades as it is read
assert.ok(Commons.helpLean(st, adult, v.id).w < lean.w, 'and fades with the goodwill');
st.t -= 5 * YEAR;

// a save keeps the common field
const back = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.strictEqual(Commons.fieldsOf(back.villages[v.id]).length, Commons.fieldsOf(v).length);
console.log(`commons ok: begun ${((made - start) / DAY).toFixed(0)} days in, sown ${((sown - start) / DAY).toFixed(0)}, ` +
  `${Math.round(harvest)} rations into the store at day ${((st.t - start) / DAY).toFixed(0)}; seed ${seed} from the store`);

// VB-457: the store fills to HELP.storeTarget years of need and no further; the common fields are sown only in a year it is under
{
  const { HELP, YEAR_DAYS, SEASON_DAYS, CROPS, cal } = VB['sim/rules'], { fillStores } = VB['sim/help'], { storeRoom } = VB['sim/hunger'];
  const s2 = tinyState(tinyWorld(Array(16).fill('.'.repeat(24)), { seed: 3 }), [{ at: [11, 8], farms: 3, sizes: [6, 6, 5] }], { seed: 5 });
  const u = s2.villages[0], hhs = u.farmsteads.map((id) => s2.households[s2.farmsteads[id].household]);
  const target = storeRoom(s2, u); // an empty store lacks the whole target
  assert.ok(target > 0);
  const own = (h) => h.grain.barley;
  for (const h of hhs) h.grain.barley += 4000;
  // just under the target: it takes only the difference, shared by what each would have given
  u.grain.barley = target - 10;
  fillStores(s2, u.id);
  // each quarter is carried to the green (VB-849): the store has it as the loads arrive
  for (let k = 0; k < 40 * 24 && s2.away.some((j) => j.why === 'haul'); k++) Sim.advance(s2, 1);
  assert.ok(!s2.away.some((j) => j.why === 'haul'), 'the hauls are over');
  assert.ok(Math.abs(Sim.grainOf(u) - target) < 1e-6, `takes only the difference (${Sim.grainOf(u)} of ${target})`);
  // at the target: nothing taken, the households keep their quarter
  const q1 = hhs.map(own);
  fillStores(s2, u.id);
  assert.deepStrictEqual(hhs.map(own), q1, 'a full store takes nothing');
  // the commons: a field in stubble in the sowing window, posted only in a year the store lacks of its target
  const w = CROPS.barley.sow, sowDay = (y) => ((y - 1) * YEAR_DAYS + w[0] * SEASON_DAYS + w[1]) * DAY + 1;
  u.commonFields = [{ id: 0, tile: Commons.site(s2, u), crop: 'barley', stage: 'stubble', sown: null, held: 0, soil: 1 }];
  for (const y of s2.weather) y.thaw = 0; // the probes read the window's first day, the ground thawed (sim/weather, VB-354)
  const posted = (t) => {
    const keys = [];
    Commons.work(s2, u, cal(t), (k) => keys.push(k), VB['sim/kinds'].ASK.fieldAt);
    return keys.filter((k) => k.startsWith('plow')).length;
  };
  assert.strictEqual(posted(sowDay(3)), 0, 'a full store: the field is not hoed');
  assert.strictEqual(u.commonSow.sow, false);
  u.grain.barley = 0; // the decision stands within the year
  assert.strictEqual(posted(sowDay(3) + DAY), 0, 'decided once a year');
  assert.strictEqual(posted(sowDay(4)), 1, 'the year after, under the target: it is sown');
}

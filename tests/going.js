// @suite integration
// VB-295: going to the gathering. Each household of an attending village plans who goes (its holder, its unmarried of marrying age, others
// by wish; an adult always stays), through the verbs goGathering and stayHome; the day before, those from beyond homeHours are lodged at
// the host's farms (kin and partners in the house, the rest in the barn, nobody outdoors), pack their provisions and walk there; the
// three days are occasions on the host's green, where the host's holders pour their ale; then everyone walks home.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const Gt = VB['sim/gathering'], { issue } = VB['sim/commands'], Stores = VB['sim/stores'];
const { GATHERING: G, DAY, WORK, cal } = VB['sim/rules'], { hoursBetween } = VB['sim/villagehours'], { stayOf } = VB['sim/pose'];

// four villages of two farms in a row about two hours apart on open meadow, as tests/gathering.js
const XS = [4, 30, 56, 82];
const make = () => tinyState(tinyWorld(Array(12).fill('.'.repeat(110)), { seed: 7 }), XS.map((x) => ({ at: [x, 5], farms: 2, sizes: [6, 5] })), { seed: 2 });
const issues = (st) => checkState(st).filter((x) => /gathering|away|lodger/.test(x));
const hhOf = (st, v) => st.villages[v].farmsteads.map((f) => st.households[st.farmsteads[f].household]);
const adult = (st, id) => VB['sim/records'].age(st, st.pawns[id]) >= G.adult;

// the meetings of autumn choose and settle the gathering; then each household is given grain to spare for its pack, and the host's
// holders ale to pour
const st = make(), start = Gt.whenHeld(st, 0, 1)[0], end = start + 3 * DAY;
Sim.advance(st, start - 2 * DAY - st.t);
const gs = Gt.gatherings(st);
assert.strictEqual(gs.length, 1, 'one gathering stands');
const H = gs[0].host;
assert.deepStrictEqual(gs[0].villages.slice().sort(), [0, 1, 2, 3]);
assert.ok([0, 1, 2, 3].some((v) => hoursBetween(st, v, H) > G.homeHours), 'some lodge at the host');
for (let v = 0; v < 4; v++) for (const hh of hhOf(st, v)) Stores.put(st, hh, 'grain', 60, { kind: 'harvest' }, { barley: 60 });
for (const hh of hhOf(st, H)) for (let k = 0; k < 3; k++) Stores.brew(st, hh);

{ // the verbs: an adult stays; the lodged send G.goers at most; one who goes may stay home; nothing is chosen for a far-off gathering
  const hh = hhOf(st, [0, 1, 2, 3].find((v) => v !== H && hoursBetween(st, v, H) > G.homeHours))[0], adults = hh.members.filter((m) => adult(st, m));
  assert.ok(adults.length >= 2, 'two adults in the first household');
  hh.gathering = undefined; // its head planned at the review after the meetings: the test chooses for it
  const n = Math.min(adults.length - 1, G.goers);
  for (const m of adults.slice(0, n)) assert.strictEqual(issue(st, { actor: m, verb: 'goGathering', source: 'player' }), true);
  assert.match(String(issue(st, { actor: adults[n], verb: 'goGathering', source: 'player' })), n < G.goers ? /adult of the household stays/ : /at most/);
  assert.strictEqual(issue(st, { actor: adults[0], verb: 'stayHome', source: 'player' }), true);
  assert.ok(!hh.gathering.go.includes(adults[0]));
  assert.match(String(issue(st, { actor: adults[0], verb: 'stayHome', source: 'player' })), /not going/);
  // the act bar's choice (sim/opportunities): to go, or to stay home once going
  const offer = (id) => Sim.opportunities(st, id).find((o) => o.verb === 'goGathering' || o.verb === 'stayHome');
  assert.ok(offer(adults[0]) && offer(adults[0]).verb === 'goGathering' && offer(adults[0]).why === null, 'offered to go');
  assert.strictEqual(offer(adults[1]).verb, 'stayHome', 'one going is offered to stay home');
  assert.strictEqual(offer(adults[1]).gathering.place, st.villages[H].name);
  hh.gathering = undefined; // the test clears the plan it made, for the head to plan it
}

// to the day before: the households plan at their reviews (or at the packing), and the goers are lodged and packed
Sim.advance(st, start - DAY + WORK[0] + 13 - st.t);
const goers = [], plans = [];
for (let v = 0; v < 4; v++)
  for (const hh of hhOf(st, v)) {
    const g = hh.gathering;
    assert.ok(g && g.year === 1 && g.planned && g.packed, `household ${hh.id} planned and packed`);
    assert.ok(hh.members.some((m) => st.pawns[m].alive && adult(st, m) && !g.go.includes(m)), `an adult of ${hh.id} stays`);
    assert.ok(g.go.includes(hh.holder) || !st.pawns[hh.holder].alive || st.pawns[hh.holder].health < VB['sim/rules'].HEALTH.riskBelow, `the holder of ${hh.id} goes`);
    if (hoursBetween(st, v, H) > G.homeHours) assert.ok(g.go.length <= G.goers);
    plans.push(g);
    for (const id of g.go) goers.push([id, v]);
  }
assert.ok(goers.length >= 10, `${goers.length} go`);
const beds = new Map();
for (const [id, v] of goers) {
  const s = stayOf(st, id);
  if (hoursBetween(st, v, H) <= G.homeHours) { assert.strictEqual(s, null, 'the host village and its near neighbours sleep at home'); continue; }
  assert.ok(s && s.why === 'gathering' && st.households[s.host] && st.farmsteads[st.households[s.host].farmstead].village === H, `goer ${id} lodged at the host`);
  assert.ok(s.food > 0, 'with its pack');
  const k = `${s.host}/${s.roof}`;
  beds.set(k, (beds.get(k) || 0) + 1);
}
for (const [k, n] of beds) assert.ok(n <= (k.endsWith('house') ? G.house : G.barn), `${k}: ${n}`);
const days = st.occasions.filter((o) => o.kind === 'gathering');
assert.strictEqual(days.length, 3, 'three days called');
assert.ok(days.every((o) => o.village === H && o.tile === st.villages[H].center && o.overrides));
assert.deepStrictEqual(issues(st), []);

// the first day, at noon: the goers stand on the green
Sim.advance(st, start + 12 - st.t);
const on = goers.filter(([id]) => st.agents[id].occasion === days[0].id).length;
assert.ok(on >= goers.length * 0.6, `${on} of ${goers.length} on the green`);
assert.deepStrictEqual(issues(st), []);
// its end: ale poured, the guests remember the pourer
Sim.advance(st, start + WORK[1] + 0.2 - st.t);
assert.ok(st.villages[H].gathering.ale > 0, 'the host poured');
// after the last day: told in the log, lodging booked, and two days on everyone is home
Sim.advance(st, end + WORK[0] - st.t - 1);
assert.ok(st.record.some((e) => e && e.kind === 'gatheringHeld' && e.village === H), 'told at the host');
assert.ok(!st.occasions.some((o) => o.kind === 'gathering'));
Sim.advance(st, 2 * DAY);
assert.ok(!st.away.some((s) => s.why === 'gathering'), 'every goer is home');
for (const [id] of goers) if (st.pawns[id].alive) assert.ok(!st.agents[id].away, `goer ${id} home`);
assert.deepStrictEqual(issues(st), []);
assert.strictEqual(cal(st.t).season, 3);
// a plan once packed cannot be changed
assert.match(String(issue(st, { actor: goers[0][0], verb: 'stayHome', source: 'player' })), /packed|not going/);

// An adult who stayed leaves the household (the extended tier's invariants, 27 Nov: populous seed 7, an adult moved out on the day of
// packing and the holder lodged with nobody home): before the packing, the goer who would leave nobody stays home; once the goers lodge,
// the first adult lodged turns for home, as at a death at home.
{
  const s2 = make(), far = [0, 1, 2, 3].find((v) => v !== H && hoursBetween(s2, v, H) > G.homeHours), to = hhOf(s2, H)[0];
  for (let v = 0; v < 4; v++) for (const hh of hhOf(s2, v)) Stores.put(s2, hh, 'grain', 60, { kind: 'harvest' }, { barley: 60 });
  Sim.advance(s2, start - DAY - s2.t); // the day before, before the packing: the households have planned
  const moveOut = (m) => ['service', 'care', 'home'].some((reason) => issue(s2, { actor: m, verb: 'move', target: to.id, args: { reason }, source: 'debug' }) === true);
  const leaveAll = (hh) => {
    for (const m of hh.members.slice()) if (adult(s2, m) && !hh.gathering.go.includes(m) && m !== hh.holder)
      assert.ok(moveOut(m), `pawn ${m} moves`);
  };
  const [a, b] = hhOf(s2, far);
  assert.ok(a.gathering && a.gathering.planned && !a.gathering.packed && a.gathering.go.length, 'planned, not packed');
  leaveAll(a);
  Sim.advance(s2, start - DAY + WORK[0] + 13 - s2.t);
  const lodgedOf = (hh) => hh.members.filter((m) => { const x = stayOf(s2, m); return x && x.why === 'gathering' && !x.back; });
  const adultsOf = (hh) => hh.members.filter((m) => s2.pawns[m].alive && adult(s2, m));
  assert.ok(adultsOf(a).some((m) => !lodgedOf(a).includes(m)), 'an adult stays home when the one who would have stayed left before the packing');
  assert.ok(lodgedOf(b).length, 'the other household lodged');
  for (const m of b.members.slice()) if (adult(s2, m) && !lodgedOf(b).includes(m))
    assert.ok(moveOut(m), `pawn ${m} moves`);
  assert.ok(adultsOf(b).some((m) => { const x = stayOf(s2, m); return !x || x.why !== 'gathering' || x.back; }), 'a lodged adult turns for home when the last at home left');
  assert.deepStrictEqual(issues(s2), []);
}
console.log(`going: ok (${goers.length} went, ${[...beds].map(([k, n]) => `${k} ${n}`).join(', ')})`);

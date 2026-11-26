// A journey's kinds (VB-1409; sim/journeys JOURNEYS): each of move, carry, fetch, haul and visit walked through its arrival (legEnd), the
// morning its rest ends (legDue), its pawn's death away (stillAway) and its household's change on the road (retarget, by rehoused), in
// the states a stay can be in (a carrier not yet back or back, a fetcher with a load or none, a guest with days left or none); and a
// lodger's stay under the word 'visit' taking the common course. On a tiny constructed state of two villages.
const assert = require('assert'),
  VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { setOut, visit } = VB['sim/journeys'], { lodgeWhy } = VB['sim/away'];
const { emit } = VB['sim/events'];
const { stayOf } = VB['sim/pose'];
const { issue } = VB['sim/commands'];
const Stores = VB['sim/stores'];
const { DAY, TRAVEL } = VB['sim/rules'];
const Sim = VB.sim;

const W = 60;
const world = tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 7 });
const two = () =>
  tinyState(world, [{ at: [6, 4], farms: 1, sizes: [5] }, { at: [W - 8, 4], farms: 1, sizes: [5] }], { seed: 7 });
const hourOf = (st) => st.t - Math.floor(st.t / DAY) * DAY;
const to = (st, h) => Sim.advance(st, (((h - hourOf(st)) % DAY) + DAY) % DAY || DAY);
const houseOf = (st, hh) => st.farmsteads[hh.farmstead].house;
const lyingGrain = (st) => (st.lying || []).filter((l) => l.kind === 'leftGrain').reduce((s, l) => s + l.n, 0);

// A fresh state with an adult of household 0 on a journey of `kind`, set out at 10:00 with grain in the store.
function journey(kind) {
  const st = two(),
    hh = st.households[0],
    other = st.households[1];
  to(st, 10);
  Stores.put(st, hh, 'grain', 50, 'harvest', { barley: 50 });
  const id = hh.members.find((m) => m !== hh.holder && st.pawns[m].age >= 14 && st.pawns[m].age < 60),
    a = st.agents[id],
    stop = (h) => ({ at: houseOf(st, h), from: h.id, village: null, name: 'a farm', left: 5, parts: { barley: 5 } });
  if (kind === 'move') setOut(st, a, hh, hh, true, 20);
  if (kind === 'carry') setOut(st, a, hh, other, false, 20, { to: other.id, n: 5, parts: { barley: 5 } });
  if (kind === 'fetch') setOut(st, a, hh, hh, false, 20, { to: hh.id, held: 0, parts: {}, stops: [stop(other)] });
  if (kind === 'haul')
    setOut(st, a, hh, hh, false, 1, { to: hh.id, village: 0, haul: true, held: 0, parts: {}, stops: [stop(hh)] });
  if (kind === 'visit') visit(st, a, 1);
  const j = stayOf(st, id);
  assert.ok(j && j.why === kind && st.away.length === 1, `a ${kind} is open`);
  return { st, a, j, hh, other };
}
const arrive = (st, a) => emit(st, 'legEnd', a);
const morning = (st, a) => emit(st, 'legDue', a);
const die = (st, a) => emit(st, 'stillAway', a);
const rehome = (st, a, hh) => emit(st, 'rehoused', { a, old: null, hh, carry: true }); // retarget: the pawn is on the road

// ---- arrival ----
{
  const { st, a } = journey('move');
  arrive(st, a);
  assert.strictEqual(st.away.length, 0, 'a move ends at its arrival');
  assert.ok(st.pawns[a.id].events.some((k) => st.record[k].kind === 'arrived'), 'and the mover has arrived');
}
{
  const { st, a, j, other } = journey('carry');
  arrive(st, a);
  assert.ok(j.back && j.gift === null && st.away.length === 1, 'a carrier not yet back delivers, and turns for home');
  assert.ok(Stores.grainOf(other) >= 5 - 1e-9, 'the receiver has the gift');
  arrive(st, a);
  assert.strictEqual(st.away.length, 0, 'a carrier who has delivered ends as a move does');
}
for (const kind of ['fetch', 'haul']) {
  const { st, a, j } = journey(kind);
  arrive(st, a);
  assert.ok(j.gift && j.gift.held === 5 && st.away.length === 1, `a ${kind}er at the stop takes up the load`);
  arrive(st, a);
  assert.ok(j.gift === null && j.back, `a ${kind}er with his load brings it in, and with nothing left turns for home`);
  if (st.away.length) arrive(st, a);
  assert.strictEqual(st.away.length, 0, `a ${kind} with no gift ends as a move does`);
}
{
  const { st, a, j } = journey('visit');
  arrive(st, a);
  assert.ok(j.back && j.guest && j.stay === TRAVEL.stay && st.away.length === 1, 'a visitor arrives, a guest');
  if (j.host !== undefined) {
    // a guest of a house (VB-1151): at his host's door he rests, and leaves the house as his days there end (legDue's leaveHost)
    arrive(st, a);
    assert.ok(st.away.length === 1 && j.bed !== null, 'a guest at his host\'s door rests there');
    j.bed = null; j.roof = 'none'; delete j.host;
  }
  arrive(st, a);
  assert.strictEqual(st.away.length, 0, 'a visitor back home ends as a move does');
}

// ---- the morning: a guest with days left stays, every other walks on ----
for (const kind of ['move', 'carry', 'fetch', 'haul', 'visit']) {
  const { st, a, j } = journey(kind);
  if (kind === 'visit') {
    arrive(st, a);
    for (let d = TRAVEL.stay; d > 0; d--) {
      morning(st, a);
      assert.ok(j.stay === d - 1 && j.guest && a.journey === 'rest', 'a guest with days to stay stays one more');
    }
  }
  morning(st, a);
  assert.ok(j.guest === undefined && a.journey === 'walk', `a ${kind}'s next leg sets out`);
}
{
  const { st, a, j } = journey('visit');
  morning(st, a);
  assert.ok(a.journey === 'walk' && j.stay === TRAVEL.stay, 'a visitor not yet there walks on, his days as a guest untouched');
}

// ---- a death away: a bearer's grain lies where he fell, what lies at the stops goes back ----
for (const kind of ['move', 'visit']) {
  const { st, a } = journey(kind),
    pack = stayOf(st, a.id).food / st.ECON.uncooked;
  die(st, a);
  assert.ok(st.away.length === 0 && Math.abs(lyingGrain(st) - pack) < 1e-9, `a ${kind}'s pawn lays down only his pack`);
}
{
  const { st, a, j } = journey('carry'),
    pack = j.food / st.ECON.uncooked;
  die(st, a);
  assert.ok(Math.abs(lyingGrain(st) - pack - 5) < 1e-9, 'a carrier not yet back lays down the gift and his pack');
}
{
  const { st, a, j } = journey('carry');
  arrive(st, a);
  const pack = j.food / st.ECON.uncooked;
  die(st, a);
  assert.ok(Math.abs(lyingGrain(st) - pack) < 1e-9, 'a carrier who has delivered lays down only his pack');
}
for (const kind of ['fetch', 'haul']) {
  for (const held of [false, true]) {
    const { st, a, j, hh, other } = journey(kind),
      giver = kind === 'fetch' ? other : hh;
    if (held) arrive(st, a);
    const pack = j.food / st.ECON.uncooked,
      grain0 = Stores.grainOf(giver);
    die(st, a);
    assert.ok(Math.abs(lyingGrain(st) - pack - (held ? 5 : 0)) < 1e-9, `a ${kind}er ${held ? 'with' : 'without'} a load lays it down`);
    assert.ok(Math.abs(Stores.grainOf(giver) - grain0 - (held ? 0 : 5)) < 1e-9, `what lies at a ${kind}'s stops goes back`);
    assert.strictEqual(st.away.length, 0, `a ${kind}'s stay ends where he fell`);
  }
}

// ---- a change of home on the road ----
{
  const { st, a, j, other } = journey('move');
  rehome(st, a, other);
  assert.strictEqual(j.to, houseOf(st, other), 'a mover walks to the new home');
}
{
  const { st, a, j, hh, other } = journey('carry');
  rehome(st, a, hh);
  assert.ok(j.to === houseOf(st, other) && !j.back, 'a carrier not yet back delivers first');
  arrive(st, a);
  rehome(st, a, other);
  assert.ok(j.to === houseOf(st, other) && j.back, 'a carrier who has delivered walks to the new home');
}
for (const kind of ['fetch', 'haul']) {
  const out = journey(kind);
  rehome(out.st, out.a, out.other);
  assert.ok(out.j.gift === null && out.j.back && out.j.to === houseOf(out.st, out.other), `a ${kind}er on his way out turns`);
  const { st, a, j, other } = journey(kind);
  arrive(st, a);
  const was = j.to;
  rehome(st, a, other);
  assert.ok(j.gift && j.gift.held === 5 && j.to === was, `a ${kind}er with a load brings it in first`);
}
{
  const { st, a, j, other } = journey('visit');
  arrive(st, a);
  rehome(st, a, other);
  assert.ok(j.back && j.stay === 0 && j.guest === undefined && j.to === houseOf(st, other), 'a visit is over at a change of home');
}

// ---- a lodger's stay under the word 'visit' is no journey: its death takes the common course ----
{
  const st = two(),
    hh = st.households[0];
  to(st, 10);
  Stores.put(st, hh, 'grain', 50, 'harvest', { barley: 50 });
  const id = hh.members.find((m) => m !== hh.holder && st.pawns[m].age >= 14 && st.pawns[m].age < 60),
    args = { why: 'visit', days: 2, jobs: [] },
    at = houseOf(st, hh) + 3;
  assert.strictEqual(lodgeWhy(st, id, at, args), null, 'the lodger may go');
  assert.strictEqual(issue(st, { actor: id, verb: 'lodge', target: at, args, source: 'pawn' }), true, 'it lodges');
  const s = stayOf(st, id),
    pack = s.food / st.ECON.uncooked;
  assert.ok(s.why === 'visit' && s.jobs && s.village === undefined, "a lodger's stay with the caller's word 'visit'");
  die(st, st.agents[id]);
  assert.ok(st.away.length === 0 && Math.abs(lyingGrain(st) - pack) < 1e-9, 'a lodger who dies lays down only its pack');
}
console.log('journey kinds: arrival, morning, death and change of home of move, carry, fetch, haul and visit, and a lodger');

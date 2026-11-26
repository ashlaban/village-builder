// The good is made where the work is done (VB-1748; design.md section 7, Plans at four scales): a kind that made its good on delivery
// makes it as its work leg ends, and its load in hand is the good: a carrier cut on the road leaves it lying as a pile of its owner's
// (sim/lying), fetched home by its fetch kind. A trip's yield accrues with the work: a gathering trip cut at half its hours leaves half its
// yield where it was cut, and its task begins again from none. On a small constructed state.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const Lying = VB['sim/lying'], Doing = VB['sim/doing'], Forage = VB['sim/forage'], Pot = VB['sim/pot'], { B } = VB['world/biomes'], { larderOf } = VB['sim/larder'];
const { checkState } = require('./lib/invariants.js');
const it = G.generate(7, { cols: 120, rows: 85 });
let r;
while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'populous');
while (Math.floor(st.t + 1e-9) % 24 !== 9) Sim.advance(st, 0.1); // within the working day
const hh = st.households.find((h) => !h.dissolved && h.members.length >= 2),
  f = st.farmsteads[hh.farmstead],
  owner = { type: 'household', id: hh.id };
const hand = () => st.agents[hh.members.find((id) => st.pawns[id].alive && st.pawns[id].age >= 14)];
const wood = (() => {
  for (let t = 0; t < st.w.N; t++) if (st.w.biome[t] === B.FOREST && !st.w.dev[t] && Forage.stock(st, t) > 0.999) return t;
  return -1;
})();
assert(wood >= 0, 'a wood to gather in');
const pileOf = (kind) => (st.lying || []).find((l) => l.kind === kind && l.owner.id === hh.id);
let n_ = 0;
// pawn a set to work task j of kind `kind` at `site`, `done` of its hours behind it, its rate stopped (the test reckons no hours)
function atWork(a, kind, site, extra, done) {
  A.release(st, a);
  A.placeAtHome(st, a);
  const j = J.post(st, `${kind}:made${n_++}`, kind, owner, site, extra);
  j.claims.push(a.id);
  Object.assign(a, { job: j, leg: { kind: 'work', t: 0, x: a.x, y: a.y, seg: 0 }, inside: false });
  j.done = done;
  j.at = undefined;
  j.rate = 0;
  return j;
}
// 1. a gathering trip cut at half its hours: half its yield lies where it was cut, the ground half as picked, the task from none again
{
  const a = hand(),
    j = atWork(a, 'gather', wood, { farm: f }, KINDS.gather.hours / 2);
  A.release(st, a);
  const l = pileOf('gather');
  assert(l, 'the hours gathered left nothing');
  assert(Math.abs(l.n - 0.5 * Forage.FORAGE.trip) < 1e-6, `half a trip's yield lies (${l.n})`);
  assert(Math.abs(Forage.stock(st, wood) - (1 - 0.5 * Forage.FORAGE.take)) < 1e-6, 'the ground is picked by the hours worked');
  assert.strictEqual(j.done, 0, 'the hours yielded stay on the task');
  assert(a.job === null && a.load === 0, 'the hand is let go, its basket set down');
  // found by the stray method of a gathering goal elsewhere (sim/methods; VB-1749: no fetch kind is posted for a kind with methods), and
  // brought home whole: the yield is the household's fresh food
  const posted = [];
  Lying.bringWork(st, hh, f, null, (key, site, extra, kind) => posted.push(kind));
  assert(!posted.length, 'no goal of its own is posted for a gathering pile (VB-1814: none of a kind with methods)');
  const other = (() => {
    for (let t = 0; t < st.w.N; t++) if (t !== wood && st.w.biome[t] === B.FOREST && !st.w.dev[t]) return t;
    return -1;
  })();
  const b = hand(),
    gj = atWork(b, 'gather', other, { farm: f }, 0);
  
  const s = Doing.ask(st, b);
  assert(s && !s.blocked && Doing.placeOf(st, b, s) === l.tile, 'the pile is fetched where it lies, by the stray method');
  const fresh0 = Pot.freshHeld(st, hh, 'gathered'),
    taken = Lying.takeAt(st, l.tile, 'gather', owner, Infinity);
  KINDS.gather.deliver(st, { ...gj, ...l.of, kind: 'gather' }, hh, f, { id: b.id, load: taken });
  assert(Math.abs(Pot.freshHeld(st, hh, 'gathered') - fresh0 - 0.5 * Forage.FORAGE.trip) < 1e-6, 'the half trip comes home');
  A.release(st, b);
  assert(!pileOf('gather'), 'nothing is left lying');
}
// 1b. cut at half its hours by the working day's end (sim/clock): the half yield goes home in hand, the pawn keeping its task until it is in
{
  const a = hand(),
    s0 = Forage.stock(st, wood),
    j = atWork(a, 'gather', wood, { farm: f }, KINDS.gather.hours / 2);
  A.release(st, a, true);
  assert(a.job === j && a.load > 0, 'the hand goes home with what it gathered');
  assert(Math.abs(a.load - 0.5 * Forage.FORAGE.trip * s0) < 1e-6, `half a trip's yield in hand (${a.load})`);
  assert(!pileOf('gather'), 'nothing is set down');
  A.release(st, a); // a death on the road: it lies
  assert(pileOf('gather') && a.job === null, 'a carrier cut on the road leaves it lying');
  Lying.frost(st);
}
// 2. a whole trip: its yield is made as the work ends, the load in hand, and only put into the store at home
{
  const a = hand(),
    s0 = Forage.stock(st, wood);
  const j = atWork(a, 'gather', wood, { farm: f }, KINDS.gather.hours);
  const fresh0 = Pot.freshHeld(st, hh, 'gathered');
  KINDS.gather.make(st, a, j, 1, hh); // as the work leg ends (sim/agents ended)
  Object.assign(a, { carry: KINDS.gather.carry });
  assert(Math.abs(a.load - Forage.FORAGE.trip * s0) < 1e-6, `the yield is in hand (${a.load})`);
  assert(Forage.stock(st, wood) < s0, 'the ground is picked where the work is done');
  assert.strictEqual(Pot.freshHeld(st, hh, 'gathered'), fresh0, 'nothing is home yet');
  // the carrier dies on the road: the basket lies where it stood
  const n = a.load;
  A.release(st, a);
  const l = pileOf('gather');
  assert(l && Math.abs(l.n - n) < 1e-9, 'a dead carrier\'s yield exists, lying');
}
// 3. a hunt: the game is rolled at the work; a kill in hand is meat and a hide at home
{
  const a = hand(),
    j = atWork(a, 'hunt', wood, { farm: f }, KINDS.hunt.hours);
  st.rng.deer.fix = 0; // the kill, whatever the region's deer
  KINDS.hunt.make(st, a, j, 1);
  delete st.rng.deer.fix;
  const meat = a.load;
  if (meat > 0) {
    const m0 = larderOf(hh, 'meat');
    KINDS.hunt.deliver(st, j, hh, f, a);
    assert(Math.abs(larderOf(hh, 'meat') - m0 - meat) < 1e-6, 'the kill comes home as meat');
  }
  A.release(st, a);
}
// 3b. a hunt cut at half its hours by the working day's end with no kill (VB-1749 review, F1): nothing is carried home, the task stays
// posted, and the next hand to take it hunts: the trip is not met by the hours spent
{
  const a = hand(),
    j = atWork(a, 'hunt', wood, { farm: f }, KINDS.hunt.hours / 2);
  st.rng.deer.fix = 0.999999; // no kill
  A.release(st, a, true);
  delete st.rng.deer.fix;
  assert(a.job !== j && !(a.load > 0), 'a hunt with no kill carries nothing home');
  assert(st.jobs.get(j.key) === j, 'the hunt stays posted');
  const b = hand();
  A.release(st, b);
  A.placeAtHome(st, b);
  j.claims.push(b.id);
  Object.assign(b, { job: j, inside: false });
  const s = Doing.ask(st, b);
  assert(s !== VB['sim/methods'].DONE && !s.blocked && (s.prim === 'go' || s.prim === 'work'), `the next hand hunts (${s.prim || s})`);
  A.release(st, b);
}
// 4. every kind that makes its good at the work has a way out for its load lying: its methods' stray method (VB-1749), a fetch kind, or
// another's (timber's)
for (const [k, K] of Object.entries(KINDS))
  if (K.make && K.carry) assert(K.methods || KINDS[Lying.fetchKey(K.lies || k)], `${k}: its load lying is fetched by nothing`);
assert.deepStrictEqual(checkState(st), [], 'invariants');
Lying.frost(st);
assert(!pileOf('gather'), 'a pile not fetched rots at the frost');
console.log('madeatwork ok: a cut gathering trip leaves half its yield lying, fetched home; a whole trip made at the work; a hunt\'s kill in hand');

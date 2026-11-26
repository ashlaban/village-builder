// The good is made where the work is done (VB-1748; design.md section 7, Plans at four scales): a kind that made its good on delivery
// makes it as its work leg ends, and its load in hand is the good: a carrier cut on the road leaves it lying as a pile of its owner's
// (sim/lying), fetched home by its fetch kind. A trip's yield accrues with the work: a gathering trip cut at half its hours leaves half its
// yield where it was cut, and its task begins again from none. On a small constructed state.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, A = VB['sim/agents'], J = VB['sim/jobs'], { KINDS } = VB['sim/kinds'];
const Lying = VB['sim/lying'], Forage = VB['sim/forage'], Pot = VB['sim/pot'], { B } = VB['world/biomes'], { larderOf } = VB['sim/larder'];
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
  Object.assign(a, { job: j, phase: 'work', inside: false });
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
  // fetched home by its fetch kind: the yield is the household's fresh food
  const posted = [];
  Lying.fetchWork(st, hh, f, null, (key, site, extra, kind) => posted.push({ site, extra, kind }), (k) => !!KINDS[Lying.fetchKey(k)]);
  const p = posted.find((x) => x.kind === 'fetchGather');
  assert(p && p.site === l.tile, 'the pile is fetched where it lies');
  const fresh0 = Pot.freshHeld(st, hh, 'gathered'),
    b = { id: a.id, load: 0 };
  const fj = { ...p.extra, kind: 'fetchGather', site: p.site, owner };
  KINDS.fetchGather.load(st, b, fj, 30);
  KINDS.fetchGather.deliver(st, fj, hh, f, b);
  assert(Math.abs(Pot.freshHeld(st, hh, 'gathered') - fresh0 - 0.5 * Forage.FORAGE.trip) < 1e-6, 'the half trip comes home');
  assert(!pileOf('gather'), 'nothing is left lying');
}
// 1b. cut at half its hours by the working day's end (sim/clock): the half yield goes home in hand, the pawn keeping its task until it is in
{
  const a = hand(),
    s0 = Forage.stock(st, wood),
    j = atWork(a, 'gather', wood, { farm: f }, KINDS.gather.hours / 2);
  A.release(st, a, true);
  assert(a.job === j && a.phase === 'back', 'the hand goes home with what it gathered');
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
  Object.assign(a, { phase: 'back', carry: KINDS.gather.carry });
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
// 4. every kind that makes its good at the work has a way out for its load lying: a fetch kind, or another's (timber's)
for (const [k, K] of Object.entries(KINDS))
  if (K.make && K.carry) assert(KINDS[Lying.fetchKey(K.lies || k)], `${k}: its load lying is fetched by nothing`);
assert.deepStrictEqual(checkState(st), [], 'invariants');
Lying.frost(st);
assert(!pileOf('gather'), 'a pile not fetched rots at the frost');
console.log('madeatwork ok: a cut gathering trip leaves half its yield lying, fetched home; a whole trip made at the work; a hunt\'s kill in hand');

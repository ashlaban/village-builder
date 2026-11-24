// VB-1636: the timber house, the rung above the cottage (sim/timberhouse), and the room of each rung (sim/house ROOM). A household over
// its rung's room is crowded, and its tenants (servants and members outside the head's own line) carry the mood modifier `crowded`, its
// family not; a timber house's hearth burns ROOM.timberFire of a cottage's; the played head builds it as a task of its plan (the chain
// upgrade, what 'timber'), the timber at home first, a save and a load mid-chain going on the same; Sim.farmView offers it on a cottage;
// a crowded head left to its rule builds one by itself in the slack of the year; an older save reads as the rung derived. On a tiny
// village of three farms.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { projectsOf } = VB['sim/projects'],
  { RUNGS, rungOf } = VB['sim/ladder'],
  { chainSteps } = VB['sim/planchains'],
  { BUILD, DAY, BOOTH } = VB['sim/rules'],
  { ROOM, roomOf, crowded } = VB['sim/house'],
  Mood = VB['sim/mood'],
  R = VB['sim/records'],
  Stores = VB['sim/stores'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const world = () => tinyWorld(rows, { stones: 200 });
const fresh = () => {
  const st = tinyState(world(), [{ at: [8, 7], farms: 3 }], { seed: 4, herds: true });
  st.naturalDeaths = false;
  return st;
};
const mods = (st, id) => Mood.of(st, id).mods.map((m) => m.key);
// Household `to` takes the members of the other households until it holds n (a test's write: moving people in, as service would).
function crowd(st, to, n) {
  for (const hh of st.households)
    for (const m of [...hh.members]) {
      if (hh === to || to.members.length >= n || m === hh.holder) continue;
      R.leaveHousehold(st, m);
      R.joinHousehold(st, to, m, false);
    }
  VB['sim/heirs'].refreshRoles(st);
}

// ---- 1. the rungs' room; a crowded house weighs on its tenants, not on the head's family ----
{
  assert.deepStrictEqual(RUNGS.timber.needs, { timber: BUILD.timberHouse.timber, stone: 0, hours: 150 });
  assert.strictEqual(RUNGS.timber.from, 'cottage');
  assert.deepStrictEqual(
    Object.keys(RUNGS).map((k) => RUNGS[k].gives.sleeps),
    [0, BOOTH.sleeps, ROOM.cottage, ROOM.timber],
  );
  assert(ROOM.timber > ROOM.cottage && RUNGS.timber.gives.fire === ROOM.timberFire);
  const st = fresh(),
    hh = st.households[2], // a couple and two grown children
    f = st.farmsteads[hh.farmstead];
  assert.strictEqual(roomOf(f), ROOM.cottage);
  assert(!crowded(st, hh), 'a founders household fits its cottage');
  const family = [...hh.members];
  crowd(st, hh, ROOM.cottage + 1);
  assert(crowded(st, hh), `crowded: ${hh.members.length} in a cottage of ${ROOM.cottage}`);
  const tenants = hh.members.filter((m) => !family.includes(m));
  assert(tenants.length > 0);
  for (const m of tenants) assert(mods(st, m).includes('crowded'), `tenant ${m} feels the crowding`);
  for (const m of family) assert(!mods(st, m).includes('crowded'), `the head's family (${m}) does not`);
  const child = family.find((m) => st.pawns[m].father === hh.holder || st.pawns[m].mother === hh.holder);
  R.setServant(st, child, true);
  assert(mods(st, child).includes('crowded'), 'a servant is a tenant, kin or not');
  R.setServant(st, child, false);
  const mood = Mood.level(st, tenants[0]);
  f.rung = 'timber'; // a test's write: the house built up
  assert.strictEqual(rungOf(st, f), 'timber');
  assert(!crowded(st, hh), 'a timber house holds them');
  assert.strictEqual(Mood.level(st, tenants[0]), mood + 10, 'the modifier gone with the room');
  sound(st, 'crowded');
  // the hearth: a timber house burns ROOM.timberFire of a cottage's
  const g = st.households[1];
  Stores.put(st, hh, 'wood', 10, 'felling');
  Stores.put(st, g, 'wood', 10, 'felling');
  const a = Stores.heldOf(hh, 'wood'),
    b = Stores.heldOf(g, 'wood');
  VB['sim/hunger'].feedHousehold(st, hh, 3, 'house');
  VB['sim/hunger'].feedHousehold(st, g, 3, 'house');
  const burnt = (a - Stores.heldOf(hh, 'wood')) / (b - Stores.heldOf(g, 'wood'));
  assert(Math.abs(burnt - ROOM.timberFire) < 1e-9, `the timber house's fire: ${burnt}`);
  // an older save: no f.rung, the rung derived
  delete f.rung;
  assert.strictEqual(rungOf(st, f), 'cottage');
}
// ---- 2. by the plan: the view, the timber at home first, a save and a load mid-chain ----
{
  const st = fresh();
  Sim.advance(st, 3);
  Sim.inhabit(st, 0);
  Sim.setAuto(st, false);
  assert.strictEqual(Sim.plan(st, 'sleep', { from: 21, until: 6 }), true);
  const hh = st.households[st.pawns[0].household],
    f = st.farmsteads[hh.farmstead];
  for (const p of projectsOf(st, 'household', hh.id))
    VB['sim/commands'].issue(st, { actor: 0, verb: 'dropProject', target: hh.id, args: { id: p.id }, source: 'player' });
  const v = Sim.farmView(st, f.id);
  assert.strictEqual(v.rung, 'cottage');
  assert.deepStrictEqual(v.next, [{ what: 'timber', needs: RUNGS.timber.needs, ok: true, why: null, planned: false }]);
  console.log(`  view: ${JSON.stringify(v.next)}`);
  Stores.put(st, hh, 'timber', 6, 'felling');
  assert.strictEqual(Sim.plan(st, 'add', { upgrade: f.house, what: 'timber' }), true);
  assert.match(String(Sim.plan(st, 'add', { upgrade: f.house, what: 'timber' })), /already planned/);
  assert.strictEqual(Sim.farmView(st, f.id).next[0].planned, true);
  const before = chainSteps(st, hh.id, 'upgrade', f.house).steps;
  assert.deepStrictEqual(before.map((y) => y.kind), ['timber', 'timberframe', 'timberroof']);
  assert.strictEqual(before[0].n, Math.ceil((BUILD.timberHouse.timber - 6) / st.ECON.woodPerTrip - 1e-9), 'trips for what home does not cover');
  for (let i = 0; i < 240 && !projectsOf(st, 'household', hh.id).some((p) => p.what === 'timberhouse'); i++) Sim.advance(st, 0.1);
  const p = projectsOf(st, 'household', hh.id).find((q) => q.what === 'timberhouse');
  assert(p, 'begun by the task');
  Sim.advance(st, 1); // the head's hour: the timber at home goes into the frame
  assert(p.steps[0].wood >= 6, `the frame took the timber at home: ${p.steps[0].wood}`);
  assert.strictEqual(Sim.farmView(st, f.id).building.what, 'timber');
  assert.strictEqual(rungOf(st, f), 'cottage', 'the household lives in its cottage meanwhile');
  Sim.advance(st, 2 * DAY);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(world(), saved),
    again = Sim.load(world(), saved);
  const run = (s) => {
    for (let i = 0; i < 120 * 240 && s.player.plan.tasks.some((t) => t.kind === 'upgrade'); i++) Sim.advance(s, 0.1);
  };
  run(back);
  run(again);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  run(st);
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(st.player.plan.last.which, 'roof', JSON.stringify(st.player.plan.last));
  assert.strictEqual(f.rung, 'timber');
  const w = Sim.farmView(st, f.id);
  assert.strictEqual(w.rung, 'timber');
  assert.deepStrictEqual(w.next, [], 'nothing above the timber house yet');
  assert.match(String(Sim.plan(st, 'add', { upgrade: f.house, what: 'timber' })), /built from a cottage/);
  sound(back, 'loaded mid-chain');
  console.log(`  by the plan: the roof on at day ${(st.t / DAY).toFixed(1)}`);
}
// ---- 3. a crowded head left to its rule builds one by itself, in the slack; one not crowded does not ----
{
  const st = fresh();
  const hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  crowd(st, hh, ROOM.cottage + 1);
  let begun = null;
  for (let i = 0; i < 400 * 24 && f.rung !== 'timber'; i++) {
    Sim.advance(st, 1);
    if (begun === null && projectsOf(st, 'household', hh.id).some((p) => p.what === 'timberhouse')) {
      begun = st.t;
      const c = Sim.cal(st.t);
      assert((c.season === 1 && c.sday < 6) || c.season === 3, `begun in the slack: ${JSON.stringify(c)}`);
    }
  }
  assert(begun !== null, 'the crowded head began a timber house by itself');
  assert.strictEqual(f.rung, 'timber', `built (begun on day ${(begun / DAY).toFixed(1)})`);
  for (const g of st.households)
    if (g !== hh && !g.dissolved && !crowded(st, g))
      assert(st.farmsteads[g.farmstead].rung !== 'timber', 'none where the house is not crowded');
  sound(st, 'own rule');
  console.log(`  own rule: begun on day ${(begun / DAY).toFixed(1)}, the roof on by day ${(st.t / DAY).toFixed(1)}`);
}
console.log('timberhouse: the rungs\' room, a crowded house weighs on its tenants alone, the smaller fire, an older save; by the plan, the '
  + 'timber at home first, a save mid-chain the same; by a crowded head\'s own rule, in the slack');

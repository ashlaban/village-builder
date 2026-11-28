// @suite integration founders,solo
// @suite integration populous
// VB-1659: the main building's rungs and the outbuildings as data (sim/ladder), read from the rules that build them; rungOf, derived from
// the state, right for every farm of founders, solo (with and without `hand`) and populous at seeding and a year on; Sim.farmView, plain
// data that writes nothing, through the hand-planned settler's landing: a camp, its shelter being raised on the house tile, the shelter, the
// cottage next (VB-1666).
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { island, SMALL } = require('./lib/probe.js'),
  { tinyWorld } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js');
const { RUNGS, FOUNDATION, OUTBUILDINGS, rungOf } = VB['sim/ladder'],
  { BOOTH, BUILD } = VB['sim/rules'],
  { HOUSE } = VB['sim/house'],
  { hexSteps } = VB['sim/hex'],
  B = VB['sim/building'];
const hash = (st) => sha(canon(kept(st)));
const v0 = (st, f) => Sim.farmView(st, f.id, st.player && st.player.pawn);

// ---- 1. the tables: each rung built from one before it, the numbers the rules' own ----
assert.deepStrictEqual(
  Object.keys(RUNGS).map((k) => RUNGS[k].from),
  [null, 'camp', 'shelter', 'cottage'],
);
assert.deepStrictEqual(RUNGS.shelter.needs, { timber: BOOTH.wood, stone: 0, hours: BOOTH.hours });
assert.deepStrictEqual(RUNGS.cottage.needs, { timber: BUILD.timber, stone: 0, hours: 120 });
assert.deepStrictEqual(FOUNDATION.needs, { timber: 0, stone: BUILD.foundationStone, hours: BUILD.foundationHours });
assert.strictEqual(FOUNDATION.gives.wear, HOUSE.wearStone);
assert(!RUNGS.stone, 'the foundation is no rung (VB-1663)');
assert.strictEqual(RUNGS.cottage.gives.standing, HOUSE.term);
assert.deepStrictEqual(OUTBUILDINGS.barn.needs, { timber: BUILD.barn.timber, stone: 0, hours: 120 });

// ---- 2. rungOf, for every farm, against the state read directly ----
// A farm with no cottage: a camp while its shelter (VB-1666) does not stand, or (a farm with none: a save before VB-1666) while no booth
// of its household stands beside its house and it has a camp or one staked there; a shelter else; a cottage on the ground or on stone.
function expected(st, f) {
  if (f.camp === true) return 'camp';
  if (f.booth && f.shelter) return f.shelter.built !== null && B.boothCondition(st, f.shelter) > 0 ? 'shelter' : 'camp';
  if (f.booth) {
    const near = (t) => hexSteps(st.w, t, f.house) <= 1;
    if (st.booths.some((b) => b.by === f.household && near(b.tile))) return 'shelter';
    let staked = false;
    B.stakedEach(st, (p) => (staked = staked || (st.pawns[p.holder.id].household === f.household && near(p.tile))));
    return staked ? 'camp' : 'shelter';
  }
  return f.rung || 'cottage'; // the timber house stored (VB-1664)
}
function sweep(st, tag, seen) {
  const before = hash(st);
  for (const f of st.farmsteads) {
    const r = rungOf(st, f);
    assert.strictEqual(r, expected(st, f), `${tag}: farm ${f.id}`);
    seen.add(r);
    if (r === 'cottage') seen.add(v0(st, f).foundation.grade === 'stone' ? 'on stone' : 'ground');
    assert.strictEqual(v0(st, f).foundation.grade, f.grade || 'ground', `${tag}: farm ${f.id}'s foundation`);
    const v = Sim.farmView(st, f.id, st.player && st.player.pawn);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(v)), v, `${tag}: farm ${f.id}'s view is plain data`);
    assert.strictEqual(v.rung, r);
    assert(v.next.every((n) => RUNGS[n.what].from === r && n.ok === (n.why === null)), `${tag}: farm ${f.id}'s next`);
    assert(v.outbuildings.every((o) => o.ok === (o.why === null) && o.built === !!f[o.what]), `${tag}: outbuildings`);
  }
  assert.strictEqual(hash(st), before, `${tag}: the views wrote nothing`);
}
// The scenarios swept are the arguments' (each a year on the small island, two seconds for founders or populous): two lines of
// its head's @suite lines, to keep each script under its five seconds; all of them without one.
const seen = new Set(),
  only = process.argv[2] ? process.argv[2].split(',') : null;
for (const [name, opts] of [
  ['founders', {}],
  ['solo', {}],
  ['solo', { hand: true }],
  ['populous', {}],
].filter(([n]) => !only || only.includes(n))) {
  const st = Sim.seed(island(7, SMALL), 7, name, null, opts),
    tag = `${name}${opts.hand ? ' by hand' : ''}`;
  st.naturalDeaths = false;
  sweep(st, `${tag}, at seeding`, seen);
  Sim.advance(st, Sim.YEAR);
  sweep(st, `${tag}, a year on`, seen);
}
if (!only || only.includes('solo')) assert(seen.has('camp') && seen.has('shelter'), `rungs seen: ${[...seen]}`);
if (!only || only.includes('populous')) assert(seen.has('cottage') && seen.has('ground') && seen.has('on stone'), `rungs seen: ${[...seen]}`);

if (only && !only.includes('solo')) process.exit(0);
// ---- 3. the hand-planned landing: a camp, its booth raised, then the cottage is next ----
{
  const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true }),
    f = st.farmsteads[0];
  st.naturalDeaths = false;
  let v = Sim.farmView(st, 0, st.player && st.player.pawn);
  assert.strictEqual(v.rung, 'camp');
  assert.strictEqual(v.building, null);
  assert.deepStrictEqual(v.next, [{ what: 'shelter', needs: RUNGS.shelter.needs, ok: true, why: null, planned: false }]);
  assert.deepStrictEqual(v.outbuildings, [
    { what: 'storehouse', built: false, needs: OUTBUILDINGS.storehouse.needs, ok: false, why: `${f.name} has no cottage yet`, planned: false, building: null },
    { what: 'barn', built: false, needs: OUTBUILDINGS.barn.needs, ok: false, why: `${f.name} has no cottage yet`, planned: false, building: null },
    { what: 'byre', built: false, needs: OUTBUILDINGS.byre.needs, ok: false, why: `${f.name} has no cottage yet`, planned: false, building: null },
  ]);
  assert.strictEqual(v.foundation.why, `${f.name} has no cottage yet`, 'no foundation under a shelter');
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: f.house }), true);
  assert.match(Sim.farmView(st, 0, st.player && st.player.pawn).next[0].why, /planned already/, 'the shelter planned');
  assert.strictEqual(Sim.farmView(st, 0, st.player && st.player.pawn).next[0].planned, true);
  let raising = null;
  for (let i = 0; i < 20 * 240 && f.camp !== false; i++) {
    Sim.advance(st, 0.1);
    const b = Sim.farmView(st, 0, st.player && st.player.pawn).building;
    if (b) {
      assert.strictEqual(b.what, 'shelter');
      assert(b.hoursLeft <= BOOTH.hours && b.hoursLeft >= 0);
      if (b.step === 'shelter' && b.hoursLeft < BOOTH.hours) raising = b.hoursLeft;
    }
  }
  assert(raising !== null, 'the shelter seen being raised');
  v = Sim.farmView(st, 0, st.player && st.player.pawn);
  assert.strictEqual(v.rung, 'shelter');
  assert.strictEqual(v.building, null);
  assert.deepStrictEqual(v.next, [{ what: 'cottage', needs: RUNGS.cottage.needs, ok: true, why: null, planned: false }]);
}
console.log('ladder: ok');

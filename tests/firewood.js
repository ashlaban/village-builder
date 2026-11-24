// Wood in two steps (VB-1625): timber felled in the woods and carried home (the kind wood), cut into firewood at the house (the kind
// firewood), for every household; the player's plan tasks `fell` (a forest tile of its choosing, n trips) and `firewood` (at the house),
// their refusals, the page's read of the fire (Sim.fireView), and a save and a load going on the same. On the tiny village of tests/plan.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { DAY, YEAR_DAYS } = VB['sim/rules'], { KINDS } = VB['sim/kinds'];
const { WOOD_HOURS } = VB['sim/chores'], Stores = VB['sim/stores'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { canon, sha, kept } = require('./lib/canon.js'), { checkState } = require('./lib/invariants.js');
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const make = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 3 }], { seed: 4 });
  st.naturalDeaths = false;
  Sim.advance(st, 3);
  return st;
};
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const FARMER = 0;
const yearSum = (hh, why) => (hh.ledger || []).filter((e) => e.kind === why).reduce((s, e) => s + e.n, 0);

// 0. The two steps cost the hours a load cost before the split: 3.
assert.strictEqual(WOOD_HOURS.fell + WOOD_HOURS.cut, 3);
assert.strictEqual(KINDS.wood.hours + KINDS.firewood.hours, 3);
assert.deepStrictEqual([KINDS.wood.gives, KINDS.firewood.needs, KINDS.firewood.gives], [['timber'], ['timber'], ['firewood']]);

// 1. No pawn played: every household fells timber and cuts it at home, and keeps its pile through a year with no cold day.
{
  const st = make();
  let cold = 0, felled = 0, cut = 0;
  const seen = new Set();
  for (let d = 0; d < YEAR_DAYS; d++) {
    Sim.advance(st, DAY);
    for (const hh of st.households) if (!hh.dissolved && hh.cold > 0) cold++;
    for (const j of st.jobs.values()) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      if (j.kind === 'wood') felled++;
      if (j.kind === 'firewood') cut++;
    }
  }
  assert(felled > 0 && cut > 0, `trips to fell (${felled}) and cuttings at home (${cut}) posted`);
  assert.strictEqual(cold, 0, 'no household-day cold in the year');
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    assert(hh.wood > 0, `household ${hh.id} has wood at the year's end`);
    assert(hh.timber === undefined || hh.timber >= 0);
  }
  sound(st, 'a year of two steps');
}

// 2. Played by hand: the refusals, then a fell task on a chosen tile and a firewood task at the house carried out by the plan.
{
  const st = make();
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, false);
  const hid = st.pawns[FARMER].household, hh = st.households[hid], f = st.farmsteads[hh.farmstead], v = st.villages[f.village];
  // a forest tile not the job's: of the village's wood, not its first tile
  const tile = v.wood.find((t) => t !== v.wood[0] && st.w.trees[t] >= 3);
  assert(tile !== undefined, 'a wooded tile to choose');
  // refusals
  assert.match(String(Sim.plan(st, 'add', { fell: f.fields[0] ? f.fields[0].tile : f.house })), /no trees stand at/);
  assert.match(String(Sim.plan(st, 'add', { fell: tile, n: 0 })), /cannot plan 0 trips/);
  assert.match(String(Sim.plan(st, 'add', { fell: tile, n: 2.5 })), /cannot plan 2.5 trips/);
  assert.match(String(Sim.plan(st, 'add', { firewood: tile })), /house is not at/);
  Stores.take(st, hh, 'wood', hh.wood, 'burn');
  assert.match(String(Sim.plan(st, 'add', { firewood: f.house })), /no timber is home to cut/);
  // the read with an empty pile and no timber: short, fell then cut
  let fire = Sim.fireView(st);
  assert.deepStrictEqual([fire.wood, fire.timber, fire.nights, fire.short, fire.mend], [0, 0, 0, true, ['fell', 'firewood']]);
  assert.deepStrictEqual(fire.planned, { fell: false, firewood: false });
  // planned: two trips at the tile, then the cutting (accepted, the felling planned brings the timber)
  assert.strictEqual(Sim.plan(st, 'add', { fell: tile, n: 2 }), true);
  assert.match(String(Sim.plan(st, 'add', { fell: tile })), /already planned/);
  assert.strictEqual(Sim.plan(st, 'add', { firewood: f.house }), true);
  assert.deepStrictEqual(st.player.plan.tasks, [
    { fell: tile, kind: 'fell', site: tile, n: 2, got: 0 },
    { firewood: f.house, kind: 'firewood', site: f.house },
  ]);
  assert.deepStrictEqual(Sim.fireView(st).planned, { fell: true, firewood: true });
  const trees = st.w.trees[tile];
  let saved = null, lastFell = null, onTile = 0;
  for (let i = 0; i < 6 * 24 * 10 && st.player.plan.tasks.length; i++) {
    Sim.advance(st, 0.1);
    const c = st.player.queue[0];
    if (c && c.plan && c.plan.chain === 'fell' && c.begun !== null) onTile = Math.max(onTile, st.jobs.get(c.target) ? +(st.jobs.get(c.target).site === tile) : 0);
    if (!saved && hh.timber > 0) saved = JSON.parse(JSON.stringify(Sim.save(st)));
    if (st.player.plan.last && st.player.plan.last.kind === 'fell') lastFell = lastFell || st.player.plan.last;
  }
  assert.deepStrictEqual(st.player.plan.tasks, [], 'both tasks done');
  assert(onTile, 'the felling was at the chosen tile');
  assert.strictEqual(lastFell.which, 'home', 'the fell task left with its trips home');
  assert(st.w.trees[tile] <= trees - 2 + 1e-6, `two trees felled at the chosen tile (${trees} to ${st.w.trees[tile]})`);
  assert(['cut', 'full'].includes(st.player.plan.last.which), `the firewood task left: ${st.player.plan.last.which}`);
  assert(hh.wood > 0, 'firewood cut at home');
  fire = Sim.fireView(st);
  assert(fire.wood === hh.wood && fire.nights >= 1 && Array.isArray(fire.mend));
  sound(st, 'felled and cut by the plan');
  // a save and a load go on the same
  const back = Sim.load(tinyWorld(rows), saved), again = Sim.load(tinyWorld(rows), saved);
  Sim.advance(back, 2 * DAY);
  Sim.advance(again, 2 * DAY);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  sound(back, 'loaded');
  // a save from before the timber: the field absent reads as none
  const old = JSON.parse(JSON.stringify(saved)), was = JSON.stringify(old).length;
  const strip = (o) => { if (o && typeof o === 'object') { if ('timber' in o && 'wood' in o && 'members' in o) delete o.timber; for (const k in o) strip(o[k]); } };
  strip(old);
  assert(JSON.stringify(old).length < was, 'the timber taken out of the save');
  const older = Sim.load(tinyWorld(rows), old);
  Sim.advance(older, DAY);
  sound(older, 'an older save loaded');
}

// 3. The outlook counts timber home as firewood for a household left to its head; planned by hand, only with a firewood task.
{
  const st = make();
  const hh = st.households[st.pawns[FARMER].household];
  Stores.put(st, hh, 'timber', 30, 'felling');
  const fuelOf = () => Sim.supplyOutlook(st, hh.id);
  const auto = JSON.stringify(fuelOf());
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, false);
  const hand = JSON.stringify(fuelOf());
  Sim.plan(st, 'add', { firewood: st.farmsteads[hh.farmstead].house });
  const planned = JSON.stringify(fuelOf());
  assert.notStrictEqual(auto, hand, 'by hand with no firewood task, the timber is not counted');
  assert.strictEqual(planned, auto, 'with a firewood task, it is');
}
console.log('firewood ok: two steps for every household, no cold day in a year; fell and firewood planned by hand, their refusals; the fire read; save and load; the outlook');

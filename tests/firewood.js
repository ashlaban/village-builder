// @suite fast
// Wood in two steps (VB-1653): timber felled in the woods and carried home (the kind wood), cut into firewood at the house (the kind
// firewood), for every household; the player's plan tasks `fell` (a forest tile of its choosing, n trips) and `firewood` (at the house),
// their refusals, the page's read of the fire (Sim.fireView), and a save and a load going on the same. On the tiny village of tests/plan.js.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { DAY, YEAR_DAYS } = VB['sim/rules'], { KINDS } = VB['sim/kinds'];
const { WOOD_HOURS } = VB['sim/wood'], Stores = VB['sim/stores'];
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
  // (the households that stood from the start: a household founded in the year begins with the wood its people bring, and a new
  // household's first days are a matter of its hands' choice of work, as before the split)
  const n0 = st.households.length;
  let cold = 0, felled = 0, cut = 0;
  const seen = new Set();
  for (let d = 0; d < YEAR_DAYS; d++) {
    Sim.advance(st, DAY);
    for (const hh of st.households.slice(0, n0)) if (!hh.dissolved && hh.cold > 0) cold++;
    for (const j of st.jobs.values()) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      if (j.kind === 'wood') felled++;
      if (j.kind === 'firewood') cut++;
    }
  }
  assert(felled > 0 && cut > 0, `trips to fell (${felled}) and cuttings at home (${cut}) posted`);
  assert.strictEqual(cold, 0, 'no household-day cold in the year, of those that stood from the start');
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    // (VB-1750: a household founded in the year whose people are all gone from it, none to fell, is not asked for wood)
    if (hh.id >= n0 && !hh.members.length) continue;
    assert(hh.wood > 0, `household ${hh.id} has wood at the year's end`);
    assert(hh.timber === undefined || hh.timber >= 0);
  }
  sound(st, 'a year of two steps');
}

// 2. Played by hand: the refusals, then a fell task on a chosen tile and a firewood task at the house carried out by the plan.
{
  const st = make();
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, st.player.pawn, false);
  const hid = st.pawns[FARMER].household, hh = st.households[hid], f = st.farmsteads[hh.farmstead], v = st.villages[f.village];
  // a forest tile not the job's: of the village's wood, not its first tile
  const tile = v.wood.find((t) => t !== v.wood[0] && st.w.trees[t] >= 3);
  assert(tile !== undefined, 'a wooded tile to choose');
  // refusals
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { fell: f.fields[0] ? f.fields[0].tile : f.house })), /no trees stand at/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 0 })), /cannot plan 0 loads/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 2.5 })), /cannot plan 2.5 loads/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { firewood: tile })), /house is not at/);
  Stores.take(st, hh, 'wood', hh.wood, 'burn');
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { firewood: f.house })), /no timber is home to cut/);
  // the read with an empty pile and no timber: short, fell then cut
  let fire = Sim.fireView(st, st.player.pawn);
  assert.deepStrictEqual([fire.wood, fire.timber, fire.nights, fire.short, fire.mend], [0, 0, 0, true, ['fell', 'firewood']]);
  assert.deepStrictEqual(fire.planned, { fell: false, firewood: false });
  // planned: two trips at the tile, then the cutting (accepted, the felling planned brings the timber)
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 2 }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { fell: tile })), /already planned/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { firewood: f.house }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'keep', { i: 1 }), true); // kept: not taken back past its by (VB-1892)
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks, [
    { kind: 'fell', site: tile, n: 2, got: 0 },
    { kind: 'firewood', site: f.house },
  ]);
  assert.deepStrictEqual(Sim.fireView(st, st.player.pawn).planned, { fell: true, firewood: true });
  const trees = st.w.trees[tile];
  let saved = null, lastFell = null, onTile = 0;
  for (let i = 0; i < 6 * 24 * 10 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length; i++) {
    Sim.advance(st, 0.1);
    const c = Sim.controlOf(st, st.player.pawn).queue[0];
    if (c && c.plan && c.plan.goal === 'fell' && c.begun !== null) onTile = Math.max(onTile, st.jobs.get(c.target) ? +(st.jobs.get(c.target).site === tile) : 0);
    if (!saved && hh.timber > 0) saved = JSON.parse(JSON.stringify(Sim.save(st)));
    if (VB['sim/steps'].pawnPlan(st, st.player.pawn).last && VB['sim/steps'].pawnPlan(st, st.player.pawn).last.kind === 'fell') lastFell = lastFell || VB['sim/steps'].pawnPlan(st, st.player.pawn).last;
  }
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks, [], 'both tasks done');
  assert(onTile, 'the felling was at the chosen tile');
  assert.strictEqual(lastFell.which, 'home', 'the fell task left with its trips home');
  assert(st.w.trees[tile] < trees - 1.5, `two trees felled at the chosen tile, less a few days' regrowth (${trees} to ${st.w.trees[tile]})`);
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'cut', 'the firewood task left with the timber cut');
  assert(hh.wood > 0, 'firewood cut at home');
  fire = Sim.fireView(st, st.player.pawn);
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
  const fuelOf = () => VB['sim/outlook'].reckon(st, hh, st.plans.households.get(hh.id)).fuel.parts.store; // as the head reckons at a review
  const auto = JSON.stringify(fuelOf());
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, st.player.pawn, false);
  const hand = JSON.stringify(fuelOf());
  Sim.plan(st, st.player.pawn, 'add', { firewood: st.farmsteads[hh.farmstead].house });
  const planned = JSON.stringify(fuelOf());
  assert.notStrictEqual(auto, hand, 'by hand with no firewood task, the timber is not counted');
  assert.strictEqual(planned, auto, 'with a firewood task, it is');
}
// 4. VB-1662: a fell task's n is loads, not trips. On a hand start (the booth raised by the farmstead task), a fell task of 3 loads brings
// 3 loads home (3 trees felled, 3 * ECON.woodPerTrip timber), however many a cart stacks on a trip (before: 24 timber, the task counting
// 3 trips of 5, 2 and 1 loads). Then a firewood task cuts the timber home, all of it here (VB-1775: a goal held to its end, the pile's
// season's goal or the timber gone, as the firewood chain says, where before it was a back load a job and the cottage took the rest), and
// the cottage brings its timber to the site by its own trips; the timber held is all along what was put with reason felling less what
// was cut or built with.
{
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand: true });
  st.naturalDeaths = false;
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: st.farmsteads[0].house }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  for (let i = 0; i < 20 * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length; i++) Sim.advance(st, 0.1);
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'raised');
  const hh = st.households[0], f = st.farmsteads[0], v = st.villages[f.village], P = st.ECON.woodPerTrip;
  const tile = v.wood.find((t) => st.w.trees[t] >= 3), trees0 = st.w.trees[tile];
  const sum = (kind) => hh.totals.filter((e) => e.good === 'timber' && e.kind === kind).reduce((s, e) => s + e.n, 0) +
    (hh.ledger || []).filter((e) => e.good === 'timber' && e.kind === kind).reduce((s, e) => s + e.n, 0);
  const closes = (what) => {
    const held = Stores.heldOf(hh, 'timber');
    assert(Math.abs(held - (sum('felling') + sum('cutting') + sum('build'))) < 1e-9,
      `${what}: timber ${held} against felled ${sum('felling')}, cut ${sum('cutting')}, built ${sum('build')}`);
  };
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { fell: tile, n: 3 }), true);
  for (let i = 0; i < 8 * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.kind === 'fell'); i++) Sim.advance(st, 0.1);
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'home', 'the fell task done');
  assert.strictEqual(Stores.heldOf(hh, 'timber'), 3 * P, 'three loads of timber home, no more');
  assert.strictEqual(sum('felling'), 3 * P, 'three loads felled');
  assert(trees0 - st.w.trees[tile] > 2 && trees0 - st.w.trees[tile] < 3 + 1e-6, `three trees felled: ${trees0} to ${st.w.trees[tile]}`);
  closes('felled');
  // the cottage under way, the woodpile below the season's goal: a firewood task leaves the timber its walls count on (VB-1808), so that
  // none is cut; the cottage then fetches what its walls lack to the site, the timber home first
  hh.wood = 0; // below the season's goal
  const { fireAmount, fuelFree } = VB['sim/wood'];
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { upgrade: f.house, what: 'cottage' }), true);
  for (let i = 0; i < 2 * 240 && !VB['sim/projects'].projectsOf(st, 'household', hh.id).length; i++) Sim.advance(st, 0.1);
  const plan = VB['sim/projects'].projectsOf(st, 'household', hh.id)[0];
  assert(plan, 'the cottage is under way');
  const ct = VB['sim/cottageplan'].cottageTimber(st, f), lack = (ct ? VB['sim/projects'].lacks(ct.site, ct.need) : 0) +
    plan.steps.slice(plan.open).reduce((n, y) => n + (y.timber ? VB['sim/projects'].lacks(y, y.timber) : 0), 0);
  Stores.put(st, hh, 'timber', 3, 'felling');
  hh.wood = 0;
  assert(lack > 3, `the walls lack timber: ${lack}`);
  assert.strictEqual(fireAmount(st, hh), fuelFree(st, hh), 'a firewood goal cuts none of the timber the walls count on');
  Stores.put(st, hh, 'timber', lack, 'felling');
  assert(fireAmount(st, hh) > fuelFree(st, hh), 'only the timber above what the walls lack may be cut');
  closes('kept');
  let sited = 0; // the trips' loads lie at the site and are no store's ledger (VB-1705): count the trees felled for it
  const fell = VB['sim/kinds'].KINDS.timber.ops.fell, run = fell.run;
  fell.run = (...a) => { sited++; return run(...a); };
  for (let i = 0; i < 20 * 240 && !sited; i++) {
    Sim.advance(st, 0.1);
    closes(`hour ${st.t.toFixed(1)}`);
  }
  assert(sum('build') < 0 && sited > 0, `the walls took what timber was home (${sum('build')}) and a trip brought timber to the site`);
  fell.run = run;
  closes('built');
  sound(st, 'felled, cut and built with by hand');
}
// 5. VB-1931 (Kim, 27 Nov 2026: cut wherever timber lies that the household or nobody owns): a firewood task at a tile off the house where
// timber of the household's lies, or of nobody's (its household gone), is accepted, and its cutting turns that timber into firewood
// carried home to the woodpile; one where only another household's lies is refused with a reason, and that timber lies uncut.
{
  const st = make();
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, st.player.pawn, false);
  const Lying = VB['sim/lying'], { TRAVEL } = VB['sim/rules'], P = st.ECON.woodPerTrip;
  const hid = st.pawns[FARMER].household, hh = st.households[hid], f = st.farmsteads[hh.farmstead];
  const [other, gone] = st.households.filter((x) => x.id !== hid && !x.dissolved);
  const own = f.house + 3, theirs = f.house + 5, nobody = f.house + 7;
  Lying.leave(st, 'wood', TRAVEL.load, own, { type: 'household', id: hid });
  Lying.leave(st, 'leftTimber', TRAVEL.load, theirs, { type: 'household', id: other.id });
  Lying.leave(st, 'wood', 2 * TRAVEL.load, nobody, { type: 'household', id: gone.id });
  VB['sim/heirs'].extinct(st, gone, 'a test');
  Stores.take(st, hh, 'wood', hh.wood, 'burn'); // the pile short
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { firewood: theirs })), /timber at \d+ is another's/);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { firewood: f.house + 9 })), /house is not at/);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { firewood: own }), true, "the household's own timber may be cut");
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { firewood: nobody }), true, "nobody's timber may be cut");
  // the firewood cut and not from the timber home (a cutting at the house takes its timber with the same reason)
  const cutSum = () => (hh.ledger || []).concat(hh.totals || []).filter((e) => e.kind === 'cutting').reduce((x, e) => x + e.n, 0);
  const cut0 = cutSum();
  let atPile = false;
  for (let i = 0; i < 6 * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.length; i++) {
    Sim.advance(st, 0.1);
    const a = st.agents[st.player.pawn];
    if (a && a.job && a.job.kind === 'cutpile' && a.job.site === nobody && a.leg && a.leg.kind === 'work') atPile = true;
  }
  for (let i = 0; i < 240 && st.agents[st.player.pawn].load > 0; i++) Sim.advance(st, 0.1); // the last load carried home
  const pp = VB['sim/steps'].pawnPlan(st, st.player.pawn);
  assert.deepStrictEqual(pp.tasks, [], 'the cutting done');
  assert.strictEqual(pp.last.which, 'cut', `the task left with the timber cut: ${pp.last.which}`);
  assert(atPile, 'the cutting was worked at the tile where the timber lay');
  assert(!Lying.pilesAt(st, nobody).length && !Lying.pilesAt(st, own).length, 'the timber lying at both tiles is all cut');
  const cut = cutSum() - cut0;
  assert(Math.abs(cut - 3 * P) < 1e-6, `three loads of firewood stacked on the woodpile, one of its own (not fetched home as timber by its felling: the review's F1) and two of nobody's (${cut})`);
  assert.strictEqual(Lying.amountAt(st, theirs, 'leftTimber', { type: 'household', id: other.id }), TRAVEL.load, "another's timber lies uncut");
  sound(st, 'cut where the timber lay');
  // (the review's F6) a cutting's load set down on its way home lies as the household's, and a goal of its brings it home
  const before = cutSum();
  Lying.leave(st, 'cutpile', TRAVEL.load, f.house + 4, { type: 'household', id: hid });
  Stores.take(st, hh, 'wood', hh.wood, 'burn');
  for (let i = 0; i < 2 * 240 && Lying.pilesAt(st, f.house + 4).length; i++) Sim.advance(st, 0.1);
  for (let i = 0; i < 240 && st.agents.some((a) => a.job && a.job.kind === 'cutpile' && a.load > 0); i++) Sim.advance(st, 0.1);
  assert(!Lying.pilesAt(st, f.house + 4).length, 'the firewood set down on the road is taken up');
  assert(hh.wood > 0 && cutSum() > before, `and brought home to the woodpile (${hh.wood})`);
  sound(st, 'firewood set down on the road brought home');
}
// 6. VB-1932 (Kim, 27 Nov 2026: "The task to cut trees should always be available. The task to cut timber to firewood should always be
// available on non-reserved timber"): with the pile above the season's goal, a firewood task is accepted while timber that no building
// holds back is home, refused with none, and cuts all of that timber, the held-back timber left; a fell task is accepted on any tile the
// village's wood allows in every season; the outlook's left-out timber (the Stores row's Cut) and the page's house callout and forest
// tile offer the acts.
{
  const st = make();
  Sim.inhabit(st, FARMER);
  Sim.setAuto(st, st.player.pawn, false);
  const me = st.player.pawn, hid = st.pawns[FARMER].household, hh = st.households[hid], f = st.farmsteads[hh.farmstead], v = st.villages[f.village];
  const P = st.ECON.woodPerTrip, { pileOf, timberFree } = VB['sim/wood'], { SEASON_DAYS, cal } = VB['sim/rules'];
  const fillPile = () => {
    const p = pileOf(st, hh);
    Stores.put(st, hh, 'wood', Math.max(0, p.goal - p.free) + 4 * P, 'cutting');
    assert(!pileOf(st, hh).short, "the pile holds the season's goal");
  };
  fillPile();
  if (hh.timber > 0) Stores.take(st, hh, 'timber', hh.timber, 'cutting');
  assert.match(String(Sim.plan(st, me, 'add', { firewood: f.house })), /no timber is home to cut: fell timber first/);
  // timber a building holds back (a cottage's walls lacking 2 loads): not to cut
  const CP = VB['sim/cottageplan'], cottageTimber = CP.cottageTimber;
  CP.cottageTimber = (s, x) => (x.id === f.id ? { site: { wood: 0 }, need: 2 * P } : cottageTimber(s, x));
  Stores.put(st, hh, 'timber', 2 * P, 'felling');
  assert.strictEqual(timberFree(st, hh), 0);
  assert.match(String(Sim.plan(st, me, 'add', { firewood: f.house })), /no timber is home to cut but what the household's building holds back/);
  const leftOf = () => VB['sim/outlook'].reckon(st, hh, st.plans.households.get(hid)).fuel.parts.left || [];
  assert(!leftOf().some((x) => x.what === 'timber'), 'held-back timber is not offered for cutting in the Stores row');
  // two loads more: accepted, though the pile holds the season's goal
  Stores.put(st, hh, 'timber', 2 * P, 'felling');
  assert.strictEqual(timberFree(st, hh), 2 * P);
  assert(leftOf().some((x) => x.what === 'timber' && Math.abs(x.n - 2 * P) < 1e-6), 'the Stores row offers the unreserved timber for cutting');
  assert.strictEqual(Sim.fireView(st, me).cuttable, 2 * P);
  assert.strictEqual(Sim.plan(st, me, 'add', { firewood: f.house }), true, "a cutting is accepted with the pile at the season's goal");
  const cutSum = () => (hh.ledger || []).concat(hh.totals || []).filter((e) => e.kind === 'cutting' && e.good === 'wood' && e.n > 0).reduce((x, e) => x + e.n, 0);
  const cut0 = cutSum();
  for (let i = 0; i < 4 * 240 && VB['sim/steps'].pawnPlan(st, me).tasks.length; i++) Sim.advance(st, 0.1);
  const pp = VB['sim/steps'].pawnPlan(st, me);
  assert.deepStrictEqual(pp.tasks, [], 'the cutting done');
  assert.strictEqual(pp.last.which, 'cut', `the task left with the unreserved timber cut, not at the goal: ${pp.last.which}`);
  assert(Math.abs(hh.timber - 2 * P) < 1e-6, `the timber the building holds back is left uncut (${hh.timber})`);
  assert(cutSum() - cut0 >= 2 * P - 1e-6, `the unreserved timber cut into firewood (${cutSum() - cut0})`);
  CP.cottageTimber = cottageTimber;
  sound(st, "cut above the season's goal");
  // fell: accepted on a tile the village's wood allows, in every season, the pile full
  const tile = v.wood.find((t) => st.w.trees[t] >= 2 && VB['sim/territory'].woodWhy(st, v, t) === null);
  assert(tile !== undefined, 'a tile to fell on');
  const seasons = new Set();
  for (let k = 0; k < 4; k++) {
    fillPile();
    seasons.add(cal(st.t).season);
    assert.strictEqual(Sim.plan(st, me, 'add', { fell: tile }), true, `a felling accepted in season ${cal(st.t).season}`);
    const i = VB['sim/steps'].pawnPlan(st, me).tasks.findIndex((t) => t.kind === 'fell');
    assert.strictEqual(Sim.plan(st, me, 'remove', { i }), true);
    Sim.advance(st, SEASON_DAYS * DAY);
  }
  assert.strictEqual(seasons.size, 4, 'every season tried');
  // the page (page/ui2wood, run on its own): the house callout offers Cut whenever unreserved timber is home and no cut task is planned;
  // a fellable tile offers Fell
  const vm = require('vm'), { readSource } = require('../tools/lib/source.js');
  fillPile();
  Stores.put(st, hh, 'timber', P, 'felling');
  const page = { Sim, st, w: st.w, VB, hud: {}, esc: (x) => x, actIcon: (k) => `[${k}]`, goodIcon: (k) => `[${k}]`, recipeFact: (k) => ({ k }),
    hudPlanned: () => VB['sim/steps'].pawnPlan(st, me) };
  vm.createContext(page);
  vm.runInContext(readSource('src/page/ui2wood.js') + '\nthis.houseWood = houseWood; this.woodActs = woodActs;', page);
  assert(!pileOf(st, hh).short && /data-hud="cutwood"/.test(page.houseWood(Sim.fireView(st, me)).act), 'the house offers Cut above the goal');
  assert(/data-hud="fell"/.test(page.woodActs(tile, f, [])), 'a fellable tile offers Fell, the pile full');
  assert.strictEqual(Sim.plan(st, me, 'add', { firewood: f.house }), true);
  assert.strictEqual(page.houseWood(Sim.fireView(st, me)).act, '', 'no Cut while a cut task is planned');
}
console.log('firewood ok: two steps for every household, no cold day in a year; fell and firewood planned by hand, their refusals; the fire read; save and load; the outlook; a fell task of n loads brings n loads, and the timber held closes against its ledger; cut where timber of the household or of nobody lies, not of another; cut and fell on offer whatever the pile, the held-back timber not cut');

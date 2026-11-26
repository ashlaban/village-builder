// VB-1655: land first. The solo settler who plans by hand lands at a camp with nothing under way (no shelter begun, no cottage plan, no
// field), roofless, its nights the open sky's (no fire lit); the build menu and the tile's reasons; the farmstead task's refusals; the
// chain from the tap to the raised shelter on the house tile itself (VB-1666), on the landing tile and on a tile two steps off (the house, its tile's owner, the herd's home
// and the water moved with it, the landing given back); its waits and its days in the agenda; a save and a load mid-chain go on the same.
// On the tiny land of tests/plan.js.
const assert = require('assert');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld } = require('./lib/tiny.js'),
  { canon, sha, kept } = require('./lib/canon.js'),
  { checkState } = require('./lib/invariants.js');
const { roofless } = VB['sim/building'],
  { projectsOf } = VB['sim/projects'],
  { hexSteps, bfs } = VB['sim/hex'],
  { LANDING } = VB['sim/landing'],
  Water = VB['sim/water'];
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const sound = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants, ${what}`);
const hash = (st) => sha(canon(kept(st)));
const seed = (hand = true) => {
  const st = Sim.seed(tinyWorld(rows), 7, 'solo', null, { hand });
  st.naturalDeaths = false;
  return st;
};
const played = (st) => {
  Sim.inhabit(st, st.households[0].holder);
  Sim.setAuto(st, st.player.pawn, false);
  return st;
};
// Runs until the farmstead task has left the plan (or `days` pass), noting each wait's kind and each agenda kind seen.
const run = (st, days = 20) => {
  const waits = new Set(),
    laid = new Set();
  for (let i = 0; i < days * 240 && VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks.some((t) => t.kind === 'farmstead'); i++) {
    Sim.advance(st, 0.1);
    for (const t of Sim.planView(st, st.player.pawn).tasks) if (t.waits) waits.add(t.waits.why + (t.waits.kind ? `:${t.waits.kind}` : ''));
    if (i % 10 === 0) for (const g of Sim.agenda(st, st.player.pawn).days.flat()) if (g.what === 'task') laid.add(g.kind);
  }
  return { waits, laid };
};
// The tiles two steps from the landing that would take the farmstead.
const twoOff = (st) => {
  const f = st.farmsteads[0];
  return [...bfs(st.w, f.house, 2, () => true).dist.keys()].filter(
    (t) => hexSteps(st.w, f.house, t) === 2 && Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', t) === null,
  );
};

// ---- 1. the landing: a camp, nothing under way; without `hand` as before ----
{
  const st = seed(),
    hh = st.households[0],
    f = st.farmsteads[0];
  assert.strictEqual(f.camp, true, 'a camp');
  assert.deepStrictEqual(projectsOf(st, 'household', 0), [], 'no project: no field, no cottage');
  assert.deepStrictEqual(Sim.stakedBooths(st), [], 'no booth staked');
  assert.strictEqual(f.fields.length, 0);
  assert(hh.herds.length > 0, 'its herd');
  assert(roofless(st, hh), 'a camp is roofless');
  sound(st, 'the camp');
  assert(!st.villages[f.village].fence.some((s) => s.edges.some((e) => e.tile === f.house)), 'no fence round the landing (VB-1658)');
  const wood = hh.wood;
  Sim.advance(st, 30);
  assert(roofless(st, hh), 'still roofless: placed, its shelter begun, not raised');
  assert.strictEqual(hh.wood, wood, 'the open sky: no fire lit at the camp');
  const staked = Sim.stakedBooths(st); // VB-1658: a head not played places the farmstead by its own rule at its first working hour
  assert.deepStrictEqual(staked, [f.house], 'unplayed, the camp placed its farmstead itself, its shelter on the house tile');
  assert(f.shelter && f.shelter.built === null && !st.booths.length, 'the shelter is the farm\'s own, no booth of st.booths');
  const old = seed(false);
  assert.strictEqual(old.farmsteads[0].camp, undefined, 'without hand, no camp');
  assert.deepStrictEqual(Sim.stakedBooths(old), [old.farmsteads[0].house], 'without hand, the shelter begun at the landing');
}
// ---- 2. the menu, the tile's reasons, the task's refusals ----
{
  const st = seed(),
    f = st.farmsteads[0],
    w = st.w;
  assert.strictEqual(Sim.placeWhy(st, null, 'farmstead', f.house), 'there is no pawn null');
  assert.deepStrictEqual(Sim.buildMenu(st, -1), [], 'no menu for no pawn');
  played(st);
  const menu = Sim.buildMenu(st, st.player.pawn);
  const [{ work }] = menu;
  assert.deepStrictEqual(menu, [{ what: 'farmstead', ok: true, why: null, hours: 12, timber: 2, work }]);
  assert(work > 12, `the whole work with the timber trips: ${work}`);
  assert.strictEqual(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', f.house), null, 'the landing itself');
  assert.match(String(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'cellar', f.house)), /nothing called cellar/);
  assert.match(String(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', -1)), /no tile -1/);
  const [t] = twoOff(st);
  const tried = (fn, re, what) => {
    const undo = fn();
    assert.match(String(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', t)), re, what);
    assert.match(String(Sim.plan(st, st.player.pawn, 'add', { farmstead: t })), re, `${what}, refused as a task`);
    undo();
  };
  tried(() => ((w.water[t] = 1), () => (w.water[t] = 0)), /water/, 'water');
  tried(() => ((w.river[t] = 1), () => (w.river[t] = 0)), /river/, 'a river');
  tried(() => (st.used.add(t), () => st.used.delete(t)), /in use/, 'used');
  tried(() => ((st.owner[t] = 9), () => (st.owner[t] = 0)), /owned or claimed by another/, 'owned by another');
  tried(() => ((w.trees[t] = 5), () => (w.trees[t] = 0)), /trees stand/, 'wooded');
  const far = [...bfs(w, f.house, 6, () => true).dist.keys()].find((u) => hexSteps(w, f.house, u) === LANDING.soilSteps + 1);
  assert.strictEqual(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', far), null, 'no step bound for the played head (VB-1667)');
  // walled in: every way to it blocked (the tiles round it made water; the walkable parts labelled again)
  const ring = [];
  for (let d = 0; d < 6; d++) ring.push(w.nb[t * 6 + d]);
  const near = ring.filter((u) => u >= 0 && u !== f.house && !w.water[u]),
    { invalidateReach } = VB['sim/walking'];
  for (const u of near) (w.water[u] = 1), invalidateReach(w, u);
  assert.match(String(Sim.placeWhy(st, st.player ? st.player.pawn : null, 'farmstead', t)), /not reachable on foot/, 'walled in');
  for (const u of near) (w.water[u] = 0), invalidateReach(w, u);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: t }), true);
  assert.match(String(Sim.plan(st, st.player.pawn, 'add', { farmstead: f.house })), /planned already/, 'one at a time');
  const est = Sim.agenda(st, st.player.pawn).plan[0].hours.mid; // VB-1658: the menu's work is the plan's estimate (a task at t, here: the same steps)
  assert.strictEqual(work, Math.round(est * 10) / 10, `the menu's work and the plan's estimate (${est})`);
  assert.deepStrictEqual(Sim.buildMenu(st, st.player.pawn)[0].ok, false);
  assert.match(Sim.buildMenu(st, st.player.pawn)[0].why, /planned already/);
  sound(st, 'refusals');
}
// ---- 3. the chain on the landing tile: placed, the timber fetched, the booth raised; the camp over, no cottage begun ----
{
  const st = played(seed()),
    hh = st.households[0],
    f = st.farmsteads[0],
    land = f.house,
    home = st.herds[hh.herds[0]].home;
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: land }), true);
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'sleep', { from: 21, until: 6 }), true);
  const { waits, laid } = run(st);
  assert.deepStrictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).tasks, [], 'the task has left');
  assert.strictEqual(VB['sim/steps'].pawnPlan(st, st.player.pawn).last.which, 'raised', JSON.stringify(VB['sim/steps'].pawnPlan(st, st.player.pawn).last));
  assert.strictEqual(f.house, land, 'the house stays on the landing');
  assert.strictEqual(st.herds[hh.herds[0]].home, home, 'the herd stays');
  assert.strictEqual(f.camp, false, 'the camp is over');
  assert(f.shelter && f.shelter.built !== null && !st.booths.length, 'the shelter stands on the house tile, no booth beside it');
  assert.strictEqual(Sim.farmView(st, f.id, st.player && st.player.pawn).rung, 'shelter');
  assert(!roofless(st, hh), 'under the shelter');
  assert.deepStrictEqual(projectsOf(st, 'household', 0), [], 'no cottage begun');
  assert(waits.has('sleep') && waits.has('unposted:timber'), `waits given: ${[...waits]}`);
  assert(!waits.has('unposted:shelter'), `the raising is never unposted once the timber is in (VB-1658): ${[...waits]}`);
  assert(laid.has('timber') || laid.has('shelter'), `the agenda lays its steps: ${[...laid]}`);
  Sim.advance(st, 48);
  assert.deepStrictEqual(projectsOf(st, 'household', 0), [], 'still no cottage begun');
  sound(st, 'raised on the landing');
}
// ---- 4. on a tile two steps off: what follows the house moves with it; a save and a load mid-chain go on the same ----
{
  const st = played(seed()),
    hh = st.households[0],
    f = st.farmsteads[0],
    land = f.house;
  Sim.advance(st, 30); // its water found at its first morning
  assert(f.water, 'the water found');
  const t = twoOff(st)[0],
    v = st.villages[f.village];
  assert.strictEqual(Sim.plan(st, st.player.pawn, 'add', { farmstead: t }), true);
  for (let i = 0; i < 2400 && f.house === land; i++) Sim.advance(st, 0.1);
  assert.strictEqual(f.house, t, 'the house moved to the tile');
  assert(st.used.has(t) && !st.used.has(land), 'the tiles in use');
  assert.deepStrictEqual(VB['sim/ownership'].ownerOf(st, t), { type: 'household', id: hh.id });
  assert.strictEqual(VB['sim/ownership'].ownerOf(st, land), null, 'the landing given back');
  assert.deepStrictEqual(hh.herds, [], 'the herds stand at the landing (VB-1667), listed away');
  assert(st.herdsAway.every((id) => st.herds[id].tile === land), 'each at the landing');
  const src = Water.source(st.w, t, v);
  assert.strictEqual(f.water.tile, src.tile, 'the water found from the house');
  const staked = Sim.stakedBooths(st);
  assert.deepStrictEqual(staked, [t], 'the shelter begun on it');
  assert(roofless(st, hh), 'roofless while staked');
  const views = Sim.planView(st, st.player.pawn).tasks;
  assert.strictEqual(views[0].farmstead, t);
  sound(st, 'placed');
  Sim.advance(st, 3);
  const saved = JSON.parse(JSON.stringify(Sim.save(st)));
  const back = Sim.load(tinyWorld(rows), saved),
    again = Sim.load(tinyWorld(rows), saved);
  run(back);
  run(again);
  assert.strictEqual(hash(back), hash(again), 'a loaded run goes on the same');
  run(st);
  assert.strictEqual(hash(st), hash(back), 'as the run itself');
  assert.strictEqual(VB['sim/steps'].pawnPlan(back, back.player.pawn).last.which, 'raised');
  assert(back.households[0].herds.length && !back.herdsAway, 'the herds driven home');
  for (const id of back.households[0].herds) assert(hexSteps(back.w, back.herds[id].home, t) <= 2, 'the herd grazes by the house');
  assert.strictEqual(back.farmsteads[0].camp, false);
  sound(back, 'raised two steps off, loaded');
}
// ---- 5. VB-1658: a hand start left on automatic behaviour gets its roof: the farmstead placed, the booth raised, the cottage begun ----
{
  const st = seed(),
    hh = st.households[0],
    f = st.farmsteads[0];
  Sim.inhabit(st, hh.holder);
  Sim.setAuto(st, st.player.pawn, false);
  Sim.advance(st, 30);
  assert.strictEqual(f.camp, true, 'automatic behaviour off: the camp waits for the player');
  assert.deepStrictEqual(Sim.stakedBooths(st), [], 'nothing placed by its own rule');
  Sim.setAuto(st, st.player.pawn, true);
  let placed = null,
    raised = null;
  for (let i = 0; i < 24 * 10 * 30 && !projectsOf(st, 'household', 0).some((p) => p.what === 'cottage'); i++) {
    Sim.advance(st, 0.1);
    if (placed === null && Sim.stakedBooths(st).length) placed = st.t;
    if (raised === null && f.camp === false) raised = st.t;
  }
  assert(placed !== null && placed < 30 + 24, `placed within a day of automatic behaviour turned on (${placed})`);
  assert(raised !== null && !roofless(st, hh), 'the shelter raised');
  assert(projectsOf(st, 'household', 0).some((p) => p.what === 'cottage'), 'the cottage begun');
  assert(st.t < 30 + Sim.SEASON_DAYS * 24, `within a season (${st.t})`);
  assert(!st.villages[f.village].fence.length, 'no fence stands for the farm placed in play');
  sound(st, 'roofed on automatic');
}
console.log('camp: a camp at the landing, nothing under way, roofless and unlit; the menu and the refusals; the farmstead placed and its '
  + 'shelter raised on the house tile, on the landing and two steps off, the house, its owner, the herd and the water moved; a save mid-chain the same; on automatic behaviour, unplayed or played, '
  + 'the farmstead placed, the shelter raised and the cottage begun; no fence round the landing; the menu\'s work the plan\'s');

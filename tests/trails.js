// Blazing a trail (VB-447; design.md, Moving to new land, Settling in steps): the verb blaze opens a trail from a tile to a tile along the
// route the trail would make (a wooded tile at a path's cost), each wooded tile on it a job of PATHS.blaze hours for the blazer's household,
// 1 where still trodden; a tile blazed is a path (PATHS.at[2]), a worn way like any other, and the walk is as quick as the trail promised;
// open ground is not blazed. On a tiny world (tests/lib/tiny.js): a village in a meadow, a belt of broadleaf east of it, meadow beyond.
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { issue } = VB['sim/commands'],
  Projects = VB['sim/projects'],
  { trailSteps } = VB['sim/trails'];
const { PATHS, trailStep, unblazed } = VB['sim/walking'],
  { findRoute, routeCost } = VB['sim/routes'],
  { DAY } = VB['sim/rules'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('TRAILS FAIL:', m);
  }
};
// 50 by 15: meadow to column 21, broadleaf from 22 to 31, meadow beyond; sea at the rims.
const COLS = 50,
  ROWS = 15;
const rows = Array.from({ length: ROWS }, (_, r) =>
  Array.from({ length: COLS }, (_, c) =>
    r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1 ? '~' : c >= 22 && c <= 31 ? 'F' : '.',
  ).join(''),
);
const make = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [10, 7], farms: 2, sizes: [5, 4] }], { seed: 3 });
  st.naturalDeaths = false;
  return st;
};
const say = (st, actor, args) => issue(st, { actor, verb: 'blaze', target: null, args, source: 'pawn' });
const trailsOf = (st, id) => Projects.projectsOf(st, 'pawn', id).filter((p) => p.what === 'trail');
{
  const st = make(),
    w = st.w,
    v = st.villages[0],
    hh = st.households[0],
    grown = hh.members.filter((id) => st.pawns[id].age >= 16 && st.pawns[id].age < 60),
    child = st.living.find((id) => st.pawns[id].age < 16),
    id = grown[0],
    from = v.center,
    to = tileAt(w, 36, 7);
  // refused: a child, no tile, no wood between (open ground wears its own way)
  if (child !== undefined) check(/not grown/.test(say(st, child, { from, to })), 'a child blazes no trail');
  check(/no tile/.test(say(st, id, { from, to: -1 })), 'a trail goes to a tile');
  check(/no wood lies/.test(say(st, id, { from, to: tileAt(w, 18, 7) })), 'no trail over open ground');
  // the steps: the wooded tiles of the trail's route, in order from `from`, PATHS.blaze.hours each
  const route = findRoute(w, from, to, undefined, 0, trailStep),
    steps = trailSteps(st, from, to);
  check(
    steps.length >= 10 && steps.every((s) => w.biome[s.place] === VB.gen.B.FOREST && s.hours === PATHS.blaze.hours),
    `a step for each wooded tile of the route, ${PATHS.blaze.hours} hours (${steps.length})`,
  );
  check(
    steps.every((s, k) => k === 0 || route.indexOf(s.place) > route.indexOf(steps[k - 1].place)),
    'the steps in the order of the route, from its start',
  );
  const before = routeCost(w, findRoute(w, from, to)),
    promised = route.reduce((c, t, k) => (k ? c + trailStep(w, route[k - 1], t) : 0), 0),
    t0 = st.t;
  check(say(st, id, { from, to }) === true, 'a grown pawn of a household with a farm blazes a trail');
  check(/already/.test(say(st, id, { from, to })), 'one trail at a time');
  const plan = trailsOf(st, id)[0];
  check(plan && plan.holder.type === 'pawn' && plan.from === from && plan.to === to, "the trail is its blazer's plan");
  check(checkState(st).length === 0, `invariants, begun: ${checkState(st).join('; ')}`);
  // blazed by its household's hands, tile by tile
  const workers = new Set();
  for (let h = 0; h < 30 * DAY && trailsOf(st, id).length; h++) {
    Sim.advance(st, 1);
    for (const j of st.jobs.values())
      if (j.kind === 'blaze') for (const a of j.claims) workers.add(st.pawns[a].household);
  }
  check(!trailsOf(st, id).length, 'the trail is blazed within 30 days');
  check([...workers].every((x) => x === hh.id) && workers.size === 1, "the blazer's household blazes it");
  check(
    steps.every((s) => w.worn[s.place] === 2 && w.wear[s.place] >= PATHS.at[2] * 0.9 && !unblazed(w, s.place)),
    'every tile blazed is a path',
  );
  const after = routeCost(w, findRoute(w, from, to)),
    hrs = (x) => (x / VB['sim/rules'].SPEED).toFixed(2);
  if (process.env.TRAILS_SHOW)
    console.log(
      `${steps.length} tiles, ${((st.t - t0) / DAY).toFixed(1)} days; hours ${hrs(before)}, ${hrs(promised)}, ${hrs(after)}`,
    );
  check(
    after < before * 0.6 && after <= promised * 1.1,
    `the walk is as quick as the trail promised: ${before.toFixed(1)} before, ${promised.toFixed(1)} promised, ${after.toFixed(1)} after`,
  );
  check(
    st.record.some((e) => e.kind === 'trail' && /blazed a trail/.test(e.text)),
    'the trail is told',
  );
  check(checkState(st).length === 0, `invariants, blazed: ${checkState(st).join('; ')}`);
  // faded to trodden ground: blazed again at PATHS.blaze.again an hour a tile
  for (const s of steps) {
    w.wear[s.place] = PATHS.at[1] * 2;
    w.worn[s.place] = 1;
  }
  const again = trailSteps(st, from, to);
  check(
    again.length === steps.length && again.every((s) => s.hours === PATHS.blaze.again),
    `a faded trail is blazed again at ${PATHS.blaze.again} hour a tile`,
  );
}
// the blazer dies: the trail is given up, its job with it
{
  const st = make(),
    v = st.villages[0],
    id = st.households[0].members.find((m) => st.pawns[m].age >= 16 && st.pawns[m].age < 60);
  check(say(st, id, { from: v.center, to: tileAt(st.w, 36, 7) }) === true, 'begun');
  Sim.advance(st, 6);
  Sim.killPawn(st, id, 'illness');
  Sim.advance(st, DAY);
  check(!trailsOf(st, id).length, "a dead blazer's trail is given up");
  check(![...st.jobs.values()].some((j) => j.kind === 'blaze'), 'and its job taken down');
}
if (failed) {
  console.error(`trails: ${failed} failed`);
  process.exit(1);
}
console.log('trails: ok');

// No pawn walks where there is no way by land (VB-329): a job posted across the water gets no bid and its owner's pawns take other work;
// a goal beyond ROUTE.reach is refused; a pawn told to walk there, or to take the job, is told why not; walkTo itself does not move a pawn.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const Jobs = VB['sim/jobs'], { issue } = VB['sim/commands'], { walkTo, hasRoute, tileAt: tileOf } = VB['sim/agents'];
const { age } = VB['sim/records'], { MATCH, ROUTE } = VB['sim/rules'];
// two islands: the village on the left, a farm's fields on the right, a column of sea between them
const row = '.'.repeat(14) + '~~' + '.'.repeat(14);
const w = tinyWorld(Array(20).fill(row));
const st = tinyState(w, [{ at: [6, 10], farms: 1, sizes: [6] }, { at: [24, 10], farms: 1, sizes: [4] }], { seed: 4 });
Sim.advance(st, 3);
const A = st.households[0], B = st.households[1], fA = st.farmsteads[A.farmstead], fB = st.farmsteads[B.farmstead];
const adults = A.members.filter((id) => st.pawns[id].alive && age(st, st.pawns[id]) >= MATCH.help.minAge);
assert(adults.length >= 2, 'household A has hands');
const drop = (key) => { for (const j of [...(st.jobsBy.get(key) || [])]) { st.jobs.delete(j.key); st.jobsBy.get(key).delete(j); } };
drop(`household:${A.id}`); drop(`village:${fA.village}`);
const a = st.agents[adults[0]], here = tileOf(st, a.x, a.y), far = fB.fields[0].tile, near = fA.fields[0].tile;
assert(!hasRoute(st, here, far) && hasRoute(st, here, near), 'the sea cuts the islands');
// a job on the other island: no bid wins, the pawns stay out of it, the refusals are counted and nobody walks
const owner = { type: 'household', id: A.id };
const fd = fB.fields[0]; fd.stage = 'stubble';
const jFar = Jobs.post(st, 'plow:far', 'plow', owner, far, { field: fd, farm: fB });
jFar.posted = st.t - 5;
const c = Sim.cal(st.t), idle = adults.map((id) => st.agents[id]);
const refused = VB.count.bidNoRoute;
Jobs.planRound(st, idle, c);
assert(idle.every((p) => p.job !== jFar && !p.path), 'a pawn took, or walked to, a job across the sea');
assert(VB.count.bidNoRoute > refused, 'the refusal is not counted');
assert.strictEqual(st.routeFallbacks, 0, 'a fallback walk was made');
// the verbs say why not
assert.strictEqual(issue(st, { actor: a.id, verb: 'work', target: jFar.key, source: 'player' }), 'no way there');
assert.strictEqual(issue(st, { actor: a.id, verb: 'walkTo', target: far, source: 'player' }), 'no way there');
// walkTo itself leaves the pawn where it is, idle, and counts it
const x = a.x, y = a.y;
assert.strictEqual(walkTo(st, a, far, st.w.hx[far], st.w.hy[far]), false);
assert(a.x === x && a.y === y && !a.path && st.routeFallbacks === 1, 'walkTo moved a pawn with no route');
st.routeFallbacks = 0;
// other work on its own island is taken
const fdA = fA.fields[0]; fdA.stage = 'stubble';
const jNear = Jobs.post(st, 'plow:near', 'plow', owner, near, { field: fdA, farm: fA });
jNear.posted = st.t - 5;
Jobs.planRound(st, idle, c);
assert(idle.some((p) => p.job === jNear) && idle.every((p) => p.job !== jFar), 'the pawns did not take the work they can reach');
assert.strictEqual(st.routeFallbacks, 0);
// a move to a home over the sea does not start (the household changes, sim/heirs' moveTo; the pawn stays where it is, counted)
{
  const m = st.agents[adults[1]], mx = m.x, my = m.y, n = VB.count.moveNoRoute;
  VB['sim/heirs'].moveTo(st, m.id, B.id);
  for (let k = 0; k < 30; k++) Sim.advance(st, 0.1);
  assert(st.pawns[m.id].household === B.id && VB.count.moveNoRoute === n + 1 && !st.journeys.some((j) => j.pawn === m.id), 'a journey over the sea started');
  assert(tileOf(st, m.x, m.y) === tileOf(st, mx, my) || hasRoute(st, tileOf(st, mx, my), tileOf(st, m.x, m.y)), 'the mover crossed the sea');
  assert.strictEqual(st.routeFallbacks, 0, 'the stranded mover made a fallback walk');
  assert.strictEqual(issue(st, { actor: m.id, verb: 'goHome', source: 'player' }), 'no way there');
}
// a goal beyond ROUTE.reach on one island is refused as well
const long = tinyWorld(Array(3).fill('.'.repeat(ROUTE.reach * 2 + 20)));
const st2 = { w: long, pathCache: new Map(), routeFallbacks: 0, routeDirty: new Set() };
assert(!hasRoute(st2, tileAt(long, 0, 1), tileAt(long, ROUTE.reach * 2 + 10, 1)), 'a goal beyond reach has a route');
assert(hasRoute(st2, tileAt(long, 0, 1), tileAt(long, 20, 1)));
console.log('noway ok');

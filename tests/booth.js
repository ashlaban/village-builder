// A booth (VB-784; design.md, Moving to new land, The booth): staked by a pawn on free ground, its wood lying at its tile first, raised in
// BOOTH.hours; a stay at its tile sleeps under its roof, four at most, its household's and whom its maker lets in; unkept it rots lazily
// and is gone at none, the tile as it was. On a tiny state.
const assert = require('assert'),
  VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { issue } = VB['sim/commands'],
  Stores = VB['sim/stores'];
const { DAY, YEAR, BOOTH } = VB['sim/rules'];
const B = VB['sim/building'];
const W = 60,
  st = tinyState(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [5, 4] }], {
    seed: 3,
  });
const hh = st.households[0],
  f = st.farmsteads[hh.farmstead];
const adults = hh.members.filter((id) => st.pawns[id].age >= 14 && st.pawns[id].age < 60),
  id = adults[0];
const tile = tileAt(st.w, (f.house % st.w.COLS) + 6, Math.floor(f.house / st.w.COLS));
assert.ok(typeof issue(st, { actor: id, verb: 'raiseBooth', target: -1, source: 'pawn' }) === 'string', 'no such tile');
assert.ok(
  typeof issue(st, { actor: id, verb: 'raiseBooth', target: f.house, source: 'pawn' }) === 'string',
  'not on a house tile',
);
st.w.trees[tile] = 3; // wooded: felled where it stands
assert.strictEqual(
  issue(st, { actor: id, verb: 'raiseBooth', target: tile, source: 'pawn' }),
  true,
  'staked on free ground',
);
assert.ok(
  typeof issue(st, { actor: id, verb: 'raiseBooth', target: tile, source: 'pawn' }) === 'string',
  'one booth a tile',
);
// staked: its maker's project plan (VB-1172), the wood and then the raising; no booth stands yet
const Projects = VB['sim/projects'];
const plans = () => Projects.projectsOf(st, 'pawn', id).filter((p) => p.what === 'booth');
assert.strictEqual(st.booths.length, 0, 'nothing stands while it is staked');
assert.ok(plans().length === 1 && st.boothSeq === 1, 'the booth is the staking pawn\'s plan');
const plan = plans()[0];
assert.ok(
  plan.booth === 0 && plan.tile === tile && plan.holder.type === 'pawn' && plan.holder.id === id,
  'held by the pawn who staked it',
);
assert.deepStrictEqual(
  plan.steps.map((s) => s.kind),
  ['timber', 'booth'],
  'the wood, then the raising',
);
assert.deepStrictEqual(checkState(st), [], 'invariants, staked');
// raised: two loads of wood at its tile (a trip brings ECON.woodPerTrip), then BOOTH.hours of work
let raisingOpen = null;
for (let h = 0; h < 40 * DAY && !st.booths.length; h++) {
  Sim.advance(st, 1);
  if (raisingOpen === null && plans().length && plans()[0].open === 1) raisingOpen = st.t;
}
assert.ok(st.booths.length === 1, 'the booth is raised');
const b = st.booths[0];
assert.ok(raisingOpen !== null && b.built >= raisingOpen, 'the raising opened once its wood lay there');
assert.ok(b.wood >= BOOTH.wood, `its wood lay there first: ${b.wood}`);
assert.ok(b.id === 0 && b.tile === tile && b.by === hh.id && b.maker === id, 'the booth stands for its maker\'s household');
assert.ok(b.cond === 1 && b.condAt === b.built, 'whole when raised');
assert.strictEqual(plans().length, 0, 'its plan is finished');
assert.deepStrictEqual(checkState(st), [], 'invariants, raised');
// five pawns, four beds
const grain = (h) => Stores.put(st, h, 'grain', 400, 'harvest', { barley: 400 });
grain(hh);
const say = (m) => issue(st, { actor: m, verb: 'lodge', target: tile, args: { why: 'work', days: 1 }, source: 'pawn' });
const pawns = st.pawns.filter((p) => p.alive).map((p) => p.id);
// letIn (VB-984): only its maker lets a pawn in; one not let in is refused a bed, and lodged once let in
const others = pawns.filter((m) => st.pawns[m].household !== hh.id),
  stranger = others[0],
  notMaker = adults.find((m) => m !== id);
assert.ok(/not for pawn/.test(say(stranger)), 'a pawn not let in is refused the booth');
assert.ok(
  /did not make/.test(
    issue(st, { actor: notMaker, verb: 'letIn', target: b.id, args: { pawn: stranger }, source: 'pawn' }),
  ),
  'one who did not make the booth cannot let a pawn in',
);
for (const m of others)
  assert.strictEqual(
    issue(st, { actor: id, verb: 'letIn', target: b.id, args: { pawn: m }, source: 'pawn' }),
    true,
    `let ${m} in`,
  );
assert.ok(
  /open to pawn/.test(issue(st, { actor: id, verb: 'letIn', target: b.id, args: { pawn: stranger }, source: 'pawn' })),
);
let n = 0,
  refused = null;
for (const m of pawns) {
  if (st.agents[m].away !== undefined) continue;
  const h = st.households[st.pawns[m].household];
  if (h && h.farmstead !== null && h.id !== hh.id) grain(h);
  const r = say(m);
  if (r === true) n++;
  else if (n >= BOOTH.sleeps) {
    refused = r;
    break;
  }
}
assert.strictEqual(n, BOOTH.sleeps, `${BOOTH.sleeps} beds taken (${n})`);
assert.ok(typeof refused === 'string' && /sleeps/.test(refused), `the fifth is refused: ${refused}`);
assert.ok(
  st.away.filter((s) => s.bed === tile).every((s) => s.roof === 'booth'),
  "a stay at its tile has roof 'booth'",
);
// rots: lazily, a stay renews nothing
const c0 = B.boothCondition(st, b);
Sim.advance(st, YEAR / 3);
assert.ok(B.boothCondition(st, b) < c0 && b.cond === 1, 'worn by closed form, nothing stored');
for (const s of [...st.away]) issue(st, { actor: s.pawn, verb: 'comeHome', source: 'pawn' });
for (let d = 0; d < 4 * 365 && st.booths.length; d++) Sim.advance(st, DAY);
assert.strictEqual(st.booths.length, 0, 'gone after its years unkept');
assert.ok(!st.used.has(tile) && st.owner[tile] === 0, 'the tile is as it was');
assert.ok(
  st.away.every((s) => s.roof !== 'booth'),
  'no stay under a gone roof',
);

// the fetched path (VB-985): on open ground away from the trees, the wood is fetched by a timber trip from the village wood within
// WOOD.reach, lies at the booth's tile, and only then the raising takes BOOTH.hours. A small generated island, which has forest.
{
  const { scenario } = require('./lib/probe.js'),
    { WOOD } = VB['sim/rules'];
  const g = scenario('founders', 7),
    hg = g.households.find((h) => h.farmstead !== null),
    fg = g.farmsteads[hg.farmstead],
    v = g.villages[fg.village];
  const N = g.w.N,
    C = g.w.COLS,
    hx = fg.house % C,
    hy = Math.floor(fg.house / C);
  const dist = (a, b) => Math.max(Math.abs((a % C) - (b % C)), Math.abs(Math.floor(a / C) - Math.floor(b / C)));
  const free = (t) => !g.w.water[t] && !g.w.trees[t] && !g.used.has(t) && g.owner[t] === 0 && !g.w.road?.[t];
  let open = -1;
  for (let t = 0; t < N && open < 0; t++)
    if (free(t) && dist(t, fg.house) <= 6 && dist(t, fg.house) >= 3 && v.wood.some((w) => dist(w, t) <= WOOD.reach))
      open = t;
  assert.ok(open >= 0 && v.wood.length, `an open tile near the village wood (${hx},${hy})`);
  const who = hg.members.find((m) => g.pawns[m].age >= 14 && g.pawns[m].age < 60);
  assert.strictEqual(
    issue(g, { actor: who, verb: 'raiseBooth', target: open, source: 'pawn' }),
    true,
    'staked on open ground',
  );
  const gp = VB['sim/projects'].projectsOf(g, 'pawn', who).find((p) => p.what === 'booth');
  let woodAt = null;
  // the raising is other work (MATCH.urgency.other), done when the haymaking leaves a hand: 60 days, not 40, since the hay's cart is
  // fetched before its load and walks at its pace (VB-1812), and one left at the meadow when its hand is called away is fetched later
  for (let h = 0; h < 60 * DAY && !g.booths.length; h++) {
    Sim.advance(g, 1);
    if (woodAt === null && gp.steps[0].wood >= BOOTH.wood) woodAt = g.t;
  }
  const fb = g.booths[0];
  assert.ok(fb && woodAt !== null, 'the booth is raised from fetched wood');
  assert.ok(
    fb.built >= woodAt + BOOTH.hours - 1e-6,
    `the raising took ${BOOTH.hours} hours after the wood lay there: ${fb.built - woodAt}`,
  );
  assert.deepStrictEqual(checkState(g), [], 'invariants, fetched');
}
// a lodger's own judgement (VB-1172): a stay under the open sky for more than BOOTH.worth nights stakes a booth at its bed, works its wood
// and its raising before the tasks it came for, and sleeps under its roof once raised; a stay of BOOTH.worth nights or fewer stakes none.
// Staking takes no time, so one away may stake; giving it up (dropBooth) leaves its wood lying at its tile for the household.
{
  const s2 = tinyState(tinyWorld(Array(9).fill('.'.repeat(W)), { seed: 3 }), [{ at: [6, 4], farms: 2, sizes: [5, 4] }], {
    seed: 3,
  });
  const h2 = s2.households[0],
    f2 = s2.farmsteads[h2.farmstead];
  Stores.put(s2, h2, 'grain', 400, 'harvest', { barley: 400 });
  // a test's write: no child under 7 in the house, so that the last adult at home may lodge too (VB-1602)
  for (const m of h2.members) if (s2.pawns[m].age < 7) s2.pawns[m].born -= 7 * VB['sim/rules'].YEAR;
  const [p1, p2] = h2.members.filter((m) => s2.pawns[m].age >= 14 && s2.pawns[m].age < 60);
  const row = Math.floor(f2.house / s2.w.COLS),
    at1 = tileAt(s2.w, (f2.house % s2.w.COLS) + 8, row),
    at2 = tileAt(s2.w, (f2.house % s2.w.COLS) + 12, row),
    at3 = tileAt(s2.w, (f2.house % s2.w.COLS) + 16, row);
  s2.w.trees[at1] = 3;
  const lodgeAt = (m, t, days) =>
    issue(s2, { actor: m, verb: 'lodge', target: t, args: { why: 'work', days }, source: 'pawn' });
  const P = VB['sim/projects'],
    booths = (m) => P.projectsOf(s2, 'pawn', m).filter((q) => q.what === 'booth');
  assert.strictEqual(lodgeAt(p2, at2, BOOTH.worth), true);
  assert.strictEqual(booths(p2).length, 0, `a stay of ${BOOTH.worth} nights stakes no booth`);
  issue(s2, { actor: p2, verb: 'comeHome', source: 'pawn' });
  assert.strictEqual(lodgeAt(p1, at1, 12), true);
  const mine = booths(p1);
  assert.ok(mine.length === 1 && mine[0].tile === at1, 'a longer stay under the open sky stakes a booth at its bed');
  const stay = s2.away.find((x) => x.pawn === p1);
  assert.ok(stay.roof === 'none' && stay.jobs[stay.jobs.length - 1] === `booth:o${mine[0].booth}`, "its booth's work first");
  // staking while away: the verb's check is the pawn's life and the ground's, not whether it is free
  assert.strictEqual(issue(s2, { actor: p1, verb: 'raiseBooth', target: at3, source: 'pawn' }), true, 'one away stakes');
  const other = booths(p1).find((q) => q.tile === at3);
  for (let h = 0; h < 10 * DAY && !s2.booths.length; h++) Sim.advance(s2, 1);
  assert.ok(s2.booths.length === 1 && s2.booths[0].tile === at1, 'the lodger raised its booth');
  const still = s2.away.find((x) => x.pawn === p1);
  assert.ok(still && still.roof === 'booth', `the stay sleeps under it: ${still && still.roof}`);
  assert.deepStrictEqual(checkState(s2), [], 'invariants, a lodger\'s booth');
  // given up: only by its maker, and only before it is raised; its wood lies at its tile
  const P2 = s2.plans.projects.pawn.get(p1).find((q) => q === other);
  assert.ok(P2, 'the second booth is still staked');
  P2.steps[0].wood = 1; // a trip's half brought (the test writes it, as a trip would)
  assert.ok(/did not stake/.test(issue(s2, { actor: p2, verb: 'dropBooth', target: other.booth, source: 'pawn' })));
  assert.ok(/stands already/.test(issue(s2, { actor: p1, verb: 'dropBooth', target: s2.booths[0].id, source: 'pawn' })));
  const lying0 = (s2.lying || []).length;
  assert.strictEqual(issue(s2, { actor: p1, verb: 'dropBooth', target: other.booth, source: 'player' }), true);
  assert.ok(!booths(p1).some((q) => q === other), 'its plan is dropped');
  assert.ok(
    (s2.lying || []).length === lying0 + 1 && s2.lying[s2.lying.length - 1].tile === at3,
    'its wood lies at its tile',
  );
  assert.deepStrictEqual(checkState(s2), [], 'invariants, given up');
}
console.log('booth ok');

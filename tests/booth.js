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
assert.strictEqual(st.booths.length, 1);
const b = st.booths[0];
assert.ok(
  b.id === 0 && b.tile === tile && b.by === hh.id && b.built === null && st.boothSeq === 1,
  'the booth is staked, not built',
);
assert.deepStrictEqual(checkState(st), [], 'invariants, staked');
// raised: two loads of wood at its tile (a trip brings ECON.woodPerTrip), then BOOTH.hours of work
for (let h = 0; h < 40 * DAY && b.built === null; h++) Sim.advance(st, 1);
assert.ok(b.built !== null, 'the booth is raised');
assert.ok(b.wood >= BOOTH.wood, `its wood lay there first: ${b.wood}`);
assert.ok(b.built - 0 > 0 && b.cond === 1 && b.condAt === b.built, 'whole when raised');
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
  const fb = g.booths[0];
  let woodAt = null;
  for (let h = 0; h < 40 * DAY && fb.built === null; h++) {
    Sim.advance(g, 1);
    if (woodAt === null && fb.wood >= BOOTH.wood) woodAt = g.t;
  }
  assert.ok(fb.built !== null && woodAt !== null, 'the booth is raised from fetched wood');
  assert.ok(
    fb.built >= woodAt + BOOTH.hours - 1e-6,
    `the raising took ${BOOTH.hours} hours after the wood lay there: ${fb.built - woodAt}`,
  );
  assert.deepStrictEqual(checkState(g), [], 'invariants, fetched');
}
console.log('booth ok');

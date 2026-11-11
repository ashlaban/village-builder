// The village's outland (VB-156, sim/territory), on tiny worlds: claimed by need, its own a year and a day later, grown with its farms; no
// household or plot takes in another village's land; settlers keep to wilderness; the commons wood comes from the village's own land.
const VB = require('../src/load.js'), Sim = VB.sim, T = VB['sim/territory'], CL = VB['sim/claims'], { CLAIMS, YEAR } = VB['sim/rules'];
const { moveClock } = require('./lib/clock.js');
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TERRITORY FAIL:', m); } };
const open = (cols, rows, put = {}) => tinyWorld(Array.from({ length: rows }, (_, r) => [...'.'.repeat(cols)].map((c, k) => put[`${k},${r}`] || c).join('')));
const villageOf = (st, n) => (n < 0 ? -n - 1 : st.farmsteads[st.households[n - 1].farmstead].village);
const landOf = (st, vid) => { const out = []; for (let t = 0; t < st.w.N; t++) if (st.owner[t] && villageOf(st, st.owner[t]) === vid) out.push(t); return out; };
const ok = (st, label) => { const bad = checkState(st); check(!bad.length, `${label}: invariants: ${bad.slice(0, 2).join('; ')}`); };

// ---- by need: a lone village holds CLAIMS.outPerFarm tiles of outland a farm; a bigger one more ----
{
  const forest = {}; for (const k of ['20,4', '21,4', '20,5']) forest[k] = 'F';
  const st = tinyState(open(26, 14, forest), [{ at: [5, 7], farms: 1 }, { at: [19, 8], farms: 3 }], { seed: 2 });
  const t = T.tally(st);
  check(t.held[0] === CLAIMS.outPerFarm, `a village of 1 farm holds ${t.held[0]} tiles of outland, wanted ${CLAIMS.outPerFarm}`);
  check(t.held[1] === 3 * CLAIMS.outPerFarm, `a village of 3 farms holds ${t.held[1]}, wanted ${3 * CLAIMS.outPerFarm}`);
  check(!st.claims.size, 'settled villages have no claims left at the start');
  check(T.claimOutland(st) === 0, 'a village with its outland claims no more');
  ok(st, 'by need');
}

// ---- towards each other: two villages 10 steps apart, wanting more than lies between them, claim up to where their land meets ----
{
  const keep = CLAIMS.outPerFarm; CLAIMS.outPerFarm = 100; // more than lies within reach
  const st = tinyState(open(24, 12), [{ at: [6, 6], farms: 2 }, { at: [16, 6], farms: 2 }], { seed: 3, outland: false });
  // A claims first, at a meeting before B had people; then B claims too, and takes up the tiles nearer its green that A claimed
  const farmsB = st.villages[1].farmsteads; st.villages[1].farmsteads = [];
  T.claimOutland(st); st.villages[1].farmsteads = farmsB; T.claimOutland(st);
  const both = [...st.claims].filter(([, l]) => l.length > 1).length;
  T.settleOutland(st, true);
  CLAIMS.outPerFarm = keep;
  const a = new Set(landOf(st, 0)), b = new Set(landOf(st, 1));
  let touch = 0; for (const t of a) for (let d = 0; d < 6; d++) if (b.has(st.w.nb[t * 6 + d])) touch++;
  check(touch > 0, 'the two villages\' land meets');
  check(both > 0, `some tiles were claimed by both (${both}), the nearer claiming after the farther`);
  check(!st.claims.size, 'every claim is settled');
  ok(st, 'towards each other');
}

// ---- a year and a day: newcomers' claims are theirs at the next meeting, not before; the land grows with the village ----
{
  const st = tinyState(open(20, 12), [{ at: [8, 6], farms: 2 }], { seed: 4, outland: 'claimed' });
  const v = st.villages[0], claimed = [...st.claims.keys()];
  check(claimed.length === 2 * CLAIMS.outPerFarm - T.tally(st).held[0], `claimed on arrival: ${claimed.length}`);
  T.landMeeting(st); // the same day: too soon
  check(claimed.every((t) => st.owner[t] === 0), 'not the village\'s before a year has passed');
  moveClock(st, YEAR);
  const taken = claimed[3]; VB['sim/ownership'].setOwner(st, taken, { type: 'household', id: 0 }); // taken in meanwhile
  T.landMeeting(st);
  check(claimed.filter((t) => t !== taken).every((t) => st.owner[t] === -1), 'the village\'s a year later');
  check(st.owner[taken] === 1 && !CL.claimsOn(st, taken).length, 'a tile taken in meanwhile stays the household\'s, the claim dropped');
  // a third farm: the next meeting claims 8 more
  const f = st.farmsteads[st.villages[0].farmsteads[0]], before = T.tally(st);
  v.farmsteads.push(v.farmsteads[0]); // stands in for a new farm of the village (counted twice)
  T.landMeeting(st);
  check(T.tally(st).pending[0] === 3 * CLAIMS.outPerFarm - before.held[0], `a third farm claims more (${T.tally(st).pending[0]})`);
  v.farmsteads.pop();
  check(f && st.claims.size > 0, 'claims pending');
}

// ---- taking in: never another village's land or claims ----
{
  const st = tinyState(open(24, 12), [{ at: [6, 6], farms: 2 }, { at: [17, 6], farms: 2 }], { seed: 5 });
  const [A, Bv] = st.villages, fB = st.farmsteads[Bv.farmsteads[0]];
  const outA = T.outlandOf(st, A), outB = T.outlandOf(st, Bv);
  check(outA.every((t) => !T.freeFor(st, t, Bv.id)) && outA.every((t) => T.freeFor(st, t, A.id)), 'a village\'s outland is free for it alone');
  let wild = -1; for (let t = 0; t < st.w.N; t++) if (st.owner[t] === 0 && !st.claims.has(t) && !st.w.water[t]) { wild = t; break; }
  check(T.freeFor(st, wild, A.id) && T.freeFor(st, wild, null), 'wilderness is free for anyone');
  CL.addClaim(st, wild, { type: 'village', id: A.id }, 'outland');
  check(!T.freeFor(st, wild, Bv.id) && T.freeFor(st, wild, A.id) && !T.freeFor(st, wild, null), 'a tile A claims is free for A only');
  // B's own outland given to A: B's farm finds no tile of A's
  for (const t of outB) VB['sim/ownership'].setOwner(st, t, { type: 'village', id: A.id });
  const pick = VB['sim/fields'].chooseTile(st, fB);
  check(pick < 0 || (st.owner[pick] !== -A.id - 1 && T.freeFor(st, pick, Bv.id)), `B's farm took in ${pick}, owned by ${st.owner[pick]}`);
  const site = VB['sim/expansion'].findSite(st, Bv);
  check(!site || [site.house, site.field].every((t) => T.freeFor(st, t, Bv.id)), 'a plot of B on B\'s land or wilderness');
  // settlers: every owned or claimed tile is taken land for a new village
  const use = VB['sim/settle'].landInUse(st);
  check([...outA, wild].every((t) => use.taken.has(t)), 'settlers keep off village land and claims');
  ok(st, 'taking in');
}

// ---- the village's wood (VB-326): its tiles outside its land are claimed first, its own land comes first, and a tile cut bare leaves it ----
{
  const put = {}; for (const k of ['13,6', '14,6', '13,7', '3,2']) put[k] = 'F';
  const st = tinyState(open(20, 12, put), [{ at: [8, 6], farms: 1 }], { seed: 6, outland: false });
  const v = st.villages[0], forest = (t) => [VB.gen.B.FOREST, VB.gen.B.PINE].includes(st.w.biome[t]);
  check(v.wood.length === 4 && v.wood.every(forest), `the wood is the four forest tiles in reach (${v.wood.length})`);
  T.claimOutland(st);
  const first = [...st.claims.entries()].sort((a, b) => a[1][0].seq - b[1][0].seq)[0][0];
  check(v.wood.includes(first), `the first claim is a tile of the wood (${first})`);
  T.settleOutland(st, true);
  const own = v.wood.filter((t) => st.owner[t] === -v.id - 1);
  check(own.length > 0, 'the village holds forest of its wood');
  T.reckonWood(st, v);
  check(st.owner[v.wood[0]] === -v.id - 1, 'its own land comes first');
  // a tile cut bare leaves the wood; the rest stay
  const gone = v.wood[0], rest = v.wood.slice(1);
  VB['sim/forest'].clearTile(st, gone);
  check(!v.wood.includes(gone) && rest.every((t) => v.wood.includes(t)) && v.wood.length === 3, `the wood after a tile is cut bare: ${v.wood}`);
  ok(st, 'wood');
}
if (failed) process.exit(1);
console.log(`territory ok: ${CLAIMS.outPerFarm} tiles of outland a farm; claims a year and a day; no taking in of another village's land; the village's wood`);

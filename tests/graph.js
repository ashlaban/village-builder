// The membership graph and its scopes (VB-043): on the heirs scenario, the graph built at the seed agrees with the household caches, a
// year of moves, births, deaths and successions keeps them agreeing, a pawn holds several memberships at once, ended edges leave the live
// index, and the scopes "village A, owns" and "Lars's family, is kin of" cover what they should.
const VB = require('../src/load.js'), Sim = VB.sim, G = VB['sim/graph'], S = VB['sim/scopes'];
const { scenario } = require('./lib/probe.js'), assert = require('assert');
const st = scenario('heirs');
const ok = (when) => assert.deepStrictEqual(G.check(st).slice(0, 5), [], `${when}: the caches disagree with the graph`);
ok('at the seed');
const lars = st.pawns.find((p) => p.given === 'Lars' && p.died === null).id, A = 0;
// multi-membership: Lars resides in, holds and is the line of his farm, is a spouse and of a family, all at once
const roles = S.membershipsOf(st, lars).map((m) => m.role);
for (const r of ['resides', 'holder', 'line', 'spouse', 'family']) assert(roles.includes(r), `Lars has a live ${r} edge: ${roles}`);
// village A, owns: its households' tiles and the village's own, as st.owner says
const own = S.inScope(st, { level: 'village', ids: [A], dim: 'owns' });
const hhA = st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].village === A).map((h) => h.id);
assert.deepStrictEqual(own.households, hhA, 'village A: its live households');
const want = [];
for (let t = 0; t < st.owner.length; t++) {
  const n = st.owner[t];
  if ((n > 0 && hhA.includes(n - 1)) || n === -A - 1) want.push(t);
}
assert(want.length > hhA.length, 'village A owns tiles');
assert(want.some((t) => st.owner[t] === -A - 1) && want.some((t) => st.owner[t] > 0), 'both the households and the village own some');
assert.deepStrictEqual(own.tiles, want, 'village A, owns: its households and village tiles');
assert.deepStrictEqual(own.stores, [...hhA.map((id) => ({ type: 'household', id })), { type: 'village', id: A }], 'its stores');
// Lars's family, is kin of: Lars and his descendants
const desc = new Set([lars]);
for (let grew = true; grew; ) {
  grew = false;
  for (const p of st.pawns) if (!desc.has(p.id) && (desc.has(p.father) || desc.has(p.mother))) desc.add(p.id), (grew = true);
}
assert(desc.size > 3, 'Lars has descendants');
const kin = S.inScope(st, { level: 'family', ids: [lars], dim: 'kin' });
assert.deepStrictEqual(kin.pawns, [...desc].sort((a, b) => a - b), "Lars's family, is kin of: his descendants");
assert.deepStrictEqual(kin.tiles, [], 'kin covers no tiles');
const kerstin = st.pawns.find((p) => p.given === 'Kerstin' && p.died === null).id;
assert(!kin.pawns.includes(kerstin), "Lars's wife is of his household, not of his descent");
// named tiles: the house and a field of Lars's farm (A1), and the green of village A, are A's; the house of B's first farm is not
const A1 = st.farmsteads[st.households[0].farmstead], B1 = st.farmsteads[st.households[3].farmstead];
for (const [t, what] of [[A1.house, 'the house of A1'], [A1.fields[0].tile, 'a field of A1'], [st.villages[A].center, "A's green"]])
  assert(own.tiles.includes(t), `village A, owns: ${what}`);
assert(!own.tiles.includes(B1.house), 'village A, owns: not the house of B1');
// the role cache (VB-043, review F1): a role the edges contradict is caught
const was = st.pawns[lars].role;
assert.strictEqual(was, 'farmer', 'Lars, the holder, is its farmer');
st.pawns[lars].role = 'son';
assert(G.check(st).some((l) => l.startsWith(`pawns[${lars}]: role cache`)), 'a holder whose role is son contradicts his holder edge');
st.pawns[lars].role = was;
// a year on: moves, births, deaths and handovers each write their edges with the caches
st.naturalDeaths = true;
for (let q = 0; q < 4; q++) {
  Sim.advance(st, Sim.YEAR / 4);
  ok(`quarter ${q + 1}`);
}
// ended edges stay, outside the live index; the graph rebuilt from the edges alone (a load) has the same live edges
const ended = st.edges.filter((e) => e.until !== null);
assert(ended.length > 0, 'some edges ended in a year');
for (const e of ended) assert(!G.liveFrom(st, e.role, e.from).includes(e.id), `edge ${e.id} ended, out of the live index`);
const live = (role, id) => G.liveFrom(st, role, id).slice();
const before = st.pawns.map((p) => live('resides', p.id));
st.graph = null;
assert.deepStrictEqual(st.pawns.map((p) => live('resides', p.id)), before, 'the live index rebuilt from st.edges');
// an older save without the graph: it is built from the caches, and agrees with them
const saved = Sim.load(st.w, JSON.parse(JSON.stringify(Sim.save(st))));
assert.deepStrictEqual(G.check(saved).slice(0, 5), [], "after a save and load");
delete saved.edges;
saved.graph = null;
G.migrate(saved);
assert.deepStrictEqual(G.check(saved).slice(0, 5), [], 'an older save: the graph built from its caches');
console.log(`graph: ${st.edges.length} edges after a year (${ended.length} ended); caches agree; scopes on the heirs scenario as expected`);

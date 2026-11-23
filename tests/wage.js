// A servant's wage (VB-637; design.md, Marriage, nursing and growth: The portion): owed at the moving round for a year served, as an
// obligation of the kind `wage` (sim/obligations), paid from the master's grain above its reserve into the servant's stake, where it lies;
// what cannot be paid stays owed; a servant owed more than SERVICE.unpaid years' wages goes home; the means to marry count the stakes of
// the two who marry; a household below its floor takes no servant.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, O = VB['sim/obligations'], S = VB['sim/service'], probe = require('./lib/probe.js');
const { YEAR, SHARES } = VB['sim/rules'], { issue } = VB['sim/commands'], { meansOf } = VB['sim/matching'];
const { checkState } = require('./lib/invariants.js');
const { SERVICE } = S;
const setGrain = (hh, n) => { hh.grain = { barley: n }; }; // lint-allow: owner a constructed state's store
const P = (id) => ({ kind: 'pawn', id });
const sound = (st, when) => assert.deepStrictEqual(checkState(st).filter((b) => /obligation|stake/.test(b)), [], `${when}: invariants`);

const st = probe.state(), [a, b] = st.households.filter((h) => !h.dissolved);
const q = st.pawns[b.members.find((id) => id !== b.holder && st.pawns[id].father === b.holder) ?? b.members.find((id) => id !== b.holder)];
if (q.father === null) q.father = b.holder; // lint-allow: owner a constructed state: the servant's father keeps the home it goes back to
q.born = st.t - 20 * YEAR; // lint-allow: owner a constructed state: a grown child of the house, unmarried
q.age = 20; // lint-allow: owner the age kept with born
assert.strictEqual(issue(st, { actor: q.id, verb: 'move', target: a.id, args: { reason: 'service' }, source: 'round' }), true, 'into service');
assert.ok(q.servant && q.household === a.id);
const reserve = () => SHARES.reserveBase + a.members.length * SHARES.reservePerMember;

{ // not a year served: nothing owed
  S.oweWages(st);
  assert.strictEqual(S.wagesOwed(st, q.id), 0, 'a servant of less than a year is owed nothing');
}
q.servedSince = st.t - YEAR; // lint-allow: owner a year served
{ // a year served: owed its wage, paid as far as the grain above the reserve goes, into its stake
  setGrain(a, reserve() + 5);
  const r = st.record.length, stake = q.stake || 0;
  S.oweWages(st);
  const w = st.obligations.filter((o) => o.kind === 'wage');
  assert.strictEqual(w.length, 1, 'one obligation a servant a year');
  assert.deepStrictEqual([w[0].debtor, w[0].creditor, w[0].owes, w[0].enforcer.kind], [{ kind: 'household', id: a.id }, P(q.id), { rations: SERVICE.wage }, 'village']);
  assert.ok(Math.abs(q.stake - stake - 5) < 1e-9 && Math.abs(Sim.grainOf(a) - reserve()) < 1e-9, 'paid 5 into the stake, the reserve kept');
  assert.strictEqual(S.wagesOwed(st, q.id), SERVICE.wage - 5, 'the rest stays owed');
  assert.deepStrictEqual(st.record.slice(r).filter((e) => e.kind === 'wage').map((e) => [e.pawn, e.text]), [[q.id, `Was paid 5 rations of wages, ${SERVICE.wage - 5} still owed`]]);
  sound(st, 'paid in part');
  const back = Sim.load(probe.world(), JSON.parse(JSON.stringify(Sim.save(st))));
  assert.deepStrictEqual([back.obligations, back.pawns[q.id].stake], [st.obligations, q.stake], 'saved and loaded');
}
{ // the means to marry: the home's store, and with the two's stakes
  const without = meansOf(st, a.id), withQ = meansOf(st, a.id, [q.id]);
  assert.ok(withQ.held > without.held && withQ.portion === q.stake && without.portion === 0, 'its portion counted');
}
{ // unpaid two more years: more than SERVICE.unpaid years' wages owed, it goes home, its stake with it
  setGrain(a, 0);
  S.oweWages(st);
  assert.deepStrictEqual(S.unpaid(st), [], `${S.wagesOwed(st, q.id)} owed is not more than ${SERVICE.unpaid} years' wages`);
  S.oweWages(st);
  assert.strictEqual(S.wagesOwed(st, q.id), 3 * SERVICE.wage - 5);
  assert.deepStrictEqual(S.unpaid(st), [q.id], 'owed more than two years\' wages');
  const stake = q.stake;
  assert.deepStrictEqual(S.unpaidLeave(st, [q.id]), [], 'it found a home');
  assert.ok(q.household === b.id && !q.servant && q.stake === stake, 'gone home, out of service, its stake with it');
  // paid where it lies: the master's grain is not paid to one who has left
  setGrain(a, reserve() + 100);
  S.payWages(st);
  assert.ok(S.wagesOwed(st, q.id) === 3 * SERVICE.wage - 5 && q.stake === stake, 'what one who has left is owed stays owed');
  sound(st, 'gone home');
  // what a dead servant was owed lapses
  q.alive = false; // lint-allow: owner a constructed state
  S.payWages(st);
  assert.ok(S.wagesOwed(st, q.id) === 0 && st.obligations.filter((o) => o.kind === 'wage').every((o) => o.status === 'lapsed'), 'lapsed');
  q.alive = true; // lint-allow: owner back, for the floor's check
}
{ // a lone holder below its floor takes no servant; above it, it does (a grown child of another house waits for land)
  for (const [g, takes] of [[0, false], [1000, true]]) {
    const t = probe.state(), hs = t.households.filter((h) => !h.dissolved), lone = hs[0], c = t.pawns[hs[1].members[2]];
    for (const id of lone.members.filter((id) => id !== lone.holder)) t.pawns[id].alive = false; // lint-allow: owner a constructed lone holder
    lone.members = [lone.holder]; // lint-allow: owner a constructed lone holder
    c.born = t.t - 20 * YEAR; c.age = 20; // lint-allow: owner a grown child
    t.demand = [c.id]; // lint-allow: owner it wants land
    setGrain(lone, g);
    assert.strictEqual(S.takeServants(t).taken.has(lone.id), takes, takes ? 'above its floor: a servant' : 'below its floor: no servant');
  }
}
console.log('wage: ok');

// The gift (VB-216): the verb give settles a gift within the floor and the allowance and refuses one beyond them, unless the player's
// pawn gives; allowance's terms are slack and reserve, and on a running village it equals help's surplus.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, Rules = VB['sim/registry'];
const { issue } = VB['sim/commands'], { surplus } = VB['sim/help'], { floorOf, dailyNeed } = VB['sim/hunger'], { HELP } = VB['sim/rules'];
const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done);
const fresh = () => {
  const st = Sim.seed(r.value, 7, 'founders');
  const [a, b] = st.households.filter((h) => !h.dissolved && h.holder !== null);
  return { st, a, b };
};
const give = (st, from, to, n, source = 'help') => issue(st, { actor: from.holder, verb: 'give', target: to.id, args: { good: 'grain', n }, source });
const ctx = (from, to) => ({ giver: from.holder, receiver: to.holder, from, to });
let checks = 0;
{ // within the floor and the allowance: settled, both ledgers, the tie between the holders
  const { st, a, b } = fresh();
  b.grain = { barley: floorOf(st, b) + (st.pawns[b.holder].buffer - HELP.floorDays) * dailyNeed(st, b) + 100 };
  const allowance = Rules.value(st, 'allowance', ctx(b, a));
  assert(Math.abs(allowance - surplus(st, b)) < 1e-9 && Math.abs(allowance - 100) < 1e-6, `allowance ${allowance}, surplus ${surplus(st, b)}`);
  const a0 = Sim.grainOf(a), b0 = Sim.grainOf(b), tie0 = st.pawns[b.holder].ties.get(a.holder) || 0;
  assert.strictEqual(give(st, b, a, 60), true);
  assert(Math.abs(Sim.grainOf(a) - a0 - 60) < 1e-9 && Math.abs(b0 - Sim.grainOf(b) - 60) < 1e-9, 'what one gives the other gets');
  assert(a.ledger.some((e) => e.kind === 'gift' && e.n === 60) && b.ledger.some((e) => e.kind === 'gift' && e.n === -60), 'gift in both ledgers');
  assert(Math.abs((st.pawns[b.holder].ties.get(a.holder) || 0) - tie0 - HELP.tieGain) < 1e-9, 'the gift raises the tie');
  checks++;
}
{ // beyond the allowance, and below the floor: refused, nothing changes; the player's pawn may give either
  const { st, a, b } = fresh();
  st.pawns[b.holder].buffer = HELP.bufferDays[1]; // room between the allowance and the floor: the reserve
  const reserve = (HELP.bufferDays[1] - HELP.floorDays) * dailyNeed(st, b);
  b.grain = { barley: floorOf(st, b) + reserve + 100 };
  const a0 = Sim.grainOf(a), b0 = Sim.grainOf(b), l0 = a.ledger.length;
  const over = give(st, b, a, 100 + reserve / 2);
  assert(typeof over === 'string' && /would give at most 100 rations/.test(over), `beyond the allowance: ${over}`);
  b.grain = { barley: floorOf(st, b) + 10 };
  const under = give(st, b, a, 20);
  assert(typeof under === 'string' && /below its floor/.test(under), `below the floor: ${under}`);
  b.grain = { barley: b0 };
  assert(Sim.grainOf(a) === a0 && Sim.grainOf(b) === b0 && a.ledger.length === l0, 'a refused gift changes nothing');
  b.grain = { barley: floorOf(st, b) + 10 };
  assert.strictEqual(give(st, b, a, 20, 'player'), true, "the player's pawn may give below the floor");
  assert(Math.abs(Sim.grainOf(b) - (floorOf(st, b) - 10)) < 1e-9, 'it gave below the floor');
  checks++;
}
{ // the player's gift (VB-221): beyond the allowance and below the floor it settles; the warning names the feed order's last group
  const { giftWarning } = VB['sim/exchange'], { feedGroups, servedLast } = VB['sim/hunger'];
  const { st, a, b } = fresh();
  b.grain = { barley: floorOf(st, b) + 10 };
  assert.strictEqual(giftWarning(st, b, 10), null, 'a gift down to the floor has no warning');
  const w = giftWarning(st, b, 30), before = JSON.stringify(Sim.save(st));
  assert(w && Math.abs(w.below - 20) < 1e-9 && w.days === HELP.floorDays, `the warning says how far below the floor: ${JSON.stringify(w)}`);
  const mem = b.members.map((id) => st.pawns[id]).filter((p) => p.died === null), groups = feedGroups(st, b, mem).filter((g) => g.length);
  assert.deepStrictEqual(w.hungry, groups[groups.length - 1].map((p) => p.id), 'it names the members the feed order serves last');
  assert(w.hungry.length > 0 && w.hungry.every((id) => b.members.includes(id)), 'who are members of the giving household');
  // with a child in the house and children fed first, the last group is the grown
  const kid = mem.find((p) => p.age < 14);
  if (kid && st.cenv) {
    const f = st.farmsteads[b.farmstead], order = Sim.farmPractice(st, f).feedOrder;
    if (order === 'children') assert(!servedLast(st, b).includes(kid.id), 'children fed first are not served last');
  }
  giftWarning(st, b, 30);
  assert.strictEqual(JSON.stringify(Sim.save(st)), before, 'the warning writes nothing');
  const a0 = Sim.grainOf(a);
  assert.strictEqual(give(st, b, a, 30, 'player'), true, "the player's gift below the floor settles");
  assert(Math.abs(Sim.grainOf(a) - a0 - 30) < 1e-9 && Math.abs(Sim.grainOf(b) - (floorOf(st, b) - 20)) < 1e-9, 'and moves the grain');
  checks++;
}
{ // the village store gives what it holds and takes the yearly filling; malformed gifts are refused
  const { st, a, b } = fresh(), v = st.villages[st.farmsteads[a.farmstead].village];
  v.grain = { barley: 30 };
  const vgive = (n) => issue(st, { actor: { village: v.id }, verb: 'give', target: a.id, args: { good: 'grain', n }, source: 'help' });
  assert(typeof vgive(40) === 'string', 'the store gives no more than it holds');
  assert.strictEqual(vgive(30), true); assert(Sim.grainOf(v) === 0 && v.ledger.some((e) => e.kind === 'gift' && e.n === -30), 'the store gave');
  b.grain = { barley: floorOf(st, b) + 1000 };
  assert.strictEqual(issue(st, { actor: b.holder, verb: 'give', target: { village: v.id }, args: { good: 'grain', n: 5 }, source: 'help' }), true);
  assert(Sim.grainOf(v) === 5, 'the filling reached the store');
  const bad = [
    { actor: b.holder, verb: 'give', target: a.id, args: { good: 'meals', n: 5 } },
    { actor: b.holder, verb: 'give', target: a.id, args: { good: 'grain', n: -5 } },
    { actor: b.holder, verb: 'give', target: b.id, args: { good: 'grain', n: 5 } },
    { actor: { household: b.id }, verb: 'give', target: a.id, args: { good: 'grain', n: 5 } },
    { actor: a.members.find((m) => m !== a.holder) ?? -1, verb: 'give', target: b.id, args: { good: 'grain', n: 5 } },
  ];
  for (const c of bad) assert(typeof issue(st, { ...c, source: 'help' }) === 'string', `refused: ${JSON.stringify(c)}`);
  checks++;
}
{ // on a running village allowance names its two terms and equals help's surplus on every household
  const st = Sim.seed(r.value, 7, 'populous'); Sim.advance(st, Sim.YEAR);
  let n = 0, giving = 0;
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    const c = { giver: hh.holder, receiver: null, from: hh, to: hh }, e = Rules.explain(st, 'allowance', c);
    assert.deepStrictEqual(e.parts.map((p) => p.key), ['slack', 'goodwill', 'opinion', 'reserve']);
    assert.strictEqual(e.parts[1].factor, 0, 'a null receiver: no goodwill term'); assert.strictEqual(e.parts[2].factor, 0, 'nor opinion term');
    assert(Math.abs(e.value - surplus(st, hh)) < 1e-9, `household ${hh.id}: allowance ${e.value}, surplus ${surplus(st, hh)}`);
    n++; if (e.value > 0) giving++;
  }
  assert(giving > 0, 'some household has something to give');
  console.log(`exchange ok: ${checks} gift checks; allowance equals surplus on ${n} households, ${giving} with something to give`);
}

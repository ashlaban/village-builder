// The gift (VB-216): the verb give settles a gift within the floor and the allowance and refuses one beyond them, unless the player's
// pawn gives; allowance's terms are slack and reserve, and on a running village it equals help's surplus. On the small islands (VB-854).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Rules = VB['sim/registry'];
const { scenario } = require('./lib/probe.js');
const { bufferOf } = VB['sim/traits']; // VB-520: the floor and the holder's reserve, by its generosity
const { issue } = VB['sim/commands'], { surplus } = VB['sim/help'], { floorOf, dailyNeed } = VB['sim/hunger'], { HELP } = VB['sim/rules'];
const fresh = () => {
  const st = scenario('founders');
  const [a, b] = st.households.filter((h) => !h.dissolved && h.holder !== null);
  return { st, a, b };
};
const give = (st, from, to, n, source = 'help') => issue(st, { actor: from.holder, verb: 'give', target: to.id, args: { good: 'grain', n }, source });
// a gift from another farmstead is set aside where it lies and fetched (VB-461): the receiver has it once its fetcher is home
const fetchAll = (st) => { for (let k = 0; k < 96 && st.away.some((j) => j.why === 'fetch' || j.why === 'haul'); k++) Sim.advance(st, 0.5); };
const ctx = (from, to) => ({ giver: from.holder, receiver: to.holder, from, to });
let checks = 0;
{ // within the floor and the allowance: settled, both ledgers, the tie between the holders
  const { st, a, b } = fresh();
  b.grain = { barley: floorOf(st, b) + (bufferOf(st, b.holder) - HELP.floorDays) * dailyNeed(st, b) + 100 };
  const allowance = Rules.value(st, 'allowance', ctx(b, a));
  assert(Math.abs(allowance - surplus(st, b)) < 1e-9 && Math.abs(allowance - 100) < 1e-6, `allowance ${allowance}, surplus ${surplus(st, b)}`);
  const a0 = Sim.grainOf(a), b0 = Sim.grainOf(b), tie0 = st.pawns[b.holder].ties.get(a.holder) || 0;
  assert.strictEqual(give(st, b, a, 60), true);
  assert(Math.abs(b0 - Sim.grainOf(b) - 60) < 1e-9 && Sim.grainOf(a) <= a0, 'set aside at once, not yet in');
  fetchAll(st);
  const gotIn = (hh) => hh.ledger.filter((e) => e.kind === 'gift' && e.n > 0).reduce((x, e) => x + e.n, 0);
  assert(Math.abs(gotIn(a) - 60) < 1e-9, 'what one gives the other gets');
  assert(Math.abs(a.ledger.filter((e) => e.kind === 'gift' && e.n > 0).reduce((x, e) => x + e.n, 0) - 60) < 1e-9 && b.ledger.some((e) => e.kind === 'gift' && e.n === -60), 'gift in both ledgers');
  assert(Math.abs((st.pawns[b.holder].ties.get(a.holder) || 0) - tie0 - HELP.tieGain) < 1e-9, 'the gift raises the tie');
  checks++;
}
{ // beyond the allowance, and below the floor: refused, nothing changes; the player's pawn may give either
  const { st, a, b } = fresh();
  st.pawns[b.holder].traits[VB['sim/traits'].IDX.generosity] = 0; // room between the allowance and the floor: the reserve, 40 days (VB-520)
  const reserve = (bufferOf(st, b.holder) - HELP.floorDays) * dailyNeed(st, b);
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
  fetchAll(st);
  assert(a.ledger.some((e) => e.kind === 'gift' && Math.abs(e.n - 30) < 1e-9) && Sim.grainOf(a) >= 0, 'and moves the grain');
  checks++;
}
{ // the village store gives what it holds and takes the yearly filling; malformed gifts are refused
  const { st, a, b } = fresh(), v = st.villages[st.farmsteads[a.farmstead].village];
  v.grain = { barley: 30 };
  const vgive = (n, actor = b.holder) => issue(st, { actor, verb: 'give', target: a.id, args: { good: 'grain', n, store: v.id }, source: 'help' });
  // VB-673: the store gives through its alderman, at home; never by the village itself, nor by another pawn
  assert.strictEqual(issue(st, { actor: { village: v.id }, verb: 'give', target: a.id, args: { good: 'grain', n: 5 }, source: 'help' }), 'a village gives through its alderman');
  assert(/has no alderman/.test(vgive(5)), 'with the office vacant the store gives nothing');
  VB['sim/membership'].setAlderman(st, v, b.holder);
  assert(/is not the alderman/.test(vgive(5, a.holder)), 'only the alderman gives from it');
  st.agents[b.holder].away = { why: 'test' };
  assert(/is away/.test(vgive(5)), 'nor while he is away');
  delete st.agents[b.holder].away;
  assert(typeof vgive(40) === 'string', 'the store gives no more than it holds');
  assert.strictEqual(vgive(30), true); assert(Sim.grainOf(v) === 0 && v.ledger.some((e) => e.kind === 'gift' && e.n === -30), 'the store gave');
  b.grain = { barley: floorOf(st, b) + 1000 };
  assert.strictEqual(issue(st, { actor: b.holder, verb: 'give', target: { village: v.id }, args: { good: 'grain', n: 5 }, source: 'help' }), true);
  assert(Sim.grainOf(v) === 0, 'the filling is on its way');
  fetchAll(st);
  assert(Math.abs(Sim.grainOf(v) - 5) < 1e-9, 'the filling reached the store');
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
{ // on a running village (a year of populous) allowance names its terms and, but for the giver's mood (VB-875), equals help's surplus on every household
  const st = scenario('populous'); Sim.advance(st, Sim.YEAR);
  let n = 0, giving = 0;
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    const c = { giver: hh.holder, receiver: null, from: hh, to: hh }, e = Rules.explain(st, 'allowance', c);
    assert.deepStrictEqual(e.parts.map((p) => p.key), ['slack', 'goodwill', 'opinion', 'reserve', 'patron', 'mood']); // VB-708: the tie's term
    assert.strictEqual(e.parts[1].factor, 0, 'a null receiver: no goodwill term'); assert.strictEqual(e.parts[2].factor, 0, 'nor opinion term');
    const calm = Math.max(0, e.unclamped - e.parts[5].factor); // the allowance without the mood term
    assert(Math.abs(calm - surplus(st, hh)) < 1e-9, `household ${hh.id}: allowance ${calm} without mood, surplus ${surplus(st, hh)}`);
    n++; if (e.value > 0) giving++;
  }
  assert(giving > 0, 'some household has something to give');
  console.log(`exchange ok: ${checks} gift checks; allowance equals surplus on ${n} households, ${giving} with something to give`);
}
{ // VB-1485: a cow led home in a deal books goodwill only between living holders: a holder who has died lets the deal lapse
  const Ex = VB['sim/exchange'];
  const st = scenario('founders');
  const [from, hh] = st.households.filter((h) => !h.dissolved && h.holder !== null);
  const plan = st.plans.households.get(hh.id);
  for (const dead of [hh, from]) {
    plan.want = { what: 'cow', from: from.id, kind: 'cow', by: 'deal' };
    st.pawns[dead.holder].alive = false;
    Ex.KIND.methods[0].steps.find((s) => s.prim === "unload").deliver(st, { from: from.id }, hh);
    assert(plan.want.from === null && plan.want.by === null, 'the deal lapses with a dead holder');
    st.pawns[dead.holder].alive = true;
  }
  console.log('exchange ok: a deal lapses when a holder died while the cow was led home');
}

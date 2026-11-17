// The feast (VB-458; design.md, The gift: The feast, What a feast books): at a wedding or a funeral ale at its farm, a host whose grain stands
// above its seed and FEAST.above years of need lays out the lesser of its share of the surplus and FEAST.perGuest a ration of need of those
// who came, less the ale's grain; each eats its part as the day's meal, and each guest household's holder owes the host's holder its worth.
// On a constructed state (tests/lib/probe.js): a host below the threshold serves nothing; above it, the lesser bound; a guest household
// that stayed at home owes nothing; a guest household's meal is not eaten twice.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, S = VB['sim/stores'], O = VB['sim/occasions'], H = VB['sim/hunger'];
const { FEAST, BREW, DAY } = VB['sim/rules'], Traits = VB['sim/traits'], { balance } = VB['sim/relations'];
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');

const live = (st) => st.households.filter((h) => !h.dissolved && h.holder !== null);
const ration = (st, id) => (Sim.age(st, st.pawns[id]) >= 14 ? st.ECON.ration.adult : st.ECON.ration.child);
// An occasion held at the host's farm, ended now, with those of `come` standing at it; returns the feast's ledger entry or null.
function hold(st, host, come, kind = 'wedding') {
  const f = st.farmsteads[host.farmstead];
  const o = { id: st.occasionSeq++, kind, for: kind === 'wedding' ? [host.members[0], host.members[1]] : [host.members[0]], village: f.village,
    farm: f.id, tile: f.house, x: 0, y: 0, start: st.t, end: st.t + 1, overrides: false, asked: [], come: [...come], due: st.t + 1 };
  for (const id of come) st.agents[id].occasion = o.id;
  st.occasions.unshift(o);
  st.t = o.end;
  O.occasionsDue(st);
  const e = host.ledger[host.ledger.length - 1];
  return e && e.kind === 'feast' && e.t === st.t ? e : null;
}
const threshold = (st, hh) => S.grainOf(hh) - Sim.explainFeast(st, hh).value; // its seed and FEAST.above years of need

// 1. Below the threshold: nothing is served, nobody has feasted, no goodwill.
{
  const st = state(), [host, guest] = live(st);
  const keep = threshold(st, host);
  host.grain = { barley: keep - 1 };
  assert.ok(Sim.explainFeast(st, host).value < 0, 'the rule says it is below');
  assert.deepStrictEqual(Sim.explainFeast(st, host).parts.map((x) => x.key), ['seed', 'keep'], 'the threshold explained by its parts');
  const e = hold(st, host, [...host.members, ...guest.members]);
  assert.strictEqual(e, null, 'no feast below the threshold');
  assert.ok(guest.members.every((id) => st.pawns[id].feast === undefined), 'nobody ate at it');
  assert.strictEqual(balance(st, host.holder, guest.holder), 0, 'no goodwill booked');
  assert.ok(Math.abs(S.grainOf(host) - (keep - 1)) < 1e-9, 'the store untouched');
}

// 2. Above it: the lesser of the share of the surplus and the sitting; served is what was eaten, each by its ration.
for (const surplus of [10000, null]) {
  const st = state(), [host, guest, other] = live(st);
  const keep = threshold(st, host), come = [...host.members, ...guest.members];
  const need = come.reduce((s, id) => s + ration(st, id), 0), gen = Traits.act(st, host.holder, 'generosity', 'feast');
  // the share binds when the surplus's share is one and a half days' food of those who came
  const E = surplus ?? (1.5 * need) / (FEAST.share * gen);
  host.grain = { barley: keep + E };
  const share = FEAST.share * gen * E, sitting = FEAST.perGuest * need;
  const expected = Math.min(share, sitting);
  assert.ok(surplus ? expected === sitting : expected === share, 'the case binds the bound it means to');
  const before = balance(st, host.holder, guest.holder), guestEat = guest.members.reduce((s, id) => s + ration(st, id), 0);
  const e = hold(st, host, come);
  assert.ok(e, 'a feast above the threshold');
  assert.ok(Math.abs(-e.n - expected) < 1e-9, `served ${-e.n}, the lesser bound ${expected}`);
  assert.ok(e.left >= e.keep && Math.abs(e.keep - keep) < 1e-9, 'the host kept its seed and years of need');
  const ate = come.reduce((s, id) => s + st.pawns[id].feast.n, 0);
  assert.ok(Math.abs(ate + e.n) < 1e-9, 'rations served equal rations eaten');
  assert.ok(come.every((id) => Math.abs(st.pawns[id].feast.n - (expected * ration(st, id)) / need) < 1e-9), 'each by its ration');
  // goodwill: the guest household's holder owes what its members ate; the host's own and the absent household owe nothing
  const owed = balance(st, host.holder, guest.holder) - before;
  assert.ok(Math.abs(owed - (expected * guestEat) / need) < 1e-6, `the guest's holder owes ${owed}, its members ate ${(expected * guestEat) / need}`);
  assert.strictEqual(balance(st, host.holder, other.holder), 0, 'a household that stayed at home owes nothing');
  assert.ok(Math.abs(e.booked - owed) < 1e-6, 'the entry tells what was booked');
  const ev = st.record[st.record.length - 1 - (st.record[st.record.length - 1].kind === 'wedding' ? 1 : 0)];
  assert.ok(ev.kind === 'feast' && ev.pawn === host.holder && ev.farm === host.farmstead && ev.n === Math.round(expected), 'the event');
  assert.deepStrictEqual(checkState(st).filter((x) => /feast/.test(x)), [], 'invariants (the feast)');
  // 3. The guest household's meal is not eaten twice: all its members ate at the feast, so its day's meal takes nothing from its stores
  const grain = S.grainOf(guest), meals = guest.meals, flour = guest.flour;
  H.feedHousehold(st, guest);
  assert.ok(S.grainOf(guest) === grain && guest.meals === meals && guest.flour === flour, 'nothing eaten at home');
  assert.ok(guest.members.every((id) => st.pawns[id].hungerLog[st.pawns[id].hungerLog.length - 1] === 0), 'and each fed full');
  // a day on, it is fed at home again
  st.t += DAY;
  H.feedHousehold(st, guest);
  assert.ok(S.grainOf(guest) + guest.meals + guest.flour < grain + meals + flour, 'the next day it eats at home');
  // one feast a day: a second feast the same day feeds no one who ate at the first
  if (surplus) {
    st.t -= DAY;
    const again = hold(st, host, [...guest.members]);
    assert.strictEqual(again, null, 'one feast a day');
  }
}

// 4. Ale counts in the sitting at its grain, and in what the guests owe.
{
  const st = state(), [host, guest] = live(st);
  const keep = threshold(st, host), come = [...host.members, ...guest.members];
  host.grain = { barley: keep + 100000 };
  S.brew(st, host);
  const need = come.reduce((s, id) => s + ration(st, id), 0), guestEat = guest.members.reduce((s, id) => s + ration(st, id), 0);
  const e = hold(st, host, come, 'funeral');
  const served = FEAST.perGuest * need - BREW.grain;
  assert.ok(e && Math.abs(-e.n - served) < 1e-9, `the sitting less a barrel's grain: ${-e.n}`);
  const owed = balance(st, host.holder, guest.holder);
  assert.ok(Math.abs(owed - ((served * guestEat) / need + (BREW.grain * guest.members.length) / come.length)) < 1e-6, 'its ale too');
}
console.log('feast: ok');

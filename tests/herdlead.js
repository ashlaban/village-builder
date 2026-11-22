// Animals that change household (VB-674, sim/droving): the owner changes where they stand, a member of the new household walks to lead
// them home, and their hay is left lying in the old barn to be fetched; a herd with nobody to have it stays at its farm until the frost.
// On the probe's two villages of two farms (tests/lib/probe.js).
const VB = require('../src/load.js'), Sim = VB.sim, H = VB['sim/herds'], HO = VB['sim/droving'];
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HERDLEAD FAIL:', m); } };
const ok = (st, m) => { const bad = checkState(st); check(!bad.length, `${m}: ${bad.slice(0, 3).join('; ')}`); };
const awayOf = (st, hh) => (st.herdsAway || []).map((id) => st.herds[id]).filter((hd) => hd.household === hh.id);
const heads = (hds) => hds.reduce((n, hd) => n + (hd.head ? hd.head.length : hd.ewes + hd.rams + hd.lambs), 0);
const own = (st, hh) => heads(H.herdsOf(st, hh));
const hayLying = (st, hh) => (st.lying || []).filter((l) => l.kind === 'hay' && l.owner.id === hh.id).reduce((s, l) => s + l.n, 0);
// up to `days` days, until the household's herds standing away are home; the days it took, or -1
const leadHome = (st, hh, days) => {
  for (let d = 0; d < days * 24; d++) { if (!awayOf(st, hh).length) return d / 24; Sim.advance(st, 1); }
  return awayOf(st, hh).length ? -1 : days;
};
const withCattle = (st) => st.households.filter((h) => !h.dissolved && H.herdOf(st, h, 'cattle') && H.herdOf(st, h, 'cattle').head.length);

// --- passHerds: a household's herds go to one of another farm: its own at once, standing where they were, led home by one who walks there
{
  const st = state();
  const [from] = withCattle(st), to = st.households.find((h) => !h.dissolved && h.farmstead !== from.farmstead);
  const n = own(st, from), mine = own(st, to);
  from.hay = 300;
  HO.passHerds(st, from, to.id);
  const away = awayOf(st, to);
  check(heads(away) === n && own(st, to) === mine && !from.herds.length, `passHerds: ${heads(away)} of ${n} standing for the new owner`);
  check(away.every((hd) => hd.at === from.farmstead && !to.herds.includes(hd.id)), 'passHerds: they stand at the old farm, listed by nobody');
  check(Math.abs(hayLying(st, to) * Sim.TRAVEL.hay - 300) < 1e-9 && from.hay === 0, `passHerds: the hay lies in the old barn (${hayLying(st, to)})`);
  ok(st, 'passHerds, standing');
  const days = leadHome(st, to, 4);
  check(days >= 0 && own(st, to) === mine + n, `passHerds: led home in ${days} days, ${own(st, to)} of ${mine + n}`);
  check(!st.herdsAway, 'passHerds: none left standing');
  ok(st, 'passHerds, led home');
}

// --- passHerds to nobody: the herd stays at its farm with no owner; at the frost the farm's household takes it in, or it is lost
{
  const st = state();
  const [from] = withCattle(st), n = own(st, from), f = st.farmsteads[from.farmstead];
  HO.passHerds(st, from, null);
  const left = st.herdsAway.map((id) => st.herds[id]);
  check(heads(left) === n && left.every((hd) => hd.household === null && hd.at === f.id), 'to nobody: the herd stays at its farm, ownerless');
  ok(st, 'to nobody');
  HO.frost(st); // the farm's own household is still there in this test: it takes them in
  check(own(st, from) === n && !st.herdsAway, `to nobody: taken in at the frost by the farm (${own(st, from)})`);
  HO.passHerds(st, from, null);
  const hhId = f.household; f.household = null; // a farm with nobody on it
  HO.frost(st);
  f.household = hhId;
  check(!st.herdsAway && st.herds.every((hd) => hd.household !== null || !heads([hd])), 'to nobody: lost at the frost with nobody on the farm');
}

// --- startHerd and payInAnimals: the animals stand at the giver's farm until led home; the hay above the giver's need lies there
{
  const st = state();
  const [old] = withCattle(st), nw = st.households.find((h) => !h.dissolved && h.farmstead !== old.farmstead && h !== old);
  old.hay = H.winterNeed(st, old) + 500;
  const n0 = own(st, nw), given = HO.startHerd(st, old, nw);
  check(given > 0 && heads(awayOf(st, nw)) === given && own(st, nw) === n0, `start: ${given} given, standing at the old farm`);
  check(hayLying(st, nw) > 0, 'start: their hay left lying for the new household');
  ok(st, 'start, standing');
  const days = leadHome(st, nw, 4);
  check(days >= 0 && own(st, nw) === n0 + given, `start: led home in ${days} days`);
  ok(st, 'start, led home');
  // a share paid in animals
  old.hay = H.winterNeed(st, old) + 500;
  const before = own(st, nw), paid = HO.payInAnimals(st, old, nw, 70);
  check(paid > 0 && own(st, nw) === before && awayOf(st, nw).length > 0, `share: ${paid} rations paid, the animals standing at the payer's`);
  ok(st, 'share, standing');
  // led: the cow of a deal was led home already (sim/exchange's kind `lead`): she is in the herd at once
  const s2 = state(), [o2] = withCattle(s2), n2 = s2.households.find((h) => !h.dissolved && h.farmstead !== o2.farmstead);
  o2.hay = H.winterNeed(s2, o2) + 500;
  const b2 = own(s2, n2), p2 = HO.payInAnimals(s2, o2, n2, 1000, ['cow'], true);
  check(p2 > 0 && own(s2, n2) > b2 && !s2.herdsAway, `led: the cow is home at once (${own(s2, n2) - b2})`);
  ok(s2, 'led');
}

if (failed) process.exit(1);
console.log('herdlead ok: animals that change household stand where they were until led home; their hay lies to be fetched');

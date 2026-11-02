// Claims on empty farms (VB-033, sim/farmclaims) on a tiny world: the hours to restore a farm by its condition; the old family's birthright
// when a farm empties, and its lapse; who may claim an empty farm, and in what order, under each option of the "Claims on empty farms" custom.
const VB = require('../src/load.js'), FC = VB['sim/farmclaims'], CL = VB['sim/claims'], H = VB['sim/heirs'];
const { CLAIMS, YEAR } = VB['sim/rules'], { setPractice, tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FARMCLAIMS FAIL:', m); } };
const ok = (st, label) => { const bad = checkState(st); check(!bad.length, `${label}: invariants: ${bad.slice(0, 2).join('; ')}`); };
const out = [];

// ---- restoration hours: straight lines through 0 h at 100%, 20 h at 40%, 60 h at 15% and 120 h at 0% (Kim, 30 Oct) ----
{
  const want = [[1, 0], [0.9, 10 / 3], [0.4, 20], [0.3, 36], [0.15, 60], [0, 120]];
  for (const [c, h] of want) check(Math.abs(FC.restoreHours(c) - h) < 1e-9, `restoreHours(${c}) = ${FC.restoreHours(c)}, wanted ${h}`);
  out.push('restoration 3.3 h at 90%, 36 h at 30%');
}

// A row of three villages: A (3 farms) and B (2 farms) 11 steps apart, C (1 farm) 33 steps from A. B's second farm (household 4) empties.
// Its last holder's grown children are the old family: Gunhild 19 (married to Jöns 20 of B's other farm), Olof 21, and Brita 23, gone to
// serve in A. B's other villagers: Kerstin 23 and Cecilia 26. Gunnar of A, made 30; Per of C, out of reach. Ids as the tiny world draws them.
function scene(rule) {
  const map = Array.from({ length: 10 }, () => '.'.repeat(44));
  const st = tinyState(tinyWorld(map), [{ at: [5, 5], farms: 3, sizes: [8, 8, 8] }, { at: [16, 5], farms: 2, sizes: [8, 8] }, { at: [38, 5], farms: 1, sizes: [8] }],
    { seed: 4 });
  const P = (given, age, v) => {
    const p = st.pawns.find((q) => q.alive && q.given === given && q.age === age && VB['sim/records'].settlementIdOf(st, q) === v);
    if (!p) throw new Error(`no ${given} ${age} in village ${v}`);
    return p.id;
  };
  const who = { gunhild: P('Gunhild', 19, 1), olof: P('Olof', 21, 1), brita: P('Brita', 23, 1), jons: P('Jöns', 20, 1), kerstin: P('Kerstin', 23, 1),
    cecilia: P('Cecilia', 26, 1), gunnar: P('Gunnar', 19, 0), per: P('Per', 22, 2) };
  const empty = st.households[4], f = st.farmsteads[empty.farmstead], last = empty.holder;
  H.extinct(st, empty);
  const B0 = st.farmsteads[st.villages[1].farmsteads[0]].household, A0 = st.farmsteads[st.villages[0].farmsteads[0]].household;
  for (const id of [who.gunhild, who.olof]) if (st.pawns[id].household !== B0) H.moveTo(st, id, B0);
  H.moveTo(st, who.brita, A0);
  st.unions.push({ id: st.unions.length, a: who.jons, b: who.gunhild, start: st.t, end: null, kind: 'marriage' });
  st.pawns[who.gunnar].born -= 11 * YEAR; st.pawns[who.gunnar].age = 30;
  if (rule) setPractice(st, 1, { claims: rule });
  st.demand = Object.values(who).concat(st.households[B0].holder); // a holder among them, who may not claim
  return { st, f, last, who };
}
const names = (st, ids) => ids.map((id) => st.pawns[id].given).join(', ');

// ---- the birthright: the last holder's family holds a realised claim on the house for 20 years ----
{
  const { st, f, last } = scene('kin');
  const c = FC.birthrightOn(st, f);
  check(c && c.state === 'realised' && c.by.type === 'pawn' && c.by.id === last && c.until === st.t + CLAIMS.birthrightYears * YEAR,
    `a birthright by the last holder until 20 years on: ${JSON.stringify(c)}`);
  check(f.state === 'derelict' && FC.claimable(f), 'the empty farm may be claimed');
  ok(st, 'birthright');
  st.t += CLAIMS.birthrightYears * YEAR - 1; CL.lapseClaims(st);
  check(FC.birthrightOn(st, f), 'still standing just before 20 years');
  st.t += 1; CL.lapseClaims(st);
  check(!FC.birthrightOn(st, f), 'lapsed after 20 years');
  f.state = 'ruin';
  check(!FC.claimable(f), 'a ruin is left out of claims until the full rebuild');
  out.push('a birthright for 20 years');
}

// ---- the order under each custom ----
const orders = {};
for (const rule of ['kin', 'villagers', 'anyone', 'assembly']) {
  const { st, f, who } = scene(rule);
  if (rule === 'assembly') for (const p of st.cenv.settlements[1].members()) { p.ties.clear(); if (p.id !== who.olof) p.ties.set(who.olof, 1); }
  const list = FC.claimants(st, f);
  orders[rule] = names(st, list);
  const w = who, want = {
    // kin of the old family first (Brita from A too), the married one first; then B's villagers, oldest first; not Gunnar or Per
    kin: [w.gunhild, w.brita, w.olof, w.cecilia, w.kerstin],
    // B's villagers (the couple first, as Jöns, the older), then those of a village within reach (Brita in A, Gunnar of A), oldest first
    villagers: [w.jons, w.cecilia, w.kerstin, w.olof, w.gunnar, w.brita],
    // anyone within reach: the couple, then by age (Brita a few months older than Kerstin)
    anyone: [w.jons, w.gunnar, w.cecilia, w.brita, w.kerstin, w.olof],
    // the meeting: its own villagers, Olof with its voices behind him first
    assembly: [w.olof, w.jons, w.cecilia, w.kerstin],
  }[rule];
  check(names(st, list) === names(st, want), `${rule}: ${names(st, list)}; wanted ${names(st, want)}`);
  ok(st, rule);
}
// once the birthright lapses, `kin` puts no family first: the farm is open to the villagers
{
  const { st, f, who } = scene('kin');
  st.t += CLAIMS.birthrightYears * YEAR; CL.lapseClaims(st);
  const list = FC.claimants(st, f);
  check(names(st, list) === names(st, [who.jons, who.cecilia, who.kerstin, who.olof]), `kin, lapsed: ${names(st, list)}`);
}
out.push(`orders: ${Object.entries(orders).map(([k, v]) => `${k} ${v}`).join('; ')}`);
if (failed) process.exit(1);
console.log(`farmclaims ok: ${out.join('; ')}`);

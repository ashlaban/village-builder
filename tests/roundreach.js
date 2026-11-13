// VB-290: the round's other acts read the walking hours between villages (sim/routes, hoursBetween), not hex steps: an orphan's service
// home in the nearest village by walking hours (by hex steps only with none in reach), a guardian within walking reach first, service within
// SERVICE.hours, and the tie to the culture's centre as exp(-h / TIE.hours) (TIE.sea times the hex steps over SPEED beyond reach), with
// no search of its own. Claims on empty farms are checked in tests/farmclaims.js.
const assert = require('assert'), VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const { SERVICE, TIE, SPEED } = VB['sim/rules'], { hexSteps } = VB['sim/hex'], { hoursBetween } = VB['sim/routes'];
const H = VB['sim/heirs'], S = VB['sim/service'], R = VB['sim/records'], Soc = VB['sim/society'];
const out = [];
// A (one farm) on the west, B 14 tiles east of it, C 40 tiles east: by hex steps B is the nearer, and the table is set by hand per case
const rows = Array.from({ length: 12 }, () => '.'.repeat(60));
const fresh = () => {
  const st = tinyState(tinyWorld(rows), [{ at: [5, 5], farms: 1 }, { at: [19, 5], farms: 2 }, { at: [45, 5], farms: 2 }], { seed: 3 });
  st.naturalDeaths = false;
  return st;
};
const set = (st, a, b, h) => { st.villageHours[a][b] = h; st.villageHours[b][a] = h; };
const vOf = (st, p) => R.settlementIdOf(st, p);
const hhOfVillage = (st, v) => st.households.filter((h) => !h.dissolved && st.farmsteads[h.farmstead].village === v);

// ---- an orphan's service home: the nearest village by walking hours; by hex steps only when none is in reach ----
for (const [label, hb, hc, want] of [['C nearer by hours', 5, 2, 2], ['B nearer by hours', 2, 5, 1], ['none in reach: by hex steps', null, null, 1]]) {
  const st = fresh(), hh = hhOfVillage(st, 0)[0];
  assert(hexSteps(st.w, st.villages[0].center, st.villages[1].center) < hexSteps(st.w, st.villages[0].center, st.villages[2].center));
  set(st, 0, 1, hb); set(st, 0, 2, hc);
  const people = [...hh.members];
  // nobody of A has kin outside it (the tiny world draws unrelated households), so each goes into service
  for (const id of people) assert(!st.living.some((q) => st.pawns[q].household !== hh.id && R.kinship(st, id, q) > 0), 'setup: no kin outside A');
  H.extinct(st, hh, 'a test');
  H.refreshRoles(st);
  const at = people.filter((id) => st.pawns[id].alive).map((id) => vOf(st, st.pawns[id]));
  assert(at.length && at.every((v) => v === want), `${label}: they go to village ${want} (${at})`);
  assert.deepStrictEqual(checkState(st), [], `${label}: invariants`);
}
out.push('service home by hours, by hex steps with none in reach');

// ---- a guardian: the first kin by today's order (kinship, then the oldest) among those within walking reach, else as today ----
{
  // B's first farm: its two grown members (the children's parents) leave, the elder for C, the younger for B's other farm, and the eldest
  // child holds alone (as in tests/guardians.js); by today's order the elder comes back as guardian
  const run = (reach) => {
    const st = fresh(), hh = hhOfVillage(st, 1)[0];
    const adults = hh.members.filter((id) => st.pawns[id].age >= 18).sort((x, y) => st.pawns[x].born - st.pawns[y].born);
    assert(adults.length === 2 && hh.members.length > 2, 'setup: a couple with children in B');
    H.moveTo(st, adults[0], hhOfVillage(st, 2)[0].id);
    H.moveTo(st, adults[1], hhOfVillage(st, 1)[1].id);
    H.transfer(st, hh, [...hh.members].sort((x, y) => st.pawns[x].born - st.pawns[y].born)[0], 'death');
    st.demand = [...adults];
    if (!reach) set(st, 1, 2, null);
    S.careForOrphans(st);
    assert.deepStrictEqual(checkState(st), [], 'guardian: invariants');
    return { guardian: hh.guardian, adults };
  };
  const a = run(true), b = run(false);
  assert.strictEqual(a.guardian, a.adults[0], 'C in reach: the elder, from C, as today');
  assert.strictEqual(b.guardian, b.adults[1], 'C out of reach: the younger, from B');
  out.push('guardian from C in reach, from B with C out of reach');
}

// ---- service: a servant's village within SERVICE.hours of the holder's ----
{
  const run = (h) => {
    const st = fresh(), lone = hhOfVillage(st, 1)[0], o = hhOfVillage(st, 2)[0];
    const q = o.members.map((id) => st.pawns[id]).find((p) => S.unfit(st, p) === null && p.id !== o.holder);
    if (!q || S.handsLeft(st, q) < SERVICE.keepHands) return null;
    for (const id of lone.members.filter((m) => m !== lone.holder)) H.moveTo(st, id, hhOfVillage(st, 1)[1].id);
    for (const hh of [...hhOfVillage(st, 1), ...hhOfVillage(st, 0)]) if (hh !== lone) for (const id of hh.members) if (S.unfit(st,
      st.pawns[id]) === null) st.pawns[id].retired = true;
    set(st, 1, 2, h);
    st.demand = [q.id];
    S.takeServants(st);
    return q.household === lone.id;
  };
  const yes = run(SERVICE.hours), no = run(SERVICE.hours + 0.5);
  assert(yes !== null, 'setup: a servant to spare in C');
  assert(yes, `a servant from a village ${SERVICE.hours} h away`);
  assert(!no, `none from a village ${SERVICE.hours + 0.5} h away`);
  out.push(`service within ${SERVICE.hours} h, none beyond`);
}

// ---- the tie to the culture's centre: exp(-h / TIE.hours) from the table; beyond reach TIE.sea times the hex steps, in hours ----
{
  const st = fresh();
  set(st, 0, 1, 4); set(st, 0, 2, null);
  Soc.updateTies(st);
  const [, b, c] = st.cenv.settlements, kin = (s) => Math.min(0.3, s.kinLinks * 0.04);
  assert.strictEqual(b.distance, 4, 'B: the hours from the table');
  assert(Math.abs(b.tie - Math.min(1, Math.exp(-4 / TIE.hours) + kin(b))) < 1e-12, `B's tie ${b.tie}`);
  const d = (hexSteps(st.w, st.villages[2].center, st.villages[0].center) * TIE.sea) / SPEED;
  assert(Math.abs(c.distance - d) < 1e-12 && Math.abs(c.tie - Math.min(1, Math.exp(-d / TIE.hours) + kin(c))) < 1e-12, `C beyond reach: ${c.distance} h`);
  assert.strictEqual(hoursBetween(st, 0, 2), Infinity);
  out.push(`ties ${b.tie.toFixed(2)} at 4 h, ${c.tie.toFixed(2)} beyond reach (${d.toFixed(1)} h)`);
}
console.log(`roundreach ok: ${out.join('; ')}`);

// Service where labour is short (VB-090; design.md, Leaving home: Service): at the moving round, an unmarried landless adult from a household
// with hands to spare (over 1.5 hands per field) goes as a servant to the household of the village with the fewest hands per field, if short
// (under 1); one new servant a household a round; nobody goes back to a parent's home by this rule.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], S = VB['sim/service'];
const { YEAR, SERVICE } = VB['sim/rules'], { moveTo, countDemand } = VB['sim/heirs'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('LABOUR FAIL:', m); } };
const world = (() => { const it = G.generate(3, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; })();
const fresh = () => { const st = Sim.seed(world, 3, 'populous'); st.naturalDeaths = false; return st; };
const vOf = (st, h) => st.farmsteads[h.farmstead].village;
const setAge = (st, p, years) => { p.born = st.t - years * YEAR - 1; p.age = years; };
// The case: in one village, a household of 2 old holders with 4 fields (A) and a household with 4 grown, unmarried, landless children and 2
// fields (B); A's other members go to a third household C of another village.
function labourCase(st) {
  for (const a of st.households) {
    const fa = st.farmsteads[a.farmstead]; if (fa.fields.length < 4) continue;
    const sp = R.spouseOf(st, a.holder); if (sp === null || st.pawns[sp].household !== a.id) continue;
    for (const b of st.households) {
      if (b === a || vOf(st, b) !== vOf(st, a) || st.farmsteads[b.farmstead].fields.length < 2) continue;
      const kids = b.members.filter((id) => st.pawns[id].father === b.holder); if (kids.length < 4) continue;
      const c = st.households.find((h) => vOf(st, h) !== vOf(st, a)); if (!c) continue;
      for (const id of a.members.filter((m) => m !== a.holder && m !== sp)) moveTo(st, id, c.id);
      setAge(st, st.pawns[a.holder], 66); setAge(st, st.pawns[sp], 63);
      st.farmsteads[b.farmstead].fields.length = 2; // B farms 2 fields
      const four = kids.slice(0, 4).map((id) => st.pawns[id]);
      four.forEach((p, k) => setAge(st, p, 26 - 2 * k));
      for (const id of b.members.filter((m) => !kids.slice(0, 4).includes(m) && m !== b.holder && R.spouseOf(st, b.holder) !== m)) moveTo(st, id, c.id);
      VB['sim/heirs'].refreshRoles(st);
      return { a, b, c, four, holder: st.pawns[a.holder] };
    }
  }
  return null;
}
const round = (st) => S.serveWhereShort(st, S.takeServants(st)); // the moving round's service phase
let report = '';
// 1. After the moving round one child serves at the old couple's farm, the oldest of those who want land; A takes only one.
{
  const st = fresh(), c = labourCase(st);
  if (!c) { console.error('LABOUR FAIL: no case of an old couple and a household of four grown children'); process.exit(1); }
  check(S.handsPerField(st, c.a) === 0 && S.handsPerField(st, c.b) > SERVICE.spare, `setup: A short (${S.handsPerField(st, c.a)}), B to spare (${S.handsPerField(st, c.b)})`);
  countDemand(st);
  const wanting = c.four.filter((p) => st.demand.includes(p.id));
  check(wanting.length >= 2, `setup: children who want land (${wanting.length})`);
  VB.resetCounts();
  round(st);
  const atA = c.four.filter((p) => p.household === c.a.id);
  check(atA.length === 1, `one child serves at the old couple's farm (${atA.length})`);
  const s = atA[0];
  if (s) {
    check(s === wanting[0], 'the oldest of those who want land goes');
    check(s.servant && ['farmhand', 'maid'].includes(s.role), `as farmhand or maid (${s.role})`);
    check(st.demand.includes(s.id), 'and still wants land');
    const farm = st.farmsteads[c.a.farmstead].name;
    check(Sim.recordOf(st, { pawn: s.id, life: true }).some((e) => e.kind === 'service' && e.text.includes(farm)), 'an event names the farm');
    report = `${R.fullName(s)} went into service at ${farm}`;
  }
  check(VB.count.labourWeighed > 0, 'the search is counted (labourWeighed)');
  check(S.hands(st, c.b) / 2 >= SERVICE.short, 'B keeps a hand per field');
  const others = c.four.filter((p) => p.household !== c.b.id && p.household !== c.a.id);
  // the village first, then the nearest village within SERVICE.reach steps (sim/service): where no farm of the village is short, one
  // goes to a farm of a neighbouring village (as at this seed since the villages were laid out anew, VB-402)
  const near = (p) => VB['sim/hex'].hexSteps(st.w, st.villages[vOf(st, st.households[p.household])].center, st.villages[vOf(st, c.a)].center);
  for (const p of others) check(p.servant && near(p) <= SERVICE.reach, `any other who went serves within reach (${near(p)} steps)`);
  report += `; ${others.length} more went to other short farms of the village`;
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
  // 2. The servant does not move again while the old couple's farm is still short; at a later round, with the farm no longer short (two
  // grown hands come home to it), the servant may go on, but never back to the parents' farm.
  if (s) {
    round(st);
    check(s.household === c.a.id, 'the servant stays while the farm is short');
    st.farmsteads[c.a.farmstead].fields.length = 1;
    for (const p of [...c.c.members].filter((id) => st.pawns[id].age >= 14 && st.pawns[id].age < 60).slice(0, 2)) moveTo(st, p, c.a.id);
    st.demand = [s.id];
    const before = s.household;
    round(st);
    check(s.household !== c.b.id, 'the servant never goes back home by this rule');
    if (s.household !== before) check(S.handsPerField(st, st.households[s.household]) <= SERVICE.short, 'and goes on to a farm that was short');
    report += `; at a later round with the farm no longer short, the servant ${s.household === before ? 'stays (no short farm in reach)' : 'went on'}`;
  }
}
// 3. Nobody leaves a household at or under 1.5 hands per field: with children moved away until B is down to it, the one left stays.
{
  const st = fresh(), c = labourCase(st);
  let k = 0; while (S.handsPerField(st, c.b) > SERVICE.spare && k < 3) moveTo(st, c.four[k++].id, c.c.id);
  const left = c.four.slice(k);
  check(S.handsPerField(st, c.b) <= SERVICE.spare && left.length > 0, `setup: B at ${S.handsPerField(st, c.b)} hands per field keeps a child`);
  st.demand = left.map((p) => p.id);
  round(st);
  check(left.every((p) => p.household === c.b.id), 'the children of a household with no hands to spare stay');
}
// 4. The full moving round (Sim.movingRound) runs the rule: the old couple's farm takes a servant.
{
  const st = fresh(), c = labourCase(st);
  Sim.movingRound(st);
  check(c.a.members.some((id) => st.pawns[id].servant), 'after the moving round the old couple has a servant');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
if (failed) process.exit(1);
console.log(`labour ok: ${report}`);

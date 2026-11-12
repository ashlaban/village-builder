// Taken in before it starves (VB-308; design.md, Households short of people): a household of at most one grown member, with fields, whose
// seasonal ask for food falls short takes in its nearest free relative from st.demand (kin first), else a servant, at once; land is unchanged.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], S = VB['sim/service'], H = VB['sim/help'];
const { seedReserve } = VB['sim/hunger'], { SERVICE } = VB['sim/rules'], { moveTo } = VB['sim/heirs'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('TAKENIN FAIL:', m); } };
const world = (() => { const it = G.generate(7, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; })();
const fresh = () => { const st = Sim.seed(world, 7, 'heirs'); st.naturalDeaths = false; return st; };
const vOf = (st, h) => st.farmsteads[h.farmstead].village;
const grown = (st, h) => h.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18);
// The case: a holder with 3 fields or more (A), and a household of its village (C) holding an unmarried landless woman of serving age (the
// sister) and a grown man besides its holder (the brother at home); A's holder is made their parents' child, and A's other members leave.
function loneCase(st) {
  for (const a of st.households) {
    if (st.farmsteads[a.farmstead].fields.length < 3) continue;
    for (const c of st.households) {
      if (c === a || vOf(st, c) !== vOf(st, a) || c.holder === null) continue;
      const people = c.members.map((id) => st.pawns[id]);
      const sister = people.find((p) => p.sex === 'f' && p.age >= SERVICE.ages[0] && p.age <= SERVICE.ages[1] && S.unfit(st, p) === null);
      const brother = sister && people.find((p) => p !== sister && p.sex === 'm' && p.age >= 18 && p.id !== c.holder);
      if (!brother) continue;
      const away = st.households.find((h) => h !== a && h !== c && !h.dissolved);
      for (const id of a.members.filter((m) => m !== a.holder)) moveTo(st, id, away.id);
      const h = st.pawns[a.holder]; h.father = sister.father; h.mother = sister.mother;
      return { a, c, sister, brother, holder: h };
    }
  }
  return null;
}
// Empty larders everywhere and an empty village store, so the ask falls short.
const starve = (st) => { for (const hh of st.households) { if (!hh.dissolved) hh.grain = { barley: seedReserve(st, hh) }; hh.meals = 0; } for (const v of st.villages) v.grain = {}; };
let report = '';
// 1. Kin first: after the first short ask, the sister lives on the farm, as a member; holder, fields and owner unchanged.
{
  const st = fresh(), c = loneCase(st);
  if (!c) { console.error('TAKENIN FAIL: no case of a lone holder with a sister at her parents\' farm'); process.exit(1); }
  check(c.a.members.length === 1 && c.holder.father !== null && R.kinship(st, c.holder.id, c.sister.id) > 0, 'setup: a lone holder, kin of the sister');
  const f = st.farmsteads[c.a.farmstead], fields0 = f.fields.length, owner0 = JSON.stringify(f.owner ?? null), holder0 = c.a.holder;
  starve(st); st.demand = [c.sister.id]; VB.resetCounts();
  for (let d = 0; d < 3 && c.a.askedIn === undefined; d++) Sim.advance(st, Sim.DAY);
  check(c.a.askedIn !== undefined, 'the lone holder asked for help');
  check(c.sister.household === c.a.id && !c.sister.servant, `the sister lives on the farm as a member (household ${c.sister.household})`);
  check(c.brother.household === c.c.id, 'the brother stays at home');
  check(VB.count.takeInWeighed > 0, 'the search is counted (takeInWeighed)');
  check(c.a.holder === holder0 && f.fields.length === fields0 && JSON.stringify(f.owner ?? null) === owner0 && f.household === c.a.id,
    'holder, fields and owner unchanged');
  check(Sim.recordOf(st, { pawn: c.sister.id, life: true }).some((e) => e.kind === 'moved' && e.text.includes(f.name)), 'an event names the farm');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
  report = `${R.fullName(c.sister)} moved to ${f.name} to help ${R.fullName(c.holder)}`;
}
// 2. No relative in demand (the holder made kinless): the same woman comes as a servant instead, at once, through the serve command.
{
  const st = fresh(), c = loneCase(st);
  c.holder.father = null; c.holder.mother = null;
  starve(st); st.demand = [c.sister.id];
  const short = H.shareFood(st);
  check(short.includes(c.a.id), 'the lone holder is named short of people');
  check(R.kinship(st, c.holder.id, c.sister.id) === 0 && S.handsLeft(st, c.sister) >= SERVICE.keepHands, 'setup: no kin, a servant to spare');
  S.takeIn(st, short);
  check(c.sister.household === c.a.id && c.sister.servant, 'with no relative, a servant comes at once');
  check(Sim.recordOf(st, { pawn: c.sister.id, life: true }).some((e) => e.kind === 'service'), 'a service event');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
// 3. A household of two grown members is not short of people, and nobody comes.
{
  const st = fresh(), c = loneCase(st);
  moveTo(st, c.brother.id, c.a.id);
  starve(st); st.demand = [c.sister.id];
  const short = H.shareFood(st);
  check(!short.includes(c.a.id), 'two grown members: not short of people');
  S.takeIn(st, [c.a.id]);
  check(c.sister.household === c.c.id, 'the sister stays');
}
// 4. Kin never leave their own household short of people: with only the sister and one other grown member at home, she stays.
{
  const st = fresh(), c = loneCase(st);
  const other = st.households.find((h) => h !== c.a && h !== c.c && !h.dissolved);
  for (const id of grown(st, c.c).filter((m) => m !== c.sister.id && m !== c.c.holder)) moveTo(st, id, other.id);
  check(grown(st, c.c).length === 2, `setup: two grown at the sister's home (${grown(st, c.c).length})`);
  starve(st); st.demand = [c.sister.id];
  S.takeIn(st, H.shareFood(st));
  check(c.sister.household === c.c.id, 'the sister stays: her home would be left short of people');
}
if (failed) process.exit(1);
console.log(`takenin ok: ${report}`);

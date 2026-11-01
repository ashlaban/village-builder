// Households short of people (sim/service; stability review): a minor heir left with no adult in the house takes in a landless adult relative
// as guardian, or, with none, the children go to their kin and the farm stands empty; a holder who lives alone takes in an unmarried landless
// adult as servant, but never one whose household would be left with fewer than SERVICE.keepHands working hands.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, R = VB['sim/records'], S = VB['sim/service'], { SERVICE } = VB['sim/rules'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('GUARDIANS FAIL:', m); } };
const world = (seed) => { const it = G.generate(seed, { cols: 120, rows: 85 }); let r; while (!(r = it.next()).done); return r.value; };
const fresh = () => { const st = Sim.seed(world(7), 7, 'heirs'); st.naturalDeaths = false; return st; };
const adultsOf = (st, hh) => hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18);
// A household with minor children of its holder, and an unmarried adult relative of theirs with no farm in another household of 3 or more.
function orphanCase(st) {
  const memo = new Map();
  for (const hh of st.households) {
    const h = st.pawns[hh.holder], kids = hh.members.filter((id) => st.pawns[id].age < 18 && R.childrenOf(st, h.id).includes(id));
    if (!kids.length) continue;
    const sib = st.pawns.find((q) => q.alive && q.age >= 18 && q.household !== null && q.household !== hh.id && !R.isHolder(st, q.id)
      && R.spouseOf(st, q.id) === null && st.households[q.household].members.length > 2 && R.kinship(st, kids[0], q.id, memo) > 0);
    if (sib) return { hh, kids, sib };
  }
  return null;
}
// The children left alone with the farm: the adults move to another household and the eldest child holds (as when every grown heir in line
// is gone; sim/heirs heirFor prefers a grown heir when the house has no adult to be guardian).
const orphan = (st, hh) => {
  const away = st.households.find((h) => h !== hh && !h.dissolved);
  for (const id of adultsOf(st, hh)) VB['sim/heirs'].moveTo(st, id, away.id);
  const kid = [...hh.members].sort((a, b) => st.pawns[a].born - st.pawns[b].born)[0];
  VB['sim/heirs'].transfer(st, hh, kid, 'death');
};
let report = '';
// 1. The children's landless adult relative moves in as guardian of the heir.
{
  const st = fresh(), c = orphanCase(st);
  if (!c) { console.error('GUARDIANS FAIL: no household with a landless adult relative of its children'); process.exit(1); }
  orphan(st, c.hh); st.demand = [c.sib.id];
  check(!adultsOf(st, c.hh).length && c.hh.members.length && R.isHolder(st, c.hh.holder) && st.pawns[c.hh.holder].age < 18, 'setup: a minor heir alone');
  S.careForOrphans(st);
  check(c.sib.household === c.hh.id && c.hh.guardian === c.sib.id && c.hh.ward === c.hh.holder, `the relative is guardian (${c.hh.guardian})`);
  check(c.sib.events.some((e) => e.kind === 'guardian'), 'a life event says so');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
  report = `${R.fullName(c.sib)} came as guardian of ${c.kids.length} at ${st.farmsteads[c.hh.farmstead].name}`;
}
// 2. No landless relative: the children go to their kin or into service, and the farm stands empty.
{
  const st = fresh(), c = orphanCase(st);
  orphan(st, c.hh); st.demand = [];
  const kids = [...c.hh.members];
  S.careForOrphans(st);
  check(c.hh.dissolved && st.farmsteads[c.hh.farmstead].state === 'derelict', 'the farm stands empty');
  check(kids.every((id) => st.pawns[id].household !== null && st.pawns[id].household !== c.hh.id && !st.households[st.pawns[id].household].dissolved),
    'every child has a new home');
  check(!st.households.some((h) => !h.dissolved && h.members.length && !adultsOf(st, h).length), 'no household is left without an adult');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
// 3. A holder left alone takes in an unmarried landless adult of the village, from a household that keeps enough hands.
function loneCase(st) {
  const vOf = (h) => st.farmsteads[h.farmstead].village;
  for (const hh of st.households) {
    const v = vOf(hh), others = st.households.filter((o) => o !== hh && vOf(o) === v);
    for (const o of others) {
      const q = o.members.map((id) => st.pawns[id]).find((p) => p.age >= SERVICE.ages[0] && p.age <= SERVICE.ages[1] && !R.isHolder(st, p.id)
        && R.spouseOf(st, p.id) === null && p.id !== o.holder);
      if (q && S.hands(st, o) - 1 >= SERVICE.keepHands) return { hh, o, q };
    }
  }
  return null;
}
{
  const st = fresh(), c = loneCase(st);
  if (!c) { console.error('GUARDIANS FAIL: no lone-holder case'); process.exit(1); }
  for (const id of c.hh.members.filter((m) => m !== c.hh.holder)) VB['sim/heirs'].moveTo(st, id, c.o.id); // the others leave
  check(c.hh.members.length === 1, 'setup: the holder lives alone');
  st.demand = [c.q.id];
  S.takeServants(st);
  check(c.q.household === c.hh.id && c.q.servant && ['farmhand', 'maid'].includes(c.q.role), `the landless adult serves (${c.q.role})`);
  check(st.demand.includes(c.q.id), 'and still wants land');
  const bad = checkState(st); check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
  report += `; ${R.fullName(c.q)} went into service at ${st.farmsteads[c.hh.farmstead].name}`;
}
// 4. Not from a household that would keep fewer than SERVICE.keepHands working hands.
{
  const st = fresh(), c = loneCase(st);
  for (const id of c.hh.members.filter((m) => m !== c.hh.holder)) VB['sim/heirs'].moveTo(st, id, c.o.id);
  for (const id of c.o.members.filter((m) => m !== c.q.id && m !== c.o.holder)) VB['sim/heirs'].moveTo(st, id, st.households.find((h) => h !== c.hh && h !== c.o).id);
  st.demand = [c.q.id];
  S.takeServants(st);
  check(c.q.household === c.o.id && !c.q.servant, `a household of ${c.o.members.length} keeps its adult`);
}
if (failed) process.exit(1);
console.log(`guardians ok: ${report}`);

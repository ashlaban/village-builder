// The record indexes (children, spouse, holders, settlement members) agree with a full scan after 10 founders years and 3 populous years.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
let failed = 0, n = 0; const check = (ok, m) => { n++; if (!ok) { failed++; if (failed < 20) console.error('INDEXES FAIL:', m); } };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function compare(st, label) {
  for (const p of st.pawns) {
    const id = p.id;
    check(same(Sim.childrenOf(st, id), st.pawns.filter((q) => q.father === id || q.mother === id).map((q) => q.id)), `${label}: children of ${id}`);
    check(same(Sim.siblingsOf(st, id), p.father === null && p.mother === null ? [] : st.pawns.filter((q) => q.id !== id
      && ((p.father !== null && q.father === p.father) || (p.mother !== null && q.mother === p.mother))).map((q) => q.id)), `${label}: siblings of ${id}`);
    const u = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= st.t && (u.end === null || u.end > st.t));
    check(Sim.spouseOf(st, id) === (u ? (u.a === id ? u.b : u.a) : null), `${label}: spouse of ${id}`);
    const current = st.unions.find((u) => (u.a === id || u.b === id) && u.start <= st.t && u.end === null) || null;
    check(VB['sim/records'].unionOf(st, id) === current, `${label}: current union of ${id}`);
    check(VB['sim/records'].wasWidowed(st, id) === st.unions.some((u) => (u.a === id || u.b === id) && u.end !== null),
      `${label}: widow history of ${id}`);
    const h = st.households.find((h) => !h.dissolved && h.holder === id) || null;
    check(Sim.holdingOf(st, id) === h && Sim.isHolder(st, id) === !!h, `${label}: holding of ${id}`);
  }
  if (!st.cenv) return;
  for (const s of st.cenv.settlements) {
    check(same(Sim.membersOf(st, s.id).map((p) => p.id), st.pawns.filter((p) => p.alive && Sim.settlementIdOf(st, p) === s.id).map((p) => p.id)), `${label}: members of ${s.id}`);
  }
}
function run(scenario, size, years) {
  const it = G.generate(7, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, scenario); compare(st, `${scenario} seed`);
  for (let y = 1; y <= years; y++) { Sim.advance(st, Sim.YEAR); compare(st, `${scenario} year ${y}`); }
}
if (process.argv.includes('--extended')) {
  run('founders', [120, 85], 10); run('populous', [180, 130], 3); run('heirs', [120, 85], 5);
} else {
  const st = require('./lib/probe.js').state(), R = VB['sim/records'];
  compare(st, 'seeded'); // warm the indexes before each mutation
  const names = R.nameKit(() => 0.5), context = { ...names, pawns: st.pawns, unions: st.unions, living: st.living };
  const father = R.person(context, { sex: 'm', age: 25 }), mother = R.person(context, { sex: 'f', age: 25 });
  R.marry(st, father, mother, 0);
  compare(st, 'married');
  R.person(context, { sex: 'f', age: 0, father, mother });
  R.person(context, { sex: 'm', age: 0, father, mother });
  compare(st, 'children appended');
  const u = st.unions.at(-1); u.end = st.t; R.noteUnionEnd(st, u);
  compare(st, 'union ended');
  const mover = st.households[0].members.find((id) => id !== st.households[0].holder);
  R.leaveHousehold(st, mover); R.joinHousehold(st, st.households.at(-1), mover);
  compare(st, 'household moved');
  const h = st.households[0]; h.holder = h.members.find((id) => id !== h.holder); R.noteHolder(st, h);
  compare(st, 'holder changed');
}
if (failed) { console.error(`${failed} of ${n} checks failed`); process.exit(1); }
console.log(`indexes ok: ${n} checks`);

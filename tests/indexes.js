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
    const h = st.households.find((h) => !h.dissolved && h.holder === id) || null;
    check(Sim.holdingOf(st, id) === h && Sim.isHolder(st, id) === !!h, `${label}: holding of ${id}`);
  }
  if (!st.cenv) return;
  for (const s of st.cenv.settlements) {
    check(same(s.members().map((p) => p.id), st.pawns.filter((p) => p.alive && Sim.settlementIdOf(st, p) === s.id).map((p) => p.id)), `${label}: members of ${s.id}`);
  }
}
function run(scenario, size, years) {
  const it = G.generate(7, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done);
  const st = Sim.seed(r.value, 7, scenario); compare(st, `${scenario} seed`);
  for (let y = 1; y <= years; y++) { Sim.advance(st, Sim.YEAR); compare(st, `${scenario} year ${y}`); }
}
run('founders', [120, 85], 10); run('populous', [180, 130], 3); run('heirs', [120, 85], 5);
if (failed) { console.error(`${failed} of ${n} checks failed`); process.exit(1); }
console.log(`indexes ok: ${n} checks`);

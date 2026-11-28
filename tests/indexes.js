// @suite fast
// @suite integration --integration
// The record indexes (children, spouse, holders, settlement members) agree with a full scan: after each mutation of the record on the probe
// village (npm test), and with --integration (verify, VB-853) every season of each scenario's runs on small generated islands, through births,
// deaths, marriages and households that end; these replaced the runs of years on the tiny and medium maps (--extended), deleted.
const VB = require('../src/load.js'), Sim = VB.sim, probe = require('./lib/probe.js');
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
const seen = { born: 0, died: 0, ended: 0, dissolved: 0 };
function run(scenario, seasons) {
  const st = probe.scenario(scenario, 7); compare(st, `${scenario} seed`);
  const before = { born: st.pawns.length, died: st.pawns.filter((p) => !p.alive).length, ended: st.unions.filter((u) => u.end !== null).length,
    dissolved: st.households.filter((h) => h.dissolved).length };
  for (let k = 1; k <= seasons; k++) { Sim.advance(st, Sim.YEAR / 4); compare(st, `${scenario} season ${k}`); }
  seen.born += st.pawns.length - before.born; seen.died += st.pawns.filter((p) => !p.alive).length - before.died;
  seen.ended += st.unions.filter((u) => u.end !== null).length - before.ended;
  seen.dissolved += st.households.filter((h) => h.dissolved).length - before.dissolved;
  return st;
}
if (process.argv.includes('--integration')) {
  run('founders', 4); run('heirs', 2);
  const st = run('populous', 1);
  // deaths the short runs may not bring, through the simulation's own: a holder dies (a widow, an heir takes the holding), and every
  // member of another household dies, the holder last (the household ends, its farm goes empty)
  const [a, b] = st.households.filter((h) => !h.dissolved && h.members.length > 1 && Sim.spouseOf(st, h.holder) !== null);
  const dead = [a.holder, ...b.members.filter((id) => id !== b.holder), b.holder], widow = Sim.spouseOf(st, a.holder);
  for (const id of dead) { Sim.killPawn(st, id); compare(st, `populous: ${id} died`); }
  Sim.advance(st, 2 * Sim.DAY); compare(st, 'populous: two days after the deaths');
  check(VB['sim/records'].wasWidowed(st, widow) && a.holder !== dead[0] && b.dissolved, `the deaths: widowed ${widow}, holder ${a.holder
    } after ${dead[0]}, the household ${b.id} ${b.dissolved ? 'ended' : 'stands'}`);
  console.log(`indexes: in the runs ${seen.born} born, ${seen.died} died, ${seen.ended} unions ended, ${seen.dissolved} households ended; `
    + `then ${dead.length} deaths by hand, a holding passed on and a household ended`);
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

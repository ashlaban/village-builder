const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const seed = +(process.argv[2] || 7);
const it = G.generate(seed); let r; while (!(r = it.next()).done); const w = r.value;
const st = Sim.seed(w, seed, 'heirs');
const nm = (id) => Sim.fullName(st.pawns[id]);
const show = (title) => {
  console.log(`\n== ${title} (year ${Sim.cal(st.t).year})`);
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    const f = st.farmsteads[hh.farmstead], v = st.villages[f.village].name, rank = Sim.heirRanking(st, hh).slice(0, 3).map(nm).join(' > ');
    console.log(`  ${v}/${f.name}: holder ${nm(hh.holder)}; members ${hh.members.map((m) => `${st.pawns[m].given} ${st.pawns[m].age} ${st.pawns[m].role}`).join(', ')}\n      heirs: ${rank || 'none'}`);
  }
  for (const f of st.farmsteads) if (f.household === null) console.log(`  ${st.villages[f.village].name}/${f.name}: ${f.state}, condition ${(f.condition * 100).toFixed(0)}%, fields ${f.fields[0].stage}`);
  console.log('  wants out:', st.demand.map(nm).join(', ') || '(not counted yet)');
  for (const s of st.cenv.settlements) console.log(`  ${s.name}: tie ${s.tie.toFixed(2)} (distance ${s.distance ? s.distance.toFixed(0) : 0}, kin links ${s.kinLinks || 0}), heirSex ${Sim.practice(st, s.id).heirSex}, handover ${Sim.practice(st, s.id).handover}, claims ${Sim.practice(st, s.id).claims}`);
};
show('start');
console.log('  kinship Jon–Sigrid (cousins):', Sim.kinship(st, st.pawns.find((p) => p.given === st.pawns[st.households[0].members[2]].given).id, st.households[3].members[2]));
// Olof's heir under B's practice, and under "any child"
const olofHH = st.households[4];
const checks = [
  ['  B3 heirs, sons first:', Sim.heirRanking(st, olofHH).slice(0, 4).map(nm).join(' > '), 'Per Eriksson > Sigrid Eriksdotter > Elin Eriksdotter > Gunnar Larsson'],
  ['  B3 heirs, any child :', Sim.heirRanking(st, olofHH, { ...Sim.practice(st, 1), heirSex: 'any' }).slice(0, 4).map(nm).join(' > '), 'Brita Larsdotter > Gunnar Larsson > Sigrid Eriksdotter > Per Eriksson'],
  ['  A2 heirs, sons only :', Sim.heirRanking(st, st.households[1], { ...Sim.practice(st, 0), heirSex: 'sons' }).slice(0, 4).map(nm).join(' > '), 'Olof Håkansson'],
];
let bad = 0;
for (const [label, got, want] of checks) { console.log(label, got); if (seed === 7 && got !== want) { bad++; console.error(`HEIRS MISMATCH${label} expected "${want}"`); } }
if (bad) process.exitCode = 1;
st.naturalDeaths = false;
let t0 = Date.now(); Sim.advance(st, Sim.YEAR); console.log(`\none year in ${Date.now() - t0} ms`);
show('after the first meetings and moving round');
console.log('  meeting log:', st.meetingLog.slice(0, 4).map((e) => e.text).join(' | '));
Sim.killPawn(st, olofHH.holder, 'killed');
Sim.killPawn(st, st.households[0].holder, 'killed');
show('after Olof and Lars die');
st.naturalDeaths = true;
t0 = Date.now(); Sim.advance(st, Sim.YEAR * 10); console.log(`\nten years in ${Date.now() - t0} ms`);
show('ten years on');
console.log('  recent events:', st.events.slice(0, 12).map((e) => e.text).join('\n    '));
console.log('  hungry days:', st.households.map((h) => h.hungryDays).join(','), '| cultures:', st.cenv.cultures.map((c) => c.name).join(', '));

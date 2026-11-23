// Heirs: the rankings of the heirs scenario's farms by name, the first meetings and moving round, two deaths that pass farms on, and the
// rankings by line against the full list, on the small heirs island (VB-854). With --extended (at night), on the default island: ten years
// on, reported, and the lone holder at B3 with a head of skill 0.5 bringing in a crop at four seeds (a statistic over seeds).
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim;
const { scenario } = require('./lib/probe.js'), { compareRankings } = require('./lib/heir-rankings.js'), assert = require('assert');
const extended = process.argv.includes('--extended');
const defaultIsland = (seed) => { const it = G.generate(seed); let r; while (!(r = it.next()).done); return r.value; };
const st = extended ? Sim.seed(defaultIsland(7), 7, 'heirs') : scenario('heirs');
const nm = (id) => Sim.fullName(st.pawns[id]);
const show = (title) => {
  console.log(`\n== ${title} (year ${Sim.cal(st.t).year})`);
  for (const hh of st.households) {
    if (hh.dissolved) continue;
    const f = st.farmsteads[hh.farmstead], v = st.villages[f.village].name, rank = Sim.heirRanking(st, hh).slice(0, 3).map(nm).join(' > ');
    console.log(`  ${v}/${f.name}: holder ${nm(hh.holder)}; members ${hh.members.map((m) => `${st.pawns[m].given} ${st.pawns[m].age} ${st.pawns[m].role}`).join(', ')}\n      heirs: ${rank || 'none'}`);
  }
  for (const f of st.farmsteads) if (f.household === null) console.log(`  ${st.villages[f.village].name}/${f.name}: ${f.state}, condition ${(f.condition * 100).toFixed(0)}%, fields ${f.fields[0] ? f.fields[0].stage : "gone back to the land"}`);
  console.log('  wants out:', st.demand.map(nm).join(', ') || '(not counted yet)');
  for (const s of st.cenv.settlements) console.log(`  ${s.name}: tie ${s.tie.toFixed(2)} (${s.distance ? s.distance.toFixed(1) : 0} walking hours, kin links ${s.kinLinks || 0}), heirSex ${Sim.practice(st, s.id).heirSex}, handover ${Sim.practice(st, s.id).handover}, claims ${Sim.practice(st, s.id).claims}`);
};
// VB-224: the rankings that ask only their candidates' line farms match the full list
const byLine = (when) => {
  const c = compareRankings(VB, st);
  assert.deepStrictEqual(c.bad, [], `${when}: ${c.bad.slice(0, 4).join('; ')}`);
  assert(c.claimed > 0, `${when}: some ranking must depend on another farm's claim`);
  console.log(`  rankings by line, ${when}: ${c.checked} match the full list; another farm's claim mattered in ${c.claimed}`);
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
for (const [label, got, want] of checks) { console.log(label, got); assert.strictEqual(got, want, `HEIRS MISMATCH${label}`); }
byLine('at the start');
st.naturalDeaths = false;
Sim.advance(st, Sim.YEAR);
show('after the first meetings and moving round');
console.log('  meeting log:', st.meetingLog.slice(0, 4).map((e) => e.text).join(' | '));
const lars = st.households[0].holder, olof = olofHH.holder;
Sim.killPawn(st, olof, 'killed');
Sim.killPawn(st, lars, 'killed');
show('after Olof and Lars die');
for (const [hh, dead] of [[olofHH, olof], [st.households[0], lars]]) assert(hh.dissolved || (hh.holder !== dead && st.pawns[hh.holder].alive), `the farm of ${nm(dead)} passes on`);
byLine('after the deaths');
Sim.advance(st, Sim.DAY);
byLine('a day on');
if (extended) {
  st.naturalDeaths = true;
  Sim.advance(st, Sim.YEAR * 10);
  show('ten years on');
  console.log('  recent events:', Sim.villageLog(st, Infinity).slice(0, 12).map((e) => e.text).join('\n    '));
  console.log('  hungry days:', st.households.map((h) => h.hungryDays).join(','), '| cultures:', st.cenv.cultures.map((c) => c.name).join(', '));
  byLine('ten years on');
  // VB-254 (VB-023's criterion): with its head of skill 0.5 (the traits' stream forced with `fix`, so every trait is 0.5 and every bias 1),
  // the lone holder at B3 brings in at least one crop (a field's stooks hauled home) in game years 1 to 3, at four seeds.
  const T = VB['sim/traits'], P = VB['sim/plans'], crops = [];
  for (const sd of [3, 7, 11, 42]) {
    const s2 = Sim.seed(defaultIsland(sd), sd, 'heirs'), farm = s2.farmsteads[s2.households[4].farmstead], was = farm.fields.map((fd) => fd.stage), by = [0, 0, 0];
    s2.rng.traits.fix = 0.5;
    // VB-519 replaced the stand-ins' draw: every living pawn's twelve traits are set at 0.5 (the stream forced for the heads' biases).
    for (const id of s2.living) s2.pawns[id].traits = Object.keys(T.IDX).map(() => 0.5);
    VB['sim/seasonal'].startHeads(s2);
    delete s2.rng.traits.fix;
    assert.strictEqual(VB['sim/seasonal'].headSkill(s2, 4), 0.5, 'a head of skill 0.5');
    s2.naturalDeaths = false;
    for (let d = 0; d < 3 * Sim.YEAR / Sim.DAY; d++) {
      Sim.advance(s2, Sim.DAY);
      farm.fields.forEach((fd, i) => { if (was[i] === 'stooks' && fd.stage === 'stubble' && farm.household === 4) by[Math.min(2, Sim.cal(s2.t - 1).year - 1)]++; was[i] = fd.stage; });
    }
    crops.push(by);
    assert(by[0] + by[1] + by[2] >= 1, `B3 brings in no crop in 3 years at seed ${sd}`);
  }
  console.log('  B3 crops brought in by a head of skill 0.5, years 1 to 3, seeds 3 7 11 42:', crops.map((b) => b.join('/')).join('  '));
}
console.log(`heirs ok${extended ? ' (extended)' : ''}`);

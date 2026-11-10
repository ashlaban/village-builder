// Borders (VB-157, sim/territory) on tiny worlds: a village short of outland presses a neighbour that holds more a farm; the Disputed claims
// custom settles it at the next meeting; cairns mark the border and keep the loser off those tiles for a while; the losers remember it.
const VB = require('../src/load.js'), Sim = VB.sim, T = VB['sim/territory'], CL = VB['sim/claims'], R = VB['sim/relations'];
const { moveClock } = require('./lib/clock.js');
const { CLAIMS, YEAR } = VB['sim/rules'], { setOwner } = VB['sim/ownership'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('BORDERS FAIL:', m); } };
const map = Array.from({ length: 8 }, () => '.'.repeat(18));
// A small village (index 0, one farm) and a larger one (index 1, three farms) on a small island, all its land held: the small one holds much
// more outland a farm. Then the larger one's households take in all its outland (fields), so it is short, with no free land left in reach.
function scene(dispute) {
  const keep = CLAIMS.outPerFarm; CLAIMS.outPerFarm = 60;
  const st = tinyState(tinyWorld(map), [{ at: [3, 4], farms: 1, sizes: [5] }, { at: [13, 4], farms: 3, sizes: [5, 5, 5] }], { seed: 9, customs: { dispute } });
  CLAIMS.outPerFarm = keep;
  const [small, big] = st.villages, hh = st.farmsteads[big.farmsteads[0]].household;
  for (const t of T.outlandOf(st, big)) setOwner(st, t, { type: 'household', id: hh });
  return { st, small, big };
}
const homes = (st, v) => v.farmsteads.map((id) => st.households[st.farmsteads[id].household]);
const opinion = (st, from, to) => R.opinionOf(st, homes(st, from)[0].holder, homes(st, to)[0].holder);
const pressed = (st, v) => [...st.claims].filter(([, l]) => l.some((c) => c.by.type === 'village' && c.by.id === v.id)).map(([t]) => t);

for (const [rule, winner] of [['first', 0], ['strongest', 0], ['kin', 0], ['meeting', 1]]) {
  const { st, small, big } = scene(rule);
  let free = 0; for (let t = 0; t < st.w.N; t++) if (st.owner[t] === 0) free++;
  check(free === 0, `${rule}: all the land is held (${free} free)`);
  check(T.outlandOf(st, small).length > 4, `${rule}: the small village holds outland`);
  moveClock(st, YEAR / 2); T.landMeeting(st);
  const tiles = pressed(st, big);
  check(tiles.length === CLAIMS.pressPerMeeting && tiles.every((t) => st.owner[t] === -small.id - 1), `${rule}: the big village presses ${tiles.length} of the small one's tiles`);
  const before = opinion(st, winner ? small : big, winner ? big : small), nEvents = Sim.villageLog(st, Infinity).length;
  moveClock(st, YEAR); T.landMeeting(st);
  const want = winner ? big.id : small.id, lose = winner ? small.id : big.id;
  check(tiles.every((t) => st.owner[t] === -want - 1), `${rule}: the tiles are ${winner ? 'taken by the big village' : 'kept by the small one'}`);
  check(tiles.every((t) => st.cairns.get(t) && st.cairns.get(t).a === want && st.cairns.get(t).b === lose), `${rule}: cairns mark the settled tiles`);
  const line = Sim.villageLog(st, Infinity).slice(0, Sim.villageLog(st, Infinity).length - nEvents).find((e) => /meet over their border/.test(e.text));
  check(line && (winner ? / takes 4 tiles/ : / keeps 4 tiles/).test(line.text), `${rule}: log: ${line && line.text}`);
  check(opinion(st, winner ? small : big, winner ? big : small) < before, `${rule}: the losers think less of the winners`);
  const lost = homes(st, winner ? small : big)[0];
  check(lost.grievance && lost.grievance.rules.length > 0 && !lost.grievance.rules.includes(rule), `${rule}: the losers lean to other rules (${lost.grievance && lost.grievance.rules})`);
  // the next meeting: the cairns keep the loser off the tiles it lost
  if (!winner) {
    T.landMeeting(st);
    check(pressed(st, big).every((t) => !tiles.includes(t)), `${rule}: the lost tiles are not pressed again while the cairns are fresh`);
  }
  const bad = checkState(st); check(!bad.length, `${rule}: invariants: ${bad.slice(0, 2).join('; ')}`);
}
// a village whose farms all stand empty has nobody to defend its outland: it goes to the claimant under any custom
{
  const { st, small, big } = scene('first');
  moveClock(st, YEAR / 2); T.landMeeting(st);
  const tiles = pressed(st, big);
  VB['sim/heirs'].extinct(st, homes(st, small)[0]);
  moveClock(st, YEAR); T.landMeeting(st);
  check(tiles.length && tiles.every((t) => st.owner[t] === -big.id - 1), 'a deserted village\'s outland goes to its neighbour');
}
// the rule between two villages: the practice they share, else their culture's custom
{
  const { st, small, big } = scene('meeting');
  check(T.borderRule(st, [small.id, big.id]) === 'meeting', 'a shared practice rules');
  require('./lib/tiny.js').setPractice(st, small.id, { dispute: 'kin' });
  check(T.borderRule(st, [small.id, big.id]) === 'first', 'differing practices: the culture\'s custom (the first claim)');
}
if (failed) process.exit(1);
console.log(`borders ok: a short village presses a richer neighbour for ${CLAIMS.pressPerMeeting} tiles; first, strongest and kin keep them with the holder, the meeting gives them to the bigger village; cairns, grudges, grievances`);

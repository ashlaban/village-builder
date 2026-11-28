// @suite fast
// A team's harness moves with the team (VB-2023, sim/droving passHerds, sim/leather harnessGoing): a household that comes to keep a team
// takes the old household's harness as worn; one that keeps a team already keeps its own.
const VB = require('../src/load.js'), H = VB['sim/heirs'], Hd = VB['sim/herds'];
const { tinyWorld, tinyState } = require('./lib/tiny.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('HARNESS FAIL:', m); } };
const scene = () => tinyState(tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(20))), [{ at: [8, 5], farms: 2, sizes: [8, 8] }], { seed: 3 });
const oxen = (st, hh) => Hd.herdsOf(st, hh).flatMap((h) => (h.species === 'cattle' ? h.head.filter((x) => x.kind === 'ox') : []));
const noOxen = (st, hh) => { for (const hd of Hd.herdsOf(st, hh)) if (hd.head) hd.head = hd.head.filter((x) => x.kind !== 'ox'); };
const team = (st, hh) => {
  const hd = Hd.herdOf(st, hh, 'cattle') || Hd.makeHerd(st, hh, 'cattle');
  while (oxen(st, hh).length < 2) hd.head.push({ id: 9000 + hd.head.length + hh.id * 10, kind: 'ox', born: -3000 });
};
{
  const st = scene(), a = st.households[0], b = st.households[1];
  noOxen(st, a); noOxen(st, b); team(st, a);
  a.harness = 0.4;
  check(Hd.hasTeam(st, a) && !Hd.hasTeam(st, b), 'a keeps a team, b none');
  H.extinct(st, a);
  check(Math.abs(b.harness - 0.4) < 1e-9, `the harness is worn as it was: ${b.harness}`);
}
{
  const st = scene(), a = st.households[0], b = st.households[1];
  noOxen(st, a); noOxen(st, b); team(st, a); team(st, b);
  a.harness = 0.4; b.harness = 0.9;
  H.extinct(st, a);
  check(Math.abs(b.harness - 0.9) < 1e-9, `a household with a team keeps its own harness: ${b.harness}`);
}
if (failed) process.exit(1);
console.log('harnesscarry: ok');

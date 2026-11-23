// VB-1545: a holder takes the ranks of the roles its household lacks (sim/roles STAND): alone it ranks the water as a mistress does; with
// a mistress, a maid or a daughter at home, as a farmer; with the mistress away, as a mistress again. Only the holder stands in.
const VB = require('../src/load.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { ROLES, absentMask } = VB['sim/roles'];
const Jobs = VB['sim/jobs'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('STAND FAIL:', m);
  }
};

// the ranks table: no role absent is the role's own; the mistress absent, for each kind the higher of the two
const F = ROLES.farmer,
  W = ROLES.wife;
check(F.ranks[0] === F.prio, 'ranks[0] is the role prio');
for (const k of Object.keys(F.prio))
  check(F.ranks[1][k] === Math.max(F.prio[k], W.prio[k]), `farmer alone ranks ${k} ${F.ranks[1][k]}`);
check(F.ranks[1].water === W.prio.water && W.prio.water > F.prio.water, 'alone, the water at the mistress rank');
check(F.ranks[1].reap === F.prio.reap && F.ranks[1].plow === F.prio.plow, 'alone, the fields at the farmer rank');
// who fills the mistress's place
const P = (id, role) => ({ id, role });
check(absentMask(0, [P(0, 'farmer')]) === 1, 'alone: the mistress absent');
for (const r of ['wife', 'maid', 'daughter'])
  check(absentMask(0, [P(0, 'farmer'), P(1, r)]) === 0, `a ${r} fills the place`);
for (const r of ['son', 'farmhand', 'retired', 'child', 'farmer'])
  check(absentMask(0, [P(0, 'farmer'), P(1, r)]) === 1, `a ${r} does not fill the place`);

// on a constructed state: a couple's holder, the water job of its household posted
const st = tinyState(
  tinyWorld(Array.from({ length: 10 }, () => '.'.repeat(14))),
  [{ at: [6, 5], farms: 4, sizes: [1, 2, 3, 4] }],
  {
    seed: 7,
  },
);
const hh = st.households.find((h) => h.members.some((m) => st.pawns[m].role === 'wife'));
const holder = st.pawns[hh.holder],
  wife = st.pawns[hh.members.find((m) => st.pawns[m].role === 'wife')],
  f = st.farmsteads[hh.farmstead];
check(holder.role === 'farmer', 'the holder is the farmer');
for (const k of ['water', 'repair'])
  Jobs.post(st, `${k}:h${hh.id}:test`, k, { type: 'household', id: hh.id }, f.house, {});
const rank = (p, k = 'water') => {
  const row = VB['sim/fit'].explainIdle(st, p.id).find((x) => x.job === `${k}:h${hh.id}:test`);
  const j = st.jobs.get(`${k}:h${hh.id}:test`);
  return row && row.bid !== null ? row.bid / VB['sim/kinds'].KINDS[j.kind].urgency(st, j, VB['sim/rules'].cal(st.t), VB['sim/roles'].MATCH.urgency) : null; // the walk is 0: the job is at the house
};
const near = (x, y) => x !== null && Math.abs(x - y) < 1e-9;
const members = hh.members.slice();
hh.members = [holder.id]; // alone (a test's write of the members cache)
check(
  near(rank(holder), W.prio.water),
  `alone, the holder ranks the water ${rank(holder)}, not the mistress's ${W.prio.water}`,
);
hh.members = members; // the mistress added
check(
  near(rank(holder), F.prio.water),
  `with a mistress, the holder ranks the water ${rank(holder)}, not the farmer's ${F.prio.water}`,
);
check(near(rank(wife), W.prio.water), `the mistress ranks the water ${rank(wife)}`);
st.agents[wife.id].away = 0; // the mistress away (a journey's stay): absent
check(near(rank(holder), W.prio.water), `with the mistress away, the holder ranks the water ${rank(holder)}`);
delete st.agents[wife.id].away;
// only the holder stands in: the mistress alone with the holder away keeps her own ranks
st.agents[holder.id].away = 0;
check(
  W.prio.repair < F.prio.repair && near(rank(wife, 'repair'), W.prio.repair),
  `the mistress alone ranks the repair ${rank(wife, 'repair')}, her own`,
);
delete st.agents[holder.id].away;
if (failed) process.exit(1);
console.log(
  'stand ok: a holder alone ranks the water as a mistress, with a mistress, a maid or a daughter as a farmer',
);

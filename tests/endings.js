// @suite fast
// VB-1683: the ending sweep (the principles review of 24 November, M1 and M3). On a constructed village of tests/tiny.js, each pawn, then
// each household, is ended in turn at each phase of a day: checkState runs after the ending, and again half a day on, as what it set
// going plays out. A breach an open repair covers is listed (tests/lib/invariants.js KNOWN, by task) and not counted. With --known, those are printed.
const VB = require('../src/load.js'),
  Sim = VB.sim;
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState, idBreaches, knownBreaches } = require('./lib/invariants.js');
const { killPawn } = VB['sim/lifecycle'],
  { extinct } = VB['sim/heirs'];
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('ENDINGS FAIL:', m);
  }
};
const map = [
  '..............',
  '...FF.........',
  '...FF.........',
  '..............',
  '..........FF..',
  '..............',
  '.........^^...',
  '..............',
  '~.............',
  '~~............',
];
const w = tinyWorld(map),
  fresh = () =>
    tinyState(
      w,
      [
        { at: [3, 5], farms: 2 },
        { at: [11, 2], farms: 1 },
      ],
      { seed: 7 },
    );
// the phases: before dawn (asleep), the morning's work, the afternoon's, the evening (home, the meal)
const PHASES = [3, 9, 14, 20];
const known = new Map();
let ended = 0,
  checks = 0;
function sweep(kind, ids, end) {
  for (const h of PHASES)
    for (const id of ids) {
      const st = fresh();
      Sim.advance(st, Sim.DAY + h - (st.t % Sim.DAY)); // the second day, at hour h
      const at = `${kind} ${id} ended at hour ${h}`;
      if (!end(st, id)) continue;
      ended++;
      for (const when of ['at once', 'half a day on']) {
        if (when !== 'at once') Sim.advance(st, Sim.DAY / 2);
        const bad = checkState(st);
        checks++;
        check(!bad.length, `${at}, ${when}: ${bad.slice(0, 4).join('; ')}`);
        for (const e of knownBreaches(st)) {
          const k = e.replace(/\b\d+(\.\d+)?\b/g, (m, f, i) => (i < 8 ? m : 'N')); // the task's ID kept, the rest's numbers not
          if (!known.has(k)) known.set(k, at);
        }
      }
    }
}
const st0 = fresh();
check(!idBreaches(st0).length, `the seeded state: ${idBreaches(st0).slice(0, 3).join('; ')}`);
sweep(
  'pawn',
  st0.pawns.map((p) => p.id),
  (st, id) => st.pawns[id].alive && (killPawn(st, id), true),
);
sweep(
  'household',
  st0.households.map((h) => h.id),
  (st, id) => !st.households[id].dissolved && (extinct(st, st.households[id], 'the sweep ended it'), true),
);
// the walk fails on what it is for: a live id that names a dead pawn, a pawn in two households, and a dead pawn's task
{
  const st = fresh(),
    [a, b] = st.households;
  Sim.advance(st, Sim.DAY);
  const dead = a.members.find((m) => m !== a.holder);
  killPawn(st, dead);
  const gone = st.households[2];
  extinct(st, gone, 'the test ended it');
  st.peopleCheck.push(gone.id);
  a.members.push(dead);
  b.members.push(a.holder);
  const bad = idBreaches(st).join('\n');
  check(
    bad.includes(`st.households[${a.id}].members[${a.members.length - 1}]: pawn ${dead} is dead`),
    `a dead member: ${bad}`,
  );
  check(bad.includes(`st.households[].members[]: pawn ${a.holder} at`), `a pawn in two households: ${bad}`);
  check(
    gone.dissolved && bad.includes(`: household ${gone.id} is dissolved`),
    `a dissolved household named live: ${bad}`,
  );
  st.agents[dead].job = { key: 'test' };
  check(
    idBreaches(st).some((e) => e === `pawns[${dead}]: dead, holding a task test`),
    'a dead pawn holding a task',
  );
}
if (process.argv.includes('--known')) for (const [e, at] of known) console.log(`known: ${e} (first: ${at})`);
if (failed) process.exit(1);
console.log(
  `endings ok: ${ended} endings at ${PHASES.length} phases of a day, ${checks} checks; ${known.size} known breaches of open repairs`,
);

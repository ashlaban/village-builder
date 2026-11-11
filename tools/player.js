// usage: node tools/player.js [--seeds 7,42] [--years 75] [--map small] [--save-every 5] [--json]   the played line (VB-078)
//        node tools/player.js --medium [--years 5]    populous medium, no player, saved every year, against the unbroken run
//        node tools/player.js --cost [--days 30]      the game day with a player against without, at small-y40 and medium-y5; Sim.opportunities at
//                                                     medium-ref; save sizes and times (makes the fixtures it lacks: minutes)
//   The scripted player of tests/lib/line.js plays the founders scenario: it inhabits the first holder, queues work from Sim.opportunities
//   on some days, argues one cause, sets one wish at a moving round, wishes once for a match, answers the offers of marriage that wait for
//   it (refusing the first, leaving every third to its due time), and goes on as a successor at each death. For each seed it runs the line
//   unbroken and saved and loaded every --save-every years, and says whether the golden hashes of the two agree; it prints the pawns played
//   and how each followed the last, the cause and the meetings' outcomes, the offers, the commands counted by source, the jobs taken in a
//   stepped window against the work commands that took them, one game day with the automatic behaviour off, and the line's households
//   against the others' (hungry days a household-year, farms still held, children at each year's start a household-year).
require('./help.js')(__filename);
const { performance } = require('perf_hooks');
const { playLine, SIZES } = require('../tests/lib/line.js');
const VB = require('../src/load.js'), Sim = VB.sim, F = require('../tests/lib/fixtures.js');
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; }, asJson = args.includes('--json');
const out = (o) => console.log(asJson ? JSON.stringify(o) : JSON.stringify(o, null, 1));
const years = +opt('--years', args.includes('--medium') ? 5 : 75);
const differ = (a, b) => Object.keys({ ...a, ...b }).filter((k) => a[k] !== b[k]);
const YD = VB['sim/rules'].YEAR_DAYS;
const WINDOW = { autoOffDay: 2 * YD + 10, takeFrom: 3 * YD };

if (args.includes('--medium')) {
  const run = (saveEvery) => playLine({ scenario: 'populous', seed: 7, map: 'medium', years, saveEvery, player: false });
  const a = run(0), b = run(1);
  out({ run: `populous medium seed 7, ${years} years, no player, saved every year`, living: a.state.living.length, same: differ(a.hashes, b.hashes).length === 0,
    differ: differ(a.hashes, b.hashes), saves: b.saves, ms: [a.ms, b.ms] });
  process.exit(differ(a.hashes, b.hashes).length ? 1 : 0);
}

if (args.includes('--cost')) {
  const days = +opt('--days', 30), loadFx = (n) => F.loadFixture(n);
  // a game day: the mean of `days` days with and without a player (the scripted player's day included), from a fresh load each
  const dayMs = (name, played) => {
    const { st } = loadFx(name);
    const t0 = performance.now();
    if (played) {
      Sim.inhabit(st, st.households.find((h) => !h.dissolved && h.holder !== null).holder);
      for (let d = 0; d < days; d++) {
        const pl = st.player;
        if (pl && !pl.left) {
          const ops = Sim.opportunities(st, pl.pawn), w = d % 3 === 0 && !pl.queue.length && ops.find((o) => o.verb === 'work' && o.why === null);
          if (w) Sim.queue(st, { actor: pl.pawn, verb: 'work', target: w.target });
        }
        Sim.advance(st, 24);
      }
    } else for (let d = 0; d < days; d++) Sim.advance(st, 24);
    return (performance.now() - t0) / days;
  };
  const res = {};
  for (const name of ['small-y40', 'medium-y5']) {
    const unplayed = [], played = [], again = [];
    for (let i = 0; i < 3; i++) { unplayed.push(dayMs(name, false)); played.push(dayMs(name, true)); again.push(dayMs(name, false)); }
    const med = (v) => [...v].sort((x, y) => x - y)[1];
    res[name] = { unplayedMs: +med(unplayed).toFixed(2), playedMs: +med(played).toFixed(2), overheadPct: +(100 * (med(played) / med(unplayed) - 1)).toFixed(2),
      noisePct: +(100 * (med(again) / med(unplayed) - 1)).toFixed(2) }; // the same unplayed run twice: the machine's own spread
  }
  const { st } = loadFx('medium-ref'), ids = st.living.filter((id) => st.pawns[id].household !== null).slice(0, 200), t0 = performance.now();
  for (let r = 0; r < 3; r++) for (const id of ids) Sim.opportunities(st, id);
  res.opportunitiesMsCall = { fixture: 'medium-ref', calls: ids.length * 3, ms: +((performance.now() - t0) / (ids.length * 3)).toFixed(3) };
  out(res);
  process.exit(0);
}

const seeds = opt('--seeds', '7,42').split(',').map(Number), every = +opt('--save-every', 5), map = opt('--map', 'small');
if (!SIZES[map]) { console.error('unknown map ' + map); process.exit(2); }
let bad = 0;
for (const seed of seeds) {
  const a = playLine({ scenario: 'founders', seed, map, years, player: true, stepDays: WINDOW });
  const b = playLine({ scenario: 'founders', seed, map, years, player: true, saveEvery: every, stepDays: WINDOW });
  const c = playLine({ scenario: 'founders', seed, map, years, player: false });
  const d = differ(a.hashes, b.hashes);
  if (d.length) bad++;
  out({ seed, map, years, line: a.report(), alive: a.alive, living: a.state.living.length, commandsBySource: a.counts, jobs: a.jobs, autoOffDay: a.autoOff,
    savedEvery: every, sameHashes: d.length === 0, differ: d, saves: b.saves, ms: [a.ms, b.ms, c.ms],
    unplayed: { living: c.state.living.length, households: c.state.liveHouseholds.length, hungryPerHousehold: +(c.state.households.reduce((n, h) => n + h.hungryDays, 0)
      / Math.max(1, c.state.households.length)).toFixed(1) }, record: { playedEntries: a.state.record.length, unplayedEntries: c.state.record.length } });
}
process.exit(bad ? 1 : 0);

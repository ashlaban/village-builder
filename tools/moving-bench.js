// VB-196: isolated round cost, complete post-round save hash, and optional six-minute round-day timings.
// --source DIR runs another checkout against its fixture directory; no simulation source is modified.
require('./help.js')(__filename);
const path = require('path'), crypto = require('crypto');
const args = process.argv.slice(2), sourceAt = args.indexOf('--source');
const root = sourceAt < 0 ? path.join(__dirname, '..') : path.resolve(args.splice(sourceAt, 2)[1]);
const day = args.includes('--day'), names = args.filter((a) => a !== '--day');
const VB = require(path.join(root, 'src/load.js')), Sim = VB.sim;
const F = require(path.join(root, 'tests/lib/fixtures.js'));
for (const name of names.length ? names : ['small-y40', 'medium-ref']) {
  const fixture = F.loadFixture(name);
  if (!fixture) throw new Error(`${name}: a fixture is required for this benchmark`);
  const { st, stamp, stale } = fixture, households = st.liveHouseholds.length;
  VB.resetCounts();
  const before = VB.count.heirRank, started = performance.now();
  Sim.movingRound(st);
  const roundMs = performance.now() - started, roundRank = VB.count.heirRank - before, roundPairs = VB.count.roundPairs;
  const saveHash = crypto.createHash('sha256').update(JSON.stringify(Sim.save(st))).digest('hex');
  console.log(JSON.stringify({ name, source: root, fixtureCommit: stamp.commit, stale, households,
    roundMs, roundRank, rankingsPerHousehold: roundRank / households, roundPairs, saveHash }));
  if (!day) continue;
  const fresh = F.loadFixture(name).st, { DAY, YEAR, SEASON_DAYS } = Sim;
  const start = Math.floor(fresh.t / YEAR) * YEAR + (2 * SEASON_DAYS + 10) * DAY;
  Sim.advance(fresh, start - fresh.t);
  const steps = [];
  for (let i = 0; i < 240; i++) {
    const hour = fresh.t, t = performance.now();
    Sim.advance(fresh, 0.1);
    steps.push({ hour, ms: performance.now() - t });
  }
  steps.sort((a, b) => b.ms - a.ms);
  console.log(JSON.stringify({ name, roundDay: true, steps: steps.length, longest: steps[0], slowest: steps.slice(0, 5) }));
}

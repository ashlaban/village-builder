// What is not a tier (VB-1933). A test's tier is the `// @suite` line in its own head (tests/lib/tiers.js, docs/testing.md): a new test
// adds nothing here. No test depends on the order the runner starts them in: a shared fixture is made before the tier starts
// (tests/run.js) and written whole by its stamp (tests/lib/fixtures.js), and the browser scripts run one at a time whatever the order.
// FIRST is only scheduling: the slowest of the night's run, started first so that none starts last and runs on alone; the long runs of
// whole islands, which load the late fixtures, lead. The rest of each tier starts by file name.
const FIRST = [
  ['node', 'tests/start.js', '--people'],
  ['node', 'tests/perf.js', '--engine'], // VB-246: about 3 minutes: 12 runs of a year or less
  ['node', 'tests/methods.js', '--runs', '10000'],
  ['node', 'tests/births.js'],
  ['node', 'tests/invariants.js'],
  ['node', 'tests/fixtures.js'],
  ['node', 'tests/history.js'],
  ['node', 'tests/bands.js'],
  ['node', 'tests/line.js'],
];
module.exports = { FIRST };

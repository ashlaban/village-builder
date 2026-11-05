// Fixture preparation runs first, followed by diagnostic bench history and the generated budget table.
const F = require('../tests/lib/fixtures.js'), { make, publish } = require('./fixtures.js');
async function nightly() {
  F.fetchFixtures();
  const remake = Object.keys(F.FIXTURES).filter((name) => F.status(name).status !== 'fresh');
  if (remake.length) {
    console.log('nightly: remaking ' + remake.join(', ') + ' in background workers');
    await make(remake);
  } else console.log('nightly: all fixtures fresh; no simulation needed');
  publish();
  console.log('nightly: fixture preparation complete');
  try { await require('./bench.js').runBench(); }
  catch (e) { console.error('nightly: bench UNAVAILABLE ' + e.message); }
  console.log('nightly: include docs/bench/history.jsonl and docs/bench/budget.md in the nightly PR');
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });

// Fixture preparation runs first, followed by diagnostic bench history and the generated budget table. The nightly workflow publishes
// the fixtures (VB-223); here they are published only with a GH_TOKEN, and otherwise remade locally if still stale.
const { refresh } = require('./fixtures.js');
async function nightly() {
  await refresh({ publishing: !!process.env.GH_TOKEN });
  console.log('nightly: fixture preparation complete');
  try { await require('./bench.js').runBench(); }
  catch (e) { console.error('nightly: bench UNAVAILABLE ' + e.message); }
  console.log('nightly: include docs/bench/history.jsonl and docs/bench/budget.md in the nightly PR');
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });

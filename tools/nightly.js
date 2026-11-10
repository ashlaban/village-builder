// Fixture preparation runs first, followed by diagnostic bench history, the generated budget table and the full bands runs (VB-163,
// tools/bands.js, for a commit not yet run). The nightly workflow publishes the fixtures (VB-223); here they are published only with
// a GH_TOKEN, and otherwise remade locally if still stale.
require('./help.js')(__filename);
const { refresh } = require('./fixtures.js');
async function nightly() {
  await refresh({ publishing: !!process.env.GH_TOKEN });
  console.log('nightly: fixture preparation complete');
  try { await require('./bench.js').runBench(); }
  catch (e) { console.error('nightly: bench UNAVAILABLE ' + e.message); }
  // the full runs of the bands (VB-163), for a commit not yet run; reported, never failing
  try { await require('./bands.js').main(['--if-new']); }
  catch (e) { console.error('nightly: bands UNAVAILABLE ' + e.message); }
  console.log('nightly: include docs/bench/history.jsonl, docs/bench/budget.md and docs/bench/bands.jsonl in the nightly PR');
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });

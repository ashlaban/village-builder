// The fixtures the sources lack are made first (VB-272: a local cache, never published), then the diagnostic bench history, the
// generated budget table and the full bands runs (VB-163, tools/bands.js, for a commit not yet run).
require('./help.js')(__filename);
const F = require('../tests/lib/fixtures.js');
async function nightly() {
  console.log(F.ensure(Object.keys(F.FIXTURES)) ? 'nightly: fixture preparation complete' : 'nightly: fixtures UNAVAILABLE');
  try { await require('./bench.js').runBench(); }
  catch (e) { console.error('nightly: bench UNAVAILABLE ' + e.message); }
  // the full runs of the bands (VB-163), for a commit not yet run; reported, never failing
  try { await require('./bands.js').main(['--if-new']); }
  catch (e) { console.error('nightly: bands UNAVAILABLE ' + e.message); }
  console.log('nightly: include docs/bench/history.jsonl, docs/bench/budget.md and docs/bench/bands.jsonl in the nightly PR');
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });

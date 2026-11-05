// Fixture preparation runs first; later yardstick tasks add bench and band reporting here.
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
}
nightly().catch((e) => { console.error('nightly: ' + e.message); process.exitCode = 1; });

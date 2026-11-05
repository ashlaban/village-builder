// Verify present late-game states, including stale golden hashes. Offline absence is a reported skip.
const assert = require('assert'), F = require('./lib/fixtures.js'), { checkState } = require('./lib/invariants.js');
const Sim = require('../src/load.js').sim;
let loaded = 0;
for (const name of Object.keys(F.FIXTURES)) {
  const fixture = F.loadFixture(name);
  if (!fixture) continue;
  Sim.advance(fixture.st, Sim.DAY);
  const bad = checkState(fixture.st);
  assert.deepStrictEqual(bad, [], `${name}: ${bad.slice(0, 8).join('; ')}`);
  console.log(`${name}: loaded${fixture.stale ? ' (stale)' : ''}, advanced one day; invariants pass`); loaded++;
}
console.log(`fixtures: ${loaded}/4 saves checked; ${4 - loaded} missing`);

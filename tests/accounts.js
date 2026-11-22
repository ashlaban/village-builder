// The balance accounts (VB-403, tools/accounts.js): on the roomy island of tests/lib/probe.js (VB-862), the heirs scenario, 3 years (it has gifts, the village store,
// handings on and deaths in that time), the food account closes within 1% of the produce with `unexplained` counted (what the
// lines and the change in stores leave over, the stocks read apart from the movements), the people account's births and arrivals less
// its deaths are the change in the living, and the run is the same run with the report as without it (its wrappers only read).
// Each run is a child process: the report's loader wraps modules as they load, which one process does once.
const assert = require('assert'), cp = require('child_process'), path = require('path'), crypto = require('crypto');
const SEED = 7, SCENARIO = 'heirs', YEARS = 3;

if (process.argv[2] === 'child') {
  const accounts = process.argv[3] === 'accounts', A = require('../tools/accounts.js');
  const VB = accounts ? A.load() : require('../src/load.js'), Sim = VB.sim;
  const { island, ROOMY } = require('./lib/probe.js'), st = Sim.seed(island(SEED, ROOMY), SEED, SCENARIO);
  let out = null;
  if (accounts) {
    const rep = A.report(VB, st);
    for (let y = 0; y < YEARS; y++) rep.advanceYear();
    out = rep.result();
  } else Sim.advance(st, YEARS * Sim.YEAR - st.t);
  const hash = crypto.createHash('sha1').update(JSON.stringify(Sim.save(st))).digest('hex');
  process.stdout.write(JSON.stringify({ t: st.t, hash, out }));
  process.exit(0);
}

const run = (mode) => new Promise((ok, fail) => cp.execFile('node', [__filename, 'child', mode], { encoding: 'utf8', maxBuffer: 1 << 26 },
  (e, out) => (e ? fail(e) : ok(JSON.parse(out)))));
Promise.all([run('accounts'), run('plain')]).then(([a, plain]) => check(a, plain)).catch((e) => { console.error(e); process.exit(1); });
function check(a, plain) {

  // 1. the same run: the report's wrappers and its stepping an hour at a time change nothing
  assert.strictEqual(a.t, plain.t, 'both runs stop at the third year\'s turn');
  assert.strictEqual(a.hash, plain.hash, 'the run with the accounts report is the same run as without it');

  const years = a.out.years;
  assert.strictEqual(years.length, YEARS);
  for (const y of years) {
    const F = y.food.all;
    // 2. the food account closes: the lines and the change in stores leave under 1% of the produce
    assert(F.produced > 1000, `year ${y.year}: food was produced`);
    assert(Math.abs(F.unexplained) < 0.01 * F.produced, `year ${y.year}: the food account closes (unexplained ${F.unexplained.toFixed(1)} of ${F.produced.toFixed(0)})`);
    assert(Math.abs(y.grain.unexplained) < 0.01 * y.grain.produced, `year ${y.year}: the grain's account closes`);
    assert.strictEqual(F.other, 0, `year ${y.year}: every food movement has its line (${JSON.stringify(F.lines.other)})`);
    const sumVillages = y.food.villages.reduce((s, v) => s + v.produced, 0);
    assert(Math.abs(sumVillages - F.produced) < 1e-6 * F.produced, 'the villages\' accounts sum to the island\'s');
    for (const k of ['seed', 'eaten']) assert(F.lines.out[k], `year ${y.year}: ${k} is an outlet`);
    // 3. the people account: births and arrivals less deaths are the change in the living
    const P = y.people;
    assert.strictEqual(P.births + P.arrived - P.died, P.living[1] - P.living[0], `year ${y.year}: the people account closes`);
    assert.strictEqual(Object.values(P.deaths).reduce((s, n) => s + n, 0), P.died, 'deaths by cause sum to the deaths');
    // 4. the rest is there, of its kind
    assert(y.spread.households > 0 && y.spread.producedOverNeed.p50 > 0, 'the spread is read');
    assert(y.labour.summer && Math.abs(Object.values(y.labour.summer).reduce((s, n) => s + n, 0) - 1) < 0.01, 'labour shares sum to 1');
    assert(y.properties.some((p) => p.value === 'no mechanism yet'), 'a property with no mechanism says so');
  }
  assert(years.some((y) => y.food.all.lines.in && y.food.all.lines.in.gifts > 0), 'gifts were given in the run, and are counted at both ends');
  // 5. the report is listed by tools/sim.js
  assert(/accounts/.test(cp.execFileSync('node', [path.join(__dirname, '..', 'tools', 'sim.js'), '--help'], { encoding: 'utf8' })), 'tools/sim.js lists the accounts report');
  console.log(`accounts: ${YEARS} years of ${SCENARIO} on the roomy island close (unexplained at most ${Math.max(...years.map((y) => Math.abs(y.food.all.unexplained))).toExponential(1)} rations); the run is unchanged`);
}

// VB-207: a death's cause is read from the contributions of death.hazard. Contributions with other causes are registered before seeding,
// in a process of their own, in each order; the share of each cause must not depend on the order.
const assert = require('assert'), cp = require('child_process'), path = require('path');
if (process.argv[2]) { // child: argv[2] is the order of registering, 'ab' or 'ba'
  const VB = require('../src/load.js'), Rules = VB['sim/registry'], { YEAR } = VB['sim/rules'];
  const plague = { rule: 'death.hazard', source: 'test', key: 'plague', label: 'Plague', cause: 'disease', range: [1, 3], tunables: [],
    value: (st, p) => 1 + 2 * (p.plague || 0) };
  const cold = { ...plague, key: 'cold', label: 'Cold', cause: 'exposure', value: (st, p) => 1 + (p.cold || 0) };
  for (const c of process.argv[2] === 'ab' ? [plague, cold] : [cold, plague]) Rules.contribute(c);
  const it = VB.gen.generate(11, { cols: 60, rows: 40 }); let r; while (!(r = it.next()).done);
  const st = VB.sim.seed(r.value, 11, 'populous'); // seals the registry
  const p = { born: st.t - 30 * YEAR, health: 100, hunger: 0.5, plague: 0.5, cold: 1 };
  const e = Rules.explain(st, 'death.hazard', p), N = 200000, tally = {};
  const hazard = Rules.value(st, 'death.hazard', p);
  for (let i = 0; i < N; i++) {
    st.rng.deaths.fix = (i + 0.5) / N * hazard * 1.25; // a fifth of the draws miss
    const c = VB['sim/deaths'].deathRoll(st, p);
    tally[c] = (tally[c] || 0) + 1;
  }
  const split = {}; // explain's split, by cause
  split[e.baseCause] = e.base;
  for (const x of e.parts) split[x.cause] = (split[x.cause] || 0) + x.share;
  assert(Math.abs(Object.values(split).reduce((a, b) => a + b, 0) - e.value) < 1e-12, 'explain: the shares add up to the value');
  const keys = Array.from(Rules.list().find((x) => x.rule === 'death.hazard').contributions.map((c) => c.key));
  console.log(JSON.stringify({ tally, split, hazard, N, order: keys }));
  process.exit(0);
}
const run = (o) => JSON.parse(cp.execFileSync(process.execPath, [__filename, o], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }).trim().split('\n').pop());
const A = run('ab'), B = run('ba');
assert.deepStrictEqual(A.order.slice(0, 2), ['hunger', 'frailty'], 'declared order first, new terms after');
assert.deepStrictEqual(B.order.slice(0, 2), ['hunger', 'frailty']);
const causes = ['disease', 'exposure', 'hunger', 'illness'];
for (const [x, label] of [[A, 'ab'], [B, 'ba']]) {
  const width = x.hazard * 1.25 / x.N; // the part of the hazard one draw stands for
  for (const cause of causes) {
    assert(x.split[cause] > 0, cause + ' has a share');
    assert(Math.abs(x.tally[cause] * width - x.split[cause]) < 1e-3 * x.hazard, `${label}: ${cause} deaths follow explain's split`);
  }
  assert(Math.abs(x.tally.null * width - x.hazard * 0.25) < 1e-3 * x.hazard, 'draws above the hazard are no death');
}
for (const cause of causes) {
  assert(Math.abs(A.split[cause] - B.split[cause]) < 1e-12 * A.hazard, cause + ': the share does not depend on the order of registering');
  assert(Math.abs(A.tally[cause] - B.tally[cause]) <= 2, cause + ': deaths do not either');
}
console.log('causes: a death takes its cause from the contribution it falls in, in either order of registering');

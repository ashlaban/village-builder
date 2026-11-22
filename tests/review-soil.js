// The soil report, apart from tests/review-tools.js since VB-1477 (its two years of populous were half of that script's CPU).
const assert = require('assert');
// The soil report (VB-720, tools/soil.js): --help, sim.js lists it, and two years on the small island give the farm classes and villages, and
// tilthByHerd reads the same fields
{
  const cp = require('child_process'), VB = require('../src/load.js'), Sim = VB.sim, tool = (f) =>
    cp.execFileSync('node', [require('path').join(__dirname, '..', 'tools', f), '--help'], { encoding: 'utf8' });
  assert.ok(/meadow/.test(tool('soil.js')) && /\|soil/.test(tool('sim.js')), 'tools/soil.js answers --help and tools/sim.js lists the soil report');
  const st = Sim.seed(require('./lib/probe.js').island(7), 7, 'populous'), S = require('../tools/soil.js'), rep = S(VB, st, { period: 'year' });
  rep.advanceYear();
  rep.advanceYear();
  const out = rep.result();
  assert.strictEqual(out.classes.length, 6, 'three farm classes a year');
  assert.ok(out.classes.some((r) => r.fields > 0 && r.grain > 0) && out.villages.length > 0 && out.meadows.length === 2, 'the soil report reads fields and villages');
  const t = S.tilthByHerd(VB, st);
  assert.strictEqual(t.cattle.n + t.none.n, out.classes.filter((r) => r.years === '2-2').reduce((n, r) => n + r.fields, 0), 'the same fields are read');
}
console.log('review soil ok: the farm classes, villages and meadows of two years; tilthByHerd reads the same fields');

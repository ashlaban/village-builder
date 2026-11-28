// @suite integration
// The review tools (VB-337): the hours report (tools/hours.js) only reads the run: a seed is the same run with or without it. Apart from
// tests/review-tools.js since VB-856, on the small island of tests/lib/probe.js (120 by 85 before).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, { sha, canon } = require('./lib/canon.js');

// The hours report reads the run and writes nothing: the same seed gives the same state with or without it
// on the small island of tests/lib/probe.js (VB-856; 120 by 85 before), a fresh copy for each run, since a run changes its world
const world = () => require('./lib/probe.js').island(7);
const hash = (st) => sha(Object.keys(st).sort().map((k) => `${k}:${canon(st[k])}`).join('\n'));
const plain = Sim.seed(world(), 7, 'founders'); Sim.advance(plain, Sim.YEAR);
const st = Sim.seed(world(), 7, 'founders'), hours = require('../tools/hours.js')(VB, st, {});
hours.advanceYear();
assert.strictEqual(hash(st), hash(plain), 'the hours report changes the run');
const out = hours.result();
assert(out.groups.length && out.groups.every((g) => g.households > 0 && g.handsHours > 0), 'the hours report has groups of households');
const all = out.groups.flatMap((g) => g.hours);
assert(['plow', 'sow', 'reap', 'water', 'cook'].every((k) => all.some((h) => h.kind === k && h.total > 0)), 'field work, water and cooking are counted');
const farming = out.groups.find((g) => g.farming.sown.fields > 0);
assert(farming && farming.farming.reaped.fields > 0 && farming.farming.threshed.fields > 0, 'the farming year: fields sown, reaped and threshed');
const one = require('../tools/hours.js')(VB, Sim.seed(world(), 7, 'founders'), { household: 0 });
one.advanceYear();
assert(one.result().years.length === 1, 'one household\'s table');
console.log(`review hours ok: ${out.groups.length} groups of households; the hours report leaves the run as it was`);

// tools/gossip.js (VB-187), the gossip experiment: deterministic for a seed; both models hear the same meetings; an island with no way
// across hears nothing; the baseline forgets nothing and has no counter-story; a story's sharpened retellings stay within -1..1.
// It checks the experiment's machinery, not its bands: those are reported (docs/gossip-experiment.md), not asserted.
const assert = require('assert');
const { run, experiment, summary } = require('../tools/gossip.js');
const o = { seeds: [1, 2], years: 2, start: 0, models: ['stories', 'averaging'], params: {} };
const a = JSON.stringify(summary(experiment(o))), b = JSON.stringify(summary(experiment(o)));
assert.strictEqual(a, b, 'the same seeds give the same numbers');
const res = experiment(o);
for (const model of o.models) for (const r of res.models[model]) {
  assert.strictEqual(r.m.islandMax, 0, `${model} seed ${r.seed}: island C heard with no way across`);
  assert(r.m.iceNotBefore, `${model} seed ${r.seed}: island C heard before the gathering joined it`);
  assert(r.t.series.share.every((s) => s.every((x) => x >= 0 && x <= 1)), 'shares within 0..1');
  for (const xs of Object.values(r.t.distortion || {})) assert(xs.every((x) => Math.abs(x * -0.6) <= 1 + 1e-9), 'valence within -1..1');
}
for (const r of res.models.averaging) {
  assert.strictEqual(r.m.kept3y, 1, 'the baseline forgets nothing');
  assert.strictEqual(r.m.reachCounter, 0, 'the baseline has no counter-story');
}
// the meetings are drawn apart from the model: the source's village hears the story in both, and the lie is exposed only under stories
const s = run({ model: 'stories', kase: 'lie', seed: 3, years: 1 }), v = run({ model: 'averaging', kase: 'lie', seed: 3, years: 1 });
assert(s.exposures > 0 && v.exposures === 0, 'a lie meeting its witnesses is exposed under stories only');
console.log('gossip experiment: deterministic, island apart, baseline keeps all, lies exposed under stories only');

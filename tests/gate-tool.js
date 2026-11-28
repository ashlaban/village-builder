// @suite fast
// tools/gate.js (VB-1774): the comparison on constructed results, without running the simulation.
const { compare, sample } = require('../tools/gate.js');
let bad = 0;
const expect = (name, ok) => { if (!ok) { bad++; console.error('FAIL ' + name); } };
const S = (id, l0, l10, why = null) => ({ id, living0: l0, living10: l10, extinct: l0 > 0 && l10 === 0, why });
const R = (o = {}) => ({ scenario: 'founders', seed: 7, settlements: [S(0, 20, 20)], stuck: 1, unexplained: 10, produced: 10000, hungryDays: 5, hungerDeaths: 0, ...o });
const base = { runs: [R()] }, c = (o) => compare({ runs: [R(o)] }, base);
expect('same holds', c({}).ok);
expect('hunger and deaths never fail', c({ hungryDays: 900, hungerDeaths: 40 }).ok);
expect('extinct by hunger, base alive, fails', c({ settlements: [S(0, 20, 0, 'hunger')] }).fails.some((f) => /by hunger/.test(f)));
expect('extinct by another cause is not the hunger rule', !c({ settlements: [S(0, 20, 0, 'fire')] }).fails.some((f) => /by hunger/.test(f)));
const gone = { runs: [R({ settlements: [S(0, 20, 0, 'hunger')] })] };
expect('extinct by hunger as the base is, no hunger failure', !compare(gone, gone).fails.some((f) => /by hunger/.test(f)));
expect('decline to half holds', c({ settlements: [S(0, 20, 10)] }).ok);
expect('decline under half, not shared, fails', !c({ settlements: [S(0, 20, 9)] }).ok);
expect('decline under half, shared by the base, holds', compare({ runs: [R({ settlements: [S(0, 20, 9)] })] }, { runs: [R({ settlements: [S(0, 20, 8)] })] }).ok);
expect('more stuck tasks fails', !c({ stuck: 2 }).ok);
expect('fewer stuck tasks holds', c({ stuck: 0 }).ok);
expect('unexplained within tolerance holds', c({ unexplained: 20 }).ok);
expect('unexplained beyond tolerance fails', !c({ unexplained: 30 }).ok);
if (bad) process.exit(1);
// the held tasks' sampling (VB-1812 revision): work unchanged 48 hours is held; a hand walking laden is progress, for 48 hours at most
{
  const held = (laden, until) => {
    const j = { id: 1, key: 'k', claims: [0], rate: 0, done: 0 }, s = { t: 0, jobs: new Map([['k', j]]), agents: [{ job: j, carry: null, path: null }] };
    const seen = new Map(), stuck = new Set();
    for (; s.t <= until; s.t += 6) { const on = laden(s.t); s.agents[0].carry = on ? 'hay' : null; s.agents[0].path = on ? [1] : null; sample(s, seen, stuck); }
    return stuck.size;
  };
  expect('a task unworked 48 hours is held', held(() => false, 48) === 1);
  expect('a hand walking laden 36 hours of 60 is progress', held((t) => t >= 24, 60) === 0);
  expect('a hand walking laden for ever is held', held(() => true, 120) === 1);
}
{
  const bd = compare({ runs: [R({ hungryDays: 300, band: [{ hungryDays: 224, hungerDeaths: 0 }] })] }, { runs: [R({ hungryDays: 328, band: [{ hungryDays: 250, hungerDeaths: 0 }] })] });
  expect('overlapping bands are inside the noise', /224-300 \(base 250-328\) inside the noise/.test(bd.rows[0].hungryDays) && bd.ok);
  const far = compare({ runs: [R({ hungryDays: 900, band: [{ hungryDays: 800, hungerDeaths: 0 }] })] }, base);
  expect('apart is not noise and never fails', !/noise/.test(far.rows[0].hungryDays) && far.ok);
  expect('no band, the old row', c({}).rows[0].hungryDays === '5 (base 5)');
}
console.log('gate-tool ok: extinct by hunger, collapse (under half its own and the base), stuck tasks, unexplained; hunger never fails');

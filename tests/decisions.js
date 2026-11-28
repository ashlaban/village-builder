// @suite fast
// VB-313: sim/decisions. A question asked by kind and settled by its body's procedure: a vote passes an option over the one in force only
// by its margin; a tie at the top, with no presiding pawn (the alderman, VB-314, in a village), takes the question's fallback; one pawn deciding (agent),
// with none to decide, the fallback too. A contested question keeps its ballots, the last 30. A constructed state, no simulation.
const assert = require('assert');
require('../src/load.js');
const D = globalThis.VB['sim/decisions'];
const K = { evaluate: (st, q) => ({ support: q.support, need: q.need }), fallback: (st, q) => (q.current === null ? 2 : q.current) };
D.defineKind('test-vote', { procedure: 'vote', ...K });
D.defineKind('test-agent', { procedure: 'agent', ...K });
assert.throws(() => D.defineKind('test-vote', { procedure: 'vote', ...K }), /Duplicate/);
assert.throws(() => D.defineKind('test-none', { procedure: 'lot', ...K }), /needs a procedure/);
const q = (support, current, need = [0.1, 0.1, 0.1]) => ({ kind: 'test-vote', body: 0, current, options: support.length, support, need });
const st = { t: 5 };
assert.strictEqual(D.procedureFor(st, 0, 'test-vote'), 'vote');
assert.strictEqual(D.ask(st, q([0.3, 0.5, 0.2], 0)), 1, 'an option past the margin displaces the practice');
assert.strictEqual(D.ask(st, q([0.45, 0.48, 0.07], 0)), 0, 'short of the margin, the practice stands');
assert.strictEqual(D.ask(st, q([0.2, 0.7, 0.1], 1)), 1, 'the practice best supported: settled, no ballot kept');
assert.strictEqual(st.decisionLog.length, 2, 'the two contested questions keep their ballots');
assert.deepStrictEqual(st.decisionLog[0], { t: 5, body: 0, kind: 'test-vote', dim: null, procedure: 'vote', current: 0, chosen: 0,
  support: [0.45, 0.48, 0.07], need: 0.1, by: null });
assert.strictEqual(D.ask(st, q([0.4, 0.4, 0.2], null)), 2, 'a tie with nothing in force and no one presiding: the fallback');
assert.strictEqual(D.ask(st, q([0.2, 0.6, 0.2], null)), 1, 'with nothing in force, the best supported');
assert.strictEqual(D.ask(st, { ...q([0.9, 0.1, 0], 1), kind: 'test-agent' }), 1, 'one pawn decides; with none, the fallback');
for (let i = 0; i < 40; i++) D.ask(st, q([0.3, 0.5, 0.2], 0));
assert.strictEqual(st.decisionLog.length, D.LOG, 'the ballots kept are bounded');
assert.strictEqual(D.ask(null, q([0.3, 0.5, 0.2], 0)), 1, 'asked with no state, nothing is kept');
console.log('decisions: ok');

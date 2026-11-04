// The line rules of tests/lint.js on single lines: the page writes to st, and clock or random use in the modules.
const assert = require('assert'), { clockUse, pageWrites, counterUses } = require('./lint-rules.js');
for (const l of ['st.t = 5;', 'st.pawns[3].household = 1', 'st.jobs.set(k, j)', 'st.events.push(e)', 'st.x.y += 2', 'n = ++st.jobSeq', 'st.jobSeq++', 'st.rigDirty.add(3)',
  'st.rigDirty.delete(3)', 'st.treeDirty.clear(); st.owner[i] = 2', 'st.t |= 1', 'st.naturalDeaths.x = 1', 'st.pawns.sort((a, b) => a - b)']) {
  assert(pageWrites(l).length > 0, `forbidden write not found: ${l}`);
}
for (const l of ['st.visualDirty = true;', 'st.naturalDeaths = !st.naturalDeaths;', 'st.driftMul = +v', 'st.rigDirty.clear(); st.treeDirty.clear(); st.biomeDirty.clear()',
  'if (st.t == 5 && st.pawns[1].hunger >= 2) {}', 'const a = st.pawns.slice().sort()', 'x.st.y = 1 // st.t = 1', 'st.pawns.map((p) => p.id)', 'foo(st.t, st.pawns[2])']) {
  assert.deepStrictEqual(pageWrites(l), [], `allowed line flagged: ${l}`);
}
assert(clockUse('const r = Math.random();') && clockUse('t = Date.now()') && clockUse('new Date(0)') && clockUse('performance.now()'));
assert.strictEqual(clockUse('x = Math.random() // lint-allow: clock the page needs it'), null);
assert.strictEqual(clockUse('const mulberry32 = (a) => a;'), null);

const names = new Set(['walkStep']);
for (const line of ['const n = VB.count.walkStep;', 'if (VB.count.walkStep) act();', 'VB.count.nope++;',
  'const { count } = VB;', 'const { count: C } = VB; if (C.walkStep > 9) act();',
  'const { count: C } = globalThis.VB;', 'if (a) VB.count.walkStep++;', 'VB.count.walkStep = 0;', 'const used = VB.count.walkStep++;', 'if (VB.count.walkStep++) act();', 'VB.count.walkStep += VB.count.walkStep;', "const counts = VB['count'];"]) {
  assert(counterUses(line, names).length, `counter read not caught: ${line}`);
}
for (const line of ['VB.count.walkStep++;', 'VB.count.walkStep += agents.length;', 'if (a) { VB.count.walkStep++; }',
  "const { bfs } = VB['sim/hex'];"]) {
  assert.deepStrictEqual(counterUses(line, names), []);
}
console.log('lintrules ok');

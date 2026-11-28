// @suite fast
// The line rules of tests/lint.js on single lines: the page writes to st, and clock or random use in the modules.
const assert = require('assert'), { clockUse, pageWrites, counterUses, splitTask } = require('./lint-rules.js');
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

// The width lint leaves out an export read by registries alone (VB-454).
const { exportReaders, leftOut } = require('./lint-rules.js');
const REG = { 'sim/kinds': 'job kinds', 'sim/clock': 'the calendar' };
const srcs = {
  'sim/fields': "VB['sim/fields'] = (() => { return { hoed, shared, idle }; })();",
  'sim/kinds': "const { hoed, shared } = VB['sim/fields'];",
  'sim/clock': "const F = VB['sim/fields']; F.hoed(st); // VB['sim/fields'].idle",
  'sim/plans': "const { shared } = VB['sim/fields'];",
  sim: "const { idle } = VB['sim/fields'];",
};
const rd = exportReaders(srcs)['sim/fields'];
assert.deepStrictEqual(leftOut(['hoed', 'shared', 'idle'], rd, REG), { hoed: ['sim/clock', 'sim/kinds'] }, 'registries alone: left out; a second module or none: counted');
const whole = { 'sim/clock': "const A = VB['m']; run(A);" };
assert.deepStrictEqual(Object.keys(leftOut(['x'], exportReaders(whole).m, REG)), ['x'], 'a namespace passed whole is read in full, by a registry here');
assert.deepStrictEqual(leftOut(['x'], exportReaders({ ...whole, p: "VB['m'].x" }).m, REG), {}, 'a non-registry reader counts');
// VB-1944: a name given to the page (its module's PAGE list) and read by no other module, or by registries alone, is left out, and so is
// the PAGE list; a given name another module reads counts
assert.deepStrictEqual(leftOut(['hoed', 'shared', 'idle', 'PAGE'], rd, REG, ['idle', 'shared', 'hoed']),
  { hoed: ['sim', 'sim/clock', 'sim/kinds'], idle: ['sim'], PAGE: ['sim'] }, 'given to the facade alone: left out');
{ // the split collector: an unticked line naming the key splits it; a ticked line, or a line of another collector, does not
  const { COLLECT } = require('../tools/lib/collect.js'), text = '- [x] From VB-7: sim/ticked: 720 lines\n- [ ] From VB-8: sim/byre: 760 lines, over 700\n- [ ] sim/goods.js: 16 exports';
  const held = [{ id: 'VB-9', title: COLLECT.split.name, status: 'ready', text }, { id: 'VB-10', title: COLLECT.teleport.name, status: 'ready', text: '- [ ] sim/herds: hay' }];
  assert.strictEqual(splitTask('sim/byre', held), 'VB-9');
  assert.strictEqual(splitTask('sim/goods', held), 'VB-9', 'the key may carry .js');
  assert.strictEqual(splitTask('sim/ticked', held), null, 'a ticked line splits nothing');
  assert.strictEqual(splitTask('sim/by', held), null, 'a key matches whole');
  assert.strictEqual(splitTask('sim/herds', held), null, 'only the split collector counts');
  assert.strictEqual(splitTask('sim/byre', [{ ...held[0], status: 'done (2026-11-25)' }]), null, 'a done collector splits nothing');
  assert.strictEqual(splitTask('sim/relations', [{ id: 'VB-1', title: 'Refactor: split sim/relations by concern', status: 'ready' }]), null,
    'a task of its own no longer counts');
}
console.log('lintrules ok');

// VB-1473: sim/due, the due-queue helper, on constructed lists: ties, removal of an absent entry, an empty list, the take.
const { readSource } = require('../tools/lib/source.js');
const assert = require('assert'), vm = require('vm');
const sandbox = { VB: {} };
vm.runInNewContext(readSource('src/sim/due.js'), sandbox);
const D = sandbox.VB['sim/due'];
const due = (e) => e.due, id = (e) => e.id, at = (k, ctx) => ctx[k], self = (k) => k;
const ids = (q) => q.map((e) => e.id).join(',');
// An empty list: every search gives 0, nothing is removed, nothing is due.
assert.strictEqual(D.at([], 5, 1, due, id), 0);
assert.strictEqual(D.after([], 5, due), 0);
assert.strictEqual(D.remove([], { due: 1, id: 1 }, 1, 1, due, id), false);
assert.strictEqual(D.count([], 99, due), 0);
assert.strictEqual(D.take([], 99, due).length, 0);
// By due then id: ties at the same due are ordered by id whatever the order of insertion.
const q = [];
for (const e of [{ due: 3, id: 4 }, { due: 1, id: 9 }, { due: 3, id: 2 }, { due: 3, id: 7 }, { due: 2, id: 1 }])
  D.insert(q, e, e.due, e.id, due, id);
assert.strictEqual(ids(q), '9,1,2,4,7');
assert.strictEqual(D.at(q, 3, 4, due, id), 3);
assert.strictEqual(D.at(q, 3, 5, due, id), 4);
// Removal: only the entry itself, found at its (due, id); an absent one, or another object at the same place, leaves the list.
assert.strictEqual(D.remove(q, { due: 3, id: 4 }, 3, 4, due, id), false);
assert.strictEqual(D.remove(q, q[3], 3, 4, due, id), true);
assert.strictEqual(ids(q), '9,1,2,7');
assert.strictEqual(D.remove(q, q[0], 1, 9, due, id), true);
assert.strictEqual(D.remove(q, { due: 8, id: 8 }, 8, 8, due, id), false);
assert.strictEqual(ids(q), '1,2,7');
// By due alone: a new entry goes after those due at the same time (the order of insertion among ties).
const r = [];
for (const e of [{ due: 2, id: 'a' }, { due: 1, id: 'b' }, { due: 2, id: 'c' }, { due: 1, id: 'd' }, { due: 3, id: 'e' }, { due: 2, id: 'f' }])
  D.append(r, e, e.due, due);
assert.strictEqual(ids(r), 'b,d,a,c,f,e');
// The take: the entries due by t, off the head, in order; the rest stay; nothing due gives an empty array.
assert.strictEqual(D.count(r, 2, due), 5);
assert.strictEqual(D.take(r, 0.5, due).length, 0);
assert.strictEqual(ids(D.take(r, 1, due)), 'b,d');
assert.strictEqual(ids(r), 'a,c,f,e');
assert.strictEqual(ids(D.take(r, 10, due)), 'a,c,f,e');
assert.strictEqual(r.length, 0);
// A key read through ctx, as st.legDue's (pawn ids, the due their leg's): the context is handed to the key, no closure is made.
const dues = [5, 2, 5, 1], s = [];
for (const k of [0, 1, 2, 3]) D.insert(s, k, dues[k], k, at, self, dues);
assert.strictEqual(s.join(','), '3,1,0,2');
assert.strictEqual(D.remove(s, 2, 5, 2, at, self, dues), true);
assert.strictEqual(s.join(','), '3,1,0');
console.log('due: ok');

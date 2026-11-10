// The save codec (VB-074, sim/saves): encode, JSON text, decode gives a deep copy with the same sharing, types and odd values.
const assert = require('assert');
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, { encode, decode } = VB['sim/saves'];
const { canon } = require('./lib/canon.js');
const trip = (v) => decode(JSON.parse(JSON.stringify(encode(v))));

// a small graph with every case
const shared = { name: 'shared' }, ring = { name: 'ring' }; ring.self = ring;
const ta = Float32Array.from([1.5, NaN, -0, Infinity]);
const v = {
  a: shared, b: [shared, shared], m: new Map([[1, shared], ['k', [ta]], [shared, 'object key']]), s: new Set([shared, 2, 'x']),
  ring, ta, ta2: ta, i8: Int8Array.from([-1, 2]), odd: [NaN, Infinity, -Infinity, -0, undefined, null, true, ''], $dollar: { $id: 'not an id', $ref: 3 },
  arr: [1, 2], arrAgain: null,
};
v.arrAgain = v.arr;
const c = trip(v);
assert.strictEqual(c.a, c.b[0]); assert.strictEqual(c.b[0], c.b[1]); assert.strictEqual(c.m.get(1), c.a); assert.ok(c.s.has(c.a));
assert.strictEqual([...c.m.keys()][2], c.a, 'an object as a Map key comes back as the same object');
assert.strictEqual(c.ring.self, c.ring, 'a cycle survives');
assert.ok(c.ta instanceof Float32Array && c.ta === c.ta2 && c.m.get('k')[0] === c.ta, 'a shared typed array stays one array');
assert.ok(Number.isNaN(c.ta[1]) && Object.is(c.ta[2], -0) && c.ta[3] === Infinity && c.ta[0] === 1.5);
assert.ok(c.i8 instanceof Int8Array && c.i8[0] === -1);
assert.ok(Number.isNaN(c.odd[0]) && c.odd[1] === Infinity && c.odd[2] === -Infinity && Object.is(c.odd[3], -0) && c.odd[4] === undefined && c.odd[5] === null);
assert.deepStrictEqual(c.$dollar, { $id: 'not an id', $ref: 3 }, 'keys starting with $ are escaped');
assert.strictEqual(c.arr, c.arrAgain, 'a shared array stays one array');
assert.deepStrictEqual(Object.keys(c), Object.keys(v), 'key order is kept');
assert.throws(() => encode({ f: () => 1 }), /a function at st\.f/);
assert.throws(() => encode({ d: new Date(0) }), /a Date at st\.d/);
assert.throws(() => encode({ a: [{ m: new Map([['k', { f: () => 1 }]]) }] }), /a function at st\.a\[0\]\.m\.get\(k\)\.f/, 'the path is spelled out');

// VB-226: what JSON writes as it is comes back as it is, not copied; an object beside an odd value is copied, its plain parts not
const plain = { a: [1, 'x', { b: true, c: null }], d: { e: 2 } }, mixed = { p: plain.d, q: [NaN, plain.a] };
assert.strictEqual(encode(plain), plain, 'a plain tree is not copied');
const em = encode({ ...mixed, p: { ...plain.d } });
assert.ok(em.q !== mixed.q && em.q[1] === plain.a && em.q[0].$num === 'NaN', 'only the path to an odd value is copied');
assert.deepStrictEqual(decode(JSON.parse(JSON.stringify(encode({ m: new Map([[1, 2], ['a', [3]]]) })))).m, new Map([[1, 2], ['a', [3]]]));
assert.deepStrictEqual(JSON.parse(JSON.stringify(encode(new Map([[1, 2]])))), { $kv: [1, 2] }, 'a Map is flat');
assert.deepStrictEqual(decode({ $map: [[1, { $set: [2] }]] }), new Map([[1, new Set([2])]]), 'a format-1 Map is read');
// a packed object: written as its data, made again by its reviver, its sharing kept
const box = { n: [1, 2] }, packed = { one: box, two: box }, pack = new Map([[box, { as: 'box', data: box.n.join(',') }]]);
const pj = JSON.parse(JSON.stringify(encode(packed, null, pack))), pb = decode(pj, { box: (s) => ({ n: s.split(',').map(Number) }) });
assert.ok(pj.one.$as === 'box' && pj.two.$ref === pj.one.$id && pb.one === pb.two && pb.one.n[1] === 2, 'a packed object is made again, shared');
assert.throws(() => decode(pj), /no way to make a packed box/);

// a real state: seeded founders after a year, every key (the world aside) the same canonical text after a trip through JSON
const it = G.generate(7); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, 7, 'founders'); Sim.advance(st, Sim.YEAR);
const { w, ...rest } = st, text = JSON.stringify(encode(rest)), back = decode(JSON.parse(text));
for (const k of Object.keys(rest)) assert.strictEqual(canon(back[k]), canon(rest[k]), `founders 7, year 1: ${k} differs after a trip`);
assert.strictEqual(back.cenv.people, back.pawns, 'cenv.people is pawns itself after a trip');
console.log(`codec ok: sharing, cycles, Maps, Sets, typed arrays, odd numbers and $ keys survive; founders 7 after a year: ${(text.length / 1024).toFixed(0)} KB of JSON, every key the same`);

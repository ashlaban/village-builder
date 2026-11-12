// sim/leanings, pulls (VB-398): what draws a person towards a way of a custom, as the daily drift weighs it, for the note of a voice on the
// Customs tab. A view: it changes nothing.
const assert = require('assert');
const VB = require('../src/load.js'), C = VB.culture, L = VB['sim/leanings'];
const d = C.IDX.feedOrder, o = C.OFF[d], equal = C.optIndex('feedOrder', 'equal'), children = C.optIndex('feedOrder', 'children');
const att = (share) => { const a = new Float32Array(C.TOTAL).fill(0); share.forEach((v, j) => { a[o + j] = v; }); return a; };
const person = (id, share, more = {}) => ({ id, alive: true, age: 40, prestige: 1, att: att(share), anc: att(share), ties: new Map(), interest: null,
  advocate: null, ...more });
const people = [], byId = (id) => people[id], add = (...a) => { const p = person(people.length, ...a); people.push(p); return p; };

// raised to it: leanings moved off what was learned young, nothing else pulls
const raised = add([0.4, 0.4, 0.2], { anc: att([0.7, 0.2, 0.1]) });
let w = L.pulls(raised, d, equal, byId);
assert(w.upbringing > 0 && w.company === 0 && w.cause === 0 && w.interest === 0 && !w.own, 'only upbringing pulls one with no ties');
assert(Math.abs(w.upbringing - C.P.anchor.village * 0.3) < 1e-6, 'upbringing is the anchor rate times the distance');
assert(L.pulls(raised, d, children, byId).upbringing < 0, 'and it pulls away from the other way');

// company: the tie that weighs most among those who favour the way is the friend; one who favours another way is not
const light = add([0.9, 0.05, 0.05]), heavy = add([0.8, 0.1, 0.1]), other = add([0.1, 0.8, 0.1]);
const met = add([0.4, 0.4, 0.2]); met.ties.set(light.id, 1); met.ties.set(heavy.id, 3); met.ties.set(other.id, 5);
w = L.pulls(met, d, equal, byId);
assert.strictEqual(w.friend, heavy.id, 'the heaviest tie that favours the way');
assert.strictEqual(L.pulls(met, d, children, byId).friend, other.id);
const mean = (1 * 0.9 + 3 * 0.8 + 5 * 0.1) / 9;
assert(Math.abs(w.company - C.DIMS[d].m * C.P.social * (mean - 0.4)) < 1e-6, 'company is the weighted mean of the ties against the leaning');
const mixed = L.pulls(met, d, equal, byId, 0.9).company;
assert(Math.abs(mixed - C.DIMS[d].m * C.P.social * ((1 - C.P.oblique) * mean + C.P.oblique * 0.9 - 0.4)) < 1e-6, "the settlement's mean is mixed in");

// a cause argued near them, and one's own
const arguer = add([0.1, 0.8, 0.1], { advocate: { dim: d, opt: children, until: 10 } });
const near = add([0.5, 0.3, 0.2]); near.ties.set(arguer.id, 2); near.ties.set(light.id, 2);
w = L.pulls(near, d, children, byId);
assert(w.cause > 0 && w.arguer === arguer.id, 'the arguer among the ties presses their way');
assert(L.pulls(near, d, equal, byId).cause < 0 && L.pulls(near, d, equal, byId).arguer === null, 'and presses against the others');
assert.strictEqual(L.pulls(arguer, d, children, byId).own, true); assert.strictEqual(L.pulls(arguer, d, equal, byId).own, false);

// interest, and nothing written
const keen = add([0.3, 0.3, 0.4], { interest: att([0, 0, 1]) });
assert(L.pulls(keen, d, 2, byId).interest > 0 && L.pulls(keen, d, 0, byId).interest < 0);
const before = JSON.stringify(people.map((p) => [[...p.att], [...p.anc], [...p.ties]]));
for (const p of people) for (let j = 0; j < 3; j++) L.pulls(p, d, j, byId, 0.3);
assert.strictEqual(JSON.stringify(people.map((p) => [[...p.att], [...p.anc], [...p.ties]])), before, 'pulls changes nothing');
console.log('pulls: upbringing, company and its friend, a cause and its arguer, interest and one\'s own cause; nothing written');

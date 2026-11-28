// @suite integration
// A caller sits with those indoors (VB-1559; design.md, Own time, and Where pawns meet): a pawn at the pastime `visit`, arrived at the
// house it calls at, is present at that house's encounter. On the probe's village: a caller at the door and its friend inside talk within
// a day of talk hours; a passer-by at the same spot, on no visit, draws nobody inside and is drawn by nobody inside.
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim;
const probe = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');
const P = VB['sim/pastimes'], E = VB['sim/encounters'], R = VB['sim/relations'], A = VB['sim/agents'];
const { placeOf } = VB['sim/pose'], { age } = VB['sim/records'], { cal, WORK } = VB['sim/rules'];
const { issue } = VB['sim/commands'];

const st = probe.state();
st.naturalDeaths = false;
while (cal(st.t).hour !== WORK[0] + 2) Sim.advance(st, 1);
const ag = st.agents;
const hhOf = (p) => st.households[p.household], farmOf = (p) => st.farmsteads[hhOf(p).farmstead];
const adults = st.pawns.filter((p) => p.alive && age(st, p) >= 18);
const x = adults[0], y = adults.find((q) => farmOf(q) !== farmOf(x) && farmOf(q).village === farmOf(x).village);
const w = adults.find((q) => q !== x && farmOf(q) !== farmOf(y) && hhOf(q) !== hhOf(x));
assert.ok(y && w, 'a friend on another farm of the village, and a passer-by');
const yh = hhOf(y), house = farmOf(y).house;
// everyone else far off and out of doors, so that the only ones about are the three
for (const id of st.living) {
  const g = ag[id];
  A.release(st, g); A.standStill(st, g);
  g.inside = false; g.occasion = null; g.talk = null; g.x = 50 + (id % 40) * 40; g.y = 50 + Math.floor(id / 40) * 40;
}
x.bands.set(y.id, 1);
// y indoors by its fire, x calls on it and walks there
A.placeAtHome(st, ag[y.id]); A.idle(st, ag[y.id], st.t + 12);
assert.ok(E.atHome(st, ag[y.id]), 'the friend sits indoors at home');
assert.strictEqual(issue(st, { actor: x.id, verb: 'pastime', target: 'visit', args: { with: y.id, until: st.t + 12 }, source: 'player' }), true);
const xg = ag[x.id];
// arrived: at the end of its walk, by the door
const end = xg.path[xg.path.length - 1];
A.standStill(st, xg); xg.x = end[0]; xg.y = end[1]; xg.idleUntil = st.t + 12;
assert.strictEqual(P.of(st, x.id).kind, 'visit', 'the caller is at its visit');
assert.ok(Math.hypot(xg.x - st.w.hx[house], xg.y - st.w.hy[house]) <= P.PASTIME.yard, 'by the house it calls at');

// one day of talk hours: whom each of the pair is drawn with, and whom the other pawn draws
function day(caller) {
  const met = new Set();
  for (let h = 0; h < 24; h++) {
    for (const id of st.living) ag[id].talk = null;
    const near = E.outdoors(st, placeOf);
    R.talkHour(st, h, near);
    const t = ag[caller].talk;
    if (t) met.add(t.with);
  }
  return met;
}
const near = E.outdoors(st, placeOf);
assert.strictEqual(near.callAt.get(x.id), yh.id, 'the caller is listed at its friend\'s house');
assert.deepStrictEqual(E.ENCOUNTERS.house.present(st, yh, near).includes(x.id), true, 'and present at it');
const found = [], busy = new Int32Array(st.agents.length + 8);
E.partners(st, xg, near, busy, 1, found);
assert.ok(found.some((g) => g.id === y.id), 'the caller may draw its friend inside');
E.partners(st, ag[y.id], near, busy, 2, found);
assert.ok(found.some((g) => g.id === x.id), 'and its friend inside may draw the caller');
const t0 = st.talks;
const met = day(x.id);
assert.ok(met.has(y.id), `the caller and its friend inside talk within a day (met ${[...met]})`);

// a passer-by at the same spot, on no visit: nobody inside draws it, nor does it draw anyone inside
const wg = ag[w.id];
xg.x = 3000; xg.y = 3000; xg.pastime = undefined;
wg.x = end[0]; wg.y = end[1]; wg.inside = false; wg.idleUntil = st.t + 12;
assert.strictEqual(P.of(st, w.id), null, 'the passer-by is at no pastime');
const near2 = E.outdoors(st, placeOf);
assert.ok(!near2.callAt.has(w.id) && !near2.callAt.has(x.id), 'neither is a caller now');
E.partners(st, wg, near2, busy, 3, found);
assert.ok(!found.some((g) => g.id === y.id), 'the passer-by does not draw one inside');
E.partners(st, ag[y.id], near2, busy, 4, found);
assert.ok(!found.some((g) => g.id === w.id), 'nor is it drawn from inside');
assert.ok(!day(w.id).has(y.id), 'the passer-by and the one inside do not talk');
for (const id of st.living) st.pawns[id].homeHours = 0; // the talk hours above were walked more than once
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`visitors ok: a caller at the door talks with its friend inside within a day (${st.talks - t0} talks); a passer-by does not`);

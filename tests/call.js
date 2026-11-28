// @suite integration
// A call at a farm (VB-1119; design.md, Where pawns meet), on a constructed state (tests/lib/probe.js, two villages of two farms): an
// unmarried man calls at the farm of an unmarried woman of the other village. The verb refuses a farm of his own household and a second
// call in a week; a call is an evening in the farm's yard, the caller and the household asked; two calls raise his tie to her until she
// is in his match list (sim/opportunities).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, O = VB['sim/occasions'], R = VB['sim/relations'], E = VB['sim/encounters'], A = VB['sim/agents'];
const OP = VB['sim/opportunities'];
const { DAY, YEAR, TICKS } = VB['sim/rules'], { issue } = VB['sim/commands'];
const { state } = require('./lib/probe.js'), { checkState } = require('./lib/invariants.js');

const st = state();
st.naturalDeaths = false;
const hhs = st.households.filter((h) => !h.dissolved && h.farmstead !== null);
const vil = (h) => st.farmsteads[h.farmstead].village;
const hm = hhs.find((h) => hhs.some((g) => vil(g) !== vil(h)));
const hw = hhs.find((g) => vil(g) !== vil(hm));
const pick = (hh, sex) => hh.members.find((id) => st.pawns[id].age >= 18 && st.pawns[id].sex === sex);
const man = pick(hm, 'm'), woman = pick(hw, 'f');
assert.ok(man !== undefined && woman !== undefined, 'a man and a woman of age in two villages');
// the two unmarried, of age, fit to marry (a constructed state's own tweak)
for (const id of [man, woman]) {
  const p = st.pawns[id];
  p.retired = false; // lint-allow: owner a constructed state
  p.born = st.t - 25 * YEAR; // lint-allow: owner a constructed state
}
// they are widowed (their unions are dropped, and the record's index with them), so they are unmarried
for (const id of [man, woman]) st.unions = st.unions.filter((u) => u.a !== id && u.b !== id); // lint-allow: owner a constructed state
st.idx = null; // lint-allow: owner a constructed state
assert.strictEqual(VB['sim/records'].spouseOf(st, man), null, 'he is unmarried');
assert.strictEqual(VB['sim/records'].spouseOf(st, woman), null, 'she is unmarried');
const set = (t) => {
  st.t = t;
  st.tick = Math.round(t * TICKS);
};
set(st.t - (st.t % DAY) + 8);
const call = (target = hw.farmstead) => issue(st, { actor: man, verb: 'callAt', target, source: 'player' });
const calls = () => st.occasions.filter((o) => o.kind === 'call');
const known = () => OP.forPawn(st, OP.actorView(st, man), man).filter((i) => i.verb === 'match' && i.target === woman);
Sim.inhabit(st, man);
assert.strictEqual(known().length, 0, 'he does not know her: she is not in his match list');

assert.notStrictEqual(call(hm.farmstead), true, 'not at his own household');
let r = call();
assert.strictEqual(r, true, `a call is allowed: ${r}`);
assert.strictEqual(st.pawns[man].called, st.t, 'the call is dated');
r = call();
assert.ok(typeof r === 'string' && /this week/.test(r), `one call a week: ${r}`);
assert.strictEqual(calls().length, 1);
assert.deepStrictEqual(calls()[0].for, [man]);
const asked = (o) => o.asked.map((g) => g.id);
assert.ok(asked(calls()[0]).includes(man) && asked(calls()[0]).includes(woman), 'the caller and the household are asked');

// the evening: the two stand at the yard, the others are indoors, and the talk hours run; then the occasion ends
function evening() {
  const o = calls()[0];
  for (const id of st.living) st.agents[id].inside = true;
  for (const id of [man, woman]) {
    const g = st.agents[id];
    A.release(st, g);
    A.standStill(st, g);
    Object.assign(g, { inside: false, occasion: o.id, path: null, x: o.x, y: o.y, talk: null });
    if (!o.come.includes(id)) o.come.push(id);
  }
  o.asked = [];
  for (let h = 18; h < 22; h++) {
    st.t = st.t - (st.t % DAY) + h;
    R.talkHour(st, h, E.outdoors(st, VB['sim/pose'].placeOf));
  }
  set(o.end);
  o.due = o.end;
  st.occasions.splice(st.occasions.indexOf(o), 1);
  st.occasions.unshift(o);
  O.occasionsDue(st);
}
const tie = () => VB['sim/ties'].tieOf(st, man, woman);
let t0 = tie();
evening();
assert.ok(tie() > t0, `a call raises his tie to her (${t0} to ${tie()})`);
assert.strictEqual(calls().length, 0, 'the call is over');
assert.strictEqual(st.agents[man].occasion, null, 'and he is free of it');
set(st.t - (st.t % DAY) + 8 + 7 * DAY);
assert.strictEqual(call(), true, 'a week on he may call again');
t0 = tie();
evening();
assert.ok(tie() > t0, `a second call raises it again (${t0} to ${tie()})`);
assert.strictEqual(known().length, 1, 'she is in his match list');
assert.deepStrictEqual(checkState(st).filter((b) => /occasion|called/.test(b)), [], 'the occasions hold'); // the rest of the state was bent by the test
console.log('call: ok');

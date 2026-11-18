// The head's choice of what its fields bear (VB-355; design.md, How the head chooses what to sow, The player as head). On a tiny farm at
// seed 7, constructed states: the verb `rotation` under its checks (the head alone, a known rotation, the seed of every crop of it, no
// field under a crop it has not), any rotation there is seed for and not only the village's usual one; with hold, the head's choice kept
// against the village's usual rotation at its plan's reviews, and given back to the rule by rotation null; the rule itself reaching the
// same verb; the verb `sowOutOfTurn` under its checks (the field free, the crop's window open, a field's seed of it), the field going on
// to its next step when its year out of turn is over, a year's rest, and back to its turn; the played head reaching both through
// Sim.head; the field's view for its tile's card; a refusal changes nothing; the invariants of each state.
const assert = require('assert'), VB = require('../src/load.js');
const { CROPS, ROTATIONS, DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'];
const F = VB['sim/fields'], Plans = VB['sim/plans'], { issue } = VB['sim/commands'];
const { setClock } = require('./lib/clock.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const ok = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants: ${what}`);
const at = (season, sday, year = 1) => ((year - 1) * YEAR_DAYS + season * SEASON_DAYS + sday) * DAY + 8; // 08:00 of that day
const crops = (f) => f.fields.map((fd) => fd.crop).sort().join();
function farm(usual, grain, t = at(0, 2)) {
  const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
  const f = st.farmsteads[0], hh = st.households[f.household], v = st.villages[f.village];
  while (f.fields.length > 3) f.fields.pop();
  assert.strictEqual(f.fields.length, 3, 'the tiny farm has three fields');
  v.rotation = usual;
  hh.grain = grain;
  setClock(st, t);
  const s = { st, f, hh, v, plan: Plans.planOf(st, 'household', hh.id) };
  s.cmd = (verb, args, actor = hh.holder) => issue(st, { actor, verb, target: hh.id, args, source: 'player' });
  s.review = (time) => {
    setClock(st, time);
    Plans.reviewed(st, s.plan, cal(st.t));
  };
  return s;
}
const refused = (s, verb, args, re, actor) => {
  const before = JSON.stringify(s.f), r = s.cmd(verb, args, actor);
  assert(typeof r === 'string' && re.test(r), `${verb} ${JSON.stringify(args)} refused for ${re}: ${r}`);
  assert.strictEqual(JSON.stringify(s.f), before, 'a refusal changes nothing');
};

{ // the verb rotation: its checks, and any rotation there is seed for
  const s = farm('every', { barley: 400, peas: CROPS.peas.seed });
  const other = s.hh.members.find((id) => id !== s.hh.holder);
  if (other !== undefined) refused(s, 'rotation', { rotation: 'two' }, /only its head/, other);
  refused(s, 'rotation', {}, /a rotation is named/);
  refused(s, 'rotation', { rotation: 'four' }, /no rotation four/);
  refused(s, 'rotation', { rotation: 'toString' }, /no rotation/);
  refused(s, 'rotation', { rotation: 'three' }, /no seed of rye: a field takes 25 and its store holds 0/);
  // the village farms barley every year; the head takes barley and peas by turns all the same, and keeps it
  assert.strictEqual(s.cmd('rotation', { rotation: 'peas', hold: true }), true, 'barley and peas by turns');
  assert(s.f.fields.every((fd) => fd.rotation === 'peas' && fd.crop === ROTATIONS.peas.courses[fd.step]), 'every field in the rotation');
  assert.strictEqual(crops(s.f), 'barley,barley,peas', 'staggered');
  assert.strictEqual(s.f.rotationBy, s.hh.id, 'kept by its head');
  ok(s.st, 'a rotation chosen');
  s.review(at(0, 3));
  assert(s.f.fields.every((fd) => fd.rotation === 'peas'), "the rule leaves the head's choice alone");
  // a field under a crop the new rotation has not: the change waits
  const peas = s.f.fields.find((fd) => fd.crop === 'peas');
  F.sown(peas, cal(s.st.t));
  refused(s, 'rotation', { rotation: 'two' }, /stands under peas, which two courses has not/);
  assert.strictEqual(F.fieldView(s.st, peas.tile).rotations.find((r) => r.key === 'two').why, s.cmd('rotation', { rotation: 'two' }), "the view's reason is the verb's");
  Object.assign(peas, { stage: 'stubble', sown: null });
  // given back to the rule: at its next review the farm takes the village's usual rotation again, through the same verb
  assert.strictEqual(s.cmd('rotation', { rotation: null }), true, 'given back');
  assert(s.f.rotationBy === undefined && s.f.fields.every((fd) => fd.rotation === 'peas'), 'nothing moves at once');
  s.review(at(0, 4));
  assert(s.f.fields.every((fd) => fd.rotation === 'every' && fd.crop === 'barley'), "the rule takes the village's usual rotation");
  ok(s.st, 'given back');
  // without hold the choice lasts until the rule's next review
  assert.strictEqual(s.cmd('rotation', { rotation: 'two' }), true);
  assert(s.f.rotationBy === undefined && s.f.fields.every((fd) => fd.rotation === 'two'));
  s.review(at(0, 5));
  assert(s.f.fields.every((fd) => fd.rotation === 'every'), 'not kept: the rule chooses again');
}
{ // the rule goes through the verb: with the verb gone, the review changes nothing
  const s = farm('three', { barley: 400, rye: 100 });
  const V = VB['sim/commands'].VERBS, run = V.rotation.run;
  let calls = 0;
  V.rotation.run = (st, c) => {
    calls++;
    assert.strictEqual(c.source, 'pawn', "the rule's source");
    run(st, c);
  };
  s.review(at(0, 3));
  V.rotation.run = run;
  assert.strictEqual(calls, 1, 'the rule issued the verb once');
  assert(s.f.fields.every((fd) => fd.rotation === 'three'), 'and the farm took three courses');
  ok(s.st, 'the rule');
}
{ // sown out of turn: rye on a farm of barley every year, in autumn
  const s = farm('every', { barley: 400, rye: CROPS.rye.seed, peas: CROPS.peas.seed }, at(0, 2));
  const [a, b, c] = s.f.fields;
  refused(s, 'sowOutOfTurn', { tile: -1, crop: 'rye' }, /no field on tile/);
  refused(s, 'sowOutOfTurn', { tile: a.tile, crop: 'oats' }, /no crop oats/);
  refused(s, 'sowOutOfTurn', { tile: a.tile, crop: 'rye' }, /rye is sown in autumn, days 1 to 6/);
  refused(s, 'sowOutOfTurn', { tile: a.tile, crop: 'barley' }, /bears barley next as it is/);
  F.sown(b, cal(s.st.t));
  refused(s, 'sowOutOfTurn', { tile: b.tile, crop: 'peas' }, /under barley: it is free when its crop is in/);
  Object.assign(b, { stage: 'stubble', sown: null });
  // peas in spring: the window is open and the store holds a field's seed
  assert.strictEqual(s.cmd('sowOutOfTurn', { tile: a.tile, crop: 'peas' }), true, 'peas out of turn');
  assert(a.crop === 'peas' && a.turn === true && a.step === 0 && a.rotation === 'every', JSON.stringify(a));
  ok(s.st, 'out of turn');
  s.review(at(0, 3));
  assert(a.crop === 'peas' && s.f.fields.every((fd) => fd.rotation === 'every'), 'the rule leaves a field out of turn alone');
  const view = F.fieldView(s.st, a.tile);
  assert(view.turn && view.crop === 'peas' && view.next.crop === 'peas' && view.label === 'barley every year', JSON.stringify(view));
  assert.deepStrictEqual(view.seed.map((x) => [x.crop, x.held, x.field]), [['barley', 400, 25], ['rye', 25, 25], ['peas', 20, 20]], 'the seed held of each crop');
  // back to its turn, and out again; when its crop is in, the field goes on in its rotation
  assert.strictEqual(s.cmd('sowOutOfTurn', { tile: a.tile, crop: 'barley' }), true, 'back to its turn');
  assert(a.crop === 'barley' && a.turn === undefined);
  assert.strictEqual(s.cmd('sowOutOfTurn', { tile: a.tile, crop: 'peas' }), true);
  F.sown(a, cal(s.st.t));
  a.stage = 'ripe';
  F.reaped(s.st, a, cal(s.st.t));
  F.carried(a, 1e9); // its stooks carried in: the field is hauled
  assert(a.crop === 'barley' && a.turn === undefined && a.step === 0, `its year over, barley again: ${JSON.stringify(a)}`);
  ok(s.st, 'its year over');
  // rye in autumn; short of seed it is refused; a year's rest needs no seed and no window
  Object.assign(a, { stage: 'stubble', sown: null, reaped: null, held: 0 });
  setClock(s.st, at(2, 1));
  assert.strictEqual(s.cmd('sowOutOfTurn', { tile: a.tile, crop: 'rye' }), true, 'rye in autumn');
  s.hh.grain.rye = CROPS.rye.seed - 1;
  refused(s, 'sowOutOfTurn', { tile: c.tile, crop: 'rye' }, /no seed of rye: a field takes 25 and its store holds 24/);
  c.stage = 'plowed';
  assert.strictEqual(s.cmd('sowOutOfTurn', { tile: c.tile, crop: 'fallow' }), true, "a year's rest");
  assert(c.crop === 'fallow' && c.turn === true && c.stage === 'stubble', JSON.stringify(c));
  ok(s.st, 'rye and a rest');
  // short of rye at its sowing, the rule does not fall back for a field out of turn: the field waits
  s.review(at(2, 2));
  assert(s.f.fields.every((fd) => fd.rotation === 'every') && a.crop === 'rye', 'the field waits');
  // a change of rotation ends the year out of turn of a field not sown
  assert.strictEqual(s.cmd('rotation', { rotation: 'two', hold: true }), true);
  assert(s.f.fields.every((fd) => fd.turn === undefined && fd.crop === ROTATIONS.two.courses[fd.step]), 'every field in its turn');
  ok(s.st, 'a new rotation');
}
{ // the played head reaches both through Sim.head; a pawn that is not the head is refused
  const s = farm('every', { barley: 400, peas: 100 });
  assert.strictEqual(VB.sim.head(s.st, 'rotation', { rotation: 'peas' }), 'no pawn is played');
  assert.strictEqual(VB.sim.inhabit(s.st, s.hh.holder), true);
  assert.strictEqual(VB.sim.head(s.st, 'rotation', { rotation: 'peas', hold: true }), true, 'the played head sets the rotation');
  const fd = s.f.fields.find((q) => q.crop === 'barley');
  assert.strictEqual(VB.sim.head(s.st, 'sowOutOfTurn', { tile: fd.tile, crop: 'peas' }), true, 'and sows a field out of turn');
  assert(fd.turn === true && fd.crop === 'peas');
  ok(s.st, 'the played head');
  assert.strictEqual(F.fieldView(s.st, s.f.house), null, 'no field on the house');
}
console.log('sowing ok: the verb rotation under its checks, kept and given back; the rule through the verb; a field sown out of turn, rested, back to its turn and on in its rotation; the played head');

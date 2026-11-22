// The head chooses what to sow, by foresight (VB-351; design.md, How the head chooses what to sow). On a tiny farm at seed 7, constructed
// states: the three heads by skill (SOWING's fifths); a poor head keeping the rotation it took over, and in a hungry year sowing its
// fallow field; an ordinary head taking the village's usual one and resting a worn field first; a good head choosing its own rotation at
// the year's turn by its estimate, resting the poorest field and putting the crop on the richest; the crop bias drawn once and kept on the
// pawn; after a failed crop, more of the other sown the year after; the trial, a good head's project, sown on one field in its window;
// timing: every head's review falls on a field's first sowing day; a field of one crop, soil, sowing day and weeding yields the same under
// a poor and a good head; a farm of barley alone untouched by any of it; the invariants of each state.
const assert = require('assert'), VB = require('../src/load.js');
const { DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'], { CROPS, ROTATIONS } = VB['sim/crops'];
const F = VB['sim/fields'], R = VB['sim/rotations'], Plans = VB['sim/plans'], Aims = VB['sim/aims'], Stores = VB['sim/stores'];
const { setClock } = require('./lib/clock.js');
const { tinyWorld, tinyState, setForesight } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const ok = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants: ${what}`);
const at = (season, sday, year = 1) => ((year - 1) * YEAR_DAYS + season * SEASON_DAYS + sday) * DAY + 8; // 08:00 of that day
const POOR = 0.3, ORDINARY = 0.55, GOOD = 0.8;

// a tiny farm of three fields in rotation `key`, its village's usual one `usual`, its head of skill `skill`
function farm(key, usual, grain, skill) {
  const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
  const f = st.farmsteads[0], hh = st.households[f.household], v = st.villages[f.village];
  while (f.fields.length > 3) f.fields.pop();
  setForesight(st, hh.holder, skill);
  v.rotation = usual;
  hh.grain = grain;
  f.fields.forEach((fd, i) => {
    const n = ROTATIONS[key].courses.length;
    Object.assign(fd, { rotation: key, step: i % n, crop: ROTATIONS[key].courses[i % n], stage: 'stubble', soil: 1 });
  });
  const s = { st, f, hh, v, plan: Plans.planOf(st, 'household', hh.id) };
  s.head = () => ({ skill: Plans.headSkill(st, hh.id), pawn: hh.holder });
  s.review = (time) => {
    setClock(st, time);
    Plans.reviewed(st, s.plan, cal(st.t));
  };
  return s;
}
const courses = (f) => f.fields.map((fd) => `${fd.crop}@${fd.soil}`).join();

// ---- the three heads, by the fifths of skill ----
assert.strictEqual(R.tierOf(POOR), 'poor');
assert.strictEqual(R.tierOf(R.SOWING.poor), 'ordinary', 'the lowest fifth is below SOWING.poor');
assert.strictEqual(R.tierOf(ORDINARY), 'ordinary');
assert.strictEqual(R.tierOf(R.SOWING.good), 'good', 'the highest fifth from SOWING.good');
assert.strictEqual(R.tierOf(GOOD), 'good');

{ // the rotation: a poor head keeps the one it took over; an ordinary one takes the village's usual one
  const poor = farm('every', 'three', { barley: 400, rye: 100 }, POOR);
  poor.review(at(0, 2));
  assert(poor.f.fields.every((fd) => fd.rotation === 'every'), 'the poor head keeps barley every year');
  ok(poor.st, 'a poor head');
  const ord = farm('every', 'three', { barley: 400, rye: 100 }, ORDINARY);
  ord.review(at(0, 2));
  assert(ord.f.fields.every((fd) => fd.rotation === 'three'), 'the ordinary head takes three courses');
  ok(ord.st, 'an ordinary head');
}
{ // a good head holding rye chooses its own rotation at the year's turn, not the village's: with hands for every field and need well
  // met, barley every year serves best; with need above what its fields give, it keeps what feeds most
  const s = farm('three', 'three', { barley: 400, rye: 100 }, GOOD);
  s.f.fields.forEach((fd) => (fd.soil = 0.76)); // worn: three courses mends it
  s.review(at(1, 2));
  assert(s.f.fields.every((fd) => fd.rotation === 'three'), 'between turns the good head does not change');
  const c = cal(at(3, 0));
  setClock(s.st, at(3, 0));
  const choice = R.rotationChoice(s.st, s.f, s.hh, c, s.head());
  const bias = s.st.pawns[s.hh.holder].cropBias;
  assert(bias && Object.keys(bias).join() === 'barley,rye,peas', 'its bias on each crop drawn at its first weighing');
  assert(Object.values(bias).every((x) => Math.abs(x - 1) <= R.SOWING.bias * (1 - GOOD) + 1e-9), 'within bias × (1 − skill)');
  const kept = JSON.stringify(bias);
  R.rotationChoice(s.st, s.f, s.hh, c, s.head());
  assert.strictEqual(JSON.stringify(s.st.pawns[s.hh.holder].cropBias), kept, 'drawn once');
  assert(choice === null || ROTATIONS[choice.to], `a rotation of the table or none: ${JSON.stringify(choice)}`);
  ok(s.st, 'a good head at the turn');
  // the village's usual rotation does not move a good head between turns
  const g = farm('three', 'every', { barley: 400, rye: 100 }, GOOD);
  g.review(at(0, 2));
  assert(g.f.fields.every((fd) => fd.rotation === 'three'), "the good head holds its own against the village's");
}

// ---- the fields: the worn field rests first ----
{ // ordinary: a field due for barley with soil under SOWING.worn exchanges its course with the fallow field of better soil
  const s = farm('three', 'three', { barley: 400, rye: 100 }, ORDINARY);
  const [fallow, , barley] = s.f.fields; // steps 0 fallow, 1 rye, 2 barley
  s.f.fields[1].stage = 'growing'; // the rye stands since the autumn
  barley.soil = 0.8;
  fallow.soil = 1;
  s.review(at(0, 0));
  assert.strictEqual(barley.crop, 'fallow', 'the worn field rests');
  assert.strictEqual(fallow.crop, 'barley', 'the better one takes the barley');
  assert.deepStrictEqual([fallow.step, barley.step], [2, 0], 'they exchange their steps: the farm stays staggered');
  ok(s.st, 'the worn field rests');
  s.review(at(0, 1));
  assert.strictEqual(barley.crop, 'fallow', 'and stays so');
}
{ // ordinary: a field above SOWING.worn is not rested; a good head rests the poorer of the two all the same
  for (const [skill, swapped] of [[ORDINARY, false], [GOOD, true]]) {
    const s = farm('three', 'three', { barley: 400, rye: 100 }, skill);
    const [fallow, , barley] = s.f.fields;
    s.f.fields[1].stage = 'growing';
    barley.soil = 0.9;
    fallow.soil = 1.4; // fresh land
    s.review(at(0, 0));
    assert.strictEqual(barley.crop === 'fallow', swapped, `skill ${skill}: ${courses(s.f)}`);
    ok(s.st, `skill ${skill} at the fields`);
  }
}
{ // good, in autumn: rye on fresh land, the field due for rye rests in its place
  const s = farm('three', 'three', { barley: 400, rye: 100 }, GOOD);
  const [fallow, rye, barley] = s.f.fields;
  barley.stage = 'stubble';
  rye.soil = 0.9;
  fallow.soil = 1.4;
  s.review(at(2, 1));
  assert.strictEqual(fallow.crop, 'rye', 'the fresh field takes the rye');
  assert.strictEqual(rye.crop, 'fallow', 'the poorer one rests');
  ok(s.st, 'rye on fresh land');
}

// ---- the poor head in a hungry year ----
{
  const s = farm('three', 'three', { barley: 60, rye: 30 }, POOR);
  const [fallow] = s.f.fields;
  s.f.fields[1].stage = 'growing';
  s.review(at(0, 0));
  assert.strictEqual(fallow.crop, 'barley', 'the fallow field sown with barley out of turn');
  assert.strictEqual(fallow.turn, true, 'out of turn');
  ok(s.st, 'a poor head in a hungry year');
  const fed = farm('three', 'three', { barley: 4000, rye: 100 }, POOR);
  fed.f.fields[1].stage = 'growing';
  fed.review(at(0, 0));
  assert.strictEqual(fed.f.fields[0].crop, 'fallow', 'with food enough it rests the field');
}

// ---- after a failed crop, more of the other ----
{
  const s = farm('peas', 'peas', { barley: 400, peas: 100 }, ORDINARY);
  const [b1, p1, b2] = s.f.fields; // barley, peas, barley
  b1.stage = 'growing';
  setClock(s.st, at(2, SEASON_DAYS - 1));
  F.fieldsFrost(s.st);
  assert.deepStrictEqual(s.f.failed, { crop: 'barley', year: 1 }, 'the frost took the barley: recorded');
  ok(s.st, 'a failed crop');
  for (const fd of s.f.fields) Object.assign(fd, { stage: 'stubble', soil: 1 });
  s.review(at(0, 0, 2));
  const turned = s.f.fields.filter((fd) => fd.turn);
  assert.strictEqual(turned.length, 1, 'one field out of turn');
  assert.strictEqual(turned[0].crop, 'peas', 'sown with peas');
  s.review(at(0, 1, 2));
  assert.strictEqual(s.f.fields.filter((fd) => fd.turn).length, 1, 'and only one');
  ok(s.st, 'more of the other');
  void p1, b2;
  // a farm of barley alone keeps no record of a failure
  const e = farm('every', 'every', { barley: 400 }, ORDINARY);
  e.f.fields[0].stage = 'growing';
  setClock(e.st, at(2, SEASON_DAYS - 1));
  F.fieldsFrost(e.st);
  assert.strictEqual(e.f.failed, undefined, 'none on barley every year');
}

// ---- the trial: a good head's project ----
{
  const s = farm('every', 'every', { barley: 400, peas: 30 }, GOOD);
  s.plan.targets.fields = 0;
  s.plan.targets.workable = 3;
  const menu = Aims.menu(s.st, s.plan, s.hh, s.f);
  assert(menu.some((o) => o.what === 'trial' && o.crop === 'peas'), `a trial on the menu: ${JSON.stringify(menu)}`);
  const ord = farm('every', 'every', { barley: 400, peas: 30 }, ORDINARY);
  assert(!Aims.menu(ord.st, ord.plan, ord.hh, ord.f).some((o) => o.what === 'trial'), 'an ordinary head tries nothing');
  // taken, it waits for the peas' window, and sows one field with them out of turn
  s.plan.aim = { year: 1, surplus: true, again: false, project: null, what: 'trial', since: s.st.t, shortSince: null, trial: 'peas' };
  s.review(at(1, 2));
  assert(s.f.fields.every((fd) => !fd.turn), 'not in summer');
  s.review(at(0, 1, 2));
  const tried = s.f.fields.filter((fd) => fd.turn);
  assert.strictEqual(tried.length, 1, 'one field');
  assert.strictEqual(tried[0].crop, 'peas', 'under peas');
  assert.strictEqual(s.plan.aim.trial, undefined, 'the trial is over');
  ok(s.st, 'a trial');
}

// ---- timing: on a field's first sowing day every head's plan is reviewed at its first review hour ----
{
  for (const skill of [POOR, GOOD]) {
    const s = farm('every', 'every', { barley: 400 }, skill);
    s.plan.nextReview = Infinity;
    const t = at(0, 0) - 8 + VB['sim/rules'].WORK[0] - 1;
    setClock(s.st, t);
    assert.strictEqual(Plans.reviewWhy(s.st, s.plan, Math.floor(t), cal(t)), 'window', `skill ${skill}: reviewed on the window's first day`);
  }
}

// ---- skill never acts on a yield: one crop, soil, sowing day and weeding give the same under a poor and a good head ----
{
  const held = [POOR, GOOD].map((skill) => {
    const s = farm('every', 'every', { barley: 400 }, skill), fd = s.f.fields[0];
    Object.assign(fd, { stage: 'ripe', sown: 3, soil: 0.95, weedMiss: 1 });
    return F.standing(s.st, fd);
  });
  assert.strictEqual(held[0], held[1], `the same crop: ${held}`);
}

// ---- barley alone: no head's foresight changes anything ----
{
  for (const skill of [POOR, ORDINARY, GOOD]) {
    const s = farm('every', 'every', { barley: 60 }, skill), c = cal(at(3, 0));
    setClock(s.st, at(3, 0));
    const rng = JSON.stringify(s.st.rng.traits);
    assert.strictEqual(R.rotationChoice(s.st, s.f, s.hh, c, s.head()), null, `skill ${skill}: no change of rotation`);
    assert.strictEqual(R.fieldsChoice(s.st, s.f, s.hh, cal(at(0, 0)), s.head()), null, `skill ${skill}: no act on the fields`);
    assert.strictEqual(s.st.pawns[s.hh.holder].cropBias, undefined, 'no bias drawn');
    assert.strictEqual(JSON.stringify(s.st.rng.traits), rng, 'no draw from the stream traits');
  }
}
console.log('foresight: ok');

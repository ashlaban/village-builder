// Rotations (VB-350; design.md, Crops and rotations, The rotation; Seed). On a tiny farm at seed 7, constructed states: the table of
// rotations; a farm taking its village's usual rotation at its plan's review when it has the seed, its fields staggered; the seed the plan
// holds back of each crop, a fallow field's for the crop sown on it next; the fields wanted, the fallow ones on top of the sown; a field
// moving on when its crop is in, when its crop is lost, when its window closes unsown, and when its fallow year ends; a holder short of rye
// at its sowing falling back on two courses, logged once, and taking three courses again when rye comes in; a change that waits while a
// field stands under a crop the new rotation has not; a new field on the step fewest fields are at; the village's usual rotation at its
// meeting, the one most farms hold; the invariants of each state; barley every year as it was.
const assert = require('assert'), VB = require('../src/load.js');
const { DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'], { CROPS, ROTATIONS } = VB['sim/crops'];
const F = VB['sim/fields'], FieldPlans = VB['sim/fieldplans'], Rotations = VB['sim/rotations'], Plans = VB['sim/plans'], Stores = VB['sim/stores'], { seedNeed } = VB['sim/hunger'];
const { setClock } = require('./lib/clock.js');
const { tinyWorld, tinyState, setForesight } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const ok = (st, what) => assert.deepStrictEqual(checkState(st), [], `invariants: ${what}`);
const at = (season, sday, year = 1) => ((year - 1) * YEAR_DAYS + season * SEASON_DAYS + sday) * DAY + 8; // 08:00 of that day
const steps = (f) => f.fields.map((fd) => fd.step).sort().join();

// ---- the table ----
assert.deepStrictEqual(Object.fromEntries(Object.entries(ROTATIONS).map(([k, r]) => [k, r.courses])), {
  every: ['barley'], two: ['barley', 'fallow'], three: ['fallow', 'rye', 'barley'], peas: ['barley', 'peas'], wheat: ['barley', 'wheat'], oats: ['barley', 'oats'], peasRye: ['peas', 'rye', 'barley'],
}, 'the rotations');
for (const r of Object.values(ROTATIONS)) assert(r.courses.length <= 4 && r.courses.every((k) => CROPS[k]) && r.label, 'at most four courses of the table');

// a tiny farm of three fields, its village's usual rotation set
function farm(usual, grain, fields = 3) {
  const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
  const f = st.farmsteads[0], hh = st.households[f.household], v = st.villages[f.village];
  setForesight(st, hh.holder, 0.55); // an ordinary head: the village's usual rotation (VB-351)
  while (f.fields.length > fields) f.fields.pop();
  assert.strictEqual(f.fields.length, fields, 'the tiny farm has its fields');
  v.rotation = usual;
  hh.grain = grain;
  return { st, f, hh, v, plan: Plans.planOf(st, 'household', hh.id) };
}
const review = (s, t) => {
  setClock(s.st, t);
  Plans.reviewed(s.st, s.plan, cal(s.st.t));
};

{ // barley every year: the review keeps it, nothing moves, the seed is barley's
  const s = farm('every', { barley: 400, rye: 100 });
  review(s, at(0, 2));
  assert(s.f.fields.every((fd) => fd.rotation === 'every' && fd.step === 0 && fd.crop === 'barley'), 'barley every year');
  assert.strictEqual(s.plan.reasons['grain/rye'], undefined, 'no rye held back');
  ok(s.st, 'barley every year');
}
{ // the village's usual rotation taken at the review where the household has the seed; staggered; the seed of each crop held back
  const s = farm('three', { barley: 400 });
  review(s, at(0, 2));
  assert(s.f.fields.every((fd) => fd.rotation === 'every'), 'no rye: it keeps barley every year');
  s.hh.grain = { barley: 400, rye: CROPS.rye.seed };
  review(s, at(0, 3));
  assert(s.f.fields.every((fd) => fd.rotation === 'three'), 'a field of rye seed: it takes three courses');
  assert.strictEqual(steps(s.f), '0,1,2', 'one field at each course');
  assert(s.f.fields.every((fd) => fd.crop === ROTATIONS.three.courses[fd.step]), "each field's crop is its course");
  // the fallow field and the rye field are sown with rye next, the barley field with barley
  assert.strictEqual(seedNeed(s.st, s.hh, 'rye'), 2 * CROPS.rye.seed, 'rye for the fallow field and the rye field');
  assert.strictEqual(seedNeed(s.st, s.hh, 'barley'), VB['sim/hunger'].seedPer(s.st, s.hh), 'barley for the barley field');
  assert.strictEqual(s.plan.reasons['grain/rye'], 'seed', 'the plan holds back rye');
  assert.strictEqual(Stores.reserved(s.st, s.hh, 'grain/rye'), 2 * CROPS.rye.seed, 'as much as its fields sow next');
  // the fields wanted: the sown ones as for barley every year (rye nets as barley), the fallow ones on top
  const everyWanted = (() => {
    const t = farm('every', { barley: 400 });
    return FieldPlans.fieldsWanted(t.st, t.hh, Infinity);
  })();
  assert.strictEqual(FieldPlans.fieldsWanted(s.st, s.hh, Infinity), Math.ceil((everyWanted * 3) / 2), 'half as many again in three courses');
  assert.strictEqual(FieldPlans.fieldsWanted(s.st, s.hh, 2), 3, 'two sown fields the hands can till, and one fallow on top');
  ok(s.st, 'three courses taken');

  // a field moves on: its crop in (the last load taken up), its fallow year over, its window closed unsown
  const [fa, ry, ba] = [0, 1, 2].map((i) => s.f.fields.find((fd) => fd.step === i));
  Object.assign(ba, { stage: 'stooks', held: 10, reaped: 0 });
  F.carried(ba, 100);
  assert(ba.stage === 'stubble' && ba.crop === 'fallow' && ba.step === 0, 'barley in: the field lies fallow');
  setClock(s.st, at(1, 0));
  F.fieldsDay(s.st, cal(s.st.t)); // the summer's first day: the fallow fields stand fallow (rest marked)
  assert(fa.rest === 0.5 && ba.rest === 0.5, 'fallow marked in summer');
  setClock(s.st, at(2, 0));
  F.fieldsDay(s.st, cal(s.st.t)); // the autumn's first day: their fallow year ends
  assert(fa.crop === 'rye' && ba.crop === 'rye', 'fallow over: rye is sown on it this autumn');
  assert.strictEqual(ry.crop, 'rye', 'a rye field still to sow waits for its window');
  setClock(s.st, at(2, CROPS.rye.sow[2] + 1));
  F.fieldsDay(s.st, cal(s.st.t)); // the day after the rye's window: unsown, a year lost
  assert(fa.crop === 'barley' && ry.crop === 'barley' && ba.crop === 'barley', 'rye unsown when its window closed: on to barley');
  Object.assign(ba, { stage: 'growing', sown: at(0, 2) / DAY });
  F.fieldsFrost(s.st);
  assert(ba.stage === 'stubble' && ba.crop === 'fallow', 'barley lost to the frost: on to fallow');
  ok(s.st, 'fields moved on');
}
{ // short of rye at its sowing: it falls back on two courses (logged once), the rye field fallow; three again when rye comes in
  const s = farm('three', { barley: 400, rye: CROPS.rye.seed });
  review(s, at(0, 2));
  const ry = s.f.fields.find((fd) => fd.crop === 'rye');
  s.f.fields.find((fd) => fd.crop === 'fallow').step = 1; // two fields at rye: the farm's rye fields want sowing this autumn
  s.f.fields.find((fd) => fd.step === 1 && fd !== ry).crop = 'rye';
  s.hh.grain = { barley: 400 }; // its rye eaten
  const n0 = s.st.record.length;
  review(s, at(2, 1));
  assert(s.f.fields.every((fd) => fd.rotation === 'two'), 'no rye at its sowing: two courses');
  assert(s.f.fields.every((fd) => fd.crop === ROTATIONS.two.courses[fd.step]), 'staggered again');
  assert.strictEqual(s.f.fields.filter((fd) => fd.crop === 'fallow').length, 2, 'the fields that were to bear rye lie fallow');
  const told = s.st.record.slice(n0).filter((e) => e && /no seed of rye/.test(e.text || ''));
  assert(told.length === 1 && told[0].kind === 'field' && told[0].farm === s.f.id, 'logged once, at the farm');
  review(s, at(2, 2));
  assert.strictEqual(s.st.record.slice(n0).filter((e) => e && /no seed of rye/.test(e.text || '')).length, 1, 'not again');
  ok(s.st, 'fallen back');
  s.hh.grain = { barley: 400, rye: CROPS.rye.seed };
  review(s, at(2, 3));
  assert(s.f.fields.every((fd) => fd.rotation === 'three'), 'rye again: three courses again');
  ok(s.st, 'three again');
}
{ // a change waits while a field stands under a crop the new rotation has not
  const s = farm('three', { barley: 400, rye: 100, peas: 100 });
  s.v.rotation = 'peas';
  review(s, at(0, 2));
  assert(s.f.fields.every((fd) => fd.rotation === 'peas'), 'barley and peas by turns');
  const pea = s.f.fields.find((fd) => fd.crop === 'peas');
  Object.assign(pea, { stage: 'growing', sown: 2 * SEASON_DAYS - 2 });
  s.v.rotation = 'three';
  review(s, at(0, 4));
  assert(s.f.fields.every((fd) => fd.rotation === 'peas'), 'peas standing: it waits');
  Object.assign(pea, { stage: 'stubble', sown: null });
  review(s, at(0, 5));
  assert(s.f.fields.every((fd) => fd.rotation === 'three'), 'peas in: three courses');
  ok(s.st, 'waited');
}
{ // a new field takes the step fewest fields are at, the course sown soonest among them; the village's usual rotation at its meeting
  const s = farm('three', { barley: 400, rye: 100 }, 2);
  review(s, at(0, 2));
  assert.strictEqual(steps(s.f), '0,2', 'two fields: barley keeps its course, the other rests');
  // a field broken: the third bears rye, the one step no field is at; a fourth, in spring, barley (all tie, and barley is sown first)
  const breakOne = () => {
    setClock(s.st, at(0, 6));
    VB['sim/projectplans'].dropAll(s.st, 'household', s.hh.id);
    VB['sim/projectplans'].makeProject(s.st, 'household', s.hh.id, { what: 'field', steps: [{ kind: 'break', place: FieldPlans.pickField(s.st, s.f, s.hh), hours: 0, stake: 'field' }] });
    VB['sim/newground'].finishBreak(s.st, s.f, VB['sim/projects'].ownOf(s.st, s.f.household));
    return s.f.fields[s.f.fields.length - 1];
  };
  // VB-999: the project of the third field holds back rye's seed, the course it will take when broken; with barley every year, barley's
  setClock(s.st, at(0, 6));
  assert.deepStrictEqual(FieldPlans.fieldProject(s.st, s.hh, 0).hold, { [Stores.grainGood('rye')]: CROPS.rye.seed }, 'a new field of three courses holds rye');
  const bar = farm('every', { barley: 400 });
  assert.deepStrictEqual(Object.keys(FieldPlans.fieldProject(bar.st, bar.hh, 0).hold), [Stores.grainGood('barley')], 'barley every year holds barley');
  // the rye window's last day and the day after are closing days for a farm in three courses, not for one of barley every year
  const rye = (d) => cal(at(2, CROPS.rye.sow[2] + d));
  assert(VB['sim/plandays'].closing(s.st, rye(0), s.plan) && VB['sim/plandays'].closing(s.st, rye(1), s.plan), "rye's window closes on a farm that sows it");
  assert(!VB['sim/plandays'].closing(bar.st, rye(0), bar.plan) && !VB['sim/plandays'].closing(s.st, rye(2), s.plan), 'not for barley every year, nor after');
  const third = breakOne();
  assert(third.rotation === 'three' && third.step === 1 && third.crop === 'rye', `the third field bears rye: ${JSON.stringify(third)}`);
  const fourth = breakOne();
  assert(fourth.step === 2 && fourth.crop === 'barley', `the fourth field bears barley: ${JSON.stringify(fourth)}`);
  s.f.fields.length = 2;
  // the meeting: most farms hold three courses, so the village's rotation is three; a village whose farms all farm barley every year
  // has barley every year
  s.v.rotation = 'every';
  Rotations.usualRotation(s.st, s.v);
  assert.strictEqual(s.v.rotation, 'three', 'the one most farms hold');
  for (const q of s.f.fields) Object.assign(q, { rotation: 'every', step: 0, crop: 'barley' });
  Rotations.usualRotation(s.st, s.v);
  assert.strictEqual(s.v.rotation, 'every', 'barley every year again');
  ok(s.st, 'the meeting');
}
console.log('rotations ok: the table, the usual rotation taken and staggered, seed by crop, fallow on top, steps, the fall-back, the wait, the meeting');

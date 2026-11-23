// The head's estimate (VB-476; design.md section 7, The estimate; sim/estimate): the causes a judgement reckons with come in by skill as
// head, in a named order; the work a head sees left of a heavy crop is a normal crop's for a poor head and the crop's own for a good one;
// the range is wider for the poor head and holds the centre; progress seen moves the centre to the truth; the head's day mans a task by the
// estimate, so a poor head mans a heavy harvest as a normal one. On a small constructed state: one farm on open ground, its fields ripe,
// barley, each three times as fertile as the middle (a crop one and a half times the normal one's hours to reap).
const assert = require('assert');
const VB = require('../src/load.js'), Sim = VB.sim, Jobs = VB['sim/jobs'], E = VB['sim/estimate'], { CROPS } = VB['sim/crops'];
const { IDX } = VB['sim/traits'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

// ---- the table ----
assert.deepStrictEqual(E.ESTIMATE.reckons.map(([k]) => k), ['health', 'size', 'skill'], 'hunger and health, then the size, then skill');
assert.deepStrictEqual(E.reckoned(0), { health: false, size: false, skill: false }, 'no judgement reckons with none of them');
assert.deepStrictEqual(E.reckoned(1), { health: true, size: true, skill: true }, 'the best with all');
const at = E.ESTIMATE.reckons.map(([, s]) => s);
assert.deepStrictEqual(at, [...at].sort((x, y) => x - y), 'brought in in order of skill');

// ---- a state ----
const rows = Array.from({ length: 12 }, (_, i) => (i < 2 ? 'FFFFFFFFFFFFFFFF' : '................'));
const st = tinyState(tinyWorld(rows), [{ at: [8, 7], farms: 1 }], { seed: 4 });
st.makeFields = false;
Sim.advance(st, 4.5);
const hh = st.households[0], f = st.farmsteads[hh.farmstead], plan = st.plans.households.get(hh.id), head = plan.head.pawn;
assert.strictEqual(head, hh.holder, 'the holder is head');
for (const fd of f.fields) Object.assign(fd, { stage: 'growing', crop: 'barley', sown: 0 });
for (const fd of f.fields) Object.assign(fd, { stage: 'ripe', fert: 3, soil: 1, tilth: 0, weedMiss: 0, weedOpen: false });
const c = Sim.cal(st.t);
Jobs.refreshJobs(st, c, true);
// the spring's hoeing goes from the board (its fields stand under a crop), so that the reaping is the field work of the day
for (const x of [...st.jobs.values()]) if (x.kind === 'plow') VB['sim/agents'].dropJob(st, x);
const reaps = [...st.jobs.values()].filter((x) => x.kind === 'reap'), j = reaps[0];
assert.ok(reaps.length >= 2, 'the ripe fields are to be reaped');
const norm = CROPS.barley.hours.reap;
assert.strictEqual(j.hours, Math.round(norm * 1.5), `a heavy crop: ${j.hours} hours, a normal one's ${norm}`);
// a head of skill s: wits and husbandry at s, head since now, no lean
const as = (s) => {
  const t = st.pawns[head].traits;
  t[IDX.wits] = t[IDX.husbandry] = s;
  plan.head.since = st.t;
  plan.head.bias.hours = 1;
  assert.ok(near(VB['sim/seasonal'].headSkill(st, hh.id), s, 1e-6), `the head's skill is ${s}`);
};

// ---- the estimate ----
const poor = 0.2, good = 0.9;
as(poor);
const ep = E.estimate(st, head, j, [head]);
assert.ok(near(ep.work, norm), `the poor head sees a normal crop: ${ep.work}`);
assert.deepStrictEqual(ep.unseen, ['health', 'size', 'skill'], 'and reckons with none of the three');
as(good);
const eg = E.estimate(st, head, j, [head]);
assert.ok(near(eg.work, j.hours), `the good head sees the crop: ${eg.work}`);
assert.deepStrictEqual(eg.unseen, [], 'and reckons with all three');
for (const e of [ep, eg]) assert.ok(e.lo < e.mid && e.mid < e.hi && e.lo > 0, `a range about its centre: ${JSON.stringify(e)}`);
assert.ok((ep.hi - ep.lo) / ep.mid > 2 * ((eg.hi - eg.lo) / eg.mid), 'the poor head’s range is the wider, by far');
// two hands: about half the hours
const two = hh.members.filter((m) => m !== head && st.pawns[m].age >= 16)[0];
const e2 = E.estimate(st, head, j, [head, two]);
assert.ok(e2.mid < eg.mid && e2.mid > eg.mid / 3, `two hands take less: ${e2.mid} against ${eg.mid}`);
// the lean: a head that believes tasks take a fifth more
plan.head.bias.hours = 1.2;
assert.ok(near(E.estimate(st, head, j, [head]).work, j.hours * 1.2), 'the lean on the hours');
plan.head.bias.hours = 1;
// progress seen moves the centre to the truth: once the poor head's normal crop is done and more stands, it sees what is left
as(poor);
j.done = norm;
const seen = E.estimate(st, head, j, [head]);
assert.ok(near(seen.work, j.hours - norm), `past what it reckoned, the head sees the rest: ${seen.work}`);
assert.ok(near(seen.lo, seen.mid) && near(seen.hi, seen.mid), 'and is no longer in doubt');
j.done = 0;
// nothing written by reading
const before = JSON.stringify([st.rng, plan]);
E.estimate(st, head, j);
assert.strictEqual(JSON.stringify([st.rng, plan]), before, 'an estimate writes nothing');

// ---- the head's day mans the task by the estimate: it covers the work the head sees, each hand at the rate it believes, so a poor head
// mans a heavy harvest as a normal one: here three hands of six working hours where the crop wants four ----
const { MATCH } = VB['sim/roles'], { WORK } = VB['sim/rules'], horizon = MATCH.day.horizon * (WORK[1] - WORK[0]);
const handsFor = (s) => {
  as(s);
  const H = E.headOf(st, hh), seen = [];
  const workFor = E.workFor;
  E.workFor = (st2, H2, x) => { const w = workFor(st2, H2, x); if (x === j) seen.push(w); return w; };
  try { VB['sim/day'].allot(st, hh, c); } finally { E.workFor = workFor; }
  assert.strictEqual(seen.length, 1, 'the day reads the head’s estimate of the task once');
  let left = seen[0], n = 0;
  for (const m of hh.members.filter((x) => st.pawns[x].role !== 'child')) {
    if (left <= 0) break;
    left -= horizon * E.rateFor(st, H, m, j, n === 0);
    n++;
  }
  return { work: seen[0], n };
};
const dp = handsFor(poor), dg = handsFor(good);
assert.ok(near(dp.work, norm) && near(dg.work, j.hours), `the day sees ${dp.work} hours (poor head) and ${dg.work} (good head)`);
const nPoor = dp.n, nGood = dg.n;
assert.ok(nGood > nPoor && nPoor >= 1, `the good head gives the reaping ${nGood} hands, the poor head ${nPoor}: it mans it as a normal crop`);
// ---- afterwards: a window missed with the truth outside the head's range is told, naming the cause it did not reckon with ----
const { emit } = VB['sim/events'], { notable } = VB['sim/notable'];
const miss = (s) => {
  as(s);
  VB['sim/day'].allot(st, hh, c);
  const n = st.record.length;
  emit(st, 'windowMissed', { farm: f, field: f.fields[0], kind: 'reap', why: 'frost took the barley' });
  return st.record.slice(n).filter((e) => e.kind === 'misjudged');
};
const told = miss(poor);
assert.strictEqual(told.length, 1, 'the poor head misjudged the heavy crop');
assert.strictEqual(told[0].reason, 'size', 'the cause: the crop’s size');
assert.strictEqual(told[0].pawn, head, 'the head’s event');
assert.ok(/had not reckoned with the crop’s size/.test(told[0].text), told[0].text);
assert.deepStrictEqual(notable(st, told[0]), ['farm'], 'notable, as a farm’s loss');
assert.strictEqual(miss(good).length, 0, 'the good head reckoned with it: nothing to tell');
assert.deepStrictEqual(checkState(st), [], 'invariants');
console.log(`estimate ok: the table in order; a heavy crop reckoned as normal by a poor head (${ep.work} hours, ${ep.lo.toFixed(1)} to ${ep.hi.toFixed(1)} by one hand) and as it is by a good one (${eg.work}, ${eg.lo.toFixed(1)} to ${eg.hi.toFixed(1)}); the lean; progress seen; ${nPoor} hands against ${nGood} at the day; ${told[0].text}`);

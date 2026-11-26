// Crop boundary regressions: seed shortages, sheaves waiting at frost, and restoring an abandoned farm.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { CROPS } = VB['sim/crops'];
const { setClock, moveClock } = require('./lib/clock.js');
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { DAY, YEAR, SEASON_DAYS, cal } = VB['sim/rules'];
const { KINDS } = VB['sim/kinds'];
const { fieldsDay, fieldsFrost } = VB['sim/fields'];
const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 2 }], { seed: 7 });
const f = st.farmsteads[0], hh = st.households[f.household], fd = f.fields[0];
assert(fd, 'test farm needs a field');
const j = { farm: f, field: fd };
KINDS.plow.done(st, j);
hh.grain = { barley: CROPS.barley.seed - 1 };
const before = structuredClone(fd);
KINDS.sow.done(st, j, hh, cal(0));
assert.deepStrictEqual(fd, before, 'insufficient seed must leave the hoed field untouched');
hh.grain = { barley: CROPS.barley.seed };
KINDS.sow.done(st, j, hh, cal(0));
assert.equal(Sim.grainOf(hh), 0, 'sowing consumes the seed');

// Growth (day 3) opens no weeding; the first round falls due on day 6 and the second on day 15 (ECON.weedDays), a missed round counts once,
// and no third round follows.
setClock(st, 3 * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'growing');
assert.equal(fd.weedOpen, false, 'no round before day 6');
setClock(st, 6 * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.weedOpen, true);
KINDS.weed.done(st, j);
fieldsDay(st, cal(st.t));
assert.equal(fd.weedOpen, false, 'finishing weeding must not reopen it the same day');
setClock(st, 15 * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.weedMiss, 0, 'completed weeding does not count as missed');
assert.equal(fd.weedOpen, true, 'the second round falls due on day 15');
setClock(st, 20 * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.weeds, 2, 'two rounds a crop');
assert.equal(fd.weedOpen, true);

// Sheaves already delivered survive frost; those still in the field are lost, even after reaping.
const c = cal((3 * SEASON_DAYS - 1) * DAY);
setClock(st, c.day * DAY);
fd.stage = 'ripe'; // the crop ripened (VB-356: only a ripe field is reaped)
KINDS.reap.done(st, j, hh, c);
const held = fd.held;
assert(held > 0);
const hand = { id: -1, load: 0 };
KINDS.haul.ops.pitch.run(st, j, null, fd.tile, hand, 1e9); // the whole field in one load (VB-1812: the stooks pitched)
KINDS.haul.deliver(st, j, hh, f, hand);
const waiting = { ...fd, id: f.fields.length, stage: 'stooks', sown: 0, held: 17 };
f.fields.push(waiting);
const frostBefore = st.record.filter((e) => e.kind === 'frost').length;
fieldsDay(st, c); fieldsFrost(st); // the final autumn midnight (sim/clock, CALENDAR)
assert(hh.unthreshed.includes(held), 'delivered sheaves survive the final autumn midnight');
assert.equal(fd.stage, 'stubble');
assert.equal(waiting.stage, 'stubble');
assert.equal(waiting.held, 0, 'frost destroys undelivered sheaves');
assert.equal(st.record.filter((e) => e.kind === 'frost').length, frostBefore + 1, 'only the uncollected crop records frost');

// A claimant suspends overgrowth; after the claim ends, nearby woodland can reclaim the field.
f.household = null; f.emptySince = 0; // a claimant restoring it: its project plan (VB-123)
VB['sim/projectplans'].makeProject(st, 'pawn', hh.holder, {
  what: 'restore', farm: f.id, since: st.t, steps: [{ kind: 'restore', place: f.house, hours: 10, done: 0, stake: 'farm' }] });
fd.stage = 'stubble'; fd.sown = null;
setClock(st, 2 * YEAR);
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'stubble', 'restoration protects the field from overgrowth');
VB['sim/projectplans'].dropAll(st, 'pawn', hh.holder);
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'fallow');
// Forest spread (sim/spread, VB-091) grows trees on it: from a quarter of full cover the field is scrub; cleared of them, it is grass again.
w.treesMax[fd.tile] = 60; w.trees[fd.tile] = 14;
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'fallow', 'below a quarter of full cover the field is still grass');
w.trees[fd.tile] = 15;
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'scrub', 'the forest has grown into the abandoned field');
w.trees[fd.tile] = 0;
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'fallow', 'a field whose scrub is gone is grass again');
console.log('crops ok: seed shortage, weeding cadence, frost delivery boundary and claimed-farm overgrowth');

// VB-1115: a farm with two ripe fields and one hand on autumn's last day loses both; one line, naming them ripe and unreaped, and the skip stops.
{
  const st2 = tinyState(w, [{ at: [8, 8], farms: 2 }], { seed: 7 });
  const g = st2.farmsteads[0], h2 = st2.households[g.household];
  h2.members.splice(1); // one hand
  for (const x of g.fields.slice(0, 2)) { x.stage = 'ripe'; x.crop = 'barley'; x.sown = 0; }
  while (g.fields.length < 2) g.fields.push({ ...g.fields[0], id: g.fields.length, tile: g.fields[0].tile });
  g.fields.length = 2;
  setClock(st2, ((3 * SEASON_DAYS - 2) * DAY));
  const est = Sim.harvestEstimate(st2, h2);
  assert.equal(est.fields, 2); assert(est.late || est.days <= est.left);
  setClock(st2, (3 * SEASON_DAYS - 1) * DAY);
  const n0 = st2.record.length;
  fieldsFrost(st2);
  const lines = st2.record.slice(n0).filter((e) => e.kind === 'frost');
  assert.equal(lines.length, 1, 'one line a farm');
  assert(/Frost took the barley at .*, ripe and not yet reaped\./.test(lines[0].text), lines[0].text);
  assert(g.fields.every((x) => x.stage === 'stubble'));
}

// Each spring grain makes the trip from its own seed through field and barn back into its own store.
for (const crop of ['wheat', 'oats']) {
  const run = tinyState(w, [{ at: [8, 8], farms: 1 }], { seed: 7 });
  const farm = run.farmsteads[0], field = farm.fields[0], owner = run.households[farm.household];
  const job = { farm, field, crop }, hand = { id: -1, load: 0 };
  Object.assign(field, { crop, rotation: crop, step: 1 });
  owner.grain = { [crop]: CROPS[crop].seed };
  KINDS.plow.done(run, job);
  KINDS.sow.done(run, job, owner, cal(0));
  assert.equal(Sim.grainOf(owner), 0);
  for (let day = 1; day < 40 && field.stage !== 'ripe'; day++) {
    setClock(run, day * DAY);
    fieldsDay(run, cal(run.t));
  }
  assert.equal(field.stage, 'ripe', crop);
  KINDS.reap.done(run, job, owner, cal(run.t));
  KINDS.haul.ops.pitch.run(run, job, null, job.site, hand, 1e9); // VB-1812: the stooks pitched (the work leg of its goal)
  KINDS.haul.deliver(run, job, owner, farm, hand);
  VB['sim/stores'].thresh(run, owner);
  assert(Sim.grainOf(owner, crop) > 0, crop);
}

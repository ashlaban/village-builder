// Winter rye and fallow (VB-348; design.md, Crops and rotations, The first crops). A field forced through the courses fallow, rye and
// barley over three years on a tiny farm at seed 7, run by the simulation: fallow is tilled once in summer (10 hours) and rests the soil at
// the year's end; rye is sown in autumn days 1-6 from the household's rye, stands the frost and the winter, is ripe 42 days after sowing,
// in summer days 7-12, and is threshed into rye; barley follows in spring. Checked: the stages on their days, the harvest, the soil at
// each year's end, the invariants every day (across the year's turn under rye). Then on constructed states: sowing refused without a
// field's seed, with the reason; an untilled fallow rests half; a manured field keeps its soil; a ripe rye field left standing to autumn
// day 1 is lost; the frost spares rye; a fallow field reserves no seed.
const assert = require('assert'), VB = require('../src/load.js'), Sim = VB.sim;
const { CROPS, DAY, SEASON_DAYS, YEAR_DAYS, cal } = VB['sim/rules'];
const { KINDS, sowWhy } = VB['sim/kinds'];
const { fieldsDay, fieldsFrost } = VB['sim/fields'];
const { seedNeed } = VB['sim/hunger'];
const Stores = VB['sim/stores'];
const { setClock } = require('./lib/clock.js');
const { tinyWorld, tinyState } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const verbose = process.argv.includes('--verbose');
const near = (a, b) => Math.abs(a - b) < 1e-9;
const when = (day) => cal(day * DAY); // {year, season, sday} of a game day; sday 0 is the season's day 1

const w = tinyWorld(Array.from({ length: 18 }, () => '.'.repeat(24)));
const st = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const f = st.farmsteads[0], hh = st.households[f.household], fd = f.fields[0];
assert(fd, 'the farm has a field');
fd.crop = 'fallow';
fd.soil = 0.9;
Sim.advance(st, DAY - (st.t % DAY) - 0.1); // to the last step before a midnight: each step below is one day, its midnight and its work
const log = [], yearEnd = [], hours = {};
let rye = null, barley = null, ryeMax = 0, prev = null;
for (let d = 1; d < 3 * YEAR_DAYS; d++) {
  const c = when(d);
  // the courses forced: rye from the autumn's first day of year 1, with a little over a field's seed (grain spoils in store) held back as
  // the standing plan holds barley's (the plan reserves each crop's from VB-350); barley once the rye is in
  if (c.year === 1 && c.season === 2 && c.sday === 0) {
    fd.crop = 'rye';
    Stores.put(st, hh, Stores.grainGood('rye'), CROPS.rye.seed + 5, 'start');
    Stores.put(st, hh, Stores.grainGood('barley'), 200, 'start'); // fed until the harvest is threshed: a hungry household eats its seed
    Stores.reserve(st, hh, st.plans.households.get(hh.id), Stores.grainGood('rye'), 0, 'seed');
  }
  if (fd.crop === 'rye' && fd.stage === 'stubble' && fd.reaped !== null) fd.crop = 'barley';
  for (let h = 0; h < DAY; h++) {
    Sim.advance(st, 1); // an hour at a time, to see the field's jobs while they are posted
    for (const j of st.jobs.values()) if (j.field === fd) hours[fd.crop + '.' + j.kind] = j.hours ?? KINDS[j.kind].hours;
  }
  const now = `${fd.crop} ${fd.stage} rest ${fd.rest}`;
  if (now !== prev) {
    log.push({ d, ...c, now, sown: fd.sown, reaped: fd.reaped, held: fd.held, soil: +fd.soil.toFixed(3) });
    if (verbose) console.log(JSON.stringify(log[log.length - 1]));
    prev = now;
  }
  if (fd.crop === 'rye' && fd.sown !== null) rye = { sown: fd.sown, reaped: fd.reaped, held: fd.held || (rye && rye.held) };
  if (fd.crop === 'barley' && fd.sown !== null) barley = { sown: fd.sown, reaped: fd.reaped, held: fd.held || (barley && barley.held) };
  if (c.year === 2) ryeMax = Math.max(ryeMax, Stores.grainOf(hh, 'rye'));
  if (c.season === 3 && c.sday === SEASON_DAYS - 1) yearEnd.push(+fd.soil.toFixed(3));
  if (c.year === 1 && c.season >= 2 && c.sday === SEASON_DAYS - 1) assert.equal(fd.stage, 'growing', 'rye stands the frost and the winter');
  assert.deepStrictEqual(checkState(st), [], `invariants on day ${d}`);
}
const at = (s) => log.find((e) => e.now === s);
// fallow: no rest before the summer, tilled in summer by a job of 10 hours, never sown
const rested = log.find((e) => !e.now.endsWith('undefined')), tilled = at('fallow stubble rest 1');
assert(rested === tilled && tilled.year === 1 && tilled.season === 1, `fallow marked and tilled in summer: ${JSON.stringify(tilled)}`);
assert.equal(hours['fallow.plow'], CROPS.fallow.hours.plow, 'fallow is tilled in 10 hours');
// rye: sown in autumn days 1-6 of year 1, ripe 42 days on, reaped in summer days 7-12 of year 2, threshed into rye
const rs = when(rye.sown), rr = when(rye.reaped);
assert(rs.year === 1 && rs.season === 2 && rs.sday <= 5, `rye sown on ${JSON.stringify(rs)}`);
assert(rye.reaped - rye.sown >= CROPS.rye.ripe && rr.year === 2 && rr.season === 1 && rr.sday >= 6, `rye reaped on ${JSON.stringify(rr)}`);
assert.equal(hours['rye.weed'], CROPS.rye.hours.weed, "rye's one round of weeding is 5 hours");
assert(rye.held > 0.6 * CROPS.rye.yield && rye.held < 1.3 * CROPS.rye.yield, `rye harvest ${rye.held}`);
assert(ryeMax >= rye.held - 1, `the rye threshed goes to the store as rye: at most ${ryeMax} held, ${rye.held} reaped`);
// barley follows in spring of year 3 and is reaped in autumn
const bs = when(barley.sown), br = when(barley.reaped);
assert(bs.year === 3 && bs.season === 0 && br.season === 2, `barley sown ${JSON.stringify(bs)}, reaped ${JSON.stringify(br)}`);
assert(barley.held > 0, 'barley harvest');
// the soil at each year's end: fallow +0.08 (tilled), rye -0.08, barley -0.08
assert.deepStrictEqual(yearEnd, [0.98, 0.9, 0.82], `soil at the years' ends ${yearEnd}`);

// ---- constructed states ----
const st2 = tinyState(w, [{ at: [8, 8], farms: 1, sizes: [6] }], { seed: 7 });
const f2 = st2.farmsteads[0], hh2 = st2.households[f2.household], g = f2.fields[0], j = { farm: f2, field: g };
// sowing: the course, the window, the hoeing and the seed, each with its reason; sown from the rye in store
g.crop = 'rye';
const autumn = when(2 * SEASON_DAYS + 2), spring = when(2);
assert.match(sowWhy(hh2, g, spring), /not sown in this season/);
assert.match(sowWhy(hh2, g, autumn), /not hoed/);
KINDS.plow.done(st2, j);
assert.equal(g.stage, 'plowed');
hh2.grain = { barley: 500, rye: CROPS.rye.seed - 1 };
assert.match(sowWhy(hh2, g, autumn), /holds 24 of the 25 rations of rye/);
KINDS.sow.done(st2, j, hh2, autumn);
assert.equal(g.stage, 'plowed', 'not sown without a field of rye seed, whatever the barley');
hh2.grain = { barley: 500, rye: CROPS.rye.seed };
assert.equal(sowWhy(hh2, g, autumn), null);
KINDS.sow.done(st2, j, hh2, autumn);
assert(g.stage === 'sown' && Stores.grainOf(hh2, 'rye') === 0 && Stores.grainOf(hh2, 'barley') === 500, 'rye is sown from the rye');
Object.assign(g, { crop: 'fallow', stage: 'plowed', sown: null });
assert.match(sowWhy(hh2, g, when(SEASON_DAYS)), /fallow is not sown/);
// the frost takes a growing barley field and spares a growing rye field
const g2 = { ...g, id: f2.fields.length, crop: 'barley', stage: 'growing', sown: 0 };
f2.fields.push(g2);
Object.assign(g, { crop: 'rye', stage: 'growing', sown: 2 * SEASON_DAYS });
fieldsFrost(st2);
assert(g.stage === 'growing' && g2.stage === 'stubble', 'the frost spares rye, not barley');
f2.fields.pop();
// a ripe rye field still standing on autumn day 1 is lost
setClock(st2, (YEAR_DAYS + 2 * SEASON_DAYS) * DAY);
g.stage = 'ripe';
fieldsDay(st2, cal(st2.t));
assert(g.stage === 'stubble' && g.sown === null, 'a ripe rye field left standing to autumn day 1 is lost');
// fallow: untilled rests half, tilled the whole, to at most 1.0; a field manured above 1.0 keeps its soil
for (const [soil, tillIt, after] of [[0.8, false, 0.84], [0.8, true, 0.88], [0.97, true, 1], [1.1, true, 1.1]]) {
  Object.assign(g, { crop: 'fallow', stage: 'stubble', sown: null, soil });
  delete g.rest;
  setClock(st2, (2 * YEAR_DAYS + SEASON_DAYS) * DAY);
  fieldsDay(st2, cal(st2.t));
  if (tillIt) KINDS.plow.done(st2, j);
  assert.equal(g.stage, 'stubble', 'a fallow field tilled stays in stubble');
  setClock(st2, (3 * YEAR_DAYS - 1) * DAY);
  fieldsDay(st2, cal(st2.t));
  assert(near(g.soil, after) && g.rest === undefined, `fallow from ${soil}, tilled ${tillIt}: ${g.soil}, not ${after}`);
}
// a fallow field holds back no seed; fallow is no grain
const others = f2.fields.filter((q) => q !== g && (q.stage === 'stubble' || q.stage === 'plowed')).length;
assert.equal(seedNeed(st2, hh2), others * VB['sim/hunger'].seedPer(st2, hh2), 'a fallow field reserves no seed');
assert.deepStrictEqual(Stores.CROP_LIST, ['barley', 'rye'], 'fallow is no grain');
console.log(
  `rye: fallow tilled on summer day ${tilled.sday + 1}; rye sown autumn day ${rs.sday + 1}, reaped summer day ${rr.sday + 1} (${rye.held}); ` +
    `barley reaped autumn day ${br.sday + 1} (${barley.held}); soil at the years' ends ${yearEnd.join(', ')}`,
);

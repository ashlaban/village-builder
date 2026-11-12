// Crop boundary regressions: seed shortages, sheaves waiting at frost, and restoring an abandoned farm.
const assert = require('assert'), VB = require('../src/load.js');
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
hh.grain = st.ECON.seedPerField - 1;
const before = structuredClone(fd);
KINDS.sow.done(st, j, hh, cal(0));
assert.deepStrictEqual(fd, before, 'insufficient seed must leave the hoed field untouched');
hh.grain = st.ECON.seedPerField;
KINDS.sow.done(st, j, hh, cal(0));
assert.equal(hh.grain, 0, 'sowing consumes the seed');

// Growth opens weeding on day 3, repeats only when due, and counts a missed round once.
setClock(st, 3 * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'growing');
assert.equal(fd.weedOpen, true);
KINDS.weed.done(st, j);
fieldsDay(st, cal(st.t));
assert.equal(fd.weedOpen, false, 'finishing weeding must not reopen it the same day');
moveClock(st, st.ECON.weedEvery * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.weedMiss, 0, 'completed weeding does not count as missed');
moveClock(st, st.ECON.weedEvery * DAY); fieldsDay(st, cal(st.t));
assert.equal(fd.weedMiss, 1, 'an unfinished round counts when the next falls due');

// Sheaves already delivered survive frost; those still in the field are lost, even after reaping.
const c = cal((3 * SEASON_DAYS - 1) * DAY);
setClock(st, c.day * DAY);
KINDS.reap.done(st, j, hh, c);
const held = fd.held;
assert(held > 0);
KINDS.haul.deliver(st, j, hh, f);
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
f.household = null; f.emptySince = 0; f.claim = { by: hh.holder };
fd.stage = 'stubble'; fd.sown = null;
setClock(st, 2 * YEAR);
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'stubble', 'restoration protects the field from overgrowth');
f.claim = null;
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'fallow');
fd.tile = tileAt(w, 12, 10); w.biome[tileAt(w, 13, 10)] = VB.gen.B.FOREST;
setClock(st, 9 * YEAR);
fieldsDay(st, cal(st.t));
assert.equal(fd.stage, 'scrub', 'woodland within two steps spreads into the abandoned field');
console.log('crops ok: seed shortage, weeding cadence, frost delivery boundary and claimed-farm overgrowth');

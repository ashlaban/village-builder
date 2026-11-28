// @suite fast
// tests/latitude.js: the climate by latitude (VB-807; design.md, Climate and travel beyond walking): the winter's dates of the plan's table
// (docs/plans/VB-190-ice.js) at 58, 59, 60, 62 and 65 degrees in a normal, a mild and a hard winter; none at 57 in a normal winter; the
// bands of a map, north colder; the middle world's thaw and frost where VB-354 put them, a northern world's later and earlier; on a tiny
// state the dates reckoned on autumn day 1 fall as the days come, one line each, and the latitude goes through a save. With --report,
// 200 drawn winters at each climate: the days snow lies, lake ice bears and sound ice bears (median and range), and the share of winters
// with each (no target).
const assert = require('assert');
const { execFileSync } = require('child_process');
const VB = require('../src/load.js'),
  Sim = VB.sim;
const Cl = VB['sim/climate'],
  { CLIMATE, DATES } = Cl,
  { DAY, YEAR_DAYS, cal } = VB['sim/rules'],
  { tinyWorld, tinyState } = require('./lib/tiny.js'),
  { checkState } = require('./lib/invariants.js');

// ---- the plan's table: the same days, named as the plan names them ----
const name = (k) => {
  const d = (24 + k) % 48;
  return ['sp', 'su', 'au', 'wi'][Math.floor(d / 12)] + ((d % 12) + 1);
};
const span = (a, b) => (a === null ? '-' : `${name(a)} to ${name(b)} (${b - a})`);
const plan = execFileSync('node', ['docs/plans/VB-190-ice.js', '58,59,60,62,65'], { encoding: 'utf8' })
  .trim()
  .split('\n')
  .map((l) => JSON.parse(l));
for (const p of plan) {
  const d = Cl.datesOf(p.lat, p.sev);
  const got = {
    lakeIce: span(d.lakeBears, d.thaw),
    lakeOpen: d.open === null || d.lakeBears === null ? '-' : name(d.open),
    snowFrom: d.frost === null ? '-' : name(d.frost),
    soundFrom: d.soundBears === null ? '-' : name(d.soundBears),
  };
  const want = {
    lakeIce: p.lakeIce,
    lakeOpen: p.lakeOpen,
    snowFrom: p.snow === '-' ? '-' : p.snow.split(' ')[0],
    soundFrom: p.soundIce === '-' ? '-' : p.soundIce.split(' ')[0],
  };
  assert.deepStrictEqual(got, want, `the plan's dates at ${p.lat} in a winter of ${p.sev}`);
  const ts = DATES.map((k) => d[k]).filter((x) => x !== null);
  assert(ts.every((t, i) => !i || t >= ts[i - 1]), `in order at ${p.lat}, ${p.sev}: ${JSON.stringify(d)}`);
}
assert(
  DATES.every((k) => Cl.datesOf(57, 0)[k] === null),
  'a world at 57 has no date in a normal winter',
);
assert(Cl.datesOf(57, -1).lakeBears !== null, 'and lake ice in a hard one');

// ---- the bands: a third of the rows each, the north colder; the medium map's middle world at 58, 59 and 60 ----
const medium = { lat: CLIMATE.worlds.middle, ROWS: 200 };
assert.deepStrictEqual(
  [0, 1, 2].map((b) => Math.round(Cl.bandLat(medium, b) * 100) / 100),
  [60, 59, 58],
  'the medium map',
);
assert.deepStrictEqual([0, 66, 67, 133, 134, 199].map((r) => Cl.bandOfRow(medium, r)), [0, 0, 1, 1, 2, 2]);
assert.strictEqual(Cl.latOf({}), 59, 'a world made before VB-807 is the middle world');

// ---- the growing year: none moved on the middle world; a colder world's thaw later and its frost earlier ----
assert.deepStrictEqual(Cl.shiftOf({ lat: 59 }), { thaw: 0, frost: 0 });
const north = Cl.shiftOf({ lat: 62 }),
  south = Cl.shiftOf({ lat: 57 });
assert(north.thaw > 0 && north.frost < 0, `the northern world's growing year is shorter: ${JSON.stringify(north)}`);
assert(south.thaw < 0 && south.frost > 0, `the southern world's longer: ${JSON.stringify(south)}`);

// ---- on a tiny state: reckoned on autumn day 1, falling as the days come, a line each ----
const w = tinyWorld(['..........', '...F......', '..........', '....~~....', '..........', '..........']);
w.lat = CLIMATE.worlds.northern;
const st = tinyState(w, [{ at: [2, 1], farms: 1 }], { seed: 7 });
assert(st.climate && st.climate.bands.length === 3, 'a climate at the start');
assert.deepStrictEqual(checkState(st), []);
const autumn = (cal(st.t).year - 1) * YEAR_DAYS * DAY + 24 * DAY;
Sim.advance(st, autumn - st.t + 1);
assert.strictEqual(st.climate.year, cal(st.t).year, 'reckoned on autumn day 1');
const due = st.climate.due.length;
assert(due >= 12 && due <= 18, `a northern winter: frost, ice and the thaw in each band (${due})`);
const lines0 = st.record.filter((e) => e.kind === 'climate').length;
Sim.advance(st, YEAR_DAYS * DAY * 0.75);
const lines = st.record.filter((e) => e.kind === 'climate').length - lines0;
assert.strictEqual(lines, due, 'each date told once as it falls');
assert(st.climate.due.length === 0 && st.climate.bands.every((b) => b.state === 'open'), 'by summer the water is open');
assert.deepStrictEqual(checkState(st), []);
const data = JSON.parse(JSON.stringify(Sim.save(st)));
assert.strictEqual(data.lat, 62, 'the latitude is in the save');
const w2 = tinyWorld(['..........', '...F......', '..........', '....~~....', '..........', '..........']);
const st2 = Sim.load(w2, data);
assert.strictEqual(st2.w.lat, 62, 'and comes back with it');

// ---- reported, no target: 200 drawn winters at each climate ----
if (process.argv.includes('--report')) {
  const { makeStream, next } = VB['sim/rng'];
  const r = makeStream(7, 'weather'),
    tri = () => Math.round((next(r) + next(r) - 1) * 100) / 100;
  const q = (a) => {
    if (!a.length) return '-';
    const s = [...a].sort((x, y) => x - y);
    return `${s[Math.floor(s.length / 2)]} (${s[0]} to ${s[s.length - 1]})`;
  };
  for (const [world, lat] of Object.entries(CLIMATE.worlds)) {
    const snow = [],
      lake = [],
      sound = [];
    for (let i = 0; i < 200; i++) {
      const d = Cl.datesOf(lat, tri());
      if (d.frost !== null) snow.push(d.thaw - d.frost);
      if (d.lakeBears !== null) lake.push(d.thaw - d.lakeBears);
      if (d.soundBears !== null) sound.push(d.thaw - d.soundBears);
    }
    const share = (a) => `${Math.round(a.length / 2)}%`;
    console.log(
      `${world} (${lat}): snow ${q(snow)} days in ${share(snow)}; lake ice ${q(lake)} in ${share(lake)}; sound ice ${q(sound)} in ${share(sound)}`,
    );
  }
}
console.log('latitude: the plan\'s dates at five latitudes and three winters; bands; the growing year; dates falling on a tiny state');

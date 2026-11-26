// VB-808: the ground by season (sim/walking's compiled ground; sim/climate's dates; design.md, Climate and travel beyond walking, The ground
// by season). On a tiny world drawn for the case: two shores of a lake are a straight walk apart while its ice bears and a walk round it
// before and after; frozen marsh costs WINTER.marsh in frost; snow and the thaw's soft ground slow a tile with no lane, not a lane; a
// journey's leg that would stop for the night on the ice stops at the shore; on the thaw's day the routes cached are emptied and no route
// crosses the lake; the compiled ground equals the rule (the invariant) through it all.
const assert = require('assert'),
  VB = require('../src/load.js');
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
// the compiled ground's invariant (a tiny state is not a whole scenario: its other checks are other tests')
const groundBad = (st) => checkState(st).filter((m) => m.startsWith('w.ground'));
const Wk = VB['sim/walking'],
  Routes = VB['sim/routes'],
  Climate = VB['sim/climate'],
  Legs = VB['sim/legs'],
  Pose = VB['sim/pose'];
const { WINTER, TICKS, DAY } = VB['sim/rules'];
const G = Wk.GROUND,
  ICE = G.snow | G.marsh | G.lake;
const out = [];

// A lake six rows across (rows 3 to 8), with a strip of land round its east end; marsh and a lane to the west.
const map = [
  '........................',
  '........................',
  '..m.....................',
  '..m...ooooooooooooooo...',
  '..m...ooooooooooooooo...',
  '..m...ooooooooooooooo...',
  '..m...ooooooooooooooo...',
  '..m...ooooooooooooooo...',
  '..m...ooooooooooooooo...',
  '..m.....................',
  '........................',
  '........................',
];
const season = (w, f) => Wk.compileGround(w, new Uint8Array(w.ROWS).fill(f));
const steps = (w, a, b) => {
  const p = Routes.findRoute(w, a, b);
  return p ? p.length - 1 : null;
};
{
  const w = tinyWorld(map),
    north = tileAt(w, 12, 2),
    south = tileAt(w, 12, 9);
  season(w, 0);
  const summer = steps(w, north, south);
  season(w, ICE);
  const iced = steps(w, north, south);
  season(w, G.soft);
  const thaw = steps(w, north, south);
  assert.strictEqual(iced, 7, `over the ice, the shores are 7 steps apart (${iced})`);
  assert(summer >= 20 && thaw === summer, `round the lake before and after: ${summer} and ${thaw} steps`);
  season(w, ICE);
  assert(Wk.iced(w, tileAt(w, 10, 5)) && !Wk.iced(w, north), 'a lake tile bears, the shore is land');
  out.push(`the shores ${iced} steps apart over the ice, ${summer} round it before and after`);

  // frozen marsh, snow and soft ground, and a lane
  const marsh = tileAt(w, 2, 5),
    meadow = tileAt(w, 0, 0);
  season(w, 0);
  const marshSummer = Wk.tileCost(w, marsh),
    meadowSummer = Wk.tileCost(w, meadow);
  season(w, G.snow | G.marsh);
  assert.strictEqual(Wk.tileCost(w, marsh), WINTER.marsh, 'frozen marsh costs WINTER.marsh in frost');
  assert(marshSummer === 5, `marsh costs 5 in summer (${marshSummer})`);
  assert(Math.abs(Wk.tileCost(w, meadow) - meadowSummer * WINTER.snow) < 1e-12, 'snow slows meadow with no lane');
  season(w, G.soft);
  assert(Math.abs(Wk.tileCost(w, marsh) - 5 * WINTER.soft) < 1e-12, 'the thaw: marsh as in summer, and soft');
  out.push(`marsh ${marshSummer} in summer, ${WINTER.marsh} in frost; meadow x${WINTER.snow} under snow`);
  // no slope from ice to ice (lake tiles of differing heights)
  season(w, ICE);
  const a = tileAt(w, 10, 5),
    b = w.nb[a * 6];
  w.he[b] = 0.4;
  assert.strictEqual(Wk.stepCost(w, a, b), WINTER.ice, 'a step on the ice has no slope');
  w.he[b] = -0.1;
}

// The state: a lane under snow, a journey's night on the ice, and the thaw's day.
{
  const w = tinyWorld(map),
    st = tinyState(w, [{ at: [3, 0], farms: 1, sizes: [2] }], { seed: 7, winter: true });
  for (const b of st.climate.bands) b.state = 'lakeBears';
  st.climate.due.length = 0;
  Climate.layGround(st);
  const lane = tileAt(w, 0, 11);
  w.worn[lane] = 3;
  w.wear[lane] = Wk.PATHS.at[3];
  Routes.costChanged(st, lane);
  assert.strictEqual(Wk.tileCost(w, lane), 1 / Wk.PATHS.speed[3], 'a lane stays trodden under snow');
  assert.deepStrictEqual(groundBad(st), [], 'the ground compiled as the rule, on the ice');

  // a journey's leg set out at 17:00 from a tile north of the shore: by 18:00 it would be out on the ice
  const hh = st.households[0],
    a = st.agents[hh.members[0]],
    from = tileAt(w, 12, 1),
    to = tileAt(w, 12, 11);
  st.tick = (DAY + 17) * TICKS;
  st.t = st.tick / TICKS;
  a.x = w.hx[from];
  a.y = w.hy[from];
  a.journey = 'walk';
  Legs.setOut(st, a, to, w.hx[to], w.hy[to]);
  const l = a.leg,
    stopAt = (due) => {
      const [, x, y] = Pose.along(a, l, (due - l.t) / TICKS);
      return Pose.tileAt(st, x, y);
    },
    night = (Math.floor(l.t / (DAY * TICKS)) * DAY + 18) * TICKS - 1;
  assert(l.due < l.end, 'the leg is cut for the night');
  assert(Wk.iced(w, stopAt(night)), 'cut at 18:00 it would stand on the ice');
  const at = stopAt(l.due);
  assert(!Wk.iced(w, at) && !w.water[at], `it stops at the shore instead (tile ${at})`);
  out.push(`a journey's leg stops at the shore at ${(((l.due / TICKS) % DAY) + 0).toFixed(1)}h, not on the ice at 18:00`);
  Legs.halt(st, a);
  a.homeward = true;
  a.journey = null;

  // the thaw's day: the date falls at 4:00, the ground is soft, the cached route over the ice is gone, and no route crosses the lake
  const north = tileAt(w, 12, 2),
    south = tileAt(w, 12, 9);
  assert.strictEqual(Routes.route(st, north, south).length - 1, 7, 'cached over the ice');
  st.climate.due.push({ at: st.t, band: 0, date: 'thaw' }, { at: st.t, band: 1, date: 'thaw' }, { at: st.t, band: 2, date: 'thaw' });
  Climate.fallDue(st, st.t);
  assert.strictEqual(st.pathCache.size, 0, 'the routes cached are emptied on the date');
  const round = Routes.route(st, north, south);
  assert(round.length - 1 >= 20 && !round.some((t) => w.water[t]), `on the thaw's day the route goes round (${round.length - 1} steps)`);
  assert.deepStrictEqual(groundBad(st), [], 'the ground compiled as the rule, after the thaw');
}
// The winter table (sim/villagehours): two villages across the lake, its hours over a normal winter's ice while ice bears, the land table's
// otherwise.
{
  const VH = VB['sim/villagehours'],
    w = tinyWorld(map),
    st = tinyState(w, [{ at: [12, 0], farms: 1, sizes: [2] }, { at: [12, 11], farms: 1, sizes: [2] }], { seed: 7 });
  Climate.layGround(st);
  VH.buildHours(st);
  const land = VH.hoursBetween(st, 0, 1);
  for (let j = 0; j < VH.ROW_STEPS; j++) VH.winterStep(st, j);
  const winter = st.winterHours[0][1];
  assert(winter !== null && winter < land, `the winter table finds the way over the ice shorter: ${winter} against ${land} hours`);
  assert.strictEqual(VH.hoursBetween(st, 0, 1), land, 'open water: the land table answers');
  for (const b of st.climate.bands) b.state = 'lakeBears';
  assert.strictEqual(VH.hoursBetween(st, 0, 1), winter, 'ice bears: the winter table answers');
  assert.strictEqual(VH.hoursBetween(st, 0, 1, 'land'), land, 'asked for the land table');
  assert.deepStrictEqual(checkState(st).filter((m) => m.startsWith('winterHours')), [], 'the winter table as its invariant asks');
  out.push(`between villages across the lake ${winter.toFixed(2)} hours in winter, ${land.toFixed(2)} by land`);
}
console.log(`winter ok: ${out.join('; ')}`);

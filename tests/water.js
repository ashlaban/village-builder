// VB-1551: the fetch is walked. On drawn maps (tests/lib/tiny.js): a farm's source is the first its household may draw at, by the walk
// (running water on its own tile, a lake from its bank, its village's well, a well of its own; marsh only when no good water lies within
// WATER.marshShy further); a house beside a brook fetches in about 0.36 hours and one 7 steps of meadow off in about 1.95; a farm with no
// water in reach posts no fetch; the water's fit loses nothing for its walk and the fetch heads the list of the member it is given to;
// marsh water costs HEALTH.marsh and the meal restores; the wells a run starts with are sources on the map.
const VB = require('../src/load.js'),
  Sim = VB.sim,
  Jobs = VB['sim/jobs'],
  Plans = VB['sim/plans'],
  Water = VB['sim/water'];
const { tinyWorld, tinyState, tileAt } = require('./lib/tiny.js');
const { checkState } = require('./lib/invariants.js');
const { FRESH, WELL } = VB['world/water'];
const { TICKS, DAY, WORK, HEALTH, cal } = VB['sim/rules'];
const { KINDS } = VB['sim/kinds'];
const { WATER, source, tripHours } = Water;
let failed = 0;
const check = (ok, m) => {
  if (!ok) {
    failed++;
    console.error('WATER FAIL:', m);
  }
};
const near = (x, y, e = 0.01) => Math.abs(x - y) <= e;
const meadow = (cols, rows) => Array.from({ length: rows }, () => '.'.repeat(cols));
// a brook on tile i of a drawn world, as the generator lays one: no crossing, so it is walked to and not through
const brook = (w, i) => {
  w.river[i] = 1;
  w.fresh[i] = FRESH.BROOK;
};

// ---- 1. the source of a house, by the search alone ----
{
  const w = tinyWorld(meadow(24, 9)),
    at = (c, r) => tileAt(w, c, r),
    house = at(4, 4);
  check(source(w, house, null).tile === -1, 'open meadow with no water: no source in reach');
  brook(w, at(11, 4));
  const far = source(w, house, null);
  check(
    far.tile === at(11, 4) && far.cls === FRESH.BROOK && near(far.walk, 0.875),
    `a brook 7 steps of meadow off is the source, 0.875 hours away (${JSON.stringify(far)})`,
  );
  check(near(tripHours(far.walk), 1.95), `its fetch is about 1.95 hours (${tripHours(far.walk)})`);
  brook(w, at(5, 4));
  const by = source(w, house, null);
  check(by.tile === at(5, 4) && near(by.walk, 0.125), `a brook beside the house is the source, a step off (${JSON.stringify(by)})`);
  check(near(tripHours(by.walk), 0.36), `its fetch is about 0.36 hours (${tripHours(by.walk)})`);
  // a well: its village's on the green, not another's; its own on the house's tile
  const w2 = tinyWorld(meadow(24, 9));
  brook(w2, at(11, 4));
  w2.fresh[at(6, 4)] = FRESH.WELL;
  const own = source(w2, house, { well: true, center: at(6, 4) }),
    other = source(w2, house, { well: true, center: at(20, 8) });
  check(own.tile === at(6, 4) && own.cls === FRESH.WELL && near(own.walk, 0.25), `its village's well, 2 steps off (${JSON.stringify(own)})`);
  check(other.tile === at(11, 4), `another village's well is not drawn at: the brook beyond it (${JSON.stringify(other)})`);
  w2.fresh[house] = FRESH.WELL;
  check(source(w2, house, null).tile === house && source(w2, house, null).walk === 0, 'a well of its own, by the door: no walk');
}
// ---- 2. marsh is a last resort: good water within the half hour further is drawn at, not the nearer marsh ----
{
  const rows = meadow(24, 9);
  rows[4] = '..m.....................'; // marsh at column 2; the house at 4: the marsh's edge is a step off
  const w = tinyWorld(rows),
    at = (c, r) => tileAt(w, c, r),
    house = at(4, 4);
  const alone = source(w, house, null);
  check(alone.cls === FRESH.MARSH && near(alone.walk, 0.125), `with no other water the marsh is drawn at, from its edge (${JSON.stringify(alone)})`);
  brook(w, at(13, 4)); // 9 steps: 1.125 hours, more than the half hour beyond the marsh's 0.125
  check(source(w, house, null).cls === FRESH.MARSH, 'a brook more than half an hour further than the marsh: the marsh');
  brook(w, at(8, 4)); // 4 steps: 0.5 hours, within the half hour further
  const good = source(w, house, null);
  check(
    good.tile === at(8, 4) && good.cls === FRESH.BROOK && good.walk - alone.walk <= WATER.marshShy,
    `a brook within the half hour further is drawn at, not the nearer marsh (${JSON.stringify(good)})`,
  );
  // a lake is drawn at from its bank
  const lr = meadow(24, 9);
  lr[4] = '.......oo...............';
  const wl = tinyWorld(lr),
    lake = source(wl, house, null);
  check(lake.cls === FRESH.LAKE && lake.tile === tileAt(wl, 6, 4) && near(lake.walk, 0.25), `a lake, from its bank (${JSON.stringify(lake)})`);
}
// ---- 3. the fetch as it is walked: a lone farm, its brook beside the house or 7 steps of meadow off ----
// The hours a member of the household has the water in hand on the second day (the first begins at the hour of work, with the day's
// water counted as in): the walk out, the drawing, the walk home laden.
const fetchOf = (steps) => {
  const w = tinyWorld(meadow(30, 13)),
    c0 = 8,
    r0 = 6;
  // the brook in the house's row, `steps` tiles east of it: laid before the state is made, on a map drawn again once the house is known
  const lay = (ww) => tinyState(ww, [{ at: [c0, r0], farms: 1, sizes: [3] }], { seed: 7 });
  brook(w, lay(tinyWorld(meadow(30, 13))).farmsteads[0].house + steps);
  const st = lay(w),
    hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  w.fresh[f.house] = FRESH.NONE; // a test's write: without the well a farm that has stood 7 steps off starts with (case 4)
  let ticks = 0,
    list = null,
    scores = null,
    took = null; // the hour the water was taken in hand
  const worked = new Set(); // the kinds of full work begun at the house's fields before it
  while (Math.floor(st.t / DAY) === 0) Sim.advance(st, 1 / TICKS);
  const d0 = 1,
    key = `water:h${hh.id}:${d0}`;
  while (Math.floor(st.t / DAY) === d0) {
    Sim.advance(st, 1 / TICKS);
    const j = st.jobs.get(key),
      plan = Plans.planOf(st, 'household', hh.id);
    if (j && plan.day && !list && Object.values(plan.day.lists).some((l) => l.includes(key))) {
      list = Object.values(plan.day.lists).find((l) => l.includes(key));
      // the water's fit as it is, and as it would be by the house: the walk takes nothing off it
      const p = st.pawns[hh.holder],
        c = cal(st.t);
      scores = [Jobs.score(st, p, j, c), Jobs.score(st, p, { ...j, site: f.house }, c), Jobs.score(st, p, { ...j, kind: 'brew' }, c)];
      scores.push(Jobs.score(st, p, { ...j, kind: 'brew', site: f.house }, c));
    }
    for (const id of hh.members) {
      const job = st.agents[id].job;
      if (job && job.kind === 'water') {
        ticks++;
        if (took === null) took = cal(st.t).hour + (st.t % 1);
      } else if (job && took === null && cal(st.t).hour >= WORK[0]) worked.add(job.kind);
    }
  }
  return { st, hh, f, hours: ticks / TICKS, list, key, scores, d0, took, worked: [...worked] };
};
{
  const by = fetchOf(1);
  check(by.f.water && by.f.water.cls === FRESH.BROOK && near(by.f.water.walk, 0.125), `the farm's source is the brook (${JSON.stringify(by.f.water)})`);
  check(by.hh.waterDay === by.d0, 'beside the brook the water is in that day');
  check(by.hours >= 0.25 && by.hours <= 0.6, `a house beside a brook fetches in about 0.36 hours (${by.hours})`);
  const far = fetchOf(7);
  check(near(far.f.water.walk, 0.875), `7 steps of meadow: 0.875 hours one way (${JSON.stringify(far.f.water)})`);
  check(far.hh.waterDay === far.d0, '7 steps off the water is in that day');
  check(far.hours >= 1.7 && far.hours <= 2.3, `a house 7 steps of meadow off fetches in about 1.95 hours (${far.hours})`);
  check(
    far.list && far.list.length > 1 && far.took !== null && far.took < WORK[0] + 0.5,
    `the fetch, 7 steps off, is taken as the work day begins, before the nearer work (taken at ${far.took}; the day: ${far.list}; begun before it: ${far.worked})`,
  );
  const s = far.scores;
  check(
    s && s[0] === s[1] && s[2] < s[3],
    `the water's fit loses nothing for its 7 steps (${s && s[0]} there, ${s && s[1]} by the house); a brewing's would (${s && s[2]}, ${s && s[3]})`,
  );
  const bad = checkState(far.st);
  check(!bad.length, `invariants: ${bad.slice(0, 3).join('; ')}`);
}
// ---- 4. no water in reach: no fetch is posted, and the page is told why ----
{
  const w = tinyWorld(meadow(20, 9)),
    st = tinyState(w, [{ at: [8, 4], farms: 1, sizes: [2] }], { seed: 7 }),
    hh = st.households[0],
    f = st.farmsteads[hh.farmstead];
  // the farm has stood for years, so it starts with a well of its own where its ground has one (At the start)
  check(w.fresh[f.house] === FRESH.WELL, 'a farm that has stood far from water starts with a well on its house tile');
  check(Water.sourceOf(st, f).tile === f.house && near(Sim.waterOf(st, f).hours, WATER.draw), 'and draws there, in the drawing alone');
  // without it: none in reach
  w.fresh[f.house] = FRESH.NONE; // a test's write
  Water.find(st, f);
  const posted = [];
  hh.waterDay = -1;
  KINDS.water.available(st, hh, f, { hour: WORK[0], day: 0 }, (key) => posted.push(key));
  check(f.water.tile === -1 && !posted.length && Sim.waterOf(st, f).none, `no source in reach: no fetch posted (${posted})`);
  const bad = checkState(st).filter((m) => m.includes('water'));
  check(!bad.length, `invariants with no source: ${bad.slice(0, 2).join('; ')}`);
  f.water.tile = f.house; // a test's write: a tile that is no source
  check(checkState(st).some((m) => m.includes('water')), 'the invariant sees a source that is none');
}
// ---- 5. a village that starts with its green: its well is a source on the green's tile, and its farms draw there ----
{
  const w = tinyWorld(meadow(24, 12)),
    st = tinyState(w, [{ at: [10, 5], farms: 3 }], { seed: 7 }),
    v = st.villages[0];
  check(v.well && w.fresh[v.center] === FRESH.WELL, 'the starting village has its well on the map, on the green');
  for (const id of v.farmsteads) {
    const s = Water.sourceOf(st, st.farmsteads[id]);
    check(
      s.cls === FRESH.WELL && (s.tile === v.center || s.tile === st.farmsteads[id].house),
      `farm ${id} draws at a well (${JSON.stringify(s)})`,
    );
    check(s.tile !== v.center || s.walk <= WELL.startWalk, `farm ${id} draws at the green within ${WELL.startWalk} h or has its own (${s.walk})`);
  }
  // a save keeps the wells
  const again = Sim.load(tinyWorld(meadow(24, 12)), JSON.parse(JSON.stringify(Sim.save(st))));
  check(again.w.fresh[v.center] === FRESH.WELL, 'a loaded run has its wells on the map');
}
// ---- 6. marsh water: the day's water in, the meal cooked, HEALTH.marsh off those it covers ----
{
  const w = tinyWorld(meadow(20, 9)),
    st = tinyState(w, [{ at: [8, 4], farms: 1, sizes: [2] }], { seed: 7 }),
    hh = st.households[0],
    p = st.pawns[hh.holder],
    { ate } = VB['sim/hunger'];
  KINDS.water.deliver(st, { poor: true }, hh);
  check(hh.waterDay === cal(st.t).day && hh.marshDay === hh.waterDay, 'a fetch at a marsh brings the day in, marked as marsh water');
  p.health = 50;
  ate(st, p, 1, 1, 0, 0, false);
  const clean = p.health - 50;
  p.health = 50;
  ate(st, p, 1, 1, 0, 0, true);
  const poor = p.health - 50;
  check(near(clean - poor, HEALTH.marsh, 1e-9) && poor > 0, `marsh water costs ${HEALTH.marsh}, and the meal restores (${clean}, ${poor})`);
}
if (failed) process.exit(1);
console.log('water ok: sources by the walk, marsh a last resort, the fetch walked (0.36 h beside a brook, 1.95 h at 7 steps), water first');

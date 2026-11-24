// scratch (VB-781): the reaches of daily work in steps against the walk in hours, at the journey scale. Not game code.
// node docs/plans/VB-781-reach.js ROOT scenario map seed[,seed] [years]
// For each live household: each kind's place as the step rule picks it today (the kind's own ground search), its hours one way by the
// route search's costs over SPEED (paths as they stand), and the nearest place of the kind by those hours, searched to OUT hours.
// over: the step pick's trip (2 x walk + the kind's work) does not fit the working day (12 hours, WORK).
// cut: no place within the steps, but one whose trip fits the day. nearer: a place at least a quarter hour nearer by the walk than the pick.
// The wood: every tile of the village's wood (trips are drawn evenly among them), from each house: the share whose trip does not fit.
// map: the tiles a bounded search to OUT hours settles from a house, and from a green (the cost of a compiled reach map).
const [root, scenario, map, seeds, years] = process.argv.slice(2);
const VB = require(root + '/src/load.js');
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200] };
const RU = VB['sim/rules'], R = VB['sim/routes'], W = VB['sim/walking'], H = VB['sim/hex'] || {};
const { SPEED, FISH, DEER, HERD, BUILD, WOOD } = RU;
const { FORAGE } = VB['sim/forage'];
const Fish = VB['sim/fish'], Forage = VB['sim/forage'], Deer = VB['sim/deer'], Graze = VB['sim/grazing'];
const bfs = H.bfs || (VB['sim/hex'] && VB['sim/hex'].bfs);
const DAYH = 12, OUT = Number(process.env.OUT || 6);
const q = (a, p) => { if (!a.length) return null; a = [...a].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i); return +(a[lo] + (a[Math.ceil(i)] - a[lo]) * (i - lo)).toFixed(2); };
for (const seed of seeds.split(',').map(Number)) {
  const it = VB.gen.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
  let st = VB.sim.seed(r.value, seed, scenario);
  if (+years) VB.sim.advance(st, +years * RU.YEAR);
  const w = st.w, greens = new Set(st.villages.map((v) => v.center));
  const bank = (t) => { if (w.river[t]) return false; for (let k = 0; k < 6; k++) { const j = w.nb[t * 6 + k]; if (Fish.isWater(w, j) && Fish.stock(st, j) >= FISH.least) return true; } return false; };
  const out = {}, wood = { trips: 0, over: 0, hours: [] }, mapHouse = [], mapGreen = [];
  const kinds = [
    { k: 'fish', R: FISH.reach, T: FISH.trip, ok: (hh, t) => bank(t), pick: (hh, h) => { const g = Fish.ground(st, h); return g ? g.shore : -1; } },
    { k: 'forage', R: FORAGE.reach, T: FORAGE.trip, ok: (hh, t) => Forage.wild(w, t) && !w.dev[t] && Forage.stock(st, t) >= FORAGE.least - 1e-6, pick: (hh, h) => Forage.ground(st, h) },
    { k: 'hunt', R: DEER.hunt.reach, T: DEER.hunt.hours, ok: (hh, t) => Deer.edgeTile(w, t) && !w.dev[t] && Deer.stock(st, w.region[t]) >= DEER.hunt.least, pick: (hh, h) => Deer.ground(st, h) },
    { k: 'pasture', R: HERD.herding.steps, T: HERD.herding.hours, ok: (hh, t) => Graze.grazable(st, hh, t, greens), pick: (hh) => Graze.pasture(st, hh), herds: true },
  ];
  for (const K of kinds) out[K.k] = { n: 0, picked: 0, hours: [], over: 0, cut: 0, nearer: 0, none: 0 };
  for (const hh of st.households) {
    if (!hh || hh.dissolved || !hh.members || !hh.members.length || hh.farmstead == null) continue;
    const f = st.farmsteads[hh.farmstead], h = f && f.house; if (h == null || h < 0) continue;
    const near = [...bfs(w, h, 70, W.walkable(w)).dist.keys()];
    const cost = R.reachCosts(w, h, OUT * SPEED, near), hrs = new Map();
    near.forEach((t, i) => { if (cost[i] != null) hrs.set(t, cost[i] / SPEED); });
    mapHouse.push(hrs.size);
    const steps = bfs(w, h, 30, W.walkable(w)).dist;
    for (const K of kinds) {
      if (K.herds && !(hh.herds && hh.herds.length)) continue;
      const o = out[K.k]; o.n++;
      const p = K.pick(hh, h); let best = Infinity;
      for (const [t, x] of hrs) if (x < best && t !== h && K.ok(hh, t)) best = x;
      if (p >= 0) {
        o.picked++; const x = hrs.has(p) ? hrs.get(p) : Infinity; o.hours.push(+x.toFixed(2));
        if (2 * x + K.T > DAYH) o.over++;
        if (best < x - 0.25) o.nearer++;
      } else if (2 * best + K.T <= DAYH) o.cut++; else o.none++;
    }
    const v = st.villages[f.village];
    if (v && v.wood) for (const t of v.wood) { const x = hrs.has(t) ? hrs.get(t) : Infinity; wood.trips++; wood.hours.push(x); if (2 * x + 2 > DAYH) wood.over++; }
  }
  for (const v of st.villages) { const near = [...bfs(w, v.center, 70, W.walkable(w)).dist.keys()]; mapGreen.push(R.reachCosts(w, v.center, OUT * SPEED, near).filter((c) => c != null).length); }
  for (const K of kinds) { const o = out[K.k]; o.hoursMedian = q(o.hours.filter(isFinite), 0.5); o.hoursMost = q(o.hours.filter(isFinite), 1); o.unreached = o.hours.filter((x) => !isFinite(x)).length; delete o.hours; }
  console.log(JSON.stringify({ scenario, map, seed, years: +years || 0, households: mapHouse.length, villages: st.villages.length, out: OUT, kinds: out,
    wood: { tiles: wood.trips, over: wood.over, overShare: +(wood.over / Math.max(1, wood.trips)).toFixed(3), median: q(wood.hours.filter(isFinite), 0.5), q90: q(wood.hours.filter(isFinite), 0.9), most: q(wood.hours.filter(isFinite), 1), beyondOut: wood.hours.filter((x) => !isFinite(x)).length },
    mapTiles: { house: { median: q(mapHouse, 0.5), most: q(mapHouse, 1) }, green: { median: q(mapGreen, 0.5), most: q(mapGreen, 1) } } }));
}

// Fishing (VB-117): a river or small lake tile's stock falls 0.1 a trip and recovers 0.02 a day, the sea's and a large lake's never; a trip
// brings home 4 rations times the stock into the household's meals; the ground is the nearest bank within 6 steps with fish; posted from
// spring day 3 to the end of autumn, a second trip under 12 days of spare food; urgency 0.2 at 24 days or more, 2.0 at none; roles rank
// foraging, fishing 2 for wife, maid and daughter. Founders at seed 7, 2 years: fish are landed, the state keeps its invariants.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/fish'], Stores = VB['sim/stores'];
const { KINDS } = VB['sim/kinds'], { ROLES, FISH, MATCH, DAY } = VB['sim/rules'], { dailyNeed } = VB['sim/hunger'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FISH FAIL:', m); } };
const world = (seed, size = [180, 130]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (season, sday, hour = 8) => ({ season, sday, doy: season * 12 + sday, day: season * 12 + sday, hour });
const near = (a, b) => Math.abs(a - b) < 1e-6;

// --- the kind and the roles
const K = KINDS.fish;
check(K.type === 'foraging' && K.hands === 1 && K.hours === 3 && K.carry && K.anim === 'fish', 'fish: foraging, 1 hand, 3 hours, carried, animated');
const want = { farmer: 3, wife: 2, farmhand: 6, maid: 2, son: 7, daughter: 2, retired: 3, child: 5 };
for (const [r, n] of Object.entries(want)) check(ROLES[r].prio.fish === n, `${r} ranks fishing ${ROLES[r].prio.fish}, not ${n}`);
check(ROLES.wife.work.foraging === 4 && ROLES.maid.work.foraging === 5 && ROLES.daughter.work.foraging === 6, 'foraging ranks of wife, maid, daughter');

// --- stocks
const st = Sim.seed(world(7), 7, 'founders'), w = st.w;
check(w.fish instanceof Float32Array && w.fish.every((x) => x === 1), 'a new world: every stock full');
const river = w.river.findIndex((x) => x > 0), sea = w.ocean.findIndex((x) => x === 1);
check(river >= 0 && F.runsDown(w, river) && !F.runsDown(w, sea), 'a river runs down, the sea does not');
const sizes = F.lakeSizes(w);
for (let i = 0; i < w.N; i++) if (w.water[i] && !w.ocean[i]) { check(F.runsDown(w, i) === (sizes[i] < FISH.bigLake), `lake tile ${i} of ${sizes[i]} tiles`); break; }
st.t = 10 * DAY;
check(near(F.landCatch(st, river), 4) && near(F.stock(st, river), 0.9), 'a first trip on a river: 4 rations, stock 0.9');
check(near(F.landCatch(st, river), 3.6) && near(F.stock(st, river), 0.8), 'a second: 3.6, stock 0.8');
st.t = 15 * DAY;
check(near(F.stock(st, river), 0.9), `five days on the stock is ${F.stock(st, river)}, not 0.9`);
st.t = 30 * DAY;
check(F.stock(st, river) === 1, 'the stock recovers to 1, no more');
check(near(F.landCatch(st, sea), 4) && F.stock(st, sea) === 1 && w.fish[sea] === 1, 'the sea does not run down');
w.fish[river] = 1; w.fishDay[river] = 0;

// --- the ground, the posting, the urgency and the catch at home
const f = st.farmsteads.find((x) => x.household !== null && F.ground(st, x.house));
check(!!f, 'no farm at seed 7 has a fishing ground');
if (f) {
  const hh = st.households[f.household], g = F.ground(st, f.house);
  check(!w.water[g.shore] && !w.river[g.shore] && F.isWater(w, g.water) && w.nb.slice(g.shore * 6, g.shore * 6 + 6).includes(g.water), 'the ground is a bank by its water');
  const posts = (c) => { const out = []; K.available(st, hh, f, c, (key, site, extra) => out.push({ key, site, ...extra }), f); return out; };
  check(posts(cal(0, 1)).length === 0 && posts(cal(3, 4)).length === 0, 'no fishing before spring day 3, nor in winter');
  const need = dailyNeed(st, hh), spare = (days) => { hh.meals = 0; hh.grain = Stores.reserved(st, hh, 'grain') + days * need; };
  spare(30);
  check(posts(cal(0, 2)).length === 1 && posts(cal(2, 11)).length === 1, 'one trip from spring day 3 to the end of autumn');
  const j = { farm: f, water: g.water, owner: { type: 'household', id: hh.id } };
  check(near(K.urgency(st, j, cal(1, 0), MATCH.urgency), 0.2), 'urgency 0.2 at 30 days of spare food');
  spare(12); check(near(K.urgency(st, j, cal(1, 0), MATCH.urgency), 1.1), `urgency ${K.urgency(st, j, cal(1, 0), MATCH.urgency)} at 12 days, not 1.1`);
  spare(11); check(posts(cal(1, 0)).length === 2, 'two trips under 12 days of spare food');
  spare(0); check(near(K.urgency(st, j, cal(1, 0), MATCH.urgency), 2), 'urgency 2 at none');
  const meals = hh.meals, s = F.stock(st, g.water);
  K.deliver(st, j, hh, f);
  check(near(hh.meals - meals, 4 * s), `the catch adds ${hh.meals - meals} meals, not ${4 * s}`);
  // the ground moves on when its water is fished out
  w.fish[g.water] = 0; w.fishDay[g.water] = Math.floor(st.t / DAY);
  if (F.runsDown(w, g.water)) { const h = F.ground(st, f.house); check(!h || h.water !== g.water, 'a fished-out water is no ground'); }
  w.fish.fill(1); w.fishDay.fill(0);
}

// --- a run: fish are landed in the season, the state keeps its invariants, a save carries the stocks
const run = Sim.seed(world(7), 7, 'founders');
Sim.advance(run, 48 * DAY * 1.5);
let landed = 0;
for (const hh of run.households) for (const x of hh.totals) if (x.kind === 'catch') landed += x.n;
check(landed > 0, 'founders at seed 7: no fish landed in a year and a half');
const bad = checkState(run); check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
const back = Sim.load(world(7), JSON.parse(JSON.stringify(Sim.save(run))));
check(back.w.fish.every((x, i) => x === run.w.fish[i]) && back.w.fishDay.every((x, i) => x === run.w.fishDay[i]), 'a save keeps the stocks');
if (failed) { console.error(`${failed} fishing checks failed`); process.exit(1); }
console.log('fishing: ok');

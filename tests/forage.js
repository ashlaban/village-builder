// Gathering (VB-118): a forest or heath tile's stock falls 0.2 a trip and is full again each spring; a trip brings home 2.5 rations times the
// stock home as fresh food (VB-119); the ground is the nearest such tile within 5 steps with at least 0.2 left; posted from summer day 6 to the
// end of autumn, a second trip under 12 days of spare food; the urgency is fishing's; ranks as foraging, gathering 3 for son and farmhand.
// Founders at seed 7, 2 years: food is gathered, the state keeps its invariants, a save keeps the stocks.
const VB = require('../src/load.js'), G = VB.gen, Sim = VB.sim, F = VB['sim/forage'], Stores = VB['sim/stores'];
const { KINDS } = VB['sim/kinds'], { ROLES, FORAGE, MATCH, DAY, YEAR_DAYS } = VB['sim/rules'], { dailyNeed } = VB['sim/hunger'];
const { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('FORAGE FAIL:', m); } };
const world = (seed, size = [180, 130]) => { const it = G.generate(seed, { cols: size[0], rows: size[1] }); let r; while (!(r = it.next()).done); return r.value; };
const cal = (season, sday, hour = 8) => ({ season, sday, doy: season * 12 + sday, day: season * 12 + sday, hour });
const near = (a, b) => Math.abs(a - b) < 1e-6;

// --- the kind and the roles
const K = KINDS.gather;
check(K.type === 'foraging' && K.hands === 1 && K.hours === 3 && K.carry === 'basket' && K.anim === 'forage', 'gather: foraging, 1 hand, 3 hours, carried in baskets');
const want = { farmer: 3, wife: 4, farmhand: 3, maid: 5, son: 3, daughter: 6, retired: 3, child: 5 };
for (const [r, n] of Object.entries(want)) check(ROLES[r].prio.gather === n, `${r} ranks gathering ${ROLES[r].prio.gather}, not ${n}`);

// --- stocks
const st = Sim.seed(world(7), 7, 'founders'), w = st.w;
check(w.forage instanceof Float32Array && w.forage.every((x) => x === 1), 'a new world: every stock full');
const wood = w.biome.findIndex((_, i) => F.wild(w, i));
st.t = 15 * DAY;
check(near(F.gather(st, wood), 2.5) && near(F.stock(st, wood), 0.8), 'a first trip: 2.5 rations, stock 0.8');
check(near(F.gather(st, wood), 2) && near(F.stock(st, wood), 0.6), 'a second: 2, stock 0.6');
st.t = (YEAR_DAYS + 1) * DAY;
check(F.stock(st, wood) === 1, 'full again the next spring');
w.forage.fill(1); w.forageYear.fill(0);

// --- the ground, the posting, the urgency and the baskets at home
const f = st.farmsteads.find((x) => x.household !== null && F.ground(st, x.house) >= 0);
check(!!f, 'no farm at seed 7 has a gathering ground');
if (f) {
  const hh = st.households[f.household], t = F.ground(st, f.house);
  check(F.wild(w, t), 'the ground is forest or heath');
  const posts = (c) => { const out = []; K.available(st, hh, f, c, (key, site, extra) => out.push({ key, site, ...extra }), f); return out; };
  check(posts(cal(1, 4)).length === 0 && posts(cal(0, 8)).length === 0 && posts(cal(3, 4)).length === 0, 'none before summer day 6, in spring or in winter');
  const need = dailyNeed(st, hh), spare = (days) => { hh.meals = 0; hh.grain = { barley: Stores.reserved(st, hh, 'grain') + days * need }; };
  spare(30);
  check(posts(cal(1, 5)).length === 1 && posts(cal(2, 11)).length === 1, 'one trip from summer day 6 to the end of autumn');
  const j = { farm: f, site: t, owner: { type: 'household', id: hh.id } };
  check(near(K.urgency(st, j, cal(1, 6), MATCH.urgency), 0.2), 'urgency 0.2 at 30 days of spare food');
  spare(11); check(posts(cal(1, 6)).length === 2, 'two trips under 12 days of spare food');
  spare(0); check(near(K.urgency(st, j, cal(1, 6), MATCH.urgency), 2), 'urgency 2 at none');
  const Pot = VB['sim/pot'], held = Pot.freshHeld(st, hh, 'gathered');
  K.deliver(st, j, hh, f);
  check(near(Pot.freshHeld(st, hh, 'gathered') - held, 2.5), `the baskets add ${Pot.freshHeld(st, hh, 'gathered') - held} gathered food, not 2.5`);
  // the ground moves on when its tile is picked bare
  w.forage[t] = 0.1; w.forageYear[t] = Math.floor(st.t / DAY / YEAR_DAYS);
  check(F.ground(st, f.house) !== t, 'a tile with under 0.2 left is no ground');
  w.forage.fill(1); w.forageYear.fill(0);
}

// --- a run: food is gathered in the season, the state keeps its invariants, a save carries the stocks
const run = Sim.seed(world(7), 7, 'founders');
Sim.advance(run, 48 * DAY * 1.5);
let got = 0;
for (const hh of run.households) for (const x of hh.totals) if (x.kind === 'gathering') got += x.n;
check(got > 0, 'founders at seed 7: nothing gathered in a year and a half');
const bad = checkState(run); check(!bad.length, 'invariants: ' + bad.slice(0, 3).join('; '));
const back = Sim.load(world(7), JSON.parse(JSON.stringify(Sim.save(run))));
check(back.w.forage.every((x, i) => x === run.w.forage[i]) && back.w.forageYear.every((x, i) => x === run.w.forageYear[i]), 'a save keeps the stocks');
if (failed) { console.error(`${failed} gathering checks failed`); process.exit(1); }
console.log('gathering: ok');

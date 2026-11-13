// Roe deer (VB-139, sim/deer): a stock in each region with forest, growing logistically (DEER.growth a year) towards DEER.perEdge deer a
// forest-edge tile (a wood tile beside open land), counted again each year; the deer graze DEER.graze cow-hours a deer a day over
// DEER.spots of the region's edge tiles in turn (sim/grazing); in summer a standing crop beside a wood and a broken stretch of the village
// fence is browsed with DEER.crop.chance times the deer against the capacity, losing DEER.crop.loss of its yield (logged); in autumn and
// winter men of 14 or more go hunting at the nearest forest edge within reach whose region holds a deer, with fishing's urgency; a kill
// (DEER.hunt.chance times the deer against the capacity) gives DEER.hunt.meat rations of fresh meat and one deer fewer. On a tiny village
// under a forest: the rules on constructed states, then a month of autumn, the invariants and a save.
const VB = require('../src/load.js'), Sim = VB.sim, D = VB['sim/deer'], Z = VB['sim/grazing'], Fd = VB['sim/fields'], { B } = VB.gen;
const { KINDS } = VB['sim/kinds'], { DEER, HERD, ROLES, MATCH, DAY, YEAR_DAYS } = VB['sim/rules'], { larderOf } = VB['sim/hunger'];
const { tinyWorld, tinyState } = require('./lib/tiny.js'), { checkState } = require('./lib/invariants.js');
let failed = 0; const check = (ok, m) => { if (!ok) { failed++; console.error('DEER FAIL:', m); } };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;
const cal = (season, sday, hour = 8) => ({ season, sday, doy: season * 12 + sday, day: season * 12 + sday, hour });
const rows = Array.from({ length: 14 }, (_, i) => (i < 3 ? 'FFFFFFFFFFFFFFFFFF' : i === 3 ? 'FFFF..........FFFF' : '..................'));
const make = () => tinyState(tinyWorld(rows), [{ at: [9, 9], farms: 3, sizes: [6, 5, 4] }], { seed: 3 });
const st = make(), w = st.w;

// --- the stock: every region with forest edges at its capacity, DEER.perEdge an edge tile
const edges = []; for (let i = 0; i < w.N; i++) if (D.edgeTile(w, i)) edges.push(i);
check(edges.length > 10 && edges.every((t) => w.biome[t] === B.FOREST), `${edges.length} forest-edge tiles`);
check(st.deer.edges.length === 1 && st.deer.edges[0].join() === edges.join(), 'the one region lists its forest edges');
const K = edges.length * DEER.perEdge;
check(near(st.deer.cap[0], K) && near(st.deer.head[0], K) && near(D.stock(st, 0), K) && D.density(st, 0) === 1, 'a new run: the deer at the capacity');
check(checkState(st).length === 0, `invariants at the start: ${checkState(st).join('; ')}`);
// logistic growth in closed form: half the capacity grows to K / (1 + e^-growth) in a year, and towards K
st.deer.head[0] = K / 2; st.deer.since[0] = Math.floor(st.t / DAY);
const t0 = st.t;
st.t = t0 + YEAR_DAYS * DAY;
check(near(D.stock(st, 0), K / (1 + Math.exp(-DEER.growth)), 1e-6), `a year from half: ${D.stock(st, 0)}`);
st.t = t0 + 40 * YEAR_DAYS * DAY;
check(D.stock(st, 0) > 0.99 * K && D.stock(st, 0) <= K + 1e-9, 'towards the capacity, never over it');
st.t = t0;
// the yearly count: a felled edge lowers the capacity; the deer are what they were
const felled = edges[0], before = D.stock(st, 0);
w.biome[felled] = B.MEADOW;
D.recount(st);
const edges2 = st.deer.edges[0];
check(!edges2.includes(felled) && near(st.deer.cap[0], edges2.length * DEER.perEdge) && near(st.deer.head[0], before), 'a recount moves the capacity, not the deer');
w.biome[felled] = B.FOREST; D.recount(st); st.deer.head[0] = st.deer.cap[0];

// --- grazing: the day's spots each get their share of the deer's pressure
{
  const c = cal(1, 3), e = st.deer.edges[0], S = DEER.spots, spots = [];
  for (let k = 0; k < S; k++) spots.push(e[(c.day * S + k) % e.length]);
  const was = spots.map((t) => Z.grazeOf(st, t));
  D.deerGraze(st, c);
  check(spots.every((t, k) => Z.grazeOf(st, t) >= was[k] + (K * DEER.graze) / S - 1e-3), 'the deer graze their spots of the day');
  w.graze.fill(0);
}

// --- a crop by a wood through a broken fence, in summer
const v = st.villages[0], fence = v.fence;
let fd = null, farm = null;
for (const fid of v.farmsteads) for (const x of st.farmsteads[fid].fields)
  if (!fd && fence.some((s) => s.edges.some((e) => VB['sim/hex'].hexSteps(w, e.tile, x.tile) <= 1))) { fd = x; farm = st.farmsteads[fid]; }
check(fd !== null, 'a field beside the village fence');
if (fd) {
  const wood = w.nb.slice(fd.tile * 6, fd.tile * 6 + 6).find((j) => j >= 0 && !st.used.has(j) && j !== farm.house);
  const was = w.biome[wood];
  w.biome[wood] = B.FOREST; // a wood beside the field
  fd.stage = 'growing'; fd.sown = 3; delete fd.browsed;
  for (const s of fence) s.cond = 1;
  const events = st.record.length;
  st.rng.deer.fix = 0;
  D.browseCrops(st);
  check(!fd.browsed && st.record.length === events, 'deer in a crop through a mended fence');
  for (const s of fence) s.cond = 0.2;
  st.rng.deer.fix = 0.999;
  D.browseCrops(st);
  check(!fd.browsed, 'deer in the crop against the chance');
  st.rng.deer.fix = 0;
  D.browseCrops(st);
  const e = st.record[st.record.length - 1];
  check(fd.browsed === 1 && e && e.kind === 'deerInCrop' && e.farm === farm.id && /broken fence/.test(e.text || ''), `browsed ${fd.browsed}, the event ${e && e.kind}`);
  // the crop loses DEER.crop.loss of its yield at the reaping
  const soil = fd.soil, reap = (n) => { fd.stage = 'ripe'; fd.soil = soil; if (n) fd.browsed = n; else delete fd.browsed; st.rng.fields.fix = 0.5; Fd.reaped(st, fd, cal(2, 3)); delete st.rng.fields.fix; return fd.held; };
  const plain = reap(0), lost = reap(1);
  check(Math.abs(lost - Math.round(plain * (1 - DEER.crop.loss))) <= 1 && lost < plain && fd.browsed === undefined, `reaped ${lost} browsed, ${plain} not`);
  // no deer in the region: none in the crop
  fd.stage = 'growing'; st.deer.head[0] = 0;
  D.browseCrops(st);
  check(!fd.browsed, 'deer in a crop where there are none');
  st.deer.head[0] = st.deer.cap[0];
  delete st.rng.deer.fix;
  w.biome[wood] = was;
  for (const s of fence) s.cond = 1;
}

// --- hunting: the kind, who hunts, when and where, and the kill
const H = KINDS.hunt;
check(H && H.type === 'foraging' && H.hands === 1 && H.minAge === 14 && H.hours === DEER.hunt.hours && H.deliver, 'hunt: foraging, 1 hand, from 14');
for (const r of ['wife', 'maid', 'daughter', 'retired', 'child']) check(ROLES[r].prio.hunt === 0, `${r} hunts`);
for (const r of ['farmer', 'farmhand', 'son']) check(ROLES[r].prio.hunt === ROLES[r].work.foraging && ROLES[r].prio.hunt > 0, `${r} does not hunt`);
{
  const hh = st.households[0], f = st.farmsteads[hh.farmstead], posted = [];
  const post = (key, site, extra) => posted.push({ key, site, extra });
  H.available(st, hh, f, cal(1, 5), post);
  check(posted.length === 0, 'hunting posted in summer');
  H.available(st, hh, f, cal(2, 5), post);
  H.available(st, hh, f, cal(3, 5), post);
  check(posted.length === 2 && posted.every((p) => D.edgeTile(w, p.site) && p.key === `hunt:h${hh.id}:${p.site}`), `hunting in autumn and winter: ${JSON.stringify(posted.map((p) => p.key))}`);
  const j = { kind: 'hunt', farm: f, site: posted[0] && posted[0].site };
  check(H.urgency(st, j, cal(2, 5), MATCH.urgency) === KINDS.fish.urgency(st, j, cal(2, 5), MATCH.urgency), 'its urgency is not fishing\'s');
  // the kill: one deer fewer and DEER.hunt.meat rations of fresh meat; a miss against the chance
  const meat = larderOf(hh, 'meat'), n = D.stock(st, 0);
  st.rng.deer.fix = 0.999;
  check(D.hunt(st, hh, j.site) === 0 && near(D.stock(st, 0), n) && larderOf(hh, 'meat') === meat, 'a kill against the chance');
  st.rng.deer.fix = 0;
  check(D.hunt(st, hh, j.site) === 1 && near(D.stock(st, 0), n - 1) && near(larderOf(hh, 'meat'), meat + DEER.hunt.meat), 'a kill: meat and a deer fewer');
  check(hh.larder.some((l) => l.kind === 'meat' && near(l.until, st.t + HERD.freshDays * DAY)), 'the meat is fresh, to be salted');
  // a region hunted below DEER.hunt.least: no hunting ground there, no kill
  st.deer.head[0] = DEER.hunt.least / 2; st.deer.since[0] = Math.floor(st.t / DAY);
  check(D.hunt(st, hh, j.site) === 0 && D.ground(st, f.house) === -1, 'hunting where there are no deer');
  delete st.rng.deer.fix;
}

// --- a month of autumn on a new run: men hunt, the deer fall, the state keeps its invariants, a save carries the deer
const run = make();
Sim.advance(run, 2 * 12 * DAY - run.t);
const hunters = new Set();
let bad = [];
for (let h = 0; h < 12 * 24; h++) {
  Sim.advance(run, 1);
  for (const id of run.living) {
    const a = run.agents[id];
    if (a.job && a.job.kind === 'hunt' && a.phase === 'work') hunters.add(id);
  }
  if (h % 24 === 0) bad = bad.concat(checkState(run));
}
check(hunters.size > 0, 'nobody hunted in a month of autumn');
for (const id of hunters) {
  const p = run.pawns[id];
  check(['farmer', 'farmhand', 'son'].includes(p.role) && Sim.age(run, p) >= 14, `a hunter ${id}: ${p.role} of ${Sim.age(run, p)}`);
}
const kills = run.households.reduce((n, hh) => n + hh.totals.filter((x) => x.kind === 'hunt').reduce((m, x) => m + x.count, 0), 0);
check(kills > 0, 'no kill in a month of autumn');
check(D.stock(run, 0) < run.deer.cap[0] - kills + 1, `${kills} kills, ${D.stock(run, 0).toFixed(2)} deer of ${run.deer.cap[0]}`);
check(bad.length === 0, `invariants: ${bad.slice(0, 3).join('; ')}`);
const back = Sim.load(run.w, JSON.parse(JSON.stringify(Sim.save(run))));
check(JSON.stringify(back.deer) === JSON.stringify(run.deer) && back.rng.deer && back.rng.deer.s === run.rng.deer.s, 'a save keeps the deer and their stream');
// a save made before the deer: every region at its capacity
const old = JSON.parse(JSON.stringify(Sim.save(run)));
delete old.state.deer;
const fresh = Sim.load(run.w, old);
check(fresh.deer && near(fresh.deer.head[0], fresh.deer.cap[0]) && fresh.deer.cap[0] > 0, 'an older save gets its deer');

if (failed) { console.error(`deer: ${failed} failed`); process.exit(1); }
console.log(`deer ok: ${edges.length} edges, capacity ${K.toFixed(1)}; ${hunters.size} hunters and ${kills} kills in a month of autumn, ${D.stock(run, 0).toFixed(1)} deer left`);

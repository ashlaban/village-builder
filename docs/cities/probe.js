// Probe for the cities review (docs/review-cities.md). Not part of the game and not under test: it reads the state of one long run and
// writes one JSON file for docs/cities/analyse.py. Sampled once a year, two hours after the moving round (autumn day 11), when the harvest
// is in and the year's moves are done.
//   node docs/cities/probe.js --scenario populous --seed 7 --map small --years 80 --out /tmp/cities/p7.json
//   [--town 1 --pull 0.3 --mort 1.8 --fert 0.8 --from 1]   a toy town outside the map (section 4 of the review): stuck landless adults go there
// Per year: population, landless adults by kind, marriage, households' stores, surplus and spoilage, wealth, the moves of the round.
// At the end: the map (biome, water, rivers), the villages, and two market potentials per land tile (on foot; on foot and by boat).
const VB = require('../../src/load.js'), G = VB.gen, Sim = VB.sim, fs = require('fs');
const H = VB['sim/herds'], F = VB['sim/hunger'], R = VB['sim/records'], RT = VB['sim/routes'], RULES = VB['sim/rules'], D = VB['sim/deaths'];
const SIZES = { tiny: [120, 85], small: [180, 130], medium: [280, 200], large: [380, 270] };
const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const scenario = opt('scenario', 'populous'), seed = +opt('seed', 7), map = opt('map', 'small'), years = +opt('years', 40), out = opt('out', '/tmp/probe.json');
const TOWN = +opt('town', 0) === 1, PULL = +opt('pull', 0.3), MORT = +opt('mort', 1.8), FERT = +opt('fert', 0.8), FROM = +opt('from', 1);
const YEAR = Sim.YEAR, YD = Sim.YEAR_DAYS, E = RULES.ECON;

const it = G.generate(seed, { cols: SIZES[map][0], rows: SIZES[map][1] }); let r; while (!(r = it.next()).done);
const st = Sim.seed(r.value, seed, scenario), w = st.w;
D.CAUSES.town = { event: 'Left for the town', log: 'left for the town' }; // the toy town takes pawns off the map through the death path

// every log line, since st.events keeps only the last 40
const lines = [];
const tap = () => { if (st.events.unshift.tapped) return; const f = function (...a) { for (const e of a) lines.push(e); return Array.prototype.unshift.apply(this, a); }; f.tapped = true; st.events.unshift = f; };

const cattleOf = (hh) => H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'cattle' ? hd.head.length : 0), 0);
const sheepOf = (hh) => H.herdsOf(st, hh).reduce((s, hd) => s + (hd.species === 'sheep' ? hd.ewes + hd.rams + hd.lambs : 0), 0);
const storeOf = (hh) => hh.grain + hh.rations + hh.unthreshed.reduce((s, x) => s + (+x || 0), 0);
const ageOf = (p) => (st.t - p.born) / YEAR;
const everMarried = new Set();
const noteUnions = () => { for (const u of st.unions) { everMarried.add(u.a); everMarried.add(u.b); } };

// ---- the toy town: people kept as {age, sex, married}, outside the map ----
const town = { people: [], fedShare: 1, log: [] };
const hazard = RULES.hazard;
function townYear(y, arrivals) {
  const t = { year: y, start: town.people.length, arrivals: arrivals.length, births: 0, deaths: 0, need: 0, bought: 0, fromSpoil: 0 };
  town.people.push(...arrivals);
  // food: a year of rations, bought from households' grain above seed and a year of their own need, in proportion to what they can spare
  t.need = town.people.reduce((s, q) => s + (q.age >= 14 ? 1 : 0.5) * YD, 0);
  // (only threshed grain is sold: grain still in sheaf counts towards what the household keeps, not what it sells)
  const spare = st.households.filter((h) => !h.dissolved)
    .map((h) => [h, Math.min(h.grain, Math.max(0, storeOf(h) - F.seedReserve(st, h) - F.dailyNeed(st, h) * YD))]);
  const total = spare.reduce((s, x) => s + x[1], 0), take = Math.min(t.need, total);
  for (const [h, s] of spare) if (s > 0) h.grain = Math.max(0, h.grain - take * s / total);
  t.bought = take; town.fedShare = t.need ? take / t.need : 1;
  // deaths: the sim's hazard by age, times the urban penalty, times more when the town went short
  const hungerMul = 1 + 3 * (1 - town.fedShare);
  town.people = town.people.filter((q) => { const dead = st.rand() < hazard(q.age) * MORT * hungerMul; if (dead) t.deaths++; return !dead; });
  // births: married women 20 to 44 at the rural rate measured this year, times FERT
  const women = town.people.filter((q) => q.sex === 'f' && q.married && q.age >= 20 && q.age < 45);
  for (const q of women) if (st.rand() < rural.birthRate * FERT) { town.people.push({ age: 0, sex: st.rand() < 0.5 ? 'm' : 'f', married: false }); t.births++; }
  // marriage in town needs no land: single adults pair off at 0.3 a year each
  for (const q of town.people) if (!q.married && q.age >= 20 && st.rand() < 0.3) q.married = true;
  for (const q of town.people) q.age += 1;
  t.end = town.people.length; town.log.push(t);
}
const rural = { birthRate: 0.2 };

// ---- one year's sample ----
const years_ = [], households = [];
let prevT = 0, prevHungry = new Map(), prevSpoilt = new Map(), prevBorn = 0;
function sample(y) {
  noteUnions();
  const alive = st.pawns.filter((p) => p.alive), live = st.households.filter((h) => !h.dissolved);
  const yr = { year: y, pop: alive.length, households: live.length, villages: st.villages.length, founded: st.villages.filter((v) => v.founded).length };
  const adults = alive.filter((p) => ageOf(p) >= 18), holders = new Set(live.map((h) => h.holder));
  const landless = adults.filter((p) => { if (holders.has(p.id)) return false; const sp = R.spouseOf(st, p.id); return sp === null || !holders.has(sp); });
  const demand = new Set(st.demand);
  Object.assign(yr, {
    adults: adults.length, landless: landless.length,
    landlessServants: landless.filter((p) => p.servant).length, landlessRetired: landless.filter((p) => p.retired).length,
    landlessWanting: landless.filter((p) => demand.has(p.id)).length, landlessWaitingCrowded: landless.filter((p) => (p.landWait || 0) > 0).length,
    waitedTwoPlus: landless.filter((p) => (p.landWait || 0) >= 2).length,
    landlessUnmarried: landless.filter((p) => R.spouseOf(st, p.id) === null).length,
    crowdedVillages: st.villages.filter((v) => v.crowded).length, crowdedAdults: st.villages.reduce((s, v) => s + (v.crowded || 0), 0),
  });
  // women 45 to 54: share never married (Hajnal's celibacy measure)
  // holders aged 20 to 50 with no spouse, by sex: under residence "with the land" two holders cannot marry each other (sim/lifecycle homeFor)
  const lone = adults.filter((p) => holders.has(p.id) && ageOf(p) >= 20 && ageOf(p) <= 50 && R.spouseOf(st, p.id) === null);
  yr.singleHoldersM = lone.filter((p) => p.sex === 'm').length; yr.singleHoldersF = lone.filter((p) => p.sex === 'f').length;
  const w45 = alive.filter((p) => p.sex === 'f' && ageOf(p) >= 45 && ageOf(p) < 55);
  yr.women45 = w45.length; yr.neverMarried45 = w45.filter((p) => !everMarried.has(p.id)).length;
  // flows since the last sample
  const born = st.pawns.filter((p) => !p.founder && p.born >= prevT && p.born < st.t);
  const died = st.pawns.filter((p) => p.died !== null && p.died >= prevT && p.died < st.t);
  const cause = {}; for (const p of died) { const e = p.events.find((x) => x.kind === 'died'); const c = e ? e.cause : 'unknown'; cause[c] = (cause[c] || 0) + 1; }
  const wives = alive.filter((p) => p.sex === 'f' && ageOf(p) >= 20 && ageOf(p) < 45 && R.spouseOf(st, p.id) !== null);
  rural.birthRate = wives.length ? born.length / wives.length : rural.birthRate;
  Object.assign(yr, { births: born.length, deaths: died.length, cause, marriages: st.unions.filter((u) => u.start >= prevT && u.start < st.t).length,
    wives: wives.length });
  const mine = lines.filter((e) => e.t >= prevT && e.t < st.t + 1);
  yr.left = mine.filter((e) => / leaves crowded /.test(e.text)).length;
  yr.joined = mine.filter((e) => / leaves crowded .* settles at /.test(e.text)).length;
  yr.noLand = mine.filter((e) => /^No land worth clearing/.test(e.text)).length;
  yr.noGrain = mine.filter((e) => /cannot spare the grain/.test(e.text)).length;
  // households: store, reserve, need, made this year, spoilt, wealth
  let spare = 0, deficit = 0, spoilt = 0, made = 0, need = 0;
  for (const hh of live) {
    const f = st.farmsteads[hh.farmstead], store = storeOf(hh), seedR = F.seedReserve(st, hh), needY = F.dailyNeed(st, hh) * YD;
    let m = 0, gifts = 0;
    for (const e of hh.ledger) {
      if (e.t < prevT || e.t >= st.t) continue;
      if (e.kind === 'harvest') m += e.n - E.seedPerField; else if (e.kind === 'milk' || e.kind === 'butter' || e.kind === 'meat') m += e.n; else if (e.kind === 'gift') gifts += e.n;
    }
    const sp = (hh.spoilt || 0) - (prevSpoilt.get(hh.id) || 0), hd = hh.hungryDays - (prevHungry.get(hh.id) || 0);
    prevSpoilt.set(hh.id, hh.spoilt || 0); prevHungry.set(hh.id, hh.hungryDays);
    spare += Math.max(0, store - seedR - needY); deficit += Math.max(0, seedR + needY - store); spoilt += sp; made += m; need += needY;
    const servants = hh.members.filter((id) => st.pawns[id].servant).length;
    households.push({ year: y, id: hh.id, farm: f.id, village: f.village, members: hh.members.length, servants, store: Math.round(store), seed: seedR,
      need: +needY.toFixed(1), made: +m.toFixed(1), gifts: +gifts.toFixed(1), spoilt: +sp.toFixed(1), hungry: hd, cattle: cattleOf(hh), sheep: sheepOf(hh),
      fields: f.fields.length, meadows: (f.meadows || []).length, booth: !!f.booth, founded: !!st.villages[f.village].founded });
  }
  Object.assign(yr, { spare: Math.round(spare), deficit: Math.round(deficit), spoilt: Math.round(spoilt), made: Math.round(made), need: Math.round(need),
    weather: +st.weather.toFixed(3) });
  prevT = st.t; years_.push(yr);
  return yr;
}

// ---- the stuck: landless adults who still wait in a crowded village after the round; the toy town takes some ----
function toTown(y) {
  if (!TOWN || y < FROM || town.fedShare < 0.95) return [];
  const goers = [], gone = new Set();
  for (const p of st.pawns) {
    if (!p.alive || (p.landWait || 0) < 1 || gone.has(p.id)) continue;
    const a = ageOf(p); if (a < 18 || a > 45 || Sim.isHolder(st, p.id) || st.rand() >= PULL) continue;
    const party = [p.id], sp = R.spouseOf(st, p.id);
    if (sp !== null && st.pawns[sp].alive && !Sim.isHolder(st, sp)) party.push(sp);
    for (const id of [...party]) for (const c of R.childrenOf(st, id)) { const q = st.pawns[c]; if (q.alive && ageOf(q) < 18 && q.household === p.household && !Sim.isHolder(st, c)) party.push(c); }
    for (const id of new Set(party)) { const q = st.pawns[id]; gone.add(id); goers.push({ age: Math.floor(ageOf(q)), sex: q.sex, married: R.spouseOf(st, id) !== null }); Sim.killPawn(st, id, 'town'); }
  }
  return goers;
}

const t0 = Date.now();
for (let y = 1; y <= years; y++) {
  tap();
  const at = (y - 1) * YEAR + 34 * 24 + 14; // two hours after the moving round
  if (st.t < at) Sim.advance(st, at - st.t);
  const yr = sample(y);
  if (TOWN) { const goers = toTown(y); townYear(y, goers); yr.town = town.log[town.log.length - 1]; }
  if (y % 10 === 0) console.error(`${scenario} ${seed} ${map} year ${y}: pop ${yr.pop}, landless ${yr.landless}, crowded ${yr.crowdedAdults}, villages ${yr.villages}` +
    `${TOWN ? `, town ${town.people.length}` : ''} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
}

// ---- the map, the villages, and market potential ----
// Cost of a step: walking as in sim/routes (worn paths included); by boat, BOAT a water tile, plus EMBARK to put out from the shore.
const BOAT = 0.35, EMBARK = 3, LAMBDA = 12; // potential = sum over villages of people * exp(-cost / LAMBDA)
function dijkstra(src, boat, maxCost) {
  const dist = new Float64Array(w.N).fill(Infinity), hk = [], hn = []; dist[src] = 0;
  const push = (k, n) => { let c = hk.push(k) - 1; hn.push(n); while (c > 0) { const p = (c - 1) >> 1; if (hk[p] <= hk[c]) break; [hk[p], hk[c]] = [hk[c], hk[p]]; [hn[p], hn[c]] = [hn[c], hn[p]]; c = p; } };
  const pop = () => { const top = [hk[0], hn[0]], lk = hk.pop(), ln = hn.pop(); if (hk.length) { hk[0] = lk; hn[0] = ln; for (let c = 0; ;) { const l = 2 * c + 1, r = l + 1; let m = c;
    if (l < hk.length && hk[l] < hk[m]) m = l; if (r < hk.length && hk[r] < hk[m]) m = r; if (m === c) break; [hk[m], hk[c]] = [hk[c], hk[m]]; [hn[m], hn[c]] = [hn[c], hn[m]]; c = m; } } return top; };
  const cost = (i) => (w.water[i] ? (boat && w.landDist[i] <= 3 ? BOAT : Infinity) : RT.tileCost(w, i));
  push(0, src);
  while (hk.length) {
    const [d, i] = pop();
    if (d > dist[i] || d > maxCost) continue;
    for (let k = 0; k < 6; k++) {
      const j = w.nb[i * 6 + k]; if (j < 0) continue;
      const cj = cost(j); if (cj === Infinity) continue;
      const step = (Math.min(cost(i), 5) + cj) / 2 + (boat && !w.water[i] && w.water[j] ? EMBARK : 0);
      if (d + step < dist[j]) { dist[j] = d + step; push(d + step, j); }
    }
  }
  return dist;
}
const vrows = st.villages.map((v) => ({ id: v.id, name: v.name, center: v.center, x: +w.hx[v.center].toFixed(1), y: +w.hy[v.center].toFixed(1),
  farms: v.farmsteads.length, occupied: v.farmsteads.filter((id) => st.farmsteads[id].household !== null).length, founded: v.founded ? Math.floor(v.founded.t / YEAR) + 1 : null,
  people: st.pawns.filter((p) => p.alive && p.household !== null && R.settlementIdOf(st, p) === v.id).length }));
const potFoot = new Float64Array(w.N), potBoat = new Float64Array(w.N);
for (const v of vrows) {
  if (!v.people) continue;
  for (const [pot, boat] of [[potFoot, false], [potBoat, true]]) {
    const d = dijkstra(v.center, boat, 6 * LAMBDA);
    for (let i = 0; i < w.N; i++) if (d[i] < Infinity && !w.water[i]) pot[i] += v.people * Math.exp(-d[i] / LAMBDA);
  }
}
const round = (a, k = 1) => Array.from(a, (x) => +x.toFixed(k));
fs.writeFileSync(out, JSON.stringify({
  scenario, seed, map, years, town: TOWN ? { pull: PULL, mort: MORT, fert: FERT, from: FROM, log: town.log, final: town.people.length } : null,
  years: years_, households, villages: vrows,
  world: { cols: w.COLS, rows: w.ROWS, hx: round(w.hx), hy: round(w.hy), biome: Array.from(w.biome), water: Array.from(w.water), ocean: Array.from(w.ocean),
    river: Array.from(w.river, (x) => (x ? 1 : 0)), owner: Array.from(st.owner, (x) => (x > 0 ? 1 : x < 0 ? 2 : 0)), potFoot: round(potFoot, 2), potBoat: round(potBoat, 2),
    lambda: LAMBDA, boat: BOAT, embark: EMBARK, B: VB.gen.B },
}));
console.error(`wrote ${out} in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

// node analyze.js SAVE.json.gz  -> JSON of snapshot metrics (household, food, land, goodwill, culture) and,
// from the whole pawn list, demography per decade up to the save's year.
const { Sim, VB, loadSave } = require('./lib.js');
const f = process.argv[2];
const { st, w } = loadSave(f);
const Y = Sim.YEAR, YD = Sim.YEAR_DAYS, yearNow = Math.round(st.t / Y);
const R = VB['sim/rules'], GW = R.GOODWILL;
const yrs = (t) => t / Y;
const ageAt = (p, t) => (t - p.born) / Y;
const gini = (xs) => { const a = xs.filter((x) => Number.isFinite(x)).map((x) => Math.max(0, x)).sort((p, q) => p - q), n = a.length; if (!n) return null;
  const s = a.reduce((x, y) => x + y, 0); if (!s) return 0; let c = 0; a.forEach((x, i) => { c += (2 * (i + 1) - n - 1) * x; }); return c / (n * s); };
const q = (xs, p) => { const a = [...xs].sort((x, y) => x - y); if (!a.length) return null; return a[Math.min(a.length - 1, Math.floor(p * a.length))]; };
const r2 = (x) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

// ---------- demography by decade (from all pawns ever) ----------
const pawns = st.pawns;
const deathCause = new Map();
for (const e of st.record) if (e && typeof e === 'object' && e.kind === 'died') deathCause.set(e.pawn, e.text);
const firstUnion = new Map();
for (const u of st.unions) for (const id of [u.a, u.b]) if (!firstUnion.has(id) || firstUnion.get(id) > u.start) firstUnion.set(id, u.start);
const children = new Map(); // mother -> birth times
for (const p of pawns) if (p.mother !== null && p.mother !== undefined) { if (!children.has(p.mother)) children.set(p.mother, []); children.get(p.mother).push(p.born); }
const living = (t) => pawns.filter((p) => p.born <= t && (p.died === null || p.died > t)).length;
const decades = [];
for (let d0 = 0; d0 < yearNow; d0 += 10) {
  const t0 = d0 * Y, t1 = Math.min(yearNow, d0 + 10) * Y, len = (t1 - t0) / Y;
  const born = pawns.filter((p) => p.born >= t0 && p.born < t1 && p.born >= 0);
  const died = pawns.filter((p) => p.died !== null && p.died >= t0 && p.died < t1);
  const causes = {}; for (const p of died) { const c = deathCause.get(p.id) || 'unknown'; causes[c] = (causes[c] || 0) + 1; }
  const p0 = living(t0), p1 = living(t1 - 1e-6);
  // period TFR: births to women of age group / woman-years in it, summed x5
  let tfr = 0;
  for (let a = 15; a < 50; a += 5) {
    let wy = 0, b = 0;
    for (const p of pawns) {
      if (p.sex !== 'f' && p.sex !== 'F' && p.sex !== 'female') continue;
      const s = Math.max(t0, p.born + a * Y), e = Math.min(t1, p.born + (a + 5) * Y, p.died === null ? Infinity : p.died);
      if (e > s) wy += (e - s) / Y;
      for (const bt of children.get(p.id) || []) if (bt >= t0 && bt < t1 && ageAt(p, bt) >= a && ageAt(p, bt) < a + 5) b++;
    }
    if (wy > 0) tfr += 5 * b / wy;
  }
  // infant and child death, cohort of the decade's births (censored: only those with follow-up)
  const fu1 = born.filter((p) => p.born + Y <= st.t), fu15 = born.filter((p) => p.born + 15 * Y <= st.t);
  const d1 = fu1.filter((p) => p.died !== null && p.died < p.born + Y).length, d15 = fu15.filter((p) => p.died !== null && p.died < p.born + 15 * Y).length;
  // period probabilities from age-specific death rates (life table) for q1 and q15
  const rate = (a0, a1) => { let ex = 0, dd = 0; for (const p of pawns) { const s = Math.max(t0, p.born + a0 * Y), e = Math.min(t1, p.born + a1 * Y, p.died === null ? Infinity : p.died);
    if (e > s) ex += (e - s) / Y; if (p.died !== null && p.died >= t0 && p.died < t1) { const a = ageAt(p, p.died); if (a >= a0 && a < a1) dd++; } } return ex > 0 ? dd / ex : null; };
  const m0 = rate(0, 1), m1_5 = rate(1, 5), m5_15 = rate(5, 15);
  const q1p = m0 === null ? null : 1 - Math.exp(-m0), q15p = (m0 === null || m1_5 === null || m5_15 === null) ? null : 1 - Math.exp(-(m0 + 4 * m1_5 + 10 * m5_15));
  // first marriages in the decade
  const fm = { f: [], m: [] };
  for (const [id, t] of firstUnion) if (t >= t0 && t < t1 && t >= 0) { const p = pawns[id]; fm[p.sex === 'f' ? 'f' : 'm'].push(ageAt(p, t)); }
  const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  decades.push({ from: d0, to: d0 + len, popStart: p0, popEnd: p1, growthPerYear: p0 > 0 ? r2(100 * (Math.pow(p1 / p0, 1 / len) - 1)) : null,
    births: born.length, deaths: died.length, causes, tfr: r2(tfr), cohortQ1: fu1.length ? r2(d1 / fu1.length) : null, cohortQ15: fu15.length ? r2(d15 / fu15.length) : null,
    periodQ1: r2(q1p), periodQ15: r2(q15p), firstMarriageAgeF: r2(mean(fm.f)), firstMarriageAgeM: r2(mean(fm.m)), firstMarriagesF: fm.f.length, firstMarriagesM: fm.m.length });
}
const sexes = [...new Set(pawns.map((p) => p.sex))];

// ---------- snapshot ----------
const alive = pawns.filter((p) => p.died === null);
const neverMarried = (lo) => { const a = alive.filter((p) => ageAt(p, st.t) >= lo); return { n: a.length, share: a.length ? r2(a.filter((p) => !firstUnion.has(p.id)).length / a.length) : null }; };
const live = st.households.filter((h) => !h.dissolved);
const sizes = live.map((h) => h.members.length);
const need = (h) => h.members.reduce((s, id) => s + (ageAt(pawns[id], st.t) >= 14 ? 1 : 0.5), 0);
const grain = (h) => Object.values(h.grain || {}).reduce((s, x) => s + x, 0);
const larder = (h) => (h.larder || []).reduce((s, l) => s + l.n, 0);
const foodHeld = (h) => grain(h) + larder(h) + (h.meals || 0) + (h.unthreshed || []).reduce((s, x) => s + (typeof x === 'number' ? x : (x && x.n) || 0), 0);
const daysHeld = live.map((h) => { const n = need(h); return n > 0 ? foodHeld(h) / n : 0; });
const perHead = live.map((h) => foodHeld(h) / Math.max(1, h.members.length));
const dec = (xs) => [0.1, 0.25, 0.5, 0.75, 0.9].map((p) => r2(q(xs, p)));

// food flows over the last full years held in ledgers/totals (years yearNow-2..yearNow)
const flows = {};
const fy = (y) => (flows[y] ||= { households: 0, need: 0, harvest: 0, thresh: 0, seed: 0, spoilGrain: 0, giftOut: 0, giftIn: 0, brew: 0, eatenGrain: 0, raw: 0,
  milk: 0, butter: 0, meat: 0, catch: 0, gathering: 0, share: 0, handingOn: 0, provisions: 0, start: 0, fieldsSown: 0, hhHarvest: [], toVillage: 0, vilSpoil: 0, vilOut: 0 });
const ledgerYear = (t) => Math.floor(t / Y) + 1;
for (const h of live) {
  const per = {};
  for (const x of h.totals || []) { const o = fy(x.year);
    if (x.kind === 'spoilage' && x.good === 'grain') o.spoilGrain -= x.n;
    if (x.kind === 'cooking' && x.good === 'grain') o.eatenGrain -= x.n;
    if (x.kind === 'raw' && x.good === 'grain') o.raw -= x.n;
    if (x.kind === 'thresh' && x.good === 'grain') o.thresh += x.n;
    if (x.kind === 'milk') o.milk += x.n; if (x.kind === 'butter') o.butter += x.n; if (x.kind === 'catch') o.catch += x.n; if (x.kind === 'gathering') o.gathering += x.n;
  }
  for (const e of h.ledger || []) { const y = ledgerYear(e.t), o = fy(y); per[y] ||= { harvest: 0, seed: 0 };
    if (e.kind === 'harvest' && (e.good === 'sheaves' || e.good === 'grain')) { o.harvest += e.n; per[y].harvest += e.n; }
    if (e.kind === 'seed') { o.seed -= e.n; per[y].seed -= e.n; o.fieldsSown++; }
    if (e.kind === 'gift' && e.good === 'grain') { if (e.n < 0) { if (e.to === 'the village store') o.toVillage -= e.n; else o.giftOut -= e.n; } else o.giftIn += e.n; }
    if (e.kind === 'brew' && e.good === 'grain') o.brew -= e.n;
    if (e.kind === 'meat') o.meat += e.n;
    if (['share', 'handingOn', 'provisions', 'start'].includes(e.kind) && e.good === 'grain') o[e.kind] += e.n;
  }
  for (const y in per) if (per[y].seed > 0) fy(y).hhHarvest.push({ h: h.id, ratio: per[y].harvest / per[y].seed, harvest: per[y].harvest, seed: per[y].seed });
}
for (const v of st.villages) { for (const x of v.totals || []) if (x.kind === 'spoilage' && x.good === 'grain') fy(x.year).vilSpoil -= x.n;
  for (const e of v.ledger || []) if (e.kind === 'gift' && e.n < 0) fy(ledgerYear(e.t)).vilOut -= e.n; }
const villageGrain = st.villages.reduce((s, v) => s + Object.values(v.grain || {}).reduce((a, b) => a + b, 0), 0);
const hhGrain = live.reduce((s, h) => s + grain(h), 0);
const fullYears = Object.keys(flows).map(Number).filter((y) => y <= yearNow && y > yearNow - 3);
const flowOut = fullYears.map((y) => { const o = flows[y]; const ratios = o.hhHarvest.map((x) => x.ratio);
  return { year: y, harvest: Math.round(o.harvest), seed: Math.round(o.seed), seedYield: r2(o.harvest / Math.max(1, o.seed)), hhSeedYieldMedian: r2(q(ratios, 0.5)),
    hhSeedYieldP10: r2(q(ratios, 0.1)), hhSeedYieldP90: r2(q(ratios, 0.9)), spoilGrain: Math.round(o.spoilGrain), giftGrainOut: Math.round(o.giftOut), giftGrainIn: Math.round(o.giftIn), toVillageStore: Math.round(o.toVillage), villageSpoil: Math.round(o.vilSpoil), villageGaveOut: Math.round(o.vilOut), brewGrain: Math.round(o.brew),
    eatenGrainCooked: Math.round(o.eatenGrain), eatenGrainRaw: Math.round(o.raw), milk: Math.round(o.milk), butter: Math.round(o.butter), meat: Math.round(o.meat), catch: Math.round(o.catch),
    gathering: Math.round(o.gathering), transfers: { share: Math.round(o.share), handingOn: Math.round(o.handingOn), provisions: Math.round(o.provisions), start: Math.round(o.start) } }; });
// per household, the last full year: rations produced (grain net of seed, milk, butter, meat, catch, gathering) over its members' need
const ratioHH = [];
for (const h of live) {
  const y = yearNow; let prod = 0;
  for (const x of h.totals || []) if (x.year === y && ['milk', 'butter', 'catch', 'gathering'].includes(x.kind) && x.n > 0) prod += x.n;
  for (const e of h.ledger || []) if (ledgerYear(e.t) === y) { if (e.kind === 'harvest') prod += e.n; if (e.kind === 'seed') prod += e.n; if (e.kind === 'meat') prod += e.n; }
  const n = need(h) * YD; if (n > 0) ratioHH.push(prod / n);
}
const yearNeed = live.reduce((s, h) => s + need(h), 0) * YD;

// land
const N = w.N, water = w.water; let landTiles = 0, owned = 0, ownedHH = 0, ownedVil = 0;
for (let i = 0; i < N; i++) if (!water[i]) { landTiles++; if (st.owner[i] !== 0) { owned++; if (st.owner[i] > 0) ownedHH++; else ownedVil++; } }
const fieldsPer = live.map((h) => { const fs = st.farmsteads[h.farmstead]; return fs ? fs.fields.length : 0; });
const meadowsPer = live.map((h) => { const fs = st.farmsteads[h.farmstead]; return fs && fs.meadows ? fs.meadows.length : 0; });
const tilesPerHH = new Map(); for (let i = 0; i < N; i++) if (st.owner[i] > 0) tilesPerHH.set(st.owner[i] - 1, (tilesPerHH.get(st.owner[i] - 1) || 0) + 1);
const hhTiles = live.map((h) => tilesPerHH.get(h.id) || 0);
const fieldsPerHead = live.map((h, i) => fieldsPer[i] / Math.max(1, h.members.length));
const cattle = live.map((h) => (h.herds || []).reduce((s, id) => { const hd = st.herds && st.herds[id]; return s + (hd && hd.animals ? hd.animals.length : hd && hd.n ? hd.n : 0); }, 0));

// goodwill
let pairs = 0, gwTotal = 0; const gwByHH = new Map(), owedByHH = new Map();
for (const p of alive) if (p.goodwill) for (const [j, e] of p.goodwill) {
  if (j < p.id) continue; const pj = pawns[j]; if (!pj || pj.died !== null) continue;
  const v = e.v * Math.pow(0.5, (st.t - e.t) / (GW.halfLife * Y)); if (Math.abs(v) < GW.forget) continue;
  pairs++; gwTotal += Math.abs(v);
  const cred = v > 0 ? p : pj, debt = v > 0 ? pj : p;
  gwByHH.set(cred.household, (gwByHH.get(cred.household) || 0) + Math.abs(v)); owedByHH.set(debt.household, (owedByHH.get(debt.household) || 0) + Math.abs(v));
}
const credits = live.map((h) => gwByHH.get(h.id) || 0);
const credSorted = [...credits].sort((a, b) => b - a); const top3 = credSorted.slice(0, 3).reduce((a, b) => a + b, 0);
const gifts = {}; for (const e of st.record) if (e && typeof e === 'object' && e.kind === 'gift') { const y = Math.floor(e.t / Y) + 1; (gifts[y] ||= { n: 0, rations: 0 }); gifts[y].n++; gifts[y].rations += e.n || 0; }
const giftsFolded = (st.recordYears || []).filter((r) => r.kind === 'gift');

// culture
const env = st.cenv, nC = env.cultures.length;
const sets = env.settlements.map((s) => ({ id: s.id, culture: s.culture, kind: s.kind, divergence: r2(s.divergence), tie: r2(s.tie), practice: s.practice }));
const keys = sets.length ? Object.keys(sets[0].practice) : [];
let maxDiff = 0, sumDiff = 0, nPairs = 0;
for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) { let d = 0; for (const k of keys) if (sets[i].practice[k] !== sets[j].practice[k]) d++; maxDiff = Math.max(maxDiff, d); sumDiff += d; nPairs++; }
// attitude spread between settlements (mean of per-custom support)
const supp = env.settlements.map((s) => s.lastSupport || {}); const sk = supp.length ? Object.keys(supp[0]) : [];
let attSpread = 0; for (const k of sk) { const v = supp.map((x) => x[k]).filter((x) => x !== undefined); if (v.length > 1) attSpread += Math.max(...v) - Math.min(...v); }
const evCount = (k) => st.record.filter((e) => e && typeof e === 'object' && e.kind === k).length;

const out = {
  file: f.split('/').pop(), scenario: st.scenario, year: yearNow, living: alive.length, sexes, decades,
  neverMarried: { age30plus: neverMarried(30), age45plus: neverMarried(45) },
  households: { n: live.length, meanSize: r2(sizes.reduce((a, b) => a + b, 0) / Math.max(1, sizes.length)), single: r2(sizes.filter((s) => s === 1).length / Math.max(1, sizes.length)),
    sizeDist: sizes.reduce((o, s) => ((o[s] = (o[s] || 0) + 1), o), {}) },
  foodAtSave: { note: 'at year end (end of winter, stores lowest)', daysHeldDeciles: dec(daysHeld), daysHeldGini: r2(gini(daysHeld)), perHeadGini: r2(gini(perHead)),
    shareBelow20Days: r2(daysHeld.filter((d) => d < 20).length / Math.max(1, daysHeld.length)), shareBelow48Days: r2(daysHeld.filter((d) => d < 48).length / Math.max(1, daysHeld.length)),
    grainGini: r2(gini(live.map(grain))), hungerNow: r2(live.filter((h) => h.hunger > 0).length / Math.max(1, live.length)) },
  flows: flowOut, producedOverNeedHH: { deciles: dec(ratioHH), below1: r2(ratioHH.filter((r) => r < 1).length / Math.max(1, ratioHH.length)), below167: r2(ratioHH.filter((r) => r < 1.67).length / Math.max(1, ratioHH.length)), gini: r2(gini(ratioHH)) }, storeNow: { householdGrain: Math.round(hhGrain), villageGrain: Math.round(villageGrain) }, yearNeedNow: Math.round(yearNeed),
  land: { landTiles, owned, ownedShare: r2(owned / landTiles), ownedByHouseholds: ownedHH, ownedByVillages: ownedVil, used: st.used ? st.used.size : null,
    fieldsTotal: fieldsPer.reduce((a, b) => a + b, 0), fieldsPerHH: r2(fieldsPer.reduce((a, b) => a + b, 0) / Math.max(1, live.length)), fieldsPerHHDeciles: dec(fieldsPer),
    meadowsPerHH: r2(meadowsPer.reduce((a, b) => a + b, 0) / Math.max(1, live.length)), fieldsGini: r2(gini(fieldsPer)), fieldsPerHeadGini: r2(gini(fieldsPerHead)), tilesGini: r2(gini(hhTiles)),
    villages: st.villages.length, villagesFoundedInPlay: st.villages.filter((v) => v.founded).length, crowded: st.villages.reduce((s, v) => s + (v.crowded || 0), 0) },
  goodwill: { pairs, total: Math.round(gwTotal), perHH: r2(gwTotal / Math.max(1, live.length)), hhWithCredit: credits.filter((c) => c > 0).length, creditGini: r2(gini(credits)),
    top3Share: r2(top3 / Math.max(1e-9, gwTotal)), giftsByYear: gifts, giftsFolded },
  culture: { cultures: nC, settlements: sets.length, meanPracticeDiff: r2(sumDiff / Math.max(1, nPairs)), maxPracticeDiff: maxDiff, customs: keys.length, supportSpreadSum: r2(attSpread),
    divergence: sets.map((s) => s.divergence), customEvents: evCount('custom'), splitEvents: evCount('split'), meetingFailed: evCount('meetingFailed'),
    history: env.cultures.map((c) => (c.history || []).length) },
};
console.log(JSON.stringify(out));

// usage: node tools/gossip.js [--seeds 1,2,...] [--years 4] [--model stories|averaging|both] [--start DAY]
//                             [--set key=value,...] [--sweep] [--json]
//   The gossip experiment (VB-187; docs/architecture/target-v2.md, section 10.2; report in docs/gossip-experiment.md): one story about
//   one pawn, told where people meet in a reduced scenario, under two models on the same seeds and the same meetings:
//     stories    model B (target-v2 4.4, Stories): a pawn holds the story itself, picked by salience and zeal, believed by trust and fit,
//                sharpened at each retelling, told with less zeal to those who know it (saturation), forgotten when untold; a lie
//                meeting a first-hand memory of the opposite sign is exposed and starts a counter-story about the liar
//     averaging  the baseline: a pawn holds only an opinion of the subject, adopted from the first teller and averaged with each
//                later one (DeGroot); nothing is forgotten, nothing exposed
//   The scenario (a tool, not the game: it loads no module of src/): three villages on a tiny map, A (10 households) and B (8) on one
//   island, 6 hours apart, C (8) on another; talk in the household, about the village (well, green, fields), at the one alehouse, in A,
//   which B's adults visit less often, and at the yearly gathering and fair in A on winter days 1 to 3, at most 6 contacts a goer.
//   Day 0 is spring day 1; a season is 12 days and a year 48, as in the game (src/sim/rules.js).
//   Cases: true, a breach the source witnessed alone; lie, the same story invented by the same pawn, with three of the subject's
//   customers (and the subject) holding first-hand good memories of him, who deny it.
//   Prints the bands of target-v2 10.2 for each model (the median and range over the seeds, and in how many seeds each is in band),
//   then the three probes: the spread curve, distortion by hops, strangers' opinion of the subject.
//   --seeds LIST    seeds (default 1,2,3,4,5,6,7,8,9,10); each seed draws the population and the meetings, shared by both models
//   --years N       years to run after the story starts (default 4)
//   --start DAY     the day the story starts (default 0, spring day 1; 39 is just after the gathering)
//   --set k=v,...   override parameters (names as printed under "parameters"), e.g. --set tellP=0.2,halfLife=24
//   --sweep         each listed parameter at half and double (probabilities capped at 1; witnesses 1 and 6): the bands' measures,
//                   stories model
//   --json          the summaries as JSON
// Deterministic: all randomness comes from seeded streams (mulberry32), one for the population, one for the meetings, one for the model.
require('./help.js')(__filename);

const SEASON = 12, YEAR = 48, GATHER = [36, 37, 38];

// Parameters. Each is a choice of this experiment unless the report names a source; docs/gossip-experiment.md lists them.
const DEFAULTS = {
  // scenario
  households: [10, 8, 8], adults: [2, 4], hhTalks: 1, villageTalks: 1.5, aleA: 0.25, aleB: 0.08, aleTalks: 2,
  goerShare: 0.4, gatherContacts: 6, witnesses: 3,
  // talk, both models
  tellP: 0.3, background: 1, negBias: 1.3, v0: -0.6,
  // stories
  sharpen: 0.08, noise: 0.05, stifle: 0.5, zealMin: 0.05, halfLife: 48, firstMul: 3, forgetAt: 0.2, hopDiscount: 0.8,
  belief0: 0.6, beliefTie: 0.5, fitW: 0.5, trustOp: 0.5, lieJudge: 1.5, cap: 8,
  // averaging
  mu: 0.3,
};
// negBias is left out: with one story it only scales the weight against background, as background does; mu is the baseline's
const SWEEP = ['tellP', 'villageTalks', 'aleA', 'aleB', 'goerShare', 'background', 'sharpen', 'stifle', 'halfLife', 'forgetAt',
  'hopDiscount', 'belief0', 'beliefTie', 'fitW', 'trustOp', 'lieJudge', 'witnesses'];
const PROB = new Set(['tellP', 'aleA', 'aleB', 'goerShare', 'belief0', 'forgetAt', 'hopDiscount', 'stifle']);

// ---- seeded randomness
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; }
function stream(seed, name) {
  let a = hash(name + ':' + seed);
  const next = () => {
    a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (n) => Math.floor(next() * n);
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  next.normal = () => { const u = Math.max(next(), 1e-12), v = next(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return next;
}
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

// ---- the population: villages, households, adults with sociability and honour; the subject, the source and the deniers
function population(seed, P) {
  const r = stream(seed, 'population'), pawns = [], households = [], villages = P.households.map(() => []);
  P.households.forEach((n, v) => {
    for (let h = 0; h < n; h++) {
      const hh = { id: households.length, v, members: [] }, k = P.adults[0] + r.int(P.adults[1] - P.adults[0] + 1);
      for (let i = 0; i < k; i++) {
        const p = { id: pawns.length, v, hh: hh.id, soc: r(), honour: r() };
        pawns.push(p); hh.members.push(p.id); villages[v].push(p.id);
      }
      households.push(hh);
    }
  });
  // the subject (the smith) and the source in different households of A; the deniers, his customers, two in A and one in B
  const hhA = households.filter((h) => h.v === 0), hS = r.pick(hhA), subject = r.pick(hS.members);
  const hL = r.pick(hhA.filter((h) => h !== hS)), source = r.pick(hL.members);
  const free = (v) => villages[v].filter((p) => pawns[p].hh !== hS.id && pawns[p].hh !== hL.id);
  const deniers = [];
  for (let i = 0; i < P.witnesses; i++) { const v = i % 3 === 2 ? 1 : 0, c = free(v).filter((p) => !deniers.includes(p)); deniers.push(r.pick(c)); }
  return { pawns, households, villages, subject, source, deniers };
}
const tie = (w, a, b) => (w.pawns[a].hh === w.pawns[b].hh ? 0.9 : w.pawns[a].v === w.pawns[b].v ? 0.5 : 0.2);

// ---- the meetings of one day, drawn from their own stream, so both models hear the same conversations
function meetings(w, P, r, day, link, goers) {
  const out = [], d = day % YEAR;
  for (const hh of w.households) {
    const m = hh.members;
    for (let i = 0; i < m.length; i++) for (let j = i + 1; j < m.length; j++) for (let k = 0; k < P.hhTalks; k++) out.push([m[i], m[j]]);
  }
  for (const vs of w.villages) for (const a of vs) {
    let n = Math.floor(P.villageTalks); if (r() < P.villageTalks - n) n++;
    for (let k = 0; k < n; k++) { const b = r.pick(vs); if (b !== a) out.push([a, b]); }
  }
  const ale = [];
  for (const p of w.pawns) {
    const base = p.v === 0 ? P.aleA : p.v === 1 ? P.aleB : 0;
    if (base && r() < Math.min(1, base * (0.5 + p.soc))) ale.push(p.id);
  }
  if (ale.length > 1) for (const a of ale) for (let k = 0; k < P.aleTalks; k++) { const b = r.pick(ale); if (b !== a) out.push([a, b]); }
  if (d === GATHER[0]) { // who goes: each household of the gathering's villages sends its first adult, others by sociability
    goers.length = 0;
    for (const hh of w.households) {
      if (hh.v === 2 && link !== 'ice') continue;
      hh.members.forEach((p, i) => { if (i === 0 || (i < hh.members.length - 1 && r() < P.goerShare * (0.5 + w.pawns[p].soc))) goers.push(p); });
    }
  }
  if (GATHER.includes(d) && goers.length > 1) {
    const per = P.gatherContacts / GATHER.length;
    for (const a of goers) {
      let n = Math.floor(per); if (r() < per - n) n++;
      for (let k = 0; k < n; k++) { const b = r.pick(goers); if (b !== a) out.push([a, b]); }
    }
  }
  // the order of talk within a day is drawn too
  for (let i = out.length - 1; i > 0; i--) { const j = r.int(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out;
}

// ---- model B: stories
function storiesModel(w, P, r, kase) {
  const N = w.pawns.length, known = Array.from({ length: N }, () => new Map()), first = Array.from({ length: N }, () => new Map());
  const stories = [], ever = Array.from({ length: N }, () => new Set());
  let exposures = 0;
  const S = w.subject, L = w.source;
  const strength = (k, day) => k.m * Math.pow(2, -(day - k.t0) / (P.halfLife * (k.first ? P.firstMul : 1)));
  const hold = (p, k) => { known[p].set(k.s, k); ever[p].add(k.s); trim(p, k.t0); };
  function trim(p, day) {
    if (known[p].size <= P.cap) return;
    let worst = null, ws = Infinity;
    for (const k of known[p].values()) { const s = Math.abs(k.v) * strength(k, day); if (s < ws) { ws = s; worst = k; } }
    known[p].delete(worst.s);
  }
  function opinion(p, of, day) {
    let o = first[p].get(of) || 0;
    for (const k of known[p].values()) {
      if (stories[k.s].subject !== of) continue;
      o += k.v * (k.first ? 1 : Math.pow(P.hopDiscount, k.hops)) * strength(k, day);
    }
    return clamp(o, -1, 1);
  }
  const start = (day) => {
    stories.push({ subject: S, v0: P.v0, lie: kase === 'lie', source: L, counter: null });
    hold(L, { s: 0, v: P.v0, hops: 0, m: 1, t0: day, z: 1, first: true, told: 0 });
    if (kase === 'lie') for (const d of [...w.deniers, S]) first[d].set(S, -P.v0);
  };
  function tell(t, h, day) {
    if (r() >= P.tellP) return;
    let sum = P.background; const cands = [];
    for (const k of known[t].values()) {
      const st = stories[k.s]; if (st.subject === h || k.z < P.zealMin) continue;
      const m = strength(k, day); if (m < P.forgetAt) continue;
      const wgt = Math.abs(k.v) * k.z * m * (k.v < 0 ? P.negBias : 1) * (1 + tie(w, h, st.subject));
      cands.push([k, wgt]); sum += wgt;
    }
    let x = r() * sum, k = null;
    for (const [c, wgt] of cands) { if ((x -= wgt) < 0) { k = c; break; } }
    if (!k) return; // another topic
    const st = stories[k.s], told = clamp(k.v * (1 + P.sharpen) + P.noise * r.normal(), -1, 1);
    k.m = 1; k.t0 = day; k.told++; // telling refreshes the teller's memory; the sharpened version is the hearer's (serial reproduction)
    hear(t, h, k.s, told, k.hops + 1, day);
  }
  function hear(t, h, s, v, hops, day) {
    const st = stories[s], held = known[h].get(s);
    if (held && strength(held, day) >= P.forgetAt) { // saturation: the teller loses zeal, the hearer is reminded
      const tk = known[t].get(s); if (tk) tk.z *= P.stifle;
      held.m = 1; held.t0 = day; return;
    }
    const fh = first[h].get(st.subject);
    if (st.lie && fh !== undefined && Math.sign(fh) !== Math.sign(v)) return expose(t, h, s, day);
    const trust = tie(w, t, h) + P.trustOp * opinion(h, t, day), fit = opinion(h, st.subject, day) * Math.sign(v);
    const b = clamp(P.belief0 + P.beliefTie * (trust - 0.5) + P.fitW * fit, 0, 1);
    if (r() < b) hold(h, { s, v, hops, m: 1, t0: day, z: 1, first: false, told: 0 });
  }
  function expose(t, h, s, day) { // the hearer knows better: the lie is exposed, and the counter-story is about its inventor
    exposures++;
    const st = stories[s], v = -Math.min(1, Math.abs(st.v0) * P.lieJudge * (0.5 + w.pawns[h].honour));
    if (st.counter === null) { st.counter = stories.length; stories.push({ subject: st.source, v0: v, lie: false, source: h, counter: null }); }
    const c = st.counter, mine = known[h].get(c);
    if (!mine || !mine.first) hold(h, { s: c, v, hops: 0, m: 1, t0: day, z: 1, first: true, told: 0 });
    const tk = known[t].get(s); if (tk) { tk.z = 0; }
    if (t !== st.source && h !== t) hear(h, t, c, v, 1, day); // the teller is told why on the spot
  }
  function daily(day) {
    for (let p = 0; p < N; p++) for (const k of known[p].values()) if (strength(k, day) < P.forgetAt) known[p].delete(k.s);
  }
  return {
    start, tell, daily, opinion: (p, day) => opinion(p, S, day), exposures: () => exposures,
    holds: (p, s) => known[p].has(s), ever: (p, s) => ever[p].has(s), counter: () => (stories[0] ? stories[0].counter : null),
    held: (p) => { const k = known[p].get(0); return k ? { v: k.v, hops: k.hops } : null; },
  };
}

// ---- the baseline: opinion averaging
function averagingModel(w, P, r, kase) {
  const N = w.pawns.length, o = new Array(N).fill(null), aware = new Array(N).fill(false), hops = new Array(N).fill(0);
  const S = w.subject, L = w.source;
  const start = () => { o[L] = P.v0; aware[L] = true; if (kase === 'lie') for (const d of [...w.deniers, S]) o[d] = -P.v0; };
  function tell(t, h) {
    if (!aware[t] || h === S || r() >= P.tellP) return;
    const wgt = Math.abs(o[t]) * (o[t] < 0 ? P.negBias : 1) * (1 + tie(w, h, S));
    if (r() * (P.background + wgt) >= wgt) return;
    if (!aware[h]) { aware[h] = true; hops[h] = hops[t] + 1; }
    o[h] = o[h] === null ? o[t] : o[h] + P.mu * (o[t] - o[h]);
  }
  return {
    start, tell, daily() {}, opinion: (p) => (o[p] === null ? 0 : o[p]), exposures: () => 0,
    holds: (p, s) => s === 0 && aware[p], ever: (p, s) => s === 0 && aware[p], counter: () => null,
    held: (p) => (aware[p] ? { v: o[p], hops: hops[p] } : null),
  };
}

// ---- one run: a model, a case, a seed; the daily probes
function run(opt) {
  const P = { ...DEFAULTS, ...(opt.params || {}) }, seed = opt.seed, link = opt.link || 'none', t0 = opt.start || 0;
  const days = t0 + Math.round((opt.years || 4) * YEAR) + 1;
  const w = population(seed, P), rm = stream(seed, 'meetings'), rr = stream(seed, 'model:' + opt.model);
  const M = (opt.model === 'stories' ? storiesModel : averagingModel)(w, P, rr, opt.kase);
  const adults = w.pawns.filter((p) => p.id !== w.subject), goers = [];
  const byV = [0, 1, 2].map((v) => adults.filter((p) => p.v === v).map((p) => p.id));
  const series = { share: [], counter: [], holders: [], extremes: [], split: [], strangers: [], sd: [] };
  let distortion = null, firstC = null, firstGather = null;
  for (let day = 0; day < days; day++) {
    if (day === t0) M.start(day);
    const talk = meetings(w, P, rm, day, link, goers);
    if (day >= t0) for (const [a, b] of talk) { M.tell(a, b, day); M.tell(b, a, day); }
    M.daily(day);
    if (day < t0) continue;
    if (firstGather === null && GATHER.includes(day % YEAR)) firstGather = day - t0;
    const c = M.counter(), share = byV.map((vs) => vs.filter((p) => M.holds(p, 0)).length / vs.length);
    series.share.push(share);
    series.counter.push(c === null ? [0, 0, 0] : byV.map((vs) => vs.filter((p) => M.holds(p, c)).length / vs.length));
    series.holders.push(adults.filter((p) => M.holds(p.id, 0)).length);
    if (firstC === null && share[2] > 0) firstC = day - t0;
    const ops = adults.map((p) => M.opinion(p.id, day)), held = ops.filter((x) => Math.abs(x) > 0.05);
    series.extremes.push(held.length ? held.filter((x) => Math.abs(x) >= 0.8).length / held.length : 0);
    series.split.push(byV.some((vs) => {
      const os = vs.map((p) => M.opinion(p, day));
      return os.filter((x) => x > 0.3).length >= 0.2 * vs.length && os.filter((x) => x < -0.3).length >= 0.2 * vs.length;
    }));
    const str = byV[1].map((p) => M.opinion(p, day));
    series.strangers.push(str.reduce((a, b) => a + b, 0) / str.length);
    const aw = adults.filter((p) => M.holds(p.id, 0)).map((p) => M.opinion(p.id, day));
    const mean = aw.reduce((a, b) => a + b, 0) / Math.max(1, aw.length);
    series.sd.push(Math.sqrt(aw.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, aw.length)));
    if (day - t0 === YEAR) { // distortion at the year's end: the valence held against the source's, by hops
      distortion = {};
      for (const p of adults) {
        const h = M.held(p.id); if (!h) continue;
        const k = Math.min(h.hops, 6); (distortion[k] = distortion[k] || []).push(h.v / P.v0);
      }
    }
  }
  const reach = (s, vs) => vs.filter((p) => M.ever(p, s)).length / vs.length, AB = [...byV[0], ...byV[1]], c = M.counter();
  return {
    seed, model: opt.model, kase: opt.kase, link, series, distortion, firstC, firstGather, exposures: M.exposures(),
    reach: reach(0, AB), counterReach: c === null ? 0 : reach(c, AB), adults: adults.length,
  };
}

// ---- bands of target-v2 10.2, from one run (and its paired run of the other case)
const at = (arr, i) => arr[Math.min(i, arr.length - 1)];
function measures(t, l) {
  const peak = Math.max(...t.series.holders), m = {
    ownSeason: at(t.series.share, SEASON)[0], fairYear: at(t.series.share, YEAR)[1],
    islandMax: Math.max(...t.series.share.map((s) => s[2])), kept3y: peak ? at(t.series.holders, 3 * YEAR) / peak : 0,
    sd3y: l ? Math.max(at(t.series.sd, 3 * YEAR), at(l.series.sd, 3 * YEAR)) : at(t.series.sd, 3 * YEAR), extremes: Math.max(...t.series.extremes), split: t.series.split.filter(Boolean).length,
    strangersSeason: at(t.series.strangers, SEASON), strangersYear: at(t.series.strangers, YEAR), strangers3y: at(t.series.strangers, 3 * YEAR),
  };
  if (l) {
    Object.assign(m, { reachTrue: t.reach, reachLie: l.reach, reachCounter: l.counterReach, exposures: l.exposures,
      lieExtremes: Math.max(...l.series.extremes), lieSplit: l.series.split.filter(Boolean).length,
      lieStrangersYear: at(l.series.strangers, YEAR), lieKept3y: Math.max(...l.series.holders) ? at(l.series.holders, 3 * YEAR) / Math.max(...l.series.holders) : 0 });
  }
  return m;
}
const BANDS = [
  ['own village knows within a season', 'ownSeason', (m) => m.ownSeason > 0.5, 'share of A at day 12 > 0.5'],
  ['fair village knows within a year', 'fairYear', (m) => m.fairYear > 0.5, 'share of B at day 48 > 0.5'],
  ['island hears nothing unjoined', 'islandMax', (m) => m.islandMax === 0, 'share of C, at most, = 0 (link none)'],
  ['untold story mostly forgotten in 3 years', 'kept3y', (m) => m.kept3y < 0.5, 'holders at day 144 / peak < 0.5'],
  ['slander with a witness spreads less', 'reachLie', (m) => m.reachLie < m.reachTrue, 'reach of lie < reach of true (A+B, ever held)'],
  ['counter-story further than the lie', 'reachCounter', (m) => m.reachCounter > m.reachLie, 'reach of counter-story > reach of lie'],
  ['converges (the baseline\'s band)', 'sd3y', (m) => m.sd3y < 0.05, 'sd of holders\' opinion at day 144 < 0.05 (both cases)'],
  ['forgets nothing (the baseline\'s band)', 'kept3y', (m) => m.kept3y === 1, 'holders at day 144 / peak = 1'],
  ['no extremes (Proposed)', 'extremes', (m) => Math.max(m.extremes, m.lieExtremes) < 0.25, 'share |opinion| >= 0.8 of held, at most, < 0.25 (both cases)'],
  ['no village splits (Proposed)', 'split', (m) => m.split + m.lieSplit === 0, 'days a village has >= 20% above 0.3 and >= 20% below -0.3 = 0'],
];

function experiment(o) {
  const out = { models: {} };
  for (const model of o.models) {
    const rows = o.seeds.map((seed) => {
      const base = { model, seed, years: o.years, start: o.start, params: o.params, link: 'none' };
      const t = run({ ...base, kase: 'true' }), l = run({ ...base, kase: 'lie' }), ice = run({ ...base, kase: 'true', link: 'ice' });
      const late = run({ ...base, kase: 'true', link: 'ice', start: GATHER[0] - 6 }); // the story six days before the gathering
      const before = (x) => x.firstC === null || x.firstC >= x.firstGather, after = (x) => at(x.series.share, x.firstGather + SEASON)[2];
      return { seed, m: { ...measures(t, l), iceNotBefore: before(ice) && before(late), iceHears: after(ice), iceHearsLate: after(late) }, t, l, ice };
    });
    out.models[model] = rows;
  }
  return out;
}

// ---- summaries
const median = (xs) => { const s = [...xs].sort((a, b) => a - b), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : NaN; };
const f2 = (x) => (x === null || x === undefined || Number.isNaN(x) ? '-' : Math.abs(x) >= 10 ? x.toFixed(0) : x.toFixed(2));
const range = (all) => {
  const xs = all.filter((x) => x !== null && !Number.isNaN(x)), miss = all.length - xs.length;
  return `${f2(median(xs))} [${f2(Math.min(...xs))}, ${f2(Math.max(...xs))}]` + (miss ? ` (${miss} none)` : '');
};
function summary(res) {
  const s = {};
  for (const [model, rows] of Object.entries(res.models)) {
    const bands = BANDS.map(([name, key, ok, def]) => ({ name, def, value: range(rows.map((r) => r.m[key])), values: rows.map((r) => r.m[key]),
      inBand: rows.filter((r) => ok(r.m)).length, of: rows.length }));
    bands.push({ name: 'island hears only once joined (ice)', def: 'C hears nothing before the first gathering it attends (both starts)',
      value: '', values: rows.map((r) => r.m.iceNotBefore), inBand: rows.filter((r) => r.m.iceNotBefore).length, of: rows.length });
    for (const [k, when] of [['iceHears', 'day 0'], ['iceHearsLate', 'day 30']]) {
      bands.push({ name: `  joined, C knows (story from ${when})`, def: 'share of C 12 days after the gathering (reported, not a band)',
        value: range(rows.map((r) => r.m[k])), values: rows.map((r) => r.m[k]), inBand: rows.filter((r) => r.m[k] > 0.5).length, of: rows.length });
    }
    const days = [1, 3, 6, 12, 24, 36, 40, 48, 96, 144, 192].filter((d) => d < rows[0].t.series.share.length);
    const curve = (k, which) => days.map((d) => ({ day: d, A: median(rows.map((r) => at(r[k].series[which], d)[0])), B: median(rows.map((r) => at(r[k].series[which], d)[1])),
      C: median(rows.map((r) => at(r[k].series[which], d)[2])) }));
    const dist = {};
    for (const r of rows) for (const [h, xs] of Object.entries(r.t.distortion || {})) (dist[h] = dist[h] || []).push(...xs);
    const distortion = Object.keys(dist).sort((a, b) => a - b).map((h) => ({ hops: h === '6' ? '6+' : h, n: dist[h].length, ratio: median(dist[h]),
      mean: dist[h].reduce((a, b) => a + b, 0) / dist[h].length }));
    const strangers = ['strangersSeason', 'strangersYear', 'strangers3y', 'lieStrangersYear'].map((k) => ({ k, value: range(rows.map((r) => r.m[k])) }));
    s[model] = { bands, spread: curve('t', 'share'), spreadIce: curve('ice', 'share'), spreadLie: curve('l', 'share'), counter: curve('l', 'counter'),
      distortion, strangers, reach: { true: range(rows.map((r) => r.m.reachTrue)), lie: range(rows.map((r) => r.m.reachLie)),
        counter: range(rows.map((r) => r.m.reachCounter)), exposures: range(rows.map((r) => r.m.exposures)) } };
  }
  return s;
}

function print(o, s) {
  console.log(`gossip experiment: seeds ${o.seeds.join(',')}, ${o.years} years from day ${o.start}; median [min, max] over the seeds`);
  for (const [model, x] of Object.entries(s)) {
    console.log(`\n== ${model}\nbands (target-v2 10.2)`);
    for (const b of x.bands) console.log(`  ${(b.inBand + '/' + b.of).padStart(5)}  ${b.name.padEnd(42)} ${b.value.padEnd(22)} ${b.def}`);
    for (const [title, key] of [['spread, true story (share holding; link none)', 'spread'], ['spread, true story, island joined by ice', 'spreadIce'],
      ['spread, lie', 'spreadLie'], ['spread, counter-story about the liar', 'counter']]) {
      console.log(title); console.log('  day   ' + x[key].map((r) => String(r.day).padStart(5)).join(''));
      for (const v of ['A', 'B', 'C']) console.log(`  ${v}     ` + x[key].map((r) => f2(r[v]).padStart(5)).join(''));
    }
    console.log('distortion at day 48: valence held / at source, by hops (true story)');
    for (const d of x.distortion) console.log(`  hops ${String(d.hops).padEnd(3)} n ${String(d.n).padStart(4)}  median ${f2(d.ratio)}  mean ${f2(d.mean)}`);
    console.log('strangers\' opinion of the subject (mean over B\'s adults, holders or not)');
    for (const v of x.strangers) console.log(`  ${v.k.padEnd(18)} ${v.value}`);
    console.log(`reach over A and B: true ${x.reach.true}; lie ${x.reach.lie}; counter ${x.reach.counter}; exposures ${x.reach.exposures}`);
  }
}

function sweep(o) {
  const keys = ['ownSeason', 'fairYear', 'kept3y', 'reachTrue', 'reachLie', 'reachCounter', 'extremes', 'strangersYear'];
  const rowFor = (params) => {
    const res = experiment({ ...o, models: ['stories'], params });
    const ms = res.models.stories.map((r) => r.m), meds = {};
    for (const k of keys) meds[k] = median(ms.map((m) => m[k]));
    meds.bandsIn = BANDS.slice(0, 6).map(([, , ok]) => ms.filter(ok).length);
    return meds;
  };
  const out = [{ name: 'defaults', ...rowFor(o.params) }];
  for (const k of SWEEP) for (const f of [0.5, 2]) {
    let v = (o.params[k] !== undefined ? o.params[k] : DEFAULTS[k]) * f; if (PROB.has(k)) v = Math.min(1, v);
    if (k === 'witnesses') v = f < 1 ? 1 : 6;
    out.push({ name: `${k} x${f} (${+v.toFixed(3)})`, ...rowFor({ ...o.params, [k]: v }) });
  }
  return { keys, rows: out };
}

function parseArgs(argv) {
  const opt = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
  const params = {};
  for (const kv of String(opt('set', '')).split(',').filter(Boolean)) {
    const [k, v] = kv.split('='); if (!(k in DEFAULTS)) throw new Error(`gossip: unknown parameter ${k}`); params[k] = Number(v);
  }
  const model = opt('model', 'both');
  return { seeds: String(opt('seeds', '1,2,3,4,5,6,7,8,9,10')).split(',').map(Number), years: +opt('years', 4), start: +opt('start', 0),
    models: model === 'both' ? ['stories', 'averaging'] : [model], params, json: argv.includes('--json'), sweep: argv.includes('--sweep') };
}

module.exports = { run, experiment, summary, measures, BANDS, DEFAULTS, population };

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  if (o.sweep) {
    const sw = sweep(o);
    if (o.json) { console.log(JSON.stringify(sw, null, 1)); process.exit(0); }
    console.log(`sweep, stories model, seeds ${o.seeds.join(',')}: medians; bands in = seeds in band for the first six bands`);
    console.log('  ' + 'parameter'.padEnd(26) + sw.keys.map((k) => k.slice(0, 9).padStart(10)).join('') + '  bands in');
    for (const r of sw.rows) console.log('  ' + r.name.padEnd(26) + sw.keys.map((k) => f2(r[k]).padStart(10)).join('') + '  ' + r.bandsIn.join(' '));
  } else {
    const s = summary(experiment(o));
    if (o.json) console.log(JSON.stringify(s, null, 1)); else print(o, s);
  }
  console.log('parameters: ' + Object.entries({ ...DEFAULTS, ...o.params }).map(([k, v]) => `${k}=${Array.isArray(v) ? v.join('/') : v}`).join(' '));
}

const C = require('../src/load.js').culture;
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// annual death hazard, roughly pre-industrial (Gompertz–Makeham plus child mortality)
const hazard = (age) => 0.006 + 0.0007 * Math.exp(0.07 * age) + (age < 10 ? 0.02 : 0);

function makeEnv(seed, { villages = 6, size = 50, ties = [1, 0.8, 0.7, 0.6, 0.6, 0.5], remote = null, kind = 'village' }) {
  const rand = mulberry32(seed);
  const env = { t: 0, cultures: [], settlements: [], people: [], driftMul: 1, nameCulture: () => 'new' };
  const custom = C.fromArchetype('oldNordic');
  const c = C.makeCulture(env, 'test', custom, 0);
  env.challenger = custom.map((x, k) => (x + 1) % C.NOPT[k]);
  const byIdMap = new Map();
  env.byId = (id) => byIdMap.get(id);
  let nextId = 0;
  const mkPerson = (s, age, att, anc) => {
    const p = { id: nextId++, alive: true, age, settlement: s.id, att, anc, ties: new Map(), prestige: 1, interest: null, advocate: null, landholder: false };
    p.interest = new Float32Array(C.TOTAL);
    byIdMap.set(p.id, p); env.people.push(p); s.list.push(p);
    return p;
  };
  for (let v = 0; v < villages; v++) {
    const tie = remote !== null && v === villages - 1 ? remote : ties[v % ties.length];
    const s = { id: v, culture: c.id, kind: v === 0 ? kind : 'village', tie, practice: Int8Array.from(custom), list: [] };
    s.members = () => s.list;
    env.settlements.push(s);
    for (let k = 0; k < size; k++) { const a = C.seedAttitude(custom, rand); mkPerson(s, (rand() * 65) | 0, a, Float32Array.from(a)); }
  }
  env.settlementOf = (p) => env.settlements[p.settlement];
  env.voiceOf = (p) => (p.landholder && p.age >= 18 ? 1 : 0);
  const rewire = () => {
    for (const s of env.settlements) {
      const live = s.list.filter((p) => p.alive);
      for (const p of live) {
        while (p.ties.size < 14) { const q = live[(rand() * live.length) | 0]; if (q !== p) { p.ties.set(q.id, 1); q.ties.set(p.id, 1); } else if (live.length < 3) break; }
        if (rand() < 0.15) { const os = env.settlements[(rand() * env.settlements.length) | 0]; if (os !== s) { const ol = os.list.filter((q) => q.alive); if (ol.length) { const q = ol[(rand() * ol.length) | 0]; const w = 0.4 * Math.min(s.tie, os.tie); p.ties.set(q.id, w); q.ties.set(p.id, w); } } }
      }
      // about a third of the adults hold land and speak at the meeting
      const adults = live.filter((p) => p.age >= 18).sort((a, b) => b.age - a.age);
      adults.forEach((p, k) => { p.landholder = k < Math.ceil(adults.length * 0.33); p.prestige = p.landholder ? 1.5 : 1; });
      // interests follow position: landholders favour the custom in force, most others one challenger option
      for (const p of live) C.DIMS.forEach((d, k) => {
        const o = C.OFF[k], n = C.NOPT[k], cur = env.cultures[0].customs[k], ch = env.challenger[k];
        for (let j = 0; j < n; j++) p.interest[o + j] = 0;
        if (p.landholder) p.interest[o + cur] = 1; else if (mulberry32(p.id * 31337 + k)() < 0.6) p.interest[o + ch] = 1; else p.interest[o + (mulberry32(p.id * 7919 + k * 104729)() * n | 0)] = 1;
      });
    }
  };
  env.year = () => {
    // deaths and births keep each settlement at its size; newborns learn from their parents and the village
    for (const s of env.settlements) {
      for (const p of s.list) if (p.alive && rand() < hazard(p.age)) { p.alive = false; for (const [j] of p.ties) { const q = byIdMap.get(j); if (q) q.ties.delete(p.id); } p.ties.clear(); }
      s.list = s.list.filter((p) => p.alive);
      const adults = s.list.filter((p) => p.age >= 18 && p.age < 45);
      while (s.list.length < size && adults.length >= 2) {
        const a = adults[(rand() * adults.length) | 0], b = adults[(rand() * adults.length) | 0], M = new Float32Array(C.TOTAL);
        for (const q of s.list) for (let k = 0; k < C.TOTAL; k++) M[k] += q.att[k] / s.list.length;
        const att = new Float32Array(C.TOTAL);
        for (let k = 0; k < C.TOTAL; k++) att[k] = 0.35 * (a.att[k] + b.att[k]) + 0.3 * M[k];
        C.DIMS.forEach((d, k) => C.normBlock(att, C.OFF[k], C.NOPT[k]));
        const ch = mkPerson(s, 0, att, Float32Array.from(att)); ch.ties.set(a.id, 2); ch.ties.set(b.id, 2); a.ties.set(ch.id, 1); b.ties.set(ch.id, 1);
      }
      for (const p of s.list) p.age++;
    }
    rewire();
  };
  rewire();
  return { env, rand, c };
}

// Run a culture; returns the first year each custom flipped in the culture and in each settlement.
function run(seed, opts, years, stepsPerYear = 6, setup = null) {
  const { env, rand, c } = makeEnv(seed, opts);
  if (setup) setup(env, rand);
  const assign = () => {
    if (!env.advTarget) return;
    const holders = env.people.filter((p) => p.alive && p.landholder);
    const want = Math.ceil(holders.length * (env.advShare || 0.2));
    let have = holders.filter((p) => p.advocate).length;
    for (const p of holders) { if (have >= want) break; if (!p.advocate) { p.advocate = env.advTarget; have++; } }
  };
  assign();
  const flip = new Array(C.DIMS.length).fill(null), local = env.settlements.map(() => new Array(C.DIMS.length).fill(null));
  for (let y = 1; y <= years; y++) {
    for (let k = 0; k < stepsPerYear; k++) { env.t += 1 / stepsPerYear; C.dailyStep(env, 1 / stepsPerYear, rand); }
    for (const s of env.settlements) { const ch = C.meeting(env, s); for (const x of ch) if (local[s.id][x.dim] === null) local[s.id][x.dim] = y; }
    const r = C.cultureYear(env, c);
    for (const x of r.changes) if (flip[x.dim] === null) flip[x.dim] = y;
    if (opts.stopDim !== undefined && flip[opts.stopDim] !== null) break;
    if (!opts.noEntrepreneurs) C.entrepreneurs(env, rand);
    env.year(); assign();
    if (opts.everyYear) opts.everyYear(env, y, rand);
  }
  return { flip, local, env };
}
module.exports = { run, makeEnv };

if (require.main === module) {
  const mode = process.argv[2] || 'natural', runs = +(process.argv[3] || 12), Y = +(process.argv[4] || 300);
  const t0 = Date.now(), cens = (x) => (x === null ? Y : x);
  const median = (a) => { const s = [...a].sort((p, q) => p - q); return s[(s.length / 2) | 0]; };
  if (mode === 'natural') {
    const all = C.DIMS.map(() => []);
    for (let r = 0; r < runs; r++) { const { flip } = run(1000 + r, {}, Y); flip.forEach((f, d) => all[d].push(cens(f))); }
    console.log(`natural drift, 300 people in 6 villages, ${runs} runs of ${Y} years (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    C.DIMS.forEach((d, k) => console.log(`  ${d.key.padEnd(14)} m=${d.m.toFixed(2)}  median first flip ${String(median(all[k])).padStart(4)} y  (${(median(all[k]) / 30).toFixed(1)} gen)  flipped in ${all[k].filter((x) => x < Y).length}/${runs}`));
  }
  if (mode === 'advocacy') {
    for (const dimKey of ['claims', 'heirCount', 'birthOrder', 'kinLimit']) {
      const d = C.IDX[dimKey], times = [];
      for (let r = 0; r < runs; r++) {
        const res = run(2000 + r, { stopDim: d }, Y, 6, (env, rand) => {
          // a coalition with about 20% of the voice pushes the same alternative, renewed as members die
          const alt = (C.fromArchetype('oldNordic')[d] + 1) % C.NOPT[d];
          env.advTarget = { dim: d, opt: alt };
        });
        times.push(cens(res.flip[d]));
      }
      console.log(`  advocacy on ${dimKey.padEnd(11)} m=${C.DIMS[d].m.toFixed(2)}  median flip ${median(times)} y (${(median(times) / 30).toFixed(1)} gen), within ${Y} y in ${times.filter((x) => x < Y).length}/${runs}`);
    }
  }
}
if (require.main === module) {
  const mode = process.argv[2], runs = +(process.argv[3] || 10), Y = +(process.argv[4] || 150);
  const median = (a) => { const s = [...a].sort((p, q) => p - q); return s[(s.length / 2) | 0]; };
  const cens = (x) => (x === null ? Y : x);
  if (mode === 'remote') {
    // one village with a weak tie to the rest (tie 0.1) and few outside contacts: when does it form local practice?
    for (const tie of [0.1, 0.6]) {
      const first = [], dims = [];
      for (let r = 0; r < runs; r++) {
        const { local, env } = run(3000 + r, { remote: tie }, Y);
        const v = local[env.settlements.length - 1]; const f = v.filter((x) => x !== null);
        first.push(f.length ? Math.min(...f) : Y); dims.push(v.filter((x) => x !== null && x <= 60).length);
      }
      console.log(`  village with tie ${tie}: first local practice after median ${median(first)} y (${(median(first) / 30).toFixed(1)} gen); customs with local practice by year 60: median ${median(dims)}`);
    }
  }
  if (mode === 'size') {
    for (const [villages, size] of [[2, 50], [6, 50], [20, 50]]) {
      const t = [];
      for (let r = 0; r < runs; r++) { const { flip } = run(4000 + r, { villages, size, ties: [1, 0.8, 0.7, 0.6, 0.6, 0.5] }, Y); t.push(cens(flip[C.IDX.claims])); }
      console.log(`  culture of ${villages * size}: claims custom first flips after median ${median(t)} y (${(median(t) / 30).toFixed(1)} gen)`);
    }
  }
}

if (require.main === module && process.argv[2] === 'births') {
  // fertility of a married woman and child survival, from the rules in src/sim/rules.js and src/sim/births.js
  const VB = require('../src/load.js'), { hazard, YEAR_DAYS } = VB['sim/rules'], { expectedBirths } = VB['sim/births'];
  const rand = mulberry32(5), N = +(process.argv[3] || 2000), mean = (from, to) => { let s = 0; for (let i = 0; i < N; i++) s += expectedBirths(rand, from, to); return s / N; };
  console.log(`married at 20 until 50: ${mean(20, 50).toFixed(2)} births (aim about 7); married at 25: ${mean(25, 50).toFixed(2)} (aim about 5.5)`);
  const { BIRTH, conceiveChance } = Object.assign({}, VB['sim/rules'], VB['sim/births']);
  const wait = [20, 25, 30].map((a) => 1 / conceiveChance(a)), gap = (BIRTH.pregnancyDays + BIRTH.nursingDays + wait.reduce((x, y) => x + y) / 3) / YEAR_DAYS;
  console.log(`interval between births at ages 20-34: about ${gap.toFixed(1)} years (aim 2.5-3)`);
  let cum = 0, s1 = 1, s15 = 1;
  for (let d = 0; d < 15 * YEAR_DAYS; d++) { cum += hazard((d + 0.5) / YEAR_DAYS) / YEAR_DAYS; if (d === YEAR_DAYS - 1) s1 = Math.exp(-cum); }
  s15 = Math.exp(-cum);
  console.log(`dying before age 1: ${((1 - s1) * 100).toFixed(1)}% (aim about 20%); before age 15: ${((1 - s15) * 100).toFixed(1)}% (aim about a third)`);
}
if (require.main === module && process.argv[2] === 'hunger') {
  // deaths in a household at hunger 1 for a whole year, relative to a fed one, in a stationary population (weights: survival to each age)
  const VB = require('../src/load.js'), { hazard, HUNGER } = VB['sim/rules'];
  const groups = [['under 5', 0, 5], ['5-14', 5, 15], ['15-59', 15, 60], ['60 and over', 60, 100], ['all ages', 0, 100]];
  let S = 1; const w = [];
  for (let a = 0; a < 100; a++) { w.push({ a, d: S * hazard(a + 0.5) }); S *= Math.exp(-hazard(a + 0.5)); }
  for (const [name, lo, hi] of groups) {
    const rows = w.filter((x) => x.a >= lo && x.a < hi);
    console.log(`  ${name.padEnd(12)} deaths at h = 1: ${(rows.reduce((s, x) => s + x.d * (1 + HUNGER.k(x.a)), 0) / rows.reduce((s, x) => s + x.d, 0)).toFixed(2)} times a fed household`);
  }
}

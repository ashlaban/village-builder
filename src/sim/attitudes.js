// @sys sim/attitudes: a person's attitude to each custom, its leanings, and its day-by-day drift towards company, cause and upbringing
// ===== Attitudes (VB-417, out of culture): every person holds a preference over the options of each custom, updated each game day (one
// game day stands for about a week). The only writer of a pawn's attitude, its anchor and its leanings; culture's causes and meetings move
// them through pull and hold. =====
VB['sim/attitudes'] = (() => {
  const { DIMS, OFF, NOPT, TOTAL, optIndex } = VB['sim/customs'];

  // Rates are per year; the daily step scales pulls by dt and noise by sqrt(dt) (Euler–Maruyama).
  const P = {
    social: 0.5, // pull towards the people one deals with, at malleability 1
    anchor: { village: 0.35, city: 0.15 }, // pull back towards what one learned young (Friedkin–Johnsen)
    selfInterest: 0.12,
    noise: 0.12, // per sqrt(year), at malleability 1
    adultAnchorDrift: 0.02,
    youthAnchorDrift: 0.6, // anchors form in youth and barely move later
    kind: { village: 1, city: 2.2 },
    upbringing: 0.3, // share of a newborn's attitude taken from its village's mean (Cavalli-Sforza and Feldman; tests/calibrate.js)
    oblique: 0.3, // share of the social target taken from the settlement as a whole
    advocacyPull: 3,
    advocacyWeight: 3,
    persuasion: 1.5, // direct pull from advocates, times the advocates' share of one's ties and sqrt(malleability)
  };

  function gauss(rand) {
    let u = 0,
      v = 0;
    while (u === 0) u = rand();
    v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  function normBlock(a, o, n) {
    let s = 0;
    for (let k = 0; k < n; k++) {
      if (a[o + k] < 0) a[o + k] = 0;
      s += a[o + k];
    }
    if (s <= 0) {
      for (let k = 0; k < n; k++) a[o + k] = 1 / n;
      return;
    }
    for (let k = 0; k < n; k++) a[o + k] /= s;
  }

  // An attitude centred on a preferred option with some spread; `lean` adds weight to chosen alternatives.
  function seedAttitude(customs, rand, strength = 0.55, lean = null) {
    const a = new Float32Array(TOTAL);
    DIMS.forEach((d, k) => {
      const o = OFF[k],
        n = NOPT[k];
      for (let j = 0; j < n; j++) a[o + j] = ((1 - strength) / n) * (0.4 + rand() * 1.2);
      a[o + customs[k]] += strength * (0.75 + rand() * 0.5);
      if (lean && lean[d.key])
        for (const [opt, wgt] of Object.entries(lean[d.key])) a[o + optIndex(d.key, opt)] += wgt * (0.7 + rand() * 0.6);
      normBlock(a, o, n);
    });
    return a;
  }

  // @state pawn.leans (VB-520): Uint8Array, one byte a custom (in the order of DIMS): the option the pawn's attitude favours most (the first
  //   of equals), compiled wherever its attitude is written (initPerson, advocate, the daily drift), for chemistry's customs between two
  //   pawns (sim/relations; design.md, Chemistry), which reads a byte a custom (Rules for cost, 6). Written only here.
  function leanOn(p, d) {
    const o = OFF[d],
      n = NOPT[d];
    let top = 0;
    for (let j = 1; j < n; j++) if (p.att[o + j] > p.att[o + top]) top = j;
    p.leans[d] = top;
  }
  // Every custom's leaning compiled afresh (a person made, or a save made before VB-520 loaded).
  function compileLeans(p) {
    if (!p.leans || p.leans.length !== DIMS.length) p.leans = new Uint8Array(DIMS.length);
    for (let d = 0; d < DIMS.length; d++) leanOn(p, d);
  }
  // A person's attitude taken up (seeded or newborn, initPerson in culture): its leanings compiled, and its anchor what it holds now.
  function initAttitude(p, att) {
    p.att = att;
    compileLeans(p);
    p.anc = Float32Array.from(p.att);
  }
  // A newborn's attitude (VB-1230): its parents' mean, with P.upbringing of it the mean attitude of the village's adults (`members`, the
  // village's people; none or no adults leave the parents' alone). The village's mean, not its practice in force: the practice is a
  // single option a meeting chose, the mean is what the people hold, so a view held by many shows in the child before it wins a vote.
  function inherit(mother, father, members) {
    const out = Float32Array.from(mother, (x, k) => (x + father[k]) / 2);
    if (!members) return out;
    const m = new Float32Array(TOTAL);
    let n = 0;
    for (const q of members) {
      if (!q.alive || q.age < 12) continue;
      for (let k = 0; k < TOTAL; k++) m[k] += q.att[k];
      n++;
    }
    if (!n) return out;
    for (let k = 0; k < TOTAL; k++) out[k] = (1 - P.upbringing) * out[k] + (P.upbringing * m[k]) / n;
    return out;
  }
  // A step of share of the way towards option opt of custom dim, at once (a cause taken up, culture's advocate).
  function pull(p, dim, opt, share) {
    const o = OFF[dim],
      n = NOPT[dim];
    for (let j = 0; j < n; j++) p.att[o + j] += share * ((j === opt ? 1 : 0) - p.att[o + j]);
    normBlock(p.att, o, n);
    leanOn(p, dim);
  }
  // The anchor on custom d moved share of the way towards the attitude (a change carried in public holds, culture's meeting).
  function hold(p, d, share) {
    const o = OFF[d],
      n = NOPT[d];
    for (let j = 0; j < n; j++) p.anc[o + j] += share * (p.att[o + j] - p.anc[o + j]);
  }

  // ---- the daily step ----
  // env.people: [{ id, alive, age, settlement, att, anc, ties: Map(id -> weight), standing, interest, advocate }]
  const XI = new Float64Array(Math.max(...NOPT)); // scratch for one dimension's noise draws
  function dailyStep(env, hooks, dt, rand) {
    const mul = env.driftMul || 1;
    let walked = 0;
    const means = new Map();
    for (const s of env.settlements) {
      const m = new Float32Array(TOTAL);
      let n = 0;
      for (const p of hooks.membersOf(s)) {
        walked++;
        if (!p.alive || p.age < 12) continue;
        for (let k = 0; k < TOTAL; k++) m[k] += p.att[k];
        n++;
      }
      if (n) for (let k = 0; k < TOTAL; k++) m[k] /= n;
      // Resolve settlement factors once per day, outside the per-person numerical loops.
      means.set(s.id, { mean: n ? m : null, anchor: WEIGH.anchor(s.kind), rate: P.kind[s.kind] });
    }
    const tgt = new Float32Array(TOTAL),
      press = new Float32Array(TOTAL),
      sq = Math.sqrt(dt * mul);
    for (const id of hooks.living || env.people.map((p) => p.id)) {
      walked++;
      driftPerson(hooks.byId(id), hooks, dt, rand, mul, means, tgt, press, sq);
    }
    VB.count.walkDaily += walked;
  }
  // One settlement's part of the day's step (VB-201: the night's steps take a settlement each): its mean, then its people in id order, as
  // hooks.membersOf gives them. s null drifts the living of no settlement, against no local mean.
  function settlementStep(env, hooks, dt, rand, s) {
    const mul = env.driftMul || 1,
      means = new Map();
    let walked = 0,
      people;
    if (s) {
      people = hooks.membersOf(s);
      const m = new Float32Array(TOTAL);
      let n = 0;
      for (const p of people) {
        walked++;
        if (!p.alive || p.age < 12) continue;
        for (let k = 0; k < TOTAL; k++) m[k] += p.att[k];
        n++;
      }
      if (n) for (let k = 0; k < TOTAL; k++) m[k] /= n;
      means.set(s.id, { mean: n ? m : null, anchor: WEIGH.anchor(s.kind), rate: P.kind[s.kind] });
    } else {
      people = [];
      for (const id of hooks.living) {
        walked++;
        const p = hooks.byId(id);
        if (!hooks.settlementOf(p)) people.push(p);
      }
    }
    const tgt = new Float32Array(TOTAL),
      press = new Float32Array(TOTAL),
      sq = Math.sqrt(dt * mul);
    for (const p of people) {
      walked++;
      driftPerson(p, hooks, dt, rand, mul, means, tgt, press, sq);
    }
    VB.count.walkDaily += walked;
  }

  // The factors of a person's daily drift, each written here once: the drift (driftPerson) and the view of its pulls (sim/leanings, VB-398)
  // read the same ones. tie: the weight of a tie of stored weight w0 to q; age: the young are moved more; social, cause and interest: the
  // rates of a custom of weight m; mixed: the company's share mixed with the settlement's mean; anchor: the pull back to what was learned young.
  const WEIGH = Object.freeze({
    tie: (w0, q) => w0 * q.standing * (q.advocate ? P.advocacyWeight : 1),
    age: (age) => (age < 25 ? 1.5 : age < 50 ? 1 : 0.6),
    social: (m, rate, ageF) => m * P.social * rate * ageF,
    cause: (m, rate, ageF) => P.persuasion * Math.pow(m, 0.75) * rate * ageF,
    interest: (m) => m * P.selfInterest,
    mixed: (t, mean) => (1 - P.oblique) * t + P.oblique * mean,
    anchor: (kind) => P.anchor[kind] || P.anchor.village,
  });
  // A separate per-person function avoids repeated OSR/deoptimization of the nested traversal (VB-195; timed by tests/perf.js --engine).
  function driftPerson(p, hooks, dt, rand, mul, means, tgt, press, sq) {
    const byId = hooks.byId;
    if (!p.alive || p.age < 12) return;
    const s = hooks.settlementOf(p),
      local = s ? means.get(s.id) : null,
      M = local ? local.mean : null;
    const kind = s ? s.kind : 'village',
      kindRate = local ? local.rate : P.kind[kind];
    // social target: tie- and standing-weighted mean of contacts, mixed with the settlement as a whole. A pawn's ties are stored on one decay
    // scale (sim/relations, VB-127), which cancels in the division by wsum.
    tgt.fill(0);
    let wsum = 0;
    press.fill(0);
    for (const [j, w0] of p.ties) {
      const q = byId(j);
      if (!q || !q.alive || q.age < 12) continue;
      const wq = WEIGH.tie(w0, q);
      for (let k = 0; k < TOTAL; k++) tgt[k] += wq * q.att[k];
      wsum += wq;
      if (q.advocate) press[OFF[q.advocate.dim] + q.advocate.opt] += wq; // advocates argue, not just exist
    }
    if (wsum > 0) for (let k = 0; k < TOTAL; k++) press[k] /= wsum;
    if (wsum > 0) for (let k = 0; k < TOTAL; k++) tgt[k] /= wsum;
    if (M) for (let k = 0; k < TOTAL; k++) tgt[k] = wsum > 0 ? WEIGH.mixed(tgt[k], M[k]) : M[k];
    else if (wsum === 0) tgt.set(p.att);
    // the pawn's own pace (VB-520): its openness moves its malleability, its piety the pull of what it learned young (hooks.act, the
    // caller's reading of its traits; 1 without)
    const open = hooks.act ? hooks.act(p, 'openness', 'malleability') : 1,
      ageF = WEIGH.age(p.age),
      anchorR = (local ? local.anchor : WEIGH.anchor(kind)) * (hooks.act ? hooks.act(p, 'piety', 'anchor') : 1);
    for (let d = 0; d < DIMS.length; d++) {
      const o = OFF[d],
        n = NOPT[d],
        m = DIMS[d].m * open;
      const rs = WEIGH.social(m, kindRate, ageF),
        ru = WEIGH.interest(m),
        sig = m * P.noise;
      const adv = p.advocate && p.advocate.dim === d ? p.advocate : null;
      let nz = 0;
      const xi = XI;
      for (let j = 0; j < n; j++) {
        xi[j] = gauss(rand);
        nz += xi[j];
      }
      nz /= n;
      let pr = 0;
      for (let j = 0; j < n; j++) pr += press[o + j];
      const rp = WEIGH.cause(m, kindRate, ageF);
      for (let j = 0; j < n; j++) {
        const a = p.att[o + j];
        let da = rs * (tgt[o + j] - a) + anchorR * (p.anc[o + j] - a) + rp * (press[o + j] - pr * a);
        if (p.interest) da += ru * (p.interest[o + j] - a);
        if (adv) da += P.advocacyPull * ((j === adv.opt ? 1 : 0) - a);
        p.att[o + j] = a + da * dt * mul + sig * (xi[j] - nz) * sq * 0.5;
      }
      normBlock(p.att, o, n);
      leanOn(p, d);
      const ad = (p.age < 20 ? P.youthAnchorDrift : P.adultAnchorDrift) * dt * mul;
      for (let j = 0; j < n; j++) p.anc[o + j] += ad * (p.att[o + j] - p.anc[o + j]);
    }
  }

  return {
    P,
    WEIGH,
    seedAttitude,
    initAttitude,
    inherit,
    compileLeans,
    pull,
    hold,
    dailyStep,
    settlementStep,
    normBlock,
  };
})();

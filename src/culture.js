// @sys culture: customs, per-settlement practice and day-by-day attitude drift
// ===== Customs: one culture-wide set, local practice per settlement, attitudes that drift day by day =====
// Two layers. Attitudes: every person holds a preference over the options of each custom, updated each game day
// (one game day stands for about a week). Customs in force: a settlement's practice changes only at its yearly
// meeting; the culture's customs change only at the yearly reckoning after all meetings.
const Culture = (() => {
  // malleability m: 1 changes most easily; the order follows the agreed ranking
  const DIMS = [
    { key: 'claims', label: 'Claims on empty farms', m: 1.0, opts: [['kin', 'Kin of the old family first'], ['villagers', 'Villagers first'], ['anyone', 'Anyone may claim'], ['assembly', 'The meeting assigns']] },
    { key: 'newLand', label: 'Cleared land belongs to', m: 0.9, opts: [['village', 'The village allots it'], ['labour', 'Whoever worked most'], ['intended', 'Whoever it was cleared for']] },
    { key: 'handover', label: 'When the heir takes over', m: 0.8, opts: [['death', 'At the holder’s death'], ['marriage', 'When the heir marries'], ['age60', 'When the holder turns 60']] },
    { key: 'daughterShare', label: 'A daughter’s share', m: 0.65, opts: [['equal', 'Equal to a son’s'], ['half', 'Half a son’s']] },
    { key: 'heirCount', label: 'How many heirs', m: 0.55, opts: [['one', 'One heir takes all'], ['buyout', 'One heir buys out the rest'], ['split', 'Land split between heirs']] },
    { key: 'widow', label: 'The widow', m: 0.45, opts: [['life', 'Keeps the farm for life'], ['keep', 'Keeps a right to her keep'], ['outright', 'Inherits outright']] },
    { key: 'heirSex', label: 'Who can inherit', m: 0.35, opts: [['sons', 'Sons only'], ['sonsFirst', 'Sons first'], ['any', 'Any child'], ['daughtersFirst', 'Daughters first']] },
    { key: 'voice', label: 'Who speaks at the meeting', m: 0.3, opts: [['landholders', 'Landholders'], ['heads', 'All household heads'], ['adults', 'All adults']] },
    { key: 'birthOrder', label: 'Which child inherits', m: 0.25, opts: [['eldest', 'The eldest'], ['youngest', 'The youngest'], ['chosen', 'Chosen by the parent']] },
    { key: 'residence', label: 'Where a married couple lives', m: 0.2, opts: [['land', 'With whoever holds land'], ['husband', 'At the husband’s home'], ['wife', 'At the wife’s home']] },
    { key: 'kinLimit', label: 'Closest kin who may marry', m: 0.12, opts: [['second', 'Third cousins or further'], ['first', 'Second cousins or further'], ['close', 'First cousins or further']] },
  ];
  const OFF = [], NOPT = [], IDX = {};
  let TOTAL = 0;
  DIMS.forEach((d, k) => { OFF.push(TOTAL); NOPT.push(d.opts.length); TOTAL += d.opts.length; IDX[d.key] = k; });
  const optIndex = (dim, key) => DIMS[IDX[dim]].opts.findIndex((o) => o[0] === key);

  const ARCHETYPES = {
    oldNordic: { claims: 'kin', newLand: 'village', handover: 'marriage', daughterShare: 'half', heirCount: 'buyout', widow: 'life', heirSex: 'sonsFirst', voice: 'landholders', birthOrder: 'eldest', residence: 'land', kinLimit: 'first' },
  };

  // Rates are per year; the daily step scales pulls by dt and noise by sqrt(dt) (Euler–Maruyama).
  const P = {
    social: 0.5,       // pull towards the people one deals with, at malleability 1
    anchor: { village: 0.35, city: 0.15 }, // pull back towards what one learned young (Friedkin–Johnsen)
    selfInterest: 0.12,
    noise: 0.12,       // per sqrt(year), at malleability 1
    adultAnchorDrift: 0.02, youthAnchorDrift: 0.6, // anchors form in youth and barely move later
    kind: { village: 1, city: 2.2 },
    oblique: 0.3,      // share of the social target taken from the settlement as a whole
    advocacyPull: 3, advocacyWeight: 3,
    margin: 0.25, tieMargin: 0.6, returnMargin: 0.12, // meeting margins
    cultureMarginBase: 0.6, cultureMarginSize: 0.4,   // culture margin = margin * (base + size * sqrt(N / 100))
    fission: { divergence: 0.3, tie: 0.35, years: 3 },
    entrepreneur: 0.004, entrepreneurYears: [5, 15], // chance per adult, custom and year (times malleability squared)
    persuasion: 1.5,   // direct pull from advocates, times the advocates' share of one's ties and sqrt(malleability)
  };

  function gauss(rand) { let u = 0, v = 0; while (u === 0) u = rand(); v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
  function normBlock(a, o, n) { let s = 0; for (let k = 0; k < n; k++) { if (a[o + k] < 0) a[o + k] = 0; s += a[o + k]; } if (s <= 0) { for (let k = 0; k < n; k++) a[o + k] = 1 / n; return; } for (let k = 0; k < n; k++) a[o + k] /= s; }

  function makeCulture(env, name, customs, centre, parent = null) {
    const c = { id: env.cultures.length, name, customs: Int8Array.from(customs), centres: centre === null ? [] : [centre], parent, founded: env.t, history: [] };
    env.cultures.push(c);
    return c;
  }
  function fromArchetype(name) { const a = ARCHETYPES[name]; return DIMS.map((d) => optIndex(d.key, a[d.key])); }

  // An attitude centred on a preferred option with some spread; `lean` adds weight to chosen alternatives.
  function seedAttitude(customs, rand, strength = 0.55, lean = null) {
    const a = new Float32Array(TOTAL);
    DIMS.forEach((d, k) => {
      const o = OFF[k], n = NOPT[k];
      for (let j = 0; j < n; j++) a[o + j] = (1 - strength) / n * (0.4 + rand() * 1.2);
      a[o + customs[k]] += strength * (0.75 + rand() * 0.5);
      if (lean && lean[d.key]) for (const [opt, wgt] of Object.entries(lean[d.key])) a[o + optIndex(d.key, opt)] += wgt * (0.7 + rand() * 0.6);
      normBlock(a, o, n);
    });
    return a;
  }

  // ---- the daily step ----
  // env.people: [{ id, alive, age, settlement, att, anc, ties: Map(id -> weight), prestige, interest, advocate }]
  function dailyStep(env, dt, rand) {
    const mul = env.driftMul || 1, byId = env.byId;
    const means = new Map();
    for (const s of env.settlements) {
      const m = new Float32Array(TOTAL); let n = 0;
      for (const p of s.members()) { if (!p.alive || p.age < 12) continue; for (let k = 0; k < TOTAL; k++) m[k] += p.att[k]; n++; }
      if (n) for (let k = 0; k < TOTAL; k++) m[k] /= n;
      means.set(s.id, n ? m : null);
    }
    const tgt = new Float32Array(TOTAL), press = new Float32Array(TOTAL), sq = Math.sqrt(dt * mul);
    for (const p of env.people) {
      if (!p.alive || p.age < 12) continue;
      const s = env.settlementOf(p), kind = s ? s.kind : 'village', M = s ? means.get(s.id) : null;
      // social target: tie- and prestige-weighted mean of contacts, mixed with the settlement as a whole
      tgt.fill(0); let wsum = 0; press.fill(0);
      for (const [j, w0] of p.ties) {
        const q = byId(j); if (!q || !q.alive || q.age < 12) continue;
        const wq = w0 * q.prestige * (q.advocate ? P.advocacyWeight : 1);
        for (let k = 0; k < TOTAL; k++) tgt[k] += wq * q.att[k];
        wsum += wq;
        if (q.advocate) press[OFF[q.advocate.dim] + q.advocate.opt] += wq; // advocates argue, not just exist
      }
      if (wsum > 0) for (let k = 0; k < TOTAL; k++) press[k] /= wsum;
      if (wsum > 0) for (let k = 0; k < TOTAL; k++) tgt[k] /= wsum;
      if (M) for (let k = 0; k < TOTAL; k++) tgt[k] = wsum > 0 ? (1 - P.oblique) * tgt[k] + P.oblique * M[k] : M[k];
      else if (wsum === 0) tgt.set(p.att);
      const ageF = p.age < 25 ? 1.5 : p.age < 50 ? 1 : 0.6, anchorR = P.anchor[kind] || P.anchor.village;
      for (let d = 0; d < DIMS.length; d++) {
        const o = OFF[d], n = NOPT[d], m = DIMS[d].m;
        const rs = m * P.social * P.kind[kind] * ageF, ru = m * P.selfInterest, sig = m * P.noise;
        const adv = p.advocate && p.advocate.dim === d ? p.advocate : null;
        let nz = 0; const xi = []; for (let j = 0; j < n; j++) { xi.push(gauss(rand)); nz += xi[j]; } nz /= n;
        let pr = 0; for (let j = 0; j < n; j++) pr += press[o + j];
        const rp = P.persuasion * Math.pow(m, 0.75) * P.kind[kind] * ageF;
        for (let j = 0; j < n; j++) {
          const a = p.att[o + j];
          let da = rs * (tgt[o + j] - a) + anchorR * (p.anc[o + j] - a) + rp * (press[o + j] - pr * a);
          if (p.interest) da += ru * (p.interest[o + j] - a);
          if (adv) da += P.advocacyPull * ((j === adv.opt ? 1 : 0) - a);
          p.att[o + j] = a + da * dt * mul + sig * (xi[j] - nz) * sq * 0.5;
        }
        normBlock(p.att, o, n);
        const ad = (p.age < 20 ? P.youthAnchorDrift : P.adultAnchorDrift) * dt * mul;
        for (let j = 0; j < n; j++) p.anc[o + j] += ad * (p.att[o + j] - p.anc[o + j]);
      }
    }
  }

  // Norm entrepreneurs: now and then an adult takes up the cause of another option for some years. This is what
  // breaks the symmetry of drift; concentrated effort (events, influential pawns, later perhaps the player) uses the same slot.
  function entrepreneurs(env, rand) {
    const out = [];
    for (const p of env.people) {
      if (!p.alive || p.age < 18) continue;
      if (p.advocate && p.advocate.until !== undefined && p.advocate.until <= env.t) p.advocate = null;
      if (p.advocate) continue;
      for (let d = 0; d < DIMS.length; d++) {
        if (rand() >= P.entrepreneur * DIMS[d].m * DIMS[d].m) continue;
        // the cause is one that is already in the air: weighted by the person's own interest and by local support
        const o = OFF[d], n = NOPT[d], s = env.settlementOf(p), cur = s ? s.practice[d] : -1, sup = s && s.lastSupport;
        let tot = 0; const wts = [];
        for (let j = 0; j < n; j++) { const v = j === cur ? 0 : 0.15 + (p.interest ? p.interest[o + j] : 0) + (sup ? sup[o + j] : p.att[o + j]); wts.push(v); tot += v; }
        let r = rand() * tot, opt = 0; while (opt < n - 1 && (r -= wts[opt]) > 0) opt++;
        if (opt === cur) continue;
        const [a, b] = P.entrepreneurYears;
        p.advocate = { dim: d, opt, until: env.t + a + rand() * (b - a), natural: true };
        out.push(p);
        break;
      }
    }
    return out;
  }

  // ---- yearly meeting of one settlement: local practice may move away from (or back to) the culture's custom ----
  function support(env, members, voiceOf) {
    const S = new Float32Array(TOTAL); let W = 0;
    for (const p of members) { const v = voiceOf(p); if (v <= 0 || !p.alive) continue; const w = v * p.prestige; for (let k = 0; k < TOTAL; k++) S[k] += w * p.att[k]; W += w; }
    if (W > 0) for (let k = 0; k < TOTAL; k++) S[k] /= W;
    return { S, W };
  }
  function meeting(env, s) {
    const c = env.cultures[s.culture], changes = [];
    const { S, W } = support(env, s.members(), (p) => env.voiceOf(p, s));
    s.lastSupport = S; s.lastVoices = W;
    if (W <= 0) return changes;
    // a handful of voices is noisy: below ten voices the margin grows
    const nv = s.members().filter((p) => env.voiceOf(p, s) > 0).length, small = 1 + Math.max(0, 10 - nv) * 0.1;
    for (let d = 0; d < DIMS.length; d++) {
      const o = OFF[d], n = NOPT[d], x = s.practice[d], cust = c.customs[d];
      let y = 0; for (let j = 1; j < n; j++) if (S[o + j] > S[o + y]) y = j;
      if (y === x) continue;
      const h = small * (x === cust ? P.margin + P.tieMargin * s.tie : y === cust ? P.returnMargin : P.margin);
      if (S[o + y] > S[o + x] * (1 + h)) { changes.push({ dim: d, from: x, to: y, sy: S[o + y], sx: S[o + x] }); s.practice[d] = y; }
    }
    return changes;
  }
  // ---- yearly reckoning of the whole culture ----
  function cultureYear(env, c) {
    const setts = env.settlements.filter((s) => s.culture === c.id);
    const agg = new Float32Array(TOTAL); let W = 0, N = 0;
    for (const s of setts) {
      if (!s.lastSupport || !s.lastVoices) continue;
      const size = s.members().filter((p) => p.alive).length; N += size;
      const w = size * (0.3 + 0.7 * s.tie) * (c.centres.includes(s.id) ? 2 : 1) * (s.kind === 'city' ? 3 : 1);
      for (let k = 0; k < TOTAL; k++) agg[k] += w * s.lastSupport[k]; W += w;
    }
    const changes = [];
    if (W > 0) {
      for (let k = 0; k < TOTAL; k++) agg[k] /= W;
      // larger cultures move more slowly; a tiny culture also gets extra inertia, since its few voices are noisy
      const H = P.margin * Math.max(1, P.cultureMarginBase + P.cultureMarginSize * Math.sqrt(N / 100)) * (1 + Math.max(0, 40 - N) * 0.02);
      for (let d = 0; d < DIMS.length; d++) {
        const o = OFF[d], n = NOPT[d], x = c.customs[d];
        let y = 0; for (let j = 1; j < n; j++) if (agg[o + j] > agg[o + y]) y = j;
        if (y !== x && agg[o + y] > agg[o + x] * (1 + H)) {
          c.customs[d] = y; changes.push({ dim: d, from: x, to: y });
          // settlements that followed the old custom follow the new one, unless they still clearly prefer the old
          for (const s of setts) if (s.practice[d] === x && !(s.lastSupport && s.lastSupport[o + x] > s.lastSupport[o + y] * (1 + P.margin))) s.practice[d] = y;
        }
      }
    }
    c.lastAgg = agg; c.size = N;
    const splits = [];
    for (const s of setts) {
      if (c.centres.includes(s.id)) { s.divergence = 0; continue; }
      let num = 0, den = 0;
      for (let d = 0; d < DIMS.length; d++) { const wd = 1 / DIMS[d].m; den += wd; if (s.practice[d] !== c.customs[d]) num += wd; }
      s.divergence = num / den;
      if (s.divergence >= P.fission.divergence && s.tie < P.fission.tie) s.fissionYears = (s.fissionYears || 0) + 1; else s.fissionYears = 0;
      if (s.fissionYears >= P.fission.years) splits.push(s);
    }
    const made = [];
    for (const s of splits) made.push(split(env, [s.id], 'drift'));
    return { changes, splits: made };
  }
  // The one way a culture divides: drift calls it automatically; events can call it later with their own cause.
  function split(env, settlementIds, cause, name) {
    const first = env.settlements.find((s) => s.id === settlementIds[0]), from = env.cultures[first.culture];
    const nc = makeCulture(env, name || env.nameCulture(first, from), first.practice, first.id, from.id);
    for (const id of settlementIds) { const s = env.settlements.find((q) => q.id === id); s.culture = nc.id; s.tie = 1; s.fissionYears = 0; s.divergence = 0; }
    nc.history.push({ t: env.t, cause, from: from.id });
    if (env.onSplit) env.onSplit(nc, from, cause);
    return nc;
  }

  return { DIMS, OFF, NOPT, TOTAL, IDX, P, ARCHETYPES, optIndex, makeCulture, fromArchetype, seedAttitude, dailyStep, entrepreneurs, meeting, cultureYear, split, support, normBlock };
})();
VB['culture'] = Culture;
if (typeof module !== 'undefined') module.exports = Culture;
if (typeof globalThis !== 'undefined') globalThis.Culture = Culture;

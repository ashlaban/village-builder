// @sys culture [social]: the cultures and their customs in force: a pawn's culture made, its causes, the villages' meetings, the yearly reckoning and the split
// ===== Customs: one culture-wide set, local practice per settlement =====
// A settlement's practice changes only at its yearly meeting; the culture's customs change only at the yearly reckoning after all
// meetings. What each person holds, and its daily drift, is sim/attitudes' (VB-417); the causes argued here move it through pull and hold.
const Culture = (() => {
  const { DIMS, OFF, NOPT, TOTAL, PRACTICES } = VB['sim/customs'],
    A = VB['sim/attitudes'];

  // Years and shares: the causes, the meetings' margins, the hold of a change, the reckoning and the split.
  const P = {
    advocacyJump: 0.25, // taking up a cause moves one's own attitude this share of the way to it, at once
    causeGrace: 0.25, // years from taking a cause up in which laying it down does not start the wait for another (a season)
    causeEvery: 5, // years a cause lasts, and from taking one up before one may take up another (it may be laid down at any time)
    margin: 0.25,
    tieMargin: 0.6,
    returnMargin: 0.12, // meeting margins
    fewVoices: 0.2, // a meeting's margin grows by this share for each voice below ten: a handful of voices is noisy (VB-1104)
    cultureMarginBase: 0.6,
    cultureMarginSize: 0.4, // culture margin = margin * (base + size * sqrt(N / 100))
    hold: 0.5, // a practice's hold once in force: the share of the way a voice that carried a change moves what it holds to (its anchor)
    // towards its attitude, at the meeting or reckoning that passes it, so that the change outlasts the cause that argued for it (VB-1104)
    smallCulture: 0.02, // and grows by this share for each person below forty: a tiny culture's few voices are noisy (VB-1104)
    fission: { divergence: 0.3, tie: 0.35, years: 3 },
    entrepreneur: 0.004, // chance per adult, custom and year (times malleability squared)
  };

  // The order of preference among name generators, per kind of thing named (sim/names, VB-026): every culture starts with this one, and a
  // culture that splits off keeps its parent's, so that cultures can come to prefer different names.
  const NAME_PREFS = { farm: ['compass', 'owner', 'position', 'landmark', 'feature', 'age'] };
  // The one write of a settlement's practice (VB-231): custom index dim becomes option index option, at its meeting (a command's run, or
  // the meeting itself when no caller issues commands). Read through sim/customs.
  const setPractice = (s, dim, option) => {
    s.practice[dim] = option;
  };
  const basePractices = () => Object.fromEntries(Object.entries(PRACTICES).map(([k, x]) => [k, x.base]));
  // The functions that read people take `hooks`, the environment's lookups (VB-073): byId(id), settlementOf(p), voiceOf(p, s), membersOf(s),
  // nameCulture(s, from), onSplit(nc, from, cause), ask(question) for a meeting's question (sim/decisions, VB-313) and, if given,
  // decide(s, dim, option) for a meeting's change (VB-170) and act(p, trait, rule) for what a person's trait does to its drift (VB-520:
  // openness, piety; 1 at a trait of 0.5); the caller builds them (sim/society hooks(st), or tests/calibrate.js). The environment itself
  // (cultures, settlements, people, driftMul) is plain data.
  // `values`: the means of its people's four values (VB-519; Customs and culture, A culture's values), as given (an archetype's) or else
  // its parent's, until its people's are reckoned.
  function makeCulture(env, name, customs, centre, parent = null, values = null) {
    const from = parent !== null ? env.cultures[parent] : null;
    const prefs =
      parent !== null && env.cultures[parent] && env.cultures[parent].namePrefs
        ? env.cultures[parent].namePrefs
        : NAME_PREFS;
    const c = {
      id: env.cultures.length,
      name,
      customs: Int8Array.from(customs),
      centres: centre === null ? [] : [centre],
      parent,
      founded: env.t,
      history: [],
      namePrefs: { farm: [...prefs.farm] },
      practices:
        parent !== null && env.cultures[parent] && env.cultures[parent].practices
          ? { ...env.cultures[parent].practices }
          : basePractices(),
      values: values ? { ...values } : from && from.values ? { ...from.values } : null,
    };
    env.cultures.push(c);
    return c;
  }

  // @state pawn.lastCause (VB-1112): null, or the pawn's last cause that ended: { dim, opt, since, end (years), how: 'lapsed' | 'won',
  //   sup, vs, vsOpt, need } (the shares its village's last meeting gave it; null before one)
  // Initialize seeded and newborn pawns alike; the caller supplies the seeded or inherited attitude.
  function initPerson(p, att) {
    A.initAttitude(p, att);
    p.standing = 1;
    p.interest = null;
    p.advocate = null;
    p.causeSince = null;
    p.lastCause = null;
  }
  // A cause is a long agenda: taken up at year t it moves the pawn's own attitude a step towards it at once (P.advocacyJump), and the pawn
  // may take up no other until P.causeEvery years have passed (causeFree), though it may lay the cause down (dim null) at any time.
  function advocate(p, dim, opt, until, t, natural) {
    if (dim === null) {
      p.advocate = null;
      // laid down within its first season (t: the year now), the cause starts no wait (P.causeGrace)
      if (t !== undefined && p.causeSince !== null && t - p.causeSince < P.causeGrace) p.causeSince = null;
      return;
    }
    p.advocate = natural ? { dim, opt, until, natural: true } : { dim, opt, until };
    if (t === undefined) return;
    p.causeSince = t;
    A.pull(p, dim, opt, P.advocacyJump);
  }
  // A cause's end (VB-1112): `how` is 'lapsed' (its years ran out) or 'won' (its option became the practice). The pawn keeps the last
  // cause and what its village's last meeting gave it (lastCause), for the Agenda and the record: the support for the option, the
  // practice's (or, where the option is the practice, the best other's), and the share the option needed to pass the practice.
  function endCause(env, hooks, p, adv, how) {
    const s = hooks.settlementOf(p),
      o = OFF[adv.dim],
      n = NOPT[adv.dim],
      S = s && s.lastSupport,
      lc = {
        dim: adv.dim,
        opt: adv.opt,
        since: p.causeSince,
        end: env.t,
        how,
        sup: null,
        vs: null,
        vsOpt: null,
        need: null,
      };
    if (S) {
      const x = s.practice[adv.dim];
      let y = x;
      if (x === adv.opt) for (let j = 0; j < n; j++) if (j !== x && (y === x || S[o + j] > S[o + y])) y = j;
      const h =
        fewVoices(hooks.membersOf(s).filter((q) => hooks.voiceOf(q, s) > 0).length) *
        margin(s, x, adv.opt, env.cultures[s.culture].customs[adv.dim]);
      lc.sup = Math.round(S[o + adv.opt] * 100) / 100;
      lc.vsOpt = y;
      lc.vs = Math.round(S[o + y] * 100) / 100;
      lc.need = Math.round(S[o + x] * (1 + h) * 100) / 100;
    }
    p.lastCause = lc;
    return lc;
  }
  // The year from which the pawn may take up a new cause (it is free when t has reached it).
  const causeFree = (p) =>
    p.causeSince === null || p.causeSince === undefined ? -Infinity : p.causeSince + P.causeEvery;

  // Norm entrepreneurs: now and then an adult takes up the cause of another option for some years. This is what
  // breaks the symmetry of drift; concentrated effort (events, influential pawns, later perhaps the player) uses the same slot.
  function entrepreneurs(env, hooks, rand) {
    const out = [];
    out.lapsed = []; // the pawns whose cause ran out at this meeting (each has its lastCause)
    for (const id of hooks.living || env.people.map((p) => p.id)) {
      const p = hooks.byId(id);
      if (!p.alive || p.age < 18) continue;
      if (p.advocate && p.advocate.until !== undefined && p.advocate.until <= env.t) {
        if (!p.advocate.won) {
          endCause(env, hooks, p, p.advocate, 'lapsed');
          out.lapsed.push(p);
        }
        p.advocate = null;
      }
      if (p.advocate || env.t < causeFree(p)) continue;
      const open = hooks.act ? hooks.act(p, 'openness', 'cause') : 1; // 0 to 2 times by openness (VB-520)
      for (let d = 0; d < DIMS.length; d++) {
        if (rand() >= P.entrepreneur * DIMS[d].m * DIMS[d].m * open) continue;
        // the cause is one that is already in the air: weighted by the person's own interest and by local support
        const o = OFF[d],
          n = NOPT[d],
          s = hooks.settlementOf(p),
          cur = s ? s.practice[d] : -1,
          sup = s && s.lastSupport;
        let tot = 0;
        const wts = [];
        for (let j = 0; j < n; j++) {
          const v = j === cur ? 0 : 0.15 + (p.interest ? p.interest[o + j] : 0) + (sup ? sup[o + j] : p.att[o + j]);
          wts.push(v);
          tot += v;
        }
        let r = rand() * tot,
          opt = 0;
        while (opt < n - 1 && (r -= wts[opt]) > 0) opt++;
        if (opt === cur) continue;
        advocate(p, d, opt, env.t + P.causeEvery, env.t, true);
        out.push(p);
        break;
      }
    }
    return out;
  }

  // ---- yearly meeting of one settlement: local practice may move away from (or back to) the culture's custom ----
  // A follower's voice leans to its lord's side (VB-708): `lean` of its weight goes with the lord's attitudes (leanOf, a hook; none: its own).
  function support(env, members, voiceOf, leanOf = null, lean = 0) {
    const S = new Float32Array(TOTAL);
    let W = 0;
    for (const p of members) {
      const v = voiceOf(p);
      if (v <= 0 || !p.alive) continue;
      const w = v * p.standing,
        q = leanOf && lean > 0 ? leanOf(p) : null;
      if (q && q.att) for (let k = 0; k < TOTAL; k++) S[k] += w * ((1 - lean) * p.att[k] + lean * q.att[k]);
      else for (let k = 0; k < TOTAL; k++) S[k] += w * p.att[k];
      W += w;
    }
    if (W > 0) for (let k = 0; k < TOTAL; k++) S[k] /= W;
    return { S, W };
  }
  // The share by which a way y must pass the practice x at a village's meeting: most where the practice is the culture's custom (more the
  // closer the village's tie), least to return to that custom; times fewVoices, as a handful of voices is noisy (below ten the margin grows).
  const margin = (s, x, y, cust) =>
    x === cust ? P.margin + P.tieMargin * s.tie : y === cust ? P.returnMargin : P.margin;
  const fewVoices = (n) => 1 + Math.max(0, 10 - n) * P.fewVoices;
  // A change passed holds (P.hold, VB-1104): each voice of the settlement s that favours the new way y over the old x moves its anchor,
  // what it holds to, P.hold of the way towards its attitude on the custom d, having carried the change in public. Returns their number.
  function holdTo(hooks, s, d, x, y) {
    const o = OFF[d];
    let held = 0;
    for (const p of hooks.membersOf(s)) {
      if (!p.alive || !p.anc || hooks.voiceOf(p, s) <= 0 || !(p.att[o + y] > p.att[o + x])) continue;
      A.hold(p, d, P.hold);
      held++;
    }
    VB.count.meetingWalk += held;
    return held;
  }
  function meeting(env, hooks, s) {
    const c = env.cultures[s.culture],
      changes = [];
    const { S, W } = support(env, hooks.membersOf(s), (p) => hooks.voiceOf(p, s), hooks.leanOf, hooks.lean);
    s.lastSupport = S;
    s.lastVoices = W;
    if (W <= 0) return changes;
    const small = fewVoices(hooks.membersOf(s).filter((p) => hooks.voiceOf(p, s) > 0).length);
    for (let d = 0; d < DIMS.length; d++) {
      const o = OFF[d],
        n = NOPT[d],
        x = s.practice[d],
        cust = c.customs[d];
      // the question put to the village (VB-313): its voices' support for each option, and the margin each must pass the practice by
      const support = [],
        need = [];
      for (let j = 0; j < n; j++) {
        support.push(S[o + j]);
        need.push(j === x ? 0 : small * margin(s, x, j, cust));
      }
      const y = hooks.ask({ kind: 'custom', body: s.id, dim: d, current: x, options: n, support, need });
      if (y === x) continue;
      // the change itself: through the caller's decide (the simulation issues a command, VB-170), else written here
      if (hooks.decide ? hooks.decide(s, d, y) : (setPractice(s, d, y), true)) {
        changes.push({ dim: d, from: x, to: y, sy: S[o + y], sx: S[o + x] });
        holdTo(hooks, s, d, x, y);
      }
    }
    return changes;
  }
  // A culture's values reckoned (VB-519): a sum of each of its values, at 0, where the caller gives hooks.addValues(p, sum) (which adds a
  // living adult's and says whether it did) and the culture holds values; else null. setValues: the mean, to a thousandth, where any
  // adult was counted.
  const valueSum = (hooks, c) =>
    hooks.addValues && c.values ? Object.fromEntries(Object.keys(c.values).map((k) => [k, 0])) : null;
  function setValues(c, sum, n) {
    if (sum && n > 0) for (const k of Object.keys(sum)) c.values[k] = Math.round((sum[k] / n) * 1000) / 1000;
  }
  // ---- yearly reckoning of the whole culture ----
  function cultureYear(env, hooks, c) {
    const setts = env.settlements.filter((s) => s.culture === c.id);
    const agg = new Float32Array(TOTAL);
    let W = 0,
      N = 0;
    // its values: the mean of its living adults', in the same walk of its villages' people (VB-519), through the caller's addValues
    const sum = valueSum(hooks, c);
    let adults = 0;
    for (const s of setts) {
      const met = s.lastSupport && s.lastVoices;
      if (!met && !sum) continue;
      let size = 0;
      for (const p of hooks.membersOf(s))
        if (p.alive) {
          size++;
          if (sum && hooks.addValues(p, sum)) adults++;
        }
      if (!met) continue;
      N += size;
      const w = size * (0.3 + 0.7 * s.tie) * (c.centres.includes(s.id) ? 2 : 1) * (s.kind === 'city' ? 3 : 1);
      for (let k = 0; k < TOTAL; k++) agg[k] += w * s.lastSupport[k];
      W += w;
    }
    const changes = [];
    if (W > 0) {
      for (let k = 0; k < TOTAL; k++) agg[k] /= W;
      // larger cultures move more slowly; a tiny culture also gets extra inertia, since its few voices are noisy
      const H =
        P.margin *
        Math.max(1, P.cultureMarginBase + P.cultureMarginSize * Math.sqrt(N / 100)) *
        (1 + Math.max(0, 40 - N) * P.smallCulture);
      for (let d = 0; d < DIMS.length; d++) {
        const o = OFF[d],
          n = NOPT[d],
          x = c.customs[d];
        let y = 0;
        for (let j = 1; j < n; j++) if (agg[o + j] > agg[o + y]) y = j;
        if (y !== x && agg[o + y] > agg[o + x] * (1 + H)) {
          c.customs[d] = y;
          // settlements that followed the old custom follow the new one, unless they still clearly prefer the old (VB-1104: the change
          // names which took it up and which kept the old, and the voices of those that took it up hold to it, as at a meeting)
          const took = [],
            kept = [];
          for (const s of setts) {
            if (s.practice[d] !== x) continue;
            if (s.lastSupport && s.lastSupport[o + x] > s.lastSupport[o + y] * (1 + P.margin)) {
              kept.push(s.id);
              continue;
            }
            // the village takes it up by its own act, as at its meeting (VB-1240: through the caller's decide, the verb, else written here);
            // the culture's custom itself is a reckoning of its villages' voices, not an act
            if (!(hooks.decide ? hooks.decide(s, d, y) : (setPractice(s, d, y), true))) continue;
            took.push(s.id);
            holdTo(hooks, s, d, x, y);
          }
          changes.push({ dim: d, from: x, to: y, took, kept });
        }
      }
    }
    c.lastAgg = agg;
    c.size = N;
    setValues(c, sum, adults);
    const splits = [];
    for (const s of setts) {
      if (c.centres.includes(s.id)) {
        s.divergence = 0;
        continue;
      }
      let num = 0,
        den = 0;
      for (let d = 0; d < DIMS.length; d++) {
        const wd = 1 / DIMS[d].m;
        den += wd;
        if (s.practice[d] !== c.customs[d]) num += wd;
      }
      s.divergence = num / den;
      if (s.divergence >= P.fission.divergence && s.tie < P.fission.tie) s.fissionYears = (s.fissionYears || 0) + 1;
      else s.fissionYears = 0;
      if (s.fissionYears >= P.fission.years) splits.push(s);
    }
    const made = [];
    for (const s of splits) made.push(split(env, hooks, [s.id], 'drift'));
    return { changes, splits: made };
  }
  // The one way a culture divides: drift calls it automatically; events can call it later with their own cause.
  function split(env, hooks, settlementIds, cause, name) {
    const first = env.settlements.find((s) => s.id === settlementIds[0]),
      from = env.cultures[first.culture];
    const nc = makeCulture(env, name || hooks.nameCulture(first, from), first.practice, first.id, from.id);
    for (const id of settlementIds) {
      const s = env.settlements.find((q) => q.id === id);
      s.culture = nc.id;
      s.tie = 1;
      s.fissionYears = 0;
      s.divergence = 0;
    }
    // its values at once: the mean of its own adults' (VB-519), or its parent's if it has none
    const sum = valueSum(hooks, nc);
    let adults = 0;
    if (sum)
      for (const s of env.settlements)
        if (s.culture === nc.id) for (const p of hooks.membersOf(s)) if (hooks.addValues(p, sum)) adults++;
    setValues(nc, sum, adults);
    nc.history.push({ t: env.t, cause, from: from.id });
    if (hooks.onSplit) hooks.onSplit(nc, from, cause);
    return nc;
  }

  const api = {
    P,
    NAME_PREFS,
    makeCulture,
    initPerson,
    advocate,
    causeFree,
    endCause,
    entrepreneurs,
    support,
    margin,
    fewVoices,
    setPractice,
    meeting,
    cultureYear,
    split,
  };
  return api;
})();
VB['culture'] = Culture;
if (typeof module !== 'undefined') module.exports = Culture;
if (typeof globalThis !== 'undefined') globalThis.Culture = Culture;

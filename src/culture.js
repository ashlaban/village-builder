// @sys culture: customs, per-settlement practice, pawn culture initialization, advocacy and day-by-day attitude drift
// ===== Customs: one culture-wide set, local practice per settlement, attitudes that drift day by day =====
// Two layers. Attitudes: every person holds a preference over the options of each custom, updated each game day
// (one game day stands for about a week). Customs in force: a settlement's practice changes only at its yearly
// meeting; the culture's customs change only at the yearly reckoning after all meetings.
const Culture = (() => {
  // malleability m: 1 changes most easily; the order follows the agreed ranking
  const DIMS = [
    {
      key: 'claims',
      label: 'Claims on empty farms',
      m: 1.0,
      opts: [
        ['kin', 'Kin of the old family first'],
        ['villagers', 'Villagers first'],
        ['anyone', 'Anyone may claim'],
        ['assembly', 'The meeting assigns'],
      ],
    },
    {
      key: 'newLand',
      label: 'Cleared land belongs to',
      m: 0.9,
      opts: [
        ['village', 'The village allots it'],
        ['labour', 'Whoever worked most'],
        ['intended', 'Whoever it was cleared for'],
      ],
    },
    {
      key: 'handover',
      label: 'When the heir takes over',
      m: 0.8,
      opts: [
        ['death', 'At the holder’s death'],
        ['marriage', 'When the heir marries'],
        ['age60', 'When the holder turns 60'],
      ],
    },
    {
      key: 'daughterShare',
      label: 'A daughter’s share',
      m: 0.65,
      opts: [
        ['equal', 'Equal to a son’s'],
        ['half', 'Half a son’s'],
      ],
    },
    {
      key: 'heirCount',
      label: 'How many heirs',
      m: 0.55,
      opts: [
        ['one', 'One heir takes all'],
        ['buyout', 'One heir buys out the rest'],
        ['split', 'Land split between heirs'],
      ],
    },
    {
      key: 'widow',
      label: 'The widow',
      m: 0.45,
      opts: [
        ['life', 'Keeps the farm for life'],
        ['keep', 'Keeps a right to her keep'],
        ['outright', 'Inherits outright'],
      ],
    },
    {
      key: 'heirSex',
      label: 'Who can inherit',
      m: 0.35,
      opts: [
        ['sons', 'Sons only'],
        ['sonsFirst', 'Sons first'],
        ['any', 'Any child'],
        ['daughtersFirst', 'Daughters first'],
      ],
    },
    {
      key: 'voice',
      label: 'Who speaks at the meeting',
      m: 0.3,
      opts: [
        ['landholders', 'Landholders'],
        ['heads', 'All household heads'],
        ['adults', 'All adults'],
      ],
    },
    {
      key: 'birthOrder',
      label: 'Which child inherits',
      m: 0.25,
      opts: [
        ['eldest', 'The eldest'],
        ['youngest', 'The youngest'],
        ['chosen', 'Chosen by the parent'],
      ],
    },
    {
      key: 'residence',
      label: 'Where a married couple lives',
      m: 0.2,
      opts: [
        ['land', 'With whoever holds land'],
        ['husband', 'At the husband’s home'],
        ['wife', 'At the wife’s home'],
      ],
    },
    {
      key: 'kinLimit',
      label: 'Closest kin who may marry',
      m: 0.12,
      opts: [
        ['second', 'Third cousins or further'],
        ['first', 'Second cousins or further'],
        ['close', 'First cousins or further'],
        ['uncle', 'Uncle–niece or further'],
      ],
    },
    {
      key: 'feedOrder',
      label: 'Who eats first when food is short',
      m: 0.5,
      opts: [
        ['equal', 'Equal shares'],
        ['children', 'Children first'],
        ['workers', 'Those who work first'],
      ],
    },
    {
      key: 'ownHeir',
      label: 'Heir to their own parents’ farm',
      m: 0.6,
      opts: [
        ['behind', 'Steps behind other relatives'],
        ['keeps', 'Keeps their place'],
      ],
    },
    {
      key: 'dispute',
      label: 'Disputed claims',
      m: 0.7,
      opts: [
        ['first', 'The first claim stands'],
        ['strongest', 'The strongest claim stands'],
        ['kin', 'Kin of the last holder first'],
        ['meeting', 'The meeting decides'],
      ],
    },
    // VB-100 (Kim, 10 Nov): how the village's common fields rank beside a household's own work (sim/commons; COMMONS.lean)
    {
      key: 'commons',
      label: 'Work on the common fields',
      m: 0.5,
      opts: [
        ['own', 'After the household’s own work'],
        ['fair', 'As the village’s other duties'],
        ['first', 'Before the household’s own work'],
      ],
    },
    {
      key: 'affinity',
      label: 'Kin by marriage who may marry',
      m: 0.12,
      opts: [
        ['fourth', 'None within the fourth degree of affinity'],
        ['line', 'None in the direct line (step-parent, parent-in-law)'],
        ['free', 'No bar'],
      ],
    },
    // VB-711 (Kim, 16 Nov): how hard a household stocks for winter: the margin its autumn count keeps (sim/byre, HERD.margins)
    {
      key: 'stocking',
      label: 'Stocking for winter',
      m: 0.6,
      opts: [
        ['hay', 'To the hay'],
        ['herd', 'Keep the herd'],
      ],
    },
    // VB-826 (design.md, Marriage as a negotiation, 9 Nov): whose voice counts in a match, read where it is offered and answered
    // (sim/records spokesmanOf, sim/asking, sim/marriage); both who marry consent under every option
    {
      key: 'matchBy',
      label: 'Who makes a match',
      m: 0.4,
      opts: [
        ['heads', 'The heads'],
        ['consent', 'The heads, with consent'],
        ['couple', 'The couple'],
      ],
    },
    // VB-463 (Kim, 15 Nov): what the alderman is kept with (sim/keep; OFFICE.keepDays, OFFICE.keepShare)
    {
      key: 'keep',
      label: 'What the alderman is kept with',
      m: 0.4,
      opts: [
        ['days', 'Days of work'],
        ['share', 'A share of the surplus'],
        ['nothing', 'Nothing'],
      ],
    },
  ];
  const OFF = [],
    NOPT = [],
    IDX = {};
  let TOTAL = 0;
  DIMS.forEach((d, k) => {
    OFF.push(TOTAL);
    NOPT.push(d.opts.length);
    TOTAL += d.opts.length;
    IDX[d.key] = k;
  });
  const optIndex = (dim, key) => DIMS[IDX[dim]].opts.findIndex((o) => o[0] === key);

  const ARCHETYPES = {
    oldNordic: {
      claims: 'kin',
      newLand: 'village',
      handover: 'marriage',
      daughterShare: 'half',
      heirCount: 'buyout',
      widow: 'life',
      heirSex: 'sonsFirst',
      voice: 'landholders',
      birthOrder: 'eldest',
      residence: 'land',
      kinLimit: 'first',
      affinity: 'line',
      feedOrder: 'equal',
      ownHeir: 'behind',
      dispute: 'first',
      stocking: 'hay',
      matchBy: 'consent',
      keep: 'days',
      commons: 'fair', // its claims favour kin, not the village (`first` where an archetype's claims are the village's: villagers, assembly)
    },
  };

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

  // The order of preference among name generators, per kind of thing named (sim/names, VB-026): every culture starts with this one, and a
  // culture that splits off keeps its parent's, so that cultures can come to prefer different names.
  const NAME_PREFS = { farm: ['compass', 'owner', 'position', 'landmark', 'feature', 'age'] };
  // A culture's practices that are not customs (VB-257; design.md section 7, Village routines): a rule the culture holds, declared here
  // with the customs, before the first seed, each with its options and the one every culture starts with; not voted on, not drifting,
  // and a culture that splits off keeps its parent's. noDecision: what follows when a village's meeting does not decide its routines (no
  // quorum, or a tie): no village work that year, or last year's work again.
  const PRACTICES = Object.freeze({
    noDecision: Object.freeze({
      label: 'When the meeting does not decide',
      opts: Object.freeze([
        ['nothing', 'No village work that year'],
        ['asLastYear', 'The work of last year'],
      ]),
      base: 'nothing',
    }),
    // How the alderman is chosen (VB-314; design.md, The alderman): at the autumn meeting, when the office is vacant. A practice a culture
    // holds, not a custom: its malleability (0.3) is how readily a culture changes it, kept with its declaration.
    alderman: Object.freeze({
      label: 'How the alderman is chosen',
      opts: Object.freeze([
        ['elected', 'Elected by the meeting'],
        ['byTurns', 'By turns among the farms, a year each'],
      ]),
      base: 'elected',
      malleability: 0.3,
    }),
    // On which days a village keeps its rites (VB-775; design.md, The season's rite): its own, drawn at its founding, as a parish kept its
    // feast day, or the same everywhere (VB-522 as built). A custom cultures may come to differ in, not a dimension: nothing yet gives
    // a pawn a stake in it.
    riteDays: Object.freeze({
      label: 'The days of the rite',
      opts: Object.freeze([
        ['own', 'Each village its own days'],
        ['common', 'The same days everywhere'],
      ]),
      base: 'own',
    }),
  });
  const basePractices = () => Object.fromEntries(Object.entries(PRACTICES).map(([k, x]) => [k, x.base]));
  // The culture's practice of key k: its own, or the one every culture starts with (a save made before VB-257).
  const practiceOf = (c, k) => (c && c.practices && c.practices[k] !== undefined ? c.practices[k] : PRACTICES[k].base);
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
  function fromArchetype(name) {
    const a = ARCHETYPES[name];
    return DIMS.map((d) => optIndex(d.key, a[d.key]));
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

  // @state pawn.lastCause (VB-1112): null, or the pawn's last cause that ended: { dim, opt, since, end (years), how: 'lapsed' | 'won',
  //   sup, vs, vsOpt, need } (the shares its village's last meeting gave it; null before one)
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
  // Initialize seeded and newborn pawns alike; the caller supplies the seeded or inherited attitude.
  function initPerson(p, att) {
    p.att = att;
    compileLeans(p);
    p.anc = Float32Array.from(p.att);
    p.standing = 1;
    p.interest = null;
    p.advocate = null;
    p.causeSince = null;
    p.lastCause = null;
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
    const o = OFF[dim],
      n = NOPT[dim];
    for (let j = 0; j < n; j++) p.att[o + j] += P.advocacyJump * ((j === opt ? 1 : 0) - p.att[o + j]);
    normBlock(p.att, o, n);
    leanOn(p, dim);
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
  function support(env, members, voiceOf) {
    const S = new Float32Array(TOTAL);
    let W = 0;
    for (const p of members) {
      const v = voiceOf(p);
      if (v <= 0 || !p.alive) continue;
      const w = v * p.standing;
      for (let k = 0; k < TOTAL; k++) S[k] += w * p.att[k];
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
    const o = OFF[d],
      n = NOPT[d];
    let held = 0;
    for (const p of hooks.membersOf(s)) {
      if (!p.alive || !p.anc || hooks.voiceOf(p, s) <= 0 || !(p.att[o + y] > p.att[o + x])) continue;
      for (let j = 0; j < n; j++) p.anc[o + j] += P.hold * (p.att[o + j] - p.anc[o + j]);
      held++;
    }
    VB.count.meetingWalk += held;
    return held;
  }
  function meeting(env, hooks, s) {
    const c = env.cultures[s.culture],
      changes = [];
    const { S, W } = support(env, hooks.membersOf(s), (p) => hooks.voiceOf(p, s));
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
      if (hooks.decide ? hooks.decide(s, d, y) : ((s.practice[d] = y), true)) {
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
            s.practice[d] = y;
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

  // ===== Norms (VB-299; design.md, The fair and Goods of place, Quanta and worth; target-v2 4.4): usual quantities, one table for every
  // culture until norms learn from deals (slice 8). Rations are the one unit of account. =====
  // Customary worth of one quantum of each good the fair trades (Agreed, 10 Nov): a sack of grain, a lot of salt meat, butter or dried
  // fish (10 rations each), a barrel of tar or ale, a head of cattle by kind, a sheep. Heirs' shares paid in animals read the same table.
  const WORTH = Object.freeze({
    grain: 10,
    butter: 15,
    'salt meat': 15,
    'dried fish': 15,
    tar: 8,
    ale: 14,
    'cattle/cow': 40,
    'cattle/ox': 50,
    'cattle/heifer': 20,
    'cattle/steer': 20,
    sheep: 6,
    hide: 6, // a roe deer's hide, leather for shoes and harness (VB-424)
    quern: 25, // a hand quern's stone, hewn of sandstone or granite (VB-009; Proposed, slice 6's plan): a good of place
  });
  // The three classes of goods (Decided, 10 Nov): food; wares (animals, cloth and labour; today animals, and tar beside them); land.
  const CLASSES = Object.freeze(['food', 'wares', 'land']);
  // What custom calls an exchange of a good of one class for one of another (Agreed, 10 Nov), from the side that gives `from` and takes `to`:
  // 'none' (not offered at all: land, until slice 5's "Debts are paid with"), 'hard' (a hard bargain: allowed, and remembered against the
  // side that drove it), 'ordinary' (within a class), 'admired' (food for an animal, freely). PROPER is their order, worst first.
  const PROPER = Object.freeze(['none', 'hard', 'ordinary', 'admired']);
  const NORMS = Object.freeze({ hardBelowDays: 60 }); // an animal given for food by a household holding fewer days of need is a hard bargain
  // norm('worth', good): rations a quantum (undefined for a good with no customary worth). norm('proper', fromClass, toClass, days): a word of
  // PROPER; days is the food the giving side's household holds, in days of its need. Pure: no state, no allocation.
  function norm(key, a, b, days) {
    if (key === 'worth') return WORTH[a];
    if (key !== 'proper') throw new Error('Unknown norm: ' + key);
    if (!CLASSES.includes(a) || !CLASSES.includes(b)) throw new Error(`Unknown class of goods: ${a}, ${b}`);
    if (a === 'land' || b === 'land') return 'none';
    if (a === b) return 'ordinary';
    return a === 'wares' && b === 'food' && days < NORMS.hardBelowDays ? 'hard' : 'admired';
  }

  const api = {
    DIMS,
    OFF,
    NOPT,
    TOTAL,
    IDX,
    P,
    WEIGH,
    ARCHETYPES,
    NAME_PREFS,
    optIndex,
    makeCulture,
    fromArchetype,
    seedAttitude,
    dailyStep,
    settlementStep,
    entrepreneurs,
    meeting,
    cultureYear,
    split,
    support,
    normBlock,
  };
  // Simulation wiring operations; keep the enumerable public Culture API unchanged.
  Object.defineProperties(api, {
    initPerson: { value: initPerson },
    inherit: { value: inherit },
    compileLeans: { value: compileLeans },
    advocate: { value: advocate },
    causeFree: { value: causeFree },
    endCause: { value: endCause },
    norm: { value: norm },
    WORTH: { value: WORTH },
    CLASSES: { value: CLASSES },
    PROPER: { value: PROPER },
    NORMS: { value: NORMS },
    PRACTICES: { value: PRACTICES },
    practiceOf: { value: practiceOf },
    margin: { value: margin },
    fewVoices: { value: fewVoices },
  });
  return api;
})();
VB['culture'] = Culture;
if (typeof module !== 'undefined') module.exports = Culture;
if (typeof globalThis !== 'undefined') globalThis.Culture = Culture;

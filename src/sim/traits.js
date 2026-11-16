// @sys sim/traits: the twelve traits (design.md, People, Traits, talk and stories; VB-519, on VB-254's stand-ins): four values, four of
// temperament, four aptitudes, one number in [0.02, 0.98] per pawn and trait, passed on by one equation (TRAITS, sim/rules) at birth and,
// for the values and a hungry childhood, once at 15; placed pawns draw from their culture's distribution; all from the stream `traits`.
// Read through Traits.of, and named by Traits.labelsOf; a head's skill and its bias, as numbers, for sim/plans; a culture's values as the
// mean of its adults' (the hook addValues, for culture's yearly reckoning and its split)
VB['sim/traits'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { YEAR, TRAITS, HELP } = VB['sim/rules'];
  const { settlementIdOf, spouseOf } = VB['sim/records'];
  // @state pawn.traits (VB-254, VB-519): the twelve traits in the order of TRAITS.names (an array, to keep the save small), each to a
  //   thousandth within TRAITS.bounds; written at birth (Traits.born), at seed for those a scenario places and for every pawn of a save
  //   without them (seedTraits), and once at 15, the values and the lean of a hungry childhood (setAtAge). Written only here; read through
  //   Traits.of.
  // @state pawn.leanDays (VB-519): the days a child went hungry (its hunger at TRAITS.lean.hunger or more), counted from birth (or from the
  //   start of a run, or the load of a save without it) until its values set at TRAITS.setAge, then null; null for those past that age
  //   at the start, and kept as it was by the dead.
  const NAMES = TRAITS.names,
    N = NAMES.length,
    IDX = Object.freeze(Object.fromEntries(NAMES.map((k, i) => [k, i])));
  // Each trait's group, by index: the values (0 to 3), temperament (4 to 7), aptitudes (8 to 11).
  const GROUP = Object.freeze(NAMES.map((_, i) => (i < 4 ? 'values' : i < 8 ? 'temperament' : 'aptitudes'))),
    VALUES = Object.freeze(NAMES.slice(0, 4));
  // VB-254's stand-ins, in the order a save made before VB-519 holds them.
  const OLD = Object.freeze(['wits', 'husbandry', 'diligence', 'ambition', 'generosity']);
  // Skill as head (design.md section 7, foresight): the mean of wits and husbandry, plus GROWTH a year as head up to MOST, capped at 1.
  // The bias on a head's targets is within BIAS × (1 - skill) either way of the template's, drawn once when it becomes head.
  const HEAD = Object.freeze({ growth: 0.02, most: 0.2, bias: 0.3 });
  // ---- the draw ----
  // The standard normal at probability u (Acklam's rational approximation, relative error under 1.2e-9): one draw of the stream a chance,
  // so that a draw's count never depends on its value, and `fix` 0.5 is no chance at all.
  const PA = [
      -39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716,
      2.506628277459239,
    ],
    PB = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572],
    PC = [
      -0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549671010446902, 4.374664141464968,
      2.938163982698783,
    ],
    PD = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  function probit(u) {
    const p = Math.min(1 - 1e-9, Math.max(1e-9, u));
    if (p < 0.02425 || p > 1 - 0.02425) {
      const q = Math.sqrt(-2 * Math.log(p < 0.5 ? p : 1 - p)),
        z =
          (((((PC[0] * q + PC[1]) * q + PC[2]) * q + PC[3]) * q + PC[4]) * q + PC[5]) /
          ((((PD[0] * q + PD[1]) * q + PD[2]) * q + PD[3]) * q + 1);
      return p < 0.5 ? z : -z;
    }
    const q = p - 0.5,
      r = q * q;
    return (
      ((((((PA[0] * r + PA[1]) * r + PA[2]) * r + PA[3]) * r + PA[4]) * r + PA[5]) * q) /
      (((((PB[0] * r + PB[1]) * r + PB[2]) * r + PB[3]) * r + PB[4]) * r + 1)
    );
  }
  const keep = (x) => Math.round(Math.min(TRAITS.bounds[1], Math.max(TRAITS.bounds[0], x)) * 1000) / 1000;
  // One trait passed on (design.md, How a trait is passed on): mean + b × (the parents' mean − mean) + chance, drawn from the stream
  // `traits`. `of` is how many parents the mean is over: 2 at birth, where a parent not on record (null) counts as the mean; at 15, the
  // raisers counted (one alone is the whole mean; none, b is 0: a draw from the culture's distribution, as a placed pawn's). The chance is
  // normal with spread TRAITS.sd × √(1 − b² × k / of²), k the parents known, so the spread stays TRAITS.sd from one generation to the next
  // however many are known (√(1 − b²/2) for two, the design's; VB-519's review).
  function pass(st, mean, b, a = null, c = null, of = 2) {
    const k = (a === null ? 0 : 1) + (c === null ? 0 : 1),
      bb = of > 0 ? b : 0,
      pull = of > 0 ? ((a === null ? 0 : a - mean) + (c === null ? 0 : c - mean)) / of : 0,
      chance = TRAITS.sd * Math.sqrt(1 - (bb * bb * k) / (of > 0 ? of * of : 1)) * probit(rnd(st.rng.traits));
    return keep(mean + bb * pull + chance);
  }
  // The four means of the culture pawn `id` belongs to (its village's), or of culture 0, or of the archetype's (before any culture).
  function cultureValues(st, id) {
    const env = st.cenv;
    if (!env || !env.cultures.length) return TRAITS.culture.oldNordic;
    const s = settlementIdOf(st, st.pawns[id]),
      set = s !== null ? env.settlements[s] : null,
      c = env.cultures[set ? set.culture : 0];
    return (c && c.values) || TRAITS.culture.oldNordic;
  }
  const meanOf = (cv, i) => (GROUP[i] === 'values' ? cv[NAMES[i]] : 0.5);
  const traitOf = (st, id, i) =>
    id === null || id === undefined || !st.pawns[id].traits ? null : st.pawns[id].traits[i];
  // ---- written at birth, at seed and at 15 ----
  // A pawn a scenario places (or one of a save without the traits): each trait drawn from its culture's distribution, in order.
  function place(st, id) {
    const cv = cultureValues(st, id),
      t = new Array(N);
    for (let i = 0; i < N; i++) t[i] = pass(st, meanOf(cv, i), 0);
    st.pawns[id].traits = t;
    return t;
  }
  // A child born: temperament and aptitudes from its father and mother by birth around 0.5, for good; its values from them around its
  // culture's means, as a child's, until they set at 15. Twelve draws, in order.
  function born(st, id) {
    const p = st.pawns[id],
      cv = cultureValues(st, id),
      t = new Array(N);
    for (let i = 0; i < N; i++)
      t[i] = pass(st, meanOf(cv, i), TRAITS.b[GROUP[i]], traitOf(st, p.father, i), traitOf(st, p.mother, i));
    p.traits = t;
    p.leanDays = 0;
    return t;
  }
  // Those who raise pawn `id` now: the holder and the mistress (the holder's spouse) of the household it lives in, living, not itself.
  function raisers(st, id) {
    const p = st.pawns[id],
      hh = p.household !== null ? st.households[p.household] : null,
      out = [];
    if (!hh || hh.holder === null || hh.holder === undefined) return out;
    const h = hh.holder,
      sp = spouseOf(st, h);
    if (h !== id && st.pawns[h].alive) out.push(h);
    if (sp !== null && sp !== id && st.pawns[sp].alive && st.pawns[sp].household === hh.id) out.push(sp);
    return out;
  }
  // At TRAITS.setAge, once (sim/lifecycle's daily walk, where the age rolls over): the values drawn again, for good, from those who raised
  // it (one of them alone if there is one, its culture's means if none), around its culture's means (four draws, in order); and a hungry
  // childhood takes from body and wits (no draw). The hungry days are dropped.
  function setAtAge(st, id) {
    const p = st.pawns[id],
      t = p.traits;
    if (!t) return void (p.leanDays = null);
    const cv = cultureValues(st, id),
      by = raisers(st, id),
      a = by.length ? by[0] : null,
      c = by.length > 1 ? by[1] : null;
    for (let i = 0; i < VALUES.length; i++)
      t[i] = pass(st, cv[NAMES[i]], TRAITS.b.values, traitOf(st, a, i), traitOf(st, c, i), by.length);
    const L = TRAITS.lean,
      share = Math.min(1, (p.leanDays || 0) / L.days);
    if (share > 0) {
      t[IDX.body] = keep(t[IDX.body] - L.body * share);
      t[IDX.wits] = keep(t[IDX.wits] - L.wits * share);
    }
    p.leanDays = null;
  }
  // A child's day of hunger (sim/hunger, where its household's hunger is written for its members): one more day at TRAITS.lean.hunger.
  function hungryDay(p) {
    if (typeof p.leanDays === 'number' && p.hunger >= TRAITS.lean.hunger) p.leanDays++;
  }
  // Every pawn without the twelve gets them, in id order: at seed, those a scenario places (the living and the dead on record); at the
  // load of a save made before them, keeping the values it has (VB-254's five, or VB-249's diligence) in place of their draws, drawn all
  // the same so the stream advances as for any pawn. Every pawn without leanDays gets them: 0 for a child under TRAITS.setAge, else null.
  function seedTraits(st) {
    for (const p of st.pawns) {
      if (!p.traits || p.traits.length !== N) {
        const had = p.traits ? OLD.map((k, i) => [k, p.traits[i]]) : [];
        if (p.diligence !== undefined) had.push(['diligence', p.diligence]);
        const t = place(st, p.id);
        for (const [k, x] of had) if (Number.isFinite(x)) t[IDX[k]] = keep(x);
      }
      if (p.diligence !== undefined) delete p.diligence; // lint-allow: owner VB-249's field becomes the trait of the same name
      if (p.buffer !== undefined) delete p.buffer; // lint-allow: owner VB-216's drawn reserve becomes generosity's (VB-520)
      if (p.leanDays === undefined) p.leanDays = p.alive && p.age < TRAITS.setAge ? 0 : null;
    }
  }
  // ---- read ----
  // The pawn's trait `name`: the one read of a trait. A pawn without traits reads the middle.
  function of(st, id, name) {
    const t = st.pawns[id].traits;
    return t ? t[IDX[name]] : 0.5;
  }
  // What trait `name` does to `rule` for pawn id (VB-520; TRAITS.acts): the act's value at 0 and at 1, linear between, the midpoint at
  // 0.5. Reads one trait; allocates nothing.
  const ACTS = TRAITS.acts,
    MOST = Math.max(ACTS.generosity.reserve[0], ACTS.generosity.reserve[1]);
  function act(st, id, name, rule) {
    const r = ACTS[name][rule];
    return r[0] + (r[1] - r[0]) * of(st, id, name);
  }
  // The days of its household's need a holder keeps before it gives or lets go of grain (sim/help, sim/hunger, sim/farmclaims, sim/settle):
  // the floor and its own reserve, by its generosity; a household without a holder (id null) keeps the most (VB-520, after VB-484).
  const bufferOf = (st, id) =>
    HELP.floorDays + (id === null || id === undefined ? MOST : act(st, id, 'generosity', 'reserve'));
  // The words of a pawn's traits beyond the reference's 15th and 85th percentiles (TRAITS.label; design.md, The twelve traits), in the
  // order of TRAITS.names: the low word, or the high one. Nothing of a trait between.
  const WORDS = Object.freeze({
    generosity: ['tight-fisted', 'open-handed'],
    piety: ['irreverent', 'devout'],
    ambition: ['content', 'ambitious'],
    honour: ['slippery', { m: 'a man of his word', f: 'a woman of her word' }],
    sociability: ['reserved', 'sociable'],
    temper: ['mild', 'hot-tempered'],
    diligence: ['idle', 'diligent'],
    openness: [{ m: 'set in his ways', f: 'set in her ways' }, 'curious'],
    body: ['frail', 'strong'],
    hands: ['clumsy', 'deft'],
    husbandry: ['no hand with beasts', 'good with beasts and crops'],
    wits: ['slow', 'sharp'],
  });
  // The word of one trait of pawn id, or null between the labels: for a rule explained to the player ("own reserve: open-handed").
  function wordOf(st, id, name) {
    const p = st.pawns[id],
      x = of(st, id, name),
      w = x < TRAITS.label.low ? WORDS[name][0] : x > TRAITS.label.high ? WORDS[name][1] : null;
    return w === null || typeof w === 'string' ? w : w[p.sex];
  }
  function labelsOf(st, id) {
    const p = st.pawns[id],
      t = p.traits,
      out = [];
    if (!t) return out;
    for (let i = 0; i < N; i++) {
      const w = t[i] < TRAITS.label.low ? WORDS[NAMES[i]][0] : t[i] > TRAITS.label.high ? WORDS[NAMES[i]][1] : null;
      if (w !== null) out.push(typeof w === 'string' ? w : w[p.sex]);
    }
    return out;
  }
  // A culture's reckoning (culture's yearly one, and a split; the hook its caller builds): adds pawn p's four values into `sum` (keyed by
  // the values' names) and returns true, if p is a living adult with its traits; else false.
  function addValues(p, sum) {
    if (!p.alive || p.age < TRAITS.setAge || !p.traits) return false;
    for (let i = 0; i < VALUES.length; i++) sum[VALUES[i]] += p.traits[i];
    return true;
  }
  // Skill as head of a pawn head since `since` (game hours): the mean of wits and husbandry, plus HEAD.growth a year as head up to HEAD.most.
  const skill = (st, id, since) =>
    Math.min(
      1,
      (of(st, id, 'wits') + of(st, id, 'husbandry')) / 2 +
        Math.min(HEAD.most, (HEAD.growth * Math.max(0, st.t - since)) / YEAR),
    );
  // A head's multiplier on one target, of skill s: within HEAD.bias × (1 - s) either way of 1, uniform; drawn from the stream `traits`.
  const biasOf = (st, s) => Math.round((1 + HEAD.bias * (1 - s) * (2 * rnd(st.rng.traits) - 1)) * 1000) / 1000; // to a thousandth
  return {
    IDX,
    HEAD,
    pass,
    born,
    setAtAge,
    hungryDay,
    seedTraits,
    of,
    act,
    bufferOf,
    wordOf,
    labelsOf,
    addValues,
    skill,
    biasOf,
  };
})();

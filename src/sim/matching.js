// @sys sim/matching: the rules of a marriage match: kin degree, a home and its means, the score; what the moving round's matcher and the
// player's wish for a match (VB-274) are both checked against
VB['sim/matching'] = (() => {
  const { MARRIAGE, YEAR_DAYS, HUNGER } = VB['sim/rules'];
  const { dailyNeed, larderOf } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const { settlementIdOf, kinDegree, wasWidowed, practice, fullName, spouseOf, age } = VB['sim/records'];
  const { roundHeirs, heirFor } = VB['sim/heirs'];
  const { trustOfHolder } = VB['sim/ownership'];
  const { opinionOf } = VB['sim/relations'];

  // ---- the rules of a match (the moving round's marriages, and what the player's wish for a match is checked against, VB-274) ----
  // The closest degree each kinLimit option allows; siblings, half-siblings and direct lines (degree 2 or less) never marry.
  const kinOk = (st, a, b, cu, opt = cu.kinLimit) => {
    const d = kinDegree(st, a, b);
    return d > 2 && d >= MARRIAGE.kinDegree[opt];
  };
  // The score of man m and woman f (pawns) with `noise` in 0..1 of its amplitude: the ages' gap, and the villages, same or tied.
  function matchScore(st, m, f, noise, widowed) {
    const env = st.cenv,
      sm = settlementIdOf(st, m),
      sf = settlementIdOf(st, f),
      tie = env.settlements[sf] ? env.settlements[sf].tie : 0;
    const gw = widowed ? MARRIAGE.widowedGapWeight : MARRIAGE.gapWeight;
    return (
      -Math.abs(m.age - f.age - MARRIAGE.ageGap) * gw +
      (sf === sm ? MARRIAGE.sameVillage : 2 * Math.min(tie, env.settlements[sm].tie)) +
      noise * MARRIAGE.noise +
      (MARRIAGE.liking * (opinionOf(st, m.id, f.id) + opinionOf(st, f.id, m.id))) / 2
    ); // opinion (VB-275)
  }
  // Where each pawn would live if married (placeIfMarried), cached until the next marriage changes the families: ranking every farm's
  // heirs for every pair of candidates made the round cost about a second at populous medium. `homeFor(m, f, cu)`: where a couple would
  // live, or null. Under 'land' one of them needs a place (the farm they hold or are first heir to). When both have one (VB-153): a holder
  // keeps their farm and a spouse who is only first heir steps out of that line; of two holders, the couple lives where the other farm is
  // best handed on (handOn: an adult heir, then a landless adult of its village, then a child or nobody), then on the farm with more
  // fields, the man's on a tie. Under the other customs the spouse's home counts. `affords(h)`: the means to marry (VB-153): the home
  // holds food above its seed for MARRIAGE.means years of its members and one more, counting grain still in sheaf and the larder, so that
  // marriages fall after a bad harvest (the preventive check). A home with fewer than two adults needs no means: a lone holder, or a
  // widow with small children, needs the spouse's hands. Cached per household until a marriage.
  function matchRules(st) {
    const heirs = roundHeirs(st),
      places = new Map(),
      handed = new Map(),
      means = new Map();
    const place = (id) => {
      if (!places.has(id)) {
        const hh = st.households[st.pawns[id].household],
          held = trustOfHolder(st, id); // a holder whose farm is held in trust lives there once married (VB-309)
        places.set(
          id,
          held
            ? held.household
            : hh && !hh.dissolved && (hh.holder === id || heirs.rank(hh.id)[0] === id)
              ? hh.id
              : null,
        );
      }
      return places.get(id);
    };
    const fieldsAt = (h) => st.farmsteads[st.households[h].farmstead].fields.length;
    const handsOnWell = (h) => {
      if (!handed.has(h)) {
        const hh = st.households[h],
          heir = heirFor(st, hh, heirs.rank(h), hh.holder),
          v = st.farmsteads[hh.farmstead].village;
        const grown =
          heir !== null &&
          (st.pawns[heir].age >= 18 || hh.members.some((id) => id !== hh.holder && st.pawns[id].age >= 18));
        handed.set(
          h,
          grown ? 2 : st.demand.some((id) => st.pawns[id].alive && settlementIdOf(st, st.pawns[id]) === v) ? 1 : 0,
        );
      }
      return handed.get(h);
    };
    const both = (m, f, pm, pf) => {
      const hm = st.households[pm].holder === m.id,
        hf = st.households[pf].holder === f.id;
      if (hm !== hf) return hm ? pm : pf;
      if (hm && hf && handsOnWell(pm) !== handsOnWell(pf)) return handsOnWell(pm) > handsOnWell(pf) ? pf : pm;
      return fieldsAt(pf) > fieldsAt(pm) ? pf : pm;
    };
    const homeFor = (m, f, cu, pm = place(m.id), pf = place(f.id)) => {
      if (cu.residence === 'land') return pm !== null && pf !== null ? both(m, f, pm, pf) : pm !== null ? pm : pf;
      return cu.residence === 'husband' ? m.household : f.household;
    };
    const affords = (h) => {
      if (!means.has(h)) {
        const hh = st.households[h],
          store = grainOf(hh) + hh.meals + hh.unthreshed.reduce((a, x) => a + (+x || 0), 0) + larderOf(hh);
        const grown = hh.members.filter((id) => st.pawns[id].alive && st.pawns[id].age >= 18).length;
        means.set(
          h,
          grown < 2 ||
            store - reserved(st, hh, 'grain') >=
              MARRIAGE.means * YEAR_DAYS * (dailyNeed(st, hh) + st.ECON.ration.adult),
        );
      }
      return means.get(h);
    };
    return { heirs, places, handed, means, place, homeFor, affords };
  }
  // Why the match of pawns a and b (ids, either sex) may not be made at the round now ({why}), or the match ({man, woman, home}: pawns and
  // a household id). The round's rules: both alive, single, of age, fed, not retired and in no open offer; the kin degree the man's village's
  // custom allows; a home that affords it; and a score, with the noise at its mean, that reaches the lowest accepted score.
  function matchBar(st, a, b, rules = matchRules(st)) {
    const pa = st.pawns[a],
      pb = st.pawns[b];
    if (!pa || !pb) return { why: 'there is no such pawn' };
    if (pa.sex === pb.sex) return { why: 'two of one sex do not marry' };
    const m = pa.sex === 'm' ? pa : pb,
      f = m === pa ? pb : pa;
    for (const p of [m, f]) {
      const nm = fullName(p);
      if (!p.alive) return { why: `${nm} is dead` };
      if (spouseOf(st, p.id) !== null) return { why: `${nm} is married` };
      if (age(st, p) < (p === m ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) return { why: `${nm} is too young to marry` };
      if (p.retired) return { why: `${nm} is retired` };
      if (!(p.hunger < HUNGER.marryBelow)) return { why: `${nm} is too hungry to marry` };
      if (st.offers.some((o) => o.man === p.id || o.woman === p.id)) return { why: `${nm} is in an open offer` };
    }
    const cu = practice(st, settlementIdOf(st, m));
    if (!kinOk(st, m.id, f.id, cu)) return { why: 'too close kin for the custom of the village' };
    const home = rules.homeFor(m, f, cu);
    if (home === null) return { why: 'no home for them: neither has a farm to live on' };
    if (!rules.affords(home)) return { why: 'their home cannot feed another mouth' };
    const widowed = wasWidowed(st, m.id) || wasWidowed(st, f.id);
    if (matchScore(st, { ...m, age: age(st, m) }, { ...f, age: age(st, f) }, 0.5, widowed) < MARRIAGE.minScore) {
      return { why: 'the two are ill matched: the gap of their ages, or their villages' };
    }
    return { man: m, woman: f, home };
  }
  return { kinOk, matchScore, matchRules, matchBar };
})();

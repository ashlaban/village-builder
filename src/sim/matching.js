// @sys sim/matching: the rules of a marriage match: the pool within walking reach, kin degree, a home and its means, the score; what
// the moving round's matcher and the player's wish for a match (VB-274) are both checked against
VB['sim/matching'] = (() => {
  const { MARRIAGE, YEAR_DAYS, HUNGER } = VB['sim/rules'];
  const { heldBy } = VB['sim/offers'];
  const { dailyNeed, larderOf } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const { settlementIdOf, kinDegree, wasWidowed, practice, fullName, spouseOf, age } = VB['sim/records'];
  const { heirRanking, heirFor } = VB['sim/heirs'];
  const { trustOfHolder } = VB['sim/ownership'];
  const { opinionOf } = VB['sim/relations'];
  const { hoursBetween } = VB['sim/routes'];
  const { wishOf } = VB['sim/wishes'];

  // ---- the rules of a match (the moving round's marriages, and what the player's wish for a match is checked against, VB-274) ----
  // The closest degree each kinLimit option allows; siblings, half-siblings and direct lines (degree 2 or less) never marry.
  const kinOk = (st, a, b, cu, opt = cu.kinLimit) => {
    const d = kinDegree(st, a, b);
    return d > 2 && d >= MARRIAGE.kinDegree[opt];
  };
  // ---- the pool and the villages' term (VB-288; design.md, Between villages: Ease of mixing) ----
  // The villages within walking reach of village v (hoursBetween finite: by land, within ROUTE.reach; v itself first), and their living:
  // the pool of v's round, built from those villages' households, not from the island's living filtered. A pawn of no household is in no
  // village's pool. One table read a village, and a member read a pawn of the pool (counted as `roundWalk` by sim/lifecycle).
  function poolFor(st, v) {
    const out = [],
      n = st.villages.length;
    for (let k = -1; k < n; k++) {
      const u = k < 0 ? v : k;
      if ((k >= 0 && u === v) || hoursBetween(st, v, u) === Infinity) continue;
      for (const fid of st.villages[u].farmsteads) {
        const h = st.farmsteads[fid].household,
          hh = h === null ? null : st.households[h];
        if (!hh || hh.dissolved) continue;
        for (const id of hh.members) if (st.pawns[id].alive) out.push(id);
      }
    }
    return out;
  }
  // The villages' term of the score for two villages (ids): MARRIAGE.sameVillage within one, falling as exp(-hours / nearHours) with the
  // walking hours between their greens (the tie's own scale), 0 beyond reach or over the sea; one table read.
  const nearTerm = (st, a, b) =>
    a === null || b === null ? 0 : MARRIAGE.sameVillage * Math.exp(-hoursBetween(st, a, b) / MARRIAGE.nearHours);
  // The score of man m and woman f (pawns) with `noise` in 0..1 of its amplitude: the ages' gap, the walking hours between their villages,
  // the noise and the two's opinions of each other.
  function matchScore(st, m, f, noise, widowed) {
    const gw = widowed ? MARRIAGE.widowedGapWeight : MARRIAGE.gapWeight;
    return (
      -Math.abs(m.age - f.age - MARRIAGE.ageGap) * gw +
      nearTerm(st, settlementIdOf(st, m), settlementIdOf(st, f)) +
      noise * MARRIAGE.noise +
      (MARRIAGE.liking * (opinionOf(st, m.id, f.id) + opinionOf(st, f.id, m.id))) / 2
    ); // opinion (VB-275)
  }
  // Where each pawn would live if married (placeIfMarried), memoized with the heir rankings it reads (`rank(h)`, heirRanking ranked afresh,
  // VB-277) until `clear()`, which a village's round calls after each marriage or handover it makes: ranking every farm's heirs for every
  // pair of candidates made the round cost about a second at populous medium. `homeFor(m, f, cu)`: where a couple would
  // live, or null. Under 'land' one of them needs a place (the farm they hold or are first heir to). When both have one (VB-153): a holder
  // keeps their farm and a spouse who is only first heir steps out of that line; of two holders, the couple lives where the other farm is
  // best handed on (handOn: an adult heir, then a landless adult of its village, then a child or nobody), then on the farm with more
  // fields, the man's on a tie. Under the other customs the spouse's home counts. `affords(h)`: the means to marry (VB-153): the home
  // holds food above its seed for MARRIAGE.means years of its members and one more, counting grain still in sheaf and the larder, so that
  // marriages fall after a bad harvest (the preventive check). A home with fewer than two adults needs no means: a lone holder, or a
  // widow with small children, needs the spouse's hands. Memoized per household until clear().
  function matchRules(st) {
    const ranks = new Map(),
      places = new Map(),
      handed = new Map(),
      means = new Map();
    const readers = new Map(); // pawn id -> the households whose cached ranking read that pawn
    const rank = (h) => {
      if (!ranks.has(h)) {
        const deps = new Set();
        ranks.set(h, heirRanking(st, st.households[h], null, false, null, deps));
        for (const id of deps) {
          if (readers.has(id)) readers.get(id).add(h);
          else readers.set(id, new Set([h]));
        }
      }
      return ranks.get(h);
    };
    const clear = () => {
      for (const m of [ranks, places, handed, means, readers]) m.clear();
    };
    // After a marriage that moved only `pawns` (neither holds a farm) between households `homes`: the rankings of those homes and of every
    // household whose ranking read one of the pawns are cleared, and the places of the pawns and of the members of the cleared households.
    const touched = (pawns, homes) => {
      const hs = new Set(homes);
      for (const id of pawns) for (const h of readers.get(id) || []) hs.add(h);
      for (const h of hs) ranks.delete(h);
      for (const id of pawns) places.delete(id);
      for (const id of [...places.keys()]) {
        const q = st.pawns[id].household;
        if (q !== null && hs.has(q)) places.delete(id);
      }
      handed.clear();
      means.clear();
    };
    const place = (id) => {
      if (!places.has(id)) {
        const hh = st.households[st.pawns[id].household],
          held = trustOfHolder(st, id); // a holder whose farm is held in trust lives there once married (VB-309)
        places.set(
          id,
          held ? held.household : hh && !hh.dissolved && (hh.holder === id || rank(hh.id)[0] === id) ? hh.id : null,
        );
      }
      return places.get(id);
    };
    const fieldsAt = (h) => st.farmsteads[st.households[h].farmstead].fields.length;
    const handsOnWell = (h) => {
      if (!handed.has(h)) {
        const hh = st.households[h],
          heir = heirFor(st, hh, rank(h), hh.holder),
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
    return { rank, place, homeFor, affords, clear, touched };
  }
  // Why the match of pawns a and b (ids, either sex) may not be made at the round now ({why}), or the match ({man, woman, home}: pawns and
  // a household id). The round's rules: both alive, single, of age, fed, not retired and in no open offer; the woman's village within
  // walking reach of the man's (VB-288); the kin degree the man's village's
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
      if (heldBy(st, p.id, 'match')) return { why: `${nm} is in an open offer` };
    }
    const vm = settlementIdOf(st, m),
      vf = settlementIdOf(st, f);
    if (vm !== null && vf !== null && hoursBetween(st, vm, vf) === Infinity)
      return { why: `${fullName(f)} lives beyond walking reach of ${fullName(m)}'s village` };
    const cu = practice(st, vm);
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
  // The wished matches of village v's round (VB-274, VB-680): of `wishers` ([pawn, the partner it wishes]), those that pass matchBar, by
  // the man's id ({man, woman, home, wisher}), when he is of v; a woman wished by a man of a village whose round comes later is held for
  // him in `taken`. The played pawn's wish counts wherever it lives, since it may name a woman of v's pool (VB-288): `wishers` are those of
  // the pool, and every other pawn's partner is cleared by its own choosing at the round's start (sim/wishes).
  function wishedMatches(st, wishers, v, rules, taken) {
    const out = new Map(),
      pl = st.player ? st.player.pawn : null,
      plWish = pl !== null && st.pawns[pl].alive ? wishOf(st, pl, 'match') : null;
    if (typeof plWish === 'number' && !wishers.some(([w]) => w === pl)) wishers = [...wishers, [pl, plWish]];
    for (const [w, partner] of wishers) {
      const wished = matchBar(st, w, partner, rules),
        wv = wished.man ? settlementIdOf(st, wished.man) : null;
      if (wv === v) out.set(wished.man.id, { ...wished, wisher: w });
      else if (wv !== null && wv > v) taken.add(wished.woman.id);
    }
    return out;
  }
  return { kinOk, poolFor, matchScore, matchRules, matchBar, wishedMatches };
})();

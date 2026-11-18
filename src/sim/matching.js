// @sys sim/matching: the rules of a marriage match: the pool within a day's walk or visited (VB-289), kin degree, a home and its means, the score; what
// the asking (sim/asking), the offer's answers (sim/marriage) and the player's wish for a match (VB-274) are both checked against
VB['sim/matching'] = (() => {
  const { MARRIAGE, DAY, YEAR, SEASON_DAYS, YEAR_DAYS, HUNGER, ASK, TRAVEL } = VB['sim/rules'];
  const { heldBy } = VB['sim/offers'];
  // Who asks in match offer o, and who is asked (VB-693): the man's side asks, unless the offer was made by the woman's (`asker`)
  const askerOf = (o) => (o.asker === 'woman' ? o.wants.woman : o.gives.man);
  const askedOf = (o) => (o.asker === 'woman' ? o.gives.man : o.wants.woman);
  // The open matches pawn id is asked by: up to ASK.held may stand at once (VB-823); and whether it asks in one itself
  const askedBy = (st, id) => st.offers.filter((o) => o.basis === 'match' && askedOf(o) === id).length;
  const asksMatch = (st, id) => st.offers.some((o) => o.basis === 'match' && askerOf(o) === id);
  const { dailyNeed, larderOf } = VB['sim/hunger'],
    { reserved, grainOf } = VB['sim/stores'];
  const { settlementIdOf, kinDegree, wasWidowed, practice, fullName, spouseOf, spousesOf, age } = VB['sim/records'];
  const { heirRanking, heirFor } = VB['sim/heirs'];
  const { trustOfHolder } = VB['sim/ownership'];
  const { opinionOf } = VB['sim/relations'];
  const { hoursBetween, byLand } = VB['sim/routes'];
  const { wishOf } = VB['sim/wishes'];
  const Rules = VB['sim/registry'];

  // ---- the means to marry (VB-153, VB-631; design.md, Marriage, nursing and growth: The setpoint) ----
  // A rule of the registry, `marriage.means`: the years of food a home must hold above its seed for its members and one more. Base
  // MARRIAGE.means, no contribution yet; a later one (a custom, a head's caution, a servant's portion: VB-637) joins with
  // `Rules.contribute({ rule: 'marriage.means', ... })` from its own module, the context the home's household, and shows with its cause in
  // the pawn panel's words through meansOf's `asked`. Its value is moved only in a tuning run.
  Rules.declare({ id: 'marriage.means', owner: 'sim/matching', combine: 'product', base: () => MARRIAGE.means });
  // One formula for the gate (`affords`) and the words (the pawn panel, matchBar's reason): {held, asked, exempt} of household h. held:
  // years of food above the seed for its members and one more (grain, grain in sheaf, meals, the larder, less what is reserved); asked: the
  // rule's value; exempt: fewer than two adults, who need the spouse's hands.
  const fig = (n) => (Math.round(Math.max(0, n) * 10) / 10).toString();
  function meansOf(st, h) {
    const hh = st.households[h],
      store = grainOf(hh) + hh.meals + hh.unthreshed.reduce((a, x) => a + (+x || 0), 0) + larderOf(hh);
    let grown = 0;
    for (const id of hh.members) if (st.pawns[id].alive && st.pawns[id].age >= 18) grown++;
    return {
      held: (store - reserved(st, hh, 'grain')) / (YEAR_DAYS * (dailyNeed(st, hh) + st.ECON.ration.adult)),
      asked: Rules.value(st, 'marriage.means', hh),
      exempt: grown < 2,
    };
  }

  // ---- the rules of a match (the moving round's marriages, and what the player's wish for a match is checked against, VB-274) ----
  // The closest degree each kinLimit option allows; siblings, half-siblings and direct lines (degree 2 or less) never marry.
  const kinOk = (st, a, b, cu, opt = cu.kinLimit) => {
    const d = kinDegree(st, a, b);
    return (
      d > 2 && d >= MARRIAGE.kinDegree[opt] && affinityOk(st, a, b, cu.affinity) && affinityOk(st, b, a, cu.affinity)
    );
  };
  // Kin by marriage (VB-1107): pawn a's spouses, ended unions too, against b as blood kin. 'line' bars a step-child and a parent-in-law (b a
  // direct ancestor or descendant of a spouse of a); 'fourth' bars any of the spouse's blood kin within civil degree MARRIAGE.affinityDegree.
  // Step-siblings are never barred. Reads a's spouses only: no pass over pairs.
  function affinityOk(st, a, b, opt) {
    if (opt === undefined || opt === 'none') return true;
    const limit = opt === 'fourth' ? MARRIAGE.affinityDegree : 0;
    for (const s of spousesOf(st, a)) if (s !== b && kinDegree(st, s, b) <= limit) return false;
    return true;
  }
  // ---- a day's walk and the visit (VB-289; design.md, Between villages: The suitor's visit) ----
  // The year (floor(t / YEAR)) of the last moving round over by time t: this year's once its last day has ended, else last year's.
  const roundYear = (t) => {
    const y = Math.floor(t / YEAR);
    return t >= y * YEAR + (2 * SEASON_DAYS + ASK.day + ASK.passes) * DAY ? y : y - 1;
  };
  // The village pawn p visited since the last round (pawn.visited, sim/visits), or null.
  const visitOf = (st, p) => (p.visited && p.visited.year === roundYear(st.t) ? p.visited.village : null);
  // Whether man m of village vm and woman f of village vf may be matched across their villages: one village, or two within a day's walk
  // (TRAVEL.dayWalk hours between their greens), or one of the two has visited the other's village since the last round.
  const courts = (st, m, f, vm, vf) =>
    vm === vf || hoursBetween(st, vm, vf) <= TRAVEL.dayWalk || visitOf(st, m) === vf || visitOf(st, f) === vm;
  // ---- the pool and the villages' term (VB-288, VB-289; design.md, Between villages: Ease of mixing) ----
  // The villages within a day's walk of village v (v itself first) and those its living have visited since the last round, and their
  // living: the pool of v's round, built from those villages' households, not from the island's living filtered. A pawn of no household
  // is in no village's pool. One table read a village, and a member read a pawn of the pool (counted as `roundWalk` by sim/lifecycle);
  // and the asking queue read once for the women who came as guests (`guestWalk`).
  function poolFor(st, v) {
    const out = [],
      n = st.villages.length,
      seen = new Set(),
      inPool = new Set();
    for (let k = -1; k < n; k++) {
      const u = k < 0 ? v : k;
      if (k >= 0 && (u === v || !(hoursBetween(st, v, u) <= TRAVEL.dayWalk || (seen.has(u) && byLand(st, v, u)))))
        continue;
      inPool.add(u);
      for (const fid of st.villages[u].farmsteads) {
        const h = st.farmsteads[fid].household,
          hh = h === null ? null : st.households[h];
        if (!hh || hh.dissolved) continue;
        for (const id of hh.members) {
          const p = st.pawns[id];
          if (!p.alive) continue;
          out.push(id);
          if (k < 0 && p.visited && visitOf(st, p) !== null) seen.add(p.visited.village);
        }
      }
    }
    // A woman of a village outside these who has visited v since the last round is in its pool herself (VB-292): her visit
    // is read from her side, as a man's puts her village in his. Read from the asking queue, which holds the unmarried.
    for (const e of st.asking) {
      VB.count.guestWalk++;
      const p = st.pawns[e.pawn];
      if (p.sex !== 'f' || !p.visited || !p.alive || p.household === null || visitOf(st, p) !== v) continue;
      const hh = st.households[p.household];
      if (!hh.dissolved && hh.farmstead !== null && !inPool.has(st.farmsteads[hh.farmstead].village)) out.push(p.id);
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
  // The score of man m and woman f (pawns) as spokesman `by` reads it, who weighs the other side's spokesman `other` (VB-693; plan
  // VB-682, 4.1): matchScore at the ages of now, and MARRIAGE.headsLiking a point of his opinion of the other (0 between strangers,
  // and where one pawn speaks for both). `noise`: the fancy drawn at the asking for the side that asked, its mean for one who answers.
  const sideScore = (st, m, f, noise, by, other) =>
    matchScore(
      st,
      { ...m, age: age(st, m) },
      { ...f, age: age(st, f) },
      noise,
      wasWidowed(st, m.id) || wasWidowed(st, f.id),
    ) + (by === other ? 0 : MARRIAGE.headsLiking * opinionOf(st, by, other));
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
    const homeBy = (m, f, cu, pm = place(m.id), pf = place(f.id)) => {
      if (cu.residence === 'land') return pm !== null && pf !== null ? both(m, f, pm, pf) : pm !== null ? pm : pf;
      return cu.residence === 'husband' ? m.household : f.household;
    };
    // The master's house is no home for a couple (VB-634): where the home would be one a spouse serves in, there is none.
    const homeFor = (m, f, cu, pm, pf) => {
      const h = homeBy(m, f, cu, pm, pf);
      return h !== null && ((m.servant && m.household === h) || (f.servant && f.household === h)) ? null : h;
    };
    const affords = (h) => {
      if (!means.has(h)) {
        const m = meansOf(st, h);
        means.set(h, m.exempt || m.held >= m.asked);
      }
      return means.get(h);
    };
    return { rank, place, homeFor, affords, clear, touched };
  }
  // Why the match of pawns a and b (ids, either sex) may not be made at the round now ({why}), or the match ({man, woman, home}: pawns and
  // a household id). The round's rules: both alive, single, of age, fed, not retired, the man in no open offer and the woman asked by
  // fewer than ASK.held (VB-823); the woman's village within a day's walk of the man's, or visited (VB-288, VB-289); the kin degree the man's village's
  // custom allows; a home that affords it; and a score, with the noise at its mean, that reaches the lowest accepted score.
  function matchBar(st, a, b, rules = matchRules(st), occasion = 'round') {
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
      if (Number.isInteger(p.courting) && p.courting !== (p === m ? f : m).id)
        return { why: `${nm} is courting another` };
      if (!(p.hunger < HUNGER.marryBelow)) return { why: `${nm} is too hungry to marry` };
      if (p === m ? heldBy(st, p.id, 'match') : asksMatch(st, p.id) || askedBy(st, p.id) >= ASK.held)
        return { why: `${nm} is in an open offer` };
      // Service is by the year (VB-634): an offer out of the round waits for the round, when a servant leaves service to marry.
      if (p.servant && occasion !== 'round') return { why: `${nm} is in service until the moving round` };
    }
    const vm = settlementIdOf(st, m),
      vf = settlementIdOf(st, f);
    if (vm !== null && vf !== null && !byLand(st, vm, vf))
      return { why: `${fullName(f)} lives beyond walking reach of ${fullName(m)}'s village` };
    if (vm !== null && vf !== null && !courts(st, m, f, vm, vf))
      return {
        why: `${fullName(f)} lives beyond a day's walk of ${fullName(m)}'s village, and neither has visited the other's`,
      };
    const cu = practice(st, vm);
    if (!kinOk(st, m.id, f.id, cu)) return { why: 'too close kin for the custom of the village' };
    const home = rules.homeFor(m, f, cu);
    if (home === null)
      for (const p of [m, f])
        if (p.servant)
          return {
            why: `${fullName(p)} is in service: ${p.sex === 'm' ? 'his' : 'her'} master's house is no home for a couple`,
          };
    if (home === null) return { why: 'no home for them: neither has a farm to live on' };
    if (!rules.affords(home)) {
      const m = meansOf(st, home);
      return { why: `their home holds ${fig(m.held)} of the ${fig(m.asked)} years of food it needs` };
    }
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
  // What stands between an unmarried pawn of age and a marriage, as the home holds today (counted, no forecast; VB-631), the first that
  // holds: {kind: 'hungry'|'nohome'|'short'|'means'|'hands', held, asked}; null for a pawn that is not unmarried and of age. The home is
  // the place the pawn would live on (the land custom), else its own household, the partner not being known.
  function marryStanding(st, id) {
    const p = st.pawns[id];
    if (!p || !p.alive || spouseOf(st, id) !== null || p.household === null) return null;
    if (age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) return null;
    if (!(p.hunger < HUNGER.marryBelow)) return { kind: 'hungry' };
    const cu = practice(st, settlementIdOf(st, p));
    const home = cu.residence === 'land' ? matchRules(st).place(id) : p.servant ? null : p.household;
    if (home === null) return { kind: 'nohome' };
    const m = meansOf(st, home);
    return { kind: m.exempt ? 'hands' : m.held >= m.asked ? 'means' : 'short', held: m.held, asked: m.asked };
  }
  return {
    kinOk,
    poolFor,
    matchScore,
    sideScore,
    askerOf,
    askedOf,
    askedBy,
    asksMatch,
    matchRules,
    matchBar,
    wishedMatches,
    meansOf,
    marryStanding,
    roundYear,
    courts,
  };
})();

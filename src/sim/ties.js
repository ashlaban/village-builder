// @sys sim/ties [kernel]: familiarity between pawns, its decay scale, kin floor and hours shared at home.
VB['sim/ties'] = (() => {
  const { YEAR, DAY, YEAR_DAYS, SEASON_DAYS } = VB['sim/rules'];
  const { kinNear } = VB['sim/records'];
  const { emit } = VB['sim/events'];
  // @tunable SOCIAL: relationships (docs/review-relationships.md; VB-240, Kim 10 Nov): one pawn's opinion of another (-1..1) is derived:
  // the bond's value (kin, spouse, housemate), plus affinity, affinity.weight * compatibility * min(1, tie / affinity.known), the pair's
  // fixed compatibility shown as the two grow familiar, plus timed memories of things that happened. A memory gains v at each event, up to
  // cap, and fades to 0 over `days` from the last one.
  // Talk (VB-521: by turns): between 6:00 and 22:00 a pawn has a talk turn in the hours where (hour + id) % `every` is 0, four a day; at it,
  // of minAge or more and not carrying a load, it starts a talk at `chance` with one partner sim/encounters finds (`sample` drawn at most
  // outdoors), weighted by (1 + min(tie, 1)) * (1 + opinion), plus the encounter's mix; it may be drawn as a partner in any hour, once.
  // The talk is a chat, a good talk or cross words by weights 1, good * e^(2c) and cross * e^(-2c), c being the pair's compatibility (+kin
  // for kin and housemates): its kind is the bubble's, and leaves no memory. Two unmarried pawns aged within `young` count `youngBonus`
  // times in both the choice and the good talk. A talk adds ties.talk to the tie of both and shows a bubble for `bubbleHours`. closeFriend
  // and enemy: an opinion reaching them is a life event; leaving needs `back` past the line. friend and dislike are the page's words only.
  // seek: chance that an idle pawn walks to someone it likes who idles in its village (of seekSample drawn), rather than to the green or its yard.
  const SOCIAL = {
    situational: { spouse: 0.3, parent: 0.3, child: 0.3, sibling: 0.2, housemate: 0.1 },
    memories: {
      bull: { label: 'Lent us the bull', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/herds: a cow calved by another farm's bull
      border: { label: 'Won the border from us', v: -0.1, cap: -0.3, days: 3 * YEAR_DAYS }, // sim/territory: lost a border dispute to their village (VB-157)
      claim: { label: 'Took our claim', v: -0.15, cap: -0.45, days: 3 * YEAR_DAYS }, // sim/stakes: their household took a stake of ours (VB-158)
      // sim/lifecycle: the pawn refused a match its spokesman made (consent's cost; design.md, Marriage as a negotiation; VB-293)
      ale: { label: 'Poured us ale', v: 0.05, cap: 0.2, days: 3 * YEAR_DAYS }, // sim/occasions: a barrel poured at a wedding or a funeral ale (VB-305)
      refusedMatch: { label: 'Refused the match I made', v: -0.2, cap: -0.4, days: 3 * YEAR_DAYS },
      // sim/courting: a head refused the match of a courting pair; each of the two remembers that head (VB-036; plan VB-682, 4.1)
      refusedCourting: { label: 'Refused our match', v: -0.2, cap: -0.4, days: 3 * YEAR_DAYS },
      // sim/marriage (VB-693; plan VB-682, 4.1): a spokesman, of the spokesman who refused the match he offered (not when hers took a
      // better offer, which is no slight); and one who yielded to a match made for it while it courted another, of its spokesman
      refusedSuit: { label: 'Refused the match I offered', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      marriedAgainst: { label: 'Married me against my wish', v: -0.3, cap: -0.3, days: 5 * YEAR_DAYS },
      // sim/offers: a refusal of goods offered or asked for (VB-690) is a memory of both: the one refused, and, fainter, the one who refused
      refusedUs: { label: 'Refused what we offered', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      refusedThem: { label: 'We refused them', v: -0.05, cap: -0.15, days: YEAR_DAYS },
      // sim/fair: an animal given for food in want (a hard bargain, VB-302), of the one who drove it
      hardBargain: { label: 'Drove a hard bargain with us', v: -0.1, cap: -0.3, days: 3 * YEAR_DAYS },
      // sim/byre: an unherded herd got into the field through a broken stretch of fence; about the holder of the stretch's keeper (VB-136)
      crop: { label: 'Cattle in our crop', v: -0.1, cap: -0.3, days: 2 * YEAR_DAYS },
      // sim/relations: a hand lent gave its hours to another household of its village, both ways with each adult there (VB-106, VB-470; Kim, 10 Nov)
      worked: { label: 'Worked together', v: 0.05, cap: 0.3, days: YEAR_DAYS },
      // sim/workdays: a holder of the village whose household stayed away from a work day; each other holder with a tie to it (VB-120; Kim,
      // 10 Nov: a small negative memory fading over a year; the numbers are the agent's starting values)
      stayedAway: { label: 'Stayed away from the work day', v: -0.05, cap: -0.15, days: YEAR_DAYS },
      // sim/offers: a debtor refused an ask it owed and could meet (VB-707); a breach, felt by the creditor's honour
      brokeFaith: { label: 'Broke faith with us', v: -0.3, cap: -0.6, days: 4 * YEAR_DAYS },
      // sim/relations: cross words that became a quarrel, both ways (VB-520; design.md, The twelve traits: temper)
      quarrel: { label: 'Quarrelled with us', v: -0.1, cap: -0.3, days: YEAR_DAYS },
    },
    talk: {
      from: 6,
      to: 22,
      every: 4,
      chance: 1,
      minAge: 4,
      sample: 8,
      good: 0.15,
      cross: 0.08,
      kin: 0.15,
      young: [16, 30],
      youngBonus: 2,
      bubbleHours: 0.5,
      quarrel: 0.05, // a talk of cross words becomes a quarrel at this times the two tempers' sum (VB-520)
    },
    // Chemistry (VB-520; design.md, Chemistry): a pair's compatibility is personal × the seeded term + likeness × how alike the two are in
    // the four values and sociability (1 alike, 0 at `span`, the mean difference of two drawn at random, -1 at twice that) − friction ×
    // (the two tempers' sum − 1) − customs × the share of customs on which they lean to different options (each weighed by 1 − its
    // malleability), less the age gap, within -1..1. The last term is Like seeks like (Balance loops and targets; Decided, 12 Nov). The
    // design's first weights were 0.7, 0.5, 0.3, 0.3; personal 0.9 and friction 0.4 keep the shares of close friends, friends, dislikes
    // and enemies within a fifth of what they were (VB-520's five runs, populous small seed 7, 3 years).
    chemistry: { personal: 0.9, likeness: 0.5, friction: 0.4, customs: 0.3, span: 0.17 },
    // Familiarity (VB-127; docs/review-relationships.md, proposal B): a tie grows by `talk` a talk (VB-521: 0.8, a longer conversation at
    // four turns a day; it was 0.5), by `home` per 24 waking hours (the talk hours) two housemates spend in their house, counted once a
    // day, and by `work` for each job two pawns finish together; it halves every year. Near kin never fall below `kin`. A pawn keeps at
    // most `cap` ties, the strongest, kin always kept; ties under `forget` are dropped when the pawn's ties are put back on today's scale,
    // every `renorm` years.
    ties: { talk: 0.8, home: 1, work: 0.5, kin: 0.4, rite: 0.25, cap: 150, forget: 0.02, renorm: 4 }, // rite: to the rite's leader (VB-522)
    affinity: { weight: 0.6, known: 8 },
    friend: 0.25,
    dislike: -0.2,
    // VB-1106: at 0.1 one telling in five was a second telling of the same pair (populous small seed 7, 20 years); at 0.2, one in 75,
    // and a close friendship is left where the two are no longer friends (the friend line)
    back: 0.2,
    // The age of account (VB-1106): the lawful age of the Norse and Anglo-Saxon laws, 12, below which a child answered for nothing it
    // did. Between a pawn below it and anyone, chemistry counts only where it is liking (the opinion's affinity is not below 0), and
    // cross words become no quarrel: no memory, no event. A physical fact of childhood, not a custom.
    account: 12,
    closeFriend: 0.45,
    enemy: -0.5,
    seek: 0.5,
    seekSample: 4,
    // Standing as an opinion where there is no tie (VB-706): in an answer to an offer, a stranger is read by its standing above the
    // member's base (`base`, sim/society DEED.base), times `weight` (standing 1 is a member; a holder of a farm is about 1.6), and from another
    // village times `far` (until stories carry it, VB-523, and a tie of villages exists); within -1..1.
    standing: { base: 1, weight: 0.3, far: 0.5 },
  };
  const TIES = SOCIAL.ties;
  // A pawn's ties are stored on its own decay scale: scaleOf puts its stored weights to now (at most 1); tieOf is a's tie to b now.
  const scaleOf = (st, p) => Math.pow(2, (p.tieT - st.t) / YEAR);
  function tieOf(st, a, b) {
    const p = st.pawns[a],
      w = p.ties.get(b);
    return w === undefined ? 0 : w * scaleOf(st, p);
  }
  // A pawn's ties are stored on its own decay scale, so no step decays them (Rules for cost, 3): the tie now is the stored weight halved each
  // year since pawn.tieT (tieOf; Attitudes.dailyStep divides by their sum, so the scale cancels there), put back on today's scale every
  // TIES.renorm years, on a day spread by the pawn's id.
  // @state pawn.ties: Map of other pawn id to a's familiarity with it, stored on a's scale (tieOf); at most TIES.cap, the strongest, kin
  //   always kept. pawn.tieT: game hour from which they halve each year. pawn.homeHours: the waking hours (the talk hours) the pawn has spent
  //   in its house since midnight, counted at its talk turns, SOCIAL.talk.every hours at a time (VB-521). All initialized and changed only here.
  function initTies(st, p) {
    p.ties = new Map();
    p.tieT = st.t;
    p.homeHours = 0;
  }
  VB.counter(
    'walkTies',
    "Ties walked to put a pawn's ties back on today's scale, or to make room under the cap (sim/relations, VB-127)",
  );
  // p's tie to b is stored as w. A new tie at the cap takes the place of the weakest not to kin (the earlier on a tie in weight), unless it is
  // weaker still and not to kin either; then it is not kept.
  function put(st, p, b, w) {
    if (p.ties.size >= TIES.cap && !p.ties.has(b)) {
      const kin = kinNear(st, p.id),
        isKin = kin.includes(b);
      let worst = -1,
        least = Infinity;
      VB.count.walkTies += p.ties.size;
      for (const [j, v] of p.ties)
        if (v < least && !kin.includes(j)) {
          least = v;
          worst = j;
        }
      if (worst < 0 && !isKin) return; // every tie is to kin, none may be dropped, and the new one is not to kin
      if (!isKin && w <= least) return; // not to kin, and no stronger than the weakest that may be dropped
      if (worst >= 0) p.ties.delete(worst); // the weakest that may be dropped goes; kin is kept, over the cap if all are kin
    }
    p.ties.set(b, w);
  }
  function addTie(st, a, b, v) {
    const p = st.pawns[a];
    put(st, p, b, (p.ties.get(b) || 0) + v / scaleOf(st, p));
  } // a's tie to b grows by v
  function raiseTie(st, a, b, v) {
    const p = st.pawns[a],
      w = v / scaleOf(st, p);
    if ((p.ties.get(b) || 0) < w) put(st, p, b, w);
  } // at least v
  // Keep the dead pawn's historical ties, but remove it from its contacts' ties (one who had dropped its own tie to them keeps theirs, read by
  // nobody, until they renormalise).
  function dropTies(st, id) {
    for (const [j] of st.pawns[id].ties) {
      const q = st.pawns[j];
      if (q && q.ties) q.ties.delete(id);
    }
  }
  // p's ties put back on today's scale; those under TIES.forget go, unless to kin (the floor raises them again), and those to the dead
  function renormalise(st, p) {
    const f = scaleOf(st, p),
      kin = kinNear(st, p.id),
      gone = (j, v) => !st.pawns[j].alive || (v < TIES.forget && !kin.includes(j));
    VB.count.walkTies += p.ties.size;
    for (const [j, w] of p.ties) {
      const v = w * f;
      if (gone(j, v)) p.ties.delete(j);
      else p.ties.set(j, v);
    }
    p.tieT = st.t;
    emit(st, 'tiesRenormalised', { pawn: p.id }); // the stories it has forgotten go too (sim/stories, VB-523)
  }
  // Once a day, at midnight: two housemates' tie grows by TIES.home per 24 waking hours both spent in their house (the lesser of their
  // hours); the pawns due put their ties back on today's scale, or raise their near kin to the floor (once a season, spread by id).
  function dailyTies(st, grow, touch) {
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId],
        m = hh.members;
      if (hh.dissolved || m.length < 2) continue;
      VB.count.tiePairs += (m.length * (m.length - 1)) / 2;
      for (let x = 0; x < m.length; x++)
        for (let y = x + 1; y < m.length; y++) {
          const h = (Math.min(st.pawns[m[x]].homeHours, st.pawns[m[y]].homeHours) * TIES.home) / DAY;
          if (h > 0) grow(st, m[x], m[y], h);
        }
    }
    const day = Math.floor(st.t / DAY),
      every = TIES.renorm * YEAR_DAYS;
    VB.count.walkDaily += st.living.length;
    for (const id of st.living) {
      const p = st.pawns[id];
      p.homeHours = 0;
      if ((day - id) % every === 0) renormalise(st, p); // pawn id on day id, and every TIES.renorm years after
      if ((day + id) % SEASON_DAYS === 0)
        for (const q of kinNear(st, id))
          if (st.pawns[q].alive) {
            floorKin(st, id, q);
            touch(st, id, q);
          }
    }
  }
  // a's tie to its near kin b is raised to the floor and a season's fading: so it stays at the floor or above until a's next turn
  function floorKin(st, a, b) {
    raiseTie(st, a, b, TIES.kin * Math.pow(2, SEASON_DAYS / YEAR_DAYS));
  }
  function countHomeHours(p) {
    p.homeHours += SOCIAL.talk.every;
  }
  return {
    SOCIAL,
    initTies,
    scaleOf,
    tieOf,
    addTie,
    raiseTie,
    dropTies,
    renormalise,
    dailyTies,
    floorKin,
    countHomeHours,
  };
})();

// @sys sim/ties: familiarity between pawns, its decay scale, kin floor and hours shared at home.
VB['sim/ties'] = (() => {
  const { YEAR, DAY, YEAR_DAYS, SEASON_DAYS, SOCIAL } = VB['sim/rules'];
  const { kinNear } = VB['sim/records'];
  const TIES = SOCIAL.ties;
  // A pawn's ties are stored on its own decay scale: scaleOf puts its stored weights to now (at most 1); tieOf is a's tie to b now.
  const scaleOf = (st, p) => Math.pow(2, (p.tieT - st.t) / YEAR);
  function tieOf(st, a, b) {
    const p = st.pawns[a],
      w = p.ties.get(b);
    return w === undefined ? 0 : w * scaleOf(st, p);
  }
  // A pawn's ties are stored on its own decay scale, so no step decays them (Rules for cost, 3): the tie now is the stored weight halved each
  // year since pawn.tieT (tieOf; Culture.dailyStep divides by their sum, so the scale cancels there), put back on today's scale every
  // TIES.renorm years, on a day spread by the pawn's id.
  // @state pawn.ties: Map of other pawn id to a's familiarity with it, stored on a's scale (tieOf); at most TIES.cap, the strongest, kin
  //   always kept. pawn.tieT: game hour from which they halve each year. pawn.homeHours: the waking hours (the talk hours) the pawn has spent
  //   in its house since midnight, counted at its talk turns, SOCIAL.talk.every hours at a time (VB-521). All initialized and changed only here.
  function initTies(st, p) {
    p.ties = new Map();
    p.tieT = st.t;
    p.homeHours = 0;
  }
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
  // Put older saves' ties on the current scale and enforce the cap and kin floor.
  function migrateTies(st) {
    for (const p of st.pawns)
      if (p.ties && p.tieT === undefined) {
        p.tieT = st.t;
        p.homeHours = 0;
        if (p.alive && p.ties.size > TIES.cap) {
          const old = [...p.ties];
          p.ties = new Map();
          for (const [j, w] of old) put(st, p, j, w);
        }
        if (p.alive) for (const q of kinNear(st, p.id)) if (st.pawns[q].alive) floorKin(st, p.id, q);
      }
  }
  return {
    initTies,
    scaleOf,
    tieOf,
    addTie,
    raiseTie,
    dropTies,
    renormalise,
    dailyTies,
    floorKin,
    migrateTies,
    countHomeHours,
  };
})();

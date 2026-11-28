// @sys sim/followers [social]: whom a pawn looks to (VB-708; design.md, Patronage; Kim, 16 Nov: followers are dependants): pawn.looksTo over a table
//   of bonds (goodwill owed above PATRON.above, service; later a tenancy and days owed add rows), the live index of followers by lord, a
//   tie begun and broken (its bond ended, or the lord failed the follower), and the standing term by followers
VB['sim/followers'] = (() => {
  const { YEAR_DAYS, YEAR, DAY, SEASON_DAYS, cal } = VB['sim/rules'];
  const Obligations = VB['sim/obligations'];
  const Rules = VB['sim/registry'];
  const { balance, remember } = VB['sim/relations'];
  const { SOCIAL } = VB['sim/ties'];
  const { dailyNeed } = VB['sim/hunger'];
  const { log, fullName, atHousehold, holdingOf, settlementIdOf } = VB['sim/records'];
  const { on, emit } = VB['sim/events'];
  // @tunable PATRON: the tie of a follower to its lord (VB-708; design.md, Balance loops and targets, Patronage)
  // `above`: a pawn that owes another of its village more goodwill than this many days of its household's need holds a patron's bond to it
  // (design.md: 30), weighing owed / (above x need), at most `most`. `service`: a servant's bond to the holder of its household, weight 1.
  // `standing`: a lord's standing gains this much a weight of a follower's bond, and its followers' own term at `discount` (a lord of lords
  // stands higher). `lean`: a follower's lean to its lord's side, a share of its attitude at a village's meeting, and a term of its
  // ballot for the alderman. `duty`: days of the follower's household's need a lord adds to what it would give its follower (the lord's
  // duty), and `yes` the days a follower adds to what it gives its lord (its yes weighed with the tie). Named estimates, no source (VB-708).
  // `ballot`: a follower's term for its lord on the alderman's ballot, on that ballot's scale (opinion plus standing), apart from `lean`.
  // `days`: the days of work a client household owes its patron's household each year the tie holds (VB-464; design.md: 2), which do not
  // pay the balance down.
  const PATRON = {
    days: 2,
    above: 30,
    most: 3,
    service: 1,
    standing: 0.1,
    discount: 0.5,
    lean: 0.3,
    ballot: 0.3,
    duty: 20,
    yes: 10,
  };
  // a breach towards a follower: the lord refused what he could give (VB-707's kind of memory; TRAITS.breach lists it)
  Object.assign(SOCIAL.memories, {
    failedUs: { label: 'Failed us in need', v: -0.3, cap: -0.6, days: 4 * YEAR_DAYS },
  });
  // allowance's tie term (VB-708): a lord gives his follower PATRON.duty days of its household's need more (the lord's duty), a follower
  // its lord PATRON.yes days more (its yes weighed with the tie). The receiver's household's need, as the goodwill term's limit.
  Rules.contribute({
    rule: 'allowance',
    source: 'sim/followers',
    key: 'patron',
    label: 'Lord and follower',
    tunables: ['PATRON.duty', 'PATRON.yes'],
    value: (st, c) => {
      if (c.giver === null || c.receiver === null) return 0;
      const days =
        lordOf(st, c.receiver) === c.giver ? PATRON.duty : lordOf(st, c.giver) === c.receiver ? PATRON.yes : 0;
      return days ? days * dailyNeed(st, c.to) : 0;
    },
  });
  // @state pawn.looksTo: the living pawn this pawn looks to, its lord, or null/absent; written only here. Never itself, never in a cycle.
  // @state st.followers: Map of lord id -> Set of the ids looking to it; a cache owned here, derived, not saved (sim/saves DERIVED), built
  //   at its first use
  function index(st) {
    if (st.followers) return st.followers;
    const m = new Map();
    for (const id of st.living) {
      const l = st.pawns[id].looksTo;
      if (l === null || l === undefined) continue;
      if (!m.has(l)) m.set(l, new Set());
      m.get(l).add(id);
    }
    return (st.followers = m);
  }
  const lordOf = (st, id) => {
    const l = st.pawns[id].looksTo;
    return l === null || l === undefined ? null : l;
  };
  const followersOf = (st, id) => index(st).get(id) || EMPTY;
  // in id order, so a loaded run (whose index is built in id order) walks them as a run that never stopped
  const byId = (st, id) => [...followersOf(st, id)].sort((x, y) => x - y);
  // whether id remembers that lord failed it in need (failedUs, not yet faded): it does not look to him again while it does
  const failedBy = (st, id, lord) => {
    const r = st.pawns[id].rel && st.pawns[id].rel.get(lord),
      m = r && r.mem.failedUs;
    return !!m && st.t - m.t < SOCIAL.memories.failedUs.days * DAY;
  };
  const EMPTY = new Set();
  const householdOf = (st, p) => (p.household === null ? null : st.households[p.household]);
  VB.counter(
    'followerBonds',
    "A pawn's balances and followers read for its ties, at its lord's planning days after harvest (sim/followers, VB-708)",
  );
  // ---- the table of bonds: each row the weight of id's bond to lord (0: none), and the lords it may hold one to ----
  // A patron is of the follower's village (design.md: a household of the village); a servant's master is the holder of its household.
  const BONDS = [
    {
      kind: 'patron',
      weight: (st, id, lord) => {
        const p = st.pawns[id],
          hh = householdOf(st, p),
          q = st.pawns[lord];
        if (!hh || !q.alive || settlementIdOf(st, p) !== settlementIdOf(st, q)) return 0;
        const owed = -balance(st, id, lord),
          mark = PATRON.above * dailyNeed(st, hh);
        return mark > 0 && owed > mark ? Math.min(PATRON.most, owed / mark) : 0;
      },
      lords: (st, id) => {
        const g = st.pawns[id].goodwill,
          out = [];
        if (g) for (const j of g.keys()) if (balance(st, id, j) < 0) out.push(j);
        VB.count.followerBonds += g ? g.size : 0;
        return out;
      },
    },
    {
      kind: 'service',
      weight: (st, id, lord) => {
        const p = st.pawns[id],
          hh = householdOf(st, p);
        return p.servant && hh && !hh.dissolved && hh.holder === lord && lord !== id ? PATRON.service : 0;
      },
      lords: (st, id) => {
        const hh = householdOf(st, st.pawns[id]);
        return st.pawns[id].servant && hh && hh.holder !== null ? [hh.holder] : [];
      },
    },
  ];
  // id's bond to lord, the weightiest row: {kind, w}, or null
  function bondTo(st, id, lord) {
    let best = null;
    for (const b of BONDS) {
      const w = b.weight(st, id, lord);
      if (w > 0 && (!best || w > best.w)) best = { kind: b.kind, w };
    }
    return best;
  }
  // id's weightiest bond over all its lords (its balances, at most GOODWILL.cap, and its master): {lord, kind, w}, or null
  function weightiest(st, id) {
    let best = null;
    for (const b of BONDS)
      for (const lord of b.lords(st, id)) {
        if (lord === id || !st.pawns[lord].alive || failedBy(st, id, lord)) continue;
        const w = b.weight(st, id, lord);
        if (w > 0 && (!best || w > best.w || (w === best.w && lord < best.lord))) best = { lord, kind: b.kind, w };
      }
    return best;
  }
  VB.counter('followerWalk', 'Steps up a chain of lords, to refuse a cycle (sim/followers, VB-708)');
  // whether lord's chain of lords reaches id (a tie id -> lord would close a cycle); no cap on depth
  function reaches(st, lord, id) {
    for (let x = lord, n = 0; x !== null; x = lordOf(st, x), n++) {
      VB.count.followerWalk++;
      if (x === id || n > st.pawns.length) return true;
    }
    return false;
  }
  // the household's head, whose lord its members follow (a holder; else none)
  const headOf = (st, p) => {
    const hh = householdOf(st, p);
    return hh && !hh.dissolved && hh.holder !== null && hh.holder !== p.id ? hh.holder : null;
  };
  // id looks to lord (or to nobody, null): the index follows
  function setLord(st, id, lord) {
    const p = st.pawns[id],
      was = lordOf(st, id),
      idx = index(st);
    if (was === lord) return;
    if (was !== null) {
      const s = idx.get(was);
      s.delete(id);
      if (!s.size) idx.delete(was);
    }
    p.looksTo = lord;
    if (lord !== null) {
      if (!idx.has(lord)) idx.set(lord, new Set());
      idx.get(lord).add(id);
    }
  }
  // A tie's event (kind 'follower') holds in `reason` its bond's kind when begun (patron, service), or a key of WHY when it ended.
  const WHY = {
    failed: 'refused it in need',
    faded: 'what it owed faded under the mark',
    met: 'its debt was met',
    serviceEnded: 'its service ended',
    moved: 'it left the village',
    died: 'its lord died',
    gone: 'it died',
  };
  VB.counter('followerTies', 'Ties of a follower to a lord begun (sim/followers, VB-708)');
  // A tie begun by a bond of id's own: told, and the lord's standing at once
  function begin(st, id, b) {
    setLord(st, id, b.lord);
    const p = st.pawns[id],
      hh = householdOf(st, p);
    VB.count.followerTies++;
    log(
      st,
      `${fullName(p)} now looks to ${fullName(st.pawns[b.lord])} (${b.kind === 'service' ? 'in service' : 'in his debt'}).`,
      { kind: 'follower', pawn: id, other: b.lord, reason: b.kind, ...(hh ? atHousehold(st, hh) : {}) },
    );
    emit(st, 'tieChanged', { follower: id, lord: b.lord });
    follow(st, id);
  }
  // A tie of id's own ended, `why` a key of WHY: told, and those of its household who followed it through their head go with it
  function end(st, id, why) {
    const lord = lordOf(st, id),
      p = st.pawns[id],
      hh = householdOf(st, p);
    setLord(st, id, null);
    if (p.alive || why === 'gone')
      log(st, `${fullName(p)} looks to ${fullName(st.pawns[lord])} no longer: ${WHY[why]}.`, {
        kind: 'follower',
        pawn: id,
        other: lord,
        reason: why,
        ...(hh ? atHousehold(st, hh) : {}),
      });
    emit(st, 'tieChanged', { follower: id, lord });
    if (hh && hh.holder === id)
      for (const m of hh.members) if (m !== id && lordOf(st, m) === lord && !bondTo(st, m, lord)) setLord(st, m, null);
  }
  // A household's members look where its head does unless they hold a bond of their own (a servant looks to its master).
  function follow(st, head) {
    const hh = householdOf(st, st.pawns[head]);
    if (!hh || hh.holder !== head) return;
    const lord = lordOf(st, head);
    for (const m of hh.members) {
      const q = st.pawns[m];
      if (m === head || !q.alive) continue;
      const l = lordOf(st, m);
      if (l !== null && l !== lord && bondTo(st, m, l)) continue; // a bond of its own
      if (lord === null || lord === m || reaches(st, lord, m)) {
        if (l !== null && !bondTo(st, m, l)) setLord(st, m, null);
      } else setLord(st, m, lord);
    }
  }
  // Why id's tie to its lord no longer holds, or null while it holds: a bond of its own, or its head's tie it follows.
  function broken(st, id, lord) {
    const p = st.pawns[id],
      q = st.pawns[lord];
    if (!q.alive) return 'died';
    if (bondTo(st, id, lord)) return null;
    const h = headOf(st, p);
    if (h !== null && lordOf(st, h) === lord) return null;
    if (settlementIdOf(st, p) !== settlementIdOf(st, q)) return 'moved';
    const lh = holdingOf(st, lord);
    if (lh && p.household === lh.id) return 'serviceEnded';
    return -balance(st, id, lord) > 0 ? 'faded' : 'met';
  }
  // The lord's planning day after harvest (and where a bond ends): its followers' ties looked at, each broken whose bond has ended; then
  // those bound to it with no lord take the lord of their weightiest bond, unless that closes a cycle; the heads' members follow them.
  // Over its followers, its balances (at most GOODWILL.cap) and its household's members.
  function review(st, lord) {
    for (const f of byId(st, lord)) {
      VB.count.followerBonds++;
      if (lordOf(st, f) !== lord) continue; // gone with its head's tie
      const why = broken(st, f, lord);
      if (why !== null) end(st, f, why);
    }
    const cands = new Set();
    const g = st.pawns[lord].goodwill;
    if (g) for (const j of g.keys()) if (balance(st, lord, j) > 0) cands.add(j);
    const hh = holdingOf(st, lord);
    if (hh) for (const m of hh.members) if (st.pawns[m].servant) cands.add(m);
    for (const j of cands) take(st, j);
    for (const f of byId(st, lord)) follow(st, f);
    owePatronDays(st, lord);
  }
  // ---- a client's days (VB-464; design.md, Patronage) ----
  // @state household.clientIn: the year (game years since the start) in which the household, its holder a client, was last made to owe
  //   its patron's household PATRON.days days; absent until then. Written only here: one owing a year, however many planning days.
  // @notstock household.clientIn: ledgers and statistics of what moved (sim/stores, sim/hunger)
  const AUTUMN = 2;
  const nextAutumn = (t) => (Math.floor(t / YEAR) + 1) * YEAR + AUTUMN * SEASON_DAYS * DAY;
  // A client: a holder whose own tie to lord is the patron's bond (goodwill owed above PATRON.above days of its household's need), lord a
  // holder of another household
  function isClient(st, f, lord) {
    const hh = householdOf(st, st.pawns[f]),
      lh = holdingOf(st, lord);
    return (
      !!hh &&
      !!lh &&
      !hh.dissolved &&
      hh.holder === f &&
      hh.id !== lh.id &&
      lordOf(st, f) === lord &&
      BONDS[0].weight(st, f, lord) > 0
    );
  }
  VB.counter(
    'patronDays',
    "Client households made to owe their patron's household its days, once a year each (sim/followers, VB-464)",
  );
  // On the patron's planning day after harvest, each client household owes the patron's household PATRON.days days, source `patron`
  // (laid by the verb levy, its days asked and named in sim/levies), to the next autumn, once a year; the days are work, not
  // goodwill, so the balance stands as it was. Nothing
  // of the tie is stored but looksTo: the balance's decay ends the bond, the tie and next year's days. Over the lord's followers.
  function owePatronDays(st, lord) {
    const lh = holdingOf(st, lord);
    if (!lh || lh.dissolved) return;
    const year = Math.floor(st.t / YEAR);
    for (const f of byId(st, lord)) {
      VB.count.followerBonds++;
      if (!isClient(st, f, lord)) continue;
      const hh = householdOf(st, st.pawns[f]);
      if (hh.clientIn === year) continue;
      hh.clientIn = year;
      const live = Obligations.due(st, { kind: 'household', id: lh.id }, 'creditor', 'days').some(
        (o) => o.source === 'patron' && o.debtor.id === hh.id,
      );
      if (live) continue;
      // laid by the patron's household's holder through the verb levy, its days asked as the keep's are (sim/levies, VB-1767)
      if (lh.holder === null) continue;
      const done = VB['sim/commands'].issue(st, {
        actor: lh.holder,
        verb: 'levy',
        args: { debtor: { kind: 'household', id: hh.id }, source: 'patron', days: PATRON.days, due: nextAutumn(st.t) },
        source: 'planner',
      });
      if (done !== true) continue;
      VB.count.patronDays++;
    }
  }
  // For the household's panel (VB-464): its holder's patron {lord, days} when a client, and the client households of its holder
  function clientOf(st, hh) {
    const f = hh.holder;
    if (f === null || f === undefined || !st.pawns[f].alive) return null;
    const lord = lordOf(st, f);
    return lord !== null && isClient(st, f, lord) ? { lord, days: PATRON.days } : null;
  }
  function clientsOf(st, hh) {
    const lord = hh.holder;
    if (lord === null || lord === undefined || !st.pawns[lord].alive) return [];
    return byId(st, lord)
      .filter((f) => isClient(st, f, lord))
      .map((f) => st.pawns[f].household);
  }
  // j, with no lord of its own bond, looks to the lord of its weightiest; it does not change lord while a bond holds (Kim: only when the
  // tie breaks). One that follows its head through no bond of its own takes its own lord when it has a bond.
  function take(st, j) {
    const p = st.pawns[j];
    if (!p.alive || p.age < 16) return;
    const l = lordOf(st, j);
    if (l !== null && bondTo(st, j, l)) return;
    const b = weightiest(st, j);
    if (!b || b.lord === l || reaches(st, b.lord, j)) return;
    if (l !== null) setLord(st, j, null);
    begin(st, j, b);
  }
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || cal(st.t).season < 2) return; // after harvest: autumn and winter
    const hh = st.households[d.plan.holder.id];
    if (hh.dissolved || hh.holder === null || hh.holder === undefined || !st.pawns[hh.holder].alive) return;
    review(st, hh.holder);
  });
  // A death: its followers look to nobody, the dead to nobody.
  on('died', (st, d) => {
    const id = d.pawn;
    for (const f of byId(st, id)) {
      const own = !!bondTo(st, f, id) || headOf(st, st.pawns[f]) === null;
      if (own) end(st, f, 'died');
      else setLord(st, f, null);
    }
    // its own tie ends, told (its members who followed it through no bond of their own go with it); one through its head, quietly
    const lord = lordOf(st, id);
    if (lord !== null) {
      const h = headOf(st, st.pawns[id]);
      if (bondTo(st, id, lord) || h === null || lordOf(st, h) !== lord) end(st, id, 'gone');
      else setLord(st, id, null);
    }
  });
  // Where a bond ends (VB-708): a follower that pays its lord back, at once, not at his next planning day.
  on('goodwillBooked', (st, d) => {
    if (lordOf(st, d.creditor) !== d.debtor) return;
    const why = broken(st, d.creditor, d.debtor);
    if (why !== null) end(st, d.creditor, why);
  });
  VB.counter('followerFailed', 'Ties broken by a lord who refused his follower in need (sim/followers, VB-708)');
  // A lord who refuses his follower what he could give above his floor fails it: the tie breaks, and the follower remembers a breach.
  on('askRefused', (st, d) => {
    if (lordOf(st, d.asker) !== d.by) return;
    VB.count.followerFailed++;
    remember(st, d.asker, d.by, 'failedUs');
    end(st, d.asker, 'failed');
  });
  // The standing term by followers (VB-708): each follower by its bond's weight, plus its own followers' at PATRON.discount, so a lord
  // of lords stands higher. Only a tie of the follower's own counts (a household's members following their head count through it).
  function followerTerm(st, id, depth = 0) {
    let s = 0;
    for (const f of byId(st, id)) {
      VB.count.followerWalk++;
      const b = bondTo(st, f, id);
      if (!b) continue;
      s += b.w + (depth < 32 ? PATRON.discount * (followerTerm(st, f, depth + 1) / PATRON.standing) : 0);
    }
    return PATRON.standing * s;
  }
  // a pawn's followers of its own bond, for the page and the tools: [{id, kind, w}]
  function followers(st, id) {
    const out = [];
    for (const f of followersOf(st, id)) {
      const b = bondTo(st, f, id);
      if (b) out.push({ id: f, kind: b.kind, w: b.w });
    }
    return out.sort((a, b) => a.id - b.id);
  }
  // the depth of id's chain of lords (0: looks to nobody)
  function depthOf(st, id) {
    let n = 0;
    for (let x = lordOf(st, id); x !== null && n <= st.pawns.length; x = lordOf(st, x)) n++;
    return n;
  }
  return {
    PATRON,
    BONDS,
    index,
    lordOf,
    bondTo,
    weightiest,
    review,
    take,
    followerTerm,
    followers,
    depthOf,
    reaches,
    owePatronDays,
    clientOf,
    clientsOf,
  };
})();

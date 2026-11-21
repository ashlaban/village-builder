// @sys sim/lifecycle: deaths (the day's death rolls, killPawn), retirement, and the daily life step (ages, a holder's birthday told as the
//   event holderYear, coming of age, orphans, ties);
//   the village meetings are sim/meetings, the moving round sim/round, marriage and its offers sim/marriage (VB-876)
VB['sim/lifecycle'] = (() => {
  const { holdingOf, living } = VB['sim/records'];
  const { register } = VB['sim/commands'];
  const { emit } = VB['sim/events'];
  const { TRAITS, DAY, YEAR } = VB['sim/rules'];
  const { dayOfDeath, CAUSES, COLD } = VB['sim/deaths'];
  const { leaveHousehold, unionOf, noteDeath, log, age, fullName, noteUnionEnd, atHousehold, lifeEvent, isHolder } =
    VB['sim/records'];
  const { setAtAge } = VB['sim/traits'];
  const { stillAtDeath, travelling, tileAt, placeOf } = VB['sim/agents'];
  const { heirRanking, successorOf, transfer, succession, comeOfAge, refreshRoles } = VB['sim/heirs'];
  const { careForOrphans } = VB['sim/service'];
  const { refreshStanding } = VB['sim/society'];
  const { playerDied, clearMatchWish } = VB['sim/player'];
  const { forget, dropTies, dailyTies, endGoodwill } = VB['sim/relations'];
  const { funeral } = VB['sim/occasions'];
  const { closeTrust, wardsOfAge, inheritedHeld } = VB['sim/trust'],
    { trustOfHolder } = VB['sim/ownership'];
  function killPawn(st, id, cause = 'killed') {
    const p = st.pawns[id];
    if (!p.alive) return;
    p.died = st.t;
    p.alive = false;
    emit(st, 'died', { pawn: id }); // its kin grieve (sim/mood, VB-062), before the death ends its union
    p.kinPush = null; // the round's pushes are cleared on the living only (VB-277)
    p.interest = null; // and its interests, which the village's meeting refreshes for the living only (VB-278)
    noteDeath(st, id);
    const a = st.agents[id],
      road = travelling(a) ? tileAt(st, ...placeOf(st, a)) : null; // it dies where it fell on the road (VB-287)
    stillAtDeath(st, a);
    clearMatchWish(st, id, id);
    playerDied(st, id, successorOf); // the player's pawn: its farm, spouse and friends are noted before the death erases them (VB-213)
    const u = unionOf(st, id);
    if (u) {
      u.end = st.t;
      noteUnionEnd(st, u);
    }
    dropTies(st, id);
    if (p.rel) forget(st, id);
    // a death in a cold house is told so (VB-327); the cause is the cause, the cold having lowered the health the hazard reads
    const cold = p.household !== null && st.households[p.household].cold > 0;
    lifeEvent(
      st,
      id,
      log(
        st,
        `${fullName(p)} of ${p.household !== null ? st.farmsteads[st.households[p.household].farmstead].name : 'the island'} ` +
          `${CAUSES[cause].log}${cold ? COLD : ''}, aged ${p.age}${road !== null ? ', on the road' : ''}.`,
        {
          kind: 'died',
          pawn: id,
          text: cause,
          ...(cold ? { cold: true } : {}),
          ...(p.household !== null ? atHousehold(st, st.households[p.household]) : {}),
          ...(road !== null ? { tile: road } : {}),
        },
      ),
    );
    funeral(st, id); // the next day's funeral ale, at the farm it leaves (sim/occasions, VB-126)
    const hh = p.household !== null ? st.households[p.household] : null;
    if (hh) {
      leaveHousehold(st, id, true);
      if (hh.holder === id) succession(st, hh, 'death');
    }
    const held = trustOfHolder(st, id); // a farm held in trust for it (VB-309): the trust ends, and succession as today
    if (held) {
      closeTrust(st, held, 'death');
      succession(st, st.households[held.household], 'death');
    }
    inheritedHeld(st);
    endGoodwill(st, id); // after succession, which passes a holder's share on
    refreshRoles(st);
    refreshStanding(st);
    st.visualDirty = true;
  }
  function retireHolder(st, hhId) {
    const hh = st.households[hhId];
    if (!hh || hh.dissolved) return false;
    const r = heirRanking(st, hh);
    if (!r.length) return false;
    transfer(st, hh, r[0], 'retirement');
    inheritedHeld(st);
    refreshRoles(st);
    refreshStanding(st);
    return true;
  }

  function dailyLife(st) {
    VB.count.walkDaily += st.living.length;
    let holders = null;
    for (const id of st.living) {
      const p = st.pawns[id];
      p.age = age(st, p);
      if (typeof p.leanDays === 'number' && p.age >= TRAITS.setAge) setAtAge(st, id); // its values set for good (sim/traits, VB-519)
      if ((st.t - p.born) % YEAR < DAY && isHolder(st, id)) (holders || (holders = [])).push(id);
    }
    // a holder's birthday: its day to consider handing the farm on (sim/asking, VB-824)
    if (holders) for (const id of holders) emit(st, 'holderYear', { pawn: id });
    comeOfAge(st);
    wardsOfAge(st); // a ward of 18 goes back to the farm held in trust for it (sim/trust, VB-309)
    careForOrphans(st); // a household with no adult left takes in a guardian (sim/service)
    dailyTies(st);
  }
  // The day's death rolls, after the season's fading of relations (sim/clock, CALENDAR: dailyDeaths, while st.naturalDeaths).
  function dailyDeaths(st) {
    VB.count.walkDaily += st.living.length;
    // Death splices the live index; visit the original ids once, in the original order.
    for (const id of st.living.slice()) {
      const p = st.pawns[id];
      if (p.alive) {
        const cause = dayOfDeath(st, p);
        if (cause) killPawn(st, p.id, cause);
      }
    }
  }
  // ---- debug actions (source 'debug') ----
  register('kill', {
    check: (st, c) => living(st, c.actor),
    run: (st, c) => killPawn(st, c.actor, 'killed'),
  });
  // retire: a holder hands the farm to the first heir
  register('retire', {
    check: (st, c) => {
      const dead = living(st, c.actor);
      if (dead) return dead;
      const hh = holdingOf(st, c.actor);
      return !hh || hh.dissolved
        ? `pawn ${c.actor} holds no farm`
        : !heirRanking(st, hh).length
          ? 'the farm has no heir'
          : null;
    },
    run: (st, c) => retireHolder(st, holdingOf(st, c.actor).id),
  });
  return {
    killPawn,
    retireHolder,
    dailyLife,
    dailyDeaths,
  };
})();

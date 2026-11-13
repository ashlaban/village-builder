// @sys sim/lifecycle: deaths, retirement, village meetings, the moving round and its marriage offers, and the daily life step
// @state st.offers[]: the open marriage offers (VB-293; planned to move to slice 5's Decisions), sorted by due, each {id, man, woman (pawn
//   ids), home (the household they would live in), village (the man's settlement), made, due (made + MARRIAGE.offerDays days; game hours),
//   answers[] ({key: 'man' | 'woman' | 'manSide' | 'womanSide', by (the one to marry, or its spokesman when the offer was made), yes: null
//   | true | false})}. Only offers that wait for the player's answer are kept, so with no player it stays empty. Plain data, saved.
// @state st.offerSeq: number; the next offer's id; ids are never reused
VB['sim/lifecycle'] = (() => {
  const { next: rnd, drawer } = VB['sim/rng'];
  const Culture = VB['culture'];
  const { landMeeting } = VB['sim/territory'];
  const { DAY, YEAR_DAYS, YEAR, cal, HUNGER, MARRIAGE, SOCIAL } = VB['sim/rules'];
  const { dailyNeed, larderOf } = VB['sim/hunger'],
    { reserved } = VB['sim/stores'];
  const { deathRoll, CAUSES, COLD } = VB['sim/deaths'];
  const {
    leaveHousehold,
    unionOf,
    wasWidowed,
    noteDeath,
    personEvent,
    log,
    age,
    fullName,
    spouseOf,
    kinDegree,
    settlementIdOf,
    practice,
    farmPractice,
    noteUnionEnd,
    holdingOf,
    atHousehold,
    lifeEvent,
    spokesmanOf,
    membersOf,
    voiceOf,
  } = VB['sim/records'];
  const { chooseRoutines, VILLAGE_ROUTINES } = VB['sim/plans'];
  const { stillAtDeath, travelling, tileAt, journeyOf } = VB['sim/agents'];
  const {
    heirRanking,
    moveTo,
    transfer,
    succession,
    comeOfAge,
    refreshRoles,
    countDemand,
    handOn,
    heirFor,
    roundHeirs,
  } = VB['sim/heirs'];
  const { kinOk, matchScore, matchRules, matchBar } = VB['sim/matching'];
  const { startPlots } = VB['sim/expansion'];
  const { claimFarms, claimableFarm } = VB['sim/farmclaims'];
  const { settleRound } = VB['sim/settle'];
  const { careForOrphans, takeServants, serveWhereShort } = VB['sim/service'];
  const { payOwed } = VB['sim/cottage'];
  const { fillStores } = VB['sim/help'];
  const { updateTies, refreshPrestige, refreshInterests, hooks } = VB['sim/society'];
  const { issue, playerDied, clearMatchWish } = VB['sim/commands'];
  const { forget, dropTies, raiseTie, dailyTies, endGoodwill, remember, opinionOf } = VB['sim/relations'];
  const { wedding, funeral } = VB['sim/occasions'];
  function killPawn(st, id, cause = 'killed') {
    const p = st.pawns[id];
    if (!p.alive) return;
    p.died = st.t;
    p.alive = false;
    noteDeath(st, id);
    const a = st.agents[id],
      road = travelling(a) ? tileAt(st, a.x, a.y) : null; // it dies where it fell on the road (VB-287)
    stillAtDeath(st, a);
    clearMatchWish(st, id, id);
    playerDied(st, id); // the player's pawn: its farm, spouse and friends are noted before the death erases them (VB-213)
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
    endGoodwill(st, id); // after succession, which passes a holder's share on
    refreshRoles(st);
    refreshPrestige(st);
    st.visualDirty = true;
  }
  function retireHolder(st, hhId) {
    const hh = st.households[hhId];
    if (!hh || hh.dissolved) return false;
    const r = heirRanking(st, hh);
    if (!r.length) return false;
    transfer(st, hh, r[0], 'retirement');
    refreshRoles(st);
    refreshPrestige(st);
    return true;
  }
  // The year's meetings, in four stages on four 6-minute steps from noon (VB-206, rule 5): the whole-population refreshes, then the ties, then the
  // year's entrepreneurs, each settlement's meeting and each culture's year, then the land meeting. The step of the day says what is due, so a
  // save between two stages goes on; the draws keep their order. `holdMeetings` is the first three at once (the drawer's button, the tests).
  const MEETING_STAGES = 4;
  function meetingStage(st, n) {
    const env = st.cenv,
      hk = hooks(st);
    env.t = st.t / YEAR;
    if (n === 0) {
      refreshRoles(st);
      refreshPrestige(st);
      refreshInterests(st);
      return;
    }
    if (n === 1) {
      updateTies(st);
      return;
    }
    if (n === 3) {
      landMeeting(st);
      return;
    }
    const starters = Culture.entrepreneurs(env, hk, drawer(st.rng.culture));
    for (const p of starters) {
      personEvent(
        st,
        p.id,
        'cause',
        `Took up the cause: ${Culture.DIMS[p.advocate.dim].label.toLowerCase()}, ${Culture.DIMS[p.advocate.dim].opts[p.advocate.opt][1].toLowerCase()}`,
      );
    }
    const c = cal(st.t),
      out = [];
    const held = new Map(); // each village's meeting on its green today (sim/occasions)
    for (const o of st.occasions) if (o.kind === 'meeting' && o.start <= st.t && st.t < o.end) held.set(o.village, o);
    for (const s of env.settlements) {
      const ch = Culture.meeting(env, hk, s);
      for (const x of ch) {
        const d = Culture.DIMS[x.dim],
          txt = `At the ${s.name} meeting: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}” (was “${d.opts[x.from][1]}”).`;
        log(st, txt, { kind: 'custom', village: s.id });
        out.push({ year: c.year, text: txt });
      }
      const txt = routinesMeeting(st, s, held.get(s.id));
      if (txt) out.push({ year: c.year, text: txt });
    }
    for (const cu of env.cultures) {
      const r = Culture.cultureYear(env, hk, cu);
      for (const x of r.changes) {
        const d = Culture.DIMS[x.dim],
          txt = `Across the ${cu.name} culture: ${d.label.toLowerCase()} is now “${d.opts[x.to][1]}”.`;
        log(st, txt, { kind: 'custom', village: cu.centres[0] });
        out.push({ year: c.year, text: txt });
      }
    }
    st.meetingLog.unshift(...(out.length ? out : [{ year: c.year, text: 'The meetings changed nothing this year.' }]));
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
    st.lastMeeting = st.t;
  }
  // The village's routines for the year (VB-257; design.md section 7, Village routines), at its meeting: with a quorum, at least half of
  // those with a voice come to the green (the meeting's occasion, sim/occasions), the meeting chooses from the village work available
  // (sim/plans) and sets them by its verb; without one, or when the choice is tied, it does not decide, and its culture's practice says
  // what follows: no village work this year ('nothing') or last year's again ('asLastYear'), told in the log as a notable event of the
  // village. A village with no one living holds no meeting, and its routines stand. Returns the log's line of a failure, or null.
  const QUORUM = 0.5;
  function routinesMeeting(st, s, o) {
    const v = st.villages[s.id],
      people = membersOf(st, s.id);
    if (!v || !people.length) return null;
    let voices = 0,
      came = 0;
    for (const p of people) if (voiceOf(st, p, s) > 0) voices++;
    if (o) for (const id of o.come) if (st.pawns[id].alive && st.agents[id].occasion === o.id) came++;
    const quorum = voices > 0 && came >= voices * QUORUM,
      list = quorum ? chooseRoutines(st, v) : null;
    if (list) {
      issue(st, {
        actor: { settlement: s.id },
        verb: 'routines',
        args: { routines: list, by: 'meeting' },
        source: 'meeting',
      });
      return null;
    }
    const by = Culture.practiceOf(st.cenv.cultures[s.culture], 'noDecision'),
      plan = st.plans.villages.get(s.id);
    const kept = by === 'asLastYear' ? plan.routines : [];
    issue(st, { actor: { settlement: s.id }, verb: 'routines', args: { routines: kept, by }, source: 'meeting' });
    const why = quorum
      ? "was split evenly over the village's work"
      : `had no quorum (${came} of ${voices} ${voices === 1 ? 'voice' : 'voices'} there)`;
    const work = kept.map((k) => VILLAGE_ROUTINES[k].label.toLowerCase()).join(', ');
    const then =
      by === 'asLastYear'
        ? kept.length
          ? `the village keeps last year's work: ${work}`
          : "the village keeps last year's work, which was none"
        : v.fence.length
          ? 'no village work this year, and the village fence goes unmended'
          : 'no village work this year';
    const txt = `The ${s.name} meeting ${why} and did not decide: ${then}.`;
    log(st, txt, { kind: 'meetingFailed', village: s.id, n: came, of: voices });
    return txt;
  }
  function holdMeetings(st) {
    for (let n = 0; n < MEETING_STAGES - 1; n++) meetingStage(st, n);
  } // not the land meeting
  const kinOpts = Culture.DIMS[Culture.IDX.kinLimit].opts.map((o) => o[0]); // strictest first
  // Scarcity and plenty of spouses push the marriage limit: an adult who finds no allowed partner but would under the next looser
  // option pulls towards it; one who married a partner also allowed under the next stricter option pulls back, at half the weight.
  function kinPressure(st, men, women, taken, homeFor) {
    const env = st.cenv,
      blocked = new Map(),
      at = (cu) => kinOpts.indexOf(cu.kinLimit);
    // Annual historical cleanup also clears the last pressure recorded on people who have since died.
    for (const p of st.pawns) p.kinPush = null;
    const wed = new Map();
    for (const id of st.living) {
      const u = unionOf(st, id);
      if (u && u.start === st.t) wed.set(u.id, u);
    }
    // Unions were visited in record order; retain that order for equal-time remarriages too.
    const pairs = [...wed.values()].sort((a, b) => a.id - b.id);
    wed.clear();
    for (const u of pairs) {
      wed.set(u.a, u.b);
      wed.set(u.b, u.a);
    }
    for (const [x, y] of wed) {
      const cu = practice(st, settlementIdOf(st, st.pawns[x])),
        k = at(cu);
      if (k > 0 && kinOk(st, x, y, cu, kinOpts[k - 1]))
        st.pawns[x].kinPush = { to: kinOpts[k - 1], w: MARRIAGE.plentyPush };
    }
    for (const [mine, others] of [
      [men, women],
      [women, men],
    ]) {
      for (const p of mine) {
        if (taken.has(p.id) || wed.has(p.id)) continue;
        const s = settlementIdOf(st, p);
        if (s === null) continue;
        const cu = practice(st, s),
          k = at(cu);
        if (k >= kinOpts.length - 1) continue;
        const can = (o, opt) =>
          !taken.has(o.id) &&
          (p.sex === 'm' ? homeFor(p, o, cu) : homeFor(o, p, cu)) !== null &&
          kinOk(st, p.id, o.id, cu, opt);
        if (others.some((o) => can(o, cu.kinLimit)) || !others.some((o) => can(o, kinOpts[k + 1]))) continue;
        p.kinPush = { to: kinOpts[k + 1], w: MARRIAGE.scarcePush };
        blocked.set(s, (blocked.get(s) || 0) + 1);
      }
    }
    const c = cal(st.t),
      out = [];
    for (const [s, n] of blocked) {
      const txt = `At the ${env.settlements[s].name} moving round, ${n} adult${n > 1 ? 's' : ''} found no spouse only because of kin.`;
      log(st, txt, { kind: 'kinBarred', village: s, n });
      out.push({ year: c.year, text: txt });
    }
    st.meetingLog.unshift(...out);
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
  }
  // A marriage (the marry command, VB-171): the union, both move to the home household, the event, ties, a spouse who held a farm of
  // their own hands it on (VB-153), and the wedding is called for the next day (VB-126).
  function wed(st, mId, fId, home) {
    const m = st.pawns[mId],
      f = st.pawns[fId];
    st.unions.push({ id: st.unions.length, a: mId, b: fId, start: st.t, end: null, kind: 'marriage' });
    for (const id of [mId, fId]) {
      if (st.pawns[id].household !== home) moveTo(st, id, home);
      personEvent(st, id, 'married', `Married ${fullName(st.pawns[id === mId ? fId : mId])}`, false);
      st.rigDirty.add(id); // recorded below
    }
    const fm = st.farmsteads[st.households[home].farmstead],
      away = [m, f].filter((q) => journeyOf(st, q.id)); // from another village: and sets out for it (VB-287)
    const out = away.length
      ? `, and ${away.map((q) => q.given).join(' and ')} ${away.length > 1 ? 'set' : 'sets'} out for it`
      : '';
    log(st, `${fullName(m)} and ${fullName(f)} marry and live at ${fm.name}${out}.`, {
      kind: 'married',
      pawn: mId,
      other: fId,
      ...atHousehold(st, st.households[home]),
    });
    raiseTie(st, mId, fId, 2);
    raiseTie(st, fId, mId, 2);
    clearMatchWish(st, mId, fId);
    for (const id of [mId, fId]) {
      const own2 = holdingOf(st, id);
      if (own2 && own2.id !== home) handOn(st, own2, id, home);
    }
    wedding(st, mId, fId, home); // the next day's feast at their farm (sim/occasions, VB-126)
  }
  // The moving round (autumn day 10) runs in ROUND_PHASES phases on the 6-minute steps from noon (VB-201), so no step holds all of it:
  // 0, the marriages and the handovers; 1, demand, claims on empty farms and plots; 2, settlement; 3, service, what is owed and prestige.
  // No phase keeps anything for the next (each builds its own ranking view), so nothing is saved: the step of the day says which is due.
  const ROUND_PHASES = 4;
  function movingRound(st) {
    for (let n = 0; n < ROUND_PHASES; n++) roundPhase(st, n);
  }
  function roundPhase(st, n) {
    if (n === 0) marriageRound(st);
    else if (n === 1) {
      countDemand(st, roundHeirs(st).rank); // who wants out: landless adults with no prospect of a farm
      claimFarms(st); // empty farms go to claimants by custom before any plot is cleared
      startPlots(st, (id) => claimableFarm(st, id) === null);
    } else if (n === 2)
      settleRound(st); // adults of a crowded village may leave for new land (docs/review-expansion.md)
    else if (n === 3) {
      serveWhereShort(st, takeServants(st)); // a holder who lives alone takes in a landless adult, then service where labour is short (sim/service)
      payOwed(st);
      refreshPrestige(st);
    }
    st.visualDirty = true;
  }
  function marriageRound(st) {
    let pairs = 0;
    const env = st.cenv;
    refreshRoles(st);
    fillStores(st);
    const alive = st.living.map((id) => st.pawns[id]);
    for (const p of alive) p.age = age(st, p);
    const single = (p) => spouseOf(st, p.id) === null && p.died === null;
    // marriages: a couple needs a place to live, as the customs define it
    const fed = (p) => p.hunger < HUNGER.marryBelow;
    const widowed = new Set(); // the single who have been married: their marriage ended by a death (balance review)
    for (const p of alive) if (wasWidowed(st, p.id)) widowed.add(p.id);
    // The played pawn's wish for a match (VB-274): false leaves it out of the round's matching; a pawn is checked before the matcher's loop.
    const wishOf = st.player && alive.some((p) => p.id === st.player.pawn) ? st.player.wishes.match : null,
      wisher = wishOf === null ? null : st.player.pawn;
    const men = alive.filter(
        (p) =>
          p.sex === 'm' &&
          p.age >= MARRIAGE.menFrom &&
          single(p) &&
          !p.retired &&
          fed(p) &&
          !(wishOf === false && p.id === wisher),
      ),
      women = alive.filter(
        (p) =>
          p.sex === 'f' &&
          p.age >= MARRIAGE.womenFrom &&
          single(p) &&
          !p.retired &&
          fed(p) &&
          !(wishOf === false && p.id === wisher),
      );
    // Where each pawn would live if married, and whether the home affords it: sim/heirs' matchRules, caches until the next marriage.
    const rules = matchRules(st),
      { heirs, places, handed, means, place, homeFor, affords } = rules,
      homes = new Map(alive.map((p) => [p.id, p.household]));
    men.sort((x, y) => (place(y.id) !== null) - (place(x.id) !== null) || x.born - y.born);
    // A pawn in an open offer is not free to anyone, and counts as matched (VB-293): `taken` holds the matched women and the held.
    const taken = new Set(),
      played = st.player ? st.player.pawn : null;
    for (const o of st.offers) {
      taken.add(o.man);
      taken.add(o.woman);
    }
    const putOff = new Map(); // village -> couples who put off marrying for want of means
    const changedSince = (mark, people, households) => {
      for (const e of st.record.slice(mark)) {
        if (e.self) continue; // a pawn's own telling of an event recorded beside it (sim/records)
        if (e.household !== undefined && e.household !== null) households.add(e.household);
        for (const id of [e.pawn, e.other])
          if (id !== undefined && id !== null) {
            people.add(id);
            households.add(homes.get(id));
            households.add(st.pawns[id].household);
          }
      }
      households.delete(null);
      households.delete(undefined);
      const dirty = heirs.invalidate(people, households);
      for (const h of households) means.delete(h);
      for (const h of dirty) {
        handed.delete(h);
        for (const id of st.households[h].members) places.delete(id);
      }
      for (const id of people) {
        places.delete(id);
        homes.set(id, st.pawns[id].household);
      }
    };
    let housed = null;
    // A wished partner who passes the round's rules is the first match, and an offer the played pawn has said yes to: no draw is made.
    const wished = typeof wishOf === 'number' ? matchBar(st, wisher, wishOf, rules) : null,
      forced = wished && wished.man ? wished : null;
    for (const m of forced ? [forced.man, ...men.filter((x) => x !== forced.man)] : men) {
      if (taken.has(m.id)) continue; // held by an open offer
      const sm = settlementIdOf(st, m),
        cu = practice(st, sm);
      let best = null,
        bs = -Infinity;
      const pm = place(m.id),
        isWish = forced !== null && m === forced.man;
      if (isWish) {
        best = { f: forced.woman, home: forced.home };
        bs = Infinity;
      }
      // With land residence and no place of his own, only women with a place can be candidates.
      // So the pairs whose homeFor would return null are not visited (no draw is made for them either way).
      if (cu.residence === 'land' && pm === null && !housed) housed = women.filter((p) => place(p.id) !== null);
      for (const f of isWish ? [] : cu.residence === 'land' && pm === null ? housed : women) {
        pairs++;
        if (taken.has(f.id) || !kinOk(st, m.id, f.id, cu)) continue;
        const home = homeFor(m, f, cu, pm);
        if (home === null) continue;
        const s = matchScore(st, m, f, rnd(st.rng.society), widowed.has(m.id) || widowed.has(f.id));
        if (s > bs) {
          bs = s;
          best = { f, home };
        }
      }
      if (!best || bs < MARRIAGE.minScore || (!isWish && rnd(st.rng.society) > MARRIAGE.goAhead)) continue;
      if (!affords(best.home)) {
        putOff.set(sm, (putOff.get(sm) || 0) + 1);
        continue;
      }
      taken.add(best.f.id);
      // The match is an offer the two and their spokesmen answer (VB-293, VB-275): an unplayed side answers by opinion at once; one that
      // waits for the player is kept, the two held; a no closes it; all yes, the round marries them here.
      const answers = answersOf(st, m.id, best.f.id);
      for (const a of answers) {
        if (a.by !== played) a.yes = !unplayedNo(st, answers, a);
        else if (isWish && (a.key === 'man' || a.key === 'woman')) a.yes = true; // a wish is the played pawn's own yes
      }
      if (answers.some((a) => a.yes === false)) {
        closeOffer(st, { man: m.id, woman: best.f.id, home: best.home, answers });
        continue;
      }
      if (answers.some((a) => a.yes === null)) {
        taken.add(m.id);
        makeOffer(st, m.id, best.f.id, best.home, answers);
        continue;
      }
      const mark = st.record.length;
      issue(st, { actor: m.id, verb: 'marry', target: best.f.id, args: { home: best.home }, source: 'round' });
      housed = null;
      const people = new Set([m.id, best.f.id]),
        households = new Set([homes.get(m.id), homes.get(best.f.id), best.home]);
      // Commands record all moves, transfers and extinctions, including children and third-party claimants.
      changedSince(mark, people, households);
      // Marriage can move a village's last waiting adult, and a claim can remove one from demand.
      // Other farms in either village must refresh their fallback handover score too.
      for (const h of handed.keys()) {
        const v = st.farmsteads[st.households[h].farmstead].village;
        if ([...households].some((id) => st.farmsteads[st.households[id].farmstead].village === v)) handed.delete(h);
      }
    }
    for (const [v, n] of putOff) {
      log(
        st,
        `At the ${st.villages[v].name} moving round, ${n} couple${n > 1 ? 's' : ''} put off marrying: the farm cannot feed another mouth.`,
        {
          kind: 'putOff',
          village: v,
          n,
        },
      );
    }
    kinPressure(st, men, women, taken, homeFor);
    // handovers by custom: when the heir marries, or when the holder turns 60
    for (const liveId of st.liveHouseholds) {
      const hh = st.households[liveId],
        mark = st.record.length,
        old = hh.holder,
        heir = handover(st, hh, heirs.rank);
      if (heir !== null) changedSince(mark, new Set([old, heir]), new Set([hh.id]));
    }
    refreshRoles(st);
    VB.count.roundPairs += pairs;
  }
  // The handover by custom that a marriage brings, for one household: when its first heir (rank(h)[0], `rank` a ranking function of
  // household ids) is grown and, under 'marriage', has married and lives there, or, under 'age60', the holder is 60. The round runs it for
  // every household after its marriages, an offer's close for the home of the marriage it makes (VB-293), a village's round for its farms
  // (VB-277). The heir it is handed to, or null.
  function handover(st, hh, rank) {
    if (hh.dissolved) return null;
    const f = st.farmsteads[hh.farmstead],
      cu = farmPractice(st, f),
      holder = st.pawns[hh.holder],
      heir = rank(hh.id)[0];
    if (heir === undefined || st.pawns[heir].age < 18) return null;
    const why =
      cu.handover === 'marriage' && spouseOf(st, heir) !== null && st.pawns[heir].household === hh.id
        ? 'marriage'
        : cu.handover === 'age60' && holder.age >= 60
          ? 'retirement'
          : null;
    if (!why) return null;
    issue(st, {
      actor: hh.holder,
      verb: 'handOn',
      target: heir,
      args: { household: hh.id, reason: why },
      source: 'round',
    });
    return heir;
  }
  // ---- marriage offers (VB-293; design.md, Marriage as a negotiation): each match is answered by the two who marry and their spokesmen ----
  // The answers a match asks for, all unanswered: the man's and the woman's, and each one's spokesman's where another speaks for them.
  const answersOf = (st, man, woman) =>
    [
      ['man', man],
      ['woman', woman],
    ].flatMap(([key, id]) => {
      const s = spokesmanOf(st, id),
        own = { key, by: id, yes: null };
      return s === id ? [own] : [own, { key: key + 'Side', by: s, yes: null }];
    });
  // An unplayed pawn's answer (VB-275): no at enmity or below towards the one it weighs: the other one to marry, or, for a spokesman,
  // the other side's spokesman.
  function unplayedNo(st, answers, a) {
    const other = a.key.startsWith('man') ? 'woman' : 'man',
      side = answers.find((b) => b.key === other + 'Side');
    return (
      opinionOf(st, a.by, (a.key.endsWith('Side') && side ? side : answers.find((b) => b.key === other)).by) <=
      SOCIAL.enemy
    );
  }
  const names = (st, o) => `${fullName(st.pawns[o.man])} and ${fullName(st.pawns[o.woman])}`;
  // An offer that waits for the player's answer is kept in st.offers, in order of due time (after those due at the same time), and told.
  function makeOffer(st, man, woman, home, answers) {
    const o = {
        id: st.offerSeq++,
        man,
        woman,
        home,
        village: settlementIdOf(st, st.pawns[man]),
        made: st.t,
        due: st.t + MARRIAGE.offerDays * DAY,
        answers,
      },
      hh = st.households[home];
    let i = st.offers.length;
    while (i > 0 && st.offers[i - 1].due > o.due) i--;
    st.offers.splice(i, 0, o);
    for (const id of [man, woman])
      personEvent(st, id, 'offered', `Offered a match with ${fullName(st.pawns[id === man ? woman : man])}`, false);
    log(st, `A match is offered: ${names(st, o)}, to live at ${st.farmsteads[hh.farmstead].name}.`, {
      kind: 'offered',
      pawn: man,
      other: woman,
      ...atHousehold(st, hh),
    });
    return o;
  }
  const offerOf = (st, id) => st.offers.find((o) => o.id === id) || null;
  // Why pawn id may not answer offer `offerId`, or null: the offer is open and the pawn has an answer in it still to give.
  function cannotAnswer(st, id, offerId) {
    const o = offerOf(st, offerId);
    if (!o) return `there is no open offer ${offerId}`;
    return o.answers.some((a) => a.by === id && a.yes === null)
      ? null
      : `pawn ${id} has no answer to give to offer ${offerId}`;
  }
  // Pawn id answers offer `offerId` (the verb answer, source 'player'), all its answers in it at once. The offer closes at the first no (its
  // cost: SOCIAL.memories.refusedMatch), or when all have said yes.
  function answerOffer(st, id, offerId, yes) {
    const o = offerOf(st, offerId);
    for (const a of o.answers) if (a.by === id && a.yes === null) a.yes = !!yes;
    if (o.answers.some((a) => a.yes === false) || o.answers.every((a) => a.yes === true)) closeOffer(st, o);
  }
  // Offer o closes: refused at a no; otherwise the marriage, through the marry verb, and the handover it brings to its home; or, if the verb
  // refuses (one has died or married), it lapses.
  function closeOffer(st, o) {
    if (st.offers.includes(o)) st.offers.splice(st.offers.indexOf(o), 1); // a match refused at once was never kept
    const hh = st.households[o.home],
      at = { pawn: o.man, other: o.woman, ...atHousehold(st, hh) },
      no = o.answers.find((a) => a.yes === false);
    const why = no
      ? null
      : issue(st, { actor: o.man, verb: 'marry', target: o.woman, args: { home: o.home }, source: 'round' });
    if (no)
      for (const a of o.answers) {
        const side = a.yes === false && o.answers.find((b) => b.key === a.key + 'Side');
        if (side && side.by !== a.by && st.pawns[side.by].alive) remember(st, side.by, a.by, 'refusedMatch');
        if (a === no)
          log(st, `${fullName(st.pawns[no.by])} refused the match of ${names(st, o)}.`, {
            kind: 'matchRefused',
            ...at,
          });
      }
    else if (why !== true) log(st, `The match of ${names(st, o)} lapsed: ${why}.`, { kind: 'offerLapsed', ...at });
    else {
      handover(st, hh, roundHeirs(st).rank);
      refreshRoles(st);
    }
  }
  // At the day's end: the offers due close, their unanswered answers yes. Only the first offer's due time is read (Rules for cost, 4).
  function dueOffers(st) {
    while (st.offers.length && st.offers[0].due <= st.t) {
      for (const a of st.offers[0].answers) if (a.yes === null) a.yes = true;
      closeOffer(st, st.offers[0]);
    }
  }
  function dailyLife(st) {
    VB.count.walkDaily += st.living.length;
    for (const id of st.living) {
      const p = st.pawns[id];
      p.age = age(st, p);
    }
    comeOfAge(st);
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
        const cause = deathRoll(st, p);
        if (cause) killPawn(st, p.id, cause);
      }
    }
  }
  // The day's drift of attitudes (VB-201) runs over the night's 6-minute steps after midnight, a settlement a step (Rules for cost, 5):
  // settlement k of the culture on step 1 + k % NIGHT_STEPS of the day, the living of no settlement on step 1. Nothing is saved: the step of
  // the day says what is due, so a run loaded between two steps does the rest.
  const NIGHT_STEPS = 40;
  // Called on steps 1 to NIGHT_STEPS of the day only (sim/clock, CALENDAR: nightCulture).
  function nightCulture(st, step) {
    const env = st.cenv,
      hk = hooks(st),
      rand = drawer(st.rng.culture);
    env.t = st.t / YEAR;
    env.driftMul = st.driftMul;
    if (step === 1) Culture.settlementStep(env, hk, 1 / YEAR_DAYS, rand, null);
    for (let k = step - 1; k < env.settlements.length; k += NIGHT_STEPS)
      Culture.settlementStep(env, hk, 1 / YEAR_DAYS, rand, env.settlements[k]);
  }
  return {
    killPawn,
    retireHolder,
    holdMeetings,
    meetingStage,
    routinesMeeting,
    MEETING_STAGES,
    kinOk,
    wed,
    movingRound,
    roundPhase,
    ROUND_PHASES,
    dailyLife,
    dailyDeaths,
    nightCulture,
    NIGHT_STEPS,
    handover,
    offerOf,
    cannotAnswer,
    answerOffer,
    dueOffers,
  };
})();

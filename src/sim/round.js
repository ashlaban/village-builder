// @sys sim/round: the moving round (autumn days 11 to 13, ASK.passes days; VB-692): on each day each village's step answers the offers
//   due to its people (sim/offers, in the order ASK.order; of the matches one is asked by, the best as its side reads it first, VB-693),
//   and one refused asks anew, due the next day; on the first, each village's round (its store filled, the played pawn's wished match,
//   its kin pressure, the visits its unmatched plan), then demand, claims, settlement and service, island-wide, each made an offer due
//   at once; after the last, what is open lapses (split from sim/lifecycle, VB-876)
VB['sim/round'] = (() => {
  const Customs = VB['sim/customs'];
  const Crowding = VB['sim/crowding'];
  const { cal, DAY, HUNGER, MARRIAGE, ASK } = VB['sim/rules'];
  const { log, age, spouseOf, settlementIdOf, practice, spokesmanOf, personEvent, fullName } = VB['sim/records'];
  const { countDemand, refreshRoles } = VB['sim/heirs'];
  const { kinOk, poolFor, sideScore, matchRules, wishedMatches, matchBar, askerOf, askedOf } = VB['sim/matching'];
  const { startPlots } = VB['sim/allotment'];
  const { claimFarms, claimableFarm, askLand } = VB['sim/farmclaims'];
  const { settleRound } = VB['sim/settle'];
  const { takeServants, serveWhereShort, oweWages, unpaid, unpaidLeave } = VB['sim/service'];
  const { payOwed } = VB['sim/cottage'];
  const { callFilling } = VB['sim/help'];
  const { refreshStanding } = VB['sim/society'];
  const { issue } = VB['sim/commands'];
  const { chooseWishes, wishOf } = VB['sim/wishes'];
  const { heldBy, conclude, BASES } = VB['sim/offers'];
  const { VILLAGE_STEPS } = VB['sim/occasions'];
  const { villagesOfStep } = VB['sim/meetings'];
  const { askMatch, askFor, staleWhy } = VB['sim/asking'];
  const { review, leavers } = VB['sim/courting'];
  const { seekVisit } = VB['sim/visits'];
  const kinOpts = Customs.DIMS[Customs.IDX.kinLimit].opts.map((o) => o[0]); // strictest first
  // Scarcity and plenty of spouses push the marriage limit, a village's own at the end of its round (VB-277): one the step married to a
  // partner also allowed under the next stricter option pulls back, at half the weight; an unmatched man of the village, or an unmarried
  // woman of it, not held by an offer, who finds no allowed partner among the free of the other sex within reach (VB-288) but would under
  // the next looser option pulls towards it. The living's pushes are cleared at the first village's step, a pawn's at marriage and death.
  function kinPressure(st, v, men, women, others, taken, married, homeFor) {
    const at = (cu) => kinOpts.indexOf(cu.kinLimit),
      wed = new Set();
    for (const [x, y] of married)
      for (const [a, b] of [
        [x, y],
        [y, x],
      ]) {
        wed.add(a);
        const cu = practice(st, settlementIdOf(st, st.pawns[a])),
          k = at(cu);
        if (k > 0 && kinOk(st, a, b, cu, kinOpts[k - 1]))
          st.pawns[a].kinPush = { to: kinOpts[k - 1], w: MARRIAGE.plentyPush };
      }
    const cu = practice(st, v),
      k = at(cu);
    let blocked = 0;
    if (k < kinOpts.length - 1) {
      const local = women.filter((p) => settlementIdOf(st, p) === v),
        free = (o) => !taken.has(o.id) && !wed.has(o.id);
      for (const [mine, pool] of [
        [men, women],
        [local, men.concat(others)],
      ]) {
        for (const p of mine) {
          if (!free(p)) continue;
          const can = (o, opt) => {
            VB.count.kinPairs++;
            return (
              free(o) &&
              (p.sex === 'm' ? homeFor(p, o, cu) : homeFor(o, p, cu)) !== null &&
              kinOk(st, p.id, o.id, cu, opt)
            );
          };
          if (pool.some((o) => can(o, cu.kinLimit)) || !pool.some((o) => can(o, kinOpts[k + 1]))) continue;
          p.kinPush = { to: kinOpts[k + 1], w: MARRIAGE.scarcePush };
          blocked++;
        }
      }
    }
    if (!blocked) return;
    const txt = `At the ${st.cenv.settlements[v].name} moving round, ${blocked} adult${blocked > 1 ? 's' : ''} found no spouse only because of kin.`;
    log(st, txt, { kind: 'kinBarred', village: v, n: blocked });
    st.meetingLog.unshift({ year: cal(st.t).year, text: txt });
    st.meetingLog.length = Math.min(st.meetingLog.length, 30);
  }
  // The moving round (autumn days 11 to 13: ASK.passes days from sday ASK.day; VB-692) runs on the 6-minute steps from noon (VB-201, VB-277).
  // Each day, each village's step, a village a step in the order of village id from the one the year turns to (village k of n on step k
  // while n is at most VILLAGE_STEPS, else on floor(k * VILLAGE_STEPS / n)): the offers due to its people are answered (answerDue); on the
  // first day, then its own round (villageRound), and three phases on fixed steps from 18:00, island-wide: demand, claims on empty farms
  // and plots; settlement; service, what is owed and standing. Fixed, since settlement founds villages. After the last day's last step,
  // what is open of the round lapses. Nothing is kept from one step for the next, so nothing is saved: the day and the step say what is
  // due. `movingRound` runs every step of every day at once (the drawer's button, the tests), each day's offers as due on its day.
  const ROUND_STEPS = VILLAGE_STEPS + 3;
  // The round chooses nobody (VB-693), so run at once it first holds the asking of each who seeks and holds no offer, as its last
  // before the round, due at the round's first step: the year's askings and the round in one (a debug verb, the world's).
  function movingRound(st) {
    // the first day's noon, or just after now if later, so that what is asked here is answered by the round's steps, not at once
    const noon = Math.floor(st.t / DAY) * DAY + 12,
      from = noon > st.t ? noon : st.t + 1 / 1024;
    for (const e of [...st.asking]) if (st.pawns[e.pawn].alive) askFor(st, e.pawn, from);
    for (let d = 0; d < ASK.passes; d++) for (let n = 0; n < ROUND_STEPS; n++) roundPhase(st, n, d, from + d * DAY);
  }
  // A step's changes of membership are counted into the crowding once, at its end (VB-1380).
  const roundPhase = (st, n, d = 0, now = st.t) => Crowding.batch(st, () => phase(st, n, d, now));
  function phase(st, n, d, now) {
    if (n < VILLAGE_STEPS) {
      if (n === 0 && d === 0) {
        oweWages(st); // a year served is owed its wage, and wages owed are paid, before any servant marries (sim/service, VB-637)
        review(st); // the courting couples are read: a courtship that has run out ends (sim/courting, VB-036)
        chooseWishes(st); // each pawn comes to the round with its wish (sim/wishes, VB-680)
      }
      villagesOfStep(st, n, (v) => {
        const married = answerDue(st, v, d, now);
        if (d === 0) villageRound(st, v, married);
      });
      return;
    }
    if (d > 0) {
      if (n === ROUND_STEPS - 1 && d === ASK.passes - 1) lapseRound(st);
      return;
    }
    if (n === VILLAGE_STEPS) {
      countDemand(st); // who wants out: landless adults with no prospect of a farm
      claimFarms(st); // empty farms go to claimants by custom before any plot is cleared
      startPlots(
        st,
        (id) => claimableFarm(st, id) === null,
        (v, id, site) => askLand(st, id, v.id, { plot: v.id, house: site.house, field: site.field }),
      );
    } else if (n === VILLAGE_STEPS + 1)
      settleRound(st); // adults of a crowded village may leave for new land (docs/review-expansion.md)
    else if (n === VILLAGE_STEPS + 2) {
      // a holder who lives alone takes in a landless adult, then service where labour is short, and for those of a courting couple a
      // head refused (sim/service, sim/courting), and for a servant its master has not paid, who goes home first (VB-637)
      const unhomed = unpaidLeave(st, unpaid(st));
      serveWhereShort(st, { ...takeServants(st), leavers: [...leavers(st), ...unhomed] });
      payOwed(st);
      refreshStanding(st);
      if (ASK.passes === 1) lapseRound(st);
    }
    st.visualDirty = true;
  }
  // ---- the offers due at the round (VB-692; plan VB-682, section 2) ----
  // Village v's step on day d (`now`, its time): the open offers due by now that its people are asked (the basis's `where`), in the order
  // of ASK.order, each answered once (conclude: the unanswered by their pawns' judgement). Of the matches, a courting pair's own comes
  // first, then the arranged ones by the score as the side asked reads it (matchRead), the best first: so the side of one asked by
  // several answers the best offer it holds, and the rest lapse when it has married (no slight, and nobody remembers it), or are
  // answered in their turn where the better one came to nothing (VB-693; plan VB-682, 4.1). A match refused or lapsed, the one who
  // asked asks anew (askAgain). The queue is read up to the first offer not yet due (it is sorted by due). The couples it married.
  function matchRead(st, o) {
    if (o.courted) return Infinity;
    const asked = askedOf(o),
      by = spokesmanOf(st, asked);
    return sideScore(st, st.pawns[o.gives.man], st.pawns[o.wants.woman], 0.5, by, spokesmanOf(st, askerOf(o)));
  }
  function answerDue(st, v, d, now) {
    let due = null;
    const married = [];
    for (const o of st.offers) {
      if (o.due > now) break;
      const B = BASES[o.basis];
      if (B.where && B.where(st, o) === v) (due || (due = [])).push(o);
    }
    if (!due) return married;
    const read = new Map();
    for (const o of due) if (o.basis === 'match') read.set(o, matchRead(st, o));
    due.sort(
      (a, b) =>
        ASK.order.indexOf(a.basis) - ASK.order.indexOf(b.basis) ||
        (read.has(a) ? read.get(b) - read.get(a) || a.id - b.id : 0),
    );
    let changed = false;
    for (const o of due) {
      if (!st.offers.includes(o)) continue; // closed by an answer before it (one has married)
      VB.count.offersAnswered++;
      const r = conclude(st, o, staleWhy(st, o)); // lapsed where one of its people has died, married or taken a place (VB-823)
      changed = changed || r === 'yes';
      if (o.basis !== 'match') continue;
      if (r === 'yes') married.push([o.gives.man, o.wants.woman]);
      // refused, or lapsed for the marriage of the one asked to another asker (VB-823), the one who asked asks anew
      else askAgain(st, askerOf(o), askedOf(o), d, now);
    }
    if (changed) refreshRoles(st);
    return married;
  }
  // After the last day: each offer of the round still open lapses (it was due at the round, and the round is over).
  function lapseRound(st) {
    for (const o of st.offers.filter((x) => x.round)) conclude(st, o, 'the moving round ended');
  }
  // Pawn id, refused by `not` on day d of the round, asks anew that evening through its spokesman, due the next day (VB-692): by the
  // asking's rule for one pawn (sim/asking's askMatch), the one who refused excepted. Not on the last day (no next day), and not for
  // the played pawn or where it speaks for the one refused (the player asks by the offer verb).
  function askAgain(st, id, not, d, now) {
    const p = st.pawns[id],
      played = st.player ? st.player.pawn : null;
    if (d >= ASK.passes - 1 || !p.alive || spouseOf(st, id) !== null || heldBy(st, id, 'match')) return;
    if (id === played || spokesmanOf(st, id) === played || (p.ask !== undefined && p.ask !== null)) return;
    askMatch(st, id, Math.floor(now / DAY) * DAY + DAY + 12, { not });
  }
  // A village's round (VB-277, VB-693; design.md, A village's round): its alderman calls its households to fill its store; the played pawn's wished match
  // (VB-274) is offered, the wisher's own yes given; its kin pressure; and its men who hold no offer plan a visit. The round chooses
  // nobody (principle "Every act is a pawn's"): the matches were asked through the year by the spokesmen (sim/asking) and answered in the village's step
  // (answerDue: `married`, the couples it married). One walk of the pool (`roundWalk`), and no pass over pairs.
  function villageRound(st, v, married) {
    const pool = poolFor(st, v); // the living of the villages within a day's walk, and of those visited (sim/matching, VB-288, VB-289)
    VB.count.roundWalk += pool.length;
    if (v === 0) refreshRoles(st);
    if (v === 0) for (const id of st.living) st.pawns[id].kinPush = null; // the living's pushes, cleared once a round
    VB['sim/keep'].round(st, v); // the alderman's keep, beside the store's quarter (VB-463)
    callFilling(st, v); // the alderman calls the store's quarters (VB-673)
    // A pawn's wish for a match (VB-274, VB-680): false leaves it out; a partner it names is found in the walk.
    const wishers = [],
      fed = (p) => p.hunger < HUNGER.marryBelow;
    // The pool, in one walk: the village's men who may marry, the women, the other villages' men (kin pressure).
    const men = [],
      women = [],
      others = [];
    for (const id of pool) {
      const p = st.pawns[id];
      p.age = age(st, p);
      // One who courts is in no arranged match: the pair's own offer is theirs (sim/asking)
      if (Number.isInteger(p.courting)) continue;
      const wish = p.wish ? wishOf(st, id, 'match') : null;
      if (typeof wish === 'number') wishers.push([id, wish]);
      if (spouseOf(st, id) !== null || p.retired || !fed(p) || wish === false) continue;
      if (p.ask !== undefined && p.ask !== null && !heldBy(st, id, 'match')) continue; // in another basis's step only (VB-692)
      if (p.age < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) continue;
      (p.sex === 'f' ? women : settlementIdOf(st, p) === v ? men : others).push(p);
    }
    // Where each pawn would live if married, and whether the home affords it: matchRules' memos.
    const rules = matchRules(st);
    // A pawn in an open offer is not free to anyone, and counts as matched (VB-293): `taken` holds the held.
    const taken = new Set();
    for (const o of st.offers)
      if (o.basis === 'match') {
        taken.add(o.gives.man);
        taken.add(o.wants.woman);
      }
    // A wished partner who passes the round's rules (sim/matching matchBar) is offered the match by the man's spokesman, the wisher's
    // own yes given: the others answer by their judgement, at once. The rounds of the villages before his hold the woman for it.
    for (const w of wishedMatches(st, wishers, v, rules, taken).values()) {
      const m = w.man.id,
        f = w.woman.id;
      if (taken.has(m) || taken.has(f)) continue;
      const r = issue(st, {
        actor: spokesmanOf(st, m),
        verb: 'offer',
        target: spokesmanOf(st, f),
        args: {
          basis: 'match',
          gives: { man: m, home: w.home },
          wants: { woman: f },
          given: ['man', 'woman'].filter((k) => (k === 'man' ? m : f) === w.wisher),
        },
        source: 'round',
      });
      rules.clear();
      if (spouseOf(st, m) === f) married.push([m, f]);
      else if (r === true && heldBy(st, m, 'match')) (taken.add(m), taken.add(f));
    }
    proposed(st, v, rules, taken, married);
    kinPressure(st, v, men, women, others, taken, married, rules.homeFor);
    // One who holds no offer at the round (he found nobody he could ask within a day's walk, or was refused) plans a winter's visit
    // (sim/visits, VB-289).
    for (const p of [...men, ...women])
      if (settlementIdOf(st, p) === v && spouseOf(st, p.id) === null && !heldBy(st, p.id, 'match'))
        seekVisit(st, p.id, rules);
    if (married.length) refreshRoles(st);
  }
  // The head's match for a member (VB-276; sim/player propose): at the round of the man's village, a pair that passes the round's rules
  // (matchBar, as a wish) is offered by the played pawn, its spokesman, to the other side's, with the terms its side gives and its own yes
  // given; the others answer as any offer's. One the round passes by is told, and stands for the next round.
  function proposed(st, v, rules, taken, married) {
    const pl = st.player,
      pr = pl && pl.proposal;
    if (!pr || !st.pawns[pl.pawn].alive || spokesmanOf(st, pr.for) !== pl.pawn) return;
    const w = matchBar(st, pr.for, pr.partner, rules),
      man = st.pawns[pr.for].sex === 'm' ? pr.for : pr.partner;
    if ((settlementIdOf(st, st.pawns[man]) ?? 0) !== v) return;
    if (w.why) {
      personEvent(
        st,
        pl.pawn,
        'wishLapsed',
        `The round passed over the match you made for ${fullName(st.pawns[pr.for])}: ${w.why}`,
        {
          other: pr.partner,
          reason: 'passed',
          village: settlementIdOf(st, st.pawns[pl.pawn]),
        },
      );
      return;
    }
    const m = w.man.id,
      f = w.woman.id;
    if (taken.has(m) || taken.has(f)) return;
    const r = issue(st, {
      actor: pl.pawn,
      verb: 'offer',
      target: spokesmanOf(st, pr.for === m ? f : m),
      args: {
        basis: 'match',
        gives: { man: m, home: w.home },
        wants: { woman: f },
        ...(pr.terms ? { terms: pr.terms } : {}),
        given: [pr.for === m ? 'manSide' : 'womanSide'],
      },
      source: 'round',
    });
    rules.clear();
    if (spouseOf(st, m) === f) married.push([m, f]);
    else if (r === true && heldBy(st, m, 'match')) (taken.add(m), taken.add(f));
  }
  return {
    movingRound,
    roundPhase,
    ROUND_STEPS,
  };
})();

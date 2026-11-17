// @sys sim/round: the moving round (autumn days 11 to 13, ASK.passes days; VB-692): on each day each village's step answers the offers
//   due to its people (sim/offers, in the order ASK.order), and one refused asks anew, due the next day; on the first, each village's
//   round, its matches offered (the basis `match`, sim/marriage) and its kin pressure, then demand, claims, settlement and service,
//   island-wide, each made an offer due at once; after the last, what is open lapses (split from sim/lifecycle, VB-876)
VB['sim/round'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const Culture = VB['culture'];
  const { cal, DAY, HUNGER, MARRIAGE, ASK } = VB['sim/rules'];
  const { log, age, spouseOf, wasWidowed, settlementIdOf, practice, holdingOf, spokesmanOf } = VB['sim/records'];
  const { countDemand, refreshRoles } = VB['sim/heirs'];
  const { kinOk, poolFor, matchScore, matchRules, wishedMatches } = VB['sim/matching'];
  const { startPlots } = VB['sim/expansion'];
  const { claimFarms, claimableFarm, askLand } = VB['sim/farmclaims'];
  const { settleRound } = VB['sim/settle'];
  const { takeServants, serveWhereShort } = VB['sim/service'];
  const { payOwed } = VB['sim/cottage'];
  const { fillStores } = VB['sim/help'];
  const { refreshPrestige } = VB['sim/society'];
  const { issue } = VB['sim/commands'];
  const { chooseWishes, wishOf } = VB['sim/wishes'];
  const { heldBy, conclude, BASES } = VB['sim/offers'];
  const { trustOfHolder } = VB['sim/ownership'];
  const { VILLAGE_STEPS } = VB['sim/occasions'];
  const { villagesOfStep } = VB['sim/meetings'];
  const { handover } = VB['sim/marriage'];
  const { askMatch, staleWhy } = VB['sim/asking'];
  const kinOpts = Culture.DIMS[Culture.IDX.kinLimit].opts.map((o) => o[0]); // strictest first
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
          const can = (o, opt) =>
            free(o) &&
            (p.sex === 'm' ? homeFor(p, o, cu) : homeFor(o, p, cu)) !== null &&
            kinOk(st, p.id, o.id, cu, opt);
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
  // and plots; settlement; service, what is owed and prestige. Fixed, since settlement founds villages. After the last day's last step,
  // what is open of the round lapses. Nothing is kept from one step for the next, so nothing is saved: the day and the step say what is
  // due. `movingRound` runs every step of every day at once (the drawer's button, the tests), each day's offers as due on its day.
  const ROUND_STEPS = VILLAGE_STEPS + 3;
  function movingRound(st) {
    const from = Math.max(st.t, Math.floor(st.t / DAY) * DAY + 12); // the first day's noon, or now if later
    for (let d = 0; d < ASK.passes; d++) for (let n = 0; n < ROUND_STEPS; n++) roundPhase(st, n, d, from + d * DAY);
  }
  function roundPhase(st, n, d = 0, now = st.t) {
    if (n < VILLAGE_STEPS) {
      if (n === 0 && d === 0) chooseWishes(st); // each pawn comes to the round with its wish (sim/wishes, VB-680)
      villagesOfStep(st, n, (v) => {
        answerDue(st, v, d, now);
        if (d === 0) villageRound(st, v);
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
      serveWhereShort(st, takeServants(st)); // a holder who lives alone takes in a landless adult, then service where labour is short (sim/service)
      payOwed(st);
      refreshPrestige(st);
      if (ASK.passes === 1) lapseRound(st);
    }
    st.visualDirty = true;
  }
  // ---- the offers due at the round (VB-692; plan VB-682, section 2) ----
  // Village v's step on day d (`now`, its time): the open offers due by now that its people are asked (the basis's `where`), in the order
  // of ASK.order, each answered once (conclude: the unanswered by their pawns' judgement); a match refused, or lapsed for her marriage to
  // another (VB-823), asks anew (askAgain). The queue is read up to the first offer not yet due (it is sorted by due).
  function answerDue(st, v, d, now) {
    let due = null;
    for (const o of st.offers) {
      if (o.due > now) break;
      const B = BASES[o.basis];
      if (B.where && B.where(st, o) === v) (due || (due = [])).push(o);
    }
    if (!due) return;
    due.sort((a, b) => ASK.order.indexOf(a.basis) - ASK.order.indexOf(b.basis));
    let changed = false;
    for (const o of due) {
      if (!st.offers.includes(o)) continue; // closed by an answer before it (one has married)
      VB.count.offersAnswered++;
      const r = conclude(st, o, staleWhy(st, o)); // lapsed where one of its people has died, married or taken a place (VB-823)
      changed = changed || r === 'yes';
      // refused, or lapsed for her marriage to another asker (VB-823), the man asks anew
      if ((r === 'no' || r === 'lapsed') && o.basis === 'match') askAgain(st, o.gives.man, o.wants.woman, d, now);
    }
    if (changed) refreshRoles(st);
  }
  // After the last day: each offer of the round still open lapses (it was due at the round, and the round is over).
  function lapseRound(st) {
    for (const o of st.offers.filter((x) => x.round)) conclude(st, o, 'the moving round ended');
  }
  // The man m, refused by woman `not` on day d of the round, asks anew that evening through his spokesman, due the next day (VB-692):
  // by the matcher's rule for one man (sim/asking's askMatch), she excepted. Not on the last day (no next day), and not for the played
  // pawn or where it speaks for him (the player asks by the offer verb).
  function askAgain(st, m, not, d, now) {
    const p = st.pawns[m],
      played = st.player ? st.player.pawn : null;
    if (d >= ASK.passes - 1 || !p.alive || spouseOf(st, m) !== null || heldBy(st, m, 'match')) return;
    if (m === played || spokesmanOf(st, m) === played || (p.ask !== undefined && p.ask !== null)) return;
    askMatch(st, m, Math.floor(now / DAY) * DAY + DAY + 12, { not });
  }
  // A village's round (VB-277; design.md, A village's round): its households fill its store; its own unmarried men, those with a place first,
  // then the oldest, each choose by the score among the unmarried women within walking reach (VB-288; one married at an earlier village's
  // round is no longer single, one held by an open offer is taken); its handovers, for its own farms and for the homes in other villages its marriages
  // chose; and its kin pressure. Heirs are ranked afresh: matchRules memoizes the rankings with the homes and the means, and the memos are
  // cleared after each marriage or handover the step makes.
  function villageRound(st, v) {
    let pairs = 0;
    const pool = poolFor(st, v); // the living of the villages within walking reach (sim/matching, VB-288)
    VB.count.roundWalk += pool.length;
    if (v === 0) refreshRoles(st);
    if (v === 0) for (const id of st.living) st.pawns[id].kinPush = null; // the living's pushes, cleared once a round
    fillStores(st, v);
    // A pawn's wish for a match (VB-274, VB-680): false leaves it out of the round's matching; a partner it names is found in the walk.
    const wishers = [],
      fed = (p) => p.hunger < HUNGER.marryBelow;
    // The pool, in one walk: the village's men who may marry, the women, the other villages' men (kin pressure), the widowed among them.
    const men = [],
      women = [],
      others = [],
      widowed = new Set();
    for (const id of pool) {
      const p = st.pawns[id];
      p.age = age(st, p);
      const wish = p.wish ? wishOf(st, id, 'match') : null;
      if (typeof wish === 'number') wishers.push([id, wish]);
      if (spouseOf(st, id) !== null || p.retired || !fed(p) || wish === false) continue;
      if (p.ask !== undefined && p.ask !== null && !heldBy(st, id, 'match')) continue; // in another basis's step only (VB-692)
      if (p.age < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) continue;
      if (wasWidowed(st, id)) widowed.add(id);
      (p.sex === 'f' ? women : settlementIdOf(st, p) === v ? men : others).push(p);
    }
    // Where each pawn would live if married, and whether the home affords it: matchRules' memos, cleared after each marriage and handover.
    const rules = matchRules(st),
      { place, homeFor, affords } = rules;
    men.sort((x, y) => (place(y.id) !== null) - (place(x.id) !== null) || x.born - y.born);
    // A pawn in an open offer is not free to anyone, and counts as matched (VB-293): `taken` holds the matched women and the held.
    const taken = new Set();
    for (const o of st.offers)
      if (o.basis === 'match') {
        taken.add(o.gives.man);
        taken.add(o.wants.woman);
      }
    // A wished partner who passes the round's rules is a first match of the man's village, and an offer the wisher has said yes to: no
    // draw is made. The rounds of the villages before his hold the woman for it.
    const forcedBy = wishedMatches(st, wishers, v, rules, taken);
    const cu = practice(st, v),
      married = [],
      away = new Set(); // the homes in other villages the marriages chose
    let putOff = 0,
      housed = null;
    const first = [...forcedBy.values()].map((x) => x.man);
    for (const m of first.length ? [...first, ...men.filter((x) => !forcedBy.has(x.id))] : men) {
      if (taken.has(m.id)) continue; // held by an open offer
      let best = null,
        bs = -Infinity;
      const pm = place(m.id),
        wished = forcedBy.get(m.id),
        isWish = !!wished;
      if (isWish) {
        if (taken.has(wished.woman.id)) continue;
        best = { f: wished.woman, home: wished.home };
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
        putOff++;
        continue;
      }
      taken.add(best.f.id);
      // The match is an offer (VB-690's basis `match`; VB-293, VB-275), made by the man's spokesman to the woman's, which the two and their
      // spokesmen answer: an unplayed side answers by opinion at once; one that waits for the player is kept, the two held; a no closes
      // it; all yes, the round marries them here. A wish is the wisher's own yes.
      const r = issue(st, {
        actor: spokesmanOf(st, m.id),
        verb: 'offer',
        target: spokesmanOf(st, best.f.id),
        args: {
          basis: 'match',
          gives: { man: m.id, home: best.home },
          wants: { woman: best.f.id },
          given: isWish ? ['man', 'woman'].filter((k) => (k === 'man' ? m.id : best.f.id) === wished.wisher) : [],
        },
        source: 'round',
      });
      if (spouseOf(st, m.id) !== best.f.id) {
        if (r === true && heldBy(st, m.id, 'match')) taken.add(m.id);
        else if (r === true && spouseOf(st, m.id) === null) {
          askAgain(st, m.id, best.f.id, 0, st.t); // refused: he asks anew, due the next day (VB-692)
          if (heldBy(st, m.id, 'match')) taken.add(m.id);
        }
        continue;
      }
      // Neither holding a farm nor held in trust, they change only their own households and spouses: clear only the memos that read them.
      const plain = [m.id, best.f.id].every((id) => holdingOf(st, id) === null && !trustOfHolder(st, id)),
        homes = [m.household, best.f.household, best.home];
      if (plain)
        rules.touched(
          [m.id, best.f.id],
          homes.filter((h) => h !== null),
        );
      else rules.clear();
      housed = null;
      married.push([m.id, best.f.id]);
      if (st.farmsteads[st.households[best.home].farmstead].village !== v) away.add(best.home);
    }
    if (putOff) {
      const txt = `${putOff} couple${putOff > 1 ? 's' : ''} put off marrying: the farm cannot feed another mouth`;
      log(st, `At the ${st.villages[v].name} moving round, ${txt}.`, { kind: 'putOff', village: v, n: putOff });
    }
    kinPressure(st, v, men, women, others, taken, married, homeFor);
    // handovers by custom, when the heir marries or the holder turns 60: the village's farms and the homes its marriages chose
    let handed = 0;
    const farms = st.liveHouseholds.filter(
      (h) => away.has(h) || st.farmsteads[st.households[h].farmstead].village === v,
    );
    for (const h of farms) {
      const hh = st.households[h],
        old = hh.holder,
        heir = handover(st, hh, rules.rank);
      if (heir === null) continue;
      // The heir already lives there (handover's rule), so no pawn moves: the holder changes, and the old holder and the pair's spouses
      // retire. Clear only the memos that read those pawns and this household.
      const changed = [old, heir, spouseOf(st, old), spouseOf(st, heir)].filter((id) => id !== null);
      rules.touched(changed, [h]);
      handed++;
    }
    if (married.length || handed) refreshRoles(st);
    VB.count.roundPairs += pairs;
  }
  return {
    movingRound,
    roundPhase,
    ROUND_STEPS,
  };
})();

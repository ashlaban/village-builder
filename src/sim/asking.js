// @sys sim/asking: the asking day (VB-823; plan VB-682, sections 2, 3 and 7): each pawn who seeks reviews its wish on a day of its own once
//   a season (the due-queue st.asking of sim/wishes) and, holding no open offer about its future, makes the one its best open rung asks
//   for, due at the moving round, which answers it: a match, by its spokesman (askMatch, which the round
//   also uses to ask anew after a refusal), or an empty farm (the basis land); a plot, at home or (with no site there) of a small village within
//   reach (VB-697); new land and service are still asked by the round's own walk until VB-696 and VB-694 make them askings.
//   An open offer whose people have died, married or taken a place lapses
//   where it is next read (staleWhy: an asking, or the round). A holder's own day is its birthday: it considers handing the farm on
//   (sim/marriage's rule, VB-824), by an offer due at the round. A courting pair with a child on the way makes its offer out of the
//   round once the pregnancy is known (VB-555: st.courtDue).
VB['sim/asking'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, YEAR, SEASON_DAYS, HUNGER, MARRIAGE, ASK, TRAVEL, cal } = VB['sim/rules'];
  const { age, spouseOf, settlementIdOf, practice, spokesmanOf, matchByOf, holdingOf, fullName, unplanned } =
      VB['sim/records'],
    { tieOf } = VB['sim/ties'];
  const { kinOk, sideScore, matchRules, courts, askerOf, askedOf, askedBy } = VB['sim/matching'];
  const { hoursBetween } = VB['sim/villagehours'];
  const { claimableFarm, askLand, barred } = VB['sim/farmclaims'];
  const { heirRanking } = VB['sim/heirranking'],
    { placeIfMarried, staysWhy } = VB['sim/heirs'];
  const { findSite } = VB['sim/expansion'];
  const { smallVillage, waitingByVillage, reachOf } = VB['sim/settle'];
  const { issue } = VB['sim/commands'];
  const { chooseWish, wishOf, wishesOf, nextAsking, askingIn, authored } = VB['sim/wishes'];
  const { conclude } = VB['sim/offers'];
  const Due = VB['sim/due'],
    { COURT } = VB['sim/courting'];
  const { handover } = VB['sim/marriage'],
    { on } = VB['sim/events'];
  const AUTUMN = 2;
  // The time an offer made now is due at the moving round: the noon of the round's next day still to come (ASK.passes days from sday
  // ASK.day of autumn), this year's or the next's.
  function dueRound(st) {
    const first = Math.floor(st.t / YEAR) * YEAR + (AUTUMN * SEASON_DAYS + ASK.day) * DAY + 12;
    for (let d = 0; d < ASK.passes; d++) if (first + d * DAY >= st.t) return first + d * DAY;
    return first + YEAR;
  }
  // Under the custom `matchBy` 'heads' (VB-826) a spokesman asks for a member whatever its wish or courtship: the member's no is its own
  const headsOf = (st, p) => matchByOf(st, p) === 'heads';
  const { landed, mayHoldFarm } = VB['sim/holding'];
  // Why open offer o can no longer be answered, or null: one of its people has died; for a match, one of the two has married; for land,
  // the asker has taken a place.
  function staleWhy(st, o) {
    const ids = o.basis === 'match' ? [o.gives.man, o.wants.woman] : [o.from, o.to].filter(Number.isInteger);
    for (const id of ids) {
      const p = st.pawns[id];
      if (!p || !p.alive) return `${p ? fullName(p) : 'one of them'} has died`;
      if (o.basis === 'match' && spouseOf(st, id) !== null) return `${fullName(p)} has married`;
    }
    if (o.courted && st.pawns[o.gives.man].courting !== o.wants.woman) return 'they court no more';
    if (o.basis === 'land' && Number.isInteger(o.from) && landed(st, o.from))
      return `${fullName(st.pawns[o.from])} has taken a place`;
    return null;
  }
  // ---- the match, asked for one pawn (VB-823, VB-693; plan VB-682, sections 2 and 4.1) ----
  // Pawn id's spokesman offers it in marriage, due at `due`, to the best-scoring partner the gate allows (unmarried, of age, fed, not
  // retired, not wishing otherwise, courting nobody; the kin limit of the man's village's custom; a home under the residence custom:
  // the means are read at the round, by those who answer), of those within a day's walk or of a village one of the two visited (VB-288,
  // VB-289), who ask in no open match themselves and are asked by fewer than ASK.held (who is spoken for is news), the nearest
  // villages first, at most ASK.pool of them weighed (asksWeighed). The score is the spokesman's own reading (sim/matching sideScore):
  // the fancy is drawn once for each weighed and the best one's is kept on the offer, and his opinion of the other spokesman counts.
  // The unmarried of 18 or more are read from the queue's part of each village within reach (askingIn; askWalk). `not`: one it may not ask
  // (who has just refused it); `only`: the one it wishes. 'made', or what stood in the way: 'nobody', or why the offer was refused.
  // The villages by land from v (ids), the nearest first, v itself first, the ties by id: [{w, h}].
  function villagesByReach(st, v) {
    const out = [{ w: v, h: 0 }];
    for (let w = 0; w < st.villages.length; w++) {
      const h = w === v ? Infinity : hoursBetween(st, v, w);
      if (h < Infinity) out.push({ w, h });
    }
    return out.sort((a, b) => a.h - b.h || a.w - b.w);
  }
  VB.counter(
    'asksWeighed',
    'Candidates weighed at an asking or an ask anew, by either side: at most ASK.pool a call (sim/asking askMatch, VB-823, VB-693)',
  );
  VB.counter(
    'askWalk',
    'Entries of the asking queue read for the unmarried of the other sex within reach, a match asked (sim/asking askMatch, VB-823)',
  );
  function askMatch(st, id, due, { not = null, only = null } = {}) {
    const p = st.pawns[id],
      v = settlementIdOf(st, p),
      man = p.sex === 'm';
    if (v === null || (Number.isInteger(p.courting) && !headsOf(st, p))) return 'nobody'; // one who courts asks no other (askCourted, VB-036)
    const asked = new Map(),
      asks = new Set();
    for (const o of st.offers)
      if (o.basis === 'match') {
        asked.set(askedOf(o), (asked.get(askedOf(o)) || 0) + 1);
        asks.add(askerOf(o));
      }
    const rules = matchRules(st),
      mine = rules.place(id),
      speaker = spokesmanOf(st, id);
    let best = null,
      bs = -Infinity,
      n = 0;
    // The villages by land, the nearest first (the own village first), each read from its own part of the queue; the reading stops once
    // ASK.pool are weighed, so the villages beyond are never read (VB-1169).
    for (const { w: qv, h } of villagesByReach(st, v)) {
      if (n >= ASK.pool) break;
      const [vm, vf] = man ? [v, qv] : [qv, v];
      let cu = null;
      for (const e of askingIn(st, qv)) {
        VB.count.askWalk++;
        const q = st.pawns[e.pawn];
        if (q.sex === p.sex || q.id === not || (only !== null && q.id !== only) || !q.alive || q.retired) continue;
        if (q.household === null || q.hunger >= HUNGER.marryBelow) continue;
        if (age(st, q) < (man ? MARRIAGE.womenFrom : MARRIAGE.menFrom)) continue;
        if (spouseOf(st, q.id) !== null || asks.has(q.id) || (asked.get(q.id) || 0) >= ASK.held) continue;
        if (!headsOf(st, q) && (Number.isInteger(q.courting) || (q.wish && wishOf(st, q.id, 'match') === false)))
          continue;
        if (qv !== v && !courts(st, man ? p : q, man ? q : p, vm, vf)) continue; // a day's walk, or visited (VB-289)
        if (n >= ASK.pool) break;
        if (cu === null) cu = practice(st, vm);
        const [m, f] = man ? [p, q] : [q, p];
        if (!kinOk(st, m.id, f.id, cu)) continue;
        const home = man ? rules.homeFor(m, f, cu, mine) : rules.homeFor(m, f, cu, undefined, mine);
        if (home === null) continue;
        n++;
        VB.count.asksWeighed++;
        const fancy = rnd(st.rng.society),
          s = sideScore(st, m, f, fancy, speaker, spokesmanOf(st, q.id));
        if (s > bs) {
          bs = s;
          best = { m, f, home, fancy, to: q.id };
        }
      }
    }
    if (!best || bs < MARRIAGE.minScore) return 'nobody';
    const r = issue(st, {
      actor: speaker,
      verb: 'offer',
      target: spokesmanOf(st, best.to),
      args: {
        basis: 'match',
        gives: { man: best.m.id, home: best.home },
        wants: { woman: best.f.id },
        due,
        round: true,
        fancy: best.fancy,
      },
      source: 'asking',
    });
    return r === true && Number.isInteger(p.ask) ? 'made' : r === true ? 'nobody' : r;
  }
  // Whether a woman's side asks a match now (VB-693; plan, section 4.1): one who holds a farm and speaks for herself asks as a man
  // does; another, asked by nobody, from the asking day of season ASK.womenFrom until the round is over.
  // `late`: as on the last asking day before the round, whatever the season (the round run at once: sim/round movingRound).
  function herSideAsks(st, id, late) {
    if (matchByOf(st, st.pawns[id]) === 'couple') return true; // the couple: she asks as he does, from the first day (VB-826)
    if (holdingOf(st, id) !== null && spokesmanOf(st, id) === id) return true;
    const c = cal(st.t),
      before = c.season < AUTUMN || (c.season === AUTUMN && c.sday < ASK.day + ASK.passes);
    return (late || (before && c.season >= ASK.womenFrom)) && askedBy(st, id) === 0;
  }
  // ---- the courting pair's own offer (VB-036; plan VB-682, sections 3 and 4.1) ----
  // Pawn id courts: the pair's offer, due at `due` (the round), if they hold none and the gate allows them: the ages to marry, the kin
  // limit of the man's village, a home under the residence custom (the means and the two's hunger are read at the round, where it
  // settles: sim/marriage). No score is asked: their liking replaces it. It is made by the man to the woman, or by her where she
  // speaks for herself and he does not; the two, and a spokesman of either, answer it at the round as any match (by opinion).
  // 'made', 'held' (an offer of theirs is open), or 'wait' (the gate does not yet allow them: they wait, courting). `round` false: an
  // offer out of the round (a child on the way, VB-555), due at `due`.
  function askCourted(st, id, due = dueRound(st), round = true) {
    const p = st.pawns[id],
      q = st.pawns[p.courting],
      [m, f] = p.sex === 'm' ? [p, q] : [q, p];
    if (Number.isInteger(m.ask)) return 'held';
    if (age(st, m) < MARRIAGE.menFrom || age(st, f) < MARRIAGE.womenFrom || m.retired || f.retired) return 'wait';
    if (m.household === null || f.household === null) return 'wait';
    const cu = practice(st, settlementIdOf(st, m));
    if (!kinOk(st, m.id, f.id, cu)) return 'wait';
    const home = matchRules(st).homeFor(m, f, cu);
    if (home === null) return 'wait';
    const hers = spokesmanOf(st, f.id) === f.id && spokesmanOf(st, m.id) !== m.id,
      r = issue(st, {
        actor: hers ? f.id : m.id,
        verb: 'offer',
        target: hers ? m.id : f.id,
        args: { basis: 'match', gives: { man: m.id, home }, wants: { woman: f.id }, due, ...(round ? { round } : {}) },
        source: 'courting',
      });
    return r === true && Number.isInteger(m.ask) ? 'made' : 'wait';
  }
  VB.counter('asksMade', 'Offers made at an asking (sim/asking, VB-823)');
  // The courtship begins (sim/courting): their offer is made at once, if the gate allows them
  on('courting', (st, d) => {
    if (askCourted(st, d.man) === 'made') {
      VB.count.asksMade++;
    }
  });
  // ---- a child on the way: the offer out of the round (VB-555; design.md, Courting: A child on the way) ----
  // @state st.courtDue[]: absent or [], else the couples whose child on the way is not yet known, each {woman, man (pawn ids), t (game
  //   hours: when the pregnancy is known and their offer made), until (the last time hunger may put it off)}, sorted by t. An entry a
  //   pregnancy while courting; written here only. Plain data, saved.
  const tOf = (e) => e.t;
  on('conceivedCourting', (st, d) => {
    const t = st.t + COURT.known * DAY;
    Due.append(
      st.courtDue || (st.courtDue = []),
      { woman: d.woman, man: d.man, t, until: t + COURT.wait * DAY },
      t,
      tOf,
    );
  });
  // The couple of entry e, the pregnancy now known: their offer is made at once, by the round's acts and under its rules (askCourted:
  // the ages, a home under the residence custom, the kin limit; the means and their hunger where it settles), or their open offer of
  // the round is answered now (sim/offers conclude, early): the unplayed answer at once, the played pawn has the basis's days. While either
  // of the two is too hungry to marry it is put off a day at a time, until e.until. Nothing is made where they court no more, one has
  // married, either is in service (it waits for the round: VB-634) or the man holds an offer of another basis; refused or not
  // allowed, they are offered again at the round, by their asking. What came of it, for the tests.
  function offerKnown(st, e) {
    const f = st.pawns[e.woman],
      m = st.pawns[e.man];
    if (!f.alive || !m.alive || f.courting !== m.id || spouseOf(st, f.id) !== null) return 'gone';
    if (f.servant || m.servant) return 'service';
    if (!(f.hunger < HUNGER.marryBelow && m.hunger < HUNGER.marryBelow)) {
      if (e.t + DAY > e.until) return 'hungry';
      const later = { ...e, t: e.t + DAY };
      Due.append(st.courtDue, later, later.t, tOf);
      return 'later';
    }
    if (Number.isInteger(m.ask)) {
      const o = st.offers.find((x) => x.id === m.ask);
      return o && o.basis === 'match' && o.courted ? conclude(st, o, null, true) : 'held';
    }
    if (askCourted(st, m.id, st.t, false) === 'wait') return spouseOf(st, m.id) === f.id ? 'yes' : 'wait';
    return 'open';
  }
  // At ASK.hour, before the askings: the couples whose pregnancy is known by now (the head of the queue only; Rules for cost, 4).
  function courtDay(st) {
    const q = st.courtDue;
    while (q && q.length && q[0].t <= st.t) offerKnown(st, q.shift());
  }
  VB.counter('askings', 'Askings held: a pawn who seeks, on its asking day once a season (sim/asking, VB-823)');
  // ---- the asking ----
  // Pawn id's asking (plan, section 3): an open offer it holds lapses if its people have died, married or taken a place (it asks again on
  // its next day); else it reviews its wish (not one its controller authored, VB-1776) and walks its rungs, best first, to Stay: Heir
  // (first in line at home: it stays, and asks no rung that leaves home), Marry (one of age: askMatch, the man's side, and a woman's by herSideAsks),
  // An empty farm (a landless adult who is not the heir it wishes to be: the farm it may claim, by the basis land), and the rest, which
  // the round's walk still asks for (and where it finds an heir staying).
  // A controlled pawn's asking, and that of one it speaks for, is any pawn's, by the wish its controller set (its ranking; for a match as it
  // would, the one it names, or not this year: VB-693, the round's matcher having gone, which did this for it): the player answers
  // the offer. `at`: the asking is held as the last before the round, its offer due at that time (the round run
  // at once). What came of it: 'held', 'match', 'farm', 'round', 'nobody' (a rung it could ask found nobody) or 'stay'.
  function askFor(st, id, at = null) {
    const late = at !== null,
      due = late ? at : dueRound(st);
    VB.count.askings++;
    const p = st.pawns[id];
    if (Number.isInteger(p.ask)) {
      const o = st.offers.find((x) => x.id === p.ask),
        why = o ? staleWhy(st, o) : null;
      if (why) conclude(st, o, why);
      return 'held';
    }
    if (!authored(st, id)) chooseWish(st, id);
    // one who courts asks for the one it courts, whoever speaks for it, and for no other match (VB-036); the rungs of land stay open
    // to it, which may be the place the two wait for
    const courting = Number.isInteger(p.courting);
    if (courting) {
      const r = askCourted(st, id);
      if (r !== 'wait') return r === 'made' ? 'match' : 'held';
    }
    const rank = wishesOf(st, id).rank;
    let heirFirst = false,
      tried = false;
    for (const r of rank) {
      if (r === 'stay') break;
      if (r === 'heir') {
        heirFirst = true; // read only where a rung would take it from home (placeIfMarried ranks the heirs)
        continue;
      }
      if (r === 'match') {
        if ((courting && !headsOf(st, p)) || spouseOf(st, id) !== null) continue;
        if (age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) continue;
        // one asked by an open match asks none itself: its side answers the best it holds at the round (VB-693)
        if (p.sex === 'm' ? askedBy(st, id) > 0 : !herSideAsks(st, id, late)) continue;
        const w = wishOf(st, id, 'match');
        tried = true;
        if (askMatch(st, id, due, { only: typeof w === 'number' ? w : null }) === 'made') return 'match';
        continue;
      }
      if (r === 'farm') {
        if (!mayHoldFarm(st, id, 'ask')) continue;
        const f = claimableFarm(st, id);
        if (f === null) continue;
        if (heirFirst && placeIfMarried(st, id) !== null) return 'stay'; // the heir stays
        tried = true;
        askLand(st, id, f.village, { farm: f.id }, due);
        if (Number.isInteger(p.ask)) return 'farm';
        continue;
      }
      return tried ? 'nobody' : 'round'; // new land and service: the round's walk asks for them, and an heir stays (VB-696, VB-694)
    }
    return tried ? 'nobody' : 'stay';
  }
  VB.counter(
    'callWalk',
    'The asking queue read for a pawn whose asking found nobody, to find a farm to call at (sim/asking callAround, VB-1119)',
  );
  // The rung of an unmarried pawn whose asking found nobody to ask (VB-1119): it calls, by the verb `call`, at the nearest farm of
  // another village within a day's walk that holds one it does not know yet and might marry; not while it is unplanned (its controller's to order).
  // One look over the asking queue for a pawn whose asking found nobody (at most once a season, a pawn's asking day), the verb allows one
  // call a week; counted in callWalk.
  function callAround(st, id) {
    const p = st.pawns[id];
    if (unplanned(st, id) || spouseOf(st, id) !== null || p.household === null) return;
    const v = settlementIdOf(st, p),
      pool = [];
    for (const e of st.asking) {
      VB.count.callWalk++;
      const q = st.pawns[e.pawn],
        qv = q.sex === p.sex || !q.alive || q.household === null ? null : settlementIdOf(st, q);
      if (qv === null || qv === v || tieOf(st, id, q.id) > 0) continue;
      const h = hoursBetween(st, v, qv);
      if (h <= TRAVEL.dayWalk) pool.push({ h, farm: st.households[q.household].farmstead, q: q.id });
    }
    pool.sort((a, b) => a.h - b.h || a.q - b.q);
    for (const { farm } of pool.slice(0, ASK.pool))
      if (farm !== null && issue(st, { actor: id, verb: 'callAt', target: farm, source: 'asking' }) === true) return;
  }
  VB.counter('asksNobody', 'Askings whose rungs found nobody to ask (sim/asking, VB-823)');
  // Daily at ASK.hour: the askings due, read from the head of the queue (Rules for cost, 4). asksMade counts the offers made, asksNobody
  // the askings whose rungs found nobody to ask.
  function askingDay(st) {
    courtDay(st);
    while (st.asking.length && st.asking[0].t <= st.t) {
      const id = nextAsking(st);
      if (id === null) continue;
      const r = askFor(st, id);
      if (r === 'match' || r === 'farm') {
        VB.count.asksMade++;
      } else if (r === 'nobody') {
        VB.count.asksNobody++;
        callAround(st, id);
      }
    }
  }
  // A holder's own day, its birthday (sim/lifecycle): it considers handing the farm on (sim/marriage's rule), by an offer due at the
  // moving round (VB-824). One call a holder a year.
  on('holderYear', (st, d) => {
    const hh = holdingOf(st, d.pawn);
    if (hh !== null) handover(st, hh, (h) => heirRanking(st, st.households[h]), dueRound(st));
  });
  return { askingDay, askFor, askMatch, askCourted, offerKnown, staleWhy, dueRound };
})();

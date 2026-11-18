// @sys sim/asking: the asking day (VB-823; plan VB-682, sections 2, 3 and 7): each pawn who seeks reviews its wish on a day of its own once
//   a season (the due-queue st.asking of sim/wishes) and, holding no open offer about its future, makes the one its best open rung asks
//   for, due at the moving round, which answers it: a match, by its spokesman (the matcher's rule for one man, askMatch, which the round
//   also uses to ask anew after a refusal), or an empty farm (the basis land); a plot, new land and service are still asked by the round's
//   own walk until VB-697, VB-696 and VB-694 make them askings. An open offer whose people have died, married or taken a place lapses
//   where it is next read (staleWhy: an asking, or the round). A holder's own day is its birthday: it considers handing the farm on
//   (sim/marriage's rule, VB-824), by an offer due at the round.
VB['sim/asking'] = (() => {
  const { next: rnd } = VB['sim/rng'];
  const { DAY, YEAR, SEASON_DAYS, HUNGER, MARRIAGE, ASK } = VB['sim/rules'];
  const { age, spouseOf, wasWidowed, settlementIdOf, practice, spokesmanOf, holdingOf, fullName } = VB['sim/records'];
  const { kinOk, matchScore, matchRules, courts } = VB['sim/matching'];
  const { hoursBetween, byLand } = VB['sim/routes'];
  const { claimableFarm, askLand } = VB['sim/farmclaims'];
  const { placeIfMarried, heirRanking } = VB['sim/heirs'];
  const { issue } = VB['sim/commands'];
  const { chooseWish, wishOf, wishesOf, nextAsking } = VB['sim/wishes'];
  const { conclude } = VB['sim/offers'];
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
  const landed = (st, id) => {
    const sp = spouseOf(st, id);
    return holdingOf(st, id) !== null || (sp !== null && holdingOf(st, sp) !== null);
  };
  // Why open offer o can no longer be answered, or null: one of its people has died; for a match, one of the two has married; for land,
  // the asker has taken a place.
  function staleWhy(st, o) {
    const ids = o.basis === 'match' ? [o.gives.man, o.wants.woman] : [o.from, o.to].filter(Number.isInteger);
    for (const id of ids) {
      const p = st.pawns[id];
      if (!p || !p.alive) return `${p ? fullName(p) : 'one of them'} has died`;
      if (o.basis === 'match' && spouseOf(st, id) !== null) return `${fullName(p)} has married`;
    }
    if (o.basis === 'land' && Number.isInteger(o.from) && landed(st, o.from))
      return `${fullName(st.pawns[o.from])} has taken a place`;
    return null;
  }
  // ---- the match, asked for one man (VB-692's matcher, for one pawn; plan, sections 2 and 4.1) ----
  // Man m's spokesman offers him in marriage, due at `due`, to the best-scoring woman the round's rules allow (unmarried, of age, fed,
  // not retired, not wishing otherwise; the kin limit of his village's custom; a home under the residence custom), of those within
  // a day's walk or of a village one of the two visited (VB-288, VB-289) and asked by fewer than ASK.held open matches (who is spoken
  // for is news), the nearest villages first, at
  // most ASK.pool of them weighed (asksWeighed). The unmarried women of 18 or more are read from the asking queue, which holds every one
  // of them (askWalk). `not`: one he may not ask (she has just refused him); `only`: the one he wishes; `roll`: the go-ahead draw of the
  // round's matcher (MARRIAGE.goAhead). 'made', or what stood in the way: 'nobody', 'means' (the home cannot feed another mouth) or why
  // the offer was refused.
  function askMatch(st, m, due, { not = null, only = null, roll = false } = {}) {
    const p = st.pawns[m],
      v = settlementIdOf(st, p);
    if (v === null) return 'nobody';
    const asked = new Map();
    for (const o of st.offers) if (o.basis === 'match') asked.set(o.wants.woman, (asked.get(o.wants.woman) || 0) + 1);
    const cands = [];
    for (const e of st.asking) {
      VB.count.askWalk++;
      const id = e.pawn,
        f = st.pawns[id];
      if (f.sex !== 'f' || id === not || (only !== null && id !== only) || !f.alive || f.retired) continue;
      if (f.household === null || f.hunger >= HUNGER.marryBelow || age(st, f) < MARRIAGE.womenFrom) continue;
      if (spouseOf(st, id) !== null || (asked.get(id) || 0) >= ASK.held) continue;
      if (f.wish && wishOf(st, id, 'match') === false) continue;
      const fv = settlementIdOf(st, f);
      if (fv === null || (fv !== v && !(byLand(st, v, fv) && courts(st, p, f, v, fv)))) continue; // a day's walk, or visited (VB-289)
      cands.push({ f, h: fv === v ? 0 : hoursBetween(st, v, fv) });
    }
    cands.sort((a, b) => a.h - b.h);
    const cu = practice(st, v),
      rules = matchRules(st),
      pm = rules.place(m),
      me = { ...p, age: age(st, p) }; // the score reads the ages as of now
    let best = null,
      bs = -Infinity,
      n = 0;
    for (const { f } of cands) {
      if (n >= ASK.pool) break;
      if (!kinOk(st, m, f.id, cu)) continue;
      const home = rules.homeFor(p, f, cu, pm);
      if (home === null) continue;
      n++;
      VB.count.asksWeighed++;
      const s = matchScore(
        st,
        me,
        { ...f, age: age(st, f) },
        rnd(st.rng.society),
        wasWidowed(st, m) || wasWidowed(st, f.id),
      );
      if (s > bs) {
        bs = s;
        best = { f, home };
      }
    }
    if (!best || bs < MARRIAGE.minScore || (roll && rnd(st.rng.society) > MARRIAGE.goAhead)) return 'nobody';
    if (!rules.affords(best.home)) return 'means';
    const r = issue(st, {
      actor: spokesmanOf(st, m),
      verb: 'offer',
      target: spokesmanOf(st, best.f.id),
      args: { basis: 'match', gives: { man: m, home: best.home }, wants: { woman: best.f.id }, due, round: true },
      source: 'asking',
    });
    return r === true && Number.isInteger(p.ask) ? 'made' : r === true ? 'nobody' : r;
  }
  // ---- the asking ----
  // Pawn id's asking (plan, section 3): an open offer it holds lapses if its people have died, married or taken a place (it asks again on
  // its next day); else it reviews its wish (not the played pawn's: the player sets it) and walks its rungs, best first, to Stay: Heir
  // (first in line at home: it stays, and asks no rung that leaves home), Marry (a man of age: askMatch; a woman's side asks from VB-693),
  // An empty farm (a landless adult who is not the heir it wishes to be: the farm it may claim, by the basis land), and the rest, which
  // the round's walk still asks for (and where it finds an heir staying).
  // The played pawn's own asking makes no offer for it (it asks by the verb when it likes); its spokesman, if another and unplayed, asks
  // its match as any member's unless its wish says not this year. What came of it: 'held', 'played', 'match', 'farm', 'round', 'nobody'
  // (a rung it could ask found nobody) or 'stay'.
  function askFor(st, id) {
    VB.count.askings++;
    const p = st.pawns[id],
      played = st.player ? st.player.pawn : null;
    if (Number.isInteger(p.ask)) {
      const o = st.offers.find((x) => x.id === p.ask),
        why = o ? staleWhy(st, o) : null;
      if (why) conclude(st, o, why);
      return 'held';
    }
    if (id !== played) chooseWish(st, id);
    const speaker = spokesmanOf(st, id);
    if (speaker === played) return 'played';
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
        if (p.sex !== 'm' || spouseOf(st, id) !== null || age(st, p) < MARRIAGE.menFrom) continue;
        const w = wishOf(st, id, 'match');
        tried = true;
        if (askMatch(st, id, dueRound(st), { only: typeof w === 'number' ? w : null, roll: true }) === 'made')
          return 'match';
        continue;
      }
      if (id === played) break; // the rungs that leave home: the played pawn's own to ask
      if (r === 'farm') {
        if (landed(st, id)) continue;
        const f = claimableFarm(st, id);
        if (f === null) continue;
        if (heirFirst && placeIfMarried(st, id) !== null) return 'stay'; // the heir stays
        tried = true;
        askLand(st, id, f.village, { farm: f.id }, dueRound(st));
        if (Number.isInteger(p.ask)) return 'farm';
        continue;
      }
      return tried ? 'nobody' : 'round'; // a plot, new land, service: the round's walk asks for them, and an heir stays (VB-697, VB-696, VB-694)
    }
    return tried ? 'nobody' : 'stay';
  }
  // Daily at ASK.hour: the askings due, read from the head of the queue (Rules for cost, 4). asksMade counts the offers made, asksNobody
  // the askings whose rungs found nobody to ask.
  function askingDay(st) {
    while (st.asking.length && st.asking[0].t <= st.t) {
      const id = nextAsking(st);
      if (id === null) continue;
      const r = askFor(st, id);
      if (r === 'match' || r === 'farm') {
        VB.count.asksMade++;
      } else if (r === 'nobody') {
        VB.count.asksNobody++;
      }
    }
  }
  // A holder's own day, its birthday (sim/lifecycle): it considers handing the farm on (sim/marriage's rule), by an offer due at the
  // moving round (VB-824). One call a holder a year.
  on('holderYear', (st, d) => {
    const hh = holdingOf(st, d.pawn);
    if (hh !== null) handover(st, hh, (h) => heirRanking(st, st.households[h]), dueRound(st));
  });
  return { askingDay, askFor, askMatch, staleWhy, dueRound };
})();

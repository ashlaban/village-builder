// @sys sim/advice: the retired's voice (VB-1316; design.md, Inheritance, The retired; docs/plans/VB-1122.md, section 3): the basis `advice`
//   of sim/offers, by which a retired member of a household offers its head one of the head's own verbs (a target, the rotation, the
//   season's order, a crop out of turn, or a grandchild's match), which the head takes by its opinion of the adviser and the adviser's
//   standing and then carries out itself; and an unplayed retired pawn's own advice, once a year at its head's spring planning day
// @state pawn.advisedIn (VB-1316): absent, else the year (game years since the start) in which the retired pawn last gave its spring
//   advice (sim/advice): once a year. Plain data, saved with the pawn.
VB['sim/advice'] = (() => {
  // The kinds of event it writes on the record (sim/eventkinds, VB-1946).
  VB['sim/eventkinds'].eventKinds('sim/advice', {
    advice: { keep: 'generation' }, // a retired member's advice taken by its head (VB-1316)
  });
  const Offers = VB['sim/offers'];
  const { issue, VERBS } = VB['sim/commands'];
  const { YEAR, MARRIAGE, ASK, cal } = VB['sim/rules'];
  const { opinionOf } = VB['sim/relations'];
  const {
    fullName,
    settlementIdOf,
    membersOf,
    matchByOf,
    spouseOf,
    age,
    spokesmanOf,
    practice,
    log,
    atHousehold,
    unplanned,
  } = VB['sim/records'];
  const { headView } = VB['sim/plans'];
  const { askingIn } = VB['sim/wishes'];
  const { kinOk } = VB['sim/matching'];
  const { askMatch, dueRound } = VB['sim/asking'];
  const { on } = VB['sim/events'];
  // @tunable ADVICE: the retired's advice to its head: when the head takes it, and when an unplayed retired gives it
  // The head takes advice when its opinion of the adviser (-1 to 1) times the adviser's standing over its village's mean reaches `heed`
  // (a parent's bond alone is 0.3); an unplayed retired advises a store's target where the head's departs from the custom's (its
  // culture's template, unbiased: the old one's reckoning) by more than `gap` of the custom's; the played head answers within `wait` days.
  // A retired grandparent wishes a match for a grandchild with the one of those who seek in its village it thinks best of, at an opinion
  // of `fancy` or more.
  const ADVICE = Object.freeze({ heed: 0.2, gap: 0.1, wait: 3, fancy: 0.1 });
  // The head's verbs a retired member may advise (plan VB-1122, section 3); `order` is the season's routines; `match` the head's match
  // offer for a grandchild (args {pawn, partner}), which sim/asking's askMatch makes.
  const ADVISED = Object.freeze(['target', 'rotation', 'order', 'sowOutOfTurn', 'match']);
  const yearOf = (t) => Math.floor(t / YEAR);
  const HEADS = ['heads', 'consent'];
  // Is pawn g a grandchild of pawn r
  const grandchildOf = (st, r, g) =>
    [g.father, g.mother].some((q) => q !== null && (st.pawns[q].father === r || st.pawns[q].mother === r));
  // Why the head (pawn head of household hh) may not ask the match args {pawn, partner} as advised, or null: the custom gives the match to
  // the heads, the head speaks for the grandchild, both unmarried and of age, the grandchild holds no open offer about its future.
  function matchWhy(st, head, hh, args) {
    const g = args && st.pawns[args.pawn],
      q = args && st.pawns[args.partner];
    if (!g || !q || !g.alive || !q.alive) return 'a match names two living pawns';
    if (g.household !== hh.id) return `${fullName(g)} is not of the household`;
    if (!HEADS.includes(matchByOf(st, g))) return 'the custom leaves the match to the couple';
    if (spokesmanOf(st, g.id) !== head) return `${fullName(st.pawns[head])} does not speak for ${fullName(g)}`;
    if (g.sex === q.sex) return 'a match is of a man and a woman';
    for (const p of [g, q]) {
      if (spouseOf(st, p.id) !== null) return `${fullName(p)} is married`;
      if (p.retired || age(st, p) < (p.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom))
        return `${fullName(p)} is not of an age to marry`;
    }
    return Number.isInteger(g.ask) ? `${fullName(g)} holds an open offer already` : null;
  }
  // The command the advice o asks the head to issue
  const commandOf = (st, o) => ({
    actor: o.to,
    verb: o.gives.verb,
    target: st.pawns[o.from].household,
    args: o.gives.args,
    source: 'pawn',
  });
  // Why advice o may not be offered, or null: the adviser is retired and lives in the household its target holds; the verb is one of
  // ADVISED and its check holds for the head (VB-1316).
  function adviceWhy(st, o) {
    const p = st.pawns[o.from],
      hh = p.household === null ? null : st.households[p.household];
    if (!p.retired) return `${fullName(p)} is not retired`;
    if (!hh || hh.dissolved || hh.holder !== o.to || o.to === o.from)
      return `${fullName(p)} does not live with the head it advises`;
    const g = o.gives;
    if (!g || !ADVISED.includes(g.verb)) return `one advises the head on ${ADVISED.join(', ')}`;
    if (g.verb === 'match') return matchWhy(st, o.to, hh, g.args);
    return VERBS[g.verb].check(st, commandOf(st, o));
  }
  VB.counter(
    'adviceStanding',
    'Members of a village read for its mean standing, an advice weighed (sim/advice weightOf, VB-1316)',
  );
  // The weight the head gives the adviser's word: its opinion of it times its standing over the mean standing of its village (one walk
  // of the village's members, `adviceStanding`)
  function weightOf(st, head, adviser) {
    const p = st.pawns[adviser],
      v = settlementIdOf(st, p),
      people = v === null ? [] : membersOf(st, v);
    VB.count.adviceStanding += people.length;
    const mean = people.length ? people.reduce((s, q) => s + q.standing, 0) / people.length : 0;
    return opinionOf(st, head, adviser) * (mean > 0 ? p.standing / mean : 1);
  }
  // In words: "a hay target of 1.2 winters", "the rotation two-field", "a match of A and B"
  function words(st, g) {
    const args = g.args || {};
    if (g.verb === 'target')
      return `a ${args.store} target of ${args.n === null ? "the custom's" : Math.round(args.n * 10) / 10}`;
    if (g.verb === 'match')
      return `the match of ${fullName(st.pawns[args.pawn])} and ${fullName(st.pawns[args.partner])}`;
    if (g.verb === 'rotation') return `the rotation ${args.rotation}`;
    if (g.verb === 'sowOutOfTurn') return `${args.crop} out of turn`;
    return "the season's order of work";
  }
  VB.counter('adviceTaken', 'Advice taken by a head and carried out (sim/advice, VB-1316)');
  // What a yes does: the head issues the verb itself (the act is the head's); for a match, its match offer by askMatch, due at the round
  function carry(st, o) {
    const g = o.gives;
    let r;
    if (g.verb === 'match') {
      const why = matchWhy(st, o.to, st.households[st.pawns[o.from].household], g.args);
      r = why || askMatch(st, g.args.pawn, dueRound(st), { only: g.args.partner });
      if (r === 'made') r = true;
      else if (r === 'nobody') r = 'the match could not be asked';
    } else r = issue(st, commandOf(st, o));
    if (r !== true) return r;
    VB.count.adviceTaken++;
    log(st, `${fullName(st.pawns[o.to])} took the advice of ${fullName(st.pawns[o.from])}: ${words(st, g)}.`, {
      kind: 'advice',
      pawn: o.to,
      other: o.from,
      ...atHousehold(st, st.households[st.pawns[o.to].household]),
    });
    return true;
  }
  Offers.basis('advice', {
    books: 'nothing',
    memory: false, // a no books nothing (plan VB-1122, section 3)
    wait: () => ADVICE.wait,
    check: (st, o) => adviceWhy(st, o) || {},
    answers: (st, o) => [{ key: 'head', by: o.to, yes: null }],
    weigh: (st, o) => weightOf(st, o.to, o.from) >= ADVICE.heed,
    settle: carry,
    what: (st, o) => `the advice of ${fullName(st.pawns[o.from])}, ${words(st, o.gives)}`,
  });

  // ---- the unplayed retired's own advice (plan VB-1122, section 3) ----
  // The target it advises, {store, n}, or null: where the head's hay target departs from the custom's by more than ADVICE.gap of it, the
  // custom's. Hay alone: a chosen target lasts until cleared, and the custom's fields follow the household's food, so a number fixed
  // now would stand stale; the winters of hay do not move.
  function targetAdvice(st, hh) {
    const V = headView(st, hh.id),
      T = V && V.targets.hay;
    if (!T || !(T.custom > 0)) return null;
    if (!hh.herds || !hh.herds.length) return null; // no herd to feed
    return Math.abs(T.now - T.custom) > ADVICE.gap * T.custom ? { store: 'hay', n: T.custom } : null;
  }
  VB.counter(
    'adviceMatchWalk',
    "Entries of the asking queue read for a grandchild's match, a retired grandparent's advice (sim/advice, VB-1316)",
  );
  // The match a retired grandparent wishes for grandchild g, args {pawn, partner}, or null: of those who seek in its village (the asking
  // queue's part, at most ASK.pool read, `adviceMatchWalk`), of the other sex and of age, the one it thinks best of, at ADVICE.fancy or more.
  function matchAdvice(st, r, g, hh) {
    const v = settlementIdOf(st, r);
    if (v === null) return null;
    const cu = practice(st, v);
    let best = null,
      bo = ADVICE.fancy,
      n = 0;
    for (const e of askingIn(st, v)) {
      if (n++ >= ASK.pool) break;
      VB.count.adviceMatchWalk++;
      const q = st.pawns[e.pawn];
      if (q.sex === g.sex || !q.alive || q.retired || q.household === null || q.household === hh.id) continue;
      if (spouseOf(st, q.id) !== null || age(st, q) < (q.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) continue;
      const [m, f] = g.sex === 'm' ? [g, q] : [q, g];
      if (!kinOk(st, m.id, f.id, cu)) continue;
      const o = opinionOf(st, r.id, q.id);
      if (o >= bo) {
        bo = o;
        best = q.id;
      }
    }
    return best === null ? null : { pawn: g.id, partner: best };
  }
  // The grandchildren of r in household hh whose match it may wish: unmarried, of age, holding no open offer, not the played pawn
  function grandchildren(st, r, hh) {
    const out = [];
    for (const m of hh.members) {
      const g = st.pawns[m];
      if (!g.alive || g.household !== hh.id || unplanned(st, g.id) || g.retired || Number.isInteger(g.ask)) continue;
      if (!grandchildOf(st, r.id, g) || spouseOf(st, g.id) !== null) continue;
      if (age(st, g) >= (g.sex === 'm' ? MARRIAGE.menFrom : MARRIAGE.womenFrom)) out.push(g);
    }
    return out;
  }
  VB.counter(
    'adviceOffered',
    'Advice offered by a retired member to its head, at its spring planning day (sim/advice, VB-1316)',
  );
  // Pawn p, retired in household hh, advises its head this spring: a store's target where the head's departs from the custom's, and a
  // match for the first grandchild of age it finds one for. Each an offer of basis `advice`, due at once.
  function advise(st, p, hh) {
    p.advisedIn = yearOf(st.t);
    const offer = (gives) => {
      const ok = issue(st, {
        actor: p.id,
        verb: 'offer',
        target: hh.holder,
        args: { basis: 'advice', gives },
        source: 'pawn',
      });
      if (ok === true) {
        VB.count.adviceOffered++;
      }
      return ok;
    };
    const t = targetAdvice(st, hh);
    if (t) offer({ verb: 'target', args: t });
    if (!HEADS.includes(matchByOf(st, p))) return;
    for (const g of grandchildren(st, p, hh)) {
      const args = matchAdvice(st, p, g, hh);
      if (args) {
        offer({ verb: 'match', args });
        return;
      }
    }
  }
  // At a household's planning day in spring (sim/plans' event planReviewed), each retired member not unplanned that has not yet advised
  // this year advises its head (a walk of the household's members, once a planning day).
  on('planReviewed', (st, d) => {
    if (d.why !== 'day' || d.plan.holder.type !== 'household' || cal(st.t).season !== 0) return;
    const hh = st.households[d.plan.holder.id];
    if (hh.dissolved || hh.holder === null || hh.holder === undefined || !st.pawns[hh.holder].alive) return;
    const y = yearOf(st.t);
    for (const m of hh.members) {
      const p = st.pawns[m];
      if (!p.alive || !p.retired || p.household !== hh.id || p.id === hh.holder || unplanned(st, p.id)) continue;
      if (p.advisedIn === y) continue;
      advise(st, p, hh);
    }
  });
  return { ADVICE, ADVISED, adviceWhy, weightOf, targetAdvice, matchAdvice, advise };
})();

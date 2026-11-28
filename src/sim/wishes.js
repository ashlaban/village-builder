// @sys sim/wishes: every pawn's wish at the moving round (VB-680; docs/plans/VB-682.md, section 3): a ranking of rungs, each one answer
// to "where do I live next year", chosen by the pawn before the round (its ambition, its hunger) and by the player for the pawn it plays
// (the wish verb); wishOf, the one read of it, where the round asks what a pawn itself wants; whose yes a move needs (moveWhy); and
// the asking day's due-queue, when each pawn who seeks next reviews its wish (VB-823)
VB['sim/wishes'] = (() => {
  const Due = VB['sim/due'];
  const { HUNGER, MARRIAGE, ASK, DAY, YEAR, SEASON_DAYS } = VB['sim/rules'];
  const { of: traitOf } = VB['sim/traits'];
  const { age, spokesmanOf, spouseOf, holdingOf, personEvent, fullName, settlementIdOf } = VB['sim/records'];
  const { on } = VB['sim/events'];
  // @tunable WISH: a pawn's wish at the moving round: its rungs and what each weighs
  // A pawn's wish at the moving round (sim/wishes, VB-680; docs/plans/VB-682.md, section 3): `rungs`, the answers to "where do I live next
  // year" in their default ranking, best first (heir to the farm it lives on, a match, an empty farm, a plot, new land, service, stay at
  // home: the order of the round's steps); from ambition `landAmbition` a pawn ranks new land above a plot.
  const WISH = Object.freeze({
    rungs: Object.freeze(['heir', 'match', 'farm', 'plot', 'party', 'service', 'stay']),
    landAmbition: 0.75,
  });
  // @state pawn.wish (VB-680): absent or null for the default wish (WISH.rungs as ranked, any farm, whoever its spokesman's asking finds), else
  //   {rank (WISH.rungs in the pawn's order, best first; a rung ranked after 'stay' is one it would not take), farm (a farm id: only that
  //   farm, or null), partner (a pawn id: that partner, or null), and by: 'pawn' when its controller authored it through the wish verb
  //   (VB-1776; kept so even when it is the default)}. Written by the pawn's own choosing at the start of the moving round (chooseWishes)
  //   and on its asking day for every living pawn of an age to marry whose wish is not authored (authored: by 'pawn' while the pawn has a
  //   controller), and by the wish verb (setWish) for any pawn; read through wishOf and wishesOf. Plain data, saved with the pawn.
  const RUNGS = WISH.rungs,
    LEAVING = ['farm', 'plot', 'party', 'service'], // the rungs that take a pawn out of its home
    FROM = Math.min(MARRIAGE.menFrom, MARRIAGE.womenFrom),
    LAND_FIRST = RUNGS.filter((r) => r !== 'party'); // the ambitious pawn's ranking: New land just above A plot
  LAND_FIRST.splice(LAND_FIRST.indexOf('plot'), 0, 'party');
  const rankOf = (p) => (p.wish ? p.wish.rank : RUNGS);
  // Pawn id's wish was authored by its controller (the wish verb) and the controller is still there: the default author (its own
  // choosing) does not rewrite it (design.md section 7, Plans at four scales: Authors). Once the controller ends, the next choosing does.
  const authored = (st, id) => {
    const p = st.pawns[id];
    return !!(p.wish && p.wish.by === 'pawn' && p.control);
  };
  const wanted = (rank, r) => rank.indexOf(r) < rank.indexOf('stay');
  // The ranking with rung r moved: to the head (`first`), among the wanted at its default place, or to be the first of those declined.
  function place(rank, r, how) {
    const rest = rank.filter((x) => x !== r),
      s = rest.indexOf('stay');
    if (how === 'first') rest.unshift(r);
    else if (how === 'decline') rest.splice(s + 1, 0, r);
    else {
      const d = RUNGS.indexOf(r),
        i = rest.findIndex((x, k) => k < s && RUNGS.indexOf(x) > d);
      rest.splice(i === -1 ? s : i, 0, r);
    }
    return rest;
  }
  // The wish, kept as null when it is the default (and left absent on a pawn that never held another: the save stays small), unless
  // authored (`by` 'pawn').
  function write(p, rank, farm, partner, by = null) {
    const plain = farm === null && partner === null && rank.every((r, i) => r === RUNGS[i]);
    if (by) p.wish = { rank, farm, partner, by };
    else if (!plain) p.wish = { rank, farm, partner };
    else if (p.wish) p.wish = null;
  }
  VB.counter(
    'wishWalk',
    "Pawn records walked by the pawns' own choosing of their wishes, once a moving round (sim/wishes, VB-680)",
  );
  // ---- the pawn's own choosing, at the start of the round (sim/lifecycle) ----
  // Each living pawn of an age to marry whose wish is not authored ranks the rungs (plan, section 3): the default; New land above A plot at
  // ambition WISH.landAmbition or more; Stay above Marry while it is at a hunger of HUNGER.marryBelow or more ("not this year"). Which farm
  // and whom it takes it leaves to the round. One walk of the living, a year (`wishWalk`).
  function chooseWishes(st) {
    VB.count.wishWalk += st.living.length;
    for (const id of st.living) if (!authored(st, id)) chooseWish(st, id);
  }
  // One pawn's own choosing (the round's walk, and its asking day, VB-823): nothing for one under the age to marry.
  function chooseWish(st, id) {
    const p = st.pawns[id];
    if (age(st, p) < FROM) return;
    let rank = RUNGS;
    if (traitOf(st, id, 'ambition') >= WISH.landAmbition) rank = LAND_FIRST;
    if (p.hunger >= HUNGER.marryBelow) rank = place(rank, 'match', 'decline');
    write(p, rank, null, null);
  }
  // ---- the read ----
  // What pawn id wishes at the round, by kind: 'out' (true: it would leave though heir to a farm; false: it would stay rather than take
  // land, new land or service; null: as its rungs fall), 'claim' (a farm id, only that one; false, none; null, any), 'serve' (false, it
  // declines service; null, it would serve), 'match' (a pawn id, that partner; false, not this year; null, whoever the asking finds),
  // 'settle' (true: New land heads its ranking, so it leads or follows a party without the draws; false: never; null: the draws decide).
  function wishOf(st, id, kind) {
    const p = st.pawns[id],
      w = p.wish,
      rank = rankOf(p);
    if (kind === 'out') return !wanted(rank, 'heir') ? true : LEAVING.every((r) => !wanted(rank, r)) ? false : null;
    if (kind === 'claim') return !wanted(rank, 'farm') ? false : w ? w.farm : null;
    if (kind === 'serve') return wanted(rank, 'service') ? null : false;
    // a courting pawn's match is the one it courts, and it asks no other (VB-036)
    if (kind === 'match')
      return !wanted(rank, 'match') ? false : Number.isInteger(p.courting) ? p.courting : w ? w.partner : null;
    if (kind === 'settle') return rank[0] === 'party' ? true : wanted(rank, 'party') ? null : false;
    return null;
  }
  const wishesOf = (st, id) => ({
    out: wishOf(st, id, 'out'),
    claim: wishOf(st, id, 'claim'),
    serve: wishOf(st, id, 'serve'),
    match: wishOf(st, id, 'match'),
    settle: wishOf(st, id, 'settle'),
    rank: [...rankOf(st.pawns[id])],
  });
  // ---- the wish verb's write (sim/player registers it: any pawn's controller authors it) ----
  // Pawn id's wish of `kind` set to `value`, the shape already checked: 'rank' takes a whole ranking of WISH.rungs; the others as wishOf
  // reads them. Staying (out false) declines every rung that leaves home; moving out (out true) declines the heir's, and either way back
  // (out null) wants the heir's; out true or null wants every rung that leaves again when it had declined them all. True, or why not.
  function setWish(st, id, kind, value) {
    const p = st.pawns[id],
      w = p.wish;
    let rank = rankOf(p),
      farm = w ? w.farm : null,
      partner = w ? w.partner : null;
    const leaveAgain = (r) =>
      LEAVING.every((x) => !wanted(r, x)) ? LEAVING.reduce((a, x) => place(a, x, 'want'), r) : r;
    if (kind === 'rank') {
      if (!Array.isArray(value) || value.length !== RUNGS.length || RUNGS.some((r) => !value.includes(r)))
        return `a ranking holds each of ${RUNGS.join(', ')} once`;
      rank = [...value];
    } else if (kind === 'out') {
      if (value === false) rank = LEAVING.reduce((a, x) => place(a, x, 'decline'), place(rank, 'heir', 'want'));
      else rank = leaveAgain(place(rank, 'heir', value === true ? 'decline' : 'want'));
    } else if (kind === 'claim') {
      rank = place(rank, 'farm', value === false ? 'decline' : 'want');
      farm = Number.isInteger(value) ? value : null;
    } else if (kind === 'serve') rank = place(rank, 'service', value === false ? 'decline' : 'want');
    else if (kind === 'match') {
      rank = place(rank, 'match', value === false ? 'decline' : 'want');
      partner = Number.isInteger(value) ? value : null;
    } else if (kind === 'settle')
      rank = place(rank, 'party', value === true ? 'first' : value === false ? 'decline' : 'want');
    else return `there is no wish ${kind}`;
    write(p, rank, farm, partner, 'pawn');
    return true;
  }
  // The default wish, for a pawn the player starts to play (sim/commands' inhabit): as the round would have it with no wish made.
  const resetWish = (st, id) => write(st.pawns[id], RUNGS, null, null);
  // A wished partner ends when the one who wished or the partner marries (a and b have married) or dies (a is b): a's and b's own, and
  // that of each pawn with a controller (sim/lifecycle; only a controller's wish names a partner the pair is not: the own choosing names
  // none). A pawn whose controller has ended keeps its partner until its own choosing at the next round.
  // A controlled pawn's wish for a match told as lapsed (VB-1113): the wished partner `q` married the other of the pair (a, b) or died
  // (a is b). A personal event that stops a skip.
  function lapsed(st, id, q, a, b) {
    const w = st.pawns[q],
      other = a === b ? null : st.pawns[q === a ? b : a],
      why = other
        ? `${w.sex === 'f' ? 'she' : 'he'} married ${fullName(other)}`
        : `${w.sex === 'f' ? 'she' : 'he'} died`;
    personEvent(st, id, 'wishLapsed', `Your wish for ${fullName(w)} lapsed: ${why}`, {
      other: q,
      village: settlementIdOf(st, st.pawns[id]),
    });
  }
  function endPartner(st, a, b) {
    const ids = [a, b];
    for (const id of st.controlled || []) if (id !== a && id !== b) ids.push(id);
    for (const id of ids) {
      const w = st.pawns[id].wish;
      if (w && w.partner !== null && (id === a || id === b || w.partner === a || w.partner === b)) {
        if (id !== a && id !== b) lapsed(st, id, w.partner, a, b);
        write(st.pawns[id], w.rank, w.farm, null, w.by || null);
      }
    }
  }
  // ---- whose yes a move needs (VB-692), read by every basis of a life's offer and by the move verb ----
  // Whose yes pawn id's move to household hh (an id, or null for a household not yet founded: new land) for `reason` needs (VB-692; plan
  // VB-682, section 5; Kim, 16 November): [{key, by}], or why it cannot be. The pawn's own ('self') and the receiving head's ('head', the
  // holder, where another holds it), always; the head it leaves ('left') only for a marriage (its spokesman, where another speaks for
  // it) or for one under 18 (the holder of its household); an adult leaves for service or new land without leave. A minor whose keeper
  // (a parent, or its guardian) lives with it goes into service only with that keeper (it follows, `with`, and is not asked); one with
  // none left at home is placed, by its kin (`care`, its own yes not asked) or in service, as a dissolved household's people are.
  const kept = (st, p) =>
    p.household !== null &&
    !st.households[p.household].dissolved && // a dissolved household's people are each placed (sim/heirs' extinct)
    ([p.father, p.mother].some((q) => q !== null && st.pawns[q].alive && st.pawns[q].household === p.household) ||
      (st.households[p.household].ward === p.id && Number.isInteger(st.households[p.household].guardian)));
  function moveWhy(st, id, hh, reason) {
    const p = st.pawns[id],
      minor = !(p.age >= 18),
      out = [];
    if (minor && reason === 'service' && kept(st, p))
      return 'a minor goes into service only with the grown pawn who keeps it';
    if (!(minor && reason === 'care')) out.push({ key: 'self', by: id });
    const to = hh === null || hh === undefined ? null : st.households[hh],
      head = to && !to.dissolved ? to.holder : null;
    if (head !== null && head !== id) out.push({ key: 'head', by: head });
    const from = p.household === null ? null : st.households[p.household],
      left =
        from === null || from.id === hh
          ? null
          : reason === 'marriage'
            ? spokesmanOf(st, id)
            : minor && reason !== 'care'
              ? from.holder
              : null;
    if (left !== null && left !== id && left !== head) out.push({ key: 'left', by: left });
    return out;
  }
  // ---- the asking day (VB-823; plan VB-682, sections 2 and 7) ----
  // @state st.asking[]: the due-queue of the askings, {t (game hours), pawn}, in order of t (after those due at the same time): one entry
  //   a living pawn who seeks or will, at its next asking day (season day pawn mod SEASON_DAYS, at ASK.hour): one of 18 or more but the
  //   married who hold a place (the holder or the holder's spouse), and a child for the first asking day after its 18th birthday (written
  //   at its birth, so that nothing polls for its coming of age: Rules for cost, 4). Written at the birth, a widowing, a marriage, a new
  //   head and a move (the events below), and by each asking for the next season (nextAsking); dropped where the pawn dies, or marries or
  //   moves into a place. Plain data, saved; read only at its head (sim/asking).
  const SEASON = SEASON_DAYS * DAY,
    GROWN = 18;
  // Pawn id's first asking day after time t
  function askingAfter(id, t) {
    const s = Math.floor(t / SEASON) * SEASON + (id % SEASON_DAYS) * DAY + ASK.hour;
    return s > t ? s : s + SEASON;
  }
  // A married pawn who holds a place: the holder of a household, or its holder's spouse
  const placed = (st, id) => {
    const sp = spouseOf(st, id);
    return sp !== null && (holdingOf(st, id) !== null || holdingOf(st, sp) !== null);
  };
  const entryOf = (st, id) => st.asking.findIndex((e) => e.pawn === id);
  // @state st.askingBy{}: the queue by village (VB-1169), {village id: [{t, pawn}]}, each in the order the queue holds them: a cache of
  //   st.asking, kept with it here (the entry's `v` is the village it is filed under; none for a pawn of no household). Read by
  //   sim/asking and sim/visits through askingIn: the unmarried of the villages they reach, not the island's.
  const askT = (e) => e.t;
  const insertAt = (q, e) => Due.append(q, e, e.t, askT);
  function file(st, e) {
    if (e.v === null) return;
    if (!st.askingBy[e.v]) st.askingBy[e.v] = [];
    insertAt(st.askingBy[e.v], { t: e.t, pawn: e.pawn });
  }
  function unfile(st, e) {
    if (e.v === null || !st.askingBy[e.v]) return;
    const i = st.askingBy[e.v].findIndex((x) => x.pawn === e.pawn);
    if (i >= 0) st.askingBy[e.v].splice(i, 1);
  }
  const askingIn = (st, village) => st.askingBy[village] || [];
  const dropAt = (st, i) => {
    unfile(st, st.asking[i]);
    st.asking.splice(i, 1);
  };
  function enqueue(st, id, t) {
    const e = { t, pawn: id, v: settlementIdOf(st, st.pawns[id]) };
    insertAt(st.asking, e);
    file(st, e);
  }
  // Pawn id's entry made right: dropped for the dead and the married who hold a place; else, where it has none, written for its next
  // asking day (a child's, the first after it turns 18; the retired seek nothing). `widowed`: its spouse has just died (the union not
  // yet ended), so it holds no place as a married pawn.
  function seek(st, id, widowed = false) {
    const p = st.pawns[id],
      i = entryOf(st, id);
    if (!p.alive || (!widowed && placed(st, id))) {
      if (i >= 0) dropAt(st, i);
      return;
    }
    if (i >= 0) {
      const e = st.asking[i],
        v = settlementIdOf(st, p);
      if (e.v !== v) {
        unfile(st, e); // it moved: refiled under its new village, at the place its entry holds
        e.v = v;
        file(st, e);
      }
      return;
    }
    if (p.retired) return;
    enqueue(st, id, age(st, p) >= GROWN ? askingAfter(id, st.t) : askingAfter(id, p.born + GROWN * YEAR - 1e-6));
  }
  // The pawn whose asking is due by now, taken from the head of the queue, and written for its next season if it still seeks; or null.
  function nextAsking(st) {
    const q = st.asking;
    if (!q.length || q[0].t > st.t) return null;
    const e = q.shift(),
      id = e.pawn,
      p = st.pawns[id];
    unfile(st, e);
    if (!p.alive || p.retired || placed(st, id)) return null; // left in the queue by a change no event told (it seeks no more)
    enqueue(st, id, askingAfter(id, st.t));
    return id;
  }
  // The queue at the start of a run (a scenario's people, an older save's): every living pawn, as seek writes it.
  function seedAsking(st) {
    st.asking = [];
    st.askingBy = {};
    for (const id of st.living) seek(st, id);
  }
  on('born', (st, d) => seek(st, d.child));
  on('died', (st, d) => {
    seek(st, d.pawn);
    const sp = spouseOf(st, d.pawn);
    if (sp !== null) seek(st, sp, true);
  });
  on('wed', (st, d) => {
    seek(st, d.a);
    seek(st, d.b);
  });
  on('newHead', (st, d) => {
    const h = st.households[d.household].holder,
      sp = h === null ? null : spouseOf(st, h);
    if (h !== null) seek(st, h);
    if (sp !== null) seek(st, sp);
  });
  on('rehoused', (st, d) => seek(st, d.a.id));
  return {
    WISH,
    RUNGS,
    chooseWishes,
    chooseWish,
    wishOf,
    wishesOf,
    setWish,
    resetWish,
    authored,
    endPartner,
    moveWhy,
    nextAsking,
    seedAsking,
    seek,
    askingIn,
  };
})();

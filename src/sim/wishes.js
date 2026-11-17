// @sys sim/wishes: every pawn's wish at the moving round (VB-680; docs/plans/VB-682.md, section 3): a ranking of rungs, each one answer
// to "where do I live next year", chosen by the pawn before the round (its ambition, its hunger) and by the player for the pawn it plays
// (the wish verb); wishOf, the one read of it, where the round asks what a pawn itself wants; and whose yes a move needs (moveWhy)
VB['sim/wishes'] = (() => {
  const { HUNGER, MARRIAGE, WISH } = VB['sim/rules'];
  const { of: traitOf } = VB['sim/traits'];
  const { age, spokesmanOf } = VB['sim/records'];
  // @state pawn.wish (VB-680): absent or null for the default wish (WISH.rungs as ranked, any farm, whoever the round finds), else
  //   {rank (WISH.rungs in the pawn's order, best first; a rung ranked after 'stay' is one it would not take), farm (a farm id: only that
  //   farm, or null), partner (a pawn id: that partner, or null)}. Written by the pawn's own choosing at the start of the moving round
  //   (chooseWishes) for every living pawn of an age to marry but the played one, and by the wish verb (setWish) for the played pawn; read
  //   through wishOf and wishesOf. Plain data, saved with the pawn.
  const RUNGS = WISH.rungs,
    LEAVING = ['farm', 'plot', 'party', 'service'], // the rungs that take a pawn out of its home
    FROM = Math.min(MARRIAGE.menFrom, MARRIAGE.womenFrom),
    LAND_FIRST = RUNGS.filter((r) => r !== 'party'); // the ambitious pawn's ranking: New land just above A plot
  LAND_FIRST.splice(LAND_FIRST.indexOf('plot'), 0, 'party');
  const rankOf = (p) => (p.wish ? p.wish.rank : RUNGS);
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
  // The wish, kept as null when it is the default (and left absent on a pawn that never held another: the save stays small).
  function write(p, rank, farm, partner) {
    const plain = farm === null && partner === null && rank.every((r, i) => r === RUNGS[i]);
    if (!plain) p.wish = { rank, farm, partner };
    else if (p.wish) p.wish = null;
  }
  // ---- the pawn's own choosing, at the start of the round (sim/lifecycle) ----
  // Each living pawn of an age to marry but the played one ranks the rungs (plan, section 3): the default; New land above A plot at
  // ambition WISH.landAmbition or more; Stay above Marry while it is at a hunger of HUNGER.marryBelow or more ("not this year"). Which farm
  // and whom it takes it leaves to the round. One walk of the living, a year (`wishWalk`).
  function chooseWishes(st) {
    const played = st.player ? st.player.pawn : null;
    VB.count.wishWalk += st.living.length;
    for (const id of st.living) {
      const p = st.pawns[id];
      if (id === played || age(st, p) < FROM) continue;
      let rank = RUNGS;
      if (traitOf(st, id, 'ambition') >= WISH.landAmbition) rank = LAND_FIRST;
      if (p.hunger >= HUNGER.marryBelow) rank = place(rank, 'match', 'decline');
      write(p, rank, null, null);
    }
  }
  // ---- the read ----
  // What pawn id wishes at the round, by kind: 'out' (true: it would leave though heir to a farm; false: it would stay rather than take
  // land, new land or service; null: as its rungs fall), 'claim' (a farm id, only that one; false, none; null, any), 'serve' (false, it
  // declines service; null, it would serve), 'match' (a pawn id, that partner; false, not this year; null, whoever the round finds),
  // 'settle' (true: New land heads its ranking, so it leads or follows a party without the draws; false: never; null: the draws decide).
  function wishOf(st, id, kind) {
    const p = st.pawns[id],
      w = p.wish,
      rank = rankOf(p);
    if (kind === 'out') return !wanted(rank, 'heir') ? true : LEAVING.every((r) => !wanted(rank, r)) ? false : null;
    if (kind === 'claim') return !wanted(rank, 'farm') ? false : w ? w.farm : null;
    if (kind === 'serve') return wanted(rank, 'service') ? null : false;
    if (kind === 'match') return !wanted(rank, 'match') ? false : w ? w.partner : null;
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
  // ---- the wish verb's write (sim/commands: the played pawn's) ----
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
    write(p, rank, farm, partner);
    return true;
  }
  // The default wish, for a pawn the player starts to play (sim/commands' inhabit): as the round would have it with no wish made.
  const resetWish = (st, id) => write(st.pawns[id], RUNGS, null, null);
  // A wished partner ends when the one who wished or the partner marries (a and b have married) or dies (a is b): the played pawn's,
  // and a's and b's own (sim/lifecycle). A pawn the player has left keeps its partner until its own choosing at the next round.
  function endPartner(st, a, b) {
    const pl = st.player;
    for (const id of pl ? [a, b, pl.pawn] : [a, b]) {
      const w = st.pawns[id].wish;
      if (w && w.partner !== null && (id === a || id === b || w.partner === a || w.partner === b))
        write(st.pawns[id], w.rank, w.farm, null);
    }
  }
  // ---- whose yes a move needs (VB-692), read by every basis of a life's offer and by the move verb ----
  // Whose yes pawn id's move to household hh (an id, or null for a household not yet founded: new land) for `reason` needs (VB-692; plan
  // VB-682, section 5; Kim, 16 November): [{key, by}], or why it cannot be. The pawn's own ('self') and the receiving head's ('head', the
  // holder, where another holds it), always; the head it leaves ('left') only for a marriage (its spokesman, where another speaks for
  // it) or for one under 18 (the holder of its household); an adult leaves for service or new land without leave. A minor goes into
  // service only with the grown pawn who keeps it (it follows, `with`, and is not asked); under a `care` offer its kin answer for it.
  function moveWhy(st, id, hh, reason) {
    const p = st.pawns[id],
      minor = !(p.age >= 18),
      out = [];
    if (minor && reason === 'service') return 'a minor goes into service only with the grown pawn who keeps it';
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
  return { RUNGS, chooseWishes, wishOf, wishesOf, setWish, resetWish, endPartner, moveWhy };
})();

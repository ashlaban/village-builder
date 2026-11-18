// @sys sim/courting: courting (VB-036; design.md, Traits, talk and stories: Courting): two unmarried pawns who have come to like each
//   other court, from a good talk (no pass over pairs); it ends when the liking cools, one marries another or dies, or after COURT.years
//   with no offer of theirs open; a head's refusal of their match is remembered by both, who may ask for service at the next round. The
//   pair's own offer is made by sim/asking, and answered as a match (sim/marriage)
VB['sim/courting'] = (() => {
  const { COURT, YEAR } = VB['sim/rules'];
  const { personEvent, fullName, spouseOf, settlementIdOf, practice, tieOf, age } = VB['sim/records'];
  const { opinionOf, remember } = VB['sim/relations'];
  const { kinOk } = VB['sim/matching'];
  const { on, emit } = VB['sim/events'];
  // @state pawn.courting (VB-036): absent or null, else the id of the pawn it courts; the same on both sides (one at a time). Written
  //   where a courtship starts (a good talk) and ends. Plain data, saved with the pawn.
  // @state pawn.courtingSince: game hours, when the courtship began; null or absent when it courts nobody.
  // @state pawn.courtRefused: absent or null, else {by (the pawn who refused the pair's match: a spokesman, or the head of the home), t
  //   (game hours)}; only while it courts, cleared when the courtship ends and when the next moving round has read it (leavers).
  // @state st.courtships[]: the man's id of each courting couple, the index of the live ones (a cache with one writer: Rules for cost,
  //   1), in the order they began. Plain data, saved.
  const courts = (p) => (Number.isInteger(p.courting) ? p.courting : null);
  const village = (st, p) => settlementIdOf(st, p);
  // Why pawns a and b may not start to court, or null (the gate; design.md, Courting: Starting): two living, unmarried pawns of
  // opposite sex and COURT.minAge or more, courting nobody, no closer kin than the marriage limit in force in the man's village, each
  // holding the other at an opinion of COURT.opinion (oa, ob: as the talk read them) with a tie of COURT.tie.
  function barred(st, a, b, oa = opinionOf(st, a, b), ob = opinionOf(st, b, a)) {
    const pa = st.pawns[a],
      pb = st.pawns[b];
    if (!(oa >= COURT.opinion && ob >= COURT.opinion)) return 'they do not like each other enough';
    if (courts(pa) !== null || courts(pb) !== null) return 'one of them courts already';
    if (pa.sex === pb.sex) return 'two of one sex do not court';
    if (!pa.alive || !pb.alive) return 'one of them is dead';
    if (age(st, pa) < COURT.minAge || age(st, pb) < COURT.minAge) return 'one of them is too young';
    if (spouseOf(st, a) !== null || spouseOf(st, b) !== null) return 'one of them is married';
    if (!(tieOf(st, a, b) >= COURT.tie && tieOf(st, b, a) >= COURT.tie))
      return 'they do not know each other well enough';
    const m = pa.sex === 'm' ? pa : pb;
    if (!kinOk(st, a, b, practice(st, village(st, m)))) return 'too close kin for the custom of the village';
    return null;
  }
  // A good talk of a and b (sim/relations' talk): one check, and they court if the gate allows. A life event of both; `courting` is
  // emitted for the pair's own offer (sim/asking).
  on('goodTalk', (st, d) => {
    VB.count.courtCheck++;
    if (barred(st, d.a, d.b, d.oa, d.ob) !== null) return;
    const [m, f] = st.pawns[d.a].sex === 'm' ? [d.a, d.b] : [d.b, d.a];
    for (const [id, other] of [
      [m, f],
      [f, m],
    ]) {
      const p = st.pawns[id];
      p.courting = other;
      p.courtingSince = st.t;
      personEvent(st, id, 'courting', `Began courting ${fullName(st.pawns[other])}`, {
        other,
        village: village(st, p),
      });
    }
    st.courtships.push(m);
    emit(st, 'courting', { man: m, woman: f });
  });
  function clear(p) {
    p.courting = null;
    p.courtingSince = null;
    if (p.courtRefused) p.courtRefused = null;
  }
  const WHY = {
    cooled: 'their liking cooled',
    years: `${COURT.years} years went by, and they had not married`,
    married: 'one of them married another',
    died: 'death parted them',
  };
  // The courtship of pawn id ends: both court nobody, and what a head refused them is forgotten as a reason to leave. With `reason` (a
  // key of WHY), a life event of each of the two still living; without (they have married each other), none: the marriage is the event.
  function end(st, id, reason = null, why = WHY[reason]) {
    const p = st.pawns[id],
      other = courts(p);
    if (other === null) return;
    const q = st.pawns[other],
      at = st.courtships.indexOf(p.sex === 'm' ? id : other);
    if (at >= 0) st.courtships.splice(at, 1);
    clear(p);
    clear(q);
    if (reason === null) return;
    for (const [x, y] of [
      [p, q],
      [q, p],
    ])
      if (x.alive)
        personEvent(st, x.id, 'courtingEnded', `No longer courting ${fullName(y)}: ${why}`, {
          other: y.id,
          village: village(st, x),
          reason,
        });
  }
  // Is the courtship of man m past COURT.years with no offer of theirs open (pawn.ask: the pair's offer is the man's)?
  const overdue = (st, p) => st.t - p.courtingSince > COURT.years * YEAR && (p.ask === undefined || p.ask === null);
  // Why the courtship of p and the one it courts has run out, or null: the liking of either has cooled, or its years are over.
  function ran(st, p, o = opinionOf(st, p.id, p.courting)) {
    if (o < COURT.end || opinionOf(st, p.courting, p.id) < COURT.end) return 'cooled';
    const m = p.sex === 'm' ? p : st.pawns[p.courting];
    return overdue(st, m) ? 'years' : null;
  }
  // The pair is touched (sim/relations' touch: a's opinion of b, the one it courts, read as o)
  on('courtTouched', (st, d) => {
    const why = ran(st, st.pawns[d.a], d.o);
    if (why) end(st, d.a, why);
  });
  on('wed', (st, d) => {
    for (const [id, sp] of [
      [d.a, d.b],
      [d.b, d.a],
    ])
      end(st, id, courts(st.pawns[id]) === sp ? null : 'married');
  });
  on('died', (st, d) => end(st, d.pawn, 'died'));
  // The moving round reads the couples, at its start: a courtship that has run out ends. One walk of the courting couples (courtWalk).
  function review(st) {
    VB.count.courtWalk += st.courtships.length;
    for (const m of [...st.courtships]) {
      const why = ran(st, st.pawns[m]);
      if (why) end(st, m, why);
    }
  }
  // A head (`by`: a spokesman of one of the two, or the head of the home) refused the match of the courting man and woman: each of the
  // two remembers that head for it (SOCIAL.memories.refusedCourting), and they keep courting.
  function refused(st, man, woman, by) {
    for (const id of [man, woman]) {
      if (id === by || !st.pawns[id].alive) continue;
      if (st.pawns[by].alive) remember(st, id, by, 'refusedCourting');
      st.pawns[id].courtRefused = { by, t: st.t };
    }
  }
  // Those who would leave home for service at this moving round, whatever the hands at home: each of a courting couple whose match a
  // head refused at an earlier round, when it holds that head at an opinion under COURT.leaveBelow. Read once a round, by the round's
  // act for service (sim/service): the refusal is then behind them. One walk of the courting couples (courtWalk).
  function leavers(st) {
    const out = [];
    VB.count.courtWalk += st.courtships.length;
    for (const m of st.courtships)
      for (const id of [m, st.pawns[m].courting]) {
        const p = st.pawns[id],
          r = p.courtRefused;
        if (!r || st.t - r.t < YEAR / 2) continue; // refused at this round: it is the next that reads it
        p.courtRefused = null;
        if (opinionOf(st, id, r.by) < COURT.leaveBelow) out.push(id);
      }
    return out;
  }
  // The index at the start of a run (a scenario's people court nobody; a save from before courting)
  function seedCourtships(st) {
    st.courtships = [];
    for (const id of st.living) if (st.pawns[id].sex === 'm' && courts(st.pawns[id]) !== null) st.courtships.push(id);
  }
  return { barred, review, refused, leavers, seedCourtships, courtedBy: (st, id) => courts(st.pawns[id]) };
})();

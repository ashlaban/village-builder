// @sys sim/attention: the side tasks a pawn holds beside its task (VB-251): taken up and let go, within reach or out of it, and looked at
// as the holder's leg begins and ends; split from sim/agents (VB-422)
VB['sim/attention'] = (() => {
  const { cal } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'],
    { workTick } = VB['sim/progress'];
  const { on, emit } = VB['sim/events'];
  const { here, tileAt, endTile } = VB['sim/pose'];
  const { halt, begin } = VB['sim/legs'];
  const { attentionOf, inReach, manning, settle, rerate } = VB['sim/work'];
  // ---- attention (VB-251; design.md section 7): a pawn holds one task (a.job), and besides it one partial and one background task ----
  // @state agent.side: absent, or {partial, background}: the jobs the pawn holds besides its task, each a job of st.jobs listing the pawn
  //   among its workers (j.claims), or null; absent when it holds none. A kind's attention is `full` (the default), `partial` or `background`
  //   (sim/kinds): a background task is done at the side at the kind's `rate` of the pawn's hours, while the pawn is within `reach` steps of it.
  const heldAt = (a, slot) => (a.side ? a.side[slot] : null);
  // Why the pawn may not hold side task j now, or null: its slot is taken, it is no side kind, or a background task out of reach of the
  // pawn, or of its full task's site (a full task never takes a background one out of reach). A pawn with no task in hand may take a
  // background task out of its reach: it sets out for it (VB-136: the herder takes the herds to their pasture).
  function sideWhy(st, a, j) {
    const att = attentionOf(j);
    if (att === 'full') return `${j.key} is not a side task`;
    if (heldAt(a, att)) return `the pawn already holds a ${att} task`;
    if (att === 'background' && a.job && !(inReach(st, j, here(st, a)) && inReach(st, j, a.job.site)))
      return `${j.key} is out of its reach`;
    return null;
  }
  // The pawn takes up side task j; a background task out of its reach, with no task in hand, it sets out for. The kind's `held` says what
  // taking it up does (VB-136: the herds go out with the herder).
  function hold(st, a, j) {
    settle(st, j);
    if (!a.side) a.side = { partial: null, background: null };
    a.side[attentionOf(j)] = j;
    j.claims.push(a.id);
    if (attentionOf(j) === 'background' && !a.job && !inReach(st, j, here(st, a))) emit(st, 'sideAway', a); // sim/agents walks it there
    if (KINDS[j.kind].held) KINDS[j.kind].held(st, j, a, cal(st.t));
    rerate(st, j);
  }
  // The pawn lets go of side task j, which stays posted, with its progress, for others; reckoned at tick t.
  function unhold(st, a, j, t = workTick(st)) {
    settle(st, j, t);
    const i = j.claims.indexOf(a.id);
    if (i >= 0) j.claims.splice(i, 1);
    for (const slot of ['partial', 'background']) if (a.side[slot] === j) a.side[slot] = null;
    if (!a.side.partial && !a.side.background) delete a.side;
    rerate(st, j);
  }
  // A walk in hand is trodden up to here first, at the weight of the herds it drives, and goes on from there (treadTo reads the side tasks).
  function dropSides(st, a) {
    if (a.side && a.path && a.leg && a.leg.kind === 'walk') {
      halt(st, a, true, true);
      begin(st, a);
    }
    if (a.side) for (const slot of ['partial', 'background']) if (a.side && a.side[slot]) unhold(st, a, a.side[slot]);
  }
  // The matcher offers a pawn that holds a background task only tasks within its reach (a full one beyond it never, until the urgency
  // switch; VB-136: the herder may take other work within reach of the pasture); null when job j may be bid for, else why not.
  function offerWhy(st, a, j) {
    const att = attentionOf(j),
      bg = heldAt(a, 'background');
    if (att !== 'full') return sideWhy(st, a, j);
    if (bg && !inReach(st, bg, j.site)) return `${j.key} would take the background task ${bg.key} out of reach`;
    return null;
  }
  // The pawn takes a full task by the urgency switch (or an order): a background task the new site takes out of reach is let go.
  function reachAfter(st, a) {
    const bg = heldAt(a, 'background');
    if (bg && a.job && !inReach(st, bg, a.job.site)) unhold(st, a, bg);
  }
  // A background task (VB-136) is reckoned in closed form, as a task under work is (VB-472): its holders minding it give its rate (a
  // child minds the herd as long as a man: hours, not work), and its end waits in st.workDue (sideEnded). What its holder does is looked
  // at when the holder's leg begins and ends (sideCheck, VB-473): a walk that ends out of its reach lets it go, one into reach keeps it,
  // unworked, and a holder standing at other work out of its reach lets it go. A task taken down is let go at once (dropJob), and at the
  // end of the working day every holder lets go (sim/clock). Its work done, a pawn with nothing else in hand goes home (VB-136: the
  // herder brings the herds home).
  // The holder's leg has begun or ended (its background task reckoned before it changed; sim/legs tells it, legChanged): out of reach
  // the task is let go, else its rate is told again if its minding changed.
  function sideCheck(st, a) {
    const j = heldAt(a, 'background');
    if (!j) return;
    const walking = a.path && a.leg && a.leg.kind === 'walk';
    if (walking ? !inReach(st, j, endTile(st, a)) : a.phase !== null && !inReach(st, j, tileAt(st, a.x, a.y)))
      return unhold(st, a, j);
    if (Math.abs(manning(st, j) - (j.rate || 0)) > 1e-12) {
      settle(st, j);
      rerate(st, j);
    }
  }
  on('legChanged', sideCheck);
  return { heldAt, sideWhy, hold, unhold, dropSides, offerWhy, reachAfter, sideCheck };
})();

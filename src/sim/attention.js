// @sys sim/attention: the charge a pawn minds beside its task (VB-251; `mind`, VB-1750): taken up and let go, within reach or out of it,
// and looked at as the holder's leg begins and ends; split from sim/agents (VB-422)
VB['sim/attention'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { cal } = VB['sim/rules'];
  const { KINDS } = VB['sim/kinds'],
    { workTick } = VB['sim/progress'];
  const { on, emit } = VB['sim/events'];
  const { here, tileAt, endTile } = VB['sim/pose'];
  const { halt, begin } = VB['sim/legs'];
  const { attentionOf, inReach, manning, settle, rerate } = VB['sim/work'];
  // ---- a held charge (VB-251, VB-1750; design.md section 7, A held charge): a pawn holds one task (a.job), and besides it one charge ----
  // @state agent.mind: absent, or the charges the pawn minds beside its task and its walks, in the order taken up: jobs of st.jobs listing
  //   the pawn among their workers (j.claims), at most one that bars its holder's other work and one that `yields` (the herd at the side,
  //   spinning beside it). A kind is minded when sim/methods' `mind` made it so (K.mind), else its attention is `full`: a charge is
  //   minded at the kind's `rate` of the pawn's hours, while the pawn is within `reach` steps of it. Written here only; absent when empty.
  const NONE = Object.freeze([]);
  // The charges pawn a minds (never allocated: none is one frozen list), and the one of kind `kind` or that bars its work, or null.
  const charges = (a) => a.mind || NONE;
  const chargeOf = (a, kind) => {
    for (const j of charges(a)) if (kind ? j.kind === kind : !KINDS[j.kind].yields) return j;
    return null;
  };
  const minds = (a, j) => !!a.mind && a.mind.includes(j);
  // ---- assignments (VB-1405): each time a pawn takes up a task, in its full slot (sim/agents start) or as its charge (hold), the taking
  // is numbered, so that one particular assignment can be named after the job's key is reposted or the pawn takes the same job again ----
  // @state agent.assigned: absent until the pawn first takes a task, then {assignments (how many it has taken), full (the number of the
  //   assignment its task in hand was last given, or null), mind ({[job key]: that number} for each charge it minds)}. A slot's number names its
  //   assignment only while the slot still holds that job (`holds`): a task let go leaves its number, which no later taking repeats.
  //   Written only by `assign`; plain data, saved.
  function assign(a, slot, key) {
    if (!a.assigned) a.assigned = { assignments: 0, full: null, mind: {} };
    const n = ++a.assigned.assignments;
    if (slot === 'full') a.assigned.full = n;
    else a.assigned.mind[key] = n;
    return n;
  }
  // Whether pawn a holds a job of key `key` in slot (full: its task in hand; mind: a charge).
  const inSlot = (a, slot, key) =>
    slot === 'full' ? !!a.job && a.job.key === key : charges(a).some((j) => j.key === key);
  // Whether pawn a still holds the assignment {slot, key, n}: the slot holds that job, under the number it was given then. A reference
  // made before VB-1750 names its charge's slot `background` (or `partial`): it is the mind's.
  const holds = (a, ref) => {
    const slot = ref.slot === 'full' ? 'full' : 'mind';
    if (!inSlot(a, slot, ref.key) || !a.assigned) return false;
    return (slot === 'full' ? a.assigned.full : a.assigned.mind[ref.key]) === ref.n;
  };
  // A run saved before VB-1750 held its charge in agent.side {partial, background} (no kind was partial): the background task is the mind.
  function loaded(st) {
    for (const a of st.agents) {
      const j = a.side && a.side.background;
      if (a.assigned && 'background' in a.assigned) {
        const n = a.assigned.background;
        a.assigned = { assignments: a.assigned.assignments, full: a.assigned.full, mind: j && n ? { [j.key]: n } : {} };
      }
      if (!('side' in a)) continue;
      delete a.side;
      if (j) a.mind = [j];
    }
  }
  // Why the pawn may not mind charge j now, or null: j is no minded kind, the pawn minds one that bars (or yields) as j does, or j is out
  // of reach of the pawn, of its full task's site (a full task never takes a charge out of reach) or of a charge it minds. A pawn with no
  // task in hand and no charge may take a charge out of its reach: it sets out for it (VB-136: the herder takes the herds to their pasture).
  function mindWhy(st, a, j) {
    if (attentionOf(j) === 'full') return `${j.key} is not a charge to mind`;
    const yields = !!KINDS[j.kind].yields;
    for (const c of charges(a)) {
      if (!!KINDS[c.kind].yields === yields) return `the pawn already minds ${c.key}`;
      if (!inReach(st, j, here(st, a))) return `${j.key} is out of its reach beside ${c.key}`;
    }
    if (a.job && !(inReach(st, j, here(st, a)) && inReach(st, j, a.job.site))) return `${j.key} is out of its reach`;
    return null;
  }
  // The pawn takes up charge j; one out of its reach, with no task in hand, it sets out for. The kind's `held` says what taking it up
  // does (VB-136: the herds go out with the herder).
  function hold(st, a, j) {
    settle(st, j);
    a.mind = a.mind ? [...a.mind, j] : [j];
    assign(a, 'mind', j.key);
    j.claims.push(a.id);
    if (!a.job && !inReach(st, j, here(st, a))) emit(st, 'mindAway', a); // sim/agents walks it there (the last charge taken)
    if (KINDS[j.kind].held) KINDS[j.kind].held(st, j, a, cal(st.t));
    rerate(st, j);
  }
  // The pawn lets go of charge j, which stays posted, with its progress, for others; reckoned at tick t.
  function unhold(st, a, j, t = workTick(st)) {
    settle(st, j, t);
    const i = j.claims.indexOf(a.id);
    if (i >= 0) j.claims.splice(i, 1);
    if (minds(a, j)) {
      if (a.mind.length > 1) a.mind = a.mind.filter((c) => c !== j);
      else delete a.mind;
      delete a.assigned.mind[j.key];
    }
    rerate(st, j);
  }
  // A walk in hand is trodden up to here first, at the weight of the herds it drives, and goes on from there (treadTo reads the charge).
  function dropMind(st, a) {
    if (!a.mind) return;
    if (a.path && a.leg && a.leg.kind === 'walk') {
      halt(st, a, true, true);
      begin(st, a);
    }
    while (a.mind) unhold(st, a, a.mind[0]);
  }
  // The matcher offers a pawn that minds a charge only tasks within its reach (a full one beyond it never, until the urgency switch;
  // VB-136: the herder may take other work within reach of the pasture); null when job j may be bid for, else why not. A kind that
  // `yields` (VB-362: spinning, done beside the work at the house) bars nothing: a task out of its reach lets it go (reachAfter).
  function offerWhy(st, a, j) {
    const bg = chargeOf(a);
    if (attentionOf(j) !== 'full') return mindWhy(st, a, j);
    if (bg && !inReach(st, bg, j.site)) return `${j.key} would take the charge ${bg.key} out of reach`;
    return null;
  }
  // The pawn takes a full task by the urgency switch (or an order): a charge the new site takes out of reach is let go.
  function reachAfter(st, a) {
    if (!a.mind || !a.job) return;
    for (const c of [...a.mind]) if (!inReach(st, c, a.job.site)) unhold(st, a, c);
  }
  // A charge (VB-136) is reckoned in closed form, as a task under work is (VB-472): its holders minding it give its rate (a child minds
  // the herd as long as a man: hours, not work), and its end waits in st.workDue (sideEnded). What its holder does is looked at when the
  // holder's leg begins and ends (mindCheck, VB-473): a walk that ends out of its reach lets it go, one into reach keeps it, unworked, and
  // a holder standing at other work out of its reach lets it go. A task taken down is let go at once (dropJob), and at the end of the
  // working day every holder lets go (sim/clock). Its work done, a pawn with nothing else in hand goes home (VB-136: the herder brings
  // the herds home).
  // The holder's leg has begun or ended (its charge reckoned before it changed; sim/legs tells it, legChanged): out of reach the charge
  // is let go, else its rate is told again if its minding changed.
  function mindCheck(st, a) {
    if (!a.mind) return;
    const walking = a.path && a.leg && a.leg.kind === 'walk';
    for (const j of a.mind.length > 1 ? [...a.mind] : a.mind) {
      if (walking ? !inReach(st, j, endTile(st, a)) : !unbound(a) && !inReach(st, j, tileAt(st, a.x, a.y))) {
        unhold(st, a, j);
        continue;
      }
      if (Math.abs(manning(st, j) - (j.rate || 0)) > 1e-12) {
        settle(st, j);
        rerate(st, j);
      }
    }
  }
  on('legChanged', mindCheck);
  return {
    charges,
    chargeOf,
    minds,
    mindWhy,
    hold,
    unhold,
    dropMind,
    offerWhy,
    reachAfter,
    mindCheck,
    assign,
    holds,
    inSlot,
    loaded,
  };
})();

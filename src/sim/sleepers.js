// @sys sim/sleepers: sleep for every pawn (VB-1645): the hours each owes (pawn.sleep), reckoned by SLEEP (sim/sleep) once an hour over
//   the living and each step for the played pawn; the verb `sleep`, for the player and a pawn's own rule; and that rule, which sleeps a
//   pawn that owes a whole night when it is free in the working day
VB['sim/sleepers'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { SLEEP, AWAKE } = VB['sim/sleep'];
  const { here, bed } = VB['sim/pose'];
  const { release, free, goHome, idle } = VB['sim/agents'];
  const { living } = VB['sim/records'];
  const { register, issue } = VB['sim/commands'];
  const { WORK, DAY, TICKS } = VB['sim/rules'];
  // @state pawn.sleep: absent until the pawn is first reckoned (and in a save made before VB-1645), else {owed (hours of sleep it owes, 0
  //   to SLEEP.cap), asleep (boolean: it slept when last reckoned), at (the step, st.tick, last reckoned), until (null, or the game time a
  //   sleep begun by the verb `sleep` ends)}; written here only; read by sim/sleep's owedBy for mood (sim/mood) and health (sim/hunger).
  //   The played pawn's hours were st.player.sleep before VB-1645: sim/player hands them over once (adopt).
  // Asleep: under the verb `sleep`, once it stands where it sleeps (no walk, no task, no occasion); at rest on the road at night on a
  // journey (its bed is where it stands, sim/pose); or indoors where it sleeps (its house, its booth, or its bed under the open sky before
  // the booth stands, VB-1544; away, its stay's bed) with nothing in hand.
  function sleeping(st, id) {
    const a = st.agents[id],
      s = st.pawns[id].sleep;
    if (s && s.until !== null && st.t < s.until && !a.job && a.occasion === null) return !a.path;
    if (a.journey === 'rest') return !a.leg || a.leg.kind === 'wait';
    if (!a.inside || a.job || a.path || !unbound(a) || a.occasion !== null) return false;
    if (st.pawns[id].household === null && a.away === undefined) return false;
    return here(st, a) === bed(st, a);
  }
  const fresh = (st) => ({ owed: 0, asleep: false, at: st.tick, until: null });
  // The time since pawn id was last reckoned, taken as it is now: an hour awake owes AWAKE, an hour asleep pays one, within 0 and
  // SLEEP.cap. Once a step at most; not for the dead.
  function reckon(st, id) {
    if (living(st, id)) return;
    const p = st.pawns[id];
    if (!p.sleep) p.sleep = fresh(st);
    const s = p.sleep;
    if (s.at === st.tick) return;
    VB.count.sleepReckon++;
    const asleep = sleeping(st, id),
      hours = (st.tick - s.at) / TICKS;
    s.owed = Math.min(SLEEP.cap, Math.max(0, s.owed + (asleep ? -hours : AWAKE * hours)));
    s.asleep = asleep;
    s.at = st.tick;
    if (s.until !== null && st.t >= s.until) s.until = null;
  }
  // The played pawn's hours kept by sim/player before VB-1645 ({owed, asleep, at}) become its own.
  function adopt(st, id, old) {
    st.pawns[id].sleep = { owed: old.owed, asleep: old.asleep, at: old.at, until: null };
  }
  // A pawn's own rule: in the working day, one that owes a whole night (SLEEP.health.over) and is free, with nothing in hand, sleeps off
  // what it owes over SLEEP.mood.over (from a night lost, 4 hours at 6:00), then goes on with its day. Not a played pawn the player
  // drives (its automatic behaviour off): its sleep is the player's to choose.
  function ownRule(st, id) {
    const s = st.pawns[id].sleep,
      a = st.agents[id];
    if (!s || !a) return; // not reckoned: a pawn with no agent
    if (!(s.owed >= SLEEP.health.over) || (s.until !== null && st.t < s.until)) return;
    if (a.job || a.path || !unbound(a) || a.occasion !== null || a.idleUntil > st.t) return;
    if (st.player && st.player.pawn === id && !st.player.auto) return;
    const hours = Math.max(1, Math.ceil(s.owed - SLEEP.mood.over));
    if (issue(st, { actor: id, verb: 'sleep', args: { hours }, source: 'pawn' }) === true) {
      VB.count.sleepOwn++;
    }
  }
  // Each hour (sim/clock), over the living: each reckoned, and in the working day the own rule.
  function hour(st, c) {
    const day = c.hour >= WORK[0] && c.hour < WORK[1];
    for (const id of st.living) {
      reckon(st, id);
      if (day) ownRule(st, id);
    }
  }
  // The game time a sleep begun now ends: args.hours from now, or the next args.until o'clock (by default the start of work).
  function sleepUntil(st, args) {
    if (args && args.hours !== undefined) return st.t + args.hours;
    const h = args && args.until !== undefined ? args.until : WORK[0];
    let u = Math.floor(st.t / DAY) * DAY + h;
    if (u <= st.t) u += DAY;
    return u;
  }
  // sleep({until | hours}): the pawn leaves the job in hand (which keeps its progress), goes to where it sleeps and sleeps until the hour
  // args.until of the day (by default the start of work), or for args.hours; the act lasts until then. The player's, and a pawn's own
  // rule's (ownRule). Refused for the dead, the travelling, one with no place to sleep, or an hour that is none.
  register('sleep', {
    sources: ['player', 'pawn'],
    check: (st, c) => {
      const why = free(st, c.actor);
      if (why) return why;
      if (st.pawns[c.actor].household === null && st.agents[c.actor].away === undefined)
        return `pawn ${c.actor} has no place to sleep`;
      const g = c.args || {};
      if (g.hours !== undefined && !(g.hours > 0 && g.hours <= SLEEP.cap)) return `cannot sleep ${g.hours} hours`;
      if (g.hours === undefined && g.until !== undefined && !(g.until >= 0 && g.until < 24))
        return `there is no hour ${g.until} to sleep until`;
      return null;
    },
    run: (st, c) => {
      const a = st.agents[c.actor],
        until = sleepUntil(st, c.args);
      reckon(st, c.actor); // the hours before it lies down are reckoned as they were
      st.pawns[c.actor].sleep.until = until;
      if (a.job) release(st, a);
      if (!(a.inside && !a.path && here(st, a) === bed(st, a))) goHome(st, a);
      idle(st, a, until);
      return { until };
    },
    active: (st, c, ref) => st.t < ref.until,
    frees: true,
  });
  return { sleeping, reckon, adopt, hour };
})();

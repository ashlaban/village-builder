// @sys sim/plannext: what the player's plan has the played pawn do next (nextOf: the one choice, which sim/player's feeder queues with
//   automatic behaviour off and the views read without writing) and why each task waits and why the plan is idle (WAITS, waitsOf;
//   VB-1623), by the reads nextOf makes (VB-1618; VB-1629 split it from sim/playerplan). Reads only
VB['sim/plannext'] = (() => {
  const { cal } = VB['sim/rules'];
  const { VERBS } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  const { CHAINS, chainOf, chainSteps, headCmd } = VB['sim/planchains'];
  const { asleepAt, today } = VB['sim/playerplan'];
  const workCmd = (id, key) => ({ actor: id, verb: 'work', target: key, args: null, source: 'player' });
  // ---- why a task waits (VB-1623): the one closed list of reasons, each plain data for the page (planView's `waits` and `idle`) ----
  // hand: a command queued by hand goes first (its verb, target and the game hour it was begun, null before); before: an earlier task (i,
  // its index) is what the plan does next or has in hand; routine: a routine kind goes first; sleep: the sleeping hours, until `until`
  // o'clock; opens: its next step is not posted until game hour t (what: its window opening, its crop ripe, its hay dry); unposted: its
  // next step (kind) is open and its job not posted for the household now (posted at a review, while the household's own rule wants it:
  // the fields its hands till, the hay it needs); refused: the verb's own reason (text).
  const WAITS = {
    hand: (c) => ({ why: 'hand', verb: c.verb, target: c.target ?? null, since: c.begun ?? null }),
    before: (i) => ({ why: 'before', i }),
    routine: (kind) => ({ why: 'routine', kind }),
    sleep: (until) => ({ why: 'sleep', until }),
    opens: (t, what) => ({ why: 'opens', t, what }),
    unposted: (kind) => ({ why: 'unposted', kind }),
    refused: (text) => ({ why: 'refused', text }),
  };
  // What the pawn may do now for chain task tk, as a command with its `plan` mark, or why not (a WAITS reason): on a marked or free tile,
  // the project begun through the head's verb, beside any other of the household's (VB-1623); else the first step posted at its tile, in
  // the order the work goes, if its `work` verb lets the pawn take it; else its first step's opening, or that its job is not posted.
  function chainCmd(st, id, tk) {
    const name = tk.kind,
      tile = tk[name],
      hid = st.pawns[id].household,
      s = chainSteps(st, hid, name, tile),
      mark = { from: 'task', chain: name, [name]: tile };
    if (!s) return WAITS.refused(CHAINS[name].none(tile));
    if (s.where.mark) {
      const cmd = headCmd(id, hid, { what: s.where.mark, tile }),
        why = VERBS.project.check(st, cmd);
      return why === null ? { ...cmd, plan: { ...mark, kind: 'project', key: null } } : WAITS.refused(why);
    }
    const act = CHAINS[name].act && CHAINS[name].act(st, id, s.where, tile); // a chain's own act first (farmstead: its placing)
    if (act) {
      const why = VERBS[act.verb].check(st, act);
      return why === null ? { ...act, plan: { ...mark, kind: act.verb, key: null } } : WAITS.refused(why);
    }
    const x = s.steps.find((y) => y.job);
    if (x) {
      const why = VERBS.work.check(st, workCmd(id, x.job.key));
      return why === null
        ? { ...workCmd(id, x.job.key), plan: { ...mark, kind: x.job.kind, key: x.job.key } }
        : WAITS.refused(why);
    }
    const y = s.steps[0];
    if (!y) return WAITS.refused(`nothing is left to do at ${tile}`);
    return y.from > st.t ? WAITS.opens(y.from, y.what || y.kind) : WAITS.unposted(y.kind);
  }
  // What the pawn may do now for task t (a task at a tile, or by key): a command with its `plan` mark, or why not (a WAITS reason).
  function taskCmd(st, id, t) {
    if (chainOf(t)) return chainCmd(st, id, t);
    if (!st.jobs.has(t.key)) return WAITS.refused(`there is no job ${t.key}`);
    const why = VERBS.work.check(st, workCmd(id, t.key));
    return why === null
      ? { ...workCmd(id, t.key), plan: { from: 'task', kind: t.kind, key: t.key } }
      : WAITS.refused(why);
  }
  // ---- what comes next ----
  const handOf = (pl) => pl.queue.find((c) => !c.plan) || null;
  // The first job of kind k of the pawn's household that its `work` verb would let it take now, or null.
  function routineJob(st, id, k) {
    const hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k && VERBS.work.check(st, workCmd(id, j.key)) === null) return j;
    return null;
  }
  // What the plan has the played pawn do next, as a command with its `plan` mark, or null: in its sleeping hours, sleep until `until`;
  // else the first routine kind not begun today with a job of its household it may take; else the first task that may be taken now
  // (taskCmd). A command queued by hand goes first: with one queued, null. Reads only; writes nothing.
  function nextOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp || living(st, pl.pawn) || handOf(pl)) return null;
    const id = pl.pawn;
    if (asleepAt(pp.sleep, cal(st.t).hour)) {
      const cmd = { actor: id, verb: 'sleep', target: null, args: { until: pp.sleep.until }, source: 'player' };
      return VERBS.sleep.check(st, cmd) === null ? { ...cmd, plan: { from: 'sleep', kind: null, key: null } } : null;
    }
    const done = pp.day === today(st) ? pp.done : [];
    for (const k of pp.routine) {
      if (done.includes(k)) continue;
      const j = routineJob(st, id, k);
      if (j) return { ...workCmd(id, j.key), plan: { from: 'routine', kind: k, key: j.key } };
    }
    for (const t of pp.tasks) {
      const cmd = taskCmd(st, id, t);
      if (cmd.verb) return cmd;
    }
    return null;
  }
  // Whether plan mark m (a command the plan fed) is task t's.
  const markOf = (m, t) =>
    !!m &&
    m.from === 'task' &&
    (chainOf(t) ? m.chain === t.kind && m[t.kind] === t[t.kind] : !m.chain && m.key === t.key);
  // Why each task of the plan waits now (VB-1623), in the plan's order: null for the one in hand and the one the plan does next, else a
  // WAITS reason: its own (taskCmd) first, then what goes before it (a command by hand, the sleeping hours, a routine kind, an earlier
  // task); and `idle`: null, or why the plan as a whole has the pawn do nothing now though it holds tasks or a routine (a command by
  // hand holding the queue, named with the hour it was begun; else the first task's reason). The reads nextOf makes; writes nothing.
  function waitsOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp) return { tasks: [], idle: null };
    const id = pl.pawn,
      dead = living(st, pl.pawn),
      hand = handOf(pl),
      head = pl.queue[0],
      inHand = head && head.plan && head.begun !== null ? head.plan : null,
      next = nextOf(st),
      asleep = asleepAt(pp.sleep, cal(st.t).hour),
      first = inHand || (next && next.plan);
    const tasks = pp.tasks.map((t) => {
      if (dead) return WAITS.refused(dead);
      if (markOf(inHand, t) || (next && markOf(next.plan, t))) return null;
      const own = taskCmd(st, id, t);
      if (!own.verb) return own;
      if (hand) return WAITS.hand(hand);
      if (asleep || (first && first.from === 'sleep')) return WAITS.sleep(pp.sleep ? pp.sleep.until : null);
      if (first && first.from === 'routine') return WAITS.routine(first.kind);
      const i = first ? pp.tasks.findIndex((u) => markOf(first, u)) : -1;
      return i >= 0 ? WAITS.before(i) : null;
    });
    let idle = null;
    if (pp.tasks.length || pp.routine.length) {
      if (hand) idle = WAITS.hand(hand);
      else if (dead) idle = WAITS.refused(dead);
      else if (!inHand && !next) idle = tasks.find((w) => w) || null;
    }
    return { tasks, idle };
  }
  return { WAITS, nextOf, waitsOf };
})();

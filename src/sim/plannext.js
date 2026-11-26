// @sys sim/plannext: what the player's plan has the played pawn do next (nextOf: the one choice, which sim/player's feeder queues with
//   automatic behaviour off and the views read without writing) and why each task waits and why the plan is idle (WAITS, waitsOf;
//   VB-1651), by the reads nextOf makes (VB-1646; VB-1657 split it from sim/playerplan). Reads only
VB['sim/plannext'] = (() => {
  const { cal, DAY, WORK, BOOTH } = VB['sim/rules'];
  const { VERBS } = VB['sim/commands'];
  const { living } = VB['sim/records'];
  const { controlOf } = VB['sim/controller'];
  const { CHAINS, chainOf, chainSteps, headCmd, pileOf } = VB['sim/planchains'];
  const { asleepAt, today } = VB['sim/playerplan'];
  const Fieldwork = VB['sim/fieldwork'],
    Meadows = VB['sim/meadows'],
    Chores = VB['sim/chores']; // VB-1652: the rules HOLDS reads
  const { lacks } = VB['sim/projects'];
  const workCmd = (id, key) => ({ actor: id, verb: 'work', target: key, args: null, source: 'player' });
  // ---- why a task waits (VB-1651): the one closed list of reasons, each plain data for the page (planView's `waits` and `idle`) ----
  // hand: a command queued by hand goes first (its verb, target and the game hour it was begun, null before); before: an earlier task (i,
  // its index) is what the plan does next or has in hand; routine: a routine kind goes first; sleep: the sleeping hours, until `until`
  // o'clock; opens: its next step is not posted until game hour t (what: its window opening, its crop ripe, its hay dry); unposted: its
  // next step (kind) is open and its job not posted for the household now, `rule` (one of RULES) the household's own rule that holds it
  // back and `text` its words for the page (HOLDS, VB-1652); refused: the verb's own reason (text).
  const WAITS = {
    hand: (c) => ({ why: 'hand', verb: c.verb, target: c.target ?? null, since: c.begun ?? null }),
    before: (i) => ({ why: 'before', i }),
    routine: (kind) => ({ why: 'routine', kind }),
    sleep: (until) => ({ why: 'sleep', until }),
    opens: (t, what) => ({ why: 'opens', t, what }),
    unposted: (kind, h) => ({ why: 'unposted', kind, rule: h.rule, text: h.text }),
    refused: (text) => ({ why: 'refused', text }),
  };
  // ---- the household's own rule that holds an open step's job back (VB-1652): the one closed list, HOLDS, each {rule, text} ----
  // hands: a field beyond what its hands till (sim/fieldwork beyondHands, the plan's targets.workable); sowing: its sowing refused
  // (sim/fieldwork sowWhy: the seed, the thaw); hay: no hay wanted (sim/meadows hayWanted); timber: no timber home to cut; woodpile: the
  // pile at the season's goal (sim/chores, the firewood job's rule); booth: the booth's timber not all fetched to its tile; wood: no wood
  // to fetch the booth's (or an outbuilding's) timber from; stone: no stone in reach for the foundation (the wait `project`, its step not
  // opened while a project is under way, VB-1663, is gone with the limit, VB-1668); review: none of those,
  // the job posted at the household's next review.
  const HOLDS = {
    hands: (cap, tile) =>
      `the household's hands till ${cap} field${cap === 1 ? '' : 's'}; the field at ${tile} is beyond them`,
    sowing: (why) => why,
    hay: () => "the household wants no more hay: it holds its animals' winters, or keeps none",
    timber: () => 'no timber is home to cut yet',
    woodpile: () => "the woodpile holds the season's goal",
    booth: () => "the shelter's timber is not all fetched",
    wood: (what = 'booth') => `there is no wood to fetch the ${what}'s timber from`,
    stone: () => 'there is no stone to pick or quarry within reach of the house', // VB-1663: the foundation's

    review: () => "posted at the household's next review",
  };
  const RULES = Object.keys(HOLDS);
  const held = (rule, ...a) => ({ rule, text: HOLDS[rule](...a) });
  // Why open step y of chain `name` at `tile` has no job posted for household hid (where: what stands there, chainSteps'), by HOLDS.
  function holdOf(st, hid, name, where, y, tile) {
    const hh = st.households[hid];
    if (name === 'plant' && where.fd && (y.kind === 'plow' || y.kind === 'sow')) {
      const cap = Fieldwork.beyondHands(st, hh, where.fd, where.f);
      if (cap !== null) return held('hands', cap, tile);
      const why =
        y.kind === 'sow' && where.fd.stage === 'plowed' ? Fieldwork.sowWhy(st, hh, where.fd, cal(st.t)) : null;
      if (why) return held('sowing', why);
    }
    if (name === 'hay' && where.m && (y.kind === 'mow' || y.kind === 'rake') && !Meadows.hayWanted(st, where.f, hh))
      return held('hay');
    if (name === 'firewood' && y.kind === 'firewood') {
      if (!Chores.timberOf(hh)) return held('timber');
      if (!(hh.cold > 0) && !pileOf(st, hh).short) return held('woodpile');
    }
    if (name === 'farmstead' && where.shelter) {
      // VB-1666: the shelter on the house tile, raised once its timber is in; its timber fetched from the village's wood
      if (y.kind === 'shelter' && lacks(where.shelter, BOOTH.wood) > 0) return held('booth');
      if (y.kind === 'timber' && !st.villages[where.f.village].wood.length) return held('wood');
    }
    if (name === 'farmstead' && where.staked) {
      const s = where.staked.steps[where.staked.open];
      if (y.kind === 'booth' && s && s.kind === 'timber') return held('booth');
      const v = st.villages[st.farmsteads[hh.farmstead].village];
      if (y.kind === 'timber' && !(st.w.trees[where.staked.tile] > 0) && !v.wood.length) return held('wood');
    }
    // VB-1663: the foundation's stone with no source in reach; an outbuilding's timber with no wood to fell it in
    if (name === 'foundation' && y.kind !== 'raise' && where.step && where.step.tile < 0) return held('stone');
    if (name === 'outbuilding' && y.kind === 'timber' && !st.villages[where.f.village].wood.length)
      return held('wood', where.what);
    return held('review');
  }
  // The staked booth's timber all in, its raising not yet posted (VB-1658): the wood step is done and the raising posted when the staked
  // booths are next asked (sim/building stakedWork, the island's ask at the first step of each review hour, sim/plandays reviewHour), a
  // wait with its hour, not work missing (the page had shown it as nothing open). The hour of that ask after game hour t.
  const raisingDue = (where, y) => {
    if (where.shelter) return y.kind === 'shelter' && lacks(where.shelter, BOOTH.wood) === 0; // VB-1666: its household's next ask
    const s = where.staked && where.staked.steps[where.staked.open];
    return y.kind === 'booth' && !!s && s.kind === 'timber' && lacks(s, s.timber) === 0;
  };
  function nextAsk(t) {
    const day = Math.floor(t / DAY),
      h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  // What the pawn may do now for chain task tk, as a command with its `plan` mark, or why not (a WAITS reason): on a marked or free tile,
  // the project begun through the head's verb, beside any other of the household's (VB-1651); else the first step posted at its tile, in
  // the order the work goes, if its `work` verb lets the pawn take it; else its first step's opening, or that its job is not posted.
  function chainCmd(st, id, tk) {
    const name = tk.kind,
      tile = tk[name],
      hid = st.pawns[id].household,
      s = chainSteps(st, hid, name, tile, tk),
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
    if (raisingDue(s.where, y))
      return WAITS.opens(nextAsk(st.t), `the raising of the ${s.where.shelter ? 'shelter' : 'booth'}`);
    return y.from > st.t
      ? WAITS.opens(y.from, y.what || y.kind)
      : WAITS.unposted(y.kind, holdOf(st, hid, name, s.where, y, tile));
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
  const handOf = (st, pl) => controlOf(st, pl.pawn).queue.find((c) => !c.plan) || null;
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
    if (!pp || living(st, pl.pawn) || handOf(st, pl)) return null;
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
  // Why each task of the plan waits now (VB-1651), in the plan's order: null for the one in hand and the one the plan does next, else a
  // WAITS reason: its own (taskCmd) first, then what goes before it (a command by hand, the sleeping hours, a routine kind, an earlier
  // task); and `idle`: null, or why the plan as a whole has the pawn do nothing now though it holds tasks or a routine (a command by
  // hand holding the queue, named with the hour it was begun; else the first task's reason). The reads nextOf makes; writes nothing.
  function waitsOf(st) {
    const pl = st.player,
      pp = pl && pl.plan;
    if (!pp) return { tasks: [], idle: null };
    const id = pl.pawn,
      dead = living(st, pl.pawn),
      hand = handOf(st, pl),
      head = controlOf(st, id).queue[0],
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
  return { WAITS, RULES, nextOf, waitsOf };
})();

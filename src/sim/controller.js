// @sys sim/controller [agency]: a controller per pawn (VB-1745): whether its own logic chooses its acts (`auto`), the commands queued for it,
// which go before that logic; the verbs any pawn issues for itself (auto, queue, unqueue), the queue step for every pawn with a command
// queued, and the controller's end at the pawn's death. The steps a pawn authors for itself in its plan record (VB-1754: its routine,
// its sleeping hours, its ordered and dated tasks, sim/steps' pawnPlan) through the verb `plan` (sim/plans; the checks of its ops
// here, PLAN_OPS), the feeder's housekeeping of them (planDay, planBegun), what they have the pawn do next (nextOf, which sim/player's
// feeder queues with automatic behaviour off) and why each task waits (WAITS, waitsOf; VB-1651: sim/plannext's before). The player
// (sim/player) is one controller among others: its pawn's is made here. The one door a controller issues through, Sim.command, which
// records each command with its game time for a replay (VB-1757: st.commanded)
VB['sim/controller'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { release } = VB['sim/agents'];
  const { living } = VB['sim/records'];
  const { cal, WORK, DAY } = VB['sim/rules'];
  const { issue, perform, active, VERBS, register } = VB['sim/commands'];
  const { on, emit } = VB['sim/events'];
  const { KINDS, dailyNow, GOALS, goalOf, goalWhy, goalGone, goalSteps, headCmd } = VB['sim/kinds'];
  const { eligible } = VB['sim/eligibility'];
  const Steps = VB['sim/steps'],
    { pawnPlan: planOf, planners } = Steps;
  const PLAN_MAX = 24;
  // @state pawn.control: absent (its own logic chooses all its acts, as every pawn's does with no controller), or {auto (boolean: true,
  //   the pawn does what its role's automatic behaviour chooses whenever nothing is queued; false, the planner leaves it alone), queue[]
  //   (at most QUEUE_MAX commands {actor: the pawn, verb, target, args, source (who queued it: 'player' for the played pawn's), begun,
  //   ref}, in turn; `begun` is null until the command is issued, then the game time: only the head is ever begun, and it stays the head
  //   while its act lasts; `ref` is null, or once begun the reference its verb gave to the act it began (sim/commands perform, VB-1405),
  //   plain data; `plan` {from: 'routine' | 'vital' | 'task' | 'sleep', kind, key, and `goal` (its goal kind) and `site` (its tile)
  //   when a task at a tile fed it,
  //   kind 'project' for the project a marked tile begins} in a command the pawn's own plan fed, nextOf below), refused (null, or {verb,
  //   why, t}: the last command refused when its turn came)}; plain data, saved with the pawn, made by the first verb a pawn issues for
  //   itself here (or by the player's inhabit) and ended at its death or when the player leaves it. Its plan is not here: the steps it
  //   authors are its plan record's (sim/steps, VB-1754)
  // @state st.controlled: absent until the first controller is made, then the ids of the pawns with a controller, ascending; st.queued
  //   likewise the ids of those whose queue holds a command (the queue step's index). Both kept by this module only; plain data, saved
  const QUEUE_MAX = 8;
  const VERBS_OWN = ['auto', 'queue', 'unqueue'];
  // A pawn with no controller reads as this one: automatic, nothing queued, nothing refused. Read only.
  const NONE = Object.freeze({ auto: true, queue: Object.freeze([]), refused: null });
  const controlOf = (st, id) => (st.pawns[id] && st.pawns[id].control) || NONE;
  // id added to (in) or taken from a sorted index of pawn ids
  function mark(list, id, inside) {
    let i = 0;
    while (i < list.length && list[i] < id) i++;
    const has = list[i] === id;
    if (inside && !has) list.splice(i, 0, id);
    else if (!inside && has) list.splice(i, 1);
  }
  // The queue's index follows the queue: after any write to pawn id's queue.
  const indexed = (st, id) => {
    const c = st.pawns[id].control;
    if (st.queued) mark(st.queued, id, !!c && c.queue.length > 0);
  };
  // Pawn id's controller, made if it has none (automatic, nothing queued).
  function attach(st, id) {
    const p = st.pawns[id];
    if (!p.control) {
      p.control = { auto: true, queue: [], refused: null };
      if (!st.controlled) st.controlled = [];
      if (!st.queued) st.queued = [];
      mark(st.controlled, id, true);
    }
    return p.control;
  }
  // Pawn id's controller ends: its own logic chooses all its acts again; a head begun goes on as its own act.
  function detach(st, id) {
    const p = st.pawns[id];
    if (!p || !p.control) return;
    delete p.control;
    mark(st.controlled, id, false);
    mark(st.queued, id, false);
  }
  // At a death the controller ends, with its queue (the played pawn's death: sim/player playerDied notes the rest).
  on('died', (st, d) => detach(st, d.pawn));
  // ---- the queue's writes, for the plan's feeder (feed, below) ----
  // Pawn id's commands for which keep(cmd) is false leave its queue.
  function keepOnly(st, id, keep) {
    const c = st.pawns[id].control;
    if (!c) return;
    for (let i = c.queue.length - 1; i >= 0; i--) if (!keep(c.queue[i])) c.queue.splice(i, 1);
    indexed(st, id);
  }
  // cmd, a command record already made (begun null, ref null), joins the end of pawn id's queue.
  function put(st, id, cmd) {
    attach(st, id).queue.push(cmd);
    indexed(st, id);
  }
  // Needs go on: with nothing left to do after the end of work, a pawn whose queue ran out goes home, as everyone did at dark.
  function homeAtDark(st, id) {
    const a = st.agents[id],
      h = cal(st.t).hour;
    if ((h >= WORK[1] || h < WORK[0]) && !a.inside && unbound(a))
      issue(st, { actor: id, verb: 'goHome', source: 'planner' });
  }
  // ---- the verbs: any pawn, for itself (design.md section 15, A controller for any pawn) ----
  const alive = (st, c) => (st.pawns[c.actor] ? living(st, c.actor) : `${c.actor} is not a pawn`);
  // auto: args {on}, a boolean: its own logic on or off.
  register('auto', {
    check: (st, c) =>
      alive(st, c) || (c.args && typeof c.args.on === 'boolean' ? null : 'automatic behaviour is on or off'),
    run: (st, c) => {
      attach(st, c.actor).auto = c.args.on;
    },
  });
  // queue: args {cmd: {verb, target, args}}, the command to join the end of the queue, to be checked when its turn comes; refused when
  // the queue is full, there is no such verb, or it is not the source's to do (a verb that names its sources: `skip`, `kill`, `retire`,
  // the world's and not a pawn's, VB-681; `skip` would advance time from within a step), or it is one of these three.
  const copy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v))); // the queue keeps its own plain data
  register('queue', {
    check: (st, c) => {
      const cmd = c.args && c.args.cmd,
        V = cmd && VERBS[cmd.verb];
      if (!V || (V.sources && !V.sources.includes(c.source)) || VERBS_OWN.includes(cmd.verb))
        return `there is no verb ${cmd && cmd.verb} to queue`;
      const why = alive(st, c);
      if (why) return why;
      if (controlOf(st, c.actor).queue.length >= QUEUE_MAX) return `the queue is full (${QUEUE_MAX} commands)`;
      return null;
    },
    run: (st, c) => {
      const cmd = c.args.cmd;
      put(st, c.actor, {
        actor: c.actor,
        verb: cmd.verb,
        target: copy(cmd.target),
        args: copy(cmd.args),
        source: c.source,
        begun: null,
        ref: null,
      });
    },
  });
  // unqueue: args {i}: command i leaves the queue. The head, once begun, only stops being queued: the pawn goes on with the act as its own.
  register('unqueue', {
    check: (st, c) => {
      const i = c.args && c.args.i;
      return Number.isInteger(i) && i >= 0 && i < controlOf(st, c.actor).queue.length
        ? null
        : `the queue has no command ${i}`;
    },
    run: (st, c) => {
      const q = st.pawns[c.actor].control.queue;
      q.splice(c.args.i, 1);
      indexed(st, c.actor);
      if (!q.length && !living(st, c.actor)) homeAtDark(st, c.actor);
    },
  });
  // ---- the queue step ----
  // Pawn id's queue, each six-minute step: a begun head whose act has ended leaves the queue, and the next command is issued; one refused
  // then is dropped, its reason kept in `refused`. A load being carried home is delivered first, as at the end of work. Whether a begun act
  // lasts is its verb's to say, from the reference it gave (sim/commands active); an act done at once lasts no longer than the step it was
  // issued in. A command is begun once, and never issued again: a loaded save resumes it from its reference. begun(st, cmd) is told of
  // each command begun.
  function run(st, id, begun) {
    const c = st.pawns[id].control,
      a = st.agents[id],
      q = c.queue;
    if (q[0].begun !== null) {
      const ref = q[0].ref === undefined ? null : q[0].ref; // a command begun before VB-1405 kept none
      if ((ref !== null || q[0].ref === undefined) && !living(st, id) && active(st, q[0], ref)) return;
      q.shift();
    }
    while (q.length) {
      if (a.load > 0) return;
      // told to walk, go home or idle, the pawn leaves the job in hand, which keeps its progress (work leaves it itself): only if it may
      const cmd = q[0],
        V = VERBS[cmd.verb],
        leaves = !!a.job && !!V && !!V.frees,
        barred = leaves ? V.check(st, cmd) : null;
      if (leaves && !barred) release(st, a);
      const out = barred ? { status: 'refused', why: barred } : perform(st, cmd);
      if (out.status !== 'refused') {
        cmd.begun = st.t;
        cmd.ref = out.status === 'pending' ? out.ref : null;
        if (begun) begun(st, cmd);
        return;
      }
      q.shift();
      c.refused = { verb: cmd.verb, why: out.why, t: st.t };
    }
    if (!living(st, id)) homeAtDark(st, id);
  }
  // The controllers' step, each six-minute step (sim/clock, through sim/player's playerStep, before the agents move): each living pawn
  // that plans for itself (sim/steps planners: none in a run where no pawn has planned) has its plan's finished tasks leave it (planDay)
  // and, with automatic behaviour off, its plan feed its queue (feed); then every queue with a command, in the order of its pawns' ids,
  // from the index, so a run with no command queued does no work here; a command the plan fed marks its task begun.
  const begun = (st, cmd) => {
    if (cmd.plan) planBegun(st, cmd.actor, cmd.plan);
  };
  VB.counter(
    'queueRun',
    'Queues run by the queue step: each step, one a pawn whose controller holds a command (sim/controller queueStep, VB-1745)',
  );
  VB.counter(
    'planFeed',
    'Plans looked at by the feeder: each step, one a pawn whose controller holds a plan (sim/player playerStep, VB-1746)',
  );
  function queueStep(st) {
    for (const id of planners(st)) {
      VB.count.planFeed++;
      if (living(st, id)) continue;
      planDay(st, id);
      if (!controlOf(st, id).auto) feed(st, id);
    }
    if (!st.queued || !st.queued.length) return;
    for (const id of st.queued.slice()) {
      const c = st.pawns[id].control;
      if (c && c.queue.length) {
        VB.count.queueRun++;
        run(st, id, begun);
      }
      indexed(st, id);
    }
  }
  // ---- the plan's feeder (VB-1646; the pawn's own steps, sim/steps): with automatic behaviour off, the plan feeds the queue when nothing queued by hand
  // waits. A command queued by hand goes first, as an order for now: the plan's commands give way to it (a task left keeps its progress
  // and stays planned). In the sleeping hours the plan's work in hand is left for its sleep; else the plan's command runs to its end.
  // A trip of a kind a goal carries whole (`whole`: the farmstead goal's droving and fetching from the landing, sim/camp) under way is not
  // left for the sleeping hours: it goes on to its end, and the pawn sleeps after (VB-1670: on a way of 7 hours each way, the walk out left
  // at bedtime every evening had the move undone for 50 days, and the frost took the loads). The kinds, read from the goal kinds once.
  let WHOLE = null;
  const whole = (k) => (WHOLE || (WHOLE = new Set(Object.values(GOALS).flatMap((g) => g.whole || [])))).has(k);
  const onTrip = (st, id, c) => c.begun !== null && c.plan.from === 'task' && whole(c.plan.kind) && !!st.agents[id].job;
  function feed(st, id) {
    const q = controlOf(st, id).queue;
    if (q.some((c) => !c.plan)) {
      keepOnly(st, id, (c) => !c.plan);
      return;
    }
    if (q.length && q[0].begun !== null && !active(st, q[0], q[0].ref)) keepOnly(st, id, () => false); // its act ended: the next is fed at once
    const next = nextOf(st, id);
    if (q.length) {
      if (!(next && next.plan.from === 'sleep' && q[0].plan.from !== 'sleep') || onTrip(st, id, q[0])) return;
      keepOnly(st, id, () => false);
    }
    if (next) put(st, id, { ...next, begun: null, ref: null });
  }
  // ---- a pawn's own plan (VB-1646; any pawn's since VB-1746; steps of its plan record since VB-1754, sim/steps) ----
  const today = (st) => Math.floor(st.t / DAY);
  // Whether hour h is within the sleeping hours s (from `from` up to `until`, across midnight when from > until).
  const asleepAt = (s, h) => !!s && (s.from < s.until ? h >= s.from && h < s.until : h >= s.from || h < s.until);
  const NO_PLAN = Object.freeze({ routine: [], sleep: null, tasks: [], steps: [], day: 0, done: [], last: null });
  const ownPlan = (st, id) => planOf(st, id) || NO_PLAN;
  // The ops of the verb `plan` on a pawn's own plan (sim/plans registers the verb and checks the actor is the pawn): each {check (why
  // not, or null), run}, c.target the pawn, c.args the op's own. add: a task by key ({key}) or a goal at a tile ({<goal kind>: tile,
  // and the kind's own args; written as {kind, site, ...args}, sim/steps}), at place `at` (the end if absent), dated by `from` and
  // `by` (game days, either absent); remove {i}; move {from, to};
  // routine {kinds}; sleep {from, until} (hours; neither: no sleeping hours).
  const hourOf = (h) => typeof h === 'number' && h >= 0 && h < 24;
  const index = (i, n) => Number.isInteger(i) && i >= 0 && i < n;
  const given = (v) => v !== undefined && v !== null;
  const goalName = (g) => Object.keys(GOALS).find((k) => g[k] !== undefined);
  function placeWhy(g, n) {
    if (n >= PLAN_MAX) return `the plan is full (${PLAN_MAX} tasks)`;
    const at = given(g.at) ? g.at : n;
    if (!(Number.isInteger(at) && at >= 0 && at <= n)) return `there is no place ${g.at} in the plan`;
    if ((given(g.from) && !Number.isInteger(g.from)) || (given(g.by) && !Number.isInteger(g.by)))
      return 'a task is dated by game days';
    return given(g.from) && given(g.by) && g.by < g.from
      ? `a task cannot be done by day ${g.by}, before day ${g.from}`
      : null;
  }
  const dated = (g) => ({ ...(given(g.from) ? { from: g.from } : {}), ...(given(g.by) ? { by: g.by } : {}) });
  function addWhy(st, c) {
    const id = c.target,
      g = c.args,
      pp = ownPlan(st, id),
      name = goalName(g);
    if (name) {
      const tile = g[name],
        why = goalWhy(st, id, name, tile);
      if (why) return why;
      // one task a goal kind a tile, but for one of a different `what` there (VB-1668: a barn and a byre at the house side by side)
      if (pp.tasks.some((x) => goalOf(x) === name && x.site === tile && x.what === g.what))
        return `the ${GOALS[name].noun} at ${tile} is already planned`;
      const more = GOALS[name].args ? GOALS[name].args(g, st, id) : null;
      return placeWhy(g, pp.tasks.length) || (typeof more === 'string' ? more : null);
    }
    const j = st.jobs.get(g.key);
    if (!j) return `there is no job ${g.key}`;
    if (!eligible(st, j, st.pawns[id])) return `job ${g.key} is not the pawn's to take`;
    if (pp.tasks.some((x) => x.key !== undefined && x.key === g.key)) return `job ${g.key} is already planned`;
    return placeWhy(g, pp.tasks.length);
  }
  function add(st, c) {
    const id = c.target,
      g = c.args,
      name = goalName(g),
      n = ownPlan(st, id).tasks.length,
      at = given(g.at) ? g.at : n;
    let goal;
    if (name) {
      const tile = g[name];
      goal = { kind: name, site: tile, ...(GOALS[name].args ? GOALS[name].args(g, st, id) : null) };
    } else {
      const j = st.jobs.get(g.key);
      goal = { key: j.key, kind: j.kind, site: Number.isInteger(j.site) ? j.site : -1 };
    }
    Steps.addTask(st, id, goal, at, dated(g));
  }
  const PLAN_OPS = {
    add: { check: addWhy, run: add },
    remove: {
      check: (st, c) =>
        index(c.args.i, ownPlan(st, c.target).tasks.length) ? null : `the plan has no task ${c.args.i}`,
      run: (st, c) => Steps.dropTask(st, c.target, c.args.i, null),
    },
    move: {
      check: (st, c) => {
        const n = ownPlan(st, c.target).tasks.length;
        return index(c.args.from, n) && index(c.args.to, n)
          ? null
          : `the plan cannot move task ${c.args.from} to ${c.args.to}`;
      },
      run: (st, c) => Steps.moveTask(st, c.target, c.args.from, c.args.to),
    },
    routine: {
      check: (st, c) => {
        const ks = c.args.kinds;
        if (!Array.isArray(ks) || ks.length > PLAN_MAX) return 'a routine is a list of job kinds';
        const bad = ks.find((k) => typeof k !== 'string' || !KINDS[k]);
        if (bad !== undefined) return `there is no job kind ${bad}`;
        return new Set(ks).size !== ks.length ? 'a kind is in the routine twice' : null;
      },
      run: (st, c) => Steps.setRoutine(st, c.target, c.args.kinds),
    },
    // keep {i, on}: task i is kept ("keep my order": the default author never takes it back, the card warns while it is at risk), or
    // not (on false); date {i, from, by}: task i dated anew (either absent: undated that way). VB-1755.
    keep: {
      check: (st, c) =>
        index(c.args.i, ownPlan(st, c.target).tasks.length) ? null : `the plan has no task ${c.args.i}`,
      run: (st, c) => Steps.keepTask(st, c.target, c.args.i, c.args.on !== false),
    },
    date: {
      check: (st, c) => {
        if (!index(c.args.i, ownPlan(st, c.target).tasks.length)) return `the plan has no task ${c.args.i}`;
        const g = c.args;
        if ((given(g.from) && !Number.isInteger(g.from)) || (given(g.by) && !Number.isInteger(g.by)))
          return 'a task is dated by game days';
        return given(g.from) && given(g.by) && g.by < g.from
          ? `a task cannot be done by day ${g.by}, before day ${g.from}`
          : null;
      },
      run: (st, c) => Steps.dateTask(st, c.target, c.args.i, dated(c.args)),
    },
    sleep: {
      check: (st, c) => {
        const g = c.args;
        if (!given(g.from) && !given(g.until)) return null;
        return !hourOf(g.from) || !hourOf(g.until) || g.from === g.until
          ? `cannot sleep from ${g.from} until ${g.until}`
          : null;
      },
      run: (st, c) =>
        Steps.setSleep(st, c.target, given(c.args.from) ? { from: c.args.from, until: c.args.until } : null),
    },
  };
  // ---- the feeder's housekeeping (sim/player's playerStep, for each pawn that plans for itself) ----
  // A task whose job is finished or gone leaves the plan, the last one kept in `last`; a task at a tile leaves when its goal kind says
  // (goalGone); and the plan asks its head for the work a goal waits on (a goal kind's `ask`: the firewood's cutting, the farmstead's
  // next step; the event planAsks, which sim/stores turns into a review of the household's plan, at most one such a day).
  function planDay(st, id) {
    const pp = planOf(st, id),
      hid = st.pawns[id].household;
    for (let i = pp.tasks.length - 1; i >= 0; i--) {
      const t = pp.tasks[i];
      const name = goalOf(t);
      if (name) {
        const which = goalGone(st, hid, name, t.site, t);
        if (which) Steps.dropTask(st, id, i, { kind: name, site: t.site, t: st.t, which });
        continue;
      }
      if (!st.jobs.has(t.key)) Steps.dropTask(st, id, i, { key: t.key, kind: t.kind, t: st.t });
    }
    const hh = hid === null ? null : st.households[hid];
    if (!hh || hh.dissolved) return;
    for (const t of pp.tasks) {
      const C = goalOf(t) && GOALS[t.kind];
      if (C && C.ask && C.ask(st, hid, t, () => goalSteps(st, hid, t.kind, t.site, t))) {
        emit(st, 'planAsks', { household: hid });
        return;
      }
    }
  }
  // A routine kind's command was begun by pawn id: it is done for the day.
  function planBegun(st, id, mark) {
    if (mark.from === 'routine') Steps.routineBegun(st, id, mark.kind);
  }
  // ---- what the pawn's own plan has it do next (VB-1646, VB-1651; sim/plannext's before VB-1754) ----
  const workCmd = (id, key) => ({ actor: id, verb: 'work', target: key, args: null, source: 'player' });
  // ---- why a task waits (VB-1651): the one closed list of reasons, each plain data for the page (planView's `waits` and `idle`) ----
  // hand: a command queued by hand goes first (its verb, target and the game hour it was begun, null before); before: an earlier task (i,
  // its index) is what the plan does next or has in hand; routine: a routine kind goes first; vital: a daily task its household's
  // day leaves unmanned goes first (VB-1755); sleep: the sleeping hours, until `until`
  // o'clock; opens: its next step is not posted until game hour t (what: its window opening, its crop ripe, its hay dry); unposted: its
  // next step (kind) is open and its job not posted for the household now, `rule` (one of RULES) the household's own rule that holds it
  // back and `text` its words for the page (HOLDS, VB-1652); refused: the verb's own reason (text).
  const WAITS = {
    hand: (c) => ({ why: 'hand', verb: c.verb, target: c.target ?? null, since: c.begun ?? null }),
    before: (i) => ({ why: 'before', i }),
    routine: (kind) => ({ why: 'routine', kind }),
    vital: (kind) => ({ why: 'vital', kind }),
    sleep: (until) => ({ why: 'sleep', until }),
    opens: (t, what) => ({ why: 'opens', t, what }),
    unposted: (kind, h) => ({ why: 'unposted', kind, rule: h.rule, text: h.text }),
    refused: (text) => ({ why: 'refused', text }),
  };
  // ---- the household's own rule that holds an open step's job back (VB-1652): the one closed list, HOLDS, each {rule, text} ----
  // hands: a field beyond what its hands till (sim/fieldwork beyondHands, the plan's targets.workable); sowing: its sowing refused
  // (sim/fieldwork sowWhy: the seed, the thaw); hay: no hay wanted (sim/meadows hayWanted); timber: no timber home to cut; woodpile: the
  // pile at the season's goal (sim/wood, the firewood job's rule); booth: the booth's timber not all fetched to its tile; wood: no wood
  // to fetch the booth's (or an outbuilding's) timber from; stone: no stone in reach for the foundation (the wait `project`, its step not
  // opened while a project is under way, VB-1663, is gone with the limit, VB-1668); review: none of those,
  // the job posted at the household's next review. Each goal kind's `hold` names the one of its own (sim/kinds GOALS; VB-1777).
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

    review: () => "waits for the household's next planning day",
  };
  const RULES = Object.keys(HOLDS);
  const held = (rule, ...a) => ({ rule, text: HOLDS[rule](...a) });
  // Why open step y of goal kind `name` at `tile` has no job posted for household hid (where: what stands there, goalSteps'): the goal
  // kind's own `hold`, by HOLDS, else that it is posted at the household's next review.
  function holdOf(st, hid, name, where, y, tile) {
    const C = GOALS[name],
      h = C.hold ? C.hold(st, hid, where, y, tile) : null;
    return h ? held(...h) : held('review');
  }
  // The hour of the ask of the household's review hour after game hour t, when a raising whose timber is all in is posted (a goal kind's
  // `due`, VB-1658: the staked booths asked at the first step of each review hour, sim/building stakedWork, sim/plandays reviewHour; a wait
  // with its hour, not work missing).
  function nextAsk(t) {
    const day = Math.floor(t / DAY),
      h = Math.floor(t - day * DAY) + 1;
    if (h < WORK[0] - 1) return day * DAY + WORK[0] - 1;
    if (h > WORK[1]) return (day + 1) * DAY + WORK[0] - 1;
    return day * DAY + h;
  }
  // What the pawn may do now for goal task tk, as a command with its `plan` mark, or why not (a WAITS reason): on a marked or free tile,
  // the project begun through the head's verb, beside any other of the household's (VB-1651); else the first step posted at its tile, in
  // the order the work goes, if its `work` verb lets the pawn take it; else its first step's opening, or that its job is not posted.
  function goalCmd(st, id, tk) {
    const name = tk.kind,
      tile = tk.site,
      hid = st.pawns[id].household,
      C = GOALS[name],
      s = goalSteps(st, hid, name, tile, tk),
      mark = { from: 'task', goal: name, site: tile };
    if (!s) return WAITS.refused(C.none(tile));
    if (s.where.mark) {
      const cmd = headCmd(id, hid, { what: s.where.mark, tile }),
        why = VERBS.project.check(st, cmd);
      return why === null ? { ...cmd, plan: { ...mark, kind: 'project', key: null } } : WAITS.refused(why);
    }
    const act = C.act && C.act(st, id, s.where, tile); // a goal kind's own act first (farmstead: its placing)
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
    const due = C.due ? C.due(s.where, y) : null;
    if (due) return WAITS.opens(nextAsk(st.t), `the raising of the ${due}`);
    return y.from > st.t
      ? WAITS.opens(y.from, y.what || y.kind)
      : WAITS.unposted(y.kind, holdOf(st, hid, name, s.where, y, tile));
  }
  // What the pawn may do now for task i of its plan pp: before the day its step is dated from (`from`), nothing (it opens that day);
  // else taskCmd.
  const ownCmd = (st, id, pp, i) => {
    const s = pp.steps[i];
    return s && s.from !== undefined && s.from > today(st)
      ? WAITS.opens(s.from * DAY, 'the day it is planned for')
      : taskCmd(st, id, pp.tasks[i]);
  };
  // What the pawn may do now for task t (a task at a tile, or by key): a command with its `plan` mark, or why not (a WAITS reason).
  function taskCmd(st, id, t) {
    if (goalOf(t)) return goalCmd(st, id, t);
    if (!st.jobs.has(t.key)) return WAITS.refused(`there is no job ${t.key}`);
    const why = VERBS.work.check(st, workCmd(id, t.key));
    return why === null
      ? { ...workCmd(id, t.key), plan: { from: 'task', kind: t.kind, key: t.key } }
      : WAITS.refused(why);
  }
  // ---- what comes next ----
  const handOf = (st, id) => controlOf(st, id).queue.find((c) => !c.plan) || null;
  // The first job of kind k of the pawn's household that its `work` verb would let it take now, or null.
  function routineJob(st, id, k) {
    const hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (js) for (const j of js) if (j.kind === k && VERBS.work.check(st, workCmd(id, j.key)) === null) return j;
    return null;
  }
  VB.counter(
    'vitalAsk',
    'Open tasks of its household passed by a pawn on its own plan, for a daily one the day leaves unmanned (sim/controller, VB-1755)',
  );
  // A task of a kind its household lives by each day (sim/kinds `daily`: the water, the meal, the fire, milking, fodder) that stands
  // open, unmanned and not the next task of another member by the household's day (givenTo), and that pawn id
  // may take now, unless its routine is to take that kind today; or null. Due and vital kinds are slotted in before anything authored
  // (VB-1755; design.md section 7, Authors). A pass
  // over the household's open tasks, for a pawn on its own plan.
  function vitalJob(st, id, pp) {
    const hid = st.pawns[id].household,
      js = hid === null ? null : st.jobsBy.get(`household:${hid}`);
    if (!js) return null;
    const plan = st.plans.households.get(hid),
      day = plan && plan.day;
    for (const j of js) {
      VB.count.vitalAsk++;
      if (!dailyNow(st, j) || j.claims.length || givenTo(st, day, j.key, id)) continue;
      if (pp.routine.includes(j.kind) && !pp.done.includes(j.kind)) continue; // its routine takes it, in its order
      if (VERBS.work.check(st, workCmd(id, j.key)) === null) return j;
    }
    return null;
  }
  // Whether the household's day gives the task of `key` to a member other than pawn id as the one it takes next: the first entry of its
  // list still posted (a later entry waits for the member's present task: the pawn may take it meanwhile).
  function givenTo(st, day, key, id) {
    if (!day) return false;
    for (const m in day.lists) {
      if (Number(m) === id) continue;
      const next = day.lists[m].find((k) => st.jobs.has(k));
      if (next === key) return true;
    }
    return false;
  }
  // What its plan has pawn id do next, as a command with its `plan` mark, or null: in its sleeping hours, sleep until `until`;
  // else a daily task the household's day leaves unmanned (vitalJob); else the first routine kind not begun today with a job of its
  // household it may take; else the first task that may be taken now (taskCmd). A command queued by hand goes first: with one
  // queued, null. Reads only; writes nothing.
  function nextOf(st, id) {
    const pp = planOf(st, id);
    if (!pp || living(st, id) || handOf(st, id)) return null;
    if (asleepAt(pp.sleep, cal(st.t).hour)) {
      const cmd = { actor: id, verb: 'sleep', target: null, args: { until: pp.sleep.until }, source: 'player' };
      return VERBS.sleep.check(st, cmd) === null ? { ...cmd, plan: { from: 'sleep', kind: null, key: null } } : null;
    }
    const v = vitalJob(st, id, pp);
    if (v) return { ...workCmd(id, v.key), plan: { from: 'vital', kind: v.kind, key: v.key } };
    const done = pp.done;
    for (const k of pp.routine) {
      if (done.includes(k)) continue;
      const j = routineJob(st, id, k);
      if (j) return { ...workCmd(id, j.key), plan: { from: 'routine', kind: k, key: j.key } };
    }
    for (let i = 0; i < pp.tasks.length; i++) {
      const cmd = ownCmd(st, id, pp, i);
      if (cmd.verb) return cmd;
    }
    return null;
  }
  // Whether plan mark m (a command the plan fed) is task t's.
  const markOf = (m, t) =>
    !!m && m.from === 'task' && (goalOf(t) ? m.goal === t.kind && m.site === t.site : !m.goal && m.key === t.key);
  // Why each task of pawn id's plan waits now (VB-1651; Sim.waits(st, pawn)), in the plan's order: null for the one in hand and the one
  // the plan does next, else a
  // WAITS reason: its own (taskCmd) first, then what goes before it (a command by hand, the sleeping hours, a routine kind, an earlier
  // task); and `idle`: null, or why the plan as a whole has the pawn do nothing now though it holds tasks or a routine (a command by
  // hand holding the queue, named with the hour it was begun; else the first task's reason). The reads nextOf makes; writes nothing.
  function waitsOf(st, id) {
    const pp = planOf(st, id);
    if (!pp) return { tasks: [], idle: null };
    const dead = living(st, id),
      hand = handOf(st, id),
      head = controlOf(st, id).queue[0],
      inHand = head && head.plan && head.begun !== null ? head.plan : null,
      next = nextOf(st, id),
      asleep = asleepAt(pp.sleep, cal(st.t).hour),
      first = inHand || (next && next.plan);
    const tasks = pp.tasks.map((t, i) => {
      if (dead) return WAITS.refused(dead);
      if (markOf(inHand, t) || (next && markOf(next.plan, t))) return null;
      const own = ownCmd(st, id, pp, i);
      if (!own.verb) return own;
      if (hand) return WAITS.hand(hand);
      if (asleep || (first && first.from === 'sleep')) return WAITS.sleep(pp.sleep ? pp.sleep.until : null);
      if (first && first.from === 'routine') return WAITS.routine(first.kind);
      if (first && first.from === 'vital') return WAITS.vital(first.kind);
      const k = first ? pp.tasks.findIndex((u) => markOf(first, u)) : -1;
      return k >= 0 ? WAITS.before(k) : null;
    });
    let idle = null;
    if (pp.tasks.length || pp.routine.length) {
      if (hand) idle = WAITS.hand(hand);
      else if (dead) idle = WAITS.refused(dead);
      else if (!inHand && !next) idle = tasks.find((w) => w) || null;
    }
    return { tasks, idle };
  }
  // ---- the one door a controller issues through (VB-1757; design.md section 15, The API by pawn and body): Sim.command ----
  // @state st.commanded: absent until the first command through Sim.command, then the commands given there, in the order given, each
  //   {tick (st.tick when it was given), cmd (a copy of the command {actor, verb, target, args, source}, plain data)}: a controller's
  //   inputs (the page's for the played pawn, an external agent's for any), so that a run is replayed from a save and those recorded
  //   since it (Sim.replay). Commands the simulation issues itself are not inputs and are not here; neither are the debug drawer's
  //   direct mutators, the page's flags nor the frame (Sim.inhabit, uninhabit, succeed: sim/player), so a replay holds for a run whose
  //   frame is unchanged since its save. Written here only; plain data, saved
  function command(st, cmd) {
    const c = cmd || {};
    if (!st.commanded) st.commanded = [];
    st.commanded.push({ tick: st.tick, cmd: copy(c) });
    return issue(st, c);
  }
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['command', 'controlOf', ['waits', 'waitsOf']],
    command,
    QUEUE_MAX,
    PLAN_MAX,
    NONE,
    controlOf,
    attach,
    detach,
    queueStep,
    PLAN_OPS,
    asleepAt,
    WAITS,
    RULES,
    nextOf,
    waitsOf,
  };
})();

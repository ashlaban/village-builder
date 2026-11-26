// @sys sim/controller: a controller per pawn (VB-1745): whether its own logic chooses its acts (`auto`) and the commands queued for it,
// which go before that logic; the verbs any pawn issues for itself (auto, queue, unqueue), the queue step for every pawn with a command
// queued, and the controller's end at the pawn's death. The player (sim/player) is one controller among others: its pawn's is made here
VB['sim/controller'] = (() => {
  const { unbound } = VB['sim/pose'];
  const { release } = VB['sim/agents'];
  const { living } = VB['sim/records'];
  const { cal, WORK } = VB['sim/rules'];
  const { issue, perform, active, VERBS, register } = VB['sim/commands'];
  const { on } = VB['sim/events'];
  // @state pawn.control: absent (its own logic chooses all its acts, as every pawn's does with no controller), or {auto (boolean: true,
  //   the pawn does what its role's automatic behaviour chooses whenever nothing is queued; false, the planner leaves it alone), queue[]
  //   (at most QUEUE_MAX commands {actor: the pawn, verb, target, args, source (who queued it: 'player' for the played pawn's), begun,
  //   ref}, in turn; `begun` is null until the command is issued, then the game time: only the head is ever begun, and it stays the head
  //   while its act lasts; `ref` is null, or once begun the reference its verb gave to the act it began (sim/commands perform, VB-1405),
  //   plain data; `plan` {from, kind, key} in a command the player's plan fed, sim/playerplan), refused (null, or {verb, why, t}: the last
  //   command refused when its turn came)}; plain data, saved with the pawn, made by the first verb a pawn issues for itself here (or by
  //   the player's inhabit) and ended at its death or when the player leaves it
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
  // ---- the queue's writes, for the player's plan feeder (sim/player feed) ----
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
  // Every queue with a command, in the order of its pawns' ids (sim/clock, through sim/player's playerStep, before the agents move): from
  // the index, so a run with no command queued does no work here.
  function queueStep(st, begun = null) {
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
  return { QUEUE_MAX, NONE, controlOf, attach, detach, keepOnly, put, queueStep };
})();

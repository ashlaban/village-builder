// @sys sim/player: the player (VB-169), a source of commands with one pawn at a time: its queue, which goes before the pawn's own logic, its
// wish, its answer and its choices as head, its pawn's death and whom it goes on as
VB['sim/player'] = (() => {
  const { release } = VB['sim/agents'];
  const { holdingOf, spouseOf, personEvent, living } = VB['sim/records'];
  const { cal, WORK, SOCIAL } = VB['sim/rules'];
  const { relationsOf, opinionWord } = VB['sim/relations'];
  const { setWish, resetWish, endPartner } = VB['sim/wishes'];
  const { issue, VERBS } = VB['sim/commands'];
  // ---- the player (VB-169): one source, `player`, with one pawn at a time, whose queued commands go before the pawn's own logic ----
  // @state st.player: null, or {pawn (the inhabited pawn's id), auto (boolean: left to itself, the pawn does what its role's automatic
  //   behaviour chooses), queue[] (at most QUEUE_MAX commands {actor: pawn, verb, target, args, source: 'player', begun}, in turn; `begun` is
  //   null until the command is issued, then the game time: only the head is ever begun, and it stays the head while its act lasts),
  //   refused (null, or {verb, why, t}: the last command refused when its turn came), since (game hours), left (null while the pawn
  //   lives; from its death {t, held (the household it held, or null), spouse (pawn id or null), ties[] (at most TIES_MAX {id, why}: those
  //   it thought friends, best first)}: what a death erases and the player's succession needs, VB-213)}; plain data, saved with the run
  const QUEUE_MAX = 8,
    TIES_MAX = 12;
  // A command begun lasts while its act does: work while the pawn holds that job, a walk until it arrives, going home until it is indoors,
  // idling until its time is up. Any other verb is done at once.
  const LASTS = {
    work: (st, a, c) => !!a.job && a.job.key === c.target,
    walkTo: (st, a) => !!a.path,
    goHome: (st, a) => !a.inside && !!a.path,
    idle: (st, a, c) => st.t < c.args.until,
  };
  function inhabit(st, id) {
    const dead = living(st, id);
    if (dead) return dead;
    if (st.player) uninhabit(st);
    st.player = {
      pawn: id,
      auto: true,
      queue: [],
      refused: null,
      since: st.t,
      left: null,
    };
    resetWish(st, id); // the player starts from the default wish (VB-680): its wishes are the pawn's (pawn.wish, sim/wishes)
    personEvent(st, id, 'player', 'Played by the player');
    return true;
  }
  function uninhabit(st) {
    if (!st.player) return 'no pawn is played';
    personEvent(st, st.player.pawn, 'player', 'No longer played by the player');
    st.player = null;
    return true;
  }
  // The played pawn dies (sim/lifecycle, before the death ends its marriage and drops its ties): the player keeps it, with an empty queue,
  // until it goes on as another (VB-213), and what the death erases is noted: the farm it held, its spouse, those it thought friends.
  function playerDied(st, id) {
    const pl = st.player;
    if (!pl || pl.pawn !== id) return;
    const held = holdingOf(st, id),
      friends = relationsOf(st, id).filter((r) => r.opinion >= SOCIAL.friend);
    friends.sort((x, y) => y.opinion - x.opinion || x.id - y.id);
    pl.queue = [];
    pl.left = {
      t: st.t,
      held: held ? held.id : null,
      spouse: spouseOf(st, id),
      ties: friends.slice(0, TIES_MAX).map((r) => ({ id: r.id, why: opinionWord(r.opinion) })),
    };
  }
  // The player goes on as pawn id after its pawn's death: `text` is written to the dead pawn's events, and id is played from now, with
  // nothing queued and no wishes. sim/opportunities' succeed checks who may be chosen; true, or why not.
  function goOnAs(st, id, text) {
    const pl = st.player;
    if (!pl || !pl.left) return 'the played pawn has not died';
    const dead = living(st, id);
    if (dead) return dead;
    personEvent(st, pl.pawn, 'player', text);
    st.player = null;
    return inhabit(st, id);
  }
  // Needs go on: with nothing left to do after the end of work, the player's pawn goes home, as everyone did at dark.
  function homeAtDark(st, pl) {
    const a = st.agents[pl.pawn],
      h = cal(st.t).hour;
    if ((h >= WORK[1] || h < WORK[0]) && !a.inside && a.phase === null)
      issue(st, { actor: pl.pawn, verb: 'goHome', source: 'planner' });
  }
  // The command joins the queue, to be checked when its turn comes; true, or why it does not: the queue is full, there is no such verb,
  // or its actor is not the player's pawn. `skip` is the world's, not a pawn's (it would advance time from within a step).
  function queue(st, cmd) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!cmd || !VERBS[cmd.verb] || cmd.verb === 'skip') return `there is no verb ${cmd && cmd.verb} to queue`;
    if (cmd.actor !== pl.pawn) return `pawn ${cmd.actor} is not the player's pawn`;
    if (pl.queue.length >= QUEUE_MAX) return `the queue is full (${QUEUE_MAX} commands)`;
    const copy = (v) => (v === undefined ? null : JSON.parse(JSON.stringify(v))); // the queue keeps its own plain data
    pl.queue.push({
      actor: pl.pawn,
      verb: cmd.verb,
      target: copy(cmd.target),
      args: copy(cmd.args),
      source: 'player',
      begun: null,
    });
    return true;
  }
  // Takes command i off the queue. The head, once begun, only stops being the player's: the pawn goes on with the act as its own.
  function unqueue(st, i) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!(Number.isInteger(i) && i >= 0 && i < pl.queue.length)) return `the queue has no command ${i}`;
    pl.queue.splice(i, 1);
    if (!pl.queue.length && !living(st, pl.pawn)) homeAtDark(st, pl);
    return true;
  }
  function setAuto(st, on) {
    if (!st.player) return 'no pawn is played';
    st.player.auto = !!on;
    return true;
  }
  // The wish verb (VB-212, VB-680): the played pawn's wish at the moving round, written on the pawn as every pawn's is (pawn.wish,
  // sim/wishes); the round reads it as anyone's and decides by its rules, so a wish is not checked against them here; it stays until
  // changed. True, or why it is not a wish.
  function wish(st, kind, value) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!['out', 'claim', 'serve', 'match', 'settle', 'rank'].includes(kind)) return `there is no wish ${kind}`;
    // claim takes a farm id and match a pawn id (of the other sex, living and single), else null or false; out, serve and settle null,
    // true or false; rank a whole ranking (sim/wishes)
    const id = (kind === 'claim' || kind === 'match') && Number.isInteger(value);
    const target = kind === 'claim' ? st.farmsteads[value] : st.pawns[value];
    if (
      kind !== 'rank' &&
      (id ? !target : !(value === null || value === false || (value === true && kind !== 'claim' && kind !== 'match')))
    ) {
      return id
        ? `there is no ${kind === 'claim' ? 'farm' : 'pawn'} ${value}`
        : `${kind} cannot be wished ${JSON.stringify(value)}`;
    }
    if (kind === 'match' && id && (target.sex === st.pawns[pl.pawn].sex || !target.alive))
      return `${value} is not one the pawn may marry`;
    return setWish(st, pl.pawn, kind, value);
  }
  // A wish for a match ends when the one who wished or the wished partner marries (a and b have married) or dies (a is b).
  const clearMatchWish = (st, a, b) => endPartner(st, a, b);
  // Each six-minute step (sim/clock), before the agents move: a begun head whose act has ended leaves the queue, and the next command is
  // issued; one refused then is dropped, its reason kept in `refused`. A load being carried home is delivered first, as at the end of work.
  function playerStep(st) {
    const pl = st.player;
    if (!pl || !pl.queue.length) return;
    const a = st.agents[pl.pawn],
      q = pl.queue;
    if (q[0].begun !== null) {
      const lasts = LASTS[q[0].verb];
      if (lasts && !living(st, pl.pawn) && lasts(st, a, q[0])) return;
      q.shift();
    }
    while (q.length) {
      if (a.phase === 'back') return;
      // told to walk, go home or idle, the pawn leaves the job in hand, which keeps its progress (work leaves it itself): only if it may
      const cmd = q[0],
        leaves = !!a.job && cmd.verb !== 'work' && !!LASTS[cmd.verb],
        barred = leaves ? VERBS[cmd.verb].check(st, cmd) : null;
      if (leaves && !barred) release(st, a);
      const why = barred || issue(st, cmd);
      if (why === true) {
        cmd.begun = st.t;
        return;
      }
      q.shift();
      pl.refused = { verb: cmd.verb, why, t: st.t };
    }
    if (!living(st, pl.pawn)) homeAtDark(st, pl);
  }
  // The played pawn answers the open marriage offer offerId (VB-293; the first question asked through Decisions.answer, which slice 5's
  // Decisions module takes over): true, or why not.
  function answer(st, offerId, yes) {
    if (!st.player) return 'no pawn is played';
    return issue(st, { actor: st.player.pawn, verb: 'answer', target: offerId, args: { yes }, source: 'player' });
  }
  // The played pawn chooses as head of its household (VB-253, for the page's plan panel, VB-256): verb one of HEAD_VERBS, at once, not
  // queued (a choice of the plan takes no time); its target the household it holds, else the one it lives in, so a pawn that is not the
  // head is refused with the reason. True, or why not.
  const HEAD_VERBS = ['target', 'tile', 'order', 'project', 'dropProject', 'rotation', 'sowOutOfTurn'];
  function head(st, verb, args) {
    const pl = st.player;
    if (!pl) return 'no pawn is played';
    if (!HEAD_VERBS.includes(verb)) return `${verb} is not a choice of the plan`;
    const held = holdingOf(st, pl.pawn),
      target = held && !held.dissolved ? held.id : st.pawns[pl.pawn].household;
    return issue(st, { actor: pl.pawn, verb, target, args: args || {}, source: 'player' });
  }
  return {
    head,
    QUEUE_MAX,
    inhabit,
    uninhabit,
    queue,
    unqueue,
    setAuto,
    wish,
    clearMatchWish,
    answer,
    playerStep,
    playerDied,
    goOnAs,
    TIES_MAX,
  };
})();

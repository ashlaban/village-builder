// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out (VB-167)
VB['sim/commands'] = (() => {
  const { start, release } = VB['sim/agents'];
  const { isOpen } = VB['sim/kinds'];
  // A command names its actor (a pawn id), a verb from VERBS, its target and arguments, and its source: 'planner' (the job matcher),
  // later 'player', 'debug', 'meeting' or 'round' (VB-168 to VB-171). Each verb checks the command and returns why it is refused, or null;
  // then carries it out. The systems below a verb are unchanged: a command decides nothing, it only puts a name between choosing and doing.
  const living = (st, id) => (st.pawns[id] && st.pawns[id].died === null && st.agents[id] ? null : `pawn ${id} is not a living pawn`);
  const VERBS = {
    // work(job): leave the job in hand, if any (it keeps its progress), and set out for the job with key `target`
    work: {
      check: (st, c) => living(st, c.actor) || (!st.jobs.has(c.target) ? `there is no job ${c.target}`
        : !isOpen(st.jobs.get(c.target)) ? `job ${c.target} has no room` : null),
      run: (st, c) => { const a = st.agents[c.actor]; release(st, a); start(st, a, st.jobs.get(c.target)); },
    },
  };
  // Carries out cmd, or changes nothing: true, or the reason it was refused.
  function issue(st, cmd) {
    const V = VERBS[cmd.verb];
    if (!V) return `there is no verb ${cmd.verb}`;
    const why = V.check(st, cmd);
    if (why) return why;
    V.run(st, cmd);
    return true;
  }
  return { issue, VERBS };
})();

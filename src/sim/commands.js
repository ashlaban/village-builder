// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out; each
// module registers the verbs of the acts it carries out (target-v2 3.2), so this one knows no domain
VB['sim/commands'] = (() => {
  const { atLoad } = VB['sim/registry'];
  // A command names its actor (a pawn id), a verb from VERBS, its target and arguments, and its source: 'planner' (the job matcher),
  // 'player', 'pawn', 'debug', 'meeting', 'round', 'occasion', 'talk', 'help', 'offer', 'construction'. Each verb checks the command and
  // returns why it is refused, or null; then carries it out. The systems below a verb are unchanged: a command decides nothing, it only
  // puts a name between choosing and doing.
  // Code, never saved state: verb -> {check, run}. A module registers its verbs at load, as it does rules (target-v2 3.2); closed with the
  // registries, at the first seed or load. A verb is registered once.
  const VERBS = {};
  function register(verb, V) {
    atLoad();
    if (VERBS[verb]) throw new Error('Duplicate verb: ' + verb);
    if (!V || typeof V.check !== 'function' || typeof V.run !== 'function')
      throw new Error(`Verb ${verb} needs a check and a run`);
    VERBS[verb] = V;
  }
  // Carries out cmd, or changes nothing: true, or the reason it was refused.
  function issue(st, cmd) {
    const V = VERBS[cmd.verb];
    if (!V) return `there is no verb ${cmd.verb}`;
    const why = V.check(st, cmd);
    if (why) return why;
    V.run(st, cmd);
    return true;
  }
  return {
    issue,
    register,
    VERBS,
  };
})();

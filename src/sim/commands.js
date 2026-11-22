// @sys sim/commands: commands, the one way an actor acts: plain data {actor, verb, target, args, source}, checked, then carried out; each
// module registers the verbs of the acts it carries out (target-v2 3.2), so this one knows no domain
VB['sim/commands'] = (() => {
  const { atLoad } = VB['sim/registry'];
  // A command names its actor (a pawn id), a verb from VERBS, its target and arguments, and its source, one of SOURCES. Each verb checks
  // the command and returns why it is refused, or null; then carries it out. The systems below a verb are unchanged: a command decides
  // nothing, it only puts a name between choosing and doing. A verb's check holds for any pawn (VB-681): it asks the actor's right (the
  // head of the household, the claimant, a match answered yes at the round), so the planner, the round and the player pass the same
  // checks; a verb that only some sources may carry names them (`sources`): the round's settling of an offer, the world's construction,
  // the page's debug hand.
  // The sources, one list: who chooses the act. 'debug' is the world's hand (the page's drawer, the tests), never a pawn's act.
  const SOURCES = [
    'planner', // the job matcher (sim/agents)
    'player', // the played pawn's queue and choices (sim/player)
    'pawn', // a pawn's or a head's own rule (sim/aims, sim/plans, ...)
    'round', // the moving round, and an offer it settles (sim/round, sim/offers)
    'meeting', // the village meeting (sim/meetings)
    'occasion', // an occasion called or attended (sim/occasions)
    'talk', // a halt to talk (sim/talk)
    'help', // help given between households (sim/help)
    'offer', // an offer's own goods (sim/offers)
    'asking', // an asking for a match (sim/asking)
    'courting', // a courting pair (sim/courting)
    'handover', // a farm handed on (sim/marriage, sim/heirs)
    'succession', // a holder's death and heir (sim/heirs)
    'death', // a death's consequences (sim/lifecycle)
    'trust', // a farm held in trust (sim/trust)
    'found', // a household founded (sim/settle)
    'restoration', // an empty farm restored (sim/farmclaims)
    'preview', // an offer settled on a copy of the state, to show what a yes would bring (sim/preview)
    'construction', // a project's own course: a cottage done, a plot whose household is no more (sim/cottage, sim/plans)
    'debug', // the world's hand: the page's debug drawer and the tests
  ];
  const VERBS = {};
  function register(verb, V) {
    atLoad();
    if (VERBS[verb]) throw new Error('Duplicate verb: ' + verb);
    if (!V || typeof V.check !== 'function' || typeof V.run !== 'function')
      throw new Error(`Verb ${verb} needs a check and a run`);
    for (const s of V.sources || []) if (!SOURCES.includes(s)) throw new Error(`Verb ${verb}: no source ${s}`);
    VERBS[verb] = V;
  }
  // Carries out cmd, or changes nothing: true, or the reason it was refused.
  function issue(st, cmd) {
    const V = VERBS[cmd.verb];
    if (!V) return `there is no verb ${cmd.verb}`;
    if (!SOURCES.includes(cmd.source)) return `there is no source ${cmd.source}`;
    if (V.sources && !V.sources.includes(cmd.source))
      return `${cmd.verb} is not ${cmd.source}'s to do: ${V.sources.join(' or ')} only`;
    const why = V.check(st, cmd);
    if (why) return why;
    V.run(st, cmd);
    return true;
  }
  return {
    issue,
    register,
    SOURCES,
    VERBS,
  };
})();

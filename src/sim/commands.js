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
  // A verb whose act lasts beyond its step (a walk, work) gives `active(st, cmd, ref)`: its `run` returns a reference to what it began
  // (plain data, never null), and `active` says, from the reference, whether that act still goes on. The verb is the one authority on
  // its own act: the player's queue asks it (sim/player), and keeps the reference with the command, in the save. `frees`: the pawn
  // leaves the job in hand before the act (a walk, going home, idling); the queue releases it first, only if the verb's check allows.
  function register(verb, V) {
    atLoad();
    if (VERBS[verb]) throw new Error('Duplicate verb: ' + verb);
    if (!V || typeof V.check !== 'function' || typeof V.run !== 'function')
      throw new Error(`Verb ${verb} needs a check and a run`);
    if (V.active !== undefined && typeof V.active !== 'function') throw new Error(`Verb ${verb}: active is a function`);
    for (const s of V.sources || []) if (!SOURCES.includes(s)) throw new Error(`Verb ${verb}: no source ${s}`);
    VERBS[verb] = V;
  }
  // Why cmd is refused, or null: no such verb or source, not its source's to do, or its verb's check. Changes nothing.
  function refusal(st, cmd) {
    const V = VERBS[cmd.verb];
    if (!V) return `there is no verb ${cmd.verb}`;
    if (!SOURCES.includes(cmd.source)) return `there is no source ${cmd.source}`;
    if (V.sources && !V.sources.includes(cmd.source))
      return `${cmd.verb} is not ${cmd.source}'s to do: ${V.sources.join(' or ')} only`;
    return V.check(st, cmd) || null;
  }
  // The one execution path, after the check: the verb carries cmd out; a lasting verb's reference, else null.
  function carry(st, cmd) {
    const V = VERBS[cmd.verb],
      ref = V.run(st, cmd);
    if (!V.active) return null;
    if (ref === null || ref === undefined) throw new Error(`Verb ${cmd.verb} began an act and gave no reference to it`);
    return ref;
  }
  // The three outcomes, for the queue: {status: 'refused', why} (nothing changed), {status: 'done'} (the act is carried out), or
  // {status: 'pending', ref} (begun; `active(st, cmd, ref)` says when it ends).
  const DONE = Object.freeze({ status: 'done' });
  function perform(st, cmd) {
    const why = refusal(st, cmd);
    if (why) return { status: 'refused', why };
    const ref = carry(st, cmd);
    return ref === null ? DONE : { status: 'pending', ref };
  }
  // Carries out cmd, or changes nothing: true, or the reason it was refused (every caller but the queue; no outcome is made).
  function issue(st, cmd) {
    const why = refusal(st, cmd);
    if (why) return why;
    carry(st, cmd);
    return true;
  }
  // Whether the act command cmd began, with reference ref, goes on: its verb's answer; a verb with no lasting act, never. ref is null for
  // a command begun in a save made before VB-1405, which kept none: the verb answers from the pawn as it stands.
  const active = (st, cmd, ref) => {
    const V = VERBS[cmd.verb];
    return !!(V && V.active && V.active(st, cmd, ref));
  };
  return {
    issue,
    perform,
    active,
    register,
    SOURCES,
    VERBS,
  };
})();

// @sys sim/decisions: questions with several voices (target-v2 4.5): a body's question asked by kind, settled by the body's procedure
//   (a vote, or one pawn deciding), with its ballots kept for the year (VB-313)
// @state st.decisionLog[]: {t, body, kind, dim, procedure, current, chosen, support[], need, by}; newest first, the last 30 (VB-313)
VB['sim/decisions'] = (() => {
  const { atLoad } = VB['sim/registry'];
  // Code, never saved state: kind -> {procedure, evaluate(st, q) -> {support[], need[]}, choose?(st, q, pawn), fallback(st, q)}. The module
  // that poses a kind of question registers it at load. A question is plain data: {kind, body (a village id), current (the option in
  // force, or null), options (their number), and what its kind's evaluation reads}; `dim` names a custom's question.
  const KINDS = {};
  function defineKind(kind, K) {
    atLoad();
    if (KINDS[kind]) throw new Error('Duplicate kind of question: ' + kind);
    if (!K || !PROCEDURES[K.procedure] || typeof K.evaluate !== 'function' || typeof K.fallback !== 'function')
      throw new Error(`Question kind ${kind} needs a procedure, an evaluate and a fallback`);
    KINDS[kind] = K;
  }
  // Who presides over a body: the pawn a tie goes to. No body has one until the alderman (VB-314), which registers its finder here.
  let presider = () => null;
  function setPresider(f) {
    atLoad();
    presider = f;
  }
  // The body's agent (VB-673): the pawn who carries out what it decided, its presider while at home (not on the road, sim/away); null while
  // the office is vacant or its holder away, and then the body's act waits. agentWhy: why pawn `actor` may not act for body now, or null.
  function agentOf(st, body) {
    const p = presider(st, body);
    return p !== null && st.agents[p] && st.agents[p].away === undefined ? p : null;
  }
  function agentWhy(st, body, actor) {
    const p = presider(st, body);
    if (p === null) return `village ${body} has no alderman to act for it`;
    if (actor !== p) return `pawn ${actor} is not the alderman of village ${body}`;
    return agentOf(st, body) === null ? `the alderman of village ${body} is away` : null;
  }
  // The procedure a body settles a kind of question by: its practice of deciding where it has one (none yet: VB-314, VB-315), else the
  // kind's default.
  const procedureFor = (st, body, kind) => KINDS[kind].procedure;
  // A tie (two options with equal support where one must be chosen) goes to the presiding pawn, else the question's fallback.
  function escalate(st, q, K) {
    const p = st ? presider(st, q.body) : null;
    return p !== null && K.choose ? { chosen: K.choose(st, q, p), by: p } : { chosen: K.fallback(st, q), by: null };
  }
  const PROCEDURES = {
    // Voices weighted as the kind weighs them: the best supported option y (the first on equal support) displaces the one in force x only
    // where its support passes x's by the margin need[y]; with nothing in force, the best is chosen, and a tie at the top escalates.
    vote(st, q, K) {
      const { support: S, need } = K.evaluate(st, q),
        x = q.current;
      let y = 0;
      for (let j = 1; j < S.length; j++) if (S[j] > S[y]) y = j;
      if (x === null) {
        for (let j = y + 1; j < S.length; j++) if (S[j] === S[y]) return { ...escalate(st, q, K), support: S, need: 0 };
        return { chosen: y, by: null, support: S, need: 0 };
      }
      if (y === x) return { chosen: x, by: null, support: S, need: 0, settled: true };
      return { chosen: S[y] > S[x] * (1 + need[y]) ? y : x, by: null, support: S, need: need[y] };
    },
    // One pawn decides: the presiding pawn, through the kind's choice; with none, the question's fallback.
    agent(st, q, K) {
      return { ...escalate(st, q, K), support: [], need: 0 };
    },
  };
  // Asks q of its body and returns the option chosen. A contested question (an option other than the one in force put to it) keeps its
  // ballots in st.decisionLog, where a state is given.
  function ask(st, q) {
    const K = KINDS[q.kind];
    if (!K) throw new Error('There is no kind of question ' + q.kind);
    const procedure = procedureFor(st, q.body, q.kind),
      r = PROCEDURES[procedure](st, q, K);
    if (st && !r.settled) {
      if (!st.decisionLog) st.decisionLog = [];
      st.decisionLog.unshift({
        t: st.t,
        body: q.body,
        kind: q.kind,
        dim: q.dim === undefined ? null : q.dim,
        procedure,
        current: q.current,
        chosen: r.chosen,
        support: r.support.map((v) => Math.round(v * 1000) / 1000),
        need: Math.round(r.need * 1000) / 1000,
        by: r.by,
      });
      if (st.decisionLog.length > LOG) st.decisionLog.length = LOG;
    }
    return r.chosen;
  }
  const LOG = 30;
  return { ask, defineKind, setPresider, procedureFor, agentOf, agentWhy, LOG };
})();

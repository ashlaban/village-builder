// @sys sim/disputes: two or more claims on one tile, settled by the "Disputed claims" custom: each claim's speaker and support, the
// scores under each rule, the winner, and the grievance of the losers (split from sim/claims, VB-1176)
VB['sim/disputes'] = (() => {
  const { YEAR, CLAIMS } = VB['sim/rules'];
  const { kinship, membersOf, voiceOf } = VB['sim/records'],
    { tieOf } = VB['sim/ties'];
  const { strength } = VB['sim/claims'];
  // @state household.grievance: written by aggrieve, below (the rules that would have let its losing claim win, until a game hour)
  // The pawn who speaks for a claim: a pawn's own, a household's holder; a village has none.
  const speaker = (st, by) =>
    by.type === 'pawn' ? by.id : by.type === 'household' ? st.households[by.id].holder : null;
  // Voice-weighted support for each claim at the meeting of village vid: a village's claim has its own voices (meetings of two villages);
  // a pawn's or household's has the voices of vid, each weighted by its tie to the speaker (the speaker's own voice counts in full).
  function support(st, claims, vid) {
    const env = st.cenv,
      voiced = (sid) =>
        membersOf(st, sid)
          .map((p) => [p, voiceOf(st, p, env.settlements[sid]) * p.standing])
          .filter(([, v]) => v > 0);
    const here = vid === null || vid === undefined ? [] : voiced(vid);
    return claims.map((c) => {
      if (c.by.type === 'village') return voiced(c.by.id).reduce((s, [, v]) => s + v, 0);
      const sp = speaker(st, c.by);
      if (sp === null) return 0;
      return here.reduce((s, [p, v]) => s + v * (p.id === sp ? 1 : Math.min(1, tieOf(st, p.id, sp))), 0);
    });
  }
  // The score of each claim under a rule, higher wins; ties go to the first claim. ctx: {lastHolder (pawn id or null), village (id of the
  // meeting that settles it)}.
  function scores(st, claims, rule, ctx = {}) {
    if (rule === 'strongest') return claims.map((c) => strength(st, c));
    if (rule === 'kin') {
      const memo = new Map(),
        last = ctx.lastHolder ?? null;
      return claims.map((c) => {
        const sp = speaker(st, c.by);
        return last === null || sp === null ? 0 : kinship(st, sp, last, memo);
      });
    }
    if (rule === 'meeting') return support(st, claims, ctx.village);
    return claims.map(() => 0); // first: only the order counts
  }
  // The winning claim of `claims` under the rule (a key of the dispute custom).
  function settle(st, claims, rule, ctx = {}) {
    const s = scores(st, claims, rule, ctx);
    let best = 0;
    for (let i = 1; i < claims.length; i++)
      if (s[i] > s[best] + 1e-9 || (Math.abs(s[i] - s[best]) <= 1e-9 && claims[i].seq < claims[best].seq)) best = i;
    return claims[best];
  }
  // The rules under which `claim` would have won: what a loser comes to argue for (self-interest, sim/society).
  // The rules scores() knows, in the order of the custom's options (culture's `dispute`; tests/claims.js holds the two alike): named here,
  // not read from culture, so the material layer reads nothing of the social one (VB-1176).
  const DISPUTE = Object.freeze(['first', 'strongest', 'kin', 'meeting']);
  const rulesFor = (st, claims, claim, ctx = {}) => DISPUTE.filter((r) => settle(st, claims, r, ctx) === claim);
  // The households of a losing claim remember the rules that would have let them win, for CLAIMS.grievanceYears: their adults lean that way.
  function aggrieve(st, claims, winner, ctx = {}) {
    for (const c of claims) {
      if (c === winner || c.by.type !== 'household') continue;
      const hh = st.households[c.by.id],
        rules = rulesFor(st, claims, c, ctx);
      if (!hh.dissolved && rules.length) hh.grievance = { rules, until: st.t + CLAIMS.grievanceYears * YEAR };
    }
  }
  return { speaker, support, scores, settle, rulesFor, aggrieve, DISPUTE };
})();

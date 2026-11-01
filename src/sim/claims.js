// @sys sim/claims: claims on tiles, realised and unrealised: strength, renewal and lapse, disputes settled by custom, and the land each holds
VB['sim/claims'] = (() => {
  const Culture = VB['culture'];
  const { YEAR, CLAIMS } = VB['sim/rules'];
  const { setOwner } = VB['sim/ownership'];
  const { kinship } = VB['sim/records'];
  // A claim is a wish for a tile (unrealised: a village's outland not yet its own, a household's stake before the ground is broken) or a right
  // in force that is not ownership (realised: a family's birthright on its old farm). Ownership itself is st.owner (sim/ownership).
  // @state st.claims: Map of tile to its claims [{by: {type 'pawn'|'household'|'village', id}, state 'unrealised'|'realised', why ('outland',
  //   'field', 'meadow', 'farm', 'birthright'), since, renewed (game hours), seq (order made), until (game hours: a realised claim's end, or null)}];
  //   a tile with none has no entry. sim/claims
  // @state st.claimSeq: number; counter for the claims' seq
  // @state st.landDirty: Set of tiles whose owner or claims changed; the page redraws its Land overlay there and clears it (VB-004)
  const NONE = [];
  const same = (a, b) => a.type === b.type && a.id === b.id;
  const dirty = (st, tile) => { if (st.landDirty) st.landDirty.add(tile); };
  const claimsOn = (st, tile) => st.claims.get(tile) || NONE;
  const claimOf = (st, tile, by) => claimsOn(st, tile).find((c) => same(c.by, by)) || null;
  // Strength: 1 for a realised claim; an unrealised one falls from 1 to 0 over CLAIMS.years without work or renewal (Decided, 30 Oct).
  const strength = (st, c) => (c.state === 'realised' ? 1 : Math.max(0, Math.min(1, 1 - (st.t - c.renewed) / (CLAIMS.years * YEAR))));
  // A claim by `by` on tile, or the existing one renewed (and given the new why and state). opt: {state, until}.
  function addClaim(st, tile, by, why, opt = {}) {
    let c = claimOf(st, tile, by);
    if (c) { c.renewed = st.t; c.why = why; if (opt.state) c.state = opt.state; if (opt.until !== undefined) c.until = opt.until; dirty(st, tile); return c; }
    c = { by: { type: by.type, id: by.id }, state: opt.state || 'unrealised', why, since: st.t, renewed: st.t, seq: ++st.claimSeq, until: opt.until ?? null };
    const list = st.claims.get(tile);
    if (list) list.push(c); else st.claims.set(tile, [c]);
    dirty(st, tile);
    return c;
  }
  // Work on the tile or a renewal by the claimant: the claim is at full strength again. The claim, or null.
  function renewClaim(st, tile, by) { const c = claimOf(st, tile, by); if (c) c.renewed = st.t; return c; }
  function dropClaim(st, tile, by) {
    const list = st.claims.get(tile); if (!list) return null;
    const i = list.findIndex((c) => same(c.by, by)); if (i < 0) return null;
    const [c] = list.splice(i, 1);
    if (!list.length) st.claims.delete(tile);
    dirty(st, tile);
    return c;
  }
  // Every claim on the tile is dropped (it was taken, or the dispute is settled). The dropped claims.
  function clearClaims(st, tile) {
    const list = st.claims.get(tile); if (!list) return NONE;
    st.claims.delete(tile); dirty(st, tile);
    return list;
  }
  // The claim is realised as ownership: the claimant (a household or a village) owns the tile and the claim is dropped.
  function realise(st, tile, by) {
    if (by.type !== 'household' && by.type !== 'village') throw new Error(`realise: a ${by.type} cannot own land`);
    dropClaim(st, tile, by); setOwner(st, tile, by);
  }
  // Once a day: unrealised claims at no strength and realised claims past their end lapse. [[tile, claim]] dropped, for their owners to see.
  function lapseClaims(st) {
    const out = [];
    for (const [tile, list] of st.claims) {
      for (const c of list) if (c.state === 'unrealised' ? strength(st, c) <= 0 : c.until !== null && st.t >= c.until) out.push([tile, c]);
    }
    for (const [tile, c] of out) dropClaim(st, tile, c.by);
    return out;
  }
  // ---- disputes: two or more claims on one tile, settled by the "Disputed claims" custom (dispute) ----
  // The pawn who speaks for a claim: a pawn's own, a household's holder; a village has none.
  const speaker = (st, by) => (by.type === 'pawn' ? by.id : by.type === 'household' ? st.households[by.id].holder : null);
  // Voice-weighted support for each claim at the meeting of village vid: a village's claim has its own voices (meetings of two villages);
  // a pawn's or household's has the voices of vid, each weighted by its tie to the speaker (the speaker's own voice counts in full).
  function support(st, claims, vid) {
    const env = st.cenv, voiced = (sid) => env.settlements[sid].members().map((p) => [p, env.voiceOf(p, env.settlements[sid]) * p.prestige])
      .filter(([, v]) => v > 0);
    const here = vid === null || vid === undefined ? [] : voiced(vid);
    return claims.map((c) => {
      if (c.by.type === 'village') return voiced(c.by.id).reduce((s, [, v]) => s + v, 0);
      const sp = speaker(st, c.by); if (sp === null) return 0;
      return here.reduce((s, [p, v]) => s + v * (p.id === sp ? 1 : Math.min(1, p.ties.get(sp) || 0)), 0);
    });
  }
  // The score of each claim under a rule, higher wins; ties go to the first claim. ctx: {lastHolder (pawn id or null), village (id of the
  // meeting that settles it)}.
  function scores(st, claims, rule, ctx = {}) {
    if (rule === 'strongest') return claims.map((c) => strength(st, c));
    if (rule === 'kin') {
      const memo = new Map(), last = ctx.lastHolder ?? null;
      return claims.map((c) => { const sp = speaker(st, c.by); return last === null || sp === null ? 0 : kinship(st, sp, last, memo); });
    }
    if (rule === 'meeting') return support(st, claims, ctx.village);
    return claims.map(() => 0); // first: only the order counts
  }
  // The winning claim of `claims` under the rule (a key of the dispute custom).
  function settle(st, claims, rule, ctx = {}) {
    const s = scores(st, claims, rule, ctx);
    let best = 0;
    for (let i = 1; i < claims.length; i++) if (s[i] > s[best] + 1e-9 || (Math.abs(s[i] - s[best]) <= 1e-9 && claims[i].seq < claims[best].seq)) best = i;
    return claims[best];
  }
  // The rules under which `claim` would have won: what a loser comes to argue for (self-interest, sim/society).
  const DISPUTE = Culture.DIMS[Culture.IDX.dispute].opts.map((o) => o[0]);
  const rulesFor = (st, claims, claim, ctx = {}) => DISPUTE.filter((r) => settle(st, claims, r, ctx) === claim);
  // The households of a losing claim remember the rules that would have let them win, for CLAIMS.grievanceYears: their adults lean that way.
  function aggrieve(st, claims, winner, ctx = {}) {
    for (const c of claims) {
      if (c === winner || c.by.type !== 'household') continue;
      const hh = st.households[c.by.id], rules = rulesFor(st, claims, c, ctx);
      if (!hh.dissolved && rules.length) hh.grievance = { rules, until: st.t + CLAIMS.grievanceYears * YEAR };
    }
  }
  // ---- land held: the base for a land tax later (claims review, Kim: "the basis for land based taxation later") ----
  // Per household and village, tiles owned by kind and claims held. Households: house, fields, meadows, other. Villages: green, farms (the
  // tiles of its empty farms), plots, outland (the rest, its wood included).
  function holdings(st) {
    const kind = new Map();
    for (const f of st.farmsteads) {
      kind.set(f.house, 'house');
      for (const fd of f.fields) kind.set(fd.tile, 'fields');
      for (const m of f.meadows || []) kind.set(m.tile, 'meadows');
    }
    for (const v of st.villages) for (const p of v.plots || []) for (const tr of p.tiles) if (!p.built) kind.set(tr.tile, 'plots');
    const greens = new Set(st.villages.map((v) => v.center));
    const households = new Map(), villages = new Map();
    const row = (m, id, keys) => { if (!m.has(id)) m.set(id, Object.fromEntries([...keys, 'claims'].map((k) => [k, 0]))); return m.get(id); };
    const HK = ['house', 'fields', 'meadows', 'other'], VK = ['green', 'farms', 'plots', 'outland'];
    for (let t = 0; t < st.owner.length; t++) {
      const n = st.owner[t]; if (n === 0) continue;
      if (n > 0) { const r = row(households, n - 1, HK), k = kind.get(t); r[HK.includes(k) && k !== 'plots' ? k : 'other']++; continue; }
      const r = row(villages, -n - 1, VK), k = kind.get(t);
      r[greens.has(t) ? 'green' : k === 'plots' ? 'plots' : k ? 'farms' : 'outland']++;
    }
    for (const list of st.claims.values()) for (const c of list) {
      if (c.by.type === 'household') row(households, c.by.id, HK).claims++; else if (c.by.type === 'village') row(villages, c.by.id, VK).claims++;
    }
    return { households, villages };
  }
  return { claimsOn, claimOf, strength, addClaim, renewClaim, dropClaim, clearClaims, realise, lapseClaims, speaker, support, scores, settle, rulesFor,
    aggrieve, holdings, DISPUTE };
})();

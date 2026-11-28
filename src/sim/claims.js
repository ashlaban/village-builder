// @sys sim/claims [material]: claims on tiles, realised and unrealised: strength, renewal and lapse, and the land each holds (disputes: sim/disputes)
VB['sim/claims'] = (() => {
  const { YEAR, CLAIMS } = VB['sim/rules'];
  const { setOwner, ownedCodes } = VB['sim/ownership'];
  const Projects = VB['sim/projects'];
  // A claim is a wish for a tile (unrealised: a village's outland not yet its own, a household's stake before the ground is broken) or a right
  // in force that is not ownership (realised: a family's birthright on its old farm). Ownership itself is st.owner (sim/ownership).
  // @state st.claims: Map of tile to its claims [{by: {type 'pawn'|'household'|'village', id}, state 'unrealised'|'realised', why ('outland',
  //   'field', 'meadow', 'farm', 'birthright'), since, renewed (game hours), seq (order made), until (game hours: a realised claim's end, or null)}];
  //   a tile with none has no entry. sim/claims
  // @state st.claimSeq: number; counter for the claims' seq
  // @state st.landDirty: Set of tiles whose owner or claims changed; the page redraws its Land overlay there and clears it (VB-004)
  const NONE = [];
  const same = (a, b) => a.type === b.type && a.id === b.id;
  const dirty = (st, tile) => {
    if (st.landDirty) st.landDirty.add(tile);
  };
  const claimsOn = (st, tile) => st.claims.get(tile) || NONE;
  const claimOf = (st, tile, by) => claimsOn(st, tile).find((c) => same(c.by, by)) || null;
  // Strength: 1 for a realised claim; an unrealised one falls from 1 to 0 over CLAIMS.years without work or renewal (Decided, 30 Oct).
  const strength = (st, c) =>
    c.state === 'realised' ? 1 : Math.max(0, Math.min(1, 1 - (st.t - c.renewed) / (CLAIMS.years * YEAR)));
  // A claim by `by` on tile, or the existing one renewed (and given the new why and state). opt: {state, until}.
  function addClaim(st, tile, by, why, opt = {}) {
    let c = claimOf(st, tile, by);
    if (c) {
      c.renewed = st.t;
      c.why = why;
      if (opt.state) c.state = opt.state;
      if (opt.until !== undefined) c.until = opt.until;
      dirty(st, tile);
      return c;
    }
    c = {
      by: { type: by.type, id: by.id },
      state: opt.state || 'unrealised',
      why,
      since: st.t,
      renewed: st.t,
      seq: ++st.claimSeq,
      until: opt.until ?? null,
    };
    const list = st.claims.get(tile);
    if (list) list.push(c);
    else st.claims.set(tile, [c]);
    dirty(st, tile);
    return c;
  }
  // Work on the tile or a renewal by the claimant: the claim is at full strength again. The claim, or null.
  function renewClaim(st, tile, by) {
    const c = claimOf(st, tile, by);
    if (c) c.renewed = st.t;
    return c;
  }
  function dropClaim(st, tile, by) {
    const list = st.claims.get(tile);
    if (!list) return null;
    const i = list.findIndex((c) => same(c.by, by));
    if (i < 0) return null;
    const [c] = list.splice(i, 1);
    if (!list.length) st.claims.delete(tile);
    dirty(st, tile);
    return c;
  }
  // Every claim on the tile is dropped (it was taken, or the dispute is settled). The dropped claims.
  function clearClaims(st, tile) {
    const list = st.claims.get(tile);
    if (!list) return NONE;
    st.claims.delete(tile);
    dirty(st, tile);
    return list;
  }
  // Every claim by `by` is dropped (a household that dissolves, sim/stakes). The number dropped.
  function dropAllOf(st, by) {
    const tiles = [];
    for (const [tile, list] of st.claims) if (list.some((c) => same(c.by, by))) tiles.push(tile);
    for (const t of tiles) dropClaim(st, t, by);
    return tiles.length;
  }
  // The claim is realised as ownership: the claimant (a household or a village) owns the tile and the claim is dropped.
  function realise(st, tile, by) {
    if (by.type !== 'household' && by.type !== 'village') throw new Error(`realise: a ${by.type} cannot own land`);
    dropClaim(st, tile, by);
    setOwner(st, tile, by);
  }
  // Once a day: unrealised claims at no strength and realised claims past their end lapse. [[tile, claim]] dropped, for their owners to see.
  function lapseClaims(st) {
    const out = [];
    for (const [tile, list] of st.claims) {
      for (const c of list)
        if (c.state === 'unrealised' ? strength(st, c) <= 0 : c.until !== null && st.t >= c.until) out.push([tile, c]);
    }
    for (const [tile, c] of out) dropClaim(st, tile, c.by);
    return out;
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
    const greens = new Set(st.villages.map((v) => v.center));
    for (const v of st.villages)
      for (const p of Projects.projectsOf(st, 'village', v.id))
        if (p.what === 'plot') for (const tr of p.steps[0].places) kind.set(tr.tile, 'plots');
        else greens.add(p.steps[0].place); // a green under way (VB-058)
    // the households' plots for their heirs (VB-255)
    if (st.plans && st.plans.projects)
      for (const p of st.plans.projects.heirPlots) for (const tr of p.steps[0].places) kind.set(tr.tile, 'plots');
    const households = new Map(),
      villages = new Map();
    const row = (m, id, keys) => {
      if (!m.has(id)) m.set(id, Object.fromEntries([...keys, 'claims'].map((k) => [k, 0])));
      return m.get(id);
    };
    const HK = ['house', 'fields', 'meadows', 'other'],
      VK = ['green', 'farms', 'plots', 'outland'];
    const owned = ownedCodes(st); // the land is counted by own (VB-311): a title's owner, else the user
    for (let t = 0; t < st.owner.length; t++) {
      const n = owned && owned.has(t) ? owned.get(t) : st.owner[t];
      if (n === 0) continue;
      if (n > 0) {
        const r = row(households, n - 1, HK),
          k = kind.get(t);
        r[HK.includes(k) && k !== 'plots' ? k : 'other']++;
        continue;
      }
      const r = row(villages, -n - 1, VK),
        k = kind.get(t);
      r[greens.has(t) ? 'green' : k === 'plots' ? 'plots' : k ? 'farms' : 'outland']++;
    }
    for (const list of st.claims.values())
      for (const c of list) {
        if (c.by.type === 'household') {
          const r = row(households, c.by.id, HK);
          r.claims++;
        } else if (c.by.type === 'village') {
          const r = row(villages, c.by.id, VK);
          r.claims++;
        }
      }
    return { households, villages };
  }
  // Work on a land project renews the household's stake on its tile (sim/stakes).
  const workStake = (st, j) => {
    renewClaim(st, j.site, j.owner);
  };
  return {
    // what it gives the page through the Sim facade (src/sim.js joins the lists, VB-1944)
    PAGE: ['claimsOn', ['claimStrength', 'strength'], 'holdings'],
    workStake,
    claimsOn,
    claimOf,
    strength,
    addClaim,
    renewClaim,
    dropClaim,
    dropAllOf,
    clearClaims,
    realise,
    lapseClaims,
    holdings,
  };
})();

// @sys sim/farmclaims: claims on empty farms (VB-033): the old family's birthright, the hours to restore a farm, and who may claim it, in the
// order of the village's "Claims on empty farms" custom
VB['sim/farmclaims'] = (() => {
  const { YEAR, CLAIMS } = VB['sim/rules'];
  const { hexSteps } = VB['sim/hex'];
  const { spouseOf, isHolder, kinDegree, practice, settlementIdOf } = VB['sim/records'];
  const CL = VB['sim/claims'];
  const { hasPlot, awaitsCottage } = VB['sim/expansion'];
  // ---- the birthright (bördsrätt; Kim, 1 Nov): when a farm empties, its last holder's family keeps a realised claim on its house ----
  const PAWN = (id) => ({ type: 'pawn', id });
  // Farm f has emptied (at `since`, game hours) after `holder` held it: a realised birthright claim by that pawn on its house, until
  // CLAIMS.birthrightYears after; none once that has passed (a scenario's farm empty longer).
  function birthright(st, f, holder, since = st.t) {
    const until = since + CLAIMS.birthrightYears * YEAR;
    if (holder === null || holder === undefined || until <= st.t) return null;
    return CL.addClaim(st, f.house, PAWN(holder), 'birthright', { state: 'realised', until });
  }
  // The birthright standing on farm f, or null.
  const birthrightOn = (st, f) => CL.claimsOn(st, f.house).find((c) => c.why === 'birthright') || null;
  // ---- restoration (Kim, 30 Oct): hours along straight lines through 0 h at condition 1, 20 h at 0.4, 60 h at 0.15 and 120 h at 0 ----
  const CURVE = [[1, 0], [0.4, 20], [0.15, 60], [0, 120]];
  function restoreHours(c) {
    c = Math.max(0, Math.min(1, c));
    for (let k = 1; k < CURVE.length; k++) {
      const [c0, h0] = CURVE[k - 1], [c1, h1] = CURVE[k];
      if (c >= c1) return h0 + ((h1 - h0) * (c0 - c)) / (c0 - c1);
    }
    return CURVE[CURVE.length - 1][1];
  }
  // A farm that may be claimed: empty, and derelict rather than a ruin (below 15%; left out until the full rebuild, Kim 1 Nov), with no claim
  // under way.
  const claimable = (f) => f.household === null && f.state === 'derelict' && !f.claim;
  // ---- who may claim, and in what order ----
  const landed = (st, id) => { const sp = spouseOf(st, id); return isHolder(st, id) || (sp !== null && isHolder(st, sp)); };
  const guardian = (st, id) => st.households.some((h) => !h.dissolved && h.guardian === id);
  // A pawn of `ids` (st.demand: landless adults who want out) who may claim a farm at all: alive and grown, with no farm, no claim under way,
  // no plot coming (sim/expansion) and no ward to keep.
  const free = (st, id) => {
    const p = st.pawns[id];
    return p.alive && p.age >= 18 && p.household !== null && !landed(st, id) && !claimOf(st, id) && !hasPlot(st, id) && !awaitsCottage(st, id)
      && !guardian(st, id);
  };
  // The farm whose claim pawn id, or their spouse, has under way, or null.
  function claimOf(st, id) {
    const sp = spouseOf(st, id);
    return st.farmsteads.find((f) => f.claim && (f.claim.by === id || (sp !== null && f.claim.by === sp))) || null;
  }
  // The claimants of farm f among `ids`, best first, under its village's `claims` practice (a key of the custom):
  //   kin       while the old family's birthright stands, its kin first (any village within CLAIMS.farmReach), closest degree first; then the
  //             farm's own villagers; once it lapses, the villagers only
  //   villagers the farm's villagers, then those of villages within reach
  //   anyone    any landless adult of a village within reach
  //   assembly  the meeting assigns it to one of its own: most voice-weighted support through ties first (sim/claims, support)
  // Then married couples before singles, then the oldest. One of a married couple stands for both (the first of them).
  function claimants(st, f, ids = st.demand, rule = practice(st, f.village).claims) {
    const vid = f.village, centre = st.villages[vid].center, right = rule === 'kin' ? birthrightOn(st, f) : null;
    const home = (id) => settlementIdOf(st, st.pawns[id]);
    const near = (id) => home(id) === vid || hexSteps(st.w, st.villages[home(id)].center, centre) <= CLAIMS.farmReach;
    const degree = new Map();
    if (right) for (const id of ids) { const d = kinDegree(st, id, right.by.id); if (Number.isFinite(d)) degree.set(id, d); }
    const keep = (id) => {
      if (!free(st, id)) return false;
      if (rule === 'kin') return home(id) === vid || (degree.has(id) && near(id));
      if (rule === 'assembly') return home(id) === vid;
      return near(id);
    };
    let list = ids.filter(keep);
    const cls = (id) => (rule === 'kin' ? (degree.has(id) ? 0 : 1) : rule === 'villagers' ? (home(id) === vid ? 0 : 1) : 0);
    const key = new Map();
    if (rule === 'kin') for (const id of list) key.set(id, degree.has(id) ? degree.get(id) : 0);
    if (rule === 'assembly') {
      const sup = CL.support(st, list.map((id) => ({ by: PAWN(id) })), vid);
      list.forEach((id, k) => key.set(id, -sup[k]));
    }
    const couple = (id) => { const sp = spouseOf(st, id); return sp !== null && st.pawns[sp].alive ? 0 : 1; };
    list.sort((a, b) => cls(a) - cls(b) || (key.get(a) || 0) - (key.get(b) || 0) || couple(a) - couple(b) || st.pawns[a].born - st.pawns[b].born
      || a - b);
    const seen = new Set();
    list = list.filter((id) => { const sp = spouseOf(st, id); if (seen.has(id)) return false; seen.add(id); if (sp !== null) seen.add(sp); return true; });
    return list;
  }
  return { birthright, birthrightOn, restoreHours, claimable, claimOf, claimants };
})();
